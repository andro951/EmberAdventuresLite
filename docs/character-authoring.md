# Character authoring

Download the complete [Lite authoring skills ZIP](https://github.com/andro951/ember-adventures-tools/raw/refs/heads/main/downloads/EmberAdventuresLite-skills.zip) and extract it. Start with `emberadventureslite-character/SKILL.md` and follow its bundled references. The package includes complete JSON exports, exact field snapshots and a validator using the Lite checkout.

An individual file uses `character_definition`; a batch uses `characters`. Every definition includes `lite: true`. Use unique stable IDs and distinct personalities, roles, speech styles, limitations, and durable facts. Starting state describes the opening moment. Keep private authoring instructions out of visible descriptions.

Appearance uses height, shoulder width, chest, upper-body build, midsection build, hip width, butt build, lower-body build, arm length, and leg length. Each accepts an integer from 0 through 20 or a custom description. Choose intentional values from the [scale tables in the skill ZIP](https://github.com/andro951/ember-adventures-tools/raw/refs/heads/main/downloads/EmberAdventuresLite-skills.zip). Permanent features, clothing, poses, and held items have separate owning fields.

Keep every primary and alternate outfit fully covered with opaque outer clothing over the shoulders, torso, and legs. Ordinary inner garments remain equipment layers. Romance, flirting, dating, and ordinary body customization are welcome.

Use [Aren Valehart](examples/aren-valehart.json) as a validated file-shape example. Write fresh creative content for a new identity. Use real timestamps and honest source/tool metadata. Preserve exact field names and types; the importer rejects unsupported data rather than repairing it.

Validate from this repository with:

```text
node <extracted-skills>/emberadventureslite-character/scripts/validate-content.cjs . path/to/character.json
```

This calls the game's canonical validators without launching the game. Report browser import, actual play, and image generation separately from schema validation.