import { useFrame, useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useRef } from 'react'
import { MathUtils, type PerspectiveCamera, type Sphere, Spherical, Vector3 } from 'three'
import { channel, damp, REDUCED_MOTION } from './motion'

/** Where the camera looks, described so that any two shots can blend. */
export type Shot = {
  target: Vector3
  theta: number
  phi: number
  /** World height visible at the target. */
  height: number
  /** Vertical field of view, in degrees. */
  fov: number
  /** Anything further than this in front of the target is cut away, so nearer furniture can't block the view. */
  clip: number
}

/** A lens this narrow looks almost orthographic, and widening it adds depth without changing camera. */
export const DIORAMA_FOV = 1
export const SEATED_FOV = 38

// Seconds. A shot settles in about three times its pace.
const PACE = {
  load: 0.3,
  step: 0.22,
  deeper: 0.34,
  back: 0.27,
  sit: 0.36,
  stand: 0.34,
  flyToSeat: 0.42,
  flyFromSeat: 0.36,
  lean: 0.16,
}
// Gaze leads and zoom trails, so the parts of a move overlap instead of ending together.
// Sitting lines up with the screen before closing in, so the camera passes beside the person's
// head rather than through it. Standing is the same in reverse: back out first, then turn.
const LEAD = {
  normal: { target: 0.8, angle: 1, height: 1.1, fov: 1.1 },
  sit: { target: 0.7, angle: 0.6, height: 1.1, fov: 1.3 },
  stand: { target: 1, angle: 1.3, height: 0.9, fov: 0.9 },
}
const LEAN_SHARE = 0.05
const DRIFT = { radians: 0.026, pace: 0.4 }
const PEEK = { perPixel: 0.003, theta: 0.35, phi: 0.2, holdPace: 0.08, releasePace: 0.28 }
const NEAREST_NEAR = 0.03
const SCENE_DEPTH = 14
const MAX_STEP = 0.05

const leadBetween = (from: number, to: number) => (to === 2 && from !== 2 ? LEAD.sit : from === 2 && to !== 2 ? LEAD.stand : LEAD.normal)

function paceBetween(from: number, to: number) {
  if (from === to) return PACE.step
  if (to === 2) return from === 1 ? PACE.sit : PACE.flyToSeat
  if (from === 2) return to === 1 ? PACE.stand : PACE.flyFromSeat
  return to > from ? PACE.deeper : PACE.back
}

// The goal angle's equivalent nearest to the current one, so the camera turns the short way round.
const nearestAngle = (angle: number, from: number) => from + MathUtils.euclideanModulo(angle - from + Math.PI, Math.PI * 2) - Math.PI

const logOf = (shot: Shot) => ({ height: Math.log(shot.height), fov: Math.log(shot.fov), clip: Math.log(shot.clip) })

function start(shot: Shot, height: number) {
  return {
    x: channel(shot.target.x),
    y: channel(shot.target.y),
    z: channel(shot.target.z),
    theta: channel(shot.theta),
    phi: channel(shot.phi),
    height: channel(Math.log(height)),
    fov: channel(Math.log(shot.fov)),
    clip: channel(Math.log(shot.clip)),
    driftTheta: channel(0),
    driftPhi: channel(0),
    peekTheta: channel(0),
    peekPhi: channel(0),
  }
}

/**
 * The only thing that moves the camera. Reaching `shotKey`'s shot calls onLanding just before it settles,
 * then onArrived. `depth` is the shot's level: 0 room, 1 desk, 1.25 pinboard, 1.5 phone, 2 seated.
 */
