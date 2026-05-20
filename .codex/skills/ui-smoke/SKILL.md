---
name: ui-smoke
description: Run a basic WinUI smoke path for WSA Manager after UI or startup changes.
---

# UI Smoke

1. Build first with `dotnet build WsaManager.Native.sln -p:Platform=x64`.
2. Launch with `dotnet run --project WsaManager.WinUI\WsaManager.WinUI.csproj -p:Platform=x64`.
3. Do not validate UI behavior against an installed stale copy.
4. Check the dashboard, Installed apps, Diagnostics, and Settings navigation.
5. Compare UI changes to `docs/code.html` and `docs/screen.png` when the task is visual.
6. Report:
   - which artifact was tested
   - whether live WSA/ADB was connected
   - target window sizes
   - any screenshots captured
