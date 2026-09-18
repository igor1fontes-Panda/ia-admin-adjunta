import { describe, expect, it, vi } from "vitest";
// Prove serverless cold-start is null-safe WITHOUT DATABASE_URL.
describe("serverless cold-start null-safety", () => {
  it("imports db and auth modules without a connection string", async () => {
    vi.resetModules();
    const savedUrl = process.env.DATABASE_URL;
    const savedNeon = process.env.NEON_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    try {
      const dbMod = await import("./db/index");
      const authMod = await import("./server/auth");
      expect(dbMod.isDbConfigured).toBe(false);
      expect(dbMod.db).toBeNull();
      expect(authMod.auth).toBeNull();
    } finally {
      if (savedUrl) process.env.DATABASE_URL = savedUrl;
      if (savedNeon) process.env.NEON_DATABASE_URL = savedNeon;
    }
  });

  it("constructs real clients when DATABASE_URL is present", async () => {
    vi.resetModules();
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/testdb";
    try {
      const dbMod = await import("./db/index");
      expect(dbMod.isDbConfigured).toBe(true);
      expect(dbMod.db).not.toBeNull();
    } finally {
      delete process.env.DATABASE_URL;
    }
  });
});
