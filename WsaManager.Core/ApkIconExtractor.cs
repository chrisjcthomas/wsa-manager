using System.IO.Compression;
using System.Text;

namespace WsaManager.Core;

public sealed class ApkIconExtractor
{
    public string? TryExtractIcon(string apkPath, string outputDirectory, string outputName)
    {
        try
        {
            using var archive = ZipFile.OpenRead(apkPath);
            var manifestBytes = ReadEntry(archive, "AndroidManifest.xml");
            var resourceId = manifestBytes is null ? null : TryReadApplicationIconResourceId(manifestBytes);
            if (resourceId is null)
            {
                return null;
            }

            var resourcesBytes = ReadEntry(archive, "resources.arsc");
            var iconCandidates = resourcesBytes is null ? [] : FindResourcePaths(resourcesBytes, resourceId.Value);
            var iconEntry = iconCandidates
                .Select(path => archive.GetEntry(path.Replace('\\', '/')))
                .Where(entry => entry is not null && IsSupportedImage(entry.FullName))
                .OrderByDescending(entry => IconScore(entry!.FullName))
                .FirstOrDefault();
            if (iconEntry is null)
            {
                return null;
            }

            Directory.CreateDirectory(outputDirectory);
            var extension = Path.GetExtension(iconEntry.FullName).ToLowerInvariant();
            var outputPath = Path.Combine(outputDirectory, $"{FileNames.SafeFileName(outputName)}{extension}");
            using var input = iconEntry.Open();
            using var output = File.Create(outputPath);
            input.CopyTo(output);
            return outputPath;
        }
        catch
        {
            return null;
        }
    }

    private static byte[]? ReadEntry(ZipArchive archive, string name)
    {
        var entry = archive.GetEntry(name);
        if (entry is null)
        {
            return null;
        }

        using var input = entry.Open();
        using var memory = new MemoryStream();
        input.CopyTo(memory);
        return memory.ToArray();
    }

    private static uint? TryReadApplicationIconResourceId(byte[] data)
    {
        var strings = ReadFirstStringPool(data);
        if (strings.Count == 0)
        {
            return null;
        }

        for (var offset = 8; offset + 36 < data.Length;)
        {
            var chunkType = ReadUInt16(data, offset);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length)
            {
                break;
            }

            if (chunkType == 0x0102)
            {
                var elementNameIndex = ReadInt32(data, offset + 20);
                if (elementNameIndex >= 0 && elementNameIndex < strings.Count && strings[elementNameIndex] == "application")
                {
                    var attrStart = offset + 16 + ReadUInt16(data, offset + 24);
                    var attrSize = ReadUInt16(data, offset + 26);
                    var attrCount = ReadUInt16(data, offset + 28);
                    for (var index = 0; index < attrCount; index++)
                    {
                        var attrOffset = attrStart + index * attrSize;
                        if (attrOffset + 20 > data.Length)
                        {
                            continue;
                        }

                        var nameIndex = ReadInt32(data, attrOffset + 4);
                        var valueType = data[attrOffset + 15];
                        var valueData = ReadUInt32(data, attrOffset + 16);
                        if (nameIndex >= 0 && nameIndex < strings.Count && strings[nameIndex] == "icon" && valueType == 0x01)
                        {
                            return valueData;
                        }
                    }
                }
            }

            offset += (int)chunkSize;
        }

