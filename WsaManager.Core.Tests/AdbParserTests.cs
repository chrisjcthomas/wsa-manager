using WsaManager.Core;

namespace WsaManager.Core.Tests;

[TestClass]
public sealed class AdbParserTests
{
    [TestMethod]
    public void ParsesAdbVersionDevicesPackagesAndInstallFailure()
    {
        Assert.AreEqual("1.0.41", AdbParsers.ParseAdbVersion("Android Debug Bridge version 1.0.41\nVersion 35.0.2-12147458"));

        var devices = AdbParsers.ParseAdbDevicesOutput("List of devices attached\n127.0.0.1:58526\tdevice\n127.0.0.1:58527\toffline\n");
        Assert.AreEqual(2, devices.Count);
        Assert.AreEqual("127.0.0.1:58526", devices[0].Serial);
        Assert.AreEqual("device", devices[0].Status);

        CollectionAssert.AreEqual(new[] { "com.spotify.music", "com.discord" }, AdbParsers.ParsePackageListOutput("package:com.spotify.music\npackage:com.discord\n"));
        Assert.AreEqual("INSTALL_FAILED_CPU_ABI_INCOMPATIBLE", AdbParsers.ExtractInstallError("", "Failure [INSTALL_FAILED_CPU_ABI_INCOMPATIBLE]"));
    }
}
