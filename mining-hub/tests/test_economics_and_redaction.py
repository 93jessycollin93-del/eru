import datetime as dt
import unittest

from helpers import make_cfg

from mining_hub.economics import estimate, gross_usd_day, tariff_at, wall_watts
from mining_hub.redact import Redactor


class EconomicsTests(unittest.TestCase):
    def econ(self, **kw):
        return make_cfg({"economics": kw}).economics

    def test_unknown_revenue_gives_no_estimate(self):
        self.assertIsNone(estimate(self.econ(), 120, 240))

    def test_profitable(self):
        e = self.econ(revenue_usd_per_mh_day=0.01, tariff_per_kwh=0.05, pool_fee=0.01, dev_fee=0.01)
        est = estimate(e, 120, 240)
        self.assertAlmostEqual(est.gross_usd_day, 1.20)
        self.assertAlmostEqual(est.fees_usd_day, 0.024)
        wall = (240 - 30) / 0.9  # PC is on anyway: only the extra draw counts
        self.assertAlmostEqual(est.wall_w, wall)
        self.assertAlmostEqual(est.power_usd_day, wall * 24 / 1000 * 0.05)
        self.assertGreater(est.net_usd_day, 0)
        self.assertAlmostEqual(est.breakeven_per_kwh, 1.176 / (wall * 24 / 1000), places=6)

    def test_unprofitable_when_pc_runs_only_for_mining(self):
        e = self.econ(revenue_usd_per_mh_day=0.005, tariff_per_kwh=0.15, pc_on_anyway=False)
        est = estimate(e, 120, 240)
        self.assertAlmostEqual(wall_watts(e, 240), (240 + 70) / 0.9)
        self.assertLess(est.net_usd_day, 0)

    def test_zero_hashrate_costs_nothing(self):
        est = estimate(self.econ(revenue_usd_per_mh_day=0.01), 0, 30)
        self.assertEqual(est.gross_usd_day, 0)
        self.assertEqual(est.power_usd_day, 0)
        self.assertIsNone(est.breakeven_per_kwh)

    def test_network_formula(self):
        e = self.econ(coin_price_usd=20.0, block_reward=2.0, block_time_s=13.0, network_hashrate_mhs=1.3e8)
        expected = (120 / 1.3e8) * (86400 / 13.0) * 2.0 * 20.0
        self.assertAlmostEqual(gross_usd_day(e, 120), expected)

    def test_time_of_use_wraps_midnight(self):
        e = self.econ(tariff_per_kwh=0.20,
                      time_of_use=[{"start": "22:00", "end": "07:00", "per_kwh": 0.08}])
        self.assertEqual(tariff_at(e, dt.datetime(2026, 1, 1, 23, 30)), 0.08)
        self.assertEqual(tariff_at(e, dt.datetime(2026, 1, 1, 6, 59)), 0.08)
        self.assertEqual(tariff_at(e, dt.datetime(2026, 1, 1, 7, 0)), 0.20)
        self.assertEqual(tariff_at(e, dt.datetime(2026, 1, 1, 12, 0)), 0.20)


class RedactionTests(unittest.TestCase):
    def test_wallets_and_passwords_masked(self):
        r = Redactor()
        evm = "0x" + "1234abcd" * 5
        rvn = "RKz8Lb3cQWkZcWk8m7j9mWnP1nLx1sRAbc"
        out = r(f"--user {evm}.rig --pass hunter2 -p secret2 rvn {rvn} stratum+tcp://me:pw123@pool:1")
        for secret in (evm, rvn, "hunter2", "secret2", "pw123"):
            self.assertNotIn(secret, out)
        self.assertIn("0x12", out)

    def test_registered_secret_masked(self):
        r = Redactor(["9hY8shortish-wallet-xyz"])
        self.assertNotIn("9hY8shortish-wallet-xyz", r("wallet 9hY8shortish-wallet-xyz ok"))

    def test_normal_text_untouched(self):
        r = Redactor()
        s = "nvidia-smi -pl 240 set power limit; GPU core 61 C"
        self.assertEqual(r(s), s)


if __name__ == "__main__":
    unittest.main()
