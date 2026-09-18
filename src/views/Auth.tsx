import { useState } from "react";
  import { Link, useLocation, useNavigate } from "react-router-dom";
  import { Bot, Mail, Lock, ShieldAlert, MailCheck } from "lucide-react";
  import { authSignIn, authSignUp, authResendVerification } from "../lib/data";
  import { NEON_AUTH } from "../lib/auth-client";
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
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resent, setResent] = useState(false);

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
        if (NEON_AUTH) {
          // Managed Neon Auth requires email verification before the first
          // sign-in — show the resend panel instead of navigating.
          setPendingVerification(true);
          return;
        }
      } else {
        await authSignIn(normalizedEmail, password);
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const raw = errorMessage(err, t("auth.errGeneric"));
      if (/EMAIL_NOT_VERIFIED|not verified/i.test(raw)) {
        setPendingVerification(true);
        return;
      }
      setError(raw);
    } finally {
      setBusy(false);
    }
  }

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authResendVerification(email.trim().toLowerCase());
      setResent(true);
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

        {pendingVerification ? (
          <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-200">
              <MailCheck size={16} /> {t("auth.verifyTitle")}
            </p>
            <p className="mt-1 text-xs text-sky-300/90">
              {t("auth.verifyBody")} <span className="font-medium text-sky-100">{email}</span>
            </p>
            {resent ? (
              <p className="mt-2 text-xs font-medium text-emerald-300">{t("auth.resent")}</p>
            ) : (
              <button onClick={resend} disabled={busy} className="mt-3 text-xs font-semibold text-sky-300 underline-offset-2 hover:underline">
                {t("auth.resend")}
              </button>
            )}
          </div>
        ) : null}

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
