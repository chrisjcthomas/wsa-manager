import fs from 'node:fs'
import path from 'node:path'

const mode = process.argv[2] ?? 'unpacked'
const projectRoot = process.cwd()
const releaseDir = path.join(projectRoot, 'release')
const buildInfoPath = path.join(projectRoot, 'out', 'build-info.json')

if (!fs.existsSync(buildInfoPath)) {
  throw new Error(`Missing build info file at ${buildInfoPath}`)
}

const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'))
const manifest = {
  ...buildInfo,
  mode,
  artifacts: {
    unpackedExe: fs.existsSync(path.join(releaseDir, 'win-unpacked', 'WSA Manager.exe'))
      ? 'release/win-unpacked/WSA Manager.exe'
      : null,
    installer: null
  }
}

const installerCandidates = fs.existsSync(releaseDir)
  ? fs
      .readdirSync(releaseDir)
      .filter((entry) => /^WSA\.Manager\.Setup\..+\.exe$/i.test(entry))
      .sort()
  : []

if (installerCandidates.length > 0) {
  manifest.artifacts.installer = `release/${installerCandidates[installerCandidates.length - 1]}`
}

fs.mkdirSync(releaseDir, { recursive: true })
fs.writeFileSync(path.join(releaseDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
