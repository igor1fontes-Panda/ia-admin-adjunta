import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Plus,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Activity, Client, Lead, Metric, Order } from "../types";
import { createClient, createOrder, fetchActivity, fetchClients, fetchLeads, fetchOrders, markOrderPaid, supabase, updateLeadStatus } from "../lib/data";
import { formatKz, PLAN_PRICES, scoreLead, timeAgo } from "../lib/engine";

type Tab = "overview" | "leads" | "clients" | "orders";

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [leads, clients, orders, activity] = await Promise.all([
      fetchLeads(),
      fetchClients(),
      fetchOrders(),
      fetchActivity(),
    ]);
    setLeads(leads);
    setClients(clients);
    setOrders(orders);
    setActivity(activity);
    setMetrics({
      leads: leads.length,
      qualifiedLeads: leads.filter((l) => l.status === "qualified" || l.status === "won").length,
      activeClients: clients.filter((c) => c.status !== "churned").length,
      mrr: clients.filter((c) => c.status !== "churned").reduce((s, c) => s + c.mrr, 0),
      revenue30d: orders
        .filter((o) => o.status === "paid" && Date.now() - +new Date(o.created_at) < 30 * 86400000)
        .reduce((s, o) => s + o.amount, 0),
      winRate: leads.length
        ? Math.round((leads.filter((l) => l.status === "won").length / leads.length) * 100)
        : 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates from Supabase realtime
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const channel = sb
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  async function handleLeadStatus(id: string, status: Lead["status"]) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    await updateLeadStatus(id, status);
  }

  async function handleNewClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const client = await createClient({
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      plan: String(fd.get("plan") || "starter") as Client["plan"],
    });
    setClients((cs) => [client, ...cs]);
    setShowNewClient(false);
  }

  async function handleNewOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const clientId = String(fd.get("client_id") || "");
    const client = clients.find((c) => c.id === clientId);
    const order = await createOrder({
      client_id: clientId || null,
      client_name: client?.name ?? String(fd.get("client_name") || "Walk-in"),
      amount: Number(fd.get("amount") || 0),
      method: String(fd.get("method") || "multicaixa"),
    });
    setOrders((os) => [order, ...os]);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50 sm:text-3xl">Command Center</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Live · Supabase connected · bots run on GitHub Actions
        </p>
        </div>
        <button onClick={load} className="btn-ghost !px-4 !py-2 text-xs">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>


      {/* Tabs */}
      <div className="mt-8 flex gap-1 rounded-2xl border border-white/10 bg-ink-900/80 p-1">
        {(["overview", "leads", "clients", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-gold-500 text-ink-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <Overview metrics={metrics!} activity={activity} orders={orders.slice(0, 5)} />
      ) : null}
      {tab === "leads" ? (
        <LeadsTab leads={leads} onStatus={handleLeadStatus} />
      ) : null}
      {tab === "clients" ? (
        <ClientsTab
          clients={clients}
          showNew={showNewClient}
          setShowNew={setShowNewClient}
          onNew={handleNewClient}
        />
      ) : null}
      {tab === "orders" ? (
        <OrdersTab orders={orders} clients={clients} onNew={handleNewOrder} onMarkPaid={markOrderPaid} />
      ) : null}
    </div>
  );
}

// ---------- Overview ----------

