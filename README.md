# EmberAdventuresLite

A standalone, general-audience fantasy RPG and character-chat application.

## Run

1. Install Node.js and run `npm install` once.
2. Run **Build bottom_compressed.bat**.
3. In a separate Perchance generator, paste `left.js` into the left editor and `bottom_compressed.html` into the bottom editor, then reload.

The game uses Perchance for live AI text and images. A direct local preview is useful for editors and deterministic tests, but does not provide those hosted plugins. `perchance-live-bottom-loader.html` is optional; if the browser blocks localhost requests from Perchance, use the compressed bottom pane directly.

Text and image generation can also be selected independently through a safe local hosting proxy. See [hosting setup, Krea image container, provider adapters, tests and limitations](hosting/README.md). Perchance remains the default. No paid resources or credentials are configured automatically.

The game has its own `EmberAdventuresLiteRuntimeV1` database. Export backups through the main menu Tools before clearing browser data.

## Included systems

- AI conversations, authored stories, branching objectives, choices, timers, and story memory.
- Player selection, parties, NPCs, relationships, character creation/editing, outfits, equipment, and inventory.
- Local character/story libraries, settings, import/export, save/load, backups, and image management.
- Shops, character recruitment/services, jobs, travel, maps, and world generation.
- Auto mode, Continue, text-to-speech, image generation, image styles, portraits, and developer tools.

Public hosting is not configured. The application uses local libraries. External community links are not configured.

## Included characters

The standalone roster contains **40 characters: 20 male and 20 female**, selected for practical clothing, ordinary proportions, and varied story hooks. See [the roster](docs/character-roster.md).

## Authoring

See `docs/character-authoring.md` and `docs/story-authoring.md`. `docs/examples/` contains current-schema examples. The `stories/` directory also contains older authored reference files; these are retained as source material and are not all compatible with the current strict import schema. They are not automatically loaded into a new library.

## Tests

Run **Run Automated Tests.bat** or `npm test`. The local runner blocks external requests, uses fresh browser contexts, and records results in `test-output/local-tests.json`.

Tests **48, 49, and 110** require actual Perchance plugins and are reported separately. Build the private test pane with **Build bottom_compressed_private_tests.bat**, then `node tools/build-live-acceptance.cjs` to create `test-output/perchance-acceptance.html`. Paste that artifact into an isolated Perchance test generator to run those three checks automatically. It makes real text and image requests and displays its results in the page.

See `docs/review-decisions.md` for content boundaries and `docs/verification.md` for verification results.


## Preferences

All player preferences are saved directly through Settings; there is no user-profile selection or creation step. Character portraits remain separate image records. Global chest-size bounds have been removed; characters retain their own authored appearance values.

Settings use `emberadventures-lite-settings-v2`. New installs use ordinary defaults. Older profile records are not read or imported; existing current-format settings remain unchanged.

Run `npm run test:settings` for the standalone storage-contract tests without opening a browser.
