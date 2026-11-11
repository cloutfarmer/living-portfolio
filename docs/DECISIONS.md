# Decisions

Choices that still apply, and why. "I" is the owner, Alex. Remove an entry when it stops applying.
[The spec](PROJECT_SPEC.md) owns scope, and [architecture](../ARCHITECTURE.md) owns durable design.

## Scope

- **Routing is mostly deferred.** I chose not to route anything until the core is done; reactions that stay in
  the room are allowed. Lifted for the two desk bubbles (`software` → the site on the main monitor, `fitness` → the
  phone) and the website pop-out, "⤢ Full screen" beside "Leave computer", which goes in the same tab to
  `/projects/index.html?from=room` and shows "Back to the room". The loader's "Skip to portfolio →" opens the Computer
  view instead, so visitors see the site in the room and can pop out from there. On phones (under 768 px) it goes to
  the full site, since there the Computer view is that site full screen with the room's buttons over it; Cmd-click, the plain-HTML copy before
  the script runs, and the load-error screen still go to the full site. The view menu's copy was dropped for the
  placard's "See my projects".
- **The screen's interactivity is spelled out** on the monitor's sticky note only; a matching bottom hint was dropped
  as a duplicate, so screen readers get a hidden status line instead.
- **The person codes on the right monitor and the site lives on the main one,** as I laid it out: vim in a loop on
  the right with the head turned to it; clicking the main monitor turns the head as the camera swings in and the live
  page fades in. I chose this over the window switcher, which is parked (not deleted) for easter eggs.
- **The phone wakes to a lock screen with two Instagram notifications,** from my account `sigua.sauce` and my club
  `rondofootballclub`, each opening its account in a new tab. Chosen over a copy of the profile grid. They read like
  real notifications; a museum label beside the phone explains them. Lines vary per visit; the clock shows NJ time.
- **Live weather comes from the National Weather Service in the browser** (`api.weather.gov`, station KBLM, then
  KJFK): public domain, no key or backend, CORS allowed. It replaced Open-Meteo, whose free tier is non-commercial.
  No snow depth, so the ground whitens only while snowing. Visitors' IPs reach NOAA. Credited as a courtesy.
- **Stack:** React, TypeScript, Vite, React Three Fiber and Drei, no backend. `@react-three/postprocessing` approved
  for bloom, vignette and AgX. Camera springs in `CameraRig.tsx` replace GSAP. The clock is built in the browser.
- **Hosting: AWS at `alexsigua.com`,** my choice for low cost and to show AWS skills: S3 behind CloudFront
  with Origin Access Control, ACM and Route 53, as CloudFormation in `infra/site.yml`. `.com` over `.io` (about 5x
  the price).
- **Branches: `work/<topic>-YYYYMMDD` → `main` → `prod`, in both repositories, and only `prod` deploys,** the same
  flow as my other projects. Changes are made in a separate worktree and land on `main`; a commit that passed CI is
  promoted by fast-forward, so `prod` is always an exact `main` commit and merging to `main` never ships by itself.
- **GitHub Actions deploys content through OIDC; infrastructure stays manual.** No AWS keys are stored: GitHub's
  short-lived token is exchanged for a role that trusts only this repository's `production` environment (which admits
  only `prod`) and can only do what `deploy.mjs` does. Stack changes stay a reviewed change set, because a role able to
  change IAM, DNS or the distribution would be far more dangerous to leak than one that uploads files.
- **The private site is read through a GitHub App, not a deploy key or personal token.** Its installation tokens last
  an hour at most, are requested for one repository and one permission at a time, and belong to no person's account.
  The private site's push starts the deploy here with `workflow_dispatch` on `prod`, because `repository_dispatch`
  always runs on the default branch, which the environment rule and the role's trust would refuse.

## Look

