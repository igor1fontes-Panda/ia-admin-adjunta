import { describe, expect, it } from "vitest";
import { isOrderAmountConsistent, isPackAmountValid, isValidSiteUrl } from "./delivery-qa.mjs";

describe("delivery QA validation", () => {
  it("treats a missing or invalid site URL as unknown", () => {
    expect(isValidSiteUrl("")).toBe(false);
    expect(isValidSiteUrl("not-a-url")).toBe(false);
    expect(isValidSiteUrl("https://admin.example.com")).toBe(true);
  });

  it("accepts only known pack tiers and their valid amount bands", () => {
    expect(isPackAmountValid("starter", 2915.99)).toBe(true);
    expect(isPackAmountValid("professional", 2916)).toBe(true);
    expect(isPackAmountValid("enterprise", 8333)).toBe(true);
    expect(isPackAmountValid("unknown", 1000)).toBe(false);
    expect(isPackAmountValid("enterprise", 8000)).toBe(false);
    expect(isPackAmountValid("starter", 0)).toBe(false);
  });

  it("requires the registered delivery amount to match the paid order", () => {
    expect(isOrderAmountConsistent("2916.00", 2916)).toBe(true);
    expect(isOrderAmountConsistent(2916, 2915.99)).toBe(false);
    expect(isOrderAmountConsistent("invalid", 2916)).toBe(false);
  });
});
