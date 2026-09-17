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
| **Growth & Marketing agent** (daily campaign plan from real funnel data) | ✅ Autonomous | `scripts/growth-marketing.mjs` + `.github/workflows/ai-bots.yml` |
| **AI Teacher agent** (Academy — trains the other agents from real market data) | ✅ Autonomous | `scripts/teacher-agent.mjs` + `.github/workflows/ai-bots.yml` |
| **AI Manager** (commands the AI team: daily missions + automatic pack-sales registration) | ✅ Autonomous | `scripts/ops-manager.mjs` + `.github/workflows/ai-bots.yml` |
| **Skills Scout** (fetches the skills each agent needs from the skills.sh ecosystem) | ✅ Autonomous | `scripts/skills-scout.mjs` + `.github/workflows/ai-bots.yml` |
| **Delivery QA** (every sold pack verified as functional for the client) | ✅ Autonomous | `scripts/error-handler.mjs` + `supabase/migrations/0005_delivery_qa.sql` |
| **Operations module** (missions, QA table, ecosystem skills) | ✅ Working | Dashboard → "Operações" |
| **AI Academy submenu** (curriculum, market briefs, graduation per agent) | ✅ Working | Dashboard → AI Agents → "Academia IA" |
| **Interface PT/EN** (persistent language switch, PT default) | ✅ Working | `src/lib/i18n.ts` + `Header` language pills |
| **Blackbox AI fallback** (OpenAI-compatible, optional 2nd provider) | ✅ Wired | `scripts/bot-lib.mjs`, `ai_engine.py` |
| **Voice briefings** (Hume AI TTS, optional) | ✅ Wired | `scripts/hume_voice.py` + `ai_engine.py` |
| CI (typecheck, tests, build) | ✅ On push | `.github/workflows/ci.yml` |
| **Supabase db push** (migrations apply automatically on merge to main) | ✅ Ready | `.github/workflows/supabase-migrations.yml` |
| Site health monitoring | ✅ Every 6h | `.github/workflows/deploy-status.yml` |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

**Real data by default.** The app requires a connected Supabase project. Without
keys, every screen shows a step-by-step setup checklist.

### Local container and health checks

Run the complete static app locally with Docker and deterministic fixtures:

```bash
docker compose up --build
```

The static health document is available at `/health.json` and returns the service status without contacting external services. Python dependencies are pinned in `requirements.txt` and mirrored in `requirements.lock`; CI runs both JavaScript and Python dependency audits. Run `npm run audit:python` locally to install the pinned audit tool and execute the same Python audit as CI.

### Running without Supabase

For local UI work and tests, enable the deterministic fixture dataset:

```bash
VITE_MOCK_DATA=true npm run dev
```

Mock mode is intentionally opt-in and never enabled in production. It provides
one valid lead, client, order, and activity item without contacting Supabase.

## Going live with real data

1. **Run the migrations**: Supabase SQL Editor → paste `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_agent_memory.sql` (tables + row-level security + public lead-capture policy + agent learning memory).
   - For voice briefings (optional): create a **public** storage bucket named `briefings` (Supabase → Storage → New bucket).

   **Or use the Supabase CLI** (installed as a devDependency; no local Docker needed for link/push):
   ```bash
   npx supabase link --project-ref aebdqztoolszdzfbdlbp   # needs SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens)
   npx supabase migration new my-change                   # creates supabase/migrations/<timestamp>_my-change.sql
   npx supabase db push                                   # applies all pending migrations to the linked project
   ```
   `supabase/config.toml` is committed; CLI local state is git-ignored. This SPA uses the plain `@supabase/supabase-js` client in `src/lib/data.ts` (no server-side session middleware needed).
