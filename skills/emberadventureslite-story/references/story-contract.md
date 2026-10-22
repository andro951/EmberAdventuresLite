# Lite story-template field contract

Use [reference-story.json](reference-story.json) as a complete validator-checked
blueprint. Write fresh creative content rather than reusing its fictional
premise. [field-sets.json](field-sets.json) lists all allowed and required keys
from Lite's current canonical validators, including advanced systems.
`$emberadventureslite-character` supplies the character shape and types.

## Envelope and template

The wrapper has exactly `app: "EmberAdventures"`,
`exportType: "story-template"`, `storyTemplate` (object), and `exportedAt` (ISO
string). The actual `app` discriminator deliberately does not have `Lite`
appended to it.

Required `storyTemplate` keys: `lite` (exactly true), `id`, `title`, `description`, `createdAt`,
`updatedAt`, `allow_any_player`, `any_player_starting_state`, `state`,
`messages`, `source`, `app`, `templateType`, `creation_tool`, `genres`,
`default_image_model`, `title_card_subjects`, and `title_card_image`.
The effective browser validator also permits omitting `any_player_starting_state`;
`editor_data` is optional. Prefer an explicit empty overlay for fixed players.
Use string IDs and text metadata, ISO timestamps,
a boolean for `allow_any_player`, arrays for messages/genres/title-card subjects,
and `templateType: "story"`. `source: "Original"` identifies an invented story.

Title-card metadata uses the exact shape in the reference. Before an image
exists keep URL/id/HTML strings empty and use a supported model, a numeric seed,
and a boolean `favorite`. Asset ownership/attestation metadata is not needed
for a newly authored empty image. Do not fabricate hosted images.

## State

Required roots: `meta`, `location`, `world_map`, `time`, `scene`, `player`,
`characters`, `npc_directory`, `world_flags`, `objectives`, `future_cast`,
`story_rules`, `story_memory`, `recent_changes`, `story_clock`, `story_pacing`,
and `timed_events`. A library-only story with `allow_any_player: true` may omit
`player` when `players` is absent or empty. `players` and `story_inventory` are
optional. The reference additionally includes inventory and empty
supported collections for a coherent starting state.

- `meta`: `app`, `story_guidance`, `story_source`, `genres`; optional
  `default_image_model`. `story_source` has `mode`, `title`, `description`, and
  `modifications` (string array). Use `mode: "original"` for invented stories.
- `location`: all nine text keys in `STORY_LOCATION_FIELDS`, including
  `npc_location_id` referencing the current map/directory location.
- `world_map`: `current_location_id`, `focus_location_id`, `travel_history`
  (array of location IDs), and `locations` (ID-keyed object). Every location has
  the complete `STORY_WORLD_LOCATION_FIELDS` shape. Coordinates are numbers;
  discovery/travel flags are booleans; connections are existing location IDs;
  `npcs` is a string array. Child `parent_id` must resolve; a root can use `""`.
- `time`: numeric `year`, `month`, `day`, `hour`, and `minute` using valid clock
  values; `story_clock` separately has nonnegative `elapsed_minutes` and `label`.
- `scene`: required `summary`, `party_members_present`, `image_characters`,
  `npcs_present`, and `image_action`; optional `speak_targets`. Presence/target
  fields are string arrays referencing the intended cast by supported name/ID.
  These scene arrays do not create missing character definitions.
- `player`: full embedded character with `lite: true`. `characters`: name-keyed party definitions,
  or `{}` for no party. `players` is an optional selectable-player array; when
  used, its default option must match `player` exactly. In library-enabled
  stories, include the default character in this array if it should appear as
  a selection card: the selector does not derive cards from `state.player`.
- `npc_directory`: `{"locations": {"location-id": {"label": "...",
  "characters": {"Name": {...}}}}}`. A lightweight shell uses `id`, `name`,
  `gender`, integer `age`, `role`, `relationship`, `note`, `current_appearance`,
  boolean `inspected`, `voice: null`, and `full_character: null` when unused.
  Inspected NPCs embed the complete character with `lite: true` and share its stable ID. Use
  `STORY_NPC_FIELDS` for optional status/name-visibility fields.
- `future_cast`: `enabled` (boolean), `items` (ID-keyed object). Unused:
  `{"enabled": true, "items": {}}`. Future people are not automatically present.
- `story_inventory`: scalar story counters such as `coins` plus `items` (array
  of canonical item objects). Text, boolean, number, and supported string-array
  counters are allowed. Use the exact item shape from the current reference or
  editor for nonempty items.
- `story_shops`, `world_flags`, reward bundles/templates, and other unused
  supported maps are `{}`. Unused supported lists are `[]`.
