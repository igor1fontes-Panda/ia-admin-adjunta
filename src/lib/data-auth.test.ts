import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.hoisted(() => vi.fn());
vi.mock("./auth-client", () => ({ getSessionToken }));

import { fetchClients } from "./data";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  getSessionToken.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("business API authentication forwarding", () => {
  it("forwards the current Neon session JWT as a Bearer token", async () => {
    getSessionToken.mockResolvedValue("signed-neon-session-token");
    await expect(fetchClients()).resolves.toEqual([]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({ Authorization: "Bearer signed-neon-session-token" });
  });

  it("does not fabricate an authorization header when no admin session exists", async () => {
    getSessionToken.mockResolvedValue(null);
    await expect(fetchClients()).resolves.toEqual([]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("does not silently grant a token when session lookup fails", async () => {
    getSessionToken.mockRejectedValue(new Error("session unavailable"));
    await expect(fetchClients()).resolves.toEqual([]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("Authorization");
  });
});
