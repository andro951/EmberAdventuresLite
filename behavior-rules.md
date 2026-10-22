# EmberAdventuresLite Behavior Rules

Created: 2026-05-31

This is the living record of project behavior rules that should be preserved when changing EmberAdventuresLite. When a fix or feature changes behavior, update this file and add or update smoke coverage for that rule. If a proposed code change conflicts with a rule here or with an inline code comment marked as a rule/invariant, stop and explain the intended change before editing.

## Smoke Coverage Rule

- Every bug fix, feature, or behavior change must include an updated existing smoke test or a new focused smoke test.
- If a behavior cannot be automated cleanly, record whether it is manual-only or mocked coverage and explain why.
- If the expected rule is unclear, stop and ask before encoding strict smoke assertions.
- Smokes must not accidentally make live Perchance image requests. Only smokes whose explicit purpose is testing live image generation may call the real image generator; all other smokes must use seeded existing images, mocked image paths, or block image generation during the run.

## Story Shop Transactions

- Character-shop secondary costs are generic story-authored stat templates. The engine must not hardcode a story's resource names or semantics.
- Evaluate every currency, structured, and stat-derived requirement before applying any effect. Commit price, configured effects, acquisition, and purchase-objective startup atomically.
- Character stats are the canonical source for per-character derived costs. Do not duplicate those values into shop items.
- Character removal or resale does not implicitly reverse story-specific shop effects; stories that support those actions must author their own reward flow.

## Startup And State

- Opening an explicit `emberHosting` launch URL selects hosted text and images for that page through the canonical generation contract. It must not persist provider preferences or modify saves; a normal URL uses the player's stored selections. Invalid or duplicate launch parameters must be rejected rather than falling back to Perchance.

- The opening narration is treated as already included in the initial state. It must not be picked up by later state catch-up passes.
- There should be no state check at the end of new story creation. The new game state was just created and the opening message is already represented by that state.
- Active game state, chat history, normal images, active profile-image selections/references, and snapshots are saved as one active-game record for the active `save_id`. Profile image history can be shared by the same character across games. Do not split one active game into independently writable save parts.
- Starting a new story, restoring another save, returning to the main menu, or starting character chat must finish the blocking save first. If the blocking save fails, stop the transition and leave the current runtime in place.
- Runtime controls must validate requested changes before mutating state. Prefer explicit command functions such as add/remove/set helpers over broad sanitize/normalize/repair passes. Whole-state repair must not be normal app behavior.
- Detailed current poses must preserve explicit visible restraint material, restrained body parts, limb placement, body orientation, and mobility so narration, saves, and image prompts describe the same physical state.
- When a player names a concrete visible prop or material and a character complies, narration must preserve it rather than replacing it with a magical, technological, metaphorical, or otherwise different substitute.
- Imported, downloaded, edited, loaded, or programmatically generated complete data must be validated and rejected with exact reasons when invalid. Direct AI-generator output alone may receive its explicitly bounded repair pass before the same canonical validation. Do not silently fill missing required fields, delete invalid fields, or keep legacy/backwards-compatibility repair paths before the first official public release.
- Every non-AI structured-data boundary is strict. A story, character, profile, save, settings record, library record, editor result, import, export, network payload, or persisted record must use the one exact approved schema, including exact field names and casing. For example, `creation_tool` is valid and `creationTool` or `CREATION_TOOL` is invalid. Unknown, aliased, misplaced, obsolete, missing, incorrectly typed, or incorrectly cased fields are errors; the app must report and reject them without changing the data.
- AI text-generator output is the only data source that may be normalized or repaired before validation. After that bounded AI-output conversion, the result must pass the same strict canonical validator as non-AI data. There is exactly one authoritative validator per structured type; callers may present its errors differently but may not implement competing validity rules.
- Delayed saves are for the active game only. Settings, profiles, character definitions, story definitions, profile-image history, and story-title image history must save only through their targeted store save paths when those stores change.
- XP, levels, ranks, milestones, progression skills, player power, and next-unlock progression data are removed for now. Objectives are the only active story-progression system. Do not store, import, expose, prompt for, or silently preserve the shelved progression fields unless the progression system is intentionally rebuilt.
- Player-facing state/JSON editors must expose only fields appropriate to that editor surface. Runtime state editing must hide metadata, current location/map internals, objectives, future cast, recent changes, generated image/profile records, voice, seeds, outfit definitions, and other fields that have dedicated UIs or are managed by the engine. Story/template authoring can expose authoring panels for objectives/future cast, but raw image/profile JSON internals remain non-editable.
- JSON/state editor field access is governed by `json-editor-field-access-audit.md`. Any new editable state, character, NPC, story-template, or public-library metadata field must be added to that audit with player visibility/editability and AI visibility/editability before it is exposed.
- Raw runtime State editing is an advanced/dev-only tool. Normal release UI must hide it, and direct calls to the raw State editor must show an Advanced Mode Required notice unless dev mode is enabled.
- Backup/export actions must be reachable from the main menu Tools flow. Startup/render error recovery must expose an emergency export button so a player can download a backup before refreshing.
- Mobile gameplay UI should show the top bar, chat thread, and composer as the main surface. Desktop left/right columns must become left/right content drawers on mobile instead of stacking into the chat flow.
- Story templates may optionally define `state.players` as a start-of-game character-select list. If more than one player option exists, the app must show a character picker before the opening prompt begins. The selected option is copied into runtime `state.player`; runtime play must not keep the `players` option array as mutable state, and unselected options must not appear as party characters or NPCs unless later introduced normally.
- The player must stay separate from `scene.party_members_present`, `scene.npcs_present`, NPC lists, and any AI-writable scene-character list. This prevents the AI from treating the player as a writable NPC.
- `scene.party_members_present` and `scene.npcs_present` are current physical scene-presence lists, not long-term memory. Stale characters should be removed when they leave, die, travel away, or are no longer close enough to interact.

