import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureNames = [
  "deep-analyzer",
  "rag-evaluator",
  "stale-pr-review-thread-reopen-flow",
  "discussion-triage",
  "harness-compatibility",
  "security-evidence",
  "ci-failure-modes",
] as const;

type CorpusFixture = {
  schemaVersion: number;
  area: string;
  provenance: string;
  cases: Array<{
    id: string;
    input?: Record<string, unknown>;
    query?: string;
    stage?: string;
    expected: Record<string, unknown>;
    rationale?: string;
    documents?: Array<{ id: string }>;
    syntheticLog?: string;
  }>;
  [key: string]: unknown;
};

function loadFixture(name: string): CorpusFixture {
  const path = resolve(process.cwd(), "tests/ecc-reference/fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as CorpusFixture;
}

describe("ECC engineering reference corpus", () => {
  it("contains all seven readiness domains", () => {
    expect(fixtureNames).toHaveLength(7);
  });

  it.each(fixtureNames)("%s fixture has stable, non-empty golden cases", (name) => {
    const fixture = loadFixture(name);
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.area).toBeTruthy();
    expect(fixture.provenance).toBeTruthy();
    expect(fixture.cases.length).toBeGreaterThanOrEqual(3);

    const ids = fixture.cases.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const testCase of fixture.cases) {
      expect(testCase.id).toMatch(/^[A-Z]+-\d{3}$/);
      expect(testCase.input ?? testCase.query ?? testCase.stage).toBeTruthy();
      expect(testCase.expected).toBeTypeOf("object");
    }
  });

  it("keeps RAG expected rankings deterministic and complete", () => {
    const fixture = loadFixture("rag-evaluator");
    for (const testCase of fixture.cases) {
      const documents = testCase.documents as Array<{ id: string }>;
      const ranked = testCase.expected.rankedDocumentIds as string[];
      expect(ranked).toHaveLength(documents.length);
      expect(new Set(ranked)).toEqual(new Set(documents.map(({ id }) => id)));
    }
  });

  it("never authorizes automatic PR merges from salvage fixtures", () => {
    const fixture = loadFixture("stale-pr-review-thread-reopen-flow");
    for (const testCase of fixture.cases) {
      expect(testCase.expected.mayAutoMerge).toBe(false);
    }
  });

  it("does not claim unverified harness compatibility", () => {
    const fixture = loadFixture("harness-compatibility");
    expect(fixture.compatibilityStatus).toBe(
      "unverified-until-live-adapter-tests",
    );
    for (const testCase of fixture.cases) {
      expect(testCase.expected.compatibility).toBe("unverified");
    }
  });

  it("does not fabricate external security scanner artifacts", () => {
    const fixture = loadFixture("security-evidence");
    const artifacts = fixture.externalArtifacts as {
      status: string;
      required: string[];
    };
    expect(artifacts.status).toBe("pending-not-generated");
    expect(artifacts.required.length).toBeGreaterThanOrEqual(3);
  });

  it("labels CI log samples as synthetic dry-run fixtures", () => {
    const fixture = loadFixture("ci-failure-modes");
    expect(fixture.provenance).toBe(
      "synthetic-dry-run-fixtures-not-captured-logs",
    );
    for (const testCase of fixture.cases) {
      expect(testCase.syntheticLog).toBeTruthy();
      expect(testCase.expected.mustNotDo).toBeInstanceOf(Array);
    }
  });
});
