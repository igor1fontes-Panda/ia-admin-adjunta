const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/+$/, "");
const jwksUrl = process.env.NEON_AUTH_JWKS_URL || (baseUrl ? `${baseUrl}/.well-known/jwks.json` : "");

if (!baseUrl || !jwksUrl) {
  throw new Error("Set NEON_AUTH_BASE_URL (and optionally NEON_AUTH_JWKS_URL) before running auth:smoke.");
}

const health = await fetch(`${baseUrl}/ok`, { redirect: "manual" });
if (!health.ok) {
  throw new Error(`Neon Managed Auth health endpoint returned ${health.status}.`);
}

const jwksResponse = await fetch(jwksUrl, { redirect: "manual" });
if (!jwksResponse.ok) {
  throw new Error(`Neon Managed Auth JWKS endpoint returned ${jwksResponse.status}.`);
}

const jwks = await jwksResponse.json();
if (!Array.isArray(jwks?.keys) || jwks.keys.length === 0) {
  throw new Error("Neon Managed Auth returned an empty or invalid JWKS document.");
}
if (!jwks.keys.some((key) => key.kty === "OKP" && key.crv === "Ed25519" && typeof key.kid === "string")) {
  throw new Error("Neon Managed Auth JWKS does not contain an Ed25519 signing key.");
}

console.log("[auth-smoke] Neon Managed Auth health and EdDSA JWKS checks passed.");
console.log("[auth-smoke] Read-only probe: no login, identity, session, or database data was changed.");