## Objective System

- Objectives are the only story-progression system. Future story events and companions stay hidden until objective rewards unlock them.
- Current objectives use `title`, player-facing `summary`, private `completion_criteria`, optional private `completion_instruction`, and `completion_control`.
- Do not generate or preserve the legacy duplicate `objective` field on current story objectives.
- Do not use objective `steps`, `current_step_id`, `selected_step`, or `selected_step_id`; those are old objective-system fields.
- Objective completion verifier responses must be exactly `yes` or `no`. If the verifier returns anything else, ask once more; do not silently treat malformed output as no.
- Objective verifier prompts should refer plainly to "the objective" or "the next plot point"; do not imply a list of multiple objectives or include abstract engine terminology that does not help the yes/no decision.
- Player-controlled objective verifier prompts should explain what player-controlled means for the yes/no decision instead of repeating that the AI is an objective checker.
- If there is no selected/current objective, do not call the AI objective verifier.
- Player-controlled objectives can only complete from real player-action sources such as typed chat, invite, auto-player, d20, or Find.
- `Continue` is passive. It may complete AI-controlled plot-point objectives, but must not complete player-controlled objectives.
- Objective state/rewards should be applied before the narrator prompt so unlocked characters/state are available to the reply.
- For normal narrator turns, the visible objective-complete Game message should appear after the narrator response that resolves the beat.
- Narrator replies should still steer toward the selected objective when the player is passive, but objective completion is owned by the verifier. If the verifier says no, steer toward the selected objective without completing it. If the verifier says yes and another objective becomes selected, resolve the verified objective and steer toward the next selected objective without completing that next one. If the verified objective is the last objective in its chain, include only the completion directive.
- Player objections/disputes can complete player-controlled understanding objectives. Use only the objective's own wording plus current state/messages to decide what kind of objection matters; reusable prompts must not include story-specific example objects, phrases, or concepts.
- Reusable AI prompts must avoid concrete story-specific names, objects, roles, and example phrases unless those values come from the current state/objective/message being processed.
- User profiles must not store genre/entertainment preference lists. Genres belong to story/character metadata, public-library filtering, and story-generation/editor workflows.
- Normal narrator, state-check, and auto-player prompt contexts must not expose image-only scene fields such as `scene.image_action` or derived player/image booleans. Image prompt builders can read image fields directly when they are actually composing an image.
- If the verifier says no, the narrator may create pressure, clues, or openings toward the selected objective, but must not reveal/resolve the objective's core answer, hidden proof, final rule, legal clause, exact identity, required secret, completion result, or irreversible consequence.
- Do not use `@` markers in narrator output for objective completion. Objective completion is handled by the dedicated verifier path.
- Story state updates must not create new main-story objectives or mark objectives complete. Side objectives may be added when appropriate.
- Narrator replies must make the current beat matter. Visual business, nervous gestures, repeated hiding/revealing, or prop details should only be used when they reveal a new fact, create a decision, escalate pressure, or give the player a clear next handle.
- Background state-sync AI work must yield to player-facing AI replies. If a player-facing request arrives while a background state group is using the AI channel, pause/release the state work and resume it later instead of trapping the player's message behind a long state update.

