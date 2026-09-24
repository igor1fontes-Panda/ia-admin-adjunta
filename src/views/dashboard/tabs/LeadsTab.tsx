import type { Lead } from "../../../types";
import { useT } from "../../../lib/i18n";

// ---------- Leads ----------

export function LeadsTab({ leads, onStatus }: { leads: Lead[]; onStatus: (id: string, s: Lead["status"]) => void }) {
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
                      <span className="ml-1.5 rounded bg-gold-500/15 px-1.5 py-0.5 font-mono text-[10px] text-gold-300">
                        {t("dash.leadsTab.aiTag")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={l.status}
                      onChange={(e) => onStatus(l.id, e.target.value as Lead["status"])}
                      className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      {(["new", "contacted", "qualified", "won", "lost"] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`dash.statusLead.${s}`)}
                        </option>
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
