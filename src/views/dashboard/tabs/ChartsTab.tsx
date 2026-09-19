import { useMemo } from "react";
import { motion } from "framer-motion";
import {
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
import { useT } from "../../../lib/i18n";
import { formatKz, incomeByClient, incomeByMethod, mrrByPlan, pipelineFunnel, revenuePerDay, type IncomeRow } from "../../../lib/engine";
import type { Client, Lead, Order } from "../../../types";

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

export function ChartsTab({ leads, orders, clients }: { leads: Lead[]; orders: Order[]; clients: Client[] }) {
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