        return null;
    }

    private static IReadOnlyList<string> FindResourcePaths(byte[] data, uint resourceId)
    {
        var result = new List<string>();
        var tableStrings = Array.Empty<string>();
        for (var offset = 8; offset + 8 < data.Length;)
        {
            var chunkType = ReadUInt16(data, offset);
            var headerSize = ReadUInt16(data, offset + 2);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length)
            {
                break;
            }

            if (chunkType == 0x0001 && tableStrings.Length == 0)
            {
                tableStrings = ReadStringPool(data, offset).ToArray();
            }
            else if (chunkType == 0x0200)
            {
                FindResourcePathsInPackage(data, offset, (int)chunkSize, resourceId, tableStrings, result);
            }

            offset += (int)chunkSize;
            if (headerSize == 0)
            {
                break;
            }
        }

        return result;
    }

    private static void FindResourcePathsInPackage(byte[] data, int packageOffset, int packageSize, uint resourceId, IReadOnlyList<string> tableStrings, List<string> result)
    {
        var packageId = data[packageOffset + 8];
        var targetPackageId = (int)((resourceId >> 24) & 0xff);
        if (packageId != targetPackageId)
        {
            return;
        }

        for (var offset = packageOffset + ReadUInt16(data, packageOffset + 2); offset + 8 < packageOffset + packageSize;)
        {
            var chunkType = ReadUInt16(data, offset);
            var headerSize = ReadUInt16(data, offset + 2);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length || offset + chunkSize > packageOffset + packageSize)
            {
                break;
            }

            if (chunkType == 0x0201)
            {
                var typeId = data[offset + 8];
                var targetTypeId = (int)((resourceId >> 16) & 0xff);
                if (typeId == targetTypeId)
                {
                    var entryCount = (int)ReadUInt32(data, offset + 12);
                    var entriesStart = (int)ReadUInt32(data, offset + 16);
                    var entryIndex = (int)(resourceId & 0xffff);
                    if (entryIndex >= 0 && entryIndex < entryCount)
                    {
                        var entryOffset = ReadUInt32(data, offset + headerSize + entryIndex * 4);
                        if (entryOffset != 0xffffffff)
                        {
                            var absoluteEntryOffset = offset + entriesStart + (int)entryOffset;
                            ReadResourceEntryPath(data, absoluteEntryOffset, tableStrings, result);
                        }
                    }
                }
            }

            offset += (int)chunkSize;
        }
    }

    private static void ReadResourceEntryPath(byte[] data, int entryOffset, IReadOnlyList<string> tableStrings, List<string> result)
    {
        if (entryOffset + 16 > data.Length)
        {
            return;
        }

        var entrySize = ReadUInt16(data, entryOffset);
        var entryFlags = ReadUInt16(data, entryOffset + 2);
        if ((entryFlags & 0x0001) != 0)
        {
            return;
        }

        var valueOffset = entryOffset + entrySize;
        if (valueOffset + 8 > data.Length)
        {
            return;
        }

        var valueType = data[valueOffset + 3];
        var valueData = (int)ReadUInt32(data, valueOffset + 4);
        if (valueType == 0x03 && valueData >= 0 && valueData < tableStrings.Count)
        {
            var path = tableStrings[valueData];
            if (!string.IsNullOrWhiteSpace(path))
            {
                result.Add(path);
            }
        }
    }

    private static List<string> ReadFirstStringPool(byte[] data)
    {
        for (var offset = 8; offset + 28 < data.Length;)
        {
            var chunkType = ReadUInt16(data, offset);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length)
            {
                break;
            }

            if (chunkType == 0x0001)
            {
                return ReadStringPool(data, offset);
            }

            offset += (int)chunkSize;
        }

        return [];
    }

    private static List<string> ReadStringPool(byte[] data, int offset)
    {
        var headerSize = ReadUInt16(data, offset + 2);
        var stringCount = (int)ReadUInt32(data, offset + 8);
        var flags = ReadUInt32(data, offset + 16);
        var stringsStart = (int)ReadUInt32(data, offset + 20);
        var isUtf8 = (flags & 0x00000100) != 0;
        var result = new List<string>();
        for (var index = 0; index < stringCount; index++)
        {
            var stringOffset = (int)ReadUInt32(data, offset + headerSize + index * 4);
            var absoluteOffset = offset + stringsStart + stringOffset;
            result.Add(isUtf8 ? ReadUtf8String(data, absoluteOffset) : ReadUtf16String(data, absoluteOffset));
        }

        return result;
    }

    private static bool IsSupportedImage(string path) => path.EndsWith(".png", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".webp", StringComparison.OrdinalIgnoreCase);

    private static int IconScore(string path)
    {
        var lower = path.ToLowerInvariant();
        var score = IsSupportedImage(lower) ? 10 : 0;
        if (lower.Contains("xxxhdpi")) score += 80;
        if (lower.Contains("xxhdpi")) score += 70;
        if (lower.Contains("xhdpi")) score += 60;
        if (lower.Contains("hdpi")) score += 50;
        if (lower.Contains("nodpi")) score += 40;
        if (lower.Contains("mipmap")) score += 10;
        return score;
    }

    private static string ReadUtf8String(byte[] data, int offset)
    {
        var cursor = offset;
        ReadLength8(data, ref cursor);
        var byteLength = ReadLength8(data, ref cursor);
        return Encoding.UTF8.GetString(data, cursor, Math.Min(byteLength, data.Length - cursor)).TrimEnd('\0');
    }

    private static string ReadUtf16String(byte[] data, int offset)
    {
        var cursor = offset;
        var charLength = ReadLength16(data, ref cursor);
        var byteLength = Math.Min(charLength * 2, data.Length - cursor);
        return Encoding.Unicode.GetString(data, cursor, byteLength).TrimEnd('\0');
    }

    private static int ReadLength8(byte[] data, ref int offset)
    {
        var length = (int)data[offset++];
        if ((length & 0x80) != 0)
        {
            length = ((length & 0x7f) << 8) | data[offset++];
        }

        return length;
    }

    private static int ReadLength16(byte[] data, ref int offset)
    {
        var length = (int)ReadUInt16(data, offset);
        offset += 2;
        if ((length & 0x8000) != 0)
        {
            length = ((length & 0x7fff) << 16) | ReadUInt16(data, offset);
            offset += 2;
        }

        return length;
    }

    private static ushort ReadUInt16(byte[] data, int offset) => BitConverter.ToUInt16(data, offset);
    private static uint ReadUInt32(byte[] data, int offset) => BitConverter.ToUInt32(data, offset);
    private static int ReadInt32(byte[] data, int offset) => BitConverter.ToInt32(data, offset);
}
