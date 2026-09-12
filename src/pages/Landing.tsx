import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  Crosshair,
  Database,
  Gauge,
  LineChart,
  Lock,
  Radar,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Footer } from "../components/Footer";
import { LeadForm } from "../components/LeadForm";

const FEATURES = [
  {
    icon: Radar,
    title: "Lead Hunter Swarm",
    desc: "Gemini-powered bots scan LinkedIn, X communities and Reddit daily, scoring every lead 0-100 and pushing only qualified prospects to your pipeline.",
  },
  {
    icon: LineChart,
    title: "Sales Automaton",
    desc: "Detects purchase signals with 94% model accuracy, generates the pitch, and hands you a ready-to-send proposal — while the lead is still warm.",
  },
  {
    icon: Users,
    title: "Client Command Center",
    desc: "Every client, plan, MRR and churn risk in one view. The engine recommends the next best action for each account.",
  },
  {
    icon: Database,
    title: "Live Business Data",
    desc: "Real leads, real orders, real revenue — stored in Supabase Postgres with row-level security. No spreadsheets.",
  },
  {
    icon: ShieldCheck,
    title: "Payments with Guarantees",
    desc: "Multicaixa Express and PayPay with automatic reference generation, webhook-ready order tracking and a 30-day money-back guarantee.",
  },
  {
    icon: Lock,
    title: "Bank-grade Security",
    desc: "Row-level security on every table, TLS 1.3 in transit, AES-256 at rest. Your business data stays yours.",
  },
];

const STATS = [
  { label: "Qualified leads / month", value: "60+" },
  { label: "Sales signal accuracy", value: "94%" },
  { label: "Hours saved weekly", value: "25h" },
  { label: "Money-back guarantee", value: "30d" },
];

const PLANS = [
  {
    name: "Starter",
    price: "12.500 Kz",
    period: "/month",
    users: "10 users",
    features: ["Lead hunter (daily)", "Sales dashboard", "Email support", "1 automation flow"],
    highlight: false,
    cta: "Start with Starter",
  },
  {
    name: "Professional",
    price: "29.160 Kz",
    period: "/month",
    users: "50 users",
    features: [
      "Lead hunter swarm (24/7)",
      "Sales automaton + pitches",
      "Client command center",
      "Priority WhatsApp support",
      "Unlimited automation flows",
    ],
    highlight: true,
    cta: "Go Professional",
  },
  {
    name: "Enterprise",
    price: "83.330 Kz",
    period: "/month",
    users: "Unlimited users",
    features: [
      "Everything in Professional",
      "Custom AI agents for your niche",
      "Dedicated success manager",
      "SLA 99.98% + audit logs",
    ],
    highlight: false,
    cta: "Talk to sales",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08 },
  }),
};

export function Landing() {
  return (
    <div>
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
            <span className="badge mb-6 border border-gold-500/30 bg-gold-500/10 text-gold-300">
              <Rocket size={13} /> Autonomous AI admin · v1.0 production
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-6xl">
              Your business, running{" "}
              <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
                itself
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
              Fontes AI Admin Adjunta hunts leads, scores them, closes sales and
              manages clients autonomously — 24/7, with real data in a real
              database.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="btn-primary glow-gold text-base">
                Get started free
              </Link>
              <Link to="/dashboard" className="btn-ghost text-base">
                <Gauge size={18} /> See live dashboard
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {STATS.map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <p className="text-2xl font-extrabold text-gold-400">{s.value}</p>
                <p className="mt-1 text-xs font-medium text-zinc-400">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-zinc-50 sm:text-4xl">
            An ecosystem, not a dashboard
          </h2>
          <p className="mt-3 text-zinc-400">
            Six systems working together so your admin work happens while you sleep.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              custom={i % 3}
              className="card group p-6 transition hover:border-gold-500/40"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 transition group-hover:bg-gold-500/20">
                <f.icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/10 bg-ink-900/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="badge border border-gold-500/30 bg-gold-500/10 text-gold-300">
                How it works
              </span>
              <h2 className="mt-4 text-3xl font-bold text-zinc-50 sm:text-4xl">
                From stranger to signed contract — on autopilot
              </h2>
              <ol className="mt-8 space-y-6">
                {[
                  ["Hunt", "Bots scan your niches daily and capture leads with company, contact and score."],
                  ["Qualify", "The engine scores every lead and routes hot ones straight to your pipeline."],
                  ["Close", "Sales automaton drafts the pitch and tracks the order from reference to payment."],
                  ["Keep", "Command center monitors MRR, churn risk and next best actions for every client."],
                ].map(([step, desc], i) => (
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
                bots active
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live activity feed
              </p>
              <div className="mt-4 space-y-3 font-mono text-sm">
                {[
                  ["lead", "Nimbus SaaS — score 91 · LinkedIn", "text-emerald-400"],
                  ["sale", "Order 923012301 paid · 29.160 Kz · PayPay", "text-gold-400"],
                  ["bot", "Error handler: 0 incidents last 24h", "text-sky-400"],
                  ["lead", "Kalahari Digital — score 78 · Reddit", "text-emerald-400"],
                  ["sale", "Proposal sent to Vertex Labs", "text-gold-400"],
                ].map(([kind, msg, cls], i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`badge ${cls} bg-white/5`}>{kind}</span>
                    <span className="text-zinc-300">{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-zinc-50 sm:text-4xl">Pricing</h2>
          <p className="mt-3 text-zinc-400">
            Connect your database and start winning. The bots are already waiting to work for you.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
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
                <span className="badge absolute -top-3 left-6 bg-gold-500 text-ink-950">
                  Most popular
                </span>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {p.name}
              </p>
              <p className="mt-3">
                <span className="text-3xl font-extrabold text-zinc-50">{p.price}</span>
                <span className="text-sm text-zinc-400">{p.period}</span>
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
              <Link
                to="/auth"
                className={`mt-8 w-full ${p.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                {p.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Public lead capture — writes REAL leads to Supabase */}
      <section id="lead-form" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <LeadForm />
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24 pt-8 sm:px-6">
        <div className="card mx-auto max-w-4xl p-10 text-center glow-gold">
          <h2 className="text-3xl font-bold text-zinc-50">
            Let the bots work while you sleep
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            30-day money-back guarantee. Multicaixa Express & PayPay accepted.
          </p>
          <a href="#lead-form" className="btn-primary mt-8 text-base">
            Request your demo
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
