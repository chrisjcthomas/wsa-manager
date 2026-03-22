---
name: ui-smoke
description: Run the deterministic packaged UI smoke path for WSA Manager using the unpacked build, the harness fixture, and the Playwright/Electron checks.
---

# UI Smoke

1. Use the canonical unpacked target only: `release/win-unpacked/WSA Manager.exe`.
2. Do not validate UI behavior against the installed `Program Files` copy and do not hot-swap `app.asar`.
3. Run packaged commands serially. `npm run smoke:packaged`, `npm run test:visual`, `npm run package:unpacked`, and `npm run release:build` all rewrite `release/`.
4. Run `npm run validate` first when the task touches renderer, preload, IPC, or packaging behavior.
5. Run `npm run smoke:packaged` for boot, preload bridge, and navigation checks.
6. Run `npm run test:visual` for screenshot-backed UI review.
7. Compare results to `docs/code.html`, `docs/screen.png`, and the checked-in baselines in `tests/e2e/__screenshots__/visual.packaged.spec.ts/`.
8. Report:
   - which artifact was tested
   - which harness fixture or state was used
   - target window sizes
   - whether visual baselines changed
