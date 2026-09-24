import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Cpu,
  Database,
  Gauge,
  Network,
  RefreshCcw,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { Activity, Lead, Metric, Order } from "../../../types";
import type { AgentMemoryRow } from "../../../lib/data";
import type { ConnState } from "../../Dashboard";
import { useT, useTAny } from "../../../lib/i18n";
import { agentStatus, formatKz, timeAgo, todayPulse } from "../../../lib/engine";

export const LOOP_STAGES = [
  { id: "capture", icon: Target, tone: "text-emerald-400" },
  { id: "qualify", icon: Zap, tone: "text-gold-400" },
  { id: "convert", icon: Users, tone: "text-sky-400" },
  { id: "collect", icon: CircleDollarSign, tone: "text-emerald-400" },
  { id: "learn", icon: Cpu, tone: "text-gold-400" },
] as const;
import { slug } from "./AgentsTab";

export function EcosystemTab({
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
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      {i + 1}. {name}
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-xs leading-relaxed text-zinc-400">{what}</p>
                  <p className={`mt-3 text-sm font-bold ${s.tone}`}>{stageCounts[s.id]}</p>
                </div>
                <ArrowRight
                  size={16}
                  className="absolute -right-[26px] top-1/2 hidden -translate-y-1/2 text-zinc-600 lg:block"
                />
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
              {realtime === "live"
                ? t("dash.live")
                : realtime === "connecting"
                  ? t("dash.connecting")
                  : t("dash.offline")}
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
                  {b.runs > 0
                    ? `${b.runs} ${t("dash.eco.runsShort")} ${timeAgo(b.lastRun!)}`
                    : t("dash.eco.awaitingFirst")}
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
          {(
            [
              [t("dash.eco.chSeo"), t("dash.eco.chSeoDesc"), t("dash.eco.statusPlanning")],
              [t("dash.eco.chEmail"), t("dash.eco.chEmailDesc"), t("dash.eco.statusNotConnected")],
              [t("dash.eco.chShopify"), t("dash.eco.chShopifyDesc"), t("dash.eco.statusNotConnected")],
              [t("dash.eco.chSocial"), t("dash.eco.chSocialDesc"), t("dash.eco.statusNotConnected")],
            ] as Array<[string, string, string]>
          ).map(([name, description, status]) => (
            <div key={name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{name}</p>
                <span
                  className={`h-2 w-2 rounded-full ${status === t("dash.eco.statusPlanning") ? "bg-gold-400" : "bg-zinc-600"}`}
                  aria-label={status}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
              <p
                className={`mt-3 text-[11px] font-semibold uppercase tracking-wide ${status === t("dash.eco.statusPlanning") ? "text-gold-300" : "text-zinc-500"}`}
              >
                {status}
              </p>
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
                <p className="mt-2 text-[11px] text-zinc-500">
                  {t("dash.eco.updated")} {timeAgo(m.updated_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
