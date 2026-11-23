import { describe, expect, it, vi } from "vitest";
// Prove serverless cold-start is null-safe WITHOUT DATABASE_URL.
describe("serverless cold-start null-safety", () => {
  it("imports db and auth modules without a connection string", async () => {
    vi.resetModules();
    const savedUrl = process.env.DATABASE_URL;
    const savedNeon = process.env.NEON_DATABASE_URL;
    const savedReadOnly = process.env.NEON_READONLY_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    delete process.env.NEON_READONLY_DATABASE_URL;
    try {
      const dbMod = await import("./db/index");
      const authMod = await import("./server/auth");
      expect(dbMod.isDbConfigured).toBe(false);
      expect(dbMod.db).toBeNull();
      expect(authMod.auth).toBeNull();
    } finally {
      if (savedUrl) process.env.DATABASE_URL = savedUrl;
      if (savedNeon) process.env.NEON_DATABASE_URL = savedNeon;
      if (savedReadOnly) process.env.NEON_READONLY_DATABASE_URL = savedReadOnly;
    }
  });

  it("constructs real clients when DATABASE_URL is present", async () => {
    vi.resetModules();
    const savedReadOnly = process.env.NEON_READONLY_DATABASE_URL;
    delete process.env.NEON_READONLY_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/testdb";
    try {
      const dbMod = await import("./db/index");
      expect(dbMod.isDbConfigured).toBe(true);
      expect(dbMod.db).not.toBeNull();
    } finally {
      delete process.env.DATABASE_URL;
      if (savedReadOnly) process.env.NEON_READONLY_DATABASE_URL = savedReadOnly;
    }
  });

  it("resolves the serverless auth handler under Node ESM without database credentials", async () => {
    vi.resetModules();
    const envKeys = ["DATABASE_URL", "NEON_DATABASE_URL", "NEON_READONLY_DATABASE_URL", "VITE_NEON_AUTH_URL"] as const;
    const saved = new Map(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];

    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };

    try {
      const { default: handler } = await import("./api/auth/better-auth");
      await handler(
        { method: "GET", url: "/api/auth/get-session", body: undefined, query: {}, headers: {} } as never,
        response as never,
      );
      expect(response.statusCode).toBe(503);
      expect(response.body).toEqual({
        error:
          "Authentication is unavailable: set DATABASE_URL (Neon pooled connection) and BETTER_AUTH_SECRET, then redeploy.",
      });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
