# Fontes AI Admin Adjunta

**A working AI admin dashboard** with autonomous lead-hunting bots, real data persistence (Supabase) and legitimate sales/client/order tracking.

> v1.1 — This repository now contains a **real, running application** (Vite + React + TypeScript), a production database schema, and **autonomous AI bots on GitHub Actions**.

---

## What actually exists here

| Piece | Status | Where |
|---|---|---|
| Landing page + pricing (AOA) | ✅ Working | `src/pages/Landing.tsx` |
| Auth (Supabase live / demo fallback) | ✅ Working | `src/pages/Auth.tsx` |
| Admin dashboard (leads, clients, orders, activity) | ✅ Working | `src/pages/Dashboard.tsx` |
| Business engine (metrics, lead scoring) | ✅ Unit-tested | `src/lib/engine.ts` |
| Production DB schema + RLS | ✅ Ready | `supabase/migrations/0001_init.sql` |
| **Lead Hunter bot** (Gemini, daily) | ✅ Autonomous | `scripts/lead-hunter.mjs` + `.github/workflows/ai-bots.yml` |
| **Error Handler bot** (hourly triage) | ✅ Autonomous | `scripts/error-handler.mjs` + `.github/workflows/ai-bots.yml` |
| CI (typecheck, tests, build) | ✅ On push | `.github/workflows/ci.yml` |
| Site health monitoring | ✅ Every 6h | `.github/workflows/deploy-status.yml` |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (demo mode — works with zero config)
```

The app **always works**: with no env vars it runs on deterministic demo data
(signed-in flag stored locally). Add the keys below to switch to live
production data with real accounts, real leads and real orders.

## Going live with real data

1. **Create a Supabase project** → Project Settings → API → copy the URL + anon key.
2. Run the migration: paste `supabase/migrations/0001_init.sql` into the Supabase SQL Editor and run it (tables + row-level security included).
3. Set environment variables (never commit them):
   - Dashboard (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Bots (GitHub repo secrets): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. **Create a Gemini API key** at [Google AI Studio](https://aistudio.google.com) → add as GitHub repo secret `GEMINI_API_KEY` (and `GEMINI_API_KEY` locally to test bots).
5. Push to `main`. GitHub Actions takes over:
   - **CI** runs on every push (typecheck → tests → build).
   - **Lead Hunter** runs daily at 06:00 UTC: Gemini proposes prospects → scores them → qualified leads land in Supabase → dashboard updates in real time.
   - **Error Handler** runs hourly: scans for incidents, triages (Gemini analysis when configured), logs the verdict.
   - **Health check** pings your production URL every 6 hours (set repo variable `SITE_URL`).

## Pricing (live in the app)

| Plan | Price | Users |
|---|---|---|
| Starter | 12.500 Kz/month | 10 |
| Professional | 29.160 Kz/month | 50 |
| Enterprise | 83.330 Kz/month | Unlimited |

Payments: Multicaixa Express & PayPay (reference generated per order), 30-day money-back guarantee.

## Commands

```bash
npm run dev              # dev server (demo or live mode)
npm run build            # production build → dist/
npm test                 # unit tests (engine)
npm run typecheck        # tsc --noEmit
npm run bot:leads        # run lead hunter locally
npm run bot:error-handler # run error handler locally
```

## Security model

- **RLS everywhere**: authenticated users = full business access; anonymous users can *only* insert leads (public lead capture), never read.
- **Service-role key lives only in GitHub secrets** — bots bypass RLS server-side; it never reaches the browser.
- Anon key in the browser is safe *because* RLS is enforced — do not skip step 2.

## Support

📧 support@ia-admin-adjunta.com · 💬 WhatsApp +244 923 012 293

© 2026 Fontes AI Admin Adjunta Solutions. All rights reserved.
