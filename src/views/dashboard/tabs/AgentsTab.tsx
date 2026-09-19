import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Zap } from "lucide-react";
import { useT, useTAny } from "../../../lib/i18n";
import { academyState, agentStatus, briefFreshness, buildAgentPromptPlan, timeAgo, type AcademyStudent } from "../../../lib/engine";
import type { Activity } from "../../../types";
import type { AgentMemoryRow } from "../../../lib/data";

// ---------- AI Agents ----------

export const AGENT_SLUGS: Record<string, string> = {
  "Lead Qualifier": "lead_qualifier",
  "Insight Engine": "insight_engine",
  "Error Handler": "error_handler",
  "Growth & Marketing": "growth_marketing",
};
export const slug = (name: string): string => AGENT_SLUGS[name] ?? name.toLowerCase().replace(/\s+/g, "_");

export function AgentsTab({ activity, memory }: { activity: Activity[]; memory: AgentMemoryRow[] }) {
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

export function AcademyView({ academy }: { academy: ReturnType<typeof academyState> }) {
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

