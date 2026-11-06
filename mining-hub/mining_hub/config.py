"""Configuration schema, defaults and safety validation.

The config file is JSON. Any key starting with "_" is treated as a comment and
ignored; any other unknown key is an error, so a typo can never silently turn
a safety limit back to its default.
"""
from __future__ import annotations

import json
import typing
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from pathlib import Path

HUB_ROOT = Path(__file__).resolve().parent.parent

MINER_KINDS = ("mock", "lolminer", "trex", "custom")
API_KINDS = ("", "lolminer", "trex")
LOOPBACK_HOSTS = ("127.0.0.1",)
CONTAINER_DEMO_HOST = "0.0.0.0"  # allowed only for the mock-mode Docker demo


class ConfigError(ValueError):
    """The configuration file is malformed or asks for something unsafe."""


@dataclass
class ThermalLimits:
    max_gpu_core_c: float = 75.0
    # GDDR6X memory junction. The card throttles at 110 C; 90 C is the long-life ceiling.
    max_mem_junction_c: float = 90.0
    hysteresis_c: float = 5.0
    cooldown_s: float = 60.0
    max_trips_per_hour: int = 3
    # GeForce cards do not expose the junction sensor through NVML; the reading
    # comes from the miner's API. If it never arrives, mining pauses unless you
    # explicitly accept running without it.
    allow_missing_mem_junction: bool = False
    sensor_grace_s: float = 45.0


@dataclass
class Reservations:
    min_free_vram_mb: int = 3072
    min_free_ram_mb: int = 40960
    recovery_margin_mb: int = 512
    # Starting guess for the miner's own VRAM use; replaced by a measured value
    # after the miner has run for 30 s.
    miner_vram_estimate_mb: int = 5000
    miner_ram_estimate_mb: int = 1024
    cooldown_s: float = 30.0


@dataclass
class PowerLimits:
    max_gpu_power_w: int = 300
    tolerance_w: int = 15
    sustained_samples: int = 5
    # Apply each profile's cap with NVML / nvidia-smi -pl. Needs Administrator.
    # If False, set the cap yourself (MSI Afterburner); the hub still pauses
    # mining if the GPU draws more than the active profile allows.
    manage_power_limit: bool = False


@dataclass
class Profile:
    power_limit_w: int = 0  # 0 = mining off in this profile
    note: str = ""


DAY_NAMES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


@dataclass
class Window:
    start: str = "00:00"  # local time, HH:MM; may wrap past midnight (e.g. 23:00-07:00); end may be 24:00
    end: str = "00:00"
    # Days the window STARTS on, e.g. ["mon","tue","wed","thu","fri"]. Empty = every day.
    days: list[str] = field(default_factory=list)


@dataclass
class TariffWindow(Window):
    per_kwh: float = 0.0  # in economics.tariff_currency


@dataclass
class Economics:
    # Your all-in electricity price (total bill / total kWh), in tariff_currency.
    tariff_per_kwh: float = 0.12
    tariff_currency: str = "USD"
    # USD per 1 unit of tariff_currency (e.g. 0.73 for CAD). Coin revenue is in USD.
    tariff_to_usd: float = 1.0
    time_of_use: list[TariffWindow] = field(default_factory=list)
    psu_efficiency: float = 0.90
    # If the PC would be on anyway (browsing, YouTube), only the GPU's extra
    # draw over idle is a mining cost.
    pc_on_anyway: bool = True
    gpu_idle_w: float = 30.0
    system_baseline_w: float = 70.0
    # Revenue: either a per-MH/s figure (e.g. from WhatToMine, before fees) ...
    revenue_usd_per_mh_day: float = 0.0
    # ... or the coin's network numbers (all four must be set).
    coin_price_usd: float = 0.0
    block_reward: float = 0.0
    block_time_s: float = 0.0
    network_hashrate_mhs: float = 0.0
    pool_fee: float = 0.01
    dev_fee: float = 0.01
    pause_if_unprofitable: bool = False
    min_net_usd_day: float = 0.0
    resume_margin_usd_day: float = 0.02
    min_runtime_before_judging_s: float = 300.0
    cooldown_s: float = 300.0


@dataclass
class MinerSettings:
    kind: str = "mock"  # mock | lolminer | trex | custom
    binary_path: str = ""
    algorithm: str = "etchash"
    pool_url: str = ""
    wallet: str = ""
    worker: str = "rig3090"
    pool_password: str = "x"
    api_port: int = 4068
    api_kind: str = ""  # custom miners only: which API parser to use
    # custom miners only: arguments after the binary. Placeholders:
    # {algo} {pool} {wallet} {worker} {user} {password} {api_port}
    args: list[str] = field(default_factory=list)
    extra_args: list[str] = field(default_factory=list)
    stop_timeout_s: float = 5.0
    max_restarts_per_hour: int = 3
    restart_backoff_s: float = 10.0


