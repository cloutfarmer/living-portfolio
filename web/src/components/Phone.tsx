import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, type Group, MathUtils, type Mesh, type Object3D, type PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { REDUCED_MOTION, TAP_SLOP } from '../motion'
import { skyTime } from '../weather'

type Notice = { account: string; url: string; name: string; about: string; action: string }

// Edit the notifications here. Each wake shows one from each account, never the same line twice in a row.
// Each opens its own account, and reads as Instagram's would: the account in bold, then what it did.
// `name` and `about` say who each account is, for the placard beside the phone and for screen readers.
const SIGUA = { account: 'sigua.sauce', url: 'https://www.instagram.com/sigua.sauce/', name: 'sigua.sauce', about: 'my training page' }
// The soccer team the person plays for. It's their page, not the person's.
const RONDO = { account: 'rondofootballclub', url: 'https://www.instagram.com/rondofootballclub/', name: 'Rondo FC', about: 'the soccer club I play for' }
export const ACCOUNTS = { SIGUA, RONDO }
const NOTICES: Notice[] = [
  { ...SIGUA, action: 'shared a new post.' },
  { ...SIGUA, action: 'added to their story.' },
  { ...SIGUA, action: 'posted a reel: 5-minute hip mobility for athletes' },
  { ...SIGUA, action: 'shared a new post: Strength day breakdown' },
  { ...RONDO, action: 'shared a new post: Match recap' },
  { ...RONDO, action: "added to their story: Today's lineup" },
  { ...RONDO, action: 'posted a reel: Goals from the weekend' },
]

// The page's own pixels across the glass, before it's scaled to fit the glass on screen.
const CSS_WIDTH = 360
// It's only about 45 px tall from the desk, so the click target is wider than the glass.
const REACH = 1.3
// Turns a page, which faces +Z, to lie on the phone with its top toward the earpiece.
const LYING_FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
// The first notification arrives a moment after the screen lights, and the second a beat later.
const NOTICE_DELAYS_MS = [700, 1600]
// A short buzz as it arrives. Seconds, metres, and shakes per second.
const BUZZ = { length: 0.35, reach: 0.001, rate: 30 }
const PHONE_PARTS = /^Phone(_glass|_earpiece)?$/

// The phone's time is NJ time, like the wall clock and the window.
const NJ_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })
const NJ_DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
const clockFace = (at: number) => {
  const parts = NJ_TIME.formatToParts(at)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return { time: `${part('hour')}:${part('minute')}`, date: NJ_DATE.format(at) }
}

// Each account deals its lines once, in a shuffled order, before any comes round again.
const decks = new Map<string, { deck: Notice[]; last?: Notice }>()
function nextNotice(account: string) {
  const state = decks.get(account) ?? { deck: [] }
  decks.set(account, state)
  if (!state.deck.length) {
    state.deck = NOTICES.filter((notice) => notice.account === account)
    // Fisher–Yates: every order is equally likely.
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]]
    }
    if (state.deck[0] === state.last && state.deck.length > 1) state.deck.push(state.deck.shift()!)
  }
  state.last = state.deck.shift()!
  return state.last
}

// One from each account. Rondo FC arrives first, so sigua.sauce, the person's own page, lands on top.
const nextNotices = () => [RONDO, SIGUA].map(({ account }) => nextNotice(account))

/** The glass lies flat, so its face is on local +Y, unlike the upright monitors that `surface` measures. */
export function phoneSurface(mesh: Mesh) {
  mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox! as Box3
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  center.y = box.max.y + 0.0001
  const scale = mesh.getWorldScale(new Vector3())
  return {
    position: mesh.localToWorld(center),
    quaternion: mesh.getWorldQuaternion(new Quaternion()).multiply(LYING_FLAT),
    width: size.x * scale.x,
    height: size.z * scale.z,
  }
}

function InstagramIcon() {
  return (
    <svg className="notice-icon" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="notice-icon-fill" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f6b546" />
          <stop offset="0.45" stopColor="#e2365f" />
          <stop offset="1" stopColor="#7c3fc4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#notice-icon-fill)" />
      <rect x="10" y="10" width="20" height="20" rx="6" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="4.6" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="26" cy="14" r="1.4" fill="#fff" />
    </svg>
  )
}

