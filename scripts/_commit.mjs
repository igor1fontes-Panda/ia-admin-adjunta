#!/usr/bin/env node
// One-off: stage everything and create the reorg+QA commit, then remove itself.
import { rmSync } from "node:fs";
import { execSync } from "node:child_process";

const msg = `Repo reorg + QA fixes: unify duplicate skills dirs, untrack coverage, consolidate env example

- Remove duplicate agent/ skills copy (canonical .agents/ + .claude/skills symlinks)
- Untrack generated coverage/ output; add to .gitignore
- Consolidate the two env sample files into one complete env.example
- fetchDeliveryStatus: mock-mode guard (regression fix)
- engine tests: qa_status bucket transitions

Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>`;

execSync("git add -A", { stdio: "inherit" });
execSync(`git commit -q -m ${JSON.stringify(msg)}`, { stdio: "inherit" });
console.log(execSync("git log --oneline -1").toString().trim());
rmSync("scripts/_commit.mjs", { force: true });
