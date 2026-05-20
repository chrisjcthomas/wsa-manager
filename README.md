# WSA Manager

WSA Manager is a native Windows app for installing Android APK files into Windows Subsystem for Android. It is built for people who do not want to touch ADB, package names, or command prompts: open the app, drop an APK on the dashboard, and let WSA Manager handle the connection and install flow.

## What It Does

- Installs `.apk` files into Windows Subsystem for Android.
- Wakes WSA and reconnects ADB when the subsystem is sleeping.
- Detects when an APK is already installed and lets you replace or skip it.
- Shows installed Android apps with names, package IDs, icons, size/date information when available, and uninstall actions.
- Keeps a diagnostics log so connection or install failures are easier to understand.
- Stores fresh native settings for the WinUI app; it does not use the old Electron settings file.

## Start Using It

Download the latest build from the GitHub Releases page, unzip it, and run `WsaManager.WinUI.exe`.

1. Open **Windows Subsystem for Android**.
2. Go to **Advanced settings**.
3. Turn on **Developer mode**.
4. Open **WSA Manager**.
5. Drop one or more `.apk` files onto the dashboard, or click **Choose APKs**.
6. Wait for the cards to move through the install steps.
7. Open **Installed apps** to confirm the app is there or uninstall apps you no longer want.

If the dashboard says setup is needed, click **Wake / reconnect**. If it still cannot connect, open WSA Advanced settings and confirm Developer mode is still on. WSA may take a few seconds to start accepting ADB connections after Developer mode is enabled.

## Requirements

- Windows 11
- Windows Subsystem for Android installed and working
- Developer mode enabled inside WSA Advanced settings
- Android platform tools, specifically `adb.exe`

## Download

The current downloadable preview build is published on GitHub Releases as:

- `WSA.Manager.WinUI.0.2.0.win-x64.zip`

WSA Manager looks for ADB in common places, including:

- A saved path from app settings
- `ANDROID_SDK_ROOT`
- `ANDROID_HOME`
- `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`
- `%USERPROFILE%\Desktop\platform-tools\adb.exe`
- `adb.exe` on `PATH`

## Project Structure

- `WsaManager.WinUI`: WinUI 3 desktop app.
- `WsaManager.Core`: testable C# service layer for ADB, WSA readiness, installs, uninstall, settings, diagnostics, and installed app catalog.
- `WsaManager.Core.Tests`: unit tests for parsers, readiness, ADB resolution, install queue behavior, duplicate install handling, and catalog behavior.
- `docs/`: active visual references and archived historical notes.

## Development Setup

This project currently targets .NET 9 and Windows App SDK.

On this machine, the local SDK is installed at `C:\tmp\dotnet-sdk`. If you use a normal system-wide .NET install, you may not need the environment setup lines.

```powershell
$env:DOTNET_CLI_HOME='C:\tmp\dotnet-home'
$env:PATH='C:\tmp\dotnet-sdk;' + $env:PATH
```

Restore, test, and build from the repository root:

```powershell
dotnet test WsaManager.Native.sln -p:Platform=x64
dotnet build WsaManager.Native.sln -p:Platform=x64
```

Run the app:

```powershell
dotnet run --project WsaManager.WinUI\WsaManager.WinUI.csproj -p:Platform=x64
```

## Verification

Before opening a PR, run:

```powershell
dotnet test WsaManager.Native.sln -p:Platform=x64
dotnet build WsaManager.Native.sln -p:Platform=x64
```

For UI changes, also launch the app and manually check:

- Dashboard APK drop and file picker flow
- WSA wake/reconnect
- Duplicate install replace/skip prompt
- Installed apps list, icons, scrolling, and uninstall
- Diagnostics entries for failures

## Status

The WinUI app is now the main app in this repository. The earlier Electron app was removed from the root project.

Packaging and installer work are still future work; the current development target is `dotnet run`.