## Player Action Sources

- Typed player chat, party invite, d20 roll, Find, and auto-player turns are normal player story turns with modified directives. They should get the same objective check, AI priority, narrator reply, and post-reply state-sync behavior as typed chat.
- `Inspect NPC` is a direct tool/state operation. It should add a Game message when finished and must not create a visible player story turn or narrator reply.
- If the player queues a normal message while `Inspect NPC` is running, inspection must release `app.busy` and resume the queued message automatically when the inspection finishes.
- Slow `Inspect NPC` completions must re-resolve the live NPC record before writing `full_character`/`inspected=true`; background state sync may replace NPC directory objects while the inspection AI request is in flight.
- `AI Command` is a direct state-patch tool. It should not create a visible story turn; completion/failure is reported as a Game message.
- `Find` is a player story action and should queue a normal narrator reply. It must also add a Game message whether the target is found or not.
- Player-agency control for narrator replies is prompt-only. Do not add post-response agency heuristics or retry/rewrite a completed response for agency violations; retries can replace already-streamed/read text and the heuristic is not reliable enough.
- Browser speech synthesis can only use voices exposed by the current browser/operating system. EmberAdventuresLite must not claim it can force-install missing voices. Edge should keep the current Microsoft Online voice defaults; other browsers should fall back to compatible available browser/OS voices by narrator/male/non-male role.
- `Continue` creates no visible player message. Continue assistant replies may be deleted because there is no paired player message.
- Normal assistant replies should not expose a delete button because deleting only the AI response would orphan the preceding player turn.

## Message Mutation And Snapshots

- Edit, delete, and regenerate all use the same state-reset concept: restore the pre-message backup, remove or replace the target message as appropriate, and rerun immediate checks plus full state sync over all remaining messages after the restored point.
- Editing/regenerating creates a new or updated message; deleting removes the message. The state-reset behavior is otherwise the same.
- Fully incorporated messages require a pre-message state backup before edit/delete/regenerate controls are enabled.
- Snapshots are for message/state restoration around message mutation, not for general manual UI undo.
- The old Undo/Snapshot tool should not have a user-facing UI.
- Game messages should not have delete controls.

## NPCs, Characters, And Speakers

