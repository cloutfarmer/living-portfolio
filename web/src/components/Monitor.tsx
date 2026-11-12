import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  type Box3,
  CanvasTexture,
  type Group,
  Matrix4,
  type Mesh,
  type Object3D,
  Quaternion,
  Shape,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three'
import previewUrl from '../assets/dashboard-preview.jpg'
import { desk } from '../desk'
import { REDUCED_MOTION, TAP_SLOP } from '../motion'

// Matches .screen-live's fade in styles.css.
const SWITCH_BACK_MS = 260
// The live page's own pixels across the glass, and the picture's shape (dashboard-preview.jpg is 1440 x 883).
const PAGE_WIDTH = 1440
const PREVIEW_ASPECT = 1440 / 883
// The glass's rounded corners, in metres.
const CORNER = 0.008
// Finds the live page from outside React: App checks who is asking to leave, and styles.css sizes it on phones.
const FRAME_CLASS = 'screen-live'

// Measure the authored local XY face, then carry its full transform into world space.
// A 0.1 mm offset avoids coplanar flicker without crossing the note's 1 mm gap.
export function surface(mesh: Mesh) {
  mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox! as Box3
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  center.z = box.max.z + 0.0001
  const position = mesh.localToWorld(center)
  const quaternion = mesh.getWorldQuaternion(new Quaternion())
  const scale = mesh.getWorldScale(new Vector3())
  return { position, quaternion, width: size.x * scale.x, height: size.y * scale.y }
}

