
        function runtimeCharacterOwner(character = {}, name = "") {
            if (character === app.state?.player) return { kind: "player", name: "Player" };
            for (const [characterName, entry] of Object.entries(app.state?.characters || {}))
                if (entry === character)
                    return { kind: "character", name: characterName };
            for (const location of Object.values(app.state?.npc_directory?.locations || {})) {
                for (const [npcName, npc] of Object.entries(location?.characters || {})) {
                    if (npc === character || npc?.full_character === character)
                        return { kind: "npc", name: npcName };
                }
            }
            for (const [speakerName, speaker] of Object.entries(app.state?.temp_speakers || {}))
                if (speaker === character)
                    return { kind: "temp-speaker", name: speakerName };
            const requested = String(name || "");
            if (requested && app.state?.characters?.[requested])
                return { kind: "character", name: requested };
            if (requested && app.state?.temp_speakers?.[requested])
                return { kind: "temp-speaker", name: requested };
            return { kind: "unknown", name: requested };
        }

        function updateOwnedRuntimeCharacter(character = {}, name = "", updater = () => {}) {
            const owner = runtimeCharacterOwner(character, name);
            if (owner.kind === "player") return updatePlayerRuntime(() => updater(character));
            if (owner.kind === "character")
                return updateCharacterRuntime(owner.name, () => updater(character));
            if (owner.kind === "npc")
                return updateNpcDirectoryRuntime(() => updater(character), owner.name);
            if (owner.kind === "temp-speaker")
                return updateTempSpeakerRuntime(() => updater(character), owner.name);
            // A detached creation/import object is not durable runtime yet.
            return updater(character);
        }


        function exactAutoModeType(value) {
            if (value !== "player_as_npc" && value !== "take_player_turns")
                throw new Error('autoModeType must be exactly "player_as_npc" or "take_player_turns".');
            return value;
        }
        app.settings.autoModeType = exactAutoModeType(
            app.settings.autoModeType,
        );
        app.settings.devMode = true;
        app.settings.textProvider = exactTextProvider(app.settings.ollama.provider);
        const CANONICAL_DEFAULT_VOICES = {
            narratorVoiceName: "Ava Online",
            defaultMalePlayerVoiceName: "Andrew Online",
            defaultNonMalePlayerVoiceName: "Libby Online",
        };
        const VOICE_BROWSER_FALLBACKS = {
            edge: {
                narrator: ["Ava Online"],
                male: ["Christopher Online", "Andrew Online"],
                female: ["Michelle Online", "Libby Online", "Ava Online"],
            },
            chrome: {
                narrator: ["Google US English", "Google UK English Female", "Samantha", "Ava Online"],
                male: ["Google UK English Male", "Google US English", "Alex", "Daniel", "Christopher Online"],
                female: ["Google UK English Female", "Google US English", "Samantha", "Victoria", "Michelle Online"],
            },
            firefox: {
                narrator: ["Samantha", "Victoria", "Microsoft Zira", "Google US English", "Ava Online"],
                male: ["Alex", "Daniel", "Microsoft David", "Google UK English Male", "Christopher Online"],
                female: ["Samantha", "Victoria", "Microsoft Zira", "Google UK English Female", "Michelle Online"],
            },
            safari: {
                narrator: ["Samantha", "Victoria", "Alex", "Google US English", "Ava Online"],
                male: ["Alex", "Daniel", "Fred", "Google UK English Male", "Christopher Online"],
                female: ["Samantha", "Victoria", "Karen", "Google UK English Female", "Michelle Online"],
            },
            generic: {
                narrator: ["Google US English", "Samantha", "Victoria", "Ava Online"],
                male: ["Google UK English Male", "Alex", "Daniel", "Christopher Online"],
                female: ["Google UK English Female", "Samantha", "Victoria", "Michelle Online"],
            },
        };
        function exactLeftPanelGroup(value) {
            if (!["characters", "objective", "scene"].includes(value))
                throw new Error("leftPanelGroup must be characters, objective, or scene.");
            return value;
        }
        function exactComposerMode(mode) {
            if (mode !== "act") throw new Error('composerMode must be exactly "act".');
            return mode;
        }
        const initialSettingsValidation = validateStoredSettings(
            Object.fromEntries(
                localSettingKeys().map((field) => [field, app.settings[field]]),
            ),
        );
        if (!initialSettingsValidation.ok)
            throw new Error(validationErrorsText(initialSettingsValidation));
        exactImageHistoryLimit(app.settings.imageHistoryLimit);
        exactImageRequestTimeoutSeconds(app.settings.imageRequestTimeoutSeconds);
        function validateStoredSettings(settings) {
            const fields = localSettingKeys();
            const errors = [
                ...exactObjectFieldValidationErrors(settings, fields, "settings"),
                ...requiredExactFieldsValidationErrors(settings, fields, "settings"),
            ];
            if (!isPlainObject(settings)) return validationResult(errors, []);
            for (const field of fields) {
                if (!Object.hasOwn(settings, field)) continue;
                const value = settings[field];
                const expected = defaultSettings[field];
                const valid = Array.isArray(expected)
                    ? Array.isArray(value)
                    : isPlainObject(expected)
                      ? isPlainObject(value)
                      : expected === null
                        ? value === null || typeof value === "number"
                        : typeof value === typeof expected;
                if (!valid)
                    errors.push(validationError(
                        `settings.${field}`,
                        "type",
                        `settings.${field} has the wrong type.`,
                    ));
            }
            if (Object.hasOwn(settings, "leftPanelGroup")) {
                try { exactLeftPanelGroup(settings.leftPanelGroup); }
                catch (error) {
                    errors.push(validationError("settings.leftPanelGroup", "value", error.message));
                }
            }
            if (Object.hasOwn(settings, "composerMode")) {
                try { exactComposerMode(settings.composerMode); }
                catch (error) {
                    errors.push(validationError("settings.composerMode", "value", error.message));
                }
            }



            if (Object.hasOwn(settings, "ollama")) {
                try { globalThis.EmberOllama.validate(settings.ollama); }
                catch (error) { errors.push(validationError("settings.ollama", "value", error.message)); }
            }
            return validationResult(errors, []);
        }

        function defaultStoredSettings() {
            return Object.fromEntries(
                localSettingKeys().map((field) => [field, clone(defaultSettings[field])]),
            );
        }

        function hydrateRuntimeSettingsFromExactStoredSettings(settings) {
            const validation = validateStoredSettings(settings);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            const hydrated = {
                ...clone(defaultSettings),
                ...clone(settings),
                textProvider: settings.ollama.provider,
                devMode: true,
            };
            if (EMBERADVENTURES_DEBUG_ALL_LOGS) {
                hydrated.devMode = true;
                for (const id of LOG_SETTING_IDS) hydrated[id] = true;
            }
            return hydrated;
        }


        function reducedUiEnabled() {
            return app.settings?.reducedUi !== false;
        }
        function applyReducedUiClass() {
            const enabled = reducedUiEnabled();
            const devEnabled = !!app.settings?.devMode;
            document.body?.classList.toggle("reduced-ui", enabled);
            document.body?.classList.toggle("dev-mode", devEnabled);
            $("app")?.classList.toggle("reduced-ui", enabled);
            $("app")?.classList.toggle("dev-mode", devEnabled);
            document.querySelectorAll(".dev-only-tool").forEach((element) => {
                element.hidden = !devEnabled;
                if (devEnabled) element.style.removeProperty("display");
                else element.style.setProperty("display", "none", "important");
            });
        }
        app.userProfiles = validatedUserProfiles(app.userProfiles);
        if (
            app.settings.activeUserProfileId &&
            !userProfileById(app.settings.activeUserProfileId)
        )
            app.settings.activeUserProfileId = "";
        app.images = Array.isArray(app.images) ? app.images : [];
        assertExactMessageStorage();
        app.gameSaves = Array.isArray(app.gameSaves) ? app.gameSaves : [];
        app.storyTemplates = Array.isArray(app.storyTemplates)
            ? app.storyTemplates
            : [];
        cleanImageHistoryInMemory();

        async function hydrateLargeStorageIntoApp() {
            const started = perfNow();
            const rows = [];
            const loadTimed = async (key, fallback, options = {}) => {
                const start = perfNow();
                const value = libraryRecordStorageType(key)
                    ? await loadPerRecordLibrary(key, fallback, options)
                    : await loadLargeJson(key, fallback);
                rows.push({
                    key,
                    ms: Math.round(perfNow() - start),
                    count: perfCount(value),
                });
                return value;
            };
            try {
                rows.push({ key: "normalized-storage-ready", ms: 0, count: 1 });
                // Startup accepts only current-format records. Story definitions are
                // verified below and old/uncompiled records are rejected rather than
                // migrated or repaired.
                app.snapshots = [];
                                                app.messages = [];
                app.gameSaves = [];
                app.images = [];
                [
                    app.settings,
                    app.userProfiles,
                    app.supabaseSession,
                    app.storyTemplates,
                    app.storyTitleCardImages,
                    app.characterDefinitions,
                    app.profileImages,
                    app.creatorIdentityRegistry,
                    app.stateSyncCheckpoint,
                    app.worldGenerationCheckpoint,
                ] = await Promise.all([
                    loadTimed(SETTINGS_KEY, defaultStoredSettings()),
                    loadTimed(USER_PROFILE_KEY, []),
                    loadTimed(SUPABASE_SESSION_KEY, null),
                    loadTimed(STORY_TEMPLATE_KEY, app.storyTemplates || [], {
                        deferStoryValidation: true,
                    }),
                    loadTimed(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || []),
                    loadTimed(CHARACTER_LIBRARY_KEY, app.characterDefinitions || []),
                    loadTimed(PROFILE_IMAGE_KEY, []),
                    loadTimed(CREATOR_IDENTITY_KEY, app.creatorIdentityRegistry),
                    loadTimed(STATE_SYNC_CHECKPOINT_KEY, app.stateSyncCheckpoint),
                    loadTimed(WORLD_GENERATION_CHECKPOINT_KEY, app.worldGenerationCheckpoint),
                ]);
                app.userProfiles = (app.userProfiles || []).map((profile) => ({
                    ...profile,
                    settings: profile?.settings,
                }));
                app.settings = hydrateRuntimeSettingsFromExactStoredSettings(app.settings);
                app.currentGameSaveId = "";
                app.activeSaveId = "";
                app.userProfiles = validatedUserProfiles(app.userProfiles);
                if (
                    app.settings.activeUserProfileId &&
                    !userProfileById(app.settings.activeUserProfileId)
                )
                    app.settings.activeUserProfileId = "";
                app.supabaseSession =
                    app.supabaseSession?.access_token ? app.supabaseSession : null;
                app.storyTemplates = await validateHydratedStoryTemplateRecords(
                    app.storyTemplates || [],
                );
                await loadActiveSaveFromStorage();
                app.state.meta ||= {};
                delete app.state.meta.state_version;
                perfTimed("normalize hydrated messages", assertExactMessageStorage);
                app.gameSaves = saveIndexRecords();
                app.storyTemplates = perfTimed("verify story templates", () =>
                    assertHydratedStoryTemplateRecords(app.storyTemplates || []),
                );
                await new Promise((resolve) => setTimeout(resolve, 0));
                app.storyTitleCardImages = perfTimed("normalize story title-card images", () =>
                    exactStoryTitleCardImageStore(app.storyTitleCardImages || []),
                );
                await new Promise((resolve) => setTimeout(resolve, 0));
                app.characterDefinitions = perfTimed("normalize character definitions", () =>
                    validatedCharacterLibraryDefinitions(app.characterDefinitions || []),
                );
                await new Promise((resolve) => setTimeout(resolve, 0));
                app.images = perfTimed("clean hydrated image history", () =>
                    safeImageHistoryForStorage(app.images || []),
                );
                app.profileImages = perfTimed("normalize hydrated profile images", () =>
                    exactProfileImageStore(app.profileImages || []),
                );
                app.creatorIdentityRegistry = exactCreatorIdentityRegistry(
                    app.creatorIdentityRegistry,
                );
                hydrateActiveUserProfileRuntime({
                    includeSettings: true,
                    includeGameState: false,
                });
                perfTimed("clean stale library image requests", cleanupStartupStaleLibraryImageRequests);
                app.snapshots = Array.isArray(app.snapshots) ? app.snapshots : [];
            } finally {
                perfConsole("hydrateLargeStorageIntoApp", {
                    ms: Math.round(perfNow() - started),
                    rows,
                }, perfNow() - started >= 500 ? "warn" : "log");
            }
        }
        refreshKeptImageRuntimeSet();
        pruneImageHistory(false);
        refreshKeptImageRuntimeSet();
        setSaveIndexRecords(app.saveIndex || []);
        hydrateActiveUserProfileRuntime({
            includeSettings: true,
            includeGameState: false,
        });
        const $ = (id) => document.getElementById(id);
        const escapeHtml = (text) =>
            String(text ?? "").replace(
                /[&<>"']/g,
                (c) =>
                    ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#39;",
                    })[c],
            );
        const htmlJsArg = (value) => escapeHtml(JSON.stringify(value));
        const cssEscape = (value) =>
            window.CSS?.escape
                ? window.CSS.escape(String(value ?? ""))
                : String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");

        function perchancePlugin(name) {
            const testOverride =
                window?.__emberAdventuresPluginOverrides?.[name] ||
                globalThis?.__emberAdventuresPluginOverrides?.[name];
            if (typeof testOverride === "function") return testOverride;
            const fromWindow = window?.[name] || root?.[name];
            if (typeof fromWindow === "function") return fromWindow;

            if (name === "aiTextPlugin" && typeof aiTextPlugin !== "undefined")
                return aiTextPlugin;
            if (
                name === "textToImagePlugin" &&
                typeof textToImagePlugin !== "undefined"
            )
                return textToImagePlugin;
            if (name === "uploadPlugin" && typeof uploadPlugin !== "undefined")
                return uploadPlugin;
            return null;
        }


        function initializeAiTextPlugin() {
            const aiPlugin = perchancePlugin("aiTextPlugin");
            if (!aiPlugin) return;
            try {
                const meta = aiPlugin({ getMetaObject: true });
                if (meta?.countTokens) window.countTokens = meta.countTokens;
                if (meta?.idealMaxContextTokens)
                    window.idealMaxContextTokens = meta.idealMaxContextTokens;
            } catch (err) {
                log("AI plugin metadata failed", err.message || err, {
                    type: "ai",
                    level: "error",
                });
            }
        }

        async function prepareAiTextPluginFrame(isStreaming = false) {
            // render() can replace app DOM immediately before an AI call, while
            // Perchance's ai-text-plugin depends on a hidden iframe. Prepare the
            // plugin for every AI call, including non-streaming JSON setup calls
            // like Check Story, so the plugin does not hit contentWindow=null.
            // This must be a real short settle delay, not just animation frames:
            // the Perchance plugin can need a moment to recreate its iframe after
            // editor reloads, modal renders, or quick back-to-back AI calls.
            initializeAiTextPlugin();
            await new Promise((resolve) =>
                setTimeout(resolve, isStreaming ? 350 : 500),
            );
        }

        function largeStorageDiagnosticLog(title, detail = {}, level = "message") {
            const entry = {
                title: `IndexedDB diagnostic: ${title}`,
                type: "troubleshooting",
                logType: "troubleshooting",
                logLevel: level,
                detail,
                at: new Date().toISOString(),
            };
            writeConsoleLog(entry);
            recordDevTraceEntry(entry);
        }

        async function deleteNamedLargeStorageDatabase(dbName = LARGE_STORAGE_DB_NAME) {
            const name = String(dbName || LARGE_STORAGE_DB_NAME).trim() || LARGE_STORAGE_DB_NAME;
            if (name !== LARGE_STORAGE_DB_NAME)
                throw new Error(`The persistence worker does not own database ${name}.`);
            largeStorageDiagnosticLog("manual database deletion requested", {
                databaseName: name,
                runtimeDisposed: !!globalThis.EmberRuntime,
            });
            globalThis.EmberRuntime.dispose();
            const result = await persistenceWorkerClient.request("database-delete-all");
            largeStorageDiagnosticLog("manual database deletion completed", result);
            await persistenceWorkerClient.reinitialize();
            await globalThis.EmberRuntime.start();
            app.persistence = globalThis.EmberRuntime.persistence;
            app.library = globalThis.EmberRuntime.library;
            app.turn = globalThis.EmberRuntime.turn;
            return result;
        }

        async function resetAppAfterLargeStorageDatabaseDelete() {
            cancelSmokeSuiteScenarioWork("manual database deletion");
            app.snapshots = [];
                                    app.messages = [];
            app.images = [];
            app.newGameChatScrollToTop = false;
            app.existingGameChatScrollToBottom = false;
            app.profileImages = [];
            app.storyTemplates = [];
            app.storyTitleCardImages = [];
            app.characterDefinitions = [];
            app.creatorIdentityRegistry = { identities: [], last_used_creator_id: "" };
            app.stateSyncCheckpoint = null;
            app.worldGenerationCheckpoint = null;
            app.publicLibrarySearchCache = {
                version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
                entries: {},
            };
            app.publicLibrarySearchCacheLoaded = false;
            app.storyLibraryPublicSearch = {};
            app.storyLibraryPublicPayloads = {};
            app.storyLibraryOwnedStoryEntries = [];
            app.characterLibraryPublicSearch = {};
            app.characterLibraryPublicPayloads = {};
            app.characterLibraryOwnedCharacterEntries = [];
            app.characterLibraryRecordsCache = null;
            setSaveIndexRecords([]);
            setActiveSaveId("");
            app.state = clone(defaultState);
            app.profileImagesBootstrapped = false;
            app.keptImageIds = null;
            app.mainMenuOpen = true;
            await hydrateLargeStorageIntoApp();
            hydrateActiveUserProfileRuntime({
                includeSettings: true,
                includeGameState: false,
            });
            saveSettingsNow("database deleted");
            renderMainMenu();
            render();
        }

        async function confirmDeleteDatabase() {
            const confirmed = await showConfirm(
                "Delete DB",
                "Delete every local EmberAdventures and EmberQuest IndexedDB database on this browser and re-initialize EmberAdventures empty?",
                {
                    confirmText: "Delete DB",
                    cancelText: "Cancel",
                    danger: true,
                    warningText:
                        "This deletes local saves, story library entries, character library entries, profile images, story images, cached public-library data, generated storage records, and recognized old EmberAdventures/EmberQuest databases in this browser. This cannot be undone.",
                },
            );
            if (!confirmed) return false;
            const blockingId = beginBlockingUiAction("Deleting database");
            await waitForRenderedFrame();
            try {
                // Deletion is the recovery action. Flushing first can wait on a
                // large trace/save queue and prevent the delete request from
                // ever reaching the worker.
                const deleted = await deleteNamedLargeStorageDatabase(
                    LARGE_STORAGE_DB_NAME,
                );
                await resetAppAfterLargeStorageDatabaseDelete();
                const deletedNames = Array.isArray(deleted?.deleted)
                    ? deleted.deleted.join(", ")
                    : "EmberAdventures local databases";
                await showNotice(
                    "DB Deleted",
                    `Deleted and re-initialized: ${deletedNames}.`,
                );
                return true;
            } catch (err) {
                await showNotice("Delete Failed", err.message || String(err));
                return false;
            } finally {
                endBlockingUiAction(blockingId);
            }
        }

        function setObjectiveRuntimeOutputSelection(
            state = app.state,
            objectiveOrId = "",
            outputId = "",
        ) {
            const id = String(
                typeof objectiveOrId === "object"
                    ? objectiveOrId?.id || ""
                    : objectiveOrId || "",
            ).trim();
            if (!id)
                throw new Error(
                    "Objective id is required for a runtime output update.",
                );
            const objective =
                typeof objectiveOrId === "object"
                    ? objectiveOrId
                    : (state?.objectives?.items || []).find(
                          (item) => String(item?.id || "") === id,
                      );
            captureObjectiveMutationEntry(state, objective || id);
            if (objective) {
                if (outputId)
                    objective.selected_output_id = String(outputId);
                else delete objective.selected_output_id;
            }
            if (state === app.state) {
                app.objectiveRuntime ||= objectiveRuntimeFromState(
                    state,
                    app.storyDefinition,
                );
                app.objectiveRuntime.selectedOutputById ||= {};
                if (outputId)
                    app.objectiveRuntime.selectedOutputById[id] =
                        String(outputId);
                else delete app.objectiveRuntime.selectedOutputById[id];
                markRuntimeRecordDirty("objective-runtime", "current");
                bumpDomainRevision("objectives");
            }
        }

        async function largeStorageGetFromDb(dbName, key) {
            const started = perfNow();
            const name = String(dbName || LARGE_STORAGE_DB_NAME).trim() || LARGE_STORAGE_DB_NAME;
            if (name !== LARGE_STORAGE_DB_NAME)
                throw new Error(`The persistence worker does not own database ${name}.`);
            const values = await app.library.listSettings();
            const value = values?.[key];
            const ms = perfNow() - started;
            if (ms >= 100)
                perfConsole(
                    "largeStorageGet",
                    {
                        dbName,
                        key,
                        ms: Math.round(ms),
                        worker: true,
                    },
                    "warn",
                );
            return value;
        }

        async function largeStorageGet(key) {
            return largeStorageGetFromDb(LARGE_STORAGE_DB_NAME, key);
        }

        async function largeStorageSet(key, value) {
            if (key === USER_PROFILE_KEY)
                throw new Error("User profiles must be written through the profile store, not settings storage.");
            const started = perfNow();
            await app.library.putSettings({ [key]: value });
            const ms = perfNow() - started;
            const bytes = perfBytes(value);
            if (ms >= 100 || bytes >= 500000)
                perfConsole(
                    "largeStorageSet",
                    { key, ms: Math.round(ms), kb: perfKb(bytes), worker: true },
                    ms >= 250 || bytes >= 2000000 ? "warn" : "log",
                );
            return true;
        }

        async function largeStorageSetJson(key, value) {
            if (key === USER_PROFILE_KEY)
                throw new Error("User profiles must be written through the profile store, not settings storage.");
            const started = perfNow();
            const result = await app.library.putSettings({ [key]: value });
            const ms = perfNow() - started;
            if (ms >= 100)
                perfConsole(
                    "largeStorageSetJson",
                    { key, ms: Math.round(ms), worker: true },
                    ms >= 250 ? "warn" : "log",
                );
            return result;
        }

        async function largeStorageRemove(key) {
            const started = perfNow();
            await app.library.deleteSettings([key]);
            const ms = perfNow() - started;
            if (ms >= 100)
                perfConsole(
                    "largeStorageRemove",
                    { key, ms: Math.round(ms), worker: true },
                    "warn",
                );
            return true;
        }

        async function loadLargeJson(key, fallback) {
            try {
                if (key === USER_PROFILE_KEY) {
                    const profiles = await app.library.listProfiles();
                    return clone(profiles);
                }
                const values = await app.library.listSettings();
                const stored = values?.[key];
                return stored ?? clone(fallback);
            } catch (err) {
                recordStorageFailure(key, err);
                throw err;
            }
        }

        function libraryRecordStorageType(key = "") {
            const text = String(key || "");
            if (text === STORY_TEMPLATE_KEY) return "story";
            if (text === STORY_TITLE_CARD_IMAGE_KEY) return "story-title-image";
            if (text === CHARACTER_LIBRARY_KEY) return "character";
            if (text === PROFILE_IMAGE_KEY) return "profile-image";
            return "";
        }

        function libraryRecordStorageLabel(key = "") {
            const type = libraryRecordStorageType(key);
            if (type === "story") return "stories";
            if (type === "story-title-image") return "story images";
            if (type === "character") return "characters";
            if (type === "profile-image") return "profile images";
            return "library";
        }

        function libraryRecordStorageId(key = "", record = {}) {
            const type = libraryRecordStorageType(key);
            if (!type) throw new Error(`Unknown library record storage key ${JSON.stringify(key)}.`);
            if (!isPlainObject(record)) throw new Error(`${type} library record must be an object.`);
            if (typeof record.id !== "string" || !record.id || record.id.trim() !== record.id)
                throw new Error(`${type} library record id must be exact non-empty trimmed text.`);
            return record.id;
        }

        function exactLibraryRecordDeletionReferences(records) {
            if (!Array.isArray(records))
                throw new Error("Library record deletion references must be an array.");
            const ids = new Set();
            return records.map((record, index) => {
                const path = `library deletion references.${index}`;
                if (!isPlainObject(record)) throw new Error(`${path} must be an object.`);
                const fields = Object.keys(record);
                if (fields.length !== 1 || fields[0] !== "id")
                    throw new Error(`${path} must contain only id.`);
                if (typeof record.id !== "string" || !record.id || record.id.trim() !== record.id)
                    throw new Error(`${path}.id must be exact non-empty trimmed text.`);
                if (ids.has(record.id)) throw new Error(`${path}.id duplicates ${record.id}.`);
                ids.add(record.id);
                return { id: record.id };
            });
        }

        function libraryImageRecordType(type = "") {
            return type === "story-title-image" || type === "profile-image";
        }

        function libraryRecordCreatorIdentity(type = "", record = {}, fallback = null) {
            if (fallback) return exactCreatorIdentity(fallback);
            const creatorId = type === "story"
                ? definitionCreatorId(record)
                : textSlot(record?.creator_id, "");
            const creatorName = type === "story"
                ? storyLibraryCreator(record)
                : textSlot(record?.creator, "");
            if (!creatorId || !creatorName) return null;
            const registered = creatorIdentityById(creatorId);
            if (
                registered &&
                registered.creator_name === creatorName
            )
                return registered;
            return createCreatorIdentityRecord({
                creator_id: creatorId,
                creator_name: creatorName,
            });
        }

        function sessionImageObjectUrlCache() {
            root.__emberAdventuresImageObjectUrls ||= new Map();
            return root.__emberAdventuresImageObjectUrls;
        }

        function revokeSessionImageObjectUrl(rowKey = "") {
            const key = String(rowKey || "");
            const cache = sessionImageObjectUrlCache();
            const url = cache.get(key);
            if (!url) return false;
            URL.revokeObjectURL(url);
            cache.delete(key);
            return true;
        }

        function forgetSessionImageObjectUrl(rowKey = "") {
            return sessionImageObjectUrlCache().delete(String(rowKey || ""));
        }

        function sessionImageObjectUrl(rowKey = "", blob = null) {
            if (!(blob instanceof Blob)) return "";
            const key = String(rowKey || "");
            const cache = sessionImageObjectUrlCache();
            if (cache.has(key)) return cache.get(key);
            const url = URL.createObjectURL(blob);
            cache.set(key, url);
            return url;
        }

        async function libraryStorageRow(key = "", record = {}, now = new Date().toISOString()) {
            const type = libraryRecordStorageType(key);
            const id = libraryRecordStorageId(key, record);
            if (!type || !id) return null;
            const rowKey = `${type}|${id}`;
            const value = clone(record);
            let blob = null;
            if (type === "character" && isPlainObject(value.character?.default_profile_image)) {
                const slot = value.character.default_profile_image;
                const localSrc = extractImageSrc(slot.html) || textSlot(slot.url, "");
                if (slot.local_image_id && /^(?:data:image\/|blob:)/i.test(localSrc)) {
                    slot.html = "";
                    slot.url = "";
                }
            }
            if (libraryImageRecordType(type)) {
                const src = extractImageSrc(value.html) || textSlot(value.url, "");
                if (/^(?:data:image\/|blob:)/i.test(src)) {
                    const response = await fetch(src);
                    blob = await response.blob();
                    value.html = "";
                    value.url = "";
                }
            }
            return {
                key: rowKey,
                type,
                id,
                updated_at: now,
                value,
                blob,
            };
        }

        function libraryRecordFromStorageRow(row = {}) {
            const value = clone(row.value);
            if (!value || !libraryImageRecordType(row.type) || !(row.blob instanceof Blob))
                return value;
            const url = sessionImageObjectUrl(row.key, row.blob);
            value.url = url;
            value.html = `<img loading="lazy" decoding="async" src="${escapeHtml(url)}">`;
            return value;
        }

        function exactLibraryCollection(key = "", records = []) {
            if (key === STORY_TEMPLATE_KEY)
                return assertHydratedStoryTemplateRecords(records);
            if (key === STORY_TITLE_CARD_IMAGE_KEY)
                return exactStoryTitleCardImageStore(records);
            if (key === CHARACTER_LIBRARY_KEY)
                return validatedCharacterLibraryDefinitions(records);
            if (key === PROFILE_IMAGE_KEY) return exactProfileImageStore(records);
            throw new Error(`Unknown library collection key ${JSON.stringify(key)}.`);
        }

        function compactActivityLabel(label = "Working") {
            const text = String(label || "Working").replace(/\s+/g, " ").trim();
            if (!text) return "Working";
            const importCount = text.match(/\bimport(?:ing)?\b[^\d]*(\d+\s*\/\s*\d+)/i);
            if (importCount) return `Importing ${importCount[1].replace(/\s+/g, "")}`;
            if (/\bimport/i.test(text)) return "Importing";
            if (/\bexport/i.test(text)) return "Exporting";
            if (/\bsav/i.test(text)) return "Saving";
            if (/\bload/i.test(text)) return "Loading";
            if (/\bgenerat/i.test(text)) return "Generating";
            return text.length <= 24 ? text : `${text.slice(0, 23).trim()}…`;
        }

        function renderActivityIndicator() {
            const tasks = [...(app.activityTasks?.values?.() || [])];
            const indicator = document.getElementById("emberAdventuresActivityIndicator");
            if (!tasks.length) {
                indicator?.remove();
                return;
            }
            const active = tasks
                .slice()
                .sort((left, right) =>
                    Number(right.priority || 0) - Number(left.priority || 0) ||
                    Number(right.startedAt || 0) - Number(left.startedAt || 0),
                )[0];
            const total = Math.max(0, Number(active.total || 0));
            const completed = Math.max(0, Math.min(total, Number(active.completed || 0)));
            const percent = total ? Math.round((completed / total) * 100) : 0;
            const progressHtml = total
                ? `<div style="display:grid;gap:.2rem;min-width:12rem">
                    <span data-activity-label>${escapeHtml(active.label)}</span>
                    <div style="height:.42rem;overflow:hidden;border:1px solid rgba(221,170,86,.45);border-radius:999px;background:#11141a">
                        <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#d69b39,#69d68a);transition:width 120ms ease"></div>
                    </div>
                    <small style="max-width:20rem;overflow:hidden;color:#c9c2b5;font-weight:600;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(`${completed}/${total}${active.detail ? ` - ${active.detail}` : ""}`)}</small>
                </div>`
                : `<span data-activity-label>${escapeHtml(active.label)}</span>`;
            const html = `${loadingSpinnerHtml(active.label)}${progressHtml}`;
            if (indicator) {
                indicator.innerHTML = html;
                indicator.setAttribute("aria-label", active.label);
                return;
            }
            const next = document.createElement("div");
            next.id = "emberAdventuresActivityIndicator";
            next.setAttribute("role", "status");
            next.setAttribute("aria-live", "polite");
            next.setAttribute("aria-label", active.label);
            next.style.cssText = [
                "position:fixed",
                "left:1rem",
                "top:1rem",
                "z-index:2147483645",
                "display:flex",
                "align-items:center",
                "gap:.45rem",
                "max-width:24rem",
                "padding:.4rem .6rem",
                "border:1px solid rgba(221,170,86,.55)",
                "border-radius:6px",
                "background:rgba(14,18,27,.94)",
                "box-shadow:0 10px 28px rgba(0,0,0,.32)",
                "color:#f7e4b5",
                "font:700 .82rem system-ui,sans-serif",
                "pointer-events:none",
            ].join(";");
            next.innerHTML = html;
            document.body?.appendChild(next);
        }

        function beginActivityTask(label = "Working", options = {}) {
            const id = String(options.id || `activity-${app.activityTaskNextId++}`);
            const task = {
                id,
                label: compactActivityLabel(label),
                priority: Number(options.priority || 0),
                startedAt: Date.now(),
                kind: String(options.kind || "background"),
            };
            app.activityTasks.set(id, task);
            app.activityTaskStartedAt ||= task.startedAt;
            renderActivityIndicator();
            return id;
        }

        function updateActivityTask(id = "", label = "") {
            const task = app.activityTasks?.get?.(String(id || ""));
            if (!task) return false;
            task.label = compactActivityLabel(label || task.label);
            renderActivityIndicator();
            return true;
        }

        function endActivityTask(id = "") {
            if (!app.activityTasks?.delete?.(String(id || ""))) return false;
            if (!app.activityTasks.size) app.activityTaskStartedAt = 0;
            renderActivityIndicator();
            return true;
        }

        async function withActivityTask(label, action, options = {}) {
            const id = beginActivityTask(label, options);
            try {
                return await action({
                    activityId: id,
                    update: (nextLabel) => updateActivityTask(id, nextLabel),
                });
            } finally {
                endActivityTask(id);
            }
        }

        const UI_ACTION_CATALOG = Object.freeze({
            blocking: Object.freeze({
                openMainMenu: "Opening main menu",
                openWorldModal: "Starting adventure",
                importData: "Importing backup",
                startStoryTemplatePlayerChoice: "Starting adventure",
                startStoryTemplateLibraryPlayerChoice: "Starting adventure",
                openStoryBuilder: "Opening story editor",
                openStoryLibraryDetail: "Loading story",
                openPublicStoryLibraryDetail: "Loading story",
                openCharacterLibraryDetail: "Loading character",
                openPublicCharacterLibraryDetail: "Loading character",
                createManualStoryTemplate: "Creating story",
                resumeWorldGenerationCheckpoint: "Loading world",
                startAiStoryCreationFromBuilder: "Creating story",
            }),
            activity: Object.freeze({
                importCharacters: "Importing characters",
                importPartyCharacters: "Importing characters",
                importNpcs: "Importing NPCs",
                importCharacterDefinitions: "Importing characters",
                importCharacterDefinitionsFromRecords: "Importing characters",
                importPlayer: "Importing player",
                importMainMenuProfile: "Importing profile",
                importGameSave: "Importing save",
                importPublicLibraryEntry: "Importing",
                importPublicLibraryEntryVersion: "Importing",
                importPublicCharacterToLibrary: "Importing character",
                importPublicStoryToLibrary: "Importing story",
                reloadCuratedPublicStoryRails: "Loading stories",
                refreshPublicLibraryUser: "Refreshing account",
                importHostedImageUrl: "Importing image",
                storyBuilderImportJson: "Importing story",
            }),
            both: Object.freeze({
                exportData: "Exporting backup",
                exportDevTrace: "Exporting log",
                issueExportBoth: "Exporting diagnostics",
                exportGameSave: "Exporting save",
                backupNow: "Exporting backup",
                emergencyExportData: "Exporting diagnostics",
                exportMainMenuProfile: "Exporting profile",
                exportPlayerCharacter: "Exporting player",
                exportCharacter: "Exporting character",
                exportSelectedCharacters: "Exporting characters",
                exportNpc: "Exporting NPC",
                exportSelectedNpcs: "Exporting NPCs",
                exportCharacterLibraryDefinition: "Exporting character",
                exportStoryTemplate: "Exporting story",
                exportStoryBuilderDraft: "Exporting story",
                exportWorldGenerationCheckpoint: "Exporting world",
                downloadImageRecord: "Exporting image",
                downloadProfileImageRecord: "Exporting image",
                downloadStoryTitleCardRecord: "Exporting image",
                downloadPromptEditorTranscript: "Exporting transcript",
                downloadPromptEditorTranscriptItem: "Exporting transcript",
                exportAllImages: "Exporting images",
                importAllImages: "Importing images",
                downloadAllKeptImages: "Exporting images",
                uploadImageMetadata: "Uploading images",
                downloadSmokeSuiteReport: "Exporting report",
                uploadStoryTemplate: "Importing story",
                publishStoryTemplateToPublicIndex: "Publishing story",
                publishCharacterLibraryDefinition: "Publishing character",
                publishCharacterToPublicIndex: "Publishing character",
                publishSelectedCharactersToPublicIndex: "Publishing characters",
                publishNpcToPublicIndex: "Publishing NPC",
                publishSelectedNpcsToPublicIndex: "Publishing NPCs",
                publishPlayerCharacterToPublicIndex: "Publishing player",
                publishImageRecordToPublicIndex: "Publishing image",
                shareStoryTemplate: "Sharing story",
                shareCharacterLibraryDefinition: "Sharing character",
                shareCharacter: "Sharing character",
                shareSelectedCharacters: "Sharing characters",
                shareNpc: "Sharing NPC",
                shareSelectedNpcs: "Sharing NPCs",
                sharePlayerCharacter: "Sharing player",
                shareImageRecord: "Sharing image",
                shareProfileImageRecord: "Sharing image",
                inspectOwnedPublicLibraryUploads: "Loading uploads",
                runHostedJsonUploadTest: "Testing upload",
                runHostedImageUploadTest: "Testing upload",
                storyBuilderGenerateAllMissingImages: "Generating images",
                submitDeveloperIssue: "Sending report",
            }),
            button: Object.freeze({
                deleteStoryTemplate: "Deleting",
                deleteCharacterLibraryDefinition: "Deleting",
                deleteMainMenuProfile: "Deleting",
                deleteGameSave: "Deleting",
                deleteImageRecord: "Deleting",
                deleteProfileImage: "Deleting",
                deleteStoryTitleCardImage: "Deleting",
                deleteNpc: "Deleting",
                deleteMapLocation: "Deleting",
                deleteCharacter: "Deleting",
                deleteNpc: "Deleting",
                deletePromptEditorTranscriptItem: "Deleting",
                storyBuilderDeleteCastEntry: "Deleting",
                storyBuilderDeleteFutureCharacter: "Deleting",
                storyBuilderDeleteObjective: "Deleting",
                storyBuilderDeleteOutcomeRoute: "Deleting",
                renameGameSave: "Renaming",
                saveManualCharacterCreateModal: "Saving",
                saveRuntimeCharacterToLibrary: "Saving",
                saveCharacterLibraryDefinitionEditor: "Saving",
                saveCharacterLibrarySettings: "Saving",
                saveMapLocationFromEditor: "Saving",
                saveNpcShellEditor: "Saving",
                saveSetObjectiveModal: "Saving",
                storyBuilderSaveCharacterDefinition: "Saving",
                saveStoryBuilderDraft: "Saving",
                storyBuilderGenerateTitleCardImage: "Generating",
                storyBuilderGenerateDefaultProfileImage: "Generating",
                storyBuilderGenerateUnlockImage: "Generating",
                storyBuilderGenerateManifestImage: "Generating",
                generateStoryTemplateTitleCardImage: "Generating",
                generateProfileImage: "Generating",
                generateDefaultProfileImageForCharacter: "Generating",
                sendPromptEditorImage: "Generating",
                generateImageLabFreeform: "Generating",
                inspectNpc: "Inspecting",
                buyStoryShopCharacter: "Buying",
                buyStoryGeneralShopItem: "Buying",
                buyStoryClothingShopOutfit: "Buying",
                sellStoryInventoryItem: "Selling",
                sellAllStoryLoot: "Selling",
                acceptStoryJob: "Accepting",
                acceptGeneratedJob: "Accepting",
                abandonGeneratedJob: "Abandoning",
                resolvePendingRewardChoice: "Choosing",
                confirmDirectObjectiveChoice: "Choosing",
                choosePendingObjective: "Choosing",
                travelToMapLocation: "Traveling",
                scenePreset: "Updating",
                selectCharacterOutfit: "Updating",
                saveCharacterCurrentOutfit: "Saving",
                selectProfileImageFromUi: "Saving",
                editMessage: "Updating",
                deleteMessage: "Deleting",
                redoMessage: "Regenerating",
                signInPublicLibraryWithGoogle: "Signing in",
                signOutPublicLibrary: "Signing out",
                submitPublicStoryRating: "Submitting",
                removePublicStoryRating: "Removing",
                submitPublicLibraryReport: "Submitting",
                runPublicCharacterSearch: "Searching",
                runPublicStorySearch: "Searching",
                runUnifiedLibraryPublicSearch: "Searching",
                loadPublishedMineItems: "Loading",
                publicLibraryPreviousPage: "Loading",
                publicLibraryNextPage: "Loading",
                setOwnedPublicLibraryItemVisibility: "Updating",
            }),
            cooldown: Object.freeze({
                requestManualImage: Object.freeze({
                    label: "Generating",
                    cooldownMs: 2000,
                }),
            }),
            gameOver: Object.freeze([
                "sendUserMessage",
                "continueScene",
                "requestImage",
                "requestManualImage",
                "openAiCommandModal",
                "submitAiCommandFromModal",
                "rollD20",
                "openFindCharacterModal",
                "submitStoryShopChatMessage",
                "requestStoryShopChatImage",
                "waitForNewGeneratedJobs",
                "confirmDirectObjectiveChoice",
                "resolvePendingRewardChoice",
                "choosePendingObjective",
                "acceptObjectiveSuggestion",
                "dismissObjectiveSuggestion",
                "waitForStoryTimelineEvent",
                "openStoryTimelineEventPrompt",
                "declineTimelineEventFromUi",
                "travelToMapLocation",
                "buyStoryShopCharacter",
                "buyStoryGeneralShopItem",
                "buyStoryClothingShopOutfit",
                "sellStoryInventoryItem",
                "sellAllStoryLoot",
                "acceptStoryJob",
                "acceptGeneratedJob",
                "abandonGeneratedJob",
                "scenePreset",
                "selectCharacterOutfit",
                "saveCharacterCurrentOutfit",
                "editMessage",
                "deleteMessage",
                "redoMessage",
                "inviteNpc",
                "removeNpcFromScene",
                "toggleNpcScenePresence",
                "selectSexPosition",
                "clearSexPosition",
                "swapSexAct",
                "deleteSexAct",
            ]),
        });

        const UI_ACTION_BUTTON_IDS = Object.freeze({
            sendBtn: "sendUserMessage",
            continueBtn: "continueScene",
            imageBtn: "requestManualImage",
            exportBtn: "exportData",
            importBtn: "importData",
        });

        function uiActionConfig(name = "") {
            const actionName = String(name || "");
            const group = "";
            if (UI_ACTION_CATALOG.blocking[actionName])
                return {
                    mode: "blocking",
                    label: UI_ACTION_CATALOG.blocking[actionName],
                    group,
                };
            if (UI_ACTION_CATALOG.both[actionName])
                return {
                    mode: "both",
                    label: UI_ACTION_CATALOG.both[actionName],
                    group,
                };
            if (UI_ACTION_CATALOG.activity[actionName])
                return {
                    mode: "activity",
                    label: UI_ACTION_CATALOG.activity[actionName],
                    group,
                };
            if (UI_ACTION_CATALOG.button[actionName])
                return {
                    mode: "button",
                    label: UI_ACTION_CATALOG.button[actionName],
                    group,
                };
            if (UI_ACTION_CATALOG.cooldown[actionName])
                return {
                    mode: "cooldown",
                    label: UI_ACTION_CATALOG.cooldown[actionName].label,
                    group,
                    cooldownMs: UI_ACTION_CATALOG.cooldown[actionName].cooldownMs,
                };
            return null;
        }

        function uiActionNameForButton(button) {
            if (!(button instanceof HTMLButtonElement)) return "";
            if (button.dataset.uiAction) return button.dataset.uiAction;
            if (button.id && UI_ACTION_BUTTON_IDS[button.id])
                return UI_ACTION_BUTTON_IDS[button.id];
            const source = button.getAttribute("onclick") || "";
            return source.match(/EmberAdventures\.([A-Za-z0-9_$]+)\s*\(/)?.[1] || "";
        }

        function uiActionIsBusy(name = "") {
            return app.uiBusyActions.has(String(name || ""));
        }

        function uiActionGroupIsBusy(group = "") {
            return Number(app.uiBusyGroups.get(String(group || "")) || 0) > 0;
        }

        function refreshUiBusyButtons() {
            for (const button of document.querySelectorAll("button")) {
                const actionName = uiActionNameForButton(button);
                const config = uiActionConfig(actionName);
                const gameOverManaged = UI_ACTION_CATALOG.gameOver.includes(actionName);
                const managed = !!config || gameOverManaged;
                const actionBusy = managed && uiActionIsBusy(actionName);
                const groupBusy =
                    managed && config?.group && uiActionGroupIsBusy(config.group);
                const gameOverBlocked = gameOverManaged && gameIsOver();
                const shouldDisable = !!(actionBusy || groupBusy || gameOverBlocked);
                if (shouldDisable && button.dataset.uiBusyManaged !== "1") {
                    button.dataset.uiBusyManaged = "1";
                    button.dataset.uiBusyWasDisabled = button.disabled ? "1" : "0";
                }
                if (button.dataset.uiBusyManaged === "1") {
                    button.disabled =
                        shouldDisable || button.dataset.uiBusyWasDisabled === "1";
                    if (!shouldDisable) {
                        delete button.dataset.uiBusyManaged;
                        delete button.dataset.uiBusyWasDisabled;
                    }
                }
                button.classList.toggle("ui-action-loading", !!actionBusy);
                if (actionBusy) button.setAttribute("aria-busy", "true");
                else button.removeAttribute("aria-busy");
            }
        }

        function scheduleUiBusyButtonRefresh() {
            if (app.uiBusyRefreshQueued) return;
            app.uiBusyRefreshQueued = true;
            queueMicrotask(() => {
                app.uiBusyRefreshQueued = false;
                refreshUiBusyButtons();
            });
        }

        function installUiBusyObserver() {
            if (app.uiBusyObserver || !document.body) return;
            app.uiBusyObserver = new MutationObserver((records) => {
                if (records.some((record) => record.type === "childList"))
                    scheduleUiBusyButtonRefresh();
            });
            app.uiBusyObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
            refreshUiBusyButtons();
        }

        function beginBlockingUiAction(label = "Loading") {
            const token = `blocking-ui-${app.uiBusyNextId++}`;
            const popup = openPopupModal(`
                <section class="story-start-loading" data-ui-blocking-action="${escapeHtml(token)}">
                    ${loadingSpinnerHtml(label)}
                    <h2>${escapeHtml(label)}</h2>
                    <p class="hint">Please wait...</p>
                </section>
            `);
            popup.overlay.dataset.uiBlockingActionOverlay = token;
            app.blockingUiActions.push(token);
            return token;
        }

        function endBlockingUiAction(token = "") {
            app.blockingUiActions = app.blockingUiActions.filter(
                (item) => item !== token,
            );
            const active = document.querySelector(
                `[data-ui-blocking-action="${cssEscape(token)}"]`,
            );
            active?.closest?.(".popup-modal")?.remove();
        }

        function beginUiAction(name = "", config = {}) {
            const actionName = String(name || "");
            if (!actionName) return null;
            const group = String(config.group || "");
            if (uiActionIsBusy(actionName) || (group && uiActionGroupIsBusy(group))) {
                log(
                    "UI action ignored while busy",
                    `${actionName}${group ? ` (${group})` : ""}`,
                    { type: "ui", level: "message" },
                );
                return null;
            }
            const token = {
                id: `ui-action-${app.uiBusyNextId++}`,
                name: actionName,
                group,
                activityId: "",
                blockingId: "",
            };
            app.uiBusyActions.set(actionName, token);
            if (group)
                app.uiBusyGroups.set(group, Number(app.uiBusyGroups.get(group) || 0) + 1);
            if (config.mode === "activity" || config.mode === "both")
                token.activityId = beginActivityTask(config.label || "Working", {
                    priority: config.mode === "both" ? 60 : 30,
                    kind: "requested",
                });
            if (config.mode === "blocking")
                token.blockingId = beginBlockingUiAction(config.label || "Loading");
            refreshUiBusyButtons();
            return token;
        }

        function endUiAction(token) {
            if (!token) return;
            if (app.uiBusyActions.get(token.name)?.id === token.id)
                app.uiBusyActions.delete(token.name);
            if (token.group) {
                const remaining = Math.max(
                    0,
                    Number(app.uiBusyGroups.get(token.group) || 1) - 1,
                );
                if (remaining) app.uiBusyGroups.set(token.group, remaining);
                else app.uiBusyGroups.delete(token.group);
            }
            if (token.activityId) endActivityTask(token.activityId);
            if (token.blockingId) endBlockingUiAction(token.blockingId);
            refreshUiBusyButtons();
        }

        function runUiAction(name, action, config = uiActionConfig(name)) {
            if (!config) return action();
            const token = beginUiAction(name, config);
            if (!token) return false;
            if (config.mode === "cooldown") {
                try {
                    const result = action();
                    setTimeout(
                        () => endUiAction(token),
                        Math.max(0, Number(config.cooldownMs) || 0),
                    );
                    return result;
                } catch (error) {
                    endUiAction(token);
                    throw error;
                }
            }
            const invoke = () => {
                try {
                    const result = action();
                    if (result && typeof result.then === "function")
                        return result.finally(() => endUiAction(token));
                    endUiAction(token);
                    return result;
                } catch (error) {
                    endUiAction(token);
                    throw error;
                }
            };
            if (!["blocking", "activity", "both"].includes(config.mode))
                return invoke();
            return waitForRenderedFrame().then(invoke, (error) => {
                endUiAction(token);
                throw error;
            });
        }

        function installUiActionWrappers(api = {}) {
            const actionNames = new Set([
                ...Object.keys(UI_ACTION_CATALOG.blocking),
                ...Object.keys(UI_ACTION_CATALOG.activity),
                ...Object.keys(UI_ACTION_CATALOG.both),
                ...Object.keys(UI_ACTION_CATALOG.button),
                ...Object.keys(UI_ACTION_CATALOG.cooldown),
            ]);
            for (const name of actionNames) {
                const original = api[name];
                if (typeof original !== "function" || original.__uiActionWrapped) continue;
                const wrapped = function (...args) {
                    return runUiAction(name, () => original.apply(this, args));
                };
                wrapped.__uiActionWrapped = true;
                wrapped.__uiActionOriginal = original;
                api[name] = wrapped;
            }
            installUiBusyObserver();
            return api;
        }

        function currentGameStateRevision() {
            return Number(app.gameStateRevision || 1);
        }

        function noteGameStateRevision(reason = "state changed") {
            app.gameStateRevision = currentGameStateRevision() + 1;
            return app.gameStateRevision;
        }

        function workerTaskResultIsCurrent(context = {}) {
            return Number(context?.stateRevision || 0) === currentGameStateRevision();
        }

        async function runTurnCriticalTask(label = "Working", action, options = {}) {
            const turnId = `turn-${app.turnTaskNextId++}`;
            const stateRevision = currentGameStateRevision();
            return withActivityTask(
                label,
                ({ update }) =>
                    app.work.enqueueOrdered(
                        "turn",
                        String(options.workLabel || label || "turn task"),
                        () =>
                            action({
                                turnId,
                                stateRevision,
                                update,
                                isCurrent: () => workerTaskResultIsCurrent({ stateRevision }),
                            }),
                    ),
                { priority: 100, kind: "turn" },
            );
        }

        async function runBackgroundTask(key = "background", label = "Working", action, options = {}) {
            const stateRevision = currentGameStateRevision();
            return withActivityTask(
                label,
                ({ update }) =>
                    app.work.enqueueOrdered(
                        `background:${String(key || "work")}`,
                        String(options.workLabel || label || key || "background task"),
                        () =>
                            action({
                                stateRevision,
                                update,
                                isCurrent: () => workerTaskResultIsCurrent({ stateRevision }),
                            }),
                        {
                            coalesce: options.coalesce === true,
                            propagateError: options.propagateError === true,
                        },
                    ),
                { priority: Number(options.priority || 10), kind: "background" },
            );
        }

        function assertLibraryRecordStorageAvailable(key = "") {
            const type = libraryRecordStorageType(key);
            if (!type) return false;
            const available = type === "story" || type === "character"
                ? !!app.library
                : !!app.persistence?.started;
            if (!available)
                throw new Error(
                    `Normalized storage is required for ${libraryRecordStorageLabel(key)} storage.`,
                );
            return true;
        }

        function beginLibrarySaving(message = "Saving...") {
            app.librarySavePendingCount = (app.librarySavePendingCount || 0) + 1;
            app.librarySaveActivityLabel = message;
            clearTimeout(app.librarySaveActivityHideTimer);
            app.librarySaveActivityHideTimer = null;
            if (app.librarySaveActivityId) {
                updateActivityTask(app.librarySaveActivityId, message);
                return;
            }
            if (app.librarySaveActivityShowTimer) return;
            app.librarySaveActivityShowTimer = setTimeout(() => {
                app.librarySaveActivityShowTimer = null;
                if (!(app.librarySavePendingCount > 0)) return;
                app.librarySaveActivityId = beginActivityTask(
                    app.librarySaveActivityLabel || "Saving...",
                    { priority: 35, kind: "library" },
                );
            }, 150);
        }

        function endLibrarySaving() {
            app.librarySavePendingCount = Math.max(0, (app.librarySavePendingCount || 1) - 1);
            if (app.librarySavePendingCount > 0) return;
            clearTimeout(app.librarySaveActivityShowTimer);
            app.librarySaveActivityShowTimer = null;
            if (!app.librarySaveActivityId) return;
            clearTimeout(app.librarySaveActivityHideTimer);
            app.librarySaveActivityHideTimer = setTimeout(() => {
                app.librarySaveActivityHideTimer = null;
                if (app.librarySavePendingCount > 0) return;
                endActivityTask(app.librarySaveActivityId);
                app.librarySaveActivityId = "";
            }, 350);
        }

        async function listAllLibraryEntries(kind = "story") {
            const entries = [];
            let offset = 0;

            while (true) {
                const page = await app.library.listLibrary(kind, { offset, limit: 200 });
                entries.push(...(page.entries || []));
                offset = entries.length;
                if (offset >= Number(page.total || 0)) return entries;
            }
        }

        function profileCharacterIdForStorage(record = {}) {
            if (typeof record.character_id !== "string" || !record.character_id)
                throw new Error("profile image character_id is required.");
            return record.character_id;
        }

        function storyIdForImageStorage(record = {}) {
            if (typeof record.story_id !== "string" || !record.story_id)
                throw new Error("story title image story_id is required.");
            return record.story_id;
        }

        function persistentProfileImageRecord(record = {}) {
            return record.pending !== true &&
                !textSlot(record.error, "") &&
                !!(profileImageRealHtml(record.html) || textSlot(record.url || record.hosted_url, ""));
        }

        function imageSourceWasGenerated(source = "") {
            return /^(?:auto-)?generated(?:\b|-)/i.test(
                String(source || "").trim(),
            );
        }

        async function sharedImageBlobSha256(blob) {
            if (!(blob instanceof Blob)) return "";
            const digest = await crypto.subtle.digest(
                "SHA-256",
                await blob.arrayBuffer(),
            );
            return [...new Uint8Array(digest)]
                .map((value) => value.toString(16).padStart(2, "0"))
                .join("");
        }

        function sharedImageRuntimeSource(storeName = "", image = {}, asset = null) {
            const localSource = sessionImageObjectUrl(
                `${storeName}|${image.imageId}`,
                asset?.blob,
            );
            return localSource || textSlot(image.url, "");
        }

        async function loadSharedCharacterImages(characterId = "") {
            const wantedId = String(characterId || "").trim();
            const result = await app.persistence.listSharedRecords("characterImages", {
                ...(wantedId ? { indexName: "byCharacter", key: wantedId } : {}),
                limit: 10000,
            });
            const records = [];
            for (const image of result.records || []) {
                const asset = image.url
                    ? null
                    : await app.persistence.getRecord("assetBlobs", image.imageId);
                const source = sharedImageRuntimeSource("characterImages", image, asset);
                records.push({
                    id: String(image.imageId || ""),
                    at: "",
                    title: String(image.characterId || "Character"),
                    reason: "stored character image",
                    model: String(image.model || ""),
                    seed: image.seed ?? "random",
                    prompt: String(image.prompt || ""),
                    negativePrompt: String(image.negativePrompt || ""),
                    html: "",
                    url: source,
                    pending: false,
                    error: source ? "" : "Stored character image bytes are unavailable.",
                    targets: [String(image.characterId || "")].filter(Boolean),
                    profile: false,
                    promptType: "normal scene image",
                    characterId: String(image.characterId || ""),
                    presentation: image.presentation === "male" ? "male" : "non_male",
                });
            }
            if (wantedId) {
                app.characterImages = [
                    ...(app.characterImages || []).filter(
                        (image) => String(image.characterId || "") !== wantedId,
                    ),
                    ...records,
                ];
            }
            return records;
        }

        async function sharedImageStorageEntries(key = "", records = [], options = {}) {
            const entries = [];
            const profile = key === PROFILE_IMAGE_KEY;
            const storeName = profile ? "characterProfileImages" : "storyTitleImages";

            for (const sourceRecord of records) {
                const record = profile
                    ? exactProfileImageStore([sourceRecord])[0]
                    : exactStoryTitleCardImageStore([sourceRecord])[0];
                const imageId = textSlot(record.id, "");
                const htmlSource = extractImageSrc(record.html);
                const durableUrl = textSlot(record.hosted_url || record.url, "");
                const source = /^blob:/i.test(htmlSource) && durableUrl
                    ? durableUrl
                    : htmlSource || durableUrl;
                const imageRecord = profile
                    ? {
                          imageId,
                          characterId: profileCharacterIdForStorage(record),
                          presentation: record.male === true ? "male" : "non_male",
                          favorite: record.favorite === true,
                          createdAt: textSlot(record.at, ""),
                          source: textSlot(record.source, ""),
                          model: textSlot(record.model, ""),
                          seed: record.seed ?? null,
                          prompt: textSlot(record.prompt, ""),
                          negativePrompt: textSlot(record.negativePrompt, ""),
                          url: /^(?:data:image\/|blob:)/i.test(source) ? "" : source,
                      }
                      : {
                           storyId: storyIdForImageStorage(record),
                           storyTitle: textSlot(record.story_title || record.storyTitle, ""),
                           imageId,
                          source: textSlot(record.source, ""),
                          model: textSlot(record.model, ""),
                          seed: record.seed ?? null,
                          prompt: textSlot(record.prompt, ""),
                          negativePrompt: textSlot(record.negativePrompt, ""),
                          favorite: record.favorite === true,
                          upload_attestation_classification: textSlot(
                              record.upload_attestation_classification,
                              "",
                          ),
                          upload_attested_by: textSlot(
                              record.upload_attested_by,
                              "",
                          ),
                          upload_attested_at: textSlot(
                              record.upload_attested_at,
                              "",
                          ),
                          upload_attestation_policy_version:
                              Number.isSafeInteger(
                                  record.upload_attestation_policy_version,
                              )
                                  ? record.upload_attestation_policy_version
                                  : 0,
                           url: /^(?:data:image\/|blob:)/i.test(source) ? "" : source,
                      };

                const existingImageRecord = await app.persistence.getRecord(
                    storeName,
                    imageId,
                );
                if (
                    textSlot(existingImageRecord?.url, "") &&
                    imageRecord.url &&
                    existingImageRecord.url !== imageRecord.url
                )
                    throw new Error(
                        `${storeName}.${imageId} cannot replace its hosted URL. A different image requires a new image id.`,
                    );

                entries.push({ storeName, record: imageRecord });
                if (profile && options.selectProfileImages === true) {
                    entries.push({
                        storeName: "characterProfileImageSelections",
                        record: {
                            characterId: imageRecord.characterId,
                            presentation: imageRecord.presentation,
                            imageId,
                        },
                    });
                }
                if (/^(?:data:image\/|blob:)/i.test(source)) {
                    const storedAsset = await app.persistence.getRecord(
                        "assetBlobs",
                        imageId,
                    );
                    let blob = storedAsset?.blob instanceof Blob
                        && source.startsWith("blob:")
                        ? storedAsset.blob
                        : null;
                    if (!blob) {
                        try {
                            const response = await fetch(source);
                            if (!response.ok)
                                throw new Error(`Image fetch returned HTTP ${response.status}.`);
                            blob = await response.blob();
                        } catch (error) {
                            throw new Error(
                                `${storeName}.${imageId} cannot persist its temporary image URL: ${error?.message || error}`,
                            );
                        }
                    }
                    if (storedAsset?.blob instanceof Blob) {
                        const [storedHash, nextHash] = await Promise.all([
                            sharedImageBlobSha256(storedAsset.blob),
                            sharedImageBlobSha256(blob),
                        ]);
                        if (storedHash && nextHash && storedHash !== nextHash)
                            throw new Error(
                                `${storeName}.${imageId} cannot replace its stored image bytes. A different image requires a new image id.`,
                            );
                        blob = storedAsset.blob;
                    }
                    entries.push({
                        storeName: "assetBlobs",
                        record: {
                            imageId,
                            blob,
                            mimeType: blob.type || "image/png",
                            byteLength: blob.size,
                            contentHash: `local-${imageId}`,
                        },
                    });
                }
            }

            return entries;
        }

        async function legacySharedImagesFromNormalized(key = "", fallback = []) {
            const profile = key === PROFILE_IMAGE_KEY;
            const storeName = profile ? "characterProfileImages" : "storyTitleImages";
            const result = await app.persistence.listSharedRecords(storeName, { limit: 10000 });
            const characterNames = new Map(
                (app.characterDefinitions || []).map((record) => [
                    String(record.id || ""),
                    textSlot(record.name || record.character?.name, ""),
                ]),
            );
            const records = [];

            for (const image of result.records || []) {
                const asset = image.url
                    ? null
                    : await app.persistence.getRecord(
                          "assetBlobs",
                          image.imageId,
                      );
                const source = image.url || sessionImageObjectUrl(
                    `${storeName}|${image.imageId}`,
                    asset?.blob,
                );
                const common = {
                    id: image.imageId,
                    model: image.model || "",
                    seed: image.seed ?? 0,
                    prompt: image.prompt || "",
                    negativePrompt: image.negativePrompt || "",
                    url: source,
                    html: source ? `<img loading="lazy" decoding="async" src="${escapeHtml(source)}">` : "",
                };

                records.push(profile
                    ? createProfileImageRecord({
                          ...common,
                          character_id: image.characterId,
                          owner_name: characterNames.get(String(image.characterId)) || image.characterId,
                          male: image.presentation === "male",
                          favorite: image.favorite === true,
                          profile: true,
                          source: image.source || (image.url ? "hosted" : "stored"),
                          pending: false,
                          error: "",
                          hosted_url: image.url || "",
                      })
                      : {
                           ...common,
                           at: new Date().toISOString(),
                           source: image.source || (image.url ? "hosted" : "stored"),
                           reason: "stored story title image",
                           title: textSlot(image.storyTitle, "Story title image"),
                           hosted_url: image.url || "",
                           pending: false,
                           error: "",
                           smoke_test_artifact: false,
                           upload_attestation_classification: textSlot(
                               image.upload_attestation_classification,
                               "",
                           ),
                           upload_attested_by: textSlot(
                               image.upload_attested_by,
                               "",
                           ),
                           upload_attested_at: textSlot(
                               image.upload_attested_at,
                               "",
                           ),
                           upload_attestation_policy_version:
                               Number.isSafeInteger(
                                   image.upload_attestation_policy_version,
                               )
                                   ? image.upload_attestation_policy_version
                                   : 0,
                           story_id: image.storyId,
                          story_key: storyTitleCardStoreKey(
                              (app.storyTemplates || []).find((template) =>
                                  String(template?.id || "") === String(image.storyId),
                              ) || { id: image.storyId },
                          ),
                           story_title: textSlot(
                               image.storyTitle,
                               "",
                           ) || textSlot(
                               (app.storyTemplates || []).find((template) =>
                                   String(template?.id || "") === String(image.storyId),
                               )?.title,
                              "",
                          ),
                          story_source: textSlot(
                              (app.storyTemplates || []).find((template) =>
                                  String(template?.id || "") === String(image.storyId),
                              )?.source,
                              "",
                          ),
                          favorite: image.favorite === true,
                      });
            }

            return records.length ? exactLibraryCollection(key, records) : clone(fallback);
        }

        async function loadPerRecordLibrary(key = "", fallback = [], options = {}) {
            const type = libraryRecordStorageType(key);
            if (!type) return loadLargeJson(key, fallback);
            assertLibraryRecordStorageAvailable(key);
            const started = perfNow();
            let records;

            if (type === "story" || type === "character") {
                const loadedValues = await app.library.listCompatibilityDefinitions(type);
                const loadedRecords = type === "story"
                    ? loadedValues.map((value) => {
                          if (!isPlainObject(value?.definition))
                              throw new Error("Stored story library entry must contain an exact definition object.");
                          setStoryLibraryCreatorMetadata(value.definition, value.creatorIdentity);
                          return value.definition;
                      })
                    : loadedValues;
                records = loadedRecords.length
                    ? options.deferDefinitionValidation === true ||
                      (key === STORY_TEMPLATE_KEY && options.deferStoryValidation === true)
                        ? loadedRecords
                        : exactLibraryCollection(key, loadedRecords)
                    : clone(fallback);
            }
            else {
                records = await legacySharedImagesFromNormalized(key, fallback);
            }
            largeStorageDiagnosticLog("library records loaded", {
                key,
                type,
                recordCount: records.length,
                totalMs: Math.round(perfNow() - started),
                worker: true,
            });
            return records;
        }

        async function savePerRecordLibrary(key = "", records = [], options = {}) {
            const type = libraryRecordStorageType(key);
            if (!type) {
                return awaitLargeStorageSetJson(key, records);
            }
            assertLibraryRecordStorageAvailable(key);
            const normalized = exactLibraryCollection(key, records).filter((record) =>
                type !== "profile-image" || persistentProfileImageRecord(record)
            );
            const ids = new Set(normalized.map((record) => libraryRecordStorageId(key, record)));

            if (type === "story" || type === "character") {
                const existing = await listAllLibraryEntries(type);
                for (const entry of existing) {
                    const id = String(entry.storyId || entry.characterId || "");
                    if (!ids.has(id)) await app.library.deleteEntry(type, id);
                }
                for (const record of normalized) {
                    const payload = type === "story"
                        ? storyExportPayloadFromDefinition(
                              storyDefinitionForExport(record),
                          )
                        : characterDefinitionFileForExport(record);
                    if (type === "character" && !payload?.character_definition?.id)
                        devTestLog?.("Normalized character persistence missing id", {
                            recordId: record?.id || "",
                            characterId: record?.character?.id || "",
                            payloadName: payload?.character_definition?.name || "",
                            recordKeys: Object.keys(record || {}).join(", "),
                        });
                    await app.library.importPayload(type, payload, {
                        creatorIdentity: libraryRecordCreatorIdentity(
                            type,
                            record,
                            options.creatorIdentity || null,
                        ),
                    });
                }
            }
            else {
                const storeName = type === "profile-image" ? "characterProfileImages" : "storyTitleImages";
                const existing = await app.persistence.listSharedRecords(storeName, { limit: 10000 });
                const imageIds = new Set(normalized.map((record) => textSlot(record?.id, "")).filter(Boolean));
                for (const image of existing.records || []) {
                    if (!imageIds.has(String(image.imageId)))
                        await app.persistence.deleteSharedImage(storeName, image.imageId);
                }
                if (type === "profile-image") {
                    for (const record of normalized) {
                        const entries = await sharedImageStorageEntries(key, [record], options);
                        await app.persistence.putSharedRecords(entries);
                    }
                }
                else {
                    const entries = await sharedImageStorageEntries(key, normalized, options);
                    for (let index = 0; index < entries.length; index += 100)
                        await app.persistence.putSharedRecords(entries.slice(index, index + 100));
                }
            }
            return true;
        }

        function updateActivityTaskProgress(id = "", progress = {}) {
            const task = app.activityTasks?.get?.(String(id || ""));
            if (!task) return false;
            task.completed = Math.max(0, Number(progress.completed || 0));
            task.total = Math.max(0, Number(progress.total || 0));
            task.detail = String(progress.detail || "").replace(/\s+/g, " ").trim();
            if (progress.label) task.label = compactActivityLabel(progress.label);
            renderActivityIndicator();
            return true;
        }

        async function savePerRecordLibraryRecords(key = "", records = [], options = {}) {
            const type = libraryRecordStorageType(key);
            assertLibraryRecordStorageAvailable(key);
            const normalized = exactLibraryCollection(key, records).filter((record) =>
                type !== "profile-image" || persistentProfileImageRecord(record)
            );
            if (!normalized.length) return true;
            const protectedIds = app.smokeProtectedLibraryIds?.[type];
            if (protectedIds instanceof Set) {
                const protectedWrite = normalized.find((record) =>
                    protectedIds.has(String(libraryRecordStorageId(key, record) || "")),
                );
                if (protectedWrite)
                    throw new Error(
                        `Smoke isolation blocked writing pre-smoke ${type} record ${libraryRecordStorageId(key, protectedWrite)}. Smokes must use unique fixture ids.`,
                    );
            }

            if (type === "story" || type === "character") {
                for (const record of normalized) {
                    const payload = type === "story"
                        ? storyExportPayloadFromDefinition(
                              storyDefinitionForExport(record),
                          )
                        : characterDefinitionFileForExport(record);
                    if (type === "character" && !payload?.character_definition?.id)
                        devTestLog?.("Normalized character record persistence missing id", {
                            recordId: record?.id || "",
                            characterId: record?.character?.id || "",
                            payloadName: payload?.character_definition?.name || "",
                            recordKeys: Object.keys(record || {}).join(", "),
                        });
                    await app.library.importPayload(type, payload, {
                        creatorIdentity: libraryRecordCreatorIdentity(
                            type,
                            record,
                            options.creatorIdentity || null,
                        ),
                    });
                }
            }
            else {
                if (type === "profile-image") {
                    for (const record of normalized) {
                        const entries = await sharedImageStorageEntries(key, [record], options);
                        await app.persistence.putSharedRecords(entries);
                    }
                }
                else {
                    const entries = await sharedImageStorageEntries(key, normalized, options);
                    for (let index = 0; index < entries.length; index += 100)
                        await app.persistence.putSharedRecords(entries.slice(index, index + 100));
                }
            }
            return true;
        }

        async function deletePerRecordLibraryRecords(key = "", records = []) {
            const type = libraryRecordStorageType(key);
            assertLibraryRecordStorageAvailable(key);
            const values = exactLibraryRecordDeletionReferences(records);
            const ids = values.map((record) => record.id);
            if (!ids.length) return true;
            const protectedIds = app.smokeProtectedLibraryIds?.[type];
            if (protectedIds instanceof Set) {
                const protectedId = ids.find((id) => protectedIds.has(String(id || "")));
                if (protectedId)
                    throw new Error(
                        `Smoke isolation blocked deleting pre-smoke ${type} record ${protectedId}. Smokes may delete only their own fixtures.`,
                    );
            }

            if (type === "story" || type === "character") {
                for (const id of ids) await app.library.deleteEntry(type, id);
            }
            else {
                const storeName = type === "profile-image" ? "characterProfileImages" : "storyTitleImages";
                for (const record of values) {
                    await app.persistence.deleteSharedImage(storeName, record.id);
                }
            }
            return true;
        }

        async function imageStorageRowsForOwner(type = "", records = []) {
            const ownerType = String(type || "");
            if (!ownerType) return [];
            const now = new Date().toISOString();
            const rows = [];
            for (const record of Array.isArray(records) ? records : []) {
                const id = String(record?.id || "").trim();
                if (!id) continue;
                const rowKey = `${ownerType}|${id}`;
                const value = clone(record);
                const src = extractImageSrc(value.html) || textSlot(value.url, "");
                let blob = null;
                if (/^(?:data:image\/|blob:)/i.test(src)) {
                    const response = await fetch(src);
                    blob = await response.blob();
                    value.html = "";
                    value.url = "";
                }
                rows.push({
                    key: rowKey,
                    type: ownerType,
                    id,
                    updated_at: now,
                    value,
                    blob,
                });
            }
            return rows;
        }

        async function saveImageRowsForOwner(type = "", records = []) {
            const ownerType = String(type || "");
            if (!ownerType) return false;
            const rows = await imageStorageRowsForOwner(ownerType, records);
            const existingRows =
                (await persistenceWorkerRequest("records-load-type", {
                    type: ownerType,
                })) || [];
            const wantedKeys = new Set(rows.map((row) => row.key));
            existingRows
                .map((row) => row.key)
                .filter((key) => !wantedKeys.has(key))
                .forEach(revokeSessionImageObjectUrl);
            await persistenceWorkerRequest("records-replace-type", {
                type: ownerType,
                rows,
            });
            rows.forEach((row) => forgetSessionImageObjectUrl(row.key));
            return true;
        }

        async function loadImageRowsForOwner(type = "") {
            const ownerType = String(type || "");
            if (!ownerType) return [];
            const rows =
                (await persistenceWorkerRequest("records-load-type", {
                    type: ownerType,
                })) || [];
            return rows
                .map((row) => {
                    const value = clone(row.value);
                    if (!value) return null;
                    if (row.blob instanceof Blob) {
                        const url = sessionImageObjectUrl(row.key, row.blob);
                        value.url = url;
                        value.html = `<img loading="lazy" decoding="async" src="${escapeHtml(url)}">`;
                    }
                    return value;
                })
                .filter(Boolean);
        }

        async function deleteImageRowsForOwner(type = "") {
            const ownerType = String(type || "");
            if (!ownerType) return true;
            const rows =
                (await persistenceWorkerRequest("records-load-type", {
                    type: ownerType,
                })) || [];
            const keys = rows.map((row) => row.key);
            await persistenceWorkerRequest("records-replace-type", {
                type: ownerType,
                rows: [],
            });
            keys.forEach(revokeSessionImageObjectUrl);
            return true;
        }

        function saveImageOwnerType(saveId = "") {
            return `save-image:${String(saveId || "").trim()}`;
        }

        function trackLargeStoragePromise(key = "", promise = null) {
            if (!promise?.then) return promise;
            app.largeStoragePending ||= new Map();
            const pendingKey = `${key}:${Date.now()}:${Math.random()}`;
            app.largeStoragePending.set(pendingKey, promise);
            promise.then(
                () => app.largeStoragePending?.delete(pendingKey),
                () => app.largeStoragePending?.delete(pendingKey),
            );
            return promise;
        }

        function queuePerRecordLibraryRecordsSave(key = "", records = [], reason = "library changed", options = {}) {
            const label = libraryRecordStorageLabel(key);
            const snapshot = exactLibraryCollection(key, records).filter((record) =>
                libraryRecordStorageType(key) !== "profile-image" || persistentProfileImageRecord(record)
            );
            if (!snapshot.length) return false;
            beginLibrarySaving(`Saving ${label}...`);
            // Record writes may be coalesced only when they target the same
            // records. Coalescing every profile-image write by store type can
            // drop an earlier portrait when several characters generate at once.
            const recordIds = snapshot
                .map((record) => libraryRecordStorageId(key, record))
                .sort()
                .join(",");
            const promise = app.work
                .enqueueOrdered(
                    `library:${libraryRecordStorageType(key)}`,
                    `save ${key}:${recordIds || "records"}`,
                    () => savePerRecordLibraryRecords(key, snapshot, options),
                    { coalesce: true },
                )
                .finally(() => {
                    endLibrarySaving();
                });
            trackLargeStoragePromise(`${key}:records`, promise);
            return true;
        }

        function queuePerRecordLibraryRecordsDelete(key = "", records = [], reason = "library deleted") {
            const label = libraryRecordStorageLabel(key);
            const snapshot = exactLibraryRecordDeletionReferences(records);
            beginLibrarySaving(`Saving ${label}...`);
            const promise = app.work
                .enqueueOrdered(
                    `library:${libraryRecordStorageType(key)}`,
                    `delete ${key}`,
                    () => deletePerRecordLibraryRecords(key, snapshot),
                )
                .finally(() => {
                    endLibrarySaving();
                });
            trackLargeStoragePromise(`${key}:delete`, promise);
            return true;
        }

        function queuePerRecordLibrarySave(key = "", records = [], reason = "library changed") {
            const label = libraryRecordStorageLabel(key);
            const snapshot = exactLibraryCollection(key, records);
            beginLibrarySaving(`Saving ${label}...`);
            const promise = app.work
                .enqueueOrdered(
                    `library:${libraryRecordStorageType(key) || key}`,
                    `replace ${key}`,
                    () => savePerRecordLibrary(key, snapshot, { reason }),
                    { coalesce: true },
                )
                .finally(() => {
                    endLibrarySaving();
                });
            trackLargeStoragePromise(key, promise);
            return true;
        }

        function largeSetStorageItem(key, value, options = {}) {
            const serialize = options.json === true || typeof value !== "string";
            const promise = app.work
                .enqueueOrdered(
                    `storage:${key}`,
                    `write ${key}`,
                    () =>
                        serialize
                            ? largeStorageSetJson(key, value)
                            : largeStorageSet(key, value),
                    { coalesce: true },
                )
                .then(() => true)
                .catch((err) => {
                    recordStorageFailure(key, err);
                    return false;
                });
            trackLargeStoragePromise(key, promise);
            return true;
        }

        async function awaitLargeStorageSet(key, value, options = {}) {
            try {
                const serialize = options.json === true || typeof value !== "string";
                const saved = await app.work.enqueueOrdered(
                    `storage:${key}`,
                    `write ${key}`,
                    () =>
                        serialize
                            ? largeStorageSetJson(key, value)
                            : largeStorageSet(key, value),
                    { coalesce: true },
                );
                if (saved === false) return false;
                return true;
            } catch (err) {
                recordStorageFailure(key, err);
                return false;
            }
        }

        async function awaitLargeStorageRemove(key) {
            try {
                const removed = await app.work.enqueueOrdered(
                    `storage:${key}`,
                    `delete ${key}`,
                    () => largeStorageRemove(key),
                );
                if (removed === false) return false;
                return true;
            } catch (err) {
                recordStorageFailure(key, err);
                return false;
            }
        }

        async function flushLargeSaves() {
            const workSaved = await app.work.flush();
            const pending = [...(app.largeStoragePending?.values?.() || [])];
            const results = pending.length
                ? await Promise.allSettled(pending)
                : [];
            const workerSaved = await persistenceWorkerRequest("flush");
            return (
                workSaved &&
                workerSaved !== false &&
                results.every(
                    (result) => result.status === "fulfilled" && result.value !== false,
                )
            );
        }

        async function flushPersistenceWorkerSave(saveId = "") {
            const id = String(saveId || "").trim();
            await persistenceWorkerRequest("flush");
            if (!id) return true;
            const revisionState = app.persistenceRevisions?.[`save:${id}`];
            if (!revisionState) return true;
            return (
                Number(revisionState.durableRevision || 0) >=
                Number(revisionState.queuedRevision || 0)
            );
        }

        function largeRemoveStorageItem(key) {
            const promise = app.work.enqueueOrdered(
                `storage:${key}`,
                `delete ${key}`,
                () => largeStorageRemove(key),
                { coalesce: true },
            );
            trackLargeStoragePromise(`${key}:delete`, promise);
        }

        function smokePersistentStorageKeyWanted(key = "") {
            const text = String(key || "");
            return (
                text === SETTINGS_KEY ||
                text === USER_PROFILE_KEY ||
                text === SUPABASE_SESSION_KEY ||
                text === ACTIVE_SAVE_KEY ||
                text === SAVE_INDEX_ALL_KEY ||
                LARGE_STORAGE_KEYS.includes(text) ||
                text.startsWith("emberadventureslite-")
            );
        }

        function smokeLocalStorageKeys() {
            const keys = [];
            try {
                for (let index = 0; index < localStorage.length; index += 1) {
                    const key = localStorage.key(index);
                    if (smokePersistentStorageKeyWanted(key)) keys.push(key);
                }
            } catch {}
            return [...new Set(keys)].sort();
        }

        async function smokeLargeStorageKeys() {
            try {
                const values = await app.library.listSettings();
                return Object.keys(values || {})
                    .filter(smokePersistentStorageKeyWanted)
                    .sort();
            } catch (err) {
                recordStorageFailure("smoke large storage snapshot", err);
                return [];
            }
        }

        async function devPersistentStorageSnapshotForSmoke() {
            await flushLargeSaves();
            const local = {};
            for (const key of smokeLocalStorageKeys()) {
                try {
                    local[key] = localStorage.getItem(key);
                } catch {}
            }
            const large = {};
            for (const key of await smokeLargeStorageKeys()) {
                try {
                    large[key] = await largeStorageGet(key);
                } catch (err) {
                    recordStorageFailure(`smoke snapshot ${key}`, err);
                }
            }
            return { local, large };
        }

        async function devRestorePersistentStorageSnapshotForSmoke(snapshot = {}) {
            await flushLargeSaves();
            const localSnapshot = snapshot.local || {};
            const localSnapshotKeys = new Set(Object.keys(localSnapshot));
            for (const key of smokeLocalStorageKeys()) {
                if (!localSnapshotKeys.has(key)) safeRemoveStorageItem(key);
            }
            for (const [key, value] of Object.entries(localSnapshot)) {
                const current = localStorage.getItem(key);
                if (value == null) {
                    if (current != null) safeRemoveStorageItem(key);
                }
                else if (current !== value) safeSetStorageItem(key, value);
            }

            const largeSnapshot = snapshot.large || {};
            const largeSnapshotKeys = new Set(Object.keys(largeSnapshot));
            const currentLarge = await app.library.listSettings();
            for (const key of Object.keys(currentLarge || {}).filter(
                smokePersistentStorageKeyWanted,
            )) {
                if (!largeSnapshotKeys.has(key)) await awaitLargeStorageRemove(key);
            }
            for (const [key, value] of Object.entries(largeSnapshot)) {
                if (
                    stableStorageCompare(currentLarge?.[key]) !==
                    stableStorageCompare(value)
                )
                    await awaitLargeStorageSet(key, value);
            }
            await flushLargeSaves();
        }

        function devPreserveRefreshedSupabaseSessionForSmoke(snapshot = {}) {
            const baselineSession = snapshot.large?.[SUPABASE_SESSION_KEY];
            const currentSession = app.supabaseSession;
            const baselineUserId = String(baselineSession?.user?.id || "");
            const currentUserId = String(currentSession?.user?.id || "");

            if (baselineUserId && !currentSession) {
                snapshot.local ||= {};
                snapshot.large ||= {};
                delete snapshot.local[SUPABASE_SESSION_KEY];
                delete snapshot.large[SUPABASE_SESSION_KEY];
                return true;
            }

            if (
                !baselineUserId ||
                currentUserId !== baselineUserId ||
                !currentSession?.access_token ||
                !currentSession?.refresh_token ||
                currentSession.refresh_token === baselineSession.refresh_token
            )
                return false;

            snapshot.local ||= {};
            snapshot.large ||= {};
            delete snapshot.local[SUPABASE_SESSION_KEY];
            snapshot.large[SUPABASE_SESSION_KEY] = clone(currentSession);
            return true;
        }

        function safeSetStorageItem(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (err) {
                recordStorageFailure(key, err);
                return false;
            }
        }

        function recordStorageFailure(key, err) {
            const message = err?.message || String(err || "unknown error");
            const name = err?.name || "";
            const dedupeKey = `${String(key || "")}|${String(name || "")}|${String(message || "")}`;
            root.__emberAdventuresStorageFailureDedupe ||= {};
            const now = Date.now();
            if (
                root.__emberAdventuresStorageFailureDedupe[dedupeKey] &&
                now - root.__emberAdventuresStorageFailureDedupe[dedupeKey] < 30000
            )
                return;
            root.__emberAdventuresStorageFailureDedupe[dedupeKey] = now;
            const entry = {
                at: new Date().toISOString(),
                key: String(key || ""),
                name: String(name || ""),
                message: String(message || ""),
            };
            root.__emberAdventuresStorageFailures ||= [];
            root.__emberAdventuresStorageFailures.push(entry);
            root.__emberAdventuresStorageFailures = root.__emberAdventuresStorageFailures.slice(-20);

            try {
                app.storageFailures ||= [];
                app.storageFailures.push(entry);
                app.storageFailures = app.storageFailures.slice(-20);
                if (isActiveGameSaveStorageKey(entry.key)) {
                    app.activeGameSaveDirty = true;
                    app.activeGameSavePendingReason ||= "retry after storage failure";
                }
                writeConsoleLog({
                    title: "Storage save failed",
                    detail: `${entry.key}: ${entry.name} ${entry.message}`,
                    logType: "storage",
                    logLevel: "error",
                    at: entry.at,
                });
                recordDevTraceEntry({
                    type: "LOG storage",
                    title: "Storage save failed",
                    detail: `${entry.key}: ${entry.name} ${entry.message}`,
                    logType: "storage",
                    logLevel: "error",
                    at: entry.at,
                });
                setStatus(`Save failed: ${entry.key}`);
                reportAppIssue(err || new Error(entry.message), {
                    title: "Storage save failed",
                    type: "storage",
                    context: entry.key,
                    details: entry,
                });
            } catch {
                // The failure recorder must never trigger another save failure.
            }
        }

        function safeRemoveStorageItem(key) {
            try {
                localStorage.removeItem(key);
            } catch (err) {
                log("Storage remove failed", `${key}: ${err?.message || err}`, {
                    type: "storage",
                    level: "error",
                });
            }
        }

        function profileSettingKeys() {
            return [
                "autoVoice",
                "autoReadPlayerMessages",
                "readGameMessages",
                "autoImages",
                "showImagesInChat",
                "showAiStatusMessages",
                "showAffectionStats",
                "showNonEnglishVoices",
                "swapAllGendersToPreferred",
                "preferredCharacterGender",
                "storyPlayerSelectGender",
                "reducedUi",
                "aiMessageLength",
                "voiceBlacklist",
                "narratorVoiceName",
                "defaultMalePlayerVoiceName",
                "defaultNonMalePlayerVoiceName",
                "imageMode",
                "imageModel",
                "defaultProfileImageModel",
                "imageHistoryLimit",
                "imageRequestTimeoutSeconds",
                "downloadOldImagesBeforeDelete",
                "bodyScaleVersion",
                "characterBoldnessOffset",
            ];
        }

        function localSettingKeys() {
            return [
                "activeUserProfileId",
                "currentGameSaveId",
                "devMode",
                ...LOG_SETTING_IDS,
                "stateCheckMode",
                "playerReadDisablePromptSeen",
                "characterReadDisablePromptSeen",
                "playerInputHelpSeen",
                "betaNotesSeen",
                "imageLabWarningAccepted",
                "composerMode",
                "autoVisualNovel",
                "autoModeType",
                "autoModeCompletesObjectives",
                "storyGuidance",
                "voiceGenderMap",
                "leftPanelGroup",
                "leftPanelSections",
                "leftPanelScroll",
                "characterLibraryCardSize",
                "characterLibraryColumnDensity",
                "characterLibraryColumns",
                "storyLibraryColumnDensity",
                "storyLibraryColumns",
                "ollama",
            ];
        }

        function localSettingsForStorage() {
            const settings = {};
            for (const key of localSettingKeys()) {
                settings[key] = clone(app.settings[key]);
            }
            const validation = validateStoredSettings(settings);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return settings;
        }

        const USER_PROFILE_FIELDS = Object.freeze([
            "id",
            "name",
            "settings",
            "story_generation_notice_seen",
            "updated_at",
        ]);

        function validateUserProfileDefinition(profile = {}, path = "profile") {
            const errors = [
                ...exactObjectFieldValidationErrors(profile, USER_PROFILE_FIELDS, path),
                ...requiredExactFieldsValidationErrors(profile, USER_PROFILE_FIELDS, path),
            ];
            if (!isPlainObject(profile)) return validationResult(errors);
            for (const field of ["id", "name", "updated_at"]) {
                if (typeof profile[field] !== "string" || !profile[field].trim())
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "required",
                            `${field} must be a non-empty string.`,
                        ),
                    );
            }
            for (const field of ["story_generation_notice_seen"]) {
                if (typeof profile[field] !== "boolean")
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "type",
                            `${field} must be a boolean.`,
                        ),
                    );
            }
            for (const field of []) {
                if (!Array.isArray(profile[field]) || profile[field].some((value) => typeof value !== "string"))
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "type",
                            `${field} must be an array of strings.`,
                        ),
                    );
            }
            if (!isPlainObject(profile.settings))
                errors.push(
                    validationError(
                        `${path}.settings`,
                        "type",
                        "settings must be an object.",
                    ),
                );
            else {
                const settingKeys = profileSettingKeys();
                try { exactPreferredCharacterGender(profile.settings.preferredCharacterGender); }
                catch (error) {
                    errors.push(validationError(`${path}.settings.preferredCharacterGender`, "value", error.message));
                }
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        profile.settings,
                        settingKeys,
                        `${path}.settings`,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        profile.settings,
                        settingKeys,
                        `${path}.settings`,
                    ),
                );
                for (const key of settingKeys) {
                    if (!Object.hasOwn(profile.settings, key)) continue;
                    const value = profile.settings[key];
                    const expected = defaultSettings[key];
                    const valid = Array.isArray(expected)
                        ? Array.isArray(value)
                        : isPlainObject(expected)
                          ? isPlainObject(value)
                          : expected === null
                            ? value === null
                            : typeof value === typeof expected;
                    if (!valid)
                        errors.push(
                            validationError(
                                `${path}.settings.${key}`,
                                "type",
                                `${path}.settings.${key} has the wrong type.`,
                            ),
                        );
                }
                if (
                    Object.hasOwn(profile.settings, "bodyScaleVersion") &&
                    profile.settings.bodyScaleVersion !== BODY_SCALE_SCHEMA_VERSION
                )
                    errors.push(
                        validationError(
                            `${path}.settings.bodyScaleVersion`,
                            "value",
                            `${path}.settings.bodyScaleVersion must be exactly ${BODY_SCALE_SCHEMA_VERSION}.`,
                        ),
                    );
            }
            return validationResult(errors);
        }

        function validatedUserProfiles(value) {
            if (!Array.isArray(value)) throw new Error("User profiles must be an array.");
            if (value.length > MAX_USER_PROFILES)
                throw new Error(`User profiles cannot contain more than ${MAX_USER_PROFILES} entries.`);
            const errors = value.flatMap((profile, index) =>
                validateUserProfileDefinition(profile, `profiles.${index}`).errors,
            );
            if (errors.length)
                throw new Error(
                    `User profiles are invalid:\n${errors
                        .map((error) => `${error.path}: ${error.message}`)
                        .join("\n")}`,
                );
            return clone(value);
        }

        function validateUserProfileExport(payload = {}) {
            const errors = exactObjectFieldValidationErrors(
                payload,
                ["app", "exportType", "schemaVersion", "exportedAt", "profile"],
                "profile export",
            );
            if (payload?.app !== "EmberAdventuresLite")
                errors.push(validationError("app", "value", 'app must be exactly "EmberAdventuresLite".'));
            if (payload?.exportType !== "user-profile")
                errors.push(validationError("exportType", "value", 'exportType must be exactly "user-profile".'));
            if (payload?.schemaVersion !== 1)
                errors.push(validationError("schemaVersion", "value", "schemaVersion must be exactly 1."));
            if (typeof payload?.exportedAt !== "string" || !payload.exportedAt.trim())
                errors.push(validationError("exportedAt", "required", "exportedAt must be a non-empty string."));
            errors.push(...validateUserProfileDefinition(payload?.profile, "profile").errors);
            return validationResult(errors);
        }

        function profileStorageRecordFromDefinition(profile = {}) {
            return validatedUserProfiles([profile])[0];
        }

        function repairAiEntertainmentPreferences(values) {
            const aliases = {
                "mystery thriller": ["mystery", "thriller"],
                "dark fantasy": ["dark", "fantasy"],
                "cozy adventure": ["cozy", "adventure"],
                "fantasy RPG": ["fantasy"],
                "generic fantasy RPG": ["fantasy"],
                scifi: ["sci-fi"],
                "science fiction": ["sci-fi"],
            };
            const supported = new Set(entertainmentPreferenceOptions());
            const input = Array.isArray(values)
                ? values
                : String(values || "")
                      .split(",")
                      .map((value) => value.trim());
            return [
                ...new Set(
                    input
                        .flatMap((value) => {
                            const text = String(value || "").trim();
                            const key = text.toLowerCase();
                            return aliases[key] || [key];
                        })
                        .filter((value) => supported.has(value)),
                ),
            ];
        }

        function exactEntertainmentPreferences(values, path = "genres") {
            if (!Array.isArray(values))
                throw new Error(`${path} must be an array of exact approved genre strings.`);
            const supported = new Set(entertainmentPreferenceOptions());
            for (let index = 0; index < values.length; index++) {
                const value = values[index];
                if (typeof value !== "string" || !supported.has(value))
                    throw new Error(`${path}.${index} is not an exact approved genre.`);
            }
            return values.slice();
        }

        function userProfileById(id) {
            return (app.userProfiles || []).find(
                (profile) => profile.id === id,
            );
        }

        function activeUserProfile() {
            return userProfileById(app.settings?.activeUserProfileId);
        }





        function profileSettingsFromCurrent() {
            const settings = {};
            for (const key of profileSettingKeys()) {
                if (!Object.hasOwn(app.settings, key))
                    throw new Error(`Current settings are missing required profile setting ${key}.`);
                settings[key] = clone(app.settings[key]);
            }
            return settings;
        }

        function profileSettingsFromDefaults() {
            const settings = {};
            for (const key of profileSettingKeys()) {
                if (!Object.hasOwn(defaultSettings, key))
                    throw new Error(`defaultSettings is missing required profile setting ${key}.`);
                settings[key] = clone(defaultSettings[key]);
            }
            return settings;
        }



        function makeUserProfileFromDraft(draft = {}) {
            return {
                id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: String(draft.profile_name || "Player").trim() || "Player",
                settings: {
                    ...profileSettingsFromDefaults(),
                    characterBoldnessOffset: clampBoldnessOffset(
                        draft.character_boldness_offset,
                    ),
                },
                story_generation_notice_seen: false,
                updated_at: new Date().toISOString(),
            };
        }

        function applyUserProfile(profile) {
            if (!profile) {
                hydrateNoUserProfileRuntime({
                    includeGameState: true,
                });
                saveSettingsNow("active profile cleared");
                return;
            }
            hydrateUserProfileRuntime(profile, {
                includeSettings: true,
                includeGameState: true,
            });
            saveSettingsNow("active profile changed");
        }

        function hydrateActiveUserProfileRuntime(options = {}) {
            const profile = activeUserProfile();
            if (!profile) {
                hydrateNoUserProfileRuntime(options);
                return;
            }
            hydrateUserProfileRuntime(profile, options);
        }

        function hydrateNoUserProfileRuntime(
            {
                includeGameState = true,
            } = {},
        ) {
            app.settings.activeUserProfileId = "";
            if (!includeGameState) return;
            app.state.meta ||= {};


        }

        function hydrateUserProfileRuntime(
            profile,
            {
                includeSettings = false,
                includeGameState = true,
            } = {},
        ) {
            if (!profile) return;
            app.settings.activeUserProfileId = profile.id;
            if (includeSettings) {
                for (const key of profileSettingKeys()) {
                    if (profile.settings && key in profile.settings) {
                        app.settings[key] = clone(profile.settings[key]);
                    }
                }
            }
            if (!includeGameState) return;
            app.state.meta ||= {};

        }

        function applyUserProfileToDraft(profile) {
            if (!profile || !app.onboardingDraft) return;
            applyUserProfile(profile);
            const draft = app.onboardingDraft;
            draft.profile_id = profile.id;
            draft.profile_name = profile.name;




            draft.character_boldness_offset = clampBoldnessOffset(
                profile.settings?.characterBoldnessOffset,
            );
        }

        async function showStoryGenerationTimeNoticeOnce() {
            const profile = activeUserProfile();
            if (!profile || profile.story_generation_notice_seen) return "skip";
            return await new Promise((resolve) => {
                const popup = openPopupModal(`
                    <h2>New Story Generation Time</h2>
                    <p class="hint">Creating a new story takes about 12-15 minutes plus 1-2 minutes per party member created just for the generation portion. It is a long process, but you have a massive amount of control over the story.</p>
                    <p class="hint">If you do not want to wait for or spend that much time, I suggest selecting an existing story from the Story Library instead.</p>
                    <div class="row" style="margin-top:.8rem">
                        <button class="primary" id="storyGenerationTimeOkBtn">OK</button>
                        <button id="storyGenerationTimeCancelBtn">Cancel</button>
                    </div>
                `);
                popup.box.querySelector("#storyGenerationTimeOkBtn").onclick =
                    () => {
                        profile.story_generation_notice_seen = true;
                        profile.updated_at = new Date().toISOString();
                        saveProfilesNow("story generation notice accepted");
                        popup.close();
                        resolve("ok");
                    };
                popup.box.querySelector("#storyGenerationTimeCancelBtn").onclick =
                    () => {
                        popup.close();
                        resolve("cancel");
                    };
            });
        }

        function syncActiveUserProfile() {
            const id = app.settings?.activeUserProfileId;
            if (!id || !Array.isArray(app.userProfiles)) return;
            const profile = userProfileById(id);
            if (!profile) return;
            // Profile preferences are user-owned profile data. Story state/meta is
            // no longer an authority for them, and stale imported/legacy state meta
            // must never overwrite or clear saved profile choices during scheduleActiveGameSave().
            profile.settings = profileSettingsFromCurrent();
            profile.updated_at = new Date().toISOString();
            if (app.state?.meta) {
            }
        }



        function preferredRuntimeCharacterGenders(profile = activeUserProfile()) {
            const gender = exactPreferredCharacterGender(
                profile?.settings?.preferredCharacterGender ?? app.settings.preferredCharacterGender,
            );
            return gender ? [gender] : [];
        }

        function exactPreferredCharacterGender(value) {
            if (!["", "male", "female"].includes(value))
                throw new Error("Choose authored, male, or female presentation.");
            return value;
        }

        function supportedAdaptiveCharacterGender(value = "") {
            const canonical = canonicalCharacterGenderValue(value);
            if (canonical === "male") return canonical;
            return "female";
        }



        function generatedCharacterGenderFromBucket(bucket = 0, romanceable = true) {
            bucket = ((Math.floor(Number(bucket) || 0) % 100) + 100) % 100;
            return bucket < 50 ? "male" : "female";
        }

        function deterministicGeneratedCharacterGender(seed = "", romanceable = true) {
            const bucket = Number(stableStringHash(`generated-gender:${seed}`)) % 100;
            return generatedCharacterGenderFromBucket(bucket, romanceable);
        }



        function preferredGenderForRuntimeCharacter(character = {}, seed = "") {
            const current = supportedAdaptiveCharacterGender(character.gender);
            const preferred = preferredRuntimeCharacterGenders();
            if (!current || !preferred.length) return current;
            if (preferred.includes(current)) return current;
            if (preferred.length === 1) return preferred[0];
            return current;
        }

        function characterPresentationUsesMaleFields(gender = "") {
            return supportedAdaptiveCharacterGender(gender) === "male";
        }

        function characterLibraryPresentation(
            character = {},
            seed = "",
            requestedGender = "",
            options = {},
        ) {
            const projected = clone(character || {});
            if (!isPlainObject(projected)) return projected;
            if (
                projected.romanceable !== true &&
                options.allowNonRomanceable !== true
            )
                return projected;
            const current = supportedAdaptiveCharacterGender(projected.gender);
            const target = requestedGender
                ? supportedAdaptiveCharacterGender(requestedGender)
                : preferredGenderForRuntimeCharacter(projected, seed || projected.name);
            if (!current || !target || current === target) return projected;
            if ((current === "male") !== (target === "male"))
                swapCharacterGenderFallbackFields(projected);
            projected.gender = target;
            return projected;
        }

        function characterLibraryRequestedPresentationGender(tab = characterLibraryActiveTab()) {
            const panel = document.querySelector?.(
                `[data-character-library-tab-panel="${cssEscape(tab)}"]`,
            );
            const value = String(
                panel?.querySelector?.('[data-character-library-filter="gender"]')?.value || "",
            ).trim();
            if (!value) return "";
            const key = value.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
            if (["male", "man", "men", "trans male", "trans man", "trans men"].includes(key))
                return "male";
            return "female";
        }

        function characterPresentationNames(character = {}) {
            const canonicalName = textSlot(character?.name, "");
            const fallbackName = textSlot(character?.fallback_name, "");
            return characterPresentationUsesMaleFields(character?.gender)
                ? { male: canonicalName, non_male: fallbackName }
                : { male: fallbackName, non_male: canonicalName };
        }

        function shouldAdaptRuntimeCharacterGender(character = {}) {
            return (
                character.romanceable === true ||
                app.settings.swapAllGendersToPreferred === true
            );
        }

        function prepareMissingNonMaleFallbackOutfits(character = {}) {
            if (Array.isArray(character.fallback_outfits) && character.fallback_outfits.length)
                return false;
            const outfits = exactOutfitList(character.outfits || []);
            if (!outfits.length) {
                const clothing = exactClothingSlots(character.clothing || {});
                if (isEmptyClothingValue(clothing.bra)) clothing.bra = "bra";
                character.clothing = clothing;
                return false;
            }
            character.fallback_outfits = outfits.map((outfit) => {
                const fallback = clone(outfit);
                fallback.clothing = exactClothingSlots(
                    fallback.clothing || {},
                );
                if (isEmptyClothingValue(fallback.clothing.bra))
                    fallback.clothing.bra = "bra";
                return fallback;
            });
            const startingId = textSlot(character.starting_outfit_id, "");
            const fallbackIds = new Set(
                character.fallback_outfits.map((outfit) =>
                    textSlot(outfit?.id || outfit?.name, ""),
                ),
            );
            character.fallback_starting_outfit_id = fallbackIds.has(startingId)
                ? startingId
                : textSlot(
                      character.fallback_outfits[0]?.id ||
                          character.fallback_outfits[0]?.name,
                      "",
                  );
            return true;
        }

        function swapCharacterGenderFallbackFields(character = {}) {
            if (textSlot(character.fallback_name, "")) {
                const name = character.name;
                character.name = character.fallback_name;
                character.fallback_name = name;
            }
            if (Array.isArray(character.fallback_outfits) && character.fallback_outfits.length) {
                const outfits = character.outfits;
                character.outfits = character.fallback_outfits;
                character.fallback_outfits = Array.isArray(outfits) ? outfits : [];
                const startingOutfitId = character.starting_outfit_id;
                character.starting_outfit_id = character.fallback_starting_outfit_id || "";
                character.fallback_starting_outfit_id = startingOutfitId || "";
                const activeOutfitId = character.active_outfit_id;
                character.active_outfit_id = character.starting_outfit_id || "";
                if (!character.fallback_starting_outfit_id && activeOutfitId)
                    character.fallback_starting_outfit_id = activeOutfitId;
                const selected = exactOutfitList(character.outfits || []).find(
                    (outfit) =>
                        textSlot(outfit?.id || outfit?.name, "") ===
                        textSlot(character.active_outfit_id, ""),
                ) || exactOutfitList(character.outfits || [])[0];
                if (selected?.clothing)
                    character.clothing = exactClothingSlots(
                        clone(selected.clothing),
                    );
            }
        }

        function adaptRuntimeCharacterGender(character = {}, seed = "") {
            if (!isPlainObject(character) || !shouldAdaptRuntimeCharacterGender(character))
                return character;
            const current = supportedAdaptiveCharacterGender(character.gender);
            const target = preferredGenderForRuntimeCharacter(character, seed);
            if (!current || !target || current === target) return character;
            const crossesMaleBoundary = (current === "male") !== (target === "male");
            if (crossesMaleBoundary && current === "male" && target !== "male")
                prepareMissingNonMaleFallbackOutfits(character);
            if (crossesMaleBoundary) swapCharacterGenderFallbackFields(character);
            character.gender = target;
            [];
            clearInvalidRuntimeProfileImagePointer(character);
            return character;
        }

        function replaceExactRuntimeNameValues(value, replacements = new Map()) {
            if (typeof value === "string") return replacements.get(value) || value;
            if (Array.isArray(value))
                return value.map((item) => replaceExactRuntimeNameValues(item, replacements));
            if (!isPlainObject(value)) return value;
            const out = {};
            for (const [key, item] of Object.entries(value))
                out[key] = replaceExactRuntimeNameValues(item, replacements);
            return out;
        }

        function replaceRuntimeSceneEntityIds(state = {}, replacements = new Map()) {
            if (!isPlainObject(state?.scene) || !replacements.size) return state;
            const replaceName = (value) =>
                typeof value === "string" ? replacements.get(value) || value : value;
            for (const field of [
                "party_members_present",
                "image_characters",
                "npcs_present",
            ]) {
                if (!Array.isArray(state.scene[field])) continue;
                state.scene[field] = state.scene[field].map(replaceName);
            }
            return state;
        }

        function rekeyRuntimeNamedCharacterMap(records = {}) {
            if (!isPlainObject(records)) return records;
            const rekeyed = {};
            for (const [key, record] of Object.entries(records)) {
                const character = record?.full_character || record;
                const displayName = textSlot(character?.name || record?.name, key);
                // A duplicate final display name is invalid authored content. Keep
                // the original key rather than silently overwriting a character.
                const targetKey = rekeyed[displayName] ? key : displayName;
                rekeyed[targetKey] = record;
            }
            return rekeyed;
        }

        // Gender presentation is finalized only while a save is created. After
        // authored reference tokens have been materialized, runtime containers use
        // their actual display names as keys and retain no fallback-name aliases.
        function finalizeRuntimeCharacterNameKeys(state = {}) {
            if (!isPlainObject(state)) return state;
            const sceneReferenceReplacements = new Map();
            const registerSceneReference = (key, record) => {
                const character = record?.full_character || record;
                const displayName = textSlot(character?.name || record?.name, "");
                if (!displayName) return;
                for (const reference of [
                    key,
                    record?.id,
                    record?.character_id,
                    character?.id,
                    character?.character_id,
                    character?.definition_id,
                ]) {
                    const value = textSlot(reference, "");
                    if (value && value !== displayName)
                        sceneReferenceReplacements.set(value, displayName);
                }
            };
            registerSceneReference("Player", state.player);
            for (const [key, character] of Object.entries(state.characters || {}))
                registerSceneReference(key, character);
            for (const location of Object.values(state.npc_directory?.locations || {})) {
                if (!isPlainObject(location)) continue;
                for (const collectionName of ["characters", "npcs"])
                    for (const [key, record] of Object.entries(
                        location[collectionName] || {},
                    ))
                        registerSceneReference(key, record);
            }
            const replaceSceneReference = (value) =>
                typeof value === "string"
                    ? sceneReferenceReplacements.get(value) || value
                    : value;
            for (const field of [
                "party_members_present",
                "image_characters",
                "npcs_present",
            ]) {
                if (Array.isArray(state.scene?.[field]))
                    state.scene[field] = state.scene[field].map(replaceSceneReference);
            }
            state.characters = rekeyRuntimeNamedCharacterMap(state.characters || {});
            for (const location of Object.values(state.npc_directory?.locations || {})) {
                if (!isPlainObject(location)) continue;
                for (const collectionName of ["characters", "npcs"])
                    location[collectionName] = rekeyRuntimeNamedCharacterMap(
                        location[collectionName] || {},
                    );
            }
            return state;
        }

        function stripRuntimePresentationMetadata(character = {}) {
            if (!isPlainObject(character)) return;
            for (const field of [
                "profile_image_presentations",
                "fallback_name",
                "fallback_outfits",
                "fallback_starting_outfit_id",
            ])
                delete character[field];
        }

        function materializeRuntimeCharacterPresentation(character = {}, seed = "") {
            if (!isPlainObject(character)) return "";
            const oldName = textSlot(character.name, seed);
            adaptRuntimeCharacterGender(character, seed);
            const usesMaleFields = characterPresentationUsesMaleFields(character.gender);
            const selectedProfileImage = profileImagePresentationSlot(character, usesMaleFields);
            if (defaultProfileImageSlotHasRealReference(selectedProfileImage)) {
                character.default_profile_image = clone(selectedProfileImage);
                character.profile_image_id = textSlot(selectedProfileImage.id, character.profile_image_id || "");
            } else {
                character.default_profile_image = emptyProfileImageSlot(usesMaleFields);
                delete character.profile_image_id;
            }
            for (const field of ["profile_images", "profile_images_list"]) {
                if (!Array.isArray(character[field])) continue;
                character[field] = character[field].filter(
                    (image) => typeof image?.male !== "boolean" || image.male === usesMaleFields,
                );
            }
            stripRuntimePresentationMetadata(character);
            return oldName;
        }

        function materializeRuntimeSavePresentations(state = {}) {
            const replacements = new Map();
            const sceneEntityIdReplacements = new Map();
            const templateReferenceNames = {};
            const registerTemplateReference = (value, finalName) => {
                const key = normalizeRuntimeMessageTemplateKey(value);
                if (key && finalName) templateReferenceNames[key] = finalName;
            };
            const materialize = (character, seed) => {
                if (!isPlainObject(character)) return;
                const authoredName = textSlot(character.name, seed);
                const fallbackName = textSlot(character.fallback_name, "");
                const characterId = textSlot(character.id, "");
                const oldName = materializeRuntimeCharacterPresentation(character, seed);
                const newName = textSlot(character.name, oldName);
                for (const reference of [seed, characterId, authoredName, fallbackName, oldName, newName])
                    registerTemplateReference(reference, newName);
                for (const reference of [seed, characterId]) {
                    const value = textSlot(reference, "");
                    if (value && newName && value !== newName)
                        sceneEntityIdReplacements.set(value, newName);
                }
                for (const reference of [authoredName, fallbackName]) {
                    const value = textSlot(reference, "");
                    if (value && newName && value !== newName)
                        replacements.set(value, newName);
                }
                if (oldName && newName && oldName !== newName)
                    replacements.set(oldName, newName);
            };
            materialize(state.player, "Player");
            if (Array.isArray(state.players))
                state.players.forEach((character, index) => materialize(character, `player-${index + 1}`));
            else if (isPlainObject(state.players)) {
                if (Array.isArray(state.players.options))
                    state.players.options.forEach((character, index) =>
                        materialize(character, `player-${index + 1}`),
                    );
                else Object.entries(state.players).forEach(([id, character]) => materialize(character, id));
            }
            Object.entries(state.characters || {}).forEach(([id, character]) => materialize(character, id));
            for (const location of Object.values(state.npc_directory?.locations || {})) {
                for (const collectionName of ["characters", "npcs"])
                    Object.entries(location?.[collectionName] || {}).forEach(([id, npc]) => {
                        materialize(npc?.full_character || (looksLikeCharacterObject(npc) ? npc : null), id);
                        if (npc?.full_character) {
                            npc.name = npc.full_character.name || npc.name;
                            npc.gender = npc.full_character.gender || npc.gender;
                            stripRuntimePresentationMetadata(npc);
                        }
                    });
            }
            Object.entries(state.future_cast?.items || {}).forEach(([id, entry]) => {
                const character =
                    entry?.full_character ||
                    entry?.character ||
                    entry?.npc?.full_character ||
                    (looksLikeCharacterObject(entry?.npc) ? entry.npc : null);
                materialize(character, id);
                if (character) {
                    delete character.clothing;
                    entry.name = character.name || entry.name;
                    entry.gender = character.gender || entry.gender;
                    stripRuntimePresentationMetadata(entry);
                    if (entry.npc?.full_character) {
                        entry.npc.name = character.name || entry.npc.name;
                        entry.npc.gender = character.gender || entry.npc.gender;
                        stripRuntimePresentationMetadata(entry.npc);
                    }
                }
            });
            Object.defineProperty(state, "__runtimeTemplateReferenceNames", {
                value: templateReferenceNames,
                configurable: true,
                enumerable: false,
            });
            const materialized = replacements.size
                ? replaceExactRuntimeNameValues(state, replacements)
                : state;
            const runtimeState = replaceRuntimeSceneEntityIds(
                materialized,
                sceneEntityIdReplacements,
            );
            Object.defineProperty(runtimeState, "__runtimeTemplateReferenceNames", {
                value: templateReferenceNames,
                configurable: true,
                enumerable: false,
            });
            return runtimeState;
        }

