# Contributing

## Setup

```bash
npm ci
cp .env.example .env.local   # fill only what you use; never commit real values
npm run dev                  # Vite SPA on :5173
```

See [README.env-vars.md](README.env-vars.md) for every environment variable
the repo reads, and the README for the data migrations.

## Verify before you push

```bash
npm run lint         # eslint src
npm run typecheck    # tsc -b --noEmit
npm run coverage     # vitest + thresholds (50% lines — enforced in CI)
python3 -m unittest discover -s tests   # python bot logic (no credentials needed)
npm run build
```

## Commit discipline

- One feature or fix per commit, **paired with the tests that pin its
  behavior**. Test-less behavior changes are review blockers.
- Never mix formatting, refactors and features in the same commit.
- Commit messages: lowercase imperative, subject line states the *why*.

## Commit authorship: humans vs AI agents

This repository is developed with the help of AI coding agents. To keep
review honest, every commit must make its authorship unambiguous:

| Author | How it must appear | How to tell at a glance |
|---|---|---|
| Human | `Co-Authored-By:` absent, or only other humans listed | `git log --format='%an %ce'` shows the developer |
| AI agent (Codebuff, v0, Copilot, …) | agent named in the commit body or `Co-Authored-By:` trailer (e.g. `Co-Authored-By: Codebuff <noreply@codebuff.com>`) | trailer/`Generated with …` line in the body |
| Bots (vercel[bot], dependabot) | automated platform commits | author email is the bot's |

Rules for reviewers and maintainers:

1. **AI-authored commits require a human reviewer sign-off** before merging
   to `main`. The reviewer is accountable for the change, not the agent.
2. Do **not** strip or edit authorship trailers — attribution history is
   part of the audit trail.
3. Agents must not self-merge, force-push, or approve pull requests.
4. Generated commits that only touch machine-managed files (lockfiles,
   generated clients) should be labeled `chore:` so they are easy to skip
   when mining history.

## Reporting issues

Open a GitHub issue with: what you did, what you expected, what happened,
and the smallest reproduction. Include CI logs for flaky or failing checks.
