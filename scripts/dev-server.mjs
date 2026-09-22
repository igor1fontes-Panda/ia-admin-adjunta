/**
 * Local full-stack preview server (dev/verification only — production runs on
 * Vercel with vercel.json rewrites).
 *
 * Serves the BUILT SPA from dist/ AND executes the real Vercel handlers from
 * api/ through a minimal req/res adapter, so /api/health, /api/leads and the
 * whole data layer are testable locally without the Vercel platform:
 *
 *   DATABASE_URL='postgres://…' PORT=4173 bun scripts/dev-server.mjs
 * (Run with Bun: it executes the TS handlers directly and resolves the
 *  directory imports the Vercel bundler allows, e.g. `../db`.)
 *
 * Routing mirrors vercel.json:
 *   /api/auth/(.*) → api/auth/better-auth.ts (original URL preserved —
 *                    Better Auth routes on req.url)
 *   /api/<name>    → api/<name>.ts
 *   everything else→ dist/ static files, falling back to dist/index.html
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIST = path.resolve(process.cwd(), "dist");
const PORT = Number(process.env.PORT) || 4173;

const HANDLERS = {
  "/api/health": () => import("../api/health.ts"),
  "/api/leads": () => import("../api/leads.ts"),
  "/api/clients": () => import("../api/clients.ts"),
  "/api/orders": () => import("../api/orders.ts"),
  "/api/activity": () => import("../api/activity.ts"),
  "/api/deliveries": () => import("../api/deliveries.ts"),
  "/api/agents": () => import("../api/agents.ts"),
};
const AUTH_TARGET = () => import("../api/auth/better-auth.ts");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function adapt(res) {
  // Vercel's shimmed res has .status()/.json(); raw Node ServerResponse does not.
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (payload) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify(payload));
  };
  return res;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      const ct = req.headers["content-type"] ?? "";
      if (ct.includes("application/json")) {
        try { resolve(JSON.parse(data || "{}")); } catch { resolve(data); }
      } else resolve(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname.startsWith("/api/")) {
      req.query = Object.fromEntries(url.searchParams);
      req.headers = req.headers;
      if (req.method !== "GET" && req.method !== "HEAD") req.body = await parseBody(req);

      let mod;
      if (pathname.startsWith("/api/auth/")) {
        req.url = pathname + url.search; // Better Auth routes on the original path
        mod = await AUTH_TARGET();
      } else {
        const key = Object.keys(HANDLERS).find((k) => pathname === k || pathname.startsWith(`${k}/`));
        if (!key) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: `No handler for ${pathname}` }));
        }
        mod = await HANDLERS[key]();
      }
      return await mod.default(req, adapt(res));
    }

    // Static SPA
    const rel = pathname === "/" ? "/index.html" : pathname;
    let file = path.join(DIST, rel);
    if (!file.startsWith(DIST)) file = path.join(DIST, "index.html"); // traversal guard
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, "index.html"); // SPA fallback (mirrors vercel.json rewrite)
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    console.error("[dev-server]", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "server error" }));
    }
  }
});

if (!process.env.DATABASE_URL) {
  console.error("[dev-server] DATABASE_URL is not set — API routes will answer 503 (handlers stay null-safe).");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev-server] SPA + real Vercel handlers on http://localhost:${PORT}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
