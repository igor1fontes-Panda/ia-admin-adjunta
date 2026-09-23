import type { Dispatch, SetStateAction } from "react";
import { useTAny } from "../../lib/i18n";

export type DashboardTab = "overview" | "packs" | "leads" | "charts" | "clients" | "orders" | "agents" | "ecosystem" | "godseye";

const tabs: DashboardTab[] = ["overview", "packs", "leads", "charts", "clients", "orders", "agents", "ecosystem", "godseye"];


export function DashboardTabNav({ tab, setTab }: { tab: DashboardTab; setTab: Dispatch<SetStateAction<DashboardTab>> }) {
  const tAny = useTAny();
  const menuLabel = tAny("dash.menu");
  return (
    <nav aria-label={typeof menuLabel === "string" ? menuLabel : "Modules"} className="mt-8 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/80 p-1">
      {tabs.map((value) => {
        const copy = tAny(`dash.modules.${value}`);
        const label = Array.isArray(copy) && typeof copy[0] === "string" ? copy[0] : value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === value ? "bg-gold-500 text-ink-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
