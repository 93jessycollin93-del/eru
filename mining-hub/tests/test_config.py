import json
import tempfile
import unittest
from pathlib import Path

from helpers import make_cfg

from mining_hub.config import ConfigError, load_config


class ConfigTests(unittest.TestCase):
    def test_defaults_are_valid_and_mock(self):
        cfg = make_cfg()
        self.assertTrue(cfg.mock_hardware)
        self.assertEqual(cfg.miner.kind, "mock")
        self.assertEqual(cfg.host, "127.0.0.1")

    def test_example_config_is_valid_once_filled_in(self):
        root = Path(__file__).resolve().parent.parent
        data = json.loads((root / "config.example.json").read_text())
        with self.assertRaises(ConfigError):  # placeholder wallet must be rejected
            make_cfg(data)
        data["miner"]["wallet"] = "0x" + "ab" * 20
        cfg = make_cfg(data)
        self.assertFalse(cfg.mock_hardware)
        self.assertEqual(cfg.miner.kind, "lolminer")

    def test_unknown_key_rejected_but_comments_allowed(self):
        make_cfg({"_comment": "fine", "thermal": {"_note": "fine"}})
        with self.assertRaisesRegex(ConfigError, "unknown setting 'max_gpu_cor_c'"):
            make_cfg({"thermal": {"max_gpu_cor_c": 70}})

    def test_unsafe_temperatures_rejected(self):
        with self.assertRaisesRegex(ConfigError, "max_gpu_core_c"):
            make_cfg({"thermal": {"max_gpu_core_c": 90}})
        with self.assertRaisesRegex(ConfigError, "max_mem_junction_c"):
            make_cfg({"thermal": {"max_mem_junction_c": 108}})

    def test_reservations_and_power(self):
        with self.assertRaisesRegex(ConfigError, "min_free_vram_mb"):
            make_cfg({"reservations": {"min_free_vram_mb": 1024}})
        with self.assertRaisesRegex(ConfigError, "max_gpu_power_w"):
            make_cfg({"power": {"max_gpu_power_w": 400}})
        with self.assertRaisesRegex(ConfigError, "profile 'Overnight'"):
            make_cfg({"power": {"max_gpu_power_w": 250}})

    def test_non_loopback_host_rejected(self):
        with self.assertRaisesRegex(ConfigError, "loopback"):
            make_cfg({"host": "0.0.0.0", "mock_hardware": False})

    def test_real_miner_needs_real_hardware_and_wallet(self):
        miner = {"kind": "lolminer", "binary_path": "C:/m/lolMiner.exe", "pool_url": "etc.pool:1010",
                 "wallet": "0x" + "ab" * 20}
        with self.assertRaisesRegex(ConfigError, "watchdog blind"):
            make_cfg({"miner": miner})
        with self.assertRaisesRegex(ConfigError, "wallet"):
            make_cfg({"mock_hardware": False, "miner": dict(miner, wallet="YOUR_ETC_WALLET")})
        make_cfg({"mock_hardware": False, "miner": miner})

    def test_types_checked(self):
        with self.assertRaisesRegex(ConfigError, "expected true/false"):
            make_cfg({"mock_hardware": "yes"})
        with self.assertRaisesRegex(ConfigError, "expected a whole number"):
            make_cfg({"port": 80.5})

    def test_load_from_file_resolves_state_dir_next_to_config(self):
        d = Path(tempfile.mkdtemp())
        (d / "config.json").write_text(json.dumps({"economics": {"tariff_per_kwh": 0.2}}))
        cfg = load_config(d / "config.json")
        self.assertEqual(cfg.state_path, d / "state")
        self.assertEqual(cfg.economics.tariff_per_kwh, 0.2)
        (d / "bad.json").write_text("{nope")
        with self.assertRaisesRegex(ConfigError, "invalid JSON"):
            load_config(d / "bad.json")


if __name__ == "__main__":
    unittest.main()
