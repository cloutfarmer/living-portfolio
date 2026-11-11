# Status

What's built, what has been checked and how, and what hasn't been checked yet. Update lines in place; don't add dated
entries.

## Current state

- **Environment:** local development, with hosting at `alexsigua.com` defined in `infra/site.yml` ([deploy](DEPLOY.md)).
  `npm run dev` in `web/` serves the room and builds the separate personal site into `/projects/`.
- **Scene:** `blender/scenes/corner-desk-v038.blend`, exported to `assets/processed/corner-desk.glb`.
- **In the browser:**
  - Room, Desk and Computer views.
  - Desk bubbles lead to the live site on the main monitor and to the phone (an Instagram lock screen).
  - Vim types on the right monitor.
  - A pinboard of nine pixel-art photos.
  - Seasonal skis or surfboard.
  - Candle and blinds reactions.
  - A window with the real sun and moon and live National Weather Service weather.
  - Credits, a title-fill loader whose "Skip to portfolio" opens the Computer view (the full site on phones), a "⤢ Full screen" pop-out, and a
    museum placard under the view menu with a "See my projects" button and contact links.
  - Until the visitor first reaches the desk, a glowing "Projects" nameplate over the main monitor points at the
    computer.
- **Deferred on purpose:** other routes and content panels. See [decisions](DECISIONS.md).

## Last verified

Headless Blender 5.2.3 LTS and Playwright's Chromium, at 1440x900 unless noted. Frame rate was not measured unless
stated.

- **Scene:** `check_scene.py` reports 0 failures (19 capped warnings). `check_glb.py` reports the contract as OK, at
  2.28 MB (0.53 MB Brotli), 49,594 triangles, 178 primitives and 0 images. The Room view was checked at 1440x900,
  1920x1080 and 390x844.
- **Smaller first load** (production build, served locally with the deploy's headers): dropping UVs left every
  triangle's positions, normals and shape-key deltas identical. Room and pinboard screenshots at 1440x900 and 390x844
  match the previous build. Through Brotli, the loader counts the GLB's decoded bytes against its real size. At a
  throttled 2 Mbps, the GLB took 4.8 s instead of 17.7 s. Not yet checked through live CloudFront.
- **Room reactions:** `?season=ski` and the surfboard show. The candle blows out, smokes and relights. The blinds
  close and dim the window, and stink lines rise over the gym bag.
- **Panels:** brass-framed parchment panels and nameplates show at 1440x900 and 390x800 with no page errors. Reduced
  motion stops panel animation.
- **Imported props:** fingertips sit 3–10 mm over their keys and every finger animates. The candle lights the desk at
  night, and Credits list each CC-BY author.
- **Pinboard:** opened prints never overlap, and Esc or a click off the board steps back. 60 fast passes showed 0
  shimmer sweeps. One photo changes every 50–64 s, never while open. The Room view takes 219 draw calls at noon.
- **Loader and skip link** (production preview): the title is centered within 0.01 px, and the fill never goes
  backwards. It takes about 2.8 s on a fast connection. With JavaScript off, the name, title and skip link still show
  and work.
- **Weather and sky:** the live call goes to `api.weather.gov` and reaches the scene. With the API blocked, the room
  still loads, and `?weather=rain|snow|storm` forces a sky. `check-sky.mjs` checks sun elevation within 0.5° of stored
  sunrise and sunset, moon phase, and the NWS reply shapes. NJ clock time holds under a London browser time zone.
- **Camera:** a desk click covers 36–39% of its path in 200 ms and settles in about 0.9 s. Reversing mid-move settles.
- **Monitors:** the live site loads in about 2.2 s, and the head turns to the main monitor and back. "⤢ Full screen"
  lands on the site with "Back to the room". Scripted wheel scrolling reaches the bottom of a project page,
  and "← All projects" keeps the live page on the screen (production build).
- **Room-only preview:** with no personal site checked out, `npx vite` loads the room, and Room → Projects → Leave
  computer returns to the Desk view with no page errors.
- **Failure paths** (production preview): a failed GLB or no WebGL shows the name, role, portfolio and contact links;
  a failed photo hides only the pinboard. With JavaScript off, the contact links also show.
- **Landing guidance** (dev server, 1440x900, 1024x768 and 390x844): the placard sits under the menu with no overlap
  of the menu, Credits or the monitor nameplate. "See my projects" opens the Computer view with the live site;
  "Leave computer" focuses "Desk", and back in the room the nameplate is gone. Reduced motion stops the nameplate's
  glow. The loader's "Skip to portfolio" lands on the Computer view with the live site, 0 page errors. At 1024x768
  the placard covers most of the pinboard. On phones the placard is compact, its button and links on one row, and the room drops
  into the spare height below it. Playwright WebKit at 375x548, 390x664 and 430x739 shows the monitor nameplate clear of
  the placard; at 320x568 the placard fits the width.
- **Accessibility:** one live region announces each view, and leaving the computer or phone returns focus to "Desk".
- **CSP:** the production build, served with the exact header from `infra/site.yml`, logs 0 page errors, 0 console
  errors and 0 CSP violations through Room, Desk, Projects, Fitness, Pinboard, "Skip to portfolio" and "Back to the
  room". An earlier check missed a `WebAssembly.instantiate()` page error on every load, from drei's default meshopt
  decoder; the room now loads with Draco and meshopt off. The live site sends the header.
- **Builds:** `npm run build`, `npm test` and `check-screen-animation.mjs` pass. CI runs `npm ci`, the build,
  `npm test`, the diff check, the repository scan, the public-safety check and `kit-check`. It doesn't render the scene.

## Could not verify

- Real hardware frame rate and load time, so there are no measured asset budgets yet. Headless frame rates aren't
  representative.
- Real mouse and trackpad feel, a real screen reader, real phones and touch devices, and keyboard-only use of the
  pop-out links.
- The phone's lock screen on a real iPhone. It's now a flat page laid over the glass, not a CSS 3D transform, which
  the 1° lens broke in WebKit. Playwright WebKit with iPhone 13 emulation and Chromium at 390x844 and 1440x900 show it
  on the glass, with the notifications opening Instagram.
- How the window, loader and pinboard animation feel over a long visit.
- Poly Pizza license pages block automated reads. Licenses are recorded as copied from those pages, and the source
  URLs of the trophy, bonsai and book props are inferred from file names.
- `settle_belt.py` simulates before the 0.75 scale, so the belt can't be re-dropped as-is.