def default_profiles() -> dict[str, Profile]:
    return {
        "Desktop": Profile(200, "Quiet while you browse and work"),
        "YouTube": Profile(220, "Leaves headroom for video decode"),
        "Efficiency": Profile(240, "Best MH/s per watt on memory-bound algorithms"),
        "Overnight": Profile(280, "More throughput while unattended"),
        "Gaming": Profile(0, "Mining off; the whole GPU is yours"),
    }


@dataclass
class HubConfig:
    mock_hardware: bool = True
    gpu_index: int = 0
    host: str = "127.0.0.1"
    port: int = 8080
    poll_interval_s: float = 1.0
    state_dir: str = "state"
    active_profile: str = "Desktop"
    # Process names (e.g. "eldenring.exe") that pause mining while running.
    pause_for_processes: list[str] = field(default_factory=list)
    activity_cooldown_s: float = 20.0
    # Hours when mining is allowed at all (e.g. overnight off-peak). Empty = any time.
    mining_windows: list[Window] = field(default_factory=list)
    profiles: dict[str, Profile] = field(default_factory=default_profiles)
    thermal: ThermalLimits = field(default_factory=ThermalLimits)
    reservations: Reservations = field(default_factory=Reservations)
    power: PowerLimits = field(default_factory=PowerLimits)
    economics: Economics = field(default_factory=Economics)
    miner: MinerSettings = field(default_factory=MinerSettings)

    def __post_init__(self) -> None:
        self.base_dir = HUB_ROOT

    @property
    def state_path(self) -> Path:
        p = Path(self.state_dir)
        return p if p.is_absolute() else (Path(self.base_dir) / p)

    def to_dict(self) -> dict:
        return asdict(self)


# --------------------------------------------------------------------------- loading

def _coerce(value, hint, where: str):
    origin = typing.get_origin(hint)
    if is_dataclass(hint):
        if not isinstance(value, dict):
            raise ConfigError(f"{where}: expected an object")
        return _build(hint, value, where)
    if origin is list:
        (item_t,) = typing.get_args(hint)
        if not isinstance(value, list):
            raise ConfigError(f"{where}: expected a list")
        return [_coerce(v, item_t, f"{where}[{i}]") for i, v in enumerate(value)]
    if origin is dict:
        _, val_t = typing.get_args(hint)
        if not isinstance(value, dict):
            raise ConfigError(f"{where}: expected an object")
        return {str(k): _coerce(v, val_t, f"{where}.{k}") for k, v in value.items() if not str(k).startswith("_")}
    if hint is bool:
        if not isinstance(value, bool):
            raise ConfigError(f"{where}: expected true/false")
        return value
    if hint is int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ConfigError(f"{where}: expected a whole number")
        return value
    if hint is float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ConfigError(f"{where}: expected a number")
        return float(value)
    if hint is str:
        if not isinstance(value, str):
            raise ConfigError(f"{where}: expected text")
        return value
    return value


def _build(cls, data: dict, where: str):
    hints = typing.get_type_hints(cls)
    known = {f.name for f in fields(cls)}
    for key in data:
        if key.startswith("_"):
            continue
        if key not in known:
            raise ConfigError(f"{where}: unknown setting '{key}'")
    kwargs = {}
    for f in fields(cls):
        if f.name in data:
            kwargs[f.name] = _coerce(data[f.name], hints[f.name], f"{where}.{f.name}" if where else f.name)
    return cls(**kwargs)


def config_from_dict(data: dict, base_dir: Path | None = None) -> HubConfig:
    cfg = _build(HubConfig, data, "")
    if base_dir is not None:
        cfg.base_dir = Path(base_dir)
    validate(cfg)
    return cfg


def load_config(path: str | Path | None) -> HubConfig:
    if path is None:
        cfg = HubConfig()
        validate(cfg)
        return cfg
    p = Path(path)
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ConfigError(f"Config file not found: {p}") from None
    except json.JSONDecodeError as e:
        raise ConfigError(f"{p}: invalid JSON at line {e.lineno}: {e.msg}") from None
    if not isinstance(data, dict):
        raise ConfigError(f"{p}: top level must be an object")
    return config_from_dict(data, base_dir=p.resolve().parent)


# --------------------------------------------------------------------------- validation

def _hhmm(s: str, allow_24: bool = False) -> bool:
    try:
        h, m = s.split(":")
        if allow_24 and s == "24:00":
            return True
        return 0 <= int(h) <= 23 and 0 <= int(m) <= 59
    except ValueError:
        return False


