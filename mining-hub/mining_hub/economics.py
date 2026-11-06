"""Mining economics. Profit is computed from measured numbers, never assumed.

    gross/day   = hashrate x revenue_per_MH/day                      (per-MH input)
                = (H / H_network) x (86400 / block_time) x reward x price   (network input)
    net revenue = gross x (1 - pool_fee - dev_fee)
    wall watts  = (gpu_w - gpu_idle_w) / psu_eff                     (PC on anyway)
                = (gpu_w + system_baseline_w) / psu_eff              (PC on only to mine)
    power cost  = wall_w x 24 / 1000 x tariff
    net/day     = net revenue - power cost
    break-even  = net revenue / kWh per day     ($/kWh at which net = 0)
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import asdict, dataclass

from .config import Economics


@dataclass
class Estimate:
    hashrate_mhs: float
    gpu_w: float
    wall_w: float
    kwh_day: float
    tariff_usd_per_kwh: float
    gross_usd_day: float
    fees_usd_day: float
    power_usd_day: float
    net_usd_day: float
    breakeven_usd_per_kwh: float | None

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


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def tariff_at(e: Economics, when: _dt.datetime | None = None) -> float:
    when = when or _dt.datetime.now()
    now_min = when.hour * 60 + when.minute
    for w in e.time_of_use:
        start, end = _minutes(w.start), _minutes(w.end)
        inside = (start <= now_min < end) if start < end else (now_min >= start or now_min < end)
        if start != end and inside:
            return w.usd_per_kwh
    return e.tariff_usd_per_kwh


def estimate(e: Economics, hashrate_mhs: float, gpu_w: float, tariff: float | None = None) -> Estimate | None:
    if not revenue_known(e):
        return None
    tariff = tariff_at(e) if tariff is None else tariff
    gross = gross_usd_day(e, hashrate_mhs)
    fees = gross * (e.pool_fee + e.dev_fee)
    wall = wall_watts(e, gpu_w) if hashrate_mhs > 0 else 0.0
    kwh = wall * 24.0 / 1000.0
    power = kwh * tariff
    return Estimate(
        hashrate_mhs=hashrate_mhs, gpu_w=gpu_w, wall_w=wall, kwh_day=kwh,
        tariff_usd_per_kwh=tariff, gross_usd_day=gross, fees_usd_day=fees,
        power_usd_day=power, net_usd_day=gross - fees - power,
        breakeven_usd_per_kwh=((gross - fees) / kwh) if kwh > 0 else None,
    )
