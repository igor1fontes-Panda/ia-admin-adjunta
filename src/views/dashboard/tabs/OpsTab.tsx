import { useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, ShieldCheck } from "lucide-react";
import { useT, useTAny } from "../../../lib/i18n";
import { formatKz, opsState, skillFreshness, timeAgo, type DeliveryRow } from "../../../lib/engine";
import type { AgentMemoryRow } from "../../../lib/data";

// ---------- Operations (AI Manager: missions, delivery QA, skills.sh) ----------

export const QA_CHECK_KEYS = ["order_paid", "client_registered", "amount_matches_pack", "product_operational"] as const;

export function OpsTab({ memory, deliveries }: { memory: AgentMemoryRow[]; deliveries: DeliveryRow[] }) {
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
          <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
            {t("ops.noMissions")}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {ops.missions.map((m) => (
              <div key={m.agent} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-zinc-50">{agentName(m.agent)}</p>
                  <span className="badge bg-violet-500/15 text-violet-300">{str(m.value, "bottleneck") || "—"}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  <span className="font-semibold text-violet-300">{t("ops.objective")}: </span>
                  {str(m.value, "objective")}
                </p>
                {str(m.value, "directive") ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    <span className="font-semibold">{t("ops.directive")}: </span>
                    {str(m.value, "directive")}
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-zinc-500">
                  {t("ops.assignedBy")} · {timeAgo(m.updated_at)}
                </p>
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
            <span className="badge bg-white/10 text-zinc-300">
              {t("ops.qaPending")}: {ops.qaPending}
            </span>
            <span className="badge bg-emerald-500/15 text-emerald-300">
              {t("ops.qaPassed")}: {ops.qaPassed}
            </span>
            <span className="badge bg-red-500/15 text-red-300">
              {t("ops.qaFailed")}: {ops.qaFailed}
            </span>
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
                    <td className="px-4 py-3.5">
                      <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs font-medium capitalize text-gold-300">
                        {d.pack}
                      </span>
                    </td>
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
                              <span
                                key={k}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                              >
                                {ok ? "✓" : "✕"} {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500">
                      {d.verified_at ? timeAgo(d.verified_at) : "—"}
                    </td>
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
          <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
            {t("ops.skillsNone")}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {ops.skills.map((s) => {
              const found = Array.isArray(s.value.skills_found)
                ? (s.value.skills_found as Array<Record<string, unknown>>)
                : [];
              const rec =
                s.value.recommended_skill && typeof s.value.recommended_skill === "object"
                  ? (s.value.recommended_skill as Record<string, unknown>)
                  : null;
              return (
                <div key={s.agent} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-zinc-50">{agentName(s.agent)}</p>
                    <span
                      className={`badge ${skillFreshness(s.updated_at) === "fresh" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
                    >
                      {timeAgo(s.updated_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
                    {t("ops.ecosystem")}: {str(s.value, "ecosystem") || "skills.sh"}
                  </p>
                  {found.length > 0 ? (
                    <p className="mt-2 text-xs text-zinc-400">
                      {t("ops.skillsFound")}: {found.reduce((n, f) => n + (Array.isArray(f.top) ? f.top.length : 0), 0)}{" "}
                      ·{" "}
                      {found
                        .map((f) => str(f, "query"))
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {rec ? (
                    <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                        {t("ops.skillsRecommended")}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-200">
                        {String(rec.source ?? "")} / {String(rec.id ?? "")}{" "}
                        <span className="text-zinc-500">({String(rec.installs ?? "0")} installs)</span>
                      </p>
                      {s.value.instructions &&
                      typeof s.value.instructions === "object" &&
                      typeof (s.value.instructions as Record<string, unknown>).excerpt === "string" ? (
                        <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-400">
                          {String((s.value.instructions as Record<string, unknown>).excerpt).slice(0, 400)}
                        </pre>
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
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">
                {i + 1}
              </span>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </motion.div>
  );
}
