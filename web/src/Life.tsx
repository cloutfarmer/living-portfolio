import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { type Group, MathUtils, type Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three'
import { VimScreen } from './components/VimScreen'
import { desk } from './desk'
import { skyTime } from './weather'

export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// How far a press may move, in pixels, and still count as a click rather than a drag to look around. Fingers wobble.
export const TAP_SLOP = window.matchMedia('(pointer: coarse)').matches ? 10 : 4

// On the back wall above the open space, clear of the shelf and the window.
const CLOCK_POSITION: [number, number, number] = [-0.35, 2.3, -1.59]
const PHONE_PING_EVERY_SECONDS = 19
// For each hand, in the bursts of typing.
const KEYSTROKES_PER_SECOND = 5

const worldPosition = (object?: Object3D) => object?.getWorldPosition(new Vector3()) ?? new Vector3()

// Originals survive hot reloads, because animation overwrites transforms every frame.
function rest(object: Object3D) {
  object.userData.restPosition ??= object.position.clone()
  object.userData.restRotationY ??= object.rotation.y
  object.userData.restRotationX ??= object.rotation.x
  object.userData.restScale ??= object.scale.clone()
  return {
    position: object.userData.restPosition as Vector3,
    scale: object.userData.restScale as Vector3,
    rotationY: object.userData.restRotationY as number,
    rotationX: object.userData.restRotationX as number,
  }
}

const NJ_TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' })

// Shows the time in NJ, as the window does, ticking once a second.
function WallClock() {
  const hour = useRef<Group>(null)
  const minute = useRef<Group>(null)
  const second = useRef<Group>(null)
  const shown = useRef(0)

  useFrame(() => {
    const now = Math.floor(skyTime() / 1000)
    if (now === shown.current) return
    shown.current = now
    const part = (type: string) => Number(NJ_TIME.formatToParts(now * 1000).find((item) => item.type === type)?.value)
    const seconds = part('second')
    const minutes = part('minute') + seconds / 60
    const hours = (part('hour') % 12) + minutes / 60
    if (hour.current) hour.current.rotation.z = (-hours / 12) * Math.PI * 2
    if (minute.current) minute.current.rotation.z = (-minutes / 60) * Math.PI * 2
    if (second.current) second.current.rotation.z = (-seconds / 60) * Math.PI * 2
  })

  const hand = (length: number, width: number, color: string, z: number) => (
    <mesh position={[0, length / 2 - 0.02, z]}>
      <boxGeometry args={[width, length, 0.006]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )

  return (
    <group position={CLOCK_POSITION} scale={0.64}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 48]} />
        <meshStandardMaterial color="#2a211c" roughness={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.022]}>
        <cylinderGeometry args={[0.215, 0.215, 0.022, 48]} />
        <meshStandardMaterial color="#d8cdb8" roughness={0.85} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} rotation={[0, 0, (i / 12) * Math.PI * 2]}>
          <mesh position={[0, 0.185, 0.035]}>
            <boxGeometry args={[i % 3 ? 0.006 : 0.012, i % 3 ? 0.02 : 0.034, 0.003]} />
            <meshStandardMaterial color="#3a2f28" />
          </mesh>
        </group>
      ))}
      <group ref={hour}>{hand(0.115, 0.014, '#2a211c', 0.04)}</group>
      <group ref={minute}>{hand(0.165, 0.009, '#2a211c', 0.046)}</group>
      <group ref={second}>{hand(0.175, 0.004, '#a8452e', 0.052)}</group>
    </group>
  )
}

// The person looks up at the visitor. Turn and lift are radians; the rest are seconds.
const GLANCE = { turn: -0.85, lift: -0.15, rise: 0.35, hold: 0.8, fall: 0.5 }

function glanceAmount(age: number) {
  if (age < 0) return 0
  const { rise, hold, fall } = GLANCE
  if (age < rise) return MathUtils.smoothstep(age, 0, rise)
  if (age < rise + hold) return 1
  return 1 - MathUtils.smoothstep(age, rise + hold, rise + hold + fall)
}

