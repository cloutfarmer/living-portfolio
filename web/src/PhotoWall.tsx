import { useTexture } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  type Group,
  MathUtils,
  type Mesh,
  type MeshBasicMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three'
import { channel, damp } from './CameraRig'
import { REDUCED_MOTION } from './Life'
import { loadState } from './loading'

// Every image in ./pinboard appears on the wall, in name order (photo-2 before photo-10). Fill it with
// `npm run prepare-photos -- <folder>`. Only more images than prints makes the wall swap photos.
const PHOTOS = Object.entries(import.meta.glob('./pinboard/*.{svg,jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' }))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url as string)

// The left wall's inner face. Positions are measured along it: z runs from the back wall toward the camera.
const WALL_X = -1.06
const BOARD = { z: -0.41, y: 1.875, width: 1.7, height: 1.2, depth: 0.02, edge: 0.03 }
// Where the room's nameplate for the board pins: the middle of the cork's face.
export const BOARD_FACE = [WALL_X + BOARD.depth, BOARD.y, BOARD.z] as const
// Each print has a place in the overlapping pile, and a place of its own once the board is opened. Opening the board
// is as close as it gets; single photos don't zoom. Listed in reading order on the opened 3×3 board (each row left
// to right, top to bottom), matching the file numbers: the camera faces -x, so left to right is z falling.
// Each print's shape follows its photo (see web/src/pinboard), so the cover crop keeps faces in frame.
// Layers run back to front, and tilts are in degrees. Delay spreads the move outward from the pile's centre.
const PRINTS = [
  { width: 0.19, height: 0.25, pile: { z: -0.12, y: 2.04, tilt: -3, layer: 0 }, open: { z: 0.155, y: 2.29, tilt: -1 }, delay: 0.12 },
  { width: 0.19, height: 0.25, pile: { z: -0.4, y: 2.12, tilt: 4, layer: 1 }, open: { z: -0.41, y: 2.3, tilt: 1 }, delay: 0.05 },
  { width: 0.33, height: 0.245, pile: { z: -0.72, y: 2.08, tilt: -5, layer: 0 }, open: { z: -0.975, y: 2.29, tilt: -1.5 }, delay: 0.1 },
  { width: 0.36, height: 0.24, pile: { z: 0.06, y: 1.8, tilt: -6, layer: 1 }, open: { z: 0.155, y: 1.88, tilt: -2 }, delay: 0.15 },
  { width: 0.2, height: 0.25, pile: { z: -0.2, y: 1.62, tilt: 3, layer: 2 }, open: { z: -0.41, y: 1.9, tilt: 1.5 }, delay: 0.03 },
  { width: 0.33, height: 0.245, pile: { z: -0.5, y: 1.78, tilt: -7, layer: 3 }, open: { z: -0.975, y: 1.89, tilt: -1.5 }, delay: 0 },
  { width: 0.19, height: 0.25, pile: { z: -0.78, y: 1.66, tilt: 6, layer: 0 }, open: { z: 0.155, y: 1.49, tilt: 2 }, delay: 0.18 },
  { width: 0.19, height: 0.25, pile: { z: -0.38, y: 1.56, tilt: -4, layer: 4 }, open: { z: -0.41, y: 1.48, tilt: -1 }, delay: 0.08 },
  { width: 0.19, height: 0.25, pile: { z: -0.95, y: 1.92, tilt: 5, layer: 1 }, open: { z: -0.975, y: 1.5, tilt: 1 }, delay: 0.2 },
]

const PAPER = { side: 0.02, top: 0.02, bottom: 0.05 }
const CORK_ID = -1
const PIN_COLORS = ['#c8473c', '#3f7fb5', '#d9a93f', '#4f9a6c']
// Far enough apart that a print's shadow lies above the print beneath it.
const LAYER_GAP = 0.008
// Seconds. A move settles in about three times this.
const MOVE_PACE = 0.2
const MOVE_SECONDS = 0.9
// Prints rise off the cork as they travel, by this much per unit of speed, and no further than MOST_LIFT.
const LIFT_PER_SPEED = 0.025
const MOST_LIFT = 0.07
// Close enough to stand clear of the desk and monitors, which would otherwise block the view.
const VIEW_DISTANCE = 0.95
const BOARD_MARGIN = 1.1
// One print changes at a time, so the wall stays calm and the change is a small thing to notice.
const CHANGE_SECONDS = { least: 45, most: 75 }
const FADE_SECONDS = 2.4
// The flourish is rationed, not the feedback: hovering always brightens a print at once. The sweep needs the pointer to
// stop, so passing across the pile fires nothing, and each print then waits before it can play again.
const SHIMMER = { seconds: 0.9, lift: 0.022, color: '#ffe3bd', strength: 0.55, restSeconds: 0.12, restPixels: 6, cooldownSeconds: 8 }
const HOVER_RATE = 14
// Photos don't take the room's light, so this sets their brightness. The AgX tone mapping in App.tsx
// lifts mid-tones and washes out color, so values well under 1 are what look natural on screen.
const PHOTO_SHADE = { rest: 0.3, hovered: 0.42 }

