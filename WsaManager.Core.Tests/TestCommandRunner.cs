using WsaManager.Core;

namespace WsaManager.Core.Tests;

internal sealed class TestCommandRunner : ICommandRunner
{
    private readonly Queue<Func<string, IReadOnlyList<string>, CommandResult>> responses = new();

    public List<(string Command, IReadOnlyList<string> Args)> Calls { get; } = [];

    public bool HangConnect { get; set; }
    public Func<string, IReadOnlyList<string>, CommandResult>? Handler { get; set; }

    public void Enqueue(CommandResult result)
    {
        responses.Enqueue((_, _) => result);
    }

    public Task<CommandResult> RunAsync(string command, IReadOnlyList<string> args, int timeoutMs = 30_000, CancellationToken cancellationToken = default)
    {
        Calls.Add((command, args.ToArray()));
        if (HangConnect && args.Count >= 2 && args[0] == "connect")
        {
            return Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken).ContinueWith(_ => new CommandResult(), CancellationToken.None);
        }

        if (Handler is not null)
        {
            return Task.FromResult(Handler(command, args));
        }

        if (responses.Count > 0)
        {
            return Task.FromResult(responses.Dequeue()(command, args));
        }

        return Task.FromResult(new CommandResult { ExitCode = 0 });
    }
}
