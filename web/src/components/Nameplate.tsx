import { Html } from '@react-three/drei'

// Every label that leads to the computer says this: the desk's, the monitor's, and the desk bubble in Room.tsx.
export const PROJECTS = { label: 'Projects', blurb: 'live on this screen' } as const

// Edit the nameplates' words here. Only things that change the view when clicked get one.
export const NAMEPLATES = {
  DESK: PROJECTS,
  COMPUTER: PROJECTS,
  BOARD: { label: 'Pinboard', blurb: 'open the photos' },
}

// A small panel naming what the pointer rests on, pinned above it like the desk bubbles. It only names: the pointer
// passes through, and the view menu reaches the same places by keyboard, so screen readers skip it. A `beckon` plate
// shows without hover and glows slowly, to point first-time visitors at something.
export function Nameplate({
  position,
  label,
  blurb,
  beckon = false,
}: {
  position: readonly [number, number, number]
  label: string
  blurb: string
  beckon?: boolean
}) {
  return (
    <Html position={position} zIndexRange={[10, 0]} pointerEvents="none">
      <div className={`bubble panel-cast${beckon ? ' beckon' : ''}`} aria-hidden="true">
        <span className="panel bubble-panel nameplate">
          <span className="panel-label">{label}</span>
          <span className="bubble-blurb">{blurb}</span>
        </span>
        <span className="bubble-leader" />
      </div>
    </Html>
  )
}