export function CameraRig({
  shot,
  shotKey,
  depth,
  lean,
  free,
  loadFrom,
  keepOut,
  motion,
  onLanding,
  onArrived,
}: {
  shot: Shot
  shotKey: string
  depth: number
  /** The shot the visitor is hovering toward, if any. */
  lean: Shot | null
  /** Whether the pointer may turn the view. */
  free: boolean
  /** Visible height to settle in from on load. */
  loadFrom: number
  /** A space the camera goes around, however it was interrupted. */
  keepOut: Sphere
  /** Screen-relative camera speed, for things that react to it. */
  motion: RefObject<number>
  onLanding: (key: string) => void
  onArrived: (key: string) => void
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const gl = useThree((state) => state.gl)
  const state = useRef(start(shot, loadFrom))
  const pace = useRef(PACE.load)
  const lead = useRef(LEAD.normal)
  const previousDepth = useRef(depth)
  const firstShot = useRef(true)
  const reported = useRef({ landed: false, arrived: false })
  const pointer = useRef({ x: 0, y: 0, dragging: false, lastX: 0, lastY: 0, peekX: 0, peekY: 0 })
  const direction = useRef(new Vector3())
  const spherical = useRef(new Spherical())
  const previous = useRef<{ x: number; y: number; z: number; theta: number; phi: number; height: number } | null>(null)
  const settled = useRef(false)

  useEffect(() => {
    if (!firstShot.current) {
      pace.current = paceBetween(previousDepth.current, depth)
      lead.current = leadBetween(previousDepth.current, depth)
    }
    firstShot.current = false
    previousDepth.current = depth
    reported.current = { landed: false, arrived: false }
    settled.current = false
  }, [shotKey, depth])

  useEffect(() => {
    if (settled.current) pace.current = PACE.lean
  }, [lean])

  useEffect(() => {
    if (REDUCED_MOTION) return
    const canvas = gl.domElement
    canvas.style.touchAction = 'none'
    const down = (event: PointerEvent) => {
      Object.assign(pointer.current, { dragging: true, lastX: event.clientX, lastY: event.clientY })
    }
    const move = (event: PointerEvent) => {
      const p = pointer.current
      p.x = (event.clientX / window.innerWidth) * 2 - 1
      p.y = (event.clientY / window.innerHeight) * 2 - 1
      if (!p.dragging) return
      p.peekX += event.clientX - p.lastX
      p.peekY += event.clientY - p.lastY
      p.lastX = event.clientX
      p.lastY = event.clientY
    }
    const up = () => {
      Object.assign(pointer.current, { dragging: false, peekX: 0, peekY: 0 })
    }
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  // Runs ahead of everything that reads the camera this frame.
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, MAX_STEP)
    const s = state.current
    const logs = logOf(shot)
    const leaning = lean && !REDUCED_MOTION ? lean : null
    const share = leaning ? LEAN_SHARE : 0
    const towardTheta = leaning ? nearestAngle(leaning.theta, shot.theta) : shot.theta
    const goal = {
      x: MathUtils.lerp(shot.target.x, leaning?.target.x ?? 0, share),
      y: MathUtils.lerp(shot.target.y, leaning?.target.y ?? 0, share),
      z: MathUtils.lerp(shot.target.z, leaning?.target.z ?? 0, share),
      theta: nearestAngle(MathUtils.lerp(shot.theta, towardTheta, share), s.theta.value),
      phi: MathUtils.lerp(shot.phi, leaning?.phi ?? 0, share),
      height: MathUtils.lerp(logs.height, leaning ? Math.log(leaning.height) : 0, share),
    }

    if (REDUCED_MOTION) {
      s.x.value = goal.x
      s.y.value = goal.y
      s.z.value = goal.z
      s.theta.value = goal.theta
      s.phi.value = goal.phi
      s.height.value = goal.height
      s.fov.value = logs.fov
      s.clip.value = logs.clip
    } else {
      const t = pace.current
      const parts = lead.current
      damp(s.x, goal.x, t * parts.target, delta)
      damp(s.y, goal.y, t * parts.target, delta)
      damp(s.z, goal.z, t * parts.target, delta)
      damp(s.theta, goal.theta, t * parts.angle, delta)
      damp(s.phi, goal.phi, t * parts.angle, delta)
      damp(s.height, goal.height, t * parts.height, delta)
      damp(s.fov, logs.fov, t * parts.fov, delta)
      damp(s.clip, logs.clip, t, delta)

      const p = pointer.current
      damp(s.driftTheta, free ? -p.x * DRIFT.radians : 0, DRIFT.pace, delta)
      damp(s.driftPhi, free ? -p.y * DRIFT.radians : 0, DRIFT.pace, delta)
      // Tanh eases into the limit instead of stopping dead at it.
      const peekPace = p.dragging ? PEEK.holdPace : PEEK.releasePace
      const peekTheta = free ? PEEK.theta * Math.tanh((-p.peekX * PEEK.perPixel) / PEEK.theta) : 0
      const peekPhi = free ? PEEK.phi * Math.tanh((-p.peekY * PEEK.perPixel) / PEEK.phi) : 0
      damp(s.peekTheta, peekTheta, peekPace, delta)
      damp(s.peekPhi, peekPhi, peekPace, delta)
    }

    const height = Math.exp(s.height.value)
    const fov = Math.exp(s.fov.value)
    const distance = height / (2 * Math.tan(MathUtils.degToRad(fov) / 2))
    const dir = direction.current.setFromSpherical(
      spherical.current.set(
        1,
        MathUtils.clamp(s.phi.value + s.driftPhi.value + s.peekPhi.value, 0.01, Math.PI - 0.01),
        s.theta.value + s.driftTheta.value + s.peekTheta.value,
      ),
    )
    camera.position.set(s.x.value, s.y.value, s.z.value).addScaledVector(dir, distance)
    const inside = camera.position.distanceTo(keepOut.center)
    if (inside < keepOut.radius && inside > 0) {
      camera.position.sub(keepOut.center).multiplyScalar(keepOut.radius / inside).add(keepOut.center)
    }
    camera.fov = fov
    camera.near = Math.max(NEAREST_NEAR, distance - Math.exp(s.clip.value))
    camera.far = distance + SCENE_DEPTH
    camera.lookAt(s.x.value, s.y.value, s.z.value)
    camera.updateProjectionMatrix()

    const last = previous.current
    if (last && delta > 0) {
      const screens = Math.hypot(s.x.value - last.x, s.y.value - last.y, s.z.value - last.z) / height
      const turned = Math.hypot(s.theta.value - last.theta, s.phi.value - last.phi)
      motion.current = (screens + turned + Math.abs(s.height.value - last.height)) / delta
    }
    previous.current = { x: s.x.value, y: s.y.value, z: s.z.value, theta: s.theta.value, phi: s.phi.value, height: s.height.value }

    const off = Math.hypot(s.x.value - goal.x, s.y.value - goal.y, s.z.value - goal.z) / height
    const turn = Math.hypot(s.theta.value - goal.theta, s.phi.value - goal.phi)
    const scale = Math.abs(s.height.value - goal.height)
    const lens = Math.abs(s.fov.value - logs.fov)
    // The lens's last stretch barely changes the picture, because the framing at the target holds still.
    if (!reported.current.landed && off < 0.05 && turn < 0.06 && scale < 0.08 && lens < 0.25) {
      reported.current.landed = true
      onLanding(shotKey)
    }
    if (!reported.current.arrived && off < 0.004 && turn < 0.004 && scale < 0.01 && lens < 0.12) {
      reported.current.arrived = true
      settled.current = true
      onArrived(shotKey)
    }
  }, -2)

  return null
}