- Player-facing in-game UI must call current `state.characters` entries `Party`, `Party Members`, or similar party wording. `Character` remains correct for reusable Character Library definitions and broad combined menus that include both party members and NPCs. The in-game Characters menu is the single combined place for party members and NPCs; adding/creating entries there must offer a Party Member vs NPC target choice.
- Generated or repaired adult ages must be intentional and varied by context. Do not use one sticky fallback age such as 25 across the player, NPCs, party characters, and future cast; source/canon ages should be preserved when known and safe.
- New NPCs must use stable proper names, not role labels or placeholders.
- Reject or repair names like `Unknown Woman`, `Mercenary Woman`, `Bandit Leader`, `Guard Captain`, `Guard`, `Girl`, `Woman`, `Villager`, `Merchant`, numbered NPC names, and similar generic/role labels.
- If a proposed new NPC name duplicates an existing player, party character, NPC, future-cast entry, or pending new NPC by full name or reasonable first-name match, treat it as a duplicate.
- If a speaker is identified but no matching character/NPC exists after new-NPC processing, run a repair pass to create the missing speaker as a real NPC instead of falling back silently.
- If a character speaks a quoted line, they should become an NPC if they do not already exist, except when they duplicate an existing player/character/NPC/future-cast identity.
- Non-speaking background people who are killed, leave, or are unlikely to recur should not become persistent NPCs.
- Do not create an NPC for items, weapons, concepts, or the player. Example: Durandal is a sword, not a person.
- Future-cast characters should not be created early as generic NPCs. They should be introduced by objective rewards/instructions at the correct point.
- If NPC inspection returns truncated JSON, recover only safely completed top-level fields and fill missing character-definition fields locally. Do not fail the whole inspection when enough valid fields were returned to create a coherent inspected NPC.

## Voice And Reader

- The auto-reader may start reading narrator/known-voice text immediately.
- If reading reaches a quoted section with an unresolved new speaker voice, it should pause at that quoted section until speaker/NPC metadata finishes or fails.
- If metadata fails but gender is known, use the default male or non-male voice. If gender is unknown, fall back to the narrator voice.
- If a message starts using a speaker voice, later untagged quotes in the same message inherit that speaker. The sticky speaker resets at the end of each message or when reading switches/cancels to another message.
- During streamed assistant replies, a known NPC/character shown as the assistant message speaker is enough to voice untagged quoted text immediately. Do not pause for post-response metadata when the current message header already resolves to one known speaker.
- Current inline voice tags in narrator/opening text are name-only: `(Full Name) "spoken words"`. Do not put gender in the tag; resolve voice gender from the saved player/character/NPC definition. Legacy `(Full Name gender)` tags may still be stripped/parsed for backward compatibility.
- Inline voice tags are hidden metadata. Any parenthesized tag immediately before a quoted line must be stripped from visible text even if its gender token is malformed; voice selection has only male and non-male buckets, so unsupported tag genders use the non-male/default-female voice path.
- The stop-reading button must appear on the message currently being read, not simply the latest message.
- Clicking read on an older message starts reading there and continues forward from that point.
- Highlighting should track the current read segment. Segment-level highlighting is acceptable when word-level highlighting is unreliable.

## Images And Profile Images

- Extreme muscular midsections retain their thick, dense, sculpted ab blocks, large obliques, serratus detail, and exaggerated 8/10/12-pack progression. Avoid wording that makes the whole abdomen bulky: value 18 describes tightly contracted, sharply defined musculature, and value 20 emphasizes segmentation and muscular definition. Do not flatten or reduce the intended muscle shapes.

- Character Library definition editing shows each outfit as a collapsed panel named for the outfit. Expanding it exposes every canonical clothing slot directly, including empty slots. Clear empties a slot; typing afterward replaces it. These controls edit the saved outfit, never runtime clothing or inventory.

- Returning from Character Library settings or definition editing replaces the same character's existing detail panel instead of stacking another copy. Reopening an already-open profile-image gallery reuses that gallery; closing it once returns to the underlying character panel.

