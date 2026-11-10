// Where the sun and moon are, worked out from the instant alone, so a visitor's time zone can't change it.
// Low-precision formulas from the Astronomical Almanac, good to about a degree, far finer than the window shows.

// The sun is worked out for a point on the central NJ coast, rounded to a tenth of a degree (about 10 km) so it names
// a region rather than a street; the sun's position barely changes over that distance. The weather comes from the
// nearest airport station, so visitors are told "central NJ". The real ocean is to the east; the window's
// south-facing beach is stylized.
export const PLACE = { name: 'central NJ', latitude: 40.4, longitude: -74.0 }

const RADIANS = Math.PI / 180
const J2000_MS = Date.UTC(2000, 0, 1, 12)
const DAY_MS = 86400000
const OBLIQUITY = 23.439

const sin = (degrees: number) => Math.sin(degrees * RADIANS)
const cos = (degrees: number) => Math.cos(degrees * RADIANS)

export type Sky = { azimuth: number; elevation: number }
export type Vector = [number, number, number]

function horizontal(ecliptic: { longitude: number; latitude: number }, days: number): Sky {
  const { longitude: l, latitude: b } = ecliptic
  const rightAscension = Math.atan2(sin(l) * cos(OBLIQUITY) - (sin(b) / cos(b)) * sin(OBLIQUITY), cos(l)) / RADIANS
  const declination = Math.asin(sin(b) * cos(OBLIQUITY) + cos(b) * sin(OBLIQUITY) * sin(l)) / RADIANS
  const siderealDegrees = 280.46061837 + 360.98564736629 * days
  const hourAngle = siderealDegrees + PLACE.longitude - rightAscension
  const elevation = Math.asin(
    sin(PLACE.latitude) * sin(declination) + cos(PLACE.latitude) * cos(declination) * cos(hourAngle),
  )
  // Clockwise from north.
  const azimuth =
    Math.atan2(sin(hourAngle), cos(hourAngle) * sin(PLACE.latitude) - (sin(declination) / cos(declination)) * cos(PLACE.latitude)) / RADIANS + 180
  return { azimuth: ((azimuth % 360) + 360) % 360, elevation: elevation / RADIANS }
}

const daysSinceJ2000 = (time: number) => (time - J2000_MS) / DAY_MS

function sunLongitude(days: number) {
  const anomaly = 357.529 + 0.98560028 * days
  return 280.459 + 0.98564736 * days + 1.915 * sin(anomaly) + 0.02 * sin(2 * anomaly)
}

function moonEcliptic(days: number) {
  const t = days / 36525
  return {
    longitude:
      218.32 + 481267.881 * t + 6.29 * sin(135 + 477198.87 * t) - 1.27 * sin(259.3 - 413335.36 * t) +
      0.66 * sin(235.7 + 890534.22 * t) + 0.21 * sin(269.9 + 954397.74 * t) -
      0.19 * sin(357.5 + 35999.05 * t) - 0.11 * sin(186.5 + 966404.03 * t),
    latitude:
      5.13 * sin(93.3 + 483202.02 * t) + 0.28 * sin(228.2 + 960400.89 * t) -
      0.28 * sin(318.3 + 6003.15 * t) - 0.17 * sin(217.6 - 407332.21 * t),
  }
}

export function sunPosition(time: number): Sky {
  const days = daysSinceJ2000(time)
  return horizontal({ longitude: sunLongitude(days), latitude: 0 }, days)
}

export function moonPosition(time: number): Sky {
  const days = daysSinceJ2000(time)
  return horizontal(moonEcliptic(days), days)
}

// Through the month: 0 is new, 0.5 is full.
export function moonPhase(time: number) {
  const days = daysSinceJ2000(time)
  const age = (moonEcliptic(days).longitude - sunLongitude(days)) / 360
  return age - Math.floor(age)
}

// The direction toward a body in room space. The window looks out along -z, which is south, so east is -x.
export function roomDirection({ azimuth, elevation }: Sky): Vector {
  return [-sin(azimuth) * cos(elevation), sin(elevation), cos(azimuth) * cos(elevation)]
}

function smoothstep(value: number, low: number, high: number) {
  const x = Math.min(Math.max((value - low) / (high - low), 0), 1)
  return x * x * (3 - 2 * x)
}

// How much daylight fills the room, 0 to 1. Civil twilight ends at -6 degrees; heavy cloud takes away over half.
export function daylight(elevation: number, cloud: number) {
  return smoothstep(elevation, -6, 8) * (1 - 0.55 * cloud)
}

// How strong the direct beam is, 0 to 1. It needs a sun above the horizon on the window's side of the house, and a gap in the cloud.
// A sun nearly side-on to the window fades out, as a real recess would cut it: at that angle the mask's sheet no longer
// reaches across the room's open side, so the light would flood in around it.
export function directSun(sun: Sky, cloud: number, rain: number, fog: number) {
  return smoothstep(-roomDirection(sun)[2], 0.1, 0.2) * smoothstep(sun.elevation, 0, 4) * (1 - smoothstep(cloud, 0.55, 0.95)) * (1 - rain) * (1 - fog)
}
