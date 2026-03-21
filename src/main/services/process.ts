import { spawn } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCommand(
  command: string,
  args: string[] = [],
  timeoutMs = 30_000
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out: ${command} ${args.join(' ')}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0
      })
    })
  })
}

export async function runPowerShell(script: string, timeoutMs = 30_000): Promise<CommandResult> {
  return await runCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    timeoutMs
  )
}
