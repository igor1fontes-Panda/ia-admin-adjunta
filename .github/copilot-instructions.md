# GitHub Copilot Instructions

Read and follow the repository-wide rules in [AGENTS.md](../AGENTS.md) before planning or changing code.

For AIEOS, use [docs/aieos/README.md](../docs/aieos/README.md) as the system overview, [docs/aieos/ARCHITECTURE.md](../docs/aieos/ARCHITECTURE.md) for the technical design, [docs/aieos/PROTOCOLS.md](../docs/aieos/PROTOCOLS.md) for task lifecycle and [docs/aieos/SECURITY.md](../docs/aieos/SECURITY.md) for permission boundaries.

## Repository constraints

- Work on an authorised feature branch; never modify main directly.
- Inspect current code, tests, configuration and CI workflows before editing.
- Reuse existing Vite/React/TypeScript, Zod, Vitest, GitHub Actions and provider integrations where appropriate.
- Do not introduce a new auth provider, database, ORM, queue or paid AI dependency without an approved architecture decision.
- Neon Managed Auth is the intended identity provider in the current stabilization work; Drizzle is for business data only. Verify the final implementation before integrating AIEOS with it.
- Do not modify production databases, migrations, RLS, secrets, deployment configuration or identity records for AIEOS foundation work.

## Bounded autonomy

Copilot may perform scoped, reversible changes on an assigned feature branch and run allowlisted checks when the task contract permits it. It may prepare a draft PR and attach evidence where repository permissions allow.

It must not merge, deploy, change protected branch settings, alter authentication/authorization, modify database schemas or RLS, rotate secrets, or perform destructive/external side effects without explicit human approval. A platform's available tool does not imply permission to use it.

## Validation

Use the repository's actual scripts and the ordered validation requirements in docs/aieos/PROTOCOLS.md. Report exact evidence. Never claim unexecuted tests passed. Mark unavailable checks NOT RUN.

Do not merge or deploy without explicit human approval.
