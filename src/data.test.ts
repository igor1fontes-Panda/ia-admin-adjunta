import { describe, expect, it } from "vitest";
import { isLive, supabase } from "./lib/data";

/**
 * The production static build cannot inline VITE_* env vars, so the public
 * Supabase config (URL + publishable key, both public-by-design under RLS)
 * is baked into src/lib/data.ts as defaults. This test locks that in: the
 * data layer must ALWAYS be live — the setup checklist must never appear
 * because of missing config.
 */
describe("data layer (public Supabase config)", () => {
  it("is always live thanks to the baked-in public config", () => {
    expect(isLive).toBe(true);
    expect(supabase).not.toBeNull();
  });
});
