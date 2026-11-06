"""Mining economics. Profit is computed from measured numbers, never assumed.

    gross/day   = hashrate x revenue_per_MH/day x accepted_share_ratio          (per-MH input)
                = (H / H_network) x (86400 / block_time) x reward x price x ratio   (network input)
    net revenue = gross x (1 - pool_fee - dev_fee)
    wall watts  = (gpu_w - gpu_idle_w) / psu_eff                     (PC on anyway)
                = (gpu_w + system_baseline_w) / psu_eff              (PC on only to mine)
    power cost  = wall_w x 24 / 1000 x tariff x tariff_to_usd
    net/day     = net revenue - power cost                           (USD)
    break-even  = net revenue / kWh per day / tariff_to_usd          (in your tariff currency)

Revenue is in USD (coin prices are quoted in USD); the tariff can be in any
currency (e.g. CAD with tariff_to_usd = 0.73).
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import asdict, dataclass

from .config import DAY_NAMES, Economics, Window


@dataclass
class Estimate:
    hashrate_mhs: float
    gpu_w: float
    wall_w: float
    kwh_day: float
    tariff_per_kwh: float
    tariff_currency: str
    accept_ratio: float
    gross_usd_day: float
    fees_usd_day: float
    power_usd_day: float
    net_usd_day: float
    breakeven_per_kwh: float | None  # in tariff_currency

    def to_dict(self) -> dict:
        return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in asdict(self).items()}


def revenue_known(e: Economics) -> bool:
    return e.revenue_usd_per_mh_day > 0 or _network_inputs(e)


def _network_inputs(e: Economics) -> bool:
    return min(e.coin_price_usd, e.block_reward, e.block_time_s, e.network_hashrate_mhs) > 0


def gross_usd_day(e: Economics, hashrate_mhs: float) -> float:
    if hashrate_mhs <= 0:
        return 0.0
    if e.revenue_usd_per_mh_day > 0:
        return hashrate_mhs * e.revenue_usd_per_mh_day
    if _network_inputs(e):
        share = hashrate_mhs / e.network_hashrate_mhs
        return share * (86400.0 / e.block_time_s) * e.block_reward * e.coin_price_usd
    return 0.0


def wall_watts(e: Economics, gpu_w: float) -> float:
    if e.pc_on_anyway:
        return max(0.0, gpu_w - e.gpu_idle_w) / e.psu_efficiency
    return (gpu_w + e.system_baseline_w) / e.psu_efficiency


def accept_ratio(accepted: int | None, rejected: int | None, min_shares: int = 10) -> float:
    """Share of submitted work the pool accepted. Rejected shares earn nothing."""
    if accepted is None or rejected is None or accepted + rejected < min_shares:
        return 1.0
    return accepted / (accepted + rejected)


# --------------------------------------------------------------------------- time windows

def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def in_window(w: Window, when: _dt.datetime) -> bool:
    """True if `when` falls inside the window. `days` are the days the window starts on,
    so a Fri 23:00-07:00 window still covers Saturday 02:00."""
    start, end = _minutes(w.start), _minutes(w.end)
    now = when.hour * 60 + when.minute
    days = {d.lower() for d in w.days} or set(DAY_NAMES)
    today = DAY_NAMES[when.weekday()]
    yesterday = DAY_NAMES[(when.weekday() - 1) % 7]
    if start < end:
        return today in days and start <= now < end
    if now >= start:
        return today in days
    if now < end:
        return yesterday in days
    return False


def tariff_at(e: Economics, when: _dt.datetime | None = None) -> float:
    when = when or _dt.datetime.now()
    for w in e.time_of_use:
        if in_window(w, when):
            return w.per_kwh
    return e.tariff_per_kwh


def mining_allowed(windows: list[Window], when: _dt.datetime | None = None) -> bool:
    if not windows:
        return True
    when = when or _dt.datetime.now()
    return any(in_window(w, when) for w in windows)


# --------------------------------------------------------------------------- estimate

def estimate(e: Economics, hashrate_mhs: float, gpu_w: float, tariff: float | None = None,
             ratio: float = 1.0) -> Estimate | None:
    if not revenue_known(e):
        return None
    tariff = tariff_at(e) if tariff is None else tariff
    gross = gross_usd_day(e, hashrate_mhs) * ratio
    fees = gross * (e.pool_fee + e.dev_fee)
    wall = wall_watts(e, gpu_w) if hashrate_mhs > 0 else 0.0
    kwh = wall * 24.0 / 1000.0
    power = kwh * tariff * e.tariff_to_usd
    return Estimate(
        hashrate_mhs=hashrate_mhs, gpu_w=gpu_w, wall_w=wall, kwh_day=kwh,
        tariff_per_kwh=tariff, tariff_currency=e.tariff_currency, accept_ratio=ratio,
        gross_usd_day=gross, fees_usd_day=fees, power_usd_day=power, net_usd_day=gross - fees - power,
        breakeven_per_kwh=((gross - fees) / kwh / e.tariff_to_usd) if kwh > 0 else None,
    )
