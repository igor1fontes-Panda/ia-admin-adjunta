import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// These tests exercise the self-hosted Better Auth flow. Force the additive
// Clerk bridge OFF and the managed Neon Auth override OFF so this file is
// deterministic even when a local .env.local contains those keys (Vitest
// loads them via Vite envPrefix). Modules are imported dynamically AFTER the
// env stub so their import-time constants are evaluated in the stubbed env.
vi.mock("./lib/clerk-bridge", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./lib/clerk-bridge")>();
  return { ...mod, CLERK_ENABLED: false, getClerkToken: async () => "" };
});

type AuthClientModule = typeof import("./lib/auth-client");
type AuthModule = typeof import("./views/Auth");
let AUTH_BASE: AuthClientModule["AUTH_BASE"];
let Auth: AuthModule["Auth"];

beforeAll(async () => {
  vi.stubEnv("VITE_NEON_AUTH_URL", "");
  ({ AUTH_BASE } = await import("./lib/auth-client"));
  ({ Auth } = await import("./views/Auth"));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

import { PreferencesProvider } from "./lib/i18n";

// Contract tests for the self-hosted Neon + Better Auth flow:
//  - auth calls target the app's same-origin AUTH_BASE (cookie based)
//  - EMAIL_NOT_VERIFIED must surface the verification panel, not an error wall
//  - navigation only happens on a real session
vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.includes("/sign-in/email") && method === "POST") {
    return new Response(JSON.stringify({ message: "EMAIL_NOT_VERIFIED" }), { status: 401 });
  }
  if (url.includes("/sign-up/email") && method === "POST") {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (url.includes("/send-verification-email") && method === "POST") {
    return new Response(JSON.stringify({ status: true }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: `unexpected ${method} ${url}` }), { status: 404 });
}));

function renderAuth() {
  return render(
    <PreferencesProvider>
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<div>dashboard-reached</div>} />
        </Routes>
      </MemoryRouter>
    </PreferencesProvider>,
  );
}

async function submitCredentials(email = "ana@acme.test", password = "password123") {
  const { userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("you@company.com"), email);
  await user.type(screen.getByPlaceholderText("••••••••"), password);
  await user.click(screen.getByRole("button", { name: /entrar/i }));
  return user;
}

describe("auth flow (self-hosted Neon + Better Auth)", () => {
  afterEach(cleanup);

  it("targets the managed Neon Auth base URL with cookie credentials", async () => {
    expect(AUTH_BASE).toBe("/api/auth");
    renderAuth();
    await submitCredentials();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    const call = vi.mocked(fetch).mock.calls[0];
    expect(String(call?.[0])).toBe(`${AUTH_BASE}/sign-in/email`);
    expect((call?.[1] as RequestInit).credentials).toBe("include");
  });

  it("shows the verification panel (not an error) when the account is unverified", async () => {
    renderAuth();
    await submitCredentials();
    expect(await screen.findByText(/Verifica o teu email/i)).toBeInTheDocument();
    expect(await screen.findByText(/ana@acme\.test/)).toBeInTheDocument();
    // Panel replaces navigation — dashboard is never reached unverified.
    expect(screen.queryByText("dashboard-reached")).not.toBeInTheDocument();
  });

  it("resends the verification email from the panel", async () => {
    renderAuth();
    await submitCredentials();
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /reenviar/i }));
    expect(await screen.findByText(/Email reenviado/i)).toBeInTheDocument();
    const resendCall = vi.mocked(fetch).mock.calls.find((c) => String(c[0]).includes("/send-verification-email"));
    expect(resendCall).toBeTruthy();
    expect((resendCall?.[1] as RequestInit).method).toBe("POST");
  });

  it("navigates to the dashboard after a verified sign-in", async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => new Response(JSON.stringify({}), { status: 200 }));
    renderAuth();
    await submitCredentials();
    await waitFor(() => expect(screen.getByText("dashboard-reached")).toBeInTheDocument());
    cleanup();
  });
});
