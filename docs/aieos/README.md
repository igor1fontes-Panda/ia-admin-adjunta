# AIEOS — AI Engineering Orchestration System

**Status:** Foundation specification, version 0.2.0  
**Repository:** IA Admin Adjunta  
**Operating model:** Hybrid local + cloud, provider-neutral, free-first, elevated bounded autonomy.

## 1. Purpose

AIEOS is the coordination and governance layer for the user's software projects and AI tools. It connects specialised AI agents and development platforms through task contracts, adapters, evidence and approval gates.

AIEOS is not another general-purpose chatbot and must not be tightly coupled to one model vendor. ChatGPT, GitHub Copilot, Claude, Gemini, Replit, Base44, Lovable, GitHub Actions and future tools are independent participants. AIEOS coordinates work; it does not assume every platform exposes an API or supports automated control.

## 2. Confirmed operating decisions

- **Core:** hybrid local + cloud. Local tools handle development and sensitive work where practical; cloud services provide collaboration and CI.
- **Initial control plane:** GitHub issues/PRs, branches, branch protections, repository instructions and CI evidence.
- **Initial execution environment:** VS Code and the existing Vite/React/TypeScript repository.
- **Autonomy:** elevated within explicit technical limits. Agents may perform bounded, reversible work in isolated workspaces and authorised feature branches, run allowlisted checks, and prepare draft PRs. Protected operations require explicit human approval.
- **Cost policy:** free/open-source options first; paid APIs only when capability, quota, privacy and cost are explicitly justified.
- **Persistence:** no new AIEOS tables or migrations in the foundation stage.

## 3. Logical architecture

1. **Control Plane** — task intake, priorities, project boundaries, status and approvals.
2. **Agent Registry** — provider, capabilities, connection status, cost class, trust level and allowed actions.
3. **Task Router** — selects an agent based on capability, availability, cost, privacy and risk.
4. **Protocol Gateway** — normalises MCP, REST, webhooks, GitHub, CLI and manual hand-offs.
5. **Policy Engine** — enforces permissions, risk classes, budgets, approvals and prohibited actions.
6. **Execution Runners** — isolated local and cloud workspaces for approved commands and code changes.
7. **Evidence Ledger** — references diffs, test runs, build logs, reviews and decisions.
8. **Human Approval Gate** — authorises sensitive transitions and release actions.
9. **Observability** — records task events, failures, latency, provider usage and audit history.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical design.

## 4. Provider-neutral integration

Each external platform is represented by an adapter. An adapter may be API-connected, MCP-connected, CLI-connected or operated through manual hand-off. A platform must never be labelled connected merely because it appears in documentation or a registry. Connection status requires a successful health/capability check. Do not scrape private sessions or bypass platform access controls.

## 5. Task execution model

Every task follows [PROTOCOLS.md](./PROTOCOLS.md) and uses the task contract. Every completed task returns structured output: result, files changed, evidence, unresolved risks, usage/cost where available and recommended next action.

A task is not complete because an agent says it is complete. Completion requires acceptance criteria and independent validation evidence.

## 6. Security boundary

Read [SECURITY.md](./SECURITY.md). External model output is untrusted. Secrets remain in their owning platform's secret store. The orchestrator receives scoped references, never raw credentials unless a narrowly defined server-side adapter requires them.

Elevated autonomy never means unrestricted access. Feature-branch write access does not imply permission to merge, deploy, change identity, alter databases or perform external financial/customer actions.

## 7. Current project boundary

The existing IA Admin Adjunta stabilization work takes precedence:
- Complete and review the open Neon Managed Auth consolidation work.
- Verify real sign-in/session round-trip before relying on the new identity path.
- Preserve existing identities; no production cutover or data migration without separate approval.
- Keep Drizzle for business data and do not let it manage Neon Managed Auth's schema.
- Only after stabilization is accepted should AIEOS add durable task/agent persistence or authenticated dashboard routes.

## 8. Non-goals for v0.2

- Unrestricted autonomous coding or unrestricted tool execution.
- Automatic production deployments or protected-branch merges.
- Automatic database migrations or RLS/authentication changes.
- Cross-provider credential sharing.
- A promise that every AI platform can be programmatically connected.
- A paid dependency or new hosted service as a prerequisite.

## 9. Delivery phases

See [ROADMAP.md](./ROADMAP.md). Foundation documents and task contract are the first deliverable; runtime orchestration, UI, durable persistence, provider adapters and monitoring are subsequent gated phases.
