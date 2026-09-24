/**
 * E2E verification: real API handlers + real Neon + real SPA build.
 * Self-terminating; prints one line per probe and a final PASS/FAIL.
 */
import http from "node:http";

const PORT = 4399;
process.env.PORT = String(PORT); // dev-server reads this on import
const BASE = `http://127.0.0.1:${PORT}`;
await import("./dev-server.mjs");

// dev-server listens on import; wait for readiness
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("server did not start")), 15000);
  const probe = async () => {
    try {
      await fetch(`${BASE}/`);
      clearTimeout(t);
      resolve();
    } catch {
      setTimeout(probe, 150);
    }
  };
  probe();
});

const results = [];
async function check(name, fn) {
  try {
    results.push([name, await fn(), null]);
  } catch (e) {
    results.push([name, null, e.message]);
  }
}

async function hit(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

// 1. SPA served
await check("SPA index served (200 HTML)", async () => {
  const r = await fetch(`${BASE}/`);
  const html = await r.text();
  if (r.status !== 200 || !html.includes('<div id="root">')) throw new Error(`status ${r.status}`);
  return r.status;
});

// 2. /api/health = 200 OK (the acceptance gate)
await check("/api/health → 200 OK with connected database", async () => {
  const r = await hit("/api/health");
  if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  if (!r.body?.ok || !r.body?.database?.connected) throw new Error(JSON.stringify(r.body));
  return "200 ok=true connected=true";
});

// 3. Public lead capture (the real write path, server-forced defaults)
const email = `e2e-${Date.now()}@test.invalid`;
await check("POST /api/leads (public) → 201 row with forced defaults", async () => {
  const r = await hit("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: "E2E Verify Co", contact_name: "Gauntlet", email, niche: "SaaS" }),
  });
  if (r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
  if (r.body?.status !== "new" || r.body?.score > 60) throw new Error("server defaults not enforced");
  return `201 id=${String(r.body?.id).slice(0, 8)}… status=${r.body?.status} score=${r.body?.score}`;
});

// 4. Unauthenticated reads stay protected
await check("GET /api/leads without session → 401", async () => {
  const r = await hit("/api/leads");
  if (r.status !== 401) throw new Error(`status ${r.status}`);
  return 401;
});

// 5. Better Auth handler alive on this app (self-hosted mode reachable even if unused)
await check("GET /api/auth/get-session → auth handler responds", async () => {
  const r = await hit("/api/auth/get-session");
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  return `200 session=${JSON.stringify(r.body)}`;
});

let failed = 0;
console.log("");
for (const [name, ok, err] of results) {
  if (ok === null) {
    failed++;
    console.log(`❌ ${name}\n   ↳ ${err}`);
  } else console.log(`✅ ${name} → ${ok}`);
}
console.log(
  failed === 0 ? "\nGAUNTLET PASS — full stack verified end-to-end." : `\nGAUNTLET FAIL — ${failed} probe(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
