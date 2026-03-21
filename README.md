# WSA Manager

Windows utility for managing Android apps in Windows Subsystem for Android.

## Quick start

```bash
npm ci
npm run dev
```

## Core commands

```bash
npm run validate
npm run test:ui
npm run smoke:packaged
npm run test:visual
npm run release:build
```

## Development targets

- Local dev: `npm run dev`
- Packaged smoke target: `release/win-unpacked/WSA Manager.exe`
- Installer acceptance target: `release/WSA Manager Setup <version>.exe`

## UI workflow

- Reference `docs/code.html` and `docs/screen.png` before changing the shell or dashboard layout.
- Use the packaged harness tests for regressions instead of manually inspecting stale installs.
- Update visual baselines intentionally and review them in the PR.

