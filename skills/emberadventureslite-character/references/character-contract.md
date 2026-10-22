# Lite character field contract

Use [reference-character.json](reference-character.json) as the complete,
validator-checked shape, with new creative content and real timestamps.
[field-sets.json](field-sets.json) contains the exhaustive allowed and required
key sets from Lite's canonical validators. A key absent from the relevant set
is invalid; do not add aliases or fields from another format.

## Wrapper and metadata

A single export has exactly `{"character_definition": {...}}`. A combined
import has exactly `{"characters": [{"character_definition": {...}}, ...]}`.
Do not mix wrappers or add top-level timestamps. Standalone definitions require `lite: true`,
`genres`, `source`, `creation_tool`, and all `CHARACTER_REQUIRED_FIELDS`.
Use a unique nonempty `id` and `name`, integer `version` of at least 1, and a
short descriptive `role`. `created_at` and `updated_at` are ISO strings.
Use the approved editor genre strings, including `fantasy`, `adventure`,
`mystery`, and `cozy` when appropriate; validate the actual combination.

`can_die` and `romanceable` are booleans. Standalone humanoid characters require
an integer age of at least 18. Embedded story characters may have a nonnegative
integer age; those under 18 require `romanceable: false` and
`starting_attraction: 0`. Animal ages follow their own contract.
Supported ordinary gender tags include `male`, `female`,
`non-binary`, `trans male`, `trans female`, and `trans non-binary`.
Keep both male and non-male profile-image buckets complete.

## Identity, behavior, and starting state

| Fields | Type and purpose |
| --- | --- |
| `personality_description`, `speech_style` | Text; durable personality and dialogue style. |
| `boldness` | Integer 1–10 or nonempty custom descriptive text. |
| `starting_relationship_to_player` | Text describing the actual opening relationship. |
| `starting_trust`, `starting_attraction`, `starting_affection` | Finite numbers 0–10. |
| `starting_state_of_mind`, `starting_physical_state`, `starting_pose` | Text describing the opening moment. |
| `starting_held_items` | Exactly `right_hand` and `left_hand`, each text or null. |
| `starting_inventory` | Array of strings or item objects with keys from `CHARACTER_STARTING_INVENTORY_ITEM_FIELDS`. Object quantities/values are safe integers, booleans stay booleans, images use the exact authored image shape. |
| `starting_known_facts` | Array of concrete durable strings; no future author instructions. |
| `stats` | Optional object of supported named stat values; `{}` is sufficient when unused. |
| `voice` | Exactly JSON null in an authored character definition. |
| `default_seed` | Nonnegative safe integer. |

Use the supported character/pronoun tags without altering their spelling.
For standalone characters, self references such as `|[character]|` and
`|[character_subject_pronoun]|` may refer only to this definition. Ordinary names
and plain prose avoid unnecessary cross-character reference dependencies.

## Appearance

Required scales are `height`, `shoulder_width`, `chest`, `upper_body_build`,
`midsection_build`, `hip_width`, `butt_build`, `lower_body_build`,
`arm_length`, and `leg_length`. Each is an integer from 0 through 20 or a
nonempty custom description. The exact value-to-description tables are in
[appearance-scales.json](appearance-scales.json). Chest uses the appropriate
presentation table; keep authored numeric values unchanged when sharing files.

Also include `species`, `skin_color`, `eye_color`, `hair_color`,
`hair_length`, `hair_type`, `extra_description`,
`extra_description_lower_body`, and boolean `nonhuman_lower_body`.
Text fields may be empty when intentionally unspecified. Optional
`male_only_extra_description` and `non_male_only_extra_description` are
text for permanent visible traits. Keep clothing, personality and current poses
elsewhere. For a nonhuman lower body, describe its actual structure in
`extra_description_lower_body`; image prompts use that description instead
of human leg proportions.

Use a bare color phrase for skin. Permanent hair color, length, and texture
belong here; temporary styling and worn accessories must not overwrite them.

## Outfits and alternate presentation

`outfits` and `fallback_outfits` are arrays. Each outfit is exactly `id`, `name`,
and `clothing`. Outfit IDs are unique within their presentation. Primary
`starting_outfit_id` and `fallback_starting_outfit_id` select an existing outfit
in their respective lists. `fallback_name` names the same person's alternate
presentation; it is required even when no fallback is actively selected.

The reference explicitly lists every `CHARACTER_CLOTHING_FIELDS` key. Each
value is a concrete garment/accessory description or null. Use those exact
slot names. Every displayable outfit needs opaque outer coverage of shoulders,
torso, and legs, including complete lower-body coverage for one-piece garments.
Horns, scars, skin color, and other permanent body features are not equipment.

## Image defaults

`image_prompt_config` contains exactly `seed_enabled` (boolean), `seed`
(nonnegative safe integer), and text fields `style`, `profile_style`, `negative`,
and `negative_prompt`.

`default_profile_image` and both `profile_image_presentations.male` and
`.non_male` contain the exact eight-key image slot from the reference:
`url`, `local_image_id`, `source`, `seed`, `prompt`, `negative_prompt`, `note`,
`male`. For missing assets use empty URL/id strings, `source: "none"`, and
`seed: null`; other textual values may be empty. `male` is boolean and must
match the presentation. Do not use a temporary browser URL or invent an asset.

`profile_images` and `images` each contain exactly `active_image_id` (text) and
`image_ids` (string array). Empty collections are normal before generation.

## Optional standalone scenario fields

`catalog_hook` and `default_image_background` are optional text.
`chat_story` describes the starting scenario. `chat_opening_message` is its
opening text. `chat_starting_location` uses exactly `label`, `place`, and
`activity` as text. `chat_story_template` is null when unused; create full
stories with the Lite story skill instead of inventing a template payload here.

The story skill owns the embedded-character field exclusions. Do not add
runtime properties such as current `clothing`, `pose`, relationship counters,
active image handles, ownership, or runtime save IDs to an authored definition.
