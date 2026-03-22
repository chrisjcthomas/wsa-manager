> Archived note: This roadmap is historical pre-repo-planning context. Use `AGENTS.md`, `README.md`, and `docs/README.md` for the current workflow and source of truth.

# WSA Electron App Roadmap

## Goal

Build a Windows Electron app with a React/TypeScript frontend and a Node/TypeScript backend that makes APK installation and removal on Windows Subsystem for Android (WSA) simple for non-technical users.

The product should:

- Detect whether WSA is available and reachable through ADB
- Let users drag and drop one or more APKs to install them
- Show install progress and clear errors
- Let users uninstall apps without needing to know package names
- Explain and help resolve cases where the app is removed from Android but still appears in Windows app surfaces

## Reality Check

Official WSA support ended on March 5, 2025, so this should be built around the current real-world setup people actually use:

- Unofficial/community WSA distributions such as `WSABuilds`
- Android SDK `Platform-Tools` for `adb.exe`

This is a product opportunity because the current flow is still too manual for most users.

## Product Positioning

This should not be framed as just an APK installer.

It should be positioned as a:

- `WSA setup + app manager`
- `Drop APKs here and we handle the rest`

Core promise:

- No terminal use
- No package-name lookup
- No manual `adb connect` workflow
- Clear recovery steps when Windows and Android state do not match

## Primary User Problems

Non-technical users currently have to:

- Find and install a working WSA build
- Download Platform-Tools or Android Studio just to get `adb`
- Know whether WSA is running
- Know how to connect ADB to WSA
- Install APKs manually
- Look up package names to uninstall apps
- Understand why an uninstalled app can still appear in Start Menu, Desktop, or Windows app lists

The app should remove as much of that complexity as possible.

## High-Level Product Requirements

### Must Have

- WSA detection
- `adb.exe` detection
- ADB connection test
- Drag-and-drop APK install
- Multi-APK queue support
- Installed apps list
- Uninstall by clicking an app card
- Verification after install and uninstall
- Human-readable status and error messages

### Important Differentiator

- Reconciliation flow for stale Windows shortcuts, cached app entries, or delayed refresh behavior after uninstall

### Nice to Have Later

- Download or guided setup for Platform-Tools
- Guided setup for community WSA installs
- App icons and labels in installed-app list
- Repair/retry flows
- Auto-update for the Electron app

## Recommended Architecture

### Frontend

Use `React + TypeScript` in the Electron renderer for:

- First-run setup wizard
- Drag-and-drop install screen
- Installed apps screen
- App status cards
- Cleanup/reconciliation UI
- Logs and advanced diagnostics view

### Backend

Use `Node + TypeScript` in the Electron main process for:

- Process execution
- ADB commands
- Filesystem access
- Task queue management
- Windows-specific integration checks
- Persistent app state

### Shared Contracts

Create a shared package or folder for typed IPC contracts:

- Request/response schemas
- Task progress events
- Error payloads
- Install/uninstall state models

Recommended libraries:

- `zod` for runtime validation
- `electron-builder` or `electron-forge` for packaging
- `better-sqlite3` or a lightweight JSON store for history/state

## Suggested Folder Structure

```text
app/
  src/
    main/
      ipc/
      services/
        adb/
        wsa/
        catalog/
        reconcile/
      tasks/
      storage/
    renderer/
      app/
      features/
        onboarding/
        dropzone/
        installs/
        installed-apps/
        cleanup/
      components/
      hooks/
    shared/
      contracts/
      types/
      utils/
```

## Core Service Design

### `services/adb`

Responsibilities:

- Locate `adb.exe`
- Start ADB server if needed
- Connect to WSA
- Install APKs
- Uninstall packages
- Query installed packages
- Parse stdout/stderr into structured results

Key commands:

- `adb start-server`
- `adb connect 127.0.0.1:58526`
- `adb devices`
- `adb install <apk>`
- `adb uninstall <package>`
- `adb shell pm list packages`

Note:

Some WSA setups may require a dynamic IP instead of `127.0.0.1:58526`, so endpoint discovery should not be hardcoded forever.

### `services/wsa`

Responsibilities:

- Detect whether WSA appears to be installed
- Detect whether WSA is running
- Attempt to start or wake WSA if possible
- Discover likely ADB endpoint
- Surface readiness state to the UI

### `services/catalog`

Responsibilities:

- Build the installed app list
- Map package names to user-facing app entries
- Track install history
- Associate APK files with package metadata where possible

### `services/reconcile`

Responsibilities:

- Verify install/uninstall results
- Re-scan Android package state
- Detect likely stale Windows app entries or shortcut leftovers
- Recommend next actions

This service is the main product differentiator.

## UX Roadmap

### Phase 1: First-Run Wizard

Before showing the main app, guide users through setup.

Wizard steps:

1. Check whether WSA exists
2. Check whether Platform-Tools and `adb.exe` exist
3. Let user choose:
   - Use detected `adb.exe`
   - Browse for Platform-Tools folder
4. Test ADB server
5. Test WSA connection
6. Save a final readiness result

User-facing readiness states:

- `Ready`
- `WSA not found`
- `ADB not found`
- `WSA not running`
- `Could not connect to WSA`
- `Needs user attention`

### Phase 2: APK Install Flow

Main install experience:

- Large drop zone for APKs
- Queue items rendered as cards
- Automatic validation before install
- Progress states:
  - `Waiting`
  - `Connecting`
  - `Installing`
  - `Installed`
  - `Failed`
