import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace, type Mesh, type Object3D } from 'three'
import { desk } from '../desk'
import { REDUCED_MOTION } from '../Life'
import { surface } from './Monitor'

// The right monitor: vim, typing a small file in a loop. Characters only go in while the
// hands are typing (desk.typing), so the screen keeps time with the person. It's ambient,
// so the colours sit darker than the main monitor's.
const FILE_NAME = 'offers.ts'
const CHARS_PER_SECOND = 13

const FIRST = `import { projects } from './projects'

// What I build, and where to see it.
export const offers = [
  { phrase: 'full-stack web apps', project: 'bjj-log' },
  { phrase: 'media pipelines', project: 'snapsort' },
  { phrase: 'dev`
const SECOND = `eloper tooling', project: 'agent-kit' },
  { phrase: '3D for the web', project: 'living-portfolio' },
]`
const THIRD = `

export function proofFor(index: number) {
  const offer = offers[index % offers.length]
  return projects.find((p) => p.id === offer.project)
}`

type Step =
  | { type: string }
  | { back: number }
  | { pause: number }
  | { mode: 'INSERT' | 'NORMAL' }
  | { command: string }
  | { clear: true }

// One pass of the loop: write the array, fix a typo, save, add a function, save, read it over, clear.
const STEPS: Step[] = [
  { mode: 'INSERT' },
  { type: FIRST },
  { type: 'lo' },
  { pause: 0.5 },
  { back: 2 },
  { type: SECOND },
  { pause: 0.8 },
  { mode: 'NORMAL' },
  { command: ':w' },
  { pause: 2 },
  { mode: 'INSERT' },
  { type: THIRD },
  { pause: 0.6 },
  { mode: 'NORMAL' },
  { command: ':w' },
  { pause: 7 },
  { command: 'ggdG' },
  { pause: 1.6 },
]
// Start with the screen already full, just after the first save.
const START_STEP = 9

const COLOR = {
  background: '#0d1013',
  text: '#98a1a6',
  keyword: '#a68ac2',
  string: '#8bab79',
  number: '#c49268',
  comment: '#56606a',
  call: '#7ca3bf',
  lineNumber: '#3a4347',
  currentLine: '#c49268',
  tilde: '#2c4757',
  statusBack: '#1d2429',
  statusText: '#b3bcc0',
  cursor: '#c9d1d5',
}
const KEYWORDS = new Set(['import', 'from', 'export', 'const', 'function', 'return', 'let', 'if', 'number'])

// A tiny highlighter: comments, strings, numbers, keywords, and names before a call.
function highlight(line: string): [string, string][] {
  const runs: [string, string][] = []
  const comment = line.indexOf('//')
  const code = comment >= 0 ? line.slice(0, comment) : line
  const pattern = /('[^']*'?|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|\s+|.)/g
  for (const match of code.matchAll(pattern)) {
    const token = match[0]
    let color = COLOR.text
    if (token.startsWith("'")) color = COLOR.string
    else if (/^\d/.test(token)) color = COLOR.number
    else if (KEYWORDS.has(token)) color = COLOR.keyword
    else if (/^[A-Za-z_$]/.test(token) && code[match.index! + token.length] === '(') color = COLOR.call
    runs.push([token, color])
  }
  if (comment >= 0) runs.push([line.slice(comment), COLOR.comment])
  return runs
}

class Session {
  doc = ''
  mode: 'INSERT' | 'NORMAL' = 'NORMAL'
  bottom = ''
  dirty = false
  version = 0
  private step = 0
  private done = 0
  private budget = 0
  private waited = 0

  constructor() {
    while (this.step < START_STEP) this.finishStep()
  }

  private get current() {
    return STEPS[this.step]
  }

  private next() {
    this.step = (this.step + 1) % STEPS.length
    this.done = 0
    this.waited = 0
    this.version++
  }

  // Applies a whole step at once, for the starting state.
  private finishStep() {
    const step = this.current
    if ('type' in step) this.insert(step.type)
    else if ('back' in step) this.doc = this.doc.slice(0, -step.back)
    else this.instant(step)
    this.next()
  }

  private insert(text: string) {
    this.doc += text
    this.dirty = true
  }

  private instant(step: Step) {
    if ('mode' in step) {
      this.mode = step.mode
      this.bottom = step.mode === 'INSERT' ? '-- INSERT --' : ''
    } else if ('command' in step) {
      if (step.command === ':w') {
        const lines = this.doc.split('\n').length
        this.bottom = `"${FILE_NAME}" ${lines}L, ${this.doc.length}B written`
        this.dirty = false
      } else {
        this.doc = ''
        this.dirty = true
        this.bottom = '--No lines in buffer--'
      }
    }
  }

