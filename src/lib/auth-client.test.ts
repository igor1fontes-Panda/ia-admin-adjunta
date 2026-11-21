import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_EMAIL } from "../../shared/admin";

const sdk = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  createdArgs: [] as unknown[][],
  adapterArgs: [] as unknown[][],
  client: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
    useSession: vi.fn(),
  },
}));

vi.mock("@neon/auth", () => ({ createAuthClient: sdk.createAuthClient }));
vi.mock("@neon/auth/react/adapters", () => ({
  BetterAuthReactAdapter: (...args: unknown[]) => {
    sdk.adapterArgs.push(args);
    return () => ({ adapter: "react" });
  },
}));

let auth: typeof import("./auth-client");

beforeAll(async () => {
  vi.stubEnv("NEON_VITE_NEON_AUTH_URL", "https://auth.example.test/neondb/auth");
  sdk.createAuthClient.mockImplementation((...args: unknown[]) => {
    sdk.createdArgs.push(args);
    return sdk.client;
  });
  auth = await import("./auth-client");
});

afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  sdk.client.getSession.mockReset();
  sdk.client.signIn.email.mockReset();
  sdk.client.signOut.mockReset();
});

describe("Neon Managed Auth client", () => {
  it("initializes the official SDK with the React adapter and cross-origin credentials", () => {
    expect(sdk.adapterArgs[0]).toEqual([{ fetchOptions: { credentials: "include" } }]);
    expect(auth.authClient).toBe(sdk.client);
    expect(sdk.createdArgs[0]).toEqual(["https://auth.example.test/neondb/auth", { adapter: expect.any(Function) }]);
  });

  it("signs in the allowlisted administrator and confirms the resulting session", async () => {
    sdk.client.signIn.email.mockResolvedValue({ data: {}, error: null });
    sdk.client.getSession.mockResolvedValue({
      data: { user: { email: ADMIN_EMAIL }, session: { token: "signed-session-token" } },
      error: null,
    });

    await expect(auth.signInAdmin(ADMIN_EMAIL, "test-password")).resolves.toMatchObject({
      user: { email: ADMIN_EMAIL },
    });
    expect(sdk.client.signIn.email).toHaveBeenCalledWith({ email: ADMIN_EMAIL, password: "test-password" });
    expect(sdk.client.getSession).toHaveBeenCalledTimes(1);
  });

  it("surfaces invalid credentials returned by Neon Auth", async () => {
    sdk.client.signIn.email.mockResolvedValue({ data: null, error: { message: "Invalid credentials" } });
    await expect(auth.signInAdmin(ADMIN_EMAIL, "wrong-password")).rejects.toThrow("Invalid credentials");
    expect(sdk.client.getSession).not.toHaveBeenCalled();
  });

  it("does not attempt login for an email outside the administrator allowlist", async () => {
    await expect(auth.signInAdmin("other@example.test", "password")).rejects.toThrow(/identidade|administra/i);
    expect(sdk.client.signIn.email).not.toHaveBeenCalled();
  });

  it("ends a session if the authenticated identity is not the administrator", async () => {
    sdk.client.signIn.email.mockResolvedValue({ data: {}, error: null });
    sdk.client.getSession.mockResolvedValue({
      data: { user: { email: "other@example.test" }, session: { token: "other-token" } },
      error: null,
    });
    sdk.client.signOut.mockResolvedValue({ error: null });

    await expect(auth.signInAdmin(ADMIN_EMAIL, "test-password")).rejects.toThrow(/identidade|administra/i);
    expect(sdk.client.signOut).toHaveBeenCalledTimes(1);
  });

  it("returns the current session JWT for authenticated API requests", async () => {
    sdk.client.getSession.mockResolvedValue({
      data: { user: { email: ADMIN_EMAIL }, session: { token: "api-bearer-token" } },
      error: null,
    });
    await expect(auth.getSessionToken()).resolves.toBe("api-bearer-token");
  });

  it("surfaces SDK session lookup failures instead of silently granting access", async () => {
    sdk.client.getSession.mockResolvedValue({ data: null, error: { message: "session unavailable" } });
    await expect(auth.getSessionToken()).rejects.toThrow("session unavailable");
  });

  it("signs out through Neon Managed Auth", async () => {
    sdk.client.signOut.mockResolvedValue({ error: null });
    await expect(auth.signOutAdmin()).resolves.toBeUndefined();
    expect(sdk.client.signOut).toHaveBeenCalledTimes(1);
  });

  it("surfaces logout failures", async () => {
    sdk.client.signOut.mockResolvedValue({ error: { message: "logout failed" } });
    await expect(auth.signOutAdmin()).rejects.toThrow("logout failed");
  });
});