- `story_rules`: array of objects, each with `id` and `text` strings (not an
  array of plain strings). These are durable world constraints.
  `story_memory`: exactly
  `world_notes`, `unresolved_threads`, `relationship_notes`,
  `rules_and_constraints`, `ai_private_notes`, each a string array. Do not turn
  transient instructions or planned future outcomes into established history.
- `story_pacing`: `mode`, `pending_event_id`, and `timeline`. For a simple
  player-paced story use `{"mode":"player_controlled","pending_event_id":"",
  "timeline":{}}` and `timed_events: {}`. Time-controlled stories need the
  exact event/trigger/action fields in `field-sets.json` and current editor data.

## Player-library overlays

For a fixed player, use `allow_any_player: false` and
`any_player_starting_state: {}`. Still provide a complete `state.player`.
When enabled, the overlay applies only story-owned starting state; it must not
replace the library character's identity or permanent appearance. Use the
approved fields: `role`, `starting_known_facts_to_add`, `starting_inventory`,
`stats`, `starting_held_items`, `starting_state_of_mind`,
`starting_physical_state`, `starting_pose`, `male_outfits`,
`male_starting_outfit_id`, `non_male_outfits`, and
`non_male_starting_outfit_id`. Facts and inventory are arrays; held items use
both hand keys; other starting-state fields follow the character contract.
Provided outfit arrays must be nonempty and have matching selected outfit IDs.
Do not select an outfit without supplying its presentation's outfit list.
Validate the overlay with the effective canonical validator before shipping.

## Embedded characters

Start with the Lite character skill's complete definition. Exclude exactly the
standalone fields `genres`, `catalog_hook`, `default_image_background`,
`chat_story`, `chat_opening_message`, `chat_starting_location`, and
`chat_story_template`. Keep required source/tool metadata, defaults, appearance,
starting state, outfit lists, image metadata, voice, IDs, and timestamps.

`STORY_EMBEDDED_CHARACTER_FIELDS` and
`STORY_EMBEDDED_CHARACTER_REQUIRED_FIELDS` in `field-sets.json` are exhaustive.
The same embedded shape applies to the default/selectable player, party, and
NPC/future-cast `full_character`. Keep container and embedded IDs identical.

## Objective graph

`objectives` contains `active_id` (existing objective ID), `no_current` (boolean),
and `items` (array). Every node requires text fields `id`, `title`, `type`,
`status`, `summary`, `while_active_guidance`, and `completion_control`.

`type` is `story` or `side`. Main-path nodes start with `active` on the current
node and `future` on later nodes. Completion control is `player`, `ai`,
`choice`, or `reward_only`. AI/player nodes have nonempty text
`completion_criteria`. Choice and reward-only nodes omit that key entirely.
Reward-only nodes require `requirement_check_only: true`.

Choose one output family: `next_objectives`, `choices`, or `outcome_routes`
with `route_control: "ai"`. Each output needs a unique text `id`, a text
`completion_instruction`, and a `rewards` array, including when empty.

- Ordinary next output: `objective_id` identifies the next node.
- Choice output: `title`, `summary`, `player_text`, and `next_objective_id`.
  `choice_response_mode` is `optional_text` or `exact_text`; use `optional_text`
  when free-text responses are allowed alongside the listed choices.
- AI route: `criteria`, explicit `fallback` where needed, and
  `next_objective_id`; use the matching route field set for advanced options.
- Every nonterminal output must include a nonempty `target_input_group_id`;
  `default` is the ordinary target group used by the reference.
- Every terminal output has `ending_type` equal to `freeplay`, `ending`, or
  `game_over`, with text `ending_title` and `ending_message`; omit a next-node
  target or leave it empty. Do not specify a terminal flag and a real next node.
- Optional `travel_location_id`/`travel_location_name` set a real destination;
  use map IDs, not a new location invented in the output.
- `requires` is an array of existing objective IDs. Condition objects and
  rewards must use current supported operations and exact paths. Empty arrays
  are preferable to speculative custom condition syntax when unused.
- In this Lite contract `dialogue_lines` is an array of literal strings, not
  speaker/text objects. Use one consistent speaker convention within the text.

Do not leak runtime-only fields into objectives. Follow the matching
`STORY_OBJECTIVE_FIELDS`, `STORY_NEXT_OUTPUT_FIELDS`,
`STORY_CHOICE_OUTPUT_FIELDS`, or `STORY_ROUTE_OUTPUT_FIELDS` allowlist.

## Opening and release

`messages` is an array of opening records with exactly `role`, `speaker`,
`text`, and `at`; use an assistant Narrator opening and real ISO `at`. No save
message IDs, queues, processing markers, or generated image HTML belong here.

Validate the complete export, every branch and destination, character/outfit
references, and consistency between opening prose and state. Import acceptance
proves schema acceptance, not narrative quality or a completed live playthrough.
