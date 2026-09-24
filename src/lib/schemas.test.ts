import { describe, expect, it } from "vitest";
import {
  clientInputSchema,
  firstIssue,
  leadInputSchema,
  orderInputSchema,
  parseClientForm,
  parseOrderForm,
} from "./schemas";

const VALID_LEAD = { company: "Acme Lda", contact_name: "Maria Silva", email: "maria@acme.com", niche: "SaaS" };
const VALID_CLIENT = { name: "Globex", email: "billing@globex.com", plan: "professional" as const };
const VALID_ORDER = { client_id: "c1", client_name: "Globex", amount: 29160, method: "multicaixa" as const };

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.append(k, v);
  return form;
}

describe("leadInputSchema", () => {
  it("accepts a valid lead payload unchanged", () => {
    expect(leadInputSchema.parse(VALID_LEAD)).toEqual(VALID_LEAD);
  });

  it("rejects empty company / short contact", () => {
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, company: " " }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, contact_name: "A" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, email: "not-an-email" }).success).toBe(false);
  });
});

describe("clientInputSchema", () => {
  it("accepts a valid client payload", () => {
    expect(clientInputSchema.parse(VALID_CLIENT)).toEqual(VALID_CLIENT);
  });

  it("rejects an unknown plan", () => {
    expect(clientInputSchema.safeParse({ ...VALID_CLIENT, plan: "gold" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(clientInputSchema.safeParse({ ...VALID_CLIENT, email: "nope" }).success).toBe(false);
  });
});

describe("orderInputSchema", () => {
  it("accepts a valid order payload", () => {
    expect(orderInputSchema.parse(VALID_ORDER)).toEqual(VALID_ORDER);
  });

  it("accepts a walk-in order with null client_id", () => {
    const walkIn = { ...VALID_ORDER, client_id: null, client_name: "Walk-in" };
    expect(orderInputSchema.parse(walkIn)).toEqual(walkIn);
  });

  it("rejects amounts below the 1.000 Kz minimum and non-integers", () => {
    expect(orderInputSchema.safeParse({ ...VALID_ORDER, amount: 999 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...VALID_ORDER, amount: 100.5 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...VALID_ORDER, amount: Number.NaN }).success).toBe(false);
  });

  it("rejects an unknown payment method", () => {
    expect(orderInputSchema.safeParse({ ...VALID_ORDER, method: "bitcoin" }).success).toBe(false);
  });
});

describe("FormData adapters", () => {
  it("parseClientForm passes a valid form through unchanged", () => {
    const input = parseClientForm(fd({ name: "Globex", email: "billing@globex.com", plan: "enterprise" }));
    expect(input).toEqual({ name: "Globex", email: "billing@globex.com", plan: "enterprise" });
  });

  it("parseClientForm throws a readable error on a bad email", () => {
    expect(() => parseClientForm(fd({ name: "Globex", email: "bad", plan: "starter" }))).toThrow(/valid billing email/i);
  });

  it("parseOrderForm maps an empty client_id to null (walk-in)", () => {
    const input = parseOrderForm(fd({ client_id: "", client_name: "", amount: "12500", method: "paypay" }));
    expect(input.client_id).toBeNull();
    expect(input.amount).toBe(12500);
  });

  it("parseOrderForm throws a readable error on a missing/invalid amount", () => {
    expect(() => parseOrderForm(fd({ client_id: "c1", client_name: "Globex", amount: "", method: "card" }))).toThrow(/number/i);
    expect(() => parseOrderForm(fd({ client_id: "c1", client_name: "Globex", amount: "10", method: "card" }))).toThrow(/1\.000 Kz/);
  });

  it("parseOrderForm throws on an unknown method value", () => {
    expect(() => parseOrderForm(fd({ client_id: "c1", client_name: "Globex", amount: "29160", method: "crypto" }))).toThrow(/payment method/i);
  });
});

describe("firstIssue", () => {
  it("returns the first human-readable message from a ZodError", () => {
    const result = clientInputSchema.safeParse({ name: "", email: "bad", plan: "starter" });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstIssue(result.error)).toMatch(/client name/i);
  });
});
