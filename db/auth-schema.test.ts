import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { account, session, user, verification } from "./auth-schema";

describe("Neon Better Auth schema mapping", () => {
  it("maps all four Better Auth tables to the existing neon_auth namespace", () => {
    for (const table of [user, account, session, verification]) {
      expect(getTableConfig(table).schema).toBe("neon_auth");
    }
    expect(getTableConfig(user).name).toBe("user");
    expect(getTableConfig(account).name).toBe("account");
    expect(getTableConfig(session).name).toBe("session");
    expect(getTableConfig(verification).name).toBe("verification");
  });

  it("matches the existing UUID identity keys and camelCase Neon columns", () => {
    const userConfig = getTableConfig(user);
    const accountConfig = getTableConfig(account);
    const sessionConfig = getTableConfig(session);
    const verificationConfig = getTableConfig(verification);

    expect(userConfig.columns.map((column) => column.name)).toEqual([
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
      "updatedAt",
      "role",
      "banned",
      "banReason",
      "banExpires",
    ]);
    expect(accountConfig.columns.map((column) => column.name)).toContain("providerId");
    expect(accountConfig.columns.find((column) => column.name === "id")?.getSQLType()).toBe("uuid");
    expect(sessionConfig.columns.find((column) => column.name === "userId")?.getSQLType()).toBe("uuid");
    expect(verificationConfig.columns.map((column) => column.name)).toContain("identifier");
  });

  it("preserves the existing unique email and session token indexes", () => {
    const userIndexes = getTableConfig(user).indexes.map((index) => index.config.name);
    const sessionIndexes = getTableConfig(session).indexes.map((index) => index.config.name);
    expect(userIndexes).toContain("user_email_key");
    expect(sessionIndexes).toContain("session_token_key");
  });
});
