# WSA Manager Agent Guide

## Operating rules

- Treat this repository as the source of truth. Do not validate UI changes against the installed `Program Files` copy during development.
- The only valid app targets are:
  - local dev: `npm run dev`
  - packaged smoke target: `release/win-unpacked/WSA Manager.exe`
  - installer acceptance target: `release/WSA Manager Setup <version>.exe`
- Never hot-swap `app.asar`.
- `src/` and `tests/` are authoring trees. Generated `.js` and generated `.d.ts` sidecars do not belong there.
- When a bug repeats twice, add or update a repo rule, skill, or harness check instead of relying on session memory.

## Build and test commands

- `npm run validate`
- `npm run test:ui`
- `npm run test:visual`
- `npm run smoke:packaged`
- `npm run release:clean`
- `npm run release:build`

Run `npm run validate` before every PR. For UI or packaging changes, also run `npm run smoke:packaged` and `npm run test:visual`.

## UI source of truth

- Approved mockup references live in:
  - `docs/code.html`
  - `docs/screen.png`
- Every UI task must name:
  - the visual reference
  - target window sizes
  - acceptance criteria
- App UI should favor a Windows utility layout: dense but readable, minimal chrome, strong hierarchy, and no decorative "window inside a window" shells.

## Review guidelines

- Treat preload bridge failures, packaged startup blank screens, and infinite boot states as high-severity regressions.
- Flag any change that reintroduces vertical scrolling in the default dashboard empty state.
- Flag any change that lets compiled source sidecars or temp screenshots leak into the repository.
- Flag any packaging change that creates multiple competing installer locations or nested versioned release directories.
- For UI reviews, compare against the checked-in visual baselines and approved mockup assets, not memory.

## Skills and subagents

- Use project skills from `.codex/skills/` for repeated workflows:
  - `ui-smoke`
  - `release-check`
  - `wsa-readiness-debug`
- Use subagents only for bounded parallel tasks such as layout tracing, state-path tracing, or read-only codebase exploration.
- Keep delegated asks narrow and concrete.

## Git and GitHub workflow

- Work from short-lived branches named `codex/<task>`.
- Open a PR for every non-trivial change.
- PR descriptions must include:
  - problem statement
  - acceptance criteria
  - commands run
  - artifact tested
  - screenshots when UI baselines changed
- Use `@codex review` on PRs and keep this file updated so review behavior improves over time.
