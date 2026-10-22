---
name: emberadventureslite-character
description: Create, review, and repair EmberAdventuresLite character JSON, including personalities, appearances, complete outfits, starting state, and library exports. Use the Lite story skill for story placement; do not use this skill for another game's format.
---

# EmberAdventuresLite Character

Version: 2.0.0. Contract checked against the current Lite source on October 22, 2026.

Use this skill for Lite character definitions. It adapts the original character
skill's character-depth, identity, field-purpose, clothing, and release workflow
to Lite's own authoring contract. It does not update or replace another skill.

## Required reads

Read [character-contract.md](references/character-contract.md) for the exact
field names, required fields, types, and complete reference export. Read
[authoring-guide.md](references/authoring-guide.md) when designing or reviewing
personality, names, continuity, outfits, or a character library. These resources
are bundled with this skill; no external skill or preference file is required.

For placement inside a story, also use `$emberadventureslite-story`. That skill
owns the differences between standalone exports and embedded definitions.

## Workflow

1. Honor the user's existing premise, destination, and authorization. Ask only
   for decisions that are genuinely missing. An optional private preference
   document can help repeated character work, but it is not a creation gate.
2. Establish identity, role, a distinctive personality, speech style, practical
   usefulness, limitations, and concrete durable facts. Describe the character
   at the opening moment, rather than scripting their future development.
3. Write the canonical `character_definition` envelope from the reference.
   Include `lite: true` on the definition.
   Replace example identities and timestamps. `creation_tool` identifies the
   actual tool used; `source` is `Original` for an invented character. Do not
   invent creator ownership fields.
4. Set starting relationship, trust, attraction, affection, mind, physical
   state, pose, hands, inventory, and outfit consistently. Do not place current
   poses, temporary emotions, or carried objects into permanent appearance.
5. Review content, field purpose, coverage, duplicate names/IDs, references,
   and metadata. Validate the result before final delivery.

If the user grants creative freedom or requests a validation example, choose a
small, fully specified concept and proceed without an unnecessary interview.
For a batch, use individual files unless the user requests a combined import.
The importer also supports the documented `characters` wrapper.

## Lite appearance and clothing

Keep all writing, illustrations, clothing, and relationships suitable for
general audiences. Adventure, mystery, friendship, humor, romance, flirting,
and dating are welcome. Keep appearance descriptions ordinary and outfits
practical and fully covered.

Use all ten appearance scales: height, shoulder width, chest, upper-body build,
midsection build, hip width, butt build, lower-body build, arm length, and leg
length. Each accepts an integer from 0 through 20 or a concise custom description.
Choose intentional values matching the character rather than assuming the
midpoint means an average build. See [appearance-scales.json](references/appearance-scales.json)
for the exact wording, including the separate chest descriptions. Keep only the
appearance keys listed in the contract.

All humanoid outfits must cover the torso, shoulders, chest, and legs with
opaque garments. Use full-length trousers or ankle-length skirts without
openings in the coverage. Check every primary outfit, fallback outfit, starting
presentation, pose, and image prompt. Optional inner clothing slots may remain
null; they never replace complete outer clothing. Do not keep questionable
variants as optional outfits.

Outfits contain only `id`, `name`, and `clothing`. Each outfit's clothing must
include every canonical slot, using JSON `null` for unused slots. Every starting
outfit ID must name an outfit in its own presentation. Held items use exactly
`right_hand` and `left_hand`; inventory entries follow the contract's accepted
string or item-object forms. Do not put an item in a clothing slot simply to
make it visible.

Boldness is an integer from 1 through 10 or supported descriptive text. Starting
trust, attraction, and affection are finite numbers from 0 through 10. Keep
stable identity and pronoun tags exact; never invent tag spellings. Gender
fallbacks preserve the same character's role, history, personality, and outfit
coverage, rather than becoming an unrelated alternate character.

## Images and standalone chat

Use the exact six-key `image_prompt_config` in the reference. Empty image URLs
and collections are intentional; do not fabricate hosted assets. Both profile
presentations require complete image-slot records, even if no image exists.
Write only general-audience image prompts that match the described garments.

Optional standalone chat fields describe a concise starting scenario and its
opening. A full story is a separate Lite story-template definition; do not
invent an embedded story format or populate runtime messages in a character.

## Validation and delivery

When the Lite checkout is available, this bundled helper calls the game's real
canonical validators rather than maintaining a second schema implementation:

```text
node scripts/validate-content.cjs <absolute-Lite-repository> <character.json>
```

The helper is optional for consumers without the checkout. In that case use
the bundled reference and verify with Lite's actual import/editor UI before
claiming the file is tested. Fix authored data at its source; do not silently
coerce it or weaken the validator. Parsing JSON is not import validation.

Keep approval, model advice, validation reports, and process notes outside
player-visible character fields. Deliver the importable JSON and state exactly
which checks actually ran. Do not add arbitrary field, history, or text limits.
