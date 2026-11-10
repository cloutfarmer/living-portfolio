import { Html } from '@react-three/drei'

// Edit the nameplates' words here. Only things that change the view when clicked get one.
export const NAMEPLATES = {
  DESK: { label: 'Desk', blurb: 'take a closer look' },
  BOARD: { label: 'Pinboard', blurb: 'open the photos' },
}

// A small panel naming what the pointer rests on, pinned above it like the desk bubbles. It only names: the pointer
// passes through, and the view menu reaches the same places by keyboard, so screen readers skip it.
export function Nameplate({ position, label, blurb }: { position: readonly [number, number, number]; label: string; blurb: string }) {
  return (
    <Html position={position} zIndexRange={[10, 0]} pointerEvents="none">
      <div className="bubble panel-cast" aria-hidden="true">
        <span className="panel bubble-panel nameplate">
          <span className="panel-label">{label}</span>
          <span className="bubble-blurb">{blurb}</span>
        </span>
        <span className="bubble-leader" />
      </div>
    </Html>
  )
}
