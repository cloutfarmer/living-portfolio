# Viewing the scene in Blender

Open the newest `blender/scenes/corner-desk-vNNN.blend` (the highest number) with File > Open. The scene is named
to match, such as `CornerDesk_v035`, and its active camera is `ROOM`.
The clock and photo wall aren't in this file: they appear only on the website.
The wider room runs past this camera's frame; the website fits itself to the room.

1. For the finished still, use Render > View Render after a render has completed.
   If the result is empty after reopening Blender, use Render > Render Image,
   or open the matching `blender/renders/corner-desk-vNNN-review.png` in macOS Preview.
2. In the large 3D viewport, choose View > Cameras > Active Camera. This shows
   our elevated composition. Numpad 0 is the equivalent shortcut; the menu works
   on Mac keyboards without a number pad.
3. For actual lighting and materials, click the rightmost of the four shading
   spheres at the viewport's upper-right: Rendered. Give the image time to settle.
   Solid mode shows geometry without the intended light/material appearance.
4. To inspect other sides, drag the colored axis gizmo in the upper-right of the
   viewport. Use its magnifying-glass control to zoom. Return through
   View > Cameras > Active Camera. Orbiting the view does not ordinarily move
   the scene camera; keep Lock Camera to View disabled.
5. To inspect candle animation, use the Timeline's play triangle at the bottom.
   The candles have keys on frames 1–120. Pause with the same control. Rendered
   playback can be noisy or slow because Blender recalculates lighting.
   For a cleaner comparison, pause at different frames and let each settle.
6. If outlines and helper lines distract you, toggle Show Overlays using the
   overlapping-circles icon in the viewport header.

The PNG is a still; it cannot show flicker. The scene contains the animation,
but no finished animation video has been rendered.

References: [camera view](https://docs.blender.org/manual/en/latest/editors/3dview/navigate/camera_view.html),
[viewport shading](https://docs.blender.org/manual/en/latest/editors/3dview/display/shading.html).
