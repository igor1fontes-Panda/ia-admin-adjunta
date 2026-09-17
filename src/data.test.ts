import { describe, expect, it, vi } from "vitest";
import { isLive, supabase } from "./lib/data";

// supabase-js's realtime module requires a WebSocket global when it detects
// Node. CI's Node may lack native WebSocket, so stub it before the import.
vi.hoisted(() => {
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    (globalThis as { WebSocket?: unknown }).WebSocket = class {};
  }
});

describe("data layer (public Supabase config)", () => {
  it("creates a client only when public configuration is available", () => {
    expect(isLive).toBe(supabase !== null);
  });
});
