import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { Canvas } from '@react-three/fiber'
import { ToneMappingMode } from 'postprocessing'
import { Component, type ReactNode, Suspense, useCallback, useEffect, useState } from 'react'
import { DIORAMA_FOV } from './CameraRig'
import { Intro } from './components/Intro'
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

class LoadBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <p className="message">
        Could not load the scene ({this.state.error.message}). Run npm run export-scene, then reload.
      </p>
    )
  }
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
  const show =useCallback((next: View) => {
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

  useEffect(() => {
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')stepBack()};
    const message=(event:MessageEvent)=>{if(event.origin!==location.origin||event.data?.type!=='portfolio:exit'||event.data?.version!==1)return;const frame=document.querySelector<HTMLIFrameElement>('iframe[title="Projects dashboard"]');if(event.source===frame?.contentWindow)show('DESK')};
    window.addEventListener('keydown',key);window.addEventListener('message',message);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('message',message)};
  },[stepBack,show]);
  return (
    <LoadBoundary>
      <Canvas
        // CameraRig places this every frame. The narrow lens keeps the room's diorama look.
        camera={{ fov: DIORAMA_FOV, near: 1, far: 1000, position: [0, 0, 100] }}
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
        <EffectComposer>
          {/* Only values above the threshold glow: candle flames and bright highlights. */}
          <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1} luminanceSmoothing={0.2} />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette offset={0.35} darkness={0.55} />
        </EffectComposer>
      </Canvas>
      {view === 'COMPUTER' && (
        <div className="leave leave-computer">
          <SiteLink expand />
          <span className="panel-cast">
            <button className="panel leave-button" onClick={() => show('DESK')}>
              Leave computer
            </button>
          </span>
        </div>
      )}
      {view === 'PHONE' && (
        <div className="leave leave-phone panel-cast">
          <button className="panel leave-button" onClick={() => show('DESK')}>
            Put phone down
          </button>
        </div>
      )}
      <Placard visible={entered && view === 'ROOM' && !board} />
      <PhoneGuide visible={view === 'PHONE'} />
      {/* Inert until the room shows, so keyboard focus can't land on controls behind the intro. */}
      <nav className={`views${entered ? ' controls-in' : ''}`} aria-label="Camera view" inert={!entered}>
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
          <span className="panel hint-panel">Click the desk to take a closer look</span>
        </p>
      )}
      {/* The monitor's sticky note says the screen is live; this says it to screen readers. */}
      {view === 'COMPUTER' && (
        <p className="sr-only" role="status">
          The computer screen shows the live website. Scroll and click it, or choose Full screen.
        </p>
      )}
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
