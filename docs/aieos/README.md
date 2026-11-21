# AIEOS — AI Engineering Orchestration System

**Status:** Foundation specification, version 0.1.0  
**Repository:** IA Admin Adjunta  
**Operating model:** Hybrid local + cloud, provider-neutral, free-first, human-supervised.

## 1. Purpose

AIEOS is the coordination and governance layer for the user's software projects and AI tools. It is intended to connect specialised AI agents and development platforms through explicit task contracts, adapters, evidence, and approval gates.

AIEOS is not another general-purpose chatbot and must not become tightly coupled to one model vendor. ChatGPT, GitHub Copilot, Claude, Gemini, Replit, Base44, Lovable, GitHub Actions, and future tools are independent participants. AIEOS coordinates work; it does not assume every platform exposes an API or supports automated control.

## 2. Initial operating decisions

- **Core:** hybrid local + cloud. Local tools handle development and sensitive work where practical; cloud services provide collaboration and CI.
- **Initial control plane:** GitHub issues/PRs, branch protections, repository instructions, and CI evidence.
- **Initial execution environment:** VS Code and the existing Vite/React/TypeScript repository.
- **Autonomy:** supervised. Agents can analyse and propose. Writes are limited to authorised branches and scoped tools. Database, identity, security-policy, merge, and production actions require human approval.
- **Cost policy:** free/open-source options first; paid APIs only when their capability, quota, privacy, and cost are explicitly justified.
- **Persistence:** no new AIEOS tables or migrations in this foundation stage.

## 3. Logical architecture

1. **Control Plane** — task intake, priorities, project boundaries, status, approvals.
2. **Agent Registry** — provider, capabilities, operating mode, cost class, trust level, allowed actions.
3. **Task Router** — selects a suitable agent based on capability, availability, cost, privacy, and risk.
4. **Protocol Gateway** — normalises MCP, REST, webhooks, GitHub, CLI, and manual handoffs.
5. **Policy Engine** — enforces permissions, risk classes, approvals, and prohibited actions.
6. **Evidence Ledger** — stores references to diffs, test runs, build logs, reviews, and decisions.
7. **Human Approval Gate** — authorises sensitive transitions and release actions.
8. **Observability** — records task events, failures, latency, provider usage, and audit history.

## 4. Provider-neutral integration

Each external platform is represented by an adapter. An adapter may be:
- **API-connected:** a supported and authenticated API exists;
- **MCP-connected:** a compatible MCP server exposes specific tools/resources;
- **CLI-connected:** a controlled command-line interface is available;
- **manual handoff:** the agent receives a task packet and returns a result for review.

A platform must never be labelled connected merely because it appears in documentation or a registry. Connection status must be backed by a successful health/capability check. Do not scrape private sessions or bypass platform access controls.

## 5. Task execution model

Every task follows the lifecycle in [PROTOCOLS.md](./PROTOCOLS.md). Every completed task must return structured output: result, files changed, evidence, unresolved risks, cost/usage where available, and recommended next action.

A task is not complete because an agent says it is complete. Completion requires acceptance criteria and independent validation evidence.

## 6. Security boundary

Read [SECURITY.md](./SECURITY.md). External model output is untrusted. Secrets remain in their owning platform's secret store. The orchestrator receives scoped references, never raw credentials unless a narrowly defined server-side adapter requires them.

## 7. Current project boundary

The existing IA Admin Adjunta stabilization work takes precedence:
- Complete and review the open Neon Managed Auth consolidation work.
- Verify real sign-in/session round-trip before relying on the new identity path.
- Preserve the existing identities and do not perform production cutover or data migration without a separate approval.
- Keep Drizzle for business data and do not let it manage Neon Managed Auth's schema.
- Only after stabilization is accepted should AIEOS add durable task/agent persistence or authenticated dashboard routes.

## 8. Non-goals for v0.1

- No unrestricted autonomous coding.
- No direct production deployments.
- No automatic database migrations.
- No cross-provider credential sharing.
- No promise that every AI platform can be programmatically connected.
- No paid dependency or new hosted service as a prerequisite.

## 9. Delivery phases

See [ROADMAP.md](./ROADMAP.md). The foundation documents and task contract are the first deliverable; runtime orchestration, UI, durable persistence, provider adapters, and monitoring are subsequent gated phases.
