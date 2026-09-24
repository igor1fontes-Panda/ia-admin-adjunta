import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { setLang } from "../../../lib/i18n";
import type { Lead } from "../../../types";
import { LeadsTab } from "./LeadsTab";

function lead(overrides: Partial<Lead>): Lead {
  return {
    id: "l1",
    company: "Acme Lda",
    contact_name: "Maria Silva",
    email: "maria@acme.test",
    niche: "SaaS",
    channel: "website",
    score: 91,
    status: "new",
    ai_action: "Send proposal within 24h",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  setLang("pt");
});

it("renders real lead rows with score bar, next action and status select", () => {
  const leads = [
    lead({ score: 91, status: "qualified", ai_action: "Send proposal within 24h" }),
    lead({ id: "l2", company: "Globex", niche: "Fintech", score: 55, status: "new", ai_action: null }),
  ];
  render(<LeadsTab leads={leads} onStatus={() => undefined} />);

  expect(screen.getByText("Acme Lda")).toBeInTheDocument();
  expect(screen.getByText("Globex")).toBeInTheDocument();
  expect(screen.getByText("Send proposal within 24h")).toBeInTheDocument();
  expect(screen.getByText("IA")).toBeInTheDocument(); // ai_action tag
  // Two status selects, one per lead row.
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  // Status select shows the current PT label.
  expect(screen.getByDisplayValue("qualificado")).toBeInTheDocument();
});

it("shows the honest empty state when there are no leads", () => {
  render(<LeadsTab leads={[]} onStatus={() => undefined} />);
  expect(screen.getByText(/Ainda sem leads/)).toBeInTheDocument();
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
});

it("reports status changes through onStatus", async () => {
  const user = userEvent.setup();
  let received: { id: string; status: Lead["status"] } | null = null;
  render(
    <LeadsTab
      leads={[lead({ status: "new" })]}
      onStatus={(id, status) => {
        received = { id, status };
      }}
    />,
  );
  await user.selectOptions(screen.getByRole("combobox"), "won");
  expect(received).toEqual({ id: "l1", status: "won" });
});
