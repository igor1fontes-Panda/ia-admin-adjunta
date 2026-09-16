# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- pip-audit security scanning in CI for Python bot dependencies
- React.lazy code-splitting for route-level chunks (Auth, Landing, Dashboard)
- deploy-status workflow runs automatically after Vercel deploys
- CONTRIBUTING.md and CHANGELOG.md

### Fixed
- CI dependency and Tailwind build compatibility
- Node.js 20 deprecation warnings in preview environment controller

### Changed
- Python dependency audit now runs on every CI pass

## [1.2.0] - 2026-09-16

### Added
- Real Stripe checkout flow (checkout session API + webhook handler)
- Supabase MCP project configuration
- Pull request preview environment controller
- Offline mode coverage linting and security gates
- Anime/neon-cyber theming with Oswald typography
- Agent runtime upgrades (Gemini model chain, Blackbox AI fallback)
- Security hardening (RLS policies, admin access controls)
- Hume AI voice briefing generation for daily insights
- Autonomous AI bots: lead qualifier, error handler, insight engine
- Payment details (USD/EUR bank accounts) for international transfers
- Speed Insights and Analytics integration
- Ecosystem tab showing autonomous loop workings
- Today pulse strip and cold-start onboarding guide
- Signed-in identity in header
- Code-level security scan (CodeQL for Python, JS/TS, Actions)

### Fixed
- Production bundle missing Supabase DB config (single-chunk build)
- Vercel deploy failures (Supabase Preview check alignment)
- Bot secrets resolution (SUPABASE_URL_2, SUPABASE_SECRET_KEY fallbacks)
- Header showing generic CTA while signed in
- Dashboard blank panels on cold start (empty states added)

### Changed
- Upgraded to Vite 8, React 19, TypeScript 5.9, Vitest 5, framer-motion 13
- Dependabot automated dependency updates

## [1.1.0] - 2026-09-14

### Added
- Vercel deployment pipeline (auto-deploy on push to main)
- Deploy-to-Vercel GitHub Actions workflow
- Real Supabase data layer (leads, clients, orders, activity_log, agent_memory)
- Database migration system (0001_init, 0002_agent_memory)
- Supabase realtime subscriptions for live dashboard updates
- Landing page with anime punk theming
- Authentication flow (Supabase Auth)
- Dashboard with KPI cards, charts, and tabbed navigation

### Fixed
- Initial deployment configuration
- Environment variable baking for static build

## [1.0.0] - 2026-09-01

### Added
- Initial project scaffold (Vite + React + TypeScript)
- Convex backend setup
- Tailwind CSS configuration
- shadcn/ui component library
- Basic routing structure
