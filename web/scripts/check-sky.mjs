import assert from 'node:assert/strict'
import { daylight, directSun, moonPhase, moonPosition, roomDirection, sunPosition } from '../src/sun.ts'
import { CLEAR, describeWeather, PRESETS, readWeather } from '../src/weather.ts'

// Sunrise and sunset Open-Meteo returned once for a point within a few kilometres of PLACE, stored here as Unix seconds.
// Refraction puts the sun's centre near -0.83 degrees at these moments; the distance shifts it by well under 0.1 degrees.
const OPEN_METEO = [
  { date: '2026-08-06', sunrise: 1786010299, sunset: 1786061085 },
  { date: '2026-09-21', sunrise: 1789987359, sunset: 1790031284 },
  { date: '2026-11-06', sunrise: 1793964698, sunset: 1794001634 },
]
for (const { date, sunrise, sunset } of OPEN_METEO) {
  for (const [name, seconds] of [['sunrise', sunrise], ['sunset', sunset]]) {
    const { elevation } = sunPosition(seconds * 1000)
    assert(Math.abs(elevation + 0.83) < 0.5, `${date} ${name}: elevation ${elevation.toFixed(2)}`)
  }
  const noon = sunPosition((sunrise + sunset) * 500)
  assert(Math.abs(noon.azimuth - 180) < 1, `${date} solar noon: azimuth ${noon.azimuth.toFixed(2)}`)
}

// Around solar noon at the solstices, the sun's height differs by twice the tilt of the Earth: about 47 degrees.
const june = sunPosition(Date.UTC(2026, 5, 21, 17)).elevation
const december = sunPosition(Date.UTC(2026, 11, 21, 17)).elevation
assert(Math.abs(june - december - 47) < 1.5, `June ${june.toFixed(1)}, December ${december.toFixed(1)}`)

// The beam travels away from the sun, so morning light heads for +x and afternoon light for -x.
const morning = roomDirection({ azimuth: 130, elevation: 25 })
const afternoon = roomDirection({ azimuth: 230, elevation: 25 })
assert(-morning[0] > 0 && -afternoon[0] < 0, 'the beam sweeps from left to right across the day')
assert(morning[2] < 0 && afternoon[2] < 0, 'a southern sun is on the window side')
assert(Math.abs(roomDirection({ azimuth: 180, elevation: 30 })[0]) < 1e-9, 'noon has no sideways lean')

assert.equal(daylight(-20, 0), 0, 'no daylight at night')
assert(daylight(40, 1) < daylight(40, 0), 'overcast is darker than clear')
assert.equal(directSun({ azimuth: 180, elevation: 40 }, 1, 0, 0), 0, 'overcast removes the beam')
assert.equal(directSun({ azimuth: 180, elevation: 40 }, 0, 0, 0), 1, 'a clear noon has the full beam')
assert.equal(directSun({ azimuth: 180, elevation: -5 }, 0, 0, 0), 0, 'no beam below the horizon')
assert.equal(directSun({ azimuth: 60, elevation: 20 }, 0, 0, 0), 0, 'no beam when the sun is behind the house')
assert.equal(directSun({ azimuth: 268, elevation: 35 }, 0, 0, 0), 0, 'no beam from a nearly side-on sun, which would get around the mask')

// The new moon of November 9, 2026 and the full moon of November 24, 2026 (both UTC).
const newMoon = moonPhase(Date.UTC(2026, 10, 9, 7, 2))
const fullMoon = moonPhase(Date.UTC(2026, 10, 24, 14, 53))
assert(Math.min(newMoon, 1 - newMoon) < 0.02, `new moon phase ${newMoon.toFixed(3)}`)
assert(Math.abs(fullMoon - 0.5) < 0.02, `full moon phase ${fullMoon.toFixed(3)}`)
const moon = moonPosition(Date.UTC(2026, 10, 24, 14, 53))
assert(moon.elevation >= -90 && moon.elevation <= 90 && moon.azimuth >= 0 && moon.azimuth < 360, 'moon position in range')

// National Weather Service observations, shaped as api.weather.gov returns them.
const NOW = Date.parse('2026-11-09T17:00:00Z')
const observation = (fields) => ({
  properties: {
    timestamp: '2026-11-09T16:40:00+00:00',
    presentWeather: [],
    cloudLayers: [{ amount: 'CLR' }],
    windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 10 },
    windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 180 },
    visibility: { unitCode: 'wmoUnit:m', value: 16093 },
    ...fields,
  },
})
const reading = (fields) => readWeather(observation(fields), NOW)
const weather = (...raw) => reading({ presentWeather: raw.map((rawString) => ({ rawString })) })
assert.equal(weather('+RA').rain, 1, 'heavy rain')
assert.equal(weather('-RA').rain, 0.3, 'light rain')
assert.equal(weather('+SN').snow, 1, 'heavy snow')
assert.equal(weather('SN').snowLying, 1, 'snow lying while it snows')
assert.equal(weather('TSRA').storm, 1, 'thunderstorm')
assert.equal(weather('VCTS').storm, 0, 'a storm in the vicinity is not here')
assert.equal(weather('FG').fog, 0.8, 'fog by code')
assert.equal(weather('-RA', 'BR').fog, 0.4, 'mist alongside rain')
assert.equal(weather('-RA').cloud, 0.85, 'rain brings cloud')
assert.equal(reading({ visibility: { value: 500 } }).fog, 0.75, 'fog by visibility')
assert.equal(reading({ cloudLayers: [{ amount: 'FEW' }, { amount: 'OVC' }] }).cloud, 1, 'the thickest layer wins')
assert.equal(reading({ cloudLayers: [{ amount: 'FEW' }] }).cloud, 0.2, 'a few clouds')
assert.equal(reading({ windSpeed: { value: null } }).windSpeed, CLEAR.windSpeed, 'missing wind falls back')
assert.equal(reading({ timestamp: '2026-11-09T12:00:00+00:00' }), null, 'a stale observation')
assert.equal(readWeather(null), null, 'an empty reply')
assert.equal(readWeather({ status: 404, title: 'Not Found' }), null, 'an error reply')
assert.equal(readWeather({ properties: { timestamp: 'x' } }, NOW), null, 'a malformed reply')
assert.equal(CLEAR.rain, 0, 'the first-load fallback is dry')

assert.equal(describeWeather(CLEAR), 'clear skies')
assert.equal(describeWeather(PRESETS.overcast), 'overcast')
assert.equal(describeWeather(PRESETS.rain), 'heavy rain')
assert.equal(describeWeather(weather('-RA')), 'light rain')
assert.equal(describeWeather(PRESETS.snow), 'heavy snow')
assert.equal(describeWeather(PRESETS.fog), 'fog')
assert.equal(describeWeather(PRESETS.storm), 'a thunderstorm')

console.log('PASS: sun, moon, beam direction, daylight, and weather readings')
