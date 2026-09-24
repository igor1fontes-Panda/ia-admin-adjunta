#!/usr/bin/env node
/**
 * SKILLS SCOUT (Olheiro de Skills) — connects the team to skills.sh.
 * Runs daily via GitHub Actions (or manually: npm run bot:skills).
 *
 * skills.sh is the open agent-skills directory (the same ecosystem as
 * `npx skills add` — searching it is what the user means by "skills.com").
 * This scout:
 *
 *  1. ASKS THE TEAM — reads each agent's latest mission + market brief from
 *     `agent_memory` and decides which SKILL AREAS the agent needs next
 *     (e.g. bottleneck "closing" → "deal closing and negotiation").
 *  2. SEARCHES skills.sh — GET https://skills.sh/api/search?q=<query>
 *     returns ranked real skills (id, source repo, installs). The scout
 *     records what the ecosystem actually has for each need.
 *  3. FETCHES THE SKILL — for the top result, pulls the real skill content
 *     via `npx skills use <source> --skill <id>` (prints SKILL.md to stdout,
 *     no repo changes) and extracts the commands/prompts the agent needs.
 *  4. TEACHES THE AGENT — writes `skill_entry` into that agent's memory:
 *     the queries used, the skills found (with install counts) and the
 *     actual instructions fetched. On its next run the agent uses the new
 *     techniques — autonomously, no administrative approval.
 *
 * Safety: read-only over skills.sh (public search API + public repos),
 * read-only over our data; it only appends knowledge to agent_memory.
 */
import {
  dbInsertActivity,
  dbRecall,
  dbRemember,
  diagnoseSupabaseError,
  createLogger,
  supabase,
  supabaseReady,
} from "./bot-lib.mjs";

const log = createLogger("skills-scout");
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const started = Date.now();
const SEARCH_API = "https://skills.sh/api/search?q=";

/** Skill queries per funnel stage (matched to the manager's bottleneck). */
const STAGE_QUERIES = {
  traffic: ["lead generation marketing", "audience growth strategy"],
  qualification: ["lead qualification sales", "lead scoring"],
  nurture: ["sales outreach sequence", "cold email best practices"],
  closing: ["deal closing negotiation", "sales proposal writing"],
  collection: ["payment follow up", "invoice collection"],
  scale: ["referral program", "client retention upsell"],
};

/** Per-agent focus, mixed with the team's current bottleneck. */
const AGENT_QUERIES = {
  lead_qualifier: ["lead generation", "lead scoring"],
  growth_marketing: ["growth marketing strategy", "campaign planning"],
  error_handler: ["quality assurance", "incident triage"],
  insight_engine: ["business analytics", "market research"],
};

async function searchSkills(query) {
  try {
    const res = await fetch(`${SEARCH_API}${encodeURIComponent(query)}`);
    if (!res.ok) {
      log(`skills.sh search failed for "${query}": HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const skills = Array.isArray(data?.skills) ? data.skills : [];
    return skills.slice(0, 5).map((s) => ({
      id: String(s.skillId ?? s.id ?? ""),
      source: String(s.source ?? ""),
      installs: Number(s.installs ?? 0),
    }));
  } catch (e) {
    log(`skills.sh search error for "${query}": ${e?.message ?? e}`);
    return [];
  }
}

/** Fetch the real SKILL.md content without installing anything. */
async function fetchSkillContent(source, skillId) {
  if (!source || !skillId) return null;
  try {
    const { stdout } = await run("npx", ["-y", "skills", "use", source, "--skill", skillId], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    const text = String(stdout ?? "").trim();
    if (text.length < 40) return null;
    return text.slice(0, 6000); // keep it memory-sized
  } catch (e) {
    log(`skill fetch failed for ${source}/${skillId}: ${e?.message ?? e}`);
    return null;
  }
}

try {
  log("🧭 skills-scout starting", { supabase: supabaseReady });

  if (!supabaseReady) {
    log("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured — nothing real to scout for. Nothing simulated.");
    process.exit(0);
  }

  const memory = await dbRecall().catch(() => ({}));

  // Current bottleneck: the AI Manager writes it into every mission
  const bottleneck = memory.lead_qualifier?.mission?.bottleneck ?? memory.growth_marketing?.mission?.bottleneck ?? null;
  log(`team bottleneck: ${bottleneck ?? "unknown (manager has not run yet)"}`);

  const memoryByAgent = {};
  for (const [agent, keys] of Object.entries(memory)) {
    memoryByAgent[agent] = keys;
  }

  let taught = 0;
  for (const agent of Object.keys(AGENT_QUERIES)) {
    const mem = memoryByAgent[agent] ?? {};
    const mission = mem.mission ?? null;
    const brief = mem.market_brief ?? null;

    // 1) Queries = agent focus + current bottleneck stage + mission focus
    const queries = [...AGENT_QUERIES[agent]];
    if (bottleneck && STAGE_QUERIES[bottleneck]) {
      queries.push(...STAGE_QUERIES[bottleneck].slice(0, 1));
    }
    const directive = typeof mission?.directive === "string" ? mission.directive : null;
    if (directive) queries.push(directive.split(/[.,;]/)[0].slice(0, 60)); // mission topic as query

    // 2) SEARCH — what does the real ecosystem have for these needs?
    const found = {};
    for (const q of [...new Set(queries)].slice(0, 4)) {
      const results = await searchSkills(q);
      if (results.length) found[q] = results;
    }

    // 3) FETCH the top skill's real instructions (best by installs)
    let topSkill = null;
    let instructions = null;
    const allResults = Object.values(found).flat();
    if (allResults.length) {
      topSkill = [...allResults].sort((a, b) => b.installs - a.installs)[0];
      instructions = await fetchSkillContent(topSkill.source, topSkill.id);
    }

    // 4) TEACH — write the entry into the agent's memory
    const entry = {
      scouted_at: new Date().toISOString(),
      bottleneck,
      queries,
      ecosystem: "skills.sh (npx skills)",
      skills_found: Object.entries(found).map(([q, list]) => ({ query: q, top: list.slice(0, 3) })),
      recommended_skill: topSkill,
      instructions: instructions
        ? { excerpt: instructions.slice(0, 3000), full_source: `${topSkill.source} --skill ${topSkill.id}` }
        : null,
      note: "Fetched from the real skills.sh ecosystem. Apply the recommended techniques during the next run.",
    };
    await dbRemember(agent, "skill_entry", entry);
    taught += 1;
    log(
      `scouted for ${agent}: ${Object.keys(found).length} queries, top skill: ${topSkill ? `${topSkill.source}/${topSkill.id} (${topSkill.installs} installs)` : "none"}`,
    );
  }

  await dbInsertActivity(
    "bot",
    `Skills scout: searched skills.sh for ${taught} agent(s) — latest techniques recorded in each agent's memory.`,
  ).catch((e) => {
    const diag = diagnoseSupabaseError(e?.message);
    log(diag ?? `could not log activity: ${e?.message}`);
  });

  log(`✅ skills-scout done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  log("❌ fatal:", e.message);
  const diag = diagnoseSupabaseError(e.message);
  if (diag) log("💡", diag);
  await dbInsertActivity("system", `Skills scout error: ${e.message}`).catch(() => {});
  process.exit(0);
}
