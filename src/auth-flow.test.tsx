import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "./lib/i18n";

const auth = vi.hoisted(() => ({
  signInAdmin: vi.fn(),
  authConfigured: true,
  ADMIN_EMAIL: "admin@example.test",
}));

vi.mock("./lib/auth-client", () => auth);

import { Auth } from "./views/Auth";

describe("Neon Managed Auth login flow", () => {
  beforeEach(() => auth.signInAdmin.mockReset());
  afterEach(() => cleanup());

  function renderAuth() {
    return render(
      <PreferencesProvider>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<p>Dashboard loaded</p>} />
          </Routes>
        </MemoryRouter>
      </PreferencesProvider>,
    );
  }

  it("navigates to the dashboard only after successful administrator sign-in", async () => {
    auth.signInAdmin.mockResolvedValue({ user: { email: auth.ADMIN_EMAIL } });
    renderAuth();
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "valid-password" } });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Dashboard loaded")).toBeInTheDocument());
    expect(auth.signInAdmin).toHaveBeenCalledWith(auth.ADMIN_EMAIL, "valid-password");
  });
});
