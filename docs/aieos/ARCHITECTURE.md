# AIEOS Technical Architecture

**Version:** 0.2.0  
**Deployment:** Hybrid local + cloud  
**Initial control plane:** GitHub  
**Autonomy:** Elevated but bounded by task scope, policy and runner isolation.

## 1. Architecture overview

AIEOS separates the control plane from execution. GitHub is the initial authoritative engineering record; local and cloud runners perform bounded work; provider adapters connect AI platforms only through supported interfaces.

~~~text
                    HUMAN OWNER / APPROVAL
                              |
                    AIEOS CONTROL PLANE
            GitHub Issues / PRs / Branches / CI
                              |
           +------------------+------------------+
           |                  |                  |
      TASK REGISTRY      POLICY ENGINE       EVIDENCE LEDGER
           |                  |                  |
           +------------------+------------------+
                              |
                       TASK ROUTER
                              |
                     AGENT GATEWAY
                 /        |        \
             MCP/API    IDE/CLI    Manual
               |          |          |
          AI PROVIDERS  LOCAL NODE  WEB PLATFORMS
       ChatGPT/Copilot  VS Code     Base44/Replit/
       Claude/Gemini    Worktrees   Lovable etc.
                 \        |        /
                   EXECUTION RUNNERS
                           |
             TESTS / SECURITY / BUILD / REVIEW
                           |
                  APPROVAL & RELEASE GATE
                           |
                VERIFIED PROJECT ARTIFACTS
~~~

The diagram is a logical model, not a claim that every integration is already connected.

## 2. Core components

| Component | Responsibility | Initial implementation |
|---|---|---|
| Control Plane | Task intake, priority, status, project boundary | GitHub Issues, PRs and labels |
| Task Registry | Task identity, acceptance criteria, owner, risk and state | Versioned task contract + GitHub |
| Agent Registry | Provider, model, capabilities, connection status and limits | Version-controlled registry, later runtime |
| Task Router | Select agent by capability, privacy, risk, availability and cost | Manual routing initially |
| Policy Engine | Authorise tools, paths, risk and state transitions | Documented rules + CI checks |
| Agent Gateway | Normalise provider requests/results | Adapter interfaces, introduced incrementally |
| Execution Runners | Run commands and scoped code changes | GitHub Actions and local VS Code workspace |
| Evidence Ledger | Commit, PR, test, build and review references | GitHub checks and workflow artifacts |
| Approval Gate | Authorise protected operations | GitHub review/environment protection + owner approval |
| Observability | Usage, run status, failure and audit events | GitHub Actions first |

## 3. Local + cloud topology

### Local execution node

- Trusted workstation and repository checkout.
- VS Code, Git and allowlisted CLI tools.
- Isolated worktrees/branches per task.
- Optional local model runtime where hardware and model license permit.
- Secrets supplied through OS credential storage or environment injection, never committed.
- Local logs redacted before any cloud upload.

### Cloud control and execution node

- GitHub repository, issues, PRs, branch protections and Actions.
- Cloud runners execute reproducible checks and bounded automation.
- Hosted model providers are optional adapters, not the control plane.
- Use short-lived, least-privilege credentials and protected environments.

### Synchronisation boundary

Synchronise task state, branch/commit references, check results and non-sensitive metadata. Do not synchronise raw secrets, local credential stores or unnecessary customer data.

## 4. Provider adapter contract

Every adapter must declare its identity and capabilities before use. Minimum logical operations:

- identify(): provider, model/tool, version, supported capabilities and connection state.
- healthCheck(): verify availability without exposing credentials.
- submit(taskPacket): submit only authorised task context.
- getStatus(runId): retrieve execution state.
- cancel(runId): request cancellation where supported.
- normaliseResult(raw): return the AIEOS result contract.
- revokeAccess(): disable the integration credential through its owning provider where supported.

Unsupported operations must be explicit. Manual hand-off is a valid adapter mode; do not pretend a platform has an API or MCP integration when it does not.

## 5. Task lifecycle and state ownership

The normative lifecycle is defined in PROTOCOLS.md. GitHub is the initial source of truth. A future database may index/cache task data but must not become a competing source of truth.

A state transition requires an actor, timestamp, task ID, policy decision and evidence reference. A model's natural-language claim is not evidence of a successful tool operation.

## 6. Autonomy and execution boundary

Elevated autonomy applies to bounded, reversible work:
- read approved repository context;
- edit allowed files on an authorised feature branch;
- run allowlisted checks in a sandbox;
- create a draft PR and attach evidence if permissions permit;
- retry transient failures within budget.

Human approval remains mandatory for protected-branch merge, production release/deploy, database/schema/migration/RLS changes, identity/auth changes, secret/permission changes, destructive operations and external financial/customer side effects.

## 7. Persistence strategy

Do not create AIEOS tables in the foundation stage. First complete the existing application build and authentication/data-layer stabilization. Then evaluate whether existing Drizzle business-data persistence is appropriate for task/agent records. Any schema proposal must include authorization/tenant model, migration and rollback plan, tests and explicit approval. Drizzle must not manage Neon Managed Auth's internal schema.

## 8. Reliability and failure handling

- Use bounded retries with exponential backoff for transient errors.
- Respect provider rate limits; never rotate accounts to evade quotas.
- Use correlation IDs and idempotency keys to prevent duplicate side effects.
- Validate all task/result payloads against versioned schemas.
- On invalid output, timeout or provider outage, mark blocked/failed and retain sanitized evidence.
- Support cancellation and a global kill switch before enabling write-capable adapters.
- Record partial completion; never mark a task complete when required checks are missing.

## 9. Architecture quality attributes

- **Portability:** provider-neutral contracts and documented APIs.
- **Security:** least privilege, isolated runners, explicit approvals.
- **Resilience:** provider-independent task record and manual fallback.
- **Observability:** attributable events and verifiable evidence.
- **Cost control:** free-first routing, quotas, budgets and no automatic paid upgrades.
- **Maintainability:** small adapters, contract tests and no duplicate auth/data layers.
- **Privacy:** data minimisation and provider-specific disclosure review.