export function Life({ scene, glance }: { scene: Object3D; glance: number }) {
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const named = (pattern: RegExp) => {
      const found: Mesh[] = []
      scene.traverse((object) => {
        if (pattern.test(object.name)) found.push(object as Mesh)
      })
      return found
    }

    const phone = named(/^Phone_glass$/)[0]
    if (phone && !phone.userData.ownMaterial) {
      // Cloned so that the notification lights only the phone.
      phone.material = (phone.material as MeshStandardMaterial).clone()
      phone.userData.ownMaterial = true
    }
    let pcGlow: MeshStandardMaterial | undefined
    scene.traverse((object) => {
      const material = (object as Mesh).material as MeshStandardMaterial | undefined
      if (material?.name === 'PC_teal_glow') pcGlow = material
    })
    if (pcGlow) pcGlow.userData.restGlow ??= pcGlow.emissiveIntensity

    const mainScreen = worldPosition(named(/^Main_Display$/)[0])
    const rightScreen = worldPosition(named(/^Right_Display$/)[0])
    // The vim screen replaces the right monitor's old placeholder header and lines.
    named(/^Right_Display_(line|header)/).forEach((part) => (part.visible = false))
    // How far the head turns, around the vertical, to face the right monitor instead of the main one.
    const headAt = worldPosition(named(/^Head$/)[0])
    const yawTo = (target: Vector3) => Math.atan2(target.x - headAt.x, target.z - headAt.z)
    const towardRight = MathUtils.euclideanModulo(yawTo(rightScreen) - yawTo(mainScreen) + Math.PI, Math.PI * 2) - Math.PI
    return {
      body: named(/^Body$/)[0],
      head: named(/^(Head|Hair)$/),
      hands: named(/^Hand/),
      towardRight,
      phone: phone?.material as MeshStandardMaterial | undefined,
      pcGlow,
      screenGlow: mainScreen.add(rightScreen).multiplyScalar(0.5).add(new Vector3(0, -0.1, 0.45)),
    }
  }, [scene])

  const typingAmount = useRef(0)
  // 1 facing the right monitor, 0 facing the main one; eased toward desk.focus.
  const facingRight = useRef(desk.focus === 'right' ? 1 : 0)
  const glanceSeen = useRef(glance)
  const glanceStart = useRef(-Infinity)

  useFrame(({ clock }, delta) => {
    if (REDUCED_MOTION) {
      // Still, but at work: the head rests turned to the vim screen, or to the main one at the computer.
      const turn = desk.focus === 'right' ? parts.towardRight : 0
      parts.head.forEach((part) => (part.rotation.y = rest(part).rotationY + turn))
      return
    }
    const t = clock.elapsedTime

    // Bursts of typing broken up by pauses to think.
    const isTyping = Math.sin(t * 0.7) + Math.sin(t * 0.31 + 1) > -0.5
    typingAmount.current += ((isTyping ? 1 : 0) - typingAmount.current) * Math.min(delta * 5, 1)
    const typing = typingAmount.current
    desk.typing = typing
    // About 0.6 s to turn between monitors.
    facingRight.current = MathUtils.damp(facingRight.current, desk.focus === 'right' ? 1 : 0, 6, delta)

    parts.hands.forEach((hand, index) => {
      const press = Math.abs(Math.sin(t * (11 + index * 1.7) + index * 2)) * 0.002 * typing
      hand.position.y = rest(hand).position.y + press
      // One finger at a time lifts off its key and comes back down. Morph targets add no draw calls.
      const influences = hand.morphTargetInfluences
      if (!influences) return
      const beat = t * (KEYSTROKES_PER_SECOND + index * 0.7) + index * 5
      const stroke = Math.floor(beat)
      const finger = Math.floor(MathUtils.seededRandom(stroke + index * 1000) * influences.length)
      influences.fill(0)
      influences[finger] = Math.sin((beat - stroke) * Math.PI) * typing
    })

    if (glance !== glanceSeen.current) {
      glanceSeen.current = glance
      glanceStart.current = t
    }
    const glancing = glanceAmount(t - glanceStart.current)

    const breath = Math.sin(t * 1.5)
    if (parts.body) parts.body.scale.y = rest(parts.body).scale.y * (1 + breath * 0.012)
    parts.head.forEach((part) => {
      const base = rest(part)
      part.position.y = base.position.y + breath * 0.004
      // Lifts the head slightly during pauses, as if reading back what was typed.
      part.rotation.x = base.rotationX + (1 - typing) * -0.05 + glancing * GLANCE.lift
      part.rotation.y = base.rotationY + facingRight.current * parts.towardRight + Math.sin(t * 0.23) * 0.05 + glancing * GLANCE.turn
    })

    if (parts.pcGlow) {
      parts.pcGlow.emissiveIntensity = parts.pcGlow.userData.restGlow * (1 + Math.sin(t * 0.8) * 0.2)
    }
    if (parts.phone) {
      const sinceStart = t % PHONE_PING_EVERY_SECONDS
      const glow = sinceStart < 3 ? Math.sin((sinceStart / 3) * Math.PI) : 0
      parts.phone.emissive.set('#bcd8ff')
      parts.phone.emissiveIntensity = glow * 1.1
    }
  })

  return (
    <>
      <pointLight position={parts.screenGlow} color="#9fdce0" intensity={0.22} distance={2.4} decay={2} />
      <WallClock />
      <VimScreen scene={scene} />
    </>
  )
}