def validate(cfg: HubConfig) -> None:
    errs: list[str] = []
    t, r, pw, e, m = cfg.thermal, cfg.reservations, cfg.power, cfg.economics, cfg.miner

    demo_only = cfg.mock_hardware and cfg.miner.kind == "mock"
    if cfg.host not in LOOPBACK_HOSTS and not (cfg.host == CONTAINER_DEMO_HOST and demo_only):
        errs.append(f"host '{cfg.host}' is not loopback; the dashboard may only listen on 127.0.0.1 "
                    "(0.0.0.0 is allowed only for the mock-mode Docker demo)")
    if not (1 <= cfg.port <= 65535):
        errs.append("port must be 1-65535")
    if not (0.5 <= cfg.poll_interval_s <= 5.0):
        errs.append("poll_interval_s must be between 0.5 and 5 seconds")

    if not (40.0 <= t.max_gpu_core_c <= 83.0):
        errs.append(f"thermal.max_gpu_core_c={t.max_gpu_core_c} is outside the safe range 40-83 C")
    if not (60.0 <= t.max_mem_junction_c <= 100.0):
        errs.append(f"thermal.max_mem_junction_c={t.max_mem_junction_c} is outside the safe range 60-100 C")
    if not (1.0 <= t.hysteresis_c <= 20.0):
        errs.append("thermal.hysteresis_c must be 1-20 C")
    if t.max_trips_per_hour < 1:
        errs.append("thermal.max_trips_per_hour must be at least 1")

    if r.min_free_vram_mb < 2048:
        errs.append("reservations.min_free_vram_mb must be at least 2048 so the desktop stays stable")
    if r.min_free_ram_mb < 16384:
        errs.append("reservations.min_free_ram_mb must be at least 16384")
    if r.recovery_margin_mb < 0 or r.miner_vram_estimate_mb < 0 or r.miner_ram_estimate_mb < 0:
        errs.append("reservation sizes cannot be negative")

    if not (100 <= pw.max_gpu_power_w <= 350):
        errs.append("power.max_gpu_power_w must be 100-350 W (RTX 3090 reference board limit)")
    if pw.sustained_samples < 1 or pw.tolerance_w < 0:
        errs.append("power.sustained_samples must be >= 1 and tolerance_w >= 0")

    if not cfg.profiles:
        errs.append("at least one profile is required")
    for name, prof in cfg.profiles.items():
        if prof.power_limit_w != 0 and not (100 <= prof.power_limit_w <= pw.max_gpu_power_w):
            errs.append(f"profile '{name}': power_limit_w must be 0 (off) or 100-{pw.max_gpu_power_w} W")
    if cfg.active_profile not in cfg.profiles:
        errs.append(f"active_profile '{cfg.active_profile}' is not one of the profiles")

    if e.tariff_per_kwh < 0 or not (0.5 <= e.psu_efficiency <= 1.0):
        errs.append("economics: tariff must be >= 0 and psu_efficiency 0.5-1.0")
    if e.tariff_to_usd <= 0:
        errs.append("economics.tariff_to_usd must be > 0 (USD per 1 unit of tariff_currency)")
    for name, windows in (("economics.time_of_use", e.time_of_use), ("mining_windows", cfg.mining_windows)):
        for i, w in enumerate(windows):
            if not (_hhmm(w.start) and _hhmm(w.end, allow_24=True)) or w.start == w.end:
                errs.append(f"{name}[{i}]: use different HH:MM start and end times")
            bad = [d for d in w.days if d.lower() not in DAY_NAMES]
            if bad:
                errs.append(f"{name}[{i}]: unknown day(s) {bad}; use {', '.join(DAY_NAMES)}")
            if isinstance(w, TariffWindow) and w.per_kwh < 0:
                errs.append(f"{name}[{i}]: tariff must be >= 0")
    if not (0 <= e.pool_fee < 0.2 and 0 <= e.dev_fee < 0.2):
        errs.append("economics: fees are fractions, e.g. 0.01 for 1%")

    if m.kind not in MINER_KINDS:
        errs.append(f"miner.kind must be one of {', '.join(MINER_KINDS)}")
    if m.api_kind not in API_KINDS:
        errs.append("miner.api_kind must be '', 'lolminer' or 'trex'")
    if not (1024 <= m.api_port <= 65535):
        errs.append("miner.api_port must be 1024-65535")
    if m.kind != "mock":
        if cfg.mock_hardware:
            errs.append("a real miner with mock_hardware=true would leave the safety watchdog blind; "
                        "set mock_hardware to false")
        if not m.binary_path:
            errs.append("miner.binary_path is required for a real miner")
        if not m.pool_url:
            errs.append("miner.pool_url is required for a real miner")
        if not m.wallet or m.wallet.upper().startswith("YOUR"):
            errs.append("miner.wallet must be your real public wallet address")
        if m.kind == "custom" and not m.args:
            errs.append("miner.args is required for a custom miner")
    if m.max_restarts_per_hour < 0 or m.stop_timeout_s <= 0:
        errs.append("miner.max_restarts_per_hour must be >= 0 and stop_timeout_s > 0")

    if errs:
        raise ConfigError("Unsafe or invalid configuration:\n  - " + "\n  - ".join(errs))
