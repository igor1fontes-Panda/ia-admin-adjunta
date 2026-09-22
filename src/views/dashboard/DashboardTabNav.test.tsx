import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { DashboardTabNav, type DashboardTab } from "./DashboardTabNav";

it("renders all dashboard sections and marks the active tab", () => {
  let active: DashboardTab = "overview";
  const { rerender } = render(<DashboardTabNav tab={active} setTab={(next) => { active = typeof next === "function" ? next(active) : next; }} />);
  expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "AI Agents" })).toBeInTheDocument();
  rerender(<DashboardTabNav tab="agents" setTab={() => undefined} />);
  expect(screen.getByRole("button", { name: "AI Agents" })).toHaveAttribute("aria-current", "page");
});
