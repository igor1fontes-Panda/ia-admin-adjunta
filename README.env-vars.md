# Environment variables

Copy `.env.example`-style values into `.env.local` (never commit real values).
Every variable the repo reads is listed below.

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL baked into the SPA |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` | browser | publishable key (RLS-protected) |
| `VITE_MOCK_DATA` | browser | `true` enables the deterministic fixture dataset (dev only) |
| `VITE_CLERK_PUBLISHABLE_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | browser | optional Clerk auth (additive; Better Auth stays default) |
| `SUPABASE_URL_2` / `SUPABASE_URL` | server | bots' Supabase REST endpoint |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | server | bots' service key (both naming models accepted) |
| `SUPABASE_PUBLISHABLE_KEY_2` / `SUPABASE_PUBLISHABLE_KEY` | server | server-side publishable key for `@supabase/server` |
| `SUPABASE_JWKS_URL` | server | JWKS endpoint for Supabase JWT validation |
| `DATABASE_URL` / `NEON_DATABASE_URL` | server | **Neon pooled connection string — primary store** (`scripts/bot-lib.mjs`, health checks) |
| `BETTER_AUTH_SECRET` / `AUTH_SECRET` | server | Better Auth session signing secret |
| `SITE_URL` | server | public app URL (auth base URL, health check target) |
| `CLERK_SECRET_KEY` | server | optional Clerk JWT verification in `api/*` |
| `CLERK_ISSUER` | server | optional Clerk token issuer override |
| `GEMINI_API_KEY` | server/bots | Google Gemini (bots skip gracefully when absent) |
| `GEMINI_MODEL` | server/bots | override the head of the model fallback chain |
| `BLACKBOX_API_KEY` | server/bots | second AI provider (OpenAI-compatible) |
| `BLACKBOX_BASE_URL` | server/bots | Blackbox endpoint override |
| `BLACKBOX_MODEL` | server/bots | Blackbox model override |
| `HUME_API_KEY` | server/bots | voice briefings (skipped when absent) |
| `STRIPE_SECRET_KEY` | server | Stripe API (inert without key) |
| `STRIPE_WEBHOOK_SECRET` | server | Stripe webhook signature verification |
| `AUTH_SMOKE_PASSWORD` | scripts | password used by `scripts/auth-smoke.mjs` (random per run when unset) |
| `AUTH_SMOKE_URL` | scripts | base URL override for the auth smoke (default `http://localhost:3000`) |

Server-only values must never appear in `VITE_*`/browser-exposed names; CI
greps the client bundle for server secret names and fails the build if found.
