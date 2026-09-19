import { beforeEach, describe, expect, it, vi } from "vitest";

// The Neon driver is mocked: queries never leave the process. Captured calls
// let the tests assert the exact SQL the shim builds, and the reply queue
// simulates server responses (including failures).
const { neonCaptures, neonReplies } = vi.hoisted(() => ({
  neonCaptures: [],
  neonReplies: [],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (text, params) => {
    neonCaptures.push({ text, params });
    const next = neonReplies.shift();
    if (next instanceof Error) throw next;
    return next ?? [];
  },
}));

// Keep the other SDK imports inert — no network, no key material.
vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => null }));

async function freshLib() {
  vi.resetModules();
  neonCaptures.length = 0;
  neonReplies.length = 0;
  return await import("./bot-lib.mjs");
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://user:secret@localhost:5432/neondb");
  vi.unstubAllEnvs; // keep other vars as-is; module state resets via resetModules
});

describe("bot-lib shim: SQL building (zero network)", () => {
  it("builds select with filters, order and limit as parameterized SQL", async () => {
    const lib = await freshLib();
    const { error } = await lib.supabase
      .from("leads")
      .select("id, company")
      .eq("status", "new")
      .eq("score", 80)
      .order("created_at", { ascending: false })
      .limit(5);

    expect(error).toBeNull();
    expect(neonCaptures).toHaveLength(1);
    expect(neonCaptures[0].text).toBe(
      'select id, company from leads where "status" = $1 and "score" = $2 order by "created_at" desc limit 5',
    );
    expect(neonCaptures[0].params).toEqual(["new", 80]);
  });

  it("serializes object params for jsonb columns and arrays pass through", async () => {
    const lib = await freshLib();
    await lib.supabase.from("agent_memory").select("*").eq("value", { bias: { linkedin: 4 } }).eq("tags", ["a", "b"]);

    expect(neonCaptures[0].params[0]).toBe(JSON.stringify({ bias: { linkedin: 4 } }));
    expect(neonCaptures[0].params[1]).toEqual(["a", "b"]);
  });

  it("builds multi-row insert with returning *", async () => {
    const lib = await freshLib();
    const { data, error } = await lib.supabase
      .from("leads")
      .insert([
        { company: "Acme", score: 91 },
        { company: "Globex", score: 42 },
      ]);

    expect(error).toBeNull();
    expect(neonCaptures[0].text).toBe(
      'insert into leads ("company", "score") values ($1, $2), ($3, $4) returning *',
    );
    expect(neonCaptures[0].params).toEqual(["Acme", 91, "Globex", 42]);
    expect(data).toEqual([]);
  });

  it("upserts agent_memory with the on-conflict learning clause", async () => {
    const lib = await freshLib();
    await lib.supabase.from("agent_memory").upsert({ agent: "lead_qualifier", key: "channel_bias", value: { x: 1 } });

    expect(neonCaptures[0].text).toContain('insert into agent_memory ("agent", "key", "value")');
    expect(neonCaptures[0].text).toContain(
      "on conflict (agent, key) do update set value = excluded.value, updated_at = excluded.updated_at",
    );
    expect(neonCaptures[0].text).toContain("returning *");
  });

  it("builds update with filters and returns rows", async () => {
    const lib = await freshLib();
    neonReplies.push([{ id: "l1", score: 95 }]);
    const { data, error } = await lib.supabase.from("leads").update({ score: 95 }).eq("id", "l1");

    expect(error).toBeNull();
    expect(neonCaptures[0].text).toBe('update leads set "score" = $1 where "id" = $2 returning *');
    expect(neonCaptures[0].params).toEqual([95, "l1"]);
    expect(data).toEqual([{ id: "l1", score: 95 }]);
  });

  it("resolves single/maybeSingle to an object instead of an array", async () => {
    const lib = await freshLib();
    neonReplies.push([{ id: "r1" }]);
    const single = await lib.supabase.from("leads").select("*").eq("id", "r1").single();
    expect(single.data).toEqual({ id: "r1" });

    neonReplies.push([]); // maybeSingle with no rows → null, no error
    const maybe = await lib.supabase.from("leads").select("*").eq("id", "gone").maybeSingle();
    expect(maybe.data).toBeNull();
    expect(maybe.error).toBeNull();
  });

  it("returns a clean no-op result for empty inserts without touching the driver", async () => {
    const lib = await freshLib();
    const { data, error } = await lib.supabase.from("leads").insert([]);
    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(neonCaptures).toHaveLength(0);
  });

  it("surfaces driver failures as { data: null, error } instead of throwing", async () => {
    const lib = await freshLib();
    neonReplies.push(new Error("password authentication failed for user"));
    const { data, error } = await lib.supabase.from("leads").select("*");
    expect(data).toBeNull();
    expect(error?.message).toContain("password authentication failed");
  });

  it("refuses to fabricate data when no store is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const lib = await freshLib();
    const { data, error } = await lib.supabase.from("leads").select("*");
    expect(data).toBeNull();
    expect(error?.message).toContain("No data store configured");
    expect(neonCaptures).toHaveLength(0);
  });
});

describe("bot-lib helpers", () => {
  it("parseJsonArray tolerates code fences and prose", async () => {
    const lib = await freshLib();
    expect(lib.parseJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(lib.parseJsonArray('Here you go: [1, 2, 3] hope it helps')).toEqual([1, 2, 3]);
    expect(lib.parseJsonArray("not json at all")).toBeNull();
    expect(lib.parseJsonArray("")).toBeNull();
  });

  it("parseJsonObject extracts objects, never arrays", async () => {
    const lib = await freshLib();
    expect(lib.parseJsonObject('{"bottleneck":"closing"}')).toEqual({ bottleneck: "closing" });
    expect(lib.parseJsonObject('noise [1,2] noise')).toBeNull();
  });

  it("diagnoseSupabaseError maps recurring failures to actionable fixes", async () => {
    const lib = await freshLib();
    expect(lib.diagnoseSupabaseError("password authentication failed")).toMatch(/POOLED connection string/);
    expect(lib.diagnoseSupabaseError('relation "leads" does not exist')).toMatch(/drizzle-kit push/);
    expect(lib.diagnoseSupabaseError("ENOTFOUND host")).toMatch(/network|URL/i);
    expect(lib.diagnoseSupabaseError("totally unknown failure")).toBeNull();
  });

  it("verifyBotReadiness is honest about missing AI providers and store health", async () => {
    const lib = await freshLib();

    const noModel = await lib.verifyBotReadiness();
    expect(noModel.ready).toBe(false);
    expect(noModel.message).toMatch(/approved AI provider/i);

    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const ready = await (async () => {
      vi.resetModules();
      neonCaptures.length = 0;
      neonReplies.length = 0;
      return await import("./bot-lib.mjs");
    })();
    const ok = await ready.verifyBotReadiness();
    expect(ok.ready).toBe(true);
    expect(ok.checks.neon).toBe(true); // neon-backed store reports healthy
    expect(ok.checks.model).toBe(true);

    // store health check failure → not ready, with the actionable diagnosis
    // (same module instance that has a model configured, so the store check is reached)
    neonReplies.push(new Error("could not find the table"));
    const bad = await ready.verifyBotReadiness();
    expect(bad.ready).toBe(false);
    expect(bad.message).toMatch(/table is missing/i);
  });
});