function LockScreen({ notices, height, onNotice }: { notices: Notice[]; height: number; onNotice: () => void }) {
  const [face, setFace] = useState(() => clockFace(skyTime()))
  // How many have arrived so far.
  const [arrived, setArrived] = useState(0)
  const first = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const tick = window.setInterval(() => {
      const next = clockFace(skyTime())
      setFace((shown) => (shown.time === next.time && shown.date === next.date ? shown : next))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [])
  useEffect(() => {
    const timers = NOTICE_DELAYS_MS.slice(0, notices.length).map((delay, index) =>
      window.setTimeout(() => setArrived(index + 1), delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [notices])
  useEffect(() => {
    if (!arrived) return
    // Only the first takes focus, so the second doesn't pull it away from a keyboard visitor.
    if (arrived === 1) first.current?.focus({ preventScroll: true })
    onNotice()
  }, [arrived, onNotice])

  return (
    // Html sits inside the element the scene listens on, so a click here would otherwise count as missing the phone.
    <div className="lock-screen" style={{ width: CSS_WIDTH, height }} onClick={(event) => event.stopPropagation()}>
      <p className="lock-date">{face.date}</p>
      <p className="lock-time">{face.time}</p>
      {/* The newest sits on top, as on a phone. The stack grows upward, so the first stays put. */}
      <div className={arrived === notices.length ? 'notice-stack notice-stack-ready' : 'notice-stack'}>
        {notices
          .slice(0, arrived)
          .map((notice, index) => (
            <a
              key={notice.account}
              ref={index === 0 ? first : undefined}
              className="phone-notification"
              href={notice.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${notice.name}, ${notice.about}, on Instagram, in a new tab`}
            >
              <InstagramIcon />
              <span className="notice-body">
                <span className="notice-head">
                  <strong>Instagram</strong>
                  <span>now</span>
                </span>
                <span className="notice-line">
                  <strong>{notice.account}</strong> {notice.action}
                </span>
              </span>
              <span className="notice-open" aria-hidden="true">
                ↗
              </span>
            </a>
          ))
          .reverse()}
      </div>
      <span className="lock-home" />
    </div>
  )
}

export function Phone({
  scene,
  interactive,
  awake,
  onHover,
  onSelect,
}: {
  scene: Group
  /** The desk view, where the phone can be picked. */
  interactive: boolean
  /** The camera has come in over it, so the screen wakes. */
  awake: boolean
  onHover: (hovered: boolean) => void
  onSelect: () => void
}) {
  const glass = useMemo(() => {
    scene.updateMatrixWorld(true)
    return phoneSurface(scene.getObjectByName('Phone_glass') as Mesh)
  }, [scene])
  const parts = useMemo(() => {
    const found: Object3D[] = []
    scene.traverse((object) => {
      if (PHONE_PARTS.test(object.name)) {
        // Survives hot reloads, so a buzz always settles back where the export put it.
        object.userData.restPosition ??= object.position.clone()
        found.push(object)
      }
    })
    return found
  }, [scene])
  const screen = useRef<Group>(null)
  const fit = useRef<HTMLDivElement>(null)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const view = useThree((state) => state.size)
  const buzzStart = useRef<number | null>(null)
  const elapsed = useRef(0)

  // Picked as the phone wakes, not on mount, so each visit deals exactly once.
  const [notices, setNotices] = useState<Notice[] | null>(null)
  useEffect(() => {
    if (awake) setNotices(nextNotices())
  }, [awake])
  const handleNotice = useCallback(() => {
    if (!REDUCED_MOTION) buzzStart.current = elapsed.current
  }, [])

  useFrame(({ clock }) => {
    elapsed.current = clock.elapsedTime
    // The camera is still closing in as the screen wakes, so the lock screen is sized to the glass every frame.
    // Centring and scaling are one transform, so the page takes taps only where it's drawn, never over the menu.
    if (fit.current) {
      const across = 2 * camera.position.distanceTo(glass.position) * Math.tan(MathUtils.degToRad(camera.fov) / 2)
      fit.current.style.transform = `translate(-50%, -50%) scale(${(glass.width * view.height) / across / CSS_WIDTH})`
    }
    if (buzzStart.current === null) return
    const age = clock.elapsedTime - buzzStart.current
    const done = age >= BUZZ.length
    const shake = done ? 0 : Math.sin(age * BUZZ.rate * Math.PI * 2) * BUZZ.reach * (1 - age / BUZZ.length)
    parts.forEach((part) => {
      part.position.copy(part.userData.restPosition as Vector3)
      part.position.x += shake
    })
    if (screen.current) screen.current.position.x = shake
    if (done) buzzStart.current = null
  })

  return (
    <>
      {interactive && (
        <mesh
          name="Phone_click_target"
          visible={false}
          position={glass.position}
          quaternion={glass.quaternion}
          onClick={(event) => {
            event.stopPropagation()
            if (event.delta <= TAP_SLOP) onSelect()
          }}
          onPointerOver={() => onHover(true)}
          onPointerMove={() => onHover(true)}
          onPointerOut={() => onHover(false)}
        >
          <planeGeometry args={[glass.width * REACH, glass.height * REACH]} />
        </mesh>
      )}
      {awake && notices && (
        <group ref={screen}>
          {/* Flat on the screen, not a CSS 3D object: the 1° lens makes drei's CSS perspective so deep that iOS Safari
              misplaces a transformed page. The camera looks straight down at the upright phone and can't turn here,
              so a flat page laid over the glass looks the same. */}
          <Html position={glass.position}>
            <div ref={fit} style={{ width: CSS_WIDTH, transform: 'translate(-50%, -50%) scale(0)' }}>
              <LockScreen notices={notices} height={(CSS_WIDTH * glass.height) / glass.width} onNotice={handleNotice} />
            </div>
          </Html>
        </group>
      )}
    </>
  )
}
