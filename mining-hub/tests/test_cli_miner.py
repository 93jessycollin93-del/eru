"""Real-subprocess tests using tests/fake_miner.py in place of lolMiner."""
import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

from helpers import FAKE_MINER, ROOT, free_port, make_cfg

from mining_hub.hardware import parse_smi_line
from mining_hub.miners import CliMiner, build_command, parse_lolminer, parse_trex
from mining_hub.redact import Redactor

WALLET = "0x" + "c0ffee12" * 5


def fake_settings(state_dir, *extra):
    cfg = make_cfg({"mock_hardware": False, "state_dir": str(state_dir), "miner": {
        "kind": "custom", "binary_path": sys.executable, "pool_url": "stratum+tcp://pool.test:1010",
        "wallet": WALLET, "api_port": free_port(), "api_kind": "lolminer", "stop_timeout_s": 1.5,
        "args": [str(FAKE_MINER), "--user", "{user}", "--apiport", "{api_port}", *extra]}})
    return cfg.miner


def wait_for(pred, timeout=10.0):
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return True
        time.sleep(0.1)
    return False


class CliMinerTests(unittest.TestCase):
    def setUp(self):
        self.state = Path(tempfile.mkdtemp(prefix="hubcli-"))

    def test_start_telemetry_stop_and_redacted_log(self):
        m = CliMiner(fake_settings(self.state), self.state, Redactor())
        m.start()
        try:
            self.assertTrue(m.is_running())
            self.assertTrue((self.state / "miner.pid").exists())
            self.assertTrue(wait_for(lambda: m.telemetry().ok))
            t = m.telemetry()
            self.assertAlmostEqual(t.hashrate_mhs, 121.5)
            self.assertEqual(t.mem_junction_c, 84)
            self.assertTrue(wait_for(lambda: m.log_tail()))
        finally:
            m.stop()
        self.assertFalse(m.is_running())
        self.assertFalse((self.state / "miner.pid").exists())
        log = (self.state / "miner.log").read_text()
        self.assertIn("fake miner connecting as", log)
        self.assertNotIn(WALLET, log)

    def test_stop_escalates_to_kill_when_miner_ignores_it(self):
        m = CliMiner(fake_settings(self.state, "--ignore-term"), self.state, Redactor())
        m.start()
        self.assertTrue(wait_for(lambda: m.telemetry().ok))
        t0 = time.time()
        m.stop()
        self.assertFalse(m.is_running())
        self.assertLess(time.time() - t0, 8)

    def test_missing_binary_raises(self):
        s = fake_settings(self.state)
        s.binary_path = str(self.state / "nope.exe")
        with self.assertRaises(FileNotFoundError):
            CliMiner(s, self.state, Redactor()).start()

    def test_standalone_emergency_script_kills_miner(self):
        m = CliMiner(fake_settings(self.state, "--ignore-term"), self.state, Redactor())
        m.start()
        self.assertTrue(wait_for(lambda: m.telemetry().ok))
        r = subprocess.run([sys.executable, str(ROOT / "emergency_stop.py"), "--state-dir", str(self.state)],
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("Killing miner", r.stdout)
        self.assertTrue(wait_for(lambda: not m.is_running(), 5))
        self.assertTrue((self.state / "emergency.lock").exists())

    def test_emergency_script_ignores_recycled_pid(self):
        sleeper = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
        try:
            (self.state / "miner.pid").write_text(json.dumps({"pid": sleeper.pid, "image": "lolMiner.exe"}))
            r = subprocess.run([sys.executable, str(ROOT / "emergency_stop.py"), "--state-dir", str(self.state)],
                               capture_output=True, text=True, timeout=30)
            self.assertIn("not touching it", r.stdout)
            self.assertIsNone(sleeper.poll())
        finally:
            sleeper.kill()
            sleeper.wait()


class ParserTests(unittest.TestCase):
    def test_lolminer_zero_junction_means_missing(self):
        doc = {"Algorithms": [{"Total_Performance": 0.25, "Performance_Unit": "Gh/s"}],
               "Workers": [{"Index": 0, "Mem_Temp": 0, "Core_Temp": 60, "Power": 230}]}
        t = parse_lolminer(doc)
        self.assertAlmostEqual(t.hashrate_mhs, 250.0)
        self.assertIsNone(t.mem_junction_c)

    def test_trex(self):
        doc = {"hashrate": 121_000_000, "accepted_count": 5, "rejected_count": 0,
               "gpus": [{"device_id": 0, "power": 240, "temperature": 60, "memory_temperature": 86}]}
        t = parse_trex(doc)
        self.assertAlmostEqual(t.hashrate_mhs, 121.0)
        self.assertEqual(t.mem_junction_c, 86)

    def test_nvidia_smi_line_with_na_junction(self):
        v = parse_smi_line("NVIDIA GeForce RTX 3090, 61, [N/A], 241.52, 280.00, 24576, 9120, 99, 72")
        self.assertEqual(v["core_c"], 61)
        self.assertIsNone(v["mem_junction_c"])
        self.assertEqual(v["power_limit_w"], 280)

    def test_lolminer_command_binds_api_to_localhost(self):
        s = make_cfg({"mock_hardware": False, "miner": {
            "kind": "lolminer", "binary_path": "C:/m/lolMiner.exe", "pool_url": "etc.pool:1010",
            "wallet": WALLET}}).miner
        cmd = build_command(s)
        self.assertEqual(cmd[cmd.index("--apihost") + 1], "127.0.0.1")
        self.assertIn(f"{WALLET}.rig3090", cmd)


if __name__ == "__main__":
    unittest.main()
