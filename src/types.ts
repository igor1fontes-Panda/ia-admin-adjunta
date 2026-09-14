export type Lead = {
  id: string;
  company: string;
  contact_name: string;
  email: string;
  niche: string;
  channel: string;
  score: number;
  status: "new" | "contacted" | "qualified" | "won" | "lost";
  ai_action: string | null;
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

export type ProductPackStage = "brief" | "evidence" | "assembly" | "review" | "ready";

export type ProductPackMarket = {
  language: "English" | "Portuguese";
  region: "Global" | "European Union" | "North America";
  currency: "USD" | "EUR" | "BRL";
  audience: string;
  customerProblem: string;
};

export type ProductPackEvidence = {
  source: "leads" | "clients" | "orders" | "activity" | "agent_memory";
  recordCount: number;
  recordIds: string[];
  observedSignal: string;
  confidence: "high" | "medium" | "low";
  freshness: "fresh" | "aging" | "stale" | "unavailable";
  verifiedAt: string | null;
};

export type ProductPackDeliverables = {
  promise: string;
  outline: string;
  offerNotes: string;
  landingCopy: string;
  seoMetadata: string;
  leadMagnet: string;
  outreachDraft: string;
};

export type ProductPackRisk = {
  id: string;
  label: string;
  detail: string;
  severity: "high" | "medium" | "low";
  blocking: boolean;
};

export type ProductPack = {
  stage: ProductPackStage;
  niche: string;
  market: ProductPackMarket;
  evidence: ProductPackEvidence[];
  deliverables: ProductPackDeliverables;
  risks: ProductPackRisk[];
  learningOutcomes: string[];
  createdAt: string;
};

export type AgentPromptContext = {
  agent: string;
  sessionId: string;
  currentTask: string;
  facts: Array<{ key: string; value: string; source: string; observedAt: string; confidence: "high" | "medium" | "low" }>;
  recordCounts: { leads: number; clients: number; orders: number; activity: number; memory: number };
  contextClock: string;
};

export type AgentPromptPlan = {
  staticSystem: string;
  dynamicContext: AgentPromptContext;
  tools: string[];
  cacheKey: string;
  cacheableBytes: number;
};
