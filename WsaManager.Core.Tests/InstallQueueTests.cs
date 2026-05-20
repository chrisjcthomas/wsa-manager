using WsaManager.Core;

namespace WsaManager.Core.Tests;

[TestClass]
public sealed class InstallQueueTests
{
    private sealed class FakePackageReader(string? packageName) : IApkPackageReader
    {
        public string? TryReadPackageName(string apkPath) => packageName;
    }

    [TestMethod]
    public async Task QueueRejectsMissingOrNonApkFiles()
    {
        using var temp = new TempDirectory();
        var settings = new SettingsStore(temp.Path);
        var diagnostics = new DiagnosticsService();
        var runner = new TestCommandRunner();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);
        var queue = new InstallQueueService(adb, wsa, settings, diagnostics);

        await queue.EnqueueAsync([Path.Combine(temp.Path, "missing.apk"), Path.Combine(temp.Path, "notes.txt")]);

        Assert.AreEqual(2, queue.Items.Count);
        Assert.IsTrue(queue.Items.All(item => item.State == QueueItemState.Rejected));
    }

    [TestMethod]
    public async Task SuccessfulInstallRunsAdbAndRecordsHistory()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        var apkPath = Path.Combine(temp.Path, "Spotify.apk");
        File.WriteAllText(adbPath, "");
        File.WriteAllText(apkPath, "apk");

        var packageListCalls = 0;
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

                if (args.SequenceEqual(["start-server"]))
                {
                    return new CommandResult { ExitCode = 0 };
                }

                if (args.SequenceEqual(["devices"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "List of devices attached\n127.0.0.1:58526\tdevice\n" };
                }

                if (args.SequenceEqual(["install", "-r", apkPath]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Success" };
                }

                if (args.SequenceEqual(["shell", "pm", "list", "packages", "-3"]))
                {
                    packageListCalls++;
                    return new CommandResult { ExitCode = 0, Stdout = packageListCalls == 1 ? "package:com.existing\n" : "package:com.existing\npackage:com.spotify.music\n" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);
        var queue = new InstallQueueService(adb, wsa, settings, diagnostics);

        await queue.EnqueueAsync([apkPath]);

        var item = queue.Items.Single();
        Assert.AreEqual(QueueItemState.Installed, item.State);
        Assert.AreEqual("com.spotify.music", item.PackageName);
        Assert.IsTrue(runner.Calls.Any(call => call.Args.SequenceEqual(["install", "-r", apkPath])));
        Assert.AreEqual("com.spotify.music", settings.Get().RecentInstalls.Single().PackageName);
    }

    [TestMethod]
    public async Task DuplicateInstallPausesUntilUserChoosesReplace()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        var apkPath = Path.Combine(temp.Path, "Mobiflix.apk");
        File.WriteAllText(adbPath, "");
        File.WriteAllText(apkPath, "apk");

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

                if (args.SequenceEqual(["kill-server"]) || args.SequenceEqual(["start-server"]))
                {
                    return new CommandResult { ExitCode = 0 };
                }

                if (args.SequenceEqual(["devices"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "List of devices attached\n127.0.0.1:58526\tdevice\n" };
                }

                if (args.SequenceEqual(["shell", "pm", "list", "packages", "-3"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "package:com.mobiflix\n" };
                }

                if (args.SequenceEqual(["uninstall", "com.mobiflix"]) || args.SequenceEqual(["install", "-r", apkPath]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Success" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);
        var queue = new InstallQueueService(adb, wsa, settings, diagnostics, new FakePackageReader("com.mobiflix"));

        await queue.EnqueueAsync([apkPath]);

        var item = queue.Items.Single();
        Assert.AreEqual(QueueItemState.AlreadyInstalled, item.State);
        Assert.IsTrue(runner.Calls.All(call => !call.Args.SequenceEqual(["uninstall", "com.mobiflix"])));

        await queue.ReplaceExistingAsync(item.Id);

        item = queue.Items.Single();
        Assert.AreEqual(QueueItemState.Installed, item.State);
        Assert.IsTrue(item.WasUninstalledBeforeInstall);
        Assert.IsTrue(runner.Calls.Any(call => call.Args.SequenceEqual(["uninstall", "com.mobiflix"])));
    }

    [TestMethod]
    public async Task DuplicateInstallCanBeSkippedWithoutUninstallOrInstall()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        var apkPath = Path.Combine(temp.Path, "Mobiflix.apk");
        File.WriteAllText(adbPath, "");
        File.WriteAllText(apkPath, "apk");

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

                if (args.SequenceEqual(["kill-server"]) || args.SequenceEqual(["start-server"]))
                {
                    return new CommandResult { ExitCode = 0 };
                }

                if (args.SequenceEqual(["devices"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "List of devices attached\n127.0.0.1:58526\tdevice\n" };
                }

                if (args.SequenceEqual(["shell", "pm", "list", "packages", "-3"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "package:com.mobiflix\n" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);
        var queue = new InstallQueueService(adb, wsa, settings, diagnostics, new FakePackageReader("com.mobiflix"));

        await queue.EnqueueAsync([apkPath]);
        await queue.SkipAsync(queue.Items.Single().Id);

        Assert.AreEqual(QueueItemState.Skipped, queue.Items.Single().State);
        Assert.IsTrue(runner.Calls.All(call => !call.Args.SequenceEqual(["uninstall", "com.mobiflix"])));
        Assert.IsTrue(runner.Calls.All(call => !call.Args.SequenceEqual(["install", "-r", apkPath])));
    }
}
