"""Tariff currency (e.g. CAD), day-of-week windows, mining hours and rejected shares."""
import datetime as dt
import unittest

from helpers import make_cfg, make_hub, metrics

from mining_hub.config import ConfigError
from mining_hub.economics import accept_ratio, estimate, in_window, mining_allowed, tariff_at
from mining_hub.safety import Governor, State

# 2026-11-06 is a Friday.
FRI = dt.date(2026, 11, 6)


def at(day_offset: int, hh: int, mm: int = 0) -> dt.datetime:
    d = FRI + dt.timedelta(days=day_offset)
    return dt.datetime(d.year, d.month, d.day, hh, mm)


class CurrencyTests(unittest.TestCase):
    def test_cad_tariff_converted_to_usd(self):
        e = make_cfg({"economics": {"revenue_usd_per_mh_day": 0.002, "tariff_per_kwh": 0.18,
                                    "tariff_currency": "CAD", "tariff_to_usd": 0.73,
                                    "pc_on_anyway": False, "system_baseline_w": 80}}).economics
        est = estimate(e, 250, 200)
        wall = (200 + 80) / 0.9
        self.assertAlmostEqual(est.power_usd_day, wall * 24 / 1000 * 0.18 * 0.73)
        self.assertEqual(est.tariff_currency, "CAD")
        # Break-even is reported in CAD/kWh: net revenue (USD) -> CAD
        self.assertAlmostEqual(est.breakeven_per_kwh, (0.5 * 0.98) / (wall * 24 / 1000) / 0.73)
        self.assertLess(est.net_usd_day, 0)

    def test_rejected_shares_reduce_revenue(self):
        self.assertEqual(accept_ratio(None, None), 1.0)
        self.assertEqual(accept_ratio(3, 1), 1.0)  # too few shares to judge
        self.assertAlmostEqual(accept_ratio(90, 10), 0.9)
        e = make_cfg({"economics": {"revenue_usd_per_mh_day": 0.01}}).economics
        self.assertAlmostEqual(estimate(e, 100, 200, ratio=0.9).gross_usd_day, 0.9)

    def test_invalid_currency_rate_rejected(self):
        with self.assertRaisesRegex(ConfigError, "tariff_to_usd"):
            make_cfg({"economics": {"tariff_to_usd": 0}})


class WindowTests(unittest.TestCase):
    def setUp(self):
        self.cfg = make_cfg({"mining_windows": [
            {"start": "23:00", "end": "07:00", "days": ["mon", "tue", "wed", "thu", "fri"]},
            {"start": "00:00", "end": "24:00", "days": ["sat", "sun"]},
        ]})

    def test_overnight_window_belongs_to_its_start_day(self):
        w = self.cfg.mining_windows[0]
        self.assertTrue(in_window(w, at(0, 23, 30)))   # Fri 23:30
        self.assertTrue(in_window(w, at(1, 2, 0)))     # Sat 02:00, window started Fri
        self.assertFalse(in_window(w, at(2, 2, 0)))    # Sun 02:00, Sat has no weekday window
        self.assertFalse(in_window(w, at(0, 12, 0)))   # Fri noon

    def test_mining_allowed(self):
        wins = self.cfg.mining_windows
        self.assertFalse(mining_allowed(wins, at(0, 17, 0)))   # Fri 5 pm
        self.assertTrue(mining_allowed(wins, at(0, 23, 15)))   # Fri 11:15 pm
        self.assertTrue(mining_allowed(wins, at(1, 15, 0)))    # Sat 3 pm
        self.assertTrue(mining_allowed([], at(0, 17, 0)))      # no windows = any time

    def test_time_of_use_by_weekday(self):
        e = make_cfg({"economics": {"tariff_per_kwh": 0.146, "time_of_use": [
            # Overnight off-peak runs Sun-Fri evenings into the next morning (covers Mon 00:00-07:00).
            {"start": "19:00", "end": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri"], "per_kwh": 0.091},
            {"start": "00:00", "end": "24:00", "days": ["sat", "sun"], "per_kwh": 0.091},
            {"start": "07:00", "end": "11:00", "days": ["mon", "tue", "wed", "thu", "fri"], "per_kwh": 0.189},
        ]}}).economics
        self.assertEqual(tariff_at(e, at(0, 8, 0)), 0.189)    # Fri on-peak
        self.assertEqual(tariff_at(e, at(0, 13, 0)), 0.146)   # Fri mid-peak (default)
        self.assertEqual(tariff_at(e, at(1, 8, 0)), 0.091)    # Sat
        self.assertEqual(tariff_at(e, at(3, 3, 0)), 0.091)    # Mon 03:00 (window started Sun 19:00)
        self.assertEqual(tariff_at(e, at(2, 23, 59)), 0.091)  # Sun 23:59, no gap before midnight

    def test_bad_windows_rejected(self):
        with self.assertRaisesRegex(ConfigError, "unknown day"):
            make_cfg({"mining_windows": [{"start": "23:00", "end": "07:00", "days": ["friday"]}]})
        with self.assertRaisesRegex(ConfigError, "different HH:MM"):
            make_cfg({"mining_windows": [{"start": "07:00", "end": "07:00"}]})

    def test_governor_pauses_outside_hours(self):
        g = Governor(make_cfg())
        g.user_start()
        self.assertEqual(g.tick(metrics(), False, 0, allowed_now=False).state, State.PAUSED_SCHEDULE)
        self.assertEqual(g.tick(metrics(), False, 1, allowed_now=True).action, "start")
        d = g.tick(metrics(), True, 2, allowed_now=False)
        self.assertEqual((d.state, d.action), (State.PAUSED_SCHEDULE, "stop"))

    def test_hub_reports_schedule(self):
        hub, *_ = make_hub()
        st = hub.status()
        self.assertTrue(st["mining_hours_now"])
        self.assertEqual(st["tariff_currency"], "USD")


class DockerHostRuleTests(unittest.TestCase):
    def test_all_interfaces_only_for_mock_demo(self):
        make_cfg({"host": "0.0.0.0"})  # mock hardware + mock miner: allowed (container demo)
        with self.assertRaisesRegex(ConfigError, "loopback"):
            make_cfg({"host": "0.0.0.0", "mock_hardware": False})
        with self.assertRaisesRegex(ConfigError, "loopback"):
            make_cfg({"host": "192.168.1.5"})


if __name__ == "__main__":
    unittest.main()
