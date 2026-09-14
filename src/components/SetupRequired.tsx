import { Database } from "lucide-react";

/** Shown instead of fake data when the database is not connected. */
export function SetupRequired({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mx-auto max-w-2xl px-4 ${compact ? "py-8" : "py-16"}`}>
      <div className="card p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
            <Database size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-zinc-50">Database connection required</h2>
            <p className="text-sm text-zinc-400">
              This app runs on real data only — no demo mode, no simulations.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          The live Supabase workspace is not connected in this deployment, so authenticated data, persistence and autonomous delivery are paused. No fake leads, buyers or outreach are shown.
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-ink-800 p-4 text-sm text-zinc-400">
          You can still review the product-pack workflow from the public preview. Connect Supabase and run the repository migrations when you are ready to enable real storage, agent runs and consent-gated outreach.
        </div>
      </div>
    </div>
  );
}
