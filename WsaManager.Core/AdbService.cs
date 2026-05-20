namespace WsaManager.Core;

public sealed class AdbService
{
    private readonly SettingsStore settingsStore;
    private readonly DiagnosticsService diagnostics;
    private readonly ICommandRunner commandRunner;
    private readonly Func<string, string?> getEnvironmentVariable;
    private readonly Func<string, bool> fileExists;

    public AdbService(
        SettingsStore settingsStore,
        DiagnosticsService diagnostics,
        ICommandRunner commandRunner,
        Func<string, string?>? getEnvironmentVariable = null,
        Func<string, bool>? fileExists = null)
    {
        this.settingsStore = settingsStore;
        this.diagnostics = diagnostics;
        this.commandRunner = commandRunner;
        this.getEnvironmentVariable = getEnvironmentVariable ?? Environment.GetEnvironmentVariable;
        this.fileExists = fileExists ?? File.Exists;
    }

    public async Task<ResolvedAdb?> ResolveAdbAsync(int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        foreach (var candidate in await CollectCandidatesAsync(timeoutMs, cancellationToken))
        {
            if (!fileExists(candidate.Path))
            {
                continue;
            }

            try
            {
                var result = await commandRunner.RunAsync(candidate.Path, ["version"], timeoutMs, cancellationToken);
                var version = AdbParsers.ParseAdbVersion(result.Stdout) ?? AdbParsers.ParseAdbVersion(result.Stderr);
                if (result.ExitCode == 0 && version is not null)
                {
                    if (string.IsNullOrWhiteSpace(settingsStore.Get().AdbPath))
                    {
                        settingsStore.SetAdbPath(candidate.Path);
                        diagnostics.Log(DiagnosticLevel.Success, "adb", $"Detected adb.exe from {candidate.Source}", candidate.Path);
                    }

                    return new ResolvedAdb { Path = candidate.Path, Version = version, Source = candidate.Source };
                }
            }
            catch
            {
                // Continue trying later candidates.
            }
        }

        return null;
    }

    public async Task<ResolvedAdb> EnsureServerAsync(int timeoutMs = 15_000, CancellationToken cancellationToken = default)
    {
        var adb = await RequireAdbAsync(timeoutMs, cancellationToken);
        await ExecAdbAsync(["start-server"], timeoutMs, cancellationToken);
        return adb;
    }

    public async Task<ResolvedAdb> RestartServerAsync(int timeoutMs = 15_000, CancellationToken cancellationToken = default)
    {
        var adb = await RequireAdbAsync(timeoutMs, cancellationToken);
        await ExecAdbAsync(["kill-server"], timeoutMs, cancellationToken);
        await ExecAdbAsync(["start-server"], timeoutMs, cancellationToken);
        diagnostics.Log(DiagnosticLevel.Info, "adb", "Restarted ADB server");
        return adb;
    }

