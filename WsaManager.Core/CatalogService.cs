namespace WsaManager.Core;

public sealed class CatalogService
{
    private readonly AdbService adbService;
    private readonly SettingsStore settingsStore;
    private readonly DiagnosticsService diagnostics;
    private readonly ApkIconExtractor iconExtractor;
    private readonly WindowsAppRegistrationCleaner? windowsCleaner;
    private readonly IWindowsWsaAppCatalog? windowsCatalog;

    public CatalogService(
        AdbService adbService,
        SettingsStore settingsStore,
        DiagnosticsService diagnostics,
        WindowsAppRegistrationCleaner? windowsCleaner = null,
        IWindowsWsaAppCatalog? windowsCatalog = null)
    {
        this.adbService = adbService;
        this.settingsStore = settingsStore;
        this.diagnostics = diagnostics;
        iconExtractor = new ApkIconExtractor();
        this.windowsCleaner = windowsCleaner;
        this.windowsCatalog = windowsCatalog;
    }

    public async Task<IReadOnlyList<InstalledAppEntry>> ListInstalledAppsAsync(CancellationToken cancellationToken = default)
    {
        var historyByPackage = settingsStore.Get().RecentInstalls.ToDictionary(entry => entry.PackageName, StringComparer.OrdinalIgnoreCase);
        var packages = await adbService.ListUserPackagesAsync(cancellationToken: cancellationToken);
        IReadOnlyList<WindowsWsaAppRegistration> registrations = windowsCatalog is null
            ? []
            : await windowsCatalog.GetRegisteredAppsAsync(cancellationToken);
        var registrationByPackage = registrations.ToDictionary(entry => entry.PackageName, StringComparer.OrdinalIgnoreCase);
        var packageSet = packages
            .Concat(registrations.Select(registration => registration.PackageName))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var entries = new List<InstalledAppEntry>();

        foreach (var packageName in packageSet)
        {
            historyByPackage.TryGetValue(packageName, out var history);
            registrationByPackage.TryGetValue(packageName, out var registration);
            var details = await GetPackageDetailsAsync(packageName, cancellationToken);
            var dateAdded = history?.InstalledAt ?? details.FirstInstallTime;
            entries.Add(new InstalledAppEntry
            {
                PackageName = packageName,
                Label = registration?.DisplayName ?? history?.Label ?? DisplayNames.DeriveLabelFromPackageName(packageName),
                LabelSource = registration is not null ? "windows" : history is null ? "derived" : "history",
                IconPath = ResolveRegisteredIconPath(packageName, registration) ?? await ResolveIconPathAsync(packageName, history, cancellationToken),
                LastInstalledAt = dateAdded,
                DateAddedLabel = dateAdded?.LocalDateTime.ToString("M/d/yyyy") ?? "--",
                VersionName = details.VersionName,
                Status = "idle",
                CanUninstall = true,
                SizeLabel = history is null || history.SizeBytes <= 0 ? "--" : FormatBytes(history.SizeBytes)
            });
        }

        entries = entries.OrderBy(entry => entry.Label, StringComparer.CurrentCultureIgnoreCase).ToList();

        diagnostics.Log(DiagnosticLevel.Info, "catalog", $"Loaded {entries.Count} installed packages");
        return entries;
    }

