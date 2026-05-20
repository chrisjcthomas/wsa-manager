using System.Diagnostics;
using System.Text;

namespace WsaManager.Core;

public sealed class CommandResult
{
    public string Stdout { get; init; } = "";
    public string Stderr { get; init; } = "";
    public int ExitCode { get; init; }
}

public interface ICommandRunner
{
    Task<CommandResult> RunAsync(string command, IReadOnlyList<string> args, int timeoutMs = 30_000, CancellationToken cancellationToken = default);
}

public sealed class ProcessCommandRunner : ICommandRunner
{
    public async Task<CommandResult> RunAsync(string command, IReadOnlyList<string> args, int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        using var timeout = new CancellationTokenSource(timeoutMs);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token, cancellationToken);

        var startInfo = new ProcessStartInfo(command)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };

        foreach (var arg in args)
        {
            startInfo.ArgumentList.Add(arg);
        }

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stdout.AppendLine(e.Data);
            }
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stderr.AppendLine(e.Data);
            }
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            await process.WaitForExitAsync(linked.Token);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested)
        {
            TryKill(process);
            throw new TimeoutException($"Command timed out: {command} {string.Join(" ", args)}");
        }

        return new CommandResult
        {
            Stdout = stdout.ToString(),
            Stderr = stderr.ToString(),
            ExitCode = process.ExitCode
        };
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // Best-effort cleanup after a timeout.
        }
    }
}
