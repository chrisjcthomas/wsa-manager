namespace WsaManager.Core;

public enum DiagnosticLevel
{
    Debug,
    Info,
    Success,
    Warn,
    Error
}

public enum QueueItemState
{
    Queued,
    AlreadyInstalled,
    Connecting,
    Installing,
    Installed,
    Failed,
    Rejected,
    Skipped
}

public sealed class InstallHistoryEntry
{
    public string PackageName { get; set; } = "";
    public string Label { get; set; } = "";
    public string FileName { get; set; } = "";
    public long SizeBytes { get; set; }
    public string? IconPath { get; set; }
    public DateTimeOffset InstalledAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SettingsState
{
    public int Version { get; set; } = 1;
    public bool WizardCompleted { get; set; }
    public string? AdbPath { get; set; }
    public string? ManualEndpoint { get; set; }
    public List<InstallHistoryEntry> RecentInstalls { get; set; } = [];
}

public sealed class DiagnosticLogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n");
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public DiagnosticLevel Level { get; set; }
    public string Source { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Detail { get; set; }
}

public sealed class ResolvedAdb
{
    public string Path { get; set; } = "";
    public string Version { get; set; } = "";
    public string Source { get; set; } = "";
}

public sealed class ParsedDevice
{
    public string Serial { get; set; } = "";
    public string Status { get; set; } = "";
}

public sealed class ReadinessSnapshot
{
    public DateTimeOffset CheckedAt { get; set; } = DateTimeOffset.UtcNow;
    public string OverallStatus { get; set; } = "needs_attention";
    public bool WizardCompleted { get; set; }
    public bool NeedsSetup { get; set; } = true;
    public AdbReadiness Adb { get; set; } = new();
    public WsaReadiness Wsa { get; set; } = new();
    public ConnectionReadiness Connection { get; set; } = new();
    public List<string> Messages { get; set; } = [];
}

public sealed class AdbReadiness
{
    public string Status { get; set; } = "not_found";
    public string? Path { get; set; }
    public string? Version { get; set; }
    public string? Source { get; set; }
    public string? Message { get; set; }
}

public sealed class WsaReadiness
{
    public string Status { get; set; } = "not_found";
    public string? PackageName { get; set; }
    public string? PackageFullName { get; set; }
    public string? Version { get; set; }
    public string? InstallLocation { get; set; }
    public string? Message { get; set; }
}

public sealed class ConnectionReadiness
{
    public string Status { get; set; } = "unknown";
    public string? Endpoint { get; set; }
    public List<string> CheckedEndpoints { get; set; } = [];
    public string? Message { get; set; }
}

public sealed class InstallQueueItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("n");
    public string FilePath { get; set; } = "";
    public string FileName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public long SizeBytes { get; set; }
    public QueueItemState State { get; set; }
    public int Progress { get; set; }
    public string? PackageName { get; set; }
    public bool WasUninstalledBeforeInstall { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class InstalledAppEntry
{
    public string PackageName { get; set; } = "";
    public string Label { get; set; } = "";
    public string LabelSource { get; set; } = "derived";
    public string? IconPath { get; set; }
    public string? IconUri => string.IsNullOrWhiteSpace(IconPath) || !File.Exists(IconPath) ? null : new Uri(IconPath).AbsoluteUri;
    public DateTimeOffset? LastInstalledAt { get; set; }
    public string DateAddedLabel { get; set; } = "--";
    public string? VersionName { get; set; }
    public bool CanUninstall { get; set; } = true;
    public string Status { get; set; } = "idle";
    public string SizeLabel { get; set; } = "--";
}

public sealed class PackageDetails
{
    public string PackageName { get; set; } = "";
    public string? VersionName { get; set; }
    public DateTimeOffset? FirstInstallTime { get; set; }
    public DateTimeOffset? LastUpdateTime { get; set; }
}

public sealed class WindowsWsaAppRegistration
{
    public string PackageName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? IconPath { get; set; }
    public string? ShortcutPath { get; set; }
}

public sealed class WsaPackageInfo
{
    public string Name { get; set; } = "";
    public string PackageFullName { get; set; } = "";
    public string InstallLocation { get; set; } = "";
    public string Version { get; set; } = "";
}

public sealed class ConnectionResult
{
    public bool Connected { get; set; }
    public string? Endpoint { get; set; }
    public List<string> CheckedEndpoints { get; set; } = [];
    public string Message { get; set; } = "";
}
