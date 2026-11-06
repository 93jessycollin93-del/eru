"""Hardware telemetry: NVML (preferred), nvidia-smi (fallback) and a mock rig.

Note on the GDDR6X memory junction: GeForce cards (RTX 3090 included) do not
expose that sensor through NVML or nvidia-smi; it reads N/A. The hub takes the
junction temperature from the miner's API instead (see miners.py).
"""
from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

MB = 1024 * 1024
_WIN = sys.platform == "win32"
_NO_WINDOW = 0x08000000 if _WIN else 0


@dataclass
class Metrics:
    ts: float
    gpu_name: str = "unknown"
    core_c: float | None = None
    mem_junction_c: float | None = None
    mem_junction_source: str = ""
    power_w: float | None = None
    power_limit_w: float | None = None
    vram_total_mb: float | None = None
    vram_used_mb: float | None = None
    util_pct: float | None = None
    fan_pct: float | None = None
    ram_total_mb: float | None = None
    ram_free_mb: float | None = None
    processes: frozenset = field(default_factory=frozenset)
    is_mock: bool = False

    @property
    def vram_free_mb(self) -> float | None:
        if self.vram_total_mb is None or self.vram_used_mb is None:
            return None
        return max(0.0, self.vram_total_mb - self.vram_used_mb)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["processes"] = sorted(self.processes)
        d["vram_free_mb"] = self.vram_free_mb
        return d


class HardwareMonitor:
    is_mock = False

    def sample(self) -> Metrics:
        raise NotImplementedError

    def set_power_limit(self, watts: int) -> tuple[bool, str]:
        raise NotImplementedError

    def close(self) -> None:
        pass


# --------------------------------------------------------------------------- host (RAM, processes)

class HostProbe:
    def __init__(self, watch_processes: list[str] | None = None):
        self.watch = {p.lower() for p in (watch_processes or [])}
        try:
            import psutil  # type: ignore
            self.psutil = psutil
        except ImportError:
            self.psutil = None
        self._proc_cache: tuple[float, frozenset] = (0.0, frozenset())

    @property
    def can_watch_processes(self) -> bool:
        return self.psutil is not None

    def ram_mb(self) -> tuple[float | None, float | None]:
        if self.psutil is not None:
            vm = self.psutil.virtual_memory()
            return vm.total / MB, vm.available / MB
        if _WIN:
            return _win_ram_mb()
        try:
            info = {}
            for line in Path("/proc/meminfo").read_text().splitlines():
                k, v = line.split(":", 1)
                info[k] = float(v.split()[0]) / 1024.0
            return info.get("MemTotal"), info.get("MemAvailable")
        except (OSError, ValueError):
            return None, None

    def processes(self) -> frozenset:
        if not self.watch or self.psutil is None:
            return frozenset()
        now = time.monotonic()
        if now - self._proc_cache[0] < 3.0:
            return self._proc_cache[1]
        names = set()
        for p in self.psutil.process_iter(["name"]):
            n = (p.info.get("name") or "").lower()
            if n in self.watch:
                names.add(n)
        found = frozenset(names)
        self._proc_cache = (now, found)
        return found


def _win_ram_mb() -> tuple[float | None, float | None]:
    import ctypes

    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]

    st = MEMORYSTATUSEX()
    st.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):
        return None, None
    return st.ullTotalPhys / MB, st.ullAvailPhys / MB


# --------------------------------------------------------------------------- nvidia-smi

SMI_QUERY = ("name,temperature.gpu,temperature.memory,power.draw,power.limit,"
             "memory.total,memory.used,utilization.gpu,fan.speed")


def _num(s: str) -> float | None:
    s = s.strip()
    if not s or "N/A" in s or "Not Supported" in s or s.startswith("["):
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def parse_smi_line(line: str) -> dict:
    parts = [p.strip() for p in line.strip().split(",")]
    if len(parts) < 9:
        raise ValueError(f"unexpected nvidia-smi output: {line!r}")
    return {
        "gpu_name": parts[0],
        "core_c": _num(parts[1]),
        "mem_junction_c": _num(parts[2]),
        "power_w": _num(parts[3]),
        "power_limit_w": _num(parts[4]),
        "vram_total_mb": _num(parts[5]),
        "vram_used_mb": _num(parts[6]),
        "util_pct": _num(parts[7]),
        "fan_pct": _num(parts[8]),
    }