const paperSize = ({ width, height }: { width: number; height: number }) => ({
  width: width + PAPER.side * 2,
  height: height + PAPER.top + PAPER.bottom,
})

function viewOf(z: number, y: number, width: number, height: number, margin: number, size: { width: number; height: number }) {
  const target = new Vector3(WALL_X, y, z)
  return {
    position: target.clone().add(new Vector3(VIEW_DISTANCE, 0, 0)),
    target,
    zoom: Math.min(size.width / (width * margin), size.height / (height * margin)),
  }
}

/** Where the camera goes to take in the whole board. */
export function boardPose(size: { width: number; height: number }) {
  return viewOf(BOARD.z, BOARD.y, BOARD.width + BOARD.edge * 2, BOARD.height + BOARD.edge * 2, BOARD_MARGIN, size)
}

// The photos are redrawn as pixel art, so they look made in the same world as the low-poly room. `pixels` is the
// count across a photo's long edge, enough that faces still read up close; `levels` the shades per colour channel,
// which flattens skin and sky into blocks. Dithering was tried and read as a screen-door pattern.
const PIXEL_ART = { pixels: 96, levels: 10 }

function pixelate(texture: Texture) {
  const image = texture.image as HTMLImageElement
  const scale = PIXEL_ART.pixels / Math.max(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const frame = context.getImageData(0, 0, canvas.width, canvas.height)
  const step = 255 / (PIXEL_ART.levels - 1)
  for (let at = 0; at < frame.data.length; at += 4) {
    for (let channel = 0; channel < 3; channel++) frame.data[at + channel] = Math.round(frame.data[at + channel] / step) * step
  }
  context.putImageData(frame, 0, 0)
  const art = new CanvasTexture(canvas)
  art.colorSpace = SRGBColorSpace
  // Hard-edged pixels up close; mipmaps still smooth them from across the room, so they don't shimmer.
  art.magFilter = NearestFilter
  return art
}

// A soft diagonal band with clear edges. Sliding the texture's offset carries it across the photo.
function paintSweep() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 256, 64)
  gradient.addColorStop(0.3, '#000')
  gradient.addColorStop(0.5, '#fff')
  gradient.addColorStop(0.7, '#000')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 256)
  const texture = new CanvasTexture(canvas)
  texture.repeat.x = 0.5
  texture.offset.x = -0.5
  return texture
}

// Speckled cork, from a fixed seed so it looks the same on every visit.
function paintCork() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 704
  const context = canvas.getContext('2d')!
  context.fillStyle = '#b98f5f'
  context.fillRect(0, 0, 1024, 704)
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const flecks = ['#9a7346', '#cfa877', '#86623a', '#dcbb8e']
  for (let i = 0; i < 9000; i++) {
    context.fillStyle = flecks[Math.floor(random() * flecks.length)]
    context.globalAlpha = 0.25 + random() * 0.5
    context.beginPath()
    context.ellipse(random() * 1024, random() * 704, 0.8 + random() * 2.6, 0.6 + random() * 1.6, random() * Math.PI, 0, Math.PI * 2)
    context.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// The soft shadow under a print. The room draws real shadows once, so anything that moves has to carry its own.
function paintShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.shadowColor = '#000'
  context.shadowBlur = 18
  context.fillStyle = '#000'
  context.fillRect(24, 24, 80, 80)
  return new CanvasTexture(canvas)
}

// Crops like CSS object-fit: cover, so a photo of any shape fills its print without stretching.
function coverCrop(texture: Texture, aspect: number) {
  const crop = texture.clone()
  const { width, height } = texture.image as { width: number; height: number }
  const ratio = width / height / aspect
  crop.repeat.set(Math.min(1 / ratio, 1), Math.min(ratio, 1))
  crop.offset.set((1 - crop.repeat.x) / 2, (1 - crop.repeat.y) / 2)
  return crop
}

