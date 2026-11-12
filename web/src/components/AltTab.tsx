import { useEffect, useState } from 'react'
import { REDUCED_MOTION } from '../motion'
import previewUrl from '../assets/dashboard-preview.jpg'
import './AltTab.css'

// PARKED: the switcher isn't mounted. The main monitor now shows the website itself, and the
// live page fades straight in (see Monitor.tsx). Kept, with the painted editor it opens from,
// for a future easter egg. To bring it back, render <AltTab editorUrl={paintEditor().toDataURL()} …>
// over the live screen in Monitor.tsx. Its styles are in AltTab.css, which ships only once this file is imported.

// What the person is working in, until the visitor switches to Projects. Each line is [text, colour] runs.
const INK = { plain: '#d8d4c8', word: '#c79be0', name: '#8fc7e8', text: '#a9cf8e', note: '#6f7a78', tag: '#e7a977' }
const EDITOR_LINES: [string, string][][] = [
  [['// The world outside this window is real.', INK.note]],
  [['const', INK.word], [' centralNJ ', INK.name], ['= { lat: ', INK.plain], ['40.4', INK.tag], [', lon: ', INK.plain], ['-74.0', INK.tag], [' }', INK.plain]],
  [],
  [['export function', INK.word], [' Room', INK.name], ['() {', INK.plain]],
  [['  const', INK.word], [' sun ', INK.name], ['= ', INK.plain], ['sunPosition', INK.name], ['(Date.', INK.plain], ['now', INK.name], ['())', INK.plain]],
  [['  const', INK.word], [' weather ', INK.name], ['= ', INK.plain], ['useWeather', INK.name], ['(centralNJ)', INK.plain]],
  [['  const', INK.word], [' daylight ', INK.name], ['= ', INK.plain], ['brightness', INK.name], ['(sun, weather)', INK.plain]],
  [],
  [['  // The sun fades the candle, but never puts it out.', INK.note]],
  [['  const', INK.word], [' candle ', INK.name], ['= Math.', INK.plain], ['max', INK.name], ['(', INK.plain], ['1', INK.tag], [' - daylight, ', INK.plain], ['0.2', INK.tag], [')', INK.plain]],
  [],
  [['  return', INK.word], [' (', INK.plain]],
  [['    <', INK.plain], ['Desk', INK.tag], [' candle', INK.name], ['={candle}>', INK.plain]],
  [['      <', INK.plain], ['Window', INK.tag], [' sun', INK.name], ['={sun}', INK.plain], [' weather', INK.name], ['={weather} />', INK.plain]],
  [['      <', INK.plain], ['Corner', INK.tag], [' season', INK.name], ['={season} />', INK.plain]],
  [['    </', INK.plain], ['Desk', INK.tag], ['>', INK.plain]],
  [['  )', INK.plain]],
  [['}', INK.plain]],
]

export function paintEditor() {
  const canvas = document.createElement('canvas')
  canvas.width = 1440
  canvas.height = 883
  const context = canvas.getContext('2d')!
  context.fillStyle = '#16191c'
  context.fillRect(0, 0, 1440, 883)
  context.fillStyle = '#1e2226'
  context.fillRect(0, 0, 1440, 52)
  context.fillStyle = '#16191c'
  context.fillRect(0, 0, 210, 52)
  context.fillStyle = '#e7a977'
  context.fillRect(0, 49, 210, 3)
  context.textBaseline = 'middle'
  context.font = '22px ui-sans-serif, system-ui, sans-serif'
  context.fillStyle = INK.plain
  context.fillText('room.tsx', 34, 26)
  context.font = '27px ui-monospace, Menlo, Consolas, monospace'
  EDITOR_LINES.forEach((line, row) => {
    const y = 92 + row * 37
    context.fillStyle = '#4c5457'
    context.textAlign = 'right'
    context.fillText(String(row + 1), 62, y)
    context.textAlign = 'left'
    let x = 96
    line.forEach(([text, color]) => {
      context.fillStyle = color
      context.fillText(text, x, y)
      x += context.measureText(text).width
    })
  })
  return canvas
}

// Milliseconds spent in each step. The first is a beat after the camera lands. Keep these in
// step with the .alt-tab transitions in styles.css.
const STEPS = { rest: 120, panel: 260, selected: 220, opening: 240, revealing: 140 }
type Step = keyof typeof STEPS | 'done'
const NEXT: Record<keyof typeof STEPS, Step> = {
  rest: 'panel',
  panel: 'selected',
  selected: 'opening',
  opening: 'revealing',
  revealing: 'done',
}

/**
 * Covers the live screen after the camera sits down: a window switcher moves from the editor to
 * Projects, and that window grows to fill the screen. It waits on the Projects tile until `ready`.
 */
export function AltTab({ editorUrl, ready, onDone }: { editorUrl: string; ready: boolean; onDone: () => void }) {
  const [step, setStep] = useState<Step>('rest')

  useEffect(() => {
    if (REDUCED_MOTION) {
      if (ready) onDone()
      return
    }
    if (step === 'done') {
      onDone()
      return
    }
    if (step === 'selected' && !ready) return
    const timer = window.setTimeout(() => setStep(NEXT[step]), STEPS[step])
    return () => window.clearTimeout(timer)
  }, [step, ready, onDone])

  const projects = step !== 'rest' && step !== 'panel'
  return (
    <div className={`alt-tab alt-tab-step-${step}`} aria-hidden="true">
      <img className="alt-tab-editor" src={editorUrl} alt="" />
      {!REDUCED_MOTION && (
        <>
          <img className="alt-tab-window" src={previewUrl} alt="" />
          <div className="alt-tab-panel">
            <div className={projects ? 'alt-tab-tile' : 'alt-tab-tile alt-tab-tile-on'}>
              <img src={editorUrl} alt="" />
            </div>
            <div className={projects ? 'alt-tab-tile alt-tab-tile-on' : 'alt-tab-tile'}>
              <img src={previewUrl} alt="" />
            </div>
            <span className="alt-tab-label">{projects ? 'Projects' : 'Editor'}</span>
          </div>
        </>
      )}
    </div>
  )
}
