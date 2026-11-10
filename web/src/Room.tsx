import { Html, useAnimations, useCursor, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Box3,
  type AmbientLight,
  Color,
  type Light,
  LoopRepeat,
  MathUtils,
  type Mesh,
  type MeshStandardMaterial,
  type OrthographicCamera,
  type PointLight,
  Sphere,
  Spherical,
  Vector3,
} from 'three'
import { CameraRig, DIORAMA_FOV, SEATED_FOV, type Shot } from './CameraRig'
import { Life, REDUCED_MOTION, TAP_SLOP } from './Life'
import { LoadBoundary } from './components/LoadBoundary'
import { Nameplate, NAMEPLATES } from './components/Nameplate'
import { REACTIVE, Reactions } from './Reactions'
import { Stink } from './Stink'
import { loadState } from './loading'
import { BOARD_FACE, boardPose, PhotoWall } from './PhotoWall'
import { Monitor, SEATED_DISTANCE, surface } from './components/Monitor'
import { Phone, phoneSurface } from './components/Phone'
import { CANDLE_IN_SUN, Outdoors, useSky } from './Outdoors'

export type View = 'ROOM' | 'DESK' | 'COMPUTER' | 'PHONE'

const MODEL_URL = '/corner-desk.glb'
// Fill the window's width. Wide windows may crop empty floor and wall height, down to this
// share of the room's height; shiftUp moves that crop toward the floor, which is mostly empty.
const ROOM_FRAME = { minVisibleHeight: 0.8, shiftUp: 0.05 }
// Angled bird's-eye: polar is radians down from straight overhead, scale is world units on screen.
const DESK_CAMERA = { polar: 0.62, scale: 2.35, distance: 10 }
// Clicking anywhere on or around the desk enters the desk view.
const DESK_PARTS = /^(Desk_|Main_Monitor|Right_Monitor|Shake_)/
// Edit the bubbles' words here. They're the person's thoughts, so they speak as the person.
const BUBBLES = [
  { object: 'Main_Display', label: 'software', blurb: "Projects I've built, live on this screen.", goesTo: 'COMPUTER', nudge: '20%' },
  { object: 'Shake_lid', label: 'fitness', blurb: 'My training page and my soccer club, on Instagram.', goesTo: 'PHONE', nudge: '-58%' },
] as const
// The share of the window the phone fills, nearly overhead, close enough that nothing above it gets in the way.
const PHONE_CAMERA = { fill: 0.8, phi: 0.05, clip: 0.1 }

