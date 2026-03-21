import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const authoringRoots = ['src', 'tests']
const tempArtifactPattern = /^tmp-.*\.(png|jpe?g)$/i
const explicitRootSidecars = ['electron.vite.config.js', 'electron.vite.config.d.ts']
const violations = []

function walk(currentDir, visitor) {
  if (!fs.existsSync(currentDir)) {
    return
  }

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const nextPath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      walk(nextPath, visitor)
    } else {
      visitor(nextPath)
    }
  }
}

for (const root of authoringRoots) {
  walk(path.join(projectRoot, root), (filePath) => {
    const relativePath = path.relative(projectRoot, filePath)
    const extension = path.extname(filePath)

    if (extension === '.js') {
      violations.push(`Generated JavaScript sidecar found in authoring tree: ${relativePath}`)
      return
    }

    if (relativePath.endsWith('.d.ts')) {
      const stem = filePath.slice(0, -'.d.ts'.length)
      const siblingCandidates = [`${stem}.ts`, `${stem}.tsx`]
      if (siblingCandidates.some((candidate) => fs.existsSync(candidate))) {
        violations.push(`Generated declaration sidecar found in authoring tree: ${relativePath}`)
      }
    }
  })
}

for (const sidecar of explicitRootSidecars) {
  if (fs.existsSync(path.join(projectRoot, sidecar))) {
    violations.push(`Generated config sidecar found at project root: ${sidecar}`)
  }
}

for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
  if (entry.isFile() && tempArtifactPattern.test(entry.name)) {
    violations.push(`Temporary screenshot artifact found at project root: ${entry.name}`)
  }
}

if (fs.existsSync(path.join(projectRoot, 'tmp-installed-app'))) {
  violations.push('Temporary extracted app directory found at project root: tmp-installed-app')
}

if (violations.length > 0) {
  throw new Error(violations.join('\n'))
}

