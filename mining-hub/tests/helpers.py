import socket
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from mining_hub.config import config_from_dict  # noqa: E402
from mining_hub.controller import Hub  # noqa: E402
from mining_hub.hardware import Metrics, MockHardwareMonitor, MockRig  # noqa: E402
from mining_hub.miners import MockMiner  # noqa: E402
from mining_hub.storage import Store  # noqa: E402

FAKE_MINER = ROOT / "tests" / "fake_miner.py"


class FakeClock:
    def __init__(self, t: float = 1000.0):
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, dt: float) -> None:
        self.t += dt

    sleep = advance


def make_cfg(data: dict | None = None, state_dir: str | None = None):
    d = dict(data or {})
    d.setdefault("state_dir", state_dir or tempfile.mkdtemp(prefix="hubtest-"))
    return config_from_dict(d)


def make_hub(data: dict | None = None, rig: MockRig | None = None):
    cfg = make_cfg(data)
    rig = rig or MockRig(dynamic=False)
    rig.core_c, rig.mem_c = 55.0, 80.0
    clock = FakeClock()
    mon = MockHardwareMonitor(rig, cfg.pause_for_processes, clock=clock)
    miner = MockMiner(rig)
    hub = Hub(cfg, mon, miner, Store(":memory:"), clock=clock)
    return hub, rig, miner, clock


def metrics(core=55.0, mem=80.0, vram_used=8000.0, vram_total=24576.0, ram_free=80000.0,
            power=200.0, processes=()):
    return Metrics(ts=0, gpu_name="test", core_c=core, mem_junction_c=mem, power_w=power,
                   power_limit_w=350, vram_total_mb=vram_total, vram_used_mb=vram_used,
                   ram_total_mb=131072, ram_free_mb=ram_free, processes=frozenset(processes))


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
