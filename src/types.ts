export type Lead = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  niche: string;
  channel: string;
  score: number;
  status: "new" | "contacted" | "qualified" | "won" | "lost";
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  plan: "starter" | "professional" | "enterprise";
  mrr: number;
  status: "active" | "trialing" | "churned";
  created_at: string;
};

export type Order = {
  id: string;
  client_id: string | null;
  client_name: string;
  amount: number;
  currency: string;
  method: string;
  status: "pending" | "paid" | "refunded";
  reference: string;
  created_at: string;
};

export type Metric = {
  leads: number;
  qualifiedLeads: number;
  activeClients: number;
  mrr: number;
  revenue30d: number;
  winRate: number;
};

export type Activity = {
  id: string;
  kind: "bot" | "system" | "sale" | "lead";
  message: string;
  created_at: string;
};
