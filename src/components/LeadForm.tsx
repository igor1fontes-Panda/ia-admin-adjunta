import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { isLive, submitLead } from "../lib/data";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";
import { firstIssue, leadInputSchema } from "../lib/schemas";

/**
 * Public lead-capture form. Writes a REAL row into the Supabase `leads`
 * table (anonymous insert is allowed by RLS; reads are not). Qualification is
 * only performed when an authorized agent and verifiable source are configured.
 */
export function LeadForm() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isLive) {
      setError(t("leadForm.dbError"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    // Validate at the boundary before hitting the API.
    const parsed = leadInputSchema.safeParse({
      company: String(fd.get("company") || ""),
      contact_name: String(fd.get("contact_name") || ""),
      email: String(fd.get("email") || ""),
      niche: String(fd.get("niche") || "SaaS"),
    });
    if (!parsed.success) {
      setError(firstIssue(parsed.error));
      return;
    }
    setBusy(true);
    try {
      await submitLead(parsed.data);
      setDone(true);
    } catch (err: unknown) {
      setError(errorMessage(err, t("leadForm.retry")));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center glow-gold">
        <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
        <h3 className="mt-4 text-xl font-bold text-zinc-50">{t("leadForm.doneTitle")}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">{t("leadForm.doneBody")}</p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h3 className="text-xl font-bold text-zinc-50">{t("leadForm.title")}</h3>
      <p className="mt-1 text-sm text-zinc-400">{t("leadForm.sub")}</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lf-company">
            {t("leadForm.company")}
          </label>
          <input id="lf-company" name="company" required className="input" placeholder="Acme Lda" />
        </div>
        <div>
          <label className="label" htmlFor="lf-name">
            {t("leadForm.name")}
          </label>
          <input id="lf-name" name="contact_name" required className="input" placeholder="Maria Silva" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="lf-email">
            {t("leadForm.email")}
          </label>
          <input id="lf-email" name="email" type="email" required className="input" placeholder="maria@acme.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="lf-niche">
            {t("leadForm.niche")}
          </label>
          <select id="lf-niche" name="niche" className="input" defaultValue="SaaS">
            <option value="SaaS">{t("leadForm.nicheSaaS")}</option>
            <option value="Fintech">{t("leadForm.nicheFintech")}</option>
            <option value="Healthcare">{t("leadForm.nicheHealth")}</option>
            <option value="E-commerce">{t("leadForm.nicheEcom")}</option>
            <option value="Logistics">{t("leadForm.nicheLogistics")}</option>
            <option value="Agencies">{t("leadForm.nicheAgencies")}</option>
          </select>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 sm:col-span-2">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {busy ? t("leadForm.sending") : t("leadForm.send")}
        </button>
      </form>
    </div>
  );
}
