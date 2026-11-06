"""Miner adapters: a mock miner and a supervised CLI miner (lolMiner, T-Rex, custom).

The hub never implements hashing itself. It launches the binary you
downloaded and verified, as a direct child process with an explicit argument
list (never through a shell), reads its local JSON API, and stops it.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path

from . import winjob
from .config import MinerSettings
from .hardware import MockRig
from .redact import Redactor

log = logging.getLogger("mining_hub")
_WIN = sys.platform == "win32"

_UNITS = {"h/s": 1e-6, "kh/s": 1e-3, "mh/s": 1.0, "gh/s": 1e3, "th/s": 1e6}


@dataclass
class MinerTelemetry:
    ok: bool = False
    hashrate_mhs: float | None = None
    accepted: int | None = None
    rejected: int | None = None
    power_w: float | None = None
    core_c: float | None = None
    mem_junction_c: float | None = None
    error: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _f(v) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _i(v) -> int | None:
    try:
        return None if v is None else int(v)
    except (TypeError, ValueError):
        return None


def _ci(d: dict, *keys):
    low = {str(k).lower(): v for k, v in d.items()}
    for k in keys:
        if k.lower() in low:
            return low[k.lower()]
    return None


def _junction(v) -> float | None:
    v = _f(v)
    # Miners report 0 (or negative) when the sensor is unavailable.
    return v if v is not None and v > 0 else None


def parse_lolminer(doc: dict, device: int = 0) -> MinerTelemetry:
    algos = doc.get("Algorithms") or []
    a = algos[0] if algos else {}
    unit = str(a.get("Performance_Unit") or "Mh/s").lower()
    perf = _f(a.get("Total_Performance"))
    workers = doc.get("Workers") or []
    w = next((x for x in workers if x.get("Index") == device), workers[0] if workers else {})
    return MinerTelemetry(
        ok=True,
        hashrate_mhs=None if perf is None else perf * _UNITS.get(unit, 1.0),
        accepted=_i(a.get("Total_Accepted")),
        rejected=_i(a.get("Total_Rejected")),
        power_w=_f(_ci(w, "Power")),
        core_c=_f(_ci(w, "Core_Temp")),
        mem_junction_c=_junction(_ci(w, "Mem_Temp", "Memory_Temp")),
    )


def parse_trex(doc: dict, device: int = 0) -> MinerTelemetry:
    gpus = doc.get("gpus") or []
    g = next((x for x in gpus if x.get("device_id") == device), gpus[0] if gpus else {})
    hr = _f(doc.get("hashrate"))
    return MinerTelemetry(
        ok=True,
        hashrate_mhs=None if hr is None else hr / 1e6,
        accepted=_i(doc.get("accepted_count")),
        rejected=_i(doc.get("rejected_count")),
        power_w=_f(g.get("power")),
        core_c=_f(g.get("temperature")),
        mem_junction_c=_junction(g.get("memory_temperature")),
    )


PARSERS = {"lolminer": (parse_lolminer, "/"), "trex": (parse_trex, "/summary")}


def build_command(s: MinerSettings) -> list[str]:
    user = f"{s.wallet}.{s.worker}" if s.worker else s.wallet
    if s.kind == "lolminer":
        cmd = [s.binary_path, "--algo", s.algorithm, "--pool", s.pool_url, "--user", user,
               "--pass", s.pool_password, "--apihost", "127.0.0.1", "--apiport", str(s.api_port)]
    elif s.kind == "trex":
        cmd = [s.binary_path, "-a", s.algorithm, "-o", s.pool_url, "-u", user, "-p", s.pool_password,
               "--api-bind-http", f"127.0.0.1:{s.api_port}"]
    elif s.kind == "custom":
        values = {"algo": s.algorithm, "pool": s.pool_url, "wallet": s.wallet, "worker": s.worker,
                  "user": user, "password": s.pool_password, "api_port": str(s.api_port)}
        cmd = [s.binary_path] + [a.format_map(values) for a in s.args]
    else:
        raise ValueError(f"no command for miner kind {s.kind!r}")
    return cmd + list(s.extra_args)


class MinerBase:
    kind = "base"

    def start(self) -> None:
        raise NotImplementedError

    def stop(self, timeout_s: float = 5.0) -> None:
        raise NotImplementedError

    def kill(self) -> None:
        raise NotImplementedError

    def is_running(self) -> bool:
        raise NotImplementedError

    def telemetry(self) -> MinerTelemetry:
        raise NotImplementedError

    @property
    def pid(self) -> int | None:
        return None

    def log_tail(self, n: int = 30) -> list[str]:
        return []


class MockMiner(MinerBase):
    kind = "mock"

    def __init__(self, rig: MockRig):
        self.rig = rig
        self._running = False
        self._started = 0.0
        self.starts = 0
        self.fail_start: str | None = None
        self._log: deque[str] = deque(maxlen=200)

    def start(self) -> None:
        if self.fail_start:
            raise RuntimeError(self.fail_start)
        if self._running:
            return
        self._running = True
        self.rig.mining = True
        self._started = time.monotonic()
        self.starts += 1
        self._log.append(f"[MOCK] miner started (#{self.starts}) at {self.rig.power_limit_w:.0f} W cap")

    def stop(self, timeout_s: float = 5.0) -> None:
        if self._running:
            self._log.append("[MOCK] miner stopped")
        self._running = False
        self.rig.mining = False

    def kill(self) -> None:
        if self._running:
            self._log.append("[MOCK] miner killed")
        self._running = False
        self.rig.mining = False

    def crash(self) -> None:
        """Test helper: the miner exits on its own."""
        self._running = False
        self.rig.mining = False
        self._log.append("[MOCK] miner exited unexpectedly")

    def is_running(self) -> bool:
        return self._running

    def telemetry(self) -> MinerTelemetry:
        if not self._running:
            return MinerTelemetry(ok=False, error="not running")
        up = time.monotonic() - self._started
        return MinerTelemetry(
            ok=True, hashrate_mhs=self.rig.hashrate_mhs(), accepted=int(up / 7), rejected=0,
            power_w=self.rig.draw_w(), core_c=round(self.rig.core_c, 1),
            mem_junction_c=round(self.rig.mem_c, 1) if self.rig.report_mem_junction else None)

    def log_tail(self, n: int = 30) -> list[str]:
        return list(self._log)[-n:]


class CliMiner(MinerBase):
    def __init__(self, settings: MinerSettings, state_dir: Path, redactor: Redactor):
        self.s = settings
        self.kind = settings.kind
        self.state_dir = Path(state_dir)
        self.redactor = redactor
        self.proc: subprocess.Popen | None = None
        self._job = None
        self._tail: deque[str] = deque(maxlen=200)
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self.last_exit_code: int | None = None
        redactor.add(settings.wallet)
        redactor.add(settings.pool_password if settings.pool_password != "x" else None)

    @property
    def pid_file(self) -> Path:
        return self.state_dir / "miner.pid"

    @property
    def pid(self) -> int | None:
        return self.proc.pid if self.proc and self.proc.poll() is None else None

    def command(self) -> list[str]:
        return build_command(self.s)

    def start(self) -> None:
        if self.is_running():
            return
        cmd = self.command()
        exe = Path(cmd[0])
        if not exe.is_file() and shutil.which(cmd[0]) is None:
            raise FileNotFoundError(f"Miner binary not found: {cmd[0]}")
        self.state_dir.mkdir(parents=True, exist_ok=True)
        kwargs: dict = {"stdout": subprocess.PIPE, "stderr": subprocess.STDOUT,
                        "stdin": subprocess.DEVNULL, "shell": False}
        if exe.is_file():
            kwargs["cwd"] = str(exe.resolve().parent)
        if _WIN:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        log.info("Starting miner: %s", " ".join(cmd))
        proc = subprocess.Popen(cmd, **kwargs)
        self.proc = proc
        if _WIN:
            try:
                self._job = winjob.assign_kill_on_close(proc)
            except OSError as e:
                log.warning("Could not attach miner to a kill-on-close job (%s); if the hub crashes, "
                            "run emergency_stop.py", e)
        self.pid_file.write_text(json.dumps({"pid": proc.pid, "image": exe.name, "started": time.time()}))
        threading.Thread(target=self._pump, args=(proc,), daemon=True, name="miner-output").start()

    def _pump(self, proc: subprocess.Popen) -> None:
        path = self.state_dir / "miner.log"
        assert proc.stdout is not None
        try:
            with open(path, "a", encoding="utf-8", errors="replace") as fh:
                for raw in iter(proc.stdout.readline, b""):
                    line = self.redactor(raw.decode("utf-8", "replace").rstrip())
                    self._tail.append(line)
                    fh.write(line + "\n")
                    fh.flush()
        finally:
            proc.stdout.close()

    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def stop(self, timeout_s: float | None = None) -> None:
        proc = self.proc
        if proc is None:
            return
        timeout_s = self.s.stop_timeout_s if timeout_s is None else timeout_s
        if proc.poll() is None:
            try:
                if _WIN:
                    proc.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    os.killpg(proc.pid, signal.SIGTERM)
            except (OSError, ValueError):
                pass
            try:
                proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                log.warning("Miner ignored the stop request for %.0fs; force-killing", timeout_s)
                self.kill()
                return
        self._cleanup()

    def kill(self) -> None:
        proc = self.proc
        if proc is None:
            return
        if proc.poll() is None:
            if _WIN:
                try:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                                   capture_output=True, timeout=5)
                except (OSError, subprocess.TimeoutExpired):
                    pass
            else:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
            try:
                proc.kill()
            except OSError:
                pass
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                log.error("Miner PID %s did not exit after kill", proc.pid)
        self._cleanup()

    def _cleanup(self) -> None:
        if self.proc is not None:
            self.last_exit_code = self.proc.poll()
        winjob.close(self._job)
        self._job = None
        try:
            self.pid_file.unlink()
        except FileNotFoundError:
            pass

    def telemetry(self) -> MinerTelemetry:
        if not self.is_running():
            return MinerTelemetry(ok=False, error="not running")
        api = self.s.kind if self.s.kind in PARSERS else self.s.api_kind
        if api not in PARSERS:
            return MinerTelemetry(ok=False, error="no API parser configured for this miner")
        parser, path = PARSERS[api]
        url = f"http://127.0.0.1:{self.s.api_port}{path}"
        try:
            with self._opener.open(url, timeout=0.7) as resp:
                doc = json.loads(resp.read().decode("utf-8", "replace"))
            return parser(doc)
        except (OSError, ValueError) as e:
            return MinerTelemetry(ok=False, error=f"miner API unreachable: {e}")

    def log_tail(self, n: int = 30) -> list[str]:
        return list(self._tail)[-n:]


def make_miner(cfg, redactor: Redactor, rig: MockRig | None = None) -> MinerBase:
    if cfg.miner.kind == "mock":
        return MockMiner(rig or MockRig(dynamic=False))
    return CliMiner(cfg.miner, cfg.state_path, redactor)
