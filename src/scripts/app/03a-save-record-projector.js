        //#region Save Record Projector

        const saveProjectionQueue = {
            owners: new Map(),
            collections: new Map(),
            scheduled: false,
            flushing: null,
            sceneMembers: new Set(),
            sceneImageTargets: new Set(),
            partyMembers: new Set(),
            snapshots: new Set(),
            imageTargets: new Map(),
            rewardInvocations: new Set(),
            phase: "idle",
            generation: 0,
        };

        function exactSaveProjectionText(value, path, { nonEmpty = false } = {}) {
            if (typeof value !== "string" || (nonEmpty && !value))
                throw new Error(`${path} must be ${nonEmpty ? "non-empty " : ""}text.`);
            return value;
        }

        function exactSaveProjectionNumber(value, path) {
            if (typeof value !== "number" || !Number.isFinite(value))
                throw new Error(`${path} must be a finite number.`);
            return value;
        }

        function exactSaveProjectionArray(value, path) {
            if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
            return value;
        }

        function exactSaveProjectionObject(value, path) {
            if (!isPlainObject(value)) throw new Error(`${path} must be an object.`);
            return value;
        }

        function runtimeCharacterId(character = {}, path = "character") {
            if (!isPlainObject(character)) throw new Error(`${path} must be an object.`);
            const definition = isPlainObject(character.full_character)
                ? character.full_character
                : character;
            if (typeof definition.id !== "string" || !definition.id)
                throw new Error(`${path}.id must be non-empty text.`);
            if (
                isPlainObject(character.full_character) &&
                Object.hasOwn(character, "id") &&
                character.id !== definition.id
            )
                throw new Error(`${path}.id must exactly match ${path}.full_character.id.`);
            return definition.id;
        }

        function runtimeCharacterForSaveOwner(owner = {}) {
            if (owner.kind === "player") return app.state?.player || null;
            if (owner.kind === "character")
                return app.state?.characters?.[owner.recordId] || null;
            if (owner.kind === "npc") {
                try {
                    const [locationId, npcKey] = JSON.parse(owner.recordId);
                    return app.state?.npc_directory?.locations?.[locationId]?.characters?.[npcKey] || null;
                }
                catch {
                    return null;
                }
            }
            return null;
        }

        function initializeSaveProjectionState({ persistedImageTargets = false } = {}) {
            saveProjectionQueue.generation++;
            saveProjectionQueue.owners.clear();
            saveProjectionQueue.collections.clear();
            const playerId = runtimeCharacterId(app.state?.player || {});
            saveProjectionQueue.sceneMembers = new Set(
                [
                    ...(app.state?.scene?.party_members_present || []),
                    ...(app.state?.scene?.npcs_present || []),
                ]
                    .map(imageTargetIdForSave)
                    .filter((characterId) => characterId && characterId !== playerId),
            );
            saveProjectionQueue.sceneImageTargets = new Set(
                (app.state?.scene?.image_characters || [])
                    .map(imageTargetIdForSave)
                    .filter(Boolean),
            );

            saveProjectionQueue.partyMembers = new Set(
                Object.values(app.state?.characters || {})
                    .map((character) => runtimeCharacterId(character))
                    .filter(Boolean),
            );
            saveProjectionQueue.snapshots = new Set(
                (app.snapshots || [])
                    .map((snapshot, index) => {
                        if (!isPlainObject(snapshot))
                            throw new Error(`snapshots[${index}] must be an object.`);
                        if (typeof snapshot.id !== "string" || !snapshot.id)
                            throw new Error(`snapshots[${index}].id must be non-empty text.`);
                        return snapshot.id;
                    })
                    .filter(Boolean),
            );
            saveProjectionQueue.imageTargets = new Map(
                (app.images || []).map((image) => [
                    storyImageRecordForSave(image).imageId,
                    new Set((image?.targets || []).map((target) =>
                        persistedImageTargets
                            ? exactSaveProjectionText(target, "persisted story image target", { nonEmpty: true })
                            : imageTargetIdForSave(target)
                    )),
                ]).filter(([imageId]) => imageId),
            );
            saveProjectionQueue.rewardInvocations = new Set(
                Object.keys(app.rewardRuntime?.appliedInvocationIds || {}),
            );
        }

        function cancelSaveProjectionFlush() {
            saveProjectionQueue.generation++;
            saveProjectionQueue.owners.clear();
            saveProjectionQueue.collections.clear();
            saveProjectionQueue.scheduled = false;
            saveProjectionQueue.phase = "idle";
        }

        function scheduleSaveProjectionFlush() {
            if (!app.saveSessionActive || saveProjectionQueue.scheduled)
                return;
            saveProjectionQueue.scheduled = true;
            queueMicrotask(() => {
                saveProjectionQueue.scheduled = false;
                flushRuntimeSaveProjections().catch((error) => {
                    recordStorageFailure("runtime-save-projection", error);
                });
            });
        }

        function queueSaveProjectionOwner(owner) {
            const key = runtimeDirtyKey(owner.kind, owner.recordId);
            const previous = saveProjectionQueue.owners.get(key);
            saveProjectionQueue.owners.set(key, {
                ...owner,
                structural:
                    previous?.structural === true || owner.structural === true,
            });
        }

        function queueSaveRecordProjection(
            kind = "state-root",
            recordId = "current",
            operation = "put",
        ) {
            if (!app.saveSessionActive || app.suppressSaveProjections)
                return;
            exactSaveProjectionText(kind, "save projection kind", { nonEmpty: true });
            exactSaveProjectionText(recordId, "save projection recordId", { nonEmpty: true });
            if (!["put", "delete"].includes(operation))
                throw new Error(`Unsupported save projection operation: ${operation}.`);
            const owner = {
                kind,
                recordId,
                structural: operation === "delete",
            };
            queueSaveProjectionOwner(owner);
            scheduleSaveProjectionFlush();
        }

        function queueRuntimeSaveProjection(kind = "state", operation = {}) {
            if (!app.saveSessionActive || app.suppressSaveProjections)
                return;
            if (kind === "state") {
                const path = operation.path || [];
                if (
                    path[0] === "npc_directory" &&
                    path[1] === "locations" &&
                    path[3] === "characters" &&
                    path.length === 4
                ) {
                    const beforeCharacters = operation.beforeValue || {};
                    const nextCharacters = operation.value || {};
                    for (const npcKey of new Set([
                        ...Object.keys(beforeCharacters),
                        ...Object.keys(nextCharacters),
                    ])) {
                        const owner = {
                            kind: "npc",
                            recordId: runtimeNpcRecordId(path[2], npcKey),
                            structural:
                                !Object.prototype.hasOwnProperty.call(beforeCharacters, npcKey) ||
                                !Object.prototype.hasOwnProperty.call(nextCharacters, npcKey),
                        };
                        queueSaveProjectionOwner(owner);
                    }
                    scheduleSaveProjectionFlush();
                    return;
                }
                for (const owner of stateRecordOwnersForPath(operation.path || [])) {
                    if (owner.kind === "*") {
                        throw new Error(
                            `Normalized persistence cannot save an unowned state mutation at ${(operation.path || []).join(".") || "state"}.`,
                        );
                    }
                    queueSaveProjectionOwner({
                        ...owner,
                        structural:
                            owner.kind === "character" &&
                            path[0] === "characters" &&
                            path.length === 2,
                    });
                }
            }
            scheduleSaveProjectionFlush();
        }

        function queueSaveCollectionProjection(
            collection = "messages",
            id = "",
            operation = "put",
        ) {
            if (!app.saveSessionActive) return;
            exactSaveProjectionText(collection, "save collection", { nonEmpty: true });
            exactSaveProjectionText(id, "save collection record id", { nonEmpty: true });
            if (!["put", "delete"].includes(operation))
                throw new Error(`Unsupported save collection operation: ${operation}.`);
            const recordId = id;
            saveProjectionQueue.collections.set(
                `${collection}\u001f${recordId}`,
                { collection, id: recordId, operation },
            );
            scheduleSaveProjectionFlush();
        }

        function messageRecordForStorage(message = {}) {
            const validation = validateRuntimeMessageStorage([message]);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            const messageId = String(message.id);
            const optional = (key, value) => value == null || value === ""
                ? {}
                : { [key]: value };
            return {
                messageId,
                sequence: message.entryId,
                role: message.role,
                speaker: message.speaker,
                text: message.text,
                detail: message.detail,
                at: message.at,
                ...optional("stateSyncStatus", message.stateSyncStatus),
                ...(typeof message.autoTurn === "boolean" ? { autoTurn: message.autoTurn } : {}),
                ...(typeof message.autoRead === "boolean" ? { autoRead: message.autoRead } : {}),
                ...optional("replySource", message.replySource),
                ...(typeof message.generationStopped === "boolean"
                    ? { generationStopped: message.generationStopped }
                    : {}),
                ...(typeof message.objectiveComplete === "boolean"
                    ? { objectiveComplete: message.objectiveComplete }
                    : {}),
                ...optional("choiceObjectiveId", message.choiceObjectiveId),
                ...optional("choiceSnapshotId", message.choiceSnapshotId),
                ...optional("stateBackupId", message.stateBackupId),
            };
        }

        function snapshotRecordForSave(snapshot = {}) {
            const stored = snapshotForStorage(snapshot);
            if (!stored) throw new Error("Snapshot must be an object.");
            for (const field of ["id", "createdAt", "reason", "messageBoundaryId"])
                if (typeof stored[field] !== "string" || !stored[field])
                    throw new Error(`snapshot.${field} must be non-empty text.`);
            return {
                snapshotId: stored.id,
                createdAt: stored.createdAt,
                reason: stored.reason,
                messageBoundaryId: stored.messageBoundaryId,
                ...(stored.type ? { type: stored.type } : {}),
                ...(stored.startMessageId ? { startMessageId: stored.startMessageId } : {}),
                ...(stored.objectiveId ? { objectiveId: stored.objectiveId } : {}),
                ...(stored?.parentObjectiveId
                    ? { parentObjectiveId: stored.parentObjectiveId }
                    : {}),
            };
        }

        function imageTargetIdForSave(value = "") {
            if (typeof value !== "string" || !value)
                throw new Error("Image target must be non-empty text.");
            const playerId = runtimeCharacterId(app.state.player, "state.player");
            const candidates = [value];
            const resolvedName = resolveEntityName(value, app.state, "");
            if (resolvedName && !candidates.includes(resolvedName))
                candidates.push(resolvedName);
            for (const candidate of candidates) {
                if (
                    candidate === "Player" ||
                    candidate === playerId ||
                    candidate === app.state.player?.name
                )
                    return playerId;
                for (const [name, character] of Object.entries(app.state?.characters || {})) {
                    const id = runtimeCharacterId(character, `state.characters.${name}`);
                    if (candidate === id || candidate === name) return id;
                }
                for (const [locationId, location] of Object.entries(app.state?.npc_directory?.locations || {})) {
                    for (const [name, npc] of Object.entries(location?.characters || {})) {
                        const id = runtimeCharacterId(
                            npc,
                            `state.npc_directory.locations.${locationId}.characters.${name}`,
                        );
                        if (candidate === id || candidate === name) return id;
                    }
                }
            }
            throw new Error(`Image target ${value} does not exactly reference a runtime character.`);
        }





        function storyImageRecordForSave(image = {}) {
            if (!isPlainObject(image)) throw new Error("Story image must be an object.");
            if (typeof image.id !== "string" || !image.id)
                throw new Error("Story image id must be non-empty text.");
            if (typeof image.at !== "string" || !image.at)
                throw new Error(`Story image ${image.id}.at must be non-empty text.`);
            if (typeof image.model !== "string" || !image.model)
                throw new Error(`Story image ${image.id}.model must be non-empty text.`);
            if (typeof image.prompt !== "string" || !image.prompt)
                throw new Error(`Story image ${image.id}.prompt must be non-empty text.`);
            if (typeof image.negativePrompt !== "string")
                throw new Error(`Story image ${image.id}.negativePrompt must be text.`);
            const status = image.pending === true || image.status === "generating"
                ? "queued"
                : "ready";
            const url = image.hosted_url;
            if (url != null && typeof url !== "string")
                throw new Error(`Story image ${image.id}.hosted_url must be text when present.`);
            return {
                imageId: image.id,
                at: image.at,
                favorite: image.favorite === true,
                ...(image.title ? { title: image.title } : {}),
                ...(image.reason ? { reason: image.reason } : {}),
                model: image.model,
                ...(image.seed != null ? { seed: image.seed } : {}),
                prompt: image.prompt,
                negativePrompt: image.negativePrompt,
                ...(Number.isSafeInteger(image.requestOrder) && image.requestOrder > 0 ? { requestOrder: image.requestOrder } : {}),
                ...(image.requestedAfterMessageId
                    ? { requestedAfterMessageId: image.requestedAfterMessageId }
                    : {}),
                status,
                ...(image.hideFromChat === true ? { hideFromChat: true } : {}),
                ...(image.promptType ? { promptType: image.promptType } : {}),
                ...(url ? { url } : {}),
            };
        }

        function imageSaveOperations(entry) {
            if (entry.operation === "delete") {
                saveProjectionQueue.imageTargets.delete(entry.id);
                return [{ type: "story.image.delete", imageId: entry.id }];
            }
            const image = currentImageRecord(entry.id);
            if (!image) return [{ type: "story.image.delete", imageId: entry.id }];
            const operations = [{ type: "story.image.put", image: storyImageRecordForSave(image) }];
            const previousTargets = saveProjectionQueue.imageTargets.get(entry.id) || new Set();
            const targets = new Set((image.targets || []).map((target) =>
                previousTargets.has(target) ? target : imageTargetIdForSave(target)
            ));
            for (const characterId of previousTargets)
                if (!targets.has(characterId))
                    operations.push({ type: "story.image.target.delete", imageId: entry.id, characterId });
            for (const characterId of targets)
                if (!previousTargets.has(characterId))
                    operations.push({ type: "story.image.target.put", imageId: entry.id, characterId });
            saveProjectionQueue.imageTargets.set(entry.id, targets);
            return operations;
        }

        function sceneSaveOperations() {
            const scene = exactSaveProjectionObject(app.state?.scene, "state.scene");
            const playerId = runtimeCharacterId(app.state?.player, "state.player");
            const operations = [{
                type: "scene.runtime.set",
                values: {
                    summary: exactSaveProjectionText(scene.summary, "state.scene.summary"),
                    imageAction: exactSaveProjectionText(scene.image_action, "state.scene.image_action"),
                },
            }];
            const current = new Set(
                [
                    ...exactSaveProjectionArray(scene.party_members_present, "state.scene.party_members_present"),
                    ...exactSaveProjectionArray(scene.npcs_present, "state.scene.npcs_present"),
                ]
                    .map(imageTargetIdForSave)
                    .filter((characterId) => characterId && characterId !== playerId),
            );
            for (const characterId of current)
                if (!saveProjectionQueue.sceneMembers.has(characterId))
                    operations.push({ type: "scene.member.add", characterId });
            for (const characterId of saveProjectionQueue.sceneMembers)
                if (!current.has(characterId))
                    operations.push({ type: "scene.member.remove", characterId });
            saveProjectionQueue.sceneMembers = current;
            const imageTargets = new Set(
                exactSaveProjectionArray(scene.image_characters, "state.scene.image_characters")
                    .map(imageTargetIdForSave),
            );
            operations.push({
                type: "runtime.records.replace",
                storeName: "sceneImageTargets",
                records: [...imageTargets].map((characterId) => ({ characterId })),
            });
            saveProjectionQueue.sceneImageTargets = imageTargets;



            return operations;
        }

        function locationSaveOperations(locationId = "") {
            const id = String(locationId || "").trim();
            const location = app.state?.world_map?.locations?.[id];
            const authored = app.storyDefinition?.locationDefinitionsById?.[id] || null;
            const operations = [];

            if (!location) {
                operations.push(
                    { type: "runtime.records.replace", storeName: "runtimeLocationDefinitions", match: { locationId: id }, records: [] },
                    { type: "runtime.records.replace", storeName: "locationRuntime", match: { locationId: id }, records: [] },
                    { type: "runtime.records.replace", storeName: "locationConnections", match: { fromLocationId: id }, records: [] },
                );
                return operations;
            }

            if (!authored) {
                operations.push({
                    type: "runtime.records.replace",
                    storeName: "runtimeLocationDefinitions",
                    match: { locationId: id },
                    records: [{
                        locationId: id,
                        name: String(location.name || id),
                        type: String(location.type || "location"),
                        scale: String(location.scale || "local"),
                        parentId: location.parent_id ? String(location.parent_id) : null,
                        x: Number(location.x || 0),
                        y: Number(location.y || 0),
                        summary: String(location.summary || ""),
                    }],
                });
            }

            operations.push({
                type: "runtime.records.replace",
                storeName: "locationRuntime",
                match: { locationId: id },
                records: [{
                    locationId: id,
                    discovered: location.discovered !== false,
                    travelEnabled: location.travel_enabled !== false,
                }],
            });

            const currentConnections = new Set(
                (location.connections || []).map((entry) =>
                    String(entry?.location_id || entry?.id || entry || "").trim(),
                ).filter(Boolean),
            );
            const authoredConnections = new Set(
                (authored?.connections || []).map((entry) =>
                    String(entry?.location_id || entry?.id || entry || "").trim(),
                ).filter(Boolean),
            );
            operations.push({
                type: "runtime.records.replace",
                storeName: "locationConnections",
                match: { fromLocationId: id },
                records: [...new Set([...authoredConnections, ...currentConnections])].map(
                    (toLocationId) => ({
                        fromLocationId: id,
                        toLocationId,
                        present: currentConnections.has(toLocationId),
                    }),
                ),
            });
            return operations;
        }

        function worldMapSaveOperations() {
            const worldMap = app.state?.world_map || {};
            const records = Object.entries(worldMap)
                .filter(([fieldId]) => !["locations", "current_location_id", "travel_history"].includes(fieldId))
                .map(([fieldId, value]) => ({
                    fieldId: `world_map.${fieldId}`,
                    value: runtimeSaveUnwrapContainer(value),
                }));
            return [{
                type: "runtime.records.replace",
                storeName: "worldValues",
                match: { },
                records,
            }];
        }

        function futureCharacterSaveOperations() {
            const current = app.state?.future_cast?.items || {};
            const authored = app.storyDefinition?.futureCastDefinitionsById || {};
            const fields = ["status", "unlocked_by", "last_triggered_reason", "npc_location_id"];
            const records = [];

            for (const [characterId, entry] of Object.entries(current)) {
                const base = authored[characterId] || {};
                const changed = fields.some((field) =>
                    JSON.stringify(entry?.[field] ?? null) !== JSON.stringify(base?.[field] ?? null),
                );
                if (!changed) continue;
                records.push({
                    characterId,
                    status: String(entry?.status || "locked"),
                    unlockedBy: String(entry?.unlocked_by || ""),
                    lastTriggeredReason: String(entry?.last_triggered_reason || ""),
                    locationId: entry?.npc_location_id ? String(entry.npc_location_id) : null,
                });
            }
            return [{
                type: "runtime.records.replace",
                storeName: "futureCharacters",
                records,
            }];
        }

        function storyMemorySaveOperations() {
            const records = [];
            for (const [category, notes] of Object.entries(app.state?.story_memory || {})) {
                (Array.isArray(notes) ? notes : []).forEach((note, index) => {
                    const text = String(note || "");
                    records.push({
                        category,
                        noteId: `note-${index + 1}-${stableContentHash(text)}`,
                        sequence: index + 1,
                        text,
                    });
                });
            }
            return [{
                type: "runtime.records.replace",
                storeName: "storyMemoryNotes",
                records,
            }];
        }

        function recentChangeSaveOperations() {
            return [{
                type: "runtime.records.replace",
                storeName: "recentChanges",
                records: (app.state?.recent_changes || []).map((change, index) => {
                    const text = typeof change === "string" ? change : JSON.stringify(change);
                    return {
                        changeRecordId: `change-${index + 1}-${stableContentHash(text)}`,
                        sequence: index + 1,
                        text,
                    };
                }),
            }];
        }

        function storyRuleSaveOperations() {
            app.storyRulesRuntime = storyRulesRuntimeFromState(app.state, app.storyDefinition);
            return [
                {
                    type: "runtime.records.replace",
                    storeName: "storyRuleAdds",
                    records: (app.storyRulesRuntime?.added || []).map((rule) => ({
                        ruleId: storyRuleStableKey(rule),
                        text: typeof rule === "string" ? rule : JSON.stringify(rule),
                    })),
                },
                {
                    type: "runtime.records.replace",
                    storeName: "storyRuleRemovals",
                    records: (app.storyRulesRuntime?.removedKeys || []).map((ruleId) => ({ ruleId })),
                },
            ];
        }

        function objectiveSaveOperations() {
            const runtime = app.objectiveRuntime || createEmptyObjectiveRuntime();
            const objectiveIds = new Set([
                ...Object.keys(runtime.statusById || {}),
                ...Object.keys(runtime.selectedOutcomeById || {}),
                ...Object.keys(runtime.selectedOutcomeMessageById || {}),
                ...Object.keys(runtime.selectedChoiceById || {}),
                ...Object.keys(runtime.selectedChoiceTitleById || {}),
                ...Object.keys(runtime.selectedOutputById || {}),
                ...Object.keys(runtime.activationAiCheckAttemptedById || {}),
                ...Object.keys(runtime.activationNumberById || {}),
            ]);
            const operations = [{
                type: "objective.control.set",
                values: {
                    activeMainObjectiveId: String(
                        app.state?.objectives?.active_id || runtime.activeMainObjectiveId || "",
                    ) || null,
                    focusedSideObjectiveId: runtime.focusedSideObjectiveId || null,
                },
            }];
            const objectiveRecords = [];
            for (const objectiveId of objectiveIds) {
                const values = {};
                if (runtime.statusById?.[objectiveId] != null)
                    values.status = runtime.statusById[objectiveId];
                const selectedOutputId =
                    runtime.selectedOutputById?.[objectiveId] ??
                    runtime.selectedChoiceById?.[objectiveId] ??
                    runtime.selectedOutcomeById?.[objectiveId];
                if (selectedOutputId != null)
                    values.selectedOutputId = selectedOutputId;
                if (runtime.selectedOutcomeMessageById?.[objectiveId] != null)
                    values.selectedOutputMessageId = runtime.selectedOutcomeMessageById[objectiveId];
                if (runtime.activationAiCheckAttemptedById?.[objectiveId] != null)
                    values.activationAiCheckAttempted = !!runtime.activationAiCheckAttemptedById[objectiveId];
                if (runtime.activationNumberById?.[objectiveId] != null)
                    values.activationNumber = Number(runtime.activationNumberById[objectiveId]);
                if (Object.keys(values).length)
                    objectiveRecords.push({ objectiveId, ...values });
            }
            operations.push({
                type: "runtime.records.replace",
                storeName: "objectiveRuntime",
                records: objectiveRecords,
            });

            const progressRecords = [];
            for (const [objectiveId, rawNotes] of Object.entries(runtime.progressNotesById || {})) {
                const notes = Array.isArray(rawNotes) ? rawNotes : [rawNotes];
                notes.filter((note) => note != null && note !== "").forEach((note, index) => {
                    const text = typeof note === "string" ? note : JSON.stringify(note);
                    progressRecords.push({
                        objectiveId,
                        noteId: `note-${index + 1}-${stableContentHash(text)}`,
                        sequence: index + 1,
                        text,
                    });
                });
            }
            operations.push({
                type: "runtime.records.replace",
                storeName: "objectiveProgressNotes",
                records: progressRecords,
            });
            operations.push({
                type: "runtime.records.replace",
                storeName: "objectiveExclusiveGroupChoices",
                records: Object.entries(runtime.exclusiveGroupChoices || {}).map(
                    ([groupId, selectedObjectiveId]) => ({ groupId, selectedObjectiveId }),
                ),
            });

            const pendingRewardChoices = [];
            const pendingRewardOptions = [];
            for (const [index, choice] of (runtime.pendingRewardChoices || []).entries()) {
                const choiceId = String(choice?.id || `pending-reward-${index + 1}`);
                pendingRewardChoices.push({
                    choiceId,
                    objectiveId: String(choice?.objective_id || choice?.objectiveId || ""),
                    kind: String(choice?.kind || "item"),
                    reward: runtimeSaveUnwrapContainer(choice?.reward || {}),
                });
                for (const target of choice?.choices || []) {
                    const characterId = imageTargetIdForSave(target);
                    if (characterId) pendingRewardOptions.push({ choiceId, characterId });
                }
            }
            operations.push({
                type: "runtime.records.replace",
                storeName: "pendingRewardChoices",
                records: pendingRewardChoices,
            });
            operations.push({
                type: "runtime.records.replace",
                storeName: "pendingRewardChoiceOptions",
                records: pendingRewardOptions,
            });

            const pendingChoice = runtime.pendingChoice;
            const routeChoiceId = pendingChoice
                ? String(pendingChoice.id || `route-${pendingChoice.completed_id || "pending"}`)
                : "";
            operations.push({
                type: "runtime.records.replace",
                storeName: "pendingObjectiveRouteChoices",
                records: pendingChoice ? [{
                    choiceId: routeChoiceId,
                    reason: String(pendingChoice.reason || "multiple_dependents"),
                    completedObjectiveId: String(pendingChoice.completed_id || ""),
                }] : [],
            });
            operations.push({
                type: "runtime.records.replace",
                storeName: "pendingObjectiveRouteOptions",
                records: pendingChoice
                    ? [
                        ...(pendingChoice.objective_ids || []),
                        ...(pendingChoice.side_objective_ids || []),
                    ].map((objectiveId) => ({
                        choiceId: routeChoiceId,
                        objectiveId: String(objectiveId),
                    }))
                    : [],
            });
            operations.push({
                type: "story.root.replace",
                root: "objective_runtime_extras",
                value: {
                    noCurrent: runtime.noCurrent === true,
                    selectedOutcomeById: runtimeSaveUnwrapContainer(runtime.selectedOutcomeById || {}),
                    selectedChoiceById: runtimeSaveUnwrapContainer(runtime.selectedChoiceById || {}),
                    selectedChoiceTitleById: runtimeSaveUnwrapContainer(runtime.selectedChoiceTitleById || {}),
                    suggestions: runtimeSaveUnwrapContainer(runtime.suggestions || []),
                    completionMessage: String(runtime.completionMessage || ""),
                    completedMainMessage: String(runtime.completedMainMessage || ""),
                    pendingCompletionMessage: runtimeSaveUnwrapContainer(runtime.pendingCompletionMessage),
                },
            });
            return operations;
        }

        function timedEventSaveOperations(eventId = "") {
            const id = String(eventId || "").trim();
            const event = app.state?.timed_events?.[id];
            if (!id) return [];
            if (!event) return [
                { type: "runtime.records.replace", storeName: "timedEventRuntime", match: { timedEventId: id }, records: [] },
                { type: "runtime.records.replace", storeName: "timedEventAppliedStages", match: { timedEventId: id }, records: [] },
            ];
            return [
                {
                    type: "runtime.records.replace",
                    storeName: "timedEventRuntime",
                    match: { timedEventId: id },
                    records: [{
                        timedEventId: id,
                        status: String(event.status || "waiting"),
                        startElapsedMinutes: event.start_elapsed_minutes == null
                            ? null
                            : Number(event.start_elapsed_minutes),
                    }],
                },
                {
                    type: "runtime.records.replace",
                    storeName: "timedEventAppliedStages",
                    match: { timedEventId: id },
                    records: [...new Set(event.applied_stage_ids || [])]
                        .map((stageId) => ({ timedEventId: id, stageId: String(stageId || "").trim() }))
                        .filter((record) => record.stageId),
                },
            ];
        }

        function shopSaveOperations(shopId = "") {
            const id = String(shopId || "").trim();
            const shop = app.state?.story_shops?.[id];
            if (!id) return [];
            if (!shop) return [
                { type: "runtime.records.replace", storeName: "shopRuntime", match: { shopId: id }, records: [] },
                { type: "runtime.records.replace", storeName: "shopItemRuntime", match: { shopId: id }, records: [] },
            ];
            const itemRecords = (shop.items || []).map((item = {}) => {
                const itemId = String(item.id || item.character_id || "").trim();
                if (!itemId) return null;
                const record = { shopId: id, itemId };
                for (const [runtimeKey, storedKey] of [
                    ["quantity", "quantity"],
                    ["purchase_count", "purchaseCount"],
                    ["removed", "removed"],
                    ["locked", "locked"],
                    ["accepted", "accepted"],
                    ["completed", "completed"],
                ]) {
                    if (Object.hasOwn(item, runtimeKey)) record[storedKey] = item[runtimeKey];
                }
                return record;
            }).filter(Boolean);
            return [
                {
                    type: "runtime.records.replace",
                    storeName: "shopRuntime",
                    match: { shopId: id },
                    records: [{ shopId: id, unlocked: shop.unlocked === true }],
                },
                {
                    type: "runtime.records.replace",
                    storeName: "shopItemRuntime",
                    match: { shopId: id },
                    records: itemRecords,
                },
            ];
        }

        function generatedNpcPoolSaveOperations() {
            const records = Object.entries(app.state?.story_generated_npc_pool || {})
                .map(([poolEntryId, entry = {}]) => ({
                    poolEntryId: String(poolEntryId || "").trim(),
                    characterId: String(entry.character_id || entry.npc_id || entry.id || "").trim(),
                }))
                .filter((record) => record.poolEntryId && record.characterId);
            return [{ type: "runtime.records.replace", storeName: "generatedNpcPoolEntries", records }];
        }

        function generatedJobSaveOperations() {
            const jobs = app.state?.active_generated_jobs || {};
            const definitions = [];
            const runtime = [];
            const progress = [];
            const completed = [];
            for (const [jobKey, job = {}] of Object.entries(jobs)) {
                const jobId = String(job.id || jobKey || "").trim();
                if (!jobId) continue;
                const definitionId = String(job.definition_id || job.definitionId || jobId).trim();
                const definition = app.runtimeDefinitions?.jobsById?.[definitionId] ||
                    runtimeJobDefinitionFromJob({ ...job, id: definitionId });
                definitions.push({
                    jobId: definitionId,
                    definition: runtimeSaveUnwrapContainer(definition),
                    compiledIndexes: {},
                });
                const jobState = app.jobRuntime?.runtimeByJobId?.[jobId] ||
                    runtimeJobStateFromJob(job, definitionId);
                runtime.push({
                    jobId,
                    status: String(jobState.status || "active"),
                    currentStepId: String(jobState.currentStepId || "") || null,
                });
                for (const [pathKey, value] of Object.entries(jobState.progress || {})) {
                    if (!["string", "number", "boolean"].includes(typeof value) && value !== null)
                        throw new Error(`Generated job ${jobId} progress ${pathKey} must be scalar.`);
                    progress.push({ jobId, pathKey, value });
                }
                for (const stepId of jobState.completedStepIds || [])
                    completed.push({ jobId, stepId: String(stepId || "").trim() });
            }
            const offers = [];
            for (const [boardId, boardOffers] of Object.entries(app.state?.story_job_offers || {})) {
                for (const offer of Array.isArray(boardOffers) ? boardOffers : []) {
                    const offerId = String(offer?.offer_id || offer?.id || "").trim();
                    const templateId = String(offer?.template_id || "").trim();
                    if (!offerId || !templateId) continue;
                    offers.push({
                        boardId,
                        offerId,
                        templateId,
                        title: String(offer.title || "Generated Job"),
                        rank: Number(offer.rank || 0),
                        romanceable: offer.romanceable === true,
                        genres: [...(offer.genres || [])],
                        summary: String(offer.summary || ""),
                        rewardCoins: Number(offer.reward_coins || 0),
                        rewardXp: Number(offer.reward_xp || 0),
                        filledValues: runtimeSaveUnwrapContainer(offer.filled_values || {}),
                        accepted: offer.accepted === true,
                    });
                }
            }
            return [
                { type: "runtime.records.replace", storeName: "runtimeJobDefinitions", records: definitions },
                { type: "runtime.records.replace", storeName: "generatedJobRuntime", records: runtime },
                { type: "runtime.records.replace", storeName: "generatedJobProgressValues", records: progress },
                { type: "runtime.records.replace", storeName: "generatedJobCompletedSteps", records: completed.filter((record) => record.stepId) },
                { type: "runtime.records.replace", storeName: "storyJobOffers", records: offers },
                {
                    type: "story.root.replace",
                    root: "story_job_offer_history",
                    value: runtimeSaveUnwrapContainer(app.state?.story_job_offer_history || {}),
                },
            ];
        }

        function npcShellSaveOperation(owner, npc) {
            const [locationId, npcKey] = JSON.parse(owner.recordId);
            const path = `state.npc_directory.locations.${locationId}.characters.${npcKey}`;
            const characterId = runtimeCharacterId(npc, path);
            return {
                type: "npc.shell.put",
                shell: {
                    locationId: exactSaveProjectionText(locationId, `${path}.locationId`, { nonEmpty: true }),
                    characterId,
                    name: exactSaveProjectionText(npc.name, `${path}.name`, { nonEmpty: true }),
                    playerKnownName: npc.player_known_name === true,
                    playerFacingLabel: String(npc.player_facing_label || ""),
                    gender: exactSaveProjectionText(npc.gender, `${path}.gender`, { nonEmpty: true }),
                    age: exactSaveProjectionNumber(npc.age, `${path}.age`),
                    role: String(npc.role || ""),
                    relationshipToPlayer: String(npc.relationship || ""),
                    note: String(npc.note || ""),
                    personalityDescription: String(npc.personality_description || ""),
                    greeting: String(npc.greeting || ""),
                    currentAppearance: String(npc.current_appearance || ""),
                    canDie: npc.can_die === true || npc.full_character?.can_die === true,
                    recruitable: npc.recruitable === true,
                    everInvited: npc.ever_invited === true,
                    futureCharacterId: npc.future_character_id || null,
                    status: npc.status === "dead" ? "dead" : "alive",
                    deathNote: String(npc.death_note || ""),
                    killedBy: String(npc.killed_by || ""),
                    killedByPlayer: npc.killed_by_player === true,
                    inspected: isPlainObject(npc.full_character) === true,
                },
            };
        }

        function characterSaveOperations(owner) {
            const character = runtimeCharacterForSaveOwner(owner);
            if (!character) {
                if (owner.kind === "npc") {
                    const [, npcKey] = JSON.parse(owner.recordId);
                    return Promise.resolve([{ type: "npc.shell.delete", characterId: npcKey }]);
                }
                if (owner.kind === "character") {
                    const operations = [{ type: "character.delete", characterId: owner.recordId }];
                    if (saveProjectionQueue.partyMembers.has(owner.recordId))
                        operations.push({ type: "party.member.remove", characterId: owner.recordId });
                    saveProjectionQueue.partyMembers.delete(owner.recordId);
                    return Promise.resolve(operations);
                }
                return Promise.resolve([]);
            }
            const npcShellOperation = owner.kind === "npc"
                ? npcShellSaveOperation(owner, character)
                : null;
            if (npcShellOperation && !isPlainObject(character.full_character))
                return Promise.resolve([npcShellOperation]);
            const runtime = isPlainObject(character.full_character)
                ? character.full_character
                : character;
            const characterId = runtimeCharacterId(runtime, owner.recordId);
            if (!characterId)
                return Promise.reject(new Error(`Character ${owner.recordId} has no stable id.`));
            const structural = owner.structural === true || owner.kind === "npc";
            if (structural && app.saveSessionContext) {
                return app.library.materializeRuntimeCharacter({
                    ...app.saveSessionContext,
                    characterId,
                    character: runtimeSaveUnwrapContainer(runtime),
                    player: runtimeSaveUnwrapContainer(
                        exactSaveProjectionObject(app.state?.player, "state.player"),
                    ),
                    locationId: exactSaveProjectionText(
                        app.state?.location?.npc_location_id,
                        "state.location.npc_location_id",
                        { nonEmpty: true },
                    ),
                }).then((materialized) => {
                    const operations = [{
                        type: "character.replace",
                        characterId,
                        records: materialized.records,
                    }];
                    if (npcShellOperation) operations.push(npcShellOperation);
                    if (owner.kind === "character" && !saveProjectionQueue.partyMembers.has(characterId)) {
                        operations.push({ type: "party.member.add", characterId });
                        saveProjectionQueue.partyMembers.add(characterId);
                    }
                    return operations;
                });
            }
            return Promise.resolve([
                ...(npcShellOperation ? [npcShellOperation] : []),
                {
                    type: "character.relationship.set",
                    characterId,
                    values: {
                        trust: exactSaveProjectionNumber(runtime.trust, `${owner.recordId}.trust`),
                        attraction: exactSaveProjectionNumber(runtime.attraction, `${owner.recordId}.attraction`),
                        affection: exactSaveProjectionNumber(runtime.affection, `${owner.recordId}.affection`),
                    },
                },
                {
                    type: "character.scene.set",
                    characterId,
                    values: {
                        stateOfMind: exactSaveProjectionText(runtime.state_of_mind, `${owner.recordId}.state_of_mind`),
                        physicalState: exactSaveProjectionText(runtime.physical_state, `${owner.recordId}.physical_state`),
                        pose: exactSaveProjectionText(runtime.pose, `${owner.recordId}.pose`),
                    },
                },
                {
                    type: "character.durable.set",
                    characterId,
                    values: {
                        role: exactSaveProjectionText(runtime.role, `${owner.recordId}.role`),
                        relationshipToPlayer: exactSaveProjectionText(runtime.relationship_to_player, `${owner.recordId}.relationship_to_player`),
                        activeOutfitId:
                            runtime.active_outfit_id === null
                                ? null
                                : exactSaveProjectionText(runtime.active_outfit_id, `${owner.recordId}.active_outfit_id`),
                    },
                },
                {
                    type: "character.settings.set",
                    characterId,
                    values: (() => {
                        const config = exactSaveProjectionObject(
                            runtime.image_prompt_config,
                            `${owner.recordId}.image_prompt_config`,
                        );
                        if (typeof config.seed_enabled !== "boolean")
                            throw new Error(`${owner.recordId}.image_prompt_config.seed_enabled must be true or false.`);
                        const values = {
                            voice: exactSaveProjectionText(runtime.voice, `${owner.recordId}.voice`),
                            imageSeedEnabled: config.seed_enabled,
                            imageSeed: exactSaveProjectionNumber(config.seed, `${owner.recordId}.image_prompt_config.seed`),
                        };
                        if (Object.hasOwn(config, "profile_model_override"))
                            values.profileModelOverride = exactSaveProjectionText(
                                config.profile_model_override,
                                `${owner.recordId}.image_prompt_config.profile_model_override`,
                            );
                        return values;
                    })(),
                },
            ]);
        }

        function stateOwnerSaveOperations(owner) {
            if (owner.kind === "scene") return Promise.resolve(sceneSaveOperations());
            if (owner.kind === "meta") {
                const meta = exactSaveProjectionObject(app.state?.meta, "state.meta");
                return Promise.resolve([{
                    type: "save.header.set",
                    values: {
                        storyGuidance: exactSaveProjectionText(meta.story_guidance, "state.meta.story_guidance"),
                    },
                }]);
            }
            if (owner.kind === "story-clock") {
                const time = exactSaveProjectionObject(app.state?.time, "state.time");
                const storyClock = exactSaveProjectionObject(app.state?.story_clock, "state.story_clock");
                return Promise.resolve([{ type: "time.set", values: {
                    year: exactSaveProjectionNumber(time.year, "state.time.year"),
                    month: exactSaveProjectionNumber(time.month, "state.time.month"),
                    day: exactSaveProjectionNumber(time.day, "state.time.day"),
                    hour: exactSaveProjectionNumber(time.hour, "state.time.hour"),
                    minute: exactSaveProjectionNumber(time.minute, "state.time.minute"),
                    elapsedMinutes: exactSaveProjectionNumber(storyClock.elapsed_minutes, "state.story_clock.elapsed_minutes"),
                } }]);
            }
            if (owner.kind === "location-runtime") {
                const locationId = exactSaveProjectionText(
                    app.state?.location?.npc_location_id,
                    "state.location.npc_location_id",
                    { nonEmpty: true },
                );
                return Promise.resolve([{ type: "location.current.set", locationId }]);
            }
            if (owner.kind === "location")
                return Promise.resolve(locationSaveOperations(owner.recordId));
            if (owner.kind === "world-map")
                return Promise.resolve(worldMapSaveOperations());
            if (owner.kind === "future-cast-runtime")
                return Promise.resolve(futureCharacterSaveOperations());
            if (owner.kind === "story-memory")
                return Promise.resolve(storyMemorySaveOperations());
            if (owner.kind === "story-rules-runtime")
                return Promise.resolve(storyRuleSaveOperations());
            if (owner.kind === "state-root" && owner.recordId === "recent_changes")
                return Promise.resolve(recentChangeSaveOperations());
            if (owner.kind === "objective-runtime")
                return Promise.resolve(objectiveSaveOperations());
            if (owner.kind === "timed-event")
                return Promise.resolve(timedEventSaveOperations(owner.recordId));
            if (owner.kind === "shop")
                return Promise.resolve(shopSaveOperations(owner.recordId));
            if (owner.kind === "generated-npc-pool")
                return Promise.resolve(generatedNpcPoolSaveOperations());
            if (owner.kind === "job-runtime")
                return Promise.resolve(generatedJobSaveOperations());
            if (owner.kind === "npc-directory")
                return Promise.resolve([]);
            if (owner.kind === "reward-runtime") {
                const operations = [];
                for (const [invocationId, rawRecord] of Object.entries(
                    app.rewardRuntime?.appliedInvocationIds || {},
                )) {
                    if (saveProjectionQueue.rewardInvocations.has(invocationId)) continue;
                    const record = exactSaveProjectionObject(
                        rawRecord,
                        `rewardRuntime.appliedInvocationIds.${invocationId}`,
                    );
                    operations.push({
                        type: "reward.invocation.add",
                        invocation: {
                            invocationId,
                            appliedAt: exactSaveProjectionText(record.appliedAt, `${invocationId}.appliedAt`, { nonEmpty: true }),
                            sourceType: exactSaveProjectionText(record.sourceType, `${invocationId}.sourceType`, { nonEmpty: true }),
                            sourceId: exactSaveProjectionText(record.sourceId, `${invocationId}.sourceId`, { nonEmpty: true }),
                        },
                    });
                    saveProjectionQueue.rewardInvocations.add(invocationId);
                }
                return Promise.resolve(operations);
            }
            if (owner.kind === "story-pacing") {
                //Story pacing is derived from immutable definitions, objective runtime,
                //timed-event runtime, and game time. It is not independent save state.
                return Promise.resolve([]);
            }
            if (["player", "character", "npc"].includes(owner.kind))
                return characterSaveOperations(owner);
            if (owner.kind === "immutable-definition")
                throw new Error(`Immutable story definition data was mutated: ${owner.recordId}.`);
            const rootByOwnerKind = {
                "numeric-precision": "numeric_precision",
                inventory: "story_inventory",
                "world-runtime": "world_flags",
                "state-root": owner.recordId,
            };
            if (Object.prototype.hasOwnProperty.call(rootByOwnerKind, owner.kind)) {
                const root = rootByOwnerKind[owner.kind];
                const value = runtimeSaveUnwrapContainer(app.state?.[root]);
                return Promise.resolve([{
                    type: "story.root.replace",
                    root,
                    value: value ?? null,
                }]);
            }
            throw new Error(
                `Normalized persistence has no owner adapter for ${owner.kind}:${owner.recordId}.`,
            );
        }

        async function flushRuntimeSaveProjections() {
            if (!app.saveSessionActive || !app.persistence?.activeSaveState)
                return true;
            if (saveProjectionQueue.flushing) {
                await saveProjectionQueue.flushing;
                if (
                    app.saveSessionActive &&
                    (saveProjectionQueue.owners.size ||
                        saveProjectionQueue.collections.size)
                )
                    return flushRuntimeSaveProjections();
                return true;
            }
            const generation = saveProjectionQueue.generation;
            const flushPromise = (async () => {
                while (
                    app.saveSessionActive &&
                    saveProjectionQueue.generation === generation &&
                    (saveProjectionQueue.owners.size ||
                        saveProjectionQueue.collections.size)
                ) {
                    if (!app.saveSessionActive || saveProjectionQueue.generation !== generation)
                        break;
                    const owners = [...saveProjectionQueue.owners.values()];
                    const collections = [...saveProjectionQueue.collections.values()];
                    saveProjectionQueue.owners.clear();
                    saveProjectionQueue.collections.clear();
                    const operations = [];
                    for (const entry of collections) {
                        if (!app.saveSessionActive || saveProjectionQueue.generation !== generation)
                            break;
                        if (entry.collection === "messages") {
                            if (entry.operation === "delete") {
                                operations.push({ type: "message.delete", messageId: entry.id });
                                continue;
                            }
                            const message = currentMessageRecord(entry.id);
                            if (message)
                                operations.push({ type: "message.put", message: messageRecordForStorage(message) });
                            continue;
                        }
                        if (entry.collection === "snapshots") {
                            if (entry.operation === "delete") {
                                operations.push({ type: "snapshot.delete", snapshotId: entry.id });
                                saveProjectionQueue.snapshots.delete(entry.id);
                                continue;
                            }
                            const snapshot = currentSnapshotRecord(entry.id);
                            if (snapshot && !saveProjectionQueue.snapshots.has(entry.id)) {
                                operations.push({ type: "adapter.snapshot.begin", snapshot: snapshotRecordForSave(snapshot) });
                                saveProjectionQueue.snapshots.add(entry.id);
                            }
                            continue;
                        }
                        if (entry.collection === "images")
                            operations.push(...imageSaveOperations(entry));
                    }
                    for (const owner of owners) {
                        if (!app.saveSessionActive || saveProjectionQueue.generation !== generation)
                            break;
                        saveProjectionQueue.phase = `materializing ${owner.kind}:${owner.recordId}`;
                        operations.push(...await stateOwnerSaveOperations(owner));
                    }
                    let operationBatch = [];
                    const submitOperationBatch = async () => {
                        if (!operationBatch.length) return;
                        const pendingBatch = operationBatch;
                        operationBatch = [];
                        saveProjectionQueue.phase = `saving ${pendingBatch.length} operations`;
                        await app.persistence.submitOperations(
                            "runtime-mutation",
                            pendingBatch,
                        );
                    };
                    for (const operation of operations) {
                        if (!app.saveSessionActive || saveProjectionQueue.generation !== generation)
                            break;
                        saveProjectionQueue.phase = `saving ${operation.type}`;
                        if (operation.type === "adapter.snapshot.begin") {
                            await submitOperationBatch();
                            if (app.persistence.activeSnapshotId)
                                await app.persistence.commitSnapshot(app.persistence.activeSnapshotId);
                            await app.persistence.beginSnapshot(operation.snapshot);
                            continue;
                        }
                        operationBatch.push(operation);
                        if (operationBatch.length >= 500)
                            await submitOperationBatch();
                    }
                    if (app.saveSessionActive && saveProjectionQueue.generation === generation)
                        await submitOperationBatch();
                }
                saveProjectionQueue.phase = "idle";
                return true;
            })();
            saveProjectionQueue.flushing = flushPromise;
            try {
                return await flushPromise;
            }
            finally {
                if (saveProjectionQueue.flushing === flushPromise)
                    saveProjectionQueue.flushing = null;
                if (!saveProjectionQueue.owners.size && !saveProjectionQueue.collections.size)
                    saveProjectionQueue.phase = "idle";
                else
                    scheduleSaveProjectionFlush();
            }
        }

        //#endregion Normalized Save Adapter
