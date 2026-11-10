import './prepare-dashboard.mjs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Vite copies the prepared dashboard together with the room's public assets.
execFileSync('npm', ['run', 'build'], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit' })
