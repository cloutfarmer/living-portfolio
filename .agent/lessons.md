# Lessons

Agents read this on every review. Add one rule per real failure, with its date and
what happened. Don't add rules for failures that haven't happened.

- 2026-11-04: v012 deepened the desk and sank the character's arms into it, found only at
  the final render. Run `check_scene.py` after any change that resizes something others touch.
- 2026-11-04: the belt's rank stripe ended up hidden after the cloth simulation, needing
  v015 to fix it. Review the sheet after every simulation, not only the numbers.
- 2026-11-04: steam was built for a mug that sits behind the monitor, then removed. Check that
  an object is visible from the camera before adding effects to it.
- 2026-11-05: a scene with 15 versions reviewed by eye still had a desktop floating 15 mm off
  its legs. Good-looking renders are not evidence of contact; measure it.
- 2026-11-05: joining parts with different rotations corrupted their normals, which the render
  did not make obvious. Compare exports vertex by vertex after changing the export step.
- 2026-11-05: `check_scene.py` passed forearms running 16 cm through the desktop, because depth
  tested only vertices. When a check disagrees with what the user sees, test the check first.
- 2026-11-05: belt jitter was blamed on solver noise and more frames made it worse. The cause was
  the belt straddling the rug's edge. Trace which part of a simulation moves before tuning it.
- 2026-11-05: the glTF importer leaves objects in quaternion mode, so a set `rotation_euler` did nothing and
  the tub's label read `GAI`, which the numbers passed. Look at imported props up close in the browser.
- 2026-11-05: moving the mug left the upper book floating, because the coaster had been its only support, found
  only by `check_scene.py`. Re-run the check after moving any prop, even one that looks independent.
- 2026-11-05: scripted pointer events never reached the scene's handlers, which read as if the desk click had
  broken. Use real browser input, and when a known-good path also fails, suspect the test first.
- 2026-11-05: a screenshot taken during a camera move looked like a stuck camera. Read the camera's position, and
  wait for the move to end before judging a view.
- 2026-11-06: a shirt's 3 mm of drift over 30 frames looked like noise at the limit, but a longer run showed it sliding off the bag. Run
  a simulation well past where it looks settled before trusting a borderline number.
- 2026-11-06: a browser test clicked the loader instead of the room, because waiting for `.intro` to be gone passed before it had mounted.
  Wait for something that only exists after the state you want, such as `.placard-visible`.
