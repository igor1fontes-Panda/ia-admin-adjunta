import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLang } from "../../lib/i18n";
import { DashboardTabNav, type DashboardTab } from "./DashboardTabNav";

afterEach(() => {
  cleanup();
  setLang("pt");
});

it("renders all dashboard sections and marks the active tab (PT por defeito)", () => {
  setLang("pt");
  let active: DashboardTab = "overview";
  const { rerender } = render(<DashboardTabNav tab={active} setTab={(next) => { active = typeof next === "function" ? next(active) : next; }} />);
  expect(screen.getByRole("button", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Agentes IA" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "GodsEye Nano" })).toBeInTheDocument();
  rerender(<DashboardTabNav tab="agents" setTab={() => undefined} />);
  expect(screen.getByRole("button", { name: "Agentes IA" })).toHaveAttribute("aria-current", "page");
});

it("renders translated labels when the language is EN", () => {
  setLang("en");
  render(<DashboardTabNav tab="overview" setTab={() => undefined} />);
  expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "AI Agents" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Product packs" })).toBeInTheDocument();
});
