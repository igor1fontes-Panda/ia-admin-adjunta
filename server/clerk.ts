/**
 * Additive Clerk backend verification.
 *
 * When CLERK_SECRET_KEY is configured, API routes can authenticate requests
 * carrying a Clerk session JWT (Authorization: Bearer …, attached by
 * src/lib/data.ts). The primary Better Auth session flow is untouched — this
 * is only a fallback identity source when no Better Auth session exists.
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { VercelRequest } from "../api/lib/http";

const secretKey = process.env.CLERK_SECRET_KEY ?? "";
export const isClerkConfigured = secretKey.startsWith("sk_");

const clerk = isClerkConfigured
  ? createClerkClient({ secretKey })
  : null;

export type ClerkUser = { id: string; email: string; name: string };

/** Extracts a Bearer token from the request, if any. */
function bearerToken(req: VercelRequest): string {
  const h = req.headers?.authorization;
  const value = Array.isArray(h) ? h[0] : h;
  if (!value) return "";
  const [scheme, token] = value.split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}

/**
 * Verifies a Clerk session token on the request and resolves the user.
 * Returns null when Clerk is not configured, no token is present, or the
 * token is invalid — callers then keep their existing behavior.
 */
export async function verifyClerkUser(req: VercelRequest): Promise<ClerkUser | null> {
  if (!clerk) return null;
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    const sub = (payload as { sub?: string }).sub;
    if (!sub) return null;
    const user = await clerk.users.getUser(sub);
    const primaryEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
      ?? user.emailAddresses[0]?.emailAddress
      ?? "";
    return { id: user.id, email: primaryEmail, name: [user.firstName, user.lastName].filter(Boolean).join(" ") };
  } catch {
    return null;
  }
}
