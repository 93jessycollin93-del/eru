"""SQLite history: a metrics sample every few seconds and every state change."""
from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS metrics (
    ts REAL NOT NULL, state TEXT, profile TEXT,
    core_c REAL, mem_junction_c REAL, power_w REAL,
    vram_free_mb REAL, ram_free_mb REAL,
    hashrate_mhs REAL, accepted INTEGER, rejected INTEGER, net_usd_day REAL
);
CREATE INDEX IF NOT EXISTS metrics_ts ON metrics(ts);
CREATE TABLE IF NOT EXISTS events (
    ts REAL NOT NULL, kind TEXT NOT NULL, state TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
"""


class Store:
    def __init__(self, path: Path | str, retention_days: int = 30):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock:
            if str(path) != ":memory:":
                self._db.execute("PRAGMA journal_mode=WAL")
            self._db.executescript(SCHEMA)
            cutoff = time.time() - retention_days * 86400
            self._db.execute("DELETE FROM metrics WHERE ts < ?", (cutoff,))
            self._db.execute("DELETE FROM events WHERE ts < ?", (cutoff,))
            self._db.commit()

    def metric(self, row: dict) -> None:
        cols = ("ts", "state", "profile", "core_c", "mem_junction_c", "power_w", "vram_free_mb",
                "ram_free_mb", "hashrate_mhs", "accepted", "rejected", "net_usd_day")
        with self._lock:
            self._db.execute(f"INSERT INTO metrics ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                             tuple(row.get(c) for c in cols))
            self._db.commit()

    def event(self, kind: str, state: str, detail: str) -> None:
        with self._lock:
            self._db.execute("INSERT INTO events (ts, kind, state, detail) VALUES (?,?,?,?)",
                             (time.time(), kind, state, detail))
            self._db.commit()

    def recent_events(self, limit: int = 30) -> list[dict]:
        with self._lock:
            rows = self._db.execute("SELECT ts, kind, state, detail FROM events ORDER BY ts DESC LIMIT ?",
                                    (limit,)).fetchall()
        return [{"ts": r[0], "kind": r[1], "state": r[2], "detail": r[3]} for r in rows]

    def recent_metrics(self, seconds: float = 3600) -> list[dict]:
        with self._lock:
            cur = self._db.execute("SELECT * FROM metrics WHERE ts >= ? ORDER BY ts", (time.time() - seconds,))
            names = [d[0] for d in cur.description]
            return [dict(zip(names, r)) for r in cur.fetchall()]

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def __del__(self):
        try:
            self._db.close()
        except Exception:  # noqa: BLE001
            pass
