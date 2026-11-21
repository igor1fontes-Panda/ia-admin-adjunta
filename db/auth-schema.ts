/**
 * Canonical Better Auth schema mapped to the existing Neon identity schema.
 * This file defines mappings only; it does not create or migrate database rows.
 */
import { boolean, index, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const neonAuth = pgSchema("neon_auth");

export const user = neonAuth.table(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
    role: text("role"),
    banned: boolean("banned"),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", { withTimezone: true }),
  },
  (t) => [uniqueIndex("user_email_key").on(t.email)],
);

export const session = neonAuth.table(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonatedBy"),
    activeOrganizationId: text("activeOrganizationId"),
  },
  (t) => [uniqueIndex("session_token_key").on(t.token), index("session_userId_idx").on(t.userId)],
);

export const account = neonAuth.table(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = neonAuth.table(
  "verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const authSchema = { user, session, account, verification };
