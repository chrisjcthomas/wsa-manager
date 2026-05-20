using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.UI.Dispatching;
using WsaManager.Core;

namespace WsaManager_WinUI.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly SettingsStore settingsStore;
    private readonly DiagnosticsService diagnostics;
    private readonly WsaService wsaService;
    private readonly InstallQueueService installQueue;
    private readonly CatalogService catalog;
    private readonly DispatcherQueue dispatcherQueue;
    private SettingsState settings;
    private ReadinessSnapshot? readiness;
    private string? errorMessage;
    private bool isBusy;
    private string operationStatus = "Checking WSA and ADB";

    public MainViewModel(
        SettingsStore settingsStore,
        DiagnosticsService diagnostics,
        WsaService wsaService,
        InstallQueueService installQueue,
        CatalogService catalog,
        DispatcherQueue dispatcherQueue)
    {
        this.settingsStore = settingsStore;
        this.diagnostics = diagnostics;
        this.wsaService = wsaService;
        this.installQueue = installQueue;
        this.catalog = catalog;
        this.dispatcherQueue = dispatcherQueue;
        settings = settingsStore.Get();

        diagnostics.EntryAdded += (_, entry) => EnqueueOnUi(() => Diagnostics.Insert(0, entry));
        installQueue.QueueChanged += (_, items) => EnqueueOnUi(() => Replace(Queue, items));
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public ObservableCollection<InstallQueueItem> Queue { get; } = [];
    public ObservableCollection<InstalledAppEntry> Apps { get; } = [];
    public ObservableCollection<DiagnosticLogEntry> Diagnostics { get; } = [];

    public SettingsState Settings
    {
        get => settings;
        private set => SetField(ref settings, value);
    }

    public ReadinessSnapshot? Readiness
    {
        get => readiness;
        private set
        {
            if (SetField(ref readiness, value))
            {
                OnPropertyChanged(nameof(StatusText));
                OnPropertyChanged(nameof(AdbStatusText));
                OnPropertyChanged(nameof(WsaStatusText));
                OnPropertyChanged(nameof(ConnectionSummaryText));
                OnPropertyChanged(nameof(ConnectionStatusText));
                OnPropertyChanged(nameof(InlineStatusDetailText));
            }
        }
    }

    public string? ErrorMessage
    {
        get => errorMessage;
        private set => SetField(ref errorMessage, value);
    }

    public bool IsBusy
    {
        get => isBusy;
        private set => SetField(ref isBusy, value);
    }

    public string OperationStatus
    {
        get => operationStatus;
        private set => SetField(ref operationStatus, value);
    }

    public string StatusText => Readiness?.OverallStatus == "ready" ? "Ready" : "Setup needed";
    public string AdbStatusText => Readiness?.Adb.Version ?? Readiness?.Adb.Message ?? "Not checked";
    public string WsaStatusText => Readiness?.Wsa.Version ?? Readiness?.Wsa.Message ?? "Not checked";
    public string ConnectionSummaryText => Readiness?.OverallStatus == "ready"
        ? $"Connected to {Readiness.Connection.Endpoint ?? "WSA"}"
        : Readiness?.Connection.Message ?? "Waiting for WSA";
    public string ConnectionStatusText => Readiness?.Connection.Endpoint ?? Readiness?.Connection.Message ?? "Not checked";
    public string InlineStatusDetailText => Readiness?.OverallStatus == "ready"
        ? Readiness.Connection.Endpoint ?? "WSA is connected"
        : "Open Advanced settings and turn on Developer mode";
    public string AppsFoundText => Apps.Count == 1 ? "1 app found" : $"{Apps.Count} apps found";
    public string AdbPathDraft { get; set; } = "";
    public string ManualEndpointDraft { get; set; } = "";

    public async Task InitializeAsync()
    {
        Settings = settingsStore.Get();
        AdbPathDraft = Settings.AdbPath ?? "";
        ManualEndpointDraft = Settings.ManualEndpoint ?? "";
        OnPropertyChanged(nameof(AdbPathDraft));
        OnPropertyChanged(nameof(ManualEndpointDraft));
        Replace(Queue, installQueue.Items);
        Replace(Diagnostics, diagnostics.Entries);
        await RefreshReadinessAsync();
    }

    public async Task RefreshReadinessAsync()
    {
        await RunBusyAsync(async () =>
        {
            OperationStatus = "Connecting ADB";
            Readiness = await wsaService.GetReadinessSnapshotAsync();
            Settings = settingsStore.Get();
            OperationStatus = Readiness.OverallStatus == "ready" ? "Ready to install APKs" : "Needs setup";
            if (Readiness.OverallStatus == "ready")
            {
                await RefreshAppsAsync(setBusy: false);
            }
        });
    }

    public async Task WakeWsaAsync()
    {
        await RunBusyAsync(async () =>
        {
            OperationStatus = "Waking WSA";
            await wsaService.OpenAdvancedSettingsAsync();
            await Task.Delay(1_000);
            OperationStatus = "Reconnecting ADB";
            var connection = await wsaService.AutoHealConnectionAsync(Settings.ManualEndpoint, 4_000, 4_000, wakeIfNeeded: true);
            Readiness = await wsaService.GetReadinessSnapshotAsync();
            OperationStatus = connection.Connected && Readiness.OverallStatus == "ready" ? "Ready to install APKs" : "Needs setup";
        });
    }

    public async Task RefreshReadinessIfIdleAsync()
    {
        if (IsBusy)
        {
            return;
        }

        await RefreshReadinessAsync();
    }

    public async Task EnqueueApksAsync(IEnumerable<string> paths)
    {
        await RunBusyAsync(async () =>
        {
            OperationStatus = "Installing";
            await installQueue.EnqueueAsync(paths);
            Replace(Queue, installQueue.Items);
            if (Queue.Any(item => item.State == QueueItemState.Installed))
            {
                await RefreshAppsAsync(setBusy: false);
            }
            OperationStatus = Queue.Any(item => item.State == QueueItemState.Failed) ? "Install needs attention" : "Ready to install APKs";
        });
    }

    public async Task ReplaceQueuedAppAsync(string itemId)
    {
        await RunBusyAsync(async () =>
        {
            OperationStatus = "Replacing app";
            await installQueue.ReplaceExistingAsync(itemId);
            Replace(Queue, installQueue.Items);
            await RefreshAppsAsync(setBusy: false);
            OperationStatus = "Ready to install APKs";
        });
    }

    public async Task SkipQueuedAppAsync(string itemId)
    {
        await RunBusyAsync(async () =>
        {
            await installQueue.SkipAsync(itemId);
            Replace(Queue, installQueue.Items);
            OperationStatus = "Ready to install APKs";
        });
    }

    public async Task RefreshAppsAsync(bool setBusy = true)
    {
        async Task Work()
        {
            ReplaceApps(await catalog.ListInstalledAppsAsync());
        }

        if (setBusy)
        {
            await RunBusyAsync(Work);
        }
        else
        {
            await Work();
        }
    }

    public async Task UninstallAppAsync(string packageName)
    {
        await RunBusyAsync(async () =>
        {
            OperationStatus = "Uninstalling app";
            await catalog.UninstallAppAsync(packageName);
            await RefreshAppsAsync(setBusy: false);
            OperationStatus = "Ready to install APKs";
        });
    }

    public async Task SaveAdbPathAsync(string? adbPath)
    {
        Settings = settingsStore.SetAdbPath(adbPath);
        AdbPathDraft = Settings.AdbPath ?? "";
        OnPropertyChanged(nameof(AdbPathDraft));
        await RefreshReadinessAsync();
    }

    public async Task SaveManualEndpointAsync(string? endpoint)
    {
        Settings = settingsStore.SetManualEndpoint(endpoint);
        ManualEndpointDraft = Settings.ManualEndpoint ?? "";
        OnPropertyChanged(nameof(ManualEndpointDraft));
        await RefreshReadinessAsync();
    }

    public void ClearDiagnostics()
    {
        diagnostics.Clear();
        Diagnostics.Clear();
    }

    private async Task RunBusyAsync(Func<Task> work)
    {
        IsBusy = true;
        ErrorMessage = null;
        try
        {
            await work();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
            diagnostics.Log(DiagnosticLevel.Error, "ui", "Operation failed", ex.Message);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void EnqueueOnUi(Action action)
    {
        if (!dispatcherQueue.TryEnqueue(() => action()))
        {
            action();
        }
    }

    private static void Replace<T>(ObservableCollection<T> collection, IEnumerable<T> items)
    {
        collection.Clear();
        foreach (var item in items)
        {
            collection.Add(item);
        }
    }

    private void ReplaceApps(IEnumerable<InstalledAppEntry> items)
    {
        Replace(Apps, items);
        OnPropertyChanged(nameof(AppsFoundText));
    }

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
