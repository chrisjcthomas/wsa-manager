import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const buildTimestamp = new Date().toISOString()
const buildInfo = {
  appVersion: packageJson.version,
  buildTimestamp,
  buildLabel: `v${packageJson.version} | ${buildTimestamp.slice(0, 16).replace('T', ' ')}`
}

const outFile = path.join(projectRoot, 'out', 'build-info.json')
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(buildInfo, null, 2), 'utf8')

