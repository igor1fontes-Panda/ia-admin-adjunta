import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { setLang } from "../../../lib/i18n";
import type { AgentMemoryRow } from "../../../lib/data";
import type { Activity } from "../../../types";
import { AgentsTab } from "./AgentsTab";

function activityRow(kind: Activity["kind"], message: string, minutesAgo = 5): Activity {
  return {
    id: `a-${message.slice(0, 8)}`,
    kind,
    message,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

function memoryRow(agent: string, key: string, value: unknown): AgentMemoryRow {
  return { agent, key, value, updated_at: new Date().toISOString() };
}

afterEach(() => {
  cleanup();
  setLang("pt");
});

it("renders the autonomy protocol and one card per agent from real activity rows (PT)", () => {
  const activity: Activity[] = [
    activityRow("bot", "Lead qualifier: scored 3 new lead(s) using neutral priors."),
    activityRow("bot", "Error handler: triaged 1 incident."),
  ];
  render(<AgentsTab activity={activity} memory={[]} />);

  // Autonomy protocol section is present with the PT copy.
  expect(screen.getByRole("heading", { name: "Os agentes estão prontos para aprender e agir" })).toBeInTheDocument();
  // Four agents derive from the engine (Lead Qualifier, Insight Engine, Error Handler, Growth & Marketing).
  expect(screen.getByText("Qualificador de Leads")).toBeInTheDocument();
  expect(screen.getByText("Gestor de Erros")).toBeInTheDocument();
  expect(screen.getByText("Motor de Insights")).toBeInTheDocument();
  expect(screen.getByText("Agente de Crescimento & Marketing")).toBeInTheDocument();
  // Agents with recent runs show the active badge; the other two are waiting.
  expect(screen.getAllByText("ativo")).toHaveLength(2);
  expect(screen.getAllByText("à espera")).toHaveLength(2);
});

it("shows no-run agents honestly as waiting when activity is empty", () => {
  render(<AgentsTab activity={[]} memory={[]} />);
  expect(screen.getAllByText("à espera")).toHaveLength(4);
  expect(screen.getAllByText("0")).toHaveLength(4);
});

it("toggles between the Agents and Academy sections", async () => {
  const user = userEvent.setup();
  render(<AgentsTab activity={[]} memory={[]} />);

  // Agents section is visible by default; Academy is not.
  expect(screen.getByText("Protocolo de autonomia")).toBeInTheDocument();
  expect(screen.queryByText("Professor IA")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Academia IA" }));
  expect(screen.getByRole("heading", { name: "Professor IA" })).toBeInTheDocument();
  expect(screen.getByText("Alunos")).toBeInTheDocument();
  expect(screen.queryByText("Protocolo de autonomia")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Agentes" }));
  expect(screen.getByText("Protocolo de autonomia")).toBeInTheDocument();
  expect(screen.queryByText("Professor IA")).not.toBeInTheDocument();
});

it("renders learned memory per agent exactly as the bots wrote it", () => {
  const memory: AgentMemoryRow[] = [memoryRow("lead_qualifier", "channel_conversion", { referral: 8, email: -2 })];
  render(<AgentsTab activity={[activityRow("bot", "Lead qualifier: scored 2 new lead(s).")]} memory={memory} />);

  // The "Learned:" card labels the memory key with underscores replaced.
  expect(screen.getByText(/Aprendido: channel conversion/i)).toBeInTheDocument();
  expect(screen.getByText(/"referral": 8/)).toBeInTheDocument();
});
