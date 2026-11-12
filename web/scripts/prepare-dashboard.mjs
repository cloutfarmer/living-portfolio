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
  // `npm run dev` passes --optional: the room runs without the site, and only the monitor's page is missing.
  // A deploy never passes it, so a missing site still stops the release.
  if (process.argv.includes('--optional')) {
    console.warn(`prepare-dashboard: no site checkout in ${dashboard}, so /projects/ will be missing. Set DASHBOARD_DIR to build it.`)
    process.exit(0)
  }
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
// The deploy refuses a revision ending in -dirty, because it can't be rebuilt from Git. If Git can't answer at all,
// the build is no more recoverable, so it's marked the same way rather than passed off as a clean commit.
let revision
try {
  const git = (...args) => execFileSync('git', args, { cwd: dashboard, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  revision = git('rev-parse', 'HEAD')
  if (git('status', '--porcelain')) revision += '-dirty'
} catch {
  revision = 'unknown-dirty'
}
writeFileSync(join(assets, 'dashboard-build.json'), JSON.stringify({ revision, sha256: hash.digest('hex') }, null, 2))
console.log(`prepare-dashboard: built ${dashboard} at ${revision}`)