    public async Task<PackageDetails> GetPackageDetailsAsync(string packageName, CancellationToken cancellationToken = default)
    {
        try
        {
            var dump = await adbService.GetPackageDumpAsync(packageName, cancellationToken: cancellationToken);
            return ParsePackageDetails(packageName, dump);
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "catalog", $"Could not load details for {packageName}", ex.Message);
            return new PackageDetails { PackageName = packageName };
        }
    }

    public async Task<(bool Success, string Message)> UninstallAppAsync(string packageName, CancellationToken cancellationToken = default)
    {
        var result = await adbService.UninstallPackageAsync(packageName, cancellationToken: cancellationToken);
        WindowsCleanupResult? cleanup = null;
        if (result.Success && windowsCleaner is not null)
        {
            cleanup = await windowsCleaner.CleanupWsaAppRegistrationAsync(packageName, cancellationToken);
        }

        var detail = result.Message;
        if (cleanup is not null)
        {
            detail = $"{detail}\nWindows cleanup removed {cleanup.RemovedItems.Count} item(s).";
            if (cleanup.Errors.Count > 0)
            {
                detail = $"{detail}\nCleanup warnings: {string.Join("; ", cleanup.Errors)}";
            }
        }

        diagnostics.Log(result.Success ? DiagnosticLevel.Success : DiagnosticLevel.Warn, "catalog", result.Success ? $"Uninstalled {packageName}" : $"Failed to uninstall {packageName}", detail);
        return (result.Success, detail);
    }

    private async Task<string?> ResolveIconPathAsync(string packageName, InstallHistoryEntry? history, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(history?.IconPath) && File.Exists(history.IconPath))
        {
            return history.IconPath;
        }

        var iconDirectory = Path.Combine(settingsStore.AppDataDirectory, "icons");
        var cachedIcon = Directory.Exists(iconDirectory)
            ? Directory.EnumerateFiles(iconDirectory, $"{SafeFileName(packageName)}.*").FirstOrDefault()
            : null;
        if (cachedIcon is not null)
        {
            return cachedIcon;
        }

        try
        {
            var deviceApkPath = await adbService.GetPackageApkPathAsync(packageName, cancellationToken: cancellationToken);
            if (string.IsNullOrWhiteSpace(deviceApkPath))
            {
                return null;
            }

            var apkCacheDirectory = Path.Combine(settingsStore.AppDataDirectory, "apk-cache");
            var localApkPath = Path.Combine(apkCacheDirectory, $"{SafeFileName(packageName)}.apk");
            if (!File.Exists(localApkPath) && !await adbService.PullFileAsync(deviceApkPath, localApkPath, cancellationToken: cancellationToken))
            {
                return null;
            }

            var iconPath = iconExtractor.TryExtractIcon(localApkPath, iconDirectory, packageName);
            if (iconPath is not null)
            {
                diagnostics.Log(DiagnosticLevel.Info, "catalog", $"Cached icon for {packageName}");
            }

            return iconPath;
        }
        catch (Exception ex)
        {
            diagnostics.Log(DiagnosticLevel.Warn, "catalog", $"Could not load icon for {packageName}", ex.Message);
            return null;
        }
    }

    private string? ResolveRegisteredIconPath(string packageName, WindowsWsaAppRegistration? registration)
    {
        if (registration?.IconPath is null)
        {
            return null;
        }

        var iconPath = registration.IconPath;
        if (iconPath.EndsWith(",0", StringComparison.OrdinalIgnoreCase))
        {
            iconPath = iconPath[..^2];
        }

        if (!File.Exists(iconPath))
        {
            return null;
        }

        try
        {
            var iconDirectory = Path.Combine(settingsStore.AppDataDirectory, "icons");
            Directory.CreateDirectory(iconDirectory);
            var copiedPath = Path.Combine(iconDirectory, $"{SafeFileName(packageName)}{Path.GetExtension(iconPath)}");
            File.Copy(iconPath, copiedPath, overwrite: true);
            return copiedPath;
        }
        catch
        {
            return iconPath;
        }
    }

    public static PackageDetails ParsePackageDetails(string packageName, string dump)
    {
        var details = new PackageDetails { PackageName = packageName };
        foreach (var line in dump.Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries).Select(line => line.Trim()))
        {
            if (line.StartsWith("versionName=", StringComparison.OrdinalIgnoreCase))
            {
                details.VersionName = line["versionName=".Length..].Trim();
            }
            else if (line.StartsWith("firstInstallTime=", StringComparison.OrdinalIgnoreCase) && DateTimeOffset.TryParse(line["firstInstallTime=".Length..].Trim(), out var firstInstallTime))
            {
                details.FirstInstallTime = firstInstallTime;
            }
            else if (line.StartsWith("lastUpdateTime=", StringComparison.OrdinalIgnoreCase) && DateTimeOffset.TryParse(line["lastUpdateTime=".Length..].Trim(), out var lastUpdateTime))
            {
                details.LastUpdateTime = lastUpdateTime;
            }
        }

        return details;
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = ["B", "KB", "MB", "GB"];
        var value = (double)bytes;
        var unit = 0;
        while (value >= 1024 && unit < units.Length - 1)
        {
            value /= 1024;
            unit++;
        }

        return unit == 0 ? $"{bytes} B" : $"{value:0.0} {units[unit]}";
    }

    private static string SafeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(value.Select(character => invalid.Contains(character) ? '_' : character));
    }
}
