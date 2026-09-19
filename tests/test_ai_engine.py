"""Zero-network tests for ai_engine.py logic.

ai_engine.py is imported as a module (safe: importing only reads env and
defines functions — side effects live in main()), with `requests`
replaced by a fake session so supabase_get/recall_learning are exercised
against canned REST replies instead of a live Supabase/Neon project.
"""
import importlib.util
import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def load_engine(env_overrides=None):
    """Import ai_engine fresh with a fake requests module and a controlled env.

    The engine self-loads `.env.local` from the CWD at import time (and the
    sandbox may inject real credentials), so the import happens from a temp
    directory containing a TEST `.env.local` with exactly the values this
    test passes — exercising the dotenv loader too, never a live project.
    """
    import os
    import tempfile

    env_overrides = env_overrides or {}
    for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY",
                "VITE_SUPABASE_URL", "GEMINI_API_KEY", "BLACKBOX_API_KEY"):
        os.environ.pop(key, None)

    tmp = tempfile.TemporaryDirectory()
    original_cwd = os.getcwd()
    os.chdir(tmp.name)
    with open(".env.local", "w", encoding="utf-8") as fh:
        for key, value in env_overrides.items():
            fh.write(f"{key}={value}\n")

    calls = []

    fake_requests = types.ModuleType("requests")

    def fake_get(url, headers=None, params=None, timeout=None):
        calls.append({"method": "GET", "url": url, "headers": headers or {}, "params": params or {}})
        if "agent_memory" in url:
            return FakeResponse([
                {"agent": "lead_qualifier", "key": "channel_bias", "value": {"linkedin": 3}},
            ])
        if "leads" in url:
            return FakeResponse([
                {"id": "l1", "status": "won", "ai_action": "proposal", "created_at": "2026-09-01T00:00:00Z"},
                {"id": "l2", "status": "new", "ai_action": None, "created_at": "2026-09-02T00:00:00Z"},
            ])
        if "clients" in url:
            return FakeResponse([
                {"id": "c1", "status": "active", "mrr": 2916},
                {"id": "c2", "status": "churned", "mrr": 1250},
            ])
        if "orders" in url:
            return FakeResponse([
                {"id": "o1", "status": "paid", "amount": 5000, "created_at": "2026-09-10T00:00:00Z"},
            ])
        return FakeResponse([])

    def fake_post(url, headers=None, data=None, json=None, timeout=None):
        calls.append({"method": "POST", "url": url, "headers": headers or {}, "data": data})
        return FakeResponse(None, status=201)

    fake_requests.get = fake_get
    fake_requests.post = fake_post
    fake_requests.Session = lambda: None
    sys.modules["requests"] = fake_requests
    # Force the HAS_GENAI=False path: a parent module without __path__ makes
    # `from google import genai` raise ImportError, so ask_gemini exercises
    # the REST fallback below — deterministically and with zero network.
    sys.modules["google"] = types.ModuleType("google")
    sys.modules.pop("google.genai", None)

    try:
        spec = importlib.util.spec_from_file_location("ai_engine", ROOT / "ai_engine.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        os.chdir(original_cwd)
        tmp.cleanup()
    module._calls = calls
    return module


class ComputeStatsTest(unittest.TestCase):
    def test_stats_from_real_rows(self):
        eng = load_engine()
        leads = [
            {"status": "won", "ai_action": "x"},
            {"status": "qualified", "ai_action": "y"},
            {"status": "new", "ai_action": None},
        ]
        clients = [{"status": "active", "mrr": 2916}, {"status": "churned", "mrr": 999}]
        orders = [{"status": "paid", "amount": 1234, "created_at": "2026-09-10T00:00:00Z"}]
        stats = eng.compute_stats(leads, clients, orders)
        self.assertEqual(stats["total_leads"], 3)
        self.assertEqual(stats["qualified_leads"], 2)
        self.assertEqual(stats["pending_ai_leads"], 1)
        self.assertEqual(stats["active_clients"], 1)
        self.assertEqual(stats["mrr"], 2916.0)
        self.assertEqual(stats["win_rate_pct"], 33)

    def test_empty_database_gives_honest_zeros(self):
        eng = load_engine()
        stats = eng.compute_stats([], [], [])
        self.assertEqual(stats["total_leads"], 0)
        self.assertEqual(stats["mrr"], 0)
        self.assertEqual(stats["revenue_30d"], 0)
        self.assertEqual(stats["win_rate_pct"], 0)


class SupabaseAccessTest(unittest.TestCase):
    def test_recall_learning_maps_rows_by_agent(self):
        eng = load_engine({
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test",
        })
        memory = eng.recall_learning()
        self.assertEqual(memory, {"lead_qualifier": {"channel_bias": {"linkedin": 3}}})
        # auth headers use the service key, never a literal
        self.assertEqual(eng._calls[0]["headers"]["apikey"], "sb_secret_test")

    def test_supabase_get_without_credentials_returns_empty_not_error(self):
        eng = load_engine()
        self.assertEqual(eng.supabase_get("leads"), [])

    def test_rest_failure_is_caught_by_recall_learning(self):
        eng = load_engine({
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test",
        })
        def boom(*a, **k):
            raise RuntimeError("HTTP 401")
        eng.supabase_get = boom
        self.assertEqual(eng.recall_learning(), {})


class ProviderFallbackTest(unittest.TestCase):
    def test_ask_gemini_without_key_is_none(self):
        eng = load_engine()
        self.assertIsNone(eng.ask_gemini("prompt"))

    def test_ask_blackbox_without_key_is_none(self):
        eng = load_engine()
        self.assertIsNone(eng.ask_blackbox("prompt"))

    def test_rest_fallback_uses_model_chain(self):
        eng = load_engine({"GEMINI_API_KEY": "test-key"})
        seen = []
        class FakeResp:
            status_code = 200
            def json(self_inner):
                return {"steps": [{"type": "model_output", "content": [{"type": "text", "text": "insight!"}]}]}
        def spy_post(url, headers=None, data=None, json=None, timeout=None):
            if "generativelanguage" in url:
                seen.append(json["model"])
                return FakeResp()
            return FakeResponse(None, status=201)
        eng.requests.post = spy_post
        out = eng.ask_gemini("prompt")
        self.assertEqual(out, "insight!")
        self.assertTrue(seen and seen[0].startswith("gemini-"))


if __name__ == "__main__":
    unittest.main()
