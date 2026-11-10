// Exports a saved .blend to the GLB the site loads. Defaults to the newest
// corner-desk-vNNN.blend; pass a path to export another file. Only saved work is seen.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '../..')
const scenes = resolve(repo, 'blender/scenes')
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender'

const version = (name) => Number(name.match(/^corner-desk-v(\d+)\.blend$/)?.[1] ?? -1)
const newest = readdirSync(scenes)
  .filter((name) => version(name) >= 0)
  .sort((a, b) => version(b) - version(a))[0]
const blend = process.argv[2] ? resolve(process.argv[2]) : newest && resolve(scenes, newest)
if (!blend) {
  console.error(`No corner-desk-vNNN.blend in ${scenes}; pass a path instead.`)
  process.exit(1)
}

const out = resolve(repo, 'assets/processed/corner-desk.glb')
mkdirSync(resolve(repo, 'assets/processed'), { recursive: true })

const { status, error } = spawnSync(
  blender,
  [
    '--background',
    '--factory-startup',
    blend,
    '--python-exit-code',
    '1',
    '--python',
    resolve(repo, 'blender/scripts/tools/export_web_glb.py'),
    '--',
    out,
  ],
  { stdio: 'inherit' },
)
if (error) console.error(`Could not run Blender at ${blender}: ${error.message}`)
process.exit(status ?? 1)
