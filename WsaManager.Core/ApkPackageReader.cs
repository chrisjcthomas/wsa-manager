using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace WsaManager.Core;

public interface IApkPackageReader
{
    string? TryReadPackageName(string apkPath);
}

public sealed class ApkPackageReader : IApkPackageReader
{
    public string? TryReadPackageName(string apkPath)
    {
        try
        {
            using var archive = ZipFile.OpenRead(apkPath);
            var manifest = archive.GetEntry("AndroidManifest.xml");
            if (manifest is null)
            {
                return null;
            }

            using var stream = manifest.Open();
            using var memory = new MemoryStream();
            stream.CopyTo(memory);
            return TryReadPackageFromBinaryManifest(memory.ToArray());
        }
        catch
        {
            return null;
        }
    }

    private static string? TryReadPackageFromBinaryManifest(byte[] data)
    {
        if (data.Length < 8)
        {
            return null;
        }

        var strings = ReadStringPool(data);
        if (strings.Count == 0)
        {
            return null;
        }

        for (var offset = 8; offset + 36 < data.Length;)
        {
            var chunkType = ReadUInt16(data, offset);
            var headerSize = ReadUInt16(data, offset + 2);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length)
            {
                break;
            }

            if (chunkType == 0x0102)
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
                    var rawValueIndex = ReadInt32(data, attrOffset + 8);
                    if (nameIndex >= 0 && nameIndex < strings.Count && strings[nameIndex] == "package" && rawValueIndex >= 0 && rawValueIndex < strings.Count)
                    {
                        var packageName = strings[rawValueIndex];
                        return Regex.IsMatch(packageName, @"^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$") ? packageName : null;
                    }
                }
            }

            offset += (int)chunkSize;
        }

        return null;
    }

    private static List<string> ReadStringPool(byte[] data)
    {
        for (var offset = 8; offset + 28 < data.Length;)
        {
            var chunkType = ReadUInt16(data, offset);
            var headerSize = ReadUInt16(data, offset + 2);
            var chunkSize = ReadUInt32(data, offset + 4);
            if (chunkSize == 0 || offset + chunkSize > data.Length)
            {
                break;
            }

            if (chunkType == 0x0001)
            {
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

            offset += (int)chunkSize;
        }

        return [];
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
