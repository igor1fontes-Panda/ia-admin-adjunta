/**
 * Tests for the shared API validation boundary (api/lib/http.ts).
 *
 * The audit flagged "input_validation_patterns reported empty" across the
 * Supabase/API entry points. These tests pin the zod schemas that every
 * mutating route now runs its payload through BEFORE it reaches Drizzle:
 * hostile or malformed direct API calls get a readable 400, never a broken
 * database row.
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { VercelResponse } from "./http";
import { apiSchemas, parseBody, validationError } from "./http";

function mockRes(): VercelResponse & { statusCode: number; body: unknown } {
  const state = { statusCode: 200, body: undefined as unknown };
  const res: VercelResponse & { statusCode: number; body: unknown } = {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
    end() {
      return res;
    },
    append() {
      return res;
    },
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
  };
  return res;
}

describe("apiSchemas.leadCreate", () => {
  it("accepts a valid public lead payload", () => {
    const parsed = apiSchemas.leadCreate.safeParse({
      company: "Acme Lda",
      contact_name: "Maria Silva",
      email: "Maria@Acme.COM",
      niche: "SaaS",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("maria@acme.com");
  });

  it("rejects a too-short company and a hostile oversized field", () => {
    expect(
      apiSchemas.leadCreate.safeParse({ company: "A", contact_name: "Maria", email: "m@a.com", niche: "SaaS" }).success,
    ).toBe(false);
    expect(
      apiSchemas.leadCreate.safeParse({
        company: "A".repeat(121),
        contact_name: "Maria",
        email: "m@a.com",
        niche: "SaaS",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      apiSchemas.leadCreate.safeParse({ company: "Acme", contact_name: "Maria", email: "nope", niche: "SaaS" }).success,
    ).toBe(false);
  });

  it("rejects a missing niche", () => {
    expect(
      apiSchemas.leadCreate.safeParse({ company: "Acme", contact_name: "Maria", email: "m@a.com", niche: " " }).success,
    ).toBe(false);
  });
});

describe("apiSchemas.clientCreate", () => {
  it("accepts a valid client and normalizes the email", () => {
    const parsed = apiSchemas.clientCreate.safeParse({
      name: "Globex",
      email: " Billing@Globex.com ",
      plan: "starter",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("billing@globex.com");
      expect(parsed.data.name).toBe("Globex");
    }
  });

  it("rejects an unknown plan", () => {
    expect(apiSchemas.clientCreate.safeParse({ name: "Globex", email: "b@g.com", plan: "gold" }).success).toBe(false);
  });

  it("rejects a too-short name", () => {
    expect(apiSchemas.clientCreate.safeParse({ name: "G", email: "b@g.com", plan: "starter" }).success).toBe(false);
  });
});

describe("apiSchemas.orderCreate", () => {
  it("accepts a valid order", () => {
    expect(
      apiSchemas.orderCreate.safeParse({ client_id: "c1", client_name: "Globex", amount: 29160, method: "multicaixa" })
        .success,
    ).toBe(true);
  });

  it("accepts a walk-in order with null client_id", () => {
    expect(
      apiSchemas.orderCreate.safeParse({ client_id: null, client_name: "Walk-in", amount: 12500, method: "paypay" })
        .success,
    ).toBe(true);
  });

  it("rejects sub-minimum, non-integer and non-numeric amounts", () => {
    const base = { client_id: null, client_name: "Walk-in", method: "card" as const };
    expect(apiSchemas.orderCreate.safeParse({ ...base, amount: 999 }).success).toBe(false);
    expect(apiSchemas.orderCreate.safeParse({ ...base, amount: 10.5 }).success).toBe(false);
    expect(apiSchemas.orderCreate.safeParse({ ...base, amount: Number.NaN }).success).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    expect(
      apiSchemas.orderCreate.safeParse({ client_id: null, client_name: "Walk-in", amount: 12500, method: "crypto" })
        .success,
    ).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns the parsed data for a valid payload", () => {
    const res = mockRes();
    const data = parseBody(res, apiSchemas.clientCreate, { name: "Globex", email: "b@g.com", plan: "starter" });
    expect(data).toEqual({ name: "Globex", email: "b@g.com", plan: "starter" });
    expect(res.statusCode).toBe(200);
  });

  it("responds 400 with the first validation message for an invalid payload", () => {
    const res = mockRes();
    const data = parseBody(res, apiSchemas.clientCreate, { name: "", email: "b@g.com", plan: "starter" });
    expect(data).toBeNull();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "name must be at least 2 characters." });
  });

  it("responds 400 for a non-object body", () => {
    const res = mockRes();
    const data = parseBody(res, apiSchemas.orderCreate, "not-an-object");
    expect(data).toBeNull();
    expect(res.statusCode).toBe(400);
  });
});

describe("validationError", () => {
  it("writes a readable 400 from the first zod issue", () => {
    const res = mockRes();
    const result = apiSchemas.leadCreate.safeParse({ company: "", contact_name: "", email: "x", niche: "" });
    if (result.success) throw new Error("expected failure");
    validationError(res, result.error);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "company must be at least 2 characters." });
  });

  it("falls back to a generic message when there are no issues", () => {
    const res = mockRes();
    // A ZodError with an empty issues array is near-impossible via safeParse;
    // build the narrow shape validationError consumes instead.
    const emptyIssueError = { issues: [] } as unknown as z.ZodError;
    validationError(res, emptyIssueError);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid input." });
  });
});
