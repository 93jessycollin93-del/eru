"""Command line: python -m mining_hub [run|check|estimate|benchmark] [--config FILE]"""
from __future__ import annotations

import argparse
import signal
import sys
import threading
import webbrowser
from pathlib import Path

from . import __version__
from .config import HUB_ROOT, ConfigError, HubConfig, load_config
from .controller import Hub
from .economics import estimate, revenue_known, tariff_at
from .hardware import MockRig, make_monitor
from .logs import setup_logging
from .miners import CliMiner, make_miner
from .redact import Redactor
from .storage import Store


def _load(path: str | None) -> HubConfig:
    if path is None and (HUB_ROOT / "config.json").exists():
        path = str(HUB_ROOT / "config.json")
    cfg = load_config(path)
    if path is None:
        print("No config.json found: running in MOCK mode with safe defaults "
              "(copy config.example.json to config.json to configure your rig).")
    return cfg


def build_hub(cfg: HubConfig, verbose: bool = False) -> Hub:
    redactor = Redactor([cfg.miner.wallet])
    setup_logging(cfg.state_path / "logs", redactor, verbose)
    rig = MockRig() if cfg.mock_hardware else None
    monitor = make_monitor(cfg, rig)
    miner = make_miner(cfg, redactor, rig=rig)
    store = Store(cfg.state_path / "history.db")
    return Hub(cfg, monitor, miner, store)


def cmd_run(cfg: HubConfig, args) -> int:
    from .dashboard import make_server, serve_in_background

    hub = build_hub(cfg, args.verbose)
    try:
        server = make_server(hub, cfg.host, cfg.port)
    except OSError as e:
        print(f"Cannot listen on {cfg.host}:{cfg.port}: {e}")
        hub.shutdown()
        return 1
    hub.start_background()
    serve_in_background(server)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"Mining Control Hub {__version__} — dashboard: {url}")
    print("Mining is OFF until you press Start. Ctrl+C here stops everything.")
    if args.open:
        webbrowser.open(url)

    done = threading.Event()

    def _handle(signum, frame):  # noqa: ARG001
        done.set()

    signal.signal(signal.SIGINT, _handle)
    signal.signal(signal.SIGTERM, _handle)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, _handle)
    try:
        while not done.wait(0.5):
            pass
    finally:
        print("Shutting down: stopping the miner...")
        server.shutdown()
        hub.shutdown()
    return 0


def cmd_check(cfg: HubConfig, args) -> int:  # noqa: ARG001
    red = Redactor([cfg.miner.wallet])
    c = cfg
    print(f"Config OK. State folder: {c.state_path}")
    print(f"Hardware: {'MOCK (simulated)' if c.mock_hardware else f'NVIDIA GPU #{c.gpu_index} via NVML / nvidia-smi'}")
    print(f"Limits: core {c.thermal.max_gpu_core_c} °C, junction {c.thermal.max_mem_junction_c} °C "
          f"(-{c.thermal.hysteresis_c} °C to resume), keep {c.reservations.min_free_vram_mb} MB VRAM and "
          f"{c.reservations.min_free_ram_mb} MB RAM free")
    print("Profiles: " + ", ".join(f"{k} {v.power_limit_w or 'off'}{' W' if v.power_limit_w else ''}"
                                   for k, v in c.profiles.items()) + f" (active: {c.active_profile})")
    if c.miner.kind == "mock":
        print("Miner: MOCK (no external program is run)")
    else:
        cmd = CliMiner(c.miner, c.state_path, red).command()
        print("Miner command (run as a child process, no shell):\n  " + red(" ".join(cmd)))
        print(f"Miner API polled at http://127.0.0.1:{c.miner.api_port}/ (local only)")
        print(f"Outbound: only the miner's stratum connection to {red(c.miner.pool_url)}")
    print(f"Dashboard: http://{c.host}:{c.port}/ (loopback only, token-protected)")
    print("Power caps: " + ("applied by the hub (needs Administrator)" if c.power.manage_power_limit
                            else "not changed by the hub; set them in MSI Afterburner"))
    print(f"Tariff now: ${tariff_at(c.economics):.3f}/kWh; revenue input "
          f"{'set' if revenue_known(c.economics) else 'NOT set (no profit figures yet)'}")
    return 0


