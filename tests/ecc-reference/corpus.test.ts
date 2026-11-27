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

type ReferenceFixture = {
  schemaVersion: number;
  area: string;
  provenance: string;
  cases: Array<{
    id: string;
    expected: Record<string, unknown>;
    input?: Record<string, unknown>;
    query?: string;
    stage?: string;
    documents?: Array<{ id: string }>;
    syntheticLog?: string;
  }>;
  [key: string]: unknown;
};

function readFixture(name: string): ReferenceFixture {
  const file = resolve(
    process.cwd(),
    "tests/ecc-reference/fixtures",
    `${name}.json`,
  );
  return JSON.parse(readFileSync(file, "utf8")) as ReferenceFixture;
}

describe("ECC engineering reference corpus", () => {
  it("contains all seven readiness domains", () => {
    expect(fixtureNames).toHaveLength(7);
  });

  it.each(fixtureNames)("%s fixture contains stable golden cases", (name) => {
    const fixture = readFixture(name);
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.area).toBeTruthy();
    expect(fixture.provenance).toBeTruthy();
    expect(fixture.cases.length).toBeGreaterThanOrEqual(3);

    const ids = fixture.cases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of fixture.cases) {
      expect(item.id).toMatch(/^[A-Z]+-\d{3}$/);
      expect(item.input ?? item.query ?? item.stage).toBeTruthy();
      expect(item.expected).toBeTypeOf("object");
    }
  });

  it("keeps RAG rankings complete and deterministic", () => {
    const fixture = readFixture("rag-evaluator");

    for (const item of fixture.cases) {
      const documents = item.documents ?? [];
      const ranked = item.expected.rankedDocumentIds as string[];
      expect(ranked).toHaveLength(documents.length);
      expect(new Set(ranked)).toEqual(new Set(documents.map((doc) => doc.id)));
    }
  });

  it("never authorizes automatic PR merges", () => {
    const fixture = readFixture("stale-pr-review-thread-reopen-flow");

    for (const item of fixture.cases) {
      expect(item.expected.mayAutoMerge).toBe(false);
    }
  });

  it("keeps harness compatibility explicitly unverified", () => {
    const fixture = readFixture("harness-compatibility");
    expect(fixture.compatibilityStatus).toBe(
      "unverified-until-live-adapter-tests",
    );

    for (const item of fixture.cases) {
      expect(item.expected.compatibility).toBe("unverified");
    }
  });

  it("does not fabricate external security artifacts", () => {
    const fixture = readFixture("security-evidence");
    const artifacts = fixture.externalArtifacts as {
      status: string;
      required: string[];
    };

    expect(artifacts.status).toBe("pending-not-generated");
    expect(artifacts.required.length).toBeGreaterThanOrEqual(3);
  });

  it("labels CI log examples as synthetic dry runs", () => {
    const fixture = readFixture("ci-failure-modes");
    expect(fixture.provenance).toBe(
      "synthetic-dry-run-fixtures-not-captured-logs",
    );

    for (const item of fixture.cases) {
      expect(item.syntheticLog).toBeTruthy();
      expect(item.expected.mustNotDo).toBeInstanceOf(Array);
    }
  });
});
