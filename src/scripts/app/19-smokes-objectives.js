
        async function devRunStoryTimelinePacingSmokeTest() {
            devTestLog("Scenario start: story-timeline-pacing-smoke");
            devResetForLiveTest("story-timeline-pacing-smoke");
            devCreateTestProfile({  });
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Story Timeline Pacing Smoke",
                    },
                },
                story_clock: {
                    elapsed_minutes: 0,
                },
                story_pacing: {
                    mode: "time_controlled",
                    timeline: {
                        "city-siege": {
                            id: "city-siege",
                            title: "City Siege",
                            status: "waiting",
                            objective_id: "defend-city",
                            trigger: {
                                at_elapsed_minutes: 60,
                            },
                            prompt: {
                                message: "The city siege begins.",
                                accept_label: "Defend City",
                                decline_label: "Stay Away",
                            },
                            accept: {
                                objective_id: "defend-city",
                            },
                        },
                        "bridge-ambush": {
                            id: "bridge-ambush",
                            title: "Bridge Ambush",
                            status: "waiting",
                            objective_id: "hold-bridge",
                            trigger: {
                                at_elapsed_minutes: 90,
                            },
                            accept: {
                                objective_id: "hold-bridge",
                            },
                            missed_due_to_conflict: {
                                message: "The bridge ambush happened while the city siege demanded your attention.",
                                rewards: [
                                    {
                                        type: "add_story_rule",
                                        rule_id: "bridge_ambush_missed",
                                        text: "The bridge ambush was missed during the city siege.",
                                    },
                                ],
                            },
                        },
                    },
                },
                objectives: {
                    active_id: "free-main",
                    focus_id: "",
                    items: [
                        {
                            id: "free-main",
                            title: "Free Main",
                            type: "story",
                            status: "active",
                            summary: "Free main objective.",
                        },
                        {
                            id: "defend-city",
                            title: "Defend the City",
                            type: "story",
                            status: "future",
                            available_now: false,
                            summary: "Time-locked city defense.",
                        },
                        {
                            id: "hold-bridge",
                            title: "Hold the Bridge",
                            type: "story",
                            status: "future",
                            available_now: false,
                            summary: "Conflicting bridge event.",
                        },
                        {
                            id: "side-errand",
                            title: "Side Errand",
                            type: "side",
                            kind: "side",
                            status: "active",
                            summary: "Optional work.",
                        },
                    ],
                },
            });

            await devCompileCurrentStoryFixture("story-timeline-pacing-smoke");
            advanceStoryTime(app.state, 60, "timeline smoke wait");
            devAssert(processStoryTimeline(app.state, "timeline smoke first tick"), "timeline event becomes ready");
            devAssert(
                app.state.story_pacing.timeline["city-siege"].status === "ready" &&
                    app.state.story_pacing.pending_event_id === "city-siege",
                "timeline ready event is pending for player decision",
                app.state.story_pacing,
            );
            devAssert(acceptTimelineEvent("city-siege", { renderAfter: false }), "accepting timeline event starts it");
            const locked = currentTimeLockedObjective(app.state);
            devAssert(
                locked?.id === "defend-city" &&
                    locked.locked_until_complete === true &&
                    !Object.hasOwn(locked, "objective_mode") &&
                    !Object.hasOwn(locked, "timeline_event_id") &&
                    app.state.objectives.active_id === "defend-city",
                "accepted timeline event locks and selects its objective",
                { locked, objectives: app.state.objectives },
            );
            setObjectiveFocus("side-errand", { suppressNotice: true, close: false, renderAfter: false });
            devAssert(
                app.state.objectives.active_id === "defend-city" &&
                    app.state.objectives.focus_id !== "side-errand",
                "time-locked objective prevents switching to a side objective",
                app.state.objectives,
            );
            const beforeBlockedTime = storyClockElapsedMinutes(app.state);
            devAssert(
                !advanceTimeReward(
                    app.state,
                    { minutes: 30, reason: "side errand while locked" },
                    { id: "side-errand", title: "Side Errand" },
                ),
                "unrelated objective cannot advance time during time-locked event",
            );
            devAssert(
                storyClockElapsedMinutes(app.state) === beforeBlockedTime,
                "blocked time advance does not change story clock",
                app.state.story_clock,
            );
            devAssert(
                advanceTimeReward(
                    app.state,
                    { minutes: 15, reason: "fighting through the siege" },
                    locked,
                ),
                "time-locked objective can advance its own time",
            );
            advanceStoryTime(app.state, 15, "timeline smoke conflict tick");
            devAssert(processStoryTimeline(app.state, "timeline smoke conflict"), "conflicting event is processed");
            devAssert(
                app.state.story_pacing.timeline["bridge-ambush"].status === "missed" &&
                    app.state.story_rules.some((rule) => rule.id === "bridge_ambush_missed") &&
                    Object.keys(app.rewardRuntime.appliedInvocationIds || {}).some((id) =>
                        id.startsWith(
                            "timeline-event-bridge-ambush--site-missed--reward-",
                        ),
                    ),
                "conflicting timed story event is missed with an exact-site atomic reward marker",
                {
                    pacing: app.state.story_pacing,
                    rules: app.state.story_rules,
                },
            );
            addMessage("system", "Story timeline pacing smoke test passed.");
            showNotice("Live Test Passed", "Story timeline pacing smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: story-timeline-pacing-smoke");
        }

        async function devRunFutureCastUnlockDisciplineSmokeTest() {
            devTestLog("Scenario start: future-cast-unlock-discipline-smoke");
            devResetForLiveTest("future-cast-unlock-discipline-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: future-cast identities are reserved template data.
            // New-NPC extraction must not create them early; objective rewards are
            // the controlled path that turns a future-cast entry into a real NPC.
            const roxanneFull = blankCharacterTemplate("Roxanne Teller");
            roxanneFull.gender = "female";
            roxanneFull.age = 25;
            roxanneFull.role = "future companion";
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Future Cast Smoke",
                    },
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "market-office",
                    settlement_name: "Vale",
                    specific_place: "market office",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Future Tester",
                    age: 24,
                    gender: "male",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
                future_cast: {
                    enabled: true,
                    items: {
                        roxanne: {
                            id: "roxanne",
                            name: "Roxanne Teller",
                            age: 25,
                            gender: "female",
                            role: "future companion",
                            full_character: roxanneFull,
                            greeting: "I am Roxanne Teller.",
                            status: "future",
                            location_hint: "market office",
                            npc_location_id: "market-office",
                        },
                    },
                },
                objectives: {
                    active_id: "introduce-roxanne",
                    focus_id: "introduce-roxanne",
                    items: [
                        {
                            id: "introduce-roxanne",
                            title: "Introduce Roxanne",
                            type: "story",
                            status: "active",
                            summary: "Reach the story point that introduces Roxanne.",
                            completion_control: "player",
                            completion_criteria:
                                "Reach the story point that introduces Roxanne.",
                            rewards: [
                                {
                                    type: "introduce_future_character",
                                    character_id: "roxanne",
                                    npc_location_id: "market-office",
                                    scene_presence: "nearby",
                                },
                            ],
                        },
                    ],
                },
            });
            app.messages = [];

            await devCompileCurrentStoryFixture("future-cast-unlock-discipline-smoke");
            scheduleActiveGameSave();
            render();

            devAssert(
                isInvalidNpcName("Roxanne", app.state) &&
                    isInvalidNpcName("Roxanne Teller", app.state),
                "future-cast names and first-name variants are invalid new-NPC names before unlock",
                { futureCast: app.state.future_cast },
            );
            const duplicateParsed = peopleDataToParsedMetadata({
                new_npcs: [
                    {
                        full_name: "Roxanne",
                        gender: "female",
                        age: 25,
                        role: "slave",
                    },
                    {
                        full_name: "Roxanne Teller",
                        gender: "female",
                        age: 25,
                        role: "slave",
                    },
                ],
            });
            devAssert(
                !Object.keys(duplicateParsed.newSpeakers || {}).length &&
                    !getNpcEntry("Roxanne Teller", "market-office"),
                "future-cast duplicate NPC metadata is rejected before objective unlock",
                { duplicateParsed, npcDirectory: app.state.npc_directory },
            );

            const beforeState = clone(app.state);
            app.state.objectives.items[0].status = "complete";
            const rewardResult = applyObjectiveProgressRewards(
                beforeState,
                app.state,
                "future-cast-unlock-discipline-smoke",
                { silentGameMessage: true },
            );
            assertRuntimeObjectivesAndProgression(app.state);
            const roxanneNpc = getNpcEntry("Roxanne Teller", "market-office");
            devAssert(
                rewardResult?.applied &&
                    roxanneNpc?.future_character_id === "roxanne" &&
                    app.state.future_cast.items.roxanne?.status === "introduced" &&
                    app.state.future_cast.items.roxanne?.scene_presence === "nearby" &&
                    !(app.state.scene.npcs_present || []).includes("Roxanne Teller") &&
                    !(app.state.scene.party_members_present || []).includes(
                        "Roxanne Teller",
                    ),
                "canonical nearby future-cast presence creates an NPC outside the active scene and party",
                {
                    rewardResult,
                    roxanneNpc,
                    futureCast: app.state.future_cast.items.roxanne,
                    scene: app.state.scene,
                },
            );
            addMessage("system", "Future-cast unlock discipline smoke test passed.");
            showNotice(
                "Live Test Passed",
                "Future-cast unlock discipline smoke test passed.",
            );
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: future-cast-unlock-discipline-smoke");
        }

        async function devRunSpeakerNpcRepairSmokeTest() {
            devTestLog("Scenario start: speaker-npc-repair-smoke");
            devResetForLiveTest("speaker-npc-repair-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: speaker extraction may provide voice hints, but
            // every non-player speaking person who does not already exist must be
            // represented as a real NPC after the repair/new_npcs path.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Speaker NPC Repair Smoke",
                    },
                },
                location: {
                    ...clone(defaultState.location || {}),
                    settlement_name: "Repair Village",
                    specific_place: "repair square",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Repair Tester",
                    age: 25,
                    gender: "female",
                },
                characters: {
                    "Known Ally": {
                        ...blankCharacterTemplate("Known Ally"),
                        age: 27,
                        gender: "female",
                        role: "known party ally",
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Known Ally"],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
            });
            app.messages = [
                {
                    id: "speaker-repair-message",
                    entryId: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: '(Seren Vale) "Hold there." Known Ally watches.',
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();

            const missingSpeaker = missingRequiredTaggedSpeakers(
                {
                    speakers: [{ full_name: "Seren Vale", gender: "female" }],
                    new_npcs: [],
                },
                [{ name: "Seren Vale", gender: "female" }],
            );
            devAssert(
                missingSpeaker.length === 1,
                "speaker-only metadata does not satisfy missing new speaking NPC creation",
                { missingSpeaker },
            );
            const skippedInvalidName = missingRequiredTaggedSpeakers(
                {
                    new_npcs: [{ invalid_name: "Guild" }],
                },
                [{ name: "Guild", gender: "neutral" }],
            );
            devAssert(
                !skippedInvalidName.length &&
                    isInvalidGeneratedPersonName("Guild"),
                "invalid_name metadata resolves non-character labels and single-word generated names are rejected",
                { skippedInvalidName },
            );

            const rejectedGeneric = peopleDataToParsedMetadata({
                speakers: [{ full_name: "Unknown Woman", gender: "female" }],
                new_npcs: [
                    {
                        full_name: "Bandit Leader",
                        gender: "male",
                        age: 30,
                        role: "bandit leader",
                    },
                    {
                        full_name: "Mercenary Woman",
                        gender: "female",
                        age: 31,
                        role: "mercenary woman",
                    },
                    {
                        full_name: "Gat Guard Tomas",
                        gender: "male",
                        age: 34,
                        role: "gate guard",
                    },
                    {
                        full_name: "Guard Tomas",
                        gender: "male",
                        age: 34,
                        role: "guard",
                    },
                    {
                        full_name: "Known",
                        gender: "female",
                        age: 27,
                        role: "ally",
                    },
                ],
            });
            devAssert(
                    !Object.keys(rejectedGeneric.speak || {}).length &&
                    !Object.keys(rejectedGeneric.newSpeakers || {}).length &&
                    isInvalidGeneratedPersonName("Mercenary Woman") &&
                    isInvalidGeneratedPersonName("Gat Guard Tomas") &&
                    isInvalidGeneratedPersonName("Guard Tomas"),
                "generic names, title words, three-word names, and first-name duplicates are rejected from speaker/NPC metadata",
                {
                    rejectedGeneric,
                    mercenaryInvalid: isInvalidGeneratedPersonName("Mercenary Woman"),
                    threeWordInvalid: isInvalidGeneratedPersonName("Gat Guard Tomas"),
                    titleWordInvalid: isInvalidGeneratedPersonName("Guard Tomas"),
                },
            );

            const repairedMetadata = peopleDataToParsedMetadata({
                speakers: [{ full_name: "Seren Vale", gender: "female" }],
                new_npcs: [
                    {
                        full_name: "Seren Vale",
                        gender: "female",
                        age: 29,
                        role: "gate scout",
                        appearance: "alert scout in leather armor",
                        personality: "protective and direct",
                    },
                ],
            });
            applyAssistantMessageMetadata(
                "speaker-repair-message",
                repairedMetadata,
                { save: false },
            );
            const serenNpc = getNpcEntry("Seren Vale", "repair square");
            devAssert(
                serenNpc?.name === "Seren Vale" &&
                    serenNpc?.role === "gate scout" &&
                    (app.state.scene.npcs_present || []).includes("Seren Vale") &&
                    speakerExistsAsEntity("Seren Vale"),
                "repaired speaker metadata creates the missing speaker as a real nearby NPC",
                {
                    serenNpc,
                    scene: app.state.scene,
                    npcDirectory: app.state.npc_directory,
                },
            );

            const descriptorMessage = {
                id: "descriptor-speaker-repair-message",
                entryId: nextEntryId(),
                role: "assistant",
                speaker: "Narrator",
                text: 'The servant woman lowers her eyes. "Ten years, sir."',
                voiceText:
                    'The servant woman lowers her eyes. (Servant Woman) "Ten years, sir."',
                at: new Date().toISOString(),
            };
            app.messages.push(descriptorMessage);
            rebuildMessageIndex();
            const descriptorSpeakers = extractInlineVoiceTagSpeakers(
                descriptorMessage.voiceText,
            );
            devAssert(
                descriptorSpeakers.length === 1 &&
                    descriptorSpeakers[0].name === "Servant Woman" &&
                    descriptorSpeakers[0].unresolvedDescriptor === true,
                "role-described voice tag is preserved as unresolved speaker metadata",
                { descriptorSpeakers },
            );
            const descriptorMissing = missingRequiredTaggedSpeakers(
                {},
                descriptorSpeakers,
            );
            devAssert(
                descriptorMissing.length === 1 &&
                    descriptorMissing[0].name === "Servant Woman",
                "role-described voice tag requires NPC repair instead of being dropped",
                { descriptorMissing },
            );
            const descriptorParsed = peopleDataToParsedMetadata(
                {
                    new_npcs: [
                        {
                            original_name: "Servant Woman",
                            full_name: "Mira Vell",
                            gender: "female",
                            age: 31,
                            role: "servant",
                            appearance: "tired palace servant in a plain work dress",
                            personality: "cautious and deferential",
                        },
                    ],
                },
                descriptorSpeakers,
            );
            applyAssistantMessageMetadata(
                "descriptor-speaker-repair-message",
                descriptorParsed,
                { save: false },
            );
            const miraNpc = getNpcEntry("Mira Vell", "repair square");
            const descriptorVoicePart = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(
                    descriptorMessage.voiceText,
                ),
                "descriptor-speaker-repair-message",
            ).find((part) => part.kind === "dialogue");
            devAssert(
                miraNpc?.name === "Mira Vell" &&
                    miraNpc?.role === "servant" &&
                    (app.state.scene.npcs_present || []).includes("Mira Vell") &&
                    descriptorMessage.voiceMeta
                        ?.aliases?.["Servant Woman"] === "Mira Vell" &&
                    descriptorVoicePart?.speaker === "Mira Vell",
                "role-described speaker repair invents a proper NPC and maps voice to the stored name",
                {
                    miraNpc,
                    voiceMeta: descriptorMessage.voiceMeta,
                    descriptorVoicePart,
                    scene: app.state.scene,
                },
            );

            app.state.characters["Offscene Ally"] = {
                ...blankCharacterTemplate("Offscene Ally"),
                age: 28,
                gender: "female",
                role: "offscene party ally",
            };
            ensureNpcEntry("Lena Rowe", {
                gender: "female",
                age: 32,
                role: "local witness",
                relationship: "neutral",
                note: "Known local NPC used for speaker scene-presence smoke coverage.",
            });
            app.state.scene.party_members_present = ["Known Ally"];
            app.state.scene.npcs_present = [];
            applyAssistantMessageMetadata("speaker-repair-message", {
                voiceComplete: true,
                speak: {
                    A: "Offscene Ally",
                    B: "Lena Rowe",
                },
                newSpeakers: {},
            });
            devAssert(
                (app.state.scene.party_members_present || []).includes("Offscene Ally") &&
                    (app.state.scene.npcs_present || []).includes("Lena Rowe"),
                "known off-scene speakers are added to the correct current scene presence lists",
                { scene: app.state.scene },
            );

            addMessage("system", "Speaker NPC repair smoke test passed.");
            showNotice("Live Test Passed", "Speaker NPC repair smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: speaker-npc-repair-smoke");
        }

        async function devRunMessageActionsSmokeTest() {
            devTestLog("Scenario start: message-actions-smoke");
            devResetForLiveTest("message-actions-smoke");
            devCreateTestProfile({  });
            clearVoiceMessageRuntimeState();
            app.failedSpeechVoiceNames = new Set();
            const partialVoiceTagDisplay = parseAssistantResponseMetadata(
                'The guard turns toward you. (Captain Ro',
                { partial: true },
            ).visibleText;
            const completeVoiceTagDisplay = parseAssistantResponseMetadata(
                'The guard turns toward you. (Captain Rowan) "Stand aside."',
                { partial: false },
            ).visibleText;
            devAssert(
                partialVoiceTagDisplay === "The guard turns toward you." &&
                    !/\(Captain Rowan\)/.test(completeVoiceTagDisplay) &&
                    /Stand aside\./.test(completeVoiceTagDisplay),
                "streaming chat hides an incomplete trailing voice tag but shows it once complete",
                { partialVoiceTagDisplay, completeVoiceTagDisplay },
            );
            // SANITIZE KEEP (dev fixture): synthetic message-action state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Message Action Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Message Tester",
                    age: 24,
                    gender: "male",
                    role: "message auditor",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Message action test room.",
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                objectives: {
                    active_id: "message-test",
                    items: [
                        {
                            id: "message-test",
                            title: "Test Message Actions",
                            type: "story",
                            status: "active",
                            summary: "Smoke test message controls.",
                            objective: "Use local message actions.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            await devCompileCurrentStoryFixture("message-actions-smoke");
            app.messages = [
                {
                    id: "user-smoke",
                    entryId: nextEntryId(),
                    role: "user",
                    speaker: "Message Tester",
                    text: "Pending user message for edit prompt.",
                    at: new Date().toISOString(),
                    stateSyncStatus: "pending",
                },
                {
                    id: "assistant-smoke",
                    entryId: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Pending assistant message for regenerate prompt.",
                    at: new Date().toISOString(),
                    replySource: "user",
                    stateSyncStatus: "pending",
                },
                {
                    id: "continue-smoke",
                    entryId: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Pending assistant continuation message.",
                    at: new Date().toISOString(),
                    replySource: "continue",
                    stateSyncStatus: "pending",
                },
                {
                    id: "processed-smoke",
                    entryId: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Processed assistant message with no backup.",
                    at: new Date().toISOString(),
                    replySource: "user",
                    stateSyncStatus: "synced",
                },
                {
                    id: "backup-smoke",
                    entryId: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Processed assistant message with a state backup.",
                    at: new Date().toISOString(),
                    replySource: "continue",
                    stateSyncStatus: "synced",
                },
                {
                    id: "game-smoke",
                    entryId: nextEntryId(),
                    role: "game",
                    speaker: "Game",
                    text: "Game message for delete confirmation.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();
            devAssert(
                !$("undoBtn") && !$("snapshotsToolBtn"),
                "general Undo and Snapshots tools are not rendered",
            );
            app.cancelledAiMessageIds.add("user-smoke");
            app.cancelledAiMessageIds.add("missing-related-smoke");
            clearStaleAiCancellationForMessage("assistant-smoke");
            clearStaleAiCancellationForExistingMessages([
                "user-smoke",
                "missing-related-smoke",
            ]);
            devAssert(
                !app.cancelledAiMessageIds.has("user-smoke") &&
                    app.cancelledAiMessageIds.has("missing-related-smoke"),
                "fresh replies clear stale cancellation tokens for existing related messages without clearing genuinely missing/deleted messages",
                { cancelledIds: [...app.cancelledAiMessageIds] },
            );
            app.cancelledAiMessageIds.delete("missing-related-smoke");
            app.queue = [
                {
                    text: "Queued message one.",
                    visibleText: "Queued message one.",
                    source: "user",
                    speaker: "Message Tester",
                },
                {
                    text: "Queued message two.",
                    visibleText: "Queued message two.",
                    source: "user",
                    speaker: "Message Tester",
                },
            ];
            render();
            const queuedDeleteButton = document.querySelector(
                ".queued-message[data-queue-index='0'] button[title='Delete queued message']",
            );
            devAssert(
                !!queuedDeleteButton,
                "queued messages render delete controls",
                { queueHtml: [...document.querySelectorAll(".queued-message")].map((node) => node.outerHTML) },
            );
            queuedDeleteButton.click();
            await new Promise((resolve) => setTimeout(resolve, 50));
            devAssert(
                app.queue.length === 1 &&
                    exactQueueItem(app.queue[0]).visibleText === "Queued message two.",
                "delete queued message removes only the selected queued item",
                { queue: app.queue },
            );
            app.queue = [];
            render();
            const messageActionSmokeMessages = clone(app.messages);
            app.state.scene.summary = "Pre-message backup summary.";
            createMessageStateBackup(["backup-smoke"], "message backup smoke");
            app.state.scene.summary = "Post-message mutated summary.";
            const restored = restoreMessageMutationBackup(
                findMessageById("backup-smoke"),
                "message backup smoke restore",
            );
            devAssert(
                restored?.restored === true &&
                    app.state.scene.summary === "Pre-message backup summary.",
                "message-bound state backup restores pre-message state",
                {
                    restored,
                    scene: app.state.scene,
                },
            );
            app.messages = messageActionSmokeMessages;
            app.state.scene.summary = "Message action test room.";
            app.mainMenuOpen = false;
            scheduleActiveGameSave();
            render();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const actionButton = (messageId, actionName) => {
                const card = document.querySelector(
                    `[data-message-id="${cssEscape(messageId)}"]`,
                );
                devAssert(!!card, `${messageId} message card renders`, {
                    wantedMessageId: messageId,
                    messageIds: (app.messages || []).map((message) => message.id),
                    visibleIds: visibleMessagesForRender().map((message) => message.id),
                    threadHtmlStart: String($("thread")?.innerHTML || "").slice(0, 1200),
                    mainMenuOpen: app.mainMenuOpen,
                });
                return [...card.querySelectorAll("button")].find((button) =>
                    String(button.getAttribute("onclick") || "").includes(actionName),
                );
            };

            const editButton = actionButton("user-smoke", "editMessage");
            devAssert(!!editButton && !editButton.disabled, "pending user edit button is enabled");
            const editPromise = editMessage("user-smoke");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Edit Message/i.test(document.body.textContent || "") &&
                    !!document.querySelector(".popup-modal #styledPromptInput"),
                "Edit Message opens visible prompt",
            );
            document.querySelector(".popup-modal #promptCancelBtn").click();
            await editPromise;
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                findMessageById("user-smoke")?.text ===
                    "Pending user message for edit prompt.",
                "Edit Message cancel leaves message unchanged",
                findMessageById("user-smoke"),
            );

            const regenButton = actionButton(
                "assistant-smoke",
                "openRegenerateMessageModal",
            );
            devAssert(
                !!regenButton && !regenButton.disabled,
                "pending assistant regenerate button is enabled",
            );
            const normalAssistantDelete = actionButton("assistant-smoke", "deleteMessage");
            const continueAssistantDelete = actionButton("continue-smoke", "deleteMessage");
            devAssert(
                !normalAssistantDelete &&
                    !!continueAssistantDelete &&
                    !continueAssistantDelete.disabled,
                "assistant delete is hidden for normal replies and shown for Continue replies",
                {
                    normalAssistantDelete: !!normalAssistantDelete,
                    continueAssistantDelete: !!continueAssistantDelete,
                    continueDisabled: continueAssistantDelete?.disabled,
                },
            );
            openRegenerateMessageModal("assistant-smoke");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Regenerate Message/i.test($("modalBox")?.textContent || "") &&
                    !!$("regenerateFeedback"),
                "Regenerate Message opens feedback modal without sending AI",
            );
            closeModal();

            const savedAiActiveForStopGenerating = app.aiActive;
            const savedCancelledForStopGenerating = new Set(
                app.cancelledAiMessageIds || [],
            );
            const savedActiveVoiceForStopGenerating = app.activeVoiceMessageId;
            try {
                const assistantMessage = findMessageById("assistant-smoke");
                assistantMessage.text = "";
                app.aiActive = {
                    label: "character reply",
                    logType: "reply",
                    streamedChars: 0,
                    opts: {
                        messageId: "assistant-smoke",
                        onStream: () => {},
                    },
                };
                renderThread();
                const generatingBeforeTextEdit = actionButton(
                    "assistant-smoke",
                    "editMessage",
                );
                const generatingBeforeTextStop = actionButton(
                    "assistant-smoke",
                    "stopGeneratingMessage",
                );
                devAssert(
                    !generatingBeforeTextEdit &&
                        !generatingBeforeTextStop &&
                        messageIsGenerating("assistant-smoke") &&
                        !messageIsActivelyGenerating("assistant-smoke"),
                    "assistant messages hide Edit while generation is active before streamed text arrives, but do not show Stop Generating until text is streaming",
                    {
                        hasEdit: !!generatingBeforeTextEdit,
                        hasStop: !!generatingBeforeTextStop,
                        aiActive: app.aiActive,
                    },
                );
                assistantMessage.text = "Partial streaming assistant text.";
                app.activeVoiceMessageId = "assistant-smoke";
                app.aiActive = {
                    label: "character reply",
                    logType: "reply",
                    streamedChars: assistantMessage.text.length,
                    opts: {
                        messageId: "assistant-smoke",
                        onStream: () => {},
                    },
                };
                renderThread();
                const streamingEdit = actionButton("assistant-smoke", "editMessage");
                const streamingStop = actionButton(
                    "assistant-smoke",
                    "stopGeneratingMessage",
                );
                const streamingRegenerate = actionButton(
                    "assistant-smoke",
                    "openRegenerateMessageModal",
                );
                devAssert(
                    !streamingEdit &&
                        !!streamingStop &&
                        !!streamingRegenerate &&
                        messageIsActivelyGenerating("assistant-smoke"),
                    "currently streaming assistant messages hide Edit, show Stop Generating, and still allow Regenerate",
                    {
                        hasEdit: !!streamingEdit,
                        hasStop: !!streamingStop,
                        hasRegenerate: !!streamingRegenerate,
                        aiActive: app.aiActive,
                    },
                );
                app.aiActive = {
                    label: "character reply",
                    logType: "reply",
                    streamedChars: findMessageById("user-smoke")?.text?.length || 1,
                    opts: {
                        messageId: "user-smoke",
                        onStream: () => {},
                    },
                };
                renderThread();
                const playerStopGenerating = actionButton(
                    "user-smoke",
                    "stopGeneratingMessage",
                );
                devAssert(
                    !playerStopGenerating,
                    "player messages never show Stop Generating controls even if an active AI id is wrong",
                    {
                        hasPlayerStopGenerating: !!playerStopGenerating,
                        aiActive: app.aiActive,
                    },
                );
                app.aiActive = {
                    label: "character reply",
                    logType: "reply",
                    streamedChars: assistantMessage.text.length,
                    opts: {
                        messageId: "assistant-smoke",
                        onStream: () => {},
                    },
                };
                renderThread();
                const stopped = stopGeneratingMessage("assistant-smoke");
                devAssert(
                    stopped &&
                        app.aiActive?.opts?.cancelled === true &&
                        app.cancelledAiMessageIds.has("assistant-smoke") &&
                        findMessageById("assistant-smoke")?.text ===
                            "Partial streaming assistant text." &&
                        findMessageById("assistant-smoke")?.generationStopped === true &&
                        app.stoppedVoiceMessageIds.has("assistant-smoke"),
                    "Stop Generating cancels the active stream, keeps only the text already received, and stops extending narration",
                    {
                        stopped,
                        aiActive: app.aiActive,
                        message: findMessageById("assistant-smoke"),
                        activeVoiceMessageId: app.activeVoiceMessageId,
                    },
                );
            } finally {
                app.aiActive = savedAiActiveForStopGenerating;
                app.cancelledAiMessageIds = savedCancelledForStopGenerating;
                app.activeVoiceMessageId = savedActiveVoiceForStopGenerating;
                const assistantMessage = findMessageById("assistant-smoke");
                if (assistantMessage) {
                    assistantMessage.text = "Pending assistant reply for regenerate.";
                    delete assistantMessage.generationStopped;
                }
                renderThread();
            }

            if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
                resetVoiceSpeechQueue();
                app.activeVoiceMessageId = "opening-reader-race-smoke";
                app.activeVoiceStartedAt = Date.now() - 5000;
                app.voiceUtteranceQueue = [{
                    text: "Queued continuation.",
                    generation: Number(app.voiceUtteranceGeneration || 0),
                    messageId: "opening-reader-race-smoke",
                }];
                clearIdleVoiceState();
                devAssert(
                    app.voiceUtteranceQueue.length === 1 &&
                        app.voiceUtteranceCurrent == null &&
                        app.voiceUtterancePumpTimer != null,
                    "voice idle watchdog preserves queued opening-message segments and restarts the pump between utterances",
                    {
                        queued: app.voiceUtteranceQueue.length,
                        current: app.voiceUtteranceCurrent?.messageId || null,
                        pumpScheduled: app.voiceUtterancePumpTimer != null,
                    },
                );
                resetVoiceSpeechQueue();
                app.activeVoiceMessageId = null;
                app.activeVoiceStartedAt = 0;
                app.voicePaused = true;
                enqueueVoiceUtterance({
                    text: "First queued segment.",
                    voice: loadVoices()[0] || null,
                    rate: 1,
                    pitch: 1,
                    messageId: "user-smoke",
                });
                enqueueVoiceUtterance({
                    text: "Second queued segment.",
                    voice: loadVoices()[0] || null,
                    rate: 1,
                    pitch: 1,
                    messageId: "assistant-smoke",
                });
                await new Promise((resolve) => setTimeout(resolve, 20));
                devAssert(
                    app.voiceUtteranceQueue.length === 2 &&
                        app.voiceUtteranceCurrent == null &&
                        app.activeVoiceMessageId == null,
                    "voice segments remain in the application queue and do not show active reading before the browser starts an utterance",
                    {
                        queued: app.voiceUtteranceQueue.length,
                        current: app.voiceUtteranceCurrent?.messageId || null,
                        activeVoiceMessageId: app.activeVoiceMessageId,
                    },
                );
                app.voicePaused = false;
                resetVoiceSpeechQueue();
                readMessage("user-smoke");
                await new Promise((resolve) => setTimeout(resolve, 30));
                const userCard = document.querySelector(
                    `[data-message-id="${cssEscape("user-smoke")}"]`,
                );
                const assistantCard = document.querySelector(
                    `[data-message-id="${cssEscape("assistant-smoke")}"]`,
                );
                // Voice availability differs across test browsers. Only assert
                // reader button placement when speech actually starts; message
                // mutation coverage below must still run without local voices.
                if (String(app.activeVoiceMessageId || "") === "user-smoke") {
                    devAssert(
                        !!userCard?.querySelector(
                            `button[onclick*="stopReadingMessage"]`,
                        ) &&
                            !assistantCard?.querySelector(
                                `button[onclick*="stopReadingMessage"]`,
                            ),
                        "read sequence stop button stays on the message currently being read",
                        {
                            activeVoiceMessageId: app.activeVoiceMessageId,
                            userHasStop: !!userCard?.querySelector(
                                `button[onclick*="stopReadingMessage"]`,
                            ),
                            assistantHasStop: !!assistantCard?.querySelector(
                                `button[onclick*="stopReadingMessage"]`,
                            ),
                        },
                    );
                    window.speechSynthesis.cancel();
                    stopReadingMessage(false);
                    await new Promise((resolve) => setTimeout(resolve, 150));

                    readMessage("assistant-smoke");
                    await new Promise((resolve) => setTimeout(resolve, 20));
                    stopReadingMessage(false);
                    devAssert(
                        app.activeVoiceMessageId == null,
                        "manual stop clears active voice state",
                        {
                            activeVoiceMessageId: app.activeVoiceMessageId,
                            speaking: window.speechSynthesis.speaking,
                            pending: window.speechSynthesis.pending,
                            paused: window.speechSynthesis.paused,
                        },
                    );
                }
            }

            const processedEdit = actionButton("processed-smoke", "editMessage");
            const processedRegenerate = actionButton(
                "processed-smoke",
                "openRegenerateMessageModal",
            );
            const processedDelete = actionButton("processed-smoke", "deleteMessage");
            const backupDelete = actionButton("backup-smoke", "deleteMessage");
            devAssert(
                processedEdit?.disabled &&
                    processedRegenerate?.disabled &&
                    !processedDelete &&
                    !!backupDelete,
                "processed normal assistant without backup disables edit/regenerate and has no delete while processed Continue assistant can delete with backup",
                {
                    editDisabled: processedEdit?.disabled,
                    regenerateDisabled: processedRegenerate?.disabled,
                    processedDeletePresent: !!processedDelete,
                    backupDeletePresent: !!backupDelete,
                    backupDeleteDisabled: backupDelete?.disabled,
                },
            );

            const gameDelete = actionButton("game-smoke", "deleteMessage");
            devAssert(!gameDelete, "game messages do not render delete controls");

            let streamCursorSmoke = 0;
            const streamedFirstParts = rebaseStreamedVoiceParts(
                splitVoiceParts("First sentence. "),
                "First sentence. ",
                "First sentence. Second sentence.",
                (nextCursor) => {
                    streamCursorSmoke = nextCursor;
                },
                streamCursorSmoke,
            );
            const streamedSecondParts = rebaseStreamedVoiceParts(
                splitVoiceParts("Second sentence."),
                "Second sentence.",
                "First sentence. Second sentence.",
                (nextCursor) => {
                    streamCursorSmoke = nextCursor;
                },
                streamCursorSmoke,
            );
            devAssert(
                streamedFirstParts[0]?.start === 0 &&
                    streamedSecondParts[0]?.start === "First sentence. ".length,
                "streamed voice chunks rebase highlight ranges onto the full message",
                { streamedFirstParts, streamedSecondParts, streamCursorSmoke },
            );
            app.state.temp_speakers ||= {};
            app.state.temp_speakers.Somara = {
                name: "Somara",
                gender: "female",
            };
            const voiceFallbackMessage = {
                id: "voice-fallback-smoke",
                entryId: nextEntryId(),
                role: "assistant",
                speaker: "Narrator",
                text:
                    '"First warning." She grabs his wrist. "Second warning."',
                voiceSpeakers: ["Somara"],
                voiceMeta: { speak: { A: "Somara" } },
                at: new Date().toISOString(),
            };
            app.messages.push(voiceFallbackMessage);
            rebuildMessageIndex();
            const voiceFallbackParts = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(voiceFallbackMessage.text),
                "voice-fallback-smoke",
            ).filter((part) => part.kind === "dialogue");
            const stickyTaggedParts = splitVoiceParts(
                '(Somara) "First warning." She grabs his wrist. "Second warning."',
            ).filter((part) => part.kind === "dialogue");
            devAssert(
                voiceFallbackParts.length === 2 &&
                    voiceFallbackParts.every((part) => part.speaker === "Somara") &&
                    stickyTaggedParts.length === 2 &&
                    stickyTaggedParts.every((part) => part.speaker === "Somara"),
                "single-speaker voice metadata and inline tags stay sticky for later untagged quotes",
                { voiceFallbackParts, stickyTaggedParts },
            );
            devAssert(
                !voicePartNeedsMetadataVoiceGate(
                    splitVoiceParts('"Untagged dialogue."')[0],
                    null,
                ),
                "untagged dialogue does not pause for speaker metadata",
            );

            const missingSpeaker = missingRequiredTaggedSpeakers(
                {
                    speakers: [{ full_name: "New Ally", gender: "female" }],
                    new_npcs: [],
                },
                [{ name: "New Ally", gender: "female" }],
            );
            devAssert(
                missingSpeaker.length === 1,
                "speaker-only metadata is not enough to satisfy new speaking NPC creation",
                { missingSpeaker },
            );
            const genericPeople = peopleDataToParsedMetadata({
                speakers: [{ full_name: "Unknown Woman", gender: "female" }],
                new_npcs: [
                    {
                        full_name: "Bandit Leader",
                        gender: "male",
                        age: 30,
                        role: "bandit leader",
                    },
                    {
                        full_name: "Mercenary Woman",
                        gender: "female",
                        age: 31,
                        role: "mercenary woman",
                    },
                ],
            });
            devAssert(
                !Object.keys(genericPeople.speak || {}).length &&
                    !Object.keys(genericPeople.newSpeakers || {}).length &&
                    isInvalidGeneratedPersonName("Mercenary Woman"),
                "generic/role speaker metadata is rejected so repair must provide a proper full_name",
                { genericPeople, mercenaryInvalid: isInvalidGeneratedPersonName("Mercenary Woman") },
            );
            const repairedPeople = peopleDataToParsedMetadata({
                speakers: [{ full_name: "Nora Vale", gender: "female" }],
                new_npcs: [
                    {
                        full_name: "Nora Vale",
                        gender: "female",
                        age: 29,
                        role: "village guard",
                        appearance: "alert guard in leather armor",
                        personality: "protective",
                    },
                ],
            });
            app.messages.push({
                id: "npc-repair-smoke",
                entryId: nextEntryId(),
                role: "assistant",
                speaker: "Narrator",
                text: '(Nora Vale) "Hold there."',
                at: new Date().toISOString(),
            });
            rebuildMessageIndex();
            applyAssistantMessageMetadata("npc-repair-smoke", repairedPeople, {
                save: false,
            });
            devAssert(
                speakerExistsAsEntity("Nora Vale") &&
                    (app.state.scene.npcs_present || []).includes("Nora Vale"),
                "repaired speaker metadata creates a real nearby NPC before temp voice fallback",
                {
                    npc: getNpcEntry("Nora Vale"),
                    nearby: app.state.scene.npcs_present,
                },
            );
            const futureDuplicate = findDuplicateForNewNpcMetadata(
                "Roxanne",
                personNameDuplicatePool(
                    {
                        ...app.state,
                        future_cast: {
                            items: {
                                roxanne: {
                                    id: "roxanne",
                                    name: "Roxanne Teller",
                                },
                            },
                        },
                    },
                    { includeFutureCast: true },
                ),
            );
            devAssert(
                !!futureDuplicate,
                "future-cast duplicate pool catches first-name duplicate NPC attempts",
                { futureDuplicate },
            );
            app.state.characters["Ally One"] = devSmokeRuntimeCharacter("Ally One", {
                age: 25,
                gender: "female",
                role: "test companion",
            });
            const normalizedImageTargets = repairAiImageTargetsForState([
                "Player",
                "Muscular woman",
                "Ally One",
            ]);
            devAssert(
                normalizedImageTargets.includes(playerEntityDisplayName(app.state)) &&
                    normalizedImageTargets.includes("Ally One") &&
                    !normalizedImageTargets.includes("Muscular woman"),
                "image targets keep only real image-eligible entities",
                { normalizedImageTargets },
            );
            const previousSelectedOutput =
                app.objectiveRuntime.selectedOutputById["test-objective"];
            app.objectiveRuntime.selectedOutputById["test-objective"] =
                "test-objective-output";
            const playerCompletionDirective = objectiveCompletionNarratorDirective({
                completed: {
                    id: "test-objective",
                    title: "Test Objective",
                    completion_control: "player",
                    next_objectives: [
                        {
                            id: "test-objective-output",
                            objective_id: "next-test-objective",
                            completion_instruction: "Introduce the next story beat.",
                        },
                    ],
                },
                rewardResult: { rewardMessages: ["Test NPC was introduced."] },
            });
            if (previousSelectedOutput == null)
                delete app.objectiveRuntime.selectedOutputById["test-objective"];
            else
                app.objectiveRuntime.selectedOutputById["test-objective"] =
                    previousSelectedOutput;
            devAssert(
                playerCompletionDirective.includes("Introduce the next story beat."),
                "player-message objective completion creates a narrator directive for the next reply",
                { playerCompletionDirective },
            );
            {
                const dialogueObjective = {
                    id: "dialogue-smoke",
                    title: "Talk to Mentor",
                    type: "story",
                    completion_control: "player",
                    completion_criteria: "Return yes when the player speaks to the mentor.",
                    next_objectives: [
                        {
                            id: "dialogue-smoke-output",
                            objective_id: "dialogue-smoke-next",
                            completion_instruction:
                                "The mentor is irritated and speaks in a harsh tone.",
                            dialogue_lines: [
                                '(Mentor Vale) "First exact line."',
                                '(Mentor Vale) "Second exact line."',
                            ],
                        },
                    ],
                };
                const dialogueOutput = dialogueObjective.next_objectives[0];
                app.objectiveRuntime.selectedOutputById[dialogueObjective.id] =
                    dialogueOutput.id;
                const directive = objectiveCompletionNarratorDirective({
                    completed: dialogueObjective,
                });
                const preCompletionPrompt = objectiveForCompletionPrompt(dialogueObjective);
                const invalidDialogue = validateStoryDefinition({lite: true,
                    title: "Invalid Dialogue Smoke",
                    genres: ["fantasy"],
                    state: {
                        objectives: {
                            items: [
                                {
                                    ...dialogueObjective,
                                    next_objectives: [
                                        {
                                            ...dialogueOutput,
                                            dialogue_lines: [],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                });
                devAssert(
                    directive.indexOf("Objective completion story instruction: The mentor is irritated and speaks in a harsh tone.") >= 0 &&
                        directive.indexOf("DIALOGUE DELIVERY REQUIRED") >
                            directive.indexOf("Objective completion story instruction:") &&
                        directive.indexOf(dialogueOutput.dialogue_lines[0]) <
                            directive.indexOf(dialogueOutput.dialogue_lines[1]) &&
                        directive.includes(
                            "React naturally to the player's most recent action, words, and emotional tone.",
                        ) &&
                        directive.includes(
                            "If the required dialogue lines are not the natural immediate response to the player, respond to the player first, then transition naturally into the required lines.",
                        ) &&
                        directive.includes(
                            "This response may be longer than normal when needed to react naturally and deliver the required dialogue well.",
                        ) &&
                        !Object.prototype.hasOwnProperty.call(
                            preCompletionPrompt,
                            "dialogue_lines",
                        ) &&
                        invalidDialogue.errors.some(
                            (error) => error.code === "value" && /dialogue_lines/i.test(error.path),
                        ),
                    "dialogue objectives append ordered exact lines after the common completion instruction without leaking them before completion",
                    { directive, preCompletionPrompt, invalidDialogue },
                );
                delete app.objectiveRuntime.selectedOutputById[dialogueObjective.id];
            }
            devAssert(
                /story is ready/i.test(
                    objectiveCompletionNarratorDirective({
                        completionControl: "ai",
                        completed: {
                            id: "test-plot",
                            title: "Test Plot Point",
                            completion_control: "ai",
                        },
                    }),
                ),
                "AI-controlled objective completion creates a plot-point narrator directive",
            );
            devAssert(
                parseObjectiveCompletionResult('{"answer":"maybe"}').status ===
                    "invalid_response" &&
                    parseObjectiveCompletionResult('{"s":"c"}').status ===
                        "objective_complete" &&
                    parseObjectiveCompletionResult('{"s":"p","n":"moved closer"}').status ===
                        "objective_progress" &&
                    parseObjectiveCompletionResult('{"s":"n"}').status === "no_change" &&
                    parseObjectiveCompletionResult("yes").status ===
                        "objective_complete" &&
                    parseObjectiveCompletionResult("no").status === "no_change",
                "objective verifier parser accepts compact status JSON and legacy yes/no",
            );
            devAssert(
                !Object.prototype.hasOwnProperty.call(buildReplyStateContext(), "objectives"),
                "normal narrator reply state does not expose an objectives object",
                buildReplyStateContext().objectives,
            );
            {
                const promptObjective = objectiveForCompletionPrompt({
                    id: "summary-only-objective",
                    title: "Summary Only Objective",
                    summary: "Player-facing objective text.",
                    objective: "Legacy duplicate objective text.",
                    completion_control: "player",
                    completion_criteria: "Private verifier-only rule.",
                });
                devAssert(
                    promptObjective.description === "Player-facing objective text." &&
                        !("objective" in promptObjective) &&
                        promptObjective.completion_condition ===
                            "Private verifier-only rule." &&
                        !Object.prototype.hasOwnProperty.call(
                            promptObjective,
                            "completion_instruction",
                        ),
                    "objective prompts use description plus completion condition, without private completion instructions",
                    promptObjective,
                );
            }
            for (const source of ["user", "invite", "auto_player", "d20", "find"]) {
                devAssert(
                    queueItemCreatesPlayerStoryMessage({
                        source,
                        text: `${source} smoke text`,
                        visibleText: `${source} smoke text`,
                    }),
                    `${source} queue source creates a normal player story message`,
                );
            }
            {
                const savedMessages = clone(app.messages || []);
                const savedQueue = clone(app.queue || []);
                const savedAiQueue = app.aiQueue || [];
                const savedAiActive = app.aiActive;
                const savedBusy = app.busy;
                const originalRunObjectiveCompletionFlowSafe =
                    runObjectiveCompletionFlowSafe;
                const originalGenerateReply = generateReply;
                let deletedTriggerId = "";
                let generateReplyCalled = false;
                let queuedRelatedCancelled = false;
                try {
                    app.aiQueue = [
                        {
                            opts: {
                                messageId: "queued-assistant-reply",
                                relatedMessageIds: ["deleted-trigger-user"],
                            },
                            reject: (err) => {
                                queuedRelatedCancelled = isAiCancelledError(err);
                            },
                        },
                    ];
                    app.aiActive = {
                        opts: {
                            messageId: "active-assistant-reply",
                            relatedMessageIds: ["deleted-trigger-user"],
                        },
                    };
                    devAssert(
                        cancelAiRequestsForMessage(
                            "deleted-trigger-user",
                            "related player message deleted",
                        ) &&
                            queuedRelatedCancelled &&
                            !app.aiQueue.length &&
                            app.aiActive.opts.cancelled === true,
                        "deleting a player message cancels queued/active assistant AI requests related to it",
                        {
                            queuedRelatedCancelled,
                            aiQueue: app.aiQueue,
                            aiActive: app.aiActive,
                        },
                    );

                    app.aiQueue = [];
                    app.aiActive = null;
                    app.busy = false;
                    app.queue = [
                        {
                            source: "user",
                            text: "Delete me before the reply starts.",
                            visibleText: "Delete me before the reply starts.",
                            speaker: "Message Tester",
                        },
                    ];
                    app.messages = [];
                    runObjectiveCompletionFlowSafe = async (options = {}) => {
                        deletedTriggerId = options.messageId || "";
                        removeMessageById(deletedTriggerId);
                        cancelAiRequestsForMessage(
                            deletedTriggerId,
                            "pre-reply deletion smoke",
                        );
                        return null;
                    };
                    generateReply = async () => {
                        generateReplyCalled = true;
                        return "This reply should not be generated.";
                    };
                    await processQueue();
                    devAssert(
                        deletedTriggerId &&
                            !generateReplyCalled &&
                            !(app.messages || []).some(
                                (message) => message.role === "assistant",
                            ),
                        "deleting a player message before the assistant response starts prevents creating/using that response",
                        {
                            deletedTriggerId,
                            generateReplyCalled,
                            messages: app.messages,
                        },
                    );
                } finally {
                    runObjectiveCompletionFlowSafe =
                        originalRunObjectiveCompletionFlowSafe;
                    generateReply = originalGenerateReply;
                    app.messages = savedMessages;
                    app.queue = savedQueue;
                    app.aiQueue = savedAiQueue;
                    app.aiActive = savedAiActive;
                    app.busy = savedBusy;
                }
            }

            {
                const savedMessages = clone(app.messages || []);
                const savedCompletedSteps = clone(
                    app.stateSync?.completedStepKeys || [],
                );
                const savedBusy = app.busy;
                const savedStateSyncRunning = app.stateSync?.running;
                try {
                    app.busy = false;
                    app.stateSync.running = false;
                    app.stateSync.completedStepKeys = [];
                    app.messages = Array.from(
                        { length: STATE_SYNC_FREE_MESSAGE_SLACK + 1 },
                        (_, index) => ({
                            id: `force-backlog-${index}`,
                            entryId: index + 1,
                            role: index % 2 ? "assistant" : "user",
                            speaker: index % 2 ? "Narrator" : "Tester",
                            text: `Pending backlog message ${index + 1}.`,
                            stateSyncStatus: "pending",
                            at: new Date().toISOString(),
                        }),
                    );
                    devAssert(
                        ["user", "invite", "auto_player", "d20", "find", "auto"].every(
                            (source) =>
                                shouldForceStateSyncBeforeQueueForSmoke({
                                    source,
                                    text: `${source} smoke text`,
                                    visibleText: `${source} smoke text`,
                                }),
                        ) &&
                            !shouldForceStateSyncBeforeQueueForSmoke({
                                source: "command",
                                text: "Command smoke",
                                visibleText: "Command smoke",
                                commandOnly: true,
                            }),
                        "normal narrator-reply queue items force one state catch-up step when backlog exceeds slack",
                    );
                    app.messages = app.messages.slice(
                        0,
                        STATE_SYNC_FREE_MESSAGE_SLACK,
                    );
                    devAssert(
                        !shouldForceStateSyncBeforeQueueForSmoke({
                            source: "auto_player",
                            text: "Auto smoke text",
                            visibleText: "Auto smoke text",
                        }),
                        "auto/player actions do not force catch-up while backlog is still within slack",
                    );
                } finally {
                    app.messages = savedMessages;
                    app.stateSync.completedStepKeys = savedCompletedSteps;
                    app.busy = savedBusy;
                    app.stateSync.running = savedStateSyncRunning;
                }
            }
            {
                const savedMessages = clone(app.messages || []);
                const savedStateSync = clone(app.stateSync || {});
                const savedBusy = app.busy;
                const savedAiActive = app.aiActive;
                const savedAiQueue = app.aiQueue;
                const savedActiveStateCheck = app.activeStateCheck;
                try {
                    app.messages = [
                        {
                            id: "state-start-priority-message",
                            entryId: 1,
                            role: "user",
                            speaker: "Tester",
                            text: "This message should start state sync immediately.",
                            stateSyncStatus: "pending",
                            at: new Date().toISOString(),
                        },
                    ];
                    app.stateSync = {
                        ...clone(savedStateSync),
                        running: false,
                        queued: false,
                        status: "",
                        startMessageId: null,
                        processingMessageIds: [],
                        lastRangeText: "",
                        startedAt: 0,
                        completedStepKeys: [],
                        generation: 0,
                    };
                    app.busy = true;
                    app.aiActive = { label: "blocking smoke AI" };
                    app.aiQueue = [{ label: "queued smoke AI", opts: {} }];
                    devAssert(
                        startStateSyncSession("state start priority smoke"),
                        "state sync session starts immediately after a finished message",
                        {
                            stateSync: app.stateSync,
                            message: app.messages[0],
                        },
                    );
                    devAssert(
                        app.stateSync.running === true && app.stateSync.queued === true,
                        "started state sync waits queued while processing must wait",
                        { stateSync: app.stateSync },
                    );
                    devAssert(
                        app.stateSync.processingMessageIds.includes(
                            "state-start-priority-message",
                        ) && app.messages[0].stateSyncStatus === "processing",
                        "started state sync claims the pending message range",
                        {
                            stateSync: app.stateSync,
                            message: app.messages[0],
                        },
                    );
                    let stateCancelCalled = false;
                    app.stateSync.running = true;
                    app.stateSync.queued = false;
                    app.activeStateCheck = {
                        id: "preempt-state-check",
                        source: "assistant",
                        cancelled: false,
                        reason: "",
                        cancel: () => {
                            stateCancelCalled = true;
                        },
                    };
                    app.aiActive = {
                        label: "assistant state group character_body",
                        logType: "state",
                        opts: { allowDuringStateSync: true },
                    };
                    app.aiQueue = [];
                    const preempted = preemptBackgroundStateAiForPriority(
                        "character reply",
                    );
                    devAssert(
                        preempted &&
                            stateCancelCalled &&
                            app.activeStateCheck.cancelled === true &&
                            app.aiActive === null &&
                            app.stateSync.queued === true,
                        "player-facing AI can preempt a running background state AI request",
                        {
                            preempted,
                            stateCancelCalled,
                            activeStateCheck: app.activeStateCheck,
                            aiActive: app.aiActive,
                            stateSync: app.stateSync,
                        },
                    );
                } finally {
                    app.messages = savedMessages;
                    app.stateSync = savedStateSync;
                    app.busy = savedBusy;
                    app.aiActive = savedAiActive;
                    app.aiQueue = savedAiQueue;
                    app.activeStateCheck = savedActiveStateCheck;
                }
            }
            {
                const savedRuntimeGeneration = app.gameRuntimeGeneration;
                const savedQueue = clone(app.queue || []);
                const savedAiQueue = app.aiQueue || [];
                const savedAiActive = app.aiActive;
                const savedBusy = app.busy;
                const savedAuto = app.settings.autoVisualNovel;
                const savedImageRequests = app.activeImageRequests;
                const savedProfileRequests = app.activeProfileImageRequests;
                const savedProfileQueue = app.profileImageQueue;
                const savedProfileQueued = app.profileImageQueued;
                const savedProfileGenerating = app.profileImageGenerating;
                const savedProfileRunning = app.profileImageQueueRunning;
                const savedInspections = app.npcInspectionInFlight;
                const savedPresenceQueue = app.pendingPresenceCleanup;
                const savedPresenceRunning = app.presenceCleanupRunning;
                const savedPendingInvite = app.pendingNpcInvite;
                const savedPendingObjectiveChoice = app.pendingObjectiveChoiceReply;
                const savedPendingRegenerate = app.pendingRegenerateMessage;
                const savedDirective = app.currentReplyDirective;
                const savedMode = app.currentReplyMode;
                const savedActiveSource = app.activeQueueSource;
                const savedVoicePending = app.voiceMetadataPendingMessageIds;
                const savedDialogueParts = app.pendingVoiceDialogueParts;
                const savedWorldJob = app.worldGenerationJob;
                const savedWorldLoading = app.worldGenerationLoadingActive;
                const savedWorldStarted = app.worldGenerationStarted;
                const savedWorldPrompt = app.pendingWorldGenerationPrompt;
                let queuedCancelled = false;
                let activeCancelled = false;
                try {
                    app.queue = [{ source: "auto_player", text: "old game turn" }];
                    app.busy = true;
                    app.settings.autoVisualNovel = true;
                    app.aiQueue = [
                        {
                            opts: {},
                            reject: (err) => {
                                queuedCancelled = isAiCancelledError(err);
                            },
                        },
                    ];
                    app.aiActive = {
                        opts: {},
                        reject: (err) => {
                            activeCancelled = isAiCancelledError(err);
                        },
                    };
                    app.activeImageRequests = new Set(["old-image"]);
                    app.activeProfileImageRequests = new Set(["old-profile"]);
                    app.profileImageQueue = [{ name: "Old Profile", options: {} }];
                    app.profileImageQueued = new Set(["Old Profile"]);
                    app.profileImageGenerating = new Set(["Old Profile"]);
                    app.profileImageQueueRunning = true;
                    app.npcInspectionInFlight = new Set(["Omar Vale"]);
                    app.pendingPresenceCleanup = [{ name: "Omar Vale" }];
                    app.presenceCleanupRunning = true;
                    app.pendingNpcInvite = { name: "Omar Vale" };
                    app.pendingObjectiveChoiceReply = { old: true };
                    app.pendingRegenerateMessage = { id: "old-message" };
                    app.currentReplyDirective = "old directive";
                    app.currentReplyMode = "old";
                    app.activeQueueSource = "auto_player";
                    app.voiceMetadataPendingMessageIds = new Set(["old-message"]);
                    app.pendingVoiceDialogueParts = new Map([["old-message", []]]);
                    app.worldGenerationJob = { id: "old-job" };
                    app.worldGenerationLoadingActive = true;
                    app.worldGenerationStarted = true;
                    app.pendingWorldGenerationPrompt = "old prompt";
                    cancelAllGameProcesses("lifecycle cancellation smoke");
                    devAssert(
                        app.gameRuntimeGeneration > savedRuntimeGeneration &&
                            !app.queue.length &&
                            !app.aiQueue.length &&
                            !app.aiActive &&
                            queuedCancelled &&
                            activeCancelled &&
                            !app.busy &&
                            !app.settings.autoVisualNovel &&
                            !app.activeImageRequests.size &&
                            !app.activeProfileImageRequests.size &&
                            !app.profileImageQueue.length &&
                            !app.profileImageQueued.size &&
                            !app.profileImageGenerating.size &&
                            !app.profileImageQueueRunning &&
                            !app.npcInspectionInFlight.size &&
                            !app.pendingPresenceCleanup.length &&
                            !app.presenceCleanupRunning &&
                            !app.pendingNpcInvite &&
                            !app.pendingObjectiveChoiceReply &&
                            !app.pendingRegenerateMessage &&
                            !app.currentReplyDirective &&
                            !app.currentReplyMode &&
                            !app.activeQueueSource &&
                            !app.voiceMetadataPendingMessageIds.size &&
                            !app.pendingVoiceDialogueParts.size &&
                            !app.worldGenerationJob &&
                            !app.worldGenerationLoadingActive &&
                            !app.worldGenerationStarted &&
                            !app.pendingWorldGenerationPrompt,
                        "switching/starting games cancels old-game async work and invalidates stale continuations",
                    );
                } finally {
                    app.gameRuntimeGeneration = savedRuntimeGeneration;
                    app.queue = savedQueue;
                    app.aiQueue = savedAiQueue;
                    app.aiActive = savedAiActive;
                    app.busy = savedBusy;
                    app.settings.autoVisualNovel = savedAuto;
                    app.activeImageRequests = savedImageRequests;
                    app.activeProfileImageRequests = savedProfileRequests;
                    app.profileImageQueue = savedProfileQueue;
                    app.profileImageQueued = savedProfileQueued;
                    app.profileImageGenerating = savedProfileGenerating;
                    app.profileImageQueueRunning = savedProfileRunning;
                    app.npcInspectionInFlight = savedInspections;
                    app.pendingPresenceCleanup = savedPresenceQueue;
                    app.presenceCleanupRunning = savedPresenceRunning;
                    app.pendingNpcInvite = savedPendingInvite;
                    app.pendingObjectiveChoiceReply = savedPendingObjectiveChoice;
                    app.pendingRegenerateMessage = savedPendingRegenerate;
                    app.currentReplyDirective = savedDirective;
                    app.currentReplyMode = savedMode;
                    app.activeQueueSource = savedActiveSource;
                    app.voiceMetadataPendingMessageIds = savedVoicePending;
                    app.pendingVoiceDialogueParts = savedDialogueParts;
                    app.worldGenerationJob = savedWorldJob;
                    app.worldGenerationLoadingActive = savedWorldLoading;
                    app.worldGenerationStarted = savedWorldStarted;
                    app.pendingWorldGenerationPrompt = savedWorldPrompt;
                }
            }
            devAssert(
                !queueItemCreatesPlayerStoryMessage({
                    source: "position",
                    text: "Position smoke",
                    visibleText: "Position smoke",
                }),
                "ordinary scene tool changes do not create a player story turn",
            );
            {
                const savedObjectives = clone(app.state.objectives || {});
                const savedMessages = clone(app.messages || []);
                const originalAiText = aiText;
                let result = null;
                try {
                    app.messages = [];
                    await devInstallObjectiveFixture({
                        active_id: "deferred-objective-smoke",
                        focus_id: "deferred-objective-smoke",
                        items: [
                            {
                                id: "deferred-objective-smoke",
                                title: "Deferred Objective Smoke",
                                type: "story",
                                status: "active",
                                summary: "Test deferred objective notice order.",
                                objective: "Complete the deferred notice smoke.",
                                completion_control: "player",
                                completion_criteria: "The player says it is complete.",
                                rewards: [],
                                requires: [],
                            },
                        ],
                    }, "message-actions-deferred-objective-smoke");
                    aiText = async () => "yes";
                    result = await runObjectiveCompletionPass({
                        source: "player",
                        text: "I complete the deferred objective smoke.",
                        messageId: "deferred-objective-user",
                        deferGameMessage: true,
                    });
                    devAssert(
                        result?.objectiveGameMessage &&
                            !app.messages.some((message) => message.role === "game"),
                        "objective completion can defer the visible Game notice until after the narrator reply",
                        { result, messages: app.messages },
                    );
                    const assistant = addMessage(
                        "assistant",
                        "The scene resolves the deferred objective.",
                        "Narrator",
                    );
                    const game = flushDeferredObjectiveCompletionGameMessage(result);
                    devAssert(
                        !!game &&
                            app.messages.findIndex((message) => message.id === game.id) >
                                app.messages.findIndex(
                                    (message) => message.id === assistant.id,
                                ),
                        "deferred objective Game notice is inserted after the narrator response",
                        app.messages.map((message) => ({
                            role: message.role,
                            speaker: message.speaker,
                            text: message.text,
                        })),
                    );
                } finally {
                    aiText = originalAiText;
                    app.messages = savedMessages;
                    await devInstallObjectiveFixture(
                        savedObjectives,
                        "message-actions-restored-objectives-smoke",
                    );
                }
            }
            {
                const savedObjectives = clone(app.state.objectives || {});
                const originalAiText = aiText;
                let objectiveAiCalled = false;
                try {
                    app.state.objectives.no_current = true;
                    app.state.objectives.active_id = "";
                    app.state.objectives.focus_id = "";
                    aiText = async (...args) => {
                        objectiveAiCalled = true;
                        return originalAiText(...args);
                    };
                    await runObjectiveCompletionPass({
                        source: "player",
                        text: "No objective should be checked.",
                        messageId: "no-objective-smoke",
                    });
                } finally {
                    aiText = originalAiText;
                    app.state.objectives.no_current = savedObjectives.no_current === true;
                    app.state.objectives.active_id = savedObjectives.active_id || "";
                    app.state.objectives.focus_id = savedObjectives.focus_id || "";
                }
                devAssert(
                    !objectiveAiCalled,
                    "objective completion verifier is not called when no objective is selected",
                );
            }
            const storyGroup = stateCheckGroups().find((item) => item.id === "story");
            const storyInstruction = buildGroupedStateInstruction(
                storyGroup,
                "assistant",
                "A test message.",
                groupedStateContext("story"),
            );
            devAssert(
                !storyGroup.roots.includes("objectives") &&
                    /Never return an operation whose path begins with "objectives"/i.test(
                        storyInstruction,
                    ) &&
                    /Do not turn it into an objective/i.test(storyInstruction) &&
                    /Return ONLY minified structured JSON ops/i.test(storyInstruction) &&
                    /JSON PATCH:\s*$/i.test(storyInstruction) &&
                    !/Return ONLY a compact newline patch|objective has at most one step|single concrete step/i.test(
                        storyInstruction,
                    ),
                "story state-update prompt excludes all objective mutations and uses JSON ops",
                { storyInstruction, storyRoots: storyGroup.roots },
            );
            const allInOneStateInstruction = buildStateCheckInstruction(
                "assistant",
                "A test message.",
                compactStateText(buildStateCheckContext()),
            );
            const directCommandInstruction = buildAiCommandPatchInstruction(
                "Record a durable fact.",
                compactStateText(buildStateCheckContext()),
            );
            devAssert(
                !/Allowed top-level path roots:\s*\n[^\n]*\bobjectives\b/i.test(
                    allInOneStateInstruction,
                ) &&
                    !/Allowed top-level roots:\s*\n[^\n]*\bobjectives\b/i.test(
                        directCommandInstruction,
                    ) &&
                    /Never return an operation whose path begins with "objectives"/i.test(
                        allInOneStateInstruction,
                    ) &&
                    /Never return an operation whose path begins with "objectives"/i.test(
                        directCommandInstruction,
                    ),
                "all game-AI state prompts exclude objective mutation roots",
                { allInOneStateInstruction, directCommandInstruction },
            );
            const characterMindGroup = stateCheckGroups().find((item) => item.id === "character_mind");
            const characterMindInstruction = buildGroupedStateInstruction(
                characterMindGroup,
                "assistant",
                "A test message.",
                groupedStateContext("character_mind"),
            );
            {
                const baseState = clone(app.state);
                baseState.time.minute = 47;
                baseState.characters ||= {};
                baseState.characters.Mira = {
                    ...(baseState.characters.Mira || blankCharacterTemplate("Mira")),
                    trust: 8,
                    attraction: 7,
                    affection: 6,
                    physical_state: "steady",
                    state_of_mind: "calm",
                    pose: "standing",
                };
                const parsedDelta = parseCompactAiPatch(
                    '{"r":[{"path":["time","minute"],"value":1},{"path":["party_members","Mira","trust"],"value":-9},{"path":["party_members","Mira","attraction"],"value":5}]}',
                    baseState,
                );
                const patchedDelta = applyStatePatch(baseState, parsedDelta.patch);
                const patchedAbsolute = applyStatePatch(baseState, {
                    characters: {
                        Mira: {
                            trust: 0,
                            attraction: 0,
                            affection: 10,
                            physical_state: "normal updater overwrite",
                            state_of_mind: "normal updater overwrite",
                            pose: "normal updater overwrite",
                        },
                    },
                });
            }
            {
                const baseState = clone(app.state);
                baseState.characters ||= {};
                baseState.characters["Keiko Arden"] ||= {
                    name: "Keiko Arden",
                    state_of_mind: "neutral",
                    clothing: {},
                    held_items: {},
                };
                const objectOpParsed = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: ["scene", "summary"],
                                value: "The party gets dressed and heads into town.",
                            },
                        ],
                        a: [
                            {
                                path: ["recent_changes"],
                                value: "The party got dressed.",
                            },
                        ],
                    }),
                    baseState,
                    ["scene", "time", "recent_changes"],
                    "scene_time",
                );
                const flatOpParsed = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            [
                                "scene",
                                "summary",
                                "The party gets dressed and heads into town.",
                            ],
                        ],
                    }),
                    baseState,
                    ["scene", "time", "recent_changes"],
                    "scene_time",
                );
                devAssert(
                    flatOpParsed.valid &&
                        flatOpParsed.patch.scene?.summary &&
                        !flatOpParsed.errors.some((error) =>
                            /bad block opener/i.test(error),
                        ),
                    "grouped patch parser handles flat JSON path arrays without falling into block-parser errors",
                    flatOpParsed,
                );
                const mixedInvalidRootRaw = JSON.stringify({
                    s: [
                        {
                            path: ["party_members", "Keiko Arden", "state_of_mind"],
                            value: "focused",
                        },
                        {
                            path: ["scene", "summary"],
                            value: "Invalid scene write from character group.",
                        },
                    ],
                });
                const mixedInvalidRootParsed = parseBlockStatePatch(
                    mixedInvalidRootRaw,
                    baseState,
                    ["party_members", "player", "recent_changes"],
                    "character_mind",
                );
                devAssert(
                    !mixedInvalidRootParsed.valid &&
                        mixedInvalidRootParsed.patch.characters?.["Keiko Arden"]
                            ?.state_of_mind === "focused" &&
                        !mixedInvalidRootParsed.patch.scene &&
                        mixedInvalidRootParsed.errors.some((error) =>
                            /invalid root scene/i.test(error),
                        ),
                    "grouped patch parser keeps valid character ops while stripping invalid scene roots",
                    mixedInvalidRootParsed,
                );
                const originalAiText = aiText;
                try {
                    aiText = async () => {
                        throw new Error(
                            "repair should not call AI when only invalid roots remain",
                        );
                    };
                    const repaired = await parseAndRepairGroupedPatch({
                        group: characterMindGroup,
                        source: "assistant",
                        text: "Smoke state repair.",
                        raw: mixedInvalidRootRaw,
                        context: groupedStateContext("character_mind", baseState),
                        beforeState: baseState,
                    });
                    devAssert(
                        repaired.valid &&
                            repaired.patch.characters?.["Keiko Arden"]
                                ?.state_of_mind === "focused" &&
                            !repaired.patch.scene,
                        "grouped repair skips AI retries when only invalid-root paths remain",
                        repaired,
                    );
                } finally {
                    aiText = originalAiText;
                }
                const malformedOpRootParsed = parseBlockStatePatch(
                    JSON.stringify({
                        path: ["scene", "summary"],
                        value: "Malformed object op.",
                    }),
                    baseState,
                    ["scene", "time", "recent_changes"],
                    "scene_time",
                );
                devAssert(
                    !groupRepairOnlyHasInvalidRoots(malformedOpRootParsed.errors) &&
                        malformedOpRootParsed.errors.some((error) =>
                            /direct root object patches are unsupported/i.test(error),
                        ),
                "grouped parser rejects direct root object patches so malformed AI output is repaired",
                malformedOpRootParsed,
            );
            let directRecentChangesRepairCalls = 0;
            const originalAiTextForRecentChangesRepair = aiText;
            try {
                aiText = async () => {
                    directRecentChangesRepairCalls += 1;
                    throw new Error("direct recent_changes shape should be repaired locally");
                };
                const directRecentChangesRepair = await parseAndRepairGroupedPatch({
                    group: characterMindGroup,
                    source: "assistant",
                    text: "Smoke state repair.",
                    raw: JSON.stringify({
                        recent_changes: [
                            { text: "Nerissa changed into a new form." },
                        ],
                    }),
                    context: groupedStateContext("character_mind", baseState),
                    beforeState: baseState,
                });
                devAssert(
                    directRecentChangesRepair.valid &&
                        directRecentChangesRepair.patch.recent_changes?.includes(
                            "Nerissa changed into a new form.",
                        ) &&
                        directRecentChangesRepairCalls === 0,
                    "AI direct recent_changes objects are converted to canonical append operations without a repair call",
                    { directRecentChangesRepair, directRecentChangesRepairCalls },
                );
            } finally {
                aiText = originalAiTextForRecentChangesRepair;
            }
            const emptyOwnedGroupParsed = parseBlockStatePatch(
                    JSON.stringify({
                        clothing_operations: [],
                    }),
                    baseState,
                    ["clothing_operations", "party_members", "player", "recent_changes"],
                    "character_clothing",
                );
                const nonEmptyOwnedGroupParsed = parseBlockStatePatch(
                    JSON.stringify({
                        clothing_operations: [
                            {
                                character: "Keiko Arden",
                                action: "remove",
                            },
                        ],
                    }),
                    baseState,
                    ["clothing_operations", "party_members", "player", "recent_changes"],
                    "character_clothing",
                );
                devAssert(
                    emptyOwnedGroupParsed.valid &&
                        Object.keys(emptyOwnedGroupParsed.patch || {}).length === 0 &&
                        !nonEmptyOwnedGroupParsed.valid &&
                        nonEmptyOwnedGroupParsed.errors.some((error) =>
                            /direct root object patches are unsupported/i.test(error),
                        ),
                    "empty group-owned direct containers are no-op responses while non-empty direct patches still require repair",
                    { emptyOwnedGroupParsed, nonEmptyOwnedGroupParsed },
                );
                const directObjectivePatch = parseBlockStatePatch(
                    JSON.stringify({
                        objectives: {
                            suggestions: [
                                {
                                    id: "bad-direct-suggestion",
                                    title: "Bad Direct Suggestion",
                                },
                            ],
                        },
                    }),
                    baseState,
                    ["story_memory", "recent_changes"],
                    "story",
                );
                const compactObjectiveSuggestion = parseBlockStatePatch(
                    JSON.stringify({
                        a: [
                            {
                                path: ["objectives", "suggestions"],
                                value: {
                                    id: "valid-side-suggestion",
                                    title: "Valid Side Suggestion",
                                    reason: "A real optional lead appeared.",
                                    available_now: true,
                                    status: "suggested",
                                },
                            },
                        ],
                    }),
                    baseState,
                    ["story_memory", "recent_changes"],
                    "story",
                );
                const objectiveRootSet = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: ["objectives"],
                                value: {
                                    active_id: "invented-objective",
                                },
                            },
                        ],
                    }),
                    baseState,
                    ["story_memory", "recent_changes"],
                    "story",
                );
                devAssert(
                    !directObjectivePatch.valid &&
                        !Object.keys(directObjectivePatch.patch || {}).length &&
                        !compactObjectiveSuggestion.valid &&
                        !compactObjectiveSuggestion.patch.objectives &&
                        !objectiveRootSet.valid &&
                        !objectiveRootSet.patch.objectives,
                    "story grouped patches reject every objective mutation shape",
                    {
                        directObjectivePatch,
                        compactObjectiveSuggestion,
                        objectiveRootSet,
                    },
                );
                const genericObjectiveAttempt = preflightGameAiStatePatch(
                    parseCompactAiPatch(
                        JSON.stringify({
                            s: [
                                {
                                    path: ["objectives", "active_id"],
                                    value: "invented-objective",
                                },
                                {
                                    path: ["story_memory", "unresolved_threads"],
                                    value: ["A durable unresolved thread."],
                                },
                            ],
                        }),
                        baseState,
                        [],
                        { requireOperations: true },
                    ),
                );
                devAssert(
                    !genericObjectiveAttempt.valid &&
                        !genericObjectiveAttempt.patch.objectives &&
                        genericObjectiveAttempt.patch.story_memory?.unresolved_threads?.includes(
                            "A durable unresolved thread.",
                        ) &&
                        genericObjectiveAttempt.errors.some((error) =>
                            /Game AI cannot create or modify objectives/i.test(error),
                        ),
                    "generic game-AI patch preflight rejects objective mutations while preserving valid roots for repair",
                    genericObjectiveAttempt,
                );
                {
                    const originalAiTextForObjectiveRepair = aiText;
                    let objectiveRepairCalls = 0;
                    try {
                        aiText = async (prompt) => {
                            objectiveRepairCalls++;
                            devAssert(
                                /Never return an operation whose path begins with "objectives"/i.test(
                                    prompt,
                                ),
                                "grouped repair prompt explicitly forbids objective mutations",
                                { prompt },
                            );
                            return "{}";
                        };
                        const repairedObjectiveAttempt =
                            await parseAndRepairGroupedPatch({
                                group: storyGroup,
                                source: "assistant",
                                text: "Plan for an uncertain arrival.",
                                raw: JSON.stringify({
                                    s: [
                                        {
                                            path: ["objectives", "suggestions"],
                                            value: [
                                                {
                                                    id: "arrival-contingencies",
                                                    title: "Arrival Contingencies",
                                                },
                                            ],
                                        },
                                        {
                                            path: [
                                                "story_memory",
                                                "unresolved_threads",
                                            ],
                                            value: [
                                                "The arrival route remains uncertain.",
                                            ],
                                        },
                                    ],
                                }),
                                context: groupedStateContext("story", baseState),
                                beforeState: baseState,
                            });
                        devAssert(
                            objectiveRepairCalls === 1 &&
                                repairedObjectiveAttempt.valid &&
                                !repairedObjectiveAttempt.patch.objectives &&
                                repairedObjectiveAttempt.patch.story_memory?.unresolved_threads?.includes(
                                    "The arrival route remains uncertain.",
                                ),
                            "an initial game-AI objective mutation is rejected and repaired before state application",
                            {
                                objectiveRepairCalls,
                                repairedObjectiveAttempt,
                            },
                        );
                    } finally {
                        aiText = originalAiTextForObjectiveRepair;
                    }
                }
                {
                    const originalAiTextForRepeatedObjectiveRepair = aiText;
                    let repeatedObjectiveRepairCalls = 0;
                    try {
                        aiText = async () => {
                            repeatedObjectiveRepairCalls++;
                            return JSON.stringify({
                                a: [
                                    {
                                        path: ["objectives", "suggestions"],
                                        value: {
                                            id: "still-forbidden",
                                            title: "Still Forbidden",
                                        },
                                    },
                                ],
                            });
                        };
                        const repeatedObjectiveAttempt =
                            await parseAndRepairGroupedPatch({
                                group: storyGroup,
                                source: "assistant",
                                text: "Keep planning.",
                                raw: JSON.stringify({
                                    s: [
                                        {
                                            path: ["objectives", "active_id"],
                                            value: "forbidden-objective",
                                        },
                                        {
                                            path: [
                                                "story_memory",
                                                "unresolved_threads",
                                            ],
                                            value: ["The route still needs verification."],
                                        },
                                    ],
                                }),
                                context: groupedStateContext("story", baseState),
                                beforeState: baseState,
                            });
                        devAssert(
                            repeatedObjectiveRepairCalls === 1 &&
                                repeatedObjectiveAttempt.valid &&
                                !repeatedObjectiveAttempt.patch.objectives &&
                                repeatedObjectiveAttempt.patch.story_memory?.unresolved_threads?.includes(
                                    "The route still needs verification.",
                                ),
                            "an objective mutation repeated by the repair AI is discarded before state application",
                            {
                                repeatedObjectiveRepairCalls,
                                repeatedObjectiveAttempt,
                            },
                        );
                    } finally {
                        aiText = originalAiTextForRepeatedObjectiveRepair;
                    }
                }
                const playerNameParsed = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: ["player", "name"],
                                value: "Rika Voss",
                            },
                        ],
                    }),
                    baseState,
                    ["party_members", "player", "recent_changes"],
                    "character_body",
                );
                devAssert(
                    !playerNameParsed.valid &&
                        !playerNameParsed.patch.player?.name &&
                        playerNameParsed.errors.some((error) =>
                            /player\.name cannot be changed/i.test(error),
                        ),
                    "grouped patch parser rejects player name replacement",
                    playerNameParsed,
                );
                const badRecentChanges = parseBlockStatePatch(
                    JSON.stringify({
                        a: [
                            {
                                path: ["recent_changes"],
                                value: ["nested recent change"],
                            },
                        ],
                    }),
                    baseState,
                    ["party_members", "player", "recent_changes"],
                    "character_body",
                );
                devAssert(
                    !badRecentChanges.valid &&
                        !badRecentChanges.patch.recent_changes &&
                        badRecentChanges.errors.some((error) =>
                            /recent_changes append value must be one string/i.test(
                                error,
                            ),
                        ),
                    "grouped patch parser rejects nested recent_changes appends",
                    badRecentChanges,
                );
                const clothingParsed = parseBlockStatePatch(
                    JSON.stringify({
                        s: [
                            {
                                path: [
                                    "party_members",
                                    "Keiko Arden",
                                    "clothing",
                                    "shirt",
                                ],
                                value: "Station coffee mug",
                            },
                            {
                                path: [
                                    "party_members",
                                    "Keiko Arden",
                                    "held_items",
                                    "right_hand",
                                ],
                                value: "Station coffee mug",
                            },
                        ],
                    }),
                    baseState,
                    ["party_members", "player", "recent_changes"],
                    "character_clothing",
                );
                devAssert(
                    !clothingParsed.valid &&
                        !clothingParsed.patch.characters?.["Keiko Arden"] &&
                        clothingParsed.errors.some((error) =>
                            /use clothing_operations|not allowed in the clothing group/i.test(
                                error,
                            ),
                        ),
                    "character_clothing parser rejects direct slot and held-item patches instead of guessing clothing intent",
                    clothingParsed,
                );
            }

            const setupMutationFixture = (kind) => {
                app.snapshots = [];
                                                app.state.scene.summary = `${kind} backup summary`;
                const full = kind.includes("full");
                const processing = kind === "processing";
                app.messages = [
                    {
                        id: `${kind}-user`,
                        entryId: 1,
                        role: "user",
                        speaker: "Message Tester",
                        text: `${kind} user text.`,
                        at: new Date().toISOString(),
                        stateSyncStatus: full ? "synced" : processing ? "processing" : "pending",
                    },
                    {
                        id: `${kind}-assistant`,
                        entryId: 2,
                        role: "assistant",
                        speaker: "Narrator",
                        text: `${kind} assistant text.`,
                        at: new Date().toISOString(),
                        stateSyncStatus: full ? "synced" : processing ? "processing" : "pending",
                    },
                    {
                        id: `${kind}-tail`,
                        entryId: 3,
                        role: "assistant",
                        speaker: "Narrator",
                        text: `${kind} tail text.`,
                        at: new Date().toISOString(),
                        stateSyncStatus: "pending",
                    },
                ];
                if (processing || full) {
                    createMessageStateBackup(
                        [`${kind}-user`, `${kind}-assistant`],
                        `${kind} mutation smoke backup`,
                    );
                    app.state.scene.summary = `${kind} mutated summary`;
                }
            };

            const configureRunningStateSyncForSmoke = ({
                startMessageId,
                blockStartEntryId,
                blockEndEntryId,
                processingMessageIds,
                activeCheckMessageIds = [],
                blockSnapshotId = "",
                generation = 0,
                group = "scene_time",
                status = "Updating smoke range",
            }) => {
                app.stateSync.running = true;
                app.stateSync.queued = true;
                app.stateSync.generation = generation;
                app.stateSync.startMessageId = startMessageId;
                app.stateSync.blockStartEntryId = blockStartEntryId;
                app.stateSync.blockEndEntryId = blockEndEntryId;
                app.stateSync.blockSnapshotId = blockSnapshotId;
                app.stateSync.processingMessageIds = processingMessageIds;
                app.stateSync.stateSnapshot = clone(app.state);
                app.stateSync.currentGroup = group;
                app.stateSync.completedStepKeys = [];
                app.stateSync.lastRangeText = "smoke state-sync range";
                app.stateSync.status = status;
                let cancelled = false;
                app.activeStateCheck = activeCheckMessageIds.length
                    ? {
                          id: `${startMessageId || "state"}-active-check`,
                          source: "assistant",
                          messageIds: activeCheckMessageIds,
                          cancel: () => {
                              cancelled = true;
                          },
                      }
                    : null;
                return () => cancelled;
            };

            app.snapshots = [];
                                    app.messages = [
                {
                    id: "pruned-backup-user",
                    entryId: 1,
                    role: "user",
                    speaker: "Message Tester",
                    text: "This processed message will lose its old rollback snapshot.",
                    at: new Date().toISOString(),
                    stateSyncStatus: "synced",
                },
            ];
            createMessageStateBackup(
                ["pruned-backup-user"],
                "old processed rollback backup",
            );
            for (let index = 0; index < MESSAGE_STATE_SNAPSHOT_LIMIT; index += 1) {
                snapshotState(`snapshot prune filler ${index + 1}`, {
                    type: "message_state_backup",
                    messageIds: [`prune-filler-${index + 1}`],
                });
            }
            const prunedBackupMessage = findMessageById("pruned-backup-user");
            devAssert(
                app.snapshots.length === MESSAGE_STATE_SNAPSHOT_LIMIT &&
                    !stateBackupForMessage(prunedBackupMessage) &&
                    !messageMutationAllowed(prunedBackupMessage),
                "processed message mutation is disabled after its rollback snapshot is pruned by the snapshot cap",
                {
                    snapshotCount: app.snapshots.length,
                    snapshotLimit: MESSAGE_STATE_SNAPSHOT_LIMIT,
                    backupId: prunedBackupMessage?.stateBackupId,
                    hasBackup: !!stateBackupForMessage(prunedBackupMessage),
                    mutationAllowed: messageMutationAllowed(prunedBackupMessage),
                },
            );

            app.activeVoiceMessageId = "pruned-backup-user";
            app.voiceHighlight = { messageId: "pruned-backup-user", start: 0, end: 8 };
            const voiceTokenBeforeSnapshotRestore = app.activeVoiceToken;
            restoreRuntimeSnapshotForMessageRollback(app.snapshots.at(-1));
            devAssert(
                app.activeVoiceMessageId == null &&
                    app.voiceHighlight == null &&
                    app.activeVoiceToken > voiceTokenBeforeSnapshotRestore,
                "restoring a runtime snapshot immediately stops active message reading",
                {
                    activeVoiceMessageId: app.activeVoiceMessageId,
                    voiceHighlight: app.voiceHighlight,
                    voiceTokenBeforeSnapshotRestore,
                    activeVoiceToken: app.activeVoiceToken,
                },
            );

            setupMutationFixture("pending");
            let pendingStateCheckCancelled = false;
            let pendingActiveAiCancelled = false;
            let pendingQueuedAiCancelled = false;
            app.stateSync.running = true;
            app.stateSync.queued = true;
            app.stateSync.generation = 0;
            app.stateSync.startMessageId = "pending-assistant";
            app.stateSync.blockStartEntryId = 2;
            app.stateSync.blockEndEntryId = 3;
            app.stateSync.processingMessageIds = ["pending-assistant", "pending-tail"];
            app.stateSync.stateSnapshot = clone(app.state);
            app.stateSync.currentGroup = "scene_time";
            app.stateSync.completedStepKeys = ["scene_time"];
            app.stateSync.lastRangeText = "stale pending range";
            app.stateSync.status = "Updating stale pending range";
            app.activeStateCheck = {
                id: "pending-mutation-check",
                source: "assistant",
                messageIds: ["pending-tail"],
                cancel: () => {
                    pendingStateCheckCancelled = true;
                },
            };
            app.aiActive = {
                opts: {
                    messageId: "pending-tail",
                    relatedMessageIds: ["pending-assistant"],
                },
                reject: (err) => {
                    pendingActiveAiCancelled = isAiCancelledError(err);
                },
            };
            app.aiQueue = [
                {
                    opts: {
                        messageId: "pending-tail",
                        relatedMessageIds: ["pending-assistant"],
                    },
                    reject: (err) => {
                        pendingQueuedAiCancelled = isAiCancelledError(err);
                    },
                },
            ];
            const pendingMutation = prepareMessageStateMutation(
                findMessageById("pending-assistant"),
                { mode: "edit", reason: "pending edit smoke" },
            );
            const pendingActiveAiMarkedCancelled =
                app.aiActive?.opts?.cancelled === true ||
                app.aiActive?.cancelled === true;
            const pendingActiveStateCheckClearedOrCancelled =
                app.activeStateCheck === null ||
                app.activeStateCheck?.cancelled === true;
            devAssert(
                pendingMutation &&
                    !pendingMutation.restored &&
                    !pendingMutation.needsFullStateRecheck &&
                    !!findMessageById("pending-assistant") &&
                    !findMessageById("pending-tail") &&
                    pendingStateCheckCancelled &&
                    pendingActiveAiMarkedCancelled &&
                    pendingQueuedAiCancelled &&
                    pendingActiveStateCheckClearedOrCancelled &&
                    !app.aiQueue.length &&
                    app.stateSync.running === false &&
                    app.stateSync.queued === false &&
                    app.stateSync.processingMessageIds.length === 0 &&
                    app.stateSync.generation === 1,
                "pending edit mutation inside the active state-sync block cancels active background state sync and all queued/active AI for affected messages",
                {
                    pendingMutation,
                    messages: app.messages,
                    pendingStateCheckCancelled,
                    pendingActiveAiCancelled,
                    pendingActiveAiMarkedCancelled,
                    pendingQueuedAiCancelled,
                    pendingActiveStateCheckClearedOrCancelled,
                    stateSync: app.stateSync,
                    activeStateCheck: app.activeStateCheck,
                    aiActive: app.aiActive,
                    aiQueue: app.aiQueue,
                },
            );
            app.activeStateCheck = null;
            app.aiActive = null;

            for (const outsideMode of ["edit", "delete", "regenerate"]) {
                const outsideKind = `outside-${outsideMode}`;
                setupMutationFixture(outsideKind);
                const outsideStateCheckCancelled = configureRunningStateSyncForSmoke({
                    startMessageId: `${outsideKind}-user`,
                    blockStartEntryId: 1,
                    blockEndEntryId: 1,
                    processingMessageIds: [`${outsideKind}-user`],
                    activeCheckMessageIds: [`${outsideKind}-user`],
                    generation: 3,
                    status: "Updating outside user only",
                });
                const outsideMutation = prepareMessageStateMutation(
                    findMessageById(`${outsideKind}-assistant`),
                    {
                        mode: outsideMode,
                        reason: `outside block ${outsideMode} smoke`,
                    },
                );
                const targetStillPresent = !!findMessageById(
                    `${outsideKind}-assistant`,
                );
                devAssert(
                    outsideMutation &&
                        !outsideMutation.restored &&
                        !outsideStateCheckCancelled() &&
                        app.activeStateCheck?.messageIds?.includes(
                            `${outsideKind}-user`,
                        ) &&
                        app.stateSync.running === true &&
                        app.stateSync.blockEndEntryId === 1 &&
                        !findMessageById(`${outsideKind}-tail`) &&
                        (outsideMode === "delete"
                            ? !targetStillPresent
                            : targetStillPresent),
                    `${outsideMode} after the active state-sync block trims later messages without cancelling the current block`,
                    {
                        outsideMode,
                        outsideMutation,
                        outsideStateCheckCancelled: outsideStateCheckCancelled(),
                        targetStillPresent,
                        stateSync: app.stateSync,
                        activeStateCheck: app.activeStateCheck,
                        messages: app.messages,
                    },
                );
                app.activeStateCheck = null;
                app.stateSync.running = false;
                app.stateSync.queued = false;
            }

            setupMutationFixture("block-fallback");
            app.state.scene.summary = "block fallback backup summary";
            const blockFallbackSnapshot = createMessageStateBackup(
                ["block-fallback-assistant"],
                "active block fallback backup smoke",
            );
            const blockFallbackMessage = findMessageById("block-fallback-assistant");
            delete blockFallbackMessage.stateBackupId;
            delete blockFallbackMessage.stateBackupStartMessageId;
            blockFallbackMessage.stateSyncStatus = "processing";
            app.state.scene.summary = "block fallback mutated summary";
            const blockFallbackStateCheckCancelled = configureRunningStateSyncForSmoke({
                startMessageId: "block-fallback-assistant",
                blockStartEntryId: 2,
                blockEndEntryId: 2,
                blockSnapshotId: blockFallbackSnapshot?.id || "",
                processingMessageIds: ["block-fallback-assistant"],
                activeCheckMessageIds: ["block-fallback-assistant"],
                generation: 0,
            });
            const blockFallbackMutation = prepareMessageStateMutation(
                blockFallbackMessage,
                { mode: "edit", reason: "active block fallback smoke" },
            );
            const restoredBlockFallbackAssistant = (app.messages || []).find(
                (message) => Number(message.entryId) === 2,
            );
            const restoredBlockFallbackTail = (app.messages || []).find(
                (message) => Number(message.entryId) === 3,
            );
            devAssert(
                blockFallbackMutation?.restored &&
                    blockFallbackStateCheckCancelled() &&
                    app.state.scene.summary === "block fallback backup summary" &&
                    !!restoredBlockFallbackAssistant &&
                    !restoredBlockFallbackTail &&
                    app.stateSync.running === false,
                "processed message inside active state-sync block can restore from blockSnapshotId when its message backup id is missing",
                {
                    blockFallbackMutation,
                    blockSnapshotId: blockFallbackSnapshot?.id,
                    scene: app.state.scene,
                    restoredBlockFallbackAssistant,
                    restoredBlockFallbackTail,
                    messages: app.messages,
                    stateSync: app.stateSync,
                },
            );

            setupMutationFixture("processing");
            let partialStateCheckCancelled = false;
            app.state.npc_directory ||= { locations: {} };
            app.state.npc_directory.locations ||= {};
            app.state.npc_directory.locations.SmokeTown = {
                label: "SmokeTown",
                characters: {
                    "Post Backup NPC": {
                        name: "Post Backup NPC",
                        inspected: true,
                        full_character: blankCharacterTemplate("Post Backup NPC"),
                    },
                },
            };
            app.stateSync.running = true;
            app.stateSync.queued = true;
            app.stateSync.generation = 0;
            app.stateSync.startMessageId = "processing-assistant";
            app.stateSync.blockStartEntryId = 2;
            app.stateSync.blockEndEntryId = 2;
            app.stateSync.processingMessageIds = ["processing-assistant"];
            app.stateSync.stateSnapshot = clone(app.state);
            app.stateSync.currentGroup = "character_body";
            app.stateSync.lastRangeText = "partial stale range";
            app.activeStateCheck = {
                id: "partial-mutation-check",
                source: "assistant",
                messageIds: ["processing-assistant"],
                cancel: () => {
                    partialStateCheckCancelled = true;
                },
            };
            const partialMutation = prepareMessageStateMutation(
                findMessageById("processing-assistant"),
                { mode: "delete", reason: "partial delete smoke" },
            );
            const partialRange = stateRecheckMessageRangeByEntryIds(
                partialMutation?.stateRecheckStartEntryId,
                partialMutation?.targetEntryId,
            );
            devAssert(
                partialMutation?.restored &&
                    partialMutation.needsFullStateRecheck &&
                    app.state.scene.summary === "processing backup summary" &&
                    !findMessageById("processing-assistant") &&
                    !findMessageById("processing-tail") &&
                    partialStateCheckCancelled &&
                    !JSON.stringify(app.state.npc_directory || {}).includes(
                        "Post Backup NPC",
                    ) &&
                    app.activeStateCheck === null &&
                    app.stateSync.running === false &&
                    partialRange.map((message) => Number(message.entryId)).join(",") ===
                        "1",
                "processing delete cancels active state sync, restores its backup, removes target/later messages, and rechecks only remaining range",
                {
                    partialMutation,
                    partialRange,
                    scene: app.state.scene,
                    partialStateCheckCancelled,
                    npcDirectory: app.state.npc_directory,
                    stateSync: app.stateSync,
                },
            );

            setupMutationFixture("full");
            let fullEditStateCheckCancelled = false;
            app.stateSync.running = true;
            app.stateSync.queued = true;
            app.stateSync.generation = 0;
            app.stateSync.startMessageId = "full-user";
            app.stateSync.blockStartEntryId = 1;
            app.stateSync.blockEndEntryId = 3;
            app.stateSync.processingMessageIds = ["full-user", "full-assistant", "full-tail"];
            app.stateSync.stateSnapshot = clone(app.state);
            app.stateSync.currentGroup = "story";
            app.activeStateCheck = {
                id: "full-edit-mutation-check",
                source: "assistant",
                messageIds: ["full-user", "full-assistant"],
                cancel: () => {
                    fullEditStateCheckCancelled = true;
                },
            };
            const fullEditMutation = prepareMessageStateMutation(
                findMessageById("full-assistant"),
                { mode: "edit", reason: "full edit smoke" },
            );
            const fullEditRange = stateRecheckMessageRangeByEntryIds(
                fullEditMutation?.stateRecheckStartEntryId,
                fullEditMutation?.targetEntryId,
            );
            devAssert(
                fullEditMutation?.restored &&
                    fullEditMutation.needsFullStateRecheck &&
                    app.state.scene.summary === "full backup summary" &&
                    !!(app.messages || []).find((message) => Number(message.entryId) === 2) &&
                    !(app.messages || []).find((message) => Number(message.entryId) === 3) &&
                    fullEditStateCheckCancelled &&
                    app.activeStateCheck === null &&
                    app.stateSync.running === false &&
                    fullEditRange.map((message) => Number(message.entryId)).join(",") ===
                        "1,2",
                "full edit cancels active state sync, restores full-state backup, and marks the full range for broad state recheck",
                {
                    fullEditMutation,
                    fullEditRange,
                    scene: app.state.scene,
                    fullEditStateCheckCancelled,
                    stateSync: app.stateSync,
                },
            );

            setupMutationFixture("full");
            let fullRegenerateStateCheckCancelled = false;
            app.stateSync.running = true;
            app.stateSync.queued = true;
            app.stateSync.generation = 0;
            app.stateSync.startMessageId = "full-assistant";
            app.stateSync.blockStartEntryId = 2;
            app.stateSync.blockEndEntryId = 3;
            app.stateSync.processingMessageIds = ["full-assistant", "full-tail"];
            app.stateSync.stateSnapshot = clone(app.state);
            app.stateSync.currentGroup = "scene_time";
            app.activeStateCheck = {
                id: "full-regenerate-mutation-check",
                source: "assistant",
                messageIds: ["full-tail"],
                cancel: () => {
                    fullRegenerateStateCheckCancelled = true;
                },
            };
            const fullRegenerateMutation = prepareMessageStateMutation(
                findMessageById("full-assistant"),
                { mode: "regenerate", reason: "full regenerate smoke" },
            );
            const fullRegenerateHadStaleCancel =
                app.cancelledAiMessageIds.has("full-assistant");
            clearStaleAiCancellationForMessage("full-assistant");
            devAssert(
                fullRegenerateMutation?.restored &&
                    fullRegenerateMutation.needsFullStateRecheck &&
                    !!(app.messages || []).find((message) => Number(message.entryId) === 2) &&
                    !(app.messages || []).find((message) => Number(message.entryId) === 3) &&
                    fullRegenerateStateCheckCancelled &&
                    app.activeStateCheck === null &&
                    app.stateSync.running === false &&
                    fullRegenerateHadStaleCancel &&
                    !app.cancelledAiMessageIds.has("full-assistant"),
                "full regenerate cancels active state sync, resets state, and clears stale AI cancellation before replacement generation",
                {
                    fullRegenerateMutation,
                    fullRegenerateHadStaleCancel,
                    staleCancelStillPresent:
                        app.cancelledAiMessageIds.has("full-assistant"),
                    fullRegenerateStateCheckCancelled,
                    stateSync: app.stateSync,
                    messages: app.messages,
                },
            );

            {
                const originalRunStateCheckForCancelSmoke = runStateCheck;
                const traceSourceForCancelSmoke = smokeDevTraceCaptureActive()
                    ? app.smokeDevTraceCapture
                    : app.devTrace || [];
                const devTraceBeforeCancelSmoke = traceSourceForCancelSmoke.length;
                try {
                    setupMutationFixture("cancelled-background");
                    app.messages.forEach((message) => {
                        message.stateSyncStatus = "pending";

                    });
                    app.issuePopupOpen = false;
                    document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                    runStateCheck = async () => {
                        throw aiCancelledError(
                            "cancelled-background-assistant",
                            "message deleted",
                        );
                    };
                    await runBackgroundStateSync("cancelled background smoke");
                    const newTraceEntries = traceSourceForCancelSmoke.slice(devTraceBeforeCancelSmoke);
                    devAssert(
                        newTraceEntries.some(
                            (entry) =>
                                /Background state update cancelled/i.test(
                                    entry.title || entry.text || "",
                                ) && entry.logLevel === "message",
                        ) &&
                            !newTraceEntries.some(
                                (entry) =>
                                    entry.logLevel === "error" &&
                                    /Background state update/i.test(
                                        entry.title || entry.text || "",
                                    ),
                            ) &&
                            !(document.querySelector(".popup-modal")?.textContent || "").includes(
                                "Background state update failed",
                            ),
                        "cancelled background state sync does not create an error popup or error-level dev trace",
                        {
                            newTraceEntries,
                            modalText: document.querySelector(".popup-modal")?.textContent || "",
                        },
                    );
                } finally {
                    runStateCheck = originalRunStateCheckForCancelSmoke;
                    app.issuePopupOpen = false;
                    document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                    app.stateSync.running = false;
                    app.stateSync.queued = false;
                    app.activeStateCheck = null;
                }
            }

            setupMutationFixture("latest-full");
            app.messages = app.messages.filter(
                (message) => String(message.id) !== "latest-full-tail",
            );
            const latestFullRegenerateMutation = prepareMessageStateMutation(
                findMessageById("latest-full-assistant"),
                { mode: "regenerate", reason: "latest full regenerate smoke" },
            );
            const latestFullPendingIds = pendingStateSyncMessages().map(
                (message) => Number(message.entryId),
            );
            const previousBusy = app.busy;
            app.busy = true;
            app.stateSync.queued = false;
            const latestFullRequested = requestFullStateRecheckAfterMessageMutation(
                "latest full regenerate smoke",
            );
            const latestFullQueuedWhileBusy = app.stateSync.queued;
            app.busy = previousBusy;
            app.stateSync.queued = false;
            devAssert(
                    latestFullRegenerateMutation?.restored &&
                    latestFullRegenerateMutation.needsFullStateRecheck &&
                    latestFullPendingIds.join(",") ===
                        "1,2" &&
                    latestFullRequested &&
                    latestFullQueuedWhileBusy,
                "latest fully incorporated regenerate restores backup and queues the full pending range for normal state sync",
                {
                    latestFullRegenerateMutation,
                    latestFullPendingIds,
                    latestFullRequested,
                    latestFullQueuedWhileBusy,
                    scene: app.state.scene,
                },
            );

            {
                const savedBusy = app.busy;
                const savedAiActive = app.aiActive;
                const savedAiQueue = app.aiQueue;
                const savedPendingRegenerate = app.pendingRegenerateMessage;
                const savedActiveVoiceMessageId = app.activeVoiceMessageId;
                const savedVoiceToken = app.activeVoiceToken;
                try {
                    setupMutationFixture("streaming");
                    const streamingMessage = findMessageById("streaming-assistant");
                    streamingMessage.text = "Partial streamed response that should disappear.";
                    app.busy = true;
                    app.aiQueue = [];
                    app.pendingRegenerateMessage = null;
                    app.activeVoiceMessageId = "streaming-assistant";
                    let activeRejected = false;
                    app.aiActive = {
                        label: "character reply",
                        logType: "reply",
                        opts: {
                            messageId: "streaming-assistant",
                            onStream: (text) => {
                                if (
                                    !app.cancelledAiMessageIds.has("streaming-assistant") &&
                                    findMessageById("streaming-assistant")
                                )
                                    updateMessage("streaming-assistant", text, {
                                        render: false,
                                        save: false,
                                    });
                            },
                        },
                        reject: (err) => {
                            activeRejected = isAiCancelledError(err);
                        },
                    };
                    const regeneratedWhileStreaming = await regenerateAssistantMessage(
                        "streaming-assistant",
                        "make it shorter",
                        { reason: "streaming regenerate smoke" },
                    );
                    app.aiActive.opts.onStream("STALE STREAM SHOULD NOT SHOW");
                    const streamingAfterCancel = findMessageById("streaming-assistant");
                    devAssert(
                        regeneratedWhileStreaming &&
                            app.aiActive?.opts?.cancelled === true &&
                            app.cancelledAiMessageIds.has("streaming-assistant") &&
                            app.pendingRegenerateMessage?.id === "streaming-assistant" &&
                            streamingAfterCancel?.text === "" &&
                            streamingAfterCancel?.hiddenWhileRegenerating === true &&
                            !visibleMessagesForRender().some(
                                (message) => String(message.id) === "streaming-assistant",
                            ) &&
                            String(app.activeVoiceMessageId || "") !== "streaming-assistant" &&
                            !/STALE STREAM SHOULD NOT SHOW|Partial streamed response/i.test(
                                streamingAfterCancel?.text || "",
                            ),
                        "regenerating a currently streaming assistant message immediately cancels the active AI request, stops reading, clears visible stale text, and queues replacement generation",
                        {
                            regeneratedWhileStreaming,
                            activeRejected,
                            aiActive: app.aiActive,
                            pendingRegenerate: app.pendingRegenerateMessage,
                            message: streamingAfterCancel,
                            activeVoiceMessageId: app.activeVoiceMessageId,
                        },
                    );
                } finally {
                    app.busy = savedBusy;
                    app.aiActive = savedAiActive;
                    app.aiQueue = savedAiQueue;
                    app.pendingRegenerateMessage = savedPendingRegenerate;
                    app.activeVoiceMessageId = savedActiveVoiceMessageId;
                    app.activeVoiceToken = savedVoiceToken;
                    app.cancelledAiMessageIds.delete("streaming-assistant");
                }
            }

            setupMutationFixture("full");
            const fullDeleteMutation = prepareMessageStateMutation(
                findMessageById("full-assistant"),
                { mode: "delete", reason: "full delete smoke" },
            );
            const fullDeleteRange = stateRecheckMessageRangeByEntryIds(
                fullDeleteMutation?.stateRecheckStartEntryId,
                fullDeleteMutation?.targetEntryId,
            );
            devAssert(
                fullDeleteMutation?.restored &&
                    fullDeleteMutation.needsFullStateRecheck &&
                    app.state.scene.summary === "full backup summary" &&
                    !(app.messages || []).find((message) => Number(message.entryId) === 2) &&
                    !(app.messages || []).find((message) => Number(message.entryId) === 3) &&
                    fullDeleteRange.map((message) => Number(message.entryId)).join(",") ===
                        "1",
                "full delete restores full-state backup, removes target/later messages, and rechecks remaining range",
                { fullDeleteMutation, fullDeleteRange, scene: app.state.scene },
            );

            const originalShowPromptForEditReply = showPrompt;
                const originalGenerateReplyForEditReply = generateReply;
                const originalObjectiveFlowForEditReply = runObjectiveCompletionFlowSafe;
                const originalImmediateChecksForEditReply = runImmediateChecksForMutatedMessage;
                const originalAfterReplyEffectsForEditReply = afterReplyEffects;
                let editedPlayerReplyGenerationStarted = false;
                let editedPlayerReplyGenerationMessageId = "";
                let editedPlayerReplyGenerationRelatedIds = [];
                let editedPlayerReplyGenerationStartedWhileBusy = false;
                try {
                    app.queue = [];
                    app.messages = [
                    {
                        id: "edit-reply-user",
                        entryId: nextEntryId(),
                        role: "user",
                        speaker: "Message Tester",
                        text: "Original player action.",
                        detail: "",
                        at: new Date().toISOString(),
                        stateSyncStatus: "pending",
                    },
                    {
                        id: "edit-reply-assistant",
                        entryId: nextEntryId(),
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Stale assistant reply.",
                        at: new Date().toISOString(),
                        replySource: "user",
                        relatedMessageIds: ["edit-reply-user"],
                        stateSyncStatus: "pending",
                    },
                ];
                showPrompt = async () => "Edited player action.";
                runObjectiveCompletionFlowSafe = async () => null;
                runImmediateChecksForMutatedMessage = async () => true;
                afterReplyEffects = async () => {};
                generateReply = async (messageId) => {
                    editedPlayerReplyGenerationStarted = true;
                    editedPlayerReplyGenerationMessageId = String(messageId || "");
                    editedPlayerReplyGenerationRelatedIds =
                        findMessageById(messageId)?.relatedMessageIds || [];
                    editedPlayerReplyGenerationStartedWhileBusy = !!app.busy;
                    devAssert(
                        !!findMessageById("edit-reply-user") &&
                            !findMessageById("edit-reply-assistant"),
                        "editing previous player message removes stale later assistant before replacement generation",
                        app.messages,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return `Fresh reply for ${messageId}.`;
                };
                await editMessage("edit-reply-user");
                await devWaitFor(
                    () => editedPlayerReplyGenerationStarted,
                    3000,
                    "edited player message to start replacement AI generation",
                );
                devAssert(
                    editedPlayerReplyGenerationRelatedIds.includes("edit-reply-user"),
                    "editing a player message starts AI generation for that edited message",
                    {
                        editedPlayerReplyGenerationMessageId,
                        editedPlayerReplyGenerationRelatedIds,
                        editedPlayerReplyGenerationStartedWhileBusy,
                        busy: app.busy,
                        queue: app.queue,
                    },
                );
                await devWaitFor(
                    () => !app.busy && !app.queue.length,
                    3000,
                    "edited player message replacement reply",
                );
                const editedUser = findMessageById("edit-reply-user");
                const replacementAssistant = (app.messages || []).find(
                    (message) =>
                        message.role === "assistant" &&
                        /Fresh reply/i.test(message.text || ""),
                );
                devAssert(
                    editedUser?.text === "Edited player action." &&
                        !findMessageById("edit-reply-assistant") &&
                        !!replacementAssistant &&
                        (replacementAssistant.relatedMessageIds || []).includes(
                            "edit-reply-user",
                        ),
                    "editing a previous player message queues and generates a replacement assistant reply",
                    { messages: app.messages, queue: app.queue },
                );
                const savedEditedUser = messageRecordForStorage(editedUser);
                const restoredEditedUser = runtimeMessageFromStoredRow({
                    ...savedEditedUser,
                    saveId: 1,
                });
                devAssert(
                    savedEditedUser.text === "Edited player action." &&
                        restoredEditedUser.id === editedUser.id &&
                        restoredEditedUser.text === editedUser.text &&
                        restoredEditedUser.entryId === editedUser.entryId,
                    "the player edit action produces canonical message data that survives save serialization and reload",
                    { savedEditedUser, restoredEditedUser },
                );
            } finally {
                showPrompt = originalShowPromptForEditReply;
                generateReply = originalGenerateReplyForEditReply;
                runObjectiveCompletionFlowSafe = originalObjectiveFlowForEditReply;
                runImmediateChecksForMutatedMessage = originalImmediateChecksForEditReply;
                afterReplyEffects = originalAfterReplyEffectsForEditReply;
                app.busy = false;
                app.queue = [];
            }

            {
                const originalShowPromptForAssistantEdit = showPrompt;
                const originalGenerateReplyForAssistantEdit = generateReply;
                const originalImmediateChecksForAssistantEdit =
                    runImmediateChecksForMutatedMessage;
                let assistantEditGenerateCalled = false;
                let assistantEditImmediateCheckMessageId = "";
                try {
                    app.queue = [];
                    app.messages = [
                        {
                            id: "assistant-edit-user",
                            entryId: 1,
                            role: "user",
                            speaker: "Message Tester",
                            text: "Prompt that already has a reply.",
                            at: new Date().toISOString(),
                            stateSyncStatus: "pending",
                        },
                        {
                            id: "assistant-edit-reply",
                            entryId: 2,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Original assistant text.",
                            detail: "",
                            at: new Date().toISOString(),
                            replySource: "user",
                            relatedMessageIds: ["assistant-edit-user"],
                            stateSyncStatus: "pending",
                        },
                        {
                            id: "assistant-edit-tail",
                            entryId: 3,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Stale later reply.",
                            at: new Date().toISOString(),
                            stateSyncStatus: "pending",
                        },
                    ];
                    showPrompt = async () => "Edited assistant text.";
                    generateReply = async () => {
                        assistantEditGenerateCalled = true;
                        return "Assistant edit should not generate this.";
                    };
                    runImmediateChecksForMutatedMessage = async (message) => {
                        assistantEditImmediateCheckMessageId = String(
                            message?.id || "",
                        );
                        return true;
                    };
                    await editMessage("assistant-edit-reply");
                    devAssert(
                        findMessageById("assistant-edit-reply")?.text ===
                            "Edited assistant text." &&
                            !findMessageById("assistant-edit-tail") &&
                            !assistantEditGenerateCalled &&
                            assistantEditImmediateCheckMessageId ===
                                "assistant-edit-reply",
                        "editing an assistant message rechecks the edited text without generating a replacement assistant reply",
                        {
                            messages: app.messages,
                            assistantEditGenerateCalled,
                            assistantEditImmediateCheckMessageId,
                        },
                    );
                    const editedAssistant = findMessageById("assistant-edit-reply");
                    const savedEditedAssistant = messageRecordForStorage(editedAssistant);
                    const restoredEditedAssistant = runtimeMessageFromStoredRow({
                        ...savedEditedAssistant,
                        saveId: 1,
                    });
                    devAssert(
                        savedEditedAssistant.text === "Edited assistant text." &&
                            restoredEditedAssistant.id === editedAssistant.id &&
                            restoredEditedAssistant.text === editedAssistant.text &&
                            restoredEditedAssistant.entryId === editedAssistant.entryId,
                        "the assistant edit action produces canonical message data that survives save serialization and reload",
                        { savedEditedAssistant, restoredEditedAssistant },
                    );
                } finally {
                    showPrompt = originalShowPromptForAssistantEdit;
                    generateReply = originalGenerateReplyForAssistantEdit;
                    runImmediateChecksForMutatedMessage =
                        originalImmediateChecksForAssistantEdit;
                    app.busy = false;
                    app.queue = [];
                }
            }

            {
                app.messages = [
                    {
                        id: "auto-player-mutation-user",
                        entryId: 1,
                        role: "user",
                        speaker: "Message Tester",
                        text: "Auto-player turn text.",
                        at: new Date().toISOString(),
                        source: "auto_player",
                        autoTurn: true,
                        stateSyncStatus: "pending",
                    },
                    {
                        id: "auto-player-mutation-assistant",
                        entryId: 2,
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Stale auto-player combined response.",
                        at: new Date().toISOString(),
                        replySource: "auto_player",
                        relatedMessageIds: ["auto-player-mutation-user"],
                        stateSyncStatus: "pending",
                    },
                    {
                        id: "auto-player-mutation-tail",
                        entryId: 3,
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Stale later auto-player message.",
                        at: new Date().toISOString(),
                        stateSyncStatus: "pending",
                    },
                ];
                const autoPlayerMutationCancelled = configureRunningStateSyncForSmoke({
                    startMessageId: "auto-player-mutation-user",
                    blockStartEntryId: 1,
                    blockEndEntryId: 2,
                    processingMessageIds: [
                        "auto-player-mutation-user",
                        "auto-player-mutation-assistant",
                    ],
                    activeCheckMessageIds: ["auto-player-mutation-assistant"],
                });
                const autoPlayerMutation = prepareMessageStateMutation(
                    findMessageById("auto-player-mutation-user"),
                    { mode: "edit", reason: "auto-player mutation smoke" },
                );
                devAssert(
                    autoPlayerMutation &&
                        autoPlayerMutationCancelled() &&
                        !!findMessageById("auto-player-mutation-user") &&
                        !findMessageById("auto-player-mutation-assistant") &&
                        !findMessageById("auto-player-mutation-tail") &&
                        app.stateSync.running === false,
                    "auto-player story messages use the same block-aware mutation reset rules as normal player messages",
                    {
                        autoPlayerMutation,
                        messages: app.messages,
                        stateSync: app.stateSync,
                    },
                );
            }

            {
                const originalShowConfirmForContinueDelete = showConfirm;
                const originalImmediateRangeForContinueDelete =
                    runImmediateChecksForMutatedRange;
                let continueDeleteRangeIds = [];
                try {
                    app.messages = [
                        {
                            id: "continue-delete",
                            entryId: 1,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Continue assistant reply.",
                            at: new Date().toISOString(),
                            replySource: "continue",
                            stateSyncStatus: "pending",
                        },
                        {
                            id: "continue-delete-tail",
                            entryId: 2,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Later stale continuation.",
                            at: new Date().toISOString(),
                            stateSyncStatus: "pending",
                        },
                    ];
                    showConfirm = async () => true;
                    runImmediateChecksForMutatedRange = async (messages) => {
                        continueDeleteRangeIds = messages.map((message) => message.id);
                        return true;
                    };
                    await deleteMessage("continue-delete");
                    devAssert(
                        !findMessageById("continue-delete") &&
                            !findMessageById("continue-delete-tail") &&
                            continueDeleteRangeIds.length === 0,
                        "Continue assistant delete executes safely and removes the continuation plus later stale messages",
                        {
                            messages: app.messages,
                            continueDeleteRangeIds,
                        },
                    );
                } finally {
                    showConfirm = originalShowConfirmForContinueDelete;
                    runImmediateChecksForMutatedRange =
                        originalImmediateRangeForContinueDelete;
                    app.busy = false;
                }
            }

            addMessage("system", "Message actions smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: message-actions-smoke");
        }

        async function devRunRuntimeDisplayReferenceMapSmokeTest() {
            devTestLog("Scenario start: runtime-display-reference-map-smoke");
            const state = {
                player: { id: "map-player", name: "Morgan Lee", gender: "male" },
                characters: {
                    "Map Ally": { id: "map-ally", name: "Dara Vale", gender: "female" },
                },
                npc_directory: {
                    locations: {
                        "map-lounge": {
                            characters: {
                                "Map Keeper": {
                                    id: "map-keeper-shell",
                                    full_character: {
                                        id: "map-keeper",
                                        name: "Captain Rhea",
                                        gender: "female",
                                    },
                                },
                            },
                        },
                    },
                },
                future_cast: {
                    items: {
                        "map-scout": {
                            character_id: "map-scout",
                            full_character: {
                                id: "map-scout",
                                name: "Ilan Cross",
                                gender: "male",
                            },
                        },
                    },
                },
                __runtimeTemplateReferenceNames: {
                    "map-ally": "Dara Wind",
                    "map-keeper": "Captain Rhea",
                    "map-scout": "Ilan Cross",
                },
            };
            const source = {
                title: "|[character:map-ally]| meets |[character:map-keeper]|.",
                nested: [
                    "|[character_first:map-ally]| tells |[character:map-scout]| that |[player_first_name]| trusts |[character:map-ally]|.",
                    "|[character_subject_pronoun-cap:map-ally]| watches |[player_object_pronoun]| while |[character:missing]| remains unknown.",
                    "|[character_independent_possessive_pronoun:map-ally]| |[character_person_term:map-ally]| |[character_honorific:map-ally]| |[character_formal_address:map-ally]| |[character_monarch_title:map-ally]| |[character_royal_heir_title:map-ally]| |[character_noble_title:map-ally]| |[character_spouse_term:map-ally]| |[character_parent_term:map-ally]| |[character_child_term:map-ally]| |[character_sibling_term:map-ally]| |[character_uncle_aunt_term:map-ally]| |[character_nephew_niece_term:map-ally]| |[character_monarch_title_cap:map-ally]|",
                    "|[player_independent_possessive_pronoun]| |[player_person_term]| |[player_honorific]| |[player_formal_address]| |[player_monarch_title]| |[player_royal_heir_title]| |[player_noble_title]| |[player_spouse_term]| |[player_parent_term]| |[player_child_term]| |[player_sibling_term]| |[player_uncle_aunt_term]| |[player_nephew_niece_term]| |[player_formal_address_cap]|",
                ],
            };
            const replacements = buildRuntimeDisplayReferenceMap(state);
            const materialized = materializeRuntimeDisplayReferences(source, state);
            devAssert(
                replacements.get("character:map-ally:name") === "Dara Wind" &&
                    replacements.get("character:map-ally:subject-cap") === "She" &&
                    replacements.get("character:map-ally:independent-possessive") === "hers" &&
                    replacements.get("character:map-ally:monarch-title-cap") === "Queen" &&
                    replacements.get("character:map-scout:name") === "Ilan Cross" &&
                    replacements.get("player:first") === "Morgan" &&
                    replacements.get("player:independent-possessive") === "his" &&
                    replacements.get("player:formal-address-cap") === "Sir",
                "runtime display reference map resolves materialized names, pronouns, and gendered terms for player, cast, NPC, and future cast aliases",
                { replacements: Object.fromEntries(replacements) },
            );
            devAssert(
                materialized.title === "Dara Wind meets Captain Rhea." &&
                    materialized.nested[0] === "Dara tells Ilan Cross that Morgan trusts Dara Wind." &&
                    materialized.nested[1] === "She watches him while [missing character: missing] remains unknown." &&
                    materialized.nested[2] ===
                        "hers woman Ms. ma'am queen princess lady wife mother daughter sister aunt niece Queen" &&
                    materialized.nested[3] ===
                        "his man Mr. sir king prince lord husband father son brother uncle nephew Sir" &&
                    source.title === "|[character:map-ally]| meets |[character:map-keeper]|.",
                "runtime display reference map materializes every supported gendered value once without mutating authored source text",
                { source, materialized },
            );
            const femaleSelf = {
                id: "self-reference-smoke",
                name: "Aurelia Emberlash",
                gender: "female",
                personality_description:
                    "|[character]| trusts |[character_possessive_pronoun]| judgment and protects |[character_reflexive_pronoun]|.",
                speech_style: "|[character_subject_pronoun_cap]| speaks carefully.",
                appearance: {},
                outfits: [],
            };
            const selfText = resolveRuntimeMessageTemplateText(
                femaleSelf.personality_description,
                state,
                { selfCharacter: femaleSelf },
            );
            const allSelfText = resolveRuntimeMessageTemplateText(
                "|[character_first]| |[character_subject_pronoun_cap]| |[character_object_pronoun]| |[character_possessive_pronoun]| |[character_independent_possessive_pronoun]| |[character_reflexive_pronoun]| |[character_person_term]| |[character_honorific]| |[character_formal_address]| |[character_monarch_title]| |[character_royal_heir_title]| |[character_noble_title]| |[character_spouse_term]| |[character_parent_term]| |[character_child_term]| |[character_sibling_term]| |[character_uncle_aunt_term]| |[character_nephew_niece_term]|",
                state,
                { selfCharacter: femaleSelf },
            );
            const recursivelyMaterializedSelf = materializeRuntimeDisplayReferences({
                character_definition: femaleSelf,
            });
            const femaleConditional = materializeRuntimeConditionalText(
                "Veyra trusts |[M|her brother Aurek|her sister Aurelia]|.",
                ["female"],
            );
            const maleConditional = materializeRuntimeConditionalText(
                "Veyra trusts |[F|her brother Aurek|her sister Aurelia]|.",
                ["male"],
            );
            const defaultConditional = materializeRuntimeConditionalText(
                "Veyra trusts |[M|her brother Aurek|her sister Aurelia]|.",
                ["male", "female"],
            );
            devAssert(
                selfText ===
                    "Aurelia Emberlash trusts her judgment and protects herself." &&
                    allSelfText ===
                        "Aurelia She her her hers herself woman Ms. ma'am queen princess lady wife mother daughter sister aunt niece" &&
                    recursivelyMaterializedSelf.character_definition.speech_style ===
                        "She speaks carefully." &&
                    femaleConditional === "Veyra trusts her sister Aurelia." &&
                    maleConditional === "Veyra trusts her brother Aurek." &&
                    defaultConditional === "Veyra trusts her brother Aurek.",
                "character-definition self references and strict M/F presentation text resolve without a character-library lookup",
                {
                    selfText,
                    allSelfText,
                    recursivelyMaterializedSelf,
                    femaleConditional,
                    maleConditional,
                    defaultConditional,
                },
            );
            const validSelfErrors = runtimeReferenceValueValidationErrors(
                femaleSelf,
                "character_definition",
                new Set(["self-reference-smoke"]),
                femaleSelf,
            );
            const invalidContextErrors = runtimeReferenceValueValidationErrors(
                { summary: "|[character]| waits." },
                "story",
                new Set(),
            );
            const malformedConditionalErrors = runtimeReferenceValueValidationErrors(
                { summary: "|[M|only one branch]|" },
                "story",
                new Set(),
            );
            devAssert(
                validSelfErrors.length === 0 &&
                    invalidContextErrors.some((error) =>
                        /only inside a character definition/i.test(error.message),
                    ) &&
                    malformedConditionalErrors.some((error) =>
                        /malformed presentation text token/i.test(error.message),
                    ),
                "reference validation accepts self references only in character definitions and rejects malformed presentation text",
                {
                    validSelfErrors,
                    invalidContextErrors,
                    malformedConditionalErrors,
                },
            );
            devTestLog("Scenario complete: runtime-display-reference-map-smoke");
        }

        async function devRunVoiceSegmentSmokeTest() {
            devTestLog("Scenario start: voice-segment-smoke");
            devResetForLiveTest("voice-segment-smoke");
            devCreateTestProfile({  });
            devInstallSmokeVoiceCache([
                { name: "Narrator Voice", lang: "en-US" },
                { name: "Default Female Voice", lang: "en-US" },
                { name: "Default Male Voice", lang: "en-US" },
            ]);
            app.settings.swapAllGendersToPreferred = false;
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "gate-room",
                    specific_place: "Gate Room",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Voice Tester",
                    age: 24,
                    gender: "male",
                },
            });
            app.settings.narratorVoiceName = "Narrator Voice";
            app.settings.voiceGenderMap ||= {};
            app.settings.voiceGenderMap["Default Female Voice"] = "female";
            app.settings.voiceGenderMap["Default Male Voice"] = "male";
            app.state.characters = {
                "Daniel Mercer": {
                    ...blankCharacterTemplate("Danielle Mercer"),
                    name: "Danielle Mercer",
                    fallback_name: "Daniel Mercer",
                    gender: "female",
                    romanceable: true,
                    fallback_outfits: [
                        {
                            id: "daniel-suit",
                            name: "Daniel Suit",
                            clothing: { shirt: "fake suit shirt", pants: "fake suit pants" },
                        },
                    ],
                    fallback_starting_outfit_id: "daniel-suit",
                    personality_description: "|[character_first:daniel-mercer]| is direct and brave. |[character_pronoun_cap:daniel-mercer]| trusts |[player_object_pronoun]|.",
                    speech_style: "|[character_first:daniel-mercer]| speaks with blunt confidence.",
                    known_facts: ["|[character:daniel-mercer]| arrived from Earth."],
                    appearance: { ...blankAppearanceTemplate() },
                    voice: "",
                },
            };
            const adaptedOpeningNameText = resolveRuntimeMessageTemplateText(
                '(|[character:daniel-mercer]|) "|[character:daniel-mercer]|." |[character_first:daniel-mercer]| |[character_pronoun_cap:daniel-mercer]| trusts |[player_object_pronoun]| and carries |[character_possessive_pronoun:daniel-mercer]| pack by |[character_reflexive_pronoun:daniel-mercer]|. |[player_first_name]| |[player_pronoun_cap]| |[unknown-placeholder]| |[character:missing-person]|',
                app.state,
            );
            devAssert(
                adaptedOpeningNameText ===
                    '(Danielle Mercer) "Danielle Mercer." Danielle She trusts him and carries her pack by herself. Voice He [unknown reference: unknown-placeholder] [missing character: missing-person]',
                "explicit opening message character reference tokens resolve full names, names, and gender-aware pronouns to the current presentation and flag unknown tokens",
                adaptedOpeningNameText,
            );
            app.state.characters["Daniel Mercer"].relationship_to_player =
                "Married to |[character:daniel-mercer]|.";
            app.state.future_cast = {
                items: {
                    "future-friend": {
                        name: "Future Friend",
                        full_character: {
                            ...blankCharacterTemplate("Future Friend"),
                            name: "Future Friend",
                            fallback_name: "Future Fellow",
                            gender: "female",
                        },
                    },
                },
            };
            app.state.scene ||= {};
            app.state.scene.summary = "|[character:daniel-mercer]| waits at the gate.";
            app.state.scene.party_members_present = ["Daniel Mercer"];
            app.state.npc_directory = {
                locations: {
                    "Test Hall": {
                        label: "Test Hall",
                        characters: {
                            "Captain Rook": {
                                name: "Captain Rhea",
                                fallback_name: "Captain Rook",
                                gender: "female",
                                role: "guard captain",
                                romanceable: false,
                                fallback_outfits: [
                                    {
                                        id: "rook-armor",
                                        name: "Rook Armor",
                                        clothing: {
                                            shirt: "fake guard shirt",
                                            pants: "fake guard pants",
                                        },
                                    },
                                ],
                                full_character: {
                                    ...blankCharacterTemplate("Captain Rhea"),
                                    name: "Captain Rhea",
                                    fallback_name: "Captain Rook",
                                    gender: "female",
                                    romanceable: false,
                                    fallback_outfits: [
                                        {
                                            id: "rook-armor",
                                            name: "Rook Armor",
                                            clothing: {
                                                shirt: "fake guard shirt",
                                                pants: "fake guard pants",
                                            },
                                        },
                                    ],
                                    fallback_starting_outfit_id: "rook-armor",
                                    personality_description: "Rook watches for danger.",
                                    known_facts: ["|[character:captain-rook]| guards the test hall."],
                                    appearance: { ...blankAppearanceTemplate() },
                                },
                                inspected: true,
                            },
                        },
                    },
                },
            };
            app.state.scene.npcs_present = ["Captain Rook"];
            app.messages = [
                {
                    id: "presentation-history",
                    entryId: 1,
                    role: "assistant",
                    speaker: "Narrator",
                    text:
                        "|[character_first:daniel-mercer]| walks beside |[character:captain-rook]|. |[character_first:daniel-mercer]| nods.",
                    at: new Date().toISOString(),
                    stateSyncStatus: "synced",
                },
            ];
            app.state.objectives = {
                active_id: "explicit-character-token",
                items: [
                    {
                        id: "explicit-character-token",
                        title: "Find |[character:daniel-mercer]|",
                        summary: "Speak with |[character:daniel-mercer]|.",
                        status: "active",
                    },
                ],
            };
            app.state = materializeRuntimeSavePresentations(app.state);
            app.state = materializeRuntimeDisplayReferences(app.state, app.state);
            app.messages = materializeRuntimeDisplayReferences(app.messages, app.state);
            app.state.player.profile_image_id = "";
            for (const character of Object.values(app.state.characters || {}))
                character.profile_image_id = "";
            for (const location of Object.values(app.state.npc_directory?.locations || {}))
                for (const npc of Object.values(location?.characters || {})) {
                    npc.profile_image_id = "";
                    if (npc.full_character) npc.full_character.profile_image_id = "";
                }
            finalizeRuntimeCharacterNameKeys(app.state);
            const tokenPromptStateText = compactJson(stateForAiPrompt(app.state));
            const tokenReplyStateText = compactJson(buildReplyStateContext());
            const tokenChatContext = replyPromptConversationContextText();
            const expectedPlayerObjectPronoun =
                buildRuntimeDisplayReferenceMap(app.state).get("player:object");
            const explicitReferenceChecks = {
                promptHasRelationship:
                    tokenPromptStateText.includes("Married to Danielle Mercer."),
                promptHasSceneSummary:
                    tokenPromptStateText.includes("Danielle Mercer waits at the gate."),
                promptHasPersonality:
                    tokenPromptStateText.includes(
                        `Danielle is direct and brave. She trusts ${expectedPlayerObjectPronoun}.`,
                    ),
                promptHasSpeechStyle:
                    tokenPromptStateText.includes("Danielle speaks with blunt confidence."),
                promptHasNpcFact:
                    tokenPromptStateText.includes("Captain Rhea guards the test hall."),
                replyHasCharacter: tokenReplyStateText.includes("Danielle Mercer"),
                replyHasNpc: tokenReplyStateText.includes("Captain Rhea"),
                chatHasResolvedNames:
                    tokenChatContext.syncedChatContext.includes("Danielle walks beside Captain Rhea."),
                promptHasNoFallbackNames:
                    !/Daniel Mercer|Daniel walks|Captain Rook|fallback_name|fallback_outfits|fallback_gender|romanceable/.test(tokenPromptStateText),
                replyHasNoFallbackNames:
                    !/Daniel Mercer|Daniel walks|Captain Rook|fallback_name|fallback_outfits|fallback_gender|romanceable/.test(tokenReplyStateText),
                chatHasNoFallbackNames:
                    !/Daniel Mercer|Daniel walks|Captain Rook/.test(tokenChatContext.syncedChatContext),
                storedObjectiveMaterialized:
                    sceneObjectiveLabel(app.state) === "Speak with Danielle Mercer.",
                storedMessageMaterialized:
                    app.messages[0]?.text === "Danielle walks beside Captain Rhea. Danielle nods.",
                runtimeDisplayResolvesTokens:
                    displayRuntimeTemplateText("|[character_first:daniel-mercer]|") ===
                    "Danielle",
            };
            const authoredObjectiveSummary =
                "Ask |[character:daniel-mercer]| what happened.";
            const authoredObjectiveTitle =
                "Begin private appointment with |[character:daniel-mercer]|";
            const originalObjectiveSummary =
                app.state.objectives.items[0].summary;
            const originalObjectiveTitle = app.state.objectives.items[0].title;
            app.state.objectives.items[0].summary = authoredObjectiveSummary;
            app.state.objectives.items[0].title = authoredObjectiveTitle;
            const displayedObjectiveSummary = displayRuntimeTemplateText(
                authoredObjectiveSummary,
            );
            const displayedObjectiveTitle = displayRuntimeTemplateText(
                authoredObjectiveTitle,
            );
            app.state.objectives.items[0].summary = originalObjectiveSummary;
            app.state.objectives.items[0].title = originalObjectiveTitle;
            explicitReferenceChecks.objectiveCardDisplayResolvesReference =
                displayedObjectiveSummary ===
                "Ask Danielle Mercer what happened.";
            explicitReferenceChecks.objectiveTitleDisplayResolvesReference =
                displayedObjectiveTitle ===
                "Begin private appointment with Danielle Mercer";
            const failedExplicitReferenceChecks = Object.entries(explicitReferenceChecks)
                .filter(([, value]) => !value)
                .map(([key]) => key);
            if (failedExplicitReferenceChecks.length)
                devTestLog("Explicit character reference prompt projection", {
                    failedExplicitReferenceChecks,
                    personalityProjection:
                        tokenPromptStateText.match(/.{0,120}direct and brave.{0,240}/i)?.[0] ||
                        "missing",
                });
            devAssert(
                    !failedExplicitReferenceChecks.length,
                `explicit character reference tokens materialize once before prompt and display use without runtime name rewriting${
                    failedExplicitReferenceChecks.length
                        ? `; failed checks: ${failedExplicitReferenceChecks.join(", ")}`
                        : ""
                }`,
                {
                    explicitReferenceChecks,
                    tokenPromptStateText,
                    tokenReplyStateText,
                    tokenChatContext: tokenChatContext.syncedChatContext,
                    storedObjectiveSummary: sceneObjectiveLabel(app.state),
                    displayedObjectiveSummary,
                },
            );
            const invalidReferenceTokenStory = devSmokeTemplateRecord({
                id: "invalid-reference-token-story",
                title: "Invalid Reference Token Story",
                description: "Fake validation story for reference tokens.",
            });
            invalidReferenceTokenStory.state.objectives.items[0].title =
                "Find |[character:not-real]|";
            const invalidReferenceTokenResult = validateStoryDefinition(invalidReferenceTokenStory);
            devAssert(
                !invalidReferenceTokenResult.ok &&
                    validationErrorsText(invalidReferenceTokenResult).includes(
                        "Character reference token does not resolve",
                    ),
                "story validation rejects unresolved character reference tokens",
                invalidReferenceTokenResult,
            );
            const lazyFutureVoiceDefinition = blankCharacterTemplate("Lazy Future Voice");
            lazyFutureVoiceDefinition.name = "Lazy Future Voice";
            lazyFutureVoiceDefinition.gender = "female";
            delete lazyFutureVoiceDefinition.voice;
            delete lazyFutureVoiceDefinition.runtime_voice;
            const lazyFutureVoiceState = repairAiGeneratedState({
                ...clone(defaultState),
                future_cast: {
                    enabled: true,
                    items: {
                        "lazy-future-voice": {
                            id: "lazy-future-voice",
                            name: "Lazy Future Voice",
                            full_character: lazyFutureVoiceDefinition,
                        },
                    },
                },
            });
            const sanitizedLazyFutureVoice =
                lazyFutureVoiceState.future_cast.items["lazy-future-voice"];
            devAssert(
                !savedCharacterVoiceName(sanitizedLazyFutureVoice) &&
                    !sanitizedLazyFutureVoice.runtime_voice &&
                    !savedCharacterVoiceName(sanitizedLazyFutureVoice.full_character) &&
                    !sanitizedLazyFutureVoice.full_character.runtime_voice,
                "future cast sanitization leaves voice assignment lazy until the character speaks",
                sanitizedLazyFutureVoice,
            );
            const lazyFuturePlaybackVoice = playbackVoiceForCharacter(
                sanitizedLazyFutureVoice.full_character,
                "Lazy Future Voice",
            );
            devAssert(
                !!lazyFuturePlaybackVoice &&
                    savedCharacterVoiceName(sanitizedLazyFutureVoice.full_character) ===
                        lazyFuturePlaybackVoice,
                "future cast character receives and stores a voice only at playback time",
                {
                    lazyFuturePlaybackVoice,
                    character: sanitizedLazyFutureVoice.full_character,
                },
            );
            const lazyVoiceCharacter = app.state.characters["Danielle Mercer"];
            const lazyVoice = playbackVoiceForCharacter(lazyVoiceCharacter, "Danielle Mercer");
            devAssert(
                !!lazyVoice &&
                    lazyVoiceCharacter.voice === lazyVoice &&
                    voiceMatchesCharacterGender(lazyVoice, lazyVoiceCharacter),
                "character voice is lazily assigned and stored when a speaking character has no concrete voice",
                { lazyVoice, character: lazyVoiceCharacter },
            );
            const lazyNpcShell = {
                name: "Mara Caine",
                gender: "female",
                role: "smoke NPC shell",
                inspected: false,
            };
            app.state.npc_directory.locations["Test Hall"].characters["Mara Caine"] =
                lazyNpcShell;
            app.state.scene.npcs_present.push("Mara Caine");
            const resolvedLazyNpcShell = voiceCharacterForSpeaker("Mara Caine");
            const lazyNpcShellVoice = playbackVoiceForCharacter(
                resolvedLazyNpcShell,
                "Mara Caine",
            );
            const replayLazyNpcShellVoice = playbackVoiceForCharacter(
                voiceCharacterForSpeaker("Mara Caine"),
                "Mara Caine",
            );
            devAssert(
                !!lazyNpcShellVoice &&
                    lazyNpcShell.voice === lazyNpcShellVoice &&
                    replayLazyNpcShellVoice === lazyNpcShellVoice,
                "NPC shell voice assignment persists on the stored shell and is reused on replay",
                {
                    storedVoice: lazyNpcShell.voice || "",
                    lazyNpcShellVoice,
                    replayLazyNpcShellVoice,
                },
            );
            const embeddedNpc = getNpcEntry("Captain Rhea");
            const embeddedNpcCharacter = embeddedNpc?.full_character;
            embeddedNpcCharacter.voice = {
                gender_bucket: "non_male",
                preferred_voice_name: "",
            };
            const embeddedNpcVoice = playbackVoiceForCharacter(
                embeddedNpcCharacter,
                "Captain Rhea",
            );
            const replayEmbeddedNpcVoice = playbackVoiceForCharacter(
                voiceCharacterForSpeaker("Captain Rhea"),
                "Captain Rhea",
            );
            devAssert(
                !!embeddedNpcVoice &&
                    embeddedNpcCharacter.runtime_voice === embeddedNpcVoice &&
                    replayEmbeddedNpcVoice === embeddedNpcVoice &&
                    isPlainObject(embeddedNpcCharacter.voice),
                "embedded NPC definition keeps immutable voice metadata while its runtime playback voice persists",
                {
                    embeddedNpcCharacter,
                    embeddedNpcVoice,
                    replayEmbeddedNpcVoice,
                },
            );
            app.state.temp_speakers ||= {};
            app.state.temp_speakers.Somara = {
                name: "Somara",
                gender: "female",
                voice: "Default Female Voice",
            };
            app.state.temp_speakers.Litia = {
                name: "Litia",
                gender: "female",
                voice: "Default Female Voice",
            };
            const nameOnlyTag = parseInlineVoiceTag("Somara");
            const unknownNameOnlyTag = parseInlineVoiceTag("Missing Speaker");
            const descriptorOnlyTag = parseInlineVoiceTag("Servant Woman");
            devAssert(
                nameOnlyTag?.speaker === "Somara" &&
                    nameOnlyTag.gender === "female" &&
                    nameOnlyTag.explicitGender === false &&
                    unknownNameOnlyTag?.unresolvedDescriptor === true &&
                    descriptorOnlyTag?.speaker === "Servant Woman" &&
                    descriptorOnlyTag.unresolvedDescriptor === true,
                "name-only inline voice tags resolve known speakers and preserve role descriptors for NPC repair",
                { nameOnlyTag, unknownNameOnlyTag, descriptorOnlyTag },
            );

            const taggedParts = splitVoiceParts(
                '(Somara) "First warning." She grabs his wrist. "Second warning."',
            );
            const taggedDialogue = taggedParts.filter(
                (part) => part.kind === "dialogue",
            );
            devAssert(
                taggedDialogue.length === 2 &&
                    taggedDialogue.every((part) => part.speaker === "Somara"),
                "inline voice tags stay sticky for later untagged quotes in the same message",
                taggedParts,
            );
            const parentheticalNarrationText =
                '(Somara) Take cover. "Now." She points east. (Director Vellis female) I follow.';
            const parentheticalNarrationVisible = assistantVisibleMessageText(
                parentheticalNarrationText,
            );
            const parentheticalNarrationParts = splitVoiceParts(
                parentheticalNarrationText,
            );
            const somaraLabelPart = parentheticalNarrationParts.find(
                (part) => part.kind === "narration" && part.text === "Somara",
            );
            const somaraNarrationPart = parentheticalNarrationParts.find(
                (part) => part.kind === "narration" && part.text === "Take cover.",
            );
            const directorLabelPart = parentheticalNarrationParts.find(
                (part) =>
                    part.kind === "narration" && part.text === "Director Vellis",
            );
            const playerNarrationPart = parentheticalNarrationParts.find(
                (part) => part.kind === "narration" && part.text === "I follow.",
            );
            const parentheticalDialoguePart = parentheticalNarrationParts.find(
                (part) => part.kind === "dialogue" && part.text === "Now.",
            );
            const formattedParentheticalNarration = formatMessage(
                parentheticalNarrationVisible,
            );
            devAssert(
                !parentheticalNarrationVisible.includes("(Somara)") &&
                    !parentheticalNarrationVisible.includes("(Director Vellis female)") &&
                    parentheticalNarrationVisible.includes("Somara") &&
                    parentheticalNarrationVisible.includes("Director Vellis") &&
                    somaraLabelPart?.speaker === "" &&
                    somaraNarrationPart?.speaker === "" &&
                    parentheticalDialoguePart?.speaker === "Somara" &&
                    directorLabelPart?.speaker === "" &&
                    playerNarrationPart?.speaker === "" &&
                    formattedParentheticalNarration.includes("story-voice-label") &&
                    parentheticalNarrationParts.every(
                        (part) =>
                            Number.isFinite(Number(part.start)) &&
                            Number.isFinite(Number(part.end)) &&
                            parentheticalNarrationVisible.slice(part.start, part.end) ===
                                part.text,
                    ),
                "parenthesized speaker names switch the active read voice for dialogue while narration remains narrator-voiced",
                {
                    parentheticalNarrationVisible,
                    parentheticalNarrationParts,
                    formattedParentheticalNarration,
                },
            );
            devAssert(
                assistantVisibleMessageText("She waits (quietly).") ===
                    "She waits (quietly).",
                "non-speaker parentheticals remain visible prose",
            );
            const descriptorVisibleTag = parseAssistantResponseMetadata(
                '(Servant Woman) "Ten years, sir."',
            );
            devAssert(
                !descriptorVisibleTag.visibleText.includes("(Servant Woman)") &&
                    descriptorVisibleTag.visibleText.includes('"Ten years, sir."'),
                "role-described speaker voice tags stay hidden while awaiting proper NPC repair",
                descriptorVisibleTag,
            );
            const narratedAction = '(Chuckles low in her throat, dark eyes turning back toward the table.) "I heard you."';
            devAssert(
                extractInlineVoiceTagSpeakers(narratedAction).length === 0 &&
                    assistantVisibleMessageText(narratedAction).includes('Chuckles low in her throat'),
                "narrated parenthetical actions before dialogue do not trigger speaker repair",
            );
            const parsedVisibleTag = parseAssistantResponseMetadata(
                '(Litia female) "Stay behind cover."',
            );
            devAssert(
                !parsedVisibleTag.visibleText.includes("(Litia female)") &&
                    parsedVisibleTag.visibleText.includes('"Stay behind cover."'),
                "assistant response parsing hides the only speaker voice tag label while keeping the dialogue visible",
                parsedVisibleTag,
            );
            const singleSpeakerTaggedText =
                '(Somara) "First warning." She points east. (Somara) "Second warning."';
            const singleSpeakerVisible = assistantVisibleMessageText(
                singleSpeakerTaggedText,
            );
            const singleSpeakerParts = splitVoiceParts(singleSpeakerTaggedText);
            devAssert(
                !singleSpeakerVisible.includes("(Somara)") &&
                    !singleSpeakerVisible.includes("Somara") &&
                    singleSpeakerParts.every(
                        (part) =>
                            part.text !== "Somara" &&
                            (part.kind !== "dialogue" || part.speaker === "Somara"),
                    ) &&
                    singleSpeakerParts.filter(
                        (part) => part.kind === "dialogue",
                    ).length === 2,
                "single-speaker voice-tag messages hide all tag labels visibly and audibly while keeping that speaker active",
                { singleSpeakerVisible, singleSpeakerParts },
            );
            const repeatedActiveTagText =
                '(Somara) "First." (Somara) "Second." (Director Vellis female) "Third." (Director Vellis female) "Fourth."';
            const repeatedActiveVisible = assistantVisibleMessageText(
                repeatedActiveTagText,
            );
            const repeatedActiveParts = splitVoiceParts(repeatedActiveTagText);
            const repeatedLabels = repeatedActiveParts.filter(
                (part) =>
                    part.kind === "narration" &&
                    (part.text === "Somara" || part.text === "Director Vellis"),
            );
            devAssert(
                (repeatedActiveVisible.match(/\bSomara\b/g) || []).length === 1 &&
                    (repeatedActiveVisible.match(/\bDirector Vellis\b/g) || [])
                        .length === 1 &&
                    repeatedLabels.length === 2 &&
                    repeatedLabels[0]?.text === "Somara" &&
                    repeatedLabels[1]?.text === "Director Vellis" &&
                    repeatedActiveParts.filter(
                        (part) => part.kind === "dialogue" && part.speaker === "Somara",
                    ).length === 2 &&
                    repeatedActiveParts.filter(
                        (part) =>
                            part.kind === "dialogue" &&
                            part.speaker === "Director Vellis",
                    ).length === 2,
                "repeated active voice tags are skipped visibly and audibly while speaker changes still show one label",
                { repeatedActiveVisible, repeatedActiveParts },
            );
            const playerThenNarratorText =
                '(Voice Tester) "Oh no."\n\nIt is still active.\n\n(Litia female) "Who is there!?"';
            const playerThenNarratorVisible =
                assistantVisibleMessageText(playerThenNarratorText);
            const playerThenNarratorParts = splitVoiceParts(playerThenNarratorText);
            const playerLabelPart = playerThenNarratorParts.find(
                (part) => part.kind === "narration" && part.text === "Voice Tester",
            );
            const playerDialoguePart = playerThenNarratorParts.find(
                (part) => part.kind === "dialogue" && part.text === "Oh no.",
            );
            const playerDialogueVoiceTarget = voiceTargetForPart(
                playerDialoguePart,
                null,
            );
            const middleNarrationPart = playerThenNarratorParts.find(
                (part) =>
                    part.kind === "narration" && part.text === "It is still active.",
            );
            const litiaLabelPart = playerThenNarratorParts.find(
                (part) => part.kind === "narration" && part.text === "Litia",
            );
            const litiaDialoguePart = playerThenNarratorParts.find(
                (part) => part.kind === "dialogue" && part.text === "Who is there!?",
            );
            devAssert(
                !playerThenNarratorVisible.includes("(Voice Tester)") &&
                    !playerThenNarratorVisible.includes("(Litia female)") &&
                    playerLabelPart?.speaker === "" &&
                    playerDialoguePart?.speaker === "Voice Tester" &&
                    playerDialogueVoiceTarget.useCharacter === true &&
                    playerDialogueVoiceTarget.gender === app.state.player.gender &&
                    middleNarrationPart?.speaker === "" &&
                    litiaLabelPart?.speaker === "" &&
                    litiaDialoguePart?.speaker === "Litia" &&
                    playerThenNarratorParts.every(
                        (part) =>
                            playerThenNarratorVisible.slice(part.start, part.end) ===
                            part.text,
                    ),
                "player quote tags do not make later narrator prose read as the player",
                {
                    playerThenNarratorVisible,
                    playerThenNarratorParts,
                    playerDialogueVoiceTarget,
                },
            );
            const playerReadText =
                '"First player line." The player continues speaking without another quote. *They move to better cover.* "Last player line."';
            const playerReadParts = playerVoicePartsForText(playerReadText);
            const playerReadVoiceTargets = playerReadParts.map((part) =>
                voiceTargetForPart(
                    part,
                    part.speaker === "Player" ? app.state.player : null,
                ),
            );
            devAssert(
                playerReadParts.length === 4 &&
                    playerReadParts[0].speaker === "Player" &&
                    playerReadParts[0].text === "First player line." &&
                    playerReadParts[1].speaker === "Player" &&
                    playerReadParts[1].text === "The player continues speaking without another quote." &&
                    playerReadParts[2].speaker === "" &&
                    playerReadParts[2].text === "*They move to better cover.*" &&
                    playerReadParts[3].speaker === "Player" &&
                    playerReadParts[3].text === "Last player line." &&
                    playerReadVoiceTargets[0]?.useCharacter === true &&
                    playerReadVoiceTargets[1]?.useCharacter === true &&
                    playerReadVoiceTargets[2]?.useCharacter === false &&
                    playerReadVoiceTargets[3]?.useCharacter === true &&
                    cleanSpeechText(playerReadParts[0].text, {
                        preserveInlineVoiceTags: true,
                        stripWrappingQuotes: true,
                    }) === "First player line." &&
                    cleanSpeechText(playerReadParts[3].text, {
                        preserveInlineVoiceTags: true,
                        stripWrappingQuotes: true,
                    }) === "Last player line." &&
                    playerReadParts.every(
                        (part) =>
                            Number.isFinite(Number(part.start)) &&
                            Number.isFinite(Number(part.end)) &&
                            playerReadText.slice(part.start, part.end) === part.text,
                    ),
                "player message reading keeps unquoted player prose in the player voice while explicit action markup uses narrator voice",
                { playerReadParts, playerReadVoiceTargets },
            );
            const savedActiveVoiceMessageId = app.activeVoiceMessageId;
            const savedVoicePaused = app.voicePaused;
            app.activeVoiceMessageId = "previous-message";
            app.voicePaused = false;
            devAssert(
                shouldAppendVoiceRead("player-message", {}) === true &&
                    shouldAppendVoiceRead("previous-message", {}) === false,
                "queued player/assistant reads append behind an active different message instead of canceling it",
                {
                    activeVoiceMessageId: app.activeVoiceMessageId,
                    appendDifferent: shouldAppendVoiceRead("player-message", {}),
                    appendSame: shouldAppendVoiceRead("previous-message", {}),
                },
            );
            app.activeVoiceMessageId = savedActiveVoiceMessageId;
            app.voicePaused = savedVoicePaused;

            const singleSpeakerMessage = {
                id: "voice-segment-single-speaker",
                entryId: nextEntryId(),
                role: "assistant",
                speaker: "Narrator",
                text: '"First warning." She grabs his wrist. "Second warning."',
                voiceSpeakers: ["Somara"],
                voiceMeta: { speak: { A: "Somara" } },
                at: new Date().toISOString(),
            };
            app.messages.push(singleSpeakerMessage);
            rebuildMessageIndex();
            const fallbackDialogue = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(singleSpeakerMessage.text),
                "voice-segment-single-speaker",
            ).filter((part) => part.kind === "dialogue");
            devAssert(
                fallbackDialogue.length === 2 &&
                    fallbackDialogue.every((part) => part.speaker === "Somara"),
                "single-speaker metadata makes later untagged quotes inherit that speaker",
                fallbackDialogue,
            );

            const nextVoiceMessage = {
                id: "voice-segment-next-message",
                entryId: nextEntryId(),
                role: "assistant",
                speaker: "Narrator",
                text: '"This quote starts fresh."',
                at: new Date().toISOString(),
            };
            app.messages.push(nextVoiceMessage);
            rebuildMessageIndex();
            const resetDialogue = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(nextVoiceMessage.text),
                "voice-segment-next-message",
            ).filter((part) => part.kind === "dialogue");
            devAssert(
                resetDialogue.length === 1 && !resetDialogue[0].speaker,
                "sticky quote speakers reset between messages",
                resetDialogue,
            );

            const sentenceParts = splitVoiceParts(
                'Dr. Vale waits. "Mr. Kaga, listen. Move now."',
            );
            devAssert(
                sentenceParts.some(
                    (part) =>
                        part.kind === "narration" &&
                        part.text === "Dr. Vale waits.",
                ) &&
                    sentenceParts.filter((part) => part.kind === "dialogue").length === 1 &&
                    sentenceParts.some(
                        (part) =>
                            part.kind === "dialogue" &&
                            part.text === "Mr. Kaga, listen. Move now.",
                    ),
                "voice segmentation keeps one spoken chunk until the speaker changes",
                sentenceParts,
            );

            const liraStyleMessage =
                "\nThe bench wraps around Kael's legs like affectionate molasses as Lira scrambles to scoop up the rogue slime with both hands, her form wobbling frantically.\n\n(Lira Puddlewick) \"Okay, okay-no orientation jobs yet! Just-hold still while I peel this off you!\" Her fingers sink into the bench-slime, pulling with sticky resistance. The badge on Kael's chest pulses faster, syncing with the chaos.\n\nA door creaks open behind the front desk. A deep, amused voice rumbles: \"Ah. The human initiation.\"";
            const liraVisibleMessage = assistantVisibleMessageText(liraStyleMessage);
            const liraParts = splitVoiceParts(liraStyleMessage);
            devAssert(
                liraParts.length === 5 &&
                    liraParts.map((part) => part.kind).join(",") ===
                        "narration,dialogue,narration,narration,dialogue" &&
                    liraParts.every(
                        (part) =>
                            Number.isFinite(Number(part.start)) &&
                            Number.isFinite(Number(part.end)) &&
                            part.end > part.start &&
                            liraVisibleMessage.slice(part.start, part.end) === part.text,
                    ),
                "voice highlight ranges match exact rendered text with leading newlines and paragraph breaks",
                liraParts.map((part) => ({
                    text: part.text,
                    slice: liraVisibleMessage.slice(part.start, part.end),
                    start: part.start,
                    end: part.end,
                })),
            );
            const emphasizedVoiceText =
                '(Lira Puddlewick) "Jiggleford, Syrup Coast! You--well, technically *we*--just completed your Slime Guild registration!" She taps the badge. "Badge first."';
            const emphasizedVisibleText =
                assistantVisibleMessageText(emphasizedVoiceText);
            const emphasizedParts = splitVoiceParts(emphasizedVoiceText);
            devAssert(
                !emphasizedVisibleText.includes("*") &&
                    emphasizedParts.every(
                        (part) =>
                            emphasizedVisibleText.slice(part.start, part.end) ===
                            part.text,
                    ),
                "voice highlight ranges use the rendered assistant text after markdown emphasis is stripped",
                emphasizedParts.map((part) => ({
                    text: part.text,
                    slice: emphasizedVisibleText.slice(part.start, part.end),
                    start: part.start,
                    end: part.end,
                })),
            );
            const finalLiraQuote = liraParts.find(
                (part) =>
                    part.kind === "dialogue" &&
                    part.text === "Ah. The human initiation.",
            );
            devAssert(
                finalLiraQuote?.speaker === "Lira Puddlewick" &&
                    finalLiraQuote.stickySpeakerFallback === true,
                "untagged later quote inherits the previous speaker inside the same message",
                finalLiraQuote,
            );
            devAssert(
                liraParts.some(
                    (part) =>
                        part.kind === "narration" &&
                        part.text.includes(
                            "A deep, amused voice rumbles:",
                        ),
                ),
                "narration before a colon-introduced quote remains a readable segment",
                liraParts,
            );
            const invalidGenderTaggedMessage =
                'A director steps forward. (Director Vellis non-female) "Hmm. Wobble Yard needs patrol."';
            const invalidGenderVisible = assistantVisibleMessageText(
                invalidGenderTaggedMessage,
            );
            const invalidGenderParts = splitVoiceParts(invalidGenderTaggedMessage);
            const invalidGenderSpeakers = extractInlineVoiceTagSpeakers(
                invalidGenderTaggedMessage,
            );
            const invalidGenderDialogue = invalidGenderParts.find(
                (part) => part.kind === "dialogue",
            );
            devAssert(
                !invalidGenderVisible.includes("(Director Vellis non-female)") &&
                    invalidGenderDialogue?.speaker === "Director Vellis" &&
                    invalidGenderSpeakers.some(
                        (speaker) => speaker.name === "Director Vellis",
                    ) &&
                    app.state.temp_speakers?.["Director Vellis"]?.gender ===
                        "female" &&
                    invalidGenderParts.every(
                        (part) =>
                            invalidGenderVisible.slice(part.start, part.end) ===
                            part.text,
                    ),
                "unsupported inline voice-tag genders are hidden and treated as non-male voice tags",
                { invalidGenderVisible, invalidGenderParts, invalidGenderSpeakers },
            );

            let cursor = 0;
            const full = 'Somara raises her hand. "Hold." She points east.';
            const first = rebaseStreamedVoiceParts(
                splitVoiceParts("Somara raises her hand. "),
                "Somara raises her hand. ",
                full,
                (nextCursor) => {
                    cursor = nextCursor;
                },
                cursor,
            );
            const second = rebaseStreamedVoiceParts(
                splitVoiceParts('"Hold." She points east.'),
                '"Hold." She points east.',
                full,
                (nextCursor) => {
                    cursor = nextCursor;
                },
                cursor,
            );
            devAssert(
                first[0]?.start === 0 &&
                    second[0]?.start === "Somara raises her hand. \"".length &&
                    second.every(
                        (part) =>
                            Number.isFinite(Number(part.start)) &&
                            Number(part.start) >=
                                "Somara raises her hand. ".length,
                    ),
                "streamed voice parts rebase highlight ranges onto the current full message segment",
                { first, second, cursor },
            );
            const originalRenderThreadForHighlightSmoke = renderThread;
            let highlightSmokeRenderThreadCalls = 0;
            try {
                render();
                originalRenderThreadForHighlightSmoke();
                renderThread = () => {
                    highlightSmokeRenderThreadCalls += 1;
                    return originalRenderThreadForHighlightSmoke();
                };
                app.activeVoiceMessageId = "voice-segment-single-speaker";
                updateVoiceRangeHighlight("voice-segment-single-speaker", 0, 5);
                const article = document.querySelector(
                    '#thread [data-message-id="voice-segment-single-speaker"]',
                );
                devAssert(
                    highlightSmokeRenderThreadCalls === 0 &&
                        !!article?.querySelector(".voice-current-word"),
                    "voice range highlight updates the active message DOM without full renderThread",
                    {
                        highlightSmokeRenderThreadCalls,
                        articleHtml: article?.outerHTML || "",
                    },
                );
                const paragraphMessage = addMessage(
                    "assistant",
                    'First highlighted paragraph.\n\nSecond highlighted paragraph with "dialogue."',
                    "Lira Puddlewick",
                );
                originalRenderThreadForHighlightSmoke("voice paragraph highlight smoke");
                const paragraphArticle = document.querySelector(
                    `#thread [data-message-id="${cssEscape(String(paragraphMessage.id))}"]`,
                );
                const paragraphContent =
                    paragraphArticle?.querySelector(".message-content");
                const paragraphScrollBefore = $("thread")?.scrollTop || 0;
                updateVoiceRangeHighlight(paragraphMessage.id, 0, 10);
                updateVoiceRangeHighlight(
                    paragraphMessage.id,
                    paragraphMessage.text.indexOf("Second"),
                    12,
                );
                devAssert(
                    paragraphContent?.querySelectorAll("br").length === 2 &&
                        paragraphContent?.textContent.includes(
                            "First highlighted paragraph.",
                        ) &&
                        paragraphContent?.textContent.includes(
                            "Second highlighted paragraph",
                        ) &&
                        !!paragraphContent?.querySelector(".voice-current-word") &&
                        ($("thread")?.scrollTop || 0) === paragraphScrollBefore,
                    "voice highlight replacement preserves paragraph breaks, message text, and viewport position",
                    {
                        html: paragraphContent?.innerHTML || "",
                        scrollBefore: paragraphScrollBefore,
                        scrollAfter: $("thread")?.scrollTop || 0,
                    },
                );
            } finally {
                renderThread = originalRenderThreadForHighlightSmoke;
                app.activeVoiceMessageId = null;
                app.voiceHighlight = null;
            }

            const originalPlaybackSettingFunctions = {
                speakReply,
                speakPlayerText,
                speakText,
                scheduleActiveGameSave,
            };
            const playbackSettingCalls = [];
            let playbackSettingSaveCalls = 0;
            try {
                app.settings.autoVoice = false;
                app.voicePaused = false;
                app.activeVoiceMessageId = null;
                speakReply = (...args) =>
                    playbackSettingCalls.push({ type: "assistant", args });
                speakPlayerText = (...args) =>
                    playbackSettingCalls.push({ type: "user", args });
                speakText = (...args) =>
                    playbackSettingCalls.push({ type: "game", args });
                scheduleActiveGameSave = () => {
                    playbackSettingSaveCalls += 1;
                    return true;
                };
                readSingleMessage({
                    id: "voice-setting-assistant",
                    role: "assistant",
                    speaker: "Danielle Mercer",
                    text: "Fake assistant playback.",
                });
                readSingleMessage({
                    id: "voice-setting-user",
                    role: "user",
                    speaker: "Voice Tester",
                    text: "Fake player playback.",
                });
                readSingleMessage({
                    id: "voice-setting-game",
                    role: "game",
                    speaker: "Game",
                    text: "Fake game playback.",
                });
                devAssert(
                    app.settings.autoVoice === false &&
                        playbackSettingSaveCalls === 0 &&
                        playbackSettingCalls.map((call) => call.type).join(",") ===
                            "assistant,user,game",
                    "manual playback reads assistant, player, and game messages without enabling or saving Auto Voice",
                    {
                        autoVoice: app.settings.autoVoice,
                        playbackSettingSaveCalls,
                        playbackSettingCalls,
                    },
                );
            } finally {
                speakReply = originalPlaybackSettingFunctions.speakReply;
                speakPlayerText = originalPlaybackSettingFunctions.speakPlayerText;
                speakText = originalPlaybackSettingFunctions.speakText;
                scheduleActiveGameSave =
                    originalPlaybackSettingFunctions.scheduleActiveGameSave;
            }

            const originalReadMessageForGameSetting = readMessage;
            const autoReadGameIds = [];
            try {
                readMessage = (id, options = {}) => {
                    autoReadGameIds.push({ id, options: clone(options) });
                };
                app.settings.autoVoice = true;
                app.settings.readGameMessages = true;
                addGameMessage("Readable game message.", "Game");
                app.settings.readGameMessages = false;
                addGameMessage("Muted game message.", "Game");
                devAssert(
                    autoReadGameIds.length === 1 &&
                        findMessageById(autoReadGameIds[0].id)?.text ===
                            "Readable game message.",
                    "Read game messages setting controls automatic Game-message voice playback",
                    {
                        autoReadGameIds,
                        messages: app.messages
                            .filter((message) => message.role === "game")
                            .map((message) => ({
                                id: message.id,
                                text: message.text,
                            })),
                    },
                );
            } finally {
                readMessage = originalReadMessageForGameSetting;
                app.settings.readGameMessages = true;
            }

            const originalReadMessageForStartPlaying = readMessage;
            const originalPlayerInputHelpSeen = app.settings.playerInputHelpSeen;
            const originalPendingPlayerInputHelpReadMessageId =
                app.pendingPlayerInputHelpReadMessageId || "";
            const startPlayingReadCalls = [];
            try {
                readMessage = (id, options = {}) => {
                    startPlayingReadCalls.push({ id, options: clone(options) });
                };
                app.settings.autoVoice = true;
                app.settings.playerInputHelpSeen = false;
                app.pendingPlayerInputHelpReadMessageId = "";
                const shown = showPlayerInputHelpOnce("opening-message-read-smoke", {
                    force: true,
                });
                const startButton = [...document.querySelectorAll("#modalBox button")].find(
                    (button) => /Start Playing/i.test(button.textContent || ""),
                );
                devAssert(
                    shown &&
                        !!startButton &&
                        app.pendingPlayerInputHelpReadMessageId ===
                            "opening-message-read-smoke",
                    "How to Play UI stores the opening message id for Start Playing",
                    {
                        shown,
                        hasStartButton: !!startButton,
                        pending: app.pendingPlayerInputHelpReadMessageId,
                    },
                );
                startButton.click();
                devAssert(
                    startPlayingReadCalls.length === 1 &&
                        startPlayingReadCalls[0].id === "opening-message-read-smoke" &&
                        startPlayingReadCalls[0].options?.sequence === false &&
                        !$("modal")?.classList.contains("open"),
                    "Start Playing closes the writing-help UI and starts reading the opening message",
                    {
                        startPlayingReadCalls,
                        modalOpen: $("modal")?.classList.contains("open"),
                    },
                );
            } finally {
                readMessage = originalReadMessageForStartPlaying;
                app.settings.playerInputHelpSeen = originalPlayerInputHelpSeen;
                app.pendingPlayerInputHelpReadMessageId =
                    originalPendingPlayerInputHelpReadMessageId;
                if ($("modal")?.classList.contains("open")) closeModal();
            }

            app.activeVoiceMessageId = 1;
            app.autoVoiceStartedMessageIds.add("1");
            app.streamedVoiceReplyIds.add(1);
            app.voiceMetadataPendingMessageIds.add("1");
            app.pendingVoiceDialogueParts.set("1", { parts: [], character: null });
            cancelAllGameProcesses("voice message id reuse smoke");
            devAssert(
                !app.stoppedVoiceMessageIds.has("1") &&
                    !app.autoVoiceStartedMessageIds.has("1") &&
                    !app.streamedVoiceReplyIds.has(1) &&
                    !app.voiceMetadataPendingMessageIds.has("1") &&
                    !app.pendingVoiceDialogueParts.has("1"),
                "game-boundary voice cleanup allows a new story opening to reuse message id 1 after the prior read was cancelled",
                {
                    stopped: [...(app.stoppedVoiceMessageIds || [])],
                    started: [...(app.autoVoiceStartedMessageIds || [])],
                    streamed: [...(app.streamedVoiceReplyIds || [])],
                    pendingMetadata: [...(app.voiceMetadataPendingMessageIds || [])],
                    pendingParts: [...(app.pendingVoiceDialogueParts?.keys?.() || [])],
                },
            );

            addMessage("system", "Voice segment smoke test passed.");
            scheduleActiveGameSave();
            render();
            devRestoreSmokeVoiceCache();
            devTestLog("Scenario complete: voice-segment-smoke");
        }

        function devAssertNarrationModalQueueResume() {
            const descriptor = Object.getOwnPropertyDescriptor(window, "speechSynthesis");
            const savedFields = {};
            for (const key of ["voicePaused", "narrationModalPauseDepth", "narrationModalPausedSpeech", "voiceUtteranceCurrent", "voiceUtteranceQueue", "voiceCurrentIdleSince"])
                savedFields[key] = app[key];
            const savedPump = scheduleVoiceUtterancePump;
            const savedRenderThread = renderThread;
            const savedRenderPauseButton = renderVoicePauseButton;
            let cancellations = 0;
            let pumpRequests = 0;
            const synth = {
                speaking: true,
                pending: false,
                paused: false,
                cancel() { cancellations += 1; synth.speaking = false; },
                resume() {},
            };
            try {
                Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synth });
                scheduleVoiceUtterancePump = () => { pumpRequests += 1; };
                renderThread = () => {};
                renderVoicePauseButton = () => {};
                app.voicePaused = false;
                app.narrationModalPauseDepth = 0;
                app.narrationModalPausedSpeech = false;
                const current = { text: "First sentence.", resumeCharacterIndex: 6, started: true, generation: 1 };
                const next = { text: "Next sentence.", generation: 1 };
                app.voiceUtteranceCurrent = current;
                app.voiceUtteranceQueue = [next];
                pauseNarrationForModal();
                pauseNarrationForModal();
                resumeNarrationForModal();
                devAssert(app.voicePaused && pumpRequests === 0, "nested narration modal remains paused until its final close");
                resumeNarrationForModal();
                devAssert(
                    cancellations === 1 && pumpRequests === 1 && !voiceIsPaused() &&
                        app.voiceUtteranceCurrent === null && app.voiceUtteranceQueue.length === 2 &&
                        app.voiceUtteranceQueue[0] !== current &&
                        app.voiceUtteranceQueue[0].text === "sentence." && app.voiceUtteranceQueue[1] === next,
                    "modal close restarts unfinished queued narration even when native resume does nothing",
                );
                app.voicePaused = true;
                synth.paused = true;
                pauseNarrationForModal();
                resumeNarrationForModal();
                devAssert(app.voicePaused && synth.paused, "modal close preserves an existing manual narration pause");
            } finally {
                scheduleVoiceUtterancePump = savedPump;
                renderThread = savedRenderThread;
                renderVoicePauseButton = savedRenderPauseButton;
                for (const [key, value] of Object.entries(savedFields)) app[key] = value;
                if (descriptor) Object.defineProperty(window, "speechSynthesis", descriptor);
                else delete window.speechSynthesis;
            }
        }

        async function devRunVoiceGatingSmokeTest() {
            devTestLog("Scenario start: voice-gating-smoke");
            devResetForLiveTest("voice-gating-smoke");
            devCreateTestProfile({  });
            devInstallSmokeVoiceCache([
                { name: "Narrator Voice", lang: "en-US" },
                { name: "Default Female Voice", lang: "en-US" },
                { name: "Default Male Voice", lang: "en-US" },
            ]);
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "gate-room",
                    specific_place: "Gate Room",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Voice Gate Tester",
                    age: 24,
                    gender: "male",
                },
                characters: {
                    "Known Ally": {
                        ...blankCharacterTemplate("Known Ally"),
                        name: "Known Ally",
                        age: 25,
                        gender: "female",
                        role: "known ally",
                    },
                },
                npc_directory: {
                    locations: {
                        "gate-room": {
                            label: "Gate Room",
                            characters: {
                                "Tomas Vale": {
                                    name: "Tomas Vale",
                                    gender: "male",
                                    inspected: true,
                                    full_character: {
                                        ...blankCharacterTemplate("Tomas Vale"),
                                        name: "Tomas Vale",
                                        age: 30,
                                        gender: "male",
                                        role: "known NPC",
                                    },
                                },
                            },
                        },
                    },
                },
            });
            app.settings.narratorVoiceName = "Narrator Voice";
            app.settings.voiceGenderMap ||= {};
            app.settings.voiceGenderMap["Default Female Voice"] = "female";
            app.settings.voiceGenderMap["Default Male Voice"] = "male";

            const untagged = dialogueVoicePart("Untagged quote.", "", 0, 15);
            const knownAlly = dialogueVoicePart(
                "Known ally quote.",
                "Known Ally",
                0,
                18,
            );
            const knownNpc = dialogueVoicePart(
                "Known NPC quote.",
                "Tomas Vale",
                0,
                16,
            );
            const missingSpeaker = dialogueVoicePart(
                "Unknown quote.",
                "Rylan Voss",
                0,
                14,
            );
            devAssert(
                !voicePartNeedsMetadataVoiceGate(untagged) &&
                    !voicePartNeedsMetadataVoiceGate(knownAlly) &&
                    !voicePartNeedsMetadataVoiceGate(knownNpc) &&
                    voicePartNeedsMetadataVoiceGate(missingSpeaker),
                "reader gates only unresolved explicit speakers, not narrator, untagged, party, or known NPC voices",
                {
                    untagged: voicePartNeedsMetadataVoiceGate(untagged),
                    knownAlly: voicePartNeedsMetadataVoiceGate(knownAlly),
                    knownNpc: voicePartNeedsMetadataVoiceGate(knownNpc),
                    missingSpeaker: voicePartNeedsMetadataVoiceGate(missingSpeaker),
                },
            );

            const liraStreamingMessage = addMessage(
                "assistant",
                'Lira leans over the desk. "You are in Jiggleford."',
                "Tomas Vale",
            );
            const liraStreamingParts = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(liraStreamingMessage.text),
                liraStreamingMessage.id,
            );
            const liraStreamingQuote = liraStreamingParts.find(
                (part) => part.kind === "dialogue",
            );
            const liraStreamingGate = voicePartNeedsMetadataVoiceGate(
                liraStreamingQuote,
            );
            devAssert(
                liraStreamingQuote?.speaker === "Tomas Vale" &&
                    liraStreamingQuote.stickySpeakerFallback === true &&
                    !liraStreamingGate,
                `streamed assistant messages with a known NPC header voice untagged quotes immediately instead of waiting for metadata: ${compactJson({
                    quote: liraStreamingQuote,
                    gate: liraStreamingGate,
                    speaker: singleKnownVoiceSpeakerForMessage(liraStreamingMessage.id),
                    npcNames: allNpcNamesFromState(app.state),
                })}`,
                liraStreamingParts,
            );
            const liraChunkedMessage = addMessage(
                "assistant",
                'Lira pats the badge. "First Lira quote." She leans closer. "Second Lira quote."',
                "Tomas Vale",
            );
            liraChunkedMessage.voiceText =
                'Lira pats the badge. (Tomas Vale) "First Lira quote." She leans closer. "Second Lira quote."';
            liraChunkedMessage.voiceSpeakers = ["Tomas Vale"];
            const firstChunkParts = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(
                    'Lira pats the badge. (Tomas Vale) "First Lira quote." ',
                ),
                liraChunkedMessage.id,
            );
            const secondChunkParts = applyMessageVoiceSpeakerFallback(
                splitVoiceParts('She leans closer. "Second Lira quote."'),
                liraChunkedMessage.id,
            );
            const secondChunkQuote = secondChunkParts.find(
                (part) => part.kind === "dialogue",
            );
            devAssert(
                firstChunkParts.some(
                    (part) =>
                        part.kind === "dialogue" &&
                        part.speaker === "Tomas Vale",
                ) &&
                    secondChunkQuote?.speaker === "Tomas Vale" &&
                    !voicePartNeedsMetadataVoiceGate(secondChunkQuote),
                `streamed chunked replies keep the known message speaker for later untagged quotes: ${compactJson({
                    firstChunkParts,
                    secondChunkParts,
                    secondChunkQuote,
                })}`,
            );

            app.state.temp_speakers ||= {};
            app.state.temp_speakers["Nira Vale"] = {
                name: "Nira Vale",
                gender: "female",
                voice: "",
            };
            const tempFemale = dialogueVoicePart(
                "Temporary speaker quote.",
                "Nira Vale",
                0,
                24,
            );
            const tempTarget = voiceTargetForPart(tempFemale);
            devAssert(
                !voicePartNeedsMetadataVoiceGate(tempFemale) &&
                    tempTarget.useCharacter &&
                    tempTarget.slot !== "Narrator",
                "metadata-finished temp speakers resolve to a character voice instead of staying gated",
                tempTarget,
            );

            app.pendingVoiceDialogueParts.set("voice-gate-order", {
                parts: [missingSpeaker],
                character: null,
            });
            queueVoicePart(
                { kind: "narration", text: "Later narration.", start: 20, end: 36 },
                null,
                "voice-gate-order",
            );
            const held = app.pendingVoiceDialogueParts.get("voice-gate-order");
            devAssert(
                held?.parts?.length === 2 &&
                    held.parts[0].speaker === "Rylan Voss" &&
                    held.parts[1].kind === "narration",
                "once a quote is gated, later narration stays behind it instead of reading out of order",
                held,
            );

            devAssertNarrationModalQueueResume();
            addMessage("system", "Voice gating smoke test passed.");
            scheduleActiveGameSave();
            render();
            devRestoreSmokeVoiceCache();
            devTestLog("Scenario complete: voice-gating-smoke");
        }

        async function devRunVoiceBrowserCompatibilitySmokeTest() {
            devTestLog("Scenario start: voice-browser-compatibility-smoke");
            const originalVoiceBlacklist = clone(app.settings.voiceBlacklist || []);
            const originalVoices = app.voices;
            const originalFailedSpeechVoiceNames = app.failedSpeechVoiceNames;
            const chromeVoices = [
                { name: "Google US English", lang: "en-US" },
                { name: "Google UK English Male", lang: "en-GB" },
                { name: "Google UK English Female", lang: "en-GB" },
            ];
            const edgeVoices = [
                { name: "Microsoft Ava Online (Natural) - English (United States)", lang: "en-US" },
                { name: "Microsoft Christopher Multilingual Online (Natural) - English (United States)", lang: "en-US" },
                { name: "Microsoft Christopher Online (Natural) - English (United States)", lang: "en-US" },
                { name: "Microsoft Michelle Online (Natural) - English (United States)", lang: "en-US" },
                { name: "Microsoft Andrew Online (Natural) - English (United States)", lang: "en-US" },
                { name: "Microsoft Libby Online (Natural) - English (United Kingdom)", lang: "en-GB" },
            ];
            try {
                app.settings.voiceBlacklist = [];
                app.failedSpeechVoiceNames = new Set();
                const chromeMale = bestCompatibleVoice({
                    voices: chromeVoices,
                    requested: "Christopher Online",
                    slot: "Character",
                    gender: "male",
                    browserKind: "chrome",
                });
                const chromeFemale = bestCompatibleVoice({
                    voices: chromeVoices,
                    requested: "Michelle Online",
                    slot: "Character",
                    gender: "female",
                    browserKind: "chrome",
                });
                const chromeNarrator = bestCompatibleVoice({
                    voices: chromeVoices,
                    requested: "Ava Online",
                    slot: "Narrator",
                    browserKind: "chrome",
                });
                const edgeMale = bestCompatibleVoice({
                    voices: edgeVoices,
                    requested: "Christopher Online",
                    slot: "Character",
                    gender: "male",
                    browserKind: "edge",
                });
                const edgeFemale = bestCompatibleVoice({
                    voices: edgeVoices,
                    requested: "Michelle Online",
                    slot: "Character",
                    gender: "female",
                    browserKind: "edge",
                });
                app.voices = [
                    {
                        name: "Microsoft Ava Online (Natural) - English (United States)",
                        lang: "en-US",
                        localService: false,
                    },
                    {
                        name: "Google US English",
                        lang: "en-US",
                        localService: true,
                    },
                ];
                markSpeechVoiceFailed(app.voices[0]);
                const runtimeFailureReplacement = replacementVoiceForQueuedEntry({
                    voice: app.voices[0],
                    voiceSlot: "Narrator",
                });
                app.voices = [
                    {
                        name: "Microsoft Michelle Online (Natural) - English (United States)",
                        lang: "en-US",
                        localService: false,
                    },
                ];
                app.failedSpeechVoiceNames = new Set();
                const browserDefaultReplacement = replacementVoiceForQueuedEntry({
                    voice: app.voices[0],
                    voiceSlot: "Narrator",
                });
                devAssert(
                    chromeMale?.name === "Google UK English Male" &&
                        chromeFemale?.name === "Google UK English Female" &&
                        ["Google US English", "Google UK English Female"].includes(
                            chromeNarrator?.name,
                        ),
                    "non-Edge browsers fall back from Microsoft defaults to compatible available browser voices",
                    { chromeMale, chromeFemale, chromeNarrator },
                );
                devAssert(
                    /Christopher Online/i.test(edgeMale?.name || "") &&
                        !/Multilingual/i.test(edgeMale?.name || "") &&
                        /Michelle Online/i.test(edgeFemale?.name || ""),
                    "Edge keeps the current Microsoft Online default voice choices and skips blacklisted multilingual variants when those voices are available",
                    { edgeMale, edgeFemale },
                );
                devAssert(
                    runtimeFailureReplacement?.name === "Google US English" &&
                        runtimeFailureReplacement.localService === true &&
                        !visibleVoices().some((voice) =>
                            /Microsoft Ava Online/.test(voice.name),
                        ),
                    "a browser-advertised voice that fails at runtime is quarantined and replaced with an allowed local voice",
                    {
                        runtimeFailureReplacement,
                        visibleVoices: visibleVoices().map((voice) => voice.name),
                    },
                );
                devAssert(
                    browserDefaultReplacement?.systemDefault === true &&
                        browserDefaultReplacement.name === "Browser Default",
                    "when the browser exposes no local voice, a failed named voice retries through the browser system default instead of cycling through online voices",
                    browserDefaultReplacement,
                );
            } finally {
                app.settings.voiceBlacklist = originalVoiceBlacklist;
                app.voices = originalVoices;
                app.failedSpeechVoiceNames = originalFailedSpeechVoiceNames;
            }
            addMessage("system", "Voice browser compatibility smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: voice-browser-compatibility-smoke");
        }

        async function devRunVoiceResolutionSmokeTest() {
            devTestLog("Scenario start: voice-resolution-smoke");
            devResetForLiveTest("voice-resolution-smoke");
            devCreateTestProfile({  });
            const originalVoiceCache = app.voices;
            const originalVoiceCacheInitialized = app.voiceCacheInitialized;
            const originalVoiceGenderMap = clone(app.settings.voiceGenderMap || {});
            const originalVoiceBlacklist = clone(app.settings.voiceBlacklist || []);
            const originalFailedSpeechVoiceNames = app.failedSpeechVoiceNames;
            const originalStoryDefinition = app.storyDefinition;
            try {
                app.voices = [
                    { name: "Google US English", lang: "en-US" },
                    { name: "Google UK English Male", lang: "en-GB" },
                    { name: "Google UK English Female", lang: "en-GB" },
                    { name: "Bad News", lang: "en-US" },
                    { name: "Rocko (English (United States))", lang: "en-US" },
                ];
                app.voiceCacheInitialized = true;
                app.failedSpeechVoiceNames = new Set();
                app.settings.voiceGenderMap = {
                    ...clone(DEFAULT_VOICE_GENDER_MAP),
                };
                app.settings.voiceBlacklist = [...DEFAULT_VOICE_BLACKLIST];
                app.settings.defaultMalePlayerVoiceName = "Google UK English Male";
                app.settings.defaultNonMalePlayerVoiceName = "Google US English";
                app.storyDefinition = {
                    ...(app.storyDefinition || {}),
                    characterDefinitionsById: {
                        ...(app.storyDefinition?.characterDefinitionsById || {}),
                        "definition-guide": {
                            ...blankCharacterTemplate("Definition Guide"),
                            id: "definition-guide",
                            name: "Definition Guide",
                            gender: "female",
                            voice: "Google UK English Female",
                        },
                    },
                };
                app.voiceDefinitionCharacterCache = new Map();
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        name: "Voice Resolution Player",
                        gender: "female",
                        voice: "Unavailable Windows Voice",
                    },
                    npc_directory: {
                        locations: {
                            "voice-room": {
                                label: "Voice Room",
                                characters: {
                                    "Kaelen Voss": {
                                        name: "Kaelen Voss",
                                        gender: "female",
                                        inspected: true,
                                        full_character: {
                                            ...blankCharacterTemplate("Kaelen Voss"),
                                            name: "Kaelen Voss",
                                            gender: "female",
                                            voice: {
                                                gender_bucket: "non_male",
                                                preferred_voice_name: "Bad News",
                                            },
                                        },
                                    },
                                    "fenna-dawnwhisper": {
                                        name: "Fenna Dawnwhisper",
                                        gender: "female",
                                        inspected: true,
                                        full_character: {
                                            ...blankCharacterTemplate(
                                                "Fenna Dawnwhisper",
                                            ),
                                            id: "fenna-dawnwhisper",
                                            name: "Fenna Dawnwhisper",
                                            gender: "female",
                                            voice: "Google UK English Female",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    future_cast: {
                        enabled: true,
                        items: {
                            "caelira-vey": {
                                id: "caelira-vey",
                                name: "Caelira Vey",
                                full_character: {
                                    ...blankCharacterTemplate("Caelira Vey"),
                                    id: "caelira-vey",
                                    name: "Caelira Vey",
                                    gender: "female",
                                    voice: "Google UK English Female",
                                },
                            },
                        },
                    },
                    characters: {
                        "Saved Voice Ally": {
                            ...blankCharacterTemplate("Saved Voice Ally"),
                            name: "Saved Voice Ally",
                            gender: "female",
                            voice: "Google UK English Female",
                        },
                        "vessa-threadwell": {
                            ...blankCharacterTemplate("Vessa Threadwell"),
                            id: "vessa-threadwell",
                            name: "Vessa Threadwell",
                            gender: "female",
                            voice: "",
                        },
                    },
                });
                app.state.characters["vessa-threadwell"] =
                    app.state.characters["Vessa Threadwell"];
                delete app.state.characters["Vessa Threadwell"];
                const cachedVoiceList = app.voices;
                loadVoices();
                const cacheWasReused = app.voices === cachedVoiceList;
                const kaelen = voiceCharacterForSpeaker("Kaelen Voss");
                const kaelenFirstVoice = playbackVoiceForCharacter(kaelen, "Kaelen Voss");
                const kaelenSecondVoice = playbackVoiceForCharacter(
                    voiceCharacterForSpeaker("Kaelen Voss"),
                    "Kaelen Voss",
                );
                app.state.temp_speakers = {
                    "Kaelen Voss": {
                        name: "Kaelen Voss",
                        gender: "female",
                        voice: "Rocko (English (United States))",
                    },
                };
                setRuntimeCharacterVoice(kaelen, "Google UK English Female");
                const reopenedKaelen = imageSettingsEntity("Kaelen Voss");
                const explicitSelectedVoice = savedCharacterVoiceName(reopenedKaelen);
                const redundantTempSpeakerCleared =
                    !app.state.temp_speakers?.["Kaelen Voss"];
                openCharacterImageSettings("Kaelen Voss");
                const stepperVoiceSelect = $("characterSettingsVoice");
                stepperVoiceSelect.value = "Google US English";
                stepperVoiceSelect.dispatchEvent(
                    new CustomEvent("emberadventureslite-setting-commit", {
                        bubbles: true,
                    }),
                );
                const stepperCommittedVoice = savedCharacterVoiceName(
                    imageSettingsEntity("Kaelen Voss"),
                );
                closeModal();
                const reloadedState = clone(app.state);
                app.state = reloadedState;
                const kaelenReloadedVoice = playbackVoiceForCharacter(
                    voiceCharacterForSpeaker("Kaelen Voss"),
                    "Kaelen Voss",
                );
                const savedVoiceAlly = app.state.characters["Saved Voice Ally"];
                const validSavedVoice = playbackVoiceForCharacter(
                    savedVoiceAlly,
                    "Saved Voice Ally",
                );
                const stableKeyPartyCharacter =
                    voiceCharacterForSpeaker("Vessa Threadwell");
                const stableKeyPartyVoice = playbackVoiceForCharacter(
                    stableKeyPartyCharacter,
                    "Vessa Threadwell",
                );
                const stableKeyPartyVoiceAgain = playbackVoiceForCharacter(
                    voiceCharacterForSpeaker("Vessa Threadwell"),
                    "Vessa Threadwell",
                );
                const fennaVoiceTarget = voiceTargetForPart(
                    {
                        kind: "dialogue",
                        speaker: "Fenna Dawnwhisper",
                        text: "This quoted dialogue must use Fenna's stored voice.",
                    },
                    stableKeyPartyCharacter,
                );
                const fennaRecord = findNpcEntryInState(
                    app.state,
                    "Fenna Dawnwhisper",
                )?.npc?.full_character;
                const fennaVoiceTargetAgain = voiceTargetForPart(
                    {
                        kind: "dialogue",
                        speaker: "Fenna Dawnwhisper",
                        text: "Replay must use the same stored voice.",
                    },
                    stableKeyPartyCharacter,
                );
                const openingFutureVoiceTarget = voiceTargetForPart({
                    kind: "dialogue",
                    speaker: "Caelira Vey",
                    text: "Opening dialogue must use the authored speaker voice.",
                });
                const definitionOnlyVoiceTarget = voiceTargetForPart({
                    kind: "dialogue",
                    speaker: "Definition Guide",
                    text: "Opening dialogue must resolve from the immutable registry.",
                });
                const playerVoice = playbackVoiceForCharacter(
                    app.state.player,
                    app.state.player.name,
                );
                const kaelenShell = getNpcEntry("Kaelen Voss");
                const normalizedProfile = validatedUserProfiles([
                    {
                        ...devSmokeTestProfile("first"),
                        id: "voice-profile-smoke",
                        name: "Voice Profile Smoke",
                        settings: profileSettingsFromDefaults(),
                    },
                ])[0];
                const profileDoesNotStoreVoiceGenderMap =
                    !Object.prototype.hasOwnProperty.call(
                        normalizedProfile?.settings || {},
                        "voiceGenderMap",
                    ) && localSettingKeys().includes("voiceGenderMap");
                const knownSmokeVoices = app.voices;
                app.voices = [{ name: "Unclassified Voice", lang: "en-US" }];
                const unclassifiedVoiceFallback =
                    availableAllowedCharacterVoices("female");
                const trustedWindowsVoice = {
                    name: "Microsoft Michelle Online (Natural) - English (United States)",
                    lang: "en-US",
                };
                app.voices = [trustedWindowsVoice];
                app.settings.voiceGenderMap[trustedWindowsVoice.name] = "unknown";
                const trustedUnmappedFallback = randomAvailableCharacterVoice("female");
                app.voices = knownSmokeVoices;
                devTestLog("Stable-key party voice resolution details", {
                    characterKeys: Object.keys(app.state.characters || {}),
                    matched:
                        stableKeyPartyCharacter ===
                        app.state.characters["vessa-threadwell"],
                    resolvedName: stableKeyPartyCharacter?.name || "",
                    stableKeyPartyVoice,
                    stableKeyPartyVoiceAgain,
                    storedVoice: savedCharacterVoiceName(
                        app.state.characters["vessa-threadwell"],
                    ),
                });
                devAssert(
                    stableKeyPartyCharacter ===
                        app.state.characters["vessa-threadwell"] &&
                        stableKeyPartyVoice !== "Narrator" &&
                        stableKeyPartyVoiceAgain === stableKeyPartyVoice &&
                        savedCharacterVoiceName(
                            app.state.characters["vessa-threadwell"],
                        ) === stableKeyPartyVoice,
                    "display-name speaker resolution finds and persists the authoritative stable-ID-keyed party character voice",
                    {
                        characterKeys: Object.keys(app.state.characters || {}),
                        stableKeyPartyCharacter,
                        expectedCharacter:
                            app.state.characters["vessa-threadwell"],
                        stableKeyPartyVoice,
                        stableKeyPartyVoiceAgain,
                        storedVoice: savedCharacterVoiceName(
                            app.state.characters["vessa-threadwell"],
                        ),
                    },
                );
                devAssert(
                    fennaRecord ===
                        storedVoiceCharacterForSpeaker("Fenna Dawnwhisper") &&
                        fennaVoiceTarget.useCharacter === true &&
                        fennaVoiceTarget.slot === "Google UK English Female" &&
                        fennaVoiceTarget.gender === "female" &&
                        fennaVoiceTargetAgain.slot === fennaVoiceTarget.slot,
                    "quoted NPC dialogue resolves the authoritative stable-ID-keyed NPC record and always uses its stored voice",
                    {
                        fennaRecord,
                        fennaVoiceTarget,
                        fennaVoiceTargetAgain,
                    },
                );
                devAssert(
                    openingFutureVoiceTarget.useCharacter === true &&
                        openingFutureVoiceTarget.slot ===
                            "Google UK English Female" &&
                        openingFutureVoiceTarget.character ===
                            app.state.future_cast.items["caelira-vey"].full_character,
                    "opening dialogue resolves a future-cast character by speaker name instead of using the narrator voice",
                    openingFutureVoiceTarget,
                );
                devAssert(
                    definitionOnlyVoiceTarget.useCharacter === true &&
                        definitionOnlyVoiceTarget.slot ===
                            "Google UK English Female" &&
                        definitionOnlyVoiceTarget.character?.id === "definition-guide",
                    "opening voice speaker resolution falls back to the immutable character registry instead of Narrator",
                    definitionOnlyVoiceTarget,
                );
                devAssert(
                    cacheWasReused &&
                        ["Google US English", "Google UK English Female"].includes(
                            kaelenFirstVoice,
                        ) &&
                        kaelenSecondVoice === kaelenFirstVoice &&
                        kaelenReloadedVoice === "Google US English" &&
                        explicitSelectedVoice === "Google UK English Female" &&
                        redundantTempSpeakerCleared &&
                        stepperCommittedVoice === "Google US English" &&
                        savedCharacterVoiceName(kaelen) === "Google US English" &&
                        !Object.prototype.hasOwnProperty.call(kaelenShell || {}, "voice") &&
                        validSavedVoice === "Google UK English Female" &&
                        stableKeyPartyCharacter ===
                            app.state.characters["vessa-threadwell"] &&
                        stableKeyPartyVoice !== "Narrator" &&
                        stableKeyPartyVoiceAgain === stableKeyPartyVoice &&
                        savedCharacterVoiceName(
                            app.state.characters["vessa-threadwell"],
                        ) === stableKeyPartyVoice &&
                        fennaVoiceTarget.useCharacter === true &&
                        fennaVoiceTarget.slot === "Google UK English Female" &&
                        fennaVoiceTargetAgain.slot === fennaVoiceTarget.slot &&
                        playerVoice === "Google US English" &&
                        app.state.player.voice === "Google US English" &&
                        !Object.prototype.hasOwnProperty.call(
                            defaultSettings,
                            "defaultMaleVoiceName",
                        ) &&
                        !Object.prototype.hasOwnProperty.call(
                            defaultSettings,
                            "defaultFemaleVoiceName",
                        ) &&
                        !settingsModalSettingIds().includes("defaultMaleVoiceName") &&
                        !settingsModalSettingIds().includes("defaultFemaleVoiceName") &&
                        isBadVoiceName("Bad News") &&
                        isBadVoiceName("Rocko (English (United States))") &&
                        profileDoesNotStoreVoiceGenderMap &&
                        unclassifiedVoiceFallback.length === 0 &&
                        trustedUnmappedFallback === trustedWindowsVoice.name &&
                        voiceGenderFromName("Google UK English Male") === "male" &&
                        voiceGenderFromName("Google UK English Female") === "female",
                    "voice resolution caches installed voices, keeps gender classification global, rejects unclassified voices, and saves explicit selections through reload",
                    {
                        cacheWasReused,
                        kaelenFirstVoice,
                        kaelenSecondVoice,
                        kaelenReloadedVoice,
                        kaelenSavedVoice: savedCharacterVoiceName(kaelen),
                        explicitSelectedVoice,
                        redundantTempSpeakerCleared,
                        stepperCommittedVoice,
                        profileDoesNotStoreVoiceGenderMap,
                        unclassifiedVoiceFallback,
                        trustedUnmappedFallback,
                        kaelen,
                        kaelenShell,
                        validSavedVoice,
                        stableKeyPartyVoice,
                        stableKeyPartyVoiceAgain,
                        fennaVoiceTarget,
                        fennaVoiceTargetAgain,
                        playerVoice,
                    },
                );
            } finally {
                app.voices = originalVoiceCache;
                app.voiceCacheInitialized = originalVoiceCacheInitialized;
                app.settings.voiceGenderMap = originalVoiceGenderMap;
                app.settings.voiceBlacklist = originalVoiceBlacklist;
                app.failedSpeechVoiceNames = originalFailedSpeechVoiceNames;
                app.storyDefinition = originalStoryDefinition;
                app.voiceDefinitionCharacterCache = new Map();
            }
            addMessage("system", "Voice resolution smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: voice-resolution-smoke");
        }

        async function devRunAgeDiversitySmokeTest() {
            devTestLog("Scenario start: age-diversity-smoke");
            devResetForLiveTest("age-diversity-smoke");
            devCreateTestProfile({  });
            app.mainMenuOpen = false;
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                },
            });
            const fallbackAges = [
                fallbackAdultAgeForContext("Lira Puddlewick", "guild handler"),
                fallbackAdultAgeForContext("Director Vellis", "guild director"),
                fallbackAdultAgeForContext("Boba Jellwyn", "bubble slime"),
                fallbackAdultAgeForContext("Gliss Molden", "golden slime"),
            ];
            devAssert(
                fallbackAges.every((age) => Number.isInteger(age) && age >= 22 && age <= 45) &&
                    new Set(fallbackAges).size > 1,
                "context age fallback produces stable varied adult ages instead of one default value",
                fallbackAges,
            );
            const metadata = peopleDataToParsedMetadata({
                speakers: [],
                new_npcs: [
                    {
                        full_name: "Lira Puddlewick",
                        gender: "female",
                        role: "guild handler",
                    },
                    {
                        full_name: "Director Vellis",
                        gender: "non-male",
                        role: "guild director",
                    },
                ],
            });
            const ages = Object.values(metadata.newSpeakers || {}).map(
                (npc) => npc.age,
            );
            devAssert(
                ages.length === 2 &&
                    ages.every((age) => Number.isInteger(age) && age >= 18) &&
                    new Set(ages).size > 1,
                "new NPC metadata missing ages uses varied context fallback ages",
                metadata,
            );
            devAssert(
                repairAiAdultAge(0, "Kael Mercer", "slime guild protagonist") !==
                    repairAiAdultAge(0, "Lira Puddlewick", "guild handler"),
                "zero or missing AI age placeholders do not collapse to one universal age",
            );
            addMessage("system", "Age diversity smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: age-diversity-smoke");
        }

        async function devRunSceneModalAutosaveSmokeTest() {
            devTestLog("Scenario start: scene-modal-autosave-smoke");
            devResetForLiveTest("scene-modal-autosave-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic scene-modal state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Scene Modal Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Scene Entry Tester",
                    age: 24,
                    gender: "non-male",
                    role: "scene auditor",
                },
                characters: {
                    "New Ally": {
                        ...blankCharacterTemplate("New Ally"),
                        name: "New Ally",
                        age: 28,
                        gender: "non-male",
                        role: "scout",
                    },
                },
                location: {
                    ...clone(defaultState.location || {}),
                    specific_place: "Old Scene Room",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Old scene modal summary.",
                    party_members_present: ["Player", "New Ally"],
                    image_characters: ["Player"],
                    npcs_present: [],
                    image_action: "old visual pose",
                },
                objectives: {
                    active_id: "scene-modal-test",
                    items: [
                        {
                            id: "scene-modal-test",
                            title: "Test Scene Modal",
                            type: "story",
                            status: "active",
                            summary: "Smoke test scene modal.",
                            objective: "Edit scene fields.",
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
                    text: "Scene modal autosave smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();

            openSceneModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Scene/i.test($("modalBox")?.textContent || "") &&
                    !!$("sceneSummary") &&
                    !!$("sceneImageAction"),
                "Scene modal opens with editable fields",
            );
            $("sceneSummary").value = "Updated scene modal summary.";
            $("sceneSummary").dispatchEvent(new Event("input", { bubbles: true }));
            $("sceneSummary").dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 200));
            devAssert(
                $("modal")?.classList.contains("open") &&
                    !!$("sceneSummary"),
                "Scene autosave keeps modal open after blur",
            );
            devAssert(
                app.state.scene.summary === "Updated scene modal summary.",
                "Scene summary autosaves",
                app.state.scene,
            );

            $("scenePlace").value = "Updated Scene Room";
            $("scenePlace").dispatchEvent(new Event("input", { bubbles: true }));
            $("scenePlace").dispatchEvent(new Event("blur", { bubbles: true }));
            $("sceneImageAction").value = "updated visual pose";
            $("sceneImageAction").dispatchEvent(new Event("input", { bubbles: true }));
            $("sceneImageAction").dispatchEvent(new Event("blur", { bubbles: true }));
            const miraImageCheck = [...document.querySelectorAll(".imageCharCheck")].find(
                (check) => check.value === "New Ally",
            );
            devAssert(!!miraImageCheck, "Scene modal renders party image checkbox");
            miraImageCheck.checked = true;
            miraImageCheck.dispatchEvent(new Event("change", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 250));
            devAssert(
                app.state.location.specific_place === "Updated Scene Room" &&
                    app.state.scene.image_action === "updated visual pose" &&
                    app.state.scene.image_characters.includes("New Ally"),
                "Scene place, image action, and image characters autosave",
                { location: app.state.location, scene: app.state.scene },
            );

            closeModal();
            render();
            setLeftPanelGroup("scene");
            devAssert(
                /Updated scene modal summary/i.test(
                    `${$("leftGroupBody")?.textContent || ""} ${$("sceneCard")?.textContent || ""}`,
                ),
                "Scene card reflects autosaved scene summary after closing",
            );

            addMessage("system", "Scene modal autosave smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: scene-modal-autosave-smoke");
        }

        async function devRunExportStorageSmokeTest() {
            devTestLog("Scenario start: export-storage-smoke");
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const profileImageId = `export-profile-${crypto.randomUUID()}`;
            const alternateProfileImageId =
                `export-profile-alternate-${crypto.randomUUID()}`;
            let sourceSaveId = null;
            let importedSaveId = null;
            try {
                const helperDocument = document.implementation.createHTMLDocument(
                    "Folder export bridge smoke",
                );
                const directoryHandle = { name: "folder-export-smoke" };
                const helperWindow = {
                    document: helperDocument,
                    closed: false,
                    showDirectoryPicker: async (options) => {
                        devAssert(
                            options?.mode === "readwrite",
                            "cross-frame folder export requests read/write directory access",
                        );
                        return directoryHandle;
                    },
                    close() {
                        this.closed = true;
                    },
                };
                const bridgedDirectoryPromise = chooseImageExportDirectory({
                    currentWindow: { self: {}, top: {} },
                    openWindow: () => helperWindow,
                });
                helperDocument.querySelector("button")?.click();
                const bridgedDirectory = await bridgedDirectoryPromise;
                devAssert(
                    bridgedDirectory === directoryHandle && !helperWindow.closed,
                    "cross-origin iframe folder export keeps its top-level helper alive while the directory handle is in use",
                    { bridgedDirectory, helperClosed: helperWindow.closed },
                );
                releaseImageExportDirectory(bridgedDirectory);
                devAssert(
                    helperWindow.closed,
                    "folder export closes its top-level helper after directory writes finish",
                );
                devResetForLiveTest("export-storage-smoke");
                devCreateTestProfile({  });
                const player = devSmokeRuntimeCharacter("Export Tester", {
                    gender: "female",
                    role: "storage auditor",
                });
                const objective = devSmokeObjective(
                    "export-storage-objective",
                    "Verify Export Storage",
                    {
                        status: "active",
                        ending_type: "freeplay",
                        ending_message: "The export storage test continues in freeplay.",
                    },
                );
                const state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Export Storage Smoke",
                        },
                    },
                    player,
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "Export storage smoke scene.",
                        party_members_present: [],
                        image_characters: [],
                        npcs_present: [],
                    },
                    objectives: {
                        active_id: objective.id,
                        focus_id: objective.id,
                        items: [objective],
                    },
                });
                await createNewActiveSave("export storage smoke save", {
                    state,
                    messages: [
                        {
                            id: "export-user-message",
                            role: "user",
                            speaker: "Export Tester",
                            text: "Save this test message.",
                            at: new Date().toISOString(),
                        },
                        {
                            id: "export-assistant-message",
                            role: "assistant",
                            speaker: "Narrator",
                            text: "This message should round-trip through normalized storage.",
                            at: new Date().toISOString(),
                        },
                    ],
                });
                sourceSaveId = Number(activeSaveId());

                app.images.push({
                    id: "export-story-image",
                    imageId: "export-story-image",
                    title: "Export image",
                    prompt: "storage test image",
                    negativePrompt: "text, watermark",
                    model: "game-art",
                    hosted_url: "https://example.invalid/export-story-image.png",
                    at: new Date().toISOString(),
                    favorite: true,
                    status: "ready",
                    targets: [player.id],
                });
                markRuntimeCollectionDirty("images", "export-story-image", "put");
                await app.persistence.putSharedRecords([
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: profileImageId,
                            characterId: player.id,
                            presentation: "non_male",
                            favorite: true,
                            model: "game-art-icon",
                            seed: 919,
                            prompt: "storage test profile image",
                            negativePrompt: "text, watermark",
                            url: "https://example.invalid/export-profile-image.png",
                        },
                    },
                    {
                        storeName: "characterProfileImages",
                        record: {
                            imageId: alternateProfileImageId,
                            characterId: player.id,
                            presentation: "non_male",
                            favorite: false,
                            model: "game-art-icon",
                            seed: 920,
                            prompt: "alternate storage test profile image",
                            negativePrompt: "text, watermark",
                            url: "https://example.invalid/export-profile-image-alternate.png",
                        },
                    },
                    {
                        storeName: "characterProfileImageSelections",
                        record: {
                            characterId: player.id,
                            presentation: "non_male",
                            imageId: alternateProfileImageId,
                        },
                    },
                ]);
                await flushRuntimeSaveProjections();

                const loaded = await app.persistence.loadSave(sourceSaveId, 40);
                const reconstructed = await app.library.reconstructRuntimeSave(sourceSaveId);
                const profiles = await app.persistence.listSharedRecords(
                    "characterProfileImages",
                    {
                        indexName: "byCharacter",
                        key: player.id,
                    },
                );
                const reconstructedProfileImages =
                    reconstructed.state?.player?.profile_images || [];
                devAssert(
                    reconstructed.state?.player?.name === "Export Tester" &&
                        loaded.recordsByStore?.messages?.some((message) =>
                            /round-trip through normalized storage/i.test(message.text || ""),
                        ) &&
                        loaded.recordsByStore?.storyImages?.some(
                            (image) => image.imageId === "export-story-image",
                        ) &&
                        (profiles.records || profiles.entries || profiles || []).some(
                            (image) => image.imageId === profileImageId,
                        ) &&
                        reconstructedProfileImages.some(
                            (image) => image.id === profileImageId,
                        ) &&
                        reconstructedProfileImages.every(
                            (image) => !Object.hasOwn(image, "imageId"),
                        ),
                    `normalized state, messages, story images, and shared profile images are durable; ${JSON.stringify({ player: reconstructed.state?.player?.name, message: loaded.recordsByStore?.messages?.map((entry) => entry.text), storyImages: loaded.recordsByStore?.storyImages?.map((entry) => entry.imageId), profileImages: (profiles.records || profiles.entries || profiles || []).map((entry) => entry.imageId) })}`,
                    {
                        player: reconstructed.state?.player,
                        messages: loaded.recordsByStore?.messages,
                        storyImages: loaded.recordsByStore?.storyImages,
                        profiles,
                        reconstructedProfileImages,
                    },
                );

                const imageIndex = await app.persistence.exportAllImageIndex();
                const selectionImportRecords = Object.fromEntries(
                    Object.keys(imageIndex.records || {}).map((storeName) => [
                        storeName,
                        [],
                    ]),
                );
                selectionImportRecords.characterProfileImageSelections = [
                    {
                        characterId: player.id,
                        presentation: "non_male",
                        imageId: profileImageId,
                    },
                ];
                const selectionImportResult = await app.persistence.importAllImages(
                    new Blob([
                        JSON.stringify({
                            app: "EmberAdventures",
                            exportType: "all-images",
                            schemaVersion: app.persistence.schemaInfo.version,
                            records: selectionImportRecords,
                        }),
                    ], { type: "application/json" }),
                );
                const restoredSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [player.id, "non_male"],
                );
                devAssert(
                    selectionImportResult.replaced === 1 &&
                        selectionImportResult.imported === 0 &&
                        restoredSelection?.imageId === profileImageId,
                    "image restoration replaces a conflicting selection pointer when its archived image is available",
                    { selectionImportResult, restoredSelection },
                );

                const rollbackSnapshotId = `export-rollback-${crypto.randomUUID()}`;
                const rollbackNpcName = "Export Undo Witness";
                const rollbackLocationId = app.state.location.npc_location_id;
                const rollbackNpc = npcShellSaveOperation({
                    kind: "npc", recordId: JSON.stringify([rollbackLocationId, rollbackNpcName]),
                }, {
                    id: `export-undo-witness-${crypto.randomUUID()}`, name: rollbackNpcName,
                    gender: "female", age: 37, role: "storage test witness", relationship: "neutral",
                    note: "Original witness note.", personality_description: "Patient.",
                    current_appearance: "Wearing a navy coat.", status: "alive", inspected: false,
                }).shell;
                const rollbackNpcOperation = (note) => ({
                    type: "runtime.records.replace", storeName: "npcShells",
                    match: { locationId: rollbackLocationId, characterId: rollbackNpc.characterId },
                    records: [{ ...rollbackNpc, note }],
                });
                await app.persistence.submitOperations("export-undo-baseline", [rollbackNpcOperation(rollbackNpc.note)]);
                await app.persistence.beginSnapshot({
                    snapshotId: rollbackSnapshotId, createdAt: new Date().toISOString(),
                    reason: "Import undo ownership regression", messageBoundaryId: String(app.messages.at(-1).id),
                });
                await app.persistence.submitOperations("export-undo-change", [
                    rollbackNpcOperation("Changed witness note."),
                    {
                        type: "runtime.records.replace", storeName: "worldValues",
                        match: { fieldId: "export-undo-ownership" },
                        records: [{ fieldId: "export-undo-ownership", value: { saveId: sourceSaveId, text: "Gameplay data is not remapped." } }],
                    },
                ]);
                await app.persistence.commitSnapshot(rollbackSnapshotId);

                const exported = await app.persistence.exportSave(sourceSaveId);
                const payload = JSON.parse(await exported.blob.text());
                devAssert(
                    exported.blob instanceof Blob &&
                        payload.exportType === "normalized-save" &&
                        payload.schemaVersion === app.persistence.schemaInfo?.version &&
                        payload.records?.saveHeaders?.length === 1 &&
                        payload.records?.messages?.some((message) =>
                            /Save this test message/i.test(message.text || ""),
                        ) &&
                        payload.records?.storyImages?.some(
                            (image) => image.imageId === "export-story-image",
                        ) &&
                        !Object.values(payload.records || {}).some((records) =>
                            (records || []).some((record) =>
                                Object.hasOwn(record || {}, "state") ||
                                Object.hasOwn(record || {}, "objectives"),
                            ),
                        ),
                    "normalized export contains portable bounded records and no aggregate state",
                    {
                        exportType: payload.exportType,
                        schemaVersion: payload.schemaVersion,
                    },
                );

                await exportData({
                    scope: {
                        saveIds: [String(sourceSaveId)],
                        storyIds: [],
                        characterIds: [],
                        profileImageIds: [],
                        storyTitleImageIds: [],
                    },
                });
                const fullBackup = app.__emberAdventuresLastJsonDownload?.payload;
                devAssert(
                    fullBackup?.activeSaveId === sourceSaveId &&
                        Number.isSafeInteger(fullBackup?.activeSaveId),
                    "full backup export converts the runtime text save identity to the required positive integer",
                    {
                        runtimeActiveSaveId: activeSaveId(),
                        exportedActiveSaveId: fullBackup?.activeSaveId,
                    },
                );

                const imported = await app.persistence.importSave(exported.blob);
                importedSaveId = Number(imported.saveId);
                const importedRuntime = await app.library.reconstructRuntimeSave(importedSaveId);
                const importedRecords = await app.persistence.loadSave(importedSaveId, 40);
                devAssert(
                    importedSaveId !== sourceSaveId &&
                        importedRuntime.state?.player?.name === "Export Tester" &&
                        importedRecords.recordsByStore?.messages?.some((message) =>
                            /round-trip through normalized storage/i.test(message.text || ""),
                        ) &&
                        importedRecords.recordsByStore?.storyImages?.some(
                            (image) => image.imageId === "export-story-image",
                        ),
                    "normalized save import creates an independent complete save",
                    { sourceSaveId, importedSaveId },
                );
                const importedUndo = importedRecords.recordsByStore.snapshotReverseOperations.filter(
                    (record) => record.snapshotId === rollbackSnapshotId,
                );
                devAssert(
                    importedUndo.some((record) => record.targetStore === "npcShells" && record.operation === "put") &&
                        importedUndo.some((record) => record.targetStore === "worldValues" && record.operation === "delete") &&
                        importedUndo.every((record) => record.targetKey[0] === importedSaveId &&
                            (record.operation !== "put" || record.previousRecord.saveId === importedSaveId)) &&
                        importedRecords.recordsByStore.worldValues.find((record) => record.fieldId === "export-undo-ownership").value.saveId === sourceSaveId,
                    "import rebinds snapshot keys and previous rows to the new save without rewriting gameplay content",
                );
                await app.persistence.closeActiveSave();
                await app.persistence.activateSave(importedSaveId);
                await app.persistence.rollbackSnapshot(rollbackSnapshotId);
                const restoredNpc = await app.persistence.getRecord("npcShells", [importedSaveId, rollbackNpc.characterId]);
                devAssert(restoredNpc?.note === rollbackNpc.note, "imported undo restores the exact prior NPC record before further writes");
                await app.persistence.submitOperations("export-undo-resave", [rollbackNpcOperation("Saved after imported undo.")]);
                const afterUndo = await app.persistence.loadSave(importedSaveId, 40);
                const unchangedSource = await app.persistence.loadSave(sourceSaveId, 40);
                devAssert(
                    afterUndo.recordsByStore.npcShells.some((record) => record.characterId === rollbackNpc.characterId && record.note === "Saved after imported undo.") &&
                        !afterUndo.recordsByStore.worldValues.some((record) => record.fieldId === "export-undo-ownership") &&
                        !afterUndo.recordsByStore.snapshots.some((record) => record.snapshotId === rollbackSnapshotId) &&
                        unchangedSource.recordsByStore.npcShells.some((record) => record.characterId === rollbackNpc.characterId && record.note === "Changed witness note.") &&
                        unchangedSource.recordsByStore.worldValues.some((record) => record.fieldId === "export-undo-ownership"),
                    "imported snapshot undo supports put, delete, and subsequent saves while leaving the source untouched",
                );
                devTestLog("Scenario complete: export-storage-smoke");
            } finally {
                if (app.persistence?.activeSaveState)
                    await app.persistence.closeActiveSave();
                app.saveSessionActive = false;
                app.saveSessionContext = null;
                cancelSaveProjectionFlush();
                if (importedSaveId != null)
                    await app.persistence.deleteSave(importedSaveId);
                if (sourceSaveId != null)
                    await app.persistence.deleteSave(sourceSaveId);
                await app.persistence.deleteSharedImage(
                    "characterProfileImages",
                    profileImageId,
                );
                await app.persistence.deleteSharedImage(
                    "characterProfileImages",
                    alternateProfileImageId,
                );
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunLegacyAggregateExportStorageSmokeTest() {
            devTestLog("Scenario start: export-storage-smoke");
            devResetForLiveTest("export-storage-smoke");
            devCreateTestProfile({  });
            const storageFailureCountBeforeSave = (app.storageFailures || []).length;
            // SANITIZE KEEP (dev fixture): synthetic state setup for smoke test.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Export Storage Smoke",
                    },
                },
                player: devCompleteSmokeGenderPresentation({
                    ...clone(defaultState.player || {}),
                    name: "Export Tester",
                    age: 26,
                    gender: "non-male",
                    role: "storage auditor",
                    profile_image_id: "export-profile-image",
                    profile_images: [
                        {
                            id: "export-profile-image",
                            at: new Date().toISOString(),
                            favorite: true,
                        },
                    ],
                }, "Export Tester"),
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Export storage smoke scene.",
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                objectives: {
                    active_id: "export-storage-objective",
                    items: [
                        {
                            id: "export-storage-objective",
                            title: "Verify Export Storage",
                            type: "story",
                            status: "active",
                            summary: "Make sure saved payloads survive large storage.",
                            objective: "Export and reload saved data.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.messages = [
                {
                    id: "export-user-message",
                    role: "user",
                    speaker: "Export Tester",
                    text: "Save this test message.",
                    at: new Date().toISOString(),
                },
                {
                    id: "export-assistant-message",
                    role: "assistant",
                    speaker: "Narrator",
                    text: "This message should round-trip through large storage.",
                    at: new Date().toISOString(),
                },
            ];
            const smokeImageHtml =
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Export smoke image">`;
            app.images = [
                {
                    id: "export-image",
                    title: "Export image",
                    prompt: "storage test image",
                    html: smokeImageHtml,
                    created_at: new Date().toISOString(),
                    favorite: true,
                },
            ];
            app.profileImages = exactProfileImageStore([
                {
                    id: "export-profile-image",
                    owner_name: "Export Tester",
                    source: "smoke",
                    model: "default",
                    seed: 919,
                    prompt: "storage test profile image",
                    html: smokeImageHtml,
                    favorite: true,
                },
            ]);
            const exportTemplateState = clone(app.state);
            addImmutableDefinitionFieldsToState(exportTemplateState);
            devUpsertStoryTemplatesForSmoke([
                {lite: true,
                    id: "export-story-template",
                    title: "Export Story Template",
                    description: "Synthetic export and storage smoke story.",
                    mode: "original",
                    creator: "debug harness",
                    creation_tool: "debug harness",
                    genres: ["fantasy"],
                    updated_at: new Date().toISOString(),
                    state: exportTemplateState,
                },
            ]);
            await createNewActiveSave("export storage smoke save", {
                state: app.state,
                messages: app.messages,
                images: app.images,
                profileImages: app.profileImages,
                snapshots: app.snapshots,
            });
            app.__emberAdventuresLastJsonDownload = null;
            await flushActiveGameSave();
            const newStorageFailures = (app.storageFailures || []).slice(
                storageFailureCountBeforeSave,
            );
            devAssert(
                !newStorageFailures.length,
                "flushActiveGameSave completes without storage failures",
                newStorageFailures,
            );
            const saveId = activeSaveId();
            const smokeExportScope = {
                saveIds: [saveId],
                storyIds: ["export-story-template"],
                characterIds: [],
                profileImageIds: ["export-profile-image"],
                storyTitleImageIds: [],
            };
            const savedRecord = await loadSaveRecord(saveId);
            const savedState = savedRecord?.state;
            const savedMessages = savedRecord?.messages;
            const savedImages = await loadSaveImages(saveId);
            const savedProfileImages = exactProfileImageStore(
                await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []),
            );
            devAssert(
                savedRecord?.index?.saveId === saveId &&
                    savedRecord?.state &&
                    Array.isArray(savedRecord?.messages) &&
                    Array.isArray(savedRecord?.snapshots),
                "one complete save record is written for the active game",
                savedRecord,
            );
            devAssert(
                savedState?.player?.name === "Export Tester",
                "single save record persisted current state",
                savedState?.player,
            );
            devAssert(
                Array.isArray(savedMessages) &&
                    savedMessages.some((message) =>
                        /round-trip through large storage/i.test(message.text || ""),
                    ),
                "single save record persisted message history",
                savedMessages,
            );
            devAssert(
                Array.isArray(savedImages) &&
                    savedImages.some((image) => image.id === "export-image"),
                "external save image storage persisted image history",
                savedImages,
            );
            devAssert(
                Array.isArray(savedProfileImages) &&
                    savedProfileImages.some(
                        (image) => image.id === "export-profile-image",
                    ),
                "global profile image storage persisted profile image history",
                savedProfileImages,
            );
            await exportData({ scope: smokeExportScope });
            const exported = app.__emberAdventuresLastJsonDownload;
            devAssert(
                exported?.filename === "emberadventureslite-export.json" &&
                    exported?.payload?.app === "EmberAdventures",
                "exportData emits the expected export filename",
                exported,
            );
            devAssert(
                exported?.payload?.activeSaveId === Number(saveId) &&
                    Number.isSafeInteger(exported?.payload?.activeSaveId) &&
                    exported?.payload?.saves?.some(
                        (save) =>
                            save.index?.saveId === saveId &&
                            save.state?.player?.name === "Export Tester" &&
                            save.messages?.some((message) =>
                                /Save this test message/i.test(message.text || ""),
                            ) &&
                            save.images?.some((image) => image.id === "export-image"),
                    ),
                "exportData includes single save records plus external image records and exports its active save identity as a strict integer",
                exported?.payload,
            );
            app.__emberAdventuresLastBlobDownload = null;
            await exportData({
                emergency: true,
                fileName: "emberadventureslite-smoke-issue-backup.json",
                scope: smokeExportScope,
            });
            const emergencyDownload =
                app.__emberAdventuresLastBlobDownload;
            const emergencyPayload = emergencyDownload?.blob
                ? JSON.parse(await emergencyDownload.blob.text())
                : null;
            const diagnosticPhase = readDiagnosticExportPhase();
            devAssert(
                emergencyDownload?.filename ===
                    "emberadventureslite-smoke-issue-backup.json" &&
                    emergencyPayload?.app === "EmberAdventures" &&
                    emergencyPayload?.diagnosticExport
                        ?.durableWorkerExport === true &&
                    emergencyPayload?.diagnosticExport
                        ?.runtimeSnapshotIncluded === false &&
                    !Object.hasOwn(emergencyPayload || {}, "runtimeSnapshot") &&
                    emergencyPayload?.exportType === "diagnostic-snapshot" &&
                    emergencyPayload?.diagnosticExport?.source === "current-library-worker" &&
                    emergencyPayload?.diagnosticExport?.restoreSupported === false &&
                    emergencyPayload?.storeCounts?.runtime?.saveHeaders >= 0 &&
                    diagnosticPhase?.status === "complete" &&
                    diagnosticPhase?.phase === "complete",
                "emergency issue export reads current durable store counts without duplicating live runtime and records completion diagnostics",
                {
                    emergencyDownload: {
                        filename: emergencyDownload?.filename,
                        bytes: emergencyDownload?.blob?.size || 0,
                    },
                    diagnosticPhase,
                    diagnosticExport: emergencyPayload?.diagnosticExport,
                },
            );
            localStorage.removeItem(DIAGNOSTIC_EXPORT_PHASE_KEY);
            addMessage("system", "Export/storage smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: export-storage-smoke");
        }









        async function devRunCharacterEditorAutosaveSmokeTest() {
            devTestLog("Scenario start: character-editor-autosave-smoke");
            devResetForLiveTest("character-editor-autosave-smoke");
            devCreateTestProfile({  });
            const previousTextToImagePlugin = globalThis.textToImagePlugin;
            globalThis.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({
                    dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                }),
            });
            const smokeImageHtml =
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Character smoke image">`;
            // SANITIZE KEEP (dev fixture): synthetic state setup for smoke test.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Character Editor Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Editor Tester",
                    age: 24,
                    gender: "male",
                    role: "tester",
                    clothing: {
                        ...blankClothingTemplate(),
                        shirt: "standard tester shirt",
                        pants: "standard tester pants",
                    },
                    outfits: [
                        {
                            id: "tester-standard",
                            name: "Tester Standard",
                            clothing: {
                                shirt: "standard tester shirt",
                                pants: "standard tester pants",
                            },
                        },
                    ],
                    active_outfit_id: "tester-standard",
                },
                characters: {
                    "Real Editor Kara": {
                        ...blankCharacterTemplate("Real Editor Kara"),
                        id: "real-editor-kara",
                        name: "Real Editor Kara",
                        age: 29,
                        gender: "non-male",
                        role: "old scout role",
                        relationship_to_player: "ally",
                        personality_description: "A practical scout who checks every exit.",
                        clothing: {
                            ...blankClothingTemplate(),
                            shirt: "green scout jacket",
                            pants: "brown scout trousers",
                        },
                        outfits: [
                            {
                                id: "scout-standard",
                                name: "Scout Standard",
                                clothing: {
                                    shirt: "green scout jacket",
                                    pants: "brown scout trousers",
                                },
                            },
                        ],
                        active_outfit_id: "scout-standard",
                        profile_image_id: "kara-editor-profile",
                        profile_images: [
                            {
                                id: "kara-editor-profile",
                                at: new Date().toISOString(),
                                favorite: true,
                                male: false,
                            },
                        ],
                    },
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "editor-plaza",
                    specific_place: "Editor Plaza",
                },
                npc_directory: {
                    locations: {
                        "editor-plaza": {
                            label: "Editor Plaza",
                            characters: {
                                "Nia Edit": {
                                    name: "Nia Edit",
                                    gender: "female",
                                    age: 32,
                                    role: "record keeper",
                                    relationship: "neutral",
                                    note: "Keeps editor smoke records.",
                                    inspected: true,
                                    status: "alive",
                                    death_note: "",
                                    full_character: {
                                        ...blankCharacterTemplate("Nia Edit"),
                                        name: "Nia Edit",
                                        age: 32,
                                        gender: "female",
                                        role: "record keeper",
                                        relationship_to_player: "neutral",
                                        clothing: {
                                            ...blankClothingTemplate(),
                                            shirt: "gray keeper blouse",
                                            pants: "gray keeper skirt",
                                        },
                                        outfits: [
                                            {
                                                id: "keeper-standard",
                                                name: "Keeper Standard",
                                                clothing: {
                                                    shirt: "gray keeper blouse",
                                                    pants: "gray keeper skirt",
                                                },
                                            },
                                        ],
                                        active_outfit_id: "keeper-standard",
                                    },
                                },
                            },
                        },
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Player", "Real Editor Kara"],
                    image_characters: ["Player", "Real Editor Kara"],
                    npcs_present: ["Nia Edit"],
                },
                objectives: {
                    active_id: "character-editor-objective",
                    items: [
                        {
                            id: "character-editor-objective",
                            title: "Verify Character Editor",
                            type: "story",
                            status: "active",
                            summary: "Smoke test character editor autosave.",
                            objective: "Edit a character field.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.profileImages = exactProfileImageStore([
                createProfileImageRecord({
                    id: "kara-editor-profile",
                    character_id: app.state.characters["Real Editor Kara"].id,
                    owner_name: "Real Editor Kara",
                    male: false,
                    source: "smoke",
                    model: "default",
                    seed: 515,
                    prompt: "character editor smoke profile",
                    html: smokeImageHtml,
                    favorite: true,
                }),
            ]);


            app.settings.leftPanelGroup = "characters";
            app.settings.leftPanelSections = {
                ...(app.settings.leftPanelSections || {}),
                "characters-player": true,
                "characters-party": true,
                "characters-npcs": true,
            };
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Character editor autosave smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();
            const cardControlMatrix = [
                {
                    label: "player",
                    card: document.querySelector(
                        '#playerList [data-character-card][data-character-name="Player"]',
                    ),
                    expectsRemove: false,
                },
                {
                    label: "party member",
                    card: document.querySelector(
                        '#characterList [data-character-card][data-character-name="Real Editor Kara"]',
                    ),
                    expectsRemove: true,
                },
                {
                    label: "npc",
                    card: [...document.querySelectorAll("#npcSceneList .character-card")].find(
                        (card) => /Nia Edit/i.test(card.textContent || ""),
                    ),
                    expectsRemove: true,
                },
            ];
            const cardControlResults = cardControlMatrix.map((item) => {
                const profileButton = item.card?.querySelector(".profile-image-button");
                const profileRect = profileButton?.getBoundingClientRect?.();
                const cardRect = item.card?.getBoundingClientRect?.();
                const removeButton = [...(item.card?.querySelectorAll(".icon-button") || [])].find(
                    (button) => /^X$/i.test((button.textContent || "").trim()),
                );
                const sceneToggleButton = [...(item.card?.querySelectorAll(".icon-button") || [])].find(
                    (button) => /Add to scene|Remove from scene/i.test(button.getAttribute("title") || ""),
                );
                const editButton = [...(item.card?.querySelectorAll(".icon-button") || [])].find(
                    (button) => /edit/i.test(button.getAttribute("title") || ""),
                );
                return {
                    label: item.label,
                    exists: !!item.card,
                    profileButtonWidth: profileRect?.width || 0,
                    cardWidth: cardRect?.width || 0,
                    removeClass: removeButton?.className || "",
                    sceneToggleClass: sceneToggleButton?.className || "",
                    hasEdit: !!editButton,
                    expectsRemove: item.expectsRemove,
                };
            });
            devAssert(
                cardControlResults.every(
                    (item) =>
                        item.exists &&
                        item.hasEdit &&
                        item.profileButtonWidth > 0 &&
                        item.profileButtonWidth <= Math.max(90, item.cardWidth * 0.45) &&
                        (!item.expectsRemove ||
                            /\bwarn\b/.test(item.removeClass) ||
                            /\bparty-(?:on|off)\b/.test(item.sceneToggleClass)),
                ),
                "left-column player, party member, and NPC cards use compact profile images and expose required edit/remove controls",
                cardControlResults,
            );
            const fieldByPath = devFieldByPath;
            openPlayerModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Character Definition/i.test($("modalBox")?.textContent || "") &&
                    /Game Managed Data/i.test($("modalBox")?.textContent || ""),
                "player editor separates Character Definition and Game Managed Data",
                $("modalBox")?.textContent || "",
            );
            const playerEditorTextArea = fieldByPath("#playerFriendlyEditor", [
                "character_definition",
                "personality_description",
            ]);
            devAssert(
                !!playerEditorTextArea && playerEditorTextArea.tagName === "TEXTAREA",
                "player editor renders expandable definition textarea",
            );
            playerEditorTextArea.value = Array(7)
                .fill("Player editor textarea autosize line.")
                .join("\n");
            playerEditorTextArea.dispatchEvent(new Event("input", { bubbles: true }));
            await waitForRenderedFrame();
            devAssert(
                playerEditorTextArea.clientHeight >= playerEditorTextArea.scrollHeight - 2,
                "player editor textarea expands to full content",
                {
                    clientHeight: playerEditorTextArea.clientHeight,
                    scrollHeight: playerEditorTextArea.scrollHeight,
                    overflowY: getComputedStyle(playerEditorTextArea).overflowY,
                },
            );
            devAssert(
                !/\bcharacter_definition\b|\bgame_managed_data\b/.test(
                    $("modalBox")?.textContent || "",
                ),
                "player editor hides raw definition/managed section keys",
                $("modalBox")?.textContent || "",
            );
            devAssert(
                !!fieldByPath("#playerFriendlyEditor", [
                    "character_definition",
                    "age",
                ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "id",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "profile_image_id",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "default_profile_image",
                        "url",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "default_seed",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "voice",
                        "preferred_voice_name",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "character_definition",
                        "outfits",
                        0,
                        "name",
                    ]) &&
                    !fieldByPath("#playerFriendlyEditor", [
                        "game_managed_data",
                        "active_outfit_id",
                    ]),
                "player editor exposes editable definition fields but hides image, seed, voice, and outfit internals",
            );





            await new Promise((resolve) => setTimeout(resolve, 150));
            flushStateEditorAutoSave("modalBox");
            const playerShirtField = fieldByPath("#playerFriendlyEditor", [
                "game_managed_data",
                "clothing",
                "shirt",
            ]);
            devAssert(!!playerShirtField, "player editor exposes current shirt clothing slot");
            playerShirtField.value = "custom typed player shirt";
            playerShirtField.dispatchEvent(new Event("input", { bubbles: true }));
            playerShirtField.dispatchEvent(new Event("change", { bubbles: true }));
            playerShirtField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            const playerClothingDraft = readCharacterDefinitionManagedEditor(
                app.playerEditorBaseline,
                $("playerFriendlyEditor"),
            );
            const playerEditorBinding = app.stateEditorAutoSaveBindings?.get?.("modalBox");
            const playerClothingSaved = flushStateEditorAutoSave("modalBox");
            devAssert(
                clothingItemText(app.state.player.clothing?.shirt) === "custom typed player shirt" &&
                    !app.state.player.active_outfit_id,
                `manual player clothing text edit persists and clears active outfit so it is not overwritten; draft=${JSON.stringify(playerClothingDraft.clothing?.shirt)} draftActive=${JSON.stringify(playerClothingDraft.active_outfit_id)} dirtyBeforeFlush=${JSON.stringify(playerEditorBinding?.dirty)} runningBeforeFlush=${JSON.stringify(playerEditorBinding?.running)} saved=${JSON.stringify(playerClothingSaved)} saveError=${JSON.stringify(playerEditorBinding?.lastError?.stack || playerEditorBinding?.lastError?.message || "")} shirt=${JSON.stringify(app.state.player.clothing?.shirt)} active=${JSON.stringify(app.state.player.active_outfit_id)}`,
                app.state.player,
            );
            closeModal();
            const beforePresentationCloseCoverage = clone(app.state.characters["Real Editor Kara"]);
            for (const romanceable of [true, false]) {
                const presented = clone(beforePresentationCloseCoverage);
                presented.romanceable = romanceable;
                materializeRuntimeCharacterPresentation(presented, presented.name);
                devAssert(presented.romanceable === romanceable,
                    "runtime presentation preserves the authored romanceable boolean");
                app.state.characters["Real Editor Kara"] = presented;
                editCharacter("Real Editor Kara");
                const romanceableField = fieldByPath("#charFriendlyEditor", ["character_definition", "romanceable"]);
                devAssert(romanceableField?.type === "checkbox" && romanceableField.checked === romanceable,
                    "presented character editor retains the romanceable checkbox value");
                closeModal();
                devAssert(app.state.characters["Real Editor Kara"]?.romanceable === romanceable,
                    "closing an unchanged presented character editor preserves true and false without recovery");
            }
            app.state.characters["Real Editor Kara"] = beforePresentationCloseCoverage;
            editCharacter("Real Editor Kara");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Character Definition/i.test($("modalBox")?.textContent || "") &&
                    /Game Managed Data/i.test($("modalBox")?.textContent || ""),
                "party character editor separates Character Definition and Game Managed Data",
                $("modalBox")?.textContent || "",
            );
            devAssert(
                !fieldByPath("#charFriendlyEditor", [
                    "character_definition",
                    "id",
                ]) &&
                    !fieldByPath("#charFriendlyEditor", [
                        "character_definition",
                        "default_seed",
                    ]) &&
                    !fieldByPath("#charFriendlyEditor", [
                        "character_definition",
                        "voice",
                        "preferred_voice_name",
                    ]) &&
                    !fieldByPath("#charFriendlyEditor", [
                        "character_definition",
                        "outfits",
                        0,
                        "name",
                    ]) &&
                    !fieldByPath("#charFriendlyEditor", [
                        "character_definition",
                        "image_prompt_config",
                        "seed",
                    ]) &&
                    !fieldByPath("#charFriendlyEditor", [
                        "game_managed_data",
                        "active_outfit_id",
                    ]),
                "party character editor hides id, seed, voice, image, and outfit internals",
            );
            const personalityField = fieldByPath(
                "#charFriendlyEditor",
                ["character_definition", "personality_description"],
            );
            devAssert(!!personalityField, "character editor renders personality field");
            devAssert(
                personalityField.tagName === "TEXTAREA",
                "long text character definition fields render as expandable textareas",
                personalityField?.outerHTML || "",
            );
            personalityField.value = "A refreshed portrait scout with steady patience.";
            personalityField.dispatchEvent(new Event("input", { bubbles: true }));
            personalityField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 250));
            app.state.characters["Real Editor Kara"].trust = 7;
            flushStateEditorAutoSave("charFriendlyEditor");
            devAssert(
                $("modal")?.classList.contains("open") &&
                    !!$("charFriendlyEditor"),
                "character editor autosave keeps modal open",
            );
            devAssert(
                app.state.characters["Real Editor Kara"]?.personality_description ===
                    "A refreshed portrait scout with steady patience." &&
                    app.state.characters["Real Editor Kara"]?.trust === 7,
                "character editor commits its changed field without overwriting a concurrent runtime relationship update",
                app.state.characters["Real Editor Kara"],
            );
            const extraDescriptionField = fieldByPath("#charFriendlyEditor", [
                "character_definition",
                "appearance",
                "extra_description",
            ]);
            devAssert(!!extraDescriptionField, "character editor renders prompt-relevant extra description field");
            extraDescriptionField.value = "silver-threaded braids";
            extraDescriptionField.dispatchEvent(new Event("input", { bubbles: true }));
            extraDescriptionField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            flushStateEditorAutoSave("charFriendlyEditor");
            const characterShirtField = fieldByPath("#charFriendlyEditor", [
                "game_managed_data",
                "clothing",
                "shirt",
            ]);
            devAssert(!!characterShirtField, "party character editor exposes current shirt clothing slot");
            characterShirtField.value = "custom typed scout coat";
            characterShirtField.dispatchEvent(new Event("input", { bubbles: true }));
            characterShirtField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            flushStateEditorAutoSave("charFriendlyEditor");
            devAssert(
                clothingItemText(app.state.characters["Real Editor Kara"]?.clothing?.shirt) ===
                    "custom typed scout coat" &&
                    !app.state.characters["Real Editor Kara"]?.active_outfit_id,
                "manual party character clothing text edit persists and clears active outfit so it is not overwritten",
                app.state.characters["Real Editor Kara"],
            );
            const activeBeforeClose = activeProfileImage(app.state.characters["Real Editor Kara"]);
            devAssert(
                !/silver-threaded braids/i.test(activeBeforeClose?.prompt || ""),
                "character editor does not refresh profile prompt while modal is still open",
                activeBeforeClose,
            );
            closeModal();
            await devWaitFor(
                () => {
                    const active = activeProfileImage(app.state.characters["Real Editor Kara"]);
                    return (
                        active &&
                        /silver-threaded braids/i.test(active.prompt || "") &&
                        devLooksLikeRealImageHtml(active.html)
                    );
                },
                3000,
                "character editor close creates a refreshed active portrait once",
            );
            const refreshedProfile = activeProfileImage(app.state.characters["Real Editor Kara"]);
            devAssert(
                profileImagesForEntity(app.state.characters["Real Editor Kara"]).some(
                    (image) => image.id === "kara-editor-profile",
                ),
                "character editor preserves previous profile image record",
                profileImagesForEntity(app.state.characters["Real Editor Kara"]),
            );
            devAssert(
                /silver-threaded braids/i.test(refreshedProfile?.prompt || "") &&
                    String(refreshedProfile?.id || "") !== "kara-editor-profile" &&
                    devLooksLikeRealImageHtml(refreshedProfile.html),
                "character editor creates a new prompt-changed active profile image after close",
                refreshedProfile,
            );
            editNpc("Nia Edit", "Editor Plaza");
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Character Definition/i.test($("modalBox")?.textContent || "") &&
                    /Game Managed Data/i.test($("modalBox")?.textContent || ""),
                "inspected NPC editor separates Character Definition and Game Managed Data",
                $("modalBox")?.textContent || "",
            );
            devAssert(
                !fieldByPath("#npcFriendlyEditor", [
                    "character_definition",
                    "id",
                ]) &&
                    !fieldByPath("#npcFriendlyEditor", [
                        "character_definition",
                        "default_seed",
                    ]) &&
                    !fieldByPath("#npcFriendlyEditor", [
                        "character_definition",
                        "voice",
                        "preferred_voice_name",
                    ]) &&
                    !fieldByPath("#npcFriendlyEditor", [
                        "character_definition",
                        "outfits",
                        0,
                        "name",
                    ]) &&
                    !fieldByPath("#npcFriendlyEditor", [
                        "game_managed_data",
                        "active_outfit_id",
                    ]),
                "inspected NPC editor hides id, seed, voice, and outfit internals",
            );



            await new Promise((resolve) => setTimeout(resolve, 150));
            flushStateEditorAutoSave("npcFriendlyEditor");
            const npcShirtField = fieldByPath("#npcFriendlyEditor", [
                "game_managed_data",
                "clothing",
                "shirt",
            ]);
            devAssert(!!npcShirtField, "inspected NPC editor exposes current shirt clothing slot");
            npcShirtField.value = "custom typed keeper jacket";
            npcShirtField.dispatchEvent(new Event("input", { bubbles: true }));
            npcShirtField.dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            flushStateEditorAutoSave("npcFriendlyEditor");
            devAssert(
                clothingItemText(
                    getNpcEntry("Nia Edit", "Editor Plaza")?.full_character?.clothing?.shirt,
                ) === "custom typed keeper jacket" &&
                    !getNpcEntry("Nia Edit", "Editor Plaza")?.full_character
                        ?.active_outfit_id,
                "manual inspected NPC clothing text edit persists and clears active outfit so it is not overwritten",
                getNpcEntry("Nia Edit", "Editor Plaza")?.full_character,
            );
            if (typeof previousTextToImagePlugin === "undefined")
                delete globalThis.textToImagePlugin;
            else globalThis.textToImagePlugin = previousTextToImagePlugin;
            closeModal();
            render();
            setLeftPanelGroup("characters");
            devAssert(
                /Real Editor Kara/i.test($("characterList")?.textContent || ""),
                "party card still renders edited character",
                $("characterList")?.textContent || "",
            );
            addMessage("system", "Character editor autosave smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: character-editor-autosave-smoke");
        }

        async function devRunFutureCharacterPromptSmokeTest() {
            devTestLog("Scenario start: future-character-prompt-smoke");
            devResetForLiveTest("future-character-prompt-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic future-character state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Future Character Prompt Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Future Tester",
                    age: 24,
                    gender: "male",
                    role: "tester",
                },
                objectives: {
                    active_id: "future-character-objective",
                    items: [
                        {
                            id: "future-character-objective",
                            title: "Verify Future Character Prompt",
                            type: "story",
                            status: "active",
                            summary: "Smoke test future character prompt.",
                            objective: "Add a future cast entry.",
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
                    text: "Future character prompt smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();
            app.settings.devMode = true;
            applyReducedUiClass();
            openStateModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                !$("addFutureCharacterBtn") &&
                    !/Add Future Character/i.test($("modalBox")?.textContent || ""),
                "runtime state editor does not expose future-cast authoring controls",
            );
            devAssert(
                !devFieldWithPathPrefix("#friendlyStateEditor", ["future_cast"]) &&
                    !devFieldWithPathPrefix("#friendlyStateEditor", ["objectives"]) &&
                    !devFieldWithPathPrefix("#friendlyStateEditor", ["meta"]),
                "runtime state editor hides future cast, objectives, and metadata roots",
                { text: ($("modalBox")?.textContent || "").slice(0, 1000) },
            );
            closeModal();
            addMessage("system", "Future cast visibility smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: future-character-prompt-smoke");
        }

        async function devRunRenderFocusPreservationSmokeTest() {
            devTestLog("Scenario start: render-focus-preservation-smoke");
            devResetForLiveTest("render-focus-preservation-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic render/focus state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Render Focus Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Focus Tester",
                    age: 24,
                    gender: "male",
                    role: "tester",
                },
                objectives: {
                    active_id: "render-focus-objective",
                    items: [
                        {
                            id: "render-focus-objective",
                            title: "Verify Render Focus",
                            type: "story",
                            status: "active",
                            summary: "Smoke test render focus preservation.",
                            objective: "Keep input focus through render.",
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
                    text: "Render focus preservation smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();
            const composer = $("input");
            devAssert(!!composer, "composer input exists");
            composer.value = "select this text and keep focus";
            composer.focus();
            composer.setSelectionRange(7, 16);
            render();
            const afterComposer = $("input");
            devAssert(
                document.activeElement === afterComposer,
                "render preserves composer focus",
                {
                    activeId: document.activeElement?.id || "",
                },
            );
            devAssert(
                afterComposer.selectionStart === 7 &&
                    afterComposer.selectionEnd === 16,
                "render preserves composer text selection",
                {
                    start: afterComposer.selectionStart,
                    end: afterComposer.selectionEnd,
                },
            );

            openSettingsModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const historyLimit = $("imageHistoryLimit");
            devAssert(!!historyLimit, "settings input exists for focus test");
            historyLimit.focus();
            render();
            const afterHistoryLimit = $("imageHistoryLimit");
            devAssert(
                document.activeElement === afterHistoryLimit,
                "render preserves modal input focus",
                {
                    activeId: document.activeElement?.id || "",
                },
            );
            closeModal();
            addMessage("system", "Render focus preservation smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: render-focus-preservation-smoke");
        }

