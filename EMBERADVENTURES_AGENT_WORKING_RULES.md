# EmberAdventuresLite Agent Working Rules

Purpose: keep Codex work on EmberAdventuresLite cheap, targeted, and predictable. Read this file first when working in this repo.

## Cost-Control Defaults

- Use the smallest edit, smallest search, and smallest validation that can safely handle the request.
- Do not run browser testing unless the user explicitly asks for it.
- Run smoke tests only when the user explicitly requests them. Start with affected smokes; rerun only failures until they pass; then run the full suite once. If the full suite finds failures, fix and rerun only those failures until they pass, then run the full suite again. Repeat until the latest full-suite run is clean.
- When running requested smokes after changing `bottom.html`, run `build_bottom_compressed.js` before the final smoke gate so generated output matches the tested source.
- Do not run whole-file `bottom.html` syntax checks by default.
- Only syntax-check code around areas you edited, and only when the edit is risky.
- Do not run `git diff --check` by default. Use it only for commit-readiness, large patches, or whitespace-sensitive generated strings.
- Prefer targeted `rg` searches and short nearby line reads over broad file reads.
- Do not re-read skills/docs unless a specific fact is needed.
- For short tasks, skip progress chatter unless the work becomes risky or long.

## Checkbox Layout

- Always keep a checkbox and its label on the same horizontal row, including narrow screens. Text may wrap beside the checkbox; never stack the checkbox below its label. Use the existing check-row layout for simple checkbox controls.

## Scope Control

- Fix exactly what the user asked for.
- If you find unrelated issues while working, add them to `EMBERADVENTURES_TODO.md` instead of fixing them.
- If an unrelated issue is tiny and clearly required for the requested fix, it may be fixed directly, but mention it.
- Avoid "while I am here" refactors.
- Preserve user changes. Never revert unrelated dirty work.
- Real errors must always be logged regardless of normal log category settings. Log settings may suppress noisy diagnostics, but not failures, refused actions, recovery UI, storage errors, AI parse/repair failures, image failures, public hosting failures, or import/export failures.
- Do not print routine diagnostics to the browser console. Non-error app logs belong in the in-app Dev Log only; browser console output is for real errors.

## Non-Negotiable Implementation Rules

- Authored, imported, exported, edited, loaded, published, persisted, and programmatically generated structured data must use exactly one documented schema. Every field has exactly one accepted name, spelling, case, type, location, and meaning. Reject unknown fields, aliases, alternate casing, misplaced fields, missing required fields, extra fields, invalid values, and obsolete fields with precise path-based errors. Never rename, move, add, delete, coerce, default, clamp, filter, sanitize, normalize, migrate, or otherwise repair structured data to make it valid.
- AI text-generator output is the only allowed normalization boundary. AI output may receive a narrowly scoped repair/normalization pass because model formatting is nondeterministic, but the resulting structured value must then pass the same strict canonical validator used everywhere else. Never apply AI-output repair behavior to files, database records, editor data, network payloads, authored JSON, exports, or non-AI program output.
- There must be exactly one authoritative validator for each structured type or contract. Import, export, editor, publish, startup, persistence, tests, and runtime boundaries must call that same validator and may only differ in how they display or act on its result. Do not duplicate schema checks in another validator, compiler, worker, UI helper, or storage path. Context-specific policy checks may be separate only when they validate a genuinely different contract, such as public-publishing eligibility rather than story-file validity.
- Never infer gameplay meaning from words found in free-form text. Do not search narration, dialogue, descriptions, names, notes, prompts, titles, or other prose for words such as clothing names, death terms, movement terms, shop types, anatomy, gender, objective intent, or scene state and then mutate behavior or state from the match. Add or use an explicit structured field, enum, command, ID, or slot instead.
- Technical parsing is allowed only for an explicit format or requested search: JSON/patch grammar, speaker and voice tags, URLs/MIME/file formats, OAuth/provider responses, security sanitization, player-entered library search, and test assertions. Exact structured-value membership is not prose inference; for example, checking whether a `gender` or tag value exactly equals an approved enum value is allowed, while changing its case/spelling or searching prose for a partial match is not.
- Never add a timeout, expiry, lease, maximum duration, or automatic cancellation to live image generation or another live provider job merely because it is slow. A pending live job remains pending until it succeeds, returns an explicit failure, the provider reports cancellation, or the player/app explicitly cancels it. A long-running warning may be shown without terminating the job.
- Never change the explicit 60-second wait used by real Perchance smoke tests without the user's explicit permission. That smoke timeout is not permission to add a live-play timeout.
- Never add arbitrary caps, slices, truncation, or clamps that discard canonical imported, authored, saved, or exported data. Limits may exist only on temporary UI/prompt projections or documented runtime caches and must never overwrite canonical data.
- Never hide malformed or missing required data by guessing defaults, silently repairing it, deleting fields, or layering fallback patches. Validate it, report the exact problem, and fix the authoritative producer or structured contract.
- Fix root causes. Do not preserve an invalid primary path and add UI merging, repeated polling, duplicate writes, automatic reselection, or other compensating behavior around it.
- Do not make a full render or navigation/state reset to refresh one asynchronously completed UI element. Update the owning record and the smallest affected UI surface.
- Do not use a real story, character, profile, save, image, or other player-owned identity as a smoke fixture. Smoke data must use unique generic smoke identities, remain self-contained, and clean up everything it creates even on failure.
- Work on only the version the user named. Never copy a change between normal EmberAdventuresLite and EmberAdventuresLite Codex unless the user explicitly says `both` or names both versions. If the version is genuinely unclear, stop and ask.
- Do not introduce migration or backward-compatibility code before the first public release unless the user explicitly requests it.
- Do not change persistent settings as a side effect of warnings, startup gates, story starts, profile selection UI, or other unrelated actions. Settings change only through their owning setting/profile control or an explicit import.

## Smoke-Test Policy

- When discussing smoke tests with the user, identify them only by their numbers, never by their names or internal IDs. Use the current report or suite order to verify numbers.

- A user-provided smoke report containing failures is a request to investigate and fix those failures, unless the user asks a question instead or otherwise indicates that fixes should wait. Do not stop at reporting the failures. This does not by itself authorize running browser smokes.

- Add or update smoke coverage whenever a new feature or behavior change can meaningfully be covered, including small changes. This is the user's standing preference. Adding coverage does not authorize running smokes; run them only when requested.
- Use `EMBERADVENTURES_SMOKE_INDEX.md` first to identify likely affected smoke tests.
- Add or update smokes for high-risk behavior: saves, profile images, public hosting, message queues, AI turn/order, story starts, onboarding, and library import/export/publish flows.
- For small visual/copy/layout edits, suggest smoke coverage only if there is a real regression risk.
- Real Perchance image smokes must stay Medium or Long, never Short.

## Validation Tiers

- Copy/CSS-only: no command unless the edit is easy to typo.
- Small local JS edit: inspect the edited function and nearby call sites.
- Medium JS edit: targeted syntax validation if practical.
- Storage/public hosting/profile image/message queue changes: targeted logic review plus smoke update/check.
- Major refactor: broader checks only after telling the user.

## Perchance Build Notes

- Canonical app source is usually `D:\Program Files\JS Dev\EmberAdventuresLite\bottom.html`.
- `bottom_compressed.html` is generated output. Rebuild it when explicitly requested or as part of a user-requested smoke run after changing `bottom.html`.
- `left.js` is the Perchance left pane.
- Do not use browser/runtime validation unless the user explicitly asks.
