---
name: release-check
description: Verify that WSA Manager WinUI builds cleanly for release without stale Electron artifacts.
---

# Release Check

1. Run `dotnet test WsaManager.Native.sln -p:Platform=x64`.
2. Run `dotnet build WsaManager.Native.sln -p:Platform=x64 -c Release`.
3. Verify no `node_modules`, Electron config, or old `release/win-unpacked` output is required.
4. If MSIX/publishing is added later, verify only the new WinUI artifacts are documented and uploaded.
5. Report the build configuration, target platform, and any stale-artifact or naming mismatches explicitly.
