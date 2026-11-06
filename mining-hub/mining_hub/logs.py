"""Structured JSON-lines logging with redaction and rotation."""
from __future__ import annotations

import json
import logging
import logging.handlers
import time
from pathlib import Path

from .redact import Redactor

LOGGER_NAME = "mining_hub"


class JsonFormatter(logging.Formatter):
    def __init__(self, redactor: Redactor):
        super().__init__()
        self.redactor = redactor

    def format(self, record: logging.LogRecord) -> str:
        doc = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(record.created)),
            "level": record.levelname,
            "msg": self.redactor(record.getMessage()),
        }
        if record.exc_info:
            doc["exc"] = self.redactor(self.formatException(record.exc_info))
        return json.dumps(doc, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    def __init__(self, redactor: Redactor):
        super().__init__("%(asctime)s %(levelname)-7s %(message)s", "%H:%M:%S")
        self.redactor = redactor

    def format(self, record: logging.LogRecord) -> str:
        return self.redactor(super().format(record))


def setup_logging(log_dir: Path, redactor: Redactor, verbose: bool = False) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    for h in list(logger.handlers):
        if not isinstance(h, logging.NullHandler):
            logger.removeHandler(h)
    fh = logging.handlers.RotatingFileHandler(
        log_dir / "hub.jsonl", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(JsonFormatter(redactor))
    ch = logging.StreamHandler()
    ch.setFormatter(ConsoleFormatter(redactor))
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger
