---
name: release-check
description: Verify that WSA Manager packaging produced the canonical release layout and build manifest without stale or duplicate artifacts.
---

# Release Check

1. Run packaged commands serially. `release/` is shared mutable state.
2. Start with `npm run release:clean`.
3. Build with `npm run release:build`.
4. Verify `release/build-manifest.json` exists and points at the current canonical artifacts.
5. Verify the canonical local outputs:
   - `release/win-unpacked/WSA Manager.exe`
   - `release/WSA.Manager.Setup.<version>.exe`
   - `release/WSA.Manager.Setup.<version>.exe.blockmap`
6. Fail the check if nested semver folders, duplicate installers, or stale alternate layouts appear in `release/`.
7. If a GitHub release is part of the task, verify the published assets also match the README naming contract:
   - `WSA.Manager.Setup.<version>.exe`
   - `WSA.Manager.Setup.<version>.exe.blockmap`
   - `WSA.Manager.portable.<tag>.zip`
   - `build-manifest.json`
8. Report the build label/version and any stale-artifact or naming mismatches explicitly.
