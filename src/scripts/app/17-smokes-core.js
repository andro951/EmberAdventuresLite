
        async function devRunStoryPlayerSelectSmokeTest() {
            devTestLog("Scenario start: story-player-select-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const characterDefinitionsSnapshot = clone(app.characterDefinitions || []);
            try {
                devResetForLiveTest("story-player-select-smoke");
                devCreateTestProfile({  });
                const maleOptionOutfit = {
                    id: "male-option-outfit",
                    name: "Male Option Outfit",
                    clothing: { shirt: "male option shirt", pants: "male option pants" },
                };
                const nonMaleOptionOutfit = {
                    id: "non-male-option-outfit",
                    name: "Non-Male Option Outfit",
                    clothing: { shirt: "non-male option shirt", skirt: "non-male option skirt" },
                };
                const templateInput = {
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "source_retelling",
                            title: "Character Select Test",
                        },
                    },
                    player: {
                        ...blankCharacterTemplate("Roland"),
                        id: "story-player-roland",
                        name: "Roland",
                        age: 34,
                        gender: "male",
                        role: "soldier test option",
                        personality_description: "Disciplined and practical.",
                        speech_style: "Brief, disciplined, and practical.",
                        boldness: 6,
                        romanceable: true,
                        appearance: { ...blankAppearanceTemplate() },
                        outfits: [maleOptionOutfit],
                        active_outfit_id: "male-option-outfit",
                        starting_outfit_id: "male-option-outfit",
                        fallback_name: "Rhea",
                        fallback_outfits: [nonMaleOptionOutfit],
                        fallback_starting_outfit_id: "non-male-option-outfit",
                    },
                    players: [
                        {
                            ...blankCharacterTemplate("Roland"),
                            id: "story-player-roland",
                            name: "Roland",
                            age: 34,
                            gender: "male",
                            role: "soldier test option",
                            personality_description: "|[player_first_name]| is disciplined and practical. |[player_pronoun_cap]| keeps going.",
                            speech_style: "Brief, disciplined, and practical.",
                            boldness: 6,
                            romanceable: false,
                            appearance: { ...blankAppearanceTemplate() },
                            outfits: [maleOptionOutfit],
                            active_outfit_id: "male-option-outfit",
                            starting_outfit_id: "male-option-outfit",
                            fallback_name: "Rhea",
                            fallback_outfits: [nonMaleOptionOutfit],
                            fallback_starting_outfit_id: "non-male-option-outfit",
                        },
                        {
                            ...blankCharacterTemplate("Lilith"),
                            id: "story-player-lilith",
                            name: "Lilith",
                            age: 27,
                            gender: "female",
                            role: "siren test option",
                            personality_description: "Confident and fast-moving.",
                            speech_style: "Confident, quick, and direct.",
                            boldness: 8,
                            romanceable: false,
                            appearance: { ...blankAppearanceTemplate() },
                            outfits: [nonMaleOptionOutfit],
                            active_outfit_id: "non-male-option-outfit",
                            starting_outfit_id: "non-male-option-outfit",
                            fallback_name: "Liam",
                            fallback_outfits: [maleOptionOutfit],
                            fallback_starting_outfit_id: "male-option-outfit",
                        },
                    ],
                    characters: {},
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "Two playable options are available before the opening.",
                        party_members_present: [],
                        image_characters: ["Player"],
                        npcs_present: [],
                        image_action: "arriving at the test road",
                    },
                    objectives: {
                        active_id: "choose-road",
                        items: [
                            {
                                id: "choose-road",
                                title: "Take the Road",
                                status: "active",
                                summary: "Start walking down the road.",
                                while_active_guidance:
                                    "Keep the opening focused on choosing and taking the road.",
                                completion_control: "player",
                                completion_criteria: "Take the road.",
                                completion_instruction: "Start the selected character down the road.",
                                next_objectives: [{
                                    id: "choose-road-freeplay-ending",
                                    completion_instruction: "Start the selected character down the road.",
                                    rewards: [],
                                    ending_type: "freeplay",
                                    ending_message: "The selected character begins the open-ended journey.",
                                }],
                            },
                        ],
                    },
                };
                devAssert(
                    templateInput.player.active_outfit_id === "male-option-outfit" &&
                        templateInput.player.outfits.some(
                            (outfit) => outfit.id === templateInput.player.active_outfit_id,
                        ),
                    "player-select AI fixture references an existing active outfit before repair",
                    templateInput.player,
                );
                const materializedRolandInput =
                    materializeCharacterDefinitionForRuntimeFields(
                        templateInput.players[0],
                        "Roland",
                    );
                devAssert(
                    materializedRolandInput.active_outfit_id === "male-option-outfit",
                    `player-select fixture preserves Roland's active outfit through definition materialization: ${JSON.stringify(materializedRolandInput)}`,
                    materializedRolandInput,
                );
                const templateState = repairAiGeneratedState(templateInput);
                for (const option of templateState.players || []) {
                    if (typeof option.profile_image_id !== "string")
                        option.profile_image_id = "";
                    if (!Array.isArray(option.profile_images)) option.profile_images = [];
                }
                for (const character of [templateState.player, ...(templateState.players || [])]) {
                    character.relationship_to_player ||= "playable story character";
                    for (const key of ["trust", "attraction", "affection"])
                        if (!Number.isFinite(character[key])) character[key] = 0;
                    character.default_seed = Number.isSafeInteger(character.default_seed)
                        ? character.default_seed
                        : 0;
                }
                const playerSelectStoryRecord = devSmokeStoryRecord({
                    id: "story-player-select-test",
                    title: "Story Player Select Test",
                    description: "A test template with two playable player options.",
                    genres: ["fantasy"],
                    player: templateState.player,
                    players: templateState.players,
                    objectives: templateState.objectives.items,
                    active_id: "choose-road",
                    scene_summary: templateState.scene.summary,
                    image_action: templateState.scene.image_action,
                    opening_text:
                        'The test road waits for |[player_name]|. (|[player_name]|) "Ready."',
                });
                addImmutableDefinitionFieldsToState(templateState);
                let missingRuntimePlayerIdError = "";
                try {
                    await storyImportWorkerRequest("materialize-story-runtime", {
                        state: {
                            ...clone(templateState),
                            player: {
                                ...clone(templateState.player),
                                id: "",
                            },
                        },
                        messages: [],
                    });
                } catch (error) {
                    missingRuntimePlayerIdError = String(error?.message || error);
                }
                devAssert(
                    /Story runtime player id is required and cannot be empty\./i.test(
                        missingRuntimePlayerIdError,
                    ),
                    "story runtime materialization rejects an empty player id",
                    { error: missingRuntimePlayerIdError },
                );
                const playableCastOverlapErrors =
                    duplicateCharacterDefinitionIdValidationErrors({
                        state: {
                            ...clone(templateState),
                            future_cast: {
                                items: {
                                    "story-player-roland": {
                                        id: "story-player-roland",
                                        full_character: clone(templateState.players[0]),
                                    },
                                },
                            },
                        },
                    });
                devAssert(
                    !playableCastOverlapErrors.length,
                    "story validation permits one authored player to also exist in future cast",
                    playableCastOverlapErrors,
                );
                const unrelatedDuplicateErrors =
                    duplicateCharacterDefinitionIdValidationErrors({
                        state: {
                            ...clone(templateState),
                            characters: {
                                "Unrelated Duplicate": {
                                    ...clone(templateState.players[0]),
                                    name: "Unrelated Duplicate",
                                    id: "story-player-roland",
                                },
                            },
                        },
                    });
                devAssert(
                    unrelatedDuplicateErrors.some(
                        (error) => error?.path === "state.characters.Unrelated Duplicate.id",
                    ),
                    "story validation still rejects an unrelated duplicate character id",
                    unrelatedDuplicateErrors,
                );
                devUpsertStoryTemplatesForSmoke([
                    playerSelectStoryRecord,
                ]);
                devCreateTestProfile({  });
                // This scenario verifies the authored Roland presentation first;
                // do not inherit a presentation saved by an earlier smoke.
                setStoryPlayerSelectGender("story-player-select-test", "");
                const originalShowConfirm = showConfirm;

                try {
                    showConfirm = async (title, message, options) => {

                        return true;
                    };
                    await startStoryTemplate("story-player-select-test");
                    const selectedPlayerStart = startStoryTemplatePlayerChoice(
                        "story-player-select-test",
                        "Roland",
                    );
                    devAssert(
                        $("modalBox")?.matches?.("[data-story-start-loading-modal='1']") &&
                            !!$("modalBox")?.querySelector?.("[data-story-start-loading]") &&
                            /Preparing Roland/i.test($("modalBox")?.textContent || "") &&
                            !/Choose Your Character/i.test($("modalBox")?.textContent || ""),
                        "selecting a player immediately replaces character select with a story-start loading screen",
                        { modalText: $("modalBox")?.textContent || "" },
                    );
                    const selectedPlayerStarted = await selectedPlayerStart;
                    if (selectedPlayerStarted === false)
                        devTestLog("Selected-player story start error", {
                            error: app.lastStoryStartError || "",
                        });
                    devAssert(
                        selectedPlayerStarted !== false,
                        `selected-player story start completes without a hidden preparation error${app.lastStoryStartError ? `: ${app.lastStoryStartError}` : ""}`,
                        {
                            modalText: $("modalBox")?.textContent || "",
                            statePlayer: app.state?.player?.name || "",
                            storyTitle:
                                app.state?.meta?.story_source?.title || "",
                            startError: app.lastStoryStartError || "",
                        },
                    );
                    devAcceptPlayerInputHelpIfShown();
                    await devWaitFor(
                        () =>
                            app.state?.player?.name === "Roland" &&
                            app.state?.meta?.story_source?.title ===
                                "Story Player Select Test",
                        8000,
                        "selected-player story template to become the active game",
                    );

                } finally {
                    showConfirm = originalShowConfirm;
                }
                devCreateTestProfile({  });
                await startStoryTemplate("story-player-select-test");
                devAssert(
                    $("modal")?.classList?.contains("open") &&
                        /Choose Your Character/i.test($("modalBox")?.textContent || ""),
                    "starting a multi-player template opens character select before play",
                    { modalText: $("modalBox")?.textContent || "" },
                );
                devAssert(
                    $("modalBox")?.matches?.("[data-player-select-modal='1']") &&
                        !document.querySelector("[data-story-library-detail-modal='1']"),
                    "character select replaces the story detail instead of exposing the previous game",
                );
                devAssert(
                    $("modalBox")?.matches?.("[data-player-select-modal='1']"),
                    "character select modal uses fullscreen player-select layout",
                );
                closeModal();
                devAssert(
                    app.mainMenuOpen === true &&
                        !app.pendingStoryTemplateStart &&
                        !$("modal")?.classList?.contains("open"),
                    "closing player-select before choosing a player returns to the main menu instead of exposing an empty game",
                    {
                        mainMenuOpen: app.mainMenuOpen,
                        pending: app.pendingStoryTemplateStart,
                        modalOpen: $("modal")?.classList?.contains("open"),
                    },
                );
                await startStoryTemplate("story-player-select-test");
                devAssert(
                    document.querySelectorAll(
                        "[data-story-player-select-card] .profile-image-thumb-wrap",
                    ).length >= 2,
                    "character select cards render profile image areas",
                );
                devAssert(
                    /Roland/i.test($("modalBox")?.textContent || "") &&
                        /Lilith/i.test($("modalBox")?.textContent || ""),
                    "character select lists every player option",
                );
                devAssert(
                    /Roland is disciplined and practical\. He keeps going\./i.test(
                        $("modalBox")?.textContent || "",
                    ) &&
                        !/\|\[player_(?:first_name|pronoun_cap)\]\|/i.test(
                            $("modalBox")?.textContent || "",
                        ),
                    "character select resolves explicit player name and pronoun tokens in player option descriptions",
                    $("modalBox")?.textContent || "",
                );
                devAssert(
                    $("modalBox")?.querySelector?.("select")?.value === "" &&
                        storyPlayerSelectGenderChoice(
                            "story-player-select-test",
                            storyTemplateById("story-player-select-test"),
                        ) === "",
                    "player-select gender picker starts on the profile's saved Story default value",
                    {
                        selectValue: $("modalBox")?.querySelector?.("select")?.value || "",
                        chosenGender: storyPlayerSelectGenderChoice(
                            "story-player-select-test",
                            storyTemplateById("story-player-select-test"),
                        ),
                    },
                );
                setStoryPlayerSelectGender("story-player-select-test", "female");
                devAssert(
                    /Rhea/i.test($("modalBox")?.textContent || "") &&
                        /Player presentation/i.test($("modalBox")?.textContent || "") &&
                        !/Choose Roland/i.test($("modalBox")?.textContent || ""),
                    "player-select gender picker projects authored player cards before game start",
                    { modalText: $("modalBox")?.textContent || "" },
                );
                devAssert(
                    app.settings.storyPlayerSelectGender === "female" &&
                        activeUserProfile()?.settings?.storyPlayerSelectGender === "female",
                    "player-select gender picker saves the selected presentation to the active profile",
                    {
                        settingsValue: app.settings.storyPlayerSelectGender,
                        profileValue: activeUserProfile()?.settings?.storyPlayerSelectGender,
                    },
                );
                setStoryPlayerSelectGender("story-player-select-test", "");
                devAssert(
                    $("modalBox")?.querySelector?.("select")?.value === "" &&
                        /Choose Roland/i.test($("modalBox")?.textContent || "") &&
                        /Choose Lilith/i.test($("modalBox")?.textContent || "") &&
                        !/Choose Rhea/i.test($("modalBox")?.textContent || ""),
                    "player-select Story default remains selected and restores authored player presentations",
                    { modalText: $("modalBox")?.textContent || "" },
                );
                devAssert(
                    app.settings.storyPlayerSelectGender === "" &&
                        activeUserProfile()?.settings?.storyPlayerSelectGender === "",
                    "player-select Story default saves back to the active profile",
                    {
                        settingsValue: app.settings.storyPlayerSelectGender,
                        profileValue: activeUserProfile()?.settings?.storyPlayerSelectGender,
                    },
                );
                setStoryPlayerSelectGender("story-player-select-test", "female");
                devTestLog("story player alternate presentation selection", {
                    savedChoice: app.storyPlayerSelectGenderChoices?.[
                        "story-player-select-test"
                    ],
                    resolvedChoice: storyPlayerSelectGenderChoice(
                        "story-player-select-test",
                        storyTemplateById("story-player-select-test"),
                    ),
                });
                await startStoryTemplatePlayerChoice(
                    "story-player-select-test",
                    "Roland",
                );
                devTestLog("story player alternate presentation result", {
                    name: app.state?.player?.name,
                    id: app.state?.player?.id,
                    gender: app.state?.player?.gender,
                    activeOutfitId: app.state?.player?.active_outfit_id,
                    skirt: app.state?.player?.clothing?.skirt,
                    selectedPlayerGender: app.state?.meta?.selected_player_gender,
                });
                devAssert(
                    app.state?.player?.name === "Rhea" &&
                        app.state?.player?.id === "story-player-roland" &&
                        app.state?.player?.gender === "female" &&
                        app.state?.player?.active_outfit_id === "non-male-option-outfit" &&
                        app.state?.player?.clothing?.skirt === "non-male option skirt" &&
                        app.state?.meta?.selected_player_gender === "female",
                    "selected story player becomes runtime state.player",
                    app.state?.player,
                );
                const idConditionTarget = matchingObjectiveNextOption(
                    {
                        next_objectives: [
                            {
                                objective_id: "choose-road",
                                requirements: [
                                    {
                                        path: "player.id",
                                        op: "==",
                                        value: "story-player-roland",
                                    },
                                ],
                            },
                        ],
                    },
                    app.state,
                );
                devAssert(
                    idConditionTarget?.id === "choose-road",
                    "selected player id survives story materialization for conditional objective routing",
                    {
                        playerId: app.state?.player?.id || "",
                        targetId: idConditionTarget?.id || "",
                    },
                );
                devAssert(
                    !Array.isArray(app.state?.players),
                    "runtime state does not keep template player option array after selection",
                    app.state?.players,
                );
                devAssert(
                    app.state?.meta?.selected_player_name === "Rhea",
                    "runtime state records selected player name for debugging/save review",
                    app.state?.meta,
                );
                devAssert(
                    (app.messages || []).some((message) => message.role === "assistant"),
                    "starting selected-player story loads opening messages",
                    { messages: app.messages.length },
                );
                const selectedOpening = (app.messages || []).find(
                    (message) => message.role === "assistant",
                );
                devAssert(
                    selectedOpening &&
                        /Rhea/.test(selectedOpening.text || "") &&
                        !/\{player_name\}/i.test(selectedOpening.text || "") &&
                        !/\(Rhea\)/.test(selectedOpening.text || "") &&
                        /\(Rhea\)/.test(selectedOpening.voiceText || ""),
                    "opening player-name placeholders resolve for display and voice while hidden tags stay hidden",
                    selectedOpening,
                );
                const ownershipMismatches = saveOwnershipMismatchDetails(activeSaveId());
                devAssert(
                    ownershipMismatches.length === 0,
                    "selected-player story start stamps save ownership correctly",
                    { ownershipMismatches },
                );
                const libraryPlayer = devSmokeCharacterDefinition(
                    "Smoke Library Player",
                    {
                        id: "character-smoke-library-player",
                        name: "Smoke Library Player",
                        source: "Original",
                        creation_tool: "debug harness",
                        age: 29,
                        gender: "male",
                        role: "library role that should be replaced",
                        speech_style: "Direct smoke-test dialogue.",
                        boldness: 5,
                        romanceable: true,
                        starting_known_facts: ["Library fact remains."],
                        known_facts: ["Library fact remains."],
                        starting_inventory: ["library item"],
                        inventory: ["library item"],
                        stats: { resolve: 2 },
                        starting_held_items: { right_hand: "library tool", left_hand: null },
                        held_items: { right_hand: "library tool", left_hand: null },
                        outfits: [
                            {
                                id: "library-clothes",
                                name: "Library Clothes",
                                clothing: { shirt: "library shirt", pants: "library pants" },
                            },
                        ],
                        starting_outfit_id: "library-clothes",
                        active_outfit_id: "library-clothes",
                        fallback_name: "Smoke Library Woman",
                        fallback_outfits: [
                            {
                                id: "library-dress",
                                name: "Library Dress",
                                clothing: { shirt: "library blouse", skirt: "library skirt" },
                            },
                        ],
                        fallback_starting_outfit_id: "library-dress",
                        appearance: { ...blankAppearanceTemplate() },
                        default_profile_image: profileImageSlotFromExactInput({
                            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                            local_image_id: "",
                            source: "smoke hosted profile",
                            seed: 0,
                            prompt: "Smoke Library Player profile.",
                            negative_prompt: "",
                            note: "",
                            male: true,
                        }),
                        profile_image_presentations: {
                            male: profileImageSlotFromExactInput({
                                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                                local_image_id: "",
                                source: "smoke hosted profile",
                                seed: 0,
                                prompt: "Smoke Library Player male profile.",
                                negative_prompt: "",
                                note: "",
                                male: true,
                            }),
                            non_male: profileImageSlotFromExactInput({
                                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                                local_image_id: "",
                                source: "smoke hosted profile",
                                seed: 0,
                                prompt: "Smoke Library Player non-male profile.",
                                negative_prompt: "",
                                note: "",
                                male: false,
                            }),
                        },
                    },
                );
                libraryPlayer.genres = ["fantasy"];
                delete libraryPlayer.known_facts;
                const libraryPlayerRecordId = libraryPlayer.id;
                const libraryPlayerRecord = characterLibraryRecordFromDefinition(
                    libraryPlayer,
                    { creator: "debug harness" },
                );
                app.characterDefinitions = [
                    ...(app.characterDefinitions || []).filter(
                        (record) =>
                            characterLibraryRecordId(record) !== libraryPlayerRecordId,
                    ),
                    libraryPlayerRecord,
                ];
                queuePerRecordLibraryRecordsSave(
                    CHARACTER_LIBRARY_KEY,
                    [libraryPlayerRecord],
                    "story player select smoke library character stored",
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                );
                const libraryPlayerPickerRecordId = characterLibraryRecordId(
                    app.characterDefinitions[app.characterDefinitions.length - 1],
                );
                const anyPlayerTemplate = validatedStoryTemplateRecord({
                    ...clone(storyTemplateById("story-player-select-test")),
                    id: "story-any-player-select-smoke",
                    title: "Smoke Any Player Selection",
                    allow_any_player: true,
                    any_player_starting_state: {
                        role: "story-appointed investigator",
                        starting_known_facts_to_add: ["Story fact was added."],
                        starting_inventory: ["story key", "story notebook"],
                        stats: { resolve: 9, clue_count: 1 },
                        starting_held_items: { right_hand: "story notebook", left_hand: null },
                        starting_state_of_mind: "focused",
                        starting_physical_state: "rested",
                        starting_pose: "standing at the gate",
                        male_outfits: [
                            {
                                id: "male-story-outfit",
                                name: "Male Story Outfit",
                                clothing: { shirt: "blue story shirt", pants: "black story pants" },
                            },
                        ],
                        male_starting_outfit_id: "male-story-outfit",
                        non_male_outfits: [
                            {
                                id: "non-male-story-outfit",
                                name: "Non-Male Story Outfit",
                                clothing: { shirt: "green story shirt", pants: "gray story pants" },
                            },
                        ],
                        non_male_starting_outfit_id: "non-male-story-outfit",
                    },
                });
                devUpsertStoryTemplatesForSmoke([anyPlayerTemplate]);
                await startStoryTemplate(anyPlayerTemplate.id);
                setStoryPlayerSelectGender(anyPlayerTemplate.id, "female");
                const anyPlayerChoiceCard = document.querySelector(
                    "[data-story-any-player-card]",
                );
                devAssert(
                    anyPlayerChoiceCard?.querySelector?.(".player-select-library-tile")
                        ?.textContent?.trim() === "Select Character From Library" &&
                        anyPlayerChoiceCard?.querySelector?.("p")?.textContent?.trim() ===
                            "Use any character saved in your local Character Library" &&
                        !anyPlayerChoiceCard?.querySelector?.(
                            ".profile-image-placeholder, .profile-image-loading, .loading-spinner",
                        ) &&
                        !anyPlayerChoiceCard?.querySelector?.(".character-name"),
                    "an allow-any-player story displays a static Character Library text tile without duplicate or loading UI",
                    { html: anyPlayerChoiceCard?.outerHTML || "" },
                );
                openStoryAnyPlayerLibrary(anyPlayerTemplate.id);
                const anyPlayerLibraryCard = [
                    ...document.querySelectorAll(
                        "[data-story-any-player-picker] [data-story-any-player-library-card]",
                    ),
                ].find(
                    (card) =>
                        card.dataset.characterLibraryRecordId === libraryPlayerPickerRecordId,
                );
                const anyPlayerLibraryButton = anyPlayerLibraryCard?.querySelector("button");
                devAssert(
                    !!anyPlayerLibraryButton &&
                        anyPlayerLibraryCard
                            ?.querySelector(".character-library-card-name")
                            ?.textContent?.trim() === "Smoke Library Woman",
                    "the arbitrary-player picker displays the selected presentation of a real local Character Library definition",
                );
                const projectedLibraryPlayer = characterLibraryPresentation(
                    libraryPlayer,
                    libraryPlayerRecordId,
                    "female",
                );
                devAssert(
                    projectedLibraryPlayer.starting_outfit_id === "library-dress" &&
                        projectedLibraryPlayer.outfits?.some(
                            (outfit) => outfit.id === "library-dress",
                        ),
                    "library-player presentation keeps its selected outfit and outfit list together",
                    {
                        startingOutfitId: projectedLibraryPlayer.starting_outfit_id,
                        outfitIds: projectedLibraryPlayer.outfits?.map(
                            (outfit) => outfit.id,
                        ),
                    },
                );
                const fixedLibraryPlayer = characterLibraryPresentation(
                    {
                        ...libraryPlayer,
                        romanceable: false,
                    },
                    libraryPlayerRecordId,
                    "female",
                );
                devAssert(
                    fixedLibraryPlayer.name === "Smoke Library Player" &&
                        fixedLibraryPlayer.gender === "male" &&
                        fixedLibraryPlayer.starting_outfit_id === "library-clothes",
                    "a non-romanceable Character Library definition keeps its authored presentation",
                    {
                        name: fixedLibraryPlayer.name,
                        gender: fixedLibraryPlayer.gender,
                        startingOutfitId: fixedLibraryPlayer.starting_outfit_id,
                    },
                );
                anyPlayerLibraryButton.click();
                await devWaitFor(
                    () => app.state.player?.name === "Smoke Library Woman",
                    8000,
                    "library player card selection to start the story",
                );
                const anyPlayerRuntimeChecks = {
                    name: app.state.player?.name === "Smoke Library Woman",
                    gender: app.state.player?.gender === "female",
                    role: app.state.player?.role === "story-appointed investigator",
                    inventory:
                        app.state.player?.inventory?.join("|") ===
                        "story key|story notebook",
                    resolve: app.state.player?.stats?.resolve === 9,
                    clueCount: app.state.player?.stats?.clue_count === 1,
                    heldItem:
                        app.state.player?.held_items?.right_hand === "story notebook",
                    stateOfMind: app.state.player?.state_of_mind === "focused",
                    physicalState: app.state.player?.physical_state === "rested",
                    pose: app.state.player?.pose === "standing at the gate",
                    outfit:
                        app.state.player?.active_outfit_id ===
                        "non-male-story-outfit",
                    clothing: app.state.player?.clothing?.shirt === "green story shirt",
                    libraryFact:
                        app.state.player?.known_facts?.includes("Library fact remains."),
                    storyFact:
                        app.state.player?.known_facts?.includes("Story fact was added."),
                };
                const failedAnyPlayerRuntimeChecks = Object.entries(anyPlayerRuntimeChecks)
                    .filter(([, passed]) => !passed)
                    .map(([name]) => name);
                devTestLog(`library player runtime projection ${JSON.stringify({
                    inventory: app.state.player?.inventory,
                    heldItems: app.state.player?.held_items,
                    failedChecks: failedAnyPlayerRuntimeChecks,
                })}`);
                devAssert(
                    Object.values(anyPlayerRuntimeChecks).every(Boolean),
                    `library player selection applies presentation projection plus replacement and additive story fields to runtime${
                        failedAnyPlayerRuntimeChecks.length
                            ? ` (failed: ${failedAnyPlayerRuntimeChecks.join(", ")})`
                            : ""
                    }`,
                    {
                        checks: anyPlayerRuntimeChecks,
                        player: app.state.player,
                    },
                );
                devAssert(
                    libraryPlayer.role === "library role that should be replaced" &&
                        libraryPlayer.starting_inventory?.[0] === "library item" &&
                        libraryPlayer.starting_outfit_id === "library-clothes",
                    "story-specific any-player fields do not mutate the Character Library definition",
                    libraryPlayer,
                );
                const nonMaleResult = materializeCharacterDefinitionForRuntime(
                    applyAnyPlayerStartingState(
                        { ...clone(libraryPlayer), gender: "female" },
                        anyPlayerTemplate.any_player_starting_state,
                    ),
                    libraryPlayer.name,
                );
                devAssert(
                    nonMaleResult.active_outfit_id === "non-male-story-outfit" &&
                        nonMaleResult.clothing?.shirt === "green story shirt",
                    "non-male library players receive the non-male story outfit branch",
                    nonMaleResult,
                );
                const noPlayerTemplateState = clone(templateState);
                delete noPlayerTemplateState.player;
                noPlayerTemplateState.players = [];
                devAssert(
                    storyTemplateAllowsAnyPlayer({ state: noPlayerTemplateState }),
                    "a story with no authored player options assumes arbitrary-player selection",
                );
                const invalidAnyPlayer = validateStoryDefinition({
                    ...clone(anyPlayerTemplate),
                    any_player_starting_state: {
                        male_outfits: [
                            {
                                id: "male-story-outfit",
                                name: "Male Story Outfit",
                                clothing: { shirt: "shirt" },
                            },
                        ],
                        male_starting_outfit_id: "missing-outfit",
                    },
                });
                devAssert(
                    !invalidAnyPlayer.ok &&
                        invalidAnyPlayer.errors.some(
                            (error) => error.path === "any_player_starting_state.male_starting_outfit_id",
                        ),
                    "story validation rejects an any-player starting outfit id that does not exist",
                    invalidAnyPlayer.errors,
                );
                devAcceptPlayerInputHelpIfShown();
                addMessage("system", "Story player select smoke test passed.");
                showNotice("Live Test Passed", "Story player select smoke test passed.");
                devTestLog("Scenario complete: story-player-select-smoke", {
                    selectedPlayer: app.state?.player?.name,
                    currentGameSaveId: app.currentGameSaveId,
                });
            } finally {
                await devCleanupSmokeStoryLibraryArtifacts("story player select smoke story artifacts cleaned");
                await devRestoreCharacterDefinitionsForSmoke(
                    characterDefinitionsSnapshot,
                    "story player select smoke character library restored",
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunPreferredGenderScenePresenceSmokeTest() {
            devTestLog("Scenario start: preferred-gender-scene-presence-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const fixtureNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            try {
                devResetForLiveTest("preferred-gender-scene-presence-smoke");
                devCreateTestProfile({  });
                const daniel = devSmokeRuntimeCharacter("Daniel Mercer", {
                    id: "smoke-daniel-mercer",
                    gender: "male",
                    romanceable: true,
                    role: "fake starting hero",
                });
                daniel.fallback_name = "Danielle Mercer";
                daniel.fallback_starting_outfit_id = "smoke-danielle-outfit";
                daniel.fallback_outfits = [
                    {
                        id: "smoke-danielle-outfit",
                        name: "Danielle Smoke Outfit",
                        clothing: {
                            shirt: "plain smoke-test blouse",
                            pants: "plain smoke-test trousers",
                            underwear: "plain smoke-test underwear",
                            feet: "plain smoke-test shoes",
                        },
                    },
                ];
                const helene = devSmokeRuntimeCharacter("Helene Arvett", {
                    id: "smoke-helene-arvett",
                    gender: "female",
                    romanceable: true,
                    role: "fake starting hero",
                });
                const player = devSmokeRuntimeCharacter("Scene Presence Tester", {
                    id: "smoke-scene-presence-player",
                    gender: "female",
                    role: "fake smoke-test player",
                });
                const template = devSmokeStoryRecord({
                    id: `smoke-preferred-gender-scene-${fixtureNonce}`,
                    title: "Preferred Gender Scene Presence Smoke",
                    player,
                    characters: {
                        "Daniel Mercer": daniel,
                        "Helene Arvett": helene,
                    },
                    party_members_present: ["Daniel Mercer", "Helene Arvett"],
                    image_characters: ["Daniel Mercer", "Helene Arvett"],
                });
                devUpsertStoryTemplatesForSmoke([template]);
                const imported = await app.library.importPayload("story", {
                    app: "EmberAdventures",
                    exportType: "story-template",
                    exportedAt: new Date().toISOString(),
                    storyTemplate: storyDefinitionForExport(template),
                });
                const materialized = await app.library.materializeNewGame({
                    storyId: imported.entry.storyId,
                    revisionId: imported.entry.revisionId,
                    selection: {
                        source: "story",
                        characterId: player.id,
                    },
                    preferredCharacterGenders: ["female"],
                    swapAllGendersToPreferred: false,
                });
                const sceneMembers = materialized.initialRecords
                    .filter((entry) => entry.storeName === "sceneMembers")
                    .map((entry) => entry.record.characterId);
                const characterDefinitions = new Map(
                    materialized.initialRecords
                        .filter((entry) => entry.storeName === "saveCharacterDefinitions")
                        .map((entry) => [entry.record.characterId, entry.record]),
                );
                devAssert(
                    sceneMembers.includes("smoke-daniel-mercer") &&
                        sceneMembers.includes("smoke-helene-arvett") &&
                        characterDefinitions.get("smoke-daniel-mercer")?.name ===
                            "Danielle Mercer" &&
                        characterDefinitions.get("smoke-helene-arvett")?.name ===
                            "Helene Arvett",
                    "preferred-gender adaptation preserves starting scene membership by stable character id",
                    {
                        sceneMembers,
                        daniel: characterDefinitions.get("smoke-daniel-mercer"),
                        helene: characterDefinitions.get("smoke-helene-arvett"),
                    },
                );
                addMessage("system", "Preferred-gender scene presence smoke passed.");
                devTestLog("Scenario complete: preferred-gender-scene-presence-smoke");
            } finally {
                await devCleanupSmokeStoryLibraryArtifacts(
                    "preferred-gender scene presence smoke story artifacts cleaned",
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunPlayerSelectScrollImageSmokeTest() {
            devTestLog("Scenario start: player-select-scroll-image-smoke");
            const savedOverrides = app.profileEntityOverrides;
            const savedDeferred = app.deferredStoryPlayerSelectProfileRenders;
            const savedBusyUntil = app.storyPlayerSelectScrollBusyUntil;
            const savedTimer = app.storyPlayerSelectScrollTimer;
            const name = "Scroll Smoke Player";
            const hadCollidingRuntimeCharacter = Object.hasOwn(
                app.state.characters || {},
                name,
            );
            const savedCollidingRuntimeCharacter = app.state.characters?.[name];
            const image = {
                id: "scroll-smoke-profile-image",
                profile: true,
                male: false,
                pending: true,
                html: "",
            };
            try {
                const collidingRuntimeCharacter = {
                    id: "scroll-smoke-runtime-character",
                    name,
                    gender: "male",
                    profile_image_id: "",
                    profile_images: [],
                };
                app.state.characters ||= {};
                app.state.characters[name] = collidingRuntimeCharacter;
                app.profileEntityOverrides = {
                    ...(app.profileEntityOverrides || {}),
                    [name]: {
                        id: "scroll-smoke-player-option",
                        name,
                        gender: "female",
                        profile_image_request_key: "story-player:scroll-smoke:option-0:non_male",
                        profile_image_id: image.id,
                        profile_images: [image],
                    },
                };
                app.deferredStoryPlayerSelectProfileRenders = new Map();
                devAssert(
                    profileEntity(name) === app.profileEntityOverrides[name],
                    "player-select profile request keys take precedence over same-name runtime characters",
                    {
                        selectedRequestKey:
                            profileEntity(name)?.profile_image_request_key || "",
                    },
                );
                openModal(
                    `<div class="profile-image-thumb-wrap" data-profile-live-id="${image.id}">${profileImageLoadingHtml()}</div>`,
                    { scrollKey: "smoke:player-select-scroll-image" },
                );
                $("modalBox")?.setAttribute("data-player-select-modal", "1");
                bindStoryPlayerSelectScrollTracking();
                noteStoryPlayerSelectScroll();
                image.pending = false;
                image.html =
                    '<img class="profile-image-thumb" alt="Scroll smoke" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">';
                renderProfileImageDom(name, image);
                devAssert(
                    !$("modalBox")?.querySelector?.("[data-profile-live-id] img") &&
                        app.deferredStoryPlayerSelectProfileRenders?.has?.(image.id),
                    "player-select image completion waits while the player-select modal is scrolling",
                    {
                        deferred: [
                            ...(app.deferredStoryPlayerSelectProfileRenders || new Map()).entries(),
                        ],
                    },
                );
                await devWaitFor(
                    () => !!$("modalBox")?.querySelector?.("[data-profile-live-id] img"),
                    2000,
                    "deferred player-select profile image render after scrolling stops",
                );
                devAssert(
                    !!$("modalBox")?.querySelector?.("[data-profile-live-id] img") &&
                        !app.deferredStoryPlayerSelectProfileRenders?.size,
                    "player-select image completion renders once scrolling has settled",
                );
                devAssert(
                    profileImageOwnerKey(name, app.profileEntityOverrides[name]) ===
                        "story-player:scroll-smoke:option-0:non_male",
                    "player-select profile requests use an immutable option and presentation key",
                    {
                        ownerKey: profileImageOwnerKey(name, app.profileEntityOverrides[name]),
                    },
                );
                addMessage("system", "Player select scroll image smoke test passed.");
                showNotice("Live Test Passed", "Player select scroll image smoke test passed.");
            } finally {
                if (hadCollidingRuntimeCharacter)
                    app.state.characters[name] = savedCollidingRuntimeCharacter;
                else if (app.state.characters?.[name]) delete app.state.characters[name];
                clearTimeout(app.storyPlayerSelectScrollTimer);
                app.storyPlayerSelectScrollTimer = savedTimer;
                app.storyPlayerSelectScrollBusyUntil = savedBusyUntil;
                app.deferredStoryPlayerSelectProfileRenders = savedDeferred;
                app.profileEntityOverrides = savedOverrides;
                closeModal();
            }
        }

        async function devWithDeterministicImagePlugin(scenarioId, run, options = {}) {
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadKeepOverrideFlag = Object.prototype.hasOwnProperty.call(
                globalThis,
                "__emberAdventuresKeepSmokeImagePluginOverride",
            );
            const previousKeepOverrideFlag =
                globalThis.__emberAdventuresKeepSmokeImagePluginOverride;
            const hadOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousOverride = pluginOverrides.textToImagePlugin;
            const deterministicImagePlugin = () => {
                devTestLog("Deterministic image smoke provider used", { scenarioId });
                const completionDelayMs = Number(options.completionDelayMs) || 0;
                return {
                    // The completion path is still production code. This only
                    // replaces the external network result.
                    onFinishPromise: completionDelayMs
                        ? new Promise((resolve) =>
                              setTimeout(
                                  () => resolve({ dataUrl: devSmokeOnePixelDataUrl() }),
                                  completionDelayMs,
                              ),
                          )
                        : Promise.resolve({ dataUrl: devSmokeOnePixelDataUrl() }),
                };
            };
            try {
                // Exercise the normal Perchance result path without making a
                // duplicate live request during the smoke suite.
                globalThis.__emberAdventuresKeepSmokeImagePluginOverride = true;
                pluginOverrides.textToImagePlugin = deterministicImagePlugin;
                devAssert(
                    perchancePlugin("textToImagePlugin") === deterministicImagePlugin,
                    `${scenarioId} uses the deterministic image smoke provider`,
                );
                devTestLog("Deterministic image smoke provider ready", {
                    scenarioId,
                    completion: options.completionDelayMs
                        ? `${options.completionDelayMs}ms delay`
                        : "microtask",
                });
                return await run();
            } finally {
                if (hadOverride) pluginOverrides.textToImagePlugin = previousOverride;
                else delete pluginOverrides.textToImagePlugin;
                if (hadKeepOverrideFlag)
                    globalThis.__emberAdventuresKeepSmokeImagePluginOverride =
                        previousKeepOverrideFlag;
                else delete globalThis.__emberAdventuresKeepSmokeImagePluginOverride;
                devTestLog("Deterministic image smoke provider restored", {
                    scenarioId,
                    restoredOverride: hadOverride,
                });
            }
        }

        async function devRunUiActionLoadingSmokeTest() {
            const fixture = document.createElement("div");
            fixture.id = "uiActionLoadingSmokeFixture";
            fixture.innerHTML = `
                <button type="button" onclick="EmberAdventures.sendUserMessage()">Send</button>
                <button type="button" onclick="EmberAdventures.continueScene()">Continue</button>
                <button type="button" onclick="EmberAdventures.requestManualImage()">Image</button>
                <button type="button" onclick="EmberAdventures.generateImageLabFreeform()">Image Lab</button>
                <button type="button" onclick="EmberAdventures.exportData()">Export</button>
                <button type="button" disabled onclick="EmberAdventures.deleteGameSave('missing')">Delete</button>
            `;
            document.body.appendChild(fixture);
            const originalGameOver = app.state?.meta?.game_over;
            try {
                devAssert(
                    uiActionConfig("uploadStoryTemplate").label === "Importing story" &&
                        uiActionConfig("publishStoryTemplateToPublicIndex").label ===
                            "Publishing story",
                    "story import and public publishing use distinct loading labels",
                );
                const libraryCardActions = [
                    "openStoryLibraryDetail",
                    "openPublicStoryLibraryDetail",
                    "openCharacterLibraryDetail",
                    "openPublicCharacterLibraryDetail",
                ];
                devAssert(
                    libraryCardActions.every(
                        (actionName) =>
                            uiActionConfig(actionName)?.mode === "blocking" &&
                            globalThis.EmberAdventures?.[actionName]
                                ?.__uiActionWrapped === true,
                    ),
                    "local and public story and character card actions use the shared blocking loader",
                    libraryCardActions.map((actionName) => ({
                        actionName,
                        config: uiActionConfig(actionName),
                        wrapped:
                            globalThis.EmberAdventures?.[actionName]
                                ?.__uiActionWrapped === true,
                    })),
                );
                for (const actionName of libraryCardActions) {
                    const blockingCountBefore =
                        app.blockingUiActions.length;
                    const openResult =
                        globalThis.EmberAdventures[actionName](
                            `missing-${actionName}`,
                        );
                    const blockingAction =
                        document.querySelector("[data-ui-blocking-action]");
                    devAssert(
                        !!blockingAction &&
                            !blockingAction
                                .closest(".popup-modal")
                                ?.classList.contains("setup-blackout"),
                        `${actionName} blocks the whole interface immediately after a library card is selected`,
                    );
                    await openResult;
                    devAssert(
                        app.blockingUiActions.length ===
                            blockingCountBefore,
                        `${actionName} removes its blocking loader after the detail action finishes`,
                        {
                            blockingCountBefore,
                            blockingCountAfter:
                                app.blockingUiActions.length,
                        },
                    );
                    closeModal();
                }
                const send = fixture.children[0];
                const continueButton = fixture.children[1];
                const image = fixture.children[2];
                const imageLab = fixture.children[3];
                const exportButton = fixture.children[4];
                const authoredDisabled = fixture.children[5];

                devAssert(
                    uiActionConfig("sendUserMessage") === null &&
                        uiActionConfig("continueScene") === null &&
                        uiActionConfig("submitAiCommandFromModal") === null &&
                        uiActionConfig("rollD20") === null &&
                        uiActionConfig("requestStoryShopChatImage") === null,
                    "queue-producing message and image actions do not use a shared busy lock",
                );
                devAssert(
                    runUiAction("sendUserMessage", () => "queued-one") ===
                        "queued-one" &&
                        runUiAction("sendUserMessage", () => "queued-two") ===
                            "queued-two" &&
                        !send.disabled &&
                        !continueButton.disabled,
                    "message actions remain available so additional turns can enter the queue",
                );

                let finishManualImage = null;
                const manualImageRun = runUiAction(
                    "requestManualImage",
                    () =>
                        new Promise((resolve) => {
                            finishManualImage = resolve;
                        }),
                    {
                        ...uiActionConfig("requestManualImage"),
                        cooldownMs: 30,
                    },
                );
                devAssert(
                    image.disabled &&
                        image.classList.contains("ui-action-loading") &&
                        !send.disabled &&
                        !continueButton.disabled,
                    "manual toolbar image cooldown disables only the manual Image button",
                );
                await new Promise((resolve) => setTimeout(resolve, 45));
                devAssert(
                    !image.disabled &&
                        !image.classList.contains("ui-action-loading"),
                    "manual toolbar image cooldown ends without waiting for image generation",
                );
                finishManualImage?.(true);
                await manualImageRun;

                let finishImageLab = null;
                const imageLabRun = runUiAction(
                    "generateImageLabFreeform",
                    () =>
                        new Promise((resolve) => {
                            finishImageLab = resolve;
                        }),
                );
                await waitForRenderedFrame();
                devAssert(
                    imageLab.disabled &&
                        imageLab.classList.contains("ui-action-loading") &&
                        !image.disabled,
                    "Image Lab generation remains locked until its image request finishes",
                );
                finishImageLab?.(true);
                await imageLabRun;
                devAssert(
                    !imageLab.disabled &&
                        !imageLab.classList.contains("ui-action-loading"),
                    "Image Lab generation unlocks after its image request finishes",
                );

                const disabledToken = beginUiAction(
                    "deleteGameSave",
                    uiActionConfig("deleteGameSave"),
                );
                endUiAction(disabledToken);
                devAssert(
                    authoredDisabled.disabled,
                    "busy-state cleanup preserves a button that was already disabled",
                );

                let finishExport = null;
                const exportRun = runUiAction(
                    "exportData",
                    () =>
                        new Promise((resolve) => {
                            finishExport = resolve;
                        }),
                );
                await waitForRenderedFrame();
                devAssert(
                    exportButton.disabled &&
                        exportButton.classList.contains("ui-action-loading") &&
                        [...app.activityTasks.values()].some(
                            (task) => task.label === "Exporting",
                        ),
                    "button-plus-indicator actions show a button spinner and top-left activity status together",
                );
                finishExport?.(true);
                await exportRun;
                devAssert(
                    !exportButton.disabled &&
                        !exportButton.classList.contains("ui-action-loading") &&
                        ![...app.activityTasks.values()].some(
                            (task) => task.label === "Exporting",
                        ),
                    "button-plus-indicator actions clean up both loading surfaces",
                );

                const blockingToken = beginUiAction(
                    "smokeBlockingAction",
                    { mode: "blocking", label: "Loading game", group: "" },
                );
                devAssert(
                    !!blockingToken?.blockingId &&
                        !!document.querySelector("[data-ui-blocking-action]"),
                    "blocking actions use the shared non-dismissible loading modal",
                );
                endUiAction(blockingToken);
                devAssert(
                    !$("modal")?.classList.contains("open"),
                    "blocking action loading closes after the action finishes",
                );

                app.state.meta ||= {};
                app.state.meta.game_over = true;
                refreshUiBusyButtons();
                devAssert(
                    send.disabled &&
                        continueButton.disabled &&
                        image.disabled,
                    "game-over state disables the reviewed gameplay action group",
                );
            } finally {
                app.state.meta ||= {};
                if (originalGameOver === undefined) delete app.state.meta.game_over;
                else app.state.meta.game_over = originalGameOver;
                for (const token of [...app.uiBusyActions.values()]) endUiAction(token);
                closeModal();
                fixture.remove();
                refreshUiBusyButtons();
            }
        }

        async function devRunBorderlandsPlayerSelectSmokeTest() {
            devTestLog("Scenario start: borderlands-player-select-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const profileImagesSnapshot = clone(
                await loadPerRecordLibrary(
                    PROFILE_IMAGE_KEY,
                    app.profileImages || [],
                ),
            );
            try {
                devResetForLiveTest("borderlands-player-select-smoke");
                devCreateTestProfile({  });
                const template = devSmokePlayerSelectTemplate({
                    id: "smoke-fixture-borderlands-player-select",
                    title: "Smoke Fixture Player Select",
                    optionNames: [
                        "Smoke Vanguard",
                        "Smoke Phasewalker",
                        "Smoke Sharpshooter",
                        "Smoke Heavy",
                    ],
                });
                devUpsertStoryTemplatesForSmoke([template]);
                const options = storyTemplatePlayerOptions(template);
                const expectedNames = [
                    "Smoke Vanguard",
                    "Smoke Phasewalker",
                    "Smoke Sharpshooter",
                    "Smoke Heavy",
                ];
                devAssert(
                    expectedNames.every((name) =>
                        options.some((option) => option.name === name),
                    ),
                    "synthetic player-select story has four playable options",
                    options.map((option) => option.name),
                );
                const optionSeedDiagnostics = expectedNames.map(
                    (name) => {
                        const option = options.find((item) => item.name === name);
                        const character = option?.character || {};
                        return {
                            name,
                            default_seed: character.default_seed ?? null,
                            image_prompt_config_seed:
                                character.image_prompt_config?.seed ?? null,
                            image_seed: character.image?.seed ?? null,
                            resolved_seed: defaultProfileImageSeed(character),
                        };
                    },
                );
                devAssert(
                    optionSeedDiagnostics.every((item) => item.resolved_seed === 0),
                    "synthetic player-select options resolve default profile image seed 0",
                    optionSeedDiagnostics,
                );
                await startStoryTemplate(template.id);
                devAssert(
                    $("modal")?.classList?.contains("open") &&
                        /Choose Your Character/i.test($("modalBox")?.textContent || ""),
                    "starting synthetic player-select story opens character select before gameplay starts",
                    { modalText: $("modalBox")?.textContent || "" },
                );
                devAssert(
                    $("modalBox")?.matches?.("[data-player-select-modal='1']") &&
                        !document.querySelector("[data-story-library-detail-modal='1']"),
                    "synthetic character select replaces the story detail instead of exposing a previous game",
                );
                devAssert(
                    $("modalBox")?.matches?.("[data-player-select-modal='1']"),
                    "synthetic character select uses fullscreen player-select layout",
                );
                devAssert(
                    document.querySelectorAll(
                        "[data-story-player-select-card] .profile-image-thumb-wrap",
                    ).length >= options.length,
                    "synthetic character select renders image areas for every player option",
                );
                const stalePlayerImage = createProfileImageRecord({
                    id: "stale-player-mordecai-profile",
                    character_id: "mordecai-phasewalker",
                    owner_name: "Player",
                    source: "smoke stale player image",
                    html: '<img alt="Stale Mordecai player image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
                    profile: true,
                });
                if (stalePlayerImage) app.profileImages.unshift(stalePlayerImage);
                const selectedName = "Smoke Phasewalker";
                const selectedProfileOverride = Object.entries(
                    app.profileEntityOverrides || {},
                ).find(
                    ([requestName, entity]) =>
                        entity?.name === selectedName &&
                        entity?.profile_image_request_key === requestName,
                );
                const selectedProfileRequestName = selectedProfileOverride?.[0] || "";
                const lilithLiveOption = selectedProfileOverride?.[1];
                devAssert(
                    !!selectedProfileRequestName && !!lilithLiveOption,
                    "synthetic player-select keeps live option entity for selected profile image",
                );
                rememberProfileImage(selectedProfileRequestName, {
                    id: "smoke-phasewalker-live-select-profile",
                    owner_name: selectedProfileRequestName,
                    source: "smoke live player-select image",
                    html: '<img alt="Lilith selected player image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
                    profile: true,
                    male: profileImageMalePresentation(lilithLiveOption),
                });
                const portableTemplate = storyDefinitionForExport(template);
                devTestLog("Synthetic player-select portable metadata", {
                    templateSource: template.source,
                    portableSource: portableTemplate.source,
                    templateCreationTool: template.creation_tool,
                    portableCreationTool: portableTemplate.creation_tool,
                });
                devAssert(
                    portableTemplate.source === "Original" &&
                        portableTemplate.creation_tool === "debug harness",
                    "synthetic player-select story preserves required portable metadata",
                    {
                        templateSource: template.source,
                        portableSource: portableTemplate.source,
                        templateCreationTool: template.creation_tool,
                        portableCreationTool: portableTemplate.creation_tool,
                    },
                );
                const selectedStartResult = await startStoryTemplatePlayerChoice(
                    template.id,
                    selectedName,
                );
                devAssert(
                    app.state?.player?.name === selectedName,
                    `selected synthetic player option becomes runtime player${
                        app.lastStoryStartError
                            ? `: ${app.lastStoryStartError}`
                            : ""
                    }`,
                    {
                        result: selectedStartResult,
                        player: app.state?.player,
                        startError: app.lastStoryStartError || "",
                        activeSaveId: activeSaveId(),
                    },
                );
                devAssert(
                    app.state?.player?.profile_image_id === "smoke-phasewalker-live-select-profile" &&
                        activeProfileImage(app.state.player)?.id === "smoke-phasewalker-live-select-profile",
                    "selected Borderlands player keeps the chosen option profile image instead of a stale Player image",
                    {
                        activeId: app.state?.player?.profile_image_id,
                        activeImage: activeProfileImage(app.state.player),
                        profileImages: app.state?.player?.profile_images,
                    },
                );
                devAssert(
                    !Array.isArray(app.state?.players),
                    "synthetic runtime state does not keep unselected player options",
                    app.state?.players,
                );
                devAssert(
                    !(app.state.scene?.party_members_present || []).some((name) =>
                        expectedNames.includes(name),
                    ),
                    "unselected synthetic player options are not active scene characters at start",
                    app.state.scene?.party_members_present,
                );
                devAcceptPlayerInputHelpIfShown();
                addMessage("system", "Borderlands player select smoke test passed.");
                showNotice(
                    "Live Test Passed",
                    "Borderlands player select smoke test passed.",
                );
                devTestLog("Scenario complete: borderlands-player-select-smoke", {
                    selectedPlayer: app.state?.player?.name,
                    activeProfileImage: activeProfileImage(app.state.player)?.id,
                    options: options.map((option) => option.name),
                });
            } finally {
                await devCleanupSmokeStoryLibraryArtifacts("Borderlands player-select smoke story artifacts cleaned");
                await devRestoreProfileImagesForSmoke(
                    profileImagesSnapshot,
                    "Borderlands player-select smoke profile images restored",
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunRealBorderlandsPlayerSelectImagesSmokeTest() {
            const scenarioId = "real-borderlands-player-select-images-smoke";
            devTestLog(`Scenario start: ${scenarioId}`);
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const expectedNames = [
                "Smoke Image Vanguard",
                "Smoke Image Phasewalker",
                "Smoke Image Sharpshooter",
                "Smoke Image Heavy",
            ];
            let profileRequestNames = [];
            return devWithDeterministicImagePlugin(scenarioId, async () => {
            try {
                devResetForLiveTest(scenarioId);
                devCreateTestProfile({  });
                const template = devSmokePlayerSelectTemplate({
                    id: "smoke-fixture-real-player-select-images",
                    title: "Smoke Fixture Real Player Select Images",
                    optionNames: expectedNames,
                });
                template.state.players = (template.state.players || []).map((player) =>
                    devSmokeCharacterDefinition(player.name, {
                        gender: player.gender,
                        role: player.role,
                        seed: 0,
                        default_profile_image: emptyProfileImageSlot(
                            characterPresentationUsesMaleFields(player.gender),
                        ),
                    }),
                );
                devUpsertStoryTemplatesForSmoke([template]);
                const options = storyTemplatePlayerOptions(template);
                devAssert(
                    expectedNames.every((name) =>
                        options.some((option) => option.name === name),
                    ),
                    "synthetic real-image player-select story has four playable options",
                    options.map((option) => option.name),
                );
                const optionSeedDiagnostics = expectedNames.map((name) => {
                    const option = options.find((item) => item.name === name);
                    const character = option?.character || {};
                    return {
                        name,
                        default_seed: character.default_seed ?? null,
                        image_prompt_config_seed:
                            character.image_prompt_config?.seed ?? null,
                        image_seed: character.image?.seed ?? null,
                        resolved_seed: defaultProfileImageSeed(character),
                    };
                });
                devAssert(
                    optionSeedDiagnostics.every((item) => item.resolved_seed === 0),
                    "synthetic player-select options resolve default profile image seed 0",
                    optionSeedDiagnostics,
                );
                await devClearSmokeProfileImagesForNames(expectedNames);
                await startStoryTemplate(template.id);
                devAssert(
                    $("modal")?.classList?.contains("open") &&
                        $("modalBox")?.matches?.("[data-player-select-modal='1']"),
                    "synthetic real-image player-select story opens player-select modal before gameplay",
                    $("modalBox")?.textContent || "",
                );
                for (const name of expectedNames) {
                    const card = document.querySelector(
                        `[data-story-player-select-card="${cssEscape(name)}"]`,
                    );
                    devAssert(
                        !!card?.querySelector(".profile-image-loading"),
                        `${name} player-select card shows an active loading spinner before completion`,
                        card?.outerHTML || "",
                    );
                }
                const profileRequestNameByDisplayName = Object.fromEntries(
                    expectedNames.map((name) => {
                        const match = Object.entries(
                            app.profileEntityOverrides || {},
                        ).find(
                            ([requestName, entity]) =>
                                entity?.name === name &&
                                entity?.profile_image_request_key === requestName,
                        );
                        return [name, match?.[0] || ""];
                    }),
                );
                profileRequestNames = Object.values(
                    profileRequestNameByDisplayName,
                ).filter(Boolean);
                devAssert(
                    profileRequestNames.length === expectedNames.length,
                    "synthetic player-select retains one presentation-specific profile request identity per option",
                    profileRequestNameByDisplayName,
                );
                const firstName = expectedNames[0];
                const secondName = expectedNames[1];
                const firstRequestName = profileRequestNameByDisplayName[firstName];
                const secondRequestName = profileRequestNameByDisplayName[secondName];
                const firstImage = await devWaitForGeneratedProfileImage(
                    firstRequestName,
                    DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS,
                    `real synthetic player-select ${firstName} profile image generation to finish`,
                );
                const firstCard = document.querySelector(
                    `[data-story-player-select-card="${cssEscape(firstName)}"]`,
                );
                devAssert(
                    !!firstImage &&
                        devLooksLikeRealImageHtml(firstImage.html) &&
                        Number(firstImage.seed) === 0 &&
                        !!firstCard?.querySelector("img.profile-image-thumb, img"),
                    `${firstName} synthetic player-select profile image is finished, stored, displayed, and uses seed 0`,
                    {
                        expectedSeed: 0,
                        actualSeed: firstImage?.seed ?? null,
                        diagnostics: devProfileImageDiagnostics(firstRequestName, firstImage),
                        cardHtml: firstCard?.outerHTML || "",
                    },
                );
                await devWaitFor(
                    () => {
                        const diagnostics = devProfileImageDiagnostics(secondRequestName);
                        return (
                            diagnostics.generating.includes(secondRequestName) ||
                            diagnostics.activeHasHtml
                        );
                    },
                    DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS,
                    `real synthetic player-select ${secondName} profile image generation to start after ${firstName} finishes`,
                );
                const secondDiagnostics = devProfileImageDiagnostics(secondRequestName);
                const secondCard = document.querySelector(
                    `[data-story-player-select-card="${cssEscape(secondName)}"]`,
                );
                devAssert(
                    secondDiagnostics.generating.includes(secondRequestName) ||
                        secondDiagnostics.activeHasHtml,
                    `${secondName} synthetic player-select profile image starts after ${firstName} finishes`,
                    {
                        diagnostics: secondDiagnostics,
                        cardHtml: secondCard?.outerHTML || "",
                    },
                );
                if (secondDiagnostics.activeHasHtml) {
                    const secondImage = activeProfileImage(
                        profileEntity(secondRequestName),
                    );
                    devAssert(
                        Number(secondImage?.seed) === 0,
                        `${secondName} player-select profile image uses seed 0 if it finishes before the start assertion`,
                        {
                            expectedSeed: 0,
                            actualSeed: secondImage?.seed ?? null,
                            diagnostics: secondDiagnostics,
                        },
                    );
                }
                devTestLog(`Scenario complete: ${scenarioId}`, {
                    generated: expectedNames.map((name) => ({
                        name,
                        requestName: profileRequestNameByDisplayName[name],
                        diagnostics: devProfileImageDiagnostics(
                            profileRequestNameByDisplayName[name],
                        ),
                    })),
                });
            } finally {
                await devClearSmokeProfileImagesForNames([
                    ...expectedNames,
                    ...profileRequestNames,
                ]);
                await devCleanupSmokeStoryLibraryArtifacts("real Borderlands player-select smoke story artifacts cleaned");
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
            }, { completionDelayMs: 1000 });
        }

        function devMakeSavedGameState(title, key) {
            // SANITIZE KEEP (dev fixture): synthetic saved-game state builder for tests.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            return repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title,
                    },
                },
                player: devSmokeRuntimeCharacter(`${title} Player`, {
                    age: 24,
                    gender: "female",
                    role: "save tester",
                }),
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: `${title} scene summary`,
                    objective: `${title} objective`,
                    party_members_present: [],
                    image_characters: ["Player"],
                },
                objectives: {
                    active_id: `${key}-objective`,
                    focus_id: `${key}-objective`,
                    items: [
                        devSmokeObjective(`${key}-objective`, `${title} Objective`, {
                            status: "active",
                            summary: `${title} objective summary`,
                            ending_type: "freeplay",
                            ending_message: `${title} continues in freeplay.`,
                        }),
                    ],
                },

            });
        }

        async function devRunSavedGamesRestoreUiTest() {
            devTestLog("Scenario start: saved-games-restore-ui");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            try {
                devResetForLiveTest("saved-games-restore-ui");
                devCreateTestProfile({  });
                app.images = [];
                app.profileImages = [];
                setActiveSaveId("");
                await persistActiveSavePointer();

                const originalFetchForStaleProfile = globalThis.fetch;
                let releaseStaleProfileFetch = null;
                let markStaleProfileFetchStarted = null;
                const staleProfileFetchStarted = new Promise((resolve) => {
                    markStaleProfileFetchStarted = resolve;
                });
                try {
                    app.state.player = devSmokeRuntimeCharacter("Stale Profile Fetch", {
                        gender: "female",
                    });
                    globalThis.fetch = () => {
                        markStaleProfileFetchStarted();
                        return new Promise((resolve) => {
                            releaseStaleProfileFetch = resolve;
                        });
                    };
                    const staleProfileRequest = copyDefaultProfileImageIfAvailable(
                        "Player",
                        "stale profile ownership smoke",
                    );
                    await staleProfileFetchStarted;
                    app.state.player = devSmokeRuntimeCharacter("Current Profile Owner", {
                        gender: "female",
                    });
                    releaseStaleProfileFetch({ ok: false, status: 404 });
                    const staleProfileResult = await staleProfileRequest;
                    devAssert(
                        staleProfileResult === false &&
                            !(app.profileImages || []).some(
                                (image) => image.owner_name === "Stale Profile Fetch",
                            ) &&
                            !/Default profile hosted image fallback/i.test(
                                $("modalBox")?.textContent || "",
                            ),
                        "stale default-profile fetches stop after their character context is replaced",
                    );
                } finally {
                    globalThis.fetch = originalFetchForStaleProfile;
                }

            app.state = devMakeSavedGameState("Save A", "live-save-a");
            devTestLog("Save A player relationship fixture", {
                trust: app.state.player?.trust,
                startingTrust: app.state.player?.starting_trust,
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Save A opening.",
                    at: new Date().toISOString(),
                },
            ];
            await createNewActiveSave("live test save A", {
                state: app.state,
                messages: app.messages,
            });
            const saveAId = app.currentGameSaveId;
            devAssert(!!saveAId, "Save A current id exists after save");
            snapshotState("Save A persisted load smoke snapshot", {
                id: "save-a-load-smoke-snapshot",
            });

            await flushRuntimeSaveProjections();
            await app.persistence.closeActiveSave();
            app.saveSessionActive = false;
            app.saveSessionContext = null;
            cancelSaveProjectionFlush();
            setActiveSaveId("");
            app.state = devMakeSavedGameState("Save B", "live-save-b");
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Save B opening.",
                    at: new Date().toISOString(),
                },
            ];
            await createNewActiveSave("live test save B", {
                state: app.state,
                messages: app.messages,
            });
            const saveBId = app.currentGameSaveId;
            devAssert(!!saveBId && saveBId !== saveAId, "Save B is distinct from Save A", {
                saveAId,
                saveBId,
            });
            snapshotState("Save B persisted load smoke snapshot", {
                id: "save-b-load-smoke-snapshot",
            });
            await flushRuntimeSaveProjections();
            const currentSaveRecords = saveIndexRecords();
            const smokeCreatedSaveIds = devSmokeAddedRecordIds(
                currentSaveRecords,
                saveSnapshot.saveIndex || [],
                (save) => save?.saveId,
            );
            devAssert(
                smokeCreatedSaveIds.length === 2 &&
                    smokeCreatedSaveIds.includes(saveAId) &&
                    smokeCreatedSaveIds.includes(saveBId),
                "smoke creates exactly two isolated saved games",
                {
                    baselineSaveIds: (saveSnapshot.saveIndex || []).map(
                        (save) => save?.saveId,
                    ),
                    smokeCreatedSaveIds,
                    saves: currentSaveRecords.map((save) => ({
                    id: save.saveId,
                    })),
                },
            );

            openGameSavesModal();
            devAssert(
                /Saved Games/i.test($("modalBox")?.textContent || "") &&
                    $("modalBox")?.matches?.("[data-fullscreen-list-modal='1']") &&
                    !!$("modalBox")?.querySelector(".saved-games-grid") &&
                    !!$("modalBox")?.querySelector("[data-saved-game-card]") &&
                    /Date Created:/i.test($("modalBox")?.textContent || "") &&
                    /Last Played:/i.test($("modalBox")?.textContent || ""),
                "saved games modal opens fullscreen with standard grid cards and separate date labels",
            );
            devAssert(
                !![...$("modalBox").querySelectorAll("button")].find(
                    (button) => /^Import Save$/i.test(button.textContent || ""),
                ) &&
                    [...$("modalBox").querySelectorAll("[data-saved-game-card]")].every(
                        (card) =>
                            !![...card.querySelectorAll("button")].find(
                                (button) => /^Export$/i.test(button.textContent || ""),
                            ),
                    ),
                "Saved Games has one import control and every save card has an export control",
            );
            const normalCurrentCard = [...$("modalBox").querySelectorAll("[data-saved-game-card]")].find(
                (card) => /Save B/.test(card.textContent || "") && /Current/.test(card.textContent || ""),
            );
            const normalCurrentDeleteButton = [...(normalCurrentCard?.querySelectorAll("button") || [])].find(
                (button) => /Delete/i.test(button.textContent || ""),
            );
            devAssert(
                !!normalCurrentDeleteButton?.disabled,
                "normal Saved Games modal cannot delete the current game",
                { currentCardText: normalCurrentCard?.textContent || "" },
            );
            openGameSavesModal({ allowDeleteCurrent: true });
            const revisitCurrentCard = [...$("modalBox").querySelectorAll("[data-saved-game-card]")].find(
                (card) => /Save B/.test(card.textContent || "") && /Current/.test(card.textContent || ""),
            );
            const revisitCurrentDeleteButton = [...(revisitCurrentCard?.querySelectorAll("button") || [])].find(
                (button) => /Delete/i.test(button.textContent || ""),
            );
            devAssert(
                !!revisitCurrentDeleteButton && !revisitCurrentDeleteButton.disabled,
                "Load Adventure Saved Games modal can delete the current game",
                { currentCardText: revisitCurrentCard?.textContent || "" },
            );
            devAssert(
                revisitCurrentCard?.classList.contains("current-adventure-card") &&
                    /Current Adventure/i.test(revisitCurrentCard?.textContent || ""),
                "Revisit delete-current row is visually marked as Current Adventure",
                {
                    className: revisitCurrentCard?.className || "",
                    currentCardText: revisitCurrentCard?.textContent || "",
                },
            );
            revisitCurrentDeleteButton.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const deletePopupBox = [
                ...document.querySelectorAll(".popup-modal .modal-box"),
            ].at(-1);
            devAssert(
                /WARNING: You are deleting your Current Adventure/i.test(
                    deletePopupBox?.textContent || "",
                ),
                "current adventure delete confirmation shows a red warning",
                { popupText: deletePopupBox?.textContent || "" },
            );
            const cancelDelete = [...(deletePopupBox?.querySelectorAll("button") || [])].find(
                (button) => /Cancel/i.test(button.textContent || ""),
            );
            devAssert(!!cancelDelete, "current adventure delete confirmation has Cancel button");
            cancelDelete.click();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const currentRestoreButton = [...revisitCurrentCard.querySelectorAll("button")].find(
                (button) => /Restore Game/i.test(button.textContent || ""),
            );
            devAssert(
                !!currentRestoreButton && !currentRestoreButton.disabled,
                "Load Adventure allows the current adventure to be loaded",
            );
            currentRestoreButton.click();
            await devWaitFor(
                () =>
                    [...document.querySelectorAll(".popup-modal .modal-box")].some(
                        (box) => /Restore Saved Game/i.test(box.textContent || ""),
                    ),
                5000,
                "current Save B restore confirmation",
            );
            const currentRestorePopup = [
                ...document.querySelectorAll(".popup-modal .modal-box"),
            ].find((box) => /Restore Saved Game/i.test(box.textContent || ""));
            const confirmCurrentRestore = [
                ...(currentRestorePopup?.querySelectorAll("button") || []),
            ].find((button) => /^Restore$/i.test(button.textContent || ""));
            devAssert(
                !!confirmCurrentRestore,
                "current adventure restore confirmation has Restore button",
            );
            confirmCurrentRestore.click();
            await devWaitFor(
                () =>
                    app.currentGameSaveId === saveBId &&
                    app.state?.meta?.story_source?.title === "Save B" &&
                    (app.snapshots || []).some(
                        (snapshot) => snapshot.id === "save-b-load-smoke-snapshot",
                    ),
                10000,
                "current Save B and its persisted snapshot to load",
            );
            devAssert(
                app.currentGameSaveId === saveBId &&
                    app.state?.meta?.story_source?.title === "Save B",
                "Load Adventure restores the current adventure with persisted snapshots",
            );
            openGameSavesModal({ allowDeleteCurrent: true });
            const saveACard = [...$("modalBox").querySelectorAll("[data-saved-game-card]")].find(
                (card) => /Save A/.test(card.textContent || ""),
            );
            devAssert(!!saveACard, "Save A appears in saved games modal");
            const restoreAButton = [...saveACard.querySelectorAll("button")].find(
                (button) => /Restore Game/i.test(button.textContent || ""),
            );
            devAssert(!!restoreAButton && !restoreAButton.disabled, "Save A has enabled Restore Game button");
            restoreAButton.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const popupBox = [
                ...document.querySelectorAll(".popup-modal .modal-box"),
            ].find((box) => /Restore Saved Game/i.test(box.textContent || ""));
            devAssert(
                /Restore Saved Game/i.test(popupBox?.textContent || ""),
                "restore confirmation modal is visible",
                { modalText: (popupBox?.textContent || "").slice(0, 200) },
            );
            const confirmRestore = [...popupBox.querySelectorAll("button")].find(
                (button) => /^Restore$/i.test(button.textContent || ""),
            );
            devAssert(!!confirmRestore, "restore confirmation has Restore button");
            confirmRestore.click();
            await devWaitFor(
                () =>
                    app.state?.meta?.story_source?.title === "Save A" &&
                    (app.snapshots || []).some(
                        (snapshot) => snapshot.id === "save-a-load-smoke-snapshot",
                    ),
                10000,
                "Save A state and persisted snapshot to be restored",
            );
            devAssert(
                app.currentGameSaveId === saveAId,
                "restored Save A becomes current game save",
                { currentGameSaveId: app.currentGameSaveId, saveAId },
            );
            devAssert(
                (app.messages || []).some((message) => /Save A opening/i.test(message.text || "")),
                "restored Save A messages loaded",
                { messages: app.messages },
            );
            devAssert(
                (app.snapshots || []).some(
                    (snapshot) => snapshot.id === "save-a-load-smoke-snapshot",
                ),
                "restored Save A snapshots loaded without requiring legacy embedded runtime data",
                { snapshots: app.snapshots },
            );
            devAssert(
                (app.state.objectives?.items || []).every(
                    (objective) =>
                        !("objective" in objective) &&
                        !Array.isArray(objective.steps) &&
                        !("selected_step" in objective),
                ),
                "restored saved games contain only canonical objective fields",
                app.state.objectives,
            );
            devAssert(
                !!ensureCurrentLocationLabel(app.state),
                "restored saved games hydrate a safe current location label",
                {
                    location: app.state.location,
                    world_map: app.state.world_map,
                },
            );
            cancelActiveStateWork("saved games restore smoke complete");
            app.aiQueue = [];
            addMessage("system", "Saved games restore smoke test passed.");
            scheduleActiveGameSave();
            render();
                devTestLog("Scenario complete: saved-games-restore-ui", {
                    currentGameSaveId: app.currentGameSaveId,
                    saves: saveIndexRecords().map((save) => ({
                        id: save.saveId,
                    })),
                });
            } finally {
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunStateConflictGuardTest() {
            devTestLog("Scenario start: state-conflict-guard");
            devResetForLiveTest("state-conflict-guard");
            // SANITIZE KEEP (dev fixture): synthetic conflict-guard state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            const baseState = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                },
                player: {
                    ...devSmokeRuntimeCharacter("Image Viewer Tester", {
                        gender: "non-male",
                        role: "portrait reviewer",
                    }),
                    name: "Guard Tester",
                    age: 24,
                    gender: "non-male",
                    role: "state tester",
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "test-room",
                    specific_place: "Test Room",
                },
                characters: {
                    "Alice Vale": devSmokeRuntimeCharacter("Alice Vale", {
                        age: 25,
                        gender: "non-male",
                        role: "test character",
                    }),
                    "Bob Reed": devSmokeRuntimeCharacter("Bob Reed", {
                        age: 31,
                        gender: "male",
                        role: "second test character",
                    }),
                },
                npc_directory: {
                    locations: {
                        "test-room": {
                            label: "Test Room",
                            characters: {
                                "Omar Vale": {
                                    name: "Omar Vale",
                                    gender: "male",
                                    age: 30,
                                    role: "test npc",
                                    relationship: "neutral",
                                    note: "Existing nearby NPC used for conflict guard testing.",
                                    inspected: false,
                                },
                                "Nova Pike": {
                                    name: "Nova Pike",
                                    gender: "non-male",
                                    age: 28,
                                    role: "new test npc",
                                    relationship: "neutral",
                                    note: "Valid nearby NPC used for conflict guard testing.",
                                    inspected: false,
                                },
                            },
                        },
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "base summary",
                    image_action: "base image action",
                    party_members_present: ["Player", "Alice Vale"],
                    image_characters: ["Player", "Alice Vale"],
                    npcs_present: ["Omar Vale"],
                },
            });
            const currentState = clone(baseState);
            currentState.scene.summary = "manual summary";
            currentState.scene.party_members_present = ["Player"];
            currentState.scene.image_characters = ["Player"];
            currentState.scene.npcs_present = [];
            currentState.player.role = "manual role";
            const patch = {
                scene: {
                    summary: "automatic stale summary",
                    image_action: "automatic fresh image action",
                    party_members_present: ["Player", "Alice Vale", "Bob Reed"],
                    image_characters: ["Player", "Alice Vale", "Bob Reed"],
                    npcs_present: ["Omar Vale", "Nova Pike"],
                },
                player: {
                    role: "automatic stale role",
                    known_facts: ["fresh fact"],
                },
            };
            const patched = applyStatePatch(baseState, patch, {
                currentState,
                source: "live test state conflict guard",
            });
            devAssert(
                patched.scene.summary === "manual summary",
                "stale scalar scene patch does not overwrite manual scene summary",
                patched.scene,
            );
            devAssert(
                patched.scene.image_action === "automatic fresh image action",
                "fresh scalar scene patch applies when current still matches base",
                patched.scene,
            );
            devAssert(
                JSON.stringify(patched.scene.party_members_present) ===
                    JSON.stringify(["Bob Reed"]),
                "scene active list preserves manual removals and accepts new automatic additions",
                patched.scene.party_members_present,
            );
            devAssert(
                JSON.stringify(patched.scene.image_characters) ===
                    JSON.stringify(["Player", "Bob Reed"]),
                "scene image list preserves manual removals and accepts new automatic additions",
                patched.scene.image_characters,
            );
            devAssert(
                JSON.stringify(patched.scene.npcs_present) ===
                    JSON.stringify(["Nova Pike"]),
                `nearby list preserves manual removals and accepts new automatic nearby entries; actual=${JSON.stringify(patched.scene.npcs_present)}`,
                patched.scene.npcs_present,
            );
            devAssert(
                patched.player.role === "manual role",
                "stale player scalar patch does not overwrite manual player edit",
                patched.player,
            );
            devAssert(
                Array.isArray(patched.player.known_facts) &&
                    patched.player.known_facts.includes("fresh fact"),
                "fresh player list patch applies when current still matches base",
                patched.player,
            );
            // SANITIZE KEEP (dev fixture): synthetic patched state is normalized before finishing the smoke test.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState(patched);
            addMessage(
                "system",
                "State conflict guard test passed: stale automatic state changes were skipped.",
            );
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: state-conflict-guard", {
                scene: app.state.scene,
                player: app.state.player,
            });
        }

        function devMakeSceneControlState() {
            const state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {...clone(defaultState.meta), setup_complete:true, story_source:{mode:"original",title:"Smoke Controls Scene"}},
                player: devSmokeRuntimeCharacter("Player", {gender:"female",role:"Smoke visibility tester"}),
                location: {...clone(defaultState.location), npc_location_id:"smoke-controls",specific_place:"Smoke Courtyard"},
                npc_directory: {locations:{"smoke-controls":{label:"Smoke Courtyard",characters:{}}}},
                scene: {...clone(defaultState.scene),summary:"A quiet courtyard for testing controls.",party_members_present:["Player"],image_characters:["Player"],npcs_present:[]},
                objectives: {active_id:"smoke-controls",focus_id:"smoke-controls",items:[devSmokeObjective("smoke-controls","Check the controls",{status:"active"})]},
            });
            for (const image of [state.player.default_profile_image,...Object.values(state.player.profile_image_presentations)]) {
                image.url = devSmokeOnePixelDataUrl();
            }
            return state;
        }



        async function devRunToolbarModalsSmokeTest() {
            devTestLog("Scenario start: toolbar-modals-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const originalMainMenuExplicitlyOpened = app.mainMenuExplicitlyOpened;
            const waitForMenuReady = async (label) => {
                await devWaitFor(
                    () =>
                        app.mainMenuAssetsPreloaded === true &&
                        mainMenuAssetsReadyForPaint() &&
                        !$("mainMenu")?.querySelector(".main-menu-loading"),
                    10000,
                    label,
                );
            };
            try {
                devResetForLiveTest("toolbar-modals-smoke");
                devCreateTestProfile({  });
                setSaveIndexRecords([]);
                setActiveSaveId("");
                app.state = devMakeSceneControlState({  });
                app.mainMenuOpen = true;
                app.mainMenuExplicitlyOpened = true;
                renderMainMenu();
                await waitForMenuReady("toolbar smoke initial main menu preload");
                const directMenuGateBegin = [...$("mainMenu")?.querySelectorAll("button") || []].find(
                    (button) => /^Begin Adventure$/i.test(button.textContent || ""),
                );
                if (directMenuGateBegin) {
                    directMenuGateBegin.click();
                    await waitForMenuReady("toolbar smoke initial begin gate");
                    openMainMenu();
                    await waitForMenuReady("toolbar smoke explicit main menu");
                }
                const emptyMenuActions = [...document.querySelectorAll("#mainMenu .main-menu-action")];
                const emptyContinueButton = emptyMenuActions.find((button) =>
                    /Continue Adventure/i.test(button.textContent || ""),
                );
                const emptyLoadButton = emptyMenuActions.find((button) =>
                    /Load Adventure/i.test(button.textContent || ""),
                );
                const emptyBeginButton = emptyMenuActions.find((button) =>
                    /Begin New Adventure/i.test(button.textContent || ""),
                );
                devAssert(
                    !!emptyBeginButton?.classList?.contains("pulse-no-saves"),
                    "main menu gives Begin New Adventure a pulsing glow when no saved games exist",
                    emptyBeginButton?.className || "",
                );
                devAssert(
                    !!emptyContinueButton?.disabled && !!emptyLoadButton?.disabled,
                    "main menu disables Continue and Load when no saved games exist",
                    {
                        continueDisabled: emptyContinueButton?.disabled,
                        loadDisabled: emptyLoadButton?.disabled,
                    },
                );
                const sameButtonWidth = (a, b) => {
                    const ra = a?.getBoundingClientRect?.();
                    const rb = b?.getBoundingClientRect?.();
                    return (
                        !!ra &&
                        !!rb &&
                        Math.round(ra.width) === Math.round(rb.width)
                    );
                };
                const plainRect = (el) => {
                    const rect = el?.getBoundingClientRect?.();
                    return rect
                        ? {
                              width: Math.round(rect.width),
                              height: Math.round(rect.height),
                          }
                        : null;
                };
                devAssert(
                    sameButtonWidth(emptyContinueButton, emptyBeginButton) &&
                        sameButtonWidth(emptyLoadButton, emptyBeginButton),
                    "main menu art buttons keep the same width and scale factor when disabled",
                    {
                        continueRect: plainRect(emptyContinueButton),
                        loadRect: plainRect(emptyLoadButton),
                        beginRect: plainRect(emptyBeginButton),
                    },
                );
                const continueSaveId = "741";
                setSaveIndexRecords([
                    {
                        saveId: continueSaveId,
                        name: "Continue Button Smoke",
                        storyTitle: "Continue Button Smoke",
                        playerName: "Smoke Player",
                        createdAt: "2026-01-01T00:00:00.000Z",
                        updatedAt: "2026-01-02T00:00:00.000Z",
                        reason: "saved game",
                        titleImageHtml: "",
                        titleImageAlt: "Continue Button Smoke",
                        messageCount: 1,
                        imageCount: 0,
                        profileImageCount: 0,
                        snapshotCount: 1,
                        smokeTestRuntime: true,
                    },
                ]);
                renderMainMenu();
                const savedContinueButton = [
                    ...document.querySelectorAll("#mainMenu .main-menu-action"),
                ].find((button) => /Continue Adventure/i.test(button.textContent || ""));
                devAssert(
                    savedContinueButton?.getAttribute("onclick") ===
                        `EmberAdventures.restoreGameSave("${continueSaveId}", {skipRestoreConfirm:true})`,
                    "main menu Continue passes the normalized saveId to restoreGameSave without a restore confirmation",
                    savedContinueButton?.getAttribute("onclick") || "",
                );
                setSaveIndexRecords([]);
                app.state = devMakeSceneControlState({  });
                app.messages = [
                    {
                        id: nextEntryId(),
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Toolbar modal smoke test ready.",
                        at: new Date().toISOString(),
                    },
                ];
                scheduleActiveGameSave();
                render();
                const menuButton = $("mainMenuBtn");
                devAssert(!!menuButton, "Main Menu topbar button exists");
                menuButton.click();
                await waitForMenuReady("toolbar smoke topbar main menu preload");
                devAssert(
                    !$("mainMenu")?.classList.contains("hidden"),
                    "Main Menu topbar button opens the main menu",
                );
                const menuGateBegin = [...$("mainMenu")?.querySelectorAll("button") || []].find(
                    (button) => /^Begin Adventure$/i.test(button.textContent || ""),
                );
                if (menuGateBegin) {
                    menuGateBegin.click();
                    await waitForMenuReady("toolbar smoke begin gate");
                }
                devAssert(
                    $("mainMenu")?.classList.contains("main-menu-art") &&
                        !!document.querySelector("#mainMenu .main-menu-bg") &&
                        !!document.querySelector("#mainMenu .main-menu-content-scroll") &&
                        !!document.querySelector("#mainMenu .main-menu-content") &&
                        !!document.querySelector("#mainMenu .main-menu-logo") &&
                        document.querySelectorAll("#mainMenu .main-menu-action").length === 5 &&
                        !!document.querySelector("#mainMenu .main-menu-bottom-bar img"),
                    "redesigned main menu renders background, logo, five image buttons, and bottom art bar",
                    {
                        actionCount:
                            document.querySelectorAll("#mainMenu .main-menu-action")
                                .length,
                    },
                );
                devAssert(
                    document
                        .querySelector("#mainMenu .main-menu-bg")
                        ?.getAttribute("src") ===
                        menuAssetUrl(MAIN_MENU_BACKGROUND_ASSET) &&
                        document
                            .querySelector("#mainMenu .main-menu-logo")
                            ?.getAttribute("src") === menuAssetUrl(MAIN_MENU_LOGO_ASSET),
                        "main menu uses configured background and logo assets",
                );
                const mainMenuCssText = [...document.styleSheets]
                    .flatMap((sheet) => {
                        try {
                            return [...(sheet.cssRules || [])].map(
                                (rule) => rule.cssText || "",
                            );
                        } catch {
                            return [];
                        }
                    })
                    .join("\n");
                devAssert(
                    !/max-aspect-ratio:\s*10\s*\/\s*13/i.test(mainMenuCssText),
                    "main menu no longer uses the ultra-narrow breakpoint that pushed action buttons right",
                );
                devAssert(
                    !!document.querySelector(
                        '#mainMenu button.discord-button[onclick="EmberAdventures.openDiscord()"]',
                    ),
                    "main menu includes the EmberAdventures Discord link",
                );
                devAssert(
                    !!document.querySelector(
                        '#mainMenu .main-menu-bottom-hit.settings[onclick="EmberAdventures.openSettingsModal()"]',
                    ) &&
                        !!document.querySelector(
                            '#mainMenu .main-menu-bottom-hit.tools[onclick="EmberAdventures.openMainMenuDataToolsModal()"]',
                        ) &&
                        !!document.querySelector(
                            '#mainMenu .main-menu-bottom-hit.notes[onclick="EmberAdventures.openBetaNotesModal()"]',
                        ) &&
                        !!document.querySelector(
                            '#mainMenu .main-menu-bottom-hit.discord[onclick="EmberAdventures.openDiscord()"]',
                    ),
                    "main menu bottom bar exposes Settings, Tools, Version Notes, and Discord hit areas",
                );
                const publicAccountButton = document.querySelector(
                    '#mainMenu .main-menu-account-button[onclick="EmberAdventures.openPublicLibraryAccountModal()"]',
                );
                devAssert(
                    !!publicAccountButton,
                    "main menu exposes Google Account as a circular profile button",
                );
                publicAccountButton.click();
                await devWaitFor(
                    () =>
                        $("modalBox")?.querySelector(".modal-chrome-title")?.textContent?.trim() ===
                        "Google Account",
                    2000,
                    "Google Account modal",
                );
                const accountModalText = $("modalBox")?.textContent || "";
                devAssert(
                    $("modalBox")?.querySelector(".modal-chrome-title")?.textContent?.trim() ===
                        "Google Account" &&
                        !$("modalBox")?.querySelector("h2") &&
                        (
                            /Signing in is only required to publish characters and stories/i.test(accountModalText) ||
                            /Google account connected/i.test(accountModalText)
                        ) &&
                        !/Refresh Session/i.test(accountModalText),
                    "main menu Google Account button opens the standard account modal",
                    accountModalText,
                );
                closeModal();
                const dataToolsButton = document.querySelector(
                    '#mainMenu .main-menu-bottom-hit.tools[onclick="EmberAdventures.openMainMenuDataToolsModal()"]',
                );
                devAssert(!!dataToolsButton, "main menu groups import/export behind bottom-bar Tools");
                dataToolsButton.click();
                devAssert(
                        $("modalBox")?.querySelector(".modal-chrome-title")?.textContent?.trim() === "Tools" &&
                        !$("modalBox")?.querySelector("h2") &&
                        /Profiles/i.test($("modalBox")?.textContent || "") &&
                        !/Google Account/i.test($("modalBox")?.textContent || "") &&
                        /Import Data/i.test($("modalBox")?.textContent || "") &&
                        /Export Data/i.test($("modalBox")?.textContent || "") &&
                        /Delete DB/i.test($("modalBox")?.textContent || "") &&
                        !/Backup Now/i.test($("modalBox")?.textContent || "") &&
                        !/Quick Start/i.test($("modalBox")?.textContent || "") &&
                    ![...($("modalBox")?.querySelectorAll("button") || [])].some((button) =>
                        /^(?:Public Library|Version Notes|Saved Games|Public Index|Upload Test)$/i.test(button.textContent.trim()),
                    ),
                    "Tools button opens profiles/import/export modal without account or obsolete topbar entries",
                );
                devAssert(
                    [...($("modalBox")?.querySelectorAll(".grid.two button") || [])].every(
                        (button) => !!button.querySelector(".tool-icon"),
                    ),
                    "Tools modal actions include text icons for faster scanning",
                );
                closeModal();
                closeMainMenuToGame();
                await new Promise((resolve) => setTimeout(resolve, 100));
                app.mobileDrawer = "";
                updateMobileDrawerState();
                devAssert(
                    !!$("mobileLeftDrawerBtn") &&
                        !!$("mobileRightDrawerBtn") &&
                        !!$("mobileDrawerBackdrop") &&
                        $("mobileLeftDrawerBtn")?.classList.contains("drawer-edge-tab") &&
                        $("mobileRightDrawerBtn")?.classList.contains("drawer-edge-tab") &&
                        !document.querySelector(".topbar #mobileLeftDrawerBtn") &&
                        !document.querySelector(".topbar #mobileRightDrawerBtn"),
                    "mobile drawer controls exist as side tabs outside the top bar",
                );
                devAssert(
                    $("mobileLeftDrawerBtn")?.querySelector(".drawer-tab-text")?.textContent.trim() ===
                        `${String.fromCharCode(9776)} Info` &&
                        $("mobileRightDrawerBtn")?.querySelector(".drawer-tab-text")?.textContent.trim() ===
                            `${String.fromCodePoint(128247)} Images`,
                    "mobile drawer controls use single no-wrap icon and label text",
                );
                openMobileDrawer("left");
                devAssert(
                    $("app")?.classList.contains("mobile-left-drawer-open") &&
                        !$("app")?.classList.contains("mobile-right-drawer-open"),
                    "mobile left drawer opens without opening the right drawer",
                    $("app")?.className || "",
                );
                openMobileDrawer("right");
                devAssert(
                    $("app")?.classList.contains("mobile-right-drawer-open") &&
                        !$("app")?.classList.contains("mobile-left-drawer-open"),
                    "opening Images drawer closes the Info drawer",
                    $("app")?.className || "",
                );
                openMobileDrawer("left");
                devAssert(
                    $("app")?.classList.contains("mobile-left-drawer-open") &&
                        !$("app")?.classList.contains("mobile-right-drawer-open"),
                    "opening Info drawer closes the Images drawer",
                    $("app")?.className || "",
                );
                openMobileDrawer("left");
                devAssert(
                    !$("app")?.classList.contains("mobile-left-drawer-open") &&
                        !$("app")?.classList.contains("mobile-right-drawer-open"),
                    "Info drawer button toggles the left drawer closed",
                    $("app")?.className || "",
                );
                openMobileDrawer("right");
                devAssert(
                    $("app")?.classList.contains("mobile-right-drawer-open") &&
                        !$("app")?.classList.contains("mobile-left-drawer-open"),
                    "mobile right drawer opens without opening the left drawer",
                    $("app")?.className || "",
                );
                openMobileDrawer("right");
                devAssert(
                    !$("app")?.classList.contains("mobile-left-drawer-open") &&
                        !$("app")?.classList.contains("mobile-right-drawer-open"),
                    "Images drawer button toggles the right drawer closed",
                    $("app")?.className || "",
                );
                closeMobileDrawer();
                devAssert(
                    !$("app")?.classList.contains("mobile-left-drawer-open") &&
                        !$("app")?.classList.contains("mobile-right-drawer-open"),
                    "mobile drawer close clears drawer classes",
                    $("app")?.className || "",
                );
                const realMatchMediaOverride = app.devMatchMediaOverride;
                try {
                    app.devMatchMediaOverride = (query) => ({
                        matches: /\(max-width:\s*(1020|1280)px\)/.test(String(query || "")),
                        media: String(query || ""),
                        addEventListener() {},
                        removeEventListener() {},
                    });
                    closeMobileDrawer();
                    handleMobileDrawerSwipe("left");
                    devAssert(
                        $("app")?.classList.contains("mobile-right-drawer-open") &&
                            !$("app")?.classList.contains("mobile-left-drawer-open"),
                        "swipe left opens Images drawer when no drawer is open",
                        $("app")?.className || "",
                    );
                    handleMobileDrawerSwipe("left");
                    devAssert(
                        $("app")?.classList.contains("mobile-right-drawer-open") &&
                            !$("app")?.classList.contains("mobile-left-drawer-open"),
                        "swipe left does nothing while Images drawer is already open",
                        $("app")?.className || "",
                    );
                    handleMobileDrawerSwipe("right");
                    devAssert(
                        !$("app")?.classList.contains("mobile-left-drawer-open") &&
                            !$("app")?.classList.contains("mobile-right-drawer-open"),
                        "swipe right closes Images drawer without opening Info drawer",
                        $("app")?.className || "",
                    );
                    handleMobileDrawerSwipe("right");
                    devAssert(
                        $("app")?.classList.contains("mobile-left-drawer-open") &&
                            !$("app")?.classList.contains("mobile-right-drawer-open"),
                        "swipe right opens Info drawer when no drawer is open",
                        $("app")?.className || "",
                    );
                    devAssert(
                        Number(getComputedStyle($("mobileLeftDrawerBtn")).zIndex || 0) >
                            Number(getComputedStyle($("mobileRightDrawerBtn")).zIndex || 0),
                        "open Info drawer handle is stacked above the closed Images drawer handle",
                        {
                            infoZ: getComputedStyle($("mobileLeftDrawerBtn")).zIndex,
                            imagesZ: getComputedStyle($("mobileRightDrawerBtn")).zIndex,
                        },
                    );
                    handleMobileDrawerSwipe("right");
                    devAssert(
                        $("app")?.classList.contains("mobile-left-drawer-open") &&
                            !$("app")?.classList.contains("mobile-right-drawer-open"),
                        "swipe right does nothing while Info drawer is already open",
                        $("app")?.className || "",
                    );
                    handleMobileDrawerSwipe("left");
                    devAssert(
                        !$("app")?.classList.contains("mobile-left-drawer-open") &&
                            !$("app")?.classList.contains("mobile-right-drawer-open"),
                        "swipe left closes Info drawer without opening Images drawer",
                        $("app")?.className || "",
                    );
                    if (typeof root.PointerEvent === "function") {
                        const swipeSourceButtons = [
                            ...document.querySelectorAll(
                                "#quickActions button, #sendBtn, #imageBtn",
                            ),
                        ];
                        const swipeLeftSource =
                            swipeSourceButtons.find((button) =>
                                /\bContinue\b/i.test(
                                    button.textContent || "",
                                ),
                            ) || swipeSourceButtons[0];
                        const swipeRightSource =
                            swipeSourceButtons.find((button) =>
                                /\bAuto\b/i.test(button.textContent || ""),
                            ) || swipeSourceButtons[1] || swipeSourceButtons[0];
                        devAssert(
                            !!swipeLeftSource && !!swipeRightSource,
                            "toolbar smoke has normal button sources for pointer swipe coverage",
                        );
                        closeMobileDrawer();
                        swipeLeftSource.dispatchEvent(
                            new PointerEvent("pointerdown", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 260,
                                clientY: 160,
                            }),
                        );
                        document.dispatchEvent(
                            new PointerEvent("pointermove", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 150,
                                clientY: 162,
                            }),
                        );
                        devAssert(
                            $("app")?.classList.contains("mobile-right-drawer-open") &&
                                !$("app")?.classList.contains("mobile-left-drawer-open"),
                            "pointer swipe left from a normal button opens Images drawer",
                            $("app")?.className || "",
                        );
                        closeMobileDrawer();
                        swipeRightSource.dispatchEvent(
                            new PointerEvent("pointerdown", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 150,
                                clientY: 160,
                            }),
                        );
                        document.dispatchEvent(
                            new PointerEvent("pointermove", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 260,
                                clientY: 162,
                            }),
                        );
                        devAssert(
                            $("app")?.classList.contains("mobile-left-drawer-open") &&
                                !$("app")?.classList.contains("mobile-right-drawer-open"),
                            "pointer swipe right from a normal button opens Info drawer",
                            $("app")?.className || "",
                        );
                        closeMobileDrawer();
                        $("mobileLeftDrawerBtn").dispatchEvent(
                            new PointerEvent("pointerdown", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 8,
                                clientY: 160,
                            }),
                        );
                        $("mobileLeftDrawerBtn").dispatchEvent(
                            new PointerEvent("pointerup", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 120,
                                clientY: 162,
                            }),
                        );
                        devAssert(
                            $("app")?.classList.contains("mobile-left-drawer-open") &&
                                !$("app")?.classList.contains("mobile-right-drawer-open"),
                            "pointer swipe right from drawer handle opens Info drawer",
                            $("app")?.className || "",
                        );
                        closeMobileDrawer();
                        $("mobileRightDrawerBtn").dispatchEvent(
                            new PointerEvent("pointerdown", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 300,
                                clientY: 160,
                            }),
                        );
                        $("mobileRightDrawerBtn").dispatchEvent(
                            new PointerEvent("pointerup", {
                                bubbles: true,
                                pointerType: "touch",
                                clientX: 180,
                                clientY: 162,
                            }),
                        );
                        devAssert(
                            $("app")?.classList.contains("mobile-right-drawer-open") &&
                                !$("app")?.classList.contains("mobile-left-drawer-open"),
                            "pointer swipe left from drawer handle opens Images drawer",
                            $("app")?.className || "",
                        );
                    }
                } finally {
                    app.devMatchMediaOverride = realMatchMediaOverride;
                    closeMobileDrawer();
                }
                devAssert(
                    !!document.querySelector(
                        '.tool-menu-panel button.tool-button.discord[onclick="EmberAdventures.openDiscord()"]',
                    ),
                    "tools menu includes the EmberAdventures Discord link",
                );
                app.settings.reducedUi = true;
                applyReducedUiClass();
                updateTopToolbarVisibility();
                devAssert(
                    getComputedStyle($("shopsBtn")).display !== "none" &&
                        !$("shopsBtn").classList.contains("top-overflow-hidden") &&
                        getComputedStyle($("guideBtn")).display === "none",
                    "reduced UI keeps Shops as a primary top-bar action while hiding secondary Guidance",
                    {
                        shopsDisplay: getComputedStyle($("shopsBtn")).display,
                        shopsPriority: $("shopsBtn").dataset.topPriority,
                        shopsOverflowHidden:
                            $("shopsBtn").classList.contains("top-overflow-hidden"),
                        guidanceDisplay: getComputedStyle($("guideBtn")).display,
                    },
                );
                app.settings.reducedUi = false;
                applyReducedUiClass();
                updateTopToolbarVisibility();
                const checks = [
                    ["charactersBtn", /Cast|Characters/i],
                    ["shopsBtn", /Shops/i],
                    ["mapBtn", /Map/i],
                    ["settingsBtn", /Settings/i],
                    ["imageLabBtn", /Image Lab/i],
                    ["imageViewerBtn", /All Images/i],
                ];
                for (const [buttonId, expected] of checks) {
                    closeModal();
                    const button = $(buttonId);
                    devAssert(!!button, `toolbar button exists: ${buttonId}`);
                    button.click();
                    await devWaitFor(
                        () =>
                            $("modal")?.classList.contains("open") ||
                            (buttonId === "charactersBtn" && !!$("characterDirectorySearch")),
                        1200,
                        `toolbar button to open a modal: ${buttonId}`,
                    );
                    devAssert(
                        $("modal")?.classList.contains("open") ||
                            (buttonId === "charactersBtn" && !!$("characterDirectorySearch")),
                        `toolbar button opens a modal: ${buttonId}`,
                    );
                    devAssert(
                        expected.test($("modalBox")?.textContent || ""),
                        `toolbar modal content matches ${expected} for ${buttonId}; actual=${($("modalBox")?.textContent || "").slice(0, 120)}`,
                    );
                    if (buttonId === "charactersBtn") {
                        devAssert(
                            $("characterDirectorySearch")?.value === "",
                            "toolbar opens Characters modal with an empty search field",
                            $("characterDirectorySearch")?.value,
                        );
                    }
                }
                closeModal();
                app.settings.devMode = false;
                applyReducedUiClass();
                openStateModal();
                devAssert(
                    /Advanced Mode Required/i.test(document.body?.textContent || ""),
                    "raw State editor is blocked when Dev mode is off",
                );
                document.querySelector("#noticeOkBtn")?.click();
                closeModal();
                app.settings.devMode = true;
                applyReducedUiClass();
                render();
                await new Promise((resolve) => setTimeout(resolve, 80));
                const stateButton = $("stateBtn");
                devAssert(
                    !!stateButton && !stateButton.hidden,
                    "raw State toolbar button appears when Dev mode is on",
                );
                openStateModal();
                await devWaitFor(
                    () =>
                        $("modal")?.classList.contains("open") &&
                        /Edit State/i.test($("modalBox")?.textContent || ""),
                    2000,
                    "raw State editor",
                );
                devAssert(
                    $("modal")?.classList.contains("open") &&
                        /Edit State/i.test($("modalBox")?.textContent || ""),
                    "raw State editor opens when Dev mode is on",
                    {
                        devMode: app.settings?.devMode,
                        modalOpen: $("modal")?.classList.contains("open"),
                        modalText: ($("modalBox")?.textContent || "").slice(0, 200),
                    },
                );
                closeModal();
                addMessage("system", "Toolbar modal smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: toolbar-modals-smoke");
            } finally {
                app.mainMenuExplicitlyOpened = originalMainMenuExplicitlyOpened;
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunQuickActionsSmokeTest() {
            devTestLog("Scenario start: quick-actions-smoke");
            devResetForLiveTest("quick-actions-smoke");
            devCreateTestProfile({  });
            app.state = devMakeSceneControlState({  });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Quick action smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            app.settings.reducedUi = false;
            app.settings.showAffectionStats = true;
            applyReducedUiClass();
            scheduleActiveGameSave();
            render();
            app.contextualSuggestions = [
                {
                    label: "Ask",
                    title: "Ask the guide",
                    text: '"What should I do first?"',
                    mode: "act",
                    tone: "info",
                    icon: "?"
                },
            ];
            renderQuickActions();

            let quickActions = $("quickActions");
            devAssert(!!quickActions, "quick action container exists");
            devAssert(
                /AI Command/i.test(quickActions.textContent || ""),
                "AI Command quick action is visible",
            );
            devAssert(
                /Continue/i.test(quickActions.textContent || ""),
                "Continue quick action is visible",
            );
            devAssert(
                /Auto/i.test(quickActions.textContent || ""),
                "Auto quick action is visible",
            );
            const initialContinueButton = [...quickActions.querySelectorAll("button")].find((button) =>
                /\bContinue\b/i.test(button.textContent || ""),
            );
            const initialAutoButton = [...quickActions.querySelectorAll("button")].find((button) =>
                /\bAuto\b/i.test(button.textContent || ""),
            );
            devAssert(
                initialContinueButton?.dataset.help ===
                    "Passively observe the scene without taking action." &&
                    initialAutoButton?.dataset.help ===
                        "Toggle to have AI take turns for you.",
                "Continue and Auto quick actions expose clear hover help text",
                {
                    continueHelp: initialContinueButton?.dataset.help || "",
                    autoHelp: initialAutoButton?.dataset.help || "",
                },
            );
            const chatTooltipControls = [
                { label: "Send", node: $("sendBtn") },
                { label: "Image", node: $("imageBtn") },
                {
                    label: "AI Command",
                    node: [...quickActions.querySelectorAll("button")].find((button) =>
                        /AI Command/i.test(button.textContent || ""),
                    ),
                },
                {
                    label: "Roll d20",
                    node: [...quickActions.querySelectorAll("button")].find((button) =>
                        /Roll d20/i.test(button.textContent || ""),
                    ),
                },
                {
                    label: "Find",
                    node: [...quickActions.querySelectorAll("button")].find((button) =>
                        /\bFind\b/i.test(button.textContent || ""),
                    ),
                },
                {
                    label: "Suggestion",
                    node: quickActions.querySelector("[data-contextual-suggestion]"),
                },
                { label: "Continue", node: initialContinueButton },
                { label: "Auto", node: initialAutoButton },
            ];
            devAssert(
                chatTooltipControls.every(({ node }) => node?.dataset?.help) &&
                    chatTooltipControls.every(({ node }) => !node?.hasAttribute?.("title")),
                "all main chat controls use the shared data-help hover tooltip instead of native title text",
                Object.fromEntries(
                    chatTooltipControls.map(({ label, node }) => [
                        label,
                        {
                            help: node?.dataset?.help || "",
                            title: node?.getAttribute?.("title") || "",
                        },
                    ]),
                ),
            );
            devAssert(
                /Roll d20/i.test(quickActions.textContent || ""),
                "Roll d20 quick action is visible",
            );
            devAssert(
                /Find/i.test(quickActions.textContent || ""),
                "Find quick action is visible",
            );
            app.settings.reducedUi = true;
            applyReducedUiClass();
            renderQuickActions();
            const reducedHiddenButtons = ["AI Command", "Roll d20", "Find"];
            const reducedButtonVisibility = Object.fromEntries(
                reducedHiddenButtons.map((label) => {
                    const button = [...$("quickActions").querySelectorAll("button")].find((item) =>
                        new RegExp(label, "i").test(item.textContent || ""),
                    );
                    return [label, button ? getComputedStyle(button).display : "missing"];
                }),
            );
            devAssert(
                reducedHiddenButtons.every(
                    (label) => reducedButtonVisibility[label] === "none",
                ),
                "reduced UI hides AI Command, Roll d20, and Find chat controls",
                { reducedButtonVisibility },
            );
            app.busy = true;
            app.stateSync.running = true;
            devAssert(
                showThreadLoadingHeartbeatMessages() === false &&
                    showThreadAiWorkingIndicator() === true,
                "reduced UI suppresses state heartbeat chat messages but keeps the AI working indicator visible",
                {
                    reducedUi: app.settings.reducedUi,
                    busy: app.busy,
                    stateSyncRunning: app.stateSync.running,
                    stateHeartbeatVisible: showThreadLoadingHeartbeatMessages(),
                    aiWorkingIndicatorVisible: showThreadAiWorkingIndicator(),
                },
            );
            app.busy = false;
            app.stateSync.running = false;
            app.settings.reducedUi = false;
            applyReducedUiClass();
            renderQuickActions();
            quickActions = $("quickActions");

            const aiButton = [...quickActions.querySelectorAll("button")].find((button) =>
                /AI Command/i.test(button.textContent || ""),
            );
            devAssert(!!aiButton, "AI Command button exists");
            aiButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /AI Command/i.test($("modalBox")?.textContent || ""),
                "AI Command quick action opens AI command modal",
            );
            closeModal();

            const findButton = [...quickActions.querySelectorAll("button")].find((button) =>
                /Find/i.test(button.textContent || ""),
            );
            devAssert(!!findButton, "Find button exists");
            findButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Find Character/i.test($("modalBox")?.textContent || ""),
                "Find quick action opens Find Character modal",
            );
            closeModal();

            const rollButton = [...quickActions.querySelectorAll("button")].find((button) =>
                /Roll d20/i.test(button.textContent || ""),
            );
            devAssert(!!rollButton, "Roll d20 button exists");
            rollButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                document.querySelector(".popup-modal.open #styledPromptInput") &&
                    /Roll d20/i.test(document.querySelector(".popup-modal.open")?.textContent || ""),
                "Roll d20 quick action opens styled prompt",
            );
            document.querySelector(".popup-modal.open #promptCancelBtn")?.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !document.querySelector(".popup-modal.open"),
                "Roll d20 prompt cancels without queuing",
            );

            const suggestionButton = quickActions.querySelector(
                "[data-contextual-suggestion]",
            );
            devAssert(!!suggestionButton, "contextual suggestion quick action exists");
            suggestionButton.click();
            await devWaitFor(
                () => /What should I do first/i.test($("input")?.value || ""),
                2000,
                "contextual suggestion to fill composer input",
            );
            devAssert(
                /What should I do first/i.test($("input")?.value || ""),
                "contextual suggestion fills composer input",
                { input: $("input")?.value },
            );
            devAssert(
                app.settings.composerMode === "act",
                "contextual suggestion sets composer mode",
                { composerMode: app.settings.composerMode },
            );

            addMessage("system", "Quick action smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: quick-actions-smoke");
        }

        async function devRunSceneCharacterControlsSmokeTest() {
            devTestLog("Scenario start: scene-character-controls-smoke");
            devResetForLiveTest("scene-character-controls-smoke");
            devCreateTestProfile({  });

            app.state = devMakeSceneControlState({  });
            app.state.characters = {
                "New Ally": {
                    ...blankCharacterTemplate("New Ally"),
                    name: "New Ally",
                    age: 26,
                    gender: "non-male",
                    role: "field guide",
                    personality_description: "Direct, watchful, and practical.",
                    trust: 4,
                    attraction: 3,
                    affection: 2,
                    appearance: {
                        hair: "black braid",
                        body: "athletic",
                    },
                    clothing: {
                        ...blankClothingTemplate(),
                        shirt: "green travel jacket",
                        pants: "dark trousers",
                        feet: "leather boots",
                    },
                    outfits: [
                        {
                            id: "travel-kit",
                            name: "Travel Kit",
                            clothing: {
                                shirt: "green travel jacket",
                                pants: "dark trousers",
                                feet: "leather boots",
                            },
                        },
                    ],
                    active_outfit_id: "travel-kit",
                    held_items: {
                        right_hand: "map case",
                        left_hand: "empty",
                    },
                    image: {
                        appearance: "adult field guide with black braid and green travel jacket",
                    },
                },
            };
            app.state.scene.party_members_present = ["New Ally"];
            app.state.scene.image_characters = [app.state.player.name];
            app.state.npc_directory = {
                locations: {
                    "Control Yard": {
                        label: "Control Yard",
                        characters: {
                            "Nia Inspect": {
                                name: "Nia Inspect",
                                gender: "female",
                                age: 30,
                                role: "inspected guide",
                                relationship: "neutral",
                                note: "Inspected NPC for card controls.",
                                inspected: true,
                                full_character: {
                                    ...blankCharacterTemplate("Nia Inspect"),
                                    name: "Nia Inspect",
                                    age: 30,
                                    gender: "female",
                                    role: "inspected guide",
                                    trust: 5,
                                    attraction: 4,
                                    affection: 3,
                                    clothing: {
                                        ...blankClothingTemplate(),
                                        shirt: "blue guide tunic",
                                        pants: "brown field trousers",
                                        feet: "soft boots",
                                    },
                                    outfits: [
                                        {
                                            id: "guide-kit",
                                            name: "Guide Kit",
                                            clothing: {
                                                shirt: "blue guide tunic",
                                                pants: "brown field trousers",
                                                feet: "soft boots",
                                            },
                                        },
                                    ],
                                    active_outfit_id: "guide-kit",
                                },
                            },
                            "Pax Shell": {
                                name: "Pax Shell",
                                gender: "male",
                                age: 28,
                                role: "uninspected scout",
                                relationship: "unknown",
                                note: "Uninspected NPC shell for card controls.",
                                inspected: false,
                            },
                        },
                    },
                },
            };
            app.state.scene.npcs_present = ["Nia Inspect", "Pax Shell"];
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Scene and character controls smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            app.settings.reducedUi = false;
            app.settings.showAffectionStats = true;
            applyReducedUiClass();
            scheduleActiveGameSave();
            render();
            setLeftPanelGroup("characters");

            const characterAction = (action) =>
                document.querySelector(
                    `[data-character-action="${action}"][data-character-name="New Ally"]`,
                );

            devAssert(!!characterAction("image"), "Mira image-target button exists");
            characterAction("image").click();
            devAssert(
                (app.state.scene.image_characters || []).includes("New Ally"),
                "Image target button adds full character to image targets",
                app.state.scene.image_characters,
            );

            devAssert(!!characterAction("profile"), "Mira profile-image button exists");
            characterAction("profile").click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Profile Images|Generate New Profile Image/i.test($("modalBox")?.textContent || ""),
                "Profile button opens profile image picker",
                { modalText: ($("modalBox")?.textContent || "").slice(0, 140) },
            );
            closeModal();

            devAssert(!!characterAction("edit"), "Mira edit button exists");
            characterAction("edit").click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /New Ally/i.test($("modalBox")?.textContent || ""),
                "Edit button opens character editor",
                { modalText: ($("modalBox")?.textContent || "").slice(0, 140) },
            );
            closeModal();

            devAssert(!!characterAction("settings"), "Mira settings button exists");
            characterAction("settings").click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Image Settings|New Ally/i.test($("modalBox")?.textContent || ""),
                "Settings button opens character image settings",
                { modalText: ($("modalBox")?.textContent || "").slice(0, 140) },
            );
            closeModal();

            const leftCardFor = (name) =>
                [...document.querySelectorAll("#leftPanel .character-card")].find((card) =>
                    new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(
                        card.textContent || "",
                    ),
                );
            const miraCard = leftCardFor("New Ally");
            const inspectedNpcCard = leftCardFor("Nia Inspect");
            const partialNpcCard = leftCardFor("Pax Shell");
            const partialNpcCardText = partialNpcCard?.textContent || "";
            const cardControlSummary = (card) => ({
                hasCard: !!card,
                hasImage: !!card?.querySelector?.("[data-character-action='image']"),
                hasSettings: !!card?.querySelector?.("[data-character-action='settings'], button[title*='settings' i]"),
                hasEdit: !!card?.querySelector?.("[data-character-action='edit'], [data-character-action='npc-edit']"),
                hasKill: !!card?.querySelector?.("[title*='dead' i], [title*='kill' i]"),
                hasDelete: !!card?.querySelector?.("[title*='delete' i]"),
                hasOutfit: !!card?.querySelector?.(".outfit-controls select"),
                hasSaveOutfit: !!card?.querySelector?.(".outfit-controls [data-character-action='save-outfit']"),
                hasClothingControls: !!card?.querySelector?.(".clothing-controls"),
                profileWidth: card?.querySelector?.(".profile-image-button")?.getBoundingClientRect?.().width || 0,
                cardWidth: card?.getBoundingClientRect?.().width || 0,
            });
            const compactSummaries = {
                mira: cardControlSummary(miraCard),
                inspectedNpc: cardControlSummary(inspectedNpcCard),
                partialNpc: cardControlSummary(partialNpcCard),
            };
            const leftSpacing = {
                panelGap: parseFloat(getComputedStyle(document.querySelector("#leftPanel .left-group-panel"))?.gap || "0"),
                sectionMarginBottom: parseFloat(getComputedStyle(document.querySelector("#leftPanel .panel-section"))?.marginBottom || "0"),
                sectionBodyGap: parseFloat(getComputedStyle(document.querySelector("#leftPanel .panel-section-body"))?.gap || "0"),
                stackGap: parseFloat(getComputedStyle(document.querySelector("#leftPanel .stack"))?.gap || "0"),
            };
            devAssert(
                compactSummaries.mira.hasOutfit &&
                    compactSummaries.mira.hasSaveOutfit &&
                    !compactSummaries.mira.hasClothingControls &&
                    compactSummaries.inspectedNpc.hasImage &&
                    compactSummaries.inspectedNpc.hasSettings &&
                    compactSummaries.inspectedNpc.hasEdit &&
                    compactSummaries.inspectedNpc.hasOutfit &&
                    compactSummaries.inspectedNpc.hasSaveOutfit &&
                    !compactSummaries.inspectedNpc.hasClothingControls &&
                    !compactSummaries.inspectedNpc.hasKill &&
                    !compactSummaries.inspectedNpc.hasDelete &&
                    compactSummaries.partialNpc.hasImage &&
                    compactSummaries.partialNpc.hasSettings &&
                    compactSummaries.partialNpc.hasEdit &&
                    !compactSummaries.partialNpc.hasOutfit &&
                    !compactSummaries.partialNpc.hasClothingControls &&
                    !compactSummaries.partialNpc.hasKill &&
                    !compactSummaries.partialNpc.hasDelete &&
                    compactSummaries.inspectedNpc.profileWidth <=
                        Math.max(90, compactSummaries.inspectedNpc.cardWidth * 0.45) &&
                    leftSpacing.panelGap <= 3 &&
                    leftSpacing.sectionMarginBottom <= 3 &&
                    leftSpacing.sectionBodyGap <= 3 &&
                    leftSpacing.stackGap <= 3,
                "left-column cast cards expose compact image/stat layout and correct character/NPC controls",
                { compactSummaries, leftSpacing },
            );
            devAssert(
                partialNpcCard &&
                    !/Uninspected NPC shell for card controls/i.test(partialNpcCardText) &&
                    !/Current:/i.test(partialNpcCardText),
                "non-inspected NPC cards do not expose shell note or current appearance text",
                { partialNpcCardText },
            );
            const partialImageButton = partialNpcCard?.querySelector?.(
                "[data-character-action='image']",
            );
            devAssert(!!partialImageButton, "non-inspected NPC image target button exists");
            partialImageButton.click();
            devAssert(
                (app.state.scene.image_characters || []).includes("Pax Shell"),
                "non-inspected NPC can be included in scene images",
                app.state.scene.image_characters,
            );
            const partialSettingsButton = partialNpcCard?.querySelector?.(
                "[data-character-action='settings']",
            );
            devAssert(!!partialSettingsButton, "non-inspected NPC settings button exists");
            partialSettingsButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Pax Shell|Settings|Voice|Image seed/i.test(
                        $("modalBox")?.textContent || "",
                    ),
                "non-inspected NPC settings opens voice/image seed settings",
                { modalText: ($("modalBox")?.textContent || "").slice(0, 180) },
            );
            closeModal();

            const partialEditButton = partialNpcCard?.querySelector?.(
                "[data-character-action='npc-edit']",
            );
            devAssert(!!partialEditButton, "non-inspected NPC edit button exists");
            partialEditButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /This NPC has not been inspected yet/i.test($("modalBox")?.textContent || ""),
                "non-inspected NPC edit opens shell editor instead of full inspected editor",
                { modalText: ($("modalBox")?.textContent || "").slice(0, 180) },
            );
            saveNpcShellEditor("Pax Shell", "Control Yard");
            await new Promise((resolve) => setTimeout(resolve, 80));
            const paxAfterShellEdit =
                app.state.npc_directory?.locations?.["Control Yard"]?.characters?.["Pax Shell"];
            devAssert(
                paxAfterShellEdit &&
                    paxAfterShellEdit.inspected === false &&
                    !paxAfterShellEdit.full_character,
                "saving a non-inspected NPC shell does not mark it inspected or create a full character",
                paxAfterShellEdit,
            );

            addMessage("system", "Scene and character controls smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: scene-character-controls-smoke");
        }

        async function devRunStateEditorAutosaveSmokeTest() {
            const setTimeout = (callback, delay = 0, ...args) => {
                if (Number(delay) <= 250) {
                    devSmokeSettle().then(() => callback(...args));
                    return 0;
                }
                return globalThis.setTimeout(callback, delay, ...args);
            };
            devTestLog("Scenario start: state-editor-autosave-smoke");
            devResetForLiveTest("state-editor-autosave-smoke");
            devCreateTestProfile({  });
            app.settings.devMode = true;
            applyReducedUiClass();
            app.state = devMakeSceneControlState({  });
            app.state.player.clothing ||= {};
            app.state.player.clothing.shirt = "starting state editor shirt";
            app.state.player.held_items = {
                right_hand: "state editor torch",
                left_hand: "state editor notebook",
            };
            app.state.player.starting_inventory = ["hidden starting player item"];
            app.state.player.starting_held_items = {
                right_hand: "hidden starting player torch",
                left_hand: null,
            };
            app.state.player.default_profile_image = {
                ...devSmokeDefaultProfileImage(app.state.player.name, false),
                url: "hidden-player-default-image",
            };
            app.state.player.image_prompt_config = {
                seed_enabled: true,
                seed: 123,
                style: "",
                profile_style: "",
                negative: "",
                negative_prompt: "",
            };
            app.state.characters = {
                "State Editor Ally": {
                    ...devSmokeRuntimeCharacter("State Editor Ally", {
                        gender: "non-male",
                        role: "state editor clothing tester",
                    }),
                    name: "State Editor Ally",
                    age: 25,
                    gender: "non-male",
                    role: "state editor clothing tester",
                    clothing: {
                        ...blankClothingTemplate(),
                        shirt: "starting state editor ally shirt",
                        pants: "starting state editor ally pants",
                    },
                    starting_inventory: ["hidden starting party item"],
                    starting_held_items: {
                        right_hand: "hidden starting party torch",
                        left_hand: null,
                    },
                    default_profile_image: {
                        ...devSmokeDefaultProfileImage("State Editor Ally", false),
                        url: "hidden-party-default-image",
                    },
                    image_prompt_config: {
                        seed_enabled: true,
                        seed: 456,
                        style: "",
                        profile_style: "",
                        negative: "",
                        negative_prompt: "",
                    },
                },
            };
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "State editor autosave smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();

            const stateButton = $("stateBtn");
            devAssert(!!stateButton, "State toolbar button exists");
            stateButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Edit State/i.test($("modalBox")?.textContent || ""),
                "State button opens state editor modal",
            );
            const fieldForPathIn = (rootSelector, path) =>
                [...document.querySelectorAll(`${rootSelector} [data-state-path]`)].find((field) => {
                    try {
                        return (
                            JSON.stringify(
                                JSON.parse(
                                    decodeURIComponent(
                                        field.dataset.statePath || "[]",
                                    ),
                                ),
                            ) === JSON.stringify(path)
                        );
                    } catch {
                        return false;
                    }
                });
            const fieldForPath = (path) => fieldForPathIn("#friendlyStateEditor", path);
            const moveButtonForField = (field) =>
                field
                    ?.closest?.(".state-field-control")
                    ?.querySelector?.(".clothing-remove");
            const nullButtonForField = (field) =>
                field
                    ?.closest?.(".state-field-control")
                    ?.querySelector?.(".icon-button[title^='Set ']");
            const dressButtonForInventoryText = (text) =>
                [...document.querySelectorAll("#friendlyStateEditor .clothing-dress")].find(
                    (button) =>
                        button.closest(".state-field")?.textContent?.includes(text),
                );
            const dressButtonForInventoryTextIn = (rootSelector, text) =>
                [...document.querySelectorAll(`${rootSelector} .clothing-dress`)].find(
                    (button) =>
                        button.closest(".state-field")?.textContent?.includes(text),
                );
            const editorScrollBoxForSmoke = (rootSelector = "#friendlyStateEditor") => {
                const tree = document.querySelector(rootSelector);
                return stateEditorScrollContainer(tree);
            };
            const setModalScrollForButtonSmoke = (rootSelector = "#friendlyStateEditor") => {
                const box = editorScrollBoxForSmoke(rootSelector);
                if (!box) return 0;
                const next = Math.min(
                    420,
                    Math.max(0, box.scrollHeight - box.clientHeight),
                );
                box.scrollTop = next;
                devAssert(
                    next > 0,
                    "state editor smoke has real modal overflow before checking scroll preservation",
                    {
                        scrollHeight: box.scrollHeight,
                        clientHeight: box.clientHeight,
                        scrollContainer:
                            box === document.querySelector(rootSelector) ? "tree" : "modal",
                        next,
                    },
                );
                return next;
            };
            const assertModalScrollPreserved = (
                expected,
                label,
                rootSelector = "#friendlyStateEditor",
            ) => {
                const box = editorScrollBoxForSmoke(rootSelector);
                const actual = box?.scrollTop || 0;
                const tolerance = Math.max(160, Math.round((box?.clientHeight || 0) * 0.45));
                devAssert(
                    expected <= 0 ||
                        (actual > 24 && Math.abs(actual - expected) <= tolerance),
                    label,
                    {
                        expected,
                        actual,
                        tolerance,
                        scrollContainer:
                            box === document.querySelector(rootSelector) ? "tree" : "modal",
                    },
                );
            };
            const waitForEditorScrollSettle = () => devSmokeSettle(2);

            const summaryField = fieldForPath(["scene", "summary"]);
            devAssert(!!summaryField, "state editor exposes scene summary field");
            devAssert(
                !document.querySelector("#friendlyStateEditor .select-stepper"),
                "state editor uses dedicated stacked field controls instead of compact steppers",
            );
            devAssert(
                getComputedStyle(summaryField).resize === "none",
                "state editor textareas are not manually resizable",
                { resize: getComputedStyle(summaryField).resize },
            );
            summaryField.value = Array(8)
                .fill("Long state editor line that should expand the textarea instead of scrolling internally.")
                .join("\n");
            summaryField.dispatchEvent(new Event("input", { bubbles: true }));
            devAssert(
                getComputedStyle(summaryField).overflowY === "hidden" &&
                    summaryField.clientHeight >= summaryField.scrollHeight - 2,
                "state editor textareas expand to full content without internal scrolling",
                {
                    overflowY: getComputedStyle(summaryField).overflowY,
                    clientHeight: summaryField.clientHeight,
                    scrollHeight: summaryField.scrollHeight,
                },
            );
            devAssert(
                !fieldForPath(["player", "image"]) &&
                    !fieldForPath(["player", "image", "seed"]) &&
                    !fieldForPath(["player", "voice"]) &&
                    !fieldForPath(["player", "outfits"]) &&
                    !fieldForPath(["player", "active_outfit_id"]) &&
                    !fieldForPath(["player", "default_seed"]) &&
                    !fieldForPath(["player", "default_profile_image"]) &&
                    !fieldForPath(["player", "image_prompt_config"]) &&
                    !fieldForPath(["player", "starting_inventory"]) &&
                    !fieldForPath(["player", "starting_held_items"]),
                "state editor hides player image, seed, voice, outfit, default, and starting internals",
            );
            devAssert(
                !fieldForPath(["progression"]) &&
                    !fieldForPath(["progression", "level"]) &&
                    !fieldForPath(["progression", "xp"]),
                "state editor does not expose shelved progression internals",
            );
            summaryField.value = "Manual state editor summary";
            summaryField.dispatchEvent(new Event("input", { bubbles: true }));
            summaryField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.state.scene.summary !== "Manual state editor summary",
                "state editor blur does not bypass the inactivity debounce",
                app.state.scene,
            );
            flushStateEditorAutoSave("friendlyStateEditor");
            devAssert(
                app.state.scene.summary === "Manual state editor summary",
                "state editor flush saves scene summary",
                app.state.scene,
            );

            const playerRoleField = fieldForPath(["player", "role"]);
            devAssert(!!playerRoleField, "state editor exposes player role field");
            playerRoleField.value = "manual-state-tested role";
            playerRoleField.dispatchEvent(new Event("input", { bubbles: true }));
            playerRoleField.dispatchEvent(new Event("blur", { bubbles: true }));
            flushStateEditorAutoSave("friendlyStateEditor");
            devAssert(
                app.state.player.role === "manual-state-tested role",
                "state editor flush saves player role",
                app.state.player,
            );

            const playerShirtField = fieldForPath(["player", "clothing", "shirt"]);
            devAssert(
                !!playerShirtField,
                "state editor exposes editable player clothing slots",
                { player: app.state.player },
            );
            playerShirtField.value = "manual state editor linen shirt";
            playerShirtField.dispatchEvent(new Event("input", { bubbles: true }));
            playerShirtField.dispatchEvent(new Event("blur", { bubbles: true }));
            flushStateEditorAutoSave("friendlyStateEditor");
            devAssert(
                clothingItemText(app.state.player.clothing?.shirt) ===
                    "manual state editor linen shirt",
                "state editor flush saves player clothing slot edits",
                app.state.player.clothing,
            );

            const partyName = Object.keys(app.state.characters || {})[0] || "";
            devAssert(
                !fieldForPath(["characters", partyName, "default_profile_image"]) &&
                    !fieldForPath(["characters", partyName, "image_prompt_config"]) &&
                    !fieldForPath(["characters", partyName, "starting_inventory"]) &&
                    !fieldForPath(["characters", partyName, "starting_held_items"]),
                "state editor hides party-member default and starting internals",
            );
            const partyShirtField = partyName
                ? fieldForPath(["characters", partyName, "clothing", "shirt"])
                : null;
            devAssert(
                !!partyShirtField,
                "state editor exposes editable party-character clothing slots",
                { partyName, characters: app.state.characters },
            );
            partyShirtField.value = "manual state editor party jacket";
            partyShirtField.dispatchEvent(new Event("input", { bubbles: true }));
            partyShirtField.dispatchEvent(new Event("blur", { bubbles: true }));
            flushStateEditorAutoSave("friendlyStateEditor");
            devAssert(
                clothingItemText(app.state.characters?.[partyName]?.clothing?.shirt) ===
                    "manual state editor party jacket",
                "state editor flush saves party-character clothing slot edits",
                app.state.characters?.[partyName]?.clothing,
            );

            const partyMoveButton = moveButtonForField(partyShirtField);
            devAssert(
                !!partyMoveButton,
                "state editor shows move-to-inventory button for clothing slots",
            );
            const editorScrollBeforeMove = setModalScrollForButtonSmoke();
            partyMoveButton.click();
            await waitForEditorScrollSettle();
            devAssert(
                !clothingItemText(app.state.characters?.[partyName]?.clothing?.shirt) &&
                    (app.state.characters?.[partyName]?.inventory || []).some(
                        (item) =>
                            clothingItemText(item) ===
                                "manual state editor party jacket" &&
                            item.clothing_slot === "shirt" &&
                            item.removed_by === "manual",
                    ),
                "state editor clothing move-to-inventory button clears the clothing slot and adds inventory",
                {
                    clothing: app.state.characters?.[partyName]?.clothing,
                    inventory: app.state.characters?.[partyName]?.inventory,
                },
            );
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /manual state editor party jacket/i.test(
                    $("friendlyStateEditor")?.textContent || "",
                ),
                "state editor refreshes the visible inventory list after moving clothing to inventory",
                { editorText: $("friendlyStateEditor")?.textContent || "" },
            );
            assertModalScrollPreserved(
                editorScrollBeforeMove,
                "state editor refresh preserves modal scroll position after clothing-off button",
            );
            const assertAllEditorClothingSlotsVisible = (entityPath, label) => {
                const missing = validClothingSlots().filter(
                    (slot) => !fieldForPath([...entityPath, "clothing", slot]),
                );
                devAssert(
                    !missing.length,
                    `${label} editor shows every clothing slot even when slots are blank`,
                    {
                        missing,
                        clothing: getPathValue(app.state, [...entityPath, "clothing"]),
                    },
                );
            };
            assertAllEditorClothingSlotsVisible(["player"], "Player state");
            assertAllEditorClothingSlotsVisible(["characters", partyName], "Party character state");
            closeModal();
            openStateModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            assertAllEditorClothingSlotsVisible(["player"], "Reopened player state");
            assertAllEditorClothingSlotsVisible(["characters", partyName], "Reopened party character state");
            const partyDressButton = dressButtonForInventoryText(
                "manual state editor party jacket",
            );
            devAssert(
                !!partyDressButton,
                "state editor shows manual dress button for removed clothing inventory item",
            );
            const editorScrollBeforeDress = setModalScrollForButtonSmoke();
            partyDressButton.click();
            await waitForEditorScrollSettle();
            assertModalScrollPreserved(
                editorScrollBeforeDress,
                "state editor refresh preserves modal scroll position after clothing-on button",
            );
            devAssert(
                clothingItemText(app.state.characters?.[partyName]?.clothing?.shirt) ===
                    "manual state editor party jacket" &&
                    !(app.state.characters?.[partyName]?.inventory || []).some(
                        (item) =>
                            clothingItemText(item) ===
                            "manual state editor party jacket",
                    ),
                "state editor manual dress button puts the inventory item back on instead of duplicating it in inventory",
                {
                    clothing: app.state.characters?.[partyName]?.clothing,
                    inventory: app.state.characters?.[partyName]?.inventory,
                },
            );

            const playerUndershirtNullField = fieldForPath([
                "player",
                "clothing",
                "undershirt",
            ]);
            let playerUndershirtNullButton = nullButtonForField(playerUndershirtNullField);
            devAssert(
                !!playerUndershirtNullField && !!playerUndershirtNullButton,
                "state editor shows X/null button for ordinary fields",
            );
            playerUndershirtNullField.value = "undershirt to clear with null button";
            playerUndershirtNullField.dispatchEvent(new Event("input", { bubbles: true }));
            playerUndershirtNullField.dispatchEvent(new Event("blur", { bubbles: true }));
            flushStateEditorAutoSave("friendlyStateEditor");
            playerUndershirtNullButton = nullButtonForField(
                fieldForPath(["player", "clothing", "undershirt"]),
            );
            const editorScrollBeforeNull = setModalScrollForButtonSmoke();
            playerUndershirtNullButton.click();
            await waitForEditorScrollSettle();
            assertModalScrollPreserved(
                editorScrollBeforeNull,
                "state editor preserves modal scroll position after X/null button",
            );
            devAssert(
                app.state.player.clothing?.undershirt == null,
                "state editor X/null button clears the selected field",
                { clothing: app.state.player.clothing },
            );
            const playerHeldField = fieldForPath(["player", "held_items", "right_hand"]);
            const playerHeldMoveButton = moveButtonForField(playerHeldField);
            devAssert(
                !!playerHeldField && !!playerHeldMoveButton,
                "state editor shows move-to-inventory button for held item slots",
                { heldItems: app.state.player.held_items },
            );
            playerHeldMoveButton.click();
            await waitForEditorScrollSettle();
            devAssert(
                !clothingItemText(app.state.player.held_items?.right_hand) &&
                    (app.state.player.inventory || []).some(
                        (item) =>
                            clothingItemText(item) === "state editor torch" &&
                            item.held_item_slot === "right_hand" &&
                            item.removed_by === "manual",
                    ),
                "state editor held-item move-to-inventory button clears the hand slot and adds inventory",
                {
                    heldItems: app.state.player.held_items,
                    inventory: app.state.player.inventory,
                },
            );
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /state editor torch/i.test($("friendlyStateEditor")?.textContent || ""),
                "state editor refreshes the visible inventory list after moving held item to inventory",
                { editorText: $("friendlyStateEditor")?.textContent || "" },
            );

            closeModal();
            app.state.player.clothing.right_wrist = "state editor smoke fitness watch";
            openPlayerModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const playerEditorWristField = fieldForPathIn("#playerFriendlyEditor", [
                "game_managed_data",
                "clothing",
                "right_wrist",
            ]);
            const playerEditorWristMoveButton = moveButtonForField(playerEditorWristField);
            devAssert(
                !!playerEditorWristField && !!playerEditorWristMoveButton,
                "Player editor shows clothing-off button for current clothing slots",
            );
            const playerEditorScrollBeforeMove =
                setModalScrollForButtonSmoke("#playerFriendlyEditor");
            playerEditorWristMoveButton.click();
            await waitForEditorScrollSettle();
            assertModalScrollPreserved(
                playerEditorScrollBeforeMove,
                "Player editor preserves modal scroll position after clothing-off rebuild",
                "#playerFriendlyEditor",
            );
            devAssert(
                !clothingItemText(app.state.player.clothing?.right_wrist) &&
                    (app.state.player.inventory || []).some(
                        (item) =>
                            clothingItemText(item) ===
                                "state editor smoke fitness watch" &&
                            item.clothing_slot === "right_wrist" &&
                            item.removed_by === "manual",
                    ),
                "Player editor clothing-off button clears current clothing and moves it to inventory",
                {
                    clothing: app.state.player.clothing,
                    inventory: app.state.player.inventory,
                },
            );
            const playerEditorWristDressButton = dressButtonForInventoryTextIn(
                "#playerFriendlyEditor",
                "state editor smoke fitness watch",
            );
            devAssert(
                !!playerEditorWristDressButton,
                "Player editor shows clothing-on button for manually removed clothing",
            );
            const playerEditorScrollBeforeDress =
                setModalScrollForButtonSmoke("#playerFriendlyEditor");
            playerEditorWristDressButton.click();
            await waitForEditorScrollSettle();
            assertModalScrollPreserved(
                playerEditorScrollBeforeDress,
                "Player editor preserves modal scroll position after clothing-on rebuild",
                "#playerFriendlyEditor",
            );
            devAssert(
                clothingItemText(app.state.player.clothing?.right_wrist) ===
                    "state editor smoke fitness watch" &&
                    !(app.state.player.inventory || []).some(
                        (item) =>
                            clothingItemText(item) ===
                            "state editor smoke fitness watch",
                    ),
                "Player editor clothing-on button restores current clothing from inventory",
                {
                    clothing: app.state.player.clothing,
                    inventory: app.state.player.inventory,
                },
            );

            closeModal();
            addMessage("system", "State editor autosave smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: state-editor-autosave-smoke");
        }

        async function devRunSettingsPersistenceSmokeTest() {
            devTestLog("Scenario start: settings-persistence-smoke");
            devResetForLiveTest("settings-persistence-smoke");
            devCreateTestProfile({  });
            const defaultProfileSettings = profileSettingsFromDefaults();
            devAssert(validateUserProfileDefinition({...clone(activeUserProfile()),settings:defaultProfileSettings}).ok,"default profile settings use the canonical contract");
            app.state = devMakeSceneControlState({  });


            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Settings persistence smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();

            openSettingsModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const settingsSurface = $("modal")?.classList.contains("open")
                ? $("modalBox")
                : document.querySelector("[data-library-settings-overlay-box]");
            devAssert(
                !!settingsSurface && /Settings/i.test(settingsSurface.textContent || ""),
                "Settings button opens settings modal",
            );
            devAssert(
                settingsSurface?.querySelector(".modal-chrome-title")?.textContent?.trim() ===
                    "Settings" &&
                    !settingsSurface?.querySelector("h2") &&
                    !!settingsSurface?.querySelector(".modal-close"),
                "Settings modal uses the shared top chrome instead of a separate body title row",
            );

            devAssert(!!$("ollama-provider") && !!$("ollama-temperature") && !!$("ollama-seed"),
                "Settings exposes Ollama provider and tuning controls");
            $("ollama-temperature").value = "0.7";
            $("ollama-temperature").dispatchEvent(new Event("input", { bubbles: true }));
            $("ollama-seed").value = "42";
            $("ollama-seed").dispatchEvent(new Event("input", { bubbles: true }));
            devAssert(app.settings.ollama.temperature === "0.7" && app.settings.ollama.seed === "42", "Ollama controls autosave when changed");



            await new Promise((resolve) => setTimeout(resolve, 150));




            await new Promise((resolve) => setTimeout(resolve, 150));


            $("autoImages").checked = false;
            $("autoImages").dispatchEvent(new Event("change", { bubbles: true }));
            devAssert(
                app.settings.autoImages === false,
                "autoImages checkbox autosaves",
                app.settings,
            );

            $("showImagesInChat").checked = false;
            $("showImagesInChat").dispatchEvent(new Event("change", { bubbles: true }));
            devAssert(
                app.settings.showImagesInChat === false,
                "showImagesInChat checkbox autosaves",
                app.settings,
            );
            $("showImagesInChat").checked = true;
            $("showImagesInChat").dispatchEvent(new Event("change", { bubbles: true }));
            devAssert(
                app.settings.showImagesInChat === true,
                "showImagesInChat checkbox can be re-enabled",
                app.settings,
            );

            $("imageMode").value = "manual";
            $("imageMode").dispatchEvent(new Event("change", { bubbles: true }));
            devAssert(
                app.settings.imageMode === "manual",
                "imageMode select autosaves",
                app.settings,
            );

            $("imageHistoryLimit").value = "37";
            $("imageHistoryLimit").dispatchEvent(new Event("blur", { bubbles: true }));
            devAssert(
                Number(app.settings.imageHistoryLimit) === 37,
                "image history limit input autosaves",
                app.settings,
            );

            $("imageRequestTimeoutSeconds").value = "47";
            $("imageRequestTimeoutSeconds").dispatchEvent(
                new Event("blur", { bubbles: true }),
            );
            devAssert(
                Number(app.settings.imageRequestTimeoutSeconds) === 47,
                "image request timeout input autosaves",
                app.settings,
            );

            await flushLargeSaves();
            const persistedSettings = await loadLargeJson(SETTINGS_KEY, {});
            const persistedProfiles = await loadLargeJson(USER_PROFILE_KEY, []);
            const persistedProfile = persistedProfiles.find(
                (profile) =>
                    String(profile?.id || "") ===
                    String(app.settings.activeUserProfileId || ""),
            );
            devAssert(
                persistedSettings.activeUserProfileId ===
                    app.settings.activeUserProfileId &&
                    persistedProfile?.settings?.autoImages === false &&
                    persistedProfile?.settings?.showImagesInChat === true &&
                    persistedProfile?.settings?.imageMode === "manual" &&
                    Number(persistedProfile?.settings?.imageHistoryLimit) === 37 &&
                    Number(persistedProfile?.settings?.imageRequestTimeoutSeconds) === 47 &&
                    persistedSettings.ollama.temperature === "0.7" &&
                    persistedSettings.ollama.seed === "42",
                `local settings and profile-owned settings persist through their worker-owned records: ${JSON.stringify({ persistedSettings, persistedProfile })}`,
                { persistedSettings, persistedProfile },
            );
            devTestLog("settings persistence records", {
                persistedSettings,
                persistedProfile,
            });

            closeModal();
            addMessage("system", "Settings persistence smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: settings-persistence-smoke");
        }



        async function devRunImageViewerLabSmokeTest() {
            devTestLog("Scenario start: image-viewer-lab-smoke");
            devResetForLiveTest("image-viewer-lab-smoke");
            devCreateTestProfile({  });
            const imageHtml = `<img alt="Smoke image" src="${devSmokeOnePixelDataUrl()}">`;
            // SANITIZE KEEP (dev fixture): synthetic image-viewer state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Image Viewer Smoke",
                    },
                },
                player: {
                    ...devSmokeRuntimeCharacter("Image Viewer Tester", {
                        gender: "non-male",
                        role: "portrait reviewer",
                    }),
                    name: "Image Viewer Tester",
                    age: 24,
                    gender: "non-male",
                    role: "portrait reviewer",
                    image: {
                        appearance: "blue cloak, practical boots",
                    },
                    profile_image_id: "profile-smoke-1",
                    profile_images: [
                        {
                            id: "profile-smoke-1",
                            male: false,
                            source: "smoke",
                            model: "default",
                            seed: 222,
                            prompt: "profile smoke prompt",
                            favorite: false,
                        },
                        {
                            id: "profile-smoke-2",
                            male: false,
                            source: "smoke",
                            model: "default",
                            seed: 333,
                            prompt: "alternate profile smoke prompt",
                            favorite: false,
                        },
                    ],
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Image viewer test room",
                    objective: "Verify image viewer mechanics",
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                objectives: {
                    active_id: "image_viewer_test",
                    items: [
                        {
                            id: "image_viewer_test",
                            title: "Verify Image Viewer",
                            type: "story",
                            status: "active",
                            summary: "Smoke test image viewer.",
                            objective: "Open image viewer.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.profileImages = exactProfileImageStore([
                createProfileImageRecord({
                    id: "profile-smoke-1",
                    character_id: app.state.player.id,
                    owner_name: "Player",
                    male: false,
                    source: "smoke",
                    model: "default",
                    seed: 222,
                    prompt: "profile smoke prompt",
                    favorite: false,
                    html: imageHtml,
                }),
                createProfileImageRecord({
                    id: "profile-smoke-2",
                    character_id: app.state.player.id,
                    owner_name: "Player",
                    male: false,
                    source: "smoke",
                    model: "default",
                    seed: 333,
                    prompt: "alternate profile smoke prompt",
                    favorite: false,
                    html: imageHtml,
                }),
            ]);
            const imageSmokeMessageId = nextEntryId();
            const imageSmokeLaterMessageId = nextEntryId();
            const imageSmokeFinalMessageId = nextEntryId();
            app.images = [
                {
                    id: "normal-smoke-pending",
                    at: "2026-06-12T12:00:01.000Z",
                    requestedAt: "2026-06-12T12:00:00.000Z",
                    requestOrder: 2,
                    requestedAfterMessageId: imageSmokeMessageId,
                    title: "Pending Normal Smoke Image",
                    reason: "smoke",
                    model: "default",
                    seed: 112,
                    prompt: "pending normal smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageLoadingHtml("Image generation in progress"),
                    pending: true,
                    error: "",
                    targets: ["Player"],
                },
                {
                    id: "normal-smoke-1",
                    at: "2026-06-12T12:00:00.000Z",
                    requestedAt: "2026-06-12T12:00:00.000Z",
                    requestOrder: 1,
                    requestedAfterMessageId: imageSmokeMessageId,
                    title: "Normal Smoke Image",
                    reason: "smoke",
                    model: "default",
                    seed: 111,
                    prompt: "normal smoke prompt",
                    negativePrompt: "normal smoke negative prompt",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    targets: ["Player"],
                },
                {
                    id: "image-lab-smoke-between",
                    at: "2026-06-12T12:00:05.000Z",
                    requestedAt: "2026-06-12T12:00:05.000Z",
                    requestOrder: 3,
                    requestedAfterMessageId: "",
                    title: "Image Lab Smoke Image",
                    reason: "image lab",
                    model: "default",
                    seed: 113,
                    prompt: "image lab smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    targets: ["Player"],
                },
                {
                    id: "imported-smoke-between",
                    at: "2026-06-12T12:00:06.000Z",
                    requestedAt: "2026-06-12T12:00:06.000Z",
                    requestOrder: 4,
                    requestedAfterMessageId: "",
                    title: "Imported Smoke Image",
                    reason: "hosted import",
                    model: "imported",
                    seed: "imported",
                    prompt: "imported smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    targets: [],
                },
                {
                    id: "reward-smoke-after-later",
                    at: "2026-06-12T12:00:15.000Z",
                    requestedAt: "2026-06-12T12:00:15.000Z",
                    requestOrder: 5,
                    requestedAfterMessageId: "",
                    title: "Reward Smoke Image",
                    reason: "future character reward",
                    model: "default",
                    seed: 0,
                    prompt: "future reward smoke prompt",
                    negativePrompt: "",
                    favorite: true,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    targets: ["Player"],
                },
                {
                    id: "pending-unanchored-after-later",
                    at: "2026-06-12T12:00:16.000Z",
                    requestedAt: "2026-06-12T12:00:16.000Z",
                    requestOrder: 6,
                    requestedAfterMessageId: "",
                    title: "Unanchored Pending Smoke Image",
                    reason: "manual image",
                    model: "default",
                    seed: 114,
                    prompt: "pending unanchored smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageLoadingHtml("Image generation in progress"),
                    pending: true,
                    error: "",
                    targets: ["Player"],
                },
            ];
            const originalPlayerFallbackName = app.state.player.fallback_name;
            const originalPlayerGender = app.state.player.gender;
            app.state.player.fallback_name = "Image Viewer Tester Male";
            const originalCharacterImages = app.characterImages;
            app.characterImages = [
                {
                    id: "character-scene-smoke-1",
                    at: "2026-06-12T12:00:07.000Z",
                    title: "Character Scene Smoke Image",
                    reason: "scene smoke",
                    model: "default",
                    seed: 115,
                    prompt: "character scene smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    profile: false,
                    targets: ["Player"],
                    target_presentations: { Player: "non_male" },
                },
                {
                    id: "character-scene-opposite-presentation-smoke-1",
                    at: "2026-06-12T12:00:08.000Z",
                    title: "Character Opposite Presentation Smoke Image",
                    reason: "scene smoke",
                    model: "default",
                    seed: 116,
                    prompt: "character opposite presentation smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    profile: false,
                    targets: ["Image Viewer Tester Male"],
                    target_presentations: {
                        "Image Viewer Tester Male": "male",
                    },
                },
                {
                    id: "character-scene-legacy-unknown-smoke-1",
                    at: "2026-06-12T12:00:09.500Z",
                    title: "Legacy Unknown Presentation Smoke Image",
                    reason: "scene smoke",
                    model: "default",
                    seed: 1165,
                    prompt: "legacy unknown presentation smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    profile: false,
                    targets: ["Player"],
                },
                {
                    id: "character-scene-direct-male-smoke-1",
                    at: "2026-06-12T12:00:09.750Z",
                    title: "Direct Male Presentation Smoke Image",
                    reason: "scene smoke",
                    model: "default",
                    seed: 1166,
                    prompt: "direct male presentation smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: imageHtml,
                    pending: false,
                    error: "",
                    profile: false,
                    presentation: "male",
                    targets: ["Player"],
                },
                {
                    id: "character-scene-url-smoke-1",
                    at: "2026-06-12T12:00:09.000Z",
                    title: "Character URL Scene Smoke Image",
                    reason: "scene smoke",
                    model: "default",
                    seed: 117,
                    prompt: "character URL scene smoke prompt",
                    negativePrompt: "",
                    favorite: false,
                    html: "",
                    url: devSmokeOnePixelDataUrl(),
                    pending: false,
                    error: "",
                    profile: false,
                    targets: ["Player"],
                },
            ];
            app.messages = [
                {
                    id: imageSmokeMessageId,
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Image viewer smoke test ready.",
                    at: "2026-06-12T12:00:00.000Z",
                },
                {
                    id: imageSmokeLaterMessageId,
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Later chat text should stay below the image requested before it.",
                    at: "2026-06-12T12:00:10.000Z",
                },
                {
                    id: imageSmokeFinalMessageId,
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Final chat text should stay below all images requested before it.",
                    at: "2026-06-12T12:00:20.000Z",
                },
            ];
            app.settings.showImagesInChat = true;
            scheduleActiveGameSave();
            render();
            devAssert(
                !!document.querySelector(
                    `#thread [data-message-id='${cssEscape(imageSmokeMessageId)}'] + .chat-image-gallery [data-image-id='normal-smoke-1']`,
                ),
                "normal images render inline after the message that existed when they were requested",
            );
            const inlineImages = [
                ...document.querySelectorAll(
                    `#thread [data-message-id='${cssEscape(imageSmokeMessageId)}'] + .chat-image-gallery [data-image-id]`,
                ),
            ].map((card) => card.getAttribute("data-image-id"));
            devAssert(
                inlineImages[0] === "normal-smoke-1" &&
                    inlineImages[1] === "normal-smoke-pending",
                "chat images render in request order so newer images are added lower in the chat",
                inlineImages,
            );
            const threadChildren = [...$("thread").children].map((node) => {
                const messageId = node.getAttribute("data-message-id");
                const imageIds = [...node.querySelectorAll("[data-image-id]")].map((card) =>
                    card.getAttribute("data-image-id"),
                );
                return messageId || imageIds.join(",");
            });
            devAssert(
                threadChildren.indexOf("image-lab-smoke-between,imported-smoke-between") >
                    threadChildren.indexOf(String(imageSmokeMessageId)) &&
                    threadChildren.indexOf("image-lab-smoke-between,imported-smoke-between") <
                        threadChildren.indexOf(String(imageSmokeLaterMessageId)),
                "unanchored Image Lab/imported chat images render at their request time instead of being pinned below newer messages",
                threadChildren,
            );
            devAssert(
                threadChildren.indexOf("reward-smoke-after-later,pending-unanchored-after-later") >
                    threadChildren.indexOf(String(imageSmokeLaterMessageId)) &&
                    threadChildren.indexOf("reward-smoke-after-later,pending-unanchored-after-later") <
                        threadChildren.indexOf(String(imageSmokeFinalMessageId)),
                "reward and pending unanchored chat images render before later text when they were requested first",
                threadChildren,
            );
            devAssert(
                !document.querySelector(
                    "[data-image-id='normal-smoke-pending'] button[title='Download image']",
                ),
                "pending normal image starts without a download button",
            );
            updateStoredImageHtml(
                "normal-smoke-pending",
                `<iframe src="https://example.com/live-image"></iframe><img src=x onerror="window.__emberAdventuresUnsafeImageSmoke=1">`,
                {
                    pending: true,
                    error: "",
                },
            );
            const pendingSmokeRecord = app.images.find(
                (image) => String(image.id) === "normal-smoke-pending",
            );
            devAssert(
                pendingSmokeRecord?.pending === true &&
                    !/<iframe|onerror|<script/i.test(String(pendingSmokeRecord?.html || "")) &&
                    /<iframe/i.test(String(app.imageLiveHtmlCache?.["normal-smoke-pending"] || "")),
                "pending live image HTML stays in memory cache and is not persisted on the image record",
                {
                    storedHtml: pendingSmokeRecord?.html,
                    liveHtml: app.imageLiveHtmlCache?.["normal-smoke-pending"],
                },
            );
            const unsafeStored = safeImageHistoryForStorage([
                {
                    id: "unsafe-image-smoke",
                    title: "Unsafe Image Smoke",
                    html: "<scr" + "ipt>window.__bad=1</scr" + "ipt><img src=x onerror=\"window.__bad=1\">",
                    prompt: "unsafe",
                },
            ])[0];
            devAssert(
                unsafeStored && !unsafeStored.html,
                "unsafe stored image HTML is rejected instead of persisted",
                unsafeStored,
            );
            const unsafeStoredImageHtml =
                '<iframe src="https://example.com/live-image"></iframe>' +
                '<scr' +
                'ipt>window.__bad=1</scr' +
                'ipt><img src=x onerror="window.__bad=1">';
            const trustedStoredImageHtml = `<img src="${devSmokeOnePixelDataUrl()}" alt="Safe smoke image" onerror="window.__bad=1">`;
            const assertNoRawStoredImageHtml = (label, html) => {
                const text = String(html || "");
                devAssert(
                    !/<iframe\b|<script\b|onerror\s*=|javascript:/i.test(text),
                    `${label} does not persist raw iframe/script/event-handler image HTML`,
                    { html: text },
                );
            };
            const storedNormalRegression = safeImageHistoryForStorage([
                {
                    id: "stored-normal-unsafe-regression",
                    title: "Stored Normal Unsafe Regression",
                    html: unsafeStoredImageHtml,
                    prompt: "unsafe normal",
                },
                {
                    id: "stored-normal-safe-regression",
                    title: "Stored Normal Safe Regression",
                    html: trustedStoredImageHtml,
                    prompt: "safe normal",
                },
            ]);
            storedNormalRegression.forEach((record) =>
                assertNoRawStoredImageHtml(`normal image ${record.id}`, record.html),
            );
            devAssert(
                !storedNormalRegression.find((record) => record.id === "stored-normal-unsafe-regression")?.html &&
                    !!stableImageHtmlToString(
                        storedNormalRegression.find((record) => record.id === "stored-normal-safe-regression")?.html,
                    ),
                "normal image storage keeps safe image HTML and strips unsafe raw DOM",
                storedNormalRegression,
            );
            const storedProfileRegression = exactProfileImageStore([
                createProfileImageRecord({
                    id: "stored-profile-unsafe-regression",
                    character_id: app.state.player.id,
                    owner_name: "Image Tester",
                    html: unsafeStoredImageHtml,
                }),
                createProfileImageRecord({
                    id: "stored-profile-safe-regression",
                    character_id: app.state.player.id,
                    owner_name: "Image Tester",
                    html: trustedStoredImageHtml,
                }),
            ]);
            storedProfileRegression.forEach((record) =>
                assertNoRawStoredImageHtml(`profile image ${record.id}`, record.html),
            );
            devAssert(
                !storedProfileRegression.find((record) => record.id === "stored-profile-unsafe-regression")?.html &&
                    !!stableImageHtmlToString(
                        storedProfileRegression.find((record) => record.id === "stored-profile-safe-regression")?.html,
                    ),
                "profile image storage keeps safe image HTML and strips unsafe raw DOM",
                storedProfileRegression,
            );
            const storedStoryTemplate = devSmokeTemplateRecord({
                id: "stored-image-regression",
                title: "Stored Image Regression",
            });
            const storedStoryImageFixture = (id, html) =>
                storyTitleCardOwnedImageRecord(storedStoryTemplate, {
                    id,
                    at: "2026-06-12T12:00:00.000Z",
                    source: "smoke",
                    reason: "stored image regression",
                    title: "Stored Story Image Regression",
                    prompt: "stored story image regression",
                    negativePrompt: "",
                    seed: 0,
                    model: "default",
                    html,
                    favorite: false,
                    pending: false,
                    error: "",
                    smoke_test_artifact: true,
                });
            const storedStoryRegression = exactStoryTitleCardImageStore([
                storedStoryImageFixture(
                    "stored-story-unsafe-regression",
                    unsafeStoredImageHtml,
                ),
                storedStoryImageFixture(
                    "stored-story-safe-regression",
                    trustedStoredImageHtml,
                ),
            ]);
            storedStoryRegression.forEach((record) =>
                assertNoRawStoredImageHtml(`story title image ${record.id}`, record.html),
            );
            devAssert(
                !storedStoryRegression.find((record) => record.id === "stored-story-unsafe-regression")?.html &&
                    !!stableImageHtmlToString(
                        storedStoryRegression.find((record) => record.id === "stored-story-safe-regression")?.html,
                    ),
                "story title image storage keeps safe image HTML and strips unsafe raw DOM",
                storedStoryRegression,
            );
            renderImagePanel();
            closeModal();
            updateStoredImageHtml("normal-smoke-pending", imageHtml, {
                pending: false,
                error: "",
            });
            devAssert(
                !app.imageLiveHtmlCache?.["normal-smoke-pending"] &&
                    !!stableImageHtmlToString(pendingSmokeRecord?.html),
                "normal image completion updates the stored record even after the image UI is closed",
                pendingSmokeRecord,
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            renderImagePanel();
            renderThread("finished image viewer smoke image");
            devAssert(
                !!document.querySelector(
                    "[data-image-id='normal-smoke-pending'] button[title='Download image']",
                ) &&
                    !!document.querySelector(
                        "[data-image-id='normal-smoke-pending'] .image-preview-hitbox",
                    ),
                "finished right-column normal image is rebuilt with download and big-viewer controls",
            );

            $("imageViewerBtn")?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    /Image Viewer/i.test($("modalBox")?.textContent || ""),
                "Image Viewer button opens image viewer modal",
            );
            devAssert(
                /Profile Images \(2\)/i.test($("modalBox")?.textContent || "") &&
                    /Images \(6\)/i.test($("modalBox")?.textContent || ""),
                "image viewer shows seeded profile and normal image counts",
                { text: $("modalBox")?.textContent?.slice(0, 600) },
            );
            devAssert(
                getComputedStyle(
                    document.querySelector(
                        "#modalBox[data-image-viewer-modal='1'] [data-image-id='normal-smoke-1'] .image-render",
                    ),
                ).minHeight === "300px",
                "All Images modal uses full-size normal image cards",
            );
            devAssert(
                ![...document.querySelectorAll("[data-image-id='normal-smoke-1'] button")]
                    .some((button) => /upload|share/i.test(button.textContent || button.title || "")),
                "normal image cards do not expose upload/share buttons",
                [...document.querySelectorAll("[data-image-id='normal-smoke-1'] button")]
                    .map((button) => button.textContent || button.title || ""),
            );
            devAssert(
                !!document.querySelector(
                    "[data-image-id='normal-smoke-1'] button[title='Download image']",
                ),
                "normal image cards expose a download button",
            );
            const originalPublicDownloadImageRecord = EmberAdventures.downloadImageRecord;
            let clickedSceneImageId = "";
            EmberAdventures.downloadImageRecord = (id) => {
                clickedSceneImageId = String(id || "");
                return true;
            };
            try {
                openProfileImageModal("Player");
                const sceneDownloadButton = document.querySelector(
                    "[data-profile-image-modal] .profile-related-images [data-image-id='character-scene-smoke-1'] button[title='Download image']",
                );
                const relatedSceneImageIds = profileRelatedImages("Player").map(
                    (image) => image.id,
                );
                sceneDownloadButton?.click();
                devAssert(
                    !!sceneDownloadButton &&
                        clickedSceneImageId === "character-scene-smoke-1" &&
                        imageRecordForDownload(clickedSceneImageId)?.id ===
                            "character-scene-smoke-1" &&
                        relatedSceneImageIds.includes("character-scene-smoke-1") &&
                        !relatedSceneImageIds.includes(
                            "character-scene-opposite-presentation-smoke-1",
                        ) &&
                        !relatedSceneImageIds.includes(
                            "character-scene-legacy-unknown-smoke-1",
                        ) &&
                        !relatedSceneImageIds.includes(
                            "character-scene-direct-male-smoke-1",
                        ),
                    "character Scene Images cards download shared records and hide the opposite gender presentation",
                    {
                        sceneDownloadButton: !!sceneDownloadButton,
                        clickedSceneImageId,
                        resolvedImageId: imageRecordForDownload(clickedSceneImageId)?.id || "",
                        relatedSceneImageIds,
                    },
                );
                app.state.player.gender = "male";
                const maleRelatedSceneImageIds = profileRelatedImages("Player").map(
                    (image) => image.id,
                );
                app.state.player.gender = originalPlayerGender;
                devAssert(
                    maleRelatedSceneImageIds.includes(
                        "character-scene-opposite-presentation-smoke-1",
                    ) &&
                        !maleRelatedSceneImageIds.includes("character-scene-smoke-1") &&
                        !maleRelatedSceneImageIds.includes(
                            "character-scene-legacy-unknown-smoke-1",
                        ) &&
                        maleRelatedSceneImageIds.includes(
                            "character-scene-direct-male-smoke-1",
                        ),
                    "character Scene Images show the matching male presentation and hide unknown legacy records",
                    { maleRelatedSceneImageIds },
                );
                EmberAdventures.downloadImageRecord = originalPublicDownloadImageRecord;
                const originalCreateElement = document.createElement.bind(document);
                const downloadHrefs = [];
                document.createElement = (...args) => {
                    const element = originalCreateElement(...args);
                    if (String(args[0] || "").toLowerCase() === "a") {
                        element.click = () => downloadHrefs.push(String(element.href || ""));
                    }
                    return element;
                };
                try {
                    await EmberAdventures.downloadImageRecord("character-scene-url-smoke-1");
                } finally {
                    document.createElement = originalCreateElement;
                }
                devAssert(
                    downloadHrefs.includes(devSmokeOnePixelDataUrl()),
                    "character Scene Images cards download a URL-backed image when HTML is empty",
                    { downloadHrefs },
                );
            } finally {
                closeModal();
                EmberAdventures.downloadImageRecord = originalPublicDownloadImageRecord;
                app.characterImages = originalCharacterImages;
                app.state.player.fallback_name = originalPlayerFallbackName;
                app.state.player.gender = originalPlayerGender;
            }
            devAssert(
                ![...document.querySelectorAll("[data-image-id] button")].some((button) =>
                    /^Image info$/i.test(button.title || ""),
                ),
                "image info buttons only exist in the big image viewer, not on image cards",
            );
            devAssert(
                !!document.querySelector(
                    "[data-image-id='normal-smoke-1'] .image-preview-hitbox",
                ),
                "normal image cards expose a reliable click target for the big image viewer",
            );
            document
                .querySelector("[data-image-id='normal-smoke-1'] .image-preview-hitbox")
                ?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                document.querySelector(".image-preview-modal .image-preview-content"),
                "clicking a normal image opens the big image viewer",
            );
            document.querySelector(".image-preview-modal .image-preview-info-toggle")?.click();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const previewDetailsText = devVisibleText(
                document.querySelector(".image-preview-modal .image-preview-details"),
            );
            devAssert(
                /Seed:\s*111/i.test(previewDetailsText) &&
                    /Negative prompt/i.test(previewDetailsText) &&
                    /normal smoke negative prompt/i.test(previewDetailsText),
                "big image viewer info displays seed and saved negative prompt as separate fields",
                { previewDetailsText },
            );
            devAssert(
                imagePreviewPromptText({ prompt: "viewer prompt (seed:::45968832)" }) ===
                    "viewer prompt" &&
                    imagePreviewSeedText({ prompt: "viewer prompt (seed:::45968832)" }) ===
                        "45968832",
                "big image viewer separates embedded seed tags from the displayed positive prompt",
            );
            document
                .querySelector(".image-preview-modal button[title='Close']")
                ?.click();
            await new Promise((resolve) => setTimeout(resolve, 100));

            promoteSceneImageToProfile("Player", "normal-smoke-1");
            await devWaitFor(
                () => !!document.querySelector("[data-profile-crop-modal='1']"),
                2000,
                "normal image profile crop editor to open",
            );
            devAssert(
                /Crop Profile Image/i.test(devVisibleText(document.querySelector("[data-profile-crop-modal='1']"))),
                "using a normal image as a profile opens the square crop editor",
            );
            await devWaitFor(
                () => {
                    const img = document.querySelector("[data-profile-crop-modal='1'] [data-profile-crop-image]");
                    return !!img &&
                        img.complete &&
                        img.naturalWidth > 0 &&
                        document.querySelector("[data-profile-crop-modal='1']")?.dataset
                            ?.profileCropReady === "1" &&
                        !document.querySelector("[data-profile-crop-modal='1'] [data-profile-crop-use]")?.disabled;
                },
                5000,
                "normal image crop source to load",
            );
            document.querySelector("[data-profile-crop-modal='1'] [data-profile-crop-use]")?.click();
            await devWaitFor(
                () => {
                    const playerEntity = profileEntity("Player") || app.state.player;
                    return !!profileImagesForEntity(playerEntity).find(
                        (image) =>
                            image.source_image_id === "normal-smoke-1" &&
                            image.crop?.square === true &&
                            /data:image\/png/i.test(String(image.html || "")),
                    );
                },
                5000,
                "normal image crop to save as square profile image",
            );
            const croppedProfile = profileImagesForEntity(profileEntity("Player") || app.state.player).find(
                (image) => image.source_image_id === "normal-smoke-1",
            );
            devAssert(
                !!croppedProfile &&
                    activeProfileImage(profileEntity("Player") || app.state.player)?.id === croppedProfile.id,
                "cropped normal image becomes the active profile image",
                {
                    active: activeProfileImage(profileEntity("Player") || app.state.player)?.id,
                    cropped: croppedProfile?.id,
                },
            );
            const croppedSrc = imageSourceUrlFromHtml(croppedProfile?.html || "");
            const croppedLoaded = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () =>
                    resolve({
                        ok: true,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                    });
                img.onerror = () => resolve({ ok: false, width: 0, height: 0 });
                img.src = croppedSrc;
            });
            devAssert(
                croppedLoaded.ok &&
                    croppedLoaded.width === croppedLoaded.height &&
                    croppedLoaded.width > 0,
                "cropped profile image data is a real square image",
                croppedLoaded,
            );
            devAssert(
                ![...document.querySelectorAll("[data-profile-image-id] button")]
                    .some((button) => /upload|share/i.test(button.textContent || button.title || "")),
                "profile image cards do not expose upload/share buttons",
                [...document.querySelectorAll("[data-profile-image-id] button")]
                    .map((button) => button.textContent || button.title || ""),
            );
            devAssert(
                !/favorite\s*\/|style\s+Fantasy|style\s+Default|seed\s+\d|template-slot/i.test(
                    devVisibleText($("modalBox")),
                ),
                "profile image cards do not show metadata rows already available in the big image viewer",
                { text: devVisibleText($("modalBox")).slice(0, 1000) },
            );

            const normalFavorite = document.querySelector(
                "[data-image-id='normal-smoke-1'] .image-favorite-button",
            );
            devAssert(!!normalFavorite, "normal image favorite button renders");
            normalFavorite.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.images.find((image) => image.id === "normal-smoke-1")?.favorite === true,
                "normal image favorite toggles from image viewer",
                app.images,
            );

            const profileSelect = document.querySelector(
                "[data-profile-image-id='profile-smoke-2'] button[data-profile-action='select']",
            );
            devAssert(!!profileSelect, "alternate profile image select button renders");
            profileSelect.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.state.player.profile_image_id === "profile-smoke-2",
                "profile image select works from image viewer",
                app.state.player,
            );

            const labButton = document.querySelector(
                "[data-image-id='normal-smoke-1'] button[title='Load in Image Lab']",
            );
            devAssert(!!labButton, "normal image Load in Image Lab button renders");
            labButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            if (/Image Lab Notice/i.test($("modalBox")?.textContent || "")) {
                $("acceptImageLabWarningBtn")?.click();
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
            devAssert(
                /Image Lab/i.test($("modalBox")?.textContent || "") &&
                    $("labPrompt")?.value === "normal smoke prompt" &&
                    $("labNegative")?.value === "normal smoke negative prompt" &&
                    !!$("modalBox")?.querySelector?.(".modal-close"),
                "Load in Image Lab opens lab with selected prompt, saved negative prompt, and close button",
                {
                    labPrompt: $("labPrompt")?.value,
                    labNegative: $("labNegative")?.value,
                    text: $("modalBox")?.textContent,
                },
            );
            $("labRandomSeedBtn")?.click();
            devAssert(
                $("labSeedEnabled")?.checked === true &&
                    Number($("labSeed")?.value || 0) > 0,
                "Image Lab random seed enables fixed seed",
                { seed: $("labSeed")?.value, checked: $("labSeedEnabled")?.checked },
            );
            const normalLabOverrides =
                (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadNormalLabImageOverride = Object.prototype.hasOwnProperty.call(
                normalLabOverrides,
                "textToImagePlugin",
            );
            const previousNormalLabImageOverride =
                normalLabOverrides.textToImagePlugin;
            normalLabOverrides.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({ dataUrl: devSmokeOnePixelDataUrl() }),
            });
            try {
                const beforeNormalLabImages = (app.images || []).length;
                const beforeNormalLabImageIds = new Set(
                    (app.images || []).map((image) => String(image.id)),
                );
                $("labGenerateBtn")?.click();
                await devWaitFor(
                    () => (app.images || []).length > beforeNormalLabImages,
                    2000,
                    "Image Lab normal generation to create an image record",
                );
                const normalLabImage = (app.images || []).find(
                    (image) =>
                        !beforeNormalLabImageIds.has(String(image.id)) &&
                        image.reason === "image lab",
                );
                devAssert(
                    normalLabImage?.reason === "image lab" &&
                        normalLabImage?.profile !== true,
                    "Image Lab normal generation stores a normal image record",
                    normalLabImage,
                );
            } finally {
                if (hadNormalLabImageOverride)
                    normalLabOverrides.textToImagePlugin =
                        previousNormalLabImageOverride;
                else delete normalLabOverrides.textToImagePlugin;
            }

            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !$("modal")?.classList.contains("open"),
                "Escape closes Image Lab without needing another window action",
            );
            const profileLabOverrides =
                (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadProfileLabImageOverride = Object.prototype.hasOwnProperty.call(
                profileLabOverrides,
                "textToImagePlugin",
            );
            const previousProfileLabImageOverride =
                profileLabOverrides.textToImagePlugin;
            profileLabOverrides.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({ dataUrl: devSmokeOnePixelDataUrl() }),
            });
            try {
                loadProfileImageInLab("Player", "profile-smoke-2");
                await new Promise((resolve) => setTimeout(resolve, 100));
                if (/Image Lab Notice/i.test($("modalBox")?.textContent || "")) {
                    $("acceptImageLabWarningBtn")?.click();
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                devAssert(
                    $("labPortraitMode")?.checked === true &&
                        $("labCharacter")?.value === "Player",
                    "loading a profile image in Image Lab selects profile mode and its character",
                    {
                        portrait: $("labPortraitMode")?.checked,
                        character: $("labCharacter")?.value,
                    },
                );
                const beforeProfileLabImages = profileImagesForEntity(app.state.player || {}).length;
                const beforeProfileLabNormalImages = (app.images || []).length;
                $("labGenerateBtn")?.click();
                await devWaitFor(
                    () =>
                        profileImagesForEntity(app.state.player || {}).some(
                            (image) =>
                                image.source === "image lab" &&
                                image.pending === false &&
                                !image.error &&
                                devLooksLikeRealImageHtml(image.html),
                        ),
                    2000,
                    "Image Lab profile generation to finish a profile image record",
                );
                const profileLabImages = profileImagesForEntity(app.state.player || {});
                devAssert(
                    profileLabImages.some(
                        (image) =>
                            image.source === "image lab" &&
                            image.pending === false &&
                            !image.error &&
                            devLooksLikeRealImageHtml(image.html),
                    ) &&
                        (app.images || []).length === beforeProfileLabNormalImages,
                    "Image Lab profile generation stores a profile image without creating a normal image",
                    {
                        profileImages: profileLabImages,
                        normalImageCount: (app.images || []).length,
                    },
                );
            } finally {
                if (hadProfileLabImageOverride)
                    profileLabOverrides.textToImagePlugin =
                        previousProfileLabImageOverride;
                else delete profileLabOverrides.textToImagePlugin;
            }
            addMessage("system", "Image viewer and lab smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: image-viewer-lab-smoke");
        }

        async function devRunStorySurfacesSmokeTest() {
            devTestLog("Scenario start: story-surfaces-smoke");
            devResetForLiveTest("story-surfaces-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic story-surface state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Story Surface Smoke",
                    },
                    default_image_model: "cinematic",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Story Tester",
                    age: 24,
                    gender: "male",
                    role: "objective auditor",
                    known_facts: ["Started a story surface smoke test."],
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Standing at the clockwork gate.",
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                objectives: {
                    active_id: "main-gate",
                    focus_id: "",
                    suggestions: [
                        {
                            id: "suggestion-market",
                            title: "Investigate the brass market",
                            reason: "Recent scene mentioned a suspicious merchant.",
                        },
                    ],
                    items: [
                        {
                            id: "main-gate",
                            title: "Inspect the Clockwork Gate Lock",
                            type: "story",
                            status: "active",
                            summary: "Find a way through the sealed gate.",
                            objective: "Inspect the lock.",
                            steps: [{ text: "Inspect the lock", status: "active" }],
                            notes: ["The gate hums."],
                            rewards: [],
                        },
                        {
                            id: "main-gate-gear",
                            title: "Find the Missing Gear",
                            type: "story",
                            status: "queued",
                            summary: "Find a way through the sealed gate.",
                            objective: "Find the missing gear.",
                            steps: [{ text: "Find the missing gear", status: "queued" }],
                            notes: ["The gate hums."],
                            rewards: [],
                        },
                        {
                            id: "side-lantern",
                            title: "Repair the Lantern",
                            type: "side",
                            status: "active",
                            summary: "Fix the travel lantern.",
                            objective: "Find a wick.",
                            steps: [{ text: "Buy a wick", status: "active" }],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },


                world_map: {
                    current_location_id: "gate-plaza",
                    focus_location_id: "gate-plaza",
                    travel_history: [],
                    locations: {
                        "gate-plaza": {
                            id: "gate-plaza",
                            name: "Gate Plaza",
                            type: "plaza",
                            scale: "site",
                            parent_id: "",
                            x: 35,
                            y: 50,
                            discovered: true,
                            travel_enabled: true,
                            summary: "A plaza before the sealed gate.",
                            detail: {
                                settlement_name: "Brassfall",
                                specific_place: "Gate Plaza",
                            },
                            connections: ["market-lane"],
                            tags: ["public"],
                        },
                        "market-lane": {
                            id: "market-lane",
                            name: "Market Lane",
                            type: "street",
                            scale: "site",
                            parent_id: "",
                            x: 65,
                            y: 50,
                            discovered: true,
                            travel_enabled: true,
                            summary: "A narrow lane of stalls.",
                            detail: {
                                settlement_name: "Brassfall",
                                specific_place: "Market Lane",
                            },
                            connections: ["gate-plaza"],
                            tags: ["market"],
                        },
                    },
                },
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Story surfaces smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            await devCompileCurrentStoryFixture("story-surfaces-smoke");
            scheduleActiveGameSave();
            render();

            openObjectivePickerModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Objectives/i.test($("modalBox")?.textContent || "") &&
                    /Repair the Lantern/i.test($("modalBox")?.textContent || ""),
                "objective picker shows main and side objectives",
            );
            setObjectiveFocus("side-lantern");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.state.objectives.focus_id === "side-lantern" &&
                    currentObjectiveTarget()?.id === "side-lantern",
                "side objective selection becomes current objective",
                selectedObjectiveRuntime(app.state),
            );

            openObjectivePickerModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            acceptObjectiveSuggestion("suggestion-market");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.state.objectives.focus_id === "investigate-the-brass-market" &&
                    app.state.objectives.items.some(
                        (item) => item.id === "investigate-the-brass-market",
                    ) &&
                    !(app.state.objectives.suggestions || []).some(
                        (item) => item.id === "suggestion-market",
                    ),
                "objective suggestion accept creates and selects side objective",
                app.state.objectives,
            );

            openMapModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Locations Map/i.test($("modalBox")?.textContent || "") &&
                    /Gate Plaza/i.test($("modalBox")?.textContent || ""),
                "map modal opens with current map nodes",
            );
            openMapLocationEditor("gate-plaza");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(!!$("mapLocName"), "map add-location editor opens");
            $("mapLocName").value = "Clocktower Room";
            $("mapLocType").value = "room";
            $("mapLocScale").value = "site";
            $("mapLocSummary").value = "A room full of ticking gears.";
            saveMapLocationFromEditor("", { close: true, snapshot: true });
            await new Promise((resolve) => setTimeout(resolve, 150));
            const addedMapNode = Object.values(
                app.state.world_map.locations || {},
            ).find((node) => node.name === "Clocktower Room");
            const parentMapNode = Object.values(
                app.state.world_map.locations || {},
            ).find((node) => node.name === "Gate Plaza");
            devAssert(
                !!addedMapNode &&
                    !!parentMapNode &&
                    addedMapNode.parent_id === parentMapNode.id,
                "map add-location editor saves new child location",
                { addedMapNode, parentMapNode },
            );

            closeModal();
            addMessage("system", "Story surfaces smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: story-surfaces-smoke");
        }

        async function devRunStoryLibraryUiSmokeTest() {
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            devTestLog("Scenario start: story-library-ui-smoke");
            devResetForLiveTest("story-library-ui-smoke");
            devCreateTestProfile({  });
            const originalGenerateImageHtml = generateImageHtml;
            const originalCopyStoryTitleCardDefaultImageIfAvailable =
                copyStoryTitleCardDefaultImageIfAvailable;
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalWindowFetch = window.fetch;
            const originalShowConfirm = showConfirm;
            const originalSelectedCreatorIdentity = selectedCreatorIdentity;
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalSupabaseUrl = app.settings.publicLibrarySupabaseUrl;
            const originalSupabaseAnonKey = app.settings.publicLibrarySupabaseAnonKey;
            const originalSearchCache = app.publicLibrarySearchCache
                ? clone(app.publicLibrarySearchCache)
                : null;
            const originalSearchCacheLoaded = app.publicLibrarySearchCacheLoaded;
            const originalSuppressStoryLibraryTitleCardAutoQueue =
                app.suppressStoryLibraryTitleCardAutoQueue;
            const storyTitleCardImageCalls = [];
            try {
                await devCleanupSmokeStoryLibraryArtifacts(
                    "stale story library smoke artifacts cleaned",
                );
                await devCleanupSmokeStoryTitleCardArtifacts(
                    "stale story library smoke title-card artifacts cleaned",
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(STORY_TEMPLATE_KEY)}`,
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(STORY_TITLE_CARD_IMAGE_KEY)}`,
                );
                selectedCreatorIdentity = () => ({
                    creator_id: "00000000-0000-4000-8000-000000000029",
                    creator_name: "Story Library Smoke Creator",
                });
                app.suppressStoryLibraryTitleCardAutoQueue = true;
                app.settings.publicLibrarySupabaseUrl = "https://story-library-smoke.supabase.co";
                app.settings.publicLibrarySupabaseAnonKey = "story-library-smoke-anon";
                app.supabaseSession = {
                    access_token: "story-library-smoke-token",
                    user: {
                        id: "story-library-smoke-user",
                        email: "story-smoke@example.com",
                        user_metadata: { name: "story-smoke@example.com" },
                    },
                };
                window.fetch = async (url, options = {}) => {
                    const textUrl = String(url || "");
                    if (
                        textUrl.includes("/rest/v1/library_items?select=id") &&
                        textUrl.includes("visibility=eq.public") &&
                        textUrl.includes("type=eq.story")
                    ) {
                        return {
                            ok: true,
                            status: 200,
                            headers: { get: (name) => String(name || "").toLowerCase() === "content-range" ? "0-0/1" : "" },
                            text: async () => "[]",
                        };
                    }
                    return originalWindowFetch.call(window, url, options);
                };
                generateImageHtml = async (prompt, negativePrompt, seed, model, options = {}) => {
                    storyTitleCardImageCalls.push({ prompt, negativePrompt, seed, model, options });
                    if (
                        options?.promptType === "story title card image" &&
                        typeof options.onIframe === "function"
                    ) {
                        options.onIframe(
                            `<iframe title="Story title-card smoke pending"></iframe>`,
                            null,
                        );
                        const pendingStoryId =
                            options?.promptEditorReplay?.storyId ||
                            "story-library-ui-smoke-template";
                        const pendingTemplate = storyTemplateById(pendingStoryId);
                        const pendingActiveId = storyTitleCardActiveId(pendingTemplate);
                        const firstPendingImage = storyTitleCardImages(pendingTemplate)[0];
                        devAssert(
                            !!pendingActiveId &&
                                String(firstPendingImage?.id || "") === String(pendingActiveId) &&
                                firstPendingImage?.pending === true,
                            "story title-card generation makes the new pending image active immediately",
                            {
                                pendingActiveId,
                                firstPendingImage,
                                titleCard: pendingTemplate?.title_card_image,
                            },
                        );
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                    return `<img alt="mock story title card" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" data-prompt="${escapeHtml(prompt)}" data-seed="${escapeHtml(seed)}" data-model="${escapeHtml(model)}">`;
                };
                const unsafeStoryTitleCard = createStoryTitleCardHistoryRecord({
                    id: "unsafe-story-title-card-smoke",
                    title: "Unsafe Story Title Card Smoke",
                    prompt: "Unsafe story title card smoke.",
                    negative_prompt: "",
                    seed: 0,
                    model: "fantasy-rpg",
                    source: "generated",
                    favorite: false,
                    html: "<scr" + "ipt>window.__bad=1</scr" + "ipt><img src=x onerror=\"window.__bad=1\">",
                    pending: false,
                    error: "",
                });
                devAssert(
                    unsafeStoryTitleCard && !unsafeStoryTitleCard.html && !unsafeStoryTitleCard.url,
                    "unsafe story title-card image HTML is rejected instead of persisted",
                    unsafeStoryTitleCard,
                );
                const storyLibrarySmokeImageUrl = devSmokeOnePixelDataUrl();
                const ownedStorySmokeItems = Array.from({ length: 51 }, (_, index) => devSmokeSupabasePublicItemRow({
                    id: `owned-story-library-ui-smoke-${index + 1}`,
                    type: "story",
                    definition_id: `owned-story-library-ui-smoke-definition-${index + 1}`,
                    title: index === 50 ? "Owned Story Missing Image Smoke" : `Owned Story Library UI Smoke ${index + 1}`,
                    description: "Owned public story search result.",
                    creator: "story-smoke@example.com",
                    creator_id: "00000000-0000-4000-8000-000000000029",
                    source: "Original",
                    creation_tool: "debug harness",
                    genres: ["fantasy"],
                    visibility: "public",
                    current_version_id: `owned-story-library-ui-smoke-version-${index + 1}`,
                    owner_user_id: "story-library-smoke-user",
                    updated_at: new Date().toISOString(),
                }));
                const ownedStorySmokeVersions = ownedStorySmokeItems.map((item, index) => devSmokeSupabasePublicVersionRow({
                    id: item.current_version_id,
                    item_id: item.id,
                    version_number: 1,
                    payload_url: `https://example.com/${item.id}.json.gz`,
                    image_url: index === 50 ? "" : storyLibrarySmokeImageUrl,
                    created_at: new Date().toISOString(),
                }));
                publicLibraryFetch = async (path, options = {}) => {
                    if (path === "/rest/v1/rpc/search_public_library_items" && options.method === "POST") {
                        return [devSmokeSupabasePublicSearchRow({
                            id: "public-story-library-ui-smoke",
                            type: "story",
                            definition_id: "public-story-library-ui-smoke-definition",
                            title: "Public Story Library UI Smoke",
                            description: "Public story search result.",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            source: "Original",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            rating_total: 9,
                            rating_count: 1,
                            rating_average: 9,
                            current_version_id: "public-story-library-ui-smoke-version",
                            payload_url: "https://example.com/public-story-library-ui-smoke.json.gz",
                            image_url: storyLibrarySmokeImageUrl,
                            ordering_value: "public story library ui smoke",
                            updated_at: new Date().toISOString(),
                        })];
                    }
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        path.includes("&owner_user_id=eq.story-library-smoke-user")
                    ) {
                        const offsetMatch = path.match(/offset=(\d+)/);
                        const offset = offsetMatch ? Number(offsetMatch[1]) || 0 : 0;
                        return ownedStorySmokeItems.slice(offset, offset + 50);
                    }
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        path.includes("&visibility=eq.public")
                    ) {
                        return [
                            devSmokeSupabasePublicItemRow({
                                id: "public-story-library-ui-smoke",
                                type: "story",
                                definition_id: "public-story-library-ui-smoke-definition",
                                title: "Public Story Library UI Smoke",
                                description: "Public story search result.",
                                creator: "debug harness",
                                creator_id: "00000000-0000-4000-8000-000000000001",
                                source: "Smoke Source",
                                creation_tool: "debug harness",
                                genres: ["fantasy"],
                                visibility: "public",
                                current_version_id: "public-story-library-ui-smoke-version",
                                updated_at: new Date().toISOString(),
                            }),
                        ];
                    }
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes("&id=in.")
                    ) {
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "public-story-library-ui-smoke-version",
                                item_id: "public-story-library-ui-smoke",
                                version_number: 1,
                                payload_url: "https://example.com/public-story-library-ui-smoke.json.gz",
                                image_url: storyLibrarySmokeImageUrl,
                                created_at: new Date().toISOString(),
                            }),
                            ...ownedStorySmokeVersions,
                        ];
                    }
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected Story Library UI smoke public fetch: ${path}`);
                };
                const story = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-template",
                    title: "Story Library UI Smoke",
                    description: "A smoke story for the redesigned story library.",
                    genres: ["fantasy", "adventure"],
                    source: "Player",
                    title_card_subjects: ["Smoke Queen", "moonlit castle gate"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                const secondStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-template-2",
                    title: "Story Library UI Smoke Second",
                    description: "A second visible local story that should receive the next queued title card.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                {
                    const currentShapeStory = devSmokeTemplateRecord({lite: true,
                        id: "story-library-ui-smoke-current-shape",
                        title: "Story Library UI Smoke Current Shape",
                        state: repairAiGeneratedState({
                            ...clone(defaultState),
                            player: devSmokeRuntimeCharacter("Current Shape Player"),
                            location: {
                                ...clone(defaultState.location || {}),
                                npc_location_id: "smoke-place",
                                specific_place: "Smoke Place",
                            },
                            players: [
                                devSmokeRuntimeCharacter("Smoke Player One"),
                                devSmokeRuntimeCharacter("Smoke Player Two"),
                            ],
                            characters: {
                                "Smoke Ally": devSmokeRuntimeCharacter("Smoke Ally"),
                            },
                            npc_directory: {
                                locations: {
                                    "smoke-place": {
                                        label: "Smoke Place",
                                        characters: {
                                            "Smoke Guide": {
                                                id: "smoke-guide",
                                                name: "Smoke Guide",
                                                age: 28,
                                                gender: "female",
                                                role: "guide",
                                                full_character:
                                                    devSmokeRuntimeCharacter("Smoke Guide"),
                                            },
                                        },
                                    },
                                },
                            },
                            objectives: {
                                active_id: "main-one",
                                focus_id: "main-one",
                                items: [
                                    {
                                        id: "main-one",
                                        title: "Main One",
                                        type: "story",
                                        status: "active",
                                        summary: "Verify main count.",
                                        while_active_guidance: "Keep the smoke focused on the main objective count.",
                                        completion_control: "player",
                                        completion_criteria: "Complete the main objective count check.",
                                        rewards: [],
                                    },
                                    {
                                        id: "side-one",
                                        title: "Side One",
                                        type: "side",
                                        status: "available",
                                        summary: "Verify side count.",
                                        while_active_guidance: "Keep the smoke focused on the side objective count.",
                                        completion_control: "player",
                                        completion_criteria: "Complete the side objective count check.",
                                        rewards: [],
                                    },
                                ],
                            },
                            future_cast: {
                                enabled: true,
                                items: {
                                    "future-one": {
                                        id: "future-one",
                                        name: "Future One",
                                        status: "locked",
                                    },
                                },
                            },
                        }),
                    });
                    const currentShapeExtra = publicLibraryStoryExtraMetadata(currentShapeStory);
                    devAssert(
                        currentShapeExtra.player_select === true &&
                            currentShapeExtra.player_option_count === 2 &&
                            currentShapeExtra.main_objective_count === 1 &&
                            currentShapeExtra.side_objective_count === 1 &&
                            currentShapeExtra.future_character_count === 1 &&
                            currentShapeExtra.starting_party_member_count === 1 &&
                            currentShapeExtra.starting_npc_count === 1,
                        "Story Library definition metadata counts current story-template state shape",
                        currentShapeExtra,
                    );
                    const currentShapeInfo = storyLibraryInfoHtml(currentShapeStory);
                    devAssert(
                        /Player select[\s\S]*2 options/i.test(currentShapeInfo) &&
                            /Main objectives[\s\S]*1/i.test(currentShapeInfo) &&
                            /Side objectives[\s\S]*1/i.test(currentShapeInfo) &&
                            /Future characters[\s\S]*1/i.test(currentShapeInfo) &&
                            /Starting party members[\s\S]*1/i.test(currentShapeInfo) &&
                            /Starting NPCs[\s\S]*1/i.test(currentShapeInfo) &&
                            !/Starting characters/i.test(currentShapeInfo) &&
                            !/Sexual preferences/i.test(currentShapeInfo),
                        "Story Definition info displays current counts",
                        { currentShapeInfo },
                    );
                }
                devUpsertStoryTemplatesForSmoke([story, secondStory]);
                openStoryTemplateLibrary({ tab: "public" });
                await new Promise((resolve) => setTimeout(resolve, 150));
                devAssert(
                    $("modalBox")?.matches?.("[data-story-library-modal='1'][data-fullscreen-list-modal='1']") &&
                        !!$("modalBox")?.querySelector?.("[data-library-home][data-library-type='story']") &&
                        !!document.querySelector("[data-library-source='public'].active"),
                    "story library opens as the full-screen merged library with Public selected",
                    { modalText: ($("modalBox")?.textContent || "").slice(0, 240) },
                );
                devAssert(
                    !!document.querySelector(".library-header-actions button[title='Create story']") &&
                        !/Make New Story/i.test($("modalBox")?.textContent || ""),
                    "merged Story Library exposes its Create action and not the old in-flow Make New Story action",
                );
                devAssert(
                    !!document.querySelector(".library-header-actions button[title='Create story']"),
                    "Story Library header contains a Create Story button",
                );
                devAssert(
                    ![...document.querySelectorAll(".library-header-actions button")].some((button) =>
                        /^Account$/i.test((button.textContent || "").trim()),
                    ),
                    "Story Library header does not expose an Account button",
                );
                switchUnifiedLibraryTab("mine");
                await refreshStoryLibraryOwnedPublicStories();
                await devWaitFor(
                    () =>
                        /Owned Story Library UI Smoke 1/i.test(
                            document.querySelector("[data-story-library-published-results='mine']")?.textContent || "",
                        ) &&
                        /Owned Story Missing Image Smoke/i.test(
                            document.querySelector("[data-story-library-published-results='mine']")?.textContent || "",
                        ),
                    3000,
                    "Published Stories action to fetch signed-in owned public stories",
                );
                devAssert(
                    /Owned Story Library UI Smoke 1/i.test(
                        document.querySelector("[data-story-library-published-results='mine']")?.textContent || "",
                    ) &&
                        /Owned Story Missing Image Smoke/i.test(
                            document.querySelector("[data-story-library-published-results='mine']")?.textContent || "",
                        ) &&
                        document.querySelectorAll("[data-story-library-published-results='mine'] [data-story-library-card]").length === 51,
                    "Mine renders all signed-in published story cards in its Published section and does not hide missing-image entries",
                    {
                        resultsText:
                            document.querySelector("[data-story-library-published-results='mine']")?.textContent || "",
                        publishedCount: document.querySelectorAll("[data-story-library-published-results='mine'] [data-story-library-card]").length,
                    },
                );
                const ownedStoryCard = document.querySelector(
                    "[data-story-library-published-results='mine'] [data-story-library-card]",
                );
                const ownedStoryActionHost = document.createElement("div");
                ownedStoryActionHost.innerHTML = ownedPublicLibraryDetailActionsHtml(
                    ownedStorySmokeItems[0],
                );
                const ownedStoryActions = [
                    ...(ownedStoryActionHost.querySelectorAll?.(
                        "[data-owned-public-detail-action]",
                    ) || []),
                ].map((button) => (button.textContent || "").trim());
                showPublicLibraryUpdateInstructions(
                    ownedStorySmokeItems[0].id,
                );
                const storyUpdateNotice = [
                    ...document.querySelectorAll(".popup-modal.open"),
                ].at(-1);
                devAssert(
                    !ownedStoryCard?.querySelector?.(
                        "[data-owned-public-detail-action]",
                    ) &&
                        ownedStoryActions.includes("Update") &&
                        ownedStoryActions.includes("Manage") &&
                        !ownedStoryActions.includes("Hide / Unpublish") &&
                        /use the Publish button/i.test(
                            storyUpdateNotice?.textContent || "",
                        ) &&
                        /default one/i.test(
                            storyUpdateNotice?.textContent || "",
                        ),
                    "owned published story detail panels expose update guidance and management controls while cards remain action-free",
                    {
                        ownedStoryActions,
                        updateNotice: storyUpdateNotice?.textContent || "",
                    },
                );
                storyUpdateNotice?.remove();
                document.querySelector(".library-header-actions button[title='Create story']")?.click();
                await devWaitFor(
                    () =>
                        !!document.querySelector("[data-story-creation-choice='1']") &&
                        /Create New Story/i.test(document.querySelector("[data-story-creation-choice='1']")?.textContent || ""),
                    3000,
                    "Create Story chooser to open",
                );
                devAssert(
                    /Create in Ember Adventures/i.test(document.querySelector("[data-story-creation-choice='1']")?.textContent || "") &&
                        /Use ChatGPT/i.test(document.querySelector("[data-story-creation-choice='1']")?.textContent || "") &&
                        /Use Codex/i.test(document.querySelector("[data-story-creation-choice='1']")?.textContent || ""),
                    "Create Story opens the story creation choice panel with in-game, ChatGPT, and Codex options",
                );
                document.querySelector("[data-story-creation-choice='1'] [data-story-creation-manual]")?.click();
                await devWaitFor(
                    () =>
                        !!app.storyBuilder &&
                        !$("storyBuilderOverlay")?.classList?.contains("hidden"),
                    3000,
                    "manual Story Builder to open from Create Story chooser",
                );
                devAssert(
                    !$("storyBuilderOverlay")?.classList?.contains("hidden") &&
                        /Use AI to Create Story/i.test($("storyBuilderOverlay")?.textContent || "") &&
                        $("storyBuilderHeaderTitle")?.value === "New Story",
                    "Create in Ember Adventures opens the manual Story Builder with an explicit AI creation option",
                );
                setStoryBuilderPanel("images");
                await new Promise((resolve) => setTimeout(resolve, 100));

                cleanupSmokeScenarioUi();
                openStoryTemplateLibrary({ tab: "local" });
                await new Promise((resolve) => setTimeout(resolve, 100));
                openStoryTemplateLibrary();
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    storyLibraryActiveTab() === "local" &&
                        /\d+ stor(?:y|ies) of \d+ total/i.test($("storyLibrarySearchCount-local")?.textContent || ""),
                    "story library preserves the active Local tab and shows visible-of-total counts when reopened",
                    {
                        activeTab: storyLibraryActiveTab(),
                        count: $("storyLibrarySearchCount-local")?.textContent || "",
                    },
                );
                const importedTabStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-import-tab-preserve",
                    title: "Story Library Import Tab Preserve",
                    description: "A smoke story for import tab preservation.",
                    genres: ["fantasy"],
                });
                const importedTabRecord = await importStoryTemplatePayload(
                    storyExportPayloadFromDefinition(importedTabStory),
                    { showNotice: false, persist: false },
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    storyLibraryActiveTab() === "local" &&
                        /Story Library Import Tab Preserve/i.test(
                            document.querySelector("[data-story-library-results='local']")?.textContent || "",
                        ),
                    "story import refresh preserves the active Local tab",
                    {
                        activeTab: storyLibraryActiveTab(),
                        localText:
                            document.querySelector("[data-story-library-results='local']")?.textContent || "",
                    },
                );
                const storyCountBeforeDuplicateImport = (app.storyTemplates || []).length;
                const duplicateImportRecord = await importStoryTemplatePayload(
                    storyExportPayloadFromDefinition(clone(importedTabStory)),
                    { showNotice: false, persist: false, openLibrary: false },
                );
                devAssert(
                    duplicateImportRecord?.id === importedTabRecord?.id &&
                        (app.storyTemplates || []).length === storyCountBeforeDuplicateImport,
                    "story import recognizes the same stable story ID and does not create a duplicate local story",
                );
                const importedExistingImageStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-import-existing-image",
                    title: "Story Library Import Existing Image",
                    description: "A smoke story whose imported image must remain active.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                copyStoryTitleCardDefaultImageIfAvailable = async (
                    template,
                    reason,
                ) => {
                    if (template?.id !== importedExistingImageStory.id)
                        return originalCopyStoryTitleCardDefaultImageIfAvailable(
                            template,
                            reason,
                        );
                    await new Promise((resolve) => setTimeout(resolve, 150));
                    return !!rememberStoryTitleCardImage(
                        template.id,
                        {
                            id: "story-library-ui-smoke-import-existing-image-card",
                            source: "restored existing image",
                            reason,
                            title: "Story Library Import Existing Image title card",
                            prompt: "Existing imported story image.",
                            negativePrompt: "",
                            seed: 0,
                            model: "fantasy-rpg",
                            html: `<img alt="existing imported story image" src="${devSmokeOnePixelDataUrl()}">`,
                            url: "",
                            hosted_url: "",
                            favorite: false,
                            pending: false,
                            error: "",
                        },
                        { setActive: true },
                    );
                };
                const imageCallsBeforeExistingImageImport = storyTitleCardImageCalls.length;
                const importedExistingImageRecord = await importStoryTemplatePayload(
                    storyExportPayloadFromDefinition(importedExistingImageStory),
                    { showNotice: false, persist: false },
                );
                devAssert(
                    storyTitleCardImportIsPreparing(importedExistingImageRecord?.id),
                    "story import marks an existing image as preparing before exposing the story to the local-library auto queue",
                );
                document
                    .querySelectorAll(
                        '[data-story-library-tab-panel="local"] [data-story-library-card]',
                    )
                    .forEach((card) => {
                        card.style.display =
                            card.dataset.storyLibraryId ===
                            importedExistingImageRecord?.id
                                ? ""
                                : "none";
                    });
                app.suppressStoryLibraryTitleCardAutoQueue = false;
                const queuedReplacementForImportedImage =
                    queueFirstVisibleStoryLibraryMissingTitleCard();
                devAssert(
                    queuedReplacementForImportedImage === false &&
                        storyTitleCardImageCalls.length === imageCallsBeforeExistingImageImport,
                    "story import does not auto-generate a replacement while its existing image is being restored",
                    {
                        queuedReplacementForImportedImage,
                        imageCallCount: storyTitleCardImageCalls.length,
                        preparing: storyTitleCardImportIsPreparing(
                            importedExistingImageRecord?.id,
                        ),
                    },
                );
                await devWaitFor(
                    () =>
                        !storyTitleCardImportIsPreparing(importedExistingImageRecord?.id) &&
                        !!storyTemplateTitleCardSrc(
                            storyTemplateById(importedExistingImageRecord?.id),
                        ),
                    3000,
                    "imported existing story image to finish restoring",
                );
                const importedExistingImageAfterRestore = storyTemplateById(
                    importedExistingImageRecord?.id,
                );
                devAssert(
                    storyTitleCardActiveId(importedExistingImageAfterRestore) ===
                        "story-library-ui-smoke-import-existing-image-card" &&
                        storyTitleCardImageCalls.length === imageCallsBeforeExistingImageImport,
                    "story import keeps the existing image active and never requests a replacement image",
                    {
                        activeImageId: storyTitleCardActiveId(
                            importedExistingImageAfterRestore,
                        ),
                        imageCallCount: storyTitleCardImageCalls.length,
                        imageHistory: storyTitleCardImages(
                            importedExistingImageAfterRestore,
                        ).map((image) => image.id),
                    },
                );
                const preexistingStoredImageStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-preexisting-stored-image",
                    title: "Story Library Preexisting Stored Image",
                    description: "A smoke story with an image already in the local image store.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                app.storyTitleCardImages.push(
                    storyTitleCardOwnedImageRecord(preexistingStoredImageStory, {
                        id: "story-library-ui-smoke-preexisting-stored-card",
                        source: "already stored",
                        reason: "preexisting stored story image",
                        title: "Story Library Preexisting Stored Image title card",
                        prompt: "Preexisting stored story image.",
                        negativePrompt: "",
                        seed: 0,
                        model: "fantasy-rpg",
                        html: `<img alt="preexisting stored story image" src="${devSmokeOnePixelDataUrl()}">`,
                        url: "",
                        hosted_url: "",
                        favorite: false,
                        pending: false,
                        error: "",
                    }),
                );
                const imageCallsBeforePreexistingStoredImport = storyTitleCardImageCalls.length;
                const importedPreexistingStoredImage = await importStoryTemplatePayload(
                    storyExportPayloadFromDefinition(preexistingStoredImageStory),
                    { showNotice: false, persist: false, openLibrary: false },
                );
                await devWaitFor(
                    () =>
                        !storyTitleCardImportIsPreparing(importedPreexistingStoredImage?.id) &&
                        storyTitleCardActiveId(
                            storyTemplateById(importedPreexistingStoredImage?.id),
                        ) === "story-library-ui-smoke-preexisting-stored-card",
                    3000,
                    "preexisting stored story image to be adopted before generation",
                );
                const preexistingStoredAfterImport = storyTemplateById(
                    importedPreexistingStoredImage?.id,
                );
                devAssert(
                    storyTitleCardActiveId(preexistingStoredAfterImport) ===
                        "story-library-ui-smoke-preexisting-stored-card" &&
                        storyTitleCardImageCalls.length === imageCallsBeforePreexistingStoredImport,
                    "story import adopts an already stored image before checking for generation and never requests a new image",
                    {
                        activeImageId: storyTitleCardActiveId(preexistingStoredAfterImport),
                        imageCallCount: storyTitleCardImageCalls.length,
                    },
                );
                await saveStoryTitleCardChanges(preexistingStoredAfterImport, [
                    {
                        ...storyTitleCardImageById(
                            preexistingStoredAfterImport,
                            "story-library-ui-smoke-preexisting-stored-card",
                        ),
                        source: "generated before story deletion",
                    },
                ]);
                await flushLargeSaves();
                const persistedStoryImagesBeforeDelete = await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    [],
                );
                const persistedStoryImageBeforeDelete =
                    persistedStoryImagesBeforeDelete.find(
                        (image) =>
                            image.id ===
                            "story-library-ui-smoke-preexisting-stored-card",
                    );
                devAssert(
                    persistedStoryImageBeforeDelete?.story_key ===
                        storyTitleCardStoreKey(preexistingStoredAfterImport) &&
                        persistedStoryImageBeforeDelete?.story_id ===
                            preexistingStoredAfterImport.id,
                    "story image save persists stable ownership metadata needed for delete and reimport reuse",
                    { persistedStoryImageBeforeDelete },
                );
                app.suppressStoryLibraryTitleCardAutoQueue = true;
                showConfirm = async () => true;
                await deleteStoryTemplate(
                    importedExistingImageRecord?.id || importedExistingImageStory.id,
                );
                await deleteStoryTemplate(
                    importedPreexistingStoredImage?.id || preexistingStoredImageStory.id,
                );
                await deleteStoryTemplate(importedTabRecord?.id || importedTabStory.id);
                await flushLargeSaves();
                app.storyTitleCardImages = (app.storyTitleCardImages || []).filter(
                    (image) =>
                        image.id !==
                        "story-library-ui-smoke-preexisting-stored-card",
                );
                const reimportStoredStoryImagesAfterDelete = await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    [],
                );
                const reimportStoredStoryImageAfterDelete =
                    reimportStoredStoryImagesAfterDelete.find(
                        (image) =>
                            image.id ===
                            "story-library-ui-smoke-preexisting-stored-card",
                    );
                devAssert(
                    !!reimportStoredStoryImageAfterDelete,
                    "deleting a story leaves its independently stored title-card image available for reimport",
                );
                app.storyTitleCardImages = [
                    ...new Map(
                        [
                            ...exactStoryTitleCardImageStore(
                                app.storyTitleCardImages || [],
                            ),
                            ...exactStoryTitleCardImageStore(
                                reimportStoredStoryImagesAfterDelete,
                            ),
                        ].map((image) => [
                            libraryRecordStorageId(
                                STORY_TITLE_CARD_IMAGE_KEY,
                                image,
                            ),
                            image,
                        ]),
                    ).values(),
                ];
                const imageCallsBeforeDeletedStoryReimport =
                    storyTitleCardImageCalls.length;
                const reimportedDeletedStory = await importStoryTemplatePayload(
                    storyExportPayloadFromDefinition(clone(preexistingStoredImageStory)),
                    { showNotice: false, persist: false, openLibrary: false },
                );
                try {
                    await devWaitFor(
                        () =>
                            !storyTitleCardImportIsPreparing(
                                reimportedDeletedStory?.id,
                            ) &&
                            storyTitleCardActiveId(
                                storyTemplateById(reimportedDeletedStory?.id),
                            ) ===
                                "story-library-ui-smoke-preexisting-stored-card",
                        3000,
                        "deleted story reimport to reconnect its persisted title-card image",
                    );
                }
                catch (error) {
                    const current = storyTemplateById(reimportedDeletedStory?.id);
                    throw new Error(
                        `${error?.message || error} Reimport diagnostics: ${JSON.stringify({
                            returnedId: reimportedDeletedStory?.id || "",
                            currentId: current?.id || "",
                            preparing: storyTitleCardImportIsPreparing(reimportedDeletedStory?.id),
                            importError:
                                app.storyTitleCardImportErrors?.[
                                    reimportedDeletedStory?.id
                                ] || "",
                            activeImageId: storyTitleCardActiveId(current),
                            matchingImages: storyTitleCardImages(current).map((image) => ({
                                id: image.id,
                                storyKey: image.story_key,
                                storyId: image.story_id,
                                finished: profileImageIsFinished(image),
                            })),
                        })}`,
                    );
                }
                devAssert(
                    storyTitleCardImageCalls.length ===
                        imageCallsBeforeDeletedStoryReimport,
                    "reimporting a deleted story reconnects its persisted title-card image without requesting generation",
                    {
                        activeImageId: storyTitleCardActiveId(
                            storyTemplateById(reimportedDeletedStory?.id),
                        ),
                        imageCallCount: storyTitleCardImageCalls.length,
                    },
                );
                await deleteStoryTemplate(reimportedDeletedStory?.id);
                await deletePerRecordLibraryRecords(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    [{
                        id: libraryRecordStorageId(
                            STORY_TITLE_CARD_IMAGE_KEY,
                            reimportStoredStoryImageAfterDelete,
                        ),
                    }],
                );
                app.storyTitleCardImages = (app.storyTitleCardImages || []).filter(
                    (image) =>
                        image.id !==
                        "story-library-ui-smoke-preexisting-stored-card",
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                openStoryTemplateLibrary();
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    storyLibraryActiveTab() === "local" &&
                        !/Story Library Import Tab Preserve/i.test(
                            document.querySelector("[data-story-library-results='local']")?.textContent || "",
                        ),
                    "story delete refresh preserves the active Local tab",
                    {
                        activeTab: storyLibraryActiveTab(),
                        localText:
                            document.querySelector("[data-story-library-results='local']")?.textContent || "",
                    },
                );
                showConfirm = originalShowConfirm;
                app.storyTitleCardGenerating = new Set(["stale-story-title-card"]);
                switchStoryLibraryTab("local");
            await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    !storyTitleCardIsGenerating("stale-story-title-card"),
                    "story library clears stale title-card generation state before queueing local story images",
                );
                const localCard = document.querySelector(
                    "[data-story-library-id='story-library-ui-smoke-template']",
                );
                devAssert(
                    !!localCard &&
                        /Story Library UI Smoke/i.test(localCard.textContent || "") &&
                        /Original/i.test(localCard.textContent || "") &&
                        !/\bPlayer\b/i.test(localCard.textContent || "") &&
                        !/Created:/i.test(localCard.textContent || "") &&
                        !/Last played:/i.test(localCard.textContent || "") &&
                        !!localCard.querySelector(".story-library-title-card .profile-image-placeholder, .story-library-title-card img"),
                    "local story tab renders story cards with square title-card image surfaces and no save-specific dates",
                    { cardText: localCard?.textContent || "" },
                );
                localCard.querySelector(".story-library-title-card")?.click();
                await devWaitFor(
                    () => !!document.querySelector("[data-story-library-detail-modal='1']"),
                    3000,
                    "clicking a story library card image to open the story definition",
                );
                devAssert(
                    !!document.querySelector("[data-story-library-detail-modal='1']") &&
                        !document.querySelector("[data-story-title-card-modal]"),
                    "story library grid image opens the story definition, not the story image history",
                );

                closeStoryLibraryPopups();
                const generationStory = storyTemplateById(story.id);
                replaceStoryTitleCardStoreImages(generationStory, []);
                generationStory.title_card_image = emptyStoryTitleCardImageSlot();
                app.storyTitleCardGenerationFailed?.delete?.(story.id);
                await generateStoryTemplateTitleCardImage(story.id);
                const firstStoryTitleCardCall =
                    storyTitleCardImageCalls[storyTitleCardImageCalls.length - 1] || {};
                const forbiddenStoryTitleCardNegativeTerms =
                    /\b(?:text|watermark|logo|signature|artist signature|initials|writing|glyphs|symbols|caption|label|speech bubble)\b/i;
                const forbiddenStoryTitleCardPositiveTerms =
                    /\b(?:readable text|exactly "Story Library UI Smoke"|title logo|logo|subtitle|tagline|author name|episode label|caption|menu text|UI text|extra words|random letters)\b/i;
                devAssert(
                    storyTitleCardImageCalls.some(
                        (call) =>
                            call.options?.requirePlugin === true &&
                            call.options?.ensureIframeHost === true &&
                            call.options?.resolution === STORY_TITLE_CARD_IMAGE_RESOLUTION,
                    ),
                    "story title-card generation requires the Perchance plugin, hosts the live iframe, and requests square output",
                    { calls: storyTitleCardImageCalls },
                );
                devAssert(
                    forbiddenStoryTitleCardNegativeTerms.test(
                        String(firstStoryTitleCardCall.negativePrompt || ""),
                    ),
                    "story title-card generation sends anti-text/logo/signature terms in the negative prompt",
                    { call: firstStoryTitleCardCall },
                );
                devAssert(
                    !forbiddenStoryTitleCardPositiveTerms.test(
                        String(firstStoryTitleCardCall.prompt || ""),
                    ) &&
                        /cinematic illustrated cover background only/i.test(
                            String(firstStoryTitleCardCall.prompt || ""),
                        ) &&
                        /featured visual subjects: Smoke Queen, moonlit castle gate/i.test(
                            String(firstStoryTitleCardCall.prompt || ""),
                        ),
                    "story title-card prompt requests visual cover art without generated words",
                    { call: firstStoryTitleCardCall },
                );
                const updated = storyTemplateById(story.id);
                const updatedTitleCardImages = storyTitleCardImages(updated);
                const updatedActiveTitleCardId = storyTitleCardActiveId(updated);
                const updatedActiveTitleCard = updatedTitleCardImages.find(
                    (image) => String(image.id) === String(updatedActiveTitleCardId),
                );
                await devWaitFor(
                    () =>
                        !!document.querySelector(
                            "[data-story-library-id='story-library-ui-smoke-template'] .story-library-title-card img",
                        ),
                    3000,
                    "story title-card card surface to apply its scheduled targeted refresh",
                );
                devAssert(
                    !!storyTemplateTitleCardSrc(updated) &&
                        updatedTitleCardImages.length >= 1 &&
                        updatedActiveTitleCard?.prompt === firstStoryTitleCardCall.prompt &&
                        updatedActiveTitleCard?.favorite !== true &&
                        !!document.querySelector(
                            "[data-story-library-id='story-library-ui-smoke-template'] .story-library-title-card img",
                        ),
                    "story title-card generation stores history, sets the default image, refreshes the visible card, and does not auto-favorite",
                    {
                        titleCard: updated?.title_card_image,
                        updatedActiveTitleCardId,
                        updatedActiveTitleCard,
                        firstStoryTitleCardCall,
                        history: updatedTitleCardImages,
                        cardHtml: document.querySelector(
                            "[data-story-library-id='story-library-ui-smoke-template'] .story-library-title-card",
                        )?.innerHTML,
                    },
                );
                app.suppressStoryLibraryTitleCardAutoQueue = false;
                const secondGenerated = await generateStoryTemplateTitleCardImage(secondStory.id, {
                    auto: true,
                });
                const secondStoredTemplate = storyTemplateById("story-library-ui-smoke-template-2");
                const secondStoredImage = storyTitleCardImages(secondStoredTemplate).find(profileImageIsFinished);
                devAssert(
                    (!!secondGenerated || !!secondStoredImage) &&
                        !!storyTemplateTitleCardSrc(secondStoredTemplate),
                    "story library title-card generation can continue to the next missing local story image",
                    {
                        generated: !!secondGenerated,
                        secondStoredImage,
                        src: storyTemplateTitleCardSrc(secondStoredTemplate),
                    },
                );
                devAssert(
                    !!secondStoredImage,
                    "story library smoke has a finished second story title-card image before legacy-key compatibility check",
                );
                app.storyTitleCardImages = exactStoryTitleCardImageStore(
                    (app.storyTitleCardImages || []).map((image) =>
                        String(image.id) === String(secondStoredImage.id)
                            ? {
                                  ...image,
                                  story_key: `story:${secondStory.id}`,
                                  story_id: secondStory.id,
                                  story_title: storyTitleCardTitle(secondStory),
                                  story_source: "",
                              }
                            : image,
                    ),
                );
                devAssert(
                    storyTitleCardImages(secondStory).some(
                        (image) =>
                            String(image.id) === String(secondStoredImage.id) &&
                            profileImageIsFinished(image),
                    ),
                    "story title-card lookup reconnects current images after the same story is reimported with a new library record identity",
                    {
                        previousRecordKey: `story:${secondStory.id}`,
                        images: storyTitleCardImages(secondStory),
                    },
                );
                app.suppressStoryLibraryTitleCardAutoQueue = true;
                const staleStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-stale-title-card",
                    title: "Story Library UI Smoke Stale Image",
                    description: "A local story with an interrupted title-card generation.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                devUpsertStoryTemplatesForSmoke([staleStory]);
                refreshStoryLibraryActiveTabCards();
                clearStoryTitleCardGenerating(staleStory.id);
            let stalePending = rememberStoryTitleCardImage(
                    staleStory.id,
                    {
                        id: "story-library-ui-smoke-stale-pending-title-card",
                        title: "Interrupted story image",
                        prompt: "Interrupted story title card",
                        seed: 33,
                        model: "fantasy-rpg",
                        html: "",
                        pending: true,
                        favorite: false,
                    },
                    { setActive: true },
                );
                devAssert(
                    !!stalePending &&
                        !!staleStoryTitleCardPendingImage(storyTemplateById(staleStory.id)),
                    "story title-card smoke creates a stale pending image with no active generation",
                );
                const startupStaleStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-startup-stale-title-card",
                    title: "Story Library UI Smoke Startup Stale Image",
                    description: "A local story with an interrupted title-card generation from a previous session.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                devUpsertStoryTemplatesForSmoke([startupStaleStory]);
                const startupStalePending = rememberStoryTitleCardImage(
                    startupStaleStory.id,
                    {
                        id: "story-library-ui-smoke-startup-stale-pending-title-card",
                        title: "Startup interrupted story image",
                        prompt: "Startup interrupted story title card",
                        seed: 35,
                        model: "fantasy-rpg",
                        html: "",
                        pending: true,
                        favorite: false,
                    },
                    { setActive: true },
                );
                clearStoryTitleCardGenerating(startupStaleStory.id);
                const unrelatedUncompiledStory = {
                    ...clone(startupStaleStory),
                    id: "story-library-ui-smoke-unrelated-uncompiled",
                    title: "Unrelated Stored Story",
                    title_card_image: emptyStoryTitleCardImageSlot(),
                };
                app.storyTemplates.push(unrelatedUncompiledStory);
                const startupCleanup = cleanupStartupStaleLibraryImageRequests();
                const unrelatedStoryWasUntouched =
                    storyTemplateById(unrelatedUncompiledStory.id) === unrelatedUncompiledStory;
                app.storyTemplates = (app.storyTemplates || []).filter(
                    (template) => template !== unrelatedUncompiledStory,
                );
                const startupStaleAfterCleanup = storyTemplateById(startupStaleStory.id);
                const callsBeforeStartupStaleQueue = storyTitleCardImageCalls.length;
                devAssert(
                    startupCleanup.storyTitleCardRequestsRemoved >= 1 &&
                        !!startupStalePending &&
                        unrelatedStoryWasUntouched &&
                        storyTitleCardImageCalls.length === callsBeforeStartupStaleQueue &&
                        !storyTemplateTitleCardSrc(startupStaleAfterCleanup) &&
                        !storyTitleCardHasPendingImage(startupStaleAfterCleanup),
                    "startup stale story title-card cleanup removes leftover pending requests without generating during startup",
                    {
                        startupCleanup,
                        unrelatedStoryWasUntouched,
                        callCountBefore: callsBeforeStartupStaleQueue,
                        callCountAfter: storyTitleCardImageCalls.length,
                        titleCard: startupStaleAfterCleanup?.title_card_image,
                        images: storyTitleCardImages(startupStaleAfterCleanup),
                    },
                );
                stalePending = rememberStoryTitleCardImage(
                    staleStory.id,
                    {
                        id: "story-library-ui-smoke-stale-pending-title-card",
                        title: "Interrupted story image",
                        prompt: "Interrupted story title card",
                        seed: 33,
                        model: "fantasy-rpg",
                        html: "",
                        pending: true,
                        favorite: false,
                    },
                    { setActive: true },
                );
                const urlOnlyStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-url-only-title-card",
                    title: "Story Library UI Smoke Hosted Default Image",
                    description: "A local story imported with only a hosted/default title-card URL.",
                    genres: ["fantasy"],
                    title_card_image: {
                        ...devSmokeTitleCardImage(
                            "Story Library UI Smoke Hosted Default Image",
                        ),
                        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                        prompt: "URL-only hosted default story title card.",
                        seed: 0,
                    },
                });
                devUpsertStoryTemplatesForSmoke([urlOnlyStory]);
                const normalizedUrlOnlyStory = storyTemplateById(urlOnlyStory.id);
                await copyStoryTitleCardDefaultImageIfAvailable(
                    normalizedUrlOnlyStory,
                    "URL-only hosted/default title-card smoke",
                );
                openStoryTitleCardImageModal(urlOnlyStory.id);
                await new Promise((resolve) => setTimeout(resolve, 100));
                const urlOnlyActiveImage = activeStoryTitleCardImage(normalizedUrlOnlyStory);
                devAssert(
                    !!storyTitleCardActiveId(normalizedUrlOnlyStory) &&
                        !!urlOnlyActiveImage &&
                        profileImageIsFinished(urlOnlyActiveImage) &&
                        normalizedUrlOnlyStory.title_card_image.favorite !== true &&
                        urlOnlyActiveImage.favorite !== true &&
                        !!document.querySelector("[data-story-title-card-modal] .image-render img"),
                    "story image history opens URL-only hosted/default title-card images as active local history instead of a spinner or auto-favoriting",
                    {
                        titleCard: normalizedUrlOnlyStory?.title_card_image,
                        activeImage: urlOnlyActiveImage,
                    },
                );
                closeStoryLibraryPopups();
                app.suppressStoryLibraryTitleCardAutoQueue = false;
                await generateStoryTemplateTitleCardImage(staleStory.id, {
                    auto: true,
                    pendingImageId: stalePending.id,
                });
                await devWaitFor(
                    () => {
                        const staleTemplate = storyTemplateById(staleStory.id);
                        const recovered = storyTitleCardImageById(
                            staleTemplate,
                            stalePending.id,
                        );
                        return (
                            !!recovered &&
                            !recovered.pending &&
                            profileImageIsFinished(recovered)
                        );
                    },
                    3000,
                    "story library to recover interrupted title-card generation",
                );
                const recoveredStaleStory = storyTemplateById(staleStory.id);
                const recoveredStaleImage = storyTitleCardImageById(
                    recoveredStaleStory,
                    stalePending.id,
                );
                devAssert(
                    recoveredStaleImage &&
                        !recoveredStaleImage.pending &&
                        profileImageIsFinished(recoveredStaleImage) &&
                        storyTitleCardActiveId(recoveredStaleStory) === stalePending.id,
                    "stale pending story title-card image is retried and reused instead of blocking forever",
                    {
                        recoveredStaleImage,
                        activeId: storyTitleCardActiveId(recoveredStaleStory),
                    },
                );
                const timeoutStory = devSmokeTemplateRecord({
                    id: "story-library-ui-smoke-timeout-title-card",
                    title: "Story Library UI Smoke Timeout Image",
                    description: "A local story with an interrupted title-card generation that times out on retry.",
                    genres: ["fantasy"],
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                devUpsertStoryTemplatesForSmoke([timeoutStory]);
                clearStoryTitleCardGenerating(timeoutStory.id);
                const timeoutPending = rememberStoryTitleCardImage(
                    timeoutStory.id,
                    {
                        id: "story-library-ui-smoke-timeout-pending-title-card",
                        title: "Timeout story image",
                        prompt: "Timeout story title card",
                        seed: 34,
                        model: "fantasy-rpg",
                        html: "",
                        pending: true,
                        favorite: false,
                    },
                    { setActive: true },
                );
                app.issuePopupOpen = false;
                const successfulMockGenerateImageHtml = generateImageHtml;
                generateImageHtml = async (prompt, negativePrompt, seed, model, options = {}) => {
                    storyTitleCardImageCalls.push({ prompt, negativePrompt, seed, model, options });
                    throw new Error("Smoke title-card generation failed.");
                };
                try {
                    await generateStoryTemplateTitleCardImage(timeoutStory.id, {
                        auto: true,
                        pendingImageId: timeoutPending.id,
                    });
                } finally {
                    generateImageHtml = successfulMockGenerateImageHtml;
                }
                const autoFailureStory = storyTemplateById(timeoutStory.id);
                devAssert(
                    !storyTitleCardImageById(autoFailureStory, timeoutPending.id) &&
                        !storyTitleCardActiveId(autoFailureStory) &&
                        !activeStoryTitleCardImage(autoFailureStory) &&
                        !storyTitleCardHasPendingImage(autoFailureStory),
                    "automatic story title-card failure removes the empty pending image instead of leaving a loading/error card active",
                    {
                        titleCard: autoFailureStory?.title_card_image,
                        activeId: storyTitleCardActiveId(autoFailureStory),
                        activeImage: activeStoryTitleCardImage(autoFailureStory),
                        images: storyTitleCardImages(autoFailureStory),
                    },
                );
                const autoFailureTrace = smokeDevTraceCaptureActive()
                    ? app.smokeDevTraceCapture
                    : app.devTrace || [];
                const autoFailureLog = [...autoFailureTrace]
                    .reverse()
                    .find((entry) => /Story title-card auto generation failed/i.test(entry.title || ""));
                devAssert(
                    autoFailureLog?.logLevel === "message" &&
                        autoFailureLog?.details?.storyId === timeoutStory.id &&
                        autoFailureLog?.details?.activeImageIdAfterCleanup === "" &&
                        autoFailureLog?.details?.hasActiveImageAfterCleanup === false &&
                        !app.issuePopupOpen,
                    "automatic story title-card failure is a detailed image log message, not an issue popup",
                    {
                        autoFailureLog,
                        issuePopupOpen: !!app.issuePopupOpen,
                    },
                );
                await new Promise((resolve) => setTimeout(resolve, 150));
                devAssert(
                    app.storyTitleCardGenerationFailed?.has?.(timeoutStory.id),
                    "automatic story title-card failure remains suppressed until a manual retry",
                    {
                        storyId: timeoutStory.id,
                        failedIds: [...(app.storyTitleCardGenerationFailed || [])],
                    },
                );
                const titleCardSavesFlushed = await flushLargeSaves();
                if (!titleCardSavesFlushed)
                    devTestLog("Title-card durability storage failures", {
                        failures: (app.storageFailures || [])
                            .slice(-10)
                            .map((failure) => `${failure.key}: ${failure.message}`)
                            .join(" | "),
                    });
                devAssert(
                    titleCardSavesFlushed,
                    "story title-card records are durable before testing story deletion",
                );
                await openStoryLibraryDetail(secondStory.id);
                await new Promise((resolve) => setTimeout(resolve, 100));
                const storyDeleteButton = [...document.querySelectorAll("[data-story-library-detail-modal='1'] button")]
                    .find((button) => /^Delete$/i.test(button.textContent?.trim() || ""));
                devAssert(!!storyDeleteButton, "story definition detail exposes a Delete button");
                storyDeleteButton.click();
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    /Delete Story Definition/i.test(document.body.textContent || "") &&
                        !!document.querySelector(".popup-modal #confirmYesBtn") &&
                        !!document.querySelector(".popup-modal #confirmNoBtn"),
                    "Delete Story Definition opens a confirmation popup before removing the story",
                );
                document.querySelector(".popup-modal #confirmNoBtn")?.click();
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    !!storyTemplateById(secondStory.id) &&
                        !!document.querySelector("[data-story-library-detail-modal='1']"),
                    "canceling Delete Story Definition keeps the story and detail layer open",
                );
                storyDeleteButton.click();
                await new Promise((resolve) => setTimeout(resolve, 100));
                document.querySelector(".popup-modal #confirmYesBtn")?.click();
                await devWaitFor(
                    () =>
                        !storyTemplateById(secondStory.id) &&
                        !document.querySelector("[data-story-library-detail-modal='1']") &&
                        !document.querySelector(
                            `[data-story-library-id="${cssEscape(secondStory.id)}"]`,
                        ) &&
                        (app.storyTitleCardImages || []).some(
                            (image) =>
                                String(image.id) === String(secondStoredImage.id) &&
                                profileImageIsFinished(image),
                        ),
                    5000,
                    "story definition deletion and targeted library refresh to finish",
                );
                devAssert(
                    !storyTemplateById(secondStory.id) &&
                        !document.querySelector("[data-story-library-detail-modal='1']") &&
                        !document.querySelector(`[data-story-library-id="${cssEscape(secondStory.id)}"]`) &&
                        (app.storyTitleCardImages || []).some(
                            (image) =>
                                String(image.id) === String(secondStoredImage.id) &&
                                profileImageIsFinished(image),
                        ),
                    "confirming Delete Story Definition removes the local story but keeps local title-card images",
                    {
                        storyExists: !!storyTemplateById(secondStory.id),
                        detailOpen: !!document.querySelector(
                            "[data-story-library-detail-modal='1']",
                        ),
                        cardExists: !!document.querySelector(
                            `[data-story-library-id="${cssEscape(secondStory.id)}"]`,
                        ),
                        retainedImage: (app.storyTitleCardImages || []).find(
                            (image) => String(image.id) === String(secondStoredImage.id),
                        ),
                    },
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(STORY_TEMPLATE_KEY)}`,
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(STORY_TITLE_CARD_IMAGE_KEY)}`,
                );
                const [persistedStoriesAfterDelete, persistedStoryImagesAfterDelete] =
                    await Promise.all([
                        loadPerRecordLibrary(STORY_TEMPLATE_KEY, [], {
                            deferStoryValidation: true,
                        }),
                        loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, []),
                    ]);
                devAssert(
                    !persistedStoriesAfterDelete.some(
                        (item) => String(item?.id || "") === String(secondStory.id),
                    ) &&
                        persistedStoryImagesAfterDelete.some(
                            (image) =>
                                String(image?.id || "") ===
                                    String(secondStoredImage.id) &&
                                String(image?.story_id || "") === String(secondStory.id) &&
                                profileImageIsFinished(image),
                        ),
                    "deleting a story keeps its persisted title-card image after the library record is removed",
                    {
                        storyId: secondStory.id,
                        imageId: secondStoredImage.id,
                        persistedStoryIds: persistedStoriesAfterDelete.map((item) => item.id),
                        persistedStoryImages: persistedStoryImagesAfterDelete
                            .filter(
                                (image) =>
                                    String(image?.id || "") ===
                                    String(secondStoredImage.id),
                            )
                            .map((image) => ({
                                id: image.id,
                                story_id: image.story_id,
                                finished: profileImageIsFinished(image),
                            })),
                    },
                );
                const reimportedSecondStoryId = `${secondStory.id}-reimported-new-id`;
                const reimportPayload = storyExportPayloadFromDefinition(
                    {
                        ...clone(secondStory),
                        id: reimportedSecondStoryId,
                        title_card_image: emptyStoryTitleCardImageSlot(),
                    },
                );
                const reimportedSecondStory = await importStoryTemplatePayload(reimportPayload, {
                    title: "Story Library Reimport Smoke",
                    tab: "local",
                    showNotice: false,
                    persist: false,
                    openLibrary: false,
                });
                const titleCardCallsBeforeReimportCheck = storyTitleCardImageCalls.length;
                openStoryTemplateLibrary({ tab: "local" });
                queueFirstVisibleStoryLibraryMissingTitleCard();
                await new Promise((resolve) => setTimeout(resolve, 100));
                const reimportedSecondStoryImages = storyTitleCardImages(reimportedSecondStory);
                const reimportGenerationCalls = storyTitleCardImageCalls
                    .slice(titleCardCallsBeforeReimportCheck)
                    .filter(
                        (call) =>
                            call.options?.promptEditorReplay?.storyId ===
                            reimportedSecondStory?.id,
                    );
                const reimportedSecondStoryPassed =
                    !!reimportedSecondStory &&
                    reimportedSecondStoryImages.some(profileImageIsFinished) &&
                    !!storyTemplateTitleCardSrc(reimportedSecondStory) &&
                    reimportGenerationCalls.length === 0;
                if (!reimportedSecondStoryPassed)
                    devTestLog("Reimported title-card diagnostics", {
                        storyId: reimportedSecondStory?.id || "",
                        storyTitle: reimportedSecondStory?.title || "",
                        images: reimportedSecondStoryImages,
                        titleCard: reimportedSecondStory?.title_card_image,
                        callCountBefore: titleCardCallsBeforeReimportCheck,
                        callCountAfter: storyTitleCardImageCalls.length,
                        reimportGenerationCalls,
                        preparing: storyTitleCardImportIsPreparing(reimportedSecondStory?.id),
                        storedImage: (app.storyTitleCardImages || []).find(
                            (image) => String(image.id) === String(secondStoredImage.id),
                        ),
                        storageFailureText: (app.storageFailures || [])
                            .slice(-5)
                            .map((failure) => `${failure.key}: ${failure.message}`)
                            .join(" | "),
                    });
                devAssert(
                    reimportedSecondStoryPassed,
                    "re-importing the same story definition with a new local id reuses previously generated local title-card images without regenerating",
                    {
                        images: reimportedSecondStoryImages,
                        titleCard: reimportedSecondStory?.title_card_image,
                        callCountBefore: titleCardCallsBeforeReimportCheck,
                        callCountAfter: storyTitleCardImageCalls.length,
                        reimportGenerationCalls,
                        preparing: storyTitleCardImportIsPreparing(reimportedSecondStory?.id),
                        storedImage: (app.storyTitleCardImages || []).find(
                            (image) => String(image.id) === String(secondStoredImage.id),
                        ),
                    },
                );
                await openStoryLibraryDetail(story.id);
                await new Promise((resolve) => setTimeout(resolve, 100));
                devAssert(
                    /Start Adventure/i.test(
                        document.querySelector("[data-story-library-layer='1']")?.textContent || "",
                    ) &&
                        /Created:/i.test(
                            document.querySelector("[data-story-library-layer='1']")?.textContent || "",
                        ) &&
                        ![...document.querySelectorAll("[data-story-library-layer='1'] button")].some(
                            (button) => /^Images$/i.test(button.textContent?.trim() || ""),
                        ) &&
                        !/Last played:/i.test(
                            document.querySelector("[data-story-library-layer='1']")?.textContent || "",
                        ),
                    "story detail layer exposes current definition actions and hides player-specific last-played metadata",
                );
                const detailEditButton = document.querySelector(
                    "[data-story-library-detail-modal='1'] button[title='Edit definition']",
                );
                devAssert(!!detailEditButton, "story definition detail exposes an Edit button");
                detailEditButton.click();
                await devWaitFor(
                    () =>
                        !!app.storyBuilder &&
                        !$("storyBuilderOverlay")?.classList?.contains("hidden") &&
                        !document.querySelector("[data-story-library-detail-modal='1']"),
                    3000,
                    "story definition Edit button to open the Story Builder above the detail popup",
                );
                devAssert(
                    !!app.storyBuilder &&
                        !document.querySelector("[data-story-library-detail-modal='1']"),
                    "story definition Edit closes the detail popup and opens the Story Builder",
                );
                cleanupSmokeScenarioUi();
                openStoryTemplateLibrary({ tab: "local" });
                await new Promise((resolve) => setTimeout(resolve, 100));
                closeContainingPopup(document.querySelector("[data-story-library-layer='1']"));
                switchUnifiedLibraryTab("public");
                const publicSearch = document.querySelector("[data-unified-library-search]");
                publicSearch.value = "smoke";
                publicSearch.dispatchEvent(new Event("input", { bubbles: true }));
                devAssert(
                    !document.querySelector("[data-unified-library-public-search]")?.disabled &&
                        /Press Search/i.test($("storyLibraryPublicSearchHint")?.textContent || ""),
                    "public story tab requires explicit Search after filters change",
                    {
                        disabled: document.querySelector("[data-unified-library-public-search]")?.disabled,
                        hint: $("storyLibraryPublicSearchHint")?.textContent,
                    },
                );
                await runUnifiedLibraryPublicSearch();
                await new Promise((resolve) => setTimeout(resolve, 100));
                devTestLog("Public story search diagnostics", {
                    resultsText:
                        document.querySelector("[data-story-library-results='public']")?.textContent || "",
                    count: $("storyLibrarySearchCount-public")?.textContent || "",
                    cardCount: document.querySelectorAll("[data-public-story-card]").length,
                    imageCount: document.querySelectorAll(
                        "[data-public-story-card] img, [data-story-library-id='public-story-library-ui-smoke'] .story-library-title-card img",
                    ).length,
                });
                devAssert(
                    /Public Story Library UI Smoke/i.test(
                        document.querySelector("[data-story-library-results='public']")?.textContent || "",
                    ) &&
                        /1 story of 1 total/i.test($("storyLibrarySearchCount-public")?.textContent || "") &&
                        /1\/1 shown/i.test(
                            document.querySelector("[data-library-result-label]")?.textContent || "",
                        ) &&
                        !!document.querySelector(
                            "[data-public-story-card], [data-story-library-id='public-story-library-ui-smoke'] .story-library-title-card img",
                        ),
                    "public story search renders public story cards with title-card images and exact total counts inside the Story Library",
                    {
                        resultsText:
                            document.querySelector("[data-story-library-results='public']")?.textContent || "",
                        count: $("storyLibrarySearchCount-public")?.textContent || "",
                    },
                );

                switchStoryLibraryTab("local");
                await openStoryLibraryDetail(story.id);
                await new Promise((resolve) => setTimeout(resolve, 100));
                const detailStartButton = [...document.querySelectorAll("[data-story-library-detail-modal='1'] button")]
                    .find((button) => /Start Adventure/i.test(button.textContent || ""));
                devAssert(!!detailStartButton, "story definition detail exposes a Start Adventure button");
                await startStoryTemplate(story.id);
                await devWaitFor(
                    () =>
                        !app.busy &&
                        !(app.queue || []).length &&
                        !app.aiActive &&
                        !(app.profileImageQueue || []).length &&
                        !app.profileImageQueueRunning,
                    5000,
                    "story library smoke story start async image/save work to settle",
                );
                flushScheduledSaveAll("story-library-ui-smoke settled story start");
                await flushLargeSaves();
                await devWaitFor(
                    () => !document.querySelector("[data-story-library-detail-modal='1']"),
                    3000,
                    "story definition detail to close after Start Adventure",
                );
                devAssert(
                    !document.querySelector("[data-story-library-detail-modal='1']") &&
                        !document.querySelector("[data-story-library-layer='1']"),
                    "Start Adventure closes the Story Definition popup layer",
                );
                const playedStory = storyTemplateById(story.id);
                devAssert(
                    !!app.activeSaveId &&
                        !Object.hasOwn(playedStory || {}, "lastPlayedAt"),
                    "starting a story creates an active save without adding player-specific dates to the immutable story definition",
                    {
                        activeSaveId: app.activeSaveId,
                        hasDefinitionLastPlayedAt: Object.hasOwn(
                            playedStory || {},
                            "lastPlayedAt",
                        ),
                    },
                );
                openStoryTemplateLibrary({ tab: "local" });
                await new Promise((resolve) => setTimeout(resolve, 100));
                openStoryTitleCardImageModal(story.id);
                await new Promise((resolve) => setTimeout(resolve, 100));
                const storyTitleCardModal = document.querySelector(
                    "[data-story-title-card-modal]",
                );
                devAssert(
                    /Story Image/i.test(storyTitleCardModal?.textContent || "") &&
                        !!document.querySelector("[data-story-title-card-action='generate']") &&
                        !!document.querySelector("[data-story-title-card-style]") &&
                        !!document.querySelector("[data-story-title-card-seed]") &&
                        !!document.querySelector("[data-story-title-card-random-seed]") &&
                        !!document.querySelector("[data-story-title-card-action='random-seed']") &&
                        !!document.querySelector("[data-story-title-card-action='upload']") &&
                        !document.querySelector("[data-story-title-card-prompt]") &&
                        !!document
                            .querySelector("[data-story-title-card-modal]")
                            ?.closest(".modal-box")
                            ?.matches("[data-fullscreen-list-modal='1']"),
                    "story image history modal matches character profile-image controls including local upload without exposing the raw prompt",
                    {
                        modalText: storyTitleCardModal?.textContent || "",
                        actions: [...(storyTitleCardModal?.querySelectorAll(
                            "[data-story-title-card-action]",
                        ) || [])].map((button) => button.dataset.storyTitleCardAction),
                        hasStyle: !!storyTitleCardModal?.querySelector(
                            "[data-story-title-card-style]",
                        ),
                        hasSeed: !!storyTitleCardModal?.querySelector(
                            "[data-story-title-card-seed]",
                        ),
                        hasRandomSeed: !!storyTitleCardModal?.querySelector(
                            "[data-story-title-card-random-seed]",
                        ),
                        hasPrompt: !!storyTitleCardModal?.querySelector(
                            "[data-story-title-card-prompt]",
                        ),
                        fullscreen: storyTitleCardModal
                            ?.closest(".modal-box")
                            ?.getAttribute("data-fullscreen-list-modal"),
                    },
                );
                const storySeedInput = document.querySelector("[data-story-title-card-seed]");
                const originalStorySeed = storySeedInput?.value;
                document.querySelector("[data-story-title-card-action='random-seed']")?.click();
                await new Promise((resolve) => setTimeout(resolve, 50));
                devAssert(
                    !!storySeedInput?.value &&
                        storySeedInput.value !== String(originalStorySeed || "") &&
                        !document.querySelector("[data-story-title-card-random-seed]")?.checked,
                    "story image history modal random seed button updates the fixed default seed",
                    {
                        originalStorySeed,
                        nextStorySeed: storySeedInput?.value,
                    },
                );
                const originalChooseLocalStoryImageFile = chooseLocalImageFile;
                try {
                    chooseLocalImageFile = async () =>
                        new File([new Blob(["story upload smoke"])], "story-upload-smoke.png", {
                            type: "image/png",
                        });
                    const storyUploadCountBefore = storyTitleCardImages(storyTemplateById(story.id)).length;
                    const storyUploadPromise = uploadLocalStoryTitleCardImage(story.id);
                    await devWaitFor(
                        () => !!document.querySelector(
                            ".popup-modal.open #confirmYesBtn",
                        ),
                        3000,
                        "story image upload classification attestation",
                    );
                    document
                        .querySelector(".popup-modal.open #confirmYesBtn")
                        ?.click();
                    await storyUploadPromise;
                    document.querySelector(".popup-modal #noticeOkBtn")?.click();
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    const uploadedStoryImages = storyTitleCardImages(storyTemplateById(story.id));
                    devAssert(
                        uploadedStoryImages.length === storyUploadCountBefore + 1 &&
                            uploadedStoryImages.some(
                                (image) =>
                                    image.source === "local upload" &&
                                    image.favorite === false &&
                                    /Uploaded story image/i.test(image.prompt || ""),
                            ),
                        "story image upload stores a non-favorited local story image record",
                        { uploadedStoryImages },
                    );
                } finally {
                    chooseLocalImageFile = originalChooseLocalStoryImageFile;
                }
                const alternateStoryImage = rememberStoryTitleCardImage(
                    story.id,
                    {
                        id: "story-library-ui-smoke-alt-title-card",
                        title: "Alternate Story Image",
                        prompt: "Alternate story image",
                        seed: 44,
                        model: "fantasy-rpg",
                        html: `<img alt="alternate story image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">`,
                        favorite: false,
                    },
                    { setActive: false },
                );
                refreshOpenStoryTitleCardImageModal(story.id);
                selectStoryTitleCardImage(story.id, alternateStoryImage.id);
                toggleStoryTitleCardFavorite(story.id, alternateStoryImage.id);
                const selectedStory = storyTemplateById(story.id);
                devAssert(
                    storyTitleCardActiveId(selectedStory) === alternateStoryImage.id &&
                        selectedStory?.title_card_image?.seed === 44 &&
                        storyTitleCardImageById(selectedStory, alternateStoryImage.id)?.favorite === true,
                    "story image Use This and favorite controls update the active/default title card without deleting history",
                    {
                        titleCard: selectedStory?.title_card_image,
                        history: storyTitleCardImages(selectedStory),
                    },
                );
                showConfirm = async () => true;
                await deleteStoryTitleCardImage(story.id, alternateStoryImage.id);
                const afterActiveDeleteStory = storyTemplateById(story.id);
                devAssert(
                    !storyTitleCardActiveId(afterActiveDeleteStory) &&
                        !activeStoryTitleCardImage(afterActiveDeleteStory) &&
                        !storyTitleCardImageById(afterActiveDeleteStory, alternateStoryImage.id) &&
                        storyTitleCardImages(afterActiveDeleteStory).some(profileImageIsFinished),
                    "deleting the active story image clears the active slot without deleting older story image history",
                    {
                        titleCard: afterActiveDeleteStory?.title_card_image,
                        activeId: storyTitleCardActiveId(afterActiveDeleteStory),
                        activeImage: activeStoryTitleCardImage(afterActiveDeleteStory),
                        history: storyTitleCardImages(afterActiveDeleteStory),
                    },
                );
                addMessage("system", "Story library UI smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: story-library-ui-smoke");
            } finally {
                app.suppressStoryLibraryTitleCardAutoQueue =
                    originalSuppressStoryLibraryTitleCardAutoQueue;
                generateImageHtml = originalGenerateImageHtml;
                copyStoryTitleCardDefaultImageIfAvailable =
                    originalCopyStoryTitleCardDefaultImageIfAvailable;
                publicLibraryFetch = originalPublicLibraryFetch;
                window.fetch = originalWindowFetch;
                showConfirm = originalShowConfirm;
                selectedCreatorIdentity = originalSelectedCreatorIdentity;
                app.supabaseSession = originalSession;
                app.settings.publicLibrarySupabaseUrl = originalSupabaseUrl;
                app.settings.publicLibrarySupabaseAnonKey = originalSupabaseAnonKey;
                await devCleanupSmokeStoryLibraryArtifacts("story library smoke story artifacts cleaned");
                await devCleanupSmokeStoryTitleCardArtifacts(
                    "story library smoke title-card artifacts cleaned",
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunCharacterLibraryCastSmokeTest() {
            const setTimeout = (callback, delay = 0, ...args) => {
                if (Number(delay) <= 250) {
                    devSmokeSettle().then(() => callback(...args));
                    return 0;
                }
                return globalThis.setTimeout(callback, delay, ...args);
            };
            devTestLog("Scenario start: character-library-cast-smoke");
            devResetForLiveTest("character-library-cast-smoke");
            devCreateTestProfile({  });
            cleanupSmokeScenarioUi();
            // SANITIZE KEEP (dev fixture): synthetic character-library state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            const originalGenerateImageHtml = generateImageHtml;
            const originalCharacterDefinitions = devSmokeClone(
                app.characterDefinitions || [],
            );
            const originalProfileImages = devSmokeClone(
                await loadPerRecordLibrary(
                    PROFILE_IMAGE_KEY,
                    app.profileImages || [],
                ),
            );
            const originalDownloadJsonPayload = downloadJsonPayload;
            const originalAiText = aiText;
            const originalChatTitleImageHtmlFromCharacter =
                chatTitleImageHtmlFromCharacter;
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const attachedStoryLibraryId = "character-attached-story-smoke";
            const malformedAttachedStoryCharacterId =
                "smoke-rhea-attached-story-rejection";
            try {
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Character Surface Smoke",
                    },
                },
                player: {
                    ...devSmokeRuntimeCharacter("Cast Tester", {
                        gender: "non-male",
                        role: "party organizer",
                    }),
                    name: "Cast Tester",
                    age: 24,
                    gender: "non-male",
                    role: "party organizer",
                    source: "Smoke Source",
                    creator: "tester",
                },
                characters: {
                    "New Ally": {
                        ...devSmokeRuntimeCharacter("New Ally", {
                            gender: "non-male",
                            role: "arcane scout",
                        }),
                        name: "New Ally",
                        age: 28,
                        gender: "non-male",
                        role: "arcane scout",
                        source: "Smoke Source",
                        creator: "tester",
                        relationship_to_player: "ally",
                        outfits: [
                            {
                                id: "default",
                                name: "Scout outfit",
                                clothing: {
                                    shirt: "green scout tunic",
                                    pants: "dark travel pants",
                                },
                            },
                        ],
                        starting_outfit_id: "default",
                        profile_image_id: "mira-library-existing-profile",
                        profile_images: [{ id: "mira-library-existing-profile", male: false }],
                        default_profile_image: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(false),
                            local_image_id: "mira-library-existing-profile",
                            source: "smoke existing",
                        }),
                    },
                    "Tor Bran": {
                        ...devSmokeRuntimeCharacter("Tor Bran", {
                            gender: "male",
                            role: "shield guard",
                        }),
                        name: "Tor Bran",
                        age: 31,
                        gender: "male",
                        role: "shield guard",
                        source: "Other Source",
                        creator: "tester",
                        relationship_to_player: "ally",
                        profile_image_id: "tor-library-existing-profile",
                        profile_images: [{ id: "tor-library-existing-profile", male: true }],
                        default_profile_image: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(true),
                            local_image_id: "tor-library-existing-profile",
                            source: "smoke existing",
                        }),
                    },
                },
                npc_directory: {
                    locations: {
                        "smoke-town": {
                            label: "Smoke Town",
                            characters: {
                                "Nara Quill": {
                                    name: "Nara Quill",
                                    gender: "non-male",
                                    age: 35,
                                    role: "scribe",
                                    relationship: "neutral",
                                    note: "Tracks party contracts.",
                                    inspected: true,
                                    full_character: {
                                        ...devSmokeRuntimeCharacter("Nara Quill", {
                                            gender: "non-male",
                                            role: "scribe",
                                        }),
                                        name: "Nara Quill",
                                        age: 35,
                                        gender: "non-male",
                                        role: "scribe",
                                        source: "Smoke Source",
                                        creator: "tester",
                                        profile_image_id: "nara-library-existing-profile",
                                        profile_images: [
                                            { id: "nara-library-existing-profile", male: false },
                                        ],
                                        default_profile_image: profileImageSlotFromExactInput({
                                            ...emptyProfileImageSlot(false),
                                            local_image_id: "nara-library-existing-profile",
                                            source: "smoke existing",
                                        }),
                                    },
                                },
                                "Iris Hale": {
                                    name: "Iris Hale",
                                    gender: "female",
                                    age: 30,
                                    role: "archivist",
                                    relationship: "neutral",
                                    note: "Known NPC who is not currently in the scene.",
                                    inspected: false,
                                },
                            },
                        },
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Cast management test room.",
                    party_members_present: ["Player", "New Ally", "Tor Bran"],
                    image_characters: ["Player", "New Ally"],
                    npcs_present: ["Nara Quill"],
                },
                objectives: {
                    active_id: "cast-test",
                    items: [
                        {
                            id: "cast-test",
                            title: "Test Cast Tools",
                            type: "story",
                            status: "active",
                            summary: "Smoke test cast tools.",
                            objective: "Open cast tools.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Character library and cast smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            await devCompileCurrentStoryFixture("character-library-cast-smoke");
            app.profileImages = exactProfileImageStore([
                {
                    id: "mira-library-existing-profile",
                    owner_name: "New Ally",
                    source: "smoke existing",
                    model: "debug",
                    seed: 101,
                    prompt: "New Ally existing library profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="New Ally existing profile">`,
                    profile: true,
                    male: false,
                    pending: false,
                },
                {
                    id: "nara-library-existing-profile",
                    owner_name: "Nara Quill",
                    source: "smoke existing",
                    model: "debug",
                    seed: 102,
                    prompt: "Nara Quill existing library profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Nara Quill existing profile">`,
                    profile: true,
                    male: false,
                    pending: false,
                },
                {
                    id: "tor-library-existing-profile",
                    owner_name: "Tor Bran",
                    source: "smoke existing",
                    model: "debug",
                    seed: 103,
                    prompt: "Tor Bran existing library profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Tor Bran existing profile">`,
                    profile: true,
                    male: true,
                    pending: false,
                },
                {
                    id: "library-party-recruit-existing-profile",
                    owner_name: "Library Party Recruit",
                    source: "smoke existing",
                    model: "debug",
                    seed: 104,
                    prompt: "Library Party Recruit existing library profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Library Party Recruit existing profile">`,
                    profile: true,
                    male: false,
                    pending: false,
                },
                {
                    id: "library-npc-recruit-existing-profile",
                    owner_name: "Nolan Reed",
                    source: "smoke existing",
                    model: "debug",
                    seed: 105,
                    prompt: "Nolan Reed existing library profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Nolan Reed existing profile">`,
                    profile: true,
                    male: true,
                    pending: false,
                },
            ].map((image) => createProfileImageRecord({
                ...image,
                character_id: objectiveIdFromTitle(image.owner_name, "character"),
            })));
            app.characterDefinitions = validatedCharacterLibraryDefinitions([
                devSmokeCharacterRecord("New Ally", {
                    character: {
                        gender: "non-male",
                        role: "arcane scout",
                        default_profile_image: {
                            ...emptyProfileImageSlot(false),
                            local_image_id: "mira-library-existing-profile",
                            source: "smoke existing",
                        },
                    },
                    record: {
                        active_profile_image_ids: {
                            male: "",
                            non_male: "mira-library-existing-profile",
                        },
                    },
                }),
                devSmokeCharacterRecord("Nara Quill", {
                    character: {
                        gender: "non-male",
                        role: "scribe",
                        default_profile_image: {
                            ...emptyProfileImageSlot(false),
                            local_image_id: "nara-library-existing-profile",
                            source: "smoke existing",
                        },
                    },
                    record: {
                        active_profile_image_ids: {
                            male: "",
                            non_male: "nara-library-existing-profile",
                        },
                    },
                }),
                devSmokeCharacterRecord("Tor Bran", {
                    character: {
                        gender: "male",
                        role: "shield guard",
                        default_profile_image: {
                            ...emptyProfileImageSlot(true),
                            local_image_id: "tor-library-existing-profile",
                            source: "smoke existing",
                        },
                    },
                    record: {
                        active_profile_image_ids: {
                            male: "tor-library-existing-profile",
                            non_male: "",
                        },
                    },
                }),
                devSmokeCharacterRecord("Library Party Recruit", {
                    character: {
                        gender: "non-male",
                        role: "library party recruit",
                        default_profile_image: {
                            ...emptyProfileImageSlot(false),
                            local_image_id: "library-party-recruit-existing-profile",
                            source: "smoke existing",
                        },
                    },
                    record: {
                        active_profile_image_ids: {
                            male: "",
                            non_male: "library-party-recruit-existing-profile",
                        },
                    },
                }),
                devSmokeCharacterRecord("Nolan Reed", {
                    character: {
                        gender: "male",
                        role: "library npc recruit",
                        default_profile_image: {
                            ...emptyProfileImageSlot(true),
                            local_image_id: "library-npc-recruit-existing-profile",
                            source: "smoke existing",
                        },
                    },
                    record: {
                        active_profile_image_ids: {
                            male: "library-npc-recruit-existing-profile",
                            non_male: "",
                        },
                    },
                }),
            ]);
            const embeddedProfileDefinition = characterDefinitionOnlyFromEntity(
                {
                    ...devSmokeRuntimeCharacter("Embedded Profile Keeper", {
                        gender: "non-male",
                        role: "embedded image regression target",
                    }),
                    ...devCompleteLibraryCharacterMetadata({ source: "Smoke Source" }),
                    name: "Embedded Profile Keeper",
                    age: 29,
                    gender: "non-male",
                    role: "embedded image regression target",
                },
                "Embedded Profile Keeper",
            );
            embeddedProfileDefinition.profile_images = [
                {
                    id: "embedded-profile-keeper-image",
                    owner_name: "Embedded Profile Keeper",
                    source: "smoke embedded",
                    model: "debug",
                    seed: 106,
                    prompt: "Embedded Profile Keeper existing profile.",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Embedded Profile Keeper existing profile">`,
                    profile: true,
                    pending: false,
                },
            ];
            const embeddedProfileValidation = validateCharacterDefinition(
                embeddedProfileDefinition,
            );
            devAssert(
                !embeddedProfileValidation.ok &&
                    embeddedProfileValidation.errors.some(
                        (error) => error.path === "character_definition.profile_images",
                    ) &&
                    !profileImageByStoreId("embedded-profile-keeper-image"),
                "legacy embedded profile-image arrays are rejected without extracting or rewriting them",
                {
                    stored: !!profileImageByStoreId("embedded-profile-keeper-image"),
                    validation: embeddedProfileValidation,
                },
            );
            const importRejectionTrace = smokeDevTraceCaptureActive()
                ? app.smokeDevTraceCapture
                : app.devTrace || [];
            const importRejectionTraceLength = importRejectionTrace.length;
            handleCharacterImportFailure(
                "Character definition import failed",
                importRejectionError([
                    "smoke-invalid-character.json: character_definition.unapproved_field is not an approved field.",
                ]),
                { requestKind: "character-definition-file-import" },
            );
            await devSmokeSettle();
            const importRejectionEntries = importRejectionTrace.slice(
                importRejectionTraceLength,
            );
            devAssert(
                /Import Failed/i.test(document.body.textContent || "") &&
                    !importRejectionEntries.some(
                        (entry) =>
                            /Character definition import failed/i.test(entry?.title || "") &&
                            entry?.logLevel === "error",
                    ) &&
                    !app.issuePopupOpen,
                "invalid character imports show their rejection notice without creating an error report",
                {
                    traceEntries: importRejectionEntries,
                    issuePopupOpen: !!app.issuePopupOpen,
                    noticeText: document.body.textContent.slice(-500),
                },
            );
            document.querySelector(".popup-modal #noticeOkBtn")?.click();
            scheduleActiveGameSave();
            render();

            openCharacterLibraryModal({ tab: "local" });
            await devWaitFor(
                () =>
                    characterLibraryActiveTab() === "local" &&
                    /New Ally/i.test(
                        document.querySelector("[data-character-library-results='local']")?.textContent || "",
                    ) &&
                    /Nara Quill/i.test(
                        document.querySelector("[data-character-library-results='local']")?.textContent || "",
                    ),
                3000,
                "local character library definitions to render",
            );
            const localPanel = document.querySelector("[data-character-library-tab-panel='local']");
            localPanel?.querySelectorAll?.("[data-character-library-name-search], [data-character-library-filter], [data-character-library-filter-extra]").forEach((input) => {
                if (input.type === "checkbox") input.checked = false;
                else input.value = "";
            });

            filterCharacterLibraryModal();
            await devWaitFor(
                () =>
                    /New Ally/i.test(
                        document.querySelector("[data-character-library-results='local']")?.textContent || "",
                    ) &&
                    /Nara Quill/i.test(
                        document.querySelector("[data-character-library-results='local']")?.textContent || "",
                    ),
                3000,
                "local character library definitions after filter reset",
            );
            const localPanelText = localPanel?.textContent || "";
            devAssert(
                    !!$("modalBox")?.querySelector?.("[data-library-home][data-library-type='character']") &&
                    characterLibraryActiveTab() === "local" &&
                    /New Ally/i.test(localPanelText) &&
                    /Nara Quill/i.test(localPanelText),
                "character library shows stored reusable definitions",
                {
                    activeTab: characterLibraryActiveTab(),
                    localFilters: characterLibraryFilterValues("local"),
                    localCount: $("characterLibrarySearchCount-local")?.textContent || "",
                    localText: localPanelText.slice(0, 500),
                },
            );
            const definitionCountBeforeDuplicateImport = (app.characterDefinitions || []).length;
            const originalSavePerRecordLibraryRecordsForPartialImport =
                savePerRecordLibraryRecords;
            let partialDuplicateImportSaveCount = 0;
            savePerRecordLibraryRecords = (key, records, ...args) => {
                if (key === CHARACTER_LIBRARY_KEY) partialDuplicateImportSaveCount++;
                return originalSavePerRecordLibraryRecordsForPartialImport(
                    key,
                    records,
                    ...args,
                );
            };
            try {
                const mixedImportRecords = [
                    devSmokeCharacterRecord("New Ally", {
                        character: {
                            age: 25,
                            gender: "female",
                            role: "duplicate import smoke",
                        },
                    }),
                    devSmokeCharacterRecord("Fresh Batch Ally", {
                        character: {
                            age: 26,
                            gender: "female",
                            role: "fresh partial batch import",
                        },
                    }),
                ].map((record) => ({
                    character_definition: clone(record.character),
                }));
                await devImportCharacterDefinitionsFromRecords(mixedImportRecords);
            } finally {
                savePerRecordLibraryRecords =
                    originalSavePerRecordLibraryRecordsForPartialImport;
            }
            if (
                (app.characterDefinitions || []).length !== definitionCountBeforeDuplicateImport + 1 ||
                partialDuplicateImportSaveCount !== 1
            )
                devTestLog("Mixed character import mismatch", {
                    countBefore: definitionCountBeforeDuplicateImport,
                    countAfter: (app.characterDefinitions || []).length,
                    saveCount: partialDuplicateImportSaveCount,
                    names: (app.characterDefinitions || []).map((record) => record.name),
                    failureText: (app.storageFailures || []).slice(-3)
                        .map((failure) => `${failure.key}: ${failure.message}`)
                        .join(" | "),
                    noticeText: document.body.textContent.slice(-500),
                });
            devAssert(
                (app.characterDefinitions || []).length === definitionCountBeforeDuplicateImport + 1 &&
                    (app.characterDefinitions || []).some(
                        (record) =>
                            record.name === "Fresh Batch Ally" &&
                            record.character?.role === "fresh partial batch import",
                    ) &&
                    (app.characterDefinitions || []).find((record) => record.name === "New Ally")
                        ?.character?.role !== "duplicate import smoke" &&
                    /Skipped 1 duplicate/i.test(document.body.textContent || "") &&
                    partialDuplicateImportSaveCount === 1,
                "importing a mixed duplicate/new local-library batch skips the duplicate, imports the new definition, and saves once",
                {
                    countBefore: definitionCountBeforeDuplicateImport,
                    countAfter: (app.characterDefinitions || []).length,
                    saveCount: partialDuplicateImportSaveCount,
                    noticeText: document.body.textContent.slice(-500),
                },
            );
            document.querySelector(".popup-modal #noticeOkBtn")?.click();
            const duplicateGameRecord = characterLibraryRecords().find(
                (record) => record.name === "New Ally",
            );
            addCharacterFromLibrary(characterLibraryRecordId(duplicateGameRecord), "party");
            devAssert(
                !app.state.characters["New Ally 2"] &&
                    /Character Already In Game/i.test(document.body.textContent || ""),
                "adding an already-present character from the local library into the active game is blocked instead of auto-renaming",
                {
                    characterNames: Object.keys(app.state.characters || {}),
                    noticeText: document.body.textContent.slice(-500),
                },
            );
            document.querySelector(".popup-modal #noticeOkBtn")?.click();
            app.state.npc_directory ||= { locations: {} };
            app.state.npc_directory.locations ||= {};
            app.state.npc_directory.locations["Key Mismatch Smoke"] = {
                label: "Key Mismatch Smoke",
                characters: {
                    storage_key_only: {
                        name: "Visible Duplicate",
                        full_character: blankCharacterTemplate("Visible Duplicate"),
                    },
                },
            };
            devAssert(
                activeGameHasCharacterName("Visible Duplicate"),
                "active-game duplicate detection checks NPC display/full-character names, not only storage keys",
                { npcDirectory: app.state.npc_directory.locations["Key Mismatch Smoke"] },
            );
            delete app.state.npc_directory.locations["Key Mismatch Smoke"];
            const characterLibraryModal = $("modalBox");
            devAssert(
                    !!characterLibraryModal?.querySelector?.("[data-library-home][data-library-type='character']") &&
                    !!characterLibraryModal?.querySelector?.(".library-kind-tabs button.active") &&
                    !!characterLibraryModal?.querySelector?.(".library-header-actions button[title='Create character']") &&
                    !!characterLibraryModal?.querySelector?.(".library-header-actions button[title='Import character']") &&
                    characterLibraryModal.matches("[data-fullscreen-list-modal='1']") &&
                    !!characterLibraryModal.querySelector("[data-library-source='public']") &&
                    !!characterLibraryModal.querySelector("[data-library-source='local']") &&
                    !!characterLibraryModal.querySelector("[data-library-source='mine']") &&
                    !!characterLibraryModal.querySelector("[data-library-columns-input='character']") &&
                    !!characterLibraryModal.querySelector("[data-character-library-sort]"),
                "character library uses the fullscreen merged header, type/source tabs, create/import actions, sort, and column controls",
            );
            const libraryAiCreateButton = characterLibraryModal.querySelector(
                ".library-header-actions button[title='Create character']",
            );
            devAssert(!!libraryAiCreateButton, "Character Library has a Create Character action");
            libraryAiCreateButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const characterCreationChoice = document.querySelector("[data-character-creation-choice='1']");
            devAssert(
                !!characterCreationChoice &&
                    /Create New Character/i.test(characterCreationChoice.textContent || "") &&
                    /Create in Ember Adventures/i.test(characterCreationChoice.textContent || "") &&
                    /Use ChatGPT/i.test(characterCreationChoice.textContent || "") &&
                    /Use Codex/i.test(characterCreationChoice.textContent || ""),
                "Create Character opens the character creation choice panel with in-game, ChatGPT, and Codex options",
            );
            characterCreationChoice.querySelector("[data-character-creation-manual]")?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const manualCreateLayer = document.querySelector("[data-manual-character-create-layer='1']");
            devAssert(
                !!manualCreateLayer &&
                    /Create Character Definition/i.test(manualCreateLayer.textContent || "") &&
                    !!$("manualCharacterCreateEditor") &&
                    app.manualCharacterCreateMode === "library",
                "Create Character manual option opens a reusable-definition editor",
            );
            closeContainingPopup(manualCreateLayer);
            const discardPopup = [...document.querySelectorAll(".popup-modal")].find(popup =>
                popup.querySelector("h2")?.textContent === "Discard New Character?");
            devAssert(!!discardPopup, "closing the unused creator asks to discard it");
            discardPopup.querySelector("#confirmYesBtn").click();
            await devWaitFor(() => !manualCreateLayer.isConnected && app.manualCharacterDraft === null,
                2000, "unused character creator to close after discard");
            openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
            await new Promise((resolve) => setTimeout(resolve, 150));
            const libraryCards = [...$("modalBox").querySelectorAll("[data-character-library-card]")];
            setUnifiedLibraryColumns(2);
            devAssert(
                Number($("modalBox")?.querySelector?.("[data-library-columns-input='character']")?.value) === 2 &&
                    Number($("modalBox")?.querySelector?.("[data-library-home]")?.style.getPropertyValue("--library-columns")) === 2,
                "character library column selector updates the visible grid",
            );
            setUnifiedLibraryColumns(4);
            const miraCard = libraryCards.find((card) => /New Ally/i.test(card.textContent || ""));
            const miraRecordId = miraCard?.dataset.characterLibraryId || "";
            devAssert(!!miraRecordId, "character library card has stable definition id");
            const miraDefinition = characterLibraryRecordEntity(
                characterLibraryRecordById(miraRecordId),
            );
            devAssert(
                !Object.hasOwn(miraDefinition || {}, "clothing") &&
                    Array.isArray(miraDefinition?.outfits) &&
                    miraDefinition.outfits.length > 0,
                "character library definitions retain outfits but never runtime clothing",
                miraDefinition,
            );
            const definitionBoundaryState = {
                player: clone(app.state.player),
                players: [clone(app.state.player)],
                characters: { "New Ally": clone(app.state.characters?.["New Ally"]) },
                npc_directory: {
                    locations: {
                        "Smoke Room": {
                            characters: {
                                "Nara Quill": {
                                    name: "Nara Quill",
                                    full_character: clone(
                                        app.state.npc_directory?.locations?.["Smoke Room"]?.characters?.["Nara Quill"]?.full_character ||
                                            app.state.characters?.["New Ally"],
                                    ),
                                },
                            },
                        },
                    },
                },
                future_cast: {
                    items: {
                        "smoke-ally": {
                            full_character: clone(app.state.characters?.["New Ally"]),
                        },
                    },
                },
            };
            addImmutableDefinitionFieldsToState(definitionBoundaryState);
            const definitionCharacters = [
                definitionBoundaryState.player,
                definitionBoundaryState.players?.[0],
                definitionBoundaryState.characters?.["New Ally"],
                definitionBoundaryState.npc_directory?.locations?.["Smoke Room"]?.characters?.["Nara Quill"]?.full_character,
                definitionBoundaryState.future_cast?.items?.["smoke-ally"]?.full_character,
            ];
            devAssert(
                definitionCharacters.every(
                    (character) =>
                        !Object.hasOwn(character || {}, "clothing") &&
                        Array.isArray(character?.outfits) &&
                        character.outfits.length > 0,
                ),
                "story definition boundaries retain outfits but strip runtime clothing from every character container",
                definitionCharacters,
            );
            await openCharacterLibraryDetail(miraRecordId);
            const detailLayer = [...document.querySelectorAll(
                "[data-character-library-detail-modal='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-detail="${cssEscape(miraRecordId)}"]`,
                ),
            );
            const detailImagesButton = [...(detailLayer?.querySelectorAll?.("button") || [])]
                .find((button) => /^Images$/i.test(button.textContent?.trim() || ""));
            devAssert(
                /Character Definition/i.test(detailLayer?.textContent || "") &&
                    !!detailLayer?.querySelector?.("button[title='Edit definition']") &&
                    !detailImagesButton &&
                    !!detailLayer?.querySelector?.(".character-library-detail-image") &&
                    /Export/i.test(detailLayer?.textContent || "") &&
                    /Publish/i.test(detailLayer?.textContent || "") &&
                    !/\bShare\b/i.test(detailLayer?.textContent || ""),
                "character library card opens definition detail with intended library actions",
            );
            const detailSelector = `[data-character-library-detail="${cssEscape(miraRecordId)}"]`;
            for (let attempt = 0; attempt < 2; attempt++) {
                openCharacterLibrarySettings(miraRecordId);
                saveCharacterLibrarySettings();
                devAssert(
                    document.querySelectorAll(detailSelector).length === 1 &&
                        !document.querySelector("#characterLibrarySettingsEditor"),
                    "saving character settings returns to one detail panel without stacking copies",
                );
            }

            const galleryProfile = registerCharacterLibraryProfileEntity(miraRecordId);
            const galleryPopup = openProfileImagePopupModal(galleryProfile.name);
            const repeatedGalleryPopup = openProfileImagePopupModal(galleryProfile.name);
            devAssert(
                galleryPopup.overlay === repeatedGalleryPopup.overlay &&
                    [...document.querySelectorAll("[data-profile-image-modal]")].filter(
                        (modal) => modal.dataset.profileImageModal === galleryProfile.name,
                    ).length === 1,
                "repeated profile gallery opens reuse the same panel",
            );
            repeatedGalleryPopup.close();
            devAssert(
                document.querySelectorAll(detailSelector).length === 1,
                "closing the profile gallery once returns to one character detail panel",
            );
            openCharacterLibrarySettings(miraRecordId);
            await new Promise((resolve) => setTimeout(resolve, 150));
            const settingsLayer = [...document.querySelectorAll(
                "[data-character-library-layer='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-settings-id="${cssEscape(miraRecordId)}"]`,
                ),
            );
            devAssert(
                /Settings/i.test(settingsLayer?.textContent || "") &&
                    !/Voice gender bucket/i.test(settingsLayer?.textContent || "") &&
                    !/Default profile image prompt/i.test(
                        settingsLayer?.textContent || "",
                    ) &&
                    !/Default profile image URL/i.test(
                        settingsLayer?.textContent || "",
                    ) &&
                    !/Default profile image presentation/i.test(
                        settingsLayer?.textContent || "",
                    ) &&
                    /Default seed/i.test(settingsLayer?.textContent || "") &&
                    settingsLayer?.querySelector?.(
                        "#characterLibraryPreferredVoiceName",
                    )?.tagName === "SELECT" &&
                    /Automatic based on character gender/i.test(
                        settingsLayer?.querySelector?.(
                            "#characterLibraryPreferredVoiceName",
                        )?.textContent || "",
                    ),
                "character library settings opens definition-scoped settings",
            );
            closeContainingPopup(settingsLayer);
            editCharacterLibraryDefinition(miraRecordId);
            await new Promise((resolve) => setTimeout(resolve, 150));
            const editLayer = [...document.querySelectorAll(
                "[data-character-library-layer='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-edit-id="${cssEscape(miraRecordId)}"]`,
                ),
            );
            devAssert(
                !/\bGame Managed Data\b/i.test(editLayer?.textContent || ""),
                "character library definition editor hides Game Managed Data",
            );
            devAssertEditorPathVisible("#characterLibraryDefinitionEditor", ["character_definition", "outfits"], "definition editor exposes default outfits");
            devAssertEditorPathVisible("#characterLibraryDefinitionEditor", ["character_definition", "starting_outfit_id"], "definition editor exposes starting outfit");
            devAssertEditorPathHidden("#characterLibraryDefinitionEditor", ["character_definition", "clothing"], "definition editor hides runtime clothing");

            const outfitPath = ["character_definition", "outfits", 0, "clothing"];
            const outfitShirt = devFieldByPath("#characterLibraryDefinitionEditor", [...outfitPath, "shirt"]);
            const outfitPants = devFieldByPath("#characterLibraryDefinitionEditor", [...outfitPath, "pants"]);
            const outfitPanel = outfitShirt?.closest("details");
            devAssert(
                outfitPanel?.dataset.outfitEditor === "1" && !outfitPanel.open &&
                    outfitPanel.querySelector(":scope > summary").textContent ===
                        characterLibraryRecordEntity(characterLibraryRecordById(miraRecordId)).outfits[0].name &&
                    validClothingSlots().every((slot) => {
                        const field = devFieldByPath("#characterLibraryDefinitionEditor", [...outfitPath, slot]);
                        return field?.tagName === "TEXTAREA" && field.closest("details") === outfitPanel;
                    }) && !outfitPanel.querySelector(".clothing-remove"),
                "named collapsed outfit panel exposes every clothing slot directly without runtime inventory controls",
            );
            outfitPanel.open = true;
            outfitShirt.closest(".state-field").querySelector(".state-field-actions button").click();
            outfitShirt.value = "embroidered smoke test tunic";
            outfitShirt.dispatchEvent(new Event("input", { bubbles: true }));
            outfitPants.closest(".state-field").querySelector(".state-field-actions button").click();
            const definitionRoleField = devFieldByPath("#characterLibraryDefinitionEditor", [
                "character_definition",
                "role",
            ]);
            const definitionChestField = devFieldByPath("#characterLibraryDefinitionEditor", [
                "character_definition",
                "appearance",
                "chest",
            ]);
            devAssert(
                !!definitionRoleField && !!definitionChestField,
                "Character Library definition editor exposes editable role and chest fields",
            );
            definitionRoleField.value = "persisted definition editor scout";
            definitionChestField.value = "7";
            definitionRoleField.dispatchEvent(new Event("input", { bubbles: true }));
            definitionChestField.dispatchEvent(new Event("input", { bubbles: true }));
            definitionRoleField.dispatchEvent(new Event("blur", { bubbles: true }));
            saveCharacterLibraryDefinitionEditor({ close: false });
            await new Promise((resolve) => setTimeout(resolve, 150));
            const editedDefinitionRecord = characterLibraryRecordById(miraRecordId);
            devAssert(
                characterLibraryRecordEntity(editedDefinitionRecord)?.role ===
                    "persisted definition editor scout" &&
                    characterLibraryRecordEntity(editedDefinitionRecord)?.appearance?.chest ===
                        7 &&
                    !Object.hasOwn(
                        storedCharacterLibraryRecord(editedDefinitionRecord),
                        "kind",
                    ) &&
                    !Object.hasOwn(
                        storedCharacterLibraryRecord(editedDefinitionRecord),
                        "entity",
                    ),
                "Character Library definition edits save through the strict stored record without UI projection fields",
                editedDefinitionRecord,
            );
            await app.work.flush(
                `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
            );
            const storedDefinitionsAfterEdit = await loadPerRecordLibrary(
                CHARACTER_LIBRARY_KEY,
                [],
            );
            const storedDefinitionAfterEdit = storedDefinitionsAfterEdit.find(
                (item) => String(item?.id || "") === String(editedDefinitionRecord?.id || ""),
            );
            devAssert(
                storedDefinitionAfterEdit?.character?.role ===
                    "persisted definition editor scout" &&
                    storedDefinitionAfterEdit?.character?.appearance?.chest === 7,
                "Character Library definition edits survive a storage reload",
                storedDefinitionAfterEdit,
            );
            devAssert(
                storedDefinitionAfterEdit?.character?.outfits[0]?.clothing?.shirt === "embroidered smoke test tunic" &&
                    storedDefinitionAfterEdit?.character?.outfits[0]?.clothing?.pants === null,
                "outfit clothing edits and cleared slots survive storage reload, including retyping after Clear",
            );
            const reopenedOutfitEditor = document.createElement("div");
            reopenedOutfitEditor.innerHTML = buildCharacterDefinitionOnlyEditor(storedDefinitionAfterEdit.character);
            configureCharacterLibraryOutfitEditor(reopenedOutfitEditor);
            const reopenedShirt = [...reopenedOutfitEditor.querySelectorAll("[data-state-path]")].find(
                (field) => field.dataset.statePath === outfitShirt.dataset.statePath,
            );
            devAssert(
                reopenedShirt?.value === "embroidered smoke test tunic" && !reopenedShirt.closest("details").open,
                "reopened outfit editor shows the saved clothing in a collapsed named panel",
            );
            app.__emberAdventuresLastJsonDownload = null;
            exportCharacterLibraryDefinition(miraRecordId);
            const exportedCharacterDefinition =
                app.__emberAdventuresLastJsonDownload?.payload?.character_definition ||
                app.__emberAdventuresLastJsonDownload?.payload;
            await saveCharacterLibraryDefinitionEditor({ close: true });
            devAssert(
                document.querySelectorAll(detailSelector).length === 1 &&
                    !editLayer.isConnected,
                "saving the character definition replaces its previous detail panel",
            );
            closeContainingPopup(document.querySelector(detailSelector));
            openCharacterLibraryModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                characterLibraryActiveTab() === "local" &&
                    /\d+ characters? of \d+ total/i.test($("characterLibrarySearchCount-local")?.textContent || ""),
                "character library preserves the active Local tab and shows visible-of-total counts when reopened",
                {
                    activeTab: characterLibraryActiveTab(),
                    count: $("characterLibrarySearchCount-local")?.textContent || "",
                },
            );
            switchCharacterLibraryTab("local");
            $("characterLibrarySearch-local").value = "arcane";
            $("characterLibrarySearch-local").dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                /0 characters of \d+ total/i.test($("characterLibrarySearchCount-local")?.textContent || ""),
                "character library name search does not match role-only text",
                { count: $("characterLibrarySearchCount-local")?.textContent },
            );
            $("characterLibrarySearch-local").value = "New";
            $("characterLibrarySearch-local").dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                /1 character of \d+ total/i.test($("characterLibrarySearchCount-local")?.textContent || ""),
                "character library name search filters records",
                { count: $("characterLibrarySearchCount-local")?.textContent },
            );
            openCharacterLibraryModal({ fromMainMenu: true });
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                ![...document.querySelectorAll(".library-header-actions button")].some((button) =>
                    /^Account$/i.test((button.textContent || "").trim()),
                ),
                "Character Library header does not expose an Account button",
            );
            devAssert(
                !!$("modalBox")?.querySelector?.("[data-library-home][data-library-type='character']") &&
                    !![...$("modalBox").querySelectorAll(".library-kind-tabs button")].some((button) =>
                        /Characters/i.test(button.textContent || "") && button.classList.contains("active"),
                    ),
                "merged library selects its Characters view",
            );
            generateImageHtml = async () =>
                `<img src="${devSmokeOnePixelDataUrl()}" alt="Library profile smoke image">`;
            const importedRefreshDefinition = devSmokeCharacterRecord(
                "Imported Refresh Tester",
                {
                    character: {
                        role: "library refresh tester",
                        default_profile_image: {
                            ...emptyProfileImageSlot(false),
                            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                            source: "smoke",
                            seed: 1,
                            prompt: "Imported Refresh Tester",
                            note: "Smoke default image.",
                        },
                        profile_image_presentations: {
                            male: profileImageSlotFromExactInput({
                                ...emptyProfileImageSlot(true),
                            }),
                            non_male: profileImageSlotFromExactInput({
                                ...emptyProfileImageSlot(false),
                                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                                source: "smoke",
                                seed: 1,
                                prompt: "Imported Refresh Tester",
                                note: "Smoke default image.",
                            }),
                        },
                    },
                },
            ).character;
            await devImportCharacterDefinitionsFromRecords(
                [
                    { character_definition: importedRefreshDefinition },
                ],
            );
            await new Promise((resolve) => setTimeout(resolve, 150));
            document.querySelector(".popup-modal #noticeOkBtn")?.click();
            const importedRefreshRecord = (app.characterDefinitions || []).find(
                (item) => item.name === "Imported Refresh Tester",
            );
            const importedRefreshDefault =
                importedRefreshRecord?.character?.default_profile_image || {};
            const importedRefreshSceneImageId =
                "character-library-profile-related-scene-image";
            app.images = [
                {
                    id: importedRefreshSceneImageId,
                    saveId: String(activeSaveId() || ""),
                    at: new Date().toISOString(),
                    favorite: false,
                    title: "Unrelated scene title",
                    reason: "character library related-image identity smoke",
                    model: "default",
                    seed: 2,
                    prompt: "Imported Refresh Tester scene image",
                    negativePrompt: "",
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Related scene image">`,
                    requestedAt: new Date().toISOString(),
                    pending: false,
                    error: "",
                    targets: [importedRefreshRecord.id],
                    hideFromChat: false,
                    profile: false,
                    promptType: "normal scene image",
                },
                ...(app.images || []),
            ];
            devAssert(
                !!importedRefreshDefault.local_image_id &&
                    !!profileImageByStoreId(importedRefreshDefault.local_image_id) &&
                    !Array.isArray(importedRefreshRecord?.character?.profile_images_list),
                "importing a definition with hosted/default image copies it locally and stores only a default pointer",
                {
                    default_profile_image: importedRefreshDefault,
                    profile_images: importedRefreshRecord?.character?.profile_images,
                    storeImage: profileImageByStoreId(importedRefreshDefault.local_image_id),
                },
            );
            const importedRefreshProfileHandle =
                characterLibraryProfileName(importedRefreshRecord);
            devAssert(
                profileRelatedImages(importedRefreshProfileHandle).some(
                    (image) => String(image.id) === importedRefreshSceneImageId,
                ),
                "Character Library presentation handles resolve scene images targeted by stable character id",
                {
                    profileHandle: importedRefreshProfileHandle,
                    characterId: importedRefreshRecord.id,
                    relatedImageIds: profileRelatedImages(importedRefreshProfileHandle).map(
                        (image) => image.id,
                    ),
                },
            );
            openProfileImageModal(importedRefreshProfileHandle);
            await new Promise((resolve) => setTimeout(resolve, 100));
            const importedProfileImageModal = document.querySelector(
                "#modalBox [data-profile-image-modal]",
            );
            devAssert(
                !!importedProfileImageModal?.querySelector(".image-render img") &&
                    /Active Profile Image/i.test(
                        importedProfileImageModal?.textContent || "",
                    ),
                "character profile image history opens hosted/default imported images as active local history instead of a spinner",
                {
                    default_profile_image: importedRefreshDefault,
                    modalHtml: importedProfileImageModal?.innerHTML,
                },
            );
            devAssert(
                !!importedProfileImageModal?.querySelector(
                    `.profile-related-images [data-image-id="${importedRefreshSceneImageId}"]`,
                ),
                "Character Library profile viewer renders scene images associated by stable character id",
                { modalHtml: importedProfileImageModal?.innerHTML },
            );
            closeStoryLibraryPopups();
            document.querySelectorAll(".popup-modal.open").forEach(node => node.remove());
            app.__emberAdventuresLastJsonDownload = null;
            exportCharacterLibraryDefinition(characterLibraryRecordId(importedRefreshRecord));
            const exportedRefresh = app.__emberAdventuresLastJsonDownload?.payload;
            const exportedRefreshDefinition = exportedRefresh?.character_definition || exportedRefresh;
            const storedRefreshDefinition = storedCharacterLibraryRecord(
                importedRefreshRecord,
            ).character;
            devAssert(
                !!exportedRefreshDefinition?.default_profile_image?.local_image_id &&
                    JSON.stringify(exportedRefreshDefinition) ===
                        JSON.stringify(storedRefreshDefinition),
                "export after default-image copy preserves the exact valid character definition",
                { exportedRefresh, storedRefreshDefinition },
            );
            devAssert(
                /Imported Refresh Tester/i.test($("modalBox")?.textContent || "") &&
                    ![...$("modalBox").querySelectorAll("button")].some((button) =>
                        /^Characters$/i.test(button.textContent?.trim() || ""),
                    ),
                "character import refreshes the open main-menu Character Library list",
            );
            app.profileImageQueue = [];
            app.profileImageQueued = new Set();
            app.profileImageGenerating = new Set(["smoke-library-profile-setup"]);
            app.profileImageRequestOwnerById = {};
            app.activeProfileImageRequestByOwner = {};
            app.supersededProfileImageRequests = new Set();
            app.profileImageQueueRunning = false;
            openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
            const deferredProfileDefinition = devSmokeCharacterRecord(
                "Imported Profile Generator",
                {
                    character: {
                        role: "library profile generation tester",
                    },
                },
            ).character;
            deferredProfileDefinition.default_profile_image =
                emptyProfileImageSlot(false);
            deferredProfileDefinition.profile_image_presentations = {
                male: emptyProfileImageSlot(true),
                non_male: emptyProfileImageSlot(false),
            };
            await devImportCharacterDefinitionsFromRecords(
                [
                    { character_definition: deferredProfileDefinition },
                ],
            );
            const importedRecord = (app.characterDefinitions || []).find(
                (item) => item.name === "Imported Profile Generator",
            );
            const importedProfileRegistration = registerCharacterLibraryProfileEntity(
                importedRecord,
                importedRecord?.character?.gender,
            );
            const profileName = importedProfileRegistration?.name || "";
            const profilePresentationKey =
                importedProfileRegistration?.presentationKey || "non_male";
            devAssert(
                !activeProfileImage(importedRecord?.character) &&
                    !app.profileImageQueue?.some?.((item) => item?.name === profileName) &&
                    !app.profileImageQueued?.has?.(profileName) &&
                    !app.profileImageGenerating?.has?.(profileName),
                "importing a Character Library definition defers generated profile images",
                {
                    active: activeProfileImage(importedRecord?.character),
                    queue: app.profileImageQueue?.map?.((item) => item?.name),
                    queued: [...(app.profileImageQueued || new Set())],
                    generating: [...(app.profileImageGenerating || new Set())],
                },
            );
            document.querySelector(".popup-modal #noticeOkBtn")?.click();
            const importedRecordId = characterLibraryRecordId(importedRecord);
            switchCharacterLibraryTab("local");
            const localSearchInput = $("characterLibrarySearch-local");
            if (localSearchInput) {
                localSearchInput.value = "Imported Profile Generator";
                localSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
            }
            refreshCharacterLibraryActiveTabCards();
            devAssert(
                [...document.querySelectorAll("[data-character-library-card]")]
                    .some(
                        (card) =>
                            card.style.display !== "none" &&
                            /Imported Profile Generator/i.test(card.textContent || ""),
                ),
                "deferred Character Library profile generation target is visible before queueing",
            );
            const activeLibraryPanel = document.querySelector(
                `[data-character-library-tab-panel="${cssEscape(characterLibraryActiveTab())}"]`,
            );
            activeLibraryPanel?.querySelectorAll?.(
                "[data-character-library-card]",
            ).forEach((card) => {
                card.style.display = /Imported Profile Generator/i.test(
                    card.textContent || "",
                ) ? "" : "none";
            });
            app.profileImageGenerating.clear();
            await generateProfileImage(
                profileName,
                {
                    manual: true,
                    reason: "character library visible",
                    source: "character library visible",
                },
            );
            await devWaitFor(
                () => {
                    const currentRecord = characterLibraryRecordById(importedRecordId);
                    const registered = registerCharacterLibraryProfileEntity(currentRecord);
                    const image = activeProfileImage(registered?.entity);
                    return image && profileImageRealHtml(image.html || "");
                },
                10000,
                "visible Character Library definition profile image generation",
            );
            devAssert(
                !!activeProfileImage(profileEntity(profileName)),
                "visible Character Library definition generates the deferred profile image",
                {
                    recordId: importedRecordId,
                    activeImage: activeProfileImage(profileEntity(profileName)),
                },
            );
            // Profile portraits are shared-library records, not part of the
            // active-save lane. Flush their own ordered lane before asserting
            // the durable store and export contents.
            await app.work.flush(
                `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
            );
            await persistenceWorkerRequest("flush");
            const importedGeneratedImage = activeProfileImage(
                profileEntity(profileName),
            );
            const sharedProfileStore = await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []);
            app.__emberAdventuresLastJsonDownload = null;
            downloadJsonPayload = (payload, filename) => {
                app.__emberAdventuresLastJsonDownload = {
                    filename,
                    payload: clone(payload),
                    at: new Date().toISOString(),
                };
            };
            await exportData({
                fileName: "character-library-profile-persistence-smoke.json",
                scope: { saveIds: [] },
            });
            const exportedBackup = app.__emberAdventuresLastJsonDownload?.payload || {};
            devAssert(
                !!importedGeneratedImage?.id &&
                    Array.isArray(sharedProfileStore) &&
                    sharedProfileStore.some((image) => String(image?.id || "") === String(importedGeneratedImage.id)) &&
                    exportedBackup.schemaVersion === 2 &&
                    exportedBackup.imageArchiveRequired === true &&
                    !Object.hasOwn(exportedBackup, "profileImages") &&
                    !Object.hasOwn(exportedBackup, "storyTitleCardImages"),
                "Character Library generated profile images stay in shared storage while data backups require the complementary image archive",
                {
                    imageId: importedGeneratedImage?.id,
                    sharedProfileStoreCount: Array.isArray(sharedProfileStore) ? sharedProfileStore.length : null,
                    exportSchemaVersion: exportedBackup.schemaVersion,
                    imageArchiveRequired: exportedBackup.imageArchiveRequired,
                },
            );
            const reloadedDefinitionRecord = clone(importedRecord);
            if (reloadedDefinitionRecord?.character) {
                delete reloadedDefinitionRecord.character.profile_images;
                delete reloadedDefinitionRecord.character.profile_images_list;
                delete reloadedDefinitionRecord.character.profile_image_id;
                reloadedDefinitionRecord.character.default_profile_image =
                    profileImageSlotFromExactInput({
                        ...(reloadedDefinitionRecord.character.default_profile_image || {}),
                        local_image_id:
                            reloadedDefinitionRecord.character.default_profile_image
                                ?.local_image_id || importedGeneratedImage.id,
                    });
            }
            const previousProfileStoreForReload = app.profileImages;
            app.profileImages = exactProfileImageStore(sharedProfileStore);
            const reloadedActiveProfile = activeProfileImage(
                reloadedDefinitionRecord?.character,
            );
            app.profileImages = previousProfileStoreForReload;
            devAssert(
                reloadedActiveProfile?.id === importedGeneratedImage.id &&
                    profileImageRealHtml(reloadedActiveProfile.html || ""),
                "clean Character Library definitions recover their default local profile image after a reload",
                {
                    expectedImageId: importedGeneratedImage.id,
                    reloadedDefault:
                        reloadedDefinitionRecord?.character?.default_profile_image,
                    reloadedActiveProfile,
                },
            );
            await openCharacterLibraryDetail(importedRecordId);
            const importedDetail = [...document.querySelectorAll(
                "[data-character-library-detail-modal='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-detail="${cssEscape(importedRecordId)}"]`,
                ),
            );
            importedDetail?.querySelector?.(".character-library-detail-image")?.click();
            await devWaitFor(
                () =>
                    /Imported Profile Generator Profile Image/i.test(
                        document.querySelector(
                            ".popup-modal [data-profile-image-modal]",
                        )?.textContent || "",
                    ) &&
                    !!document.querySelector(
                        "[data-character-library-detail-modal='1']",
                    ),
                2000,
                "character definition profile image modal to open above detail",
            );
            devAssert(
                /Imported Profile Generator Profile Image/i.test(document.querySelector(".popup-modal [data-profile-image-modal]")?.textContent || "") &&
                    !!document.querySelector("[data-character-library-detail-modal='1']"),
                "clicking Character Definition image opens profile image UI above the definition layer",
            );
            document.querySelector(".popup-modal [data-profile-image-modal]")?.closest(".popup-modal")?.remove();
            closeContainingPopup(importedDetail);
            openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await openCharacterLibraryDetail(importedRecordId);
            const importedDetailForButton = [...document.querySelectorAll(
                "[data-character-library-detail-modal='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-detail="${cssEscape(importedRecordId)}"]`,
                ),
            );
            const imagesButton = [...(importedDetailForButton?.querySelectorAll?.("button") || [])].find(
                (button) => /^Images$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(
                !imagesButton,
                "Character Definition detail omits the redundant Images button",
            );
            importedDetailForButton
                ?.querySelector?.(".character-library-detail-image")
                ?.click();
            await devWaitFor(
                () =>
                    /Imported Profile Generator Profile Image/i.test(
                        document.querySelector(
                            ".popup-modal [data-profile-image-modal]",
                        )?.textContent || "",
                    ) &&
                    !!document.querySelector(
                        "[data-character-library-detail-modal='1']",
                    ),
                2000,
                "character definition profile image-only entry point to open",
            );
            devAssert(
                /Imported Profile Generator Profile Image/i.test(document.querySelector(".popup-modal [data-profile-image-modal]")?.textContent || "") &&
                    !!document.querySelector("[data-character-library-detail-modal='1']"),
                "Character Definition profile image remains the only profile image UI entry point",
            );
            const firstProfile = activeProfileImage(profileEntity(profileName));
            const alternateProfile = rememberProfileImage(
                profileName,
                {
                    id: "library-profile-active-smoke",
                    source: "smoke alternate",
                    model: "debug",
                    seed: 2,
                    prompt: "Alternate library profile image.",
                    negativePrompt: "",
                    html: `<img src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='400'><rect width='320' height='400' fill='#654'/><text x='20' y='60' fill='white'>Library active smoke</text></svg>`)}" alt="Alternate library profile smoke image">`,
                    profile: true,
                },
                { setActive: false },
            );
            refreshProfileImageSurfaces(profileName);
            const alternateUseThisButton = document.querySelector(
                `.popup-modal [data-profile-image-id="${cssEscape(String(alternateProfile.id))}"] [data-profile-action="select"]`,
            );
            devAssert(
                !!alternateUseThisButton && !alternateUseThisButton.disabled,
                "Character Library profile image Use This button is clickable for inactive images",
            );
            await alternateUseThisButton.onclick();
            const refreshedImportedRecord = (app.characterDefinitions || []).find(
                (item) => item.name === "Imported Profile Generator",
            );
            devAssert(
                firstProfile?.id !== alternateProfile.id &&
                    refreshedImportedRecord?.active_profile_image_ids?.[
                        profilePresentationKey
                    ] === alternateProfile.id &&
                    refreshedImportedRecord?.character?.default_profile_image?.local_image_id === alternateProfile.id &&
                    refreshedImportedRecord?.character?.default_profile_image?.seed === alternateProfile.seed &&
                    refreshedImportedRecord?.character?.default_seed === alternateProfile.seed &&
                    refreshedImportedRecord?.character?.image_prompt_config?.seed === alternateProfile.seed &&
                    document.querySelector(".popup-modal [data-profile-seed-input]")?.value ===
                        String(alternateProfile.seed) &&
                    activeProfileImage(refreshedImportedRecord?.character)?.id === alternateProfile.id &&
                    /Active Profile Image/i.test(document.querySelector(".popup-modal [data-profile-image-modal]")?.textContent || ""),
                "Character Library profile Use This persists, labels the selected image as Active, and saves the selected image seed as the definition seed",
                {
                    active_profile_image_ids:
                        refreshedImportedRecord?.active_profile_image_ids,
                    default_profile_image: refreshedImportedRecord?.character?.default_profile_image,
                    default_seed: refreshedImportedRecord?.character?.default_seed,
                    image_prompt_config_seed:
                        refreshedImportedRecord?.character?.image_prompt_config?.seed,
                    visible_seed_input: document.querySelector(
                        ".popup-modal [data-profile-seed-input]",
                    )?.value,
                    active: activeProfileImage(refreshedImportedRecord?.character)?.id,
                    alternate: alternateProfile.id,
                    buttonText: alternateUseThisButton.textContent,
                },
            );
            await app.work.flush(
                `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
            );
            const storedDefinitionsAfterProfileSelection = await loadPerRecordLibrary(
                CHARACTER_LIBRARY_KEY,
                [],
            );
            const reloadedProfileSelectionRecord =
                storedDefinitionsAfterProfileSelection.find(
                    (item) => item?.name === "Imported Profile Generator",
                );
            devAssert(
                reloadedProfileSelectionRecord?.active_profile_image_ids?.[
                    profilePresentationKey
                ] === alternateProfile.id &&
                    reloadedProfileSelectionRecord?.character?.default_profile_image
                        ?.local_image_id === alternateProfile.id,
                "Character Library profile Use This survives a character-library storage reload",
                reloadedProfileSelectionRecord,
            );
            const maleRegistration = registerCharacterLibraryProfileEntity(
                refreshedImportedRecord,
                "male",
            );
            const malePrompt = buildProfileImagePrompt(
                maleRegistration.name,
                maleRegistration.entity,
            );
            devAssert(
                maleRegistration.presentationKey === "male" &&
                    maleRegistration.name !== profileName &&
                    profileImageOwnerKey(
                        maleRegistration.name,
                        maleRegistration.entity,
                    ) !== profileImageOwnerKey(
                        profileName,
                        profileEntity(profileName),
                    ) &&
                    /adult (?:male|man)/i.test(malePrompt),
                "Character Library male presentation has an independent request owner and male prompt",
                {
                    maleName: maleRegistration.name,
                    nonMaleName: profileName,
                    malePrompt,
                },
            );
            const maleProfile = rememberProfileImage(
                maleRegistration.name,
                {
                    id: "library-profile-male-active-smoke",
                    source: "smoke male alternate",
                    model: "debug",
                    seed: 3,
                    prompt: "Alternate male library profile image.",
                    negativePrompt: "",
                    html: `<img src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='400'><rect width='320' height='400' fill='#345'/><text x='20' y='60' fill='white'>Library male smoke</text></svg>`)}" alt="Alternate male library profile smoke image">`,
                    profile: true,
                    male: true,
                },
                { setActive: true },
            );
            syncCharacterLibraryProfileSelection(
                maleRegistration.name,
                maleProfile.id,
            );
            const dualPresentationRecord = characterLibraryRecordById(
                importedRecordId,
            );
            const reloadedMale = registerCharacterLibraryProfileEntity(
                dualPresentationRecord,
                "male",
            );
            const reloadedNonMale = registerCharacterLibraryProfileEntity(
                dualPresentationRecord,
                "female",
            );
            devAssert(
                dualPresentationRecord.active_profile_image_ids.male ===
                    maleProfile.id &&
                    dualPresentationRecord.active_profile_image_ids.non_male ===
                        alternateProfile.id &&
                    activeProfileImage(reloadedMale.entity)?.id === maleProfile.id &&
                    activeProfileImage(reloadedNonMale.entity)?.id ===
                        alternateProfile.id,
                "Character Library preserves independent active male and non-male profile images",
                {
                    activeIds: dualPresentationRecord.active_profile_image_ids,
                    maleActive: activeProfileImage(reloadedMale.entity)?.id,
                    nonMaleActive: activeProfileImage(reloadedNonMale.entity)?.id,
                },
            );
            devAssert(
                !!document.querySelector(`[data-character-library-detail="${cssEscape(importedRecordId)}"] [data-profile-live-id="${cssEscape(alternateProfile.id)}"]`),
                "Character Definition detail image refreshes to the active library profile image",
            );
            app.settings.imageLabWarningAccepted = true;
            const profilePopup = document.querySelector(".popup-modal [data-profile-image-modal]")?.closest(".popup-modal");
            const labButton = [...(profilePopup?.querySelectorAll?.("button") || [])].find(
                (button) => /^Image Lab$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!labButton, "Character Library profile image UI has a dedicated Image Lab button");
            labButton.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !!document.querySelector("[data-image-lab-popup='1']") &&
                    !!document.querySelector(".popup-modal [data-profile-image-modal]") &&
                    !!document.querySelector("[data-character-library-detail-modal='1']"),
                "Character Library Image Lab opens above the profile image and definition layers",
            );
            const labPrompt = document.querySelector("[data-image-lab-popup='1'] #labPrompt");
            if (labPrompt)
                labPrompt.value =
                    "Imported Profile Generator, fully clothed library portrait, fantasy character card art";
            const profileCountBeforeLabGenerate = profileImagesForEntity(
                profileEntity(profileName) || {},
            ).length;
            const immediateGenerateImageHtml = generateImageHtml;
            generateImageHtml = async (...args) => {
                await new Promise((resolve) => setTimeout(resolve, 350));
                return immediateGenerateImageHtml(...args);
            };
            document.querySelector("[data-image-lab-popup='1'] #labGenerateBtn")?.click();
            await devWaitFor(
                () => {
                    const labImage = profileImagesForEntity(
                        profileEntity(profileName) || {},
                    ).find((image) => image.source === "image lab");
                    return (
                        !!labImage?.pending &&
                        !!document.querySelector(
                            `.popup-modal [data-profile-image-id="${cssEscape(String(labImage.id || ""))}"]`,
                        )
                    );
                },
                1000,
                "Character Library Image Lab pending profile image card to appear",
            );
            await devWaitFor(
                () =>
                    profileImagesForEntity(profileEntity(profileName) || {}).some(
                        (image) =>
                            image.source === "image lab" &&
                            image.pending === false &&
                            devLooksLikeRealImageHtml(image.html),
                    ),
                5000,
                "Character Library Image Lab profile image to save",
            );
            const labProfileImage = profileImagesForEntity(
                profileEntity(profileName) || {},
            ).find(
                (image) =>
                    image.source === "image lab" &&
                    image.pending === false &&
                    devLooksLikeRealImageHtml(image.html),
            );
            devAssert(
                !document.querySelector("[data-image-lab-popup='1']") &&
                    !!document.querySelector(".popup-modal [data-profile-image-modal]") &&
                    !!document.querySelector("[data-character-library-detail-modal='1']") &&
                    profileImagesForEntity(profileEntity(profileName) || {}).length >
                        profileCountBeforeLabGenerate &&
                    !!document.querySelector(
                        `.popup-modal [data-profile-image-id="${cssEscape(String(labProfileImage?.id || ""))}"]`,
                    ),
                "generating from stacked Image Lab closes only Image Lab and shows the new profile image in the profile image UI",
            );
            const afterLabRecord = characterLibraryRecordById(importedRecordId);
            devAssert(
                afterLabRecord?.active_profile_image_ids?.non_male ===
                    labProfileImage?.id,
                "Character Library Image Lab generation stores the new local image for the active presentation",
                {
                    active_profile_image_ids:
                        afterLabRecord?.active_profile_image_ids,
                    labProfileImage,
                },
            );
            generateImageHtml = immediateGenerateImageHtml;
            document.querySelector(".popup-modal [data-profile-image-modal]")?.closest(".popup-modal")?.remove();
            closeContainingPopup(document.querySelector("[data-character-library-detail-modal='1']"));
            openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
            await new Promise((resolve) => setTimeout(resolve, 100));
            await openCharacterLibraryDetail(importedRecordId);
            const deleteDetail = [...document.querySelectorAll(
                "[data-character-library-detail-modal='1']",
            )].find((layer) =>
                layer.querySelector(
                    `[data-character-library-detail="${cssEscape(importedRecordId)}"]`,
                ),
            );
            const libraryDeleteButton = [...(deleteDetail?.querySelectorAll?.("button") || [])].find(
                (button) => /^Delete$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!libraryDeleteButton, "Character Definition detail has Delete button");
            libraryDeleteButton.click();
            const deletionConfirmation = () => [...document.querySelectorAll(".popup-modal")].find(popup =>
                popup.querySelector("h2")?.textContent === "Delete Character Definition" &&
                popup.textContent.includes(importedRecord.name));
            await devWaitFor(() => !!deletionConfirmation()?.querySelector("#confirmYesBtn"),
                2000, "character definition deletion confirmation");
            deletionConfirmation().querySelector("#confirmYesBtn").click();
            const characterDeleteFinished = () =>
                !document.querySelector(`[data-character-library-detail="${cssEscape(importedRecordId)}"]`) &&
                !(app.characterDefinitions || []).some(
                    (item) => item.id === importedRecord?.id,
                ) &&
                $("modalBox")?.matches?.("[data-character-library-modal='1']") &&
                characterLibraryActiveTab() === "local" &&
                !document.querySelector(
                    `[data-character-library-id="${cssEscape(importedRecordId)}"]`,
                ) &&
                /New Ally/i.test(
                    document.querySelector(
                        "[data-character-library-results='local']",
                    )?.textContent || "",
                );
            await devWaitFor(
                characterDeleteFinished,
                8000,
                "Character Library deletion and Local tab refresh",
            );
            devAssert(
                characterDeleteFinished(),
                "deleting a Character Library definition closes only its detail layer and refreshes the current tab in place",
            );

            assertRuntimeSceneReferences(app.state);
            openCharactersModal();
            devAssert(
                /Characters/i.test($("modalBox")?.textContent || "") &&
                    /New Ally/i.test($("modalBox")?.textContent || "") &&
                    /Tor Bran/i.test($("modalBox")?.textContent || "") &&
                    /NPCs/i.test($("modalBox")?.textContent || "") &&
                    /Iris Hale/i.test($("modalBox")?.textContent || "") &&
                    /Party/i.test($("modalBox")?.textContent || "") &&
                    /Make Character With AI/i.test($("modalBox")?.textContent || "") &&
                    /Make Character Manually/i.test($("modalBox")?.textContent || "") &&
                    /Add from Library/i.test($("modalBox")?.textContent || "") &&
                    !/Import Character|Import NPC|Character Library/i.test($("modalBox")?.textContent || ""),
                "in-game Characters menu combines Party and all known NPCs with Add from Library controls and hides direct file imports",
            );
            openProfileImageModal("New Ally");
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !!document.querySelector(".popup-modal [data-profile-image-modal]") &&
                    /Characters/i.test($("modalBox")?.textContent || "") &&
                    !!$("characterDirectorySearch"),
                "Characters menu opens profile image picker as a stacked layer",
            );
            document
                .querySelector(".popup-modal [data-profile-image-modal]")
                ?.closest(".popup-modal")
                ?.remove();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !document.querySelector(".popup-modal [data-profile-image-modal]") &&
                    /Characters/i.test($("modalBox")?.textContent || "") &&
                    !!$("characterDirectorySearch"),
                "closing stacked profile image picker returns to Characters menu",
            );
            $("characterDirectorySearch").value = "shield";
            $("characterDirectorySearch").dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                /1 matching character/i.test($("characterDirectorySearchCount")?.textContent || ""),
                "current cast search filters records",
                { count: $("characterDirectorySearchCount")?.textContent },
            );

            openCharactersModal();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const addFromLibraryButtons = [...$("modalBox").querySelectorAll("button")].filter(
                (button) => /^Add from Library$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(
                addFromLibraryButtons.length === 1,
                "in-game Characters menu has one Add from Library action with a target toggle",
                { count: addFromLibraryButtons.length },
            );
            addFromLibraryButtons[0].click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                !!document.querySelector("[data-cast-library-picker='party']") &&
                    !!document
                        .querySelector("[data-cast-library-picker='party']")
                        ?.matches("[data-fullscreen-list-modal='1']") &&
                    /Party Member/i.test(document.body.textContent || "") &&
                    /NPC/i.test(document.body.textContent || "") &&
                    /Library Party Recruit/i.test(document.body.textContent || ""),
                "Add from Library opens local character definition picker with Party Member/NPC toggle",
            );
            const partyPicker = document.querySelector("[data-cast-library-picker='party']");
            partyPicker.querySelector("#castLibrarySearch").value = "Library Party Recruit";
            filterCastAddFromLibrary("Library Party Recruit");
            const partyAddButton = [...partyPicker.querySelectorAll("button")].find(
                (button) =>
                    /Library Party Recruit/i.test(button.textContent || "") &&
                    /Add Party Member/i.test(button.textContent || ""),
            );
            devAssert(!!partyAddButton, "party library picker has Add Party Member action");

            const partyRecord = localCharacterLibraryRecordsForCast().find(
                (record) => record.name === "Library Party Recruit",
            );
            devAssert(
                !!partyRecord,
                "party library picker resolves the selected local definition",
                { records: localCharacterLibraryRecordsForCast().map((record) => record.name) },
            );
            addCharacterFromLibrary(characterLibraryRecordId(partyRecord), "party");
            await devWaitFor(
                () =>
                    !!app.state.characters["Library Party Recruit"] &&
                    !!activeProfileImage(app.state.characters["Library Party Recruit"]),
                3000,
                "library party member add and copied profile image",
            );
            devAssert(
                !!app.state.characters["Library Party Recruit"] &&
                    (app.state.scene.party_members_present || []).includes(
                        "Library Party Recruit",
                    ) &&
                    !!activeProfileImage(app.state.characters["Library Party Recruit"]) &&
                    !!$("characterDirectorySearch") &&
                    !$("characterDirectorySearch").value &&
                    /New Ally/i.test($("modalBox")?.textContent || "") &&
                    /Tor Bran/i.test($("modalBox")?.textContent || "") &&
                    /Library Party Recruit/i.test($("modalBox")?.textContent || ""),
                "adding a party member from library refreshes the Characters UI without filtering out existing characters and copies the default profile image",
                {
                    character: app.state.characters["Library Party Recruit"],
                    scene: app.state.scene.party_members_present,
                    active: activeProfileImage(
                        app.state.characters["Library Party Recruit"],
                    ),
                },
            );

            openCharactersModal();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const npcLibraryButton = [...$("modalBox").querySelectorAll("button")].find(
                (button) => /^Add from Library$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!npcLibraryButton, "Characters menu still has Add from Library after adding a party member");
            npcLibraryButton.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            setCastLibraryPickerMode("npc");
            await new Promise((resolve) => setTimeout(resolve, 100));
            const npcPicker = document.querySelector("[data-cast-library-picker='npc']");
            devAssert(
                !!npcPicker && /Nolan Reed/i.test(npcPicker.textContent || ""),
                "Add from Library toggle switches the picker to NPC mode",
            );
            npcPicker.querySelector("#castLibrarySearch").value = "Nolan Reed";
            filterCastAddFromLibrary("Nolan Reed");
            const npcAddButton = [...npcPicker.querySelectorAll("button")].find(
                (button) => /Add NPC/i.test(button.textContent || ""),
            );
            devAssert(!!npcAddButton, "NPC library picker has Add NPC action");
            const npcRecord = localCharacterLibraryRecordsForCast().find(
                (record) => record.name === "Nolan Reed",
            );
            devAssert(
                !!npcRecord,
                "NPC library picker resolves the selected local definition",
                { records: localCharacterLibraryRecordsForCast().map((record) => record.name) },
            );
            addCharacterFromLibrary(characterLibraryRecordId(npcRecord), "npc");
            await devWaitFor(
                () => {
                    const npc = findNpcInDirectory(
                        app.state.npc_directory,
                        "Nolan Reed",
                    )?.npc;
                    return !!npc?.full_character && !!activeProfileImage(npc.full_character);
                },
                3000,
                "library NPC add and profile generation",
            );
            const addedLibraryNpc = findNpcInDirectory(
                app.state.npc_directory,
                "Nolan Reed",
            )?.npc;
            devAssert(
                !!addedLibraryNpc?.full_character &&
                    addedLibraryNpc.inspected === true &&
                    (app.state.scene.npcs_present || []).includes("Nolan Reed") &&
                    !!activeProfileImage(addedLibraryNpc.full_character) &&
                    !!$("characterDirectorySearch") &&
                    !$("characterDirectorySearch").value &&
                    /New Ally/i.test($("modalBox")?.textContent || "") &&
                    /Nolan Reed/i.test($("modalBox")?.textContent || "") &&
                    /Iris Hale/i.test($("modalBox")?.textContent || ""),
                "adding an NPC from library refreshes the Characters UI without filtering out existing characters and copies the profile image",
                {
                    npc: addedLibraryNpc,
                    sceneNpcs: app.state.scene.npcs_present,
                    active: activeProfileImage(addedLibraryNpc?.full_character),
                },
            );
            openNpcDirectoryModal();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                /Known Characters/i.test($("modalBox")?.textContent || "") &&
                    /Add from Library/i.test($("modalBox")?.textContent || "") &&
                    !/Import Character/i.test($("modalBox")?.textContent || ""),
                "legacy NPC directory also uses Add from Library instead of direct file import",
            );
            openCharactersModal();
            await new Promise((resolve) => setTimeout(resolve, 100));

            const aiCreateButton = [...$("modalBox").querySelectorAll("button")].find(
                (button) => /Make Character With AI$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!aiCreateButton, "in-game Characters menu has a Make Character With AI action");
            aiCreateButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                !!document.querySelector("[data-character-generator-layer='1']") &&
                    /Characters/i.test($("modalBox")?.textContent || "") &&
                    !!$("characterDirectorySearch") &&
                    !!$("characterPrompt") &&
                    /Party Member/i.test(
                        document.querySelector("[data-character-generator-layer='1']")?.textContent || "",
                    ) &&
                    /NPC/i.test(
                        document.querySelector("[data-character-generator-layer='1']")?.textContent || "",
                    ),
                "Make Character With AI opens over the Characters menu with Party Member/NPC toggle",
            );
            document.querySelector("[data-character-generator-layer='1']")?.closest(".popup-modal")?.remove();
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                /Characters/i.test($("modalBox")?.textContent || "") &&
                    !!$("characterDirectorySearch"),
                "closing Make Character With AI returns to the Characters menu",
            );
            openCharactersModal();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const manualCreateButton = [...$("modalBox").querySelectorAll("button")].find(
                (button) => /^Make Character Manually$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!manualCreateButton, "in-game Characters menu has a Make Character Manually action");
            manualCreateButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                !!document.querySelector("[data-manual-character-create-layer='1']") &&
                    /Characters/i.test($("modalBox")?.textContent || "") &&
                    !!$("characterDirectorySearch") &&
                    !!$("manualCharacterCreateEditor") &&
                    /Party Member/i.test(
                        document.querySelector("[data-manual-character-create-layer='1']")?.textContent || "",
                    ) &&
                    /NPC/i.test(
                        document.querySelector("[data-manual-character-create-layer='1']")?.textContent || "",
                    ),
                "Create opens the manual character creator over the Characters menu with Party Member/NPC toggle",
            );
            const partyNameField = devFieldByPath("#manualCharacterCreateEditor", [
                "character_definition",
                "name",
            ]);
            devAssert(!!partyNameField, "Create Party Member editor exposes editable name field");
            partyNameField.value = "Manual Ally";
            partyNameField.dispatchEvent(new Event("input", { bubbles: true }));
            partyNameField.dispatchEvent(new Event("change", { bubbles: true }));
            for (const outfit of [...app.manualCharacterDraft.outfits, ...app.manualCharacterDraft.fallback_outfits])
                outfit.name = "Smoke Outfit";
            for (const field of $("manualCharacterCreateEditor").querySelectorAll("[data-state-path]")) {
                const path = JSON.parse(decodeURIComponent(field.dataset.statePath));
                if (path.at(-1) === "name" && path.some(key => key === "outfits" || key === "fallback_outfits"))
                    field.value = "Smoke Outfit";
            }
            {
                const manualSmokeName = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "name"]);
                if (!manualSmokeName.value) manualSmokeName.value = "New Ally";
                for (const [path, value] of [
                    [["age"], "30"], [["gender"], "female"],
                    [["role"], "Smoke companion"], [["personality_description"], "A patient synthetic test companion."],
                    [["appearance", "species"], "human"],
                ]) {
                    const field = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", ...path]);
                    field.value = value;
                }
            }
            await saveManualCharacterCreateModal();
            await new Promise((resolve) => setTimeout(resolve, 250));
            devAssert(
                !!app.state.characters["Manual Ally"] &&
                    /Edit Manual Ally/i.test($("modalBox")?.textContent || ""),
                "Create defaults to a party member and opens its edit modal",
                app.state.characters["Manual Ally"],
            );
            devAssert(
                !/Export|Share|Publish/i.test($("modalBox")?.textContent || ""),
                "in-game character edit modal does not expose export/share/publish",
            );

            const deleteButton = [...$("modalBox").querySelectorAll("button")].find(
                (button) => /Delete/i.test(button.textContent || ""),
            );
            devAssert(!!deleteButton, "edit character modal has Delete button");
            deleteButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Delete Character/i.test(document.body.textContent || "") &&
                    !!document.querySelector(".popup-modal #confirmYesBtn"),
                "Delete Character opens visible confirmation",
            );
            document.querySelector(".popup-modal #confirmYesBtn").click();
            await new Promise((resolve) => setTimeout(resolve, 250));
            devAssert(
                !app.state.characters["Manual Ally"],
                "Delete Character removes added party member from state",
                app.state.characters,
            );

            openCharactersModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                !/Manual Ally/i.test($("modalBox")?.textContent || ""),
                "deleted party member is absent when Characters menu reopens",
            );

            const addNpcButton = [...$("modalBox").querySelectorAll("button")].find(
                (button) => /^Make Character Manually$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!addNpcButton, "Characters menu manual create action can also create an NPC");
            addNpcButton.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            setManualCharacterCreateTargetMode("npc");
            await new Promise((resolve) => setTimeout(resolve, 100));
            devAssert(
                $("manualCharacterCreateTargetMode")?.value === "npc" &&
                    /Save NPC/i.test($("manualCharacterCreateSaveButton")?.textContent || "") &&
                    !!$("manualCharacterCreateEditor"),
                "Create target toggle switches the manual editor to NPC mode",
            );
            const npcNameField = devFieldByPath("#manualCharacterCreateEditor", [
                "character_definition",
                "name",
            ]);
            devAssert(!!npcNameField, "Create NPC editor exposes editable NPC name field");
            npcNameField.value = "Nora Slate";
            npcNameField.dispatchEvent(new Event("input", { bubbles: true }));
            npcNameField.dispatchEvent(new Event("change", { bubbles: true }));
            for (const outfit of [...app.manualCharacterDraft.outfits, ...app.manualCharacterDraft.fallback_outfits])
                outfit.name = "Smoke Outfit";
            for (const field of $("manualCharacterCreateEditor").querySelectorAll("[data-state-path]")) {
                const path = JSON.parse(decodeURIComponent(field.dataset.statePath));
                if (path.at(-1) === "name" && path.some(key => key === "outfits" || key === "fallback_outfits"))
                    field.value = "Smoke Outfit";
            }
            {
                const manualSmokeName = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "name"]);
                if (!manualSmokeName.value) manualSmokeName.value = "New Ally";
                for (const [path, value] of [
                    [["age"], "30"], [["gender"], "female"],
                    [["role"], "Smoke companion"], [["personality_description"], "A patient synthetic test companion."],
                    [["appearance", "species"], "human"],
                ]) {
                    const field = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", ...path]);
                    field.value = value;
                }
            }
            await saveManualCharacterCreateModal();
            await new Promise((resolve) => setTimeout(resolve, 250));
            const createdNpc = findNpcInDirectory(app.state.npc_directory, "Nora Slate");
            devAssert(
                !!createdNpc?.npc?.full_character &&
                    (app.state.scene.npcs_present || []).includes("Nora Slate") &&
                    /Edit NPC|Nora Slate/i.test($("modalBox")?.textContent || ""),
                "Create NPC saves an inspected scene NPC from a character definition",
                { createdNpc, sceneNpcs: app.state.scene.npcs_present },
            );

            closeModal();
            openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
            await new Promise((resolve) => setTimeout(resolve, 150));
            const chatTargetRecord = (app.characterDefinitions || []).find(
                (record) => record.name === "New Ally",
            );
            const chatPlayerRecord = (app.characterDefinitions || []).find(
                (record) => record.name === "Tor Bran",
            );
            const chatTargetRecordId = characterLibraryRecordId(chatTargetRecord);
            const chatPlayerRecordId = characterLibraryRecordId(chatPlayerRecord);
            devAssert(
                !!chatTargetRecordId && !!chatPlayerRecordId,
                "character chat smoke has target and player library definitions",
                {
                    records: (app.characterDefinitions || []).map((record) => ({
                        id: characterLibraryRecordId(record),
                        name: record.name,
                    })),
                },
            );
            const legacyRuntimeInventory = (label) => [
                `${label} stale item 1`,
                `${label} stale item 2`,
                `${label} stale item 3`,
                `${label} stale item 4`,
                { itemId: `${label.toLowerCase().replace(/\s+/g, "-")}-legacy-item` },
            ];
            const legacyPlayerInventory = legacyRuntimeInventory("Tor Bran");
            const legacyTargetInventory = legacyRuntimeInventory("New Ally");
            const authoredChatStory =
                "New Ally has invited |[player_name]| to inspect a sealed map before deciding who can be trusted with it.";
            const expectedAuthoredChatStory =
                "New Ally has invited Tor Bran to inspect a sealed map before deciding who can be trusted with it.";
            const authoredChatOpeningMessage =
                `(New Ally) "The archive is locked, |[player_name]|. I need your judgment before I break the seal."`;
            const authoredChatLocation = {
                label: "Moonlit Archive",
                place: "a moonlit archive lined with sealed map cases",
                activity: "standing together beside a sealed map case in the moonlit archive",
            };
            const attachedChatStory = storyDefinitionForExport(
                devSmokeStoryRecord({
                    id: attachedStoryLibraryId,
                    title: "The Sealed Map",
                    description:
                        "Help New Ally investigate a sealed map and decide who can be trusted with it.",
                    allow_any_player: true,
                    characters: {},
                    party_members_present: [],
                    image_characters: [],
                    opening_text:
                        '(New Ally) "You made it. The sealed map is waiting for us in the archive."',
                }),
            );
            chatTargetRecord.character.catalog_hook =
                "An arcane scout with a sealed map, a dangerous secret, and one chance to choose the right partner.";
            chatTargetRecord.character.chat_story = authoredChatStory;
            chatTargetRecord.character.chat_opening_message = authoredChatOpeningMessage;
            chatTargetRecord.character.chat_starting_location = clone(authoredChatLocation);
            chatTargetRecord.character.chat_story_template = clone(attachedChatStory);
            await saveCharacterLibraryRecordsNow(
                [chatTargetRecord],
                "character chat smoke authored launch definitions",
            );
            const chatDefinitionProjection = characterDefinitionProjectionForExport(
                chatTargetRecord,
            );
            const chatDefinitionValidation = validateCharacterDefinition(
                chatDefinitionProjection,
                "character chat smoke definition",
            );
            const embeddedChatDefinitionValidation = validateCharacterDefinition(
                chatDefinitionProjection,
                "character chat smoke embedded definition",
                { embedded: true },
            );
            const duplicatePrincipalStory = clone(attachedChatStory);
            duplicatePrincipalStory.state.characters[chatTargetRecordId] =
                standaloneCharacterStoryProjection(chatTargetRecord.character);
            const duplicatePrincipalDefinition = clone(chatDefinitionProjection);
            duplicatePrincipalDefinition.chat_story_template = duplicatePrincipalStory;
            const duplicatePrincipalValidation = validateCharacterDefinition(
                duplicatePrincipalDefinition,
                "character chat smoke duplicate principal",
            );
            const duplicatePrincipalContainers = [
                {
                    label: "player",
                    apply: (story, character) => {
                        story.state.player = character;
                    },
                },
                {
                    label: "player option",
                    apply: (story, character) => {
                        story.state.players = [character];
                    },
                },
                {
                    label: "NPC",
                    apply: (story, character) => {
                        story.state.npc_directory.locations["smoke-fixture-room"] = {
                            label: "Smoke Fixture Room",
                            characters: {
                                principal: {
                                    name: character.name,
                                    age: character.age,
                                    gender: character.gender,
                                    role: character.role,
                                    relationship:
                                        character.starting_relationship_to_player,
                                    note: "Duplicate principal smoke fixture.",
                                    inspected: true,
                                    full_character: character,
                                },
                            },
                        };
                    },
                },
                {
                    label: "future cast",
                    apply: (story, character) => {
                        story.state.future_cast = {
                            enabled: true,
                            items: {
                                principal: {
                                    id: "principal",
                                    name: character.name,
                                    scene_presence: "none",
                                    full_character: character,
                                },
                            },
                        };
                    },
                },
            ].map(({ label, apply }) => {
                const story = clone(attachedChatStory);
                apply(
                    story,
                    standaloneCharacterStoryProjection(chatTargetRecord.character),
                );
                const definition = clone(chatDefinitionProjection);
                definition.chat_story_template = story;
                return {
                    label,
                    validation: validateCharacterDefinition(
                        definition,
                        `character chat smoke duplicate principal ${label}`,
                    ),
                };
            });
            const attachedStoryDefinitionChecks = {
                validates: chatDefinitionValidation.ok,
                catalogHook:
                    chatDefinitionProjection.catalog_hook ===
                    chatTargetRecord.character.catalog_hook,
                chatStory: chatDefinitionProjection.chat_story === authoredChatStory,
                opening:
                    chatDefinitionProjection.chat_opening_message ===
                    authoredChatOpeningMessage,
                location:
                    stableJsonString(chatDefinitionProjection.chat_starting_location) ===
                    stableJsonString(authoredChatLocation),
                attachedTitle:
                    chatDefinitionProjection.chat_story_template?.title ===
                    attachedChatStory.title,
                embeddedRejected: !embeddedChatDefinitionValidation.ok,
                duplicateRejected: !duplicatePrincipalValidation.ok,
                duplicateReason: duplicatePrincipalValidation.errors.some((error) =>
                    /must not duplicate the surrounding standalone character/i.test(
                        error.message || "",
                    ),
                ),
                duplicateContainers: duplicatePrincipalContainers.every(
                    ({ validation }) =>
                        !validation.ok &&
                        validation.errors.some((error) =>
                            /must not duplicate the surrounding standalone character/i.test(
                                error.message || "",
                            ),
                        ),
                ),
            };
            devAssert(
                Object.values(attachedStoryDefinitionChecks).every(Boolean),
                "standalone character catalog and Chat fields validate and export exactly, remain forbidden on story-embedded definitions, and reject an attached story that duplicates its authoritative outer character",
                {
                    chatDefinitionValidation,
                    embeddedChatDefinitionValidation,
                    duplicatePrincipalValidation,
                    duplicatePrincipalContainers,
                    chatDefinitionProjection,
                },
            );
            const malformedRheaStory = clone(attachedChatStory);
            malformedRheaStory.starting_party_member_count = 1;
            malformedRheaStory.starting_npc_count = 0;
            malformedRheaStory.main_objective_count = 1;
            malformedRheaStory.side_objective_count = 0;
            malformedRheaStory.future_character_count = 0;
            malformedRheaStory.starting_player_count = 1;
            malformedRheaStory.allow_any_player = true;
            malformedRheaStory.any_player_starting_state = [];
            delete malformedRheaStory.state.story_inventory.items;
            malformedRheaStory.messages[0].text =
                '(Rhea Attached Story Rejection Smoke) "|[character]|, this invalid token must be rejected."';
            const malformedRheaDefinition = clone(chatDefinitionProjection);
            malformedRheaDefinition.id = malformedAttachedStoryCharacterId;
            malformedRheaDefinition.name = "Rhea Attached Story Rejection Smoke";
            malformedRheaDefinition.chat_story_template = malformedRheaStory;
            const malformedRheaPayload = {
                character_definition: malformedRheaDefinition,
            };
            const malformedRheaValidation = validateCharacterDefinition(
                malformedRheaDefinition,
                "Rhea attached story rejection smoke",
            );
            const malformedRheaWorkerValidations =
                await validateCharacterImportRecordsInWorker([
                    malformedRheaPayload,
                ]);
            let malformedRheaImportError = null;
            try {
                await app.library.importPayload("character", malformedRheaPayload);
            } catch (error) {
                malformedRheaImportError = error;
            }
            const malformedRheaStoredEntries = await app.library.listLibrary(
                "character",
                {
                    query: malformedAttachedStoryCharacterId,
                    limit: 20,
                },
            );
            const malformedRheaPersisted = (
                malformedRheaStoredEntries.entries || []
            ).some(
                (entry) =>
                    String(entry?.characterId || "") ===
                    malformedAttachedStoryCharacterId,
            );
            if (malformedRheaPersisted)
                await app.library.deleteEntry(
                    "character",
                    malformedAttachedStoryCharacterId,
                );
            let malformedRheaPublishError = null;
            try {
                hostedCharacterSharePayload([malformedRheaDefinition]);
            } catch (error) {
                malformedRheaPublishError = error;
            }
            const malformedRheaValidationText = malformedRheaValidation.errors
                .map((error) => `${error.path}: ${error.message}`)
                .join("\n");
            const malformedRheaWorkerValidation =
                malformedRheaWorkerValidations[0]?.validation;
            const malformedRheaWorkerValidationText = (
                malformedRheaWorkerValidation?.errors || []
            )
                .map((error) => `${error.path}: ${error.message}`)
                .join("\n");
            const malformedRheaImportErrorText = String(
                malformedRheaImportError?.message || "",
            );
            const malformedRheaPublishErrorText = String(
                malformedRheaPublishError?.message || "",
            );
            const malformedRheaExpectedErrors = (text) =>
                /starting_party_member_count.*not an approved field/is.test(text) &&
                /any_player_starting_state.*must be an object/is.test(text) &&
                /story_inventory\.items.*required/is.test(text) &&
                /ID-less character reference/is.test(text);
            const malformedRheaBoundaryChecks = {
                canonicalValidator:
                    !malformedRheaValidation.ok &&
                    malformedRheaExpectedErrors(malformedRheaValidationText),
                fileImportValidator:
                    malformedRheaWorkerValidation?.ok === false &&
                    malformedRheaExpectedErrors(
                        malformedRheaWorkerValidationText,
                    ),
                normalizedImportRejected:
                    !!malformedRheaImportError &&
                    malformedRheaExpectedErrors(malformedRheaImportErrorText),
                normalizedImportDidNotPersist: !malformedRheaPersisted,
                publisherRejected:
                    !!malformedRheaPublishError &&
                    malformedRheaExpectedErrors(malformedRheaPublishErrorText),
            };
            devAssert(
                Object.values(malformedRheaBoundaryChecks).every(Boolean),
                "character import and publishing reject malformed attached stories through the canonical story validator before persistence or upload",
                {
                    checks: malformedRheaBoundaryChecks,
                    canonicalValidation: malformedRheaValidation,
                    workerValidation: malformedRheaWorkerValidation,
                    importError: malformedRheaImportErrorText,
                    publishError: malformedRheaPublishErrorText,
                    storedEntries: malformedRheaStoredEntries,
                },
            );
            chatPlayerRecord.character.starting_inventory = legacyPlayerInventory;
            chatPlayerRecord.character.inventory = legacyPlayerInventory;
            chatTargetRecord.character.starting_inventory = legacyTargetInventory;
            chatTargetRecord.character.inventory = legacyTargetInventory;
            const expectedChatPlayerInventory = repairAiInventoryList(
                legacyPlayerInventory,
            );
            const expectedChatTargetInventory = repairAiInventoryList(
                legacyTargetInventory,
            );
            const chatTargetBaseOutfit = clone(chatTargetRecord.character.outfits[0]);
            const chatTargetRuntimeOutfit = {
                ...chatTargetBaseOutfit,
                formality: 0,
                origin: "",
                memory: "",
                source_shop_id: "",
                source_outfit_id: "",
                image_prompt: "",
                image_id: "",
                contexts: [],
                held_items: {
                    right_hand: null,
                    left_hand: null,
                },
            };
            app.settings.reducedUi = false;
            const runtimeOutfitControls = characterOutfitControlsHtml(
                chatTargetRecord.name,
                {
                    ...chatTargetRecord.character,
                    outfits: [chatTargetRuntimeOutfit],
                    active_outfit_id: chatTargetRuntimeOutfit.id,
                },
            );
            devAssert(
                runtimeOutfitControls.includes(chatTargetRuntimeOutfit.name),
                "character cards accept the complete exact runtime outfit schema",
                { outfit: chatTargetRuntimeOutfit, html: runtimeOutfitControls },
            );
            devCreateTestProfile({  });
            openCharacterLibraryDetail(chatTargetRecordId);
            await new Promise((resolve) => setTimeout(resolve, 150));
            const chatDetailLayer = document.querySelector("[data-character-library-detail-modal='1']");
            const chatButton = [...(chatDetailLayer?.querySelectorAll("button") || [])].find(
                (button) => /^Start Game$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(
                !!chatButton &&
                    /An arcane scout with a sealed map/i.test(
                        chatDetailLayer?.textContent || "",
                    ),
                "Character Definition detail exposes Start Game and uses the catalog hook as its concise description",
            );
            chatButton.click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const chatPicker = document.querySelector("[data-character-chat-player-picker]");
            devAssert(
                !!chatPicker &&
                    /Choose Your Player/i.test(chatPicker.textContent || "") &&
                    !$("characterChatLaunchMode") &&
                    /Tor Bran/i.test(chatPicker.textContent || "") &&
                    /Make Character With AI/i.test(chatPicker.textContent || "") &&
                    /Make Character Manually/i.test(chatPicker.textContent || "") &&
                    !!chatPicker.querySelector(`[data-character-chat-player-id="${cssEscape(chatPlayerRecordId)}"]`) &&
                    !chatPicker.querySelector(`[data-character-chat-player-id="${cssEscape(chatTargetRecordId)}"]`),
                "Character Definition Start Game opens player selection directly without story choices and excludes the target character",
            );
            startCharacterDefinitionFromChatPicker(chatTargetRecordId, chatPlayerRecordId);
            const launchChoice = document.querySelector("[data-character-chat-launch-choice]");
            devAssert(
                !document.querySelector("[data-character-chat-player-picker]") &&
                    !!launchChoice &&
                    /The Sealed Map/.test(launchChoice.textContent || "") &&
                    !!$("characterChatModeStory") && !!$("characterChatModeChat") &&
                    !!$("characterChatModeCustom") &&
                    $("characterChatLaunchMode")?.value === "story",
                "selecting a player opens a separate story/authored/custom opening window",
            );
            launchChoice?.closest(".popup-modal")?.remove();
            const transientCharacterChatTitleUrl =
                "blob:https://emberadventureslite-smoke.invalid/character-chat-title";
            chatTitleImageHtmlFromCharacter = () =>
                `<img src="${transientCharacterChatTitleUrl}" alt="Transient character chat title">`;
            const characterChatAiCalls = [];
            aiText = async (instruction, opts = {}) => {
                const label = String(opts.label || "");
                const prompt = finalAiTextInstruction(instruction, opts);
                characterChatAiCalls.push({ label, prompt });
                if (/scene removal check/i.test(label)) return "#";
                if (/character reply/i.test(label))
                    return `(New Ally) "Welcome, Tor Bran. I was hoping you would come speak with me."`;
                if (/post-response NPC extraction/i.test(label))
                    return '{"speakers":["New Ally"],"new_npcs":[]}';
                return "{}";
            };
            const saveIdBeforeCharacterChat = activeSaveId();
            const saveCountBeforeCharacterChat = (app.saveIndex || []).length;
            const imageCountBeforeCharacterChat = (app.images || []).length;
            const characterChatPromise = startCharacterDefinitionChatGame(
                chatTargetRecordId,
                chatPlayerRecordId,
            );
            await devWaitFor(
                () =>
                    /How to Play/i.test($("modalBox")?.textContent || "") &&
                    !!$("modalBox")?.querySelector("button"),
                5000,
                "character chat player-input help",
            );
            devAssert(
                activeSaveId() === saveIdBeforeCharacterChat &&
                    (app.saveIndex || []).length === saveCountBeforeCharacterChat &&
                    (app.images || []).length === imageCountBeforeCharacterChat &&
                    characterChatAiCalls.length === 0 &&
                    !document.querySelector("[data-character-chat-opening-setup='1']"),
                "Character Definition Start Game shows How to Play before creating the game or opening setup",
            );
            const helpStartButton = [...($("modalBox")?.querySelectorAll("button") || [])].find(
                (button) => /Start Playing/i.test(button.textContent || ""),
            );
            devAssert(!!helpStartButton, "character chat How to Play modal has Start Playing button");
            helpStartButton.click();
            await devWaitFor(
                () => !!document.querySelector("[data-character-chat-opening-setup='1']"),
                5000,
                "character chat opening setup",
            );
            const authoredOpeningNotice = document.querySelector(
                "[data-character-chat-authored-opening='1']",
            );
            const authoredOpeningDetails = $("characterChatAuthoredOpeningDetails");
            const openingOverrideControls = $("characterChatOpeningOverrideControls");
            devAssert(
                !!authoredOpeningNotice &&
                    /New Ally includes an authored opening/i.test(
                        authoredOpeningNotice.textContent || "",
                    ) &&
                    authoredOpeningDetails?.hidden === true &&
                    openingOverrideControls?.hidden === true,
                "character chat setup announces authored content and keeps override controls closed by default",
            );
            $("characterChatAuthoredOpeningShow")?.click();
            devAssert(
                authoredOpeningDetails?.hidden === false &&
                    authoredOpeningDetails?.textContent?.includes(authoredChatStory) &&
                    authoredOpeningDetails?.textContent?.includes(
                        authoredChatOpeningMessage,
                    ) &&
                    authoredOpeningDetails?.textContent?.includes(
                        authoredChatLocation.label,
                    ),
                "character chat authored-opening Show action reveals the exact story, message, and location",
            );
            const overrideAuthoredCheckbox = $("characterChatOverrideAuthoredOpening");
            overrideAuthoredCheckbox.checked = true;
            overrideAuthoredCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
            devAssert(
                openingOverrideControls?.hidden === false &&
                    getComputedStyle(openingOverrideControls).display !== "none",
                "character chat setup exposes the existing location and guidance controls when the player chooses to customize",
            );
            const openingLocationSelect = $("characterChatOpeningLocation");
            const customLocationCheckbox = $("characterChatCustomLocationEnabled");
            const customLocationWrap = $("characterChatCustomLocationWrap");
            const customLocationInput = $("characterChatCustomLocation");
            const openingGuidanceInput = $("characterChatOpeningGuidance");
            const customOpeningSetup = exactCharacterChatOpeningSetup({
                customLocation: "the glass-roofed conservatory",
            });
            const defaultOpeningGuidance = characterChatOpeningGuidancePrompt(
                "New Ally",
                "Tor Bran",
                "",
            );
            const requestedOpeningGuidance = characterChatOpeningGuidancePrompt(
                "New Ally",
                "Tor Bran",
                "Begin with a tense negotiation.",
            );
            devAssert(
                openingLocationSelect?.value === "busy-dining-hall" &&
                    !![...openingLocationSelect.options].find(
                        (option) => option.value === "bar-counter" && /Bar Counter/i.test(option.textContent || ""),
                    ) &&
                    !![...openingLocationSelect.options].find(
                        (option) => option.value === "park" && /^Park$/i.test(option.textContent?.trim() || ""),
                    ) &&
                    !![...openingLocationSelect.options].find(
                        (option) => option.value === "festival",
                    ) &&
                    !![...openingLocationSelect.options].find(
                        (option) => option.value === "fair",
                    ) &&
                    customLocationCheckbox?.checked === false &&
                    customLocationWrap?.hidden === true &&
                    getComputedStyle(customLocationWrap).display === "none" &&
                    !!openingGuidanceInput &&
                    customOpeningSetup.place === "the glass-roofed conservatory" &&
                    customOpeningSetup.activity ===
                        "together at the glass-roofed conservatory" &&
                    /short paragraph establishing the immediate environment/i.test(
                        defaultOpeningGuidance,
                    ) &&
                    /ordinary action appropriate to the location/i.test(defaultOpeningGuidance) &&
                    /one short spoken line/i.test(defaultOpeningGuidance) &&
                    /do not make Tor Bran speak/i.test(defaultOpeningGuidance) &&
                    !/No opening guidance was provided/i.test(defaultOpeningGuidance) &&
                    !/one short spoken line/i.test(requestedOpeningGuidance) &&
                    /Begin with a tense negotiation/i.test(requestedOpeningGuidance) &&
                    /may be longer, more active, dramatic, intimate, or conversational/i.test(
                        requestedOpeningGuidance,
                    ) &&
                    /do not make Tor Bran speak/i.test(requestedOpeningGuidance) &&
                    activeSaveId() === saveIdBeforeCharacterChat &&
                    (app.saveIndex || []).length === saveCountBeforeCharacterChat &&
                    (app.images || []).length === imageCountBeforeCharacterChat &&
                    characterChatAiCalls.length === 0,
                "character chat opening setup defaults to Busy Dining Hall and exposes the separate location, custom, and guidance controls",
            );
            customLocationCheckbox.checked = true;
            setCharacterChatCustomLocationEnabled(true);
            devAssert(
                openingLocationSelect.disabled === true &&
                    customLocationWrap.hidden === false &&
                    getComputedStyle(customLocationWrap).display !== "none" &&
                    customLocationInput.required === true,
                "character chat custom location enables a required custom field and disables the preset selector",
            );
            customLocationCheckbox.checked = false;
            setCharacterChatCustomLocationEnabled(false);
            openingGuidanceInput.value =
                "Begin with New Ally asking Tor Bran about a practical concern.";
            const openingStartButton = [...($("modalBox")?.querySelectorAll("button") || [])].find(
                (button) => /^Start Game$/i.test(button.textContent?.trim() || ""),
            );
            devAssert(!!openingStartButton, "character chat opening setup has Start Game button");
            openingStartButton.click();
            await characterChatPromise;
            await devWaitFor(
                () =>
                    (app.images || []).some(
                        (image) =>
                            /opening scene/i.test(image?.reason || "") &&
                            devLooksLikeRealImageHtml(image?.html),
                    ),
                8000,
                "character chat opening scene image to finish",
            );
            const chatSaveRecord = findSaveIndexRecord(app.currentGameSaveId || activeSaveId());
            const persistedCharacterChatDefinition = await app.persistence.getDefinition(
                "story",
                app.storyDefinition.storyId,
                app.storyDefinition.revisionId,
            );
            const characterChatChecks = {
                sourceMode: app.state?.meta?.story_source?.mode === "character_game",
                sourceTitle: app.state?.meta?.story_source?.title === "Game with New Ally",
                storyGuidance:
                    app.state?.meta?.story_guidance ===
                    "Begin with New Ally asking Tor Bran about a practical concern.",
                settlement: app.state?.location?.settlement_name === "",
                place:
                    app.state?.location?.specific_place ===
                    "a busy public dining hall filled with diners, conversation, and food service",
                imageAction:
                    app.state?.scene?.image_action ===
                    "sitting together at a small table in a busy public dining hall",
                player: app.state?.player?.name === "Tor Bran",
                playerInventory:
                    JSON.stringify(app.state?.player?.inventory || []) ===
                    JSON.stringify(expectedChatPlayerInventory),
                character: Object.keys(app.state.characters || {}).length === 1 && !!app.state.characters["New Ally"],
                characterInventory:
                    JSON.stringify(app.state.characters?.["New Ally"]?.inventory || []) ===
                    JSON.stringify(expectedChatTargetInventory),
                party:
                    (app.state.scene?.party_members_present || []).length === 1 &&
                    app.state.scene.party_members_present[0] === "New Ally",
                npcs: (app.state.scene?.npcs_present || []).length === 0,
                noVisibleObjective: !currentObjectiveTarget(app.state),
                greeting: (app.messages || []).some(
                    (message) => message.role === "assistant" && /Welcome, Tor Bran/i.test(message.text || ""),
                ),
                aiPrompt: characterChatAiCalls.some(
                    (call) =>
                        /character reply/i.test(call.label) &&
                        /Busy Dining Hall/i.test(call.prompt) &&
                        /current relationship with Tor Bran/i.test(call.prompt) &&
                        /Use that relationship to shape how New Ally behaves and speaks with Tor Bran/i.test(call.prompt) &&
                        /Begin with New Ally asking Tor Bran about a practical concern/i.test(call.prompt) &&
                        /understands where they are, what they are currently doing/i.test(call.prompt) &&
                        /do not make Tor Bran speak, make an important decision/i.test(call.prompt) &&
                        /may be longer, more active, dramatic, intimate, or conversational/i.test(call.prompt),
                ),
                oneOpeningImage:
                    (app.images || []).filter((image) =>
                        /opening scene/i.test(image?.reason || ""),
                    ).length === 1,
                realOpeningImage: (app.images || []).some(
                    (image) =>
                        /opening scene/i.test(image?.reason || "") &&
                        devLooksLikeRealImageHtml(image?.html),
                ),
                playerProfile: activeProfileImage(app.state.player)?.id === "tor-library-existing-profile",
                allyProfile: !!activeProfileImage(app.state.characters["New Ally"])?.id,
                titleImage: /img/i.test(chatSaveRecord?.titleImageHtml || ""),
                durableDefinitionExcludesTemporaryTitleImage:
                    !JSON.stringify(persistedCharacterChatDefinition).includes(
                        transientCharacterChatTitleUrl,
                    ) &&
                    !Object.hasOwn(
                        persistedCharacterChatDefinition?.state?.meta || {},
                        "title_image_html",
                    ),
                pickerClosed: !document.querySelector("[data-character-chat-player-picker]"),
                detailClosed: !document.querySelector("[data-character-library-detail-modal='1']"),
            };
            devTestLog("Character chat AI call diagnostic", {
                labels: characterChatAiCalls.map((call) => call.label),
                firstPrompt: characterChatAiCalls[0]?.prompt || "",
            });
            devTestLog("Character chat normalized start diagnostic", {
                checks: characterChatChecks,
                storySource: app.state?.meta?.story_source,
                location: app.state?.location,
                playerName: app.state?.player?.name,
                characters: Object.keys(app.state.characters || {}),
                scene: app.state?.scene,
                objectiveCount: (app.objectives?.items || app.state.objectives?.items || []).length,
                assistantMessages: (app.messages || []).filter((message) => message.role === "assistant"),
                busy: app.busy,
                queuedTurns: (app.queue || []).map((item) => item.source || item.text),
                characterChatAiCalls,
                characterChatAiCallLabels: characterChatAiCalls.map((call) => call.label),
                characterChatFirstPrompt: characterChatAiCalls[0]?.prompt || "",
                imageReasons: (app.images || []).map((image) => image.reason),
                playerProfileId: activeProfileImage(app.state.player)?.id,
                allyProfileId: activeProfileImage(app.state.characters["New Ally"])?.id,
                titleImageHtml: chatSaveRecord?.titleImageHtml || "",
                persistedCharacterChatDefinition,
                pickerOpen: !!document.querySelector("[data-character-chat-player-picker]"),
                detailOpen: !!document.querySelector("[data-character-library-detail-modal='1']"),
            });
            devAssert(
                Object.values(characterChatChecks).every(Boolean) &&
                    app.state?.meta?.story_source?.mode === "character_game" &&
                    app.state?.meta?.story_source?.title === "Game with New Ally" &&
                    app.state?.location?.settlement_name === "" &&
                    app.state?.location?.specific_place ===
                        "a busy public dining hall filled with diners, conversation, and food service" &&
                    app.state?.scene?.image_action ===
                        "sitting together at a small table in a busy public dining hall" &&
                    app.state?.player?.name === "Tor Bran" &&
                    Object.keys(app.state.characters || {}).length === 1 &&
                    !!app.state.characters["New Ally"] &&
                    (app.state.scene?.party_members_present || []).length === 1 &&
                    app.state.scene.party_members_present[0] === "New Ally" &&
                    (app.state.scene?.npcs_present || []).length === 0 &&
                    !currentObjectiveTarget(app.state) &&
                    (app.messages || []).some(
                        (message) =>
                            message.role === "assistant" &&
                            /Welcome, Tor Bran/i.test(message.text || ""),
                    ) &&
                    characterChatAiCalls.some(
                        (call) =>
                            /character reply/i.test(call.label) &&
                            /Busy Dining Hall/i.test(call.prompt) &&
                            /current relationship with Tor Bran/i.test(call.prompt) &&
                            /Use that relationship to shape how New Ally behaves and speaks with Tor Bran/i.test(call.prompt) &&
                            /Begin with New Ally asking Tor Bran about a practical concern/i.test(call.prompt) &&
                            /understands where they are, what they are currently doing/i.test(call.prompt) &&
                            /do not make Tor Bran speak, make an important decision/i.test(
                                call.prompt,
                            ) &&
                            /may be longer, more active, dramatic, intimate, or conversational/i.test(call.prompt),
                    ) &&
                    (app.images || []).filter((image) =>
                        /opening scene/i.test(image?.reason || ""),
                    ).length === 1 &&
                    (app.images || []).some(
                        (image) =>
                            /opening scene/i.test(image?.reason || "") &&
                            devLooksLikeRealImageHtml(image?.html),
                    ) &&
                    activeProfileImage(app.state.player)?.id === "tor-library-existing-profile" &&
                    !!activeProfileImage(app.state.characters["New Ally"])?.id &&
                    /img/i.test(chatSaveRecord?.titleImageHtml || "") &&
                    !document.querySelector("[data-character-chat-player-picker]") &&
                    !document.querySelector("[data-character-library-detail-modal='1']"),
                `Character Definition Start Game shows help and opening setup before work begins, creates the selected-location save, applies one-time guidance to an appropriately bounded opening greeting, generates one opening scene image, preserves profile images, and closes the picker/detail layers; failed checks: ${Object.entries(characterChatChecks).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "legacy composite only"}`,
                {
                    story_source: app.state?.meta?.story_source,
                    player: app.state?.player,
                    characters: Object.keys(app.state.characters || {}),
                    scene: app.state?.scene,
                    messages: app.messages,
                    aiCalls: characterChatAiCalls,
                    images: app.images,
                    pickerOpen: !!document.querySelector("[data-character-chat-player-picker]"),
                    detailOpen: !!document.querySelector("[data-character-library-detail-modal='1']"),
                    save: chatSaveRecord,
                },
            );

            const openingMessage = (app.messages || []).find(
                (message) =>
                    message.role === "assistant" &&
                    /Welcome, Tor Bran/i.test(message.text || ""),
            );
            const characterChatSaveId = String(app.currentGameSaveId || activeSaveId());
            await flushRuntimeSaveProjections();
            await loadSaveIntoRuntime(characterChatSaveId, {
                scrollChatToBottom: true,
            });
            render();
            await waitForRenderedFrame();
            const loadedOpeningMessage = (app.messages || []).find(
                (message) => String(message.id) === String(openingMessage?.id),
            );
            devAssert(
                !!openingMessage &&
                    loadedOpeningMessage?.text === openingMessage.text &&
                    /Welcome, Tor Bran/i.test($("thread")?.textContent || ""),
                "character chat opening message survives normalized save loading and remains visible in chat",
                {
                    openingMessage,
                    loadedOpeningMessage,
                    threadText: $("thread")?.textContent || "",
                },
            );

            const characterReplyCallsBeforeAuthoredStart = characterChatAiCalls.filter(
                (call) => /character reply/i.test(call.label),
            ).length;
            const authoredChatPromise = startCharacterDefinitionChatGame(
                chatTargetRecordId,
                chatPlayerRecordId,
                {  },
            );
            await devWaitFor(
                () =>
                    /How to Play/i.test($("modalBox")?.textContent || "") &&
                    !!$("modalBox")?.querySelector("button"),
                5000,
                "authored character chat player-input help",
            );
            [...($("modalBox")?.querySelectorAll("button") || [])]
                .find((button) => /Start Playing/i.test(button.textContent || ""))
                ?.click();
            await devWaitFor(
                () => !!document.querySelector("[data-character-chat-opening-setup='1']"),
                5000,
                "authored character chat opening setup",
            );
            devAssert(
                !!document.querySelector("[data-character-chat-authored-opening='1']") &&
                    $("characterChatOpeningOverrideControls")?.hidden === true &&
                    $("characterChatOverrideAuthoredOpening")?.checked === false,
                "authored character chat remains selected when setup opens again",
            );
            [...($("modalBox")?.querySelectorAll("button") || [])]
                .find((button) => /^Start Game$/i.test(button.textContent?.trim() || ""))
                ?.click();
            await authoredChatPromise;
            assertRuntimeLocationState(app.state);
            const authoredChatTravelHistory = clone(app.state.world_map.travel_history);
            const authoredChatCleanupState = applyStatePatch(
                clone(app.state),
                {
                    scene: { summary: "The companions rest after their training." },
                    characters: { "New Ally": { pose: "sitting calmly" } },
                },
                { source: "smoke character chat cleanup" },
            );
            assertRuntimeLocationState(authoredChatCleanupState);
            devAssert(
                JSON.stringify(authoredChatTravelHistory) === JSON.stringify(["character-chat-opening-location"]) &&
                    JSON.stringify(authoredChatCleanupState.world_map.travel_history) === JSON.stringify(authoredChatTravelHistory) &&
                    authoredChatCleanupState.characters["New Ally"].pose === "sitting calmly",
                "authored character opening initializes exact travel history and preserves it through cleanup without an AI greeting repair",
            );
            const authoredOpeningMessage = (app.messages || []).find(
                (message) => message.role === "assistant",
            );
            const authoredCharacterReplyCalls = characterChatAiCalls.filter(
                (call) => /character reply/i.test(call.label),
            ).length;
            devAssert(
                app.state?.meta?.story_guidance === expectedAuthoredChatStory &&
                    app.state?.location?.specific_place === authoredChatLocation.place &&
                    app.state?.scene?.image_action === authoredChatLocation.activity &&
                    (app.messages || []).filter(
                        (message) => message.role === "assistant",
                    ).length === 1 &&
                    authoredOpeningMessage?.speaker === "New Ally" &&
                    /The archive is locked, Tor Bran/i.test(
                        authoredOpeningMessage?.text || "",
                    ) &&
                    authoredCharacterReplyCalls ===
                        characterReplyCallsBeforeAuthoredStart &&
                    !Object.hasOwn(
                        app.state?.characters?.["New Ally"] || {},
                        "chat_story",
                    ) &&
                    !Object.hasOwn(
                        app.state?.characters?.["New Ally"] || {},
                        "chat_opening_message",
                    ) &&
                    !Object.hasOwn(
                        app.state?.characters?.["New Ally"] || {},
                        "chat_starting_location",
                    ),
                "authored character chat snapshots its story, location, and one exact opening message without requesting an AI greeting or leaking definition-only Chat fields into runtime",
                {
                    meta: app.state?.meta,
                    location: app.state?.location,
                    scene: app.state?.scene,
                    messages: app.messages,
                    characterChatAiCalls,
                    runtimeCharacter: app.state?.characters?.["New Ally"],
                },
            );
            const authoredChatSaveId = String(
                app.currentGameSaveId || activeSaveId(),
            );
            await flushRuntimeSaveProjections();
            await loadSaveIntoRuntime(authoredChatSaveId, {
                scrollChatToBottom: true,
            });
            devAssert(
                app.state?.meta?.story_guidance === expectedAuthoredChatStory &&
                    app.state?.location?.specific_place === authoredChatLocation.place &&
                    (app.messages || []).filter(
                        (message) =>
                            message.role === "assistant" &&
                            /The archive is locked, Tor Bran/i.test(
                                message.text || "",
                            ),
                    ).length === 1,
                "authored character Chat setup and exact opening survive normalized save reload",
                {
                    meta: app.state?.meta,
                    location: app.state?.location,
                    messages: app.messages,
                },
            );

            const attachedStoryLaunchRecord = (app.characterDefinitions || []).find(
                (record) => characterLibraryRecordId(record) === chatTargetRecordId,
            );
            const attachedStoryPlayerRecord = (app.characterDefinitions || []).find(
                (record) => characterLibraryRecordId(record) === chatPlayerRecordId,
            );
            for (const record of [
                attachedStoryLaunchRecord,
                attachedStoryPlayerRecord,
            ]) {
                const entity = characterLibraryRecordEntity(record);
                entity.starting_inventory = [];
                delete entity.inventory;
            }
            await saveCharacterLibraryRecordsNow(
                [attachedStoryLaunchRecord, attachedStoryPlayerRecord],
                "character attached story smoke valid launch definitions",
            );
            const transientAttachedStoryTitleUrl =
                "blob:https://emberadventureslite-smoke.invalid/attached-story-title";
            attachedStoryLaunchRecord.character.chat_story_template.state.meta.title_image_html =
                `<img src="${transientAttachedStoryTitleUrl}">`;
            attachedStoryLaunchRecord.character.chat_story_template.state.meta.title_image_alt =
                "Transient attached story title image";
            const attachedStoryStarted = await startCharacterDefinitionChatGame(
                chatTargetRecordId,
                chatPlayerRecordId,
                { launchMode: "story" },
            );
            const attachedStoryRuntimeTarget = app.state?.characters?.["New Ally"];
            const attachedStoryRuntimeChecks = {
                storyTitle:
                    app.state?.meta?.story_source?.title === attachedChatStory.title,
                started: attachedStoryStarted !== false,
                player: app.state?.player?.name === "Tor Bran",
                targetPresent: !!attachedStoryRuntimeTarget,
                targetId:
                    attachedStoryRuntimeTarget?.id === chatTargetRecord.character.id,
                targetRole:
                    attachedStoryRuntimeTarget?.role === chatTargetRecord.character.role,
                noCatalogHook:
                    !Object.hasOwn(attachedStoryRuntimeTarget || {}, "catalog_hook"),
                noChatStory:
                    !Object.hasOwn(attachedStoryRuntimeTarget || {}, "chat_story"),
                noChatOpening:
                    !Object.hasOwn(
                        attachedStoryRuntimeTarget || {},
                        "chat_opening_message",
                    ),
                noChatLocation:
                    !Object.hasOwn(
                        attachedStoryRuntimeTarget || {},
                        "chat_starting_location",
                    ),
                noNestedStory:
                    !Object.hasOwn(
                        attachedStoryRuntimeTarget || {},
                        "chat_story_template",
                    ),
                opening: (app.messages || []).some(
                    (message) =>
                        message.role === "assistant" &&
                        /sealed map is waiting for us/i.test(message.text || ""),
                ),
                noTransientTitleImage:
                    !String(app.state?.meta?.title_image_html || "").includes(
                        transientAttachedStoryTitleUrl,
                    ),
            };
            devAssert(
                Object.values(attachedStoryRuntimeChecks).every(Boolean),
                "Play Story launches through the normal story pipeline from a hydrated character story, excludes its session-only title image, and injects the authoritative surrounding character without standalone-only fields",
                {
                    storySource: app.state?.meta?.story_source,
                    player: app.state?.player,
                    target: attachedStoryRuntimeTarget,
                    messages: app.messages,
                },
            );

            const originalCopyDefaultProfileImageIfAvailable =
                copyDefaultProfileImageIfAvailable;
            const originalQueueFirstVisibleCharacterLibraryMissingProfile =
                queueFirstVisibleCharacterLibraryMissingProfile;
            let followupVisibleProfileScans = 0;
            try {
                const target = app.state?.characters?.["New Ally"];
                target.default_profile_image = {
                    ...emptyProfileImageSlot(false),
                    url: devSmokeOnePixelDataUrl(),
                    source: "smoke default",
                };
                delete target.profile_default_image_attempted_url;
                copyDefaultProfileImageIfAvailable = async () => true;
                queueFirstVisibleCharacterLibraryMissingProfile = () => {
                    followupVisibleProfileScans += 1;
                    return false;
                };
                queueMissingProfileImageAfterDefaultAttempt(
                    "New Ally",
                    "character library visible",
                    { force: true, allowImportSkipped: true },
                );
                await devWaitFor(
                    () => followupVisibleProfileScans === 1,
                    1000,
                    "character library follow-up profile scan after default image resolution",
                );
                devAssert(
                    followupVisibleProfileScans === 1,
                    "finishing a visible character default-image attempt schedules the next missing Character Library portrait",
                );
            } finally {
                copyDefaultProfileImageIfAvailable =
                    originalCopyDefaultProfileImageIfAvailable;
                queueFirstVisibleCharacterLibraryMissingProfile =
                    originalQueueFirstVisibleCharacterLibraryMissingProfile;
            }

            closeModal();
            addMessage("system", "Character library and cast smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: character-library-cast-smoke");
            } finally {
                generateImageHtml = originalGenerateImageHtml;
                downloadJsonPayload = originalDownloadJsonPayload;
                aiText = originalAiText;
                chatTitleImageHtmlFromCharacter =
                    originalChatTitleImageHtmlFromCharacter;
                await devRestoreCharacterDefinitionsForSmoke(
                    originalCharacterDefinitions,
                    "character library cast smoke restored character definitions",
                );
                await devRestoreProfileImagesForSmoke(
                    originalProfileImages,
                    "character library cast smoke restored profile images",
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
                await app.library.deleteEntry(
                    "character",
                    malformedAttachedStoryCharacterId,
                );
                await app.library.deleteEntry("story", attachedStoryLibraryId);
                const remainingAttachedStoryEntries = await app.library.listLibrary("story", {
                    query: attachedStoryLibraryId,
                    limit: 20,
                });
                devAssert(
                    !(remainingAttachedStoryEntries.entries || []).some(
                        (entry) => String(entry?.storyId || "") === attachedStoryLibraryId,
                    ),
                    "character library cast smoke deletes its normalized attached-story library entry",
                    remainingAttachedStoryEntries,
                );
            }
        }

