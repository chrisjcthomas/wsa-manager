using System.Text.RegularExpressions;

namespace WsaManager.Core;

public static class DisplayNames
{
    public static string DeriveLabelFromFilePath(string filePath)
    {
        var name = Path.GetFileNameWithoutExtension(filePath);
        return Humanize(name);
    }

    public static string DeriveLabelFromPackageName(string packageName)
    {
        var last = packageName.Split('.', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? packageName;
        return Humanize(last);
    }

    private static string Humanize(string value)
    {
        var spaced = Regex.Replace(value.Replace('_', ' ').Replace('-', ' '), "([a-z])([A-Z])", "$1 $2");
        return string.Join(" ", spaced.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Capitalize));
    }

    private static string Capitalize(string value)
    {
        if (value.Length == 0)
        {
            return value;
        }

        return char.ToUpperInvariant(value[0]) + value[1..];
    }
}

public static class FileNames
{
    public static string SafeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(value.Select(character => invalid.Contains(character) ? '_' : character));
    }
}
