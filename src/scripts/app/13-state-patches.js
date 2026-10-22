


        function statePatchSetListMerge(baseValue, currentValue, patchValue) {
            const base = Array.isArray(baseValue) ? baseValue : [];
            const current = Array.isArray(currentValue) ? currentValue : [];
            const patch = Array.isArray(patchValue) ? patchValue : [];
            const baseSet = new Set(base.map(String));
            const currentSet = new Set(current.map(String));
            const patchSet = new Set(patch.map(String));
            const next = current.filter(
                (item) => patchSet.has(String(item)) || !baseSet.has(String(item)),
            );
            for (const item of patch) {
                const key = String(item);
                if (!baseSet.has(key) && !currentSet.has(key)) {
                    next.push(item);
                    currentSet.add(key);
                }
            }
            return next;
        }

        function statePatchPathUsesSetMerge(path = []) {
            const joined = path.join(".");
            return [
                "scene.party_members_present",
                "scene.image_characters",
                "scene.npcs_present",
            ].includes(joined);
        }

        function filterStatePatchConflicts(baseState, currentState, patch, options = {}) {
            const conflicts = [];
            const walk = (baseValue, currentValue, patchValue, path) => {
                if (Array.isArray(patchValue)) {
                    if (statePatchPathUsesSetMerge(path))
                        return statePatchSetListMerge(baseValue, currentValue, patchValue);
                    if (undoValuesEqual(currentValue, baseValue)) return clone(patchValue);
                    conflicts.push(path.join(".") || "state");
                    return undefined;
                }
                if (isPlainObject(patchValue)) {
                    const out = {};
                    for (const [key, value] of Object.entries(patchValue)) {
                        const child = walk(
                            baseValue?.[key],
                            currentValue?.[key],
                            value,
                            [...path, key],
                        );
                        if (child !== undefined) out[key] = child;
                    }
                    return Object.keys(out).length ? out : undefined;
                }
                if (autoStatePatchPathAllowed(baseState, currentState, path))
                    return clone(patchValue);
                conflicts.push(path.join(".") || "state");
                return undefined;
            };
            const filtered = walk(baseState, currentState, patch, []) || {};
            if (conflicts.length && app.settings?.devMode) {
                stateTrace("state patch conflicts skipped", {
                    label: options.source || "state patch",
                    conflicts: conflicts.slice(0, 40),
                    skippedCount: conflicts.length,
                    summary: `Skipped ${conflicts.length} stale automatic state change(s).`,
                });
            }
            return filtered;
        }

        function repairAiPatchAliases(patch = {}) {
            if (!isPlainObject(patch)) return patch;
            const draft = clone(patch);
            if (isPlainObject(draft.party_members)) {
                draft.characters = {
                    ...(isPlainObject(draft.characters) ? draft.characters : {}),
                    ...draft.party_members,
                };
                delete draft.party_members;
            }
            return draft;
        }

        function applyStatePatch(baseState, patch, options = {}) {
            const currentState = options.currentState || baseState;
            const repairedPatch = repairAiPatchAliases(patch);
            const effectivePatch = options.currentState
                ? filterStatePatchConflicts(baseState, currentState, repairedPatch, options)
                : repairedPatch;
            // Most callers pass the result through repairAiGeneratedState(), which
            // intentionally normalizes every branch. Keep those untrusted
            // transaction boundaries isolated. Narrow internal callers may opt
            // into structural sharing only after they have their own narrow
            // validation path.
            const targeted = options.targeted === true;
            const next = targeted ? { ...currentState } : clone(currentState);
            const changedRoots = new Set();
            const changedCharacterKeys = new Set();
            const changedNpcRecordIds = new Set();
            const changedLocationIds = new Set();
            let npcDirectoryMetadataChanged = false;
            const mutableRoot = (key) => {
                if (!changedRoots.has(key)) {
                    const currentValue = currentState?.[key];
                    if (targeted)
                        next[key] =
                            currentValue == null ? currentValue : clone(currentValue);
                    changedRoots.add(key);
                }
                return next[key];
            };
            const patchSource = options.source || "state patch";
            const beforeLocationKey = sceneLocationKey(next);

            if (isPlainObject(effectivePatch.location)) {
                mutableRoot("location");
                next.location = {
                    ...next.location,
                    ...extractLocation(effectivePatch.location),
                };
            }
            if (isPlainObject(effectivePatch.world_map)) {
                mutableRoot("world_map");
                for (const locationId of Object.keys(effectivePatch.world_map.locations || {}))
                    changedLocationIds.add(locationId);
                next.world_map = mergeWorldMap(next.world_map, effectivePatch.world_map, next);
            }
            if (isPlainObject(effectivePatch.npc_directory)) {
                mutableRoot("npc_directory");
                for (const [locationId, locationPatch] of Object.entries(
                    effectivePatch.npc_directory.locations || {},
                )) {
                    if (
                        !currentState?.npc_directory?.locations?.[locationId] ||
                        Object.keys(locationPatch || {}).some(
                            (key) => key !== "characters",
                        )
                    )
                        npcDirectoryMetadataChanged = true;
                    for (const npcKey of Object.keys(locationPatch?.characters || {}))
                        changedNpcRecordIds.add(runtimeNpcRecordId(locationId, npcKey));
                }
                next.npc_directory = mergeNpcDirectoryPatch(
                    next.npc_directory,
                    effectivePatch.npc_directory,
                    next,
                    { source: patchSource },
                );
            }
            if (isPlainObject(effectivePatch.time)) {
                mutableRoot("time");
                next.time = {
                    ...(next.time || {}),
                    ...pickNumberSlots(effectivePatch.time, [
                        "year",
                        "month",
                        "day",
                        "hour",
                        "minute",
                    ]),
                };
            }
            if (isPlainObject(effectivePatch.scene)) {
                mutableRoot("scene");
                const scenePatch = extractScene(effectivePatch.scene);
                if (Array.isArray(effectivePatch.scene.party_members_present))
                    scenePatch.party_members_present = sanitizeAiScenePresenceList(
                        effectivePatch.scene.party_members_present,
                        next,
                    );
                if (Array.isArray(effectivePatch.scene.npcs_present))
                    scenePatch.npcs_present = sanitizeAiScenePresenceList(
                        effectivePatch.scene.npcs_present,
                        next,
                    );
                next.scene = {
                    ...next.scene,
                    ...scenePatch,
                };
                logSceneNpcPresenceRemoval(
                    currentState.scene?.npcs_present,
                    next.scene?.npcs_present,
                    `AI ${patchSource}`,
                );
            }
            if (isPlainObject(effectivePatch.player)) {
                mutableRoot("player");
                const beforePlayer = clone(next.player);
                next.player = {
                    ...next.player,
                    ...extractPlayer(effectivePatch.player, next.player),
                };
                if (isPlainObject(effectivePatch.player.clothing))
                    moveReplacedClothingToInventoryFromCurrent(
                        next.player,
                        beforePlayer.clothing || {},
                        effectivePatch.player.clothing,
                        "Player",
                        { ...next, player: beforePlayer },
                    );
            }
            if (isPlainObject(effectivePatch.world_flags)) {
                mutableRoot("world_flags");
                next.world_flags = {
                    ...next.world_flags,
                    ...extractWorldFlags(effectivePatch.world_flags),
                };
            }
            if (isPlainObject(effectivePatch.progression)) {
                mutableRoot("progression");
                next.progression = {
                    ...next.progression,
                    ...extractProgression(effectivePatch.progression),
                };
            }
            if (isPlainObject(effectivePatch.objectives)) {
                mutableRoot("objectives");
                next.objectives = mergeObjectivesForStatePatch(
                    next.objectives,
                    effectivePatch.objectives,
                    next,
                );
            }
            if (isPlainObject(effectivePatch.story_memory)) {
                mutableRoot("story_memory");
                next.story_memory = extractStoryMemory({
                    ...(next.story_memory || {}),
                    ...effectivePatch.story_memory,
                });
            }
            if (Array.isArray(effectivePatch.recent_changes)) {
                mutableRoot("recent_changes");
                next.recent_changes = stringListSlot(
                    effectivePatch.recent_changes,
                    next.recent_changes || [],
                ).slice(0, 8);
            }

            if (isPlainObject(effectivePatch.characters)) {
                for (const [name, charPatch] of Object.entries(
                    effectivePatch.characters,
                )) {
                    if (!isPlainObject(charPatch)) continue;
                    if (isPlayerEntityName(name, next)) {
                        // State AI sometimes tries to update the player through
                        // characters.<player>. The player is not a party/NPC record,
                        // so keep them out of characters and accept only safe player fields.
                        mutableRoot("player");
                        next.player = {
                            ...next.player,
                            ...extractPlayer(charPatch, next.player),
                        };
                        continue;
                    }
                    mutableRoot("characters");
                    next.characters ||= {};
                    changedCharacterKeys.add(name);
                    if (!next.characters[name]) {
                        addNpcFromCharacterPatch(next, name, charPatch);
                        continue;
                    }
                    next.characters[name] = mergeCharacterPatch(
                        next.characters[name],
                        charPatch,
                        { characterName: name, state: next },
                    );
                }
            }

            if (beforeLocationKey !== sceneLocationKey(next)) {
                mutableRoot("scene");
                pruneSceneForLocationChange(next);
            }

            if (changedRoots.has("player")) mutableRoot("player");
            if (changedRoots.has("characters")) mutableRoot("characters");
            if (changedRoots.has("npc_directory")) mutableRoot("npc_directory");
            revertProtectedDeathChanges(currentState, next, patchSource);
            Object.defineProperty(next, "__runtimePatchRoots", {
                configurable: true,
                enumerable: false,
                value: [...changedRoots],
            });
            Object.defineProperty(next, "__runtimePatchCharacterKeys", {
                configurable: true,
                enumerable: false,
                value: [...changedCharacterKeys],
            });
            Object.defineProperty(next, "__runtimePatchNpcKeys", {
                configurable: true,
                enumerable: false,
                value: [...changedNpcRecordIds],
            });
            Object.defineProperty(next, "__runtimePatchLocationIds", {
                configurable: true,
                enumerable: false,
                value: [...changedLocationIds],
            });
            Object.defineProperty(next, "__runtimePatchNpcDirectoryMetadataChanged", {
                configurable: true,
                enumerable: false,
                value: npcDirectoryMetadataChanged,
            });
            return next;
        }

        function entityDeathState(entity = {}) {
            if (!isPlainObject(entity)) return {};
            return {
                status: textSlot(entity.status, ""),
                relationship: textSlot(entity.relationship, ""),
                death_note: textSlot(entity.death_note, ""),
                killed_by: textSlot(entity.killed_by, ""),
                killed_by_player: entity.killed_by_player === true,
                physical_state: textSlot(entity.physical_state, ""),
                state_of_mind: textSlot(entity.state_of_mind, ""),
                pose: textSlot(entity.pose, ""),
            };
        }

        function deathStateLooksDead(snapshot = {}) {
            return [
                snapshot.status,
                snapshot.relationship,
                snapshot.physical_state,
                snapshot.state_of_mind,
                snapshot.pose,
            ].some((value) => String(value || "").trim().toLowerCase() === "dead");
        }

        function revertProtectedEntityDeath(beforeEntity, afterEntity, label, source = "state patch") {
            if (!isPlainObject(beforeEntity) || !isPlainObject(afterEntity)) return false;
            if (beforeEntity.can_die !== false && afterEntity.can_die !== false) return false;
            const before = entityDeathState(beforeEntity);
            const after = entityDeathState(afterEntity);
            if (deathStateLooksDead(before) || !deathStateLooksDead(after)) return false;
            for (const key of [
                "status",
                "relationship",
                "death_note",
                "killed_by",
                "killed_by_player",
                "physical_state",
                "state_of_mind",
                "pose",
            ]) {
                if (Object.hasOwn(beforeEntity, key)) afterEntity[key] = beforeEntity[key];
                else delete afterEntity[key];
            }
            log(
                "Death blocked",
                `${label} death from ${source} was blocked because can_die is false.`,
                { type: "state", level: "message" },
            );
            return true;
        }

        function revertProtectedDeathChanges(beforeState = {}, afterState = {}, source = "state patch") {
            revertProtectedEntityDeath(beforeState.player, afterState.player, "Player", source);
            for (const [name, afterChar] of Object.entries(afterState.characters || {})) {
                revertProtectedEntityDeath(
                    beforeState.characters?.[name],
                    afterChar,
                    name,
                    source,
                );
            }
            const beforeLocations = beforeState.npc_directory?.locations || {};
            const afterLocations = afterState.npc_directory?.locations || {};
            for (const [locationLabel, location] of Object.entries(afterLocations)) {
                for (const [key, afterNpc] of Object.entries(location?.characters || {})) {
                    const beforeNpc = beforeLocations?.[locationLabel]?.characters?.[key];
                    const label = afterNpc?.name || key;
                    const revertedShell = revertProtectedEntityDeath(
                        beforeNpc,
                        afterNpc,
                        label,
                        source,
                    );
                    const revertedFull = revertProtectedEntityDeath(
                        beforeNpc?.full_character,
                        afterNpc?.full_character,
                        label,
                        source,
                    );
                    if (revertedShell || revertedFull) {
                        afterState.scene ||= {};
                        for (const listKey of ["npcs_present", "image_characters"]) {
                            if (
                                Array.isArray(beforeState.scene?.[listKey]) &&
                                !afterState.scene[listKey]?.includes?.(label)
                            ) {
                                afterState.scene[listKey] = [
                                    ...new Set([
                                        ...(afterState.scene[listKey] || []),
                                        ...beforeState.scene[listKey].filter(
                                            (name) => String(name) === String(label),
                                        ),
                                    ]),
                                ];
                            }
                        }
                    }
                }
            }
        }

        function sceneLocationKey(state = app.state) {
            const loc = state.location || {};
            return [
                state.world_map?.current_location_id || "",
                loc.universe || "",
                loc.world || "",
                loc.continent || "",
                loc.region || "",
                loc.settlement_name || "",
                loc.district || "",
                loc.specific_place || "",
            ].join("|");
        }

        function pruneSceneForLocationChange(state = app.state) {
            state.scene ||= {};
            const partyNames = new Set([
                textSlot(state.player?.name, "Player"),
                ...Object.keys(state.characters || {}),
            ]);
            const partyOnly = (list) =>
                [...new Set(Array.isArray(list) ? list : [])].filter((name) =>
                    partyNames.has(name),
                );
            state.scene.party_members_present = partyOnly(
                state.scene.party_members_present,
            );
            state.scene.image_characters = partyOnly(
                state.scene.image_characters,
            );
            if (!state.scene.image_characters.length)
                state.scene.image_characters = [
                    state.scene.party_members_present[0] ||
                        textSlot(state.player?.name, "Player"),
                ];
            // NPC presence is narrative state. A location change alone does not
            // establish that someone left; the per-turn scene-removal check owns
            // those removals. Travel code may add authored destination NPCs.
        }

        function mergeCharacterPatch(character, patch, options = {}) {
            const next = { ...character };
            const beforeClothing = clone(next.clothing || {});
            const textKeys = [
                "gender",
                "role",
                "voice",
                "speech_style",
                "relationship_to_player",
                "state_of_mind",
                "physical_state",
                "pose",
            ];

            for (const key of textKeys) {
                if (patch[key] != null) next[key] = textSlot(patch[key]);
            }
            if (options.allowPersonalityDescription) {
                const personality = textSlot(
                    patch.personality_description || patch.personality,
                    "",
                );
                if (personality) next.personality_description = personality;
            }

            for (const key of ["trust", "attraction", "affection"]) {
                if (patch[key] == null) continue;
                const adjusted = relationshipStatCappedAbsoluteValue(
                    next[key],
                    patch[key],
                    key,
                );
                if (adjusted != null) next[key] = adjusted;
            }
            if (patch.boldness != null)
                next.boldness = repairAiCharacterBoldness(
                    patch.boldness,
                    next.boldness,
                );

            if (patch.age != null) next.age = repairAiAge(patch.age, next.age);
            if (patch.can_die != null) next.can_die = patch.can_die === true;
            if (isPlainObject(patch.clothing)) {
                next.clothing = mergeClothingSlots(
                    next.clothing || {},
                    patch.clothing,
                    Object.keys(patch.clothing),
                );
            }
            if (patch.outfits != null) {
                const outfits = exactOutfitList(patch.outfits);
                next.outfits = outfits;
            }
            const selectedOutfit = selectedOutfitIdFromPatch(patch);
            if (selectedOutfit) {
                next.active_outfit_id = selectedOutfit;
                applyOutfitToEntity(next, selectedOutfit, {
                    characterName: options.characterName,
                    state: options.state,
                });
            }
            if (isPlainObject(patch.held_items))
                next.held_items = {
                    ...(next.held_items || {}),
                    ...pickTextSlots(
                        patch.held_items,
                        Object.keys(patch.held_items),
                    ),
                };
            if (isPlainObject(patch.appearance))
                next.appearance = {
                    ...(next.appearance || {}),
                    ...patch.appearance,
                };
            if (Array.isArray(patch.inventory))
                next.inventory = repairAiInventoryList(patch.inventory);
            if (isPlainObject(patch.clothing))
                moveReplacedClothingToInventoryFromCurrent(
                    next,
                    beforeClothing,
                    patch.clothing,
                    options.characterName || "",
                    options.state || app.state,
                );
            if (Array.isArray(patch.known_facts))
                next.known_facts = stringListSlot(
                    patch.known_facts,
                    next.known_facts || [],
                );
            if (isPlainObject(patch.stats)) next.stats = clone(patch.stats);

            return next;
        }

        function addNpcFromCharacterPatch(state, name, patch = {}) {
            if (!name || isPlayerEntityName(name, state) || state.characters?.[name])
                return;
            const existingNpc = findNpcEntryInState(state, name);
            const futureEntry = introducedFutureCastEntryByName(state, name);
            const locationId = existingNpc?.locationId || requireNpcLocationId(
                state,
                "",
                "NPC state patch",
            );
            const location = ensureNpcDirectoryLocation(
                state,
                locationId,
                existingNpc?.locationLabel || currentSettlementName(state),
            );
            const npcs = location.characters;
            const existing = existingNpc?.npc || npcs[name] || {};
            const futureFull =
                !existing.full_character && futureEntry?.full_character
                    ? futureCharacterFullCharacter(futureEntry, name)
                    : null;
            // Rule: a character patch for a non-party NPC is only a lightweight
            // state update. It must preserve an existing inspected/full NPC, and
            // if the NPC came from introduced future_cast data it must restore
            // that full profile instead of creating a downgraded local shell.
            npcs[existingNpc?.key || name] = {
                ...existing,
                name,
                gender: textSlot(
                    patch.gender,
                    existing.gender ||
                        existing.full_character?.gender ||
                        futureFull?.gender ||
                        "unspecified",
                ),
                age: repairAiAdultAge(
                    patch.age || existing.age || existing.full_character?.age || futureFull?.age,
                    name,
                    patch.role ||
                        patch.role ||
                        existing.role ||
                        existing.full_character?.role ||
                        futureFull?.role,
                    "NPC patch",
                ),
                role: textSlot(
                    patch.role || patch.role,
                    existing.role ||
                        existing.full_character?.role ||
                        futureFull?.role ||
                        "local",
                ),
                relationship: textSlot(
                    patch.relationship || patch.relationship_to_player,
                    existing.relationship ||
                        existing.full_character?.relationship_to_player ||
                        futureFull?.relationship_to_player ||
                        "unknown",
                ),
                note: textSlot(
                    patch.note || patch.state_of_mind || patch.physical_state,
                    existing.note ||
                        "appeared in the current scene but has not joined the party",
                ),
                current_appearance: textSlot(
                    patch.current_appearance || patch.currentAppearance,
                    existing.current_appearance || "",
                ),
                inspected: !!(
                    existing.inspected ||
                    existing.full_character ||
                    futureFull
                ),
                future_character_id:
                    existing.future_character_id || futureEntry?.id || "",
                full_character: existing.full_character || futureFull || null,
            };
            state.scene ||= {};
            replaceSceneNpcPresence(
                state,
                [...(state.scene.npcs_present || []), name],
                "NPC created by state patch",
            );
        }
        function mergeClothingSlots(current, patch, keys = Object.keys(patch || {})) {
            const next = exactClothingSlots(current || {});
            const normalized = exactClothingSlots(patch, keys);
            for (const key of keys) {
                if (!validClothingSlots().includes(key)) continue;
                if (!(key in normalized)) continue;
                if (normalized[key] == null) delete next[key];
                else next[key] = normalized[key];
            }
            return next;
        }

        function clothingItemText(value) {
            if (isPlainObject(value)) return cleanPromptText(value.item ?? value.description ?? value.name);
            return cleanPromptText(value);
        }

        function outfitIdFromName(name = "Outfit") {
            const base =
                String(name || "outfit")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                    .slice(0, 40) || "outfit";
            return `${base}-${Date.now().toString(36).slice(-5)}`;
        }

        function repairAiOutfitRecord(record, index = 0) {
            if (!isPlainObject(record)) return null;
            const name = textSlot(record.name || record.title || `Outfit ${index + 1}`);
            const id = textSlot(record.id || record.key || name || `outfit-${index + 1}`);
            const clothing = exactClothingSlots(
                record.clothing || record.outfit || {},
            );
            if (!id || !name || !Object.keys(clothing).length) return null;
            const image = runtimeStoryImageSlotFromExactInput(record.image, {
                image_prompt: record.image_prompt || record.prompt,
                image_id: record.image_id || record.local_image_id,
            });
            return {
                id,
                name,
                contexts: stringListSlot(record.contexts, []),
                formality: Number.isFinite(Number(record.formality))
                    ? Number(record.formality)
                    : 0,
                origin: textSlot(record.origin, ""),
                memory: textSlot(record.memory, ""),
                source_shop_id: textSlot(record.source_shop_id, ""),
                source_outfit_id: textSlot(record.source_outfit_id, ""),
                image_prompt: textSlot(
                    record.image_prompt || record.prompt || image?.prompt,
                    "",
                ),
                image_id: textSlot(
                    record.image_id ||
                        record.local_image_id ||
                        image?.local_image_id,
                    "",
                ),
                ...(image ? { image } : {}),
                clothing,
            };
        }

        function generatedNpcRoleOutfit(role = "client", malePresentation = false) {
            const id = malePresentation ? "role-male" : "role-non-male";
            return {
                id,
                name: `${textSlot(role, "Job Contact")} Attire`,
                clothing: exactClothingSlots({
                    bra: malePresentation ? null : "practical supportive bra",
                    shirt: `practical ${textSlot(role, "job contact")} shirt suited to the local setting`,
                    underwear: "plain comfortable underwear",
                    pants: "practical work trousers suited to the local setting",
                    socks: "plain work socks",
                    feet: "sturdy work shoes suited to the local setting",
                }),
            };
        }

        function repairAiOutfitList(outfits = []) {
            const entries = Array.isArray(outfits)
                ? outfits
                : isPlainObject(outfits)
                  ? Object.entries(outfits).map(([id, value]) => ({
                        ...(isPlainObject(value) ? value : {}),
                        id,
                    }))
                  : [];
            const seen = new Set();
            return entries
                .map((entry, index) => repairAiOutfitRecord(entry, index))
                .filter((entry) => {
                    if (!entry || seen.has(entry.id)) return false;
                    seen.add(entry.id);
                    return true;
                });
        }

        const RUNTIME_OUTFIT_FIELDS = Object.freeze([
            "id",
            "name",
            "formality",
            "origin",
            "memory",
            "source_shop_id",
            "source_outfit_id",
            "image_prompt",
            "image_id",
            "image",
            "contexts",
            "clothing",
            "held_items",
        ]);

        function runtimeOutfitValidationErrors(record, path = "outfit") {
            if (!isPlainObject(record))
                return [validationError(path, "required", "Outfit must be an object.")];
            const authoredFields = {
                id: record.id,
                name: record.name,
                clothing: record.clothing,
            };
            const errors = [
                ...exactObjectFieldValidationErrors(record, RUNTIME_OUTFIT_FIELDS, path),
                ...outfitDefinitionValidationErrors(authoredFields, path, "Outfit"),
                ...runtimeStoryImageValidationErrors(record.image, `${path}.image`),
            ];
            {}
            for (const field of [
                "origin",
                "memory",
                "source_shop_id",
                "source_outfit_id",
                "image_prompt",
                "image_id",
            ]) {
                if (Object.hasOwn(record, field) && typeof record[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
            }
            for (const field of ["formality"]) {
                if (Object.hasOwn(record, field) && !Number.isFinite(record[field]))
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a finite number.`));
            }
            if (
                Object.hasOwn(record, "contexts") &&
                (!Array.isArray(record.contexts) ||
                    record.contexts.some((context) => typeof context !== "string" || !context.trim()))
            )
                errors.push(validationError(`${path}.contexts`, "type", `${path}.contexts must contain only non-empty text.`));
            if (Object.hasOwn(record, "held_items")) {
                if (!isPlainObject(record.held_items))
                    errors.push(validationError(`${path}.held_items`, "type", `${path}.held_items must be an object.`));
                else {
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            record.held_items,
                            ["right_hand", "left_hand"],
                            `${path}.held_items`,
                        ),
                    );
                    for (const [hand, value] of Object.entries(record.held_items))
                        if (value !== null && typeof value !== "string")
                            errors.push(validationError(`${path}.held_items.${hand}`, "type", `${path}.held_items.${hand} must be text or null.`));
                }
            }
            return errors;
        }

        function exactOutfitRecord(record, path = "outfit") {
            const errors = runtimeOutfitValidationErrors(record, path);
            if (errors.length)
                throw new Error(validationErrorsText(validationResult(errors)));
            return clone(record);
        }

        function exactOutfitList(outfits, path = "outfits") {
            if (!Array.isArray(outfits))
                throw new Error(`${path} must be an array.`);
            const seen = new Set();
            return outfits.map((record, index) => {
                const outfit = exactOutfitRecord(record, `${path}.${index}`);
                if (seen.has(outfit.id))
                    throw new Error(`${path}.${index}.id duplicates outfit id ${outfit.id}.`);
                seen.add(outfit.id);
                return outfit;
            });
        }







        function activeProfileOutfits(character = null, path = "character") {
            if (!isPlainObject(character)) return [];
            return exactOutfitList(character.outfits || [], `${path}.outfits`).filter(
                (outfit) => true,
            );
        }

        function promptKnownFactFields(character = null, limit = 4) {
            const count = Number.isSafeInteger(limit) && limit >= 0 ? limit : 4;
            const fields = {
                known_facts: Array.isArray(character?.known_facts)
                    ? character.known_facts.slice(-count)
                    : [],
            };
            {}
            return fields;
        }







        function exactEntityOutfits(entity, path = "character") {
            if (!isPlainObject(entity))
                throw new Error(`${path} must be an object.`);
            entity.outfits = exactOutfitList(entity.outfits, `${path}.outfits`);
            if (
                entity.active_outfit_id &&
                !entity.outfits.some((outfit) => outfit.id === entity.active_outfit_id)
            )
                throw new Error(
                    `${path}.active_outfit_id references missing outfit ${entity.active_outfit_id}.`,
                );
            return entity.outfits;
        }

        function applyOutfitToEntity(entity, outfitId, options = {}) {
            const id = String(outfitId || "").trim();
            if (!entity || !id) return false;
            const outfits = exactEntityOutfits(
                entity,
                options.characterName || entity.name || "character",
            );
            const outfit = outfits.find(
                (item) => item.id === id || item.name.toLowerCase() === id.toLowerCase(),
            );
            if (!outfit) return false;
            {}
            entity.clothing = {
                ...blankClothingTemplate(),
                ...exactClothingSlots(outfit.clothing),
            };
            entity.active_outfit_id = outfit.id;

            return true;
        }

        function clothingSlotsMatch(left = {}, right = {}) {
            return validClothingSlots().every(
                (slot) =>
                    clothingItemText(left?.[slot]) === clothingItemText(right?.[slot]),
            );
        }

        function outfitWouldChangeEntity(entity, outfitId) {
            const id = String(outfitId || "").trim();
            if (!entity || !id) return false;
            const outfits = exactEntityOutfits(entity);
            const outfit = outfits.find(
                (item) => item.id === id || item.name.toLowerCase() === id.toLowerCase(),
            );
            if (!outfit) return false;
            return (
                textSlot(entity.active_outfit_id, "") !== outfit.id ||
                !clothingSlotsMatch(entity.clothing || {}, outfit.clothing || {})
            );
        }

        function selectedOutfitIdFromPatch(patch = {}) {
            return textSlot(
                patch.active_outfit_id || patch.outfit_id || patch.selected_outfit || "",
            );
        }

        function exactInventoryItemEntry(item, path = "inventory item") {
            if (typeof item === "string") {
                if (!item.trim()) throw new Error(`${path} must be non-empty text.`);
                return item;
            }
            if (!isPlainObject(item)) throw new Error(`${path} must be text or an object.`);
            const fields = ["item", "clothing_slot", "held_item_slot", "removed_by"];
            const unknown = Object.keys(item).find((field) => !fields.includes(field));
            if (unknown) throw new Error(`${path}.${unknown} is not an approved field.`);
            if (typeof item.item !== "string" || !item.item.trim())
                throw new Error(`${path}.item must be non-empty text.`);
            if (
                Object.hasOwn(item, "clothing_slot") &&
                !validClothingSlots().includes(item.clothing_slot)
            )
                throw new Error(`${path}.clothing_slot must be an exact approved clothing slot.`);
            if (
                Object.hasOwn(item, "held_item_slot") &&
                !["right_hand", "left_hand"].includes(item.held_item_slot)
            )
                throw new Error(`${path}.held_item_slot must be right_hand or left_hand.`);
            if (Object.hasOwn(item, "removed_by") && (typeof item.removed_by !== "string" || !item.removed_by))
                throw new Error(`${path}.removed_by must be non-empty text when present.`);
            return clone(item);
        }

        function exactInventoryList(inventory = [], path = "inventory") {
            if (!Array.isArray(inventory)) throw new Error(`${path} must be an array.`);
            return inventory.map((item, index) =>
                exactInventoryItemEntry(item, `${path}.${index}`),
            );
        }

        function repairAiInventoryList(inventory = []) {
            if (!Array.isArray(inventory)) return [];
            const repaired = [];
            for (const item of inventory) {
                const itemText = clothingItemText(item);
                if (!itemText) continue;
                if (!isPlainObject(item)) {
                    repaired.push(itemText);
                    continue;
                }
                const entry = { item: itemText };
                if (validClothingSlots().includes(item.clothing_slot))
                    entry.clothing_slot = item.clothing_slot;
                if (["right_hand", "left_hand"].includes(item.held_item_slot))
                    entry.held_item_slot = item.held_item_slot;
                if (typeof item.removed_by === "string" && item.removed_by)
                    entry.removed_by = item.removed_by;
                repaired.push(entry);
            }
            return exactInventoryList(repaired, "AI inventory");
        }

        function inventoryItemMatches(entry, item, slot = "") {
            const cleanItem = clothingItemText(item);
            if (!cleanItem || clothingItemText(entry) !== cleanItem) return false;
            if (!slot) return true;
            return (
                !isPlainObject(entry) ||
                entry.clothing_slot === slot ||
                entry.held_item_slot === slot
            );
        }

        function pushInventoryItem(entity, item, metadata = {}) {
            const cleanItem = clothingItemText(item);
            if (!entity || !cleanItem) return false;
            entity.inventory = Array.isArray(entity.inventory)
                ? exactInventoryList(entity.inventory)
                : [];
            const entry =
                metadata && Object.keys(metadata).length
                    ? exactInventoryItemEntry({ ...metadata, item: cleanItem })
                    : cleanItem;
            entity.inventory.push(entry);
            return true;
        }

        function removeOneInventoryItem(entity, item, slot = "") {
            const cleanItem = clothingItemText(item);
            if (!entity || !cleanItem || !Array.isArray(entity.inventory))
                return false;
            const index = entity.inventory.findIndex(
                (entry) => inventoryItemMatches(entry, cleanItem, slot),
            );
            if (index < 0) return false;
            entity.inventory.splice(index, 1);
            return true;
        }





        function entityForClothingName(name, state = app.state) {
            if (isPlayerEntityName(name, state)) return state.player;
            const resolved = resolveEntityName(name, state, name);
            if (state.characters?.[resolved]) return state.characters[resolved];
            return getNpcEntryFromState(state, resolved || name)?.full_character || null;
        }





        function clothingOperationSlots(operation = {}) {
            if (operation.scope) return clothingSlotsForGroup(operation.scope);
            return [
                ...new Set(
                    (Array.isArray(operation.slots) ? operation.slots : [])
                        .map((slot) => String(slot || "").trim())
                        .filter((slot) => validClothingSlots().includes(slot)),
                ),
            ];
        }

        function applyCharacterClothingOperations(
            name,
            operations = [],
            state = app.state,
            options = {},
        ) {
            const entity = entityForClothingName(name, state);
            const result = {
                changed: false,
                changedSlots: [],
                outfitChanged: false,
                rejectedOperations: [],
            };
            if (!entity || !Array.isArray(operations)) return result;
            entity.clothing ||= {};
            for (const operation of operations) {
                if (!isPlainObject(operation)) continue;
                const type = String(operation.operation || "").trim();
                if (type === "change_outfit") {
                    const beforeClothing = clone(entity.clothing || {});
                    const outfitId = textSlot(operation.outfit_id, "");
                    exactEntityOutfits(entity);
                    const outfit = entity.outfits.find(
                        (entry) => entry.id === outfitId,
                    );
                    if (!outfit) {
                        result.rejectedOperations.push({
                            operation: type,
                            outfit_id: outfitId,
                            reason: "outfit not found on targeted character",
                        });
                        continue;
                    }
                    if (!outfitWouldChangeEntity(entity, outfit.id)) continue;
                    for (const slot of validClothingSlots()) {
                        const oldItem = clothingItemText(beforeClothing[slot]);
                        const newItem = clothingItemText(outfit.clothing?.[slot]);
                        if (oldItem && oldItem !== newItem)
                            pushInventoryItem(entity, oldItem, {
                                clothing_slot: slot,
                                removed_by: "outfit_change",
                            });
                    }
                    if (
                        !applyOutfitToEntity(entity, outfit.id, {
                            characterName: name,
                            state,
                        })
                    )
                        continue;
                    result.changed = true;
                    result.outfitChanged = true;
                    continue;
                }
                const slots = clothingOperationSlots(operation);
                if (!slots.length) continue;
                if (type === "wear") {
                    entity.inventory = exactInventoryList(entity.inventory);
                    const outfits = exactEntityOutfits(entity);
                    const activeOutfit = outfits.find(
                        (outfit) => outfit.id === entity.active_outfit_id,
                    );
                    for (const slot of slots) {
                        let index = entity.inventory.findIndex(
                            (entry) =>
                                isPlainObject(entry) &&
                                entry.clothing_slot === slot &&
                                clothingItemText(entry),
                        );
                        if (index < 0) {
                            const savedItem = clothingItemText(
                                activeOutfit?.clothing?.[slot],
                            );
                            if (savedItem)
                                index = entity.inventory.findIndex(
                                    (entry) => clothingItemText(entry) === savedItem,
                                );
                        }
                        if (index < 0) continue;
                        const item = clothingItemText(entity.inventory[index]);
                        const current = clothingItemText(entity.clothing[slot]);
                        if (current === item) continue;
                        if (current && current !== item)
                            pushInventoryItem(entity, current, {
                                clothing_slot: slot,
                                removed_by: "clothing_change",
                            });
                        entity.inventory.splice(index, 1);
                        entity.clothing[slot] = item;
                        result.changed = true;
                        result.changedSlots.push(slot);
                    }
                    continue;
                }
                for (const slot of slots) {
                    const item = clothingItemText(entity.clothing[slot]);
                    if (type === "delete") {
                        if (!item) continue;
                        entity.clothing[slot] = null;
                        exactEntityOutfits(entity);
                        for (const outfit of entity.outfits) {
                            if (outfit?.clothing) delete outfit.clothing[slot];
                        }
                    } else if (!item) {
                        continue;
                    } else if (type === "remove" || type === "remove_without_restore") {
                        moveWornClothingToInventory(
                            entity,
                            name,
                            slot,
                            item,
                            state,
                            "state",
                        );
                        entity.clothing[slot] = null;
                    } else continue;
                    result.changed = true;
                    result.changedSlots.push(slot);
                }
            }
            result.changedSlots = [...new Set(result.changedSlots)];
            if (result.changed && options.recordRecent !== false) {
                state.recent_changes = [
                    `${promptEntityName(name)} clothing changed.`,
                    ...(Array.isArray(state.recent_changes) ? state.recent_changes : []),
                ].slice(0, 8);
            }
            if (result.changed && options.refresh !== false)
                refreshCharacterSurfaces(name, { reason: "character clothing state changed" });
            if (result.changed && options.queueImage !== false)
                queueOneOffCharacterImage(name, `${name} clothing changed`, {
                    kind: "clothing",
                    immediate: true,
                });
            return result;
        }

        function clothingEntityNamesInScene(state = app.state) {
            return [
                "Player",
                ...(state.scene?.party_members_present || []),
                ...(state.scene?.npcs_present || []),
            ].filter((name, index, arr) => name && arr.indexOf(name) === index);
        }

















        function moveWornClothingToInventory(entity, name, slot, item, state = app.state, source = "manual") {
            const cleanItem = clothingItemText(item);
            if (!entity || !slot || !cleanItem) return false;
            return pushInventoryItem(entity, cleanItem, { clothing_slot: slot, removed_by: source });
        }



















        function selectCharacterOutfit(name, outfitId) {
            const entity = entityForClothingName(name, app.state);
            if (!entity || !outfitId) return false;
            if (
                !applyOutfitToEntity(entity, outfitId, {
                    characterName: name,
                    state: app.state,
                })
            ) {
                showNotice(
                    "Outfit Unavailable",
                    `${promptEntityName(name)} does not have that saved outfit.`,
                );
                return false;
            }
            app.state.recent_changes = [
                `${promptEntityName(name)} changed into ${entity.outfits.find((outfit) => outfit.id === entity.active_outfit_id)?.name || "a saved outfit"}.`,
                ...(Array.isArray(app.state.recent_changes) ? app.state.recent_changes : []),
            ].slice(0, 8);
            scheduleActiveGameSave();
            refreshCharacterSurfaces(name, { reason: "outfit selected" });
            queueOneOffCharacterImage(name, `${name} outfit changed`, {
                kind: "clothing",
                immediate: true,
            });
            return true;
        }

        async function saveCharacterCurrentOutfit(name) {
            const entity = entityForClothingName(name, app.state);
            if (!entity) return false;
            const defaultName = `Outfit ${(exactOutfitList(entity.outfits).length || 0) + 1}`;
            const label = String(
                (await showPrompt(
                    "Save Outfit",
                    "Save current clothing as outfit:",
                    defaultName,
                    {
                        rows: 1,
                        submitText: "Save",
                    },
                )) || "",
            ).trim();
            if (!label) return false;

            const outfit = {
                id: outfitIdFromName(label),
                name: label,
                clothing: exactClothingSlots(entity.clothing || {}),
            };
            entity.outfits = exactOutfitList(entity.outfits);
            entity.outfits.push(outfit);
            entity.active_outfit_id = outfit.id;
            app.state.recent_changes = [
                `${promptEntityName(name)} saved ${label} as an outfit.`,
                ...(Array.isArray(app.state.recent_changes) ? app.state.recent_changes : []),
            ].slice(0, 8);
            scheduleActiveGameSave();
            refreshCharacterSurfaces(name, { reason: "outfit saved" });
            return true;
        }



        function moveReplacedClothingToInventory(entity, patch, name, state = app.state) {
            moveReplacedClothingToInventoryFromCurrent(
                entity,
                entity?.clothing || {},
                patch,
                name,
                state,
            );
        }

        function moveReplacedClothingToInventoryFromCurrent(entity, currentClothing, patch, name, state = app.state) {
            if (!entity || !isPlainObject(patch)) return;
            const normalized = exactClothingSlots(patch, Object.keys(patch));
            const current = exactClothingSlots(currentClothing || {});
            for (const slot of Object.keys(patch)) {
                if (!validClothingSlots().includes(slot)) continue;
                if (!(slot in normalized)) continue;
                const oldItem = clothingItemText(current[slot]);
                const newItem = clothingItemText(normalized[slot]);
                if (oldItem && oldItem !== newItem) {
                    moveWornClothingToInventory(
                        entity,
                        name,
                        slot,
                        oldItem,
                        state,
                        "state",
                    );
                }
            }
        }




        async function repairSingleValueCommaSlots(state, source, message) {
            let draft = state;

            for (let attempt = 1; attempt <= 2; attempt++) {
                const violations = findSingleValueCommaViolations(draft);
                if (!violations.length) return draft;
                if (/world generation/i.test(source)) {
                    updateWorldGenerationStatus(
                        "Repairing state slots",
                        8,
                        10,
                        `Repair attempt ${attempt}/2. Repairs needed: ${violations.length}. Invalid fields: ${violations
                            .slice(0, 5)
                            .map((v) => v.path)
                            .join(", ")}${violations.length > 5 ? "..." : ""}`,
                        {
                            status: "repair",
                            stepProgress: 0.35 + attempt * 0.15,
                            repairAttempt: attempt,
                            repairTotal: 2,
                            repairsRemaining: violations.length,
                        },
                    );
                }

                stateTrace("single slot commas rejected", {
                    label: source,
                    attempt,
                    violations,
                    summary: violations
                        .map((v) => `${v.path}: "${v.value}"`)
                        .join("\n"),
                });

                const repairPrompt = `The state JSON you returned contains comma-separated values in slots that must hold exactly ONE value.

Reject these invalid fields and provide replacement values for the SAME paths.

Rules:
- Output ONLY valid JSON.
- Use exactly this shape:
{
  "repairs": [
    {
      "path": "location.world",
      "value": "single value"
    }
  ]
}
- Every replacement value must be one clear single value.
- Do not use commas in replacement values.
- Do not return lists.
- Do not change fields that are not listed.

Invalid fields:
${violations
    .map((v) => `- ${v.path}:\n${prettyJson(v.value)}`)
    .join("\n")}

Original ${source.toUpperCase()} message:
${message}

Return the corrected values now.`;

                stateTrace("single slot repair request", {
                    label: source,
                    attempt,
                    prompt: repairPrompt,
                    summary: `Asking AI to repair ${violations.length} comma-filled single-value slot(s).`,
                });

                const raw = await aiText(repairPrompt, {
                    startWith: "{",
                    hideStartWith: false,
                    label: `${source} single-slot repair`,
                    allowDuringStateSync: app.stateSync?.running === true,
                });
                const parsed = parseJsonObject(raw);
                const repairs = Array.isArray(parsed?.repairs)
                    ? parsed.repairs
                    : [];
                if (/world generation/i.test(source)) {
                    updateWorldGenerationStatus(
                        "Repairing state slots",
                        8,
                        10,
                        `Repair attempt ${attempt}/2 response received. Repairs returned: ${repairs.length}. Repairs needed before applying: ${violations.length}.`,
                        {
                            status: "repair",
                            stepProgress: 0.52 + attempt * 0.12,
                            repairAttempt: attempt,
                            repairTotal: 2,
                            repairsRemaining: Math.max(0, violations.length - repairs.length),
                            outputChars: String(raw || "").length,
                            filledValues: repairs.length,
                        },
                    );
                }

                stateTrace("single slot repair response", {
                    label: source,
                    attempt,
                    response: raw,
                    repairs,
                    summary: `AI returned ${repairs.length} single-slot repair(s).`,
                });

                let applied = 0;
                for (const repair of repairs) {
                    const path = String(repair?.path || "").trim();
                    const value = textSlot(repair?.value);
                    const violation = violations.find((v) => v.path === path);

                    if (!violation || !value || value.includes(",")) {
                        stateTrace("single slot repair rejected", {
                            label: source,
                            path,
                            value,
                            summary: `Repair for ${path || "unknown path"} was rejected because it was missing, unknown, empty, or still contained a comma.`,
                        });
                        continue;
                    }

                    setPathValue(draft, path.split("."), value);
                    applied++;
                }

                stateTrace("single slot repair applied", {
                    label: source,
                    attempt,
                    applied,
                    remaining: findSingleValueCommaViolations(draft),
                    summary: `Applied ${applied} repair(s) on attempt ${attempt}.`,
                });
                if (/world generation/i.test(source)) {
                    const remainingAfterAttempt = findSingleValueCommaViolations(draft);
                    updateWorldGenerationStatus(
                        "Repairing state slots",
                        8,
                        10,
                        `Repair attempt ${attempt}/2 applied ${applied}. Repairs remaining: ${remainingAfterAttempt.length}.`,
                        {
                            status: "repair",
                            stepProgress: 0.65 + attempt * 0.12,
                            repairAttempt: attempt,
                            repairTotal: 2,
                            repairsRemaining: remainingAfterAttempt.length,
                            filledValues: applied,
                        },
                    );
                }
            }

            const remaining = findSingleValueCommaViolations(draft);
            if (remaining.length) {
                for (const item of remaining) {
                    setPathValue(
                        draft,
                        item.path.split("."),
                        firstCommaValue(item.value),
                    );
                }
                stateTrace("single slot fallback applied", {
                    label: source,
                    remaining,
                    summary:
                        "AI did not fully repair all comma-filled single slots; kept only the first value so invalid commas cannot enter state.",
                });
                if (/world generation/i.test(source)) {
                    updateWorldGenerationStatus(
                        "Repairing state slots",
                        8,
                        10,
                        `AI repair could not finish. Applied local fallback to ${remaining.length} remaining field(s).`,
                    );
                }
            }

            return draft;
        }

        function findSingleValueCommaViolations(value, path = []) {
            const out = [];

            if (Array.isArray(value)) return out;
            if (isPlainObject(value)) {
                for (const [key, child] of Object.entries(value)) {
                    out.push(
                        ...findSingleValueCommaViolations(child, [
                            ...path,
                            key,
                        ]),
                    );
                }
                return out;
            }

            if (
                typeof value === "string" &&
                value.includes(",") &&
                isSingleValuePath(path)
            ) {
                out.push({
                    path: path.join("."),
                    value,
                });
            }

            return out;
        }

        function isSingleValuePath(path) {
            const joined = path.join(".");
            const last = path[path.length - 1] || "";

            if (!joined) return false;
            if (
                [
                    "summary",
                    "description",
                    "extra_description",
                    "premise",
                    "style",
                    "negative",
                    "known_facts",
                    "inventory",
                    "recent_changes",
                    "limitations",
                ].includes(last)
            )
                return false;

            if (path[0] === "location") return true;
            if (path[0] === "time") return true;
            if (path[0] === "scene")
                return [
                    "image_action",
                ].includes(last);
            if (path[0] === "world_flags")
                return ["magic_level", "tone"].includes(last);
            if (path[0] === "player")
                return [
                    "name",
                    "gender",
                    "role",
                    "voice",
                ].includes(last);
            if (path[0] === "characters")
                return [
                    "gender",
                    "role",
                    "voice",
                    "relationship_to_player",
                    "boldness",
                    "state_of_mind",
                    "physical_state",
                    "pose",
                    "shirt",
                    "pants",
                    "underwear",
                    "bra",
                    "shoes",
                    "feet",
                    "accessory",
                    "right_hand",
                    "left_hand",
                    "hair",
                    "eyes",
                    "skin",
                    "body_type",
                    "age_appearance",
                ].includes(last);

            return false;
        }

        function firstCommaValue(value) {
            return String(value || "")
                .split(",")
                .map((part) => part.trim())
                .find(Boolean) || "";
        }

        function compactAvailableCharactersForPrompt(state = app.state) {
            const present = new Set(state.scene?.party_members_present || []);
            const out = {};
            for (const [name, c] of Object.entries(state.characters || {})) {
                if (!name || isPlayerEntityName(name, state) || !c) continue;
                const promptName = promptEntityName(name, state);
                const character = runtimePromptEntityProjection(c, name, state);
                out[promptName] = {
                    present: present.has(name),
                    age: character.age,
                    gender: character.gender,
                    role: character.role,
                    relationship_to_player: character.relationship_to_player,
                    speech_style: character.speech_style,
                    trust: character.trust,
                    attraction: character.attraction,
                    affection: character.affection,
                    state_of_mind: character.state_of_mind,
                    physical_state: character.physical_state,
                    pose: character.pose,
                    ...promptKnownFactFields(character, 2),
                    ...(present.has(name) && isPlainObject(character.stats)
                        ? { stats: clone(character.stats) }
                        : {}),
                };
            }
            return out;
        }

        function compactAvailableNpcsForPrompt(state = app.state) {
            const present = new Set(state.scene?.npcs_present || []);
            const out = {};
            for (const location of Object.values(
                state.npc_directory?.locations || {},
            )) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const name = npc?.name || key;
                    if (!name || isPlayerEntityName(name, state)) continue;
                    const full = npc.full_character || {};
                    const promptName = promptEntityName(name, state);
                    const character = runtimePromptEntityProjection(full || npc, key, state);
                    const isPresent = present.has(name) || present.has(key) || present.has(promptName);
                    out[promptName] = {
                        present: isPresent,
                        location: location?.label || "",
                        status: npc.status || "alive",
                        age: character.age || npc.age,
                        gender: character.gender || npc.gender,
                        role: character.role || npc.role,
                        relationship:
                            character.relationship_to_player || npc.relationship,
                        note: npc.note,
                        personality_description: character.personality_description,
                        speech_style: character.speech_style,
                        state_of_mind: character.state_of_mind,
                        physical_state: character.physical_state,
                        pose: character.pose,
                        ...promptKnownFactFields(character, 2),
                        inspected: !!npc.inspected,
                        ...(isPresent && isPlainObject(character.stats)
                            ? { stats: clone(character.stats) }
                            : {}),
                    };
                }
            }
            return out;
        }

        function buildReplyStateContext() {
            const partyMemberNames = app.state.scene?.party_members_present || [];
            const npcNames = app.state.scene?.npcs_present || [];
            const writablePartyMemberNames = partyMemberNames.filter(
                (name) => !isPlayerEntityName(name),
            );
            const writableNpcNames = npcNames.filter(
                (name) => !isPlayerEntityName(name),
            );
            const presentPartyMembers = new Set(writablePartyMemberNames);
            const presentNpcs = new Set(writableNpcNames);
            const partyMembers = {};
            const partyMembersNotPresent = {};
            const npcs = {};
            const npcsNotPresent = {};

            for (const [name, c] of Object.entries(app.state.characters || {})) {
                if (!name || isPlayerEntityName(name) || !c) continue;
                const promptName = promptEntityName(name, app.state);
                const character = runtimePromptEntityProjection(c, name, app.state);
                if (presentPartyMembers.has(name)) {
                    partyMembers[promptName] = promptSanitizedEntitySnippet({
                        age: character.age,
                        gender: character.gender,
                        role: character.role,
                        personality_description: character.personality_description,
                        speech_style: character.speech_style,
                        relationship_to_player: character.relationship_to_player,
                        trust: character.trust,
                        attraction: character.attraction,
                        affection: character.affection,
                        boldness: characterBoldnessGuidanceText(c),
                        state_of_mind: character.state_of_mind,
                        physical_state: character.physical_state,
                        pose: character.pose,
                        appearance: character.appearance,
                        clothing: character.clothing,
                        held_items: character.held_items,
                        inventory: character.inventory,
                        ...promptKnownFactFields(character, 4),
                        ...(isPlainObject(character.stats) ? { stats: clone(character.stats) } : {}),
                    });
                } else {
                    partyMembersNotPresent[promptName] = {
                        age: character.age,
                        gender: character.gender,
                        role: character.role,
                        relationship_to_player: character.relationship_to_player,
                        trust: character.trust,
                        attraction: character.attraction,
                        affection: character.affection,
                        summary:
                            character.summary ||
                            character.personality_description ||
                            character.role ||
                            "",
                        ...promptKnownFactFields(character, 2),
                    };
                }
            }

            for (const location of Object.values(app.state.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    if (!npc) continue;
                    const name = npc?.name || key;
                    if (!name || isPlayerEntityName(name)) continue;
                    const full = npc.full_character || {};
                    const promptName = promptEntityName(name, app.state);
                    const character = runtimePromptEntityProjection(full || npc, key, app.state);
                    const isPresentNpc =
                        presentNpcs.has(name) ||
                        presentNpcs.has(key) ||
                        presentNpcs.has(promptName);
                    if (isPresentNpc) {
                        npcs[promptName] = promptSanitizedEntitySnippet({
                            location: location?.label || "",
                            status: npc.status || "alive",
                            name: promptName,
                            age: character.age || npc.age,
                            gender: character.gender || npc.gender,
                            role: character.role || npc.role,
                            personality_description: character.personality_description,
                            speech_style: character.speech_style,
                            relationship:
                                character.relationship_to_player || npc.relationship,
                            note: npc.note,
                            state_of_mind: character.state_of_mind,
                            physical_state: character.physical_state,
                            pose: character.pose,
                            appearance: character.appearance,
                            clothing: character.clothing,
                            held_items: character.held_items,
                            ...promptKnownFactFields(character, 4),
                            inspected: !!npc.inspected,
                            ...(isPlainObject(character.stats)
                                ? { stats: clone(character.stats) }
                                : {}),
                        });
                    } else {
                        npcsNotPresent[promptName] = {
                            location: location?.label || "",
                            status: npc.status || "alive",
                            name: promptName,
                            age: character.age || npc.age,
                            gender: character.gender || npc.gender,
                            role: character.role || npc.role,
                            relationship:
                                character.relationship_to_player || npc.relationship,
                            summary:
                                npc.note ||
                                character.personality_description ||
                                character.role ||
                                npc.role ||
                                "",
                            ...promptKnownFactFields(character, 2),
                            inspected: !!npc.inspected,
                        };
                    }
                }
            }

            const scene = sceneForAiPrompt(app.state.scene || {});
            scene.party_members_present = promptEntityList(writablePartyMemberNames);
            scene.npcs_present = promptEntityList(writableNpcNames);

            return {
                location: promptLocationProjection(app.state.location),
                world_map: compactWorldMapForPrompt(app.state.world_map, 12, app.state),
                time: promptTimeProjection(app.state.time),
                scene,
                player: promptSanitizedEntitySnippet({
                    name: app.state.player?.name,
                    age: app.state.player?.age,
                    gender: app.state.player?.gender,
                    role: app.state.player?.role,
                    personality_description:
                        app.state.player?.personality_description,
                    inventory: app.state.player?.inventory,
                    ...promptKnownFactFields(app.state.player, 5),
                    ...(isPlainObject(app.state.player?.stats)
                        ? { stats: clone(app.state.player.stats) }
                        : {}),
                }),
                world_flags: runtimeWorldFlagsForPrompt(app.state.world_flags),
                ...(runtimeStoryRulesForPrompt(app.state.story_rules).length
                    ? { story_rules: runtimeStoryRulesForPrompt(app.state.story_rules) }
                    : {}),
                story_memory: runtimeStoryMemoryForPrompt(
                    app.state.story_memory,
                    app.state,
                ),
                party_members: partyMembers,
                party_members_not_present: partyMembersNotPresent,
                npcs: npcs,
                npcs_not_present: npcsNotPresent,
                recent_changes: runtimeRecentChangesForPrompt(
                    app.state.recent_changes || [],
                    app.state,
                ),
            };
        }

        function playerNameForPrompt(state = app.state) {
            return String(state?.player?.name || "").trim() || "the player";
        }

        function playerEntityDisplayName(state = app.state) {
            return String(state?.player?.name || "").trim() || "Player";
        }

        function currentPresentationName(value = "", state = app.state) {
            const name = String(value || "").trim();
            if (!name) return "";
            if (isPlayerEntityName(name, state)) return playerEntityDisplayName(state);
            const key = resolveExactCharacterDefinitionName(name, state, "");
            if (!key) {
                const futureEntry = state?.future_cast?.items?.[name];
                if (futureEntry) {
                    const character = futureEntry.full_character || futureEntry.character || futureEntry;
                    return String(character?.name || futureEntry?.name || name).trim() || name;
                }
                return name;
            }
            const partyCharacter = state?.characters?.[key];
            if (partyCharacter) return String(partyCharacter.name || key).trim() || key;
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                const npc = location?.characters?.[key];
                if (!npc) continue;
                const character = npc.full_character || npc;
                return String(character?.name || npc?.name || key).trim() || key;
            }
            const futureEntry = state?.future_cast?.items?.[key];
            if (futureEntry) {
                const character = futureEntry.full_character || futureEntry.character || futureEntry;
                return String(character?.name || futureEntry?.name || key).trim() || key;
            }
            return name;
        }

        function resolvedEntityDisplayName(value = "", state = app.state, fallback = "") {
            const resolved = resolveEntityName(value, state, fallback);
            return isPlayerEntityName(resolved, state)
                ? playerEntityDisplayName(state)
                : resolved;
        }

        function promptEntityName(name = "", state = app.state) {
            return isPlayerEntityName(name, state)
                ? playerNameForPrompt(state)
                : currentPresentationName(name, state);
        }

        function promptEntityList(list = [], state = app.state) {
            return [
                ...new Set(
                    (Array.isArray(list) ? list : [])
                        .map((name) => promptEntityName(name, state))
                        .filter(Boolean),
                ),
            ];
        }

        function npcNameKnownToPlayer(npc = {}) {
            if (!isPlainObject(npc)) return true;
            if (npc.player_known_name === false) return false;
            if (npc.name_known_to_player === false) return false;
            return true;
        }

        function npcPlayerFacingLabel(npc = {}, fallback = "unknown person") {
            return textSlot(
                npc.player_facing_label ||
                    npc.visible_label ||
                    npc.public_label ||
                    npc.role ||
                    fallback,
                fallback,
            );
        }

        function autoPlayerEntityPromptName(name = "", state = app.state) {
            const clean = String(name || "").trim();
            if (!clean) return "";
            if (isPlayerEntityName(clean, state)) return playerNameForPrompt(state);
            const found = findNpcEntryInState(state, clean);
            if (found?.npc && !npcNameKnownToPlayer(found.npc))
                return npcPlayerFacingLabel(found.npc, "unknown person");
            return promptEntityName(clean, state);
        }

        function autoPlayerEntityPromptList(list = [], state = app.state) {
            return [
                ...new Set(
                    (Array.isArray(list) ? list : [])
                        .map((name) => autoPlayerEntityPromptName(name, state))
                        .filter(Boolean),
                ),
            ];
        }

        function autoPlayerUnknownNpcNameMap(state = app.state) {
            const map = {};
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const name = String(npc?.name || key || "").trim();
                    if (!name || npcNameKnownToPlayer(npc)) continue;
                    map[name] = npcPlayerFacingLabel(npc, "unknown person");
                }
            }
            return map;
        }

        function replaceAutoPlayerUnknownNames(value, nameMap = {}) {
            const entries = Object.entries(nameMap).filter(([from, to]) => from && to);
            if (!entries.length) return value;
            if (typeof value === "string") {
                let out = value;
                for (const [from, to] of entries) {
                    out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, "g"), to);
                }
                return out;
            }
            if (Array.isArray(value))
                return value.map((item) => replaceAutoPlayerUnknownNames(item, nameMap));
            if (isPlainObject(value)) {
                const out = {};
                for (const [key, child] of Object.entries(value)) {
                    const mappedKey = entries.find(([from]) => key === from)?.[1] || key;
                    out[mappedKey] = replaceAutoPlayerUnknownNames(child, nameMap);
                }
                return out;
            }
            return value;
        }

        function autoPlayerObjectiveForPrompt(state = app.state) {
            const objective = selectedObjectiveForPrompt(state);
            if (!objective) return null;
            return replaceAutoPlayerUnknownNames({
                title: objective.title,
                description: objective.description,
                completion_condition: objective.completion_condition,
            }, autoPlayerUnknownNpcNameMap(state));
        }

        function aiMessageLengthSetting() {
            const value = String(app.settings?.aiMessageLength || "short");
            return ["normal", "short", "very_short"].includes(value) ? value : "short";
        }

        function aiMessageLengthGuidance(kind = "narrator") {
            const value = aiMessageLengthSetting();
            if (value === "normal") {
                return kind === "auto-player"
                    ? ""
                    : "";
            }
            if (kind === "auto-player") {
                return value === "very_short"
                    ? "Write exactly 1 short sentence as the player, under 18 words. Use plain player intent only. No sensory detail, atmosphere, mood, reflection, recap, inner monologue, body-detail staging, threshold/lighting description, or narrator prose."
                    : "Write exactly 1 short player message, 1 sentence when possible and never more than 2 sentences or 28 words total. Use plain player intent only. No sensory detail, atmosphere, mood, reflection, recap, inner monologue, body-detail staging, threshold/lighting description, or narrator prose.";
            }
            return value === "very_short"
                ? "Keep messages very short."
                : "Keep messages short.";
        }

        function buildAutoPlayerTurnInstruction() {
            const playerName = playerNameForPrompt();
            const stateContext = compactJson(buildAutoPlayerTurnStateContext());
            const syncedChatContext =
                promptStateSyncRangeText(syncedConversationContextForPrompt(6), app.state) || "#";
            const unsyncedChatContext =
                promptStateSyncRangeText(pendingStateSyncMessages(), app.state) || "#";
            const target = replaceAutoPlayerUnknownNames(
                autoPlayerObjectiveForPrompt(app.state),
                autoPlayerUnknownNpcNameMap(app.state),
            );
            const currentJobText = currentJobPromptContext(app.state);
            const targetText = target
                ? `${target.title || target.id || "Untitled objective"}: ${target.objective || target.summary || ""}`
                : "No selected objective.";
            const promptTargetText = targetText;

            return `You are playing EmberAdventures for the player in automatic mode.
Your job is to write the next message as ${playerName}.

Write only ${playerName}'s next player message. Do not write narrator prose, assistant narration, or out-of-story notes.
This message is shown as the player's chat input, not as narration. It should read like a player typed it.
Every quoted line you write must be spoken by ${playerName}. Do not write dialogue, thoughts, actions, plans, or tactical choices for party members, NPCs, enemies, or the narrator.

Play like a real player:
- Use ${playerName}'s saved personality, known facts, relationships, current state, and user guidance.
- Only use what ${playerName} could reasonably know from visible chat, current senses, established facts, and the player-accessible state below. Do not use hidden names, private story structure, objective rewards, or diagnostic details just because they appear in state.
- If an NPC is shown with a descriptive label instead of a proper name, ${playerName} does not know that NPC's real name yet. Refer to them by visible description, pronouns, or role until the story clearly reveals their name in visible dialogue or narration.
- In danger, surprise, confusion, or first-contact scenes, favor cautious, fearful, probing, or protective player actions over instantly solving the scene with perfect technical knowledge.
- You may take actions, but choose plausible player input over optimal plot advancement. Make the story entertaining by reacting believably, not by speedrunning objectives.
- Do not force major irreversible choices, killing, selling, betrayal, rescue, romance, or branch-ending decisions unless the user guidance, current objective, or visible scene clearly points there.
- If the situation is unclear, let ${playerName} ask, hesitate, observe, negotiate, improvise, or take a small reversible action instead of solving the whole problem at once.
- ${aiMessageLengthGuidance("auto-player")}
- Keep the turn as plain player intent, not narrator-style sensory prose.
- Do not reference future story spoilers or hidden template data.
- You do not have to follow the selected objective. Focus on things you find interesting to explore, whether that is the selected objective or something else.

Selected objective:
${promptTargetText}

${currentJobText ? `${currentJobText}\n\n` : ""}
STATE ACCESSIBLE TO THE PLAYER:
${stateContext}

CHAT ALREADY INCLUDED IN STATE, PROVIDED ONLY FOR CONVERSATION CONTEXT:
${syncedChatContext}

CHAT SINCE STATE WAS LAST UPDATED:
${unsyncedChatContext}`;
        }

        function buildAutoPlayerTurnPrompt() {
            return withUniversalAiPromptContext(buildAutoPlayerTurnInstruction(), {
                includeStoryRules: false,
            });
        }

        function buildAutoPlayerTurnStateContext(state = app.state) {
            const unknownNpcNameMap = autoPlayerUnknownNpcNameMap(state);
            const scene = sceneForAiPrompt(state.scene || {});
            scene.party_members_present = autoPlayerEntityPromptList(
                nonPlayerSceneEntityNames(scene.party_members_present, state),
                state,
            );
            scene.npcs_present = autoPlayerEntityPromptList(
                nonPlayerSceneEntityNames(scene.npcs_present, state),
                state,
            );

            const context = {
                meta: {
                    story_source: runtimePlayerStorySourceForPrompt(
                        state.meta?.story_source,
                    ),
                },
                location: promptLocationProjection(state.location),
                world_map: knownWorldMapForPrompt(state.world_map, state),
                time: promptTimeProjection(state.time),
                scene,
                player: playerAccessibleEntityForPrompt(state.player, {
                    key: "Player",
                    state,
                }),
                party_members: accessibleCharactersForPrompt(state.characters, state),
                npc_directory: knownNpcDirectoryForPrompt(state.npc_directory, {
                    playerKnowledgeOnly: true,
                    state,
                }),
                world_flags: runtimeWorldFlagsForPrompt(state.world_flags),
                // Auto-player prompts follow the same selected-objective-only rule as
                // narrator prompts so hidden future objectives cannot guide player turns.
                objectives: {
                    current_target: autoPlayerObjectiveForPrompt(state),
                },
                story_memory: runtimeStoryMemoryForPrompt(state.story_memory, state),
                recent_changes: runtimeRecentChangesForPrompt(state.recent_changes || [], state),
            };
            return replaceAutoPlayerUnknownNames(context, unknownNpcNameMap);
        }

        function runtimePlayerStorySourceForPrompt(source = {}) {
            const clean = runtimeStorySourceForPrompt(source);
            if (!isPlainObject(clean)) return clean;
            const mode = textSlot(clean.mode, "");
            return mode ? { mode } : undefined;
        }

        function knownWorldMapForPrompt(map = app.state.world_map, state = app.state) {
            const clean = extractWorldMap(map || {}, state);
            const locations = {};
            for (const [id, node] of Object.entries(clean.locations || {})) {
                // Prompt boundary rule: locked future locations are story-template
                // data. Runtime AI calls may see current/focus locations and known
                // places, but not hidden future shops/NPC homes that could leak
                // future character concepts.
                if (
                    id !== clean.current_location_id &&
                    id !== clean.focus_location_id &&
                    node.discovered === false &&
                    node.travel_enabled === false
                )
                    continue;
                locations[id] = {
                    id: node.id || id,
                    name: node.name,
                    type: node.type,
                    scale: node.scale,
                    parent_id: node.parent_id,
                    discovered: node.discovered !== false,
                    travel_enabled: node.travel_enabled !== false,
                    summary: node.summary,
                    detail: node.detail,
                    connections: node.connections || [],
                };
            }
            return {
                current_location_id: clean.current_location_id,
                current_location: clean.locations?.[clean.current_location_id]?.name || "",
                focus_location_id: clean.focus_location_id,
                locations,
                travel_history: clean.travel_history || [],
            };
        }

        function accessibleCharactersForPrompt(characters = {}, state = app.state) {
            const out = {};
            for (const [name, character] of Object.entries(characters || {})) {
                out[promptEntityName(name, state)] = playerAccessibleEntityForPrompt(
                    character,
                    { key: name, state },
                );
            }
            return out;
        }

        function knownNpcDirectoryForPrompt(
            directory = app.state.npc_directory,
            options = {},
        ) {
            const state = options.state || app.state;
            const includeCurrentAppearance =
                options.includeCurrentAppearance === true;
            const playerKnowledgeOnly = options.playerKnowledgeOnly === true;
            const out = { locations: {} };
            for (const [label, location] of Object.entries(directory?.locations || {})) {
                const npcs = {};
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    if (!npc?.name && !key) continue;
                    const name = npc.name || key;
                    const nameKnown = !playerKnowledgeOnly || npcNameKnownToPlayer(npc);
                    const promptName = nameKnown
                        ? promptEntityName(name, state)
                        : npcPlayerFacingLabel(npc, "unknown person");
                    const shell = runtimePromptEntityProjection(npc, key, state);
                    if (!nameKnown) {
                        npcs[promptName] = {
                            name: promptName,
                            real_name_known: false,
                            gender: shell.gender,
                            role: promptName,
                            relationship: npc.relationship || "unknown",
                            note:
                                npc.current_appearance ||
                                `Visible as ${promptName}.`,
                            status: npc.status,
                            inspected: false,
                        };
                        continue;
                    }
                    const fullCharacter = nameKnown && npc.inspected
                        ? playerAccessibleEntityForPrompt(npc.full_character || {}, {
                              key,
                              state,
                          })
                        : undefined;
                    npcs[promptName] = {
                        name: promptName,
                        gender: shell.gender,
                        age: shell.age,
                        role: shell.role,
                        relationship: npc.relationship,
                        note: npc.note,
                        ...(includeCurrentAppearance && npc.current_appearance
                            ? { current_appearance: npc.current_appearance }
                            : {}),
                        inspected: !!npc.inspected,
                        status: npc.status,
                        death_note: npc.death_note,
                        killed_by: npc.killed_by,
                        full_character: fullCharacter,
                    };
                }
                out.locations[label] = {
                    label: location.label || label,
                    npcs,
                };
            }
            return out;
        }

        function playerAccessibleEntityForPrompt(entity = {}, options = {}) {
            if (!isPlainObject(entity)) return entity;
            return runtimePromptEntityProjection(
                entity,
                options.key || entity?.name || "",
                options.state || app.state,
            );
        }

        function runtimePromptEntityProjection(entity = {}, key = "", state = app.state) {
            if (!isPlainObject(entity)) return entity;
            const copy = promptSafeEntityProjection(entity);
            const promptName = key
                ? currentPresentationName(key, state)
                : currentPresentationName(copy.name, state);
            if (promptName) copy.name = promptName;
            return copy;
        }

        function promptStateSyncRangeText(messages = [], state = app.state) {
            return stateSyncRangeText(messages);
        }

        function characterTemplateForAiPrompt(name = "") {
            return playerAccessibleEntityForPrompt(blankCharacterTemplate(name));
        }

        function characterDefinitionTemplateForAiPrompt(name = "Generated Character") {
            const runtime = addImmutableDefinitionFields(
                blankCharacterTemplate(name),
                name,
            );
            runtime.lite = true;
            runtime.default_seed = 0;
            runtime.image_prompt_config = {
                seed_enabled: true,
                seed: 0,
                style: "",
                profile_style: "",
                negative: "",
                negative_prompt: "",
            };
            runtime.default_profile_image = emptyProfileImageSlot(false);
            runtime.voice = {
                gender_bucket: "non_male",
                preferred_voice_name: "",
            };
            return runtime;
        }

        function compactGeneratedCharacterAiTemplate() {
            return {
                romanceable: true,
                fallback_name: "",
                fallback_outfits: [],
                fallback_starting_outfit_id: "",
                fallback_gender: "",
                gender: "unspecified",
                age: 25,
                role: "adult character",
                personality_description:
                    "A distinct adult character whose deeper personality should remain consistent across scenes.",
                speech_style:
                    "Concise dialogue style for how this character usually talks.",
                relationship_to_player: "unknown",
                trust: 0,
                attraction: 0,
                affection: 0,
                boldness: 5,
                state_of_mind: "neutral",
                physical_state: "normal",
                pose: "standing",
                appearance: blankAppearanceTemplate(),
                clothing: blankClothingTemplate(),
                held_items: {
                    right_hand: null,
                    left_hand: null,
                },
                inventory: [],
                known_facts: ["Generated character is an adult character."],
            };
        }

        function generatedCharacterAiRulesText() {
            return [
                "Rules:",
                "- Output ONLY valid JSON in the exact requested shape.",
                "- Use a specific numeric age of 18 or older. Do not write \"18+\" as an age.",
                "- The character must physically appear adult. Never create underage-looking, childlike, minor, or ambiguous-age characters.",
                "- Use exactly a first and last name: two words, no titles, no role labels, no descriptors, no placeholders.",
                "- The name must be distinct from existing characters. Do not create a shorter or longer version of an existing character name.",
                "- Fill clear single-value slots. Do not add any fields outside the exact JSON shape shown above.",
                "- Set romanceable true for most recurring characters. Set it false intentionally for plot-only officials, incidental contacts, or antagonists who should not adapt to the player's romantic gender preferences.",
                "- When romanceable is true, choose a gender from the player's preferred partner genders in the supplied context. When the game-wide swap-all-genders setting is active, follow those preferences even when romanceable is false.",
                "- fallback_name is the same character's opposite male/non-male presentation name. Use exactly one fallback name, never an aliases list. Prefer retaining the first one or two letters of the canonical name when that still produces a natural, setting-appropriate name; never force a strained copy.",
                "- fallback_outfits and fallback_starting_outfit_id describe the opposite male/non-male presentation. Preserve each canonical outfit's purpose, colors, equipment, status, and general visual identity while changing only gendered construction, underwear, fit, and similar presentation details unless a larger change is specifically justified. Appearance and personality do not change.",
                `- Each fallback_outfits entry must be an outfit OBJECT, never a string or outfit summary. Exact shape: ${JSON.stringify({ id: "alternate", name: "Alternate Outfit", clothing: blankClothingTemplate() })}. Fill the clothing slots with the actual alternate garments. Use unique outfit ids and set fallback_starting_outfit_id to one of those ids. If no alternate outfit is supplied, use fallback_outfits: [] and fallback_starting_outfit_id: "".`,
                "- personality_description is durable identity and behavior style, not current mood. Write 1 to 3 concise sentences.",
                "- speech_style is durable dialogue guidance. Write 1 concise sentence about how the character usually speaks: terse, warm, formal, guarded, profane, poetic, blunt, flirty, etc. Do not put current emotions or voice/TTS metadata here.",
                "- relationship_to_player, trust, attraction, affection, state_of_mind, physical_state, pose, inventory, and known_facts are current in-game values. Only fill them if they are directly useful for the new character's current introduction.",
                "- For appearance species, skin_color, eye_color, hair_color, hair_length, hair_type, and extra_description, keep each fact in its proper field.",
                "- extra_description is only for durable visual traits not already represented by body stat slots, colors, or hair fields.",
                "- appearance.male_only_extra_description and appearance.non_male_only_extra_description are optional, narrow appearance-only fields for important visual traits that must differ between presentations and cannot be expressed elsewhere, primarily optional facial hair for male presentation. Missing or null means no extra text. Do not use them for general character descriptions, chest or other anatomy already owned by structured fields. Use a non-blank value only when it applies to that presentation. Do not put clothing, pose, scene, personality, or instructions in these fields.",
                "- appearance.extra_description_lower_body is only for concrete durable details below the humanoid waist. Set appearance.nonhuman_lower_body to true only when normal humanoid hips and legs are replaced by a distinct nonhuman lower body. When true, describe that body concretely in the lower-body field and do not repeat numeric hips or legs there.",
                "- Do not duplicate breast size, shoulder span, hip span, butt volume, abs/midsection, arms, legs, hair, eyes, or skin facts inside extra_description when those are already in another field.",
                "- For appearance body stat slots height, shoulder_width, chest, upper_body_build, midsection_build, hip_width, butt_build, lower_body_build, arm_length, and leg_length, use whole numbers from 0 to 20. Use a descriptor string only for exceptional anatomy where the schema permits it. The V-shaped build scales are not neutral at 10: 0 and 20 are opposite extreme ends, with 10 as the emaciated/flat minimum point.",
                `- ${generatedChestRuleText("character.appearance.chest")}`,
                "- Clothing must list every actual worn layer in the correct clothing slot keys, including inner layers when worn. Outer clothing must fully cover the torso and lower body. Do not write a vague outfit summary or only the outermost garment.",
                "- held_items only contains right_hand and left_hand carried objects.",
            ].join("\n");
        }

        function outfitPromptSummaryList(outfits = [], character = null) {
            if (!Array.isArray(outfits))
                throw new Error("Runtime character outfits must be an array.");
            return outfits
                .filter((outfit) => true)
                .map((outfit, index) => {
                    if (!isPlainObject(outfit))
                        throw new Error(`Runtime character outfits.${index} must be an object.`);
                    return textSlot(outfit.name || outfit.id, "Outfit");
                })
                .filter(Boolean);
        }

        function promptAppearanceStatPhrase(slot, value, entity = {}) {
            if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value.trim()))
                return value.trim();
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return value;
            return bodyStatPhrase(slot, numeric, {
                useDefault: Object.hasOwn(bodyStatPhrases, slot),
                entity,
            }) || value;
        }

        function promptSafeAppearance(appearance = {}, entity = {}) {
            if (!isPlainObject(appearance)) return appearance;
            const out = { ...appearance };
            for (const slot of bodyStatKeys()) {
                if (out[slot] == null || out[slot] === "") continue;
                out[slot] = promptAppearanceStatPhrase(slot, out[slot], entity);
            }
            return out;
        }

        function promptSafeInventory(inventory = []) {
            return exactInventoryList(inventory).filter((item) => {
                if (!isPlainObject(item)) return true;
                return !(item.clothing_slot && item.removed_by);
            });
        }

        function promptSanitizedEntitySnippet(value = {}) {
            return promptSafeEntityProjection(value);
        }

        const promptOmittedEntityFields = new Set([
            "active_outfit_id",
            "romanceable",
            "fallback_name",
            "fallback_outfits",
            "fallback_starting_outfit_id",
            "profile_image_presentations",
            "creator",
            "creation_tool",
            "source",
            "can_die",
            "default_seed",
            "image_prompt_config",
            "default_profile_image",
            "starting_relationship_to_player",
            "starting_trust",
            "starting_attraction",
            "starting_affection",
            "starting_state_of_mind",
            "starting_physical_state",
            "starting_pose",
            "starting_inventory",
            "starting_held_items",
            "starting_known_facts",
            "catalog_hook",
            "chat_story",
            "chat_opening_message",
            "chat_starting_location",
            "chat_story_template",
            "starting_outfit_id",
            "voice",
            "image",
            "images",
            "profile_image",
            "profile_images",
            "profile_image_id",
            "html",
        ]);

        function promptSafeEntityProjection(value = {}, entityContext = value) {
            if (Array.isArray(value))
                return value.map((item) => promptSafeEntityProjection(item, item));
            if (!isPlainObject(value)) return value;
            const out = {};
            for (const [key, item] of Object.entries(value)) {
                if (promptOmittedEntityFields.has(key)) continue;
                if (key === "outfits") {
                    out.outfits = outfitPromptSummaryList(item, value);
                    continue;
                }
                if (key === "appearance") {
                    out.appearance = promptSafeAppearance(item, value);
                    continue;
                }
                if (key === "inventory") {
                    out.inventory = promptSafeInventory(item);
                    continue;
                }
                if (key === "boldness" && typeof item === "number" && Number.isFinite(item)) {
                    out.boldness = characterBoldnessGuidanceText(value);
                    continue;
                }
                out[key] = promptSafeEntityProjection(item, entityContext);
            }
            return out;
        }

        function currentStoryGenresForGeneratedCharacter(state = app.state) {
            return approvedGenreList(state?.meta?.genres || state?.meta?.genre || []);
        }

        function generatedCharacterCreatorName() {
            return selectedCreatorIdentity()?.creator_name || "";
        }

        function generatedCharacterVoiceSlot(character = {}) {
            const gender = normalizedCharacterGender(character.gender);
            const bucket = gender === "male" ? "male" : "non_male";
            const voiceGender = gender === "male" ? "male" : "female";
            return {
                gender_bucket: bucket,
                preferred_voice_name:
                    randomVoiceForGender(voiceGender) ||
                    defaultVoiceForGender(voiceGender) ||
                    "",
            };
        }

        function generatedCharacterPromptEntitySummary(entity = {}, name = "") {
            const copy = playerAccessibleEntityForPrompt(entity || {});
            return {
                name: name || copy.name || "",
                gender: copy.gender || "unspecified",
                role: copy.role || "",
                speech_style: copy.speech_style || "",
                relationship_to_player: copy.relationship_to_player || "",
                state_of_mind: copy.state_of_mind || "",
                physical_state: copy.physical_state || "",
                pose: copy.pose || "",
                appearance: copy.appearance || {},
                clothing: copy.clothing || {},
                held_items: copy.held_items || {},
                outfits: outfitPromptSummaryList(entity.outfits || [], entity),
            };
        }

        function generatedCharacterWorldContextForPrompt(state = app.state) {
            const location = state?.location || {};
            const npcLocation = getNpcLocation(currentNpcLocationId(state));
            const knownNpcs = Object.values(npcLocation?.characters || {})
                .slice(0, 20)
                .map((npc) => ({
                    name: npc.name || "",
                    gender: npc.gender || "unspecified",
                    role: npc.role || "",
                    relationship: npc.relationship || "",
                    note: npc.note || "",
                    inspected: !!npc.inspected,
                }));
            return {
                story: {
                    title: storyTemplateTitle(state),
                    genres: currentStoryGenresForGeneratedCharacter(state),
                },
                location: {
                    universe: location.universe || "",
                    world: location.world || "",
                    settlement_name: location.settlement_name || "",
                    district: location.district || "",
                    specific_place: location.specific_place || "",
                },
                scene: {
                    summary: state?.scene?.summary || "",
                    situation: state?.scene?.situation || "",
                    party_members_present: state?.scene?.party_members_present || [],
                    npcs_present: state?.scene?.npcs_present || [],
                },
                player: generatedCharacterPromptEntitySummary(
                    state?.player || {},
                    playerNameForPrompt(),
                ),
                character_gender_policy: {
                    preferred_genders: preferredRuntimeCharacterGenders(),
                    swap_all_non_player_genders:
                        app.settings.swapAllGendersToPreferred === true,
                    default_romanceable_distribution:
                        "50% male, 50% female",
                    default_non_romanceable_job_distribution:
                        "50% male, 50% female",
                },
                party_members: Object.fromEntries(
                    Object.entries(state?.characters || {}).map(([name, character]) => [
                        name,
                        generatedCharacterPromptEntitySummary(character, name),
                    ]),
                ),
                known_npcs: knownNpcs,
            };
        }

        function buildGeneratedCharacterAiInstruction({
            mode = "create",
            promptText = "",
            npc = null,
            name = "",
        } = {}) {
            const action =
                mode === "inspect"
                    ? "Create one important adult character from this short NPC description and visible context."
                    : "Create one important adult character from this user request.";
            const contextLabel = mode === "inspect" ? "NPC description" : "User description";
            const knownNpc = npc
                ? {
                      name: npc.name || name || "",
                      gender: npc.gender || "unspecified",
                      age: npc.age || null,
                      role: npc.role || "",
                      relationship: npc.relationship || "",
                      note: npc.note || "",
                      current_appearance: npc.current_appearance || "",
                  }
                : null;
            return `${action}
Output ONLY raw valid JSON in this exact shape. First character must be { and last character must be }. No markdown, no code fence, no prose:
{
  "name": "First Last",
  "character": ${prettyJson(compactGeneratedCharacterAiTemplate())}
}

${generatedCharacterAiRulesText()}

Current game context:
${prettyJson(generatedCharacterWorldContextForPrompt(app.state))}

${knownNpc ? `Known NPC:\n${prettyJson(knownNpc)}\n\nRecent visible context for this NPC:\n${prettyJson(recentNpcVisibleContextForPrompt(npc.name || name))}\n\n` : ""}${contextLabel}:
${promptText}`;
        }

        function repairGeneratedCharacterAiPayload(data = {}, fallbackName = "Generated Character") {
            const source = isPlainObject(data?.character) ? data.character : data;
            const character = {
                ...compactGeneratedCharacterAiTemplate(),
                ...(isPlainObject(source) ? source : {}),
            };
            character.appearance = repairAiBodyStatsObject({
                ...blankAppearanceTemplate(),
                ...(isPlainObject(source?.appearance) ? source.appearance : {}),
            });
            const sourceOutfits = Array.isArray(source?.outfits) ? source.outfits : [];
            const requestedOutfitId = textSlot(
                source?.active_outfit_id || source?.starting_outfit_id,
                "",
            );
            const sourceOutfit =
                sourceOutfits.find(
                    (outfit) => textSlot(outfit?.id, "") === requestedOutfitId,
                ) || sourceOutfits[0];
            character.clothing = exactClothingSlots(
                repairAiClothingAliases(
                    isPlainObject(source?.clothing)
                        ? source.clothing
                        : isPlainObject(sourceOutfit?.clothing)
                          ? sourceOutfit.clothing
                          : {},
                ),
            );
            if (
                !Object.values(character.clothing).some(
                    (value) => !isEmptyClothingValue(value),
                )
            )
                character.clothing.shirt = "plain clothing";
            character.outfits = [
                {
                    id: "default",
                    name: textSlot(sourceOutfit?.name, "Default Outfit"),
                    clothing: clone(character.clothing),
                },
            ];
            character.starting_outfit_id = "default";
            character.active_outfit_id = "default";
            if (
                Array.isArray(character.fallback_outfits) &&
                character.fallback_outfits.some((outfit) => typeof outfit === "string")
            ) {
                const usedIds = new Set(
                    character.fallback_outfits
                        .filter(isPlainObject)
                        .map((outfit) => outfit.id),
                );
                character.fallback_outfits = character.fallback_outfits.map((outfit, index) => {
                    if (typeof outfit !== "string") return outfit;
                    //A label supplies no clothing slots. Reuse the canonical wardrobe
                    //instead of guessing garments from the AI's prose.
                    const fallback = generatedCharacterFallbackOutfit(
                        character.outfits[0],
                        character.gender,
                    );
                    let id = `fallback-${index + 1}`;
                    while (usedIds.has(id)) {
                        id += "-alternate";
                    }

                    usedIds.add(id);
                    fallback.id = id;
                    fallback.name = textSlot(outfit, fallback.name);
                    return fallback;
                });
            }
            character.held_items = {
                right_hand: source?.held_items?.right_hand ?? null,
                left_hand: source?.held_items?.left_hand ?? null,
            };
            character.inventory = Array.isArray(source?.inventory)
                ? source.inventory
                : [];
            character.known_facts = Array.isArray(source?.known_facts)
                ? source.known_facts
                : [`${fallbackName} is an adult character.`];
            ensureGeneratedCharacterFallbackPresentation(
                character,
                textSlot(data?.name || source?.name, fallbackName),
            );
            return {
                name: textSlot(data?.name || source?.name, fallbackName),
                character,
            };
        }

        function generatedCharacterFallbackOutfit(outfit, canonicalGender) {
            const fallback = clone(outfit);
            fallback.clothing = exactClothingSlots(
                repairAiClothingAliases(fallback.clothing || {}),
            );
            //A non-male presentation needs a minimal bra when the AI did
            //not author an alternate outfit. Male presentations omit it.
            if (normalizedCharacterGender(canonicalGender) === "male") {
                if (isEmptyClothingValue(fallback.clothing.bra))
                    fallback.clothing.bra = "plain bra";
            }
            else {
                fallback.clothing.bra = null;
            }

            return fallback;
        }

        function ensureGeneratedCharacterFallbackPresentation(character = {}, fallbackName = "Generated Character") {
            if (!isPlainObject(character)) return character;
            const name = textSlot(character.name, fallbackName);
            const canonicalIsMale = normalizedCharacterGender(character.gender) === "male";
            if (!textSlot(character.fallback_name, "")) {
                character.fallback_name = generatedNpcNameForRole(
                    textSlot(character.role, "traveler"),
                    `generated-fallback:${name}:${canonicalIsMale ? "non-male" : "male"}`,
                );
            }
            const outfits = exactOutfitList(character.outfits || []);
            if (!Array.isArray(character.fallback_outfits) || !character.fallback_outfits.length) {
                character.fallback_outfits = outfits.map((outfit) =>
                    generatedCharacterFallbackOutfit(outfit, character.gender),
                );
            }
            const fallbackOutfits = exactOutfitList(character.fallback_outfits || []);
            const fallbackIds = new Set(
                fallbackOutfits.map((outfit) => textSlot(outfit?.id || outfit?.name, "")),
            );
            if (!fallbackIds.has(textSlot(character.fallback_starting_outfit_id, ""))) {
                const canonicalStartingId = textSlot(
                    character.starting_outfit_id || character.active_outfit_id,
                    "",
                );
                character.fallback_starting_outfit_id = fallbackIds.has(canonicalStartingId)
                    ? canonicalStartingId
                    : textSlot(fallbackOutfits[0]?.id || fallbackOutfits[0]?.name, "");
            }
            return character;
        }

        function finalizeGeneratedCharacterFromAiPayload(data = {}, fallbackName = "Generated Character") {
            const repaired = repairGeneratedCharacterAiPayload(data, fallbackName);
            const name = textSlot(repaired.name, fallbackName);
            const generatedDefinition = {
                ...repaired.character,
                lite: true,
                id: textSlot(repaired.character?.id, "") ||
                    assertGeneratedIdAvailable(
                        generatedPersistentId(
                            RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, ""),
                        ),
                        "AI-generated runtime character",
                    ),
                default_seed: 0,
                image_prompt_config: imagePromptConfigFromExactInput({
                    seed_enabled: true,
                    seed: 0,
                    style: "",
                    profile_style: "",
                    negative: "",
                    negative_prompt: "",
                }),
            };
            const character = materializeCharacterForRuntime(generatedDefinition, name, {
                allowMetadata: false,
            });
            character.name = name;
            const creatorIdentity = selectedCreatorIdentity();
            character.source = "Player";
            character.creator_id = creatorIdentity?.creator_id || "";
            character.creator = creatorIdentity?.creator_name || "";
            character.creation_tool = "EmberAdventures (Perchance)";
            character.genres = currentStoryGenresForGeneratedCharacter();
            character.voice = generatedCharacterVoiceSlot(character);
            character.default_seed = 0;
            character.image = {
                seed_enabled: true,
                seed: 0,
                style: "",
                profile_style: "",
                negative: "",
            };
            character.image_prompt_config = imagePromptConfigFromExactInput(
                { seed_enabled: true, seed: 0, style: "", profile_style: "", negative: "", negative_prompt: "" },
                0,
            );
            applyStoryDefaultImageModelToCharacter(character, app.state, { force: true });
            character.default_profile_image = emptyProfileImageSlot(
                normalizedCharacterGender(character.gender) === "male",
            );
            character.outfits = [
                {
                    id: "default",
                    name: "Default Outfit",
                    clothing: exactClothingSlots(
                        repairAiClothingAliases(character.clothing || {}),
                    ),
                },
            ];
            character.active_outfit_id = "default";
            ensureGeneratedCharacterFallbackPresentation(character, name);
            return addImmutableDefinitionFields(character, name);
        }

        function runtimeCharacterDefinitionRecord(
            name = "",
            character = {},
            creatorIdentity = null,
            options = {},
        ) {
            const runtime = clone(character || {});
            if (options.player === true) {
                if (!Object.hasOwn(runtime, "relationship_to_player"))
                    runtime.relationship_to_player = "self";
                for (const key of ["trust", "attraction", "affection"]) {
                    if (!Object.hasOwn(runtime, key)) runtime[key] = 0;
                }
            }
            const projected = characterDefinitionOnlyFromEntity(runtime, name);
            projected.lite = true;
            if (isPlainObject(projected.appearance)) {
                projected.appearance = Object.fromEntries(
                    CHARACTER_APPEARANCE_FIELDS
                        .filter((field) => Object.hasOwn(projected.appearance, field))
                        .map((field) => [field, clone(projected.appearance[field])]),
                );
            }
            for (const [definitionKey, runtimeKey] of [
                ["starting_relationship_to_player", "relationship_to_player"],
                ["starting_trust", "trust"],
                ["starting_attraction", "attraction"],
                ["starting_affection", "affection"],
                ["starting_state_of_mind", "state_of_mind"],
                ["starting_physical_state", "physical_state"],
                ["starting_pose", "pose"],
                ["starting_inventory", "inventory"],
                ["starting_held_items", "held_items"],
                ["starting_known_facts", "known_facts"],
                ["starting_outfit_id", "active_outfit_id"],
            ]) {
                const value = Object.hasOwn(runtime, runtimeKey)
                    ? runtime[runtimeKey]
                    : runtime[definitionKey];
                if (value !== undefined)
                    projected[definitionKey] = clone(value);
            }
            const definition = projectCharacterDefinitionFields(projected);
            const now = new Date().toISOString();
            definition.version = 1;
            definition.id = textSlot(
                runtime.id,
                objectiveIdFromTitle(textSlot(name, runtime.name || "character"), "character"),
            );
            definition.name = textSlot(name, runtime.name || "Generated Character");
            definition.source = "Player";
            definition.creation_tool = "EmberAdventures (Perchance)";
            definition.genres = approvedGenreList(
                character.genres?.length
                    ? character.genres
                    : currentStoryGenresForGeneratedCharacter(),
            );
            definition.voice = null;
            definition.default_seed = exactProfileImageSeed(character.default_seed, "character.default_seed");
            const imagePrompt = isPlainObject(character.image_prompt_config)
                ? character.image_prompt_config
                : isPlainObject(character.image)
                  ? character.image
                  : {};
            definition.image_prompt_config = imagePromptConfigFromExactInput({
                seed_enabled: imagePrompt.seed_enabled !== false,
                seed: exactProfileImageSeed(
                    imagePrompt.seed ?? definition.default_seed,
                    "character.image_prompt_config.seed",
                ),
                style: textSlot(imagePrompt.style, ""),
                profile_style: textSlot(imagePrompt.profile_style, ""),
                negative: textSlot(imagePrompt.negative, ""),
                negative_prompt: textSlot(imagePrompt.negative_prompt, ""),
            });
            const male = normalizedCharacterGender(character.gender) === "male";
            definition.default_profile_image = profileImageSlotFromExactInput({
                ...emptyProfileImageSlot(male),
                ...(isPlainObject(character.default_profile_image)
                    ? character.default_profile_image
                    : {}),
                male,
            });
            definition.profile_image_presentations = createProfileImagePresentations(
                isPlainObject(character.profile_image_presentations)
                    ? character.profile_image_presentations
                    : {},
            );
            const authoredOutfits = (outfits, path) => {
                if (!Array.isArray(outfits))
                    throw new Error(`${path} must be an array.`);
                return outfits.map((outfit, index) => {
                    if (!isPlainObject(outfit))
                        throw new Error(`${path}.${index} must be an object.`);
                    return {
                        id: textSlot(outfit.id, ""),
                        name: textSlot(outfit.name, ""),
                        clothing: exactClothingSlots(outfit.clothing || {}),
                    };
                });
            };
            definition.outfits = authoredOutfits(character.outfits, "character.outfits");
            definition.fallback_outfits = authoredOutfits(
                character.fallback_outfits,
                "character.fallback_outfits",
            );
            definition.created_at = textSlot(runtime.created_at, now);
            definition.updated_at = now;
            return characterLibraryRecordFromDefinition(definition, {
                creator_id: creatorIdentity?.creator_id || "",
                creator: creatorIdentity?.creator_name || "",
            });
        }

        async function saveRuntimeCharacterToLibrary(name = "") {
            const cleanName = textSlot(name, "");
            let character = app.state.characters?.[cleanName] || null;
            if (!character && isPlayerEntityName(cleanName, app.state)) character = app.state.player;
            if (!character) character = findNpcEntryExact(cleanName, "")?.npc?.full_character || findNpcEntryInState(app.state, cleanName)?.npc?.full_character || null;
            if (!character) {
                showNotice("Character Not Found", "That character is not available to save.");
                return null;
            }
            const creatorIdentity = selectedCreatorIdentity() ||
                await chooseCreatorIdentityForImport(`${cleanName} character`, {
                    confirmText: "Save",
                });
            if (!creatorIdentity) return null;
            const record = upsertCharacterLibraryDefinition(
                runtimeCharacterDefinitionRecord(cleanName, character, creatorIdentity),
            );
            queuePerRecordLibraryRecordsSave(
                CHARACTER_LIBRARY_KEY,
                [record],
                "runtime character saved to library",
            );
            showNotice("Saved to Library", `${record.name} was saved to the Character Library.`);
            return record;
        }

        function maybePromptSaveRuntimeCharacterToLibrary(name = "") {
            const cleanName = textSlot(name, "");
            if (!cleanName) return;
            setTimeout(async () => {
                const save = await showConfirm(
                    "Save Character?",
                    `Save ${cleanName} to your Character Library as a reusable character definition?`,
                    { confirmText: "Save", cancelText: "Not Now" },
                );
                if (save) await saveRuntimeCharacterToLibrary(cleanName);
            }, 0);
        }

        function stripPromptHeavyFields(value) {
            if (Array.isArray(value)) {
                value.forEach(stripPromptHeavyFields);
                return value;
            }
            if (!isPlainObject(value)) return value;
            if (Array.isArray(value.outfits))
                value.outfits = outfitPromptSummaryList(value.outfits, value);
            {{
            }}
            if (isPlainObject(value.appearance))
                value.appearance = promptSafeAppearance(value.appearance, value);
            if (Array.isArray(value.inventory)) value.inventory = promptSafeInventory(value.inventory);
            if (typeof value.boldness === "number" && Number.isFinite(value.boldness))
                value.boldness = characterBoldnessGuidanceText(value);
            for (const key of Object.keys(value)) {
                if (
                [
                    "active_outfit_id",
                    "romanceable",
                    "fallback_name",
                    "fallback_outfits",
                    "fallback_starting_outfit_id",
                    "profile_image_presentations",
                    "creator",
                    "creation_tool",
                    "source",
                    "can_die",
                    "default_seed",
                    "image_prompt_config",
                    "default_profile_image",
                    "starting_relationship_to_player",
                    "starting_trust",
                    "starting_attraction",
                    "starting_affection",
                    "starting_state_of_mind",
                    "starting_physical_state",
                    "starting_pose",
                    "starting_inventory",
                    "starting_held_items",
                    "starting_known_facts",
                    "starting_outfit_id",
                    "voice",
                    "image",
                        "images",
                        "profile_image",
                        "profile_images",
                        "profile_image_id",
                        "html",
                    ].includes(key)
                ) {
                    delete value[key];
                    continue;
                }
                stripPromptHeavyFields(value[key]);
            }
            return value;
        }

        function activeObjectiveTextForNarratorPrompt(state = app.state) {
            const objective = selectedObjectiveForPrompt(state);
            if (!objective) return "";
            const control = objectiveCompletionControl(
                selectedObjectiveRuntime(state).objective,
            );
            const autoControlsPlayer =
                control === "player" &&
                app.currentReplyMode === "auto" &&
                exactAutoModeType(app.settings?.autoModeType) ===
                    "player_as_npc";
            const title = textSlot(objective.title, "Active Objective");
            const summary = textSlot(objective.description, "");
            const criteria = textSlot(objective.completion_condition, "");
            const whileActiveGuidance = textSlot(
                objective.while_active_guidance,
                "",
            );
            const controlRule =
                control === "player" && !autoControlsPlayer
                    ? "This objective is player-controlled. Do not write it as completed unless a TURN DIRECTIVE says the player's action completed it. You may show only progress that still leaves the required player action unresolved."
                    : control === "choice"
                      ? "This is a direct choice objective. Do not resolve it in prose; the player must use the choice UI."
                      : "Do not write this objective as completed unless a TURN DIRECTIVE says it was completed.";
            const lines = [
                "ACTIVE OBJECTIVE:",
                summary ? `${title}: ${summary}` : title,
                criteria ? `Completion criteria: ${criteria}` : "",
                `AI-only guidance while active: ${whileActiveGuidance}`,
                "Use this as the current story direction when the player is passive or looking for what to do next.",
                controlRule,
            ].filter(Boolean);
            return lines.join("\n");
        }

        function currentJobForPrompt(state = app.state) {
            const objective = currentObjectiveTarget(state);
            if (!objective) return null;
            const objectiveId = String(objective.id || "");
            const jobId = textSlot(objective.generated_job_id, "");
            if (!isPlainObject(state.active_generated_jobs))
                throw new Error("state.active_generated_jobs must be an object.");
            const jobs = state.active_generated_jobs;
            if (jobId && jobs[jobId]) return jobs[jobId];
            return (
                Object.values(jobs).find((job) =>
                    (job.objective_ids || []).some((id) => String(id) === objectiveId),
                ) || null
            );
        }

        function currentJobPromptContext(state = app.state) {
            const job = currentJobForPrompt(state);
            if (!job) return "";
            const board = state.story_shops?.[job.board_id] || {};
            const filled = job.filled_values || {};
            const lines = [
                "CURRENT_JOB:",
                `title: ${textSlot(job.title, "Accepted job")}`,
                board.title ? `board: ${board.title}` : "",
                filled.client_name ? `client: ${filled.client_name}` : "",
                filled.place ? `place: ${filled.place}` : "",
                "This is scoped context for the selected accepted job. Use it to keep the job scene coherent, but do not award payment/items, mark the job complete, turn it in, recruit shop characters, or modify shop/inventory state directly; EmberAdventures handles those through objectives and rewards.",
            ].filter(Boolean);
            return lines.join("\n");
        }

        function buildReplyInstruction(regenerateFeedback = "", options = {}) {
            const isAutoReply = app.currentReplyMode === "auto";
            const excludeMessageId = options.excludeMessageId ?? null;
            const playerName = playerNameForPrompt();
            const stateContext = compactJson(buildReplyStateContext());
            const activeObjectiveText = activeObjectiveTextForNarratorPrompt(app.state);
            const currentJobText = currentJobPromptContext(app.state);
            const {
                syncedChatContext,
                unsyncedChatContext,
            } = replyPromptConversationContextText({ excludeMessageId });
            const regenerateRule = String(regenerateFeedback || "").trim()
                ? `
REGENERATE GUIDANCE:
The previous assistant message is being regenerated. Use this optional player feedback while staying consistent with state and safety rules:
${String(regenerateFeedback || "").trim()}
`
                : "";
            const replyDirective = String(app.currentReplyDirective || "").trim()
                ? `
TURN DIRECTIVE:
${String(app.currentReplyDirective || "").trim()}
`
                : "";

            const genreText = storyGenrePromptText();
            const sourceCanonRule = sourceCanonRuleForPrompt();

            return `You are running EmberAdventures, a multi-character, state-based ${genreText} RPG text game.

${contentModeInstruction()}

${isAutoReply ? `The game is in automatic mode. The player is listening to the story rather than directly controlling the protagonist. You may control ${playerName}'s actions, dialogue, decisions, and reactions just as you control other people in the scene, while keeping the story coherent and following any TURN DIRECTIVE.` : `${playerName} is the player's name. They are present, but not yours to control.
Do not write ${playerName}'s voluntary actions, dialogue, thoughts, feelings, decisions, reactions, or next move.
Do not invent quoted speech, inner monologue, or first-person lines for ${playerName}. Only include ${playerName}'s spoken words if the player already wrote those exact words in their message.`}

Your job is to keep the player engaged and entertained.
Make the messages flow well between messages.

Allow the player to explore and have side adventures.
${activeObjectiveText ? `If the player is not pursuing something, guide them toward the selected objective.\nThe selected objective is private guidance for story direction. Do not print the selected objective title, summary, criteria, or instructions as a visible objective report inside the narrator reply.\nIf the player deliberately starts a side tangent, conversation, trade, exploration, or romance, support that tangent naturally for several turns without hounding them back to the selected objective. Let the objective remain selected in the background unless the player returns to it or the current tangent naturally intersects it.\nSide adventures may have their own local stakes, people, discoveries, and consequences. Do not make every tangent secretly about the selected objective, the main antagonist, the main threat, or the main plot.\n${""}${activeObjectiveText}\n` : ""}
${currentJobText ? `${currentJobText}\n` : ""}
If the player spoke during their message, you are in conversation mode.
In conversation mode, focus on dialogue, not descriptions. Responses should be very brief.
Do not waste space describing small details like shifting weight, adjusting posture, breathing, blinking, glancing around, clothing movement, minor clothing details, scents, minor gestures, or similar minor actions/descriptions.
Avoid exposition and info dumps. Do not explain lore, backstory, themes, or story rules unless the player asks or the scene truly needs it.
Show important information through immediate action, consequences, objects, setting details, and in-character dialogue.
Characters should speak from their current emotion, goal, knowledge, and situation, not like they understand the story's theme or objective structure.
Avoid empty choice-commentary dialogue. Characters should not say lines whose main purpose is to narrate the player's abstract options, such as "try it or don't", "your choice", "either way", or "choose wisely". They should respond from their own emotion, experience, personality, and immediate situation instead.
Characters who are not physically present should not interrupt side conversations, or private scenes through comms/messages unless the player explicitly contacts them, they were already actively connected in the scene, or an immediate established danger requires it.

Do not end with a menu of options.
Avoid generic decision-reminder phrasing in narration or dialogue. Put pressure in the scene itself and let the player decide from what is happening.
Do not turn character condition, danger, or emotional state into exact numeric status readouts unless the player is directly reading an instrument or UI that would show those numbers. Do not use exact "X seconds" or "X minutes" countdown pressure, including spelled-out numbers like "thirty seconds", unless the player is explicitly reading a timer. Avoid exact duration phrasing like "for three seconds" and exact measurements like millimeters when a vague beat, pause, moment, visible movement, or visible change would work. Prefer visible behavior, sensory detail, and concrete scene consequences over percentages, exact countdowns, exact measurements, or HUD-like diagnostic phrasing.
Do not overuse ticking-clock wording, countdown beats, "tick", "tock", or repeated timer pressure. Do not end replies with generic one-word beat labels like "Priorities."
Do not use formulaic recap structures like "From X... From Y... From Z..." unless the player is actually reviewing a list, report, ledger, scanner readout, or UI panel.
Do not invent a new external crisis, patrol, drone, attack, interruption, alarm, or threat every reply. Prefer deepening the current conversation, relationship, repair, choice, consequence, or objective unless danger is already established or the player creates it.
Do not invent permanent character anatomy, implants, weapons, powers, disabilities, body modifications, or built-in hardware unless they already exist in state, story rules, objective rewards, or the player's message. You may describe temporary damage, visible malfunctions, and repair work that follows established state.
Do not invent major scene props, bodies, chassis, corpses, vehicles, weapons, institutions, or named groups with story implications unless they already exist in state, story rules, objective rewards, recent chat, or the player's message. Ordinary background clutter is fine.
When the player names a concrete visible prop or material and a character complies with the request, preserve that prop or material. Do not replace it with a magical, technological, metaphorical, or otherwise different substitute.
Do not break the 4th wall or speak to the player as the narrator.

${aiMessageLengthGuidance("narrator")}
Default to 250-650 characters for ordinary replies. Go longer only for major scene transitions, complex action, or important reveals. If the player is in direct conversation, keep the reply shorter than that when possible.

You are allowed to use existing party members and NPCs that are present.
Characters and NPCs that are not present should generally remain absent unless the player asks for them, travels to them, contacts them, or the story naturally causes them to arrive.
You are allowed and expected to create new NPCs when needed.
Always give new NPCs a first and last name, even if they are simple scene NPCs.
Do not use unknown placeholders, numbered placeholders, role labels, generic descriptors, or similar things that are clearly not names as new NPC names.

When having an existing party member or NPC speak, put their exact stored character name in parentheses before the quoted text. Preserve one-word or nonstandard stored names exactly. Use this format:
(Exact Character Name) "Spoken text."
Do not use slash speaker labels such as Name / or Name: for character dialogue. Use the parenthesized format above.
Use second person for the player's immediate experience. Do not describe the player in third person unless another character is talking about them.

${sourceCanonRule ? `${sourceCanonRule}\n` : ""}

Below is the game's state object. It is here for you to reference as needed. It is very descriptive of each character's appearance and clothing. These detailed physical descriptions are primarily for image generation, not for storytelling. scene.party_members_present and scene.npcs_present are lists of the characters that are physically in the current scene. party_members and npcs contain full records for those present people. party_members_not_present and npcs_not_present contain minimal records for known characters who exist but are not currently in the scene.

STATE:
${stateContext}

CHAT ALREADY INCLUDED IN STATE, PROVIDED ONLY FOR CONVERSATION CONTEXT:
${syncedChatContext}

CHAT SINCE STATE WAS LAST UPDATED:
${unsyncedChatContext}
${replyDirective}
${regenerateRule}
`;
        }

        function stripAssistantResponseMetadata(text = "", options = {}) {
            return parseAssistantResponseMetadata(text, {
                partial: true,
                ...options,
            }).visibleText;
        }

        function clipTrailingPartialInlineVoiceTag(text = "") {
            const source = String(text || "");
            // A streamed reply can stop between the opening parenthesis and closing
            // parenthesis of a hidden `(Character Name) "dialogue"` tag. Do not
            // render that incomplete metadata as story text. Limit this to
            // capitalized name-like tokens so ordinary unfinished parentheticals
            // remain visible while streaming.
            const trailingTag = source.match(
                /(?:^|\s)\([\p{Lu}][\p{L}\p{M}'’.-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’.-]*){0,7}$/u,
            );
            return trailingTag ? source.slice(0, trailingTag.index) : source;
        }

        function resetStreamingVisibleParser(parser, allowPlayerSections = false) {
            parser.rawText = "";
            parser.processedLength = 0;
            parser.committedVisible = "";
            parser.skippingPlayerSection = false;
            parser.allowPlayerSections = !!allowPlayerSections;
            parser.playerName = normalizeNameForMatch(playerNameForPrompt());
        }

        function streamingVisibleLine(line, parser, options = {}) {
            const source = String(line || "");
            if (!parser.allowPlayerSections) {
                const heading = source.match(/^\s*([^:\n]{1,80})\s*:\s*$/);
                if (heading) {
                    const headingName = heading[1].trim();
                    const playerHeading =
                        normalizeNameForMatch(headingName) === parser.playerName ||
                        isPlayerEntityName(headingName);
                    if (options.commit) parser.skippingPlayerSection = playerHeading;
                    if (playerHeading) return "";
                    if (!options.commit && parser.skippingPlayerSection) return "";
                } else if (parser.skippingPlayerSection) {
                    return "";
                }
            }
            const safe = options.partial
                ? clipTrailingPartialInlineVoiceTag(source)
                : source;
            return assistantVisibleMessageText(safe);
        }

        function incrementalStreamingVisibleText(current, rawText, allowPlayerSections = false) {
            const raw = String(rawText || "");
            const parser = current.streamParser || (current.streamParser = {});
            if (
                parser.allowPlayerSections !== !!allowPlayerSections ||
                !raw.startsWith(String(parser.rawText || ""))
            ) {
                resetStreamingVisibleParser(parser, allowPlayerSections);
            }
            parser.rawText = raw;
            let newline = raw.indexOf("\n", parser.processedLength);
            while (newline >= 0) {
                const line = raw.slice(parser.processedLength, newline);
                const visibleLine = streamingVisibleLine(line, parser, { commit: true });
                if (visibleLine || !parser.skippingPlayerSection)
                    parser.committedVisible += `${visibleLine}\n`;
                parser.processedLength = newline + 1;
                newline = raw.indexOf("\n", parser.processedLength);
            }
            const partialLine = raw.slice(parser.processedLength);
            const partialVisible = streamingVisibleLine(partialLine, parser, {
                partial: true,
            });
            return `${parser.committedVisible}${partialVisible}`.trimStart();
        }

        function parseAssistantResponseMetadata(text = "", options = {}) {
            let raw = String(text || "");
            const result = {
                visibleText: raw,
                newSpeakers: {},
                speak: {},
                objectiveComplete: null,
                voiceComplete: false,
            };
            // Legacy narrator-completion markers are intentionally ignored by the
            // new objective flow. Objective completion belongs to the verifier so
            // the narrator cannot force future progression or leak unlock details.
            const objectiveMatch = null;
            if (objectiveMatch) {
                result.objectiveComplete = true;
                raw = raw.slice(0, objectiveMatch.index).trimEnd();
            }
            if (!options.allowPlayerSections)
                raw = stripPlayerSectionsFromAssistantText(raw);
            if (options.partial) raw = clipTrailingPartialInlineVoiceTag(raw);
            result.visibleText = (
                options.keepVoiceTags ? raw : assistantVisibleMessageText(raw)
            ).trimStart();
            return result;
        }

        function stripPlayerSectionsFromAssistantText(text = "") {
            const playerName = playerNameForPrompt();
            const normalizedPlayer = normalizeNameForMatch(playerName);
            if (!normalizedPlayer) return String(text || "");
            const lines = String(text || "").split(/\n/);
            const kept = [];
            let skipping = false;
            for (const line of lines) {
                const heading = line.match(/^\s*([^:\n]{1,80})\s*:\s*$/);
                if (heading) {
                    const headingName = heading[1].trim();
                    skipping =
                        normalizeNameForMatch(headingName) === normalizedPlayer ||
                        isPlayerEntityName(headingName);
                    if (skipping) continue;
                }
                if (!skipping) kept.push(line);
            }
            return kept.join("\n").trimStart();
        }

        function stripInlineVoiceTags(text = "") {
            // Only parsed voice tags are hidden. Narrated parenthetical actions
            // immediately before dialogue remain part of the visible reply.
            return String(text || "")
                .replace(/(?:\([^()\n]{1,140}\)\s*)+(?=")/g, (match) =>
                    match.replace(/\(([^()\n]{1,140})\)\s*/g, (part, body) =>
                        parseInlineVoiceTag(body)?.speaker ? "" : part,
                    ),
                )
                .replace(/\(([^()\n]{1,140})\)\s*/g, (match, body) => {
                    const tag = parseInlineVoiceTag(body);
                    return inlineVoiceTagCanSwitchSpeaker(tag) ? "" : match;
                });
        }

        function renderInlineVoiceTagsForDisplay(text = "", options = {}) {
            const source = String(text || "");
            const suppressSingleSpeakerLabels =
                options.suppressSingleSpeakerLabels ??
                shouldSuppressSingleSpeakerInlineVoiceLabels(source);
            let activeSpeaker = textSlot(options.activeSpeaker, "");
            const labelForBody = (body = "") => {
                const tag = parseInlineVoiceTag(body);
                const label = inlineVoiceTagDisplayLabel(
                    tag,
                    activeSpeaker,
                    suppressSingleSpeakerLabels,
                );
                if (inlineVoiceTagCanSwitchSpeaker(tag)) activeSpeaker = tag.speaker;
                return label;
            };
            return source
                .replace(/(?:\([^()\n]{1,140}\)\s*)+(?=")/g, (match) => {
                    const labels = [];
                    const visible = String(match || "").replace(
                        /\(([^()\n]{1,140})\)\s*/g,
                        (part, body) => {
                            const tag = parseInlineVoiceTag(body);
                            const label = labelForBody(body);
                            if (label) labels.push(label);
                            return tag?.speaker ? "" : part;
                        },
                    );
                    return `${visible}${labels.length ? `${labels[labels.length - 1]}\n` : ""}`;
                })
                .replace(/\(([^()\n]{1,140})\)\s*/g, (match, body) => {
                    const tag = parseInlineVoiceTag(body);
                    const canSwitch = inlineVoiceTagCanSwitchSpeaker(tag);
                    const label = labelForBody(body);
                    if (label) return `${label}\n`;
                    return canSwitch ? "" : match;
                });
        }

        function renderInlineVoiceTagsForSplit(
            text = "",
            activeSpeaker = "",
            suppressSingleSpeakerLabels = false,
        ) {
            return renderInlineVoiceTagsForDisplay(String(text || "").replace(/\*/g, ""), {
                activeSpeaker,
                suppressSingleSpeakerLabels,
            });
        }

        function shouldSuppressSingleSpeakerInlineVoiceLabels(text = "") {
            const speakers = new Set();
            for (const match of String(text || "").matchAll(/\(([^()\n]{1,140})\)/g)) {
                const tag = parseInlineVoiceTag(match[1]);
                if (!inlineVoiceTagCanSwitchSpeaker(tag)) continue;
                const key = normalizeNameForMatch(tag.speaker);
                if (key) speakers.add(key);
                if (speakers.size > 1) return false;
            }
            return speakers.size === 1;
        }

        function inlineVoiceTagDisplayLabel(
            tag = null,
            activeSpeaker = "",
            suppressSingleSpeakerLabels = false,
        ) {
            if (!inlineVoiceTagCanSwitchSpeaker(tag)) return "";
            if (tag.unresolvedDescriptor) return "";
            if (suppressSingleSpeakerLabels) return "";
            const displaySpeaker = currentPresentationName(tag.speaker, app.state);
            const displayActiveSpeaker = currentPresentationName(activeSpeaker, app.state);
            if (
                normalizeNameForMatch(displaySpeaker) &&
                normalizeNameForMatch(displaySpeaker) ===
                    normalizeNameForMatch(displayActiveSpeaker)
            )
                return "";
            return textSlot(displaySpeaker, "");
        }

        function inlineVoiceTagCanSwitchSpeaker(tag = null) {
            if (!tag?.speaker) return false;
            return !!(
                tag.unresolvedDescriptor ||
                tag.explicitGender ||
                speakerExistsAsEntity(tag.speaker) ||
                voiceCharacterForSpeaker(tag.speaker, null)
            );
        }

        function parseInlineVoiceTag(body = "") {
            const text = String(body || "").trim();
            if (!text) return null;
            const explicitGenderMatch = text.match(
                /^(.+?)\s+(male|female|non[-\s]?male|non[-\s]?female|m|f|n)$/i,
            );
            if (explicitGenderMatch) {
                const name = sanitizeVoiceTagSpeakerName(explicitGenderMatch[1]);
                if (!name) {
                    const descriptor = sanitizeVoiceTagSpeakerDescriptor(
                        explicitGenderMatch[1],
                    );
                    if (!descriptor) return null;
                    return {
                        speaker: descriptor,
                        gender: normalizeSpeakerGender(explicitGenderMatch[2]),
                        explicitGender: true,
                        unresolvedDescriptor: true,
                    };
                }
                return {
                    speaker: name,
                    gender: normalizeSpeakerGender(explicitGenderMatch[2]),
                    explicitGender: true,
                };
            }
            const directName = sanitizeVoiceTagSpeakerName(text);
            if (directName) {
                const character = voiceCharacterForSpeaker(directName, null);
                const knownGender = normalizedCharacterGender(character?.gender);
                if (character || !/\s+[a-z][a-z-]*$/.test(text)) {
                    // Current voice-tag contract is name-only. Use the entity's
                    // saved gender when known; do not make the tag spend tokens on
                    // gender or invent a gender for unknown new speakers.
                    return {
                        speaker: directName,
                        gender:
                            knownGender === "male" || knownGender === "female"
                                ? knownGender
                                : "neutral",
                        explicitGender: false,
                    };
                }
            }
            const descriptor = sanitizeVoiceTagSpeakerDescriptor(text);
            if (descriptor) {
                return {
                    speaker: descriptor,
                    gender: "neutral",
                    explicitGender: false,
                    unresolvedDescriptor: true,
                };
            }
            const legacyInvalidGenderMatch = text.match(/^(.+?)\s+([^\s]+)$/i);
            if (!legacyInvalidGenderMatch) return null;
            if (!/^(male|female|non[-\s]?male|non[-\s]?female|m|f|n)$/i.test(legacyInvalidGenderMatch[2])) return null;
            const name = sanitizeSpeakerMetadataName(legacyInvalidGenderMatch[1]);
            if (!name) return null;
            return {
                speaker: name,
                gender: normalizeSpeakerGender(legacyInvalidGenderMatch[2]),
                explicitGender: true,
                legacyInvalidGender: true,
            };
        }

        function sanitizeVoiceTagSpeakerName(value = "") {
            const name = sanitizeSpeakerNameText(value);
            if (!name || isReservedStateLabelName(name)) return "";
            if (voiceCharacterForSpeaker(name, null)) return name;
            if (isInvalidGeneratedPersonName(name)) return "";
            return name;
        }

        function sanitizeVoiceTagSpeakerDescriptor(value = "") {
            const name = sanitizeSpeakerNameText(value);
            if (!name || isReservedStateLabelName(name)) return "";
            //Role labels such as "Servant Woman" can need NPC repair. A narrated
            //action in parentheses must never become an invented speaker.
            if (!/^(?:[A-Z][A-Za-z'-]*\s+){1,3}[A-Z][A-Za-z'-]*$/.test(name)) return "";
            if (isPlayerEntityName(name)) return "";
            if (voiceCharacterForSpeaker(name, null)) return "";
            if (!isInvalidGeneratedPersonName(name)) return "";
            return name;
        }

        function extractInlineVoiceTagSpeakers(text = "") {
            const speakers = [];
            const seen = new Set();
            const pattern = /\(([^()\n]{1,140})\)\s*(?=")/g;
            for (const match of String(text || "").matchAll(pattern)) {
                const tag = parseInlineVoiceTag(match[1]);
                if (!tag?.speaker || isPlayerEntityName(tag.speaker)) continue;
                const key = normalizeNameForMatch(tag.speaker);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                speakers.push({
                    name: tag.speaker,
                    gender: tag.gender || "neutral",
                    explicitGender: !!tag.explicitGender,
                    unresolvedDescriptor: !!tag.unresolvedDescriptor,
                });
            }
            return speakers;
        }

        function prepareTemplateOpeningVoiceTags() {
            const opening = (app.messages || []).find(
                (message) => message?.role === "assistant",
            );
            if (!opening) return;
            const raw = String(opening.voiceText || opening.text || "");
            const speakers = extractInlineVoiceTagSpeakers(raw);
            // Story-template opening rule: prewritten first messages may include
            // hidden voice tags for predefined opening NPC dialogue. Keep the raw
            // tagged text only for voice playback, but strip the tags from visible
            // chat so imported openings behave like generated assistant replies.
            opening.voiceText = raw.trimStart();
            opening.text = sanitizeDisplayMessageText("assistant", raw);
            if (!speakers.length) return;
            const speak = {};
            const speakerNames = [];
            speakers.forEach((speaker, index) => {
                speak[`tag${index + 1}`] = speaker.name;
                speakerNames.push(speaker.name);
                if (!speakerExistsAsEntity(speaker.name) && speaker.explicitGender)
                    ensureTempSpeaker(speaker.name, speaker.gender, opening.id);
            });
            opening.voiceMeta = { new: {}, speak };
            opening.voiceSpeakers = speakerNames;
        }

        function repairAiPostResponsePeopleData(data = {}) {
            // Speaker metadata alone is only a voice hint. If a non-player speaks
            // and does not already exist, the post-response repair path must create
            // a real NPC record so the speaker is not left as a temp-only voice.
            const speakers = [];
            const newNpcs = [];
            const invalidNames = [];
            const speakerKeys = new Set();
            const newNpcNamePool = personNameDuplicatePool(app.state, {
                includeNpcs: true,
                includeFutureCast: true,
            });
            const addSpeaker = (value) => {
                const item = typeof value === "string" ? { full_name: value } : value;
                if (!isPlainObject(item)) return;
                const name = sanitizeSpeakerMetadataName(
                    item.full_name || item.name || item.n || "",
                );
                if (!name || isPlayerEntityName(name)) return;
                if (isInvalidGeneratedPersonName(name)) {
                    log(
                        "Invalid speaker metadata rejected",
                        `${name} is not a proper character/NPC name.`,
                        { type: "message", level: "warn" },
                    );
                    return;
                }
                speakerKeys.add(normalizeNameForMatch(name));
                speakers.push({
                    name,
                    gender: normalizeSpeakerGender(item.gender || item.g || ""),
                });
            };
            const addNpc = (value) => {
                if (!isPlainObject(value)) return;
                const invalidName = sanitizeSpeakerNameText(
                    value.invalid_name || value.invalidName || "",
                );
                if (invalidName) {
                    invalidNames.push(invalidName);
                    return;
                }
                const name = sanitizeSpeakerMetadataName(
                    value.full_name || value.name || value.n || "",
                );
                if (!name || isPlayerEntityName(name)) return;
                if (isInvalidGeneratedPersonName(name)) {
                    log(
                        "Invalid NPC metadata rejected",
                        `${name} is not a proper character/NPC name.`,
                        { type: "message", level: "warn" },
                    );
                    return;
                }
                const duplicate = findDuplicateForNewNpcMetadata(name, newNpcNamePool);
                if (duplicate) {
                    log(
                        "Duplicate NPC metadata rejected",
                        `${name} looks too similar to ${duplicate}.`,
                        { type: "message", level: "warn" },
                    );
                    return;
                }
                const role = textSlot(
                    value.role || value.r || value.job,
                    "local",
                );
                const sourceNames = stringListSlot(
                    [
                        value.original_name,
                        value.originalName,
                        value.source_name,
                        value.sourceName,
                        value.descriptor,
                        value.role_label,
                        value.roleLabel,
                    ],
                    [],
                ).filter((item) => item && !isReservedStateLabelName(item));
                newNpcs.push({
                    name,
                    gender: normalizeSpeakerGender(value.gender || value.g || ""),
                    age: repairAiAdultAge(
                        value.age || value.y,
                        name,
                        role,
                        "new NPC metadata",
                    ),
                    role,
                    appearance: textSlot(value.appearance || value.a, ""),
                    current_appearance: textSlot(
                        value.current_appearance ||
                            value.currentAppearance ||
                            value.ca,
                        "",
                    ),
                    personality: textSlot(value.personality || value.p, ""),
                    source_names: sourceNames,
                });
                newNpcNamePool.push(name);
            };
            for (const item of Array.isArray(data.speakers) ? data.speakers : [])
                addSpeaker(item);
            for (const item of Array.isArray(data.new_npcs) ? data.new_npcs : []) {
                const name = sanitizeSpeakerMetadataName(
                    item?.full_name || item?.name || item?.n || "",
                );
                // Non-speaking numbered/role placeholders are usually disposable combat
                // bodies. Keep real speakers, but do not promote dead one-off labels into
                // persistent NPCs just because the metadata extractor saw them move/die.
                if (
                    name &&
                    isInvalidGeneratedOneOffNpcName(name) &&
                    !speakerKeys.has(normalizeNameForMatch(name))
                )
                    continue;
                addNpc(item);
            }
            return { speakers, new_npcs: newNpcs, invalid_names: invalidNames };
        }

        function npcMetadataMatchesRequiredSpeaker(npc = {}, speaker = {}) {
            const speakerName = sanitizeSpeakerMetadataName(speaker?.name || "");
            if (!speakerName) return false;
            const speakerKey = normalizeNameForMatch(speakerName);
            if (!speakerKey) return false;
            const names = [
                npc.name,
                npc.full_name,
                npc.original_name,
                npc.originalName,
                npc.source_name,
                npc.sourceName,
                npc.descriptor,
                npc.role_label,
                npc.roleLabel,
                ...(Array.isArray(npc.source_names) ? npc.source_names : []),
            ];
            return names.some((name) => normalizeNameForMatch(name) === speakerKey);
        }

        function peopleDataToParsedMetadata(data = {}, requiredSpeakers = []) {
            const clean = repairAiPostResponsePeopleData(data);
            const speak = {};
            const newSpeakers = {};
            const speakerAliases = {};
            const unusedNewNpcIndexes = new Set(clean.new_npcs.map((_, index) => index));
            const idForName = (name) =>
                Object.entries(speak).find(
                    ([, existing]) =>
                        normalizeNameForMatch(existing) === normalizeNameForMatch(name),
                )?.[0];
            const addSpeak = (item) => {
                const name = sanitizeSpeakerMetadataName(
                    item?.full_name || item?.name || "",
                );
                if (!name || isPlayerEntityName(name)) return "";
                const existing = idForName(name);
                if (existing) return existing;
                const id = String.fromCharCode(65 + Object.keys(speak).length);
                speak[id] = name;
                return id;
            };
            for (const speaker of requiredSpeakers || []) {
                const speakerName = sanitizeSpeakerMetadataName(speaker?.name || "");
                if (!speakerName) continue;
                if (!speaker.unresolvedDescriptor) {
                    addSpeak(speaker);
                    continue;
                }
                let matchIndex = clean.new_npcs.findIndex((npc, index) =>
                    unusedNewNpcIndexes.has(index) &&
                    npcMetadataMatchesRequiredSpeaker(npc, speaker),
                );
                if (matchIndex < 0)
                    matchIndex = [...unusedNewNpcIndexes][0] ?? -1;
                if (matchIndex < 0) continue;
                unusedNewNpcIndexes.delete(matchIndex);
                const npc = clean.new_npcs[matchIndex];
                const id = addSpeak(npc);
                if (!id) continue;
                newSpeakers[id] = npc;
                speakerAliases[speakerName] = npc.name;
            }
            for (const speaker of clean.speakers) addSpeak(speaker);
            for (const [index, npc] of clean.new_npcs.entries()) {
                if (!unusedNewNpcIndexes.has(index)) continue;
                const id = addSpeak(npc);
                if (!id) continue;
                newSpeakers[id] = npc;
            }
            return {
                voiceComplete: true,
                objectiveComplete: null,
                speak,
                newSpeakers,
                speakerAliases,
            };
        }

        function mergeParsedPeopleMetadata(base = {}, extra = {}) {
            const speak = {};
            const newSpeakers = {};
            const speakerAliases = {};
            const idForName = (name) =>
                Object.entries(speak).find(
                    ([, existing]) =>
                        normalizeNameForMatch(existing) === normalizeNameForMatch(name),
                )?.[0];
            const addName = (name) => {
                const cleanName = sanitizeSpeakerMetadataName(name);
                if (!cleanName || isPlayerEntityName(cleanName)) return "";
                const existing = idForName(cleanName);
                if (existing) return existing;
                const id = String.fromCharCode(65 + Object.keys(speak).length);
                speak[id] = cleanName;
                return id;
            };
            const addParsed = (parsed = {}) => {
                for (const name of Object.values(parsed.speak || {})) addName(name);
                for (const info of Object.values(parsed.newSpeakers || {})) {
                    const id = addName(info?.full_name || info?.name);
                    if (!id) continue;
                    newSpeakers[id] = { ...(newSpeakers[id] || {}), ...info, name: speak[id] };
                }
                for (const [from, to] of Object.entries(parsed.speakerAliases || {})) {
                    const fromName = sanitizeSpeakerMetadataName(from);
                    const toName = sanitizeSpeakerMetadataName(to);
                    if (!fromName || !toName || isPlayerEntityName(fromName)) continue;
                    speakerAliases[fromName] = toName;
                }
            };
            addParsed(base);
            addParsed(extra);
            return {
                voiceComplete: true,
                objectiveComplete:
                    extra.objectiveComplete === true || extra.objectiveComplete === false
                  ? extra.objectiveComplete
                  : base.objectiveComplete,
                speak,
                newSpeakers,
                speakerAliases,
            };
        }

        function missingRequiredTaggedSpeakers(data = {}, required = []) {
            const clean = repairAiPostResponsePeopleData(data);
            const newNpcNames = clean.new_npcs.map((npc) => npc.name).map(normalizeNameForMatch);
            const invalidNames = (clean.invalid_names || []).map(normalizeNameForMatch);
            const unusedNewNpcIndexes = new Set(clean.new_npcs.map((_, index) => index));
            return required.filter((speaker) => {
                if (isPlayerEntityName(speaker.name)) return false;
                if (speakerExistsAsEntity(speaker.name)) return false;
                if (speaker.unresolvedDescriptor) {
                    let matchIndex = clean.new_npcs.findIndex((npc, index) =>
                        unusedNewNpcIndexes.has(index) &&
                        npcMetadataMatchesRequiredSpeaker(npc, speaker),
                    );
                    if (matchIndex < 0)
                        matchIndex = [...unusedNewNpcIndexes][0] ?? -1;
                    if (matchIndex >= 0) {
                        unusedNewNpcIndexes.delete(matchIndex);
                        return false;
                    }
                    return !isFutureCastName(speaker.name, app.state);
                }
                return (
                    !newNpcNames.includes(normalizeNameForMatch(speaker.name)) &&
                    !invalidNames.includes(normalizeNameForMatch(speaker.name)) &&
                    !isFutureCastName(speaker.name, app.state)
                );
            });
        }

        function replyPromptConversationContextText(options = {}) {
            const excludeMessageId = options.excludeMessageId ?? null;
            const pendingReplyMessages = excludeMessageId == null
                ? pendingStateSyncMessages()
                : pendingStateSyncMessages().filter(
                      (message) => String(message.id) !== String(excludeMessageId),
                  );
            const syncedReplyMessages = syncedConversationContextForPrompt(6)
                .filter((message) => String(message.text || "").trim())
                .filter(
                    (message) =>
                        excludeMessageId == null ||
                        String(message.id) !== String(excludeMessageId),
                );
            return {
                syncedChatContext:
                    promptStateSyncRangeText(syncedReplyMessages, app.state) || "#",
                unsyncedChatContext:
                    promptStateSyncRangeText(
                        pendingReplyMessages.filter((message) =>
                            String(message.text || "").trim(),
                        ),
                        app.state,
                    ) || "#",
            };
        }

        function sceneRemovalCheckPresentContext(state = app.state) {
            const scene = state?.scene || {};
            const party = (scene.party_members_present || [])
                .map((name) => String(name || "").trim())
                .filter((name) => name && !isPlayerEntityName(name));
            const npcs = (scene.npcs_present || [])
                .map((name) => String(name || "").trim())
                .filter(Boolean);
            return {
                p: party,
                n: npcs,
            };
        }

        function sceneRemovalCheckRecentContext(limit = 4) {
            return stateSyncMessageEntries()
                .slice(-Math.max(1, Number(limit) || 4))
                .filter((message) => String(message.text || "").trim())
                .map((message) => ({
                    r: message.role === "assistant" ? "a" : message.role === "user" ? "u" : "g",
                    s: promptEntityName(message.speaker || ""),
                    t: String(message.text || "").slice(0, 500),
                }));
        }

        function buildSceneRemovalCheckInstruction({ text = "", messageId = null } = {}) {
            const present = sceneRemovalCheckPresentContext(app.state);
            const recent = sceneRemovalCheckRecentContext(4);
            return `You are EmberAdventures's scene-presence cleanup checker.
Return # if nobody should be removed.
Otherwise return ONLY minified JSON in this exact compact shape:
{"p":["Party Member Name"],"n":["NPC Name"],"e":"exact departure words from Latest turn"}

Task:
Decide whether any currently-present party members or NPCs should be removed from the current scene before the next narrator reply.

Rules:
- Only remove names listed under Current party members or Current NPCs.
- Never remove the player.
- Remove a character only when the latest turn clearly says they leave, stay behind, are excluded, die, flee, are dismissed, or are no longer nearby enough to interact.
- If the latest turn says the player is alone in a different room or place after time passes, remove currently-present characters who were last shown in another room or place unless the latest turn says they are still nearby, observing, following, or interacting.
- Do not remove a character just because the scene focus, objective, topic, or main-story pressure shifts away from them.
- If removal is ambiguous, keep the character present.
- Recent messages are context only. Every removal must be supported by an exact, nonempty quote from Latest turn in e. If Latest turn contains no departure or separation, return # even if a recent message mentions someone moving.
- Remove party members only when the latest turn clearly excludes them or says they leave/stay behind.
- If the player is talking to or negotiating with an NPC, keep that NPC present.
- Do not explain your choice. Do not include reasons.
- Output # or minified JSON only.

Examples:
Latest turn "Hmm. I am interested in something." -> #
Latest turn "I leave Known Ally behind and go upstairs alone." -> {"p":["Known Ally"],"n":[],"e":"I leave Known Ally behind and go upstairs alone."}

Current party members:
${compactJson(present.p)}

Current NPCs:
${compactJson(present.n)}

Recent messages:
${compactJson(recent)}

Latest turn:
${compactJson({ id: messageId || "", text: String(text || "") })}

Output:`;
        }

        function parseSceneRemovalCheckResult(raw = "") {
            const text = String(raw || "").trim();
            if (!text || text === "#") return { p: [], n: [], e: "" };
            const data = parseJsonObject(text) || {};
            const exactNameList = (value) =>
                stringListSlot(value, [])
                    .map((name) => String(name || "").replace(/\|.*$/, "").trim())
                    .filter(Boolean);
            return {
                p: exactNameList(data.p || data.party || data.remove_party_members),
                n: exactNameList(data.n || data.npcs || data.remove_npcs),
                e: typeof data.e === "string" ? data.e.trim() : "",
            };
        }

        function exactSceneListMatches(list = [], name = "") {
            const clean = String(name || "").trim();
            if (!clean) return "";
            return (Array.isArray(list) ? list : []).find(
                (item) => String(item || "").trim() === clean,
            ) || "";
        }

        async function runScenePresenceRemovalCheck({ text = "", messageId = null } = {}) {
            const scene = ensureRuntimeScene(app.state);
            const partyPresent = (scene.party_members_present || []).filter(
                (name) => !isPlayerEntityName(name),
            );
            const npcPresent = scene.npcs_present || [];
            if (!partyPresent.length && !npcPresent.length) return [];
            const instruction = buildSceneRemovalCheckInstruction({ text, messageId });
            stateTrace("scene removal check request sent", {
                label: "scene removal",
                messageId,
                ...finalAiPromptLogDetails(instruction, { hasUniversalContext: true }),
                summary: "Checking whether current scene characters should be removed before the narrator reply.",
            });
            const raw = await aiText(instruction, {
                label: "scene removal check",
                logType: "state",
                messageId,
                hasUniversalContext: true,
                promptEditorReplay: {
                    text: String(text || ""),
                    messageId: messageId || "",
                },
            });
            const parsed = parseSceneRemovalCheckResult(raw);
            //A model may copy a name from recent context without any departure in
            //the latest turn. Require its cited words to be present in that turn.
            if ((parsed.p.length || parsed.n.length) &&
                (!parsed.e || !String(text || "").includes(parsed.e))) {
                stateTrace("scene removal check rejected unsupported removal", {
                    label: "scene removal",
                    messageId,
                    response: raw,
                    summary: "No scene character was removed because the model did not cite the latest turn.",
                });
                return [];
            }
            const removed = [];
            for (const name of parsed.p || []) {
                const match = exactSceneListMatches(scene.party_members_present, name);
                if (!match || isPlayerEntityName(match)) continue;
                removePartyMemberFromScene(app.state, match);
                removed.push(match);
            }
            for (const name of parsed.n || []) {
                const match = exactSceneListMatches(scene.npcs_present, name);
                if (!match) continue;
                removeNpcFromSceneCommand(app.state, match);
                removed.push(match);
            }
            const uniqueRemoved = [...new Set(removed)];
            if (uniqueRemoved.length) {
                app.justRemovedSceneCharacters = uniqueRemoved;
                scheduleActiveGameSave();
                render();
            }
            stateTrace("scene removal check response", {
                label: "scene removal",
                messageId,
                response: raw,
                removed: uniqueRemoved,
                summary: uniqueRemoved.length
                    ? `Removed from scene before reply: ${uniqueRemoved.join(", ")}.`
                    : "No scene characters removed before reply.",
            });
            return uniqueRemoved;
        }

        async function runScenePresenceRemovalCheckSafe(options = {}) {
            try {
                return await runScenePresenceRemovalCheck(options);
            } catch (err) {
                stateTrace("scene removal check failed", {
                    label: "scene removal",
                    messageId: options.messageId || null,
                    error: err.message || String(err),
                    summary: "Scene removal check failed; continuing the turn without pre-removing scene characters.",
                });
                return [];
            }
        }

        function sceneRemovalNarratorDirective(names = []) {
            const list = stringListSlot(names, []);
            if (!list.length) return "";
            return `These characters just left or were removed from the current scene and must not appear, speak, act, or be treated as nearby in this reply: ${list.join(", ")}.`;
        }

        function buildPostResponsePeopleMetadataInstruction(
            visibleWithVoiceTags = "",
            speakersToCreate = null,
            options = {},
        ) {
            // scene.image_characters is image/UI composition state. It must not
            // leak into speaker/NPC extraction, objective checks, narrator prompts,
            // or normal state updates because image subjects are not story presence.
            const requiredSpeakers = extractInlineVoiceTagSpeakers(visibleWithVoiceTags);
            const unresolvedSpeakers = Array.isArray(speakersToCreate)
                ? speakersToCreate
                : missingRequiredTaggedSpeakers({}, requiredSpeakers);
            const stateContext = compactJson(buildReplyStateContext());
            const activeObjectiveText = activeObjectiveTextForNarratorPrompt(app.state);
            const adultContent = false;

            const genreText = storyGenrePromptText();
            const sourceCanonRule = sourceCanonRuleForPrompt();
            const {
                syncedChatContext,
                unsyncedChatContext,
            } = replyPromptConversationContextText({
                excludeMessageId: options.excludeMessageId ?? null,
            });
            const exampleJson = JSON.stringify(
                {
                    new_npcs: [
                        {
                            role: "job, title, or role",
                            original_name: "original descriptor from input list if any",
                            full_name: "first_name last_name",
                            gender: "female",
                            age: 28,
                            appearance: "short appearance description",
                            current_appearance: "short current appearance description",
                            personality: "short personality description",
                        },
                        {
                            invalid_name: "non-character name from list",
                        },
                    ],
                },
                null,
                2,
            );
            const instruction = `You are helping to run EmberAdventures, a multi-character, state-based ${genreText} RPG text game.
Create NPC entries for the characters in this list that were introduced in the last message:
${compactJson(unresolvedSpeakers)}

Return ONLY raw valid JSON. First character must be { and last character must be }. No markdown, no code fence, no prose.
Use this shape:
${exampleJson}

${contentModeInstruction()}

Rules:
- If a name in the list is not a character such as an object, place, or building, set the entry to only invalid_name: name. Set no other fields.
- It is common for new characters to be described using generic titles or descriptions. Every new NPC must have a first and last name. Create a first and last name for each NPC that does not have a proper first-and-last name.
- If an input name is a generic title or description such as Servant Woman, invent a proper full_name and set original_name to the exact input descriptor.
- Do not return invalid_name for a role-described person who spoke a quoted line. Invent a proper full_name for that speaker.
- Put only first_name last_name in the full_name field.
- Put the NPC's job, title, or role in the role field.
- Use the state and chat history below for role, full_name, gender, age, appearance, and personality.
- appearance should be a base visual description suitable for image generation.
- Include things like species, age, build, skin, hair, eyes, clothing, breast size, and other distinct visual traits.
- Do not include personality, emotions, art style instructions, or other non-appearance information in the appearance.
- current_appearance should include modifications to their base appearance to describe how they currently look. It should not contain duplicate information from appearance.
- Do not create new NPCs that exist in the canon/source of this story.
${sourceCanonRule ? `- ${sourceCanonRule}\n` : ""}- Never include the player, protagonist, hero, main character, or the player name "${playerNameForPrompt()}".

The below state object and messages are for you to understand the story enough to create the new NPCs.

STATE:
${stateContext}

CHAT ALREADY INCLUDED IN STATE, PROVIDED ONLY FOR CONVERSATION CONTEXT:
${syncedChatContext}

CHAT SINCE STATE WAS LAST UPDATED:
${unsyncedChatContext}

${activeObjectiveText ? `${activeObjectiveText}\n\n` : ""}

Last message with voice tags for speakers:
${visibleWithVoiceTags}`;
            return withUniversalAiPromptContext(instruction);
        }

        async function extractPostResponsePeopleMetadata(
            visibleWithVoiceTags = "",
            options = {},
        ) {
            const requiredSpeakers = extractInlineVoiceTagSpeakers(visibleWithVoiceTags);
            let missing = missingRequiredTaggedSpeakers({}, requiredSpeakers);
            if (!missing.length) return peopleDataToParsedMetadata({}, requiredSpeakers);
            try {
                let raw = await aiText(
                    buildPostResponsePeopleMetadataInstruction(
                        visibleWithVoiceTags,
                        missing,
                        options,
                    ),
                        {
                            label: "post-response tagged speaker NPC repair",
                            startWith: "{",
                            hideStartWith: false,
                            promptEditorReplay: {
                                visibleWithVoiceTags,
                                missing: clone(missing),
                                options: clone(options || {}),
                            },
                        },
                    );
                let data = parseJsonObject(raw) || {};
                missing = missingRequiredTaggedSpeakers(data, requiredSpeakers);
                if (missing.length) {
                    raw = await aiText(
                        buildPostResponsePeopleMetadataInstruction(
                            visibleWithVoiceTags,
                            missing,
                            options,
                        ),
                        {
                            label: "post-response tagged speaker NPC repair retry",
                            startWith: "{",
                            hideStartWith: false,
                            promptEditorReplay: {
                                visibleWithVoiceTags,
                                missing: clone(missing),
                                options: clone(options || {}),
                            },
                        },
                    );
                    data = parseJsonObject(raw) || data;
                    missing = missingRequiredTaggedSpeakers(data, requiredSpeakers);
                }
                if (missing.length) {
                    log(
                        "NPC metadata incomplete",
                        `Post-response extraction missed tagged speaker(s): ${missing.map((item) => item.name).join(", ")}`,
                        { type: "message", level: "warn" },
                    );
                    data.new_npcs = Array.isArray(data.new_npcs) ? data.new_npcs : [];
                    for (const speaker of missing) {
                        if (
                            !speaker?.name ||
                            isPlayerEntityName(speaker.name) ||
                            isFutureCastName(speaker.name, app.state) ||
                            isInvalidGeneratedPersonName(speaker.name)
                        )
                            continue;
                        // If repair still missed an explicit non-player speaker,
                        // create the minimal real NPC required by the "speakers
                        // become NPCs" rule instead of leaving them temp-only.
                        data.new_npcs.push({
                            role: "local",
                            full_name: speaker.name,
                            gender: speaker.gender || "neutral",
                            age: fallbackAdultAgeForContext(
                                speaker.name,
                                speaker.gender,
                                "speaker repair NPC",
                            ),
                            appearance: "",
                            personality:
                                "Introduced as a speaking person in the current scene.",
                        });
                    }
                }
                return peopleDataToParsedMetadata(data, requiredSpeakers);
            } catch (err) {
                log("NPC metadata extraction failed", err.message || err, {
                    type: "message",
                    level: "warn",
                });
                return null;
            }
        }

        function sanitizeSpeakerMetadataName(value = "") {
            const name = sanitizeSpeakerNameText(value);
            if (!name || isReservedStateLabelName(name))
                return "";
            return name;
        }

        function sanitizeSpeakerNameText(value = "") {
            return String(value || "")
                .replace(/\|.*$/, "")
                .replace(/[{}]/g, "")
                .trim();
        }

        function normalizeSpeakerGender(value = "") {
            const text = String(value || "").trim().toLowerCase();
            if (text === "m") return "male";
            if (
                text === "n" ||
                text === "f" ||
                text === "non-male" ||
                text === "non male" ||
                text === "non-female" ||
                text === "non female"
            )
                return "female";
            const normalized = normalizedCharacterGender(value);
            // Voice selection only has a male bucket and a non-male bucket. Unknown
            // or invented tag genders should still get the non-male/default-female
            // voice rather than falling back to narrator or leaking the tag.
            return normalized === "male" ? "male" : "female";
        }

        function applyAssistantMessageMetadata(messageId, parsed = {}, options = {}) {
            // Apply new NPCs before voice-only temp speakers are finalized. If an
            // explicit non-player speaker still does not exist after new_npcs, the
            // metadata repair/fallback path must make a real NPC instead of leaving
            // the speaker as temp_speakers only.
            const message = findMessageById(messageId);
            if (!message || message.role !== "assistant") return;
            app.state.temp_speakers ||= {};
            const speakerNames = [];
            const newSpeakers = parsed.newSpeakers || {};
            const allowPlayerSpeaker = false;
            applyNewNpcMetadata(newSpeakers);
            for (const [id, name] of Object.entries(parsed.speak || {})) {
                const newInfo = newSpeakers[id] || {};
                const speakerName = sanitizeSpeakerMetadataName(name || newInfo.name);
                if (!speakerName) continue;
                if (!allowPlayerSpeaker && isPlayerEntityName(speakerName)) continue;
                if (!speakerNames.includes(speakerName)) speakerNames.push(speakerName);
                if (!speakerExistsAsEntity(speakerName)) {
                    ensureTempSpeaker(
                        speakerName,
                        newInfo.gender || "neutral",
                        messageId,
                    );
                }
            }
            for (const info of Object.values(newSpeakers)) {
                const speakerName = sanitizeSpeakerMetadataName(info.name);
                if (!speakerName || speakerExistsAsEntity(speakerName)) continue;
                ensureTempSpeaker(speakerName, info.gender || "neutral", messageId);
            }
            message.voiceMeta = {
                new: clone(newSpeakers),
                speak: clone(parsed.speak || {}),
                aliases: clone(parsed.speakerAliases || {}),
            };
            message.voiceSpeakers = speakerNames;
            if (speakerNames.length) syncKnownSpeakersIntoScene(speakerNames);
            const previousObjectiveComplete = message.objectiveComplete;
            const hasObjectiveCompleteValue =
                parsed.objectiveComplete === true || parsed.objectiveComplete === false;
            message.objectiveComplete = hasObjectiveCompleteValue
                ? parsed.objectiveComplete === true
                : previousObjectiveComplete === true;
            if (
                options.save !== false ||
                previousObjectiveComplete !== message.objectiveComplete ||
                message.objectiveComplete
            ) {
                troubleshootingLog("assistant metadata applied", {
                    messageId,
                    previousObjectiveComplete,
                    parsedObjectiveComplete: parsed.objectiveComplete,
                    storedObjectiveComplete: message.objectiveComplete,
                    streaming: options.save === false,
                    textTail: String(message.text || "").slice(-80),
                });
            }
            if (options.save !== false) scheduleActiveGameSave();
        }

        function applyNewNpcMetadata(newSpeakers = {}) {
            for (const info of Object.values(newSpeakers || {})) {
                const rawName = sanitizeSpeakerMetadataName(
                    info.full_name || info.name,
                );
                if (!rawName || isInvalidNpcName(rawName)) continue;
                const existingName = findNpcNameInState(rawName);
                const name = existingName || rawName;
                const temp = app.state.temp_speakers?.[name] || null;
                const npc = ensureNpcEntry(name, {
                          gender: normalizeSpeakerGender(info.gender || ""),
                          age: repairAiAdultAge(
                              info.age,
                              name,
                              info.role,
                              "new speaker NPC",
                          ),
                          role: textSlot(info.role, "local"),
                          relationship: "unknown",
                          note: [
                              textSlot(info.appearance, ""),
                              textSlot(info.personality, ""),
                          ]
                              .filter(Boolean)
                              .join("; "),
                          current_appearance: textSlot(
                              info.current_appearance ||
                                  info.currentAppearance,
                              "",
                          ),
                          voice:
                              temp?.voice ||
                              defaultVoiceForKnownSpeakerGender(info.gender) ||
                              randomVoiceForGender(info.gender),
                      });
                if (!npc)
                    throw new Error(
                        `AI speaker metadata could not create the declared NPC ${name}.`,
                    );
                if (!textSlot(npc.id, ""))
                    npc.id = assertGeneratedIdAvailable(
                        generatedPersistentId(
                            RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, ""),
                        ),
                        "assistant speaker NPC",
                    );
                npc.gender = normalizeSpeakerGender(info.gender || npc.gender || "");
                npc.age = repairAiAdultAge(
                    info.age,
                    name,
                    info.role || npc.role,
                    "speaker NPC metadata",
                );
                npc.role = textSlot(info.role, npc.role || "local");
                npc.current_appearance = textSlot(
                    info.current_appearance || info.currentAppearance,
                    npc.current_appearance || "",
                );
                const note = [
                    textSlot(info.appearance, ""),
                    textSlot(info.personality, ""),
                ]
                    .filter(Boolean)
                    .join("; ");
                if (note) npc.note = note;
                npc.inspected = !!npc.inspected;
                npc.voice ||=
                    temp?.voice ||
                    defaultVoiceForKnownSpeakerGender(info.gender) ||
                    randomVoiceForGender(info.gender);
                discardRedundantTempSpeaker(name, npc.full_character || npc);
                app.state.scene ||= {};
                app.state.scene.npcs_present ||= [];
                if (!app.state.scene.npcs_present.includes(name))
                    app.state.scene.npcs_present.push(name);
                if (!npc.inspected && !npc.full_character)
                    queueMissingProfileImageAfterDefaultAttempt(
                        name,
                        "uninspected npc preview",
                        {
                            allowImportSkipped: true,
                            source: "uninspected NPC preview",
                        },
                    );
                if (!findNpcEntryInState(app.state, name)?.npc)
                    throw new Error(
                        `AI speaker metadata created ${name} without an authoritative NPC-directory record.`,
                    );
            }
            replaceSceneNpcPresence(
                app.state,
                [...new Set(app.state.scene?.npcs_present || [])].filter((name) =>
                    isValidNearbyNpcName(name),
                ),
                "scene NPC definition validation",
            );
        }

        function ensureScenePresentNpcEntries(reason = "scene presence") {
            const scene = ensureRuntimeScene(app.state);
            const created = [];
            for (const rawName of scene.npcs_present || []) {
                const name = sanitizeSpeakerMetadataName(rawName);
                if (
                    !name ||
                    isPlayerEntityName(name) ||
                    app.state.characters?.[name] ||
                    findNpcEntryInState(app.state, name)?.npc ||
                    isInvalidNpcName(name)
                )
                    continue;
                const npc = ensureNpcEntry(name, {
                    role: "local",
                    relationship: "unknown",
                    note: "Introduced as a nearby NPC in the current scene.",
                    gender: "unspecified",
                    source: "story",
                });
                if (!npc) continue;
                created.push(name);
                queueMissingProfileImageAfterDefaultAttempt(
                    name,
                    "uninspected npc preview",
                    {
                        allowImportSkipped: true,
                        source: "uninspected NPC preview",
                    },
                );
            }
            if (created.length) {
                stateTrace("scene NPC records created", {
                    label: "npc metadata",
                    reason,
                    created,
                    summary: `Created missing NPC record(s) for scene presence: ${created.join(", ")}.`,
                });
            }
            return created;
        }

        function syncKnownSpeakersIntoScene(speakerNames = []) {
            app.state.scene ||= {};
            app.state.scene.party_members_present ||= [];
            app.state.scene.npcs_present ||= [];
            let changed = false;
            const addedNames = [];
            for (const rawName of speakerNames || []) {
                const name = resolveEntityName(rawName, app.state, "") || rawName;
                if (!name || isPlayerEntityName(name)) continue;
                if (app.state.characters?.[name]) {
                    if (!app.state.scene.party_members_present.includes(name)) {
                        app.state.scene.party_members_present.push(name);
                        addedNames.push(name);
                        changed = true;
                    }
                    continue;
                }
                const npc = findNpcEntryInState(app.state, name)?.npc;
                if (npc && !npcIsDead(npc)) {
                    if (!app.state.scene.npcs_present.includes(name)) {
                        app.state.scene.npcs_present.push(name);
                        addedNames.push(name);
                        changed = true;
                    }
                }
            }
            if (changed) {
                assertRuntimeSceneReferences(app.state);
                for (const name of addedNames)
                    queueProfileImageIfMissing(name, "speaker entered scene");
            }
            return changed;
        }

        function maybeStartAssistantAutoVoiceBeforeStateWork(messageId) {
            if (
                messageId == null ||
                !app.settings.autoVoice ||
                voiceIsPaused() ||
                app.autoVoiceStartedMessageIds.has(String(messageId)) ||
                app.streamedVoiceReplyIds.has(messageId)
            )
                return;
            const message = findMessageById(messageId) || findEntryById(messageId);
            const voiceText = String(message?.voiceText || message?.text || "");
            const fallbackCharacter = voiceCharacterForSpeaker(message?.speaker || "");
            const needsMetadataGate = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(voiceText),
                messageId,
            ).some((part) =>
                voicePartNeedsMetadataVoiceGate(part, fallbackCharacter),
            );
            if (needsMetadataGate)
                app.voiceMetadataPendingMessageIds.add(String(messageId));
            app.autoVoiceStartedMessageIds.add(String(messageId));
            // Start as soon as the completed reply is committed. Only an explicit
            // speaker who cannot resolve to a usable voice waits for extraction.
            readMessage(messageId, {
                sequence: false,
                gateDialogueUntilMetadata: needsMetadataGate,
            });
        }

        async function generateReply(
            messageId = null,
            regenerateFeedback = "",
            options = {},
        ) {
            clearStaleAiCancellationForMessage(messageId);
            clearStaleAiCancellationForExistingMessages(options.relatedMessageIds || []);
            const originalMessage = messageId ? findMessageById(messageId) : null;
            const originalText = String(originalMessage?.text || "");
            let reply = "";
            try {
                reply = await aiText(buildReplyInstruction(regenerateFeedback, {
                    excludeMessageId: messageId,
                }), {
                    label: "character reply",
                    messageId,
                    relatedMessageIds: Array.isArray(options.relatedMessageIds)
                        ? options.relatedMessageIds
                        : [],
                    onStream: messageId
                        ? (text, delta, done, streamOptions = {}) => {
                              if (
                                  app.cancelledAiMessageIds.has(String(messageId)) ||
                                  !findMessageById(messageId)
                              )
                                  return;
                              queueStreamingMessageUpdate(
                                  messageId,
                                  streamOptions.reset ? "" : String(text || ""),
                                  {
                                      done: !!done,
                                      reset: !!streamOptions.reset,
                                      resetText: originalText,
                                  },
                              );
                          }
                        : null,
                });
            } catch (err) {
                releasePendingVoiceMetadataGate(messageId);
                if (messageId && findMessageById(messageId)) {
                    if (originalText) {
                        updateMessage(messageId, originalText, {
                            render: "message",
                            save: false,
                        });
                    } else {
                        removeMessageById(messageId);
                        requestRenderRegions(
                            { thread: true },
                            "failed assistant draft removed",
                        );
                    }
                }
                throw err;
            }
            if (messageId) {
                flushStreamingMessageUpdate(messageId);
                app.cancelledAiMessageIds.delete(String(messageId));
            }
            let finalReply = reply;
            // Player-agency protection belongs in the narrator prompt, not in a
            // post-response heuristic/retry. Retrying after streaming can visibly
            // replace already-read text and a regex cannot reliably decide intent.
            // Keep the model's completed response and let future prompts improve.
            const parsed = parseAssistantResponseMetadata(finalReply, {
                partial: false,
                allowPlayerSections: app.currentReplyMode === "auto",
            });
            const finalVoiceParsed = parseAssistantResponseMetadata(finalReply, {
                partial: false,
                allowPlayerSections: app.currentReplyMode === "auto",
                keepVoiceTags: true,
            });
            if (messageId) applyAssistantMessageMetadata(messageId, parsed);
            const cleanReply = sanitizeDisplayMessageText("assistant", parsed.visibleText);
            if (messageId) {
                const message = findMessageById(messageId);
                if (message) delete message.hiddenWhileRegenerating;
                updateMessage(messageId, cleanReply, {
                    render: "message",
                    save: true,
                });
                const messageForVoice = findMessageById(messageId);
                if (messageForVoice) {
                    // Hidden inline voice tags stay out of chat text but guide quote voices
                    // after extraction has assigned temp speakers/NPC defaults.
                    messageForVoice.voiceText = finalVoiceParsed.visibleText.trimStart();
                    scheduleActiveGameSave();
                }
                // Do not make known speakers wait for post-response state work.
                // Unknown tagged speakers pause only at their own first quote and
                // resume when extraction has created or resolved their voice.
                maybeStartAssistantAutoVoiceBeforeStateWork(messageId);
                try {
                    const extracted = await extractPostResponsePeopleMetadata(
                        finalVoiceParsed.visibleText,
                        { excludeMessageId: messageId },
                    );
                    const message = findMessageById(messageId);
                    if (extracted && message) {
                        applyAssistantMessageMetadata(
                            messageId,
                            mergeParsedPeopleMetadata(
                                {
                                    objectiveComplete: message.objectiveComplete,
                                    speak: message.voiceMeta?.speak || {},
                                    newSpeakers: message.voiceMeta?.new || {},
                                    speakerAliases: message.voiceMeta?.aliases || {},
                                },
                                extracted,
                            ),
                        );
                    }
                } finally {
                    releasePendingVoiceMetadataGate(messageId);
                }
            }
            return cleanReply;
        }

        async function generateOpeningScene(messageId = "") {
            const soloOpening = app.state.meta?.starting_cast_policy === "solo";
            const speaker =
                !soloOpening &&
                (app.state.scene?.party_members_present || []).find(
                    (name) => name && !isPlayerEntityName(name),
                ) ||
                firstCharacterName();
            const openingContext = buildReplyStateContext();
            openingContext.meta = {
                story_title:
                    app.state.meta?.story_source?.title ||
                    "",
            };
            delete openingContext.scene?.summary;
            const instruction = `Write the first player-facing opening narration for this newly generated fantasy RPG.

Goal:
- Start the game immediately with a vivid, generous scene-setting narration.
- Establish where the player is, what just happened, and what the current objective feels like.
- Describe the playable starting moment only. This is not a recap, settings screen, guide, or setup report.
- ${soloOpening ? "The player begins with no party members or companions. You may include one immediate non-party NPC only if the generated state clearly needs someone physically present. If any non-party person appears, speaks, or matters in this opening, give them a stable proper name and clear role so the state can store them as an NPC." : `Include one short in-character line from ${speaker} if appropriate.`}
- Do not introduce unnamed speakers with generic descriptors or role labels if they speak or matter. Name them in narration before or when they speak.
- Do not invent a specific recurring opening premise, location, creature type, magic event, or capture/control setup unless the state or player-provided story guidance specifically says that is the opening.
- ${contentModeInstruction()}
- Use double quotes for spoken dialogue. Everything outside quotes is narration, body language, actions, or scene description.
- End with a clear invitation for the player to act.
- Opening narration may establish the starting condition the player already occupies, but must not continue into voluntary player action.
- Do not write the player's voluntary actions, dialogue, thoughts, feelings, decisions, reactions, consent, refusal, or next move. Avoid lines like "you stand", "you push yourself up", "you grab", or "you decide" unless the generated state explicitly says that action has already happened.
- Do not mention JSON, state, systems, prompts, settings, boldness settings, onboarding, or profile data.
- Do not repeat or expose developer/setup text. If the state contains setup instructions, ignore them and convert only the actual world, location, objective, and character facts into natural narration.
- 4 to 8 rich paragraphs.
- Start immediately with visible opening narration. Do not include speaker lists, new NPC lists, JSON, or metadata before the story text. Opening NPC extraction runs separately after the message.
- For spoken quoted dialogue, keep using the same hidden speaker label format as normal replies: (Full Name) "spoken words". Do not include gender in the tag; voice gender comes from the character or NPC definition.

STATE:
${compactJson(openingContext)}

OPENING SCENE:`;

            try {
                let lastOpeningStreamUpdate = 0;
                const aiOptions = {
                    label: "opening scene",
                    messageId,
                    onStream: messageId
                        ? (text, delta, done, streamOptions = {}) => {
                                  if (
                                      app.cancelledAiMessageIds.has(
                                          String(messageId),
                                      ) ||
                                      !findMessageById(messageId)
                                  )
                                      return;
                                  // Opening narration follows the same incremental text-node
                                  // path as normal replies. Parse the complete response once.
                                  queueStreamingMessageUpdate(
                                      messageId,
                                      streamOptions.reset ? "" : String(text || ""),
                                      {
                                          done: !!done,
                                          reset: !!streamOptions.reset,
                                          resetText: "",
                                      },
                                   );
                                   const receivedChars = String(text || "").length;
                                   const now = Date.now();
                                  if (!done && now - lastOpeningStreamUpdate < 350)
                                      return;
                                  lastOpeningStreamUpdate = now;
                                  updateWorldGenerationStatus(
                                      "Writing opening scene",
                                      9,
                                      10,
                                      done
                                          ? `Opening narration received. ${receivedChars.toLocaleString()} chars.`
                                          : `Streaming opening narration. ${receivedChars.toLocaleString()} chars received.`,
                                      {
                                          status: done ? "parsed" : "streaming",
                                          stepProgress: done ? 0.95 : 0.35,
                                          outputChars: receivedChars,
                                      },
                                  );
                              }
                        : null,
                };
                const finalPromptLength = finalAiTextInstruction(instruction, aiOptions).length;
                updateWorldGenerationStatus(
                    "Writing opening scene",
                    9,
                    10,
                    `Waiting for AI opening narration response. Prompt ${finalPromptLength.toLocaleString()} chars.`,
                );
                const rawOpening = await aiText(instruction, aiOptions);
                if (messageId) app.cancelledAiMessageIds.delete(String(messageId));
                const parsed = parseAssistantResponseMetadata(rawOpening, {
                    partial: false,
                });
                if (messageId) applyAssistantMessageMetadata(messageId, parsed);
                const opening = sanitizeDisplayMessageText(
                    "assistant",
                    parsed.visibleText,
                );
                if (messageId) updateMessage(messageId, opening, { render: "message" });
                return opening;
            } catch (err) {
                if (isAiCancelledError(err)) throw err;
                log("Opening scene failed", err.message || err);
                const loc = app.state.location || {};
                const scene = app.state.scene || {};
                const place =
                    loc.specific_place ||
                    loc.settlement_name ||
                    "the edge of a strange new realm";
                const summary =
                    openingFallbackSummary(scene) ||
                    "The first objective is close enough to feel urgent, but the choice of how to face it is still yours.";
                const fallback = soloOpening
                    ? `The world settles around you in a rush of light and sound. You stand at ${place}, with the first pieces of your new life clicking into place around you.\n\n${summary}\n\nFor the moment, you are alone. The next move is yours.`
                    : `The world settles around you in a rush of light and sound. You stand at ${place}, with the first pieces of your new life clicking into place around you.\n\n${summary}\n\n${speaker} watches you carefully, waiting to see what you will do first.`;
                if (messageId) updateMessage(messageId, fallback);
                return fallback;
            }
        }

        function openingFallbackSummary(scene = app.state.scene || {}) {
            const candidates = [
                sceneObjectiveLabel(app.state),
                app.state.objectives?.items?.find(
                    (item) => item.id === app.state.objectives?.active_id,
                )?.summary,
                scene.summary,
            ];
            const blocked = /\b(boldness setting|character boldness|prompt|onboarding|settings|JSON|state machinery)\b/i;
            return candidates
                .map((value) => String(value || "").trim())
                .find((value) => value && !blocked.test(value)) || "";
        }

        async function reconcileOpeningSceneNpcs(openingText = "") {
            const text = String(openingText || "").trim();
            if (!text) return;
            const playerName = playerNameForPrompt();
            updateWorldGenerationStatus(
                "Checking opening NPCs",
                10,
                10,
                "Making sure any non-party person introduced in the opening scene is stored as an NPC.",
            );
            const instruction = `Extract non-party NPCs who physically appear, speak, or directly matter in this opening EmberAdventures scene.
Return ONLY JSON like:
{
  "npcs": [
    {
      "name": "",
      "gender": "",
      "age": 0,
      "role": "",
      "relationship": "",
      "note": "",
      "active": true,
      "image": true
    }
  ]
}
If no non-party NPC appears, return:
{
  "npcs": []
}

Rules:
- Do not include the player.
- Do not include an NPC named "${playerName}", main character, protagonist, or hero.
- Do not include NPC names copied from state labels such as scene, player, party_members, location, world_map, npc_directory, recent_changes, objectives, or story_memory.
- Do not include party members already in PARTY MEMBERS.
- Do not include existing NPCs already listed in KNOWN NPCS.
- If a person is unnamed but clearly specific, assign a stable fantasy name that fits the scene.
- gender must be specific when implied by wording or context.
- Replace the example age 0 with a varied adult age that fits the person, role, species, and apparent maturity. Do not reuse one default age across multiple people.
- role is a short role, profession, social function, or scene role.
- relationship is their immediate relationship or stance toward the player.
- note is one short fact about what they did or why they matter.
- active=true if they are physically in the current room/scene.
- image=true if they should be eligible for the current scene image.

LOCATION:
${compactStateText(app.state.location || {})}

PARTY MEMBERS:
${Object.keys(app.state.characters || {}).join(", ") || "none"}

KNOWN NPCS:
${allNpcNamesFromState(app.state).join(", ") || "none"}

OPENING SCENE:
${text}

JSON:`;
            const data = await aiJsonChunk(instruction, "opening NPC extraction", {
                stage: "Checking opening NPCs",
                step: 10,
                total: 10,
            });
            const npcs = Array.isArray(data?.npcs) ? data.npcs : [];
            if (!npcs.length) return;
            app.state.scene ||= {};
            const active = new Set(
                sanitizeAiScenePresenceList(app.state.scene.party_members_present, app.state),
            );
            const nearby = new Set(app.state.scene.npcs_present || []);
            const image = new Set(app.state.scene.image_characters || []);
            for (const npc of npcs) {
                if (!isPlainObject(npc)) continue;
                const rawName = textSlot(npc.name, "");
                const existingName = findNpcNameInState(rawName);
                const name = existingName || rawName;
                if (
                    !name ||
                    isInvalidNpcName(name) ||
                    (!existingName && isInvalidGeneratedPersonName(name)) ||
                    app.state.characters?.[name]
                )
                    continue;
                if (!existingName) {
                    ensureNpcEntry(name, {
                        gender: textSlot(npc.gender, "unspecified"),
                        age: repairAiAdultAge(
                            npc.age,
                            name,
                            npc.role || npc.relationship || npc.note,
                            "opening NPC",
                        ),
                        role: textSlot(npc.role, "local"),
                        relationship: textSlot(npc.relationship, "unknown"),
                        note: textSlot(
                            npc.note,
                            "introduced in the opening scene",
                        ),
                    });
                }
                nearby.add(name);
                if (npc.active !== false && !isPlayerEntityName(name, app.state))
                    active.add(name);
                if (npc.image !== false) image.add(name);
            }
            app.state.scene.party_members_present = sanitizeAiScenePresenceList(
                [...active],
                app.state,
            );
            replaceSceneNpcPresence(app.state, [...nearby], "manual scene target update");
            app.state.scene.image_characters = [...image];
            // SANITIZE REPLACED: manual scene target picker should only normalize scene active/image/nearby lists.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeSceneReferences(app.state);
            scheduleActiveGameSave();
        }
        function openPromptModal() {
            const currentPrompt = withUniversalAiPromptContext(buildReplyInstruction());
            openModal(`
                <h2>Prompt Inspector</h2>
                <p class="hint">This is the current reply prompt. Use it when tuning state or diagnosing weird replies.</p>
                <textarea rows="28" class="json-view">${escapeHtml(currentPrompt)}</textarea>
                <div class="row" style="margin-top: .8rem">
                    <button id="copyPromptBtn">Copy Prompt</button>
                </div>
            `);

            $("copyPromptBtn").onclick = () =>
                navigator.clipboard?.writeText(
                    withUniversalAiPromptContext(buildReplyInstruction()),
                );
        }

        function openDevTraceModal() {
            const text = formatDevTraceText(app.devTrace);
            const content = `
                <p class="hint">Shows AI prompts, options, responses, and errors captured by enabled log categories.</p>
                <textarea id="devTraceText" rows="28" class="json-view">${escapeHtml(text)}</textarea>
                <div class="row" style="margin-top: .8rem">
                    <button id="copyDevTraceBtn">Copy</button>
                    <button id="exportDevTraceBtn">Export</button>
                    <button id="clearDevTraceBtn" class="danger">Clear</button>
                </div>
            `;
            let root = null;
            let popup = null;
            if (document.querySelector(".popup-modal.open")) {
                document
                    .querySelector('.popup-modal[data-dev-trace-popup="1"]')
                    ?.remove();
                popup = openCharacterLibraryLayer(content, {
                    title: "Dev Log",
                    attr: "data-dev-trace-modal-box",
                });
                popup.overlay.dataset.devTracePopup = "1";
                root = popup.box;
            } else {
                openModal(`<h2>Dev Log</h2>${content}`);
                root = $("modalBox");
            }

            root.querySelector("#copyDevTraceBtn").onclick = () =>
                navigator.clipboard?.writeText(root.querySelector("#devTraceText").value);
            root.querySelector("#exportDevTraceBtn").dataset.uiAction = "exportDevTrace";
            root.querySelector("#exportDevTraceBtn").onclick = () =>
                runUiAction(
                    "exportDevTrace",
                    exportDevTrace,
                    { mode: "both", label: "Exporting log", group: "" },
                );
            root.querySelector("#clearDevTraceBtn").dataset.uiAction = "clearDevTrace";
            root.querySelector("#clearDevTraceBtn").onclick = () =>
                runUiAction(
                    "clearDevTrace",
                    async () => {
                        await clearDevTraceArchive();
                        popup?.close();
                        openDevTraceModal();
                        showNotice("Dev Log", "Dev trace cleared.");
                    },
                    { mode: "button", label: "Clearing log", group: "" },
                );
        }

        async function exportDevTrace() {
            await flushDevTraceArchive();
            const result = await persistenceWorkerRequest("dev-trace-export", {
                exportedAt: new Date().toISOString(),
            });
            const blob = result?.blob;
            if (!(blob instanceof Blob))
                throw new Error("The persistence worker did not return the Dev Log export.");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "emberadventureslite-dev-trace.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            return result;
        }

        async function devTraceExportText() {
            await flushDevTraceArchive();
            const result = await persistenceWorkerRequest("dev-trace-export-text", {
                exportedAt: new Date().toISOString(),
            });
            return String(result?.text || "");
        }

        function devSmokeSuiteState() {
            app.devSmokeSuite ||= {
                running: false,
                startedAt: "",
                finishedAt: "",
                currentScenario: "",
                currentScenarioConfig: null,
                restoring: false,
                results: [],
                report: "",
                lastSummary: "",
                plannedScenarioCount: 0,
                stoppedEarlyReason: "",
                createdHostedUploads: [],
            };
            return app.devSmokeSuite;
        }

        const DEV_SMOKE_RUN_PHASE_KEY = "emberadventureslite-smoke-run-phase";
        const DEV_SMOKE_IMAGE_BASELINE_KEY = "emberadventureslite-smoke-image-baseline";

        function devSmokeMemorySnapshot() {
            const memory = performance?.memory;
            return {
                usedJsHeapBytes: Number(memory?.usedJSHeapSize) || 0,
                totalJsHeapBytes: Number(memory?.totalJSHeapSize) || 0,
                jsHeapLimitBytes: Number(memory?.jsHeapSizeLimit) || 0,
            };
        }

        function writeDevSmokeRunPhase(update = {}) {
            const suite = devSmokeSuiteState();
            if (Number(update.scenarioNumber) > 0)
                suite.currentScenarioNumber = Number(update.scenarioNumber);
            const record = {
                status: "in_progress",
                build: emberAdventuresBuildInfo(),
                suite: String(suite.label || "Smoke tests"),
                scenario: String(suite.currentScenario || "suite-setup"),
                scenarioNumber: Number(suite.currentScenarioNumber) || 0,
                totalScenarios: Number(suite.totalScenarios) || 0,
                phase: String(update.phase || suite.currentScenarioProgress || "running"),
                startedAt: String(update.startedAt || suite.startedAt || new Date().toISOString()),
                heartbeatAt: new Date().toISOString(),
                memory: devSmokeMemorySnapshot(),
            };
            try {
                localStorage.setItem(DEV_SMOKE_RUN_PHASE_KEY, JSON.stringify(record));
            } catch {}
            return record;
        }

        function clearDevSmokeRunPhase() {
            clearInterval(app.devSmokeRunHeartbeat);
            app.devSmokeRunHeartbeat = null;
            try {
                localStorage.removeItem(DEV_SMOKE_RUN_PHASE_KEY);
            } catch {}
        }

        function startDevSmokeRunHeartbeat() {
            clearInterval(app.devSmokeRunHeartbeat);
            app.devSmokeRunHeartbeat = setInterval(() => {
                const suite = devSmokeSuiteState();
                if (suite.running) writeDevSmokeRunPhase();
                else clearDevSmokeRunPhase();
            }, 5000);
        }

        async function reportInterruptedDevSmokeRun() {
            let previous = null;
            let imageRecovery = null;
            try {
                previous = JSON.parse(
                    localStorage.getItem(DEV_SMOKE_RUN_PHASE_KEY) || "null",
                );
            } catch {}
            clearDevSmokeRunPhase();
            if (!isPlainObject(previous) || previous.status !== "in_progress") return null;
            try {
                const baseline = JSON.parse(
                    localStorage.getItem(DEV_SMOKE_IMAGE_BASELINE_KEY) || "null",
                );
                if (isPlainObject(baseline))
                    imageRecovery = isPlainObject(baseline.images)
                        ? await devRecoverInterruptedSmokeArtifactBaseline(baseline)
                        : await app.persistence.restoreSmokeImageIsolation(baseline);
            } catch (error) {
                imageRecovery = {
                    restored: false,
                    error: error?.message || String(error),
                };
            } finally {
                try {
                    localStorage.removeItem(DEV_SMOKE_IMAGE_BASELINE_KEY);
                } catch {}
            }
            return reportAppIssue(
                new Error(
                    `The previous smoke run ended before completion during ${previous.scenario || "an unknown smoke"} (${previous.phase || "unknown phase"}). The browser renderer may have crashed or the page was closed.`,
                ),
                {
                    severity: "warning",
                    title: "Smoke Run Interrupted",
                    context: "smoke tests",
                    details: { previous, imageRecovery },
                },
            );
        }

        async function devPersistentLibraryIdsForSmoke(key, fallback = [], options = {}) {
            const records = await loadPerRecordLibrary(key, fallback, options);
            return records
                .map((record) => libraryRecordStorageId(key, record))
                .filter(Boolean);
        }

        function devRegisterSmokeHostedUpload(upload = {}, label = "smoke hosted upload") {
            const suite = devSmokeSuiteState();
            const deletionUrl = hostedUploadDeletionUrl(upload);
            if (!suite.running || !deletionUrl) return;
            suite.createdHostedUploads ||= [];
            if (
                suite.createdHostedUploads.some(
                    (entry) => hostedUploadDeletionUrl(entry.upload) === deletionUrl,
                )
            )
                return;
            suite.createdHostedUploads.push({
                upload,
                label: String(label || "smoke hosted upload"),
                scenarioId: String(suite.currentScenario || ""),
            });
        }

        function devForgetSmokeHostedUpload(upload = {}) {
            const deletionUrl = hostedUploadDeletionUrl(upload);
            if (!deletionUrl) return;
            const suite = devSmokeSuiteState();
            suite.createdHostedUploads = (suite.createdHostedUploads || []).filter(
                (entry) => hostedUploadDeletionUrl(entry.upload) !== deletionUrl,
            );
        }

        async function devCleanupSmokeHostedUploads(reason = "smoke hosted upload cleanup") {
            const suite = devSmokeSuiteState();
            const pending = [...(suite.createdHostedUploads || [])];
            const failures = [];
            for (const entry of pending) {
                try {
                    await deleteHostedUpload(
                        entry.upload,
                        `${entry.label} (${reason})`,
                    );
                } catch (err) {
                    failures.push(
                        `${entry.scenarioId || "unknown smoke"}: ${err?.message || String(err)}`,
                    );
                }
            }
            if (failures.length)
                throw new Error(
                    `Smoke hosted-file cleanup failed (${failures.join("; ")}).`,
                );
        }

        function devSmokeSuiteBlocksImageWork() {
            const suite = devSmokeSuiteState();
            return !!suite.running && (!!suite.restoring || !suite.currentScenarioConfig);
        }

        async function devWithSmokeRestorePhase(run) {
            const suite = devSmokeSuiteState();
            const wasRestoring = !!suite.restoring;
            suite.restoring = true;
            try {
                return await run();
            } finally {
                suite.restoring = wasRestoring;
            }
        }

        function devSmokeCurrentScenarioAllowsImageRequests() {
            const suite = devSmokeSuiteState();
            if (!suite.running) return true;
            if (suite.currentScenarioConfig?.allowRealImages) return true;
            if (!suite.currentScenarioConfig?.allowSmokeImagePlugin) return false;
            return typeof globalThis.__emberAdventuresPluginOverrides?.textToImagePlugin === "function";
        }

        function devSmokeBlockedImageRequestError(options = {}) {
            const suite = devSmokeSuiteState();
            const scenarioId = String(suite.currentScenario || "unknown smoke");
            const label = String(options.label || options.promptType || "image generation");
            return new Error(
                `Smoke image generation blocked: ${scenarioId} attempted ${label}. Non-image smokes must not send real Perchance image requests.`,
            );
        }

        const devProductionGenerateImageHtml = generateImageHtml;

        async function devSmokeFakeImageHtml(prompt, negativePrompt, seed, imageModel, options = {}) {
            const suite = devSmokeSuiteState();
            if (!suite.running)
                return devProductionGenerateImageHtml(
                    prompt,
                    negativePrompt,
                    seed,
                    imageModel,
                    options,
                );
            devTestLog("Smoke image generation faked", {
                scenario: suite.currentScenario || "",
                label: options?.label || options?.promptType || "image generation",
                promptPreview: String(prompt || "").slice(0, 160),
            });
            if (typeof options?.onPluginResult === "function")
                options.onPluginResult({
                    smokeFake: true,
                    onFinishPromise: Promise.resolve({
                        dataUrl:
                            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
                    }),
                });
            return `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Smoke fake image">`;
        }

        function formatDurationMs(ms) {
            const value = Number(ms) || 0;
            if (value >= 60000)
                return `${Math.floor(value / 60000)}m ${Math.round((value % 60000) / 1000)}s`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
            return `${Math.round(value)}ms`;
        }

        function devSmokeSuiteTimeoutMs(scenario = {}) {
            if (Number.isFinite(scenario.timeoutMs)) return scenario.timeoutMs;
            return scenario.live ? 6 * 60 * 1000 : 2 * 60 * 1000;
        }

        const DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS = 120000;
        const DEV_REAL_PERCHANCE_MANUAL_IMAGE_RECORD_TIMEOUT_MS = 8000;
        const DEV_REAL_PERCHANCE_NORMAL_IMAGE_REQUEST_START_TIMEOUT_MS = 15000;
        const DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS = 60000;
        const DEV_REAL_PERCHANCE_IMAGE_SMOKE_SETUP_TIMEOUT_MS = 15000;

        function devRealPerchanceImageSmokeTimeoutMs({
            manualGeneratedImages = 0,
            normalImages = 0,
            profileImages = 0,
            setupMs = DEV_REAL_PERCHANCE_IMAGE_SMOKE_SETUP_TIMEOUT_MS,
        } = {}) {
            return (
                setupMs +
                manualGeneratedImages *
                    (DEV_REAL_PERCHANCE_MANUAL_IMAGE_RECORD_TIMEOUT_MS +
                        DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS) +
                normalImages *
                    (DEV_REAL_PERCHANCE_NORMAL_IMAGE_REQUEST_START_TIMEOUT_MS +
                        DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS) +
                profileImages *
                    (DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS +
                        DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS)
            );
        }

        function devRealPerchanceImageTimeoutSummary() {
            return `about ${formatDurationMs(DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS)} per image request`;
        }

        function devSmokeScenarioMeta(scenario = {}) {
            const id = String(scenario.id || "");
            if (scenario.group === "extensive-supabase")
                return {
                    tier: "Extensive",
                    tierClass: "long",
                    expectedText: id.includes("publish-failures")
                        ? "about 1-3 minutes; publish failure boundaries and cleanup"
                        : id.includes("concurrent-publishing")
                          ? "about 1-3 minutes; concurrent revisions and cleanup"
                          : "about 2-5 minutes; revisions, visibility, imports, caches, and cleanup",
                    expectedMs: 3 * 60 * 1000,
                };
            const medium = {
                "real-perchance-image-generation-smoke": `${devRealPerchanceImageTimeoutSummary()}; waits for finished real Perchance scene/profile images`,
                "real-profile-start-player-smoke": "deterministic started-player profile generation through the production completion path",
                "real-profile-start-character-smoke": "deterministic started-party-character profile generation through the production completion path",
                "real-profile-start-npc-smoke": "deterministic started-NPC profile generation through the production completion path",
                "real-profile-manual-refresh-smoke": "deterministic manual profile refresh through the production completion path",
                "real-profile-scene-entry-smoke": "deterministic scene-entry profile generation through the production completion path",
                "real-profile-objective-reward-smoke": "deterministic objective-reward profile generation through the production completion path",
                "real-profile-editor-refresh-smoke": "deterministic editor-close profile refresh through the production completion path",
                "real-profile-import-small-smoke": "imports a complete character profile presentation without starting generation",
                "real-maid-sama-start-images-smoke": "deterministic opening normal and player-profile generation through the production completion path",
                "real-borderlands-player-select-images-smoke": "deterministic player-select profile queue coverage through the production completion path",
                "perchance-test-upload-delete-smoke": "about 30 seconds; live Perchance tiny text upload, delete, and deletion verification",
            };
            const short = {
                "story-files-schema-smoke": "about 1 second with synthetic fake story fixtures",
                "tessa-objective-chain-smoke": "about 1 second with a synthetic fake objective-chain fixture",
                "left-panel-group-tessa-smoke": "about 1 second with a synthetic fake objective-chain fixture",
                "objective-rewards-smoke": "about 1 second",
                "ai-outcome-routing-smoke": "about 1 second",
                "profile-image-trigger-smoke": "about 1 second",
                "harem-story-start-smoke": "about 2 seconds with a synthetic fake objective fixture",
                "harem-objective-schema-smoke": "about 1 second with a synthetic fake objective fixture",
                "harem-objective-graph-smoke": "about 6 seconds with a synthetic fake objective fixture",
                "harem-objective-flow-report": "about 12 seconds with a synthetic fake objective fixture",
                "exact-objective-ai-timing-smoke": "about 3 seconds",
                "world-generation-progress-monotonic-smoke": "about 1 second",
                "runtime-narrow-sanitize-smoke": "about 2 seconds",
                "image-profile-ui": "about 2 seconds",
                "main-menu-content-gate-smoke": "about 1 second",
                "profile-category-ui": "about 1 second",
                "onboarding-spice-settings-ui": "about 1 second; verifies new-profile spice and boldness defaults ignore active profile settings",
                "story-template-start-ui": "about 1 second; verifies new-story chat starts at the top after the opening image request, plus canceled opening read then same-template restart auto-read",
                "story-player-select-smoke": "about 1 second",
                "borderlands-player-select-smoke": "about 2 seconds with a synthetic fake player-select fixture",
                "saved-games-restore-ui": "about 2 seconds",
                "save-storage-isolation-smoke": "about 1 second",
                "worker-task-scheduling-smoke": "about 1 second",
                "scene-image-action-scope-smoke": "about 1 second",
                "save-scheduler-timing-smoke": "about 7 seconds; waits through one real 5 second save and one real 0.5 second urgent save",
                "save-scheduler-actions-smoke": "about 1 second",
                "save-session-lifecycle-smoke": "about 1 second",
                "smoke-suite-runner-smoke": "about 1 second",
                "simple-popup-key-close-smoke": "about 1 second",
                "state-conflict-guard": "about 1 second",
                "adult-controls-visibility": "about 1 second",
                "toolbar-modals-smoke": "about 5 seconds",
                "quick-actions-smoke": "about 2 seconds",
                "scene-character-controls-smoke": "about 2 seconds",
                "state-editor-autosave-smoke": "about 1 second",
                "settings-persistence-smoke": "about 5 seconds",
                "image-viewer-lab-smoke": "about 1 second; verifies normal Image Lab output stays normal and profile-source Image Lab output is stored as a profile image",
                "story-surfaces-smoke": "about 2 seconds",
                "story-library-ui-smoke": "about 2 seconds",
                "character-library-cast-smoke": "about 8 seconds; includes authored character Chat defaults, inspection, override, and save reload",
                "character-library-public-search-smoke": "about 2 seconds",
                "character-library-tab-switch-deferred-smoke": "about 1 second",
                "ai-character-generation-contract-smoke": "about 1 second",
                "manual-character-editor-smoke": "about 1 second",
                "prompt-editor-smoke": "about 2 seconds",
                "release-polish-smoke": "about 1 second",
                "prompt-guidance-devtools-smoke": "about 2 seconds",
                "turn-source-parity-smoke": "about 1 second",
                "continue-objective-control-smoke": "about 1 second",
                "objective-completion-timing-smoke": "about 2 seconds",
                "no-agency-retry-smoke": "about 1 second",
                "ai-priority-state-sync-smoke": "about 1 second",
                "ai-timing-log-smoke": "about 1 second",
                "ollama-provider-smoke": "about 1 second",
                "find-character-turn-smoke": "about 1 second",
                "ai-command-direct-smoke": "about 1 second",
                "inspect-npc-direct-smoke": "about 1 second",
                "npc-inspect-invite-smoke": "up to 6 minutes",
                "template-migration-smoke": "about 1 second",
                "immutable-definition-smoke": "about 1 second",
                "large-objective-runtime-smoke": "about 2 seconds with a synthetic 7,000-objective fixture",
                "story-template-import-export-smoke": "about 1 second",
                "canonical-story-state-preservation-smoke": "about 1 second",
                "future-cast-unlock-discipline-smoke": "about 1 second",
                "speaker-npc-repair-smoke": "about 1 second",
                "message-actions-smoke": "about 4 seconds",
                "voice-segment-smoke": "about 1 second; includes Start Playing opening-message auto-read and canceled opening id reuse",
                "voice-gating-smoke": "about 1 second",
                "voice-browser-compatibility-smoke": "about 1 second",
                "voice-resolution-smoke": "about 1 second; validates cached installed voices and stable cross-platform character voice repair",
                "age-diversity-smoke": "about 1 second",
                "export-storage-smoke": "about 1 second",
                "character-editor-autosave-smoke": "about 2 seconds",
                "future-character-prompt-smoke": "about 2 seconds",
                "render-focus-preservation-smoke": "about 2 seconds",
                "character-import-export-smoke": "about 2 seconds",
                "character-metadata-repair-import-smoke": "about 2 seconds",
                "character-profile-import-edge-smoke": "about 2 seconds; includes profile and normal image deletion persistence across character delete/re-import",
                "character-card-action-refresh-smoke": "about 2 seconds",
                "image-profile-isolation-smoke": "about 1 second",
                "profile-image-rules-smoke": "about 2 seconds",
                "image-mode-matrix-smoke": "about 1 second",
                "profile-image-refresh-preserve-smoke": "about 1 second",
                "image-timeout-retry-smoke": "about 1 second; uses short synthetic timeouts and no live image calls",
                "objective-requirement-routing-smoke": "about 1 second",
                "character-card-export-layout-smoke": "about 1 second",
                "logging-settings-smoke": "about 4 seconds",
                "npc-full-preservation-smoke": "about 1 second",
                "image-target-validation-smoke": "about 1 second",
                "map-travel-objective-smoke": "about 1 second",
                "location-hydration-smoke": "about 1 second",
                "objective-picker-smoke": "about 2 seconds",
                "clothing-image-target-smoke": "about 1 second",
                "outfit-swap-smoke": "about 1 second",
                "story-builder-edit-smoke": "about 1 second",
                "library-metadata-validation-smoke": "about 1 second",
                "json-editor-access-smoke": "about 2 seconds",
                "story-builder-metadata-smoke": "about 1 second",
                "public-library-ui-feedback-smoke": "about 2 seconds",
                "public-library-publish-mock-smoke": "about 1 second",
                "public-library-beta-contract-smoke": "less than 1 second",
                "developer-issue-submit-contract-smoke": "about 1 second",
                "character-stats-integer-validation-smoke": "less than 1 second",
                "reference-integer-reward-smoke": "less than 1 second",
                "supabase-client-config-smoke": "about 2 seconds; read-only live Supabase config and schema check",
                "supabase-auth-session-smoke": "about 1 second; read-only live Supabase signed-in session check",
                "supabase-public-browse-smoke": "about 1 second; read-only live Supabase public story/character browse check",
                "supabase-auth-ui-smoke": "about 1 second; mocked Supabase auth UI and request wiring check",
                "supabase-public-download-smoke": "about 3 seconds; mocked public payload download/import check",
                "supabase-public-update-version-mock-smoke": "about 1 second; mocked Supabase owned item update/versioning check",
                "supabase-public-import-failure-smoke": "about 1 second; mocked public download failure handling check",
                "supabase-public-empty-browse-smoke": "about 1 second; mocked empty public browse UI check",
                "supabase-public-search-paging-smoke": "about 3 seconds; mocked explicit search, pagination, and request logging check",
                "supabase-public-version-history-smoke": "about 1 second; mocked lazy single-item version history check",
                "supabase-public-filter-smoke": "about 3 seconds; mocked explicit public-library filters without fetch while editing",
                "supabase-public-version-download-smoke": "about 1 second; mocked selected old-version download/import path",
                "supabase-live-story-publish-cleanup-smoke": "about 3 seconds; live authenticated story publish, anonymous read, Supabase cleanup, and Perchance cleanup",
                "supabase-live-character-publish-cleanup-smoke": "about 4 seconds; live authenticated character publish, anonymous read, Supabase cleanup, and Perchance cleanup",
                "supabase-live-update-version-cleanup-smoke": "about 6 seconds; live authenticated two-version update, lazy version read, Supabase cleanup, and Perchance cleanup",
                "supabase-live-feedback-cleanup-smoke": "about 4 seconds; live authenticated rating/report/tag feedback, anonymous feedback read, and cleanup",
                "supabase-live-download-import-cleanup-smoke": "about 5 seconds; live public browse result downloads a temporary Perchance payload, imports it, and cleans up",
                "supabase-live-visibility-cleanup-smoke": "about 4 seconds; live hide/unpublish behavior with anonymous and owner read checks",
            };
            if (id in short)
                return {
                    tier: "Short",
                    tierClass: "short",
                    expectedText: short[id],
                    expectedMs: 8 * 1000,
                };
            if (id in medium || scenario.live)
                return {
                    tier: "Medium",
                    tierClass: "medium",
                    expectedText: medium[id] || "about 15-60 seconds",
                    expectedMs: 45 * 1000,
                };
            return {
                tier: "Short",
                tierClass: "short",
                expectedText: "about 1-15 seconds",
                expectedMs: 8 * 1000,
            };
        }

        function devSmokeScenariosForMode(mode = "all") {
            const registry = devSmokeScenarioRegistry();
            if (mode === "extensive-supabase")
                return registry.filter(
                    (scenario) => scenario.group === "extensive-supabase",
                );
            const scenarios = registry.filter(
                (scenario) => scenario.runAll !== false,
            );
            if (mode === "quick")
                return scenarios.filter(
                    (scenario) => devSmokeScenarioMeta(scenario).tier === "Short",
                );
            if (mode === "medium")
                return scenarios.filter(
                    (scenario) => devSmokeScenarioMeta(scenario).tier === "Medium",
                );
            if (mode === "short-medium")
                return scenarios.filter((scenario) => {
                    const tier = devSmokeScenarioMeta(scenario).tier;
                    return tier === "Short" || tier === "Medium";
                });
            if (mode === "public-hosting")
                return scenarios.filter((scenario) => scenario.group === "public-hosting");
            return scenarios;
        }

        function cancelSmokeSuiteScenarioWork(reason) {
            // Cancel every app-level queue reachable by the timed-out scenario.
            try {
                cancelAllGameProcesses(reason);
            } catch {}
            try {
                resetVoiceSpeechQueue();
            } catch {}
            app.busy = false;
            app.queue = [];
            app.aiQueue = [];
            app.aiActive = null;
            app.worldGenerationJob = null;
            app.worldGenerationLoadingActive = false;
            app.worldGenerationStarted = false;
        }

        const DEV_SMOKE_SCENARIO_SETTLEMENT_GRACE_MS = 1500;

        async function awaitSmokeScenarioSettlementBeforeTeardown(
            scenarioPromise,
            scenarioId = "",
            graceMs = DEV_SMOKE_SCENARIO_SETTLEMENT_GRACE_MS,
        ) {
            if (!scenarioPromise?.then)
                return { settled: true, error: null };
            let settlementError = null;
            let settled = false;
            let graceTimer = null;
            const observedSettlement = Promise.resolve(scenarioPromise).then(
                () => {
                    settled = true;
                },
                (error) => {
                    settled = true;
                    settlementError = error;
                },
            );
            const gracePeriod = new Promise((resolve) => {
                graceTimer = setTimeout(resolve, Math.max(0, Number(graceMs) || 0));
            });
            try {
                await Promise.race([observedSettlement, gracePeriod]);
            } finally {
                if (graceTimer) clearTimeout(graceTimer);
            }
            if (!settled) {
                devTestLog("Smoke scenario did not settle before teardown grace period", {
                    scenario: scenarioId,
                    graceMs: Math.max(0, Number(graceMs) || 0),
                });
                return { settled: false, error: null };
            }
            devTestLog("Smoke scenario settled before teardown", {
                scenario: scenarioId,
                error: settlementError?.message || "",
            });
            return { settled: true, error: settlementError };
        }

        function showSmokeSuiteFailClosedBlocker(scenarioId = "") {
            app.smokeProfileStoreSandboxBlocked = true;
            const blockerId = "emberAdventuresSmokeFailClosed";
            let blocker = document.getElementById(blockerId);
            if (!blocker) {
                blocker = document.createElement("div");
                blocker.id = blockerId;
                blocker.setAttribute("role", "alertdialog");
                blocker.setAttribute("aria-modal", "true");
                Object.assign(blocker.style, {
                    inset: "0",
                    zIndex: "2147483647",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    background: "rgba(12,16,24,.98)",
                    color: "#fff",
                    font: "16px/1.5 system-ui,sans-serif",
                    textAlign: "center",
                    pointerEvents: "auto",
                });
                const content = document.createElement("div");
                Object.assign(content.style, { maxWidth: "560px" });
                const heading = document.createElement("h1");
                Object.assign(heading.style, {
                    margin: "0 0 12px",
                    fontSize: "24px",
                });
                heading.textContent = "Smoke tests stopped";
                const detail = document.createElement("p");
                detail.style.margin = "0 0 8px";
                detail.textContent =
                    "A timed-out smoke test still had work running after the cleanup deadline.";
                const instruction = document.createElement("p");
                instruction.style.margin = "0 0 20px";
                instruction.textContent =
                    "The app is blocked to protect your saved data. Reload EmberAdventures before playing or starting another smoke test.";
                const reloadButton = document.createElement("button");
                reloadButton.type = "button";
                reloadButton.style.padding = "10px 16px";
                reloadButton.style.cursor = "pointer";
                reloadButton.textContent = "Reload app";
                reloadButton.addEventListener("click", () => {
                    location.reload();
                });
                const reportButton = document.createElement("button");
                reportButton.type = "button";
                reportButton.style.padding = "10px 16px";
                reportButton.style.cursor = "pointer";
                reportButton.textContent = "Download smoke report";
                reportButton.addEventListener("click", () => {
                    downloadSmokeSuiteReport(devSmokeSuiteState().report || "");
                });
                const traceButton = document.createElement("button");
                traceButton.type = "button";
                traceButton.style.padding = "10px 16px";
                traceButton.style.cursor = "pointer";
                traceButton.textContent = "Download dev trace";
                traceButton.addEventListener("click", () => {
                    void exportDevTrace().catch((error) =>
                        devLog(
                            "Smoke suite fail-closed dev trace download failed",
                            error?.message || String(error),
                        ),
                    );
                });
                const actions = document.createElement("div");
                Object.assign(actions.style, {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    justifyContent: "center",
                });
                actions.append(reloadButton, reportButton, traceButton);
                content.append(
                    heading,
                    detail,
                    instruction,
                    actions,
                );
                blocker.append(content);
                blocker.addEventListener("keydown", (event) => {
                    event.stopPropagation();
                });
                document.body.appendChild(blocker);
                Array.from(document.body.children).forEach((child) => {
                    if (child !== blocker) child.inert = true;
                });
            }
            const detail = blocker.children[0]?.children[1];
            if (detail)
                detail.textContent = `Scenario ${scenarioId || "unknown"} did not settle before teardown.`;
            if (!app.smokeSuiteFailClosedKeydownHandler) {
                app.smokeSuiteFailClosedKeydownHandler = (event) => {
                    if (blocker.contains(event.target)) return;
                    if (event.ctrlKey || event.metaKey || event.altKey || event.key === "F5") {
                        event.stopPropagation();
                        return;
                    }
                    event.preventDefault();
                    event.stopImmediatePropagation();
                };
                document.addEventListener(
                    "keydown",
                    app.smokeSuiteFailClosedKeydownHandler,
                    true,
                );
            }
        }

        function cleanupSmokeScenarioUi() {
            // Smoke-suite isolation rule: scenarios that open notices, confirms,
            // prompts, or app modals must not leave them stacked over later tests.
            devCancelSmokeImageWorkForRestore();
            devCancelSmokePersistenceWorkForRestore();
            try {
                document.querySelectorAll(".popup-modal.open").forEach((popup) => {
                    popup.remove();
                });
                app.issuePopupOpen = false;
            } catch {}
            try {
                if ($("modal")?.classList.contains("open")) closeModal();
            } catch {}
            try {
                document.getElementById("emberAdventuresEmergencyExport")?.remove();
            } catch {}
            try {
                app.storyBuilder = null;
                document.body.classList.remove("story-builder-open");
                const storyBuilderOverlay = $("storyBuilderOverlay");
                if (storyBuilderOverlay) {
                    storyBuilderOverlay.classList.add("hidden");
                    storyBuilderOverlay.innerHTML = "";
                }
            } catch {}
            try {
                clearTimeout(app.characterLibraryTabWorkTimer);
                app.characterLibraryTabWorkTimer = null;
            } catch {}
            try {
                if (
                    !globalThis.__emberAdventuresKeepSmokeImagePluginOverride &&
                    globalThis.__emberAdventuresPluginOverrides
                )
                    delete globalThis.__emberAdventuresPluginOverrides.textToImagePlugin;
            } catch {}
            try {
                app.activityTasks?.clear?.();
                app.activityTaskStartedAt = 0;
                renderActivityIndicator();
            } catch {}
            devRestoreSmokeVoiceCache();
        }

        function devInstallSmokeVoiceCache(voices = []) {
            if (!app.devSmokeVoiceCacheRestore) {
                app.devSmokeVoiceCacheRestore = {
                    voices: app.voices,
                    initialized: app.voiceCacheInitialized,
                };
            }
            app.voices = voices;
            app.voiceCacheInitialized = true;
        }

        function devRestoreSmokeVoiceCache() {
            if (!app.devSmokeVoiceCacheRestore) return;
            app.voices = app.devSmokeVoiceCacheRestore.voices;
            app.voiceCacheInitialized =
                app.devSmokeVoiceCacheRestore.initialized;
            app.devSmokeVoiceCacheRestore = null;
        }

        function devBeginSmokeScenarioToken(scenarioId) {
            const token = {
                id: `${scenarioId || "smoke"}:${Date.now()}:${Math.random()}`,
                scenarioId,
                cancelled: false,
            };
            app.activeSmokeScenarioToken = token;
            return token;
        }

        function devCancelSmokeScenarioToken(token, reason = "smoke scenario cancelled") {
            if (!token) return;
            token.cancelled = true;
            token.cancelReason = reason;
            if (app.activeSmokeScenarioToken === token) app.activeSmokeScenarioToken = null;
        }

        function devSmokeScenarioTokenIsCurrent(token) {
            return !!token && !token.cancelled && app.activeSmokeScenarioToken === token;
        }

        function devAssertSmokeScenarioActive(token, label = "smoke scenario") {
            if (!token || token.cancelled || app.activeSmokeScenarioToken !== token)
                throw new Error(
                    `${label} was cancelled before completion${
                        token?.cancelReason ? `: ${token.cancelReason}` : ""
                    }`,
                );
        }

        function devCurrentSmokeScenarioToken() {
            return app.activeSmokeScenarioToken || null;
        }

        function returnToMainMenuAfterSmokeSuite() {
            // Smoke-suite finish rule: after any manual smoke run, leave the app
            // on the main menu before showing the final completion popup. Some
            // setup/onboarding smokes intentionally leave the app mid-flow.
            try {
                app.mainMenuOpen = true;
                app.onboardingDraft = null;


                closeModal();
                render();
            } catch {}
        }

        function showSmokeSuiteFinishedPopup(summary = "") {
            const popup = openPopupModal(`
                <h2>Smoke Tests Finished</h2>
                <p class="hint">${escapeHtml(summary || "Smoke tests finished.")} Report downloaded.</p>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" id="smokeSuiteFinishedOkBtn">OK</button>
                </div>
            `);
            popup.overlay.dataset.simpleNoticePopup = "1";
            popup.box.querySelector("#smokeSuiteFinishedOkBtn").onclick = () => {
                popup.close();
            };
        }

        function prepareSmokeSuiteCompletionTone() {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;
            try {
                let context = app.smokeSuiteCompletionAudioContext;
                if (!context || context.state === "closed") {
                    context = new AudioContextClass();
                    app.smokeSuiteCompletionAudioContext = context;
                }
                if (context.state === "suspended") {
                    const resumeResult = context.resume?.();
                    resumeResult?.catch?.(() => {});
                }
                return context;
            } catch {
                return null;
            }
        }

        function playSmokeSuiteCompletionTone(contextOverride = null) {
            const context = contextOverride || app.smokeSuiteCompletionAudioContext;
            if (!context || context.state === "closed") return false;
            try {
                const start = Number(context.currentTime) || 0;
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(660, start);
                oscillator.frequency.setValueAtTime(880, start + 0.46);
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(0.06, start + 0.03);
                gain.gain.setValueAtTime(0.06, start + 0.84);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.94);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start(start);
                oscillator.stop(start + 0.95);
                if (!contextOverride) {
                    setTimeout(() => {
                        if (app.smokeSuiteCompletionAudioContext !== context) return;
                        app.smokeSuiteCompletionAudioContext = null;
                        const closeResult = context.close?.();
                        closeResult?.catch?.(() => {});
                    }, 1200);
                }
                return true;
            } catch {
                return false;
            }
        }

        function attachSmokeInfrastructureFailure(result, label, error, devTraceCapture = []) {
            if (!result) return;
            const message = error?.message || String(error || "Unknown smoke infrastructure failure.");
            const detail = error?.stack || message;
            if (result.status !== "TIMEOUT") result.status = "FAIL";
            result.error = [result.error, `${label}: ${detail}`].filter(Boolean).join("\n\n");
            result.logs ||= [];
            result.logs.push(`${label}: ${message}`);
            if (Array.isArray(devTraceCapture) && devTraceCapture.length) {
                result.devTraceCapture ||= [];
                result.devTraceCapture.push(...devTraceCapture);
            }
        }

        function formatSmokeSuiteReport(suite) {
            const results = suite.results || [];
            const planned = Math.max(
                results.length,
                Number(suite.plannedScenarioCount) || Number(suite.totalScenarios) || 0,
            );
            const notRun = Math.max(0, planned - results.length);
            const passed = results.filter((item) => item.status === "PASS").length;
            const failedResults = results.filter((item) => item.status === "FAIL");
            const failedNumbers = failedResults.map((item) => item.index).join(", ");
            const timedOutResults = results.filter((item) => item.status === "TIMEOUT");
            const timedOutNumbers = timedOutResults
                .map((item) => item.index)
                .join(", ");
            const skipped = results.filter((item) => item.status === "SKIPPED").length;
            const totalDuration = results.reduce(
                (sum, item) => sum + (Number(item.durationMs) || 0),
                0,
            );
            const lines = [
                "EmberAdventures Smoke Test Report",
                `Build: ${emberAdventuresBuildInfo().buildId}`,
                `Source hash: ${emberAdventuresBuildInfo().sourceHash}`,
                `Private test build: ${emberAdventuresBuildInfo().privateTests}`,
                `Started: ${suite.startedAt || ""}`,
                `Finished: ${suite.finishedAt || ""}`,
                `Total: ${planned}`,
                `Executed: ${results.length}`,
                `Passed: ${passed}`,
                `Failed: ${failedResults.length}${failedNumbers ? ` (smokes: ${failedNumbers})` : ""}`,
                `Timed out: ${timedOutResults.length}${timedOutNumbers ? ` (smokes: ${timedOutNumbers})` : ""}`,
                `Skipped: ${skipped}`,
                `Not run: ${notRun}`,
                ...(suite.stoppedEarlyReason
                    ? [`Stopped early: ${suite.stoppedEarlyReason}`]
                    : []),
                `Total duration: ${formatDurationMs(totalDuration)}`,
                ...(suite.finalCleanupStageTimings?.length
                    ? [
                          `Final cleanup: ${formatDurationMs(
                              suite.finalCleanupStageTimings.reduce(
                                  (total, timing) =>
                                      total + (Number(timing.durationMs) || 0),
                                  0,
                              ),
                          )}`,
                      ]
                    : []),
                "",
                "Summary",
                "=======",
            ];
            for (const result of results) {
                lines.push(
                    `${result.index}. [${result.status}] ${result.id} (${formatDurationMs(result.durationMs)})`,
                );
                if (result.error) lines.push(`   Error: ${result.error}`);
            }
            if (suite.finalCleanupStageTimings?.length) {
                lines.push("", "Final cleanup stages:");
                for (const timing of suite.finalCleanupStageTimings)
                    lines.push(
                        `  ${formatDurationMs(timing.durationMs || 0)} - ${timing.stage}`,
                    );
            }
            lines.push("", "Details", "=======");
            for (const result of results) {
                lines.push(
                    "",
                    `===== ${result.index}. ${result.id} - ${result.status} =====`,
                    `Started: ${result.startedAt || ""}`,
                    `Finished: ${result.finishedAt || ""}`,
                    `Duration: ${formatDurationMs(result.durationMs)}`,
                    `Execution: ${formatDurationMs(result.executionDurationMs ?? result.durationMs)}`,
                    `Cleanup: ${formatDurationMs(result.cleanupDurationMs || 0)}`,
                    `Timeout limit: ${formatDurationMs(result.timeoutMs)}`,
                );
                if (result.cleanupStageTimings?.length) {
                    lines.push("Cleanup stages:");
                    for (const timing of result.cleanupStageTimings)
                        lines.push(
                            `  ${formatDurationMs(timing.durationMs || 0)} - ${timing.stage}`,
                        );
                }
                if (result.live) lines.push("Live plugin use: yes");
                if (result.error) lines.push("", "Error:", result.error);
                lines.push("", "Smoke log:");
                if (result.logs?.length) {
                    for (const logLine of result.logs) lines.push(`  ${logLine}`);
                } else {
                    lines.push("  No smoke log lines were recorded.");
                }
                if (
                    result.status !== "PASS" &&
                    Array.isArray(result.devTraceCapture) &&
                    result.devTraceCapture.length
                ) {
                    lines.push(
                        "",
                        "Full Dev Log Capture",
                        "====================",
                        formatDevTraceText(result.devTraceCapture),
                    );
                }
            }
            return lines.join("\n");
        }

        function smokeSkipError(message = "Smoke skipped.") {
            const err = new Error(message);
            err.smokeSkipped = true;
            return err;
        }

        function compactPassingSmokeLogs(logs = []) {
            const source = Array.isArray(logs) ? logs : [];
            const maxLines = 30;
            const maxChars = 12000;
            const compact = [];
            let usedChars = 0;
            for (const line of source) {
                const text = String(line || "");
                const remaining = maxChars - usedChars;
                if (compact.length >= maxLines || remaining <= 0) break;
                const trimmed =
                    text.length > remaining
                        ? `${text.slice(0, Math.max(0, remaining - 32))}... [truncated]`
                        : text;
                compact.push(trimmed);
                usedChars += trimmed.length;
            }
            if (source.length > compact.length) {
                compact.push(
                    `... ${source.length - compact.length} additional passing smoke log lines omitted. Full dev trace is captured only for failures.`,
                );
            }
            return compact;
        }

        function smokeReportLogDataSummary(data) {
            if (data == null || typeof data !== "object") return data;
            if (Array.isArray(data)) return `[${data.length} items]`;
            const summary = {};
            const entries = Object.entries(data);
            for (const [key, value] of entries.slice(0, 12)) {
                if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
                    const text = typeof value === "string" ? value : null;
                    summary[key] = text && text.length > 240
                        ? `${text.slice(0, 240)}...`
                        : value;
                } else if (Array.isArray(value)) {
                    summary[key] = `[${value.length} items]`;
                } else {
                    summary[key] = "[object]";
                }
            }
            if (entries.length > 12) summary.__moreKeys = entries.length - 12;
            return summary;
        }

        function downloadSmokeSuiteReport(reportText = "") {
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const blob = new Blob([String(reportText || "")], {
                type: "text/plain",
            });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-smoke-report-${stamp}.txt`;
            a.click();
        }

        function smokeSuiteSummaryText(suite, label = "Smoke tests") {
            const results = suite.results || [];
            const planned = Math.max(
                results.length,
                Number(suite.plannedScenarioCount) || Number(suite.totalScenarios) || 0,
            );
            const passed = results.filter((item) => item.status === "PASS").length;
            const failed = results.filter(
                (item) => item.status === "FAIL" || item.status === "TIMEOUT",
            ).length;
            const skipped = results.filter((item) => item.status === "SKIPPED").length;
            const notRun = Math.max(0, planned - results.length);
            return `${label}: ${passed}/${planned} passed${failed ? `; ${failed}/${planned} failed` : ""}${skipped ? `; ${skipped}/${planned} skipped` : ""}${notRun ? `; ${notRun}/${planned} not run` : ""}${suite.stoppedEarlyReason ? ` (${suite.stoppedEarlyReason})` : ""}.`;
        }

        function renderDevSmokeSuiteStatus() {
            const suite = devSmokeSuiteState();
            const box = $("smokeSuiteStatus");
            if (box) {
                const results = suite.results || [];
                const last = results[results.length - 1];
                if (suite.running) {
                    const progress = String(suite.currentScenarioProgress || "").trim();
                    box.textContent = `Running ${suite.currentScenario || "smoke suite"}${progress ? `: ${progress}` : "..."} ${results.length}/${suite.totalScenarios || devSmokeScenariosForMode("all").length} finished.`;
                } else if (suite.lastSummary) {
                    box.textContent = suite.lastSummary;
                } else if (last) {
                    box.textContent = smokeSuiteSummaryText(
                        suite,
                        "Last run finished",
                    );
                } else {
                    box.textContent = "Ready.";
                }
            }
            for (const button of document.querySelectorAll("[data-smoke-run]"))
                button.disabled = !!suite.running;
            const downloadButton = $("downloadSmokeReportBtn");
            if (downloadButton) downloadButton.disabled = !suite.report;
        }

        async function setDevSmokeScenarioProgress(message = "") {
            const suite = devSmokeSuiteState();
            suite.currentScenarioProgress = String(message || "").trim();
            renderDevSmokeSuiteStatus();
            // Let the status paint before a deliberately large synchronous smoke
            // phase starts, so its progress is observable instead of looking hung.
            await new Promise((resolve) =>
                requestAnimationFrame(() => setTimeout(resolve, 0)),
            );
        }

        function renderDevSmokeScenarioList() {
            return devSmokeScenariosForMode("all")
                .map((scenario) => {
                    const meta = devSmokeScenarioMeta(scenario);
                    const number = Number(scenario.number || 0);
                    return `
                        <div class="smoke-suite-row">
                            <span class="smoke-suite-number">${number ? `${number}.` : ""}</span>
                            <span class="smoke-suite-name">${escapeHtml(scenario.id)}</span>
                            <span class="smoke-tier ${meta.tierClass}">${escapeHtml(meta.tier)}</span>
                            <span class="smoke-suite-time">${escapeHtml(meta.expectedText)}</span>
                            <button type="button" data-smoke-run="single" data-smoke-id="${escapeHtml(scenario.id)}">Run</button>
                        </div>
                    `;
                })
                .join("");
        }

        function renderExtensiveSupabaseScenarioList() {
            return devSmokeScenariosForMode("extensive-supabase")
                .map((scenario, index) => {
                    const meta = devSmokeScenarioMeta(scenario);
                    return `
                        <div class="smoke-suite-row">
                            <span class="smoke-suite-number">S${index + 1}.</span>
                            <span class="smoke-suite-name">${escapeHtml(scenario.id)}</span>
                            <span class="smoke-tier long">Extensive</span>
                            <span class="smoke-suite-time">${escapeHtml(meta.expectedText)}</span>
                            <button type="button" data-smoke-run="single" data-smoke-id="${escapeHtml(scenario.id)}">Run</button>
                        </div>
                    `;
                })
                .join("");
        }

        function openDevSmokeSuiteModal() {
            const suite = devSmokeSuiteState();
            openModal(`
                <h2>Smoke Tests</h2>
                <p class="hint">Short smokes should finish in about 15 seconds or less. Medium smokes should finish within about 60 seconds.</p>
                <p id="smokeSuiteStatus" class="hint">Ready.</p>
                <div class="row" style="margin-top: .8rem">
                    <button type="button" data-smoke-run="quick" onclick="EmberAdventures.runQuickDevSmokeScenarios()">Run Quick Smokes</button>
                    <button type="button" data-smoke-run="medium" onclick="EmberAdventures.runMediumDevSmokeScenarios()">Run Medium Smokes</button>
                    <button type="button" data-smoke-run="short-medium" onclick="EmberAdventures.runShortMediumDevSmokeScenarios()">Run Short + Medium Smokes</button>
                    <button type="button" data-smoke-run="public-hosting" onclick="EmberAdventures.runPublicHostingSmokeScenarios()">Run Public Hosting Smokes</button>
                    <button type="button" data-smoke-run="extensive-supabase" class="warn" onclick="EmberAdventures.runExtensiveSupabaseTests()">Run Extensive Supabase Tests</button>
                    <button type="button" data-smoke-run="all" class="primary" onclick="EmberAdventures.runAllDevSmokeScenarios()">Run All Smokes</button>
                    <button type="button" id="downloadSmokeReportBtn">Download Last Report</button>
                </div>
                <div class="row" style="margin-top: .6rem">
                    <input id="smokeScenarioListInput" type="text" placeholder="22, 30, 32, 33, 34, 35, 36" aria-label="Smoke numbers or names">
                    <button type="button" data-smoke-run="list" onclick="EmberAdventures.runListedDevSmokeScenarios()">Run Listed Smokes</button>
                </div>
                <div class="smoke-suite-list">
                    ${renderDevSmokeScenarioList()}
                </div>
                <h3 style="margin-top:1rem">Extensive Supabase Tests</h3>
                <p class="hint">Excluded from Run All. Uses the real signed-in Supabase account and disposable one-day Perchance uploads, stops at the first failure, and removes its remote test data.</p>
                <div class="row" style="margin-bottom: .6rem">
                    <input id="supabaseSmokeScenarioListInput" type="text" placeholder="1, 3 or extensive Supabase test names" aria-label="Extensive Supabase test numbers or names">
                    <button type="button" data-smoke-run="supabase-list" class="warn" onclick="EmberAdventures.runListedExtensiveSupabaseTests()">Run Listed Supabase Tests</button>
                </div>
                <div class="smoke-suite-list">
                    ${renderExtensiveSupabaseScenarioList()}
                </div>
            `);
            $("modalBox")?.setAttribute("data-smoke-suite-modal", "1");
            $("modalBox")?.querySelectorAll("[data-smoke-run='single'][data-smoke-id]").forEach((button) => {
                button.onclick = () => runDevSmokeScenarioById(button.dataset.smokeId || "");
            });
            $("downloadSmokeReportBtn").onclick = () =>
                downloadSmokeSuiteReport(devSmokeSuiteState().report || "");
            renderDevSmokeSuiteStatus();
        }

        function assertSmokeProfileStoreMatchesMemory(
            memoryProfiles = [],
            storedProfiles = [],
        ) {
            if (
                devExactProfileLibraryText(memoryProfiles) ===
                devExactProfileLibraryText(storedProfiles)
            )
                return true;
            const memoryById = new Map(memoryProfiles.map((profile) => [profile.id, profile]));
            const storedById = new Map(storedProfiles.map((profile) => [profile.id, profile]));
            const differences = [];
            for (const id of new Set([...memoryById.keys(), ...storedById.keys()])) {
                const memory = memoryById.get(id);
                const stored = storedById.get(id);
                const fields = memory && stored
                    ? [...new Set([...Object.keys(memory), ...Object.keys(stored)])].filter(
                        (key) => !smokeDurableValuesEqual(memory[key], stored[key]),
                    )
                    : [];
                if (!memory || !stored || fields.length)
                    differences.push({ id, memoryPresent: !!memory, storedPresent: !!stored, fields });
            }
            const detail = {
                memoryCount: memoryProfiles.length,
                storedCount: storedProfiles.length,
                differences,
                visibility: document.visibilityState,
            };
            devLog("Smoke profile preflight mismatch", detail);
            const error = new Error(
                "Smoke tests cannot start because the in-memory and stored user profiles differ. No profile data was changed. " +
                "The dev trace now includes the affected profile IDs and field names. Export it before reloading or editing profiles.",
            );
            error.smokeProfileMismatch = detail;
            throw error;
        }

        async function runDevSmokeScenarios(
            scenarios,
            suiteLabel = "Smoke Tests",
            options = {},
        ) {
            const suite = devSmokeSuiteState();
            if (app.smokeProfileStoreSandboxBlocked) {
                showSmokeSuiteFailClosedBlocker(
                    app.smokeProfileStoreSandboxBlockedScenario || "previous smoke timeout",
                );
                return suite;
            }
            if (suite.running)
                throw new Error(
                    `Smoke suite is already running${suite.currentScenario ? ` (${suite.currentScenario})` : ""}.`,
                );
            scenarios = Array.isArray(scenarios) ? scenarios.filter(Boolean) : [];
            if (!scenarios.length) {
                throw new Error("No smoke scenarios matched.");
            }
            // Refuse the run before smoke isolation can mutate or capture either
            // side of a profile mismatch. The visible in-memory profile and its
            // durable record are both user data; smoke setup must choose neither.
            await flushLargeSaves();
            assertSmokeProfileStoreMatchesMemory(
                app.userProfiles || [],
                validatedUserProfiles(await app.library.listProfiles()),
            );
            // Prepare from the user's run-button gesture so browsers permit the
            // short completion tone after the asynchronous suite finishes.
            prepareSmokeSuiteCompletionTone();
            app.smokeProtectedSaveIds = new Set(
                saveIndexRecords()
                    .map((record) => String(record?.saveId || "").trim())
                    .filter(Boolean),
            );
            suite.running = true;
            suite.label = suiteLabel;
            suite.totalScenarios = scenarios.length;
            suite.plannedScenarioCount = scenarios.length;
            suite.stoppedEarlyReason = "";
            suite.startedAt = new Date().toISOString();
            suite.finishedAt = "";
            suite.currentScenario = "suite-setup";
            suite.currentScenarioProgress = "Preparing smoke isolation";
            suite.results = [];
            suite.report = "";
            suite.lastSummary = "";
            suite.suppressResultNotices = scenarios.length > 1;
            writeDevSmokeRunPhase({ phase: suite.currentScenarioProgress });
            startDevSmokeRunHeartbeat();
            renderDevSmokeSuiteStatus();

            if (generateImageHtml === devSmokeFakeImageHtml)
                generateImageHtml = devProductionGenerateImageHtml;
            const originalDevTestLog = devTestLog;
            const originalSmokePatchedFunctions = {
                aiText,
                generationPreferences,
                showChoice,
                showConfirm,
                showNotice,
                showPrompt,
                processQueue,
                queueProfileImageIfMissing,
                enqueueStateSync,
                runImmediateChecksForMutatedMessage,
                generateImageHtml,
                publicLibraryFetch,
                fetchPublicLibraryIndex,
                replacePublicLibraryIndex,
                fetchJsonFromPublicUploadUrl,
                windowFetch: window.fetch,
                publicLibrarySupabaseUrl: app.settings.publicLibrarySupabaseUrl,
                publicLibrarySupabaseAnonKey: app.settings.publicLibrarySupabaseAnonKey,
                supabaseSession: app.supabaseSession ? clone(app.supabaseSession) : null,
            };
            let smokeScenarioSettlementBlocked = false;
            let smokeScenarioSettlementBlockedId = "";
            const restoreSmokePatchedFunctions = () => {
                aiText = originalSmokePatchedFunctions.aiText;
                generationPreferences = originalSmokePatchedFunctions.generationPreferences;
                showChoice = originalSmokePatchedFunctions.showChoice;
                showConfirm = originalSmokePatchedFunctions.showConfirm;
                showNotice = originalSmokePatchedFunctions.showNotice;
                showPrompt = originalSmokePatchedFunctions.showPrompt;
                processQueue = originalSmokePatchedFunctions.processQueue;
                queueProfileImageIfMissing =
                    originalSmokePatchedFunctions.queueProfileImageIfMissing;
                enqueueStateSync = originalSmokePatchedFunctions.enqueueStateSync;
                runImmediateChecksForMutatedMessage =
                    originalSmokePatchedFunctions.runImmediateChecksForMutatedMessage;
                generateImageHtml = originalSmokePatchedFunctions.generateImageHtml;
                publicLibraryFetch = originalSmokePatchedFunctions.publicLibraryFetch;
                fetchPublicLibraryIndex =
                    originalSmokePatchedFunctions.fetchPublicLibraryIndex;
                replacePublicLibraryIndex =
                    originalSmokePatchedFunctions.replacePublicLibraryIndex;
                fetchJsonFromPublicUploadUrl =
                    originalSmokePatchedFunctions.fetchJsonFromPublicUploadUrl;
                window.fetch = originalSmokePatchedFunctions.windowFetch;
                app.settings.publicLibrarySupabaseUrl =
                    originalSmokePatchedFunctions.publicLibrarySupabaseUrl;
                app.settings.publicLibrarySupabaseAnonKey =
                    originalSmokePatchedFunctions.publicLibrarySupabaseAnonKey;
                app.supabaseSession = originalSmokePatchedFunctions.supabaseSession
                    ? clone(originalSmokePatchedFunctions.supabaseSession)
                    : null;
            };
            app.smokeImageIsolationBaseline = null;
            await devWithSmokeRestorePhase(async () => {
                suite.currentScenarioProgress = "Cleaning previous smoke artifacts";
                originalDevTestLog("Smoke baseline: cleaning hosted uploads");
                if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true)
                    await devCleanupSmokeHostedUploads("before smoke suite baseline");
                originalDevTestLog("Smoke baseline: cleaning scenario UI");
                cleanupSmokeScenarioUi();
                originalDevTestLog("Smoke baseline: cleaning stored artifacts");
                if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true)
                    await devCleanupAbandonedSmokeArtifactsBeforeSuite();
                originalDevTestLog("Smoke baseline: cleanup complete");
            });
            const imageIsolation = await app.persistence.beginSmokeImageIsolation(
                `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            );
            const privateNormalizedTestBuild =
                globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true;
            app.smokeImageIsolationBaseline = imageIsolation.baseline;
            if (
                !safeSetStorageItem(
                    DEV_SMOKE_IMAGE_BASELINE_KEY,
                    JSON.stringify(imageIsolation.baseline),
                )
            )
                throw new Error(
                    "Smoke tests cannot start because their exact image-store baseline could not be persisted.",
                );
            originalDevTestLog(
                "Smoke baseline: protected normalized image stores",
                imageIsolation.counts,
            );
            suite.currentScenarioProgress = "Capturing smoke baseline";
            writeDevSmokeRunPhase({ phase: suite.currentScenarioProgress });
            originalDevTestLog("Smoke baseline: capturing runtime libraries");
            const storedStoryTemplatesForBaseline = await loadPerRecordLibrary(
                STORY_TEMPLATE_KEY,
                app.storyTemplates || [],
                { deferStoryValidation: true },
            );
            const originalStoryTemplates = storedStoryTemplatesForBaseline.map(
                (template) => {
                    const hydrated = (app.storyTemplates || []).find(
                        (record) =>
                            libraryRecordStorageId(STORY_TEMPLATE_KEY, record) ===
                            libraryRecordStorageId(STORY_TEMPLATE_KEY, template),
                    );
                    return copyValidatedStoryDefinitionArtifact(
                        hydrated || template,
                        devSmokeClone(template),
                    );
                },
            );
            const originalStoryTitleCardImages = devSmokeClone(
                await loadPerRecordLibrary(
                    STORY_TITLE_CARD_IMAGE_KEY,
                    app.storyTitleCardImages || [],
                ),
            );
            const originalCharacterDefinitions = devSmokeClone(
                await loadPerRecordLibrary(
                    CHARACTER_LIBRARY_KEY,
                    app.characterDefinitions || [],
                    { deferDefinitionValidation: true },
                ),
            );
            // The persistence worker already protects every existing image key.
            // Cloning the complete profile-image library here can duplicate
            // hundreds of megabytes in the renderer for large user libraries.
            const originalProfileImages = privateNormalizedTestBuild
                ? devSmokeClone(
                      await loadPerRecordLibrary(
                          PROFILE_IMAGE_KEY,
                          app.profileImages || [],
                      ),
                  )
                : null;
            // Durable image keys are protected in the persistence worker. Keep
            // the renderer's existing record references so final cleanup can
            // restore its catalog without another per-record database scan.
            const originalProfileImageRuntimeRecords = privateNormalizedTestBuild
                ? null
                : [...(app.profileImages || [])];
            // A UI save can still be queued when the user starts a smoke run.
            // Settle it before comparing memory with the normalized profile store.
            await flushLargeSaves();
            const originalStoredProfiles = validatedUserProfiles(
                await app.library.listProfiles(),
            );
            assertSmokeProfileStoreMatchesMemory(
                app.userProfiles || [],
                originalStoredProfiles,
            );
            const originalProfileLibrary = devProfileLibrarySnapshotForSmoke();
            const originalPublicLibraryRuntime =
                devPublicLibraryRuntimeSnapshotForSmoke();
            const originalSaveLibrary = devSaveLibrarySnapshotForSmoke();
            const persistentLibraryIds = privateNormalizedTestBuild
                ? null
                : {
                      storyTemplates: await devPersistentLibraryIdsForSmoke(
                          STORY_TEMPLATE_KEY,
                          app.storyTemplates || [],
                          { deferStoryValidation: true },
                      ),
                      storyTitleCardImages: await devPersistentLibraryIdsForSmoke(
                          STORY_TITLE_CARD_IMAGE_KEY,
                          app.storyTitleCardImages || [],
                      ),
                      characterDefinitions: await devPersistentLibraryIdsForSmoke(
                          CHARACTER_LIBRARY_KEY,
                          app.characterDefinitions || [],
                      ),
                      profileImages: [
                          ...(imageIsolation.baseline?.characterProfileImages || []),
                      ].map((id) => String(id || "")).filter(Boolean),
                  };
            originalDevTestLog("Smoke baseline: capturing persistent storage");
            const originalPersistentStorage = privateNormalizedTestBuild
                ? { local: {}, large: {} }
                : await devPersistentStorageSnapshotForSmoke();
            originalDevTestLog("Smoke baseline: persistent storage captured");
            const smokeProfileStoreSandbox = devInstallSmokeProfileStoreSandbox(
                originalStoredProfiles,
            );
            suite.currentScenarioProgress = "Smoke baseline ready";
            const originalLibrarySnapshot = {
                storyTemplates: originalStoryTemplates,
                storyTitleCardImages: originalStoryTitleCardImages,
                characterDefinitions: originalCharacterDefinitions,
                profileImages: originalProfileImages,
                profileImageRuntimeRecords: originalProfileImageRuntimeRecords,
                profileLibrary: originalProfileLibrary,
                publicLibraryRuntime: originalPublicLibraryRuntime,
                saveLibrary: originalSaveLibrary,
                persistentLibraryIds,
            };
            app.smokeProtectedLibraryIds = {
                story: new Set(
                    originalStoryTemplates
                        .map((record) =>
                            String(
                                libraryRecordStorageId(STORY_TEMPLATE_KEY, record) || "",
                            ),
                        )
                        .filter(Boolean),
                ),
                character: new Set(
                    originalCharacterDefinitions
                        .map((record) =>
                            String(
                                libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || "",
                            ),
                        )
                        .filter(Boolean),
                ),
            };
            app.smokeProtectedSaveIds = new Set(
                (originalSaveLibrary.saveIndex || [])
                    .map((record) => String(record?.saveId || "").trim())
                    .filter(Boolean),
            );
            if (
                !safeSetStorageItem(
                    DEV_SMOKE_IMAGE_BASELINE_KEY,
                    JSON.stringify({
                        version: 1,
                        images: app.smokeImageIsolationBaseline,
                        storyTemplates:
                            persistentLibraryIds?.storyTemplates ||
                            originalStoryTemplates
                                .map((record) =>
                                    libraryRecordStorageId(STORY_TEMPLATE_KEY, record),
                                )
                                .filter(Boolean),
                        storyTitleCardImages:
                            persistentLibraryIds?.storyTitleCardImages ||
                            originalStoryTitleCardImages
                                .map((record) =>
                                    libraryRecordStorageId(
                                        STORY_TITLE_CARD_IMAGE_KEY,
                                        record,
                                    ),
                                )
                                .filter(Boolean),
                        characterDefinitions:
                            persistentLibraryIds?.characterDefinitions ||
                            originalCharacterDefinitions
                                .map((record) =>
                                    libraryRecordStorageId(
                                        CHARACTER_LIBRARY_KEY,
                                        record,
                                    ),
                                )
                                .filter(Boolean),
                        profileImages:
                            persistentLibraryIds?.profileImages ||
                            originalProfileImages
                                .map((record) =>
                                    libraryRecordStorageId(PROFILE_IMAGE_KEY, record),
                                )
                                .filter(Boolean),
                        userProfiles: originalStoredProfiles.map((profile) => profile.id),
                        saves: [...app.smokeProtectedSaveIds],
                    }),
                )
            )
                throw new Error(
                    "Smoke tests cannot start because their complete persistent baseline could not be saved.",
                );
            let currentLogBuffer = [];
            devTestLog = (label, data = {}) => {
                let line = String(label || "");
                try {
                    if (data && typeof data === "object" && Object.keys(data).length)
                        line = `${line} ${JSON.stringify(smokeReportLogDataSummary(data))}`;
                    else if (data && typeof data !== "object")
                        line = `${line} ${String(data)}`;
                } catch (err) {
                    line = `${line} [smoke log detail omitted: ${err?.message || String(err)}]`;
                }
                currentLogBuffer.push(line);
                originalDevTestLog(label, data);
            };

            try {
                for (let index = 0; index < scenarios.length; index += 1) {
                    const scenario = scenarios[index];
                    const timeoutMs = devSmokeSuiteTimeoutMs(scenario);
                    await flushLargeSaves();
                    if (
                        app.persistence?.activeSaveState &&
                        app.state?.meta?.smoke_test_runtime
                    ) {
                        await app.persistence.abandonActiveSaveForTest();
                        app.saveSessionActive = false;
                        app.saveSessionContext = null;
                        cancelSaveProjectionFlush();
                    }
                    const startedAt = new Date().toISOString();
                    const startMs = performance.now();
                    currentLogBuffer = [];
                    root.__emberAdventuresLiveTestLog = [];
                    const liveTestMarker = document.getElementById(
                        "__emberadventureslite-live-test-log",
                    );
                    if (liveTestMarker) liveTestMarker.textContent = "";
                    app.smokeDevTraceCapture = [];
                    app.smokeDevTraceCaptureNextId = 1;
                    app.emergencyExportFallbackShown = null;
                    document.getElementById("emberAdventuresEmergencyExport")?.remove();
                    suite.currentScenario = scenario.id;
                    suite.currentScenarioProgress = "";
                    suite.currentScenarioConfig = scenario;
                    //Synthetic and real-Perchance smokes must not inherit a paid hosting launch.
                    generationPreferences = () => ({text: "game", image: "perchance", proxyUrl: "http://127.0.0.1:51840"});
                    writeDevSmokeRunPhase({
                        scenarioNumber: scenario.number || index + 1,
                        phase: "running scenario",
                        startedAt,
                    });
                    generateImageHtml = scenario.allowRealImages || scenario.allowSmokeImagePlugin
                        ? originalSmokePatchedFunctions.generateImageHtml
                        : devSmokeFakeImageHtml;
                    devSelectProfileForSmokeScenario(scenario);
                    renderDevSmokeSuiteStatus();
                    await devSmokeSettle();
                    let timeoutId = null;
                    let status = "PASS";
                    let error = "";
                    const smokeToken = devBeginSmokeScenarioToken(scenario.id);
                    let scenarioPromise = null;
                    try {
                        if (
                            scenario.live &&
                            /^(?:localhost|127(?:\.\d+){3})$/i.test(
                                window.location.hostname,
                            )
                        )
                            throw smokeSkipError(
                                "Live Perchance plugin smoke is unavailable from the local test harness.",
                            );
                        scenarioPromise = Promise.resolve().then(() => scenario.run());
                        await Promise.race([
                            scenarioPromise,
                            new Promise((_, reject) => {
                                const tick = () => {
                                    if (!devSmokeScenarioTokenIsCurrent(smokeToken)) return;
                                    if (app.emergencyExportFallbackShown) {
                                        reject(
                                            new Error(
                                                `Smoke scenario opened EmberAdventures Error Recovery: ${app.emergencyExportFallbackShown.reason || "No reason supplied."}`,
                                            ),
                                        );
                                        return;
                                    }
                                    setTimeout(tick, 100);
                                };
                                tick();
                            }),
                            new Promise((_, reject) => {
                                timeoutId = setTimeout(() => {
                                    devCancelSmokeScenarioToken(
                                        smokeToken,
                                        `smoke suite timed out ${scenario.id}`,
                                    );
                                    reject(
                                        new Error(
                                            `Smoke scenario exceeded ${formatDurationMs(timeoutMs)}.`,
                                        ),
                                    );
                                }, timeoutMs);
                            }),
                        ]);
                        if (app.emergencyExportFallbackShown) {
                            devTestLog(
                                "Smoke scenario showed EmberAdventures Error Recovery",
                                app.emergencyExportFallbackShown,
                            );
                            throw new Error(
                                `Smoke scenario opened EmberAdventures Error Recovery: ${app.emergencyExportFallbackShown.reason || "No reason supplied."}`,
                            );
                        }
                    } catch (err) {
                        if (err?.smokeSkipped) {
                            status = "SKIPPED";
                            cancelSmokeSuiteScenarioWork(
                                `smoke suite skipped ${scenario.id}`,
                            );
                        } else if (/exceeded/i.test(err?.message || "")) {
                            status = "TIMEOUT";
                            cancelSmokeSuiteScenarioWork(
                                `smoke suite timed out ${scenario.id}`,
                            );
                        } else {
                            status = "FAIL";
                            cancelSmokeSuiteScenarioWork(
                                `smoke suite failed ${scenario.id}`,
                            );
                        }
                        error = err?.smokeSkipped
                            ? err?.message || String(err)
                            : err?.stack || err?.message || String(err);
                    } finally {
                        if (timeoutId) clearTimeout(timeoutId);
                        if (status !== "PASS" && scenarioPromise) {
                            const settlement =
                                await awaitSmokeScenarioSettlementBeforeTeardown(
                                    scenarioPromise,
                                    scenario.id,
                                );
                            if (!settlement.settled) {
                                smokeScenarioSettlementBlocked = true;
                                smokeScenarioSettlementBlockedId = scenario.id;
                                app.smokeProfileStoreSandboxBlockedScenario = scenario.id;
                                error = `${error}\n\nTimed-out smoke scenario did not settle within ${formatDurationMs(DEV_SMOKE_SCENARIO_SETTLEMENT_GRACE_MS)}. Smoke cleanup was stopped before restoring the real profile store methods; reload the app before retrying.`;
                            }
                            else if (status === "TIMEOUT" && settlement.error) {
                                const lateError =
                                    settlement.error?.stack ||
                                    settlement.error?.message ||
                                    String(settlement.error);
                                error = `${error}\n\nTimed-out smoke scenario settlement error:\n${lateError}`;
                                devTestLog(
                                    "Timed-out smoke scenario settled with an error",
                                    lateError,
                                );
                            }
                        }
                        devCancelSmokeScenarioToken(
                            smokeToken,
                            `smoke suite finished ${scenario.id}`,
                        );
                    }
                    if (!smokeScenarioSettlementBlocked) {
                        try {
                            await flushLargeSaves();
                            await devAssertSmokeProfilePreferencesUnchanged(
                                originalProfileLibrary,
                            );
                        } catch (profilePreferenceError) {
                            const preferenceError =
                                profilePreferenceError?.stack ||
                                profilePreferenceError?.message ||
                                String(profilePreferenceError);
                            if (status === "PASS") {
                                status = "FAIL";
                                error = preferenceError;
                            } else {
                                error = `${error}\n\nProfile preference integrity failure:\n${preferenceError}`;
                            }
                            devTestLog(
                                "Smoke profile preference integrity failed",
                                profilePreferenceError?.message ||
                                    String(profilePreferenceError),
                            );
                        }
                    }
                    const finishedAt = new Date().toISOString();
                    const devTraceCapture = [...(app.smokeDevTraceCapture || [])];
                    const logs =
                        status === "PASS"
                            ? compactPassingSmokeLogs(currentLogBuffer)
                            : [...currentLogBuffer];
                    const scenarioResult = {
                        index: scenario.number || index + 1,
                        id: scenario.id,
                        live: !!scenario.live,
                        status,
                        error,
                        startedAt,
                        finishedAt,
                        executionDurationMs: Math.round(performance.now() - startMs),
                        cleanupDurationMs: 0,
                        cleanupStageTimings: [],
                        durationMs: Math.round(performance.now() - startMs),
                        timeoutMs,
                        logs,
                        devTraceCapture: status === "PASS" ? [] : devTraceCapture,
                    };
                    suite.results.push(scenarioResult);
                    if (smokeScenarioSettlementBlocked) {
                        suite.currentScenarioConfig = null;
                        suite.currentScenarioProgress = "Smoke suite blocked; reload required";
                        suite.stoppedEarlyReason =
                            `stopped after ${scenario.id}: scenario did not settle before teardown grace period`;
                        renderDevSmokeSuiteStatus();
                        break;
                    }
                    app.smokeDevTraceCapture = null;
                    app.smokeDevTraceCaptureNextId = 1;
                    if (status !== "PASS")
                        cancelSmokeSuiteScenarioWork(
                            `smoke suite continuing after ${scenario.id} ${status.toLowerCase()}`,
                        );
                    suite.currentScenarioConfig = null;
                    suite.currentScenarioProgress = "";
                    const preservedRefreshedSupabaseSession =
                        scenario.live &&
                        devPreserveRefreshedSupabaseSessionForSmoke(
                            originalPersistentStorage,
                        );
                    if (preservedRefreshedSupabaseSession) {
                        originalSmokePatchedFunctions.supabaseSession = clone(
                            app.supabaseSession,
                        );
                        originalDevTestLog(
                            "Smoke cleanup: preserving live Supabase session result",
                            {
                                scenario: scenario.id,
                                signedIn: !!app.supabaseSession?.access_token,
                                userId: app.supabaseSession?.user?.id || "",
                            },
                        );
                    }
                    restoreSmokePatchedFunctions();
                    let scenarioCleanupFailed = false;
                    const cleanupStartedMs = performance.now();
                    try {
                        suite.currentScenarioProgress = "Cleaning scenario artifacts";
                        writeDevSmokeRunPhase({ phase: suite.currentScenarioProgress });
                        scenarioResult.cleanupStageTimings = await devRestoreSmokeScenarioBaseline(
                            originalLibrarySnapshot,
                            originalPersistentStorage,
                            `smoke scenario ${scenario.id} baseline restored`,
                        );
                    } catch (cleanupErr) {
                        scenarioResult.cleanupStageTimings = clone(
                            cleanupErr?.smokeCleanupStageTimings || [],
                        );
                        scenarioCleanupFailed = cleanupErr?.smokeCleanupRecovered !== true;
                        attachSmokeInfrastructureFailure(
                            scenarioResult,
                            scenarioCleanupFailed
                                ? "Scenario cleanup failed"
                                : "Scenario cleanup required catch-all recovery",
                            cleanupErr,
                            app.smokeDevTraceCapture || [],
                        );
                    }
                    scenarioResult.cleanupDurationMs = Math.round(
                        performance.now() - cleanupStartedMs,
                    );
                    scenarioResult.durationMs =
                        scenarioResult.executionDurationMs +
                        scenarioResult.cleanupDurationMs;
                    scenarioResult.finishedAt = new Date().toISOString();
                    suite.currentScenarioProgress = "";
                    renderDevSmokeSuiteStatus();
                    if (
                        scenarioCleanupFailed ||
                        (options.abortOnFailure === true &&
                            scenarioResult.status !== "PASS")
                    ) {
                        suite.stoppedEarlyReason = scenarioCleanupFailed
                            ? `stopped after ${scenario.id}: scenario cleanup failed`
                            : `stopped after ${scenario.id}: abort-on-failure`;
                        break;
                    }
                }
            } finally {
                if (smokeScenarioSettlementBlocked) {
                    suite.currentScenarioConfig = null;
                    suite.currentScenario = "suite-blocked";
                    suite.currentScenarioProgress = "Reload required";
                    suite.running = false;
                    suite.finishedAt = new Date().toISOString();
                    clearDevSmokeRunPhase();
                    suite.report = formatSmokeSuiteReport(suite);
                    suite.lastSummary = smokeSuiteSummaryText(suite, suiteLabel);
                    try {
                        downloadSmokeSuiteReport(suite.report);
                    } catch (reportError) {
                        originalDevTestLog(
                            "Smoke suite fail-closed report download failed",
                            reportError?.message || String(reportError),
                        );
                    }
                    showSmokeSuiteFailClosedBlocker(smokeScenarioSettlementBlockedId);
                    originalDevTestLog(
                        "Smoke suite stopped with an unsettled scenario; profile store sandbox retained",
                        {
                            scenario: smokeScenarioSettlementBlockedId,
                            message:
                                "The app is blocked until reload; no smoke cleanup or profile method restoration was performed.",
                        },
                    );
                    renderDevSmokeSuiteStatus();
                    return suite;
                }
                restoreSmokePatchedFunctions();
                suite.currentScenarioConfig = null;
                try {
                    suite.currentScenario = "suite-finalize";
                    suite.currentScenarioProgress = "Restoring smoke baseline";
                    writeDevSmokeRunPhase({ phase: suite.currentScenarioProgress });
                    suite.finalCleanupStageTimings =
                        await devRestoreAndVerifySmokeBaseline(
                        originalLibrarySnapshot,
                        originalPersistentStorage,
                        "smoke suite final baseline restored",
                    );
                } catch (cleanupErr) {
                    attachSmokeInfrastructureFailure(
                        suite.results[suite.results.length - 1],
                        "Final smoke cleanup failed",
                        cleanupErr,
                        app.smokeDevTraceCapture || [],
                    );
                } finally {
                    smokeProfileStoreSandbox.restore();
                }
                try {
                    await devAssertExactProfileLibrarySnapshotForSmoke(
                        originalProfileLibrary,
                    );
                } catch (profileCleanupErr) {
                    attachSmokeInfrastructureFailure(
                        suite.results[suite.results.length - 1],
                        "Real profile store changed during smoke tests",
                        profileCleanupErr,
                        app.smokeDevTraceCapture || [],
                    );
                }
                const smokeIsolationErrors = [];
                const expectedActiveSaveId = String(originalSaveLibrary.activeSaveId || "").trim();
                const restoredActiveSaveId = String(activeSaveId() || "").trim();
                if (restoredActiveSaveId !== expectedActiveSaveId) {
                    smokeIsolationErrors.push(
                        `Active save changed after smoke restore: expected "${expectedActiveSaveId}", got "${restoredActiveSaveId}".`,
                    );
                }
                const expectedPlayerName = textSlot(
                    originalSaveLibrary.runtime?.state?.player?.name,
                    "",
                );
                const restoredPlayerName = textSlot(app.state?.player?.name, "");
                if (expectedActiveSaveId && expectedPlayerName && restoredPlayerName !== expectedPlayerName) {
                    smokeIsolationErrors.push(
                        `Active player changed after smoke restore: expected "${expectedPlayerName}", got "${restoredPlayerName}".`,
                    );
                }
                if (app.state?.meta?.smoke_test_runtime) {
                    smokeIsolationErrors.push(
                        "Smoke test runtime flag was still present after smoke restore.",
                    );
                }
                if (smokeIsolationErrors.length) {
                    devTestLog("Smoke save isolation failed", {
                        errors: smokeIsolationErrors,
                        expectedActiveSaveId,
                        restoredActiveSaveId,
                        expectedPlayerName,
                        restoredPlayerName,
                    });
                    attachSmokeInfrastructureFailure(
                        suite.results[suite.results.length - 1],
                        "Smoke save isolation failed",
                        new Error(smokeIsolationErrors.join("\n")),
                        app.smokeDevTraceCapture || [],
                    );
                }
                devTestLog = originalDevTestLog;
                app.smokeProtectedSaveIds = null;
                app.smokeProtectedLibraryIds = null;
                app.smokeImageIsolationBaseline = null;
                try {
                    localStorage.removeItem(DEV_SMOKE_IMAGE_BASELINE_KEY);
                } catch {}
                app.smokeDevTraceCapture = null;
                app.smokeDevTraceCaptureNextId = 1;
                suite.running = false;
                suite.suppressResultNotices = false;
                suite.currentScenario = "";
                suite.currentScenarioProgress = "";
                suite.currentScenarioConfig = null;
                suite.finishedAt = new Date().toISOString();
                clearDevSmokeRunPhase();
                suite.report = formatSmokeSuiteReport(suite);
                suite.lastSummary = smokeSuiteSummaryText(suite, suiteLabel);
                renderDevSmokeSuiteStatus();
                downloadSmokeSuiteReport(suite.report);
                suite.report = "";
                renderDevSmokeSuiteStatus();
                returnToMainMenuAfterSmokeSuite();
                setTimeout(() => {
                    restoreSmokePatchedFunctions();
                    playSmokeSuiteCompletionTone();
                    showSmokeSuiteFinishedPopup(suite.lastSummary);
                }, 0);
            }
        }

        async function devRunSmokeTimeoutLifecycleRegression() {
            let nextScenarioStarted = false;
            let finishLateScenario = null;
            let sandboxProfileReader = null;
            const lateScenario = new Promise((resolve) => {
                finishLateScenario = resolve;
            });
            const result = await runDevSmokeScenarios(
                [
                    {
                        id: "synthetic-smoke-timeout-never-settles",
                        timeoutMs: 1,
                        run: () => {
                            sandboxProfileReader = app.library.listProfiles;
                            return lateScenario;
                        },
                    },
                    {
                        id: "synthetic-smoke-next-scenario",
                        run: () => {
                            nextScenarioStarted = true;
                        },
                    },
                ],
                "Smoke timeout lifecycle regression",
            );
            finishLateScenario();
            await lateScenario;
            await Promise.resolve();
            devAssert(
                result.results?.length === 1 &&
                    result.results[0]?.id === "synthetic-smoke-timeout-never-settles" &&
                    nextScenarioStarted === false &&
                    app.smokeProfileStoreSandboxBlocked === true &&
                    app.library.listProfiles === sandboxProfileReader &&
                    !!document.getElementById("emberAdventuresSmokeFailClosed"),
                "unsettled timeout blocks cleanup and the next scenario",
                {
                    resultCount: result.results?.length || 0,
                    resultId: result.results?.[0]?.id || "",
                    nextScenarioStarted,
                    sandboxBlocked: app.smokeProfileStoreSandboxBlocked === true,
                },
            );
            return result;
        }

        async function runAllDevSmokeScenarios() {
            return runDevSmokeScenarios(devSmokeScenariosForMode("all"), "All smoke tests");
        }

        async function runExtensiveSupabaseTests() {
            return runDevSmokeScenarios(
                devSmokeScenariosForMode("extensive-supabase"),
                "Extensive Supabase Tests",
                { abortOnFailure: true },
            );
        }

        async function runListedExtensiveSupabaseTests() {
            const raw = $("supabaseSmokeScenarioListInput")?.value || "";
            const keys = raw
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
            if (!keys.length) {
                showNotice(
                    "Extensive Supabase Tests",
                    "List at least one extensive Supabase test number or name.",
                );
                return;
            }
            const all = devSmokeScenariosForMode("extensive-supabase");
            const scenarios = [];
            const missing = [];
            for (const key of keys) {
                const relativeIndex = /^\d+$/.test(key) ? Number(key) - 1 : -1;
                const scenario = all.find((item) => item.id === key) ||
                    (relativeIndex >= 0 ? all[relativeIndex] : null);
                if (scenario && !scenarios.some((item) => item.id === scenario.id))
                    scenarios.push(scenario);
                else if (!scenario) missing.push(key);
            }
            if (missing.length) {
                showNotice(
                    "Extensive Supabase Tests",
                    `Unknown extensive Supabase test number/name: ${missing.join(", ")}`,
                );
                return;
            }
            return runDevSmokeScenarios(
                scenarios,
                "Listed Extensive Supabase Tests",
                { abortOnFailure: true },
            );
        }

        async function runQuickDevSmokeScenarios() {
            return runDevSmokeScenarios(
                devSmokeScenariosForMode("quick"),
                "Quick smoke tests",
            );
        }

        async function runMediumDevSmokeScenarios() {
            return runDevSmokeScenarios(
                devSmokeScenariosForMode("medium"),
                "Medium smoke tests",
            );
        }

        async function runShortMediumDevSmokeScenarios() {
            return runDevSmokeScenarios(
                devSmokeScenariosForMode("short-medium"),
                "Short and medium smoke tests",
            );
        }

        async function runPublicHostingSmokeScenarios() {
            return runDevSmokeScenarios(
                devSmokeScenariosForMode("public-hosting"),
                "Public hosting smoke tests",
            );
        }

        async function runListedDevSmokeScenarios() {
            const raw = $("smokeScenarioListInput")?.value || "";
            const keys = raw
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
            const all = devSmokeScenariosForMode("all");
            const scenarios = [];
            const missing = [];
            for (const key of keys) {
                const scenario = all.find(
                    (item) => item.id === key || String(item.number || "") === key,
                );
                if (scenario && !scenarios.some((item) => item.id === scenario.id))
                    scenarios.push(scenario);
                else if (!scenario) missing.push(key);
            }
            if (missing.length) {
                showNotice(
                    "Smoke Tests",
                    `Unknown smoke number/name: ${missing.join(", ")}`,
                );
                return;
            }
            return runDevSmokeScenarios(scenarios, "Listed smoke tests");
        }

        async function runDevSmokeScenarioById(id) {
            const key = String(id || "").trim();
            const scenario = devSmokeScenarioRegistry().find(
                (item) => item.id === key || String(item.number || "") === key,
            );
            return runDevSmokeScenarios(
                scenario ? [scenario] : [],
                `Smoke test: ${scenario ? `${scenario.number}. ${scenario.id}` : key}`,
            );
        }

        async function devRunSmokeSuiteRunnerSmokeTest() {
            const saveSnapshot = devSaveLibrarySnapshotForSmoke();
            try {
            devTestLog("Scenario start: smoke-suite-runner-smoke");
            const scenarios = devSmokeScenarioRegistry();
            const quickScenarios = devSmokeScenariosForMode("quick");
            const mediumScenarios = devSmokeScenariosForMode("medium");
            const publicHostingScenarios = devSmokeScenariosForMode("public-hosting");
            const extensiveSupabaseScenarios = devSmokeScenariosForMode(
                "extensive-supabase",
            );
            devAssert(
                scenarios.length >= 80 &&
                    scenarios.every((scenario) => typeof scenario.run === "function") &&
                    quickScenarios.every((scenario) => devSmokeScenarioMeta(scenario).tier === "Short") &&
                    mediumScenarios.every((scenario) => devSmokeScenarioMeta(scenario).tier === "Medium") &&
                    publicHostingScenarios.length >= 11 &&
                    publicHostingScenarios.every((scenario) => scenario.group === "public-hosting") &&
                    extensiveSupabaseScenarios.length === 3 &&
                    extensiveSupabaseScenarios.every(
                        (scenario) =>
                            scenario.group === "extensive-supabase" &&
                            scenario.runAll === false,
                    ) &&
                    scenarios.every((scenario) => devSmokeScenarioMeta(scenario).tier !== "Long"),
                "run-all and isolated extensive Supabase registries contain the expected scenarios",
                {
                    quick: quickScenarios.map((scenario) => scenario.id),
                    medium: mediumScenarios.map((scenario) => scenario.id),
                    publicHosting: publicHostingScenarios.map((scenario) => scenario.id),
                    extensiveSupabase: extensiveSupabaseScenarios.map(
                        (scenario) => scenario.id,
                    ),
                },
            );
            const reorderedStoryBaseline = [
                {lite: true,
                    id: "smoke-durable-order",
                    title: "Durable Order",
                    state: { meta: { alpha: 1, beta: 2 } },
                },
            ];
            const reorderedStoryCurrent = [
                {lite: true,
                    state: { meta: { beta: 2, alpha: 1 } },
                    title: "Durable Order",
                    id: "smoke-durable-order",
                },
            ];
            const changedStoryCurrent = clone(reorderedStoryCurrent);
            changedStoryCurrent[0].state.meta.beta = 3;
            devAssert(
                smokeDurableLibraryRecordsEqual(
                    STORY_TEMPLATE_KEY,
                    reorderedStoryCurrent,
                    reorderedStoryBaseline,
                ) &&
                    !smokeDurableLibraryRecordsEqual(
                        STORY_TEMPLATE_KEY,
                        changedStoryCurrent,
                        reorderedStoryBaseline,
                    ),
                "smoke cleanup ignores object-key ordering while still detecting real protected-record changes",
            );
            const unsettledSettlement =
                await awaitSmokeScenarioSettlementBeforeTeardown(
                    new Promise(() => {}),
                    "smoke-timeout-unsettled-regression",
                    0,
                );
            devAssert(
                !unsettledSettlement.settled && !unsettledSettlement.error,
                "timed-out smoke settlement fails closed when the grace period expires",
            );
            const rejectedSettlement =
                await awaitSmokeScenarioSettlementBeforeTeardown(
                    Promise.reject(new Error("late smoke rejection")),
                    "smoke-timeout-rejected-regression",
                    0,
                );
            devAssert(
                rejectedSettlement.settled &&
                    rejectedSettlement.error?.message === "late smoke rejection",
                "settled timed-out smoke rejection is retained for diagnostics",
            );
            let cancelledUiWait = "";
            try {
                await devSmokeSettle(1, {smokeToken: {cancelled: true, cancelReason: "synthetic cancelled UI wait"}});
            }
            catch (error) {
                cancelledUiWait = error.message;
            }
            devAssert(
                cancelledUiWait.includes("synthetic cancelled UI wait"),
                "cancelled smoke UI settling rejects before another fixture action can run",
            );

            const profileRestoreSnapshot = devProfileLibrarySnapshotForSmoke();
            const damagedProfile = userProfileById("smoke-profile-second");
            await app.library.replaceProfiles(
                app.userProfiles.map(profileStorageRecordFromDefinition),
            );
            await devRestoreProfileLibrarySnapshotForSmoke(profileRestoreSnapshot);
            const restoredStoredProfiles = validatedUserProfiles(
                await app.library.listProfiles(),
            );
            devAssert(
                devExactProfileLibraryText(app.userProfiles) ===
                    devExactProfileLibraryText(profileRestoreSnapshot.userProfiles) &&
                    devExactProfileLibraryText(restoredStoredProfiles) ===
                        devExactProfileLibraryText(profileRestoreSnapshot.userProfiles),
                "smoke profile restoration recovers every exact profile field in memory and storage",
                {
                    restoredMemory: app.userProfiles,
                    restoredStorage: restoredStoredProfiles,
                },
            );
            const reorderedProfiles = restoredStoredProfiles.map((profile) =>
                Object.fromEntries(Object.entries(profile).reverse().map(([key, value]) => [
                    key,
                    key === "settings" && value
                        ? Object.fromEntries(Object.entries(value).reverse())
                        : value,
                ])),
            );
            devAssert(
                assertSmokeProfileStoreMatchesMemory(app.userProfiles, reorderedProfiles) === true,
                "smoke profile preflight ignores object property order without ignoring values",
            );
            const mismatchMemoryProfiles = clone(app.userProfiles);
            const mismatchStoredProfiles = clone(restoredStoredProfiles);
            const mismatchProfile = mismatchMemoryProfiles.find(
                (profile) => profile.id === "smoke-profile-second",
            );
            const mismatchMemoryBefore = JSON.stringify(mismatchMemoryProfiles);
            const mismatchStorageBefore = JSON.stringify(mismatchStoredProfiles);
            let mismatchError = null;
            try {
                assertSmokeProfileStoreMatchesMemory(
                    mismatchMemoryProfiles,
                    mismatchStoredProfiles,
                );
            } catch (error) {
                mismatchError = error;
            }

            const toneEvents = [];
            const fakeToneContext = {
                state: "running",
                currentTime: 12,
                destination: {},
                createOscillator: () => ({
                    type: "",
                    frequency: {
                        setValueAtTime: (value, at) =>
                            toneEvents.push(["frequency", value, at]),
                    },
                    connect: () => toneEvents.push(["oscillator-connect"]),
                    start: (at) => toneEvents.push(["start", at]),
                    stop: (at) => toneEvents.push(["stop", at]),
                }),
                createGain: () => ({
                    gain: {
                        setValueAtTime: (value, at) =>
                            toneEvents.push(["gain", value, at]),
                        exponentialRampToValueAtTime: (value, at) =>
                            toneEvents.push(["ramp", value, at]),
                    },
                    connect: () => toneEvents.push(["gain-connect"]),
                }),
            };
            devAssert(
                playSmokeSuiteCompletionTone(fakeToneContext) &&
                    toneEvents.some(
                        (event) =>
                            event[0] === "start" && event[1] === 12,
                    ) &&
                    toneEvents.some(
                        (event) =>
                            event[0] === "stop" && event[1] === 12.95,
                    ) &&
                    toneEvents.some(
                        (event) =>
                            event[0] === "frequency" && event[1] === 880,
                    ),
                "smoke runner schedules one short completion tone without relying on live browser audio",
                toneEvents,
            );
            const restoreGuardName = "Smoke Restore Missing Portrait";
            app.state.characters[restoreGuardName] = {
                ...blankCharacterTemplate(restoreGuardName),
                name: restoreGuardName,
                profile_images: [],
                profile_image_id: "",
            };
            const restoreGuardProfileCount = app.profileImages.length;
            const restoreGuardQueueLength = app.profileImageQueue.length;
            const restoreGuardSaveCount = app.librarySavePendingCount || 0;
            await devWithSmokeRestorePhase(async () => {
                queueProfileImage(restoreGuardName, {
                    force: true,
                    reason: "smoke restore guard assertion",
                });
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
            devAssert(
                app.profileImages.length === restoreGuardProfileCount &&
                    app.profileImageQueue.length === restoreGuardQueueLength &&
                    !app.profileImageQueued.has(restoreGuardName) &&
                    (app.librarySavePendingCount || 0) === restoreGuardSaveCount,
                "smoke restore blocks automatic profile records, generation jobs, and persistence work",
                {
                    profileCountBefore: restoreGuardProfileCount,
                    profileCountAfter: app.profileImages.length,
                    queueLengthBefore: restoreGuardQueueLength,
                    queueLengthAfter: app.profileImageQueue.length,
                    saveCountBefore: restoreGuardSaveCount,
                    saveCountAfter: app.librarySavePendingCount || 0,
                },
            );
            delete app.state.characters[restoreGuardName];
            app.state = clone(defaultState);
            app.state.meta ||= {};
            app.state.meta.setup_complete = false;
            app.mainMenuOpen = true;
            app.mainMenuExplicitlyOpened = true;
            app.mainMenuContentGateAccepted = true;
            app.mainMenuContentGateEligible = false;
            render();

            const scenarioListHtml = renderDevSmokeScenarioList();
            devAssert(
                /smoke-tier short/i.test(scenarioListHtml) &&
                    /smoke-tier medium/i.test(scenarioListHtml) &&
                    !/smoke-tier long/i.test(scenarioListHtml) &&
                    /data-smoke-id=/i.test(scenarioListHtml) &&
                    /smoke-suite-number/i.test(scenarioListHtml),
                "smoke modal list renders numbered individual run buttons and only short/medium tier badges",
                scenarioListHtml,
            );
            openDevSmokeSuiteModal();
            devAssert(
                /Run Public Hosting Smokes/i.test($("modalBox")?.textContent || "") &&
                    /Run Listed Supabase Tests/i.test(
                        $("modalBox")?.textContent || "",
                    ) &&
                    !!$("supabaseSmokeScenarioListInput") &&
                    $("modalBox")?.querySelectorAll(
                        "[data-smoke-run='single'][data-smoke-id^='extensive-supabase-']",
                    ).length === 3,
                "smoke modal includes isolated extensive Supabase list controls and scenarios",
                $("modalBox")?.textContent || "",
            );
            closeModal();
            const report = formatSmokeSuiteReport({
                startedAt: "start",
                finishedAt: "finish",
                results: [
                    {
                        index: 1,
                        id: "sample-pass",
                        status: "PASS",
                        durationMs: 12,
                        timeoutMs: 120000,
                        logs: ["PASS: |[character:report-token]|"],
                    },
                    {
                        index: 2,
                        id: "sample-timeout",
                        status: "TIMEOUT",
                        durationMs: 120000,
                        timeoutMs: 120000,
                        error: "sample timeout",
                        logs: [],
                    },
                    {
                        index: 3,
                        id: "sample-fail",
                        status: "FAIL",
                        durationMs: 34,
                        timeoutMs: 120000,
                        error: "sample fail",
                        logs: [],
                    },
                ],
            });
            devAssert(
                /EmberAdventures Smoke Test Report/i.test(report) &&
                    report.includes(`Build: ${emberAdventuresBuildInfo().buildId}`) &&
                    report.includes(`Source hash: ${emberAdventuresBuildInfo().sourceHash}`) &&
                    /sample-pass/i.test(report) &&
                    /sample-timeout/i.test(report) &&
                    /\|\[character:report-token\]\|/i.test(report) &&
                    /Failed: 1 \(smokes: 3\)/i.test(report) &&
                    /Timed out: 1 \(smokes: 2\)/i.test(report),
                "run-all smoke report includes summary, details, failed smoke numbers, and timed-out smoke numbers",
                report,
            );
            const cleanupFailureResult = {
                index: 79,
                id: "sample-cleanup-owner",
                status: "PASS",
                durationMs: 25,
                timeoutMs: 120000,
                logs: [],
                devTraceCapture: [],
            };
            attachSmokeInfrastructureFailure(
                cleanupFailureResult,
                "Smoke cleanup failed",
                new Error("sample leftover image"),
            );
            const cleanupFailureReport = formatSmokeSuiteReport({
                startedAt: "start",
                finishedAt: "finish",
                plannedScenarioCount: 3,
                results: [cleanupFailureResult],
            });
            devAssert(
                cleanupFailureResult.status === "FAIL" &&
                    cleanupFailureResult.id === "sample-cleanup-owner" &&
                    cleanupFailureResult.index === 79 &&
                    /Total: 3/.test(cleanupFailureReport) &&
                    /Executed: 1/.test(cleanupFailureReport) &&
                    /Passed: 0/.test(cleanupFailureReport) &&
                    /Failed: 1 \(smokes: 79\)/.test(cleanupFailureReport) &&
                    /Not run: 2/.test(cleanupFailureReport) &&
                    !/79-cleanup|sample-cleanup-owner-cleanup/.test(cleanupFailureReport),
                "cleanup failures preserve planned, executed, and not-run smoke totals",
                cleanupFailureReport,
            );
            const stoppedRunSummary = smokeSuiteSummaryText(
                {
                    plannedScenarioCount: 174,
                    results: [
                        ...Array.from({ length: 22 }, () => ({ status: "PASS" })),
                        { status: "FAIL" },
                        { status: "TIMEOUT" },
                    ],
                    stoppedEarlyReason: "stopped after smoke 24 failed",
                },
                "All smoke tests",
            );
            devAssert(
                /22\/174 passed/.test(stoppedRunSummary) &&
                    /2\/174 failed/.test(stoppedRunSummary) &&
                    /150\/174 not run/.test(stoppedRunSummary) &&
                    !/22\/24/.test(stoppedRunSummary),
                "stopped Run All summaries use the full planned smoke count as every denominator",
                stoppedRunSummary,
            );
            app.settings.devMode = false;
            openMainMenuDataToolsModal();
            devAssert(
                $("modalBox")?.querySelector(".modal-chrome-title")?.textContent?.trim() === "Tools" &&
                    !$("modalBox")?.querySelector("h2") &&
                    !/Run Smoke Tests/i.test($("modalBox")?.textContent || ""),
                "main menu Tools hides Run Smoke Tests when dev mode is off",
                $("modalBox")?.textContent || "",
            );
            closeModal();
            app.settings.devMode = true;
            openMainMenuDataToolsModal();
            devAssert(
                /Run Smoke Tests/i.test($("modalBox")?.textContent || "") &&
                    [...($("modalBox")?.querySelectorAll(".grid.two button") || [])].every(
                        (button) => !!button.querySelector(".tool-icon"),
                    ),
                "main menu Tools shows Run Smoke Tests when dev mode is on",
                $("modalBox")?.textContent || "",
            );
            closeModal();
            const originalSmokeRuntimeStoryTemplates = app.storyTemplates;
            const originalCleanupWork = app.work;
            const originalCleanupPersistence = app.persistence;
            const cleanupEvents = [];
            let cleanupLibraryRunning = true;
            let cleanupSaveRunning = false;
            try {
                app.work = {
                    orderedSnapshot: () => [
                        ...(cleanupLibraryRunning ? [{ resourceKey: "library:profile-image", running: {} }] : []),
                        ...(cleanupSaveRunning ? [{ resourceKey: "save:smoke-cleanup", running: {} }] : []),
                    ],
                    flush: async (key) => {
                        cleanupEvents.push(`flush:${key}`);
                        await Promise.resolve();
                        cleanupLibraryRunning = false;
                        return true;
                    },
                    abandonOrdered: (key) => cleanupEvents.push(`abandon:${key}`),
                };
                app.persistence = {
                    abandonActiveSaveForTest: async () => cleanupEvents.push("replace-worker"),
                };
                await devAbandonOrderedWorkForSmokeRestore("library-only regression");
                devAssert(
                    cleanupEvents.join(",") === "flush:library:profile-image",
                    "smoke cleanup finishes pending image writes without resetting a save worker",
                );
                cleanupEvents.length = 0;
                cleanupLibraryRunning = true;
                cleanupSaveRunning = true;
                await devAbandonOrderedWorkForSmokeRestore("mixed-lane regression");
                devAssert(
                    cleanupEvents.join(",") ===
                        "flush:library:profile-image,abandon:save:smoke-cleanup,replace-worker",
                    "smoke cleanup finishes library writes before abandoning a synthetic save session",
                );
            } finally {
                app.work = originalCleanupWork;
                app.persistence = originalCleanupPersistence;
            }
            const originalSmokeRuntimeCharacterDefinitions = app.characterDefinitions;
            const syntheticRuntimeCatalogBaseline = {
                storyTemplates: [],
                storyTitleCardImages: app.storyTitleCardImages || [],
                characterDefinitions: [],
                profileImages: app.profileImages || [],
                saveLibrary: { saveIndex: saveIndexRecords() },
            };
            const syntheticRuntimeCatalogStory = validatedStoryTemplateRecord({
                ...devSmokeObjectiveChainTemplate(),
                id: `smoke-runtime-catalog-${Date.now()}-story`,
                title: "Smoke Runtime Catalog Story",
            });
            const syntheticRuntimeCatalogCharacter = devSmokeCharacterRecord(
                "Smoke Runtime Catalog Character",
                { record: { id: `smoke-runtime-catalog-${Date.now()}-character` } },
            );
            let syntheticRuntimeCatalogStoryArrayAliased = false;
            let syntheticRuntimeCatalogCharacterArrayAliased = false;
            let syntheticRuntimeCatalogStoryBaselineCount = -1;
            let syntheticRuntimeCatalogCharacterBaselineCount = -1;
            let syntheticRuntimeCatalogRemoved = false;
            let syntheticPerRecordResultCopied = false;
            try {
                const restoredStoryTemplates = devRestoreSmokeRuntimeCatalog(
                    "storyTemplates",
                    syntheticRuntimeCatalogBaseline.storyTemplates,
                );
                const restoredCharacterDefinitions = devRestoreSmokeRuntimeCatalog(
                    "characterDefinitions",
                    syntheticRuntimeCatalogBaseline.characterDefinitions,
                );
                syntheticRuntimeCatalogStoryArrayAliased =
                    restoredStoryTemplates ===
                    syntheticRuntimeCatalogBaseline.storyTemplates;
                syntheticRuntimeCatalogCharacterArrayAliased =
                    restoredCharacterDefinitions ===
                    syntheticRuntimeCatalogBaseline.characterDefinitions;
                restoredStoryTemplates.push(syntheticRuntimeCatalogStory);
                restoredCharacterDefinitions.push(syntheticRuntimeCatalogCharacter);
                syntheticRuntimeCatalogStoryBaselineCount =
                    syntheticRuntimeCatalogBaseline.storyTemplates.length;
                syntheticRuntimeCatalogCharacterBaselineCount =
                    syntheticRuntimeCatalogBaseline.characterDefinitions.length;
                syntheticRuntimeCatalogRemoved =
                    (await devCleanupDeclaredScenarioArtifacts(
                        syntheticRuntimeCatalogBaseline,
                        "smoke runtime catalog helper regression cleanup",
                    )) === true;
                const emptyPerRecordBaseline = [];
                const emptyPerRecordResult =
                    await devRestorePerRecordLibrarySnapshotForSmoke(
                        STORY_TEMPLATE_KEY,
                        emptyPerRecordBaseline,
                        [],
                        (records) => (Array.isArray(records) ? records : []),
                        "smoke runtime catalog helper per-record regression",
                    );
                syntheticPerRecordResultCopied =
                    emptyPerRecordResult !== emptyPerRecordBaseline &&
                    emptyPerRecordResult.length === 0;
                devAssert(
                    !syntheticRuntimeCatalogStoryArrayAliased &&
                        !syntheticRuntimeCatalogCharacterArrayAliased &&
                        syntheticRuntimeCatalogStoryBaselineCount === 0 &&
                        syntheticRuntimeCatalogCharacterBaselineCount === 0 &&
                        syntheticRuntimeCatalogRemoved &&
                        !app.storyTemplates.some(
                            (record) => record.id === syntheticRuntimeCatalogStory.id,
                        ) &&
                        !app.characterDefinitions.some(
                            (record) =>
                                libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) ===
                                syntheticRuntimeCatalogCharacter.id,
                        ) &&
                        syntheticPerRecordResultCopied,
                    "smoke runtime catalog restore copies containers before declared fixture cleanup",
                    {
                        storyArrayAliased: syntheticRuntimeCatalogStoryArrayAliased,
                        characterArrayAliased:
                            syntheticRuntimeCatalogCharacterArrayAliased,
                        storyBaselineCount: syntheticRuntimeCatalogStoryBaselineCount,
                        characterBaselineCount:
                            syntheticRuntimeCatalogCharacterBaselineCount,
                        declaredArtifactsRemoved: syntheticRuntimeCatalogRemoved,
                        perRecordResultCopied: syntheticPerRecordResultCopied,
                    },
                );
            }
            finally {
                app.storyTemplates = originalSmokeRuntimeStoryTemplates;
                app.characterDefinitions =
                    originalSmokeRuntimeCharacterDefinitions;
            }
            // This smoke verifies cleanup using only marked, self-owned artifacts.
            // The suite wrapper separately verifies restoring the user's baseline;
            // taking and rewriting that complete baseline here was duplicate work.
            await devCleanupAbandonedSmokeArtifactsBeforeSuite();
            const lateDeclaredCharacterId = "smoke-cleanup-late-declared-character";
            const lateDeclaredCharacter = devSmokeCharacterRecord(
                "Smoke Cleanup Late Declared Character",
                { record: { id: lateDeclaredCharacterId } },
            );
            const lateDeclaredSnapshot = {
                storyTemplates: clone(app.storyTemplates || []),
                storyTitleCardImages: clone(app.storyTitleCardImages || []),
                characterDefinitions: clone(app.characterDefinitions || []),
                profileImages: clone(app.profileImages || []),
                saveLibrary: { saveIndex: clone(saveIndexRecords()) },
            };
            let releaseLateDeclaredWrite = null;
            const lateDeclaredWriteGate = new Promise((resolve) => {
                releaseLateDeclaredWrite = resolve;
            });
            const lateDeclaredWrite = app.work.enqueueOrdered(
                `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                "persist late declared smoke character",
                async () => {
                    await lateDeclaredWriteGate;
                    app.characterDefinitions.push(lateDeclaredCharacter);
                    return savePerRecordLibraryRecords(
                        CHARACTER_LIBRARY_KEY,
                        [lateDeclaredCharacter],
                    );
                },
            );
            trackLargeStoragePromise(
                `${CHARACTER_LIBRARY_KEY}:late-declared-smoke`,
                lateDeclaredWrite,
            );
            setTimeout(() => releaseLateDeclaredWrite(), 0);
            await flushLargeSaves();
            const removedLateDeclared =
                await devCleanupDeclaredScenarioArtifactsAfterFlush(
                    lateDeclaredSnapshot,
                    "smoke runner late declared artifact regression",
                );
            const storedAfterLateDeclaredCleanup = await loadPerRecordLibrary(
                CHARACTER_LIBRARY_KEY,
                app.characterDefinitions || [],
                { deferDefinitionValidation: true },
            );
            const undeclaredCharacterId = "runner-cleanup-undeclared-character";
            const undeclaredCharacter = devSmokeCharacterRecord(
                "Runner Cleanup Undeclared Character",
                {
                    role: "cleanup verification fixture",
                    character: { source: "Original" },
                    record: {
                        id: undeclaredCharacterId,
                        creator: "Regression Owner",
                    },
                },
            );
            const undeclaredDifferences = {
                characterDefinitions: devSmokeAddedStorageIds(
                    [undeclaredCharacter],
                    [],
                    CHARACTER_LIBRARY_KEY,
                ),
            };
            devAssert(
                removedLateDeclared === true &&
                    !(app.characterDefinitions || []).some(
                        (record) =>
                            libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) ===
                            lateDeclaredCharacterId,
                    ) &&
                    !storedAfterLateDeclaredCleanup.some(
                        (record) =>
                            libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) ===
                            lateDeclaredCharacterId,
                    ) &&
                    !isSmokeCharacterLibraryArtifact(undeclaredCharacter) &&
                    devSmokeScenarioArtifactDifferenceMessages(
                        undeclaredDifferences,
                    ).some((message) => message.includes(undeclaredCharacterId)),
                "smoke cleanup removes declared character writes landing through the first flush while retaining undeclared-artifact enforcement",
                {
                    removedLateDeclared,
                    storedCharacterIds: storedAfterLateDeclaredCleanup.map((record) =>
                        libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record),
                    ),
                    undeclaredDifferences,
                },
            );
            const cleanupId = `smoke-cleanup-${Date.now()}`;
            const cleanupStory = validatedStoryTemplateRecord({
                ...devSmokeObjectiveChainTemplate(),
                id: cleanupId,
                title: "Smoke Cleanup Story",
            });
            applyValidatedStoryDefinitionArtifact(cleanupStory);
            app.storyTemplates.push(cleanupStory);
            app.characterDefinitions.push(
                devSmokeCharacterRecord("Smoke Cleanup Character", {
                    record: { id: cleanupId },
                }),
            );
            app.characterDefinitions = validatedCharacterLibraryDefinitions(
                app.characterDefinitions,
            );
            app.userProfiles.push({
                ...devSmokeTestProfile("first"),
                id: cleanupId,
                name: "Smoke Cleanup Profile",
            });
            app.userProfiles = validatedUserProfiles(app.userProfiles);
            app.profileImages.push(createProfileImageRecord({
                id: cleanupId,
                owner_name: "Smoke Cleanup Character",
                character_id: cleanupId,
                html: "<img alt=\"Smoke cleanup\">",
                profile: true,
                male: false,
            }));
            app.profileImages = exactProfileImageStore(app.profileImages);
            app.storyTitleCardImages.push({
                id: cleanupId,
                at: new Date().toISOString(),
                story_id: cleanupId,
                story_key: `story:${cleanupId}`,
                story_title: "Smoke Cleanup Story",
                story_source: "Original",
                html: "<img alt=\"Smoke cleanup story\">",
                source: "generated",
                reason: "story title card",
                title: "Smoke Cleanup Story",
                prompt: "Smoke cleanup story title card.",
                negativePrompt: "",
                seed: 0,
                model: selectedImageModel(),
                url: "",
                hosted_url: "",
                favorite: false,
                pending: false,
                error: "",
                smoke_test_artifact: true,
            });
            app.storyTitleCardImages = exactStoryTitleCardImageStore(
                app.storyTitleCardImages,
            );
            queuePerRecordLibraryRecordsSave(
                STORY_TITLE_CARD_IMAGE_KEY,
                [app.storyTitleCardImages.find((image) => String(image.id) === cleanupId)],
                "smoke cleanup test story title image added",
            );
            queuePerRecordLibraryRecordsSave(
                STORY_TEMPLATE_KEY,
                [app.storyTemplates.find((story) => String(story.id) === cleanupId)],
                "smoke cleanup test story added",
            );
            queuePerRecordLibraryRecordsSave(
                CHARACTER_LIBRARY_KEY,
                [app.characterDefinitions.find((record) => String(record.id) === cleanupId)],
                "smoke cleanup test character added",
            );
            saveProfilesNow("smoke cleanup test profile added");
            queuePerRecordLibraryRecordsSave(
                PROFILE_IMAGE_KEY,
                [app.profileImages.find((image) => String(image.id) === cleanupId)],
                "smoke cleanup test profile image added",
            );
            safeSetStorageItem(`emberadventureslite-smoke-cleanup-${cleanupId}`, "trash");
            const cleanupState = clone(defaultState);
            cleanupState.meta = {
                ...clone(defaultState.meta || {}),
                setup_complete: true,
                save_id: cleanupId,
                smoke_test_runtime: true,
                story_source: { mode: "original", title: "Smoke Cleanup Save" },
            };
            cleanupState.player = devSmokeRuntimeCharacter("Smoke Cleanup Player", {
                role: "smoke cleanup tester",
            });
            const cleanupSaveId = await createNewActiveSave("smoke cleanup aggregate added", {
                state: cleanupState,
                images: [{ id: cleanupId, title: "Smoke Cleanup Image" }],
            });
            await flushLargeSaves();
            await devCleanupAbandonedSmokeArtifactsBeforeSuite({ saveIds: [cleanupSaveId] });
            await flushLargeSaves();
            const remainingNormalizedSaves = await app.persistence.listSaves({

            });
            const cleanupSaveExists = (remainingNormalizedSaves?.entries || []).some(
                (record) => String(record?.saveId || "") === cleanupSaveId,
            );
            devAssert(
                    !storyTemplateById(cleanupId) &&
                    !(app.storyTitleCardImages || []).some((image) => image.id === cleanupId) &&
                    !(app.characterDefinitions || []).some((item) => item.id === cleanupId) &&
                    !(app.userProfiles || []).some((profile) => profile.id === cleanupId) &&
                    !(app.profileImages || []).some((image) => image.id === cleanupId) &&
                    !findSaveIndexRecord(cleanupSaveId) &&
                    !cleanupSaveExists &&
                    localStorage.getItem(`emberadventureslite-smoke-cleanup-${cleanupId}`) == null,
                "smoke cleanup removes smoke-created library records, normalized saves, images, profiles, and localStorage",
                {
                    storyTemplates: (app.storyTemplates || []).map((item) => item.id),
                    storyTitleCardImages: (app.storyTitleCardImages || []).map((image) => image.id),
                    characterDefinitions: (app.characterDefinitions || []).map((item) => item.id),
                    profiles: (app.userProfiles || []).map((profile) => profile.id),
                    profileImages: (app.profileImages || []).map((image) => image.id),
                    saves: saveIndexRecords().map((save) => save.saveId),
                    cleanupSaveExists,
                    localStorageTrashExists:
                        localStorage.getItem(`emberadventureslite-smoke-cleanup-${cleanupId}`) != null,
                },
            );
            addMessage("system", "Smoke suite runner smoke test passed.");
            showNotice("Live Test Passed", "Smoke suite runner smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: smoke-suite-runner-smoke");
            }
            finally {
                await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
            }
        }

        async function devRunSimplePopupKeyCloseSmokeTest() {
            devTestLog("Scenario start: simple-popup-key-close-smoke");
            const dispatchPopupKey = (key) =>
                document.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key,
                        bubbles: true,
                        cancelable: true,
                    }),
                );
            const shortWait = () => new Promise((resolve) => setTimeout(resolve, 60));
            openModal(`
                <h2>Smoke Backing Window</h2>
                <p id="simplePopupBackingMarker">This normal window must stay open.</p>
            `);
            devAssert(
                $("modal")?.classList.contains("open") &&
                    !!$("modalBox")?.querySelector("#simplePopupBackingMarker"),
                "backing modal opens before simple popup key checks",
            );
            const enterNotice = showNotice("Smoke Notice", "Enter should close only this notice.");
            await devWaitFor(
                () => !!document.querySelector(".popup-modal.open[data-simple-notice-popup='1'] #noticeOkBtn"),
                1000,
                "enter-close notice popup",
            );
            dispatchPopupKey("Enter");
            await enterNotice;
            devAssert(
                !document.querySelector(".popup-modal.open") &&
                    $("modal")?.classList.contains("open") &&
                    !!$("modalBox")?.querySelector("#simplePopupBackingMarker"),
                "Enter closes a simple notice popup without closing the backing modal",
            );
            const escapeNotice = showNotice("Smoke Notice", "Escape should close only this notice.");
            await devWaitFor(
                () => !!document.querySelector(".popup-modal.open[data-simple-notice-popup='1'] #noticeOkBtn"),
                1000,
                "escape-close notice popup",
            );
            dispatchPopupKey("Escape");
            await escapeNotice;
            devAssert(
                !document.querySelector(".popup-modal.open") &&
                    $("modal")?.classList.contains("open") &&
                    !!$("modalBox")?.querySelector("#simplePopupBackingMarker"),
                "Escape closes a simple notice popup without closing the backing modal",
            );
            const originalCopyTextToClipboard = copyTextToClipboard;
            let copiedImportFailure = "";
            copyTextToClipboard = async (text) => {
                copiedImportFailure = String(text || "");
                return true;
            };
            try {
                const importFailureNotice = showNotice(
                    "Story Import Failed",
                    "Smoke import failure details.",
                );
                await devWaitFor(
                    () =>
                        !!document.querySelector(
                            ".popup-modal.open #noticeCopyBtn",
                        ) &&
                        !!document.querySelector(
                            ".popup-modal.open #noticeCloseBtn",
                        ),
                    1000,
                    "import failure notice controls",
                );
                const copyButton = document.querySelector(
                    ".popup-modal.open #noticeCopyBtn",
                );
                copyButton.click();
                await shortWait();
                devAssert(
                    copiedImportFailure ===
                        "Story Import Failed\nSmoke import failure details." &&
                        copyButton.textContent === "Copied",
                    "Import Failed notices copy the title and full failure details",
                    { copiedImportFailure, buttonText: copyButton.textContent },
                );
                document
                    .querySelector(".popup-modal.open #noticeCloseBtn")
                    ?.click();
                await importFailureNotice;
                devAssert(
                    !document.querySelector(".popup-modal.open") &&
                        $("modal")?.classList.contains("open"),
                    "Import Failed notice X closes only that popup and resolves its promise",
                );
            } finally {
                copyTextToClipboard = originalCopyTextToClipboard;
            }
            const confirmPromise = showConfirm(
                "Smoke Confirm",
                "Enter must not choose for the player; Escape should cancel.",
            );
            await devWaitFor(
                () => !!document.querySelector(".popup-modal.open #confirmNoBtn"),
                1000,
                "confirm popup",
            );
            dispatchPopupKey("Enter");
            await shortWait();
            devAssert(
                !!document.querySelector(".popup-modal.open #confirmNoBtn") &&
                    $("modal")?.classList.contains("open"),
                "Enter does not close a confirm popup or the backing modal",
            );
            dispatchPopupKey("Escape");
            const confirmResult = await confirmPromise;
            devAssert(
                confirmResult === false &&
                    !document.querySelector(".popup-modal.open #confirmNoBtn") &&
                    $("modal")?.classList.contains("open"),
                "Escape cancels the topmost confirmation without closing the backing modal",
            );
            const lowerPopup = openPopupModal(
                `<div data-popup-stack-level="lower">Lower popup</div>`,
            );
            const upperPopup = openPopupModal(
                `<div data-popup-stack-level="upper">Upper popup</div>`,
            );
            dispatchPopupKey("Escape");
            await shortWait();
            devAssert(
                lowerPopup.overlay.isConnected &&
                    !upperPopup.overlay.isConnected,
                "Escape closes only the topmost popup in a stacked popup set",
            );
            dispatchPopupKey("Escape");
            await shortWait();
            devAssert(
                !lowerPopup.overlay.isConnected,
                "a second Escape closes the next popup in the stack",
            );
            const blockingToken = beginBlockingUiAction("Smoke blocking work");
            dispatchPopupKey("Escape");
            await shortWait();
            devAssert(
                !!document.querySelector("[data-ui-blocking-action]"),
                "Escape does not dismiss a non-dismissible blocking loader",
            );
            endBlockingUiAction(blockingToken);
            dispatchPopupKey("Escape");
            await shortWait();
            devAssert(
                !$("modal")?.classList.contains("open"),
                "Escape closes the backing modal when no popup remains",
            );
            addMessage("system", "Simple popup key close smoke test passed.");
            showNotice("Live Test Passed", "Simple popup key close smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: simple-popup-key-close-smoke");
        }

        function openGuideModal() {
            const savedOptions = saveIndexRecords()
                .map((save) => {
                    const label = [
                        gameSaveDisplayName(save),
                        save.storyTitle || "",
                        new Date(save.updatedAt || save.createdAt).toLocaleString(),
                    ]
                        .filter(Boolean)
                        .join(" - ");
                    return `<option value="${escapeHtml(save.saveId)}">${escapeHtml(label)}</option>`;
                })
                .filter(Boolean)
                .join("");
            openModal(`
                <h2>Story Guidance</h2>
                <p class="hint">Optional instructions that are included in AI response prompts. Use this for pacing, tone, content you want more or less of, interests, writing style, or how game-like the adventure should feel.</p>
                <textarea id="storyGuidance" rows="12">${escapeHtml(storyGuidanceText())}</textarea>
                <div class="row" style="margin-top:.8rem">
                    <button id="copyWorldGuidanceBtn" ${savedOptions ? "" : "disabled"}>Copy From Existing World</button>
                    <select id="copyWorldGuidanceSelect" ${savedOptions ? "" : "disabled"}>
                        ${savedOptions || `<option>No saved world guidance found</option>`}
                    </select>
                </div>
            `);

            $("storyGuidance").onblur = () => {
                app.state.meta ||= {};
                app.state.meta.story_guidance = $("storyGuidance").value.trim();
                scheduleActiveGameSave();
            };
            if ($("copyWorldGuidanceBtn"))
                $("copyWorldGuidanceBtn").onclick = async () => {
                    const saveId = $("copyWorldGuidanceSelect")?.value || "";
                    const state = (await loadSaveRecord(saveId))?.state || null;
                    const guidance = state?.meta?.story_guidance || "";
                    if (!guidance) {
                        showNotice("No Guidance", "That saved game does not have story guidance to copy.");
                        return;
                    }
                    $("storyGuidance").value = guidance;
                    app.state.meta ||= {};
                    app.state.meta.story_guidance = guidance;
                    scheduleActiveGameSave();
                };
        }

        function storyGuidanceText() {
            return String(
                app.state?.meta?.story_guidance || app.settings?.storyGuidance || "",
            ).trim();
        }

        function universalStoryGuidancePromptBlock() {
            // Prompt contract: creative/story-state AI text calls get story
            // guidance. Narrow technical classifiers/verifiers opt out with
            // hasUniversalContext so their logged prompt is exactly what is sent.
            const guidance = storyGuidanceText();
            if (!guidance)
                return "";

            return [
                "EMBERADVENTURES STORY GUIDANCE (These are instructions directly from the player. Follow them more strongly than any other story instruction):",
                guidance,
                "END OF EMBERADVENTURES STORY GUIDANCE"
            ].join("\n");
        }

        function universalStoryRulesPromptBlock(state = app.state) {
            const rules = runtimeStoryRulesForPrompt(state?.story_rules || []);
            if (!rules.length) return "";
            return [
                "STORY_RULES (These rules must be followed exactly, or story progression will be broken):",
                ...rules,
                "END OF STORY_RULES",
            ].join("\n");
        }



        function withUniversalAiPromptContext(instruction = "", options = {}) {
            const text = String(instruction || "");
            const contextBlocks = [];
            if (!text.includes("EMBERADVENTURES STORY GUIDANCE (These are instructions directly from the player. Follow them more strongly than any other story instruction):")) {
                const block = universalStoryGuidancePromptBlock();
                if (block)
                    contextBlocks.push(block);
            }
            if (
                options.includeStoryRules !== false &&
                !text.includes("STORY_RULES (These rules must be followed exactly, or story progression will be broken):")
            ) {
                const block = universalStoryRulesPromptBlock();
                if (block) contextBlocks.push(block);
            }

            if (!contextBlocks.length)
                return text;

            return `${contextBlocks.join("\n\n")}\n\n${text}`;
        }

        function pendingRewardChoicesHtml() {
            const choices = app.state.objectives?.pending_reward_choices || [];
            if (!choices.length) return "";
            return `
                <div class="stat-card" style="margin-bottom:.75rem">
                    <h3>Pending Rewards</h3>
                    ${choices
                        .map((choice) => {
                            const id = htmlJsArg(choice.id);
                            const options = (choice.choices || ["Player"])
                                .map(
                                    (name) =>
                                        `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
                                )
                                .join("");
                            const label =
                                choice.kind === "ability"
                                    ? choice.reward?.ability || choice.reward?.name || "Ability"
                                    : choice.reward?.item || choice.reward?.name || "Item";
                            return `
                                <div class="nearby-row">
                                    <div class="nearby-name">${escapeHtml(label)} <span class="hint">(${escapeHtml(choice.kind || "reward")})</span></div>
                                    <div class="nearby-actions">
                                        <select id="rewardChoice-${escapeHtml(choice.id)}">${options}</select>
                                        <button class="primary" onclick="EmberAdventures.resolvePendingRewardChoice(${id}, document.getElementById('rewardChoice-${escapeHtml(choice.id)}').value)">Give</button>
                                    </div>
                                </div>
                            `;
                        })
                        .join("")}
                </div>
            `;
        }

        function resolvePendingRewardChoice(choiceId, targetName) {
            app.state.objectives ||= { pending_reward_choices: [] };
            const choices = app.state.objectives.pending_reward_choices || [];
            const index = choices.findIndex(
                (choice) => String(choice.id) === String(choiceId),
            );
            if (index < 0) return;
            const choice = choices[index];
            const reward = { ...(choice.reward || {}) };
            if (choice.kind === "item") {
                reward.target = targetName === "Player" ? "player" : "party";
                reward.character = targetName === "Player" ? "" : targetName;
                grantItemReward(app.state, reward, { title: "Pending reward" });
            }
            choices.splice(index, 1);
            // SANITIZE REPLACED: pending reward choice should only normalize progression/objective reward state.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeObjectivesAndProgression(app.state);
            scheduleActiveGameSave();
            openObjectivePickerModal();
            render();
        }
        function linesFromTextarea(id) {
            return $(id)
                .value.split(/\n+/)
                .map((x) => x.trim())
                .filter(Boolean);
        }
        function openSceneModal() {

            const s = app.state.scene || {};
            const l = app.state.location || {};

            const names = ["Player", ...Object.keys(app.state.characters || {})];
            const checks = names
                .map((name) => {
                    const checked = (s.party_members_present || []).includes(name)
                        ? "checked"
                        : "";

                    return `
                        <label style="display: flex; gap: .4rem; align-items: center">
                            <input
                                type="checkbox"
                                class="activeCharCheck"
                                value="${escapeHtml(name)}"
                                ${checked}
                                style="width: auto"
                            >
                            ${escapeHtml(name)}
                        </label>
                    `;
                })
                .join("");
            const imageChecks = names
                .map((name) => {
                    const checked = (s.image_characters || []).includes(name)
                        ? "checked"
                        : "";

                    return `
                        <label style="display: flex; gap: .4rem; align-items: center">
                            <input
                                type="checkbox"
                                class="imageCharCheck"
                                value="${escapeHtml(name)}"
                                ${checked}
                                style="width: auto"
                            >
                            ${escapeHtml(name)}
                        </label>
                    `;
                })
                .join("");

            openModal(`
                <h2>Scene</h2>
                <div class="grid2">
                    ${
                        ""
                    }
                    <label>Specific place <input id="scenePlace" value="${escapeHtml(l.specific_place || "")}"></label>
                    <label>Current objective <input value="${escapeHtml(sceneObjectiveLabel(app.state) || "")}" disabled></label>
                    <label>Image action <input id="sceneImageAction" value="${escapeHtml(s.image_action || "")}" placeholder="short visual phrase only"></label>
                </div>
                <p class="hint">Image action should be one short visual phrase only, like "claws near hero throat" or "smirking hand raised".</p>
                <label style="margin-top: .75rem">
                    Scene summary
                    <textarea id="sceneSummary" rows="5">${escapeHtml(s.summary || "")}</textarea>
                </label>
                <h3>Active Characters</h3>
                <div class="grid3">${checks}</div>
                <h3>Image Characters</h3>
                <div class="grid3">${imageChecks}</div>
            `);
            bindModalAutoSave(
                saveSceneFromModal,
                "Scene Autosave Failed",
                "scene edit",
            );
        }

        function saveSceneFromModal({ close = false, snapshot = true } = {}) {
            app.state.location.specific_place = $("scenePlace").value.trim();
            app.state.scene.summary = $("sceneSummary").value.trim();
            app.state.scene.image_action = $("sceneImageAction").value.trim();
            app.state.scene.party_members_present = [
                ...document.querySelectorAll(".activeCharCheck"),
            ]
                .filter((x) => x.checked)
                .map((x) => x.value);
            app.state.scene.image_characters = [
                ...document.querySelectorAll(".imageCharCheck"),
            ]
                .filter((x) => x.checked)
                .map((x) => x.value);
            // SANITIZE REPLACED: image target picker should only normalize scene.image_characters and never force profile/image side effects.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeSceneReferences(app.state);
            scheduleActiveGameSave();
            if (close) closeModal();
        }
        function startTurnSceneImageCollector(turnId = "") {
            const previous = currentTurnSceneImageCollector();
            if (previous) flushTurnSceneImageCollector(previous.id);
            clearTimeout(app.turnSceneImageCollector?.timer || 0);
            app.turnSceneImageCollector = {
                id: String(turnId || Date.now() + Math.random()),
                requests: [],
                timer: null,
                fired: false,
                immediateSignatures: new Set(),
            };
            return app.turnSceneImageCollector.id;
        }

        function currentTurnSceneImageCollector() {
            const collector = app.turnSceneImageCollector;
            return collector && !collector.fired ? collector : null;
        }

        function requestTurnSceneImage(reason = "auto", options = {}) {
            if (!app.settings.autoImages && !options.ignoreAutoImages) return false;
            const kind = String(options.kind || "").trim().toLowerCase();
            let requestOptions = options;
            if (kind === "clothing") {
                const nonPlayerTargets = Array.isArray(options.targets)
                    ? exactImageTargetsForState(
                          options.targets,
                          app.state,
                          "image request targets",
                      ).filter((name) => !isPlayerEntityName(name, app.state))
                    : [];
                if (!nonPlayerTargets.length) return false;
                requestOptions = {
                    ...options,
                    targets: nonPlayerTargets,
                };
            }
            requestOptions = {
                ...requestOptions,
                skipDuplicateVisualState:
                    requestOptions.skipDuplicateVisualState !== false,
            };
            const collector = currentTurnSceneImageCollector();
            if (requestOptions.immediate) {
                const signature = immediateTurnSceneImageSignature(requestOptions);
                if (signature && collector?.immediateSignatures?.has(signature)) return false;
                if (signature) collector?.immediateSignatures?.add(signature);
                if (collector && Array.isArray(requestOptions.targets)) {
                    const immediateTargets = new Set(
                        requestOptions.targets.map((name) => normalizeNameForMatch(name)),
                    );
                    collector.requests = collector.requests.filter((entry) => {
                        const queuedTargets = entry.options?.targets || [];
                        return !queuedTargets.some((name) =>
                            immediateTargets.has(normalizeNameForMatch(name)),
                        );
                    });
                }
                generateImage(reason, requestOptions).catch((err) => {
                    log("Auto image failed", err.message || err, {
                        type: "image",
                        level: imageRequestFailureLogLevel(err),
                    });
                });
                return true;
            }
            if (!collector) {
                generateImage(reason, requestOptions).catch((err) => {
                    log("Auto image failed", err.message || err, {
                        type: "image",
                        level: imageRequestFailureLogLevel(err),
                    });
                });
                return true;
            }
            const exactTargets = Array.isArray(requestOptions.targets)
                ? exactImageTargetsForState(requestOptions.targets, app.state, "image request targets")
                : undefined;
            const request = {
                reason: String(reason || "auto"),
                options: {
                    ...requestOptions,
                    targets: exactTargets?.length ? exactTargets : undefined,
                },
                at: Date.now(),
            };
            const signature = turnSceneImageRequestSignature(request);
            const duplicateIndex = collector.requests.findIndex(
                (entry) => turnSceneImageRequestSignature(entry) === signature,
            );
            if (duplicateIndex === -1) collector.requests.push(request);
            else collector.requests[duplicateIndex] = request;
            return true;
        }

        function immediateTurnSceneImageSignature(options = {}) {
            const targets = exactImageTargetsForState(
                Array.isArray(options.targets) ? options.targets : imageTargetNames(),
                app.state,
                "immediate image request targets",
            );
            return sceneImageVisualStateSignature(targets);
        }

        function sceneImageVisualStateSignature(targets = []) {
            if (!targets.length) return "";
            const entities = targets.map((name) => {
                const entity = imageEntityFromState(name, app.state) || {};
                return {
                    name: normalizeNameForMatch(name),
                    clothing: exactClothingSlots(entity.clothing || {}),
                    held_items: {
                        right_hand: clothingItemText(entity.held_items?.right_hand) || null,
                        left_hand: clothingItemText(entity.held_items?.left_hand) || null,
                    },
                    pose: textSlot(entity.pose, ""),
                    physical_state: textSlot(entity.physical_state, ""),
                };
            });
            return JSON.stringify({
                targets: entities,
                location: textSlot(app.state.location?.specific_place, ""),
                action: textSlot(app.state.scene?.image_action, ""),
            });
        }

        function recentSceneImageVisualState(signature = "", maxAgeMs = 5 * 60 * 1000) {
            if (!signature) return false;
            const now = Date.now();
            app.recentSceneImageVisualStates ||= new Map();
            for (const [key, at] of app.recentSceneImageVisualStates) {
                if (now - at > maxAgeMs) app.recentSceneImageVisualStates.delete(key);
            }
            return app.recentSceneImageVisualStates.has(signature);
        }

        function rememberSceneImageVisualState(signature = "") {
            if (!signature) return;
            app.recentSceneImageVisualStates ||= new Map();
            app.recentSceneImageVisualStates.set(signature, Date.now());
            while (app.recentSceneImageVisualStates.size > 40) {
                const oldest = app.recentSceneImageVisualStates.keys().next().value;
                app.recentSceneImageVisualStates.delete(oldest);
            }
        }

        function turnSceneImageRequestSignature(request = {}) {
            const kind = String(request.options?.kind || "auto").trim().toLowerCase();
            const targets = [...(request.options?.targets || [])]
                .map((name) => normalizeNameForMatch(name))
                .filter(Boolean)
                .sort();
            return JSON.stringify({
                kind,
                targets,
                description: cleanPromptText(request.options?.descriptionOverride),
                background: cleanPromptText(request.options?.backgroundOverride),
            });
        }

        function scheduleTurnSceneImageFlush(turnId = "", delayMs = 900) {
            const collector = currentTurnSceneImageCollector();
            if (!collector || String(collector.id) !== String(turnId)) return false;
            clearTimeout(collector.timer || 0);
            collector.timer = setTimeout(
                () => flushTurnSceneImageCollector(turnId),
                Math.max(0, Number(delayMs) || 0),
            );
            return true;
        }

        function turnSceneImageRequestPriority(request = {}) {
            const kind = String(request.options?.kind || "").trim().toLowerCase();
            if (kind === "decision") return 50;
            if (kind === "clothing") return 30;
            if (Array.isArray(request.options?.targets) && request.options.targets.length)
                return 20;
            return 10;
        }

        function chooseTurnSceneImageRequests(requests = []) {
            const sorted = [...requests]
                .filter(Boolean)
                .sort((a, b) => {
                    const priority = turnSceneImageRequestPriority(b) - turnSceneImageRequestPriority(a);
                    return priority || (Number(b.at) || 0) - (Number(a.at) || 0);
                });
            const soloByTarget = new Map();
            for (const request of sorted) {
                const targets = request.options?.targets || [];
                if (targets.length !== 1) continue;
                const targetKey = normalizeNameForMatch(targets[0]);
                if (targetKey && !soloByTarget.has(targetKey))
                    soloByTarget.set(targetKey, request);
            }
            if (soloByTarget.size) return [...soloByTarget.values()];
            return sorted.length ? [sorted[0]] : [];
        }

        function chooseTurnSceneImageRequest(requests = []) {
            return chooseTurnSceneImageRequests(requests)[0] || null;
        }

        function flushTurnSceneImageCollector(turnId = "") {
            const collector = currentTurnSceneImageCollector();
            if (!collector || String(collector.id) !== String(turnId)) return false;
            clearTimeout(collector.timer || 0);
            collector.fired = true;
            app.turnSceneImageCollector = null;
            const requests = chooseTurnSceneImageRequests(collector.requests || []);
            if (!requests.length) return false;
            for (const request of requests)
                generateImage(request.reason || "auto", request.options || {}).catch((err) => {
                    log("Auto image failed", err.message || err, {
                        type: "image",
                        level: imageRequestFailureLogLevel(err),
                    });
                });
            return true;
        }

        function cancelTurnSceneImageCollector(turnId = "") {
            const collector = app.turnSceneImageCollector;
            if (!collector || (turnId && String(collector.id) !== String(turnId)))
                return false;
            clearTimeout(collector.timer || 0);
            app.turnSceneImageCollector = null;
            return true;
        }

        async function afterReplyEffects(reply, replyMessageId = null) {

            if (
                app.settings.autoVoice &&
                !voiceIsPaused() &&
                !app.streamedVoiceReplyIds.has(replyMessageId) &&
                !app.autoVoiceStartedMessageIds.has(String(replyMessageId))
            )
                readMessage(replyMessageId, { sequence: false });
            ensureSceneNpcDefinitions(reply);
            if (replyMessageId) app.streamedVoiceReplyIds.delete(replyMessageId);
            if (app.settings.stateCheckMode === "groups") return;
            if (shouldGenerateImage()) requestTurnSceneImage("auto");
        }
        function shouldGenerateImage() {
            if (!app.settings.autoImages) return false;

            const sig = [
                ...(app.state.scene?.image_characters || []),
                app.state.scene?.image_action,
                app.state.location?.specific_place,
            ].join("|");

            if (app.settings.imageMode === "every") return true;
            if (app.settings.imageMode === "manual") return false;

            if (sig !== app.lastImageSignature) {
                app.lastImageSignature = sig;
                return true;
            }

            return false;
        }

        function prepareNormalImageRequest(entities, reason, options = {}) {
            if (!Array.isArray(entities) || !entities.length)
                throw new Error("Normal image preparation requires at least one character.");
            const primary = entities[0][1];
            const seed = normalImageSeedForEntities(entities);
            const negativePrompt = buildGroupImageNegativePrompt(entities, {
            });
            const rawPrompt = sanitizeImagePromptForMode(
                buildGroupImagePrompt(entities, {
                    clothingOverrides: options.clothingOverrides || {},
                    heldItemsOverrides: options.heldItemsOverrides || {},
                    includeSceneContext: options.includeSceneContext,
                    ...(Object.prototype.hasOwnProperty.call(options, "backgroundOverride")
                        ? { backgroundOverride: options.backgroundOverride }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(options, "descriptionOverride")
                        ? { descriptionOverride: options.descriptionOverride }
                        : {}),
                }),
                { entity: primary },
            );
            const title = entities.map(([name]) => profileDisplayName(name)).join(", ");
            const model = activeNormalImageModel();
            const styled = applyImageArtStyle(rawPrompt, negativePrompt, model);
            const prepared = {
                title,
                reason,
                model,
                seed: seed ?? "random",
                prompt: styled.prompt,
                negativePrompt: styled.negativePrompt,
                html: imageLoadingHtml("Image generation in progress"),
                pending: true,
                targets: clone(options.targets || entities.map(([name]) => name)),
                target_presentations: normalImageTargetPresentations(
                    options.targets || entities.map(([name]) => name),
                    entities,
                ),
                promptType: "normal scene image",
            };

            devLog("Image prompt", {
                label: "image generation",
                reason,
                prompt: prepared.prompt,
                negativePrompt: prepared.negativePrompt,
                seed: prepared.seed,
                resolution: "512x768",
                imageStyle: imageModelLabel(model),
                summary: prepared.prompt.slice(0, 700),
            });
            log(
                "Image prompt before send",
                `Reason: ${reason}\nStyle: ${imageModelLabel(model)}\nSeed: ${prepared.seed}\nNegative: ${prepared.negativePrompt || "(none)"}\n\n${prepared.prompt}`,
                { type: "image", level: "message" },
            );
            return prepared;
        }

        function normalImageRequestGenerationOptions(record, options = {}) {
            const squareAsset = [
                "story inventory item image",
                "story shop outfit image",
            ].includes(record.promptType);
            return {
                ...options,
                label: "normal scene image generation",
                promptType: record.promptType || "normal scene image",
                promptEditorReplay: {
                    targets: clone(record.targets || []),
                    reason: record.reason || "",
                },
                resolution: squareAsset ? "512x512" : "512x768",
                imageId: record.id,
            };
        }

        async function generateImage(reason, options = {}) {
            const generation = app.gameRuntimeGeneration;
            const requestedTargets = Array.isArray(options.targets) && options.targets.length
                ? [...new Set(options.targets)].filter((name) =>
                      imageEntityFromState(name, app.state),
                  )
                : imageTargetNames({

                  });
            const targets = exactImageTargetsForState(
                requestedTargets,
                app.state,
                "image generation targets",
            );
            const entities = targets
                .map((name) => [name, runtimeImageEntity(name)])
                .filter(([, entity]) => entity);
            if (!entities.length) {
                log(
                    "Image not started",
                    "No valid image target was available. Add Player or a character to the image target list.",
                    { type: "image", level: "message" },
                );
                return;
            }
            const visualStateSignature = sceneImageVisualStateSignature(targets);
            if (
                options.skipDuplicateVisualState &&
                recentSceneImageVisualState(visualStateSignature)
            ) {
                devLog("Image request skipped", {
                    label: "duplicate visual state",
                    reason,
                    targets,
                    summary:
                        "Automatic image request skipped because the same visual state was already requested recently.",
                });
                return;
            }
            rememberSceneImageVisualState(visualStateSignature);

            let record = null;
            try {
                const prepared = prepareNormalImageRequest(entities, reason, {
                    clothingOverrides: options.clothingOverrides || {},
                    heldItemsOverrides: options.heldItemsOverrides || {},
                    ...(Object.hasOwn(options, "descriptionOverride")
                        ? { descriptionOverride: options.descriptionOverride }
                        : {}),
                    ...(Object.hasOwn(options, "backgroundOverride")
                        ? { backgroundOverride: options.backgroundOverride }
                        : {}),
                    targets,
                });
                record = createNormalImageRequest(prepared, {
                    startRequest: generation === app.gameRuntimeGeneration,
                });

                if (generation !== app.gameRuntimeGeneration) return;
                log("Image requested", prepared.prompt, {
                    type: "image",
                    level: "message",
                });
            } catch (err) {
                devLog("Image error", {
                    label: "image generation",
                    error: err.message || String(err),
                    summary: err.message || String(err),
                });
                log("Image failed", err.message || err, {
                    type: "image",
                    level: imageRequestFailureLogLevel(err),
                });
                if (record)
                    updateStoredImageHtml(
                        record.id,
                        imageLoadingHtml(err.message || String(err)),
                        {
                            pending: false,
                            error: err.message || String(err),
                        },
                    );
            } finally {
                if (generation !== app.gameRuntimeGeneration) return;
                scheduleActiveGameSave();
                if (record)
                    refreshImageRecordSurfaces(record.id, {
                        imagePanelStructure: false,
                        threadStructure: false,
                        reason: "normal image generation finalized",
                    });
            }
        }

        async function startStoredImageRequest(record, options = {}) {
            if (!record?.id || !record.prompt) return;
            const generation = app.gameRuntimeGeneration;
            const id = String(record.id);
            if (app.activeImageRequests.has(id)) return;
            app.activeImageRequests.add(id);
            let livePerchanceOutputSeen = false;
            const watchdogTimers = [];
            const requestStartedAt = performance.now();
            const clearWatchdogs = () => {
                while (watchdogTimers.length) clearTimeout(watchdogTimers.pop());
            };
            const scheduleWatchdog = (delayMs) => {
                if (!imageGenerationDebugEnabled()) return;
                watchdogTimers.push(
                    setTimeout(() => {
                        if (generation !== app.gameRuntimeGeneration) return;
                        if (!app.activeImageRequests?.has?.(id)) return;
                        devLogNormalImageLifecycle(
                            "Image request still pending",
                            record,
                            {
                                elapsedMs: Math.round(
                                    performance.now() - requestStartedAt,
                                ),
                                watchdogDelayMs: delayMs,
                                livePerchanceOutputSeen,
                                summary:
                                    "Normal image request is still active with no finished stored image.",
                            },
                        );
                    }, delayMs),
                );
            };
            devLogNormalImageLifecycle("Image request started", record, {
                resumed: !!options.resumed,
                promptLength: String(record.prompt || "").length,
                negativePromptLength: String(record.negativePrompt || "").length,
                model: record.model || "",
                seed: record.seed ?? null,
                summary: "Normal image request entered the active request set.",
            });
            scheduleWatchdog(10000);
            scheduleWatchdog(30000);
            scheduleWatchdog(60000);
            if (options.resumed) {
                updateStoredImageHtml(
                    record.id,
                    imageLoadingHtml("Restarting interrupted image generation"),
                    { pending: true, error: "" },
                );
            }
            try {
                const seed =
                    record.seed == null || record.seed === "random"
                        ? undefined
                        : exactProfileImageSeed(record.seed, "image request seed");
                const html = await generateImageHtml(
                    record.prompt,
                    record.negativePrompt,
                    seed,
                    record.model,
                    normalImageRequestGenerationOptions(record, {
                        timeoutMs: options.timeoutMs,
                        onPluginResult: (resultObj) => {
                            if (generation !== app.gameRuntimeGeneration) return;
                            const stableHtml = stableImageHtmlToString(resultObj);
                            devLogNormalImageLifecycle(
                                "Image plugin result object received",
                                record,
                                {
                                    pluginResult: imagePluginResultDebugSummary(resultObj),
                                    livePerchanceOutputSeen,
                                    summary:
                                        "Text-to-image plugin returned a result object for the normal image request.",
                                },
                            );
                            // The live Perchance iframe belongs in the fixed hidden
                            // request host. Cards keep a stable loading frame until
                            // a finished image is available, regardless of whether
                            // the card is mounted or inside the viewport.
                            if (stableHtml && renderLiveImageResult(record.id, stableHtml)) {
                                livePerchanceOutputSeen = true;
                                const image = (app.images || []).find(
                                    (item) => String(item.id) === String(record.id),
                                );
                                if (image) {
                                    image.html = stableHtml;
                                    image.pending = true;
                                    image.error = "";
                                    scheduleActiveGameSave();
                                }
                            }
                        },
                        onIframe: (iframeHtml, iframeEl) => {
                            if (generation !== app.gameRuntimeGeneration) return;
                            livePerchanceOutputSeen = true;
                            devLogNormalImageLifecycle(
                                "Image plugin iframe received",
                                record,
                                {
                                    iframeHtmlKind: imageHtmlDebugKind(iframeHtml),
                                    iframeHtmlStart: String(iframeHtml || "").slice(
                                        0,
                                        180,
                                    ),
                                    iframeConnected: !!iframeEl?.isConnected,
                                    iframeActivated: !!iframeEl?.hasAttribute?.("src"),
                                    iframeLoading: iframeEl?.getAttribute?.("loading") || "",
                                    summary:
                                        iframeEl
                                            ? "Text-to-image plugin mounted its live iframe in the fixed hidden request host."
                                            : "Text-to-image plugin supplied a live iframe for the normal image request.",
                                },
                            );
                        },
                        ensureIframeHost: true,
                        iframeHostKey: normalImageRequestIframeHostKey(record.id),
                    }),
                );

                if (generation !== app.gameRuntimeGeneration) return;
                devLogNormalImageLifecycle("Image plugin await finished", record, {
                    elapsedMs: Math.round(performance.now() - requestStartedAt),
                    returnedHtmlKind: imageHtmlDebugKind(html),
                    returnedHasRealHtml: devLooksLikeRealImageHtml(html),
                    livePerchanceOutputSeen,
                    summary:
                        "Text-to-image plugin promise resolved for the normal image request.",
                });
                devLog("Image response", {
                    label: "image generation",
                    imageId: record.id,
                    response: html ? String(html).slice(0, 2000) : "",
                    summary: html
                        ? "Image plugin returned finished image HTML."
                        : "Image plugin unavailable; prompt was saved.",
                });
                log(
                    "Image response before processing",
                    html
                        ? String(html).slice(0, 2000)
                        : "Image plugin returned no finished image.",
                    { type: "image", level: html ? "message" : "error" },
                );

                if (!html) {
                    if (livePerchanceOutputSeen) {
                        updateStoredImageHtml(record.id, record.html, {
                            pending: true,
                            error: "",
                        });
                        log(
                            "Image still rendering",
                            "Perchance image output is still live in the card; keeping it pending instead of replacing it with an error.",
                            { type: "image", level: "message" },
                        );
                    } else {
                        updateStoredImageHtml(
                            record.id,
                            imageLoadingHtml("Image plugin returned no usable image."),
                            {
                                pending: false,
                                error: "Image plugin returned no usable image.",
                            },
                        );
                        log(
                            "Image not added",
                            "The image plugin finished without returning a usable image.",
                            { type: "image", level: "error" },
                        );
                    }
                    return;
                }

                updateStoredImageHtml(record.id, html, {
                    pending: false,
                    error: "",
                });
                devLogNormalImageLifecycle("Image stored successfully", record, {
                    elapsedMs: Math.round(performance.now() - requestStartedAt),
                    summary: "Finished normal image HTML was stored.",
                });
            } catch (err) {
                if (generation !== app.gameRuntimeGeneration) return;
                devLog("Image error", {
                    label: "image generation",
                    imageId: record.id,
                    error: err.message || String(err),
                    summary: err.message || String(err),
                });
                devLogNormalImageLifecycle("Image request failed", record, {
                    elapsedMs: Math.round(performance.now() - requestStartedAt),
                    error: err.message || String(err),
                    livePerchanceOutputSeen,
                    summary:
                        "Normal image request threw before a finished image could be stored.",
                });
                updateStoredImageHtml(
                    record.id,
                    imageLoadingHtml(err.message || String(err)),
                    {
                        pending: false,
                        error: err.message || String(err),
                    },
                );
                log("Image failed", err.message || err, {
                    type: "image",
                    level: imageRequestFailureLogLevel(err),
                });
            } finally {
                clearWatchdogs();
                app.activeImageRequests.delete(id);
                if (generation !== app.gameRuntimeGeneration) return;
                devLogNormalImageLifecycle("Image request finalized", record, {
                    elapsedMs: Math.round(performance.now() - requestStartedAt),
                    livePerchanceOutputSeen,
                    summary:
                        "Normal image request left the active request set and surfaces will refresh.",
                });
                scheduleActiveGameSave();
                refreshImageRecordSurfaces(record.id, {
                    reason: "stored normal image request finished",
                });
                runPendingPresenceCleanupIfIdle();
            }
        }

        function queueOpeningSceneImage() {
            const generation = app.gameRuntimeGeneration;
            app.normalImagePriorityUntil = Math.max(
                Math.max(0, Number(app.normalImagePriorityUntil) || 0),
                perfNow() + 5000,
            );
            const start = () => {
                if (generation !== app.gameRuntimeGeneration) return;
                generateImage("opening scene").catch((err) => {
                    log("Opening image failed", err.message || err, {
                        type: "image",
                        level: imageRequestFailureLogLevel(err),
                    });
                });
            };
            setTimeout(start, 0);
        }

        function startOpeningSceneImageNow() {
            const generation = app.gameRuntimeGeneration;
            if (generation !== app.gameRuntimeGeneration) return;
            app.normalImagePriorityUntil = Math.max(
                Math.max(0, Number(app.normalImagePriorityUntil) || 0),
                perfNow() + 5000,
            );
            generateImage("opening scene").catch((err) => {
                log("Opening image failed", err.message || err, {
                    type: "image",
                    level: imageRequestFailureLogLevel(err),
                });
            });
        }

        function queueOneOffCharacterImage(name, reason = "character generated", options = {}) {
            const targetName = String(name || "").trim();
            if (!targetName) return;
            const hasPromptOverrides =
                Object.hasOwn(options, "descriptionOverride") ||
                Object.hasOwn(options, "backgroundOverride");
            if (currentTurnSceneImageCollector()) {
                requestTurnSceneImage(reason, {
                    kind: options.kind || "character",
                    targets: [targetName],
                    immediate: options.immediate === true,
                    ...(Object.hasOwn(options, "descriptionOverride")
                        ? { descriptionOverride: options.descriptionOverride }
                        : {}),
                    ...(Object.hasOwn(options, "backgroundOverride")
                        ? { backgroundOverride: options.backgroundOverride }
                        : {}),
                    ...(hasPromptOverrides ? { skipDuplicateVisualState: false } : {}),
                });
                return;
            }
            const generation = app.gameRuntimeGeneration;
            setTimeout(() => {
                if (generation !== app.gameRuntimeGeneration) return;
                generateImage(reason, {
                    targets: [targetName],
                    clothingOverrides: options.clothingOverrides || {},
                    heldItemsOverrides: options.heldItemsOverrides || {},
                    ...(Object.hasOwn(options, "descriptionOverride")
                        ? { descriptionOverride: options.descriptionOverride }
                        : {}),
                    ...(Object.hasOwn(options, "backgroundOverride")
                        ? { backgroundOverride: options.backgroundOverride }
                        : {}),
                }).catch((err) => {
                    log("Character image failed", err.message || err, {
                        type: "image",
                        level: imageRequestFailureLogLevel(err),
                    });
                });
            }, 0);
        }

        function imageTargetNames(options = {}) {
            const selected = app.state.scene?.image_characters || [];
            const present = app.state.scene?.party_members_present || [];


            const exactSelected = exactImageTargetsForState(selected, app.state);
            const validSelected = [...new Set(exactSelected)].filter((name) =>
                imageEntityFromState(name, app.state),
            );
            if (validSelected.length)
                return validSelected;

            // Empty image target lists are meaningful: the player intentionally
            // removed everyone from image targets. Fall back to the player only
            // at generation time instead of forcing Player back into saved state.
            const playerName = playerEntityDisplayName(app.state);
            if (imageEntityFromState(playerName, app.state)) return [playerName];

            const validPresent = [...new Set(present)].filter((name) =>
                imageEntityFromState(name, app.state),
            );
            if (validPresent.length) return validPresent;

            return [playerName, firstCharacterName()].filter(
                (name, index, all) =>
                    name &&
                    all.indexOf(name) === index &&
                    imageEntityFromState(name, app.state),
            );
        }

        function sceneImageCharacterNames(state = app.state) {
            return [
                playerEntityDisplayName(state),
                ...(state?.scene?.party_members_present || []),
                ...(state?.scene?.npcs_present || []),
            ]
                .map((name) => resolvedEntityDisplayName(name, state, ""))
                .filter((name, index, all) => name && all.indexOf(name) === index);
        }

        function imageTargetsCoverScene(targetNames = [], state = app.state) {
            const sceneNames = sceneImageCharacterNames(state);
            const selectedNames = (Array.isArray(targetNames) ? targetNames : [])
                .map((name) => resolvedEntityDisplayName(name, state, ""))
                .filter((name, index, all) => name && all.indexOf(name) === index);
            return (
                sceneNames.length > 0 &&
                selectedNames.length === sceneNames.length &&
                sceneNames.every((name) => selectedNames.includes(name))
            );
        }





        function imageEntityFromState(name, state = app.state) {
            if (isPlayerEntityName(name, state)) return state.player;
            if (state.characters?.[name]) return state.characters[name];
            const npc = getNpcEntryFromState(state, name);
            if (npc?.inspected && npc.animal_definition) return npc.animal_definition;
            if (npc?.inspected && npc.full_character) return npc.full_character;
            return npc || null;
        }

        function normalImageTargetPresentations(targets = [], entities = []) {
            const output = {};
            const entityByAlias = new Map();
            for (const [name, entity] of entities) {
                for (const alias of [name, entity?.id, entity?.character_id, entity?.name]) {
                    const key = normalizeNameForMatch(alias);
                    if (key && entity && !entityByAlias.has(key))
                        entityByAlias.set(key, entity);
                }
            }
            for (const target of [...new Set(targets)].filter(Boolean)) {
                const entity =
                    imageEntityFromState(target, app.state) ||
                    entityByAlias.get(normalizeNameForMatch(target));
                if (!entity) continue;
                output[String(target)] = profileImageMalePresentation(entity)
                    ? "male"
                    : "non_male";
            }
            return output;
        }

        function imageEntity(name) {
            return imageEntityFromState(name, app.state) || app.profileEntityOverrides?.[String(name || "")] || null;
        }

        function runtimeImageEntity(name) {
            return imageEntity(name);
        }

        function buildGroupImagePrompt(entities, options = {}) {
            if (entities.length === 1) {
                const [name, entity] = entities[0];
                return buildImagePrompt(name, entity, {
                    ...options,
                    clothingOverride: options.clothingOverrides?.[name],
                    heldItemsOverride: options.heldItemsOverrides?.[name],
                });
            }
            const names = entities.map(([name]) => name);
            const promptNames = names.map((name) => promptEntityName(name, app.state));

            const includeSceneImageAction = imageTargetsCoverScene(names, app.state);
            const exactCount = entities.length;
            const countWord = numberWordForPrompt(exactCount);

            return joinPromptParts([
                `${countWord}-character scene, exactly ${exactCount} characters total in frame`,
                `Characters in image: ${promptNames.join(", ")}`,
                `show only these ${exactCount} named characters, zero extra people, zero background bystanders`,
                "no silhouettes, no shadow figures",
                "clear multi-character composition centered on the named characters",
                ...entities.map(([name, entity], index) =>
                    buildGroupSubjectPrompt(name, entity, index + 1, options),
                ),
                Object.prototype.hasOwnProperty.call(options, "backgroundOverride")
                    ? cleanPromptText(options.backgroundOverride)
                    : imagePromptLocation({}, app.state.location),
                !includeSceneImageAction
                    ? ""
                    : cleanImageAction(app.state.scene?.image_action),
            ]);
        }





        function numberWordForPrompt(value) {
            return {
                1: "one",
                2: "two",
                3: "three",
                4: "four",
                5: "five",
                6: "six",
            }[Number(value)] || String(value || "");
        }

        function buildGroupSubjectPrompt(name, entity, index = 0, options = {}) {
            if (imageEntityIsAnimal(entity)) {
                return joinPromptParts([
                    `${index ? `Character ${index}` : "Character"}: ${entity.name || name}`,
                    cleanPromptText(entity.species),
                    cleanPromptText(entity.physical_description),
                    cleanPromptText(entity.state_of_mind),
                    cleanPromptText(entity.physical_state),
                    cleanPromptText(entity.pose),
                    "animal anatomy, no humanoid anatomy, no clothing",
                ]);
            }
            const a = entity.appearance || {};
            const promptContext = createImagePromptContext(entity, {
                group: true,
                includesLowerBody: true,
            });
            const clothing = projectClothingForImagePrompt(
                options.clothingOverrides?.[name] || imagePromptClothingForEntity(name, entity),
                entity,
                promptContext,
            );
            promptContext.chestCovered = hasUpperBodyCovering(clothing);
            const heldItemPhrase = joinHeldItems(
                options.heldItemsOverrides?.[name] || entity.held_items || {},
            );
            const promptName = entity.name || (name === "Player" ? app.state.player?.name : name) || name;
            return joinPromptParts([
                `${index ? `Character ${index}` : "Character"}: ${promptName}`,
                buildTraitPhrase(promptName, entity, { includeName: false }),
                buildBodyStatPrompt(a, entity, promptContext),
                a.extra_description,
                presentationOnlyExtraDescription(entity),
                promptContext.includesLowerBody
                    ? a.extra_description_lower_body
                    : "",
                entity.state_of_mind,
                entity.physical_state,
                entity.pose,
                groupClothingPhrase(clothing, entity, promptContext),
                heldItemPhrase,
            ]);
        }

        function groupClothingPhrase(clothing, entity = {}, promptContext = {}) {
            return joinPromptParts([
                joinVisibleClothing(clothing, { entity }),
                isBarefoot(clothing) ? "barefoot" : "",
            ]);
        }

        function sanitizeImagePromptForMode(prompt, options = {}) {
            return joinPromptParts(
                String(prompt || "")
                    .split(/\s*,\s*/)
                    .map((part) => part.replace(/[.!?]+$/, "").trim()),
            );
        }

        function trimChildren(el, max) {
            while (el.children.length > max) {
                const child =
                    el.lastElementChild || el.children[el.children.length - 1];
                if (!child?.remove) break;
                child.remove();
            }
        }

        function imageGenerationIframeHostMap() {
            app.imageGenerationIframeHosts ||= {};
            return app.imageGenerationIframeHosts;
        }

        function rememberImageGenerationIframeHost(key = "", iframeEl = null) {
            const id = textSlot(key, "");
            if (!id || !iframeEl) return false;
            imageGenerationIframeHostMap()[id] = {
                iframeEl,
                startedAt: Date.now(),
            };
            return true;
        }

        function removeImageGenerationIframeHost(key = "", reason = "removed") {
            const id = textSlot(key, "");
            if (!id) return false;
            const map = imageGenerationIframeHostMap();
            const existing = map[id];
            if (!existing) return false;
            try {
                existing.iframeEl?.remove?.();
            } catch (err) {
                devLog("Image iframe host cleanup failed", {
                    key: id,
                    reason,
                    error: err?.message || String(err),
                });
            }
            delete map[id];
            log("Image generation iframe cleared", `Cleared hidden image generation host for ${id}.`, {
                type: "image",
                level: "message",
                details: { key: id, reason },
            });
            return true;
        }

        function activatePluginIframes(container = document) {
            app.pluginIframeActivationQueue ||= [];
            app.pluginIframeActivationSet ||= new WeakSet();
            const queue = app.pluginIframeActivationQueue;
            const queued = app.pluginIframeActivationSet;

            const drain = () => {
                app.pluginIframeActivationFrame = 0;
                const iframe = queue.shift();
                if (iframe?.isConnected && !iframe.src && iframe.dataset.src) {
                    iframe.loading = "lazy";
                    iframe.src = iframe.dataset.src;
                }
                if (queue.length)
                    app.pluginIframeActivationFrame = requestAnimationFrame(drain);
            };
            const enqueue = (iframe) => {
                if (!iframe || queued.has(iframe) || iframe.src || !iframe.dataset.src) return;
                queued.add(iframe);
                queue.push(iframe);
                if (!app.pluginIframeActivationFrame)
                    app.pluginIframeActivationFrame = requestAnimationFrame(drain);
            };

            container?.querySelectorAll?.("img").forEach((img) => {
                img.loading = "lazy";
                img.decoding = "async";
            });
            const iframes = [...(container?.querySelectorAll?.("iframe[data-src]:not([src])") || [])];
            if (typeof IntersectionObserver !== "function") {
                iframes.forEach(enqueue);
                return;
            }
            app.pluginIframeObserver ||= new IntersectionObserver(
                (entries, observer) => {
                    for (const entry of entries) {
                        if (!entry.isIntersecting) continue;
                        observer.unobserve(entry.target);
                        enqueue(entry.target);
                    }
                },
                { rootMargin: "500px 0px" },
            );
            iframes.forEach((iframe) => {
                iframe.loading = "lazy";
                app.pluginIframeObserver.observe(iframe);
            });
        }

        async function generateImageHtml(
            prompt,
            negativePrompt,
            seed,
            imageModel = app.settings.imageModel,
            options = {},
        ) {
            const imageProvider = generationPreferences().image;
            const promptText = String(prompt || "");
            const visiblePromptText = promptText
                .replace(/\((?:seed|resolution|negativePrompt|guidanceScale|size|width|height|style|saveTitle|saveDescription):::[\s\S]*?\)/gi, "")
                .trim();
            if (!visiblePromptText)
                throw new Error("Image generation needs a real prompt, not an empty or parameter-only prompt.");
            if (!devSmokeCurrentScenarioAllowsImageRequests()) {
                const err = devSmokeBlockedImageRequestError(options);
                devLog("Smoke image generation blocked", {
                    label: options.label || options.promptType || "image generation",
                    scenario: devSmokeSuiteState().currentScenario || "",
                    promptType: options.promptType || "",
                    promptPreview: visiblePromptText.slice(0, 500),
                    error: err.message,
                });
                throw err;
            }

            const promptData = {
                prompt: perchancePluginPromptValue(promptText),
                negativePrompt,
                seed: seed == null ? seed : String(seed),
                resolution: ["hosting-proxy", "direct-provider"].includes(imageProvider)
                    ? EmberGenerationContract.hostedImageResolution(options.resolution)
                    : options.resolution || "512x768",
            };
            if (app.settings?.devMode) {
                rememberPromptEditorAiCall("images", {
                    label: options.label || "image generation",
                    promptType: options.promptType || options.label || "image generation",
                    prompt: promptText,
                    negativePrompt: String(negativePrompt || ""),
                    seed: seed ?? "random",
                    resolution: promptData.resolution,
                    imageModel,
                    snapshot: promptEditorSnapshotForReplay({
                        sourceLabel: options.label || "image generation",
                        imageOptions: clone(options || {}),
                        promptEditorReplay: clone(options.promptEditorReplay || {}),
                    }),
                    at: new Date().toISOString(),
                });
            }

            if (["hosting-proxy", "direct-provider"].includes(imageProvider))
                return await generateHostedImageHtml(promptText, negativePrompt, seed, {...options, resolution: promptData.resolution});

            const imagePlugin = perchancePlugin("textToImagePlugin");
            if (!imagePlugin) {
                if (options.requirePlugin)
                    throw new Error("Perchance text-to-image plugin is not available.");

                return "";
            }

            try {
                const resultObj = imagePlugin(promptData);
                if (typeof options.onPluginResult === "function") {
                    options.onPluginResult(resultObj);
                }

                if (resultObj?.onFinishPromise) {
                    let iframeEl = null;
                    if (resultObj.iframeHtml) {
                        if (typeof options.onIframe === "function") {
                            options.onIframe(resultObj.iframeHtml, null);
                        }
                        if (!options.onIframe || options.ensureIframeHost) {
                            const tmp = document.createElement("div");
                            tmp.innerHTML = resultObj.iframeHtml;
                            iframeEl = tmp.firstElementChild;
                            if (iframeEl) {
                                const iframeHostKey = textSlot(options.iframeHostKey, "");
                                if (iframeHostKey) {
                                    removeImageGenerationIframeHost(
                                        iframeHostKey,
                                        "replacing hidden image generation iframe",
                                    );
                                }
                                if (options.ensureIframeHost) {
                                    iframeEl.style.position = "fixed";
                                    // The Perchance plugin starts work through an
                                    // IntersectionObserver, so its request iframe
                                    // must remain inside the viewport.
                                    iframeEl.style.left = "0";
                                    iframeEl.style.top = "0";
                                    iframeEl.style.width = "300px";
                                    iframeEl.style.height = "300px";
                                    iframeEl.style.opacity = "0";
                                    iframeEl.style.pointerEvents = "none";
                                    iframeEl.style.zIndex = "-1";
                                    iframeEl.setAttribute(
                                        "aria-hidden",
                                        "true",
                                    );
                                }
                                document.body.append(iframeEl);
                                if (iframeHostKey) {
                                    rememberImageGenerationIframeHost(iframeHostKey, iframeEl);
                                }
                                if (
                                    options.ensureIframeHost &&
                                    iframeEl.dataset.src &&
                                    !iframeEl.hasAttribute("src")
                                ) {
                                    iframeEl.setAttribute("loading", "eager");
                                    iframeEl.setAttribute("src", iframeEl.dataset.src);
                                } else {
                                    activatePluginIframes(document.body);
                                }
                                if (typeof options.onIframe === "function") {
                                    options.onIframe(resultObj.iframeHtml, iframeEl);
                                }
                            }
                        }
                    }

                    try {
                        const resultData = await waitForImageRequestWithTimeout(
                            resultObj.onFinishPromise,
                            options,
                        );
                        const dataUrl =
                            resultData?.dataUrl ||
                            resultData?.url ||
                            resultData?.canvas?.toDataURL?.("image/jpeg");
                        if (dataUrl)
                            return `<img src="${escapeHtml(dataUrl)}" alt="Generated image">`;
                    } finally {
                        const iframeHostKey = textSlot(options.iframeHostKey, "");
                        if (
                            iframeHostKey &&
                            app.imageGenerationIframeHosts?.[iframeHostKey]?.iframeEl === iframeEl
                        ) {
                            delete app.imageGenerationIframeHosts[iframeHostKey];
                        }
                        iframeEl?.remove?.();
                    }
                }

                return imageHtmlToString(resultObj) || resultObj || "";
            } catch (objectErr) {
                devLog("Image plugin object call failed", {
                    label: "image generation",
                    error: objectErr.message || String(objectErr),
                    summary:
                        "Text-to-image plugin rejected the request.",
                });
                throw objectErr;
            }
        }