/** What the prints share, so the rules can hold across the whole wall. */
type Wall = {
  /** The print currently sweeping, if any. Only one plays at a time. */
  sweeping: number | null
  /** The prints are moving until this time, and nothing plays during it. */
  movingUntil: number
  /** The print that should change its photo next, if any. */
  changing: number | null
  /** Which image each print is showing. */
  showing: number[]
  hovered: Set<number>
  /** The scene's clock, for pointer events, which arrive between frames. */
  now: number
}

function Print({
  index,
  textures,
  wall,
  shadow,
  open,
  interactive,
  onActivate,
  onHover,
}: {
  index: number
  textures: Texture[]
  wall: React.RefObject<Wall>
  shadow: Texture
  open: boolean
  /** Only the closed pile takes the pointer: a click opens the board. */
  interactive: boolean
  onActivate: () => void
  onHover: (hovered: boolean) => void
}) {
  const print = PRINTS[index]
  const { width, height } = print
  const paper = paperSize(print)
  const paperMiddle = (PAPER.top - PAPER.bottom) / 2
  const crops = useMemo(() => textures.map((texture) => coverCrop(texture, width / height)), [textures, width, height])
  const placed = useRef<Group>(null)
  const shadowMesh = useRef<Mesh>(null)
  const shadowMaterial = useRef<MeshBasicMaterial>(null)
  const sweepMesh = useRef<Mesh>(null)
  const sweep = useMemo(paintSweep, [])
  const under = useRef<MeshBasicMaterial>(null)
  const over = useRef<MeshBasicMaterial>(null)
  const overMesh = useRef<Mesh>(null)
  const pose = useRef({ z: channel(print.pile.z), y: channel(print.pile.y), tilt: channel(print.pile.tilt), layer: channel(print.pile.layer) })
  // The goal only changes after this print's delay, which is what staggers the move.
  const goal = useRef({ open, at: 0 })
  const shimmer = useRef<number | null>(null)
  const visit = useRef({ inside: false, since: 0, decided: false, x: 0, y: 0 })
  const cooldownUntil = useRef(0)
  const brightness = useRef(0)
  const fade = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)
  // Changes swap the maps directly. A prop that followed them would snap a fade to its end on any re-render.
  const [firstShown] = useState(() => wall.current.showing[index])

  useEffect(() => () => crops.forEach((crop) => crop.dispose()), [crops])
  useEffect(() => () => sweep.dispose(), [sweep])

  const leave = useCallback(() => {
    visit.current.inside = false
    setHovered(false)
    onHover(false)
  }, [onHover])

  // Opening the board or changing the view removes the handlers, so no pointer-out arrives to clear this.
  useEffect(() => {
    if (!interactive) leave()
  }, [interactive, leave])

  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime
    const shared = wall.current
    shared.now = now

    if (open !== goal.current.open && goal.current.at === 0) goal.current.at = now + print.delay
    if (goal.current.at !== 0 && now >= goal.current.at) {
      goal.current = { open, at: 0 }
    }
    const opened = REDUCED_MOTION ? open : goal.current.open
    const to = opened ? print.open : print.pile
    const toTilt = to.tilt
    const toLayer = opened ? 0 : print.pile.layer
    const { z, y, tilt, layer } = pose.current
    if (REDUCED_MOTION) {
      z.value = to.z
      y.value = to.y
      tilt.value = toTilt
      layer.value = toLayer
    } else {
      damp(z, to.z, MOVE_PACE, delta)
      damp(y, to.y, MOVE_PACE, delta)
      damp(tilt, toTilt, MOVE_PACE, delta)
      damp(layer, toLayer, MOVE_PACE, delta)
    }
    const speed = Math.hypot(z.velocity, y.velocity)
    const travelLift = Math.min(speed * LIFT_PER_SPEED, MOST_LIFT)

    // One decision per visit, when the pointer has rested: anything in the way means no sweep this time.
    const here = visit.current
    if (here.inside && !here.decided && now - here.since >= SHIMMER.restSeconds) {
      here.decided = true
      const allowed = !REDUCED_MOTION && shared.sweeping === null && now >= shared.movingUntil && now >= cooldownUntil.current
      if (allowed) {
        shared.sweeping = index
        shimmer.current = 0
        cooldownUntil.current = now + SHIMMER.cooldownSeconds
      }
    }

    // Sine out and back, so the lift and the brightening both finish where they started.
    let swell = 0
    if (shimmer.current !== null) {
      shimmer.current = Math.min(shimmer.current + delta / SHIMMER.seconds, 1)
      const progress = shimmer.current
      swell = Math.sin(progress * Math.PI)
      sweep.offset.x = MathUtils.lerp(-0.5, 1, MathUtils.smootherstep(progress, 0, 1))
      if (progress === 1) {
        shimmer.current = null
        shared.sweeping = null
      }
    }
    const lift = travelLift + swell * SHIMMER.lift
    if (placed.current) {
      placed.current.position.set(WALL_X + BOARD.depth + 0.001 + layer.value * LAYER_GAP + lift, y.value, z.value)
      placed.current.rotation.set(0, Math.PI / 2, 0)
      placed.current.rotateZ(MathUtils.degToRad(tilt.value))
    }
    // A print further off the cork throws a softer shadow, further away.
    if (shadowMesh.current) shadowMesh.current.position.y = paperMiddle - 0.01 - lift * 0.5
    if (shadowMaterial.current) shadowMaterial.current.opacity = 0.55 - lift * 2
    if (sweepMesh.current) sweepMesh.current.visible = shimmer.current !== null

    const pointed = hovered && interactive
    brightness.current = REDUCED_MOTION ? Number(pointed) : MathUtils.damp(brightness.current, Number(pointed), HOVER_RATE, delta)
    const shade = MathUtils.lerp(PHOTO_SHADE.rest, PHOTO_SHADE.hovered, Math.max(brightness.current, swell))
    under.current?.color.setScalar(shade)
    over.current?.color.setScalar(shade)

    const front = over.current
    const back = under.current
    if (!front || !back) return
    if (fade.current !== null) {
      fade.current = Math.min(fade.current + delta / FADE_SECONDS, 1)
      front.opacity = fade.current
      if (fade.current === 1) {
        back.map = front.map
        back.needsUpdate = true
        front.opacity = 0
        fade.current = null
        if (overMesh.current) overMesh.current.visible = false
        shared.changing = null
      }
    } else if (shared.changing === index) {
      // The next photo that no other print is showing.
      let next = shared.showing[index]
      do {
        next = (next + 1) % crops.length
      } while (shared.showing.includes(next))
      shared.showing[index] = next
      front.map = crops[next]
      front.needsUpdate = true
      fade.current = 0
      if (overMesh.current) overMesh.current.visible = true
    }
  })

  const startHover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    // Pointer-move lands here too. A new visit starts the wait, and so does moving on, so only a real pause counts.
    const { clientX: x, clientY: y } = event.nativeEvent
    const here = visit.current
    if (!here.inside) visit.current = { inside: true, since: wall.current.now, decided: false, x, y }
    else if (Math.hypot(x - here.x, y - here.y) > SHIMMER.restPixels) Object.assign(here, { since: wall.current.now, x, y })
    setHovered(true)
    onHover(true)
  }

  const handlers = interactive
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          // A drag to look around also ends in a click; only a still press counts.
          if (event.delta > 4) return
          event.stopPropagation()
          onActivate()
        },
        // On move as well as over: after the reset above, no new pointer-over fires for this print.
        onPointerOver: startHover,
        onPointerMove: startHover,
        onPointerOut: leave,
      }
    : {}

  return (
    <group ref={placed} position={[WALL_X + BOARD.depth, print.pile.y, print.pile.z]} {...handlers}>
      {/* Never hit by the pointer: it's bigger than the print and only there to be seen. */}
      <mesh ref={shadowMesh} position={[0, paperMiddle - 0.01, 0]} raycast={() => null}>
        <planeGeometry args={[paper.width * 1.35, paper.height * 1.35]} />
        <meshBasicMaterial ref={shadowMaterial} map={shadow} transparent opacity={0.55} depthWrite={false} color="#000" />
      </mesh>
      <mesh name={`Print_${index}_paper`} position={[0, paperMiddle, 0.001]}>
        <planeGeometry args={[paper.width, paper.height]} />
        {/* The left wall is dim, so the paper lights itself a little or it reads as grey. */}
        <meshStandardMaterial color="#f1eadc" roughness={0.85} emissive="#f1eadc" emissiveIntensity={0.28} />
      </mesh>
      <mesh name={`Print_${index}_photo`} position={[0, 0, 0.002]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={under} map={crops[firstShown]} />
      </mesh>
      <mesh ref={overMesh} visible={false} position={[0, 0, 0.003]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={over} map={crops[firstShown]} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh name={`Print_${index}_sweep`} ref={sweepMesh} visible={false} position={[0, 0, 0.004]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={sweep} color={SHIMMER.color} opacity={SHIMMER.strength} transparent blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, height / 2 + PAPER.top * 0.1, 0.012]}>
        <sphereGeometry args={[0.014, 12, 8]} />
        <meshStandardMaterial color={PIN_COLORS[index % PIN_COLORS.length]} roughness={0.35} emissive={PIN_COLORS[index % PIN_COLORS.length]} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

export function PhotoWall({
  open,
  interactive,
  onOpen,
  onHover,
}: {
  /** Whether the prints have separated and the camera has come close. */
  open: boolean
  interactive: boolean
  onOpen: () => void
  onHover: (hovered: boolean) => void
}) {
  const photos = useTexture(PHOTOS)
  const textures = useMemo(() => photos.map(pixelate), [photos])
  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures])
  const wall = useRef<Wall>({
    sweeping: null,
    movingUntil: 0,
    changing: null,
    showing: PRINTS.map((_, index) => index % PHOTOS.length),
    hovered: new Set(),
    now: 0,
  })
  const cork = useMemo(paintCork, [])
  const shadow = useMemo(paintShadow, [])
  useEffect(() => () => cork.dispose(), [cork])
  useEffect(() => () => shadow.dispose(), [shadow])
  useEffect(() => {
    loadState.photos = true
  }, [])

  const randomGap = () => MathUtils.randFloat(CHANGE_SECONDS.least, CHANGE_SECONDS.most)
  const nextChange = useRef(randomGap())
  const wasChanging = useRef(false)
  const wasOpen = useRef(open)
  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const shared = wall.current
    if (wasOpen.current !== open) {
      wasOpen.current = open
      shared.movingUntil = now + MOVE_SECONDS
    }
    // The next wait starts once the last fade has ended.
    if (wasChanging.current && shared.changing === null) nextChange.current = now + randomGap()
    wasChanging.current = shared.changing !== null
    // Reduced motion holds the photos still. With no spare image there's nothing to change to.
    if (REDUCED_MOTION || open || shared.changing !== null || now < nextChange.current || textures.length <= PRINTS.length) return
    const free = PRINTS.map((_, index) => index).filter((index) => !shared.hovered.has(index))
    if (free.length) shared.changing = free[Math.floor(Math.random() * free.length)]
  })

  // Moving between a print and the cork behind it ends one hover as another begins, so count them rather than toggle.
  const hoverOf = useCallback(
    (id: number, hovered: boolean) => {
      const { hovered: all } = wall.current
      if (hovered) all.add(id)
      else all.delete(id)
      onHover(all.size > 0)
    },
    [onHover],
  )
  // Only the closed board answers the pointer. Its handlers go when it opens or the view changes, so the cork's
  // pointer-out may never arrive.
  const clickable = interactive && !open
  useEffect(() => {
    if (!clickable) hoverOf(CORK_ID, false)
  }, [clickable, hoverOf])
  const hoverHandlers = useMemo(() => PRINTS.map((_, index) => (hovered: boolean) => hoverOf(index, hovered)), [hoverOf])

  const corkHandlers = clickable
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 4) return
          event.stopPropagation()
          onOpen()
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          hoverOf(CORK_ID, true)
        },
        onPointerMove: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          hoverOf(CORK_ID, true)
        },
        onPointerOut: () => hoverOf(CORK_ID, false),
      }
    : interactive
      ? {
          // The open board keeps its clicks, which would otherwise count as missing it and step back. The ray reaches
          // the cork behind every print, so this covers them too.
          onClick: (event: ThreeEvent<MouseEvent>) => event.stopPropagation(),
        }
      : {}

  return (
    <>
      <group position={[WALL_X + BOARD.depth / 2, BOARD.y, BOARD.z]} rotation={[0, Math.PI / 2, 0]} {...corkHandlers}>
        <mesh name="Pinboard_edge" receiveShadow>
          <boxGeometry args={[BOARD.width + BOARD.edge * 2, BOARD.height + BOARD.edge * 2, BOARD.depth * 0.9]} />
          <meshStandardMaterial color="#7a4a2c" roughness={0.7} />
        </mesh>
        <mesh name="Pinboard_cork" position={[0, 0, BOARD.depth / 2]} receiveShadow>
          <planeGeometry args={[BOARD.width, BOARD.height]} />
          <meshStandardMaterial map={cork} roughness={0.95} />
        </mesh>
      </group>
      {PRINTS.map((_, index) => (
        <Print
          key={index}
          index={index}
          textures={textures}
          wall={wall}
          shadow={shadow}
          open={open}
          interactive={clickable}
          onActivate={onOpen}
          onHover={hoverHandlers[index]}
        />
      ))}
    </>
  )
}
