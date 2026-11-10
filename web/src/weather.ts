// Live conditions near the room, from the National Weather Service (public domain; credited in App.tsx). No key, no backend.

export type Weather = {
  cloud: number
  rain: number
  snow: number
  fog: number
  storm: number
  // km/h, and the compass direction it blows from.
  windSpeed: number
  windDirection: number
  snowLying: number
}

export const CLEAR: Weather = { cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0, windSpeed: 8, windDirection: 200, snowLying: 0 }

export const PRESETS: Record<string, Weather> = {
  clear: CLEAR,
  overcast: { ...CLEAR, cloud: 1, windSpeed: 14 },
  rain: { ...CLEAR, cloud: 1, rain: 0.8, windSpeed: 22 },
  snow: { ...CLEAR, cloud: 1, snow: 0.8, snowLying: 1, windSpeed: 12 },
  fog: { ...CLEAR, cloud: 0.8, fog: 0.9, windSpeed: 3 },
  storm: { ...CLEAR, cloud: 1, rain: 1, storm: 1, windSpeed: 45 },
}

// Development only, and stripped from production: ?at=2026-06-21T12:00-04:00 holds the sky and clock at that moment.
const FIXED_TIME = import.meta.env?.DEV ? new URLSearchParams(location.search).get('at') : null
export const skyTime = () => (FIXED_TIME ? new Date(FIXED_TIME).getTime() : Date.now())

const FOG_BELOW_METERS = 2000
const REFRESH_MS = 15 * 60 * 1000
const TIMEOUT_MS = 8000
// Older observations than this are treated as missing, so a silent station can't hold an old sky.
const STALE_MS = 3 * 60 * 60 * 1000
const CACHE_KEY = 'living-portfolio:weather:nws'
// Monmouth Executive Airport, the station nearest the room's coordinates, then Kennedy if it's silent.
const STATIONS = ['KBLM', 'KJFK']

// How much of the sky each reported cloud layer covers. The thickest layer wins.
const COVER: Record<string, number> = { CLR: 0, SKC: 0, NCD: 0, FEW: 0.2, SCT: 0.45, BKN: 0.75, OVC: 1, VV: 1 }

// One METAR weather group, such as "-RA", "+TSRA", "SHSN" or "BR", on the same 0 to 1 scales the presets use.
function fromMetar(raw: string) {
  const reading = { rain: 0, snow: 0, fog: 0, storm: 0 }
  if (raw.startsWith('VC')) return reading // In the vicinity, not here.
  const strength = raw.startsWith('-') ? 0 : raw.startsWith('+') ? 2 : 1
  const codes = raw.replace(/^[-+]/, '').match(/.{2}/g) ?? []
  const has = (...wanted: string[]) => codes.some((code) => wanted.includes(code))
  if (has('RA', 'UP', 'GR', 'GS')) reading.rain = [0.3, 0.55, 1][strength]
  if (has('DZ')) reading.rain = Math.max(reading.rain, [0.25, 0.3, 0.4][strength])
  if (has('SN', 'SG', 'PL', 'IC')) reading.snow = [0.4, 0.7, 1][strength]
  if (has('TS')) {
    reading.storm = 1
    reading.rain = Math.max(reading.rain, 1)
  }
  if (has('FG')) reading.fog = 0.8
  else if (has('BR')) reading.fog = 0.4
  else if (has('HZ')) reading.fog = 0.3
  return reading
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const valueOf = (field: unknown) => {
  const value = (field as { value?: unknown } | null | undefined)?.value
  return typeof value === 'number' ? value : null
}

// Reads a National Weather Service observation (api.weather.gov, public domain). Null when the reply isn't one, or is
// stale, so a bad reply can't paint a wrong sky.
export function readWeather(response: unknown, now = Date.now()): Weather | null {
  const observation = (response as { properties?: Record<string, unknown> } | null)?.properties
  if (!observation || typeof observation.timestamp !== 'string') return null
  const at = Date.parse(observation.timestamp)
  if (!Number.isFinite(at) || now - at > STALE_MS) return null
  const { presentWeather, cloudLayers } = observation
  if (!Array.isArray(presentWeather) || !Array.isArray(cloudLayers)) return null

  const coded = { rain: 0, snow: 0, fog: 0, storm: 0 }
  for (const group of presentWeather) {
    const raw = (group as { rawString?: unknown } | null)?.rawString
    if (typeof raw !== 'string') continue
    const reading = fromMetar(raw)
    for (const key of Object.keys(coded) as (keyof typeof coded)[]) coded[key] = Math.max(coded[key], reading[key])
  }
  const cloud = cloudLayers.reduce<number>((most, layer) => {
    const amount = (layer as { amount?: unknown } | null)?.amount
    return Math.max(most, typeof amount === 'string' ? (COVER[amount] ?? 0) : 0)
  }, 0)
  const speed = valueOf(observation.windSpeed)
  const direction = valueOf(observation.windDirection)
  const seen = valueOf(observation.visibility) ?? Infinity
  return {
    ...coded,
    // Rain or snow falling under a sky the station called clear still needs clouds.
    cloud: Math.max(cloud, coded.rain || coded.snow ? 0.85 : 0),
    fog: Math.max(coded.fog, clamp01(1 - seen / FOG_BELOW_METERS)),
    windSpeed: speed ?? CLEAR.windSpeed,
    windDirection: direction ?? CLEAR.windDirection,
    // Observations carry no snow depth, so the ground only whitens while it's snowing.
    snowLying: coded.snow > 0 ? 1 : 0,
  }
}

// A reading in plain words, for the loading status.
export function describeWeather({ storm, snow, rain, fog, cloud }: Weather) {
  if (storm > 0) return 'a thunderstorm'
  if (snow > 0) return snow >= 0.7 ? 'heavy snow' : 'light snow'
  if (rain > 0) return rain >= 0.7 ? 'heavy rain' : rain > 0.45 ? 'rain' : 'light rain'
  if (fog >= 0.5) return 'fog'
  if (cloud >= 0.85) return 'overcast'
  return cloud >= 0.4 ? 'partly cloudy' : 'clear skies'
}

function readCache(): Weather | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; weather: Weather } | null
    return cached && Date.now() - cached.at < REFRESH_MS ? cached.weather : null
  } catch {
    return null
  }
}

function writeCache(weather: Weather) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), weather }))
  } catch {
    // Storage can be off in private windows. The next load simply asks again.
  }
}

// Keeps a page supplied with readings, and returns how to stop. A failed request keeps the last good reading.
export function watchWeather(onReading: (weather: Weather) => void) {
  let last = 0

  const fromStation = async (station: string) => {
    try {
      const url = `https://api.weather.gov/stations/${station}/observations/latest`
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      return response.ok ? readWeather(await response.json()) : null
    } catch (error) {
      console.warn(`Weather request to ${station} failed.`, error)
      return null
    }
  }

  const refresh = async () => {
    last = Date.now()
    for (const station of STATIONS) {
      const weather = await fromStation(station)
      if (weather) {
        writeCache(weather)
        onReading(weather)
        return
      }
    }
    console.warn('No usable weather reading; keeping the last one.')
  }

  const refreshIfStale = () => {
    if (!document.hidden && Date.now() - last >= REFRESH_MS) refresh()
  }

  const cached = readCache()
  if (cached) {
    last = Date.now()
    onReading(cached)
  } else {
    refresh()
  }
  const timer = setInterval(refreshIfStale, 60000)
  document.addEventListener('visibilitychange', refreshIfStale)
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refreshIfStale)
  }
}
