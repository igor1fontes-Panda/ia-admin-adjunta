import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowRight,
  BarChart3,
  Bot,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Cpu,
  Crown,
  Database,
  Gauge,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Network,
  Package,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { PaymentDetails } from "../components/PaymentDetails";
import type { Activity, Client, Lead, Metric, Order, ProductPackStage } from "../types";
import { createClient, createOrder, fetchActivity, fetchAgentMemory, fetchClients, fetchDeliveryStatus, fetchLeads, fetchOrders, markOrderPaid, supabase, updateLeadStatus } from "../lib/data";
import type { AgentMemoryRow } from "../lib/data";
import type { DeliveryRow } from "../lib/engine";
import { useT, useTAny } from "../lib/i18n";
import { errorMessage } from "../lib/errors";
import { DashboardTabNav, type DashboardTab } from "./dashboard/DashboardTabNav";
import { DashboardTabContent } from "./dashboard/DashboardTabContent";
import {
  academyState,
  agentStatus,
  briefFreshness,
  buildAgentPromptPlan,
  computeMetrics,
  formatKz,
  incomeByClient,
  incomeByMethod,
  leadsPerDay,
  mrrByPlan,
  onboardingSteps,
  opsState,
  pipelineFunnel,
  productPackEvidence,
  productPackRisks,
  PLAN_PRICES,
  revenuePerDay,
  skillFreshness,
  timeAgo,
  todayPulse,
  TEACHER_PREFIX,
  type AcademyStudent,
  type IncomeRow,
  type OnboardingStep,
  type Pulse,
} from "../lib/engine";

type Tab = DashboardTab | "ops";
type ConnState = "connecting" | "live" | "offline";

const EMPTY_METRICS: Metric = {
  leads: 0,
  qualifiedLeads: 0,
  activeClients: 0,
  mrr: 0,
  revenue30d: 0,
  winRate: 0,
};

export function Dashboard() {
  const t = useT();
  const tAny = useTAny();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<ConnState>("connecting");
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [memory, setMemory] = useState<AgentMemoryRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const loadingRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const [leads, clients, orders, activity, mem, del] = await Promise.all([
        fetchLeads(),
        fetchClients(),
        fetchOrders(),
        fetchActivity(),
        fetchAgentMemory().catch(() => [] as AgentMemoryRow[]),
        fetchDeliveryStatus().catch(() => [] as DeliveryRow[]),
      ]);
      if (requestId !== requestRef.current) return;
      setLeads(leads);
      setClients(clients);
      setOrders(orders);
      setActivity(activity);
      setMemory(mem);
      setDeliveries(del);
      setMetrics(computeMetrics(leads, clients, orders));
    } catch (e: unknown) {
      if (requestId !== requestRef.current) return;
      const msg = errorMessage(e, "Failed to load data from Supabase");
      if (/could not find the table|pgrst205|schema cache|does not exist/i.test(msg)) {
        setError(
          "Database tables are not created yet. One-time setup: open your Supabase project → SQL Editor → run supabase/migrations/0001_init.sql, then 0002_agent_memory.sql. The command center fills with your real data immediately after.",
        );
      } else {
        setError(msg);
      }
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when the browser regains connectivity after being offline
  const wasOffline = useRef(false);
  useEffect(() => {
    if (realtime === "offline") {
      wasOffline.current = true;
    } else if (realtime === "live" && wasOffline.current) {
      wasOffline.current = false;
      load();
    }
  }, [realtime, load]);

  // Live updates from Supabase realtime — with visible connection status
  // and auto-recovery: the channel rejoins automatically after outages.
  useEffect(() => {
    if (!supabase) {
      setRealtime("offline");
      return;
    }
    const sb = supabase;
    const channel = sb
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtime("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtime("offline");
        else if (status === "CLOSED") setRealtime("connecting");
      });
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError(errorMessage(e, "Operation failed"));
    }
  }

  function handleLeadStatus(id: string, status: Lead["status"]) {
    const prev = leads.find((l) => l.id === id)?.status;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    updateLeadStatus(id, status).catch((e: unknown) => {
      // Revert the optimistic update on failure
      if (prev) setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: prev } : l)));
      setError(errorMessage(e, "Could not update lead status"));
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

  const realtimeBadge = {
    live: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "animate-pulse bg-emerald-400", label: t("dash.live"), tip: t("dash.liveTip") },
    connecting: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "animate-pulse bg-amber-400", label: t("dash.connecting"), tip: t("dash.connectingTip") },
    offline: { cls: "border-red-500/30 bg-red-500/10 text-red-300", dot: "bg-red-400", label: t("dash.offline"), tip: t("dash.offlineTip") },
  }[realtime];

  const tabs: Tab[] = ["overview", "packs", "leads", "charts", "clients", "orders", "agents", "ops", "ecosystem"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50 sm:text-3xl">{t("dash.title")}</h1>
          <p className="mt-1 text-sm text-zinc-400">{t("dash.sub")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${realtimeBadge.cls}`}
            title={realtimeBadge.tip}
          >
            <span className={`h-2 w-2 rounded-full ${realtimeBadge.dot}`} />
            {realtimeBadge.label}
          </span>
          <button onClick={load} className="btn-ghost !px-4 !py-2 text-xs">
            <RefreshCcw size={14} /> {t("dash.refresh")}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      {/* Menu de módulos — cada módulo abre o seu conteúdo */}
      <div className="mt-8">
        <p className="section-kicker mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500">
          <LayoutGrid size={11} /> {t("dash.menu")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tabs.map((id) => {
            const entry = tAny(`dash.modules.${id}`) as [string, string] | undefined;
            const label = Array.isArray(entry) ? entry[0] : id;
            const desc = Array.isArray(entry) ? entry[1] : "";
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-gold-500/60 bg-gold-500/10 shadow-[0_0_24px_rgba(245,158,11,0.15)]"
                    : "border-white/10 bg-ink-900/70 hover:border-white/25"
                }`}
              >
                <p className={`text-sm font-bold ${active ? "text-gold-300" : "text-zinc-100"}`}>{label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <DashboardTabNav tab={tab as DashboardTab} setTab={(next) => setTab(typeof next === "function" ? (next as (t: DashboardTab) => DashboardTab)(tab as DashboardTab) as Tab : (next as DashboardTab) as Tab)} />

      <DashboardTabContent
        tab={tab as DashboardTab}
        panels={{
          packs: <ProductPacksTab leads={leads} clients={clients} orders={orders} activity={activity} />,
          overview: (
            <Overview
              metrics={metrics ?? EMPTY_METRICS}
              activity={activity}
              orders={orders.slice(0, 5)}
              leads={leads}
              clients={clients}
              pulse={todayPulse(leads, orders, activity)}
              steps={onboardingSteps(leads, clients, orders, activity)}
              onGoTo={(id) => setTab(id)}
            />
          ),
          leads: <LeadsTab leads={leads} onStatus={handleLeadStatus} />,
          charts: <ChartsTab leads={leads} orders={orders} clients={clients} />,
          clients: (
            <ClientsTab
              clients={clients}
              showNew={showNewClient}
              setShowNew={setShowNewClient}
              onNew={handleNewClient}
            />
          ),
          orders: <OrdersTab orders={orders} clients={clients} onNew={handleNewOrder} onMarkPaid={handleMarkPaid} />,
          agents: <AgentsTab activity={activity} memory={memory} />,
          ecosystem: (
            <EcosystemTab
              metrics={metrics ?? EMPTY_METRICS}
              leads={leads}
              orders={orders}
              activity={activity}
              memory={memory}
              realtime={realtime}
            />
          ),
        }}
      />
      {tab === "ops" ? <OpsTab memory={memory} deliveries={deliveries} /> : null}
    </div>
  );
}

