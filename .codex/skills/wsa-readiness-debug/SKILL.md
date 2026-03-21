---
name: wsa-readiness-debug
description: Debug WSA Manager readiness issues by separating harness-mode regressions from live WSA/ADB machine issues.
---

# WSA Readiness Debug

1. Confirm whether the failure reproduces in harness mode with `npm run smoke:packaged`.
2. If harness mode is green, the bug is likely in live WSA/ADB integration rather than renderer boot.
3. Inspect diagnostics first, then `WsaService`, `AdbService`, and `useWsaManager`.
4. Treat these as separate classes of bugs:
   - preload or renderer boot failure
   - slow readiness or timeout UX regression
   - real WSA/ADB machine integration failure
5. Add a regression test whenever a readiness bug is fixed.

