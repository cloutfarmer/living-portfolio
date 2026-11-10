import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Color,
  type DirectionalLight,
  MathUtils,
  type Mesh,
  MeshBasicMaterial,
  Object3D,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import { REDUCED_MOTION } from './Life'
import { loadState } from './loading'
import { daylight, directSun, moonPhase, moonPosition, roomDirection, sunPosition, type Vector } from './sun'
import { CLEAR, PRESETS, skyTime, watchWeather, type Weather } from './weather'

const FULL_SUN = 4.5
export const CANDLE_IN_SUN = 0.2
const WEATHER_SETTLE = 0.1
// A sun moved this far, in degrees, redraws the shadows. It takes about 24 seconds at the sun's speed.
const SHADOW_REDRAW_DEGREES = 0.1
// Sits behind the wall, so it only ever stops the sun, never the candle.
const MASK_BEHIND = 0.3
const MASK_REACH = 30
// Clear of the shadow's normal offset, which would otherwise let light in under it.
const WALL_CAP_ABOVE = 0.06
// Far enough that a steep sun's near plane still takes in the mask, high above the room along the ray.
const SUN_DISTANCE = 40
const ROOM_MIDDLE: Vector = [1, 0.5, 0.25]
const SUN_LOW = new Color('#ff9a55')
const SUN_HIGH = new Color('#fff0dc')
// Stands in for looking out from inside. The diorama camera looks down, so its own rays would only ever see sand.
const VIEW = { backFromGlass: 1.6, horizonAbovePaneBottom: 0.2, parallax: 0.1 }

// Development only, and stripped from production: ?weather=rain, with ?at= in weather.ts.
const FIXED_WEATHER = import.meta.env.DEV ? PRESETS[new URLSearchParams(location.search).get('weather') ?? ''] : undefined

export type SkyState = {
  weather: Weather
  sun: ReturnType<typeof sunPosition>
  sunDirection: Vector
  moonDirection: Vector
  moonPhase: number
  // 0 to 1: how far daylight fills the room, and how strong the beam through the window is.
  daylight: number
  direct: number
  // Multiplies the candle's light. Sunlight washes it out.
  candle: number
  // 0 to 1: lightning, which also lights the room.
  flash: number
}

function makeSky(): SkyState {
  return {
    weather: { ...(FIXED_WEATHER ?? CLEAR) },
    sun: { azimuth: 180, elevation: 0 },
    sunDirection: [0, 0, -1],
    moonDirection: [0, 0, -1],
    moonPhase: 0,
    daylight: 0,
    direct: 0,
    candle: 1,
    flash: 0,
  }
}

function placeBodies(sky: SkyState, time: number) {
  sky.sun = sunPosition(time)
  sky.sunDirection = roomDirection(sky.sun)
  sky.moonDirection = roomDirection(moonPosition(time))
  sky.moonPhase = moonPhase(time)
}

function lightning(t: number) {
  // A quick double strike about every 20 seconds, at uneven gaps. Kept rare, because the whole room flashes.
  const beat = t * 0.05 + Math.sin(t * 0.03) * 0.2
  const age = (beat - Math.floor(beat)) / 0.05
  return age < 0.09 || (age > 0.16 && age < 0.22) ? 1 : 0
}