// ---------- Overview ----------

function Overview({
  metrics,
  activity,
  orders,
  leads,
  pulse,
  steps,
  onGoTo,
}: {
  metrics: Metric;
  activity: Activity[];
  orders: Order[];
  leads: Lead[];
  clients?: Client[];
  pulse: Pulse;
  steps: OnboardingStep[];
  onGoTo: (tab: Tab) => void;
}) {
  const t = useT();
  const tAny = useTAny();
  const cards = [
    { label: t("dash.cards.leads"), value: String(metrics.leads), icon: Target, tone: "text-emerald-400", tab: "leads" as Tab },
    { label: t("dash.cards.qualified"), value: String(metrics.qualifiedLeads), icon: TrendingUp, tone: "text-gold-400", tab: "leads" as Tab },
    { label: t("dash.cards.clients"), value: String(metrics.activeClients), icon: Users, tone: "text-sky-400", tab: "clients" as Tab },
    { label: t("dash.cards.mrr"), value: formatKz(metrics.mrr), icon: CircleDollarSign, tone: "text-gold-400", tab: "charts" as Tab },
    { label: t("dash.cards.revenue"), value: formatKz(metrics.revenue30d), icon: CircleDollarSign, tone: "text-emerald-400", tab: "orders" as Tab },
    { label: t("dash.cards.win"), value: `${metrics.winRate}%`, icon: ActivityIcon, tone: "text-sky-400", tab: "charts" as Tab },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-8">
      {/* Live pulse — what the business did TODAY (real rows, real zeros) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          [t("dash.today.leads"), pulse.leadsToday, Target, "text-emerald-400"],
          [t("dash.today.sales"), pulse.ordersToday, CircleDollarSign, "text-gold-400"],
          [t("dash.today.collected"), formatKz(pulse.collectedToday), TrendingUp, "text-emerald-400"],
          [t("dash.today.runs"), pulse.botRunsToday, Bot, "text-sky-400"],
        ] as Array<[string, string | number, typeof Target, string]>).map(([label, value, Icon, tone]) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ${tone}`}>
              <Icon size={18} />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="text-lg font-bold text-zinc-50">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cold-start guide — real activation steps, checked against the DB */}
      {steps.some((s) => !s.done) ? (
        <div className="card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
            <Zap size={18} className="text-gold-400" /> {t("dash.onb.title")}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">{t("dash.onb.sub")}</p>
          <ul className="mt-4 space-y-3">
            {steps.map((s, i) => {
              const entry = tAny(`dash.onb.${s.id}`) as [string, string] | undefined;
              const label = Array.isArray(entry) ? entry[0] : s.label;
              const description = Array.isArray(entry) ? entry[1] : s.description;
              const targetTab: Tab | null =
                s.id === "leads" ? "leads" : s.id === "clients" ? "clients" : s.id === "orders" || s.id === "collect" ? "orders" : s.id === "agents" ? "agents" : null;
              return (
                <li key={s.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      s.done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {s.done ? <CheckCircle2 size={14} /> : <Circle size={12} />}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${s.done ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                      {i + 1}. {label}
                    </p>
                    {!s.done ? (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {description}
                        {targetTab ? (
                          <button onClick={() => onGoTo(targetTab)} className="ml-1.5 inline-flex items-center font-semibold text-cyan-300 hover:underline">
                            {t("nav.cc")} <ArrowRight size={11} className="inline" />
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => onGoTo(c.tab)}
            className="card flex items-center gap-4 p-5 text-left transition hover:border-gold-500/40"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${c.tone}`}>
              <c.icon size={22} />
            </span>
            <div>
              <p className="text-xs font-medium text-zinc-400">{c.label}</p>
              <p className="text-xl font-bold text-zinc-50">{c.value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <BarChart3 size={18} className="text-gold-400" /> {t("dash.chart14")}
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
              <Area type="monotone" dataKey="value" name={t("dash.charts.leadsLegend")} stroke="#eab308" strokeWidth={2} fill="url(#leadFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
                <Bot size={18} className="text-gold-400" /> {t("dash.activity.title")}
              </h3>
              <p className="mt-1 text-xs text-emerald-300">{t("dash.activity.sub")}</p>
            </div>
            <span className="badge bg-emerald-500/15 text-emerald-300">{t("dash.activity.verified")}</span>
          </div>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("dash.activity.empty")}</p>
          ) : (
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
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-zinc-50">{t("dash.orders.latest")}</h3>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("dash.orders.empty")}</p>
          ) : (
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
                      {t(`dash.statusOrder.${o.status}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Leads ----------

function LeadsTab({ leads, onStatus }: { leads: Lead[]; onStatus: (id: string, s: Lead["status"]) => void }) {
  const t = useT();
  return (
    <div className="mt-8">
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-4">{t("dash.leadsTab.company")}</th>
              <th className="px-5 py-4">{t("dash.leadsTab.contact")}</th>
              <th className="px-5 py-4">{t("dash.leadsTab.channel")}</th>
              <th className="px-5 py-4">{t("dash.leadsTab.score")}</th>
              <th className="px-5 py-4">{t("dash.leadsTab.nextAction")}</th>
              <th className="px-5 py-4">{t("dash.leadsTab.status")}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const tier = l.score >= 80 ? "hot" : l.score >= 60 ? "warm" : "cold";
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
                    {l.ai_action}
                    {l.ai_action ? (
                      <span className="ml-1.5 rounded bg-gold-500/15 px-1.5 py-0.5 font-mono text-[10px] text-gold-300">{t("dash.leadsTab.aiTag")}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={l.status}
                      onChange={(e) => onStatus(l.id, e.target.value as Lead["status"])}
                      className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      {(["new", "contacted", "qualified", "won", "lost"] as const).map((s) => (
                        <option key={s} value={s}>{t(`dash.statusLead.${s}`)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-500">
                  {t("dash.leadsTab.empty")}
                </td>
              </tr>
            ) : null}
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
  const t = useT();
  return (
    <div className="card overflow-x-auto">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="font-semibold text-zinc-50">{title}</h3>
      </div>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-zinc-500">
            <th className="px-5 py-3">{t("dash.income.source")}</th>
            <th className="px-5 py-3">{t("dash.income.paid")}</th>
            <th className="px-5 py-3">{t("dash.income.pending")}</th>
            <th className="px-5 py-3">{t("dash.income.orders")}</th>
            <th className="px-5 py-3">{t("dash.income.share")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-sm text-zinc-500">
                {t("dash.income.empty")}
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
  const t = useT();
  const income = useMemo(() => incomeByMethod(orders), [orders]);
  const byClient = useMemo(() => incomeByClient(orders), [orders]);
  const funnel = useMemo(() => pipelineFunnel(leads), [leads]);
  const revenue = useMemo(() => revenuePerDay(orders, 14), [orders]);
  const plans = useMemo(() => mrrByPlan(clients).filter((p) => p.value > 0), [clients]);
  const totalPaid = income.reduce((s, r) => s + r.paid, 0);
  const totalPending = income.reduce((s, r) => s + r.pending, 0);
  const funnelLabel = (stage: string): string => {
    const key = `dash.charts.funnelStages.${stage.toLowerCase()}`;
    const v = t(key);
    return v === key ? stage : v;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      {/* Revenue per day */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-zinc-50">{t("dash.charts.volume")}</h3>
          <div className="flex gap-4 text-xs text-zinc-400">
            <span>{t("dash.charts.collected")} <b className="text-emerald-300">{formatKz(totalPaid)}</b></span>
            <span>{t("dash.charts.awaiting")} <b className="text-amber-300">{formatKz(totalPending)}</b></span>
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
              <Bar dataKey="paid" name={t("dash.charts.collectedLegend")} stackId="rev" fill="#34d399" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" name={t("dash.charts.awaitingLegend")} stackId="rev" fill="#eab308" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <div className="card p-6">
          <h3 className="font-semibold text-zinc-50">{t("dash.charts.funnel")}</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="stage" tickFormatter={funnelLabel} tick={{ fill: "#e4e4e7", fontSize: 12 }} tickLine={false} axisLine={false} width={86} />
                <Tooltip {...ChartTooltipStyle()} labelFormatter={(label) => funnelLabel(String(label))} />
                <Bar dataKey="count" name={t("dash.charts.leadsLegend")} radius={[0, 6, 6, 0]}>
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
          <h3 className="font-semibold text-zinc-50">{t("dash.charts.mrr")}</h3>
          {plans.length === 0 ? (
            <p className="mt-8 text-center text-sm text-zinc-500">{t("dash.charts.mrrEmpty")}</p>
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
        <IncomeTable rows={income} title={t("dash.income.byMethod")} />
        <IncomeTable rows={byClient} title={t("dash.income.byClient")} />
      </div>
    </motion.div>
  );
}

// ---------- AI Agents ----------

const AGENT_SLUGS: Record<string, string> = {
  "Lead Qualifier": "lead_qualifier",
  "Insight Engine": "insight_engine",
  "Error Handler": "error_handler",
  "Growth & Marketing": "growth_marketing",
};
const slug = (name: string): string => AGENT_SLUGS[name] ?? name.toLowerCase().replace(/\s+/g, "_");

function AgentsTab({ activity, memory }: { activity: Activity[]; memory: AgentMemoryRow[] }) {
  const t = useT();
  const tAny = useTAny();
  const [section, setSection] = useState<"agents" | "academy">("agents");
  const agents = useMemo(() => agentStatus(activity), [activity]);
  const academy = useMemo(() => academyState(activity, memory), [activity, memory]);
  const memoryFor = (agentSlug: string): AgentMemoryRow[] =>
    memory.filter((m) => m.agent === agentSlug);
  const activeAgents = agents.filter((agent) => agent.runs > 0 && !agent.stale).length;
  const runtimePlan = useMemo(() => buildAgentPromptPlan({ agent: "product_studio", sessionId: "dashboard-session", currentTask: "assemble evidence-driven product pack", leads: [], clients: [], orders: [], activity, memoryCount: memory.length }), [activity, memory.length]);
  const agentName = (name: string): string => {
    const v = tAny(`agents.names.${slug(name)}`);
    return typeof v === "string" ? v : name;
  };
  const sections: Array<"agents" | "academy"> = ["agents", "academy"];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
      {/* Sub-menu do módulo: Agentes | Academia IA */}
      <div className="flex flex-wrap items-center gap-2">
        {sections.map((id) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            aria-current={section === id ? "true" : undefined}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              section === id
                ? "border-gold-500/60 bg-gold-500/15 text-gold-300"
                : "border-white/10 bg-ink-900/70 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
            }`}
          >
            {t(`academy.tab${id === "agents" ? "Agents" : "Academy"}`)}
          </button>
        ))}
      </div>
      {section === "academy" ? <AcademyView academy={academy} /> : null}
      {section === "agents" ? (
      <>
      <section className="card overflow-hidden border-gold-500/20 p-6" aria-labelledby="autonomy-heading">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                <Zap size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">{t("dash.agents.protocol")}</p>
                <h2 id="autonomy-heading" className="mt-1 text-lg font-bold text-zinc-50">{t("dash.agents.ready")}</h2>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{t("dash.agents.body")}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            {activeAgents > 0 ? `${activeAgents} ${t("dash.agents.activeCount")}` : t("dash.agents.scheduled")}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {([
            [t("dash.agents.observe"), t("dash.agents.observeDesc")],
            [t("dash.agents.learn"), t("dash.agents.learnDesc")],
            [t("dash.agents.act"), t("dash.agents.actDesc")],
          ] as Array<[string, string]>).map(([title, description]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-zinc-100">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("dash.agents.safety")}</p>
        <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4" aria-label="Prompt runtime status">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-sky-300">{t("dash.agents.promptTitle")}</p><span className="badge bg-sky-500/10 text-sky-300">Static prefix v1</span></div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{t("dash.agents.promptBody")}</p>
          <div className="mt-3 grid gap-2 text-[11px] text-zinc-500 sm:grid-cols-3"><span>{t("dash.agents.tools")} {runtimePlan.tools.length}</span><span>{t("dash.agents.cacheKey")} {runtimePlan.cacheKey}</span><span>{t("dash.agents.bytes")} {runtimePlan.cacheableBytes}</span></div>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {agents.map((a) => {
          const stale = a.stale;
          const schedule =
            a.name === "Error Handler"
              ? t("dash.agents.scheduleError")
              : a.name === "Insight Engine"
                ? t("dash.agents.scheduleInsight")
                : a.name === "Growth & Marketing"
                  ? t("dash.agents.scheduleMarketing")
                  : t("dash.agents.scheduleLead");
          return (
            <div key={a.name} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-50">{agentName(a.name)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{schedule} · GitHub Actions</p>
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
                  {a.runs > 0 ? (stale ? t("dash.agents.idle") : t("dash.agents.active")) : t("dash.agents.waiting")}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">{t("dash.agents.runs")}</p>
                  <p className="font-bold text-zinc-100">{a.runs}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">{t("dash.agents.lastRun")}</p>
                  <p className="text-zinc-300">{a.lastRun ? timeAgo(a.lastRun) : "—"}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-400">{a.lastMessage}</p>
              {memoryFor(slug(a.name)).map((m) => (
                <div key={m.key} className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">{t("dash.agents.learned")} {m.key.replace(/_/g, " ")}</p>
                  <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-300">
                    {JSON.stringify(m.value, null, 1)}
                  </pre>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-zinc-500">{t("dash.agents.foot")}</p>
      </>
      ) : null}
    </motion.div>
  );
}

// ---------- AI Academy (submenu: teaching space) ----------

const GRAD_BADGE: Record<AcademyStudent["graduation"], string> = {
  enrolled: "bg-white/10 text-zinc-300",
  in_training: "bg-sky-500/15 text-sky-300",
  trained: "bg-emerald-500/15 text-emerald-300",
};

function AcademyView({ academy }: { academy: ReturnType<typeof academyState> }) {
  const t = useT();
  const gradLabel = (g: AcademyStudent["graduation"]): string =>
    t(`academy.graduation.${g}`);
  return (
    <div className="space-y-4">
      {/* Professor IA card */}
      <section className="card overflow-hidden border-cyan-500/20 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
              <GraduationCap size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">{t("academy.tabAcademy")}</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-50">{t("academy.teacherCard")}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{t("academy.teacherRole")}</p>
              <p className="mt-1 text-xs text-zinc-500">{t("academy.schedule")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              {t("academy.autonomyBadge")}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">{academy.curriculumVersion}</span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("academy.runs")}</p>
            <p className="text-xl font-bold text-zinc-50">{academy.teacherRuns}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("academy.briefs")}</p>
            <p className="text-xl font-bold text-zinc-50">{academy.teacherBriefsWritten}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("academy.lastClass")}</p>
            <p className="text-sm font-semibold text-zinc-200">{academy.teacherLastRun ? timeAgo(academy.teacherLastRun) : t("academy.noClass")}</p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">{t("academy.autonomy")}</p>
      </section>

      {/* Students */}
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-50">{t("academy.studentsTitle")}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">{t("academy.studentsSub")}</p>
          </div>
          <span className="badge bg-emerald-500/15 text-emerald-300">{academy.trainedCount}/{academy.students.length} {t("academy.graduation.trained").toLowerCase()}</span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {academy.students.map((s) => (
            <div key={s.slug} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-50">{s.agentName}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{t("academy.lessons")}: {s.lessons}</p>
                </div>
                <span className={`badge ${GRAD_BADGE[s.graduation]}`}>{gradLabel(s.graduation)}</span>
              </div>
              {/* Curriculum skills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.skills.map((sk) => (
                  <span
                    key={sk.id}
                    title={sk.learned ? undefined : t("academy.noBrief")}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      sk.learned
                        ? "bg-gold-500/15 text-gold-300"
                        : "border border-white/10 text-zinc-500"
                    }`}
                  >
                    {sk.learned ? "✓ " : "○ "}{sk.id.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              {/* Latest market brief from the AI Teacher */}
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{t("academy.briefTitle")}</p>
                  {s.marketBrief ? (
                    <span className={`badge ${
                      briefFreshness(s.marketBrief.updatedAt) === "fresh"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : briefFreshness(s.marketBrief.updatedAt) === "aging"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-red-500/15 text-red-300"
                    }`}>
                      {t(`academy.freshness.${briefFreshness(s.marketBrief.updatedAt)}`)} · {timeAgo(s.marketBrief.updatedAt)}
                    </span>
                  ) : null}
                </div>
                {s.marketBrief && typeof s.marketBrief.value === "object" && s.marketBrief.value !== null ? (
                  <div className="mt-2 space-y-1.5 text-xs leading-relaxed">
                    {typeof (s.marketBrief.value as Record<string, unknown>).market_state === "string" ? (
                      <p className="text-zinc-300"><span className="font-semibold text-cyan-300">{t("academy.marketState")}: </span>{String((s.marketBrief.value as Record<string, unknown>).market_state)}</p>
                    ) : null}
                    {typeof (s.marketBrief.value as Record<string, unknown>).instruction === "string" ? (
                      <p className="text-zinc-300"><span className="font-semibold text-cyan-300">{t("academy.instruction")}: </span>{String((s.marketBrief.value as Record<string, unknown>).instruction)}</p>
                    ) : null}
                    {typeof (s.marketBrief.value as Record<string, unknown>).avoid === "string" ? (
                      <p className="text-zinc-500"><span className="font-semibold">{t("academy.avoid")}: </span>{String((s.marketBrief.value as Record<string, unknown>).avoid)}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">{t("academy.noBrief")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <BookOpen size={18} className="text-cyan-400" /> {t("academy.howTitle")}
        </h3>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[t("academy.step1"), t("academy.step2"), t("academy.step3"), t("academy.step4")].map((step, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-300">{i + 1}</span>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">{step}</p>
            </li>
          ))}
        </ol>
      </section>
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
  const t = useT();
  return (
    <div className="mt-8">
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowNew(!showNew)} className="btn-primary !px-4 !py-2 text-xs">
          <Plus size={14} /> {t("dash.clientsTab.new")}
        </button>
      </div>

      {showNew ? (
        <form onSubmit={onNew} className="card mb-6 grid gap-4 p-6 sm:grid-cols-3">
          <div>
            <label className="label">{t("dash.clientsTab.name")}</label>
            <input name="name" required className="input" placeholder="Acme Lda" />
          </div>
          <div>
            <label className="label">{t("dash.clientsTab.email")}</label>
            <input name="email" type="email" required className="input" placeholder="billing@acme.com" />
          </div>
          <div>
            <label className="label">{t("dash.clientsTab.plan")}</label>
            <select name="plan" className="input" defaultValue="professional">
              {Object.entries(PLAN_PRICES).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label} — {formatKz(p.monthly)}{t("dash.clientsTab.perMonth")}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              <CheckCircle2 size={16} /> {t("dash.clientsTab.create")}
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
                {t(`dash.statusClient.${c.status}`)}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="rounded-lg bg-white/5 px-2.5 py-1 font-medium capitalize text-gold-300">{c.plan}</span>
              <span className="font-bold text-zinc-100">{formatKz(c.mrr)}<span className="text-xs font-normal text-zinc-500">{t("dash.clientsTab.perMonth")}</span></span>
            </div>
          </div>
        ))}
        {clients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-zinc-500">{t("dash.clientsTab.empty")}</p>
          </div>
        ) : null}
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
  const t = useT();
  const methodLabel = (method: string): string => {
    const key = `dash.orders.methods.${method}`;
    const v = t(key);
    return v === key ? method : v;
  };
  return (
    <div className="mt-8 space-y-6">
      <form onSubmit={onNew} className="card grid gap-4 p-6 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">{t("dash.orders.client")}</label>
          <select name="client_id" className="input">
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="">{t("dash.orders.walkin")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("dash.orders.amount")}</label>
          <input name="amount" type="number" min="1000" step="1" required className="input" placeholder="29160" />
        </div>
        <div>
          <label className="label">{t("dash.orders.method")}</label>
          <select name="method" className="input">
            <option value="multicaixa">{t("dash.orders.methods.multicaixa")}</option>
            <option value="paypay">{t("dash.orders.methods.paypay")}</option>
            <option value="card">{t("dash.orders.methods.card")}</option>
            <option value="wire_usd">{t("dash.orders.methods.wire_usd")}</option>
            <option value="wire_eur">{t("dash.orders.methods.wire_eur")}</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            <Plus size={16} /> {t("dash.orders.create")}
          </button>
        </div>
      </form>

      {/* Official receiving accounts for invoicing / customer support */}
      <div className="card p-6">
        <PaymentDetails detailed />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-5 py-4">{t("dash.orders.thRef")}</th>
              <th className="px-5 py-4">{t("dash.orders.thClient")}</th>
              <th className="px-5 py-4">{t("dash.orders.thAmount")}</th>
              <th className="px-5 py-4">{t("dash.orders.thMethod")}</th>
              <th className="px-5 py-4">{t("dash.orders.thStatus")}</th>
              <th className="px-5 py-4">{t("dash.orders.thAction")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-white/5 transition hover:bg-white/5">
                <td className="px-5 py-4 font-mono text-xs text-zinc-300">{o.reference}</td>
                <td className="px-5 py-4 text-zinc-200">{o.client_name}</td>
                <td className="px-5 py-4 font-semibold text-zinc-100">{formatKz(o.amount)}</td>
                <td className="px-5 py-4 text-zinc-400">{methodLabel(o.method)}</td>
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
                    {t(`dash.statusOrder.${o.status}`)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {o.status === "pending" ? (
                    <button
                      onClick={() => onMarkPaid(o.id)}
                      className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
                    >
                      {t("dash.orders.markPaid")}
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

// ---------- Product packs ----------

function ProductPacksTab({ leads, clients, orders, activity }: { leads: Lead[]; clients: Client[]; orders: Order[]; activity: Activity[] }) {
  const t = useT();
  const tAny = useTAny();
  const [stage, setStage] = useState<ProductPackStage>("brief");
  const [niche, setNiche] = useState("small business operations");
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");
  const evidence = useMemo(() => productPackEvidence(leads, clients, orders, activity), [leads, clients, orders, activity]);
  const risks = useMemo(() => productPackRisks(evidence, Boolean(audience.trim() && problem.trim())), [evidence, audience, problem]);
  const stageIds: ProductPackStage[] = ["brief", "evidence", "assembly", "review", "ready"];
  const stages = ((tAny("dash.packs.stages") as Array<[string, string]>) ?? []).filter(Array.isArray);
  const currentIndex = stageIds.indexOf(stage);
  const canAdvance = stage === "brief" ? Boolean(niche.trim() && audience.trim() && problem.trim()) : risks.every((risk) => !risk.blocking);
  const next = () => setStage(stageIds[Math.min(currentIndex + 1, stageIds.length - 1)]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      <section className="card overflow-hidden border-gold-500/20 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <span className="badge border border-gold-500/30 bg-gold-500/10 text-gold-300">{t("dash.packs.badge")}</span>
            <h2 className="mt-3 text-2xl font-bold text-zinc-50">{t("dash.packs.title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("dash.packs.sub")}</p>
          </div>
          <Package className="text-gold-400" size={32} aria-hidden="true" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label><span className="label">{t("dash.packs.niche")}</span><input value={niche} onChange={(event) => setNiche(event.target.value)} className="input" /></label>
          <label><span className="label">{t("dash.packs.audience")}</span><input value={audience} onChange={(event) => setAudience(event.target.value)} className="input" placeholder={t("dash.packs.audiencePh")} /></label>
          <label><span className="label">{t("dash.packs.problem")}</span><input value={problem} onChange={(event) => setProblem(event.target.value)} className="input" placeholder={t("dash.packs.problemPh")} /></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={next} disabled={!canAdvance || currentIndex === stageIds.length - 1} className="btn-primary disabled:cursor-not-allowed disabled:opacity-40">{t("dash.packs.advance")} <ArrowRight size={16} /></button>
          <button type="button" onClick={() => { setStage("brief"); setAudience(""); setProblem(""); }} className="btn-ghost">{t("dash.packs.reset")}</button>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-5" aria-label="Product pack stages">
        {stages.map(([name, description], index) => (
          <div key={name} className={`card p-4 ${index <= currentIndex ? "border-gold-500/40" : "opacity-60"}`}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-300">{index + 1}</span>
              <span className="text-sm font-semibold text-zinc-100">{name}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{description}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-50">{t("dash.packs.evTitle")}</h3>
              <p className="mt-1 text-xs text-zinc-500">{t("dash.packs.evSub")}</p>
            </div>
            <span className="badge bg-white/10 text-zinc-300">{evidence.reduce((sum, item) => sum + item.recordCount, 0)} {t("dash.packs.records")}</span>
          </div>
          <div className="mt-5 space-y-3">
            {evidence.map((item) => {
              const src = tAny(`dash.packs.sources.${item.source}`);
              return (
                <div key={item.source} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold capitalize text-zinc-100">{typeof src === "string" ? src : item.source}</span>
                    <span className="text-xs text-zinc-500">{item.recordCount} {t("dash.packs.recordsShort")} {item.freshness}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.observedSignal}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-50"><ShieldCheck size={17} className="text-gold-400" /> {t("dash.packs.risks")}</h3>
          <div className="mt-4 space-y-3">
            {risks.map((risk) => {
              const entry = tAny(`dash.packs.risksDict.${risk.id}`) as [string, string] | undefined;
              const label = Array.isArray(entry) ? entry[0] : risk.label;
              const detail = Array.isArray(entry) ? entry[1] : risk.detail;
              return (
                <div key={risk.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className={risk.blocking ? "text-amber-400" : "text-zinc-500"} />
                    <span className="text-sm font-semibold text-zinc-200">{label}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{detail}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="card p-6">
        <h3 className="font-semibold text-zinc-50">{t("dash.packs.deliv")}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(((tAny("dash.packs.delivItems") as string[]) ?? [])).map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-zinc-200">{item}</p>
              <p className="mt-2 text-xs text-zinc-500">{t("dash.packs.delivNote")}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("dash.packs.delivFoot")}</p>
      </section>
    </motion.div>
  );
}

// ---------- Operations (AI Manager: missions, delivery QA, skills.sh) ----------

const QA_CHECK_KEYS = ["order_paid", "client_registered", "amount_matches_pack", "product_operational"] as const;

function OpsTab({ memory, deliveries }: { memory: AgentMemoryRow[]; deliveries: DeliveryRow[] }) {
  const t = useT();
  const tAny = useTAny();
  const ops = useMemo(() => opsState(memory, deliveries), [memory, deliveries]);
  const agentName = (slug: string): string => {
    const v = tAny(`agents.names.${slug}`);
    return typeof v === "string" ? v : slug;
  };
  const str = (obj: Record<string, unknown>, key: string): string =>
    typeof obj[key] === "string" ? String(obj[key]) : "";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
      {/* Manager card */}
      <section className="card overflow-hidden border-violet-500/20 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
              <Crown size={24} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-400">{t("ops.menu")}</p>
              <h2 className="mt-1 text-lg font-bold text-zinc-50">{t("ops.managerCard")}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{t("ops.managerRole")}</p>
              <p className="mt-1 text-xs text-zinc-500">{t("ops.schedule")}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            {t("ops.assignedBy")}
          </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{t("ops.sub")}</p>
      </section>

      {/* Missions */}
      <section>
        <h3 className="font-semibold text-zinc-50">{t("ops.missionsTitle")}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{t("ops.missionsSub")}</p>
        {ops.missions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">{t("ops.noMissions")}</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {ops.missions.map((m) => (
              <div key={m.agent} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-zinc-50">{agentName(m.agent)}</p>
                  <span className="badge bg-violet-500/15 text-violet-300">{str(m.value, "bottleneck") || "—"}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300"><span className="font-semibold text-violet-300">{t("ops.objective")}: </span>{str(m.value, "objective")}</p>
                {str(m.value, "directive") ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400"><span className="font-semibold">{t("ops.directive")}: </span>{str(m.value, "directive")}</p>
                ) : null}
                <p className="mt-3 text-[11px] text-zinc-500">{t("ops.assignedBy")} · {timeAgo(m.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delivery QA */}
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
              <ShieldCheck size={18} className="text-emerald-400" /> {t("ops.qaTitle")}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">{t("ops.qaSub")}</p>
          </div>
          <div className="flex gap-2">
            <span className="badge bg-white/10 text-zinc-300">{t("ops.qaPending")}: {ops.qaPending}</span>
            <span className="badge bg-emerald-500/15 text-emerald-300">{t("ops.qaPassed")}: {ops.qaPassed}</span>
            <span className="badge bg-red-500/15 text-red-300">{t("ops.qaFailed")}: {ops.qaFailed}</span>
          </div>
        </div>
        {ops.deliveries.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">{t("ops.qaAwaiting")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">{t("ops.qaClient")}</th>
                  <th className="px-4 py-3">{t("ops.qaPack")}</th>
                  <th className="px-4 py-3">{t("dash.orders.thAmount")}</th>
                  <th className="px-4 py-3">{t("ops.qaChecks")}</th>
                  <th className="px-4 py-3">{t("ops.qaVerified")}</th>
                </tr>
              </thead>
              <tbody>
                {ops.deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-white/5 transition hover:bg-white/5">
                    <td className="px-4 py-3.5 font-medium text-zinc-100">{d.client_name}</td>
                    <td className="px-4 py-3.5"><span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs font-medium capitalize text-gold-300">{d.pack}</span></td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-100">{formatKz(d.amount)}</td>
                    <td className="px-4 py-3.5">
                      {d.qa_status === "pending" ? (
                        <span className="badge bg-white/10 text-zinc-400">{t("ops.qaPending")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {QA_CHECK_KEYS.map((k) => {
                            const ok = d.checks[k];
                            const label = t(`ops.checksLabels.${k}`);
                            if (ok === undefined) return null;
                            return (
                              <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                {ok ? "✓" : "✕"} {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500">{d.verified_at ? timeAgo(d.verified_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Skills from skills.sh */}
      <section>
        <h3 className="font-semibold text-zinc-50">{t("ops.skillsTitle")}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{t("ops.skillsSub")}</p>
        {ops.skills.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">{t("ops.skillsNone")}</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {ops.skills.map((s) => {
              const found = Array.isArray(s.value.skills_found) ? (s.value.skills_found as Array<Record<string, unknown>>) : [];
              const rec = s.value.recommended_skill && typeof s.value.recommended_skill === "object" ? (s.value.recommended_skill as Record<string, unknown>) : null;
              return (
                <div key={s.agent} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-zinc-50">{agentName(s.agent)}</p>
                    <span className={`badge ${skillFreshness(s.updated_at) === "fresh" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {timeAgo(s.updated_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">{t("ops.ecosystem")}: {str(s.value, "ecosystem") || "skills.sh"}</p>
                  {found.length > 0 ? (
                    <p className="mt-2 text-xs text-zinc-400">{t("ops.skillsFound")}: {found.reduce((n, f) => n + (Array.isArray(f.top) ? f.top.length : 0), 0)} · {found.map((f) => str(f, "query")).filter(Boolean).slice(0, 3).join(" · ")}</p>
                  ) : null}
                  {rec ? (
                    <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">{t("ops.skillsRecommended")}</p>
                      <p className="mt-1 font-mono text-xs text-zinc-200">{String(rec.source ?? "")} / {String(rec.id ?? "")} <span className="text-zinc-500">({String(rec.installs ?? "0")} installs)</span></p>
                      {s.value.instructions && typeof s.value.instructions === "object" && typeof (s.value.instructions as Record<string, unknown>).excerpt === "string" ? (
                        <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-400">{String((s.value.instructions as Record<string, unknown>).excerpt).slice(0, 400)}</pre>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How the autonomous cycle works */}
      <section className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <Crown size={18} className="text-violet-400" /> {t("ops.howTitle")}
        </h3>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[t("ops.step1"), t("ops.step2"), t("ops.step3"), t("ops.step4")].map((step, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">{i + 1}</span>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}

// ---------- Ecosystem ----------

const LOOP_STAGES = [
  { id: "capture", icon: Target, tone: "text-emerald-400" },
  { id: "qualify", icon: Zap, tone: "text-gold-400" },
  { id: "convert", icon: Users, tone: "text-sky-400" },
  { id: "collect", icon: CircleDollarSign, tone: "text-emerald-400" },
  { id: "learn", icon: Cpu, tone: "text-gold-400" },
] as const;

function EcosystemTab({
  metrics,
  leads,
  orders,
  activity,
  memory,
  realtime,
}: {
  metrics: Metric;
  leads: Lead[];
  orders: Order[];
  activity: Activity[];
  memory: AgentMemoryRow[];
  realtime: ConnState;
}) {
  const t = useT();
  const tAny = useTAny();
  const pulse = todayPulse(leads, orders, activity);
  const stageCounts: Record<string, string> = {
    capture: `${metrics.leads} ${t("dash.leadsTab.company")} · ${pulse.leadsToday} ${t("dash.today.leads").toLowerCase()}`,
    qualify: `${metrics.qualifiedLeads} ${t("dash.eco.qualifiedShort")}`,
    convert: `${metrics.activeClients} ${t("dash.eco.activeClients")} ${formatKz(metrics.mrr)} MRR`,
    collect: `${formatKz(metrics.revenue30d)} ${t("dash.eco.collected30")}`,
    learn: `${memory.length} ${t("dash.eco.memoryEntries")} ${pulse.botRunsToday} ${t("dash.eco.runsToday")}`,
  };
  const bots = agentStatus(activity);
  const agentName = (name: string): string => {
    const v = tAny(`agents.names.${slug(name)}`);
    return typeof v === "string" ? v : name;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-8">
      {/* The autonomous loop — live stage by stage */}
      <div className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <Network size={18} className="text-gold-400" /> {t("dash.eco.title")}
        </h3>
        <p className="mt-1 text-sm text-zinc-400">{t("dash.eco.sub")}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {LOOP_STAGES.map((s, i) => {
            const entry = tAny(`dash.eco.${s.id}`) as [string, string] | undefined;
            const name = Array.isArray(entry) ? entry[0] : s.id;
            const what = Array.isArray(entry) ? entry[1] : "";
            return (
              <div key={s.id} className="relative">
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-gold-500/40">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${s.tone}`}>
                      <s.icon size={18} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{i + 1}. {name}</span>
                  </div>
                  <p className="mt-3 flex-1 text-xs leading-relaxed text-zinc-400">{what}</p>
                  <p className={`mt-3 text-sm font-bold ${s.tone}`}>{stageCounts[s.id]}</p>
                </div>
                <ArrowRight size={16} className="absolute -right-[26px] top-1/2 hidden -translate-y-1/2 text-zinc-600 lg:block" />
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          <RefreshCcw size={11} className="mr-1 inline" />
          {t("dash.eco.loopNote")}
        </p>
      </div>

      {/* Live infrastructure status */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={17} className="text-emerald-400" />
              <p className="text-sm font-semibold text-zinc-100">{t("dash.eco.realtime")}</p>
            </div>
            <span
              className={`badge ${
                realtime === "live"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : realtime === "connecting"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-red-500/15 text-red-300"
              }`}
            >
              {realtime === "live" ? t("dash.live") : realtime === "connecting" ? t("dash.connecting") : t("dash.offline")}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{t("dash.eco.realtimeBody")}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Bot size={17} className="text-sky-400" />
            <p className="text-sm font-semibold text-zinc-100">{t("dash.eco.agentsCard")}</p>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {bots.map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-2">
                <span className="text-zinc-300">{agentName(b.name)}</span>
                <span className={b.runs > 0 ? "text-emerald-300" : "text-zinc-500"}>
                  {b.runs > 0 ? `${b.runs} ${t("dash.eco.runsShort")} ${timeAgo(b.lastRun!)}` : t("dash.eco.awaitingFirst")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Gauge size={17} className="text-gold-400" />
            <p className="text-sm font-semibold text-zinc-100">{t("dash.eco.cc")}</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">{t("dash.eco.ccBody")}</p>
        </div>
      </div>

      {/* Authorized growth channels — never imply access that is not connected */}
      <div className="card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
              <Target size={18} className="text-gold-400" /> {t("dash.eco.channels")}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">{t("dash.eco.channelsSub")}</p>
          </div>
          <span className="badge bg-amber-500/15 text-amber-300">{t("dash.eco.consent")}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            [t("dash.eco.chSeo"), t("dash.eco.chSeoDesc"), t("dash.eco.statusPlanning")],
            [t("dash.eco.chEmail"), t("dash.eco.chEmailDesc"), t("dash.eco.statusNotConnected")],
            [t("dash.eco.chShopify"), t("dash.eco.chShopifyDesc"), t("dash.eco.statusNotConnected")],
            [t("dash.eco.chSocial"), t("dash.eco.chSocialDesc"), t("dash.eco.statusNotConnected")],
          ] as Array<[string, string, string]>).map(([name, description, status]) => (
            <div key={name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{name}</p>
                <span className={`h-2 w-2 rounded-full ${status === t("dash.eco.statusPlanning") ? "bg-gold-400" : "bg-zinc-600"}`} aria-label={status} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
              <p className={`mt-3 text-[11px] font-semibold uppercase tracking-wide ${status === t("dash.eco.statusPlanning") ? "text-gold-300" : "text-zinc-500"}`}>{status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What the agents have learned so far — straight from agent_memory */}
      <div className="card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
          <Cpu size={18} className="text-gold-400" /> {t("dash.eco.learned")}
        </h3>
        {memory.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{t("dash.eco.learnedEmpty")}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {memory.map((m) => (
              <div key={`${m.agent}-${m.key}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-300">{m.agent}</p>
                <p className="mt-1 text-sm font-medium text-zinc-200">{m.key.replace(/_/g, " ")}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-zinc-400">
                  {typeof m.value === "string" ? m.value : JSON.stringify(m.value, null, 2)}
                </pre>
                <p className="mt-2 text-[11px] text-zinc-500">{t("dash.eco.updated")} {timeAgo(m.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