    public async Task<List<ParsedDevice>> ListDevicesAsync(int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["devices"], timeoutMs, cancellationToken);
        return AdbParsers.ParseAdbDevicesOutput(result.Stdout);
    }

    public async Task<(bool Success, string Message)> ConnectAsync(string endpoint, int timeoutMs = 20_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["connect", endpoint], timeoutMs, cancellationToken);
        var message = $"{result.Stdout}\n{result.Stderr}".Trim();
        var success = result.ExitCode == 0 && (message.Contains("connected to", StringComparison.OrdinalIgnoreCase) || message.Contains("already connected to", StringComparison.OrdinalIgnoreCase));
        return (success, message);
    }

    public async Task<(bool Success, string Message)> InstallApkAsync(string apkPath, int timeoutMs = 120_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["install", "-r", apkPath], timeoutMs, cancellationToken);
        var message = $"{result.Stdout}\n{result.Stderr}".Trim();
        return (result.ExitCode == 0 && message.Contains("success", StringComparison.OrdinalIgnoreCase), result.ExitCode == 0 ? message : AdbParsers.ExtractInstallError(result.Stdout, result.Stderr));
    }

    public async Task<(bool Success, string Message)> UninstallPackageAsync(string packageName, int timeoutMs = 60_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["uninstall", packageName], timeoutMs, cancellationToken);
        var message = $"{result.Stdout}\n{result.Stderr}".Trim();
        return (result.ExitCode == 0 && message.Contains("success", StringComparison.OrdinalIgnoreCase), message.Length > 0 ? message : result.ExitCode == 0 ? "Success" : "Uninstall failed");
    }

    public async Task<string> GetPackageDumpAsync(string packageName, int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["shell", "dumpsys", "package", packageName], timeoutMs, cancellationToken);
        return result.Stdout;
    }

    public async Task<string?> GetPackageApkPathAsync(string packageName, int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["shell", "pm", "path", packageName], timeoutMs, cancellationToken);
        return result.Stdout
            .Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .FirstOrDefault(line => line.StartsWith("package:", StringComparison.OrdinalIgnoreCase))?["package:".Length..];
    }

    public async Task<bool> PullFileAsync(string devicePath, string localPath, int timeoutMs = 60_000, CancellationToken cancellationToken = default)
    {
        var directory = Path.GetDirectoryName(localPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var result = await ExecAdbAsync(["pull", devicePath, localPath], timeoutMs, cancellationToken);
        return result.ExitCode == 0 && File.Exists(localPath);
    }

    public async Task<List<string>> ListUserPackagesAsync(int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        var result = await ExecAdbAsync(["shell", "pm", "list", "packages", "-3"], timeoutMs, cancellationToken);
        return AdbParsers.ParsePackageListOutput(result.Stdout);
    }

    private async Task<CommandResult> ExecAdbAsync(IReadOnlyList<string> args, int timeoutMs, CancellationToken cancellationToken)
    {
        var adb = await RequireAdbAsync(timeoutMs, cancellationToken);
        var result = await commandRunner.RunAsync(adb.Path, args, timeoutMs, cancellationToken);
        if (result.ExitCode != 0)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "adb", $"ADB command failed: {string.Join(" ", args)}", $"{result.Stdout}\n{result.Stderr}".Trim());
        }

        return result;
    }

    private async Task<ResolvedAdb> RequireAdbAsync(int timeoutMs, CancellationToken cancellationToken)
    {
        var adb = await ResolveAdbAsync(timeoutMs, cancellationToken);
        if (adb is null)
        {
            diagnostics.Log(DiagnosticLevel.Error, "adb", "ADB executable not found");
            throw new InvalidOperationException("ADB executable not found");
        }

        return adb;
    }

    private async Task<List<(string Path, string Source)>> CollectCandidatesAsync(int timeoutMs, CancellationToken cancellationToken)
    {
        var settings = settingsStore.Get();
        var candidates = new List<(string Path, string Source)>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddCandidate(string? path, string source)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            var normalized = System.IO.Path.GetFullPath(Environment.ExpandEnvironmentVariables(path));
            if (seen.Add(normalized))
            {
                candidates.Add((normalized, source));
            }
        }

        AddCandidate(settings.AdbPath, "saved");
        AddCandidate(getEnvironmentVariable("ANDROID_SDK_ROOT") is { } sdkRoot ? Path.Combine(sdkRoot, "platform-tools", "adb.exe") : null, "ANDROID_SDK_ROOT");
        AddCandidate(getEnvironmentVariable("ANDROID_HOME") is { } androidHome ? Path.Combine(androidHome, "platform-tools", "adb.exe") : null, "ANDROID_HOME");
        AddCandidate(getEnvironmentVariable("LOCALAPPDATA") is { } localAppData ? Path.Combine(localAppData, "Android", "Sdk", "platform-tools", "adb.exe") : null, "LOCALAPPDATA");
        AddCandidate(getEnvironmentVariable("USERPROFILE") is { } userProfile ? Path.Combine(userProfile, "Desktop", "platform-tools", "adb.exe") : null, "Desktop platform-tools");

        try
        {
            var result = await commandRunner.RunAsync("where.exe", ["adb"], timeoutMs, cancellationToken);
            foreach (var line in result.Stdout.Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries))
            {
                AddCandidate(line.Trim(), "PATH");
            }
        }
        catch
        {
            // PATH lookup is optional.
        }

        return candidates;
    }
}
