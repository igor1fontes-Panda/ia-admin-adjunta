# Contributing to Fontes AI Admin Adjunta

Thank you for your interest in contributing! This guide covers the development workflow.

## Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 10
- **Python** ≥ 3.10 (for AI bots)
- A Supabase project (for live data; the app runs in mock mode without one)

## Getting Started

```bash
# Clone and install
git clone https://github.com/igor1fontes-Panda/ia-admin-adjunta.git
cd ia-admin-adjunta
npm ci

# Start dev server (with mock data)
npm run dev
```

The app works without any API keys in mock mode. For live data, copy `.env.example` to `.env.local` and fill in your Supabase keys.

## Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Production build → `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run coverage` | Tests with coverage report |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run bot:leads` | Run lead qualifier locally |
| `npm run bot:error-handler` | Run error handler locally |
| `npm run bot:insight` | Run insight engine locally |

## Development Workflow

1. **Create a feature branch** from `main`
2. **Make your changes** with tests
3. **Run checks locally** before pushing:
   ```bash
   npm run typecheck && npm test && npm run lint && npm run build
   ```
4. **Push and open a PR** — CI runs automatically
5. **Merge** once CI is green and the PR is reviewed

## Testing

- Unit tests live alongside source files as `*.test.ts`
- Tests use **Vitest** with jsdom environment
- All tests must pass before merge: `npm test`
- Coverage thresholds are enforced (see `vitest.config.ts`)

## Code Style

- **TypeScript** strict mode — no `any` types
- **React** functional components with hooks
- **Tailwind CSS** for styling — no inline styles
- **Framer Motion** for animations
- No fabrication: the app displays **real data only**. Mock data is gated behind `VITE_MOCK_DATA=true` for development only.

## AI Bots

The autonomous bots (lead qualifier, error handler, insight engine) run via GitHub Actions. To test locally:

```bash
# Set your Supabase secrets in .env.local first
npm run bot:leads
npm run bot:insight   # requires: pip install -r requirements.txt
```

Bots without AI keys fall back to deterministic rule-based scoring — they never fabricate data.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS
- **Database**: Supabase (PostgreSQL + realtime subscriptions)
- **AI**: Google Gemini (primary) + Blackbox AI (fallback)
- **Hosting**: Vercel (production) with auto-deploy on push to `main`
- **CI**: GitHub Actions — typecheck → lint → tests → build → deploy

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS (for UI issues)

## License

GPL-3.0 — see [LICENSE](LICENSE).

---

**Support:** 📧 support@ia-admin-adjunta.com · 💬 WhatsApp +244 923 012 293
