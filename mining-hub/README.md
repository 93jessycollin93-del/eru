# GPU Mining Control Hub

A local control and safety wrapper for mining on **one NVIDIA GPU (built for an
RTX 3090 + i9-12900K + 128 GB Windows PC)** while you keep using the PC for
Chrome and YouTube. The hub does no hashing itself. It supervises a real,
established miner (lolMiner, T-Rex, or any CLI miner) and stops it whenever
temperatures, memory headroom, power draw, games or profit say it should.

* Mining is **off at launch** and only starts when you press **Start**.
* Dashboard at `http://127.0.0.1:8080`, loopback only and token-protected.
* Standard library only. `psutil` and `nvidia-ml-py` are optional extras.
* The CPU is never used for mining. On an i9-12900K, RandomX loses money at
  normal tariffs and makes the desktop stutter.

## Honest economics, first

* **Bitcoin** is ASIC-only. A 3090 does ~1.3 GH/s on SHA-256d at ~300 W
  (~230,000 J/TH), against ~17 J/TH for an Antminer S21. That's roughly
  13,000× worse, so revenue rounds to zero.
* **Ethereum** has not been mineable since The Merge (15 Sep 2022, block
  15,537,393). "ETH GPU mining" is either a scam or a marketplace that mines
  something else and pays you in ETH.
* What a 3090 *can* mine: Etchash (ETC), Autolykos2 (ERG), KawPow (RVN, runs
  hot), or rented hashpower (NiceHash, paid in BTC). At ≥ $0.10/kWh this is
  often near break-even. GPU compute rental (Vast.ai, RunPod, Clore.ai) can
  earn more per watt and is worth comparing.
* The hub never assumes profit. It computes **net/day from measured hashrate
  and measured power** using your tariff (including time-of-use windows). If
  you set `economics.pause_if_unprofitable`, it pauses below your threshold
  and resumes when the tariff drops.
* If the PC would be on anyway, only the GPU's *extra* draw over idle counts
  as a mining cost (`pc_on_anyway: true`).

## Quick start (mock mode, nothing is mined)

```powershell
cd eru\mining-hub
python -m mining_hub run --open
```

With no `config.json`, the hub runs a simulated 3090 so you can try every
button. The simulated card heats up realistically, and the Overnight profile
trips the 90 °C memory-junction guard.

## Real setup on Windows

1. Install Python 3.10+ ("Add Python to PATH") and an NVIDIA driver ≥ 525.
2. Optional but recommended: `pip install psutil nvidia-ml-py`
   (psutil is needed for "pause while a game runs").
3. Download **lolMiner** from its official GitHub releases. Check the
   SHA-256 against the release notes, then put it at e.g. `C:\MiningHub\bin\lolMiner.exe`.
4. `copy config.example.json config.json`, then edit:
   * `miner.wallet`: your **public** receiving address (never a seed phrase or private key)
   * `miner.pool_url`, `miner.algorithm`, `miner.binary_path`
   * `economics.tariff_usd_per_kwh` and `economics.revenue_usd_per_mh_day`
     (from WhatToMine for your coin, before fees)
   * `pause_for_processes`: your game executables, e.g. `["eldenring.exe"]`
5. `python -m mining_hub check` shows the exact miner command line (wallet
   masked), every network connection, and the limits in force.
6. Power caps. Choose one:
   * set the cap in MSI Afterburner and leave `power.manage_power_limit: false`, or
   * run the terminal **as Administrator** with `manage_power_limit: true`, and the
     hub applies each profile's cap and restores the original on stop.
   Either way, if the card draws more than the profile allows for 5 s,
   mining pauses (PAUSED_POWER).
7. `python -m mining_hub benchmark --caps 200,230,260,290` measures *your*
   card's MH/s per watt under the watchdog and saves a CSV in `state/`. This
   needs the Administrator / `manage_power_limit` setup.
