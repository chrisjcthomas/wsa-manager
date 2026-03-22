---
name: wsa-readiness-debug
description: Debug WSA Manager readiness issues by separating harness-mode regressions from live WSA/ADB machine issues.
---

# WSA Readiness Debug

1. Start with diagnostics and the user-visible symptom before changing code.
2. Confirm whether the failure reproduces in harness mode with `npm run smoke:packaged`.
3. Split the bug into one of these paths:
   - preload or renderer boot failure
   - slow readiness or timeout UX regression
   - real WSA or ADB machine integration failure
4. If harness mode fails, inspect preload pathing, IPC bridge registration, renderer boot state, and any blank-shell or loading-loop behavior before looking at live WSA.
5. If harness mode is green but the app times out or loops, inspect readiness state transitions, timeout UX, diagnostics output, and `useWsaManager`.
6. If only the live machine fails, inspect in this order:
   - diagnostics output
   - ADB discovery and version checks
   - WSA detection and wake flow
   - endpoint discovery and manual override behavior
   - install or uninstall verification state
7. Inspect `WsaService`, `AdbService`, and `useWsaManager` only after the symptom is classified.
8. Keep harness-mode regressions separate from live integration failures in both tests and writeups.
9. Add a regression test whenever a readiness bug is fixed.
