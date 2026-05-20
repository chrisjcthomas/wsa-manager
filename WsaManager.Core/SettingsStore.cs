using System.Text.Json;

namespace WsaManager.Core;

public sealed class SettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private readonly string filePath;
    private SettingsState cache;

    public SettingsStore(string appDataDirectory)
    {
        filePath = Path.Combine(appDataDirectory, "settings.json");
        cache = Load();
    }

    public string AppDataDirectory => Path.GetDirectoryName(filePath)!;

    public SettingsState Get() => Clone(cache);

    public SettingsState SetAdbPath(string? adbPath)
    {
        cache.AdbPath = string.IsNullOrWhiteSpace(adbPath) ? null : adbPath;
        cache.WizardCompleted = false;
        Save();
        return Get();
    }

    public SettingsState SetManualEndpoint(string? manualEndpoint)
    {
        cache.ManualEndpoint = string.IsNullOrWhiteSpace(manualEndpoint) ? null : manualEndpoint;
        cache.WizardCompleted = false;
        Save();
        return Get();
    }

    public SettingsState SetWizardCompleted(bool value)
    {
        cache.WizardCompleted = value;
        Save();
        return Get();
    }

    public SettingsState RecordInstall(InstallHistoryEntry entry)
    {
        cache.RecentInstalls = new[] { entry }
            .Concat(cache.RecentInstalls.Where(item => item.PackageName != entry.PackageName))
            .Take(50)
            .ToList();
        Save();
        return Get();
    }

    private SettingsState Load()
    {
        try
        {
            if (!File.Exists(filePath))
            {
                return new SettingsState();
            }

        var loaded = JsonSerializer.Deserialize<SettingsState>(File.ReadAllText(filePath), JsonOptions) ?? new SettingsState();
        loaded.Version = 1;
        loaded.RecentInstalls ??= [];
        loaded.RecentInstalls.ForEach(entry =>
        {
            if (entry.SizeBytes < 0)
            {
                entry.SizeBytes = 0;
            }
        });
        return loaded;
        }
        catch
        {
            return new SettingsState();
        }
    }

    private void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        File.WriteAllText(filePath, JsonSerializer.Serialize(cache, JsonOptions));
    }

    private static SettingsState Clone(SettingsState settings)
    {
        return JsonSerializer.Deserialize<SettingsState>(JsonSerializer.Serialize(settings, JsonOptions), JsonOptions) ?? new SettingsState();
    }
}
