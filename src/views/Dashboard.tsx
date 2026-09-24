import { useCallback, useEffect, useRef, useState } from "react";
import type { Activity, Client, Lead, Metric, Order } from "../types";
import type { AgentMemoryRow } from "../lib/data";
import { errorMessage } from "../lib/errors";
import { createClient, createOrder, fetchActivity, fetchAgentMemory, fetchClients, fetchDeliveryStatus, fetchLeads, fetchOrders, markOrderPaid, updateLeadStatus } from "../lib/data";
import { parseClientForm, parseOrderForm } from "../lib/schemas";
import { useT, useTAny } from "../lib/i18n";
import { DashboardTabNav, type DashboardTab } from "./dashboard/DashboardTabNav";
import { DashboardTabContent } from "./dashboard/DashboardTabContent";
import { RefreshCcw, AlertTriangle, LayoutGrid } from "lucide-react";
import type { DeliveryRow } from "../lib/engine";
import { computeMetrics, onboardingSteps, todayPulse } from "../lib/engine";
import { Overview } from "./dashboard/tabs/OverviewTab";
import { LeadsTab } from "./dashboard/tabs/LeadsTab";
import { ChartsTab } from "./dashboard/tabs/ChartsTab";
import { ClientsTab } from "./dashboard/tabs/ClientsTab";
import { OrdersTab } from "./dashboard/tabs/OrdersTab";
import { AgentsTab } from "./dashboard/tabs/AgentsTab";
import { ProductPacksTab } from "./dashboard/tabs/ProductPacksTab";
import { OpsTab } from "./dashboard/tabs/OpsTab";
import { EcosystemTab } from "./dashboard/tabs/EcosystemTab";
import { GodsEyeTab } from "./dashboard/tabs/GodsEyeTab";

export type Tab = DashboardTab | "ops";
export type ConnState = "connecting" | "live" | "offline";

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
      const msg = errorMessage(e, "Failed to load data from the API");
      if (/relation .* does not exist|could not find the table|schema cache|does not exist/i.test(msg)) {
        setError(
          "Database tables are not created yet. One-time setup: run `npx drizzle-kit push` against your Neon database (DATABASE_URL), then refresh. The command center fills with your real data immediately after.",
        );
      } else {
        setError(msg);
      }
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
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

  // Live updates — serverless API has no push channel, so poll every 15s.
  // Auto-recovery: polling continues after outages with no manual refresh.
  useEffect(() => {
    if (realtime === "offline") return;
    const id = setInterval(() => {
      load();
    }, 15_000);
    return () => clearInterval(id);
  }, [load, realtime]);

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

  // Reflect the polling connection state without extra state slots.
  useEffect(() => {
    setRealtime("live");
  }, []);

  function handleNewClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(async () => {
      // Validate at the boundary: reject malformed input before any API call.
      const input = parseClientForm(fd);
      const client = await createClient(input);
      setClients((cs) => [client, ...cs]);
      setShowNewClient(false);
      form.reset();
    });
  }

  function handleNewOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(async () => {
      // Validate at the boundary; the walk-in client_id/name defaulting is
      // handled by the schema adapter.
      const input = parseOrderForm(fd);
      const clientName =
        input.client_name !== ""
          ? input.client_name
          : (clients.find((c) => c.id === input.client_id)?.name ?? "Walk-in");
      const order = await createOrder({ ...input, client_name: clientName });
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

  const tabs: Tab[] = ["overview", "packs", "leads", "charts", "clients", "orders", "agents", "ops", "ecosystem", "godseye"];

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
          godseye: <GodsEyeTab leads={leads} orders={orders} />,
        }}
      />
      {tab === "ops" ? <OpsTab memory={memory} deliveries={deliveries} /> : null}
    </div>
  );
}

