// What's happening at the desk, shared between the person (Life.tsx), the right monitor's
// vim screen (VimScreen.tsx) and the main monitor (Monitor.tsx) without threading props
// through Room.tsx. Plain mutable state, read and written inside useFrame.
export const desk = {
  /** 0 while the person pauses to think, up to 1 mid-burst. Written by Life every frame. */
  typing: 0,
  /** Which monitor the person faces: the vim screen while working, the main one when the visitor sits down. */
  focus: 'right' as 'right' | 'main',
}
