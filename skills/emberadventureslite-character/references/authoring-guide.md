# Authoring guide

Adapted from the original authoring skill. The bundled Lite field contract and
SKILL.md own exact schemas and release behavior; these copied design principles
cover creative quality and continuity. Creator preferences and explicit task
authorization take precedence over optional examples.

#### Field Purpose And Process-Leakage Standard

For every character field, ask:

1. What is this field for in EmberAdventuresLite?
2. How does EmberAdventuresLite use or display it?
3. Does this value serve that purpose?
4. Could it be shorter, clearer, or less like process text?

Do not copy instructions meant for Codex/the character creator into character
fields. Examples of forbidden process leakage:

- `source-faithful`, `current app compatible`, `clean export`;
- `should not appear before X`, `introduce after objective Y`;
- `future party member`, `will become romance partner`, `unlock reward`;
- `do not spoil`, `hide this from the player`, `use in prompt only`;
- field explanations such as `this is the active outfit` or `used by image gen`.

Apply those instructions through the story structure, future-cast conditions,
objective rewards, or hidden notes. Character fields themselves should describe
the character: identity, body, outfit presets, starting/default state, starting
inventory, and durable facts.

## Character Design Goals

- Make characters interesting, distinct, and suited to the current request.
- Vary profession, personality, social confidence, silhouette, outfit, and tone when a batch calls for variety.
- Do not make everyone an interchangeable archetype or an invincible specialist.
- Give the character a useful role, a limitation, a personal concern, a habit, and concrete relationships.

## Existing Characters

Default to not touching existing characters unless the user asks to edit existing ones.

When creating unique characters, scan existing names for duplicates when a library is available. Review other existing character content only if the user requests continuity with that cast.

For uniqueness checks, scan current and relevant existing characters for repeated:

- personality phrasing
- inventory items
- known facts
- body language
- relationship wording
- names and name patterns
- jobs/concepts
- species/variant mix
- outfits

## Names

For newly generated original characters, use a first and last name by default unless the user explicitly specifies a one-word/nonstandard name or the concept strongly requires a different naming convention.

Do not rename existing or user-specified characters unless the user asks for edits. Manual/pre-existing names are allowed to be one-word or nonstandard.

For batches, shop stock, auction stock, job-board NPCs, and story-world stock,
use unique surnames unless characters are intentionally related. Do not reuse
surnames from player options, examples, templates, skill references, or
unrelated existing characters. If two characters share a surname, record the
relationship clearly in durable known facts; otherwise rename one before final
export.

## Practical Clothing And Items Guidance

The bundled character-contract.md defines the schema. This section adds workflow and
image-prompt guidance without adding alternate clothing fields.

- Clothing slots name precise removable items, not multiple alternative wardrobes in one string.
- Keep tattoos, scars, horns, wings, and other permanent physical features in appearance.
- Fill intended underlayers and outer coverage consistently in both presentations.
- Use hands and inventory for carried objects, and durable known facts for personal history.

## Workflow Modes

Default workflow:

- Use preferences already supplied, if any.
- Ask only missing or ambiguous preferences relevant to the request.
- Infer the rest from preferences and the prompt.
- Offer concepts when the user requests proposals; otherwise create the requested character directly.
- After user feedback, distinguish general preference updates from character-specific revisions.

Do not require a preference file or a separate proposal approval for direct creation. Save preference changes only when the user requests it.

If the user asks for proposed changes before editing, list exact planned changes with old value -> new value and wait for approval before editing.

## Final Deterministic Validation

Before returning any character file, validate every entry in the batch using
this checklist. Do not call an entry finished until all checks pass:

- Verify the exact wrapper, metadata, required appearance, complete clothing slots, selected outfit references, and image defaults.
- Check IDs and names, starting state, concrete known facts, and correspondence between image prompts and actual garments.
- Validate using the canonical Lite validator or import UI. Never call a parse-only check an import test.
