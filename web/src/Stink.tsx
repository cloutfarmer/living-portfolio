import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, CatmullRomCurve3, type Mesh, MeshBasicMaterial, type Object3D, TubeGeometry, Vector3 } from 'three'
import { REDUCED_MOTION } from './Life'

// Cartoon stink lines over the open gym bag, for fun: wavy ribbons that rise, sway and fade, one after another.
const LINES = 3
const LINE = { height: 0.16, wave: 0.014, waves: 2, radius: 0.0045, sides: 4, colour: '#a9d36e' }
const RISE = { seconds: 2.8, distance: 0.12, sway: 0.012, opacity: 0.55, still: 0.3 }
// Spread across the bag's opening, starting just above its top.
const SPREAD = 0.06
const LIFT = 0.02

export function Stink({ scene, visible }: { scene: Object3D; visible: boolean }) {
  const lines = useMemo(() => {
    const bag = scene.getObjectByName('Gym_bag_body')
    if (!bag) return null
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(bag)
    const centre = box.getCenter(new Vector3())
    const points = Array.from({ length: 12 }, (_, step) => {
      const share = step / 11
      return new Vector3(Math.sin(share * Math.PI * 2 * LINE.waves) * LINE.wave, share * LINE.height, 0)
    })
    const geometry = new TubeGeometry(new CatmullRomCurve3(points), 24, LINE.radius, LINE.sides, false)
    return Array.from({ length: LINES }, (_, index) => ({
      geometry,
      material: new MeshBasicMaterial({ color: LINE.colour, transparent: true, opacity: 0, depthWrite: false }),
      base: new Vector3(centre.x + (index - (LINES - 1) / 2) * SPREAD, box.max.y + LIFT, centre.z + (index % 2 ? 0.02 : -0.02)),
      offset: index / LINES,
    }))
  }, [scene])
  const meshes = useRef<(Mesh | null)[]>([])
  const clock = useRef(0)

  useFrame((_, delta) => {
    if (!lines) return
    clock.current += delta
    lines.forEach(({ material, base, offset }, index) => {
      const mesh = meshes.current[index]
      if (!mesh) return
      if (REDUCED_MOTION) {
        mesh.position.copy(base)
        material.opacity = RISE.opacity * RISE.still
        return
      }
      const share = (clock.current / RISE.seconds + offset) % 1
      mesh.position.set(base.x + Math.sin(clock.current * 1.7 + index) * RISE.sway, base.y + share * RISE.distance, base.z)
      // In over the first fifth, out over the rest.
      material.opacity = RISE.opacity * Math.min(share / 0.2, 1) * (1 - share)
    })
  })

  if (!lines) return null
  return (
    <group visible={visible}>
      {lines.map(({ geometry, material }, index) => (
        // The pointer passes through, so they never block a click on the bag or the floor behind it.
        <mesh key={index} ref={(mesh) => { meshes.current[index] = mesh }} geometry={geometry} material={material} raycast={() => null} />
      ))}
    </group>
  )
}
