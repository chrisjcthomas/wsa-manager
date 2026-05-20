using WsaManager.Core;

namespace WsaManager.Core.Tests;

[TestClass]
public sealed class AdbServiceTests
{
    [TestMethod]
    public async Task SavedAdbPathIsPreferred()
    {
        using var temp = new TempDirectory();
        var savedAdb = Path.Combine(temp.Path, "saved-adb.exe");
        File.WriteAllText(savedAdb, "");
        var envAdb = Path.Combine(temp.Path, "env", "platform-tools", "adb.exe");
        Directory.CreateDirectory(Path.GetDirectoryName(envAdb)!);
        File.WriteAllText(envAdb, "");

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(savedAdb);
        var runner = new TestCommandRunner();
        runner.Enqueue(new CommandResult { ExitCode = 0, Stdout = "C:\\other\\adb.exe" });
        runner.Enqueue(new CommandResult { ExitCode = 0, Stdout = "Android Debug Bridge version 1.0.41" });

        var service = new AdbService(
            settings,
            new DiagnosticsService(),
            runner,
            name => name == "ANDROID_SDK_ROOT" ? Path.Combine(temp.Path, "env") : null);

        var resolved = await service.ResolveAdbAsync();

        Assert.IsNotNull(resolved);
        Assert.AreEqual(savedAdb, resolved.Path);
        Assert.AreEqual("saved", resolved.Source);
        Assert.AreEqual(savedAdb, runner.Calls[1].Command);
    }

    [TestMethod]
    public async Task DesktopPlatformToolsAdbIsDiscoveredAndSaved()
    {
        using var temp = new TempDirectory();
        var desktopAdb = Path.Combine(temp.Path, "Desktop", "platform-tools", "adb.exe");
        Directory.CreateDirectory(Path.GetDirectoryName(desktopAdb)!);
        File.WriteAllText(desktopAdb, "");

        var settings = new SettingsStore(temp.Path);
        var runner = new TestCommandRunner
        {
            Handler = (command, args) =>
            {
                if (command == "where.exe")
                {
                    return new CommandResult { ExitCode = 1 };
                }

                if (args.SequenceEqual(["version"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "Android Debug Bridge version 1.0.41" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var service = new AdbService(
            settings,
            new DiagnosticsService(),
            runner,
            name => name == "USERPROFILE" ? temp.Path : null);

        var resolved = await service.ResolveAdbAsync();

        Assert.IsNotNull(resolved);
        Assert.AreEqual(desktopAdb, resolved.Path);
        Assert.AreEqual("Desktop platform-tools", resolved.Source);
        Assert.AreEqual(desktopAdb, settings.Get().AdbPath);
    }
}
