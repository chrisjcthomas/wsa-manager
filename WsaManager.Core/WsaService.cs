using System.Text.Json;

namespace WsaManager.Core;

public sealed class WsaService
{
    private const string DefaultEndpoint = "127.0.0.1:58526";
    private const string AppId = "MicrosoftCorporationII.WindowsSubsystemForAndroid_8wekyb3d8bbwe!SettingsApp";

    private readonly SettingsStore settingsStore;
    private readonly AdbService adbService;
    private readonly DiagnosticsService diagnostics;
    private readonly ICommandRunner commandRunner;

    public WsaService(SettingsStore settingsStore, AdbService adbService, DiagnosticsService diagnostics, ICommandRunner commandRunner)
    {
        this.settingsStore = settingsStore;
        this.adbService = adbService;
        this.diagnostics = diagnostics;
        this.commandRunner = commandRunner;
    }

    public async Task<bool> WakeAsync(CancellationToken cancellationToken = default)
    {
        var sentAnyWakeSignal = false;
        sentAnyWakeSignal |= await OpenAdvancedSettingsAsync(cancellationToken);

        foreach (var uri in new[] { "wsa://com.android.settings", "wsa://com.android.vending", "wsa://com.topjohnwu.magisk" })
        {
            try
            {
                await StartUriAsync(uri, cancellationToken);
                diagnostics.Log(DiagnosticLevel.Info, "wsa", $"Wake signal sent to {uri}");
                sentAnyWakeSignal = true;
            }
            catch (Exception ex)
            {
                diagnostics.Log(DiagnosticLevel.Warn, "wsa", $"Wake signal failed for {uri}", ex.Message);
            }
        }

        return sentAnyWakeSignal;
    }

    public async Task<bool> OpenAdvancedSettingsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await StartExplorerAsync($"shell:AppsFolder\\{AppId}", cancellationToken);
            diagnostics.Log(DiagnosticLevel.Info, "wsa", "Opened WSA advanced settings");
            return true;
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "wsa", "Packaged WSA wake signal failed", ex.Message);
            return false;
        }
    }

    private Task<CommandResult> StartExplorerAsync(string target, CancellationToken cancellationToken)
    {
        var escapedTarget = target.Replace("'", "''");
        return commandRunner.RunAsync(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", $"Start-Process explorer.exe -ArgumentList '{escapedTarget}'"],
            5_000,
            cancellationToken);
    }

    private Task<CommandResult> StartUriAsync(string uri, CancellationToken cancellationToken)
    {
        var escapedUri = uri.Replace("'", "''");
        return commandRunner.RunAsync(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", $"Start-Process '{escapedUri}'"],
            5_000,
            cancellationToken);
    }

    public async Task<ReadinessSnapshot> GetReadinessSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var settings = settingsStore.Get();
        var messages = new List<string>();
        var checkedEndpoints = new List<string>();
        var snapshot = new ReadinessSnapshot
        {
            CheckedAt = DateTimeOffset.UtcNow,
            WizardCompleted = settings.WizardCompleted,
            NeedsSetup = true,
            OverallStatus = "needs_attention",
            Messages = messages,
            Connection = new ConnectionReadiness { CheckedEndpoints = checkedEndpoints }
        };

        var wsaTask = WithTimeoutAsync(GetInstalledPackageAsync(cancellationToken), 4_000, "WSA package lookup");
        var adbTask = WithTimeoutAsync(adbService.ResolveAdbAsync(5_000, cancellationToken), 5_000, "ADB discovery");

        WsaPackageInfo? wsaPackage = null;
        ResolvedAdb? adb = null;

        try
        {
            wsaPackage = await wsaTask;
        }
        catch (Exception ex)
        {
            messages.Add(ex.Message);
        }

        try
        {
            adb = await adbTask;
        }
        catch (Exception ex)
        {
            messages.Add(ex.Message);
        }

        snapshot.Adb = adb is not null
            ? new AdbReadiness { Status = "ready", Path = adb.Path, Version = adb.Version, Source = adb.Source }
            : new AdbReadiness { Status = "not_found", Message = "Install or point WSA Manager to adb.exe." };

        snapshot.Wsa = wsaPackage is not null
            ? new WsaReadiness
            {
                Status = "sleeping",
                PackageName = wsaPackage.Name,
                PackageFullName = wsaPackage.PackageFullName,
                Version = wsaPackage.Version,
                InstallLocation = wsaPackage.InstallLocation
            }
            : new WsaReadiness { Status = "not_found", Message = "WSA package could not be found." };

        snapshot.Connection.Status = adb is null ? "adb_missing" : wsaPackage is null ? "wsa_missing" : "sleeping";

        if (wsaPackage is null)
        {
            messages.Add("Windows Subsystem for Android was not detected.");
        }

        if (adb is null)
        {
            messages.Add("ADB was not detected. Choose adb.exe or install Android platform-tools.");
        }

        if (wsaPackage is not null && adb is not null)
        {
            try
            {
                await adbService.EnsureServerAsync(2_500, cancellationToken);
                var connection = await ConnectToBestEndpointAsync(settings.ManualEndpoint, 2_500, 2_500, cancellationToken);
                checkedEndpoints.AddRange(connection.CheckedEndpoints);

                if (connection.Endpoint is not null)
                {
                    snapshot.Connection.Endpoint = connection.Endpoint;
                }

                if (connection.Connected)
                {
                    snapshot.Wsa.Status = "ready";
                    snapshot.Connection.Status = "connected";
                    snapshot.Connection.Message = connection.Message;
                    snapshot.OverallStatus = "ready";
                    snapshot.NeedsSetup = false;
                    messages.Add($"Connected to WSA at {connection.Endpoint}.");
                }
                else
                {
                    snapshot.Wsa.Status = "sleeping";
                    snapshot.Connection.Status = "sleeping";
                    snapshot.Connection.Message = connection.Message;
                    messages.Add(connection.Message);
                }
            }
            catch (Exception ex)
            {
                snapshot.Adb.Status = "error";
                snapshot.Adb.Message = ex.Message;
                snapshot.Connection.Status = "not_connected";
                messages.Add(ex.Message);
            }
        }

        if (snapshot.OverallStatus == "ready" && !settings.WizardCompleted)
        {
            settingsStore.SetWizardCompleted(true);
            snapshot.WizardCompleted = true;
        }

        snapshot.NeedsSetup = snapshot.OverallStatus != "ready";
        return snapshot;
    }

    public async Task<ConnectionResult> ConnectToBestEndpointAsync(
        string? manualEndpoint = null,
        int connectTimeoutMs = 20_000,
        int devicesTimeoutMs = 30_000,
        CancellationToken cancellationToken = default)
    {
        var devices = await ListDevicesOrEmptyAsync(devicesTimeoutMs, cancellationToken);
        var candidates = new List<string> { DefaultEndpoint };
        candidates.AddRange(devices.Select(device => device.Serial).Where(serial => serial.StartsWith("127.0.0.1:", StringComparison.OrdinalIgnoreCase)));
        if (!string.IsNullOrWhiteSpace(manualEndpoint))
        {
            candidates.Add(manualEndpoint);
        }

        candidates = candidates.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var checkedEndpoints = new List<string>();
        var sawTimedOutCandidate = false;

        foreach (var candidate in candidates)
        {
            checkedEndpoints.Add(candidate);
            diagnostics.Log(DiagnosticLevel.Info, "wsa", $"Checking WSA endpoint {candidate}");
            if (devices.Any(device => device.Serial == candidate && device.Status == "device"))
            {
                return new ConnectionResult
                {
                    Connected = true,
                    Endpoint = candidate,
                    CheckedEndpoints = checkedEndpoints,
                    Message = "ADB already has an active WSA device."
                };
            }

            try
            {
                var result = await WithTimeoutAsync(adbService.ConnectAsync(candidate, connectTimeoutMs, cancellationToken), connectTimeoutMs, $"ADB connect {candidate}");
                if (result.Success)
                {
                    diagnostics.Log(DiagnosticLevel.Success, "wsa", $"Connected to WSA at {candidate}");
                    return new ConnectionResult
                    {
                        Connected = true,
                        Endpoint = candidate,
                        CheckedEndpoints = checkedEndpoints,
                        Message = result.Message
                    };
                }
            }
            catch (Exception ex)
            {
                if (ex is TimeoutException || ex.Message.Contains("timed out", StringComparison.OrdinalIgnoreCase))
                {
                    sawTimedOutCandidate = true;
                }

                diagnostics.Log(DiagnosticLevel.Warn, "wsa", $"Failed connecting to {candidate}", ex.Message);
            }
        }

        return new ConnectionResult
        {
            Connected = false,
            CheckedEndpoints = checkedEndpoints,
            Message = sawTimedOutCandidate
                ? "WSA is installed, but it is not accepting ADB connections yet. Wake the subsystem and try again."
                : "Could not connect to WSA. Wake the subsystem and try again."
        };
    }

    public async Task<ConnectionResult> AutoHealConnectionAsync(
        string? manualEndpoint = null,
        int connectTimeoutMs = 20_000,
        int devicesTimeoutMs = 30_000,
        bool wakeIfNeeded = true,
        CancellationToken cancellationToken = default)
    {
        await adbService.RestartServerAsync(cancellationToken: cancellationToken);
        var connection = await ConnectToBestEndpointAsync(manualEndpoint, connectTimeoutMs, devicesTimeoutMs, cancellationToken);
        if (connection.Connected || !wakeIfNeeded)
        {
            return connection;
        }

        await WakeAsync(cancellationToken);

        var checkedEndpoints = connection.CheckedEndpoints.ToList();
        var deadline = DateTimeOffset.UtcNow.AddMilliseconds(Math.Max(15_000, connectTimeoutMs + devicesTimeoutMs));
        ConnectionResult retry = connection;
        while (DateTimeOffset.UtcNow < deadline)
        {
            retry = await ConnectToBestEndpointAsync(manualEndpoint, connectTimeoutMs, devicesTimeoutMs, cancellationToken);
            checkedEndpoints.AddRange(retry.CheckedEndpoints);
            retry.CheckedEndpoints = checkedEndpoints;
            if (retry.Connected)
            {
                return retry;
            }

            await Task.Delay(1_500, cancellationToken);
        }

        retry.CheckedEndpoints = checkedEndpoints;
        return retry;
    }

    private async Task<IReadOnlyList<ParsedDevice>> ListDevicesOrEmptyAsync(int devicesTimeoutMs, CancellationToken cancellationToken)
    {
        try
        {
            return await WithTimeoutAsync(adbService.ListDevicesAsync(devicesTimeoutMs, cancellationToken), devicesTimeoutMs, "ADB devices listing");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "adb", "Could not list ADB devices", ex.Message);
            return [];
        }
    }

    private async Task<WsaPackageInfo?> GetInstalledPackageAsync(CancellationToken cancellationToken)
    {
        const string script = @"
$pkg = Get-AppxPackage *WindowsSubsystemForAndroid* | Select-Object -First 1 Name, PackageFullName, InstallLocation, Version
if ($pkg) {
  $pkg | ConvertTo-Json -Compress
  exit
}
$proc = Get-Process -Name WsaService,WsaSettings,WsaClient -ErrorAction SilentlyContinue | Where-Object { $_.Path } | Select-Object -First 1
if ($proc) {
  $root = Split-Path -Parent $proc.Path
  while ($root -and -not (Test-Path (Join-Path $root 'AppxManifest.xml'))) {
    $next = Split-Path -Parent $root
    if ($next -eq $root) { break }
    $root = $next
  }
  $version = 'custom'
  $manifest = Join-Path $root 'AppxManifest.xml'
  if (Test-Path $manifest) {
    try { [xml]$xml = Get-Content $manifest; $version = $xml.Package.Identity.Version } catch {}
  }
  [PSCustomObject]@{
    Name = 'MicrosoftCorporationII.WindowsSubsystemForAndroid'
    PackageFullName = 'CustomWSA'
    InstallLocation = $root
    Version = $version
  } | ConvertTo-Json -Compress
}
";
        var result = await commandRunner.RunAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], 4_000, cancellationToken);
        if (string.IsNullOrWhiteSpace(result.Stdout))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<WsaPackageInfo>(result.Stdout.Trim());
        }
        catch
        {
            return null;
        }
    }

    private static async Task<T> WithTimeoutAsync<T>(Task<T> task, int timeoutMs, string label)
    {
        try
        {
            return await task.WaitAsync(TimeSpan.FromMilliseconds(timeoutMs));
        }
        catch (TimeoutException)
        {
            throw new TimeoutException($"{label} timed out after {Math.Round(timeoutMs / 1000.0)}s.");
        }
    }
}
