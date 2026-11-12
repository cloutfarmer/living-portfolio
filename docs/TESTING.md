# Testing

What to run, and how. [Status](STATUS.md) records the latest results.

## Every change

```sh
git diff --check -- .
node .agent/repository-scan.mjs .
```

The diff check skips untracked files. The scanner reads tracked and untracked files, checks for secrets and environment
files, and rejects files over 5 MiB. Neither proves behavior or license compliance.

For site changes, also run from `web/`:

- `npm run build`: typechecks and builds.
- `npm test` runs three scripts, and CI runs it too:
  - `check-sky.mjs`: the sun against stored sunrise and sunset times, the moon's phase, the beam, daylight and weather
    readings.
  - `check-screen-animation.mjs`: 20 s of the real animation callback. The right monitor's old bars stay hidden under
    vim, typing reaches the shared desk state, and the head turns as `desk.focus` changes.
  - `check-static-intro.mjs`: the name, title, site link and contact links in `index.html` match the components.

Then check the site in a browser (below).

## Scene checks

Commands are in [asset generation](ASSET_GENERATION.md). These cover `corner-desk` only: the clock and photo wall are
outside it, so check those in the browser.

- `check_scene.py`: floating parts, overlaps, sizes, material slots, default names, hidden leftovers, and names the site
  needs. Known flaws are capped at their measured size in `lib/scene_rules.py`, so worse ones fail.
- `check_glb.py`: names the site needs and the flicker animation, on the exported file. Sizes are only reported.
- `compare_glb.py`: proves a refactor changed nothing visible, node by node.
- `settle_belt.py`: refuses to store the belt unless it has stopped moving and isn't pushed into anything.
- `settle_bag_items.py`: refuses to store the clothes unless they've stopped moving, aren't inside the bag, and landed
  over its opening.

To test the checks themselves, run them on a copy of the scene with a known fault added (for example, sink a
forearm into the desktop) and confirm they report it. The older checkpoints used for this live in the maintainer's
private archive.

## Browser checks

Run these on any change the site shows. Say which port you tested: Vite takes the next free one, and other sessions may
hold 5173. In development, `window.__renderer` and `window.__scene` expose the renderer and scene.

- **Use real input.** Drive the mouse and keyboard through the browser, such as Playwright's `page.mouse`. Events
  dispatched from page scripts don't reach the scene's click handling.
- **Wait for the camera.** A move takes about a second, and a screenshot during one looks like a wrong angle. Read the
  camera's position, and wait at least 2 seconds.
- **Trace camera moves frame by frame.** Record the camera in `__scene.onBeforeRender`, in full Chromium with
  `--headless=new --use-angle=metal` (headless shell rendered no frames). Look at mid-move screenshots too: the numbers
  once passed a camera flying through the person's head.
- **Wait for the right state.** Wait for something that only exists after it, such as `.placard-visible`, not for
  `.intro` to be gone.
- **Try sizes:** 1440x900 and 1920x1080 (the Room view crops differently), plus 390x844 for phones.
- **Look up close.** Orbit limits stop short of small details, so set the camera directly in a test, then reload. A
  label can pass every number and still read wrong.
- **Check the paths:**
  - Hover and leave a frame: one shimmer per visit, then rest, with the frame never behind the wall.
  - Click the pinboard open, click a print (nothing happens), then leave two ways: off the board, and Esc.
  - Esc from Projects to Desk to Room. Clicking the monitor from Room stops at Desk.
  - Sitting at the computer: the head turns to the main monitor and the live page fades in, then takes clicks and the
    wheel. Leaving partway works, and leaving fades the page before the camera moves. "⤢ Full screen" reaches
    `/projects/index.html?from=room`, and "Back to the room" returns.
  - Reverse a move partway, and press Esc during a sit.
  - Tab through the controls, open the pinboard from its button, and open Credits.
  - Turn on reduced motion.
  - Set the sky by URL, in development only: `?at=2026-06-21T13:00-04:00` holds the sky and clock, and `?weather=`
    takes `clear`, `overcast`, `rain`, `snow`, `fog` or `storm`. Try 9am and 3pm for the beam's sweep, June and
    December for its height, and a clear night for the candle. Block `api.weather.gov`: the room must still load.
  - `?season=ski` or `?season=surf` forces the seasonal corner. Click the candle and the blinds.
  - Confirm the desk click shows both bubbles and the console has no new errors.
  - The phone: the fitness bubble, the phone, and the Fitness button all wake it upright to NJ time. Two notifications
    arrive (focus on the first), pulse once, and the label fades in beside it (a single line under the view buttons
    below 768 px or narrower than 5:4). Each opens its Instagram account in a new tab and the room stays. Lines differ
    on the next visit. Leave by Esc, a click off, and Put phone down, and interrupt the move. A phone click from Room
    stops at Desk. At 390x800 the bubbles don't overlap and nothing covers the view buttons.
- **Draw calls:** set `info.autoReset` to false, call `info.reset()`, and average over about 30 frames.
- **Clean up.** Playwright writes to `.playwright-mcp/`, which Git ignores.

## First playable acceptance

Planned, and can't fully pass while the content step is deferred.

1. Review wide and desk-close renders: warm light, inhabited asymmetry, compatible materials, a coherent silhouette.
2. In a desktop browser, check the console and network for model failures and missing textures.
3. Click the desk, select the shake's `fitness` bubble to show authentic content on the phone, and step back to
   return. Repeat with no stuck camera state.
4. Reach the same content with keyboard navigation, including the return path.
5. Verify scenes, builders, manifest, and spec are versioned, attribution is satisfied, and no secrets are present.
6. Profile load performance on real hardware, and record the largest gaps and the next iteration.

Still to choose: supported browsers, concrete accessibility checks, and performance thresholds from measured profiles.

## Blender bridge

The single-cube connection gate passed on November 4, 2026. The procedure is in [setup](SETUP.md). Blender Python can run
arbitrary operations, so follow setup's approval and backup steps, and don't run it as part of routine checks.
