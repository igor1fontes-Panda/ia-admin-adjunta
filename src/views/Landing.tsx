import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crosshair,
  Database,
  Gauge,
  LineChart,
  Lock,
  Palette,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Footer } from "../components/Footer";
import { PaymentDetails } from "../components/PaymentDetails";
import { CheckoutButton } from "../components/CheckoutButton";
import { LeadForm } from "../components/LeadForm";
import { PunkTicker } from "../components/PunkTicker";
import { useT, useTAny } from "../lib/i18n";

const FEATURE_ICONS = [Radar, LineChart, Users, Database, ShieldCheck, Lock];
const FEATURE_KEYS = ["leads", "sales", "clients", "data", "payments", "security"] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
};

export function Landing() {
  const t = useT();
  const tAny = useTAny();

  const plans = [
    {
      name: "Starter",
      price: "12.500 Kz",
      users: t("pricing.users.starter"),
      features: tAny("pricing.starter.features") as string[],
      highlight: false,
      cta: t("pricing.starter.cta"),
    },
    {
      name: "Professional",
      price: "29.160 Kz",
      users: t("pricing.users.professional"),
      features: tAny("pricing.professional.features") as string[],
      highlight: true,
      cta: t("pricing.professional.cta"),
    },
    {
      name: "Enterprise",
      price: "83.330 Kz",
      users: t("pricing.users.enterprise"),
      features: tAny("pricing.enterprise.features") as string[],
      highlight: false,
      cta: t("pricing.enterprise.cta"),
    },
  ];

  const labItems = ((tAny("lab.items") as Array<[string, string, string]>) ?? []).filter(Array.isArray);

  return (
    <div>
      {/* Anime punk breaking-news ticker */}
      <PunkTicker />

      {/* Hero */}
      <section className="grid-bg relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-gold-500/15 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="punk-sticker mb-6">
              <Rocket size={13} className="mr-1.5 inline" /> {t("hero.sticker")}
            </span>
            <p className="section-kicker mb-4 text-xs font-semibold text-cyan-300">{t("hero.kicker")}</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-6xl">
              {t("hero.title1")}{" "}
              <span
                className="punk-glitch bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent"
                data-text={t("hero.titleAccent")}
              >
                {t("hero.titleAccent")}
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">{t("hero.sub")}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="btn-primary glow-gold text-base">
                {t("hero.ctaPrimary")}
              </Link>
              <Link to="/dashboard" className="btn-ghost punk-neon text-base">
                <Gauge size={18} /> {t("hero.ctaSecondary")}
              </Link>
            </div>
          </motion.div>

          <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-center">
            <p className="text-sm font-semibold text-amber-200">{t("hero.noticeTitle")}</p>
            <p className="mt-1 text-sm text-amber-100/75">{t("hero.noticeBody")}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-zinc-50 sm:text-4xl">{t("features.title")}</h2>
          <p className="mt-3 text-zinc-400">{t("features.sub")}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <motion.div
                key={key}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                custom={i % 3}
                className="card group p-6 transition hover:border-gold-500/40"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 transition group-hover:bg-gold-500/20">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-zinc-50">{t(`features.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t(`features.${key}.desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosystem" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="card grid gap-6 border-cyan-400/20 p-6 sm:grid-cols-3">
          {(
            [
              [t("eco.market"), t("eco.marketDesc")],
              [t("eco.agents"), t("eco.agentsDesc")],
              [t("eco.projects"), t("eco.projectsDesc")],
            ] as Array<[string, string]>
          ).map(([title, desc]) => (
            <div key={title} className="border-l border-fuchsia-400/40 pl-4">
              <p className="section-kicker text-xs font-semibold text-fuchsia-300">{title}</p>
              <p className="mt-2 text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visual direction board */}
      <section id="visual-lab" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="card overflow-hidden border-fuchsia-400/20 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="badge border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                <Palette size={13} /> {t("lab.badge")}
              </span>
              <h2 className="mt-4 text-3xl font-bold text-zinc-50 sm:text-4xl">{t("lab.title")}</h2>
              <p className="mt-3 max-w-2xl text-zinc-400">{t("lab.sub")}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <Sparkles size={14} /> {t("lab.active")}
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labItems.map(([name, desc, label], index) => (
              <motion.div
                key={name}
                whileHover={{ y: -4 }}
                className={`group rounded-2xl border p-4 ${index === 5 ? "border-cyan-300/60 bg-cyan-300/[0.08] shadow-[0_0_30px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.03]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-zinc-100">{name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-ink-900/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="badge border border-gold-500/30 bg-gold-500/10 text-gold-300">{t("how.badge")}</span>
              <h2 className="mt-4 text-3xl font-bold text-zinc-50 sm:text-4xl">{t("how.title")}</h2>
              <ol className="mt-8 space-y-6">
                {((tAny("how.steps") as Array<[string, string]>) ?? []).filter(Array.isArray).map(([step, desc], i) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-sm font-bold text-gold-400">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-zinc-100">{step}</p>
                      <p className="text-sm text-zinc-400">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="card relative overflow-hidden p-6">
              <div className="absolute right-4 top-4 flex items-center gap-2 text-xs text-zinc-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t("how.liveTag")}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("how.previewLabel")}</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                <p className="font-semibold text-zinc-200">{t("how.previewTitle")}</p>
                <p className="mt-1">{t("how.previewBody")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-zinc-50 sm:text-4xl">{t("pricing.title")}</h2>
          <p className="mt-3 text-zinc-400">{t("pricing.sub")}</p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
              className={`card relative p-6 ${p.highlight ? "border-gold-500/50 glow-gold" : ""}`}
            >
              {p.highlight ? (
                <span className="badge absolute -top-3 left-6 bg-gold-500 text-ink-950">{t("pricing.popular")}</span>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{p.name}</p>
              <p className="mt-3">
                <span className="text-3xl font-extrabold text-zinc-50">{p.price}</span>
                <span className="text-sm text-zinc-400">{t("pricing.period")}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">{p.users}</p>
              <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Crosshair size={15} className="mt-0.5 shrink-0 text-gold-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <CheckoutButton plan={p.name.toLowerCase()} label={p.cta} primary={p.highlight} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Official receiving accounts — where payments for our products go */}
      <section id="payments" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="card p-8">
          <PaymentDetails />
        </div>
      </section>

      {/* Public lead capture — writes REAL leads to Supabase */}
      <section id="lead-form" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <LeadForm />
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24 pt-8 sm:px-6">
        <div className="card mx-auto max-w-4xl p-10 text-center glow-punk">
          <h2 className="text-3xl font-bold text-zinc-50">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">{t("cta.body")}</p>
          <a href="#lead-form" className="btn-primary mt-8 text-base">
            {t("cta.button")}
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
