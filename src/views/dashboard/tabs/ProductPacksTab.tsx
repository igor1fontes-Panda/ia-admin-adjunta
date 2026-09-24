import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Package, ShieldCheck } from "lucide-react";
import type { Activity, Client, Lead, Order, ProductPackStage } from "../../../types";
import { useT, useTAny } from "../../../lib/i18n";
import { productPackEvidence, productPackRisks } from "../../../lib/engine";

// ---------- Product packs ----------

export function ProductPacksTab({
  leads,
  clients,
  orders,
  activity,
}: {
  leads: Lead[];
  clients: Client[];
  orders: Order[];
  activity: Activity[];
}) {
  const t = useT();
  const tAny = useTAny();
  const [stage, setStage] = useState<ProductPackStage>("brief");
  const [niche, setNiche] = useState("small business operations");
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");
  const evidence = useMemo(
    () => productPackEvidence(leads, clients, orders, activity),
    [leads, clients, orders, activity],
  );
  const risks = useMemo(
    () => productPackRisks(evidence, Boolean(audience.trim() && problem.trim())),
    [evidence, audience, problem],
  );
  const stageIds: ProductPackStage[] = ["brief", "evidence", "assembly", "review", "ready"];
  const stages = ((tAny("dash.packs.stages") as Array<[string, string]>) ?? []).filter(Array.isArray);
  const currentIndex = stageIds.indexOf(stage);
  const canAdvance =
    stage === "brief"
      ? Boolean(niche.trim() && audience.trim() && problem.trim())
      : risks.every((risk) => !risk.blocking);
  const next = () => setStage(stageIds[Math.min(currentIndex + 1, stageIds.length - 1)]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
      <section className="card overflow-hidden border-gold-500/20 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <span className="badge border border-gold-500/30 bg-gold-500/10 text-gold-300">
              {t("dash.packs.badge")}
            </span>
            <h2 className="mt-3 text-2xl font-bold text-zinc-50">{t("dash.packs.title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("dash.packs.sub")}</p>
          </div>
          <Package className="text-gold-400" size={32} aria-hidden="true" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label>
            <span className="label">{t("dash.packs.niche")}</span>
            <input value={niche} onChange={(event) => setNiche(event.target.value)} className="input" />
          </label>
          <label>
            <span className="label">{t("dash.packs.audience")}</span>
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="input"
              placeholder={t("dash.packs.audiencePh")}
            />
          </label>
          <label>
            <span className="label">{t("dash.packs.problem")}</span>
            <input
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              className="input"
              placeholder={t("dash.packs.problemPh")}
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || currentIndex === stageIds.length - 1}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("dash.packs.advance")} <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("brief");
              setAudience("");
              setProblem("");
            }}
            className="btn-ghost"
          >
            {t("dash.packs.reset")}
          </button>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-5" aria-label="Product pack stages">
        {stages.map(([name, description], index) => (
          <div key={name} className={`card p-4 ${index <= currentIndex ? "border-gold-500/40" : "opacity-60"}`}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-300">
                {index + 1}
              </span>
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
            <span className="badge bg-white/10 text-zinc-300">
              {evidence.reduce((sum, item) => sum + item.recordCount, 0)} {t("dash.packs.records")}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {evidence.map((item) => {
              const src = tAny(`dash.packs.sources.${item.source}`);
              return (
                <div key={item.source} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold capitalize text-zinc-100">
                      {typeof src === "string" ? src : item.source}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {item.recordCount} {t("dash.packs.recordsShort")} {item.freshness}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.observedSignal}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card p-6">
          <h3 className="flex items-center gap-2 font-semibold text-zinc-50">
            <ShieldCheck size={17} className="text-gold-400" /> {t("dash.packs.risks")}
          </h3>
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
          {((tAny("dash.packs.delivItems") as string[]) ?? []).map((item) => (
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