// Shared by the room's lights and the window. Runs once per frame.
export function useSky() {
  const sky = useRef<SkyState>(makeSky()).current
  const target = useRef<Weather>(FIXED_WEATHER ?? CLEAR)
  const settled = useRef(Boolean(FIXED_WEATHER))
  const lastPlaced = useRef(-Infinity)

  useEffect(() => {
    if (FIXED_WEATHER) {
      loadState.weather = FIXED_WEATHER
      return
    }
    return watchWeather((reading) => {
      loadState.weather = reading
      target.current = reading
      // The first reading arrives as the page fades in, so it needs no easing.
      if (!settled.current) {
        settled.current = true
        Object.assign(sky.weather, reading)
      }
    })
  }, [sky])

  useFrame(({ clock }, delta) => {
    const time = skyTime()
    if (Math.abs(time - lastPlaced.current) >= 1000 || lastPlaced.current < 0) {
      lastPlaced.current = time
      placeBodies(sky, time)
    }
    const weather = sky.weather
    for (const key of Object.keys(weather) as (keyof Weather)[]) {
      // Angles take the short way round; the rest ease directly.
      const goal =
        key === 'windDirection'
          ? weather[key] + ((((target.current[key] - weather[key]) % 360) + 540) % 360) - 180
          : target.current[key]
      weather[key] = REDUCED_MOTION || !settled.current ? goal : MathUtils.damp(weather[key], goal, WEATHER_SETTLE, delta)
    }

    sky.daylight = daylight(sky.sun.elevation, weather.cloud)
    const t = clock.elapsedTime
    // Broken cloud passes over the sun, so the beam comes and goes.
    const passing = REDUCED_MOTION ? 0.5 : 0.5 + 0.3 * Math.sin(t * 0.09) + 0.2 * Math.sin(t * 0.23 + 1)
    sky.direct = directSun(sky.sun, weather.cloud, weather.rain, weather.fog) * (1 - weather.cloud * passing)
    sky.candle = MathUtils.lerp(1, CANDLE_IN_SUN, Math.min(sky.daylight + sky.direct * 0.3, 1))
    sky.flash = weather.storm > 0.5 && !REDUCED_MOTION ? lightning(t) : 0
  })

  return sky
}

const VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

