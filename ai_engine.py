#!/usr/bin/env python3
"""
Autonomous Business Insight Engine — REAL DATA ONLY.

Daily AI analyst for Fontes AI Admin Adjunta:
  1. Reads REAL business data from Supabase (leads, clients, orders).
  2. Asks Gemini (official Google GenAI SDK, Interactions API) for one
     concrete, data-grounded growth insight.
  3. Stores the insight in activity_log so it appears on the dashboard.

Uses the exact official pattern:

    from google import genai
    client = genai.Client()
    interaction = client.interactions.create(
        model="gemini-3.6-flash",
        input="Explain how AI works in a few words"
    )
    print(interaction.output_text)

If GEMINI_API_KEY or Supabase secrets are missing, it reports and exits —
it never fabricates data.
"""
import os
import sys
import json
from datetime import datetime, timedelta, timezone

def _load_env_file(path: str = ".env.local") -> None:
    """Minimal stdlib dotenv loader (does not override existing vars)."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass

_load_env_file()

HUME_KEY = os.environ.get("HUME_API_KEY") or ""

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
GEMINI_KEY = os.environ.get("GEMINI_API_KEY") or ""
BLACKBOX_KEY = os.environ.get("BLACKBOX_API_KEY") or ""
BLACKBOX_URL = os.environ.get("BLACKBOX_BASE_URL") or "https://enterprise.blackbox.ai/chat/completions"
BLACKBOX_MODEL = os.environ.get("BLACKBOX_MODEL") or "nvidia/nemotron-3-ultra-550b-a55b"

MODEL_CHAIN = list(dict.fromkeys([
    os.environ.get("GEMINI_MODEL") or "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]))

def log(*args):
    print(f"[{datetime.now(timezone.utc).isoformat()}]", *args)

def supabase_get(table: str, params: dict | None = None) -> list:
    """Read real rows via Supabase REST (service role)."""
    if not (SUPABASE_URL and SERVICE_KEY):
        return []
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    r = requests.get(url, headers=headers, params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json() or []


def recall_learning() -> dict:
    """Read what the agents have learned so far (agent_memory, real rows).
    Returns {} when empty or when the table does not exist yet — the engine
    simply works memory-less and says so."""
    try:
        rows = supabase_get("agent_memory", {"select": "agent,key,value"})
    except Exception as e:  # noqa: BLE001 — missing migration is not fatal
        log(f"agent_memory unavailable (continuing memory-less): {e}")
        return {}
    out: dict = {}
    for r in rows or []:
        out.setdefault(r.get("agent"), {})[r.get("key")] = r.get("value")
    return out

def supabase_insert(table: str, row: dict) -> None:
    if not (SUPABASE_URL and SERVICE_KEY):
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    r = requests.post(url, headers=headers, data=json.dumps(row), timeout=30)
    r.raise_for_status()

def ask_gemini(prompt: str) -> str | None:
    """Interactions API with model fallback chain. None if all fail."""
    if not GEMINI_KEY:
        return None
    if HAS_GENAI:
        client = genai.Client()
        for model in MODEL_CHAIN:
            try:
                interaction = client.interactions.create(
                    model=model,
                    input=prompt,
                )
                text = getattr(interaction, "output_text", None)
                if text:
                    log(f"ai: model={model} chars={len(text)}")
                    return text
            except Exception as e:  # noqa: BLE001 — try next model in chain
                log(f"ai: model={model} failed: {e}")
        return None
    # REST fallback (identical semantics, same model chain)
    for model in MODEL_CHAIN:
        try:
            r = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={
                    "x-goog-api-key": GEMINI_KEY,
                    "Content-Type": "application/json",
                },
                json={"model": model, "input": prompt},
                timeout=60,
            )
            if r.status_code != 200:
                log(f"ai(rest): model={model} HTTP {r.status_code}")
                continue
            data = r.json()
            for step in data.get("steps", []):
                if step.get("type") == "model_output":
                    parts = step.get("content", [])
                    texts = [p.get("text", "") for p in parts if p.get("type") == "text"]
                    text = "".join(texts).strip()
                    if text:
                        log(f"ai(rest): model={model} chars={len(text)}")
                        return text
            log(f"ai(rest): model={model} empty output")
        except Exception as e:  # noqa: BLE001
            log(f"ai(rest): model={model} failed: {e}")
    return None

def ask_blackbox(prompt: str) -> str | None:
    """Blackbox AI (OpenAI-compatible) — fallback when Gemini is unavailable."""
    if not BLACKBOX_KEY:
        return None
    try:
        r = requests.post(
            BLACKBOX_URL,
            headers={
                "Authorization": f"Bearer {BLACKBOX_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": BLACKBOX_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout=60,
        )
        if r.status_code != 200:
            log(f"ai(blackbox): HTTP {r.status_code}")
            return None
        text = (r.json().get("choices") or [{}])[0].get("message", {}).get("content")
        if text:
            log(f"ai(blackbox): model={BLACKBOX_MODEL} chars={len(text)}")
            return text
        log("ai(blackbox): empty output")
        return None
    except Exception as e:  # noqa: BLE001
        log(f"ai(blackbox) failed: {e}")
        return None

def compute_stats(leads: list, clients: list, orders: list) -> dict:
    active = [c for c in clients if c.get("status") in ("active", "trialing")]
    mrr = sum(float(c.get("mrr") or 0) for c in active)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    revenue30d = sum(
        float(o.get("amount") or 0)
        for o in orders
        if o.get("status") == "paid" and (o.get("created_at") or "") >= cutoff
    )
    won = [l for l in leads if l.get("status") == "won"]
    return {
        "total_leads": len(leads),
        "qualified_leads": len([l for l in leads if l.get("status") in ("qualified", "won")]),
        "pending_ai_leads": len([l for l in leads if not l.get("ai_action")]),
        "active_clients": len(active),
        "mrr": round(mrr, 2),
        "revenue_30d": round(revenue30d, 2),
        "win_rate_pct": round(100 * len(won) / len(leads)) if leads else 0,
    }

def generate_voice_briefing(insight_text: str) -> str | None:
    """Turn the daily insight into an expressive audio briefing (Hume AI).
    Creates the persistent custom voice on first run (Voice Creation API via
    generation_id, per the user-provided curl), then synthesizes with it."""
    if not HUME_KEY:
        log("hume: HUME_API_KEY not set — voice briefing skipped (no simulation)")
        return None
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
        from hume_voice import (
            VOICE_NAME,
            create_voice,
            generate_sample,
            synth_with_custom_voice,
            upload_to_storage,
            voice_exists,
        )

        if not voice_exists(VOICE_NAME):
            log(f"hume: creating persistent voice '{VOICE_NAME}' (Voice Creation API)")
            gen_id = generate_sample(
                description=(
                    "Confident, warm male voice. Calm authority of an executive "
                    "briefing, with a spark of punk energy. Clear diction, medium "
                    "pace, positive and motivating tone."
                ),
                text=(
                    "Welcome to Fontes AI Admin Adjunta. I am your autonomous "
                    "business analyst. Every morning I read your real numbers "
                    "and deliver one clear insight, with one clear action. "
                    "Let us grow."
                ),
            )
            if not gen_id:
                log("hume: could not generate sample — voice briefing skipped")
                return None
            created = create_voice(gen_id, VOICE_NAME)
            if created is None:
                log("hume: voice creation failed — briefing skipped")
                return None

        audio_b64 = synth_with_custom_voice(insight_text, VOICE_NAME)
        if not audio_b64:
            log("hume: synthesis failed — briefing skipped")
            return None

        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        url = upload_to_storage(audio_b64, f"briefing-{stamp}.wav")
        if url:
            log(f"hume: briefing uploaded: {url}")
        return url
    except Exception as e:  # noqa: BLE001
        import traceback
        log(f"hume voice briefing failed: {e}")
        traceback.print_exc()
        return None

def main() -> int:
    log("🧠 insight engine starting", {"supabase": bool(SUPABASE_URL and SERVICE_KEY), "gemini": bool(GEMINI_KEY)})

    if not (SUPABASE_URL and SERVICE_KEY):
        log("⚠️  Supabase secrets not configured — cannot read real data. Nothing simulated.")
        return 0

    try:
        leads = supabase_get("leads", {"select": "*", "order": "created_at.desc", "limit": 200})
        clients = supabase_get("clients", {"select": "*", "limit": 200})
        orders = supabase_get("orders", {"select": "*", "order": "created_at.desc", "limit": 200})
    except Exception as e:  # noqa: BLE001
        log(f"❌ could not read real data: {e}")
        return 0

    stats = compute_stats(leads, clients, orders)
    log("real stats:", json.dumps(stats, ensure_ascii=False))

    learning = recall_learning()
    log("agent learning:", json.dumps(learning, ensure_ascii=False) if learning else "none yet (cold start)")

    if stats["total_leads"] == 0 and stats["active_clients"] == 0:
        log("Database has no real business data yet — insight will note that factually.")

    prompt = (
        "You are the autonomous business analyst of Fontes AI Admin Adjunta "
        "(AI admin automation for SMBs in Angola/Portugal, plans 12,500–83,330 AOA/month). "
        "These are the REAL current business metrics from the production database:\n"
        f"{json.dumps(stats, ensure_ascii=False, indent=2)}\n\n"
        + (
            "What the autonomous agents have LEARNED so far from real outcomes "
            f"(channel conversion, incident fixes):\n{json.dumps(learning, ensure_ascii=False, indent=2)}\n\n"
            if learning
            else "The agents have not learned anything yet (no decided deals or incidents) — say so factually.\n\n"
        )
        + "Write ONE concrete, data-grounded growth insight (max 120 words). "
        "Reference the actual numbers and any agent learning. End with a single "
        "clear recommended action. If the dataset is empty, state that factually "
        "and recommend the first growth step (e.g., drive traffic to the public "
        "lead form)."
    )

    insight = ask_gemini(prompt) or ask_blackbox(prompt)
    if not insight:
        # Rule-based insight derived from real numbers (no AI needed, no fabrication)
        insight = (
            f"Real metrics: {stats['total_leads']} leads, {stats['qualified_leads']} qualified, "
            f"{stats['active_clients']} active clients, MRR {stats['mrr']:.0f} AOA, "
            f"revenue(30d) {stats['revenue_30d']:.0f} AOA, win rate {stats['win_rate_pct']}%. "
            + (
                f"Pending AI qualification: {stats['pending_ai_leads']} lead(s) — the next bot run will score them."
                if stats["pending_ai_leads"]
                else "Recommended action: focus outreach on leads above score 70."
            )
        )
        log("AI unavailable — produced rule-based insight from real stats")
    else:
        insight = insight.strip()

    voice_url = generate_voice_briefing(insight)

    message = f"Insight engine: {insight}"
    if voice_url:
        message += f" ||| AUDIO_BRIEFING_URL={voice_url}"
    supabase_insert(
        "activity_log",
        {"kind": "bot", "message": message},
    )
    log("✅ insight stored to activity_log" + (" (com briefing de voz)" if voice_url else ""))
    print("\n=== INSIGHT ===\n" + insight)
    if voice_url:
        print(f"=== VOICE BRIEFING === {voice_url}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