- Clear summary after completion

Important details:

- Support dropping multiple APKs
- Keep logs available but hidden by default
- Show human-friendly app names whenever possible

### Phase 3: Installed Apps Screen

Show apps already present in WSA in a non-technical way.

Each app card should include:

- App name
- Package name in an advanced/details area
- Install status or last seen state
- `Uninstall`
- `Reinstall` later if you support known APK sources/history

### Phase 4: Uninstall and Cleanup Flow

This is the hard part and the biggest opportunity.

Uninstall should:

1. Trigger `adb uninstall <package>`
2. Verify removal with a fresh package scan
3. Run a reconciliation check
4. Show the final state in plain language

Possible final states:

- `Fully removed`
- `Removed from Android`
- `Removed from Android, but Windows may still show cached shortcuts`
- `WSA likely needs restart to refresh app entries`
- `Manual cleanup may still be required`

Recovery actions:

- `Re-scan`
- `Restart WSA`
- `Show advanced cleanup steps`
- `Open shortcut locations` if you can reliably locate them

Do not promise instant Windows cleanup unless it is verified.

## MVP Feature Set

The MVP should include:

- First-run readiness checks
- Drag-and-drop APK install
- Multi-APK queue
- Installed packages list
- Click-to-uninstall flow
- Post-action verification
- Human-readable status labels
- Error and diagnostic panel

The MVP does not need:

- AI features
- Cloud sync
- Account system
- Full Android Studio integration

## Detailed Build Plan

### Milestone 1: Project Setup

Deliverables:

- Electron app scaffold
- React/TypeScript renderer
- TypeScript main process
- Typed IPC layer
- Basic local storage

Success criteria:

- App launches cleanly in development
- Renderer can call typed main-process commands

### Milestone 2: Environment Detection

Deliverables:

- Detect `adb.exe`
- Detect WSA presence
- Show readiness screen

Success criteria:

- App can clearly report whether the machine is ready for installs

### Milestone 3: Connection Management

Deliverables:

- Start ADB server
- Connect to WSA
- Verify `adb devices`
- Handle common failure states

Success criteria:

- App can reliably determine whether WSA is reachable

### Milestone 4: APK Install

Deliverables:

- Drag-and-drop APK support
- Install queue
- Progress events
- Error handling

Success criteria:

- User can drop one or more APKs and complete installs without terminal use

### Milestone 5: Installed Apps Catalog

Deliverables:

- Installed package scan
- App list UI
- Per-app actions

Success criteria:

- User can browse installed apps without knowing package names

### Milestone 6: Uninstall Flow

Deliverables:

- Click-to-uninstall
- Verification after uninstall
- State refresh after action

Success criteria:

- User can remove apps without manually using ADB

### Milestone 7: Reconciliation and Cleanup

Deliverables:

- Post-uninstall cleanup states
- Re-scan and retry actions
- Guidance for stale shortcuts or stale Windows app entries

Success criteria:

- The app explains what happened after uninstall even when Windows state lags behind Android state

### Milestone 8: Packaging and Polish

Deliverables:

- Windows installer
- Icons/branding
- Better error copy
- Logging and crash diagnostics

Success criteria:

- Non-technical users can install and use the app with minimal support

## State Machine Suggestions

### Connection State

- `unknown`
- `checking-adb`
- `adb-missing`
- `checking-wsa`
- `wsa-missing`
- `connecting`
- `ready`
- `error`

### Install Task State

- `queued`
- `validating`
- `connecting`
- `installing`
- `verifying`
- `completed`
- `failed`

### Uninstall Task State

- `queued`
- `uninstalling`
- `verifying-removal`
- `reconciling`
- `completed`
- `completed-with-warnings`
- `failed`

## Technical Risks

### 1. WSA Is No Longer Officially Supported

Risk:

- Users may be on many different community-maintained WSA variants

Response:

- Design around capability detection, not a single assumed install path

### 2. ADB Endpoint Differences

Risk:

- Some users may not connect through `127.0.0.1:58526`

Response:

- Make endpoint discovery configurable
- Store the last working endpoint

### 3. Uninstall Does Not Immediately Match Windows UI

Risk:

- Android package state and Windows shortcuts/app surfaces may get out of sync temporarily

Response:

- Build a reconciliation layer
- Expose truthful states and recovery actions

### 4. Platform-Tools Distribution Rules

Risk:

- Bundling or auto-downloading Platform-Tools may have licensing/distribution constraints

Response:

- Start with:
  - detecting an existing `adb.exe`
  - letting users point to Platform-Tools manually
- Add download support only after reviewing the SDK license carefully

## Why This Can Still Stand Out Without AI

This project can stand out if it shows:

- Strong Windows desktop product thinking
- Clean Electron architecture
- Reliable process orchestration
- Good error handling
- Honest UX around system edge cases
- Real empathy for non-technical users

That aligns well with the kind of product engineering reflected in the referenced OpenAI roles, even if the app itself is not AI-related.

## Recommended MVP Pitch

`A friendly Windows app that turns the messy WSA + ADB APK workflow into drag-and-drop install, click-to-uninstall, and clear cleanup guidance for normal users.`

## Next Step

After this roadmap, the next useful document would be:

- a technical spec with exact IPC contracts
- an MVP screen list
- a week-by-week implementation plan
- a backend task runner design
