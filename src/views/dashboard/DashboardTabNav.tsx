import type { Dispatch, SetStateAction } from "react";

export type DashboardTab = "overview" | "packs" | "leads" | "charts" | "clients" | "orders" | "agents" | "ecosystem" | "godseye";

const tabs: Array<[DashboardTab, string]> = [
  ["overview", "Overview"],
  ["packs", "Product packs"],
  ["leads", "Leads"],
  ["charts", "Analytics"],
  ["clients", "Clients"],
  ["orders", "Orders"],
  ["agents", "AI Agents"],
  ["ecosystem", "Ecosystem"],
  ["godseye", "GodsEye Nano"],
];

export function DashboardTabNav({ tab, setTab }: { tab: DashboardTab; setTab: Dispatch<SetStateAction<DashboardTab>> }) {
  return (
    <nav aria-label="Dashboard sections" className="mt-8 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/80 p-1">
      {tabs.map(([value, label]) => (
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
      ))}
    </nav>
  );
}
