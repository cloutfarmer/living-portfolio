# Living Portfolio architecture

Durable design and module boundaries, first drafted from the working product spec v0.2 (November 4, 2026) and
updated as the room was built. Code is the evidence; validation lives in [status](docs/STATUS.md), and product scope
in [the spec](docs/PROJECT_SPEC.md).

## Purpose

Tell a personal story through an inviting, stylized room and its interactive objects. Prove the environment and first
desk interaction before expanding.

## Runtime shape

Blender scenes are built headlessly from Python sources in `blender/scripts/`. The official Blender Lab MCP bridge is an
optional interactive path for a local agent; a cloud-only session cannot be assumed to control Blender on the laptop.
Scenes and licensed assets become one optimized GLB for a Vite + React + TypeScript app using React Three Fiber and
Drei. There is no backend; local content files suffice until evidence justifies more.

## Modules and boundaries

| Path | Responsibility |
|---|---|
| `blender/scenes/` | The current `.blend` checkpoint; the newest `corner-desk-vNNN` is exported |
| `blender/renders/` | Progress stills and a sample review sheet |
| `blender/scripts/build_scene.py` | Builds the scene from `props/` and `lib/`; the scene's source |
| `blender/scripts/lib/layout.py` | How far each prop file shifts along x at build time |
| `blender/scripts/tools/` | Export, scene and GLB checks, review sheet, cloth settling |
| `assets/source/` | Original licensed source assets, read at build time |
| `assets/processed/` | What the browser loads: the room's GLB (and the ignored dashboard copy) |
| `assets/ASSET_MANIFEST.csv` | Author, source URL, license, attribution requirements |
| `web/src/` | Scene, navigation and camera; see below |
| `web/src/pinboard/` | Images for the pinboard |
| `web/scripts/` | Dashboard build, scene export, sky and screen checks, deploy |
| `infra/` | CloudFormation for hosting |
| `docs/` | Spec, decisions, setup, tests, and validation evidence |

In `web/src/`: `Life.tsx` motion and the clock, `PhotoWall.tsx` the pinboard, `Outdoors.tsx` the window and sun,
`Reactions.tsx` the candle and blinds, `components/` the panels, monitors and phone, `motion.ts` the shared
reduced-motion flag, tap slop and spring, and `sun.ts`/`weather.ts` the sky and live weather. The site ships optimized exports, not source assets. Blender collections are `Room`, `Furniture`,
`Clutter`, `Lighting` and `Character`, with named objects and shared materials. The clock and pinboard are built in the
browser: scene checks can't see them, and their world coordinates don't follow `layout.py`.

The camera has one owner, `CameraRig.tsx`, and one perspective camera. Views form a ladder: `ROOM` (three-quarter wide
view) holds `DESK` (angled bird's-eye) and the opened pinboard, and `DESK` holds `COMPUTER` (seated). A click goes one level
deeper; Esc or a click off the object goes back one. The nav buttons can jump levels. Each shot is a target, angle,
visible height, lens and clip distance, and damped springs move between them. A 1° lens gives the diorama its
near-orthographic look. The desk bubbles lead to the site on the monitor and to the phone; other content is deferred.

## Invariants

- Keep the room → desk → content → back loop repeatable; visitors must not get trapped in a camera or content state.
- Provide keyboard-accessible navigation reaching the same content, so fine 3D mouse interaction isn't required.
- Review asset permissions and record provenance before use; modifying a model doesn't grant permission to publish it.
- Inspect proposed Blender Python and affected paths before running it, use a dedicated workspace, and keep recoverable
  scene checkpoints. Don't run competing Blender bridges.
- Keep source scenes, scripts, manifest and spec versioned; never store secrets in the repository.
- Set polygon and texture budgets, and supported browsers and devices, from real profiling, not guesses.

## Hosting

The production site is static: `web/dist`, with the personal site copied in at `/projects/`. It's served from a
private S3 bucket through CloudFront at `alexsigua.com`, defined in `infra/site.yml` (CloudFormation, us-east-1)
and uploaded by `web/scripts/deploy.mjs`. There's no server, and the personal site's routes are `#/` hashes, so no
fallback routing is needed; a CloudFront Function only maps folder paths to `index.html` and `www` to the apex.
Hashed assets are immutable, HTML always revalidates, the room's GLB keeps its name but is requested with a hash of
its contents (`vite.config.ts`), and it goes up Brotli-encoded
([decisions](docs/DECISIONS.md)), and a deploy refuses uncommitted changes. A push to `prod` in either repository
deploys through GitHub Actions (OIDC, no stored keys), while `infra/site.yml` stays a manual step. Procedure,
costs, and rollback are in [deploy](docs/DEPLOY.md).

## Dashboard integration

The independent sibling `portfolio-dashboard` (a separate, private repository) owns project content. The room serves
a copied build of it at `/projects/index.html` in development and production, so no dashboard server runs.
`npm run dev` (`predev`) runs `web/scripts/prepare-dashboard.mjs --optional`, which builds the sibling checkout as it stands
(pull its `main` first; `DASHBOARD_DIR` picks another) into ignored `assets/processed/projects/`, clearing the old
copy first; without a checkout, `--optional` warns and goes on, while a deploy stops. Vite copies it to `web/dist/projects/`. `assemble-dashboard.mjs` builds both apps; `dashboard-build.json` records the source revision
and output hash for local checks only.

`COMPUTER` mode opens the lens to 38° as the camera closes in, then mounts an interactive iframe on `Main_Display`.
Until then the monitor shows `dashboard-preview.jpg`, and the iframe fades in over it, so nothing jumps. Escape inside
the site posts a versioned `portfolio:exit` message, checked against the same origin and iframe source. Phones get a
full-window surface. Leaving fades the iframe out while the camera holds (DOM draws over the scene), then the camera
reverses. The window switcher (`AltTab.tsx`, with its own `AltTab.css`) is parked, unmounted, for a future easter egg.

`components/SiteLink.tsx` pops out to `/projects/index.html?from=room` in the same tab, from the computer and the
load-error screen. `web/index.html` holds the loader's name and unlit title in plain HTML, so they show at first paint,
plus a `<noscript>` link to the site; `Intro.tsx` swaps the plain copy for its own in place. The site reads
`from=room`, skips its intro and links "Back to the room" to `../`. The monitor's sticky note (a canvas texture in
`Monitor.tsx`) says the screen is live; screen readers get a hidden status line.

The right monitor runs vim (`components/VimScreen.tsx`, a canvas texture on `Right_Display`; its old meshes are
hidden). Characters go in only while the hands type, through shared state in `desk.ts`, which also holds the person's
focus: `Monitor` sets it and `Life` eases the head between the screens. Reduced motion draws the file whole and still.
