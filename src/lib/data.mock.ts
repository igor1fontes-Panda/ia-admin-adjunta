import type { Activity, Client, Lead, Order } from "../types";

export const mockLeads: Lead[] = [
  {
    id: "mock-lead-1",
    company: "Exemplo Lda.",
    contact_name: "Ana Silva",
    email: "ana@example.test",
    niche: "Consultoria",
    channel: "website",
    score: 72,
    status: "qualified",
    ai_action: "Agendar descoberta",
    created_at: "2025-01-15T10:00:00.000Z",
  },
];
export const mockClients: Client[] = [
  {
    id: "mock-client-1",
    name: "Exemplo Lda.",
    email: "finance@example.test",
    plan: "professional",
    mrr: 2916,
    status: "active",
    created_at: "2025-01-10T10:00:00.000Z",
  },
];
export const mockOrders: Order[] = [
  {
    id: "mock-order-1",
    client_id: "mock-client-1",
    client_name: "Exemplo Lda.",
    amount: 2916,
    currency: "AOA",
    method: "card",
    status: "paid",
    reference: "mock-order-1",
    created_at: "2025-01-20T10:00:00.000Z",
  },
];
export const mockActivity: Activity[] = [
  {
    id: "mock-activity-1",
    kind: "system",
    message: "Offline mock mode enabled.",
    created_at: "2025-01-20T10:00:00.000Z",
  },
];

export const mockData = { leads: mockLeads, clients: mockClients, orders: mockOrders, activity: mockActivity };
export const isMockMode =
  String((import.meta.env as Record<string, string | undefined>).VITE_MOCK_DATA ?? "").toLowerCase() === "true";
