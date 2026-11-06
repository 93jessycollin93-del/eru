import unittest

from helpers import make_cfg, metrics

from mining_hub.safety import Governor, State


def gov(data=None):
    return Governor(make_cfg(data))


class GovernorTests(unittest.TestCase):
    def test_boots_stopped_and_never_starts_on_its_own(self):
        g = gov()
        for t in range(10):
            d = g.tick(metrics(), alive=False, now=t)
            self.assertEqual(d.state, State.STOPPED)
            self.assertEqual(d.action, "none")

    def test_start_then_stop(self):
        g = gov()
        g.user_start()
        d = g.tick(metrics(), False, 0)
        self.assertEqual((d.state, d.action), (State.RUNNING, "start"))
        self.assertEqual(g.tick(metrics(), True, 1).action, "none")
        g.user_stop()
        d = g.tick(metrics(), True, 2)
        self.assertEqual((d.state, d.action), (State.STOPPED, "stop"))

    def test_core_thermal_trip_hysteresis_and_cooldown(self):
        g = gov({"thermal": {"max_gpu_core_c": 75, "hysteresis_c": 5, "cooldown_s": 60}})
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(metrics(core=76), True, 1)
        self.assertEqual((d.state, d.action), (State.PAUSED_THERMAL, "stop"))
        # 72 C is below the limit but not below limit - hysteresis: stay paused
        self.assertEqual(g.tick(metrics(core=72), False, 2).state, State.PAUSED_THERMAL)
        # cooled to 69 C: still waits out the cooldown
        d = g.tick(metrics(core=69), False, 3)
        self.assertEqual((d.state, d.action), (State.PAUSED_THERMAL, "none"))
        self.assertIn("resuming in", d.reason)
        d = g.tick(metrics(core=69), False, 3 + 60)
        self.assertEqual((d.state, d.action), (State.RUNNING, "start"))

    def test_mem_junction_trip(self):
        g = gov({"thermal": {"max_mem_junction_c": 90}})
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(metrics(mem=91), True, 1)
        self.assertEqual(d.state, State.PAUSED_THERMAL)
        self.assertIn("junction", d.reason)

    def test_repeated_thermal_trips_latch(self):
        g = gov({"thermal": {"max_trips_per_hour": 3, "cooldown_s": 1}})
        g.user_start()
        t = 0
        for i in range(3):
            g.tick(metrics(), False, t)
            d = g.tick(metrics(core=80), True, t + 1)
            t += 10
            g.tick(metrics(core=50), False, t)
        self.assertTrue(g.latched)
        self.assertIn("3 thermal trips", g.reason)
        d = g.tick(metrics(core=40), False, t + 1000)
        self.assertEqual((d.state, d.action), (State.PAUSED_THERMAL, "none"))
        g.user_start()  # user acknowledges and retries
        self.assertEqual(g.tick(metrics(core=40), False, t + 1001).action, "start")

    def test_missing_junction_reading_pauses_after_grace(self):
        g = gov({"thermal": {"sensor_grace_s": 45}})
        g.user_start()
        g.tick(metrics(mem=None), False, 0)
        self.assertEqual(g.tick(metrics(mem=None), True, 30).state, State.RUNNING)
        d = g.tick(metrics(mem=None), True, 46)
        self.assertEqual((d.state, d.action), (State.PAUSED_SENSOR, "stop"))
        self.assertTrue(g.latched)

    def test_missing_junction_allowed_when_user_accepts(self):
        g = gov({"thermal": {"allow_missing_mem_junction": True}})
        g.user_start()
        g.tick(metrics(mem=None), False, 0)
        self.assertEqual(g.tick(metrics(mem=None), True, 500).state, State.RUNNING)

    def test_sensor_failure_is_fail_safe_and_recovers(self):
        g = gov()
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(None, True, 1)
        self.assertEqual((d.state, d.action), (State.PAUSED_SENSOR, "stop"))
        self.assertEqual(g.tick(metrics(), False, 5).action, "none")  # 10 s cooldown
        self.assertEqual(g.tick(metrics(), False, 12).action, "start")

    def test_vram_reservation_refuses_start(self):
        g = gov({"reservations": {"min_free_vram_mb": 3072, "miner_vram_estimate_mb": 5000}})
        g.user_start()
        # 24576 total - 17000 used = 7576 free; minus 5000 for the miner = 2576 < 3072
        d = g.tick(metrics(vram_used=17000), False, 0)
        self.assertEqual((d.state, d.action), (State.PAUSED_RESOURCE, "none"))
        self.assertIn("after the miner starts", d.reason)

    def test_vram_pause_does_not_flap(self):
        """Stopping the miner frees its VRAM; that must not trigger an immediate restart."""
        g = gov({"reservations": {"min_free_vram_mb": 3072, "cooldown_s": 30}})
        g.user_start()
        desktop = 3000.0
        g.tick(metrics(vram_used=desktop), False, 0)
        # miner allocates 4600 MB; learned after 30 s
        g.tick(metrics(vram_used=desktop + 4600), True, 31)
        self.assertTrue(g.miner_vram_learned)
        self.assertAlmostEqual(g.miner_vram_mb, 4600)
        # Chrome grows to 15 GB -> free = 24576 - 15000 - 4600 = 4976 > 3072, still fine
        self.assertEqual(g.tick(metrics(vram_used=15000 + 4600), True, 40).state, State.RUNNING)
        # Chrome grows to 18 GB -> free 1976 < 3072 -> pause
        d = g.tick(metrics(vram_used=18000 + 4600), True, 41)
        self.assertEqual((d.state, d.action), (State.PAUSED_RESOURCE, "stop"))
        # Miner stopped: free is now 6576, but only 1976 would remain after restart. Stay paused.
        for t in range(42, 200, 10):
            self.assertEqual(g.tick(metrics(vram_used=18000), False, t).action, "none")
        # Chrome closes tabs: 10 GB -> 24576-10000-4600 = 9976 >= 3072+512 -> resume after cooldown
        # (last pause condition was seen at t=192, so the 30 s cooldown has long passed)
        self.assertEqual(g.tick(metrics(vram_used=10000), False, 300).action, "start")

    def test_ram_reservation(self):
        g = gov({"reservations": {"min_free_ram_mb": 40960}})
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(metrics(ram_free=30000), True, 1)
        self.assertEqual(d.state, State.PAUSED_RESOURCE)
        self.assertIn("RAM", d.reason)

    def test_game_pauses_and_resumes(self):
        g = gov({"activity_cooldown_s": 20})
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(metrics(processes=["eldenring.exe"]), True, 5)
        self.assertEqual((d.state, d.action), (State.PAUSED_USER_ACTIVITY, "stop"))
        self.assertEqual(g.tick(metrics(), False, 10).action, "none")
        self.assertEqual(g.tick(metrics(), False, 26).action, "start")

    def test_gaming_profile_means_off(self):
        g = gov()
        g.cfg.active_profile = "Gaming"
        g.user_start()
        d = g.tick(metrics(), False, 0)
        self.assertEqual((d.state, d.action), (State.PAUSED_PROFILE, "none"))
        g.cfg.active_profile = "Desktop"
        self.assertEqual(g.tick(metrics(), False, 1).action, "start")

    def test_sustained_over_power_latches(self):
        g = gov({"power": {"tolerance_w": 15, "sustained_samples": 5}})  # Desktop = 200 W
        g.user_start()
        g.tick(metrics(), False, 0)
        for t in range(11, 15):
            self.assertEqual(g.tick(metrics(power=330), True, t).state, State.RUNNING)
        d = g.tick(metrics(power=330), True, 15)
        self.assertEqual((d.state, d.action), (State.PAUSED_POWER, "stop"))
        self.assertTrue(g.latched)
        self.assertIn("MSI Afterburner", d.reason)

    def test_brief_power_spike_tolerated(self):
        g = gov({"power": {"sustained_samples": 5}})
        g.user_start()
        g.tick(metrics(), False, 0)
        for t in range(11, 40):
            p = 330 if t % 3 == 0 else 195
            self.assertEqual(g.tick(metrics(power=p), True, t).state, State.RUNNING)

    def test_crash_restart_backoff_then_latch(self):
        g = gov({"miner": {"max_restarts_per_hour": 2, "restart_backoff_s": 10}})
        g.user_start()
        t = 0
        g.tick(metrics(), False, t)
        for n in (1, 2):
            t += 5
            d = g.tick(metrics(), False, t)  # miner died
            self.assertEqual((d.state, d.action), (State.STARTING, "none"))
            self.assertIn(f"restart {n}/2", d.reason)
            self.assertEqual(g.tick(metrics(), False, t + 5).action, "none")  # still backing off
            t += 10
            self.assertEqual(g.tick(metrics(), False, t).action, "start")
        t += 5
        d = g.tick(metrics(), False, t)
        self.assertEqual(d.state, State.CRASHED)
        self.assertTrue(g.latched)
        self.assertEqual(g.tick(metrics(), False, t + 999).action, "none")

    def test_emergency_latch_blocks_start_until_reset(self):
        g = gov()
        g.user_start()
        g.tick(metrics(), False, 0)
        g.emergency("button")
        d = g.tick(metrics(), True, 1)
        self.assertEqual((d.state, d.action), (State.EMERGENCY_STOP, "kill"))
        ok, _ = g.user_start()
        self.assertFalse(ok)
        self.assertEqual(g.tick(metrics(), False, 2).state, State.EMERGENCY_STOP)
        g.reset_emergency()
        d = g.tick(metrics(), False, 3)
        self.assertEqual((d.state, d.action), (State.STOPPED, "none"))  # reset never auto-resumes

    def test_unprofitable_pause_and_resume_when_tariff_drops(self):
        g = gov({"economics": {"min_net_usd_day": 0.0, "resume_margin_usd_day": 0.02, "cooldown_s": 300}})
        g.user_start()
        g.tick(metrics(), False, 0)
        d = g.tick(metrics(), True, 400, projected_net=-0.30)
        self.assertEqual((d.state, d.action), (State.PAUSED_UNPROFITABLE, "stop"))
        # +0.01 is above 0 but not above the 0.02 resume margin
        self.assertEqual(g.tick(metrics(), False, 500, projected_net=0.01).state, State.PAUSED_UNPROFITABLE)
        g.tick(metrics(), False, 600, projected_net=0.10)  # off-peak tariff kicks in
        self.assertEqual(g.tick(metrics(), False, 600 + 300, projected_net=0.10).action, "start")


if __name__ == "__main__":
    unittest.main()
