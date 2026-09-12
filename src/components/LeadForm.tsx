import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { isLive, submitLead } from "../lib/data";

/**
 * Public lead-capture form. Writes a REAL row into the Supabase `leads`
 * table (anonymous insert is allowed by RLS; reads are not). The daily
 * qualifier bot then scores it with AI automatically.
 */
export function LeadForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isLive) {
      setError("The database is not connected yet — follow the setup steps on the dashboard.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await submitLead({
        company: String(fd.get("company") || "").trim(),
        contact_name: String(fd.get("contact_name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        niche: String(fd.get("niche") || "SaaS"),
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Could not submit — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center glow-gold">
        <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
        <h3 className="mt-4 text-xl font-bold text-zinc-50">Request received!</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
          Your request is now a real lead in our system. Our AI qualifier will score
          it automatically and our team will contact you within one business day.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h3 className="text-xl font-bold text-zinc-50">See your business on autopilot</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Tell us about your company — we'll come back with a personalized automation plan.
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lf-company">Company</label>
          <input id="lf-company" name="company" required className="input" placeholder="Acme Lda" />
        </div>
        <div>
          <label className="label" htmlFor="lf-name">Your name</label>
          <input id="lf-name" name="contact_name" required className="input" placeholder="Maria Silva" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="lf-email">Work email</label>
          <input id="lf-email" name="email" type="email" required className="input" placeholder="maria@acme.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="lf-niche">Your niche</label>
          <select id="lf-niche" name="niche" className="input" defaultValue="SaaS">
            <option value="SaaS">SaaS / Technology</option>
            <option value="Fintech">Fintech / Finance</option>
            <option value="Healthcare">Healthcare</option>
            <option value="E-commerce">E-commerce / Retail</option>
            <option value="Logistics">Logistics</option>
            <option value="Agencies">Agencies / Services</option>
          </select>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 sm:col-span-2">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {busy ? "Sending…" : "Request free automation audit"}
        </button>
      </form>
    </div>
  );
}
