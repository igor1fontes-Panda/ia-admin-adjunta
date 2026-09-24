import { describe, expect, it, vi } from "vitest";
import { isLive, submitLead } from "./lib/data";

// The browser data layer talks to /api/* only. The public surface must stay
// hard-limited: the ONLY unauthenticated mutation is the landing-page lead form.
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/leads") && method === "POST") {
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
    return new Response(JSON.stringify({ error: `unexpected ${method} ${url}` }), { status: 404 });
  }),
);

describe("data layer (API-backed)", () => {
  it("exposes the live API flag (no demo mode)", () => {
    expect(isLive).toBe(true);
  });

  it("submits the public lead form via POST /api/leads with credentials", async () => {
    await expect(
      submitLead({ company: "Acme", contact_name: "Ana", email: "ana@acme.test", niche: "SaaS" }),
    ).resolves.toBeUndefined();
    const call = vi.mocked(fetch).mock.calls[vi.mocked(fetch).mock.calls.length - 1];
    expect(String(call?.[0])).toContain("/api/leads");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.credentials as string).toBe("include");
  });

  it("surfaces API error messages to the caller", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Validation failed." }), { status: 400 }),
    );
    await expect(submitLead({ company: "Acme", contact_name: "Ana", email: "bad", niche: "SaaS" })).rejects.toThrow(
      "Validation failed.",
    );
  });
});
