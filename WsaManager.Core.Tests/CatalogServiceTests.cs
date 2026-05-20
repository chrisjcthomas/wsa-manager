using WsaManager.Core;

namespace WsaManager.Core.Tests;

[TestClass]
public sealed class CatalogServiceTests
{
    [TestMethod]
    public async Task InstalledAppEntriesUseHistorySizeAndDumpsysDate()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");
        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        settings.RecordInstall(new InstallHistoryEntry
        {
            PackageName = "com.mobiflix.mobile",
            Label = "Mobiflix",
            FileName = "mobiflix.apk",
            SizeBytes = 13_386_944,
            InstalledAt = new DateTimeOffset(2026, 5, 19, 12, 18, 24, TimeSpan.Zero)
        });

        var runner = new TestCommandRunner
        {
            Handler = (command, args) =>
            {
                if (command == "where.exe")
                {
                    return new CommandResult { ExitCode = 0, Stdout = adbPath };
                }

                if (args.SequenceEqual(["version"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Android Debug Bridge version 1.0.41" };
                }

                if (args.SequenceEqual(["shell", "pm", "list", "packages", "-3"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "package:com.mobiflix.mobile\npackage:org.mozilla.firefox\n" };
                }

                if (args.SequenceEqual(["shell", "dumpsys", "package", "com.mobiflix.mobile"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "versionName=1.0.0\nfirstInstallTime=2026-05-19 12:18:24\n" };
                }

                if (args.SequenceEqual(["shell", "dumpsys", "package", "org.mozilla.firefox"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "versionName=150.0.1\nfirstInstallTime=2026-05-18 10:00:00\n" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var catalog = new CatalogService(adb, settings, diagnostics);

        var apps = await catalog.ListInstalledAppsAsync();
        var mobiflix = apps.Single(app => app.PackageName == "com.mobiflix.mobile");
        var firefox = apps.Single(app => app.PackageName == "org.mozilla.firefox");

        Assert.AreEqual("12.8 MB", mobiflix.SizeLabel);
        Assert.AreEqual("5/19/2026", mobiflix.DateAddedLabel);
        Assert.AreEqual("1.0.0", mobiflix.VersionName);
        Assert.AreEqual("--", firefox.SizeLabel);
        Assert.AreEqual("5/18/2026", firefox.DateAddedLabel);
    }

    [TestMethod]
    public async Task UninstallAppCallsAdbUninstall()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");
        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var runner = new TestCommandRunner
        {
            Handler = (command, args) =>
            {
                if (command == "where.exe")
                {
                    return new CommandResult { ExitCode = 0, Stdout = adbPath };
                }

                if (args.SequenceEqual(["version"]) || args.SequenceEqual(["uninstall", "com.mobiflix.mobile"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = args[0] == "version" ? "Android Debug Bridge version 1.0.41" : "Success" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var catalog = new CatalogService(adb, settings, diagnostics);

        var result = await catalog.UninstallAppAsync("com.mobiflix.mobile");

        Assert.IsTrue(result.Success);
        Assert.IsTrue(runner.Calls.Any(call => call.Args.SequenceEqual(["uninstall", "com.mobiflix.mobile"])));
    }

    [TestMethod]
    public async Task SuccessfulUninstallRunsWindowsRegistrationCleanup()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");
        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var runner = new TestCommandRunner
        {
            Handler = (command, args) =>
            {
                if (command == "where.exe")
                {
                    return new CommandResult { ExitCode = 0, Stdout = adbPath };
                }

                if (args.SequenceEqual(["version"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Android Debug Bridge version 1.0.41" };
                }

                if (args.SequenceEqual(["uninstall", "org.mozilla.firefox"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Success" };
                }

                if (command == "powershell.exe")
                {
                    return new CommandResult
                    {
                        ExitCode = 0,
                        Stdout = """{"RemovedItems":["Uninstall registry: org.mozilla.firefox"],"Errors":[]}"""
                    };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var cleaner = new WindowsAppRegistrationCleaner(runner, diagnostics);
        var catalog = new CatalogService(adb, settings, diagnostics, cleaner);

        var result = await catalog.UninstallAppAsync("org.mozilla.firefox");

        Assert.IsTrue(result.Success);
        Assert.IsTrue(result.Message.Contains("Windows cleanup removed 1 item", StringComparison.OrdinalIgnoreCase));
        Assert.IsTrue(runner.Calls.Any(call => call.Command == "powershell.exe" && call.Args.Any(arg => arg.Contains("org.mozilla.firefox", StringComparison.Ordinal))));
    }
}