- Live image-generation requests have no timeout, expiry, lease, maximum duration, or automatic cancellation. Slow generation may produce a non-fatal warning after an unusually long period, but the request must remain pending until it succeeds, explicitly fails, is explicitly cancelled, or the provider reports cancellation. Smoke-test waits are separate test-harness behavior and must never become live-play timeouts.
- Image prompts and image behavior must be derived from structured character fields, exact enums, image settings, anatomy fields, and clothing slots. Never search free-form character descriptions, clothing text, narration, notes, prompts, or titles for words and infer anatomy, coverage, clothing occupancy, image mode, pose, or other image state from those words.
- Image prompts keep authored bras and underwear, but list covering torso/lower garments first and mark the corresponding inner layer as underneath. Covered chest wording is derived from the unchanged chest-size phrase plus one shared coverage suffix.
- Image-card upload/share buttons are not intended. User uploads are allowed only for story title-card images. Character profile images, including story-character profile images, must be generated by EmberAdventuresLite so their prompt and mode match runtime generation.
- Persisted normal, profile, story-title, and save-index image records must store only stable trusted image HTML or trusted image URLs. Live Perchance iframe HTML, scripts, event-handler attributes, and other raw DOM/plugin markup may exist only in temporary in-memory live caches while a request is pending.
- Normal image target include/exclude buttons only control who is included in normal image prompts. They must not clear or regenerate profile portraits.
- If normal image targets are empty when making a normal image, include the player for that request without force-adding the player back to the saved target list.
- If there is a default image specified for a player/character/NPC, and it is successfully retrieved and copied into the local database, that image should be used as the profile image.
- Character definitions must not store local profile-image history. The only portrait data allowed on a reusable definition is `default_profile_image`: an optional hosted `url`, optional local `local_image_id`, prompt metadata, and notes.
- If `default_profile_image.url` exists but `local_image_id` is missing or unavailable, the app will download/copy the hosted image into the local profile-image store, then update `default_profile_image.local_image_id` to the local image record.
- Public character publish must never upload a reusable definition that points at only a local `default_profile_image.local_image_id`. If a local default exists, publish must resolve the local image, upload it to hosted storage, write the hosted URL into `default_profile_image.url` and public metadata, and strip `local_image_id` from the public payload. If the local image cannot be resolved or has not finished generating, publish must fail before uploading the character JSON or writing Supabase rows.
- Character Library cards display the definition's default local image. If no default local image is set but local profile images exist for that character, the most recent usable local profile image becomes the default.
- Clicking `Use this` in a Character Library profile-image picker sets that local image as the character definition's default image. It must not delete image history.
- Setting a profile image as a character definition's active default also updates the definition seed fields to the seed used for that selected image.
- Exporting or publishing a Character Library definition must remain clean: no `profile_images`, no raw image history, and no embedded image list. Only `default_profile_image` is exported.
- Imports must not auto-generate profile images. Import only tries default image retrieval/copying; if the character still has no profile image, generation is deferred until a visible/relevant UI surface or scene/manual trigger queues one.
- While Character Library Local Characters or My Characters is open, the first visible character definition without a profile image and without queued/running generation should queue one generated profile image after trying any default image.
- If a player/character/NPC joins the scene and lacks a profile image, queue a generated profile image after first trying any default image.
- Uninspected NPCs may show a generated preview image on their cards. That preview prompt must use only lightweight visible NPC-shell fields such as name, gender, job/title, relationship, and note. It must not use hidden/full character details or story/location context.
- Inspecting an NPC must queue a new full-character profile image after the inspected character definition is created, even if the uninspected NPC shell already had a preview image.
- When an objective reward introduces or promotes a predefined future character, that character must get the same missing-profile-image queue treatment as any other newly created character/NPC.
- The Character Library can create a manual current-game character and open existing current-game player/character/NPC entries for editing. Generating a default profile image from an editor stores the finished generated image locally, points `default_profile_image.local_image_id` at it, and must not delete or replace profile image history.
- If a name exists as both a party character and an old NPC shell, profile-image UI/actions must target the party character first so stale NPC shells do not steal profile actions after promotion.
- Promoting a party character must explicitly transfer any owned NPC portrait as part of the promotion operation. Startup and profile loading must never discover and repair a missing transfer later.
- The `Use This` profile-image button must update the relevant character card in the left main column.
- After an NPC is promoted to the party, any old same-name NPC shell must not show a stale invite button; attempts to invite that name again should show an explicit already-in-party notice instead of silently doing nothing.
- Generating a new profile image must not rebuild/reload existing profile-image iframe/img cards in the picker.
- Generating a new profile image must not overwrite or delete existing profile images. Profile images use the normal image history cap. Automatic profile-image deletion is allowed only when that cap is exceeded, and only for the oldest non-favorited image that is not currently active or otherwise in use.
- Unfavoriting a profile image must not immediately auto-delete it. Cap cleanup only happens from the normal cap cleanup path when adding/generating images.
- If editor changes affect the profile prompt, the app will queue one profile refresh after the editor closes.
- The active selected profile image should be unique to each game/playthrough. The same character can share profile image history across games, while normal scene images can remain save-owned.
- `Player` is a UI handle, not a reusable profile-image owner. Player profile images must be stored under the player's actual character name so a prior game's player portrait cannot leak into a different player in a later game.
- A saved game's profile-image save part should contain only profile images referenced by that saved game's current state. Shared profile-image history can stay in shared storage, but it must not be copied wholesale into unrelated saves.
- Profile image loading and empty-slot surfaces should be visual, not text labels. Use spinners/status metadata for pending work and do not show placeholders such as "Waiting for Perchance image generation" or "Profile portrait" on character cards.
- Profile-image pending cards may show readable Perchance request/status details copied from the hidden generation iframe, but they must not render the real iframe inside the profile card.
- Image UI must not expose upload/share buttons for normal images or profile images. Normal image cards should keep download and click-to-preview controls. Profile-image cards should not show inline metadata such as favorite/source/style/seed; that detail belongs in the big image viewer info panel.
- Public image publishing must upload the actual image blob when local image data is available, and must reuse an existing hosted URL when the image is already hosted instead of trying to upload an invalid wrapper object.
- Player-facing image style preset names should be generic descriptive labels, not internal brand labels.
- Profile-image prompts must never use current story/template data, active location, scene summary, scene image action, current objective, image targets, or other active-game context. They are generated from the target character/player/NPC definition and current entity fields only.
- Profile images are square upper-body/torso portraits. The prompt should emphasize the head near the top and visible shoulders/chest/stomach/arms; it must not ask for centered-face composition, full-body views, hips, legs, feet, or story backgrounds.
- Profile image style has three levels: global default setting, immutable character-definition default, and current-game mutable override. Current-game override wins, then definition default, then global default. Normal scene image style remains separate.

