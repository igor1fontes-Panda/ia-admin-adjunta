/**
 * Better Auth handler for serverless functions (Vercel-compatible).
 *
 * Mounted at /api/auth/better-auth and rewritten (see vercel.json) so every
 * auth endpoint works under the canonical /api/auth/* prefix:
 *   POST /api/auth/sign-in/email   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-out        GET  /api/auth/get-session
 *
 * TWO OPERATING MODES:
 *
 * 1) Managed Neon Auth proxy — when VITE_NEON_AUTH_URL is set on the SERVER
 *    (the managed endpoint https://<project>.neonauth.<region>.../<db>/auth),
 *    every /api/auth/* request is forwarded to Neon Auth server-to-server
 *    with a synthetic trusted Origin. The browser talks to our own domain
 *    only (same-origin), so the managed endpoint's origin allowlist can never
 *    reject the app with "Invalid origin" — the previous client-side
 *    cross-origin setup failed exactly there. Session cookies are forwarded
 *    both ways so sign-in/up/out and get-session work unchanged.
 *    This branch deliberately uses NO third-party imports (global fetch
 *    only): serverless bundlers trace every static import, and the heavier
 *    auth packages have export maps the tracer can miss — a missing traced
 *    file crashes the whole function at cold start.
 *
 * 2) Self-hosted Better Auth — when no managed URL is configured, requests
 *    run the project's own Better Auth instance on Neon Postgres
 *    (DATABASE_URL + BETTER_AUTH_SECRET), loaded lazily. Null-safe: 503
 *    when the database is not configured.
 */
import type { VercelRequest, VercelResponse } from "../lib/http";
import { ADMIN_EMAIL } from "../../shared/admin";

export const config = { runtime: "nodejs" };

/** Managed Neon Auth endpoint (e.g. https://<ep>.neonauth.<region>.../<db>/auth). */
function neonAuthUrl(): string {
  return (process.env.VITE_NEON_AUTH_URL || "").trim().replace(/\/$/, "");
}

function requestBody(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

/** Enforce the single-admin identity before requests reach either auth provider. */
export function enforceAdminIdentity(req: VercelRequest, res: VercelResponse): VercelResponse | null {
  let path = "/";
  try {
    path = new URL(req.url ?? "/", "http://localhost").pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return res.status(400).json({ error: "Invalid authentication route." });
  }

  const body = requestBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const isEmailSignUp = path.endsWith("/sign-up/email");
  const isEmailSignIn = path.endsWith("/sign-in/email");
  const isEmailRecovery =
    path.endsWith("/forget-password") ||
    path.endsWith("/send-verification-email") ||
    path.endsWith("/resend-verification-email");
  const isEmailChange = path.endsWith("/change-email") || path.endsWith("/update-user");
  const usesAlternateIdentity =
    typeof body.provider === "string" || typeof body.username === "string" || typeof body.phoneNumber === "string";

  // This is an email/password-only administrator account. Apply the body
  // allowlist even if an upstream rewrite changes the visible request path.
  if (usesAlternateIdentity || (email && email !== ADMIN_EMAIL) || (newEmail && newEmail !== ADMIN_EMAIL)) {
    return res.status(403).json({ error: "This application is restricted to its authorized administrator." });
  }

  // Do not expose alternative identity providers or signup methods.
  if ((path.includes("/sign-up/") && !isEmailSignUp) || (path.includes("/sign-in/") && !isEmailSignIn)) {
    return res.status(403).json({ error: "Only the authorized administrator can access this application." });
  }

  if ((isEmailSignUp || isEmailSignIn || isEmailRecovery) && email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "This application is restricted to its authorized administrator." });
  }

  if (isEmailChange && ((email && email !== ADMIN_EMAIL) || (newEmail && newEmail !== ADMIN_EMAIL))) {
    return res.status(403).json({ error: "The administrator email address cannot be changed here." });
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const denied = enforceAdminIdentity(req, res);
  if (denied) return denied;

  const upstream = neonAuthUrl();
  if (upstream) {
    return proxyToNeonAuth(req, res, upstream);
  }

  // Self-hosted mode: load the auth stack lazily so this function only pays
  // for it when it actually runs (and bundlers don't trace it in proxy mode).
  // Keep the .ts extension explicit: Node 24 ESM does not infer source extensions in the deployed function bundle.
  const [{ auth }, { toNodeHandler }] = await Promise.all([import("../../server/auth.ts"), import("better-auth/node")]);
  if (!auth) {
    return res.status(503).json({
      error:
        "Authentication is unavailable: set DATABASE_URL (Neon pooled connection) and BETTER_AUTH_SECRET, then redeploy.",
    });
  }
  try {
    return await toNodeHandler(auth)(req as never, res as never);
  } catch (error) {
    console.error("[auth] handler error:", error);
    return res.status(500).json({ error: "Authentication service error." });
  }
}

