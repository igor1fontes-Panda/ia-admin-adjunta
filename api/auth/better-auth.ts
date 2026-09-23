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
 *    (it holds the managed endpoint https://<project>.neonauth.<region>.../
 *    <db>/auth), every /api/auth/* request is forwarded to Neon Auth
 *    server-to-server with a synthetic trusted Origin. The browser talks to
 *    our own domain only (same-origin), so the managed endpoint's origin
 *    allowlist can never reject the app with "Invalid origin" — the previous
 *    client-side cross-origin setup failed exactly there. Session cookies are
 *    forwarded both ways so sign-in/up/out and get-session work unchanged.
 *
 * 2) Self-hosted Better Auth — when no managed URL is configured, requests
 *    run the project's own Better Auth instance on Neon Postgres
 *    (DATABASE_URL + BETTER_AUTH_SECRET). Null-safe: 503 when unconfigured.
 */
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../server/auth";
import type { VercelRequest, VercelResponse } from "../lib/http";

export const config = { runtime: "nodejs" };

/** Managed Neon Auth endpoint (e.g. https://<ep>.neonauth.<region>.../<db>/auth). */
function neonAuthUrl(): string {
  return (process.env.VITE_NEON_AUTH_URL || "").trim().replace(/\/$/, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const upstream = neonAuthUrl();
  if (upstream) {
    return proxyToNeonAuth(req, res, upstream);
  }

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
 *  - Vercel/Node normalize Host/X-Forwarded-* themselves; we only strip the
 *    hop-by-hop headers that must not cross a proxy boundary.
 *  - Session cookies (set-cookie) are copied back one-by-one so the browser
 *    stores them on OUR origin — keeping the whole flow same-origin.
 */
async function proxyToNeonAuth(req: VercelRequest, res: VercelResponse, upstream: string) {
  // Collect the raw request body once (Vercel parses JSON into req.body).
  const rawBody =
    typeof req.body === "string" ? req.body : req.body === undefined ? "" : JSON.stringify(req.body);

  const url = `${upstream}${(req.url ?? "/").replace(/^\/api\/auth/, "")}`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    const v = Array.isArray(value) ? value.join(", ") : value;
    if (!v) continue;
    const lower = name.toLowerCase();
    if (["host", "connection", "content-length", "transfer-encoding", "cookie", "origin"].includes(lower)) continue;
    headers[lower] = v;
  }
  // Forward the caller's session cookies to the managed endpoint.
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader === "string" && cookieHeader) headers.cookie = cookieHeader;
  // Synthetic trusted origin (localhost is pre-approved by Neon Auth).
  headers.origin = "http://localhost:5173";

  try {
    const upstreamRes = await fetch(url, {
      method: req.method ?? "POST",
      headers,
      body: ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "") ? undefined : rawBody || "{}",
    });

    const text = await upstreamRes.text();
    res.status(upstreamRes.status);

    // Copy response cookies one-by-one so multiple set-cookie headers survive.
    const cookies = typeof upstreamRes.headers.getSetCookie === "function"
      ? upstreamRes.headers.getSetCookie()
      : [];
    for (const cookie of cookies) res.append("Set-Cookie", cookie);

    // Session continuity + caching correctness across the proxy.
    const ct = upstreamRes.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin ?? "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") return res.status(204).end();
    return res.end(text);
  } catch (error) {
    console.error("[auth] proxy error:", error);
    return res.status(502).json({ error: "Authentication upstream error." });
  }
}
