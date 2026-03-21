import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const releaseDir = path.join(projectRoot, 'release')

fs.rmSync(releaseDir, { recursive: true, force: true })

