import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box3, CanvasTexture, Matrix4, Quaternion, Shape, SRGBColorSpace, TextureLoader, Vector3, type Group, type Mesh } from 'three'
import previewUrl from '../assets/dashboard-preview.jpg'
import { desk } from '../desk'
import { REDUCED_MOTION } from '../Life'

// Matches .screen-live's fade in styles.css.
const SWITCH_BACK_MS = 260

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
  seated,
  closing,
  onClosed,
  interactive,
  onHover,
  onSelect,
}: {
  scene: Group
  active: boolean
  /** The camera has finished sitting down, so the switch to the live screen can begin. */
  seated: boolean
  /** The visitor has left, so the screen switches back before the camera stands. */
  closing: boolean
  onClosed: () => void
  interactive: boolean
  onHover: (hovered: boolean) => void
  onSelect: () => void
}) {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  // The live page's scrollIntoView (its "All projects" link) also scrolls the room's elements around the
  // same-origin iframe, sliding the page off the glass. Nothing holding the iframe should scroll, so undo it.
  useEffect(() => {
    const pin = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || !target.querySelector('iframe[title="Projects dashboard"]')) return
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
  const { screen, note } = useMemo(() => {
    scene.updateMatrixWorld(true)
    return {
      screen: surface(scene.getObjectByName('Main_Display') as Mesh),
      note: surface(scene.getObjectByName('Sticky_note') as Mesh),
    }
  }, [scene])
  const width = 1440
  const height = width * screen.height / screen.width
  // The glass's rounded corners live in the clip path: overflow or border-radius here stops the wheel scrolling the iframe.
  const corner = 0.008 / screen.width * width
  const arc = (x: number, y: number) => `A${corner} ${corner} 0 0 1 ${x} ${y}`
  const glass = `M${corner} 0H${width - corner}${arc(width, corner)}V${height - corner}${arc(width - corner, height)}H${corner}${arc(0, height - corner)}V${corner}${arc(corner, 0)}Z`
  const normal = useMemo(() => new Vector3(0, 0, 1).applyQuaternion(screen.quaternion), [screen])
  const screenInverse = useMemo(() => new Matrix4().compose(screen.position, screen.quaternion, new Vector3(1, 1, 1)).invert(), [screen])
  const noteCorners = useMemo(() => [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) =>
    new Vector3(x * note.width / 2, y * note.height / 2, 0).applyQuaternion(note.quaternion).add(note.position)), [note])
  const shape = useMemo(() => {
    const w = screen.width / 2, h = screen.height / 2, r = 0.008
    return new Shape().moveTo(-w + r, -h).lineTo(w - r, -h).quadraticCurveTo(w, -h, w, -h + r)
      .lineTo(w, h - r).quadraticCurveTo(w, h, w - r, h).lineTo(-w + r, h)
      .quadraticCurveTo(-w, h, -w, h - r).lineTo(-w, -h + r).quadraticCurveTo(-w, -h, -w + r, -h)
  }, [screen])
  // The sticky note tells visitors the screen is a real, live website. Handwriting fonts
  // that ship with the operating system, so nothing has to load before it's drawn.
  const lettering = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const context = canvas.getContext('2d')!
    const hand = '"Marker Felt", "Noteworthy", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive'
    context.fillStyle = '#231d12'
    context.textAlign = 'center'; context.textBaseline = 'middle'
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
  useLayoutEffect(() => {
    const resize = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', resize)
    const decorations: { mesh: import('three').Object3D; visible: boolean }[] = []
    scene.traverse(mesh => {
      if (mesh.name === 'Main_Display' || mesh.name.startsWith('Main_Display_')) {
        decorations.push({ mesh, visible: mesh.visible }); mesh.visible = false
      }
    })
    return () => {
      window.removeEventListener('resize', resize)
      decorations.forEach(({ mesh, visible }) => { mesh.visible = visible })
    }
  }, [scene])
  useFrame(({ camera }) => {
    if (!overlay.current) return
    // Project the physical note onto the glass from this camera. The CSS hole also
    // excludes pointer hit testing, so controls under the paper cannot be clicked.
    const points = noteCorners.map(corner => {
      const direction = corner.clone().sub(camera.position)
      const t = screen.position.clone().sub(camera.position).dot(normal) / direction.dot(normal)
      const local = camera.position.clone().addScaledVector(direction, t).applyMatrix4(screenInverse)
      return `${(local.x / screen.width + 0.5) * width} ${(0.5 - local.y / screen.height) * height}`
    })
    overlay.current.style.clipPath = `path(evenodd, '${glass}M${points.join('L')}Z')`
  })
  return <>
    <mesh position={screen.position} quaternion={screen.quaternion} onClick={event => {
      // From the room, this click belongs to the desk behind it: one level at a time.
      if (!interactive) return
      event.stopPropagation()
      if (event.delta < 4) onSelect()
    }} onPointerOver={() => { if (interactive) onHover(true) }} onPointerMove={() => { if (interactive) onHover(true) }} onPointerOut={() => onHover(false)}>
      <shapeGeometry args={[shape]} onUpdate={geometry => {
        const positions = geometry.attributes.position, uv = geometry.attributes.uv
        for (let i = 0; i < uv.count; i++) uv.setXY(i, positions.getX(i) / screen.width * (screen.width / screen.height) / (1440 / 883) + 0.5, positions.getY(i) / screen.height + 0.5)
        uv.needsUpdate = true
      }} />
      <meshBasicMaterial map={preview} toneMapped={false} />
    </mesh>
    <mesh position={note.position} quaternion={note.quaternion} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
      <planeGeometry args={[note.width, note.height]} />
      <meshBasicMaterial map={lettering} transparent depthWrite={false} toneMapped={false} />
    </mesh>
    {seated && !mobile &&
      <Html transform position={screen.position} quaternion={screen.quaternion} distanceFactor={1} scale={screen.width * 400 / width}>
        <div ref={overlay} style={{ position: 'relative', width, height }}>
          <ComputerFrame shown={shown} onLoad={handleLoad} />
        </div>
      </Html>}
    {/* Otherwise it's offset by wherever the world's origin lands on screen. */}
    {active && mobile && <Html fullscreen zIndexRange={[1000, 1000]} calculatePosition={() => [0, 0]}><div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh' }}><ComputerFrame shown={shown} onLoad={handleLoad} /></div></Html>}
  </>
}

export const SEATED_DISTANCE = 0.64

// Transparent until loaded, then fades in over the matching picture; fades out again on leaving.
function ComputerFrame({ shown, onLoad }: { shown: boolean; onLoad: () => void }) {
  return <iframe className={shown ? 'screen-live screen-live-shown' : 'screen-live'} title="Projects dashboard" src="/projects/index.html?embedded=1" onLoad={onLoad} style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#0b0d10' }} />
}
