import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

// Consume a build artifact; neither repository imports the other's source.
// Builds the sibling portfolio-dashboard checkout, so the room shows whatever that checkout has
// (pull its main before deploying). DASHBOARD_DIR builds another checkout instead.
const dashboard = process.env.DASHBOARD_DIR
  ? resolve(process.env.DASHBOARD_DIR)
  : fileURLToPath(new URL('../../../portfolio-dashboard/', import.meta.url))
if (!existsSync(join(dashboard, 'package.json'))) {
  console.error(`prepare-dashboard: no package.json in ${dashboard}; set DASHBOARD_DIR to the site checkout.`)
  process.exit(1)
}
const assets = fileURLToPath(new URL('../../assets/processed/', import.meta.url))
execFileSync('npm', ['run', 'build'], { cwd: dashboard, stdio: 'inherit' })
// Clear first so bundles from an earlier build can't linger beside the new ones.
rmSync(join(assets, 'projects'), { recursive: true, force: true })
cpSync(join(dashboard, 'dist'), join(assets, 'projects'), { recursive: true })
const hash = createHash('sha256')
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, item.name)
    if (item.isDirectory()) walk(path)
    else hash.update(item.name).update(readFileSync(path))
  }
}
walk(join(dashboard, 'dist'))
let revision = 'uncommitted'
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dashboard, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  if (execFileSync('git', ['status', '--porcelain'], { cwd: dashboard }).length) revision += '-dirty'
} catch {}
writeFileSync(join(assets, 'dashboard-build.json'), JSON.stringify({ revision, sha256: hash.digest('hex') }, null, 2))
console.log(`prepare-dashboard: built ${dashboard} at ${revision}`)
