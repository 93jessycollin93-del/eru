"""Safety governor: the deterministic state machine that decides, every tick,
whether the miner may run.

It is pure logic. It sees metrics and returns a Decision; the controller
carries out the action. That keeps every safety rule unit-testable.

Rules, in priority order:
  1. EMERGENCY_STOP is latched; only an explicit reset leaves it (to STOPPED).
  2. Not armed by the user -> STOPPED. The hub never starts mining on its own.
  3. Sensors not responding -> PAUSED_SENSOR (fail-safe).
  4. GPU core / memory junction over limit -> PAUSED_THERMAL, resume only after
     cooling below (limit - hysteresis) and a cooldown. Repeated trips latch.
  5. No junction reading after the grace period -> PAUSED_SENSOR, latched.
  6. Sustained power above the profile cap -> PAUSED_POWER, latched.
  7. VRAM / RAM reservation for the desktop -> PAUSED_RESOURCE. The miner's
     own VRAM is learned, so stopping it cannot cause start/stop flapping.
  8. A watched process (a game) is running -> PAUSED_USER_ACTIVITY.
  9. Profile with power 0 (Gaming) -> PAUSED_PROFILE; outside your mining hours -> PAUSED_SCHEDULE.
 10. Projected net profit below threshold -> PAUSED_UNPROFITABLE.
 11. Miner exited on its own -> restart with backoff; too many -> CRASHED, latched.
"""
from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from enum import Enum

from .config import HubConfig
from .hardware import Metrics


class State(str, Enum):
    STOPPED = "STOPPED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    PAUSED_THERMAL = "PAUSED_THERMAL"
    PAUSED_SENSOR = "PAUSED_SENSOR"
    PAUSED_POWER = "PAUSED_POWER"
    PAUSED_RESOURCE = "PAUSED_RESOURCE"
    PAUSED_USER_ACTIVITY = "PAUSED_USER_ACTIVITY"
    PAUSED_PROFILE = "PAUSED_PROFILE"
    PAUSED_SCHEDULE = "PAUSED_SCHEDULE"
    PAUSED_UNPROFITABLE = "PAUSED_UNPROFITABLE"
    CRASHED = "CRASHED"
    EMERGENCY_STOP = "EMERGENCY_STOP"


@dataclass
class Decision:
    state: State
    reason: str
    action: str = "none"  # none | start | stop | kill


@dataclass
class _Pause:
    state: State
    reason: str
    latch: bool = False


VRAM_LEARN_AFTER_S = 30.0


