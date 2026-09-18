import type { ReactNode } from "react";
import type { DashboardTab } from "./DashboardTabNav";

export type DashboardTabContentProps = {
  tab: DashboardTab;
  panels: Partial<Record<DashboardTab, ReactNode>>;
};

export function DashboardTabContent({ tab, panels }: DashboardTabContentProps) {
  return <section aria-live="polite">{panels[tab] ?? null}</section>;
}
