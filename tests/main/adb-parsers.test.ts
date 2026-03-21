import { describe, expect, it } from 'vitest'
import { extractInstallError, parseAdbDevicesOutput, parseAdbVersion, parsePackageListOutput } from '@main/services/adb/parsers'

describe('adb parsers', () => {
  it('extracts adb version strings', () => {
    expect(parseAdbVersion('Android Debug Bridge version 1.0.41\nVersion 35.0.2-12147458')).toBe('1.0.41')
  })

  it('parses connected and offline adb devices', () => {
    const output = [
      'List of devices attached',
      '127.0.0.1:58526\tdevice',
      '127.0.0.1:58527\toffline',
      ''
    ].join('\n')

    expect(parseAdbDevicesOutput(output)).toEqual([
      { serial: '127.0.0.1:58526', status: 'device' },
      { serial: '127.0.0.1:58527', status: 'offline' }
    ])
  })

  it('parses pm package listings and install failures', () => {
    expect(parsePackageListOutput('package:com.spotify.music\npackage:com.discord\n')).toEqual([
      'com.spotify.music',
      'com.discord'
    ])

    expect(extractInstallError('', 'Failure [INSTALL_FAILED_CPU_ABI_INCOMPATIBLE]')).toBe('INSTALL_FAILED_CPU_ABI_INCOMPATIBLE')
  })
})
