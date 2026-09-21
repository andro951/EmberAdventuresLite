# EmberAdventuresLite Code Index

Purpose: quick lookup for common systems in `bottom.html` so future work can use targeted searches.

## Core Files

- `bottom.html`: main app, UI, runtime state, smokes.
- `left.js`: Perchance left pane imports and metadata.
- `bottom_compressed.html`: generated compressed build; do not edit manually.
- `build_bottom_compressed.js`: compressed build script; user runs it.
- `stories/`: bundled story templates.
- `characters/`: bundled character definitions.

## Search Anchors

- App defaults/settings: `const app =`, `defaultSettings`, `profileSettingsFromDefaults`.
- Async work coordinator: `createWorkManager`, `enqueueOrdered`, `startBackground`, `scheduleMaintenance`, `scheduleUi`.
- Save storage: `saveActiveGame`, `saveCurrentGame`, `saveRecordKey`, `saveImageOwnerType`, `persistenceRevisions`, `active/current`.
- Blob-backed image storage: `libraryStorageRow`, `saveImageRowsForOwner`, `loadImageRowsForOwner`, `sessionImageObjectUrlCache`.
- Bulk import concurrency: `mapWithConcurrency`, `uploadStoryTemplate`, `pickCharacterImportFiles`.
- Main-thread diagnostics: `startLongTaskObserver`, `traceValue`, `perfConsole`.
- Smoke registry: `function devSmokeScenarioRegistry`.
- Smoke timing/category metadata: `function devSmokeScenarioMeta`.
- Smoke suite UI: `openDevSmokeSuiteModal`, `devSmokeScenariosForMode`.
- Public hosting/Supabase: `SUPABASE_PROJECT_URL`, `publicLibrary`, `supabase`, `library_items`.
- Public account UI: `openPublicAccount`, `Google Account`, `supabaseSignedInUser`.
- Character Library: `openCharacterLibrary`, `characterLibraryTabHtml`, `refreshCharacterLibraryActiveTabCards`, `openCharacterLibraryDetail`.
- Story Library: `openStoryLibrary`, `storyLibrary`, `storyTemplate`.
- Profile images: `profileImages`, `openProfileImages`, `queueProfileImage`, `generateProfileImage`, `default_profile_image`.
- Image lab: `openImageLab`, `generateImageLab`, `imageMode`, `imageModel`.
- Prompt Editor: `openPromptEditor`, `promptEditor`, `Copy From Last Real AI Call`.
- Main menu: `mainMenu`, `openMainMenu`, `renderMainMenu`, `preMainMenu`.
- Onboarding/new adventure: `newAdventure`, `profile creation`, `startStoryTemplate`.
- Cast/party/NPC cards: `left column`, `party`, `npcDirectoryCardHtml`, `characterCard`.
- Clothing/outfits: `normalizeOutfitList`, `normalizeClothingSlots`, `saveCurrentClothingAsOutfit`.
- Voice/reader: `voice`, `speechSynthesis`, `read game messages`.
- Objective flow: `objective`, `completion_control`, `completeObjective`, `objective verifier`.
- State update queue: `state sync`, `enqueueState`, `force state`.
- NPC inspection: `inspectNpc`, `npc inspect`, `new NPC`, `speaker repair`.

## Documentation Files

- `EMBERADVENTURES_AGENT_WORKING_RULES.md`: standing rules for future Codex work.
- `EMBERADVENTURES_SMOKE_INDEX.md`: smoke number/name/category/purpose lookup.
- `EMBERADVENTURES_TODO.md`: unrelated issues found while working.
- `behavior-rules.md`: user-facing behavior/rules reference.
- `profile-image-behavior-notes.md`: profile image rules.
- `tasks/README.md`: task board workflow.
- `tasks/todo/README.md`: active todo backlog with full descriptions.
- `tasks/ready-for-testing/README.md`: implemented items awaiting user verification.
- `archive/README.md`: archived docs and manifests.
