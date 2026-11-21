// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { ADMIN_EMAIL } from "../../shared/admin";
import type { VercelRequest } from "../../api/lib/http";
import { getSessionUser } from "../../api/lib/http";

const authBaseUrl = "https://auth.example.test/neondb/auth";
const authOrigin = new URL(authBaseUrl).origin;
const jwksUrl = `${authBaseUrl}/.well-known/jwks.json`;
const keyId = "neon-auth-regression-key";
let privateKey: CryptoKey;
let jwks: { keys: Record<string, unknown>[] };

async function signedToken(
  options: {
    email?: string;
    issuer?: string;
    audience?: string;
    expiresAt?: number;
    signingKey?: CryptoKey;
  } = {},
) {
  const jwt = new SignJWT({ email: options.email ?? ADMIN_EMAIL, name: "Admin" })
    .setProtectedHeader({ alg: "EdDSA", kid: keyId })
    .setSubject("test-user-001")
    .setIssuer(options.issuer ?? authOrigin)
    .setAudience(options.audience ?? authOrigin)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? "5m");
  return jwt.sign(options.signingKey ?? privateKey);
}

function request(token?: string): VercelRequest {
  return {
    method: "GET",
    url: "/api/clients",
    query: {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

beforeAll(async () => {
  vi.stubEnv("NEON_AUTH_BASE_URL", authBaseUrl);
  vi.stubEnv("NEON_AUTH_JWKS_URL", jwksUrl);
  const keys = await generateKeyPair("EdDSA");
  privateKey = keys.privateKey;
  const publicJwk = await exportJWK(keys.publicKey);
  jwks = { keys: [{ ...publicJwk, kid: keyId, alg: "EdDSA", use: "sig" }] };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
        }),
    ),
  );
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Neon Managed Auth API session verification", () => {
  it("accepts a valid signed administrator session token", async () => {
    const token = await signedToken();
    await expect(getSessionUser(request(token))).resolves.toEqual({
      id: "test-user-001",
      email: ADMIN_EMAIL,
      name: "Admin",
    });
  });

  it("rejects a valid token for a non-administrator identity", async () => {
    const token = await signedToken({ email: "not-admin@example.test" });
    await expect(getSessionUser(request(token))).resolves.toBeNull();
  });

  it("rejects requests without a bearer token", async () => {
    await expect(getSessionUser(request())).resolves.toBeNull();
  });

  it("rejects invalid signatures", async () => {
    const other = await generateKeyPair("EdDSA");
    const token = await signedToken({ signingKey: other.privateKey });
    await expect(getSessionUser(request(token))).resolves.toBeNull();
  });

  it("rejects tokens with the wrong issuer or audience", async () => {
    const wrongIssuer = await signedToken({ issuer: "https://attacker.example.test" });
    const wrongAudience = await signedToken({ audience: "https://attacker.example.test" });
    await expect(getSessionUser(request(wrongIssuer))).resolves.toBeNull();
    await expect(getSessionUser(request(wrongAudience))).resolves.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signedToken({ expiresAt: Math.floor(Date.now() / 1000) - 30 });
    await expect(getSessionUser(request(token))).resolves.toBeNull();
  });
});
