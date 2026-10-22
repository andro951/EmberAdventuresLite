
        function mergeStartingKnownFacts(base = [], additions = []) {
            const out = Array.isArray(base) ? clone(base) : [];
            const seen = new Set(out.map((value) => JSON.stringify(value)));
            for (const value of Array.isArray(additions) ? additions : []) {
                const key = JSON.stringify(value);
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(clone(value));
            }
            return out;
        }

        function applyAnyPlayerStartingState(character = {}, overlayValue = {}) {
            const overlay = clone(overlayValue);
            const player = clone(character || {});
            delete player.clothing;
            if (Object.hasOwn(overlay, "role")) player.role = overlay.role;
            if (Object.hasOwn(overlay, "starting_known_facts_to_add")) {
                const mergedStartingKnownFacts = mergeStartingKnownFacts(
                    player.starting_known_facts,
                    overlay.starting_known_facts_to_add,
                );
                player.starting_known_facts = mergedStartingKnownFacts;
                player.known_facts = mergeStartingKnownFacts(
                    player.known_facts,
                    mergedStartingKnownFacts,
                );
            }
            if (Object.hasOwn(overlay, "starting_inventory")) {
                player.starting_inventory = clone(overlay.starting_inventory);
                player.inventory = clone(overlay.starting_inventory);
            }
            if (Object.hasOwn(overlay, "stats")) player.stats = clone(overlay.stats);
            if (Object.hasOwn(overlay, "starting_held_items")) {
                player.starting_held_items = clone(overlay.starting_held_items);
                player.held_items = clone(overlay.starting_held_items);
            }
            for (const [startingKey, runtimeKey] of [
                ["starting_state_of_mind", "state_of_mind"],
                ["starting_physical_state", "physical_state"],
                ["starting_pose", "pose"],
            ]) {
                if (!Object.hasOwn(overlay, startingKey)) continue;
                player[startingKey] = overlay[startingKey];
                player[runtimeKey] = overlay[startingKey];
            }
            const male = normalizedCharacterGender(player.gender) === "male";
            const outfitsKey = male ? "male_outfits" : "non_male_outfits";
            const startingOutfitKey = male
                ? "male_starting_outfit_id"
                : "non_male_starting_outfit_id";
            if (Object.hasOwn(overlay, outfitsKey)) {
                player.outfits = clone(overlay[outfitsKey]);
                const requestedId = textSlot(overlay[startingOutfitKey], "");
                const selected =
                    player.outfits.find((outfit) => textSlot(outfit?.id, "") === requestedId) ||
                    player.outfits[0];
                const selectedId = textSlot(selected?.id, "");
                player.starting_outfit_id = selectedId;
                player.active_outfit_id = selectedId;
            }
            delete player.clothing;
            return player;
        }

        function applySelectedStoryPlayerToState(state, playerOption = null, template = {}) {
            if (!playerOption?.character) return state;
            let selectedCharacter = clone(playerOption.character);
            if (playerOption.presentationGender)
                selectedCharacter = characterLibraryPresentation(
                    selectedCharacter,
                    playerOption.id || playerOption.name || selectedCharacter.name,
                    playerOption.presentationGender,
                    { allowNonRomanceable: true },
                );
            const selectedName = textSlot(
                selectedCharacter.name || playerOption.name,
                "Player",
            );
            const liveOptionCharacter = app.profileEntityOverrides?.[selectedName];
            if (liveOptionCharacter && activeProfileImage(liveOptionCharacter)) {
                resolveActiveProfileImageReference(liveOptionCharacter);
                selectedCharacter.profile_images = clone(liveOptionCharacter.profile_images || []);
                selectedCharacter.profile_image_id = liveOptionCharacter.profile_image_id || "";
                if (liveOptionCharacter.profile_default_image_attempted_url)
                    selectedCharacter.profile_default_image_attempted_url =
                        liveOptionCharacter.profile_default_image_attempted_url;
            }
            state.player = playerOption.fromCharacterLibrary
                ? applyAnyPlayerStartingState(
                      selectedCharacter,
                      template.any_player_starting_state,
                  )
                : selectedCharacter;
            delete state.player.clothing;
            state.meta ||= {};
            state.meta.selected_player_name = selectedName;
            state.meta.selected_player_gender =
                playerOption.presentationGender ||
                supportedAdaptiveCharacterGender(state.player?.gender);
            delete state.players;
            return state;
        }

        function selectedStoryPlayerRuntimeId(playerOption = null) {
            const id = textSlot(playerOption?.character?.id || playerOption?.id, "");
            if (!id)
                throw new Error(
                    "Story player options require a non-empty character id before a game can start.",
                );
            return id;
        }

        function applySelectedStoryPlayerRuntimeId(state, playerId = "") {
            const id = textSlot(playerId, "");
            if (!id || !isPlainObject(state?.player))
                throw new Error("Story runtime player id is required and cannot be empty.");
            // Presentation materialization may swap a player name and outfits, but
            // it must never change the stable authored identity used by routes.
            state.player.id = id;
            return id;
        }



        function hasOwnMetadataFlag(source, key) {
            return !!source && Object.prototype.hasOwnProperty.call(source, key);
        }

        function approvedGenreList(values) {
            return exactEntertainmentPreferences(values || []);
        }

        function genreDisplayLabel(value = "") {
            return String(value || "")
                .trim()
                .split("-")
                .map((part) =>
                    part
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((word) =>
                            word
                                ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                : "",
                        )
                        .join(" "),
                )
                .filter(Boolean)
                .join("-");
        }

        function genreDisplayList(values = []) {
            return approvedGenreList(values).map(genreDisplayLabel).filter(Boolean);
        }

        function storyGenrePromptText(state = app.state) {
            const genres = approvedGenreList(state?.meta?.genres || []);
            return genres.length ? genres.join(" ") : "";
        }

        function sourceCanonRuleForPrompt(state = app.state) {
            return String(state?.meta?.story_source?.mode || "").trim() === "existing"
                ? "Do not use outside canon/source knowledge to identify unnamed people, future companions, future locations, future relationships, or future story events. If a future character or npc has not been named in the current state or the current objective, do not use them."
                : "";
        }







        function characterAppearanceScaleValidationErrors(character, rootPath = "character") {
            if (!isPlainObject(character?.appearance)) return [];
            const errors = [];
            for (const field of CHARACTER_APPEARANCE_SCALE_FIELDS) {
                const path = `${rootPath}.appearance.${field}`;
                const value = character.appearance[field];
                if (typeof value === "number") {
                    if (!Number.isSafeInteger(value) || value < 0 || value > 20)
                        errors.push(validationError(path, "range", `${path} must be a whole number from 0 to 20.`));
                    continue;
                }
                const text = typeof value === "string" ? value.trim() : "";
                const numericText = /^-?\d+(?:\.\d+)?$/.test(text);
                if (text && !numericText) continue;
                errors.push(validationError(
                    path,
                    "type",
                    `${path} must be a whole number from 0 to 20 or a non-empty custom description.`,
                ));
            }
            return errors;
        }

        function characterStatsValidationErrors(
            character,
            rootPath = "character",
            options = {},
        ) {
            if (!Object.hasOwn(character || {}, "stats")) return [];
            if (!isPlainObject(character.stats))
                return [
                    validationError(
                        `${rootPath}.stats`,
                        "type",
                        "Character stats must be an object of finite numeric values.",
                    ),
                ];
            const errors = [];
            for (const [key, value] of Object.entries(character.stats)) {
                if (!textSlot(key, ""))
                    errors.push(
                        validationError(
                            `${rootPath}.stats`,
                            "key",
                            "Character stat names cannot be blank.",
                        ),
                    );
                if (
                    !Number.isFinite(value) ||
                    Math.abs(value) > Number.MAX_SAFE_INTEGER ||
                    (!options.allowDecimals && !Number.isSafeInteger(value))
                )
                    errors.push(
                        validationError(
                            `${rootPath}.stats.${key}`,
                            options.allowDecimals ? "number" : "integer",
                            options.allowDecimals
                                ? "Character stat values must be finite safe numbers."
                                : "Reusable character stat values must be safe integers; story-specific decimal stats require story numeric_precision metadata.",
                        ),
                    );
            }
            return errors;
        }

        function characterKnownFactsValidationErrors(
            character,
            rootPath = "character",
        ) {
            if (!isPlainObject(character)) return [];
            const errors = [];
            if (Object.hasOwn(character, "durable_known_facts"))
                errors.push(
                    validationError(
                        `${rootPath}.durable_known_facts`,
                        "renamed",
                        "durable_known_facts was renamed to starting_known_facts.",
                    ),
                );
            if (
                Object.hasOwn(character, "starting_known_facts") &&
                !Array.isArray(character.starting_known_facts)
            )
                errors.push(
                    validationError(
                        `${rootPath}.starting_known_facts`,
                        "type",
                        "starting_known_facts must be an array.",
                    ),
                );
            return errors;
        }

        function numericPrecisionMaps(input = {}) {
            return {
                story_inventory: isPlainObject(input?.story_inventory)
                    ? input.story_inventory
                    : {},
                character_stats: isPlainObject(input?.character_stats)
                    ? input.character_stats
                    : {},
            };
        }

        function numericPrecisionValidationErrors(input = {}, rootPath = "state.numeric_precision") {
            if (input == null) return [];
            if (!isPlainObject(input))
                return [
                    validationError(
                        rootPath,
                        "type",
                        "numeric_precision must be an object with story_inventory and character_stats maps.",
                    ),
                ];
            const errors = [
                ...exactObjectFieldValidationErrors(
                    input,
                    ["story_inventory", "character_stats"],
                    rootPath,
                ),
            ];
            const forbidden = new Set(["__proto__", "prototype", "constructor"]);
            for (const mapName of ["story_inventory", "character_stats"]) {
                const map = input[mapName];
                if (map == null) continue;
                if (!isPlainObject(map)) {
                    errors.push(
                        validationError(
                            `${rootPath}.${mapName}`,
                            "type",
                            `${mapName} numeric precision must be an object.`,
                        ),
                    );
                    continue;
                }
                for (const [key, precision] of Object.entries(map)) {
                    if (!textSlot(key, ""))
                        errors.push(
                            validationError(
                                `${rootPath}.${mapName}`,
                                "key",
                                "Numeric precision field names cannot be blank.",
                            ),
                        );
                    else if (forbidden.has(key))
                        errors.push(
                            validationError(
                                `${rootPath}.${mapName}.${key}`,
                                "unsafe",
                                `Numeric precision keys cannot be "${key}".`,
                            ),
                        );
                    if (!Number.isInteger(precision) || precision < 1 || precision > 6)
                        errors.push(
                            validationError(
                                `${rootPath}.${mapName}.${key}`,
                                "range",
                                "Numeric precision must be an integer from 1 through 6.",
                            ),
                        );
                }
            }
            return errors;
        }

        function numberFitsPrecision(value, precision = 0) {
            if (!Number.isFinite(value)) return false;
            const rational = rationalFromNumber(value);
            const scale = decimalScaleBigInt(precision);
            const scaledNumerator = rational.numerator * scale;
            if (scaledNumerator % rational.denominator !== 0n) return false;
            return (
                absoluteBigInt(scaledNumerator / rational.denominator) <=
                BigInt(Number.MAX_SAFE_INTEGER)
            );
        }

        function storyNumericValueValidationErrors(template = {}) {
            const state = template?.state || {};
            const rawPrecision = state.numeric_precision ?? template.numeric_precision;
            const precision = numericPrecisionMaps(rawPrecision);
            const errors = numericPrecisionValidationErrors(rawPrecision);
            for (const [key, value] of Object.entries(state.story_inventory || {})) {
                if (key === "items" || typeof value !== "number") continue;
                const places = precision.story_inventory[key] || 0;
                if (!numberFitsPrecision(value, places))
                    errors.push(
                        validationError(
                            `state.story_inventory.${key}`,
                            "precision",
                            places
                                ? `Story inventory ${key} must use at most ${places} decimal places.`
                                : `Story inventory ${key} must be an integer unless it is declared in numeric_precision.story_inventory.`,
                        ),
                    );
            }
            for (const entry of storyDefinitionCharacterEntries(template)) {
                for (const [key, value] of Object.entries(entry.character?.stats || {})) {
                    if (typeof value !== "number") continue;
                    const places = precision.character_stats[key] || 0;
                    if (!numberFitsPrecision(value, places))
                        errors.push(
                            validationError(
                                `${entry.path}.stats.${key}`,
                                "precision",
                                places
                                    ? `Character stat ${key} must use at most ${places} decimal places.`
                                    : `Character stat ${key} must be an integer unless it is declared in numeric_precision.character_stats.`,
                            ),
                        );
                }
            }
            const anyPlayerStats = template?.any_player_starting_state?.stats;
            if (isPlainObject(anyPlayerStats)) {
                for (const [key, value] of Object.entries(anyPlayerStats)) {
                    if (typeof value !== "number") continue;
                    const places = precision.character_stats[key] || 0;
                    if (!numberFitsPrecision(value, places))
                        errors.push(
                            validationError(
                                `any_player_starting_state.stats.${key}`,
                                "precision",
                                places
                                    ? `Any-player stat ${key} must use at most ${places} decimal places.`
                                    : `Any-player stat ${key} must be an integer unless it is declared in numeric_precision.character_stats.`,
                            ),
                        );
                }
            }
            return errors;
        }

        function anyPlayerStartingStateValidationErrors(template = {}) {
            const errors = [];
            if (
                Object.hasOwn(template, "allow_any_player") &&
                typeof template.allow_any_player !== "boolean"
            )
                errors.push(
                    validationError(
                        "allow_any_player",
                        "type",
                        "allow_any_player must be true or false.",
                    ),
                );
            if (!Object.hasOwn(template, "any_player_starting_state")) return errors;
            const overlay = template.any_player_starting_state;
            if (!isPlainObject(overlay)) {
                errors.push(
                    validationError(
                        "any_player_starting_state",
                        "type",
                        "any_player_starting_state must be an object when provided.",
                    ),
                );
                return errors;
            }
            const allowedKeys = new Set([
                "role",
                "starting_known_facts_to_add",
                "starting_inventory",
                "stats",
                "starting_held_items",
                "starting_state_of_mind",
                "starting_physical_state",
                "starting_pose",
                "male_outfits",
                "male_starting_outfit_id",
                "non_male_outfits",
                "non_male_starting_outfit_id",
            ]);
            for (const key of Object.keys(overlay)) {
                if (!allowedKeys.has(key))
                    errors.push(
                        validationError(
                            `any_player_starting_state.${key}`,
                            "field",
                            `${key} is not a supported any-player starting field.`,
                        ),
                    );
            }
            for (const key of [
                "role",
                "starting_state_of_mind",
                "starting_physical_state",
                "starting_pose",
                "male_starting_outfit_id",
                "non_male_starting_outfit_id",
            ]) {
                if (
                    Object.hasOwn(overlay, key) &&
                    (typeof overlay[key] !== "string" || !overlay[key].trim())
                )
                    errors.push(
                        validationError(
                            `any_player_starting_state.${key}`,
                            "required",
                            `${key} must be a nonblank string when provided.`,
                        ),
                    );
            }
            for (const key of ["starting_known_facts_to_add", "starting_inventory"]) {
                if (Object.hasOwn(overlay, key) && !Array.isArray(overlay[key]))
                    errors.push(
                        validationError(
                            `any_player_starting_state.${key}`,
                            "type",
                            `${key} must be an array when provided.`,
                        ),
                    );
            }
            if (Object.hasOwn(overlay, "starting_held_items") && !isPlainObject(overlay.starting_held_items))
                errors.push(
                    validationError(
                        "any_player_starting_state.starting_held_items",
                        "type",
                        "starting_held_items must be an object when provided.",
                    ),
                );
            else if (Object.hasOwn(overlay, "starting_held_items"))
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        overlay.starting_held_items,
                        CHARACTER_HELD_ITEM_FIELDS,
                        "any_player_starting_state.starting_held_items",
                    ),
                    ...requiredExactFieldsValidationErrors(
                        overlay.starting_held_items,
                        CHARACTER_HELD_ITEM_FIELDS,
                        "any_player_starting_state.starting_held_items",
                    ),
                );
            if (Object.hasOwn(overlay, "stats"))
                errors.push(
                    ...characterStatsValidationErrors(
                        { stats: overlay.stats },
                        "any_player_starting_state",
                        { allowDecimals: true },
                    ),
                );
            for (const [outfitsKey, selectedKey] of [
                ["male_outfits", "male_starting_outfit_id"],
                ["non_male_outfits", "non_male_starting_outfit_id"],
            ]) {
                const hasOutfits = Object.hasOwn(overlay, outfitsKey);
                const hasSelected = Object.hasOwn(overlay, selectedKey);
                if (!hasOutfits && hasSelected) {
                    errors.push(
                        validationError(
                            `any_player_starting_state.${selectedKey}`,
                            "reference",
                            `${selectedKey} cannot be used without ${outfitsKey}.`,
                        ),
                    );
                    continue;
                }
                if (!hasOutfits) continue;
                const rawOutfits = overlay[outfitsKey];
                if (!Array.isArray(rawOutfits) || !rawOutfits.length) {
                    errors.push(
                        validationError(
                            `any_player_starting_state.${outfitsKey}`,
                            "required",
                            `${outfitsKey} must be a nonempty outfit array when provided.`,
                        ),
                    );
                    continue;
                }
                const outfitIds = new Set();
                for (let index = 0; index < rawOutfits.length; index++) {
                    const outfit = rawOutfits[index];
                    const outfitPath = `any_player_starting_state.${outfitsKey}.${index}`;
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            outfit,
                            CHARACTER_OUTFIT_FIELDS,
                            outfitPath,
                        ),
                        ...requiredExactFieldsValidationErrors(
                            outfit,
                            ["id", "name", "clothing"],
                            outfitPath,
                        ),
                        ...exactObjectFieldValidationErrors(
                            outfit?.clothing,
                            CHARACTER_CLOTHING_FIELDS,
                            `${outfitPath}.clothing`,
                        ),
                    );

                    for (const [slot, value] of Object.entries(outfit?.clothing || {}))
                        if (value !== null && typeof value !== "string")
                            errors.push(
                                validationError(
                                    `${outfitPath}.clothing.${slot}`,
                                    "type",
                                    `${outfitPath}.clothing.${slot} must be text or null.`,
                                ),
                            );
                    const outfitId = outfit?.id;
                    if (typeof outfitId === "string" && outfitId.trim()) {
                        if (outfitIds.has(outfitId))
                            errors.push(
                                validationError(
                                    `${outfitPath}.id`,
                                    "duplicate",
                                    `${outfitsKey} contains duplicate outfit id ${outfitId}.`,
                                ),
                            );
                        outfitIds.add(outfitId);
                    }
                }
                const selectedId = overlay[selectedKey];
                if (!selectedId)
                    errors.push(
                        validationError(
                            `any_player_starting_state.${selectedKey}`,
                            "required",
                            `${selectedKey} is required when ${outfitsKey} is provided.`,
                        ),
                    );
                else if (!outfitIds.has(selectedId))
                    errors.push(
                        validationError(
                            `any_player_starting_state.${selectedKey}`,
                            "reference",
                            `${selectedKey} must reference an outfit id in ${outfitsKey}.`,
                        ),
                    );
            }
            return errors;
        }

        function characterImagePromptValidationErrors(
            character,
            rootPath = "character",
        ) {
            const errors = [];
            for (const field of [
                "male_only_extra_description",
                "non_male_only_extra_description",
            ]) {
                if (
                    isPlainObject(character?.appearance) &&
                    Object.hasOwn(character.appearance, field) &&
                    character.appearance[field] !== null &&
                    typeof character.appearance[field] !== "string"
                )
                    errors.push(
                        validationError(
                            `${rootPath}.appearance.${field}`,
                            "type",
                            `Character appearance.${field} must be text or null when present.`,
                        ),
                    );
            }
            if (
                isPlainObject(character?.appearance) &&
                Object.hasOwn(character.appearance, "nonhuman_lower_body") &&
                typeof character.appearance.nonhuman_lower_body !== "boolean"
            ) {
                errors.push(
                    validationError(
                        `${rootPath}.appearance.nonhuman_lower_body`,
                        "type",
                        "Character appearance.nonhuman_lower_body must be true or false.",
                    ),
                );
            }
            if (
                character?.appearance?.nonhuman_lower_body === true &&
                !textSlot(character.appearance.extra_description_lower_body, "")
            )
                errors.push(
                    validationError(
                        `${rootPath}.appearance.extra_description_lower_body`,
                        "required",
                        "extra_description_lower_body must be non-empty text when nonhuman_lower_body is true and must describe the complete replacement lower-body anatomy.",
                    ),
                );
            const defaultProfile = character?.default_profile_image;
            if (
                isPlainObject(defaultProfile) &&
                [
                    defaultProfile.url,
                    defaultProfile.local_image_id,
                ].some((value) => textSlot(value, "")) &&
                typeof defaultProfile.male !== "boolean"
            )
                errors.push(
                    validationError(
                        `${rootPath}.default_profile_image.male`,
                        "required",
                        "Every configured profile image must declare male as true or false.",
                    ),
                );
            return errors;
        }

        function storyDefinitionCharacterEntries(template = {}) {
            const state = template?.state || {};
            const entries = [];
            const add = (character, path, fallbackId = "") => {
                if (isPlainObject(character)) entries.push({ character, path, fallbackId });
            };
            add(state.player, "state.player", "player");
            if (Array.isArray(state.players))
                state.players.forEach((character, index) =>
                    add(character, `state.players[${index}]`, `player-${index + 1}`),
                );
            Object.entries(state.characters || {}).forEach(([name, character]) =>
                add(character, `state.characters.${name}`, name),
            );
            for (const [locationId, location] of Object.entries(
                state.npc_directory?.locations || {},
            )) {
                for (const [id, npc] of Object.entries(location?.characters || {})) {
                    const animal = isPlainObject(npc?.animal_definition);
                    add(
                        animal ? npc.animal_definition : npc?.full_character,
                        `state.npc_directory.locations.${locationId}.characters.${id}.${animal ? "animal_definition" : "full_character"}`,
                        id,
                    );
                }
            }
            for (const [id, entry] of Object.entries(state.future_cast?.items || {})) {
                const animal = isPlainObject(entry?.animal_definition);
                add(
                    animal ? entry.animal_definition : entry?.full_character,
                    `state.future_cast.items.${id}.${animal ? "animal_definition" : "full_character"}`,
                    id,
                );
            }
            return entries;
        }





        function storyDefinitionEntryIsAnimal(entry = {}) {
            return String(entry.path || "").endsWith(".animal_definition") ||
                (Object.hasOwn(entry.character || {}, "physical_description") &&
                    !Object.hasOwn(entry.character || {}, "appearance"));
        }

        function characterDefinitionStableId(entry = {}) {
            return textSlot(entry.character?.id, "");
        }

        function characterDefinitionExplicitStableId(entry = {}) {
            return textSlot(entry.character?.id, "");
        }

        function storyDefinitionCharacterEntryKind(entry = {}) {
            const path = String(entry?.path || "");
            if (path === "state.player") return "default_player";
            if (/^state\.players(?:\.|\[)/.test(path)) return "player_option";
            if (path.startsWith("state.future_cast.items.")) return "future_cast";
            return "other";
        }

        function intentionalPlayableCastIdOverlap(existing = {}, entry = {}, id = "", template = {}) {
            const state = template?.state || {};
            const playerOptionIds = new Set(
                storyDefinitionCharacterEntries({ state })
                    .filter((item) => storyDefinitionCharacterEntryKind(item) === "player_option")
                    .map(characterDefinitionExplicitStableId)
                    .filter(Boolean),
            );
            if (!playerOptionIds.has(id)) return false;
            const pair = new Set([
                storyDefinitionCharacterEntryKind(existing),
                storyDefinitionCharacterEntryKind(entry),
            ]);
            return (
                (pair.has("default_player") && pair.has("player_option")) ||
                (pair.has("player_option") && pair.has("future_cast")) ||
                (pair.has("default_player") && pair.has("future_cast"))
            );
        }

        function duplicateCharacterDefinitionIdValidationErrors(template = {}) {
            const errors = [];
            const definitions = new Map();
            for (const entry of storyDefinitionCharacterEntries(template)) {
                const id = characterDefinitionExplicitStableId(entry);
                if (!id) continue;
                const existing = definitions.get(id);
                if (!existing) {
                    definitions.set(id, entry);
                    continue;
                }
                if (JSON.stringify(existing.character) === JSON.stringify(entry.character)) continue;
                if (intentionalPlayableCastIdOverlap(existing, entry, id, template)) continue;
                errors.push(
                    validationError(
                        `${entry.path}.id`,
                        "duplicate",
                        `Character id "${id}" conflicts with ${existing.path}.`,
                    ),
                );
            }
            return errors;
        }

        const STORY_EXPORT_FIELDS = Object.freeze([
            "app",
            "exportType",
            "storyTemplate",
            "exportedAt",
        ]);
        const STORY_TEMPLATE_FIELDS = Object.freeze([
            "lite",
            "id",
            "title",
            "description",
            "createdAt",
            "updatedAt",
            "allow_any_player",
            "any_player_starting_state",
            "state",
            "messages",
            "source",
            "app",
            "templateType",
            "creation_tool",
            "genres",
            "default_image_model",
            "editor_data",
            "title_card_subjects",
            "title_card_image",
        ]);
        const STORY_TEMPLATE_REQUIRED_FIELDS = Object.freeze(
            STORY_TEMPLATE_FIELDS.filter((field) => field !== "editor_data"),
        );

        function exactObjectFieldValidationErrors(value, allowedFields, path) {
            if (!isPlainObject(value))
                return [validationError(path, "type", `${path} must be an object.`)];

            const allowed = new Set(allowedFields);
            return Object.keys(value)
                .filter((field) => !allowed.has(field))
                .map((field) =>
                    validationError(
                        `${path}.${field}`,
                        "unknown_field",
                        `${path}.${field} is not an approved field. Field names are exact and case-sensitive.`,
                    ),
                );
        }

        function requiredExactTextValidationErrors(value, path) {
            if (typeof value !== "string")
                return [validationError(path, "type", `${path} must be text.`)];
            if (!value.trim())
                return [validationError(path, "required", `${path} is required.`)];
            return [];
        }

        function liteDefinitionMarkerValidationErrors(value, path) {
            return value?.lite === true
                ? []
                : [validationError(`${path}.lite`, "value", `${path}.lite must be exactly true.`)];
        }

        function requiredExactStringArrayValidationErrors(value, path) {
            if (!Array.isArray(value))
                return [validationError(path, "type", `${path} must be an array.`)];

            const errors = [];
            for (let index = 0; index < value.length; index++) {
                if (typeof value[index] !== "string" || !value[index].trim())
                    errors.push(
                        validationError(
                            `${path}.${index}`,
                            "type",
                            `${path}.${index} must be non-empty text.`,
                        ),
                    );
            }
            return errors;
        }

        function exactGenreValidationErrors(value, path) {
            const errors = requiredExactStringArrayValidationErrors(value, path);
            if (!Array.isArray(value)) return errors;
            if (!value.length)
                errors.push(validationError(path, "required", `${path} must contain at least one approved genre.`));
            const approved = new Set(entertainmentPreferenceOptions());
            for (let index = 0; index < value.length; index++)
                if (typeof value[index] === "string" && !approved.has(value[index]))
                    errors.push(
                        validationError(
                            `${path}.${index}`,
                            "enum",
                            `Genre ${JSON.stringify(value[index])} is not an exact approved genre.`,
                        ),
                    );
            return errors;
        }

        const STORY_STATE_FIELDS = Object.freeze([
            "meta", "location", "world_map", "time", "scene", "player", "players",
            "characters", "npc_directory", "future_cast", "objectives", "story_inventory",
            "story_shops", "story_job_offers", "story_job_offer_history", "active_generated_jobs",
            "story_generated_npc_pool", "world_flags", "story_rules", "story_memory",
            "recent_changes", "story_clock", "story_pacing", "timed_events", "progression",
            "numeric_precision", "reward_templates", "reward_bundles",
            "character_shop_cost_templates",
        ]);
        const STORY_STATE_REQUIRED_FIELDS = Object.freeze([
            "meta", "location", "world_map", "time", "scene", "player",
            "characters", "npc_directory", "world_flags", "objectives", "future_cast",
            "story_rules", "story_memory", "recent_changes", "story_clock",
            "story_pacing", "timed_events",
        ]);
        const STORY_META_FIELDS = Object.freeze([
            "app", "story_guidance", "story_source", "genres", "default_image_model",
        ]);
        const STORY_META_REQUIRED_FIELDS = Object.freeze([
            "app", "story_guidance", "story_source", "genres",
        ]);
        const STORY_SOURCE_FIELDS = Object.freeze(["mode", "title", "description", "modifications"]);
        const STORY_LOCATION_FIELDS = Object.freeze([
            "universe", "world", "continent", "region", "settlement_type", "settlement_name",
            "district", "specific_place", "npc_location_id",
        ]);
        const STORY_WORLD_MAP_FIELDS = Object.freeze([
            "current_location_id", "focus_location_id", "travel_history", "locations",
        ]);
        const STORY_WORLD_LOCATION_FIELDS = Object.freeze([
            "id", "name", "type", "scale", "parent_id", "x", "y", "discovered",
            "travel_enabled", "summary", "detail", "connections", "npcs",
        ]);
        const STORY_TIME_FIELDS = Object.freeze(["year", "month", "day", "hour", "minute"]);
        const STORY_SCENE_FIELDS = Object.freeze([
            "summary", "party_members_present", "image_characters",
            "npcs_present", "speak_targets", "image_action",
        ]);
        const STORY_SCENE_REQUIRED_FIELDS = Object.freeze([
            "summary", "party_members_present",
            "image_characters", "npcs_present", "image_action",
        ]);
        const STORY_OBJECTIVE_STATE_FIELDS = Object.freeze(["active_id", "no_current", "items"]);
        const STORY_MESSAGE_FIELDS = Object.freeze(["role", "speaker", "text", "at"]);
        const STORY_TITLE_CARD_IMAGE_FIELDS = Object.freeze([
            "id", "title", "prompt", "negativePrompt", "seed", "model", "source",
            "url", "hosted_url", "html", "favorite", "upload_attestation_classification", "upload_attested_by",
            "upload_attested_at", "upload_attestation_policy_version",
        ]);
        const STORY_TITLE_CARD_IMAGE_OPTIONAL_FIELDS = Object.freeze([
            "upload_attestation_classification", "upload_attested_by",
            "upload_attested_at", "upload_attestation_policy_version",
        ]);
        const STORY_EDITOR_DATA_FIELDS = Object.freeze(["story_tree"]);
        const STORY_EDITOR_TREE_FIELDS = Object.freeze(["positions", "viewport", "output_modes"]);
        const STORY_EDITOR_TREE_REQUIRED_FIELDS = Object.freeze(["positions", "viewport"]);
        const STORY_EDITOR_VIEWPORT_FIELDS = Object.freeze(["x", "y", "zoom"]);
        const STORY_MEMORY_FIELDS = Object.freeze([
            "world_notes", "unresolved_threads", "relationship_notes", "rules_and_constraints", "ai_private_notes",
        ]);
        const STORY_CLOCK_FIELDS = Object.freeze(["elapsed_minutes", "label"]);
        const STORY_PACING_FIELDS = Object.freeze(["mode", "pending_event_id", "timeline"]);
        const STORY_TIMELINE_EVENT_FIELDS = Object.freeze([
            "id", "title", "status", "objective_id", "trigger", "prompt", "accept",
            "decline", "missed_due_to_conflict", "auto_start",
        ]);
        const STORY_TIMELINE_TRIGGER_FIELDS = Object.freeze([
            "at_elapsed_minutes", "objective_id",
        ]);
        const STORY_TIMELINE_PROMPT_FIELDS = Object.freeze([
            "message", "accept_label", "decline_label",
        ]);
        const STORY_TIMELINE_ACTION_FIELDS = Object.freeze([
            "objective_id", "message", "rewards", "travel_to_location_id",
        ]);
        const STORY_TIMED_EVENT_FIELDS = Object.freeze([
            "id", "title", "status", "visibility", "trigger", "time_limit",
            "cancel_objective_id", "message", "stages", "rewards",
        ]);
        const STORY_TIMED_EVENT_TRIGGER_FIELDS = Object.freeze([
            "objective_id", "immediately",
        ]);
        const STORY_DURATION_FIELDS = Object.freeze(["days", "hours", "minutes"]);
        const STORY_TIMED_EVENT_STAGE_FIELDS = Object.freeze([
            "id", "after", "visibility", "message", "rewards",
        ]);
        const STORY_FUTURE_CAST_FIELDS = Object.freeze(["enabled", "items"]);
        const STORY_FUTURE_CAST_ITEM_FIELDS = Object.freeze([
            "id", "name", "status", "canonical_order", "introduce_as", "can_die",
            "npc_location_id", "location_hint", "scene_presence", "role", "relationship", "note",
            "personality_description", "greeting", "full_character", "animal_definition", "meet_condition",
            "join_condition", "on_unlock", "unlocked_by", "last_triggered_reason",
            "on_purchase_objective", "fallback_name", "outfits", "fallback_outfits",
            "starting_outfit_id", "fallback_starting_outfit_id",
        ]);
        const STORY_FUTURE_CAST_ON_UNLOCK_FIELDS = Object.freeze(["greeting", "image"]);
        const STORY_FUTURE_CAST_UNLOCK_IMAGE_FIELDS = Object.freeze([
            "id", "title", "prompt", "negative_prompt", "seed", "model", "source",
            "url", "favorite",
        ]);
        const STORY_NPC_DIRECTORY_FIELDS = Object.freeze(["locations"]);
        const STORY_NPC_LOCATION_FIELDS = Object.freeze(["label", "characters"]);
        const STORY_NPC_FIELDS = Object.freeze([
            "id", "name", "gender", "age", "role", "relationship", "note", "current_appearance",
            "inspected", "voice", "full_character", "animal_definition", "status", "death_note", "killed_by_player", "killed_by",
            "player_known_name", "player_facing_label", "can_die", "stats",
        ]);
        const STORY_RULE_FIELDS = Object.freeze(["id", "text"]);

        function storyExactScalarValidationErrors(template) {
            const state = template.state;
            const errors = [];
            for (const field of STORY_LOCATION_FIELDS)
                if (Object.hasOwn(state.location || {}, field) && typeof state.location[field] !== "string")
                    errors.push(validationError(`state.location.${field}`, "type", `state.location.${field} must be text.`));
            for (const field of STORY_TIME_FIELDS)
                if (!Number.isSafeInteger(state.time?.[field]))
                    errors.push(validationError(`state.time.${field}`, "type", `state.time.${field} must be a whole number.`));
            for (const field of ["current_location_id", "focus_location_id"])
                errors.push(...requiredExactTextValidationErrors(state.world_map?.[field], `state.world_map.${field}`));
            errors.push(...requiredExactStringArrayValidationErrors(state.world_map?.travel_history, "state.world_map.travel_history"));
            if (!isPlainObject(state.world_map?.locations))
                errors.push(validationError("state.world_map.locations", "type", "state.world_map.locations must be an object keyed by location id."));
            if (!Number.isSafeInteger(state.story_clock?.elapsed_minutes) || state.story_clock.elapsed_minutes < 0)
                errors.push(validationError("state.story_clock.elapsed_minutes", "type", "state.story_clock.elapsed_minutes must be a non-negative whole number."));
            if (typeof state.story_clock?.label !== "string")
                errors.push(validationError("state.story_clock.label", "type", "state.story_clock.label must be text."));
            if (typeof state.objectives?.active_id !== "string")
                errors.push(validationError("state.objectives.active_id", "type", "state.objectives.active_id must be text."));
            if (typeof state.objectives?.no_current !== "boolean")
                errors.push(validationError("state.objectives.no_current", "type", "state.objectives.no_current must be true or false."));
            if (!Array.isArray(state.objectives?.items))
                errors.push(validationError("state.objectives.items", "type", "state.objectives.items must be an array."));
            for (const field of ["summary", "image_action"])
                if (Object.hasOwn(state.scene || {}, field) && typeof state.scene[field] !== "string")
                    errors.push(validationError(`state.scene.${field}`, "type", `state.scene.${field} must be text.`));


            for (const field of ["party_members_present", "image_characters", "npcs_present", "speak_targets"])
                if (Object.hasOwn(state.scene || {}, field) && !Array.isArray(state.scene[field]))
                    errors.push(validationError(`state.scene.${field}`, "type", `state.scene.${field} must be an array.`));
            if (Object.hasOwn(state.future_cast || {}, "enabled") && typeof state.future_cast.enabled !== "boolean")
                errors.push(validationError("state.future_cast.enabled", "type", "state.future_cast.enabled must be true or false."));
            if (!Array.isArray(state.story_rules))
                errors.push(validationError("state.story_rules", "type", "state.story_rules must be an array."));
            else
                for (let index = 0; index < state.story_rules.length; index++) {
                    const path = `state.story_rules.${index}`;
                    const rule = state.story_rules[index];
                    errors.push(
                        ...exactObjectFieldValidationErrors(rule, STORY_RULE_FIELDS, path),
                        ...requiredExactFieldsValidationErrors(rule, STORY_RULE_FIELDS, path),
                        ...requiredExactTextValidationErrors(rule?.id, `${path}.id`),
                        ...requiredExactTextValidationErrors(rule?.text, `${path}.text`),
                    );
                }
            if (!Array.isArray(state.recent_changes))
                errors.push(validationError("state.recent_changes", "type", "state.recent_changes must be an array."));
            else errors.push(...requiredExactStringArrayValidationErrors(state.recent_changes, "state.recent_changes"));
            for (let index = 0; index < (Array.isArray(template.messages) ? template.messages.length : 0); index++) {
                const path = `messages.${index}`;
                const message = template.messages[index];
                for (const field of ["role", "speaker", "text"])
                    errors.push(...requiredExactTextValidationErrors(message?.[field], `${path}.${field}`));

                if (Object.hasOwn(message || {}, "at") && typeof message.at !== "string")
                    errors.push(validationError(`${path}.at`, "type", `${path}.at must be text.`));
            }
            return errors;
        }

        function exactDurationValidationErrors(value, path, options = {}) {
            const errors = exactObjectFieldValidationErrors(value, STORY_DURATION_FIELDS, path);
            if (!isPlainObject(value)) return errors;
            let total = 0;
            for (const field of STORY_DURATION_FIELDS) {
                if (!Object.hasOwn(value, field)) continue;
                const amount = value[field];
                if (!Number.isSafeInteger(amount) || amount < 0)
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "type",
                            `${path}.${field} must be a non-negative whole number.`,
                        ),
                    );
                else total += amount;
            }
            if (options.requirePositive !== false && total <= 0)
                errors.push(
                    validationError(
                        path,
                        "required",
                        `${path} must contain a positive duration.`,
                    ),
                );
            return errors;
        }

        function storyTimedSystemExactValidationErrors(template) {
            const errors = [];
            const state = template.state || {};
            const pacing = state.story_pacing;
            const timedEvents = state.timed_events;

            if (!isPlainObject(pacing))
                errors.push(validationError("state.story_pacing", "type", "state.story_pacing must be an object."));
            else {
                if (!["player_controlled", "time_controlled"].includes(pacing.mode))
                    errors.push(validationError("state.story_pacing.mode", "enum", "state.story_pacing.mode must be exactly player_controlled or time_controlled."));
                if (typeof pacing.pending_event_id !== "string")
                    errors.push(validationError("state.story_pacing.pending_event_id", "type", "state.story_pacing.pending_event_id must be text."));
                if (!isPlainObject(pacing.timeline))
                    errors.push(validationError("state.story_pacing.timeline", "type", "state.story_pacing.timeline must be an object keyed by event id."));
                for (const [eventId, event] of Object.entries(isPlainObject(pacing.timeline) ? pacing.timeline : {})) {
                    const path = `state.story_pacing.timeline.${eventId}`;
                    errors.push(
                        ...exactObjectFieldValidationErrors(event, STORY_TIMELINE_EVENT_FIELDS, path),
                        ...requiredExactFieldsValidationErrors(event, ["id", "title", "status", "trigger", "prompt", "accept", "auto_start"], path),
                    );
                    if (!isPlainObject(event)) continue;
                    if (event.id !== eventId)
                        errors.push(validationError(`${path}.id`, "mismatch", `${path}.id must exactly match its object key.`));
                    for (const field of ["id", "title", "status", "objective_id"])
                        if (Object.hasOwn(event, field) && typeof event[field] !== "string")
                            errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
                    if (typeof event.auto_start !== "boolean")
                        errors.push(validationError(`${path}.auto_start`, "type", `${path}.auto_start must be true or false.`));
                    errors.push(...exactObjectFieldValidationErrors(event.trigger, STORY_TIMELINE_TRIGGER_FIELDS, `${path}.trigger`));
                    if (isPlainObject(event.trigger)) {
                        if (!Object.hasOwn(event.trigger, "at_elapsed_minutes") && !Object.hasOwn(event.trigger, "objective_id"))
                            errors.push(validationError(`${path}.trigger`, "required", `${path}.trigger requires at_elapsed_minutes or objective_id.`));
                        if (Object.hasOwn(event.trigger, "at_elapsed_minutes") && (!Number.isSafeInteger(event.trigger.at_elapsed_minutes) || event.trigger.at_elapsed_minutes < 0))
                            errors.push(validationError(`${path}.trigger.at_elapsed_minutes`, "type", `${path}.trigger.at_elapsed_minutes must be a non-negative whole number.`));
                        if (Object.hasOwn(event.trigger, "objective_id") && (typeof event.trigger.objective_id !== "string" || !event.trigger.objective_id))
                            errors.push(validationError(`${path}.trigger.objective_id`, "required", `${path}.trigger.objective_id must be non-empty text.`));
                    }
                    errors.push(
                        ...exactObjectFieldValidationErrors(event.prompt, STORY_TIMELINE_PROMPT_FIELDS, `${path}.prompt`),
                        ...requiredExactFieldsValidationErrors(event.prompt, STORY_TIMELINE_PROMPT_FIELDS, `${path}.prompt`),
                    );
                    for (const field of STORY_TIMELINE_PROMPT_FIELDS)
                        errors.push(...requiredExactTextValidationErrors(event.prompt?.[field], `${path}.prompt.${field}`));
                    for (const actionName of ["accept", "decline", "missed_due_to_conflict"]) {
                        if (!Object.hasOwn(event, actionName)) continue;
                        const actionPath = `${path}.${actionName}`;
                        errors.push(...exactObjectFieldValidationErrors(event[actionName], STORY_TIMELINE_ACTION_FIELDS, actionPath));
                        if (!isPlainObject(event[actionName])) continue;
                        for (const field of ["objective_id", "message", "travel_to_location_id"])
                            if (Object.hasOwn(event[actionName], field) && typeof event[actionName][field] !== "string")
                                errors.push(validationError(`${actionPath}.${field}`, "type", `${actionPath}.${field} must be text.`));
                        if (Object.hasOwn(event[actionName], "rewards") && !Array.isArray(event[actionName].rewards))
                            errors.push(validationError(`${actionPath}.rewards`, "type", `${actionPath}.rewards must be an array.`));
                    }
                }
            }

            if (!isPlainObject(timedEvents))
                errors.push(validationError("state.timed_events", "type", "state.timed_events must be an object keyed by event id."));
            for (const [eventId, event] of Object.entries(isPlainObject(timedEvents) ? timedEvents : {})) {
                const path = `state.timed_events.${eventId}`;
                errors.push(
                    ...exactObjectFieldValidationErrors(event, STORY_TIMED_EVENT_FIELDS, path),
                    ...requiredExactFieldsValidationErrors(event, ["id", "title", "status", "visibility", "trigger", "time_limit", "stages", "rewards"], path),
                );
                if (!isPlainObject(event)) continue;
                if (event.id !== eventId)
                    errors.push(validationError(`${path}.id`, "mismatch", `${path}.id must exactly match its object key.`));
                for (const field of ["id", "title", "status", "visibility", "cancel_objective_id", "message"])
                    if (Object.hasOwn(event, field) && typeof event[field] !== "string")
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
                if (!["hidden", "vague", "visible"].includes(event.visibility))
                    errors.push(validationError(`${path}.visibility`, "enum", `${path}.visibility must be exactly hidden, vague, or visible.`));
                errors.push(...exactObjectFieldValidationErrors(event.trigger, STORY_TIMED_EVENT_TRIGGER_FIELDS, `${path}.trigger`));
                if (isPlainObject(event.trigger)) {
                    if (!Object.hasOwn(event.trigger, "objective_id") && event.trigger.immediately !== true)
                        errors.push(validationError(`${path}.trigger`, "required", `${path}.trigger requires objective_id or immediately: true.`));
                    if (Object.hasOwn(event.trigger, "objective_id") && (typeof event.trigger.objective_id !== "string" || !event.trigger.objective_id))
                        errors.push(validationError(`${path}.trigger.objective_id`, "required", `${path}.trigger.objective_id must be non-empty text.`));
                    if (Object.hasOwn(event.trigger, "immediately") && typeof event.trigger.immediately !== "boolean")
                        errors.push(validationError(`${path}.trigger.immediately`, "type", `${path}.trigger.immediately must be true or false.`));
                }
                errors.push(...exactDurationValidationErrors(event.time_limit, `${path}.time_limit`));
                if (!Array.isArray(event.stages))
                    errors.push(validationError(`${path}.stages`, "type", `${path}.stages must be an array.`));
                for (let index = 0; index < (Array.isArray(event.stages) ? event.stages.length : 0); index++) {
                    const stage = event.stages[index];
                    const stagePath = `${path}.stages.${index}`;
                    errors.push(
                        ...exactObjectFieldValidationErrors(stage, STORY_TIMED_EVENT_STAGE_FIELDS, stagePath),
                        ...requiredExactFieldsValidationErrors(stage, ["id", "after"], stagePath),
                    );
                    if (!isPlainObject(stage)) continue;
                    errors.push(...requiredExactTextValidationErrors(stage.id, `${stagePath}.id`));
                    errors.push(...exactDurationValidationErrors(stage.after, `${stagePath}.after`));
                    if (Object.hasOwn(stage, "visibility") && !["hidden", "vague", "visible"].includes(stage.visibility))
                        errors.push(validationError(`${stagePath}.visibility`, "enum", `${stagePath}.visibility must be exactly hidden, vague, or visible.`));
                    if (Object.hasOwn(stage, "message") && typeof stage.message !== "string")
                        errors.push(validationError(`${stagePath}.message`, "type", `${stagePath}.message must be text.`));
                    if (Object.hasOwn(stage, "rewards") && !Array.isArray(stage.rewards))
                        errors.push(validationError(`${stagePath}.rewards`, "type", `${stagePath}.rewards must be an array.`));
                }
                if (!Array.isArray(event.rewards))
                    errors.push(validationError(`${path}.rewards`, "type", `${path}.rewards must be an array.`));
            }
            return errors;
        }

        function storyInventoryExactValidationErrors(storyInventory) {
            const errors = [];
            if (!isPlainObject(storyInventory))
                return [validationError("state.story_inventory", "type", "state.story_inventory must be an object.")];
            if (!Object.hasOwn(storyInventory, "items"))
                errors.push(validationError("state.story_inventory.items", "required", "state.story_inventory.items is required."));
            else if (!Array.isArray(storyInventory.items))
                errors.push(validationError("state.story_inventory.items", "type", "state.story_inventory.items must be an array."));
            for (const [field, value] of Object.entries(storyInventory)) {
                const path = `state.story_inventory.${field}`;
                if (field === "items") {
                    for (let index = 0; index < (Array.isArray(value) ? value.length : 0); index++)
                        errors.push(...storyInventoryItemValidationErrors(value[index], `${path}.${index}`));
                    continue;
                }
                if (["string", "number", "boolean"].includes(typeof value)) {
                    if (typeof value === "number" && !Number.isFinite(value))
                        errors.push(validationError(path, "type", `${path} must be a finite number.`));
                    continue;
                }
                if (Array.isArray(value)) {
                    errors.push(...requiredExactStringArrayValidationErrors(value, path));
                    continue;
                }
                errors.push(validationError(path, "type", `${path} must be text, a finite number, true/false, or an array of text.`));
            }
            return errors;
        }

        function storyExactNestedValidationErrors(template) {
            const state = template.state;
            const errors = [
                ...exactObjectFieldValidationErrors(state, STORY_STATE_FIELDS, "state"),
                ...requiredExactFieldsValidationErrors(state, STORY_STATE_REQUIRED_FIELDS, "state"),
                ...exactObjectFieldValidationErrors(state?.meta, STORY_META_FIELDS, "state.meta"),
                ...requiredExactFieldsValidationErrors(state?.meta, STORY_META_REQUIRED_FIELDS, "state.meta"),
                ...exactObjectFieldValidationErrors(state?.meta?.story_source, STORY_SOURCE_FIELDS, "state.meta.story_source"),
                ...requiredExactFieldsValidationErrors(state?.meta?.story_source, STORY_SOURCE_FIELDS, "state.meta.story_source"),
                ...exactObjectFieldValidationErrors(state?.location, STORY_LOCATION_FIELDS, "state.location"),
                ...requiredExactFieldsValidationErrors(state?.location, STORY_LOCATION_FIELDS, "state.location"),
                ...exactObjectFieldValidationErrors(state?.world_map, STORY_WORLD_MAP_FIELDS, "state.world_map"),
                ...requiredExactFieldsValidationErrors(state?.world_map, STORY_WORLD_MAP_FIELDS, "state.world_map"),
                ...exactObjectFieldValidationErrors(state?.time, STORY_TIME_FIELDS, "state.time"),
                ...requiredExactFieldsValidationErrors(state?.time, STORY_TIME_FIELDS, "state.time"),
                ...exactObjectFieldValidationErrors(state?.scene, STORY_SCENE_FIELDS, "state.scene"),
                ...requiredExactFieldsValidationErrors(state?.scene, STORY_SCENE_REQUIRED_FIELDS, "state.scene"),
                ...exactObjectFieldValidationErrors(state?.objectives, STORY_OBJECTIVE_STATE_FIELDS, "state.objectives"),
                ...requiredExactFieldsValidationErrors(state?.objectives, STORY_OBJECTIVE_STATE_FIELDS, "state.objectives"),
                ...exactObjectFieldValidationErrors(state?.story_memory, STORY_MEMORY_FIELDS, "state.story_memory"),
                ...requiredExactFieldsValidationErrors(state?.story_memory, STORY_MEMORY_FIELDS, "state.story_memory"),
                ...exactObjectFieldValidationErrors(state?.story_clock, STORY_CLOCK_FIELDS, "state.story_clock"),
                ...requiredExactFieldsValidationErrors(state?.story_clock, STORY_CLOCK_FIELDS, "state.story_clock"),
                ...exactObjectFieldValidationErrors(state?.story_pacing, STORY_PACING_FIELDS, "state.story_pacing"),
                ...requiredExactFieldsValidationErrors(state?.story_pacing, STORY_PACING_FIELDS, "state.story_pacing"),
                ...exactObjectFieldValidationErrors(state?.future_cast, STORY_FUTURE_CAST_FIELDS, "state.future_cast"),
                ...requiredExactFieldsValidationErrors(state?.future_cast, STORY_FUTURE_CAST_FIELDS, "state.future_cast"),
                ...exactObjectFieldValidationErrors(state?.npc_directory, STORY_NPC_DIRECTORY_FIELDS, "state.npc_directory"),
                ...requiredExactFieldsValidationErrors(state?.npc_directory, STORY_NPC_DIRECTORY_FIELDS, "state.npc_directory"),
                ...exactObjectFieldValidationErrors(template.title_card_image, STORY_TITLE_CARD_IMAGE_FIELDS, "title_card_image"),
                ...requiredExactFieldsValidationErrors(
                    template.title_card_image,
                    STORY_TITLE_CARD_IMAGE_FIELDS.filter(
                        (field) => !STORY_TITLE_CARD_IMAGE_OPTIONAL_FIELDS.includes(field),
                    ),
                    "title_card_image",
                ),
            ];

            for (const field of [
                "upload_attestation_classification",
                "upload_attested_by",
                "upload_attested_at",
            ]) {
                if (
                    Object.hasOwn(template.title_card_image || {}, field) &&
                    typeof template.title_card_image[field] !== "string"
                )
                    errors.push(
                        validationError(
                            `title_card_image.${field}`,
                            "type",
                            `title_card_image.${field} must be text when present.`,
                        ),
                    );
            }
            if (
                Object.hasOwn(
                    template.title_card_image || {},
                    "upload_attestation_policy_version",
                ) &&
                (!Number.isSafeInteger(
                    template.title_card_image.upload_attestation_policy_version,
                ) || template.title_card_image.upload_attestation_policy_version < 0)
            )
                errors.push(
                    validationError(
                        "title_card_image.upload_attestation_policy_version",
                        "type",
                        "title_card_image.upload_attestation_policy_version must be a non-negative safe integer when present.",
                    ),
                );
            if (Object.hasOwn(template, "editor_data")) {
                errors.push(
                    ...exactObjectFieldValidationErrors(template.editor_data, STORY_EDITOR_DATA_FIELDS, "editor_data"),
                    ...requiredExactFieldsValidationErrors(template.editor_data, STORY_EDITOR_DATA_FIELDS, "editor_data"),
                    ...exactObjectFieldValidationErrors(template.editor_data?.story_tree, STORY_EDITOR_TREE_FIELDS, "editor_data.story_tree"),
                    ...requiredExactFieldsValidationErrors(template.editor_data?.story_tree, STORY_EDITOR_TREE_REQUIRED_FIELDS, "editor_data.story_tree"),
                    ...exactObjectFieldValidationErrors(template.editor_data?.story_tree?.viewport, STORY_EDITOR_VIEWPORT_FIELDS, "editor_data.story_tree.viewport"),
                    ...requiredExactFieldsValidationErrors(template.editor_data?.story_tree?.viewport, STORY_EDITOR_VIEWPORT_FIELDS, "editor_data.story_tree.viewport"),
                );
                if (
                    Object.hasOwn(template.editor_data?.story_tree || {}, "output_modes") &&
                    !isPlainObject(template.editor_data.story_tree.output_modes)
                )
                    errors.push(validationError("editor_data.story_tree.output_modes", "type", "editor_data.story_tree.output_modes must be an object keyed by objective id when present."));
                const positions = template.editor_data?.story_tree?.positions;
                if (!isPlainObject(positions))
                    errors.push(validationError("editor_data.story_tree.positions", "type", "positions must be an object keyed by objective id."));
                else
                    for (const [objectiveId, position] of Object.entries(positions)) {
                        const path = `editor_data.story_tree.positions.${objectiveId}`;
                        errors.push(
                            ...exactObjectFieldValidationErrors(position, ["x", "y"], path),
                            ...requiredExactFieldsValidationErrors(position, ["x", "y"], path),
                        );
                        for (const field of ["x", "y"])
                            if (typeof position?.[field] !== "number" || !Number.isFinite(position[field]))
                                errors.push(validationError(`${path}.${field}`, "type", `${field} must be a finite number.`));
                    }
                const viewport = template.editor_data?.story_tree?.viewport;
                for (const field of ["x", "y", "zoom"])
                    if (typeof viewport?.[field] !== "number" || !Number.isFinite(viewport[field]))
                        errors.push(validationError(`editor_data.story_tree.viewport.${field}`, "type", `${field} must be a finite number.`));
                if (
                    typeof viewport?.zoom === "number" &&
                    Number.isFinite(viewport.zoom) &&
                    (viewport.zoom < STORY_BUILDER_TREE_ZOOM_MIN || viewport.zoom > STORY_BUILDER_TREE_ZOOM_MAX)
                )
                    errors.push(validationError(
                        "editor_data.story_tree.viewport.zoom",
                        "range",
                        `zoom must be from ${STORY_BUILDER_TREE_ZOOM_MIN} through ${STORY_BUILDER_TREE_ZOOM_MAX}.`,
                    ));
            }
            if (!Array.isArray(state?.players))
                errors.push(validationError("state.players", "type", "state.players must be an array."));
            if (!isPlainObject(state?.characters))
                errors.push(validationError("state.characters", "type", "state.characters must be an object keyed by character id."));
            if (!isPlainObject(state?.future_cast?.items))
                errors.push(validationError("state.future_cast.items", "type", "state.future_cast.items must be an object keyed by future character id."));
            if (!isPlainObject(state?.npc_directory?.locations))
                errors.push(validationError("state.npc_directory.locations", "type", "state.npc_directory.locations must be an object keyed by location id."));
            errors.push(...requiredExactStringArrayValidationErrors(template.title_card_subjects, "title_card_subjects"));
            for (let index = 0; index < (Array.isArray(template.messages) ? template.messages.length : 0); index++)
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        template.messages[index],
                        STORY_MESSAGE_FIELDS,
                        `messages.${index}`,
                    ),
                );
            for (const [locationId, location] of Object.entries(state?.world_map?.locations || {})) {
                const path = `state.world_map.locations.${locationId}`;
                errors.push(...exactObjectFieldValidationErrors(location, STORY_WORLD_LOCATION_FIELDS, path));
                if (location?.id !== locationId)
                    errors.push(validationError(`${path}.id`, "mismatch", `${path}.id must exactly match its object key.`));
            }
            for (const [locationId, location] of Object.entries(state?.npc_directory?.locations || {})) {
                const path = `state.npc_directory.locations.${locationId}`;
                errors.push(...exactObjectFieldValidationErrors(location, STORY_NPC_LOCATION_FIELDS, path));
                for (const [npcKey, npc] of Object.entries(location?.characters || {})) {
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            npc,
                            STORY_NPC_FIELDS,
                            `${path}.characters.${npcKey}`,
                        ),
                    );
                    const definitionCount = (isPlainObject(npc?.full_character) ? 1 : 0) +
                        (isPlainObject(npc?.animal_definition) ? 1 : 0);
                    if (definitionCount !== 1)
                        errors.push(validationError(
                            `${path}.characters.${npcKey}`,
                            "definition",
                            `${path}.characters.${npcKey} must contain exactly one of full_character or animal_definition; found ${definitionCount}.`,
                        ));
                }
            }
            for (const [characterId, entry] of Object.entries(state?.future_cast?.items || {})) {
                const path = `state.future_cast.items.${characterId}`;
                errors.push(...exactObjectFieldValidationErrors(entry, STORY_FUTURE_CAST_ITEM_FIELDS, path));
                if (entry?.id !== characterId)
                    errors.push(validationError(`${path}.id`, "mismatch", `${path}.id must exactly match its object key.`));
                if (!["active", "nearby", "none"].includes(entry?.scene_presence))
                    errors.push(validationError(`${path}.scene_presence`, "enum", `${path}.scene_presence must be active, nearby, or none.`));
                const definitionCount = (isPlainObject(entry?.full_character) ? 1 : 0) +
                    (isPlainObject(entry?.animal_definition) ? 1 : 0);
                if (definitionCount !== 1)
                    errors.push(validationError(
                        path,
                        "definition",
                        `${path} must contain exactly one of full_character or animal_definition; found ${definitionCount}.`,
                    ));
                if (Object.hasOwn(entry || {}, "on_unlock")) {
                    errors.push(...exactObjectFieldValidationErrors(entry.on_unlock, STORY_FUTURE_CAST_ON_UNLOCK_FIELDS, `${path}.on_unlock`));
                    if (Object.hasOwn(entry.on_unlock || {}, "image"))
                        errors.push(...exactObjectFieldValidationErrors(entry.on_unlock.image, STORY_FUTURE_CAST_UNLOCK_IMAGE_FIELDS, `${path}.on_unlock.image`));
                }
            }
            return errors;
        }

        function validateStoryExport(payload = {}) {
            const errors = [
                ...exactObjectFieldValidationErrors(
                    payload,
                    STORY_EXPORT_FIELDS,
                    "story export",
                ),
            ];
            if (!isPlainObject(payload)) return validationResult(errors, []);
            if (payload.app !== "EmberAdventures")
                errors.push(
                    validationError(
                        "app",
                        "value",
                        'app must be exactly "EmberAdventures".',
                    ),
                );
            if (payload.exportType !== "story-template")
                errors.push(
                    validationError(
                        "exportType",
                        "value",
                        'exportType must be exactly "story-template".',
                    ),
                );
            errors.push(...requiredExactTextValidationErrors(payload.exportedAt, "exportedAt"));
            if (!isPlainObject(payload.storyTemplate))
                errors.push(
                    validationError(
                        "storyTemplate",
                        "required",
                        "storyTemplate is required and must be an object.",
                    ),
                );
            else {
                const definition = validateStoryDefinition(payload.storyTemplate);
                return validationResult(
                    errors.concat(definition.errors),
                    definition.warnings,
                );
            }
            return validationResult(errors, []);
        }

        function validateStoryDefinition(template = {}) {
            const errors = [];
            const warnings = [];
            errors.push(...liteDefinitionMarkerValidationErrors(template, "storyTemplate"));
            errors.push(
                ...exactObjectFieldValidationErrors(
                    template,
                    STORY_TEMPLATE_FIELDS,
                    "storyTemplate",
                ),
                ...requiredExactFieldsValidationErrors(
                    template,
                    STORY_TEMPLATE_REQUIRED_FIELDS,
                    "storyTemplate",
                ),
            );
            if (!isPlainObject(template)) return validationResult(errors, warnings);

            const objectives = template.state?.objectives?.items || [];
            const storyShops = template.state?.story_shops || {};
            errors.push(...requiredExactTextValidationErrors(template.id, "id"));
            errors.push(...requiredExactTextValidationErrors(template.title, "title"));
            errors.push(...requiredExactTextValidationErrors(template.description, "description"));
            errors.push(...requiredExactTextValidationErrors(template.createdAt, "createdAt"));
            errors.push(...requiredExactTextValidationErrors(template.updatedAt, "updatedAt"));
            errors.push(...requiredExactTextValidationErrors(template.source, "source"));
            errors.push(...requiredExactTextValidationErrors(template.creation_tool, "creation_tool"));
            errors.push(...exactGenreValidationErrors(template.genres, "genres"));

            if (template.app !== "EmberAdventures")
                errors.push(validationError("app", "value", 'app must be exactly "EmberAdventures".'));
            if (template.templateType !== "story")
                errors.push(validationError("templateType", "value", 'templateType must be exactly "story".'));
            if (typeof template.allow_any_player !== "boolean")
                errors.push(validationError("allow_any_player", "type", "allow_any_player must be a boolean."));




            if (!Array.isArray(template.messages))
                errors.push(validationError("messages", "type", "messages must be an array."));
            if (!isPlainObject(template.state))
                errors.push(validationError("state", "required", "Story state is required."));
            else errors.push(
                ...storyExactNestedValidationErrors(template),
                ...storyExactScalarValidationErrors(template),
                ...storyTimedSystemExactValidationErrors(template),
                ...storyInventoryExactValidationErrors(template.state.story_inventory),
            );
            if (!Array.isArray(template.state?.objectives?.items))
                errors.push(validationError("objectives.items", "required", "Story objectives array is required."));



            errors.push(...storyNumericValueValidationErrors(template));
            errors.push(...npcDirectoryLocationValidationErrors(template.state || {}));
            errors.push(...anyPlayerStartingStateValidationErrors(template));
            errors.push(...runtimeReferenceTokenValidationErrors(template));
            errors.push(...storyAuthoredAssetImageValidationErrors(template));
            errors.push(...objectiveGraphValidationErrors(template));
            errors.push(...objectiveDialogueValidationErrors(objectives));
            errors.push(...objectiveOutcomeRouteValidationErrors(objectives));
            errors.push(...objectiveChoiceValidationErrors(objectives));
            errors.push(...objectiveRequirementValidationErrors(objectives));
            errors.push(...objectiveActivationEvaluationValidationErrors(objectives));
            errors.push(
                ...objectiveRewardValidationErrors(
                    [
                        ...(Array.isArray(objectives) ? objectives : []),
                        ...storyShopPurchaseRewardValidationObjectives(storyShops),
                        ...timedEventRewardValidationObjectives(
                        template.state?.timed_events || {},
                        ),
                        ...storyPacingRewardValidationObjectives(
                        template.state?.story_pacing || {},
                        ),
                    ],
                    template.state?.reward_bundles || {},
                    template,
                ),
            );
            errors.push(
                ...timedEventValidationErrors(
                    template.state?.timed_events || {},
                    objectives,
                ),
            );
            errors.push(
                ...storyPacingValidationErrors(
                    template.state?.story_pacing || {},
                    objectives,
                ),
            );
            errors.push(
                ...storyShopValidationErrors(
                    storyShops,
                    template.state?.character_shop_cost_templates || {},
                    template,
                ),
            );
            for (const entry of storyDefinitionCharacterEntries(template)) {
                const characterValidation = storyDefinitionEntryIsAnimal(entry)
                    ? validateAnimalDefinition(entry.character, entry.path)
                    : validateCharacterDefinition(
                          entry.character,
                          entry.path,
                          {
                              embedded: true,
                              requireRomanceable: storyCharacterRequiresRomanceable(entry.path),
                          },
                      );
                errors.push(...characterValidation.errors);
                warnings.push(...characterValidation.warnings);
            }
            errors.push(...duplicateCharacterDefinitionIdValidationErrors(template));
            return validationResult(errors, warnings);
        }

        const STORY_DEFINITION_VALIDATION_VERSION = 10;

        const STORY_OBJECTIVE_FIELDS = Object.freeze([
            "id",
            "title",
            "type",
            "status",
            "summary",
            "while_active_guidance",
            "completion_control",
            "completion_criteria",
            "completion_instruction",
            "dialogue_lines",
            "requires",
            "completion_requirements",
            "next_objectives",
            "choices",
            "choice_response_mode",
            "route_control",
            "outcome_routes",
            "evaluate_ai_on_activation",
            "requirement_check_only",
            "exclusive_group",
            "selectable",
            "locked_until_complete",
            "available_now",
            "blocked_reason",
            "notes",
            "completion_message",
            "travel_location_id",
            "travel_location_name",
            "rewards",
        ]);
        const STORY_NEXT_OUTPUT_FIELDS = Object.freeze([
            "id",
            "objective_id",
            "target_input_group_id",
            "completion_instruction",
            "dialogue_lines",
            "requirements",
            "rewards",
            "travel_location_id",
            "travel_location_name",
            "fallback",
            "ending_type",
            "ending_title",
            "ending_message",
        ]);
        const STORY_CHOICE_OUTPUT_FIELDS = Object.freeze([
            "id",
            "title",
            "summary",
            "player_text",
            "next_objective_id",
            "target_input_group_id",
            "completion_instruction",
            "dialogue_lines",
            "requirements",
            "rewards",
            "travel_location_id",
            "travel_location_name",
            "effects",
            "ending_type",
            "ending_title",
            "ending_message",
        ]);
        const STORY_ROUTE_OUTPUT_FIELDS = Object.freeze([
            "id",
            "criteria",
            "fallback",
            "default_mode",
            "next_objective_id",
            "target_input_group_id",
            "completion_instruction",
            "dialogue_lines",
            "requirements",
            "rewards",
            "travel_location_id",
            "travel_location_name",
            "ending_type",
            "ending_title",
            "ending_message",
        ]);

        function objectiveExactFieldValidationErrors(objective, path) {
            const errors = exactObjectFieldValidationErrors(
                objective,
                STORY_OBJECTIVE_FIELDS,
                path,
            );
            if (!isPlainObject(objective)) return errors;

            for (const field of [
                "id",
                "title",
                "type",
                "status",
                "summary",
                "while_active_guidance",
                "completion_control",
            ])
                errors.push(
                    ...requiredExactTextValidationErrors(
                        objective[field],
                        `${path}.${field}`,
                    ),
                );
            const omitsCompletionCriteria = ["choice", "reward_only"].includes(
                objective.completion_control,
            );
            if (objective.completion_control === "reward_only") {
                if (objective.requirement_check_only !== true)
                    errors.push(
                        validationError(
                            `${path}.requirement_check_only`,
                            "required",
                            `${path}.requirement_check_only must be true for reward_only objectives.`,
                        ),
                    );
            }
            if (omitsCompletionCriteria) {
                if (Object.hasOwn(objective, "completion_criteria"))
                    errors.push(
                        validationError(
                            `${path}.completion_criteria`,
                            "forbidden",
                            `${path}.completion_criteria must be omitted for ${objective.completion_control} objectives.`,
                        ),
                    );
            }
            else
                errors.push(
                    ...requiredExactTextValidationErrors(
                        objective.completion_criteria,
                        `${path}.completion_criteria`,
                    ),
                );
            if (Object.hasOwn(objective, "requires"))
                errors.push(...requiredExactStringArrayValidationErrors(
                    objective.requires,
                    `${path}.requires`,
                ));
            if (Object.hasOwn(objective, "completion_instruction") && typeof objective.completion_instruction !== "string")
                errors.push(validationError(`${path}.completion_instruction`, "type", `${path}.completion_instruction must be text.`));
            if (Object.hasOwn(objective, "dialogue_lines"))
                errors.push(...requiredExactStringArrayValidationErrors(
                    objective.dialogue_lines,
                    `${path}.dialogue_lines`,
                ));
            if (!["story", "side"].includes(objective.type))
                errors.push(
                    validationError(
                        `${path}.type`,
                        "value",
                        `${path}.type must be exactly "story" or "side".`,
                    ),
                );
            if (!["player", "ai", "choice", "reward_only"].includes(objective.completion_control))
                errors.push(
                    validationError(
                        `${path}.completion_control`,
                        "value",
                        `${path}.completion_control must be exactly player, ai, choice, or reward_only.`,
                    ),
                );
            if (Object.hasOwn(objective, "route_control") && objective.route_control !== "ai")
                errors.push(
                    validationError(
                        `${path}.route_control`,
                        "value",
                        `${path}.route_control must be exactly "ai" when present.`,
                    ),
                );
            for (const [field, allowedFields] of [
                ["next_objectives", STORY_NEXT_OUTPUT_FIELDS],
                ["choices", STORY_CHOICE_OUTPUT_FIELDS],
                ["outcome_routes", STORY_ROUTE_OUTPUT_FIELDS],
            ]) {
                if (!Object.hasOwn(objective, field)) continue;
                if (!Array.isArray(objective[field])) {
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "type",
                            `${path}.${field} must be an array.`,
                        ),
                    );
                    continue;
                }
                for (let index = 0; index < objective[field].length; index++) {
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            objective[field][index],
                            allowedFields,
                            `${path}.${field}.${index}`,
                        ),
                    );
                }
            }
            return errors;
        }

        function externallyControlledObjectiveIds(template = {}) {
            const objectiveIds = new Set();
            const addObjectiveId = (value) => {
                if (typeof value !== "string" || !value.trim()) return;
                objectiveIds.add(value.trim());
            };
            const visitRewardValues = (value) => {
                if (Array.isArray(value)) {
                    for (const item of value) visitRewardValues(item);
                    return;
                }
                if (!isPlainObject(value)) return;
                if (
                    ["start_objective", "complete_objective"].includes(value.type)
                )
                    addObjectiveId(value.objective_id);
                for (const child of Object.values(value))
                    visitRewardValues(child);
            };

            visitRewardValues(template.state || {});

            for (const entry of Object.values(
                template.state?.future_cast?.items || {},
            ))
                addObjectiveId(entry?.on_purchase_objective);
            for (const shop of Object.values(template.state?.story_shops || {}))
                for (const item of Array.isArray(shop?.items) ? shop.items : [])
                    addObjectiveId(item?.on_purchase_objective);

            for (const event of Object.values(
                template.state?.story_pacing?.timeline || {},
            )) {
                addObjectiveId(event?.objective_id);
                for (const actionName of [
                    "accept",
                    "decline",
                    "missed_due_to_conflict",
                ])
                    addObjectiveId(event?.[actionName]?.objective_id);
            }
            return objectiveIds;
        }

        function objectiveTransitionContractValidationErrors(
            objectives = [],
            template = {},
        ) {
            const errors = [];
            const objectiveIds = new Set(
                objectives
                    .filter(isPlainObject)
                    .map((objective) => objective.id)
                    .filter((id) => typeof id === "string" && id.trim()),
            );
            const incomingObjectiveIds = new Set();
            const externallyControlledIds = externallyControlledObjectiveIds(
                template,
            );

            for (let objectiveIndex = 0; objectiveIndex < objectives.length; objectiveIndex++) {
                const objective = objectives[objectiveIndex];
                if (!isPlainObject(objective)) continue;
                for (const requiredId of objective.requires || []) {
                    if (!objectiveIds.has(requiredId))
                        errors.push(validationError(
                            `state.objectives.items.${objectiveIndex}.requires`,
                            "reference",
                            `Objective ${objective.id} requires missing objective ${requiredId}.`,
                        ));
                    incomingObjectiveIds.add(objective.id);
                }
            }

            for (let objectiveIndex = 0; objectiveIndex < objectives.length; objectiveIndex++) {
                const objective = objectives[objectiveIndex];
                if (!isPlainObject(objective)) continue;
                const path = `state.objectives.items.${objectiveIndex}`;
                const control = objective.completion_control;
                const usesRoutes = objective.route_control === "ai";
                const collectionName = control === "choice"
                    ? "choices"
                    : usesRoutes
                      ? "outcome_routes"
                      : "next_objectives";
                const outputs = objective[collectionName];
                if (outputs != null && !Array.isArray(outputs)) continue;
                const list = Array.isArray(outputs) ? outputs : [];
                if (!list.length)
                    errors.push(
                        validationError(
                            path,
                            "dead_end",
                            `Objective ${objective.id || objectiveIndex + 1} must have an output. Mark an output with ending_type for a terminal path.`,
                        ),
                    );
                for (let outputIndex = 0; outputIndex < list.length; outputIndex++) {
                    const output = list[outputIndex];
                    if (!isPlainObject(output)) continue;
                    const outputPath = `${path}.${collectionName}.${outputIndex}`;
                    const targetField = collectionName === "next_objectives"
                        ? "objective_id"
                        : "next_objective_id";
                    const targetId = output[targetField];
                    const endingType = Object.hasOwn(output, "ending_type")
                        ? output.ending_type
                        : "";

                    errors.push(
                        ...requiredExactTextValidationErrors(output.id, `${outputPath}.id`),
                    );
                    errors.push(
                        ...requiredExactTextValidationErrors(
                            output.completion_instruction,
                            `${outputPath}.completion_instruction`,
                        ),
                    );
                    if (!Array.isArray(output.rewards))
                        errors.push(
                            validationError(
                                `${outputPath}.rewards`,
                                "type",
                                `${outputPath}.rewards must be an array, including when empty.`,
                            ),
                        );
                    if (Object.hasOwn(output, "ending_type") && typeof endingType !== "string")
                        errors.push(
                            validationError(
                                `${outputPath}.ending_type`,
                                "type",
                                `${outputPath}.ending_type must be text when present.`,
                            ),
                        );
                    else if (Object.hasOwn(output, "ending_type") && !["freeplay", "ending", "game_over"].includes(endingType))
                        errors.push(
                            validationError(
                                `${outputPath}.ending_type`,
                                "value",
                                `${outputPath}.ending_type must be exactly freeplay, ending, or game_over when present.`,
                            ),
                        );
                    for (const field of ["ending_title", "ending_message"])
                        if (Object.hasOwn(output, field) && typeof output[field] !== "string")
                            errors.push(validationError(
                                `${outputPath}.${field}`,
                                "type",
                                `${outputPath}.${field} must be text when present.`,
                            ));
                    if (endingType && targetId != null && targetId !== "")
                        errors.push(
                            validationError(
                                `${outputPath}.${targetField}`,
                                "terminal_conflict",
                                `${outputPath} cannot define ending_type and reference a next objective.`,
                            ),
                        );
                    if (!endingType) {
                        errors.push(
                            ...requiredExactTextValidationErrors(
                                targetId,
                                `${outputPath}.${targetField}`,
                            ),
                        );
                        if (typeof targetId === "string" && targetId && !objectiveIds.has(targetId))
                            errors.push(
                                validationError(
                                    `${outputPath}.${targetField}`,
                                    "reference",
                                    `${outputPath}.${targetField} references missing objective ${targetId}.`,
                                ),
                            );
                        errors.push(
                            ...requiredExactTextValidationErrors(
                                output.target_input_group_id,
                                `${outputPath}.target_input_group_id`,
                            ),
                        );
                        if (
                            typeof targetId === "string" &&
                            targetId &&
                            typeof output.target_input_group_id === "string" &&
                            output.target_input_group_id
                        ) {
                            incomingObjectiveIds.add(targetId);
                        }
                    }
                }
            }

            const startId = objectives.find((objective) => objective?.status === "active")?.id || "";
            for (let index = 0; index < objectives.length; index++) {
                const objective = objectives[index];
                if (!isPlainObject(objective) || objective.id === startId) continue;
                if (
                    !incomingObjectiveIds.has(objective.id) &&
                    !externallyControlledIds.has(objective.id)
                )
                    errors.push(
                        validationError(
                            `state.objectives.items.${index}`,
                            "unreachable",
                            `Objective ${objective.id} has no incoming graph transition or supported external activation.`,
                        ),
                    );
            }
            return errors;
        }

        function objectiveGraphValidationErrors(template = {}) {
            const errors = [];
            const state = template?.state || {};
            const objectiveState = state?.objectives || {};
            const objectives = Array.isArray(objectiveState.items)
                ? objectiveState.items
                : [];
            const ids = new Set();
            const objectivesById = new Map();
            const allowedStatuses = new Set([
                "active",
                "hidden",
                "locked",
                "future",
                "queued",
                "complete",
            ]);

            for (let index = 0; index < objectives.length; index++) {
                const objective = objectives[index];
                const path = `state.objectives.items.${index}`;
                if (!isPlainObject(objective)) {
                    errors.push(
                        validationError(path, "type", "Objective must be an object."),
                    );
                    continue;
                }

                errors.push(...objectiveExactFieldValidationErrors(objective, path));

                const id = typeof objective.id === "string" ? objective.id : "";
                if (!id) {
                    errors.push(
                        validationError(
                            `${path}.id`,
                            "required",
                            "Objective id is required. EmberAdventures does not generate or repair objective ids.",
                        ),
                    );
                    continue;
                }

                if (!/^[a-z0-9][a-z0-9_-]*$/.test(id))
                    errors.push(
                        validationError(
                            `${path}.id`,
                            "format",
                            `Objective id "${id}" must use lowercase letters, numbers, hyphens, or underscores.`,
                        ),
                    );

                if (id.startsWith("job-"))
                    errors.push(
                        validationError(
                            `${path}.id`,
                            "reserved",
                            `Authored objective id "${id}" uses the reserved generated-job namespace.`,
                        ),
                    );

                if (ids.has(id))
                    errors.push(
                        validationError(
                            `${path}.id`,
                            "duplicate",
                            `Objective id "${id}" is duplicated.`,
                        ),
                    );

                ids.add(id);
                if (!objectivesById.has(id)) objectivesById.set(id, objective);
                const status = objective.status;
                if (!allowedStatuses.has(status))
                    errors.push(
                        validationError(
                            `${path}.status`,
                            "value",
                            "Objective status must be active, hidden, locked, future, queued, or complete.",
                        ),
                    );
                if (
                    !Object.prototype.hasOwnProperty.call(
                        objective,
                        "while_active_guidance",
                    ) ||
                    !textSlot(objective.while_active_guidance, "")
                )
                    errors.push(
                        validationError(
                            `${path}.while_active_guidance`,
                            "required",
                            "Every objective requires non-empty while_active_guidance.",
                        ),
                    );
                else if (typeof objective.while_active_guidance !== "string")
                    errors.push(
                        validationError(
                            `${path}.while_active_guidance`,
                            "type",
                            "while_active_guidance must be text.",
                        ),
                    );

            }

            for (let index = 0; index < objectives.length; index++) {
                const objective = objectives[index];
                if (!isPlainObject(objective)) continue;
                const path = `state.objectives.items.${index}`;
                const id = objective.id;

                for (const next of objectiveNextOptions(objective)) {
                    const nextId = String(next?.objective_id || "").trim();
                    if (nextId && !ids.has(nextId))
                        errors.push(
                            validationError(
                                `${path}.next_objectives`,
                                "reference",
                                `Objective "${id}" routes to missing objective "${nextId}".`,
                            ),
                        );
                }

                for (const route of objectiveOutcomeRoutes(objective)) {
                    const nextId = String(route?.next_objective_id || "").trim();
                    if (!route?.ending_type && nextId && !ids.has(nextId))
                        errors.push(
                            validationError(
                                `${path}.outcome_routes`,
                                "reference",
                                `Objective "${id}" outcome "${route.id || "unnamed"}" routes to missing objective "${nextId}".`,
                            ),
                        );
                }
            }

            for (const [field, expectedKind] of [
                ["active_id", "main"],
            ]) {
                const id = String(objectiveState?.[field] || "").trim();
                if (!id) continue;
                const objective = objectivesById.get(id);
                if (!objective) {
                    errors.push(
                        validationError(
                            `state.objectives.${field}`,
                            "reference",
                            `${field} must reference an existing objective id.`,
                        ),
                    );
                    continue;
                }

                if (
                    (expectedKind === "main" && objectiveIsSide(objective)) ||
                    (expectedKind === "side" && !objectiveIsSide(objective))
                )
                    errors.push(
                        validationError(
                            `state.objectives.${field}`,
                            "type",
                            `${field} must reference a ${expectedKind} objective.`,
                        ),
                    );

                if (objective.status !== "active")
                    errors.push(
                        validationError(
                            `state.objectives.${field}`,
                            "status",
                            `${field} must reference an objective whose authored status is active.`,
                        ),
                    );
            }

            errors.push(
                ...objectiveTransitionContractValidationErrors(
                    objectives,
                    template,
                ),
            );

            return errors;
        }

        function compileObjectiveGraphIndexes(objectives = []) {
            const objectiveOrder = [];
            const objectiveDependentsById = {};
            const objectiveIdsByExclusiveGroup = {};

            for (const objective of objectives) {
                const id = String(objective.id);
                objectiveOrder.push(id);
                for (const transition of objectiveOutputTransitions(objective)) {
                    const targetId = String(
                        transition.objective_id ||
                            transition.next_objective_id ||
                            "",
                    ).trim();
                    if (targetId)
                        (objectiveDependentsById[id] ||= []).push(targetId);
                }
                const group = objectiveExclusiveGroup(objective);
                if (group) (objectiveIdsByExclusiveGroup[group] ||= []).push(id);
            }
            for (const objective of objectives)
                for (const requiredId of objective.requires || [])
                    (objectiveDependentsById[requiredId] ||= []).push(String(objective.id));

            for (const [id, ids] of Object.entries(objectiveDependentsById))
                objectiveDependentsById[id] = [...new Set(ids)].sort();
            for (const ids of Object.values(objectiveIdsByExclusiveGroup)) ids.sort();
            return {
                version: STORY_DEFINITION_VALIDATION_VERSION,
                objectiveOrder,
                objectiveDependentsById,
                objectiveIdsByExclusiveGroup,
            };
        }

        function compileValidatedObjectiveGraph(template = {}) {
            const validation = validateStoryDefinition(template);
            if (!validation.ok)
                throw new Error(validationErrorsText(validation));
            return compileObjectiveGraphIndexes(template.state.objectives.items);
        }

        const validatedStoryDefinitionArtifacts = new WeakMap();

        function cacheValidatedStoryDefinitionArtifact(template = {}, artifact = {}) {
            if (!isPlainObject(template) || !isPlainObject(artifact))
                throw new Error("Validated story artifact needs a story object and artifact object.");
            validatedStoryDefinitionArtifacts.set(template, artifact);
            return artifact;
        }

        function copyValidatedStoryDefinitionArtifact(source = {}, target = {}) {
            const artifact = validatedStoryDefinitionArtifacts.get(source);
            if (!artifact) return target;
            cacheValidatedStoryDefinitionArtifact(target, clone(artifact));
            return target;
        }

        function applyValidatedStoryDefinitionArtifact(template = {}) {
            const validation = validateStoryDefinition(template);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return cacheValidatedStoryDefinitionArtifact(
                template,
                storyDefinitionArtifactFromValidatedTemplate(template),
            );
        }

        function storyDefinitionArtifactFromValidatedTemplate(template = {}) {
            const artifact = {
                definition_validation: {
                    version: STORY_DEFINITION_VALIDATION_VERSION,
                    revision_id: generatedPersistentId(
                        `story-template-${safeRuntimeIdPart(template.id || "story")}`,
                    ),
                    content_hash: stableContentHash(template),
                },
                compiled_objective_graph: compileObjectiveGraphIndexes(
                    template.state.objectives.items,
                ),
            };
            return artifact;
        }

        function assertValidatedStoryDefinitionArtifact(
            template = {},
            context = "story start",
        ) {
            const artifact = validatedStoryDefinitionArtifacts.get(template);
            const validation = artifact?.definition_validation;
            const graph = artifact?.compiled_objective_graph;
            if (
                Number(validation?.version) !== STORY_DEFINITION_VALIDATION_VERSION ||
                Number(graph?.version) !== STORY_DEFINITION_VALIDATION_VERSION ||
                !String(validation?.revision_id || "").trim() ||
                !Array.isArray(graph?.objectiveOrder)
            )
                throw new Error(
                    `${context} requires a validated compiled story definition. Reimport or resave the story.`,
                );

            return graph;
        }

        function assertHydratedStoryTemplateRecords(records = []) {
            if (!Array.isArray(records))
                throw new Error("Stored story library records must be an array.");
            for (const record of records)
                assertValidatedStoryDefinitionArtifact(
                    record,
                    `Stored story ${record?.title || record?.id || "definition"}`,
                );
            return records;
        }

        async function validateHydratedStoryTemplateRecords(records = [], options = {}) {
            if (!Array.isArray(records))
                throw new Error("Stored story library records must be an array.");
            const compiledRecords = [];
            for (const record of records) {
                try {
                    assertValidatedStoryDefinitionArtifact(
                        record,
                        `Stored story ${record?.title || record?.id || "definition"}`,
                    );
                    continue;
                }
                catch (error) {
                    if (
                        !/requires a validated compiled story definition/i.test(
                            String(error?.message || error),
                        )
                    )
                        throw error;
                }
                const label = record?.title || record?.id || "definition";
                options.onProgress?.(`Validating stored story ${label}`);
                try {
                    await compileStoryTemplateValidationArtifact(record, {
                        onProgress: options.onProgress,
                    });
                }
                catch (error) {
                    throw new Error(
                        `Stored story ${label} failed validation: ${error?.message || error}`,
                    );
                }
                assertValidatedStoryDefinitionArtifact(
                    record,
                    `Stored story ${label}`,
                );
                compiledRecords.push(record);
            }
            if (compiledRecords.length && options.persist !== false)
                await savePerRecordLibraryRecords(
                    STORY_TEMPLATE_KEY,
                    compiledRecords,
                );
            return records;
        }

        function npcDirectoryLocationValidationErrors(state = {}) {
            const errors = [];
            const locations = state?.npc_directory?.locations || {};
            const locationId = textSlot(state?.location?.npc_location_id, "").trim();
            if (Object.keys(locations).length && !isNpcLocationId(locationId)) {
                errors.push(validationError(
                    "state.location.npc_location_id",
                    "required",
                    "npc_location_id is required when npc_directory.locations is used and must be a lowercase stable id.",
                ));
            }
            for (const [id, location] of Object.entries(locations)) {
                const path = `state.npc_directory.locations.${id}`;
                if (!isNpcLocationId(id))
                    errors.push(validationError(
                        path,
                        "id",
                        "NPC directory location keys must be stable lowercase ids using only letters, numbers, and hyphens. Put player-facing text in label.",
                    ));
                if (!isPlainObject(location)) {
                    errors.push(validationError(path, "type", "NPC directory location must be an object."));
                    continue;
                }
                if (!textSlot(location.label, ""))
                    errors.push(validationError(`${path}.label`, "required", "NPC directory location label is required."));
                if (!isPlainObject(location.characters))
                    errors.push(validationError(`${path}.characters`, "required", "NPC directory location characters must be an object."));
            }
            if (locationId && Object.keys(locations).length && !locations[locationId])
                errors.push(validationError(
                    "state.location.npc_location_id",
                    "reference",
                    "npc_location_id must reference a state.npc_directory.locations key.",
                ));
            return errors;
        }

        function objectiveDialogueValidationErrors(objectives = []) {
            const errors = [];
            for (const [index, objective] of (Array.isArray(objectives) ? objectives : []).entries()) {
                if (!isPlainObject(objective)) continue;
                for (const collectionName of ["next_objectives", "choices", "outcome_routes"]) {
                    const outputs = objective[collectionName];
                    if (!Array.isArray(outputs)) continue;
                    for (let outputIndex = 0; outputIndex < outputs.length; outputIndex++) {
                        const output = outputs[outputIndex];
                        if (!Object.hasOwn(output || {}, "dialogue_lines")) continue;
                        const path = `objectives.items.${index}.${collectionName}.${outputIndex}.dialogue_lines`;
                        if (
                            !Array.isArray(output.dialogue_lines) ||
                            !output.dialogue_lines.length ||
                            output.dialogue_lines.some(
                                (line) => typeof line !== "string" || !line.trim(),
                            )
                        )
                            errors.push(
                                validationError(
                                    path,
                                    "value",
                                    "dialogue_lines must be a non-empty array of non-empty exact strings.",
                                ),
                            );
                    }
                }
            }
            return errors;
        }

        function objectiveActivationEvaluationValidationErrors(objectives = []) {
            const errors = [];
            for (const [index, objective] of (Array.isArray(objectives) ? objectives : []).entries()) {
                if (!isPlainObject(objective)) continue;
                const path = `objectives.items.${index}.evaluate_ai_on_activation`;
                const value = objective.evaluate_ai_on_activation;
                if (value == null) continue;
                if (typeof value !== "boolean") {
                    errors.push(
                        validationError(
                            path,
                            "type",
                            "evaluate_ai_on_activation must be true or false.",
                        ),
                    );
                    continue;
                }
                if (value && objectiveCompletionControl(objective) !== "ai")
                    errors.push(
                        validationError(
                            path,
                            "control",
                            "evaluate_ai_on_activation is valid only when completion_control is ai.",
                        ),
                    );
            }
            return errors;
        }

        function runtimeReferenceCharacterDefinition(value = null, inherited = null) {
            if (!isPlainObject(value)) return inherited;
            const characterShape =
                typeof value.name === "string" &&
                typeof value.gender === "string" &&
                (Object.hasOwn(value, "personality_description") ||
                    Object.hasOwn(value, "speech_style") ||
                    Object.hasOwn(value, "appearance") ||
                    Object.hasOwn(value, "outfits"));
            return characterShape ? value : inherited;
        }

        function runtimeReferenceValueValidationErrors(
            value,
            path,
            knownCharacterIds = new Set(),
            selfCharacter = null,
        ) {
            const errors = [];
            if (typeof value === "string") {
                if (!value.includes("|[") && !value.includes("]|")) return errors;
                const pattern = /\|\[([^\[\]]*)\]\|/g;
                let match;
                let consumed = "";
                let cursor = 0;
                while ((match = pattern.exec(value))) {
                    consumed += value.slice(cursor, match.index);
                    cursor = pattern.lastIndex;
                    const requested = String(match[1] || "");
                    if (requested.includes("|")) {
                        const conditional = requested.match(/^([MF])\|([^|]+)\|([^|]+)$/);
                        if (!conditional)
                            errors.push(
                                validationError(
                                    path,
                                    "reference_token",
                                    `Malformed presentation text token: ${match[0]}`,
                                ),
                            );
                        continue;
                    }
                    const trimmed = requested.trim();
                    const normalized = trimmed.toLowerCase().replace(/[_\s]+/g, "-");
                    if (runtimeMessageTemplatePlayerTokenKind(normalized)) continue;
                    const explicitCharacter = runtimeMessageTemplateCharacterToken(trimmed);
                    if (!explicitCharacter) {
                        errors.push(
                            validationError(
                                path,
                                "reference_token",
                                `Unknown runtime reference token: ${match[0]}`,
                            ),
                        );
                        continue;
                    }
                    if (explicitCharacter.self) {
                        if (!selfCharacter)
                            errors.push(
                                validationError(
                                    path,
                                    "reference_token",
                                    `ID-less character reference is valid only inside a character definition: ${match[0]}`,
                                ),
                            );
                        continue;
                    }
                    if (
                        !knownCharacterIds.has(
                            normalizeRuntimeMessageTemplateKey(explicitCharacter.characterId),
                        )
                    )
                        errors.push(
                            validationError(
                                path,
                                "reference",
                                `Character reference token does not resolve: ${match[0]}`,
                            ),
                        );
                }
                consumed += value.slice(cursor);
                if (consumed.includes("|[") || consumed.includes("]|"))
                    errors.push(
                        validationError(
                            path,
                            "reference_token",
                            "Runtime reference token markers are malformed.",
                        ),
                    );
                return errors;
            }
            if (Array.isArray(value)) {
                value.forEach((item, index) =>
                    errors.push(
                        ...runtimeReferenceValueValidationErrors(
                            item,
                            `${path}.${index}`,
                            knownCharacterIds,
                            selfCharacter,
                        ),
                    ),
                );
                return errors;
            }
            if (!isPlainObject(value)) return errors;
            const ownCharacter = runtimeReferenceCharacterDefinition(value, selfCharacter);
            for (const [key, item] of Object.entries(value))
                errors.push(
                    ...runtimeReferenceValueValidationErrors(
                        item,
                        path ? `${path}.${key}` : key,
                        knownCharacterIds,
                        ownCharacter,
                    ),
                );
            return errors;
        }

        function runtimeReferenceTokenValidationErrors(template = {}) {
            const errors = [];
            //Build this once. The old validation path searched every character
            //container again for every |[character:*]| token in a large story.
            const knownCharacterIds = new Set(
                storyDefinitionCharacterEntries(template)
                    .map((entry) => textSlot(entry?.character?.id || entry?.fallbackId, ""))
                    .filter(Boolean)
                    .map(normalizeRuntimeMessageTemplateKey),
            );
            errors.push(
                ...runtimeReferenceValueValidationErrors(
                    template,
                    "story",
                    knownCharacterIds,
                ),
            );
            return errors;
        }

        function storyShopPurchaseRewardValidationObjectives(storyShops = {}) {
            const objectives = [];
            for (const [shopId, shop] of Object.entries(storyShops || {})) {
                if (!isPlainObject(shop) || shop.type !== "general")
                    continue;
                for (const [itemIndex, item] of (Array.isArray(shop.items) ? shop.items : []).entries()) {
                    if (!isPlainObject(item) || item.rewards == null) continue;
                    objectives.push({
                        id: `shop-purchase:${shopId}:${textSlot(item.id, itemIndex)}`,
                        rewards: item.rewards,
                        __validation_path: `story_shops.${shopId}.items.${itemIndex}`,
                    });
                }
            }
            return objectives;
        }

        function timedEventRewardValidationObjectives(timedEvents = {}) {
            const objectives = [];
            for (const [eventId, event] of Object.entries(
                isPlainObject(timedEvents) ? timedEvents : {},
            )) {
                objectives.push({
                    id: `timed-event:${eventId}`,
                    rewards: event.rewards,
                    __validation_path: `timed_events.${eventId}`,
                });
                for (const [stageIndex, stage] of (event.stages || []).entries()) {
                    objectives.push({
                        id: `timed-event:${eventId}:stage:${stage.id || stageIndex}`,
                        rewards: stage.rewards,
                        __validation_path: `timed_events.${eventId}.stages.${stageIndex}`,
                    });
                }
            }
            return objectives;
        }

        function storyPacingRewardValidationObjectives(storyPacing = {}) {
            const objectives = [];
            const pacing = isPlainObject(storyPacing) ? storyPacing : {};
            for (const [eventId, event] of Object.entries(pacing.timeline || {})) {
                for (const actionName of [
                    "accept",
                    "decline",
                    "missed_due_to_conflict",
                ]) {
                    const action = event[actionName];
                    if (!Array.isArray(action?.rewards) || !action.rewards.length)
                        continue;
                    objectives.push({
                        id: `story-pacing:${eventId}:${actionName}`,
                        rewards: action.rewards,
                        __validation_path: `story_pacing.timeline.${eventId}.${actionName}`,
                    });
                }
            }
            return objectives;
        }

        function timedEventValidationErrors(timedEvents = {}, objectives = []) {
            const errors = [];
            const objectiveIds = new Set(
                (Array.isArray(objectives) ? objectives : [])
                    .filter(isPlainObject)
                    .map((objective) => textSlot(objective.id, ""))
                    .filter(Boolean),
            );
            for (const [eventId, event] of Object.entries(isPlainObject(timedEvents) ? timedEvents : {})) {
                const path = `timed_events.${eventId}`;
                if (!event.trigger?.immediately && !event.trigger?.objective_id)
                    errors.push(validationError(`${path}.trigger`, "required", "Timed events need a trigger objective or immediately: true."));
                if (event.trigger?.objective_id && !objectiveIds.has(event.trigger.objective_id))
                    errors.push(validationError(`${path}.trigger.objective_id`, "reference", `Timed event trigger objective \"${event.trigger.objective_id}\" does not exist.`));
                if (event.cancel_objective_id && !objectiveIds.has(event.cancel_objective_id))
                    errors.push(validationError(`${path}.cancel_objective_id`, "reference", `Timed event cancel objective \"${event.cancel_objective_id}\" does not exist.`));
                if (!isPlainObject(event.time_limit))
                    errors.push(validationError(`${path}.time_limit`, "required", "Timed events need an exact time_limit object."));
            }
            return errors;
        }

        function storyPacingValidationErrors(storyPacing = {}, objectives = []) {
            const errors = [];
            const pacing = isPlainObject(storyPacing) ? storyPacing : {};
            const objectiveIds = new Set(
                (Array.isArray(objectives) ? objectives : [])
                    .filter(isPlainObject)
                    .map((objective) => textSlot(objective.id, ""))
                    .filter(Boolean),
            );
            for (const [eventId, event] of Object.entries(pacing.timeline || {})) {
                const path = `story_pacing.timeline.${eventId}`;
                const objectiveId = event.objective_id || event.accept?.objective_id;
                if (!event.trigger?.objective_id && event.trigger?.at_elapsed_minutes == null)
                    errors.push(validationError(`${path}.trigger`, "required", "Timeline events need an absolute story-clock time or an objective trigger."));
                if (event.trigger?.objective_id && !objectiveIds.has(event.trigger.objective_id))
                    errors.push(validationError(`${path}.trigger.objective_id`, "reference", `Timeline event trigger objective \"${event.trigger.objective_id}\" does not exist.`));
                if (objectiveId && !objectiveIds.has(objectiveId))
                    errors.push(validationError(`${path}.objective_id`, "reference", `Timeline event objective \"${objectiveId}\" does not exist.`));
                if (!objectiveId && !(event.accept?.rewards || []).length)
                    errors.push(validationError(`${path}.accept`, "required", "Timeline events need an objective_id or accept.rewards."));
            }
            return errors;
        }

        const STORY_SHOP_COMMON_FIELDS = Object.freeze([
            "id", "title", "type", "subtype", "description", "summary", "unlocked",
            "currency", "location", "npc_location_id", "owner_npc_id", "visible_count",
            "generic_jobs_enabled", "items",
        ]);
        const STORY_SHOP_FIELDS_BY_TYPE = Object.freeze({
            character: Object.freeze([
                ...STORY_SHOP_COMMON_FIELDS,
                "cost_template_id", "purchase_verb", "purchase_completed_verb",
                "purchase_mode", "repeatable", "post_purchase_presence",
            ]),
            general: Object.freeze([...STORY_SHOP_COMMON_FIELDS, "markup", "buying"]),
            clothing: STORY_SHOP_COMMON_FIELDS,
            job: STORY_SHOP_COMMON_FIELDS,
        });
        const STORY_SHOP_ITEM_FIELDS_BY_TYPE = Object.freeze({
            character: Object.freeze([
                "id", "character_id", "price", "purchase_mode", "repeatable", "locked",
                "unlock_reason", "requirements", "on_purchase_objective", "purchase_opening",
            ]),
            general: Object.freeze([
                "id", "title", "quantity", "locked", "unlock_reason", "requirements",
                "rewards", "item",
            ]),
            clothing: Object.freeze([
                "id", "title", "summary", "price", "target", "locked", "unlock_reason",
                "requirements", "outfit",
            ]),
            job: Object.freeze([
                "id", "title", "summary", "genres", "rank", "requirements",
                "reward_coins", "reward_xp", "reward_items", "client_npc_id",
                "start_location", "completion_criteria", "completion_instruction",
            ]),
        });
        const STORY_SHOP_BUYING_FIELDS = Object.freeze(["enabled", "quest_items_rejected"]);
        const CHARACTER_SHOP_COST_TEMPLATE_FIELDS = Object.freeze(["type", "costs", "effects"]);
        const CHARACTER_SHOP_COST_FIELDS = Object.freeze([
            "label", "available_expression", "op", "required_stat",
        ]);
        const CHARACTER_SHOP_EFFECT_FIELDS = Object.freeze([
            "label", "operation", "field_path", "value_stat",
        ]);

        function storyShopValidationErrors(storyShops = {}, costTemplates = {}, template = {}) {
            const errors = [];
            const objectiveIds = new Set(
                (template.state?.objectives?.items || [])
                    .map((objective) => textSlot(objective?.id, ""))
                    .filter(Boolean),
            );
            if (!isPlainObject(costTemplates))
                errors.push(validationError("character_shop_cost_templates", "type", "Character-shop cost templates must be an object keyed by template id."));
            for (const [templateId, costTemplate] of Object.entries(isPlainObject(costTemplates) ? costTemplates : {})) {
                const path = `character_shop_cost_templates.${templateId}`;
                if (!isPlainObject(costTemplate)) {
                    errors.push(validationError(path, "type", "Character-shop cost template must be an object."));
                    continue;
                }
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        costTemplate,
                        CHARACTER_SHOP_COST_TEMPLATE_FIELDS,
                        path,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        costTemplate,
                        CHARACTER_SHOP_COST_TEMPLATE_FIELDS,
                        path,
                    ),
                );
                if (costTemplate.type !== "stat")
                    errors.push(validationError(`${path}.type`, "enum", "Character-shop cost template type must be stat."));
                if (!Array.isArray(costTemplate.costs) || !costTemplate.costs.length)
                    errors.push(validationError(`${path}.costs`, "required", "Stat cost templates require at least one cost."));
                for (const [index, cost] of (Array.isArray(costTemplate.costs) ? costTemplate.costs : []).entries()) {
                    const costPath = `${path}.costs.${index}`;
                    if (!isPlainObject(cost)) {
                        errors.push(validationError(costPath, "type", "Stat cost must be an object."));
                        continue;
                    }
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            cost,
                            CHARACTER_SHOP_COST_FIELDS,
                            costPath,
                        ),
                        ...requiredExactFieldsValidationErrors(
                            cost,
                            CHARACTER_SHOP_COST_FIELDS,
                            costPath,
                        ),
                    );
                    if (!textSlot(cost.label, "")) errors.push(validationError(`${costPath}.label`, "required", "Stat cost label is required."));
                    if (!textSlot(cost.required_stat, "")) errors.push(validationError(`${costPath}.required_stat`, "required", "Stat cost required_stat is required."));
                    if (![">", ">=", "<", "<=", "==", "!="].includes(cost.op))
                        errors.push(validationError(`${costPath}.op`, "enum", "Stat cost comparison is invalid."));
                    errors.push(...numericExpressionValidationErrors(cost.available_expression, `${costPath}.available_expression`));
                    if (isPlainObject(template.state)) {
                        try {
                            evaluateNumericExpression(template.state, cost.available_expression, `${costPath}.available_expression`);
                        } catch (error) {
                            errors.push(validationError(`${costPath}.available_expression`, "reference", error.message));
                        }
                    }
                }
                if (!Array.isArray(costTemplate.effects))
                    errors.push(validationError(`${path}.effects`, "type", "Stat cost template effects must be an array."));
                for (const [index, effect] of (Array.isArray(costTemplate.effects) ? costTemplate.effects : []).entries()) {
                    const effectPath = `${path}.effects.${index}`;
                    if (!isPlainObject(effect)) {
                        errors.push(validationError(effectPath, "type", "Stat cost effect must be an object."));
                        continue;
                    }
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            effect,
                            CHARACTER_SHOP_EFFECT_FIELDS,
                            effectPath,
                        ),
                        ...requiredExactFieldsValidationErrors(
                            effect,
                            CHARACTER_SHOP_EFFECT_FIELDS,
                            effectPath,
                        ),
                    );
                    if (!textSlot(effect.label, "")) errors.push(validationError(`${effectPath}.label`, "required", "Stat cost effect label is required."));
                    if (!textSlot(effect.value_stat, "")) errors.push(validationError(`${effectPath}.value_stat`, "required", "Stat cost effect value_stat is required."));
                    if (!["add", "subtract", "multiply", "divide"].includes(effect.operation))
                        errors.push(validationError(`${effectPath}.operation`, "enum", "Stat cost effect operation must be add, subtract, multiply, or divide."));
                    try { assertSafeRewardPath(effect.field_path, `${effectPath}.field_path`); }
                    catch (error) { errors.push(validationError(`${effectPath}.field_path`, "path", error.message)); }
                    if (objectiveMutationPath(effect.field_path).length)
                        errors.push(
                            validationError(
                                `${effectPath}.field_path`,
                                "immutable_objectives",
                                "Character-shop effects cannot mutate the objectives state tree.",
                            ),
                        );
                    const approvedPathError =
                        objectiveRewardApprovedStatePathError(effect.field_path);
                    if (
                        approvedPathError &&
                        !objectiveMutationPath(effect.field_path).length
                    )
                        errors.push(
                            validationError(
                                `${effectPath}.field_path`,
                                "unapproved_state_path",
                                approvedPathError,
                            ),
                        );
                    if (isPlainObject(template.state)) {
                        try {
                            const effectFieldPath = assertSafeRewardPath(effect.field_path, `${effectPath}.field_path`);
                            existingNumberAtPath(template.state, effectFieldPath, effectFieldPath.join("."));
                        } catch (error) {
                            errors.push(validationError(`${effectPath}.field_path`, "reference", error.message));
                        }
                    }
                }
            }
            if (!isPlainObject(storyShops))
                return [
                    ...errors,
                    validationError("story_shops", "type", "story_shops must be an object keyed by shop id."),
                ];
            for (const [shopId, shop] of Object.entries(storyShops)) {
                const shopPath = `story_shops.${shopId}`;
                if (!isPlainObject(shop)) {
                    errors.push(validationError(shopPath, "type", `${shopPath} must be an object.`));
                    continue;
                }
                const type = shop.type;
                const allowedShopFields = STORY_SHOP_FIELDS_BY_TYPE[type];
                if (!allowedShopFields) {
                    errors.push(validationError(`${shopPath}.type`, "enum", "Shop type must be character, general, clothing, or job."));
                    continue;
                }
                errors.push(...exactObjectFieldValidationErrors(shop, allowedShopFields, shopPath));
                errors.push(
                    ...requiredExactFieldsValidationErrors(
                        shop,
                        ["id", "title", "type", "unlocked", "currency", "npc_location_id", "items"],
                        shopPath,
                    ),
                );
                if (Object.hasOwn(shop, "location")) {
                    if (!isPlainObject(shop.location))
                        errors.push(validationError(
                            `${shopPath}.location`,
                            "type",
                            `${shopPath}.location must be an object containing the display location fields.`,
                        ));
                    else {
                        errors.push(...exactObjectFieldValidationErrors(
                            shop.location,
                            STORY_LOCATION_FIELDS,
                            `${shopPath}.location`,
                        ));
                        for (const field of Object.keys(shop.location))
                            if (typeof shop.location[field] !== "string")
                                errors.push(validationError(
                                    `${shopPath}.location.${field}`,
                                    "type",
                                    `${shopPath}.location.${field} must be text.`,
                                ));
                    }
                }
                for (const field of ["id", "title", "type", "currency", "npc_location_id"])
                    if (typeof shop[field] !== "string" || !shop[field])
                        errors.push(validationError(`${shopPath}.${field}`, "type", `${shopPath}.${field} must be non-empty text.`));
                if (shop.id !== shopId)
                    errors.push(validationError(`${shopPath}.id`, "mismatch", `${shopPath}.id must exactly match its object key.`));
                if (typeof shop.unlocked !== "boolean")
                    errors.push(validationError(`${shopPath}.unlocked`, "type", `${shopPath}.unlocked must be true or false.`));
                if (type === "general" && (typeof shop.markup !== "number" || !Number.isFinite(shop.markup) || shop.markup < 0))
                    errors.push(validationError(`${shopPath}.markup`, "type", `${shopPath}.markup must be a non-negative finite number.`));
                if (!Array.isArray(shop.items))
                    errors.push(validationError(`${shopPath}.items`, "type", `${shopPath}.items must be an array.`));
                if (type === "general" && Object.hasOwn(shop, "buying")) {
                    errors.push(...exactObjectFieldValidationErrors(shop.buying, STORY_SHOP_BUYING_FIELDS, `${shopPath}.buying`));
                    for (const field of STORY_SHOP_BUYING_FIELDS)
                        if (Object.hasOwn(shop.buying || {}, field) && typeof shop.buying[field] !== "boolean")
                            errors.push(validationError(`${shopPath}.buying.${field}`, "type", `${shopPath}.buying.${field} must be true or false.`));
                }
                for (const [itemIndex, item] of (Array.isArray(shop.items) ? shop.items : []).entries()) {
                    const itemPath = `${shopPath}.items.${itemIndex}`;
                    if (!isPlainObject(item)) {
                        errors.push(validationError(itemPath, "type", `${itemPath} must be an object.`));
                        continue;
                    }
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            item,
                            STORY_SHOP_ITEM_FIELDS_BY_TYPE[type],
                            itemPath,
                        ),
                    );
                    if (typeof item.id !== "string" || !item.id)
                        errors.push(validationError(`${itemPath}.id`, "required", `${itemPath}.id must be non-empty text.`));
                    if (["character", "clothing"].includes(type) && (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0))
                        errors.push(validationError(`${itemPath}.price`, "type", `${itemPath}.price must be a non-negative finite number.`));
                    if (Object.hasOwn(item, "quantity") && (!Number.isSafeInteger(item.quantity) || item.quantity < 0))
                        errors.push(validationError(`${itemPath}.quantity`, "type", `${itemPath}.quantity must be a non-negative safe integer.`));
                    if (type === "character" && (typeof item.character_id !== "string" || !item.character_id))
                        errors.push(validationError(`${itemPath}.character_id`, "required", `${itemPath}.character_id must be non-empty text.`));
                    if (type === "general" && !isPlainObject(item.item))
                        errors.push(validationError(`${itemPath}.item`, "required", `${itemPath}.item is required and must be an object.`));
                    if (type === "clothing" && !isPlainObject(item.outfit))
                        errors.push(validationError(`${itemPath}.outfit`, "required", `${itemPath}.outfit is required and must be an object.`));
                    if (type === "general" && Object.hasOwn(item, "item"))
                        errors.push(...storyInventoryItemValidationErrors(item.item, `${itemPath}.item`));
                    if (type === "clothing" && Object.hasOwn(item, "outfit"))
                        errors.push(...outfitDefinitionValidationErrors(item.outfit, `${itemPath}.outfit`, "Clothing-shop outfit"));
                }
                const npcLocationId = shop.npc_location_id;
                if (!isNpcLocationId(npcLocationId))
                    errors.push(validationError(
                        `${shopPath}.npc_location_id`,
                        "required",
                        "Every story shop requires npc_location_id: a stable NPC directory location id.",
                    ));
                if (type === "general") {
                    for (const [itemIndex, item] of (Array.isArray(shop.items) ? shop.items : []).entries()) {
                        if (isPlainObject(item) && item.rewards != null && !Array.isArray(item.rewards))
                            errors.push(
                                validationError(
                                    `story_shops.${shopId}.items.${itemIndex}.rewards`,
                                    "type",
                                    "General-shop purchase rewards must be an array.",
                                ),
                            );
                    }
                    continue;
                }
                if (type !== "character") continue;
                const shopPurchaseMode = shop.purchase_mode;
                if (!["acquire", "service"].includes(shopPurchaseMode))
                    errors.push(
                        validationError(
                            `${shopPath}.purchase_mode`,
                            "enum",
                            "Character-shop purchase_mode must be acquire or service.",
                        ),
                    );
                if (
                    Object.hasOwn(shop, "repeatable") &&
                    typeof shop.repeatable !== "boolean"
                )
                    errors.push(
                        validationError(
                            `${shopPath}.repeatable`,
                            "type",
                            "Character-shop repeatable must be true or false.",
                        ),
                    );
                const costTemplateId = textSlot(shop.cost_template_id, "");
                const costTemplate = costTemplateId ? costTemplates?.[costTemplateId] : null;
                if (costTemplateId && !isPlainObject(costTemplate))
                    errors.push(validationError(`story_shops.${shopId}.cost_template_id`, "reference", `Character-shop cost template \"${costTemplateId}\" does not exist.`));
                if (isPlainObject(costTemplate)) {
                    for (const [itemIndex, item] of (Array.isArray(shop.items) ? shop.items : []).entries()) {
                        const characterId = textSlot(item?.character_id, "");
                        const entry = template?.state?.future_cast?.items?.[characterId] || template?.future_cast?.items?.[characterId];
                        const stats = entry?.full_character?.stats;
                        for (const statName of [
                            ...(costTemplate.costs || []).map((cost) => cost?.required_stat),
                            ...(costTemplate.effects || []).map((effect) => effect?.value_stat),
                        ].filter(Boolean)) {
                            if (!Number.isFinite(stats?.[statName]))
                                errors.push(validationError(`story_shops.${shopId}.items.${itemIndex}.character_id`, "stat_reference", `Character \"${characterId}\" needs numeric stats.${statName} for cost template \"${costTemplateId}\".`));
                        }
                    }
                }
                const listedCharacterIds = new Set();
                for (const [itemIndex, item] of (
                    Array.isArray(shop.items) ? shop.items : []
                ).entries()) {
                    if (!isPlainObject(item)) continue;
                    const itemPath = `${shopPath}.items.${itemIndex}`;
                    const characterId = textSlot(item.character_id, "");
                    if (characterId && listedCharacterIds.has(characterId))
                        errors.push(
                            validationError(
                                `${itemPath}.character_id`,
                                "duplicate",
                                `Character shop "${shopId}" lists "${characterId}" more than once.`,
                            ),
                        );
                    if (characterId) listedCharacterIds.add(characterId);
                    const itemPurchaseMode = item.purchase_mode;
                    if (
                        itemPurchaseMode &&
                        !["acquire", "service"].includes(itemPurchaseMode)
                    )
                        errors.push(
                            validationError(
                                `${itemPath}.purchase_mode`,
                                "enum",
                                "Character-shop listing purchase_mode must be acquire or service.",
                            ),
                        );
                    if (
                        Object.hasOwn(item, "repeatable") &&
                        typeof item.repeatable !== "boolean"
                    )
                        errors.push(
                            validationError(
                                `${itemPath}.repeatable`,
                                "type",
                                "Character-shop listing repeatable must be true or false.",
                            ),
                        );
                    const effectiveMode =
                        itemPurchaseMode || shopPurchaseMode || "acquire";
                    const effectiveRepeatable =
                        typeof item.repeatable === "boolean"
                            ? item.repeatable
                            : shop.repeatable === true;
                    const purchaseOpening = item.purchase_opening;
                    if (Object.hasOwn(item, "purchase_opening")) {
                        if (!isPlainObject(purchaseOpening))
                            errors.push(validationError(
                                `${itemPath}.purchase_opening`,
                                "type",
                                `${itemPath}.purchase_opening must be an object.`,
                            ));
                        else {
                            errors.push(...exactObjectFieldValidationErrors(
                                purchaseOpening,
                                ["dialogue", "guidance"],
                                `${itemPath}.purchase_opening`,
                            ));
                            if (Object.hasOwn(purchaseOpening, "dialogue") && !textSlot(purchaseOpening.dialogue, ""))
                                errors.push(validationError(
                                    `${itemPath}.purchase_opening.dialogue`,
                                    "required",
                                    `${itemPath}.purchase_opening.dialogue must be non-empty text.`,
                                ));
                            if (Object.hasOwn(purchaseOpening, "guidance") && !textSlot(purchaseOpening.guidance, ""))
                                errors.push(validationError(
                                    `${itemPath}.purchase_opening.guidance`,
                                    "type",
                                    `${itemPath}.purchase_opening.guidance must be non-empty text when present.`,
                                ));
                        }
                    }
                    if (effectiveMode === "service" && !textSlot(purchaseOpening?.dialogue, ""))
                        errors.push(validationError(
                            `${itemPath}.purchase_opening.dialogue`,
                            "required",
                            "Repeatable character services require an authored purchase_opening.dialogue greeting.",
                        ));
                    if (effectiveMode === "acquire" && effectiveRepeatable)
                        errors.push(
                            validationError(
                                `${itemPath}.repeatable`,
                                "unsupported",
                                "Acquisition listings cannot be repeatable. Use purchase_mode service for repeatable payments.",
                            ),
                        );
                    const objectiveId = characterStoryObjectiveId(item);
                    if (objectiveId && !objectiveIds.has(objectiveId))
                        errors.push(
                            validationError(
                                `${itemPath}.on_purchase_objective`,
                                "reference",
                                `Character-shop purchase objective "${objectiveId}" does not exist.`,
                            ),
                        );
                }
                if (!textSlot(shop.purchase_verb, ""))
                    errors.push(
                        validationError(
                            `story_shops.${shopId}.purchase_verb`,
                            "required",
                            "Character shops require a purchase_verb.",
                        ),
                    );
                if (!textSlot(shop.purchase_completed_verb, ""))
                    errors.push(
                        validationError(
                            `story_shops.${shopId}.purchase_completed_verb`,
                            "required",
                            "Character shops require a purchase_completed_verb.",
                        ),
                    );
            }
            return errors;
        }

        function characterGenderAdaptationValidationErrors(
            character = {},
            path = "character",
            options = {},
        ) {
            const errors = [];
            if (["futa", "futanari"].includes(character?.gender))
                errors.push(validationError(`${path}.gender`, "enum", "Use a supported Lite character presentation."));
            if (
                options.requireRomanceable !== false &&
                typeof character?.romanceable !== "boolean"
            )
                errors.push(validationError(`${path}.romanceable`, "required", "romanceable must be explicitly true or false."));
            if (character?.fallback_name != null && !textSlot(character.fallback_name, ""))
                errors.push(validationError(`${path}.fallback_name`, "type", "fallback_name must be a non-empty string when provided."));
            if (character?.fallback_outfits != null && !Array.isArray(character.fallback_outfits))
                errors.push(validationError(`${path}.fallback_outfits`, "type", "fallback_outfits must be an array when provided."));
            const fallbackName = textSlot(character?.fallback_name, "");
            const fallbackOutfits = Array.isArray(character?.fallback_outfits)
                ? character.fallback_outfits
                : [];
            const fallbackStartingOutfitId = textSlot(
                character?.fallback_starting_outfit_id,
                "",
            );
            if (!fallbackName)
                errors.push(validationError(`${path}.fallback_name`, "required", "fallback_name is required for every character definition."));
            if (!fallbackOutfits.length)
                errors.push(validationError(`${path}.fallback_outfits`, "required", "fallback_outfits must be non-empty for every character definition."));
            for (const [index, outfit] of fallbackOutfits.entries())
                errors.push(
                    ...outfitDefinitionValidationErrors(
                        outfit,
                        `${path}.fallback_outfits.${index}`,
                    ),
                );
            if (!fallbackStartingOutfitId)
                errors.push(validationError(`${path}.fallback_starting_outfit_id`, "required", "fallback_starting_outfit_id is required for every character definition."));

            if (textSlot(character?.fallback_starting_outfit_id, "")) {
                const ids = new Set(
                    fallbackOutfits.map((outfit) =>
                        typeof outfit?.id === "string" ? outfit.id : "",
                    ),
                );
                if (!ids.has(textSlot(character.fallback_starting_outfit_id, "")))
                    errors.push(validationError(`${path}.fallback_starting_outfit_id`, "reference", "fallback_starting_outfit_id must reference fallback_outfits."));
            }


            return errors;
        }

        function characterProfilePresentationCandidate(character = {}, male = false) {
            if (!isPlainObject(character)) return null;
            const slot = profileImagePresentationSlot(character, male);
            if (defaultProfileImageSlotHasRealReference(slot) && slot.local_image_id) {
                const local = profileImageByStoreId(slot.local_image_id);
                if (
                    local &&
                    !profileImageRecordIsBlockedPlaceholder(local) &&
                    local.male === male &&
                    (local.hosted_url || profileImageIsFinished(local))
                )
                    return local;
            }
            if (defaultProfileImageSlotHasRealReference(slot) && slot.url) return slot;
            return profileImagesForPresentation(clone(character), male).find(
                (image) =>
                    !profileImageRecordIsBlockedPlaceholder(image) &&
                    (image?.hosted_url ||
                        image?.url ||
                        profileImageIsFinished(image)),
            ) || null;
        }

        function characterPresentationCompatibilityIssues(character = {}, options = {}) {
            if (isPlainObject(character?.character))
                character = character.character;
            const name = textSlot(character?.name, "Character");
            if (!isPlainObject(character)) return [`${name}: character definition is missing.`];
            const issues = [];
            const defaultImageIssue = defaultProfileImagePlaceholderIssue(
                character.default_profile_image,
                `${name}: default profile image`,
            );
            if (defaultImageIssue) issues.push(defaultImageIssue);
            const presentationSlots = isPlainObject(
                character.profile_image_presentations,
            )
                ? character.profile_image_presentations
                : {};
            const malePlaceholderIssue = defaultProfileImagePlaceholderIssue(
                presentationSlots.male,
                `${name}: male profile image`,
            );
            if (malePlaceholderIssue) issues.push(malePlaceholderIssue);
            const femalePlaceholderIssue = defaultProfileImagePlaceholderIssue(
                presentationSlots.non_male,
                `${name}: female profile image`,
            );
            if (femalePlaceholderIssue) issues.push(femalePlaceholderIssue);

            const fallbackName = textSlot(character.fallback_name, "");
            const fallbackOutfits = Array.isArray(character.fallback_outfits)
                ? character.fallback_outfits
                : [];
            const fallbackStartingOutfitId = textSlot(
                character.fallback_starting_outfit_id,
                "",
            );
            if (!fallbackName) issues.push(`${name}: alternate male/non-male name is missing.`);

            if (!fallbackOutfits.length)
                issues.push(`${name}: alternate male/non-male outfits are missing.`);
            if (!fallbackStartingOutfitId)
                issues.push(`${name}: alternate starting outfit is missing.`);
            else if (
                !fallbackOutfits.some(
                    (outfit) =>
                        textSlot(outfit?.id || outfit?.name, "") ===
                        fallbackStartingOutfitId,
                )
            )
                issues.push(`${name}: alternate starting outfit does not reference an alternate outfit.`);
            if (options.requireProfileImages === true) {
                if (!characterProfilePresentationCandidate(character, true))
                    issues.push(`${name}: male profile image is missing.`);
                if (!characterProfilePresentationCandidate(character, false))
                    issues.push(`${name}: female profile image is missing.`);
            }
            return issues;
        }

        function storyCharacterPresentationCompatibilityIssues(template = {}, options = {}) {
            return storyDefinitionCharacterEntries(template).flatMap((entry) =>
                characterPresentationCompatibilityIssues(entry.character, options).map(
                    (issue) => `${entry.path}: ${issue}`,
                ),
            );
        }

        async function confirmCharacterPresentationCompatibility(records = []) {
            const issues = (Array.isArray(records) ? records : [records])
                .filter(Boolean)
                .flatMap(characterPresentationCompatibilityIssues);
            if (!issues.length) return true;
            await showNotice(
                "Incomplete Gender Presentations",
                `The imported character file is missing required gender presentation data:\n\n${issues.join("\n")}\n\nEvery character must include male and female names and outfits before it can be imported. Profile image fields can stay empty until real images are generated.`,
            );
            return false;
        }



        function storyCharacterRequiresRomanceable(path = "") {
            return !(
                path === "state.player" ||
                path.startsWith("state.players[") ||
                path.startsWith("state.players.options[") ||
                /^state\.players\.[^.]+$/.test(path)
            );
        }

        const CHARACTER_DEFINITION_FIELDS = Object.freeze([
            "lite",
            "version",
            "id",
            "name",
            "source",
            "creation_tool",
            "catalog_hook",
            "genres",
            "can_die",
            "romanceable",
            "gender",
            "fallback_name",
            "fallback_outfits",
            "fallback_starting_outfit_id",
            "age",
            "role",
            "personality_description",
            "speech_style",
            "boldness",
            "starting_relationship_to_player",
            "starting_trust",
            "starting_attraction",
            "starting_affection",
            "starting_state_of_mind",
            "starting_physical_state",
            "starting_pose",
            "appearance",
            "outfits",
            "starting_outfit_id",
            "starting_held_items",
            "starting_inventory",
            "starting_known_facts",
            "chat_story",
            "chat_opening_message",
            "chat_starting_location",
            "chat_story_template",
            "stats",
            "default_seed",
            "default_image_background",
            "image_prompt_config",
            "default_profile_image",
            "profile_image_presentations",
            "profile_images",
            "images",
            "voice",
            "created_at",
            "updated_at",
        ]);
        const CHARACTER_REQUIRED_FIELDS = Object.freeze(
            CHARACTER_DEFINITION_FIELDS.filter(
                (field) => ![
                    "catalog_hook",
                    "default_image_background",
                    "chat_story",
                    "chat_opening_message",
                    "chat_starting_location",
                    "chat_story_template",
                    "stats",
                ].includes(field),
            ),
        );
        const STORY_EMBEDDED_CHARACTER_FIELDS = Object.freeze(
            CHARACTER_DEFINITION_FIELDS.filter(
                (field) => ![
                    "genres",
                    "catalog_hook",
                    "chat_story",
                    "chat_opening_message",
                    "chat_starting_location",
                    "chat_story_template",
                    "default_image_background",
                ].includes(field),
            ),
        );
        const STORY_EMBEDDED_CHARACTER_REQUIRED_FIELDS = Object.freeze(
            CHARACTER_REQUIRED_FIELDS.filter((field) => field !== "genres"),
        );

        function standaloneCharacterStoryProjection(character = {}) {
            const projection = {};
            for (const field of STORY_EMBEDDED_CHARACTER_FIELDS)
                if (Object.hasOwn(character, field))
                    projection[field] = clone(character[field]);
            return projection;
        }

        function characterChatStoryPrincipalCollision(template = {}, characterId = "") {
            const id = textSlot(characterId, "");
            const state = template?.state;
            if (!id || !isPlainObject(state)) return "";
            if (textSlot(state.player?.id, "") === id) return "state.player";
            for (let index = 0; index < (state.players || []).length; index++)
                if (textSlot(state.players[index]?.id, "") === id)
                    return `state.players.${index}`;
            for (const [key, character] of Object.entries(state.characters || {}))
                if (key === id || textSlot(character?.id, "") === id)
                    return `state.characters.${key}`;
            for (const [locationId, location] of Object.entries(
                state.npc_directory?.locations || {},
            ))
                for (const [key, npc] of Object.entries(location?.characters || {}))
                    if (
                        key === id ||
                        textSlot(npc?.id, "") === id ||
                        textSlot(npc?.full_character?.id, "") === id
                    )
                        return `state.npc_directory.locations.${locationId}.characters.${key}`;
            for (const [key, entry] of Object.entries(state.future_cast?.items || {}))
                if (
                    key === id ||
                    textSlot(entry?.id, "") === id ||
                    textSlot(entry?.full_character?.id, "") === id
                )
                    return `state.future_cast.items.${key}`;
            return "";
        }

        function characterChatStoryTemplateWithPrincipal(
            template = {},
            character = {},
        ) {
            if (!isPlainObject(template))
                throw new Error("Attached character story must be a storyTemplate object.");
            if (!isPlainObject(template.state))
                throw new Error("Attached character story state is required.");
            if (!isPlainObject(template.state.characters))
                throw new Error("Attached character story state.characters must be an object.");
            const characterId = textSlot(character.id, "");
            if (!characterId)
                throw new Error("Attached character stories require the surrounding character's stable id.");
            const collision = characterChatStoryPrincipalCollision(template, characterId);
            if (collision)
                throw new Error(
                    `Attached character story duplicates its surrounding character at ${collision}. Remove that copy; EmberAdventures injects the authoritative standalone definition.`,
                );
            const bound = clone(template);
            bound.state.characters[characterId] = standaloneCharacterStoryProjection(character);
            return bound;
        }

        const ANIMAL_DEFINITION_FIELDS = Object.freeze([
            "lite",
            "version", "id", "name", "source", "creation_tool", "can_die", "gender",
            "age", "role", "species", "physical_description", "personality_description",
            "communication_style", "starting_relationship_to_player", "starting_trust",
            "starting_affection", "starting_state_of_mind", "starting_physical_state",
            "starting_pose", "starting_known_facts", "stats", "default_seed",
            "image_prompt_config", "default_profile_image", "profile_image_presentations",
            "profile_images", "images", "voice", "created_at", "updated_at",
        ]);
        const ANIMAL_DEFINITION_REQUIRED_FIELDS = Object.freeze([
            "lite",
            "version", "id", "name", "source", "creation_tool", "can_die", "gender",
            "age", "role", "species", "physical_description", "personality_description",
            "communication_style", "starting_relationship_to_player", "starting_trust",
            "starting_affection", "starting_state_of_mind", "starting_physical_state",
            "starting_pose", "starting_known_facts", "created_at", "updated_at",
        ]);
        const CHARACTER_APPEARANCE_SCALE_FIELDS = Object.freeze([
            "height", "shoulder_width", "chest", "upper_body_build", "midsection_build",
            "hip_width", "butt_build", "lower_body_build", "arm_length", "leg_length",
        ]);
        const CHARACTER_APPEARANCE_FIELDS = Object.freeze([
            "species", ...CHARACTER_APPEARANCE_SCALE_FIELDS,
            "skin_color", "eye_color", "hair_color", "hair_length", "hair_type",
            "extra_description", "extra_description_lower_body",
            "male_only_extra_description", "non_male_only_extra_description",
            "nonhuman_lower_body",
        ]);
        const CHARACTER_APPEARANCE_REQUIRED_FIELDS = Object.freeze(
            CHARACTER_APPEARANCE_FIELDS.filter(
                (field) =>
                    ![
                        "male_only_extra_description",
                        "non_male_only_extra_description",
                    ].includes(field),
            ),
        );
        const CHARACTER_OUTFIT_FIELDS = Object.freeze(["id", "name", "clothing"]);
        const CHARACTER_CLOTHING_FIELDS = Object.freeze([
            "hat", "hair_accessory", "face", "ears", "neck", "shoulders", "bra",
            "undershirt", "shirt", "over_shirt", "coat", "back", "hands",
            "right_wrist", "left_wrist", "right_fingers", "left_fingers", "waist",
            "belt_accessory", "underwear", "pants", "skirt", "legwear", "socks",
            "feet", "other_accessory",
        ]);
        const CHARACTER_HELD_ITEM_FIELDS = Object.freeze(["right_hand", "left_hand"]);
        const CHARACTER_CHAT_STARTING_LOCATION_FIELDS = Object.freeze([
            "label", "place", "activity",
        ]);
        const CHARACTER_IMAGE_PROMPT_FIELDS = Object.freeze([
            "seed_enabled", "seed", "style", "profile_style", "negative", "negative_prompt",
        ]);
        const CHARACTER_PROFILE_IMAGE_SLOT_FIELDS = Object.freeze([
            "url", "local_image_id", "source", "seed", "prompt", "negative_prompt", "note", "male",
        ]);
        const CHARACTER_PROFILE_IMAGE_SLOT_REQUIRED_FIELDS = CHARACTER_PROFILE_IMAGE_SLOT_FIELDS;
        const CHARACTER_PROFILE_PRESENTATION_FIELDS = Object.freeze(["male", "non_male"]);
        const CHARACTER_IMAGE_COLLECTION_FIELDS = Object.freeze(["active_image_id", "image_ids"]);
        const CHARACTER_STARTING_INVENTORY_ITEM_FIELDS = Object.freeze([
            "id", "name", "note", "description", "type", "quantity", "value",
            "sellable", "quest_item", "image_prompt", "image_id", "image",
        ]);

        function nonnegativeSafeIntegerValidationErrors(value, path, { nullable = false } = {}) {
            if (nullable && value === null) return [];
            if (!Number.isSafeInteger(value) || value < 0)
                return [validationError(path, "type", `${path} must be a non-negative safe integer${nullable ? " or null" : ""}.`)];
            return [];
        }

        function characterProfileImageSlotValidationErrors(slot, path) {
            if (!isPlainObject(slot)) return [];
            const errors = [];
            for (const field of ["url", "local_image_id", "source", "prompt", "negative_prompt", "note"])
                if (typeof slot[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
            errors.push(...nonnegativeSafeIntegerValidationErrors(slot.seed, `${path}.seed`, { nullable: true }));
            if (typeof slot.male !== "boolean")
                errors.push(validationError(`${path}.male`, "type", `${path}.male must be true or false.`));

            return errors;
        }

        function characterImageCollectionValidationErrors(collection, path) {
            if (!isPlainObject(collection)) return [];
            const errors = [];
            if (typeof collection.active_image_id !== "string")
                errors.push(validationError(`${path}.active_image_id`, "type", `${path}.active_image_id must be text.`));
            errors.push(...requiredExactStringArrayValidationErrors(collection.image_ids, `${path}.image_ids`));
            return errors;
        }

        function characterStartingInventoryValidationErrors(inventory, path) {
            if (!Array.isArray(inventory))
                return [validationError(path, "type", `${path} must be an array.`)];
            const errors = [];
            for (let index = 0; index < inventory.length; index++) {
                const item = inventory[index];
                const itemPath = `${path}.${index}`;
                if (typeof item === "string") {
                    if (!item.trim())
                        errors.push(validationError(itemPath, "type", `${itemPath} must be non-empty text.`));
                    continue;
                }
                errors.push(...exactObjectFieldValidationErrors(item, CHARACTER_STARTING_INVENTORY_ITEM_FIELDS, itemPath));
                if (!isPlainObject(item)) continue;
                if (typeof item.name !== "string" || !item.name.trim())
                    errors.push(validationError(`${itemPath}.name`, "required", `${itemPath}.name must be non-empty text.`));
                for (const field of ["id", "note", "description", "type", "image_prompt", "image_id"])
                    if (Object.hasOwn(item, field) && typeof item[field] !== "string")
                        errors.push(validationError(`${itemPath}.${field}`, "type", `${itemPath}.${field} must be text when present.`));
                for (const field of ["quantity", "value"])
                    if (Object.hasOwn(item, field) && !Number.isSafeInteger(item[field]))
                        errors.push(validationError(`${itemPath}.${field}`, "type", `${itemPath}.${field} must be a safe integer when present.`));
                for (const field of ["sellable", "quest_item"])
                    if (Object.hasOwn(item, field) && typeof item[field] !== "boolean")
                        errors.push(validationError(`${itemPath}.${field}`, "type", `${itemPath}.${field} must be true or false when present.`));
                if (Object.hasOwn(item, "image"))
                    errors.push(...authoredStoryImageValidationErrors(item.image, `${itemPath}.image`));
            }
            return errors;
        }

        function requiredExactFieldsValidationErrors(value, requiredFields, path) {
            if (!isPlainObject(value)) return [];
            return requiredFields
                .filter((field) => !Object.hasOwn(value, field))
                .map((field) =>
                    validationError(
                        `${path}.${field}`,
                        "required",
                        `${path}.${field} is required. EmberAdventures does not supply missing schema fields.`,
                    ),
                );
        }

        function characterExactNestedValidationErrors(
            character,
            path,
            requiredFields = CHARACTER_REQUIRED_FIELDS,
        ) {
            const errors = [
                ...requiredExactFieldsValidationErrors(character, requiredFields, path),
                ...exactObjectFieldValidationErrors(character.appearance, CHARACTER_APPEARANCE_FIELDS, `${path}.appearance`),
                ...requiredExactFieldsValidationErrors(character.appearance, CHARACTER_APPEARANCE_REQUIRED_FIELDS, `${path}.appearance`),
                ...exactObjectFieldValidationErrors(character.starting_held_items, CHARACTER_HELD_ITEM_FIELDS, `${path}.starting_held_items`),
                ...requiredExactFieldsValidationErrors(character.starting_held_items, CHARACTER_HELD_ITEM_FIELDS, `${path}.starting_held_items`),
                ...exactObjectFieldValidationErrors(character.image_prompt_config, CHARACTER_IMAGE_PROMPT_FIELDS, `${path}.image_prompt_config`),
                ...requiredExactFieldsValidationErrors(character.image_prompt_config, CHARACTER_IMAGE_PROMPT_FIELDS, `${path}.image_prompt_config`),
                ...exactObjectFieldValidationErrors(character.default_profile_image, CHARACTER_PROFILE_IMAGE_SLOT_FIELDS, `${path}.default_profile_image`),
                ...requiredExactFieldsValidationErrors(character.default_profile_image, CHARACTER_PROFILE_IMAGE_SLOT_REQUIRED_FIELDS, `${path}.default_profile_image`),
                ...exactObjectFieldValidationErrors(character.profile_image_presentations, CHARACTER_PROFILE_PRESENTATION_FIELDS, `${path}.profile_image_presentations`),
                ...requiredExactFieldsValidationErrors(character.profile_image_presentations, CHARACTER_PROFILE_PRESENTATION_FIELDS, `${path}.profile_image_presentations`),
                ...exactObjectFieldValidationErrors(character.profile_images, CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.profile_images`),
                ...requiredExactFieldsValidationErrors(character.profile_images, CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.profile_images`),
                ...exactObjectFieldValidationErrors(character.images, CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.images`),
                ...requiredExactFieldsValidationErrors(character.images, CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.images`),
            ];
            for (const presentation of CHARACTER_PROFILE_PRESENTATION_FIELDS) {
                const slotPath = `${path}.profile_image_presentations.${presentation}`;
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        character.profile_image_presentations?.[presentation],
                        CHARACTER_PROFILE_IMAGE_SLOT_FIELDS,
                        slotPath,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        character.profile_image_presentations?.[presentation],
                        CHARACTER_PROFILE_IMAGE_SLOT_REQUIRED_FIELDS,
                        slotPath,
                    ),
                    ...characterProfileImageSlotValidationErrors(
                        character.profile_image_presentations?.[presentation],
                        slotPath,
                    ),
                );
            }
            if (isPlainObject(character.image_prompt_config)) {
                if (typeof character.image_prompt_config.seed_enabled !== "boolean")
                    errors.push(validationError(`${path}.image_prompt_config.seed_enabled`, "type", `${path}.image_prompt_config.seed_enabled must be true or false.`));
                errors.push(...nonnegativeSafeIntegerValidationErrors(character.image_prompt_config.seed, `${path}.image_prompt_config.seed`));
                for (const field of ["style", "profile_style", "negative", "negative_prompt"])
                    if (typeof character.image_prompt_config[field] !== "string")
                        errors.push(validationError(`${path}.image_prompt_config.${field}`, "type", `${path}.image_prompt_config.${field} must be text.`));
            }
            errors.push(
                ...characterProfileImageSlotValidationErrors(character.default_profile_image, `${path}.default_profile_image`),
                ...characterImageCollectionValidationErrors(character.profile_images, `${path}.profile_images`),
                ...characterImageCollectionValidationErrors(character.images, `${path}.images`),
            );
            if (Object.hasOwn(character, "chat_story") && typeof character.chat_story !== "string")
                errors.push(validationError(`${path}.chat_story`, "type", "chat_story must be text."));
            if (Object.hasOwn(character, "catalog_hook") && typeof character.catalog_hook !== "string")
                errors.push(validationError(`${path}.catalog_hook`, "type", "catalog_hook must be text."));
            if (Object.hasOwn(character, "default_image_background")) {
                if (
                    typeof character.default_image_background !== "string" ||
                    character.default_image_background.trim().length === 0 ||
                    character.default_image_background !== character.default_image_background.trim()
                )
                    errors.push(validationError(
                        `${path}.default_image_background`,
                        "type",
                        `${path}.default_image_background must be a trimmed, non-empty string when present.`,
                    ));
            }
            if (
                Object.hasOwn(character, "chat_opening_message") &&
                typeof character.chat_opening_message !== "string"
            )
                errors.push(validationError(
                    `${path}.chat_opening_message`,
                    "type",
                    "chat_opening_message must be text.",
                ));
            if (Object.hasOwn(character, "chat_starting_location")) {
                const locationPath = `${path}.chat_starting_location`;
                const location = character.chat_starting_location;
                errors.push(
                    ...exactObjectFieldValidationErrors(
                        location,
                        CHARACTER_CHAT_STARTING_LOCATION_FIELDS,
                        locationPath,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        location,
                        CHARACTER_CHAT_STARTING_LOCATION_FIELDS,
                        locationPath,
                    ),
                );
                if (isPlainObject(location)) {
                    const values = CHARACTER_CHAT_STARTING_LOCATION_FIELDS.map(
                        (field) => location[field],
                    );
                    for (const [index, field] of CHARACTER_CHAT_STARTING_LOCATION_FIELDS.entries())
                        if (typeof values[index] !== "string")
                            errors.push(validationError(
                                `${locationPath}.${field}`,
                                "type",
                                `${locationPath}.${field} must be text.`,
                            ));
                    const populated = values.map((value) => String(value || "").trim().length > 0);
                    if (populated.some(Boolean) && !populated.every(Boolean))
                        errors.push(validationError(
                            locationPath,
                            "incomplete",
                            "chat_starting_location label, place, and activity must either all be nonblank or all be blank.",
                        ));
                }
            }
            for (const [field, outfits] of [["outfits", character.outfits], ["fallback_outfits", character.fallback_outfits]]) {
                if (!Array.isArray(outfits)) {
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be an array.`));
                    continue;
                }
                for (let index = 0; index < outfits.length; index++) {
                    const outfitPath = `${path}.${field}.${index}`;
                    errors.push(
                        ...exactObjectFieldValidationErrors(outfits[index], CHARACTER_OUTFIT_FIELDS, outfitPath),
                        ...requiredExactFieldsValidationErrors(outfits[index], ["id", "name", "clothing"], outfitPath),
                        ...exactObjectFieldValidationErrors(outfits[index]?.clothing, CHARACTER_CLOTHING_FIELDS, `${outfitPath}.clothing`),
                    );

                    for (const slot of Object.keys(outfits[index]?.clothing || {})) {
                        const value = outfits[index].clothing[slot];
                        if (value !== null && typeof value !== "string")
                            errors.push(
                                validationError(
                                    `${outfitPath}.clothing.${slot}`,
                                    "type",
                                    `${outfitPath}.clothing.${slot} must be text or null.`,
                                ),
                            );
                    }
                }
            }
            for (const hand of CHARACTER_HELD_ITEM_FIELDS) {
                const value = character.starting_held_items?.[hand];
                if (value !== null && typeof value !== "string")
                    errors.push(
                        validationError(
                            `${path}.starting_held_items.${hand}`,
                            "type",
                            `${path}.starting_held_items.${hand} must be text or null.`,
                        ),
                    );
            }
            return errors;
        }

        function validateCharacterExport(payload = {}) {
            const errors = [];
            const warnings = [];
            if (!isPlainObject(payload))
                return validationResult([
                    validationError("character export", "type", "Character export must be an object."),
                ], warnings);

            const fields = Object.keys(payload);
            if (fields.length !== 1 || !["character_definition", "characters"].includes(fields[0]))
                errors.push(
                    validationError(
                        "character export",
                        "unknown_field",
                        "Character export must contain exactly character_definition or characters and no other top-level fields.",
                    ),
                );

            const records = Object.hasOwn(payload, "characters")
                ? payload.characters
                : [{ character_definition: payload.character_definition }];
            if (!Array.isArray(records) || !records.length) {
                errors.push(
                    validationError(
                        "characters",
                        "type",
                        "characters must be a non-empty array.",
                    ),
                );
                return validationResult(errors, warnings);
            }

            const ids = new Set();
            const names = new Set();
            for (let index = 0; index < records.length; index++) {
                const record = records[index];
                const path = Object.hasOwn(payload, "characters")
                    ? `characters.${index}`
                    : "character_definition";
                if (Object.hasOwn(payload, "characters")) {
                    errors.push(
                        ...exactObjectFieldValidationErrors(
                            record,
                            ["character_definition"],
                            path,
                        ),
                    );
                }
                if (!isPlainObject(record?.character_definition)) {
                    errors.push(
                        validationError(
                            `${path}.character_definition`,
                            "required",
                            `${path}.character_definition is required.`,
                        ),
                    );
                    continue;
                }
                const definitionPath = Object.hasOwn(payload, "characters")
                    ? `${path}.character_definition`
                    : "character_definition";
                const validation = validateCharacterDefinition(
                    record.character_definition,
                    definitionPath,
                );
                errors.push(...validation.errors);
                warnings.push(...validation.warnings);
                const id = record.character_definition.id;
                const name = record.character_definition.name;
                if (typeof id === "string") {
                    if (ids.has(id))
                        errors.push(
                            validationError(
                                `${definitionPath}.id`,
                                "duplicate",
                                `Character export contains duplicate id ${id}.`,
                            ),
                        );
                    ids.add(id);
                }
                if (typeof name === "string") {
                    if (names.has(name))
                        errors.push(
                            validationError(
                                `${definitionPath}.name`,
                                "duplicate",
                                `Character export contains duplicate name ${name}.`,
                            ),
                        );
                    names.add(name);
                }
            }
            return validationResult(errors, warnings);
        }

        function validateCharacterDefinition(
            character = {},
            path = "character_definition",
            options = {},
        ) {
            const errors = [];
            const warnings = [];
            errors.push(...liteDefinitionMarkerValidationErrors(character, path));
            const embedded = options.embedded === true;
            const allowedFields = embedded
                ? STORY_EMBEDDED_CHARACTER_FIELDS
                : CHARACTER_DEFINITION_FIELDS;
            const requiredFields = embedded
                ? STORY_EMBEDDED_CHARACTER_REQUIRED_FIELDS
                : CHARACTER_REQUIRED_FIELDS;
            errors.push(
                ...exactObjectFieldValidationErrors(
                    character,
                    allowedFields,
                    path,
                ),
            );
            if (!isPlainObject(character)) return validationResult(errors, warnings);
            errors.push(
                ...characterExactNestedValidationErrors(character, path, requiredFields),
            );
            if (Object.hasOwn(character, "chat_story_template") && character.chat_story_template !== null) {
                const storyPath = `${path}.chat_story_template`;
                if (!isPlainObject(character.chat_story_template))
                    errors.push(validationError(
                        storyPath,
                        "type",
                        "chat_story_template must be a complete storyTemplate object or null.",
                    ));
                else {
                    const characterId = textSlot(character.id, "");
                    if (!storyTemplateAllowsAnyPlayer(character.chat_story_template))
                        errors.push(validationError(
                            `${storyPath}.allow_any_player`,
                            "value",
                            "chat_story_template must allow a Character Library player selected by the character launcher.",
                        ));
                    const collision = characterChatStoryPrincipalCollision(
                        character.chat_story_template,
                        characterId,
                    );
                    if (collision)
                        errors.push(validationError(
                            `${storyPath}.${collision}`,
                            "duplicate",
                            "chat_story_template must not duplicate the surrounding standalone character. EmberAdventures injects it by stable id during validation and launch.",
                        ));
                    const canBind =
                        !!characterId &&
                        !collision &&
                        isPlainObject(character.chat_story_template.state) &&
                        isPlainObject(character.chat_story_template.state.characters);
                    const storyValidation = validateStoryDefinition(
                        canBind
                            ? characterChatStoryTemplateWithPrincipal(
                                  character.chat_story_template,
                                  character,
                              )
                            : character.chat_story_template,
                    );
                    const nestedPath = (sourcePath = "") => {
                        const suffix = String(sourcePath || "storyTemplate")
                            .replace(/^storyTemplate\.?/, "");
                        return suffix ? `${storyPath}.${suffix}` : storyPath;
                    };
                    for (const error of storyValidation.errors || [])
                        errors.push(validationError(
                            nestedPath(error.path),
                            error.code,
                            error.message,
                        ));
                    for (const warning of storyValidation.warnings || [])
                        warnings.push(validationError(
                            nestedPath(warning.path),
                            warning.code,
                            warning.message,
                        ));
                }
            }
            if (typeof character.name !== "string" || !character.name)
                errors.push(validationError(`${path}.name`, "required", "Character name is required."));
            if (typeof character.gender !== "string" || !character.gender)
                errors.push(validationError(`${path}.gender`, "required", "Character gender is required."));
            if (!Number.isSafeInteger(character.age) || character.age < (embedded ? 0 : 18))
                errors.push(validationError(
                    `${path}.age`,
                    "type",
                    embedded
                        ? "Story character age must be a non-negative whole number."
                        : "Character age must be a whole number of at least 18.",
                ));
            if (!Number.isSafeInteger(character.version) || character.version < 1)
                errors.push(validationError(`${path}.version`, "type", `${path}.version must be a positive whole number.`));
            for (const field of ["can_die", "romanceable"])
                if (typeof character[field] !== "boolean")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be true or false.`));
            for (const field of [
                "id", "name", "source", "creation_tool", "gender", "fallback_name",
                "fallback_starting_outfit_id", "role", "personality_description", "speech_style",
                "starting_outfit_id", "starting_relationship_to_player", "starting_state_of_mind",
                "starting_physical_state", "starting_pose", "created_at", "updated_at",
            ])
                if (typeof character[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be text.`));
            if (!validCharacterBoldness(character.boldness))
                errors.push(validationError(`${path}.boldness`, "type", "boldness must be a whole number from 1 through 10 or a nonempty custom description."));
            for (const field of [
                "starting_trust", "starting_attraction", "starting_affection",
            ])
                if (
                    typeof character[field] !== "number" ||
                    !Number.isFinite(character[field]) ||
                    character[field] < 0 ||
                    character[field] > 10
                )
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be a finite number from 0 through 10.`));
            errors.push(...nonnegativeSafeIntegerValidationErrors(character.default_seed, `${path}.default_seed`));
            for (const field of [
                ...(embedded ? [] : ["genres"]),
                "starting_inventory",
                "starting_known_facts",
            ])
                if (!Array.isArray(character[field]))
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be an array.`));
            errors.push(
                ...characterStartingInventoryValidationErrors(character.starting_inventory, `${path}.starting_inventory`),
                ...requiredExactStringArrayValidationErrors(character.starting_known_facts, `${path}.starting_known_facts`),
            );


            if (character.voice !== null)
                errors.push(validationError(`${path}.voice`, "type", "voice must be null in an authored character definition."));
            if (!embedded)
                errors.push(...exactGenreValidationErrors(character.genres, `${path}.genres`));
            const clothingError = characterDefinitionRuntimeClothingError(
                character,
                path,
            );
            if (clothingError) errors.push(clothingError);
            errors.push(...characterAppearanceScaleValidationErrors(character, path));
            errors.push(...characterGenderAdaptationValidationErrors(character, path, {
                requireRomanceable: options.requireRomanceable,
            }));
            errors.push(...characterStatsValidationErrors(character, path, {
                allowDecimals: embedded,
            }));
            errors.push(...characterKnownFactsValidationErrors(character, path));
            errors.push(...characterImagePromptValidationErrors(character, path));
            if (embedded && Number.isSafeInteger(character.age) && character.age < 18) {

                if (character.romanceable !== false)
                    errors.push(validationError(`${path}.romanceable`, "minor_safety", "Story characters under 18 must set romanceable to false."));
                for (const field of ["starting_attraction"])
                    if (character[field] !== 0)
                        errors.push(validationError(`${path}.${field}`, "minor_safety", `${path}.${field} must be 0 for a character under 18.`));


            }


            if (!embedded)
                errors.push(
                    ...runtimeReferenceValueValidationErrors(
                        character,
                        path,
                        new Set([
                            normalizeRuntimeMessageTemplateKey(character.id),
                        ]),
                        character,
                    ),
                );
            return validationResult(errors, warnings);
        }

        function validateAnimalDefinition(animal = {}, path = "animal_definition") {
            const errors = [
                ...liteDefinitionMarkerValidationErrors(animal, path),
                ...exactObjectFieldValidationErrors(animal, ANIMAL_DEFINITION_FIELDS, path),
                ...requiredExactFieldsValidationErrors(animal, ANIMAL_DEFINITION_REQUIRED_FIELDS, path),
            ];
            const warnings = [];
            if (!isPlainObject(animal)) return validationResult(errors, warnings);

            if (!Number.isSafeInteger(animal.version) || animal.version < 1)
                errors.push(validationError(`${path}.version`, "type", `${path}.version must be a positive whole number.`));
            if (!Number.isSafeInteger(animal.age) || animal.age < 0)
                errors.push(validationError(`${path}.age`, "type", `${path}.age must be a non-negative whole number.`));
            if (typeof animal.can_die !== "boolean")
                errors.push(validationError(`${path}.can_die`, "type", `${path}.can_die must be true or false.`));
            for (const field of [
                "id", "name", "source", "creation_tool", "gender", "role", "species",
                "physical_description", "personality_description", "communication_style",
                "starting_relationship_to_player", "starting_state_of_mind",
                "starting_physical_state", "starting_pose", "created_at", "updated_at",
            ])
                if (typeof animal[field] !== "string" || !animal[field].trim())
                    errors.push(validationError(`${path}.${field}`, "required", `${path}.${field} must be non-empty text.`));
            for (const field of ["starting_trust", "starting_affection"])
                if (
                    typeof animal[field] !== "number" ||
                    !Number.isFinite(animal[field]) ||
                    animal[field] < 0 ||
                    animal[field] > 10
                )
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a finite number from 0 through 10.`));
            errors.push(
                ...requiredExactStringArrayValidationErrors(animal.starting_known_facts, `${path}.starting_known_facts`),
                ...characterStatsValidationErrors(animal, path, { allowDecimals: true }),
            );
            if (Object.hasOwn(animal, "default_seed"))
                errors.push(...nonnegativeSafeIntegerValidationErrors(animal.default_seed, `${path}.default_seed`));
            if (isPlainObject(animal.image_prompt_config)) {
                errors.push(
                    ...exactObjectFieldValidationErrors(animal.image_prompt_config, CHARACTER_IMAGE_PROMPT_FIELDS, `${path}.image_prompt_config`),
                    ...requiredExactFieldsValidationErrors(animal.image_prompt_config, CHARACTER_IMAGE_PROMPT_FIELDS, `${path}.image_prompt_config`),
                );
                if (typeof animal.image_prompt_config.seed_enabled !== "boolean")
                    errors.push(validationError(`${path}.image_prompt_config.seed_enabled`, "type", `${path}.image_prompt_config.seed_enabled must be true or false.`));
                errors.push(...nonnegativeSafeIntegerValidationErrors(animal.image_prompt_config.seed, `${path}.image_prompt_config.seed`));
                for (const field of ["style", "profile_style", "negative", "negative_prompt"])
                    if (typeof animal.image_prompt_config[field] !== "string")
                        errors.push(validationError(`${path}.image_prompt_config.${field}`, "type", `${path}.image_prompt_config.${field} must be text.`));
            } else if (Object.hasOwn(animal, "image_prompt_config"))
                errors.push(validationError(`${path}.image_prompt_config`, "type", `${path}.image_prompt_config must be an object.`));
            if (Object.hasOwn(animal, "default_profile_image"))
                errors.push(
                    ...exactObjectFieldValidationErrors(animal.default_profile_image, CHARACTER_PROFILE_IMAGE_SLOT_FIELDS, `${path}.default_profile_image`),
                    ...requiredExactFieldsValidationErrors(animal.default_profile_image, CHARACTER_PROFILE_IMAGE_SLOT_REQUIRED_FIELDS, `${path}.default_profile_image`),
                    ...characterProfileImageSlotValidationErrors(animal.default_profile_image, `${path}.default_profile_image`),
                );
            if (Object.hasOwn(animal, "profile_image_presentations")) {
                errors.push(
                    ...exactObjectFieldValidationErrors(animal.profile_image_presentations, CHARACTER_PROFILE_PRESENTATION_FIELDS, `${path}.profile_image_presentations`),
                    ...requiredExactFieldsValidationErrors(animal.profile_image_presentations, CHARACTER_PROFILE_PRESENTATION_FIELDS, `${path}.profile_image_presentations`),
                );
                for (const presentation of CHARACTER_PROFILE_PRESENTATION_FIELDS) {
                    const slotPath = `${path}.profile_image_presentations.${presentation}`;
                    errors.push(
                        ...exactObjectFieldValidationErrors(animal.profile_image_presentations?.[presentation], CHARACTER_PROFILE_IMAGE_SLOT_FIELDS, slotPath),
                        ...requiredExactFieldsValidationErrors(animal.profile_image_presentations?.[presentation], CHARACTER_PROFILE_IMAGE_SLOT_REQUIRED_FIELDS, slotPath),
                        ...characterProfileImageSlotValidationErrors(animal.profile_image_presentations?.[presentation], slotPath),
                    );
                }
            }
            for (const field of ["profile_images", "images"])
                if (Object.hasOwn(animal, field))
                    errors.push(
                        ...exactObjectFieldValidationErrors(animal[field], CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.${field}`),
                        ...requiredExactFieldsValidationErrors(animal[field], CHARACTER_IMAGE_COLLECTION_FIELDS, `${path}.${field}`),
                        ...characterImageCollectionValidationErrors(animal[field], `${path}.${field}`),
                    );
            if (Object.hasOwn(animal, "voice") && animal.voice !== null)
                errors.push(validationError(`${path}.voice`, "type", `${path}.voice must be null in an authored animal definition.`));
            return validationResult(errors, warnings);
        }

        function validationErrorsText(result = {}) {
            return (result.errors || [])
                .map((error) => `${error.path}: ${error.message}`)
                .join("\n");
        }

        function logDefinitionValidationWarnings(result = {}, context = "definition") {
            for (const warning of result.warnings || []) {
                log(
                    "Definition guidance warning",
                    `${context}: ${warning.path}: ${warning.message}`,
                    { type: "state", level: "warning" },
                );
            }
        }

        function assertValidStoryDefinition(template = {}, context = "story definition") {
            const result = validateStoryDefinition(template);
            logDefinitionValidationWarnings(result, context);
            if (result.ok) return template;
            const err = new Error(`${context} is invalid:\n${validationErrorsText(result)}`);
            reportAppIssue(err, {
                title: "Invalid Story Definition",
                type: "system",
                context,
                details: { errors: result.errors },
            });
            throw err;
        }

        function assertValidCharacterDefinition(record = {}, context = "character definition") {
            const result = validateCharacterDefinition(record);
            logDefinitionValidationWarnings(result, context);
            if (result.ok) return record;
            const err = new Error(`${context} is invalid:\n${validationErrorsText(result)}`);
            reportAppIssue(err, {
                title: "Invalid Character Definition",
                type: "system",
                context,
                details: { errors: result.errors },
            });
            throw err;
        }

        function rejectMissingLibraryMetadata(kind, errorsByName = []) {
            const messages = errorsByName.filter(Boolean);
            if (!messages.length) return false;
            showNotice(
                `${kind} Metadata Required`,
                messages.join("\n"),
            );
            return true;
        }

        function importedCharacterDisplayName(record = {}) {
            return (
                textSlot(record.name, "") ||
                textSlot(record.character?.name, "") ||
                textSlot(record.npc?.name, "") ||
                textSlot(record.npc?.full_character?.name, "") ||
                textSlot(record.key, "") ||
                "Imported Character"
            );
        }

        function devCompleteLibraryCharacterMetadata(overrides = {}) {
            return {
                source: "Original",
                creator_id: "00000000-0000-4000-8000-000000000001",
                creator: "debug harness",
                creation_tool: "debug harness",
                genres: ["fantasy"],
                ...overrides,
            };
        }



        function stripRuntimeTemplateFields(state) {
            // Story templates and public story definitions must be reusable setup,
            // not a player's live save. Keep mutable playthrough state out here so
            // exports and hosted payloads do not leak runtime settings/progress.
            const raw = clone(state || defaultState);
            const authoredPlayerBoldness = raw.player?.boldness == null
                ? undefined
                : clone(raw.player.boldness);
            const authoredPlayerOptionBoldness = new Map(
                storyTemplatePlayerOptions(raw).map((option) => [
                    textSlot(option.id, ""),
                    option.character?.boldness == null
                        ? undefined
                        : clone(option.character.boldness),
                ]),
            );
            raw.meta ||= {};
            // This is an explicit runtime-state to authored-story projection.
            // It must not repair, coerce, default, or filter authored values.
            const next = clone(raw);
            if (isPlainObject(next.player) && authoredPlayerBoldness != null)
                next.player.boldness = authoredPlayerBoldness;
            next.meta ||= {};
            delete next.meta.setup_complete;


            delete next.meta.generation_job_id;


            delete next.meta.player_preferences;

            delete next.meta.ick_limits;
            delete next.meta.title_image_html;
            delete next.meta.title_image_alt;
            next.recent_changes = [];
            next.objectives ||= {};
            delete next.objectives.focus_id;
            if (Object.hasOwn(next.objectives, "applied_rewards"))
                throw new Error(
                    "state.objectives.applied_rewards is obsolete. Reward idempotency belongs to reward runtime.",
                );
            delete next.objectives.pending_reward_choices;
            for (const objective of next.objectives.items || []) {
                delete objective.selected_outcome_id;
                delete objective.selected_outcome_message_id;
            }
            delete next.game_loop;
            const playerOptions = storyTemplatePlayerOptions(next);
            if (playerOptions.length) {
                next.players = playerOptions.map((option) => {
                    const player = addImmutableDefinitionFields(option.character, option.name);
                    const authoredBoldness = authoredPlayerOptionBoldness.get(
                        textSlot(option.id, ""),
                    );
                    if (authoredBoldness != null) player.boldness = authoredBoldness;
                    return player;
                });
                if (!playerOptions.some((option) => option.name === next.player?.name))
                    next.player = clone(next.players[0]);
            } else {
                next.players = [];
            }
            addImmutableDefinitionFieldsToState(next);
            return next;
        }

        function validatedStoryTemplateRecord(
            template = {},
            validation = validateStoryDefinition(template),
        ) {
            if (!validation.ok)
                throw new Error(validationErrorsText(validation));
            return clone(template);
        }

        function storyTitleCardPromptTitle(state = {}, template = {}) {
            return textSlot(
                template.title || storyTemplateTitle(state),
                "EmberAdventures story",
            );
        }

        const STORY_BUILDER_TREE_ZOOM_MIN = 0.08;
        const STORY_BUILDER_TREE_ZOOM_MAX = 1.8;

        function storyTitleCardSubjects(template = {}, state = {}) {
            return stringListSlot(
                template.title_card_subjects || [],
                [],
            ).slice(0, 5);
        }

        function storyTitleCardPromptRules(state = {}, template = {}) {
            const subjects = storyTitleCardSubjects(template, state).map(storyTitleCardImageSafeText);
            return joinPromptParts([
                "cinematic illustrated cover background only",
                "leave a clean darker lower-third area for the EmberAdventures UI overlay",
                subjects.length
                    ? `featured visual subjects: ${subjects.join(", ")}`
                    : "",
            ]);
        }

        function storyTitleCardImageSafeText(value = "") {
            return cleanPromptText(value);
        }

        function storyTitleCardPromptWithRules(prompt = "", state = {}, template = {}) {
            return joinPromptParts([
                storyTitleCardImageSafeText(
                    textSlot(prompt, defaultStoryTitleCardPrompt(state, template)),
                ),
                storyTitleCardPromptRules(state, template),
            ]);
        }

        function defaultStoryTitleCardPrompt(state = {}, template = {}) {
            const genres = approvedGenreList(
                template.genres || [],
            );
            return joinPromptParts([
                "square cinematic story cover art",
                storyTitleCardImageSafeText(template.description),
                genres.length ? `${genres.join(" ")} story` : "",
                "dramatic RPG cover art",
                "clear focal background based on the story premise",
                "square composition",
            ]);
        }

        function buildStoryTitleCardNegativePrompt() {
            return "text, title, readable words, letters, logo, watermark, signature, artist signature, initials, writing, glyphs, symbols, caption, label, speech bubble, menu text, UI text, subtitle, tagline, author name, episode label";
        }

        function emptyStoryTitleCardImageSlot() {
            return {
                id: "",
                title: "",
                prompt: "",
                negativePrompt: "",
                seed: 0,
                model: "",
                source: "none",
                url: "",
                hosted_url: "",
                html: "",
                favorite: false,
            };
        }

        function createStoryTitleCardImageSlot(value, state = {}, template = {}) {
            const slot = isPlainObject(value) ? value : {};
            if (slot.source === "none") return emptyStoryTitleCardImageSlot();
            return {
                id: textSlot(slot.id, "title-card-image"),
                title: textSlot(slot.title, `${textSlot(template.title || storyTemplateTitle(state), "Story")} title card`),
                prompt: textSlot(slot.prompt, defaultStoryTitleCardPrompt(state, template)),
                negativePrompt: textSlot(slot.negativePrompt, ""),
                seed: exactProfileImageSeed(
                    slot.seed ?? 0,
                    "story title image seed",
                ),
                model: selectedImageModel(slot.model || app.settings?.imageModel),
                source: textSlot(slot.source, ""),
                url: textSlot(slot.url, ""),
                hosted_url: textSlot(slot.hosted_url, ""),
                html: stableImageHtmlToString(slot.html || ""),
                favorite: slot.favorite === true,
                upload_attestation_classification: textSlot(
                    slot.upload_attestation_classification,
                    "",
                ),
                upload_attested_by: textSlot(slot.upload_attested_by, ""),
                upload_attested_at: textSlot(slot.upload_attested_at, ""),
                upload_attestation_policy_version: Number.isSafeInteger(
                    slot.upload_attestation_policy_version,
                )
                    ? slot.upload_attestation_policy_version
                    : 0,
            };
        }

        function createStoryTitleCardHistoryRecord(image, state = {}, template = {}) {
            if (!image || typeof image !== "object") return null;
            const slot = createStoryTitleCardImageSlot(
                {
                    id: image.id,
                    title: image.title,
                    prompt: image.prompt,
                    negativePrompt: image.negativePrompt,
                    seed: image.seed,
                    model: image.model,
                    source: image.source,
                    url: image.url || image.hosted_url,
                    favorite: image.favorite,
                    upload_attestation_classification:
                        image.upload_attestation_classification,
                    upload_attested_by: image.upload_attested_by,
                    upload_attested_at: image.upload_attested_at,
                    upload_attestation_policy_version:
                        image.upload_attestation_policy_version,
                },
                state,
                template,
            );
            const rawHtml = stableImageHtmlToString(image.html || "");
            const url =
                imageSrcFromHtml(rawHtml) ||
                extractImageSrc(rawHtml) ||
                textSlot(slot.url, "");
            const html = rawHtml || imageTagForStoredSrc(url);
            if (!html && !url && image.error) return null;
            if (!html && !url && !image.pending && !image.error && !image.id) return null;
            return {
                id: String(image.id || Date.now() + Math.random()),
                at: image.at || new Date().toISOString(),
                source: String(image.source || "generated"),
                reason: String(image.reason || "story title card"),
                title: slot.title,
                prompt: slot.prompt,
                negativePrompt: slot.negativePrompt,
                seed: slot.seed,
                model: selectedImageModel(slot.model),
                html,
                url,
                hosted_url: textSlot(image.hosted_url || url, ""),
                favorite: !!image.favorite,
                pending: !!image.pending,
                error: String(image.error || ""),
                smoke_test_artifact:
                    image.smoke_test_artifact === true ||
                    template.smoke_test_artifact === true,
                upload_attestation_classification: textSlot(
                    image.upload_attestation_classification,
                    "",
                ),
                upload_attested_by: textSlot(image.upload_attested_by, ""),
                upload_attested_at: textSlot(image.upload_attested_at, ""),
                upload_attestation_policy_version: Number.isSafeInteger(
                    image.upload_attestation_policy_version,
                )
                    ? image.upload_attestation_policy_version
                    : 0,
            };
        }

        function storyTitleCardImageSlotFromRecord(record, state = {}, template = {}) {
            return createStoryTitleCardImageSlot(
                {
                    id: record?.id || "",
                    title: record?.title || "",
                    prompt: record?.prompt || "",
                    negativePrompt: record?.negativePrompt || "",
                    seed: record?.seed,
                    model: record?.model,
                    source: record?.source || "generated",
                    url: record?.url || record?.hosted_url || "",
                    favorite: record?.favorite,
                    upload_attestation_classification:
                        record?.upload_attestation_classification,
                    upload_attested_by: record?.upload_attested_by,
                    upload_attested_at: record?.upload_attested_at,
                    upload_attestation_policy_version:
                        record?.upload_attestation_policy_version,
                },
                state,
                template,
            );
        }

        function createStoryTitleCardImageHistory(
            value,
            state = {},
            template = {},
            activeSlot = null,
        ) {
            const records = [];
            const add = (image) => {
                const record = createStoryTitleCardHistoryRecord(image, state, template);
                if (record && !records.some((item) => String(item.id) === String(record.id))) {
                    records.push(record);
                }
            };
            if (Array.isArray(value)) value.forEach(add);
            const active = activeSlot
                ? createStoryTitleCardHistoryRecord(activeSlot, state, template)
                : null;
            if (
                active &&
                (active.html || active.url || active.pending || active.error)
            ) {
                add(active);
            }
            return records.sort(
                (a, b) =>
                    (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0),
            );
        }

        function storyTemplateTitle(state = app.state) {
            return (
                state?.meta?.story_source?.title ||
                state?.location?.world ||
                state?.world_flags?.premise?.split?.("\n")?.[0] ||
                "Untitled Story"
            );
        }

        function storyTemplateDescription(state = app.state) {
            return (
                state?.meta?.story_source?.description ||
                state?.scene?.summary ||
                sceneObjectiveLabel(state) ||
                ""
            );
        }

        function currentStoryTemplateRecord(reason = "generated story", creatorIdentity = selectedCreatorIdentity()) {
            const generationId = String(
                app.state?.meta?.generation_job_id || "",
            );
            const record = validatedStoryTemplateRecord({lite: true,
                id:
                    generationId
                        ? `story-${generationId}`
                        : `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                title: storyTemplateTitle(app.state),
                description: storyTemplateDescription(app.state),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                reason,
                // SANITIZE REPLACED: generated story-template records export
                // reusable setup state only, not a full live runtime save.
                // SANITIZE TEST: Covered by story-template/start/import smoke coverage.
                state: stripRuntimeTemplateFields(app.state),
                messages: (app.messages || []).slice(0, 3).map(compactMessageForStorage),
                source: null,
                creation_tool: "Perchance AI",
                generationJobId: generationId,
                app: "EmberAdventures",
                templateType: "story",
            });
            setStoryLibraryCreatorMetadata(record, creatorIdentity);
            return record;
        }

        async function saveStoryTemplateFromCurrent(reason = "generated story") {
            app.storyTemplates ||= [];
            const creatorIdentity = selectedCreatorIdentity() ||
                await chooseCreatorIdentityForImport("This generated story", {
                    confirmText: "Save",
                });
            if (!creatorIdentity) return null;
            const record = currentStoryTemplateRecord(reason, creatorIdentity);
            assertValidStoryDefinition(record, `save generated story template ${record.title || ""}`);
            await compileStoryTemplateValidationArtifact(record, {
                onProgress: (message) =>
                    setStatus(String(message || "Compiling story definition")),
            });
            const index = app.storyTemplates.findIndex(
                (template) =>
                    String(template.id || "") === String(record.id || "") ||
                    (!!record.generationJobId &&
                        String(template.generationJobId || "") ===
                            String(record.generationJobId)),
            );
            if (index >= 0) app.storyTemplates[index] = record;
            else app.storyTemplates.push(record);
            invalidateStoryLibraryVisibleTemplatesCache();
            saveStoryTemplateRecordsNow([record], "current generated story template saved");
            return record;
        }

        function storyTemplateById(id) {
            return (app.storyTemplates || []).find(
                (template) => String(template.id) === String(id),
            );
        }
        function invalidateStoryLibraryVisibleTemplatesCache() {
            app.storyLibraryVisibleTemplatesCache = null;
        }
        function normalizeLogType(type) {
            const value = String(type || "system").toLowerCase();
            for (const key of Object.keys(LOG_SETTING_BY_TYPE)) {
                const normalizedKey = key.toLowerCase();
                if (value === normalizedKey) return key;
            }
            for (const key of Object.keys(LOG_SETTING_BY_TYPE).sort((a, b) => b.length - a.length)) {
                const normalizedKey = key.toLowerCase();
                if (value.includes(normalizedKey)) return key;
            }
            if (/prompt|response|ai|text/i.test(value)) return "ai";
            return "system";
        }
        function logSettingEnabled(type = "system") {
            // Normal players should generate no diagnostic output. Every browser
            // console/Dev Log path must pass through these explicit log settings.
            return logSettingEnabledForSettings(
                type,
                app?.settings || {},
                EMBERADVENTURES_DEBUG_ALL_LOGS,
            );
        }
        function logSettingEnabledForSettings(
            type = "system",
            settings = {},
            debugAll = false,
        ) {
            if (debugAll) return true;
            const setting = LOG_SETTING_BY_TYPE[normalizeLogType(type)];
            return !!(setting && settings?.[setting]);
        }
        function smokeDevTraceCaptureActive() {
            return Array.isArray(app?.smokeDevTraceCapture);
        }
        function appendSmokeDevTraceCapture(entry = {}) {
            if (!smokeDevTraceCaptureActive()) return null;
            app.smokeDevTraceCaptureNextId = Math.max(
                1,
                Number(app.smokeDevTraceCaptureNextId) || 1,
            );
            const captured = {
                id: app.smokeDevTraceCaptureNextId++,
                at: new Date().toISOString(),
                ...traceValue(entry),
            };
            // Smoke capture is intentionally unbounded. Failed smoke reports need
            // the full diagnostic sequence, even when normal Dev Log retention
            // would cap entries or user log settings would suppress categories.
            app.smokeDevTraceCapture.push(captured);
            return captured;
        }
        function log(title, detail = "", opts = {}) {
            const logType = opts.type || "system";
            const logLevel = opts.level || "message";
            if (
                logLevel !== "error" &&
                logLevel !== "warning" &&
                !logSettingEnabled(logType) &&
                !smokeDevTraceCaptureActive()
            )
                return null;
            const resolvedDetail = typeof detail === "function" ? detail() : detail;
            const resolvedDetails = typeof opts.details === "function"
                ? opts.details()
                : opts.details || {};
            const entry = {
                text: resolvedDetail ? `${title}\n${resolvedDetail}` : String(title || ""),
                title: String(title || ""),
                detail: String(resolvedDetail || ""),
                logType,
                logLevel,
                details: traceValue(resolvedDetails),
                at: new Date().toISOString(),
            };
            writeConsoleLog(entry);
            recordDevTraceEntry({ type: `LOG ${logType}`, ...entry });
            if (logLevel === "error" || logLevel === "warning") {
                showDevIssuePopup({
                    at: entry.at,
                    severity: logLevel,
                    title: entry.title,
                    context: logType,
                    message: entry.detail || entry.text || "",
                    details: entry.details,
                    stack: "",
                });
            }
            return entry;
        }
        function writeConsoleLog(
            entry = {},
            settings = app?.settings || {},
            debugAll = EMBERADVENTURES_DEBUG_ALL_LOGS,
            consoleWriter = console.error,
        ) {
            // Logging contract: browser console output is for real errors only.
            // Routine diagnostics belong in the in-app Dev Log.
            if ((entry.logLevel || entry.level) !== "error") return false;
            consoleWriter(
                `[EmberAdventures ${entry.logLevel || "message"} / ${entry.logType || entry.type || "system"}] ${entry.title || entry.type || "Log"}`,
                entry.detail || entry.text || "",
            );
            return true;
        }
        function recordDevTraceEntry(
            entry = {},
            settings = app?.settings || {},
            debugAll = EMBERADVENTURES_DEBUG_ALL_LOGS,
        ) {
            appendSmokeDevTraceCapture(entry);
            if (
                (entry.logLevel || entry.level) !== "error" &&
                (entry.logLevel || entry.level) !== "warning" &&
                !logSettingEnabledForSettings(
                    entry.logType || entry.type,
                    settings,
                    debugAll,
                )
            )
                return false;
            appendDevTraceEntry(entry);
            return true;
        }
        function reportDevTraceArchiveFailure(error) {
            devTraceArchiveFailure = error instanceof Error
                ? error
                : new Error(String(error || "Dev Log archive failed."));
            writeConsoleLog({
                title: "Dev Log archive failed",
                detail: devTraceArchiveFailure.message,
                logType: "storage",
                logLevel: "error",
                at: new Date().toISOString(),
            });
        }
        function queueDevTraceArchiveOperation(work) {
            const next = devTraceArchiveOperation.then(work, work);
            devTraceArchiveOperation = next.catch(() => {});
            return next;
        }
        function scheduleDevTraceArchiveFlush(immediate = false) {
            if (!devTraceArchiveInitialized || !devTraceArchivePendingEntries.length)
                return;
            if (devTraceArchiveFlushTimer) {
                if (!immediate) return;
                clearTimeout(devTraceArchiveFlushTimer);
            }
            devTraceArchiveFlushTimer = setTimeout(
                () => {
                    devTraceArchiveFlushTimer = 0;
                    flushDevTraceArchive().catch(reportDevTraceArchiveFailure);
                },
                immediate ? 0 : DEV_TRACE_ARCHIVE_FLUSH_DELAY_MS,
            );
        }
        async function initializeDevTraceArchive() {
            if (devTraceArchiveStartupPromise) return devTraceArchiveStartupPromise;
            devTraceArchiveStartupPromise = queueDevTraceArchiveOperation(async () => {
                await persistenceWorkerRequest("dev-trace-reset");
                devTraceArchiveInitialized = true;
                devTraceArchiveFailure = null;
                return true;
            })
                .then(async (result) => {
                    await flushDevTraceArchive();
                    return result;
                })
                .catch((error) => {
                    reportDevTraceArchiveFailure(error);
                    return false;
                });
            return devTraceArchiveStartupPromise;
        }
        function queueDevTraceArchiveEntry(entry = {}) {
            devTraceArchivePendingEntries.push(entry);
            scheduleDevTraceArchiveFlush(
                entry.logLevel === "error" || entry.logLevel === "warning",
            );
        }
        async function flushDevTraceArchive() {
            if (devTraceArchiveFlushTimer) {
                clearTimeout(devTraceArchiveFlushTimer);
                devTraceArchiveFlushTimer = 0;
            }
            if (!devTraceArchiveInitialized) {
                if (devTraceArchiveStartupPromise) await devTraceArchiveStartupPromise;
                if (!devTraceArchiveInitialized)
                    throw devTraceArchiveFailure || new Error("Dev Log archive is not initialized.");
            }
            return queueDevTraceArchiveOperation(async () => {
                while (devTraceArchivePendingEntries.length) {
                    const batch = devTraceArchivePendingEntries.splice(
                        0,
                        DEV_TRACE_ARCHIVE_BATCH_SIZE,
                    );
                    try {
                        await persistenceWorkerRequest("dev-trace-append", {
                            entries: batch,
                        });
                    } catch (error) {
                        devTraceArchivePendingEntries.unshift(...batch);
                        throw error;
                    }
                }
                devTraceArchiveFailure = null;
                return true;
            });
        }
        async function clearDevTraceArchive() {
            if (devTraceArchiveFlushTimer) {
                clearTimeout(devTraceArchiveFlushTimer);
                devTraceArchiveFlushTimer = 0;
            }
            devTraceArchivePendingEntries = [];
            if (!devTraceArchiveInitialized) await initializeDevTraceArchive();
            await queueDevTraceArchiveOperation(() =>
                persistenceWorkerRequest("dev-trace-reset"),
            );
            app.devTrace = [];
            devTraceArchiveFailure = null;
            return true;
        }
        async function devTraceArchiveEntries() {
            await flushDevTraceArchive();
            return persistenceWorkerRequest("dev-trace-read");
        }
        async function replaceDevTraceArchiveForSmoke(
            archivedEntries = [],
            recentEntries = [],
            nextId = 1,
        ) {
            await clearDevTraceArchive();
            for (
                let offset = 0;
                offset < archivedEntries.length;
                offset += DEV_TRACE_ARCHIVE_BATCH_SIZE
            ) {
                await persistenceWorkerRequest("dev-trace-append", {
                    entries: archivedEntries.slice(
                        offset,
                        offset + DEV_TRACE_ARCHIVE_BATCH_SIZE,
                    ),
                });
            }
            app.devTrace = clone(recentEntries || []);
            app.devTraceNextId = Math.max(1, Number(nextId) || 1);
            devTraceArchivePendingEntries = [];
            return true;
        }
        async function devTraceArchiveStats() {
            await flushDevTraceArchive();
            return persistenceWorkerRequest("dev-trace-stats");
        }
        function appendDevTraceEntry(entry = {}) {
            app.devTrace ||= [];
            const maxExistingId = app.devTrace.reduce(
                (max, item) => Math.max(max, Number(item?.id) || 0),
                0,
            );
            if (!Number.isFinite(app.devTraceNextId) || app.devTraceNextId <= maxExistingId)
                app.devTraceNextId = maxExistingId + 1;
            // Dev Log IDs are stable session sequence numbers. The retained
            // array stays oldest-to-newest; when it reaches the cap, drop only
            // the oldest retained entry instead of renumbering or clearing.
            const storedEntry = {
                id: app.devTraceNextId++,
                at: new Date().toISOString(),
                ...traceValue(entry),
            };
            app.devTrace.push(storedEntry);
            queueDevTraceArchiveEntry(storedEntry);
            while (app.devTrace.length > DEV_TRACE_LIMIT) app.devTrace.shift();
            return app.devTrace[app.devTrace.length - 1] || null;
        }
        function traceValue(value) {
            if (value == null) return value;
            const seen = new WeakSet();
            const compact = (item, key = "", depth = 0) => {
                if (item == null || typeof item === "number" || typeof item === "boolean")
                    return item;
                if (typeof item === "string") {
                    if (/^data:image\//i.test(item)) return `[image data: ${item.length} characters]`;
                    if (/^blob:/i.test(item)) return item;
                    if (/<img\b[^>]*\bsrc=["']data:image\//i.test(item))
                        return `[image HTML: ${item.length} characters]`;
                    if (item.length > 250000)
                        return `${item.slice(0, 50000)}\n...[${item.length - 100000} characters omitted]...\n${item.slice(-50000)}`;
                    return item;
                }
                if (typeof item !== "object") return String(item);
                if (seen.has(item)) return "[circular reference]";
                if (depth >= 10) return `[nested ${Array.isArray(item) ? "array" : "object"}]`;
                if (item instanceof Blob)
                    return `[Blob ${item.type || "application/octet-stream"}, ${item.size} bytes]`;
                seen.add(item);
                if (Array.isArray(item)) {
                    const limit = 250;
                    const values = item.slice(0, limit).map((value) => compact(value, key, depth + 1));
                    if (item.length > limit) values.push(`[${item.length - limit} more items]`);
                    return values;
                }
                const result = {};
                for (const [childKey, childValue] of Object.entries(item)) {
                    if (
                        /^(?:base64|data_url|dataUrl)$/i.test(childKey) ||
                        (/html/i.test(childKey) &&
                            typeof childValue === "string" &&
                            /data:image\//i.test(childValue))
                    ) {
                        result[childKey] = `[image payload: ${String(childValue || "").length} characters]`;
                        continue;
                    }
                    result[childKey] = compact(childValue, childKey, depth + 1);
                }
                return result;
            };
            return compact(value);
        }
        function devTraceTextValue(value) {
            if (typeof value !== "string") return value;
            const trimmed = value.trim();
            if (
                (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                (trimmed.startsWith("[") && trimmed.endsWith("]"))
            ) {
                try {
                    return JSON.parse(trimmed);
                } catch {
                    // Keep non-JSON strings as human text. Do not JSON stringify
                    // Dev Log display text because escaped "\n" made AI prompts
                    // and responses unreadable during debugging.
                }
            }
            return value.replace(/\\n/g, "\n");
        }
        function indentDevTraceText(text, spaces = 2) {
            const pad = " ".repeat(spaces);
            return String(text || "")
                .split("\n")
                .map((line) => `${pad}${line}`)
                .join("\n");
        }
        function formatDevTraceValue(value, level = 1) {
            const prepared = devTraceTextValue(value);
            const indent = " ".repeat(level * 2);
            if (prepared == null) return `${indent}${String(prepared)}`;
            if (typeof prepared === "string") {
                return indentDevTraceText(prepared, level * 2);
            }
            if (
                typeof prepared === "number" ||
                typeof prepared === "boolean"
            ) {
                return `${indent}${String(prepared)}`;
            }
            if (Array.isArray(prepared)) {
                if (!prepared.length) return `${indent}[]`;
                return prepared
                    .map((item) => {
                        const normalized = devTraceTextValue(item);
                        if (
                            normalized == null ||
                            typeof normalized === "string" ||
                            typeof normalized === "number" ||
                            typeof normalized === "boolean"
                        ) {
                            const line = formatDevTraceValue(normalized, 0).trimEnd();
                            return `${indent}- ${line.trimStart()}`;
                        }
                        return `${indent}-\n${formatDevTraceValue(normalized, level + 1)}`;
                    })
                    .join("\n");
            }
            if (typeof prepared === "object") {
                const entries = Object.entries(prepared);
                if (!entries.length) return `${indent}{}`;
                return entries
                    .map(([key, item]) => {
                        const normalized = devTraceTextValue(item);
                        if (
                            normalized == null ||
                            typeof normalized === "number" ||
                            typeof normalized === "boolean" ||
                            (typeof normalized === "string" &&
                                !normalized.includes("\n"))
                        ) {
                            return `${indent}${key}: ${String(normalized)}`;
                        }
                        return `${indent}${key}:\n${formatDevTraceValue(normalized, level + 1)}`;
                    })
                    .join("\n");
            }
            return `${indent}${String(prepared)}`;
        }
        function exactDevTraceCopyBlock(kind = "TEXT", text = "", entry = {}) {
            const safeKind = String(kind || "TEXT")
                .replace(/[^A-Z0-9_-]/gi, "_")
                .toUpperCase();
            const meta = [
                entry.id != null ? `id=${entry.id}` : "",
                entry.promptFingerprint ? `fingerprint=${entry.promptFingerprint}` : "",
            ].filter(Boolean);
            return [
                `<<<EMBERADVENTURES_${safeKind}_EXACT_COPY_START${meta.length ? ` ${meta.join(" ")}` : ""}>>>`,
                String(text || ""),
                `<<<EMBERADVENTURES_${safeKind}_EXACT_COPY_END>>>`,
            ].join("\n");
        }
        function formatDevTraceEntry(entry = {}, index = 0) {
            const title = entry.title || entry.type || "Dev Log Entry";
            const meta = [
                entry.id != null ? `id=${entry.id}` : "",
                entry.at || "",
                entry.logType ? `type=${entry.logType}` : "",
                entry.logLevel ? `level=${entry.logLevel}` : "",
            ].filter(Boolean);
            const skip = new Set(["id", "at", "title", "type", "logType", "logLevel"]);
            // log() entries store both text and detail for console compatibility.
            // The readable Dev Log should show the detail once, not duplicate the
            // same long prompt/response under both text and detail.
            if (entry.detail && entry.text) skip.add("text");
            const exactBlocks = [];
            if (title === "AI prompt" && typeof entry.prompt === "string") {
                skip.add("prompt");
                exactBlocks.push(
                    [
                        "prompt:",
                        exactDevTraceCopyBlock("PROMPT", entry.prompt, entry),
                    ].join("\n"),
                );
            }
            const body = [
                ...exactBlocks,
                ...Object.entries(entry)
                .filter(([key]) => !skip.has(key))
                .map(([key, value]) => {
                    const normalized = devTraceTextValue(value);
                    if (
                        normalized == null ||
                        typeof normalized === "number" ||
                        typeof normalized === "boolean" ||
                        (typeof normalized === "string" &&
                            !normalized.includes("\n"))
                    ) {
                        return `${key}: ${String(normalized)}`;
                    }
                    return `${key}:\n${formatDevTraceValue(normalized, 1)}`;
                }),
            ].join("\n\n");
            return [
                `===== #${entry.id ?? index + 1} ${title} =====`,
                meta.length ? meta.join(" | ") : "",
                body,
            ]
                .filter(Boolean)
                .join("\n");
        }
        function formatDevTraceText(trace = app.devTrace || []) {
            // Dev Log is a reading/debugging surface, not a machine interchange
            // format. Keep app.devTrace structured internally, but render/export
            // readable text with real newlines so long prompts can be inspected.
            if (!Array.isArray(trace) || !trace.length) return "(Dev Log is empty.)";
            return trace.map(formatDevTraceEntry).join("\n\n");
        }

        function aiResponseRawMetadata(raw) {
            // The plugin often returns a plain string. Logging that as "raw"
            // expands it into character indexes in the readable Dev Log and
            // adds no useful information beyond the response field.
            if (!raw || typeof raw === "string") return null;
            if (typeof raw !== "object")
                return {
                    type: typeof raw,
                    value: String(raw),
                };
            const meta = {};
            for (const key of [
                "stopReason",
                "finishReason",
                "error",
                "warning",
                "model",
                "usage",
            ]) {
                if (raw[key] != null) meta[key] = traceValue(raw[key]);
            }
            for (const key of [
                "generatedText",
                "text",
                "response",
                "output",
                "value",
            ]) {
                if (typeof raw[key] === "string") {
                    meta[`${key}Chars`] = raw[key].length;
                }
            }
            return Object.keys(meta).length ? meta : null;
        }

        function aiResponseDevLogDetail(label, response, raw) {
            const detail = {
                label,
                response,
            };
            const rawMetadata = aiResponseRawMetadata(raw);
            if (rawMetadata) detail.rawMetadata = rawMetadata;
            return detail;
        }

        function promptFingerprint(text = "") {
            const value = String(text || "");
            let hash = 2166136261;
            for (let i = 0; i < value.length; i += 1) {
                hash ^= value.charCodeAt(i);
                hash = Math.imul(hash, 16777619);
            }
            return `prompt-${value.length}-${(hash >>> 0).toString(16)}`;
        }

        function aiPromptDevLogDetail(label, prompt) {
            return {
                label,
                prompt,
                promptFingerprint: promptFingerprint(prompt),
            };
        }

        function issueReportText(issue = {}) {
            const lines = [
                "EmberAdventures Issue Report",
                `Build: ${emberAdventuresBuildInfo().buildId}`,
                `Source hash: ${emberAdventuresBuildInfo().sourceHash}`,
                `Private test build: ${emberAdventuresBuildInfo().privateTests}`,
                `At: ${issue.at || new Date().toISOString()}`,
                `Severity: ${issue.severity || "error"}`,
                `Title: ${issue.title || "Issue"}`,
                issue.context ? `Context: ${issue.context}` : "",
                "",
                "Message:",
                issue.message || "",
                "",
                issue.details && Object.keys(issue.details || {}).length
                    ? `Details:\n${prettyJson(issue.details)}`
                    : "",
                "",
                issue.stack ? `Stack:\n${issue.stack}` : "",
            ].filter((line) => line !== "");
            //Smoke reports are diagnostics.  Do not resolve runtime presentation
            //tokens or inspect live state while formatting them.
            return lines.join("\n");
        }

        function scrubDiagnosticSecrets(value) {
            const text = typeof value === "string" ? value : JSON.stringify(value);
            return text
                .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [removed]")
                .replace(/([?&]emberTicket=)[^&#"\s]+/g, "$1[removed]")
                .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[removed-jwt]")
                .replace(/("(?:access_token|refresh_token|apikey|api_key|authorization|ticket|token)"\s*:\s*")[^"]+(")/gi, "$1[removed]$2");
        }

        async function uploadDeveloperIssuePackage(reportId = "", blob = null) {
            const user = await requirePublicLibraryAuth();
            const path = `${user.id}/${reportId}.json.gz`;
            const response = await fetch(
                `${publicLibrarySupabaseUrl()}/storage/v1/object/developer-issues/${path}`,
                {
                    method: "POST",
                    headers: {
                        apikey: publicLibrarySupabaseAnonKey(),
                        Authorization: `Bearer ${supabaseSessionAccessToken()}`,
                        "Content-Type": "application/gzip",
                        "x-upsert": "false",
                    },
                    body: blob,
                },
            );
            if (!response.ok)
                throw new Error(`Developer issue package upload failed (${response.status}): ${await response.text()}`);
            return path;
        }

        async function submitDeveloperIssue(issue = {}, explanation = "") {
            const cleanExplanation = String(explanation || "").trim();
            if (cleanExplanation.length < 10)
                throw new Error("Explain what you were doing when the issue happened (at least 10 characters).");
            const user = await requirePublicLibraryAuth();
            const reportId = crypto.randomUUID();
            const packagePayload = {
                issue: issueReportText(issue),
                explanation: cleanExplanation,
                devLog: await devTraceExportText(),
                export: await buildDiagnosticExportPayload(),
                environment: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    viewport: { width: window.innerWidth, height: window.innerHeight },
                    url: window.location.href.split("#")[0],
                    at: new Date().toISOString(),
                },
            };
            const cleanJson = scrubDiagnosticSecrets(packagePayload);
            const compressed = await compressBlobWithGzip(new Blob([cleanJson], { type: "application/json" }));
            const packagePath = `${user.id}/${reportId}.json.gz`;
            await publicLibraryFetch("/rest/v1/developer_issue_reports", {
                method: "POST",
                body: {
                    id: reportId,
                    reporter_user_id: user.id,
                    explanation: cleanExplanation,
                    issue_title: issue.title || "EmberAdventures issue",
                    issue_severity: issue.severity || "error",
                    package_path: packagePath,
                    package_size_bytes: compressed.size,
                    app_version: String(app.version || "beta"),
                },
            });
            try {
                await uploadDeveloperIssuePackage(reportId, compressed);
            } catch (uploadError) {
                try {
                    await publicLibraryFetch(
                        `/rest/v1/developer_issue_reports?id=eq.${postgrestValue(reportId)}&reporter_user_id=eq.${postgrestValue(user.id)}`,
                        { method: "DELETE" },
                    );
                } catch (cleanupError) {
                    devLog("Developer issue reservation cleanup failed", {
                        reportId,
                        error: cleanupError?.message || String(cleanupError),
                    });
                }
                uploadError.developerIssueBlob = compressed;
                uploadError.developerIssueId = reportId;
                throw uploadError;
            }
            return reportId;
        }

        function downloadDeveloperIssuePackage(blob, reportId = "developer-issue") {
            if (!(blob instanceof Blob)) return;
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${safeArchiveFileName(reportId || "developer-issue")}.json.gz`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }

        function openSendDeveloperIssueModal(issue = {}) {
            if (!supabaseSessionAccessToken()) {
                showNotice("Sign In Required", "Sign in with Google before sending private diagnostics to the developer.");
                openPublicLibraryAccountModal();
                return;
            }
            const popup = openPopupModal(`
                <h2>Send to Developer</h2>
                <p class="hint">This sends the error, dev log, game export, save data, and device details privately to the EmberAdventures developer. These files can contain private story text and profile settings.</p>
                <label>What were you doing when this happened?
                    <textarea rows="5" data-developer-issue-explanation placeholder="Describe the action you took and what you expected..."></textarea>
                </label>
                <label class="check-row"><input type="checkbox" data-developer-issue-consent> <span>I understand that private game and diagnostic data will be sent to the developer for troubleshooting.</span></label>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" class="primary" data-developer-issue-send disabled>Send</button>
                    <button type="button" data-developer-issue-download hidden>Download Package</button>
                    <button type="button" data-developer-issue-cancel>Cancel</button>
                </div>
                <p class="hint" data-developer-issue-status></p>
            `);
            const consent = popup.box.querySelector("[data-developer-issue-consent]");
            const send = popup.box.querySelector("[data-developer-issue-send]");
            const explanation = popup.box.querySelector("[data-developer-issue-explanation]");
            const status = popup.box.querySelector("[data-developer-issue-status]");
            const download = popup.box.querySelector("[data-developer-issue-download]");
            const update = () => { send.disabled = !consent.checked || explanation.value.trim().length < 10; };
            send.dataset.uiAction = "submitDeveloperIssue";
            consent.onchange = update;
            explanation.oninput = update;
            popup.box.querySelector("[data-developer-issue-cancel]").onclick = () => popup.close();
            send.onclick = async () => {
                send.disabled = true;
                status.textContent = "Preparing and sending diagnostics...";
                try {
                    const id = await runUiAction(
                        "submitDeveloperIssue",
                        () => submitDeveloperIssue(issue, explanation.value),
                        { mode: "both", label: "Sending report", group: "" },
                    );
                    popup.close();
                    showNotice("Diagnostics Sent", `Thank you. Developer issue ${id} was sent privately.`);
                } catch (err) {
                    status.textContent = err.message || String(err);
                    if (err.developerIssueBlob) {
                        download.hidden = false;
                        download.onclick = () =>
                            downloadDeveloperIssuePackage(
                                err.developerIssueBlob,
                                err.developerIssueId,
                            );
                    }
                    update();
                }
            };
        }

        function showDevIssuePopup(issue = {}) {
            const severity = String(issue.severity || "error").toLowerCase();
            const devMode = !!app.settings?.devMode;
            if (!devMode && severity !== "error" && issue.forcePopup !== true)
                return false;
            if (app.issuePopupOpen) return false;
            try {
                app.issuePopupOpen = true;
                const actionButtons =
                    devMode || issue.allowExportBoth === true
                    ? `
                        <button id="issueSendDeveloperBtn" class="primary">Send to Developer</button>
                        <button id="issueCopyErrorBtn">Copy Error</button>
                        <button id="issueExportDevLogBtn">Export Dev Log</button>
                        <button id="issueExportBackupBtn">Export Backup</button>
                        <button id="issueExportBothBtn" class="primary">Export Both</button>
                        <button id="issueDismissBtn">Dismiss</button>
                    `
                    : `
                        <button id="issueSendDeveloperBtn" class="primary">Send to Developer</button>
                        <button id="issueCopyErrorBtn">Copy Error</button>
                        <button id="issueExportBackupBtn" class="primary">Export Backup</button>
                        <button id="issueDismissBtn">Dismiss</button>
                    `;
                const popup = openPopupModal(`
                    <h2>${escapeHtml(issue.title || "EmberAdventures Issue")}</h2>
                    <p class="hint">A reportable EmberAdventures issue occurred. Copy the error or export diagnostics before dismissing this if the problem needs investigation.</p>
                    <pre class="json-view" style="min-height:0;max-height:16rem">${escapeHtml(issueReportText(issue))}</pre>
                    <div class="row" style="margin-top:.8rem">${actionButtons}</div>
                `);
                const closeIssue = () => {
                    app.issuePopupOpen = false;
                    popup.close();
                };
                popup.box.querySelector("#issueCopyErrorBtn").onclick = () =>
                    copyTextToClipboard(issueReportText(issue));
                popup.box.querySelector("#issueSendDeveloperBtn").onclick = () =>
                    openSendDeveloperIssueModal(issue);
                const devLogButton = popup.box.querySelector("#issueExportDevLogBtn");
                if (devLogButton) {
                    devLogButton.dataset.uiAction = "exportDevTrace";
                    devLogButton.onclick = () =>
                        runUiAction(
                            "exportDevTrace",
                            exportDevTrace,
                            { mode: "both", label: "Exporting log", group: "" },
                        );
                }
                popup.box.querySelector("#issueExportBackupBtn").dataset.uiAction =
                    "exportData";
                popup.box.querySelector("#issueExportBackupBtn").onclick = () =>
                    runUiAction(
                        "exportData",
                        () =>
                            exportData({
                                fileName: "emberadventureslite-issue-backup.json",
                                emergency: true,
                            }),
                    );
                const exportBothButton = popup.box.querySelector("#issueExportBothBtn");
                if (exportBothButton) {
                    exportBothButton.dataset.uiAction = "issueExportBoth";
                    exportBothButton.onclick = async () => {
                        await runUiAction(
                            "issueExportBoth",
                            async () => {
                                await exportDevTrace();
                                await exportData({
                                    fileName: "emberadventureslite-issue-backup.json",
                                    emergency: true,
                                });
                            },
                            { mode: "both", label: "Exporting diagnostics", group: "" },
                        );
                    };
                }
                popup.box.querySelector("#issueDismissBtn").onclick = closeIssue;
                return true;
            } catch (popupErr) {
                app.issuePopupOpen = false;
                writeConsoleLog({
                    title: "Issue popup failed",
                    detail: popupErr?.message || String(popupErr),
                    logType: "system",
                    logLevel: "error",
                    at: new Date().toISOString(),
                });
                return false;
            }
        }

        function reportAppIssue(errorOrWarning, context = {}) {
            const err =
                errorOrWarning instanceof Error
                    ? errorOrWarning
                    : new Error(
                          typeof errorOrWarning === "string"
                              ? errorOrWarning
                              : JSON.stringify(errorOrWarning || {}),
                      );
            const severity = context.severity || context.level || "error";
            const title = context.title || (severity === "warning" ? "Warning" : "Error");
            const issue = {
                at: new Date().toISOString(),
                severity,
                title,
                context: context.context || context.action || "",
                message: err.message || String(errorOrWarning || ""),
                stack: err.stack || "",
                details: traceValue(context.details || {}),
                forcePopup: context.forcePopup === true,
                allowExportBoth: context.allowExportBoth === true,
            };
            showDevIssuePopup(issue);
            const logType = context.type || "system";
            const logLevel = severity === "warning" ? "warning" : "error";
            const entry = {
                title,
                detail: issue.message,
                text: issue.message,
                logType,
                logLevel,
                issueContext: issue.context,
                stack: issue.stack,
                details: issue.details,
                at: issue.at,
            };
            writeConsoleLog(entry);
            recordDevTraceEntry({ type: `LOG ${logType}`, ...entry });
            return issue;
        }

        function devLog(type, detail = {}) {
            if (!detail || typeof detail !== "object") detail = { value: detail };
            let detailText = "";
            try {
                detailText = JSON.stringify(detail || {});
            } catch {
                detailText = String(detail || "");
            }
            const logType = detail.logType || "system";
            if (!logSettingEnabled(logType) && !smokeDevTraceCaptureActive()) return;
            const safeDetail = Object.fromEntries(
                Object.entries(detail).map(([key, value]) => [
                    key,
                    traceValue(value),
                ]),
            );
            const entry = { at: new Date().toISOString(), type, ...safeDetail };
            recordDevTraceEntry(entry);
            writeConsoleLog({
                title: `DEV ${type}`,
                detail: `${safeDetail.label || ""}\n${safeDetail.summary || ""}`.trim(),
                logType,
                logLevel: "message",
                at: entry.at,
            });
        }
        function stateTrace(type, detail = {}) {
            if (!detail || typeof detail !== "object") detail = { value: detail };
            if (!logSettingEnabled("state") && !smokeDevTraceCaptureActive()) return;
            const safeDetail = Object.fromEntries(
                Object.entries(detail).map(([key, value]) => [
                    key,
                    traceValue(value),
                ]),
            );
            const entry = {
                at: new Date().toISOString(),
                type: `STATE ${type}`,
                ...safeDetail,
            };

            recordDevTraceEntry(entry);
            writeConsoleLog({
                title: `STATE ${type}`,
                detail: `${safeDetail.label || ""}\n${safeDetail.summary || ""}`.trim(),
                logType: "state",
                logLevel: "message",
                at: entry.at,
            });
        }
        function setStatus(text) {
            app.statusText = String(text || "Ready");
            const status = $("status");
            if (status) status.textContent = app.statusText;
            const working = $("workingText");
            if (working) working.textContent = app.statusText;
        }

        function setTurnStage(stage, text) {
            app.turnStage = stage || "idle";
            if (text) setStatus(text);
            renderPlayHud();
        }
        function isPerchancePluginFrameError(message = "") {
            return /contentWindow|streamTextFromIframe|startStreamingResponse|iframe was not ready|iframe.*removed|aiTextPlugin|textToImagePlugin/i.test(
                String(message || ""),
            );
        }
        async function emergencyExportData(options = {}) {
            await exportData({
                fileName: "emberadventureslite-emergency-backup.json",
                emergency: true,
                scope: options?.scope || null,
            });
        }

        function forceMainMenuAfterError(reason = "") {
            // Recovery must never fall through to the library-first route. The
            // main menu exposes the DB reset/export tools needed to repair a
            // storage failure, including failures triggered while opening it.
            app.mainMenuOpen = true;
            app.mainMenuExplicitlyOpened = true;


            try {
                closeModal();
            } catch {
                $("modal")?.classList?.remove("open");
            }
            try {
                renderMainMenu();
            } catch (renderError) {
                const menu = $("mainMenu");
                const appEl = $("app");
                menu?.classList?.remove("hidden");
                appEl?.classList?.add("main-menu-hidden");
                console.error("Could not fully render the recovery main menu.", renderError);
            }
            stateTrace("error recovery main menu", {
                label: "main_menu_recovery",
                reason: String(reason || "").slice(0, 500),
                summary: "Error recovery forced the main menu so database tools remain available.",
            });
        }

        function showEmergencyExportFallback(reason = "") {
            const detail =
                reason && typeof reason === "object"
                    ? reason.stack || reason.message || JSON.stringify(reason)
                    : String(reason || "No reason supplied.");
            forceMainMenuAfterError(detail);
            if (document.getElementById("emberAdventuresEmergencyExport")) return;
            app.emergencyExportFallbackShown = {
                reason: detail,
                at: new Date().toISOString(),
            };
            log(
                "EmberAdventures Error Recovery shown",
                detail,
                { type: "system", level: "error" },
            );
            reportAppIssue(new Error(detail), {
                title: "EmberAdventures Error Recovery",
                type: "system",
                context: "emergency export fallback",
            });
            const panel = document.createElement("div");
            panel.id = "emberAdventuresEmergencyExport";
            panel.style.cssText = [
                "position:fixed",
                "z-index:2147483647",
                "right:1rem",
                "bottom:1rem",
                "max-width:22rem",
                "padding:1rem",
                "border:1px solid rgba(255,200,90,.85)",
                "border-radius:8px",
                "background:rgba(20,14,10,.96)",
                "color:#fff3d0",
                "box-shadow:0 0 24px rgba(0,0,0,.55)",
                "font:14px/1.4 system-ui,sans-serif",
            ].join(";");
            panel.innerHTML = `
                <strong>EmberAdventures Error Recovery</strong>
                <p style="margin:.45rem 0 .7rem">If the app cannot render normally, export a backup before refreshing.</p>
                <button type="button" style="padding:.45rem .7rem; border:0; border-radius:6px; background:#d8a634; color:#16100a; font-weight:700; cursor:pointer" onclick="EmberAdventures.emergencyExportData()">Export Backup</button>
                <button type="button" style="margin-left:.4rem; padding:.45rem .7rem; border:1px solid rgba(255,255,255,.25); border-radius:6px; background:transparent; color:#fff; cursor:pointer" onclick="document.getElementById('emberAdventuresEmergencyExport')?.remove()">Dismiss</button>
            `;
            panel.title = detail || "EmberAdventures error recovery";
            document.body?.append(panel);
        }
        function bindGlobalErrorLogging() {
            if (root.__emberAdventuresErrorLoggingBound) return;
            root.__emberAdventuresErrorLoggingBound = true;
            let lastPluginError = "";
            let lastPluginErrorAt = 0;
            const suppressPluginErrorEvent = (event, rawMessage = "") => {
                const message = String(rawMessage || "");
                if (!isPerchancePluginFrameError(message)) return false;
                // Perchance's AI plugins can throw an internal unhandled iframe
                // startup rejection even when EmberAdventures's queued AI call will retry
                // or fail cleanly. Suppress only that known plugin-frame surface so
                // JSON setup checks do not show Perchance's generic code-error banner.
                event.preventDefault?.();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();
                const now = Date.now();
                if (message === lastPluginError && now - lastPluginErrorAt < 1200)
                    return true;
                lastPluginError = message;
                lastPluginErrorAt = now;
                log(
                    "Perchance plugin iframe warning",
                    /contentWindow|streamTextFromIframe|startStreamingResponse/i.test(
                        message,
                    )
                        ? `A Perchance plugin iframe was not ready or was removed while generating. EmberAdventures will retry or report the queued AI call normally.\nRaw error: ${message}`
                        : message,
                    { type: "ai", level: "warn" },
                );
                render();
                return true;
            };
            const handleUnhandledRejection = (event) => {
                const message =
                    event.reason?.stack ||
                    event.reason?.message ||
                    String(event.reason || "");
                if (isAiCancelledError(event.reason)) {
                    event.preventDefault?.();
                    event.stopPropagation?.();
                    event.stopImmediatePropagation?.();
                    log("AI request cancellation ignored", message, {
                        type: "ai",
                        level: "message",
                    });
                    return;
                }
                if (!suppressPluginErrorEvent(event, message))
                    showEmergencyExportFallback(
                        message || "Unhandled promise rejection with no message.",
                    );
            };
            const handleWindowError = (event) => {
                const target = event?.target || null;
                if (
                    target &&
                    target !== window &&
                    target !== document &&
                    !event.error &&
                    !event.message
                ) {
                    const tag = String(target.tagName || "resource").toLowerCase();
                    const src =
                        target.currentSrc ||
                        target.src ||
                        target.href ||
                        target.getAttribute?.("src") ||
                        target.getAttribute?.("href") ||
                        "";
                    log(
                        "Resource failed to load",
                        `${tag}${src ? `: ${src}` : ""}`,
                        { type: "system", level: "warn" },
                    );
                    return;
                }
                const message =
                    event.error?.stack ||
                    event.error?.message ||
                    event.message ||
                    `Window error with no message at ${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`;
                if (isAiCancelledError(event.error) || /AI request cancelled/i.test(message)) {
                    event.preventDefault?.();
                    event.stopPropagation?.();
                    event.stopImmediatePropagation?.();
                    log("AI request cancellation ignored", message, {
                        type: "ai",
                        level: "message",
                    });
                    return;
                }
                if (!suppressPluginErrorEvent(event, message))
                    showEmergencyExportFallback(message);
            };
            root.addEventListener?.("unhandledrejection", handleUnhandledRejection, true);
            window.addEventListener?.("unhandledrejection", handleUnhandledRejection, true);
            root.addEventListener?.("error", handleWindowError, true);
            window.addEventListener?.("error", handleWindowError, true);
        }
        async function init() {
            initializeAiTextPlugin();
            bindGlobalErrorLogging();
            generationPreferences();
            await globalThis.EmberRuntime.start();
            app.persistence = globalThis.EmberRuntime.persistence;
            app.library = globalThis.EmberRuntime.library;
            app.turn = globalThis.EmberRuntime.turn;
            await initializeDevTraceArchive();
            appendDevTraceEntry({
                type: "BUILD",
                title: "EmberAdventures build",
                build: emberAdventuresBuildInfo(),
                at: new Date().toISOString(),
            });
            startLongTaskObserver();
            startLongAnimationFrameObserver();
            startEventLoopStallMonitor();
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "hidden")
                    flushDevTraceArchive().catch(reportDevTraceArchiveFailure);
            });
            window.addEventListener(
                "pagehide",
                () => {
                    flushDevTraceArchive().catch(reportDevTraceArchiveFailure);
                    const diagnosticExport = readDiagnosticExportPhase();
                    if (diagnosticExport?.status === "in_progress")
                        writeDiagnosticExportPhase({
                            phase: diagnosticExport.phase,
                            pagehideObservedAt: new Date().toISOString(),
                        });
                    for (const url of sessionImageObjectUrlCache().values())
                        URL.revokeObjectURL(url);
                    sessionImageObjectUrlCache().clear();
                },
                { once: true },
            );
            const startupMenu = $("mainMenu");
            if (startupMenu) renderMainMenuLoading(startupMenu);
            await mainMenuPreloadPaintTick();
            const privateRuntimeTestStartup =
                globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true &&
                new URLSearchParams(location.search).get("runtimeTests") === "1";
            if (privateRuntimeTestStartup)
                await persistenceWorkerClient.ready;
            else
                await hydrateLargeStorageIntoApp();
            clearUnfinishedSetupSampleState();
            resetOrphanStateSyncProcessing();
            bind();
            refreshVoiceCache();
            window.speechSynthesis?.addEventListener?.(
                "voiceschanged",
                refreshVoiceCache,
            );
            setInterval(clearIdleVoiceState, 1000);
            startSceneProfileImageWatchdog();
            render();
            setStatus("Ready");
            app.ready = true;
            setTimeout(reportInterruptedDiagnosticExport, 0);
            setTimeout(reportInterruptedDevSmokeRun, 0);
            const handledAuthRedirect = handleSupabaseAuthRedirect();
            if (!handledAuthRedirect && supabaseSessionAccessToken())
                setTimeout(() => {
                    publicLibraryRefreshSessionIfNeeded()
                        .then(() => publicLibraryRefreshCurrentUser())
                        .catch((err) =>
                            log("Creator identity sync failed", err.message || String(err), {
                                type: "system",
                                level: "warn",
                            }),
                        );
                }, 0);
            setTimeout(() => notifyAdminPublicReportCount({ startup: true }), 0);
            setTimeout(() => cleanupAbandonedPublicUploads(), 0);
            if (await handleHostedShareUrlOnStartup()) return;
            continueStartupFlow();
            setTimeout(() => handleReportManagerReviewHashOnStartup(), 0);
        }

        async function handleHostedShareUrlOnStartup() {
            if (app.hostedShareUrlHandled) return false;
            const params = new URL(window.location.href).searchParams;
            const story = parseHostedShareParam(params.get("story"));
            const character = parseHostedShareParam(params.get("character"));
            const image = parseHostedShareParam(params.get("image"));
            if (!story && !character && !image) return false;
            app.hostedShareUrlHandled = true;
            try {
                if (story?.fileName) {
                    setStatus("Loading hosted story...");
                    const payload = await fetchCompressedJsonFromUpload(story.fileName);
                    await importStoryTemplatePayload(payload, {
                        title: "Hosted Story Imported",
                    });
                    setStatus("Ready");
                    return true;
                }
                if (character?.fileName) {
                    setStatus("Loading hosted character...");
                    const payload = await fetchCompressedJsonFromUpload(character.fileName);
                    const records = characterImportRecordsFromExport(payload);
                    await importCharacterRecords(records);
                    setStatus("Ready");
                    return true;
                }
                if (image?.fileName) {
                    const url = publicUploadFileUrl(image.fileName);
                    openModal(`
                        <h2>Hosted Image</h2>
                        <p class="hint">This hosted image can be copied or added to the current image list.</p>
                        <div class="image-render">${renderStoredImageHtml(url)}</div>
                        <label>Image URL <input id="hostedImageUrl" value="${escapeHtml(url)}" readonly></label>
                        <div class="row" style="margin-top:.8rem">
                            <button class="primary" type="button" onclick="EmberAdventures.importHostedImageUrl(document.getElementById('hostedImageUrl').value)">Add to Images</button>
                            <button type="button" onclick="navigator.clipboard?.writeText(document.getElementById('hostedImageUrl').value)">Copy URL</button>
                            <button type="button" onclick="EmberAdventures.closeModal()">Close</button>
                        </div>
                    `);
                    return true;
                }
            } catch (err) {
                setStatus("Ready");
                showNotice("Hosted Import Failed", err.message || String(err));
                return true;
            }
            return false;
        }

        function importHostedImageUrl(url) {
            const cleanUrl = String(url || "").trim();
            if (!/^https:\/\/user\.uploads\.dev\/file\//i.test(cleanUrl)) {
                showNotice("Image Import Failed", "Only user.uploads.dev image URLs can be imported here.");
                return;
            }
            rememberImage({
                title: "Hosted Image",
                reason: "hosted image import",
                model: "uploaded",
                seed: "hosted",
                prompt: "Hosted image import.",
                negativePrompt: "",
                html: cleanUrl,
                hosted_url: cleanUrl,
                hosted_at: new Date().toISOString(),
                hosted_size: 0,
            });
            renderImagePanel("show older images");
            showNotice("Image Imported", "The hosted image was added to the image column.");
        }

        function continueStartupFlow() {
            const blankReply = startupBlankAssistantMessage();
            if (blankReply) {
                if (startupBlankReplyRepairNeedsManualProvider()) {
                    removeStartupBlankAssistantMessage(
                        blankReply,
                        "Reply Repair Paused",
                        "The last AI reply was blank, but Local Codex is selected. Start the Local Codex text bridge, or launch the normal Perchance version, then continue play.",
                    );
                } else {
                    scheduleStartupBlankAssistantMessageRepair(blankReply);
                    return;
                }
            }
            if (devRunLiveTestScenario()) return;
            if (maybeShowWorldGenerationRecoveryNotice()) return;
            if (app.mainMenuOpen) return;
            {}

            resumePendingImageRequests();
            resumePendingProfileImageRequests();
            if (app.state.meta.setup_complete) ensureProfileImagesForAll("startup");
            if (
                app.state.meta.setup_complete &&
                pendingStateSyncMessages().length &&
                !markOpeningMessageSyncedIfStateAlreadyBuilt()
            )
                scheduleStartupStateSync(
                    app.stateSyncCheckpoint
                        ? "resuming saved state update"
                        : "startup catch-up",
                );
            if (!app.state.meta.setup_complete) renderMainMenu();
            else showPlayerInputHelpOnce();
        }



        function latestGameSave() {
            return saveIndexRecords()
                .slice()
                .sort((a, b) =>
                    new Date(b.updatedAt || b.createdAt || 0) -
                    new Date(a.updatedAt || a.createdAt || 0),
                )[0] || null;
        }

        function currentGameTitle() {
            return (
                app.state?.meta?.story_source?.title ||
                app.state?.meta?.title ||
                "Current Game"
            );
        }



        function mainMenuBackgroundAsset() {
            return MAIN_MENU_BACKGROUND_ASSET;
        }