// Everything outside: sky, sun and moon, clouds, sea and surf, sand, grass, gulls, and weather on the glass.
const FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uEye;
  uniform vec3 uPaneMin;
  uniform vec3 uPaneSize;
  uniform vec3 uSun;
  uniform vec3 uMoon;
  uniform float uMoonPhase;
  uniform float uDirect;
  uniform float uCloud;
  uniform float uRain;
  uniform float uSnow;
  uniform float uFog;
  uniform float uSnowLying;
  uniform float uFlash;
  uniform float uWind;
  uniform float uSeaTime;
  uniform float uSway;
  uniform float uFall;
  uniform vec2 uDrift;

  // How high above the water the view stands, and how far out the sand ends, in metres.
  const float EYE_HEIGHT = 7.0;
  const float SHORE = 85.0;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0;
    float size = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += size * noise(p);
      p = p * 2.03 + 11.0;
      size *= 0.5;
    }
    return sum;
  }

  float dayAmount() { return smoothstep(-0.08, 0.2, uSun.y); }
  float twilight() { return smoothstep(-0.25, -0.02, uSun.y) * (1.0 - smoothstep(0.03, 0.3, uSun.y)); }

  vec3 skyColor(vec3 rd) {
    float up = clamp(rd.y, 0.0, 1.0);
    float day = dayAmount();
    float dusk = twilight();
    vec3 zenith = mix(vec3(0.004, 0.007, 0.02), vec3(0.05, 0.2, 0.62), day);
    vec3 horizon = mix(vec3(0.012, 0.018, 0.04), vec3(0.56, 0.74, 0.95), day);
    vec2 flatSun = normalize(uSun.xz + vec2(0.0, -0.001));
    float toward = max(dot(normalize(rd.xz + vec2(0.0, -0.001)), flatSun), 0.0);
    horizon = mix(horizon, vec3(1.0, 0.45, 0.17), dusk * (0.3 + 0.7 * toward * toward));
    zenith = mix(zenith, vec3(0.2, 0.2, 0.42), dusk * 0.65);
    vec3 color = mix(horizon, zenith, pow(up, 0.55));
    // A heavy sky flattens to grey.
    vec3 grey = vec3(0.4, 0.43, 0.47) * (0.02 + 0.98 * day) + vec3(0.14, 0.09, 0.07) * dusk;
    return mix(color, grey, uCloud * uCloud * 0.92);
  }

  float cloudDensity(vec3 rd) {
    vec2 p = rd.xz / (max(rd.y, 0.0) + 0.14) * 0.55 + uDrift;
    float cover = mix(0.92, 0.26, uCloud);
    return smoothstep(cover, cover + 0.2, fbm(p)) * smoothstep(0.0, 0.05, rd.y);
  }

  float moonDisc(vec3 rd) {
    vec3 right = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
    vec3 upward = cross(right, uMoon);
    vec2 uv = vec2(dot(rd, right), dot(rd, upward)) / 0.028;
    float along = dot(rd, uMoon);
    if (along <= 0.0 || dot(uv, uv) > 1.0) return 0.0;
    // Waxing moons are lit on the side the sun set on, waning on the other.
    float edge = sqrt(1.0 - uv.y * uv.y) * cos(uMoonPhase * 6.28318);
    float lit = uMoonPhase < 0.5 ? smoothstep(edge - 0.08, edge + 0.08, uv.x) : smoothstep(edge - 0.08, edge + 0.08, -uv.x);
    return lit * (0.75 + 0.25 * noise(uv * 4.0));
  }

  vec3 lookUp(vec3 rd) {
    vec3 color = skyColor(rd);
    float day = dayAmount();
    float dusk = twilight();
    float night = 1.0 - smoothstep(-0.2, 0.0, uSun.y);
    float density = cloudDensity(rd);

    vec2 cell = floor(rd.xz / (rd.y + 0.4) * 90.0);
    float star = step(0.992, hash(cell)) * (0.45 + 0.55 * sin(uSeaTime * 2.0 + hash(cell + 3.0) * 40.0));
    color += star * night * (1.0 - density) * (1.0 - uFog) * smoothstep(0.03, 0.2, rd.y) * vec3(0.8, 0.85, 1.0);
    color += moonDisc(rd) * 1.6 * smoothstep(-0.03, 0.03, uMoon.y) * (1.0 - density) * (1.0 - uFog) * vec3(0.95, 0.93, 0.85);
    color += pow(max(dot(rd, uMoon), 0.0), 500.0) * 0.12 * night * smoothstep(-0.03, 0.03, uMoon.y) * (1.0 - uCloud);

    float toSun = max(dot(rd, uSun), 0.0);
    float shown = smoothstep(-0.03, 0.03, uSun.y) * (1.0 - density) * (1.0 - uCloud * uCloud) * (1.0 - uFog);
    color += smoothstep(0.99945, 0.9997, toSun) * 14.0 * shown * mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.96, 0.88), day);
    color += pow(toSun, 90.0) * mix(vec3(0.9, 0.42, 0.14), vec3(0.75, 0.7, 0.6), day) * 0.8 * shown;

    float thin = fbm((rd.xz / (max(rd.y, 0.0) + 0.14) * 0.55 + uDrift) + vec2(uSun.x, -uSun.z) * 0.12);
    float shade = mix(0.62, 1.0, smoothstep(0.3, 0.75, thin));
    vec3 cloud = mix(vec3(0.05, 0.06, 0.1), vec3(1.0, 0.99, 0.97), day) * shade;
    cloud = mix(cloud, vec3(1.0, 0.6, 0.42) * shade, dusk * 0.8);
    cloud = mix(cloud, cloud * vec3(0.52, 0.55, 0.6), uCloud * uCloud);
    return mix(color, cloud, density * 0.95);
  }

  vec3 lookDown(vec3 rd) {
    float along = EYE_HEIGHT / max(-rd.y, 0.004);
    vec2 ground = rd.xz * along;
    float out_ = -ground.y;
    float day = dayAmount();
    float light = 0.04 + 0.96 * day * (1.0 - 0.45 * uCloud);
    vec3 warm = mix(vec3(1.0), vec3(1.0, 0.68, 0.48), twilight());

    float wash = 2.6 * sin(uSeaTime * 0.32 + ground.x * 0.02) + 2.2 * noise(vec2(ground.x * 0.06, uSeaTime * 0.1));
    float shore = SHORE + wash;

    // Sand, darker where the last wave wet it.
    vec3 sand = vec3(0.62, 0.47, 0.27) * (0.82 + 0.26 * fbm(ground * 0.5));
    sand = mix(sand, vec3(0.93, 0.95, 0.98), uSnowLying);
    float wet = smoothstep(shore - 12.0, shore - 1.0, out_);
    sand = mix(sand, sand * 0.58, wet * (1.0 - uSnowLying));
    vec3 land = sand * light * warm;

    // Water, faded toward the sky's reflection with distance.
    float reach = smoothstep(0.0, 1.0, out_ / 1200.0);
    // Distant waves are finer than a pixel, so they fade out instead of shimmering into stripes.
    float chop = mix(0.035, 0.16, uWind) * (1.0 - reach * 0.75) / (1.0 + out_ / 170.0);
    vec2 waves = ground * vec2(0.09, 0.32);
    vec2 slope = vec2(
      noise(waves + vec2(uSeaTime * 0.5, uSeaTime * 0.8)) - 0.5,
      noise(waves * 1.7 + vec2(-uSeaTime * 0.4, uSeaTime * 1.1) + 9.0) - 0.5
    ) * 2.0 * chop;
    vec3 normal = normalize(vec3(slope.x, 1.0, slope.y));
    vec3 bounce = reflect(rd, normal);
    bounce.y = abs(bounce.y);
    float facing = pow(1.0 - max(dot(-rd, normal), 0.0), 3.0);
    vec3 deep = mix(vec3(0.0, 0.055, 0.2), vec3(0.0, 0.26, 0.3), smoothstep(SHORE + 70.0, SHORE, out_));
    vec3 water = mix(deep * light * warm, skyColor(bounce), 0.08 + 0.26 * facing);

    float sparkle = pow(max(dot(bounce, uSun), 0.0), 170.0) * smoothstep(-0.02, 0.05, uSun.y);
    water += sparkle * mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.97, 0.88), day) * 7.0 * (0.12 + 0.88 * uDirect);
    water += pow(max(dot(bounce, uMoon), 0.0), 170.0) * smoothstep(-0.02, 0.05, uMoon.y) * (1.0 - day) * 0.9 * (1.0 - uCloud) * sin(uMoonPhase * 3.14159);

    // Rolling lines of surf, breaking as they reach the sand.
    float rolling = sin(out_ * 0.17 - uSeaTime * 0.9 + 1.8 * noise(vec2(ground.x * 0.04, 3.0)));
    float breakers = smoothstep(0.45, 0.95, rolling) * (1.0 - smoothstep(0.0, 75.0, out_ - shore)) * smoothstep(0.1, 0.6, fbm(ground * vec2(0.08, 0.2)));
    water = mix(water, vec3(0.92, 0.95, 0.96) * (0.05 + 0.95 * light), breakers * 0.85);
    float lace = smoothstep(4.5, 0.5, abs(out_ - shore)) * (0.45 + 0.55 * noise(ground * vec2(0.28, 0.55)));
    water = mix(water, vec3(0.95, 0.97, 0.98) * (0.05 + 0.95 * light), lace);

    return mix(land, water, smoothstep(shore - 0.4, shore + 0.4, out_));
  }

  vec3 scene(vec3 rd) {
    vec3 color = rd.y >= 0.0 ? lookUp(rd) : lookDown(rd);
    // Haze at the horizon, and fog over everything.
    vec3 fogColor = mix(vec3(0.012, 0.016, 0.03), vec3(0.7, 0.74, 0.78), dayAmount());
    fogColor = mix(fogColor, vec3(1.0, 0.6, 0.42), twilight() * 0.6);
    float haze = (1.0 - smoothstep(0.0, 0.025, abs(rd.y))) * 0.22;
    return mix(color, fogColor, max(haze, uFog * (0.72 + 0.28 * (1.0 - smoothstep(0.0, 0.55, abs(rd.y))))));
  }

  // Beads of rain on the glass bend the view behind them, and leave a track on the way down.
  vec2 rainOnGlass(vec2 uv, float size, float seed) {
    vec2 scaled = uv * vec2(size, size * 0.42);
    scaled.y += uFall * 0.34 + hash(vec2(floor(scaled.x), seed)) * 7.0;
    vec2 cell = floor(scaled);
    vec2 inner = fract(scaled) - 0.5;
    float here = hash(cell + seed);
    if (here > uRain * 0.75) return vec2(0.0);
    inner.x += (here - 0.3) * 0.5;
    inner.y *= 2.4;
    float bead = smoothstep(0.34, 0.1, length(inner));
    float track = smoothstep(0.1, 0.0, abs(inner.x)) * smoothstep(-0.2, 1.0, inner.y) * 0.3;
    return inner * bead * 0.14 + vec2(0.0, track * 0.012);
  }

  float grass(vec2 uv) {
    float cover = 0.0;
    for (int layer = 0; layer < 3; layer++) {
      float f = float(layer);
      float count = 15.0 + f * 11.0;
      float x = uv.x * count + f * 7.3;
      float cell = floor(x);
      for (float near = -1.0; near <= 1.0; near += 1.0) {
        float id = cell + near + f * 37.0;
        float clump = 0.42 + 0.58 * noise(vec2(id * 0.11, f));
        float tall = (0.05 + 0.1 * hash(vec2(id, 2.0))) * clump * (1.0 - f * 0.18);
        float height = clamp(uv.y / tall, 0.0, 1.0);
        float lean = (hash(vec2(id, 5.0)) - 0.5) * 1.1 + sin(uSway + id * 0.73) * (0.2 + uWind * 1.7) + uWind * 1.4;
        float center = cell + near + 0.5 + (hash(vec2(id, 9.0)) - 0.5) * 0.6 + lean * height * height;
        float width = 0.26 * (1.0 - height) + 0.02;
        if (uv.y < tall) cover = max(cover, smoothstep(width, width * 0.5, abs(x - center)));
      }
    }
    return cover;
  }

  float gull(vec2 uv, float seed) {
    float period = 37.0 + seed * 12.0;
    float age = fract(uSeaTime / period + seed * 3.1);
    vec2 place = vec2(mix(-0.1, 1.1, seed > 0.5 ? age : 1.0 - age), 0.34 + 0.08 * sin(age * 12.0 + seed * 9.0) + seed * 0.12);
    vec2 p = (uv - place) * vec2(1.0, 1.25) * 90.0;
    float flap = sin(uSeaTime * 5.0 + seed * 20.0) * 0.5;
    float wing = abs(p.y - abs(p.x) * (0.1 + flap * 0.6) + 0.12 * p.x * p.x);
    return smoothstep(0.6, 0.15, wing) * step(abs(p.x), 2.1);
  }

  float snowfall(vec2 uv, float size, float speed, float seed) {
    vec2 p = uv * vec2(size * 1.25, size);
    p.y += uFall * speed;
    p.x += sin(p.y * 0.8 + seed) * 0.35 + uDrift.x * 3.0;
    vec2 cell = floor(p);
    if (hash(cell + seed) > uSnow * 0.8) return 0.0;
    vec2 at = fract(p) - 0.5 + (vec2(hash(cell + 2.0), hash(cell + 5.0)) - 0.5) * 0.6;
    return smoothstep(0.1, 0.03, length(at));
  }

  void main() {
    vec2 uv = (vWorld.xy - uPaneMin.xy) / uPaneSize.xy;
    vec2 aspect = vec2(uPaneSize.x / uPaneSize.y, 1.0);
    vec2 bend = vec2(0.0);
    if (uRain > 0.01) {
      bend = rainOnGlass(uv * aspect, 16.0, 1.0) + rainOnGlass(uv * aspect, 27.0, 4.0);
    }
    vec3 point = vWorld + vec3(bend, 0.0);
    vec3 rd = normalize(point - uEye);
    vec3 color = scene(rd);

    float day = dayAmount();
    float light = 0.03 + 0.97 * day * (1.0 - 0.4 * uCloud);
    if (uRain < 0.05 && uFog < 0.4 && day > 0.4) {
      float birds = gull(uv * aspect / aspect.x, 0.21) + gull(uv * aspect / aspect.x, 0.47) + gull(uv * aspect / aspect.x, 0.83);
      color = mix(color, vec3(0.22, 0.24, 0.28) * light, clamp(birds, 0.0, 1.0));
    }
    if (uRain > 0.01) {
      float line = smoothstep(0.75, 1.0, noise(vec2(uv.x * 170.0 + uv.y * 8.0, uv.y * 7.0 + uFall * 3.6)));
      color += line * uRain * 0.1 * (0.15 + 0.85 * day);
      color *= 1.0 - dot(bend, bend) * 8.0;
    }
    if (uSnow > 0.01) {
      float flakes = snowfall(uv * aspect, 9.0, 0.5, 1.0) + snowfall(uv * aspect, 16.0, 0.34, 2.0) + snowfall(uv * aspect, 27.0, 0.2, 3.0) * 0.6;
      color = mix(color, vec3(0.95) * (0.08 + 0.92 * light), clamp(flakes, 0.0, 1.0));
    }

    float blades = grass(vec2(uv.x * aspect.x * 0.5, uv.y) * vec2(2.0, 1.0));
    vec3 grassColor = mix(vec3(0.3, 0.3, 0.09), vec3(0.14, 0.24, 0.07), noise(vec2(uv.x * 38.0, 1.0))) * light;
    grassColor = mix(grassColor, grassColor * vec3(1.35, 0.85, 0.62), twilight());
    grassColor = mix(grassColor, vec3(0.85, 0.87, 0.9) * light, uSnowLying * 0.55);
    color = mix(color, mix(grassColor, color, uFog * 0.75), blades);

    color += uFlash * vec3(0.72, 0.76, 0.95);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function Outdoors({ scene, sky, roomLight }: { scene: Object3D; sky: SkyState; roomLight: { current: number } }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const sun = useRef<DirectionalLight>(null)
  const mask = useRef<Object3D>(null)
  const seaTime = useRef(0)
  const sway = useRef(0)
  const fall = useRef(0)
  const drift = useRef({ x: 0, y: 0 })
  const drawnFor = useRef<{ direction: Vector; on: boolean } | null>(null)
  const pane = useMemo(() => scene.getObjectByName('Window_dusk_pane') as Mesh | undefined, [scene])
  const bounds = useMemo(() => (pane ? new Box3().setFromObject(pane) : null), [pane])
  // The wall's top sits behind the glass, so a steep sun would reach it through the sheet's hole. This roofs it.
  const wallTop = useMemo(() => {
    const wall = scene.getObjectByName('Back_wall')
    if (!wall) return null
    const box = new Box3().setFromObject(wall)
    return { position: [(box.min.x + box.max.x) / 2, box.max.y + WALL_CAP_ABOVE, (box.min.z + box.max.z) / 2] as Vector, size: [box.max.x - box.min.x, 0.01, box.max.z - box.min.z] as Vector }
  }, [scene])
  const target = useMemo(() => {
    const object = new Object3D()
    object.position.set(...ROOM_MIDDLE)
    return object
  }, [])
  const material = useMemo(() => {
    if (!bounds) return null
    return new ShaderMaterial({
      name: 'Window_Beach',
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      toneMapped: false,
      uniforms: {
        uEye: { value: new Vector3() },
        uPaneMin: { value: bounds.min.clone() },
        uPaneSize: { value: bounds.getSize(new Vector3()) },
        uSun: { value: new Vector3() },
        uMoon: { value: new Vector3() },
        uMoonPhase: { value: 0 },
        uDirect: { value: 0 },
        uCloud: { value: 0 },
        uRain: { value: 0 },
        uSnow: { value: 0 },
        uFog: { value: 0 },
        uSnowLying: { value: 0 },
        uFlash: { value: 0 },
        uWind: { value: 0 },
        uSeaTime: { value: 0 },
        uSway: { value: 0 },
        uFall: { value: 0 },
        uDrift: { value: new Vector2() },
      },
    })
  }, [bounds])
  const hidden = useMemo(() => {
    const material = new MeshBasicMaterial()
    material.colorWrite = false
    material.depthWrite = false
    return material
  }, [])

  // A sheet with a window-shaped hole, so sunlight gets in only through the glass.
  const maskParts = useMemo(() => {
    if (!bounds) return []
    const { min, max } = bounds
    const reach = MASK_REACH
    return [
      { x: min.x - reach / 2, y: (min.y + max.y) / 2, width: reach, height: 2 * reach },
      { x: max.x + reach / 2, y: (min.y + max.y) / 2, width: reach, height: 2 * reach },
      { x: (min.x + max.x) / 2, y: min.y - reach / 2, width: max.x - min.x, height: reach },
      { x: (min.x + max.x) / 2, y: max.y + reach / 2, width: max.x - min.x, height: reach },
    ]
  }, [bounds])

  useLayoutEffect(() => {
    if (!pane || !material) return
    const original = pane.material
    pane.material = material
    return () => {
      pane.material = original
      material.dispose()
    }
  }, [pane, material])

  useFrame((_, delta) => {
    if (!material || !bounds || !sun.current) return
    const u = material.uniforms
    const { weather } = sky
    const wind = Math.min(weather.windSpeed / 40, 1)

    if (!REDUCED_MOTION) {
      seaTime.current += delta
      // Only while something falls: a clock left counting under clear skies loses shader precision within a day.
      if (weather.rain > 0 || weather.snow > 0) fall.current += delta * (weather.snow > weather.rain ? 1 : 6)
      else fall.current = 0
      sway.current += delta * (0.7 + wind * 3.2)
      // Wind blows from its compass direction: from the south, it moves things north, toward +z.
      const toward = MathUtils.degToRad(weather.windDirection + 180)
      const speed = 0.012 + (weather.windSpeed / 100) * 0.09
      drift.current.x += Math.sin(toward) * speed * delta
      drift.current.y -= Math.cos(toward) * speed * delta
    }

    u.uSeaTime.value = seaTime.current
    u.uSway.value = sway.current
    u.uFall.value = fall.current
    ;(u.uDrift.value as Vector2).set(drift.current.x, drift.current.y)
    ;(u.uSun.value as Vector3).set(...sky.sunDirection)
    ;(u.uMoon.value as Vector3).set(...sky.moonDirection)
    u.uMoonPhase.value = sky.moonPhase
    u.uDirect.value = sky.direct
    u.uCloud.value = weather.cloud
    u.uRain.value = weather.rain
    u.uSnow.value = weather.snow
    u.uFog.value = weather.fog
    u.uSnowLying.value = weather.snowLying
    u.uFlash.value = sky.flash
    u.uWind.value = wind

    // A little of the visitor's position leaks into the view, so moving past the window shifts it slightly.
    const look = camera.position.clone().sub(bounds.getCenter(new Vector3())).normalize()
    ;(u.uEye.value as Vector3).set(
      (bounds.min.x + bounds.max.x) / 2 + look.x * VIEW.parallax,
      bounds.min.y + VIEW.horizonAbovePaneBottom + (look.y - 0.4) * VIEW.parallax * 0.4,
      bounds.max.z + VIEW.backFromGlass,
    )

    const [x, y, z] = sky.sunDirection
    const on = sky.direct > 0.001
    sun.current.intensity = FULL_SUN * sky.direct * roomLight.current
    sun.current.color.copy(SUN_LOW).lerp(SUN_HIGH, MathUtils.smoothstep(sky.sun.elevation, 2, 24))
    sun.current.position.set(ROOM_MIDDLE[0] + x * SUN_DISTANCE, ROOM_MIDDLE[1] + y * SUN_DISTANCE, ROOM_MIDDLE[2] + z * SUN_DISTANCE)
    // Slides the sheet along the sun's own line, so its hole falls exactly where the glass is.
    if (mask.current && on) mask.current.position.set((x * MASK_BEHIND) / -z, (y * MASK_BEHIND) / -z, 0)

    // Shadows draw on request, because the scene mostly holds still.
    const drawn = drawnFor.current
    const moved = !drawn || drawn.on !== on || (on && Math.acos(Math.min(x * drawn.direction[0] + y * drawn.direction[1] + z * drawn.direction[2], 1)) > MathUtils.degToRad(SHADOW_REDRAW_DEGREES))
    if (moved) {
      drawnFor.current = { direction: [x, y, z], on }
      gl.shadowMap.needsUpdate = true
    }
  })

  if (!bounds) return null
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={sun}
        name="Sun"
        target={target}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.015}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE + 10}
      />
      {wallTop && (
        <mesh name="Sun_mask_top" material={hidden} position={wallTop.position} castShadow>
          <boxGeometry args={wallTop.size} />
        </mesh>
      )}
      <group ref={mask}>
        {maskParts.map(({ x, y, width, height }, index) => (
          <mesh key={index} name="Sun_mask" material={hidden} position={[x, y, bounds.min.z - MASK_BEHIND]} castShadow frustumCulled={false}>
            <boxGeometry args={[width, height, 0.02]} />
          </mesh>
        ))}
      </group>
    </>
  )
}
