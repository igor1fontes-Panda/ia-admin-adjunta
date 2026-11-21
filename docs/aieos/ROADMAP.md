# AIEOS Implementation Roadmap

**Version:** 0.1.0  
**Principle:** deliver a working, verifiable increment at each stage; do not skip gates.

## Stage 0 — Foundation specification
**Deliverables:** repository-wide agent rules, Copilot instructions, architecture, protocols, security baseline, integration catalogue, task JSON Schema.  
**Exit gate:** human review of scope and protocol documents.

## Stage 1 — Stabilise the host application
**Prerequisite:** complete the existing IA Admin Adjunta stabilization work before adding orchestration persistence.
- Finish the Neon Managed Auth consolidation in its existing draft PR.
- Perform the real sign-in/session round-trip on an isolated validation environment.
- Resolve any mismatch between repository implementation, documentation, and PR claims.
- Verify the unified Drizzle business schema and dependency lockfile.
- Preserve existing Neon and Supabase identities; no migration/cutover without separate approval.
- Run format, typecheck, Vitest/coverage, build, security checks, and fresh-clone validation.
**Exit gate:** approved PR and reproducible CI evidence. No direct production deployment.

## Stage 2 — AIEOS domain core (no external side effects)
- Implement TypeScript task/agent/result types from the JSON Schema.
- Implement task lifecycle/state transitions and risk policy as pure functions.
- Add unit tests for allowed/denied transitions, malformed tasks, and approval rules.
- Keep the first implementation stateless or local-only; no database writes.
**Exit gate:** tests and build pass; architecture review approves the contracts.

## Stage 3 — GitHub control-plane adapter
- Read-only repository/branch/PR/check status integration first.
- Add issue/task synchronisation only after scope and permissions are reviewed.
- Keep write operations limited to a dedicated branch and draft PR creation.
- Store evidence references, not copies of secrets or private provider data.
**Exit gate:** permission tests, audit evidence, and human approval.

## Stage 4 — Agent registry and provider adapters
- Register ChatGPT, Copilot, Claude, Gemini, and development platforms as provider profiles.
- Implement one adapter at a time, beginning with the highest-value supported interface.
- Use MCP or documented APIs where available; otherwise retain manual handoff.
- Add health checks, rate limits, cost tracking, and kill switches.
**Exit gate:** each adapter passes its own security and contract tests.

## Stage 5 — Dashboard and task persistence
- Add authenticated task/agent/evidence views to the existing dashboard.
- Only after Stage 1 is accepted, propose the minimal Drizzle business-data schema.
- Use migrations with review, isolated validation, rollback, and explicit human approval.
- Do not let Drizzle manage Neon Managed Auth tables.
**Exit gate:** access-control, tenant-boundary, migration and regression tests.

## Stage 6 — CI, build, security and monitoring automation
- Integrate GitHub Actions status, build evidence, dependency/security checks, and alerting.
- Add scheduled read-only health and stale-task checks.
- Keep automated remediation limited to isolated branches and reversible changes.
**Exit gate:** failure-mode tests, alert routing, audit records, kill switch.

## Stage 7 — Elevated bounded multi-agent execution
- Allow task decomposition and provider routing within task budgets and declared capabilities.
- Permit bounded branch-scoped execution for approved reversible work.
- Require independent review for medium/high-risk work.
- Require explicit human approval for critical actions and release.
- Evaluate quality against a versioned set of representative tasks.
**Exit gate:** measured quality, security review, cost limits, and operator acceptance.

## Current exclusions

Until their separate gates are passed, AIEOS must not:
- modify production data, Neon Auth identities, Supabase identities, schemas, or RLS;
- create or rotate secrets;
- change authentication architecture;
- merge to `main`;
- deploy or alter billing;
- enable autonomous writes across external platforms.
