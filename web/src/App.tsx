import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Canvas } from '@react-three/fiber'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { DIORAMA_FOV } from './CameraRig'
import { Intro } from './components/Intro'
import { LoadBoundary } from './components/LoadBoundary'
import { PhoneGuide } from './components/PhoneGuide'
import { SiteLink } from './components/SiteLink'
import { Placard } from './components/Placard'
import { Room, type View } from './Room'

const VIEWS: { name: View; label: string }[] = [
  { name: 'ROOM', label: 'Room' },
  { name: 'DESK', label: 'Desk' },
  { name: 'COMPUTER', label: 'Projects' },
  { name: 'PHONE', label: 'Fitness' },
]

// Touch screens are usually phones and tablets: fewer multisampled samples keep the effects pass affordable.
const COARSE = window.matchMedia('(pointer: coarse)').matches

// What a screen reader hears when the view changes. The computer's line stands in for the monitor's sticky note.
const ANNOUNCE: Record<View | 'BOARD', string> = {
  ROOM: 'Room view.',
  DESK: 'Desk view. Choose the computer for projects, or the phone.',
  COMPUTER: 'The computer screen shows the live website. Scroll and click it, or choose Full screen.',
  PHONE: 'Phone view: two Instagram notifications.',
  BOARD: 'Pinboard view: the photos are spread out.',
}

