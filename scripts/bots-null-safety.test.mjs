import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Fresh-clone null safety for the autonomous bots: with NO database or AI
 * credentials in the environment, every bot script must still exit 0 with an
 * honest "nothing configured" report — never crash, never fabricate data.
 * GitHub Actions schedules these scripts unattended, so a missing-secret
 * cold start must be a clean no-op, not a red workflow.
 */
const BOTS = [
  "lead-hunter.mjs",
  "error-handler.mjs",
  "growth-marketing.mjs",
  "ops-manager.mjs",
  "teacher-agent.mjs",
  "skills-scout.mjs",
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runBotWithoutCredentials(file) {
  // Start from a minimal env (PATH/HOME only) so the child sees a truly cold
  // start with zero credentials, then let npm-set vars like npm_lifecycle*
  // pass through harmlessly.
  const cleanEnv = {};
  for (const key of ["PATH", "HOME", "LANG", "NODE_ENV", "CI", "npm_package_name"]) {
    if (process.env[key] !== undefined) cleanEnv[key] = process.env[key];
  }
  const res = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", file)], {
    env: cleanEnv,
    encoding: "utf8",
    timeout: 60_000,
    cwd: REPO_ROOT,
  });
  if (res.error && res.error.code !== "ENOENT") throw res.error;
  return { status: res.status, stdout: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

describe("bot scripts exit cleanly with zero credentials (fresh clone)", () => {
  for (const file of BOTS) {
    it(`${file} exits 0 and reports the missing store honestly`, () => {
      const { status, stdout } = runBotWithoutCredentials(file);
      expect(status, `${file} must exit 0 without credentials (got ${status}). Output: ${stdout.slice(0, 400)}`).toBe(0);
      // The honest no-store report must reach the operator, not silence.
      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout).toMatch(/no data store|nothing real|not configured|nothing configured|no store|store.*none|sem dados/i);
    });
  }
});
