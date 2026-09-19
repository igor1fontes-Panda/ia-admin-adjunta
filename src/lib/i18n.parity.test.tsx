import { describe, expect, it } from "vitest";
import { lookup } from "./i18n";
import { en } from "./i18n/en";
import { pt } from "./i18n/pt";

/** Recursively flatten a dictionary to "dot.path" → leaf value. */
function flatten(node: unknown, prefix = "", out: Map<string, unknown> = new Map()): Map<string, unknown> {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, node);
  }
  return out;
}

describe("i18n dictionary parity", () => {
  const ptKeys = flatten(pt);
  const enKeys = flatten(en);

  it("en defines exactly the same key set as pt (the source of truth)", () => {
    const missingInEn = [...ptKeys.keys()].filter((k) => !enKeys.has(k));
    const extraInEn = [...enKeys.keys()].filter((k) => !ptKeys.has(k));
    expect(missingInEn, "keys present in pt but missing in en").toEqual([]);
    expect(extraInEn, "keys present in en but not in pt").toEqual([]);
    expect(ptKeys.size).toBeGreaterThan(100);
  });

  it("keeps the same leaf shapes (strings stay strings, arrays keep length)", () => {
    for (const [key, value] of ptKeys) {
      const mirror = enKeys.get(key);
      expect(mirror, `en is missing ${key}`).toBeDefined();
      if (typeof value === "string") expect(typeof mirror).toBe("string");
      if (typeof value === "number") expect(typeof mirror).toBe("number");
      if (Array.isArray(value)) expect(Array.isArray(mirror) && (mirror as unknown[]).length, `array length mismatch at ${key}`).toBe(value.length);
    }
  });

  it("resolves paths through lookup with pt fallback for every key", () => {
    for (const key of ptKeys.keys()) {
      expect(typeof lookup("en", key)).not.toBe("undefined");
      expect(typeof lookup("pt", key)).not.toBe("undefined");
    }
  });

  it("stores only translatable leaves (strings, numbers, string arrays)", () => {
    const isFlat = (v: unknown) => typeof v === "string" || typeof v === "number";
    for (const [key, value] of ptKeys) {
      const ok =
        isFlat(value) ||
        (Array.isArray(value) && value.every((v) => isFlat(v) || (Array.isArray(v) && v.every(isFlat))));
      expect(ok, `unexpected leaf shape at ${key}`).toBe(true);
    }
  });
});

// Keeps a runtime anchor that the flatten helper only sees plain data.
const _typeCheck: Record<string, string | number> = { sample: "ok" };
void _typeCheck;
