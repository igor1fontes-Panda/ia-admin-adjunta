# ECC Engineering Reference Corpus

Status: initial synthetic reference set; integration with the production analyzer/evaluator is not yet claimed.

## Purpose

Provide versioned, reviewable examples for the seven ECC readiness areas:

1. Deep analyzer regression cases.
2. RAG/evaluator ranking comparisons.
3. PR salvage and review-queue decisions.
4. Public discussion triage.
5. Harness adapter compatibility contracts.
6. Security policy/evidence expectations.
7. CI failure-mode diagnosis and dry-run examples.

## Provenance and safety

- All case inputs and log excerpts in this directory are synthetic, deterministic examples authored for regression design.
- No production logs, private discussions, user data, credentials, tokens, or customer records are included.
- A fixture describes an expected decision; it is not proof that a production analyzer, external harness, scanner, or hosted service currently produces that decision.
- Harness compatibility remains unverified until each adapter is exercised against the named harness.
- Security scanner artifacts (SBOM, SARIF, dependency-audit output, or AgentShield pack) are not fabricated here. The security fixture records the required evidence and explicitly leaves those artifacts pending.
- CI snippets are marked as synthetic dry-run examples, not captured historical logs.

## Layout

- `tests/ecc-reference/fixtures/*.json`: machine-readable golden cases.
- `tests/ecc-reference/corpus.test.ts`: structural and invariant checks run by Vitest.

## Running

```sh
npm test -- tests/ecc-reference/corpus.test.ts
```

The test validates corpus structure and safety invariants. It does not invoke or certify an analyzer, retriever, PR automation service, discussion classifier, external harness, security scanner, CI workflow, Vercel, authentication provider, or database.

## Promotion criteria

Before calling any area production-ready:

1. Connect the fixture to the real implementation or adapter.
2. Run the relevant cases against that implementation.
3. Record exact tool/version, commit SHA, timestamp, and results.
4. Review false positives/negatives and ranking/decision drift.
5. Keep external evidence artifacts immutable and linked to their originating run.