function Overview({ metrics, activity, orders }: { metrics: Metric; activity: Activity[]; orders: Order[] }) {
  const cards = [
    { label: "Leads captured", value: String(metrics.leads), icon: Target, tone: "text-emerald-400" },
    { label: "Qualified leads", value: String(metrics.qualifiedLeads), icon: TrendingUp, tone: "text-gold-400" },
    { label: "Active clients", value: String(metrics.activeClients), icon: Users, tone: "text-sky-400" },
    { label: "MRR", value: formatKz(metrics.mrr), icon: CircleDollarSign, tone: "text-gold-400" },
    { label: "Revenue 30d", value: formatKz(metrics.revenue30d), icon: CircleDollarSign, tone: "text-emerald-400" },
    { label: "Win rate", value: `${metrics.winRate}%`, icon: ActivityIcon, tone: "text-sky-400" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-5">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${c.tone}`}>
              <c.icon size={22} />
            </span>
            <div>
              <p className="text-xs font-medium text-zinc-400">{c.label}</p>
              <p className="text-xl font-bold text-zinc-50">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
            <Bot size={18} className="text-gold-400" /> Autonomous activity
          </h3>
          <ul className="mt-4 space-y-3">
            {activity.map((a) => {
              const audioMatch = a.message.match(/AUDIO_BRIEFING_URL=(\S+)/);
              const displayMsg = a.message.replace(/ ?\|\|\| AUDIO_BRIEFING_URL=\S+/, "");
              return (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span
                  className={`badge mt-0.5 ${
                    a.kind === "sale"
                      ? "bg-gold-500/15 text-gold-300"
                      : a.kind === "bot"
                        ? "bg-sky-500/15 text-sky-300"
                        : a.kind === "lead"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/10 text-zinc-300"
                  }`}
                >
                  {a.kind}
                </span>
                <div className="flex-1">
                  <span className="text-zinc-300">{displayMsg}</span>
                  {audioMatch ? (
                    <audio controls preload="none" src={audioMatch[1]} className="mt-2 w-full max-w-md" />
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{timeAgo(a.created_at)}</span>
              </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-zinc-50">Latest orders</h3>
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-200">{o.client_name}</p>
                  <p className="text-xs text-zinc-500">
                    ref {o.reference} · {o.method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-zinc-100">{formatKz(o.amount)}</p>
                  <span
                    className={`badge mt-0.5 ${
                      o.status === "paid"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : o.status === "refunded"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Leads ----------

function LeadsTab({ leads, onStatus }: { leads: Lead[]; onStatus: (id: string, s: Lead["status"]) => void }) {
  return (
    <div className="mt-8">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-4">Company</th>
              <th className="px-5 py-4">Contact</th>
              <th className="px-5 py-4">Channel</th>
              <th className="px-5 py-4">Score</th>
              <th className="px-5 py-4">Next action</th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const { tier, action } = scoreLead(l);
              const nextAction = l.ai_action ?? action;
              return (
                <tr key={l.id} className="border-b border-white/5 transition hover:bg-white/5">
                  <td className="px-5 py-4">
                    <p className="font-medium text-zinc-100">{l.company}</p>
                    <p className="text-xs text-zinc-500">{l.niche}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-zinc-300">{l.contact_name}</p>
                    <p className="text-xs text-zinc-500">{l.email}</p>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">{l.channel}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${tier === "hot" ? "bg-gold-500" : tier === "warm" ? "bg-sky-400" : "bg-zinc-500"}`}
                          style={{ width: `${Math.min(100, l.score)}%` }}
                        />
                      </div>
                      <span className={`font-mono text-xs ${tier === "hot" ? "text-gold-400" : "text-zinc-400"}`}>
                        {l.score}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    {nextAction}
                    {l.ai_action ? (
                      <span className="ml-1.5 rounded bg-gold-500/15 px-1.5 py-0.5 font-mono text-[10px] text-gold-300">AI</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={l.status}
                      onChange={(e) => onStatus(l.id, e.target.value as Lead["status"])}
                      className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      {["new", "contacted", "qualified", "won", "lost"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Clients ----------

function ClientsTab({
  clients,
  showNew,
  setShowNew,
  onNew,
}: {
  clients: Client[];
  showNew: boolean;
  setShowNew: (v: boolean) => void;
  onNew: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-8">
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowNew(!showNew)} className="btn-primary !px-4 !py-2 text-xs">
          <Plus size={14} /> New client
        </button>
      </div>

      {showNew ? (
        <form onSubmit={onNew} className="card mb-6 grid gap-4 p-6 sm:grid-cols-3">
          <div>
            <label className="label">Company name</label>
            <input name="name" required className="input" placeholder="Acme Lda" />
          </div>
          <div>
            <label className="label">Billing email</label>
            <input name="email" type="email" required className="input" placeholder="billing@acme.com" />
          </div>
          <div>
            <label className="label">Plan</label>
            <select name="plan" className="input" defaultValue="professional">
              {Object.entries(PLAN_PRICES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label} — {formatKz(p.monthly)}/mo
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              <CheckCircle2 size={16} /> Create client
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-zinc-100">{c.name}</p>
                <p className="text-xs text-zinc-500">{c.email}</p>
              </div>
              <span
                className={`badge ${
                  c.status === "active"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : c.status === "trialing"
                      ? "bg-sky-500/15 text-sky-300"
                      : "bg-red-500/15 text-red-300"
                }`}
              >
                {c.status}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="rounded-lg bg-white/5 px-2.5 py-1 font-medium capitalize text-gold-300">{c.plan}</span>
              <span className="font-bold text-zinc-100">{formatKz(c.mrr)}<span className="text-xs font-normal text-zinc-500">/mo</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Orders ----------

function OrdersTab({
  orders,
  clients,
  onNew,
  onMarkPaid,
}: {
  orders: Order[];
  clients: Client[];
  onNew: (e: React.FormEvent<HTMLFormElement>) => void;
  onMarkPaid: (id: string) => void;
}) {
  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={onNew} className="card grid gap-4 p-6 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Client</label>
          <select name="client_id" className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="">— Walk-in —</option>
          </select>
        </div>
        <div>
          <label className="label">Amount (AOA)</label>
          <input name="amount" type="number" min="1000" step="1" required className="input" placeholder="29160" />
        </div>
        <div>
          <label className="label">Method</label>
          <select name="method" className="input">
            <option value="multicaixa">Multicaixa Express</option>
            <option value="paypay">PayPay</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            <Plus size={16} /> Create order (generates payment reference)
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-4">Reference</th>
              <th className="px-5 py-4">Client</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Method</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-5 py-4 font-mono text-xs text-zinc-300">{o.reference}</td>
                <td className="px-5 py-4 text-zinc-200">{o.client_name}</td>
                <td className="px-5 py-4 font-semibold text-zinc-100">{formatKz(o.amount)}</td>
                <td className="px-5 py-4 text-zinc-400">{o.method}</td>
                <td className="px-5 py-4">
                  <span
                    className={`badge ${
                      o.status === "paid"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : o.status === "refunded"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {o.status === "pending" ? (
                    <button
                      onClick={() => onMarkPaid(o.id)}
                      className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                    >
                      Mark paid
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
