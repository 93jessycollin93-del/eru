"""Stepped power-cap benchmark: measures MH/s per watt on *your* card.

Runs each cap under the full safety watchdog. If any step trips a safety
limit the benchmark stops there (higher caps would only run hotter).
"""
from __future__ import annotations

import csv
import time
from pathlib import Path

from .config import Profile
from .economics import estimate, revenue_known
from .safety import State

BENCH_PROFILE = "_benchmark"


def run_benchmark(hub, caps: list[int], seconds: float = 60.0, warmup_s: float = 30.0,
                  sleep=time.sleep, clock=None, out_dir: Path | None = None) -> list[dict]:
    cfg = hub.cfg
    clock = clock or hub.clock
    if not cfg.power.manage_power_limit and not hub.monitor.is_mock:
        raise RuntimeError("The benchmark steps the power cap, so it needs power.manage_power_limit=true "
                           "and an Administrator terminal.")
    for cap in caps:
        if not (100 <= cap <= cfg.power.max_gpu_power_w):
            raise ValueError(f"cap {cap} W is outside 100-{cfg.power.max_gpu_power_w} W")
    original_profile = cfg.active_profile
    original_manage = cfg.power.manage_power_limit
    cfg.power.manage_power_limit = True  # mock mode: let the mock rig apply caps
    results: list[dict] = []
    try:
        for cap in sorted(caps):
            cfg.profiles[BENCH_PROFILE] = Profile(cap, "benchmark step")
            hub.set_profile(BENCH_PROFILE)
            ok, msg = hub.start()
            if not ok:
                raise RuntimeError(msg)
            t0 = clock()
            samples = []
            aborted = ""
            while clock() - t0 < warmup_s + seconds:
                d = hub.tick()
                if d.state not in (State.RUNNING, State.STARTING):
                    aborted = d.reason
                    break
                tel, m = hub.telemetry, hub.metrics
                if clock() - t0 >= warmup_s and tel.ok and tel.hashrate_mhs is not None:
                    power = m.power_w if m is not None and m.power_w is not None else tel.power_w
                    samples.append((tel.hashrate_mhs, power or 0.0,
                                    m.core_c if m else None, m.mem_junction_c if m else None))
                sleep(cfg.poll_interval_s)
            hub.stop()
            hub.tick()
            row: dict = {"cap_w": cap, "samples": len(samples), "aborted": aborted}
            if samples:
                h = sum(s[0] for s in samples) / len(samples)
                p = sum(s[1] for s in samples) / len(samples)
                cores = [s[2] for s in samples if s[2] is not None]
                mems = [s[3] for s in samples if s[3] is not None]
                row.update(hashrate_mhs=round(h, 2), gpu_w=round(p, 1),
                           mhs_per_w=round(h / p, 4) if p else None,
                           max_core_c=max(cores) if cores else None,
                           max_mem_junction_c=max(mems) if mems else None)
                if revenue_known(cfg.economics):
                    est = estimate(cfg.economics, h, p)
                    row["net_usd_day"] = round(est.net_usd_day, 3) if est else None
            results.append(row)
            if aborted:
                break
    finally:
        if hub.gov.armed:
            hub.stop()
            hub.tick()
        cfg.profiles.pop(BENCH_PROFILE, None)
        cfg.active_profile = original_profile
        cfg.power.manage_power_limit = original_manage
    if out_dir is not None and results:
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / time.strftime("benchmark-%Y%m%d-%H%M%S.csv")
        keys = sorted({k for r in results for k in r})
        with open(path, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=keys)
            w.writeheader()
            w.writerows(results)
        results[-1]["_csv"] = str(path)
    return results