def _run(args: list[str], timeout: float = 5.0) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                          creationflags=_NO_WINDOW, shell=False)


def smi_set_power_limit(gpu_index: int, watts: int) -> tuple[bool, str]:
    try:
        r = _run(["nvidia-smi", "-i", str(gpu_index), "-pl", str(int(watts))])
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, f"nvidia-smi failed: {e}"
    if r.returncode == 0:
        return True, f"Power limit set to {watts} W"
    msg = (r.stderr or r.stdout).strip().splitlines()
    return False, (msg[0] if msg else "nvidia-smi -pl failed") + " (setting power limits needs Administrator)"


class NvidiaSmiMonitor(HardwareMonitor):
    def __init__(self, gpu_index: int = 0, watch_processes: list[str] | None = None):
        if shutil.which("nvidia-smi") is None:
            raise RuntimeError("nvidia-smi not found on PATH")
        self.gpu_index = gpu_index
        self.host = HostProbe(watch_processes)

    def sample(self) -> Metrics:
        r = _run(["nvidia-smi", "-i", str(self.gpu_index), f"--query-gpu={SMI_QUERY}",
                  "--format=csv,noheader,nounits"])
        if r.returncode != 0:
            raise RuntimeError(f"nvidia-smi exited {r.returncode}: {r.stderr.strip()}")
        vals = parse_smi_line(r.stdout.strip().splitlines()[0])
        total, free = self.host.ram_mb()
        m = Metrics(ts=time.time(), ram_total_mb=total, ram_free_mb=free,
                    processes=self.host.processes(), **vals)
        if m.mem_junction_c is not None:
            m.mem_junction_source = "nvidia-smi"
        return m

    def set_power_limit(self, watts: int) -> tuple[bool, str]:
        return smi_set_power_limit(self.gpu_index, watts)


# --------------------------------------------------------------------------- NVML

def _try(fn):
    try:
        return fn()
    except Exception:  # noqa: BLE001 - every NVML query is optional
        return None


class NvmlMonitor(HardwareMonitor):
    """Uses the nvidia-ml-py package (import name: pynvml)."""

    def __init__(self, gpu_index: int = 0, watch_processes: list[str] | None = None):
        import pynvml  # type: ignore
        self.nv = pynvml
        pynvml.nvmlInit()
        self.gpu_index = gpu_index
        self.h = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
        name = pynvml.nvmlDeviceGetName(self.h)
        self.name = name.decode() if isinstance(name, bytes) else str(name)
        self.host = HostProbe(watch_processes)

    def sample(self) -> Metrics:
        nv, h = self.nv, self.h
        core = _try(lambda: float(nv.nvmlDeviceGetTemperature(h, nv.NVML_TEMPERATURE_GPU)))
        if core is None:
            raise RuntimeError("NVML returned no GPU temperature")
        mem = _try(lambda: nv.nvmlDeviceGetMemoryInfo(h))
        total, free = self.host.ram_mb()
        return Metrics(
            ts=time.time(),
            gpu_name=self.name,
            core_c=core,
            power_w=_try(lambda: nv.nvmlDeviceGetPowerUsage(h) / 1000.0),
            power_limit_w=_try(lambda: nv.nvmlDeviceGetEnforcedPowerLimit(h) / 1000.0),
            vram_total_mb=(mem.total / MB) if mem else None,
            vram_used_mb=(mem.used / MB) if mem else None,
            util_pct=_try(lambda: float(nv.nvmlDeviceGetUtilizationRates(h).gpu)),
            fan_pct=_try(lambda: float(nv.nvmlDeviceGetFanSpeed(h))),
            ram_total_mb=total,
            ram_free_mb=free,
            processes=self.host.processes(),
        )

    def set_power_limit(self, watts: int) -> tuple[bool, str]:
        try:
            self.nv.nvmlDeviceSetPowerManagementLimit(self.h, int(watts) * 1000)
            return True, f"Power limit set to {watts} W"
        except Exception as e:  # noqa: BLE001
            ok, msg = smi_set_power_limit(self.gpu_index, watts)
            return (ok, msg) if ok else (False, f"NVML: {e}; {msg}")

    def close(self) -> None:
        _try(self.nv.nvmlShutdown)


