import { CheckCircle2, Plus } from "lucide-react";
import type { Client } from "../../../types";
import { PLAN_PRICES, formatKz } from "../../../lib/engine";
import { useT } from "../../../lib/i18n";

// ---------- Clients ----------

export function ClientsTab({
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
        <form onSubmit={onNew} noValidate className="card mb-6 grid gap-4 p-6 sm:grid-cols-3">
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
                  {p.label} — {formatKz(p.monthly)}
                  {t("dash.clientsTab.perMonth")}
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
              <span className="font-bold text-zinc-100">
                {formatKz(c.mrr)}
                <span className="text-xs font-normal text-zinc-500">{t("dash.clientsTab.perMonth")}</span>
              </span>
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
