"""Secret redaction for logs, miner output and the dashboard.

Your wallet address is public on-chain, but it still links this PC to your
funds, so it never goes into a log file in full. Pool passwords never do.
"""
from __future__ import annotations

import re
import threading

_PATTERNS = [
    re.compile(r"\b0x[a-fA-F0-9]{40}\b"),                      # EVM (ETC, ETH-style)
    re.compile(r"\b(?:bc1|tb1|ltc1)[a-z0-9]{20,90}\b"),        # bech32
    re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{30,100}\b"),           # base58 (BTC legacy, RVN, ERG, ...)
]
_PASSWORD_ARG = re.compile(r"(?i)(?<!\S)(--pass(?:word)?|-p)(\s+|=)(\S+)")
_URL_CREDS = re.compile(r"(://[^:/\s@]+:)([^@\s]+)(@)")


def mask(secret: str) -> str:
    if len(secret) <= 12:
        return "****"
    return f"{secret[:4]}…{secret[-4:]}"


class Redactor:
    def __init__(self, secrets: list[str] | tuple[str, ...] = ()):
        self._lock = threading.Lock()
        self._secrets: set[str] = set()
        for s in secrets:
            self.add(s)

    def add(self, secret: str | None) -> None:
        if secret and len(secret) >= 4:
            with self._lock:
                self._secrets.add(secret)

    def __call__(self, text: str) -> str:
        if not text:
            return text
        with self._lock:
            secrets = sorted(self._secrets, key=len, reverse=True)
        for s in secrets:
            if s in text:
                text = text.replace(s, mask(s))
        text = _PASSWORD_ARG.sub(lambda m: f"{m.group(1)}{m.group(2)}****", text)
        text = _URL_CREDS.sub(lambda m: f"{m.group(1)}****{m.group(3)}", text)
        for pat in _PATTERNS:
            text = pat.sub(lambda m: mask(m.group(0)), text)
        return text
