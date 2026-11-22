import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, Lock, Mail, ShieldAlert } from "lucide-react";
import { ADMIN_EMAIL, authConfigured, signInAdmin } from "../lib/auth-client";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInAdmin(ADMIN_EMAIL, password);
      navigate(from, { replace: true });
    } catch (cause) {
      setError(errorMessage(cause, "Falha na autenticação."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-md p-8 glow-gold">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4 text-gold-300">
            <Bot size={30} />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("auth.title")}</h1>
          <p className="mt-2 text-sm text-zinc-400">{t("auth.subtitle")}</p>
        </div>

        {!authConfigured ? (
          <p
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          >
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            Neon Managed Auth não está configurado neste ambiente.
          </p>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t("auth.email")}
            </span>
            <span className="relative block">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input className="input w-full pl-10" type="email" value={ADMIN_EMAIL} readOnly autoComplete="username" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t("auth.password")}
            </span>
            <span className="relative block">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="input w-full pl-10"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </span>
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy || !authConfigured || !password} className="btn-primary w-full">
            {busy ? t("auth.wait") : t("auth.signIn")}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Acesso reservado à identidade administrativa autorizada.
        </p>
      </div>
    </div>
  );
}