  advance(delta: number, typing: number) {
    const step = this.current
    if ('pause' in step) {
      this.waited += delta
      if (this.waited >= step.pause) this.next()
      return
    }
    const text = 'type' in step ? step.type : 'command' in step ? step.command : null
    const count = 'back' in step ? step.back : text?.length
    if (count === undefined) {
      this.instant(step)
      this.next()
      return
    }
    // Typing and commands go in keystroke by keystroke, only while the hands are moving.
    if (typing < 0.5) return
    this.budget += delta * CHARS_PER_SECOND
    while (this.budget >= 1 && this.done < count) {
      this.budget -= 1
      this.done++
      if ('back' in step) {
        this.doc = this.doc.slice(0, -1)
        this.dirty = true
      } else if ('type' in step) {
        this.insert(step.type[this.done - 1])
      } else if ('command' in step) {
        // Commands echo on the bottom line as they're typed, like vim's command line and showcmd.
        this.bottom = step.command.slice(0, this.done)
      }
      this.version++
    }
    if (this.done >= count) {
      if ('command' in step) this.instant(step)
      this.next()
    }
  }
}

function paint(canvas: HTMLCanvasElement, session: Session, cursorOn: boolean) {
  const context = canvas.getContext('2d')!
  const { width, height } = canvas
  const size = Math.round(height / 24)
  const row = Math.round(size * 1.45)
  const gutter = size * 3.4
  const rows = Math.floor(height / row) - 2
  context.fillStyle = COLOR.background
  context.fillRect(0, 0, width, height)
  context.font = `${size}px ui-monospace, Menlo, Consolas, monospace`
  context.textBaseline = 'middle'
  const char = context.measureText('m').width

  const lines = session.doc.split('\n')
  const cursorRow = lines.length - 1
  const cursorCol = lines[cursorRow].length
  const top = Math.max(0, cursorRow - rows + 2)
  for (let screenRow = 0; screenRow < rows; screenRow++) {
    const index = top + screenRow
    const y = screenRow * row + row / 2 + size * 0.3
    if (index >= lines.length) {
      context.fillStyle = COLOR.tilde
      context.textAlign = 'left'
      context.fillText('~', size * 0.6, y)
      continue
    }
    // Relative line numbers, with the current line's own number.
    const current = index === cursorRow
    context.textAlign = 'right'
    context.fillStyle = current ? COLOR.currentLine : COLOR.lineNumber
    context.fillText(String(current ? index + 1 : Math.abs(index - cursorRow)), gutter - size * 0.8, y)
    context.textAlign = 'left'
    let x = gutter
    for (const [text, color] of highlight(lines[index])) {
      context.fillStyle = color
      context.fillText(text, x, y)
      x += context.measureText(text).width
    }
    if (current && cursorOn) {
      context.fillStyle = COLOR.cursor
      const cursorX = gutter + context.measureText(lines[index].slice(0, cursorCol)).width
      if (session.mode === 'INSERT') context.fillRect(cursorX, y - size * 0.6, size * 0.12, size * 1.2)
      else context.fillRect(cursorX, y - size * 0.6, char, size * 1.2)
    }
  }

  // Status line, then the mode or command line.
  const statusY = rows * row + size * 0.3
  context.fillStyle = COLOR.statusBack
  context.fillRect(0, statusY, width, row)
  context.fillStyle = COLOR.statusText
  context.textAlign = 'left'
  context.fillText(`${FILE_NAME}${session.dirty ? ' [+]' : ''}`, size * 0.6, statusY + row / 2)
  context.textAlign = 'right'
  context.fillText(`${cursorRow + 1},${cursorCol + 1}        All`, width - size * 0.6, statusY + row / 2)
  context.textAlign = 'left'
  context.fillStyle = session.mode === 'INSERT' && session.bottom.startsWith('--') ? COLOR.statusText : COLOR.text
  context.fillText(session.bottom, size * 0.6, statusY + row * 1.5)
}

export function VimScreen({ scene }: { scene: Object3D }) {
  const screen = useMemo(() => {
    scene.updateMatrixWorld(true)
    const display = scene.getObjectByName('Right_Display') as Mesh | undefined
    return display ? surface(display) : null
  }, [scene])
  const session = useMemo(() => new Session(), [])
  const drawn = useRef('')
  const vim = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = screen ? Math.round((1024 * screen.height) / screen.width) : 640
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    paint(canvas, session, true)
    return { canvas, texture }
  }, [screen, session])
  useEffect(() => () => vim.texture.dispose(), [vim])

  useFrame(({ clock }, delta) => {
    if (REDUCED_MOTION) return
    session.advance(Math.min(delta, 0.1), desk.typing)
    // The cursor holds steady while typing and blinks during pauses.
    const cursorOn = desk.typing > 0.5 || Math.floor(clock.elapsedTime * 1.6) % 2 === 0
    const key = `${session.version}:${cursorOn}`
    if (key === drawn.current) return
    drawn.current = key
    paint(vim.canvas, session, cursorOn)
    vim.texture.needsUpdate = true
  })

  if (!screen) return null
  return (
    <mesh position={screen.position} quaternion={screen.quaternion}>
      <planeGeometry args={[screen.width, screen.height]} />
      <meshBasicMaterial map={vim.texture} toneMapped={false} />
    </mesh>
  )
}
