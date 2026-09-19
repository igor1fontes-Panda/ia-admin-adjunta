import sys
import types
import unittest
from unittest.mock import patch

sys.modules.setdefault("requests", types.SimpleNamespace())
import ai_engine


class AiEngineOfflineTests(unittest.TestCase):
    def test_compute_stats_is_data_grounded(self):
        stats = ai_engine.compute_stats(
            [{"status": "won"}, {"status": "qualified"}],
            [{"status": "active", "mrr": 120}],
            [{"status": "paid", "amount": 50, "created_at": "2099-01-01T00:00:00+00:00"}],
        )
        self.assertEqual(stats["total_leads"], 2)
        self.assertEqual(stats["active_clients"], 1)
        self.assertEqual(stats["mrr"], 120.0)
        self.assertEqual(stats["win_rate_pct"], 50)

    def test_recall_learning_returns_empty_without_network_configuration(self):
        with patch.object(ai_engine, "SUPABASE_URL", ""), patch.object(ai_engine, "SERVICE_KEY", ""):
            self.assertEqual(ai_engine.recall_learning(), {})


if __name__ == "__main__":
    unittest.main()
