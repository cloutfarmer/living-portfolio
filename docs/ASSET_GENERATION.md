# Asset generation

How to add or change anything in the scene. Validated against Blender 5.2.3 LTS, local only. Read the safety rules in
[AGENTS.md](../AGENTS.md) first.
Headless commands here don't touch an open Blender session.

## Workflow

1. **Brief.** Fill in the template at the end, noting what the object says about the person.
2. **Reuse or build.** Characters, animals and realistic plants: look for an existing asset. Hard-surface props: build
   them. For a download, see [imported models](#imported-models) first.
3. **Plan contact.** List each part, its real size, and what it rests on; work out heights from the surface below.
4. **Build.** Edit source in `blender/scripts/props/`, not a saved `.blend`; list new files in `PROPS`.
5. **Check and review** after each stage (boxes, detail, materials), then look at every view on the review sheet.
6. **Record.** Export, check the GLB, follow [testing](TESTING.md), and update [status](STATUS.md) in place.

## Commands

Run from the repository root. Scene files are never overwritten: set `SCENE` to the next unused version after the
newest in `blender/scenes/` (v038 is the newest as of this writing). Try risky changes on a scratch path outside
`blender/scenes/`; `npm run export-scene -- <path>` exports any file. `settle_belt.py` is stale: it simulates at the
room's size before `SCALE`, so fix that before re-dropping the belt.

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
SCENE=blender/scenes/corner-desk-v038.blend
SHEET="$PWD/blender/renders/corner-desk-v038-review.png"
RUN=("$BLENDER" --background --factory-startup --python-exit-code 1)

"${RUN[@]}" --python blender/scripts/build_scene.py -- "$SCENE"            # build from source
"${RUN[@]}" "$SCENE" --python blender/scripts/tools/check_scene.py         # measure; exit 1 = a rule broke
"${RUN[@]}" "$SCENE" --python blender/scripts/tools/review_sheet.py -- "$SHEET" # fixed views, about 15 s
(cd web && npm run export-scene)                                           # newest scene -> the site's GLB
python3 blender/scripts/tools/check_glb.py assets/processed/corner-desk.glb

"${RUN[@]}" --python blender/scripts/tools/settle_bag_items.py             # re-drop the bag's clothes
python3 blender/scripts/tools/compare_glb.py old.glb assets/processed/corner-desk.glb  # refactor changed nothing?
python3 -I blender/scripts/tools/check_glb.py "$HOME/Downloads/model.glb"  # measure a download; ignore its FAILs
```

## Rules

| Rule | Why |
|---|---|
| Use real metres, with the base resting on its surface | The desktop has floated 15 mm since v001 |
| Use `lib/builders.py`; bevel hard edges, with `size` not `scale` under a bevel | Consistent bevels; scale distorts them |
| Keep objects separate if they animate; merge at export otherwise | Editable in Blender, cheap in the browser |
| Only merge parts with equal rotation and scale | Others corrupted shading; the exporter refuses |
| Delete objects; never hide them | Hidden objects fail the check |
| Start cloth near its resting shape, clear of edges; run it well past looking settled | Rug edge; a sliding shirt |
| Store simulated results in `props/data/`; translate them when neighbours move | A rerun won't match an approved shape |
| Check what the camera sees | A steam effect was built for a mug hidden behind a monitor |
| Fix a failed check at its cause; re-run it after moving any prop | Never raise a limit in `lib/scene_rules.py` |
| Leave 1 mm of air between resting parts, or seat them 1 mm in | Exactly touching faces read as overlaps or floating |
| Close tubes with `caps=True` on `curve()`; level handles where a curve lies on something | Bogus depths; dips |
| Compare against constants before making a `Vector` | It's single precision, so `point.z == CONSTANT` turns false |

**Style**, from the [spec](PROJECT_SPEC.md) and [style reference](https://helloworlddsgn.com/): small stylized
geometry, shared materials, the candle as the warm focal point, asymmetry, signs of use, and personal objects over
generic ones. Scatter desk props in calculated chaos, each placed and turned for the seated person with `facing()` in
`props/desk_clutter.py`. Then group it: a few clusters by use with clear space between (gym things by the dumbbells,
empties pushed back together, PC and ball under the desk), and nothing crowding the candle. The moment: the person
just got in from jiu-jitsu, recovering with the shake, coffee going.

## Imported models

1. **Tell the user the cost and license first,** using the measuring command. They decide. Read the license page
   yourself if fetches are blocked. A license covers the file, not a character or brand it depicts.
2. **Add it:** the GLB in `assets/source/polypizza/`, a row in `assets/ASSET_MANIFEST.csv`, loaded with `imported()`.
   A CC-BY model also needs a Credits line in `web/src/App.tsx`, saying it was modified.

Cost until profiling sets budgets (each primitive is roughly a draw call; `imported()` joins parts by material):
cheap under about 2,000 triangles with 1–3 materials and no images; worth a look up to about 10,000; over that,
or with large images, reduce it or build it here.

- **Recoloring:** `split_by_faces()` splits one mesh. Look for loose pieces first; import splits vertices at UV seams.
- **Rotation:** the importer's quaternion mode ignores `rotation_euler`. `imported()` resets it; other code must too.
- **Labels:** `flat_text()` adds one with no image. On low-poly models, fit it to a flat side facing the ROOM camera.
- **Rigged models:** `props/character.py` poses by joint targets, then freezes to meshes. Set a new shape key's `value`
  to 0, or the checks measure it applied.
- **Names and hovering parts:** keep names the site needs (the smoothie's `Shake_lid`); `imported(settle=...)` lowers
  named parts to the model's base.

## Where things sit

`lib/layout.py` shifts each prop file along x at build time, then shrinks it to the person's scale (`SCALE`, 0.75)
toward a pivot, so positions in `props/` are authored, not final (`props/character.py` is shifted only). A new desk
file needs entries in `SHIFTS` and `PIVOTS`. Anything stored in world space applies these itself. To move the window,
edit `WINDOW_SHIFT`. These browser positions don't follow the layout, so update them by hand:
`CLOCK_POSITION` in `Life.tsx`; `DESK_CAMERA` in `Room.tsx` and `SEATED_DISTANCE` in `components/Monitor.tsx`;
`WALL_X`, `BOARD` and `PRINTS` in `PhotoWall.tsx`.

- **Side table:** items stop below height 1.135, under the pinboard. Skis and surfboard share a left-wall spot.
- **Photo wall:** the zoomed camera sits at x -0.11, so nothing may stand between x -1.06 and -0.11 in front of the
  pinboard (y below 1.295) at heights 1.135 to 2.6.
- **Low shelf:** items stop below height 2.09, where the clock starts, and behind y 1.295. The bushy plant's pot sits
  on the shelf and its leaves reach y 1.247, stopping short of the wall at 1.63.
- **Rug:** top at 0.0355 inside x -0.695 to 2.655 and y -1.47 to 1.03; floor 0 elsewhere. Wide windows crop its front.
- **Photos:** one per print, 9 (more make the wall swap them). `npm run prepare-photos -- <folder>` (in `web/`) writes
  `web/src/pinboard/` upright, 512 px, JPEG ≤ 100 KB, EXIF/GPS removed, in numeric name order, read across the 3×3
  board row by row. Match each print's shape in `PRINTS` to its photo, and record them in `ASSET_MANIFEST.csv`.

## Browser differences

- Procedural color (such as `Warm_Oak` grain) exports flat, and `Room.tsx` redraws the grain. Noise bumps are dropped.
- Area lights become wide spot lights tuned in `Room.tsx`. Soft shadows and bounce become hard candle and sun shadows
  plus ambient. Flame keyframes are kept; candle light keys are dropped and `Room.tsx` flickers it instead.
- `BLENDED` alpha is kept but still casts a solid shadow unless listed in `NO_CANDLE_SHADOW` in `Room.tsx`.

AgX tone mapping washes out color, so unlit images need far less than full brightness (photos use 0.3 to 0.42). The left
side is dim: brighten dark colors, or give small text a little emission, as `Label_Cream` does.

**Names the site depends on** are listed in `lib/site_contract.py`; both checks fail if one goes missing. Add new
lookups there, and never add those objects to `MERGE` in `tools/export_web_glb.py`. **Budgets:** none until
real-hardware profiling; current size is in [status](STATUS.md). Report a prop that adds noticeably to it.

## Brief template

```text
Asset:          name, and the file in blender/scripts/props/ it belongs in
Purpose:        what it says about the person
Source:         built here, or a licensed asset (URL and license)
Footprint:      width x depth x height, in metres
Rests on:       the object and the height of its top surface
Parts:          each part, its size, its material, what it touches
Seen from:      ROOM, DESK, or both; what must be readable at that size
Moves:          nothing, or what moves and where that code lives
Done when:      checks pass, sheet reviewed, and the visible result you expect
```
