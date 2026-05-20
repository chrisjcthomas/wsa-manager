# WSA Manager Agent Guide

## Operating rules

- Treat this repository as the source of truth. Do not validate UI changes against the installed `Program Files` copy during development.
- Active workflow docs are:
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `.github/pull_request_template.md`
- The only valid app targets are:
  - local dev: `dotnet run --project WsaManager.WinUI\WsaManager.WinUI.csproj -p:Platform=x64`
  - solution build: `dotnet build WsaManager.Native.sln -p:Platform=x64`
  - solution tests: `dotnet test WsaManager.Native.sln -p:Platform=x64`
- Historical planning and troubleshooting notes live under `docs/archive/` and are not the live workflow source of truth.
- Do not reintroduce the removed Electron app, Node packaging pipeline, or `app.asar` workflow.
- `WsaManager.Core`, `WsaManager.Core.Tests`, and `WsaManager.WinUI` are the active authoring trees.
- Generated `bin/`, `obj/`, `AppPackages/`, and publish artifacts do not belong in source control.
- When a bug repeats twice, add or update a repo rule, skill, or harness check instead of relying on session memory.

## Build and test commands

- `dotnet test WsaManager.Native.sln -p:Platform=x64`
- `dotnet build WsaManager.Native.sln -p:Platform=x64`
- `dotnet run --project WsaManager.WinUI\WsaManager.WinUI.csproj -p:Platform=x64`

Run `dotnet test` and `dotnet build` before every PR. For UI changes, manually launch the WinUI app and include screenshots when useful.

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

- Treat ADB bridge failures, WSA wake/reconnect regressions, app uninstall failures, packaged startup blank screens, and infinite boot states as high-severity regressions.
- Flag any change that reintroduces vertical scrolling in the default dashboard empty state.
- Flag any change that lets compiled source sidecars or temp screenshots leak into the repository.
- Flag any packaging change that creates multiple competing installer locations or nested versioned release directories.
- Treat broken install instructions, stale release asset names, and misleading public release documentation as P1 issues.
- For UI reviews, compare against the checked-in visual baselines and approved mockup assets, not memory.
- Treat visual baseline failures as determinism problems first. Check timestamps, relative-time labels, build labels, diagnostics logs, endpoint text, and other time-sensitive UI before refreshing snapshots.
- Prefer targeted masks and narrow tolerances for dynamic UI regions over blind snapshot refreshes.
- Before merging, verify the PR is actually mergeable: green required checks, resolved review threads, and no branch-policy blockers.
- Codex reviews in GitHub flag only P0 and P1 issues by default, so encode any repo-specific review priority rules here in those terms.

## Skills and subagents

- Use project skills from `.codex/skills/` for repeated workflows:
  - `ui-smoke`
  - `release-check`
  - `wsa-readiness-debug`
  - `visual-baseline-debug`
  - `codex-pr-review-ops`
- These project skills are repo-local and should be updated whenever a failure pattern repeats.
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
- Use `@codex review` on PRs unless automatic reviews are enabled, and keep this file updated so review behavior improves over time.
- This repository is public and `main` is protected. Keep changes on short-lived `codex/<task>` branches and merge through PRs with the required Windows checks.
