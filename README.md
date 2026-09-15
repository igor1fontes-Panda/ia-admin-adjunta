# Fontes AI Admin Adjunta

**A working AI admin dashboard** with autonomous lead-hunting bots, real data persistence (Supabase) and legitimate sales/client/order tracking.

> v1.2 — A **real, running application** (Vite + React + TypeScript), a production database schema, and **autonomous AI bots on GitHub Actions**. Real data only — no demo mode, no simulations.

---

## What actually exists here

| Piece | Status | Where |
|---|---|---|
| Landing page + pricing (AOA) + **public lead-capture form** | ✅ Working | `src/pages/Landing.tsx`, `src/components/LeadForm.tsx` |
| Auth (real Supabase sessions) | ✅ Working | `src/pages/Auth.tsx` |
| Admin dashboard (leads, clients, orders, activity) | ✅ Working | `src/pages/Dashboard.tsx` |
| Business engine (metrics, lead scoring) | ✅ Unit-tested | `src/lib/engine.ts` |
| Production DB schema + RLS | ✅ Ready | `supabase/migrations/0001_init.sql` |
| **Agent learning memory** (`agent_memory` table) | ✅ Ready | `supabase/migrations/0002_agent_memory.sql` |
| **Lead Qualifier bot** (self-learning, daily) | ✅ Autonomous | `scripts/lead-hunter.mjs` + `.github/workflows/ai-bots.yml` |
| **Error Handler bot** (self-learning, hourly) | ✅ Autonomous | `scripts/error-handler.mjs` + `.github/workflows/ai-bots.yml` |
| **Insight Engine** (memory-aware analyst, daily) | ✅ Autonomous | `ai_engine.py` + `.github/workflows/ai-bots.yml` |
| **Blackbox AI fallback** (OpenAI-compatible, optional 2nd provider) | ✅ Wired | `scripts/bot-lib.mjs`, `ai_engine.py` |
| **Voice briefings** (Hume AI TTS, optional) | ✅ Wired | `scripts/hume_voice.py` + `ai_engine.py` |
| CI (typecheck, tests, build) | ✅ On push | `.github/workflows/ci.yml` |
| Site health monitoring | ✅ Every 6h | `.github/workflows/deploy-status.yml` |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

**Real data only.** The app requires a connected Supabase project. Without
keys, every screen shows a step-by-step setup checklist instead of fake data.

## Going live with real data

1. **Run the migrations**: Supabase SQL Editor → paste `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_agent_memory.sql` (tables + row-level security + public lead-capture policy + agent learning memory).
   - For voice briefings (optional): create a **public** storage bucket named `briefings` (Supabase → Storage → New bucket).
