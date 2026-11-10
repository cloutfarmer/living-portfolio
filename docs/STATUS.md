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
  - Credits, a title-fill loader, "Skip to portfolio" and "⤢ Full screen" pop-outs, and a museum placard with contact links.
- **Deferred on purpose:** other routes and content panels. See [decisions](DECISIONS.md).

## Last verified

Headless Blender 5.2.3 LTS and Playwright's Chromium, at 1440x900 unless noted. Frame rate was not measured unless
stated.

- **Scene:** `check_scene.py` reports 0 failures (19 capped warnings). `check_glb.py` reports the contract as OK, at
  2.86 MB, 49,594 triangles, 178 primitives and 0 images. The Room view was checked at 1440x900, 1920x1080 and 390x844.
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
- **Accessibility:** one live region announces each view, and leaving the computer or phone returns focus to "Desk".
- **CSP:** the policy in `infra/site.yml`, injected on every response, reported 0 violations across all views and
  `/projects/` (production preview). Live headers wait on a stack update.
- **Builds:** `npm run build`, `npm test` and `check-screen-animation.mjs` pass. CI runs `npm ci`, the build,
  `npm test`, the diff check, the repository scan, the public-safety check and `kit-check`. It doesn't render the scene.

## Could not verify

- Real hardware frame rate and load time, so there are no measured asset budgets yet. Headless frame rates aren't
  representative.
- Real mouse and trackpad feel, a real screen reader, real phones and touch devices, and keyboard-only use of the
  pop-out links.
- How the window, loader and pinboard animation feel over a long visit.
- Poly Pizza license pages block automated reads. Licenses are recorded as copied from those pages, and the source
  URLs of the trophy, bonsai and book props are inferred from file names.
- `settle_belt.py` simulates before the 0.75 scale, so the belt can't be re-dropped as-is.
