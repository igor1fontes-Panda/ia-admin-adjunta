import { describe, expect, it } from "vitest";
import { ShimQuery, supabase } from "./bot-lib.mjs";

describe("Neon-compatible bot query shim", () => {
  it("builds a fluent query without contacting a service", async () => {
    const query = supabase
      .from("leads")
      .select("id,status")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5);

    expect(query).toBeInstanceOf(ShimQuery);
    expect(query._table).toBe("leads");
    expect(query._filters).toEqual([["status", "new"]]);
    expect(query._orderBy).toBe("created_at");
    expect(query._limit).toBe(5);
  });

  it("supports insert payload construction without network access", () => {
    const query = new ShimQuery("activity_log").insert({ kind: "test", message: "offline" });
    expect(query._mode).toBe("insert");
    expect(query._payload).toEqual({ kind: "test", message: "offline" });
  });
});
