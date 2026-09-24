import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { setLang } from "../../../lib/i18n";
import type { Client, Order } from "../../../types";
import { OrdersTab } from "./OrdersTab";

function order(overrides: Partial<Order>): Order {
  return {
    id: "o1",
    client_id: "c1",
    client_name: "Globex Lda",
    amount: 29160,
    currency: "AOA",
    method: "multicaixa",
    status: "pending",
    reference: "manual-abc-123",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const clients: Client[] = [
  {
    id: "c1",
    name: "Globex Lda",
    email: "b@g.test",
    plan: "professional",
    mrr: 2916,
    status: "active",
    created_at: new Date().toISOString(),
  },
];

afterEach(() => {
  cleanup();
  setLang("pt");
});

it("renders real order rows with reference, amount, method and status badge", () => {
  render(
    <OrdersTab
      orders={[
        order({}),
        order({
          id: "o2",
          client_name: "Walk-in",
          amount: 12500,
          method: "paypay",
          status: "paid",
          reference: "manual-def-456",
        }),
        order({
          id: "o3",
          client_name: "Initech",
          amount: 8333,
          method: "wire_usd",
          status: "refunded",
          reference: "manual-ghi-789",
        }),
      ]}
      clients={clients}
      onNew={() => undefined}
      onMarkPaid={() => undefined}
    />,
  );

  expect(screen.getByText("manual-abc-123")).toBeInTheDocument();
  expect(screen.getByText("manual-def-456")).toBeInTheDocument();
  expect(screen.getByText(/29\s*160\s*Kz/)).toBeInTheDocument();
  expect(screen.getByText(/12\s*500\s*Kz/)).toBeInTheDocument();
  // Payment methods translate; unknown/foreign method values fall back to the raw value.
  expect(screen.getAllByText("Multicaixa Express").length).toBeGreaterThan(0); // form option + row
  expect(screen.getAllByText("PayPay").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Transferência internacional — USD/).length).toBeGreaterThan(0);
  // Mark-paid action only for pending orders.
  expect(screen.getAllByRole("button", { name: /Marcar como pago/i })).toHaveLength(1);
});

it("renders the no-client walk-in option in the creation form", () => {
  render(<OrdersTab orders={[]} clients={clients} onNew={() => undefined} onMarkPaid={() => undefined} />);
  const select = screen.getAllByRole("combobox")[0]; // first select = client picker
  const walkIn = Array.from(select.querySelectorAll("option")).find((o) => o.value === "");
  expect(walkIn).toBeTruthy();
});

it("reports mark-paid through onMarkPaid with the order id", async () => {
  const user = userEvent.setup();
  let paidId: string | null = null;
  render(
    <OrdersTab
      orders={[order({})]}
      clients={clients}
      onNew={() => undefined}
      onMarkPaid={(id) => {
        paidId = id;
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Marcar como pago/i }));
  expect(paidId).toBe("o1");
});

it("submits the new-order form through onNew", async () => {
  const user = userEvent.setup();
  let submitted: React.FormEvent<HTMLFormElement> | null = null;
  render(
    <OrdersTab
      orders={[]}
      clients={clients}
      onNew={(e) => {
        e.preventDefault();
        submitted = e;
      }}
      onMarkPaid={() => undefined}
    />,
  );
  await user.type(screen.getByPlaceholderText("29160"), "12500");
  await user.click(screen.getByRole("button", { name: /Criar pedido/i }));
  expect(submitted).not.toBeNull();
});
it("renders an empty order table honestly when there are no orders", () => {
  render(<OrdersTab orders={[]} clients={clients} onNew={() => undefined} onMarkPaid={() => undefined} />);
  expect(screen.queryByText(/manual-/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Marcar como pago/i })).not.toBeInTheDocument();
});