8. `python -m mining_hub run --open`, then press **Start**.

Make a desktop shortcut to `emergency_stop.py` for a one-click kill that works
even if the hub is frozen.

## Safety model

| State | Trigger | What happens |
|---|---|---|
| `STOPPED` | Launch, Stop, or after an emergency reset | Miner not running. Never starts by itself. |
| `PAUSED_THERMAL` | Core ≥ 75 °C or GDDR6X junction ≥ 90 °C | Miner stopped. Resumes after cooling 5 °C below the limit plus a 60 s cooldown. 3 trips in an hour latch until you press Start. |
| `PAUSED_SENSOR` | Sensors not responding, or no junction reading after 45 s | Fail-safe stop. A missing junction reading latches (see below). |
| `PAUSED_POWER` | Draw above the profile cap + 15 W for 5 s | Latched. Fix the power cap, then press Start. |
| `PAUSED_RESOURCE` | Free VRAM < 3 GB or free RAM < 40 GB | Miner stopped so Chrome and Windows stay smooth. |
| `PAUSED_USER_ACTIVITY` | A `pause_for_processes` program is running | Resumes 20 s after it closes. |
| `PAUSED_PROFILE` | Gaming profile (0 W) | Mining off until you pick another profile. |
| `PAUSED_UNPROFITABLE` | Projected net below your threshold (opt-in) | Resumes when the tariff makes it worthwhile again. |
| `CRASHED` | Miner exited more than 3×/hour, or failed to start | Latched. Read the miner output, then press Start. |
| `EMERGENCY_STOP` | Red button, `emergency_stop.py`, or 3 watchdog failures | Process tree force-killed and latched, even across hub restarts, until you reset. A reset never auto-resumes. |

Design points the original specs missed:

* **The GDDR6X junction temperature is not available through NVML/nvidia-smi
  on GeForce cards.** The hub reads it from the miner's API (lolMiner
  `Mem_Temp`, T-Rex `memory_temperature`). If the miner doesn't report it,
  mining pauses after 45 s unless you set
  `thermal.allow_missing_mem_junction: true` and accept the risk.
* **No VRAM flapping.** The hub measures how much VRAM the miner itself uses
  and only restarts if enough would still be free *after* it starts.
* **Browser attacks.** The dashboard rejects foreign `Host` headers (DNS
  rebinding) and requires a per-session token header on every API call (CSRF).
* **If the hub dies, the miner dies.** On Windows the miner runs in a Job
  Object with kill-on-close. Elsewhere, use `emergency_stop.py`.
* Wallets and pool passwords are masked in all logs and miner output.

## What it runs, connects to, and needs

* **Runs:** only your configured miner binary, as a direct child process
  with an argument list (never through a shell), plus `nvidia-smi` for
  telemetry and power caps, and `taskkill` for stops.
* **Network:** dashboard on 127.0.0.1 only, and the miner's API on 127.0.0.1
  only. The one outbound connection is the miner's own stratum connection to
  your pool. No telemetry, no phone-home, no price APIs (revenue is a number
  you enter).
* **Privileges:** a normal user. Administrator only if you want the hub to set
  power caps.
* **Files:** `state/` holds `history.db` (SQLite metrics and events),
  `logs/hub.jsonl` (rotating), `miner.log`, `miner.pid`, and `emergency.lock`.

## Tests

```bash
python -m unittest discover -s tests -v
```

56 tests cover config validation, every safety rule, emergency latching
(including across restarts and via the standalone script), real-subprocess
start/stop/kill with a fake miner, log redaction, the dashboard's token and
Host checks, economics, and the benchmark. CI runs them on Ubuntu and
Windows.

**Not verified yet:** a real RTX 3090, a real lolMiner/T-Rex binary (the
API parsers follow their documented JSON shapes; confirm on first run that
the dashboard shows "from miner API" under the junction temperature), and
NVML power-cap calls.
