import { useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { type MutableRefObject, useMemo, useRef, useState } from 'react'
import { Box3, IcosahedronGeometry, MathUtils, type Mesh, MeshBasicMaterial, type Object3D, Vector3 } from 'three'
import { REDUCED_MOTION } from './Life'

// Small things to do in the room that lead nowhere: blow out the candle, tilt the blinds. They get the pointer cursor but
// no nameplate: only things that change the view get one.
// Room.tsx reads `candle` (1 lit, 0 out) and `shut` (0 open, 1 closed) every frame to set its lights.

// Out in a breath, then it relights itself with a little flicker.
const CANDLE = { out: 0.25, dark: 4.5, relight: 0.7 }
const SMOKE = { puffs: 7, spacing: 0.12, seconds: 2.4, rise: 0.11, drift: 0.02, size: 0.012, grow: 3, opacity: 0.5 }
const BLINDS = { seconds: 0.6 }
// Names of the parts that take these clicks. The desk's own click target lets them through.
export const REACTIVE = /^(Candle_hit|Blinds_hit)$/

export type Reacting = { candle: MutableRefObject<number>; shut: MutableRefObject<number> }

function boundsOf(scene: Object3D, test: (object: Object3D) => boolean) {
  const box = new Box3()
  scene.updateMatrixWorld(true)
  scene.traverse((object) => {
    if ((object as Mesh).isMesh && test(object)) box.expandByObject(object)
  })
  return box
}

export function Reactions({ scene, interactive, candle, shut, onHover }: { scene: Object3D; interactive: boolean; onHover: (hovered: boolean) => void } & Reacting) {
  const gl = useThree((state) => state.gl)
  const parts = useMemo(() => {
    const flames: Mesh[] = []
    let slats: Mesh | undefined
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      if (/^Flame/.test(mesh.name)) flames.push(mesh)
      if (mesh.name === 'Blind_slats') slats = mesh
    })
    const candleBox = boundsOf(scene, (object) => /^(Candle_|Flame)/.test(object.name)).expandByScalar(0.01)
    const blindsBox = boundsOf(scene, (object) => object.name === 'Blind_slats').expandByScalar(0.01)
    const flameTop = new Vector3(candleBox.getCenter(new Vector3()).x, candleBox.max.y, candleBox.getCenter(new Vector3()).z)
    return { flames, slats, candleBox, blindsBox, flameTop }
  }, [scene])
  const puffs = useMemo(() => {
    const geometry = new IcosahedronGeometry(1, 0)
    return Array.from({ length: SMOKE.puffs }, () => new MeshBasicMaterial({ color: '#9a958f', transparent: true, opacity: 0, depthWrite: false }))
      .map((material) => ({ geometry, material }))
  }, [])
  const smoke = useRef<(Mesh | null)[]>([])
  const state = useRef({ outAt: -1, shutTarget: 0, clock: 0 })
  const [hovered, setHovered] = useState<'candle' | 'blinds' | null>(null)
  useCursor(interactive && hovered !== null)

  useFrame((_, delta) => {
    const s = state.current
    s.clock += delta
    // The candle: out quickly, dark for a while, then back with a flicker.
    const since = s.outAt < 0 ? Infinity : s.clock - s.outAt
    if (REDUCED_MOTION) {
      candle.current = since < CANDLE.dark ? 0 : 1
    } else if (since < CANDLE.dark) {
      candle.current = Math.max(0, 1 - since / CANDLE.out)
    } else {
      const back = (since - CANDLE.dark) / CANDLE.relight
      candle.current = back >= 1 ? 1 : Math.min(1, back) * (0.75 + 0.25 * Math.sin(back * 40))
    }
    if (since >= CANDLE.dark + CANDLE.relight) s.outAt = -1
    parts.flames.forEach((flame) => { flame.visible = candle.current > 0.05 })

    smoke.current.forEach((puff, index) => {
      if (!puff) return
      const age = since - index * SMOKE.spacing
      const material = puff.material as MeshBasicMaterial
      if (REDUCED_MOTION || age < 0 || age > SMOKE.seconds) {
        material.opacity = 0
        puff.visible = false
        return
      }
      const share = age / SMOKE.seconds
      puff.visible = true
      puff.position.set(
        parts.flameTop.x + Math.sin(age * 3 + index) * SMOKE.drift * share,
        parts.flameTop.y + age * SMOKE.rise,
        parts.flameTop.z + Math.cos(age * 2 + index) * SMOKE.drift * share,
      )
      puff.scale.setScalar(SMOKE.size * (1 + SMOKE.grow * share))
      puff.rotation.set(age, age * 0.7, 0)
      material.opacity = SMOKE.opacity * Math.sin(Math.PI * Math.min(1, share * 1.4)) * (1 - share)
    })

    // The blinds ease toward their target, redrawing shadows on the way so the sun's stripes turn with the slats.
    const slats = parts.slats
    if (slats?.morphTargetInfluences) {
      const now = slats.morphTargetInfluences[0]
      const next = REDUCED_MOTION ? s.shutTarget : MathUtils.damp(now, s.shutTarget, 6 / BLINDS.seconds, delta)
      if (Math.abs(next - now) > 1e-4) {
        slats.morphTargetInfluences[0] = Math.abs(next - s.shutTarget) < 1e-3 ? s.shutTarget : next
        gl.shadowMap.needsUpdate = true
      }
      shut.current = slats.morphTargetInfluences[0]
    }
  })

  const hover = (part: 'candle' | 'blinds') => ({
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      if (!interactive) return
      setHovered(part)
      onHover(true)
    },
    onPointerOut: () => {
      setHovered((current) => (current === part ? null : current))
      onHover(false)
    },
  })

  return (
    <>
      <mesh
        name="Candle_hit"
        visible={false}
        position={parts.candleBox.getCenter(new Vector3())}
        onClick={(event) => {
          if (!interactive || event.delta > 4) return
          event.stopPropagation()
          if (state.current.outAt < 0) state.current.outAt = state.current.clock
        }}
        {...hover('candle')}
      >
        <boxGeometry args={parts.candleBox.getSize(new Vector3()).toArray()} />
      </mesh>
      {parts.slats && (
        <mesh
          name="Blinds_hit"
          visible={false}
          position={parts.blindsBox.getCenter(new Vector3())}
          onClick={(event) => {
            if (!interactive || event.delta > 4) return
            event.stopPropagation()
            state.current.shutTarget = state.current.shutTarget > 0.5 ? 0 : 1
          }}
          {...hover('blinds')}
        >
          <boxGeometry args={parts.blindsBox.getSize(new Vector3()).toArray()} />
        </mesh>
      )}
      {puffs.map(({ geometry, material }, index) => (
        <mesh key={index} ref={(mesh) => { smoke.current[index] = mesh }} geometry={geometry} material={material} visible={false} />
      ))}
    </>
  )
}
