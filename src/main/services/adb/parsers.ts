export interface ParsedDevice {
  serial: string
  status: string
}

export function parseAdbVersion(output: string): string | undefined {
  const match = output.match(/Android Debug Bridge version ([^\r\n]+)/i)
  return match?.[1]?.trim()
}

export function parseAdbDevicesOutput(output: string): ParsedDevice[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('\t'))
    .map((line) => {
      const [serial, status] = line.split('\t')
      return {
        serial,
        status
      }
    })
}

export function parsePackageListOutput(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^package:/, ''))
}

export function extractInstallError(stdout: string, stderr: string): string {
  const message = `${stdout}\n${stderr}`.trim()
  const match = message.match(/Failure \[([^\]]+)\]/)
  if (match) {
    return match[1]
  }

  return message || 'Unknown install failure'
}
