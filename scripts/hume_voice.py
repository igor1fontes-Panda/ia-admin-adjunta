#!/usr/bin/env python3
"""
Hume AI expressive voice — REAL integration, REAL data only.

Implements the exact flow the user provided:

    curl -X POST https://api.hume.ai/v0/tts/voices \
         -H "X-Hume-Api-Key: <apiKey>" \
         -d '{ "generation_id": "", "name": "David Hume" }'

That is Hume's Voice Creation API: a voice is created FROM a generation_id.
So the automated flow is:

  1. POST /v0/tts            -> generates audio, returns generations[].generation_id
  2. POST /v0/tts/voices     -> {"generation_id": <from step 1>, "name": "David Hume"}
  3. From then on, synthesize directly with that custom voice name.

The daily voice briefing is stored in Supabase Storage (bucket `briefings`)
and linked into activity_log so the dashboard can play it.
"""
import base64
import os
from datetime import datetime, timezone

import requests


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
_load_env_file(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local"))

HUME_KEY = os.environ.get("HUME_API_KEY") or ""
HUME_BASE = os.environ.get("HUME_BASE_URL") or "https://api.hume.ai"
VOICE_NAME = os.environ.get("HUME_VOICE_NAME") or "David Hume"

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or ""
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
STORAGE_BUCKET = os.environ.get("BRIEFING_BUCKET") or "briefings"


def log(*args):
    print(f"[{datetime.now(timezone.utc).isoformat()}]", *args)


def _headers() -> dict:
    return {"X-Hume-Api-Key": HUME_KEY, "Content-Type": "application/json"}


def generate_sample(description: str, text: str) -> str | None:
    """Step 1: generate audio with a voice description; returns generation_id."""
    r = requests.post(
        f"{HUME_BASE}/v0/tts",
        headers=_headers(),
        json={
            "utterances": [{
                "text": text,
                "description": description,
            }],
            "num_generations": 1,
        },
        timeout=90,
    )
    if r.status_code != 200:
        log(f"hume tts HTTP {r.status_code}: {r.text[:200]}")
        return None
    gens = (r.json() or {}).get("generations") or []
    return gens[0].get("generation_id") if gens else None


def create_voice(generation_id: str, name: str) -> dict | None:
    """Step 2: the exact user-provided call — POST /v0/tts/voices."""
    r = requests.post(
        f"{HUME_BASE}/v0/tts/voices",
        headers=_headers(),
        json={"generation_id": generation_id, "name": name},
    )
    if r.status_code not in (200, 201):
        log(f"hume voices HTTP {r.status_code}: {r.text[:200]}")
        return None
    return r.json() or {}


def list_voices() -> list:
    r = requests.get(f"{HUME_BASE}/v0/tts/voices", headers=_headers(), timeout=30)
    if r.status_code != 200:
        return []
    return ((r.json() or {}).get("voices_page") or {}).get("voices") or []


def voice_exists(name: str) -> bool:
    return any(v.get("name") == name for v in list_voices())


def synth_with_custom_voice(text: str, name: str) -> str | None:
    """Synthesize with the created custom voice; returns base64 audio."""
    r = requests.post(
        f"{HUME_BASE}/v0/tts",
        headers=_headers(),
        json={
            "utterances": [{
                "text": text,
                "voice": {"name": name, "provider": "CUSTOM_VOICE"},
            }],
        },
        timeout=120,
    )
    if r.status_code != 200:
        log(f"hume synth HTTP {r.status_code}: {r.text[:200]}")
        return None
    gens = (r.json() or {}).get("generations") or []
    return gens[0].get("audio") if gens else None


def upload_to_storage(b64_audio: str, path: str) -> str | None:
    """Upload base64-decoded audio to Supabase Storage; returns public URL."""
    if not (SUPABASE_URL and SERVICE_KEY):
        log("supabase storage not configured — audio kept locally only")
        return None
    try:
        audio = base64.b64decode(b64_audio)
        r = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}",
            headers={
                "apikey": SERVICE_KEY,
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Content-Type": "audio/wav",
                "x-upsert": "true",
            },
            data=audio,
            timeout=60,
        )
        if r.status_code not in (200, 201):
            log(f"storage upload HTTP {r.status_code}: {r.text[:200]}")
            return None
        return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    except Exception as e:  # noqa: BLE001
        log(f"storage upload failed: {e}")
        return None
