import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "./lib/i18n";

type AuthClientModule = typeof import("./lib/auth-client");
type AuthModule = typeof import("./views/Auth");
let AUTH_BASE: AuthClientModule["AUTH_BASE"];
let Auth: AuthModule["Auth"];

beforeAll(async () => {
  ({ AUTH_BASE } = await import("./lib/auth-client"));
  ({ Auth } = await import("./views/Auth"));
});

afterAll(() => vi.unstubAllGlobals());

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function renderAuth(initialPath = "/auth") {
  return render(
    <PreferencesProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<div>dashboard-reached</div>} />
        </Routes>
      </MemoryRouter>
    </PreferencesProvider>,
  );
}

async function submitCredentials(password = "password123") {
  const user = userEvent.setup();
  expect(screen.getByLabelText("Authorized administrator email")).toHaveValue("igor1fontes@gmail.com");
  await user.type(screen.getByPlaceholderText("••••••••"), password);
  await user.click(screen.getByRole("button", { name: /entrar/i }));
  return user;
}

describe("single Better Auth sign-in flow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ message: "Invalid email or password" }), { status: 401 }),
    );
  });
  afterEach(cleanup);

  it("uses the same-origin Better Auth endpoint with cookie credentials", async () => {
    expect(AUTH_BASE).toBe("/api/auth");
    renderAuth();
    await submitCredentials();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(AUTH_BASE + "/sign-in/email");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(String(init.body))).toMatchObject({ email: "igor1fontes@gmail.com" });
  });

  it("shows a controlled error when credentials are rejected", async () => {
    renderAuth();
    await submitCredentials();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.queryByText("dashboard-reached")).not.toBeInTheDocument();
  });

  it("navigates to the dashboard after a successful sign-in", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { email: "igor1fontes@gmail.com" } }), { status: 200 }),
    );
    renderAuth();
    await submitCredentials();
    await waitFor(() => expect(screen.getByText("dashboard-reached")).toBeInTheDocument());
  });

  it("does not expose a sign-up or account-registration control", () => {
    renderAuth("/auth?mode=signup");
    expect(screen.queryByRole("button", { name: /registar|criar conta/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Igor Fontes")).not.toBeInTheDocument();
  });
});
