import fs from 'node:fs'
import path from 'node:path'

const mode = process.argv[2] ?? 'unpacked'
const projectRoot = process.cwd()
const releaseDir = path.join(projectRoot, 'release')
const errors = []

if (!fs.existsSync(path.join(releaseDir, 'win-unpacked', 'WSA Manager.exe'))) {
  errors.push('Missing canonical unpacked executable at release/win-unpacked/WSA Manager.exe.')
}

const nestedVersionDirs = fs.existsSync(releaseDir)
  ? fs
      .readdirSync(releaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name))
      .map((entry) => entry.name)
  : []

if (nestedVersionDirs.length > 0) {
  errors.push(`Unexpected nested release version directories: ${nestedVersionDirs.join(', ')}`)
}

const installers = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((entry) => /^WSA\.Manager\.Setup\..+\.exe$/i.test(entry))
  : []

if (mode === 'full' && installers.length !== 1) {
  errors.push(`Expected exactly one canonical installer in release/, found ${installers.length}.`)
}

if (mode === 'unpacked' && installers.length > 1) {
  errors.push(`Expected at most one installer after unpacked build, found ${installers.length}.`)
}

if (errors.length > 0) {
  throw new Error(errors.join('\n'))
}