// Browser brightness relative to the export, tuned by eye against the Cycles render.
const LIGHT_LEVELS: [RegExp, number][] = [
  [/^Candle/, 1.3],
  [/^Soft_window$/, 1.6],
  [/^Warm_fill$/, 0.4],
  // Off: this close to the window, its cone draws a hard half-moon on the blinds and glass.
  [/^Window_soft_light$/, 0],
]
const MATERIAL_GLOW: Record<string, number> = {
  Monitor_Screen: 2,
  // Low enough that the orange body and yellow core keep their colors instead of clipping to white.
  Candle_Flame: 1.8,
  Candle_Flame_core: 2.4,
}
const LOAD_ZOOM_START = 0.94
// The room falls away the closer the visitor gets. The candle stays lit.
const ROOM_LIGHT = { room: 1, desk: 0.85, board: 0.9, seated: 0.55, phone: 0.6, fade: 3 }
const AMBIENT = 0.28
// How each light changes from a clear night to full daylight. Night is the look the room was tuned for.
const DAY_AMBIENT = 1.5
const DAY_AMBIENT_COLOR = new Color('#dfe6f2')
const NIGHT_AMBIENT_COLOR = new Color('#aab0c4')
const DAY_WINDOW = 3.2
const DAY_WINDOW_COLOR = new Color('#e4ecfb')
const DAY_WARM_FILL = 0.35
const LIGHTNING_AMBIENT = 2.5
// The flame and wax fade with the candle's light, but slower, so it still reads as lit in full sun.
const FLAME_GLOW = MATERIAL_GLOW.Candle_Flame
const WAX_GLOW = 0.14
const GLOW_IN_SUN = 0.35
// The visitor's movement stirs the air around the flame.
const CANDLE_STIR = { most: 0.3, perSpeed: 0.12, rate: 37, settle: 6 }
// A hair above the screen's centre, looking back down at it.
const SEAT_RAISE = 0.03
const SEAT_CLIP = 20
// How far past the head's bounding sphere the camera stays, which also keeps the head off the near plane.
const HEAD_MARGIN = 0.04
// Lifts the candle's light off the wax, which it would otherwise blow out to white.
const CANDLE_LIGHT_LIFT = 0.12
// Past the room's furthest corner, about 5.3 away, because anything beyond this reach gets the candle's light through solid objects.
const CANDLE_SHADOW_REACH = 7
// Close enough for the mug and the other props right beside the candle to cast.
const CANDLE_SHADOW_NEAR = 0.03
// The flame and wax are the light's own source, and the smoothie's cup and lid are see-through.
// The wall and glass stop nothing inside, and would otherwise block the sun, which has its own cut-out mask.
// Closed blinds let this share of the window's light through.
const BLINDS_LIGHT = 0.35
// The seasonal corner: skis from December to March, the surfboard the rest of the year, by the month in NJ.
// ?season=ski or ?season=surf forces one, for a look at the other season.
const NJ_MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' })
const SKI_MONTHS = [12, 1, 2, 3]
// Not built yet: Christmas lights, when added, show in December only, read from the same NJ month.
// const CHRISTMAS_MONTHS = [12]
function seasonNow(): 'ski' | 'surf' {
  const forced = new URLSearchParams(window.location.search).get('season')
  if (forced === 'ski' || forced === 'surf') return forced
  return SKI_MONTHS.includes(Number(NJ_MONTH.format(new Date()))) ? 'ski' : 'surf'
}
const NO_SHADOW = /^(Flame|Candle_|Shake_cup|Shake_lid|Back_wall|Back_baseboard|Window_recess|Window_dusk_pane)/

type Pose = { position: Vector3; target: Vector3; zoom: number }

// The pinboard couldn't load: the room opens without it rather than wait on the photos forever.
function PhotosSkipped() {
  useEffect(() => {
    loadState.photos = true
  }, [])
  return null
}

// useGLTF has no progress option. The loader is shared, so this only reports on the room's own file.
// It measures against the decoded size, because the file arrives Brotli-encoded and event.total is the encoded size.
const reportRoomBytes: NonNullable<Parameters<typeof useGLTF>[3]> = (loader) => {
  const load = loader.load.bind(loader)
  loader.load = (url, onLoad, onProgress, onError) =>
    load(
      url,
      onLoad,
      (event) => {
        if (url === MODEL_URL) loadState.roomBytes = Math.min(event.loaded / __ROOM_BYTES__, 1)
        onProgress?.(event)
      },
      onError,
    )
}

function shotFrom({ position, target, zoom }: Pose, viewHeight: number): Shot {
  const offset = position.clone().sub(target)
  const { theta, phi, radius } = new Spherical().setFromVector3(offset)
  // The small margin matches the near plane the view was framed with.
  return { target, theta, phi, height: viewHeight / zoom, fov: DIORAMA_FOV, clip: Math.max(radius - 0.1, 0.1) }
}

