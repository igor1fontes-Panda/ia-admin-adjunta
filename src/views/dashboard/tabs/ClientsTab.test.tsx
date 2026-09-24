import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { setLang } from "../../../lib/i18n";
import type { Client } from "../../../types";
import { ClientsTab } from "./ClientsTab";

function client(overrides: Partial<Client>): Client {
  return {
    id: "c1",
    name: "Globex Lda",
    email: "billing@globex.test",
    plan: "professional",
    mrr: 2916,
    status: "active",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  setLang("pt");
});

it("renders one card per client with plan, MRR and status badge (PT)", () => {
  render(
    <ClientsTab
      clients={[
        client({}),
        client({ id: "c2", name: "Initech", plan: "starter", mrr: 1250, status: "trialing" }),
        client({ id: "c3", name: "Umbrella", plan: "enterprise", mrr: 8333, status: "churned" }),
      ]}
      showNew={false}
      setShowNew={() => undefined}
      onNew={() => undefined}
    />,
  );

  expect(screen.getByText("Globex Lda")).toBeInTheDocument();
  expect(screen.getByText("Initech")).toBeInTheDocument();
  expect(screen.getByText("Umbrella")).toBeInTheDocument();
  // Status badges translate through the i18n dictionary.
  expect(screen.getByText("ativo")).toBeInTheDocument();
  expect(screen.getByText("em teste")).toBeInTheDocument();
  expect(screen.getByText("cancelado")).toBeInTheDocument();
  // MRR is formatted as Angolan Kwanza (pt-AO grouping: 2 916 Kz).
  expect(screen.getByText(/2\s*916\s*Kz/)).toBeInTheDocument();
  expect(screen.getByText(/1\s*250\s*Kz/)).toBeInTheDocument();
});

it("shows the honest empty state when there are no clients", () => {
  render(<ClientsTab clients={[]} showNew={false} setShowNew={() => undefined} onNew={() => undefined} />);
  expect(screen.getByText(/Ainda sem clientes/)).toBeInTheDocument();
  expect(screen.queryByText(/Por mês/)).not.toBeInTheDocument();
});

it("toggles the creation form via setShowNew", async () => {
  const user = userEvent.setup();
  let shown: boolean | null = null;
  render(
    <ClientsTab
      clients={[client({})]}
      showNew={false}
      setShowNew={(v) => {
        shown = v;
      }}
      onNew={() => undefined}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Novo cliente/i }));
  expect(shown).toBe(true);
});

it("submits the new-client form through onNew without a page reload", async () => {
  const user = userEvent.setup();
  let submitted: React.FormEvent<HTMLFormElement> | null = null;
  render(
    <ClientsTab
      clients={[client({})]}
      showNew={true}
      setShowNew={() => undefined}
      onNew={(e) => {
        e.preventDefault();
        submitted = e;
      }}
    />,
  );
  await user.type(screen.getByPlaceholderText("Acme Lda"), "Hooli");
  await user.type(screen.getByPlaceholderText("billing@acme.com"), "ops@hooli.test");
  await user.click(screen.getByRole("button", { name: /Criar cliente/i }));
  expect(submitted).not.toBeNull();
});
