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

function readFixture(name: string) {
  const path = resolve(process.cwd(), "tests/ecc-reference/fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("ECC engineering reference corpus", () => {
  it("contains seven stable reference domains", () => {
    expect(fixtureNames).toHaveLength(7);

    for (const name of fixtureNames) {
      const fixture = readFixture(name);
      const ids = fixture.cases.map((item: { id: string }) => item.id);

      expect(fixture.schemaVersion).toBe(1);
      expect(fixture.area).toBeTruthy();
      expect(fixture.provenance).toBeTruthy();
      expect(fixture.cases.length).toBeGreaterThanOrEqual(3);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps RAG rankings complete and deterministic", () => {
    const fixture = readFixture("rag-evaluator");

    for (const item of fixture.cases) {
      const documents = item.documents as Array<{ id: string }>;
      const ranked = item.expected.rankedDocumentIds as string[];

      expect(ranked).toHaveLength(documents.length);
      expect(new Set(ranked)).toEqual(new Set(documents.map((doc) => doc.id)));
    }
  });

  it("never authorizes automatic PR merges", () => {
    const fixture = readFixture("stale-pr-review-thread-reopen-flow");

    expect(
      fixture.cases.every(
        (item: { expected: { mayAutoMerge: boolean } }) =>
          item.expected.mayAutoMerge === false,
      ),
    ).toBe(true);
  });

  it("keeps harness compatibility explicitly unverified", () => {
    const fixture = readFixture("harness-compatibility");

    expect(fixture.compatibilityStatus).toBe(
      "unverified-until-live-adapter-tests",
    );
    expect(
      fixture.cases.every(
        (item: { expected: { compatibility: string } }) =>
          item.expected.compatibility === "unverified",
      ),
    ).toBe(true);
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
    expect(
      fixture.cases.every((item: { syntheticLog: string }) =>
        Boolean(item.syntheticLog),
      ),
    ).toBe(true);
  });
});
