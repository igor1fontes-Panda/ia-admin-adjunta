import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLang } from "../../../lib/i18n";
import type { Lead, Order } from "../../../types";
import { GodsEyeTab } from "./GodsEyeTab";

// Public keyless feeds are mocked at fetch level — no network in tests.
const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", fetchMock);

function lead(over: Partial<Lead>): Lead {
  return {
    id: "l1",
    company: "Acme",
    contact_name: "Maria",
    email: "m@acme.test",
    niche: "SaaS",
    channel: "website",
    score: 90,
    status: "new",
    ai_action: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

function order(over: Partial<Order>): Order {
  return {
    id: "o1",
    client_id: null,
    client_name: "Acme",
    amount: 29160,
    currency: "AOA",
    method: "multicaixa",
    status: "pending",
    reference: "REF-1",
    created_at: new Date().toISOString(),
    ...over,
  };
}

afterEach(() => {
  cleanup();
  setLang("pt");
  fetchMock.mockReset();
});

function feedsOk() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("opensky")) {
      return new Response(JSON.stringify({ states: [["ABC123", "Angola", null, null, -8.8, 13.2, null, 9000]] }), {
        status: 200,
      });
    }
    if (url.includes("earthquake")) {
      return new Response(
        JSON.stringify({
          features: [{ properties: { mag: 5.4, place: "SW of Sumatra" }, geometry: { coordinates: [100, -5, 10] } }],
        }),
        { status: 200 },
      );
    }
    if (url.includes("eonet")) {
      return new Response(
        JSON.stringify({ events: [{ title: "Wildfire", geometry: [{ coordinates: [-120, 35] }] }] }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

it("renders the market layers (hot leads, awaiting collection) from real rows", async () => {
  feedsOk();
  render(<GodsEyeTab leads={[lead({}), lead({ score: 30, status: "contacted" })]} orders={[order({})]} />);
  expect(screen.getByText("GodsEye Nano — Radar de mercado")).toBeInTheDocument();
  expect(screen.getByText("Leads quentes (score 80+)")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Por cobrar")).toBeInTheDocument());
});

it("shows public feeds as unavailable when a source fails — never simulated", async () => {
  fetchMock.mockRejectedValue(new Error("network down"));
  render(<GodsEyeTab leads={[lead({})]} orders={[]} />);
  // All three public feeds fail together and each shows the honest error.
  await waitFor(() =>
    expect(screen.getAllByText("Fonte indisponível neste momento — tenta atualizar.")).toHaveLength(3),
  );
});