class Governor:
    def __init__(self, cfg: HubConfig):
        self.cfg = cfg
        self.state = State.STOPPED
        self.reason = "Mining is off. Press Start when you want it."
        self.armed = False
        self.latched = False
        self.running_since: float | None = None
        self.vram_used_before_start: float | None = None
        self.miner_vram_mb = float(cfg.reservations.miner_vram_estimate_mb)
        self.miner_vram_learned = False
        self.thermal_trips: deque[float] = deque()
        self.restarts: deque[float] = deque()
        self.next_start_at = 0.0
        self.power_over = 0
        self.last_pause_seen = 0.0
        self.transitions: deque[tuple[float, str, str, str]] = deque(maxlen=200)

    # ------------------------------------------------------------------ commands

    def _set(self, state: State, reason: str, now: float | None = None) -> None:
        if state != self.state or reason != self.reason:
            if state != self.state:
                self.transitions.append((time.time(), self.state.value, state.value, reason))
            self.state, self.reason = state, reason

    def user_start(self) -> tuple[bool, str]:
        if self.state == State.EMERGENCY_STOP:
            return False, "Emergency stop is latched. Reset it first."
        self.armed = True
        self.latched = False
        self.thermal_trips.clear()
        self.restarts.clear()
        self.next_start_at = 0.0
        self.power_over = 0
        if self.state in (State.STOPPED, State.CRASHED) or self.state.value.startswith("PAUSED"):
            self._set(State.STARTING, "Start requested; running pre-flight checks")
        return True, "Start requested"

    def user_stop(self) -> tuple[bool, str]:
        if self.state == State.EMERGENCY_STOP:
            return False, "Emergency stop is latched. Reset it first."
        self.armed = False
        self.latched = False
        self._set(State.STOPPED, "Stopped by you")
        return True, "Stopped"

    def emergency(self, reason: str) -> None:
        self.armed = False
        self.latched = True
        self._set(State.EMERGENCY_STOP, reason)

    def reset_emergency(self) -> tuple[bool, str]:
        if self.state != State.EMERGENCY_STOP:
            return False, "Not in emergency stop"
        self.latched = False
        self.armed = False
        self._set(State.STOPPED, "Emergency latch cleared. Mining stays off until you press Start.")
        return True, "Emergency latch cleared"

    def start_failed(self, error: str) -> None:
        self.latched = True
        self.running_since = None
        self._set(State.CRASHED, f"Miner failed to start: {error}")

    # ------------------------------------------------------------------ evaluation

    def _profile_cap(self) -> int:
        return self.cfg.profiles[self.cfg.active_profile].power_limit_w

    def _cooldown(self, state: State) -> float:
        c = self.cfg
        return {
            State.PAUSED_THERMAL: c.thermal.cooldown_s,
            State.PAUSED_RESOURCE: c.reservations.cooldown_s,
            State.PAUSED_USER_ACTIVITY: c.activity_cooldown_s,
            State.PAUSED_UNPROFITABLE: c.economics.cooldown_s,
            State.PAUSED_SENSOR: 10.0,
        }.get(state, 0.0)

    def _check(self, m: Metrics | None, alive: bool, now: float, projected_net: float | None,
               allowed_now: bool = True) -> _Pause | None:
        c = self.cfg
        t, r = c.thermal, c.reservations

        if m is None or m.core_c is None:
            return _Pause(State.PAUSED_SENSOR, "GPU sensors are not responding; mining paused as a precaution")

        in_thermal = self.state == State.PAUSED_THERMAL
        core_lim = t.max_gpu_core_c - (t.hysteresis_c if in_thermal else 0.0)
        mem_lim = t.max_mem_junction_c - (t.hysteresis_c if in_thermal else 0.0)
        if m.core_c >= core_lim:
            return _Pause(State.PAUSED_THERMAL, f"GPU core {m.core_c:.0f} °C "
                          f"{'has not cooled below' if in_thermal else 'reached the limit of'} {core_lim:.0f} °C")
        if m.mem_junction_c is not None and m.mem_junction_c >= mem_lim:
            return _Pause(State.PAUSED_THERMAL, f"GDDR6X junction {m.mem_junction_c:.0f} °C "
                          f"{'has not cooled below' if in_thermal else 'reached the limit of'} {mem_lim:.0f} °C")

        if (alive and m.mem_junction_c is None and not t.allow_missing_mem_junction
                and self.running_since is not None and now - self.running_since >= t.sensor_grace_s):
            return _Pause(State.PAUSED_SENSOR,
                          "No GDDR6X memory-junction reading from the miner API. Use a miner that reports it "
                          "(lolMiner, T-Rex), or set thermal.allow_missing_mem_junction if you accept the risk.",
                          latch=True)

        cap = self._profile_cap()
        if alive and cap > 0 and m.power_w is not None and self.running_since is not None \
                and now - self.running_since >= 10.0:
            if m.power_w > cap + c.power.tolerance_w:
                self.power_over += 1
            else:
                self.power_over = 0
            if self.power_over >= c.power.sustained_samples:
                return _Pause(State.PAUSED_POWER,
                              f"GPU drew {m.power_w:.0f} W but the {c.active_profile} profile allows {cap} W. "
                              "Set the power limit (run as Administrator with power.manage_power_limit, "
                              "or use MSI Afterburner), then press Start.", latch=True)

        margin = r.recovery_margin_mb if self.state == State.PAUSED_RESOURCE else 0.0
        free_v = m.vram_free_mb
        if free_v is not None:
            need = r.min_free_vram_mb + margin
            effective = free_v if alive else free_v - self.miner_vram_mb
            if effective < need:
                what = "Free VRAM" if alive else "Free VRAM after the miner starts (est.)"
                return _Pause(State.PAUSED_RESOURCE,
                              f"{what} {effective / 1024:.1f} GB is below the {r.min_free_vram_mb / 1024:.1f} GB "
                              "reserved for Chrome and the desktop")
        if m.ram_free_mb is not None:
            need = r.min_free_ram_mb + margin
            effective = m.ram_free_mb - (0 if alive else r.miner_ram_estimate_mb)
            if effective < need:
                return _Pause(State.PAUSED_RESOURCE,
                              f"Free RAM {effective / 1024:.1f} GB is below the {r.min_free_ram_mb / 1024:.0f} GB "
                              "reserved for Windows and Chrome")

        if m.processes:
            return _Pause(State.PAUSED_USER_ACTIVITY, f"Paused while {', '.join(sorted(m.processes))} is running")

        if cap == 0:
            return _Pause(State.PAUSED_PROFILE, f"{c.active_profile} profile: mining is off")

        if not allowed_now:
            return _Pause(State.PAUSED_SCHEDULE, "Outside your mining hours (mining_windows)")

        if projected_net is not None:
            e = c.economics
            need = e.min_net_usd_day + (e.resume_margin_usd_day if self.state == State.PAUSED_UNPROFITABLE else 0.0)
            if projected_net < need:
                return _Pause(State.PAUSED_UNPROFITABLE,
                              f"Projected net ${projected_net:+.2f}/day is below your ${e.min_net_usd_day:.2f}/day "
                              "threshold at the current tariff")
        return None

    def tick(self, m: Metrics | None, alive: bool, now: float, projected_net: float | None = None,
             allowed_now: bool = True) -> Decision:
        if self.state == State.EMERGENCY_STOP:
            return Decision(self.state, self.reason, "kill" if alive else "none")
        if not self.armed:
            if self.state != State.STOPPED:
                self._set(State.STOPPED, "Stopped")
            self.running_since = None
            return Decision(self.state, self.reason, "stop" if alive else "none")
        if self.latched:
            self.running_since = None
            return Decision(self.state, self.reason, "stop" if alive else "none")

        # Learn how much VRAM the miner itself uses, so resource checks while
        # stopped can predict what will be left once it starts again.
        if (alive and m is not None and m.vram_used_mb is not None and self.vram_used_before_start is not None
                and self.running_since is not None and now - self.running_since >= VRAM_LEARN_AFTER_S
                and not self.miner_vram_learned):
            used = m.vram_used_mb - self.vram_used_before_start
            if used > 256:
                self.miner_vram_mb = min(20000.0, max(1000.0, used))
                self.miner_vram_learned = True

        # Unexpected exit while we believed it was running.
        if not alive and self.state == State.RUNNING and self.running_since is not None:
            self.running_since = None
            self.restarts.append(now)
            while self.restarts and now - self.restarts[0] > 3600:
                self.restarts.popleft()
            limit = self.cfg.miner.max_restarts_per_hour
            if len(self.restarts) > limit:
                self.latched = True
                self._set(State.CRASHED, f"Miner exited {len(self.restarts)} times in an hour; "
                          "check the miner log, then press Start")
                return Decision(self.state, self.reason)
            self.next_start_at = now + self.cfg.miner.restart_backoff_s
            self._set(State.STARTING, f"Miner exited unexpectedly; restart {len(self.restarts)}/{limit} "
                      f"in {self.cfg.miner.restart_backoff_s:.0f} s")

        pause = self._check(m, alive, now, projected_net, allowed_now)
        if pause is not None:
            self.last_pause_seen = now
            if pause.state == State.PAUSED_THERMAL and self.state != State.PAUSED_THERMAL:
                self.thermal_trips.append(now)
                while self.thermal_trips and now - self.thermal_trips[0] > 3600:
                    self.thermal_trips.popleft()
                if len(self.thermal_trips) >= self.cfg.thermal.max_trips_per_hour:
                    pause.latch = True
                    pause.reason += (f" ({len(self.thermal_trips)} thermal trips in an hour: check airflow or "
                                     "use a lower-power profile, then press Start)")
            self.power_over = 0
            self._set(pause.state, pause.reason)
            self.latched = pause.latch
            self.running_since = None
            return Decision(self.state, self.reason, "stop" if alive else "none")

        # Nothing is blocking. Honour cooldowns before (re)starting.
        if self.state.value.startswith("PAUSED"):
            wait = self._cooldown(self.state) - (now - self.last_pause_seen)
            if wait > 0:
                base = self.reason.split(" — resuming")[0]
                self._set(self.state, f"{base} — resuming in {wait:.0f} s if it stays clear")
                return Decision(self.state, self.reason, "stop" if alive else "none")

        if alive:
            if self.state != State.RUNNING:
                self._set(State.RUNNING, "Mining")
                self.running_since = self.running_since or now
            return Decision(self.state, self.reason)

        if now < self.next_start_at:
            return Decision(self.state, self.reason)
        self.vram_used_before_start = m.vram_used_mb if m is not None else None
        self.running_since = now
        self._set(State.RUNNING, "Mining")
        return Decision(self.state, self.reason, "start")
