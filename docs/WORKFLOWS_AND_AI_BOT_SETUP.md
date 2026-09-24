# Workflows & AI Bot Setup — Fontes AI Admin Adjunta

This repository ships **four GitHub Actions workflows** (`.github/workflows/`).
Everything runs on real data only — no simulations, no demo mode.

---

## 1. CI — `ci.yml`

**Triggers:** every push to `main`, pull requests, manual dispatch.

Pipeline: Python bots syntax check (`py_compile`) → TypeScript typecheck → unit
tests (Vitest) → production build (Vite).

No secrets required. Build works with or without Supabase env vars because the
public config is baked into `src/lib/data.ts`.

## 2. Autonomous AI Bots — `ai-bots.yml`

**Triggers:**

- `0 6 * * *` daily 06:00 UTC → Lead Qualifier + Insight Engine
- `0 * * * *` hourly → Error Handler
- Manual dispatch (choose `lead-hunter`, `error-handler`, `insight`, or `all`)

| Bot                | Script                      | What it does                                                                                                                                                                                                                                 |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lead Qualifier** | `scripts/lead-hunter.mjs`   | Reads real unscored leads, measures real won/lost conversion per channel, persists a channel bias to `agent_memory`, scores each lead 0-100 (AI when configured, adaptive rules otherwise) and writes the next best action back to Supabase. |
| **Error Handler**  | `scripts/error-handler.mjs` | Scans real incident messages from the last 24h, triages them (AI when configured), and accumulates incident signatures → known fixes in `agent_memory`.                                                                                      |
| **Insight Engine** | `ai_engine.py`              | Reads real leads/clients/orders + agent memory, posts one data-grounded growth insight to `activity_log`. Optionally generates a Hume AI voice briefing stored in the `briefings` bucket.                                                    |

Without AI keys the bots still run — they use deterministic rule-scoring on
real data and never fabricate anything.

## 3. Site Health — `deploy-status.yml`

**Triggers:** every 6 hours (`30 */6 * * *`), manual dispatch.

Pings the production URL (repo **variable** `SITE_URL`, not a secret) and fails
loudly on HTTP ≥ 500. Skips cleanly when `SITE_URL` is not set.

## 4. Deploy to Vercel — `deploy.yml` (optional)

**Triggers:** push to `main`, manual dispatch. **Skips cleanly** until the repo
secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` exist.

The primary production path is Vercel's native GitHub integration (push →
Vercel builds automatically); this workflow is for CI-owned deploys. It uses
`vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.

---

## Required secrets

Add in **GitHub → Settings → Secrets and variables → Actions**
(the Freebuff credential cannot manage repo secrets):

### Bots (required for autonomous runs)

| Secret                      | Where to get it                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase → Project Settings → API (the `https://…supabase.co` URL)                                                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — `sb_secret_…` (new projects) or the `service_role` JWT (legacy). **Server-side only — never in the browser.** |

Without these, bot jobs exit 0 with a clear "not configured" message — they
never fabricate data.

### AI layer (optional but recommended)

| Secret             | Where to get it                                                    |
| ------------------ | ------------------------------------------------------------------ |
| `GEMINI_API_KEY`   | Free key: https://aistudio.google.com → Get API key                |
| `BLACKBOX_API_KEY` | Optional 2nd provider (OpenAI-compatible): https://app.blackbox.ai |
| `HUME_API_KEY`     | Optional voice briefings: https://app.hume.ai/keys                 |

Gemini model fallback chain (newest first): `gemini-3.6-flash` →
`gemini-3.8-flash` → `gemini-2.5-flash` → `gemini-2.0-flash`. Override with
the `GEMINI_MODEL` env var.

### Optional deploy/monitoring

| Name                                                   | Type              | Purpose                        |
| ------------------------------------------------------ | ----------------- | ------------------------------ |
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | secrets           | Enable `deploy.yml`            |
| `SITE_URL`                                             | **repo variable** | Enable the 6-hour health check |

### Dashboard env (Vite — repo variables are enough, values are public-by-design)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — the anon/publishable key is
safe in the browser because row-level security is enforced by the schema in
`supabase/migrations/0001_init.sql`. Run both migrations (0001, then
0002_agent_memory) in the Supabase SQL Editor first.

---

## One-time database setup

1. Supabase SQL Editor → run `supabase/migrations/0001_init.sql`
2. Supabase SQL Editor → run `supabase/migrations/0002_agent_memory.sql`
3. For voice briefings (optional): create a **public** storage bucket named
   `briefings` (Supabase → Storage → New bucket)

Both migration files are idempotent — safe to run multiple times.

---

## Verifying a bot run locally

```bash
npm run bot:leads          # qualify real leads (needs Supabase env)
npm run bot:error-handler  # triage real incidents
npm run bot:insight        # daily insight (python3 -m pip install -r requirements.txt first)
```

Environment is read from `.env.local` when present (see `env.example`).
Never commit `.env.local`.

After the first scheduled run, the dashboard **AI Agents** tab shows recorded
runs and each agent's live memory ("Learned: channel bias", "Learned: known
fixes") exactly as the bots wrote it to `agent_memory`.

---

## How the agents learn

1. **Cold start** — empty `agent_memory`; agents state factually that they
   have nothing to learn from and use neutral priors.
2. **Real outcomes** — leads decided (won/lost) give per-channel conversion;
   incidents with triage verdicts give known fixes.
3. **Persisted learning** — every run upserts `agent_memory`; the next run
   scores/triages/analyzes using everything learned so far.
4. **Visible learning** — the AI Agents tab renders the memory rows verbatim.
   Nothing simulated, ever.

---

**Support:** 📧 support@ia-admin-adjunta.com · 💬 WhatsApp +244 923 012 293
