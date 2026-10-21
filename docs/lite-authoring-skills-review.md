# Lite authoring skills — 2026-10-21

Pulled `origin/master` through `907ba9c` before authoring. Existing unrelated
working edits were backed up outside the repository and retained; the pull's
autostash remains available. No original authoring skill was modified.

## Provenance

The Lite character and story skills copy and adapt the original skills' useful
authoring guidance. The schema was replaced with Lite's current contract.

- Character original version 1.0.33, SHA-256
  `805888ca01cab801b073b9c904713419738029bd7c8b83c2c3bb8fa11d23314b`.
  Retained field-purpose, naming, character-depth, clothing, workflow, and release
  guidance, with direct creation and general-audience clothing rules.
- Story original version 1.0.54, SHA-256
  `36da7bf6a94e2371d8d1d9ef674614c74c3149e7382bd4bcce6bc7eb57de2552`.
  Retained opening/agency, hidden-information, objective handoff, one-beat,
  persistence, map timing, and title-rhythm guidance.

Both skills include exact field sets extracted from production declarations,
complete validated JSON examples, and UI metadata. The story skill uses the Lite
character skill for embedded cast. Neither requires an original skill or a
private preference document at authoring time.

## Review passes and corrections

1. Compared required/allowed fields against canonical Lite validators and its
   any-player optional-field wrapper. Confirmed the literal app discriminator,
   body_description, embedded exclusions, appearance/outfit defaults, image
   metadata, scene fields, and player-library overlay.
2. Reviewed copied prose for unsupported fields, conflicting approval gates,
   dangling references, obsolete modes, and process text in example data.
3. Authored The Last Light at Bramble Bridge using the skills. Testing a real
   choice branch exposed two draft guidance errors: story rules require id/text
   objects and choice response modes are optional_text/exact_text. Corrected both
   the guidance and story, then repeated validation.
4. Reviewed both paths for agency, one pending beat per objective, safe physical
   actions, present cast, fully covered outfits in both presentations, location
   consistency, converging branches, and a meaningful free-play ending.
5. The real UI accepted the first import, but its library-enabled character
   selector correctly showed only the library tile: state.player alone does not
   create a default selection card. Added the identical player to state.players,
   documented this rule, and covered the production player-selection function.
6. Tested optional library-only state and invalid shapes to ensure the helper
   enforces production rules rather than accepting its own examples blindly.

## Reproducible validation

Run from the repository:

```text
node tools/test-lite-authoring-skills.cjs
```

Result: 82 checks pass. These cover production validation, all 67 bundled field
sets, repeat validation without mutation, standalone/batch/embedded characters,
library-only player fields, rejection regressions, and both authored ending
paths. The graph traversal reviews authored references; it is not a second game
engine or an AI playthrough.

Both skill folders also pass skill-creator's quick_validate.py. No application
schema was relaxed and no import normalization was added. Full application
smokes were not run for this authoring-only change.

The production-backed helper needs a current Lite checkout and Node.js. Consumers
without that checkout use the bundled contract and Lite's import UI.

## Browser import

Verified through https://perchance.org/emberadventureslite using its existing
GitHub import flow. The Computer picker did not produce a usable chooser in the
automation browser. The final story uses a distinct import identity so the
earlier local test imports cannot shadow it when the UI resolves a definition.

Observed results:

- Story Upload Complete; story displayed in the local Story Library.
- Definition view shows five main objectives and one starting NPC.
- Start Adventure offers Choose Rowan Reed and Open Character Library.
- Choosing Rowan and Start Playing loads the authored opening, Rowan (29),
  Mira Bellweather (46), and the active Examine the empty hook objective.
- Scene panel shows Alder / Willow Vale / Bramble / Riverside / Bramble Bridge,
  with Mira present and selected for images.

The browser session was left at the playable opening. No AI text turn or full
playthrough was run. Both branches have been checked structurally, not played
through using a live model. Proof screenshot is saved in the task outputs as
lite-story-import-start-proof.png.
