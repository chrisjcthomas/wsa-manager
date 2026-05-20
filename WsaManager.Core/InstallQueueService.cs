namespace WsaManager.Core;

public sealed class InstallQueueService
{
    private readonly List<InstallQueueItem> items = [];
    private readonly AdbService adbService;
    private readonly WsaService wsaService;
    private readonly SettingsStore settingsStore;
    private readonly DiagnosticsService diagnostics;
    private readonly IApkPackageReader apkPackageReader;
    private readonly ApkIconExtractor iconExtractor = new();
    private bool processing;

    public InstallQueueService(AdbService adbService, WsaService wsaService, SettingsStore settingsStore, DiagnosticsService diagnostics, IApkPackageReader? apkPackageReader = null)
    {
        this.adbService = adbService;
        this.wsaService = wsaService;
        this.settingsStore = settingsStore;
        this.diagnostics = diagnostics;
        this.apkPackageReader = apkPackageReader ?? new ApkPackageReader();
    }

    public event EventHandler<IReadOnlyList<InstallQueueItem>>? QueueChanged;

    public IReadOnlyList<InstallQueueItem> Items => items.ToList();

    public async Task<IReadOnlyList<InstallQueueItem>> EnqueueAsync(IEnumerable<string> paths, CancellationToken cancellationToken = default)
    {
        var created = new List<InstallQueueItem>();
        foreach (var filePath in paths)
        {
            var fileInfo = new FileInfo(filePath);
            var isApk = filePath.EndsWith(".apk", StringComparison.OrdinalIgnoreCase);
            var isValid = isApk && fileInfo.Exists;
            var item = new InstallQueueItem
            {
                Id = Guid.NewGuid().ToString("n"),
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                DisplayName = DisplayNames.DeriveLabelFromFilePath(filePath),
                SizeBytes = fileInfo.Exists ? fileInfo.Length : 0,
                State = isValid ? QueueItemState.Queued : QueueItemState.Rejected,
                Progress = 0,
                Error = isValid ? null : "Only existing .apk files are supported in v1.",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            items.Insert(0, item);
            created.Add(item);
        }

        EmitSnapshot();
        await ProcessQueueAsync(cancellationToken);
        return created;
    }

    public async Task ReplaceExistingAsync(string itemId, CancellationToken cancellationToken = default)
    {
        var item = items.FirstOrDefault(item => item.Id == itemId);
        if (item is null || item.State != QueueItemState.AlreadyInstalled)
        {
            return;
        }

        await ProcessItemAsync(item, forceReplaceExisting: true, cancellationToken);
        await ProcessQueueAsync(cancellationToken);
    }

    public async Task SkipAsync(string itemId, CancellationToken cancellationToken = default)
    {
        var item = items.FirstOrDefault(item => item.Id == itemId);
        if (item is null || item.State != QueueItemState.AlreadyInstalled)
        {
            return;
        }

        item.Error = null;
        UpdateItem(item, QueueItemState.Skipped, 100);
        diagnostics.Log(DiagnosticLevel.Info, "queue", $"Skipped reinstall for {item.PackageName ?? item.FileName}");
        await ProcessQueueAsync(cancellationToken);
    }

    private async Task ProcessQueueAsync(CancellationToken cancellationToken)
    {
        if (processing)
        {
            return;
        }

        processing = true;
        try
        {
            while (items.FirstOrDefault(item => item.State == QueueItemState.Queued) is { } nextItem)
            {
                await ProcessItemAsync(nextItem, forceReplaceExisting: false, cancellationToken);
            }
        }
        finally
        {
            processing = false;
        }
    }

    private async Task ProcessItemAsync(InstallQueueItem item, bool forceReplaceExisting, CancellationToken cancellationToken)
    {
        UpdateItem(item, QueueItemState.Connecting, 10);
        diagnostics.Log(DiagnosticLevel.Info, "queue", $"Preparing install for {item.FileName}");

        try
        {
            await adbService.EnsureServerAsync(cancellationToken: cancellationToken);
            var detectedPackageName = apkPackageReader.TryReadPackageName(item.FilePath);
            item.PackageName = detectedPackageName;
            EmitSnapshot();

            var connection = await wsaService.AutoHealConnectionAsync(settingsStore.Get().ManualEndpoint, cancellationToken: cancellationToken);

            if (!connection.Connected)
            {
                throw new InvalidOperationException(connection.Message);
            }

            UpdateItem(item, QueueItemState.Installing, 45);
            var beforePackages = new HashSet<string>(await adbService.ListUserPackagesAsync(cancellationToken: cancellationToken));
            if (!string.IsNullOrWhiteSpace(detectedPackageName) && beforePackages.Contains(detectedPackageName))
            {
                if (!forceReplaceExisting)
                {
                    item.Error = "This app is already installed. Choose Replace app to reinstall it, or Skip to leave it alone.";
                    UpdateItem(item, QueueItemState.AlreadyInstalled, 0);
                    diagnostics.Log(DiagnosticLevel.Warn, "queue", $"{detectedPackageName} is already installed");
                    return;
                }

                var uninstallResult = await adbService.UninstallPackageAsync(detectedPackageName, cancellationToken: cancellationToken);
                if (!uninstallResult.Success)
                {
                    throw new InvalidOperationException($"Could not uninstall existing {detectedPackageName}: {uninstallResult.Message}");
                }

                item.WasUninstalledBeforeInstall = true;
                diagnostics.Log(DiagnosticLevel.Info, "queue", $"Uninstalled existing {detectedPackageName} before reinstall");
            }

            var installResult = await adbService.InstallApkAsync(item.FilePath, cancellationToken: cancellationToken);
            if (!installResult.Success)
            {
                throw new InvalidOperationException(installResult.Message);
            }

            var afterPackages = await adbService.ListUserPackagesAsync(cancellationToken: cancellationToken);
            var newPackage = detectedPackageName ?? afterPackages.FirstOrDefault(packageName => !beforePackages.Contains(packageName));
            item.PackageName = newPackage;
            var iconPath = iconExtractor.TryExtractIcon(item.FilePath, Path.Combine(settingsStore.AppDataDirectory, "icons"), newPackage ?? item.DisplayName);
            settingsStore.RecordInstall(new InstallHistoryEntry
            {
                PackageName = newPackage ?? item.DisplayName,
                Label = item.DisplayName,
                FileName = item.FileName,
                SizeBytes = item.SizeBytes,
                IconPath = iconPath,
                InstalledAt = DateTimeOffset.UtcNow
            });
            UpdateItem(item, QueueItemState.Installed, 100);
            diagnostics.Log(DiagnosticLevel.Success, "queue", $"Installed {item.FileName}", newPackage is not null ? $"Package: {newPackage}" : null);
        }
        catch (Exception ex)
        {
            item.Error = ex.Message;
            UpdateItem(item, QueueItemState.Failed, 100);
            diagnostics.Log(DiagnosticLevel.Error, "queue", $"Install failed for {item.FileName}", ex.Message);
        }
    }

    private void UpdateItem(InstallQueueItem item, QueueItemState state, int progress)
    {
        item.State = state;
        item.Progress = progress;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        EmitSnapshot();
    }

    private void EmitSnapshot() => QueueChanged?.Invoke(this, Items);
}
