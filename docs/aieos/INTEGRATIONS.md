# AIEOS Integration Catalogue

**Version:** 0.1.0  
**Important:** this catalogue is a target integration plan, not proof that every provider is currently connected.

## 1. Integration patterns

| Pattern | Use | Evidence required |
|---|---|---|
| MCP | Tools/resources exposed by a compatible MCP server | Successful handshake, tool inventory, scoped permission test |
| REST + OpenAPI | Documented provider APIs | API contract, auth scope, success/error contract tests |
| Webhooks | Provider events into AIEOS | Signature verification, replay protection, idempotency |
| GitHub App/API | Issues, PRs, branches, checks, workflow status | App permissions and repository-level tests |
| CLI | Local developer tools and tests | Allowlisted commands, working directory and timeout |
| Manual handoff | Platforms without supported API automation | Task packet and structured result returned by operator |

## 2. Provider roles

| Platform | Intended role | Initial connection mode |
|---|---|---|
| ChatGPT | Coordinator, architecture, analysis, audit | Manual handoff / available connected tools |
| GitHub Copilot | Repository-aware coding and review | VS Code / GitHub native |
| Claude | Independent architecture and code review | Manual handoff or supported API/MCP |
| Gemini | Research and model option for selected workloads | Manual handoff or documented API |
| VS Code | Local development and controlled tool execution | CLI / editor |
| GitHub | Canonical source, tasks, PRs, CI evidence | GitHub API / Actions |
| Base44 | Rapid application build and administration prototypes | Platform-native workflow; API only if documented |
| Replit | Prototyping and application execution | Platform-native workflow; API only if documented |
| Lovable | UI and application prototyping | Platform-native workflow; API only if documented |
| Vercel | Preview/production hosting and deployment evidence | Vercel integration/API after approval |
| Neon | PostgreSQL and Managed Auth | Existing application integration; no AIEOS schema changes in foundation |
| Supabase | Existing identity/data components pending reconciliation | Existing integration only; do not assume removed |

## 3. Provider adapter contract

A runtime adapter should implement a provider-neutral contract equivalent to:
- `identify()`: provider name, version, supported capabilities, connection state.
- `healthCheck()`: verify availability without exposing credentials.
- `submit(taskPacket)`: submit only authorised task context.
- `getStatus(externalTaskId)`: retrieve execution state.
- `cancel(externalTaskId)`: request cancellation when supported.
- `normaliseResult(rawResult)`: return the common AIEOS result format.
- `revokeAccess()`: disable the adapter's credentials through its owning provider when supported.

Adapters must declare unsupported operations explicitly. They must not simulate success when an API does not support an action.

## 4. Agent selection policy

The router should rank candidates by:
1. capability fit and task context support;
2. data sensitivity and provider privacy constraints;
3. permission compatibility and trust level;
4. availability and rate limits;
5. free quota / cost estimate;
6. latency and reliability.

A cheaper model must not be selected if it cannot meet the security or quality requirements. Avoid redundant multi-agent calls unless independent review materially reduces risk.

## 5. Free-first policy

- Prefer built-in free tiers and open-source local tools when suitable.
- Track quota, rate limits, model availability, data-retention terms, and usage cost.
- Do not create a paid subscription or incur usage charges automatically.
- If the free tier is exhausted, pause or select a validated alternative; do not silently upgrade.

## 6. Connection status vocabulary

- `not_configured`: no integration setup exists.
- `configured_unverified`: settings exist but handshake has not passed.
- `connected_read_only`: verified read access only.
- `connected_scoped_write`: verified limited write access.
- `degraded`: configured but failing or rate-limited.
- `disabled`: intentionally unavailable.

A registry entry is not proof of a live connection. Store the timestamp and evidence of the latest health check.
