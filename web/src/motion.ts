// Constants and spring maths shared across the scene. They live apart from the components so that importing one
// never pulls in a component, which once made import cycles.

export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// How far a press may move, in pixels, and still count as a click rather than a drag to look around. Fingers wobble.
export const TAP_SLOP = window.matchMedia('(pointer: coarse)').matches ? 10 : 4

export type Channel = { value: number; velocity: number }

export const channel = (value: number): Channel => ({ value, velocity: 0 })

// Critically damped spring. Velocity carries over, so a new goal bends the path instead of restarting it.
export function damp(state: Channel, goal: number, pace: number, delta: number) {
  const omega = 2 / pace
  const x = omega * delta
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = state.value - goal
  const carried = (state.velocity + omega * change) * delta
  state.velocity = (state.velocity - omega * carried) * decay
  state.value = goal + (change + carried) * decay
}
