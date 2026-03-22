---
name: codex-pr-review-ops
description: Run the repo-specific PR, Codex review, and merge-readiness workflow for WSA Manager using the current GitHub checks and branch protection rules.
---

# Codex PR Review Ops

1. Confirm the work is on a `codex/<task>` branch and that the PR description matches `.github/pull_request_template.md`.
2. Request or verify Codex review:
   - use `@codex review` unless automatic reviews are enabled
   - add extra focus when the PR is about packaging, UI regressions, or release docs
3. Inspect PR health in this order:
   - required status checks
   - failing GitHub Actions logs
   - unresolved review threads
   - branch-policy blockers that keep the PR non-mergeable
4. Treat required conversation resolution as a first-class merge gate, not an afterthought.
5. For UI or packaging PRs, confirm the PR records:
   - commands run
   - artifact tested
   - target window sizes
   - whether baselines changed
6. Before merging, verify the PR is actually mergeable, not just green.
7. Report blockers separately as:
   - failing checks
   - unresolved conversations
   - merge-policy or repository-setting blockers
