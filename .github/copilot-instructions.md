# GitHub Copilot Instructions

Read and follow the repository-wide rules in [AGENTS.md](../AGENTS.md) before planning or changing code.

For the multi-agent engineering orchestration work, use [docs/aieos/README.md](../docs/aieos/README.md) as the system overview and [docs/aieos/PROTOCOLS.md](../docs/aieos/PROTOCOLS.md) as the mandatory task lifecycle and approval contract.

Repository-specific constraints:
- Work on a feature branch; never modify `main` directly.
- Inspect current code and tests before editing. Reuse existing Vite/React/TypeScript, Zod, Vitest, GitHub Actions, and existing provider integrations where appropriate.
- Do not introduce a new auth provider, database, ORM, queue, or paid AI dependency without an approved architecture decision.
- Neon Managed Auth is the intended identity provider in the current stabilization PR; Drizzle must remain limited to business data. Verify the final merged implementation before integrating AIEOS with it.
- Do not modify production databases, migrations, RLS, secrets, deployment configuration, or identity records for AIEOS foundation work.
- Do not enable autonomous write access for external agents. External agents may analyse or propose; code writes require scoped authorization and review.
- Run the repository's validation scripts and report exact evidence. Never claim unexecuted tests passed.
- Do not merge or deploy without explicit human approval.
