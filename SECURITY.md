# Security Policy

## Scope

This policy applies to the IA Admin Adjunta application, its source code, deployment configuration, integrations, and data-processing components maintained in this repository.

## Supported code

Security fixes are prioritised for the current default branch and actively maintained release branches. A release branch is considered supported only when its maintenance status is documented in the repository. Do not assume that an old deployment or unmaintained branch receives security updates.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue or pull request.

Use GitHub's **Private vulnerability reporting** feature for this repository, if enabled. If it is unavailable, contact the repository owner through the private contact channel available from the repository owner's GitHub profile and request a confidential security-reporting channel. Include:

- affected component, route, version or commit;
- concise reproduction steps and required privileges;
- security impact and realistic attack prerequisites;
- evidence with secrets, personal data and production identifiers removed.

Do not include passwords, access tokens, session cookies, private keys, customer records or unredacted production data.

## Response and remediation

The maintainers will acknowledge a report as soon as practicable, validate the finding, assess severity using impact, exploitability, exposure and (where applicable) CISA KEV status, and coordinate remediation and disclosure with the reporter. No fixed response-time SLA is promised until a monitored security contact and response rota are established.

Accepted findings should be tracked privately until a fix or mitigation is available. Public disclosure should avoid exposing exploit details before users have a reasonable opportunity to update.

## Security engineering requirements

Changes affecting authentication, authorisation, data access, integrations, exports, secrets, deployment or infrastructure require focused review and tests. Apply least privilege, tenant isolation where applicable, input validation, output encoding, CSRF protection where relevant, rate limits, audit logging with data minimisation, dependency review and secret scanning.

Never introduce hidden access paths, undocumented credentials, backdoors or production test accounts. Never place secrets or sensitive production data in source control, logs, test fixtures or issue reports.

## Operational limitations

A passing build or dependency scan is not proof that the application is secure. Security status must be reported with the exact scope, tools, versions and date of each verification.