export function App() {
  const [view, setView] = useState<View>('ROOM')
  // Entered as the room starts to appear; the intro's layer goes once the light has filled the screen.
  const [entered, setEntered] = useState(false)
  const [introGone, setIntroGone] = useState(false)
  const [seenDesk, setSeenDesk] = useState(false)
  // The pinboard's prints have separated and the camera has come close: the nearest the photos get.
  // Keyboard users reach it from the Photos button.
  const [board, setBoard] = useState(false)
  const handleEnter = useCallback(() => setEntered(true), [])
  const handleIntroDone = useCallback(() => setIntroGone(true), [])
  const nav = useRef<HTMLElement>(null)
  const show = useCallback((next: View) => {
    setView(next)
    setBoard(false)
    if (next === 'DESK' || next === 'PHONE') setSeenDesk(true)
  }, [])
  const handleSelectDesk = useCallback(() => show('DESK'), [show])
  const handleOpenBoard = useCallback(() => setBoard(true), [])

  // One level back: the board or the desk to the room, the computer or phone to the desk.
  const stepBack = useCallback(() => {
    if (board) setBoard(false)
    else if (view === 'COMPUTER' || view === 'PHONE') show('DESK')
    else if (view === 'DESK') show('ROOM')
  }, [board, view, show])

  // Leaving unmounts the computer or phone controls as it's pressed, which would drop keyboard focus to the page. Hand it to the Desk button.
  const leave = useCallback(() => {
    show('DESK')
    requestAnimationFrame(() => nav.current?.querySelector<HTMLButtonElement>('[aria-current]')?.focus({ preventScroll: true }))
  }, [show])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stepBack()
    }
    // The embedded site asks to leave. Only the site this page framed, from this origin, may.
    const message = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.type !== 'portfolio:exit' || event.data?.version !== 1) return
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Projects dashboard"]')
      if (event.source === frame?.contentWindow) leave()
    }
    window.addEventListener('keydown', key)
    window.addEventListener('message', message)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('message', message)
    }
  }, [stepBack, leave])

  return (
    <LoadBoundary>
      <main className="stage">
        {/* Not role="img" on the canvas: drei mounts the desk bubbles and the live site inside its wrapper. */}
        <p className="sr-only">
          A cozy 3D room: a developer at a corner desk with two monitors, a pinboard of photos, shelves, and a window
          showing the live sky over the New Jersey coast. The menu below reaches every view.
        </p>
        <Canvas
          // CameraRig places this every frame. The narrow lens keeps the room's diorama look.
          camera={{ fov: DIORAMA_FOV, near: 1, far: 1000, position: [0, 0, 100] }}
          // The effects pass draws the final image, so the canvas's own antialiasing would be wasted, and a dense
          // phone screen needn't render every device pixel.
          dpr={[1, 1.5]}
          gl={{ antialias: false }}
          shadows="percentage"
          // A click off the object steps back. In the computer view the page takes the clicks that matter.
          onPointerMissed={() => {
            if (view !== 'COMPUTER') stepBack()
          }}
          // Lets a test read draw calls and sample motion. Stripped from production builds.
          onCreated={({ gl, scene, camera }) => {
            if (import.meta.env.DEV) Object.assign(window, { __renderer: gl, __scene: scene, __camera: camera })
          }}
        >
          <color attach="background" args={['#0b0717']} />
          <Suspense fallback={null}>
            <Room view={view} board={board} onSelectDesk={handleSelectDesk} onOpenBoard={handleOpenBoard} onSelectComputer={() => show('COMPUTER')} onSelectPhone={() => show('PHONE')} />
          </Suspense>
          <EffectComposer multisampling={COARSE ? 2 : 4}>
            {/* Only values above the threshold glow: candle flames and bright highlights. */}
            <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1} luminanceSmoothing={0.2} />
            <ToneMapping mode={ToneMappingMode.AGX} />
            <Vignette offset={0.35} darkness={0.55} />
          </EffectComposer>
        </Canvas>
        <Placard visible={entered && view === 'ROOM' && !board} />
      </main>
      {view === 'COMPUTER' && (
        <div className="leave leave-computer">
          <SiteLink expand />
          <span className="panel-cast">
            <button className="panel leave-button" onClick={leave}>
              Leave computer
            </button>
          </span>
        </div>
      )}
      {view === 'PHONE' && (
        <div className="leave leave-phone panel-cast">
          <button className="panel leave-button" onClick={leave}>
            Put phone down
          </button>
        </div>
      )}
      <PhoneGuide visible={view === 'PHONE'} />
      {/* Inert until the room shows, so keyboard focus can't land on controls behind the intro. */}
      <nav ref={nav} className={`views${entered ? ' controls-in' : ''}`} aria-label="Camera view" inert={!entered}>
        {VIEWS.map(({ name, label }) => (
          <button key={name} aria-current={!board && view === name ? 'location' : undefined} onClick={() => show(name)}>
            {label}
          </button>
        ))}
        <button
          aria-current={board ? 'location' : undefined}
          onClick={() => {
            setView('ROOM')
            setBoard(true)
          }}
        >
          Pinboard
        </button>
        {/* At the computer it sits beside "Leave computer" instead. */}
        {view !== 'COMPUTER' && <SiteLink className="views-site" />}
      </nav>
      {entered && !seenDesk && !board && view !== 'COMPUTER' && (
        <p className="hint panel-cast">
          <span className="panel hint-panel">
            <span className="for-pointer">Click</span>
            <span className="for-touch">Tap</span> the desk to take a closer look
          </span>
        </p>
      )}
      <p className="sr-only" role="status">
        {entered ? ANNOUNCE[board ? 'BOARD' : view] : ''}
      </p>
      {/* Required by the models' CC-BY licenses. See assets/ASSET_MANIFEST.csv. */}
      <details className={`credits${entered ? ' controls-in' : ''}`} inert={!entered}>
        <summary>Credits</summary>
        <div className="panel-cast">
          <ul className="panel">
            <li>
              <a href="https://www.weather.gov/">Weather: National Weather Service (NOAA)</a>
            </li>
            <li>
              <a href="https://poly.pizza/m/heqgJSXzOX">smoothie by rafag2789 [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/w9sWcWlV9i">Protein Powder by Zsky [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/6Xu7mttjodo">Trophy by Casey Tumbers [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/bfLOqIV5uP">Houseplant by Quaternius</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/Kgt363WkKd">Flower Pot by Zsky [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/44XK5UHTd4Q">Bonsai by Don Carson [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/cQ3DYD9qBVf">boooks by Jie gu [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/aiBozYlPe--">Small Stack of Paper by Jarlan Perez [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/1WggoIFq8tx">Book Stack by Danni Bittman [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/3oFfQCSsUmQ">Keyboard by Poly by Google [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/hW11P9DDXa">Executive Chair by Zsky [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/1gB0ED5l7yy">Scented candle by Poly by Google [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/cs7k_ENAZjQ">Trainer by jeremy [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/PW9q10xh5g">Dumbbell by CreativeTrio [public domain] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/fIuM_PW5prV">Coffee cup by Poly by Google [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/95I4gsdmurO">skis by apelab [CC-BY] via Poly Pizza</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/V2Ebx3pvo4">Computer Mouse by CreativeTrio</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/1A07aI9j2d">Open Book by Quaternius</a>, modified
            </li>
            <li>
              <a href="https://poly.pizza/m/gKLBoRsyKe">Hoodie Character by Quaternius</a>, modified
            </li>
          </ul>
        </div>
      </details>
      {/* The key restarts its fade on each view change, which is how reduced motion changes views. */}
      <div key={`${view}:${board}`} className="curtain" aria-hidden="true" />
      {!introGone && <Intro onEnter={handleEnter} onDone={handleIntroDone} />}
    </LoadBoundary>
  )
}
