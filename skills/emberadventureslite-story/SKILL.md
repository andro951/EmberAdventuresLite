---
name: emberadventureslite-story
description: Create, review, and repair EmberAdventuresLite story-template JSON, including openings, cast, player options, objective graphs, branches, rewards, and world state. Use with the Lite character skill; excludes other games and filesystem GM saves.
---

# EmberAdventuresLite Story

Version: 2.0.0. Contract checked against the current Lite source on October 22, 2026.

This skill adapts the original story skill's opening, player-agency, pacing,
objective-handoff, hidden-information, and final-release workflow to Lite's
canonical story contract. It creates importable story templates, not live-save
patches. Do not change another product's skills while using it.

## Required reads

Read [story-contract.md](references/story-contract.md), including its complete
reference export. Read [authoring-guide.md](references/authoring-guide.md) when
designing or reviewing the opening, story structure, objectives, or handoffs.
Use `$emberadventureslite-character` and its bundled contract for cast members.
These are authoring resources; new stories do not require inspecting unrelated
existing story files or private application source.

## Workflow

1. Use the user's existing direction, storage choice, and creative freedom.
   Ask only for material decisions that remain unresolved. A request to create
   a short validation story authorizes choosing a small premise and saving it
   in the requested project's `stories/` folder.
2. Establish the player's role, present cast, immediate problem, tone, and a
   satisfying ending. Prefer a playable opening to a lore dump. Let the player
   choose meaningful actions instead of assigning their decisions in narration.
3. Plan the objective graph before filling its prose. Make each activated
   objective describe a pending action, and make each completion output stop
   before consuming the next objective's playable content.
4. Build the exact reference envelope with complete state, character defaults,
   map links, objective references, and opening messages. Invent fresh creative
   content and unique stable IDs. Do not copy an existing local story as a
   design or quality template.
5. Review schema, graph, character continuity, field purpose, visibility, and
   coverage. Validate; fix the authored file; validate again after each fix.
6. Import through Lite's real UI when requested or available. Report import,
   start, save/reload, and branch checks separately. Do not claim an AI playthrough
   or complete branch coverage merely because the file imports.

For a new original story, choose a clear small-scale hook. For an adaptation,
establish the requested source and continuity, credit its creator, and research
uncertain canon facts from primary sources. Preserve the same Lite schema and
general-audience content rules in either case.

## Format and player options

The wrapper is exactly `app`, `exportType`, `storyTemplate`, and `exportedAt`.
The literal `app` value remains `EmberAdventures` in the wrapper, template, and
state metadata: that is Lite's actual discriminator. Product branding is not
permission to rename a schema value. `exportType` is `story-template` and
`storyTemplate.templateType` is `story`.

Always include every required template and state field listed in the reference.
Use real ISO timestamps, approved genres, supported image models, and an honest
`creation_tool` label. Do not add runtime or ownership fields to authored files.

Honor the user's player-library choice if already given. For a fixed-player
short story, set `allow_any_player: false`, use `{}` for
`any_player_starting_state`, and provide the complete default player. If player
library characters are allowed, use the exact overlay contract in the bundled
reference and preserve player agency and the story's required starting items.

Embedded player, party, NPC `full_character`, and future-cast `full_character`
records omit standalone-only `genres`, `catalog_hook`, `default_image_background`,
and the four `chat_*` scenario fields. Their containing story owns those
features. Use the bundled embedded field list rather than guessing omissions.
When library characters are allowed and the default should also be selectable,
include its full definition in `state.players`; `state.player` alone does not
create a selection card. Keep that option identical to the default player.

## Lite content and state consistency

Keep descriptions, clothing, images, dialogue, threats, and relationships
suitable for general audiences. Adventure, mystery, friendship, humor, romance,
flirting, and dating are welcome. Apply the Lite character skill's complete opaque
clothing rule to every outfit, fallback presentation, starting pose, image
instruction, and clothing-changing reward.

All humanoid character appearances use the ten scales in the Lite character
contract. Preserve numeric values when sharing files; the other game may describe
the same value differently. Include `lite: true` on the story template and each
embedded character or animal definition. The scene contains only the fields in
the Lite contract.
Who is present, who is visible in images, and who can speak must agree with the
opening. NPC directory locations and world-map IDs must resolve, even for cast
members who are elsewhere. Uninspected NPC shells are not full character records.

Keep the opening location, current/focus map IDs, travel history, time, scene
summary, player pose, inventory, and objective status coherent. Use exact IDs
in graph and map references and the contract's designated names in scene lists.
An opening may describe only information the player can currently perceive.

## Objectives and ending checks

Use the objective contract in [story-contract.md](references/story-contract.md).
AI-controlled and choice-controlled nodes have different allowed fields.
Choice and reward-only nodes omit `completion_criteria`. Runtime counters and
reward effects must use actual supported operations and paths. Never infer
state changes from a word in prose or write a second custom quest interpreter.

Trace each branch from the active objective to a supported ending or deliberate
free play. Check output IDs, destinations, conditions, rewards, and map travel.
Resolve incompatible requirements, disconnected nodes, accidental loops, and
automatic completion chains before final delivery. A branch should be useful
for the premise, rather than existing solely to increase the graph's size.

Before each handoff, compare the previous completion condition and immediate
output with the next title and summary. Keep durable truths in story memory or
structured state, hidden information in AI-private guidance, and temporary
scene guidance in its owning objective. Do not turn AI instructions or private
creator notes into visible character descriptions or opening dialogue.

## Validation and delivery

The Lite character skill includes an optional repository-backed validator:

```text
node ../emberadventureslite-character/scripts/validate-content.cjs <absolute-Lite-repository> <story.json>
```

It invokes Lite's actual canonical validators; it never repairs the file.
Without the checkout, author from the bundled references and test in Lite's
import UI. Unsupported advanced feature shapes must come from a current Lite
editor export, not an invented field or another game's schema.

Deliver a playable JSON file, a concise premise, and factual validation results.
Preserve user files and unrelated edits. Keep skill maintenance reports and
test-only artifacts outside the story's player-visible data.