## NPC Inspection

- Inspecting an NPC is single-flight per NPC. If an inspection for that NPC is already queued or running, later requests must be rejected until it finishes.
- NPC inspection must preserve the NPC concept from known NPC fields and recent visible chat context. It must not borrow hidden future-cast, hidden future-map, or unrelated world-lore concepts when filling a full character sheet.

## AI Prompt Boundaries

- Every AI text prompt must receive the saved story guidance context, including small verifier/repair/tool prompts. Story guidance is global steering for the current playthrough, not only narrator text.
- Runtime AI calls must not receive locked `future_cast` entries or hidden future map nodes. Those are story-template data, not present-world facts, and leaking them can cause early or wrong character concepts.


## Character Cards

- Character/NPC directory export checkboxes belong inside the visual character card, not floating above it, so they cannot overlap or hide names when the grid resizes.
- Player and party character outfits are saved clothing snapshots. Players can save/swap them from the character card, and AI/state patches can swap by `active_outfit_id` instead of rewriting every clothing slot.
- Raw/friendly state editors should not expose character image internals, profile-image state, seeds, voice objects, outfit definitions, or active outfit ids. Those belong to dedicated image, voice/settings, or outfit controls. The editor may expose current clothing and inventory because those are current game-managed state.
- A partial state patch for a non-party NPC must never downgrade an inspected NPC or an introduced future-cast NPC into an uninspected shell. Preserve/restore the existing `full_character`, `inspected=true`, voice, and future-cast link when merging lightweight NPC updates.
- Background state repair must not take priority over player-facing AI work. A forced catch-up before a queued narrator reply gets at most one state AI call total; if that call needs repair, keep accepted fields and let later background catch-up handle the rejected fields. Once a reply/command is queued, do not start additional state repair AI calls before it.
- Every AI text request must use the central timing log format from the AI queue. Timing logs should include label, process, type, queue position, remaining queue, prompt/response/streamed character counts, queue wait, active duration, total time since queued, and first-stream timing when available. Do not add ad hoc AI timing logs that use a different shape.

