import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isLive, supabase } from "../lib/data";
import { useT } from "../lib/i18n";
import { usePreferences } from "../lib/i18n";

export function Header() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const t = useT();
  const { locale, theme, setLocale, toggleTheme } = usePreferences();

  useEffect(() => {
    if (!isLive || !supabase) return;
    const sb = supabase;
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (mounted) setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (isLive && supabase) {
      await supabase.auth.signOut();
    }
    navigate("/");
  }

  const links = (
    <>
      <Link to="/" className="text-sm text-zinc-300 transition hover:text-cyan-300">
        {t("nav.home")}
      </Link>
      <a href="/#features" className="text-sm text-zinc-300 transition hover:text-cyan-300">{t("nav.products")}</a>
      <a href="/#pricing" className="text-sm text-zinc-300 transition hover:text-cyan-300">{t("nav.store")}</a>
      <a href="/#ecosystem" className="text-sm text-zinc-300 transition hover:text-cyan-300">{t("nav.agents")}</a>
      <a href="/#lead-form" className="text-sm text-zinc-300 transition hover:text-cyan-300">{t("nav.services")}</a>
      <a href="/#payments" className="text-sm text-zinc-300 transition hover:text-cyan-300">{t("nav.support")}</a>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-cyan-300"
      >
        <LayoutDashboard size={15} /> {t("nav.dashboard")}
      </Link>
      {email ? (
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-gold-400"
        >
          <LogOut size={15} /> {t("nav.signOut")}
        </button>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="brand-mark glow-gold" aria-label="Fontes AI Admin Adjunta">
            <span className="brand-orbit" aria-hidden="true" />
            <span className="brand-letter brand-letter-f">F</span>
            <span className="brand-letter brand-letter-a">A</span>
            <Sparkles size={11} aria-hidden="true" />
          </span>
          <span className="brand-wordmark text-xs font-bold tracking-wide text-zinc-50 sm:text-sm">
            Fontes <span className="text-cyan-300">AI</span> <span className="text-fuchsia-400">Admin Adjunta</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">{links}</nav>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1" aria-label="Idioma">
            <button type="button" onClick={() => setLocale("pt")} aria-pressed={locale === "pt"} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${locale === "pt" ? "bg-cyan-400 text-ink-950" : "text-zinc-400"}`}>PT</button>
            <button type="button" onClick={() => setLocale("en")} aria-pressed={locale === "en"} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${locale === "en" ? "bg-cyan-400 text-ink-950" : "text-zinc-400"}`}>EN</button>
          </div>
          <button type="button" onClick={toggleTheme} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300" aria-label={theme === "dark" ? "Tema claro" : "Tema noturno"} title={theme === "dark" ? "Tema claro" : "Tema noturno"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <div className="hidden md:block">
          {email ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs font-semibold text-gold-300 transition hover:bg-gold-500/20"
              title={t("nav.openCC")}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-ink-950">
                {email.slice(0, 1).toUpperCase()}
              </span>
              {email.length > 24 ? `${email.slice(0, 24)}…` : email}
            </Link>
          ) : (
            <Link to="/auth" className="btn-primary !px-4 !py-2 text-xs">
              {t("nav.getStarted")}
            </Link>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("nav.toggleMenu")}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-ink-950 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">{links}</div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1" aria-label="Idioma">
                <button type="button" onClick={() => setLocale("pt")} aria-pressed={locale === "pt"} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${locale === "pt" ? "bg-cyan-400 text-ink-950" : "text-zinc-400"}`}>PT</button>
                <button type="button" onClick={() => setLocale("en")} aria-pressed={locale === "en"} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${locale === "en" ? "bg-cyan-400 text-ink-950" : "text-zinc-400"}`}>EN</button>
              </div>
              <button type="button" onClick={toggleTheme} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-300" aria-label={theme === "dark" ? "Tema claro" : "Tema noturno"}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
            {email ? (
              <Link
                to="/dashboard"
                className="btn-primary flex-1 justify-center !py-2 text-xs"
                onClick={() => setOpen(false)}
              >
                {t("nav.openCC")}
              </Link>
            ) : (
              <Link to="/auth" className="btn-primary flex-1 justify-center !py-2 text-xs" onClick={() => setOpen(false)}>
                {t("nav.getStarted")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
