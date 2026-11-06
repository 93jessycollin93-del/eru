"""The hub: runs the watchdog loop and carries out the governor's decisions."""
from __future__ import annotations

import logging
import threading
import time
from collections import deque
from pathlib import Path

from . import __version__
from .config import HubConfig
from .economics import accept_ratio, estimate, mining_allowed, revenue_known, tariff_at
from .hardware import HardwareMonitor, Metrics
from .miners import MinerBase, MinerTelemetry
from .safety import Decision, Governor, State
from .storage import Store

log = logging.getLogger("mining_hub")

LOCK_NAME = "emergency.lock"


class Hub:
    def __init__(self, cfg: HubConfig, monitor: HardwareMonitor, miner: MinerBase, store: Store,
                 clock=time.monotonic):
        self.cfg = cfg
        self.monitor = monitor
        self.miner = miner
        self.store = store
        self.clock = clock
        self.state_dir = Path(cfg.state_path)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.lock_file = self.state_dir / LOCK_NAME
        self.gov = Governor(cfg)
        self._lock = threading.RLock()
        self._wake = threading.Event()
        self._stopping = threading.Event()
        self._estop = threading.Event()
        self._thread: threading.Thread | None = None
        self.metrics: Metrics | None = None
        self.telemetry = MinerTelemetry(ok=False, error="not running")
        self._last_tel_at = -1e9
        self._last_store_at = -1e9
        self._samples: deque[tuple[float, float, float]] = deque()
        self._last_avg: tuple[float, float, float] | None = None
        self._tick_failures = 0
        self._original_limit: float | None = None
        self._applied_limit: int | None = None
        self.warnings: dict[str, str] = {}
        if monitor.is_mock:
            self.warnings["mock"] = "MOCK MODE: simulated GPU and miner. Nothing is being mined."
        host = getattr(monitor, "host", None)
        if cfg.pause_for_processes and host is not None and not host.can_watch_processes:
            self.warnings["psutil"] = "pause_for_processes needs psutil: pip install psutil"
        if self.lock_file.exists():
            self._estop.set()
            self.gov.emergency("Emergency stop is still latched from an earlier session")

    # ------------------------------------------------------------------ watchdog

    def tick(self) -> Decision:
        with self._lock:
            now = self.clock()
            if (self._estop.is_set() or self.lock_file.exists()) and self.gov.state != State.EMERGENCY_STOP:
                self._estop.set()
                self.gov.emergency("Emergency lock file found (emergency_stop.py was run)")
                self._event("state", "Emergency stop latched by lock file")

            try:
                m = self.monitor.sample()
                self.warnings.pop("sensor", None)
            except Exception as e:  # noqa: BLE001 - any sensor failure is handled fail-safe
                m = None
                self.warnings["sensor"] = f"Sensor read failed: {e}"

            alive = self.miner.is_running()
            if not alive:
                self.telemetry = MinerTelemetry(ok=False, error="not running")
            elif now - self._last_tel_at >= 2.0:
                self.telemetry = self.miner.telemetry()
                self._last_tel_at = now
            tel = self.telemetry

            if m is not None:
                if m.mem_junction_c is None and tel.ok and tel.mem_junction_c is not None:
                    m.mem_junction_c = tel.mem_junction_c
                    m.mem_junction_source = "miner API"
                if self._original_limit is None and m.power_limit_w:
                    self._original_limit = m.power_limit_w

            if alive and self.gov.state == State.RUNNING and tel.ok and tel.hashrate_mhs is not None:
                power = m.power_w if m is not None and m.power_w is not None else tel.power_w
                if power is not None:
                    self._samples.append((now, tel.hashrate_mhs, power))
            window = max(60.0, self.cfg.economics.min_runtime_before_judging_s)
            while self._samples and now - self._samples[0][0] > window:
                self._samples.popleft()

            prev = self.gov.state
            d = self.gov.tick(m, alive, now, self._projected_net(now, alive),
                              allowed_now=mining_allowed(self.cfg.mining_windows))
            if d.state != prev:
                self._event("state", f"{prev.value} -> {d.state.value}: {d.reason}")
            self._act(d)
            d = Decision(self.gov.state, self.gov.reason, d.action)
            self.metrics = m

            if now - self._last_store_at >= 5.0:
                self._last_store_at = now
                self._store_metrics(m, d)
            return d

    def _projected_net(self, now: float, alive: bool) -> float | None:
        e = self.cfg.economics
        if not e.pause_if_unprofitable or not revenue_known(e):
            return None
        tariff = tariff_at(e)
        if alive and self.gov.state == State.RUNNING:
            since = self.gov.running_since
            if since is None or now - since < e.min_runtime_before_judging_s or not self._samples:
                return None
            h, p = self._averages()
            self._last_avg = (h, p, self._ratio())
            est = estimate(e, h, p, tariff, self._ratio())
            return est.net_usd_day if est else None
        if self.gov.state == State.PAUSED_UNPROFITABLE and self._last_avg:
            h, p, r = self._last_avg
            est = estimate(e, h, p, tariff, r)
            return est.net_usd_day if est else None
        return None

    def _ratio(self) -> float:
        return accept_ratio(self.telemetry.accepted, self.telemetry.rejected)

    def _averages(self) -> tuple[float, float]:
        n = len(self._samples)
        return (sum(s[1] for s in self._samples) / n, sum(s[2] for s in self._samples) / n)

    def _act(self, d: Decision) -> None:
        if d.action == "start":
            if self._estop.is_set():
                return
            self._samples.clear()
            self._apply_power_cap()
            try:
                self.miner.start()
                self._event("miner", f"Miner started ({self.cfg.miner.kind}, {self.cfg.active_profile} profile)")
            except Exception as e:  # noqa: BLE001
                log.error("Miner failed to start: %s", e)
                self.gov.start_failed(str(e))
                self._event("miner", f"Miner failed to start: {e}")
                self._restore_power_cap()
        elif d.action == "stop":
            self.miner.stop(self.cfg.miner.stop_timeout_s)
            self._event("miner", f"Miner stopped ({d.state.value})")
            self._restore_power_cap()
        elif d.action == "kill":
            self.miner.kill()
            self._event("miner", "Miner force-killed")
            self._restore_power_cap()

    def _apply_power_cap(self) -> None:
        # The mock rig always accepts caps (it stands in for a card capped in Afterburner).
        if not self.cfg.power.manage_power_limit and not self.monitor.is_mock:
            return
        cap = self.cfg.profiles[self.cfg.active_profile].power_limit_w
        if cap <= 0:
            return
        ok, msg = self.monitor.set_power_limit(cap)
        if ok:
            self._applied_limit = cap
            self.warnings.pop("power", None)
            log.info(msg)
        else:
            self.warnings["power"] = (f"Could not set the {cap} W power cap: {msg}. The power guard will "
                                      "pause mining if the GPU draws more than the profile allows.")
            log.warning(self.warnings["power"])

    def _restore_power_cap(self) -> None:
        if self._applied_limit is None or not self._original_limit:
            return
        ok, msg = self.monitor.set_power_limit(int(round(self._original_limit)))
        if ok:
            log.info("Restored the original %.0f W power limit", self._original_limit)
        else:
            log.warning("Could not restore the original power limit: %s", msg)
        self._applied_limit = None

    def _event(self, kind: str, detail: str) -> None:
        log.info("[%s] %s", kind, detail)
        try:
            self.store.event(kind, self.gov.state.value, detail)
        except Exception as e:  # noqa: BLE001
            log.warning("Could not record event: %s", e)

    def _store_metrics(self, m: Metrics | None, d: Decision) -> None:
        tel = self.telemetry
        est = self._live_estimate()
        try:
            self.store.metric({
                "ts": time.time(), "state": d.state.value, "profile": self.cfg.active_profile,
                "core_c": m.core_c if m else None, "mem_junction_c": m.mem_junction_c if m else None,
                "power_w": m.power_w if m else None, "vram_free_mb": m.vram_free_mb if m else None,
                "ram_free_mb": m.ram_free_mb if m else None, "hashrate_mhs": tel.hashrate_mhs,
                "accepted": tel.accepted, "rejected": tel.rejected,
                "net_usd_day": est.net_usd_day if est else None,
            })
        except Exception as e:  # noqa: BLE001
            log.warning("Could not record metrics: %s", e)

    def _live_estimate(self):
        e = self.cfg.economics
        if not revenue_known(e) or not self._samples:
            return None
        h, p = self._averages()
        return estimate(e, h, p, ratio=self._ratio())

    # ------------------------------------------------------------------ commands

    def start(self) -> tuple[bool, str]:
        with self._lock:
            ok, msg = self.gov.user_start()
            if ok:
                self._event("command", "Start pressed")
        self._wake.set()
        return ok, msg

    def stop(self) -> tuple[bool, str]:
        with self._lock:
            ok, msg = self.gov.user_stop()
            if ok:
                self._event("command", "Stop pressed")
        self._wake.set()
        return ok, msg

    def emergency_stop(self, reason: str = "Emergency stop pressed") -> tuple[bool, str]:
        # Kill first, before waiting on the watchdog lock.
        self._estop.set()
        try:
            self.miner.kill()
        except Exception as e:  # noqa: BLE001
            log.error("Emergency kill raised: %s", e)
        try:
            self.lock_file.write_text(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {reason}\n", encoding="utf-8")
        except OSError as e:
            log.error("Could not write emergency lock file: %s", e)
        with self._lock:
            self.gov.emergency(reason)
            self._restore_power_cap()
            self._event("emergency", reason)
        self._wake.set()
        return True, "Emergency stop: miner killed and latched"

    def reset_emergency(self) -> tuple[bool, str]:
        with self._lock:
            if self.miner.is_running():
                self.miner.kill()
            try:
                self.lock_file.unlink()
            except FileNotFoundError:
                pass
            ok, msg = self.gov.reset_emergency()
            if ok:
                self._estop.clear()
                self._event("command", "Emergency latch reset")
        return ok, msg

    def set_profile(self, name: str) -> tuple[bool, str]:
        with self._lock:
            if name not in self.cfg.profiles:
                return False, f"Unknown profile '{name}'"
            self.cfg.active_profile = name
            self._samples.clear()
            self.gov.power_over = 0
            self._event("command", f"Profile set to {name}")
            if self.miner.is_running() and self.cfg.profiles[name].power_limit_w > 0:
                self._apply_power_cap()
        self._wake.set()
        return True, f"Profile: {name}"

    # ------------------------------------------------------------------ status

    def status(self) -> dict:
        with self._lock:
            c = self.cfg
            m = self.metrics
            est = self._live_estimate()
            return {
                "version": __version__,
                "state": self.gov.state.value,
                "reason": self.gov.reason,
                "armed": self.gov.armed,
                "latched": self.gov.latched,
                "mock": self.monitor.is_mock,
                "miner_kind": c.miner.kind,
                "miner_pid": self.miner.pid,
                "profile": c.active_profile,
                "profiles": {k: {"power_limit_w": v.power_limit_w, "note": v.note} for k, v in c.profiles.items()},
                "metrics": m.to_dict() if m else None,
                "telemetry": self.telemetry.to_dict(),
                "limits": {
                    "max_gpu_core_c": c.thermal.max_gpu_core_c,
                    "max_mem_junction_c": c.thermal.max_mem_junction_c,
                    "min_free_vram_mb": c.reservations.min_free_vram_mb,
                    "min_free_ram_mb": c.reservations.min_free_ram_mb,
                    "profile_power_w": c.profiles[c.active_profile].power_limit_w,
                },
                "miner_vram_mb": round(self.gov.miner_vram_mb),
                "miner_vram_learned": self.gov.miner_vram_learned,
                "economics": est.to_dict() if est else None,
                "revenue_configured": revenue_known(c.economics),
                "tariff_now": tariff_at(c.economics),
                "tariff_currency": c.economics.tariff_currency,
                "mining_hours_now": mining_allowed(c.mining_windows),
                "warnings": list(self.warnings.values()),
                "events": self.store.recent_events(25),
                "miner_log": self.miner.log_tail(15),
            }

    # ------------------------------------------------------------------ lifecycle

    def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                self.tick()
                self._tick_failures = 0
            except Exception as e:  # noqa: BLE001
                self._tick_failures += 1
                log.exception("Watchdog tick failed; killing the miner as a precaution")
                try:
                    self.miner.kill()
                except Exception:  # noqa: BLE001
                    pass
                if self._tick_failures >= 3:
                    self.emergency_stop(f"Watchdog failed 3 times in a row: {e}")
            self._wake.wait(self.cfg.poll_interval_s)
            self._wake.clear()

    def start_background(self) -> None:
        self._thread = threading.Thread(target=self._loop, name="watchdog", daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stopping.set()
        self._wake.set()
        if self._thread is not None:
            self._thread.join(timeout=10)
        with self._lock:
            if self.miner.is_running():
                self.miner.stop(self.cfg.miner.stop_timeout_s)
                self._event("miner", "Miner stopped (hub shutting down)")
            self._restore_power_cap()
        self.monitor.close()
        self.store.close()
