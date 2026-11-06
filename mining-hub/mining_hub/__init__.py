"""GPU Mining Control Hub: a local safety and orchestration wrapper around a
real CLI miner (lolMiner, T-Rex, ...) for a single NVIDIA GPU."""
import logging

__version__ = "1.0.0"

logging.getLogger("mining_hub").addHandler(logging.NullHandler())
