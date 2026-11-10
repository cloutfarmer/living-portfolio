// Builds the room and the personal site, then uploads them to the stack in infra/site.yml.
// Usage, from the repository: AWS_PROFILE=<your profile> node web/scripts/deploy.mjs [--dry-run] [--allow-dirty]
// --dry-run builds and lists what would change without uploading, deleting or invalidating.
// Procedure and rollback: docs/DEPLOY.md.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const dryRun = process.argv.includes('--dry-run')
const stack = process.env.STACK ?? 'living-portfolio-site'
const region = 'us-east-1'
const dist = fileURLToPath(new URL('../dist/', import.meta.url))

// Never published: it records the dashboard's revision and whether its checkout was dirty.
const PRIVATE = new Set(['dashboard-build.json'])
// Nor dotfiles (a Finder .DS_Store in assets/processed lands in the build) or source maps (the private site's build
// would publish its source).
const unpublishable = key => PRIVATE.has(key) || /(^|\/)\./.test(key) || key.endsWith('.map')
// Hashed by Vite, so a changed file gets a new name and can be cached for a year.
const IMMUTABLE = 'public, max-age=31536000, immutable'
// Fixed names: revalidate HTML on every visit; the scene for a day (invalidated on each deploy).
const cacheFor = key => key.endsWith('.html') ? 'no-cache' : /(^|\/)assets\//.test(key) ? IMMUTABLE : 'public, max-age=86400'

const aws = (...args) => execFileSync('aws', [...args, '--region', region], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const output = name => aws('cloudformation', 'describe-stacks', '--stack-name', stack, '--query', `Stacks[0].Outputs[?OutputKey=='${name}'].OutputValue`, '--output', 'text').trim()

let bucket = '', distribution = ''
try {
  bucket = output('BucketName')
  distribution = output('DistributionId')
} catch (error) {
  // A dry run can still show what would ship before AWS is set up.
  if (!dryRun) throw error
  console.log(`deploy: could not read stack ${stack}; listing the build only.`)
}
const missing = value => !value || value === 'None'
if (dryRun && (missing(bucket) || missing(distribution))) bucket = distribution = '(no stack yet)'
if (missing(bucket) || missing(distribution)) {
  console.error(`deploy: stack ${stack} has no BucketName or DistributionId output. Deploy infra/site.yml first.`)
  process.exit(1)
}

// What goes live must be recoverable from Git: no uncommitted room or dashboard changes.
const allowDirty = process.argv.includes('--allow-dirty')
const repo = fileURLToPath(new URL('../../', import.meta.url))
const roomDirty = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim()
if (roomDirty && !allowDirty && !dryRun) {
  console.error('deploy: living-portfolio has uncommitted changes; commit them or pass --allow-dirty.')
  process.exit(1)
}

await import('./assemble-dashboard.mjs')
const built = JSON.parse(readFileSync(new URL('../../assets/processed/dashboard-build.json', import.meta.url), 'utf8'))
console.log(`deploy: room ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()}${roomDirty ? '-dirty' : ''}, site ${built.revision.slice(0, 7)}${built.revision.endsWith('-dirty') ? '-dirty' : ''}`)
if (built.revision.endsWith('-dirty') && !allowDirty && !dryRun) {
  console.error('deploy: the site was built from a checkout with uncommitted changes; commit them or pass --allow-dirty.')
  process.exit(1)
}

const files = []
const walk = dir => readdirSync(dir, { withFileTypes: true }).forEach(item => {
  const path = join(dir, item.name)
  if (item.isDirectory()) walk(path)
  else files.push(relative(dist, path).split(sep).join('/'))
})
walk(dist)
const keys = files.filter(key => !unpublishable(key))
if (!keys.includes('index.html') || !keys.includes('projects/index.html')) {
  console.error('deploy: the build is missing index.html or projects/index.html; nothing uploaded.')
  process.exit(1)
}

// Assets first and HTML last, so no page ever points at a file that isn't up yet.
const order = key => key.endsWith('.html') ? 2 : cacheFor(key) === IMMUTABLE ? 0 : 1
keys.sort((a, b) => order(a) - order(b) || a.localeCompare(b))
// CloudFront compresses only the types on its list, and model/gltf-binary isn't one, so the scene goes up already
// Brotli-encoded (docs/DECISIONS.md). Every browser with WebGL2 accepts Brotli over HTTPS.
const encoded = mkdtempSync(join(tmpdir(), 'living-portfolio-deploy-'))
const upload = key => {
  if (!key.endsWith('.glb')) return { file: join(dist, key), flags: [], note: '' }
  const raw = readFileSync(join(dist, key))
  const brotli = brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
  const file = join(encoded, key.split('/').join('_'))
  writeFileSync(file, brotli)
  const mb = bytes => (bytes / 1e6).toFixed(2)
  return { file, flags: ['--content-encoding', 'br', '--content-type', 'model/gltf-binary'], note: `, Brotli ${mb(raw.length)} -> ${mb(brotli.length)} MB` }
}
try {
  for (const key of keys) {
    const { file, flags, note } = upload(key)
    if (dryRun) { console.log(`would upload ${key} (${cacheFor(key)}${note})`); continue }
    aws('s3', 'cp', file, `s3://${bucket}/${key}`, '--cache-control', cacheFor(key), ...flags, '--only-show-errors')
    console.log(`uploaded ${key}${note}`)
  }
} finally {
  rmSync(encoded, { recursive: true, force: true })
}

// Then remove what this build no longer has, including anything private uploaded by mistake.
const noStack = bucket === '(no stack yet)'
// JSON, not text: text output splits on whitespace, so a key with a space in it would never be deleted.
const remote = noStack ? [] : JSON.parse(aws('s3api', 'list-objects-v2', '--bucket', bucket, '--query', 'Contents[].Key', '--output', 'json')) ?? []
const keep = new Set(keys)
for (const key of remote.filter(key => !keep.has(key))) {
  if (dryRun) { console.log(`would delete ${key}`); continue }
  aws('s3', 'rm', `s3://${bucket}/${key}`, '--only-show-errors')
  console.log(`deleted ${key}`)
}

const paths = ['/', '/index.html', '/projects/', '/projects/index.html', ...keys.filter(key => cacheFor(key) === 'public, max-age=86400').map(key => `/${key}`)]
if (dryRun) console.log(`would invalidate ${paths.join(' ')}`)
else {
  aws('cloudfront', 'create-invalidation', '--distribution-id', distribution, '--paths', ...paths, '--query', 'Invalidation.Id', '--output', 'text')
  console.log(`deploy: done. Invalidated ${paths.join(' ')} on ${distribution}.`)
}
