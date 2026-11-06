#!/usr/bin/env python3
"""Standalone emergency stop. Works even if the hub or its dashboard is frozen.

    python emergency_stop.py            kill the supervised miner and latch the hub
    python emergency_stop.py --by-name  also kill every process with the miner's image name

It uses only the Python standard library and does not import the hub. It:
  1. writes state/emergency.lock (the hub sees it within a second and latches
     EMERGENCY_STOP, and will not mine again until you reset it on the dashboard);
  2. reads state/miner.pid, checks that the PID still belongs to the miner
     binary (so a recycled PID never kills an unrelated program), and kills
     that process tree.
Make a desktop shortcut to this file for one-click emergency shutdown.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
WIN = sys.platform == "win32"


def state_dir_from_config(config: Path) -> Path:
    try:
        sd = json.loads(config.read_text(encoding="utf-8")).get("state_dir", "state")
    except (OSError, ValueError, AttributeError):
        sd = "state"
    p = Path(sd)
    return p if p.is_absolute() else config.parent / p


def image_of(pid: int) -> str | None:
    try:
        if WIN:
            out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                                 capture_output=True, text=True, timeout=5).stdout.strip()
            if not out or out.startswith("INFO"):
                return None
            return out.split(",")[0].strip('"')
        comm = Path(f"/proc/{pid}/comm")
        if comm.exists():
            return comm.read_text().strip()
        out = subprocess.run(["ps", "-p", str(pid), "-o", "comm="], capture_output=True, text=True, timeout=5)
        return out.stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def same_image(expected: str, actual: str) -> bool:
    e, a = expected.lower(), Path(actual).name.lower()
    # Linux truncates comm to 15 characters.
    return e == a or e.startswith(a[:15]) or a.startswith(e[:15])


def kill_tree(pid: int) -> bool:
    if WIN:
        r = subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, text=True, timeout=10)
        return r.returncode == 0
    try:
        os.killpg(pid, signal.SIGKILL)
        return True
    except (ProcessLookupError, PermissionError):
        try:
            os.kill(pid, signal.SIGKILL)
            return True
        except (ProcessLookupError, PermissionError):
            return False


def kill_by_name(image: str) -> None:
    if WIN:
        subprocess.run(["taskkill", "/F", "/T", "/IM", image], capture_output=True, timeout=10)
    else:
        subprocess.run(["pkill", "-KILL", "-x", image[:15]], capture_output=True, timeout=10)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Emergency stop for the GPU Mining Control Hub")
    ap.add_argument("--config", default=str(HERE / "config.json"))
    ap.add_argument("--state-dir")
    ap.add_argument("--by-name", action="store_true", help="also kill all processes named like the miner")
    args = ap.parse_args(argv)

    state = Path(args.state_dir) if args.state_dir else state_dir_from_config(Path(args.config))
    state.mkdir(parents=True, exist_ok=True)
    (state / "emergency.lock").write_text(f"{time.strftime('%Y-%m-%d %H:%M:%S')} emergency_stop.py\n",
                                          encoding="utf-8")
    print(f"Lock written: {state / 'emergency.lock'} (hub will latch EMERGENCY_STOP)")

    pid_file = state / "miner.pid"
    image = None
    if pid_file.exists():
        try:
            info = json.loads(pid_file.read_text(encoding="utf-8"))
            pid, image = int(info["pid"]), str(info["image"])
        except (OSError, ValueError, KeyError):
            print("miner.pid is unreadable; skipping PID kill")
            pid = None
        if pid is not None:
            actual = image_of(pid)
            if actual is None:
                print(f"Miner PID {pid} is not running")
            elif not same_image(image, actual):
                print(f"PID {pid} now belongs to '{actual}', not '{image}'; not touching it")
            else:
                print(f"Killing miner {image} (PID {pid}): {'done' if kill_tree(pid) else 'FAILED'}")
    else:
        print("No miner.pid: no supervised miner is running")

    if args.by_name and image:
        kill_by_name(image)
        print(f"Killed any remaining '{image}' processes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
