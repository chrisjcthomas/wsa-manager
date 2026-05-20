using System.Text.Json;
using WsaManager.Core;

namespace WsaManager.Core.Tests;

[TestClass]
public sealed class ReadinessTests
{
    [TestMethod]
    public async Task ReadinessReturnsReadyWhenLoopbackDeviceAlreadyExists()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");

        var runner = new TestCommandRunner
        {
            Handler = (command, args) => ResponseFor(command, args, adbPath, "List of devices attached\n127.0.0.1:58526\tdevice\n")
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);

        var snapshot = await wsa.GetReadinessSnapshotAsync();

        Assert.AreEqual("ready", snapshot.OverallStatus);
        Assert.AreEqual("connected", snapshot.Connection.Status);
        Assert.AreEqual("127.0.0.1:58526", snapshot.Connection.Endpoint);
        Assert.IsFalse(runner.Calls.Any(call => call.Args.FirstOrDefault() == "connect"));
    }

    [TestMethod]
    public async Task ReadinessReturnsNeedsAttentionWhenAdbConnectTimesOut()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");

        var runner = new TestCommandRunner
        {
            HangConnect = true,
            Handler = (command, args) => ResponseFor(command, args, adbPath, "List of devices attached\n")
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);

        var snapshot = await wsa.GetReadinessSnapshotAsync();

        Assert.AreEqual("needs_attention", snapshot.OverallStatus);
        Assert.AreEqual("sleeping", snapshot.Connection.Status);
        StringAssert.Contains(snapshot.Connection.Message, "Wake the subsystem");
    }

    [TestMethod]
    public async Task AutoHealRestartsAdbWakesWsaAndRetriesEndpoint()
    {
        using var temp = new TempDirectory();
        var adbPath = Path.Combine(temp.Path, "adb.exe");
        File.WriteAllText(adbPath, "");
        var devicesCalls = 0;
        var runner = new TestCommandRunner
        {
            Handler = (command, args) =>
            {
                if (command == "where.exe")
                {
                    return new CommandResult { ExitCode = 0, Stdout = adbPath };
                }

                if (args.SequenceEqual(["version"]) || args.SequenceEqual(["kill-server"]) || args.SequenceEqual(["start-server"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = args[0] == "version" ? "Android Debug Bridge version 1.0.41" : "" };
                }

                if (args.SequenceEqual(["devices"]))
                {
                    devicesCalls++;
                    return new CommandResult { ExitCode = 0, Stdout = devicesCalls == 1 ? "List of devices attached\n" : "List of devices attached\n127.0.0.1:58526\tdevice\n" };
                }

                if (args.SequenceEqual(["connect", "127.0.0.1:58526"]))
                {
                    return new CommandResult { ExitCode = 0, Stdout = "failed to connect" };
                }

                return new CommandResult { ExitCode = 0 };
            }
        };

        var settings = new SettingsStore(temp.Path);
        settings.SetAdbPath(adbPath);
        var diagnostics = new DiagnosticsService();
        var adb = new AdbService(settings, diagnostics, runner);
        var wsa = new WsaService(settings, adb, diagnostics, runner);

        var result = await wsa.AutoHealConnectionAsync();

        Assert.IsTrue(result.Connected);
        Assert.IsTrue(runner.Calls.Any(call => call.Args.SequenceEqual(["kill-server"])));
        Assert.IsTrue(runner.Calls.Any(call => call.Command == "powershell.exe" && call.Args.Any(arg => arg.Contains("Start-Process explorer.exe", StringComparison.Ordinal))));
        Assert.IsTrue(runner.Calls.Count(call => call.Args.SequenceEqual(["devices"])) >= 2);
    }

    private static CommandResult ResponseFor(string command, IReadOnlyList<string> args, string adbPath, string devicesOutput)
    {
        if (command == "powershell.exe")
        {
            return new CommandResult
            {
                ExitCode = 0,
                Stdout = JsonSerializer.Serialize(new WsaPackageInfo { Name = "MicrosoftCorporationII.WindowsSubsystemForAndroid", PackageFullName = "full", InstallLocation = "C:\\WSA", Version = "1.0" })
            };
        }

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
            return new CommandResult { ExitCode = 0, Stdout = devicesOutput };
        }

        return new CommandResult { ExitCode = 0 };
    }
}
