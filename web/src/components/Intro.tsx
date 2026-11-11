import { type CSSProperties, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { REDUCED_MOTION } from '../Life'
import { hasVisited, LOAD_STEPS, loadState, markVisited, WEATHER_WAIT_MS } from '../loading'

const STALL_MS = 100
const FILL_RATE = 6
const SKIP_RATE = 14
const SWELL_MS = 300
const OPEN_MS = 1400
const FADE_MS = 250
// How far the edge of the light spreads, from fully lit to full dark.
const LIGHT_EDGE = 220
const NOT_A_SKIP = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta'])

// The title is the progress bar: each letter lights in reading order. Words don't break inside, so on a phone the
// second line lights after the first.
const TITLE = 'The Living Portfolio'
let letterCount = 0
const WORDS = TITLE.split(' ').map((word) => [...word].map((letter) => ({ letter, index: letterCount++ })))
const TITLE_STYLE = { '--n': letterCount } as CSSProperties

// index.html's plain copies of the name and title began their rise with the page, so these pick each
// animation up where it is (a negative delay) rather than starting over.
function riseStart() {
  return document.getElementById('intro-static') ? performance.now() / 1000 : null
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

// The name shows from the first paint, and light fills the title as the room loads. When it's full, the title
// glows once and the room opens outward from it.
export function Intro({ onEnter, onDone }: { onEnter: () => void; onDone: () => void }) {
  const layer = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const meter = useRef<HTMLDivElement>(null)
  const [returning] = useState(hasVisited)
  const [status, setStatus] = useState(LOAD_STEPS[0].label())
  const [leaving, setLeaving] = useState(false)
  const [risen] = useState(riseStart)
  const rise = (delay: number): CSSProperties | undefined =>
    risen === null ? undefined : { animationDelay: `${delay - risen}s` }

  // Swap index.html's plain copy for this one before paint.
  useLayoutEffect(() => {
    document.getElementById('intro-static')?.remove()
  }, [])

  useEffect(() => {
    let skipped = returning
    let index = 0
    let stepStart = performance.now()
    let previous = stepStart
    let shown = 0
    let percent = -1
    let sawReading = false
    let phase: 'fill' | 'swell' | 'open' = 'fill'
    let phaseStart = 0
    let raf = 0
    let timer = 0
    let centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

    const skip = (event: Event) => {
      if (event instanceof KeyboardEvent && NOT_A_SKIP.has(event.key)) return
      skipped = true
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)

    const advance = (now: number) => {
      while (index < LOAD_STEPS.length) {
        const step = LOAD_STEPS[index]
        const isWeather = step.id === 'weather'
        if (isWeather && loadState.weather && !sawReading) {
          // The reading is the line worth reading, so it gets its full time on screen.
          sawReading = true
          stepStart = now
        }
        const ready = step.done() || (isWeather && (skipped || now - stepStart >= WEATHER_WAIT_MS))
        if (!ready || (!skipped && now - stepStart < step.hold)) break
        index += 1
        stepStart = now
      }
    }

    const realProgress = () => {
      if (index >= LOAD_STEPS.length) return 1
      const step = LOAD_STEPS[index]
      const from = index === 0 ? 0 : LOAD_STEPS[index - 1].to
      const within = step.done() ? 1 : (step.partial?.() ?? 0)
      return from + (step.to - from) * within
    }

    // The light opens from the middle of the words.
    const open = (now: number) => {
      const box = title.current?.getBoundingClientRect()
      if (box) centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
      phase = 'open'
      phaseStart = now
      markVisited()
      setLeaving(true)
      onEnter()
    }

    const tick = (now: number) => {
      const seconds = Math.min((now - previous) / 1000, 0.1)
      // Nothing can be read during a long frame, so it doesn't count toward a status's time on screen.
      if (now - previous > STALL_MS) stepStart += now - previous
      previous = now
      raf = requestAnimationFrame(tick)

      if (phase === 'fill') {
        advance(now)
        const target = realProgress()
        if (REDUCED_MOTION || returning) shown = target
        else shown += (target - shown) * (1 - Math.exp(-seconds * (skipped ? SKIP_RATE : FILL_RATE)))
        if (target === 1 && shown > 0.998) shown = 1
        setStatus(LOAD_STEPS[Math.min(index, LOAD_STEPS.length - 1)].label())

        const nextPercent = Math.round(shown * 100)
        if (nextPercent !== percent) {
          percent = nextPercent
          meter.current?.setAttribute('aria-valuenow', `${percent}`)
        }
        title.current?.style.setProperty('--p', shown.toFixed(4))

        if (shown === 1 && index >= LOAD_STEPS.length) {
          if (REDUCED_MOTION) {
            cancelAnimationFrame(raf)
            markVisited()
            setLeaving(true)
            onEnter()
            timer = window.setTimeout(onDone, FADE_MS)
          } else if (returning) {
            open(now)
          } else {
            phase = 'swell'
            phaseStart = now
            title.current?.classList.add('intro-swell')
          }
        }
        return
      }

      if (phase === 'swell') {
        if (now - phaseStart >= SWELL_MS) open(now)
        return
      }

      const t = Math.min((now - phaseStart) / OPEN_MS, 1)
      const reach = Math.hypot(window.innerWidth, window.innerHeight) + LIGHT_EDGE
      const radius = -LIGHT_EDGE + (reach + LIGHT_EDGE) * easeInOut(t)
      if (layer.current) {
        layer.current.style.background =
          `radial-gradient(circle at ${centre.x}px ${centre.y}px, transparent ${radius}px, ` +
          `#e7a97730 ${radius + LIGHT_EDGE * 0.3}px, #0b0717 ${radius + LIGHT_EDGE}px)`
      }
      if (t === 1) {
        cancelAnimationFrame(raf)
        onDone()
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [returning, onEnter, onDone])

  return (
    <div
      ref={layer}
      className={`intro${leaving ? ' intro-leaving' : ''}${returning ? ' intro-returning' : ''}`}
    >
      <div className="intro-words">
        <div className="intro-centre">
          {/* The placard holds the page's real heading. Matches index.html's plain copy. */}
          <div ref={title} className="intro-title" aria-hidden="true" style={rise(0)}>
            <span className="intro-name">Alex Sigua · Software Engineer</span>
            <span className="intro-work" style={TITLE_STYLE}>
              {WORDS.map((letters, word) => (
                <Fragment key={word}>
                  {word > 0 && ' '}
                  <span className="intro-word">
                    {letters.map(({ letter, index }) => (
                      <span key={index} className="intro-letter" style={{ '--i': index } as CSSProperties}>
                        {letter}
                      </span>
                    ))}
                  </span>
                </Fragment>
              ))}
            </span>
          </div>
          <div ref={meter} role="progressbar" aria-label="Loading the room" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} />
          <p className="intro-status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  )
}
