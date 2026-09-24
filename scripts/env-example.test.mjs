// Audit item 07 guard: every env var read in source must be declared in .env.example.
//
// This test statically scans the same trees the audit scans (api/, src/, scripts/, server/,
// db/, ai_engine.py) for environment reads — process.env.X, import.meta.env.X, and
// os.environ["X"] / os.getenv("X") in Python — and asserts each name appears in .env.example.
//
// It is a ratchet: the PENDING allowlist below records vars known to be missing from the
// current template. It may only shrink. When someone adds a new env read without declaring
// it, this test fails in CI. When .env.example is completed, the PENDING list must be
// emptied (this test then enforces "zero missing") — deleting entries is the only allowed
// direction of change.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Vars read via GitHub Actions secrets/vars only — never declared in dotenv templates. */
const CI_ONLY = new Set(["GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN"]);

/**
 * Vars injected by the hosting platform at runtime (Vercel / v0). They are not
 * user-supplied configuration, so .env.example intentionally omits them.
 */
const PLATFORM_INJECTED = new Set([
  "VERCEL",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "V0_BUILD_URL",
  "V0_DEV_APP_URL",
  "V0_RUNTIME_URL",
  "V0_SANDBOX_URL",
]);

/**
 * Known-missing vars at the time this guard landed (audit item 07).
 * INVARIANT: this list may only shrink; a length increase must fail review.
 * Empty this list once .env.example is refreshed (paste the reviewed template).
 */
const PENDING = [
  "AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BOT_NAME",
  "BRIEFING_BUCKET",
  "CLERK_SECRET_KEY",
  "HUME_BASE_URL",
  "HUME_VOICE_NAME",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NODE_ENV",
  "PORT",
  "STRIPE_PRICE_ENTERPRISE",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_PRICE_STARTER",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "VITE_NEON_AUTH_URL",
];

const SCAN_DIRS = ["api", "src", "scripts", "server", "db"];
const SCAN_FILES = ["ai_engine.py"];
const EXCLUDED_BASENAMES = [
  ".d.ts",
  "env-example.test.mjs", // this file — the allowlist would otherwise match itself
  "generate-project-report.py", // documents var *names* as prose; reads none itself
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "isolate") continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function scanSource() {
  const names = new Set();
  const tsPattern = /(?:process|import\.meta)\.env\.([A-Z_][A-Z0-9_]*)/g;
  // matches os.environ.get("X"), os.environ("X") and os.environ["X"]
  const pyPattern = /os\.environ(?:\.get)?\(?["']([A-Z_][A-Z0-9_]*)["']\]?/g;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      if (EXCLUDED_BASENAMES.some((sfx) => file.endsWith(sfx))) continue;
      const text = readFileSync(file, "utf8");
      if (/\.(ts|tsx|mjs|js)$/.test(file)) {
        for (const m of text.matchAll(tsPattern)) names.add(m[1]);
      } else if (/\.py$/.test(file)) {
        for (const m of text.matchAll(pyPattern)) names.add(m[1]);
      }
    }
  }
  for (const file of SCAN_FILES) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(pyPattern)) names.add(m[1]);
  }
  return [...names].sort();
}

function declaredInExample() {
  const text = readFileSync(".env.example", "utf8");
  const names = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (m) names.add(m[1]);
  }
  return names;
}

describe(".env.example completeness (audit item 07)", () => {
  it("collects env reads from source and parses declared names", () => {
    expect(scanSource().length).toBeGreaterThan(10);
    expect(declaredInExample().has("VITE_SUPABASE_URL")).toBe(true);
    expect(declaredInExample().has("VITE_MOCK_DATA")).toBe(true);
  });

  it("declares every env var referenced in source (PENDING may not grow)", () => {
    const referenced = scanSource();
    const declared = declaredInExample();
    const missing = referenced.filter(
      (name) => !declared.has(name) && !CI_ONLY.has(name) && !PLATFORM_INJECTED.has(name) && !PENDING.includes(name),
    );
    expect(
      missing,
      "New env var(s) read in source but absent from .env.example. " +
        "Declare them in .env.example with a placeholder + comment. " +
        "(PENDING may only shrink — never add entries to it.)",
    ).toEqual([]);

    expect(
      PENDING.length,
      "PENDING shrank or grew? It is a ratchet: entries may only be REMOVED (when the " +
        "corresponding var is declared in .env.example). Fix by deleting entries, not adding.",
    ).toBe(17);
  });

  it("has no PENDING entry that is already declared or no longer read (keeps the list honest)", () => {
    const declared = declaredInExample();
    const referenced = scanSource();
    const stale = PENDING.filter((name) => declared.has(name));
    expect(stale, "PENDING lists vars that .env.example already declares — remove them from PENDING.").toEqual([]);
    const ghost = PENDING.filter((name) => !referenced.includes(name));
    expect(ghost, "PENDING lists vars no longer read in source — remove them from PENDING.").toEqual([]);
  });
});
