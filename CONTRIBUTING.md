# Contributing

## Commit authorship

Human changes should use the contributor's Git identity. AI-assisted commits from `v0` and automated dependency or deployment commits from `vercel[bot]` are intentionally identifiable in history; reviewers should expect a matching test or validation change in the same focused commit.

## Focused changes

Keep each feature or fix in its own focused commit and include the test or validation that proves the behavior. Avoid mixing formatting-only work with feature changes.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm run coverage`, and the relevant offline Python tests before opening a pull request.
