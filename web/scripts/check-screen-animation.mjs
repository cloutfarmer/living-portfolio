import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// Exercise Life's real frame callback without a renderer or browser. The right monitor's
// placeholder bars must stay hidden under the vim screen, the typing bursts must reach the
// shared desk state, and the head must turn between monitors as desk.focus changes.
process.on('uncaughtException', error => { console.error(error.message); process.exit(1) })
const root = fileURLToPath(new URL('../', import.meta.url))
const result = await build({
  configFile: false,
  root,
  logLevel: 'silent',
  plugins: [{
    name: 'frame-test-hooks',
    enforce: 'pre',
    resolveId(id) {
      if (['react', 'react/jsx-runtime', '@react-three/fiber'].includes(id)) return `\0test:${id}`
      // The vim screen draws to a canvas and is mounted, not called, so stand it in.
      if (id.endsWith('/components/VimScreen')) return '\0test:vim'
      // Share the desk state with this script.
      if (id === './desk') return '\0test:desk'
    },
    load(id) {
      if (id === '\0test:react') return 'export const useMemo = fn => fn(); export const useRef = current => ({current}); export default {createElement: () => null};'
      if (id === '\0test:react/jsx-runtime') return 'export const jsx = () => null; export const jsxs = jsx; export const Fragment = "fragment";'
      if (id === '\0test:@react-three/fiber') return 'export const useFrame = fn => globalThis.monitorTestFrame = fn;'
      if (id === '\0test:vim') return 'export const VimScreen = () => null;'
      if (id === '\0test:desk') return 'export const desk = globalThis.testDesk;'
    },
  }],
  build: {
    write: false,
    minify: false,
    lib: { entry: `${root}src/Life.tsx`, formats: ['es'] },
  },
})
globalThis.window = { matchMedia: () => ({ matches: false }) }
const desk = globalThis.testDesk = { typing: 0, focus: 'right' }
const { Life } = await import(`data:text/javascript;base64,${Buffer.from((Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code).toString('base64')}`)
const { Group, Mesh, BoxGeometry, MeshStandardMaterial } = await import('three')
const scene = new Group()
const add = (name, x, y, z) => {
  const mesh = new Mesh(new BoxGeometry(0.3, 0.01, 0.005), new MeshStandardMaterial())
  mesh.name = name
  mesh.position.set(x, y, z)
  scene.add(mesh)
  return mesh
}
add('Main_Display', 0, 1, -0.6)
add('Right_Display', 0.6, 1, -0.4)
const head = add('Head', 0, 1, 0)
const bars = [add('Right_Display_header', 0.6, 1.2, -0.4), ...Array.from({ length: 6 }, (_, i) => add(`Right_Display_line.${i}`, 0.6, 1.1 - i * 0.05, -0.4))]
Life({ scene, glance: 0 })

const yaws = { right: [], main: [] }
let low = 1, high = 0
for (let frame = 0; frame < 1200; frame++) {
  desk.focus = frame < 600 ? 'right' : 'main'
  globalThis.monitorTestFrame({ clock: { elapsedTime: frame / 60 } }, 1 / 60)
  for (const bar of bars) assert.equal(bar.visible, false, `${bar.name} must stay hidden under the vim screen`)
  low = Math.min(low, desk.typing)
  high = Math.max(high, desk.typing)
  // Settled for the last two seconds of each half.
  if (frame >= 480 && frame < 600) yaws.right.push(head.rotation.y)
  if (frame >= 1080) yaws.main.push(head.rotation.y)
}
assert(high > 0.9 && low < 0.1, `typing must burst and pause (range ${low.toFixed(2)}–${high.toFixed(2)})`)
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length
const turn = mean(yaws.right) - mean(yaws.main)
assert(Math.abs(turn) > 0.3, `the head must turn between monitors (turned ${turn.toFixed(2)} rad)`)
console.log(`PASS: right monitor bars stay hidden; typing bursts reach desk state; head turns ${turn.toFixed(2)} rad between monitors over 20 seconds`)
