namespace WsaManager.Core;

public sealed class DiagnosticsService
{
    private readonly List<DiagnosticLogEntry> entries = [];

    public event EventHandler<DiagnosticLogEntry>? EntryAdded;

    public IReadOnlyList<DiagnosticLogEntry> Entries => entries.ToList();

    public DiagnosticLogEntry Log(DiagnosticLevel level, string source, string message, string? detail = null)
    {
        var entry = new DiagnosticLogEntry
        {
            Id = Guid.NewGuid().ToString("n"),
            Timestamp = DateTimeOffset.UtcNow,
            Level = level,
            Source = source,
            Message = message,
            Detail = detail
        };

        entries.Insert(0, entry);
        if (entries.Count > 300)
        {
            entries.RemoveRange(300, entries.Count - 300);
        }

        EntryAdded?.Invoke(this, entry);
        return entry;
    }

    public void Clear() => entries.Clear();
}
