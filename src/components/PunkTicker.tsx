const ITEMS = [
  "🤖 BOTS A TRABALHAR 24/7",
  "⚡ LEAD HUNTER · DIÁRIO 06:00 UTC",
  "🔥 ERROR HANDLER · DE HORA A HORA",
  "💀 0 INCIDENTES · 99.98% UPTIME",
  "⚡ GEMINI INTERACTIONS API",
  "🤖 IA NOS SEUS DADOS REAIS",
];

export function PunkTicker() {
  return (
    <div
      className="overflow-hidden border-y border-gold-500/25 bg-ink-900/90 py-2.5 backdrop-blur"
      aria-hidden="true"
    >
      <div className="punk-ticker gap-10">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-10">
            {ITEMS.map((item, i) => (
              <span
                key={`${copy}-${i}`}
                className={`whitespace-nowrap text-xs font-bold uppercase tracking-[0.22em] ${
                  i % 3 === 0 ? "text-gold-400" : i % 3 === 1 ? "text-pink-400" : "text-cyan-300"
                }`}
              >
                {item}
                <span className="ml-10 text-white/20">✦</span>
              </span>
            ))}
          </div>
           ))}
      </div>
    </div>
  );
}
