using System.Text.Json;
namespace WsaManager.Core;

public interface IWindowsWsaAppCatalog
{
    Task<IReadOnlyList<WindowsWsaAppRegistration>> GetRegisteredAppsAsync(CancellationToken cancellationToken = default);
}

public sealed class WindowsWsaAppCatalog : IWindowsWsaAppCatalog
{
    private readonly ICommandRunner commandRunner;
    private readonly DiagnosticsService diagnostics;

    public WindowsWsaAppCatalog(ICommandRunner commandRunner, DiagnosticsService diagnostics)
    {
        this.commandRunner = commandRunner;
        this.diagnostics = diagnostics;
    }

    public async Task<IReadOnlyList<WindowsWsaAppRegistration>> GetRegisteredAppsAsync(CancellationToken cancellationToken = default)
    {
        const string script = @"
$items = New-Object System.Collections.Generic.List[object]
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
if (Test-Path -LiteralPath $startMenu) {
  $shell = New-Object -ComObject WScript.Shell
  Get-ChildItem -LiteralPath $startMenu -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $shortcut = $shell.CreateShortcut($_.FullName)
      $text = ""$($shortcut.TargetPath) $($shortcut.Arguments)""
      if ($text -match 'wsa://([^/""\s]+)') {
        $packageName = $Matches[1]
        $icon = $shortcut.IconLocation
        if ($icon -match '^(.*)\.ico,0$') {
          $png = ""$($Matches[1]).png""
          if (Test-Path -LiteralPath $png) {
            $icon = $png
          }
        }

        [void]$items.Add([PSCustomObject]@{
          PackageName = $packageName
          DisplayName = $_.BaseName
          IconPath = $icon
          ShortcutPath = $_.FullName
        })
      }
    } catch {}
  }
}
$items | Sort-Object DisplayName | ConvertTo-Json -Compress
";

        try
        {
            var result = await commandRunner.RunAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], 15_000, cancellationToken);
            if (string.IsNullOrWhiteSpace(result.Stdout))
            {
                return [];
            }

            var trimmed = result.Stdout.Trim();
            var registrations = trimmed.StartsWith("[", StringComparison.Ordinal)
                ? JsonSerializer.Deserialize<List<WindowsWsaAppRegistration>>(trimmed)
                : [JsonSerializer.Deserialize<WindowsWsaAppRegistration>(trimmed)!];
            return registrations?
                .Where(item => !string.IsNullOrWhiteSpace(item.PackageName))
                .GroupBy(item => item.PackageName, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList() ?? [];
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "windows-catalog", "Could not read WSA app registrations", ex.Message);
            return [];
        }
    }
}