def cmd_estimate(cfg: HubConfig, args) -> int:
    e = cfg.economics
    if args.revenue_per_mh is not None:
        e.revenue_usd_per_mh_day = args.revenue_per_mh
    if not revenue_known(e):
        print("Give --revenue-per-mh (USD per MH/s per day, e.g. from WhatToMine) or set it in config.json.")
        return 2
    est = estimate(e, args.mhs, args.watts, args.tariff)
    assert est is not None
    print(f"{args.mhs} MH/s at {args.watts} W GPU ({est.wall_w:.0f} W extra at the wall), "
          f"${est.tariff_usd_per_kwh:.3f}/kWh")
    print(f"  gross   ${est.gross_usd_day:8.3f}/day")
    print(f"  fees    ${-est.fees_usd_day:8.3f}/day")
    print(f"  power   ${-est.power_usd_day:8.3f}/day ({est.kwh_day:.2f} kWh)")
    print(f"  NET     ${est.net_usd_day:8.3f}/day  (${est.net_usd_day * 30:.2f}/month)")
    if est.breakeven_usd_per_kwh is not None:
        print(f"  break-even tariff ${est.breakeven_usd_per_kwh:.3f}/kWh")
    return 0


def cmd_benchmark(cfg: HubConfig, args) -> int:
    from .benchmark import run_benchmark

    caps = [int(x) for x in args.caps.split(",") if x.strip()]
    hub = build_hub(cfg, args.verbose)
    try:
        rows = run_benchmark(hub, caps, args.seconds, args.warmup, out_dir=cfg.state_path)
    except (RuntimeError, ValueError) as e:
        print(f"Benchmark not run: {e}")
        return 1
    finally:
        hub.shutdown()
    print(f"{'cap W':>6} {'MH/s':>8} {'GPU W':>7} {'MH/s/W':>7} {'core':>5} {'junc':>5}  note")
    for r in rows:
        print(f"{r['cap_w']:>6} {r.get('hashrate_mhs', '—'):>8} {r.get('gpu_w', '—'):>7} "
              f"{r.get('mhs_per_w', '—'):>7} {r.get('max_core_c', '—'):>5} {r.get('max_mem_junction_c', '—'):>5}  "
              f"{r['aborted'] or ''}")
    if rows and rows[-1].get("_csv"):
        print(f"Saved {rows[-1]['_csv']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="mining_hub", description="GPU Mining Control Hub")
    p.add_argument("--config", help="path to config.json (default: config.json next to this folder)")
    p.add_argument("--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd")
    r = sub.add_parser("run", help="start the watchdog and dashboard (default)")
    r.add_argument("--open", action="store_true", help="open the dashboard in your browser")
    sub.add_parser("check", help="validate config and show exactly what will run")
    e = sub.add_parser("estimate", help="profit estimate for a hashrate and power draw")
    e.add_argument("--mhs", type=float, required=True)
    e.add_argument("--watts", type=float, required=True)
    e.add_argument("--tariff", type=float)
    e.add_argument("--revenue-per-mh", type=float)
    b = sub.add_parser("benchmark", help="stepped power-cap benchmark under the watchdog")
    b.add_argument("--caps", default="200,230,260,290")
    b.add_argument("--seconds", type=float, default=60.0)
    b.add_argument("--warmup", type=float, default=30.0)
    args = p.parse_args(argv)
    if args.cmd is None:
        args.cmd, args.open = "run", False
    try:
        cfg = _load(args.config)
    except ConfigError as e:
        print(e)
        return 2
    return {"run": cmd_run, "check": cmd_check, "estimate": cmd_estimate, "benchmark": cmd_benchmark}[args.cmd](cfg, args)


if __name__ == "__main__":
    sys.exit(main())
