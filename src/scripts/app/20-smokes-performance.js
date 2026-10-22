
        async function devRunTargetedRefreshRedrawSmokeTest() {
            devTestLog("Scenario start: targeted-refresh-redraw-smoke");
            devResetForLiveTest("targeted-refresh-redraw-smoke");
            devCreateTestProfile({  });
            const smokeImageUrl = devSmokeOnePixelDataUrl();
            const smokeImageHtml = `<img src="${smokeImageUrl}" alt="Smoke image">`;
            const waitForRegionRender = async () => {
                await app.work.flushUi();
            };
            const resetStats = () => {
                app.devRenderStats = null;
                app.pendingRenderRegions = {};
                ensureRenderStats();
            };
            const statsNow = () => clone(ensureRenderStats());
            const assertNoFullRender = (label) => {
                const stats = statsNow();
                devAssert(stats.fullRenderCount === 0, label, stats);
                return stats;
            };
            const originalQueueOneOffCharacterImage = queueOneOffCharacterImage;

            const originalQueueProfileImageIfMissing = queueProfileImageIfMissing;
            const originalCleanupRemovedCharacterReferences = cleanupRemovedCharacterReferences;
            const originalRunImmediateChecksForMutatedMessage = runImmediateChecksForMutatedMessage;
            const originalRunImmediateChecksForMutatedRange = runImmediateChecksForMutatedRange;
            const originalGenerateReply = generateReply;
            const originalAfterReplyEffects = afterReplyEffects;
            queueOneOffCharacterImage = () => {};

            queueProfileImageIfMissing = () => false;
            cleanupRemovedCharacterReferences = () => {};
            runImmediateChecksForMutatedMessage = async () => {};
            runImmediateChecksForMutatedRange = async () => {};
            generateReply = async () => "Regenerated targeted redraw smoke reply.";
            afterReplyEffects = async () => {};
            try {
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    default_image_model: "cinematic",
                    story_source: {
                        mode: "original",
                        title: "Targeted Refresh Smoke",
                    },
                },
                player: {
                    ...devSmokeRuntimeCharacter("Card Tester", {
                        gender: "non-male",
                        role: "card refresh tester",
                    }),
                    name: "Refresh Tester",
                    age: 28,
                    gender: "female",
                    role: "redraw tester",
                },
                characters: {
                    "Redraw Ally": {
                        ...blankCharacterTemplate("Redraw Ally"),
                        id: "redraw-ally",
                        name: "Redraw Ally",
                        age: 27,
                        gender: "female",
                        role: "surface tester",
                        clothing: {
                            ...blankClothingTemplate(),
                            shirt: "blue shirt",
                            pants: "black pants",
                        },
                        outfits: [
                            {
                                id: "default",
                                name: "Default Outfit",
                                clothing: {
                                    ...blankClothingTemplate(),
                                    shirt: "blue shirt",
                                    pants: "black pants",
                                },
                            },
                            {
                                id: "formal",
                                name: "Formal Outfit",
                                clothing: {
                                    ...blankClothingTemplate(),
                                    shirt: "white formal shirt",
                                    pants: "black formal pants",
                                },
                            },
                        ],
                        active_outfit_id: "default",
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Redraw Ally"],
                    image_characters: ["Redraw Ally"],
                },
            });
            devAssert(
                currentStoryDefaultImageModel(app.state) === "cinematic" &&
                    activeNormalImageModel(app.state) === "cinematic" &&
                    !useFantasyRpgLocalImageStyle(),
                "story default image style overrides global normal-image style",
                {
                    default_image_model: app.state.meta.default_image_model,
                    active: activeNormalImageModel(app.state),
                    global: app.settings.imageModel,
                },
            );
            const generatedStyleProbe = finalizeGeneratedCharacterFromAiPayload(
                {
                    name: "Style Probe",
                    character: {
                        name: "Style Probe",
                        gender: "female",
                        age: 28,
                        role: "test character",
                        personality_description: "A test adult character.",
                        speech_style: "Plain.",
                        relationship_to_player: "neutral",
                        appearance: {
                            species: "human",
                            skin_color: "warm brown",
                            eye_color: "green",
                            hair_color: "black",
                        },
                        clothing: { shirt: "gray shirt", pants: "black pants" },
                    },
                },
                "Style Probe",
            );
            devAssert(
                generatedStyleProbe.image_prompt_config?.style === "cinematic" &&
                    generatedStyleProbe.image?.style === "cinematic" &&
                    textSlot(generatedStyleProbe.fallback_name, "") &&
                    exactOutfitList(generatedStyleProbe.fallback_outfits || []).length &&
                    textSlot(generatedStyleProbe.fallback_starting_outfit_id, ""),
                "AI-generated characters inherit the active story image style and synthesize required gender fallback data when omitted",
                generatedStyleProbe,
            );
            const normalizedStyleStory = devSmokeStoryRecord({
                id: "style-story-smoke",
                title: "Style Story Smoke",
                default_image_model: "cinematic",
            });
            const exportedStyleStory = storyDefinitionForExport(
                normalizedStyleStory,
            );
            devAssert(
                normalizedStyleStory.default_image_model === "cinematic" &&
                    normalizedStyleStory.state.meta.default_image_model ===
                        "cinematic" &&
                    exportedStyleStory.default_image_model === "cinematic" &&
                    exportedStyleStory.state.meta.default_image_model ===
                        "cinematic",
                "story default image style survives normalize/export",
                { normalizedStyleStory, exportedStyleStory },
            );
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Initial redraw smoke message.",
                    at: new Date().toISOString(),
                },
            ];
            app.images = [];
            app.state.npc_directory = {
                locations: {
                    "Redraw Town": {
                        characters: {
                            "Redraw NPC": {
                                id: "redraw-npc",
                                name: "Redraw NPC",
                                age: 31,
                                gender: "male",
                                role: "scene refresh tester",
                                relationship: "known",
                                note: "Used by targeted redraw smoke.",
                                inspected: false,
                                status: "alive",
                            },
                        },
                    },
                },
            };
            scheduleActiveGameSave();
            render("allowed: targeted refresh smoke setup");
            await waitForRegionRender();

            resetStats();
            const messageId = app.messages[0].id;
            updateMessage(messageId, "Updated redraw smoke message.", {
                reason: "targeted redraw smoke message update",
            });
            await waitForRegionRender();
            let stats = ensureRenderStats();
            devAssert(
                stats.fullRenderCount === 0 && stats.threadRenderCount >= 1,
                "message update refreshes thread without full app redraw",
                stats,
            );

            const record = rememberImage({
                id: "targeted-refresh-image",
                title: "Redraw Ally",
                reason: "targeted refresh smoke",
                model: selectedImageModel(),
                seed: 123,
                prompt: "redraw ally portrait",
                negativePrompt: "text",
                html: smokeImageHtml,
                pending: false,
                targets: ["Redraw Ally"],
                requestedAt: new Date().toISOString(),
                requestedAfterMessageId: String(messageId),
            });
            await waitForRegionRender();
            stats = statsNow();
            devAssert(
                stats.fullRenderCount === 0 &&
                    stats.threadRenderCount >= 1 &&
                    stats.imagePanelRenderCount >= 1 &&
                !!document.querySelector(
                    `.image-card[data-image-id="${cssEscape(imageDomId(record.id))}"]`,
                ),
                "remembered image appears through structural thread/image-panel refresh without full app redraw",
                stats,
            );

            resetStats();
            toggleImageFavorite(record.id);
            await waitForRegionRender();
            stats = ensureRenderStats();
            devAssert(
                stats.fullRenderCount === 0 &&
                    stats.threadRenderCount === 0 &&
                    stats.imagePanelRenderCount === 0 &&
                    (app.images || []).find((image) => String(image.id) === String(record.id))?.favorite === true &&
                    [...document.querySelectorAll(
                        `.image-card[data-image-id="${cssEscape(imageDomId(record.id))}"] .image-favorite-button`,
                    )].every((button) => button.classList.contains("speak-on")),
                "single image favorite updates existing image cards without broad redraw",
                stats,
            );

            resetStats();
            updateStoredImageHtml(record.id, `<img src="${smokeImageUrl}" alt="Updated smoke image">`, {
                pending: false,
                error: "",
            });
            await waitForRegionRender();
            stats = statsNow();
            const finalizedRecord = (app.images || []).find(
                (image) => String(image.id) === String(record.id),
            );
            devAssert(
                stats.fullRenderCount === 0 &&
                    stats.threadRenderCount === 0 &&
                    stats.imagePanelRenderCount === 0 &&
                    finalizedRecord &&
                    finalizedRecord.pending === false &&
                    !finalizedRecord.error &&
                    [...document.querySelectorAll(
                        `.image-card[data-image-id="${cssEscape(imageDomId(record.id))}"] img`,
                    )].length > 0,
                "normal image finalization updates existing image cards without broad redraw",
                stats,
            );

            resetStats();
            const localImageHtml = record.html;
            applyHostedImageMetadata(record, {
                url: "https://example.com/targeted-refresh-redraw-smoke.png",
                size: 12,
            });
            refreshImageRecordSurfaces(record.id, {
                reason: "targeted redraw smoke hosted metadata",
            });
            await waitForRegionRender();
            stats = assertNoFullRender("hosted image metadata refresh avoids full app redraw");
            devAssert(
                stats.threadRenderCount === 0 &&
                    stats.imagePanelRenderCount === 0 &&
                    record.html === localImageHtml &&
                    record.hosted_url ===
                        "https://example.com/targeted-refresh-redraw-smoke.png",
                "hosted image metadata preserves the local render source without rebuilding image surfaces",
                { stats, localImageHtml, record },
            );

            const originalShowConfirm = showConfirm;
            try {
                showConfirm = async () => true;
                resetStats();
                await deleteImageRecord(record.id);
                await waitForRegionRender();
                stats = statsNow();
                devAssert(
                    stats.fullRenderCount === 0 &&
                        stats.threadRenderCount >= 1 &&
                        stats.imagePanelRenderCount >= 1 &&
                        !(app.images || []).some((image) => String(image.id) === String(record.id)) &&
                        !document.querySelector(
                            `.image-card[data-image-id="${cssEscape(imageDomId(record.id))}"]`,
                        ),
                    "normal image delete removes image surfaces with structural thread/image-panel refresh but no full app redraw",
                    stats,
                );
            } finally {
                showConfirm = originalShowConfirm;
            }

            const pendingRecord = rememberImage({
                id: "targeted-refresh-pending-image",
                title: "Pending Redraw Ally",
                reason: "targeted refresh pending smoke",
                model: selectedImageModel(),
                seed: 456,
                prompt: "pending redraw ally portrait",
                negativePrompt: "text",
                html: imageLoadingHtml("Pending smoke image"),
                pending: true,
                targets: ["Redraw Ally"],
                requestedAt: new Date().toISOString(),
                requestedAfterMessageId: String(messageId),
            });
            await waitForRegionRender();
            resetStats();
            updateStoredImageHtml(pendingRecord.id, smokeImageHtml, {
                pending: false,
                error: "",
            });
            await waitForRegionRender();
            stats = statsNow();
            devAssert(
                stats.fullRenderCount === 0 &&
                    stats.threadRenderCount === 0 &&
                    stats.imagePanelRenderCount === 0 &&
                    [...document.querySelectorAll(
                        `.image-card[data-image-id="${cssEscape(imageDomId(pendingRecord.id))}"] img`,
                    )].length > 0,
                "pending image completion replaces only existing image surfaces without broad redraw",
                stats,
            );

            resetStats();

            await waitForRegionRender();
            stats = assertNoFullRender("single character clothing action avoids full app redraw");
            devAssert(
                !clothingItemText(app.state.characters["Redraw Ally"]?.clothing?.shirt),
                "single character clothing action updates runtime clothing state",
                app.state.characters["Redraw Ally"]?.clothing,
            );

            resetStats();

            await waitForRegionRender();
            stats = assertNoFullRender("single character dress action avoids full app redraw");
            devAssert(
                clothingItemText(app.state.characters["Redraw Ally"]?.clothing?.shirt) === "blue shirt",
                "single character dress action restores runtime clothing state",
                app.state.characters["Redraw Ally"]?.clothing,
            );

            resetStats();
            selectCharacterOutfit("Redraw Ally", "formal");
            await waitForRegionRender();
            stats = assertNoFullRender("outfit selection avoids full app redraw");
            devAssert(
                clothingItemText(app.state.characters["Redraw Ally"]?.clothing?.shirt) === "white formal shirt" &&
                    app.state.characters["Redraw Ally"]?.active_outfit_id === "formal",
                "outfit selection updates visible character state",
                app.state.characters["Redraw Ally"],
            );

            resetStats();
            const saveOutfitPromise = saveCharacterCurrentOutfit("Redraw Ally");
            await devWaitFor(
                () => document.querySelector(".popup-modal.open #styledPromptInput"),
                2000,
                "styled save outfit prompt to open",
            );
            const saveOutfitInput = document.querySelector(
                ".popup-modal.open #styledPromptInput",
            );
            devAssert(
                saveOutfitInput &&
                    /Save current clothing as outfit/i.test(
                        document.querySelector(".popup-modal.open")?.textContent || "",
                    ),
                "save outfit uses EmberAdventures styled prompt instead of browser prompt",
                { popupText: document.querySelector(".popup-modal.open")?.textContent || "" },
            );
            saveOutfitInput.value = "Saved Smoke Outfit";
            document.querySelector(".popup-modal.open #promptSubmitBtn")?.click();
            await saveOutfitPromise;
            await waitForRegionRender();
            stats = assertNoFullRender("outfit save avoids full app redraw");
            devAssert(
                exactOutfitList(app.state.characters["Redraw Ally"]?.outfits || []).some(
                    (outfit) => outfit.name === "Saved Smoke Outfit",
                ),
                "outfit save updates character outfit list",
                app.state.characters["Redraw Ally"]?.outfits,
            );


            app.state.characters["Redraw Ally"].clothing = {
                ...blankClothingTemplate(),
                pants: "temporary pants",
            };
            resetStats();

            await waitForRegionRender();
            stats = assertNoFullRender("outfit selection avoids full app redraw");

            resetStats();
            queueProfileImageIfMissing = originalQueueProfileImageIfMissing;
            addNpcToScene("Redraw NPC");
            await waitForRegionRender();
            stats = assertNoFullRender("NPC add-to-scene avoids full app redraw");
            await devWaitFor(
                () => {
                    const image = activeProfileImage(getNpcEntry("Redraw NPC"));
                    return (
                        image?.pending === false &&
                        !image?.error &&
                        devLooksLikeRealImageHtml(image?.html)
                    );
                },
                5000,
                "Add NPC to Scene production action to finish its profile image",
            );
            const redrawNpcProfile = activeProfileImage(getNpcEntry("Redraw NPC"));
            devAssert(
                (app.state.scene?.npcs_present || []).includes("Redraw NPC") &&
                    redrawNpcProfile?.pending === false &&
                    !redrawNpcProfile?.error &&
                    devLooksLikeRealImageHtml(redrawNpcProfile?.html),
                "NPC add-to-scene updates scene presence and finishes its missing profile image",
                { scene: app.state.scene, redrawNpcProfile },
            );
            queueProfileImageIfMissing = () => false;

            resetStats();
            removeNpcFromScene("Redraw NPC");
            await waitForRegionRender();
            stats = assertNoFullRender("NPC remove-from-scene avoids full app redraw");
            devAssert(
                !(app.state.scene?.npcs_present || []).includes("Redraw NPC"),
                "NPC remove-from-scene updates scene presence",
                app.state.scene?.npcs_present,
            );

            {
                const originalShowPrompt = showPrompt;
                try {
                    showPrompt = async () => "Edited targeted redraw smoke reply.";
                    const editMessageId = nextEntryId();
                    app.messages = [
                        {
                            id: editMessageId,
                            entryId: editMessageId,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Assistant message before edit.",
                            at: new Date().toISOString(),
                            stateSyncStatus: "pending",
                        },
                    ];
                    renderThread("targeted redraw smoke message edit setup");
                    resetStats();
                    await editMessage(editMessageId);
                    await waitForRegionRender();
                    stats = statsNow();
                    devAssert(
                        stats.fullRenderCount === 0 &&
                            stats.threadRenderCount >= 1 &&
                            findMessageById(editMessageId)?.text ===
                                "Edited targeted redraw smoke reply.",
                        "assistant message edit uses targeted runtime refresh without full app redraw",
                        stats,
                    );
                } finally {
                    showPrompt = originalShowPrompt;
                }
            }

            {
                const originalShowConfirm = showConfirm;
                try {
                    showConfirm = async () => true;
                    const deleteMessageId = nextEntryId();
                    app.messages = [
                        {
                            id: deleteMessageId,
                            entryId: deleteMessageId,
                            role: "assistant",
                            speaker: "Narrator",
                            text: "Assistant message before delete.",
                            at: new Date().toISOString(),
                            stateSyncStatus: "pending",
                        },
                    ];
                    renderThread("targeted redraw smoke message delete setup");
                    resetStats();
                    await deleteMessage(deleteMessageId);
                    await waitForRegionRender();
                    stats = statsNow();
                    devAssert(
                        stats.fullRenderCount === 0 &&
                            stats.threadRenderCount >= 1 &&
                            !findMessageById(deleteMessageId),
                        "assistant message delete uses targeted runtime refresh without full app redraw",
                        stats,
                    );
                } finally {
                    showConfirm = originalShowConfirm;
                }
            }

            {
                const regenerateMessageId = nextEntryId();
                app.messages = [
                    {
                        id: regenerateMessageId,
                        entryId: regenerateMessageId,
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Assistant message before regenerate.",
                        at: new Date().toISOString(),
                        stateSyncStatus: "pending",
                    },
                ];
                renderThread("targeted redraw smoke message regenerate setup");
                resetStats();
                await regenerateAssistantMessage(regenerateMessageId, "try again", {
                    reason: "targeted redraw smoke regenerate",
                });
                await waitForRegionRender();
                stats = statsNow();
                devAssert(
                    stats.fullRenderCount === 0 &&
                        stats.threadRenderCount >= 1 &&
                        findMessageById(regenerateMessageId)?.text ===
                            "Regenerated targeted redraw smoke reply.",
                    "assistant message regenerate uses targeted runtime refresh without full app redraw",
                    stats,
                );
            }

            resetStats();
            requestRenderRegions(
                {
                    hud: true,
                    objective: true,
                    imagePanel: true,
                    thread: true,
                },
                "targeted redraw smoke combined regions",
            );
            requestRenderRegions(
                {
                    hud: true,
                    imagePanel: true,
                },
                "targeted redraw smoke combined regions repeat",
            );
            await waitForRegionRender();
            stats = statsNow();


            resetStats();
            await waitForRegionRender();
            stats = ensureRenderStats();


            app.activeVoiceMessageId = app.messages[0].id;

            app.activeImageRequests.add("targeted-refresh-runtime-marker");
            resetStats();
            render("allowed: targeted refresh smoke full render case");
            stats = statsNow();
            devAssert(
                stats.fullRenderCount === 1 && stats.broadDuringRuntimeCount === 0,
                "allowed full render reason does not produce broad-render warning during active runtime work",
                stats,
            );
            app.activeVoiceMessageId = null;

            app.activeImageRequests.delete("targeted-refresh-runtime-marker");

            devTestLog("Scenario complete: targeted-refresh-redraw-smoke");
            } finally {
                queueOneOffCharacterImage = originalQueueOneOffCharacterImage;

                queueProfileImageIfMissing = originalQueueProfileImageIfMissing;
                cleanupRemovedCharacterReferences = originalCleanupRemovedCharacterReferences;
                runImmediateChecksForMutatedMessage =
                    originalRunImmediateChecksForMutatedMessage;
                runImmediateChecksForMutatedRange =
                    originalRunImmediateChecksForMutatedRange;
                generateReply = originalGenerateReply;
                afterReplyEffects = originalAfterReplyEffects;
                app.activeVoiceMessageId = null;

                app.activeImageRequests.delete("targeted-refresh-runtime-marker");
            }
        }

        async function devRunCharacterImportExportSmokeTest() {
            devTestLog("Scenario start: character-import-export-smoke");
            devResetForLiveTest("character-import-export-smoke");
            devCreateTestProfile({  });
            const computerFixture = new File(["{}"], "computer-character.json", {
                type: "application/json",
            });
            const driveFixture = new File(["{}"], "drive-character.json", {
                type: "application/json",
            });
            const githubFixture = new File(["{}"], "github-character.json", {
                type: "application/json",
            });
            const computerSelection = await chooseImportFiles({
                source: "computer",
                multiple: true,
                computerPicker: () => [computerFixture],
            });
            const driveSelection = await chooseImportFiles({
                source: "google-drive",
                multiple: true,
                googleDrivePicker: () => [driveFixture],
            });
            const githubSelection = await chooseImportFiles({
                source: "github",
                multiple: true,
                githubPicker: () => [githubFixture],
            });
            devAssert(
                computerSelection[0]?.name === "computer-character.json" &&
                    driveSelection[0]?.name === "drive-character.json" &&
                    githubSelection[0]?.name === "github-character.json",
                "shared import source routing returns computer, Google Drive, and GitHub files through one contract",
                {
                    computer: computerSelection.map((file) => file.name),
                    drive: driveSelection.map((file) => file.name),
                    github: githubSelection.map((file) => file.name),
                },
            );
            const originalShowGithubImportPrompt = showGithubImportPrompt;
            const originalDownloadGithubImportFile = downloadGithubImportFile;
            let finishGithubDownload = null;
            try {
                showGithubImportPrompt = async () => ({
                    urls: "https://github.com/smoke/imports/blob/main/large-story.json",
                    token: "",
                    saveToken: false,
                    folderOwner: "smoke",
                });
                downloadGithubImportFile = async () =>
                    new Promise((resolve) => {
                        finishGithubDownload = () =>
                            resolve(
                                new File(["{}"], "large-story.json", {
                                    type: "application/json",
                                }),
                            );
                    });
                const pendingGithubImport = chooseGithubImportFiles();
                await devWaitFor(
                    () =>
                        /Downloading/i.test(
                            document.getElementById("emberAdventuresActivityIndicator")?.textContent || "",
                        ),
                    1000,
                    "GitHub import activity indicator",
                );
                devAssert(
                    typeof finishGithubDownload === "function",
                    "GitHub import shows a download indicator before its file request completes",
                );
                finishGithubDownload();
                const downloadedGithubFiles = await pendingGithubImport;
                await devWaitFor(
                    () => !document.getElementById("emberAdventuresActivityIndicator"),
                    1000,
                    "GitHub import activity indicator cleanup",
                );
                devAssert(
                    downloadedGithubFiles[0]?.name === "large-story.json",
                    "GitHub import activity indicator clears after download completion",
                    downloadedGithubFiles.map((file) => file.name),
                );
            } finally {
                showGithubImportPrompt = originalShowGithubImportPrompt;
                downloadGithubImportFile = originalDownloadGithubImportFile;
            }
            const originalDownloadImportFileInWorker = downloadImportFileInWorker;
            try {
                const workerDownloadRequests = [];
                downloadImportFileInWorker = async (source, item) => {
                    workerDownloadRequests.push({ source, item });
                    return new File(
                        [JSON.stringify({ source, worker: true })],
                        source === "github" ? "large.json" : "drive.json",
                        { type: "application/json" },
                    );
                };
                const largeGithubFile = await downloadGithubImportFile(
                    "https://github.com/smoke/private/blob/main/stories/large.json",
                    "smoke-token",
                );
                const driveWorkerFile = await downloadGoogleDriveImportFile(
                    {
                        id: "smoke-drive-file",
                        name: "drive.json",
                        mimeType: "application/json",
                    },
                    "smoke-drive-token",
                );
                devAssert(
                    workerDownloadRequests.length === 2 &&
                        workerDownloadRequests[0]?.source === "github" &&
                        workerDownloadRequests[0]?.item?.token === "smoke-token" &&
                        workerDownloadRequests[1]?.source === "google-drive" &&
                        workerDownloadRequests[1]?.item?.token === "smoke-drive-token" &&
                        largeGithubFile.name === "large.json" &&
                        driveWorkerFile.name === "drive.json" &&
                        JSON.parse(await largeGithubFile.text()).worker === true,
                    "GitHub and Google Drive import downloads route through the import worker bridge",
                    { workerDownloadRequests, fileName: largeGithubFile.name },
                );
            } finally {
                downloadImportFileInWorker = originalDownloadImportFileInWorker;
            }
            const githubImportWorkerSource = storyImportWorkerSource();
            devAssert(
                githubImportWorkerSource.includes(
                    'Accept: "application/vnd.github.raw+json"',
                ) &&
                    githubImportWorkerSource.includes("await response.arrayBuffer()"),
                "authenticated large GitHub imports use the raw Contents response without a Git-blob request or base64 decode",
                {
                    usesRawContents: githubImportWorkerSource.includes(
                        'Accept: "application/vnd.github.raw+json"',
                    ),
                    usesArrayBuffer: githubImportWorkerSource.includes(
                        "await response.arrayBuffer()",
                    ),
                },
            );
            const publicGithubDiagnostic = importDownloadNetworkDiagnostic("github", {
                url: "https://github.com/andro951/ember-adventures-stories/blob/main/stories/The%20Inspector.json",
                token: "",
            });
            const privateGithubDiagnostic = importDownloadNetworkDiagnostic("github", {
                url: "https://github.com/smoke/private/blob/main/stories/large.json",
                token: "smoke-secret-token",
            });
            devAssert(
                publicGithubDiagnostic?.mode === "public raw download" &&
                    publicGithubDiagnostic?.endpointUrl ===
                        "https://raw.githubusercontent.com/andro951/ember-adventures-stories/main/stories/The%20Inspector.json" &&
                    privateGithubDiagnostic?.mode ===
                        "authenticated contents API download" &&
                    privateGithubDiagnostic?.endpointUrl ===
                        "https://api.github.com/repos/smoke/private/contents/stories/large.json?ref=main" &&
                    privateGithubDiagnostic?.tokenPresent === true &&
                    !JSON.stringify(privateGithubDiagnostic).includes("smoke-secret-token") &&
                    githubImportWorkerSource.includes(
                        "GitHub network request failed before an HTTP response was received.",
                    ) &&
                    githubImportWorkerSource.includes("Worker online:"),
                "GitHub pre-response fetch failures record resolved endpoint diagnostics without exposing the token",
                {
                    publicGithubDiagnostic,
                    privateGithubDiagnostic,
                    workerFailureEnriched: githubImportWorkerSource.includes(
                        "GitHub network request failed before an HTTP response was received.",
                    ),
                },
            );
            const previousGithubFolderHistory = localStorage.getItem(
                GITHUB_IMPORT_FOLDER_HISTORY_KEY,
            );
            const originalListGithubDirectoryEntries = listGithubDirectoryEntries;
            try {
                localStorage.removeItem(GITHUB_IMPORT_FOLDER_HISTORY_KEY);
                listGithubDirectoryEntries = async (reference) => [
                    {
                        name: "remembered-folder-smoke.json",
                        path: `${reference.path ? `${reference.path}/` : ""}remembered-folder-smoke.json`,
                        type: "file",
                        url: githubFileUrlFromReference({
                            ...reference,
                            path: `${reference.path ? `${reference.path}/` : ""}remembered-folder-smoke.json`,
                        }),
                    },
                ];
                const githubPrompt = showGithubImportPrompt();
                await devWaitFor(
                    () => !!document.querySelector("#githubImportFolder"),
                    3000,
                    "GitHub import prompt to open",
                );
                const folderInput = document.querySelector("#githubImportFolder");
                folderInput.value =
                    "https://github.com/andro951/ember-adventures-stories/tree/main/stories/remembered-folder-smoke/";
                document.querySelector("#githubImportLoadFolderBtn")?.click();
                await devWaitFor(
                    () =>
                        githubImportFolderHistory().some(
                            (record) =>
                                record.owner === "andro951" &&
                                record.repo === "ember-adventures-stories" &&
                                /remembered-folder-smoke/i.test(record.url),
                        ),
                    3000,
                    "successful GitHub folder load to save remembered folder",
                );
                devAssert(
                    [...document.querySelectorAll("#githubImportSavedFolder option")]
                        .some((option) =>
                            /remembered-folder-smoke/i.test(
                                option.textContent || option.value || "",
                            ),
                        ),
                    "GitHub folder import saves successful loaded folders and refreshes the saved-folder dropdown immediately",
                    { history: githubImportFolderHistory() },
                );
                const githubFolderFileOptions = [
                    ...document.querySelectorAll("[data-github-file-index]"),
                ];
                devAssert(
                    githubFolderFileOptions.length === 1 &&
                        githubFolderFileOptions.every((input) => !input.checked),
                    "GitHub folder import file options are unchecked by default",
                    {
                        checked: githubFolderFileOptions.map((input) => input.checked),
                    },
                );
                document.querySelector("#githubImportCancelBtn")?.click();
                await githubPrompt;
            } finally {
                listGithubDirectoryEntries = originalListGithubDirectoryEntries;
                if (previousGithubFolderHistory == null)
                    localStorage.removeItem(GITHUB_IMPORT_FOLDER_HISTORY_KEY);
                else
                    localStorage.setItem(
                        GITHUB_IMPORT_FOLDER_HISTORY_KEY,
                        previousGithubFolderHistory,
                    );
            }
            // SANITIZE KEEP (dev fixture): synthetic character import/export state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Character Import Export Smoke",
                    },
                },
                player: devSmokeRuntimeCharacter("Export Player", {
                    age: 30,
                    gender: "male",
                    role: "export tester",
                }),
                characters: {
                    "Export Ally": devSmokeRuntimeCharacter("Export Ally", {
                        age: 31,
                        gender: "non-male",
                        role: "export ally",
                        relationship_to_player: "trusted ally",
                    }),
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "smoke-town",
                    specific_place: "Smoke Town",
                },
                npc_directory: {
                    locations: {
                        "smoke-town": {
                            label: "Smoke Town",
                            characters: {
                                "Export Local": {
                                    name: "Export Local",
                                    gender: "male",
                                    age: 44,
                                    role: "watch captain",
                                    relationship: "neutral",
                                    note: "Known export NPC.",
                                    inspected: true,
                                    full_character: devSmokeRuntimeCharacter(
                                        "Export Local",
                                        {
                                        age: 44,
                                        gender: "male",
                                        role: "watch captain",
                                        relationship_to_player: "neutral",
                                        },
                                    ),
                                },
                            },
                        },
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Player", "Export Ally"],
                    image_characters: ["Player", "Export Ally"],
                    npcs_present: ["Export Local"],
                },
                objectives: {
                    active_id: "character-import-export-objective",
                    items: [
                        {
                            id: "character-import-export-objective",
                            title: "Verify Character Import Export",
                            type: "story",
                            status: "active",
                            summary: "Smoke test character import/export.",
                            objective: "Export and import character records.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            Object.assign(app.state.player, {
                trust: 0,
                attraction: 0,
                affection: 0,
                starting_trust: 0,
                starting_attraction: 0,
                starting_affection: 0,
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Character import/export smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            app.__emberAdventuresLastJsonDownload = null;
            scheduleActiveGameSave();
            render();

            exportPlayerCharacter();
            const exportedPlayerPayload = app.__emberAdventuresLastJsonDownload?.payload;
            const exportedPlayerDefinition =
                exportedPlayerPayload?.character_definition || exportedPlayerPayload;
            devAssert(
                exportedPlayerDefinition?.name === "Export Player",
                "player export emits clean character_definition record",
                app.__emberAdventuresLastJsonDownload,
            );
            const brotliPayload = await compressBlobWithFormat(
                new Blob([JSON.stringify(exportedPlayerPayload)], {
                    type: "application/json",
                }),
                "brotli",
            );
            const brotliImport = new File(
                [brotliPayload],
                "computer-character.json.br",
                { type: "application/br" },
            );
            const brotliRecords = await prepareCharacterImportRecordsInWorker(
                [brotliImport],
                {},
                "Importing Brotli smoke fixture",
            );
            const compressedGoogleMimeTypes = googleDriveMimeTypesForImport({
                accept: COMPRESSED_JSON_IMPORT_ACCEPT,
            });
            devAssert(
                    brotliRecords.length === 1 &&
                    brotliRecords[0]?.character_definition?.name === "Export Player" &&
                    compressedJsonFileName("The Inspector.json.br") &&
                    compressedJsonFileName("The Inspector.json.deflate-raw") &&
                    compressedGoogleMimeTypes.includes("application/br") &&
                    storyImportWorkerSource().includes(
                        'compressedJsonFileName(entry?.name)',
                    ),
                "Brotli JSON is actually decompressed by the import worker and compressed JSON is exposed by both cloud browsers",
                {
                    importedName: brotliRecords[0]?.character_definition?.name || "",
                    compressedGoogleMimeTypes,
                },
            );
            exportCharacter("Export Ally");
            const exportedPartyDefinition =
                app.__emberAdventuresLastJsonDownload?.payload?.character_definition ||
                app.__emberAdventuresLastJsonDownload?.payload;
            devAssert(
                exportedPartyDefinition?.role === "export ally",
                "party character export emits clean character_definition record",
                app.__emberAdventuresLastJsonDownload,
            );
            exportNpc("Export Local", "smoke-town");
            const exportedNpcPayload = app.__emberAdventuresLastJsonDownload?.payload;
            const exportedNpcDefinition =
                exportedNpcPayload?.character_definition ||
                exportedNpcPayload;
            devAssert(
                exportedNpcDefinition?.role === "watch captain",
                "NPC export emits clean character_definition",
                app.__emberAdventuresLastJsonDownload,
            );
            const exportedNpcRecords = characterImportRecordsFromExport(exportedNpcPayload);
            devAssert(
                exportedNpcRecords[0]?.character_definition?.role === "watch captain",
                "exported NPC character_definition imports intact",
                exportedNpcRecords[0],
            );

            const records = characterImportRecordsFromExport({
                characters: [
                    {
                        character_definition: {
                            ...devSmokeCharacterRecord("Imported Player", {
                                character: { gender: "non-male" },
                            }).character,
                            name: "Imported Player",
                            age: 27,
                            gender: "non-male",
                            role: "imported player",
                        },
                    },
                    {
                        character_definition: {
                            ...devSmokeCharacterRecord("Imported Local", {
                                character: { gender: "male" },
                            }).character,
                            name: "Imported Local",
                            age: 39,
                            gender: "male",
                            role: "imported guide",
                        },
                    },
                    ...[
                        "Imported Ally 1",
                        "Lena Stone",
                        "Mara Stone",
                        "Nia Stone",
                        "Ona Stone",
                        "Rhea Stone",
                        "Tara Stone",
                        "Vera Stone",
                        "Willa Stone",
                        "Zara Stone",
                    ].map((name, index) => ({
                        character_definition: {
                            ...devSmokeCharacterRecord(name, {
                                character: {
                                    gender: index % 2 ? "male" : "non-male",
                                },
                            }).character,
                            name,
                            age: 22 + index,
                            gender: index % 2 ? "male" : "non-male",
                            role: `imported smoke character ${index + 1}`,
                        },
                    })),
                ],
            });
            devAssert(records.length === 12, "normalizer reads character envelope", {
                count: records.length,
            });
            await devImportCharacterRecords([records[0]], {
                playerOnly: true,
                playerWarningAccepted: true,
            });
            await devImportCharacterRecords(records.slice(1), {
                playerWarningAccepted: true,
            });
            await new Promise((resolve) => setTimeout(resolve, 250));
            setLeftPanelGroup("characters");
            devAssert(
                app.state.player?.name === "Imported Player" &&
                    app.state.characters?.["Imported Ally 1"]?.role ===
                        "imported smoke character 1" &&
                    app.state.characters?.["Imported Local"]?.role ===
                        "imported guide",
                "importCharacterRecords applies exact player and party character definitions",
                {
                    player: app.state.player,
                    ally: app.state.characters?.["Imported Ally 1"],
                    importedLocal: app.state.characters?.["Imported Local"],
                },
            );
            devAssert(
                !app.profileImageQueue?.length &&
                    !app.profileImageQueued?.size &&
                    !app.profileImageGenerating?.size,
                "large character import skips automatic profile generation",
                {
                    queue: app.profileImageQueue?.length,
                    queued: app.profileImageQueued?.size,
                    generating: app.profileImageGenerating?.size,
                },
            );
            devAssert(
                /Imported Ally 1/i.test($("characterList")?.textContent || ""),
                "large character import refreshes visible character list without profile generation",
                $("characterList")?.textContent || "",
            );
            const gameImportCountBeforePartialDuplicate = Object.keys(app.state.characters || {}).length;
            await devImportCharacterRecords(
                [
                    {
                        character_definition: {
                            ...devSmokeCharacterRecord("Imported Ally 1").character,
                            name: "Imported Ally 1",
                            age: 30,
                            gender: "female",
                            role: "duplicate active-game batch import",
                        },
                    },
                    {
                        character_definition: {
                            ...devSmokeCharacterRecord("Imported Ally Fresh").character,
                            name: "Imported Ally Fresh",
                            age: 30,
                            gender: "female",
                            role: "fresh active-game batch import",
                        },
                    },
                ],
                { playerWarningAccepted: true },
            );
            devAssert(
                Object.keys(app.state.characters || {}).length ===
                    gameImportCountBeforePartialDuplicate + 1 &&
                    app.state.characters?.["Imported Ally Fresh"]?.role ===
                        "fresh active-game batch import" &&
                    app.state.characters?.["Imported Ally 1"]?.role ===
                        "imported smoke character 1" &&
                    /Skipped 1 already in game/i.test(document.body.textContent || ""),
                "active-game batch character import skips existing characters while importing new ones",
                {
                    characterNames: Object.keys(app.state.characters || {}),
                    noticeText: document.body.textContent.slice(-700),
                },
            );
            const popupOk = document.querySelector(".popup-modal #noticeOkBtn");
            if (popupOk) popupOk.click();
            addMessage("system", "Character import/export smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: character-import-export-smoke");
        }

        async function devRunCharacterMetadataRepairImportSmokeTest() {
            devTestLog("Scenario start: character-metadata-strict-rejection-smoke");
            devResetForLiveTest("character-metadata-repair-import-smoke");
            devCreateTestProfile({  });
            const validDefinition = clone(
                devSmokeCharacterRecord("Sable Caelix").character,
            );
            const missingGenre = clone(validDefinition);
            missingGenre.genres = [];
            const wrongCase = clone(validDefinition);
            wrongCase.creationTool = wrongCase.creation_tool;
            delete wrongCase.creation_tool;
            const unknownReferenceTag = clone(validDefinition);
            unknownReferenceTag.personality_description =
                "|[character_mood]| remains difficult to read.";
            const unresolvedCharacterTag = clone(validDefinition);
            unresolvedCharacterTag.starting_known_facts = [
                "|[character:not-in-this-file]| remains missing.",
            ];
            const validSelfReferenceTags = clone(validDefinition);
            validSelfReferenceTags.personality_description =
                "|[character]| trusts |[character_possessive_pronoun]| judgment.";

            const missingGenreValidation = validateCharacterExport({
                character_definition: missingGenre,
            });
            const wrongCaseValidation = validateCharacterExport({
                character_definition: wrongCase,
            });
            const unknownReferenceTagValidation = validateCharacterExport({
                character_definition: unknownReferenceTag,
            });
            const unresolvedCharacterTagValidation = validateCharacterExport({
                character_definition: unresolvedCharacterTag,
            });
            const validSelfReferenceTagValidation = validateCharacterExport({
                character_definition: validSelfReferenceTags,
            });
            devAssert(
                !missingGenreValidation.ok &&
                    missingGenreValidation.errors.some(
                        (error) => error.path === "character_definition.genres",
                    ),
                "missing character metadata is rejected instead of repaired",
                missingGenreValidation,
            );
            devAssert(
                !wrongCaseValidation.ok &&
                    wrongCaseValidation.errors.some(
                        (error) =>
                            error.path === "character_definition.creationTool" &&
                            error.code === "unknown_field",
                    ) &&
                    wrongCaseValidation.errors.some(
                        (error) => error.path === "character_definition.creation_tool",
                    ),
                "wrong-case character fields are rejected with the exact field path",
                wrongCaseValidation,
            );
            devAssert(
                !unknownReferenceTagValidation.ok &&
                    unknownReferenceTagValidation.errors.some(
                        (error) =>
                            error.path ===
                                "character_definition.personality_description" &&
                            /Unknown runtime reference token: \|\[character_mood\]\|/i.test(
                                error.message,
                            ),
                    ),
                "individual character import rejects unrecognized reference tags with the exact field path",
                unknownReferenceTagValidation,
            );
            devAssert(
                !unresolvedCharacterTagValidation.ok &&
                    unresolvedCharacterTagValidation.errors.some(
                        (error) =>
                            error.path ===
                                "character_definition.starting_known_facts.0" &&
                            /Character reference token does not resolve/i.test(
                                error.message,
                            ),
                    ),
                "individual character import rejects character reference tags that cannot resolve inside the file",
                unresolvedCharacterTagValidation,
            );
            devAssert(
                validSelfReferenceTagValidation.ok,
                "individual character import accepts recognized ID-less self reference tags",
                validSelfReferenceTagValidation,
            );
            let importRejected = false;
            try {
                characterImportRecordsFromExport({
                    character_definition: wrongCase,
                });
            } catch (error) {
                importRejected = /creationTool[\s\S]*not an approved field/i.test(
                    String(error?.message || error),
                );
            }
            devAssert(
                importRejected,
                "character import uses the canonical validator and does not repair wrong-case fields",
            );
            let unresolvedReferenceImportRejected = false;
            try {
                characterImportRecordsFromExport({
                    character_definition: unresolvedCharacterTag,
                });
            } catch (error) {
                unresolvedReferenceImportRejected =
                    /starting_known_facts\.0[\s\S]*Character reference token does not resolve/i.test(
                        String(error?.message || error),
                    );
            }
            devAssert(
                unresolvedReferenceImportRejected,
                "individual character import routes unresolved reference tags through the canonical rejection result",
            );
            devTestLog("Scenario complete: character-metadata-strict-rejection-smoke");
        }

        async function devRunCharacterProfileImportEdgeSmokeTest() {
            devTestLog("Scenario start: character-profile-import-edge-smoke");
            devResetForLiveTest("character-profile-import-edge-smoke");
            devCreateTestProfile({  });
            const previousTextToImagePlugin = globalThis.textToImagePlugin;
            globalThis.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({
                    dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                }),
            });
            const smokeImageHtml =
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Profile smoke image">`;
            try {
                // SANITIZE KEEP (dev fixture): synthetic profile-image state setup.
                // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Profile Import Edge Smoke",
                        },
                    },
                    player: {
                        ...devSmokeRuntimeCharacter("Public Download Ally", {
                            gender: "non-male",
                            role: "profile tester",
                        }),
                        name: "Public Download Ally",
                        age: 30,
                        gender: "non-male",
                        role: "profile tester",
                        profile_image_id: "profile-tester-existing",
                        profile_images: [{ id: "profile-tester-existing", male: false }],
                    },
                    characters: {
                        "Existing Ally": {
                            ...devSmokeRuntimeCharacter("Existing Ally", {
                                gender: "non-male",
                                role: "existing ally",
                            }),
                            name: "Existing Ally",
                            age: 28,
                            gender: "non-male",
                            role: "existing ally",
                            relationship_to_player: "trusted",
                            profile_image_id: "existing-ally-profile",
                            profile_images: [{ id: "existing-ally-profile", male: false }],
                        },
                    },
                    location: {
                        ...clone(defaultState.location || {}),
                        npc_location_id: "smoke-village",
                        specific_place: "Smoke Village",
                    },
                    npc_directory: {
                        locations: {
                            "smoke-village": {
                                label: "Smoke Village",
                                characters: {
                                    "Quiet Local": {
                                        name: "Quiet Local",
                                        gender: "male",
                                        age: 40,
                                        role: "local",
                                        relationship: "unknown",
                                        note: "Nearby but not inspected yet.",
                                        inspected: false,
                                    },
                                },
                            },
                        },
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: ["Public Download Ally", "Existing Ally"],
                        image_characters: [],
                        npcs_present: ["Quiet Local"],
                    },
                    objectives: {
                        active_id: "profile-import-edge-objective",
                        items: [
                            {
                                id: "profile-import-edge-objective",
                                title: "Verify Profile Imports",
                                type: "story",
                                status: "active",
                                summary: "Smoke test profile image import behavior.",
                                objective: "Import characters without replacing existing portraits.",
                                steps: [],
                                notes: [],
                                rewards: [],
                            },
                        ],
                    },
                });
                app.state.scene.party_members_present = ["Existing Ally"];
                app.profileImages = exactProfileImageStore([
                    {
                        id: "profile-tester-existing",
                        owner_name: "Player",
                        male: false,
                        source: "smoke",
                        model: "default",
                        seed: 101,
                        prompt: "original player profile",
                        html: smokeImageHtml,
                        favorite: true,
                    },
                    {
                        id: "existing-ally-profile",
                        owner_name: "Existing Ally",
                        male: false,
                        source: "smoke",
                        model: "default",
                        seed: 202,
                        prompt: "original ally profile",
                        html: smokeImageHtml,
                        favorite: true,
                    },
                    {
                        id: "imported-preserved-profile",
                        owner_name: "Imported Preserved",
                        male: false,
                        source: "imported",
                        model: "default",
                        seed: 303,
                        prompt: "imported preserved profile",
                        html: smokeImageHtml,
                        favorite: true,
                    },
                    {
                        id: "imported-preserved-profile-male",
                        owner_name: "Imported Preserved",
                        male: true,
                        source: "imported",
                        model: "default",
                        seed: 304,
                        prompt: "imported preserved male profile",
                        html: smokeImageHtml,
                        favorite: true,
                    },
                ].map((image) => createProfileImageRecord({
                    ...image,
                    character_id:
                        image.owner_name === "Player"
                            ? app.state.player.id
                            : app.state.characters?.[image.owner_name]?.id ||
                              `smoke-character-${objectiveIdFromTitle(image.owner_name, "character")}`,
                })));
                app.messages = [
                    {
                        id: nextEntryId(),
                        role: "assistant",
                        speaker: "Narrator",
                        text: "Profile import edge smoke test ready.",
                        at: new Date().toISOString(),
                    },
                ];
                scheduleActiveGameSave();
                render();

                const originalShowChoice = showChoice;
                showChoice = async () => "continue";
                try {
                    await devImportCharacterRecords(
                        characterImportRecordsFromExport({
                        characters: [
                            {
                                character_definition: runtimeCharacterDefinitionRecord(
                                    "Imported Preserved",
                                    {
                                    ...devSmokeCharacterRecord("Imported Preserved").character,
                                    name: "Imported Preserved",
                                    age: 29,
                                    gender: "non-male",
                                    role: "imported with portrait",
                                    default_profile_image: devSmokeDefaultProfileImage(
                                        "Imported Preserved",
                                        false,
                                    ),
                                    profile_image_id: "imported-preserved-profile",
                                    profile_images: [
                                        { id: "imported-preserved-profile", male: false },
                                        { id: "imported-preserved-profile-male", male: true },
                                    ],
                                    profile_image_presentations: {
                                        male: {
                                            ...devSmokeDefaultProfileImage("Imported Preserved Male", true),
                                            local_image_id: "imported-preserved-profile-male",
                                            prompt: "Imported preserved male profile.",
                                            seed: 304,
                                        },
                                        non_male: {
                                            ...devSmokeDefaultProfileImage("Imported Preserved Non-Male", false),
                                            local_image_id: "imported-preserved-profile",
                                            prompt: "Imported preserved non-male profile.",
                                            seed: 303,
                                        },
                                    },
                                    },
                                ).character,
                            },
                            {
                                character_definition: runtimeCharacterDefinitionRecord(
                                    "Imported Complete",
                                    devSmokeCharacterRecord("Imported Complete", {
                                        character: {
                                        age: 31,
                                        gender: "male",
                                        role: "imported complete portrait",
                                        default_profile_image: devSmokeDefaultProfileImage(
                                            "Imported Complete",
                                            true,
                                        ),
                                    },
                                    }).character,
                                ).character,
                            },
                        ],
                        }),
                    );
                } finally {
                    showChoice = originalShowChoice;
                }
                setLeftPanelGroup("characters");
                devAssert(
                    activeProfileImage(app.state.player)?.id ===
                        "profile-tester-existing" &&
                        activeProfileImage(app.state.characters?.["Existing Ally"])?.id ===
                            "existing-ally-profile" &&
                        activeProfileImage(app.state.characters?.["Imported Preserved"])?.id ===
                            "imported-preserved-profile",
                    "import preserves existing player, party, and imported profile images",
                    {
                        player: activeProfileImage(app.state.player),
                        existing: activeProfileImage(app.state.characters?.["Existing Ally"]),
                        imported: activeProfileImage(app.state.characters?.["Imported Preserved"]),
                    },
                );
                devAssert(
                    (app.state.scene?.party_members_present || []).includes("Imported Preserved") &&
                        (app.state.scene?.party_members_present || []).includes("Imported Complete"),
                    "imported party members are added to the active scene for immediate UI visibility",
                    app.state.scene?.party_members_present,
                );
                devAssert(
                    /Imported Preserved/i.test($("characterList")?.textContent || "") &&
                        /Imported Complete/i.test($("characterList")?.textContent || ""),
                    "Party panel refreshes with newly imported party members",
                    $("characterList")?.textContent || "",
                );
                const importedComplete = app.state.characters?.["Imported Complete"];
                const importedCompletePresentations =
                    createProfileImagePresentations(
                        importedComplete?.profile_image_presentations,
                    );
                devAssert(
                    defaultProfileImageSlotIsConfigured(importedCompletePresentations.male) &&
                        defaultProfileImageSlotIsConfigured(importedCompletePresentations.non_male) &&
                        !app.profileImageQueue?.some?.(
                            (item) => item?.name === "Imported Complete",
                        ) &&
                        !app.profileImageQueued?.has?.("Imported Complete") &&
                        !app.profileImageGenerating?.has?.("Imported Complete"),
                    "complete imported character keeps supplied gender presentations without queueing generation",
                    {
                        presentations: importedCompletePresentations,
                        active: activeProfileImage(importedComplete),
                        skip: importedComplete?.profile_image_auto_skip,
                        queue: app.profileImageQueue?.map?.((item) => item?.name),
                        queued: [...(app.profileImageQueued || new Set())],
                        generating: [...(app.profileImageGenerating || new Set())],
                    },
                );
                const interruptedPendingName = "Reload Pending Character";
                const interruptedFailedName = "Reload Failed Character";
                for (const interruptedName of [
                    interruptedPendingName,
                    interruptedFailedName,
                ]) {
                    app.state.characters[interruptedName] = devSmokeRuntimeCharacter(
                        interruptedName,
                        { gender: "non-male", role: "reload lifecycle tester" },
                    );
                }
                const reloadCompleted = rememberProfileImage(
                    "Imported Preserved",
                    {
                        id: "profile-reload-completed",
                        source: "smoke",
                        model: "default",
                        seed: 611,
                        prompt: "completed reload portrait",
                        html: smokeImageHtml,
                        favorite: false,
                    },
                    { setActive: true, save: false },
                );
                const reloadPending = rememberProfileImage(
                    interruptedPendingName,
                    {
                        id: "profile-reload-pending",
                        source: "smoke",
                        model: "default",
                        seed: 612,
                        prompt: "pending reload portrait",
                        html: "",
                        pending: true,
                        favorite: false,
                    },
                    { setActive: false, save: false },
                );
                const reloadFailed = rememberProfileImage(
                    interruptedFailedName,
                    {
                        id: "profile-reload-failed",
                        source: "smoke",
                        model: "default",
                        seed: 613,
                        prompt: "failed reload portrait",
                        html: "",
                        pending: false,
                        error: "interrupted smoke request",
                        favorite: false,
                    },
                    { setActive: false, save: false },
                );
                saveProfileImageRecordsNow(
                    [reloadCompleted, reloadPending, reloadFailed],
                    "profile reload lifecycle smoke",
                    { selectProfileImages: true },
                );
                await devWaitFor(
                    () => !app.librarySavePendingCount,
                    10000,
                    "completed profile image persistence",
                );
                const persistedReloadProfiles = await app.persistence.listSharedRecords(
                    "characterProfileImages",
                    { limit: 10000 },
                );
                const persistedReloadIds = new Set(
                    (persistedReloadProfiles.records || []).map((image) => image.imageId),
                );
                const persistedReloadSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [reloadCompleted.character_id, "non_male"],
                );
                devAssert(
                    persistedReloadIds.has(reloadCompleted.id) &&
                        !persistedReloadIds.has(reloadPending.id) &&
                        !persistedReloadIds.has(reloadFailed.id) &&
                        persistedReloadSelection?.imageId === reloadCompleted.id,
                    "refresh persistence keeps completed portraits and drops interrupted or failed requests",
                    {
                        persistedReloadIds: [...persistedReloadIds],
                        persistedReloadSelection,
                    },
                );
                app.profileImages = app.profileImages.filter(
                    (image) => ![reloadCompleted.id, reloadPending.id, reloadFailed.id].includes(image.id),
                );
                const reloadedProfiles = await legacySharedImagesFromNormalized(
                    PROFILE_IMAGE_KEY,
                    [],
                );
                devAssert(
                    reloadedProfiles.some((image) => image.id === reloadCompleted.id) &&
                        !reloadedProfiles.some((image) => image.id === reloadPending.id) &&
                        !reloadedProfiles.some((image) => image.id === reloadFailed.id),
                    "profile-image reload treats interrupted and failed requests as missing",
                    reloadedProfiles.map((image) => image.id),
                );
                for (const interruptedName of [
                    interruptedPendingName,
                    interruptedFailedName,
                ]) {
                    const entity = app.state.characters[interruptedName];
                    entity.profile_images = [];
                    entity.profile_image_id = "";
                    devAssert(
                        !activeProfileImage(entity) &&
                            queueProfileImage(interruptedName, {
                                reason: "reload lifecycle retry",
                                allowDuringSmoke: true,
                            }),
                        `${interruptedName} reloads as missing and can requeue`,
                        entity,
                    );
                }
                await devWaitFor(
                    () => [interruptedPendingName, interruptedFailedName].every(
                        (name) => profileImageIsFinished(
                            activeProfileImage(app.state.characters[name]),
                        ),
                    ),
                    10000,
                    "interrupted profile image retries",
                );
                await app.persistence.deleteSharedImage(
                    "characterProfileImages",
                    reloadCompleted.id,
                );
                await app.persistence.deleteSharedImage(
                    "characterProfileImageSelections",
                    [reloadCompleted.character_id, "non_male"],
                );
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    ...reloadedProfiles.filter(
                        (image) => !app.profileImages.some((existing) => existing.id === image.id),
                    ).filter((image) => image.id !== reloadCompleted.id),
                ]);
                document.querySelector(".popup-modal #noticeOkBtn")?.click();

                const deletionPersistenceName = "Imported Preserved";
                const deletionPersistenceCharacter =
                    app.state.characters[deletionPersistenceName];
                app.profileImages = (app.profileImages || []).filter(
                    (image) =>
                        String(image.owner_name || "") !== deletionPersistenceName,
                );
                deletionPersistenceCharacter.profile_image_id = "";
                deletionPersistenceCharacter.profile_images = [];
                const retainedProfileImage = rememberProfileImage(
                    deletionPersistenceName,
                    {
                        id: "character-delete-retained-profile",
                        source: "smoke",
                        model: "default",
                        seed: 701,
                        prompt: "retained profile image",
                        html: smokeImageHtml,
                        favorite: true,
                    },
                );
                const deletedProfileImage = rememberProfileImage(
                    deletionPersistenceName,
                    {
                        id: "character-delete-removed-profile",
                        source: "smoke",
                        model: "default",
                        seed: 702,
                        prompt: "deleted profile image",
                        html: smokeImageHtml,
                    },
                    { setActive: false },
                );
                const retainedNormalImage = rememberImage({
                    id: "character-delete-retained-normal",
                    source: "smoke",
                    model: "default",
                    seed: 703,
                    prompt: "retained normal image",
                    html: smokeImageHtml,
                    targets: [deletionPersistenceName],
                    target_presentations: {
                        [deletionPersistenceName]: "non_male",
                    },
                });
                const deletedNormalImage = rememberImage({
                    id: "character-delete-removed-normal",
                    source: "smoke",
                    model: "default",
                    seed: 704,
                    prompt: "deleted normal image",
                    html: smokeImageHtml,
                    targets: [deletionPersistenceName],
                    target_presentations: {
                        [deletionPersistenceName]: "non_male",
                    },
                });
                const deletionProfileRecords = [
                    retainedProfileImage,
                    deletedProfileImage,
                ];
                saveProfileImageRecordsNow(
                    deletionProfileRecords,
                    "character image deletion persistence smoke setup",
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                try {
                    devAssert(
                        profileImagesForEntity(deletionPersistenceCharacter).length === 2 &&
                            profileRelatedImages(deletionPersistenceName).length === 2,
                        "character image deletion persistence starts with exactly two profile and two normal images",
                        {
                            profiles: profileImagesForEntity(
                                deletionPersistenceCharacter,
                            ).map((image) => image.id),
                            normal: profileRelatedImages(deletionPersistenceName).map(
                                (image) => image.id,
                            ),
                        },
                    );
                    devAssert(
                        removeProfileImage(
                            deletionPersistenceName,
                            deletedProfileImage.id,
                        ) && removeImageRecord(deletedNormalImage.id),
                        "character image deletion uses the production profile and normal image removal paths",
                    );
                    await app.work.flush(
                        `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                    );
                    const storedProfilesAfterDelete = await loadPerRecordLibrary(
                        PROFILE_IMAGE_KEY,
                        [],
                    );
                    app.profileImages = exactProfileImageStore([
                        ...(app.profileImages || []).filter(
                            (image) =>
                                String(image.character_id || "") !==
                                String(deletionPersistenceCharacter.id || ""),
                        ),
                        ...storedProfilesAfterDelete.filter(
                            (image) =>
                                String(image.character_id || "") ===
                                String(deletionPersistenceCharacter.id || ""),
                        ),
                    ]);
                    devAssert(
                        removeRuntimeCharacter(deletionPersistenceName, {
                            close: false,
                        }),
                        "character image deletion persistence removes the character through the production delete path",
                    );
                    await devImportCharacterRecords(
                        characterImportRecordsFromExport({
                            characters: [
                                {
                                    character_definition: runtimeCharacterDefinitionRecord(
                                        deletionPersistenceName,
                                        {
                                        ...devSmokeCharacterRecord(deletionPersistenceName).character,
                                        age: 29,
                                        gender: "non-male",
                                        role: "re-imported image persistence tester",
                                        default_profile_image: {
                                            ...devSmokeDefaultProfileImage(
                                                deletionPersistenceName,
                                                false,
                                            ),
                                        },
                                        profile_image_presentations: {
                                            male: devSmokeDefaultProfileImage(
                                                `${deletionPersistenceName} Male`,
                                                true,
                                            ),
                                            non_male: {
                                                ...devSmokeDefaultProfileImage(
                                                    deletionPersistenceName,
                                                    false,
                                                ),
                                            },
                                        },
                                    },
                                    ).character,
                                },
                            ],
                        }),
                    );
                    document.querySelector(".popup-modal #noticeOkBtn")?.click();
                    const reimportedCharacter =
                        app.state.characters[deletionPersistenceName];
                    const reimportedProfileIds = profileImagesForEntity(
                        reimportedCharacter,
                    ).map((image) => String(image.id));
                    const reimportedNormalIds = profileRelatedImages(
                        deletionPersistenceName,
                    ).map((image) => String(image.id));
                    devAssert(
                        reimportedProfileIds.length === 1 &&
                            reimportedProfileIds.includes(
                                String(retainedProfileImage.id),
                            ) &&
                            !reimportedProfileIds.includes(
                                String(deletedProfileImage.id),
                            ) &&
                            reimportedNormalIds.length === 1 &&
                            reimportedNormalIds.includes(
                                String(retainedNormalImage.id),
                            ) &&
                            !reimportedNormalIds.includes(
                                String(deletedNormalImage.id),
                            ) &&
                            !storedProfilesAfterDelete.some(
                                (image) =>
                                    String(image.id) ===
                                    String(deletedProfileImage.id),
                            ),
                        "preserved character images reconnect after a clean re-import while individually deleted images stay deleted",
                        {
                            profileIds: reimportedProfileIds,
                            normalIds: reimportedNormalIds,
                            storedProfileIds: storedProfilesAfterDelete
                                .filter(
                                    (image) =>
                                        String(image.character_id || "") ===
                                        String(deletionPersistenceCharacter.id || ""),
                                )
                                .map((image) => image.id),
                        },
                    );
                } finally {
                    deleteProfileImageRecordsNow(
                        deletionProfileRecords.map((image) => ({ id: image.id })),
                        "character image deletion persistence smoke cleanup",
                    );
                    await app.work.flush(
                        `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                    );
                    app.profileImages = (app.profileImages || []).filter(
                        (image) =>
                            !deletionProfileRecords.some(
                                (record) =>
                                    String(record.id) === String(image.id),
                            ),
                    );
                    app.images = (app.images || []).filter(
                        (image) =>
                            String(image.id) !== String(retainedNormalImage.id) &&
                            String(image.id) !== String(deletedNormalImage.id),
                    );
                    removeRuntimeCharacter(deletionPersistenceName, {
                        close: false,
                        save: false,
                    });
                }
                const quietLocalShell = getNpcEntry("Quiet Local", "Smoke Village");
                devAssert(
                    !quietLocalShell?.full_character &&
                        !(app.profileImages || []).some(
                            (image) => image.owner_name === "Quiet Local",
                        ),
                    "uninspected nearby NPC did not get a profile image automatically",
                    quietLocalShell,
                );
                const quietLocal = getNpcEntry("Quiet Local", "Smoke Village");
                quietLocal.inspected = true;
                quietLocal.full_character = materializeCharacterForRuntime(
                    {
                        ...devSmokeRuntimeCharacter("Quiet Local", {
                            gender: "male",
                            role: "inspected local",
                        }),
                        name: "Quiet Local",
                        age: 40,
                        gender: "male",
                        role: "inspected local",
                    },
                    "Quiet Local",
                );
                devAssert(
                    !!profileEntity("Quiet Local"),
                    "inspected NPC has a profile entity",
                    {
                        npc: getNpcEntry("Quiet Local", "Smoke Village"),
                        found: profileEntity("Quiet Local"),
                        currentSettlement: currentSettlementName(),
                    },
                );
                const queuedNpcProfile = queueProfileImageIfMissing(
                    "Quiet Local",
                    "npc inspected",
                );
                await devWaitFor(
                    () =>
                        queuedNpcProfile ||
                        activeProfileImage(quietLocal.full_character) ||
                        app.profileImageQueued?.has?.("Quiet Local") ||
                        app.profileImageGenerating?.has?.("Quiet Local") ||
                        app.profileImageQueue?.some?.(
                            (item) => item?.name === "Quiet Local",
                        ),
                    5000,
                    "inspected NPC profile to become queued or active",
                );
                devAssert(
                    queuedNpcProfile ||
                        activeProfileImage(quietLocal.full_character) ||
                        app.profileImageQueued?.has?.("Quiet Local") ||
                        app.profileImageGenerating?.has?.("Quiet Local"),
                    "inspected NPC missing profile image becomes eligible for generation",
                    {
                        active: activeProfileImage(quietLocal.full_character),
                        queued: app.profileImageQueued?.has?.("Quiet Local"),
                        generating: app.profileImageGenerating?.has?.("Quiet Local"),
                        queue: app.profileImageQueue?.map?.((item) => item?.name),
                    },
                );
                const popupOk = document.querySelector(".popup-modal #noticeOkBtn");
                if (popupOk) popupOk.click();
                addMessage("system", "Character profile import edge smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: character-profile-import-edge-smoke");
            } finally {
                if (typeof previousTextToImagePlugin === "undefined")
                    delete globalThis.textToImagePlugin;
                else globalThis.textToImagePlugin = previousTextToImagePlugin;
            }
        }

        async function devRunCharacterCardActionRefreshSmokeTest() {
            devTestLog("Scenario start: character-card-action-refresh-smoke");
            devResetForLiveTest("character-card-action-refresh-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic character-card action state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Character Card Action Refresh Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Card Tester",
                    age: 30,
                    gender: "non-male",
                    role: "card refresh tester",
                },
                characters: {
                    "Active Ally": {
                        ...devSmokeRuntimeCharacter("Active Ally", {
                            gender: "non-male",
                            role: "active ally",
                        }),
                        name: "Active Ally",
                        age: 28,
                        gender: "non-male",
                        role: "active ally",
                    },
                    "Hidden Ally": {
                        ...devSmokeRuntimeCharacter("Hidden Ally", {
                            gender: "male",
                            role: "hidden ally",
                        }),
                        name: "Hidden Ally",
                        age: 29,
                        gender: "male",
                        role: "hidden ally",
                        profile_image_id: "hidden-ally-existing-profile",
                        profile_images: [{ id: "hidden-ally-existing-profile", male: true }],
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Player", "Active Ally"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "card-refresh-town",
                    specific_place: "card refresh town",
                },
                npc_directory: {
                    locations: {
                        "card-refresh-town": {
                            label: "card refresh town",
                            characters: {
                                "Inspected Toggle": {
                                    name: "Inspected Toggle",
                                    age: 31,
                                    gender: "female",
                                    role: "inspected npc",
                                    relationship: "neutral",
                                    inspected: true,
                                    full_character: {
                                        ...blankCharacterTemplate("Inspected Toggle"),
                                        name: "Inspected Toggle",
                                        age: 31,
                                        gender: "female",
                                        role: "inspected npc",
                                    },
                                },
                                "Uninspected Toggle": {
                                    name: "Uninspected Toggle",
                                    age: 32,
                                    gender: "male",
                                    role: "uninspected npc",
                                    relationship: "neutral",
                                    inspected: false,
                                },
                            },
                        },
                    },
                },
                objectives: {
                    active_id: "character-card-refresh-objective",
                    items: [
                        {
                            id: "character-card-refresh-objective",
                            title: "Verify Character Card Refresh",
                            type: "story",
                            status: "active",
                            summary: "Smoke test character card actions.",
                            objective: "Toggle card buttons and refresh visible UI.",
                            steps: [],
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.profileImages = exactProfileImageStore([
                createProfileImageRecord({
                    id: "hidden-ally-existing-profile",
                    character_id: app.state.characters["Hidden Ally"].id,
                    owner_name: "Hidden Ally",
                    source: "smoke",
                    model: "default",
                    seed: 404,
                    prompt: "existing hidden ally profile",
                    html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Hidden ally profile">`,
                    favorite: true,
                    male: true,
                }),
            ]);
            scheduleActiveGameSave();
            render();

            openCharactersModal("Hidden");
            await new Promise((resolve) => setTimeout(resolve, 100));
            const cardButton = (action, name = "Hidden Ally") =>
                $("modalBox")?.querySelector(
                    `[data-character-action="${action}"][data-character-name="${cssEscape(name)}"]`,
                );
            devAssert(
                /1 matching character/i.test($("characterDirectorySearchCount")?.textContent || ""),
                "characters modal preserves filtered directory view",
                $("characterDirectorySearchCount")?.textContent,
            );
            devAssert(
                /Add to scene/i.test(cardButton("present")?.title || ""),
                "hidden character starts with Add to scene action",
                cardButton("present")?.outerHTML,
            );
            cardButton("present")?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                (app.state.scene?.party_members_present || []).includes("Hidden Ally") &&
                    /Remove from scene/i.test(cardButton("present")?.title || "") &&
                    /1 matching character/i.test($("characterDirectorySearchCount")?.textContent || ""),
                "Add to scene updates state and refreshes the open characters modal",
                {
                    active: app.state.scene?.party_members_present,
                    button: cardButton("present")?.outerHTML,
                    count: $("characterDirectorySearchCount")?.textContent,
                },
            );

            cardButton("image")?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                (app.state.scene?.image_characters || []).includes("Hidden Ally") &&
                    /Remove from images/i.test(cardButton("image")?.title || ""),
                "Include in images updates state and refreshes the open characters modal",
                {
                    imageCharacters: app.state.scene?.image_characters,
                    button: cardButton("image")?.outerHTML,
                },
            );

            app.presenceCleanupRunning = true;
            cardButton("present")?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            app.presenceCleanupRunning = false;
            devAssert(
                !(app.state.scene?.party_members_present || []).includes("Hidden Ally") &&
                    /Add to scene/i.test(cardButton("present")?.title || ""),
                "Remove from scene updates state and refreshes the open characters modal",
                {
                    active: app.state.scene?.party_members_present,
                    button: cardButton("present")?.outerHTML,
                },
            );

            closeModal();
            openCharactersModal("Toggle");
            await new Promise((resolve) => setTimeout(resolve, 100));
            const inspectedNpcCard = $("modalBox")?.querySelector(
                '[data-character-name="Inspected Toggle"]',
            );
            const uninspectedNpcCard = $("modalBox")?.querySelector(
                '[data-character-name="Uninspected Toggle"]',
            );
            const inspectedPresentButton = () =>
                $("modalBox")?.querySelector(
                    '[data-character-name="Inspected Toggle"] button[title="Add to scene"], [data-character-name="Inspected Toggle"] button[title="Remove from scene"]',
                );
            devAssert(
                inspectedNpcCard &&
                    /Add to scene/i.test(inspectedPresentButton()?.title || "") &&
                    inspectedPresentButton()?.classList.contains("party-off"),
                "inspected NPC card in Characters modal starts with Add to scene toggle",
                inspectedNpcCard?.outerHTML,
            );
            inspectedPresentButton()?.click();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                (app.state.scene?.npcs_present || []).includes("Inspected Toggle") &&
                    /Remove from scene/i.test(inspectedPresentButton()?.title || "") &&
                    inspectedPresentButton()?.classList.contains("party-on"),
                "inspected NPC Add to scene toggle updates the Characters modal card",
                {
                    npcsPresent: app.state.scene?.npcs_present,
                    button: inspectedPresentButton()?.outerHTML,
                },
            );
            devAssert(
                uninspectedNpcCard &&
                    !uninspectedNpcCard.querySelector?.('button[title="Invite to party"]'),
                "uninspected NPC card in Characters modal does not show Invite to Party",
                uninspectedNpcCard?.outerHTML,
            );
            closeModal();
            addMessage("system", "Character card action refresh smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: character-card-action-refresh-smoke");
        }



        async function devRunRealMaidSamaStartImagesSmokeTest() {
            const scenarioId = "real-maid-sama-start-images-smoke";
            devTestLog(`Scenario start: ${scenarioId}`);
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            return devWithDeterministicImagePlugin(scenarioId, async () => {
                try {
                    devResetForLiveTest(scenarioId);
                    devCreateTestProfile({  });
                    const record = await devImportMaidSamaStoryForSmoke();
                    devAssert(
                        /Smoke Fixture Real Start Images/i.test(
                            String(record?.state?.meta?.story_source?.title || record?.title || ""),
                        ),
                        "real start image smoke uses the synthetic smoke template",
                        {
                            id: record?.id,
                            title: record?.title,
                            description: record?.description,
                        },
                    );
                    await devClearSmokeProfileImagesForNames([
                        "Player",
                        "Smoke Start Player",
                    ]);
                    await startStoryTemplate(record.id);
                    devAssert(
                        app.state?.player?.name === "Smoke Start Player",
                        `real start image smoke starts with the synthetic player option: ${JSON.stringify({
                            playerName: app.state?.player?.name || "",
                            selectedPlayerName:
                                app.state?.meta?.selected_player_name || "",
                            lastStoryStartError: app.lastStoryStartError || "",
                            playerOptions: (app.state?.players || []).map(
                                (player) => player?.name || "",
                            ),
                            modalText: String($("modalBox")?.textContent || "").slice(
                                0,
                                500,
                            ),
                        })}`,
                        {
                            playerName: app.state?.player?.name || "",
                            selectedPlayerName:
                                app.state?.meta?.selected_player_name || "",
                            lastStoryStartError: app.lastStoryStartError || "",
                            playerOptions: (app.state?.players || []).map(
                                (player) => player?.name || "",
                            ),
                            modalText: String($("modalBox")?.textContent || "").slice(
                                0,
                                500,
                            ),
                        },
                    );
                    devAcceptPlayerInputHelpIfShown();
                    render();
                    devTestLog("Real Maid Sama start image smoke after template load", {
                        activeSaveId: activeSaveId(),
                        storyTitle: app.state?.meta?.story_source?.title,
                        messages: app.messages?.length || 0,
                        images: (app.images || []).map((image) => ({
                            id: image.id,
                            pending: image.pending,
                            error: image.error || "",
                            hasHtml: devLooksLikeRealImageHtml(image.html),
                        })),
                        playerProfile: devProfileImageDiagnostics(app.state?.player?.name || ""),
                    });
                    const normalImage = await devWaitForGeneratedNormalImage(
                        DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS,
                        "real Maid Sama opening normal image generation to finish",
                    );
                    render();
                    const normalCard = document.querySelector(
                        `[data-image-id="${cssEscape(imageDomId(normalImage.id))}"]`,
                    );
                    devAssert(
                        normalImage?.pending === false &&
                            !normalImage?.error &&
                            devLooksLikeRealImageHtml(normalImage?.html) &&
                            devLooksLikeRealImageHtml(normalCard?.innerHTML || ""),
                        "real Maid Sama opening normal image is finished, stored, and displayed",
                        {
                            normalImage,
                            cardHtmlStart: String(normalCard?.innerHTML || "").slice(
                                0,
                                220,
                            ),
                        },
                    );
                    const playerProfile = await devWaitForGeneratedProfileImage(
                        "Player",
                        DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS,
                        "real synthetic start player profile image generation to finish",
                    );
                    devAssertProfileImageDisplayedAndStored(
                        "Player",
                        playerProfile,
                        "real synthetic start player profile image is finished, stored, active, and displayed",
                    );
                    addMessage(
                        "system",
                        "Real Maid Sama start images smoke passed.",
                    );
                    render();
                    devTestLog(`Scenario complete: ${scenarioId}`, {
                        normalImageId: normalImage?.id || "",
                        playerProfileId: activeProfileImage(app.state.player)?.id || "",
                        images: app.images?.length || 0,
                        profileImages: profileImagesForEntity(app.state.player || {}).map(
                            (image) => image.id,
                        ),
                    });
                } finally {
                    await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
                }
            });
        }

        async function devImportHaremStoryForSmoke() {
            devCreateTestProfile({  });
            const record = devSmokeHaremReplacementTemplate();
            devUpsertStoryTemplatesForSmoke([record]);
            return record;
        }

        async function devImportMaidSamaStoryForSmoke() {
            devCreateTestProfile({  });
            const startPlayer = devSmokeRuntimeCharacter("Smoke Start Player", {
                gender: "female",
                role: "fake live-image start player",
            });
            startPlayer.profile_image_id = "";
            startPlayer.profile_images = [];
            startPlayer.default_profile_image = emptyProfileImageSlot(false);
            startPlayer.profile_image_presentations = {
                male: emptyProfileImageSlot(true),
                non_male: emptyProfileImageSlot(false),
            };
            const record = devSmokeStoryRecord({
                id: "smoke-fixture-real-start-images-story",
                title: "Smoke Fixture Real Start Images",
                players: [startPlayer],
                active_id: "smoke-start-image-objective",
                image_characters: ["Player"],
                objectives: [
                    devSmokeObjective("smoke-start-image-objective", "Start the Fake Image Scene", {
                        status: "active",
                        summary: "Start a fake scene that should generate opening images.",
                        ending_type: "freeplay",
                        ending_message: "The fake image scene can continue in freeplay.",
                    }),
                ],
                opening_text: "A fake live-image start smoke begins in a quiet room.",
                scene_summary: "A quiet fake room for real-image smoke coverage.",
                image_action: "standing in a quiet fake room",
            });
            const importedPlayer = record.state?.players?.[0];
            if (importedPlayer) {
                importedPlayer.default_profile_image = emptyProfileImageSlot(false);
                importedPlayer.profile_image_presentations = {
                    male: emptyProfileImageSlot(true),
                    non_male: emptyProfileImageSlot(false),
                };
            }
            devUpsertStoryTemplatesForSmoke([record]);
            return record;
        }

        async function devRunStoryFilesSchemaSmokeTest() {
            devTestLog("Scenario start: story-files-schema-smoke");
            devResetForLiveTest("story-files-schema-smoke");
            devCreateTestProfile({  });
            const branchTemplate = devSmokeVenisReplacementTemplate();
            const smokeTemplatesByPath = {
                "stories/smoke-fixture-objective-chain.json":
                    devSmokeHaremReplacementTemplate(),
                "stories/smoke-fixture-branch-lab.json": branchTemplate,
                "stories/smoke-fixture-player-select.json":
                    devSmokePlayerSelectTemplate(),
            };
            const storyPaths = Object.keys(smokeTemplatesByPath);
            const loaded = [];
            const problems = [];
            const forbiddenObjectiveFields = [
                "objective",
                "steps",
                "current_step_id",
                "selected_step",
                "selected_step_id",
            ];
            const checkCharacterDefaults = (file, label, character) => {
                if (!isPlainObject(character)) return;
                if (!Array.isArray(character.outfits) || !character.outfits.length)
                    problems.push({ file, label, issue: "missing outfits" });
                if (!textSlot(character.starting_outfit_id))
                    problems.push({ file, label, issue: "missing starting_outfit_id" });
                if (!isPlainObject(character.default_profile_image))
                    problems.push({ file, label, issue: "missing default_profile_image" });
                if (!isPlainObject(character.image_prompt_config))
                    problems.push({ file, label, issue: "missing image_prompt_config" });
                if ("kind" in character || "entity_kind" in character)
                    problems.push({ file, label, issue: "legacy character kind field" });
                if (character.can_die !== false && character.can_die !== true)
                    problems.push({ file, label, issue: "missing can_die boolean" });
            };
            const supportedRewardTypes = supportedObjectiveRewardTypes();
            for (const storyPath of storyPaths) {
                const payload = {
                    app: "EmberAdventures",
                    exportType: "story-template",
                    storyTemplate: smokeTemplatesByPath[storyPath],
                };
                const template =
                    payload.storyTemplate ||
                    payload.template ||
                    (payload.exportType === "story-template" && payload.state
                        ? payload
                        : null);
                if (!template?.state || !isPlainObject(template.state)) {
                    problems.push({
                        file: storyPath,
                        issue: "missing raw story-template state",
                    });
                    continue;
                }
                loaded.push(template.title || storyPath);
                const strictValidation = validateStoryDefinition(template);
                if (!strictValidation.ok)
                    problems.push({
                        file: storyPath,
                        issue: "strict story validation failed",
                        errors: strictValidation.errors,
                    });
                const state = template.state || {};
                for (const key of [
                    "player_preferences",
                    "ick_limits",
                ]) {
                    if (Object.prototype.hasOwnProperty.call(state.meta || {}, key))
                        problems.push({
                            file: storyPath,
                            issue: `user profile preference field leaked into state.meta.${key}`,
                        });
                }
                if (payload.app !== "EmberAdventures" || payload.exportType !== "story-template")
                    problems.push({ file: storyPath, issue: "bad story-template wrapper" });
                if ("story_flags" in state)
                    problems.push({ file: storyPath, issue: "legacy story_flags present" });
                if (!Array.isArray(state.story_rules))
                    problems.push({ file: storyPath, issue: "missing story_rules array" });
                for (const rule of state.story_rules || []) {
                    if (!textSlot(rule?.id) || !textSlot(rule?.text))
                        problems.push({
                            file: storyPath,
                            issue: "story_rules entry missing id/text",
                            rule,
                        });
                }
                if (!isPlainObject(state.world_map?.locations))
                    problems.push({ file: storyPath, issue: "missing world_map.locations" });
                const objectives = state.objectives?.items || [];
                if (!Array.isArray(objectives) || !objectives.length)
                    problems.push({ file: storyPath, issue: "missing objectives array" });
                const futureCastIds = new Set(
                    Object.keys(state.future_cast?.items || {}).map((id) => String(id)),
                );
                for (const objective of objectives) {
                    const legacyFields = forbiddenObjectiveFields.filter(
                        (field) => field in objective,
                    );
                    if (legacyFields.length)
                        problems.push({
                            file: storyPath,
                            objectiveId: objective.id,
                            issue: "legacy objective fields",
                            legacyFields,
                        });
                    for (const rawReward of objective.rewards || []) {
                        if (typeof rawReward === "string") continue;
                        const reward = rawReward;
                        if (
                            !isPlainObject(reward) ||
                            !supportedRewardTypes.has(String(reward.type || ""))
                        ) {
                            problems.push({
                                file: storyPath,
                                objectiveId: objective.id,
                                rewardType: reward?.type || "",
                                issue: "unsupported objective reward type",
                            });
                            continue;
                        }
                        if (
                            [
                                "introduce_future_character",
                                "promote_future_character_to_party",
                            ].includes(String(reward.type || "")) &&
                            !futureCastIds.has(String(reward.character_id || ""))
                        ) {
                            problems.push({
                                file: storyPath,
                                objectiveId: objective.id,
                                rewardType: reward.type,
                                missingFutureCastId: reward.character_id,
                            });
                        }
                    }
                }
                if (/The-Venis-Model\.json$/i.test(storyPath)) {
                    const objectiveIds = new Set(objectives.map((item) => String(item.id || "")));
                    for (const removedId of [
                        "face-the-old-signal",
                        "cut-the-retrieval-line",
                        "price-the-parts",
                        "settle-the-account",
                        "choose-the-replacement",
                    ]) {
                        if (objectiveIds.has(removedId))
                            problems.push({
                                file: storyPath,
                                objectiveId: removedId,
                                issue: "removed Litia branch objective is still present",
                            });
                    }
                    for (const removedFutureId of ["varek-syn", "sera-nine"]) {
                        if (futureCastIds.has(removedFutureId))
                            problems.push({
                                file: storyPath,
                                futureCastId: removedFutureId,
                                issue: "removed Litia future-cast entry is still present",
                            });
                    }
                    const expectedChoiceGroups = {
                        "opening-wakeup-choice": 2,
                        "first-approach-choice": 3,
                        "first-repair-priority": 2,
                        "freedom-control-choice": 2,
                        "market-choice": 2,
                        "final-lock-choice": 2,
                        "post-freedom-choice": 2,
                        "body-choice": 2,
                        "final-future-choice": 2,
                    };
                    const actualChoiceGroups = {};
                    for (const objective of objectives) {
                        if (
                            objective.kind !== "side" &&
                            objectiveCompletionControl(objective) === "choice"
                        ) {
                            const directOptions = objectiveDirectChoiceOptions(objective);
                            const choiceCount = directOptions.length || 1;
                            actualChoiceGroups[objective.exclusive_group || objective.id || ""] =
                                (actualChoiceGroups[
                                    objective.exclusive_group || objective.id || ""
                                ] || 0) + choiceCount;
                        }
                        const rewardsToCheck = [
                            ...(objective.rewards || []),
                            ...objectiveDirectChoiceOptions(objective).flatMap(
                                (choice) => choice.rewards || [],
                            ),
                        ];
                        for (const reward of rewardsToCheck) {
                            if (
                                String(reward.type || "") === "set_state_field" &&
                                ["trust", "affection", "attraction"].includes(
                                    String(reward.field_path?.[0] || ""),
                                )
                            ) {
                                problems.push({
                                    file: storyPath,
                                    objectiveId: objective.id,
                                    fieldPath: reward.field_path,
                                    issue: "Litia story must adjust relationship stats instead of setting them",
                                });
                            }
                        }
                    }
                    for (const [group, count] of Object.entries(expectedChoiceGroups)) {
                        if (actualChoiceGroups[group] !== count)
                            problems.push({
                                file: storyPath,
                                exclusiveGroup: group,
                                expected: count,
                                actual: actualChoiceGroups[group] || 0,
                                issue: "Litia story choice group does not match expected Telltale branch shape",
                            });
                    }
                    if (state.objectives?.active_id !== "first-contact")
                        problems.push({
                            file: storyPath,
                            activeId: state.objectives?.active_id,
                            issue: "Litia story must start at the opening direct-choice branch",
                        });
                    const openingChoiceObjective = objectives.find(
                        (objective) => objective.id === "first-contact",
                    );
                    const openingChoices = objectiveDirectChoiceOptions(openingChoiceObjective);
                    if (
                        !openingChoiceObjective ||
                        objectiveCompletionControl(openingChoiceObjective) !== "choice" ||
                        openingChoices.length !== 2 ||
                        !openingChoices.some((choice) => choice.id === "stay-hidden") ||
                        !openingChoices.some((choice) => choice.id === "step-out-to-reassure-her")
                    )
                        problems.push({
                            file: storyPath,
                            choices: openingChoices.map((objective) => ({
                                id: objective.id,
                                status: objective.status,
                                selectable: objective.selectable,
                            })),
                            issue: "Litia opening direct choices must both be selectable so the first menu has both paths",
                        });
                }
                checkCharacterDefaults(storyPath, "player", state.player);
                if (Array.isArray(state.players)) {
                    if (state.players.length > 1 && !textSlot(state.player?.name))
                        problems.push({
                            file: storyPath,
                            issue: "multi-player-select story missing fallback player",
                        });
                    for (const [index, playerOption] of state.players.entries())
                        checkCharacterDefaults(
                            storyPath,
                            `player-option:${index}:${playerOption?.name || ""}`,
                            playerOption,
                        );
                }
                for (const [name, character] of Object.entries(state.characters || {}))
                    checkCharacterDefaults(storyPath, `character:${name}`, character);
                for (const [id, item] of Object.entries(state.future_cast?.items || {}))
                    checkCharacterDefaults(storyPath, `future:${id}`, item?.full_character);
                for (const [locationName, bucket] of Object.entries(
                    state.npc_directory?.locations || {},
                )) {
                    if (!isPlainObject(bucket?.characters))
                        problems.push({
                            file: storyPath,
                            locationName,
                            issue: "npc_directory location missing characters object",
                        });
                    for (const [name, npc] of Object.entries(bucket?.characters || {})) {
                        if (npc?.full_character)
                            checkCharacterDefaults(
                                storyPath,
                                `npc:${locationName}:${name}`,
                                npc.full_character,
                            );
                    }
                }
            }
            if (problems.length)
                devTestLog("Story library schema problems", {
                    loaded,
                    problems,
                });
            devAssert(
                !problems.length,
                `All synthetic smoke story templates match the current story-template definition: ${JSON.stringify(problems)}`,
                { loaded, problems },
            );
            addMessage("system", "Story files schema smoke test passed.");
            showNotice("Live Test Passed", "Story files schema smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: story-files-schema-smoke", {
                storyCount: loaded.length,
            });
        }

        async function devRunHaremObjectiveGraphSmokeTest() {
            devTestLog("Scenario start: harem-objective-graph-smoke");
            devResetForLiveTest("harem-objective-graph-smoke");
            const template = await devImportHaremStoryForSmoke();
            const rawTemplateObjectives =
                template.state?.objectives?.items || [];
            devAssert(
                rawTemplateObjectives.every((objective) => !("objective" in objective)),
                "Harem story objectives use summary instead of the legacy duplicate objective field",
                rawTemplateObjectives
                    .filter((objective) => "objective" in objective)
                    .map((objective) => objective.id),
            );
            // SANITIZE KEEP (dev fixture): smoke test loads a full story template state.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState(clone(template.state));
            app.state.meta ||= {};
            app.state.meta.setup_complete = true;
            app.messages = clone(template.messages || []);
            app.images = [];
            app.profileImages = [];
            await devCompileCurrentStoryFixture("harem-objective-graph-smoke");
            reconcileStoryRuntimeState(app.state, "harem objective graph seed");
            scheduleActiveGameSave();
            render();

            const objectiveById = (id) =>
                app.state.objectives?.items?.find((item) => String(item.id) === String(id));
            const invalidCompletionControls = (app.state.objectives?.items || []).filter(
                (item) =>
                    !["player", "ai", "choice", "reward_only"].includes(
                        String(item.completion_control || "")
                            .trim()
                            .toLowerCase(),
                    ),
            );
            devAssert(
                !invalidCompletionControls.length,
                "Harem objectives use only supported completion controls",
                invalidCompletionControls.map((item) => ({
                    id: item.id,
                    completion_control: item.completion_control,
                })),
            );
            devAssert(
                objectiveCompletionControl(
                    objectiveById("prepare-the-vale-trip"),
                ) === "player" &&
                    objectiveCompletionControl(
                        objectiveById("recognize-the-need-for-sherry"),
                    ) === "player" &&
                    objectiveCompletionControl(objectiveById("defeat-the-bandits")) ===
                        "ai",
                "Harem objective controls distinguish player-initiated actions from narrator plot beats",
            );
            const completeObjectiveForTest = (id) => {
                const before = clone(app.state);
                const completed = completeCurrentObjective(app.state, id);
                const rewardResult = applyObjectiveProgressRewards(
                    before,
                    app.state,
                    "harem-objective-graph-smoke",
                    { silentGameMessage: true },
                );
                reconcileStoryRuntimeState(app.state, `harem test completed ${id}`);
                devAssert(!!completed || objectiveIsComplete(objectiveById(id)), `Objective can be completed: ${id}`, {
                    rewardResult,
                    objective: objectiveById(id),
                    current: currentObjectiveTarget(app.state),
                });
                return completed || objectiveById(id);
            };
            const completeAvailableMainChain = () => {
                let completedCount = 0;
                let guard = 0;
                let lastLoopState = null;
                const mainCount = () =>
                    (app.state.objectives?.items || []).filter((item) => !objectiveIsSide(item)).length;
                const incompleteMainItems = () =>
                    (app.state.objectives?.items || []).filter(
                        (item) => !objectiveIsSide(item) && !objectiveIsComplete(item),
                    );
                while (incompleteMainItems().length && guard < mainCount() + 20) {
                    guard += 1;
                    reconcileStoryRuntimeState(app.state, `harem graph loop ${guard}`);
                    const completedIds = completedObjectiveIds(app.state);
                    const target = incompleteMainItems().find(
                        (item) =>
                            !objectiveBlockedByExclusiveGroup(item, app.state) &&
                            objectiveRequiredIds(item).every((id) =>
                                completedIds.has(String(id)),
                            ),
                    );
                    devAssert(!!target, "Harem main chain has a selectable next objective", {
                        guard,
                        active_id: app.state.objectives?.active_id,
                        focus_id: app.state.objectives?.focus_id,
                        pending_choice: app.state.objectives?.pending_choice,
                        incomplete: incompleteMainItems()
                            .slice(0, 8)
                            .map((item) => ({
                                id: item.id,
                                status: item.status,
                                requires: item.requires,
                                blocked_reason: item.blocked_reason,
                            })),
                    });
                    target.status = /^(hidden|locked|future)$/i.test(String(target.status || ""))
                        ? "queued"
                        : target.status || "active";
                    target.available_now = true;
                    setObjectiveFocus(target.id);
                    completeObjectiveForTest(target.id);
                    completedCount += 1;
                    lastLoopState = {
                        guard,
                        completedCount,
                        completedId: target.id,
                        active_id: app.state.objectives?.active_id,
                        focus_id: app.state.objectives?.focus_id,
                        pending_choice: app.state.objectives?.pending_choice,
                        incompleteCount: incompleteMainItems().length,
                        incomplete: incompleteMainItems()
                            .slice(0, 10)
                            .map((item) => ({
                                id: item.id,
                                status: item.status,
                                requires: item.requires,
                                selectable: objectiveCanBeSelected(item, app.state),
                                shown: objectiveCanBeShown(item, app.state),
                                blocked_reason: item.blocked_reason,
                            })),
                    };
                    devTestLog("Harem objective graph loop", lastLoopState);
                }
                const incompleteMainDebug = incompleteMainItems().map((item) => ({
                        id: item.id,
                        title: item.title,
                        status: item.status,
                        requires: item.requires,
                        selectable: objectiveCanBeSelected(item, app.state),
                        blocked_reason: item.blocked_reason,
                    }));
                devAssert(guard < mainCount() + 20, `Harem main chain completion loop terminated: ${JSON.stringify(incompleteMainDebug.slice(0, 5))}`, {
                    guard,
                    mainCount: mainCount(),
                    lastLoopState,
                    incomplete: incompleteMainDebug,
                });
                return completedCount;
            };

            devAssert(
                currentObjectiveTarget(app.state)?.id === "leave-the-barn",
                "Harem objective graph starts at Leave the Barn",
                currentObjectiveTarget(app.state),
            );
            const mainCompleted = completeAvailableMainChain();
            const mainItems = (app.state.objectives?.items || []).filter(
                (item) => !objectiveIsSide(item),
            );
            const controlSet = new Set(
                (app.state.objectives?.items || []).map((item) =>
                    objectiveCompletionControl(item),
                ),
            );
            devAssert(
                controlSet.has("player") &&
                    controlSet.has("ai") &&
                    (app.state.objectives?.items || []).every((item) =>
                        ["player", "ai"].includes(objectiveCompletionControl(item)),
                    ),
                "Harem objectives include valid player and AI completion-control modes",
                [...controlSet],
            );
            const sideItemsNow = () =>
                (app.state.objectives?.items || []).filter(objectiveIsSide);
            devAssert(
                mainItems.length >= 15 && mainItems.every(objectiveIsComplete),
                "Harem main objective chain reaches 100% completion mechanically",
                {
                    mainCompleted,
                    mainCount: mainItems.length,
                    incomplete: mainItems.filter((item) => !objectiveIsComplete(item)),
                },
            );
            for (const side of sideItemsNow()) {
                if (!objectiveIsComplete(side) && objectiveCanBeSelected(side, app.state)) {
                    setObjectiveFocus(side.id);
                    completeObjectiveForTest(side.id);
                }
            }
            const incompleteSelectableSides = sideItemsNow().filter(
                (item) => !objectiveIsComplete(item) && objectiveCanBeSelected(item, app.state),
            );
            devAssert(
                !incompleteSelectableSides.length,
                "Harem selectable side objectives can be completed mechanically",
                incompleteSelectableSides,
            );
            devTestLog("Harem completion diagnostic", {
                pending: app.state.objectives?.pending_completion_message || null,
                lastObjective: app.lastObjectiveTransitionDiagnostic
                    ? {
                          ...app.lastObjectiveTransitionDiagnostic,
                          selectedObjectiveId:
                              app.lastObjectiveTransitionDiagnostic.objectiveId || "",
                      }
                    : null,
                finalObjective: mainItems[mainItems.length - 1]
                    ? {
                          id: mainItems[mainItems.length - 1].id,
                          selectedOutputId:
                              mainItems[mainItems.length - 1].selected_output_id || "",
                          outputs: (mainItems[mainItems.length - 1].next_objectives || []).map(
                              (output) => ({
                                  id: output?.id || "",
                                  objective_id: output?.objective_id || "",
                                  ending_type: output?.ending_type || "",
                                  ending_message: output?.ending_message || "",
                              }),
                          ),
                          selectedOutput: objectiveSelectedOutput(
                              mainItems[mainItems.length - 1],
                              app.state,
                          ),
                      }
                    : null,
                summary: JSON.stringify({
                    pending: app.state.objectives?.pending_completion_message || null,
                    lastObjective: app.lastObjectiveTransitionDiagnostic || null,
                    finalObjective: mainItems[mainItems.length - 1]
                        ? {
                              id: mainItems[mainItems.length - 1].id,
                              selectedOutputId:
                                  mainItems[mainItems.length - 1].selected_output_id || "",
                              outputs: mainItems[mainItems.length - 1].next_objectives || [],
                              selectedOutput: objectiveSelectedOutput(
                                  mainItems[mainItems.length - 1],
                                  app.state,
                              ),
                          }
                        : null,
                }),
                objectiveRuntime: app.objectiveRuntime || null,
            });
            devAssert(
                !!app.state.objectives?.pending_completion_message?.message,
                `Harem final main completion stores a completion popup message: ${JSON.stringify({
                    pending: app.state.objectives?.pending_completion_message || null,
                    lastObjective: app.lastObjectiveTransitionDiagnostic
                        ? {
                              objectiveId: app.lastObjectiveTransitionDiagnostic.objectiveId,
                              selectedOutputId:
                                  app.lastObjectiveTransitionDiagnostic.selectedOutputId,
                              selectedStandardOutputId:
                                  app.lastObjectiveTransitionDiagnostic.selectedStandardOutputId,
                              endingType: app.lastObjectiveTransitionDiagnostic.endingType,
                              outcomeIsTerminal:
                                  app.lastObjectiveTransitionDiagnostic.outcomeIsTerminal,
                              finalActiveId:
                                  app.lastObjectiveTransitionDiagnostic.finalActiveId,
                              finalNoCurrent:
                                  app.lastObjectiveTransitionDiagnostic.finalNoCurrent,
                          }
                        : null,
                    finalObjective: mainItems[mainItems.length - 1]
                        ? {
                              id: mainItems[mainItems.length - 1].id,
                              selectedOutputId:
                                  mainItems[mainItems.length - 1].selected_output_id || "",
                              outputs: mainItems[mainItems.length - 1].next_objectives || [],
                              selectedOutput: objectiveSelectedOutput(
                                  mainItems[mainItems.length - 1],
                                  app.state,
                              ),
                          }
                        : null,
                })}`,
                {
                    pending: app.state.objectives?.pending_completion_message,
                    lastObjective: app.lastObjectiveTransitionDiagnostic,
                    objectiveRuntime: app.objectiveRuntime,
                },
            );
            let finalPopup = {};
            let finalPopupText = "";
            const previousDevModeForCompletionPopup = !!app.settings.devMode;
            try {
                app.settings.devMode = false;
                document.querySelector("#issueDismissBtn")?.click();
                app.issuePopupOpen = false;
                document
                    .querySelectorAll(".popup-modal.open")
                    .forEach((node) => node.remove());
                if ($("modal")?.classList.contains("open")) closeModal();
                maybeOpenObjectiveCompletionModal();
                await new Promise((resolve) => setTimeout(resolve, 150));
                finalPopup = app.state.objectives?.pending_completion_message || {};
                finalPopupText =
                    document.querySelector(".popup-modal.open .modal-box")?.textContent ||
                    $("modalBox")?.textContent ||
                    "";
            } finally {
                app.settings.devMode = previousDevModeForCompletionPopup;
            }
            devAssert(
                !!finalPopupText &&
                    (!finalPopup.title || finalPopupText.includes(finalPopup.title)) &&
                    (!finalPopup.message ||
                        finalPopupText.includes(finalPopup.message.slice(0, 80))),
                "Harem final completion message is shown in a popup",
                {
                    expected: finalPopup,
                    modalText: finalPopupText,
                },
            );
            addMessage("system", "Harem objective graph smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: harem-objective-graph-smoke", {
                mainCount: mainItems.length,
                sideCount: sideItemsNow().length,
            });
        }

        async function devRunHaremObjectiveSchemaSmokeTest() {
            devTestLog("Scenario start: harem-objective-schema-smoke");
            devResetForLiveTest("harem-objective-schema-smoke");
            devCreateTestProfile({  });
            const template = await devImportHaremStoryForSmoke();
            const objectives = template.state?.objectives?.items || [];
            const futureCast = template.state?.future_cast?.items || {};
            const futureCastIds = new Set(Object.keys(futureCast).map((id) => String(id)));
            // Story-template invariant: objectives are the player-visible story
            // path plus private verifier fields. The old step/objective fields
            // must not come back because they leak developer wording and confuse
            // the current one-milestone objective system.
            const forbiddenObjectiveFields = [
                "objective",
                "steps",
                "current_step_id",
                "selected_step",
                "selected_step_id",
            ];
            const objectivesWithForbiddenFields = objectives
                .map((objective) => ({
                    id: objective.id,
                    fields: forbiddenObjectiveFields.filter((field) => field in objective),
                }))
                .filter((entry) => entry.fields.length);
            devAssert(
                !objectivesWithForbiddenFields.length,
                "Harem objectives do not use legacy objective/step fields",
                objectivesWithForbiddenFields,
            );
            const incompleteObjectiveShape = objectives.filter(
                (objective) =>
                    !textSlot(objective.id) ||
                    !textSlot(objective.title) ||
                    !textSlot(objective.summary) ||
                    !textSlot(objective.while_active_guidance) ||
                    !textSlot(objective.completion_criteria) ||
                    !["player", "ai", "choice", "reward_only"].includes(objectiveCompletionControl(objective)) ||
                    !Array.isArray(objective.requires || []),
            );
            devAssert(
                !incompleteObjectiveShape.length,
                "Every Harem objective has player-facing title/summary, required active guidance, and private completion criteria/control",
                incompleteObjectiveShape.map((objective) => ({
                    id: objective.id,
                    title: objective.title,
                    summary: objective.summary,
                    while_active_guidance: objective.while_active_guidance,
                    completion_control: objective.completion_control,
                    completion_criteria: objective.completion_criteria,
                    requires: objective.requires,
                })),
            );
            const developerWording = objectives.filter((objective) =>
                /\b(predefined character|completion criteria|verifier|ai-only|narrator-only)\b/i.test(
                    `${objective.title || ""} ${objective.summary || ""}`,
                ),
            );
            devAssert(
                !developerWording.length,
                "Harem visible objective titles/summaries are worded for the player, not the engine",
                developerWording.map((objective) => ({
                    id: objective.id,
                    title: objective.title,
                    summary: objective.summary,
                })),
            );
            const invalidRewardReferences = [];
            for (const objective of objectives) {
                for (const reward of objective.rewards || []) {
                    const ids = [
                        reward.character_id,
                        reward.future_character_id,
                        reward.npc_id,
                        ...(Array.isArray(reward.character_ids) ? reward.character_ids : []),
                        ...(Array.isArray(reward.future_character_ids)
                            ? reward.future_character_ids
                            : []),
                    ].filter(Boolean);
                    if (
                        /introduce_future_character|unlock_future_character/i.test(
                            String(reward.type || ""),
                        )
                    ) {
                        for (const id of ids) {
                            if (!futureCastIds.has(String(id)))
                                invalidRewardReferences.push({
                                    objectiveId: objective.id,
                                    rewardType: reward.type,
                                    missingId: id,
                                });
                        }
                    }
                }
            }
            devAssert(
                !invalidRewardReferences.length,
                "Harem character-introduction rewards reference known future-cast ids",
                invalidRewardReferences,
            );
            const worldMapNodes = Object.values(template.state?.world_map?.locations || {}).concat(
                template.state?.world_map?.visible_locations || [],
            );
            const taggedLocations = worldMapNodes.filter(
                (locationNode) => Array.isArray(locationNode?.tags) && locationNode.tags.length,
            );
            devAssert(
                !taggedLocations.length,
                "Harem world-map locations do not carry legacy tag arrays",
                taggedLocations.map((node) => ({ id: node.id, name: node.name, tags: node.tags })),
            );
            app.state = repairAiGeneratedState(clone(template.state));
            app.state.meta ||= {};
            app.state.meta.setup_complete = true;
            app.messages = clone(template.messages || []);
            addMessage("system", "Harem objective schema smoke test passed.");
            showNotice("Live Test Passed", "Harem objective schema smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: harem-objective-schema-smoke", {
                objectiveCount: objectives.length,
                futureCastCount: futureCastIds.size,
            });
        }

        async function devRunHaremObjectiveFlowReportSmokeTest() {
            devTestLog("Scenario start: harem-objective-flow-report");
            devResetForLiveTest("harem-objective-flow-report");

            const seedHaremState = async () => {
                const template = await devImportHaremStoryForSmoke();
                // SANITIZE KEEP (dev fixture): this report smoke loads a complete
                // Harem template so the captured objective prompts use real story data.
                app.state = repairAiGeneratedState(clone(template.state));
                app.state.meta ||= {};
                app.state.meta.setup_complete = true;
                app.messages = clone(template.messages || []);
                app.images = [];
                app.profileImages = [];
                await devCompileCurrentStoryFixture("harem-objective-flow-report");
                reconcileStoryRuntimeState(app.state, "harem objective flow report seed");
                scheduleActiveGameSave();
                render();
                return template;
            };
            const objectiveById = (id) =>
                app.state.objectives?.items?.find((item) => String(item.id) === String(id));
            const completeObjectiveForReport = (id) => {
                const objective = objectiveById(id);
                devAssert(!!objective, `Objective exists for report: ${id}`);
                objective.status = /^(hidden|locked|future)$/i.test(String(objective.status || ""))
                    ? "queued"
                    : objective.status || "active";
                objective.available_now = true;
                setObjectiveFocus(id);
                const before = clone(app.state);
                const completed = completeCurrentObjective(app.state, id);
                const rewardResult = applyObjectiveProgressRewards(
                    before,
                    app.state,
                    "harem-objective-flow-report",
                    { silentGameMessage: true },
                );
                reconcileStoryRuntimeState(app.state, `report completed ${id}`);
                return { completed: completed || objectiveById(id), rewardResult };
            };
            const completePrerequisitesForReport = (id, seen = new Set()) => {
                if (seen.has(id)) return;
                seen.add(id);
                const objective = objectiveById(id);
                devAssert(!!objective, `Objective exists before prerequisite walk: ${id}`);
                for (const req of objectiveRequiredIds(objective)) {
                    completePrerequisitesForReport(req, seen);
                    if (!objectiveIsComplete(objectiveById(req)))
                        completeObjectiveForReport(req);
                }
                reconcileStoryRuntimeState(app.state, `report prereqs ready for ${id}`);
            };
            const setObjectiveFlowReportScene = (targetId) => {
                // Report smoke completes prerequisites mechanically instead of
                // playing every scene, so set a plausible progressed context before
                // capturing prompts. This keeps the saved report useful without
                // changing runtime objective behavior.
                if (
                    targetId === "recognize-the-need-for-sherry" ||
                    targetId === "meet-sherry"
                ) {
                    app.state.location = {
                        ...(app.state.location || {}),
                        region: targetId === "meet-sherry" ? "Quratar" : "Quratar",
                        settlement_type: "city",
                        settlement_name: "Quratar",
                        district: targetId === "meet-sherry" ? "slave market district" : "home district",
                        specific_place:
                            targetId === "meet-sherry"
                                ? "inside a slave trader's office"
                                : "inside Michio's Quratar home",
                    };
                    app.state.scene ||= {};
                    app.state.scene.summary =
                        targetId === "meet-sherry"
                            ? "Michio and Roxanne have followed the need for knowledge and crafting help to a trader who can introduce a knowledgeable adult companion."
                            : "Michio and Roxanne have reached the point where language, crafting, and labyrinth knowledge gaps are blocking safer growth.";
                    app.state.scene.party_members_present = [];
                    app.state.scene.npcs_present = [];
                    assertRuntimeSceneReferences(app.state);
                } else if (targetId === "defeat-the-bandit-leader") {
                    app.state.location = {
                        ...(app.state.location || {}),
                        region: "Countryside near the first village",
                        settlement_type: "village",
                        settlement_name: "First Village",
                        district: "village center",
                        specific_place: "burning village square",
                    };
                    app.state.scene ||= {};
                    app.state.scene.summary =
                        "Michio has survived the first bandit clash, and the raid leader is exposed while the village fight reaches its decisive moment.";
                    app.state.scene.party_members_present = [];
                    app.state.scene.npcs_present = [];
                    assertRuntimeSceneReferences(app.state);
                }
            };
            const captureObjectiveCase = async ({
                targetId,
                playerText,
                verifierResponse,
                verifierResponses,
            }) => {
                await seedHaremState();
                completePrerequisitesForReport(targetId);
                setObjectiveFlowReportScene(targetId);
                const target = objectiveById(targetId);
                target.status = "active";
                target.available_now = true;
                setObjectiveFocus(targetId);
                const message = addMessage(
                    "user",
                    playerText,
                    app.state.player?.name || "Player",
                );
                const capturedAiCalls = [];
                const responses = Array.isArray(verifierResponses)
                    ? verifierResponses.map((item) => String(item))
                    : [String(verifierResponse ?? "")];
                let responseIndex = 0;
                const originalAiText = aiText;
                let result = null;
                try {
                    aiText = async (instruction, opts = {}) => {
                        capturedAiCalls.push({
                            label: opts.label || "",
                            logType: opts.logType || "",
                            messageId: opts.messageId || null,
                            instruction,
                        });
                        const response =
                            responses[Math.min(responseIndex, responses.length - 1)];
                        responseIndex += 1;
                        return response;
                    };
                    result = await runObjectiveCompletionPass({
                        source: "player",
                        text: playerText,
                        messageId: message.id,
                    });
                } finally {
                    aiText = originalAiText;
                }
                const directive = objectiveCompletionNarratorDirective(result);
                const previousDirective = app.currentReplyDirective;
                try {
                    app.currentReplyDirective = directive;
                    return {
                        target: objectiveForCompletionPrompt(target),
                        playerText,
                        verifierResponses: responses,
                        parsedStatuses: responses.map(
                            (response) => parseObjectiveCompletionResult(response).status,
                        ),
                        result,
                        objectiveCheckPrompt:
                            capturedAiCalls.find((call) =>
                                /objective check/i.test(call.label),
                            )?.instruction || "",
                        turnDirective: directive,
                        narratorPrompt: buildReplyInstruction("", {}),
                        gameMessages: app.messages
                            .filter((item) => item.role === "system" || item.speaker === "Game")
                            .map((item) => ({
                                speaker: item.speaker,
                                role: item.role,
                                text: item.text,
                            })),
                        currentObjective: currentObjectiveTarget(app.state),
                    };
                } finally {
                    app.currentReplyDirective = previousDirective;
                }
            };

            const noUnlock = await captureObjectiveCase({
                targetId: "recognize-the-need-for-sherry",
                playerText:
                    "Roxanne and I need someone with better language, crafting, and labyrinth knowledge before we push deeper.",
                verifierResponse: "yes",
            });
            const withCharacterUnlock = await captureObjectiveCase({
                targetId: "meet-sherry",
                playerText:
                    "I meet the knowledgeable adult woman the trader mentioned and ask about her debt, skills, and why she would matter to the party.",
                verifierResponse: "yes",
            });
            const aiControlledPlotPoint = await captureObjectiveCase({
                targetId: "defeat-the-bandit-leader",
                playerText:
                    "I press the opening while the bandit leader is exposed and the villagers are running for cover.",
                verifierResponse: "yes",
            });
            const incomplete = await captureObjectiveCase({
                targetId: "meet-sherry",
                playerText:
                    "I talk about maybe finding a knowledgeable helper later, but decide not to meet anyone yet.",
                verifierResponse: "no",
            });
            const malformed = await captureObjectiveCase({
                targetId: "meet-sherry",
                playerText: "I make an unclear comment about gear.",
                verifierResponses: ["{\"answer\":\"maybe\"}", "no"],
            });
            devAssert(
                !("objective" in (withCharacterUnlock.target || {})) &&
                    !/"objective"\s*:/.test(withCharacterUnlock.objectiveCheckPrompt) &&
                    !/"objective"\s*:/.test(withCharacterUnlock.narratorPrompt),
                "objective flow prompts use summary/completion fields and do not reintroduce the legacy objective key",
                {
                    target: withCharacterUnlock.target,
                    objectiveCheckPromptExcerpt:
                        withCharacterUnlock.objectiveCheckPrompt.slice(0, 1400),
                    narratorPromptExcerpt:
                        withCharacterUnlock.narratorPrompt.slice(0, 1400),
                },
            );

            const report = [
                "# Synthetic Objective Flow Report",
                "",
                `Generated: ${new Date().toISOString()}`,
                "",
                "Report note: prerequisites are completed mechanically by the smoke test, then the scene/location fixture is set to a plausible progressed fake context before capturing the exact prompts.",
                "",
                "## Player-Controlled Objective Check Prompt: Future Character Unlock Objective",
                "",
                "```text",
                withCharacterUnlock.objectiveCheckPrompt,
                "```",
                "",
                "## AI-Controlled Plot-Point Check Prompt: Bandit Leader",
                "",
                "```text",
                aiControlledPlotPoint.objectiveCheckPrompt,
                "```",
                "",
                "## Non-yes/no Objective Checker Retry",
                "",
                "This is a synthetic bad-response case. The first verifier response is forced to be invalid, and the engine asks again instead of treating it as `no`.",
                "",
                "Forced verifier responses:",
                "```text",
                malformed.verifierResponses.join("\n--- retry ---\n"),
                "```",
                `Parsed statuses: ${malformed.parsedStatuses.join(", ")}`,
                `Final result status: ${malformed.result?.checked ? malformed.result?.completed ? "objective_complete" : "no_change" : "no result"}`,
                "",
                "## Narrator Prompt Modification: Objective Complete, No Character Unlock",
                "",
                "TURN DIRECTIVE:",
                "```text",
                noUnlock.turnDirective || "(empty)",
                "```",
                "Full narrator prompt excerpt around TURN DIRECTIVE:",
                "```text",
                objectiveFlowPromptExcerpt(noUnlock.narratorPrompt),
                "```",
                "",
                "## Narrator Prompt Modification: Sherry Character Unlock",
                "",
                "TURN DIRECTIVE:",
                "```text",
                withCharacterUnlock.turnDirective || "(empty)",
                "```",
                "Full narrator prompt excerpt around TURN DIRECTIVE:",
                "```text",
                objectiveFlowPromptExcerpt(withCharacterUnlock.narratorPrompt),
                "```",
                "",
                "## Narrator Prompt Modification: AI-Controlled Plot Point",
                "",
                "TURN DIRECTIVE:",
                "```text",
                aiControlledPlotPoint.turnDirective || "(empty)",
                "```",
                "Full narrator prompt excerpt around TURN DIRECTIVE:",
                "```text",
                objectiveFlowPromptExcerpt(aiControlledPlotPoint.narratorPrompt),
                "```",
                "",
                "## Objective Not Completed",
                "",
                `Parsed status: ${incomplete.parsedStatuses.join(", ")}`,
                "TURN DIRECTIVE:",
                "```text",
                incomplete.turnDirective || "(empty)",
                "```",
                "Full narrator prompt excerpt around where TURN DIRECTIVE would appear:",
                "```text",
                objectiveFlowPromptExcerpt(incomplete.narratorPrompt),
                "```",
            ].join("\n");
            app.debugObjectiveFlowReport = report;
            let savedReportPath = "";
            try {
                const response = await fetch("/__emberadventures_test_output", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileName: "harem-objective-flow-report.md",
                        content: report,
                    }),
                });
                const saved = await response.json().catch(() => null);
                if (response.ok && saved?.ok) savedReportPath = saved.path || "";
            } catch (err) {
                devTestLog("Objective flow report file save failed", {
                    error: err.message || String(err),
                });
            }
            const reportStorageKey = "emberadventureslite-objective-flow-report";
            const previousReport = localStorage.getItem(reportStorageKey);
            try {
                localStorage.setItem(reportStorageKey, report);
                openModal(`
                    <h2>Synthetic Objective Flow Report</h2>
                    <p class="hint">This report was generated from a fake smoke story template and current objective/reward/directive code.${savedReportPath ? ` Saved to ${escapeHtml(savedReportPath)}.` : " File save unavailable; copy the report below before closing this window."}</p>
                    <textarea class="json-editor" readonly>${escapeHtml(report)}</textarea>
                    <button class="primary" onclick="navigator.clipboard?.writeText(this.parentElement.querySelector('textarea')?.value || '')">Copy Report</button>
                    <button onclick="EmberAdventures.closeModal()">Close</button>
                `);
                addMessage("system", "Harem objective flow report smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: harem-objective-flow-report");
            } finally {
                if (previousReport === null)
                    localStorage.removeItem(reportStorageKey);
                else
                    localStorage.setItem(reportStorageKey, previousReport);
            }
        }

        function objectiveFlowPromptExcerpt(prompt = "") {
            const text = String(prompt || "");
            const marker = "TURN DIRECTIVE:";
            const index = text.indexOf(marker);
            if (index >= 0)
                return text.slice(Math.max(0, index - 600), Math.min(text.length, index + 1800));
            const fallback = "CHAT SINCE STATE WAS LAST UPDATED:";
            const fallbackIndex = text.indexOf(fallback);
            if (fallbackIndex >= 0)
                return text.slice(
                    Math.max(0, fallbackIndex - 600),
                    Math.min(text.length, fallbackIndex + 1400),
                );
            return text.slice(0, 2200);
        }

        async function devRunImageProfileIsolationSmokeTest() {
            devTestLog("Scenario start: image-profile-isolation-smoke");
            devResetForLiveTest("image-profile-isolation-smoke");
            devCreateTestProfile({  });
            const previousTextToImagePlugin = globalThis.textToImagePlugin;
            globalThis.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({
                    dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                }),
            });
            try {
                // SANITIZE KEEP (dev fixture): synthetic image/profile isolation state setup.
                // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Image Profile Isolation Smoke",
                        },
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        id: "profile-trigger-player",
                        name: "Image Isolation Tester",
                        age: 30,
                        gender: "non-male",
                        role: "image tester",
                        personality_description: "Tests image record separation.",
                        image: {
                            appearance: "silver hair, green travel cloak",
                            seed_enabled: true,
                            seed: 13579,
                        },
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "A lantern-lit image isolation test.",
                        party_members_present: ["Player"],
                        image_characters: ["Player"],
                        image_action: "standing near a lantern",
                    },
                    objectives: {
                        active_id: "image-profile-isolation",
                        items: [
                            {
                                id: "image-profile-isolation",
                                title: "Verify Image Isolation",
                                type: "story",
                                status: "active",
                                summary: "Keep scene images and profile images separate.",
                                objective: "Generate one scene image and one profile image.",
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
                        text: "Image/profile isolation smoke test ready.",
                        at: new Date().toISOString(),
                    },
                ];
                scheduleActiveGameSave();
                render();

                const inheritedProfile = rememberProfileImage("Player", {
                    id: "normal-image-seed-profile",
                    source: "seed inheritance smoke",
                    seed: 246810,
                    prompt: "seed inheritance profile",
                    html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Seed inheritance profile">`,
                    profile: true,
                    pending: false,
                });
                await generateImage("isolation smoke", { targets: ["Player"] });
                await devWaitFor(
                    () => devLooksLikeRealImageHtml(app.images?.[0]?.html),
                    5000,
                    "scene image html to be stored",
                );
                const sceneImageId = String(app.images?.[0]?.id || "");
                devAssert(
                    inheritedProfile?.seed === 246810 && app.images?.[0]?.seed === 246810,
                    "single-character normal image inherits the active profile image seed",
                    {
                        profileSeed: inheritedProfile?.seed,
                        configuredSeed: app.state.player.image?.seed,
                        normalImageSeed: app.images?.[0]?.seed,
                    },
                );
                await generateProfileImage("Player", {
                    manual: true,
                    randomSeed: true,
                    reason: "isolation smoke profile",
                });
                const activeProfile = activeProfileImage(app.state.player);
                devAssert(
                    sceneImageId &&
                        app.images.length === 1 &&
                        devLooksLikeRealImageHtml(app.images[0].html),
                    "normal scene image exists in scene image store",
                    app.images,
                );
                devAssert(
                    activeProfile?.id &&
                        String(activeProfile.id) !== sceneImageId &&
                        devLooksLikeRealImageHtml(activeProfile.html),
                    "profile image exists separately from normal scene image",
                    {
                        sceneImageId,
                        activeProfile,
                        profileImages: profileImagesForEntity(app.state.player),
                    },
                );
                devAssert(
                !profileImagesForEntity(app.state.player).some(
                    (image) => String(image.id) === sceneImageId,
                ),
                "normal scene image was not copied into profile image records",
                profileImagesForEntity(app.state.player),
            );
            setLeftPanelGroup("characters");
            const playerCard = document.querySelector(
                '[data-character-action="profile"][data-character-name="Player"]',
            );
                devAssert(
                    devLooksLikeRealImageHtml(playerCard?.innerHTML || ""),
                    "player card displays active profile image without using scene image record",
                    playerCard?.innerHTML || "",
                );
                await flushActiveGameSave();
                const storedState = stateForStorage(app.state);
                const storedProfiles = profileImagesForState(storedState, app.profileImages);
                devAssert(
                    storedProfiles.some(
                        (image) => String(image.id) === String(activeProfile.id),
                    ) &&
                        !storedProfiles.some(
                            (image) => String(image.id) === sceneImageId,
                        ),
                    "stored state references active profile image but not normal scene image",
                    { storedProfiles, sceneImageId },
                );
                const originalShowConfirm = showConfirm;
                showConfirm = async () => true;
                try {
                    await deleteProfileImage("Player", inheritedProfile.id);
                } finally {
                    showConfirm = originalShowConfirm;
                }
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                devAssert(
                    !profileImagesForEntity(app.state.player).some(
                        (image) => String(image.id) === String(inheritedProfile.id),
                    ) &&
                        !(await app.persistence.getRecord(
                            "characterProfileImages",
                            inheritedProfile.id,
                        )),
                    "public profile-image deletion removes the selected record without throwing",
                    {
                        deletedId: inheritedProfile.id,
                        remainingIds: profileImagesForEntity(app.state.player).map(
                            (image) => image.id,
                        ),
                    },
                );
                addMessage("system", "Image/profile isolation smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: image-profile-isolation-smoke");
            } finally {
                if (typeof previousTextToImagePlugin === "undefined")
                    delete globalThis.textToImagePlugin;
                else globalThis.textToImagePlugin = previousTextToImagePlugin;
            }
        }

        async function devRunProfileImageTriggerSmokeTest() {
            devTestLog("Scenario start: profile-image-trigger-smoke");
            devResetForLiveTest("profile-image-trigger-smoke");
            devCreateTestProfile({  });
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
            const originalQueueProfileImage = queueProfileImage;
            const profileQueueRequestCounts = new Map();
            queueProfileImage = (name, options = {}) => {
                const ownerKey = profileImageOwnerKey(name, profileEntity(name));
                profileQueueRequestCounts.set(
                    ownerKey,
                    (profileQueueRequestCounts.get(ownerKey) || 0) + 1,
                );
                return originalQueueProfileImage(name, options);
            };
            const smokeImageHtml =
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Profile trigger smoke image">`;
            pluginOverrides.textToImagePlugin = () => {
                return {
                    onFinishPromise: Promise.resolve({
                        dataUrl:
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                    }),
                };
            };
            try {
                // Smoke invariant: profile image auto-generation is targeted.
                // Importing/adding one missing character must not regenerate the
                // player or existing portraits; large import skips stay skipped
                // until that character actually enters the scene.
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Profile Trigger Smoke",
                        },
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        id: "profile-trigger-player",
                        name: "Profile Trigger Tester",
                        age: 26,
                        gender: "female",
                        role: "tester",
                        profile_image_id: "player-profile-existing",
                        profile_images: [
                            {
                                id: "player-profile-existing",
                                at: new Date().toISOString(),
                                favorite: true,
                                male: false,
                            },
                        ],
                    },
                    characters: {
                        "Existing Ally": {
                            ...blankCharacterTemplate("Existing Ally"),
                            id: "profile-trigger-existing-ally",
                            age: 28,
                            gender: "female",
                            role: "existing ally",
                            profile_image_id: "existing-ally-profile",
                            profile_images: [
                                {
                                    id: "existing-ally-profile",
                                    at: new Date().toISOString(),
                                    favorite: true,
                                    male: false,
                                },
                            ],
                        },
                        "Imported New": {
                            ...blankCharacterTemplate("Imported New"),
                            id: "profile-trigger-imported-new",
                            age: 29,
                            gender: "female",
                            role: "new import",
                            profile_image_auto_skip: true,
                        },
                        "Bulk Skipped": {
                            ...blankCharacterTemplate("Bulk Skipped"),
                            id: "profile-trigger-bulk-skipped",
                            age: 30,
                            gender: "female",
                            role: "bulk import",
                            profile_image_auto_skip: true,
                        },
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: ["Existing Ally"],
                        npcs_present: [],
                        image_characters: ["Player", "Existing Ally"],
                    },
                });
                app.profileImages = exactProfileImageStore([
                    createProfileImageRecord({
                        id: "player-profile-existing",
                        character_id: app.state.player.id,
                        owner_name: "Player",
                        male: false,
                        source: "smoke",
                        model: "default",
                        seed: 101,
                        prompt: "existing player portrait",
                        html: smokeImageHtml,
                        favorite: true,
                    }),
                    createProfileImageRecord({
                        id: "existing-ally-profile",
                        character_id: app.state.characters["Existing Ally"].id,
                        owner_name: "Existing Ally",
                        male: false,
                        source: "smoke",
                        model: "default",
                        seed: 102,
                        prompt: "existing ally portrait",
                        html: smokeImageHtml,
                        favorite: true,
                    }),
                ]);
                const reloadedStoryPlayer = {
                    ...blankCharacterTemplate("Silas Dorne"),
                    id: "silas-dorne",
                    name: "Silas Dorne",
                    gender: "male",
                };
                const reloadedSharedProfile = exactProfileImageStore([
                    createProfileImageRecord({
                        id: "silas-dorne-shared-profile",
                        character_id: "silas-dorne",
                        owner_name: "silas-dorne",
                        male: true,
                        source: "normalized reload smoke",
                        html: smokeImageHtml,
                    }),
                ])[0];
                app.profileImages.push(reloadedSharedProfile);
                app.profileEntityOverrides ||= {};
                app.profileEntityOverrides[reloadedStoryPlayer.name] =
                    reloadedStoryPlayer;
                const queuedReloadedStoryPlayer = queueProfileImageIfMissing(
                    reloadedStoryPlayer.name,
                    "player select option",
                );
                devAssert(
                    reloadedSharedProfile.character_id === "silas-dorne" &&
                        activeProfileImage(reloadedStoryPlayer)?.id ===
                            "silas-dorne-shared-profile" &&
                        queuedReloadedStoryPlayer === false,
                    "a shared story-player profile image reconnects by stable character id after normalized reload and does not regenerate",
                    {
                        reloadedSharedProfile,
                        active: activeProfileImage(reloadedStoryPlayer),
                        queuedReloadedStoryPlayer,
                    },
                );
                app.messages = [];
                scheduleActiveGameSave();
                render();

                queueProfileImagesForNames(
                    ["Player", "Existing Ally", "Imported New", "Bulk Skipped"],
                    "character import",
                );
                devAssert(
                    activeProfileImage(app.state.player)?.id ===
                        "player-profile-existing" &&
                        activeProfileImage(app.state.characters["Existing Ally"])?.id ===
                            "existing-ally-profile" &&
                        !activeProfileImage(app.state.characters["Imported New"]) &&
                        !activeProfileImage(app.state.characters["Bulk Skipped"]) &&
                        !app.profileImageQueue?.length &&
                        !app.profileImageQueued?.size &&
                        !app.profileImageGenerating?.size,
                    "import profile trigger preserves existing portraits and defers missing imports",
                    {
                        playerProfile: activeProfileImage(app.state.player),
                        existingProfile: activeProfileImage(
                            app.state.characters["Existing Ally"],
                        ),
                        importedProfile: activeProfileImage(
                            app.state.characters["Imported New"],
                        ),
                        skippedProfile: activeProfileImage(
                            app.state.characters["Bulk Skipped"],
                        ),
                        queue: app.profileImageQueue?.map?.((item) => item?.name),
                        queued: [...(app.profileImageQueued || new Set())],
                        generating: [...(app.profileImageGenerating || new Set())],
                    },
                );

                // A gender presentation can change the display name while the
                // runtime scene still contains the authored name. Profile image
                // queueing and live DOM updates must follow the stable character
                // id through that transition.
                const presentationSwapKey = "Daniel Mercer";
                const presentationSwapCharacter = {
                    ...blankCharacterTemplate("Danielle Mercer"),
                    id: "daniel-mercer",
                    name: "Danielle Mercer",
                    age: 28,
                    gender: "female",
                    role: "presentation swap smoke",
                    profile_image_auto_skip: true,
                };
                app.state.characters[presentationSwapKey] = presentationSwapCharacter;
                app.state.scene.party_members_present = [
                    ...(app.state.scene.party_members_present || []),
                    presentationSwapKey,
                ];
                app.state.scene.image_characters = [
                    ...(app.state.scene.image_characters || []),
                    presentationSwapKey,
                ];
                renderCharacters();
                const presentationSwapOwnerKey = profileImageOwnerKey(
                    presentationSwapKey,
                    presentationSwapCharacter,
                );
                const presentationSwapQueued = queueProfileImage(
                    presentationSwapKey,
                    {
                        reason: "presentation swap live image smoke",
                        allowDuringSmoke: true,
                        allowImportSkipped: true,
                    },
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(presentationSwapCharacter);
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "gender-swapped in-game profile image to finish and render",
                );
                const presentationSwapCard = document.querySelector(
                    '[data-character-id="daniel-mercer"]',
                );
                devAssert(
                    presentationSwapOwnerKey === "daniel-mercer|non_male" &&
                        presentationSwapQueued === true &&
                        presentationSwapCharacter.profile_image_id ===
                            activeProfileImage(presentationSwapCharacter)?.id &&
                        presentationSwapCard?.textContent?.includes("Danielle Mercer") &&
                        devLooksLikeRealImageHtml(
                            presentationSwapCard?.querySelector(
                                '[data-profile-live-id]',
                            )?.innerHTML || "",
                        ),
                    "gender-swapped in-game characters use stable ids for profile ownership and live image rendering",
                    {
                        presentationSwapOwnerKey,
                        presentationSwapQueued,
                        character: presentationSwapCharacter,
                        cardHtml: presentationSwapCard?.outerHTML || "",
                        queued: [...(app.profileImageQueued || new Set())],
                        generating: [...(app.profileImageGenerating || new Set())],
                    },
                );
                delete app.state.characters[presentationSwapKey];
                app.state.scene.party_members_present = (
                    app.state.scene.party_members_present || []
                ).filter((name) => name !== presentationSwapKey);
                app.state.scene.image_characters = (
                    app.state.scene.image_characters || []
                ).filter((name) => name !== presentationSwapKey);
                renderCharacters();

                app.state.characters["Startup Active"] = {
                    ...blankCharacterTemplate("Startup Active"),
                    id: "startup-active",
                    age: 31,
                    gender: "female",
                    role: "active startup cast",
                    profile_image_auto_skip: true,
                };
                app.state.characters["Startup Inactive"] = {
                    ...blankCharacterTemplate("Startup Inactive"),
                    id: "startup-inactive",
                    age: 32,
                    gender: "female",
                    role: "inactive startup cast",
                    profile_image_auto_skip: true,
                };
                app.state.scene.party_members_present = [
                    "Existing Ally",
                    "Startup Active",
                ];
                app.state.scene.image_characters = [
                    app.state.player.name,
                    "Existing Ally",
                    "Startup Active",
                ];
                app.profileImagesBootstrapped = false;
                const startupActiveImageCountBefore =
                    profileImagesForEntity(app.state.characters["Startup Active"]).length;
                const startupActiveOwnerKey = profileImageOwnerKey(
                    "Startup Active",
                    app.state.characters["Startup Active"],
                );
                const startupQueueCountBefore =
                    profileQueueRequestCounts.get(startupActiveOwnerKey) || 0;
                continueStartupFlow();
                await devWaitFor(
                    () =>
                        activeProfileImage(app.state.characters["Startup Active"])?.source ===
                        "generated",
                    5000,
                    "startup active cast first profile image to generate",
                );
                const startupActiveImageCountAfter =
                    profileImagesForEntity(app.state.characters["Startup Active"]).length;
                const startupQueueCountAfter =
                    profileQueueRequestCounts.get(startupActiveOwnerKey) || 0;
                continueStartupFlow();
                await new Promise((resolve) => setTimeout(resolve, 50));
                const startupQueueCountAfterRepeat =
                    profileQueueRequestCounts.get(startupActiveOwnerKey) || 0;
                devAssert(
                    startupActiveImageCountAfter === startupActiveImageCountBefore + 1 &&
                        startupQueueCountAfter === startupQueueCountBefore + 1 &&
                        startupQueueCountAfterRepeat === startupQueueCountAfter &&
                        profileImagesForEntity(app.state.characters["Startup Active"])
                            .length === startupActiveImageCountAfter &&
                        !app.state.characters["Startup Active"].profile_image_auto_skip &&
                        !!app.state.characters["Startup Inactive"].profile_image_auto_skip &&
                        !activeProfileImage(app.state.characters["Startup Inactive"]) &&
                        activeProfileImage(app.state.characters["Existing Ally"])?.id ===
                            "existing-ally-profile",
                    "startup profile scan generates only missing active-cast first portraits, preserves existing portraits, and does not repeat after bootstrapping",
                    {
                        startupActiveImageCountBefore,
                        startupActiveImageCountAfter,
                        startupQueueCountBefore,
                        startupQueueCountAfter,
                        startupQueueCountAfterRepeat,
                        activeProfile: activeProfileImage(
                            app.state.characters["Startup Active"],
                        ),
                        inactiveProfile: activeProfileImage(
                            app.state.characters["Startup Inactive"],
                        ),
                        existingProfile: activeProfileImage(
                            app.state.characters["Existing Ally"],
                        ),
                    },
                );

                app.state.scene.party_members_present = (
                    app.state.scene.party_members_present || []
                ).filter((name) => name !== "Bulk Skipped");
                togglePresence("Bulk Skipped");
                await devWaitFor(
                    () =>
                        activeProfileImage(app.state.characters["Bulk Skipped"])?.source ===
                        "generated",
                    5000,
                    "scene-added skipped character first profile image to generate",
                );
                devAssert(
                    !app.state.characters["Bulk Skipped"].profile_image_auto_skip &&
                        !!activeProfileImage(app.state.characters["Bulk Skipped"]) &&
                        !app.images.some((image) =>
                            /Bulk Skipped entered scene/i.test(
                                `${image.reason || ""}\n${image.prompt || ""}`,
                            ),
                        ),
                    "scene addition clears import skip and generates the missing first profile image without replacing existing portraits",
                    {
                        skippedCharacter: app.state.characters["Bulk Skipped"],
                        skippedProfile: activeProfileImage(
                            app.state.characters["Bulk Skipped"],
                        ),
                    },
                );

                app.state.npc_directory ||= { locations: {} };
                app.state.npc_directory.locations["Speaker Hall"] = {
                    label: "Speaker Hall",
                    characters: {
                        "Mara Speaker": {
                            id: "mara-speaker",
                            name: "Mara Speaker",
                            gender: "female",
                            age: 34,
                            role: "guild registrar",
                            inspected: true,
                            status: "active",
                            full_character: materializeCharacterForRuntime(
                                {
                                    ...blankCharacterTemplate("Mara Speaker"),
                                    id: "mara-speaker",
                                    name: "Mara Speaker",
                                    age: 34,
                                    gender: "female",
                                    role: "guild registrar",
                                },
                                "Mara Speaker",
                            ),
                        },
                    },
                };
                app.state.scene.npcs_present = (
                    app.state.scene.npcs_present || []
                ).filter((name) => name !== "Mara Speaker");
                const speakerMessageId = "profile-speaker-entry-message";
                addMessage(
                    "assistant",
                    '(Mara Speaker) "Credentials on the desk, please."',
                    "Narrator",
                    {
                    id: speakerMessageId,
                    stateSyncStatus: "",
                    },
                );
                const maraProfileIdsBefore = new Set(
                    profileImagesForEntity(
                        app.state.npc_directory.locations["Speaker Hall"].characters[
                            "Mara Speaker"
                        ].full_character,
                    ).map((image) => String(image.id)),
                );
                applyAssistantMessageMetadata(
                    speakerMessageId,
                    {
                        voiceComplete: true,
                        speak: { A: "Mara Speaker" },
                        newSpeakers: {},
                    },
                    { save: false },
                );
                await devWaitFor(
                    () =>
                        activeProfileImage(
                            app.state.npc_directory.locations["Speaker Hall"]
                                .characters["Mara Speaker"].full_character,
                        )?.source === "generated",
                    5000,
                    "known inspected NPC introduced by assistant speaker metadata to generate a profile image",
                );
                const maraProfileIdsAfter = new Set(
                    profileImagesForEntity(
                        app.state.npc_directory.locations["Speaker Hall"].characters[
                            "Mara Speaker"
                        ].full_character,
                    ).map((image) => String(image.id)),
                );
                applyAssistantMessageMetadata(
                    speakerMessageId,
                    {
                        voiceComplete: true,
                        speak: { A: "Mara Speaker" },
                        newSpeakers: {},
                    },
                    { save: false },
                );
                await new Promise((resolve) => setTimeout(resolve, 50));
                const maraProfileIdsAfterRepeat = new Set(
                    profileImagesForEntity(
                        app.state.npc_directory.locations["Speaker Hall"].characters[
                            "Mara Speaker"
                        ].full_character,
                    ).map((image) => String(image.id)),
                );
                devAssert(
                    app.state.scene.npcs_present.includes("Mara Speaker") &&
                        maraProfileIdsAfter.size === maraProfileIdsBefore.size + 1 &&
                        maraProfileIdsAfterRepeat.size === maraProfileIdsAfter.size &&
                        [...maraProfileIdsAfterRepeat].every((id) =>
                            maraProfileIdsAfter.has(id),
                        ) &&
                        !!activeProfileImage(
                            app.state.npc_directory.locations["Speaker Hall"]
                                .characters["Mara Speaker"].full_character,
                        ),
                    "assistant speaker metadata adds an existing inspected NPC to the scene and automatically generates exactly one missing profile image",
                    {
                        scene: app.state.scene,
                        maraProfileIdsBefore: [...maraProfileIdsBefore],
                        maraProfileIdsAfter: [...maraProfileIdsAfter],
                        maraProfileIdsAfterRepeat: [...maraProfileIdsAfterRepeat],
                        profile: activeProfileImage(
                            app.state.npc_directory.locations["Speaker Hall"]
                                .characters["Mara Speaker"].full_character,
                        ),
                    },
                );

                app.state.npc_directory.locations["Speaker Hall"].characters[
                    "Helene Watchdog"
                ] = {
                    id: "helene-watchdog",
                    name: "Helene Watchdog",
                    gender: "female",
                    age: 31,
                    role: "palace maid",
                    inspected: true,
                    status: "active",
                    full_character: materializeCharacterForRuntime(
                        {
                            ...blankCharacterTemplate("Helene Watchdog"),
                            id: "helene-watchdog",
                            name: "Helene Watchdog",
                            age: 31,
                            gender: "female",
                            role: "palace maid",
                        },
                        "Helene Watchdog",
                    ),
                };
                app.state.scene.npcs_present = [
                    ...new Set([
                        ...(app.state.scene.npcs_present || []),
                        "Helene Watchdog",
                    ]),
                ];
                const heleneWatchdogEntity =
                    app.state.npc_directory.locations["Speaker Hall"].characters[
                        "Helene Watchdog"
                    ].full_character;
                const heleneWatchdogOwnerKey = profileImageOwnerKey(
                    "Helene Watchdog",
                    heleneWatchdogEntity,
                );
                const heleneWatchdogQueueBefore =
                    profileQueueRequestCounts.get(heleneWatchdogOwnerKey) || 0;
                app.mainMenuOpen = false;
                const heleneWatchdogQueued =
                    queueMissingProfileImagesForSceneCards(
                        "scene card profile watchdog",
                        { allowDuringSmoke: true },
                    );
                await devWaitFor(
                    () =>
                        activeProfileImage(heleneWatchdogEntity)?.source ===
                        "generated",
                    5000,
                    "left-card scene profile watchdog to generate an already-visible NPC profile image",
                );
                const heleneWatchdogQueueAfter =
                    profileQueueRequestCounts.get(heleneWatchdogOwnerKey) || 0;
                queueMissingProfileImagesForSceneCards(
                    "scene card profile watchdog",
                    { allowDuringSmoke: true },
                );
                await new Promise((resolve) => setTimeout(resolve, 50));
                devAssert(
                    heleneWatchdogQueued === 1 &&
                        heleneWatchdogQueueAfter === heleneWatchdogQueueBefore + 1 &&
                        (profileQueueRequestCounts.get(heleneWatchdogOwnerKey) || 0) ===
                            heleneWatchdogQueueAfter &&
                        !!activeProfileImage(heleneWatchdogEntity),
                    "left-card scene profile watchdog generates exactly one missing profile image for an already-visible inspected NPC",
                    {
                        queued: heleneWatchdogQueued,
                        queueBefore: heleneWatchdogQueueBefore,
                        queueAfter: heleneWatchdogQueueAfter,
                        profile: activeProfileImage(heleneWatchdogEntity),
                    },
                );

                const newSpeakerMessageId = "profile-new-speaker-entry-message";
                addMessage(
                    "assistant",
                    '(Tessa Preview) "The east gate is still open."',
                    "Narrator",
                    {
                    id: newSpeakerMessageId,
                    stateSyncStatus: "",
                    },
                );
                const newSpeakerProfileIdsBefore = new Set(
                    [],
                );
                applyAssistantMessageMetadata(
                    newSpeakerMessageId,
                    {
                        voiceComplete: true,
                        speak: { A: "Tessa Preview" },
                        newSpeakers: {
                            A: {
                                name: "Tessa Preview",
                                gender: "female",
                                age: 29,
                                role: "gate runner",
                                appearance: "short black hair and a green courier coat",
                            },
                        },
                    },
                    { save: false },
                );
                await devWaitFor(
                    () => {
                        const ownerKey = profileImageOwnerKey("Tessa Preview");
                        return (
                            !app.profileImageQueued.has(ownerKey) &&
                            !app.profileImageGenerating.has(ownerKey)
                        );
                    },
                    5000,
                    "new NPC speaker metadata gameplay path to finish its preview profile image request",
                );
                const tessaNpc = getNpcEntry("Tessa Preview");
                const tessaEntity = profileEntity("Tessa Preview");
                const tessaProfile = activeProfileImage(tessaEntity);
                devAssert(
                    tessaNpc &&
                        tessaEntity === tessaNpc &&
                        tessaProfile?.pending === false &&
                        !tessaProfile?.error &&
                        devLooksLikeRealImageHtml(tessaProfile?.html),
                    `new NPC speaker metadata gameplay path stores its preview profile image on the authoritative NPC shell; invalidName=${JSON.stringify(isInvalidNpcName("Tessa Preview"))} reserved=${JSON.stringify(isReservedStateLabelName("Tessa Preview"))} future=${JSON.stringify(isFutureCastName("Tessa Preview"))} party=${JSON.stringify(isPartyCharacterName("Tessa Preview"))} duplicate=${JSON.stringify(findDuplicateNonNpcPersonName("Tessa Preview"))} npc=${JSON.stringify({ id: tessaNpc?.id, inspected: tessaNpc?.inspected, hasFull: !!tessaNpc?.full_character })} entityMatches=${JSON.stringify(tessaEntity === tessaNpc)} profile=${JSON.stringify(tessaProfile)} matchingStoreImages=${JSON.stringify((app.profileImages || []).filter((image) => image.character_id === tessaNpc?.id))}`,
                );
                const newSpeakerProfileIdsAfter = new Set(
                    profileImagesForEntity(getNpcEntry("Tessa Preview")).map((image) =>
                        String(image.id),
                    ),
                );
                applyAssistantMessageMetadata(
                    newSpeakerMessageId,
                    {
                        voiceComplete: true,
                        speak: { A: "Tessa Preview" },
                        newSpeakers: {},
                    },
                    { save: false },
                );
                await new Promise((resolve) => setTimeout(resolve, 50));
                const newSpeakerProfile = activeProfileImage(
                    getNpcEntry("Tessa Preview"),
                );
                const newSpeakerProfileIdsAfterRepeat = new Set(
                    profileImagesForEntity(getNpcEntry("Tessa Preview")).map((image) =>
                        String(image.id),
                    ),
                );
                devAssert(
                    app.state.scene.npcs_present.includes("Tessa Preview") &&
                        getNpcEntry("Tessa Preview")?.inspected !== true &&
                        newSpeakerProfile?.source === "uninspected NPC preview" &&
                        devLooksLikeRealImageHtml(newSpeakerProfile?.html) &&
                        newSpeakerProfileIdsAfter.size ===
                            newSpeakerProfileIdsBefore.size + 1 &&
                        newSpeakerProfileIdsAfterRepeat.size ===
                            newSpeakerProfileIdsAfter.size &&
                        [...newSpeakerProfileIdsAfterRepeat].every((id) =>
                            newSpeakerProfileIdsAfter.has(id),
                        ),
                    "assistant new-speaker metadata creates the nearby NPC and finishes exactly one preview profile image",
                    {
                        npc: getNpcEntry("Tessa Preview"),
                        newSpeakerProfile,
                        newSpeakerProfileIdsBefore: [...newSpeakerProfileIdsBefore],
                        newSpeakerProfileIdsAfter: [...newSpeakerProfileIdsAfter],
                        newSpeakerProfileIdsAfterRepeat: [
                            ...newSpeakerProfileIdsAfterRepeat,
                        ],
                    },
                );

                app.state.characters["Cast Browser Missing"] = {
                    ...blankCharacterTemplate("Cast Browser Missing"),
                    id: "cast-browser-missing",
                    name: "Cast Browser Missing",
                    age: 33,
                    gender: "female",
                    role: "cast browser tester",
                    profile_image_auto_skip: true,
                };
                const castBrowserProfileIdsBefore = new Set(
                    profileImagesForEntity(
                        app.state.characters["Cast Browser Missing"],
                    ).map((image) => String(image.id)),
                );
                openCharactersModal("Cast Browser Missing");
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(
                            app.state.characters["Cast Browser Missing"],
                        );
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "opening the in-game Characters browser to finish the visible missing profile image",
                );
                const castBrowserProfileIdsAfter = new Set(
                    profileImagesForEntity(
                        app.state.characters["Cast Browser Missing"],
                    ).map((image) => String(image.id)),
                );
                openCharactersModal("Cast Browser Missing");
                await new Promise((resolve) => setTimeout(resolve, 50));
                const castBrowserProfile = activeProfileImage(
                    app.state.characters["Cast Browser Missing"],
                );
                const castBrowserProfileIdsAfterRepeat = new Set(
                    profileImagesForEntity(
                        app.state.characters["Cast Browser Missing"],
                    ).map((image) => String(image.id)),
                );
                devAssert(
                    castBrowserProfile?.pending === false &&
                        !castBrowserProfile?.error &&
                        devLooksLikeRealImageHtml(castBrowserProfile?.html) &&
                        castBrowserProfileIdsAfter.size ===
                            castBrowserProfileIdsBefore.size + 1 &&
                        castBrowserProfileIdsAfterRepeat.size ===
                            castBrowserProfileIdsAfter.size &&
                        [...castBrowserProfileIdsAfterRepeat].every((id) =>
                            castBrowserProfileIdsAfter.has(id),
                        ),
                    "opening the in-game Characters browser generates exactly one profile image for its first visible missing character",
                    {
                        castBrowserProfile,
                        castBrowserProfileIdsBefore: [...castBrowserProfileIdsBefore],
                        castBrowserProfileIdsAfter: [...castBrowserProfileIdsAfter],
                        castBrowserProfileIdsAfterRepeat: [
                            ...castBrowserProfileIdsAfterRepeat,
                        ],
                    },
                );
                closeModal();

                const inGameOwnerKey = profileImageOwnerKey(
                    "Existing Ally",
                    app.state.characters["Existing Ally"],
                );
                const inGameQueueBefore =
                    profileQueueRequestCounts.get(inGameOwnerKey) || 0;
                devAssert(
                    removeProfileImage("Existing Ally", "existing-ally-profile"),
                    "in-game profile deletion removes the selected final image",
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(
                            app.state.characters["Existing Ally"],
                        );
                        return (
                            image?.id !== "existing-ally-profile" &&
                            image?.pending === false &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "in-game final profile deletion replacement image",
                );
                const inGameReplacement = activeProfileImage(
                    app.state.characters["Existing Ally"],
                );
                setLeftPanelGroup("characters");
                refreshProfileImageSurfaces("Existing Ally");
                const inGameCard = document.querySelector(
                    '[data-character-action="profile"][data-character-name="Existing Ally"]',
                );
                devAssert(
                    !profileImagesForEntity(
                        app.state.characters["Existing Ally"],
                    ).some((image) => image.id === "existing-ally-profile") &&
                        (profileQueueRequestCounts.get(inGameOwnerKey) || 0) ===
                            inGameQueueBefore + 1 &&
                        devLooksLikeRealImageHtml(inGameCard?.innerHTML || ""),
                    "deleting the final in-game profile image queues and displays exactly one replacement",
                    {
                        replacement: inGameReplacement,
                        queueBefore: inGameQueueBefore,
                        queueAfter: profileQueueRequestCounts.get(inGameOwnerKey) || 0,
                        cardHtml: inGameCard?.innerHTML || "",
                    },
                );

                const libraryName = "Library Delete Replacement";
                const libraryDefinition = devSmokeCharacterRecord(libraryName, {
                    character: {
                        default_profile_image: emptyProfileImageSlot(false),
                        profile_image_presentations: {
                            male: profileImageSlotFromExactInput(
                                emptyProfileImageSlot(true),
                            ),
                            non_male: profileImageSlotFromExactInput(
                                emptyProfileImageSlot(false),
                            ),
                        },
                    },
                });
                const libraryDefinitionId = characterLibraryRecordId(
                    libraryDefinition,
                );
                app.characterDefinitions = validatedCharacterLibraryDefinitions([
                    ...(app.characterDefinitions || []).filter(
                        (record) =>
                            characterLibraryRecordId(record) !== libraryDefinitionId,
                    ),
                    libraryDefinition,
                ]);
                const libraryRecord = characterLibraryRecords().find(
                    (record) => record.name === libraryName,
                );
                const registeredLibrary = registerCharacterLibraryProfileEntity(
                    libraryRecord,
                );
                const libraryProfileName = registeredLibrary?.name || libraryName;
                const libraryOriginal = rememberProfileImage(libraryProfileName, {
                    id: "library-delete-original",
                    source: "smoke",
                    seed: 404,
                    prompt: "library deletion original",
                    html: smokeImageHtml,
                    profile: true,
                    male: false,
                    pending: false,
                });
                openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
                await new Promise((resolve) => setTimeout(resolve, 80));
                const libraryOwnerKey = profileImageOwnerKey(
                    libraryProfileName,
                    registeredLibrary?.entity,
                );
                const libraryQueueBefore =
                    profileQueueRequestCounts.get(libraryOwnerKey) || 0;
                const libraryTotalQueueBefore = [...profileQueueRequestCounts.values()].reduce(
                    (total, count) => total + count,
                    0,
                );
                devAssert(
                    libraryOriginal?.id === "library-delete-original" &&
                        removeProfileImage(libraryProfileName, libraryOriginal.id),
                    "character-library profile deletion removes the selected final image",
                    { libraryOriginal },
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(registeredLibrary?.entity);
                        return (
                            image?.id !== "library-delete-original" &&
                            image?.pending === false &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "character-library final profile deletion replacement image",
                );
                const libraryReplacement = activeProfileImage(
                    registeredLibrary?.entity,
                );
                const libraryCard = document.querySelector(
                    `[data-character-library-id="${cssEscape(
                        characterLibraryRecordId(libraryRecord),
                    )}"] .character-library-definition-image`,
                );
                const libraryTotalQueueAfter = [...profileQueueRequestCounts.values()].reduce(
                    (total, count) => total + count,
                    0,
                );
                devAssert(
                    !profileImagesForEntity(registeredLibrary?.entity).some(
                        (image) => image.id === "library-delete-original",
                    ) &&
                        libraryTotalQueueAfter === libraryTotalQueueBefore + 1 &&
                        !!libraryCard?.querySelector("img"),
                    "deleting the final Character Library profile image queues exactly one replacement and refreshes its card",
                    {
                        replacement: libraryReplacement,
                        queueBefore: libraryQueueBefore,
                        queueAfter:
                            profileQueueRequestCounts.get(libraryOwnerKey) || 0,
                        totalQueueBefore: libraryTotalQueueBefore,
                        totalQueueAfter: libraryTotalQueueAfter,
                        cardHtml: libraryCard?.innerHTML || "",
                    },
                );
                closeModal();

                // The in-game Characters modal owns its card DOM separately from
                // the left panel. A queued portrait must update the open modal and
                // release the queue slot before the next visible missing card is
                // selected.
                const modalCharactersBeforeSmoke = app.state.characters;
                const sceneBeforeModalSmoke = clone(app.state.scene || {});
                app.state.characters = {
                    "Modal Danielle": {
                        ...blankCharacterTemplate("Modal Danielle"),
                        id: "profile-modal-danielle",
                        age: 28,
                        gender: "female",
                        role: "modal queue smoke",
                        profile_images: [],
                        profile_image_id: "",
                    },
                    "Modal Helene": {
                        ...blankCharacterTemplate("Modal Helene"),
                        id: "profile-modal-helene",
                        age: 29,
                        gender: "female",
                        role: "modal queue smoke",
                        profile_images: [],
                        profile_image_id: "",
                    },
                };
                app.state.scene = {
                    ...sceneBeforeModalSmoke,
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: [],
                };
                app.profileImages = exactProfileImageStore([]);
                renderCharacters();
                openCharactersModal();
                await devWaitFor(
                    () => {
                        const danielle = app.state.characters["Modal Danielle"];
                        const helene = app.state.characters["Modal Helene"];
                        const cards = [
                            ...document.querySelectorAll(
                                "#modalBox [data-character-directory-card]",
                            ),
                        ];
                        const cardFor = (name) =>
                            cards.find((card) =>
                                card.querySelector(
                                    `[data-character-card][data-character-name="${name}"]`,
                                ),
                            );
                        return (
                            activeProfileImage(danielle)?.pending === false &&
                            activeProfileImage(helene)?.pending === false &&
                            devLooksLikeRealImageHtml(
                                cardFor("Modal Danielle")?.querySelector("img")?.outerHTML ||
                                    "",
                            ) &&
                            devLooksLikeRealImageHtml(
                                cardFor("Modal Helene")?.querySelector("img")?.outerHTML ||
                                    "",
                            ) &&
                            !app.profileImageQueue.length &&
                            !app.profileImageQueued.size &&
                            !app.profileImageGenerating.size
                        );
                    },
                    5000,
                    "both visible Characters modal profile images to finish and render",
                );
                devAssert(
                    devLooksLikeRealImageHtml(
                        document.querySelector(
                            '#modalBox [data-character-card][data-character-name="Modal Danielle"] img',
                        )?.outerHTML || "",
                    ) &&
                        devLooksLikeRealImageHtml(
                            document.querySelector(
                                '#modalBox [data-character-card][data-character-name="Modal Helene"] img',
                            )?.outerHTML || "",
                        ) &&
                        !app.profileImageQueue.length &&
                        !app.profileImageQueued.size &&
                        !app.profileImageGenerating.size,
                    "open Characters modal advances through visible profile-image requests and refreshes each completed card",
                    {
                        danielle: activeProfileImage(
                            app.state.characters["Modal Danielle"],
                        ),
                        helene: activeProfileImage(app.state.characters["Modal Helene"]),
                        queue: app.profileImageQueue.map((item) => item.name),
                        queued: [...app.profileImageQueued],
                        generating: [...app.profileImageGenerating],
                    },
                );
                app.state.characters = modalCharactersBeforeSmoke;
                app.state.scene = sceneBeforeModalSmoke;
                closeModal();

                addMessage("system", "Profile image trigger smoke test passed.");
                showNotice("Live Test Passed", "Profile image trigger smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: profile-image-trigger-smoke");
            } finally {
                queueProfileImage = originalQueueProfileImage;
                if (hadTextToImageOverride)
                    pluginOverrides.textToImagePlugin = previousTextToImageOverride;
                else delete pluginOverrides.textToImagePlugin;
            }
        }

        async function devRunProfileImagePresentationPointerSmokeTest() {
            devTestLog("Scenario start: profile-image-presentation-pointer-smoke");
            devResetForLiveTest("profile-image-presentation-pointer-smoke");
            devCreateTestProfile({  });
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
            const smokeImageHtml =
                `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Presentation pointer smoke image">`;
            pluginOverrides.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({
                    dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                }),
            });
            try {
                const staleMaleImage = createProfileImageRecord({
                    id: "miran-male-profile",
                    character_id: "miran-vale",
                    owner_name: "Miran Vale",
                    male: true,
                    source: "smoke",
                    model: "default",
                    seed: 701,
                    prompt: "Miran Vale male presentation",
                    html: smokeImageHtml,
                    favorite: true,
                    pending: false,
                });
                const miran = {
                    ...blankCharacterTemplate("Miran Vale"),
                    id: "miran-vale",
                    name: "Miran Vale",
                    age: 29,
                    gender: "female",
                    role: "presentation pointer smoke",
                    profile_image_id: staleMaleImage.id,
                    profile_images: [staleMaleImage],
                };
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Profile Presentation Pointer Smoke",
                        },
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        id: "presentation-pointer-player",
                        name: "Presentation Pointer Tester",
                        age: 31,
                        gender: "female",
                        role: "tester",
                        profile_image_auto_skip: true,
                    },
                    characters: {},
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: ["Miran Vale"],
                        npcs_present: [],
                        image_characters: ["Miran Vale"],
                    },
                });
                app.state.characters["Miran Vale"] = miran;
                app.profileImages = exactProfileImageStore([staleMaleImage]);
                app.profileImageResolutionEpoch =
                    (app.profileImageResolutionEpoch || 0) + 1;

                const mismatchedLibraryRecord = devSmokeCharacterRecord(
                    "Miran Library",
                    {
                        record: {
                            id: "miran-library",
                            active_profile_image_ids: {
                                male: "",
                                non_male: staleMaleImage.id,
                            },
                        },
                        character: {
                            gender: "female",
                        },
                    },
                );
                app.characterDefinitions.push(mismatchedLibraryRecord);
                const registeredLibraryPresentation =
                    registerCharacterLibraryProfileEntity(
                        mismatchedLibraryRecord,
                        "female",
                    );
                devAssert(
                    registeredLibraryPresentation?.entity?.profile_image_id === "" &&
                        mismatchedLibraryRecord.active_profile_image_ids.non_male === "" &&
                        mismatchedLibraryRecord.character.profile_images.active_image_id ===
                            "" &&
                        profileImageByStoreId(staleMaleImage.id)?.male === true,
                    "character-library registration clears and persists an opposite-presentation active pointer without deleting the other presentation image",
                    {
                        registeredLibraryPresentation,
                        activeProfileImageIds:
                            mismatchedLibraryRecord.active_profile_image_ids,
                        definitionProfileImages:
                            mismatchedLibraryRecord.character.profile_images,
                        storedImage: profileImageByStoreId(staleMaleImage.id),
                    },
                );

                const canonicalNonMaleImage = createProfileImageRecord({
                    id: "veyra-swap-non-male-profile",
                    character_id: "veyra-swap-library",
                    owner_name: "Veyra Swap Library",
                    male: false,
                    source: "smoke",
                    model: "default",
                    seed: 702,
                    prompt: "Veyra Swap Library non-male presentation",
                    html: smokeImageHtml,
                    favorite: true,
                    pending: false,
                });
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    canonicalNonMaleImage,
                ]);
                const swapLibraryRecord = devSmokeCharacterRecord(
                    "Veyra Swap Library",
                    {
                        record: {
                            id: "veyra-swap-library",
                            active_profile_image_ids: {
                                male: "",
                                non_male: canonicalNonMaleImage.id,
                            },
                        },
                        character: {
                            gender: "female",
                            romanceable: true,
                            fallback_name: "Veyran Swap Library",
                            profile_images: {
                                active_image_id: canonicalNonMaleImage.id,
                                image_ids: [canonicalNonMaleImage.id],
                            },
                        },
                    },
                );
                app.characterDefinitions.push(swapLibraryRecord);
                const maleLibraryPresentation = registerCharacterLibraryProfileEntity(
                    swapLibraryRecord,
                    "male",
                );
                const pendingMaleImage = rememberProfileImage(
                    maleLibraryPresentation.name,
                    {
                        character_id: swapLibraryRecord.id,
                        source: "generated",
                        male: true,
                        pending: true,
                    },
                    {
                        characterId: swapLibraryRecord.id,
                        setActive: false,
                        save: false,
                    },
                );
                resolveActiveProfileImageReference(maleLibraryPresentation.entity);
                devAssert(
                    pendingMaleImage?.male === true &&
                        maleLibraryPresentation.entity.gender === "male" &&
                        maleLibraryPresentation.entity.profile_image_id === "" &&
                        swapLibraryRecord.active_profile_image_ids.male === "" &&
                        swapLibraryRecord.active_profile_image_ids.non_male ===
                            canonicalNonMaleImage.id,
                    "switching a library character from non-male to male keeps the non-male active id out of the projected male profile while creating its pending image",
                    {
                        pendingMaleImage,
                        projectedProfileImageId:
                            maleLibraryPresentation.entity.profile_image_id,
                        activeProfileImageIds:
                            swapLibraryRecord.active_profile_image_ids,
                    },
                );

                let lookupError = "";
                try {
                    profileImageById(miran, staleMaleImage.id);
                } catch (error) {
                    lookupError = error?.message || String(error);
                }
                devAssert(
                    /wrong gender presentation/i.test(lookupError) &&
                        miran.profile_image_id === staleMaleImage.id,
                    "profile image record lookups reject an opposite-presentation pointer without mutating runtime state",
                    { lookupError, profileImageId: miran.profile_image_id },
                );
                const queued = queueProfileImageIfMissing(
                    "Miran Vale",
                    "entered scene",
                    {
                        allowDuringSmoke: true,
                        allowImportSkipped: true,
                        allowRuntimeProfileGeneration: true,
                    },
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(miran);
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            image?.male === false &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "Miran Vale current-presentation profile image to finish after stale pointer recovery",
                );
                const active = activeProfileImage(miran);
                devAssert(
                    queued === true &&
                        active?.male === false &&
                        active?.id !== staleMaleImage.id &&
                        miran.profile_image_id === active.id &&
                        !miran.profile_images.some(
                            (image) =>
                                String(image.id) === String(miran.profile_image_id) &&
                                image.male === true,
                        ),
                    "profile image queue clears a stale opposite-presentation pointer and generates the current presentation",
                    {
                        queued,
                        active,
                        profileImageId: miran.profile_image_id,
                        profileImages: miran.profile_images,
                    },
                );
                addMessage("system", "Profile image presentation pointer smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: profile-image-presentation-pointer-smoke");
            } finally {
                if (hadTextToImageOverride)
                    pluginOverrides.textToImagePlugin = previousTextToImageOverride;
                else delete pluginOverrides.textToImagePlugin;
            }
        }

        async function devRunStoryPlayerSelectGenderProfileImageSmokeTest() {
            devTestLog("Scenario start: story-player-select-gender-profile-image-smoke");
            devResetForLiveTest("story-player-select-gender-profile-image-smoke");
            devCreateTestProfile({  });
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
            pluginOverrides.textToImagePlugin = () => ({
                onFinishPromise: Promise.resolve({
                    dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                }),
            });
            const queueBlocker = `story-player-presentation-switch-${Date.now()}`;
            try {
                app.activeImageRequests.add(queueBlocker);
                const sharedName = "Ari Solen";
                const femaleOption = {
                    name: sharedName,
                    character: {
                        ...blankCharacterTemplate(sharedName),
                        id: "ari-solen-presentation-switch-smoke",
                        name: sharedName,
                        gender: "female",
                        profile_images: [],
                        profile_image_id: "",
                        profile_image_request_key:
                            "story-player:presentation-switch:ari-solen:non_male",
                    },
                };
                const maleOption = {
                    name: sharedName,
                    character: {
                        ...blankCharacterTemplate(sharedName),
                        id: "ari-solen-presentation-switch-smoke",
                        name: sharedName,
                        gender: "male",
                        profile_images: [],
                        profile_image_id: "",
                        profile_image_request_key:
                            "story-player:presentation-switch:ari-solen:male",
                    },
                };
                queueStoryPlayerSelectProfileImages([femaleOption], "player select option");
                queueStoryPlayerSelectProfileImages([femaleOption], "player select option");
                queueStoryPlayerSelectProfileImages([maleOption], "player select option");
                queueStoryPlayerSelectProfileImages([maleOption], "player select option");
                const switchRequests = app.profileImageQueue.filter(
                    (item) => item.characterId === femaleOption.character.id,
                );
                const femaleOwnerKey = profileImageOwnerKey(
                    femaleOption.name,
                    femaleOption.character,
                );
                const maleOwnerKey = profileImageOwnerKey(
                    maleOption.name,
                    maleOption.character,
                );
                devAssert(
                    switchRequests.length === 2 &&
                        new Set(switchRequests.map((item) => item.ownerKey)).size === 2 &&
                        switchRequests[0]?.ownerKey === femaleOwnerKey &&
                        switchRequests[1]?.ownerKey === maleOwnerKey &&
                        switchRequests.some((item) => item.ownerKey === femaleOwnerKey) &&
                        switchRequests.some((item) => item.ownerKey === maleOwnerKey) &&
                        !(app.profileImages || []).some(
                            (image) =>
                                image.character_id === femaleOption.character.id &&
                                image.pending === true,
                        ) &&
                        app.profileEntityOverrides[femaleOption.character.profile_image_request_key] ===
                            femaleOption.character &&
                        app.profileEntityOverrides[maleOption.character.profile_image_request_key] ===
                            maleOption.character,
                    "player selection queues default cards left to right before alternate cards and keeps one request per presentation",
                    {
                        requests: switchRequests.map((item) => ({
                            name: item.name,
                            ownerKey: item.ownerKey,
                            characterId: item.characterId,
                        })),
                    },
                );
                app.activeImageRequests.delete(queueBlocker);
                await devWaitFor(
                    () =>
                        !app.profileImageQueue.some(
                            (item) => item.characterId === femaleOption.character.id,
                        ) &&
                        !app.profileImageGenerating.has(femaleOwnerKey) &&
                        !app.profileImageGenerating.has(maleOwnerKey),
                    5000,
                    "presentation-switch profile requests to finish",
                );

                // The old runtime contains a same-id female entity. The player
                // selector projects that same character into a male option and
                // installs a selector-specific override. Image generation must
                // use the projected option, not the stale runtime entity.
                const staleRuntimeEntity = {
                    ...blankCharacterTemplate("Mira Vale"),
                    id: "mira-hale",
                    name: "Mira Vale",
                    age: 26,
                    gender: "female",
                    role: "stale runtime player",
                    profile_images: [],
                    profile_image_id: "",
                };
                const projectedMaleEntity = {
                    ...blankCharacterTemplate("Miran Vale"),
                    id: "mira-hale",
                    name: "Miran Vale",
                    age: 26,
                    gender: "male",
                    role: "male player selection",
                    profile_images: [],
                    profile_image_id: "",
                    profile_image_request_key:
                        "story-player:gender-pointer-smoke:mira-hale:male",
                };
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Story Player Gender Image Smoke",
                        },
                    },
                    characters: { "Mira Vale": staleRuntimeEntity },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: [],
                        npcs_present: [],
                        image_characters: [],
                    },
                });
                app.profileImages = exactProfileImageStore([]);
                app.profileEntityOverrides = {
                    "Miran Vale": projectedMaleEntity,
                };
                app.profileImageResolutionEpoch =
                    (app.profileImageResolutionEpoch || 0) + 1;

                const queued = queueProfileImage(
                    "Miran Vale",
                    {
                        characterId: projectedMaleEntity.id,
                        reason: "player select option",
                        allowDuringSmoke: true,
                        allowImportSkipped: true,
                    },
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(projectedMaleEntity);
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            image?.male === true &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "male player-select profile image to finish on the projected entity",
                );
                const active = activeProfileImage(projectedMaleEntity);
                devAssert(
                    queued === true &&
                        active?.male === true &&
                        active?.character_id === "mira-hale" &&
                        active?.id === projectedMaleEntity.profile_image_id &&
                        activeProfileImage(staleRuntimeEntity) === null,
                    "player-select image generation follows the selected gender projection instead of a stale same-id runtime entity",
                    {
                        queued,
                        active,
                        projected: projectedMaleEntity,
                        staleRuntimeEntity,
                    },
                );
                addMessage("system", "Story player-select gender profile image smoke passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: story-player-select-gender-profile-image-smoke");
            } finally {
                app.activeImageRequests.delete(queueBlocker);
                if (hadTextToImageOverride)
                    pluginOverrides.textToImagePlugin = previousTextToImageOverride;
                else delete pluginOverrides.textToImagePlugin;
            }
        }

        async function devRunProfileImageRulesSmokeTest() {
            devTestLog("Scenario start: profile-image-rules-smoke");
            devResetForLiveTest("profile-image-rules-smoke");
            devCreateTestProfile({  });
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
            const onePixelDataUrl =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
            let generatedCount = 0;
            pluginOverrides.textToImagePlugin = () => {
                generatedCount++;
                return {
                    onFinishPromise: Promise.resolve({ dataUrl: onePixelDataUrl }),
                };
            };
            try {
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Profile Image Rules Smoke",
                        },
                    },
                    player: devSmokeRuntimeCharacter("Profile Rules Player", {
                        age: 26,
                        gender: "female",
                        role: "profile image rules tester",
                    }),
                    characters: {},
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: [],
                        npcs_present: [],
                        image_characters: [],
                    },
                });
                app.profileImages = [];
                app.messages = [];
                scheduleActiveGameSave();

                const authoredPresentationCharacter = clone(
                    devSmokeCharacterRecord("Presentation Description Smoke").character,
                );
                authoredPresentationCharacter.appearance.male_only_extra_description =
                    "a short neatly trimmed beard";
                authoredPresentationCharacter.appearance.non_male_only_extra_description =
                    "a clean-shaven face";
                const missingPresentationDescriptionCharacter = clone(
                    authoredPresentationCharacter,
                );
                delete missingPresentationDescriptionCharacter.appearance
                    .male_only_extra_description;
                delete missingPresentationDescriptionCharacter.appearance
                    .non_male_only_extra_description;
                const malformedPresentationDescriptionCharacter = clone(
                    authoredPresentationCharacter,
                );
                malformedPresentationDescriptionCharacter.appearance
                    .male_only_extra_description = 42;
                const missingPresentationValidation = validateCharacterDefinition(
                    missingPresentationDescriptionCharacter,
                );
                const authoredPresentationValidation = validateCharacterDefinition(
                    authoredPresentationCharacter,
                );
                const malformedPresentationValidation = validateCharacterDefinition(
                    malformedPresentationDescriptionCharacter,
                );
                devAssert(
                    missingPresentationValidation.ok &&
                        authoredPresentationValidation.ok &&
                        !malformedPresentationValidation.ok &&
                        malformedPresentationValidation.errors?.some(
                            (error) =>
                                error.path ===
                                    "character_definition.appearance.male_only_extra_description" &&
                                error.code === "type",
                        ),
                    "presentation-specific appearance descriptions are optional, valid as text or null, and reject non-text values",
                    {
                        missingPresentationValidation,
                        authoredPresentationValidation,
                        malformedPresentationValidation,
                    },
                );
                const malePresentationPromptEntity = {
                    ...authoredPresentationCharacter,
                    gender: "male",
                };
                const nonMalePresentationPromptEntity = {
                    ...authoredPresentationCharacter,
                    gender: "female",
                };
                const malePresentationPrompt = buildImagePrompt(
                    "Presentation Description Smoke",
                    malePresentationPromptEntity,
                    { includeSceneContext: false },
                );
                const nonMalePresentationPrompt = buildImagePrompt(
                    "Presentation Description Smoke",
                    nonMalePresentationPromptEntity,
                    { includeSceneContext: false },
                );
                const malePresentationProfilePrompt = buildProfileImagePrompt(
                    "Presentation Description Smoke",
                    malePresentationPromptEntity,
                );
                const nonMalePresentationProfilePrompt = buildProfileImagePrompt(
                    "Presentation Description Smoke",
                    nonMalePresentationPromptEntity,
                );
                devAssert(
                    /short neatly trimmed beard/i.test(malePresentationPrompt) &&
                        !/clean-shaven face/i.test(malePresentationPrompt) &&
                        /clean-shaven face/i.test(nonMalePresentationPrompt) &&
                        !/short neatly trimmed beard/i.test(nonMalePresentationPrompt) &&
                        /short neatly trimmed beard/i.test(malePresentationProfilePrompt) &&
                        !/clean-shaven face/i.test(malePresentationProfilePrompt) &&
                        /clean-shaven face/i.test(nonMalePresentationProfilePrompt) &&
                        !/short neatly trimmed beard/i.test(nonMalePresentationProfilePrompt),
                    "image and profile prompts use only the matching male or non-male presentation description",
                    {
                        malePresentationPrompt,
                        nonMalePresentationPrompt,
                        malePresentationProfilePrompt,
                        nonMalePresentationProfilePrompt,
                    },
                );

                await devImportCharacterRecords(
                    [
                        {
                            character_definition: {
                                ...devSmokeCharacterRecord("Default Player Import").character,
                                name: "Default Player Import",
                                age: 27,
                                gender: "female",
                                role: "default player import",
                                default_profile_image: {
                                    ...emptyProfileImageSlot(false),
                                    url: onePixelDataUrl,
                                    source: "player default",
                                    prompt: "player default portrait",
                                },
                                profile_image_presentations: {
                                    male: profileImageSlotFromExactInput({
                                        ...emptyProfileImageSlot(true),
                                        url: onePixelDataUrl,
                                        source: "player male default",
                                        prompt: "player male default portrait",
                                    }),
                                    non_male: profileImageSlotFromExactInput({
                                        ...emptyProfileImageSlot(false),
                                        url: onePixelDataUrl,
                                        source: "player default",
                                        prompt: "player default portrait",
                                    }),
                                },
                            },
                        },
                    ],
                    { playerOnly: true, playerWarningAccepted: true },
                );
                document.querySelector(".popup-modal #noticeOkBtn")?.click();
                await devWaitFor(
                    () => !!activeProfileImage(app.state.player) && generatedCount === 0,
                    5000,
                    "imported player default profile image to copy locally",
                );
                devAssert(
                    !!activeProfileImage(app.state.player) &&
                        generatedCount === 0,
                    "player import uses default profile image before generation",
                    {
                        player: app.state.player,
                        profile: activeProfileImage(app.state.player),
                        generatedCount,
                    },
                );

                const defaultCharacter = {
                    ...devSmokeCharacterRecord("Default Import").character,
                    name: "Default Import",
                    age: 28,
                    gender: "female",
                    role: "default image import",
                    default_profile_image: {
                        ...emptyProfileImageSlot(false),
                        url: onePixelDataUrl,
                        source: "smoke default",
                        prompt: "default imported portrait",
                    },
                    profile_image_presentations: {
                        male: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(true),
                            url: onePixelDataUrl,
                            source: "smoke male default",
                            prompt: "default imported male portrait",
                        }),
                        non_male: profileImageSlotFromExactInput({
                            ...emptyProfileImageSlot(false),
                            url: onePixelDataUrl,
                            source: "smoke default",
                            prompt: "default imported portrait",
                        }),
                    },
                };
                app.state.characters["Default Import"] = materializeCharacterForRuntime(
                    defaultCharacter,
                    "Default Import",
                );
                await resolveMissingProfileImage(
                    "Default Import",
                    "default image rules smoke",
                    { allowGeneration: true },
                );
                devAssert(
                    activeProfileImage(app.state.characters["Default Import"])?.source ===
                        "smoke default" &&
                        generatedCount === 0,
                    "default profile image is copied locally before generation",
                    {
                        profile: activeProfileImage(app.state.characters["Default Import"]),
                        generatedCount,
                    },
                );

                app.state.npc_directory = {
                    locations: {
                        "loc-default-plaza": {
                            label: "Default Plaza",
                            characters: {
                                "Dana Voss": {
                                    name: "Dana Voss",
                                    inspected: true,
                                    full_character: materializeCharacterForRuntime(
                                        {
                                            ...devSmokeCharacterRecord("Dana Voss").character,
                                            name: "Dana Voss",
                                            age: 33,
                                            gender: "female",
                                            role: "default npc",
                                            default_profile_image: {
                                                ...emptyProfileImageSlot(false),
                                                url: onePixelDataUrl,
                                                source: "npc default",
                                                prompt: "npc default portrait",
                                            },
                                            profile_image_presentations: {
                                                male: profileImageSlotFromExactInput({
                                                    ...emptyProfileImageSlot(true),
                                                    url: onePixelDataUrl,
                                                    source: "npc male default",
                                                    prompt: "npc male default portrait",
                                                }),
                                                non_male: profileImageSlotFromExactInput({
                                                    ...emptyProfileImageSlot(false),
                                                    url: onePixelDataUrl,
                                                    source: "npc default",
                                                    prompt: "npc default portrait",
                                                }),
                                            },
                                        },
                                        "Dana Voss",
                                    ),
                                },
                            },
                        },
                    },
                };
                await resolveMissingProfileImage("Dana Voss", "default npc smoke", {
                    allowGeneration: true,
                });
                devAssert(
                    activeProfileImage(
                        app.state.npc_directory.locations["loc-default-plaza"].characters[
                            "Dana Voss"
                        ].full_character,
                    )?.source === "npc default" &&
                        generatedCount === 0,
                    "inspected NPC uses default profile image before generation",
                    {
                        profile: activeProfileImage(
                            app.state.npc_directory.locations["loc-default-plaza"].characters[
                            "Dana Voss"
                            ].full_character,
                        ),
                        generatedCount,
                    },
                );

                app.state.npc_directory.locations["loc-preview-yard"] = {
                    label: "Preview Yard",
                    characters: {
                        "Seren Pike": {
                            id: "smoke-character-seren-pike",
                            name: "Seren Pike",
                            gender: "female",
                            age: 29,
                            role: "mercenary woman",
                            relationship: "unknown",
                            note: "armored mercenary with a scarred cheek",
                            inspected: false,
                            full_character: null,
                        },
                    },
                };
                app.state.scene.npcs_present = ["Seren Pike"];
                const previewNpc =
                    app.state.npc_directory.locations["loc-preview-yard"].characters[
                        "Seren Pike"
                    ];
                queueMissingProfileImageAfterDefaultAttempt(
                    "Seren Pike",
                    "uninspected npc preview",
                    {
                        allowImportSkipped: true,
                        source: "uninspected NPC preview",
                    },
                );
                const previewOwnerKey = profileImageOwnerKey("Seren Pike", previewNpc);
                await devWaitFor(
                    () =>
                        devLooksLikeRealImageHtml(
                            activeProfileImage(previewNpc)?.html,
                        ) &&
                        !app.profileImageQueued.has(previewOwnerKey) &&
                        !app.profileImageGenerating.has(previewOwnerKey),
                    5000,
                    "uninspected NPC preview profile image to generate",
                );
                const previewImage = activeProfileImage(previewNpc);
                const previewPrompt = String(previewImage?.prompt || "");
                const uninspectedNormalPrompt = buildImagePrompt("Seren Pike", previewNpc);
                const uninspectedShellWithoutFlag = { ...previewNpc };
                delete uninspectedShellWithoutFlag.inspected;
                const uninspectedNormalPromptWithoutFlag = buildImagePrompt(
                    "Seren Pike",
                    uninspectedShellWithoutFlag,
                );
                devAssert(
                    previewImage?.source === "uninspected NPC preview" &&
                        profileImagesForEntity(previewNpc).filter(
                            (image) => image.source === "uninspected NPC preview",
                        ).length === 1 &&
                        /uninspected NPC/i.test(previewPrompt) &&
                        /mercenary woman/i.test(previewPrompt) &&
                        !/deeply defined abs|secret noble|full character/i.test(
                            previewPrompt,
                        ),
                    "uninspected NPC card image uses a preview prompt based only on visible shell fields",
                    { previewImage, previewPrompt, generatedCount },
                );
                devAssert(
                    !/uninspected NPC scene image|current scene/i.test(uninspectedNormalPrompt) &&
                        /ordinary scene-appropriate clothing/i.test(uninspectedNormalPrompt) &&
                        /exactly one visible character/i.test(uninspectedNormalPrompt) &&
                        !/\b(naked|topless|bottomless|visible genitals)\b/i.test(uninspectedNormalPrompt) &&
                        !/deeply defined abs|secret noble|full character/i.test(uninspectedNormalPrompt) &&
                        !/uninspected NPC scene image|current scene/i.test(uninspectedNormalPromptWithoutFlag) &&
                        /exactly one visible character/i.test(uninspectedNormalPromptWithoutFlag) &&
                        !/\b(naked|topless|bottomless|visible genitals)\b/i.test(uninspectedNormalPromptWithoutFlag),
                    "uninspected NPC image prompt uses visible shell fields, omits machine labels, and does not infer nudity from missing clothing, even without an explicit inspected flag",
                    { uninspectedNormalPrompt, uninspectedNormalPromptWithoutFlag },
                );
                const restoredShellMetadata = {
                    ...previewNpc,
                    relationship_to_player: "neutral",
                    personality_description: "Patient and meticulous.",
                };
                const restoredShellNormalPrompt = buildImagePrompt("Seren Pike", restoredShellMetadata);
                const restoredShellProfilePrompt = buildProfileImagePrompt("Seren Pike", restoredShellMetadata);
                devAssert(
                    isUninspectedNpcPreviewEntity(restoredShellMetadata) &&
                        [restoredShellNormalPrompt, restoredShellProfilePrompt].every((prompt) =>
                            /armored mercenary with a scarred cheek/i.test(prompt) &&
                            !/average adult height|average-soft upper-body|naked|topless|bottomless|visible genitals/i.test(prompt),
                        ),
                    "explicitly uninspected NPCs retain preview appearance prompts when restored relationship and personality fields are present",
                    { restoredShellNormalPrompt, restoredShellProfilePrompt },
                );
                const runtimeAlly = {
                    ...blankCharacterTemplate("Runtime Ally"),
                    name: "Runtime Ally",
                    role: "party ally",
                };
                runtimeAlly.outfits = [
                    {
                        ...runtimeAlly.outfits[0],
                        clothing: {
                            ...blankClothingTemplate(),
                            shirt: "blue travel coat",
                            pants: "black fitted trousers",
                            feet: "riding boots",
                        },
                    },
                ];
                runtimeAlly.active_outfit_id = runtimeAlly.outfits[0].id;
                const normalRuntimePrompt = buildImagePrompt(
                    "Runtime Ally",
                    runtimeAlly,
                );
                devAssert(
                    !/uninspected NPC scene image|current scene|fantasy RPG background/i.test(normalRuntimePrompt) &&
                        /exactly one visible character: Runtime Ally/i.test(normalRuntimePrompt) &&
                        !/one continuous full-frame image, one camera angle/i.test(normalRuntimePrompt) &&
                        /blue travel coat/i.test(normalRuntimePrompt) &&
                        /black fitted trousers/i.test(normalRuntimePrompt) &&
                        /riding boots/i.test(normalRuntimePrompt),
                    "runtime characters with roles and clothing still use the full image prompt instead of the uninspected NPC shell prompt",
                    { normalRuntimePrompt },
                );
                devAssert(
                    imagePromptLocation({}, {}) === "",
                    "normal image prompts omit the optional location fragment when no visual location exists",
                );
                previewNpc.full_character = materializeCharacterForRuntime(
                    {
                        ...blankCharacterTemplate("Seren Pike"),
                        id: previewNpc.id,
                        name: "Seren Pike",
                        age: 29,
                        gender: "female",
                        role: "mercenary woman",
                        appearance: {
                            ...blankAppearanceTemplate(),
                            extra_description: "scarred cheek",
                            midsection_build: 8,
                            arm_length: 10,
                        },
                    },
                    "Seren Pike",
                );
                previewNpc.inspected = true;
                carryNpcShellProfileImagesToInspectedCharacter(
                    previewNpc,
                    previewNpc.full_character,
                    "Seren Pike",
                );
                queueMissingProfileImageAfterDefaultAttempt("Seren Pike", "npc inspected", {
                    force: true,
                    skipDefault: true,
                    allowImportSkipped: true,
                    allowRuntimeProfileGeneration: true,
                    source: "inspected NPC profile",
                });
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(previewNpc.full_character);
                        return image?.source === "inspected NPC profile" &&
                            profileImageIsFinished(image);
                    },
                    5000,
                    "inspected NPC full profile image to generate after preview",
                );
                const inspectedImage = activeProfileImage(previewNpc.full_character);
                const inspectedPrompt = String(inspectedImage?.prompt || "");
                devTestLog("Inspected NPC profile diagnostics", {
                    shellSource: activeProfileImage(previewNpc)?.source || "",
                    fullSource: inspectedImage?.source || "",
                    inspectedCount: profileImagesForEntity(
                        previewNpc.full_character,
                    ).filter((image) => image.source === "inspected NPC profile").length,
                    retainedPreview: profileImagesForEntity(
                        previewNpc.full_character,
                    ).some((image) => image.id === previewImage.id),
                    storedPrompt: profileImageByStoreId(inspectedImage?.id)?.prompt || "",
                    entityImages: clone(previewNpc.full_character.profile_images),
                    inspectedPrompt,
                });
                devAssert(
                    activeProfileImage(previewNpc)?.source ===
                            "uninspected NPC preview" &&
                        inspectedImage?.source === "inspected NPC profile" &&
                        profileImagesForEntity(previewNpc.full_character).filter(
                            (image) => image.source === "inspected NPC profile",
                        ).length === 1 &&
                        profileImagesForEntity(previewNpc.full_character).some(
                            (image) => image.id === previewImage.id,
                        ) &&
                        /defined muscular abs|toned abs|muscular arms|scarred cheek/i.test(
                            inspectedPrompt,
                        ) &&
                        !/uninspected NPC preview/i.test(inspectedPrompt),
                    "inspecting an NPC creates a new full-character profile image and shares it across the character identity",
                    {
                        shellProfile: activeProfileImage(previewNpc),
                        fullProfile: activeProfileImage(previewNpc.full_character),
                        inspectedPrompt,
                    },
                );
                await selectProfileImage("Seren Pike", previewImage.id);
                devAssert(
                    activeProfileImage(previewNpc.full_character)?.id === previewImage.id,
                    "pre-inspection NPC preview image remains selectable after inspection",
                    {
                        selected: activeProfileImage(previewNpc.full_character),
                        available: profileImagesForEntity(previewNpc.full_character).map(
                            (image) => image.id,
                        ),
                    },
                );
                const persistedManualSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [previewNpc.full_character.id, "non_male"],
                );
                const persistedManualImage = await app.persistence.getRecord(
                    "characterProfileImages",
                    previewImage.id,
                );
                devTestLog("Manual profile persistence diagnostics", {
                    persistedSelectionImageId:
                        persistedManualSelection?.imageId || "",
                    persistedImageCharacterId:
                        persistedManualImage?.characterId || "",
                    expectedImageId: previewImage.id,
                    expectedCharacterId: previewNpc.full_character.id,
                });
                devAssert(
                    persistedManualSelection?.imageId === previewImage.id &&
                        persistedManualImage?.characterId === previewNpc.full_character.id,
                    "manual profile selection persists under the current character identity",
                    {
                        persistedManualSelection,
                        persistedManualImage,
                        characterId: previewNpc.full_character.id,
                    },
                );

                const largeMissingName = `Mina Dawn Smoke ${Date.now()}`;
                const largeImportNames = [
                    "Lara Dawn",
                    largeMissingName,
                    "Nora Dawn",
                    "Oria Dawn",
                    "Pia Dawn",
                    "Rina Dawn",
                    "Sara Dawn",
                    "Tara Dawn",
                    "Vera Dawn",
                    "Willa Dawn",
                    "Zara Dawn",
                ];
                const records = largeImportNames.map((name, index) => {
                    return {
                        character_definition: {
                            ...devSmokeCharacterRecord(name, {
                                character: {
                                    gender: "female",
                                    role: "large import test",
                                },
                            }).character,
                            name,
                            age: 25 + index,
                            gender: "female",
                            role: "large import test",
                            ...(index === 0
                                ? {
                                      default_profile_image: {
                                          ...emptyProfileImageSlot(false),
                                          url: onePixelDataUrl,
                                          source: "large default",
                                          prompt: "large import default portrait",
                                      },
                                      profile_image_presentations: {
                                          male: profileImageSlotFromExactInput({
                                              ...emptyProfileImageSlot(true),
                                              url: onePixelDataUrl,
                                              source: "large male default",
                                              prompt: "large import male default portrait",
                                          }),
                                          non_male: profileImageSlotFromExactInput({
                                              ...emptyProfileImageSlot(false),
                                              url: onePixelDataUrl,
                                              source: "large default",
                                              prompt: "large import default portrait",
                                          }),
                                      },
                                  }
                                : {
                                      default_profile_image:
                                          emptyProfileImageSlot(false),
                                      profile_image_presentations: {
                                          male: emptyProfileImageSlot(true),
                                          non_male: emptyProfileImageSlot(false),
                                      },
                                  }),
                        },
                    };
                });
                const generatedBeforeLargeImport = generatedCount;
                await devImportCharacterRecords(records, { playerWarningAccepted: true });
                document.querySelector(".popup-modal #noticeOkBtn")?.click();
                await devWaitFor(
                    () =>
                        activeProfileImage(app.state.characters["Lara Dawn"])?.source ===
                        "large default",
                    5000,
                    "large import default profile image to copy locally",
                );
                devTestLog("Large profile import diagnostics", {
                    generatedBeforeLargeImport,
                    generatedCount,
                    missingAutoSkip:
                        !!app.state.characters[largeMissingName]
                            ?.profile_image_auto_skip,
                    missingActiveId:
                        activeProfileImage(app.state.characters[largeMissingName])?.id || "",
                    defaultSource:
                        activeProfileImage(app.state.characters["Lara Dawn"])?.source || "",
                });
                devAssert(
                    generatedCount === generatedBeforeLargeImport &&
                        !!app.state.characters[largeMissingName]?.profile_image_auto_skip &&
                        !activeProfileImage(app.state.characters[largeMissingName]),
                    "large import tries defaults but does not auto-generate missing profile images",
                    {
                        generatedBeforeLargeImport,
                        generatedCount,
                        largeDefault: activeProfileImage(app.state.characters["Lara Dawn"]),
                        largeMissing: app.state.characters[largeMissingName],
                    },
                );

                // Smoke setup: character imports add party members to the scene.
                // For the scene-entry rule, simulate the imported character becoming
                // relevant later by first making sure they are absent from every scene
                // presence/image list, then adding them back as a new scene entry.
                for (const key of [
                    "party_members_present",
                    "npcs_present",
                    "image_characters",
                ]) {
                    app.state.scene[key] = (app.state.scene[key] || []).filter(
                        (name) => name !== largeMissingName,
                    );
                }
                devAssert(
                    ![
                        ...(app.state.scene?.party_members_present || []),
                        ...(app.state.scene?.npcs_present || []),
                        ...(app.state.scene?.image_characters || []),
                    ].includes(largeMissingName),
                    "large-import missing-profile character starts absent before scene-entry profile trigger",
                    {
                        scene: app.state.scene,
                        skipped:
                            !!app.state.characters[largeMissingName]
                                ?.profile_image_auto_skip,
                    },
                );
                togglePresence(largeMissingName);
                devTestLog("Scene-entry profile image queue checkpoint", {
                    skipped:
                        !!app.state.characters[largeMissingName]?.profile_image_auto_skip,
                    queued: [...(app.profileImageQueued || new Set())],
                    generating: [...(app.profileImageGenerating || new Set())],
                    queueLength: app.profileImageQueue?.length || 0,
                    queueRunning: !!app.profileImageQueueRunning,
                    generatedCount,
                    active: activeProfileImage(app.state.characters[largeMissingName]),
                });
                await devWaitFor(
                    () =>
                        activeProfileImage(app.state.characters[largeMissingName])?.source ===
                        "generated",
                    5000,
                    "scene join without profile image to generate first profile image after default attempt",
                );
                devAssert(
                    !app.state.characters[largeMissingName].profile_image_auto_skip &&
                        !!activeProfileImage(app.state.characters[largeMissingName]) &&
                        !app.images.some((image) =>
                            /Mina Dawn entered scene/i.test(
                                `${image.reason || ""}\n${image.prompt || ""}`,
                            ),
                        ),
                    "scene join clears large-import skip and generates the missing first profile image",
                    {
                        active: activeProfileImage(app.state.characters[largeMissingName]),
                        images: app.images,
                    },
                );

                app.state.characters["Poma Vale"] = {
                        ...blankCharacterTemplate("Poma Vale"),
                        id: "smoke-party-poma-vale",
                        name: "Poma Vale",
                        profile_image_id: "party-shell-profile",
                        profile_images: [{ id: "party-shell-profile", male: false }],
                    };
                app.state.npc_directory = {
                    locations: {
                        Plaza: {
                            label: "Plaza",
                            characters: {
                                "Poma Vale": {
                                    name: "Poma Vale",
                                    inspected: true,
                                    full_character: {
                                        ...blankCharacterTemplate("Poma Vale"),
                                        id: "smoke-npc-poma-vale",
                                        name: "Poma Vale",
                                        profile_image_id: "npc-shell-profile",
                                        profile_images: [{ id: "npc-shell-profile", male: false }],
                                    },
                                },
                            },
                        },
                    },
                };
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    createProfileImageRecord({
                        id: "party-shell-profile",
                        character_id: app.state.characters["Poma Vale"].id,
                        owner_name: "Poma Vale",
                        source: "party",
                        model: "debug",
                        seed: 0,
                        prompt: "Poma Vale party profile",
                        negativePrompt: "",
                        html: `<img src="${onePixelDataUrl}" alt="party shell">`,
                        male: false,
                        pending: false,
                    }),
                    createProfileImageRecord({
                        id: "npc-shell-profile",
                        character_id:
                            app.state.npc_directory.locations.Plaza.characters[
                                "Poma Vale"
                            ].full_character.id,
                        owner_name: "Poma Vale",
                        source: "npc",
                        model: "debug",
                        seed: 0,
                        prompt: "Poma Vale NPC profile",
                        negativePrompt: "",
                        html: `<img src="${onePixelDataUrl}" alt="npc shell">`,
                        male: false,
                        pending: false,
                    }),
                ]);
                devAssert(
                    profileEntity("Poma Vale") ===
                        app.state.characters["Poma Vale"] &&
                        activeProfileImage(profileEntity("Poma Vale"))?.id ===
                            "party-shell-profile",
                    "profile image actions target party character before stale same-name NPC shell",
                    {
                        profileEntity: profileEntity("Poma Vale"),
                        active: activeProfileImage(profileEntity("Poma Vale")),
                    },
                );

                const previousImageHistoryLimit = app.settings.imageHistoryLimit;
                app.settings.imageHistoryLimit = 3;
                const capLimit = profileImageHistoryLimit();
                const cap = {
                    ...blankCharacterTemplate("Cora Vale"),
                    id: "smoke-character-cora-vale",
                    name: "Cora Vale",
                    gender: "female",
                    profile_image_id: "cap-active",
                    profile_images: [
                        { id: "cap-oldest", at: "2026-01-01T00:00:00.000Z", male: false },
                        {
                            id: "cap-favorite",
                            at: "2026-01-02T00:00:00.000Z",
                            favorite: true,
                            male: false,
                        },
                        { id: "cap-active", at: "2026-01-03T00:00:00.000Z", male: false },
                        { id: "cap-mid", at: "2026-01-04T00:00:00.000Z", male: false },
                        { id: "cap-newer", at: "2026-01-05T00:00:00.000Z", male: false },
                    ],
                };
                app.state.characters["Cora Vale"] = cap;
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    ...cap.profile_images.map((image) => createProfileImageRecord({
                        id: image.id,
                        character_id: cap.id,
                        owner_name: "Cora Vale",
                        source: "cap",
                        model: "debug",
                        seed: 0,
                        prompt: `Cora Vale ${image.id}`,
                        negativePrompt: "",
                        html: `<img src="${onePixelDataUrl}" alt="${image.id}">`,
                        male: false,
                        favorite: !!image.favorite,
                        pending: false,
                        at: image.at,
                    })),
                ]);
                rememberProfileImage("Cora Vale", {
                    id: "cap-added",
                    source: "cap",
                    html: `<img src="${onePixelDataUrl}" alt="cap added">`,
                    male: false,
                });
                const capIds = profileImagesForEntity(app.state.characters["Cora Vale"]).map(
                    (image) => image.id,
                );
                devAssert(
                    !capIds.includes("cap-oldest") &&
                        capIds.includes("cap-favorite") &&
                        capIds.includes("cap-added") &&
                        app.state.characters["Cora Vale"].profile_image_id === "cap-added",
                    "profile image cap preserves protected favorite/current images and prunes old inactive images",
                    {
                        capIds,
                        capLimit,
                        activeId: app.state.characters["Cora Vale"].profile_image_id,
                    },
                );
                const capStory = devSmokeTemplateRecord({
                    id: "global-cap-story-smoke",
                    title: "Global Cap Story Smoke",
                    title_card_image: createStoryTitleCardImageSlot({
                        id: "story-cap-active",
                        url: onePixelDataUrl,
                        seed: 0,
                    }),
                });
                devUpsertStoryTemplatesForSmoke([capStory]);
                replaceStoryTitleCardStoreImages(storyTemplateById(capStory.id), [
                    {
                        id: "story-cap-old",
                        at: "2022-01-01T00:00:00.000Z",
                        seed: 0,
                        html: `<img src="${onePixelDataUrl}" alt="story cap old">`,
                    },
                    {
                        id: "story-cap-favorite",
                        at: "2025-01-02T00:00:00.000Z",
                        seed: 0,
                        favorite: true,
                        html: `<img src="${onePixelDataUrl}" alt="story cap favorite">`,
                    },
                    {
                        id: "story-cap-active",
                        at: "2025-01-03T00:00:00.000Z",
                        seed: 0,
                        html: `<img src="${onePixelDataUrl}" alt="story cap active">`,
                    },
                ]);
                app.images = safeImageHistoryForStorage([
                    {
                        id: "normal-cap-old",
                        at: "2023-01-01T00:00:00.000Z",
                        html: `<img src="${onePixelDataUrl}" alt="normal cap old">`,
                    },
                    {
                        id: "normal-cap-old-2",
                        at: "2023-06-01T00:00:00.000Z",
                        html: `<img src="${onePixelDataUrl}" alt="normal cap old 2">`,
                    },
                    {
                        id: "normal-cap-favorite",
                        at: "2023-01-02T00:00:00.000Z",
                        favorite: true,
                        html: `<img src="${onePixelDataUrl}" alt="normal cap favorite">`,
                    },
                    ...(app.images || []),
                ]);
                pruneGlobalReusableImageHistories(false);
                const capStoryImages = storyTitleCardImages(storyTemplateById(capStory.id));
                devAssert(
                    !capStoryImages.some((image) => image.id === "story-cap-old") &&
                        capStoryImages.some((image) => image.id === "story-cap-favorite") &&
                        capStoryImages.some((image) => image.id === "story-cap-active") &&
                        !(app.images || []).some((image) => image.id === "normal-cap-old") &&
                        (app.images || []).some((image) => image.id === "normal-cap-favorite"),
                    "global reusable image cap prunes old normal/story/profile images together while protecting favorite and active images",
                    { capStoryImages, normalImages: app.images },
                );
                openProfileImageModal("Cora Vale");
                const addedCapCard = document.querySelector(
                    '[data-profile-image-id="cap-added"]',
                );
                const favoriteCapCard = document.querySelector(
                    '[data-profile-image-id="cap-favorite"]',
                );
                const addedCapBadge = addedCapCard?.querySelector(
                    ".profile-image-position-badge",
                );
                const favoriteCapBadge = favoriteCapCard?.querySelector(
                    ".profile-image-position-badge.favorite",
                );
                devAssert(
                    addedCapBadge?.textContent?.trim() === `1/${capLimit}` &&
                        favoriteCapBadge?.textContent?.trim() === "\u2605",
                    "profile image picker shows retention position badges and favorite star badges",
                    {
                        addedBadge: addedCapBadge?.textContent,
                        favoriteBadge: favoriteCapBadge?.textContent,
                    },
                );
                const addedRender = addedCapCard?.querySelector(".profile-image-live");
                const addedAspectRatio = addedRender
                    ? getComputedStyle(addedRender).aspectRatio
                    : "";
                devAssert(
                    addedAspectRatio === "1 / 1",
                    "profile image picker render surface stays square",
                    { aspectRatio: addedAspectRatio },
                );
                closeModal();
                app.settings.imageHistoryLimit = previousImageHistoryLimit;

                const pendingTester = {
                    ...blankCharacterTemplate("Pina Vale"),
                    id: "smoke-character-pina-vale",
                    name: "Pina Vale",
                    gender: "female",
                    profile_image_id: "pending-active",
                    default_profile_image: profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(false),
                        local_image_id: "pending-active",
                        source: "pending smoke",
                        male: false,
                    }),
                };
                app.state.characters["Pina Vale"] = pendingTester;
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    createProfileImageRecord({
                        id: "pending-finished",
                        character_id: pendingTester.id,
                        owner_name: "Pina Vale",
                        source: "finished",
                        model: "debug",
                        seed: 0,
                        prompt: "Pina Vale finished profile",
                        negativePrompt: "",
                        html: `<img src="${onePixelDataUrl}" alt="finished pending tester">`,
                        pending: false,
                        male: false,
                    }),
                    createProfileImageRecord({
                        id: "pending-active",
                        character_id: pendingTester.id,
                        owner_name: "Pina Vale",
                        source: "stuck pending",
                        model: "debug",
                        seed: 0,
                        prompt: "Pina Vale pending profile",
                        negativePrompt: "",
                        html: "",
                        pending: true,
                        error: "",
                        male: false,
                    }),
                ]);
                devAssert(
                    activeProfileImage(pendingTester)?.id === "pending-finished" &&
                        localDefaultProfileImage(pendingTester)?.id === "pending-finished" &&
                        pendingTester.default_profile_image?.local_image_id === "pending-finished",
                    "pending profile image records do not replace the active/default finished image",
                    {
                        active: activeProfileImage(pendingTester),
                        defaultProfile: pendingTester.default_profile_image,
                        profiles: profileImagesForEntity(pendingTester).map((image) => ({
                            id: image.id,
                            pending: image.pending,
                            hasHtml: !!profileImageRealHtml(image.html),
                        })),
                    },
                );

                const stalePlayerImage = createProfileImageRecord({
                    id: "stale-player-owner-portrait",
                    character_id: "smoke-character-stale-player",
                    owner_name: "Player",
                    source: "old different game",
                    model: "debug",
                    seed: 0,
                    html: `<img src="${onePixelDataUrl}" alt="stale player portrait">`,
                    prompt: "Old unrelated player portrait",
                    negativePrompt: "",
                    male: true,
                    pending: false,
                });
                const overlappingSharedImage = createProfileImageRecord({
                    id: "new-save-overlapping-shared-profile",
                    owner_name: "Existing Ally",
                    character_id: "smoke-character-existing-ally",
                    source: "new save overlap smoke",
                    model: "default",
                    seed: 808,
                    prompt: "Existing Ally overlapping shared portrait",
                    html: `<img src="${onePixelDataUrl}" alt="overlapping shared portrait">`,
                    male: false,
                });
                saveProfileImageRecordsNow(
                    [overlappingSharedImage],
                    "new save overlapping shared profile smoke setup",
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    stalePlayerImage,
                    overlappingSharedImage,
                ]);
                await createNewActiveSave("stale Player profile isolation", {
                    state: {
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Different Player Profile Story",
                            },
                        },
                        player: devSmokeRuntimeCharacter("Different Profile Player", {
                            age: 24,
                            gender: "male",
                            role: "different profile isolation player",
                            profile_image_id: "",
                            profile_images: [],
                        }),
                        characters: {},
                        location: {
                            ...clone(defaultState.location || {}),
                            npc_location_id: "profile-isolation-room",
                        },
                        npc_directory: {
                            locations: {
                                "profile-isolation-room": {
                                    label: "Profile Isolation Room",
                                    characters: {},
                                },
                            },
                        },
                    },
                    profileImages: [stalePlayerImage, overlappingSharedImage],
                });
                const staleSaveId = activeSaveId();
                const staleSavedProfiles = exactProfileImageStore(
                    await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []),
                );
                devAssert(
                    !activeProfileImage(app.state.player) &&
                        app.profileImages.filter(
                            (image) => image.id === overlappingSharedImage.id,
                        ).length === 1 &&
                        !profileImagesForEntity(app.state.player).some(
                            (image) => String(image.id) === stalePlayerImage.id,
                        ),
                    "new-save profile loading merges overlapping shared ids once and isolates stale Player-owned portraits",
                    {
                        active: activeProfileImage(app.state.player),
                        savedProfiles: staleSavedProfiles,
                        runtimeProfiles: profileImagesForEntity(app.state.player),
                    },
                );

                const sharedState = (activeId = "") =>
                    ({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Shared Profile Story",
                            },
                        },
                        player: devSmokeRuntimeCharacter("Shared Player", {
                            age: 27,
                            gender: "female",
                            role: "shared profile tester",
                        }),
                        characters: {
                            "Shared Hero": devSmokeRuntimeCharacter("Shared Hero", {
                                age: 30,
                                gender: "female",
                                role: "shared hero",
                                profile_image_id: activeId,
                                profile_images: [],
                                default_profile_image: activeId
                                    ? profileImageSlotFromExactInput({
                                          ...emptyProfileImageSlot(false),
                                          local_image_id: activeId,
                                          source: "shared save fixture",
                                      })
                                    : emptyProfileImageSlot(false),
                                profile_image_presentations: {
                                    male: emptyProfileImageSlot(true),
                                    non_male: activeId
                                        ? profileImageSlotFromExactInput({
                                              ...emptyProfileImageSlot(false),
                                              local_image_id: activeId,
                                              source: "shared save fixture",
                                          })
                                        : emptyProfileImageSlot(false),
                                },
                            }),
                        },
                        location: {
                            ...clone(defaultState.location || {}),
                            npc_location_id: "shared-profile-room",
                        },
                        npc_directory: {
                            locations: {
                                "shared-profile-room": {
                                    label: "Shared Profile Room",
                                    characters: {},
                                },
                            },
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            party_members_present: ["Shared Hero"],
                            npcs_present: [],
                            image_characters: ["Shared Player", "Shared Hero"],
                        },
                    });
                const sharedCharacterId = "smoke-character-shared-hero";
                const sharedAImage = createProfileImageRecord({
                        id: "shared-a",
                        character_id: sharedCharacterId,
                        owner_name: "Shared Hero",
                        source: "save-a",
                        model: "debug",
                        seed: 0,
                        prompt: "Shared Hero profile A",
                        negativePrompt: "",
                        male: false,
                        html: `<img src="${onePixelDataUrl}" alt="shared a">`,
                        pending: false,
                    });
                const sharedBImage = createProfileImageRecord({
                        id: "shared-b",
                        character_id: sharedCharacterId,
                        owner_name: "Shared Hero",
                        source: "save-b",
                        model: "debug",
                        seed: 0,
                        prompt: "Shared Hero profile B",
                        negativePrompt: "",
                        male: false,
                        html: `<img src="${onePixelDataUrl}" alt="shared b">`,
                        pending: false,
                    });
                app.profileImages = exactProfileImageStore([
                    ...app.profileImages,
                    sharedAImage,
                    sharedBImage,
                ]);
                const sharedSaveAState = sharedState("shared-a");
                const sharedSaveBState = sharedState("shared-b");
                devAssert(
                    sharedSaveAState.characters["Shared Hero"].profile_image_id ===
                        "shared-a" &&
                        sharedSaveBState.characters["Shared Hero"].profile_image_id ===
                            "shared-b",
                    "shared profile save fixtures retain their distinct active image selections",
                    {
                        saveA:
                            sharedSaveAState.characters["Shared Hero"]
                                .profile_image_id,
                        saveB:
                            sharedSaveBState.characters["Shared Hero"]
                                .profile_image_id,
                    },
                );
                const saveA = await createNewActiveSave("shared profile save A", {
                    state: sharedSaveAState,
                    profileImages: [sharedAImage],
                });
                const saveB = await createNewActiveSave("shared profile save B", {
                    state: sharedSaveBState,
                    profileImages: [sharedBImage],
                });
                devTestLog("Shared profile normalized save diagnostic", {
                    saveA,
                    saveB,
                    saveIndex: saveIndexRecords().map((record) => record.saveId),
                });
                devCreateTestProfile({  });
                await loadSaveIntoRuntime(saveA, { setActive: true });
                const saveAProfiles = profileImagesForEntity(
                    app.state.characters["Shared Hero"],
                ).map((image) => image.id);
                devAssert(
                    activeProfileImage(app.state.characters["Shared Hero"])?.id ===
                        "shared-a" &&
                        saveAProfiles.includes("shared-a") &&
                        saveAProfiles.includes("shared-b"),
                    "same character shares profile image history while Save A keeps its active selection",
                    {
                        active: activeProfileImage(app.state.characters["Shared Hero"]),
                        saveAProfiles,
                    },
                );
                await loadSaveIntoRuntime(saveB, { setActive: true });
                const saveBProfiles = profileImagesForEntity(
                    app.state.characters["Shared Hero"],
                ).map((image) => image.id);
                devAssert(
                    activeProfileImage(app.state.characters["Shared Hero"])?.id ===
                        "shared-a" &&
                        saveBProfiles.includes("shared-a") &&
                        saveBProfiles.includes("shared-b"),
                    `same character shares profile image history and one global active selection across Save B (active ${activeProfileImage(app.state.characters["Shared Hero"])?.id || "none"}; profiles ${saveBProfiles.join(", ") || "none"})`,
                    {
                        active: activeProfileImage(app.state.characters["Shared Hero"]),
                        saveBProfiles,
                    },
                );

                render();
                devTestLog("Scenario complete: profile-image-rules-smoke");
            } finally {
                if (hadTextToImageOverride)
                    pluginOverrides.textToImagePlugin = previousTextToImageOverride;
                else delete pluginOverrides.textToImagePlugin;
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunSceneImageActionScopeSmokeTest() {
            devTestLog("Scenario start: scene-image-action-scope-smoke");
            const originalState = clone(app.state);
            try {
                const player = devSmokeRuntimeCharacter("Scope Player", {
                    age: 30,
                    gender: "female",
                    role: "scope smoke player",
                });
                const npc = devSmokeRuntimeCharacter("Scope NPC", {
                    age: 28,
                    gender: "female",
                    role: "scope smoke NPC",
                    pose: "standing beside Scope Player",
                });
                app.state = {
                    ...clone(defaultState),
                    player,
                    characters: { "Scope NPC": npc },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        party_members_present: [],
                        npcs_present: ["Scope NPC"],
                        image_characters: ["Scope NPC"],
                        image_action: "Scope Player seated beside the window",
                    },
                };

                const soloPrompt = buildImagePrompt("Scope NPC", npc);
                devAssert(
                    !/Scope Player seated beside the window/i.test(soloPrompt),
                    "solo image prompt omits global scene image action",
                    { soloPrompt },
                );

                const fullScenePrompt = buildGroupImagePrompt([
                    ["Scope Player", player],
                    ["Scope NPC", npc],
                ]);
                devAssert(
                    /Scope Player seated beside the window/i.test(fullScenePrompt),
                    "full-scene image prompt retains global scene image action",
                    { fullScenePrompt },
                );
                devTestLog("Scenario complete: scene-image-action-scope-smoke");
            } finally {
                app.state = originalState;
            }
        }

        async function devRunProfileImagePromptStyleSmokeTest() {
            devTestLog("Scenario start: profile-image-prompt-style-smoke");
            devResetForLiveTest("profile-image-prompt-style-smoke");
            devCreateTestProfile({  });
            const originalProfileImages = clone(app.profileImages || []);
            const pluginOverrides = (globalThis.__emberAdventuresPluginOverrides ||= {});
            const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(
                pluginOverrides,
                "textToImagePlugin",
            );
            const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
            const calls = [];
            pluginOverrides.textToImagePlugin = (promptData) => {
                calls.push(clone(promptData || {}));
                return {
                    onFinishPromise: Promise.resolve({
                        dataUrl:
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                    }),
                };
            };
            try {
                app.profileImageRandomSeedByName = {};
                app.settings.defaultProfileImageModel = PROFILE_IMAGE_MODEL_DEFAULT;
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        genres: ["sci-fi", "adventure"],
                        story_source: {
                            mode: "original",
                            title: "Profile Prompt Style Smoke",
                        },
                    },
                    location: {
                        ...clone(defaultState.location || {}),
                        specific_place: "inside a straw-filled barn",
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "Michio waits in a barn.",
                        image_action:
                            "Michio standing inside the straw-filled barn near the doorway",
                        party_members_present: ["Astra Nyberg"],
                        image_characters: ["Astra Nyberg"],
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        name: "Michio",
                    },
                    characters: {
                        "Astra Nyberg": {
                            ...blankCharacterTemplate("Astra Nyberg"),
                            id: "astra-nyberg",
                            name: "Astra Nyberg",
                            default_seed: 456,
                            age: 31,
                            gender: "female",
                            role: "space-station mechanic",
                            personality_description:
                                "Astra is practical, funny, and aggressively competent.",
                            appearance: {
                                ...blankAppearanceTemplate(),
                                species: "Scandinavian human",
                                skin_color: "fair skin with light freckles",
                                eye_color: "steel blue",
                                hair_color: "platinum blonde with dark roots",
                                hair_length: "short",
                                hair_type: "messy undercut ponytail",
                                shoulder_width: 12,
                                chest: 13,
                                upper_body_build: 8,
                                midsection_build: 8,
                                hip_width: 11,
                                butt_build: 8,
                                lower_body_build: 8,
                                arm_length: 10,
                                leg_length: 10,
                                extra_description:
                                    "grease freckles, cybernetic left forearm socket",
                            },
                            clothing: {
                                ...blankClothingTemplate(),
                                hat: "orange safety goggles pushed onto her forehead",
                                shirt: "black sports bra",
                                coat: "gray coveralls unzipped and tied at waist",
                                pants: "gray coveralls tied at waist",
                                feet: "magnetic boots",
                            },
                            active_outfit_id: "profile-smoke-outfit",
                            starting_outfit_id: "profile-smoke-outfit",
                            outfits: [
                                {
                                    id: "profile-smoke-outfit",
                                    name: "Mechanic",
                                    clothing: {
                                        ...blankClothingTemplate(),
                                        hat: "orange safety goggles pushed onto her forehead",
                                        shirt: "black sports bra",
                                        coat: "gray coveralls unzipped and tied at waist",
                                        pants: "gray coveralls tied at waist",
                                        feet: "magnetic boots",
                                    },
                                },
                            ],
                            image_prompt_config: {
                                seed_enabled: true,
                                seed: 0,
                                style: "",
                                profile_style: "game-art-icon",
                                negative: "",
                            },
                            image: {
                                seed_enabled: true,
                                seed: 123,
                                style: "high detail fantasy RPG character art",
                                profile_style: "anime",
                                negative: "",
                            },
                        },
                    },
                });
                scheduleActiveGameSave();

                const profileEntity = app.state.characters["Astra Nyberg"];
                const profileBodyContext = createImagePromptContext(profileEntity, {
                    profile: true,
                    includesLowerBody: false,
                });
                buildProfileUpperClothingPrompt(profileEntity, profileBodyContext);
                const profileBodyPrompt = buildProfileBodyPrompt(
                    profileEntity,
                    profileBodyContext,
                );
                const buttBuildPhrases = bodyStatPhrases.butt_build || [];
                devAssert(
                    buttBuildPhrases.length === 21 &&
                        buttBuildPhrases.every(
                            (phrase) =>
                                !/\b(?:rear|rearward|back|view|camera)\b/i.test(
                                    phrase,
                                ),
                        ),
                    "all butt-build phrases preserve anatomy-only composition without camera-bias language",
                    { buttBuildPhrases },
                );
                const expectedProfileBodyFields = [
                    "height",
                    "shoulder_width",
                    "chest",
                    "upper_body_build",
                    "midsection_build",
                    "arm_length",
                ];
                const suppressedProfileBodyFields = [
                    "hip_width",
                    "butt_build",
                    "lower_body_build",
                    "leg_length",
                ];
                const retiredProfileBodyFields = [
                    "muscular",
                    "shoulders",
                    "stomach",
                    "hips",
                    "waist",
                    "legs",
                    "arms",
                ];
                const expectedProfileBodyPrompt = expectedProfileBodyFields
                    .map((field) =>
                        bodyStatPhrase(field, profileEntity.appearance[field], {
                            useDefault: false,
                            entity: profileEntity,
                            promptContext: profileBodyContext,
                        }),
                    )
                    .filter(Boolean)
                    .join(", ");
                const retiredFieldEntity = clone(profileEntity);
                retiredProfileBodyFields.forEach((field) => {
                    retiredFieldEntity.appearance[field] = 20;
                });
                devAssert(
                    profileBodyPrompt === expectedProfileBodyPrompt &&
                        suppressedProfileBodyFields.every((field) => {
                            const phrase = bodyStatPhrase(
                                field,
                                profileEntity.appearance[field],
                                {
                                    useDefault: false,
                                    entity: profileEntity,
                                    promptContext: profileBodyContext,
                                },
                            );
                            return !phrase || !profileBodyPrompt.includes(phrase);
                        }) &&
                        buildProfileBodyPrompt(retiredFieldEntity, profileBodyContext) ===
                            profileBodyPrompt,
                    "profile body prompt projects height and the six profile body scales while ignoring suppressed lower and retired fields",
                    { profileBodyPrompt, expectedProfileBodyPrompt },
                );
                const explicitRearViewEntity = clone(profileEntity);
                explicitRearViewEntity.image = {
                    ...clone(profileEntity.image || {}),
                    image_type: "full-body illustration",
                    view: "rear three-quarter view",
                };
                const explicitRearViewPrompt = buildImagePrompt(
                    "Astra Nyberg",
                    explicitRearViewEntity,
                );
                devAssert(
                    !/one continuous full-frame image, one camera angle/i.test(
                        explicitRearViewPrompt,
                    ) &&
                        /full-body illustration/i.test(explicitRearViewPrompt) &&
                        /rear three-quarter view/i.test(explicitRearViewPrompt),
                    "normal one-character prompts retain explicit image type and view without prohibiting rear angles",
                    { explicitRearViewPrompt },
                );
                const recentSoloCompositionNegativeTerms = [
                    "turnaround",
                    "character sheet",
                    "front and back comparison",
                    "simultaneous front and rear views",
                ];
                const normalSfwNegativePrompt = buildGroupImageNegativePrompt(
                    [["Astra Nyberg", profileEntity]],
                    {  },
                );


                const groupedNegativePrompt = buildGroupImageNegativePrompt(
                    [
                        ["Astra Nyberg", profileEntity],
                        ["Second Character", clone(profileEntity)],
                    ],
                    {  },
                );
                const profileNegativePrompt = buildProfileNegativePrompt(
                    profileEntity,
                );

                const prompt = buildProfileImagePrompt(
                    "Astra Nyberg",
                    profileEntity,
                );
                const forbidden = [
                    "straw",
                    "barn",
                    "Michio",
                    "inside",
                    "wide hips",
                    "hips",
                    "strong thighs",
                    "legs",
                    "magnetic boots",
                    "feet",
                    "centered face",
                    "face centered",
                    "full body",
                    "covered shoulders",
                    "practical",
                    "funny",
                ].filter((term) =>
                    new RegExp(
                        term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "i",
                    ).test(prompt),
                );
                devAssert(
                        !forbidden.length &&
                        /Astra Nyberg/i.test(prompt) &&
                        /space-station mechanic/i.test(prompt) &&
                        /single-character upper-body portrait/i.test(prompt) &&
                        /science-fiction interior/i.test(prompt) &&
                        /adventure setting/i.test(prompt) &&
                        /framed from the top of the head to the natural waistline/i.test(prompt) &&
                        /entire face visible/i.test(prompt) &&
                        /full torso visible/i.test(prompt) &&
                        /lower clothing may meet the bottom edge of the frame/i.test(prompt) &&
                        /no full-body composition/i.test(prompt) &&
                        /orange safety goggles pushed onto her forehead/i.test(prompt) &&
                        /black sports bra/i.test(prompt) &&
                        /gray coveralls unzipped and tied at waist/i.test(prompt) &&
                        /gray coveralls tied at waist/i.test(prompt) &&
                        /average-soft abdomen with mild natural fullness/i.test(prompt),
                    "profile image prompt is story-free, visual-only, role-aware, upper-body focused, and includes upper-body clothing",
                    { prompt, forbidden },
                );

                const beforeProfiles = profileImagesForEntity(
                    app.state.characters["Astra Nyberg"],
                ).length;
                await generateProfileImage("Astra Nyberg", {
                    manual: true,
                    randomSeed: false,
                    reason: "profile prompt style smoke",
                });
                const image = activeProfileImage(app.state.characters["Astra Nyberg"]);
                const sentPrompt = String(calls[0]?.prompt?.evaluateItem || "");
                const sfwProfileNegative = buildProfileNegativePrompt(
                    app.state.characters["Astra Nyberg"],
                    {  },
                );
                const expectedNegativePrompt = applyImageArtStyle(
                    buildProfileImagePrompt("Astra Nyberg", app.state.characters["Astra Nyberg"]),
                    sfwProfileNegative,
                    "anime",
                ).negativePrompt;
                const baseNegativePrompt = buildBaseImageNegativePrompt();
                devAssert(
                    [
                        "turnaround",
                        "character sheet",
                        "front and back comparison",
                        "simultaneous front and rear views",
                    ].every((term) => baseNegativePrompt.includes(term)),
                    "base image negative prompt includes exact multi-view failure guards",
                    { baseNegativePrompt },
                );
                devAssert(
                    sfwProfileNegative.split(buildBaseImageNegativePrompt()).length - 1 === 1,
                    "SFW profile negative prompt includes the shared base block exactly once",
                    { sfwProfileNegative },
                );

                app.state.characters["Zero Seed Tester"] = {
                    ...blankCharacterTemplate("Zero Seed Tester"),
                    id: "zero-seed-tester",
                    name: "Zero Seed Tester",
                    default_seed: 0,
                    image_prompt_config: {
                        seed_enabled: true,
                        seed: 0,
                        style: "",
                        profile_style: "game-art-icon",
                        negative: "",
                    },
                    image: {
                        seed_enabled: false,
                        seed: 999,
                        style: "",
                        profile_style: "",
                        negative: "",
                    },
                };
                calls.length = 0;
                await generateProfileImage("Zero Seed Tester", {
                    manual: true,
                    randomSeed: false,
                    reason: "zero seed profile smoke",
                });
                const zeroSeedImage = activeProfileImage(
                    app.state.characters["Zero Seed Tester"],
                );
                devAssert(
                    calls.length === 1 &&
                        String(calls[0]?.seed) === "0" &&
                        zeroSeedImage?.seed === 0,
                    "profile image generation treats seed 0 as a real fixed seed, not random",
                    { call: calls[0], image: zeroSeedImage },
                );

                openCharacterImageSettings("Astra Nyberg");
                const settingsSeedInput = $("characterSeedValue");
                const settingsSeedEnabled = $("characterSeedEnabled");
                devAssert(
                    settingsSeedInput?.value ===
                        String(defaultProfileImageSeed(app.state.characters["Astra Nyberg"])),
                    "character card image settings display the canonical profile seed",
                    {
                        inputValue: settingsSeedInput?.value,
                        defaultSeed: app.state.characters["Astra Nyberg"].default_seed,
                        promptSeed:
                            app.state.characters["Astra Nyberg"].image_prompt_config?.seed,
                        imageSeed: app.state.characters["Astra Nyberg"].image?.seed,
                    },
                );
                settingsSeedEnabled.value = "true";
                settingsSeedInput.value = "789";
                settingsSeedInput.onblur?.(new Event("blur"));
                closeModal();
                const astraPromptConfig =
                    app.state.characters["Astra Nyberg"].image_prompt_config;
                devAssert(
                    app.state.characters["Astra Nyberg"].image?.seed === 789 &&
                        app.state.characters["Astra Nyberg"].default_seed === 789 &&
                        astraPromptConfig?.seed === 789 &&
                        astraPromptConfig?.seed_enabled === true &&
                        defaultProfileImageSeed(app.state.characters["Astra Nyberg"]) ===
                            789,
                    "character card image settings save updates every seed field used by profile generation",
                    {
                        defaultSeed: app.state.characters["Astra Nyberg"].default_seed,
                        promptConfig: astraPromptConfig,
                        image: app.state.characters["Astra Nyberg"].image,
                    },
                );
                calls.length = 0;
                await generateProfileImage("Astra Nyberg", {
                    manual: true,
                    randomSeed: false,
                    reason: "profile settings seed smoke",
                });
                devAssert(
                    calls.length === 1 && Number(calls[0]?.seed) === 789,
                    "profile image generation uses the manually edited character card seed immediately",
                    calls[0],
                );

                delete app.state.characters["Astra Nyberg"].image.profile_style;
                devAssert(
                    resolvedProfileImageModel(app.state.characters["Astra Nyberg"]) ===
                        "game-art-icon",
                    "profile style falls back from mutable override to immutable character definition default",
                    app.state.characters["Astra Nyberg"].image_prompt_config,
                );
                app.state.characters["Astra Nyberg"].image_prompt_config.profile_style = "";
                app.settings.defaultProfileImageModel = "game-art-icon";
                devAssert(
                    resolvedProfileImageModel(app.state.characters["Astra Nyberg"]) ===
                        "game-art-icon",
                    "profile style falls back to global default profile style",
                    app.settings.defaultProfileImageModel,
                );

                openProfileImageModal("Astra Nyberg");
                const profileImageModal =
                    document.querySelector("[data-profile-image-modal]")?.closest(".popup-modal") ||
                    $("modalBox");
                const profileThumbWrap = profileImageModal?.querySelector?.(".profile-image-thumb-wrap, .profile-image-placeholder, .profile-image-loading");
                const seedInput = profileImageModal?.querySelector?.("[data-profile-seed-input]");
                const randomSeedToggle = profileImageModal?.querySelector?.("[data-profile-random-seed]");
                const randomSeedButton = profileImageModal?.querySelector?.("[data-profile-action='random-seed']");
                const uploadImageButton = profileImageModal?.querySelector?.("[data-profile-action='upload']");
                if (randomSeedToggle?.checked) {
                    randomSeedToggle.checked = false;
                    randomSeedToggle.dispatchEvent(new Event("change"));
                }
                devAssert(
                    /Global default style|Character definition default|Current game override/i.test(
                        profileImageModal?.textContent || "",
                    ) &&
                        /\bSFW\b/i.test(profileImageModal?.textContent || "") &&
                        !!profileImageModal?.querySelector?.("[data-profile-style-override]") &&
                        seedInput?.value === String(defaultProfileImageSeed(app.state.characters["Astra Nyberg"])) &&
                        !!randomSeedToggle &&
                        !!randomSeedButton &&
                        !uploadImageButton,
                    "manual profile image UI exposes style controls, default-seed controls, and generation mode without character-image upload",
                );
                const fixedSeedFromUi = Number(seedInput?.value || 0);
                calls.length = 0;
                profileImageModal?.querySelector?.("[data-profile-action='generate']")?.click();
                await devWaitFor(
                    () => calls.length === 1,
                    2000,
                    "profile image modal fixed-seed generation call",
                );
                devAssert(
                    Number(calls[0]?.seed) === fixedSeedFromUi,
                    "profile image modal generate uses the character default seed by default",
                    calls[0],
                );
                randomSeedButton.click();
                devAssert(
                    seedInput.value !== String(fixedSeedFromUi) &&
                        Number(seedInput.value) > 0 &&
                        randomSeedToggle.checked === false &&
                        seedInput.disabled === false,
                    "profile image modal random seed button creates a fixed replacement seed",
                    {
                        seed: seedInput.value,
                        randomize: randomSeedToggle.checked,
                        disabled: seedInput.disabled,
                    },
                );
                randomSeedToggle.checked = true;
                randomSeedToggle.dispatchEvent(new Event("change"));
                const fixedSeedBeforeRandomizedGenerate = Number(seedInput.value || 0);
                calls.length = 0;
                profileImageModal?.querySelector?.("[data-profile-action='generate']")?.click();
                await devWaitFor(
                    () => calls.length === 1,
                    2000,
                    "profile image modal randomized-seed generation call",
                );
                devAssert(
                    Number(calls[0]?.seed) > 0 &&
                        calls[0]?.seed !== fixedSeedBeforeRandomizedGenerate,
                    "profile image modal randomize toggle ignores the fixed seed for generation",
                    { call: calls[0], fixedSeed: fixedSeedBeforeRandomizedGenerate, currentSeedInput: seedInput.value },
                );
                devAssert(
                    !profileThumbWrap ||
                        getComputedStyle(profileThumbWrap).aspectRatio === "1 / 1",
                    "profile image UI uses square profile image surfaces",
                    { aspectRatio: profileThumbWrap ? getComputedStyle(profileThumbWrap).aspectRatio : "" },
                );
                closeModal();
                await devWaitFor(
                    () => !app.activeProfileImageRequests?.size,
                    2000,
                    "profile image prompt/style generation cleanup",
                );

                addMessage("system", "Profile image prompt/style smoke test passed.");
                scheduleActiveGameSave();
                render();
                devTestLog("Scenario complete: profile-image-prompt-style-smoke");
            } finally {
                app.profileImages = exactProfileImageStore(originalProfileImages);
                if (hadTextToImageOverride)
                    pluginOverrides.textToImagePlugin = previousTextToImageOverride;
                else delete pluginOverrides.textToImagePlugin;
            }
        }



        function devAssertRetentionArchiveSnapshots(expectedEntries, archivedEntries, stats, textExport, blobExport, blobText) {
            const expectedIds = expectedEntries.map(entry => entry.id);
            const archivedIds = archivedEntries.map(entry => entry.id);
            const textIds = [...textExport.text.matchAll(/^===== #(\d+) /gm)].map(match => Number(match[1]));
            const blobIds = [...blobText.matchAll(/^===== #(\d+) /gm)].map(match => Number(match[1]));
            const prefixMatches = (prefix, entries) => prefix.length <= entries.length && prefix.every((id, index) => id === entries[index]);
            //Each await can admit real background logs. Check exact fixture contents and append-only snapshot prefixes,
            //rather than treating additional retained performance/errors as lost or duplicated fixture entries.
            devAssert(
                expectedEntries.length > DEV_TRACE_LIMIT &&
                    expectedEntries.every((entry, index) => JSON.stringify(archivedEntries[index]) === JSON.stringify(entry)) &&
                    new Set(archivedIds).size === archivedIds.length &&
                    archivedIds.every((id, index) => index === 0 || id > archivedIds[index - 1]) &&
                    stats.entryCount >= archivedEntries.length && stats.chunkCount > 1 &&
                    prefixMatches(archivedIds, textIds) && textIds.length >= stats.entryCount &&
                    textExport.entryCount === textIds.length &&
                    prefixMatches(textIds, blobIds) && blobExport.entryCount === blobIds.length &&
                    new Set(blobIds).size === blobIds.length &&
                    blobIds.every((id, index) => index === 0 || id > blobIds[index - 1]) &&
                    blobExport.blob instanceof Blob &&
                    expectedEntries.every(entry => {
                        const block = formatDevTraceEntry(entry);
                        return textExport.text.includes(block) && blobText.includes(block);
                    }) &&
                    !app.devTrace.some(entry => entry.id === expectedIds[0]),
                "worker Dev Log archive retains and exports entries that the bounded UI window evicted",
                {
                    expectedCount: expectedEntries.length, archivedRetentionStats: stats,
                    firstArchivedId: archivedIds[0], lastArchivedId: archivedIds.at(-1),
                    textEntryCount: textExport.entryCount, blobEntryCount: blobExport.entryCount,
                    retainedFirstId: app.devTrace[0]?.id, exportBytes: blobExport.blob?.size,
                },
            );
        }

        async function devRunLoggingSettingsSmokeTest() {
            devTestLog("Scenario start: logging-settings-smoke");
            devResetForLiveTest("logging-settings-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: normal players should not produce console/dev-trace
            // logs unless the matching category setting is enabled. Debug-all may
            // bypass the settings only for deliberate test/debug sessions.
            const disabledSettings = Object.fromEntries(
                LOG_SETTING_IDS.map((id) => [id, false]),
            );
            const enabledChecks = Object.entries(LOG_SETTING_BY_TYPE).map(
                ([type, setting]) => {
                    const settings = { ...disabledSettings, [setting]: true };
                    return {
                        type,
                        setting,
                        enabled: logSettingEnabledForSettings(type, settings, false),
                        disabled: logSettingEnabledForSettings(
                            type,
                            disabledSettings,
                            false,
                        ),
                    };
                },
            );
            devAssert(
                enabledChecks.every((item) => item.enabled && !item.disabled),
                "each log category is disabled by default and enabled by its matching setting",
                enabledChecks,
            );
            devAssert(
                !logSettingEnabledForSettings("AI prompt", disabledSettings, false) &&
                    logSettingEnabledForSettings(
                        "AI prompt",
                        { ...disabledSettings, logAi: true },
                        false,
                    ) &&
                    !logSettingEnabledForSettings("voice reader", disabledSettings, false) &&
                    logSettingEnabledForSettings(
                        "voice reader",
                        { ...disabledSettings, logVoice: true },
                        false,
                    ) &&
                    logSettingEnabledForSettings("anything", disabledSettings, true),
                "compound log labels normalize to categories and debug-all intentionally bypasses settings",
                { disabledSettings },
            );
            const aiPromptTrace = {
                title: "AI prompt",
                label: "logging smoke",
                prompt: "Line one.\n  Keep this indentation.\nJSON quote: \\\"exact\\\"",
                promptFingerprint: "prompt-smoke",
            };
            const aiResponseTrace = aiResponseDevLogDetail(
                "logging smoke",
                "Full response body.",
                "Full response body.",
            );
            devAssert(
                !("summary" in aiPromptTrace) && !("summary" in aiResponseTrace),
                "AI prompt/response Dev Log entries use full prompt/response fields instead of truncated summaries",
                { aiPromptTrace, aiResponseTrace },
            );
            const aiPromptTraceText = formatDevTraceEntry({
                id: 998,
                ...aiPromptTrace,
            });
            devAssert(
                /<<<EMBERADVENTURES_PROMPT_EXACT_COPY_START id=998 fingerprint=prompt-smoke>>>/.test(
                    aiPromptTraceText,
                ) &&
                    /Line one\.\n  Keep this indentation\.\nJSON quote: \\"exact\\"/.test(
                        aiPromptTraceText,
                    ) &&
                    /<<<EMBERADVENTURES_PROMPT_EXACT_COPY_END>>>/.test(aiPromptTraceText),
                "AI prompt Dev Log entries include an exact copy-paste block that preserves whitespace and escaping",
                { aiPromptTraceText },
            );
            const aiResponseTraceText = formatDevTraceEntry({
                id: 999,
                title: "AI response",
                ...aiResponseTrace,
            });
            devAssert(
                !/raw:\s*\n\s*0:\s*F/i.test(aiResponseTraceText) &&
                    !/rawMetadata/i.test(aiResponseTraceText),
                "AI response Dev Log does not expand string raw payloads into character-index noise",
                { aiResponseTraceText },
            );
            let consoleWriteCount = 0;
            const smokeConsoleWriter = () => {
                consoleWriteCount += 1;
            };
            const traceCountBefore = (app.devTrace || []).length;
            try {
                const mutedConsole = writeConsoleLog(
                    {
                        title: "Muted smoke log",
                        detail: "This must not reach console.",
                        logType: "system",
                        logLevel: "message",
                    },
                    disabledSettings,
                    false,
                    smokeConsoleWriter,
                );
                const mutedTrace = recordDevTraceEntry(
                    {
                        title: "Muted smoke trace",
                        detail: "This must not reach Dev Log.",
                        logType: "system",
                        logLevel: "message",
                    },
                    disabledSettings,
                    false,
                );
                devAssert(
                    mutedConsole === false &&
                        mutedTrace === false &&
                        consoleWriteCount === 0 &&
                        (app.devTrace || []).length === traceCountBefore,
                    "all log settings off means no app console output and no Dev Log entry in normal mode",
                    {
                        mutedConsole,
                        mutedTrace,
                        consoleWriteCount,
                        traceCountBefore,
                        traceCountAfter: (app.devTrace || []).length,
                    },
                );
                const enabledConsole = writeConsoleLog(
                    {
                        title: "Enabled smoke log",
                        detail: "This should reach Dev Log only, not browser console.",
                        logType: "system",
                        logLevel: "message",
                    },
                    { ...disabledSettings, logSystem: true },
                    false,
                    smokeConsoleWriter,
                );
                devAssert(
                    enabledConsole === false && consoleWriteCount === 0,
                    "matching log setting does not write non-error logs to browser console",
                    { enabledConsole, consoleWriteCount },
                );
                const errorConsole = writeConsoleLog(
                    {
                        title: "Error smoke log",
                        detail: "This should reach browser console.",
                        logType: "system",
                        logLevel: "error",
                    },
                    disabledSettings,
                    false,
                    smokeConsoleWriter,
                );
                devAssert(
                    errorConsole === true && consoleWriteCount === 1,
                    "error logs still write to browser console even when normal log settings are off",
                    { errorConsole, consoleWriteCount },
                );
            } finally {
                // Keep this block structured so future smoke assertions can add
                // cleanup without ever replacing the real browser console.
            }
            app.devTrace = [];
            app.settings = {
                ...app.settings,
                ...disabledSettings,
                devMode: true,
            };
            app.issuePopupOpen = false;
            let copiedIssueText = "";
            let exportedDevLog = false;
            let exportedBackup = false;
            const originalCopyTextToClipboard = copyTextToClipboard;
            const originalExportDevTrace = exportDevTrace;
            const originalExportData = exportData;
            try {
                copyTextToClipboard = async (text) => {
                    copiedIssueText = String(text || "");
                    return true;
                };
                exportDevTrace = () => {
                    exportedDevLog = true;
                };
                exportData = async (options = {}) => {
                    exportedBackup =
                        options?.fileName === "emberadventures-issue-backup.json";
                };
                reportAppIssue(new Error("Issue reporter smoke error"), {
                    title: "Issue Reporter Smoke",
                    type: "system",
                    context: "logging-settings-smoke",
                    details: { smoke: true },
                });
                devAssert(
                    !!$("issueCopyErrorBtn") &&
                        !!$("issueExportDevLogBtn") &&
                        !!$("issueExportBackupBtn") &&
                        !!$("issueExportBothBtn") &&
                        !!$("issueDismissBtn") &&
                        app.devTrace.some(
                            (entry) =>
                                entry.logLevel === "error" &&
                                /Issue Reporter Smoke/i.test(entry.title || ""),
                        ),
                    "dev-mode issue reporter shows diagnostic actions and logs errors even when normal log settings are off",
                    {
                        modalText: $("modalBox")?.textContent || "",
                        devTrace: app.devTrace,
                    },
                );
                $("issueExportDevLogBtn").onclick = () => exportDevTrace();
                $("issueExportBackupBtn").onclick = () =>
                    exportData({ fileName: "emberadventures-issue-backup.json" });
                $("issueExportBothBtn").onclick = async () => {
                    exportDevTrace();
                    await exportData({ fileName: "emberadventures-issue-backup.json" });
                };
                $("issueCopyErrorBtn")?.click();
                $("issueExportDevLogBtn")?.click();
                $("issueExportBackupBtn")?.click();
                await devWaitFor(
                    () => exportedDevLog && exportedBackup,
                    3000,
                    "issue diagnostic actions",
                );
                devAssert(
                    /Issue reporter smoke error/.test(copiedIssueText) &&
                        /Details:/i.test(copiedIssueText) &&
                        exportedDevLog &&
                        exportedBackup,
                    "issue popup Copy Error, Export Dev Log, and Export Backup actions work",
                    { copiedIssueText, exportedDevLog, exportedBackup },
                );
                exportedDevLog = false;
                exportedBackup = false;
                $("issueExportBothBtn")?.click();
                await devWaitFor(
                    () => exportedDevLog && exportedBackup,
                    3000,
                    "issue export both",
                );
                devAssert(
                    exportedDevLog && exportedBackup,
                    "issue popup Export Both action exports dev log and backup",
                    { exportedDevLog, exportedBackup },
                );
                $("issueDismissBtn")?.click();
                devAssert(
                    !app.issuePopupOpen &&
                        !document.querySelector("#issueDismissBtn"),
                    "issue popup Dismiss closes the issue popup",
                );
                log("Warning Reporter Smoke", "Issue reporter smoke warning", {
                    type: "system",
                    level: "warning",
                });
                devAssert(
                    !!$("issueDismissBtn") &&
                        app.devTrace.some(
                            (entry) =>
                                entry.logLevel === "warning" &&
                                /Warning Reporter Smoke/i.test(entry.title || ""),
                        ),
                    "dev-mode issue reporter shows warnings and logs them even when normal log settings are off",
                    {
                        modalText: $("modalBox")?.textContent || "",
                        devTrace: app.devTrace,
                    },
                );
                $("issueDismissBtn")?.click();
                app.issuePopupOpen = false;
                app.settings.devMode = false;
                showDevIssuePopup({
                    at: new Date().toISOString(),
                    severity: "error",
                    title: "Normal Player Error Smoke",
                    context: "logging-settings-smoke",
                    message: "Normal-player reportable error",
                    details: { smoke: true },
                });
                devAssert(
                    !!$("issueCopyErrorBtn") &&
                        !!$("issueExportBackupBtn") &&
                        !!$("issueDismissBtn") &&
                        !$("issueExportDevLogBtn") &&
                        !$("issueExportBothBtn"),
                    "normal-player error popup exposes copy and backup actions without dev-only buttons",
                    { modalText: $("modalBox")?.textContent || "" },
                );
                $("issueDismissBtn")?.click();
                app.settings.devMode = true;
            } finally {
                copyTextToClipboard = originalCopyTextToClipboard;
                exportDevTrace = originalExportDevTrace;
                exportData = originalExportData;
            }
            app.devTrace = [];
            app.settings = { ...app.settings, ...disabledSettings, logPerformance: true };
            perfConsole("largeStorageSet", { smoke: true }, "warn");
            devAssert(
                app.devTrace.length === 0,
                "Storage (minor) performance logs are not enabled by the main Performance log setting",
                app.devTrace,
            );
            app.settings = { ...app.settings, ...disabledSettings, logStorageMinor: true };
            perfConsole("largeStorageSet", { smoke: true }, "warn");
            devAssert(
                app.devTrace.length === 1 &&
                    app.devTrace[0]?.logType === "storageMinor",
                "Storage (minor) setting captures routine large-storage performance logs",
                app.devTrace,
            );
            app.devTrace = [];
            app.settings = { ...app.settings, ...disabledSettings, logPerformance: true };
            perfConsole("render", { smoke: true }, "warn");
            devAssert(
                app.devTrace.length === 1 &&
                    app.devTrace[0]?.logType === "performance",
                "Performance setting still captures non-storage timing logs",
                app.devTrace,
            );
            const preservedArchiveEntries = await devTraceArchiveEntries();
            const preservedRecentEntries = clone(app.devTrace || []);
            const preservedNextId = app.devTraceNextId;
            try {
            await clearDevTraceArchive();
            app.devTraceNextId = 1;
            const enabledSystemSettings = {
                ...disabledSettings,
                logSystem: true,
            };
            const retentionFixtureEntries = [];
            for (let index = 0; index < DEV_TRACE_LIMIT + 2; index += 1) {
                recordDevTraceEntry(
                    {
                        title: `Retention smoke ${index + 1}`,
                        detail: `retained entry ${index + 1}`,
                        logType: "system",
                        logLevel: "message",
                        retentionSmoke: true,
                    },
                    enabledSystemSettings,
                    false,
                );
                retentionFixtureEntries.push(clone(app.devTrace.at(-1)));
            }
            const retainedIds = (app.devTrace || []).map((entry) => entry.id);
            devAssert(
                app.devTrace.length === DEV_TRACE_LIMIT &&
                    retainedIds[0] === 3 &&
                    retainedIds[retainedIds.length - 1] === DEV_TRACE_LIMIT + 2 &&
                    app.devTraceNextId === DEV_TRACE_LIMIT + 3,
                "Dev Log keeps stable increasing IDs and drops only the oldest entry past the retention limit",
                {
                    length: app.devTrace.length,
                    firstId: retainedIds[0],
                    lastId: retainedIds[retainedIds.length - 1],
                    nextId: app.devTraceNextId,
                },
            );
            await flushDevTraceArchive();
            const archivedRetentionEntries = await devTraceArchiveEntries();
            const archivedRetentionStats = await devTraceArchiveStats();
            const archivedRetentionExport = await persistenceWorkerRequest(
                "dev-trace-export-text",
                { exportedAt: "retention-smoke" },
            );
            const archivedRetentionBlob = await persistenceWorkerRequest(
                "dev-trace-export",
                { exportedAt: "retention-smoke" },
            );
            const archivedRetentionBlobText = await archivedRetentionBlob.blob.text();
            devAssertRetentionArchiveSnapshots(
                retentionFixtureEntries, archivedRetentionEntries, archivedRetentionStats,
                archivedRetentionExport, archivedRetentionBlob, archivedRetentionBlobText,
            );
            const clearBoundaryId = app.devTraceNextId;
            await clearDevTraceArchive();
            const clearedArchiveEntries = await devTraceArchiveEntries();
            const clearedArchiveStats = await devTraceArchiveStats();
            devAssert(
                app.devTrace.every(entry => entry.id >= clearBoundaryId) &&
                    clearedArchiveEntries.every(entry => entry.id >= clearBoundaryId) &&
                    clearedArchiveStats.entryCount >= clearedArchiveEntries.length &&
                    (clearedArchiveStats.entryCount === 0) === (clearedArchiveStats.chunkCount === 0),
                "clearing the Dev Log removes both the recent UI window and complete worker archive",
                clearedArchiveStats,
            );
            } finally {
                await replaceDevTraceArchiveForSmoke(
                    preservedArchiveEntries,
                    preservedRecentEntries,
                    preservedNextId,
                );
            }
            const restoredArchiveEntries = await devTraceArchiveEntries();
            const restoredRecentMaxId = (app.devTrace || []).reduce(
                (max, entry) => Math.max(max, Number(entry?.id) || 0),
                0,
            );
            const expectedRestoredNextId = Math.max(
                Number(preservedNextId) || 1,
                restoredRecentMaxId + 1,
            );
            devAssert(
                preservedArchiveEntries.every((entry, index) => JSON.stringify(restoredArchiveEntries[index]) === JSON.stringify(entry)) &&
                    !restoredArchiveEntries.some(entry => entry.retentionSmoke === true) &&
                    app.devTraceNextId === expectedRestoredNextId,
                "Dev Log retention smoke restores the active session archive and preserves the next entry sequence",
                {
                    preservedCount: preservedArchiveEntries.length,
                    restoredCount: restoredArchiveEntries.length,
                    preservedNextId,
                    restoredRecentMaxId,
                    expectedRestoredNextId,
                    restoredNextId: app.devTraceNextId,
                },
            );
            for (const id of LOG_SETTING_IDS) app.settings[id] = true;
            openSettingsModal();
            const settingsSurface = () =>
                document.querySelector("[data-library-settings-overlay]") ||
                $("modalBox");
            const closeSettingsSurface = () => {
                const overlay = document
                    .querySelector("[data-library-settings-overlay]")
                    ?.closest(".popup-modal.open");
                if (overlay) {
                    overlay
                        .querySelector(".modal-close")
                        ?.click();
                    return;
                }
                closeModal();
            };
            devAssert(
                !!$("logImage") && !!$("logVoice") && !!$("logStorageMinor"),
                "settings modal renders individual log category checkboxes",
            );
            $("logImage").checked = false;
            $("logImage").dispatchEvent(new Event("change", { bubbles: true }));
            await flushLargeSaves();
            const persistedLogSettings = await loadLargeJson(SETTINGS_KEY, {});

            closeSettingsSurface();
            openSettingsModal();

            closeModal();
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Logging Settings Smoke",
                    },
                },
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "user",
                    speaker: "Smoke Scene Tester",
                    text: "New Ally puts on her raincoat before leaving the inn.",
                    at: new Date().toISOString(),
                },
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "New Ally removes her coat and leans close.",
                    at: new Date().toISOString(),
                },
            ];
            addMessage("system", "Logging settings smoke test passed.");
            showNotice("Live Test Passed", "Logging settings smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: logging-settings-smoke");
        }