// glTF drops Blender's procedural grain, so it is redrawn from world position.
function addWoodGrain(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWoodPosition;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWoodPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWoodPosition;
        float woodHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float woodNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(woodHash(i), woodHash(i + vec3(1, 0, 0)), f.x),
                mix(woodHash(i + vec3(0, 1, 0)), woodHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(woodHash(i + vec3(0, 0, 1)), woodHash(i + vec3(1, 0, 1)), f.x),
                mix(woodHash(i + vec3(0, 1, 1)), woodHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 woodCoord = vWoodPosition * vec3(1.6, 34.0, 34.0);
        float woodGrain = 0.6 * woodNoise(woodCoord) + 0.3 * woodNoise(woodCoord * vec3(2.3, 2.7, 2.7) + 7.0)
          + 0.1 * woodNoise(woodCoord * vec3(0.4, 0.15, 0.15));
        diffuseColor.rgb *= mix(0.62, 1.38, woodGrain);`,
      )
  }
  material.needsUpdate = true
}

export function Room({
  view,
  board,
  guide,
  onSelectDesk,
  onOpenBoard,
  onSelectComputer,
  onSelectPhone,
}: {
  view: View
  /** Whether the pinboard is open: the closest view of the photos. */
  board: boolean
  /** Whether the room should point at the computer: the visitor hasn't reached the desk, computer or phone yet. */
  guide: boolean
  onSelectDesk: () => void
  onOpenBoard: () => void
  onSelectComputer: () => void
  onSelectPhone: () => void
}) {
  // No Draco or meshopt: the room is plain glTF, and meshopt's WASM decoder would break the CSP's script-src 'self'.
  const { scene, animations } = useGLTF(MODEL_URL, false, false, reportRoomBytes)
  const { actions } = useAnimations(animations, scene)
  const size = useThree((state) => state.size)
  const gl = useThree((state) => state.gl)
  // Stays true after leaving until the screen has switched back, and the camera holds still until then.
  const [screenOpen, setScreenOpen] = useState(false)
  const closing = screenOpen && view !== 'COMPUTER'
  const handleScreenClosed = useCallback(() => setScreenOpen(false), [])
  const shotKey = closing ? 'COMPUTER' : board ? 'BOARD' : view
  const [landedKey, setLandedKey] = useState<string | null>(null)
  // The view the pointer is resting on, which the camera leans toward.
  const [lean, setLean] = useState<View | null>(null)
  const [photoHovered, setPhotoHovered] = useState(false)
  // The candle and blinds: whether one is under the pointer, how lit the candle is, and how shut the blinds are.
  const [reactionHovered, setReactionHovered] = useState(false)
  const candleLife = useRef(1)
  const blindsShut = useRef(0)
  const [glance, setGlance] = useState(0)
  const cameraSpeed = useRef(0)
  const candleStir = useRef(0)
  const roomLight = useRef(ROOM_LIGHT.room)
  const ambient = useRef<AmbientLight>(null)
  const cameFromRoom = useRef(false)
  const lastKey = useRef(shotKey)
  const reacting = (view === 'ROOM' || view === 'DESK') && !board && !closing
  // The one owner of the pointer cursor: two useCursor hooks reset each other, losing it over the desk.
  useCursor(lean !== null || photoHovered || (reacting && reactionHovered))

  const lights = useMemo(() => {
    const found: { light: Light; base: number }[] = []
    scene.traverse((object) => {
      const light = object as Light
      if (!light.isLight) return
      // Remember the exported value, because flicker overwrites intensity every frame.
      light.userData.exported ??= light.intensity
      const level = LIGHT_LEVELS.find(([name]) => name.test(light.name))?.[1] ?? 1
      found.push({ light, base: light.userData.exported * level })
    })
    return found
  }, [scene])
  const candles = useMemo(() => lights.filter(({ light }) => /^Candle/.test(light.name)), [lights])
  const sky = useSky()
  const windowLight = useMemo(() => {
    const light = lights.find(({ light }) => /^Soft_window$/.test(light.name))?.light
    return light && { light, night: light.color.clone() }
  }, [lights])
  const candleGlow = useMemo(() => {
    const found: { flame?: MeshStandardMaterial; core?: MeshStandardMaterial; wax?: MeshStandardMaterial } = {}
    scene.traverse((object) => {
      const material = (object as Mesh).material as MeshStandardMaterial | undefined
      if (material?.name === 'Candle_Flame') found.flame = material
      if (material?.name === 'Candle_Flame_core') found.core = material
      if (material?.name === 'Candle_Wax') found.wax = material
    })
    return found
  }, [scene])

  const desk = useMemo(() => {
    const box = new Box3()
    scene.traverse((object) => {
      if (DESK_PARTS.test(object.name)) box.expandByObject(object)
    })
    return box
  }, [scene])
  const deskTop = useMemo(() => {
    const { x, z } = desk.getCenter(new Vector3())
    return [x, desk.max.y, z] as const
  }, [desk])

  // The middle of an object's top, where a panel's leader points.
  const topOf = useCallback(
    (name: string) => {
      const item = scene.getObjectByName(name)
      if (!item) return null
      const box = new Box3().setFromObject(item)
      const { x, z } = box.getCenter(new Vector3())
      return [x, box.max.y, z] as const
    },
    [scene],
  )
  const bubbles = useMemo(
    () =>
      BUBBLES.flatMap(({ object, ...words }) => {
        const position = topOf(object)
        return position ? [{ ...words, position }] : []
      }),
    [topOf],
  )
  const monitorTop = useMemo(() => topOf('Main_Display'), [topOf])

  const shots = useMemo(() => {
    const fit = (scale: number) => Math.min(size.width, size.height) / scale
    const authored = scene.getObjectByName('ROOM') as OrthographicCamera | undefined
    if (!authored?.isCamera) return null

    // Frame what the ROOM camera actually sees, measured in its own view space.
    scene.updateMatrixWorld(true)
    const toView = authored.matrixWorld.clone().invert()
    const seen = new Box3()
    scene.traverse((object) => {
      const { isMesh, geometry, matrixWorld } = object as Mesh
      if (!isMesh) return
      geometry.computeBoundingBox()
      seen.union(geometry.boundingBox!.clone().applyMatrix4(toView.clone().multiply(matrixWorld)))
    })
    const middle = seen.getCenter(new Vector3())
    const extent = seen.getSize(new Vector3())
    middle.y += extent.y * ROOM_FRAME.shiftUp
    const position = new Vector3(middle.x, middle.y, 0).applyMatrix4(authored.matrixWorld)
    const target = middle.clone().applyMatrix4(authored.matrixWorld)
    const zoom = Math.min(
      size.width / extent.x,
      size.height / (extent.y * ROOM_FRAME.minVisibleHeight),
    )
    const room: Pose = { position, target, zoom }

    const theta = new Spherical().setFromVector3(position.clone().sub(target)).theta
    const deskTarget = desk.getCenter(new Vector3())
    const deskPose: Pose = {
      position: new Vector3()
        .setFromSphericalCoords(DESK_CAMERA.distance, DESK_CAMERA.polar, theta)
        .add(deskTarget),
      target: deskTarget,
      zoom: fit(DESK_CAMERA.scale),
    }
    const deskShot = shotFrom(deskPose, size.height)

    // Sitting down: straight on to the screen, with the lens opened up to human perspective.
    const screen = surface(scene.getObjectByName('Main_Display') as Mesh)
    const seatOffset = new Vector3(0, 0, 1)
      .applyQuaternion(screen.quaternion)
      .multiplyScalar(SEATED_DISTANCE)
      .add(new Vector3(0, SEAT_RAISE, 0))
    const seat = new Spherical().setFromVector3(seatOffset)
    const seated: Shot = {
      target: screen.position,
      theta: seat.theta,
      phi: seat.phi,
      height: 2 * seat.radius * Math.tan(MathUtils.degToRad(SEATED_FOV) / 2),
      fov: SEATED_FOV,
      // Nothing is cut away: a near plane close to the person would slice them open as the camera passes.
      clip: SEAT_CLIP,
    }

    // Looking straight down, the top of the window is the way the camera faces, so facing the phone's top stands it upright.
    const glass = phoneSurface(scene.getObjectByName('Phone_glass') as Mesh)
    const phoneTop = new Vector3(0, 1, 0).applyQuaternion(glass.quaternion)
    const phone: Shot = {
      target: glass.position,
      theta: Math.atan2(-phoneTop.x, -phoneTop.z),
      phi: PHONE_CAMERA.phi,
      height: Math.max(glass.height, (glass.width * size.height) / size.width) / PHONE_CAMERA.fill,
      fov: DIORAMA_FOV,
      clip: PHONE_CAMERA.clip,
    }
    return {
      ROOM: shotFrom(room, size.height),
      DESK: deskShot,
      // On phones the dashboard fills the window, so the camera stays at the desk behind it.
      COMPUTER: size.width < 768 ? deskShot : seated,
      PHONE: phone,
    }
  }, [scene, desk, size])

  const keepOut = useMemo(() => {
    const box = new Box3()
    scene.traverse((object) => {
      if (/^(Head|Hair)$/.test(object.name)) box.expandByObject(object)
    })
    const sphere = box.getBoundingSphere(new Sphere())
    sphere.radius += HEAD_MARGIN
    return sphere
  }, [scene])

  const shot = useMemo(() => {
    if (!shots) return null
    if (closing) return shots.COMPUTER
    return board ? shotFrom(boardPose(size), size.height) : shots[view]
  }, [shots, view, board, closing, size])
  const leanShot = useMemo(() => {
    return shots && lean ? shots[lean] : null
  }, [shots, lean])

  // The scene holds still, so shadows render once rather than every frame.
  useLayoutEffect(() => {
    // Before the shadows are drawn, so only this season's gear casts one.
    const season = seasonNow()
    loadState.season = season
    const skis = scene.getObjectByName('Ski_set')
    const surfboard = scene.getObjectByName('Surfboard')
    if (skis) skis.visible = season === 'ski'
    if (surfboard) surfboard.visible = season === 'surf'
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = !NO_SHADOW.test(mesh.name)
        mesh.receiveShadow = true
        const material = mesh.material as MeshStandardMaterial
        if (material.name in MATERIAL_GLOW) material.emissiveIntensity = MATERIAL_GLOW[material.name]
        // Wax glows from within in Cycles, which a surface material alone does not reproduce.
        if (material.name === 'Candle_Wax') {
          material.emissive.set('#ff9a4d')
          material.emissiveIntensity = WAX_GLOW
        }
        if (material.name === 'Warm_Oak' && !material.userData.grain) {
          material.userData.grain = true
          addWoodGrain(material)
        }
      }
    })
    lights.forEach(({ light: exported, base }) => {
      const light = exported as PointLight
      light.intensity = base
      // A light switched off still costs every lit pixel, so leave it out of the shaders.
      light.visible = base > 0
      // Blender's soft lights become hard lights here, and overlapping shadows look chaotic,
      // so only the candle casts them.
      if (/^Candle/.test(light.name)) {
        light.userData.restY ??= light.position.y
        light.position.y = light.userData.restY + CANDLE_LIGHT_LIFT
        light.castShadow = true
        light.shadow.camera.near = CANDLE_SHADOW_NEAR
        light.shadow.camera.far = CANDLE_SHADOW_REACH
        light.shadow.camera.updateProjectionMatrix()
        light.shadow.mapSize.setScalar(1024)
        light.shadow.radius = 6
        light.shadow.bias = -0.002
        light.shadow.normalBias = 0.02
      }
    })
    // A lost and restored WebGL context (common on phones when the tab is in the background) comes back with empty
    // shadow maps, and nothing else asks for a redraw at night.
    const redrawShadows = () => {
      gl.shadowMap.needsUpdate = true
    }
    gl.domElement.addEventListener('webglcontextrestored', redrawShadows)
    return () => gl.domElement.removeEventListener('webglcontextrestored', redrawShadows)
  }, [gl, scene, lights])

  useEffect(() => {
    // The flame's flicker. Reduced motion holds its first pose.
    Object.values(actions).forEach((action) => {
      if (!action) return
      action.setLoop(LoopRepeat, Infinity).play()
      action.paused = REDUCED_MOTION
    })
  }, [actions])

  // The sports corner is part of the room, so both are in the scene once this runs.
  useEffect(() => {
    loadState.room = true
    loadState.corner = true
  }, [])

  const framesDrawn = useRef(0)

  // A new destination clears the old arrival, and whatever was hovered is no longer where it was.
  useEffect(() => {
    cameFromRoom.current = lastKey.current === 'ROOM'
    lastKey.current = shotKey
    setLandedKey(null)
    setLean(null)
  }, [shotKey])

  const handleLanding = useCallback((key: string) => {
    setLandedKey(key)
    if (key === 'DESK' && cameFromRoom.current) setGlance((count) => count + 1)
  }, [])

  const handleArrived = useCallback((key: string) => {
    if (key === 'COMPUTER') setScreenOpen(true)
  }, [])

  useFrame(({ clock }, delta) => {
    // Drawing the first frame makes the GPU finish its shaders, so by the third the room is on screen and won't stall.
    framesDrawn.current += 1
    if (framesDrawn.current === 3) loadState.candle = true
    const t = clock.elapsedTime
    const light =
      view === 'COMPUTER' ? ROOM_LIGHT.seated : view === 'PHONE' ? ROOM_LIGHT.phone : board ? ROOM_LIGHT.board : view === 'DESK' ? ROOM_LIGHT.desk : ROOM_LIGHT.room
    roomLight.current = REDUCED_MOTION ? light : MathUtils.damp(roomLight.current, light, ROOM_LIGHT.fade, delta)
    const day = sky.daylight
    if (ambient.current) {
      ambient.current.intensity = (MathUtils.lerp(AMBIENT, DAY_AMBIENT, day) + sky.flash * LIGHTNING_AMBIENT) * roomLight.current
      ambient.current.color.copy(NIGHT_AMBIENT_COLOR).lerp(DAY_AMBIENT_COLOR, day)
    }
    lights.forEach(({ light: item, base }) => {
      if (/^Candle/.test(item.name)) return
      const level = /^Soft_window$/.test(item.name) ? MathUtils.lerp(1, DAY_WINDOW, day) : /^Warm_fill$/.test(item.name) ? MathUtils.lerp(1, DAY_WARM_FILL, day) : 1
      const blinds = /^(Soft_window|Window_soft_light)$/.test(item.name) ? MathUtils.lerp(1, BLINDS_LIGHT, blindsShut.current) : 1
      item.intensity = base * level * blinds * roomLight.current
    })
    if (windowLight) windowLight.light.color.copy(windowLight.night).lerp(DAY_WINDOW_COLOR, day)
    const glow = MathUtils.lerp(GLOW_IN_SUN, 1, (sky.candle - CANDLE_IN_SUN) / (1 - CANDLE_IN_SUN)) * candleLife.current
    if (candleGlow.flame) candleGlow.flame.emissiveIntensity = FLAME_GLOW * glow
    if (candleGlow.core) candleGlow.core.emissiveIntensity = MATERIAL_GLOW.Candle_Flame_core * glow
    if (candleGlow.wax) candleGlow.wax.emissiveIntensity = WAX_GLOW * glow
    if (REDUCED_MOTION) {
      candles.forEach(({ light: item, base }) => {
        item.intensity = base * sky.candle * candleLife.current
      })
      return
    }

    const stir = Math.min(cameraSpeed.current * CANDLE_STIR.perSpeed, CANDLE_STIR.most)
    candleStir.current = MathUtils.damp(candleStir.current, stir, CANDLE_STIR.settle, delta)
    const stirred = 1 - candleStir.current * (0.5 + 0.5 * Math.sin(t * CANDLE_STIR.rate))
    candles.forEach(({ light: item, base }, i) => {
      item.intensity = base * sky.candle * candleLife.current * stirred * (0.9 + 0.07 * Math.sin(t * 9 + i * 2) + 0.05 * Math.sin(t * 23 + i))
    })
  })

  return (
    <>
      <primitive object={scene} />
      <Life scene={scene} glance={glance} />
      <Outdoors scene={scene} sky={sky} roomLight={roomLight} />
      {shot && (
        <CameraRig
          shot={shot}
          shotKey={shotKey}
          depth={view === 'COMPUTER' || closing ? 2 : view === 'PHONE' ? 1.5 : board ? 1.25 : view === 'DESK' ? 1 : 0}
          lean={leanShot}
          free={view !== 'COMPUTER' && view !== 'PHONE' && !closing && !board}
          loadFrom={shot.height / LOAD_ZOOM_START}
          keepOut={keepOut}
          motion={cameraSpeed}
          onLanding={handleLanding}
          onArrived={handleArrived}
        />
      )}
      <Monitor
        scene={scene}
        active={view === 'COMPUTER'}
        seated={screenOpen}
        closing={closing}
        onClosed={handleScreenClosed}
        interactive={view === 'DESK' && !closing}
        onHover={(hovered) => setLean((current) => (hovered ? 'COMPUTER' : current === 'COMPUTER' ? null : current))}
        onSelect={onSelectComputer}
      />
      <Phone
        scene={scene}
        interactive={view === 'DESK' && !closing}
        awake={view === 'PHONE' && !closing && landedKey === shotKey}
        onHover={(hovered) => setLean((current) => (hovered ? 'PHONE' : current === 'PHONE' ? null : current))}
        onSelect={onSelectPhone}
      />
      {/* Its own boundaries: the room appears while the photos load, and stays if one of them fails. */}
      <LoadBoundary fallback={<PhotosSkipped />}>
        <Suspense fallback={null}>
          <PhotoWall open={board} interactive={view === 'ROOM'} onOpen={onOpenBoard} onHover={setPhotoHovered} />
        </Suspense>
      </LoadBoundary>
      {/* Stands in for the bounce light that Cycles renders and this does not. */}
      <ambientLight ref={ambient} color="#aab0c4" intensity={AMBIENT} />
      {/* In the desk view it does nothing but mark the desk as on the object, so a click there doesn't step back. */}
      {(view === 'ROOM' || view === 'DESK') && !board && (
        <mesh
          name="Desk_click_target"
          visible={false}
          position={desk.getCenter(new Vector3())}
          onClick={(event) => {
            // A drag to look around also ends in a click; only a still press counts.
            if (view !== 'ROOM' || event.delta > TAP_SLOP) return
            // The candle sits inside this box, and its own click shouldn't also walk over to the desk.
            if (event.intersections.some(({ object }) => REACTIVE.test(object.name))) return
            onSelectDesk()
          }}
          // On move as well as over: a view change clears the lean, and no new pointer-over fires for a pointer already here.
          onPointerOver={() => {
            if (view === 'ROOM') setLean('DESK')
          }}
          onPointerMove={() => {
            if (view === 'ROOM') setLean('DESK')
          }}
          onPointerOut={() => setLean((current) => (current === 'DESK' ? null : current))}
        >
          <boxGeometry args={desk.getSize(new Vector3()).toArray()} />
        </mesh>
      )}
      <Stink scene={scene} visible={view === 'ROOM' || view === 'DESK'} />
      <Reactions
        scene={scene}
        interactive={reacting}
        candle={candleLife}
        shut={blindsShut}
        onHover={setReactionHovered}
      />
      {view === 'ROOM' && !board && lean === 'DESK' && !reactionHovered && <Nameplate position={deskTop} {...NAMEPLATES.DESK} />}
      {/* Points at the computer until the visitor first gets there; the desk's own plate takes over while it's hovered. */}
      {view === 'ROOM' && !board && guide && monitorTop && lean !== 'DESK' && !photoHovered && (
        <Nameplate position={monitorTop} beckon {...NAMEPLATES.COMPUTER} />
      )}
      {view === 'ROOM' && !board && photoHovered && <Nameplate position={BOARD_FACE} {...NAMEPLATES.BOARD} />}
      {view === 'DESK' &&
        !closing &&
        landedKey === shotKey &&
        bubbles.map(({ label, blurb, goesTo, nudge, position }, index) => (
          <Html key={label} position={position} zIndexRange={[10, 0]} pointerEvents="none">
            <div className="bubble panel-cast" style={{ '--delay': `${index * 0.18}s`, '--nudge': nudge } as React.CSSProperties}>
              <button
                className="panel bubble-panel"
                onClick={(event) => {
                  // Html sits inside the element the scene listens on, so this click would otherwise count as missing the desk.
                  event.stopPropagation()
                  if (goesTo === 'PHONE') onSelectPhone()
                  else onSelectComputer()
                }}
              >
                <span className="panel-label">{label}</span>
                <span className="bubble-blurb">{blurb}</span>
              </button>
              <span className="bubble-leader" />
            </div>
          </Html>
        ))}
    </>
  )
}
