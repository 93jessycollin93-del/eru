import json
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request

from helpers import ROOT, free_port, make_hub

from mining_hub.benchmark import run_benchmark
from mining_hub.dashboard import make_server, serve_in_background
from mining_hub.safety import State


class HubIntegrationTests(unittest.TestCase):
    def test_start_stop_lifecycle(self):
        hub, rig, miner, clock = make_hub()
        self.assertEqual(hub.tick().state, State.STOPPED)
        self.assertFalse(miner.is_running())
        hub.start()
        hub.tick()
        self.assertTrue(miner.is_running())
        clock.advance(3)
        hub.tick()
        st = hub.status()
        self.assertEqual(st["state"], "RUNNING")
        self.assertTrue(st["mock"])
        self.assertEqual(st["metrics"]["mem_junction_source"], "miner API")
        self.assertGreater(st["telemetry"]["hashrate_mhs"], 100)
        hub.stop()
        hub.tick()
        self.assertFalse(miner.is_running())

    def test_emergency_stop_kills_writes_lock_and_survives_restart(self):
        hub, rig, miner, clock = make_hub()
        hub.start()
        hub.tick()
        self.assertTrue(miner.is_running())
        t0 = time.perf_counter()
        hub.emergency_stop("test")
        self.assertLess(time.perf_counter() - t0, 0.1)
        self.assertFalse(miner.is_running())
        self.assertTrue(hub.lock_file.exists())
        ok, _ = hub.start()
        self.assertFalse(ok)
        hub.tick()
        self.assertFalse(miner.is_running())

        # A new hub process on the same state folder boots latched.
        hub2, _, miner2, _ = make_hub({"state_dir": str(hub.state_dir)})
        self.assertEqual(hub2.tick().state, State.EMERGENCY_STOP)
        self.assertFalse(hub2.start()[0])
        hub2.reset_emergency()
        self.assertFalse(hub2.lock_file.exists())
        self.assertEqual(hub2.tick().state, State.STOPPED)
        self.assertFalse(miner2.is_running())

    def test_lock_file_from_standalone_script_latches_running_hub(self):
        hub, rig, miner, clock = make_hub()
        hub.start()
        hub.tick()
        r = subprocess.run([sys.executable, str(ROOT / "emergency_stop.py"), "--state-dir", str(hub.state_dir)],
                           capture_output=True, text=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        d = hub.tick()
        self.assertEqual(d.state, State.EMERGENCY_STOP)
        self.assertFalse(miner.is_running())

    def test_thermal_trip_on_dynamic_mock_rig(self):
        """The demo rig heats up at the Overnight cap until the 90 C junction guard trips."""
        from mining_hub.hardware import MockRig
        rig = MockRig(dynamic=True)
        hub, rig, miner, clock = make_hub({"active_profile": "Overnight"}, rig=rig)
        rig.core_c, rig.mem_c = 40.0, 55.0
        hub.start()
        states = set()
        for _ in range(600):
            clock.advance(1)
            states.add(hub.tick().state)
            if State.PAUSED_THERMAL in states:
                break
        self.assertIn(State.PAUSED_THERMAL, states)
        self.assertFalse(miner.is_running())

    def test_failed_start_is_reported_not_retried(self):
        hub, rig, miner, clock = make_hub()
        miner.fail_start = "binary not found"
        hub.start()
        d = hub.tick()
        self.assertEqual(d.state, State.CRASHED)
        self.assertIn("binary not found", d.reason)
        miner.fail_start = None
        clock.advance(100)
        self.assertEqual(hub.tick().action, "none")

    def test_benchmark_on_mock(self):
        hub, rig, miner, clock = make_hub()
        rows = run_benchmark(hub, [200, 240], seconds=10, warmup_s=4, sleep=clock.sleep, clock=clock)
        self.assertEqual([r["cap_w"] for r in rows], [200, 240])
        self.assertTrue(all(r["samples"] > 0 and not r["aborted"] for r in rows))
        self.assertGreater(rows[1]["hashrate_mhs"], rows[0]["hashrate_mhs"])
        self.assertNotIn("_benchmark", hub.cfg.profiles)
        self.assertEqual(hub.cfg.active_profile, "Desktop")
        self.assertFalse(miner.is_running())


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.hub, self.rig, self.miner, self.clock = make_hub()
        self.srv = make_server(self.hub, "127.0.0.1", 0, token="t0ken")
        serve_in_background(self.srv)
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()

    def req(self, path, method="GET", token="t0ken", host=None, body=None):
        r = urllib.request.Request(self.base + path, method=method,
                                   data=json.dumps(body).encode() if body is not None else None)
        if token:
            r.add_header("X-Hub-Token", token)
        if host:
            r.add_header("Host", host)
        try:
            with self.opener.open(r, timeout=5) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_page_and_status(self):
        code, body = self.req("/", token=None)
        self.assertEqual(code, 200)
        self.assertIn(b't0ken', body)
        code, body = self.req("/api/status")
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(body)["state"], "STOPPED")

    def test_post_requires_token(self):
        self.assertEqual(self.req("/api/start", "POST", token=None, body={})[0], 403)
        self.assertEqual(self.req("/api/start", "POST", token="wrong", body={})[0], 403)
        self.assertFalse(self.hub.gov.armed)
        self.assertEqual(self.req("/api/start", "POST", body={})[0], 200)
        self.assertTrue(self.hub.gov.armed)

    def test_dns_rebinding_host_rejected(self):
        self.assertEqual(self.req("/", token=None, host="evil.example:8080")[0], 403)
        self.assertEqual(self.req("/api/status", host="evil.example")[0], 403)

    def test_cors_preflight_refused(self):
        self.assertEqual(self.req("/api/start", "OPTIONS", token=None)[0], 403)

    def test_emergency_and_profile_endpoints(self):
        self.assertEqual(self.req("/api/profile", "POST", body={"profile": "Gaming"})[0], 200)
        self.assertEqual(self.hub.cfg.active_profile, "Gaming")
        self.assertEqual(self.req("/api/profile", "POST", body={"profile": "Nope"})[0], 409)
        self.assertEqual(self.req("/api/emergency", "POST", body={})[0], 200)
        self.assertEqual(self.hub.gov.state, State.EMERGENCY_STOP)
        self.assertEqual(self.req("/api/start", "POST", body={})[0], 409)
        self.assertEqual(self.req("/api/reset", "POST", body={})[0], 200)


if __name__ == "__main__":
    unittest.main()