- **Elevated camera and candlelight.** I rejected the v002 neon and pixel direction. Use the
  [Hello World DSGN](https://helloworlddsgn.com/) reference's principles, not its camera or artwork.
- **Only the candle and the sun cast shadows.** The candle's follow its angle and fade with distance; the flame, wax and
  the smoothie's clear cup don't cast. The sun casts so its light enters at its real angle; the candle fades to about
  20% in full sun.
- **The sun gets in through an invisible sheet with a window-shaped hole** behind the solid wall, sliding along the
  sun's line, so it never blocks the candle. The room has no ceiling.
- **The window shows a live beach drawn by a shader on the glass** (`Outdoors.tsx`), from a fixed eye inside the room,
  so the GLB didn't change. The sun is computed for a rounded point on the central NJ coast,
  because it's local; the window still faces south, so the view is stylized. Visitors are told "central NJ", because
  the weather comes from an airport station inland. The clock shows NJ time to agree with the window.
- **The first launch is the title filling with light,** my choice over a wick toward the candle. "Alex Sigua"
  shows from first paint in plain HTML. Each status reports a real load step; first visits hold each briefly (about
  2.8 s total), a click or key skips, return visits skip statuses, and weather waits 1.5 s at most.
- **The landing's words are a museum placard** (`Placard.tsx`), so the room reads as an exhibit. My wording: software
  engineer, open to full-time roles and freelance projects, with the projects on the computer. It sits top-left under
  the view menu, where the eye lands first, because visitors (recruiters especially) could miss that the work is on the
  computer. Its filled-brass "See my projects →" button goes straight to the Computer view. It carries GitHub, LinkedIn and Résumé links
  (`ContactLinks.tsx`; links out, not routes), as do the no-JS page and the load-error screen. No email: this repo is public.
- **Type is Alegreya,** self-hosted (88 KB), replacing Fraunces for storybook letterforms. Weight
  300 renders as 400. Device imitations (monitor, phone) keep system fonts.
- **Every interface panel uses the desk bubbles' frame:** parchment in brass, cut corners, hard shadow, `.panel` in
  `styles.css`. The view menu stays plain text with a gold diamond, so the room stays uncovered.
- **Nameplates only on things whose click changes the view** (the desk and closed pinboard). Stay-put reactions, the
  candle and blinds, get the pointer cursor only. One exception shows without hover: "Projects · live on this screen"
  over the main monitor glows slowly in the Room view until the visitor first reaches the desk, computer or phone, so
  the goal is visible in the scene itself. It replaced the bottom "Click the desk" hint, which the placard and this
  nameplate made redundant.
- **The candle blows out and the blinds tilt on a click** (`Reactions.tsx`). The candle relights after about 4.5 s;
  the blinds are one morph target, so no extra draw calls.
- **The left-wall corner changes with the season:** skis and poles December to March, a fish surfboard otherwise, by the
  NJ month. I ski and surf. Both are in the GLB; `?season=ski|surf` forces one. It replaced
  the dog, which never fit the style.
- **One perspective camera.** A 1° lens replaces orthographic, so widening to 38° sits the visitor down with no swap.
  Springs keep velocity, so a new destination bends the path. Drag peeks and the wheel does nothing (chosen over free
  orbit, so the framing returns). Sitting lines up with the screen first; a sphere around the head keeps the camera out.
- **The photos are a pinboard:** overlapping prints that separate when clicked as the camera comes close; that
  close-up is the deepest level, as single photos don't zoom (my call). Esc or a click off the board steps
  back. Built in the browser with per-print shadows, because the room's shadows are drawn once. With more photos than
  prints, one changes every 45–75 s with a 2.4 s fade, none while open. The shimmer is rationed: 120 ms rest, 8 s per
  print, one at a time. Photos are redrawn as 96-pixel art with 10 shades per channel (`PIXEL_ART`) to match the room;
  dithering was dropped. They ship at 256 px (`LONG_EDGE` in `prepare-photos.mjs`), 2.6× what that art needs.
- **In `Room.tsx`:** wood grain is a shader (baked lighting not chosen), and the desk view is a steeper bird's-eye from
  `DESK_CAMERA`, not Blender's `DESK` camera. Coffee glare comes from leaned normals, as there's no environment map.
- **The two shelves match** in oak and brackets. **Removed props** stay out unless I ask for them back.

## Scene pipeline

- **`build_scene.py` is the source of truth,** replacing 15 earlier one-off passes that couldn't be re-run.
- **Known flaws are capped, not hidden,** at their measured size in `lib/scene_rules.py`. Fix one and delete its entry;
  never raise a cap unless the measurement itself changes.
- **Static parts merge at export,** in memory, so Blender keeps them editable. **`lib/layout.py` shifts whole prop
  files** at build time instead of rewriting hundreds of literals.
- **The room's GLB stays plain glTF:** no `gltf-transform`, Draco or meshopt, so every vertex ships as exported and no
  decoder is needed. The deploy Brotli-encodes it instead (2.28 MB → 0.53 MB), because CloudFront doesn't compress
  `model/gltf-binary`. Meshopt would be smaller still, but it rewrites the geometry; reopen it only if measured load
  times call for it.
- **The GLB carries no UVs** unless a material samples an image (`export_web_glb.py`). The site draws its screens on
  its own geometry and its grain from world position, so UVs were unused and about 20% of the file.

## Props

- **Person:** a rigged model posed by joint targets in `props/character.py`, frozen to plain meshes (no skeleton).
- **Hands fit the keys:** scaled to 0.85, fingertips solved onto home-row keys, one shape key per finger.
- **Keyboard, mouse and chair are licensed models,** scaled 1.17 (the person against a real one). The chair matches the
  person's width with a shortened gas column.
- **Everything is sized to the person:** furniture and props shrink by 0.75 as groups; the room shrank around them.
  Photo frames and the window keep their size.
- **Belt:** `tools/settle_belt.py` is its source and its result is stored. One blue stripe, as I specified; the
  floor section is straight on purpose. v021 and v030 translated or trimmed it rather than re-simulating.
- **The gym bag lies open with a towel and shirt,** dropped by `tools/settle_bag_items.py` at the bag's authored size.

## Imported models

- **Sources stay in `assets/source/polypizza/`,** read at build time, so scenes stay rebuildable.
- **The smoothie keeps the `Shake_` names** for the site contract; labels are flat text meshes, so 0 images.
- **CC-BY needs on-site attribution,** hence Credits. It isn't a route or content panel.
- **Bonsai on the side table,** at my request; not a high shelf, because the person couldn't tend it.
- **Characters aren't covered by model licenses.** Snorlax (Nintendo) was swapped for houseplants; Gundam
  (Sunrise/Bandai) is set aside.
