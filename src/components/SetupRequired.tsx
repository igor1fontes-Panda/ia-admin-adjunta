import { Database, ExternalLink } from "lucide-react";

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

        <ol className="mt-6 space-y-4 text-sm">
          <li className="rounded-xl border border-white/10 bg-ink-800 p-4">
            <p className="font-semibold text-zinc-100">1. Create the tables</p>
            <p className="mt-1 text-zinc-400">
              Open your Supabase project → SQL Editor and run{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gold-300">
                supabase/migrations/0001_init.sql
              </code>{" "}
              from this repository.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-ink-800 p-4">
            <p className="font-semibold text-zinc-100">2. Add the keys</p>
            <p className="mt-1 text-zinc-400">
              From Supabase → Project Settings → API, add{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gold-300">VITE_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gold-300">VITE_SUPABASE_ANON_KEY</code>{" "}
              to the environment settings, then restart.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-ink-800 p-4">
            <p className="font-semibold text-zinc-100">3. Reload this page</p>
            <p className="mt-1 text-zinc-400">
              The dashboard, auth and lead capture go live automatically — real accounts, real leads, real orders.
            </p>
          </li>
        </ol>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="btn-primary mt-6"
        >
          Open Supabase Dashboard <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}
