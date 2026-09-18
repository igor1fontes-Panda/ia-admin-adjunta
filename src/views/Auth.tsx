import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bot, Mail, Lock, ShieldAlert } from "lucide-react";
import { authSignIn, authSignUp } from "../lib/data";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const t = useT();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError(t("auth.errEmail"));
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError(t("auth.errPassword"));
      setBusy(false);
      return;
    }
    try {
      if (mode === "signup") {
        await authSignUp(normalizedEmail, password, name.trim() || normalizedEmail.split("@")[0]);
      } else {
        await authSignIn(normalizedEmail, password);
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(errorMessage(err, t("auth.errGeneric")));
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
          {mode === "signin" ? t("auth.welcome") : t("auth.create")}
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-400">
          {mode === "signin" ? t("auth.signinSub") : t("auth.signupSub")}
        </p>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          {t("auth.dbNotice")}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <div>
              <label className="label" htmlFor="name">{t("leadForm.name")}</label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Igor Fontes"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : null}
          <div>
            <label className="label" htmlFor="email">{t("auth.email")}</label>
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
            <label className="label" htmlFor="password">{t("auth.password")}</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                id="password"
                type="password"
                required
                minLength={8}
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

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("auth.wait") : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-400">
          {mode === "signin" ? (
            <>
              {t("auth.noAccount")}{" "}
              <button
                className="font-semibold text-gold-400 hover:underline"
                onClick={() => setMode("signup")}
              >
                {t("auth.signupLink")}
              </button>
            </>
          ) : (
            <>
              {t("auth.hasAccount")}{" "}
              <button
                className="font-semibold text-gold-400 hover:underline"
                onClick={() => setMode("signin")}
              >
                {t("auth.signinLink")}
              </button>
            </>
          )}
        </p>

        <p className="mt-6 text-center text-xs text-zinc-500">
          <Link to="/" className="hover:text-zinc-300">{t("auth.back")}</Link>
        </p>
      </div>
    </div>
  );
}
