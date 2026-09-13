import { Link, useNavigate } from "react-router-dom";
import { Bot, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isLive, supabase } from "../lib/data";

export function Header() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

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
      <Link to="/" className="text-sm text-zinc-300 transition hover:text-gold-400">
        Home
      </Link>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-gold-400"
      >
        <LayoutDashboard size={15} /> Dashboard
      </Link>
      {email ? (
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition hover:text-gold-400"
        >
          <LogOut size={15} /> Sign out
        </button>
      ) : null}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500 text-ink-950 glow-gold">
            <Bot size={20} />
          </span>
          <span className="text-sm font-bold tracking-wide text-zinc-50 sm:text-base">
            Fontes AI <span className="text-gold-400">Admin Adjunta</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">{links}</nav>
        <div className="hidden md:block">
          {email ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs font-semibold text-gold-300 transition hover:bg-gold-500/20"
              title="Open your command center"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-ink-950">
                {email.slice(0, 1).toUpperCase()}
              </span>
              {email.length > 24 ? `${email.slice(0, 24)}…` : email}
            </Link>
          ) : (
            <Link to="/auth" className="btn-primary !px-4 !py-2 text-xs">
              Get started
            </Link>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-ink-950 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">{links}</div>
          {email ? (
            <Link
              to="/dashboard"
              className="btn-primary mt-3 w-full"
              onClick={() => setOpen(false)}
            >
              Open command center
            </Link>
          ) : (
            <Link to="/auth" className="btn-primary mt-3 w-full" onClick={() => setOpen(false)}>
              Get started
            </Link>
          )}
        </div>
      ) : null}
    </header>
  );
}
