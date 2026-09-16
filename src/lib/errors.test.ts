import { describe, expect, it } from "vitest";
import { AppError, SupabaseError, ValidationError, errorMessage } from "./errors";

describe("application errors", () => {
  it("preserves typed error identity and safe messages", () => {
    expect(new SupabaseError("offline")).toBeInstanceOf(AppError);
    expect(new ValidationError("invalid").code).toBe("VALIDATION_ERROR");
    expect(errorMessage(new Error("known"), "fallback")).toBe("known");
    expect(errorMessage({ message: "untrusted" }, "fallback")).toBe("fallback");
  });
});
