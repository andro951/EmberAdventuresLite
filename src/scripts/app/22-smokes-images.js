
        function devSmokeVenisReplacementTemplate() {
            const branchNpcName = "Smoke Branch Android";
            const branchNpc = devSmokeRuntimeCharacter(branchNpcName, {
                gender: "female",
                role: "fake branch test android",
                can_die: true,
                appearance: {
                    ...blankAppearanceTemplate(),
                    chest: "chest size 7",
                    midsection_build: "midsection build 10",
                },
            });
            const startAfterSimple = {
                "repair-her-voice": "trust-choice",
                "ask-what-will-kill-her": "repair-priority-choice",
                "restore-synthetic-flesh": "control-choice",
                "bring-her-to-the-sale": "choose-whether-to-transfer-smoke-android",
                "let-relief-break": "final-lock-choice-owner",
                "let-her-choose": "freedom-choice-owner",
                "ask-what-she-wants-to-be": "body-choice-owner",
                "choose-the-future-together": "choose-your-future-together",
            };
            const simpleIds = [
                "retrieve-the-broken-model",
                "reach-the-hideout",
                "isolate-motor-control",
                "connect-power-and-wake-her",
                "repair-her-voice",
                "question-her-origin",
                "sit-with-her-fear",
                "ask-what-will-kill-her",
                "seal-the-core-leak",
                "wait-through-the-silence",
                "rebuild-the-arm",
                "let-her-test-the-arm",
                "repair-hip-actuators",
                "restore-first-leg",
                "restore-second-leg",
                "calibrate-first-steps",
                "talk-about-desired-bodies",
                "build-the-regen-cradle",
                "enter-the-regen-cradle",
                "restore-synthetic-flesh",
                "weapon-reborn-ending",
                "admit-the-market-plan",
                "prepare-the-market-run",
                "bring-her-to-the-sale",
                "return-from-market",
                "let-relief-break",
                "let-her-choose",
                "share-a-first-soft-moment",
                "repair-by-choice",
                "ask-what-she-wants-to-be",
                "choose-the-future-together",
            ];
            const objectives = [
                devSmokeObjective("first-contact", "First Contact", {
                    status: "active",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "stay-hidden",
                            title: "Stay hidden",
                            summary: "Wait out the fake threat.",
                            next_objective_id: "retrieve-the-broken-model",
                            target_input_group_id: "retrieve-after-stay-hidden",
                            rewards: [
                                {
                                    type: "add_story_rule",
                                    rule_id: "smoke-android-unconscious-after-wakeup",
                                    text: "The fake android is unconscious after the fake wakeup.",
                                },
                                {
                                    type: "set_state_field",
                                    target: branchNpcName,
                                    field_path: ["physical_state"],
                                    value: "unconscious",
                                },
                            ],
                        },
                        {
                            id: "step-out-to-reassure-her",
                            title: "Step out and reassure her",
                            summary: "Trigger the fake fatal branch.",
                            rewards: [
                                {
                                    type: "kill_character",
                                    target: "Player",
                                    ignore_can_die: true,
                                    reason: "Killed by the fake branch test.",
                                },
                                {
                                    type: "add_story_rule",
                                    rule_id: "ending-smoke-player-death",
                                    text: "The fake branch test player died.",
                                },
                            ],
                        },
                    ],
                }),
                ...simpleIds.map((id) =>
                    devSmokeObjective(
                        id,
                        id
                            .split("-")
                            .map((part) => part[0]?.toUpperCase() + part.slice(1))
                            .join(" "),
                        {
                            status: "future",
                            next_objectives: startAfterSimple[id]
                                ? [{ objective_id: startAfterSimple[id] }]
                                : [],
                            rewards: [],
                        },
                    ),
                ),
                devSmokeObjective("trust-choice", "Build Fake Trust", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "build-trust",
                            title: "Build trust",
                            summary: "Choose the fake trust path.",
                            rewards: [
                                { type: "add_story_rule", rule_id: "trust-built", text: "Trust was built." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("repair-priority-choice", "Choose Fake Repair Priority", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "repair-valuable-systems-first",
                            title: "Repair valuable systems first",
                            summary: "Trigger the fake android death ending.",
                            rewards: [
                                { type: "kill_character", target: branchNpcName, ignore_can_die: true },
                                {
                                    type: "add_story_rule",
                                    rule_id: "ending-smoke-android-died-on-table",
                                    text: "The fake android died in the fake repair branch.",
                                },
                            ],
                        },
                        {
                            id: "repair-core-first",
                            title: "Repair core first",
                            summary: "Continue the fake repair path.",
                            next_objective_id: "seal-the-core-leak",
                            target_input_group_id: "seal-core-after-repair-choice",
                            rewards: [
                                { type: "add_story_rule", rule_id: "core-repaired", text: "Core repaired." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("control-choice", "Choose Fake Control Systems", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "restore-combat-systems",
                            title: "Restore combat systems",
                            summary: "Trigger the fake player death ending.",
                            rewards: [
                                { type: "kill_character", target: "Player", ignore_can_die: true },
                                {
                                    type: "add_story_rule",
                                    rule_id: "ending-weapon-reborn",
                                    text: "The fake weapon reborn ending happened.",
                                },
                            ],
                        },
                        {
                            id: "keep-control-systems-safe",
                            title: "Keep control systems safe",
                            summary: "Continue the fake safe branch.",
                            next_objective_id: "admit-the-market-plan",
                            target_input_group_id: "market-plan-after-control-choice",
                            rewards: [
                                { type: "add_story_rule", rule_id: "safe-control", text: "Control stayed safe." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("choose-whether-to-transfer-smoke-android", "Choose Fake Market Outcome", {
                    status: "future",
                    completion_control: "choice",
                    exclusive_group: "market-choice",
                    choices: [
                        {
                            id: "transfer-smoke-android",
                            title: "Transfer the fake android",
                            summary: "Trigger the fake transfer ending.",
                            rewards: [
                                {
                                    type: "add_story_rule",
                                    rule_id: "ending-smoke-android-transferred",
                                    text: "The fake android was transferred in the fake branch.",
                                },
                            ],
                        },
                        {
                            id: "refuse-to-transfer-smoke-android",
                            title: "Refuse to transfer the fake android",
                            summary: "Continue the fake refusal branch.",
                            next_objective_id: "return-from-market",
                            target_input_group_id: "return-after-refusing-transfer",
                            rewards: [
                                { type: "add_story_rule", rule_id: "sale-refused", text: "Sale refused." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("final-lock-choice-owner", "Choose Fake Lock Outcome", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "remove-final-lock",
                            title: "Remove final lock",
                            summary: "Remove the fake lock.",
                            next_objective_id: "let-her-choose",
                            target_input_group_id: "choice-after-final-lock",
                            rewards: [
                                { type: "add_story_rule", rule_id: "lock-removed", text: "Lock removed." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("freedom-choice-owner", "Choose Fake Freedom", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "let-her-stay-without-price",
                            title: "Let her stay without price",
                            summary: "Choose fake freedom.",
                            next_objective_id: "share-a-first-soft-moment",
                            target_input_group_id: "soft-moment-after-freedom-choice",
                            rewards: [
                                { type: "add_story_rule", rule_id: "freedom-chosen", text: "Freedom chosen." },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("body-choice-owner", "Choose Fake Body", {
                    status: "future",
                    completion_control: "choice",
                    choices: [
                        {
                            id: "support-her-chosen-form",
                            title: "Support her chosen form",
                            summary: "Apply deterministic fake body changes.",
                            next_objective_id: "choose-the-future-together",
                            target_input_group_id: "future-after-body-choice",
                            rewards: [
                                {
                                    type: "set_state_field",
                                    target: branchNpcName,
                                    field_path: ["appearance", "chest"],
                                    value: "chest size 7",
                                },
                                {
                                    type: "set_state_field",
                                    target: branchNpcName,
                                    field_path: ["appearance", "stomach"],
                                    value: "stomach size 10",
                                },
                            ],
                        },
                    ],
                }),
                devSmokeObjective("choose-your-future-together", "Choose Your Future Together", {
                    status: "future",
                    completion_control: "choice",
                    exclusive_group: "final-future-choice",
                    choices: [
                        {
                            id: "choose-home-together",
                            title: "Choose home together",
                            summary: "Reach the fake home ending.",
                            ending_type: "freeplay",
                            rewards: [
                                {
                                    type: "add_story_rule",
                                    rule_id: "ending-home-together",
                                    text: "The fake home ending happened.",
                                },
                            ],
                        },
                    ],
                }),
            ];
            return devSmokeStoryRecord({
                id: "smoke-fixture-branch-lab-story",
                title: "Smoke Fixture Branch Lab",
                player: devSmokeRuntimeCharacter("Smoke Branch Tester", {
                    gender: "female",
                    role: "fake branch player",
                    can_die: true,
                }),
                npc_directory: {
                    locations: {
                        "smoke-fixture-room": {
                            label: "Smoke Fixture Room",
                            characters: {
                                [branchNpcName]: {
                                    name: branchNpcName,
                                    inspected: true,
                                    full_character: branchNpc,
                                },
                            },
                        },
                    },
                },
                npcs_present: [branchNpcName],
                objectives,
                active_id: "first-contact",
                opening_text: "A fake branching smoke story begins beside a broken machine.",
            });
        }

        function devSmokeTemplateRecord(overrides = {}) {
            const title = overrides.title || "Smoke Story Template";
            const overrideState = overrides.state || {};
            const smokePlayer = devSmokeRuntimeCharacter("Smoke Player", {
                gender: "female",
                role: "fake smoke-test player",
            });
            const baseState = {
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    genres: overrides.genres || ["fantasy"],
                    story_guidance: overrides.story_guidance || "Smoke story guidance.",
                    story_source: {
                        mode: "original",
                        title,
                    },
                },
                player: smokePlayer,
                objectives: {
                    active_id: "smoke-objective",
                    focus_id: "",
                    items: [
                        {
                            id: "smoke-objective",
                            title: "Smoke Objective",
                            type: "story",
                            status: "active",
                            summary: "Verify smoke story metadata.",
                            while_active_guidance:
                                "Keep the fake smoke-test scene focused on story metadata.",
                             completion_control: "player",
                             completion_criteria: "Complete the smoke objective.",
                             completion_instruction: "Show the smoke objective outcome.",
                             next_objectives: [{
                                 id: "image-smoke-ending",
                                 completion_instruction: "Show the smoke objective outcome.",
                                 rewards: [],
                                 ending_type: "freeplay",
                                 ending_message: "The smoke story continues in freeplay.",
                             }],
                             rewards: [],
                        },
                    ],
                },
            };
            const mergedState = {
                ...baseState,
                ...overrideState,
                meta: {
                    ...baseState.meta,
                    ...(overrideState.meta || {}),
                },
                player: overrideState.player
                    ? devSmokeRuntimeCharacter(
                          overrideState.player?.name || "Smoke Player",
                          overrideState.player,
                      )
                    : baseState.player,
            };
            return devCompleteSmokeObjectiveGuidance(devSmokeStoryRecord({
                id: overrides.id || `smoke-story-${Date.now()}`,
                title,
                description: overrides.description || "Smoke story template.",
                source: overrides.source,
                genres: overrides.genres || ["fantasy"],
                title_card_image:
                    overrides.title_card_image === undefined
                        ? devSmokeTitleCardImage(title)
                        : overrides.title_card_image,
                title_card_subjects: overrides.title_card_subjects,
                player: mergedState.player,
                players: mergedState.players,
                characters: mergedState.characters,
                future_cast: mergedState.future_cast,
                npc_directory: mergedState.npc_directory,
                location: mergedState.location,
                npc_location_id: mergedState.location?.npc_location_id,
                party_members_present: mergedState.scene?.party_members_present,
                image_characters: mergedState.scene?.image_characters,
                npcs_present: mergedState.scene?.npcs_present,
                scene_summary: mergedState.scene?.summary,
                image_action: mergedState.scene?.image_action,
                story_guidance: mergedState.meta?.story_guidance,
                story_rules: mergedState.story_rules,
                story_inventory: mergedState.story_inventory,
                world_flags: mergedState.world_flags,
                world_map: textSlot(mergedState.world_map?.current_location_id, "")
                    ? mergedState.world_map
                    : undefined,
                objectives: mergedState.objectives?.items,
                active_id: mergedState.objectives?.active_id,
                allow_any_player: overrides.allow_any_player === true,
                any_player_starting_state: overrides.any_player_starting_state,
                messages: overrides.messages,
            }));
        }

        function devSmokeCharacterRecord(name = "Smoke Character", overrides = {}) {
            const gender = overrides.character?.gender || overrides.gender || "female";
            const metadata = devCompleteLibraryCharacterMetadata();
            const character = devSmokeRuntimeCharacter(name, {
                ...overrides.character,
                id: overrides.record?.id || overrides.character?.id,
                default_seed: overrides.character?.default_seed ?? 0,
                gender,
                age: overrides.age || overrides.character?.age || 28,
                role: overrides.role || overrides.character?.role || "smoke tester",
                speech_style:
                    overrides.character?.speech_style ||
                    "Clear, direct, and consistent smoke-test dialogue.",
                source: overrides.character?.source || "Original",
                genres: overrides.character?.genres || overrides.genres || ["fantasy"],
            });
            const record = runtimeCharacterDefinitionRecord(name, character, {
                creator_id: metadata.creator_id,
                creator_name: metadata.creator,
            });
            if (textSlot(overrides.character?.source, "")) {
                record.character.source = overrides.character.source;
                record.source = overrides.character.source;
            }
            for (const field of [
                "creator", "creator_id", "active_profile_image_ids",
                "public_library_item_id", "public_library_owner_user_id",
                "public_library_version_id", "source",
            ]) {
                if (Object.hasOwn(overrides.record || {}, field))
                    record[field] = overrides.record[field];
            }
            if (Object.hasOwn(overrides.record || {}, "source"))
                record.character.source = overrides.record.source;
            return assertValidCharacterLibraryRecord(record);
        }

        function devSmokePublicLibraryIndex(input = {}) {
            if (!isPlainObject(input))
                throw new Error("Smoke public library index input must be an object.");
            return exactPublicLibraryIndex({
                ...publicLibraryEmptyIndex(),
                ...clone(input),
            });
        }

        function devSmokeSupabasePublicItemRow(overrides = {}) {
            const now = new Date().toISOString();
            const type = overrides.type || "story";
            return validateSupabasePublicItemRow({
                id: "smoke-public-item",
                owner_user_id: "smoke-owner",
                type,
                definition_id: "smoke-public-definition",
                slug: "smoke-public-item",
                title: type === "story" ? "Smoke Public Story" : null,
                description: "",
                name: type === "character" ? "Smoke Public Character" : null,
                male_name: null,
                non_male_name: null,
                male_image_url: null,
                non_male_image_url: null,
                creator: "debug harness",
                creator_id: "00000000-0000-4000-8000-000000000001",
                source: "Original",
                creation_tool: "debug harness",
                genres: [],
                ...EmberSharedLibraryFormat.publicationScope(),
                fallback_gender:null,
                current_version_id: null,
                visibility: "public",
                rating_count: 0,
                rating_average: 0,
                player_select: false,
                player_option_count: 1,
                main_objective_count: 0,
                side_objective_count: 0,
                future_character_count: 0,
                starting_party_member_count: 0,
                starting_npc_count: 0,
                gender: null,
                age: null,
                species: null,
                role: null,
                voice_gender: null,
                hidden_reason: null,
                updated_at: now,
                ...clone(overrides),
            });
        }

        function devSmokeSupabasePublicSearchRow(overrides = {}) {
            const {
                rating_total,
                created_at,
                payload_url,
                payload_sha256,
                payload_size_bytes,
                image_url,
                user_rating,
                ordering_value,
                ...itemOverrides
            } = overrides;
            const item = devSmokeSupabasePublicItemRow(itemOverrides);
            return validateSupabasePublicSearchRow({
                id: item.id,
                type: item.type,
                definition_id: item.definition_id,
                title: item.title,
                description: item.description,
                name: item.name,
                creator: item.creator,
                creator_id: item.creator_id,
                creation_tool: item.creation_tool,
                source: item.source,
                genres: item.genres,
                ...EmberSharedLibraryFormat.publicationScope(),
                fallback_gender:item.fallback_gender,
                rating_total: rating_total ?? 0,
                rating_count: item.rating_count,
                rating_average: item.rating_average,
                created_at: created_at || item.updated_at,
                updated_at: item.updated_at,
                player_select: item.player_select,
                player_option_count: item.player_option_count,
                main_objective_count: item.main_objective_count,
                side_objective_count: item.side_objective_count,
                future_character_count: item.future_character_count,
                starting_party_member_count: item.starting_party_member_count,
                starting_npc_count: item.starting_npc_count,
                gender: item.gender,
                male_name: item.male_name,
                non_male_name: item.non_male_name,
                male_image_url: item.male_image_url,
                non_male_image_url: item.non_male_image_url,
                age: item.age,
                species: item.species,
                role: item.role,
                voice_gender: item.voice_gender,
                current_version_id: textSlot(item.current_version_id, "smoke-version"),
                payload_url: payload_url || "https://example.com/smoke.json",
                payload_sha256: payload_sha256 ?? null,
                payload_size_bytes: payload_size_bytes ?? null,
                image_url: image_url ?? null,
                user_rating: user_rating ?? null,
                ordering_value: ordering_value || "smoke",
            });
        }

        function devSmokeSupabasePublicVersionRow(overrides = {}) {
            return validateSupabasePublicVersionRow({
                id: "smoke-version",
                item_id: "smoke-public-item",
                version_number: 1,
                payload_url: "https://example.com/smoke.json",
                payload_sha256: null,
                payload_size_bytes: null,
                image_url: null,
                metadata_snapshot: null,
                change_summary: "Smoke version.",
                created_at: new Date().toISOString(),
                ...clone(overrides),
            });
        }

        async function devWithExpectedCharacterImportDialogs(action) {
            const originalChooseCreatorIdentityForImport = chooseCreatorIdentityForImport;
            chooseCreatorIdentityForImport = async () => ({
                creator_id: devCompleteLibraryCharacterMetadata().creator_id,
                creator_name: devCompleteLibraryCharacterMetadata().creator,
            });
            try {
                return await action();
            } finally {
                chooseCreatorIdentityForImport = originalChooseCreatorIdentityForImport;
            }
        }

        async function devImportCharacterRecords(records, options = {}) {
            return devWithExpectedCharacterImportDialogs(() =>
                importCharacterRecords(records, options),
            );
        }

        async function devImportCharacterDefinitionsFromRecords(records = []) {
            return devWithExpectedCharacterImportDialogs(() =>
                importCharacterDefinitionsFromRecords(records),
            );
        }

        function devAssertEditorPathVisible(rootSelector, path, message) {
            devAssert(
                !!devFieldByPath(rootSelector, path),
                message || `editor exposes ${path.join(".")}`,
                { rootSelector, path },
            );
        }

        function devAssertEditorPathHidden(rootSelector, path, message) {
            devAssert(
                !devFieldWithPathPrefix(rootSelector, path),
                message || `editor hides ${path.join(".")}`,
                { rootSelector, path },
            );
        }

        async function devSeedEditorAccessState() {
            app.state = devMakeSceneControlState({  });
            app.state.location = {
                npc_location_id: "smoke-job-board",
                universe: "Smoke",
                world: "Editor World",
                region: "Editor Region",
                settlement_type: "test",
                settlement_name: "Editor Town",
                district: "Editor District",
                specific_place: "Editor Hall",
            };
            app.state.player = materializeCharacterForRuntime(
                {
                    ...blankCharacterTemplate("Editor Player"),
                    ...devCompleteLibraryCharacterMetadata(),
                    name: "Editor Player",
                    age: 24,
                    gender: "female",
                    clothing: {
                        shirt: "linen shirt",
                        pants: "travel skirt",
                    },
                    profile_images: {
                        active_image_id: "",
                        image_ids: [],
                    },
                },
                "Editor Player",
            );
            app.state.characters = {
                "Real Editor Kara": materializeCharacterForRuntime(
                    {
                        ...blankCharacterTemplate("Real Editor Kara"),
                        ...devCompleteLibraryCharacterMetadata(),
                        name: "Real Editor Kara",
                        age: 29,
                        gender: "female",
                        role: "party tester",
                        clothing: {
                            shirt: "green jacket",
                            pants: "black trousers",
                        },
                        profile_images: {
                            active_image_id: "",
                            image_ids: [],
                        },
                    },
                    "Real Editor Kara",
                ),
            };
            const localNpc = materializeCharacterForRuntime(
                {
                    ...blankCharacterTemplate("Nia Local"),
                    ...devCompleteLibraryCharacterMetadata(),
                    name: "Nia Local",
                    age: 31,
                    gender: "female",
                    role: "local tester",
                    clothing: {
                        shirt: "blue vest",
                        pants: "brown pants",
                    },
                    profile_images: {
                        active_image_id: "",
                        image_ids: [],
                    },
                },
                "Nia Local",
            );
            app.state.npc_directory = {
                locations: {
                    "Editor Town": {
                        label: "Editor Town",
                        characters: {
                            "Nia Local": {
                                name: "Nia Local",
                                gender: "female",
                                age: 31,
                                role: "local tester",
                                relationship: "neutral",
                                note: "Inspected NPC editor smoke target.",
                                trust: localNpc.trust,
                                attraction: localNpc.attraction,
                                affection: localNpc.affection,
                                state_of_mind: localNpc.state_of_mind,
                                physical_state: localNpc.physical_state,
                                pose: localNpc.pose,
                                inspected: true,
                                status: "alive",
                                full_character: localNpc,
                            },
                        },
                    },
                },
            };
            app.state.scene.party_members_present = ["Real Editor Kara"];
            app.state.scene.npcs_present = ["Nia Local"];
            app.state.scene.image_characters = [
                "Editor Player",
                "Real Editor Kara",
                "Nia Local",
            ];
            await devCompileCurrentStoryFixture("json-editor-access-smoke");
            reconcileStoryRuntimeState(app.state, "editor access smoke seed");
        }

        async function devRunJsonEditorAccessSmokeTest() {
            devTestLog("Scenario start: json-editor-access-smoke");
            devResetForLiveTest("json-editor-access-smoke");
            devCreateTestProfile({  });
            await devSeedEditorAccessState();

            app.settings.devMode = false;
            openStateModal();
            devAssert(
                /Advanced Mode Required/i.test(document.body?.textContent || ""),
                "raw runtime State editor is hidden unless dev mode is enabled",
                document.body?.textContent || "",
            );
            document.querySelector("#noticeOkBtn")?.click();
            closeModal();

            app.settings.devMode = true;
            openStateModal();
            devAssert(
                !/What's JSON\?/i.test($("modalBox")?.textContent || "") &&
                    typeof window.EmberAdventures?.openJsonHelpModal === "undefined",
                "old What's JSON help UI is removed while the State editor remains accessible",
                {
                    modalText: $("modalBox")?.textContent || "",
                    exportedType: typeof window.EmberAdventures?.openJsonHelpModal,
                },
            );
            devAssertEditorPathVisible("#friendlyStateEditor", ["player", "name"], "runtime State editor exposes safe player fields in dev mode");
            devAssertEditorPathHidden("#friendlyStateEditor", ["meta"], "runtime State editor hides meta");
            devAssertEditorPathHidden("#friendlyStateEditor", ["location"], "runtime State editor hides location internals");
            devAssertEditorPathHidden("#friendlyStateEditor", ["objectives"], "runtime State editor hides objectives");
            devAssertEditorPathHidden("#friendlyStateEditor", ["future_cast"], "runtime State editor hides future cast");
            devAssertEditorPathHidden("#friendlyStateEditor", ["progression"], "runtime State editor hides shelved progression");
            closeModal();

            openPlayerModal();
            devAssertEditorPathVisible("#playerFriendlyEditor", ["character_definition", "name"], "Player editor exposes Character Definition name");

            devAssertEditorPathVisible("#playerFriendlyEditor", ["game_managed_data", "clothing", "shirt"], "Player editor exposes current clothing");
            devAssertEditorPathHidden("#playerFriendlyEditor", ["character_definition", "clothing"], "Player editor never exposes runtime clothing under Character Definition");
            devAssertEditorPathHidden("#playerFriendlyEditor", ["character_definition", "voice"], "Player editor hides voice internals");
            devAssertEditorPathHidden("#playerFriendlyEditor", ["character_definition", "default_seed"], "Player editor hides default seed");
            devAssertEditorPathHidden("#playerFriendlyEditor", ["character_definition", "default_profile_image"], "Player editor hides default profile image internals");
            devAssertEditorPathHidden("#playerFriendlyEditor", ["game_managed_data", "profile_images"], "Player editor hides profile image records");
            closeModal();

            app.state.characters["Real Editor Kara"].appearance.extra_description =
                "silver-threaded braids";
            app.state.characters[
                "Real Editor Kara"
            ].appearance.extra_description_lower_body =
                "digitigrade legs with dark copper scales";
            editCharacter("Real Editor Kara");
            devAssertEditorPathVisible("#charFriendlyEditor", ["character_definition", "appearance", "chest"], "Party character editor exposes appearance fields");
            const extraDescriptionField = devFieldByPath("#charFriendlyEditor", [
                "character_definition",
                "appearance",
                "extra_description",
            ]);
            const lowerBodyDescriptionField = devFieldByPath(
                "#charFriendlyEditor",
                [
                    "character_definition",
                    "appearance",
                    "extra_description_lower_body",
                ],
            );
            const lowerBodyControl = lowerBodyDescriptionField?.closest(
                ".state-field-control",
            );
            const lowerBodyHint = lowerBodyControl?.querySelector(".hint");
            devAssert(
                extraDescriptionField?.tagName === "TEXTAREA" &&
                    lowerBodyDescriptionField?.tagName === "TEXTAREA" &&
                    lowerBodyDescriptionField.clientWidth >=
                        extraDescriptionField.clientWidth * 0.75 &&
                    !!lowerBodyDescriptionField.placeholder.trim() &&
                    !lowerBodyHint,
                "lower-body appearance description keeps a usable textarea with its hint only inside the input",
                {
                    extraDescriptionWidth: extraDescriptionField?.clientWidth || 0,
                    lowerBodyDescriptionWidth:
                        lowerBodyDescriptionField?.clientWidth || 0,
                    placeholder: lowerBodyDescriptionField?.placeholder || "",
                    hasDuplicateHint: !!lowerBodyHint,
                },
            );
            devAssertEditorPathVisible("#charFriendlyEditor", ["game_managed_data", "clothing", "shirt"], "Party character editor exposes current clothing");
            devAssertEditorPathHidden("#charFriendlyEditor", ["character_definition", "clothing"], "Party character editor never exposes runtime clothing under Character Definition");
            devAssertEditorPathHidden("#charFriendlyEditor", ["character_definition", "voice"], "Party character editor hides voice internals");
            devAssertEditorPathHidden("#charFriendlyEditor", ["character_definition", "image_prompt_config"], "Party character editor hides image prompt config");
            devAssertEditorPathHidden("#charFriendlyEditor", ["game_managed_data", "profile_images"], "Party character editor hides profile image records");
            closeModal();

            editNpc("Nia Local", "Editor Town");
            devAssertEditorPathVisible("#npcFriendlyEditor", ["character_definition", "name"], "Inspected NPC editor exposes definition fields");
            devAssertEditorPathVisible("#npcFriendlyEditor", ["game_managed_data", "npc_directory_data", "relationship"], "Inspected NPC editor exposes NPC directory game-managed data");
            devAssertEditorPathVisible("#npcFriendlyEditor", ["game_managed_data", "clothing", "shirt"], "Inspected NPC editor exposes current clothing only in Game Managed Data");
            devAssertEditorPathHidden("#npcFriendlyEditor", ["character_definition", "clothing"], "Inspected NPC editor never exposes runtime clothing under Character Definition");
            devAssertEditorPathHidden("#npcFriendlyEditor", ["character_definition", "voice"], "Inspected NPC editor hides voice internals");
            devAssertEditorPathHidden("#npcFriendlyEditor", ["character_definition", "default_profile_image"], "Inspected NPC editor hides default profile image internals");
            closeModal();

            for (const library of [false, true]) {
                openManualCharacterCreateModal({ library });
                const tree = $("manualCharacterCreateEditor");
                devAssert(tree.querySelector('[data-authoring-skill-link="character"]')?.href ===
                    "https://github.com/andro951/ember-adventures-tools/raw/refs/heads/main/downloads/EmberAdventuresLite-skills.zip",
                    "character creator links to its GitHub skill");
                const nameField = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "name"]);
                devAssert(devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "age"]).value === "" &&
                    devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "gender"]).value === "",
                    "new character age and gender start blank");
                devAssert(![...tree.querySelectorAll(".state-field")].some(label =>
                    label.querySelector('input:not([type="checkbox"]), textarea') && label.querySelector("small.hint")),
                    "character text hints appear only inside inputs");
                devAssert(nameField.value === "" && app.manualCharacterDraft.role === "" &&
                    app.manualCharacterDraft.personality_description === "" && app.manualCharacterDraft.appearance.species === "" &&
                    app.manualCharacterDraft.outfits.every(outfit => outfit.name === "" && Object.values(outfit.clothing).every(value => value === "")),
                    "new character authoring text starts blank while retaining numeric defaults");
                devAssert([...tree.querySelectorAll("textarea[data-state-path], input[data-state-path]")]
                    .filter(field => field.type !== "checkbox" && field.type !== "hidden")
                    .every(field => !!field.placeholder),
                    "character text and numeric fields provide entry hints");

                const booleanFields = [...tree.querySelectorAll('input[data-state-kind="boolean"]')];
                devAssert(booleanFields.length > 0, "character editor exposes boolean controls");
                devAssert(booleanFields.every(field => !field.closest(".state-field").querySelector("small.hint")),
                    "character boolean fields do not show generated entry hints");
                for (const checkbox of booleanFields) {
                    const row = checkbox.closest(".state-field");
                    const oldWidth = row.style.width;
                    row.style.width = "260px";
                    const nameBounds = row.querySelector(".state-field-name").getBoundingClientRect();
                    const boxBounds = checkbox.getBoundingClientRect();
                    if (boxBounds.height > 0)
                        devAssert(boxBounds.left >= nameBounds.right &&
                            boxBounds.top < nameBounds.bottom && boxBounds.bottom > nameBounds.top,
                            "boolean labels and checkboxes stay beside each other in narrow editor rows");
                    row.style.width = oldWidth;
                }

                const boldnessField = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "boldness"]);
                const boldnessMode = boldnessField.previousElementSibling;
                boldnessMode.value = "custom";
                boldnessMode.dispatchEvent(new Event("change"));
                boldnessField.value = "Quietly confident and deliberate";
                const heightField = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "appearance", "height"]);
                const heightMode = heightField.previousElementSibling;
                for (const field of [boldnessField, heightField]) {
                    const modeBounds = field.previousElementSibling.getBoundingClientRect();
                    const fieldBounds = field.getBoundingClientRect();
                    const removeBounds = field.parentElement.querySelector(".state-field-actions").getBoundingClientRect();
                    devAssert(Math.abs(modeBounds.top - fieldBounds.top) < 2 &&
                        Math.abs(removeBounds.top - fieldBounds.top) < 2 &&
                        fieldBounds.width > modeBounds.width,
                        "scale editor keeps a compact mode, wider value, and remove action on one row");
                }
                heightMode.value = "custom";
                heightMode.dispatchEvent(new Event("change"));
                heightField.value = "Towering with long proportions";

                nameField.value = "Smoke List Editor";
                const genres = tree.querySelector("[data-character-editor-genres]");
                devAssert(!!genres && ![...tree.querySelectorAll("[data-state-array-add-path]")].some(button =>
                    decodeURIComponent(button.dataset.stateArrayAddPath) === JSON.stringify(["character_definition", "genres"])),
                    "character genres use a picker instead of generic list rows");
                genres.querySelector("button").click();
                const popup = [...document.querySelectorAll(".popup-modal.open")].at(-1);
                const check = popup.querySelector("[data-character-library-picker-option]");
                check.classList.add("active");
                [...popup.querySelectorAll("button")].find(button => button.textContent === "Apply").click();
                const draft = library
                    ? readCharacterDefinitionOnlyEditor(app.manualCharacterDraft, tree)
                    : readCharacterDefinitionManagedEditor(app.manualCharacterDraft, tree);
                devAssert(draft.genres.includes(check.dataset.characterLibraryPickerOption) && genres.textContent.includes(check.dataset.characterLibraryPickerOption),
                    "genre picker selection is displayed and included in the edited definition");
                devAssert(draft.name === "Smoke List Editor", "genre selection preserves other unsaved fields");
                devAssert(draft.boldness === "Quietly confident and deliberate" &&
                    draft.appearance.height === "Towering with long proportions",
                    "editor preserves custom boldness and body size across genre picker changes");
                boldnessMode.value = "scale";
                boldnessMode.dispatchEvent(new Event("change"));
                boldnessField.value = "8";
                heightMode.value = "scale";
                heightMode.dispatchEvent(new Event("change"));
                heightField.value = "12";
                const numericDraft = library ? readCharacterDefinitionOnlyEditor(app.manualCharacterDraft, tree)
                    : readCharacterDefinitionManagedEditor(app.manualCharacterDraft, tree);
                devAssert(numericDraft.boldness === 8 && numericDraft.appearance.height === 12,
                    "editor switches custom boldness and body size back to numbers");
                closeModal();
                devAssert(!!document.querySelector("#confirmNoBtn"), "closing new character asks before discarding");
                document.querySelector("#confirmNoBtn").click();
                await Promise.resolve();
                devAssert(tree.isConnected && nameField.value === "Smoke List Editor", "Keep Editing preserves the draft");
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
                devAssert(!!document.querySelector("#confirmYesBtn"), "Escape also asks before discarding");
                document.querySelector("#confirmYesBtn").click();
                await Promise.resolve();
                devAssert(!mainModalOpen() && app.manualCharacterDraft === null, "discard closes the editor and clears the draft");
            }
            openManualCharacterCreateModal({ library: true });
            for (const key of ["starting_known_facts"]) {
                const path = ["character_definition", key];
                let editor = $("manualCharacterCreateEditor");
                const add = [...editor.querySelectorAll("[data-state-array-add-path]")].find(button =>
                    decodeURIComponent(button.dataset.stateArrayAddPath) === JSON.stringify(path));
                devAssert(!!add, "new definitions expose both starting fact lists");
                add.click();
                await devWaitFor(() => !!devFieldByPath("#manualCharacterCreateEditor", [...path, 0]),
                    2000, "starting fact input to render after adding an item");
                editor = $("manualCharacterCreateEditor");
                const field = devFieldByPath("#manualCharacterCreateEditor", [...path, 0]);
                devAssert(!!field && !!field.placeholder, "adding a starting fact creates a text field with a hint");
                devAssert(!field.closest(".state-field").querySelector(".state-field-name"),
                    "fact list entries do not show redundant value or index labels");
                field.value = "Generic smoke fact";
                const draft = readCharacterDefinitionOnlyEditor(app.manualCharacterDraft, editor);
                devAssert(draft[key]?.[0] === "Generic smoke fact", "starting facts survive definition editor readback");
            }
            app.manualCharacterDraft = null;
            closeModal();
            openManualCharacterCreateModal();
            devAssertEditorPathVisible("#manualCharacterCreateEditor", ["character_definition", "name"], "Manual character creator exposes Character Definition fields");
            devAssertEditorPathHidden("#manualCharacterCreateEditor", ["character_definition", "voice"], "Manual character creator hides voice internals");
            devAssertEditorPathHidden("#manualCharacterCreateEditor", ["character_definition", "default_seed"], "Manual character creator hides default seed");
            app.manualCharacterDraft = null;
            closeModal();

            const template = devSmokeTemplateRecord({ id: "editor-access-template", title: "Editor Access Template" });
            devUpsertStoryTemplatesForSmoke([template]);
            openStoryBuilder(template.id);
            devAssert($("storyBuilderOverlay").querySelector('[data-authoring-skill-link="story"]')?.href ===
                "https://github.com/andro951/ember-adventures-tools/raw/refs/heads/main/downloads/EmberAdventuresLite-skills.zip",
                "story editor links to its complete skill ZIP");
            setStoryBuilderPanel("overview");

            setStoryBuilderPanel("state");
            devAssertEditorPathHidden("#storyBuilderStateEditor", ["meta"], "Story Builder state editor hides meta internals");
            devAssertEditorPathHidden("#storyBuilderStateEditor", ["future_cast"], "Story Builder state editor hides future cast from raw state panel");
            devAssertEditorPathHidden("#storyBuilderStateEditor", ["objectives"], "Story Builder state editor hides objectives from raw state panel");
            app.storyBuilder = null;
            document.body.classList.remove("story-builder-open");
            $("storyBuilderOverlay")?.classList.add("hidden");

            const mapEditor = document.createElement("div");
            mapEditor.id = "devMapDetailEditorSmoke";
            mapEditor.innerHTML = buildFriendlyStateEditor(
                {
                    id: "hidden-id",
                    name: "Visible Map",
                    description: "Visible map description.",
                    seed: 123,
                    npcs: ["Hidden Future"],
                    hidden: true,
                },
                ["map_detail"],
                0,
                { profile: "map_detail" },
            );
            document.body.appendChild(mapEditor);
            devAssertEditorPathVisible("#devMapDetailEditorSmoke", ["map_detail", "name"], "Map/detail editor exposes visible map fields");
            devAssertEditorPathHidden("#devMapDetailEditorSmoke", ["map_detail", "id"], "Map/detail editor hides technical ids");
            devAssertEditorPathHidden("#devMapDetailEditorSmoke", ["map_detail", "npcs"], "Map/detail editor hides NPC internals");
            mapEditor.remove();

            addMessage("system", "JSON editor access smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: json-editor-access-smoke");
        }

        async function devRunStoryBuilderMetadataSmokeTest() {
            devTestLog("Scenario start: story-builder-metadata-smoke");
            try {
                devResetForLiveTest("story-builder-metadata-smoke");
                const template = devSmokeTemplateRecord({
                    id: "story-builder-metadata-smoke-template",
                    title: "Story Builder Metadata Smoke",
                    genres: ["fantasy"],
                });
                template.state.characters ||= {};
                template.state.meta ||= {};
                Object.assign(template.state.objectives.items[0], {
                    next_objectives: [{
                        id: "metadata-smoke-ending",
                        completion_instruction: "Conclude the metadata smoke.",
                        rewards: [],
                        ending_type: "freeplay",
                        ending_message:
                            "The metadata smoke story continues in freeplay.",
                    }],
                });
                devUpsertStoryTemplatesForSmoke([template]);
                const emptyObjectiveResult = extractObjectives(
                    {},
                    {
                        progression: { current_goal: "Stale generated goal" },
                        scene: {
                            objective: "Stale scene objective",
                            summary: "Stale scene summary",
                        },
                    },
                );
                const malformedObjectiveResult = extractObjectives({
                    items: [
                        { title: "Missing objective text" },
                        { objective: "Missing title" },
                        {
                            title: "Valid objective",
                            objective: "Do the valid thing.",
                        },
                    ],
                });
                devAssert(
                    emptyObjectiveResult.active_id === "" &&
                        emptyObjectiveResult.items.length === 0 &&
                        emptyObjectiveResult.suggestions.length === 0 &&
                        malformedObjectiveResult.items.length === 1 &&
                        malformedObjectiveResult.items[0].title === "Valid objective",
                    "Objective extraction rejects missing objective title/text instead of creating fallback objectives",
                    { emptyObjectiveResult, malformedObjectiveResult },
                );
                openStoryBuilder(template.id);
                setStoryBuilderPanel("overview");

                $("storyBuilderTitle").value = "Story Builder Metadata Edited";
                $("storyBuilderDescription").value = "Edited metadata smoke description.";
                $("storyBuilderSource").value = "Edited Smoke Source";
                $("storyBuilderCreationTool").value = "Edited Tool";
                $("storyBuilderDefaultImageModel").value = "cinematic";

                $("storyBuilderGuidance").value = "Edited guidance should persist.";
                document.querySelectorAll(".storyBuilderGenreCheck").forEach((field) => {
                    field.checked = ["fantasy", "comedy"].includes(field.value);
                });
                await saveStoryBuilderDraft(false);
                const saved = storyTemplateById(template.id);
                devTestLog("Story Builder saved metadata", {
                    title: saved?.title,
                    source: saved?.source,
                    creation_tool: saved?.creation_tool,
                    popupText: [...document.querySelectorAll(".popup-modal.open")].at(-1)?.textContent || "",
                });
                devAssert(
                    saved.title === "Story Builder Metadata Edited" &&
                        saved.source === "Edited Smoke Source" &&
                        saved.creation_tool === "Edited Tool",
                    "Story Builder saves title/source/tool metadata",
                    saved,
                );
                devAssert(
                    saved.default_image_model === "cinematic" &&
                        saved.state?.meta?.default_image_model === "cinematic",
                    "Story Builder saves story default image style",
                    saved,
                );

                devAssert(
                    (saved.genres || []).includes("fantasy") &&
                        (saved.genres || []).includes("comedy") &&
                        (saved.state?.meta?.genres || []).includes("comedy"),
                    "Story Builder saves approved genre selections",
                    saved,
                );
                devAssert(
                    saved.state?.meta?.story_guidance === "Edited guidance should persist.",
                    "Story Builder saves story guidance",
                    saved.state?.meta,
                );
                openStoryBuilder(template.id);
                setStoryBuilderPanel("overview");

                app.storyBuilder = null;
                document.body.classList.remove("story-builder-open");
                $("storyBuilderOverlay")?.classList.add("hidden");
                addMessage("system", "Story Builder metadata smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: story-builder-metadata-smoke");
            } finally {
                app.storyBuilder = null;
                document.body.classList.remove("story-builder-open");
                $("storyBuilderOverlay")?.classList.add("hidden");
                await devCleanupSmokeStoryLibraryArtifacts("story builder metadata smoke story artifacts cleaned");
            }
        }

        async function devRunReservedCreatorNameClientSmokeTest() {
            devTestLog("Scenario start: reserved-creator-name-client-smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalFetch = publicLibraryFetch;
            const requests = [];
            try {
                app.supabaseSession = {
                    access_token: "reserved-creator-smoke-token",
                    refresh_token: "reserved-creator-smoke-refresh",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: {
                        id: "reserved-creator-smoke-user",
                        email: "someone@example.com",
                    },
                };
                publicLibraryFetch = async (path, options = {}) => {
                    requests.push({ path, options });
                    throw new Error("Reserved creator validation reached Supabase.");
                };
                const rejectedNames = [
                    "EmberAdventures",
                    "Ember Adventures",
                    "EMBERADVENTURES",
                    "eMbEr AdVeNtUrEs",
                    "andro951",
                    "ANDRO951",
                    "AnDrO951",
                    "andro 951",
                ];
                const errors = [];
                for (const [index, name] of rejectedNames.entries()) {
                    await publishCharacterRecordsToPublicIndex(
                        {
                            name: `Reserved Creator Publish Smoke ${index + 1}`,
                            creator_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                            creator: name,
                        },
                        "reserved creator smoke",
                    );
                    errors.push(
                        document.querySelector(".popup-modal.open")?.textContent
                            ?.replace(/\s+/g, " ")
                            .trim() || "",
                    );
                    document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                }
                devAssert(
                    errors.length === rejectedNames.length &&
                        errors.every(
                            (message) =>
                                message.includes(
                                    "This creator name is reserved by the creator of EmberAdventures.",
                                ),
                        ) &&
                        requests.length === 0,
                    "reserved creator names are rejected locally for another account before any Supabase request",
                    { rejectedNames, errors, requests },
                );
                const officialUser = {
                    id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                    email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                };
                devAssert(
                    creatorIdentityNameReservationError(
                        "EmberAdventures",
                        officialUser,
                    ) === "" &&
                        creatorIdentityNameReservationError(
                            "andro951",
                            officialUser,
                        ) === "" &&
                        /must be exactly/.test(
                            creatorIdentityNameReservationError(
                                "Ember Adventures",
                                officialUser,
                            ),
                        ) &&
                        /must be exactly/.test(
                            creatorIdentityNameReservationError(
                                "EMBERADVENTURES",
                                officialUser,
                            ),
                        ) &&
                        /must be exactly/.test(
                            creatorIdentityNameReservationError(
                                "ANDRO951",
                                officialUser,
                            ),
                        ),
                    "the official account accepts only the exact EmberAdventures and andro951 spellings",
                );
                devTestLog("Scenario complete: reserved-creator-name-client-smoke");
            } finally {
                publicLibraryFetch = originalFetch;
                saveSupabaseSession(originalSession);
            }
        }

        async function devRunSupabaseLiveReservedCreatorNameSmokeTest() {
            devTestLog("Scenario start: supabase-live-reserved-creator-name-smoke");
            devAssert(
                publicLibrarySupabaseConfigured(),
                "Supabase public library is configured for reserved creator-name smoke",
            );
            if (!supabaseSessionAccessToken() || !supabaseSignedInUser()?.id) {
                devTestLog(
                    "SKIP: Supabase reserved creator-name smoke requires an existing signed-in session",
                );
                throw smokeSkipError(
                    "Supabase reserved creator-name smoke requires an existing signed-in session.",
                );
            }
            const verified = await publicLibraryFetch(
                "/rest/v1/rpc/verify_emberadventures_creator_name_reservation",
                {
                    method: "POST",
                    body: {},
                },
            );
            devAssert(
                verified === true,
                "one Supabase RPC verifies both official creator-name reservations and leaves no test identity",
                { verified },
            );
            devTestLog("Scenario complete: supabase-live-reserved-creator-name-smoke");
        }

        async function devRunSupabaseClientConfigSmokeTest() {
            devTestLog("Scenario start: supabase-client-config-smoke");
            const originalFetch = publicLibraryFetch;
            const originalSettings = clone(app.settings);
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const calls = [];
            const liveReads = [];
            const assertLiveSupabaseRead = async (label, path, options = {}) => {
                const startedAt = performance.now();
                try {
                    const rows = await publicLibraryFetch(path, { auth: false, ...options });
                    const durationMs = Math.round(performance.now() - startedAt);
                    devAssert(Array.isArray(rows), `Supabase ${label} returns a row array`, {
                        path,
                        rows,
                        durationMs,
                    });
                    liveReads.push({ label, path, rows: rows.length, durationMs });
                } catch (err) {
                    const message = err?.message || String(err);
                    const lower = message.toLowerCase();
                    const setupIssue =
                        lower.includes("could not find") ||
                        lower.includes("relation") ||
                        lower.includes("schema cache") ||
                        lower.includes("42p01") ||
                        lower.includes("404");
                    const permissionIssue =
                        lower.includes("permission denied") ||
                        lower.includes("grant select") ||
                        lower.includes("42501") ||
                        lower.includes("401") ||
                        lower.includes("403");
                    throw new Error(
                        setupIssue
                            ? `Supabase setup check failed for ${label}. The expected table/columns are missing or not exposed through the Data API. Run the public-library schema setup, then re-run this smoke.\n${message}`
                            : permissionIssue
                              ? `Supabase read-only check failed for ${label}. The table exists, but anonymous public-library reads are not allowed yet. Grant SELECT to anon and add the intended public SELECT/RLS policy, then re-run this smoke.\n${message}`
                            : `Supabase read-only check failed for ${label}. Check the publishable key, Data API, RLS public SELECT policy, and URL configuration.\n${message}`,
                    );
                }
            };
            try {
                app.settings.publicLibrarySupabaseUrl = "https://example.supabase.co/rest/v1/";
                app.settings.publicLibrarySupabaseAnonKey = "sb_publishable_test";
                devAssert(
                    publicLibrarySupabaseUrl() === "https://example.supabase.co" &&
                        publicLibrarySupabaseAnonKey() === "sb_publishable_test",
                    "Supabase config normalizes base URL and publishable key",
                    {
                        url: publicLibrarySupabaseUrl(),
                        key: publicLibrarySupabaseAnonKey(),
                    },
                );
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (path.startsWith("/rest/v1/library_items")) {
                        return [
                            devSmokeSupabasePublicItemRow({
                                id: "story-item-1",
                                definition_id: "story-item-1-definition",
                                name: "Mock Public Story",
                                owner_user_id: "owner-1",
                                type: "story",
                                title: "Mock Public Story",
                                description: "Mock description",
                                creator: "Smoke",
                                creator_id: "00000000-0000-4000-8000-000000000001",
                                source: "Smoke Source",
                                creation_tool: "Codex",
                                genres: ["fantasy"],
                                current_version_id: "version-1",
                                visibility: "public",
                                updated_at: "2026-06-04T00:00:00.000Z",
                            }),
                        ];
                    }
                    if (path.startsWith("/rest/v1/library_versions")) {
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "version-1",
                                item_id: "story-item-1",
                                version_number: 1,
                                payload_url: "https://user.uploads.dev/file/mock-story.json.gz",
                                image_url: "https://example.com/mock-public-story-title-card.png",
                                created_at: "2026-06-04T00:00:00.000Z",
                            }),
                        ];
                    }
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    return null;
                };
                const index = await fetchPublicLibraryIndex({ mode: "stories" });
                devAssert(
                    index.items.length === 1 &&
                        index.items[0].type === "story-template" &&
                        index.items[0].url === "https://user.uploads.dev/file/mock-story.json.gz",
                    "Supabase public library rows normalize into local public library entries",
                    index,
                );
                devAssert(
                    calls.some((call) => call.path.startsWith("/rest/v1/library_items")) &&
                        calls.every((call) => call.options.auth === false),
                    "Public library browsing uses anonymous Supabase reads",
                    calls,
                );
                publicLibraryFetch = originalFetch;
                app.settings = {
                    ...clone(defaultSettings),
                    ...originalSettings,
                };
                app.supabaseSession = originalSession;
                const liveUrl = publicLibrarySupabaseUrl();
                const liveKey = publicLibrarySupabaseAnonKey();
                devAssert(
                    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(liveUrl) &&
                        /^sb_publishable_/i.test(liveKey) &&
                        !/^sb_secret_/i.test(liveKey) &&
                        !/service[_-]?role/i.test(liveKey),
                    "Supabase live config uses project URL plus publishable key only",
                    {
                        url: liveUrl,
                        keyPrefix: liveKey.slice(0, 16),
                    },
                );
                await assertLiveSupabaseRead(
                    "library_items schema",
                    "/rest/v1/library_items?select=" + SUPABASE_PUBLIC_ITEM_ROW_FIELDS.join(",") + "&limit=1",
                );
                await assertLiveSupabaseRead(
                    "library_versions schema",
                    "/rest/v1/library_versions?select=id,item_id,version_number,payload_url,payload_sha256,payload_size_bytes,image_url,change_summary,created_by_user_id,created_at&limit=1",
                );
                await assertLiveSupabaseRead(
                    "public discovery RPC",
                    "/rest/v1/rpc/search_public_library_items",
                    {
                        method: "POST",
                        body: {
                            item_type: "story",
                            ...EmberSharedLibraryFormat.searchScope(),
                            sort_mode: "highest-rated",
                            result_limit: 1,
                        },
                    },
                );
                devAssert(
                    liveReads.length === 3 && liveReads.every((read) => Number.isFinite(read.durationMs)),
                    "Supabase smoke completed public item, version, and discovery checks without reading private rating/report rows",
                    liveReads,
                );
                addMessage("system", "Supabase client config smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-client-config-smoke");
            } finally {
                publicLibraryFetch = originalFetch;
                app.settings = {
                    ...clone(defaultSettings),
                    ...originalSettings,
                };
                app.supabaseSession = originalSession;
            }
        }

        async function devRunSupabaseAuthSessionSmokeTest() {
            devTestLog("Scenario start: supabase-auth-session-smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalWindowFetch = window.fetch;
            try {
                devAssert(
                    publicLibrarySupabaseConfigured(),
                    "Supabase public library is configured before auth session check",
                    {
                        url: publicLibrarySupabaseUrl(),
                        keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
                    },
                );
                const authRetryCalls = [];
                app.supabaseSession = {
                    access_token: "expired-supabase-auth-smoke-token",
                    refresh_token: "refresh-supabase-auth-smoke-token",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "supabase-auth-smoke-user" },
                };
                window.fetch = async (url, options = {}) => {
                    const requestUrl = String(url || "");
                    const authorization = String(options?.headers?.Authorization || "");
                    authRetryCalls.push({ requestUrl, authorization });
                    if (requestUrl.includes("/auth/v1/token?grant_type=refresh_token")) {
                        return {
                            ok: true,
                            status: 200,
                            text: async () => JSON.stringify({
                                access_token: "refreshed-supabase-auth-smoke-token",
                                refresh_token: "refreshed-supabase-auth-smoke-token",
                                expires_at: Math.floor(Date.now() / 1000) + 3600,
                            }),
                        };
                    }
                    if (requestUrl.includes("/rest/v1/rpc/search_public_library_items")) {
                        if (authorization.includes("expired-supabase-auth-smoke-token")) {
                            return {
                                ok: false,
                                status: 401,
                                statusText: "Unauthorized",
                                text: async () => '{"code":"PGRST303","message":"JWT expired"}',
                            };
                        }
                        return { ok: true, status: 200, text: async () => "[]" };
                    }
                    throw new Error(`Unexpected Supabase auth smoke request: ${requestUrl}`);
                };
                const retriedRows = await publicLibraryFetch(
                    "/rest/v1/rpc/search_public_library_items",
                    { method: "POST", body: { item_type: "story" } },
                );
                devAssert(
                    Array.isArray(retriedRows) &&
                        authRetryCalls.length === 3 &&
                        authRetryCalls[0].authorization.includes("expired-supabase-auth-smoke-token") &&
                        authRetryCalls[1].requestUrl.includes("/auth/v1/token?grant_type=refresh_token") &&
                        authRetryCalls[2].authorization.includes("refreshed-supabase-auth-smoke-token"),
                    "Supabase retries an expired JWT request once after refreshing the session",
                    authRetryCalls,
                );
                authRetryCalls.length = 0;
                app.supabaseSession = {
                    access_token: "concurrent-supabase-auth-smoke-token",
                    refresh_token: "concurrent-supabase-auth-smoke-refresh",
                    expires_at: 0,
                    user: { id: "supabase-auth-smoke-user" },
                };
                const concurrentRefreshes = await Promise.all([
                    publicLibraryRefreshSessionIfNeeded({ force: true }),
                    publicLibraryRefreshSessionIfNeeded({ force: true }),
                ]);
                devAssert(
                    authRetryCalls.filter((call) =>
                        call.requestUrl.includes(
                            "/auth/v1/token?grant_type=refresh_token",
                        ),
                    ).length === 1 &&
                        concurrentRefreshes.every(
                            (session) =>
                                session?.access_token ===
                                "refreshed-supabase-auth-smoke-token",
                        ),
                    "concurrent Supabase refresh callers share one rotating-token request",
                    { authRetryCalls, concurrentRefreshes },
                );
                window.fetch = originalWindowFetch;
                saveSupabaseSession(originalSession);
                addMessage("system", "Supabase auth session smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-auth-session-smoke");
            } finally {
                window.fetch = originalWindowFetch;
                // Preserve any refreshed token from a successful live check, but
                // restore the original no-session state if the user was not signed in.
                if (!originalSession?.access_token) saveSupabaseSession(originalSession);
            }
        }

        async function devRunSupabasePublicDownloadSmokeTest() {
            devTestLog("Scenario start: supabase-public-download-smoke");
            const originalFetchPayload = fetchJsonFromPublicUploadUrl;
            const originalVerifiedFetchPayload = fetchVerifiedPublicLibraryPayload;
            const originalGlobalFetch = globalThis.fetch;
            const originalGenerateStoryTemplateTitleCardImage =
                generateStoryTemplateTitleCardImage;
            const originalQueueProfileImage = queueProfileImage;
            const smokeCharacterBaseName = "Public Download Ally";
            const smokeCharacterName = `${smokeCharacterBaseName} ${Date.now().toString(36)}`;
            const fallbackCharacterName = `${smokeCharacterName} Hosted Fallback`;
            const isPublicDownloadSmokeCharacterName = (name = "") =>
                String(name || "") === smokeCharacterBaseName ||
                String(name || "").startsWith(`${smokeCharacterBaseName} `);
            const isSupabasePublicDownloadSmokeArtifactName = (name = "") =>
                isPublicDownloadSmokeCharacterName(name) ||
                String(name || "") === "Public Publish Character Smoke";
            const originalCharacterDefinitions = clone(app.characterDefinitions || []).filter(
                (record) =>
                    !isSupabasePublicDownloadSmokeArtifactName(
                        record?.name || record?.character?.name,
                    ),
            );
            const originalState = clone(app.state || {});
            const originalMessages = clone(app.messages || []);
            const originalProfileImages = clone(app.profileImages || []).filter(
                (image) => !isSupabasePublicDownloadSmokeArtifactName(image?.owner_name),
            );
            const storedStoryTitleCardImages = await loadPerRecordLibrary(
                STORY_TITLE_CARD_IMAGE_KEY,
                app.storyTitleCardImages || [],
            );
            app.storyTitleCardImages = exactStoryTitleCardImageStore(
                storedStoryTitleCardImages || [],
            );
            const originalStoryTitleCardImages = clone(
                app.storyTitleCardImages.filter(
                    (image) => !isSmokeStoryTitleCardArtifact(image),
                ),
            );
            const originalPublicLibraryLastIndex = app.publicLibraryLastIndex
                ? clone(app.publicLibraryLastIndex)
                : null;
            const originalPublicPayloads = app.characterLibraryPublicPayloads
                ? { ...app.characterLibraryPublicPayloads }
                : null;
            const originalCuratedEntries = app.publicLibraryCuratedEntries
                ? clone(app.publicLibraryCuratedEntries)
                : null;
            const storyUrl = "https://user.uploads.dev/file/public-download-smoke-story.json";
            const storyImageUrl =
                "https://user.uploads.dev/file/public-download-smoke-story-title-card.png";
            const characterUrl = "https://user.uploads.dev/file/public-download-smoke-character.json";
            const fallbackCharacterUrl = "https://user.uploads.dev/file/public-download-smoke-character-fallback.json";
            const characterImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
            const fallbackCharacterImageUrl =
                "https://user.uploads.dev/file/public-download-smoke-character-fallback.png";
            try {
                await devCleanupSmokeStoryLibraryArtifacts(
                    "public download smoke removed prior story artifacts",
                );
                await devCleanupSmokeStoryTitleCardArtifacts(
                    "public download smoke removed prior title-card artifacts",
                );
                app.characterDefinitions = validatedCharacterLibraryDefinitions(
                    originalCharacterDefinitions,
                );
                app.profileImages = exactProfileImageStore(originalProfileImages);
                app.characterLibraryPublicPayloads = {};
                app.publicLibraryCuratedEntries = {};
                const publicStoryDefinition = devSmokeStoryRecord({
                    id: "public-download-smoke-story",
                    title: "Public Download Smoke Story",
                    description: "A mocked public story payload used only by the smoke test.",
                    source: "Original",
                    genres: ["fantasy"],
                    player: devSmokeRuntimeCharacter("Public Download Hero", {
                        gender: "female",
                        role: "mocked public download hero",
                    }),
                    scene_summary: "The public download smoke story is ready to begin.",
                    objectives: [
                        devSmokeObjective("start", "Start", {
                            status: "active",
                            summary: "Verify the imported public story appears locally.",
                            completion_control: "player",
                            completion_criteria: "Begin the imported public story.",
                            completion_instruction:
                                "Show that the public download smoke story has begun.",
                            ending_type: "freeplay",
                            ending_message:
                                "The public download smoke story continues in freeplay.",
                        }),
                    ],
                    active_id: "start",
                    messages: [
                        {
                            role: "assistant",
                            speaker: "Narrator",
                            text: "The public download smoke story opens.",
                        },
                    ],
                });
                publicStoryDefinition.title_card_image.url = storyImageUrl;
                const publicStoryPayload = {
                    app: "EmberAdventures",
                    exportType: "story-template",
                    exportedAt: new Date().toISOString(),
                    storyTemplate: publicStoryDefinition,
                };
                const publicCharacterRecord = devSmokeCharacterRecord(smokeCharacterName, {
                    character: {
                        age: 27,
                        gender: "non-male",
                        role: "mocked public import ally",
                        source: "Original",
                        creator: "debug harness",
                        creator_id: "00000000-0000-4000-8000-000000000001",
                        creation_tool: "EmberAdventures Character Creator",
                        genres: ["fantasy"],
                    },
                });
                const publicCharacterPayload = {
                    character_definition: clone(publicCharacterRecord.character),
                };
                const fallbackCharacterRecord = devSmokeCharacterRecord(
                    fallbackCharacterName,
                    {
                        character: {
                            age: 27,
                            gender: "non-male",
                            role: "mocked hosted fallback ally",
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "EmberAdventures Character Creator",
                            genres: ["fantasy"],
                        },
                    },
                );
                const fallbackDefaultProfile = {
                    ...devSmokeDefaultProfileImage(fallbackCharacterName, false),
                    url: fallbackCharacterImageUrl,
                };
                fallbackCharacterRecord.character.default_profile_image = clone(
                    fallbackDefaultProfile,
                );
                fallbackCharacterRecord.character.profile_image_presentations =
                    createProfileImagePresentations({
                        male: devSmokeDefaultProfileImage(
                            `${fallbackCharacterName} Alternate`,
                            true,
                        ),
                        non_male: fallbackDefaultProfile,
                    });
                const fallbackCharacterPayload = {
                    character_definition: clone(fallbackCharacterRecord.character),
                };
                fetchJsonFromPublicUploadUrl = async (url) => {
                    if (String(url || "").startsWith(storyUrl)) return clone(publicStoryPayload);
                    if (String(url || "").startsWith(fallbackCharacterUrl))
                        return clone(fallbackCharacterPayload);
                    if (String(url || "").startsWith(characterUrl)) return clone(publicCharacterPayload);
                    throw new Error(`Unexpected public payload URL in smoke: ${url}`);
                };
                fetchVerifiedPublicLibraryPayload = async (entry) => {
                    if (String(entry?.url || "").startsWith(storyUrl))
                        return clone(publicStoryPayload);
                    if (String(entry?.url || "").startsWith(fallbackCharacterUrl))
                        return clone(fallbackCharacterPayload);
                    if (String(entry?.url || "").startsWith(characterUrl))
                        return clone(publicCharacterPayload);
                    throw new Error(`Unexpected verified public payload URL in smoke: ${entry?.url}`);
                };
                app.publicLibraryLastIndex = devSmokePublicLibraryIndex({
                    items: [
                        {
                            id: "public-download-story",
                            type: "story-template",
                            name: "Public Download Smoke Story",
                            title: "Public Download Smoke Story",
                            description: "Mock public story entry.",
                            url: storyUrl,
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                        },
                        {
                            id: "public-download-character",
                            type: "character",
                            name: smokeCharacterName,
                            title: smokeCharacterName,
                            description: "",
                            url: characterUrl,
                            image_url: characterImageUrl,
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            age: 18,
                            gender: "non-male",
                            male_name: `${smokeCharacterName} Alternate`,
                            non_male_name: smokeCharacterName,
                            male_image_url: devSmokeDefaultProfileImage(
                                `${smokeCharacterName} Male`,
                                true,
                            ).url,
                            non_male_image_url: characterImageUrl,
                            age: 27,
                            role: "mocked public import ally",
                        },
                        {
                            id: "public-download-character-hosted-fallback",
                            type: "character",
                            name: fallbackCharacterName,
                            title: fallbackCharacterName,
                            description: "",
                            url: fallbackCharacterUrl,
                            image_url: fallbackCharacterImageUrl,
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            gender: "non-male",
                            male_name: `${fallbackCharacterName} Alternate`,
                            non_male_name: fallbackCharacterName,
                            male_image_url: devSmokeDefaultProfileImage(
                                `${fallbackCharacterName} Alternate`,
                                true,
                            ).url,
                            non_male_image_url: fallbackCharacterImageUrl,
                            age: 27,
                            role: "mocked hosted fallback ally",
                        },
                    ],
                });
                let storyImageFetchCount = 0;
                let storyImageGenerationCount = 0;
                globalThis.fetch = async (url, options) => {
                    if (String(url || "") === storyImageUrl) {
                        storyImageFetchCount++;
                        throw new TypeError("Failed to fetch");
                    }
                    return originalGlobalFetch(url, options);
                };
                generateStoryTemplateTitleCardImage = (id, options = {}) => {
                    if (String(id || "") === "public-download-smoke-story") {
                        storyImageGenerationCount++;
                        return false;
                    }
                    return originalGenerateStoryTemplateTitleCardImage(id, options);
                };
                await importPublicLibraryEntry("public-download-story");
                if (!(app.storyTemplates || []).some(
                    (template) => template.title === "Public Download Smoke Story",
                ))
                    devTestLog("Public story download mismatch", {
                        storyTitles: (app.storyTemplates || []).map((template) => template.title),
                        failureText: (app.storageFailures || []).slice(-3)
                            .map((failure) => `${failure.key}: ${failure.message}`)
                            .join(" | "),
                        popupText:
                            [...document.querySelectorAll(".popup-modal.open")].at(-1)
                                ?.textContent || "",
                    });
                devAssert(
                    (app.storyTemplates || []).some(
                        (template) => template.title === "Public Download Smoke Story",
                    ),
                    "public story download imports into local Story Library",
                    (app.storyTemplates || []).map((template) => template.title),
                );
                const importedStory = (app.storyTemplates || []).find(
                    (template) => template.title === "Public Download Smoke Story",
                );
                await devWaitFor(
                    () => {
                        const current = (app.storyTemplates || []).find(
                            (template) => template.title === "Public Download Smoke Story",
                        );
                        const imageId = storyTitleCardActiveId(current);
                        return !!imageId && profileImageIsFinished(
                            storyTitleCardImageById(current, imageId),
                        );
                    },
                    3000,
                    "public story hosted title-card background copy to finish",
                );
                const importedTitleCard = importedStory
                    ? storyTitleCardImageById(
                          importedStory,
                          storyTitleCardActiveId(importedStory),
                      )
                    : null;
                await new Promise((resolve) => setTimeout(resolve, 25));
                devAssert(
                    storyImageFetchCount === 0 &&
                        storyImageGenerationCount === 0 &&
                        !!storyTitleCardActiveId(importedStory) &&
                        !!importedTitleCard &&
                        profileImageIsFinished(importedTitleCard) &&
                        extractImageSrc(importedTitleCard.html) === storyImageUrl &&
                        importedStory.title_card_image.favorite !== true &&
                        importedTitleCard.favorite !== true &&
                        !!storyTemplateTitleCardSrc(importedStory),
                    "public story download retains its hosted title image as finished and never generates a replacement",
                    {
                        titleCard: importedStory?.title_card_image,
                        image: importedTitleCard,
                        storyImageFetchCount,
                        storyImageGenerationCount,
                    },
                );
                const reloadedImageId = `public-download-smoke-reloaded-${Date.now()}`;
                const reloadedImage = exactStoryTitleCardImageStore([
                    {
                        ...clone(importedTitleCard),
                        id: reloadedImageId,
                        at: new Date().toISOString(),
                        source: "stored",
                        reason: "reloaded story title image smoke",
                        url: "",
                        html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">`,
                        hosted_url: "",
                        smoke_test_artifact: true,
                    },
                ])[0];
                saveStoryTitleCardChanges(importedStory, [reloadedImage]);
                await app.work.flush(`story-image-owner:${importedStory.id}`);
                const storedImages = await legacySharedImagesFromNormalized(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    [],
                );
                const storedReloadedImage = storedImages.find(
                    (image) => String(image.id || "") === reloadedImageId,
                );
                const sessionSource = extractImageSrc(storedReloadedImage?.html) || "";
                devAssert(
                    sessionSource.startsWith("blob:"),
                    "persisted story title image reloads through a session blob URL",
                    { image: storedReloadedImage },
                );
                app.storyTitleCardImages = exactStoryTitleCardImageStore([
                    ...(app.storyTitleCardImages || []).filter(
                        (image) => String(image.id || "") !== reloadedImageId,
                    ),
                    storedReloadedImage,
                ]);
                revokeSessionImageObjectUrl(`storyTitleImages|${reloadedImageId}`);
                const storageFailureCount = (app.storageFailures || []).length;
                saveStoryTitleCardChanges(importedStory, [storedReloadedImage]);
                await app.work.flush(`story-image-owner:${importedStory.id}`);
                const persistedReloadedImage = await app.persistence.getRecord(
                    "storyTitleImages",
                    reloadedImageId,
                );
                const persistedReloadedAsset = await app.persistence.getRecord(
                    "assetBlobs",
                    reloadedImageId,
                );
                devAssert(
                    persistedReloadedImage?.imageId === reloadedImageId &&
                        persistedReloadedAsset?.blob instanceof Blob &&
                        (app.storageFailures || []).length === storageFailureCount,
                    "re-adopting a persisted story title image reuses its stored Blob instead of fetching its expired session URL",
                    {
                        image: persistedReloadedImage,
                        hasBlob: persistedReloadedAsset?.blob instanceof Blob,
                        storageFailuresBefore: storageFailureCount,
                        storageFailuresAfter: (app.storageFailures || []).length,
                    },
                );
                globalThis.fetch = originalGlobalFetch;
                generateStoryTemplateTitleCardImage =
                    originalGenerateStoryTemplateTitleCardImage;
                const publicDownloadImports = await importPublicCharacterToLibrary(
                    "public-download-character",
                );
                const importedCharacter = (app.characterDefinitions || []).find(
                    (record) => record.name === smokeCharacterName,
                );
                const importedCharacterPresentations =
                    createProfileImagePresentations(
                        importedCharacter?.character?.profile_image_presentations,
                    );
                const importedCharacterDefault =
                    importedCharacterPresentations.non_male ||
                    importedCharacter?.character?.default_profile_image ||
                    {};
                const importedCharacterDefaultImage = profileImageByStoreId(
                    importedCharacterDefault.local_image_id,
                );
                if (
                    !importedCharacter ||
                    !importedCharacterDefault.url ||
                    !importedCharacterDefault.local_image_id ||
                    !profileImageIsFinished(importedCharacterDefaultImage) ||
                    importedCharacterDefault.favorite === true ||
                    importedCharacterDefaultImage?.favorite === true ||
                    localDefaultProfileImage(importedCharacter.character)?.id !==
                        importedCharacterDefault.local_image_id
                )
                    devTestLog("Public character hosted image import mismatch", {
                        importedCount: (publicDownloadImports || []).length,
                        importedName: importedCharacter?.name || "",
                        defaultUrl: importedCharacterDefault.url || "",
                        defaultLocalId: importedCharacterDefault.local_image_id || "",
                        storedImageId: importedCharacterDefaultImage?.id || "",
                        storedFinished: profileImageIsFinished(importedCharacterDefaultImage),
                        defaultFavorite: importedCharacterDefault.favorite === true,
                        storedFavorite: importedCharacterDefaultImage?.favorite === true,
                        resolvedDefaultId:
                            localDefaultProfileImage(importedCharacter?.character)?.id || "",
                        profileImageIds: (app.profileImages || []).map((image) => image.id),
                    });
                devAssert(
                    !!importedCharacter &&
                        !!importedCharacterDefault.url &&
                        !!importedCharacterDefault.local_image_id &&
                        profileImageIsFinished(importedCharacterDefaultImage) &&
                        importedCharacterDefault.favorite !== true &&
                        importedCharacterDefaultImage?.favorite !== true &&
                        localDefaultProfileImage(importedCharacter.character)?.id ===
                            importedCharacterDefault.local_image_id,
                    "public character download imports the public index hosted image into local default profile image history without auto-favoriting",
                    {
                        imported: publicDownloadImports,
                        importedCharacter,
                        defaultProfileImage: importedCharacterDefault,
                        presentations: importedCharacterPresentations,
                        profileImage: importedCharacterDefaultImage,
                        popupText:
                            [...document.querySelectorAll(".popup-modal.open")].at(-1)
                                ?.textContent || "",
                    },
                );
                const originalFetchForHostedFallback = globalThis.fetch;
                let fallbackImageFetchCount = 0;
                let fallbackImageGenerationCount = 0;
                let fallbackImports = [];
                try {
                    globalThis.fetch = async (url, options) => {
                        if (String(url || "") === fallbackCharacterImageUrl) {
                            fallbackImageFetchCount++;
                            throw new TypeError("Failed to fetch");
                        }
                        return originalFetchForHostedFallback(url, options);
                    };
                    queueProfileImage = (name, options = {}) => {
                        if (String(name || "") === fallbackCharacterName) {
                            fallbackImageGenerationCount++;
                            return false;
                        }
                        return originalQueueProfileImage(name, options);
                    };
                    fallbackImports = await importPublicCharacterToLibrary(
                        "public-download-character-hosted-fallback",
                    );
                    await new Promise((resolve) => setTimeout(resolve, 25));
                } finally {
                    globalThis.fetch = originalFetchForHostedFallback;
                    queueProfileImage = originalQueueProfileImage;
                }
                const fallbackCharacter = (app.characterDefinitions || []).find(
                    (record) => record.name === fallbackCharacterName,
                );
                const fallbackPresentations = createProfileImagePresentations(
                    fallbackCharacter?.character?.profile_image_presentations,
                );
                const importedFallbackSlot = fallbackPresentations.non_male || {};
                const importedFallbackImage = profileImageByStoreId(
                    importedFallbackSlot.local_image_id,
                );
                devAssert(
                    fallbackImageFetchCount === 1 &&
                        fallbackImageGenerationCount === 0 &&
                        fallbackImports.length === 1 &&
                        !!fallbackCharacter &&
                        importedFallbackSlot.url === fallbackCharacterImageUrl &&
                        !!importedFallbackSlot.local_image_id &&
                        profileImageIsFinished(importedFallbackImage) &&
                        extractImageSrc(importedFallbackImage?.html) ===
                            fallbackCharacterImageUrl &&
                        importedFallbackImage?.pending === false &&
                        !importedFallbackImage?.error,
                    "public character download survives a hosted profile-image fetch failure and stores the hosted URL fallback",
                    {
                        fallbackImageFetchCount,
                        fallbackImageGenerationCount,
                        importedCount: fallbackImports.length,
                        fallbackCharacter,
                        fallbackSlot: importedFallbackSlot,
                        fallbackImage: importedFallbackImage,
                    },
                );
                document.querySelectorAll(".popup-modal.open").forEach(node => node.remove());
                closeModal();
                addMessage("system", "Supabase public download smoke test passed.");
                devTestLog("Scenario complete: supabase-public-download-smoke");
            } finally {
                globalThis.fetch = originalGlobalFetch;
                generateStoryTemplateTitleCardImage =
                    originalGenerateStoryTemplateTitleCardImage;
                queueProfileImage = originalQueueProfileImage;
                fetchJsonFromPublicUploadUrl = originalFetchPayload;
                fetchVerifiedPublicLibraryPayload = originalVerifiedFetchPayload;
                await devCleanupSmokeStoryLibraryArtifacts(
                    "public download smoke story artifacts cleaned",
                );
                await devCleanupSmokeStoryTitleCardArtifacts(
                    "public download smoke title-card artifacts cleaned",
                );
                app.characterDefinitions = validatedCharacterLibraryDefinitions(
                    originalCharacterDefinitions,
                );
                app.state = repairAiGeneratedState(originalState);
                app.messages = originalMessages;
                app.profileImages = originalProfileImages;
                app.publicLibraryLastIndex = originalPublicLibraryLastIndex;
                app.characterLibraryPublicPayloads = originalPublicPayloads || {};
                app.publicLibraryCuratedEntries = originalCuratedEntries || {};
                await devRestoreStoryTitleCardImagesForSmoke(
                    originalStoryTitleCardImages,
                    "public download smoke restored story title-card images",
                );
                scheduleActiveGameSave();
                render();
                document.querySelectorAll(".popup-modal.open").forEach(node => node.remove());
                closeModal();
            }
        }

        async function devRunSupabasePublicUpdateVersionMockSmokeTest() {
            devTestLog("Scenario start: supabase-public-update-version-mock-smoke");
            const originalFetch = publicLibraryFetch;
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const calls = [];
            const insertedVersions = [];
            const user = { id: "update-version-user", email: "update-version@example.com" };
            const existingItem = devSmokeSupabasePublicItemRow({
                id: "existing-story-item",
                owner_user_id: user.id,
                type: "story",
                title: "Existing Public Story",
                description: "Existing public story description.",
                creator: "debug harness",
                creator_id: "00000000-0000-4000-8000-000000000001",
                source: "Original",
                creation_tool: "debug harness",
                genres: ["fantasy"],
                current_version_id: "version-2",
                visibility: "public",
                rating_count: 0,
                rating_average: 0,
                player_select: false,
                player_option_count: 1,
                main_objective_count: 0,
                side_objective_count: 0,
                future_character_count: 0,
                starting_party_member_count: 0,
                starting_npc_count: 0,
                updated_at: new Date().toISOString(),
            });
            try {
                saveSupabaseSession({
                    access_token: "mock-update-access-token",
                    refresh_token: "mock-update-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user,
                });
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (path === "/auth/v1/user") return user;
                    if (
                        path.startsWith(
                            "/rest/v1/creator_identities?select=creator_id,owner_user_id",
                        )
                    )
                        return [
                            {
                                creator_id: existingItem.creator_id,
                                owner_user_id: user.id,
                            },
                        ];
                    if (
                        path.startsWith(
                            "/rest/v1/creator_identities?select=creator_id,creator_name",
                        )
                    )
                        return [];
                    if (
                        path.startsWith(
                            "/rest/v1/creator_identities?on_conflict=creator_id",
                        ) &&
                        options.method === "POST"
                    )
                        return [
                            {
                                ...clone(options.body || {}),
                                created_at: new Date().toISOString(),
                            },
                        ];
                    if (
                        path === "/rest/v1/rpc/publish_public_library_item_version" &&
                        options.method === "POST"
                    ) {
                        const itemBody = clone(options.body?.item_payload || {});
                        const versionBody = clone(options.body?.version_payload || {});
                        const previousVersionNumber = 2;
                        const retainedItemFields = {
                            id: existingItem.id,
                            owner_user_id: existingItem.owner_user_id,
                            current_version_id: existingItem.current_version_id,
                            rating_count: existingItem.rating_count,
                            rating_average: existingItem.rating_average,
                        };
                        Object.assign(existingItem, itemBody, retainedItemFields, {
                            visibility: "public",
                            hidden_reason: null,
                            updated_at: new Date().toISOString(),
                        });
                        const version = devSmokeSupabasePublicVersionRow({
                            payload_url: versionBody.payload_url,
                            payload_sha256: versionBody.payload_sha256,
                            payload_size_bytes: versionBody.payload_size_bytes,
                            image_url: versionBody.image_url,
                            change_summary: versionBody.change_summary,
                            id: "version-3",
                            item_id: existingItem.id,
                            version_number: previousVersionNumber + 1,
                            metadata_snapshot: publicLibraryVersionMetadataSnapshot(existingItem),
                            created_at: new Date().toISOString(),
                        });
                        insertedVersions.push(version);
                        existingItem.current_version_id = version.id;
                        return {
                            i: clone(existingItem),
                            v: clone(version),
                            w: true,
                            p: previousVersionNumber,
                            n: previousVersionNumber + 1,
                        };
                    }
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        path.includes("&id=eq.existing-story-item") &&
                        options.method === "PATCH"
                    ) {
                        Object.assign(existingItem, clone(options.body || {}));
                        return [clone(existingItem)];
                    }
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        (path.includes("&owner_user_id=") || path.includes("&id=eq.existing-story-item"))
                    )
                        return [clone(existingItem)];
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        options.method === "POST"
                    ) {
                        const { created_by_user_id: _createdByUserId, ...versionBody } = clone(
                            options.body || {},
                        );
                        const version = {
                            id: `version-${Number(versionBody.version_number || 0)}`,
                            ...versionBody,
                            created_at: new Date().toISOString(),
                        };
                        insertedVersions.push(version);
                        return [version];
                    }
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes("&item_id=eq.existing-story-item")
                    )
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "version-2",
                                item_id: "existing-story-item",
                                version_number: 2,
                                payload_url: "https://user.uploads.dev/file/existing-public-story-v2.json.gz",
                                change_summary: "Existing version.",
                            }),
                        ];
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        path.includes("&visibility=eq.public")
                    )
                        return [clone(existingItem)];
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes("&id=in.")
                    )
                        return insertedVersions;
                    if (path.startsWith("/rest/v1/library_versions?select="))
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "version-2",
                                item_id: "existing-story-item",
                                version_number: 2,
                                payload_url: "https://user.uploads.dev/file/existing-public-story-v2.json.gz",
                                change_summary: "Existing version.",
                            }),
                        ];
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected mocked Supabase update/version call: ${path}`);
                };
                const result = await addEntriesToPublicLibraryIndex([
                    createPublicLibraryEntry({
                        id: "local-existing-public-story",
                        type: "story-template",
                        name: "Existing Public Story",
                        title: "Existing Public Story",
                        description: "Updated public story description.",
                        url: "https://user.uploads.dev/file/existing-public-story-v3.json.gz",
                        image_url: "https://user.uploads.dev/file/existing-public-story-card.png",
                        creator: "debug harness",
                        creator_id: "00000000-0000-4000-8000-000000000001",
                        source: "Original",
                        creation_tool: "debug harness",
                        genres: ["fantasy"],
                    }),
                ]);
                const publishCall = calls.find(
                    (call) =>
                        call.path === "/rest/v1/rpc/publish_public_library_item_version" &&
                        call.options.method === "POST",
                );
                const version = insertedVersions[0];
                devTestLog("Supabase public update/version result", {
                    publishCall,
                    insertedVersions,
                    existingItem,
                    result,
                });
                devTestLog("Supabase public update/version assertions", {
                    publishCall: !!publishCall,
                    description: publishCall?.options.body?.item_payload?.description,
                    versionNumber: version?.version_number,
                    itemId: version?.item_id,
                    payloadUrl: version?.payload_url,
                    imageUrl: version?.image_url,
                    currentVersionId: existingItem.current_version_id,
                    insertedVersionId: version?.id,
                    resultUrl: result.upload?.url,
                });
                devAssert(
                    publishCall &&
                        publishCall.options.body?.item_payload?.description ===
                            "Updated public story description." &&
                        version?.version_number === 3 &&
                        version?.item_id === "existing-story-item" &&
                        version?.payload_url === "https://user.uploads.dev/file/existing-public-story-v3.json.gz" &&
                        version?.image_url === "https://user.uploads.dev/file/existing-public-story-card.png" &&
                        existingItem.current_version_id === version.id &&
                        result.upload?.url === "supabase://library_items",
                    "mocked public update creates next version and moves current_version_id",
                    { publishCall, insertedVersions, existingItem, result },
                );
                addMessage("system", "Supabase public update/version smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-update-version-mock-smoke");
            } finally {
                publicLibraryFetch = originalFetch;
                saveSupabaseSession(originalSession);
            }
        }

        async function devRunSupabasePublicImportFailureSmokeTest() {
            devTestLog("Scenario start: supabase-public-import-failure-smoke");
            const originalFetchPayload = fetchJsonFromPublicUploadUrl;
            const originalVerifiedFetchPayload = fetchVerifiedPublicLibraryPayload;
            const originalShowNotice = showNotice;
            const originalPublicLibraryLastIndex = app.publicLibraryLastIndex
                ? clone(app.publicLibraryLastIndex)
                : null;
            const notices = [];
            try {
                showNotice = (title, body = "") => {
                    notices.push({ title, body });
                    return Promise.resolve();
                };
                app.publicLibraryLastIndex = devSmokePublicLibraryIndex({
                    items: [
                        {
                            id: "broken-url-story",
                            type: "story-template",
                            name: "Broken URL Story",
                            url: "https://user.uploads.dev/file/broken-public-story.json",
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                        },
                    ],
                });
                app.publicLibraryLastIndex.items.push({
                    id: "missing-url-story",
                    type: "story-template",
                    name: "Missing URL Story",
                    url: "",
                });
                fetchJsonFromPublicUploadUrl = async () => {
                    throw new Error("mocked public payload fetch failure");
                };
                fetchVerifiedPublicLibraryPayload = async () => {
                    throw new Error("mocked public payload fetch failure");
                };
                await importPublicLibraryEntry("missing-url-story");
                await importPublicLibraryEntry("broken-url-story");
                devAssert(
                    notices.some((notice) => /Missing Payload/i.test(notice.title)) &&
                        notices.some((notice) => /Public Import Failed/i.test(notice.title) && /mocked public payload fetch failure/i.test(notice.body)),
                    "public download failure cases show clear non-mutating notices",
                    notices,
                );
                addMessage("system", "Supabase public import failure smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-import-failure-smoke");
            } finally {
                fetchJsonFromPublicUploadUrl = originalFetchPayload;
                fetchVerifiedPublicLibraryPayload = originalVerifiedFetchPayload;
                showNotice = originalShowNotice;
                app.publicLibraryLastIndex = originalPublicLibraryLastIndex;
            }
        }

        async function devRunSupabasePublicEmptyBrowseSmokeTest() {
            devTestLog("Scenario start: supabase-public-empty-browse-smoke");
            const originalFetchPublicLibraryIndex = fetchPublicLibraryIndex;
            const originalViewMode = app.publicLibraryViewMode;
            const originalLastIndex = app.publicLibraryLastIndex
                ? clone(app.publicLibraryLastIndex)
                : null;
            try {
                fetchPublicLibraryIndex = async () =>
                    devSmokePublicLibraryIndex({ items: [], story_feedback: [] });
                app.publicLibraryViewMode = "stories";
                openPublicLibraryIndexModal();
                await inspectPublicLibraryIndex();
                devAssert(
                    /No public stories found/i.test($("publicLibraryStoryList")?.textContent || "") &&
                        /Public library loaded\./i.test($("publicLibraryIndexStatus")?.textContent || "") &&
                        /Items: 0/i.test($("publicLibraryIndexStatus")?.textContent || ""),
                    "empty public story browse renders a clear empty state",
                    {
                        status: $("publicLibraryIndexStatus")?.textContent || "",
                        list: $("publicLibraryStoryList")?.textContent || "",
                    },
                );
                app.publicLibraryViewMode = "characters";
                openPublicLibraryIndexModal();
                await inspectPublicLibraryIndex();
                devAssert(
                    /No public characters found/i.test($("publicLibraryStoryList")?.textContent || ""),
                    "empty public character browse renders a clear empty state",
                    $("publicLibraryStoryList")?.textContent || "",
                );
                closeModal();
                addMessage("system", "Supabase public empty browse smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-empty-browse-smoke");
            } finally {
                fetchPublicLibraryIndex = originalFetchPublicLibraryIndex;
                app.publicLibraryViewMode = originalViewMode || "stories";
                app.publicLibraryLastIndex = originalLastIndex;
                closeModal();
            }
        }

        async function devRunSupabasePublicSearchPagingSmokeTest() {
            devTestLog("Scenario start: supabase-public-search-paging-smoke");
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalWindowFetch = window.fetch;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const originalViewMode = app.publicLibraryViewMode;
            const originalQuery = app.publicLibraryQuery ? clone(app.publicLibraryQuery) : null;
            const calls = [];
            const makeItem = (n) => devSmokeSupabasePublicItemRow({
                id: `search-item-${n}`,
                owner_user_id: "owner",
                type: "story",
                definition_id: `search-story-${n}`,
                title: `Search Story ${n}`,
                description: `Search story ${n}.`,
                creator: "debug harness",
                creator_id: "00000000-0000-4000-8000-000000000001",
                source: "Original",
                creation_tool: "debug harness",
                genres: ["fantasy"],
                current_version_id: `search-version-${n}`,
                visibility: "public",
                rating_count: 0,
                rating_average: 0,
                updated_at: new Date().toISOString(),
            });
            const makeVersion = (n) => devSmokeSupabasePublicVersionRow({
                id: `search-version-${n}`,
                item_id: `search-item-${n}`,
                version_number: 1,
                payload_url: `https://user.uploads.dev/file/search-story-${n}.json.gz`,
                image_url: `https://example.com/search-story-${n}-title-card.png`,
                created_at: new Date().toISOString(),
            });
            try {
                app.publicLibraryViewMode = "stories";
                app.publicLibraryQuery = {
                    search: "",
                    submittedSearch: "",
                    page: 0,
                    pageSize: 2,
                    lastMode: "",
                    lastCount: 0,
                    lastHasNext: false,
                };
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (path.startsWith("/rest/v1/library_items")) {
                        const offset = Number(path.match(/[?&]offset=(\d+)/)?.[1] || 0);
                        return [makeItem(offset + 1), makeItem(offset + 2)];
                    }
                    if (path.startsWith("/rest/v1/library_versions")) {
                        const ids = [...path.matchAll(/search-version-(\d+)/g)].map((match) => Number(match[1]));
                        return (ids.length ? ids : [1, 2]).map(makeVersion);
                    }
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected mocked public search call: ${path}`);
                };
                openPublicLibraryIndexModal();
                $("publicLibraryStorySearch").value = "dragon";
                $("publicLibraryStorySearch").dispatchEvent(new Event("input", { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 2100));
                devAssert(
                    calls.length === 0 &&
                        /Press Search or Enter/i.test($("publicLibrarySearchHint")?.textContent || ""),
                    "public library typing does not fetch and shows delayed search hint",
                    { calls, hint: $("publicLibrarySearchHint")?.textContent || "" },
                );
                await inspectPublicLibraryIndex({ resetPage: true });
                devTestLog("Public search first-page assertion inputs", {
                    callCount: calls.length,
                    itemCallCount: calls.filter((call) => call.path.startsWith("/rest/v1/library_items")).length,
                    itemPath: calls.find((call) => call.path.startsWith("/rest/v1/library_items"))?.path || "",
                    lastHasNext: publicLibraryQueryState().lastHasNext,
                });
                devAssert(
                    calls.filter((call) => call.path.startsWith("/rest/v1/library_items")).length === 1 &&
                        /ilike/i.test(calls.find((call) => call.path.startsWith("/rest/v1/library_items"))?.path || "") &&
                        /limit=2&offset=0/i.test(calls.find((call) => call.path.startsWith("/rest/v1/library_items"))?.path || "") &&
                        publicLibraryQueryState().lastHasNext === true,
                    "public library Search action fetches the first server page once",
                    calls,
                );
                $("publicLibraryStorySearch").value = "mage";
                handlePublicLibrarySearchKey(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 0));
                devAssert(
                    calls.filter((call) => call.path.startsWith("/rest/v1/library_items")).length === 2 &&
                        /mage/i.test(calls.filter((call) => call.path.startsWith("/rest/v1/library_items"))[1].path),
                    "public library Enter key triggers one submitted search",
                    calls,
                );
                await publicLibraryNextPage();
                devAssert(
                    calls.filter((call) => call.path.startsWith("/rest/v1/library_items")).some((call) => /offset=2/i.test(call.path)) &&
                        publicLibraryQueryState().page === 1,
                    "public library Next fetches the next page only",
                    calls,
                );

                publicLibraryFetch = originalPublicLibraryFetch;
                app.devTrace = [];
                const supabaseTraceStart = smokeDevTraceCaptureActive()
                    ? (app.smokeDevTraceCapture || []).length
                    : 0;
                window.fetch = async () =>
                    new Response(JSON.stringify([{ id: "logged-row" }]), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                await publicLibraryFetch("/rest/v1/library_items?select=id&limit=1", { auth: false });
                const supabaseTraceSource = () =>
                    smokeDevTraceCaptureActive()
                        ? (app.smokeDevTraceCapture || []).slice(supabaseTraceStart)
                        : app.devTrace || [];
                await devWaitFor(
                    () => /Supabase request/i.test(formatDevTraceText(supabaseTraceSource())),
                    1000,
                    "Supabase request log to reach smoke trace",
                );
                const traceText = formatDevTraceText(supabaseTraceSource());
                devAssert(
                    /Supabase request/i.test(traceText) &&
                        /Rows:\s*1/i.test(traceText) &&
                        /Approx bytes:/i.test(traceText) &&
                        /Duration:/i.test(traceText) &&
                        /Auth:\s*anonymous/i.test(traceText),
                    "Supabase read logging includes path, auth, rows, bytes, and duration",
                    traceText,
                );
                closeModal();
                addMessage("system", "Supabase public search/paging smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-search-paging-smoke");
            } finally {
                publicLibraryFetch = originalPublicLibraryFetch;
                window.fetch = originalWindowFetch;
                app.publicLibraryLastIndex = originalLastIndex;
                app.publicLibraryViewMode = originalViewMode || "stories";
                app.publicLibraryQuery = originalQuery;
                if (app.publicLibrarySearchHintTimer) clearTimeout(app.publicLibrarySearchHintTimer);
                closeModal();
            }
        }

        async function devRunSupabasePublicVersionHistorySmokeTest() {
            devTestLog("Scenario start: supabase-public-version-history-smoke");
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const originalViewMode = app.publicLibraryViewMode;
            const calls = [];
            try {
                app.publicLibraryViewMode = "stories";
                app.publicLibraryLastIndex = devSmokePublicLibraryIndex({
                    items: [
                        createPublicLibraryEntry({
                            id: "version-history-item-1",
                            type: "story-template",
                            name: "Version History Smoke Story",
                            title: "Version History Smoke Story",
                            description: "Version history smoke story.",
                            url: "https://example.com/current-story.json",
                            image_url: "https://example.com/version-history-story-title-card.png",
                            source: "Smoke Source",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            supabase_item_id: "version-history-item-1",
                            supabase_current_version_id: "version-history-version-2",
                            version_number: 2,
                        }),
                    ],
                    story_feedback: [],
                });
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes("&item_id=eq.version-history-item-1")
                    ) {
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "version-history-version-2",
                                item_id: "version-history-item-1",
                                version_number: 2,
                                payload_url: "https://example.com/story-v2.json",
                                image_url: "https://example.com/version-history-story-v2.png",
                                change_summary: "Second smoke version.",
                                created_at: "2026-06-05T00:00:02.000Z",
                            }),
                            devSmokeSupabasePublicVersionRow({
                                id: "version-history-version-1",
                                item_id: "version-history-item-1",
                                version_number: 1,
                                payload_url: "https://example.com/story-v1.json",
                                image_url: "https://example.com/version-history-story-v1.png",
                                change_summary: "First smoke version.",
                                created_at: "2026-06-05T00:00:01.000Z",
                            }),
                        ];
                    }
                    throw new Error(`Unexpected mocked version-history call: ${path}`);
                };
                openPublicLibraryIndexModal();
                renderPublicLibraryStoryList(app.publicLibraryLastIndex);
                devAssert(
                    /Versions/i.test($("publicLibraryStoryList")?.textContent || "") &&
                        calls.length === 0,
                    "public library cards show a Versions action without fetching version history during browse render",
                    { list: $("publicLibraryStoryList")?.textContent || "", calls },
                );
                await openPublicLibraryVersionHistoryModal("version-history-item-1");
                const historyPopupText =
                    document.querySelector("[data-public-library-version-history]")?.textContent || "";
                devAssert(
                    calls.length === 1 &&
                        calls[0].path.startsWith("/rest/v1/library_versions?select=") &&
                        calls[0].path.includes("&item_id=eq.version-history-item-1") &&
                        /Version 2/i.test(historyPopupText) &&
                        /Second smoke version/i.test(historyPopupText),
                    "public library version history fetches only the selected item's versions on demand",
                    { calls, modal: historyPopupText },
                );
                closeModal();
                addMessage("system", "Supabase public version history smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-version-history-smoke");
            } finally {
                publicLibraryFetch = originalPublicLibraryFetch;
                app.publicLibraryLastIndex = originalLastIndex;
                app.publicLibraryViewMode = originalViewMode || "stories";
                closeModal();
            }
        }

        async function devRunSupabasePublicFilterSmokeTest() {
            devTestLog("Scenario start: supabase-public-filter-smoke");
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const originalViewMode = app.publicLibraryViewMode;
            const originalQuery = app.publicLibraryQuery ? clone(app.publicLibraryQuery) : null;
            const calls = [];
            try {
                app.publicLibraryViewMode = "characters";
                app.publicLibraryQuery = {
                    search: "",
                    submittedSearch: "",
                    page: 0,
                    pageSize: 10,
                    lastMode: "characters",
                    lastCount: 0,
                    lastHasNext: false,
                    filters: {},
                    submittedFilters: {},
                };
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (path.startsWith("/rest/v1/library_items")) return [];
                    if (path.startsWith("/rest/v1/library_versions")) return [];
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected mocked public filter call: ${path}`);
                };
                openPublicLibraryIndexModal();
                $("publicLibraryGenreFilter").value = "fantasy";



                $("publicLibraryGenderFilter").value = "female";
                $("publicLibraryAgeMinFilter").value = "21";
                $("publicLibraryAgeMaxFilter").value = "40";
                handlePublicLibraryFilterInput();
                await new Promise((resolve) => setTimeout(resolve, 2100));
                devAssert(
                    calls.length === 0 &&
                        /Press Search or Enter/i.test($("publicLibrarySearchHint")?.textContent || ""),
                    "public library filter edits do not fetch until Search or Enter is used",
                    { calls, hint: $("publicLibrarySearchHint")?.textContent || "" },
                );
                await inspectPublicLibraryIndex({ resetPage: true });
                const itemCall = calls.find((call) => call.path.startsWith("/rest/v1/library_items"));
                devTestLog("Public filter assertion inputs", {
                    itemCall: JSON.stringify(itemCall || null),
                    calls: JSON.stringify(calls),
                    status: $("publicLibraryIndexStatus")?.textContent || "",
                    popupText: [...document.querySelectorAll(".popup-modal.open")].at(-1)?.textContent || "",
                });
                closeModal();
                addMessage("system", "Supabase public filter smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-filter-smoke");
            } finally {
                publicLibraryFetch = originalPublicLibraryFetch;
                app.publicLibraryLastIndex = originalLastIndex;
                app.publicLibraryViewMode = originalViewMode || "stories";
                app.publicLibraryQuery = originalQuery;
                if (app.publicLibrarySearchHintTimer) clearTimeout(app.publicLibrarySearchHintTimer);
                closeModal();
            }
        }

        async function devRunSupabasePublicVersionDownloadSmokeTest() {
            devTestLog("Scenario start: supabase-public-version-download-smoke");
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalFetchPayload = fetchJsonFromPublicUploadUrl;
            const originalVerifiedFetchPayload = fetchVerifiedPublicLibraryPayload;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const originalViewMode = app.publicLibraryViewMode;
            const originalVersionHistory = clone(
                app.publicLibraryVersionHistory || {},
            );
            const originalStoryTemplates = devSmokeClone(
                await loadPerRecordLibrary(
                    STORY_TEMPLATE_KEY,
                    app.storyTemplates || [],
                    { deferStoryValidation: true },
                ),
            );
            const originalCharacterDefinitions = devSmokeClone(
                await loadPerRecordLibrary(
                    CHARACTER_LIBRARY_KEY,
                    app.characterDefinitions || [],
                    { deferDefinitionValidation: true },
                ),
            );
            const originalStoryTitleCardImages = devSmokeClone(
                await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    app.storyTitleCardImages || [],
                ),
            );
            const fixtureNonce = `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
            const importedStoryId = `version-download-imported-v1-${fixtureNonce}`;
            const importedTitleImageId =
                `imported-old-version-smoke-story-title-card-${fixtureNonce}`;
            const characterId = `version-download-character-${fixtureNonce}`;
            const characterItemId = `version-download-character-item-${fixtureNonce}`;
            const characterVersionId = `version-download-character-version-2-${fixtureNonce}`;
            const maleImageUrl =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
            const nonMaleImageUrl =
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
            const localCharacter = devSmokeCharacterRecord(
                "Version Download Smoke Character",
                {
                    character: { id: characterId, gender: "female" },
                    record: { id: characterId },
                },
            );
            const payloadCharacter = clone(localCharacter.character);
            payloadCharacter.profile_image_presentations = {
                male: {
                    ...emptyProfileImageSlot(true),
                    url: "https://example.com/stale-character-male.png",
                },
                non_male: {
                    ...emptyProfileImageSlot(false),
                    url: "https://example.com/stale-character-non-male.png",
                },
            };
            payloadCharacter.default_profile_image = clone(
                payloadCharacter.profile_image_presentations.non_male,
            );
            const characterItem = devSmokeSupabasePublicItemRow({
                id: characterItemId,
                owner_user_id: "version-download-owner",
                type: "character",
                definition_id: characterId,
                slug: "version-download-smoke-character",
                title: null,
                name: "Version Download Smoke Character",
                description: "Version-specific hosted-image import smoke.",
                male_name: "Version Download Smoke Man",
                non_male_name: "Version Download Smoke Woman",
                male_image_url: maleImageUrl,
                non_male_image_url: nonMaleImageUrl,
                current_version_id: null,
                visibility: "hidden",
                gender: "female",
                age: 28,
                species: "human",
                role: "version import tester",
                voice_gender: "non_male",
            });
            const characterVersion = devSmokeSupabasePublicVersionRow({
                id: characterVersionId,
                item_id: characterItem.id,
                version_number: 2,
                payload_url: "https://example.com/character-v2.json",
                image_url: nonMaleImageUrl,
                metadata_snapshot:
                    publicLibraryVersionMetadataSnapshot(characterItem),
                change_summary: "Hidden character version.",
                created_at: "2026-06-05T00:00:03.000Z",
            });
            const calls = [];
            try {
                app.publicLibraryViewMode = "stories";
                app.characterDefinitions = [
                    ...(app.characterDefinitions || []).filter(
                        (record) => record.id !== characterId,
                    ),
                    localCharacter,
                ];
                app.publicLibraryLastIndex = devSmokePublicLibraryIndex({
                    items: [
                        createPublicLibraryEntry({
                            id: "version-download-item-1",
                            type: "story-template",
                            name: "Version Download Smoke Story",
                            title: "Version Download Smoke Story",
                            description: "Version download smoke story.",
                            url: "https://example.com/story-current.json",
                            image_url: "https://example.com/version-download-story-title-card.png",
                            source: "Original",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            supabase_item_id: "version-download-item-1",
                            supabase_current_version_id: "version-download-version-2",
                            version_number: 2,
                        }),
                        createPublicLibraryEntry({
                            id: characterItem.id,
                            type: "character",
                            name: characterItem.name,
                            title: characterItem.name,
                            description: characterItem.description,
                            url: characterVersion.payload_url,
                            image_url: characterVersion.image_url,
                            male_name: characterItem.male_name,
                            non_male_name: characterItem.non_male_name,
                            male_image_url: maleImageUrl,
                            non_male_image_url: nonMaleImageUrl,
                            source: "Original",
                            creator: characterItem.creator,
                            creator_id: characterItem.creator_id,
                            creation_tool: characterItem.creation_tool,
                            definition_id: characterId,
                            genres: [],
                            visibility: "hidden",
                            supabase_item_id: characterItem.id,
                            supabase_current_version_id: "",
                            owner_user_id: characterItem.owner_user_id,
                            version_number: 2,
                            gender: "female",
                            age: 28,
                            species: "human",
                            role: "version import tester",
                            voice_gender: "non_male",
                        }),
                    ],
                    story_feedback: [],
                });
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes("&item_id=eq.version-download-item-1")
                    ) {
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "version-download-version-2",
                                item_id: "version-download-item-1",
                                version_number: 2,
                                payload_url: "https://example.com/story-v2.json",
                                image_url: "https://example.com/version-download-story-v2.png",
                                change_summary: "Current version.",
                                created_at: "2026-06-05T00:00:02.000Z",
                            }),
                            devSmokeSupabasePublicVersionRow({
                                id: "version-download-version-1",
                                item_id: "version-download-item-1",
                                version_number: 1,
                                payload_url: "https://example.com/story-v1.json",
                                image_url: "https://example.com/version-download-story-v1.png",
                                change_summary: "Older version.",
                                created_at: "2026-06-05T00:00:01.000Z",
                            }),
                        ];
                    }
                    if (
                        path.startsWith("/rest/v1/library_versions?select=") &&
                        path.includes(`&item_id=eq.${characterItemId}`)
                    )
                        return [characterVersion];
                    throw new Error(`Unexpected mocked version download call: ${path}`);
                };
                fetchJsonFromPublicUploadUrl = async (url) => {
                    if (url === "https://example.com/character-v2.json")
                        return characterDefinitionFileForExport(payloadCharacter);
                    if (url !== "https://example.com/story-v1.json")
                        throw new Error(`Unexpected version payload URL: ${url}`);
                    const template = devSmokeTemplateRecord({
                        id: importedStoryId,
                        title: "Imported Old Version Smoke Story",
                        genres: ["fantasy"],
                    });
                    template.title_card_image.id = importedTitleImageId;
                    template.title_card_image.url =
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
                    return storyExportPayloadFromDefinition(
                        template,
                    );
                };
                fetchVerifiedPublicLibraryPayload = async (entry) =>
                    fetchJsonFromPublicUploadUrl(entry?.url);
                await openPublicLibraryVersionHistoryModal("version-download-item-1");
                const versionDownloadPopupText =
                    document.querySelector("[data-public-library-version-history]")?.textContent || "";
                devAssert(
                    /Download This Version/i.test(versionDownloadPopupText),
                    "public version history modal shows Download This Version buttons",
                    versionDownloadPopupText,
                );
                await importPublicLibraryEntryVersion("version-download-item-1", "version-download-version-1", {
                    openLibrary: false,
                    persist: false,
                    showNotice: false,
                    awaitTitleCardPreparation: true,
                });
                devAssert(
                    (app.storyTemplates || []).some(
                        (template) =>
                            template.title === "Imported Old Version Smoke Story",
                    ) &&
                        !storyTitleCardImportIsPreparing(
                            importedStoryId,
                        ) &&
                        storyTitleCardImages(
                            storyTemplateById(importedStoryId),
                        ).some(profileImageIsFinished),
                    "public version-specific download imports the selected old version payload and finishes its title-card preparation",
                    {
                        storyTemplates: (app.storyTemplates || []).map(
                            (template) => template.title,
                        ),
                        calls,
                    },
                );
                await importPublicLibraryEntryVersion(
                    characterItem.id,
                    characterVersion.id,
                    { showNotice: false },
                );
                const importedCharacter = (app.characterDefinitions || []).find(
                    (record) => record.id === characterId,
                );
                const storedMaleSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [characterId, "male"],
                );
                const storedNonMaleSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [characterId, "non_male"],
                );
                const storedMaleImage = await app.persistence.getRecord(
                    "characterProfileImages",
                    storedMaleSelection?.imageId,
                );
                const storedNonMaleImage = await app.persistence.getRecord(
                    "characterProfileImages",
                    storedNonMaleSelection?.imageId,
                );
                const storedMaleAsset = await app.persistence.getRecord(
                    "assetBlobs",
                    storedMaleSelection?.imageId,
                );
                const storedNonMaleAsset = await app.persistence.getRecord(
                    "assetBlobs",
                    storedNonMaleSelection?.imageId,
                );
                devAssert(
                    importedCharacter?.id === characterId &&
                        storedMaleImage?.presentation === "male" &&
                        storedNonMaleImage?.presentation === "non_male" &&
                        storedMaleAsset?.blob instanceof Blob &&
                        storedNonMaleAsset?.blob instanceof Blob &&
                        importedCharacter.active_profile_image_ids?.male ===
                            storedMaleSelection?.imageId &&
                        importedCharacter.active_profile_image_ids?.non_male ===
                            storedNonMaleSelection?.imageId,
                    "hidden character version download replaces the matching local definition, uses exact version snapshot images, and durably selects both presentations",
                    {
                        activeProfileImageIds:
                            importedCharacter?.active_profile_image_ids,
                        storedMaleSelection,
                        storedNonMaleSelection,
                        storedMaleImage,
                        storedNonMaleImage,
                        storedMaleAssetBytes: storedMaleAsset?.byteLength,
                        storedNonMaleAssetBytes: storedNonMaleAsset?.byteLength,
                    },
                );
                closeModal();
                devTestLog("Scenario complete: supabase-public-version-download-smoke");
            } finally {
                publicLibraryFetch = originalPublicLibraryFetch;
                fetchJsonFromPublicUploadUrl = originalFetchPayload;
                fetchVerifiedPublicLibraryPayload = originalVerifiedFetchPayload;
                devCancelSmokeImageWorkForRestore();
                await flushLargeSaves();
                await devRestoreStoryTemplatesForSmoke(
                    originalStoryTemplates,
                    "public version download smoke story library restored",
                );
                await devRestoreStoryTitleCardImagesForSmoke(
                    originalStoryTitleCardImages,
                    "public version download smoke title-card library restored",
                );
                const smokeProfileImageIds = new Set(
                    (app.profileImages || [])
                        .filter(
                            (image) =>
                                String(image?.character_id || "") === characterId,
                        )
                        .map((image) => String(image.id || ""))
                        .filter(Boolean),
                );
                for (const presentation of ["male", "non_male"]) {
                    const selection = await app.persistence.getRecord(
                        "characterProfileImageSelections",
                        [characterId, presentation],
                    );
                    if (selection?.imageId)
                        smokeProfileImageIds.add(String(selection.imageId));
                }
                if (smokeProfileImageIds.size)
                    await app.persistence.deleteManagedImages(
                        [...smokeProfileImageIds].map((imageId) => ({
                            storeName: "characterProfileImages",
                            imageId,
                        })),
                    );
                app.profileImages = exactProfileImageStore(
                    (app.profileImages || []).filter(
                        (image) =>
                            String(image?.character_id || "") !== characterId,
                    ),
                );
                await devRestoreCharacterDefinitionsForSmoke(
                    originalCharacterDefinitions,
                    "public version download smoke character library restored",
                );
                app.publicLibraryLastIndex = originalLastIndex;
                app.publicLibraryVersionHistory = originalVersionHistory;
                app.publicLibraryViewMode = originalViewMode || "stories";
                closeModal();
            }
        }

        async function devRunPerchanceTestUploadDeleteSmokeTest() {
            devTestLog("Scenario start: perchance-test-upload-delete-smoke");
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live upload/delete smoke");
            const text = `EmberAdventures upload/delete smoke ${Date.now()} ${Math.random().toString(36).slice(2)}`;
            const blob = new Blob([text], { type: "text/plain" });
            let upload = null;
            try {
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "upload-started",
                });
                upload = await uploadBlobToUserUploads(blob, "Perchance smoke text upload", {
                    testUpload: true,
                });
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "upload-finished",
                    url: upload?.url || "",
                });
                devAssert(
                    !!upload.url &&
                        upload.expiresInSeconds === TEST_UPLOAD_EXPIRES_IN_SECONDS &&
                        !!hostedUploadDeletionUrl(upload),
                    "Perchance smoke text upload returns URL, one-day test expiry metadata, and deletion URL",
                    {
                        url: upload.url,
                        deletionUrl: hostedUploadDeletionUrl(upload),
                        expiresInSeconds: upload.expiresInSeconds,
                    },
                );
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "initial-fetch-started",
                });
                const fetched = await fetch(upload.url, { cache: "no-store" });
                const fetchedText = fetched.ok ? await fetched.text() : "";
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "initial-fetch-finished",
                    status: fetched.status,
                });
                devAssert(
                    fetched.ok && fetchedText === text,
                    "Perchance smoke text upload can be fetched before deletion",
                    { status: fetched.status, fetchedText, expected: text },
                );
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "delete-started",
                });
                const deleted = await deleteHostedUpload(upload, "Perchance smoke text upload");
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "delete-finished",
                    deleted,
                });
                devAssert(deleted, "Perchance smoke text upload deletion URL was called successfully", {
                    url: upload.url,
                    deletionUrl: hostedUploadDeletionUrl(upload),
                });
                let deletedFetchStatus = 0;
                let deletedFetchOk = false;
                let deletedFetchText = "";
                try {
                    devTestLog("Perchance upload/delete smoke stage", {
                        stage: "deleted-fetch-started",
                    });
                    const deletedFetch = await fetch(`${upload.url}?deletedCheck=${Date.now()}`, {
                        cache: "no-store",
                    });
                    deletedFetchStatus = deletedFetch.status;
                    deletedFetchOk = deletedFetch.ok;
                    deletedFetchText = deletedFetch.ok ? await deletedFetch.text() : "";
                } catch (err) {
                    deletedFetchStatus = -1;
                    deletedFetchText = err.message || String(err);
                }
                devTestLog("Perchance upload/delete smoke stage", {
                    stage: "deleted-fetch-finished",
                    status: deletedFetchStatus,
                    ok: deletedFetchOk,
                });
                devAssert(
                    !deletedFetchOk || deletedFetchText !== text,
                    "Perchance smoke text upload is not fetchable as the original file after deletion",
                    { deletedFetchStatus, deletedFetchOk, deletedFetchText, expectedDeletedText: text },
                );
                addMessage("system", "Perchance upload/delete smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: perchance-test-upload-delete-smoke");
            } catch (err) {
                if (upload) await cleanupHostedUploads([upload], "Perchance smoke text upload fallback cleanup");
                throw err;
            }
        }

        async function devRunSupabaseLiveStoryPublishCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-story-publish-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live publish cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live publish cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            let upload = null;
            let result = null;
            try {
                await publicLibraryRefreshSessionIfNeeded();
                const user = await publicLibraryRefreshCurrentUser();
                if (!user?.id) {
                    devTestLog("SKIP: Supabase live story publish cleanup smoke requires signing in first", {
                        hasSession: !!app.supabaseSession,
                        hasAccessToken: !!app.supabaseSession?.access_token,
                    });
                    addMessage("system", "Supabase live story publish cleanup smoke skipped because no Supabase session is active.");
                    scheduleActiveGameSave();
                    render();
                    throw smokeSkipError(
                        "Supabase live story publish cleanup smoke requires an active signed-in Supabase session.",
                    );
                }
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const story = devSmokeTemplateRecord({
                    id: `supabase-live-publish-cleanup-${nonce}`,
                    title: `Supabase Live Cleanup Smoke ${nonce}`,
                    description: "Temporary public-library smoke story. This row and upload must be deleted before the smoke finishes.",
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures smoke test",
                    genres: ["fantasy"],
                });
                const payload = storyExportPayloadFromDefinition(
                    storyDefinitionForExport(story),
                );
                upload = await uploadCompressedStoryJson(payload, "Supabase live story publish cleanup smoke", {
                    testUpload: true,
                });
                devAssert(
                    !!upload.url && !!hostedUploadDeletionUrl(upload),
                    "live story publish cleanup smoke uploaded a temporary one-day Perchance payload with deletion URL",
                    {
                        url: upload.url,
                        deletionUrl: hostedUploadDeletionUrl(upload),
                        expiresInSeconds: upload.expiresInSeconds,
                    },
                );
                const entry = publicLibraryStoryMetadata(story, publicUploadFileUrl(upload.fileName), creatorIdentity);
                const errors = publicLibraryPublishPolicyErrors(entry);
                devAssert(!errors.length, "live story publish cleanup smoke metadata is valid before Supabase write", {
                    entry,
                    errors,
                });
                result = await upsertPublicLibraryEntryToSupabase(entry, {
                    payload_url: entry.url,
                    image_url: entry.image_url || null,
                    change_summary: "Temporary live publish cleanup smoke version.",
                });
                devAssert(
                    !!result.item?.id &&
                        !!result.version?.id &&
                        result.item.owner_user_id === user.id &&
                        result.version.item_id === result.item.id,
                    "live story publish cleanup smoke inserted owned Supabase item and version rows",
                    { item: result.item, version: result.version, userId: user.id },
                );
                const anonymousRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,title,current_version_id,visibility&type=eq.story&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    anonymousRows.length === 1 &&
                        anonymousRows[0].id === result.item.id &&
                        anonymousRows[0].current_version_id === result.version.id,
                    "live story publish cleanup smoke can anonymously read the temporary public item",
                    { anonymousRows, item: result.item, version: result.version },
                );
                await cleanupPublicLibrarySupabaseResults([result]);
                const afterCleanupRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id&type=eq.story&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    afterCleanupRows.length === 0,
                    "live story publish cleanup smoke deleted the temporary Supabase item row",
                    { afterCleanupRows, itemId: result.item.id },
                );
                const deleted = await deleteHostedUpload(upload, "Supabase live story publish cleanup smoke");
                upload = null;
                devAssert(deleted, "live story publish cleanup smoke deleted the temporary Perchance payload", {
                    itemId: result.item.id,
                    versionId: result.version.id,
                });
                addMessage("system", "Supabase live story publish cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-story-publish-cleanup-smoke");
            } catch (err) {
                if (result)
                    await cleanupPublicLibrarySupabaseResults([result], {
                        throwOnFailure: false,
                    });
                if (upload) await cleanupHostedUploads([upload], "Supabase live story publish cleanup smoke fallback cleanup");
                throw err;
            } finally {
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRunSupabaseLiveCharacterPublishCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-character-publish-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live character publish cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live character publish cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            let upload = null;
            let result = null;
            try {
                await publicLibraryRefreshSessionIfNeeded();
                const user = await publicLibraryRefreshCurrentUser();
                if (!user?.id) {
                    devTestLog("SKIP: Supabase live character publish cleanup smoke requires signing in first", {
                        hasSession: !!app.supabaseSession,
                        hasAccessToken: !!app.supabaseSession?.access_token,
                    });
                    addMessage("system", "Supabase live character publish cleanup smoke skipped because no Supabase session is active.");
                    scheduleActiveGameSave();
                    render();
                    throw smokeSkipError(
                        "Supabase live character publish cleanup smoke requires an active signed-in Supabase session.",
                    );
                }
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const record = devSmokeCharacterRecord(`Supabase Live Cleanup Character ${nonce}`, {
                    character: {
                        source: "Original",
                        creator: creatorIdentity.creator_name,
                        creator_id: creatorIdentity.creator_id,
                        creation_tool: "EmberAdventures smoke test",
                        genres: ["fantasy"],
                    },
                    record: {
                        source: "Original",
                        creator: creatorIdentity.creator_name,
                        creator_id: creatorIdentity.creator_id,
                        creation_tool: "EmberAdventures smoke test",
                        genres: ["fantasy"],
                    },
                });
                const payload = hostedCharacterSharePayload([record]);
                upload = await uploadCompressedJson(payload, "Supabase live character publish cleanup smoke", {
                    testUpload: true,
                });
                devAssert(
                    !!upload.url && !!hostedUploadDeletionUrl(upload),
                    "live character publish cleanup smoke uploaded a temporary one-day Perchance payload with deletion URL",
                    {
                        url: upload.url,
                        deletionUrl: hostedUploadDeletionUrl(upload),
                        expiresInSeconds: upload.expiresInSeconds,
                    },
                );
                const entry = publicLibraryCharacterMetadata(record, publicUploadFileUrl(upload.fileName));
                const errors = publicLibraryPublishPolicyErrors(entry);
                devAssert(!errors.length, "live character publish cleanup smoke metadata is valid before Supabase write", {
                    entry,
                    errors,
                });
                result = await upsertPublicLibraryEntryToSupabase(entry, {
                    payload_url: entry.url,
                    image_url: entry.image_url || null,
                    change_summary: "Temporary live character publish cleanup smoke version.",
                });
                devAssert(
                    !!result.item?.id &&
                        !!result.version?.id &&
                        result.item.owner_user_id === user.id &&
                        result.item.type === "character" &&
                        result.version.item_id === result.item.id,
                    "live character publish cleanup smoke inserted owned Supabase item and version rows",
                    { item: result.item, version: result.version, userId: user.id },
                );
                const anonymousRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,name,current_version_id,visibility,type,gender,age&type=eq.character&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    anonymousRows.length === 1 &&
                        anonymousRows[0].id === result.item.id &&
                        anonymousRows[0].current_version_id === result.version.id &&
                        anonymousRows[0].type === "character",
                    "live character publish cleanup smoke can anonymously read the temporary public character item",
                    { anonymousRows, item: result.item, version: result.version },
                );
                await cleanupPublicLibrarySupabaseResults([result]);
                const afterCleanupRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id&type=eq.character&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    afterCleanupRows.length === 0,
                    "live character publish cleanup smoke deleted the temporary Supabase character item row",
                    { afterCleanupRows, itemId: result.item.id },
                );
                const deleted = await deleteHostedUpload(upload, "Supabase live character publish cleanup smoke");
                upload = null;
                devAssert(deleted, "live character publish cleanup smoke deleted the temporary Perchance payload", {
                    itemId: result.item.id,
                    versionId: result.version.id,
                });
                addMessage("system", "Supabase live character publish cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-character-publish-cleanup-smoke");
            } catch (err) {
                if (result)
                    await cleanupPublicLibrarySupabaseResults([result], {
                        throwOnFailure: false,
                    });
                if (upload) await cleanupHostedUploads([upload], "Supabase live character publish cleanup smoke fallback cleanup");
                throw err;
            } finally {
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRequireLivePublicHostingSmokeUser(label = "live public-hosting smoke") {
            await publicLibraryRefreshSessionIfNeeded();
            const user = await publicLibraryRefreshCurrentUser();
            if (!user?.id) {
                devTestLog(`SKIP: ${label} requires signing in first`, {
                    hasSession: !!app.supabaseSession,
                    hasAccessToken: !!app.supabaseSession?.access_token,
                });
                addMessage("system", `${label} skipped because no Supabase session is active.`);
                scheduleActiveGameSave();
                render();
                throw smokeSkipError(
                    `${label} requires an active signed-in Supabase session.`,
                );
            }
            return user;
        }

        const devTemporaryPublicHostingCreators = new Map();

        async function devCreateTemporaryPublicHostingCreator(user = null) {
            if (!user?.id) throw new Error("A signed-in user is required for live publishing.");
            const identity = {
                creator_id: crypto.randomUUID(),
                creator_name: `Smoke Creator ${crypto.randomUUID()}`,
                owner_user_id: user.id,
            };
            //Track before sending so cleanup also handles a lost create response.
            devTemporaryPublicHostingCreators.set(identity.creator_id, identity);
            await publicLibraryFetch("/rest/v1/creator_identities", { method: "POST", body: identity });
            return identity;
        }

        async function devCleanupTemporaryPublicHostingCreators() {
            for (const [id, identity] of devTemporaryPublicHostingCreators) {
                const query = `creator_id=eq.${postgrestValue(id)}&owner_user_id=eq.${postgrestValue(identity.owner_user_id)}`;
                await publicLibraryFetch(`/rest/v1/creator_identities?${query}`, { method: "DELETE" });
                const remaining = await publicLibraryFetch(`/rest/v1/creator_identities?select=creator_id&${query}`);
                if (remaining.length) throw new Error(`Temporary smoke creator ${id} was not deleted.`);
                devTemporaryPublicHostingCreators.delete(id);
                const registry = creatorIdentityRegistry();
                const index = registry.identities.findIndex((entry) => entry.creator_id === id);
                if (index >= 0) {
                    registry.identities.splice(index, 1);
                    saveCreatorIdentityRegistry("temporary smoke creator removed");
                }
            }
        }

        async function devRequireLivePublicHostingCreator(user = null) {
            if (!user?.id) throw new Error("A signed-in user is required for live publishing.");
            const selected = selectedCreatorIdentity();
            let identity = creatorIdentities().find(
                (candidate) => candidate.owner_user_id === user.id &&
                    !creatorIdentityNameReservationError(candidate.creator_name, user),
            );
            if (!identity && selected &&
                (!selected.owner_user_id || selected.owner_user_id === user.id) &&
                !creatorIdentityNameReservationError(selected.creator_name, user))
                identity = selected;
            if (!identity)
                throw new Error("Create or select a non-reserved creator identity belonging to the currently signed-in account before running live publishing smokes.");
            await ensureCreatorIdentityInSupabase(identity.creator_id, identity.creator_name);
            identity = creatorIdentityById(identity.creator_id) || identity;
            return identity;
        }

        async function devUploadTemporaryStoryTemplatePayload(story, label = "temporary story smoke upload") {
            const payload = storyExportPayloadFromDefinition(
                storyDefinitionForExport(story),
            );
            const upload = await uploadCompressedStoryJson(payload, label, { testUpload: true });
            devAssert(
                !!upload.url && !!hostedUploadDeletionUrl(upload),
                `${label} returned a temporary one-day Perchance payload URL and deletion URL`,
                {
                    url: upload.url,
                    deletionUrl: hostedUploadDeletionUrl(upload),
                    expiresInSeconds: upload.expiresInSeconds,
                },
            );
            return upload;
        }

        async function devRunSupabaseLiveUpdateVersionCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-update-version-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live update/version cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live update/version cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const uploads = [];
            let firstResult = null;
            let secondResult = null;
            try {
                const user = await devRequireLivePublicHostingSmokeUser("Supabase live update/version cleanup smoke");
                if (!user) return;
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const story = devSmokeTemplateRecord({
                    id: `supabase-live-update-cleanup-${nonce}`,
                    title: `Supabase Live Update Cleanup Smoke ${nonce}`,
                    description: "Temporary public-library update smoke story. This row and uploads must be deleted before the smoke finishes.",
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures smoke test",
                    genres: ["fantasy"],
                });
                const firstUpload = await devUploadTemporaryStoryTemplatePayload(story, "Supabase live update cleanup smoke v1");
                uploads.push(firstUpload);
                const firstEntry = publicLibraryStoryMetadata(story, publicUploadFileUrl(firstUpload.fileName), creatorIdentity);
                firstResult = await upsertPublicLibraryEntryToSupabase(firstEntry, {
                    payload_url: firstEntry.url,
                    change_summary: "Temporary live update smoke version 1.",
                });
                const updatedStory = validatedStoryTemplateRecord({
                    ...story,
                    description: `${story.description} Updated version.`,
                    state: {
                        ...story.state,
                        meta: {
                            ...story.state.meta,
                        },
                    },
                });
                const secondUpload = await devUploadTemporaryStoryTemplatePayload(updatedStory, "Supabase live update cleanup smoke v2");
                uploads.push(secondUpload);
                const secondEntry = publicLibraryStoryMetadata(updatedStory, publicUploadFileUrl(secondUpload.fileName), creatorIdentity);
                secondResult = await upsertPublicLibraryEntryToSupabase(secondEntry, {
                    payload_url: secondEntry.url,
                    change_summary: "Temporary live update smoke version 2.",
                });
                devAssert(
                    firstResult.item?.id === secondResult.item?.id &&
                        Number(firstResult.version?.version_number) === 1 &&
                        Number(secondResult.version?.version_number) === 2 &&
                        secondResult.item?.current_version_id === secondResult.version?.id,
                    "live update/version smoke creates a second version on the same owned item and points current_version_id at v2",
                    { firstResult, secondResult },
                );
                const versions =
                    (await publicLibraryFetch(
                        `/rest/v1/library_versions?select=*&item_id=eq.${postgrestValue(secondResult.item.id)}&order=version_number.desc`,
                        { auth: false },
                    )) || [];
                devAssert(
                    versions.length === 2 &&
                        versions[0].version_number === 2 &&
                        versions[1].version_number === 1,
                    "live update/version smoke anonymous version history shows both temporary versions newest first",
                    { versions },
                );
                await cleanupPublicLibrarySupabaseResults([secondResult]);
                const afterCleanup =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id&id=eq.${postgrestValue(secondResult.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(afterCleanup.length === 0, "live update/version smoke deleted the temporary Supabase item", {
                    afterCleanup,
                    itemId: secondResult.item.id,
                });
                await cleanupHostedUploads(uploads, "Supabase live update/version cleanup smoke");
                uploads.length = 0;
                addMessage("system", "Supabase live update/version cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-update-version-cleanup-smoke");
            } catch (err) {
                if (secondResult || firstResult)
                    await cleanupPublicLibrarySupabaseResults([secondResult || firstResult], {
                        throwOnFailure: false,
                    });
                await cleanupHostedUploads(uploads, "Supabase live update/version cleanup smoke fallback cleanup");
                throw err;
            } finally {
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRunSupabaseLiveFeedbackCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-feedback-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live feedback cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live feedback cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const uploads = [];
            let result = null;
            let reportId = "";
            try {
                const user = await devRequireLivePublicHostingSmokeUser("Supabase live feedback cleanup smoke");
                if (!user) return;
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const story = devSmokeTemplateRecord({
                    id: `supabase-live-feedback-cleanup-${nonce}`,
                    title: `Supabase Live Feedback Cleanup Smoke ${nonce}`,
                    description: "Temporary public-library feedback smoke story. This row, feedback, and upload must be deleted before the smoke finishes.",
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures smoke test",
                    genres: ["fantasy"],
                });
                const upload = await devUploadTemporaryStoryTemplatePayload(story, "Supabase live feedback cleanup smoke");
                uploads.push(upload);
                const entry = publicLibraryStoryMetadata(story, publicUploadFileUrl(upload.fileName), creatorIdentity);
                result = await upsertPublicLibraryEntryToSupabase(entry, {
                    payload_url: entry.url,
                    change_summary: "Temporary live feedback cleanup smoke version.",
                });
                app.publicLibraryLastIndex = devSmokePublicLibraryIndex({
                    items: [result.entry || publicLibraryEntryFromSupabaseItem(result.item, result.version, [])],
                    story_feedback: [],
                });
                let ownRatingRejected = false;
                try {
                    await submitPublicStoryRating(result.entry.id, 5);
                } catch (err) {
                    ownRatingRejected = /cannot rate your own published item/i.test(
                        err?.message || String(err),
                    );
                    if (!ownRatingRejected) throw err;
                }
                devAssert(
                    ownRatingRejected,
                    "live feedback smoke enforces the no-self-rating policy",
                );
                let legacyReportRejected = false;
                try {
                    await publicLibraryFetch("/rest/v1/library_feedback", {
                        method: "POST",
                        body: {
                            item_id: result.item.id,
                            user_id: user.id,
                            kind: "report",
                            report_reason: "Legacy report path must be rejected.",
                        },
                    });
                } catch (error) {
                    legacyReportRejected = /401|403|row-level security|policy/i.test(
                        String(error?.message || error),
                    );
                    if (!legacyReportRejected) throw error;
                }
                devAssert(
                    legacyReportRejected,
                    "live feedback schema rejects obsolete report rows outside the public report inbox",
                );
                reportId = crypto.randomUUID();
                await publicLibraryFetch("/rest/v1/library_reports", {
                    method: "POST",
                    auth: false,
                    body: {
                        id: reportId,
                        item_id: result.item.id,
                        item_type: "story",
                        item_title: story.title,
                        uploader_id: user.id,
                        reasons: ["wrong_genre"],
                        details: "Anonymous live feedback smoke report.",
                        content_url: entry.url,
                    },
                });
                await addPublicStoryFeedback(result.entry.id, {
                    type: "tag_suggestion",
                    comment: "Live feedback smoke tag suggestion.",
                });
                const feedbackRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_feedback?select=*&item_id=eq.${postgrestValue(result.item.id)}&order=created_at.asc`,
                        { auth: true },
                    )) || [];
                const ratingRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_ratings?select=item_id,rating&item_id=eq.${postgrestValue(result.item.id)}`,
                        { auth: true },
                    )) || [];
                const reportRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_reports?select=id,item_id,reporter_id,reasons&id=eq.${postgrestValue(reportId)}&limit=1`,
                    )) || [];

                const cleanedReportId = reportId;
                await publicLibraryFetch(
                    `/rest/v1/library_reports?id=eq.${postgrestValue(reportId)}`,
                    { method: "DELETE" },
                );
                reportId = "";
                await cleanupPublicLibrarySupabaseResults([result]);
                const afterRatingCleanup =
                    (await publicLibraryFetch(
                        `/rest/v1/library_ratings?select=item_id&item_id=eq.${postgrestValue(result.item.id)}`,
                        { auth: true },
                    )) || [];
                const afterItemCleanup =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                const afterReportCleanup =
                    (await publicLibraryFetch(
                        `/rest/v1/library_reports?select=id&id=eq.${postgrestValue(cleanedReportId)}&limit=1`,
                    )) || [];
                devAssert(
                    afterRatingCleanup.length === 0 &&
                        afterItemCleanup.length === 0 &&
                        afterReportCleanup.length === 0,
                    "live feedback cleanup smoke deleted temporary rating, report, and item rows",
                    {
                        afterRatingCleanup,
                        afterItemCleanup,
                        afterReportCleanup,
                        itemId: result.item.id,
                    },
                );
                await cleanupHostedUploads(uploads, "Supabase live feedback cleanup smoke");
                uploads.length = 0;
                addMessage("system", "Supabase live feedback cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-feedback-cleanup-smoke");
            } catch (err) {
                if (reportId)
                    await publicLibraryFetch(
                        `/rest/v1/library_reports?id=eq.${postgrestValue(reportId)}`,
                        { method: "DELETE" },
                    ).catch(() => null);
                if (result)
                    await cleanupPublicLibrarySupabaseResults([result], {
                        throwOnFailure: false,
                    });
                await cleanupHostedUploads(uploads, "Supabase live feedback cleanup smoke fallback cleanup");
                throw err;
            } finally {
                app.publicLibraryLastIndex = originalLastIndex;
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRunSupabaseLiveDownloadImportCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-download-import-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live download/import cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live download/import cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const uploads = [];
            let result = null;
            try {
                const user = await devRequireLivePublicHostingSmokeUser("Supabase live download/import cleanup smoke");
                if (!user) return;
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const title = `Supabase Live Download Import Smoke ${nonce}`;
                const story = devSmokeTemplateRecord({
                    id: `supabase-live-download-import-${nonce}`,
                    title,
                    description: "Temporary public-library download/import smoke story. This row and upload must be deleted before the smoke finishes.",
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures smoke test",
                    genres: ["fantasy"],
                });
                const upload = await devUploadTemporaryStoryTemplatePayload(story, "Supabase live download/import cleanup smoke");
                uploads.push(upload);
                const entry = publicLibraryStoryMetadata(story, publicUploadFileUrl(upload.fileName), creatorIdentity);
                result = await upsertPublicLibraryEntryToSupabase(entry, {
                    payload_url: entry.url,
                    change_summary: "Temporary live download/import cleanup smoke version.",
                });
                app.publicLibraryViewMode = "stories";
                const index = await fetchPublicLibraryIndex({
                    mode: "stories",
                    search: title,
                    page: 0,
                    pageSize: 10,
                });
                app.publicLibraryLastIndex = index;
                const found = (index.items || []).find((item) => item.supabase_item_id === result.item.id || item.id === result.item.id);
                devAssert(
                    !!found && found.url === entry.url,
                    "live download/import cleanup smoke finds the temporary item through paged Supabase search",
                    { found, indexItems: index.items, entry },
                );
                await importPublicLibraryEntry(found.id, {
                    openLibrary: false,
                    persist: false,
                    showNotice: false,
                });
                devAssert(
                    (app.storyTemplates || []).some((template) => template.title === title),
                    "live download/import cleanup smoke imports the temporary Perchance payload into the local story library",
                    { title, storyTemplates: (app.storyTemplates || []).map((template) => template.title) },
                );
                await cleanupPublicLibrarySupabaseResults([result]);
                const afterCleanup =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(afterCleanup.length === 0, "live download/import cleanup smoke deleted the temporary Supabase item", {
                    afterCleanup,
                    itemId: result.item.id,
                });
                await cleanupHostedUploads(uploads, "Supabase live download/import cleanup smoke");
                uploads.length = 0;
                addMessage("system", "Supabase live download/import cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-download-import-cleanup-smoke");
            } catch (err) {
                if (result)
                    await cleanupPublicLibrarySupabaseResults([result], {
                        throwOnFailure: false,
                    });
                await cleanupHostedUploads(uploads, "Supabase live download/import cleanup smoke fallback cleanup");
                throw err;
            } finally {
                await devCleanupSmokeStoryLibraryArtifacts("live download import smoke story artifacts cleaned");
                app.publicLibraryLastIndex = originalLastIndex;
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRunSupabaseLiveVisibilityCleanupSmokeTest() {
            devTestLog("Scenario start: supabase-live-visibility-cleanup-smoke");
            devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured for live visibility cleanup smoke", {
                url: publicLibrarySupabaseUrl(),
                keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
            });
            devAssert(hostedUploadSupported(), "Perchance upload plugin is available for live visibility cleanup smoke");
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const uploads = [];
            let result = null;
            try {
                const user = await devRequireLivePublicHostingSmokeUser("Supabase live visibility cleanup smoke");
                if (!user) return;
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const story = devSmokeTemplateRecord({
                    id: `supabase-live-visibility-${nonce}`,
                    title: `Supabase Live Visibility Smoke ${nonce}`,
                    description: "Temporary public-library visibility smoke story.",
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures smoke test",
                    genres: ["fantasy"],
                });
                const upload = await devUploadTemporaryStoryTemplatePayload(story, "Supabase live visibility cleanup smoke");
                uploads.push(upload);
                const entry = publicLibraryStoryMetadata(story, publicUploadFileUrl(upload.fileName), creatorIdentity);
                result = await upsertPublicLibraryEntryToSupabase(entry, {
                    payload_url: entry.url,
                    change_summary: "Temporary live visibility cleanup smoke version.",
                });
                const publicRowsBefore =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,visibility&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    publicRowsBefore.length === 1 && publicRowsBefore[0].visibility === "public",
                    "live visibility smoke temporary item is publicly readable before hiding",
                    { publicRowsBefore, item: result.item },
                );
                const hiddenState = exactOwnedPublicLibraryVersionState(
                    await publicLibraryFetch(
                        "/rest/v1/rpc/set_owned_library_item_visibility",
                        {
                            method: "POST",
                            body: {
                                target_item_id: result.item.id,
                                target_visible: false,
                            },
                        },
                    ),
                );
                devAssert(
                    hiddenState.itemId === result.item.id &&
                        hiddenState.public === false &&
                        hiddenState.versions.every((version) => !version.visible),
                    "Supabase hides every version through the owner-only item visibility RPC",
                    {
                        hiddenState,
                        requiredSqlPatch:
                            "tasks/supabase-library-version-visibility.sql",
                    },
                );
                const publicRowsAfterHide =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,visibility&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                const ownerRowsAfterHide =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,visibility&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                    )) || [];
                devAssert(
                    publicRowsAfterHide.length === 0 &&
                        ownerRowsAfterHide.length === 1 &&
                        ownerRowsAfterHide[0].visibility === "hidden",
                    "live visibility smoke hides item from anonymous browse while owner can still read it",
                    { publicRowsAfterHide, ownerRowsAfterHide, itemId: result.item.id },
                );
                const restoredState = exactOwnedPublicLibraryVersionState(
                    await publicLibraryFetch(
                        "/rest/v1/rpc/set_owned_library_item_visibility",
                        {
                            method: "POST",
                            body: {
                                target_item_id: result.item.id,
                                target_visible: true,
                            },
                        },
                    ),
                );
                const publicRowsAfterRestore =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,visibility&id=eq.${postgrestValue(result.item.id)}&limit=1`,
                        { auth: false },
                    )) || [];
                devAssert(
                    restoredState.public === true &&
                        restoredState.currentVersionId === result.version.id &&
                        publicRowsAfterRestore.length === 1 &&
                        publicRowsAfterRestore[0].visibility === "public",
                    "live visibility smoke restores hidden item to public visibility",
                    { restoredState, publicRowsAfterRestore, itemId: result.item.id },
                );
                await cleanupPublicLibrarySupabaseResults([result]);
                await cleanupHostedUploads(uploads, "Supabase live visibility cleanup smoke");
                uploads.length = 0;
                addMessage("system", "Supabase live visibility cleanup smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-live-visibility-cleanup-smoke");
            } catch (err) {
                if (result)
                    await cleanupPublicLibrarySupabaseResults([result], {
                        throwOnFailure: false,
                    });
                await cleanupHostedUploads(uploads, "Supabase live visibility cleanup smoke fallback cleanup");
                throw err;
            } finally {
                await devCleanupTemporaryPublicHostingCreators();
                saveSupabaseSession(app.supabaseSession);
            }
        }

        async function devRunSupabaseAuthUiSmokeTest() {
            devTestLog("Scenario start: supabase-auth-ui-smoke");
            const originalFetch = publicLibraryFetch;
            const originalNavigate = publicLibraryNavigate;
            const originalSettings = clone(app.settings);
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const calls = [];
            let navigatedTo = "";
            try {
                app.settings.publicLibrarySupabaseUrl = SUPABASE_PROJECT_URL;
                app.settings.publicLibrarySupabaseAnonKey = SUPABASE_PUBLISHABLE_KEY;
                saveSupabaseSession(null);
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    if (path === "/auth/v1/user") return { id: "user-1", email: "signed@example.com" };
                    if (path === "/auth/v1/logout") return null;
                    throw new Error(`Unexpected mocked Supabase auth call: ${path}`);
                };
                publicLibraryNavigate = (url) => {
                    navigatedTo = String(url || "");
                };
                openPublicLibraryIndexModal();
                const modalText = () => $("modalBox")?.textContent || "";
                devAssert(
                    /Not signed in/i.test(modalText()) &&
                        /Signing in is only required to publish characters and stories/i.test(modalText()) &&
                        /Sign in with Google/i.test(modalText()) &&
                        !/magic link/i.test(modalText()) &&
                        !/Refresh Session/i.test(modalText()) &&
                        !$("publicLibraryEmail"),
                    "public library auth UI renders concise signed-out Google controls and no magic link/manual refresh controls",
                );
                openPublicLibraryAccountModal();
                devAssert(
                    /Google Account/i.test(modalText()) &&
                        /Signing in is only required to publish characters and stories/i.test(modalText()) &&
                        /Sign in with Google/i.test(modalText()) &&
                        !/Refresh Session/i.test(modalText()) &&
                        !/Browsing and downloading public stories or characters works without sign-in/i.test(modalText()),
                    "Google Account modal explains signed-out Google sign-in with one concise note",
                    modalText(),
                );
                const expectedRedirectUrl = supabaseRedirectUrl();
                await signInPublicLibraryWithGoogle();
                const googleUrl = new URL(navigatedTo);
                const allowedPerchanceRedirects = new Set([
                    "https://perchance.org/emberquest",
                    "https://perchance.org/emberadventureslite",
                ]);
                devAssert(
                    googleUrl.origin === publicLibrarySupabaseUrl() &&
                        googleUrl.pathname === "/auth/v1/authorize" &&
                        googleUrl.searchParams.get("provider") === "google" &&
                        googleUrl.searchParams.get("redirect_to") ===
                            expectedRedirectUrl &&
                        allowedPerchanceRedirects.has(expectedRedirectUrl),
                    "Google sign-in uses the active approved Ember Adventures Perchance page as its OAuth redirect",
                    {
                        url: navigatedTo,
                        redirect_to: googleUrl.searchParams.get("redirect_to"),
                        expectedRedirectUrl,
                    },
                );
                await signInPublicLibraryWithGoogle({ driveAccess: true });
                const googleDriveUrl = new URL(navigatedTo);
                devAssert(
                    googleDriveUrl.searchParams.get("provider") === "google" &&
                        googleDriveUrl.searchParams.get("redirect_to") ===
                            expectedRedirectUrl &&
                        googleDriveUrl.searchParams.get("scopes") ===
                            GOOGLE_DRIVE_FILE_SCOPE,
                    "Google Drive connection requests only the per-file Drive scope",
                    { url: navigatedTo },
                );
                const cleanupUrl = supabaseRedirectCleanupUrl();
                devAssert(
                    cleanupUrl.startsWith("/") &&
                        !/^https?:\/\//i.test(cleanupUrl) &&
                        !cleanupUrl.includes("access_token="),
                    "Supabase auth hash cleanup uses a same-origin relative URL so Perchance preview/edit iframes do not throw replaceState origin errors",
                    { cleanupUrl, currentOrigin: window.location.origin },
                );
                devAssert(
                    !calls.some((call) => call.path === "/auth/v1/otp"),
                    "public library auth UI does not send magic-link OTP requests",
                    calls,
                );
                saveSupabaseSession({
                    access_token: "mock-access-token",
                    refresh_token: "mock-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "user-1", email: "signed@example.com" },
                });
                await flushLargeSaves();
                const persistedMockSession = await loadLargeJson(
                    SUPABASE_SESSION_KEY,
                    null,
                );
                devAssert(
                    persistedMockSession?.access_token === "mock-access-token" &&
                        persistedMockSession?.user?.email === "signed@example.com",
                    "Google account session persists through the worker-owned session record",
                    persistedMockSession,
                );
                openPublicLibraryIndexModal();
                devAssert(
                    /Google account connected/i.test(modalText()) &&
                        /signed@example.com/i.test(modalText()) &&
                        !/Refresh Session/i.test(modalText()),
                    "public library auth UI renders signed-in user controls",
                );
                openPublicLibraryAccountModal();
                devAssert(
                    /Google account connected/i.test(modalText()) &&
                        /signed@example.com/i.test(modalText()) &&
                        /Sign Out/i.test(modalText()) &&
                        !/Signing in is only required/i.test(modalText()) &&
                        !/Refresh Session/i.test(modalText()),
                    "Google Account modal shows signed-in Google account and sign-out control without signed-out guidance",
                    modalText(),
                );
                await signOutPublicLibrary();
                await flushLargeSaves();
                const persistedSignedOutSession = await loadLargeJson(
                    SUPABASE_SESSION_KEY,
                    null,
                );
                devAssert(
                    /Not signed in/i.test(modalText()) &&
                        /Sign in with Google/i.test(modalText()) &&
                        persistedSignedOutSession == null,
                    "Google Account modal refreshes to signed-out state after sign out",
                    {
                        modalText: modalText(),
                        persistedSignedOutSession,
                    },
                );
                addMessage("system", "Supabase auth UI smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-auth-ui-smoke");
            } finally {
                publicLibraryFetch = originalFetch;
                publicLibraryNavigate = originalNavigate;
                app.settings = {
                    ...clone(defaultSettings),
                    ...originalSettings,
                };
                saveSupabaseSession(originalSession);
                closeModal();
            }
        }

        async function devRunSupabasePublicBrowseSmokeTest() {
            devTestLog("Scenario start: supabase-public-browse-smoke");
            const originalViewMode = app.publicLibraryViewMode;
            const originalLastIndex = app.publicLibraryLastIndex ? clone(app.publicLibraryLastIndex) : null;
            const startedAt = performance.now();
            try {
                devAssert(publicLibrarySupabaseConfigured(), "Supabase public library is configured", {
                    url: publicLibrarySupabaseUrl(),
                    keyPrefix: publicLibrarySupabaseAnonKey().slice(0, 16),
                });
                app.publicLibraryViewMode = "stories";
                const storiesStartedAt = performance.now();
                const storyIndex = await fetchPublicLibraryIndex({ mode: "stories", limit: 10 });
                devAssert(
                    Array.isArray(storyIndex.items) &&
                        storyIndex.items.every((item) => item.type === "story-template"),
                    "Supabase anonymous story browse returns normalized story entries",
                    {
                        count: storyIndex.items.length,
                        durationMs: Math.round(performance.now() - storiesStartedAt),
                        items: storyIndex.items.map((item) => ({
                            id: item.id,
                            name: item.name,
                            url: item.url,
                            genres: item.genres,
                        })),
                    },
                );
                app.publicLibraryViewMode = "characters";
                const charactersStartedAt = performance.now();
                const characterIndex = await fetchPublicLibraryIndex({ mode: "characters", limit: 10 });
                devAssert(
                    Array.isArray(characterIndex.items) &&
                        characterIndex.items.every((item) => item.type === "character"),
                    "Supabase anonymous character browse returns normalized character entries",
                    {
                        count: characterIndex.items.length,
                        durationMs: Math.round(performance.now() - charactersStartedAt),
                        items: characterIndex.items.map((item) => ({
                            id: item.id,
                            name: item.name,
                            url: item.url,
                            genres: item.genres,
                            gender: item.gender,
                        })),
                    },
                );
                app.publicLibraryViewMode = "all";
                const allStartedAt = performance.now();
                const allIndex = await fetchPublicLibraryIndex({ mode: "all", limit: 10 });
                devAssert(
                    Array.isArray(allIndex.items) &&
                        allIndex.items.every((item) => item.type === "story-template" || item.type === "character"),
                    "Supabase anonymous combined browse returns only public library item types",
                    {
                        count: allIndex.items.length,
                        durationMs: Math.round(performance.now() - allStartedAt),
                        totalDurationMs: Math.round(performance.now() - startedAt),
                    },
                );
                app.publicLibraryLastIndex = allIndex;
                addMessage("system", "Supabase public browse smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: supabase-public-browse-smoke");
            } finally {
                app.publicLibraryViewMode = originalViewMode || "stories";
                app.publicLibraryLastIndex = originalLastIndex || null;
            }
        }

        async function devRunPublicLibraryUiFeedbackSmokeTest() {
            devTestLog("Scenario start: public-library-ui-feedback-smoke");
            devResetForLiveTest("public-library-ui-feedback-smoke");
            devCreateTestProfile({  });
            const storyEntry = createPublicLibraryEntry({
                type: "story-template",
                name: "Public Feedback Smoke Story",
                url: "https://example.com/public-feedback-smoke-story.json",
                source: "Original",
                creator: "debug harness",
                creator_id: "00000000-0000-4000-8000-000000000001",
                creation_tool: "debug harness",
                genres: ["fantasy"],
            });
            storyEntry.supabase_item_id = "supabase-feedback-story-1";


            const characterEntry = createPublicLibraryEntry({
                type: "character",
                name: "Public Report Smoke Character",
                url: "https://example.com/public-report-smoke-character.json",
                image_url: "https://example.com/public-report-smoke-character.png",
                source: "Original",
                creator: "debug harness",
                creator_id: "00000000-0000-4000-8000-000000000001",
                creation_tool: "debug harness",
                genres: ["fantasy"],
                gender: "female",
                age: 25,
            });
            characterEntry.supabase_item_id = "supabase-feedback-character-1";
            let index = devSmokePublicLibraryIndex({
                items: [storyEntry, characterEntry],
                story_feedback: [],
            });
            const feedbackIndex = () => {
                const next = devSmokePublicLibraryIndex(index);
                const entry = next.items.find((item) => item.id === storyEntry.id);
                if (entry) entry.supabase_item_id = "supabase-feedback-story-1";
                return next;
            };
            const originalFetchPublicLibraryIndex = fetchPublicLibraryIndex;
            const originalReplacePublicLibraryIndex = replacePublicLibraryIndex;
            const originalFetch = publicLibraryFetch;
            const originalFetchJsonFromPublicUploadUrl = fetchJsonFromPublicUploadUrl;
            const originalFetchVerifiedPublicLibraryPayload = fetchVerifiedPublicLibraryPayload;
            const originalFetchCuratedJsonPayload = fetchCuratedJsonPayload;
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalHash = window.location.hash;
            const originalCharacterDefinitions = clone(app.characterDefinitions || []);
            const originalProfileImages = clone(app.profileImages || []);
            const originalStoryTemplates = clone(app.storyTemplates || []);
            const originalFeaturedPublisherDraft = localStorage.getItem(
                FEATURED_CONTENT_PUBLISHER_DRAFT_KEY,
            );
            const originalPublicLibraryQueryCache = await largeStorageGet(
                PUBLIC_LIBRARY_QUERY_CACHE_KEY,
            );
            const feedbackRows = [];
            const reportRows = [];
            const supabaseCalls = [];
            try {
                saveSupabaseSession({
                    access_token: "mock-feedback-access-token",
                    refresh_token: "mock-feedback-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "feedback-smoke-user", email: "feedback-smoke@example.com" },
                });
                fetchPublicLibraryIndex = async () => feedbackIndex();
                replacePublicLibraryIndex = async (next) => {
                    index = devSmokePublicLibraryIndex(next);
                    return { url: "https://example.com/mock-public-index.json", fileName: "mock-public-index.json" };
                };
                fetchJsonFromPublicUploadUrl = async (url = "") => {
                    if (url === "https://example.com/reported-review-story.json")
                        return storyExportPayloadFromDefinition(
                            devSmokeTemplateRecord({
                                id: "reported-review-story-id",
                                title: "Reported Review Story",
                                description: "Opened from Report Manager review hash.",
                                genres: ["fantasy"],
                            }),
                        );
                    throw new Error(`Unexpected public feedback smoke payload URL: ${url}`);
                };
                fetchVerifiedPublicLibraryPayload = async (entry) =>
                    fetchJsonFromPublicUploadUrl(entry?.url);
                publicLibraryFetch = async (path, options = {}) => {
                    supabaseCalls.push({ path, options: clone(options) });
                    if (path === "/auth/v1/user")
                        return { id: "feedback-smoke-user", email: "feedback-smoke@example.com" };
                    if (path === "/rest/v1/library_feedback" && options.method === "POST") {
                        const row = {
                            id: `feedback-row-${feedbackRows.length + 1}`,
                            ...clone(options.body || {}),
                            created_at: new Date().toISOString(),
                        };
                        feedbackRows.push(row);
                        const normalized = createPublicStoryFeedback({
                            id: row.id,
                            entry_id: storyEntry.id,
                            type: row.kind,
                            rating: row.rating,
                            report_reason: row.report_reason,
                            comment: row.comment,
                            creator: "feedback-smoke-user",
                            at: row.created_at,
                        });
                        if (normalized)
                            index = devSmokePublicLibraryIndex({
                                ...index,
                                story_feedback: [
                                    ...(index.story_feedback || []),
                                    normalized,
                                ],
                            });
                        return [row];
                    }
                    if (path === "/rest/v1/library_reports" && options.method === "POST") {
                        const row = {
                            id: `report-row-${reportRows.length + 1}`,
                            ...clone(options.body || {}),
                            created_at: new Date().toISOString(),
                        };
                        reportRows.push(row);
                        return [row];
                    }
                    if (path === "/rest/v1/rpc/admin_inbox_counts" && options.method === "POST")
                        return { r: reportRows.length, d: 2 };
                    if (path === "/rest/v1/rpc/set_library_rating" && options.method === "POST") {
                        return [{
                            item_id: options.body.target_item_id,
                            rating: options.body.target_rating,
                            rating_total: options.body.target_rating,
                            rating_count: 1,
                            rating_average: options.body.target_rating,
                        }];
                    }
                    if (path === "/rest/v1/rpc/remove_library_rating" && options.method === "POST")
                        return [];
                    if (path === "/rest/v1/rpc/search_public_library_items" && options.method === "POST")
                        return [];
                    throw new Error(`Unexpected mocked Supabase feedback call: ${path}`);
                };
                app.publicLibraryLastIndex = feedbackIndex();
                const reportReviewStoryEntry = publicLibraryEntryFromReportManagerReview({
                    source: "EmberAdventuresReportManager",
                    item_type: "story",
                    item_id: "report-review-story-id",
                    item_title: "Reported Review Story",
                    content_url: "https://example.com/reported-review-story.json",
                    image_url: "https://example.com/reported-review-story.png",
                    report_count: 2,
                });
                const reportReviewCharacterEntry = publicLibraryEntryFromReportManagerReview({
                    source: "EmberAdventuresReportManager",
                    item_type: "character",
                    item_id: "report-review-character-id",
                    item_title: "Reported Review Character",
                    content_url: "https://example.com/reported-review-character.json",
                    image_url: "https://example.com/reported-review-character.png",
                    report_count: 1,
                });
                devAssert(
                    reportReviewStoryEntry?.type === "story-template" &&
                        reportReviewStoryEntry.url === "https://example.com/reported-review-story.json" &&
                        reportReviewStoryEntry.image_url === "https://example.com/reported-review-story.png" &&
                        reportReviewCharacterEntry?.type === "character" &&
                        reportReviewCharacterEntry.url === "https://example.com/reported-review-character.json",
                    "Report Manager review links normalize into temporary public story/character entries",
                    { reportReviewStoryEntry, reportReviewCharacterEntry },
                );
                app.reportManagerReviewHashHandled = false;
                window.location.hash = `#review=${encodeURIComponent(JSON.stringify({
                    source: "EmberAdventuresReportManager",
                    item_type: "story",
                    item_id: "report-review-story-id",
                    item_title: "Reported Review Story",
                    content_url: "https://example.com/reported-review-story.json",
                    image_url: "https://example.com/reported-review-story.png",
                    report_count: 2,
                }))}`;
                await handleReportManagerReviewHashOnStartup();
                await new Promise((resolve) => setTimeout(resolve, 100));
                const reportReviewLayer = document.querySelector("[data-story-library-layer='1']");
                devAssert(
                    storyLibraryActiveTab() === "public" &&
                        /Reported Review Story/i.test(reportReviewLayer?.textContent || "") &&
                        /Download \/ Import/i.test(reportReviewLayer?.textContent || "") &&
                        !(app.storyTemplates || []).some(
                            (template) => template.id === "reported-review-story-id",
                        ),
                    "Report Manager review hash opens the reported public story detail without importing locally",
                    {
                        activeTab: storyLibraryActiveTab(),
                        layerText: (reportReviewLayer?.textContent || "").slice(0, 500),
                        localStoryIds: (app.storyTemplates || []).map((template) => template.id),
                    },
                );
                closeStoryLibraryPopups();
                index = devSmokePublicLibraryIndex({
                    items: [storyEntry, characterEntry],
                    story_feedback: [],
                });
                app.publicLibraryLastIndex = feedbackIndex();
                const assertFeedbackInsert = (kind, checks = {}) => {
                    const row = feedbackRows.find((item) => item.kind === kind);
                    devAssert(
                        row &&
                            row.item_id === "supabase-feedback-story-1" &&
                            row.user_id === "feedback-smoke-user" &&
                            Object.entries(checks).every(([key, value]) => {
                                const actual = row[key];
                                return Array.isArray(value)
                                    ? JSON.stringify(actual) === JSON.stringify(value)
                                    : actual === value;
                            }),
                        `public library UI writes ${kind} feedback through Supabase payload`,
                        { row, feedbackRows, supabaseCalls },
                    );
                };
                const latestPopupText = () =>
                    [...document.querySelectorAll(".popup-modal.open")].at(-1)?.textContent || "";
                openPublicLibraryIndexModal();
                devAssert(
                    /Public Feedback Smoke Story/i.test($("publicLibraryStoryList")?.textContent || ""),
                    "public library modal renders mocked public story row",
                );
                $("publicLibraryStorySearch").value = "bondage";
                publicLibraryQueryState().submittedSearch = "bondage";
                renderPublicLibraryStoryList(index);

                $("publicLibraryStorySearch").value = "no-match-token";
                publicLibraryQueryState().submittedSearch = "no-match-token";
                renderPublicLibraryStoryList(index);
                devAssert(
                    /No public stories match/i.test($("publicLibraryStoryList")?.textContent || ""),
                    "public library story search hides non-matching rows",
                );
                $("publicLibraryStorySearch").value = "";
                publicLibraryQueryState().submittedSearch = "";
                renderPublicLibraryStoryList(index);
                devAssert(
                    !/Report Story/i.test($("publicLibraryStoryList")?.textContent || ""),
                    "public library grid/list cards do not show report buttons",
                );

                const underlyingRatingDetail = openStoryLibraryLayer("Rating smoke detail");
                openRatePublicStoryModal(storyEntry.id);
                openRatePublicStoryModal(storyEntry.id);
                const ratingLayer = document.querySelector("[data-public-rating-layer]");
                devAssert(
                    document.querySelectorAll("[data-public-rating-layer]").length === 1,
                    "reopening the rating picker does not stack duplicate popups",
                );
                devAssert(
                    /0 through 10/i.test(ratingLayer?.textContent || "") &&
                        ratingLayer?.querySelectorAll(".public-rating-picker button").length === 11,
                    "public library rating UI offers every integer rating from 0 through 10",
                    { layer: ratingLayer?.textContent || "" },
                );
                await submitPublicStoryRating(storyEntry.id, 0);
                devAssert(
                    !ratingLayer.isConnected && underlyingRatingDetail.box.isConnected,
                    "rating submission closes its own picker and preserves the underlying detail",
                );
                closeContainingPopup(underlyingRatingDetail.box);
                devAssert(
                    supabaseCalls.some((call) =>
                        call.path === "/rest/v1/rpc/set_library_rating" &&
                        call.options.body?.target_rating === 0,
                    ),
                    "public library preserves zero as a real rating through the rating RPC",
                    supabaseCalls,
                );
                await removePublicStoryRating(storyEntry.id);
                devAssert(
                    supabaseCalls.some((call) => call.path === "/rest/v1/rpc/remove_library_rating"),
                    "public library removes the current user's rating through the rating RPC",
                    supabaseCalls,
                );
                document.querySelectorAll(".popup-modal.open,[data-story-library-layer='1']").forEach((popup) => popup.remove());

                openReportPublicStoryModal(storyEntry.id);
                $("submitPublicReportBtn").click();
                await new Promise((resolve) => setTimeout(resolve, 0));
                devAssert(
                    /Select at least one report reason/i.test(latestPopupText()),
                    "public report submit is blocked until at least one reason is selected",
                );
                document.querySelectorAll(".popup-modal.open").forEach((popup) => popup.remove());
                openReportPublicStoryModal(storyEntry.id);
                const wrongGenreReason = [...document.querySelectorAll("[data-public-report-reason]")]
                    .find((input) => input.value === "wrong_genre");
                devAssert(
                    document.querySelector("#publicReportGenrePicker")?.classList.contains("hidden"),
                    "wrong genre correction picker is hidden until Wrong genre is selected",
                );
                wrongGenreReason.checked = true;
                wrongGenreReason.dispatchEvent(new Event("change"));
                devAssert(
                    !document.querySelector("#publicReportGenrePicker")?.classList.contains("hidden"),
                    "wrong genre correction picker opens after Wrong genre is selected",
                );
                document.querySelector("[data-report-picker='genres'][value='sci-fi']")?.click();
                $("publicReportDetails").value = "UI smoke report.";
                $("publicReportReplyEmail").value = "reporter@example.com";
                $("submitPublicReportBtn").click();
                await new Promise((resolve) => setTimeout(resolve, 0));
                devAssert(
                    reportRows.length === 1 &&
                        reportRows[0].item_id === "supabase-feedback-story-1" &&
                        reportRows[0].item_type === "story" &&
                        reportRows[0].reporter_id === "feedback-smoke-user" &&
                        reportRows[0].reporter_email === "feedback-smoke@example.com" &&
                        reportRows[0].reasons.includes("wrong_genre") &&
                        reportRows[0].details === "UI smoke report." &&
                        reportRows[0].reply_email === "reporter@example.com" &&
                        reportRows[0].suggested_genres.includes("fantasy") &&
                        reportRows[0].suggested_genres.includes("sci-fi"),
                    "public report UI writes compact story reports through Supabase reports payload",
                    { reportRows, supabaseCalls },
                );
                document.querySelectorAll(".popup-modal.open").forEach((popup) => popup.remove());
                app.settings.devMode = false;
                openMainMenuDataToolsModal();
                devAssert(
                    !/report/i.test($("modalBox")?.textContent || ""),
                    "main menu Tools never exposes report review controls when dev mode is off",
                );
                closeModal();
                app.settings.devMode = true;
                openMainMenuDataToolsModal();
                devAssert(
                    !/report/i.test($("modalBox")?.textContent || ""),
                    "main menu Tools never exposes report review controls when dev mode is on",
                );
                closeModal();
                const adminInboxRpcCount = () =>
                    supabaseCalls.filter(
                        (call) =>
                            call.path === "/rest/v1/rpc/admin_inbox_counts" &&
                            call.options.method === "POST",
                    ).length;
                saveSupabaseSession({
                    access_token: "mock-admin-access-token",
                    refresh_token: "mock-admin-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: {
                        id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                        email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                    },
                });
                const beforeReportNoticeDownload = app.__emberAdventuresLastJsonDownload;
                const beforeAdminInboxRpcCount = adminInboxRpcCount();
                const reportNoticeResult = await notifyAdminPublicReportCount({ startup: true });
                devAssert(
                    reportNoticeResult?.reports === 1 &&
                        reportNoticeResult?.developerIssues === 2 &&
                        !$("adminInboxBtn")?.classList.contains("hidden") &&
                        $("adminInboxBadge")?.textContent === "3" &&
                        adminInboxRpcCount() === beforeAdminInboxRpcCount + 1 &&
                        app.__emberAdventuresLastJsonDownload === beforeReportNoticeDownload,
                    "admin startup inbox uses one compact RPC and keeps a persistent combined report badge",
                    { reportNoticeResult, lastDownload: app.__emberAdventuresLastJsonDownload },
                );
                const authorizedInboxOpened = openAdminInboxNotice();
                devAssert(
                    authorizedInboxOpened === true &&
                        /Administrator Inbox/i.test(latestPopupText()),
                    "the exact official UUID and email can open the administrator inbox UI",
                );
                document.querySelectorAll(".popup-modal.open").forEach((popup) => popup.remove());
                const beforeFeaturedPublisherToolsCalls = supabaseCalls.length;
                openMainMenuDataToolsModal();
                devAssert(
                    /Featured Content Publisher/i.test($("modalBox")?.textContent || "") &&
                        supabaseCalls.length === beforeFeaturedPublisherToolsCalls,
                    "the exact official UUID and email sees the dev-only Featured Content Publisher without a Supabase request",
                    { supabaseCalls },
                );
                closeModal();
                const availableFeaturedPublisherRecord = devSmokeCharacterRecord(
                    "Available Publisher Card Smoke",
                );
                const stagedFeaturedPublisherRecord = devSmokeCharacterRecord(
                    "Staged Publisher Card Smoke",
                );
                const stagedFeaturedPublisherPayload = hostedCharacterSharePayload([
                    characterDefinitionProjectionForExport(stagedFeaturedPublisherRecord),
                ]);
                fetchCuratedJsonPayload = async (config = {}) => {
                    if (/staged-featured-character-v[12]\.gz$/i.test(config.url || ""))
                        return clone(stagedFeaturedPublisherPayload);
                    return originalFetchCuratedJsonPayload(config);
                };
                app.characterDefinitions = validatedCharacterLibraryDefinitions([
                    availableFeaturedPublisherRecord,
                    stagedFeaturedPublisherRecord,
                ]);
                app.characterLibraryRecordsCache = null;
                saveFeaturedContentPublisherDraft({
                    featuredCharacters: [{
                        url: "https://example.com/staged-featured-character-v2.gz",
                        characterId: stagedFeaturedPublisherRecord.id,
                        creator: stagedFeaturedPublisherRecord.creator,
                        creatorId: stagedFeaturedPublisherRecord.creator_id,
                        version: 2,
                        revision: "staged-v2",
                        payloadSha256: "",
                        payloadSizeBytes: 512,
                        versions: [{
                            version: 1,
                            url: "https://example.com/staged-featured-character-v1.gz",
                            revision: "staged-v1",
                            payloadSha256: "",
                            payloadSizeBytes: 500,
                        }, {
                            version: 2,
                            url: "https://example.com/staged-featured-character-v2.gz",
                            revision: "staged-v2",
                            payloadSha256: "",
                            payloadSizeBytes: 512,
                        }],
                    }],
                    featuredStories: [],
                    sandboxStories: [],
                });
                app.storyTemplates = [
                    devSmokeTemplateRecord({
                        id: "featured-publisher-card-smoke-story",
                        title: "Featured Publisher Card Smoke Story",
                    }),
                ];
                devAssert(
                    !featuredContentCharacterManifest().some(
                        (entry) => entry.characterId === stagedFeaturedPublisherRecord.id,
                    ) && featuredContentManifestSource().includes(stagedFeaturedPublisherRecord.id),
                    "Publisher drafts remain exportable without appearing in the active Featured rail",
                );
                openFeaturedContentPublisher("characters");
                const stagedFeaturedCharacterCard = document.querySelector(
                    "[data-featured-content-publisher] [data-featured-character-state='staged']",
                );
                const availableFeaturedCharacterCard = document.querySelector(
                    "[data-featured-content-publisher] [data-featured-character-state='available']",
                );
                setFeaturedContentPublisherSelection("character", true);
                const selectedFeaturedCharacterIds = selectedFeaturedPublisherIds(
                    "[data-featured-publisher-character]",
                );
                const selectedFeaturedCharacterRecords = selectedFeaturedCharacterIds
                    .map(characterLibraryRecordById)
                    .filter(Boolean)
                    .map(storedCharacterLibraryRecord);
                const featuredCharacterUploadPayload = hostedCharacterSharePayload(
                    selectedFeaturedCharacterRecords,
                );
                devAssert(
                    !!stagedFeaturedCharacterCard?.querySelector(".profile-image-thumb") &&
                        stagedFeaturedCharacterCard?.classList.contains("staged") &&
                        !stagedFeaturedCharacterCard?.querySelector(
                            "[data-featured-publisher-character]",
                        ) &&
                        /openFeaturedCharacterManager/.test(
                            stagedFeaturedCharacterCard?.querySelector(
                                ".character-library-definition-card",
                            )?.getAttribute("onclick") || "",
                        ) &&
                        availableFeaturedCharacterCard?.classList.contains("selected") &&
                        !/openCharacterLibraryDetail/.test(
                            availableFeaturedCharacterCard?.querySelector(
                                ".character-library-definition-card",
                            )?.getAttribute("onclick") || "",
                        ) &&
                        availableFeaturedCharacterCard?.querySelector(
                            "[data-featured-publisher-character]",
                        )?.checked === true &&
                        selectedFeaturedCharacterRecords.length === 1 &&
                        selectedFeaturedCharacterRecords[0].id ===
                            availableFeaturedPublisherRecord.id &&
                        !Object.hasOwn(selectedFeaturedCharacterRecords[0], "kind") &&
                        !Object.hasOwn(selectedFeaturedCharacterRecords[0], "entity") &&
                        !!featuredCharacterUploadPayload.character_definition &&
                        featuredCharacterVersions(
                            featuredCharacterManifestEntry(stagedFeaturedPublisherRecord.id),
                        ).length === 2,
                    "Featured Content Publisher separates managed Featured cards from selectable Available cards and preserves version history",
                    {
                        stagedCard: stagedFeaturedCharacterCard?.innerHTML || "",
                        availableCard: availableFeaturedCharacterCard?.innerHTML || "",
                        selectedFeaturedCharacterIds,
                        selectedFeaturedCharacterRecords,
                        featuredCharacterUploadPayload,
                    },
                );
                const runtimeHostedImages = [true, false].map((male) =>
                    createProfileImageRecord({
                        id: `featured-publisher-runtime-${male ? "male" : "non-male"}`,
                        character_id: stagedFeaturedPublisherRecord.id,
                        owner_name: stagedFeaturedPublisherRecord.name,
                        source: "featured publisher runtime image smoke",
                        model: "smoke",
                        html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Featured publisher runtime image">`,
                        male,
                        pending: false,
                        error: "",
                        hosted_url: `https://example.com/featured-publisher-runtime-${male ? "male" : "non-male"}.png`,
                    }),
                );
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    ...runtimeHostedImages,
                ]);
                const bundledHostedRecord = clone(stagedFeaturedPublisherRecord);
                bundledHostedRecord.character.profile_image_presentations = {
                    male: profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(true),
                        url: runtimeHostedImages[0].hosted_url,
                        local_image_id: runtimeHostedImages[0].id,
                    }),
                    non_male: profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(false),
                        url: runtimeHostedImages[1].hosted_url,
                        local_image_id: runtimeHostedImages[1].id,
                    }),
                };
                bundledHostedRecord.character.default_profile_image = clone(
                    bundledHostedRecord.character.profile_image_presentations.non_male,
                );
                const repairedBundledRecord = featuredCharacterWithHostedImages(
                    storedCharacterLibraryRecord(stagedFeaturedPublisherRecord),
                    bundledHostedRecord,
                    { male: false, non_male: false },
                );
                const repairedBundledValidation = validateCharacterLibraryRecord(
                    repairedBundledRecord,
                );
                devAssert(
                    repairedBundledValidation.ok &&
                        repairedBundledRecord.character.default_profile_image.url ===
                            runtimeHostedImages[1].hosted_url &&
                        repairedBundledRecord.character.default_profile_image.local_image_id === "" &&
                        repairedBundledRecord.character.profile_image_presentations.male.url ===
                            runtimeHostedImages[0].hosted_url &&
                        repairedBundledRecord.character.profile_image_presentations.male.local_image_id === "",
                    "bundled Featured Character repair converts resolved runtime image records into strict hosted definition slots",
                    {
                        validation: repairedBundledValidation,
                        defaultProfileImage:
                            repairedBundledRecord.character.default_profile_image,
                        presentations:
                            repairedBundledRecord.character.profile_image_presentations,
                    },
                );
                stagedFeaturedCharacterCard
                    ?.querySelector(".character-library-definition-card")
                    ?.click();
                await devWaitFor(
                    () =>
                        !!document.querySelector(
                            ".popup-modal [data-featured-character-manager] .featured-character-image-compare",
                        ),
                    1000,
                    "Featured character manager overlay to load",
                );
                const featuredManagerPopup = document.querySelector(
                    ".popup-modal:has([data-featured-character-manager])",
                );
                devAssert(
                    !!document.querySelector(
                        "#modalBox [data-featured-content-publisher]",
                    ) &&
                        !!featuredManagerPopup &&
                        featuredManagerPopup.querySelectorAll(
                            ".featured-character-image-compare > div:last-child img",
                        ).length === 2,
                    "clicking a Featured card opens its manager over the publisher and renders both active local presentation images",
                    featuredManagerPopup?.innerHTML || "",
                );
                featuredManagerPopup?.remove();
                openFeaturedContentPublisher("stories");
                const featuredStoryCard = document.querySelector(
                    "[data-featured-content-publisher] [data-featured-publisher-card='story']",
                );
                featuredStoryCard
                    ?.querySelector(".character-library-definition-card")
                    ?.click();
                devAssert(
                    !!featuredStoryCard?.querySelector(".profile-image-thumb") &&
                        featuredStoryCard?.classList.contains("selected") &&
                        featuredStoryCard?.querySelector(
                            "[data-featured-publisher-story]",
                        )?.checked === true &&
                        !!featuredStoryCard?.querySelector(
                            "[data-featured-publisher-story-group]",
                        ),
                    "Featured Content Publisher renders selectable story image cards with section controls",
                    featuredStoryCard?.innerHTML || "",
                );
                closeModal();
                saveSupabaseSession(null);
                const beforeNoSessionDownload = app.__emberAdventuresLastJsonDownload;
                const beforeNoSessionRpcCount = adminInboxRpcCount();
                const signedOutInboxOpened = openAdminInboxNotice();
                const noSessionResult = await notifyAdminPublicReportCount({ startup: true });
                devAssert(
                    noSessionResult == null &&
                        signedOutInboxOpened === false &&
                        adminInboxRpcCount() === beforeNoSessionRpcCount &&
                        $("adminInboxBtn")?.classList.contains("hidden") &&
                        !/Administrator Inbox/i.test(latestPopupText()) &&
                        app.__emberAdventuresLastJsonDownload === beforeNoSessionDownload &&
                        !/Only admins can use this feature/i.test(latestPopupText()),
                    "signed-out admin inbox checks and UI are blocked without an RPC, popup, or download",
                );
                document.querySelectorAll(".popup-modal.open").forEach((popup) => popup.remove());
                const unauthorizedAdminSessions = [
                    {
                        label: "ordinary signed-in account",
                        id: "feedback-smoke-user",
                        email: "feedback-smoke@example.com",
                    },
                    {
                        label: "official UUID with the wrong email",
                        id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                        email: "not-andro951@example.com",
                    },
                    {
                        label: "official email with the wrong UUID",
                        id: "wrong-official-admin-user-id",
                        email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                    },
                ];
                for (const unauthorized of unauthorizedAdminSessions) {
                    saveSupabaseSession({
                        access_token: `mock-${unauthorized.label}-access-token`,
                        refresh_token: `mock-${unauthorized.label}-refresh-token`,
                        token_type: "bearer",
                        expires_at: Math.floor(Date.now() / 1000) + 3600,
                        user: {
                            id: unauthorized.id,
                            email: unauthorized.email,
                        },
                    });
                    app.adminInboxAvailable = true;
                    app.adminInboxCounts = { reports: 7, developerIssues: 5 };
                    renderAdminInboxButton();
                    const beforeUnauthorizedRpcCount = adminInboxRpcCount();
                    const unauthorizedInboxOpened = openAdminInboxNotice();
                    const unauthorizedResult = await notifyAdminPublicReportCount({
                        startup: true,
                    });
                    devAssert(
                        unauthorizedInboxOpened === false &&
                            unauthorizedResult == null &&
                            adminInboxRpcCount() === beforeUnauthorizedRpcCount &&
                            $("adminInboxBtn")?.classList.contains("hidden") &&
                            $("adminInboxBadge")?.textContent === "0" &&
                            !/Administrator Inbox/i.test(latestPopupText()),
                        `${unauthorized.label} cannot check or open the administrator inbox`,
                        {
                            user: unauthorized,
                            adminInboxRpcCount: adminInboxRpcCount(),
                        },
                    );
                    document.querySelectorAll(".popup-modal.open").forEach((popup) =>
                        popup.remove(),
                    );
                    const beforeUnauthorizedPublisherToolsCalls = supabaseCalls.length;
                    openMainMenuDataToolsModal();
                    devAssert(
                        !/Featured Content Publisher/i.test($("modalBox")?.textContent || "") &&
                            supabaseCalls.length === beforeUnauthorizedPublisherToolsCalls,
                        `${unauthorized.label} cannot see the dev-only Featured Content Publisher and causes no Supabase request`,
                        { user: unauthorized, supabaseCalls },
                    );
                    closeModal();
                }
                saveSupabaseSession({
                    access_token: "mock-feedback-access-token",
                    refresh_token: "mock-feedback-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "feedback-smoke-user", email: "feedback-smoke@example.com" },
                });
                openReportPublicStoryModal(storyEntry.id);
                const genreReason = [...document.querySelectorAll("[data-public-report-reason]")].find(input => input.value === "wrong_genre");
                devAssert(!!genreReason,"story reports include genre corrections");
                genreReason.checked = true;
                genreReason.dispatchEvent(new Event("change"));
                document.querySelectorAll(".popup-modal.open").forEach(popup => popup.remove());
                openReportPublicCharacterModal(characterEntry.id);

                const otherReason = [...document.querySelectorAll("[data-public-report-reason]")]
                    .find((input) => input.value === "other");
                otherReason.checked = true;
                $("submitPublicReportBtn").click();
                await new Promise((resolve) => setTimeout(resolve, 0));
                devAssert(
                    /Optional Description is required when Other is selected/i.test(latestPopupText()),
                    "public report Other reason requires a description",
                );
                document.querySelectorAll(".popup-modal.open").forEach((popup) => popup.remove());
                closeModal();

                devAssert(
                    !/Suggest Tags/i.test(latestPopupText()),
                    "public library detail/report flow no longer exposes the removed Suggest Tags UI",
                );
                addMessage("system", "Public library UI feedback smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: public-library-ui-feedback-smoke");
            } finally {
                fetchPublicLibraryIndex = originalFetchPublicLibraryIndex;
                replacePublicLibraryIndex = originalReplacePublicLibraryIndex;
                publicLibraryFetch = originalFetch;
                fetchJsonFromPublicUploadUrl = originalFetchJsonFromPublicUploadUrl;
                fetchVerifiedPublicLibraryPayload = originalFetchVerifiedPublicLibraryPayload;
                fetchCuratedJsonPayload = originalFetchCuratedJsonPayload;
                app.characterDefinitions = validatedCharacterLibraryDefinitions(
                    originalCharacterDefinitions,
                );
                app.profileImages = exactProfileImageStore(originalProfileImages);
                app.characterLibraryRecordsCache = null;
                app.storyTemplates = originalStoryTemplates;
                if (originalFeaturedPublisherDraft == null)
                    localStorage.removeItem(FEATURED_CONTENT_PUBLISHER_DRAFT_KEY);
                else
                    localStorage.setItem(
                        FEATURED_CONTENT_PUBLISHER_DRAFT_KEY,
                        originalFeaturedPublisherDraft,
                    );
                if (originalPublicLibraryQueryCache == null)
                    await largeStorageRemove(PUBLIC_LIBRARY_QUERY_CACHE_KEY);
                else
                    await largeStorageSet(
                        PUBLIC_LIBRARY_QUERY_CACHE_KEY,
                        originalPublicLibraryQueryCache,
                    );
                saveSupabaseSession(originalSession);
                app.reportManagerReviewHashHandled = false;
                if (originalHash) window.location.hash = originalHash;
                else clearReportManagerReviewHash();
            }
        }

        async function devRunPublicLibraryPublishMockSmokeTest() {
            devTestLog("Scenario start: public-library-publish-mock-smoke");
            devResetForLiveTest("public-library-publish-mock-smoke");
            devCreateTestProfile({  });
            const storyTemplateSnapshot = clone(
                await loadPerRecordLibrary(
                    STORY_TEMPLATE_KEY,
                    app.storyTemplates || [],
                    { deferStoryValidation: true },
                ),
            );
            const storyTitleCardImageSnapshot = clone(
                await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    app.storyTitleCardImages || [],
                ),
            );

            const originalUploadCompressedJson = uploadCompressedJson;
            const originalUploadBlobToUserUploads = uploadBlobToUserUploads;
            const originalFetchJsonFromPublicUploadUrl = fetchJsonFromPublicUploadUrl;
            const originalFetch = publicLibraryFetch;
            const originalWindowFetch = window.fetch;
            const originalWindowConfirm = window.confirm;
            const originalShowConfirm = showConfirm;
            const originalSelectedCreatorIdentity = selectedCreatorIdentity;
            const originalStoryPublishingAvailable = publicStoryPublishingAvailable;
            const originalCreatorIdentityRegistry = clone(creatorIdentityRegistry());
            const originalCreatorIdentityStorage = await largeStorageGet(
                CREATOR_IDENTITY_KEY,
            );
            const originalPublicLibraryQueryCacheStorage = await largeStorageGet(
                PUBLIC_LIBRARY_QUERY_CACHE_KEY,
            );
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalShowHostedShareResult = showHostedShareResult;
            const supabaseCalls = [];
            const insertedItems = [];
            const insertedVersions = [];
            const uploadedPayloads = [];
            const deletedUploads = [];
            const mockedOwnedItems = [];
            const mockedOwnedCountRows = {};
            const publicPublishProfileImageIds = new Set();
            let publicPublishCharacterRecordId = "";
            let publicPublishCharacterEntityId = "";

            const user = {
                id: "supabase-publish-smoke-user",
                email: "publish-smoke@example.com",
            };
            try {
                selectedCreatorIdentity = () => ({
                    creator_id: "00000000-0000-4000-8000-000000000041",
                    creator_name: "Public Publish Smoke Creator",
                });
                uploadCompressedJson = async (payload, label = "", options = {}) => {
                    uploadedPayloads.push({ payload, label, options: clone(options) });
                    const n = uploadedPayloads.length;
                    const compression = String(options.compression || "gzip");
                    const extension = compression === "brotli" ? ".json.br" : ".json.gz";
                    const result = {
                        fileName: `${safeArchiveFileName(label || "public-smoke")}-${n}${extension}`,
                        url: `https://example.com/${n}${extension}`,
                        deletionUrl: `https://example.com/delete/${n}`,
                        sha256: "a".repeat(64),
                        payloadSizeBytes: 1024,
                        compression,
                        expiresInSeconds: TEST_UPLOAD_EXPIRES_IN_SECONDS,
                    };
                    uploadedPayloads[uploadedPayloads.length - 1].fileName = result.fileName;
                    return result;
                };
                uploadBlobToUserUploads = async (blob, label = "", options = {}) => {
                    uploadedPayloads.push({
                        payload: { imageUpload: true, size: blob?.size || 0 },
                        label,
                        options: clone(options),
                    });
                    const n = uploadedPayloads.length;
                    return {
                        fileName: `${safeArchiveFileName(label || "public-image-smoke")}-${n}.png`,
                        url: `https://example.com/${n}.png`,
                        deletionUrl: `https://example.com/delete/${n}`,
                        size: blob?.size || 1,
                        expiresInSeconds: options.testUpload
                            ? TEST_UPLOAD_EXPIRES_IN_SECONDS
                            : null,
                    };
                };
                fetchJsonFromPublicUploadUrl = async (url = "") => {
                    const fileName = String(url || "").split("/").pop();
                    const match = uploadedPayloads.find(
                        (item) =>
                            item.fileName === fileName &&
                            item.payload &&
                            !item.payload.imageUpload,
                    );
                    if (!match) throw new Error(`Mock hosted payload not found for ${url}`);
                    return clone(match.payload);
                };
                window.fetch = async (url) => {
                    const cleanUrl = String(url).split("?")[0];
                    if (cleanUrl.startsWith("https://example.com/delete/")) {
                        deletedUploads.push(cleanUrl);
                        return { ok: true, status: 200, text: async () => "" };
                    }
                      if (/^https:\/\/example\.com\/[^?#]+\.png$/i.test(cleanUrl)) {
                        const blob = await fetch(
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                        ).then((res) => res.blob());
                          return {
                              ok: true,
                              status: 200,
                              headers: {
                                  get(name) {
                                      if (String(name).toLowerCase() === "content-type") return "image/png";
                                      if (String(name).toLowerCase() === "content-length") return String(blob.size);
                                      return null;
                                  },
                              },
                              blob: async () => blob,
                          };
                    }
                    const payloadMatch = cleanUrl.match(
                        /^https:\/\/example\.com\/(\d+)(\.json\.(?:gz|br)|\.bin)$/i,
                    );
                    if (payloadMatch) {
                        const upload = uploadedPayloads[Number(payloadMatch[1]) - 1];
                        if (!upload?.payload || upload.payload.imageUpload)
                            return { ok: false, status: 404, blob: async () => new Blob() };
                        const rawBlob = new Blob([JSON.stringify(upload.payload)], {
                            type: "application/json",
                        });
                        const format = payloadMatch[2].toLowerCase().endsWith(".br") ||
                            upload.options?.compression === "brotli"
                            ? "brotli"
                            : "gzip";
                        const compressedBlob = await compressBlobWithFormat(rawBlob, format);
                        const blob = payloadMatch[2].toLowerCase() === ".bin"
                            ? new Blob([await compressedBlob.arrayBuffer()], {
                                  type: "application/octet-stream",
                              })
                            : compressedBlob;
                        return { ok: true, status: 200, blob: async () => blob };
                    }
                    return originalWindowFetch(url);
                };
                window.confirm = () => true;
                saveSupabaseSession({
                    access_token: "mock-access-token",
                    refresh_token: "mock-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user,
                });
                publicLibraryFetch = async (path, options = {}) => {
                    supabaseCalls.push({ path, options: clone(options) });
                    if (path === "/auth/v1/user") return user;
                    if (path.startsWith("/rest/v1/creator_identities?select=")) return [];
                    if (path.startsWith("/rest/v1/creator_identities?on_conflict=") && options.method === "POST")
                        return [{ ...clone(options.body || {}), owner_user_id: user.id }];
                    if (
                        path === "/rest/v1/rpc/public_library_publish_preflight" &&
                        options.method === "POST"
                    ) {
                        const body = options.body || {};
                        const existing = [...mockedOwnedItems, ...insertedItems].find(
                            (item) =>
                                item.type === body.target_type &&
                                item.creator_id === body.target_creator_id &&
                                item.definition_id === body.target_definition_id,
                        );
                        if (["hidden", "flagged"].includes(existing?.visibility))
                            throw new Error(
                                `This public-library item was hidden and cannot be republished right now.${existing?.hidden_reason ? ` Reason: ${existing.hidden_reason}` : ""}`,
                            );
                        const cap = body.target_type === "character" ? 1000 : 100;
                        if (!existing && (mockedOwnedCountRows[body.target_type] || []).length >= cap)
                            throw new Error(publicLibraryCapMessage());
                        return { e: existing?.id || null, u: user.id };
                    }
                    if (
                        path === "/rest/v1/rpc/publish_public_library_item_version" &&
                        options.method === "POST"
                    ) {
                        const itemBody = clone(options.body?.item_payload || {});
                        const versionBody = clone(options.body?.version_payload || {});
                        let item = insertedItems.find(
                            (row) =>
                                row.type === itemBody.type &&
                                row.creator_id === itemBody.creator_id &&
                                row.definition_id === itemBody.definition_id,
                        );
                        const wasUpdate = !!item;
                        const previousVersionNumber = item
                            ? Math.max(
                                  0,
                                  ...insertedVersions
                                      .filter((version) => version.item_id === item.id)
                                      .map((version) => version.version_number),
                              )
                            : 0;
                        if (item) {
                            const retained = {
                                id: item.id,
                                owner_user_id: item.owner_user_id,
                                current_version_id: item.current_version_id,
                                visibility: item.visibility,
                            };
                            item = devSmokeSupabasePublicItemRow({
                                ...item,
                                ...itemBody,
                                ...retained,
                                updated_at: new Date().toISOString(),
                            });
                            insertedItems[insertedItems.findIndex((row) => row.id === item.id)] = item;
                        }
                        else {
                            item = devSmokeSupabasePublicItemRow({
                                ...itemBody,
                                id: `item-${insertedItems.length + 1}`,
                                owner_user_id: user.id,
                                current_version_id: null,
                                visibility: "public",
                            });
                            insertedItems.push(item);
                        }
                        const version = devSmokeSupabasePublicVersionRow({
                            payload_url: versionBody.payload_url,
                            payload_sha256: versionBody.payload_sha256,
                            payload_size_bytes: versionBody.payload_size_bytes,
                            image_url: versionBody.image_url,
                            change_summary: versionBody.change_summary,
                            id: `version-${insertedVersions.length + 1}`,
                            item_id: item.id,
                            version_number: previousVersionNumber + 1,
                            metadata_snapshot: publicLibraryVersionMetadataSnapshot(item),
                            created_at: new Date().toISOString(),
                        });
                        insertedVersions.push(version);
                        item.current_version_id = version.id;
                        return {
                            i: clone(item),
                            v: clone(version),
                            w: wasUpdate,
                            p: previousVersionNumber,
                            n: previousVersionNumber + 1,
                        };
                    }
                    if (path.startsWith("/rest/v1/library_uploader_limits?select=")) return [];
                    if (path.startsWith("/rest/v1/library_items?select=id&owner_user_id=")) {
                        const type = path.includes("&type=eq.character") ? "character" : "story";
                        return mockedOwnedCountRows[type] || [];
                    }
                    if (
                        path.startsWith("/rest/v1/library_items?select=") &&
                        path.includes("&owner_user_id=") &&
                        path.includes("&definition_id=eq.")
                    ) {
                        const definitionId = decodeURIComponent(
                            path.split("&definition_id=eq.")[1]?.split("&")[0] || "",
                        );
                        return mockedOwnedItems.filter((item) => {
                            return !definitionId || item.definition_id === definitionId;
                        });
                    }
                    if (path.startsWith("/rest/v1/library_items?select=") && !options.method) {
                        const id = decodeURIComponent(path.match(/[&?]id=eq\.([^&]+)/)?.[1] || "");
                        return id
                            ? insertedItems.filter((item) => item.id === id)
                            : insertedItems;
                    }
                    if (path.startsWith("/rest/v1/library_versions?select=") && !options.method) {
                        if (path.includes("&id=in.")) return insertedVersions;
                        if (path.includes("&item_id=eq.")) {
                            const itemId = decodeURIComponent(
                                path.match(/&item_id=eq\.([^&]+)/)?.[1] || "",
                            );
                            return insertedVersions.filter((version) => version.item_id === itemId);
                        }
                        return [];
                    }
                    if (path.startsWith("/rest/v1/library_items?select=") && options.method === "POST") {
                        const { created_at, ...itemBody } = clone(options.body || {});
                        const item = devSmokeSupabasePublicItemRow({
                            ...itemBody,
                            id: `item-${insertedItems.length + 1}`,
                            current_version_id: null,
                        });
                        insertedItems.push(item);
                        return [item];
                    }
                    if (path.startsWith("/rest/v1/library_versions?select=") && options.method === "POST") {
                        const { created_by_user_id, ...versionBody } = clone(options.body || {});
                        const version = devSmokeSupabasePublicVersionRow({
                            ...versionBody,
                            id: `version-${insertedVersions.length + 1}`,
                            created_at: new Date().toISOString(),
                        });
                        insertedVersions.push(version);
                        return [version];
                    }
                    if (path.startsWith("/rest/v1/library_items?select=") && options.method === "PATCH") {
                        const id = decodeURIComponent(path.match(/[&?]id=eq\.([^&]+)/)?.[1] || "");
                        const item =
                            insertedItems.find((row) => row.id === id) ||
                            insertedItems[insertedItems.length - 1];
                        Object.assign(item, clone(options.body || {}));
                        return [item];
                    }
                    if (path.startsWith("/rest/v1/library_items?id=eq.") && options.method === "DELETE") {
                        const id = decodeURIComponent(path.split("id=eq.")[1]?.split("&")[0] || "");
                        for (let i = insertedItems.length - 1; i >= 0; i--) {
                            if (insertedItems[i].id === id) insertedItems.splice(i, 1);
                        }
                        for (let i = insertedVersions.length - 1; i >= 0; i--) {
                            if (insertedVersions[i].item_id === id) insertedVersions.splice(i, 1);
                        }
                        return null;
                    }
                    if (path.startsWith("/rest/v1/library_items?select=id,name,type,owner_user_id,visibility,current_version_id&type=eq.character&name=eq.")) {
                        const name = decodeURIComponent(path.split("name=eq.")[1]?.split("&")[0] || "");
                        return insertedItems.filter(
                            (item) => item.type === "character" && item.name === name,
                        );
                    }
                    if (path.startsWith("/rest/v1/library_items?select=*&visibility=eq.public")) {
                        return insertedItems.map((item) => ({ ...item, visibility: item.visibility || "public" }));
                    }
                    if (path.startsWith("/rest/v1/library_versions?select=*&id=in.")) {
                        return insertedVersions;
                    }
                    if (
                        path === "/rest/v1/rpc/search_public_library_items" &&
                        options.method === "POST"
                    )
                        return [];
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected mocked Supabase publish call: ${options.method || "GET"} ${path}`);
                };
                showHostedShareResult = async () => {};

                saveSupabaseSession(null);
                const signedOutStory = devSmokeTemplateRecord({
                    id: "public-publish-signed-out-story-smoke",
                    title: "Public Publish Signed Out Story Smoke",
                    genres: ["fantasy"],
                    title_card_image: {
                        ...devSmokeTitleCardImage("Public Publish Signed Out Story Smoke"),
                        url: "https://example.com/signed-out-story.png",
                        prompt: "Signed-out story publish smoke title card.",
                    },
                });
                devUpsertStoryTemplatesForSmoke([signedOutStory]);
                const beforeSignedOutUploads = uploadedPayloads.length;
                const beforeSignedOutSupabaseCalls = supabaseCalls.length;
                await publishStoryTemplateToPublicIndex(signedOutStory.id, {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });

                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                const signedOutCharacter = devSmokeCharacterRecord("Public Publish Signed Out Character Smoke", {
                    character: {
                        ...devCompleteLibraryCharacterMetadata(),
                        source: "Original",
                        default_profile_image: {
                            ...devSmokeDefaultProfileImage(
                                "Public Publish Signed Out Character Smoke",
                                false,
                            ),
                            url: "https://example.com/signed-out-character.png",
                            prompt: "Signed-out character publish smoke default profile image.",
                            male: false,
                        },
                    },
                    record: {
                        ...devCompleteLibraryCharacterMetadata(),
                        source: "Original",
                    },
                });
                const beforeSignedOutCharacterUploads = uploadedPayloads.length;
                const beforeSignedOutCharacterSupabaseCalls = supabaseCalls.length;
                await publishCharacterRecordsToPublicIndex([signedOutCharacter], "signed-out character smoke", {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });

                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());

                saveSupabaseSession({
                    access_token: "mock-access-token",
                    refresh_token: "mock-refresh-token",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user,
                });
                const beforeOrdinaryUploads = uploadedPayloads.length;
                const beforeOrdinaryCalls = supabaseCalls.length;
                await publishStoryTemplateToPublicIndex("ordinary-account-gate-smoke", { skipPublishConfirm: true });

                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                //Exercise the publishing pipeline with a synthetic authorized account and mocked services.
                publicStoryPublishingAvailable = () => true;
                const confirmCancelStory = devSmokeTemplateRecord({
                    id: "public-publish-confirm-cancel-story-smoke",
                    title: "Public Publish Confirm Cancel Story Smoke",
                    title_card_image: {
                        ...devSmokeTitleCardImage("Public Publish Confirm Cancel Story Smoke"),
                        url: "https://example.com/confirm-cancel-story.png",
                    },
                });
                devUpsertStoryTemplatesForSmoke([confirmCancelStory]);
                const beforeConfirmCancelUploads = uploadedPayloads.length;
                const publishConfirmPromise = confirmPublicLibraryPublish(
                    "story",
                    confirmCancelStory.title,
                );
                const publishConfirmPopup = [...document.querySelectorAll(".popup-modal.open")].at(-1);
                const publishConfirmText = publishConfirmPopup?.textContent || "";
                const publishConfirmButton = publishConfirmPopup?.querySelector("[data-public-publish-confirm]");
                devAssert(
                    /Publish Publicly/i.test(publishConfirmText) &&
                        /Public Publish Confirm Cancel Story Smoke/.test(publishConfirmText) &&
                        /real people/i.test(publishConfirmText) &&
                        /underage-looking/i.test(publishConfirmText) &&
                        publishConfirmButton?.disabled === true &&
                        uploadedPayloads.length === beforeConfirmCancelUploads,
                    "public publish confirmation states ownership and content rules and requires explicit acceptance",
                    { publishConfirmText, uploadedPayloads },
                );
                publishConfirmPopup?.querySelector("[data-public-publish-cancel]")?.click();
                devAssert((await publishConfirmPromise) === false, "public publish confirmation cancellation resolves without publishing");
                const sourceStory = devSmokeTemplateRecord({
                    id: "public-publish-source-story-smoke",
                    title: "Public Publish Source Story Smoke",
                    source: "Borderlands",
                    genres: ["sci-fi"],
                    title_card_image: {
                        ...devSmokeTitleCardImage("Public Publish Source Story Smoke"),
                        url: "https://example.com/source-story.png",
                    },
                });
                devUpsertStoryTemplatesForSmoke([sourceStory]);
                const beforeSourceUploads = uploadedPayloads.length;
                const beforeSourceSupabaseCalls = supabaseCalls.length;
                await publishStoryTemplateToPublicIndex(sourceStory.id, {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });
                devAssert(
                    uploadedPayloads.length === beforeSourceUploads &&
                        supabaseCalls.length === beforeSourceSupabaseCalls &&
                        /Source-based stories and characters can be used locally, but cannot be published/i.test(
                            document.querySelector(".popup-modal.open")?.textContent || "",
                        ),
                    "public publish blocks source-based stories before Perchance upload or Supabase write",
                    { uploadedPayloads, supabaseCalls, popupText: document.querySelector(".popup-modal.open")?.textContent || "" },
                );
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                mockedOwnedCountRows.character = Array.from({ length: 1000 }, (_, index) => ({
                    id: `owned-character-${index}`,
                }));
                const capCharacter = devSmokeCharacterRecord("Public Publish Cap Character Smoke", {
                    character: {
                        ...devCompleteLibraryCharacterMetadata(),
                        name: "Public Publish Cap Character Smoke",
                    },
                    record: devCompleteLibraryCharacterMetadata(),
                });
                const beforeCapUploads = uploadedPayloads.length;
                await publishCharacterRecordsToPublicIndex([capCharacter], "cap character smoke", {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });
                devAssert(
                    uploadedPayloads.length === beforeCapUploads &&
                        /publishing cap/i.test(
                            document.querySelector(".popup-modal.open")?.textContent || "",
                        ),
                    "public publish blocks users over the character cap before upload",
                    { mockedOwnedCountRows, popupText: document.querySelector(".popup-modal.open")?.textContent || "" },
                );
                mockedOwnedCountRows.character = [];
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                mockedOwnedItems.push(devSmokeSupabasePublicItemRow({
                    id: "hidden-owned-story-smoke",
                    owner_user_id: user.id,
                    type: "story",
                    definition_id: "public-publish-hidden-story-smoke",
                    title: "Hidden Public Publish Story Smoke",
                    creator: "Public Publish Smoke Creator",
                    creator_id: "00000000-0000-4000-8000-000000000041",
                    source: "Original",
                    visibility: "hidden",
                    hidden_reason: "under review",
                }));
                const hiddenStory = devSmokeTemplateRecord({
                    id: "public-publish-hidden-story-smoke",
                    title: "Hidden Public Publish Story Smoke",
                    source: "Original",
                    genres: ["fantasy"],
                    title_card_image: {
                        ...devSmokeTitleCardImage("Public Publish Hidden Story Smoke"),
                        url: "https://example.com/hidden-story.png",
                    },
                });
                devUpsertStoryTemplatesForSmoke([hiddenStory]);
                const beforeHiddenUploads = uploadedPayloads.length;
                await publishStoryTemplateToPublicIndex(hiddenStory.id, {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });
                devTestLog("Hidden story publish result", {
                    popupText: document.querySelector(".popup-modal.open")?.textContent || "",
                    uploadedPayloadCount: uploadedPayloads.length,
                    recentSupabaseCalls: supabaseCalls.slice(-8),
                });
                devAssert(
                    uploadedPayloads.length === beforeHiddenUploads &&
                        /hidden and cannot be republished/i.test(
                            document.querySelector(".popup-modal.open")?.textContent || "",
                        ) &&
                        /under review/i.test(
                            document.querySelector(".popup-modal.open")?.textContent || "",
                        ),
                    "public publish blocks same-user updates to hidden reported items before upload",
                    { mockedOwnedItems, popupText: document.querySelector(".popup-modal.open")?.textContent || "" },
                );
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                const story = devSmokeTemplateRecord({
                    id: "public-publish-story-smoke",
                    title: "Public Publish Story Smoke",
                    genres: ["fantasy"],
                    title_card_image: {
                        ...devSmokeTitleCardImage("Public Publish Story Smoke"),
                        prompt: "Public Publish Story Smoke title card.",
                        seed: 7,
                    },
                    messages: [
                        {
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Opening message.",
                        },
                    ],
                });
                story.state ||= {};
                story.state.meta ||= {};
                story.state.characters ||= {};

                devUpsertStoryTemplatesForSmoke([story]);
                const normalizedPublishStory = storyTemplateById(story.id);
                const localStoryTitleCardId = "public-publish-story-local-title-card";
                replaceStoryTitleCardStoreImages(normalizedPublishStory, [
                    {
                        id: localStoryTitleCardId,
                        html: '<img alt="story title card" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
                        prompt: "Public Publish Story Smoke local title card.",
                        seed: 7,
                        favorite: false,
                    },
                ]);
                normalizedPublishStory.title_card_image = createStoryTitleCardImageSlot(
                    { id: localStoryTitleCardId, prompt: "Public Publish Story Smoke local title card.", seed: 7 },
                    normalizedPublishStory.state,
                    normalizedPublishStory,
                );
                const beforeStoryUploadCount = uploadedPayloads.length;
                const beforeStoryDeletedUploadCount = deletedUploads.length;
                await publishStoryTemplateToPublicIndex(story.id, {
                    testUpload: true,
                    cleanupAfterPublish: true,
                    skipPublishConfirm: true,
                });
                const storyUploads = uploadedPayloads.slice(beforeStoryUploadCount);
                const storyDeletedUploads = deletedUploads.slice(beforeStoryDeletedUploadCount);
                const storyPayloadUpload = storyUploads.find(
                    (item) => item.payload?.exportType === "story-template",
                );
                const storyImageUpload = storyUploads.find((item) => item.payload?.imageUpload);
                const postedStoryPublish = supabaseCalls.find(
                    (call) =>
                        call.path === "/rest/v1/rpc/publish_public_library_item_version" &&
                        call.options.method === "POST" &&
                        call.options.body?.item_payload?.type === "story",
                )?.options.body;
                const postedStoryItem = postedStoryPublish?.item_payload;
                const postedStoryVersion = postedStoryPublish?.version_payload;
                if (!storyPayloadUpload || !storyImageUpload || !postedStoryItem || !postedStoryVersion)
                    devTestLog("Public story publish mismatch", {
                        storyUploads,
                        supabaseCalls,
                        storageFailureText: (app.storageFailures || []).slice(-3)
                            .map((failure) => `${failure.key}: ${failure.message}`)
                            .join(" | "),
                        popupText:
                            [...document.querySelectorAll(".popup-modal.open")].at(-1)
                                ?.textContent || "",
                    });
                devTestLog("Public story publish assertion inputs", {
                    storyPayloadUpload,
                    storyImageUpload,
                    postedStoryItem,
                    postedStoryVersion,
                    deleteCalls: supabaseCalls.filter((call) => call.options.method === "DELETE"),
                    popupText: [...document.querySelectorAll(".popup-modal.open")].at(-1)?.textContent || "",
                    mutationCalls: supabaseCalls.filter((call) => call.options.method),
                });
                const publishedStoryExportValidation = validateStoryExport(
                    storyPayloadUpload?.payload,
                );
                devAssert(
                    publishedStoryExportValidation.ok,
                    "mocked public story publish uploads the exact canonical story export accepted by import",
                    {
                        payloadKeys: Object.keys(storyPayloadUpload?.payload || {}),
                        errors: publishedStoryExportValidation.errors,
                    },
                );
                const storyPayloadIndex = uploadedPayloads.indexOf(storyPayloadUpload) + 1;
                const verifiedHostedStoryPayload = await fetchVerifiedPublicLibraryPayload({
                    url: `https://example.com/${storyPayloadIndex}.bin`,
                });
                const verifiedHostedStoryValidation = validateStoryExport(
                    verifiedHostedStoryPayload,
                );
                devAssert(
                    verifiedHostedStoryValidation.ok &&
                        !("schemaVersion" in verifiedHostedStoryPayload) &&
                        !("publicLibrary" in verifiedHostedStoryPayload),
                    "hosted payload byte verification detects Brotli behind an extensionless Perchance URL and preserves the exact canonical story export for the importer",
                    {
                        payloadKeys: Object.keys(verifiedHostedStoryPayload || {}),
                        errors: verifiedHostedStoryValidation.errors,
                    },
                );
                const publishedStoryTemplate = storyPayloadUpload?.payload?.storyTemplate || {};
                const publishedStoryMessage = publishedStoryTemplate.messages?.[0] || {};
                devAssert(
                    storyDeletedUploads.length === 2,
                    "mocked public story publish deletes the Perchance story payload and title-card test uploads after cleanup",
                    { storyDeletedUploads, storyUploads },
                );

                const characterRecord = devSmokeCharacterRecord("Public Publish Character Smoke", {
                    character: {
                        ...devCompleteLibraryCharacterMetadata(),
                    },
                    record: devCompleteLibraryCharacterMetadata(),
                });
                publicPublishCharacterRecordId = String(characterRecord.id || "");
                publicPublishCharacterEntityId = String(characterRecord.character?.id || "");
                const hostedProfileProjection = applyHostedImageMetadata(
                    createProfileImageRecord({
                        id: "public-publish-hosted-profile-projection-smoke",
                        character_id: characterRecord.character.id,
                        male: false,
                    }),
                    {
                        url: "https://example.com/public-publish-hosted-profile-projection.png",
                        size: 123,
                    },
                );
                devAssert(
                    validateProfileImageStore([hostedProfileProjection]).ok &&
                        hostedProfileProjection.html ===
                            "https://example.com/public-publish-hosted-profile-projection.png" &&
                        hostedProfileProjection.hosted_url ===
                            "https://example.com/public-publish-hosted-profile-projection.png",
                    "public character publishing constructs an exact profile-image record before persisting hosted metadata",
                    { hostedProfileProjection },
                );
                const stringLikeHostedProfileProjection = applyHostedImageMetadata(
                    createProfileImageRecord({
                        id: "public-publish-string-like-hosted-profile-smoke",
                        character_id: characterRecord.character.id,
                        male: false,
                    }),
                    {
                        url: perchanceUploadUrlText(
                            new String(
                                "https://example.com/public-publish-string-like-hosted-profile.png",
                            ),
                            "String-like public profile smoke upload",
                        ),
                        size: 124,
                    },
                );
                devAssert(
                    validateProfileImageStore([stringLikeHostedProfileProjection]).ok &&
                        typeof stringLikeHostedProfileProjection.html === "string" &&
                        typeof stringLikeHostedProfileProjection.hosted_url === "string" &&
                        stringLikeHostedProfileProjection.html ===
                            "https://example.com/public-publish-string-like-hosted-profile.png",
                    "public character publishing converts Perchance string-like upload URLs to primitive text before persistence",
                    { stringLikeHostedProfileProjection },
                );
                const malformedTransportImage = createProfileImageRecord({
                    id: "public-publish-malformed-transport-profile-smoke",
                    character_id: characterRecord.character.id,
                    owner_name: characterRecord.character.name,
                    male: false,
                    html: `<img src="${devSmokeOnePixelDataUrl()}" alt="Malformed transport profile smoke">`,
                });
                malformedTransportImage.html = new String(malformedTransportImage.html);
                malformedTransportImage.hosted_url = undefined;
                app.profileImages.unshift(malformedTransportImage);
                publicPublishProfileImageIds.add(String(malformedTransportImage.id || ""));
                const malformedTransportCharacter = {
                    ...characterRecord.character,
                    default_profile_image: profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(false),
                        local_image_id: malformedTransportImage.id,
                        source: "malformed transport smoke",
                        male: false,
                    }),
                    profile_image_presentations: createProfileImagePresentations({
                        non_male: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(false),
                            local_image_id: malformedTransportImage.id,
                            source: "malformed transport smoke",
                            male: false,
                        }),
                    }),
                };
                const malformedTransportResult =
                    await uploadCharacterProfilePresentationForPublic(
                        malformedTransportCharacter,
                        false,
                        "Malformed Transport Profile Smoke",
                        { testUpload: true },
                    );
                const repairedTransportImage = profileImageByStoreId(
                    malformedTransportImage.id,
                );
                devAssert(
                    validateProfileImageStore([repairedTransportImage]).ok &&
                        typeof repairedTransportImage.html === "string" &&
                        typeof repairedTransportImage.hosted_url === "string" &&
                        /^https:\/\/example\.com\/\d+\.png$/.test(
                            malformedTransportResult.slot.url,
                        ),
                    "public character publishing repairs internal image transport fields through the exact record constructor before upload persistence",
                    { repairedTransportImage, malformedTransportResult },
                );
                const characterProfileImage =
                    upsertProfileStoreImage(
                        createProfileImageRecord({
                            id: "public-publish-default-profile-smoke",
                            character_id: characterRecord.character.id,
                            owner_name: "Public Publish Character Smoke",
                            source: "smoke default",
                            model: "debug",
                            seed: 42,
                            prompt: "Public publish default profile image.",
                            negativePrompt: "",
                            html: '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Public publish default image">',
                            profile: true,
                            male: false,
                        }),
                        "Public Publish Character Smoke",
                    ) || {};
                publicPublishProfileImageIds.add(String(characterProfileImage.id || ""));
                characterRecord.character.default_profile_image = profileImageSlotFromExactInput({
                    ...emptyProfileImageSlot(false),
                    local_image_id: characterProfileImage.id,
                    source: "smoke default",
                    seed: 42,
                    prompt: "Public publish default profile image.",
                    male: false,
                });
                const storedPublishCharacter = upsertCharacterLibraryDefinition(characterRecord);
                const displayedPublishCharacter = characterLibraryRecordById(
                    characterLibraryRecordId(storedPublishCharacter),
                );
                const canonicalPublishCharacter = storedCharacterLibraryRecord(
                    displayedPublishCharacter,
                );
                devAssert(
                    displayedPublishCharacter?.kind === "definition" &&
                        displayedPublishCharacter?.entity === displayedPublishCharacter?.character &&
                        !("kind" in canonicalPublishCharacter) &&
                        !("entity" in canonicalPublishCharacter) &&
                        validateCharacterLibraryRecord(canonicalPublishCharacter).ok,
                    "character-library publish resolves its decorated card model back to the strict stored record",
                    {
                        displayedKeys: Object.keys(displayedPublishCharacter || {}),
                        canonicalKeys: Object.keys(canonicalPublishCharacter || {}),
                    },
                );
                const characterPreflight = publicLibraryCharacterMetadata(characterRecord, "pending");
                devAssert(
                    !!characterPreflight &&
                        !publicLibraryPublishPolicyErrors(characterPreflight).length,
                    "mocked public character publish preflight metadata is complete",
                    {
                        characterPreflight,
                        errors: characterPreflight
                            ? publicLibraryPublishPolicyErrors(characterPreflight)
                            : ["metadata did not normalize"],
                        characterRecord,
                    },
                );
                const missingDefaultImageRecord = devSmokeCharacterRecord("Public Publish Missing Default Image Smoke", {
                    character: {
                        ...devCompleteLibraryCharacterMetadata(),
                        name: "Public Publish Missing Default Image Smoke",
                    },
                    record: devCompleteLibraryCharacterMetadata(),
                });
                missingDefaultImageRecord.character.default_profile_image =
                    profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(false),
                        local_image_id: "missing-public-default-image-smoke",
                        source: "missing smoke default",
                        prompt: "Missing default image should block public publish.",
                        male: false,
                    });
                missingDefaultImageRecord.character.profile_image_presentations =
                    createProfileImagePresentations({
                        male: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(true),
                            local_image_id: "missing-public-male-profile-smoke",
                            source: "missing smoke default",
                            prompt: "Missing male image should block public publish.",
                            male: true,
                        }),
                        non_male: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(false),
                            local_image_id: "missing-public-default-image-smoke",
                            source: "missing smoke default",
                            prompt: "Missing non-male image should block public publish.",
                            male: false,
                        }),
                    });
                const uploadCountBeforeMissingDefault = uploadedPayloads.length;
                const insertedCountBeforeMissingDefault = insertedItems.length;
                await publishCharacterRecordsToPublicIndex(
                    [missingDefaultImageRecord],
                    "missing default image character smoke",
                    {
                        testUpload: true,
                        cleanupAfterPublish: false,
                        skipPublishConfirm: true,
                    },
                );
                devAssert(
                    uploadedPayloads.length === uploadCountBeforeMissingDefault &&
                        insertedItems.length === insertedCountBeforeMissingDefault,
                    "mocked public character publish refuses local default-image ids that cannot be resolved before uploading JSON or writing Supabase",
                    {
                        uploadedPayloads,
                        insertedItems,
                        missingDefaultImageRecord,
                    },
                );
                const noDefaultImageRecord = devSmokeCharacterRecord("Public Publish No Default Image Smoke", {
                    character: {
                        ...devCompleteLibraryCharacterMetadata(),
                        name: "Public Publish No Default Image Smoke",
                    },
                    record: devCompleteLibraryCharacterMetadata(),
                });
                noDefaultImageRecord.character.default_profile_image =
                    profileImageSlotFromExactInput(emptyProfileImageSlot(false));
                noDefaultImageRecord.character.profile_image_presentations =
                    createProfileImagePresentations({});
                const uploadCountBeforeNoDefault = uploadedPayloads.length;
                const insertedCountBeforeNoDefault = insertedItems.length;
                await publishCharacterRecordsToPublicIndex(
                    [noDefaultImageRecord],
                    "no default image character smoke",
                    {
                        testUpload: true,
                        cleanupAfterPublish: false,
                        skipPublishConfirm: true,
                    },
                );
                devAssert(
                    uploadedPayloads.length === uploadCountBeforeNoDefault &&
                        insertedItems.length === insertedCountBeforeNoDefault,
                    "mocked public character publish refuses characters with no default image before uploading JSON or writing Supabase",
                    {
                        uploadedPayloads,
                        insertedItems,
                        noDefaultImageRecord,
                    },
                );
                const publishResult = await publishCharacterRecordsToPublicIndex([characterRecord], "public publish character smoke", {
                    testUpload: true,
                    cleanupAfterPublish: false,
                    skipPublishConfirm: true,
                });
                const characterPayloadUpload = uploadedPayloads.find(
                    (item) => item.label === "Public character upload",
                );
                const publishedCharacter =
                    characterPayloadUpload?.payload?.characters?.[0]?.character_definition ||
                    characterPayloadUpload?.payload?.character_definition ||
                    characterPayloadUpload?.payload?.characterExport?.characters?.[0]?.character_definition ||
                    characterPayloadUpload?.payload?.characterExport?.character_definition;
                devTestLog("Public character publish assertion inputs", {
                    publishResult,
                    publishedCharacter,
                    characterPayloadUpload,
                    uploadTypes: JSON.stringify(uploadedPayloads.map((item) => ({
                        exportType: item.payload?.exportType || "",
                        label: item.label,
                        imageUpload: item.payload?.imageUpload === true,
                    }))),
                    popupText: [...document.querySelectorAll(".popup-modal.open")].at(-1)?.textContent || "",
                    mutationCalls: supabaseCalls.filter((call) => call.options.method),
                });
                const localDefinitionCountBeforePublicImport = (app.characterDefinitions || []).length;
                app.characterDefinitions = (app.characterDefinitions || []).filter(
                    (record) => record.name !== "Public Publish Character Smoke",
                );
                const publicPayload = await fetchJsonFromPublicUploadUrl(publishResult?.entries?.[0]?.url);
                await devImportCharacterDefinitionsFromRecords(
                    characterImportRecordsFromExport(publicPayload),
                );
                const downloadedDefinition = (app.characterDefinitions || []).find(
                    (record) => record.name === "Public Publish Character Smoke",
                );
                for (const image of app.profileImages || []) {
                    if (
                        String(image?.character_id || "") ===
                        publicPublishCharacterEntityId
                    )
                        publicPublishProfileImageIds.add(String(image.id || ""));
                }
                devAssert(
                    !!downloadedDefinition?.character?.default_profile_image?.url &&
                        !!downloadedDefinition?.character?.default_profile_image?.local_image_id &&
                        !!profileImageByStoreId(downloadedDefinition.character.default_profile_image.local_image_id) &&
                        isPlainObject(downloadedDefinition?.character?.profile_images) &&
                        downloadedDefinition.character.profile_images.active_image_id ===
                            downloadedDefinition.character.default_profile_image.local_image_id &&
                        downloadedDefinition.character.profile_images.image_ids?.includes(
                            downloadedDefinition.character.default_profile_image.local_image_id,
                        ) &&
                        isPlainObject(downloadedDefinition?.character?.images) &&
                        !downloadedDefinition.character.images.active_image_id &&
                        downloadedDefinition.character.images.image_ids?.length === 0,
                    "mocked public character download imports the clean definition, copies the hosted default image locally, and keeps image history out of the definition",
                    { downloadedDefinition, publicPayload, localDefinitionCountBeforePublicImport },
                );
                await cleanupPublicLibrarySupabaseResults(publishResult?.result?.results || []);
                await cleanupHostedUploads(
                    [publishResult?.upload, ...(publishResult?.imageUploads || [])],
                    "Public character smoke upload",
                );
                app.characterDefinitions = (app.characterDefinitions || []).filter(
                    (record) => record.name !== "Public Publish Character Smoke",
                );
                devAssert(
                    deletedUploads.length >= 3,
                    "mocked public character publish deletes hosted test uploads without losing prior story cleanup deletes",
                    { deletedUploads, uploadedPayloads },
                );
                const missingTitleImageStory = devSmokeTemplateRecord({
                    id: "public-publish-missing-title-image-smoke",
                    title: "Missing Title Image Public Story",
                    genres: ["fantasy"],
                    creation_tool: "EmberAdventures Smoke",
                    title_card_image: emptyStoryTitleCardImageSlot(),
                });
                devUpsertStoryTemplatesForSmoke([missingTitleImageStory]);
                const beforeMissingTitleImageUploads = uploadedPayloads.length;
                const beforeMissingTitleImageItems = insertedItems.length;
                await publishStoryTemplateToPublicIndex(missingTitleImageStory.id, { skipPublishConfirm: true });
                devAssert(
                    uploadedPayloads.length === beforeMissingTitleImageUploads &&
                        insertedItems.length === beforeMissingTitleImageItems,
                    "public publish rejects stories with no title-card/default image before mocked upload/index write",
                    { insertedItems, uploadedPayloads, missingTitleImageStory },
                );

                addMessage("system", "Public library publish mock smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: public-library-publish-mock-smoke");
            } finally {
                let publicPublishLocalCleanupError = null;
                try {
                    for (const image of app.profileImages || []) {
                        if (
                            publicPublishCharacterEntityId &&
                            String(image?.character_id || "") ===
                                publicPublishCharacterEntityId
                        )
                            publicPublishProfileImageIds.add(String(image.id || ""));
                    }
                    publicPublishProfileImageIds.delete("");
                    if (publicPublishProfileImageIds.size) {
                        await deletePerRecordLibraryRecords(
                            PROFILE_IMAGE_KEY,
                            [...publicPublishProfileImageIds].map((id) => ({ id })),
                        );
                        app.profileImages = exactProfileImageStore(
                            (app.profileImages || []).filter(
                                (image) =>
                                    !publicPublishProfileImageIds.has(String(image.id || "")),
                            ),
                        );
                    }
                    if (publicPublishCharacterRecordId) {
                        await deletePerRecordLibraryRecords(
                            CHARACTER_LIBRARY_KEY,
                            [{ id: publicPublishCharacterRecordId }],
                        );
                        app.characterDefinitions = validatedCharacterLibraryDefinitions(
                            (app.characterDefinitions || []).filter(
                                (record) =>
                                    String(record.id || "") !==
                                    publicPublishCharacterRecordId,
                            ),
                        );
                    }
                    await flushLargeSaves();
                    const remainingPublicPublishCharacters = publicPublishCharacterRecordId
                        ? (await loadPerRecordLibrary(
                            CHARACTER_LIBRARY_KEY,
                            app.characterDefinitions || [],
                            { deferDefinitionValidation: true },
                        )).filter(
                            (record) =>
                                String(record.id || "") ===
                                publicPublishCharacterRecordId,
                        )
                        : [];
                    const remainingPublicPublishProfileImages = publicPublishProfileImageIds.size
                        ? (await loadPerRecordLibrary(
                            PROFILE_IMAGE_KEY,
                            app.profileImages || [],
                        )).filter((image) =>
                            publicPublishProfileImageIds.has(String(image.id || "")),
                        )
                        : [];
                    if (
                        remainingPublicPublishCharacters.length ||
                        remainingPublicPublishProfileImages.length
                    )
                        throw new Error(
                            `Public publish mock smoke cleanup left ${remainingPublicPublishCharacters.length} character record(s) and ${remainingPublicPublishProfileImages.length} profile image record(s).`,
                        );
                } catch (error) {
                    publicPublishLocalCleanupError = error;
                }
                await devRestoreStoryTemplatesForSmoke(
                    storyTemplateSnapshot,
                    "public publish mock smoke restored story templates",
                );
                await devRestoreStoryTitleCardImagesForSmoke(
                    storyTitleCardImageSnapshot,
                    "public publish mock smoke restored title images",
                );

                uploadCompressedJson = originalUploadCompressedJson;
                uploadBlobToUserUploads = originalUploadBlobToUserUploads;
                fetchJsonFromPublicUploadUrl = originalFetchJsonFromPublicUploadUrl;
                publicLibraryFetch = originalFetch;
                window.fetch = originalWindowFetch;
                window.confirm = originalWindowConfirm;
                showConfirm = originalShowConfirm;
                selectedCreatorIdentity = originalSelectedCreatorIdentity;
                publicStoryPublishingAvailable = originalStoryPublishingAvailable;
                app.creatorIdentityRegistry = exactCreatorIdentityRegistry(
                    originalCreatorIdentityRegistry,
                );
                if (originalCreatorIdentityStorage === undefined)
                    await awaitLargeStorageRemove(CREATOR_IDENTITY_KEY);
                else
                    await awaitLargeStorageSet(
                        CREATOR_IDENTITY_KEY,
                        originalCreatorIdentityStorage,
                        { json: true },
                    );
                if (originalPublicLibraryQueryCacheStorage === undefined)
                    await awaitLargeStorageRemove(PUBLIC_LIBRARY_QUERY_CACHE_KEY);
                else
                    await awaitLargeStorageSet(
                        PUBLIC_LIBRARY_QUERY_CACHE_KEY,
                        originalPublicLibraryQueryCacheStorage,
                        { json: true },
                    );
                saveSupabaseSession(originalSession);
                showHostedShareResult = originalShowHostedShareResult;
                if (publicPublishLocalCleanupError)
                    throw publicPublishLocalCleanupError;
            }
        }

        async function devRunPromptEditorSmokeTest() {
            devTestLog("Scenario start: prompt-editor-smoke");
            devResetForLiveTest("prompt-editor-smoke");
            devCreateTestProfile({  });
            app.settings.devMode = false;
            openMainMenuDataToolsModal();
            devAssert(
                !/Prompt Editor/i.test($("modalBox")?.textContent || ""),
                "main menu Tools hides Prompt Editor when dev mode is off",
            );
            app.settings.devMode = true;
            app.promptEditor = {
                tab: "text",
                transcript: [],
                lastSource: null,
                sending: false,
            };
            app.state = devMakeSceneControlState({  });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "The test scene is ready.",
                    at: new Date().toISOString(),
                },
                {
                    id: nextEntryId(),
                    role: "user",
                    speaker: app.state.player.name,
                    text: "I test the badge.",
                    at: new Date().toISOString(),
                },
            ];
            app.state.npc_directory ||= { locations: {} };
            app.state.npc_directory.locations ||= {};
            app.state.npc_directory.locations["Test Town"] = {
                characters: {
                    "Mira Voss": {
                        name: "Mira Voss",
                        gender: "female",
                        role: "guard",
                        relationship: "unknown",
                        note: "Visible guard shell.",
                        inspected: false,
                    },
                },
            };
            const originalSupabaseSignedInUser = supabaseSignedInUser;
            const originalRunAiTextNow = runAiTextNow;
            const originalGenerateImageHtml = generateImageHtml;
            const aiCalls = [];
            const imageCalls = [];
            try {
                for (const user of [null, { id: "smoke-non-owner", email: "smoke@example.com" }]) {
                    supabaseSignedInUser = () => user;
                    openMainMenuDataToolsModal();
                    devAssert(
                        !/Prompt Editor/i.test($("modalBox")?.textContent || ""),
                        "Prompt Editor stays hidden without the signed-in official developer account",
                    );
                }

                supabaseSignedInUser = () => ({
                    id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                    email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                });
                runAiTextNow = async (instruction, opts = {}) => {
                    aiCalls.push({ instruction, opts });
                    if (typeof opts.onStream === "function") {
                        opts.onStream("prompt editor streamed partial", "prompt editor streamed partial", false);
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                    if (app.settings?.devMode) {
                        rememberPromptEditorAiCall("text", {
                            label: opts.label || "mocked ai",
                            promptType: opts.label || "mocked ai",
                            prompt: String(instruction || ""),
                            options: clone(opts || {}),
                            response: "prompt editor raw response",
                            at: new Date().toISOString(),
                        });
                    }
                    return "prompt editor raw response";
                };
                generateImageHtml = async (prompt, negativePrompt, seed, model, options = {}) => {
                    imageCalls.push({ prompt, negativePrompt, seed, model, options });
                    return '<img alt="prompt editor preview" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
                };
                openMainMenuDataToolsModal();
                devAssert(
                    /Prompt Editor/i.test($("modalBox")?.textContent || ""),
                    "main menu Tools shows Prompt Editor for the signed-in official developer in dev mode",
                );
                openPromptEditorModal();
                devAssert(
                    $("modalBox")?.matches?.("[data-prompt-editor-modal='1']") &&
                        /Text/i.test($("modalBox")?.textContent || "") &&
                        /Images/i.test($("modalBox")?.textContent || "") &&
                        /Shell/i.test($("modalBox")?.textContent || "") &&
                        /Last/i.test($("modalBox")?.textContent || ""),
                    "Prompt Editor opens fullscreen with Text and Images tabs and per-prompt Shell/Last buttons",
                );
                loadPromptEditorSource("text", "auto-player", "shell");
                {
                    const autoPlayerEditorPrompt = String($("promptEditorText")?.value || "");
                    devAssert(
                        /PROMPT SHELL:\s*Auto player turn/i.test(autoPlayerEditorPrompt) &&
                            /buildAutoPlayerTurnPrompt/i.test(autoPlayerEditorPrompt) &&
                            /COMMENT: scene\/player\/party\/NPC\/objective context/i.test(autoPlayerEditorPrompt),
                        "Prompt Editor auto player Shell source describes the runtime data that fills the prompt",
                        { promptStart: autoPlayerEditorPrompt.slice(0, 1600) },
                    );
                }
                loadPromptEditorSource("text", "character-reply", "shell");
                devAssert(
                    /PROMPT SHELL:\s*Character reply/i.test(String($("promptEditorText")?.value || "")) &&
                        /buildReplyInstruction/i.test(String($("promptEditorText")?.value || "")),
                    "Prompt Editor text source loads a documented shell prompt",
                );
                loadPromptEditorSource("text", "scene-removal-check", "shell");
                devAssert(
                    /scene-presence cleanup checker/i.test(String($("promptEditorText")?.value || "")) &&
                        /\{"p":\["Party Member Name"\],"n":\["NPC Name"\],"e":/.test(String($("promptEditorText")?.value || "")),
                    "Prompt Editor text sources include scene removal check shell with compact output shape",
                    $("promptEditorText")?.value || "",
                );
                loadPromptEditorSource("text", "character-reply", "shell");
                await sendPromptEditorText();
                devAssert(
                    aiCalls.length === 1 &&
                        /prompt editor raw response/i.test($("modalBox")?.textContent || "") &&
                        /#1/.test($("modalBox")?.textContent || "") &&
                        /#2/.test($("modalBox")?.textContent || "") &&
                        !app.messages.some((message) => /prompt editor raw response/i.test(message.text || "")),
                    "Prompt Editor streams then displays raw text directly with numbered messages without mutating chat",
                    { aiCalls, messages: app.messages },
                );
                const transcriptAfterSend = app.promptEditor?.transcript || [];
                devAssert(
                    transcriptAfterSend.some(
                        (item) =>
                            item.kind === "sent" &&
                            /Character reply|narrator response/i.test(item.title || ""),
                    ) &&
                        transcriptAfterSend.some(
                            (item) =>
                                item.kind === "response" &&
                                /prompt editor raw response/i.test(item.text || ""),
                        ),
                    "Prompt Editor keeps sent and streamed response messages in transcript state",
                    transcriptAfterSend,
                );
                togglePromptEditorTranscriptItem(0);
                devAssert(
                    app.promptEditor.transcript[0]?.collapsed === true &&
                        /Expand/i.test($("modalBox")?.textContent || ""),
                    "Prompt Editor transcript messages can be collapsed while keeping the numbered title visible",
                    $("modalBox")?.textContent || "",
                );
                deletePromptEditorTranscriptItem(0);
                devAssert(
                    (app.promptEditor?.transcript || []).length === 1 &&
                        /#1/.test($("modalBox")?.textContent || "") &&
                        /Response:/i.test($("modalBox")?.textContent || ""),
                    "Prompt Editor transcript messages can be deleted and remaining messages renumber",
                    app.promptEditor?.transcript,
                );
                rememberPromptEditorAiCall("text", {
                    label: "assistant state group character_body repair 1",
                    promptType: "assistant state group character_body repair 1",
                    prompt: "Repair this EmberAdventures grouped patch.\nGroup:character_body\n...",
                });
                rememberPromptEditorAiCall("text", {
                    label: "AI command patch",
                    promptType: "AI command patch",
                    prompt: "old stale command prompt text",
                    snapshot: promptEditorSnapshotForReplay({
                        promptEditorReplay: {
                            command: "Set the test flag.",
                            stateContextText: "{\"scene\":{\"summary\":\"old replay state\"}}",
                        },
                    }),
                });
                openPromptEditorModal();
                devAssert(
                    /Captured Text Prompt Types/i.test($("modalBox")?.textContent || "") &&
                        /assistant state group character_body repair 1/i.test($("modalBox")?.textContent || "") &&
                        app.settings.promptEditorLastTextCallsByType?.["ai-command-patch"] &&
                        !app.settings.promptEditorLastTextCallsByType?.["ai-command-patch"]
                            ?.snapshot?.state &&
                        !app.settings.promptEditorLastTextCallsByType?.["ai-command-patch"]
                            ?.snapshot?.messages &&
                        !app.settings.promptEditorLastTextCallsByType?.["ai-command-patch"]
                            ?.snapshot?.settings,
                    "Prompt Editor exposes captured repair prompts and retains compact replay inputs without cloning full runtime state",
                    $("modalBox")?.textContent || "",
                );
                loadPromptEditorSource("text", "ai-command-patch", "last");
                devAssert(
                    /Set the test flag\./.test($("promptEditorText")?.value || "") &&
                        !/old stale command prompt text/.test($("promptEditorText")?.value || ""),
                    "Prompt Editor Last rebuilds AI command prompt from saved inputs instead of stale exact prompt text",
                    $("promptEditorText")?.value || "",
                );
                switchPromptEditorTab("images");
                loadPromptEditorSource("images", "uninspected-npc", "shell");
                devAssert(
                    /PROMPT SHELL:\s*Non-inspected NPC preview image/i.test($("promptEditorText")?.value || ""),
                    "Prompt Editor images tab includes non-inspected NPC preview shell source",
                );
                await sendPromptEditorImage();
                devAssert(
                    imageCalls.length === 1 &&
                        /prompt editor preview/i.test($("promptEditorPreview")?.innerHTML || "") &&
                        !app.images.some((image) => /prompt editor preview/i.test(image.html || "")),
                    "Prompt Editor image preview does not save into normal image history",
                    { imageCalls, images: app.images },
                );
                app.promptEditorLastTextCall = null;
                await aiText("real prompt editor smoke call", { label: "real prompt editor smoke" });
                devAssert(
                    /real prompt editor smoke call/.test(
                        app.promptEditorLastTextCall?.prompt || "",
                    ) &&
                        !app.promptEditorLastTextCall?.snapshot?.state &&
                        !app.promptEditorLastTextCall?.snapshot?.messages &&
                        !app.promptEditorLastTextCall?.snapshot?.settings,
                    "Prompt Editor captures the last real AI call with universal context and compact replay metadata",
                    app.promptEditorLastTextCall,
                );
                const wrappedJson = `Response: Manual NPC/speaker extraction from response
2026-06-08T21:58:20.443Z

\`\`\`json
{
  "new_npcs": [
    {
      "role": "Guard Captain",
      "full_name": "Vessa Ironhold",
      "gender": "female",
      "age": 32,
      "appearance": "human, 5'9\\", muscular build, tanned skin, dark brown eyes, shoulder-length auburn hair in a practical braid, D-cup breasts, wearing reinforced leather armor with city guard insignia",
      "current_appearance": "fully covered leather armor with a blue city-guard sash",
      "personality": "no-nonsense professional with dry humor, accustomed to bizarre magical phenomena after years guarding a fantasy city"
    }
  ]
}
\`\`\``;
                devAssert(
                    parseJsonObject(wrappedJson)?.new_npcs?.[0]?.full_name ===
                        "Vessa Ironhold",
                    "JSON parser accepts Prompt Editor response headers plus fenced JSON",
                    parseJsonObject(wrappedJson),
                );
                addMessage("system", "Prompt editor smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: prompt-editor-smoke");
            } finally {
                supabaseSignedInUser = originalSupabaseSignedInUser;
                runAiTextNow = originalRunAiTextNow;
                generateImageHtml = originalGenerateImageHtml;
            }
        }

        async function devRunReleasePolishSmokeTest() {
            devTestLog("Scenario start: release-polish-smoke");
            devResetForLiveTest("release-polish-smoke");
            devCreateTestProfile({  });
            app.state = devMakeSceneControlState({  });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Release polish smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];

            const originalDownloadJsonPayload = downloadJsonPayload;
            const originalUploadBlobToUserUploads = uploadBlobToUserUploads;
            const originalAddEntriesToPublicLibraryIndex = addEntriesToPublicLibraryIndex;
            const originalShowHostedShareResult = showHostedShareResult;
            const downloads = [];
            const uploads = [];
            const publishedEntries = [];
            const shareResults = [];
            const smokeExportScope = {
                saveIds: [],
                storyIds: [],
                characterIds: [],
                profileImageIds: [],
                storyTitleImageIds: [],
            };

            try {
                downloadJsonPayload = (payload, filename) => {
                    downloads.push({ payload: clone(payload), filename });
                    app.__emberAdventuresLastJsonDownload = {
                        filename,
                        payload: clone(payload),
                        at: new Date().toISOString(),
                    };
                };
                uploadBlobToUserUploads = async (blob, label = "upload") => {
                    uploads.push({ blob, label, size: Number(blob?.size || 0) });
                    return {
                        url: `https://user.uploads.dev/file/${safeUploadSlug(label)}.png`,
                        size: Number(blob?.size || 0),
                        fileName: `${safeUploadSlug(label)}.png`,
                    };
                };
                addEntriesToPublicLibraryIndex = async (entries = []) => {
                    const normalized = (Array.isArray(entries) ? entries : [entries])
                        .map((entry) => createPublicLibraryEntry(entry))
                        .filter(Boolean);
                    publishedEntries.push(...normalized);
                    return {
                        upload: {
                            url: "https://user.uploads.dev/file/public-index-smoke.json",
                            size: 1,
                            fileName: "public-index-smoke.json",
                        },
                        entries: normalized,
                        index: mergePublicLibraryIndexItems(publicLibraryEmptyIndex(), normalized),
                    };
                };
                showHostedShareResult = async (title, url, details = "") => {
                    shareResults.push({ title, url, details });
                };

                await exportData({
                    fileName: "emberadventureslite-release-smoke-export.json",
                    scope: smokeExportScope,
                });
                devAssert(
                    downloads.at(-1)?.filename === "emberadventureslite-release-smoke-export.json" &&
                        !("runtimeSnapshot" in (downloads.at(-1)?.payload || {})),
                    "normal export uses the requested filename without emergency runtime snapshot",
                    downloads.at(-1),
                );

                app.__emberAdventuresLastBlobDownload = null;
                const durableProfilesBeforeDiagnostic = await app.library.request("profiles.list");
                await emergencyExportData({ scope: smokeExportScope });
                const emergencyDownload =
                    app.__emberAdventuresLastBlobDownload;
                const emergencyPayload = emergencyDownload?.blob
                    ? JSON.parse(await emergencyDownload.blob.text())
                    : null;
                devAssert(
                    emergencyDownload?.filename ===
                        "emberadventureslite-emergency-backup.json" &&
                        emergencyPayload?.diagnosticExport
                            ?.durableWorkerExport === true &&
                        emergencyPayload?.diagnosticExport
                            ?.runtimeSnapshotIncluded === false &&
                        emergencyPayload?.exportType === "diagnostic-snapshot" &&
                        emergencyPayload?.diagnosticExport?.source === "current-library-worker" &&
                        emergencyPayload?.diagnosticExport?.fullBackup === false &&
                        emergencyPayload?.diagnosticExport?.imageBytesIncluded === false &&
                        smokeDurableValuesEqual(
                            emergencyPayload.userProfiles.slice().sort((a, b) => a.id.localeCompare(b.id)),
                            durableProfilesBeforeDiagnostic.slice().sort((a, b) => a.id.localeCompare(b.id)),
                        ) &&
                        !Object.hasOwn(
                            emergencyPayload || {},
                            "runtimeSnapshot",
                        ),
                    "emergency export reads current durable profiles without duplicating live runtime or image bytes",
                    {
                        filename: emergencyDownload?.filename,
                        bytes: emergencyDownload?.blob?.size || 0,
                        diagnosticExport:
                            emergencyPayload?.diagnosticExport,
                    },
                );
                localStorage.removeItem(DIAGNOSTIC_EXPORT_PHASE_KEY);

                devAssert(
                    imageModelLabel("fantasy-rpg") === "Cinematic Fantasy" &&
                        imageModelLabel("polished-animation") === "Polished" &&
                        !IMAGE_ART_STYLE_PRESETS.some((preset) =>
                            /Fantasy RPG|EmberAdventures/i.test(`${preset.label} ${preset.hint}`),
                        ),
                    "default image style preset uses a generic release-facing label and polished remains available separately",
                    IMAGE_ART_STYLE_PRESETS,
                );

                const hostedImage = {
                    id: "release-hosted-image",
                    html: '<img alt="hosted" src="https://user.uploads.dev/file/release-hosted-image.png">',
                    owner_name: "Release Hosted Image",
                    creator: "debug harness",
                    creation_tool: "debug harness",
                    source: "release smoke",
                    model: "fantasy-rpg",
                    reason: "release hosted",
                };
                app.images = [hostedImage];
                openImageViewerModal();
                devAssert(
                    ![...document.querySelectorAll("#modalBox button")].some((button) =>
                        /upload|share|publish/i.test(button.textContent || button.title || ""),
                    ),
                    "image cards do not expose upload/share/publish actions",
                    [...document.querySelectorAll("#modalBox button")].map(
                        (button) => button.textContent || button.title || "",
                    ),
                );

                addMessage("system", "Release polish smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: release-polish-smoke");
            } finally {
                downloadJsonPayload = originalDownloadJsonPayload;
                uploadBlobToUserUploads = originalUploadBlobToUserUploads;
                addEntriesToPublicLibraryIndex = originalAddEntriesToPublicLibraryIndex;
                showHostedShareResult = originalShowHostedShareResult;
                document.getElementById("emberAdventuresEmergencyExport")?.remove();
            }
        }

        async function devRunOriginalStoryCreationTest() {
            devTestLog("Scenario start: new-original-story");
            devResetForLiveTest("new-original-story");
            devCreateTestProfile({  });
            beginOnboardingWorldSetup();
            app.onboardingDraft = {
                ...app.onboardingDraft,
                step: 8,
                player_preferences: ["fantasy", "anime"],
                story_mode: "original",
                story_title: "",
                story_description:
                    "A compact fantasy dungeon-city adventure about a courier who discovers a sealed underground archive beneath a market district.",
                story_modifications:
                    "Keep the opening grounded, playable, and focused on one immediate problem.",
                player: {
                    name: "Test Courier",
                    age: 24,
                    gender: "non-male",
                    role: "courier",
                },
                cast_notes:
                    "Start solo. Use named adult NPCs only when they actually appear.",
                story_guidance:
                    "Prioritize clear objectives, visible consequences, and no hidden tutorial wall.",
            };
            const prompt = onboardingSetupPrompt();
            devAssert(prompt.includes("Original story"), "original story prompt selected", {
                promptStart: prompt.slice(0, 160),
            });
            await generateWorld(prompt);
            devAssert(app.state?.meta?.setup_complete, "generated state setup complete");
            devAssert(
                app.state?.meta?.story_source?.mode === "original",
                "generated state keeps original story source",
                app.state?.meta?.story_source,
            );
            devAssert(
                (app.messages || []).some((message) => message.role === "assistant"),
                "opening assistant message exists",
                { messageCount: app.messages.length },
            );
            devAssert(
                (app.objectives || app.state.objectives)?.items?.length ||
                    app.state.objectives?.items?.length,
                "objectives exist after original generation",
                app.state.objectives,
            );
            devAssert(
                (app.state.objectives?.items || []).every(
                    (objective) =>
                        !("objective" in objective) &&
                        !Array.isArray(objective.steps),
                ),
                "generated original-story objectives use the current summary-only schema",
                app.state.objectives,
            );
            if (!perchancePlugin("aiTextPlugin") || !perchancePlugin("textToImagePlugin")) {
                // Local direct-bottom smoke runs cannot provide Perchance's AI/image
                // plugins. Keep the schema/new-game assertions active, but skip the
                // plugin-dependent follow-up turn unless the real Perchance runtime
                // is available.
                addMessage("system", "Original story creation smoke test passed.");
                showNotice(
                    "Live Test Passed",
                    "Original story creation smoke test passed with plugin-dependent follow-up skipped.",
                );
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: new-original-story", {
                    objective: currentObjectiveTarget?.()?.title || "",
                    skippedPluginFollowup: true,
                });
                return;
            }
            await devSendComposerMessageLikePlayer(
                "I check the nearest sign, then ask the first adult local where the sealed archive entrance is.",
            );
            devAssert(
                profileImagesForEntity(app.state.player || {}).length > 0,
                "profile image generated or assigned for original-story player",
                {
                    player: app.state.player?.name,
                    profileImages: profileImagesForEntity(app.state.player || {}).length,
                },
            );
            devAssert(
                (app.images || []).length > 0,
                "normal image history has at least one generated/queued image",
                { imageCount: (app.images || []).length },
            );
            devTestLog("Scenario complete: new-original-story", {
                objective: currentObjectiveTarget?.()?.title || "",
                messages: app.messages.length,
            });
        }

        async function devRunWorldGenerationProgressMonotonicSmokeTest() {
            devTestLog("Scenario start: world-generation-progress-monotonic-smoke");
            devResetForLiveTest("world-generation-progress-monotonic-smoke");
            // SANITIZE KEEP (dev fixture): synthetic world-generation progress state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Progress Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Progress Tester",
                    age: 24,
                    gender: "non-male",
                    role: "tester",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "World generation progress smoke test.",
                    objective: "Verify progress display does not move backward.",
                    party_members_present: ["Progress Tester"],
                    image_characters: ["Progress Tester"],
                },
                objectives: {
                    active_id: "progress-smoke-objective",
                    items: [
                        {
                            id: "progress-smoke-objective",
                            title: "Verify Progress",
                            type: "story",
                            status: "active",
                            summary: "Check generation progress display.",
                            objective: "Keep visible progress monotonic.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.worldGenerationProgress = null;
            app.worldGenerationStartedAt = Date.now();
            updateWorldGenerationStatus(
                "Building world and map",
                2,
                10,
                "Attempt 1 complete.",
                {
                    stepProgress: 1,
                    attempt: 1,
                    attemptsTotal: 3,
                },
            );
            devAssert(
                Math.round((app.worldGenerationProgress?.totalProgress || 0) * 100) === 20,
                "initial generation progress reaches 20%",
                app.worldGenerationProgress,
            );
            updateWorldGenerationStatus(
                "Building world and map",
                2,
                10,
                "Retry attempt started.",
                {
                    stepProgress: 0.4,
                    attempt: 2,
                    attemptsTotal: 3,
                },
            );
            devAssert(
                Math.round((app.worldGenerationProgress?.rawTotalProgress || 0) * 100) === 14,
                "retry raw progress can be lower",
                app.worldGenerationProgress,
            );
            devAssert(
                Math.round((app.worldGenerationProgress?.totalProgress || 0) * 100) === 20,
                "displayed generation progress stays monotonic across retry",
                app.worldGenerationProgress,
            );
            addMessage("system", "World generation progress monotonic smoke test passed.");
            app.worldGenerationProgress = null;
            app.worldGenerationStartedAt = null;
            setStatus("Ready");
            render();
            devTestLog("Scenario complete: world-generation-progress-monotonic-smoke");
        }

        async function devRunRuntimeNarrowSanitizeSmokeTest() {
            devTestLog("Scenario start: runtime-narrow-sanitize-smoke");
            devResetForLiveTest("runtime-narrow-sanitize-smoke");
            devCreateTestProfile({  });

            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                },
                player: {
                    ...clone(defaultState.player),
                    id: "runtime-tester",
                    name: "Runtime Tester",
                    age: 25,
                    boldness: 5,
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "test-town",
                    specific_place: "TestTown",
                },
                scene: {
                    ...clone(defaultState.scene),
                    party_members_present: ["Known Ally"],
                    image_characters: ["Runtime Tester", "Known Ally"],
                    npcs_present: ["Local Watcher"],
                },
                characters: {
                    "Known Ally": {
                        ...blankCharacterTemplate("Known Ally"),
                        id: "known-ally",
                        name: "Known Ally",
                        age: 25,
                        role: "runtime smoke companion",
                        boldness: 5,
                    },
                    "Image Only": {
                        ...blankCharacterTemplate("Image Only"),
                        id: "image-only",
                        name: "Image Only",
                        age: 25,
                        role: "image target only",
                        boldness: 5,
                    },
                },
                world_map: {
                    current_location_id: "runtime-current",
                    focus_location_id: "runtime-current",
                    travel_history: ["runtime-current"],
                    locations: {
                        "runtime-current": {
                            id: "runtime-current",
                            name: "Runtime Square",
                            type: "place",
                            scale: "site",
                            discovered: true,
                            travel_enabled: true,
                            summary: "Known runtime square.",
                            connections: ["locked-future-lab"],
                        },
                        "locked-future-lab": {
                            id: "locked-future-lab",
                            name: "Glass Alembic Vault",
                            type: "alchemy shop",
                            scale: "site",
                            discovered: false,
                            travel_enabled: false,
                            summary: "Hidden future alchemy shop for a locked future cast member.",
                            connections: ["runtime-current"],
                        },
                    },
                },
                future_cast: {
                    enabled: true,
                    items: {
                        "future-alchemist": {
                            id: "future-alchemist",
                            name: "Future Alchemist",
                            status: "locked",
                            role: "prism slime alchemist",
                            location_hint: "Glass Alembic Vault",
                        },
                    },
                },
                npc_directory: {
                    locations: {
                        "test-town": {
                            label: "TestTown",
                            characters: {
                                "Local Watcher": {
                                    name: "Local Watcher",
                                    gender: "female",
                                    age: 28,
                                    inspected: true,
                                    full_character: {
                                        ...blankCharacterTemplate("Local Watcher"),
                                        name: "Local Watcher",
                                        age: 28,
                                        role: "runtime smoke NPC",
                                        boldness: 5,
                                        default_seed: 0,
                                    },
                                },
                            },
                        },
                    },
                },
                objectives: {
                    active_id: "runtime-main",
                    items: [
                        {
                            id: "runtime-main",
                            title: "Runtime Main",
                            type: "story",
                            status: "active",
                            objective: "Complete the runtime sanitizer smoke test.",
                            rewards: [
                                {
                                    type: "add_story_rule",
                                    rule_id: "runtime_smoke",
                                    text: "Runtime sanitizer smoke reward applied.",
                                },
                            ],
                        },
                    ],
                },
            });
            rememberProfileImage("Player", {
                id: "runtime-player-profile",
                source: "smoke",
                model: selectedImageModel(),
                seed: 101,
                prompt: "runtime tester profile",
                negativePrompt: "",
                html: '<img alt="Runtime profile" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
                profile: true,
            });
            app.state.characters["Known Ally"].boldness = 5;
            {
                const parserBase = clone(app.state);
                const canonical = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: ["scene", "summary"],
                                value: "Runtime parser smoke scene.",
                            },
                        ],
                        a: [
                            {
                                path: ["recent_changes"],
                                value: "Runtime parser smoke changed scene.",
                            },
                        ],
                    }),
                    parserBase,
                    ["scene", "time", "recent_changes"],
                    "scene_time",
                );
                devAssert(
                    canonical.valid &&
                        canonical.patch.scene?.summary ===
                            "Runtime parser smoke scene.",
                    "runtime grouped parser accepts canonical object ops",
                    canonical,
                );
                const sceneListReplace = parseBlockStatePatch(
                    JSON.stringify({
                        n: [{ path: ["scene", "npcs_present"] }],
                        a: [
                            {
                                path: ["scene", "npcs_present"],
                                value: "Trader Vessa",
                            },
                        ],
                    }),
                    {
                        ...parserBase,
                        scene: {
                            ...(parserBase.scene || {}),
                            npcs_present: ["Litia"],
                        },
                    },
                    ["scene", "time", "recent_changes"],
                    "scene_time",
                );
                devAssert(
                    sceneListReplace.valid &&
                        sceneListReplace.patch.scene?.npcs_present?.length === 1 &&
                        sceneListReplace.patch.scene.npcs_present[0] === "Trader Vessa",
                    "runtime grouped parser appends to patch list after nulling base list",
                    sceneListReplace,
                );
                const invalidRoot = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: ["party_members", "Known Ally", "state_of_mind"],
                                value: "focused",
                            },
                            {
                                path: ["scene", "summary"],
                                value: "Invalid from mind group.",
                            },
                        ],
                    }),
                    parserBase,
                    ["party_members", "player", "recent_changes"],
                    "character_mind",
                );
                devAssert(
                    !invalidRoot.valid &&
                        invalidRoot.patch.characters?.["Known Ally"]
                            ?.state_of_mind === "focused" &&
                        !invalidRoot.patch.scene,
                    "runtime grouped parser strips invalid roots while keeping valid character ops",
                    invalidRoot,
                );
                const protectedPlayer = parseBlockStatePatch(
                    JSON.stringify({
                        s: [{ path: ["player", "name"], value: "Fake Player" }],
                    }),
                    parserBase,
                    ["party_members", "player", "recent_changes"],
                    "character_body",
                );
                devAssert(
                    !protectedPlayer.valid && !protectedPlayer.patch.player?.name,
                    "runtime grouped parser blocks player.name writes",
                    protectedPlayer,
                );
                const removalContext = sceneRemovalCheckPresentContext({
                    ...app.state,
                    scene: {
                        ...(app.state.scene || {}),
                        npcs_present: ["Litia"],
                        party_members_present: [],
                    },
                    npc_directory: {
                        locations: {
                            Test: {
                                characters: {
                                    Litia: {
                                        name: "Litia",
                                        role: "damaged Venis-model combat commander",
                                    },
                                },
                            },
                        },
                    },
                });
                devAssert(
                    removalContext.n.length === 1 && removalContext.n[0] === "Litia",
                    "scene removal prompt lists exact NPC names without display role suffixes",
                    removalContext,
                );
                const removalParsed = parseSceneRemovalCheckResult(
                    '{"n":["Litia|damaged Venis-model combat commander"]}',
                );
                devAssert(
                    removalParsed.n.length === 1 && removalParsed.n[0] === "Litia",
                    "scene removal parser strips legacy role suffixes from returned names",
                    removalParsed,
                );
            }
            const profileBefore = activeProfileImage(app.state.player);
            toggleImageTarget("Player");
            devAssert(
                !(app.state.scene.image_characters || []).includes("Player"),
                "image-target toggle can leave Player removed",
                app.state.scene.image_characters,
            );
            devAssert(
                activeProfileImage(app.state.player)?.html === profileBefore?.html,
                "image-target toggle preserves player profile image html",
                activeProfileImage(app.state.player),
            );
            devAssert(
                (app.state.scene.party_members_present || []).includes("Known Ally"),
                "image-target toggle does not alter scene presence",
                app.state.scene,
            );
            app.state.scene.image_characters = ["Runtime Tester", "Known Ally"];
            const originalAiTextForImageCleanup = aiText;
            let imageCleanupAiCalls = 0;
            try {
                aiText = async () => {
                    imageCleanupAiCalls += 1;
                    throw new Error("image-target cleanup should not call AI");
                };
                await cleanupRemovedCharacterReferences("Known Ally", "image");
            } finally {
                aiText = originalAiTextForImageCleanup;
            }
            devAssert(
                imageCleanupAiCalls === 0 &&
                    !(app.state.scene.image_characters || []).includes("Known Ally") &&
                    (app.state.scene.party_members_present || []).includes("Known Ally"),
                "image-target removal cleanup is deterministic and preserves scene presence",
                { imageCleanupAiCalls, scene: app.state.scene },
            );

            app.state.scene.image_characters = ["Runtime Tester", "Known Ally"];
            app.settings.leftPanelGroup = "characters";
            app.settings.leftPanelSections = {
                ...(app.settings.leftPanelSections || {}),
                "characters-player": true,
                "characters-party": true,
            };
            renderLeftPanel();
            renderCharacters();
            const playerImageButton = document.querySelector(
                '#playerList [data-character-action="image"][data-character-name="Player"]',
            );
            devAssert(!!playerImageButton, "left player image-target button renders");
            closeModal();
            playerImageButton.click();
            const playerCard = $("playerList")?.querySelector(
                '[data-character-card][data-character-name="Player"]',
            );
            const playerCardHtml = playerCard?.innerHTML || "";
            const renderedProfileId = playerCard
                ?.querySelector(".profile-image-thumb-wrap[data-profile-live-id]")
                ?.getAttribute("data-profile-live-id");
            devAssert(
                renderedProfileId === "runtime-player-profile" &&
                    !!playerCard?.querySelector(".profile-image-thumb"),
                "left player card keeps the rendered profile image after Remove from images",
                { renderedProfileId, playerCardHtml },
            );
            devAssert(
                !(app.state.scene.image_characters || []).includes("Player") &&
                    (app.state.scene.image_characters || []).includes("Known Ally"),
                "left player Remove from images only removes Player from image targets",
                app.state.scene.image_characters,
            );
            const runtimePromptState = stateForAiPrompt(app.state);
            const runtimeStateText = JSON.stringify(runtimePromptState);
            devAssert(
                !("future_cast" in runtimePromptState) &&
                    !/Future Alchemist|Glass Alembic Vault|prism slime/i.test(
                        runtimeStateText,
                    ),
                "runtime AI prompt state hides locked future cast and hidden map nodes",
                runtimePromptState,
            );
            const replyContext = buildReplyStateContext();
            const replyContextText = JSON.stringify(replyContext);
            devAssert(
                !/Future Alchemist|Glass Alembic Vault|prism slime/i.test(
                    replyContextText,
                ),
                "narrator reply prompt context hides locked future cast and hidden map nodes",
                replyContext,
            );
            const autoPlayerContext = buildAutoPlayerTurnStateContext(app.state);
            const autoPlayerContextText = JSON.stringify(autoPlayerContext);
            devAssert(
                !("future_cast" in autoPlayerContext) &&
                    !/Future Alchemist|Glass Alembic Vault|prism slime/i.test(
                        autoPlayerContextText,
                    ),
                "auto-player prompt context hides locked future cast and hidden map nodes",
                autoPlayerContext,
            );
            const stateCheckContext = buildStateCheckContext(app.state);
            const stateCheckContextText = JSON.stringify(stateCheckContext);
            devAssert(
                !/Future Alchemist|Glass Alembic Vault|prism slime/i.test(
                    stateCheckContextText,
                ),
                "state-check prompt context hides locked future cast and hidden map nodes",
                stateCheckContext,
            );

            devAssert(
                (() => {
                    const forbidden = `"${"current_" + "story_rule"}"\\s*:`;
                    const re = new RegExp(forbidden);
                    return !re.test(replyContextText) &&
                        !re.test(autoPlayerContextText) &&
                        !re.test(stateCheckContextText) &&
                        !re.test(runtimeStateText);
                })(),
                "AI prompt contexts do not expose legacy story-rule metadata",
                { runtimePromptState, replyContext, autoPlayerContext, stateCheckContext },
            );
            devAssert(
                !Object.prototype.hasOwnProperty.call(replyContext, "objectives"),
                "normal narrator reply state omits objectives; active objective is prompt text",
                replyContext,
            );
            devAssert(
                !/"image_action"\s*:/.test(replyContextText) &&
                    !/"image_action"\s*:/.test(autoPlayerContextText) &&
                    !/"image_action"\s*:/.test(stateCheckContextText) &&
                    !/"player_present"\s*:/.test(replyContextText) &&
                    !/"player_present"\s*:/.test(autoPlayerContextText) &&
                    !/"player_present"\s*:/.test(stateCheckContextText) &&
                    !/"image_includes_player"\s*:/.test(replyContextText) &&
                    !/"image_includes_player"\s*:/.test(autoPlayerContextText) &&
                    !/"image_includes_player"\s*:/.test(stateCheckContextText),
                "AI prompt contexts hide image-only scene fields and derived player presence flags",
                { replyContext, autoPlayerContext, stateCheckContext },
            );
            devAssert(
                !stateCheckContext.party_members?.["Image Only"],
                "state-check prompt context does not expose image-only characters",
                stateCheckContext.party_members,
            );
            devAssert(
                !Object.prototype.hasOwnProperty.call(replyContext, "characters") &&
                    !Object.prototype.hasOwnProperty.call(autoPlayerContext, "characters") &&
                    !Object.prototype.hasOwnProperty.call(stateCheckContext, "characters"),
                "AI prompt contexts expose party members as party_members, not characters",
                { replyContext, autoPlayerContext, stateCheckContext },
            );
            devAssert(
                !$("modal")?.classList.contains("open"),
                "left player Remove from images does not open the Characters modal",
                $("modalTitle")?.textContent || "",
            );

            openCharactersModal();
            closeModal();
            app.settings.leftPanelGroup = "characters";
            app.settings.leftPanelSections ||= {};
            app.settings.leftPanelSections["characters-party"] = true;
            renderLeftPanel();
            renderCharacters();
            const staleModalImageButton = document.querySelector(
                '#playerList [data-character-action="image"][data-character-name="Player"]',
            );
            devAssert(
                !!staleModalImageButton,
                "left player image-target button renders after closing Characters",
            );
            staleModalImageButton.click();
            devAssert(
                !$("modal")?.classList.contains("open"),
                "left player Remove from images does not reopen a stale Characters modal",
                $("modalTitle")?.textContent || "",
            );

            for (const action of ["profile", "player", "settings"]) {
                closeModal();
                renderLeftPanel();
                renderCharacters();
                const actionButton = document.querySelector(
                    `#playerList [data-character-action="${action}"][data-character-name="Player"]`,
                );
                devAssert(!!actionButton, `left player ${action} button renders`);
                actionButton.click();
                devAssert(
                    !/Characters|Cast/i.test($("modalTitle")?.textContent || ""),
                    `left player ${action} button does not open the Characters modal`,
                    $("modalTitle")?.textContent || "",
                );
            }

            app.state.scene.image_characters = ["Player", "Missing Person", "Known Ally"];
            app.state.scene.npcs_present = ["Local Watcher", "Known Ally"];
            let invalidSceneReferenceError = "";
            try {
                assertRuntimeSceneReferences(app.state);
            } catch (error) {
                invalidSceneReferenceError = String(error?.message || error);
            }
            devAssert(
                /references unknown character/i.test(invalidSceneReferenceError),
                "strict scene-list validation rejects invalid names instead of rewriting them",
                { invalidSceneReferenceError, scene: app.state.scene },
            );
            app.state.scene.image_characters = ["Runtime Tester", "Known Ally"];
            app.state.scene.npcs_present = ["Local Watcher"];
            const commandSceneBeforeInvalid = clone(app.state.scene);
            addPartyMemberToScene(app.state, "Known Ally");
            devAssert(
                (app.state.scene.party_members_present || []).includes("Known Ally") &&
                    !(app.state.scene.npcs_present || []).includes("Known Ally"),
                "addPartyMemberToScene validates and adds only a party member",
                app.state.scene,
            );
            removePartyMemberFromScene(app.state, "Known Ally");
            const originalShowNoticeForAbsentImageTarget = showNotice;
            let absentImageTargetNotice = null;
            try {
                showNotice = (title, message) => {
                    absentImageTargetNotice = { title, message };
                };
                toggleImageTarget("Known Ally");
            } finally {
                showNotice = originalShowNoticeForAbsentImageTarget;
            }
            devAssert(
                !(app.state.scene.image_characters || []).includes("Known Ally") &&
                    absentImageTargetNotice?.title === "Character Not Present",
                "an absent known character cannot be added as an image target by a stale character-card action",
                { scene: app.state.scene, absentImageTargetNotice },
            );
            const remoteWatcher = {
                name: "Remote Watcher",
                gender: "female",
                age: 29,
                role: "remote identity collision test NPC",
                relationship: "known contact",
                note: "",
                inspected: true,
                full_character: {
                    ...blankCharacterTemplate("Remote Watcher"),
                    id: "Local Watcher",
                    name: "Remote Watcher",
                    age: 29,
                    role: "remote identity collision test NPC",
                    boldness: 5,
                    default_seed: 0,
                },
            };
            app.state.npc_directory.locations["test-town"].characters["Remote Watcher"] =
                remoteWatcher;
            absentImageTargetNotice = null;
            try {
                showNotice = (title, message) => {
                    absentImageTargetNotice = { title, message };
                };
                toggleImageTarget("Remote Watcher");
            } finally {
                showNotice = originalShowNoticeForAbsentImageTarget;
            }
            devAssert(
                !(app.state.scene.image_characters || []).includes("Remote Watcher") &&
                    absentImageTargetNotice?.title === "Character Not Present",
                "an absent NPC whose image identity aliases a present NPC cannot become an image target",
                { scene: app.state.scene, absentImageTargetNotice, remoteWatcher },
            );
            devAssert(
                /data-character-action="image"[^>]*disabled/.test(
                    npcCardHtml("Remote Watcher", remoteWatcher),
                ) &&
                    /data-character-action="image"[^>]*disabled/.test(
                        partialNpcCardHtml("Remote Watcher", remoteWatcher, "test-town"),
                    ),
                "absent full and partial NPC cards disable their image-target controls",
            );
            app.state.scene.image_characters = ["Runtime Tester", "Known Ally"];
            let removedPartyImageError = "";
            try {
                assertRuntimeSceneReferences(app.state);
            } catch (error) {
                removedPartyImageError = String(error?.message || error);
            }
            devAssert(
                /references unknown character Known Ally/i.test(removedPartyImageError),
                "strict scene validation rejects a removed party member left in image targets",
                { removedPartyImageError, scene: app.state.scene },
            );
            app.state.scene.image_characters = ["Runtime Tester"];
            addNpcToSceneCommand(app.state, "Local Watcher");
            devAssert(
                (app.state.scene.npcs_present || []).includes("Local Watcher") &&
                    !(app.state.scene.party_members_present || []).includes("Local Watcher"),
                "addNpcToSceneCommand validates and adds only a known living NPC",
                app.state.scene,
            );
            removeNpcFromSceneCommand(app.state, "Local Watcher");
            app.state.scene.party_members_present = ["Known Ally"];
            app.state.scene.npcs_present = ["Local Watcher"];
            app.state.scene.image_characters = ["Runtime Tester", "Known Ally", "Local Watcher"];
            replaceSceneNpcPresence(app.state, [], "smoke shop scene transition");
            assertRuntimeSceneReferences(app.state);
            devAssert(
                JSON.stringify(app.state.scene.image_characters) === JSON.stringify(["Runtime Tester", "Known Ally"]),
                "replacing NPC presence removes departed NPC image targets and preserves present player and party targets",
                app.state.scene,
            );
            toggleImageTarget("Runtime Tester");
            devAssert(
                JSON.stringify(app.state.scene.image_characters) === JSON.stringify(["Known Ally"]),
                "image-target controls still work after the shop transition removes a previously targeted NPC",
                app.state.scene,
            );
            app.state.scene.npcs_present = ["Local Watcher"];
            app.state.scene.image_characters = ["Runtime Tester", "Known Ally", "Local Watcher"];
            const originalAiTextForSceneRemoval = aiText;
            let sceneRemovalAiCalls = 0;
            let sceneRemovalResponse = '{"p":["Known Ally"],"n":["Local Watcher"]}';
            try {
                aiText = async (instruction, opts = {}) => {
                    sceneRemovalAiCalls += 1;
                    devAssert(
                        /scene-presence cleanup checker/i.test(finalAiTextInstruction(instruction, opts)) &&
                            /\{"p":\["Party Member Name"\],"n":\["NPC Name"\],"e":/.test(
                                finalAiTextInstruction(instruction, opts),
                            ),
                        "scene removal check uses clear prompt with compact output shape",
                        finalAiTextInstruction(instruction, opts).slice(0, 900),
                    );
                    return sceneRemovalResponse;
                };
                const unsupportedRemoval = await runScenePresenceRemovalCheckSafe({
                    text: "Hmm. I am interested in something.",
                    messageId: 10000,
                });
                devAssert(
                    !unsupportedRemoval.length && sceneRemovalAiCalls === 1 &&
                        (app.state.scene.party_members_present || []).includes("Known Ally") &&
                        (app.state.scene.npcs_present || []).includes("Local Watcher"),
                    "scene removal rejects a model's unsupported departure inference",
                    { unsupportedRemoval, scene: app.state.scene, sceneRemovalAiCalls },
                );
                sceneRemovalResponse = '{"p":["Known Ally","Player"],"n":["Local Watcher","Missing Person"],"e":"stays behind while I continue alone"}';
                const removedBeforeReply = await runScenePresenceRemovalCheckSafe({
                    text: "Local Watcher stays behind while I continue alone.",
                    messageId: 10001,
                });
                devAssert(
                    sceneRemovalAiCalls === 2 &&
                        removedBeforeReply.includes("Known Ally") &&
                        removedBeforeReply.includes("Local Watcher") &&
                        !removedBeforeReply.includes("Player") &&
                        !(app.state.scene.party_members_present || []).includes("Known Ally") &&
                        !(app.state.scene.npcs_present || []).includes("Local Watcher") &&
                        !(app.state.scene.image_characters || []).includes("Known Ally") &&
                        !(app.state.scene.image_characters || []).includes("Local Watcher"),
                    "scene removal check validates compact AI output and removes valid scene names before reply",
                    { removedBeforeReply, scene: app.state.scene, sceneRemovalAiCalls },
                );
                devAssert(
                    /Known Ally/.test(sceneRemovalNarratorDirective(removedBeforeReply)) &&
                        /Local Watcher/.test(sceneRemovalNarratorDirective(removedBeforeReply)) &&
                        /must not appear/i.test(sceneRemovalNarratorDirective(removedBeforeReply)),
                    "scene removal check creates one-turn narrator directive for removed names",
                    sceneRemovalNarratorDirective(removedBeforeReply),
                );
                const callCountBeforeEmpty = sceneRemovalAiCalls;
                app.state.scene.party_members_present = ["Player"];
                app.state.scene.npcs_present = [];
                const emptyRemoval = await runScenePresenceRemovalCheckSafe({
                    text: "I keep going.",
                    messageId: 10002,
                });
                devAssert(
                    !emptyRemoval.length && sceneRemovalAiCalls === callCountBeforeEmpty,
                    "scene removal check skips the extra AI call when no removable scene characters are present",
                    { emptyRemoval, sceneRemovalAiCalls },
                );
            } finally {
                aiText = originalAiTextForSceneRemoval;
            }
            let invalidCommandError = "";
            const commandSceneBeforeMissing = clone(app.state.scene);
            try {
                addNpcToSceneCommand(app.state, "Missing Person");
            } catch (err) {
                invalidCommandError = err.message || String(err);
            }
            devAssert(
                /not found/i.test(invalidCommandError) &&
                    JSON.stringify(app.state.scene) === JSON.stringify(commandSceneBeforeMissing),
                "scene command rejects invalid NPC names without partial mutation",
                { invalidCommandError, before: commandSceneBeforeInvalid, after: app.state.scene },
            );
            applyRuntimeContentPolicy(app.state);

            await devCompileCurrentStoryFixture("runtime-narrow-sanitize-smoke");
            const groupedClothingAlly = app.state.characters["Known Ally"];
            groupedClothingAlly.clothing = {
                ...blankClothingTemplate(),
                shirt: "runtime smoke day shirt",
            };
            groupedClothingAlly.outfits = [
                {
                    id: "runtime-smoke-evening-outfit",
                    name: "Runtime Smoke Evening Outfit",
                    clothing: { shirt: "runtime smoke evening shirt" },
                },
            ];
            groupedClothingAlly.active_outfit_id = "";
            const immutableObjectivesBeforeClothing = prettyJson(
                app.storyDefinition.objectivesById,
            );
            const runtimeObjectivesBeforeClothing = prettyJson(app.state.objectives);
            const originalAiTextForGroupedClothing = aiText;
            const originalQueueOneOffCharacterImageForGroupedClothing =
                queueOneOffCharacterImage;
            let groupedClothingImageRequests = 0;
            const groupedClothingResponses = [
                '{"s":[{"path":["clothing_operations"],"value":[{"operation":"change_outfit","outfit_id":"missing-runtime-smoke-outfit"}]}]}',
                '{"s":[{"path":["clothing_operations"],"value":[{"operation":"change_outfit","outfit_id":"runtime-smoke-evening-outfit"}]}]}',
            ];
            try {
                aiText = async () => groupedClothingResponses.shift() || "#";
                queueOneOffCharacterImage = () => {
                    groupedClothingImageRequests += 1;
                };
                const clothingGroup = stateCheckGroups().find(
                    (group) => group.id === "character_clothing",
                );
                const neverCancelled = new Promise(() => {});
                await runGroupedStateSection({
                    group: clothingGroup,
                    source: "runtime narrow sanitizer smoke",
                    text: "Known Ally changes into an outfit that does not exist.",
                    startedAt: performance.now(),
                    cancelPromise: neverCancelled,
                    stateSnapshot: clone(app.state),
                    characterName: "Known Ally",
                });
                devAssert(
                    clothingItemText(
                        app.state.characters["Known Ally"]?.clothing?.shirt,
                    ) === "runtime smoke day shirt" &&
                        groupedClothingImageRequests === 0 &&
                        prettyJson(app.state.objectives) ===
                            runtimeObjectivesBeforeClothing &&
                        prettyJson(app.storyDefinition.objectivesById) ===
                            immutableObjectivesBeforeClothing,
                    "compiled-story grouped clothing rejects an unknown outfit without mutating clothing or immutable objectives",
                    {
                        character: app.state.characters["Known Ally"],
                        objectives: app.state.objectives,
                    },
                );
                await runGroupedStateSection({
                    group: clothingGroup,
                    source: "runtime narrow sanitizer smoke",
                    text: "Known Ally changes into her evening outfit.",
                    startedAt: performance.now(),
                    cancelPromise: neverCancelled,
                    stateSnapshot: clone(app.state),
                    characterName: "Known Ally",
                });
                devAssert(
                    clothingItemText(
                        app.state.characters["Known Ally"]?.clothing?.shirt,
                    ) === "runtime smoke evening shirt" &&
                        app.state.characters["Known Ally"]?.active_outfit_id ===
                            "runtime-smoke-evening-outfit" &&
                        groupedClothingImageRequests === 1 &&
                        prettyJson(app.storyDefinition.objectivesById) ===
                            immutableObjectivesBeforeClothing,
                    "compiled-story grouped clothing applies a valid outfit without re-sanitizing the tracked live state",
                    {
                        character: app.state.characters["Known Ally"],
                        groupedClothingImageRequests,
                    },
                );
            } finally {
                aiText = originalAiTextForGroupedClothing;
                queueOneOffCharacterImage =
                    originalQueueOneOffCharacterImageForGroupedClothing;
            }
            completeCurrentObjective(app.state, "runtime-main");
            const beforeRewards = clone(app.state);
            const npcDirectoryBeforeRewardFinalize = app.state.npc_directory;
            const npcBeforeRewardFinalize =
                app.state.npc_directory.locations["test-town"].characters[
                    "Local Watcher"
                ];
            applyObjectiveProgressRewards(beforeRewards, app.state, "smoke", {
                silentGameMessage: true,
            });
            finalizeRuntimeAfterRewardApplication(app.state);
            devAssert(
                app.state.objectives.items.every((objective) => !objective.steps),
                "runtime reward finalizer keeps old objective step fields out",
                app.state.objectives,
            );
            devAssert(
                app.state.npc_directory === npcDirectoryBeforeRewardFinalize &&
                    app.state.npc_directory.locations["test-town"].characters[
                        "Local Watcher"
                    ] === npcBeforeRewardFinalize,
                "runtime reward finalizer does not rebuild unrelated NPC records",
                app.state.npc_directory,
            );

            app.state.scene.summary = "Runtime Tester stands with Known Ally.";
            app.state.player.name = "Runtime Tester Prime";
            app.state.player.age = 17;
            let invalidPlayerRejected = false;
            try {
                finalizeRuntimePlayerAfterEditor("Runtime Tester");
            } catch (error) {
                invalidPlayerRejected = /age/i.test(String(error?.message || error));
            }
            devAssert(
                invalidPlayerRejected,
                "player editor finalizer rejects an invalid authored age instead of repairing it",
            );
            app.state.player.age = 24;
            app.state.scene.party_members_present = (
                app.state.scene.party_members_present || []
            ).filter(
                (name) => name !== "Player" && name !== app.state.player.name,
            );
            app.state.scene.image_characters = (
                app.state.scene.image_characters || []
            ).map((name) => name === "Player" ? app.state.player.name : name);
            finalizeRuntimePlayerAfterEditor("Runtime Tester");
            devAssert(
                app.state.player.name === "Runtime Tester Prime" &&
                    app.state.player.age === 24 &&
                    /Runtime Tester Prime/.test(app.state.scene.summary || ""),
                "player editor finalizer accepts valid fields and updates player name references without broad repair",
                { player: app.state.player, summary: app.state.scene.summary },
            );

            app.state.scene.image_characters = [
                app.state.player.name,
                "Missing Person",
            ];
            app.state.characters["Known Ally"].profile_images = [
                {
                    id: "known-ally-profile",
                    html: '<img alt="Known Ally" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=">',
                    source: "smoke",
                    profile: true,
                    male: false,
                },
            ];
            app.state.characters["Known Ally"].profile_image_id = "known-ally-profile";
            const editedKnownAlly = {
                ...app.state.characters["Known Ally"],
                role: "validated runtime companion",
                age: 29,
            };
            const knownAllyBeforeInvalidEditor = clone(
                app.state.characters["Known Ally"],
            );
            let invalidImageTargetRejected = false;
            let invalidImageTargetError = "";
            try {
                finalizeRuntimePartyCharacterAfterEditor("Known Ally", editedKnownAlly);
            } catch (error) {
                invalidImageTargetError = String(error?.message || error);
                invalidImageTargetRejected = /Missing Person/.test(invalidImageTargetError);
            }
            devAssert(
                invalidImageTargetRejected &&
                    prettyJson(app.state.characters["Known Ally"]) ===
                        prettyJson(knownAllyBeforeInvalidEditor),
                "party-character editor finalizer rejects an unknown image target without partially saving",
                { invalidImageTargetError, imageCharacters: app.state.scene.image_characters },
            );
            app.state.scene.image_characters = [app.state.player.name];
            finalizeRuntimePartyCharacterAfterEditor("Known Ally", editedKnownAlly);
            devAssert(
                app.state.characters["Known Ally"].role === "validated runtime companion" &&
                    app.state.characters["Known Ally"].profile_image_id === "known-ally-profile" &&
                    !(app.state.scene.image_characters || []).includes("Missing Person"),
                "party-character editor finalizer accepts exact character and scene data",
                { character: app.state.characters["Known Ally"], scene: app.state.scene },
            );

            const watcher = getNpcEntryFromState(app.state, "Local Watcher");
            finalizeRuntimeNpcAfterEditor(watcher, "Local Watcher", {
                role: "validated runtime NPC",
                age: 34,
                inspected: true,
                status: "alive",
            });
            watcher.id = "stale-npc-shell-id";
            watcher.full_character.id = "canonical-local-watcher-id";
            finalizeRuntimeNpcAfterEditor(watcher, "Local Watcher", {
                role: "validated runtime NPC",
                age: 34,
                inspected: true,
                status: "alive",
            });
            devAssert(
                watcher.role === "validated runtime NPC" &&
                    watcher.age === 34 &&
                    watcher.inspected === true &&
                    !!watcher.full_character &&
                    watcher.id === watcher.full_character.id &&
                    imageTargetIdForSave("Local Watcher") === "canonical-local-watcher-id",
                "NPC editor finalizer keeps shell and full-character identities aligned for save projection",
                watcher,
            );

            delete app.state.npc_directory.locations["test-town"].characters["Local Watcher"];
            assertRuntimeNpcReferences(app.state);
            devAssert(
                !(app.state.scene.npcs_present || []).includes("Local Watcher"),
                "NPC reference normalizer removes stale NPC scene references",
                app.state.scene,
            );

            closeModal();
            addMessage("system", "Runtime narrow sanitizer smoke test passed.");
            app.mainMenuOpen = false;
            devTestLog("runtime narrow final character identities", {
                player: app.state.player?.id || "",
                characters: Object.fromEntries(
                    Object.entries(app.state.characters || {}).map(([name, character]) => [
                        name,
                        character?.id || "",
                    ]),
                ),
                sceneImageCharacters: app.state.scene?.image_characters || [],
            });
            scheduleActiveGameSave();
            render();
            showNotice("Live Test Passed", "Runtime narrow sanitizer smoke test passed.");
            devTestLog("Scenario complete: runtime-narrow-sanitize-smoke");
        }

        async function devRunSaveStorageIsolationSmokeTest() {
            devTestLog("Scenario start: save-storage-isolation-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            try {
                devResetForLiveTest("save-storage-isolation-smoke");
                devCreateTestProfile({  });
                const player = devSmokeRuntimeCharacter("Storage Smoke Player", {
                    gender: "male",
                    role: "storage isolation tester",
                });
                const ally = devSmokeRuntimeCharacter("Storage Smoke Ally", {
                    gender: "female",
                    role: "storage isolation ally",
                    trust: 1,
                });
                const objective = devSmokeObjective(
                    "storage-isolation-objective",
                    "Verify Normalized Storage",
                    {
                        status: "active",
                        ending_type: "freeplay",
                        ending_message: "The normalized storage test continues in freeplay.",
                    },
                );
                const state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Normalized Storage Smoke",
                        },
                    },
                    player,
                    characters: { [ally.name]: ally },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "Normalized baseline scene.",
                        party_members_present: [ally.name],
                        npcs_present: [],
                        image_characters: [],
                    },
                    objectives: {
                        active_id: objective.id,
                        focus_id: objective.id,
                        items: [objective],
                    },
                });
                await createNewActiveSave("normalized storage smoke baseline", {
                    state,
                    messages: [
                        {
                            id: 1,
                            entryId: 1,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Normalized baseline.",
                        },
                    ],
                });
                const saveId = Number(activeSaveId());
                const initial = await app.persistence.loadSave(saveId, 40);
                const initialRuntime = await app.library.reconstructRuntimeSave(saveId);
                devAssert(
                    Number.isInteger(saveId) &&
                        initial.recordsByStore?.saveHeaders?.length === 1 &&
                        initial.recordsByStore?.saveCharacterDefinitions?.length >= 2 &&
                        initial.recordsByStore?.messages?.length === 1 &&
                        !Object.values(initial.recordsByStore || {}).some((records) =>
                            (records || []).some((record) =>
                                Object.hasOwn(record || {}, "state") ||
                                Object.hasOwn(record || {}, "objectives"),
                            ),
                        ),
                    "normalized save creation stores bounded records without a full state or objective tree",
                    {
                        saveId,
                        stores: Object.fromEntries(
                            Object.entries(initial.recordsByStore || {}).map(
                                ([name, records]) => [name, records.length],
                            ),
                        ),
                    },
                );
                devAssert(
                    initialRuntime.state?.characters?.[ally.name]?.trust === 1 &&
                        initialRuntime.state?.scene?.summary === "Normalized baseline scene.",
                    "normalized records reconstruct the initial character and scene state",
                    initialRuntime.state,
                );

                const shellLocationId = app.state.location.npc_location_id;
                const shellName = "Storage Smoke Witness";
                const shellId = "storage-smoke-uninspected-witness";
                const shellOwner = {
                    kind: "npc",
                    recordId: JSON.stringify([shellLocationId, shellName]),
                };
                const shellOperation = npcShellSaveOperation(shellOwner, {
                    id: shellId,
                    name: shellName,
                    gender: "female",
                    age: 37,
                    role: "storage witness",
                    relationship: "neutral",
                    note: "A silver-haired adult witness wearing a navy coat and brown trousers.",
                    personality_description: "Patient and meticulous.",
                    current_appearance: "Holding a ledger.",
                    status: "alive",
                    inspected: false,
                });
                await app.persistence.submitOperations("runtime-mutation", [
                    shellOperation,
                    { type: "scene.member.add", characterId: shellId },
                    {
                        type: "runtime.records.replace",
                        storeName: "sceneImageTargets",
                        records: [{ characterId: shellId }],
                    },
                ]);
                await loadSaveIntoRuntime(String(saveId), { showCompatibilityNotice: false });
                const restoredShell = app.state.npc_directory.locations[shellLocationId]?.characters?.[shellName];
                devAssert(
                    restoredShell?.id === shellId &&
                        restoredShell.inspected === false &&
                        !restoredShell.full_character &&
                        restoredShell.note === shellOperation.shell.note &&
                        app.state.scene.npcs_present.includes(shellName) &&
                        app.state.scene.image_characters.includes(shellName) &&
                        imageTargetIdForSave(shellName) === shellId &&
                        saveProjectionQueue.sceneMembers.has(shellId) &&
                        saveProjectionQueue.sceneImageTargets.has(shellId),
                    "loading a save preserves an uninspected NPC's stable identity, notes, scene presence, and image target without inventing a full character",
                    { restoredShell, scene: app.state.scene },
                );
                const restoredNormalPrompt = buildImagePrompt(shellName, restoredShell);
                const restoredProfilePrompt = buildProfileImagePrompt(shellName, restoredShell);
                devAssert(
                    isUninspectedNpcPreviewEntity(restoredShell) &&
                        [restoredNormalPrompt, restoredProfilePrompt].every((prompt) =>
                            prompt.includes(restoredShell.note) &&
                            prompt.includes(restoredShell.current_appearance) &&
                            !/average adult height|average-soft upper-body|naked|topless|bottomless|visible genitals/i.test(prompt),
                        ),
                    "restored uninspected NPC image prompts retain visible appearance and clothing instead of defaulting body values or inferring nudity",
                    { restoredNormalPrompt, restoredProfilePrompt },
                );
                const resavedShell = await characterSaveOperations(shellOwner);
                devAssert(
                    resavedShell.length === 1 &&
                        resavedShell[0].type === "npc.shell.put" &&
                        resavedShell[0].shell.characterId === shellId,
                    "a restored uninspected NPC can be saved again with the same identity",
                    resavedShell,
                );
                await app.persistence.submitOperations("runtime-mutation", [
                    ...resavedShell,
                    { type: "scene.member.remove", characterId: shellId },
                    { type: "npc.shell.delete", characterId: shellId },
                    { type: "runtime.records.replace", storeName: "sceneImageTargets", records: [] },
                ]);
                await loadSaveIntoRuntime(String(saveId), { showCompatibilityNotice: false });

                await app.persistence.submitOperations("runtime-mutation", [
                    { type: "party.member.remove", characterId: ally.id },
                    { type: "scene.member.add", characterId: ally.id },
                    {
                        type: "runtime.records.replace",
                        storeName: "sceneImageTargets",
                        records: [{ characterId: ally.id }],
                    },
                ]);
                const orphanedSceneRuntime = await app.library.reconstructRuntimeSave(saveId);
                devAssert(
                    !orphanedSceneRuntime.state?.characters?.[ally.name] &&
                        !orphanedSceneRuntime.state?.scene?.party_members_present?.includes(
                            ally.name,
                        ) &&
                        !orphanedSceneRuntime.state?.scene?.npcs_present?.includes(ally.name) &&
                        !orphanedSceneRuntime.state?.scene?.image_characters?.includes(ally.name),
                    "save reconstruction discards scene and image-target relations without a materialized runtime owner",
                    {
                        characters: orphanedSceneRuntime.state?.characters,
                        scene: orphanedSceneRuntime.state?.scene,
                    },
                );
                await app.persistence.submitOperations("runtime-mutation", [
                    { type: "party.member.add", characterId: ally.id },
                    { type: "scene.member.add", characterId: ally.id },
                    {
                        type: "runtime.records.replace",
                        storeName: "sceneImageTargets",
                        records: [],
                    },
                ]);

                await app.persistence.submitOperations("runtime-mutation", []);
                await app.persistence.submitOperations("runtime-mutation", [
                    { type: "scene.member.remove", characterId: ally.id },
                ]);
                const afterParticipantRemoval = await app.persistence.loadSave(saveId, 40);
                const reconstructedAfterParticipantRemoval =
                    await app.library.reconstructRuntimeSave(saveId);
                let absentParticipantWriteError = "";
                const absentParticipantChangeId = app.persistence.activeSaveState.nextChangeId;
                try {
                    await app.persistence.submitOperations("runtime-mutation", [{
                        type:"runtime.records.replace",storeName:"sceneImageTargets",
                        records:[{saveId,position:0,characterId:"smoke-missing-character"}],
                    }]);
                }
                catch (error) {
                    absentParticipantWriteError = String(error?.message || error);
                }
                devAssert(!!absentParticipantWriteError,"normalized persistence rejects an image target without a runtime character",{absentParticipantWriteError});
                await app.persistence.replacePendingTransaction(
                    absentParticipantChangeId,
                    "runtime-mutation",
                    [{ type: "scene.member.add", characterId: ally.id }],
                );
                devAssert(
                    app.persistence.activeSaveState.lastAcknowledgedChangeId >=
                        absentParticipantChangeId,
                    "a rejected normalized transaction can be replaced in place without blocking later changes",
                    {
                        absentParticipantChangeId,
                        activeSaveState: app.persistence.activeSaveState,
                    },
                );

                const rollbackMessage = app.messages.find(
                    (message) => message.text === "Normalized baseline.",
                );
                devAssert(!!rollbackMessage, "normalized baseline message reloads before rollback");
                rollbackMessage.stateSyncStatus = "synced";

                touchMessageRevision(rollbackMessage);
                const rollbackSnapshot = createMessageStateBackup(
                    [rollbackMessage.id],
                    "normalized processed message rollback smoke",
                );
                await flushRuntimeSaveProjections();

                app.state.scene.summary = "Normalized updated scene.";
                app.state.characters[ally.name].trust = 7;
                addMessage("assistant", "Normalized update persisted.", "Narrator");
                await flushRuntimeSaveProjections();
                const updated = await app.library.reconstructRuntimeSave(saveId);
                const updatedPage = await app.persistence.loadSave(saveId, 40);
                devAssert(
                    updated.state?.scene?.summary === "Normalized updated scene." &&
                        updated.state?.characters?.[ally.name]?.trust === 7 &&
                        updatedPage.recordsByStore?.messages?.some(
                            (message) => message.text === "Normalized update persisted.",
                        ),
                    "ordered normalized mutations persist isolated scene, character, and message changes",
                    {
                        scene: updated.state?.scene,
                        ally: updated.state?.characters?.[ally.name],
                        messages: updatedPage.recordsByStore?.messages,
                    },
                );

                const rollbackMutation = await prepareMessageStateMutation(
                    findMessageById(rollbackMessage.id),
                    { mode: "edit", reason: "normalized processed message rollback smoke" },
                );
                devAssert(
                    rollbackSnapshot &&
                        rollbackMutation?.restored === true &&
                        app.state.scene.summary === "Normalized baseline scene." &&
                        app.state.characters[ally.name].trust === 1 &&
                        !(app.messages || []).some(
                            (message) => message.text === "Normalized update persisted.",
                        ),
                    "editing a processed message rolls normalized persistence back through its snapshot without replacing the state root",
                    {
                        rollbackSnapshotId: rollbackSnapshot?.id,
                        rollbackMutation,
                        scene: app.state.scene,
                        ally: app.state.characters[ally.name],
                        messages: app.messages,
                    },
                );

                const importedAlly = devSmokeRuntimeCharacter(
                    "Runtime Imported Ally",
                    {
                        gender: "female",
                        role: "newly imported runtime ally",
                        trust: 2,
                    },
                );
                app.state.characters[importedAlly.name] = importedAlly;
                app.state.characters[importedAlly.name].trust = 6;
                await flushRuntimeSaveProjections();
                const afterRuntimeImport = await app.persistence.loadSave(saveId, 40);
                const reconstructedAfterRuntimeImport =
                    await app.library.reconstructRuntimeSave(saveId);
                const importedCharacterId = importedAlly.id;
                const importedCharacterStores = [
                    "saveCharacterDefinitions",
                    "characterAppearance",
                    "characterSettings",
                    "characterDurableState",
                    "characterRelationshipStats",
                    "characterSceneState",
                    "characterOutfits",
                    "equippedItems",
                ];
                devAssert(
                    importedCharacterStores.every((storeName) =>
                        (afterRuntimeImport.recordsByStore?.[storeName] || []).some(
                            (record) => record.characterId === importedCharacterId,
                        ),
                    ) &&
                        reconstructedAfterRuntimeImport.state?.characters?.[
                            importedAlly.name
                        ]?.trust === 6,
                    "adding a runtime character materializes its complete normalized records before coalesced field updates",
                    {
                        importedCharacterId,
                        stores: Object.fromEntries(
                            importedCharacterStores.map((storeName) => [
                                storeName,
                                (afterRuntimeImport.recordsByStore?.[storeName] || [])
                                    .filter(
                                        (record) =>
                                            record.characterId === importedCharacterId,
                                    ),
                            ]),
                        ),
                        reconstructed:
                            reconstructedAfterRuntimeImport.state?.characters?.[
                                importedAlly.name
                            ],
                    },
                );

                const historicalImageId = "storage-smoke-historical-character-image";
                await app.persistence.submitOperations("runtime-mutation", [
                    {
                        type: "story.image.put",
                        image: {
                            imageId: historicalImageId,
                            at: new Date().toISOString(),
                            favorite: false,
                            model: "smoke",
                            prompt: "Historical image target smoke fixture.",
                            negativePrompt: "",
                            status: "ready",
                            url: "https://example.invalid/storage-smoke-image.png",
                        },
                    },
                    {
                        type: "story.image.target.put",
                        imageId: historicalImageId,
                        characterId: importedCharacterId,
                    },
                    { type: "party.member.remove", characterId: importedCharacterId },
                ]);
                await loadSaveIntoRuntime(String(saveId));
                const historicalImage = app.images.find((image) => image.id === historicalImageId);
                const historicalImageOperations = imageSaveOperations({
                    operation: "put",
                    id: historicalImageId,
                });
                devAssert(
                    !app.state.characters?.[importedAlly.name] &&
                        historicalImage?.targets?.includes(importedCharacterId) &&
                        historicalImageOperations.length === 1 &&
                        historicalImageOperations[0].type === "story.image.put",
                    "loading and updating a historical image keeps its target after the character leaves runtime state",
                    {
                        runtimeCharacter: app.state.characters?.[importedAlly.name],
                        imageTargets: historicalImage?.targets,
                        operations: historicalImageOperations,
                    },
                );

                await app.persistence.submitOperations("runtime-mutation", [
                    { type: "party.member.add", characterId: importedCharacterId },
                    { type: "scene.member.add", characterId: importedCharacterId },
                    { type: "scene.member.add", characterId: ally.id },
                ]);
                await app.persistence.submitOperations("runtime-mutation", [
                    { type: "character.delete", characterId: ally.id },
                ]);
                const afterParticipantDelete = await app.persistence.loadSave(saveId, 40);
                const reconstructedAfterParticipantDelete = await app.library.reconstructRuntimeSave(saveId);
                const remainingActs = afterParticipantDelete.recordsByStore?.sceneSexActs || [];

                const exported = await app.persistence.exportSave(saveId);
                const payload = JSON.parse(await exported.blob.text());
                devAssert(
                    payload.exportType === "normalized-save" &&
                        payload.schemaVersion === app.persistence.schemaInfo?.version &&
                        Array.isArray(payload.records?.saveHeaders) &&
                        !Object.values(payload.records || {}).some((records) =>
                            (records || []).some((record) =>
                                Object.hasOwn(record || {}, "objectives"),
                            ),
                        ),
                    "normalized save export is portable without embedding mutable objective definitions",
                    { exportType: payload.exportType, schemaVersion: payload.schemaVersion },
                );

                await app.persistence.closeActiveSave();
                app.saveSessionActive = false;
                app.saveSessionContext = null;
                cancelSaveProjectionFlush();
                await app.persistence.deleteSave(saveId);
                const remaining = await app.persistence.listSaves({  });
                devAssert(
                    !(remaining.entries || []).some((header) => header.saveId === saveId),
                    "normalized save deletion removes every save-owned record",
                    remaining,
                );
                setActiveSaveId("");
                devTestLog("Scenario complete: save-storage-isolation-smoke");
            } finally {
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        function devExtensiveSupabaseRequestSummary(requests = []) {
            return requests.map((request) => {
                const route = String(request.path || "").split("?")[0];
                return `${request.method || "GET"} ${route}`;
            });
        }

        function devAssertExtensiveSupabaseRequestPhase(
            requests,
            startIndex,
            expected,
            label,
        ) {
            const actual = devExtensiveSupabaseRequestSummary(
                requests.slice(startIndex),
            );
            devAssert(
                JSON.stringify(actual) === JSON.stringify(expected),
                `${label} used exactly the expected Supabase requests`,
                { expected, actual, requests: requests.slice(startIndex) },
            );
            return requests.length;
        }

        function devCloseLatestExtensiveSupabasePopup() {
            const popup = [...document.querySelectorAll(".popup-modal.open")].at(-1);
            if (popup) popup.remove();
            else closeModal({ ignoreCloseDestination: true });
        }

        function devExtensiveSupabaseLocalProfileImage({
            id,
            characterId,
            ownerName,
            male,
            variant,
        }) {
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 768;
            const context = canvas.getContext("2d");
            let randomState = (Number(variant || 1) * 2654435761) >>> 0;
            const nextRandom = () => {
                randomState ^= randomState << 13;
                randomState ^= randomState >>> 17;
                randomState ^= randomState << 5;
                return randomState >>> 0;
            };
            for (let y = 0; y < canvas.height; y += 8) {
                for (let x = 0; x < canvas.width; x += 8) {
                    const color = nextRandom();
                    context.fillStyle = `rgb(${color & 255}, ${(color >>> 8) & 255}, ${(color >>> 16) & 255})`;
                    context.fillRect(x, y, 8, 8);
                }
            }
            const imageDataUrl = canvas.toDataURL("image/jpeg", 0.88);
            return createProfileImageRecord({
                id,
                character_id: characterId,
                owner_name: ownerName,
                male: male === true,
                html: `<img src="${imageDataUrl}" alt="${escapeHtml(ownerName)} smoke profile">`,
                pending: false,
                error: "",
                reason: "extensive Supabase live publish fixture",
                prompt: `Extensive Supabase ${male ? "male" : "non-male"} profile fixture.`,
                seed: Number(variant || 0),
            });
        }

        function devExtensiveSupabaseCharacterRecord({
            definitionId,
            creatorIdentity,
            version,
            maleImageId,
            nonMaleImageId,
        }) {
            const versionTwo = version === 2;
            const maleName = versionTwo
                ? `Extensive Rowan Revised ${definitionId}`
                : `Extensive Rowan ${definitionId}`;
            const nonMaleName = versionTwo
                ? `Extensive Rhea Revised ${definitionId}`
                : `Extensive Rhea ${definitionId}`;
            const name = nonMaleName;
            const seed = versionTwo ? 987654321 : 123456789;
            const record = devSmokeCharacterRecord(name, {
                age: versionTwo ? 39 : 31,
                role: versionTwo ? "revised astral cartographer" : "astral cartographer",
                genres: versionTwo ? ["fantasy", "sci-fi"] : ["fantasy"],
                character: {
                    id: definitionId,
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                    creation_tool: "EmberAdventures extensive Supabase test",
                    default_seed: seed,
                    gender: "female",
                    age: versionTwo ? 39 : 31,
                    role: versionTwo
                        ? "revised astral cartographer"
                        : "astral cartographer",
                    speech_style: versionTwo
                        ? "Precise, dry, and noticeably more confident."
                        : "Precise, observant, and quietly curious.",
                    genres: versionTwo
                        ? ["fantasy", "sci-fi"]
                        : ["fantasy"],
                },
                record: {
                    id: definitionId,
                    source: "Original",
                    creator: creatorIdentity.creator_name,
                    creator_id: creatorIdentity.creator_id,
                },
            });
            record.name = name;
            record.role = record.character.role;
            record.character.name = name;
            record.character.fallback_name = maleName;
            record.character.appearance.species = versionTwo
                ? "starborn human"
                : "human";
            const maleSlot = profileImageSlotFromExactInput({
                ...emptyProfileImageSlot(true),
                local_image_id: maleImageId,
                source: `extensive Supabase v${version} male image`,
                seed,
                prompt: `Extensive Supabase v${version} male profile image.`,
                male: true,
            });
            const nonMaleSlot = profileImageSlotFromExactInput({
                ...emptyProfileImageSlot(false),
                local_image_id: nonMaleImageId,
                source: `extensive Supabase v${version} non-male image`,
                seed,
                prompt: `Extensive Supabase v${version} non-male profile image.`,
                male: false,
            });
            record.character.default_profile_image = clone(nonMaleSlot);
            record.character.profile_image_presentations =
                createProfileImagePresentations({
                    male: maleSlot,
                    non_male: nonMaleSlot,
                });
            return assertValidCharacterLibraryRecord(record);
        }

        async function devRunExtensiveSupabaseCharacterLifecycleSmokeTest(
            options = {},
        ) {
            const phase = String(options.phase || "all");
            const scenarioId = String(
                options.scenarioId ||
                    "extensive-supabase-character-lifecycle-smoke",
            );
            const runFailureBoundaries =
                phase === "all" || phase === "publish-failures";
            const runRevisionLifecycle =
                phase === "all" || phase === "revision-lifecycle";
            const runConcurrentPublishing =
                phase === "all" || phase === "concurrent-publishing";
            devTestLog(
                `Scenario start: ${scenarioId}`,
            );
            devAssert(
                publicLibrarySupabaseConfigured(),
                "Supabase is configured for the extensive character lifecycle test",
            );
            devAssert(
                hostedUploadSupported(),
                "Perchance uploads are available for the extensive character lifecycle test",
            );
            const uploads = [];
            const publishedResults = [];
            const requests = [];
            const deletedUploadUrls = [];
            const originalPublicLibraryFetch = publicLibraryFetch;
            const originalUploadBlobToUserUploads = uploadBlobToUserUploads;
            const originalUploadCompressedJson = uploadCompressedJson;
            const originalDeleteHostedUpload = deleteHostedUpload;
            const originalCaches = {
                lastIndex: app.publicLibraryLastIndex
                    ? clone(app.publicLibraryLastIndex)
                    : null,
                ownedIndex: app.publicLibraryOwnedIndex
                    ? clone(app.publicLibraryOwnedIndex)
                    : null,
                ownedCharacters: clone(
                    app.characterLibraryOwnedCharacterEntries || [],
                ),
                publicSearch: app.characterLibraryPublicSearch
                    ? clone(app.characterLibraryPublicSearch)
                    : null,
                versionState: clone(
                    app.ownedPublicLibraryVersionStateCache || {},
                ),
                versionHistory: clone(app.publicLibraryVersionHistory || {}),
                hiddenMembership: clone(
                    app.hiddenPublicLibraryCacheMembership || {},
                ),
                definitions: clone(app.characterDefinitions || []),
                profileImages: clone(app.profileImages || []),
                publicPayloads: { ...(app.characterLibraryPublicPayloads || {}) },
                profileOverrides: clone(app.profileEntityOverrides || {}),
            };
            let requestStart = 0;
            let cleanupOwnerId = "";
            let cleanupCreatorId = "";
            let cleanupDefinitionId = "";
            let cleanupConcurrentDefinitionId = "";
            let lifecyclePassed = false;
            let forcedSupabaseFailurePath = "";
            publicLibraryFetch = async (path, options = {}, didRetry = false) => {
                requests.push({
                    method: options.method || "GET",
                    path: String(path || ""),
                    auth: options.auth !== false,
                });
                if (
                    forcedSupabaseFailurePath &&
                    String(path || "").split("?")[0] === forcedSupabaseFailurePath
                )
                    throw new Error(
                        `Intentional extensive smoke Supabase outage at ${forcedSupabaseFailurePath}.`,
                    );
                return originalPublicLibraryFetch(path, options, didRetry);
            };
            deleteHostedUpload = async (upload, reason = "") => {
                const deleted = await originalDeleteHostedUpload(upload, reason);
                if (deleted && upload?.url)
                    deletedUploadUrls.push(String(upload.url));
                return deleted;
            };
            try {
                if (!app.supabaseSession?.access_token)
                    throw new Error(
                        "Extensive Supabase Tests require a signed-in Supabase session.",
                    );
                const user = await publicLibraryRefreshCurrentUser();
                if (!user?.id)
                    throw new Error(
                        "Extensive Supabase Tests require a signed-in Supabase account.",
                    );
                cleanupOwnerId = user.id;
                const authenticationRequests =
                    devExtensiveSupabaseRequestSummary(
                        requests.slice(requestStart),
                    );
                const validAuthenticationRequests = [
                    [
                        "GET /auth/v1/user",
                        "GET /rest/v1/creator_identities",
                    ],
                    [
                        "GET /auth/v1/user",
                        "POST /auth/v1/token",
                        "GET /auth/v1/user",
                        "GET /rest/v1/creator_identities",
                    ],
                ];
                devAssert(
                    validAuthenticationRequests.some(
                        (expected) =>
                            JSON.stringify(authenticationRequests) ===
                            JSON.stringify(expected),
                    ),
                    "current-user authentication used no unnecessary Supabase refresh request",
                    {
                        expected: validAuthenticationRequests,
                        actual: authenticationRequests,
                        requests: requests.slice(requestStart),
                    },
                );
                requestStart = requests.length;
                const creatorIdentity = await devCreateTemporaryPublicHostingCreator(user);
                cleanupCreatorId = creatorIdentity.creator_id;
                const localCreator = createCreatorIdentityRecord(creatorIdentity);
                creatorIdentityRegistry().identities.push(localCreator);
                saveCreatorIdentityRegistry("temporary extensive smoke creator registered");
                devAssert(creatorIdentityById(localCreator.creator_id)?.owner_user_id === user.id,
                    "temporary creator is locally registered to the authenticated owner");
                await ensureCreatorIdentityInSupabase(localCreator.creator_id, localCreator.creator_name);
                await ensureCreatorIdentityInSupabase(localCreator.creator_id, localCreator.creator_name);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/creator_identities"],
                    "temporary smoke creator creation",
                );
                try {
                    await publicLibraryFetch(
                        "/rest/v1/library_versions?select=visible,metadata_snapshot&limit=0",
                    );
                } catch (error) {
                    if (
                        /library_versions\.(?:visible|metadata_snapshot).*does not exist|column library_versions\.(?:visible|metadata_snapshot) does not exist/i.test(
                            String(error?.message || error),
                        )
                    ) {
                        throw new Error(
                            "The live Supabase public-library schema is outdated. Run tasks/supabase-library-version-visibility.sql in the Supabase SQL Editor before running Extensive Supabase Tests.",
                        );
                    }
                    throw error;
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["GET /rest/v1/library_versions"],
                    "per-version visibility schema preflight",
                );
                try {
                    await publicLibraryFetch(
                        "/rest/v1/rpc/owned_library_hidden_previews",
                        {
                            method: "POST",
                            body: { target_item_ids: [] },
                        },
                    );
                } catch (error) {
                    if (
                        /PGRST202|owned_library_hidden_previews|could not find the function|schema cache/i.test(
                            String(error?.message || error),
                        )
                    )
                        throw new Error(
                            "The live Supabase public-library schema is missing batched hidden-version previews. Run tasks/supabase-library-version-visibility.sql in the Supabase SQL Editor before running Extensive Supabase Tests.",
                        );
                    throw error;
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/owned_library_hidden_previews"],
                    "hidden-version preview schema preflight",
                );
                const directMutationProbes = [
                    {
                        path: "/rest/v1/library_items",
                        options: { method: "POST", body: {} },
                    },
                    {
                        path: "/rest/v1/library_items?id=eq.00000000-0000-4000-8000-000000000001",
                        options: { method: "PATCH", body: { visibility: "hidden" } },
                    },
                    {
                        path: "/rest/v1/library_versions",
                        options: { method: "POST", body: {} },
                    },
                    {
                        path: "/rest/v1/library_versions?id=eq.00000000-0000-4000-8000-000000000001",
                        options: { method: "DELETE" },
                    },
                ];
                const directMutationFailures = [];
                for (const probe of directMutationProbes) {
                    let failure = null;
                    try {
                        await publicLibraryFetch(probe.path, probe.options);
                    } catch (error) {
                        failure = error;
                    }
                    directMutationFailures.push(failure);
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/library_items",
                        "PATCH /rest/v1/library_items",
                        "POST /rest/v1/library_versions",
                        "DELETE /rest/v1/library_versions",
                    ],
                    "direct publication mutation rejection",
                );
                devAssert(
                    directMutationFailures.every(
                        (error) =>
                            !!error &&
                            /401|403|permission denied|insufficient privilege/i.test(
                                String(error?.message || error),
                            ),
                    ),
                    "authenticated clients cannot bypass publication RPCs with direct item or version writes",
                    {
                        errors: directMutationFailures.map(
                            (error) => error?.message || String(error || ""),
                        ),
                        requiredSqlPatches: [
                            "tasks/supabase-library-version-visibility.sql",
                            "tasks/supabase-atomic-public-library-publish.sql",
                        ],
                    },
                );
                let itemVisibilityProbeFailure = null;
                try {
                    await publicLibraryFetch(
                        "/rest/v1/rpc/set_owned_library_item_visibility",
                        {
                            method: "POST",
                            body: {
                                target_item_id:
                                    "00000000-0000-4000-8000-000000000001",
                                target_visible: false,
                            },
                        },
                    );
                } catch (error) {
                    itemVisibilityProbeFailure = error;
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/set_owned_library_item_visibility"],
                    "owner item-visibility RPC schema preflight",
                );
                devAssert(
                    !!itemVisibilityProbeFailure &&
                        !/PGRST202|could not find the function|schema cache/i.test(
                            String(
                                itemVisibilityProbeFailure?.message ||
                                    itemVisibilityProbeFailure,
                            ),
                        ),
                    "the owner item-visibility RPC exists and rejects an unknown item",
                    {
                        error:
                            itemVisibilityProbeFailure?.message ||
                            String(itemVisibilityProbeFailure || ""),
                    },
                );
                try {
                    await publicLibraryFetch(
                        "/rest/v1/rpc/public_library_publish_preflight",
                        {
                            method: "POST",
                            body: {
                                target_type: "character",
                                target_definition_id:
                                    "extensive-supabase-schema-probe",
                                target_creator_id: creatorIdentity.creator_id,
                            },
                        },
                    );
                } catch (error) {
                    if (
                        /public_library_publish_preflight|could not find the function|schema cache/i.test(
                            String(error?.message || error),
                        )
                    )
                        throw new Error(
                            "The live Supabase public-library schema is missing atomic publishing. Run tasks/supabase-atomic-public-library-publish.sql in the Supabase SQL Editor before running Extensive Supabase Tests.",
                        );
                    throw error;
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/public_library_publish_preflight"],
                    "atomic publishing schema preflight",
                );
                let anonymousMutationFailure = null;
                try {
                    await publicLibraryFetch(
                        "/rest/v1/rpc/publish_public_library_item_version",
                        {
                            method: "POST",
                            auth: false,
                            body: {
                                item_payload: {},
                                version_payload: {},
                            },
                        },
                    );
                } catch (error) {
                    anonymousMutationFailure = error;
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/publish_public_library_item_version"],
                    "anonymous publish rejection",
                );
                devAssert(
                    !!anonymousMutationFailure &&
                        /401|403|permission|authentication|not found|schema cache/i.test(
                            String(
                                anonymousMutationFailure?.message ||
                                    anonymousMutationFailure,
                            ),
                        ),
                    "the live atomic publish RPC rejects unauthenticated mutation attempts",
                    {
                        error:
                            anonymousMutationFailure?.message ||
                            String(anonymousMutationFailure || ""),
                    },
                );
                const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const definitionId = `extensive-supabase-character-${nonce}`;
                cleanupDefinitionId = definitionId;
                const imageIds = {
                    v1Male: `${definitionId}-v1-male`,
                    v1NonMale: `${definitionId}-v1-non-male`,
                    v2Male: `${definitionId}-v2-male`,
                    v2NonMale: `${definitionId}-v2-non-male`,
                };
                const v1Record = devExtensiveSupabaseCharacterRecord({
                    definitionId,
                    creatorIdentity,
                    version: 1,
                    maleImageId: imageIds.v1Male,
                    nonMaleImageId: imageIds.v1NonMale,
                });
                const v2Record = devExtensiveSupabaseCharacterRecord({
                    definitionId,
                    creatorIdentity,
                    version: 2,
                    maleImageId: imageIds.v2Male,
                    nonMaleImageId: imageIds.v2NonMale,
                });
                const localImages = [
                    devExtensiveSupabaseLocalProfileImage({
                        id: imageIds.v1Male,
                        characterId: definitionId,
                        ownerName: v1Record.name,
                        male: true,
                        variant: 1,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: imageIds.v1NonMale,
                        characterId: definitionId,
                        ownerName: v1Record.name,
                        male: false,
                        variant: 2,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: imageIds.v2Male,
                        characterId: definitionId,
                        ownerName: v2Record.name,
                        male: true,
                        variant: 3,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: imageIds.v2NonMale,
                        characterId: definitionId,
                        ownerName: v2Record.name,
                        male: false,
                        variant: 4,
                    }),
                ];
                app.profileImages = exactProfileImageStore([
                    ...localImages,
                    ...(app.profileImages || []),
                ]);
                devAssert(
                    localImages.every((image) => String(image.html || "").length > 50000),
                    "extensive publishing uses realistic deterministic profile-image payloads instead of 1x1 transport fixtures",
                    { imageHtmlLengths: localImages.map((image) => image.html.length) },
                );

                if (runFailureBoundaries) {
                const failureDefinitionIds = [];
                const createFailureFixture = (suffix) => {
                    const failureDefinitionId = `${definitionId}-failure-${suffix}`;
                    failureDefinitionIds.push(failureDefinitionId);
                    const maleImageId = `${failureDefinitionId}-male`;
                    const nonMaleImageId = `${failureDefinitionId}-non-male`;
                    const record = devExtensiveSupabaseCharacterRecord({
                        definitionId: failureDefinitionId,
                        creatorIdentity,
                        version: 1,
                        maleImageId,
                        nonMaleImageId,
                    });
                    const images = [
                        devExtensiveSupabaseLocalProfileImage({
                            id: maleImageId,
                            characterId: failureDefinitionId,
                            ownerName: record.name,
                            male: true,
                            variant: suffix.length * 7 + 1,
                        }),
                        devExtensiveSupabaseLocalProfileImage({
                            id: nonMaleImageId,
                            characterId: failureDefinitionId,
                            ownerName: record.name,
                            male: false,
                            variant: suffix.length * 7 + 2,
                        }),
                    ];
                    app.profileImages = exactProfileImageStore([
                        ...images,
                        ...(app.profileImages || []),
                    ]);
                    return { record, images };
                };
                const runFailureBoundary = async ({
                    label,
                    configure,
                    expectedRequests,
                    expectedDeletedUploads,
                    expectedProtectedUploads = 0,
                }) => {
                    const fixture = createFailureFixture(label.replace(/\W+/g, "-"));
                    const deletedBefore = deletedUploadUrls.length;
                    const pendingBefore = new Set(pendingPublicUploadLedger().map((entry) => entry.deletionUrl));
                    configure();
                    let result = null;
                    try {
                        result = await publishCharacterRecordsToPublicIndex(
                            [fixture.record],
                            `extensive failure ${label}`,
                            {
                                testUpload: true,
                                skipPublishConfirm: true,
                            },
                        );
                    } finally {
                        uploadBlobToUserUploads = originalUploadBlobToUserUploads;
                        uploadCompressedJson = originalUploadCompressedJson;
                        forcedSupabaseFailurePath = "";
                    }
                    requestStart = devAssertExtensiveSupabaseRequestPhase(
                        requests,
                        requestStart,
                        expectedRequests,
                        `${label} failure boundary`,
                    );
                    const protectedUploads = pendingPublicUploadLedger().filter((entry) =>
                        !pendingBefore.has(entry.deletionUrl) && entry.publicationAttempted === true,
                    );
                    devAssert(
                        protectedUploads.length === expectedProtectedUploads,
                        `${label} retains exactly the uploads whose publication may have been accepted`,
                        { protectedUploadCount: protectedUploads.length, expectedProtectedUploads },
                    );
                    devAssert(
                        result === null &&
                            deletedUploadUrls.length - deletedBefore ===
                                expectedDeletedUploads,
                        `${label} failure follows cleanup rules for its metadata submission boundary`,
                        {
                            result,
                            deletedUploads: deletedUploadUrls.slice(deletedBefore),
                            expectedDeletedUploads,
                        },
                    );
                };

                await runFailureBoundary({
                    label: "Supabase preflight outage",
                    configure: () => {
                        forcedSupabaseFailurePath =
                            "/rest/v1/rpc/public_library_publish_preflight";
                    },
                    expectedRequests: [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                    ],
                    expectedDeletedUploads: 0,
                });
                await runFailureBoundary({
                    label: "second profile image upload",
                    configure: () => {
                        let calls = 0;
                        uploadBlobToUserUploads = async (...args) => {
                            calls += 1;
                            if (calls === 2)
                                throw new Error(
                                    "Intentional extensive smoke second profile upload failure.",
                                );
                            return originalUploadBlobToUserUploads(...args);
                        };
                    },
                    expectedRequests: [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                    ],
                    expectedDeletedUploads: 1,
                });
                await runFailureBoundary({
                    label: "character payload upload",
                    configure: () => {
                        uploadCompressedJson = async () => {
                            throw new Error(
                                "Intentional extensive smoke character payload upload failure.",
                            );
                        };
                    },
                    expectedRequests: [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                    ],
                    expectedDeletedUploads: 2,
                });
                await runFailureBoundary({
                    label: "atomic Supabase publish outage",
                    configure: () => {
                        forcedSupabaseFailurePath =
                            "/rest/v1/rpc/publish_public_library_item_version";
                    },
                    expectedRequests: [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                    ],
                    expectedDeletedUploads: 0,
                    expectedProtectedUploads: 3,
                });
                const partialFailureRows =
                    (await publicLibraryFetch(
                        `/rest/v1/library_items?select=id,definition_id&owner_user_id=eq.${postgrestValue(user.id)}&definition_id=like.${postgrestValue(`${definitionId}-failure-*`)}`,
                    )) || [];
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["GET /rest/v1/library_items"],
                    "partial publish orphan verification",
                );
                devAssert(
                    partialFailureRows.length === 0,
                    "every interrupted publish boundary left Supabase without a partial character item or revision",
                    { partialFailureRows, failureDefinitionIds },
                );
                }

                if (runRevisionLifecycle) {
                app.publicLibraryLastIndex = publicLibraryEmptyIndex();
                app.publicLibraryOwnedIndex = publicLibraryEmptyIndex();
                app.characterLibraryOwnedCharacterEntries = [];
                app.characterLibraryPublicSearch = {
                    ...(app.characterLibraryPublicSearch || {}),
                    items: [],
                };
                app.ownedPublicLibraryVersionStateCache = {};
                app.publicLibraryVersionHistory = {};
                app.hiddenPublicLibraryCacheMembership = {};

                const firstPublish = await publishCharacterRecordsToPublicIndex(
                    [v1Record],
                    "extensive Supabase character v1",
                    {
                        testUpload: true,
                        skipPublishConfirm: true,
                    },
                );
                const firstResult = firstPublish?.result?.results?.[0];
                if (!firstResult)
                    throw new Error("The real v1 character publish did not return a Supabase result.");
                uploads.push(firstPublish.upload, ...(firstPublish.imageUploads || []));
                publishedResults.push(firstResult);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                    ],
                    "real initial character publish",
                );
                const itemId = firstResult.item.id;
                const v1VersionId = firstResult.version.id;
                const v1MaleImage = firstResult.entry.male_image_url;
                const v1NonMaleImage = firstResult.entry.non_male_image_url;
                devAssert(
                    uploads.length === 3 &&
                        uploads.every(
                            (upload) =>
                                upload?.expiresInSeconds === TEST_UPLOAD_EXPIRES_IN_SECONDS &&
                                !!hostedUploadDeletionUrl(upload),
                        ) &&
                        (firstPublish.imageUploads || []).every(
                            (imageUpload) => Number(imageUpload.size || 0) > 50000,
                        ) &&
                        firstPublish.upload?.compressed === true &&
                        Number(firstPublish.upload?.rawPayloadSizeBytes || 0) > 2500 &&
                        Number(firstPublish.upload?.payloadSizeBytes || 0) <
                            Number(firstPublish.upload?.rawPayloadSizeBytes || 0),
                    "real v1 publishing uploaded realistic profile images and a substantial character payload with one-day expiry and deletion URLs",
                    { uploads },
                );
                devAssert(
                    ownedPublicLibraryEntryById(itemId)?.name === v1Record.name &&
                        publicLibraryEntryById(itemId)?.non_male_image_url ===
                            v1NonMaleImage,
                    "v1 immediately populated Mine and Public caches",
                );

                let atomicFailure = null;
                try {
                    await publicLibraryFetch(
                        "/rest/v1/rpc/publish_public_library_item_version",
                        {
                            method: "POST",
                            body: {
                                item_payload: {
                                    ...publicLibraryItemPayloadForDb(
                                        firstResult.entry,
                                    ),
                                    name: `Atomic Rollback Must Not Persist ${nonce}`,
                                },
                                version_payload: {
                                    payload_url: "",
                                    payload_sha256: null,
                                    payload_size_bytes: null,
                                    image_url: v1NonMaleImage,
                                    change_summary:
                                        "Intentional extensive smoke rollback probe.",
                                },
                            },
                        },
                    );
                } catch (error) {
                    atomicFailure = error;
                }
                devAssert(
                    !!atomicFailure,
                    "an invalid version rejected the complete atomic publish transaction",
                    { atomicFailure: atomicFailure?.message || "" },
                );
                const rollbackOwned = await fetchOwnedPublicLibraryIndex({
                    mode: "characters",
                    pageSize: 50,
                    page: 0,
                });
                const rollbackOwnedHasHiddenPreview = (
                    rollbackOwned.items || []
                ).some((entry) => !entry.supabase_current_version_id);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                        "GET /rest/v1/library_items",
                        "GET /rest/v1/library_versions",
                        ...(rollbackOwnedHasHiddenPreview
                            ? ["POST /rest/v1/rpc/owned_library_hidden_previews"]
                            : []),
                    ],
                    "atomic publish rollback verification",
                );
                const rollbackEntry = (rollbackOwned.items || []).find(
                    (entry) => entry.definition_id === definitionId,
                );
                devAssert(
                    rollbackEntry?.name === v1Record.name &&
                        rollbackEntry?.supabase_current_version_id ===
                            v1VersionId,
                    "the failed atomic revision left v1 metadata and current version unchanged",
                    { rollbackEntry },
                );

                await openPublicCharacterLibraryDetail(itemId, "public");
                let detail = [
                    ...document.querySelectorAll("[data-character-library-layer]"),
                ].at(-1);
                devAssert(
                    /Download \/ Import/.test(detail?.textContent || "") &&
                        !/\bManage\b/.test(detail?.textContent || ""),
                    "the owner sees consumer controls when opening v1 from Public",
                );
                devCloseLatestExtensiveSupabasePopup();
                const mineCardHost = document.createElement("div");
                mineCardHost.innerHTML = publicCharacterLibraryCardHtml(
                    ownedPublicLibraryEntryById(itemId),
                    { owned: true },
                );
                document.body.append(mineCardHost);
                mineCardHost
                    .querySelector("[data-public-character-card]")
                    ?.click();
                await devWaitFor(
                    () =>
                        ownedPublicLibraryVersionManagers(itemId)
                            .at(-1)
                            ?.querySelector(".public-version-view-button"),
                    3000,
                    "Mine published character card click to open version management",
                );
                mineCardHost.remove();
                const mineManager = ownedPublicLibraryVersionManagers(itemId).at(-1);
                devAssert(
                    /Manage Published Versions/.test(
                        mineManager?.textContent || "",
                    ) &&
                        !!mineManager?.querySelector(
                            ".public-version-view-button",
                        ) &&
                        !/Download \/ Import/.test(
                            mineManager?.textContent || "",
                        ),
                    "the owner opens version management directly from Mine",
                );
                devCloseLatestExtensiveSupabasePopup();
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/owned_library_version_state"],
                    "initial Public detail and Mine version-manager opens",
                );

                const secondPublish = await publishCharacterRecordsToPublicIndex(
                    [v2Record],
                    "extensive Supabase character v2",
                    {
                        testUpload: true,
                        skipPublishConfirm: true,
                    },
                );
                const secondResult = secondPublish?.result?.results?.[0];
                if (!secondResult)
                    throw new Error("The real v2 character publish did not return a Supabase result.");
                uploads.push(secondPublish.upload, ...(secondPublish.imageUploads || []));
                publishedResults.push(secondResult);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                    ],
                    "real character revision publish",
                );
                const v2VersionId = secondResult.version.id;
                const v2MaleImage = secondResult.entry.male_image_url;
                const v2NonMaleImage = secondResult.entry.non_male_image_url;
                devAssert(
                    uploads.length === 6 &&
                        new Set(uploads.map((upload) => upload.url)).size === 6 &&
                        uploads.every(
                            (upload) =>
                                upload?.expiresInSeconds === TEST_UPLOAD_EXPIRES_IN_SECONDS &&
                                !!hostedUploadDeletionUrl(upload),
                        ),
                    "both real revisions produced six distinct one-day Perchance uploads with deletion URLs",
                    { uploads },
                );
                for (const entry of [
                    ownedPublicLibraryEntryById(itemId),
                    publicLibraryEntryById(itemId),
                ]) {
                    devAssert(
                        entry?.name === v2Record.name &&
                            entry?.age === 39 &&
                            entry?.role === "revised astral cartographer" &&
                            entry?.species === "starborn human" &&
                            entry?.male_image_url === v2MaleImage &&
                            entry?.non_male_image_url === v2NonMaleImage,
                        "v2 name, age, role, species, and both images replaced the cached v1 card",
                        { entry },
                    );
                }
                const downloadedV2 = characterImportRecordsFromExport(
                    await fetchJsonFromPublicUploadUrl(secondResult.entry.url),
                )[0];
                const downloadedV2Definition =
                    downloadedV2?.character_definition;


                app.publicLibraryVersionHistory = {};
                await openPublicLibraryVersionHistoryModal(itemId);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["GET /rest/v1/library_versions"],
                    "real public version-history fetch",
                );
                const publicVersions =
                    app.publicLibraryVersionHistory?.[itemId] || [];
                const historyPopup = document.querySelector(
                    "[data-public-library-version-history]",
                );
                devAssert(
                    publicVersions.length === 2 &&
                        publicVersions[0]?.id === v2VersionId &&
                        publicVersions[1]?.id === v1VersionId &&
                        historyPopup?.querySelectorAll(
                            "button.primary:not([disabled])",
                        ).length === 2,
                    "public version history returned both real revisions with downloadable controls",
                    {
                        publicVersions,
                        html: historyPopup?.outerHTML || "",
                    },
                );
                devCloseLatestExtensiveSupabasePopup();

                const coldLoadPublishedCharacter = async ({
                    expectedName,
                    expectedVersionId,
                    expectedMaleImage,
                    expectedNonMaleImage,
                    label,
                }) => {
                    app.publicLibraryLastIndex = publicLibraryEmptyIndex();
                    app.publicLibraryOwnedIndex = publicLibraryEmptyIndex();
                    app.characterLibraryOwnedCharacterEntries = [];
                    app.characterLibraryPublicSearch = {
                        ...(app.characterLibraryPublicSearch || {}),
                        items: [],
                    };
                    const owned = await fetchOwnedPublicLibraryIndex({
                        mode: "characters",
                        pageSize: 50,
                        page: 0,
                    });
                    const rows =
                        (await publicLibraryFetch(
                            "/rest/v1/rpc/search_public_library_items",
                            {
                                method: "POST",
                                auth: false,
                                body: {
                                    item_type: "character",
                                    search_text: definitionId,
                                    creator_text: "",
                                    creation_tool_text: "",
                                    required_genres: [],
                                    ...EmberSharedLibraryFormat.searchScope(),
                                    sort_mode: "updated",
                                    cursor_value: null,
                                    cursor_id: null,
                                    result_limit: 10,
                                },
                            },
                        )) || [];
                    const ownedEntry = (owned.items || []).find(
                        (entry) => entry.definition_id === definitionId,
                    );
                    const publicEntry = rows
                        .map(publicLibraryRpcEntry)
                        .find((entry) => entry.definition_id === definitionId);
                    if (ownedEntry) {
                        app.characterLibraryOwnedCharacterEntries = [clone(ownedEntry)];
                        app.publicLibraryOwnedIndex.items = [clone(ownedEntry)];
                    }
                    if (publicEntry) {
                        app.characterLibraryPublicSearch.items = [clone(publicEntry)];
                        app.publicLibraryLastIndex.items = [clone(publicEntry)];
                    }
                    const ownedHasHiddenPreview = (owned.items || []).some(
                        (entry) => !entry.supabase_current_version_id,
                    );
                    requestStart = devAssertExtensiveSupabaseRequestPhase(
                        requests,
                        requestStart,
                        [
                            "GET /rest/v1/library_items",
                            "GET /rest/v1/library_versions",
                            ...(ownedHasHiddenPreview
                                ? ["POST /rest/v1/rpc/owned_library_hidden_previews"]
                                : []),
                            "POST /rest/v1/rpc/search_public_library_items",
                        ],
                        label,
                    );
                    for (const entry of [ownedEntry, publicEntry])
                        devAssert(
                            entry?.name === expectedName &&
                                entry?.supabase_current_version_id === expectedVersionId &&
                                entry?.male_image_url === expectedMaleImage &&
                                entry?.non_male_image_url === expectedNonMaleImage,
                            `${label} returned exact current metadata and both presentation images`,
                            { entry },
                        );
                    return { ownedEntry, publicEntry };
                };

                await coldLoadPublishedCharacter({
                    expectedName: v2Record.name,
                    expectedVersionId: v2VersionId,
                    expectedMaleImage: v2MaleImage,
                    expectedNonMaleImage: v2NonMaleImage,
                    label: "cold Mine and Public v2 reload",
                });
                const searchPublishedCharacter = async (searchText) =>
                    (await publicLibraryFetch(
                        "/rest/v1/rpc/search_public_library_items",
                        {
                            method: "POST",
                            auth: false,
                            body: {
                                item_type: "character",
                                search_text: searchText,
                                creator_text: "",
                                creation_tool_text: "",
                                required_genres: [],
                                ...EmberSharedLibraryFormat.searchScope(),
                                sort_mode: "updated",
                                cursor_value: null,
                                cursor_id: null,
                                result_limit: 25,
                            },
                        },
                    )) || [];
                const broadSearchRows = await searchPublishedCharacter("Extensive");
                const alternateName = characterPresentationNames(
                    v2Record.character,
                ).male;
                const alternateNameRows = await searchPublishedCharacter(alternateName);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/rpc/search_public_library_items",
                        "POST /rest/v1/rpc/search_public_library_items",
                    ],
                    "broad and alternate-name public discovery",
                );
                devAssert(
                    broadSearchRows.some(
                        (row) => row.definition_id === definitionId,
                    ) &&
                        alternateNameRows.some(
                            (row) => row.definition_id === definitionId,
                        ),
                    "the live public search discovers the character through broad text and its alternate presentation name",
                    {
                        alternateName,
                        broadIds: broadSearchRows.map((row) => row.definition_id),
                        alternateIds: alternateNameRows.map(
                            (row) => row.definition_id,
                        ),
                    },
                );
                const trackedPublicLibraryFetch = publicLibraryFetch;
                const paginationSearchSnapshot = clone(
                    app.characterLibraryPublicSearch || {},
                );
                const paginationCacheSnapshot = clone(
                    app.publicLibrarySearchCache || {
                        version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
                        entries: {},
                    },
                );
                const totalCountsSnapshot = clone(
                    app.publicLibraryTotalItemCounts || {},
                );
                const paginationRows = Array.from({ length: 57 }, (_, index) =>
                    devSmokeSupabasePublicSearchRow({
                        id: `extensive-pagination-${index + 1}`,
                        type: "character",
                        definition_id: `extensive-pagination-definition-${index + 1}`,
                        name: `Extensive Pagination Character ${index + 1}`,
                        male_name: `Extensive Pagination Man ${index + 1}`,
                        non_male_name: `Extensive Pagination Woman ${index + 1}`,
                        male_image_url: v2MaleImage,
                        non_male_image_url: v2NonMaleImage,
                        gender: "female",
                        age: 30,
                        species: "human",
                        role: "pagination fixture",
                        voice_gender: "female",
                        current_version_id: `extensive-pagination-version-${index + 1}`,
                        ordering_value: String(index + 1).padStart(4, "0"),
                    }),
                );
                const paginationBodies = [];
                try {
                    app.publicLibraryTotalItemCounts = {
                        ...(app.publicLibraryTotalItemCounts || {}),
                        character: paginationRows.length,
                    };
                    app.publicLibrarySearchCache = {
                        version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
                        entries: {},
                    };
                    app.characterLibraryPublicSearch = {
                        items: [],
                        hasNext: false,
                        cursor: null,
                        total: paginationRows.length,
                        skipCacheOnce: true,
                    };
                    publicLibraryFetch = async (path, options = {}) => {
                        if (
                            path !== "/rest/v1/rpc/search_public_library_items" ||
                            options.method !== "POST"
                        )
                            throw new Error(
                                `Unexpected deterministic pagination request: ${options.method || "GET"} ${path}`,
                            );
                        const body = clone(options.body || {});
                        paginationBodies.push(body);
                        const cursorIndex = body.cursor_id
                            ? paginationRows.findIndex(
                                  (row) => row.id === body.cursor_id,
                              ) + 1
                            : 0;
                        const limit = Number(body.result_limit || 1);
                        const page = paginationRows.slice(
                            cursorIndex,
                            cursorIndex + limit,
                        );
                        if (cursorIndex > 0)
                            page.unshift(paginationRows[cursorIndex - 1]);
                        return page.slice(0, limit);
                    };
                    await runPublicCharacterSearchPage({ reset: true });
                    let paginationGuard = 0;
                    while (
                        app.characterLibraryPublicSearch.hasNext &&
                        paginationGuard < 20
                    ) {
                        paginationGuard += 1;
                        await runPublicCharacterSearchPage({ reset: false });
                    }
                    const paginatedItems =
                        app.characterLibraryPublicSearch.items || [];
                    devAssert(
                        paginationGuard < 20 &&
                            paginatedItems.length === paginationRows.length &&
                            new Set(paginatedItems.map((item) => item.id)).size ===
                                paginationRows.length &&
                            paginationBodies.length > 1 &&
                            paginationBodies.every(
                                (body) => body.result_limit === 51,
                            ) &&
                            paginationBodies.slice(1).every(
                                (body) => body.cursor_id && body.cursor_value,
                            ),
                        "deterministic public pagination loads every result once and advances an exact cursor across duplicate boundary rows",
                        {
                            pageCount: paginationBodies.length,
                            itemCount: paginatedItems.length,
                            uniqueCount: new Set(
                                paginatedItems.map((item) => item.id),
                            ).size,
                            limits: paginationBodies.map(
                                (body) => body.result_limit,
                            ),
                            cursors: paginationBodies.map((body) => ({
                                value: body.cursor_value,
                                id: body.cursor_id,
                            })),
                        },
                    );
                } finally {
                    publicLibraryFetch = trackedPublicLibraryFetch;
                    app.characterLibraryPublicSearch = paginationSearchSnapshot;
                    app.publicLibrarySearchCache = paginationCacheSnapshot;
                    app.publicLibraryTotalItemCounts = totalCountsSnapshot;
                }

                app.profileImages = (app.profileImages || []).filter(
                    (image) => !Object.values(imageIds).includes(String(image.id || "")),
                );
                deleteProfileImageRecordsNow(
                    Object.values(imageIds).map((id) => ({ id })),
                    "extensive Supabase removes local fixtures before public import",
                );
                app.characterLibraryPublicPayloads ||= {};
                delete app.characterLibraryPublicPayloads[itemId];
                await importPublicLibraryEntryVersion(
                    itemId,
                    v1VersionId,
                    { showNotice: false },
                );
                const importedSpecificV1 = (app.characterDefinitions || []).find(
                    (record) => String(record.id || "") === definitionId,
                );
                devAssert(
                    importedSpecificV1?.character?.default_seed === 123456789 &&
                        importedSpecificV1?.character?.speech_style ===
                            "Precise, observant, and quietly curious.",
                    "real version-specific download imported v1 while v2 remained the public default",
                    { importedSpecificV1 },
                );
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [],
                    "cached version-specific v1 download",
                );
                delete app.characterLibraryPublicPayloads[itemId];
                const importedV2 = await importPublicCharacterToLibrary(itemId);
                const importedV2Record = importedV2?.[0];
                const importedV2Character = importedV2Record?.character;
                const importedV2Presentations = createProfileImagePresentations(
                    importedV2Character?.profile_image_presentations,
                );
                devAssert(
                    importedV2Record?.id === definitionId &&
                        importedV2Character?.default_seed === 987654321 &&
                        importedV2Presentations.male.local_image_id &&
                        importedV2Presentations.non_male.local_image_id &&
                        profileImageByStoreId(importedV2Presentations.male.local_image_id) &&
                        profileImageByStoreId(importedV2Presentations.non_male.local_image_id),
                    "real Public Download / Import fetched v2 payload and copied both hosted profile images locally without generation",
                    { importedV2Record },
                );

                await openOwnedPublicLibraryVersionManager(itemId);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    ["POST /rest/v1/rpc/owned_library_version_state"],
                    "first Manage open",
                );
                devCloseLatestExtensiveSupabasePopup();
                for (let round = 0; round < 3; round += 1) {
                    await openOwnedPublicLibraryVersionManager(itemId);
                    devCloseLatestExtensiveSupabasePopup();
                    await openPublicCharacterLibraryDetail(itemId, "public");
                    devCloseLatestExtensiveSupabasePopup();
                    await openPublicCharacterLibraryDetail(itemId, "mine");
                    devCloseLatestExtensiveSupabasePopup();
                }
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [],
                    "three cached Manage/Public/Mine open-close rounds",
                );

                const changeVisibility = async (versionId, visible, label) => {
                    const globalStatusBefore = app.statusText;
                    await openOwnedPublicLibraryVersionManager(itemId);
                    requestStart = devAssertExtensiveSupabaseRequestPhase(
                        requests,
                        requestStart,
                        [],
                        `${label} reopened cached Manage UI`,
                    );
                    await setOwnedPublicLibraryVersionVisibility(
                        itemId,
                        versionId,
                        visible,
                    );
                    requestStart = devAssertExtensiveSupabaseRequestPhase(
                        requests,
                        requestStart,
                        ["POST /rest/v1/rpc/set_owned_library_version_visibility"],
                        label,
                    );
                    const manager = [
                        ...document.querySelectorAll(
                            "[data-owned-public-version-manager]",
                        ),
                    ].at(-1);
                    const row = manager?.querySelector(
                        `[data-owned-public-version="${cssEscape(versionId)}"]`,
                    );
                    devAssert(
                        row
                            ?.querySelector(".public-version-show-button")
                            ?.getAttribute("aria-pressed") ===
                            (visible ? "true" : "false") &&
                            row
                                ?.querySelector(".public-version-hide-button")
                                ?.getAttribute("aria-pressed") ===
                                (visible ? "false" : "true"),
                        `${label} updated the real Manage button selection state`,
                        { html: row?.outerHTML || "" },
                    );
                    devAssert(
                        app.statusText === globalStatusBefore,
                        `${label} keeps hosted-file verification progress inside the Manage panel`,
                        {
                            before: globalStatusBefore,
                            after: app.statusText,
                            managerStatus:
                                manager?.querySelector("#ownedPublicVersionStatus")
                                    ?.textContent || "",
                        },
                    );
                    const entry = ownedPublicLibraryEntryById(itemId);
                    const state = clone(
                        app.ownedPublicLibraryVersionStateCache?.[
                            ownedPublicLibraryVersionStateCacheKey(entry)
                        ],
                    );
                    devCloseLatestExtensiveSupabasePopup();
                    return state;
                };

                await changeVisibility(v2VersionId, false, "hide v2");
                for (const entry of [
                    ownedPublicLibraryEntryById(itemId),
                    publicLibraryEntryById(itemId),
                ]) {
                    devAssert(
                        entry?.name === v1Record.name &&
                            entry?.age === 31 &&
                            entry?.role === "astral cartographer" &&
                            entry?.species === "human" &&
                            entry?.male_image_url === v1MaleImage &&
                            entry?.non_male_image_url === v1NonMaleImage &&
                            entry?.supabase_current_version_id === v1VersionId,
                        "hiding v2 downgraded every Public and Mine field to v1",
                        { entry },
                    );
                }
                await openPublicCharacterLibraryDetail(itemId, "public");
                let rolledBackDetail = [
                    ...document.querySelectorAll("[data-character-library-layer]"),
                ].at(-1);
                devAssert(
                    [
                        characterPresentationNames(v1Record.character).male,
                        characterPresentationNames(v1Record.character).non_male,
                    ].includes(
                        rolledBackDetail?.querySelector("h2")?.textContent || "",
                    ) &&
                        [v1MaleImage, v1NonMaleImage].includes(
                            rolledBackDetail
                                ?.querySelector("img")
                                ?.getAttribute("src") || "",
                        ) &&
                        /Download \/ Import/.test(
                            rolledBackDetail?.textContent || "",
                        ),
                    "the visible Public detail immediately rendered the restored v1 name, image, and consumer actions",
                );
                devCloseLatestExtensiveSupabasePopup();
                await openPublicCharacterLibraryDetail(itemId, "mine");
                const rolledBackManager = ownedPublicLibraryVersionManagers(
                    itemId,
                ).at(-1);
                devAssert(
                    rolledBackManager
                        ?.querySelector(
                            `[data-owned-public-version="${cssEscape(v1VersionId)}"]`,
                        )
                        ?.querySelector(".profile-select-status")
                        ?.textContent?.trim() === "Default" &&
                        !!rolledBackManager?.querySelector(
                            `.public-version-view-button`,
                        ),
                    "Mine immediately opened management with restored v1 marked as default",
                );
                devCloseLatestExtensiveSupabasePopup();
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [],
                    "Public and Mine rollback rendering",
                );
                await coldLoadPublishedCharacter({
                    expectedName: v1Record.name,
                    expectedVersionId: v1VersionId,
                    expectedMaleImage: v1MaleImage,
                    expectedNonMaleImage: v1NonMaleImage,
                    label: "cold Mine and Public v1 rollback reload",
                });
                delete app.characterLibraryPublicPayloads[itemId];
                const importedV1 = await importPublicCharacterToLibrary(itemId);

                await changeVisibility(v2VersionId, true, "show v2");
                devAssert(
                    publicLibraryEntryById(itemId)?.name === v2Record.name &&
                        publicLibraryEntryById(itemId)?.non_male_image_url ===
                            v2NonMaleImage,
                    "showing v2 restored the complete v2 Public card",
                );
                await changeVisibility(v1VersionId, false, "hide v1 while v2 is visible");
                devAssert(
                    publicLibraryEntryById(itemId)?.supabase_current_version_id ===
                        v2VersionId,
                    "hiding non-current v1 left v2 current",
                );
                const allHidden = await changeVisibility(
                    v2VersionId,
                    false,
                    "hide final visible version",
                );
                devAssert(
                    allHidden.public === false &&
                        !publicLibraryEntryById(itemId) &&
                        ownedPublicLibraryEntryById(itemId)?.visibility === "hidden",
                    "hiding all versions removed the Public card and retained a hidden Mine card",
                );
                app.publicLibraryLastIndex = publicLibraryEmptyIndex();
                app.publicLibraryOwnedIndex = publicLibraryEmptyIndex();
                app.characterLibraryOwnedCharacterEntries = [];
                app.characterLibraryPublicSearch.items = [];
                const hiddenOwned = await fetchOwnedPublicLibraryIndex({
                    mode: "characters",
                    pageSize: 50,
                    page: 0,
                });
                const hiddenPublicRows =
                    (await publicLibraryFetch(
                        "/rest/v1/rpc/search_public_library_items",
                        {
                            method: "POST",
                            auth: false,
                            body: {
                                item_type: "character",
                                search_text: definitionId,
                                creator_text: "",
                                creation_tool_text: "",
                                required_genres: [],
                                ...EmberSharedLibraryFormat.searchScope(),
                                sort_mode: "updated",
                                cursor_value: null,
                                cursor_id: null,
                                result_limit: 10,
                            },
                        },
                    )) || [];
                const hiddenOwnedHasCurrentVersion = (hiddenOwned.items || []).some(
                    (entry) => String(entry.supabase_current_version_id || "").trim(),
                );
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "GET /rest/v1/library_items",
                        ...(hiddenOwnedHasCurrentVersion
                            ? ["GET /rest/v1/library_versions"]
                            : []),
                        "POST /rest/v1/rpc/owned_library_hidden_previews",
                        "POST /rest/v1/rpc/search_public_library_items",
                    ],
                    "cold all-hidden Mine and Public reload",
                );
                const hiddenOwnedEntry = (hiddenOwned.items || []).find(
                    (entry) => entry.definition_id === definitionId,
                );
                devAssert(
                    hiddenOwnedEntry?.visibility === "hidden" &&
                        !hiddenPublicRows.some(
                            (row) => row.definition_id === definitionId,
                        ),
                    "cold reload retained the all-hidden item only in Mine",
                    { hiddenOwnedEntry, hiddenPublicRows },
                );
                app.characterLibraryOwnedCharacterEntries = [clone(hiddenOwnedEntry)];
                app.publicLibraryOwnedIndex.items = [clone(hiddenOwnedEntry)];
                await openPublicCharacterLibraryDetail(itemId, "mine");
                const hiddenMineManager = ownedPublicLibraryVersionManagers(
                    itemId,
                ).at(-1);
                const hiddenV2Row = hiddenMineManager?.querySelector(
                    `[data-owned-public-version="${cssEscape(v2VersionId)}"]`,
                );
                devAssert(
                    /All versions are hidden/.test(
                        hiddenMineManager?.textContent || "",
                    ) &&
                        !!hiddenV2Row?.querySelector(
                            ".public-version-view-button",
                        ),
                    "the all-hidden Mine card opened management with newest-revision View available",
                );
                await openOwnedPublicCharacterVersionDetail(
                    itemId,
                    v2VersionId,
                    hiddenV2Row?.querySelector(".public-version-view-button"),
                );
                const hiddenV2Detail = document.querySelector(
                    "[data-public-character-detail]",
                );
                devAssert(
                    [
                        characterPresentationNames(v2Record.character).male,
                        characterPresentationNames(v2Record.character).non_male,
                    ].includes(hiddenV2Detail?.querySelector("h2")?.textContent || "") &&
                        /Download \/ Import/.test(
                            hiddenV2Detail?.textContent || "",
                        ) &&
                        !/\bManage\b/.test(
                            hiddenV2Detail?.textContent || "",
                        ),
                    "View opened hidden v2 in the standard Public character panel",
                );
                devCloseLatestExtensiveSupabasePopup();
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [],
                    "cached all-hidden Mine owner preview",
                );
                await changeVisibility(v1VersionId, true, "restore v1 from all hidden");
                devAssert(
                    publicLibraryEntryById(itemId)?.name === v1Record.name &&
                        ownedPublicLibraryEntryById(itemId)?.visibility === "public",
                    "showing v1 restored the v1 Public and Mine cards",
                );
                await coldLoadPublishedCharacter({
                    expectedName: v1Record.name,
                    expectedVersionId: v1VersionId,
                    expectedMaleImage: v1MaleImage,
                    expectedNonMaleImage: v1NonMaleImage,
                    label: "cold restored-v1 Mine and Public reload",
                });

                devAssert(
                    requests.filter((request) =>
                        /search_public_library_items/.test(request.path),
                    ).length === 6 &&
                        requests.filter((request) =>
                            /owner_user_id=.*order=updated_at/.test(request.path),
                        ).length === 5,
                    "the lifecycle performed only six intentional Public searches and five Mine loads including broad discovery and rollback proof",
                    { requests },
                );
                }

                if (runConcurrentPublishing) {
                const concurrentDefinitionId = `${definitionId}-concurrent`;
                cleanupConcurrentDefinitionId = concurrentDefinitionId;
                const concurrentImageIds = {
                    v1Male: `${concurrentDefinitionId}-v1-male`,
                    v1NonMale: `${concurrentDefinitionId}-v1-non-male`,
                    v2Male: `${concurrentDefinitionId}-v2-male`,
                    v2NonMale: `${concurrentDefinitionId}-v2-non-male`,
                };
                const concurrentV1 = devExtensiveSupabaseCharacterRecord({
                    definitionId: concurrentDefinitionId,
                    creatorIdentity,
                    version: 1,
                    maleImageId: concurrentImageIds.v1Male,
                    nonMaleImageId: concurrentImageIds.v1NonMale,
                });
                const concurrentV2 = devExtensiveSupabaseCharacterRecord({
                    definitionId: concurrentDefinitionId,
                    creatorIdentity,
                    version: 2,
                    maleImageId: concurrentImageIds.v2Male,
                    nonMaleImageId: concurrentImageIds.v2NonMale,
                });
                app.profileImages = exactProfileImageStore([
                    devExtensiveSupabaseLocalProfileImage({
                        id: concurrentImageIds.v1Male,
                        characterId: concurrentDefinitionId,
                        ownerName: concurrentV1.name,
                        male: true,
                        variant: 31,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: concurrentImageIds.v1NonMale,
                        characterId: concurrentDefinitionId,
                        ownerName: concurrentV1.name,
                        male: false,
                        variant: 32,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: concurrentImageIds.v2Male,
                        characterId: concurrentDefinitionId,
                        ownerName: concurrentV2.name,
                        male: true,
                        variant: 33,
                    }),
                    devExtensiveSupabaseLocalProfileImage({
                        id: concurrentImageIds.v2NonMale,
                        characterId: concurrentDefinitionId,
                        ownerName: concurrentV2.name,
                        male: false,
                        variant: 34,
                    }),
                    ...(app.profileImages || []),
                ]);
                const concurrentPublishes = await Promise.all([
                    publishCharacterRecordsToPublicIndex(
                        [concurrentV1],
                        "extensive concurrent character v1",
                        {
                            testUpload: true,
                            skipPublishConfirm: true,
                        },
                    ),
                    publishCharacterRecordsToPublicIndex(
                        [concurrentV2],
                        "extensive concurrent character v2",
                        {
                            testUpload: true,
                            skipPublishConfirm: true,
                        },
                    ),
                ]);
                const concurrentResults = concurrentPublishes.map(
                    (publish) => publish?.result?.results?.[0],
                );
                if (concurrentResults.some((result) => !result))
                    throw new Error(
                        "A concurrent real character revision did not publish.",
                    );
                for (const publish of concurrentPublishes)
                    uploads.push(
                        publish.upload,
                        ...(publish.imageUploads || []),
                    );
                publishedResults.push(...concurrentResults);
                const concurrentOwned = await fetchOwnedPublicLibraryIndex({
                    mode: "characters",
                    pageSize: 50,
                    page: 0,
                });
                const concurrentItemId = concurrentResults[0].item.id;
                const concurrentVersions =
                    (await publicLibraryFetch(
                        `/rest/v1/library_versions?select=*&item_id=eq.${postgrestValue(concurrentItemId)}&order=version_number.asc`,
                    )) || [];
                const concurrentOwnedHasHiddenPreview = (
                    concurrentOwned.items || []
                ).some((entry) => !entry.supabase_current_version_id);
                requestStart = devAssertExtensiveSupabaseRequestPhase(
                    requests,
                    requestStart,
                    [
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                        "POST /rest/v1/rpc/public_library_publish_preflight",
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                        "POST /rest/v1/rpc/publish_public_library_item_version",
                        "GET /rest/v1/library_items",
                        "GET /rest/v1/library_versions",
                        ...(concurrentOwnedHasHiddenPreview
                            ? ["POST /rest/v1/rpc/owned_library_hidden_previews"]
                            : []),
                        "GET /rest/v1/library_versions",
                    ],
                    "concurrent real character revisions",
                );
                const concurrentOwnedEntries = (
                    concurrentOwned.items || []
                ).filter(
                    (entry) => entry.definition_id === concurrentDefinitionId,
                );
                const concurrentCurrent = concurrentOwnedEntries[0];
                const concurrentExpectedRecord = concurrentResults.find(
                    (result) =>
                        result.version.id ===
                        concurrentCurrent?.supabase_current_version_id,
                )?.entry;
                devAssert(
                    concurrentResults[0].item.id ===
                        concurrentResults[1].item.id &&
                        concurrentResults[0].version.id !==
                            concurrentResults[1].version.id &&
                        concurrentOwnedEntries.length === 1 &&
                        concurrentVersions.length === 2 &&
                        concurrentCurrent?.name === concurrentExpectedRecord?.name &&
                        concurrentCurrent?.male_image_url ===
                            concurrentExpectedRecord?.male_image_url &&
                        concurrentCurrent?.non_male_image_url ===
                            concurrentExpectedRecord?.non_male_image_url &&
                        concurrentPublishes.every(
                            (publish) =>
                                [publish.upload, ...(publish.imageUploads || [])]
                                    .filter(Boolean)
                                    .every(
                                        (upload) =>
                                            upload.expiresInSeconds ===
                                                TEST_UPLOAD_EXPIRES_IN_SECONDS &&
                                            !!hostedUploadDeletionUrl(upload),
                                    ),
                        ),
                    "concurrent revisions created one item, preserved both versions, and selected internally consistent current metadata",
                    {
                        concurrentResults,
                        concurrentOwnedEntries,
                        concurrentVersions,
                    },
                );
                }
                devTestLog("Extensive Supabase phase request ledger", {
                    count: requests.length,
                    phase,
                    requests,
                });
                devTestLog(
                    `Scenario complete: ${scenarioId}`,
                    { trackedSupabaseRequests: requests.length },
                );
                lifecyclePassed = true;
            } finally {
                uploadBlobToUserUploads = originalUploadBlobToUserUploads;
                uploadCompressedJson = originalUploadCompressedJson;
                forcedSupabaseFailurePath = "";
                const cleanupRequestStart = requests.length;
                const cleanupFailures = [];
                try {
                    await cleanupPublicLibrarySupabaseResults(publishedResults, {
                        throwOnFailure: lifecyclePassed,
                    });
                } catch (cleanupError) {
                    cleanupFailures.push(cleanupError);
                }
                if (
                    cleanupOwnerId &&
                    cleanupCreatorId &&
                    cleanupDefinitionId
                ) {
                    try {
                        const remainingRows = [];
                        for (const definitionIdToCheck of [
                            cleanupDefinitionId,
                            cleanupConcurrentDefinitionId,
                        ].filter(Boolean)) {
                            const orphanQuery =
                                `/rest/v1/library_items?select=id&owner_user_id=eq.${postgrestValue(cleanupOwnerId)}&type=eq.character&creator_id=eq.${postgrestValue(cleanupCreatorId)}&definition_id=eq.${postgrestValue(definitionIdToCheck)}`;
                            const orphanRows =
                                (await publicLibraryFetch(orphanQuery)) || [];
                            for (const row of orphanRows)
                                await cleanupPublicLibrarySupabaseItem(row.id);
                            if (orphanRows.length)
                                remainingRows.push(
                                    ...((await publicLibraryFetch(orphanQuery)) || []),
                                );
                        }
                        const orphanVersions = [];
                        const publishedItemIds = new Set(
                            publishedResults
                                .map((result) => String(result?.item?.id || ""))
                                .filter(Boolean),
                        );
                        for (const publishedItemId of publishedItemIds)
                            orphanVersions.push(
                                ...((await publicLibraryFetch(
                                    `/rest/v1/library_versions?select=id&item_id=eq.${postgrestValue(publishedItemId)}`,
                                )) || []),
                            );
                        if (remainingRows.length || orphanVersions.length)
                            throw new Error(
                                `Extensive Supabase cleanup left ${remainingRows.length} item row(s) and ${orphanVersions.length} version row(s).`,
                            );
                    } catch (cleanupError) {
                        cleanupFailures.push(cleanupError);
                        devTestLog(
                            "Extensive Supabase fallback database cleanup failed",
                            cleanupError?.message || String(cleanupError),
                        );
                    }
                }
                try {
                    await devCleanupTemporaryPublicHostingCreators();
                } catch (cleanupError) {
                    cleanupFailures.push(cleanupError);
                    devTestLog("Extensive Supabase temporary creator cleanup failed",
                        cleanupError?.message || String(cleanupError));
                }
                const cleanupDefinitionIds = [
                    cleanupDefinitionId,
                    cleanupConcurrentDefinitionId,
                ].filter(Boolean);
                const cleanupPublishedItemIds = new Set(
                    publishedResults
                        .map((result) => String(result?.item?.id || ""))
                        .filter(Boolean),
                );
                if (lifecyclePassed)
                    devAssertExtensiveSupabaseRequestPhase(
                        requests,
                        cleanupRequestStart,
                        [
                            ...[...cleanupPublishedItemIds].map(
                                () => "DELETE /rest/v1/library_items",
                            ),
                            ...cleanupDefinitionIds.map(
                                () => "GET /rest/v1/library_items",
                            ),
                            ...[...cleanupPublishedItemIds].map(
                                () => "GET /rest/v1/library_versions",
                            ),
                            "DELETE /rest/v1/creator_identities",
                            "GET /rest/v1/creator_identities",
                        ],
                        "final Supabase item/version cascade cleanup and orphan verification",
                    );
                devTestLog("Extensive Supabase complete request ledger", {
                    count: requests.length,
                    requests,
                });
                publicLibraryFetch = originalPublicLibraryFetch;
                let deletedUploads = 0;
                for (const upload of uploads.filter(Boolean)) {
                    try {
                        if (
                            await deleteHostedUpload(
                                upload,
                                "Extensive Supabase character lifecycle cleanup",
                            )
                        )
                            deletedUploads += 1;
                    } catch (cleanupError) {
                        cleanupFailures.push(cleanupError);
                    }
                }
                deleteHostedUpload = originalDeleteHostedUpload;
                if (lifecyclePassed)
                    devAssert(
                        deletedUploads === uploads.filter(Boolean).length,
                        "every successful Perchance image/payload upload was deleted after the live phase",
                        { deletedUploads, uploads: uploads.length },
                    );
                try {
                    await flushLargeSaves();
                    const fixtureDefinitionIds = new Set(cleanupDefinitionIds);
                    const fixtureProfileImages = (app.profileImages || []).filter(
                        (image) =>
                            fixtureDefinitionIds.has(
                                String(image?.character_id || "").trim(),
                            ),
                    );
                    if (fixtureProfileImages.length)
                        await deletePerRecordLibraryRecords(
                            PROFILE_IMAGE_KEY,
                            fixtureProfileImages.map((image) => ({ id: image.id })),
                        );
                    if (cleanupDefinitionIds.length)
                        await deletePerRecordLibraryRecords(
                            CHARACTER_LIBRARY_KEY,
                            cleanupDefinitionIds.map((id) => ({ id })),
                        );
                } catch (cleanupError) {
                    cleanupFailures.push(cleanupError);
                    devTestLog(
                        "Extensive Supabase local fixture cleanup failed",
                        cleanupError?.message || String(cleanupError),
                    );
                }
                app.publicLibraryLastIndex = originalCaches.lastIndex;
                app.publicLibraryOwnedIndex = originalCaches.ownedIndex;
                app.characterLibraryOwnedCharacterEntries =
                    originalCaches.ownedCharacters;
                app.characterLibraryPublicSearch = originalCaches.publicSearch;
                app.ownedPublicLibraryVersionStateCache =
                    originalCaches.versionState;
                app.publicLibraryVersionHistory = originalCaches.versionHistory;
                app.hiddenPublicLibraryCacheMembership =
                    originalCaches.hiddenMembership;
                app.characterDefinitions = originalCaches.definitions;
                app.characterLibraryRecordsCache = null;
                app.profileImages = exactProfileImageStore(
                    originalCaches.profileImages,
                );
                app.characterLibraryPublicPayloads = originalCaches.publicPayloads;
                app.profileEntityOverrides = originalCaches.profileOverrides;
                saveSupabaseSession(app.supabaseSession);
                if (lifecyclePassed && cleanupFailures.length)
                    throw new Error(
                        `Extensive Supabase cleanup failed: ${cleanupFailures
                            .map((error) => error?.message || String(error))
                            .join("; ")}`,
                    );
            }
        }

        async function devRunExtensiveSupabasePublishFailuresSmokeTest() {
            return devRunExtensiveSupabaseCharacterLifecycleSmokeTest({
                phase: "publish-failures",
                scenarioId: "extensive-supabase-publish-failures-smoke",
            });
        }

        async function devRunExtensiveSupabaseRevisionLifecycleSmokeTest() {
            return devRunExtensiveSupabaseCharacterLifecycleSmokeTest({
                phase: "revision-lifecycle",
                scenarioId: "extensive-supabase-revision-lifecycle-smoke",
            });
        }

        async function devRunExtensiveSupabaseConcurrentPublishingSmokeTest() {
            return devRunExtensiveSupabaseCharacterLifecycleSmokeTest({
                phase: "concurrent-publishing",
                scenarioId: "extensive-supabase-concurrent-publishing-smoke",
            });
        }

        async function devRunLegacyAggregateSaveStorageIsolationSmokeTest() {
            devTestLog("Scenario start: save-storage-isolation-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const smokeId = newSaveId("smoke-aggregate-storage");
            try {
                devResetForLiveTest("save-storage-isolation-smoke");
                devCreateTestProfile({  });
                const state = clone(defaultState);
                state.meta = {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: { mode: "original", title: "Aggregate Storage Smoke" },
                };
                state.player = {
                    ...clone(defaultState.player || {}),
                    name: "Storage Smoke Player",
                    age: 30,
                    gender: "male",
                };
                state.characters = {
                    "Aggregate Ally": {
                        ...blankCharacterTemplate("Aggregate Ally"),
                        id: "aggregate-ally",
                        name: "Aggregate Ally",
                        age: 31,
                        gender: "female",
                        trust: 1,
                        outfits: [
                            {
                                id: "aggregate-outfit",
                                name: "Aggregate Outfit",
                                clothing: {
                                    shirt: "aggregate blue shirt",
                                    pants: "aggregate black trousers",
                                },
                            },
                        ],
                        starting_outfit_id: "aggregate-outfit",
                        active_outfit_id: "aggregate-outfit",
                        clothing: exactClothingSlots({
                            shirt: "aggregate blue shirt",
                            pants: "aggregate black trousers",
                        }),
                    },
                };
                state.scene = {
                    ...clone(defaultState.scene || {}),
                    summary: "Aggregate baseline scene",
                    party_members_present: ["Aggregate Ally"],
                    npcs_present: [],
                    image_characters: [],
                };

                const sourceRevisionId = generatedPersistentId(
                    "smoke-source-story-revision",
                );
                const playerVariantA = clone(state);
                playerVariantA.player.name = "Storage Smoke Player A";
                const playerVariantB = clone(state);
                playerVariantB.player.name = "Storage Smoke Player B";
                const compiledVariantA = await compileStoryDefinitionRuntimeInWorker(
                    playerVariantA,
                    { definitionRevisionId: sourceRevisionId },
                );
                const repeatedVariantA = await compileStoryDefinitionRuntimeInWorker(
                    playerVariantA,
                    { definitionRevisionId: sourceRevisionId },
                );
                const compiledVariantB = await compileStoryDefinitionRuntimeInWorker(
                    playerVariantB,
                    { definitionRevisionId: sourceRevisionId },
                );
                await persistenceWorkerRequest("story-definition-put", {
                    definition: clone(compiledVariantA.definition),
                });
                await persistenceWorkerRequest("story-definition-put", {
                    definition: clone(repeatedVariantA.definition),
                });
                await persistenceWorkerRequest("story-definition-put", {
                    definition: clone(compiledVariantB.definition),
                });
                devAssert(
                    compiledVariantA.definition.revisionId ===
                        repeatedVariantA.definition.revisionId &&
                        compiledVariantA.definition.contentHash ===
                            repeatedVariantA.definition.contentHash &&
                        compiledVariantA.definition.revisionId !==
                            compiledVariantB.definition.revisionId &&
                        compiledVariantA.definition.sourceRevisionId === sourceRevisionId &&
                        compiledVariantB.definition.sourceRevisionId === sourceRevisionId,
                    "runtime definitions reuse an id only for identical compiled content and separate selected-player variants",
                    {
                        sourceRevisionId,
                        variantARevisionId: compiledVariantA.definition.revisionId,
                        repeatedVariantARevisionId:
                            repeatedVariantA.definition.revisionId,
                        variantBRevisionId: compiledVariantB.definition.revisionId,
                    },
                );
                await createNewActiveSave("aggregate storage smoke baseline", {
                    saveId: smokeId,
                    state,
                    messages: [
                        { id: 1, entryId: 1, role: "assistant", text: "Aggregate baseline." },
                    ],
                });

                const initial = await persistenceWorkerRequest("save-load", { saveId: smokeId });
                const definition = await persistenceWorkerRequest("story-definition-get", {
                    revisionId: initial?.header?.definitionRevisionId,
                });
                const initialScene = initial.records.find(
                    (row) => row.kind === "scene" && row.recordId === "current",
                );
                const initialCharacter = initial.records.find(
                    (row) => row.kind === "character" && row.recordId === "Aggregate Ally",
                );
                devAssert(
                    !!initial?.header &&
                        initial.records.length > 1 &&
                        initial.messages.length === 1 &&
                        initial.snapshots.length === 0 &&
                        !!definition?.initialRuntimeTemplate?.records?.length &&
                        definition.contentHash === initial.header.definitionContentHash &&
                        initialCharacter?.value?.runtime?.trust === 1,
                    "aggregate save creation stores definition, records, and messages separately without a legacy full-save JSON document",
                    { initial, definitionRevisionId: definition?.revisionId },
                );
                const materializedInitial = await loadSaveRecord(smokeId);
                const loadedAlly =
                    materializedInitial.state.characters["Aggregate Ally"];
                const loadedAllyEditor =
                    characterDefinitionManagedSplit(loadedAlly);
                const loadedAllyDefinition = Object.values(
                    materializedInitial.definition
                        .characterDefinitionsById || {},
                ).find(
                    (definition) =>
                        textSlot(definition?.name, "") ===
                        "Aggregate Ally",
                );
                devAssert(
                    loadedAlly?.clothing?.shirt ===
                        "aggregate blue shirt" &&
                        loadedAllyEditor.game_managed_data?.clothing?.shirt ===
                            "aggregate blue shirt" &&
                        !Object.hasOwn(
                            loadedAllyEditor.character_definition,
                            "clothing",
                        ) &&
                        isPlainObject(loadedAllyDefinition) &&
                        !Object.hasOwn(
                            loadedAllyDefinition,
                            "clothing",
                        ),
                    "loaded games preserve runtime clothing while immutable and in-game Character Definition data remain clothing-free",
                    {
                        loadedAlly,
                        loadedAllyEditor,
                        definition: loadedAllyDefinition,
                    },
                );
                const seedPlayerRecord = definition.initialRuntimeTemplate.records.find(
                    (row) => row.kind === "player" && row.recordId === "current",
                );
                const runtimeDefinition = app.storyDefinition;
                const runtimeSeedPlayerRecord = runtimeDefinition?.initialRuntimeTemplate?.records?.find(
                    (row) => row.kind === "player" && row.recordId === "current",
                );
                const originalRevisionId = runtimeDefinition?.revisionId;
                const originalSeedName = runtimeSeedPlayerRecord?.value?.name;
                try {
                    runtimeDefinition.revisionId = "smoke-mutation-must-not-stick";
                } catch {}
                try {
                    runtimeSeedPlayerRecord.value.name = "Smoke Mutation Must Not Stick";
                } catch {}
                devAssert(
                    runtimeDefinition?.revisionId === originalRevisionId &&
                        runtimeSeedPlayerRecord?.value?.name === originalSeedName &&
                        app.state.player !== runtimeSeedPlayerRecord?.value &&
                        app.state.player?.appearance !== runtimeSeedPlayerRecord?.value?.appearance &&
                        seedPlayerRecord?.value?.name === runtimeSeedPlayerRecord?.value?.name,
                    "initial runtime seed is readonly and deeply materialized without shared nested references",
                    {
                        originalRevisionId,
                        currentRevisionId: runtimeDefinition?.revisionId,
                        originalSeedName,
                        currentSeedName: runtimeSeedPlayerRecord?.value?.name,
                    },
                );

                runtimeAggregateDirtyTracker.records.clear();
                runtimeAggregateDirtyTracker.messages.clear();
                const authoredAggregateRole =
                    definition.characterDefinitionsById["aggregate-ally"]?.role;
                updateCharacterRuntime("Aggregate Ally", (character) => {
                    character.trust = 7;
                    character.role = "runtime-overlay-role";
                });
                const dirtyRecordKeys = [...runtimeAggregateDirtyTracker.records.keys()];
                devAssert(
                    dirtyRecordKeys.length === 1 &&
                        dirtyRecordKeys[0] === runtimeDirtyKey("character", "Aggregate Ally"),
                    "one character mutation dirties only that character aggregate",
                    { dirtyRecordKeys },
                );
                saveActiveGame("aggregate character update", { allowCreate: true, allowSmokeRestore: true });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);
                const afterCharacter = await persistenceWorkerRequest("save-load", { saveId: smokeId });
                const persistedCharacter = afterCharacter.records.find(
                    (row) => row.kind === "character" && row.recordId === "Aggregate Ally",
                );
                const persistedScene = afterCharacter.records.find(
                    (row) => row.kind === "scene" && row.recordId === "current",
                );
                const materializedAfterCharacter = await loadSaveRecord(smokeId);
                devAssert(
                    persistedCharacter?.value?.runtime?.trust === 7 &&
                        !!persistedCharacter?.value?.runtime?.definitionOverlay &&
                        materializedAfterCharacter.state.characters["Aggregate Ally"]?.role ===
                            "runtime-overlay-role" &&
                        materializedAfterCharacter.definition.characterDefinitionsById[
                            "aggregate-ally"
                        ]?.role === authoredAggregateRole &&
                        stableJsonString(persistedScene?.value) === stableJsonString(initialScene?.value),
                    "dirty character write preserves unrelated scene state and stores save-specific definition changes as a runtime overlay",
                    { persistedCharacter, persistedScene },
                );

                runtimeAggregateDirtyTracker.records.clear();
                updateCharacterRuntime("Aggregate Ally", (character) => {
                    delete character.trust;
                });
                const nestedDeleteEntry = runtimeAggregateDirtyTracker.records.get(
                    runtimeDirtyKey("character", "Aggregate Ally"),
                );
                devAssert(
                    nestedDeleteEntry?.operation === "put",
                    "deleting a nested character field rewrites that character record instead of tombstoning the owner",
                    { nestedDeleteEntry },
                );
                saveActiveGame("aggregate nested character field delete", {
                    allowCreate: true,
                    allowSmokeRestore: true,
                });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);
                const afterNestedDelete = await loadSaveRecord(smokeId);
                devAssert(
                    !!afterNestedDelete.state.characters["Aggregate Ally"] &&
                        !Object.prototype.hasOwnProperty.call(
                            afterNestedDelete.state.characters["Aggregate Ally"],
                            "trust",
                        ),
                    "nested field deletion round-trips without deleting the owning character",
                    afterNestedDelete.state.characters["Aggregate Ally"],
                );

                runtimeAggregateDirtyTracker.messages.clear();
                const appended = addMessage("assistant", "Independent message row.", "Narrator");
                const appendedId = String(appended?.id ?? appended?.entryId ?? "");
                devAssert(
                    runtimeAggregateDirtyTracker.messages.get(appendedId)?.operation === "put",
                    "message append is tracked independently from runtime aggregates",
                    { appendedId, dirtyMessages: [...runtimeAggregateDirtyTracker.messages.values()] },
                );
                saveActiveGame("aggregate message append", { allowCreate: true, allowSmokeRestore: true });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);
                const afterMessage = await persistenceWorkerRequest("save-load", { saveId: smokeId });
                devAssert(
                    afterMessage.messages.some((row) => String(row.messageId) === appendedId),
                    "message append persists as an independent message record",
                    { messages: afterMessage.messages },
                );

                runtimeAggregateDirtyTracker.records.clear();
                updateNpcDirectoryRuntime((directory) => {
                    directory.locations ||= {};
                    directory.locations["aggregate-smoke-location"] = {
                        characters: {
                            "Generated Smoke NPC": {
                                name: "Generated Smoke NPC",
                                age: 34,
                                gender: "female",
                                role: "archivist",
                                relationship: "new contact",
                                note: "Synthetic generated-definition fixture.",
                                inspected: true,
                                full_character: {
                                    ...blankCharacterTemplate("Generated Smoke NPC"),
                                    name: "Generated Smoke NPC",
                                    age: 34,
                                    gender: "female",
                                    role: "archivist",
                                },
                            },
                        },
                    };
                }, "Generated Smoke NPC");
                saveActiveGame("aggregate generated NPC definition", {
                    allowCreate: true,
                    allowSmokeRestore: true,
                });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);
                const afterGeneratedNpc = await persistenceWorkerRequest("save-load", {
                    saveId: smokeId,
                });
                const generatedDefinitionRow = afterGeneratedNpc.records.find(
                    (row) =>
                        row.kind === "runtime-definition" &&
                        String(row.recordId || "").startsWith("character:"),
                );
                const generatedNpcRecord = afterGeneratedNpc.records.find(
                    (row) =>
                        row.kind === "npc" &&
                        row.recordId ===
                            runtimeNpcRecordId(
                                "aggregate-smoke-location",
                                "Generated Smoke NPC",
                            ),
                );
                const materializedGeneratedNpc = await loadSaveRecord(smokeId);
                const generatedDefinitionId = String(
                    generatedDefinitionRow?.recordId || "",
                ).replace(/^character:/, "");
                devAssert(
                    !!generatedDefinitionRow &&
                        !!generatedNpcRecord &&
                        materializedGeneratedNpc.state.npc_directory.locations[
                            "aggregate-smoke-location"
                        ]?.characters?.["Generated Smoke NPC"]?.full_character?.role ===
                            "archivist" &&
                        Object.isFrozen(
                            materializedGeneratedNpc.runtimeDefinitions.charactersById[
                                generatedDefinitionId
                            ],
                        ),
                    "generated NPC definition is stored once outside mutable NPC runtime and is frozen after load",
                    { generatedDefinitionRow, generatedNpcRecord },
                );
                runtimeAggregateDirtyTracker.records.clear();
                updateNpcDirectoryRuntime((directory) => {
                    directory.locations["aggregate-smoke-location"].characters[
                        "Generated Smoke NPC"
                    ].relationship = "trusted contact";
                }, "Generated Smoke NPC");
                syncRuntimeArchitectureBeforeSave();
                devAssert(
                    runtimeAggregateDirtyTracker.records.has(
                        runtimeDirtyKey("npc-directory", "current"),
                    ) &&
                        runtimeAggregateDirtyTracker.records.has(
                            runtimeDirtyKey(
                                "npc",
                                runtimeNpcRecordId(
                                    "aggregate-smoke-location",
                                    "Generated Smoke NPC",
                                ),
                            ),
                        ) &&
                        ![...runtimeAggregateDirtyTracker.records.values()].some(
                            (entry) => entry.kind === "runtime-definition",
                        ),
                    "generated NPC progress dirties only mutable NPC runtime and does not rewrite its immutable definition",
                    { dirty: [...runtimeAggregateDirtyTracker.records.values()] },
                );
                saveActiveGame("aggregate generated NPC runtime update", {
                    allowCreate: true,
                    allowSmokeRestore: true,
                });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);

                const beforeDefinitionCollision = await persistenceWorkerRequest("save-load", {
                    saveId: smokeId,
                });
                let immutableDefinitionCollisionError = "";
                try {
                    await persistenceWorkerRequest("save-write-batch", {
                        saveId: smokeId,
                        baseRevision: Number(
                            beforeDefinitionCollision.header?.durableRevision || 0,
                        ),
                        revision:
                            Number(beforeDefinitionCollision.header?.durableRevision || 0) +
                            1,
                        records: [
                            {
                                kind: "runtime-definition",
                                recordId: generatedDefinitionRow.recordId,
                                value: {
                                    ...clone(generatedDefinitionRow.value),
                                    role: "silently changed role",
                                },
                            },
                        ],
                        header: { saveId: smokeId },
                    });
                } catch (error) {
                    immutableDefinitionCollisionError = error?.message || String(error);
                }
                const afterDefinitionCollision = await persistenceWorkerRequest("save-load", {
                    saveId: smokeId,
                });
                devAssert(
                    /immutable runtime definition collision/i.test(
                        immutableDefinitionCollisionError,
                    ) &&
                        Number(afterDefinitionCollision.header?.durableRevision || 0) ===
                            Number(beforeDefinitionCollision.header?.durableRevision || 0) &&
                        afterDefinitionCollision.records.find(
                            (row) =>
                                row.kind === "runtime-definition" &&
                                row.recordId === generatedDefinitionRow.recordId,
                        )?.value?.role !== "silently changed role",
                    "worker rejects attempts to overwrite immutable generated definitions without advancing the durable revision",
                    {
                        immutableDefinitionCollisionError,
                        beforeRevision:
                            beforeDefinitionCollision.header?.durableRevision,
                        afterRevision: afterDefinitionCollision.header?.durableRevision,
                    },
                );

                delete app.state.characters["Aggregate Ally"];
                saveActiveGame("aggregate character delete", { allowCreate: true, allowSmokeRestore: true });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);
                const afterDelete = await persistenceWorkerRequest("save-load", { saveId: smokeId });
                devAssert(
                    !afterDelete.records.some(
                        (row) => row.kind === "character" && row.recordId === "Aggregate Ally",
                    ),
                    "deleting an independently keyed runtime record emits a durable tombstone",
                    { records: afterDelete.records },
                );

                let mismatchError = "";
                try {
                    await persistenceWorkerRequest("save-write-batch", {
                        saveId: smokeId,
                        baseRevision: 0,
                        revision: Number(afterDelete.header?.durableRevision || 0) + 1,
                        header: { saveId: smokeId },
                    });
                } catch (error) {
                    mismatchError = error?.message || String(error);
                }
                devAssert(
                    /revision mismatch/i.test(mismatchError),
                    "worker rejects stale aggregate revisions instead of silently resynchronizing",
                    { mismatchError },
                );

                const portableDataUrl = devSmokeOnePixelDataUrl();
                const normalImageId = "aggregate-portable-normal-image";
                const profileImageId = "aggregate-portable-profile-image";
                app.images.push({
                    id: normalImageId,
                    url: portableDataUrl,
                    html: `<img alt="Aggregate portable normal" src="${portableDataUrl}">`,
                });
                const portableProfile = {
                    id: profileImageId,
                    owner_name: app.state.player.name,
                    url: portableDataUrl,
                    html: `<img alt="Aggregate portable profile" src="${portableDataUrl}">`,
                    created_at: new Date().toISOString(),
                };
                app.profileImages = exactProfileImageStore([
                    portableProfile,
                    ...(app.profileImages || []),
                ]);
                updatePlayerRuntime((player) => {
                    player.profile_images = [profileImageEntityRecord(portableProfile)];
                    player.profile_image_id = profileImageId;
                });
                saveProfileImageRecordsNow(
                    [portableProfile],
                    "aggregate portable profile smoke",
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                saveActiveGame("aggregate portable image export", {
                    allowCreate: true,
                    allowSmokeRestore: true,
                });
                await app.work.flush(`save:${smokeId}`);
                await flushPersistenceWorkerSave(smokeId);

                const exported = await persistenceWorkerRequest("save-export", { saveId: smokeId });
                const exportedNormalImage = exported?.images?.find(
                    (row) => String(row.imageId) === normalImageId,
                );
                const exportedProfileImage = exported?.profileImages?.find(
                    (row) => String(row.imageId) === profileImageId,
                );
                devAssert(
                    exported?.format === "emberadventureslite-save-v2" &&
                        exported.definition?.revisionId === definition.revisionId &&
                        Array.isArray(exported.records) &&
                        Array.isArray(exported.messages) &&
                        /^data:image\//i.test(exportedNormalImage?.value?.url || "") &&
                        /^data:image\//i.test(exportedProfileImage?.value?.url || ""),
                    "explicit worker export assembles a portable v2 bundle with referenced normal and profile image blobs",
                    {
                        exportedFormat: exported?.format,
                        normalImage: exportedNormalImage?.value?.url?.slice(0, 32),
                        profileImage: exportedProfileImage?.value?.url?.slice(0, 32),
                    },
                );
                await persistenceWorkerRequest("save-delete", { saveId: smokeId });
                devAssert(
                    !(await persistenceWorkerRequest("save-load", { saveId: smokeId })),
                    "save deletion removes all save-owned aggregate rows",
                );
                devTestLog("Scenario complete: save-storage-isolation-smoke");
            } finally {
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }
        async function devRunWorkerTaskSchedulingSmokeTest() {
            devTestLog("Scenario start: worker-task-scheduling-smoke");
            const revisionBefore = currentGameStateRevision();
            const order = [];
            const earlyWorkerSource = startPersistenceWorkerEarly.toString();
            const earlyPerformanceCount = earlyPerformanceEntries.length;
            queueEarlyPerformanceEntry(
                "worker startup smoke",
                { ms: 9, worker: true },
                "warn",
            );
            devAssert(
                earlyPerformanceEntries.length === earlyPerformanceCount + 1 &&
                    /queueEarlyPerformanceEntry\s*\(/.test(earlyWorkerSource) &&
                    !/perfConsole\s*\(/.test(earlyWorkerSource),
                "slow persistence-worker startup buffers performance logging without accessing app before initialization",
                { earlyPerformanceEntries, earlyWorkerSource },
            );
            flushEarlyPerformanceEntries();
            devAssert(
                earlyPerformanceEntries.length === 0,
                "early worker performance entries flush after application initialization",
                earlyPerformanceEntries,
            );
            let releaseTurnOne;
            let releaseBackgroundOne;
            let releaseBackgroundTwo;
            let releaseStale;
            const waitForTurnOne = new Promise((resolve) => {
                releaseTurnOne = resolve;
            });
            const waitForBackgroundOne = new Promise((resolve) => {
                releaseBackgroundOne = resolve;
            });
            const waitForBackgroundTwo = new Promise((resolve) => {
                releaseBackgroundTwo = resolve;
            });
            const waitForStale = new Promise((resolve) => {
                releaseStale = resolve;
            });
            try {
                const turnOne = runTurnCriticalTask("Testing turn", async () => {
                    order.push("turn-one-start");
                    await waitForTurnOne;
                    order.push("turn-one-end");
                    return true;
                }, { workLabel: "worker scheduling smoke turn one" });
                const turnTwo = runTurnCriticalTask("Testing turn", async () => {
                    order.push("turn-two-start");
                    order.push("turn-two-end");
                    return true;
                }, { workLabel: "worker scheduling smoke turn two" });
                await devWaitFor(
                    () => order.includes("turn-one-start"),
                    1000,
                    "first turn task to start",
                );
                devAssert(
                    !order.includes("turn-two-start"),
                    "turn-critical tasks serialize and do not overlap",
                    { order },
                );
                const backgroundOne = runBackgroundTask(
                    "worker-scheduling-background-one",
                    "Testing background",
                    async () => {
                        order.push("background-one-start");
                        await waitForBackgroundOne;
                        order.push("background-one-end");
                        return true;
                    },
                    { workLabel: "worker scheduling smoke background one" },
                );
                const backgroundTwo = runBackgroundTask(
                    "worker-scheduling-background-two",
                    "Testing background",
                    async () => {
                        order.push("background-two-start");
                        await waitForBackgroundTwo;
                        order.push("background-two-end");
                        return true;
                    },
                    { workLabel: "worker scheduling smoke background two" },
                );
                await devWaitFor(
                    () =>
                        order.includes("background-one-start") &&
                        order.includes("background-two-start"),
                    1000,
                    "independent background tasks to start together",
                );
                const indicator = document.getElementById("emberAdventuresActivityIndicator");
                devAssert(
                    !!indicator &&
                        indicator.style.pointerEvents === "none" &&
                        !document.getElementById("emberAdventuresSavingOverlay"),
                    "worker activity uses one passive non-blocking indicator instead of a saving overlay",
                    { indicator: indicator?.outerHTML || "" },
                );
                const staleTask = runBackgroundTask(
                    "worker-scheduling-stale",
                    "Testing stale",
                    async ({ isCurrent }) => {
                        await waitForStale;
                        return isCurrent();
                    },
                    { workLabel: "worker scheduling smoke stale result" },
                );
                noteGameStateRevision("worker scheduling smoke stale state");
                releaseStale();
                devAssert(
                    (await staleTask) === false,
                    "background work detects a stale state revision before applying a result",
                );
                releaseBackgroundOne();
                releaseBackgroundTwo();
                releaseTurnOne();
                await Promise.all([turnOne, turnTwo, backgroundOne, backgroundTwo]);
                devAssert(
                    JSON.stringify(order) === JSON.stringify([
                        "turn-one-start",
                        "background-one-start",
                        "background-two-start",
                        "background-one-end",
                        "background-two-end",
                        "turn-one-end",
                        "turn-two-start",
                        "turn-two-end",
                    ]),
                    "turn ordering remains deterministic while independent background work completes",
                    { order },
                );
                const parsed = await persistenceWorkerRequest("json-parse-safe", {
                    texts: ['{"worker":true}', "{not valid json}"],
                });
                devAssert(
                    parsed?.[0]?.value?.worker === true &&
                        /Unexpected token|Expected property name/i.test(parsed?.[1]?.error || ""),
                    "worker parses import JSON off the main thread and reports malformed files without losing valid files",
                    { parsed },
                );
                const importedPayloads = await parseImportFilesInWorker(
                    [
                        new File(['{"name":"Clearly Fake Worker Import"}'], "worker-import.json", {
                            type: "application/json",
                        }),
                    ],
                    "Importing",
                );
                devAssert(
                    importedPayloads?.[0]?.name === "Clearly Fake Worker Import",
                    "character import parsing uses the background worker path",
                    { importedPayloads },
                );
                const workerNormalizedCharacter = devSmokeCharacterRecord(
                    "Worker Normalized Import",
                ).character;
                const normalizedImportRecords = await prepareCharacterImportRecordsInWorker(
                    [
                        new File(
                            [
                                JSON.stringify(
                                    characterDefinitionFileForExport(
                                        workerNormalizedCharacter,
                                    ),
                                ),
                            ],
                            "worker-normalized-import.json",
                            { type: "application/json" },
                        ),
                    ],
                    { kind: "character" },
                    "Importing",
                );
                devTestLog("worker exact character import records", normalizedImportRecords);
                devAssert(
                    normalizedImportRecords.length === 1 &&
                        normalizedImportRecords[0]?.character_definition?.name ===
                            "Worker Normalized Import",
                    "exact character import preparation runs in the import worker",
                    { normalizedImportRecords },
                );
                const importValidationResults = await validateCharacterImportRecordsInWorker(
                    [
                        {
                            character_definition: {
                                name: "Worker Validation Import",
                                age: 25,
                            },
                        },
                    ],
                );
                devAssert(
                    Array.isArray(importValidationResults) &&
                        importValidationResults.length === 1 &&
                        importValidationResults[0]?.name === "Worker Validation Import" &&
                        Array.isArray(importValidationResults[0]?.validation?.errors),
                    "character import definition validation runs in the import worker",
                    { importValidationResults },
                );
                const serialized = await persistenceWorkerRequest("json-stringify", {
                    value: { export_marker: "worker JSON export", nested: { value: 9 } },
                });
                devAssert(
                    JSON.parse(serialized)?.nested?.value === 9,
                    "export JSON serialization runs through the worker and round-trips exactly",
                    { serialized },
                );
                await devWaitFor(
                    () => ![...(app.activityTasks?.values?.() || [])].some((task) =>
                        /Testing (turn|background|stale)/i.test(task?.label || ""),
                    ),
                    1000,
                    "worker scheduling activity tasks to clear",
                );
                devAssert(
                    !document.getElementById("emberAdventuresActivityIndicator"),
                    "activity indicator clears after all scheduled work finishes",
                );
                devTestLog("Scenario complete: worker-task-scheduling-smoke");
            } finally {
                app.gameStateRevision = revisionBefore;
            }
        }

        async function devRunPerformanceRenderingSmokeTest() {
            devTestLog("Scenario start: performance-rendering-smoke");
            devResetForLiveTest("performance-rendering-smoke");
            const originalRequestRenderRegions = requestRenderRegions;
            const originalRenderThread = renderThread;
            const originalBaselineRequired = runtimeAggregateDirtyTracker.baselineRequired;
            const originalHeaderSummaryCache = app.saveHeaderSummaryCache;
            try {
                app.messages = [];
                app.messageIndex = new Map();
                app.messageListRevision = 1;
                app.threadRenderLimit = 40;
                for (let index = 0; index < 75; index++) {
                    addMessage("assistant", `Performance transcript message ${index + 1}.`, "", {
                        id: `performance-message-${index + 1}`,
                    });
                }
                const transcriptImageHtml =
                    '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Transcript window smoke image">';
                app.images = [
                    {
                        id: "performance-old-window-image",
                        title: "Old transcript image",
                        html: transcriptImageHtml,
                        requestedAfterMessageId: "performance-message-5",
                        requestedAt: "2026-01-01T00:00:05.000Z",
                        pending: false,
                        error: "",
                    },
                    {
                        id: "performance-current-window-image",
                        title: "Current transcript image",
                        html: transcriptImageHtml,
                        requestedAfterMessageId: "performance-message-75",
                        requestedAt: "2026-01-01T00:01:15.000Z",
                        pending: false,
                        error: "",
                    },
                ];
                app.imageTimelineRevision++;
                renderThread("performance rendering smoke transcript");
                devAssert(
                    document.querySelectorAll("#thread [data-message-id]").length <= 40,
                    "thread rendering keeps a bounded DOM window for long transcripts",
                    {
                        rendered: document.querySelectorAll("#thread [data-message-id]").length,
                        limit: app.threadRenderLimit,
                    },
                );
                devAssert(
                    !document.querySelector(
                        '#thread [data-image-id="performance-old-window-image"]',
                    ) &&
                        !!document.querySelector(
                            '#thread [data-image-id="performance-current-window-image"]',
                        ),
                    "bounded transcript rendering hides images anchored to messages outside the visible window",
                    { threadHtml: $("thread")?.innerHTML || "" },
                );
                $("thread").scrollTop = 0;
                devAssert(
                    expandThreadWindowAtTop($("thread")),
                    "reaching the top schedules the earlier transcript window",
                );
                await devWaitFor(
                    () =>
                        app.threadRenderLimit >= 75 &&
                        document.querySelectorAll("#thread [data-message-id]").length === 75,
                    2000,
                    "earlier transcript window to render",
                );
                devAssert(
                    !!document.querySelector(
                        '#thread [data-image-id="performance-old-window-image"]',
                    ),
                    "an older anchored image appears when its message enters the visible window",
                );
                devAssert(
                    findMessageById("performance-message-75")?.text.includes("75"),
                    "message lookup resolves through the indexed transcript",
                );

                runtimeAggregateDirtyTracker.baselineRequired = false;
                runtimeAggregateDirtyTracker.messages.clear();
                runtimeAggregateDirtyTracker.images.clear();
                app.saveHeaderSummaryCache = null;
                const headerSummaryBefore = activeSaveHeaderSummary();
                const headerCacheBefore = app.saveHeaderSummaryCache;
                const headerMessage = findMessageById("performance-message-75");

                const headerSummaryAfter = activeSaveHeaderSummary();


                let capturedRegions = null;
                requestRenderRegions = (regions) => {
                    capturedRegions = { ...(regions || {}) };
                };
                // The fixture added its transcript directly. Keep the runtime
                // revision baseline in sync so this scene-only mutation does
                // not correctly request an unrelated thread refresh.
                app.lastRuntimeRenderMessageRevision = Number(app.messageListRevision || 0);
                runtimeRenderMutationRoots.clear();
                runtimeRenderMutationRoots.add("scene");
                requestRuntimeMutationRender("performance rendering smoke scene mutation");
                devAssert(
                    capturedRegions?.scene === true &&
                        capturedRegions?.thread !== true &&
                        capturedRegions?.objective !== true,
                    "scene mutations schedule only their affected UI regions",
                    { capturedRegions },
                );
                requestRenderRegions = originalRequestRenderRegions;

                const streamMessage = findMessageById("performance-message-75");
                let renderThreadCalls = 0;
                renderThread = (...args) => {
                    renderThreadCalls++;
                    return originalRenderThread(...args);
                };
                queueStreamingMessageUpdate(streamMessage.id, "(Narrator) \"A short streamed reply.\"", {
                    done: true,
                });
                const streamNode = document.querySelector(
                    `#thread [data-message-id="${cssEscape(String(streamMessage.id))}"] .message-stream-text`,
                );
                devAssert(
                    !!streamNode && streamNode.textContent.includes("short streamed reply"),
                    "streaming updates only the message text node",
                    { streamHtml: streamNode?.outerHTML || "" },
                );
                devAssert(
                    renderThreadCalls === 0,
                    "streaming does not rebuild the transcript",
                    { renderThreadCalls },
                );
                updateMessage(streamMessage.id, "(Narrator) \"A completed reply.\"", {
                    render: "message",
                    save: false,
                });
                updateVoiceRangeHighlight(streamMessage.id, 12, 9);
                devAssert(
                    renderThreadCalls === 0 &&
                        !!document.querySelector(
                            `#thread [data-message-id="${cssEscape(String(streamMessage.id))}"] .voice-current-word`,
                        ),
                    "voice highlighting updates the active message DOM without a transcript rebuild",
                    { renderThreadCalls },
                );
                renderThread = originalRenderThread;

                const order = [];
                app.work.scheduleUi("performance-background", () => order.push("background"), {
                    priority: "background",
                });
                app.work.scheduleUi("performance-immediate", () => order.push("immediate"), {
                    priority: "immediate",
                });
                await devWaitFor(
                    () => order.length === 2,
                    1000,
                    "budgeted UI scheduler to run queued work",
                );
                devAssert(
                    order[0] === "immediate" && order[1] === "background",
                    "budgeted UI scheduler honors priority order",
                    { order },
                );
                const libraryResults = document.createElement("div");
                libraryResults.className = "library-results";
                document.body.append(libraryResults);
                const libraryRecords = Array.from({ length: 75 }, (_, index) => ({
                    id: `virtual-library-${index + 1}`,
                    name: `Virtual Library ${index + 1}`,
                }));
                app.virtualLibraryStates?.delete("performance-rendering-smoke");
                renderVirtualLibraryRecords({
                    key: "performance-rendering-smoke",
                    results: libraryResults,
                    records: libraryRecords,
                    htmlForRecord: (record) => `<article data-performance-library-card="${escapeHtml(record.id)}">${escapeHtml(record.name)}</article>`,
                    emptyHtml: "<p>Empty</p>",
                    immediate: false,
                });
                await devWaitFor(
                    () => !!libraryResults.querySelector("[data-virtual-library-more]"),
                    2000,
                    "virtual library to finish its first page",
                );
                devAssert(
                    libraryResults.querySelectorAll("[data-performance-library-card]").length < libraryRecords.length &&
                        !!libraryResults.querySelector("[data-virtual-library-more]"),
                    "library rendering creates a bounded first page with explicit incremental loading",
                    {
                        rendered: libraryResults.querySelectorAll("[data-performance-library-card]").length,
                        total: libraryRecords.length,
                    },
                );
                libraryResults.remove();
                devAssert(
                    /IntersectionObserver/.test(activatePluginIframes.toString()),
                    "plugin iframe activation defers offscreen frames through IntersectionObserver",
                );
                devAssert(
                    !/\.toDataURL\(/.test(setupProfileCropEditor.toString()) &&
                        /\.toBlob\(/.test(setupProfileCropEditor.toString()),
                    "profile crop encoding uses asynchronous canvas toBlob instead of toDataURL",
                );
                devTestLog("Scenario complete: performance-rendering-smoke");
            } finally {
                requestRenderRegions = originalRequestRenderRegions;
                renderThread = originalRenderThread;
                runtimeAggregateDirtyTracker.baselineRequired = originalBaselineRequired;
                app.saveHeaderSummaryCache = originalHeaderSummaryCache;
            }
        }

        async function devRunSaveSchedulerTimingSmokeTest() {
            devTestLog("Scenario start: save-scheduler-timing-smoke");
            flushScheduledSaveAllIfPossible("save scheduler timing setup");
            app.activeGameSaveScheduleSmokeLog = [];
            app.activeGameSaveFlushSmokeLog = [];
            try {
                const normalStarted = Date.now();
                scheduleActiveGameSave("save scheduler normal timing");
                devAssert(
                    app.activeGameSaveDeadlineAt - normalStarted >= SAVE_ALL_NORMAL_DELAY_MS - 150 &&
                        app.activeGameSaveDeadlineAt - normalStarted <= SAVE_ALL_NORMAL_DELAY_MS + 300,
                    "normal save scheduler uses the 5 second delay",
                    {
                        expectedMs: SAVE_ALL_NORMAL_DELAY_MS,
                        remainingMs: app.activeGameSaveDeadlineAt - normalStarted,
                    },
                );
                await devWaitFor(
                    () =>
                        (app.activeGameSaveFlushSmokeLog || []).some(
                            (entry) => entry.reason === "save scheduler normal timing",
                        ),
                    SAVE_ALL_NORMAL_DELAY_MS + 3000,
                    "normal save scheduler flush",
                );
                const normalFlushEntry = (app.activeGameSaveFlushSmokeLog || []).find(
                    (entry) => entry.reason === "save scheduler normal timing",
                );
                //Measure the callback itself; a background tab can resume this observer much later.
                const normalElapsed = normalFlushEntry.at - normalStarted;
                const lifecycleFlush = /saved before page (hidden|hide|unload)/i.test(
                    normalFlushEntry?.trigger || "",
                );
                devAssert(
                    lifecycleFlush ||
                        (normalElapsed >= SAVE_ALL_NORMAL_DELAY_MS - 350 &&
                            normalElapsed <= SAVE_ALL_NORMAL_DELAY_MS + 3000),
                    "normal scheduled save flushes after about 5 seconds unless page lifecycle requires an immediate flush",
                    {
                        normalElapsed,
                        expectedMs: SAVE_ALL_NORMAL_DELAY_MS,
                        lifecycleFlush,
                        trigger: normalFlushEntry?.trigger || "",
                    },
                );

                app.activeGameSaveFlushSmokeLog = [];
                const urgentStarted = Date.now();
                scheduleActiveGameSaveSoon("save scheduler urgent timing");
                devAssert(
                    app.activeGameSaveDeadlineAt - urgentStarted >= SAVE_ALL_URGENT_DELAY_MS - 100 &&
                        app.activeGameSaveDeadlineAt - urgentStarted <= SAVE_ALL_URGENT_DELAY_MS + 250,
                    "urgent save scheduler uses the 0.5 second delay",
                    {
                        expectedMs: SAVE_ALL_URGENT_DELAY_MS,
                        remainingMs: app.activeGameSaveDeadlineAt - urgentStarted,
                    },
                );
                await devWaitFor(
                    () =>
                        (app.activeGameSaveFlushSmokeLog || []).some(
                            (entry) => entry.reason === "save scheduler urgent timing",
                        ),
                    SAVE_ALL_URGENT_DELAY_MS + 2500,
                    "urgent save scheduler flush",
                );
                const urgentFlushEntry = (app.activeGameSaveFlushSmokeLog || []).find(
                    (entry) => entry.reason === "save scheduler urgent timing",
                );
                const urgentElapsed = urgentFlushEntry.at - urgentStarted;
                devAssert(
                    urgentElapsed >= SAVE_ALL_URGENT_DELAY_MS - 150 &&
                        urgentElapsed <= SAVE_ALL_URGENT_DELAY_MS + 2500,
                    "urgent scheduled save flushes after about 0.5 seconds",
                    { urgentElapsed, expectedMs: SAVE_ALL_URGENT_DELAY_MS },
                );
                await flushLargeSaves();
                devTestLog("Scenario complete: save-scheduler-timing-smoke", {
                    normalElapsed,
                    urgentElapsed,
                });
            } finally {
                clearTimeout(app.activeGameSaveTimer);
                app.activeGameSaveTimer = null;
                app.activeGameSaveDeadlineAt = 0;
                app.activeGameSaveDirty = false;
                app.activeGameSavePendingReason = "";
                app.activeGameSaveQueuedCount = 0;
                app.activeGameSaveFirstQueuedAt = 0;
                app.activeGameSaveScheduleSmokeLog = null;
                app.activeGameSaveFlushSmokeLog = null;
            }
        }

        async function devRunSaveSchedulerActionsSmokeTest() {
            devTestLog("Scenario start: save-scheduler-actions-smoke");
            flushScheduledSaveAllIfPossible("save scheduler action setup");
            app.activeGameSaveScheduleSmokeLog = [];
            app.activeGameSaveFlushSmokeLog = [];
            try {
                const normalStarted = Date.now();
                scheduleActiveGameSave("save scheduler action normal");
                const normalDeadline = app.activeGameSaveDeadlineAt;
                devAssert(
                    normalDeadline - normalStarted >= SAVE_ALL_NORMAL_DELAY_MS - 150,
                    "normal action schedules a delayed save",
                    { normalDeadline, normalStarted },
                );

                scheduleActiveGameSave("save scheduler action later normal");
                devAssert(
                    app.activeGameSaveDeadlineAt === normalDeadline,
                    "a second normal save does not push the deadline farther out",
                    {
                        normalDeadline,
                        currentDeadline: app.activeGameSaveDeadlineAt,
                        scheduleLog: app.activeGameSaveScheduleSmokeLog,
                    },
                );

                const urgentStarted = Date.now();
                scheduleActiveGameSaveSoon("save scheduler action urgent");
                const urgentDeadline = app.activeGameSaveDeadlineAt;
                devAssert(
                    urgentDeadline < normalDeadline &&
                        urgentDeadline - urgentStarted <= SAVE_ALL_URGENT_DELAY_MS + 250,
                    "urgent action pulls the pending save down to 0.5 seconds",
                    { normalDeadline, urgentDeadline, urgentStarted },
                );

                scheduleActiveGameSave("save scheduler action normal after urgent");
                devAssert(
                    app.activeGameSaveDeadlineAt === urgentDeadline,
                    "normal action after urgent does not lengthen the urgent deadline",
                    { urgentDeadline, currentDeadline: app.activeGameSaveDeadlineAt },
                );

                flushScheduledSaveAll("save scheduler forced action");
                devAssert(
                    !app.activeGameSaveTimer &&
                        !app.activeGameSaveDeadlineAt &&
                        !app.activeGameSaveDirty &&
                        (app.activeGameSaveFlushSmokeLog || []).some(
                            (entry) => entry.reason === "save scheduler action normal after urgent",
                        ),
                    "forced save clears the pending scheduler state immediately",
                    {
                        timer: !!app.activeGameSaveTimer,
                        deadline: app.activeGameSaveDeadlineAt,
                        dirty: app.activeGameSaveDirty,
                        flushLog: app.activeGameSaveFlushSmokeLog,
                    },
                );

                await flushActiveGameSave();
                devAssert(!app.activeGameSaveTimer && !app.activeGameSaveDirty, "flushActiveGameSave leaves no pending save");
                await flushLargeSaves();
                devTestLog("Scenario complete: save-scheduler-actions-smoke");
            } finally {
                clearTimeout(app.activeGameSaveTimer);
                app.activeGameSaveTimer = null;
                app.activeGameSaveDeadlineAt = 0;
                app.activeGameSaveDirty = false;
                app.activeGameSavePendingReason = "";
                app.activeGameSaveQueuedCount = 0;
                app.activeGameSaveFirstQueuedAt = 0;
                app.activeGameSaveScheduleSmokeLog = null;
                app.activeGameSaveFlushSmokeLog = null;
            }
        }

        async function devRunSaveSessionLifecycleSmokeTest() {
            devTestLog("Scenario start: save-session-lifecycle-smoke");
            const originalSaveSessionActive = app.saveSessionActive;
            const originalSaveSessionContext = app.saveSessionContext;
            const storageFailureCount = (app.storageFailures || []).length;
            try {
                cancelScheduledActiveGameSave();
                app.saveSessionActive = false;
                app.saveSessionContext = null;
                app.activeGameSaveDirty = true;
                app.activeGameSavePendingReason = "stale save after session close";
                app.activeGameSaveQueuedCount = 1;
                app.activeGameSaveFirstQueuedAt = performance.now();
                app.activeGameSaveTimer = setTimeout(() => {}, 5000);
                app.activeGameSaveDeadlineAt = Date.now() + 5000;

                flushScheduledSaveAll("save session closed before scheduled flush");

                const newFailures = (app.storageFailures || []).slice(storageFailureCount);
                devAssert(
                    !app.activeGameSaveTimer &&
                        !app.activeGameSaveDirty &&
                        !app.activeGameSaveDeadlineAt &&
                        !newFailures.some((entry) =>
                            /current normalized save session/i.test(entry?.message || ""),
                        ),
                    "closing a save session drops stale scheduled saves without a storage failure",
                    {
                        timer: !!app.activeGameSaveTimer,
                        dirty: app.activeGameSaveDirty,
                        deadline: app.activeGameSaveDeadlineAt,
                        newFailures,
                    },
                );
                devTestLog("Scenario complete: save-session-lifecycle-smoke");
            }
            finally {
                cancelScheduledActiveGameSave();
                app.saveSessionActive = originalSaveSessionActive;
                app.saveSessionContext = originalSaveSessionContext;
            }
        }

        async function devRunAiCharacterGenerationContractSmokeTest() {
            devTestLog("Scenario start: ai-character-generation-contract-smoke");
            const originalState = clone(app.state);
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalDefinitions = clone(app.characterDefinitions || []);
            const originalCreatorRegistry = clone(creatorIdentityRegistry());
            const originalMineCreatorId = app.mineCreatorId;
            try {
                devResetForLiveTest("ai-character-generation-contract-smoke");
                const generatedCreator = createCreatorIdentityRecord({
                    creator_id: "00000000-0000-4000-8000-000000000033",
                    creator_name: "Character Contract Creator",
                });
                app.creatorIdentityRegistry = exactCreatorIdentityRegistry({
                    identities: [generatedCreator],
                    last_used_creator_id: generatedCreator.creator_id,
                });
                app.mineCreatorId = generatedCreator.creator_id;
                saveSupabaseSession({
                    access_token: "mock-character-contract-token",
                    refresh_token: "mock-character-contract-refresh",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "contract-user", email: "creator@example.com" },
                });
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        title: "Contract Smoke Story",
                        genres: ["fantasy", "romance"],
                    },
                    location: {
                        ...clone(defaultState.location || {}),
                    settlement_name: "Prompt Town",
                    specific_place: "Quiet Tavern",
                    npc_location_id: "quiet-tavern",
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "A quiet evening inside Prompt Town.",
                        party_members_present: ["Player", "Mira Vale"],
                        npcs_present: ["Nora Flint", "Secret Name"],
                    },
                    player: {
                        ...clone(defaultState.player),
                        name: "Test Player",
                        boldness: 6,
                        appearance: {
                            ...blankAppearanceTemplate(),
                            species: "human",
                            height: 10,
                            shoulder_width: 10,
                            chest: 13,
                            upper_body_build: 8,
                            midsection_build: 8,
                            hip_width: 10,
                            butt_build: 8,
                            lower_body_build: 8,
                            arm_length: 10,
                            leg_length: 10,
                        },
                        active_outfit_id: "player-current-outfit",
                        voice: {
                            gender_bucket: "male",
                            preferred_voice_name: "Hidden Player Voice",
                        },
                        inventory: [
                            "brass key",
                            {
                                item: "removed player coat",
                                clothing_slot: "coat",
                                removed_by: "manual",
                            },
                        ],
                        outfits: [
                            {
                                id: "player-current-outfit",
                                name: "Player Current Outfit",
                                clothing: {
                                    ...blankClothingTemplate(),
                                    shirt: "visible player shirt",
                                },
                            },
                            {
                                id: "player-hidden-outfit",
                                name: "Player Spare Outfit",
                                clothing: {
                                    ...blankClothingTemplate(),
                                    shirt: "player hidden outfit text",
                                },
                            },
                        ],
                    },
                    characters: {
                        "Mira Vale": {
                            ...blankCharacterTemplate("Mira Vale"),
                            name: "Mira Vale",
                            gender: "female",
                            role: "party scout",
                            boldness: 8,
                            appearance: {
                                ...blankAppearanceTemplate(),
                                species: "human",
                                height: 10,
                                shoulder_width: 12,
                                chest: 13,
                                upper_body_build: 11,
                                midsection_build: 10,
                                hip_width: 11,
                                butt_build: 8,
                                lower_body_build: 11,
                                arm_length: 11,
                                leg_length: 11,
                            },
                            clothing: {
                                ...blankClothingTemplate(),
                                shirt: "green tunic",
                                pants: "brown trousers",
                            },
                            active_outfit_id: "mira-current-outfit",
                            voice: {
                                gender_bucket: "non_male",
                                preferred_voice_name: "Hidden Voice",
                            },
                            inventory: [
                                "silver compass",
                                {
                                    item: "removed scout cloak",
                                    clothing_slot: "coat",
                                    removed_by: "manual",
                                },
                            ],
                            outfits: [
                                {
                                    id: "mira-current-outfit",
                                    name: "Mira Current Outfit",
                                    clothing: {
                                        ...blankClothingTemplate(),
                                        shirt: "green tunic",
                                        pants: "brown trousers",
                                    },
                                },
                                {
                                    id: "mira-hidden-dress",
                                    name: "Hidden Dress",
                                    clothing: {
                                        ...blankClothingTemplate(),
                                        shirt: "secret full outfit text that must not be prompted",
                                    },
                                },
                            ],
                        },
                    },
                    npc_directory: {
                        locations: {
                            "quiet-tavern": {
                                label: "Quiet Tavern",
                                characters: {
                                    "Nora Flint": {
                                        name: "Nora Flint",
                                        gender: "female",
                                        age: 31,
                                        role: "adult tavern keeper",
                                        relationship: "friendly",
                                        note: "Nora Flint keeps the tavern running.",
                                        inspected: true,
                                        full_character: {
                                            ...blankCharacterTemplate("Nora Flint"),
                                            name: "Nora Flint",
                                            gender: "female",
                                            age: 31,
                                            role: "adult tavern keeper",
                                            boldness: 7,
                                            appearance: {
                                                ...blankAppearanceTemplate(),
                                                species: "human",
                                                height: 10,
                                                shoulder_width: 11,
                                                chest: 13,
                                                upper_body_build: 7,
                                                midsection_build: 7,
                                                hip_width: 9,
                                                butt_build: 7,
                                                lower_body_build: 7,
                                                arm_length: 9,
                                                leg_length: 9,
                                            },
                                            active_outfit_id: "npc-current-outfit",
                                            voice: {
                                                gender_bucket: "non_male",
                                                preferred_voice_name: "Hidden NPC Voice",
                                            },
                                            inventory: [
                                                "ledger",
                                                {
                                                    item: "removed tavern apron",
                                                    clothing_slot: "over_shirt",
                                                    removed_by: "manual",
                                                },
                                            ],
                                            outfits: [
                                                {
                                                    id: "npc-current-outfit",
                                                    name: "Tavern Current Outfit",
                                                    clothing: {
                                                        ...blankClothingTemplate(),
                                                        shirt: "visible tavern shirt",
                                                    },
                                                },
                                                {
                                                    id: "npc-hidden-outfit",
                                                    name: "Tavern Spare Outfit",
                                                    clothing: {
                                                        ...blankClothingTemplate(),
                                                        shirt: "npc hidden outfit text",
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                    "Secret Name": {
                                        name: "Secret Name",
                                        gender: "female",
                                        age: 33,
                                        role: "masked stranger",
                                        relationship: "unknown",
                                        note: "Secret Name is visibly present but not identified to the player.",
                                        player_known_name: false,
                                        player_facing_label: "masked stranger",
                                        inspected: true,
                                        full_character: {
                                            ...blankCharacterTemplate("Secret Name"),
                                            name: "Secret Name",
                                            gender: "female",
                                            age: 33,
                                            role: "hidden operative",
                                            personality_description:
                                                "Secret Name knows hidden truth that must not leak into auto-player turns.",
                                            known_facts: [
                                                "Secret Name's real identity is hidden from the player.",
                                            ],
                                        },
                                    },
                                },
                            },
                        },
                    },
                    objectives: {
                        ...clone(defaultState.objectives || {}),
                        active_id: "secret-name-objective",
                        no_current: false,
                        items: [
                            {
                                id: "secret-name-objective",
                                title: "Question Secret Name",
                                kind: "main",
                                status: "active",
                                summary: "Ask Secret Name why she is watching the tavern.",
                                rewards: [
                                    {
                                        type: "add_story_rule",
                                        rule_id: "secret-name-hidden",
                                        text: "Secret Name is actually a hidden operative.",
                                    },
                                ],
                                completion_control: "player",
                                completion_criteria:
                                    "Return yes only when the player questions Secret Name.",
                            },
                        ],
                    },
                });
                const template = compactGeneratedCharacterAiTemplate();
                const hiddenKeys = [
                    "source",
                    "creator",
                    "creation_tool",
                    "genres",
                    "voice",
                    "outfits",
                    "active_outfit_id",
                    "image",
                    "default_seed",
                    "image_prompt_config",
                    "default_profile_image",
                    "starting_relationship_to_player",
                ];
                devAssert(
                    hiddenKeys.every((key) => !(key in template)) && !("name" in template),
                    "AI character prompt template hides app-owned definition/default fields",
                    { template },
                );
                const instruction = buildGeneratedCharacterAiInstruction({
                    mode: "create",
                    promptText: "Create a cheerful adult tavern musician.",
                });
                const miraPromptEntity = app.state.characters["Mira Vale"];
                const expectedMiraUpperBuild = bodyStatPhrase(
                    "upper_body_build",
                    miraPromptEntity.appearance.upper_body_build,
                    { entity: miraPromptEntity },
                );
                const expectedMiraMidsection = bodyStatPhrase(
                    "midsection_build",
                    miraPromptEntity.appearance.midsection_build,
                    { entity: miraPromptEntity },
                );
                const expectedPlayerHeight = bodyStatPhrase(
                    "height",
                    app.state.player.appearance.height,
                    { entity: app.state.player },
                );
                const forbiddenPromptTerms = hiddenKeys.filter(
                    (key) => key !== "genres" && key !== "outfits" && key !== "voice",
                );
                //Check the requested character payload and game context for leaks.
                const promptContent = instruction.replace(generatedCharacterAiRulesText(), "");
                const compactPromptChecks = {
                    outputName: instruction.includes('"name": "First Last"'),
                    character: instruction.includes('"character"'),
                    speechStyle: instruction.includes('"speech_style"'),
                    noHiddenOutfitText: !instruction.includes(
                        "secret full outfit text that must not be prompted",
                    ),
                    noHiddenVoice: !instruction.includes("Hidden Voice"),
                    noHiddenOutfitId: !instruction.includes("hidden-dress"),
                    noRemovedClothing: !instruction.includes("removed scout cloak"),
                    noRawChest: !instruction.includes('"chest": 8'),
                    noRetiredStomach: !instruction.includes('"stomach": 10'),
                    noRawBoldness: !instruction.includes('"boldness": 8'),
                    miraUpperBuild: instruction.includes(expectedMiraUpperBuild),
                    miraMidsection: instruction.includes(expectedMiraMidsection),
                    noDefinitionFields: forbiddenPromptTerms.every(
                        (key) => !promptContent.includes(key),
                    ),
                    alternateOutfitSchema: generatedCharacterAiRulesText().includes(
                        '"clothing":{',
                    ),
                    outfitName: instruction.includes("Hidden Dress"),
                };
                devAssert(
                    Object.values(compactPromptChecks).every(Boolean),
                    `AI character prompt uses compact schema, outfit names only, and prompt-safe state summaries; failed checks: ${Object.entries(compactPromptChecks).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "none"}`,
                    { instruction, forbiddenPromptTerms, checks: compactPromptChecks },
                );
                const promptState = stateForAiPrompt(app.state);
                const promptStateText = compactJson(promptState);
                const promptContexts = {
                    full_state: promptStateText,
                    state_check: compactJson(buildStateCheckContext(app.state)),
                    reply: compactJson(buildReplyStateContext()),
                    auto_player: compactJson(buildAutoPlayerTurnStateContext(app.state)),
                    npc_directory: compactJson(knownNpcDirectoryForPrompt(app.state.npc_directory)),
                };
                const allPromptContextText = Object.values(promptContexts).join("\n");
                const forbiddenPromptSnippets = [
                    '"voice"',
                    '"active_outfit_id"',
                    '"height": 5',
                    '"height": 6',
                    '"height": 7',
                    '"muscular": 4',
                    '"muscular": 5',
                    '"muscular": 6',
                    '"shoulders": 5',
                    '"shoulders": 6',
                    '"shoulders": 7',
                    '"chest": 5',
                    '"chest": 6',
                    '"chest": 8',
                    '"stomach": 5',
                    '"stomach": 7',
                    '"stomach": 10',
                    '"hips": 5',
                    '"hips": 6',
                    '"hips": 7',
                    '"waist": 3',
                    '"waist": 4',
                    '"waist": 5',
                    '"legs": 5',
                    '"legs": 6',
                    '"legs": 7',
                    '"arms": 5',
                    '"arms": 6',
                    '"boldness": 6',
                    '"boldness": 7',
                    '"boldness": 8',
                    "Hidden Voice",
                    "Hidden Player Voice",
                    "Hidden NPC Voice",
                    "hidden-dress",
                    "player-hidden-outfit",
                    "npc-hidden-outfit",
                    "secret full outfit text that must not be prompted",
                    "player hidden outfit text",
                    "npc hidden outfit text",
                    "removed scout cloak",
                    "removed player coat",
                    "removed tavern apron",
                    "state_version",
                ];
                devAssert(
                    forbiddenPromptSnippets.every(
                        (snippet) => !allPromptContextText.includes(snippet),
                    ),
                    "all AI state prompt contexts hide app-owned fields, outfit ids/details, removed clothing inventory, and raw numeric stats",
                    { promptContexts, forbiddenPromptSnippets },
                );
                const autoPlayerPrompt = buildAutoPlayerTurnInstruction();
                devAssert(
                    promptContexts.auto_player.includes("masked stranger") &&
                        autoPlayerPrompt.includes("masked stranger") &&
                        !promptContexts.auto_player.includes("Secret Name") &&
                        !autoPlayerPrompt.includes("Secret Name") &&
                        !promptContexts.auto_player.includes("hidden truth") &&
                        !promptContexts.auto_player.includes("hidden operative"),
                    "auto-player prompt masks unknown NPC real names, hidden full records, and selected objective internals",
                    { autoPlayerContext: promptContexts.auto_player, autoPlayerPrompt },
                );
                const usefulPromptContextChecks = {
                    playerCurrentOutfit:
                        promptStateText.includes("Player Current Outfit"),
                    playerSpareOutfit:
                        promptStateText.includes("Player Spare Outfit"),
                    hiddenDress: promptStateText.includes("Hidden Dress"),
                    npcCurrentOutfit:
                        promptContexts.npc_directory.includes(
                            "Tavern Current Outfit",
                        ),
                    npcSpareOutfit:
                        promptContexts.npc_directory.includes(
                            "Tavern Spare Outfit",
                        ),
                    playerHeight:
                        promptState.player?.appearance?.height ===
                        expectedPlayerHeight,
                    miraUpperBuild:
                        promptStateText.includes(expectedMiraUpperBuild),
                    miraMidsection:
                        promptStateText.includes(expectedMiraMidsection),
                    playerInventory: promptStateText.includes("brass key"),
                    partyInventory: promptStateText.includes("silver compass"),
                    npcInventory: promptContexts.npc_directory.includes("ledger"),
                };
                devAssert(
                    Object.values(usefulPromptContextChecks).every(Boolean),
                    `prompt-safe contexts preserve useful outfit names, converted body stat strings, and normal inventory; failed checks: ${Object.entries(usefulPromptContextChecks).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "none"}`,
                    { promptContexts, checks: usefulPromptContextChecks },
                );
                const finalized = finalizeGeneratedCharacterFromAiPayload({
                    name: "Lina Harrow",
                    character: {
                        gender: "female",
                        age: 29,
                        role: "tavern musician",
                        personality_description:
                            "Lina Harrow is warm, observant, and quick to turn tension into a joke.",
                        speech_style:
                            "Lina speaks warmly with quick, disarming jokes when tension rises.",
                        appearance: {
                            ...blankAppearanceTemplate(),
                            species: "human",
                            chest: 5,
                        },
                        clothing: {
                            ...blankClothingTemplate(),
                            shirt: "blue blouse",
                            skirt: "long black skirt",
                        },
                        held_items: { right_hand: "lute", left_hand: null },
                        known_facts: ["Lina Harrow is an adult musician."],
                    },
                });
                app.state.characters = { "Lina Harrow": finalized };
                const record = runtimeCharacterDefinitionRecord("Lina Harrow", finalized);
                devAssert(
                    record.character.starting_outfit_id === "default" &&
                        record.character.outfits?.[0]?.clothing?.shirt === "blue blouse" &&
                        !("clothing" in record.character) &&
                        !("relationship_to_player" in record.character) &&
                        !("active_outfit_id" in record.character) &&
                        record.character.default_seed === 0 &&
                        record.character.speech_style ===
                            "Lina speaks warmly with quick, disarming jokes when tension rises.",
                    "runtime character saves to a clean library definition without current game fields",
                    record,
                );
                devTestLog("Scenario complete: ai-character-generation-contract-smoke");
            } finally {
                app.state = repairAiGeneratedState(originalState);
                saveSupabaseSession(originalSession);
                app.creatorIdentityRegistry = exactCreatorIdentityRegistry(originalCreatorRegistry);
                app.mineCreatorId = originalMineCreatorId;
                app.characterDefinitions = validatedCharacterLibraryDefinitions(originalDefinitions);
            }
        }

        async function devRunRealPerchanceStreamingRegenerateSmokeTest() {
            devTestLog("Scenario start: real-perchance-streaming-regenerate-smoke");
            if (!perchancePlugin("aiTextPlugin"))
                throw new Error("Perchance aiTextPlugin is not available for live streaming regenerate smoke.");
            openModal(`
                <h2>Real Perchance Streaming Smoke</h2>
                <p class="hint">Running live text-stream mutation checks. This can take about a minute when Perchance is slow.</p>
                ${loadingSpinnerHtml("Waiting for Perchance text stream")}
            `);
            setStatus("Running real Perchance streaming smoke...");
            const savedMessages = clone(app.messages || []);
            const savedBusy = app.busy;
            const savedAiActive = app.aiActive;
            const savedAiQueue = app.aiQueue || [];
            const savedPendingRegenerate = app.pendingRegenerateMessage;
            const savedCancelled = new Set(app.cancelledAiMessageIds || []);
            const savedActiveVoiceMessageId = app.activeVoiceMessageId;
            const savedVoiceToken = app.activeVoiceToken;
            const savedEmergencyExportFallbackShown = clone(
                app.emergencyExportFallbackShown || null,
            );
            const originalShowConfirm = showConfirm;
            const originalShowPrompt = showPrompt;
            const originalRunImmediateChecksForMutatedMessage =
                runImmediateChecksForMutatedMessage;
            try {
                showConfirm = async () => true;
                showPrompt = async () => "Edited while the old stream is cancelled.";
                runImmediateChecksForMutatedMessage = async () => true;
                const runLiveMutation = async (mode) => {
                    const diagnosticRunId = devLivePerchanceTextSmokeRunId(
                        `stream-${mode}`,
                    );
                    devTestLog("Streaming live text diagnostic run id", {
                        mode,
                        diagnosticRunId,
                    });
                    app.messages = [];
                    app.aiQueue = [];
                    app.aiActive = null;
                    app.pendingRegenerateMessage = null;
                    app.cancelledAiMessageIds = new Set();
                    app.emergencyExportFallbackShown = null;
                    document.getElementById("emberAdventuresEmergencyExport")?.remove();
                    app.busy = true;
                    const message = addMessage("assistant", "", "Narrator");
                    message.stateSyncStatus = "pending";

                    app.activeVoiceMessageId = message.id;
                    let sawStream = false;
                    let sawNonEmptyStream = false;
                    let staleStreamAttempted = false;
                    let actionResult = null;
                    let actionPromise = null;
                    let textBeforeCancel = "";
                    const triggerMutation = () => {
                        if (actionPromise) return;
                        textBeforeCancel = String(findMessageById(message.id)?.text || "");
                        if (mode === "stop") actionResult = stopGeneratingMessage(message.id);
                        else if (mode === "delete") actionResult = deleteMessage(message.id);
                        else if (mode === "edit") actionResult = editMessage(message.id);
                        else
                            actionResult = regenerateAssistantMessage(
                                message.id,
                                "try again",
                                { reason: "live streaming regenerate smoke" },
                            );
                        actionPromise = Promise.resolve(actionResult);
                    };
                    const livePromise = aiText(
                        `Write a short plain-text list counting from one to twelve for ${mode}.
Diagnostic run id: ${diagnosticRunId}
Ignore the diagnostic run id. It exists only to keep this live smoke prompt unique.
Do not include JSON.`,
                        {
                            label: "character reply",
                            messageId: message.id,
                            onStream: (text) => {
                                if (
                                    app.cancelledAiMessageIds.has(String(message.id)) ||
                                    !findMessageById(message.id)
                                ) {
                                    staleStreamAttempted = true;
                                    return;
                                }
                                const streamedText = String(text || "");
                                if (!streamedText.length) return;
                                sawStream = true;
                                sawNonEmptyStream = true;
                                updateMessage(message.id, streamedText, {
                                    render: "thread",
                                    save: false,
                                });
                                triggerMutation();
                            },
                        },
                    );
                    livePromise.catch(() => {});
                    try {
                        await devWaitFor(
                            () => sawNonEmptyStream && !!actionPromise,
                            60000,
                            `real Perchance text stream to start before ${mode}`,
                        );
                    } catch (err) {
                        app.cancelledAiMessageIds.add(String(message.id));
                        const stale = findMessageById(message.id);
                        if (stale) stale.generationStopped = true;
                        if (/Timed out waiting for real Perchance text stream to start/i.test(err?.message || ""))
                            throw smokeSkipError(
                                `Live Perchance text stream did not start within 60s before ${mode}.`,
                            );
                        throw err;
                    }
                    actionResult = await actionPromise;
                    const messageAfterAction = findMessageById(message.id);
                    const textImmediatelyAfterCancel = String(
                        messageAfterAction?.text || "",
                    );
                    let liveSettledAsCancel = false;
                    try {
                        await livePromise;
                    } catch (err) {
                        liveSettledAsCancel = isAiCancelledError(err);
                        if (!liveSettledAsCancel) throw err;
                    }
                    return {
                        mode,
                        diagnosticRunId,
                        actionResult,
                        textBeforeCancel,
                        textImmediatelyAfterCancel,
                        messageAfterAction,
                        visibleAfterAction: visibleMessagesForRender().some(
                            (item) => String(item.id) === String(message.id),
                        ),
                        pendingRegenerate: clone(app.pendingRegenerateMessage || null),
                        cancelledIds: [...app.cancelledAiMessageIds],
                        activeVoiceMessageId: app.activeVoiceMessageId,
                        liveSettledAsCancel,
                        staleStreamAttempted,
                        errorRecoveryShown: !!app.emergencyExportFallbackShown,
                        errorRecoveryReason:
                            app.emergencyExportFallbackShown?.reason || "",
                    };
                };
                const stopResult = await runLiveMutation("stop");
                const deleteResult = await runLiveMutation("delete");
                const editResult = await runLiveMutation("edit");
                const regenerateResult = await runLiveMutation("regenerate");
                devAssert(
                    stopResult.actionResult === true &&
                        stopResult.textBeforeCancel.length > 0 &&
                        stopResult.textImmediatelyAfterCancel ===
                            stopResult.textBeforeCancel &&
                        stopResult.messageAfterAction?.generationStopped === true &&
                        stopResult.cancelledIds.includes(
                            String(stopResult.messageAfterAction?.id || ""),
                        ) &&
                        stopResult.liveSettledAsCancel &&
                        deleteResult.textBeforeCancel.length > 0 &&
                        !deleteResult.messageAfterAction &&
                        deleteResult.liveSettledAsCancel &&
                        editResult.textBeforeCancel.length > 0 &&
                        editResult.textImmediatelyAfterCancel ===
                            "Edited while the old stream is cancelled." &&
                        (editResult.liveSettledAsCancel || !editResult.staleStreamAttempted) &&
                        regenerateResult.actionResult === true &&
                        regenerateResult.textBeforeCancel.length > 0 &&
                        regenerateResult.textImmediatelyAfterCancel === "" &&
                        regenerateResult.messageAfterAction?.hiddenWhileRegenerating === true &&
                        regenerateResult.visibleAfterAction === false &&
                        regenerateResult.pendingRegenerate?.id &&
                        regenerateResult.liveSettledAsCancel &&
                        !stopResult.errorRecoveryShown &&
                        !deleteResult.errorRecoveryShown &&
                        !editResult.errorRecoveryShown &&
                        !regenerateResult.errorRecoveryShown,
                    "real Perchance streaming assistant stop/delete/edit/regenerate actions immediately cancel stale stream output, stop extending narration, apply the visible mutation before the old request settles, and do not open Error Recovery for expected cancellations",
                    { stopResult, deleteResult, editResult, regenerateResult },
                );
                devTestLog("Scenario complete: real-perchance-streaming-regenerate-smoke");
            } finally {
                showConfirm = originalShowConfirm;
                showPrompt = originalShowPrompt;
                runImmediateChecksForMutatedMessage =
                    originalRunImmediateChecksForMutatedMessage;
                app.messages = savedMessages;
                app.busy = savedBusy;
                app.aiActive = savedAiActive;
                app.aiQueue = savedAiQueue;
                app.pendingRegenerateMessage = savedPendingRegenerate;
                app.cancelledAiMessageIds = savedCancelled;
                app.activeVoiceMessageId = savedActiveVoiceMessageId;
                app.activeVoiceToken = savedVoiceToken;
                app.emergencyExportFallbackShown = savedEmergencyExportFallbackShown;
                document.getElementById("emberAdventuresEmergencyExport")?.remove();
                closeModal();
                render();
            }
        }

        async function devRunStoryEconomyShopsJobsSmokeTest() {
            devTestLog("Scenario start: story-economy-shops-jobs-smoke");
            devResetForLiveTest("story-economy-shops-jobs-smoke");
            devCreateTestProfile({  });
            app.state.meta.setup_complete = true;
            app.state.meta.genres = ["fantasy", "adventure"];
            app.state.location = {
                universe: "Smoke",
                world: "Smoke World",
                continent: "",
                region: "Smoke Region",
                settlement_type: "market",
                settlement_name: "Smoke Market",
                district: "Test Row",
                specific_place: "Starting Corner",
            };
            app.state.characters = {
                "Smoke Ally": {
                    ...blankCharacterTemplate("Smoke Ally"),
                    id: "smoke-ally",
                    name: "Smoke Ally",
                    age: 24,
                    gender: "female",
                    role: "test ally",
                },
            };
            app.state.scene.party_members_present = ["Smoke Ally"];
            app.state.story_inventory = repairAiStoryInventory({
                coins: 500,
                adventurer_xp: 0,
                adventurer_rank: 0,
                shop_reward_tokens: 0,
                smoke_contract_total: 10,
                smoke_contract_used: 4,
                items: [
                    {
                        id: "smoke-loot",
                        name: "Smoke Loot",
                        quantity: 2,
                        value: 10,
                        sellable: true,
                        quest_item: false,
                        image_prompt: "small smoke test coin",
                    },
                    {
                        id: "smoke-quest",
                        name: "Smoke Quest Seal",
                        quantity: 1,
                        value: 999,
                        sellable: false,
                        quest_item: true,
                    },
                    {
                        id: "smoke-hosted-relic",
                        name: "Hosted Smoke Relic",
                        quantity: 1,
                        value: 0,
                        sellable: false,
                        quest_item: true,
                        image: {
                            url: devSmokePublicImageUrl(
                                "inventory-item",
                                "hosted-smoke-relic",
                            ),
                        },
                    },
                ],
            });
            runtimeSaveUnwrap(app.state).reward_bundles = {
                "smoke-shop-purchase-bundle": [
                    {
                        type: "add_story_item",
                        item: {
                            id: "smoke-shop-bonus",
                            name: "Smoke Shop Bonus",
                            type: "quest",
                            quantity: 1,
                            value: 0,
                            sellable: false,
                            quest_item: true,
                            description: "A deterministic bonus granted by a shop reward bundle.",
                            image_prompt: "A deterministic smoke shop bonus item.",
                            image_id: "",
                        },
                    },
                    {
                        type: "adjust_story_inventory",
                        field_path: ["story_inventory", "shop_reward_tokens"],
                        operation: "add",
                        amount: 2,
                    },
                ],
            };
            app.state.future_cast = {
                enabled: true,
                items: {
                    "smoke-owner": {
                        id: "smoke-owner",
                        name: "Mara Smoke",
                        status: "locked",
                        role: "shop owner",
                        full_character: {
                            ...blankCharacterTemplate("Mara Smoke"),
                            id: "smoke-owner",
                            name: "Mara Smoke",
                            age: 32,
                            gender: "female",
                            role: "shop owner",
                        },
                    },
                    "smoke-companion": {
                        id: "smoke-companion",
                        name: "Rina Smoke",
                        status: "locked",
                        role: "shop companion",
                        full_character: {
                            ...blankCharacterTemplate("Rina Smoke"),
                            name: "Rina Smoke",
                            age: 26,
                            gender: "female",
                            role: "shop companion",
                            appearance: {
                                ...blankCharacterTemplate("Rina Smoke").appearance,
                                species: "market-born fae; Outer Smoke rescue lineage with a long species description",
                            },
                        },
                    },
                    "smoke-service": {
                        id: "smoke-service",
                        name: "Selena Smoke",
                        status: "locked",
                        role: "service character",
                        full_character: {
                            ...blankCharacterTemplate("Selena Smoke"),
                            name: "Selena Smoke",
                            age: 27,
                            gender: "female",
                            role: "service character",
                        },
                    },
                    "smoke-client": {
                        id: "smoke-client",
                        name: "Clara Smoke",
                        status: "locked",
                        role: "story job client",
                        full_character: {
                            ...blankCharacterTemplate("Clara Smoke"),
                            name: "Clara Smoke",
                            age: 30,
                            gender: "female",
                            role: "story job client",
                        },
                    },
                    "smoke-locked": {
                        id: "smoke-locked",
                        name: "Locked Smoke",
                        status: "locked",
                        role: "secret role should be hidden",
                        summary: "secret shop details should be hidden",
                        full_character: {
                            ...blankCharacterTemplate("Locked Smoke"),
                            name: "Locked Smoke",
                            age: 28,
                            gender: "female",
                            role: "secret role should be hidden",
                        },
                    },
                    "smoke-expensive": {
                        id: "smoke-expensive",
                        name: "Expensive Smoke",
                        status: "locked",
                        role: "elite companion",
                        summary: "An elite companion who is visible but currently unaffordable.",
                        full_character: {
                            ...blankCharacterTemplate("Expensive Smoke"),
                            name: "Expensive Smoke",
                            age: 29,
                            gender: "female",
                            role: "elite companion",
                            appearance: {
                                ...blankCharacterTemplate("Expensive Smoke").appearance,
                                species: "iron coast dwarf",
                            },
                        },
                    },
                    "smoke-second": {
                        id: "smoke-second",
                        name: "Tara Smoke",
                        status: "locked",
                        role: "second shop companion",
                        full_character: {
                            ...blankCharacterTemplate("Tara Smoke"),
                            name: "Tara Smoke",
                            age: 25,
                            gender: "female",
                            role: "second shop companion",
                        },
                    },
                    "jessa-bright": {
                        id: "jessa-bright",
                        name: "",
                        status: "locked",
                        role: "id fallback companion",
                        full_character: {
                            ...blankCharacterTemplate("Jessa Bright"),
                            name: "",
                            age: 27,
                            gender: "female",
                            role: "id fallback companion",
                        },
                    },
                    "intro-story-smoke": {
                        id: "intro-story-smoke",
                        name: "Intro Story Smoke",
                        status: "locked",
                        role: "introduced story companion",
                        on_purchase_objective: "intro-story-objective",
                        full_character: {
                            ...blankCharacterTemplate("Intro Story Smoke"),
                            name: "Intro Story Smoke",
                            age: 28,
                            gender: "female",
                            role: "introduced story companion",
                        },
                    },
                },
            };
            for (const [characterId, entry] of Object.entries(app.state.future_cast.items)) {
                if (!entry?.full_character) continue;
                entry.full_character.id = characterId;
                entry.full_character.default_seed = 0;
                entry.full_character.stats = {
                    ...(entry.full_character.stats || {}),
                    smoke_contract_cost: 3,
                    smoke_contract_return: 7,
                };
            }
            app.state.future_cast.items["smoke-second"].full_character.stats.smoke_contract_cost = 99;
            runtimeSaveUnwrap(app.state).character_shop_cost_templates =
                repairAiCharacterShopCostTemplates({
                "smoke-stat-contract": {
                    type: "stat",
                    costs: [
                        {
                            label: "Available smoke contracts",
                            available_expression: {
                                initial: { path: ["story_inventory", "smoke_contract_total"] },
                                operations: [
                                    {
                                        operation: "subtract",
                                        operand: { path: ["story_inventory", "smoke_contract_used"] },
                                    },
                                ],
                            },
                            op: ">=",
                            required_stat: "smoke_contract_cost",
                        },
                    ],
                    effects: [
                        {
                            label: "Smoke contracts used",
                            operation: "add",
                            field_path: ["story_inventory", "smoke_contract_used"],
                            value_stat: "smoke_contract_cost",
                        },
                        {
                            label: "Smoke contract total",
                            operation: "add",
                            field_path: ["story_inventory", "smoke_contract_total"],
                            value_stat: "smoke_contract_return",
                        },
                    ],
                },
            });
            app.state.story_shops = repairAiStoryShops({
                smoke_character_shop: {
                    id: "smoke_character_shop",
                    title: "Smoke Character Shop",
                    type: "character",
                    subtype: "Companion Shop",
                    description: "Browse reliable companions for the road ahead.",
                    purchase_verb: "Recruit",
                    purchase_completed_verb: "recruited",
                    post_purchase_presence: "current_scene",
                    unlocked: true,
                    currency: "coins",
                    cost_template_id: "smoke-stat-contract",
                    npc_location_id: "smoke-character-shop",
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Contract Row",
                        specific_place: "Smoke Character Shop",
                    },
                    owner_npc_id: "smoke-owner",
                    items: [
                        {
                            character_id: "smoke-companion",
                            price: 120,
                            on_purchase_objective: "rina-purchase-story",
                            requirements: [
                                { path: "story_inventory.coins", op: ">=", value: 120 },
                            ],
                        },
                        {
                            character_id: "smoke-second",
                            price: 90,
                        },
                        {
                            character_id: "smoke-locked",
                            price: 777,
                            locked: true,
                            unlock_reason: "Requires guild invitation.",
                            requirements: [
                                { path: "story_inventory.coins", op: ">=", value: 999 },
                            ],
                        },
                        {
                            character_id: "smoke-expensive",
                            price: 900,
                        },
                        {
                            character_id: "jessa-bright",
                            price: 80,
                        },
                    ],
                },
                smoke_service_shop: {
                    id: "smoke_service_shop",
                    title: "Smoke Service House",
                    type: "character",
                    subtype: "Service House",
                    description:
                        "Book time with a character without acquiring them.",
                    purchase_verb: "Book",
                    purchase_completed_verb: "Booked time with",
                    purchase_mode: "service",
                    repeatable: true,
                    unlocked: true,
                    currency: "coins",
                    npc_location_id: "smoke-service-house",
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Service Row",
                        specific_place: "Smoke Service House",
                    },
                    owner_npc_id: "smoke-owner",
                    items: [
                        {
                            character_id: "smoke-service",
                            price: 20,
                            on_purchase_objective: "smoke-service-story",
                            purchase_opening: {
                                dialogue: "\"Thank you for booking me. Please, follow me.\"",
                                guidance: "Selena acknowledges the 20-coin payment, remains professional, and leads the player into the private service scene.",
                            },
                        },
                    ],
                },
                smoke_job_board: {
                    id: "smoke_job_board",
                    title: "Smoke Job Board",
                    type: "job",
                    npc_location_id: "smoke-job-board",
                    subtype: "Job Board",
                    unlocked: true,
                    owner_npc_id: "smoke-owner",
                    visible_count: 5,
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Guild Row",
                        specific_place: "Smoke Job Board",
                    },
                    items: [
                        {
                            id: "smoke-story-job",
                            title: "Smoke Story Job",
                            summary: "Handle a curated story job.",
                            genres: ["fantasy", "adventure"],
                            reward_coins: 33,
                            reward_xp: 2,
                            reward_items: [
                                {
                                    id: "smoke-hosted-job-reward",
                                    name: "Hosted Job Reward",
                                    type: "quest",
                                    quantity: 1,
                                    value: 0,
                                    sellable: false,
                                    quest_item: true,
                                    description: "A hosted reward from the curated smoke job.",
                                    image_prompt: "A hosted smoke job reward.",
                                    image_id: "",
                                    image: {
                                        url: devSmokePublicImageUrl(
                                            "job-reward-item",
                                            "hosted-job-reward",
                                        ),
                                    },
                                },
                            ],
                            client_npc_id: "smoke-client",
                            requirements: [
                                { path: "story_inventory.coins", op: ">=", value: 10 },
                            ],
                        },
                        {
                            id: "wrong-genre-story-job",
                            title: "Wrong Genre Story Job",
                            summary: "Should not be listed in this story.",
                            genres: ["comedy"],
                            reward_coins: 99,
                        },
                    ],
                },
                smoke_general_shop: {
                    id: "smoke_general_shop",
                    title: "Smoke General Goods",
                    type: "general",
                    npc_location_id: "smoke-general-goods",
                    subtype: "General Store",
                    unlocked: true,
                    currency: "coins",
                    markup: 1.5,
                    buying: { enabled: true, quest_items_rejected: true },
                    owner_npc_id: "smoke-owner",
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Merchant Row",
                        specific_place: "Smoke General Goods",
                    },
                    items: [
                        {
                            id: "smoke-tonic-listing",
                            title: "Smoke Tonic",
                            price: 999,
                            quantity: 2,
                            rewards: [
                                {
                                    type: "add_state_list_item",
                                    field_path: ["player", "known_facts"],
                                    value: "The player bought a smoke tonic.",
                                },
                                {
                                    type: "add_state_list_item",
                                    target: "Smoke Ally",
                                    field_path: ["known_facts"],
                                    value: "Smoke Ally witnessed the tonic purchase.",
                                },
                                "smoke-shop-purchase-bundle",
                            ],
                            item: {
                                id: "smoke-tonic",
                                name: "Smoke Tonic",
                                type: "consumable",
                                quantity: 1,
                                value: 20,
                                sellable: true,
                                quest_item: false,
                                description: "A marked-up smoke tonic.",
                                image_prompt: "small glass tonic bottle with curling silver smoke inside",
                            },
                        },
                        {
                            id: "smoke-premium-listing",
                            title: "Smoke Premium Kit",
                            quantity: 1,
                            item: {
                                id: "smoke-premium-kit",
                                name: "Smoke Premium Kit",
                                type: "equipment",
                                quantity: 1,
                                value: 10000,
                                sellable: true,
                                quest_item: false,
                                image_prompt: "compact premium adventurer kit with polished tools and a latch",
                            },
                        },
                        {
                            id: "smoke-hosted-item-listing",
                            title: "Hosted Smoke Flask",
                            quantity: 1,
                            item: {
                                id: "smoke-hosted-flask",
                                name: "Hosted Smoke Flask",
                                type: "consumable",
                                quantity: 1,
                                value: 15,
                                sellable: true,
                                quest_item: false,
                                image: {
                                    url: devSmokePublicImageUrl(
                                        "general-shop-item",
                                        "hosted-smoke-flask",
                                    ),
                                },
                            },
                        },
                    ],
                },
                smoke_unlisted_owner_general_shop: {
                    id: "smoke_unlisted_owner_general_shop",
                    title: "Smoke Unlisted Owner Goods",
                    type: "general",
                    npc_location_id: "smoke-unlisted-owner-goods",
                    subtype: "General Store",
                    description: "A small shop whose owner is defined only by the shop record.",
                    unlocked: true,
                    currency: "coins",
                    markup: 1.2,
                    buying: { enabled: false },
                    owner_npc_id: "unlisted-shop-owner",
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Hidden Row",
                        specific_place: "Smoke Unlisted Owner Goods",
                    },
                    items: [],
                },
                smoke_no_buy_shop: {
                    id: "smoke_no_buy_shop",
                    title: "Smoke Sales Only",
                    type: "general",
                    unlocked: true,
                    currency: "coins",
                    markup: 1.1,
                    buying: { enabled: false },
                    items: [],
                },
                smoke_clothing_shop: {
                    id: "smoke_clothing_shop",
                    title: "Smoke Outfitters",
                    type: "clothing",
                    npc_location_id: "smoke-outfitters",
                    subtype: "Outfit Shop",
                    unlocked: true,
                    currency: "coins",
                    owner_npc_id: "smoke-owner",
                    location: {
                        settlement_name: "Smoke Market",
                        district: "Tailor Row",
                        specific_place: "Smoke Outfitters",
                    },
                    items: [
                        {
                            id: "smoke-roadwear-listing",
                            title: "Smoke Roadwear",
                            price: 70,
                            outfit: {
                                id: "smoke-roadwear",
                                name: "Smoke Roadwear",
                                image_prompt: "folded smoke-gray road outfit with sturdy black travel boots",
                                contexts: ["travel", "town"],
                                formality: 2,
                                clothing: {
                                    shirt: "smoke-gray road shirt",
                                    pants: "smoke-black road trousers",
                                    feet: "smoke-tested boots",
                                },
                            },
                        },
                        {
                            id: "smoke-hosted-cloak-listing",
                            title: "Hosted Smoke Cloak",
                            price: 45,
                            outfit: {
                                id: "smoke-hosted-cloak",
                                name: "Hosted Smoke Cloak",
                                image: {
                                    url: devSmokePublicImageUrl(
                                        "clothing-shop-outfit",
                                        "hosted-smoke-cloak",
                                    ),
                                },
                                clothing: {
                                    coat: "hosted smoke-gray cloak",
                                },
                            },
                        },
                    ],
                },
                story_clock: {
                    elapsed_minutes: 0,
                },
                timed_events: {
                    "reward-deadline": {
                        id: "reward-deadline",
                        title: "Reward Deadline",
                        visibility: "visible",
                        trigger: { objective_id: "reward-objective" },
                        time_limit: { hours: 2 },
                        message: "The reward smoke deadline has arrived.",
                        stages: [
                            {
                                id: "warning",
                                after: { hours: 1 },
                                visibility: "visible",
                                message: "The reward smoke deadline is getting close.",
                            },
                        ],
                        rewards: [
                            {
                                type: "start_objective",
                                objective_id: "deadline-response",
                            },
                            {
                                type: "add_story_rule",
                                rule_id: "reward_deadline_arrived",
                                text: "The reward smoke deadline has arrived.",
                            },
                        ],
                    },
                },
            });
            app.state.objectives = {
                active_id: "main-smoke-story",
                focus_id: "",
                items: [
                    {
                        id: "main-smoke-story",
                        title: "Main Smoke Story",
                        type: "story",
                        status: "active",
                        summary: "Keep the smoke test story stable.",
                        completion_control: "player",
                        completion_criteria: "Keep testing.",
                        rewards: [],
                    },
                    {
                        id: "rina-purchase-story",
                        title: "Rina's Purchase Story",
                        type: "side",
                        status: "future",
                        summary: "Follow up with Rina after recruiting her.",
                        completion_control: "player",
                        completion_criteria: "Spend time with Rina.",
                        rewards: [],
                    },
                    {
                        id: "smoke-service-story",
                        title: "Spend Time With Selena",
                        type: "side",
                        status: "future",
                        summary:
                            "Continue the booked scene with Selena without adding her to the party.",
                        completion_control: "player",
                        completion_criteria: "Finish the booked scene.",
                        rewards: [],
                    },
                    {
                        id: "urgent-city-battle",
                        title: "Defend the City Gate",
                        type: "story",
                        status: "future",
                        available_now: false,
                        locked_until_complete: true,
                        summary: "The city is under attack and must be defended now.",
                        completion_control: "ai",
                        completion_criteria: "The battle is resolved.",
                        rewards: [],
                    },
                    {
                        id: "intro-story-objective",
                        title: "Intro Story Smoke Followup",
                        type: "side",
                        status: "future",
                        summary: "Follow up with the introduced companion.",
                        completion_control: "player",
                        completion_criteria: "Talk with Intro Story Smoke.",
                        rewards: [],
                    },
                ],
            };
            await devCompileCurrentStoryFixture("story-economy-shops-jobs-smoke");
            const normalizedCharacterShop = app.state.story_shops.smoke_character_shop;
            const normalizedGeneralShop = app.state.story_shops.smoke_general_shop;
            const statBlockedListing = storyCharacterShopListingState(
                normalizedCharacterShop,
                normalizedCharacterShop.items.find((item) => item.character_id === "smoke-second"),
            );
            const validShopRewardErrors = objectiveRewardValidationErrors(
                storyShopPurchaseRewardValidationObjectives({
                    smoke_general_shop: normalizedGeneralShop,
                }),
                app.state.reward_bundles,
                { state: app.state },
            );
            const malformedShopRewardErrors = [
                ...storyShopValidationErrors({
                    malformed_general_shop: {
                        type: "general",
                        items: [{ id: "bad-shape", rewards: { type: "add_item" } }],
                    },
                }),
                ...objectiveRewardValidationErrors(
                    storyShopPurchaseRewardValidationObjectives({
                        malformed_general_shop: {
                            type: "general",
                            items: [
                                {
                                    id: "bad-type",
                                    rewards: [{ type: "unsupported_shop_reward" }],
                                },
                            ],
                        },
                    }),
                    app.state.reward_bundles,
                    { state: app.state },
                ),
            ];
            devAssert(
                normalizedGeneralShop.items[0].rewards.length === 3,
                "general-shop fixture preserves all authored rewards",
                normalizedGeneralShop.items[0].rewards,
            );
            devAssert(
                validShopRewardErrors.length === 0,
                `general-shop rewards pass objective reward validation: ${validationErrorsText(validationResult(validShopRewardErrors))}`,
                validationErrorsText(validationResult(validShopRewardErrors)),
            );
            devAssert(
                malformedShopRewardErrors.some(
                        (error) =>
                            error.path ===
                            "story_shops.malformed_general_shop.items.0.rewards",
                    ) &&
                    malformedShopRewardErrors.some(
                        (error) =>
                            error.path ===
                                "story_shops.malformed_general_shop.items.0.rewards.0.type" &&
                            error.code === "enum",
                    ),
                "malformed general-shop rewards report exact shop paths",
                {
                    validShopRewardErrors: validationErrorsText(
                        validationResult(validShopRewardErrors),
                    ),
                    malformedShopRewardErrors: validationErrorsText(
                        validationResult(malformedShopRewardErrors),
                    ),
                },
            );
            devAssert(
                storyCharacterShopPurchaseVerb(normalizedCharacterShop) === "Recruit" &&
                    storyCharacterShopPurchaseCompletedVerb(normalizedCharacterShop) === "recruited" &&
                    normalizedCharacterShop.cost_template_id === "smoke-stat-contract",
                "character shop preserves author-provided purchase words and generic stat cost template reference",
                normalizedCharacterShop,
            );
            devAssert(
                statBlockedListing.statCostPlan.valid === true &&
                    statBlockedListing.statCostPlan.costsMet === false,
                "character shop blocks a listing whose selected character stat exceeds the authored available expression",
                statBlockedListing.statCostPlan,
            );
            devAssert(
                storyShopValidationErrors({
                    missing_words: {
                        type: "character",
                        title: "Missing Words",
                        npc_location_id: "smoke-shop",
                    },
                }).some((error) => error.path === "story_shops.missing_words.purchase_verb") &&
                    storyShopValidationErrors({
                        missing_words: {
                            type: "character",
                            title: "Missing Words",
                            npc_location_id: "smoke-shop",
                        },
                    }).some(
                        (error) =>
                            error.path === "story_shops.missing_words.purchase_completed_verb",
                    ),
                "character shop validation requires both purchase words",
                storyShopValidationErrors({
                    missing_words: {
                        type: "character",
                        title: "Missing Words",
                        npc_location_id: "smoke-shop",
                    },
                }),
            );
            const missingPurchaseOpeningErrors = storyShopValidationErrors({
                missing_purchase_opening: {
                    id: "missing_purchase_opening",
                    type: "character",
                    title: "Missing Purchase Opening",
                    purchase_mode: "service",
                    purchase_verb: "Book",
                    purchase_completed_verb: "booked",
                    unlocked: true,
                    currency: "coins",
                    npc_location_id: "smoke-shop",
                    items: [{ id: "missing-opening-item", character_id: "smoke-service", price: 1 }],
                },
            });
            const invalidPurchaseOpeningErrors = storyShopValidationErrors({
                invalid_purchase_opening: {
                    id: "invalid_purchase_opening",
                    type: "character",
                    title: "Invalid Purchase Opening",
                    purchase_mode: "service",
                    purchase_verb: "Book",
                    purchase_completed_verb: "booked",
                    unlocked: true,
                    currency: "coins",
                    npc_location_id: "smoke-shop",
                    items: [{
                        id: "invalid-opening-item",
                        character_id: "smoke-service",
                        price: 1,
                        purchase_opening: { dialogue: "Hello", extra: true },
                    }],
                },
            });
            devAssert(
                missingPurchaseOpeningErrors.some((error) => /purchase_opening\.dialogue/.test(error.path)) &&
                    invalidPurchaseOpeningErrors.some((error) => error.path.endsWith("purchase_opening.extra")),
                "service character shops require exact authored purchase opening dialogue and reject unknown opening fields",
                { missingPurchaseOpeningErrors, invalidPurchaseOpeningErrors },
            );
            const invalidCharacterShopModeErrors =
                storyShopValidationErrors({
                    invalid_repeatable_acquisition: {
                        id: "invalid_repeatable_acquisition",
                        type: "character",
                        title: "Invalid Repeatable Acquisition",
                        npc_location_id: "smoke-shop",
                        purchase_verb: "Acquire",
                        purchase_completed_verb: "acquired",
                        purchase_mode: "acquire",
                        repeatable: true,
                        items: [
                            {
                                character_id: "smoke-companion",
                                price: 1,
                            },
                        ],
                    },
                });
            const invalidRemovalRewardErrors =
                objectiveRewardValidationErrors(
                    [
                        {
                            id: "invalid-remove-service",
                            rewards: [
                                {
                                    type: "remove_character_shop_listing",
                                    shop_id: "smoke_service_shop",
                                    character_id: "missing-listing",
                                },
                            ],
                        },
                    ],
                    app.state.reward_bundles,
                    { state: app.state },
                );
            devAssert(
                invalidCharacterShopModeErrors.some(
                    (error) =>
                        error.path ===
                            "story_shops.invalid_repeatable_acquisition.items.0.repeatable" &&
                        error.code === "unsupported",
                ) &&
                    invalidRemovalRewardErrors.some(
                        (error) =>
                            error.path.endsWith(".character_id") &&
                            error.code === "reference",
                    ),
                "character-shop validation rejects repeatable acquisitions and removal rewards that do not resolve to an authored listing",
                {
                    invalidCharacterShopModeErrors,
                    invalidRemovalRewardErrors,
                },
            );
            const invalidStatCostErrors = storyShopValidationErrors(
                {
                    invalid_stat_shop: {
                        type: "character",
                        purchase_verb: "Recruit",
                        purchase_completed_verb: "recruited",
                        cost_template_id: "missing-template",
                        items: [{ character_id: "smoke-companion", price: 1 }],
                    },
                },
                app.state.character_shop_cost_templates,
                { state: app.state },
            );
            const incompleteStatErrors = storyShopValidationErrors(
                {
                    invalid_stat_shop: {
                        type: "character",
                        purchase_verb: "Recruit",
                        purchase_completed_verb: "recruited",
                        cost_template_id: "smoke-stat-contract",
                        items: [{ character_id: "smoke-client", price: 1 }],
                    },
                },
                {
                    "smoke-stat-contract": {
                        ...app.state.character_shop_cost_templates["smoke-stat-contract"],
                        costs: [{
                            ...app.state.character_shop_cost_templates["smoke-stat-contract"].costs[0],
                            required_stat: "missing_smoke_stat",
                        }],
                    },
                },
                { state: app.state },
            );
            devAssert(
                invalidStatCostErrors.some((error) => error.path === "story_shops.invalid_stat_shop.cost_template_id") &&
                    incompleteStatErrors.some((error) => error.code === "stat_reference"),
                "character-shop stat cost validation rejects missing templates and missing character stats",
                { invalidStatCostErrors, incompleteStatErrors },
            );

            app.state.scene.npcs_present = ["Removed Smoke"];
            openStoryShopsModal();
            const shopDirectoryCard = $("modalBox")?.querySelector?.(
                '[data-story-shop-card="smoke_character_shop"]',
            );
            const shopModalCloseButton = $("modalBox")?.querySelector?.(
                ".character-shop-header-actions .icon-button",
            );
            const shopsModalStructureValid =
                /Smoke Character Shop/.test($("modalBox")?.textContent || "") &&
                shopDirectoryCard?.tagName === "BUTTON" &&
                /enterStoryShop/.test(shopDirectoryCard?.getAttribute("onclick") || "") &&
                !shopDirectoryCard?.querySelector?.(".story-shop-card-actions") &&
                shopModalCloseButton?.getAttribute("title") === "Close shops" &&
                shopModalCloseButton?.textContent?.trim() === "\u00d7";
            devAssert(
                shopsModalStructureValid,
                "shops modal uses clickable shop panels without Enter buttons and has a normal X close control",
                $("modalBox")?.innerHTML || "",
            );
            const shopSearchInput = $("modalBox")?.querySelector?.(
                'input[aria-label="Search shops by title"]',
            );
            shopSearchInput.value = "Smoke Character Shop";
            shopSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
            const titleSearchCards = [...$("modalBox").querySelectorAll("[data-story-shop-card]")];
            const titleSearchShown = titleSearchCards.filter(
                (card) => getComputedStyle(card).display !== "none",
            ).length;
            shopSearchInput.value = "guild invitation";
            shopSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
            const nonTitleSearchShown = titleSearchCards.filter(
                (card) => getComputedStyle(card).display !== "none",
            ).length;
            const titleOnlySearchValid =
                shopSearchInput?.placeholder === "Search shop titles..." &&
                titleSearchShown === 1 &&
                nonTitleSearchShown === 0 &&
                !$("modalBox")?.querySelector?.("[data-story-shop-search-empty]")?.hidden;
            shopSearchInput.value = "";
            shopSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
            devAssert(
                titleOnlySearchValid,
                "shops directory search input visibly filters only by shop title and exposes an empty result state",
                {
                    titleSearchShown,
                    nonTitleSearchShown,
                    searchInput: shopSearchInput?.outerHTML || "",
                },
            );
            enterStoryShop("smoke_character_shop");
            const characterShopText = $("modalBox")?.textContent || "";
            const characterShopListingTexts = Array.from(
                $("modalBox")?.querySelectorAll?.("[data-character-shop-listing]") || [],
            ).map((card) => card.textContent || "");
            const longSpeciesCard = Array.from(
                $("modalBox")?.querySelectorAll?.("[data-character-shop-listing]") || [],
            ).find((card) => card.textContent?.includes("Rina Smoke"));
            const longSpeciesImage = longSpeciesCard?.querySelector(".character-shop-listing-image");
            devAssert(
                !!longSpeciesCard &&
                    !!longSpeciesImage &&
                    longSpeciesCard.scrollWidth <= longSpeciesCard.clientWidth + 1 &&
                    longSpeciesImage.getBoundingClientRect().right <=
                        longSpeciesCard.getBoundingClientRect().right,
                "a long character species label does not widen its shop card or image",
                {
                    cardWidth: longSpeciesCard?.clientWidth,
                    cardScrollWidth: longSpeciesCard?.scrollWidth,
                    imageRight: longSpeciesImage?.getBoundingClientRect().right,
                    cardRight: longSpeciesCard?.getBoundingClientRect().right,
                },
            );
            devAssert(
                /Locked Smoke/.test(characterShopText) &&
                    /Requires guild invitation/.test(characterShopText) &&
                    !/777/.test(characterShopText) &&
                    !/secret role should be hidden/.test(characterShopText) &&
                    !/secret shop details should be hidden/.test(characterShopText),
                "locked character-shop cards show only the name and unlock reason, hiding details and price",
                characterShopText,
            );
            devAssert(
                /Expensive Smoke/.test(characterShopText) &&
                    /\biron coast dwarf\b/.test(characterShopText) &&
                    characterShopListingTexts.some(
                        (text) => /Expensive Smoke/.test(text) &&
                            /\biron coast dwarf\b/.test(text) &&
                            !/elite companion/.test(text),
                    ) &&
                    /900/.test(characterShopText) &&
                    /Insufficient funds/.test(characterShopText) &&
                    /Browse reliable companions/.test(characterShopText) &&
                    /Available smoke contracts/.test(characterShopText),
                "character-shop listings expose complete species and generic stat-derived requirements while blocking an insufficient stat cost",
                characterShopText,
            );
            devAssert(
                (() => {
                    const text = characterShopListingTexts.find((entry) =>
                        /Rina Smoke/.test(entry),
                    ) || "";
                    return /\bmarket-born fae\b/.test(text) &&
                        !/shop companion/.test(text);
                })(),
                "character-shop cards show the complete species and authored role",
                characterShopListingTexts,
            );
            devAssert(
                /Jessa Bright/.test(characterShopText) && !/jessa-bright/.test(characterShopText),
                "character-shop labels humanize identifier fallbacks instead of exposing raw ids",
                characterShopText,
            );
            devAssert(
                $("modalBox")?.matches?.("[data-fullscreen-list-modal='1']") &&
                    !!$("modalBox")?.querySelector?.(".character-shop-shell") &&
                    !$("modalBox")?.querySelector?.(".character-shop-listing .character-card") &&
                    !getNpcEntryFromState(app.state, "Rina Smoke") &&
                    !getNpcEntryFromState(app.state, "Expensive Smoke"),
                "character shop uses the dedicated fullscreen UI and listing renders do not create NPC state",
                { modal: $("modalBox")?.innerHTML, directory: app.state.npc_directory },
            );
            await devWaitFor(
                () => {
                    const image = activeProfileImage(
                        getNpcEntryFromState(app.state, "Mara Smoke")?.full_character,
                    );
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html)
                    );
                },
                5000,
                "entering a shop to finish its owner's profile image",
            );
            const smokeShopOwner = getNpcEntryFromState(app.state, "Mara Smoke");
            const smokeShopOwnerProfile = activeProfileImage(
                smokeShopOwner?.full_character || smokeShopOwner,
            );
            devAssert(
                !!smokeShopOwnerProfile &&
                    !!$("modalBox")?.querySelector?.(
                        '[data-character-action="profile"][data-character-name="Mara Smoke"]',
                    ) &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-character-action="profile"][data-character-name="Mara Smoke"]',
                        )?.innerHTML,
                    ),
                "entering a shop queues its active owner's profile image and renders a live owner thumbnail",
                { owner: smokeShopOwner, profile: smokeShopOwnerProfile },
            );
            await devWaitFor(
                () => {
                    const rina = activeProfileImage(
                        resolveFutureCastEntryById("smoke-companion")?.full_character,
                    );
                    const tara = activeProfileImage(
                        resolveFutureCastEntryById("smoke-second")?.full_character,
                    );
                    return (
                        rina?.pending === false &&
                        tara?.pending === false &&
                        devLooksLikeRealImageHtml(rina?.html) &&
                        devLooksLikeRealImageHtml(tara?.html)
                    );
                },
                8000,
                "opening a character shop to finish two visible sale-character profile images",
            );
            const rinaShopProfile = activeProfileImage(
                resolveFutureCastEntryById("smoke-companion")?.full_character,
            );
            const taraShopProfile = activeProfileImage(
                resolveFutureCastEntryById("smoke-second")?.full_character,
            );
            devAssert(
                devLooksLikeRealImageHtml(rinaShopProfile?.html) &&
                    devLooksLikeRealImageHtml(taraShopProfile?.html) &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            `[data-profile-live-id="${cssEscape(String(rinaShopProfile.id))}"]`,
                        )?.innerHTML,
                    ) &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            `[data-profile-live-id="${cssEscape(String(taraShopProfile.id))}"]`,
                        )?.innerHTML,
                    ),
                "opening a character shop generates and displays at least two visible for-sale character images plus the owner image",
                { owner: smokeShopOwnerProfile, rina: rinaShopProfile, tara: taraShopProfile },
            );
            const normalImagesBeforeShopSelection = app.images.length;
            selectStoryShopCharacter("smoke_character_shop", "smoke-expensive");
            const selectedShopEntry = resolveFutureCastEntryById("smoke-expensive");
            await devWaitFor(
                () => {
                    const image = activeProfileImage(selectedShopEntry?.full_character);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html)
                    );
                },
                5000,
                "selecting a character-shop listing to finish its profile image",
            );
            const selectedShopProfile = activeProfileImage(selectedShopEntry?.full_character);
            devAssert(
                app.images.length === normalImagesBeforeShopSelection &&
                    !!selectedShopProfile &&
                    !app.profileEntityOverrides?.["Expensive Smoke"] &&
                    !getNpcEntryFromState(app.state, "Expensive Smoke") &&
                    !app.state.characters?.["Expensive Smoke"],
                "selecting an unmaterialized shop character finishes its temporary profile image, releases the UI override, and does not request a normal scene image or add runtime character state",
                {
                    normalImagesBeforeShopSelection,
                    normalImagesAfterShopSelection: app.images.length,
                    selectedShopProfile,
                    profileOverride: app.profileEntityOverrides?.["Expensive Smoke"],
                    npc: getNpcEntryFromState(app.state, "Expensive Smoke"),
                    character: app.state.characters?.["Expensive Smoke"],
                },
            );
            closeModal();
            const closedShopRetainedMarkup = !!$("modalBox")?.querySelector?.(
                '[data-story-shop="smoke_character_shop"]',
            );
            refreshProfileImageSurfaces("Expensive Smoke");
            devAssert(
                closedShopRetainedMarkup && !mainModalOpen(),
                "a completed shop-character profile image does not reopen a closed shop from retained modal markup",
                {
                    closedShopRetainedMarkup,
                    modalOpen: mainModalOpen(),
                },
            );
            openStoryShopModal("smoke_character_shop");
            const shopChatStateSnapshot = clone(app.state);
            chatWithStoryShopCharacter("smoke_character_shop", "smoke-companion");
            const staleShopChatPatch = applyStatePatch(
                shopChatStateSnapshot,
                { scene: { npcs_present: ["Mara Smoke"] } },
                {
                    source: "shop chat stale scene smoke",
                    currentState: app.state,
                    targeted: true,
                },
            );
            devAssert(
                (app.state.scene.npcs_present || []).includes("Mara Smoke") &&
                    (app.state.scene.npcs_present || []).includes("Rina Smoke") &&
                    !app.state.characters["Rina Smoke"] &&
                    JSON.stringify(staleShopChatPatch.scene.npcs_present) ===
                        JSON.stringify(app.state.scene.npcs_present) &&
                    $("modalBox")?.matches?.(
                        "[data-fullscreen-list-modal='1'][data-story-shop-chat-modal='1']",
                    ) &&
                    !!$("modalBox")?.querySelector?.("[data-story-shop-chat-thread].thread") &&
                    !!$("modalBox")?.querySelector?.(
                        "[data-story-shop-chat-input]",
                    ) &&
                    /Rina Smoke/.test($("modalBox")?.textContent || ""),
                "chatting with a shop character opens a fullscreen filtered canonical chat, establishes exact scene membership, and rejects stale scene-presence patches",
                {
                    scene: app.state.scene,
                    party: app.state.characters,
                    staleScene: staleShopChatPatch.scene,
                    modal: $("modalBox")?.textContent || "",
                },
            );
            closeStoryShopChat();
            const purchaseMutationRevision = runtimeSaveMutationTracker.revision;
            const purchasePromise = buyStoryShopCharacter("smoke_character_shop", "smoke-companion");
            devAssert(
                !!document.querySelector(".popup-modal #confirmYesBtn") &&
                    /remaining balance/i.test(document.querySelector(".popup-modal")?.textContent || "") &&
                    /Smoke contracts used/.test(document.querySelector(".popup-modal")?.textContent || ""),
                "character purchase confirmation shows currency and generic stat-derived transaction effects",
                document.querySelector(".popup-modal")?.textContent || "",
            );
            document.querySelector(".popup-modal #confirmYesBtn")?.click();
            await purchasePromise;
            const purchaseRootStateOperations = Object.values(
                runtimeSaveMutationTracker.operations,
            ).flat().filter(
                (operation) =>
                    Number(operation.revision || 0) > purchaseMutationRevision &&
                    (!operation.path || operation.path.length === 0),
            );
            devAssert(
                app.state.story_inventory.coins === 380 &&
                    app.state.story_inventory.smoke_contract_used === 7 &&
                    app.state.story_inventory.smoke_contract_total === 17 &&
                    app.state.characters["Rina Smoke"] &&
                    app.state.story_shops.smoke_character_shop.items[0].purchased === true &&
                    (app.state.scene.party_members_present || []).includes("Rina Smoke") &&
                    app.state.objectives.focus_id === "rina-purchase-story" &&
                    app.state.objectives.items.find((item) => item.id === "rina-purchase-story")?.status === "active" &&
                    purchaseRootStateOperations.length === 0 &&
                    /Acquired/.test($("modalBox")?.textContent || "") &&
                    /Rina Smoke/.test($("modalBox")?.textContent || ""),
                "buying a character atomically applies currency and generic stat effects, promotes future cast, and selects the purchase story",
                {
                    coins: app.state.story_inventory.coins,
                    party: app.state.characters,
                    shop: app.state.story_shops.smoke_character_shop,
                    objectives: app.state.objectives,
                    purchaseRootStateOperations,
                },
            );
            const originalAiTextForServicePurchase = aiText;
            try {
                aiText = async (instruction, options = {}) => {
                    const label = String(options.label || "");
                    if (/scene removal check/i.test(label)) return "#";
                    if (/character reply/i.test(label))
                        return `(Selena Smoke) "Thank you for booking me. Please, follow me."`;
                    return "{}";
                };
                for (let purchaseIndex = 0; purchaseIndex < 2; purchaseIndex++) {
                    openStoryShopModal("smoke_service_shop");
                    const servicePurchase = buyStoryShopCharacter(
                        "smoke_service_shop",
                        "smoke-service",
                    );
                    document
                        .querySelector(".popup-modal #confirmYesBtn")
                        ?.click();
                    await servicePurchase;
                }
            } finally {
                aiText = originalAiTextForServicePurchase;
            }
            const serviceShop =
                app.state.story_shops.smoke_service_shop;
            const serviceListing = serviceShop.items.find(
                (item) => item.character_id === "smoke-service",
            );
            const serviceObjective = app.state.objectives.items.find(
                (item) => item.id === "smoke-service-story",
            );
            const serviceReplyMessages = (app.messages || []).filter(
                (message) => message.replySource === "shop_purchase_opening",
            );
            const standaloneShopPurchaseMessages = (app.messages || []).filter(
                (message) => message.detail === "shop_purchase",
            );
            devAssert(
                app.state.story_inventory.coins === 340 &&
                    serviceListing.purchase_count === 2 &&
                    serviceListing.purchased !== true &&
                    serviceListing.removed !== true &&
                    storyCharacterShopListingIsAvailable(
                        serviceShop,
                        serviceListing,
                    ) &&
                    !app.state.characters["Selena Smoke"] &&
                    !(app.state.scene.party_members_present || []).includes(
                        "Selena Smoke",
                    ) &&
                    (app.state.scene.npcs_present || []).includes(
                        "Selena Smoke",
                    ) &&
                    JSON.stringify(app.state.scene.npcs_present) ===
                        JSON.stringify(["Selena Smoke"]) &&
                    (app.state.scene.party_members_present || []).includes("Smoke Ally") &&
                    (app.state.scene.party_members_present || []).includes("Rina Smoke") &&
                    app.state.future_cast.items["smoke-service"].status !==
                        "joined" &&
                    serviceObjective?.status === "active" &&
                    standaloneShopPurchaseMessages.length === 0 &&
                    serviceReplyMessages.length === 2 &&
                    serviceReplyMessages.every((message) =>
                        /Thank you for booking me\. Please, follow me\./.test(
                            message.text || "",
                        ),
                    ),
                "repeatable character-shop services charge each time, start the configured mini-story, replace all prior NPCs while preserving party members, and fold the authored opening into one AI reply",
                {
                    coins: app.state.story_inventory.coins,
                    listing: serviceListing,
                    character: app.state.characters["Selena Smoke"],
                    scene: app.state.scene,
                    future:
                        app.state.future_cast.items["smoke-service"],
                    objective: serviceObjective,
                    serviceReplyMessages,
                    standaloneShopPurchaseMessages,
                    shopPurchaseMessages: (app.messages || [])
                        .filter((message) =>
                            message.detail === "shop_purchase" ||
                            message.replySource === "shop_purchase_opening",
                        )
                        .map((message) => ({
                            speaker: message.speaker,
                            text: message.text,
                            detail: message.detail,
                            replySource: message.replySource,
                            voiceSpeakers: message.voiceSpeakers,
                        })),
                },
            );
            const removalReward = {
                type: "remove_character_shop_listing",
                shop_id: "smoke_service_shop",
                character_id: "smoke-service",
            };
            const removalValidationErrors =
                objectiveRewardValidationErrors(
                    [
                        {
                            id: "remove-smoke-service",
                            rewards: [removalReward],
                        },
                    ],
                    app.state.reward_bundles,
                    { state: app.state },
                );
            devAssert(
                removalValidationErrors.length === 0,
                "character-shop listing removal rewards validate against their authored shop and character listing",
                removalValidationErrors,
            );
            applyObjectiveReward(
                app.state,
                {
                    id: "remove-smoke-service",
                    title: "Remove Smoke Service",
                },
                removalReward,
            );
            applyObjectiveReward(
                app.state,
                {
                    id: "remove-smoke-service",
                    title: "Remove Smoke Service",
                },
                removalReward,
            );
            const removedServiceListing =
                app.state.story_shops.smoke_service_shop.items.find(
                    (item) => item.character_id === "smoke-service",
                );
            devAssert(
                removedServiceListing.removed === true &&
                    !storyCharacterShopListingIsAvailable(
                        app.state.story_shops.smoke_service_shop,
                        removedServiceListing,
                    ) &&
                    storyCharacterShopSortedItems(
                        app.state.story_shops.smoke_service_shop,
                        { view: "available", sort: "default" },
                    ).every(
                        (item) => item.character_id !== "smoke-service",
                    ),
                "remove_character_shop_listing is idempotent and removes a service character from the shop without deleting the NPC",
                {
                    listing: removedServiceListing,
                    npc: getNpcEntryFromState(
                        app.state,
                        "Selena Smoke",
                    ),
                },
            );
            const urgentObjective = app.state.objectives.items.find(
                (item) => item.id === "urgent-city-battle",
            );
            urgentObjective.status = "active";
            urgentObjective.available_now = true;
            app.state.objectives.active_id = "urgent-city-battle";
            app.state.objectives.focus_id = "";
            applyObjectiveReward(
                app.state,
                urgentObjective,
                {
                    type: "introduce_future_character",
                    character_id: "intro-story-smoke",
                },
                "smoke",
            );
            const introStoryObjective = app.state.objectives.items.find(
                (item) => item.id === "intro-story-objective",
            );
            devAssert(
                !!getNpcEntryFromState(app.state, "Intro Story Smoke") &&
                    introStoryObjective?.status === "active" &&
                    app.state.objectives.active_id === "urgent-city-battle" &&
                    app.state.objectives.focus_id !== "intro-story-objective",
                "introducing a character unlocks their story objective without overriding a required urgent objective",
                {
                    introduced: getNpcEntryFromState(app.state, "Intro Story Smoke"),
                    introStoryObjective,
                    objectives: app.state.objectives,
                },
            );

            const promptState = stateForAiPrompt(app.state);
            devAssert(
                !("story_shops" in promptState) &&
                    !("story_inventory" in promptState) &&
                    !("story_job_offers" in promptState) &&
                    !("active_generated_jobs" in promptState),
                "normal AI prompt state hides story shops, hidden inventory, offers, and active generated job raw state",
                promptState,
            );
            generateStoryInventoryItemImage("smoke-loot", { startRequest: false });
            const smokeLoot = app.state.story_inventory.items.find((item) => item.id === "smoke-loot");
            const smokeLootImage = storyInventoryItemImageRecord(smokeLoot);
            devAssert(
                smokeLoot?.image_id &&
                    smokeLootImage?.reason === "story inventory item image" &&
                    smokeLootImage?.hideFromChat === true &&
                    smokeLootImage?.pending === true &&
                    /square fantasy RPG inventory item icon/i.test(smokeLootImage.prompt || "") &&
                    /small smoke test coin/i.test(smokeLootImage.prompt || "") &&
                    !(app.storyTitleCardImages || []).some((image) => String(image.id) === String(smokeLoot.image_id)) &&
                    !(app.profileImages || []).some((image) => String(image.id) === String(smokeLoot.image_id)),
                "story inventory item image generation creates a linked hidden-chat normal stored image record without using story-title or profile stores",
                { smokeLoot, smokeLootImage },
            );
            const hostedInventoryItem = app.state.story_inventory.items.find(
                (item) => item.id === "smoke-hosted-relic",
            );
            devAssert(
                hostedInventoryItem?.image?.url ===
                    devSmokePublicImageUrl(
                        "inventory-item",
                        "hosted-smoke-relic",
                    ) &&
                    !hostedInventoryItem.image_id &&
                    devLooksLikeRealImageHtml(
                        storyInventoryItemImageHtml(hostedInventoryItem),
                    ),
                "story inventory items preserve and display hosted image slots without queuing generation",
                { hostedInventoryItem },
            );

            enterStoryShop("smoke_job_board");
            await devWaitFor(
                () => {
                    const owner = getNpcEntryFromState(app.state, "Mara Smoke");
                    const image = activeProfileImage(owner?.full_character || owner);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-character-action="profile"][data-character-name="Mara Smoke"]',
                            )?.innerHTML,
                        )
                    );
                },
                8000,
                "opening a job board to finish and display its owner profile image",
            );
            const offers = ensureJobOffersForBoard("smoke_job_board");
            const hostedJobReward =
                app.state.story_shops.smoke_job_board.items
                    .find((item) => item.id === "smoke-story-job")
                    ?.reward_items?.find(
                        (item) => item.id === "smoke-hosted-job-reward",
                    );
            devAssert(
                hostedJobReward?.image?.url ===
                    devSmokePublicImageUrl(
                        "job-reward-item",
                        "hosted-job-reward",
                    ) &&
                    devLooksLikeRealImageHtml(
                        storyInventoryItemImageHtml(hostedJobReward),
                    ),
                "curated and generated-job reward items preserve portable hosted image slots",
                { hostedJobReward },
            );
            devAssert(
                offers.some((offer) => offer.source === "story" && offer.story_job_id === "smoke-story-job") &&
                    !offers.some((offer) => offer.story_job_id === "wrong-genre-story-job") &&
                    offers.some((offer) => offer.source !== "story"),
                "opening a job board shows matching one-time story jobs, hides nonmatching genre jobs, and includes genre-gated generic jobs",
                offers,
            );
            acceptStoryJob("smoke_job_board", "smoke-story-job");
            let activeStoryJob = Object.values(app.state.active_generated_jobs || {}).find(
                (job) => job.source === "story" && job.story_job_id === "smoke-story-job",
            );
            await devWaitFor(
                () => {
                    const name = activeStoryJob?.filled_values?.client_name || "Clara Smoke";
                    const image = activeProfileImage(
                        getNpcEntryFromState(app.state, name)?.full_character,
                    );
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html)
                    );
                },
                5000,
                "accepting a curated story job to finish its client profile image",
            );
            const storyJobClientProfile = activeProfileImage(
                getNpcEntryFromState(
                    app.state,
                    activeStoryJob?.filled_values?.client_name || "Clara Smoke",
                )?.full_character,
            );
            const storyJobDefinition =
                app.runtimeDefinitions.jobsById?.[activeStoryJob?.definition_id];
            ensureRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
            const storyJobObjectiveIndexIsComplete = (
                storyJobDefinition?.objectives || []
            ).every(
                (objective) =>
                    app.runtimeDefinitions.objectivesById?.[objective.id] ===
                        objective &&
                    objectiveRequiredIds(objective).every((requiredId) =>
                        (
                            app.runtimeDefinitions.objectiveDependentsById?.[
                                requiredId
                            ] || []
                        ).includes(String(objective.id)),
                    ),
            );
            devAssert(
                !!activeStoryJob &&
                    app.state.story_shops.smoke_job_board.items.find((item) => item.id === "smoke-story-job")?.accepted === true &&
                    getNpcEntryFromState(app.state, "Clara Smoke") &&
                    storyJobObjectiveIndexIsComplete &&
                    app.objectiveRuntimeNeedsFullSync === false &&
                    storyJobClientProfile?.pending === false &&
                    !storyJobClientProfile?.error &&
                    devLooksLikeRealImageHtml(storyJobClientProfile?.html),
                "accepting a curated story job creates a one-time active job and real client NPC",
                {
                    activeStoryJob,
                    storyJobObjectiveIndexIsComplete,
                    storyJobClientProfile,
                    item: app.state.story_shops.smoke_job_board.items.find((item) => item.id === "smoke-story-job"),
                },
            );
            const activeStoryJobPromptContext = currentJobPromptContext(app.state);
            devAssert(
                /CURRENT_JOB:/.test(activeStoryJobPromptContext) &&
                    /Smoke Story Job/.test(activeStoryJobPromptContext) &&
                    /Smoke Job Board/.test(activeStoryJobPromptContext) &&
                    !/active_generated_jobs|story_shops|story_inventory/.test(activeStoryJobPromptContext),
                "accepted job objectives expose compact CURRENT_JOB prompt context without dumping hidden economy state",
                activeStoryJobPromptContext,
            );
            const coinsBeforeStoryJob = app.state.story_inventory.coins;
            completeGeneratedJobReward(app.state, { job_id: activeStoryJob.id }, { title: "Smoke Story Turn In" });
            devAssert(
                app.state.story_inventory.coins === coinsBeforeStoryJob + 33 &&
                    app.state.story_shops.smoke_job_board.items.find((item) => item.id === "smoke-story-job")?.completed === true &&
                    !ensureJobOffersForBoard("smoke_job_board", { force: true }).some((offer) => offer.story_job_id === "smoke-story-job") &&
                    app.objectiveRuntimeNeedsFullSync === false &&
                    activeStoryJob.objective_ids.every(
                        (id) =>
                            !Object.prototype.hasOwnProperty.call(
                                app.objectiveRuntime.statusById || {},
                                id,
                            ),
                    ),
                "completing a curated story job pays rewards and removes it permanently from the board",
                { inventory: app.state.story_inventory, board: app.state.story_shops.smoke_job_board },
            );
            const generatedOffers = ensureJobOffersForBoard("smoke_job_board", { force: true }).filter((offer) => offer.source !== "story");
            devAssert(generatedOffers.length > 0, "opening an empty job board generates genre-matching generic offers", generatedOffers);
            const acceptedLocationBefore = clone(app.state.location);
            acceptGeneratedJob("smoke_job_board", generatedOffers[0].offer_id);
            const activeJob = Object.values(app.state.active_generated_jobs || {}).find((job) => job.source !== "story");
            const generatedClientName = activeJob?.filled_values?.client_name;
            const generatedClientEntity = getNpcEntryFromState(
                app.state,
                generatedClientName,
            )?.full_character;
            const generatedClientProfileBeforeWait = activeProfileImage(
                generatedClientEntity,
            );
            await devWaitFor(
                () => {
                    const image = activeProfileImage(
                        getNpcEntryFromState(
                            app.state,
                            activeJob?.filled_values?.client_name,
                        )?.full_character,
                    );
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html)
                    );
                },
                5000,
                `accepting a generated job to finish its client profile image: ${JSON.stringify({
                    generatedClientName,
                    hasEntity: !!generatedClientEntity,
                    profile: generatedClientProfileBeforeWait,
                    queued: [...(app.profileImageQueued || [])],
                    generating: [...(app.profileImageGenerating || [])],
                    queue: (app.profileImageQueue || []).map((item) => item?.name || ""),
                })}`,
            );
            const generatedJobClientProfile = activeProfileImage(
                getNpcEntryFromState(
                    app.state,
                    activeJob?.filled_values?.client_name,
                )?.full_character,
            );
            const generatedJobClient = getNpcEntryFromState(
                app.state,
                activeJob?.filled_values?.client_name,
            )?.full_character;

            completeGeneratedJobReward(app.state, { job_id: activeJob.id }, { title: "Smoke Turn In" });
            devAssert(
                !app.state.active_generated_jobs[activeJob.id] &&
                    app.state.story_inventory.coins > 80 &&
                    app.state.story_inventory.adventurer_xp > 0 &&
                    !Object.keys(app.state.story_job_offers || {}).length &&
                    !(app.state.objectives.items || []).some((objective) =>
                        activeJob.objective_ids.includes(objective.id),
                    ),
                "completing a generated job pays rewards, removes generated objectives, and clears all board offers",
                {
                    inventory: app.state.story_inventory,
                    offers: app.state.story_job_offers,
                    objectives: app.state.objectives,
                },
            );

            devAssert(
                app.state.story_shops.smoke_general_shop?.type === "general" &&
                    app.state.story_shops.smoke_general_shop?.markup === 1.5 &&
                    app.state.story_shops.smoke_clothing_shop?.type === "clothing" &&
                    app.state.story_shops.smoke_clothing_shop?.items?.[0]?.outfit?.name === "Smoke Roadwear",
                "general and clothing shop definitions survive normalization with their dedicated fields",
                app.state.story_shops,
            );

            enterStoryShop("smoke_general_shop");
            const generalShopText = $("modalBox")?.textContent || "";
            devAssert(
                /Smoke Tonic/.test(generalShopText) &&
                    /30 coins/.test(generalShopText) &&
                    /Buy/.test(generalShopText) &&
                    /Sell/.test(generalShopText) &&
                    app.state.location.specific_place === "Smoke General Goods",
                "general shops open their dedicated buy interface and calculate sale price from value times markup",
                { generalShopText, location: app.state.location },
            );
            await devWaitFor(
                () => {
                    const owner = getNpcEntryFromState(app.state, "Mara Smoke");
                    const image = activeProfileImage(owner?.full_character || owner);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-character-action="profile"][data-character-name="Mara Smoke"]',
                            )?.innerHTML,
                        )
                    );
                },
                8000,
                "opening a general shop to finish and display its owner profile image",
            );
            enterStoryShop("smoke_unlisted_owner_general_shop");
            await devWaitFor(
                () => {
                    const owner = getNpcEntryFromState(app.state, "Unlisted Shop Owner");
                    const image = activeProfileImage(owner?.full_character || owner);
                    return (
                        owner?.inspected === true &&
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-character-action="profile"][data-character-name="Unlisted Shop Owner"]',
                            )?.innerHTML,
                        )
                    );
                },
                8000,
                "opening a shop whose owner is not in future_cast to create, finish, and display the owner profile image",
            );
            const unlistedShopOwner = getNpcEntryFromState(app.state, "Unlisted Shop Owner");
            const unlistedShopOwnerProfile = activeProfileImage(
                unlistedShopOwner?.full_character || unlistedShopOwner,
            );
            devAssert(
                unlistedShopOwner?.inspected === true &&
                    unlistedShopOwner?.shop_owner_id === "unlisted-shop-owner" &&
                    !!unlistedShopOwner?.full_character &&
                    devLooksLikeRealImageHtml(unlistedShopOwnerProfile?.html),
                "shops with owner ids outside future_cast materialize an inspected NPC and display its generated profile image",
                { owner: unlistedShopOwner, profile: unlistedShopOwnerProfile },
            );
            enterStoryShop("smoke_general_shop");
            await devWaitFor(
                () => {
                    const smokeTonicListing =
                        app.state.story_shops.smoke_general_shop.items.find(
                            (item) => item.id === "smoke-tonic-listing",
                        );
                    const smokeTonic = smokeTonicListing?.item;
                    const image = storyInventoryItemImageRecord(smokeTonic);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-story-item-image="smoke-tonic"]',
                            )?.innerHTML,
                        )
                    );
                },
                5000,
                "opening a general shop to finish and display its first stock item image",
            );
            const smokeTonicListing =
                app.state.story_shops.smoke_general_shop.items.find(
                    (item) => item.id === "smoke-tonic-listing",
                );
            const smokeTonicStock = smokeTonicListing?.item;
            const smokeTonicImage = storyInventoryItemImageRecord(smokeTonicStock);
            devAssert(
                smokeTonicStock?.image_id &&
                    smokeTonicImage?.reason === "story inventory item image" &&
                    smokeTonicImage?.hideFromChat === true &&
                    /square fantasy RPG inventory item icon/i.test(smokeTonicImage.prompt || "") &&
                    /small glass tonic bottle/i.test(smokeTonicImage.prompt || "") &&
                    !visibleImagesForRender().some(
                        (image) => String(image.id) === String(smokeTonicImage.id),
                    ) &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-story-item-image="smoke-tonic"]',
                        )?.innerHTML,
                    ),
                "general-shop stock images generate from item prompts, display in the shop, and stay out of chat/image feeds",
                {
                    smokeTonicStock,
                    smokeTonicImage,
                    card: $("modalBox")?.querySelector?.(
                        '[data-story-item-image="smoke-tonic"]',
                    )?.innerHTML,
                },
            );
            const coinsBeforeGeneralBuy = app.state.story_inventory.coins;
            buyStoryGeneralShopItem("smoke_general_shop", "smoke-tonic-listing");
            devAssert(
                app.state.story_inventory.coins === coinsBeforeGeneralBuy - 30 &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-tonic")?.quantity === 1 &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-shop-bonus")?.quantity === 1 &&
                    app.state.story_inventory.shop_reward_tokens === 2 &&
                    app.state.player.known_facts.includes("The player bought a smoke tonic.") &&
                    app.state.characters["Smoke Ally"].known_facts.includes("Smoke Ally witnessed the tonic purchase.") &&
                    String(app.state.story_inventory.items.find((item) => item.id === "smoke-tonic")?.image_id || "") === String(smokeTonicImage.id) &&
                    app.state.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.quantity === 1 &&
                    app.state.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.purchase_count === 1 &&
                    Object.keys(app.rewardRuntime.appliedInvocationIds || {}).filter((id) =>
                        id.startsWith(
                            "shop-smoke_general_shop--site-listing-smoke-tonic-listing--purchase-1--reward-",
                        ),
                    ).length === 3,
                "buying a general-shop item atomically grants its item and three exact-site reward invocations",
                {
                    inventory: app.state.story_inventory,
                    shop: app.state.story_shops.smoke_general_shop,
                    rewardRuntime: app.rewardRuntime,
                },
            );
            const hostedShopItem =
                app.state.story_shops.smoke_general_shop.items.find(
                    (item) => item.id === "smoke-hosted-item-listing",
                )?.item;
            devAssert(
                hostedShopItem?.image?.url ===
                    devSmokePublicImageUrl(
                        "general-shop-item",
                        "hosted-smoke-flask",
                    ) &&
                    !hostedShopItem.image_id &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-story-item-image="smoke-hosted-flask"]',
                        )?.innerHTML,
                    ),
                "general-shop items display hosted images immediately without creating generated image records",
                {
                    hostedShopItem,
                    card: $("modalBox")?.querySelector?.(
                        '[data-story-item-image="smoke-hosted-flask"]',
                    )?.innerHTML,
                },
            );
            openStoryInventoryModal();
            devAssert(
                /Smoke Tonic/.test($("modalBox")?.textContent || "") &&
                    /View/.test($("modalBox")?.textContent || "") &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-story-item-image="smoke-tonic"]',
                        )?.innerHTML,
                    ),
                "Story Inventory displays purchased item images from the shop record and labels non-NPC detail actions as View",
                $("modalBox")?.innerHTML || "",
            );
            enterStoryShop("smoke_general_shop");
            const coinsBeforeSecondGeneralBuy = app.state.story_inventory.coins;
            buyStoryGeneralShopItem("smoke_general_shop", "smoke-tonic-listing");
            devAssert(
                app.state.story_inventory.coins === coinsBeforeSecondGeneralBuy - 30 &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-tonic")?.quantity === 2 &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-shop-bonus")?.quantity === 2 &&
                    app.state.story_inventory.shop_reward_tokens === 4 &&
                    app.state.player.known_facts.filter((fact) => fact === "The player bought a smoke tonic.").length === 1 &&
                    app.state.characters["Smoke Ally"].known_facts.filter((fact) => fact === "Smoke Ally witnessed the tonic purchase.").length === 1 &&
                    app.state.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.quantity === 0 &&
                    app.state.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.purchase_count === 2 &&
                    Object.keys(app.rewardRuntime.appliedInvocationIds || {}).filter((id) =>
                        id.startsWith(
                            "shop-smoke_general_shop--site-listing-smoke-tonic-listing--purchase-",
                        ),
                    ).length === 6,
                "repeat general-shop purchases use a new persisted purchase site while list facts remain deduplicated",
                { inventory: app.state.story_inventory, shop: app.state.story_shops.smoke_general_shop },
            );
            const coinsBeforeOutOfStockBuy = app.state.story_inventory.coins;
            buyStoryGeneralShopItem("smoke_general_shop", "smoke-tonic-listing");
            devAssert(
                app.state.story_inventory.coins === coinsBeforeOutOfStockBuy &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-tonic")?.quantity === 2,
                "general shops reject purchases after finite stock reaches zero",
                { inventory: app.state.story_inventory, shop: app.state.story_shops.smoke_general_shop },
            );
            const coinsBeforeUnaffordableBuy = app.state.story_inventory.coins;
            buyStoryGeneralShopItem("smoke_general_shop", "smoke-premium-listing");
            devAssert(
                app.state.story_inventory.coins === coinsBeforeUnaffordableBuy &&
                    !app.state.story_inventory.items.some((item) => item.id === "smoke-premium-kit") &&
                    app.state.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-premium-listing")?.quantity === 1,
                "general-shop purchases reject insufficient funds without changing stock or inventory",
                { inventory: app.state.story_inventory, shop: app.state.story_shops.smoke_general_shop },
            );

            const coinsBeforeSell = app.state.story_inventory.coins;
            sellStoryInventoryItem("smoke_general_shop", "smoke-loot", false);
            devAssert(
                app.state.story_inventory.coins === coinsBeforeSell + 10 &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-loot")?.quantity === 1,
                "general shops buy one sellable item at its exact value",
                app.state.story_inventory,
            );
            const coinsBeforeDisabledShopSell = app.state.story_inventory.coins;
            devAssert(
                sellStoryInventoryItem("smoke_no_buy_shop", "smoke-loot", false) === false &&
                    app.state.story_inventory.coins === coinsBeforeDisabledShopSell &&
                    app.state.story_inventory.items.find((item) => item.id === "smoke-loot")?.quantity === 1,
                "general shops with buying disabled cannot purchase player inventory",
                { inventory: app.state.story_inventory, shop: app.state.story_shops.smoke_no_buy_shop },
            );
            const coinsBeforeQuestSell = app.state.story_inventory.coins;
            sellStoryInventoryItem("smoke_general_shop", "smoke-quest", false);
            devAssert(
                app.state.story_inventory.coins === coinsBeforeQuestSell &&
                    app.state.story_inventory.items.some((item) => item.id === "smoke-quest"),
                "general shops reject quest items without changing currency or inventory",
                app.state.story_inventory,
            );
            const coinsBeforeStackSell = app.state.story_inventory.coins;
            sellStoryInventoryItem("smoke_general_shop", "smoke-loot", true);
            devAssert(
                app.state.story_inventory.coins === coinsBeforeStackSell + 10 &&
                    !app.state.story_inventory.items.some((item) => item.id === "smoke-loot"),
                "general shops sell an entire remaining stack and remove the empty inventory entry",
                app.state.story_inventory,
            );
            const coinsBeforeSellAll = app.state.story_inventory.coins;
            sellAllStoryLoot("smoke_general_shop");
            devAssert(
                app.state.story_inventory.coins === coinsBeforeSellAll + 40 &&
                    !app.state.story_inventory.items.some((item) => item.id === "smoke-tonic") &&
                    app.state.story_inventory.items.some((item) => item.id === "smoke-quest"),
                "sell all uses item value, removes all ordinary loot, and preserves quest items",
                app.state.story_inventory,
            );

            devCreateTestProfile({  });
            enterStoryShop("smoke_clothing_shop");
            const clothingShopText = $("modalBox")?.textContent || "";
            devAssert(/Smoke Roadwear/.test(clothingShopText) && /Player/.test(clothingShopText) && /Smoke Ally/.test(clothingShopText) && app.state.location.specific_place === "Smoke Outfitters",
                "clothing shops show saved outfits and eligible recipients at the shop location",
                {clothingShopText, location:app.state.location});
            await devWaitFor(
                () => {
                    const owner = getNpcEntryFromState(app.state, "Mara Smoke");
                    const image = activeProfileImage(owner?.full_character || owner);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-character-action="profile"][data-character-name="Mara Smoke"]',
                            )?.innerHTML,
                        )
                    );
                },
                8000,
                "opening a clothing shop to finish and display its owner profile image",
            );
            await devWaitFor(
                () => {
                    const listing =
                        app.state.story_shops.smoke_clothing_shop.items.find(
                            (item) => item.id === "smoke-roadwear-listing",
                        );
                    const outfit = listing?.outfit;
                    const image = storyShopOutfitImageRecord(outfit);
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html) &&
                        devLooksLikeRealImageHtml(
                            $("modalBox")?.querySelector?.(
                                '[data-story-outfit-image="smoke-roadwear"]',
                            )?.innerHTML,
                        )
                    );
                },
                8000,
                "opening a clothing shop to finish and display its outfit image",
            );
            const smokeRoadwearListing =
                app.state.story_shops.smoke_clothing_shop.items.find(
                    (item) => item.id === "smoke-roadwear-listing",
                );
            const smokeRoadwearOutfit = smokeRoadwearListing?.outfit;
            const smokeRoadwearImage = storyShopOutfitImageRecord(smokeRoadwearOutfit);
            devAssert(
                normalImageRequestGenerationOptions({ promptType: "story inventory item image" }).resolution === "512x512" &&
                normalImageRequestGenerationOptions({ promptType: "story shop outfit image" }).resolution === "512x512" &&
                normalImageRequestGenerationOptions({ promptType: "normal scene image" }).resolution === "512x768",
                "story item and outfit icons use square image requests while scene images retain portrait resolution",
                {},
            );
            devAssert(
                smokeRoadwearOutfit?.image_id &&
                    smokeRoadwearImage?.reason === "story shop outfit image" &&
                    smokeRoadwearImage?.hideFromChat === true &&
                    /square fantasy RPG outfit shop icon/i.test(smokeRoadwearImage.prompt || "") &&
                    /folded smoke-gray road outfit/i.test(smokeRoadwearImage.prompt || "") &&
                    !/(?:^|, )hat: (?:,|$)/i.test(smokeRoadwearImage.prompt || "") &&
                    !visibleImagesForRender().some(
                        (image) => String(image.id) === String(smokeRoadwearImage.id),
                    ) &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-story-outfit-image="smoke-roadwear"]',
                        )?.innerHTML,
                    ),
                "clothing-shop outfit images generate from outfit prompts, display in the shop, and stay out of chat/image feeds",
                {
                    smokeRoadwearOutfit,
                    smokeRoadwearImage,
                    card: $("modalBox")?.querySelector?.(
                        '[data-story-outfit-image="smoke-roadwear"]',
                    )?.innerHTML,
                },
            );
            const hostedShopOutfit =
                app.state.story_shops.smoke_clothing_shop.items.find(
                    (item) => item.id === "smoke-hosted-cloak-listing",
                )?.outfit;
            devAssert(
                hostedShopOutfit?.image?.url ===
                    devSmokePublicImageUrl(
                        "clothing-shop-outfit",
                        "hosted-smoke-cloak",
                    ) &&
                    !hostedShopOutfit.image_id &&
                    devLooksLikeRealImageHtml(
                        $("modalBox")?.querySelector?.(
                            '[data-story-outfit-image="smoke-hosted-cloak"]',
                        )?.innerHTML,
                    ),
                "clothing-shop outfits display hosted images immediately without creating generated image records",
                {
                    hostedShopOutfit,
                    card: $("modalBox")?.querySelector?.(
                        '[data-story-outfit-image="smoke-hosted-cloak"]',
                    )?.innerHTML,
                },
            );
            const playerActiveOutfitBefore = app.state.player.active_outfit_id || "";
            const coinsBeforePlayerOutfit = app.state.story_inventory.coins;
            const originalShowConfirmForClothingShop = showConfirm;
            const clothingPurchaseConfirmations = [];
            let confirmClothingPurchase = false;
            showConfirm = async (title, message, options) => {
                clothingPurchaseConfirmations.push({ title, message, options });
                return confirmClothingPurchase;
            };
            try {
                await buyStoryClothingShopOutfit("smoke_clothing_shop", "smoke-roadwear-listing", "Player");
            devAssert(
                app.state.story_inventory.coins === coinsBeforePlayerOutfit &&
                    !characterOwnsStoryShopOutfit(
                        app.state.player,
                        "smoke_clothing_shop",
                        "smoke-roadwear-listing",
                    ) &&
                    /Smoke Roadwear.*Player.*70 coins/i.test(
                        clothingPurchaseConfirmations[0]?.message || "",
                    ),
                "cancelling a clothing-shop confirmation preserves currency and outfit ownership",
                { confirmations: clothingPurchaseConfirmations, inventory: app.state.story_inventory },
            );
            confirmClothingPurchase = true;
            await buyStoryClothingShopOutfit("smoke_clothing_shop", "smoke-roadwear-listing", "Player");
            const playerPurchasedOutfit = exactEntityOutfits(app.state.player).find(
                (outfit) => outfit.source_shop_id === "smoke_clothing_shop",
            );
            devAssert(
                app.state.story_inventory.coins === coinsBeforePlayerOutfit - 70 &&
                    playerPurchasedOutfit?.source_outfit_id === "smoke-roadwear-listing" &&
                    playerPurchasedOutfit?.origin === "Purchased from Smoke Outfitters" &&
                    (app.state.player.active_outfit_id || "") === playerActiveOutfitBefore,
                "buying an outfit copies the complete preset to the selected character without auto-equipping it",
                { player: app.state.player, inventory: app.state.story_inventory },
            );
            const coinsBeforeDuplicateOutfit = app.state.story_inventory.coins;
            const playerOutfitCountBeforeDuplicate = app.state.player.outfits.length;
            const originalShowNoticeForClothingShop = showNotice;
            const clothingPurchaseNotices = [];
            showNotice = (title, message, buttonText = "OK") => {
                clothingPurchaseNotices.push({ title, message, buttonText });
                return Promise.resolve(true);
            };
            try {
                await buyStoryClothingShopOutfit("smoke_clothing_shop", "smoke-roadwear-listing", "Player");
                devAssert(
                    app.state.story_inventory.coins === coinsBeforeDuplicateOutfit &&
                        app.state.player.outfits.length === playerOutfitCountBeforeDuplicate &&
                        clothingPurchaseNotices.some(
                            (notice) =>
                                notice.title === "Already Owned" &&
                                /Player already owns that outfit/i.test(notice.message || ""),
                        ),
                    "the same shop outfit cannot be purchased twice for one character",
                    {
                        player: app.state.player,
                        inventory: app.state.story_inventory,
                        notices: clothingPurchaseNotices,
                    },
                );
                const coinsBeforeAllyOutfit = app.state.story_inventory.coins;
                await buyStoryClothingShopOutfit("smoke_clothing_shop", "smoke-roadwear-listing", "Smoke Ally");
                devAssert(
                    app.state.story_inventory.coins === coinsBeforeAllyOutfit - 70 &&
                        characterOwnsStoryShopOutfit(
                            app.state.characters["Smoke Ally"],
                            "smoke_clothing_shop",
                            "smoke-roadwear-listing",
                        ),
                    "one clothing design can be purchased independently for another owned character",
                    { ally: app.state.characters["Smoke Ally"], inventory: app.state.story_inventory },
                );
                const coinsBeforeInvalidRecipient = app.state.story_inventory.coins;
                await buyStoryClothingShopOutfit(
                    "smoke_clothing_shop",
                    "smoke-roadwear-listing",
                    "Unowned Smoke NPC",
                );
                devAssert(
                    app.state.story_inventory.coins === coinsBeforeInvalidRecipient &&
                        clothingPurchaseNotices.some(
                            (notice) => notice.title === "Purchase Unavailable",
                        ),
                    "clothing shops reject NPCs and other recipients not owned by the player",
                    { inventory: app.state.story_inventory, notices: clothingPurchaseNotices },
                );
            } finally {
                showNotice = originalShowNoticeForClothingShop;
            }
            } finally {
                showConfirm = originalShowConfirmForClothingShop;
            }
            const reloadedEconomyState = repairAiGeneratedState(clone(app.state));
            devAssert(
                reloadedEconomyState.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.quantity === 0 &&
                    reloadedEconomyState.story_shops.smoke_general_shop.items.find((item) => item.id === "smoke-tonic-listing")?.rewards.length === 3 &&
                    reloadedEconomyState.story_inventory.shop_reward_tokens === 4 &&
                    reloadedEconomyState.player.known_facts.includes("The player bought a smoke tonic.") &&
                    reloadedEconomyState.characters["Smoke Ally"].known_facts.includes("Smoke Ally witnessed the tonic purchase.") &&
                    characterOwnsStoryShopOutfit(
                        reloadedEconomyState.player,
                        "smoke_clothing_shop",
                        "smoke-roadwear-listing",
                    ) &&
                    characterOwnsStoryShopOutfit(
                        reloadedEconomyState.characters["Smoke Ally"],
                        "smoke_clothing_shop",
                        "smoke-roadwear-listing",
                    ),
                "general-shop stock, rewards, reward effects, and purchased outfit ownership survive state normalization for save and reload",
                reloadedEconomyState,
            );

            closeModal();
            addMessage("system", "Story economy shops/jobs smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: story-economy-shops-jobs-smoke");
        }

        async function devRunBatchCharacterImageToolSmokeCoverage() {
            const coverageId = "batch-character-image-tool-coverage";
            devTestLog(`Scenario start: ${coverageId}`);
            const originalDefinitions = app.characterDefinitions;
            const originalDefinitionsCache = app.characterLibraryRecordsCache;
            const originalBatchState = app.batchCharacterImageTool;
            const originalCharacterImages = app.characterImages;
            const originalDevMode = app.settings?.devMode;
            const originalSession = app.supabaseSession;
            const originalGenerateImageHtml = generateImageHtml;
            const originalPrepareNormalImageRequest = prepareNormalImageRequest;
            const originalFetch = window.fetch;
            const originalPutSharedRecords = app.persistence.putSharedRecords;
            const originalBuildImageArchiveFilesAsync = buildImageArchiveFilesAsync;
            const originalMakeZip = makeZip;
            const originalCreateObjectUrl = URL.createObjectURL;
            const originalRevokeObjectUrl = URL.revokeObjectURL;
            const originalAnchorClick = HTMLAnchorElement.prototype.click;
            const originalShowConfirm = showConfirm;
            const originalShowNotice = showNotice;
            const originalLog = log;
            const originalDeleteSharedImage = app.persistence.deleteSharedImage;
            const toolButtonSelector =
                '.main-menu-tools-grid button[title="Generate normal images for selected local characters"]';
            const imageDataUrl =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
            const waitFor = async (predicate, message) => {
                for (let attempt = 0; attempt < 120; attempt += 1) {
                    if (predicate()) return;
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                throw new Error(`Batch character image smoke wait timed out: ${message}`);
            };

            try {
                app.settings.devMode = false;
                app.supabaseSession = {
                    access_token: "smoke",
                    user: {
                        id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                        email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                    },
                };
                openMainMenuDataToolsModal();
                devAssert(
                    !document.querySelector(toolButtonSelector),
                    "Batch Character Images is hidden when dev mode is disabled",
                );
                closeModal();

                app.settings.devMode = true;
                app.supabaseSession = null;
                openMainMenuDataToolsModal();
                devAssert(
                    !document.querySelector(toolButtonSelector),
                    "Batch Character Images is hidden for signed-out users",
                );
                closeModal();

                app.supabaseSession = {
                    access_token: "smoke",
                    user: { id: "wrong-user", email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL },
                };
                openMainMenuDataToolsModal();
                devAssert(
                    !document.querySelector(toolButtonSelector),
                    "Batch Character Images is hidden for the wrong official user id",
                );
                closeModal();

                app.supabaseSession = {
                    access_token: "smoke",
                    user: { id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID, email: "other@example.com" },
                };
                openMainMenuDataToolsModal();
                devAssert(
                    !document.querySelector(toolButtonSelector),
                    "Batch Character Images is hidden for the wrong official email",
                );
                closeModal();

                app.supabaseSession = {
                    access_token: "smoke",
                    user: {
                        id: OFFICIAL_EMBERADVENTURES_OWNER_USER_ID,
                        email: OFFICIAL_EMBERADVENTURES_OWNER_EMAIL,
                    },
                };
                openMainMenuDataToolsModal();
                devAssert(
                    !!document.querySelector(toolButtonSelector),
                    "Batch Character Images is visible only for dev mode and the exact official identity",
                );
                closeModal();

                const libraryRecord = devSmokeCharacterRecord(
                    "Batch Character Image Smoke",
                    {
                        record: { id: "batch-character-image-smoke" },
                        character: {
                            id: "batch-character-image-smoke",
                            gender: "female",
                            outfits: [
                                {
                                    id: "formal",
                                    name: "Formal",
                                    clothing: { shirt: "formal shirt" },
                                },
                                {
                                    id: "travel",
                                    name: "Travel",
                                    clothing: { shirt: "travel shirt" },
                                },
                            ],
                            active_outfit_id: "formal",
                            starting_outfit_id: "formal",
                            genres: ["cyberpunk"],
                            default_image_background:
                                "a glass-roofed neon conservatory",
                        },
                    },
                );
                const hiddenLibraryRecord = devSmokeCharacterRecord(
                    "Batch Character Image Hidden Selection",
                    {
                        record: { id: "batch-character-image-hidden-smoke" },
                        character: {
                            id: "batch-character-image-hidden-smoke",
                            gender: "female",
                            outfits: [
                                {
                                    id: "hidden-active",
                                    name: "Hidden Active",
                                    clothing: { shirt: "hidden active shirt" },
                                },
                                {
                                    id: "hidden-starting",
                                    name: "Hidden Starting",
                                    clothing: { shirt: "hidden starting shirt" },
                                },
                            ],
                            active_outfit_id: "hidden-active",
                            starting_outfit_id: "hidden-starting",
                        },
                    },
                );
                const sourceEntity = characterLibraryRecordEntity(libraryRecord);
                const sourceEntityBefore = JSON.stringify(sourceEntity);
                const normalImagesBefore = JSON.stringify(app.images || []);
                app.characterDefinitions = [libraryRecord, hiddenLibraryRecord];
                app.characterLibraryRecordsCache = null;
                app.batchCharacterImageTool = null;
                app.characterImages = [];

                const persistenceEntries = [];
                app.persistence.putSharedRecords = async (entries = []) => {
                    persistenceEntries.push(...entries);
                    return true;
                };
                const fetchUrls = [];
                const imageBlob = new Blob([new Uint8Array([1, 2, 3])], {
                    type: "image/png",
                });
                window.fetch = async (url) => {
                    fetchUrls.push(String(url));
                    return {
                        ok: true,
                        status: 200,
                        blob: async () => imageBlob,
                    };
                };
                const pendingGenerations = [];
                const generationCalls = [];
                const preparationCalls = [];
                let preparationFailuresRemaining = 0;
                prepareNormalImageRequest = (entities, reason, options = {}) => {
                    if (preparationFailuresRemaining > 0) {
                        preparationFailuresRemaining -= 1;
                        throw new Error("smoke batch preparation failed");
                    }
                    const prepared = originalPrepareNormalImageRequest(
                        entities,
                        reason,
                        options,
                    );
                    preparationCalls.push({
                        entities: clone(entities),
                        reason,
                        options: clone(options),
                        prepared: clone(prepared),
                    });
                    return prepared;
                };
                generateImageHtml = async (
                    prompt,
                    negativePrompt,
                    seed,
                    model,
                    options = {},
                ) => {
                    generationCalls.push({ prompt, negativePrompt, seed, model, options });
                    return new Promise((resolve, reject) =>
                        pendingGenerations.push({ resolve, reject }),
                    );
                };

                openBatchCharacterImageTool();
                let modal = $("modalBox");
                let card = modal?.querySelector(
                    `[data-batch-character-id="${libraryRecord.id}"]`,
                );
                const selectionGrid = modal?.querySelector(
                    "[data-batch-character-image-grid]",
                );
                const outputGrid = modal?.querySelector(
                    "[data-batch-character-image-output]",
                );
                devAssert(
                    selectionGrid?.style.getPropertyValue("--character-card-min") === "138px" &&
                        outputGrid?.style.getPropertyValue("--character-card-min") === "" &&
                        outputGrid?.classList.contains("card-size-large"),
                    "Batch Character Images uses the compact selection-card size without shrinking its output grid",
                );
                const outfitSelect = card?.querySelector(
                    `select[data-batch-outfit="${libraryRecord.id}"]`,
                );
                outfitSelect.value = "travel";
                outfitSelect.dispatchEvent(new Event("change", { bubbles: true }));
                toggleBatchCharacterImage(hiddenLibraryRecord.id);
                const search = modal?.querySelector("[data-batch-character-image-search]");
                search.value = "Batch Character Image Smoke";
                search.dispatchEvent(new Event("input", { bubbles: true }));
                modal?.querySelector("[data-batch-character-image-select-shown]")?.click();
                const firstState = batchCharacterImageToolState();
                devAssert(
                    modal?.querySelectorAll("[data-batch-character-id]").length === 1 &&
                        search.value === "Batch Character Image Smoke" &&
                        firstState.query === "Batch Character Image Smoke" &&
                        firstState.selected.size === 2 &&
                        firstState.selected.has(libraryRecord.id) &&
                        firstState.selected.has(hiddenLibraryRecord.id) &&
                        modal?.querySelector(
                            `select[data-batch-outfit="${libraryRecord.id}"]`,
                        )?.value === "travel",
                    "Batch Character Images filters by name, preserves its query and outfit across rerenders, and adds shown characters without clearing hidden selections",
                );
                modal?.querySelector("[data-batch-character-image-deselect-all]")?.click();
                devAssert(
                    firstState.selected.size === 0 &&
                        firstState.query === "Batch Character Image Smoke" &&
                        !firstState.selected.has(hiddenLibraryRecord.id),
                    "Batch Character Images Deselect All clears shown and hidden selections without clearing its filter",
                );
                card = $("modalBox")?.querySelector(
                    `[data-batch-character-id="${libraryRecord.id}"]`,
                );
                card.click();
                devAssert(
                    firstState.selected.has(libraryRecord.id) &&
                        firstState.outfitByCharacterId[libraryRecord.id] === "travel",
                    "Batch Character Images card selection retains the chosen outfit",
                );

                modal?.querySelector(
                    "[data-batch-character-image-restore-outfits]",
                )?.click();
                devAssert(
                    firstState.outfitByCharacterId[libraryRecord.id] === "travel" &&
                        firstState.outfitByCharacterId[hiddenLibraryRecord.id] ===
                            "hidden-active",
                    "Restore Outfits returns every character to the authored starting outfit",
                );
                setBatchCharacterImageOutfit(libraryRecord.id, "travel");
                toggleBatchCharacterImage(hiddenLibraryRecord.id);
                generateBatchCharacterImages();
                await waitFor(
                    () => pendingGenerations.length === 1 && firstState.running,
                    "first image generation to start",
                );
                const activeStatus = $("modalBox")?.querySelector(
                    "[data-batch-character-image-status]",
                )?.textContent || "";
                devAssert(
                    firstState.activeJob?.name === sourceEntity.name &&
                        activeStatus.includes(`Generating ${sourceEntity.name}`) &&
                        activeStatus.includes("queued") &&
                        activeStatus.includes(
                            `${exactImageRequestTimeoutSeconds(app.settings.imageRequestTimeoutSeconds)} seconds`,
                        ),
                    "Batch Character Images distinguishes the active character from queued work and states the configured timeout",
                    {
                        activeJob: firstState.activeJob,
                        status: activeStatus,
                    },
                );

                toggleBatchCharacterImage(libraryRecord.id);
                setBatchCharacterImageOutfit(libraryRecord.id, "travel");
                generateBatchCharacterImages();
                const queuedTravelJob = firstState.queue.find(
                    (job) =>
                        job.characterId === libraryRecord.id &&
                        job.entity.active_outfit_id === "travel",
                );
                devAssert(
                    firstState.selected.size === 0 &&
                        firstState.queue.length === 2 &&
                        queuedTravelJob?.imageId !== undefined &&
                        queuedTravelJob.entity !== sourceEntity &&
                        queuedTravelJob.entity.id === sourceEntity.id &&
                        queuedTravelJob.entity.clothing.shirt === "travel shirt" &&
                        queuedTravelJob.presentation === "non_male",
                    "Generate All appends a unique normal-image job, clears selections, and clones the selected presentation and outfit",
                    {
                        queueLength: firstState.queue.length,
                        selected: firstState.selected.size,
                        outfit: queuedTravelJob?.entity.active_outfit_id,
                    },
                );
                devAssert(
                    preparationCalls.length === 1 &&
                        preparationCalls[0].entities[0][1].active_outfit_id === "travel" &&
                        JSON.stringify(preparationCalls[0].entities[0][1].clothing) ===
                            JSON.stringify(sourceEntity.outfits.find(outfit => outfit.id === "travel").clothing) &&
                        Object.keys(preparationCalls[0].entities[0][1].held_items || {})
                            .length === 0 &&
                        preparationCalls[0].options.includeSceneContext === false &&
                        preparationCalls[0].options.backgroundOverride.includes(
                            "a glass-roofed neon conservatory",
                        ) &&
                        JSON.stringify(sourceEntity) === sourceEntityBefore,
                    "Outfit batch generation prepares a cloned normal solo request with the character background and no library mutation",
                );

                const archiveCalls = [];
                let zipCallCount = 0;
                let objectUrlCallCount = 0;
                let anchorClickCount = 0;
                buildImageArchiveFilesAsync = async ({ type, images }) => {
                    archiveCalls.push({ type, images });
                    return {
                        files: [{ name: "batch-character-image-smoke.png", data: new Uint8Array([1]) }],
                        metadataImages: images,
                    };
                };
                makeZip = () => {
                    zipCallCount += 1;
                    return new Blob(["smoke zip"], { type: "application/zip" });
                };
                URL.createObjectURL = () => {
                    objectUrlCallCount += 1;
                    return "blob:batch-character-image-smoke";
                };
                URL.revokeObjectURL = () => {};
                HTMLAnchorElement.prototype.click = () => {
                    anchorClickCount += 1;
                };
                batchCharacterImageToolRender();
                const downloadButton = $("modalBox")?.querySelector(
                    "[data-batch-character-image-download]",
                );
                devAssert(
                    downloadButton?.disabled === true &&
                        (await downloadBatchCharacterImages()) === false &&
                        archiveCalls.length === 0,
                    "Download All is disabled and rejected while batch generation is busy",
                    { disabled: downloadButton?.disabled, archiveCalls: archiveCalls.length },
                );

                pendingGenerations[0].resolve(
                    '<img alt="batch character smoke image 1" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () => pendingGenerations.length === 2,
                    "second image generation to start",
                );
                pendingGenerations[1].resolve(
                    '<img alt="batch character smoke image 2" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () => pendingGenerations.length === 3,
                    "third image generation to start",
                );
                pendingGenerations[2].resolve(
                    '<img alt="batch character smoke image 3" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () => !firstState.running && firstState.trackedImages.length === 3,
                    "all batch images to finish",
                );
                modal = $("modalBox");
                devAssert(
                    generationCalls.length === 3 &&
                        generationCalls.every(
                            (call) =>
                                call.options.label === "normal scene image generation" &&
                                call.options.promptType === "normal scene image" &&
                                call.options.resolution === "512x768" &&
                                call.options.promptEditorReplay.reason ===
                                    "developer batch character image" &&
                                call.options.promptEditorReplay.targets.length === 1,
                        ) &&
                        preparationCalls.length === 3 &&
                        generationCalls.every(
                            (call, index) =>
                                call.prompt === preparationCalls[index].prepared.prompt &&
                                call.negativePrompt ===
                                    preparationCalls[index].prepared.negativePrompt &&
                                call.seed ===
                                    (preparationCalls[index].prepared.seed === "random"
                                        ? undefined
                                        : preparationCalls[index].prepared.seed) &&
                                call.model === preparationCalls[index].prepared.model,
                        ) &&
                        preparationCalls[1].options.backgroundOverride.includes(
                            "softly painted fantasy interior",
                        ) &&
                        firstState.trackedImages.filter(
                            (image) => image.characterId === libraryRecord.id,
                        ).length === 2 &&
                        firstState.trackedImages.filter(
                            (image) => image.characterId === hiddenLibraryRecord.id,
                        ).length === 1 &&
                        firstState.trackedImages.every(
                            (image) =>
                                image.presentation === "non_male" &&
                                image.promptType === "normal scene image" &&
                                image.pending === false,
                        ) &&
                        persistenceEntries.filter(
                            (entry) => entry.storeName === "characterImages",
                        ).length === 3 &&
                        persistenceEntries.filter(
                            (entry) => entry.storeName === "assetBlobs",
                        ).length === 3 &&
                        fetchUrls.length === 3 &&
                        modal?.querySelectorAll(
                            "[data-batch-character-image-output] .image-render",
                        ).length === 3,
                    "batch requests use real shared normal preparation with exact 512x768 options and persist only durable character image records",
                    {
                        generationCalls: generationCalls.length,
                        persistenceStores: persistenceEntries.map((entry) => entry.storeName),
                        fetchUrls,
                        trackedImages: firstState.trackedImages.length,
                    },
                );
                const outputFrame = modal?.querySelector(
                    "[data-batch-character-image-output] .image-render",
                );
                devAssert(
                    outputFrame?.style.aspectRatio === "2 / 3" &&
                        outputFrame?.querySelector("img")?.style.objectFit === "contain" &&
                        !modal?.querySelector(
                            "[data-batch-character-image-output] .profile-image-thumb-wrap",
                        ) &&
                        JSON.stringify(app.images || []) === normalImagesBefore &&
                        JSON.stringify(sourceEntity) === sourceEntityBefore,
                    "completed batch output uses contained 2:3 normal-image framing without active save or library mutation",
                );
                const urlOnlyHtml = imageRecordBodyHtml({
                    id: "batch-url-only-hydrated",
                    url: "https://example.invalid/batch-url-only.png",
                    hosted_url: "",
                    html: "",
                    pending: false,
                    error: "",
                });
                const hostedOnlyHtml = imageRecordBodyHtml({
                    id: "batch-hosted-only-hydrated",
                    url: "",
                    hosted_url: "https://example.invalid/batch-hosted-only.png",
                    html: "",
                    pending: true,
                    error: "",
                });
                devAssert(
                    urlOnlyHtml.includes("batch-url-only.png") &&
                        hostedOnlyHtml.includes("batch-hosted-only.png") &&
                        !urlOnlyHtml.includes("image-loading-block") &&
                        !hostedOnlyHtml.includes("image-loading-block"),
                    "URL-only hydrated normal image records render safely without a pending spinner",
                );

                const persistedCountBeforeDownload = persistenceEntries.length;
                const downloaded = await downloadBatchCharacterImages();
                devAssert(
                    downloaded === true &&
                        firstState.trackedImages.length === 0 &&
                        persistenceEntries.length === persistedCountBeforeDownload &&
                        persistenceEntries.filter(
                            (entry) => entry.storeName === "characterImages",
                        ).length === 3 &&
                        persistenceEntries.filter(
                            (entry) => entry.storeName === "assetBlobs",
                        ).length === 3 &&
                        archiveCalls.length === 1 &&
                        archiveCalls[0].type === "batch-character-images" &&
                        zipCallCount === 1 &&
                        objectUrlCallCount === 1 &&
                        anchorClickCount === 1,
                    "Download All clears only tracked output while durable character image records remain",
                    {
                        trackedImages: firstState.trackedImages.length,
                        persistenceEntries: persistenceEntries.length,
                        archiveCalls: archiveCalls.length,
                        zipCallCount,
                        objectUrlCallCount,
                        anchorClickCount,
                    },
                );

                const libraryImages = app.characterImages.filter(
                    (image) => image.characterId === libraryRecord.id,
                );
                const deletedImage = libraryImages[0];
                const failedImage = libraryImages[1];
                const deleteCalls = [];
                const notices = [];
                const deleteLogs = [];
                let rejectDeleteId = "";
                showConfirm = async () => true;
                showNotice = (title, message) => notices.push({ title, message });
                log = (title, message, options) =>
                    deleteLogs.push({ title, message, options });
                app.persistence.deleteSharedImage = async (storeName, imageId) => {
                    deleteCalls.push({ storeName, imageId });
                    if (String(imageId) === rejectDeleteId)
                        throw new Error("smoke shared character image delete failed");
                    return true;
                };
                const registeredProfile = registerCharacterLibraryProfileEntity(libraryRecord);
                const profilePopup = openProfileImagePopupModal(registeredProfile.name);
                const imageCardVisible = (imageId) =>
                    [...(profilePopup?.box?.querySelectorAll?.("[data-image-id]") || [])].some(
                        (card) => card.dataset.imageId === imageDomId(imageId),
                    );
                sessionImageObjectUrlCache().set(
                    `characterImages|${deletedImage.id}`,
                    "blob:batch-character-image-delete-smoke",
                );
                devAssert(
                    imageCardVisible(deletedImage.id) && imageCardVisible(failedImage.id),
                    "hydrated shared character images appear in the character scene-image browser before deletion",
                );
                const sharedDeleteSucceeded = await deleteImageRecord(deletedImage.id);
                devAssert(
                    sharedDeleteSucceeded === true &&
                        deleteCalls[0]?.storeName === "characterImages" &&
                        deleteCalls[0]?.imageId === deletedImage.id &&
                        !app.characterImages.some((image) => image.id === deletedImage.id) &&
                        !sessionImageObjectUrlCache().has(
                            `characterImages|${deletedImage.id}`,
                        ) &&
                        !imageCardVisible(deletedImage.id),
                    "scene-image Delete removes shared character metadata and blob ownership, revokes its runtime URL, and refreshes the open browser",
                    { deleteCalls },
                );
                rejectDeleteId = failedImage.id;
                const sharedDeleteFailed = await deleteImageRecord(failedImage.id);
                devAssert(
                    sharedDeleteFailed === false &&
                        deleteCalls.at(-1)?.storeName === "characterImages" &&
                        deleteCalls.at(-1)?.imageId === failedImage.id &&
                        app.characterImages.some((image) => image.id === failedImage.id) &&
                        imageCardVisible(failedImage.id) &&
                        notices.at(-1)?.title === "Image Delete Failed" &&
                        notices.at(-1)?.message.includes(
                            "smoke shared character image delete failed",
                        ) &&
                        deleteLogs.at(-1)?.title ===
                            "Character image delete failed" &&
                        deleteLogs.at(-1)?.options?.level === "error",
                    "a failed shared character-image deletion keeps the runtime record and visible card while surfacing the failure",
                    { deleteCalls, notices, deleteLogs },
                );
                log = originalLog;
                profilePopup.close();
                closeModal({ ignoreCloseDestination: true });

                app.batchCharacterImageTool = null;
                openBatchCharacterImageTool();
                const cancelState = batchCharacterImageToolState();
                toggleBatchCharacterImage(libraryRecord.id);
                setBatchCharacterImageOutfit(libraryRecord.id, "travel");
                generateBatchCharacterImages();
                await waitFor(
                    () => pendingGenerations.length === 4 && cancelState.running,
                    "cancellation image generation to start",
                );
                toggleBatchCharacterImage(libraryRecord.id);
                setBatchCharacterImageOutfit(libraryRecord.id, "formal");
                generateBatchCharacterImages();
                devAssert(
                    cancelState.queue.length === 1,
                    "a second cancellation job remains queued before the tool closes",
                );
                const persistedCountBeforeClose = persistenceEntries.length;
                closeModal();
                devAssert(
                    app.batchCharacterImageTool === null &&
                        cancelState.cancelled === true &&
                        cancelState.queue.length === 0,
                    "closing the batch tool cancels its pending queue",
                    { cancelled: cancelState.cancelled, queueLength: cancelState.queue.length },
                );
                pendingGenerations[3].resolve(
                    '<img alt="cancelled batch character smoke image" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () => !cancelState.running,
                    "cancelled generation to settle",
                );
                devAssert(
                    persistenceEntries.length === persistedCountBeforeClose &&
                        cancelState.trackedImages.length === 0,
                    "cancelled batch work does not persist or track a completed output",
                    { persistenceEntries: persistenceEntries.length },
                );

                app.batchCharacterImageTool = null;
                openBatchCharacterImageTool();
                const continuationState = batchCharacterImageToolState();
                const continuationFailureLogs = [];
                const pendingBeforeContinuation = pendingGenerations.length;
                log = (title, message, options) =>
                    continuationFailureLogs.push({ title, message, options });
                preparationFailuresRemaining = 1;
                toggleBatchCharacterImage(libraryRecord.id);
                toggleBatchCharacterImage(hiddenLibraryRecord.id);
                generateBatchCharacterImages();
                await waitFor(
                    () =>
                        pendingGenerations.length === pendingBeforeContinuation + 1 &&
                        continuationState.activeJob?.name ===
                            characterLibraryRecordEntity(hiddenLibraryRecord).name,
                    "queue to continue after a preparation failure",
                );
                toggleBatchCharacterImage(libraryRecord.id);
                generateBatchCharacterImages();
                pendingGenerations[pendingBeforeContinuation].reject(
                    new Error("Image generation timed out after 1 second."),
                );
                await waitFor(
                    () => pendingGenerations.length === pendingBeforeContinuation + 2,
                    "queue to continue after a generation timeout",
                );
                pendingGenerations[pendingBeforeContinuation + 1].resolve(
                    '<img alt="continued batch character smoke image" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () =>
                        !continuationState.running &&
                        continuationState.queue.length === 0 &&
                        continuationState.trackedImages.length === 1,
                    "continued batch generation to finish",
                );
                devAssert(
                    continuationState.activeJob === null &&
                        continuationFailureLogs.some(
                            (entry) =>
                                entry.title === "Batch character image failed" &&
                                entry.message.includes("smoke batch preparation failed"),
                        ) &&
                        continuationFailureLogs.some(
                            (entry) =>
                                entry.title === "Batch character image failed" &&
                                entry.message.includes("timed out after 1 second"),
                        ) &&
                        continuationState.failedJobs.length === 2 &&
                        !$("modalBox")?.querySelector(
                            "[data-batch-character-image-retry-failed]",
                        )?.disabled &&
                        $("modalBox")?.querySelector(
                            "[data-batch-character-image-status]",
                        )?.textContent === "1 completed image, 2 failed images.",
                    "batch generation continues after preparation and generation failures while retaining retryable failures",
                    {
                        activeJob: continuationState.activeJob,
                        queueLength: continuationState.queue.length,
                        trackedImages: continuationState.trackedImages.length,
                        failedJobs: continuationState.failedJobs.length,
                        failureLogs: continuationFailureLogs,
                    },
                );
                const pendingBeforeRetry = pendingGenerations.length;
                $("modalBox")?.querySelector(
                    "[data-batch-character-image-retry-failed]",
                )?.click();
                await waitFor(
                    () => pendingGenerations.length === pendingBeforeRetry + 1,
                    "first failed batch image retry to start",
                );
                pendingGenerations[pendingBeforeRetry].resolve(
                    '<img alt="retried batch character smoke image 1" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () => pendingGenerations.length === pendingBeforeRetry + 2,
                    "second failed batch image retry to start",
                );
                pendingGenerations[pendingBeforeRetry + 1].resolve(
                    '<img alt="retried batch character smoke image 2" src="' +
                        imageDataUrl +
                        '">',
                );
                await waitFor(
                    () =>
                        !continuationState.running &&
                        continuationState.queue.length === 0 &&
                        continuationState.failedJobs.length === 0 &&
                        continuationState.trackedImages.length === 3,
                    "failed batch image retries to finish",
                );
                devAssert(
                    $("modalBox")?.querySelector(
                        "[data-batch-character-image-status]",
                    )?.textContent === "3 completed images, 0 failed images." &&
                        $("modalBox")?.querySelector(
                            "[data-batch-character-image-retry-failed]",
                        )?.disabled === true,
                    "Retry Failed requeues each failed batch image and clears failures after successful retry",
                    {
                        status: $("modalBox")?.querySelector(
                            "[data-batch-character-image-status]",
                        )?.textContent,
                        trackedImages: continuationState.trackedImages.length,
                    },
                );
                log = originalLog;
                closeModal();
                devTestLog(`Scenario complete: ${coverageId}`);
            } finally {
                if ($("modalBox")?.matches?.("[data-batch-character-image-tool-modal='1']"))
                    closeModal();
                app.characterDefinitions = originalDefinitions;
                app.characterLibraryRecordsCache = originalDefinitionsCache;
                app.batchCharacterImageTool = originalBatchState;
                app.characterImages = originalCharacterImages;
                app.settings.devMode = originalDevMode;
                app.supabaseSession = originalSession;
                generateImageHtml = originalGenerateImageHtml;
                prepareNormalImageRequest = originalPrepareNormalImageRequest;
                window.fetch = originalFetch;
                app.persistence.putSharedRecords = originalPutSharedRecords;
                buildImageArchiveFilesAsync = originalBuildImageArchiveFilesAsync;
                makeZip = originalMakeZip;
                URL.createObjectURL = originalCreateObjectUrl;
                URL.revokeObjectURL = originalRevokeObjectUrl;
                HTMLAnchorElement.prototype.click = originalAnchorClick;
                showConfirm = originalShowConfirm;
                showNotice = originalShowNotice;
                log = originalLog;
                app.persistence.deleteSharedImage = originalDeleteSharedImage;
            }
        }

        async function devRunManageImagesSmokeTest() {
            const scenarioId = "manage-images-smoke";
            devTestLog(`Scenario start: ${scenarioId}`);
            const runNumber = Date.now();
            const runId = `${runNumber}-${Math.random().toString(36).slice(2, 8)}`;
            const profileImageId = `manage-profile-${runId}`;
            const replacementProfileImageId = `manage-profile-replacement-${runId}`;
            const brokenProfileImageId = `manage-profile-broken-${runId}`;
            const oppositeProfileImageId = `manage-profile-opposite-${runId}`;
            const hostedProfileImageId = `manage-profile-hosted-${runId}`;
            const mismatchedProfileImageId = `manage-profile-mismatched-${runId}`;
            const storyProfileImageId = `manage-profile-story-${runId}`;
            const shopProfileImageId = `manage-profile-shop-${runId}`;
            const firstItemImageId = `manage-item-a-${runId}`;
            const secondItemImageId = `manage-item-b-${runId}`;
            const sceneImageId = `manage-scene-${runId}`;
            const legacyTitleImageId = `manage-title-legacy-blob-${runId}`;
            const sceneSaveId = runNumber;
            const characterId = `manage-images-character-${runId}`;
            const storyCharacterId = `manage-images-story-character-${runId}`;
            const shopCharacterId = `manage-images-shop-character-${runId}`;
            const storyId = `manage-images-story-${runId}`;
            const originalCharacterDefinitions = app.characterDefinitions;
            const originalCharacterLibraryRecordsCache = app.characterLibraryRecordsCache;
            const managedCharacterRecord = devSmokeCharacterRecord(
                "Managed Images Character",
                { character: { id: characterId } },
            );
            //This scenario owns its image set; the generic fixture's hosted portraits
            //would otherwise be persisted as extra usable replacement images.
            managedCharacterRecord.character.default_profile_image = emptyProfileImageSlot(false);
            managedCharacterRecord.character.profile_image_presentations = createProfileImagePresentations({});
            managedCharacterRecord.active_profile_image_ids = {
                male: "",
                non_male: profileImageId,
            };
            managedCharacterRecord.character.profile_image_id = profileImageId;
            const references = [
                { storeName: "characterProfileImages", imageId: profileImageId },
                { storeName: "characterProfileImages", imageId: replacementProfileImageId },
                { storeName: "characterProfileImages", imageId: brokenProfileImageId },
                { storeName: "characterProfileImages", imageId: oppositeProfileImageId },
                { storeName: "characterProfileImages", imageId: hostedProfileImageId },
                { storeName: "characterProfileImages", imageId: mismatchedProfileImageId },
                { storeName: "characterProfileImages", imageId: storyProfileImageId },
                { storeName: "characterProfileImages", imageId: shopProfileImageId },
                { storeName: "storyItemImages", imageId: firstItemImageId },
                { storeName: "storyItemImages", imageId: secondItemImageId },
                { storeName: "storyImages", imageId: sceneImageId, saveId: sceneSaveId },
                { storeName: "storyTitleImages", imageId: legacyTitleImageId },
            ];
            const priorShowConfirm = showConfirm;
            const originalStoryTemplates = app.storyTemplates;
            const confirmations = [];
            showConfirm = async (title, message, options) => {
                confirmations.push({ title, message, options });
                return true;
            };

            try {
                app.characterDefinitions = [
                    ...(app.characterDefinitions || []),
                    managedCharacterRecord,
                ];
                app.characterLibraryRecordsCache = null;
                app.storyTemplates = [
                    ...(app.storyTemplates || []),
                    {lite: true,
                        id: storyId,
                        title: "Managed Images Story",
                        state: {
                            players: [
                                {
                                    id: storyCharacterId,
                                    name: "Managed Story Character",
                                    species: "Human",
                                },
                            ],
                            characters: {
                                "Managed Story Character": {
                                    id: storyCharacterId,
                                    name: "Managed Story Character",
                                    species: "Human",
                                },
                                "Managed Shop Character": {
                                    id: shopCharacterId,
                                    name: "Managed Shop Character",
                                    appearance: { species: "Elf" },
                                },
                            },
                            story_shops: {
                                managed_character_shop: {
                                    id: "managed_character_shop",
                                    title: "Managed Character Shop",
                                    type: "character",
                                    items: [{ character_id: shopCharacterId }],
                                },
                            },
                        },
                    },
                ];
                const imageBlob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
                await app.persistence.putSharedRecords([
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: profileImageId,
                            characterId,
                            presentation: "non_male",
                            favorite: false,
                            createdAt: "2026-08-30T12:00:00.000Z",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: replacementProfileImageId,
                            characterId,
                            presentation: "non_male",
                            favorite: false,
                            createdAt: "2026-08-30T12:01:00.000Z",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: brokenProfileImageId,
                            characterId,
                            presentation: "non_male",
                            favorite: false,
                            createdAt: "2026-08-30T12:02:00.000Z",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: oppositeProfileImageId,
                            characterId,
                            presentation: "male",
                            favorite: false,
                            createdAt: "2026-08-30T12:03:00.000Z",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: shopProfileImageId,
                            characterId: shopCharacterId,
                            presentation: "non_male",
                            favorite: false,
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: storyProfileImageId,
                            characterId: storyCharacterId,
                            presentation: "non_male",
                            favorite: false,
                        },
                    },
                    {
                        storeName: "characterProfileImageSelections",
                        record: { characterId, presentation: "non_male", imageId: profileImageId },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: hostedProfileImageId,
                            characterId: `${characterId}-hosted-only`,
                            presentation: "male",
                            favorite: false,
                            url: "https://example.invalid/managed-hosted-profile.png",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: mismatchedProfileImageId,
                            characterId: `${characterId}-mismatched`,
                            presentation: "non_male",
                            favorite: false,
                            url: "https://example.invalid/stale-managed-profile.png",
                        },
                    },
                    {
                        storeName: "storyItemImages",
                        record: { storyId, itemId: "first-item", imageId: firstItemImageId },
                    },
                    {
                        storeName: "storyItemImages",
                        record: { storyId, itemId: "second-item", imageId: secondItemImageId },
                    },
                    {
                        storeName: "storyItemImageSelections",
                        record: { storyId, itemId: "first-item", imageId: firstItemImageId },
                    },
                    ...[profileImageId, replacementProfileImageId, oppositeProfileImageId, mismatchedProfileImageId, storyProfileImageId, shopProfileImageId, firstItemImageId, secondItemImageId, sceneImageId].map((imageId) => ({
                        storeName: "assetBlobs",
                        record: {
                            imageId,
                            blob: imageBlob,
                            mimeType: "image/png",
                            byteLength: imageBlob.size,
                            contentHash: `smoke-${imageId}`,
                        },
                    })),
                ]);
                const mismatchedStoredImage = await app.persistence.getRecord(
                    "characterProfileImages",
                    mismatchedProfileImageId,
                );
                const mismatchedStoredAsset = await app.persistence.getRecord(
                    "assetBlobs",
                    mismatchedProfileImageId,
                );
                const mismatchedRuntimeSource = sharedImageRuntimeSource(
                    "characterProfileImages",
                    mismatchedStoredImage,
                    mismatchedStoredAsset,
                );
                const mismatchedRuntimeBlob = await (
                    await fetch(mismatchedRuntimeSource)
                ).blob();
                let hostedUrlReuseError = "";
                try {
                    await sharedImageStorageEntries(
                        PROFILE_IMAGE_KEY,
                        [
                            createProfileImageRecord({
                                id: mismatchedProfileImageId,
                                character_id: `${characterId}-mismatched`,
                                owner_name: "Managed Mismatched Profile",
                                male: false,
                                source: "hosted",
                                html: '<img src="https://example.invalid/replacement-profile.png">',
                                hosted_url:
                                    "https://example.invalid/replacement-profile.png",
                            }),
                        ],
                    );
                } catch (error) {
                    hostedUrlReuseError = error?.message || String(error);
                }
                let storedBytesReuseError = "";
                try {
                    await sharedImageStorageEntries(
                        PROFILE_IMAGE_KEY,
                        [
                            createProfileImageRecord({
                                id: mismatchedProfileImageId,
                                character_id: `${characterId}-mismatched`,
                                owner_name: "Managed Mismatched Profile",
                                male: false,
                                source: "stored",
                                html: '<img src="data:image/png;base64,AQIDBA==">',
                            }),
                        ],
                    );
                } catch (error) {
                    storedBytesReuseError = error?.message || String(error);
                }
                devAssert(
                    mismatchedRuntimeSource.startsWith("blob:") &&
                        mismatchedRuntimeBlob.size === imageBlob.size &&
                        /cannot replace its hosted URL/.test(hostedUrlReuseError) &&
                        /cannot replace its stored image bytes/.test(
                            storedBytesReuseError,
                        ),
                    "managed profile records prefer durable local bytes and reject reusing an image id for different hosted content",
                    {
                        mismatchedRuntimeSource,
                        mismatchedRuntimeBlobSize: mismatchedRuntimeBlob.size,
                        hostedUrlReuseError,
                        storedBytesReuseError,
                    },
                );
                await app.persistence.seedRecord("storyImages", {
                    saveId: sceneSaveId,
                    imageId: sceneImageId,
                    at: new Date().toISOString(),
                    favorite: false,
                    title: "Managed scene image",
                    model: "smoke",
                    prompt: "Managed scene image smoke prompt.",
                    negativePrompt: "text",
                    status: "ready",
                });
                await app.persistence.seedRecord("storyImageTargets", {
                    saveId: sceneSaveId,
                    imageId: sceneImageId,
                    characterId,
                });
                await app.persistence.putSharedRecords([{
                    storeName: "storyTitleImages",
                    record: {
                        storyId,
                        storyTitle: "Managed Images Story Current Metadata",
                        imageId: legacyTitleImageId,
                        source: "imported",
                    },
                }]);

                const imageIndex = await app.persistence.exportAllImageIndex();
                const archiveRecords = Object.fromEntries(
                    Object.keys(imageIndex.records || {}).map((storeName) => [storeName, []]),
                );
                const legacyTitleBytes = new Uint8Array([137, 80, 78, 71]);
                const legacyTitleFile = "images/0001-legacy-title.png";
                archiveRecords.storyTitleImages = [{
                    storyId,
                    storyTitle: "Managed Images Story",
                    imageId: legacyTitleImageId,
                    source: "generated",
                    url: "blob:https://example.invalid/expired-title-image",
                }];
                archiveRecords.storyTitleImageSelections = [{
                    storyId,
                    imageId: legacyTitleImageId,
                }];
                archiveRecords.characterProfileImageSelections = [{
                    characterId: "smoke-character-orphaned-selection",
                    presentation: "non_male",
                    imageId: "smoke-image-missing-from-restoration-archive",
                }];
                const archiveManifest = {
                    app: "EmberAdventures",
                    exportType: "all-images-restoration",
                    archiveVersion: IMAGE_RESTORATION_ARCHIVE_VERSION,
                    schemaVersion: app.persistence.schemaInfo.version,
                    exportedAt: new Date().toISOString(),
                    records: archiveRecords,
                    assets: [{
                        imageId: legacyTitleImageId,
                        mimeType: "image/png",
                        byteLength: legacyTitleBytes.length,
                        contentHash: `smoke-${legacyTitleImageId}`,
                        sha256: await imageArchiveSha256(legacyTitleBytes),
                        file: legacyTitleFile,
                    }],
                    warnings: [],
                };
                const normalizedArchive = await normalizedImageImportPayload({
                    "manifest.json": new TextEncoder().encode(JSON.stringify(archiveManifest)),
                    [legacyTitleFile]: legacyTitleBytes,
                });
                const normalizedTitle = normalizedArchive.payload.records.storyTitleImages[0];
                const normalizedProfileSelections =
                    normalizedArchive.payload.records.characterProfileImageSelections;
                const importResult = await app.persistence.importAllImages(
                    new Blob([JSON.stringify(normalizedArchive.payload)], {
                        type: "application/json",
                    }),
                );
                const importedTitle = await app.persistence.getRecord(
                    "storyTitleImages",
                    legacyTitleImageId,
                );
                const importedTitleSelection = await app.persistence.getRecord(
                    "storyTitleImageSelections",
                    storyId,
                );
                const importedTitleAsset = await app.persistence.getRecord(
                    "assetBlobs",
                    legacyTitleImageId,
                );
                devAssert(
                    importResult.imported === 2 &&
                        importResult.skipped === 1 &&
                        !Object.hasOwn(normalizedTitle, "url") &&
                        normalizedProfileSelections.length === 0 &&
                        !Object.hasOwn(importedTitle || {}, "url") &&
                        importedTitle?.storyTitle ===
                            "Managed Images Story Current Metadata" &&
                        importedTitle?.source === "imported" &&
                        importedTitleSelection?.imageId === legacyTitleImageId &&
                        importedTitleAsset?.blob instanceof Blob &&
                        importedTitleAsset.blob.size === legacyTitleBytes.length,
                    "image restoration drops orphaned selections and restores legacy title bytes without replacing current same-owner metadata or persisting an expired blob URL",
                    {
                        importResult,
                        normalizedTitle,
                        normalizedProfileSelections,
                        importedTitle,
                        importedTitleSelection,
                        importedTitleAsset: importedTitleAsset
                            ? {
                                  imageId: importedTitleAsset.imageId,
                                  byteLength: importedTitleAsset.byteLength,
                                  blobSize: importedTitleAsset.blob?.size,
                              }
                            : null,
                    },
                );

                await openManageImagesModal();
                const box = $("modalBox");
                const managedCatalogCount = managedImagesState().items.length;
                const managedCardCount = box?.querySelectorAll("[data-managed-image-card]").length || 0;
                const hostedOnlyItem = managedImagesState().items.find(
                    (item) => item.imageId === hostedProfileImageId,
                );
                const storyGroup = box?.querySelector(
                    `[data-managed-image-group-path="story:${storyId}"]`,
                );
                const standaloneGroup = box?.querySelector(
                    `[data-managed-image-group-path="characters"]`,
                );
                const playerCharacterGroup = box?.querySelector(
                    `[data-managed-image-group-path="story:${storyId}:player-characters"]`,
                );
                const shopRaceGroup = box?.querySelector(
                    `[data-managed-image-group-path="story:${storyId}:shop:managed_character_shop:species:Elf"]`,
                );
                devAssert(
                    box?.matches?.("[data-manage-images-modal='1'][data-fullscreen-list-modal='1']") &&
                        box?.querySelector?.(
                            ".managed-images-toolbar input[type='search']",
                        ) &&
                        /Characters/.test(box.textContent || "") &&
                        /Stories/.test(box.textContent || "") &&
                        managedCardCount === managedCatalogCount &&
                        managedCatalogCount >= 6 &&
                        hostedOnlyItem?.hasLocalAsset === false &&
                        hostedOnlyItem?.url ===
                            "https://example.invalid/managed-hosted-profile.png" &&
                        !!box.querySelector(
                            `[data-managed-image-card="characterProfileImages||${hostedProfileImageId}"]`,
                        ) &&
                        !!storyGroup?.querySelector(
                            `[data-managed-image-card="characterProfileImages||${storyProfileImageId}"]`,
                        ) &&
                        !!playerCharacterGroup?.querySelector(
                            `[data-managed-image-card="characterProfileImages||${storyProfileImageId}"]`,
                        ) &&
                        !!shopRaceGroup?.querySelector(
                            `[data-managed-image-card="characterProfileImages||${shopProfileImageId}"]`,
                        ) &&
                        !standaloneGroup?.querySelector(
                            `[data-managed-image-card="characterProfileImages||${storyProfileImageId}"]`,
                        ) &&
                        !!box.querySelector(
                            `[data-managed-image-card="characterProfileImages||${shopProfileImageId}"] .managed-image-select .managed-image-thumbnail`,
                        ),
                    "Manage Images shows every image and groups story player and shop characters by authored shop and species",
                    {
                        text: box?.textContent || "",
                        managedCatalogCount,
                        managedCardCount,
                        hostedOnlyItem,
                        storyGroupText: storyGroup?.textContent || "",
                    },
                );

                const shopImageCard = box?.querySelector(
                    `[data-managed-image-card="characterProfileImages||${shopProfileImageId}"]`,
                );
                shopImageCard?.querySelector(".managed-image-select")?.click();
                devAssert(
                    managedImagesState().selectedKeys.has(
                        `characterProfileImages||${shopProfileImageId}`,
                    ) &&
                        shopImageCard?.querySelector("input[type='checkbox']")?.checked ===
                            true,
                    "clicking anywhere on a managed image selects it through the full thumbnail hitbox",
                );
                toggleManagedImageSelection(
                    `characterProfileImages||${shopProfileImageId}`,
                    false,
                );

                filterManagedImages("first item");
                const firstItemCard = box?.querySelector(
                    `[data-managed-image-card="storyItemImages||${firstItemImageId}"]`,
                );
                const secondItemCard = box?.querySelector(
                    `[data-managed-image-card="storyItemImages||${secondItemImageId}"]`,
                );
                const filteredItemGroup = [...managedImagesState().groupsByKey.entries()]
                    .find(([, keys]) => keys.includes(`storyItemImages||${firstItemImageId}`));
                devAssert(
                    firstItemCard?.hidden === false &&
                        secondItemCard?.hidden === true &&
                        filteredItemGroup?.[1]?.length === 1,
                    "Manage Images name search filters item cards and group deletion targets to displayed matches only",
                    {
                        firstHidden: firstItemCard?.hidden,
                        secondHidden: secondItemCard?.hidden,
                        filteredGroup: filteredItemGroup,
                    },
                );
                toggleAllManagedImages();
                devAssert(
                    managedImagesState().selectedKeys.size === 1 &&
                        managedImagesState().selectedKeys.has(
                            `storyItemImages||${firstItemImageId}`,
                        ) &&
                        firstItemCard?.querySelector("input[type='checkbox']")?.checked === true &&
                        secondItemCard?.querySelector("input[type='checkbox']")?.checked === false &&
                        box?.querySelector("[data-managed-images-select-all]")?.textContent ===
                            "Deselect All Shown",
                    "Manage Images selects only the images displayed by the current search filter",
                );
                toggleAllManagedImages();
                devAssert(
                    managedImagesState().selectedKeys.size === 0 &&
                        firstItemCard?.querySelector("input[type='checkbox']")?.checked === false,
                    "Manage Images deselects only the displayed filtered images",
                );
                filterManagedImages("Managed Story Character");
                devAssert(
                    box?.querySelector(
                        `[data-managed-image-card="characterProfileImages||${storyProfileImageId}"]`,
                    )?.hidden === false &&
                        box?.querySelector(
                            `[data-managed-image-card="storyItemImages||${firstItemImageId}"]`,
                        )?.hidden === true,
                    "Manage Images name search matches a story character's display name without searching image prompts",
                );
                filterManagedImages("Managed scene image");
                devAssert(
                    box?.querySelector(
                        `[data-managed-image-card="storyImages|${sceneSaveId}|${sceneImageId}"]`,
                    )?.hidden === false,
                    "Manage Images name search matches a scene image's displayed place or scene title",
                );
                filterManagedImages("");

                const browserBeforeDelete = box?.querySelector(".managed-images-browser");
                if (browserBeforeDelete) {
                    browserBeforeDelete.style.flex = "0 0 120px";
                    browserBeforeDelete.scrollTop = Math.min(
                        40,
                        Math.max(0, browserBeforeDelete.scrollHeight - browserBeforeDelete.clientHeight),
                    );
                }
                const scrollTopBeforeDelete = browserBeforeDelete?.scrollTop || 0;
                const profileQueueLengthBeforeDelete = app.profileImageQueue?.length || 0;
                await deleteManagedImage(`characterProfileImages||${profileImageId}`);
                const browserAfterDelete = $("modalBox")?.querySelector(".managed-images-browser");
                const profileSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [characterId, "non_male"],
                );
                devAssert(
                    !(await app.persistence.getRecord("characterProfileImages", profileImageId)) &&
                        !(await app.persistence.getRecord("assetBlobs", profileImageId)) &&
                        profileSelection?.imageId === replacementProfileImageId &&
                        managedCharacterRecord.character.profile_image_id === replacementProfileImageId &&
                        managedCharacterRecord.active_profile_image_ids.non_male === replacementProfileImageId &&
                        (app.profileImageQueue?.length || 0) ===
                            profileQueueLengthBeforeDelete &&
                        confirmations.length === 1 &&
                        browserAfterDelete?.scrollTop === scrollTopBeforeDelete,
                    "deleting an active managed profile image atomically selects the newest usable same-presentation image without generating and preserves scroll position",
                    {
                        profileSelection,
                        runtimeProfileImageId: managedCharacterRecord.character.profile_image_id,
                        libraryProfileImageIds: managedCharacterRecord.active_profile_image_ids,
                        profileQueueLengthBeforeDelete,
                        profileQueueLengthAfterDelete: app.profileImageQueue?.length || 0,
                        confirmations,
                        scrollTopBeforeDelete,
                        scrollTopAfterDelete: browserAfterDelete?.scrollTop,
                    },
                );
                await deleteManagedImage(
                    `characterProfileImages||${brokenProfileImageId}`,
                );
                const selectionAfterNonactiveDelete = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [characterId, "non_male"],
                );
                devAssert(
                    selectionAfterNonactiveDelete?.imageId ===
                        replacementProfileImageId &&
                        confirmations.length === 2,
                    "deleting a non-active managed profile image does not change the active replacement",
                    { selectionAfterNonactiveDelete },
                );
                await deleteManagedImage(
                    `characterProfileImages||${replacementProfileImageId}`,
                );
                const finalProfileSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [characterId, "non_male"],
                );
                devAssert(
                    finalProfileSelection?.imageId === null &&
                        !!(await app.persistence.getRecord(
                            "characterProfileImages",
                            oppositeProfileImageId,
                        )) &&
                        (app.profileImageQueue?.length || 0) ===
                            profileQueueLengthBeforeDelete &&
                        confirmations.length === 3,
                    "deleting the final usable presentation image leaves selection empty without choosing a broken or opposite-presentation image and without generating",
                    {
                        finalProfileSelection,
                        runtimeProfileImageId: managedCharacterRecord.character.profile_image_id,
                        profileQueueLengthBeforeDelete,
                        profileQueueLengthAfterDelete: app.profileImageQueue?.length || 0,
                        confirmationCount: confirmations.length,
                    },
                );

                const state = managedImagesState();
                const itemKeys = new Set([
                    `storyItemImages||${firstItemImageId}`,
                    `storyItemImages||${secondItemImageId}`,
                ]);
                const itemGroup = [...state.groupsByKey.entries()].find(([, keys]) =>
                    keys.length === 2 && keys.every((key) => itemKeys.has(key)),
                );
                devAssert(!!itemGroup, "Manage Images creates a deletable group for a story's item images");
                await deleteManagedImageGroup(itemGroup[0]);
                const itemSelection = await app.persistence.getRecord(
                    "storyItemImageSelections",
                    [storyId, "first-item"],
                );
                devAssert(
                    !(await app.persistence.getRecord("storyItemImages", firstItemImageId)) &&
                        !(await app.persistence.getRecord("storyItemImages", secondItemImageId)) &&
                        !(await app.persistence.getRecord("assetBlobs", firstItemImageId)) &&
                        !(await app.persistence.getRecord("assetBlobs", secondItemImageId)) &&
                        itemSelection?.imageId === null &&
                        confirmations.length === 4 &&
                        /all 2 local images/i.test(confirmations[3]?.message || ""),
                    "a managed-image group deletion confirms once and removes every image, blob, and selection in the group",
                    { itemSelection, confirmations },
                );
                await deleteManagedImage(`storyImages|${sceneSaveId}|${sceneImageId}`);
                devAssert(
                    !(await app.persistence.getRecord("storyImages", [sceneSaveId, sceneImageId])) &&
                        !(await app.persistence.getRecord("storyImageTargets", [sceneSaveId, sceneImageId, characterId])) &&
                        !(await app.persistence.getRecord("assetBlobs", sceneImageId)) &&
                        confirmations.length === 5,
                    "an inactive save's scene image can be browsed and deleted with its target and blob records",
                    { confirmations },
                );
                devTestLog(`Scenario complete: ${scenarioId}`);
            } finally {
                showConfirm = priorShowConfirm;
                app.storyTemplates = originalStoryTemplates;
                app.characterDefinitions = originalCharacterDefinitions;
                app.characterLibraryRecordsCache = originalCharacterLibraryRecordsCache;
                await deletePerRecordLibraryRecords(
                    CHARACTER_LIBRARY_KEY,
                    [{ id: managedCharacterRecord.id }],
                ).catch(() => {});
                await app.persistence.deleteManagedImages(references).catch(() => {});
                closeModal({ ignoreCloseDestination: true });
            }
        }

        async function devRunManageCharactersSmokeTest() {
            const scenarioId = "manage-characters-smoke";
            devTestLog(`Scenario start: ${scenarioId}`);
            const nonce = Date.now();
            const first = devSmokeCharacterRecord(`Manage Character A ${nonce}`);
            const second = devSmokeCharacterRecord(`Manage Character B ${nonce}`);
            const firstImageId = `manage-character-a-${nonce}`;
            const secondImageId = `manage-character-b-${nonce}`;
            const secondMaleImageId = `manage-character-b-male-${nonce}`;
            const originalDefinitions = clone(app.characterDefinitions || []);
            const originalProfileImages = clone(app.profileImages || []);
            const originalQueueLength = app.profileImageQueue?.length || 0;
            const originalQueuedSize = app.profileImageQueued?.size || 0;
            const originalGeneratingSize = app.profileImageGenerating?.size || 0;
            const references = [
                { storeName: "characterProfileImages", imageId: firstImageId },
                { storeName: "characterProfileImages", imageId: secondImageId },
                { storeName: "characterProfileImages", imageId: secondMaleImageId },
            ];

            try {
                await savePerRecordLibraryRecords(
                    CHARACTER_LIBRARY_KEY,
                    [first, second],
                );
                app.characterDefinitions = validatedCharacterLibraryDefinitions([
                    ...originalDefinitions,
                    first,
                    second,
                ]);
                app.characterLibraryRecordsCache = null;
                const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
                await app.persistence.putSharedRecords([
                    ...[[firstImageId, first.character.id]].flatMap(
                        ([imageId, characterId]) => [
                            {
                                storeName: "characterProfileImages",
                                record: {
                                    imageId,
                                    characterId,
                                    presentation: "non_male",
                                    favorite: false,
                                },
                            },
                            {
                                storeName: "assetBlobs",
                                record: {
                                    imageId,
                                    blob,
                                    mimeType: "image/png",
                                    byteLength: blob.size,
                                    contentHash: `smoke-${imageId}`,
                                },
                            },
                        ],
                    ),
                ]);

                openManageCharactersModal();
                const box = $("modalBox");
                const firstRecordId = characterLibraryRecordId(first);
                const secondRecordId = characterLibraryRecordId(second);
                devAssert(
                    box?.matches?.("[data-manage-characters-modal='1'][data-fullscreen-list-modal='1']") &&
                        !!box.querySelector(`[data-character-library-id="${cssEscape(firstRecordId)}"]`) &&
                        !!box.querySelector(`[data-character-library-id="${cssEscape(secondRecordId)}"]`) &&
                        box.querySelectorAll(".manage-character-select input[type='checkbox']").length >= 2 &&
                        box.querySelector(".manage-characters-grid")?.style.getPropertyValue(
                            "--character-card-min",
                        ) === "138px",
                    "Manage Characters opens as a fullscreen selectable character-card grid",
                );
                devAssert(
                    (app.profileImageQueue?.length || 0) === originalQueueLength &&
                        (app.profileImageQueued?.size || 0) === originalQueuedSize &&
                        (app.profileImageGenerating?.size || 0) === originalGeneratingSize,
                    "Manage Characters does not queue missing character images",
                );
                const selectAllButton = box.querySelector("[data-toggle-managed-characters]");
                devAssert(
                    selectAllButton?.textContent === "Select All",
                    "Manage Characters starts with a Select All action when nothing is selected",
                );
                toggleAllManagedCharacters();
                devAssert(
                    manageCharactersState().selectedIds.size ===
                        box.querySelectorAll(".manage-character-select input[type='checkbox']").length &&
                        [...box.querySelectorAll(".manage-character-select input[type='checkbox']")]
                            .every((input) => input.checked) &&
                        selectAllButton?.textContent === "Deselect All",
                    "Select All selects every managed character and changes to Deselect All",
                );
                toggleAllManagedCharacters();
                devAssert(
                    manageCharactersState().selectedIds.size === 0 &&
                        [...box.querySelectorAll(".manage-character-select input[type='checkbox']")]
                            .every((input) => !input.checked) &&
                        selectAllButton?.textContent === "Select All",
                    "Deselect All clears every managed character selection",
                );

                openManagedCharacterDetail(firstRecordId);
                devAssert(
                    !!document.querySelector(`[data-character-library-detail="${cssEscape(firstRecordId)}"]`),
                    "a managed character card opens the standard character-library detail popup",
                );
                closeCharacterLibraryDefinitionLayers(firstRecordId);

                toggleManagedCharacterSelection(firstRecordId, true);
                const firstDelete = deleteSelectedManagedCharacters();
                await Promise.resolve();
                const firstConfirm = [...document.querySelectorAll(".popup-modal.open")].at(-1);
                const firstImageCheckbox = firstConfirm?.querySelector("[data-delete-character-images]");
                devAssert(
                    !!firstImageCheckbox && firstImageCheckbox.checked === false,
                    "the bulk character deletion confirmation leaves image deletion unchecked by default",
                );
                firstConfirm.querySelector("#confirmYesBtn").click();
                await firstDelete;
                devAssert(
                    !characterLibraryRecordById(firstRecordId) &&
                        !!(await app.persistence.getRecord("characterProfileImages", firstImageId)),
                    "bulk character deletion preserves owned images when the image checkbox is not selected",
                );

                const secondRecord = characterLibraryRecordById(secondRecordId);
                secondRecord.active_profile_image_ids = {
                    male: secondMaleImageId,
                    non_male: secondImageId,
                };
                const profileDataUrl = devSmokeOnePixelDataUrl();
                const secondPresentationImages = [
                    createProfileImageRecord({
                        id: secondImageId,
                        character_id: second.character.id,
                        owner_name: second.name,
                        male: false,
                        html: `<img src="${profileDataUrl}" alt="Managed non-male profile">`,
                    }),
                    createProfileImageRecord({
                        id: secondMaleImageId,
                        character_id: second.character.id,
                        owner_name: second.name,
                        male: true,
                        html: `<img src="${profileDataUrl}" alt="Managed male profile">`,
                    }),
                ];
                app.profileImages = exactProfileImageStore([
                    ...secondPresentationImages,
                    ...(app.profileImages || []),
                ]);
                const profileQueueKey =
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`;
                app.work.enqueueOrdered(
                    profileQueueKey,
                    "manage characters pending profile write smoke gate",
                    () => new Promise((resolve) => setTimeout(resolve, 75)),
                );
                saveProfileImageRecordsNow(
                    secondPresentationImages,
                    "manage characters two-presentation deletion smoke",
                    { selectProfileImages: true },
                );
                toggleManagedCharacterSelection(secondRecordId, true);
                const secondDelete = deleteSelectedManagedCharacters();
                await Promise.resolve();
                const secondConfirm = [...document.querySelectorAll(".popup-modal.open")].at(-1);
                secondConfirm.querySelector("[data-delete-character-images]").checked = true;
                secondConfirm.querySelector("#confirmYesBtn").click();
                await secondDelete;
                devAssert(
                    !characterLibraryRecordById(secondRecordId) &&
                        !(await app.persistence.getRecord("characterProfileImages", secondImageId)) &&
                        !(await app.persistence.getRecord("assetBlobs", secondImageId)) &&
                        !(await app.persistence.getRecord(
                            "characterProfileImages",
                            secondMaleImageId,
                        )) &&
                        !(await app.persistence.getRecord("assetBlobs", secondMaleImageId)),
                    "bulk character deletion flushes pending image writes and removes both male and non-male presentation images when explicitly selected",
                );
                devTestLog(`Scenario complete: ${scenarioId}`);
            } finally {
                closeCharacterLibraryDefinitionLayers();
                closeModal({ ignoreCloseDestination: true });
                await app.persistence.deleteManagedImages(references).catch(() => {});
                await devRestoreCharacterDefinitionsForSmoke(
                    originalDefinitions,
                    "manage characters smoke restored",
                );
                app.profileImages = exactProfileImageStore(originalProfileImages);
                app.characterLibraryRecordsCache = null;
            }
        }

