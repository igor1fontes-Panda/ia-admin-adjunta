import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { AgentMemoryRow, DeliveryRow } from "../lib/data";

// Mock the data layer at the module boundary: Dashboard must render honest
// empty/error states from whatever these functions return, and the 15s poll
// must not fire network calls of its own inside tests.
const dataMocks = vi.hoisted(() => ({
  fetchLeads: vi.fn(async () => []),
  fetchClients: vi.fn(async () => []),
  fetchOrders: vi.fn(async () => []),
  fetchActivity: vi.fn(async () => []),
  fetchAgentMemory: vi.fn(async () => [] as AgentMemoryRow[]),
  fetchDeliveryStatus: vi.fn(async () => [] as DeliveryRow[]),
  createClient: vi.fn(async () => {
    throw new Error("should not be called");
  }),
  createOrder: vi.fn(async () => {
    throw new Error("should not be called");
  }),
  markOrderPaid: vi.fn(async () => undefined),
  updateLeadStatus: vi.fn(async () => undefined),
}));

vi.mock("../lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/data")>()),
  ...dataMocks,
}));

import { Dashboard } from "./Dashboard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders the command center and honest empty states when the API returns no rows", async () => {
  render(<Dashboard />);

  expect(screen.getByRole("heading", { name: "Centro de Comando" })).toBeInTheDocument();
  expect(screen.getByText("Ao vivo")).toBeInTheDocument();

  await waitFor(() => expect(dataMocks.fetchLeads).toHaveBeenCalled());
  // The module menu renders a description per module (the nav pills only have labels).
  expect(screen.getByText("Pulso de hoje e ativação")).toBeInTheDocument();
  expect(screen.getByText("Pipeline e qualificação IA")).toBeInTheDocument();
});

it("shows the database-setup error path when the API reports missing tables", async () => {
  dataMocks.fetchLeads.mockRejectedValueOnce(new Error('relation "leads" does not exist'));
  render(<Dashboard />);

  await waitFor(() => expect(screen.getByText(/Database tables are not created yet/)).toBeInTheDocument());
  // The error mentions the exact one-time setup command.
  expect(screen.getByText(/drizzle-kit push/)).toBeInTheDocument();
});

it("shows a generic API error message for non-schema failures", async () => {
  dataMocks.fetchOrders.mockRejectedValueOnce(new Error("Request failed (503)"));
  render(<Dashboard />);

  await waitFor(() => expect(screen.getByText(/Request failed \(503\)/)).toBeInTheDocument());
});

it("validates the new-client form before calling createClient", async () => {
  const user = userEvent.setup();
  render(<Dashboard />);
  await waitFor(() => expect(dataMocks.fetchLeads).toHaveBeenCalled());

  // Open the Clients module and the new-client form.
  await user.click(screen.getAllByRole("button", { name: /Clientes/ })[0]);
  await user.click(screen.getByRole("button", { name: "Novo cliente" }));

  // Fill an invalid email and submit.
  await user.type(screen.getByPlaceholderText("Acme Lda"), "Globex");
  await user.type(screen.getByPlaceholderText("billing@acme.com"), "not-an-email");
  await user.click(screen.getByRole("button", { name: /Criar cliente/ }));

  await waitFor(() => expect(screen.getByText(/valid billing email/i)).toBeInTheDocument());
  expect(dataMocks.createClient).not.toHaveBeenCalled();
});

it("validates the new-order form and never sends a sub-minimum amount", async () => {
  const user = userEvent.setup();
  render(<Dashboard />);
  await waitFor(() => expect(dataMocks.fetchLeads).toHaveBeenCalled());

  await user.click(screen.getAllByRole("button", { name: /Pedidos/ })[0]);
  await user.type(screen.getByPlaceholderText("29160"), "10");
  await user.click(screen.getByRole("button", { name: /Criar pedido/ }));

  await waitFor(() => expect(screen.getByText(/at least 1\.000 Kz/)).toBeInTheDocument());
  expect(dataMocks.createOrder).not.toHaveBeenCalled();
});
