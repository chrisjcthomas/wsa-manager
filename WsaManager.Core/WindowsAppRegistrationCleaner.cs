using System.Text.Json;

namespace WsaManager.Core;

public sealed class WindowsCleanupResult
{
    public List<string> RemovedItems { get; set; } = [];
    public List<string> Errors { get; set; } = [];
}

public sealed class WindowsAppRegistrationCleaner
{
    private readonly ICommandRunner commandRunner;
    private readonly DiagnosticsService diagnostics;

    public WindowsAppRegistrationCleaner(ICommandRunner commandRunner, DiagnosticsService diagnostics)
    {
        this.commandRunner = commandRunner;
        this.diagnostics = diagnostics;
    }

    public async Task<WindowsCleanupResult> CleanupWsaAppRegistrationAsync(string packageName, CancellationToken cancellationToken = default)
    {
        const string script = @"
$ErrorActionPreference = 'Continue'
$packageName = $env:WSA_MANAGER_PACKAGE_NAME
$removed = New-Object System.Collections.Generic.List[string]
$errors = New-Object System.Collections.Generic.List[string]

function Remove-PathIfExists($path, $label) {
  try {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
      [void]$removed.Add($label)
    }
  } catch {
    [void]$errors.Add(""$label :: $($_.Exception.Message)"")
  }
}

Remove-PathIfExists ""HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$packageName"" ""Uninstall registry: $packageName""

$classesRoot = 'HKCU:\Software\Classes'
try {
  Get-ChildItem -LiteralPath $classesRoot -ErrorAction Stop | ForEach-Object {
    $leaf = Split-Path -Leaf $_.PSPath
    $matches = $leaf -eq $packageName -or $leaf -eq ""wsa.$packageName""
    if (-not $matches) {
      try {
        $props = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction Stop
        foreach ($prop in $props.PSObject.Properties) {
          if ($prop.Value -is [string] -and $prop.Value.Contains($packageName)) {
            $matches = $true
            break
          }
        }
      } catch {}
    }

    if ($matches) {
      Remove-PathIfExists $_.PSPath ""Classes registry: $leaf""
    }
  }
} catch {
  [void]$errors.Add(""Classes registry scan :: $($_.Exception.Message)"")
}

$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
if (Test-Path -LiteralPath $startMenu) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    Get-ChildItem -LiteralPath $startMenu -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $shortcut = $shell.CreateShortcut($_.FullName)
        $haystack = ""$($shortcut.TargetPath) $($shortcut.Arguments) $($shortcut.Description)""
        if ($haystack.Contains($packageName)) {
          Remove-PathIfExists $_.FullName ""Start Menu shortcut: $($_.Name)""
        }
      } catch {
        [void]$errors.Add(""Shortcut scan $($_.FullName) :: $($_.Exception.Message)"")
      }
    }
  } catch {
    [void]$errors.Add(""Start Menu scan :: $($_.Exception.Message)"")
  }
}

$wsaPackages = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Packages') -Directory -Filter '*WindowsSubsystemForAndroid*' -ErrorAction SilentlyContinue
foreach ($wsaPackage in $wsaPackages) {
  $localState = Join-Path $wsaPackage.FullName 'LocalState'
  if (Test-Path -LiteralPath $localState) {
    Get-ChildItem -LiteralPath $localState -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like ""$packageName*"" -and ($_.Extension -in '.ico', '.png') } |
      ForEach-Object { Remove-PathIfExists $_.FullName ""WSA icon cache: $($_.Name)"" }
  }
}

[PSCustomObject]@{
  RemovedItems = @($removed)
  Errors = @($errors)
} | ConvertTo-Json -Compress
";

        try
        {
            var result = await commandRunner.RunAsync(
                "powershell.exe",
                ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", $"$env:WSA_MANAGER_PACKAGE_NAME={EscapePowerShellString(packageName)}; {script}"],
                30_000,
                cancellationToken);

            var parsed = JsonSerializer.Deserialize<WindowsCleanupResult>(result.Stdout.Trim()) ?? new WindowsCleanupResult();
            diagnostics.Log(
                parsed.Errors.Count == 0 ? DiagnosticLevel.Info : DiagnosticLevel.Warn,
                "windows-cleanup",
                $"Cleaned Windows registration for {packageName}",
                $"Removed {parsed.RemovedItems.Count} item(s). {string.Join("; ", parsed.Errors)}");
            return parsed;
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "windows-cleanup", $"Windows registration cleanup failed for {packageName}", ex.Message);
            return new WindowsCleanupResult { Errors = [ex.Message] };
        }
    }

    private static string EscapePowerShellString(string value) => $"'{value.Replace("'", "''")}'";
}
