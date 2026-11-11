# The Living Portfolio: working product spec

What the room is for and what's in scope. Adapted from my original v0.2 working guide (November 4, 2026).
[Architecture](../ARCHITECTURE.md) owns durable technical design, and [decisions](DECISIONS.md) records why.

## North star

A visitor enters a warmly lit, stylized indie-game room. A small developer sits absorbed at a cluttered desk. The
first meaningful click eases the camera into an angled bird's-eye view of the desk. An unfinished shake, jiu-jitsu
gear, soccer equipment, an open book, and the monitors become natural doorways into fitness, jiu-jitsu, soccer,
engineering, and software work.

The room should feel inhabited. Subtle environmental motion and the camera do the storytelling; elaborate character
animation is not a priority. Favor small stylized geometry, shared coherent materials, candlelight, screen glow,
asymmetry, angled books, and imperfect piles. One seated placeholder character is enough.

## Current direction

- **The monitor dashboard and the desk bubbles are approved.** `Projects` goes to the site, and `fitness` wakes the
  phone, which links out to Instagram. Other content panels remain deferred.
- **The look is a 3D-era adventure game,** my choice: Syberia, The Longest Journey, Professor Layton. The
  room already fits; the interface around it should too, with storybook serif type, framed panels with square or
  chamfered corners and warm trim, and hard shadows, instead of modern pills, rounded cards, blurred shadows, and
  springy motion. Screens that imitate real devices stay realistic.
- **Composition:** the elevated diorama angle and candlelit theme stay. Borrow from the
  [Hello World DSGN](https://helloworlddsgn.com/) portfolio its material richness, layered props, and local
  lighting, not its frontal camera. The v002 neon and pixel treatment was rejected.
- **The desk follows a photo of my real desk:** two monitors and a window with blinds. I removed the laptop,
  plant, gaming device, and lamp, so candlelight is the warm light.
- **The room** has a centred desk, a photo wall, a side table, and a seasonal corner of skis or a surfboard. The
  smoothie is "the shake" in this spec, and keeps its `fitness` bubble.

## First playable success

| Stage | Required experience |
|---|---|
| Load | Cozy room, desk, and placeholder character |
| First click | Camera glides into an elevated desk view |
| Second click | The shake's `fitness` bubble wakes the phone, showing authentic personal content |
| Return | Clear path back to desk and room |

Acceptance: the whole loop works in a desktop browser, models load without errors, and the composition feels
intentionally cozy and coherent. Equivalent content is reachable through keyboard-accessible alternate navigation.

## Scope

Use React + TypeScript, Vite, React Three Fiber, Drei, Blender, and reuse-first asset sourcing.

Do not initially build a giant walkable game, multiple finished rooms, a drinking animation, a custom backend, an
embedded AI chatbot, or paid generation at scale. Do not polish a portfolio shell before proving the scene and first
interaction. Meshy and Tripo are optional later tools for unusual personal items. Add GSAP only if basic camera motion
becomes cumbersome.

## Remaining milestones

1. **First journey:** built as the phone and the site on the monitor; keep the loop complete and repeatable.
2. **Launch:** the first deploy to `alexsigua.com` ([deploy](DEPLOY.md)).
3. **Review:** profile load performance on real hardware, prioritize gaps, and record the next iteration.

## Assets and quality

Source assets from Poly Pizza, KayKit, Kenney, Quaternius, and Poly Haven, or build them here. Check each asset's
actual license for website use and modification, and record author, URL, license, and attribution in
`assets/ASSET_MANIFEST.csv` before use. CC0 is the simplest route; other licenses need review of their actual
conditions. Check terms before uploading third-party models to AI services. Ship only optimized final assets.

Before expanding beyond the room, pass the [quality gates](TESTING.md): coherent art direction, repeatable navigation,
clean model loading, accessible content, recoverable sources, and measured performance.

## Open decisions

- Authentic content for the shake and later objects, and which object maps to which topic.
- Overlay panels versus mini-scenes, once the first overlay exists.
- Clean stylized look versus mild pixel texture or low-resolution rendering.
- Whether to add sound, and how it behaves.
- Character detail, and whether more idle animation improves the scene.
- Mobile interaction, after the desktop loop is proven.
- A backend, only if dynamic updates become difficult with local content files.

## Revision protocol

Keep this single spec and a short [decision list](DECISIONS.md). For each meaningful iteration, compare current
renders and browser screenshots to the north star, identify the largest gaps, separate cheap fixes from expensive
modeling, and apply the top approved change. Revise scope from evidence.
