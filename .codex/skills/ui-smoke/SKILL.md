---
name: ui-smoke
description: Run the deterministic packaged UI smoke path for WSA Manager using the unpacked build, the harness fixture, and the Playwright/Electron checks.
---

# UI Smoke

1. Validate source hygiene first with `npm run validate`.
2. Package the canonical unpacked target with `npm run package:unpacked`.
3. Run `npm run smoke:packaged`.
4. For visual review, run `npm run test:visual`.
5. When the task is UI-related, compare results to `docs/code.html` and `docs/screen.png`.
6. Report which artifact was tested and whether visual baselines changed.

