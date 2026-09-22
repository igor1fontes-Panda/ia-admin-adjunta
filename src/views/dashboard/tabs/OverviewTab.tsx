import { motion } from "framer-motion";
import { Activity as ActivityIcon, ArrowRight, BarChart3, Bot, CheckCircle2, Circle, CircleDollarSign, Target, TrendingUp, Users, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Activity, Client, Lead, Metric, Order } from "../../../types";
import { formatKz, leadsPerDay, timeAgo, type OnboardingStep, type Pulse } from "../../../lib/engine";
import type { Tab } from "../../Dashboard";
import { useT, useTAny } from "../../../lib/i18n";

// ---------- Overview ----------

export function Overview({
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

