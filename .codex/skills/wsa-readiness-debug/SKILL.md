---
name: wsa-readiness-debug
description: Debug WSA Manager readiness issues by separating WinUI state regressions from live WSA/ADB machine issues.
---

# WSA Readiness Debug

1. Start with diagnostics and the user-visible symptom before changing code.
2. Reproduce in the WinUI app with `dotnet run --project WsaManager.WinUI\WsaManager.WinUI.csproj -p:Platform=x64` when a live UI check is needed.
3. Split the bug into one of these paths:
   - WinUI boot or binding failure
   - slow readiness or timeout UX regression
   - real WSA or ADB machine integration failure
4. If the WinUI app fails to boot, inspect app startup, dependency injection, XAML binding errors, and any blank-shell or loading-loop behavior before looking at live WSA.
5. If the app times out or loops, inspect readiness state transitions, timeout UX, diagnostics output, and `MainViewModel`.
6. If only the live machine fails, inspect in this order:
   - diagnostics output
   - ADB discovery and version checks
   - WSA detection and wake flow
   - endpoint discovery and manual override behavior
   - install or uninstall verification state
7. Inspect `WsaService`, `AdbService`, and `MainViewModel` only after the symptom is classified.
8. Keep app-state regressions separate from live integration failures in both tests and writeups.
9. Add a regression test whenever a readiness bug is fixed.