2. Set environment variables (never commit them):
   - Dashboard (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — new projects show `sb_publishable_…` keys; legacy projects show a JWT anon key. Both work. (Also set `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` for server-side consumers such as `@supabase/server`.)
   - Bots (GitHub repo secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — new projects show `sb_secret_…` (set it as `SUPABASE_SECRET_KEY`; both names are accepted); legacy show the service_role JWT. Either works. Add these in **GitHub → Settings → Secrets and variables → Actions** (the Freebuff credential cannot manage repo secrets).
   - Automatic migrations (repo secret): `SUPABASE_ACCESS_TOKEN` — the **Supabase Migrations** workflow then runs `supabase db push` on every merge to `main` that changes `supabase/migrations/`. Without the secret it skips cleanly.
3. **Optional but recommended — AI layer:** create a free API key at [Google AI Studio](https://aistudio.google.com) → add GitHub secret `GEMINI_API_KEY`. The bots use the official **Gemini Interactions API** with an automatic free-tier model fallback chain (`gemini-3.6-flash` → `gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-2.0-flash`). Optionally add `BLACKBOX_API_KEY` (Blackbox enterprise API, OpenAI-compatible, `nvidia/nemotron-3-ultra-550b-a55b`) as a second automatic provider. Without any key, bots still run using deterministic rule-scoring on real data — they never fabricate anything.
4. Push to `main`. GitHub Actions takes over:
   - **CI** runs on every push (typecheck → tests → build).
   - **Lead Qualifier** runs daily at 06:00 UTC: reads real inbound leads (from the public form) → Gemini scores them 0-100 and assigns the next best action → results are written back to Supabase → dashboard updates in real time.
   - **Error Handler** runs hourly: scans real incidents, triages with Gemini when configured, logs the verdict.
   - **Insight Engine** runs daily: reads real metrics and posts a data-grounded growth insight to the activity feed.
   - **Growth & Marketing agent** runs daily: reads the real funnel (leads/orders/clients), detects the bottleneck stage (traffic → qualification → nurture → closing → collection → scale), recalls its previous play + funnel delta from `agent_memory`, and produces ONE concrete campaign play (audience, channel mix, success metric, kill criteria). It never sends anything — the plan is recorded for human execution.
   - **AI Teacher agent** runs daily: studies the real market data, diagnoses each agent's knowledge gaps, and writes a `market_brief` lesson into every agent's memory — fully autonomously, no administrative approval needed. The students apply the latest brief on their very next run.
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
   their real fixes. The Growth & Marketing agent compares the funnel snapshot
   against its previous run and keeps the plays that moved real numbers. The
   Insight Engine reads both and adapts its daily advice.
4. **Visible learning** — the dashboard **AI Agents** tab shows each agent's
   live memory ("Learned: channel bias", "Learned: known fixes") exactly as
   the bots wrote it. Nothing simulated, ever.

## The AI Academy (agents that teach themselves to sell)

Inside the **AI Agents** module, the **"Academia IA"** submenu is the teaching
space: the **AI Teacher** agent (`scripts/teacher-agent.mjs`) runs daily and,
without any administrative approval:

1. **Observes the real market** — real funnel rows (leads by channel/niche,
   won/lost, clients, MRR, revenue) plus everything every student already
   learned in `agent_memory`.
2. **Diagnoses knowledge gaps** — which curriculum skills each student has no
   real memory for, and which lessons are stale (> 14 days).
3. **Teaches** — writes one `market_brief` lesson per student (market state,
   focus skills, instruction, what to avoid) into `agent_memory`. AI-generated
   when `GEMINI_API_KEY`/`BLACKBOX_API_KEY` exist; deterministic curriculum
   briefs from real data otherwise.
4. **Students apply the lesson** — the Lead Qualifier and Growth & Marketing
   agents load their latest `market_brief` at the start of every run and adapt
   their scoring/strategy to today's market, on their own.

Progress is honest and visible: each student shows its curriculum skills
(✓ learned from real memory rows), its graduation stage (Enrolled → In
training → Trained) and the freshness of its current market brief. The
Insight Engine also reads the briefs, closing the learning loop.

No new secrets are required — the Teacher reuses the existing Supabase and
AI provider keys.

## The AI Manager (autonomous operations)

The **"Operações"** module shows the boss of the AI team. The **AI Manager**
(`scripts/ops-manager.mjs`) runs daily at 05:30 UTC — before the agents'
shift — and, with no administrative approval:

1. **Assigns a daily mission to every agent** through `agent_memory`
   (`mission` key): the Lead Qualifier hunts leads for the best-selling
   packs, Growth & Marketing attacks the current funnel bottleneck, the
   Insight Engine audits the operation, and the Error Handler verifies
   deliveries. Each agent picks up its mission at the start of its next run.
2. **Registers sold packs automatically**: every PAID order becomes a
   `delivery_status` row awaiting QA. Clients found in sales but missing
   from the roster are auto-registered (plan inferred from the paid amount).

**Delivery QA** (hourly, inside the Error Handler): every pending pack gets
a REAL verdict — the order is actually paid, the client is registered, the
amount matches the pack tier, and the production app is operational
(`SITE_URL` repo variable enables the health check). Passed/failed with the
individual checks is stored per delivery and shown in the module.

## The Skills Scout (skills.sh integration)

The **Skills Scout** (`scripts/skills-scout.mjs`) connects the team to the
open **skills.sh** agent-skills ecosystem (the same one behind `npx skills
add`). Daily, for each agent:

1. Reads the agent's mission + market brief and derives what it needs to
   learn next (queries per funnel stage: closing, traffic, QA…).
2. Searches `https://skills.sh/api/search` and records the real skills
   found (source repo, install counts).
3. Fetches the top skill's actual instructions via `npx skills use <source>
   --skill <id>` (read-only, no repo changes).
4. Writes a `skill_entry` into the agent's memory so the next run uses the
   new commands and prompts — autonomously.

Nothing is sent anywhere; the Scout only appends knowledge to memory.

## Pricing (live in the app)

| Plan | Price | Users |
|---|---|---|
| Starter | 12.500 Kz/month | 10 |
| Professional | 29.160 Kz/month | 50 |
| Enterprise | 83.330 Kz/month | Unlimited |

Payments: Multicaixa Express & PayPay (reference generated per order), 30-day money-back guarantee.

## Supabase CLI in headless environments

The Supabase CLI may fail with `spawn xdg-open ENOENT` when the environment has no desktop opener. This is not an application error: run `supabase login`, copy the authorization URL printed in the terminal, and open it in a browser on your own machine. Do not install `xdg-open`, put tokens in source code, or expose server-only keys in `VITE_*` variables. After authorization, verify access with `supabase projects list`; migrations still require an explicit, authenticated apply step in the intended Supabase project.

## Migration alignment & pending migrations (0003 / 0004)

The Supabase GitHub integration's "Supabase Preview" check fails with
"Remote migration versions not found in local migrations directory" when the
remote migration history contains versions that don't exist in
`supabase/migrations/` — and Vercel gates production deploys on that check.

The one-shot fix tool (a vendored CLI lives at `.tools/supabase`, gitignored):

```bash
# 1. export the dashboard access token (supabase.com/dashboard/account/tokens)
export SUPABASE_ACCESS_TOKEN=sbp_...

# 2. inspect — writes local-vs-remote migration state to supabase-migration-state.txt
sh scripts/fix-supabase-migrations.sh inspect

# 3. fix — marks remote-only history entries reverted (objects untouched; our
#    migrations are idempotent), pushes all local migrations (applies 0003 +
#    0004), then verifies. Never pass local versions (0001..0004).
sh scripts/fix-supabase-migrations.sh fix <remote-only-version> [...]
```

Requires a working service key / access token: if the dashboard shows a
truncated `sb_secret_...` key that the API rejects with 401, regenerate it in
Supabase → Project Settings → API and use the full value.

## Commands

```bash
npm run dev               # dev server
npm run build             # production build → dist/
npm test                  # unit tests (engine)
npm run typecheck         # tsc --noEmit
npm run bot:leads         # qualify real leads locally (needs Supabase secrets)
npm run bot:error-handler # triage incidents locally
npm run bot:growth        # daily growth & marketing plan (needs Supabase secrets)
npm run bot:teacher       # AI Teacher class — writes market briefs per agent (needs Supabase secrets)
npm run bot:manager       # AI Manager — assigns daily missions + registers sold packs for QA (needs Supabase secrets)
npm run bot:skills        # Skills Scout — searches skills.sh and delivers new techniques per agent (needs Supabase secrets)
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

## Interface language (PT / EN)

The UI ships in **Portuguese by default** (Angola/Portugal audience) with a full
English translation. Switch with the `PT | EN` pills in the header — the choice
persists in `localStorage` and updates `<html lang>`. All screens are covered:
landing, auth, dashboard modules, forms, and footers. The dictionary lives in
`src/lib/i18n.ts` (PT is the source of truth; EN mirrors every key).

## Repo layout

- `docs/reports/` — business reports and reference PDFs (documentation, not app code).
- `supabase/` — migrations + CLI config.
- `scripts/` — autonomous agents (`lead-hunter`, `error-handler`, `growth-marketing`, `teacher-agent`, `ops-manager`, `skills-scout`) + shared `bot-lib.mjs`.

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
