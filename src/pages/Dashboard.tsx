import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BarChart3,
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
import { createClient, createOrder, fetchActivity, fetchAgentMemory, fetchClients, fetchLeads, fetchOrders, markOrderPaid, supabase, updateLeadStatus } from "../lib/data";
import type { AgentMemoryRow } from "../lib/data";
import {
  agentStatus,
  computeMetrics,
  formatKz,
  incomeByClient,
  incomeByMethod,
  leadsPerDay,
  mrrByPlan,
  pipelineFunnel,
  PLAN_PRICES,
  revenuePerDay,
  scoreLead,
  timeAgo,
  type IncomeRow,
} from "../lib/engine";

type Tab = "overview" | "leads" | "charts" | "clients" | "orders" | "agents";

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [memory, setMemory] = useState<AgentMemoryRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leads, clients, orders, activity, mem] = await Promise.all([
        fetchLeads(),
        fetchClients(),
        fetchOrders(),
        fetchActivity(),
        fetchAgentMemory().catch(() => [] as AgentMemoryRow[]),
      ]);
      setLeads(leads);
      setClients(clients);
      setOrders(orders);
      setActivity(activity);
      setMemory(mem);
      setMetrics(computeMetrics(leads, clients, orders));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data from Supabase");
    } finally {
      setLoading(false);
    }
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

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? "Operation failed");
    }
  }

  function handleLeadStatus(id: string, status: Lead["status"]) {
    const prev = leads.find((l) => l.id === id)?.status;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    updateLeadStatus(id, status).catch((e: any) => {
      // Revert the optimistic update on failure
      if (prev) setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: prev } : l)));
      setError(e?.message ?? "Could not update lead status");
    });
  }

  function handleNewClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(async () => {
      const client = await createClient({
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        plan: String(fd.get("plan") || "starter") as Client["plan"],
      });
      setClients((cs) => [client, ...cs]);
      setShowNewClient(false);
      form.reset();
    });
  }

  function handleNewOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const clientId = String(fd.get("client_id") || "");
    const client = clients.find((c) => c.id === clientId);
    run(async () => {
      const order = await createOrder({
        client_id: clientId || null,
        client_name: client?.name ?? String(fd.get("client_name") || "Walk-in"),
        amount: Number(fd.get("amount") || 0),
        method: String(fd.get("method") || "multicaixa"),
      });
      setOrders((os) => [order, ...os]);
      form.reset();
    });
  }

  function handleMarkPaid(id: string) {
    run(async () => {
      await markOrderPaid(id);
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: "paid" as const } : o)));
    });
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

      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}


      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-ink-900/80 p-1">
        {([
          ["overview", "Overview"],
          ["leads", "Leads"],
          ["charts", "Analytics"],
          ["clients", "Clients"],
          ["orders", "Orders"],
          ["agents", "AI Agents"],
        ] as Array<[Tab, string]>).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t ? "bg-gold-500 text-ink-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <Overview metrics={metrics!} activity={activity} orders={orders.slice(0, 5)} leads={leads} />
      ) : null}
      {tab === "leads" ? (
        <LeadsTab leads={leads} onStatus={handleLeadStatus} />
      ) : null}
      {tab === "charts" ? (
        <ChartsTab leads={leads} orders={orders} clients={clients} />
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
        <OrdersTab orders={orders} clients={clients} onNew={handleNewOrder} onMarkPaid={handleMarkPaid} />
      ) : null}
      {tab === "agents" ? <AgentsTab activity={activity} memory={memory} /> : null}
    </div>
  );
}

// ---------- Overview ----------