/**
 * Server-to-server proxy to managed Neon Auth. Trust model:
 *  - The managed endpoint pre-approves localhost origins; we identify as the
 *    project's own dev origin ("http://localhost:5173") server-side.
 *  - Hop-by-hop headers and the browser's Origin/Cookie are stripped; session
 *    cookies are forwarded explicitly so sessions survive the proxy hop.
 *  - Response set-cookie headers are copied back one-by-one so the browser
 *    stores them on OUR origin — keeping the whole flow same-origin.
 */
function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Only accept browser requests originating from this deployment's configured site origins. */
function isTrustedOrigin(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (
    parsed.origin !== value ||
    !["https:", ...(process.env.NODE_ENV === "development" ? ["http:"] : [])].includes(parsed.protocol)
  ) {
    return false;
  }

  const configured = [
    process.env.BETTER_AUTH_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.V0_RUNTIME_URL,
  ];
  if (process.env.NODE_ENV === "development") {
    configured.push("http://localhost:3000", "http://localhost:5173");
  }

  const allowed = new Set<string>();
  for (const candidate of configured) {
    if (!candidate) continue;
    try {
      allowed.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed optional environment values.
    }
  }
  return allowed.has(parsed.origin);
}

async function proxyToNeonAuth(req: VercelRequest, res: VercelResponse, upstream: string) {
  const method = (req.method ?? "POST").toUpperCase();
  if (method === "OPTIONS") {
    // No cross-origin access is needed: the SPA calls this same-origin endpoint.
    return res.status(204).end();
  }
  if (!["GET", "HEAD", "POST"].includes(method)) {
    res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const origin = headerValue(req.headers?.origin);
  if ((origin && !isTrustedOrigin(origin)) || (!origin && !["GET", "HEAD"].includes(method))) {
    return res.status(403).json({ error: "Untrusted request origin." });
  }

  // Collect the raw request body once (Vercel parses JSON into req.body).
  const rawBody = typeof req.body === "string" ? req.body : req.body === undefined ? "" : JSON.stringify(req.body);
  const url = `${upstream}${(req.url ?? "/").replace(/^\/api\/auth/, "")}`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Hop-by-hop + host-identity headers. The upstream receives its own trusted
  // Origin only after the caller's browser Origin has passed our allowlist.
  const stripped = [
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "cookie",
    "origin",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-port",
    "forwarded",
    "x-real-ip",
  ];
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    const v = Array.isArray(value) ? value.join(", ") : value;
    if (!v) continue;
    const lower = name.toLowerCase();
    if (stripped.includes(lower)) continue;
    headers[lower] = v;
  }
  const cookieHeader = headerValue(req.headers?.cookie);
  if (cookieHeader) headers.cookie = cookieHeader;
  headers.origin = "http://localhost:5173";

  try {
    const upstreamRes = await fetch(url, {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : rawBody || "{}",
    });
    const text = await upstreamRes.text();
    res.status(upstreamRes.status);
    const cookies = typeof upstreamRes.headers.getSetCookie === "function" ? upstreamRes.headers.getSetCookie() : [];
    for (const cookie of cookies) res.append("Set-Cookie", cookie);
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    return res.end(text);
  } catch (error) {
    console.error("[auth] proxy error:", error);
    return res.status(502).json({ error: "Authentication upstream error." });
  }
}
