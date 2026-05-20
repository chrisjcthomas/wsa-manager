using System.Text.RegularExpressions;

namespace WsaManager.Core;

public static class AdbParsers
{
    public static string? ParseAdbVersion(string output)
    {
        var match = Regex.Match(output, @"Android Debug Bridge version\s+([^\s]+)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    public static List<ParsedDevice> ParseAdbDevicesOutput(string output)
    {
        return output
            .Split(["\r\n", "\n"], StringSplitOptions.None)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0 && !line.StartsWith("List of devices", StringComparison.OrdinalIgnoreCase))
            .Select(line => Regex.Split(line, @"\s+"))
            .Where(parts => parts.Length >= 2)
            .Select(parts => new ParsedDevice { Serial = parts[0], Status = parts[1] })
            .ToList();
    }

    public static List<string> ParsePackageListOutput(string output)
    {
        return output
            .Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .Where(line => line.StartsWith("package:", StringComparison.OrdinalIgnoreCase))
            .Select(line => line["package:".Length..].Trim())
            .Where(packageName => packageName.Length > 0)
            .ToList();
    }

    public static string ExtractInstallError(string stdout, string stderr)
    {
        var combined = $"{stdout}\n{stderr}";
        var match = Regex.Match(combined, @"Failure\s+\[([^\]]+)\]", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : combined.Trim();
    }
}