# --------------------------------------------------------------------------- mock

class MockRig:
    """A simulated RTX 3090 + 128 GB host. Every reading it produces is marked mock.

    With dynamic=True temperatures drift toward a steady state set by power
    draw (so the dashboard demo shows real thermal behaviour, including the
    Overnight profile tripping the 90 C junction limit). Tests use
    dynamic=False and set values directly.
    """

    def __init__(self, dynamic: bool = True, ambient_c: float = 28.0):
        self.dynamic = dynamic
        self.ambient_c = ambient_c
        self.mining = False
        self.power_limit_w = 350.0
        self.core_c = 38.0
        self.mem_c = 52.0
        self.desktop_vram_mb = 2500.0
        self.miner_vram_mb = 4600.0
        self.vram_total_mb = 24576.0
        self.ram_total_mb = 131072.0
        self.ram_free_mb = 80000.0
        self.processes: set[str] = set()
        self.report_mem_junction = True
        self.sensor_fail = False
        self.power_override_w: float | None = None
        self._last: float | None = None

    def draw_w(self) -> float:
        if self.power_override_w is not None:
            return self.power_override_w
        return round(0.97 * self.power_limit_w, 1) if self.mining else 32.0

    def hashrate_mhs(self) -> float:
        if not self.mining:
            return 0.0
        return round(124.0 * min(1.0, self.power_limit_w / 240.0) ** 0.6, 2)

    def step(self, now: float) -> None:
        if not self.dynamic:
            return
        dt = 0.0 if self._last is None else min(5.0, max(0.0, now - self._last))
        self._last = now
        draw = self.draw_w()
        core_target = self.ambient_c + draw * 0.15
        mem_target = self.ambient_c + 15.0 + draw * 0.19
        k = 1.0 - math.exp(-dt / 20.0)
        self.core_c += (core_target - self.core_c) * k
        self.mem_c += (mem_target - self.mem_c) * k


class MockHardwareMonitor(HardwareMonitor):
    is_mock = True

    def __init__(self, rig: MockRig, watch_processes: list[str] | None = None, clock=time.monotonic):
        self.rig = rig
        self.watch = {p.lower() for p in (watch_processes or [])}
        self.clock = clock

    def sample(self) -> Metrics:
        rig = self.rig
        if rig.sensor_fail:
            raise RuntimeError("[MOCK] sensor read failed")
        rig.step(self.clock())
        used = rig.desktop_vram_mb + (rig.miner_vram_mb if rig.mining else 0.0)
        return Metrics(
            ts=time.time(),
            gpu_name="NVIDIA GeForce RTX 3090 [MOCK]",
            core_c=round(rig.core_c, 1),
            mem_junction_c=None,  # like a real GeForce: junction comes from the miner API
            power_w=rig.draw_w(),
            power_limit_w=rig.power_limit_w,
            vram_total_mb=rig.vram_total_mb,
            vram_used_mb=used,
            util_pct=99.0 if rig.mining else 3.0,
            fan_pct=70.0 if rig.mining else 30.0,
            ram_total_mb=rig.ram_total_mb,
            ram_free_mb=rig.ram_free_mb,
            processes=frozenset(p.lower() for p in rig.processes if p.lower() in self.watch),
            is_mock=True,
        )

    def set_power_limit(self, watts: int) -> tuple[bool, str]:
        self.rig.power_limit_w = float(watts)
        return True, f"[MOCK] power limit set to {watts} W"


def make_monitor(cfg, rig: MockRig | None = None) -> HardwareMonitor:
    if cfg.mock_hardware:
        return MockHardwareMonitor(rig or MockRig(), cfg.pause_for_processes)
    errors = []
    if os.environ.get("MINING_HUB_NO_NVML") != "1":
        try:
            return NvmlMonitor(cfg.gpu_index, cfg.pause_for_processes)
        except Exception as e:  # noqa: BLE001
            errors.append(f"NVML: {e}")
    try:
        return NvidiaSmiMonitor(cfg.gpu_index, cfg.pause_for_processes)
    except Exception as e:  # noqa: BLE001
        errors.append(f"nvidia-smi: {e}")
    raise RuntimeError("No NVIDIA telemetry available (" + "; ".join(errors) +
                       "). Install the NVIDIA driver, or `pip install nvidia-ml-py`.")
