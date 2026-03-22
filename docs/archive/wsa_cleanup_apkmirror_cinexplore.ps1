# Archived helper note:
# This script is a historical one-off cleanup helper from before the repo workflow was formalized.
# Keep it for reference only, not as a current source-of-truth or supported cleanup path.

# Cleanup Script for APKMirror Installer & Cinexplore (Updated with Start Menu)

$wsaLocalState = "C:\Users\cobek\AppData\Local\Packages\MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe\LocalState"
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

# 1. Remove Leftover Files (Icons)
$filesToDelete = @(
    "com.apkmirror.helper.prod.ico",
    "com.apkmirror.helper.prod.png",
    "com.fidloo.cinexplore.ico",
    "com.fidloo.cinexplore.png"
)

foreach ($file in $filesToDelete) {
    $path = Join-Path $wsaLocalState $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "Deleted Icon: $path"
    }
}

# 2. Remove Start Menu Shortcuts
$shortcuts = @(
    "APKMirror Installer (beta).lnk",
    "Cinexplore.lnk"
)

foreach ($lnk in $shortcuts) {
    $path = Join-Path $startMenuPath $lnk
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "Deleted Shortcut: $path"
    }
}

# 3. Remove Registry Keys (Classes & Uninstall)
$regKeys = @(
    "HKCU:\Software\Classes\wsa.511c8394299b56e",
    "HKCU:\Software\Classes\wsa.e1a40d165f518c3e",
    "HKCU:\Software\Classes\cinexplore",
    "HKCU:\Software\Classes\com.fidloo.cinexplore",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.apkmirror.helper.prod",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.fidloo.cinexplore"
)

foreach ($key in $regKeys) {
    if (Test-Path $key) {
        Remove-Item $key -Recurse -Force
        Write-Host "Deleted Registry Key: $key"
    }
}

Write-Host "Deep Cleanup complete. Restart Windows Explorer or PC if the icons still show in Start Menu."