2. Set environment variables (never commit them):
   - Dashboard (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — new projects show `sb_publishable_…` keys; legacy projects show a JWT anon key. Both work.
   - Bots (GitHub repo secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — new projects show `sb_secret_…`; legacy show the service_role JWT. Either works. Add these in **GitHub → Settings → Secrets and variables → Actions** (the Freebuff credential cannot manage repo secrets).
3. **Optional but recommended — AI layer:** create a free API key at [Google AI Studio](https://aistudio.google.com) → add GitHub secret `GEMINI_API_KEY`. The bots use the official **Gemini Interactions API** with an automatic free-tier model fallback chain (`gemini-3.6-flash` → `gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-2.0-flash`). Optionally add `BLACKBOX_API_KEY` (Blackbox enterprise API, OpenAI-compatible, `nvidia/nemotron-3-ultra-550b-a55b`) as a second automatic provider. Without any key, bots still run using deterministic rule-scoring on real data — they never fabricate anything.
4. Push to `main`. GitHub Actions takes over:
   - **CI** runs on every push (typecheck → tests → build).
   - **Lead Qualifier** runs daily at 06:00 UTC: reads real inbound leads (from the public form) → Gemini scores them 0-100 and assigns the next best action → results are written back to Supabase → dashboard updates in real time.
   - **Error Handler** runs hourly: scans real incidents, triages with Gemini when configured, logs the verdict.
   - **Insight Engine** runs daily: reads real metrics and posts a data-grounded growth insight to the activity feed.
   - **Health check** pings your production URL every 6 hours (set repo variable `SITE_URL`).

## How the agents learn (cold start → real growth)

The system is designed for a brand-new business with zero data:

1. **Cold start** — empty database. The dashboard shows honest empty states
   ("income appears the moment real sales are recorded"); agents use neutral
   priors and state factually that they have nothing to learn from yet.
2. **First real signals** — the public lead form and your first orders create
   real rows. Realtime pushes them into the dashboard and charts immediately.
3. **Learning loop** — after leads get decided (won/lost), the Lead Qualifier
   measures **real per-channel conversion** and persists a channel bias to the
   `agent_memory` table. The Error Handler accumulates incident signatures and
   their real fixes. The Insight Engine reads both and adapts its daily advice.
4. **Visible learning** — the dashboard **AI Agents** tab shows each agent's
   live memory ("Learned: channel bias", "Learned: known fixes") exactly as
   the bots wrote it. Nothing simulated, ever.

## Pricing (live in the app)

| Plan | Price | Users |
|---|---|---|
| Starter | 12.500 Kz/month | 10 |
| Professional | 29.160 Kz/month | 50 |
| Enterprise | 83.330 Kz/month | Unlimited |

Payments: Multicaixa Express & PayPay (reference generated per order), 30-day money-back guarantee.

## Commands

```bash
npm run dev               # dev server
npm run build             # production build → dist/
npm test                  # unit tests (engine)
npm run typecheck         # tsc --noEmit
npm run bot:leads         # qualify real leads locally (needs Supabase secrets)
npm run bot:error-handler # triage incidents locally
npm run bot:insight       # daily AI insight (needs python3 -m pip install -r requirements.txt)
```

The AI layer uses the official Google GenAI SDKs. Python (`ai_engine.py`):

```python
from google import genai
client = genai.Client()
interaction = client.interactions.create(
    model="gemini-3.6-flash",
    input="Explain how AI works in a few words"
)
print(interaction.output_text)
```

JavaScript (`scripts/bot-lib.mjs`) uses the same Interactions API via `@google/genai`:
`await ai.interactions.create({ model, input })` → `interaction.output_text`.

## Security model

- **RLS everywhere**: authenticated users = full business access; anonymous users can *only* insert leads (public lead capture), never read.
- **Service-role key lives only in GitHub secrets / server env** — bots bypass RLS server-side; it never reaches the browser.
- Anon key in the browser is safe *because* RLS is enforced — do not skip step 1.

## Hosting

**Production (live):** Vercel — **https://project-orgt3.vercel.app**

- Connected via Vercel's native GitHub integration: every push to `main` builds and deploys automatically (no CI secrets needed for this path).
- Production URL is public; branch/preview deployments are SSO-protected by default (Vercel behavior — sign in with the Vercel account to view them).
- Real-visitor performance analytics are collected with Vercel **Speed Insights** (`<SpeedInsights />` in `App.tsx`).
- SPA routing + asset caching configured in `vercel.json`.

**Secondary:** Freebuff-managed hosting (Deploy button) — builds with `npm ci --include=dev` + `node node_modules/vite/bin/vite.js build` into `dist/`.

**Optional (CI-driven):** `.github/workflows/deploy.yml` can also deploy to Vercel from GitHub Actions; activate it by adding the repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. It skips cleanly until those exist.

The app is a static SPA: the public Supabase config (URL + publishable key, safe under RLS) is baked into `src/lib/data.ts`, so it works identically on any static host with zero env configuration.

## Support

📧 support@ia-admin-adjunta.com · 💬 WhatsApp +244 923 012 293

© 2026 Fontes AI Admin Adjunta Solutions. All rights reserved.