## Story Templates And Story JSON

- Existing public/release story JSONs should be kept current with the engine schema.
- Story objectives should be visible-player wording in `title` and `summary`; private verifier logic belongs in `completion_criteria`, and narrator bridge logic belongs in `completion_instruction`.
- Story files should not include legacy objective steps, selected steps, or location tags.
- Objective `requires` is a first-class AND prerequisite list for target-authored dependency graphs. Use it when the target naturally declares prerequisites and no distinct source output is needed; never duplicate the same dependency as both `requires` and an output transition. When explicit incoming groups also exist for different reasons, all `requires` entries and one incoming group must be satisfied. Incoming transitions in one `target_input_group_id` require every distinct source objective (AND), accepted outputs from the same source are alternatives (OR), and different target input groups are OR alternatives. Use objective `next_objectives` for ordered conditional after-completion routing with optional structured story-state requirements; this should not open a player choice menu.
- World notes may exist when they are stable world constraints, but they should not become a second story-progression system or leak future events.
- Future characters and future story events should not appear in normal prompt state before they are unlocked by objectives.
- New story generation prompts should use human-readable pretty JSON when JSON is intended for AI reading.

## Main Menu


## Public Hosting And Library

- Reviewer story tag suggestions are feedback metadata. They can be searched/displayed with public-library story entries, but they must not mutate the immutable story payload automatically.
- Perchance uploads are immutable for practical purposes. Do not design public story/character metadata around overwriting one uploaded database file.
- Public library/upload tests should be mocked in smoke tests. Live Perchance/Supabase writes are manual acceptance tests unless explicitly requested.
- Public story ratings and reports are public-library metadata records keyed to the story index entry. They must not be written into immutable story payloads.
- The intended public stack is Perchance immutable file hosting for payloads/images plus Supabase metadata/auth for search, ownership, and version lists.
- The public Discord link should be available from both the main menu and the Tools menu so beta users can find support/feedback from either startup or in-game UI.

## Logging

- Normal players should not produce any non-error EmberAdventuresLite app-runtime browser-console output. Non-error diagnostics belong in the Dev Log only.
- Errors may write to the browser console. Warnings and errors must always enter the Dev Log regardless of log filters.
- In dev mode, warnings and errors should go through the central in-game issue-reporting popup with actions to copy the error, export the Dev Log, export a backup, or export both.
- Logs should go to Dev Log through the same category gating for non-errors, not to old in-app log streams or direct `console.*` calls.
- Generated helper scripts may print to their own helper console, but the main EmberAdventuresLite app runtime must not bypass the log settings.
# Async Work And Persistence

- Classify meaningful asynchronous work as blocking read, blocking commit, ordered background work, independent background work, maintenance, or UI scheduling.
- Use the shared keyed work manager for storage and domain persistence. Do not add untracked fire-and-forget promises.
- Runtime memory is authoritative during play. Persist immutable domain snapshots through ordered write-behind lanes.
- State, messages, and gameplay snapshots save coherently; image binaries/history save separately.
- Library-only changes must never schedule an active-game save.
- Validate records at load/import boundaries and write only explicitly changed canonical records afterward. Never transform a complete library to save one record or image.
- Background completion must update only its owned UI surface. Do not call the full `render()` because an image, save, search, or maintenance task completed.
- Await only data required for the next correctness-sensitive action. Cleanup and stale-checkpoint deletion are maintenance work and must not block gameplay.
- Store generated image binaries as IndexedDB Blobs and reuse one session object URL per stored image record.
- Do not include base64 image payloads or repeated complete runtime state in routine logs or smoke reports.
- The project is unpublished. Do not add legacy-storage migrations or compatibility paths unless the user explicitly requests them.
