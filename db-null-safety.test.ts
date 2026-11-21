import { describe, expect, it, vi } from "vitest";

// Prove the business database and Neon Managed Auth verifier are safe on a
// serverless cold start when neither database nor auth configuration exists.
describe("serverless cold-start null-safety", () => {
  it("imports the Drizzle database and auth verifier without connection settings", async () => {
    vi.resetModules();
    const keys = ["DATABASE_URL", "NEON_DATABASE_URL", "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL"] as const;
    const saved = new Map(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];

    try {
      const dbMod = await import("./db/index");
      const authMod = await import("./api/lib/http");
      expect(dbMod.isDbConfigured).toBe(false);
      expect(dbMod.db).toBeNull();
      await expect(authMod.getSessionUser({ method: "GET", query: {}, headers: {} })).resolves.toBeNull();
    } finally {
      for (const key of keys) {
        const value = saved.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("constructs the Drizzle client when DATABASE_URL is present", async () => {
    vi.resetModules();
    const savedUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/testdb";
    try {
      const dbMod = await import("./db/index");
      expect(dbMod.isDbConfigured).toBe(true);
      expect(dbMod.db).not.toBeNull();
    } finally {
      if (savedUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = savedUrl;
    }
  });
});
