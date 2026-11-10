import { PLACE, sunPosition } from './sun'
import { describeWeather, skyTime, type Weather } from './weather'

// What the scene has really finished. The scene writes here and the loader reads it once per frame.
export const loadState = {
  roomBytes: 0,
  room: false,
  photos: false,
  corner: false,
  /** Which board leans in the corner this season, set by the room. */
  season: 'surf' as 'surf' | 'ski',
  candle: false,
  weather: null as Weather | null,
}

function sunReading() {
  const { elevation } = sunPosition(skyTime())
  return elevation > 0 ? `${Math.round(elevation)}° up` : 'below the horizon'
}

export type LoadStep = {
  id: string
  /** The share of the bar this step ends on. */
  to: number
  done: () => boolean
  /** How far through the step it really is, when that can be measured. */
  partial?: () => number
  label: () => string
  /** Milliseconds it stays up on a first visit, so it can be read. */
  hold: number
}

const HOLD = 400

export const LOAD_STEPS: LoadStep[] = [
  {
    id: 'room',
    to: 0.55,
    done: () => loadState.room,
    partial: () => loadState.roomBytes,
    label: () => 'Carrying in the furniture',
    hold: HOLD,
  },
  { id: 'photos', to: 0.63, done: () => loadState.photos, label: () => 'Hanging the photos', hold: HOLD },
  {
    id: 'corner',
    to: 0.7,
    done: () => loadState.corner,
    label: () => (loadState.season === 'ski' ? 'Leaning the skis in the corner' : 'Leaning the surfboard in the corner'),
    hold: HOLD,
  },
  { id: 'sun', to: 0.78, done: () => true, label: () => `Finding the sun over ${PLACE.name}: ${sunReading()}`, hold: HOLD },
  {
    id: 'weather',
    to: 0.88,
    done: () => loadState.weather !== null,
    label: () =>
      loadState.weather
        ? `Checking the weather in ${PLACE.name}: ${describeWeather(loadState.weather)}`
        : `Checking the weather in ${PLACE.name}`,
    hold: 800,
  },
  { id: 'candle', to: 1, done: () => loadState.candle, label: () => 'Lighting the candle', hold: HOLD },
]

// A slow forecast never keeps the visitor out. The scene takes the reading whenever it arrives.
export const WEATHER_WAIT_MS = 1500

const VISITED_KEY = 'living-portfolio:visited'

export function hasVisited() {
  try {
    return localStorage.getItem(VISITED_KEY) !== null
  } catch {
    return false
  }
}

export function markVisited() {
  try {
    localStorage.setItem(VISITED_KEY, '1')
  } catch {
    // Storage can be off in private windows. They just see the full intro again.
  }
}
