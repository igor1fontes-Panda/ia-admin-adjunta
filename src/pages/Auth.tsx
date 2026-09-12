import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bot, Mail, Lock, ShieldAlert } from "lucide-react";
import { isLive, supabase } from "../lib/data";

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isLive && supabase) {
        if (mode === "signup") {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          // With "Confirm email" disabled, signUp returns a session immediately —
          // sign the user straight in instead of telling them to re-sign-in.
          if (data.session) {
            navigate(from, { replace: true });
            return;
          }
          setNotice("Account created! Check your email to confirm, then sign in.");
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          navigate(from, { replace: true });
        }
      } else {
        throw new Error(
          "Accounts are disabled until the database is connected (see dashboard setup steps).",
        );
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-8 glow-gold">
        <div className="flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500 text-ink-950">
            <Bot size={26} />
          </span>
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold text-zinc-50">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-400">
          {mode === "signin"
            ? "Sign in to your AI admin command center."
            : "Start automating your sales in minutes."}
        </p>

        {!isLive ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            Real accounts require the database connection. Follow the setup steps on the dashboard.
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                id="email"
                type="email"
                required
                className="input pl-10"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                id="password"
                type="password"
                required
                minLength={4}
                className="input pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {notice}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-400">
          {mode === "signin" ? (
            <>
              No account yet?{" "}
              <button
                className="font-semibold text-gold-400 hover:underline"
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already registered?{" "}
              <button
                className="font-semibold text-gold-400 hover:underline"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link to="/" className="hover:text-zinc-300">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
