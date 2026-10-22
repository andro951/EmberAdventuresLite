# EmberAdventuresLite

A general-audience RPG and character-chat game with authored stories, free play, editable characters, persistent state, and optional romance.

## Build and play

1. Run `npm install` once for the optional browser test dependencies.
2. Run **Build bottom_compressed.bat**.
3. Paste `left.js` and `bottom_compressed.html` into the matching Perchance editor panes.

The public destination is [EmberAdventuresLite](https://perchance.org/emberadventureslite). Maintainable game code lives in `src/`; the bottom-pane files are generated artifacts. Perchance supplies its text/image plugins on the hosted page. A local page can exercise editors and isolated fixtures but does not supply those plugins.

## Included systems

- Stories, branching objectives, choices, rewards, clocks, timelines, memory, and world generation.
- Character chat, party/NPC management, relationships, character inspection, editing, equipment, and inventory.
- Shops, recruitment, services, jobs, maps, travel, save/load, backups, and image management.
- Profiles, accounts, shared public character/story libraries, ratings, reports, and publishing history.
- Auto turns, Continue, voices, images, portraits, styles, prompt tools, diagnostics, and always-available developer tools.
- Perchance, local or Tailscale-connected Ollama, and hosted text/image providers. Settings save as they change.

Profiles contain ordinary storytelling, voice, image, and presentation preferences. Lite owns separate runtime/application databases and settings; normal-game saves and profiles are not migrated.

## Models and hosting

For local models, see [the Ollama host guide](tools/ollama-host/README.md). Copy the host and player connector folders together. The host panel handles model-folder selection and Start/Stop status; model selection, refresh, reasoning, and tuning controls live in the game.

For RunPod or another cloud worker, use [direct HTTPS hosting](hosting/DIRECT_HTTPS_HANDOFF.md). An external launcher prepares the workers and opens Lite with a one-use endpoint ticket. No paid resources start automatically. The published-page connection to real workers still needs separate verification before paid use.

## Shared library and files

Lite uses the same public-library project and publishing identity as EmberAdventures. Its queries request only the shared general-audience subset. Shared imports use an explicit format boundary; the game retains only its own canonical fields. Characters with an alternate required gender presentation use that authored fallback when needed, preserving IDs and numeric sliders.

Lite character, animal, and story definitions carry `lite: true`. Normal game definitions omit that marker. Marked Lite imports into EmberAdventures receive the approved format defaults. Existing numeric body values are preserved between games, even when their descriptive scales differ.

Valid general-audience stories retain their authored character ages when published. Canonical relationship safeguards for younger characters and the existing original-content/real-person publishing policies remain. Backend availability and actual publication require a live account/service connection.

## Content and authoring

The bundled standalone roster has 41 characters, 21 male and 20 female. There are 55 stories across the complete `stories/` tree. Story files are imported manually. Outfits use complete opaque coverage; romance, flirting, dating, ordinary body customization, and inner clothing slots remain supported.

Use [character authoring](docs/character-authoring.md), [story authoring](docs/story-authoring.md), and the complete [Lite skills ZIP](skills/EmberAdventuresLite-skills.zip). Appearances use ten scales; the grouped body-description field is not part of this format. `docs/examples/` and the skill reference exports pass the canonical validators.

## Verification

`npm test` runs current-source Node checks and canonical content validation without opening a browser or generating paid content. Browser runtime tests and smokes are separate, explicitly requested checks. Their current numbering is in [the smoke index](EMBERADVENTURES_SMOKE_INDEX.md).

See [verification details](docs/verification.md) for the current build's actual evidence and remaining live checks.