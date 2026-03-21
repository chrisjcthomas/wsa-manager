---
name: release-check
description: Verify that WSA Manager packaging produced the canonical release layout and build manifest without stale or duplicate artifacts.
---

# Release Check

1. Run `npm run release:clean`.
2. Build with `npm run release:build`.
3. Verify `release/build-manifest.json` exists.
4. Verify the only canonical artifacts are:
   - `release/win-unpacked/WSA Manager.exe`
   - `release/WSA.Manager.Setup.<version>.exe`
5. Fail the check if nested semver folders or duplicate installers appear in `release/`.
