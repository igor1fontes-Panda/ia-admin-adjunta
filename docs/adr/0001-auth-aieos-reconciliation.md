# ADR-0001 — Reconciliation of authentication and AIEOS stabilization

**Status:** Proposed for review

**Date:** 2026-11-27

**Scope:** Repository architecture and engineering workflow only

## Context

The default branch `main` and the stabilization work do not represent the same authentication implementation.

- PR #131 (`fix/auth-unification`) was merged into `stabilization/neon-better-auth-unification`, not into `main`. Its stated target is Neon Managed Auth using `@neon/auth` in the Vite client and JWT/JWKS validation in Vercel API handlers. It preserves the existing Neon identities and the separate Supabase identity; it does not migrate identities or perform a production cutover.
- PR #134 (AIEOS documentation and task contract) was also merged as a stacked change on the stabilization branch. It explicitly defers AIEOS persistence until host authentication/database stabilization is accepted.
- The PR #131 description reports passing CI, 148/148 tests, typecheck, lint, format, build and 70.16% statement coverage. It also explicitly lists a real sign-in/session round-trip against an isolated Neon validation branch and a Vercel Preview as outstanding.
- The stabilization branch is 15 commits ahead of and 59 commits behind `main` at the time of this decision. A wholesale merge would therefore mix substantial intervening changes and is not an acceptable reconciliation strategy.
- The current `main` tree still contains the transitional Better Auth implementation and conditional Neon Auth proxy path. Repository files alone do not prove which runtime environment variables are active in production.

## Decision

1. Do not perform an identity migration, database migration, auth cutover, production configuration change, or deployment as part of AIEOS foundation work.
2. Treat Neon Managed Auth with the official `@neon/auth` client and server-side JWT/JWKS verification as the proposed target architecture recorded by the stabilization PR, subject to completion of its outstanding sign-in/session and Preview checks.
3. Treat the authentication implementation currently present on `main` as the protected baseline until the target architecture has been independently validated and a separate, reviewed integration plan is accepted. Do not describe the two implementations as already unified.
4. Do not merge the 15-commit stabilization branch wholesale into `main`. Reconcile changes incrementally against the current `main` tree, with file-level review, conflict analysis and regression tests.
5. Keep Drizzle limited to business data. Never let it manage or migrate Neon Managed Auth-owned tables.
6. Preserve all existing Neon and Supabase identities and data. No deletion, copying of password hashes, schema push, RLS change, credential change or fallback removal is permitted in this phase.
7. Keep AIEOS read-only for its initial GitHub control-plane adapter. No repository writes, merges, workflow reruns, deployments or autonomous auth/database changes.

## Required validation gates

### Gate A — Authentication evidence

- Run the real sign-in, sign-out and protected-session round-trip against the isolated Neon validation branch.
- Verify existing credentials without exporting or copying password hashes.
- Verify JWT signature algorithm, issuer, audience, expiry, subject and administrative allowlist checks.
- Verify unauthorised and expired sessions are rejected by every active API route.
- Verify the deployed Vite application uses one intended authentication route; identify any still-active legacy route before removal.
- Configure and test password recovery only in a separately approved task; SMTP is not assumed to exist.

### Gate B — Preview and regression

- Obtain a successful Vercel Preview using the intended environment configuration without weakening verified-commit or deployment protections.
- Re-run format, typecheck, unit tests, coverage, lint, build, auth smoke tests and relevant API/security tests on the exact candidate commit.
- Record exact commit SHA, workflow run URLs, test outcomes and any checks not run.

### Gate C — Incremental integration

- Compare each candidate stabilization commit/file with current `main`.
- Reapply only changes still required and compatible with current code.
- Preserve unrelated changes made on `main` since the stabilization branch diverged.
- Open a reviewable PR; do not merge it automatically.

## AIEOS implementation order

1. Complete Gates A and B for the host authentication architecture.
2. Reconcile the AIEOS protocol documents and task JSON Schema into the current repository baseline.
3. Implement the domain/task core without persistence or external side effects.
4. Implement the GitHub read-only adapter with source URLs, observation timestamps, pagination, rate-limit handling and permission-denied tests.
5. Add provider registry and supervised/manual handoffs; do not mark providers connected without a verified handshake.
6. Propose a separate, minimal business-data persistence design only after the read-only stages are accepted. Any schema or migration work requires its own explicit approval.

## Explicitly out of scope

- Changes to `main` or production deployments.
- Changes to authentication code, identity/session configuration or user accounts.
- Database schema changes, migrations, RLS, grants or data writes.
- GitHub push/merge permissions for agents.
- Enabling autonomous code modification or external paid services.

## Acceptance criteria

- This decision is reviewed and accepted.
- Authentication and Preview gates have recorded evidence.
- No production identities, data, credentials or configuration were changed.
- Any subsequent implementation is isolated, incremental and independently reviewable.

## Evidence

- PR #131: https://github.com/igor1fontes-Panda/ia-admin-adjunta/pull/131
- PR #134: https://github.com/igor1fontes-Panda/ia-admin-adjunta/pull/134
- Issue #136: https://github.com/igor1fontes-Panda/ia-admin-adjunta/issues/136
- Issue #137: https://github.com/igor1fontes-Panda/ia-admin-adjunta/issues/137
- Issue #138: https://github.com/igor1fontes-Panda/ia-admin-adjunta/issues/138
- Stabilization branch: https://github.com/igor1fontes-Panda/ia-admin-adjunta/tree/stabilization/neon-better-auth-unification