export function Monitor({
  scene,
  active,
  mobile,
  seated,
  closing,
  onClosed,
  interactive,
  onHover,
  onSelect,
}: {
  scene: Group
  active: boolean
  /** A phone-width window, where the site fills the window instead of the glass. Room decides, from PHONE_WIDTH. */
  mobile: boolean
  /** The camera has finished sitting down, so the switch to the live screen can begin. */
  seated: boolean
  /** The visitor has left, so the screen switches back before the camera stands. */
  closing: boolean
  onClosed: () => void
  interactive: boolean
  onHover: (hovered: boolean) => void
  onSelect: () => void
}) {
  // The live page's scrollIntoView (its "All projects" link) also scrolls the room's elements around the
  // same-origin iframe, sliding the page off the glass. Nothing holding the iframe should scroll, so undo it.
  useEffect(() => {
    const pin = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || !target.querySelector(`iframe.${FRAME_CLASS}`)) return
      target.scrollTop = 0
      target.scrollLeft = 0
    }
    document.addEventListener('scroll', pin, true)
    return () => document.removeEventListener('scroll', pin, true)
  }, [])
  const overlay = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const handleLoad = useCallback(() => setLoaded(true), [])
  useEffect(() => {
    if (seated || active) return
    setLoaded(false)
  }, [seated, active])
  // Crossing the phone width swaps one iframe for another, which starts loading from scratch.
  useEffect(() => setLoaded(false), [mobile])
  // The person turns from the vim screen to this one as the visitor sits down.
  useEffect(() => {
    desk.focus = active ? 'main' : 'right'
  }, [active])
  useEffect(() => {
    if (!closing) return
    // The live page fades back to the picture beneath it. Nothing to play back if it never showed.
    const animated = loaded && !mobile && !REDUCED_MOTION
    const timer = window.setTimeout(onClosed, animated ? SWITCH_BACK_MS : 0)
    return () => window.clearTimeout(timer)
  }, [closing, loaded, mobile, onClosed])
  // The site's own picture: what the visitor sees from the room, and what the live page fades in over.
  const preview = useMemo(() => {
    const texture = new TextureLoader().load(previewUrl)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [])
  useEffect(() => () => preview.dispose(), [preview])
  const shown = loaded && !closing
  // On phones the site covers the whole window, so the room behind it needn't keep drawing.
  const setFrameloop = useThree((state) => state.setFrameloop)
  useEffect(() => {
    if (!mobile || !active || !shown) return
    setFrameloop('never')
    return () => setFrameloop('always')
  }, [mobile, active, shown, setFrameloop])
  const { screen, note } = useMemo(() => {
    scene.updateMatrixWorld(true)
    return {
      screen: surface(scene.getObjectByName('Main_Display') as Mesh),
      note: surface(scene.getObjectByName('Sticky_note') as Mesh),
    }
  }, [scene])
  const width = PAGE_WIDTH
  const height = (width * screen.height) / screen.width
  // The glass's rounded corners live in the clip path: overflow or border-radius here stops the wheel scrolling the iframe.
  const corner = (CORNER / screen.width) * width
  const arc = (x: number, y: number) => `A${corner} ${corner} 0 0 1 ${x} ${y}`
  const glass = `M${corner} 0H${width - corner}${arc(width, corner)}V${height - corner}${arc(width - corner, height)}H${corner}${arc(0, height - corner)}V${corner}${arc(corner, 0)}Z`
  const normal = useMemo(() => new Vector3(0, 0, 1).applyQuaternion(screen.quaternion), [screen])
  const screenInverse = useMemo(
    () => new Matrix4().compose(screen.position, screen.quaternion, new Vector3(1, 1, 1)).invert(),
    [screen],
  )
  const noteCorners = useMemo(
    () =>
      [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ].map(([x, y]) =>
        new Vector3((x * note.width) / 2, (y * note.height) / 2, 0).applyQuaternion(note.quaternion).add(note.position),
      ),
    [note],
  )
  const shape = useMemo(() => {
    const w = screen.width / 2
    const h = screen.height / 2
    const r = CORNER
    return new Shape()
      .moveTo(-w + r, -h)
      .lineTo(w - r, -h)
      .quadraticCurveTo(w, -h, w, -h + r)
      .lineTo(w, h - r)
      .quadraticCurveTo(w, h, w - r, h)
      .lineTo(-w + r, h)
      .quadraticCurveTo(-w, h, -w, h - r)
      .lineTo(-w, -h + r)
      .quadraticCurveTo(-w, -h, -w + r, -h)
  }, [screen])
  // The sticky note tells visitors the screen is a real, live website. Handwriting fonts
  // that ship with the operating system, so nothing has to load before it's drawn.
  const lettering = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')!
    const hand = '"Marker Felt", "Noteworthy", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive'
    context.fillStyle = '#231d12'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `bold 108px ${hand}`
    context.fillText('It’s live!', 256, 140, 480)
    context.font = `bold 80px ${hand}`
    context.fillText('scroll + click', 256, 285, 480)
    context.fillText('the screen →', 256, 390, 480)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }, [])
  useEffect(() => () => lettering.dispose(), [lettering])
  // The model's own screen and whatever is drawn on it give way to the picture drawn here.
  useLayoutEffect(() => {
    const decorations: { mesh: Object3D; visible: boolean }[] = []
    scene.traverse((mesh) => {
      if (mesh.name === 'Main_Display' || mesh.name.startsWith('Main_Display_')) {
        decorations.push({ mesh, visible: mesh.visible })
        mesh.visible = false
      }
    })
    return () => {
      decorations.forEach(({ mesh, visible }) => {
        mesh.visible = visible
      })
    }
  }, [scene])
  const clipPath = useRef('')
  useFrame(({ camera }) => {
    if (!overlay.current) return
    // Project the physical note onto the glass from this camera. The CSS hole also
    // excludes pointer hit testing, so controls under the paper cannot be clicked.
    const points = noteCorners.map((corner) => {
      const direction = corner.clone().sub(camera.position)
      const t = screen.position.clone().sub(camera.position).dot(normal) / direction.dot(normal)
      const local = camera.position.clone().addScaledVector(direction, t).applyMatrix4(screenInverse)
      // To a tenth of a pixel, so the last of the camera's settling doesn't count as a new path every frame.
      return `${((local.x / screen.width + 0.5) * width).toFixed(1)} ${((0.5 - local.y / screen.height) * height).toFixed(1)}`
    })
    const next = `path(evenodd, '${glass}M${points.join('L')}Z')`
    // Once seated the camera holds still, so most frames would write the same path again.
    if (next === clipPath.current) return
    clipPath.current = next
    overlay.current.style.clipPath = next
  })
  return (
    <>
      <mesh
        position={screen.position}
        quaternion={screen.quaternion}
        onClick={(event) => {
          // From the room, this click belongs to the desk behind it: one level at a time.
          if (!interactive) return
          event.stopPropagation()
          if (event.delta <= TAP_SLOP) onSelect()
        }}
        onPointerOver={() => {
          if (interactive) onHover(true)
        }}
        onPointerMove={() => {
          if (interactive) onHover(true)
        }}
        onPointerOut={() => onHover(false)}
      >
        <shapeGeometry
          args={[shape]}
          onUpdate={(geometry) => {
            const positions = geometry.attributes.position
            const uv = geometry.attributes.uv
            for (let i = 0; i < uv.count; i++) {
              uv.setXY(
                i,
                ((positions.getX(i) / screen.width) * (screen.width / screen.height)) / PREVIEW_ASPECT + 0.5,
                positions.getY(i) / screen.height + 0.5,
              )
            }
            uv.needsUpdate = true
          }}
        />
        <meshBasicMaterial map={preview} toneMapped={false} />
      </mesh>
      <mesh
        position={note.position}
        quaternion={note.quaternion}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <planeGeometry args={[note.width, note.height]} />
        <meshBasicMaterial map={lettering} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {seated && !mobile && (
        <Html
          transform
          position={screen.position}
          quaternion={screen.quaternion}
          distanceFactor={1}
          scale={(screen.width * 400) / width}
        >
          <div ref={overlay} style={{ position: 'relative', width, height }}>
            <ComputerFrame shown={shown} onLoad={handleLoad} />
          </div>
        </Html>
      )}
      {/* Otherwise it's offset by wherever the world's origin lands on screen. */}
      {active && mobile && (
        <Html fullscreen zIndexRange={[1000, 1000]} calculatePosition={() => [0, 0]}>
          <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh' }}>
            <ComputerFrame shown={shown} onLoad={handleLoad} phone />
          </div>
        </Html>
      )}
    </>
  )
}

export const SEATED_DISTANCE = 0.64

// Transparent until loaded, then fades in over the matching picture; fades out again on leaving.
// On phones the room hides its own controls over the site, so `exit=1` asks the site for its "Back to the room" button,
// which posts portfolio:exit like Escape does.
function ComputerFrame({ shown, onLoad, phone = false }: { shown: boolean; onLoad: () => void; phone?: boolean }) {
  return (
    <iframe
      className={shown ? `${FRAME_CLASS} screen-live-shown` : FRAME_CLASS}
      title="Projects dashboard"
      src={phone ? '/projects/index.html?embedded=1&exit=1' : '/projects/index.html?embedded=1'}
      onLoad={onLoad}
      style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0b0d10' }}
    />
  )
}