function Overview({ metrics, activity, orders, leads }: { metrics: Metric; activity: Activity[]; orders: Order[]; leads: Lead[] }) {
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

      <div className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <BarChart3 size={18} className="text-gold-400" /> Leads — last 14 days (real captures)
        </h3>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={leadsPerDay(leads, 14)} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eab308" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#eab308" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: "#131316", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fafafa" }}
                labelStyle={{ color: "#fafafa" }}
              />
              <Area type="monotone" dataKey="value" name="Leads" stroke="#eab308" strokeWidth={2} fill="url(#leadFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
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

// ---------- Analytics (charts, funnel, income) ----------

const FUNNEL_COLORS = ["#eab308", "#a1a1aa", "#38bdf8", "#34d399"];

function ChartTooltipStyle() {
  return {
    contentStyle: {
      background: "#131316",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      color: "#fafafa",
      fontSize: 12,
    },
    labelStyle: { color: "#fafafa" },
  };
}

function IncomeTable({ rows, title }: { rows: IncomeRow[]; title: string }) {
  return (
    <div className="card overflow-x-auto">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="font-semibold text-zinc-50">{title}</h3>
      </div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-zinc-500">
            <th className="px-5 py-3">Source</th>
            <th className="px-5 py-3">Collected (paid)</th>
            <th className="px-5 py-3">Awaiting (pending)</th>
            <th className="px-5 py-3">Orders</th>
            <th className="px-5 py-3">Share of income</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-sm text-zinc-500">
                No orders yet — income appears here the moment real sales are recorded.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.source} className="border-t border-white/5 transition hover:bg-white/5">
                <td className="px-5 py-3.5 font-medium text-zinc-100 capitalize">{r.source}</td>
                <td className="px-5 py-3.5 font-semibold text-emerald-300">{formatKz(r.paid)}</td>
                <td className="px-5 py-3.5 text-amber-300">{formatKz(r.pending)}</td>
                <td className="px-5 py-3.5 text-zinc-300">{r.orders}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.min(100, r.sharePct)}%` }} />
                    </div>
                    <span className="font-mono text-xs text-zinc-400">{r.sharePct}%</span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChartsTab({ leads, orders, clients }: { leads: Lead[]; orders: Order[]; clients: Client[] }) {
  const income = useMemo(() => incomeByMethod(orders), [orders]);
  const byClient = useMemo(() => incomeByClient(orders), [orders]);
  const funnel = useMemo(() => pipelineFunnel(leads), [leads]);
  const revenue = useMemo(() => revenuePerDay(orders, 14), [orders]);
  const plans = useMemo(() => mrrByPlan(clients).filter((p) => p.value > 0), [clients]);
  const totalPaid = income.reduce((s, r) => s + r.paid, 0);
  const totalPending = income.reduce((s, r) => s + r.pending, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      {/* Revenue per day */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-zinc-50">Sales volume — last 14 days</h3>
          <div className="flex gap-4 text-xs text-zinc-400">
            <span>Collected: <b className="text-emerald-300">{formatKz(totalPaid)}</b></span>
            <span>Awaiting: <b className="text-amber-300">{formatKz(totalPending)}</b></span>
          </div>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenue} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip {...ChartTooltipStyle()} formatter={(value) => formatKz(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="paid" name="Collected" stackId="rev" fill="#34d399" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" name="Awaiting payment" stackId="rev" fill="#eab308" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <div className="card p-6">
          <h3 className="font-semibold text-zinc-50">Marketing & sales funnel (real leads)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: "#e4e4e7", fontSize: 12 }} tickLine={false} axisLine={false} width={86} />
                <Tooltip {...ChartTooltipStyle()} />
                <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
                  {funnel.map((_, i) => (
                    <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MRR by plan */}
        <div className="card p-6">
          <h3 className="font-semibold text-zinc-50">Recurring revenue by plan (active clients)</h3>
          {plans.length === 0 ? (
            <p className="mt-8 text-center text-sm text-zinc-500">
              No active clients yet — the split by plan appears as soon as real subscriptions exist.
            </p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={plans} dataKey="value" nameKey="label" innerRadius={58} outerRadius={90} paddingAngle={3}>
                    {plans.map((_, i) => (
                      <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...ChartTooltipStyle()} formatter={(value) => formatKz(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Income tables — where the money actually comes from and goes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeTable rows={income} title="Income by payment method" />
        <IncomeTable rows={byClient} title="Income by client" />
      </div>
    </motion.div>
  );
}

// ---------- AI Agents ----------

const AGENT_SLUGS: Record<string, string> = {
  "Lead Qualifier": "lead_qualifier",
  "Insight Engine": "insight_engine",
  "Error Handler": "error_handler",
};
const slug = (name: string): string => AGENT_SLUGS[name] ?? name.toLowerCase().replace(/\s+/g, "_");

function AgentsTab({ activity, memory }: { activity: Activity[]; memory: AgentMemoryRow[] }) {
  const agents = useMemo(() => agentStatus(activity), [activity]);
  const memoryFor = (agentSlug: string): AgentMemoryRow[] =>
    memory.filter((m) => m.agent === agentSlug);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {agents.map((a) => {
          const stale = a.lastRun === null || Date.now() - +new Date(a.lastRun) > 36 * 3600000;
          return (
            <div key={a.name} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-50">{a.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{a.schedule} · GitHub Actions</p>
                </div>
                <span
                  className={`badge ${
                    a.runs > 0 && !stale
                      ? "bg-emerald-500/15 text-emerald-300"
                      : a.runs > 0
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {a.runs > 0 ? (stale ? "idle" : "active") : "waiting"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Recorded runs</p>
                  <p className="font-bold text-zinc-100">{a.runs}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last run</p>
                  <p className="text-zinc-300">{a.lastRun ? timeAgo(a.lastRun) : "—"}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-400">{a.lastMessage}</p>
              {memoryFor(slug(a.name)).map((m) => (
                <div key={m.key} className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">Learned: {m.key.replace(/_/g, " ")}</p>
                  <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-300">
                    {JSON.stringify(m.value, null, 1)}
                  </pre>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-zinc-500">
        Runs are counted from real activity_log entries; “Learned” cards show live agent memory written by the bots from real won/lost deals and incident fixes. Cold start = no decided outcomes yet, so agents use neutral priors and adapt as real sales happen.
      </p>
    </motion.div>
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
