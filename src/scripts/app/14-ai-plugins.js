
        function perchancePluginPromptValue(prompt) {
            return {
                evaluateItem: String(prompt || ""),
            };
        }

        function buildImagePrompt(name, c, options = {}) {
            if (isUninspectedNpcPreviewEntity(c))
                return buildUninspectedNpcNormalImagePrompt(name, c);
            if (imageEntityIsAnimal(c))
                return buildAnimalImagePrompt(name, c, options);
            const includeSceneContext = options.includeSceneContext !== false;
            const descriptionOverride = cleanPromptText(options.descriptionOverride);
            const hasDescriptionOverride = !!descriptionOverride;
            const loc = includeSceneContext && !hasDescriptionOverride
                ? app.state.location || {}
                : {};
            const a = c.appearance || {};
            const image = c.image || {};
            const heldItems = hasDescriptionOverride
                ? {}
                : options.heldItemsOverride || c.held_items || {};
            const promptName = c.name || (name === "Player" ? profileDisplayName(name) : name);
            const promptContext = createImagePromptContext(c, {
                includesLowerBody: imagePromptIncludesLowerBody(c, image),
            });
            const promptClothing = projectClothingForImagePrompt(
                options.clothingOverride || imagePromptClothingForEntity(name, c),
                c,
                promptContext,
            );
            promptContext.chestCovered = hasUpperBodyCovering(promptClothing);
            const visibleClothing = joinVisibleClothing(promptClothing, { entity: c });
            const barefoot = isBarefoot(promptClothing);


            const includeSceneImageAction =
                includeSceneContext && !hasDescriptionOverride && imageTargetsCoverScene([name], app.state);
            const positiveParts = [
                `exactly one visible character: ${promptName}`,
                buildTraitPhrase(promptName, c, { includeName: false }),
                buildBodyStatPrompt(a, c, promptContext),
                a.extra_description,
                presentationOnlyExtraDescription(c),
                promptContext.includesLowerBody
                    ? a.extra_description_lower_body
                    : "",
                hasDescriptionOverride ? "" : c.state_of_mind,
                hasDescriptionOverride ? "" : c.physical_state,
                buildImageTypePhrase(image, c, loc, {
                    descriptionOnly: hasDescriptionOverride,
                    includePose: !hasDescriptionOverride,
                    includeExpression: !hasDescriptionOverride,
                    backgroundOverride: options.backgroundOverride,
                    suppressBackground: hasDescriptionOverride && !cleanPromptText(options.backgroundOverride),
                }),
                hasDescriptionOverride
                    ? `additional appearance and outfit details: ${descriptionOverride}`
                    : "",
            ];

            if (barefoot) positiveParts.push("barefoot");

            if (visibleClothing) {
                positiveParts.push(`wearing ${visibleClothing}`);
            }

            const heldItemPhrase = joinHeldItems(heldItems);
            if (heldItemPhrase) {
                positiveParts.push(heldItemPhrase);
            }

            if (includeSceneImageAction)
                positiveParts.push(cleanImageAction(app.state.scene?.image_action));

            return joinPromptParts(positiveParts);
        }

        function imageEntityIsAnimal(entity = {}) {
            return entity?.definition_type === "animal" || (
                isPlainObject(entity) &&
                Object.prototype.hasOwnProperty.call(entity, "physical_description") &&
                !Object.prototype.hasOwnProperty.call(entity, "appearance")
            );
        }

        function buildAnimalImagePrompt(name, entity = {}, options = {}) {
            const promptName = cleanPromptText(entity.name || profileDisplayName(name) || name);
            const includeSceneContext = options.includeSceneContext !== false;
            const descriptionOverride = cleanPromptText(options.descriptionOverride);
            const hasDescriptionOverride = !!descriptionOverride;
            const explicitBackground = cleanPromptText(options.backgroundOverride);
            const background = explicitBackground || (!includeSceneContext || hasDescriptionOverride
                ? ""
                : imagePromptLocation({}, app.state.location || {}));
            const pose = hasDescriptionOverride
                ? ""
                : aiPoseMentionsOtherSceneCharacter(name, entity.pose, app.state)
                ? ""
                : entity.pose;
            return joinPromptParts([
                `exactly one animal character: ${promptName}`,
                cleanPromptText(entity.species),
                cleanPromptText(entity.physical_description),
                hasDescriptionOverride ? "" : cleanPromptText(entity.state_of_mind),
                hasDescriptionOverride ? "" : cleanPromptText(entity.physical_state),
                cleanPromptText(pose),
                background,
                hasDescriptionOverride
                    ? `additional appearance details: ${descriptionOverride}`
                    : "",
                "one continuous illustration, one camera view, no humanoid anatomy, no clothing",
            ]);
        }

        function imagePromptIncludesLowerBody(entity = {}, image = {}) {
            const view = cleanPromptText(image?.view).toLowerCase();
            if (!view) return true;
            return ![
                "headshot",
                "head",
                "face",
                "bust",
                "upper body",
                "upper-body",
                "waist up",
                "waist-up",
            ].includes(view);
        }

        function buildUninspectedNpcNormalImagePrompt(name, npc = {}) {
            const loc = app.state.location || {};
            return joinPromptParts([
                cleanPromptText(npc.name || profileDisplayName(name) || name),
                cleanPromptText(npc.gender),
                cleanPromptText(npc.role || "local NPC"),
                cleanPromptText(npc.note),
                cleanPromptText(npc.current_appearance),
                imagePromptLocation({}, loc),
                "use only visible known details",
                "do not reveal hidden character details",
                "assume ordinary scene-appropriate clothing when clothing is unknown",
                "do not infer nudity from missing clothing data",
                "exactly one visible character",
                defaultFantasyRpgImageStyleBlock("character"),
            ]);
        }

        function cleanImageAction(value) {
            const text = cleanPromptText(value);
            if (!text) return "";
            const action = text
                .split(/[,.!?;:]+/)[0]
                .trim()
                .split(/\s+/)
                .slice(0, 8)
                .join(" ")
                .replace(/\b(?:in|on|at|to|with|from|of|for|the|a|an)\s*$/i, "")
                .trim();
            return action || text.split(/\s+/).slice(0, 5).join(" ");
        }

        function buildTraitPhrase(name, character, options = {}) {
            const a = character.appearance || {};
            const skinColor = cleanPromptText(a.skin_color);
            const raceAndGender = imageSpeciesAgeGenderPhrase(character);

            return joinPromptParts([
                options.includeName === false ? "" : name,
                raceAndGender,
                appendPromptNoun(skinColor, "skin"),
                appendPromptNoun(a.eye_color, "eyes"),
                buildHairPhrase(a),
            ]);
        }

        function presentationOnlyExtraDescription(character = {}) {
            const appearance = character?.appearance || {};
            const field = characterPresentationUsesMaleFields(character?.gender)
                ? "male_only_extra_description"
                : "non_male_only_extra_description";
            return cleanPromptText(appearance[field]);
        }





        function buildHairPhrase(appearance) {
            if (
                !cleanPromptText(appearance.hair_length) &&
                !cleanPromptText(appearance.hair_type) &&
                !cleanPromptText(appearance.hair_color)
            )
                return "";
            const text = joinWords([
                appearance.hair_length,
                appearance.hair_type,
                appearance.hair_color,
            ]);
            return appendPromptNoun(text, "hair");
        }

        function appendPromptNoun(value, noun) {
            const text = cleanPromptText(value).replace(/[.!?]+$/, "").trim();
            if (!text) return "";
            const nounText = cleanPromptText(noun);
            if (!nounText) return text;
            const escaped = nounText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`\\b${escaped}\\b`, "i").test(text)
                ? text
                : `${text} ${nounText}`;
        }

        function imagePromptLocation(image = {}, location = {}) {
            return cleanPromptText(
                image.background ||
                    location.specific_place ||
                    location.district ||
                    location.settlement_name,
            );
        }

        function buildImageTypePhrase(image, character, loc, options = {}) {
            const explicitBackground = cleanPromptText(options.backgroundOverride);
            const background =
                explicitBackground ||
                (options.suppressBackground
                    ? ""
                    : imagePromptLocation(image, loc) ||
                      (imageEntityIsAnimal(character)
                          ? ""
                          : cleanPromptText(character?.default_image_background)));
            const pose = aiPoseMentionsOtherSceneCharacter(
                character?.name || "",
                character?.pose,
                app.state,
            )
                ? ""
                : character?.pose;
            const styleBlock = useFantasyRpgLocalImageStyle()
                ? defaultFantasyRpgImageStyleBlock("character")
                : "";
            return joinPromptParts([
                options.descriptionOnly
                    ? "single character full-body illustration"
                    : image.image_type || "single character portrait",
                options.descriptionOnly
                    ? "full body view"
                    : image.view
                      ? `${image.view} view`
                      : "full body view",
                options.includePose === false ? "" : pose,
                options.includeExpression === false ? "" : image.expression,
                background,
                styleBlock,
            ]);
        }

        const maleChestPhrases = EmberAppearanceScales.maleChest;

        const femaleChestPhrases = EmberAppearanceScales.femaleChest;

        function buildBodyStatPrompt(appearance, entity = null, promptContext = {}) {
            return bodyStatKeys()
                .filter(
                    (slot) =>
                        !(appearance?.nonhuman_lower_body === true && ["hip_width", "butt_build", "lower_body_build", "leg_length"].includes(slot)),
                )
                .map((slot) =>
                    bodyStatPhrase(slot, appearance?.[slot], {
                        useDefault: Object.hasOwn(bodyStatPhrases, slot),
                        entity,
                        promptContext,
                    }),
                )
                .filter(Boolean)
                .join(", ");
        }

        function bodyStatPhrase(slot, value, options = {}) {
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed) return "";

                const numeric = Number(trimmed);
                if (!Number.isFinite(numeric)) return displayRuntimeTemplateText(trimmed, options.entity);

                return bodyStatPhraseFromNumber(
                    slot,
                    numeric,
                    options.entity,
                    options.promptContext,
                );
            }

            if (typeof value === "number" && Number.isFinite(value)) {
                return bodyStatPhraseFromNumber(
                    slot,
                    value,
                    options.entity,
                    options.promptContext,
                );
            }

            if (!options.useDefault) return "";
            const defaultValue = BODY_STAT_DEFAULTS[slot];
            if (defaultValue == null) return "";
            return bodyStatPhraseFromNumber(
                slot,
                defaultValue,
                options.entity,
                options.promptContext,
            );
        }

        function bodyStatPhraseFromNumber(
            slot,
            value,
            entity = null,
            promptContext = {},
        ) {
            if (slot === "chest")
                return chestStatPhraseFromNumber(value, entity, promptContext);
            const phrases = bodyStatPhrases[slot];
            if (!phrases) return "";

            const index = Math.max(0, Math.min(20, Math.round(value)));
            return phrases[index] || "";
        }

        function chestStatPhraseFromNumber(value, entity = null, promptContext = {}) {
            const index = Math.max(0, Math.min(20, Math.round(Number(value) || 0)));
            if (normalizedCharacterGender(entity?.gender) === "male")
                return maleChestPhrases[index] || "";
            const phrase = femaleChestPhrases[index] || "";
            return promptContext.chestCovered === true && phrase
                ? `${phrase}, fully covered, with their size and shape visible beneath the described clothing`
                : phrase;
        }

        function isEmptyClothingValue(value) {
            if (value == null) return true;
            return !String(value).trim();
        }



        function genderNoun(gender, species) {
            const genderValue = cleanPromptText(gender).toLowerCase();
            const speciesValue = cleanPromptText(species).toLowerCase();
            if (
                genderValue &&
                genderValue === speciesValue
            )
                return cleanPromptText(species);
            if (speciesValue === "human") {
                if (genderValue === "female") return "woman";
                if (genderValue === "male") return "man";
                if (!genderValue || genderValue === "unspecified") return "person";
            }

            return joinWords([gender, species]);
        }

        const IMAGE_PROMPT_CLOTHING_SLOT_ORDER = [
            "hat",
            "hair_accessory",
            "face",
            "ears",
            "neck",
            "shoulders",
            "undershirt",
            "shirt",
            "over_shirt",
            "coat",
            "bra",
            "back",
            "hands",
            "right_wrist",
            "left_wrist",
            "right_fingers",
            "left_fingers",
            "waist",
            "belt_accessory",
            "pants",
            "skirt",
            "legwear",
            "underwear",
            "socks",
            "feet",
            "other_accessory",
        ];

        const PROFILE_IMAGE_CLOTHING_SLOTS = new Set([
            "hat",
            "hair_accessory",
            "face",
            "ears",
            "neck",
            "shoulders",
            "undershirt",
            "shirt",
            "over_shirt",
            "coat",
            "bra",
            "back",
            "hands",
            "right_wrist",
            "left_wrist",
            "right_fingers",
            "left_fingers",
            "waist",
            "belt_accessory",
            "pants",
            "skirt",
            "legwear",
            "underwear",
        ]);

        function createImagePromptContext(entity = {}, options = {}) {
            return {
                entity,
                profile: options.profile === true,
                group: options.group === true,
                includesLowerBody: options.includesLowerBody !== false,
                nonhumanLowerBody: entity?.appearance?.nonhuman_lower_body === true,
                effectiveClothing: null,
                effectiveImageModel: textSlot(options.model, ""),
                location: options.location || app.state?.location || null,
                chestCovered: options.chestCovered === true,
            };
        }

        function imagePromptClothingForEntity(name, entity = {}) {
            return isPlainObject(entity.clothing)
                ? exactClothingSlots(entity.clothing)
                : profilePromptClothingForEntity(entity);
        }

        function projectClothingForImagePrompt(clothing, entity = {}, promptContext = {}) {
            const projected = exactClothingSlots(clothing || {});
            const gender = normalizedCharacterGender(entity.gender);

            if (gender === "male")
                projected.bra = null;

            if (!hasUpperBodyCovering(projected))
                projected.undershirt = "opaque full-coverage shirt";

            if (entity.appearance?.nonhuman_lower_body !== true && !hasLowerBodyCovering(projected))
                projected.pants = "opaque full-length trousers";

            promptContext.effectiveClothing = projected;
            promptContext.chestCovered = hasUpperBodyCovering(projected);
            return projected;
        }

        function clothingSlotHasValue(clothing, slot) {
            return !isEmptyClothingValue(clothing?.[slot]);
        }

        function hasUpperBodyCovering(clothing) {
            return ["bra", "undershirt", "shirt", "over_shirt", "coat"].some(
                (slot) => clothingSlotHasValue(clothing, slot),
            );
        }

        function hasLowerBodyCovering(clothing) {
            return ["underwear", "pants", "skirt", "legwear"].some((slot) =>
                clothingSlotHasValue(clothing, slot),
            );
        }

        function coveredBraSlotImageText(value = "") {
            return String(value || "")
                .replace(
                    /\b(?:(?:sports?|push[- ]?up|strapless|lace|sheer|cupless|lingerie)\s+)?(?:bra|brassiere|bralette|pasties|bodice|corset)\b/gi,
                    "undergarment",
                )
                .replace(/\s+/g, " ")
                .trim();
        }

        function coveredUnderwearSlotImageText(value = "") {
            return String(value || "")
                .replace(
                    /\b(?:(?:men(?:'|’)?s|male|athletic|pouch|compression)\s+)?(?:boxer-briefs|boxers|boxer|briefs|underwear|underpants|jockstrap|supporter)(?:\s+(?:briefs|shorts))?\b/gi,
                    "undergarments",
                )
                .replace(/\s+/g, " ")
                .trim();
        }

        function joinVisibleClothing(clothing, options = {}) {
            const visible = [];
            const malePresentation = normalizedCharacterGender(options.entity?.gender) === "male";
            const allowedSlots = options.profile
                ? PROFILE_IMAGE_CLOTHING_SLOTS
                : new Set(IMAGE_PROMPT_CLOTHING_SLOT_ORDER);
            const handled = new Set();
            for (const [rightSlot, leftSlot, location] of [
                ["right_wrist", "left_wrist", "wrists"],
                ["right_fingers", "left_fingers", "hands"],
            ]) {
                if (!allowedSlots.has(rightSlot) || !allowedSlots.has(leftSlot)) continue;
                const right = cleanPromptText(clothingItemText(clothing?.[rightSlot]));
                const left = cleanPromptText(clothingItemText(clothing?.[leftSlot]));
                if (right && left && right === left) {
                    visible.push(`matching ${right} on both ${location}`);
                    handled.add(rightSlot);
                    handled.add(leftSlot);
                }
            }
            for (const slot of IMAGE_PROMPT_CLOTHING_SLOT_ORDER) {
                if (!allowedSlots.has(slot) || handled.has(slot)) continue;
                const value = cleanPromptText(clothingItemText(clothing?.[slot]));
                if (!value) continue;
                const sideLabel = {
                    right_wrist: "right wrist",
                    left_wrist: "left wrist",
                    right_fingers: "right hand fingers",
                    left_fingers: "left hand fingers",
                }[slot];
                const isUnderneath =
                    (slot === "bra" && ["undershirt", "shirt", "over_shirt", "coat"].some(
                        (coveringSlot) => clothingSlotHasValue(clothing, coveringSlot),
                    )) ||
                    (slot === "underwear" && ["pants", "skirt", "legwear"].some(
                        (coveringSlot) => clothingSlotHasValue(clothing, coveringSlot),
                    ));
                const promptValue = slot === "bra" && isUnderneath
                    ? coveredBraSlotImageText(value)
                    : slot === "underwear" && isUnderneath && malePresentation
                      ? coveredUnderwearSlotImageText(value)
                      : value;
                visible.push(
                    sideLabel
                        ? `${sideLabel}: ${promptValue}`
                        : isUnderneath
                          ? `with ${promptValue} underneath`
                          : promptValue,
                );
            }
            return joinPromptPartsExact(visible);
        }







        function hasLegCovering(clothing) {
            return ["pants", "skirt", "legwear"].some((slot) =>
                clothingSlotHasValue(clothing, slot),
            );
        }

        function hasMinimalLowerCovering(clothing) {
            return clothingSlotHasValue(clothing, "underwear");
        }

        function isBarefoot(clothing) {
            return ["feet", "socks"].every(
                (slot) => !clothingSlotHasValue(clothing, slot),
            );
        }

        function joinHeldItems(heldItems) {
            return joinPromptParts(
                Object.entries(heldItems || {}).map(([slot, value]) => {
                    const item = cleanPromptText(value);
                    if (!item) return "";

                    return `${slot.replace(/_/g, " ")} holding ${item}`;
                }),
            );
        }

        function buildBaseImageNegativePrompt(options = {}) {
            const includeTurnaroundNegatives =
                options.includeTurnaroundNegatives !== false;
            return joinPromptPartsExact([
                "text",
                "letters",
                "words",
                "watermark",
                "logo",
                "signature",
                "caption",
                "speech bubble",
                "collage",
                "split screen",
                "inset image",
                "multiple camera views",
                includeTurnaroundNegatives
                    ? "turnaround"
                    : "",
                includeTurnaroundNegatives
                    ? "character sheet"
                    : "",
                includeTurnaroundNegatives
                    ? "front and back comparison"
                    : "",
                includeTurnaroundNegatives
                    ? "simultaneous front and rear views"
                    : "",
                "duplicate subject",
                "duplicate face",
                "duplicate character",
                "reflection",
                "malformed hands",
                "malformed fingers",
                "fused fingers",
                "extra fingers",
                "missing fingers",
                "blurry",
                "low quality",
            ]);
        }

        function buildNegativeImagePrompt(character, options = {}) {
            return buildClothedImageNegativePrompt({ ...options, includeTurnaroundNegatives: false });
        }

        function buildGroupImageNegativePrompt(entities = [], options = {}) {
            const count = entities.length;
            return joinPromptParts([
                buildClothedImageNegativePrompt({ ...options, includeTurnaroundNegatives: count !== 1 && options.includeTurnaroundNegatives !== false }),
                count > 1 ? "extra people, unnamed person, background bystander, duplicate character, duplicate body" : "",
                count === 2 ? "third person, fourth person, crowd" : "",
                count === 3 ? "fourth person, fifth person, crowd" : "",
            ]);
        }





        function buildClothedImageNegativePrompt(options = {}) {
            return joinPromptParts([
                buildBaseImageNegativePrompt(options),
                "nude",
                "naked",
                "topless",
                "bottomless",
                "exposed breasts",
                "exposed nipples",
                "exposed genitals",
                "visible genitals",
                "explicit sex",
                "penetration",
                "oral sex",
                "cum",
                "semen",
            ]);
        }

        function joinPromptParts(parts) {
            return parts.map(cleanPromptText).filter(Boolean).join(", ");
        }

        function joinPromptPartsExact(parts) {
            const seen = new Set();
            const clean = [];
            for (const value of parts || []) {
                const text = cleanPromptText(value);
                if (!text) continue;
                const key = text.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                clean.push(text);
            }
            return clean.join(", ");
        }

        function joinWords(parts) {
            return parts.map(cleanPromptText).filter(Boolean).join(" ");
        }

        function cleanPromptText(value) {
            if (value == null || value === false) return "";
            if (typeof value === "number") return String(value);
            if (typeof value !== "string") return "";

            return value.trim().replace(/\s+/g, " ");
        }

        function openImageLabModal(sourceImage = null) {
            const asPopup = !!sourceImage?.popup;
            app.imageLabStoryTitleCardTarget = String(sourceImage?.storyTitleCardTarget || "");
            if (!app.settings.imageLabWarningAccepted) {
                const warningHtml = `
                    <h2>Image Lab Notice</h2>
                    <p class="hint">Image Lab sends the prompt you write. Keep descriptions and images suitable for a general audience.</p>
                    <div class="row" style="margin-top: .8rem">
                        <button class="primary" id="acceptImageLabWarningBtn">I Understand</button>
                    </div>
                `;
                const warningPopup = asPopup ? openPopupModal(warningHtml) : null;
                if (!asPopup) openModal(warningHtml);
                if (warningPopup) warningPopup.box.setAttribute("data-image-lab-popup", "1");
                $("acceptImageLabWarningBtn").onclick = () => {
                    app.settings.imageLabWarningAccepted = true;
                    scheduleActiveGameSave();
                    if (warningPopup) warningPopup.close();
                    openImageLabModal(sourceImage);
                };
                return;
            }

            const sourceTargets = Array.isArray(sourceImage?.targets)
                ? sourceImage.targets.map(String).filter(Boolean)
                : [];
            const targets = [
                "",
                "Player",
                ...Object.keys(app.state.characters || {}),
                ...sourceTargets,
            ].filter((name, index, list) => list.indexOf(name) === index);
            const sourceTarget = sourceTargets[0] || "";
            const selectedSourceTarget = sourceTarget
                ? targets.find(
                      (name) =>
                          name === sourceTarget && imageEntity(name),
                  ) ||
                  targets.find(
                      (name) =>
                          imageEntity(name) &&
                          normalizeNameForMatch(profileDisplayName(name)) ===
                          normalizeNameForMatch(sourceTarget),
                  ) ||
                  ""
                : "";
            const selected = selectedSourceTarget ||
                (sourceImage ? "" : imageTargetNames()[0] || "");
            const options = targets
                .map((name) => {
                    const label = name || "None";
                    return `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
                })
                .join("");
            const portraitMode = !!sourceImage?.profile;
            const entity = imageEntity(selected);
            const selectedModel = portraitMode && entity
                ? resolvedProfileImageModel(entity, { model: sourceImage?.model })
                : selectedImageModel(sourceImage?.model);
            const modelOptions = imageModelOptions()
                .map(
                    (model) =>
                        `<option value="${escapeHtml(model.value)}" ${model.value === selectedModel ? "selected" : ""}>${escapeHtml(model.label)}</option>`,
                )
                .join("");
            const prompt =
                sourceImage?.prompt ||
                (entity
                    ? portraitMode
                        ? buildProfileImagePrompt(selected, entity)
                        : buildImagePrompt(selected, entity)
                    : "");
            const negative =
                sourceImage?.negativePrompt ||
                sourceImage?.negative_prompt ||
                (entity
                    ? portraitMode
                        ? buildProfileNegativePrompt(entity)
                        : buildNegativeImagePrompt(entity)
                    : buildBaseImageNegativePrompt());
            const storyTitleCardTemplate = sourceImage?.storyTitleCardTarget
                ? storyTemplateById(sourceImage.storyTitleCardTarget)
                : null;
            const seedValue =
                sourceImage?.seed != null && sourceImage.seed !== "random"
                    ? sourceImage.seed
                    : entity?.image?.seed ?? Math.floor(Math.random() * 999999999);
            const seedEnabled =
                sourceImage?.seed != null && sourceImage.seed !== "random"
                    ? true
                    : !!entity?.image?.seed_enabled;

            const labHtml = `
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Image Lab</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeImageLabSurface()">X</button>
                </div>
                <p class="hint">Freeform prompt testing. With Art style set to None, the generator receives exactly the positive prompt text.</p>
                <div class="exact-send-notice">
                    Character selection only loads a starting prompt into the box. Choosing an Art style wraps the positive prompt before sending.
                </div>
                <div class="grid2">
                    <label>
                        Load character prompt
                        <select id="labCharacter">${options}</select>
                    </label>
                    <label class="check-row">
                        <input id="labPortraitMode" type="checkbox" ${portraitMode ? "checked" : ""}>
                        <span>Portrait prompt</span>
                    </label>
                    <label>
                        Art style
                        <select id="labImageModel">${modelOptions}</select>
                    </label>
                    <label>
                        Use fixed seed
                        <input id="labSeedEnabled" type="checkbox">
                    </label>
                    <label>
                        Seed
                        <input id="labSeed" type="number" value="${escapeHtml(seedValue)}">
                    </label>
                </div>
                <label style="margin-top: .75rem">
                    Positive prompt
                    <textarea id="labPrompt" rows="10">${escapeHtml(prompt)}</textarea>
                </label>
                <label style="margin-top: .75rem">
                    Negative prompt (optional)
                    <textarea id="labNegative" rows="5">${escapeHtml(negative)}</textarea>
                </label>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" id="labGenerateBtn">Generate exactly as written</button>
                    <button id="labRandomSeedBtn">Random Seed</button>
                    <button id="labCopyPromptBtn">Copy Prompt</button>
                </div>
            `;
            const labPopup = asPopup ? openPopupModal(labHtml) : null;
            if (!asPopup) openModal(labHtml);
            if (labPopup) labPopup.box.setAttribute("data-image-lab-popup", "1");

            $("labSeedEnabled").parentElement.classList.add("check-row");
            $("labSeedEnabled").checked = seedEnabled;
            $("labSeed").value = seedValue;
            const loadLabCharacterPrompt = () => {
                const name = $("labCharacter").value;
                const target = imageEntity(name);
                const portrait = $("labPortraitMode").checked;
                $("labPrompt").value = target
                    ? portrait
                        ? buildProfileImagePrompt(name, target)
                        : buildImagePrompt(name, target)
                    : "";
                $("labNegative").value = target
                    ? portrait
                        ? buildProfileNegativePrompt(target)
                        : buildNegativeImagePrompt(target)
                    : buildBaseImageNegativePrompt();
                $("labSeedEnabled").checked = !!target?.image?.seed_enabled;
                $("labSeed").value =
                    target?.image?.seed ?? Math.floor(Math.random() * 999999999);
                if (target && $("labImageModel"))
                    $("labImageModel").value = portrait
                        ? resolvedProfileImageModel(target)
                        : selectedImageModel(target?.image?.model || app.settings.imageModel);
            };
            $("labCharacter").onchange = loadLabCharacterPrompt;
            $("labPortraitMode").onchange = loadLabCharacterPrompt;
            $("labGenerateBtn").dataset.uiAction = "generateImageLabFreeform";
            $("labGenerateBtn").onclick = () =>
                window.EmberAdventures.generateImageLabFreeform();
            $("labRandomSeedBtn").onclick = () => {
                $("labSeed").value = Math.floor(Math.random() * 999999999);
                $("labSeedEnabled").checked = true;
            };
            $("labCopyPromptBtn").onclick = () =>
                navigator.clipboard?.writeText($("labPrompt").value);
        }

        async function generateImageLabFreeform() {
            const prompt = $("labPrompt").value;
            const negativePrompt = $("labNegative").value;
            const imageModel = selectedImageModel($("labImageModel").value);
            const portraitMode = $("labPortraitMode").checked;
            const selectedCharacter = $("labCharacter")?.value || "";
            const seed = $("labSeedEnabled").checked
                ? parseProfileImageSeedInput($("labSeed").value, 0, "image lab seed")
                : undefined;
            const storyTitleCardTarget = app.imageLabStoryTitleCardTarget || "";
            closeImageLabSurface();
            const styled = applyImageArtStyle(prompt, negativePrompt, imageModel);
            if (storyTitleCardTarget) {
                await generateStoryTemplateTitleCardImage(storyTitleCardTarget, {
                    prompt: styled.prompt,
                    seed: exactProfileImageSeed(seed, "image lab story title seed"),
                });
                return;
            }
            if (portraitMode) {
                if (!selectedCharacter || !profileEntity(selectedCharacter)) {
                    showNotice(
                        "Profile Image Target Missing",
                        "Select a character before generating a profile image.",
                    );
                    return;
                }
                await generateProfileImage(selectedCharacter, {
                    manual: true,
                    source: "image lab",
                    reason: "image lab",
                    model: imageModel,
                    seed,
                    prompt: styled.prompt,
                    negativePrompt: styled.negativePrompt,
                    exactPrompt: true,
                });
                return;
            }
            await generateFreeformImage(
                styled.prompt,
                styled.negativePrompt,
                seed,
                "image lab",
                imageModel,
                {
                    profile: portraitMode,
                    targets: selectedCharacter ? [selectedCharacter] : [],
                },
            );
        }

        async function generateFreeformImage(
            prompt,
            negativePrompt,
            seed,
            reason,
            imageModel = app.settings.imageModel,
            options = {},
        ) {
            const model = selectedImageModel(imageModel);
            const imageId = Date.now() + Math.random();
            const targetEntity = Array.isArray(options.targets) && options.targets.length
                ? imageEntity(options.targets[0])
                : null;

            const safePrompt = sanitizeImagePromptForMode(prompt);
            const record = createNormalImageRequest({
                id: imageId,
                title: "Image Lab",
                reason,
                model,
                seed: seed ?? "random",
                prompt: safePrompt,
                negativePrompt,
                html: options.profile
                    ? imageLoadingHtml("")
                    : imageLoadingHtml("Image generation in progress"),
                pending: true,
                targets: Array.isArray(options.targets)
                    ? options.targets
                    : [],
                promptType: options.promptType || "image lab freeform image",
            });
            log(
                "Image prompt before send",
                `Reason: ${reason}\nStyle: ${imageModelLabel(model)}\nSeed: ${seed ?? "random"}\nNegative: ${negativePrompt || "(none)"}\n\n${safePrompt}`,
                { type: "image", level: "message" },
            );
            renderImagePanel();
        }
        function createStreamingVoiceSession(messageId, speaker) {
            const character = voiceCharacterForSpeaker(speaker);
            let buffer = "";
            let pausedForMetadata = false;
            let started = false;
            let visibleCursor = 0;

            return {
                push(delta, fullText = "", done = false) {
                    if (app.stoppedVoiceMessageIds.has(String(messageId)))
                        return;
                    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance)
                        return;
                    if (!started) {
                        started = true;
                        app.streamedVoiceReplyIds.add(messageId);
                        app.voiceMetadataPendingMessageIds.add(String(messageId));
                    }

                    buffer += String(delta || "");
                    const segments = takeSpeakableSegments(buffer, done);
                    buffer = segments.remainder;

                    const parts = applyMessageVoiceSpeakerFallback(
                        rebaseStreamedVoiceParts(
                            splitVoiceParts(segments.text),
                            segments.text,
                            fullText,
                            (nextCursor) => {
                                visibleCursor = nextCursor;
                            },
                            visibleCursor,
                        ),
                        messageId,
                    );
                    if (pausedForMetadata) {
                        appendPendingVoiceDialogueParts(messageId, parts, character);
                    } else {
                        for (const [index, part] of parts.entries()) {
                            if (
                                app.voiceMetadataPendingMessageIds.has(String(messageId)) &&
                                voicePartNeedsMetadataVoiceGate(part, character)
                            ) {
                                // Streamed speech may start for narration and known voices,
                                // but it must pause at a new/unknown quoted speaker until
                                // the speaker/NPC check can assign a voice or fallback.
                                pausedForMetadata = true;
                                appendPendingVoiceDialogueParts(
                                    messageId,
                                    parts.slice(index),
                                    character,
                                );
                                break;
                            }
                            queueVoicePart(part, character, messageId, {
                                source: done ? "stream final" : "stream immediate",
                            });
                        }
                    }

                    if (done) {
                        if (buffer.trim()) {
                            const finalParts = applyMessageVoiceSpeakerFallback(
                                rebaseStreamedVoiceParts(
                                    splitVoiceParts(buffer),
                                    buffer,
                                    fullText,
                                    (nextCursor) => {
                                        visibleCursor = nextCursor;
                                    },
                                    visibleCursor,
                                ),
                                messageId,
                            );
                            if (pausedForMetadata)
                                appendPendingVoiceDialogueParts(
                                    messageId,
                                    finalParts,
                                    character,
                                );
                            else {
                                for (const [index, part] of finalParts.entries()) {
                                    if (
                                        app.voiceMetadataPendingMessageIds.has(String(messageId)) &&
                                        voicePartNeedsMetadataVoiceGate(part, character)
                                    ) {
                                        pausedForMetadata = true;
                                        appendPendingVoiceDialogueParts(
                                            messageId,
                                            finalParts.slice(index),
                                            character,
                                        );
                                        break;
                                    }
                                    queueVoicePart(part, character, messageId, {
                                        source: "stream final buffer",
                                    });
                                }
                            }
                        }
                        buffer = "";
                    }
                },
            };
        }

        function rebaseStreamedVoiceParts(parts = [], rawSegment = "", fullText = "", setCursor = null, cursor = 0) {
            // Streaming splits a reply into chunks before the final full message is
            // known. Each chunk's local voice ranges start at 0, so rebase them onto
            // the current visible message or later chunks will highlight earlier text.
            const visibleSegment = assistantVisibleMessageText(rawSegment);
            const full = String(fullText || "");
            const startSearch = Math.max(0, Number(cursor) || 0);
            let base = full.indexOf(visibleSegment, startSearch);
            if (base < 0) {
                const trimmed = visibleSegment.trim();
                const trimmedIndex = trimmed ? full.indexOf(trimmed, startSearch) : -1;
                if (trimmedIndex >= 0) {
                    const leading = visibleSegment.search(/\S/);
                    base = trimmedIndex - Math.max(0, leading);
                }
            }
            if (base < 0) base = startSearch;
            const rebased = parts.map((part) => {
                const start = Number(part.start);
                const end = Number(part.end);
                if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
                    return part;
                return {
                    ...part,
                    start: base + start,
                    end: base + end,
                };
            });
            if (typeof setCursor === "function")
                setCursor(Math.max(startSearch, base + visibleSegment.length));
            return rebased;
        }

        function takeSpeakableSegments(text, force = false) {
            const value = String(text || "");
            if (!value) return { text: "", remainder: "" };
            if (force) return { text: value, remainder: "" };

            const safeEnd = findSafeSpeechBoundary(value);
            if (!safeEnd) return { text: "", remainder: value };
            if (safeEnd < 36 && value.length < 90) {
                return { text: "", remainder: value };
            }

            return {
                text: value.slice(0, safeEnd),
                remainder: value.slice(safeEnd),
            };
        }
        function findSafeSpeechBoundary(value) {
            const boundary = /[.!?](?:\s+|$)|\n+/g;
            let match;
            let best = 0;

            while ((match = boundary.exec(value))) {
                const end = match.index + match[0].length;
                if (hasBalancedQuotes(value.slice(0, end))) best = end;
            }

            return best;
        }

        function hasBalancedQuotes(text) {
            const quotes = String(text || "").match(/"/g);
            return !quotes || quotes.length % 2 === 0;
        }

        function queueVoicePart(part, character, messageId = null, opts = {}) {
            if (
                messageId != null &&
                app.stoppedVoiceMessageIds.has(String(messageId))
            )
                return;
            if (
                messageId != null &&
                app.pendingVoiceDialogueParts.has(String(messageId)) &&
                !opts.allowAfterMetadataGate
            ) {
                // Once an unresolved quote is held for metadata, every later part of
                // that same message must wait behind it. Otherwise another read path
                // can enqueue narration after the quote and make speech continue out
                // of order while the quote itself is still unresolved.
                appendPendingVoiceDialogueParts(messageId, [part], character);
                return;
            }
            const voiceTarget = voiceTargetForPart(part, character);
            const useCharacter = voiceTarget.useCharacter;
            const spokenText = cleanSpeechText(part.text, {
                preserveInlineVoiceTags: !!opts.preserveInlineVoiceTags,
                stripWrappingQuotes: !!opts.stripWrappingQuotes,
            });
            if (!spokenText) return;
            let messageRange = null;
            if (
                Number.isFinite(Number(part.start)) &&
                Number.isFinite(Number(part.end)) &&
                Number(part.end) > Number(part.start)
            ) {
                messageRange = {
                    start: Number(part.start),
                    length: Number(part.end) - Number(part.start),
                };
            } else if (messageId != null) {
                const offset = findVoicePartOffset(messageId, part.text, spokenText);
                if (offset != null && Number.isFinite(Number(offset)))
                    messageRange = {
                        start: Number(offset),
                        length: spokenText.length,
                    };
            }
            logVoiceReadSegment({
                messageId,
                part,
                spokenText,
                voiceTarget,
                messageRange,
                source: opts.source || "queueVoicePart",
            });
            speakText(
                spokenText,
                voiceTarget.slot,
                {
                    rate: useCharacter ? 0.96 : 0.9,
                    pitch:
                        useCharacter && voiceTarget.gender === "male"
                            ? 0.88
                            : useCharacter && voiceTarget.gender === "female"
                              ? 1.08
                              : 0.98,
                    append: opts.append ?? true,
                    auto: opts.auto,
                    messageRange,
                    messageId,
                    voiceCharacter: voiceTarget.character || null,
                    voiceCharacterName: part.speaker || "",
                    voiceGender: voiceTarget.gender,
                },
            );
        }

        function voiceTargetForPart(part, fallbackCharacter = null) {
            // Dialogue and parenthetical-speaker narration can target character
            // voices. If extraction fails to assign a specific voice, use the
            // speaker's gender default; if gender is also unknown, fall back to
            // the narrator voice.
            const partSpeaker = String(part?.speaker || "").trim();
            const partCharacter =
                partSpeaker
                    ? voiceCharacterForSpeaker(partSpeaker, fallbackCharacter)
                    : null;
            const gender = normalizedCharacterGender(partCharacter?.gender);
            if (!partCharacter) {
                return {
                    useCharacter: false,
                    slot: "Narrator",
                    gender: "neutral",
                    character: null,
                };
            }
            const characterVoice = playbackVoiceForCharacter(partCharacter, partSpeaker);
            if (characterVoice) {
                return {
                    useCharacter: true,
                    slot: characterVoice,
                    gender,
                    character: partCharacter,
                };
            }
            const genderVoice = defaultVoiceForKnownSpeakerGender(gender);
            if (genderVoice) {
                return {
                    useCharacter: true,
                    slot: genderVoice,
                    gender,
                    character: partCharacter,
                };
            }
            return {
                useCharacter: false,
                slot: "Narrator",
                gender: "neutral",
                character: partCharacter,
            };
        }

        function findVoicePartOffset(messageId, rawText = "", spokenText = "") {
            const message = findEntryById(messageId);
            const fullText = String(message?.text || "");
            if (!fullText) return null;
            const startAt = Math.max(0, app.voiceHighlightLastEnd || 0);
            const raw = String(rawText || "").trim();
            if (raw) {
                const rawIndex = fullText.indexOf(raw, startAt);
                if (rawIndex >= 0) {
                    const leading = raw.search(/\S/);
                    return rawIndex + Math.max(0, leading);
                }
            }
            const spoken = String(spokenText || "").trim();
            if (spoken) {
                const spokenIndex = fullText.indexOf(spoken, startAt);
                if (spokenIndex >= 0) return spokenIndex;
            }
            return null;
        }

        function storedVoiceCharacterForSpeaker(speaker = "") {
            const wanted = normalizeNameForMatch(speaker);
            if (!wanted || wanted === "narrator") return null;

            const playerNames = ["player", app.state?.player?.name]
                .map(normalizeNameForMatch)
                .filter(Boolean);
            if (playerNames.includes(wanted)) return app.state.player;

            for (const entry of runtimeCharacterEntries(app.state)) {
                const character = entry.entity;
                if (
                    [
                        character?.name,
                        character?.fallback_name,
                        ...(entry.ids || []),
                    ]
                        .map(normalizeNameForMatch)
                        .includes(wanted)
                )
                    return character;
            }

            for (const [key, character] of Object.entries(
                app.state?.characters || {},
            )) {
                if (
                    [key, character?.name, character?.fallback_name]
                        .map(normalizeNameForMatch)
                        .includes(wanted)
                )
                    return character;
            }

            for (const location of Object.values(
                app.state?.npc_directory?.locations || {},
            )) {
                for (const [key, npc] of Object.entries(
                    location?.characters || {},
                )) {
                    const character = npc?.full_character || npc;
                    if (
                        [
                            key,
                            npc?.name,
                            npc?.fallback_name,
                            character?.name,
                            character?.fallback_name,
                        ]
                            .map(normalizeNameForMatch)
                            .includes(wanted)
                    ) {
                        discardRedundantTempSpeaker(
                            character?.name || npc?.name || key,
                            character,
                        );
                        return character;
                    }
                }
            }

            for (const [key, future] of Object.entries(
                app.state?.future_cast?.items || {},
            )) {
                const character = future?.full_character || future;
                if (
                    [
                        key,
                        future?.name,
                        future?.fallback_name,
                        character?.name,
                        character?.fallback_name,
                    ]
                        .map(normalizeNameForMatch)
                        .includes(wanted)
                )
                    return character;
            }

            for (const [key, character] of Object.entries(
                app.state?.temp_speakers || {},
            )) {
                if (
                    [key, character?.name, character?.fallback_name]
                        .map(normalizeNameForMatch)
                        .includes(wanted)
                )
                    return character;
            }
            return null;
        }

        function definitionVoiceCharacterForSpeaker(speaker = "") {
            const wanted = normalizeNameForMatch(speaker);
            if (!wanted || wanted === "narrator") return null;
            app.voiceDefinitionCharacterCache ||= new Map();
            const cached = app.voiceDefinitionCharacterCache.get(wanted);
            if (cached?.generation === app.gameRuntimeGeneration)
                return cached.character;

            const definitions = {
                ...(app.storyDefinition?.characterDefinitionsById || {}),
                ...(app.runtimeDefinitions?.charactersById || {}),
            };
            for (const [id, definition] of Object.entries(definitions)) {
                if (
                    ![id, definition?.id, definition?.name, definition?.fallback_name]
                        .map(normalizeNameForMatch)
                        .includes(wanted)
                )
                    continue;
                const character = clone(definition);
                character.id ||= id;
                app.voiceDefinitionCharacterCache.set(wanted, {
                    generation: app.gameRuntimeGeneration,
                    character,
                });
                return character;
            }
            return null;
        }

        function voiceCharacterForSpeaker(speaker = "", fallbackCharacter = null) {
            const explicitSpeaker = String(speaker || "").trim();
            const storedCharacter = explicitSpeaker
                ? storedVoiceCharacterForSpeaker(explicitSpeaker)
                : null;
            if (storedCharacter) return storedCharacter;
            const resolvedSpeaker = explicitSpeaker
                ? resolveEntityName(speaker, app.state, speaker)
                : "";
            const resolvedCharacter = resolvedSpeaker
                ? storedVoiceCharacterForSpeaker(resolvedSpeaker)
                : null;
            if (resolvedCharacter) return resolvedCharacter;
            const characterKey = explicitSpeaker
                ? resolveExactCharacterDefinitionName(explicitSpeaker, app.state, "")
                : "";
            if (characterKey && app.state.characters?.[characterKey])
                return app.state.characters[characterKey];
            if (resolvedSpeaker && app.state.characters?.[resolvedSpeaker])
                return app.state.characters[resolvedSpeaker];
            if (resolvedSpeaker === "Player")
                return app.state.player;

            const npc = resolvedSpeaker
                ? getNpcEntry(resolvedSpeaker) ||
                  findNpcEntryInState(app.state, resolvedSpeaker)?.npc ||
                  (characterKey
                      ? getNpcEntry(characterKey) ||
                        findNpcEntryInState(app.state, characterKey)?.npc
                      : null)
                : null;
            if (npc?.full_character) {
                discardRedundantTempSpeaker(resolvedSpeaker, npc.full_character);
                return npc.full_character;
            }
            // Return the stored NPC shell itself. A temporary wrapper here loses a
            // lazily assigned voice after this one playback and rerolls it next time.
            if (npc) {
                discardRedundantTempSpeaker(resolvedSpeaker, npc);
                return npc;
            }
            const tempSpeaker = resolvedSpeaker
                ? app.state.temp_speakers?.[resolvedSpeaker]
                : null;
            if (tempSpeaker) return tempSpeaker;
            const definitionCharacter = definitionVoiceCharacterForSpeaker(
                resolvedSpeaker || explicitSpeaker,
            );
            if (definitionCharacter) return definitionCharacter;

            // Do not use the narrator/fallback character for an explicit quoted
            // speaker that failed to resolve. That made unknown dialogue appear
            // "known", letting the reader skip the metadata pause and continue past
            // the quote with the wrong voice. Fallback is only for narration/no
            // explicit speaker context.
            if (explicitSpeaker)
                troubleshootingLog("voice speaker unresolved", {
                    speaker: explicitSpeaker,
                    resolvedSpeaker,
                    characterKey,
                    partyKeys: Object.keys(app.state.characters || {}),
                    voicesLoaded: (app.voices || []).length,
                });
            return explicitSpeaker ? null : fallbackCharacter;
        }

        function playbackVoiceForCharacter(character = {}, name = "") {
            return resolvePersistentCharacterVoice(character, name);
        }

        function cleanSpeechText(text, options = {}) {
            const value = options.preserveInlineVoiceTags
                ? String(text || "")
                : stripInlineVoiceTags(String(text || ""));
            let cleaned = value
                .replace(/<[^>]+>/g, "")
                .replace(/[*_`~]+/g, "")
                .replace(/\s+/g, " ")
                .trim();
            if (options.stripWrappingQuotes && /^["??][\s\S]*["??]$/.test(cleaned))
                cleaned = cleaned.slice(1, -1).trim();
            return cleaned;
        }

        function updateVoiceRangeHighlight(messageId, start, length = 0) {
            if (messageId == null) return;
            const message = findEntryById(messageId);
            if (!message?.text) return;
            const text = String(message.text || "");
            const safeStart = Math.max(0, Math.min(text.length, Number(start) || 0));
            let safeEnd = safeStart + Math.max(0, Number(length) || 0);
            if (safeEnd <= safeStart) {
                const match = text.slice(safeStart).match(/[\p{L}\p{N}'-]+/u);
                if (!match) return;
                safeEnd = safeStart + match[0].length;
            }
            safeEnd = Math.max(safeStart + 1, Math.min(text.length, safeEnd));
            app.voiceHighlight = { messageId, start: safeStart, end: safeEnd };
            app.voiceHighlightLastEnd = safeEnd;
            maybeReleaseAutoVoiceGate(messageId);
            updateVoiceHighlightDom(messageId);
        }

        function updateVoiceHighlightDom(messageId) {
            const article = document.querySelector(
                `#thread [data-message-id="${cssEscape(String(messageId || ""))}"]`,
            );
            const message = findEntryById(messageId);
            const content =
                article?.querySelector?.(".message-content") ||
                article?.querySelector?.(".bubble");
            if (!article || !content || !message) return false;
            article.classList.toggle(
                "voice-active",
                String(app.activeVoiceMessageId || "") === String(messageId),
            );
            mutateThreadPreservingViewport(() => {
                content.innerHTML = formatMessageWithVoiceHighlight(message);
            });
            return true;
        }

        function shouldAppendVoiceRead(messageId = null, options = {}) {
            if (options.appendIfBusy) return true;
            if (messageId == null) return false;
            if (String(app.activeVoiceMessageId || "") === String(messageId)) return false;
            return !!(
                app.activeVoiceMessageId ||
                voiceUtteranceQueueHasWork() ||
                window.speechSynthesis?.speaking ||
                window.speechSynthesis?.pending ||
                app.voicePaused
            );
        }

        function speakReply(text, speaker, messageId = null, options = {}) {
            if (!window.speechSynthesis || !window.SpeechSynthesisUtterance)
                return;
            const character = voiceCharacterForSpeaker(speaker);
            const appendFirst = shouldAppendVoiceRead(messageId, options);
            if (!appendFirst && !options.voiceSessionPrepared)
                resetVoiceSpeechQueue();
            // Do not mark queued messages active here. speakText activates immediate
            // speech now and queued speech on utterance.onstart, keeping the stop
            // button on the message actually being read.

            const parts = applyMessageVoiceSpeakerFallback(
                splitVoiceParts(text),
                messageId,
            );
            const gateIndex =
                options.gateDialogueUntilMetadata &&
                messageId != null &&
                app.voiceMetadataPendingMessageIds.has(String(messageId))
                    ? parts.findIndex((part) =>
                          voicePartNeedsMetadataVoiceGate(part, character),
                      )
                    : -1;
            const speakNow = gateIndex >= 0 ? parts.slice(0, gateIndex) : parts;
            const speakLater = gateIndex >= 0 ? parts.slice(gateIndex) : [];
            if (speakLater.length) {
                // New-speaker voices are assigned after the metadata check. Queue only
                // narration before the unresolved quote now; the held quote and all
                // later narration resume together so reading order cannot skip dialogue.
                app.pendingVoiceDialogueParts.set(String(messageId), {
                    parts: speakLater,
                    character,
                });
            }

            speakNow.forEach((part, index) => {
                queueVoicePart(part, character, messageId, {
                    append: appendFirst || index > 0,
                    auto: options.auto,
                    source: options.gateDialogueUntilMetadata
                        ? "assistant gated read"
                        : "assistant message read",
                });
            });
        }

        function voicePartNeedsMetadataVoiceGate(part, fallbackCharacter = null) {
            if (!part || part.kind !== "dialogue") return false;
            // Only pause for quotes whose speaker has not resolved yet. Existing
            // characters/NPCs and inline-tagged current-check speakers can already
            // use their assigned/default voice, so holding them just delays reading.
            const speaker = String(part.speaker || "").trim();
            // Untagged quotes do not provide a speaker key for the repair check to
            // resolve, so they must not pause waiting for metadata by themselves.
            if (!speaker) return false;
            const character = voiceCharacterForSpeaker(speaker, fallbackCharacter);
            if (!character) return true;
            const voice = playbackVoiceForCharacter(character, speaker);
            return !voice && !normalizedCharacterGender(character?.gender);
        }

        function appendPendingVoiceDialogueParts(messageId, parts = [], character = null) {
            if (messageId == null || !parts.length) return;
            const id = String(messageId);
            const normalizedParts = applyMessageVoiceSpeakerFallback(parts, id);
            const current = app.pendingVoiceDialogueParts.get(id);
            if (current) {
                current.parts.push(...normalizedParts);
                if (!current.character && character) current.character = character;
                return;
            }
            app.pendingVoiceDialogueParts.set(id, {
                parts: [...normalizedParts],
                character,
            });
        }

        function releasePendingVoiceMetadataGate(messageId) {
            if (messageId == null) return;
            const id = String(messageId);
            app.voiceMetadataPendingMessageIds.delete(id);
            const pending = app.pendingVoiceDialogueParts.get(id);
            app.pendingVoiceDialogueParts.delete(id);
            if (!pending || app.stoppedVoiceMessageIds.has(id)) return;
            const appendFirst = !!(
                voiceUtteranceQueueHasWork() ||
                window.speechSynthesis?.speaking ||
                window.speechSynthesis?.pending ||
                String(app.activeVoiceMessageId || "") === id
            );
            const parts = applyMessageVoiceSpeakerFallback(pending.parts, id);
            for (const [index, part] of parts.entries()) {
                queueVoicePart(part, pending.character, messageId, {
                    append: appendFirst || index > 0,
                    allowAfterMetadataGate: true,
                    source: "metadata gate release",
                });
            }
        }

        function singleKnownVoiceSpeakerForMessage(messageId) {
            if (messageId == null) return "";
            const message = findMessageById(messageId) || findEntryById(messageId);
            if (!message) return "";
            const names = new Set();
            const add = (name) => {
                const resolved = resolveEntityName(name, app.state, name);
                if (resolved) names.add(resolved);
            };
            // Streaming starts before post-response speaker extraction finishes.
            // If the assistant message header already names one known present NPC,
            // untagged quotes in that message should use that voice immediately
            // instead of pausing for metadata that is not needed.
            if (
                message.role === "assistant" &&
                message.speaker &&
                !/^(Narrator|Game)$/i.test(String(message.speaker || "").trim())
            )
                add(message.speaker);
            (Array.isArray(message.voiceSpeakers) ? message.voiceSpeakers : []).forEach(add);
            Object.values(message.voiceMeta?.speak || {}).forEach(add);
            return names.size === 1 ? [...names][0] : "";
        }

        function applyMessageVoiceSpeakerFallback(parts = [], messageId = null) {
            if (!Array.isArray(parts) || !parts.length) return [];
            const message = messageId == null ? null : findMessageById(messageId) || findEntryById(messageId);
            const aliases = message?.voiceMeta?.aliases || {};
            const resolveAlias = (speaker = "") => {
                const raw = String(speaker || "").trim();
                if (!raw) return "";
                const exact = aliases[raw];
                if (exact) return exact;
                const normalized = normalizeNameForMatch(raw);
                const match = Object.entries(aliases).find(
                    ([from]) => normalizeNameForMatch(from) === normalized,
                );
                return match?.[1] || raw;
            };
            const remapped = parts.map((part) => {
                const mappedSpeaker = resolveAlias(part?.speaker || "");
                return mappedSpeaker && mappedSpeaker !== part.speaker
                    ? {
                          ...part,
                          speaker: mappedSpeaker,
                          stickySpeakerFallback: true,
                          stickySpeakerSource: "speaker metadata alias",
                      }
                    : part;
            });
            const fallbackSpeaker = singleKnownVoiceSpeakerForMessage(messageId);
            if (!fallbackSpeaker) return remapped;
            // Metadata-gated speech can hold parts that were parsed from the raw
            // streamed text before hidden voice tags were attached. If extraction
            // later says the message has exactly one speaker, untagged quotes in
            // that same message are that speaker; otherwise they would incorrectly
            // resume in the narrator voice.
            return remapped.map((part) =>
                part?.kind === "dialogue" && !String(part.speaker || "").trim()
                    ? {
                          ...part,
                          speaker: fallbackSpeaker,
                          stickySpeakerFallback: true,
                          stickySpeakerSource: "message metadata",
                      }
                    : part,
            );
        }

        function logVoiceReadSegment({
            messageId = null,
            part = {},
            spokenText = "",
            voiceTarget = {},
            messageRange = null,
            source = "",
        } = {}) {
            // Voice debugging is intentionally segment-level while reader issues are
            // being hardened. It is gated by the Voice/reader log setting, so normal
            // players still produce no console/dev-log noise.
            const character = voiceTarget.character;
            const characterGender = character
                ? normalizedCharacterGender(character.gender)
                : "";
            const mappedVoiceCount = characterGender
                ? availableAllowedCharacterVoices(characterGender).length
                : 0;
            const trustedFallback = characterGender && !mappedVoiceCount
                ? trustedBrowserFallbackVoice(characterGender)
                : null;
            log(
                "Voice read segment queued",
                compactJson({
                    messageId,
                    source,
                    kind: part.kind || "",
                    speaker: part.speaker || "",
                    stickySpeakerFallback: !!part.stickySpeakerFallback,
                    stickySpeakerSource: part.stickySpeakerSource || "",
                    voiceSlot: voiceTarget.slot || "",
                    useCharacterVoice: !!voiceTarget.useCharacter,
                    gender: voiceTarget.gender || "",
                    characterResolved: !!character,
                    characterId: character?.id || character?.character_id || "",
                    characterName: character?.name || "",
                    characterGender,
                    savedCharacterVoice: character
                        ? savedCharacterVoiceName(character)
                        : "",
                    installedVoiceCount: (app.voices || []).length,
                    visibleVoiceCount: visibleVoices().length,
                    mappedGenderVoiceCount: mappedVoiceCount,
                    trustedBrowserFallbackVoice: trustedFallback?.name || "",
                    range: messageRange
                        ? {
                              start: messageRange.start,
                              end: messageRange.start + messageRange.length,
                          }
                        : null,
                    text: spokenText,
                }),
                { type: "voice", level: "message" },
            );
        }

        function clearPendingVoiceMetadataGate(messageId) {
            if (messageId == null) return;
            const id = String(messageId);
            app.voiceMetadataPendingMessageIds.delete(id);
            app.pendingVoiceDialogueParts.delete(id);
            app.autoVoiceStartedMessageIds.delete(id);
        }

        function speakPlayerText(text, messageId = null, options = {}) {
            const player = app.state.player || {};
            if (!window.speechSynthesis || !window.SpeechSynthesisUtterance)
                return;
            const appendFirst = shouldAppendVoiceRead(messageId, options);
            if (!appendFirst && !options.voiceSessionPrepared)
                resetVoiceSpeechQueue();
            // Do not mark queued messages active here. speakText activates immediate
            // speech now and queued speech on utterance.onstart, keeping the stop
            // button on the message actually being read.

            playerVoicePartsForText(text).forEach((part, index) => {
                queueVoicePart(
                    part,
                    part.speaker === "Player" ? player : null,
                    messageId,
                    {
                        append: appendFirst || index > 0,
                        auto: options.auto,
                        source: "player message read",
                        preserveInlineVoiceTags: true,
                        stripWrappingQuotes: true,
                    },
                );
            });
        }

        function playerVoicePartsForText(text = "") {
            const value = String(text || "");
            if (!value.trim()) return [];
            const rawParts = [];
            const pushPart = (kind, speaker, start, end) => {
                const raw = value.slice(start, end);
                if (!raw.trim()) return;
                const leading = raw.search(/\S/);
                const trailing = raw.match(/\s*$/)?.[0]?.length || 0;
                const safeStart = start + Math.max(0, leading);
                const safeEnd = Math.max(safeStart, end - trailing);
                if (safeEnd <= safeStart) return;
                rawParts.push({
                    kind,
                    speaker,
                    text: value.slice(safeStart, safeEnd),
                    start: safeStart,
                    end: safeEnd,
                });
            };
            const isQuote = (char) => char === '"' || char === "?" || char === "?";
            const isSingleAsterisk = (at) =>
                value[at] === "*" && value[at - 1] !== "*" && value[at + 1] !== "*";
            let index = 0;
            let playerStart = 0;
            while (index < value.length) {
                if (isQuote(value[index])) {
                    // Player prose outside action markup is still authored by
                    // the player. Quotation marks only remove visual wrappers;
                    // they must not be the boundary between player and narrator
                    // voice.
                    pushPart("dialogue", "Player", playerStart, index);
                    const quoteStart = index + 1;
                    index++;
                    while (index < value.length && !isQuote(value[index])) index++;
                    const quoteEnd = index < value.length ? index : value.length;
                    pushPart("dialogue", "Player", quoteStart, quoteEnd);
                    playerStart = index < value.length ? index + 1 : value.length;
                    index = playerStart;
                    continue;
                }
                if (!isSingleAsterisk(index)) {
                    index++;
                    continue;
                }
                pushPart("dialogue", "Player", playerStart, index);
                const actionStart = index;
                index++;
                while (index < value.length && !isSingleAsterisk(index)) index++;
                const actionEnd = index < value.length ? index + 1 : value.length;
                pushPart("narration", "", actionStart, actionEnd);
                playerStart = actionEnd;
                index = actionEnd;
            }
            pushPart("dialogue", "Player", playerStart, value.length);
            return rawParts;
        }

        function speakCharacterText(text, speaker, messageId = null, options = {}) {
            if (!window.speechSynthesis || !window.SpeechSynthesisUtterance)
                return;
            const character = voiceCharacterForSpeaker(speaker);
            const appendFirst = shouldAppendVoiceRead(messageId, options);
            if (!appendFirst && !options.voiceSessionPrepared)
                resetVoiceSpeechQueue();
            // Do not mark queued messages active here. speakText activates immediate
            // speech now and queued speech on utterance.onstart, keeping the stop
            // button on the message actually being read.
            queueVoicePart(
                {
                    kind: "dialogue",
                    speaker,
                    text: String(text || ""),
                },
                character,
                messageId,
                {
                    append: appendFirst,
                    auto: options.auto,
                    source: "character message read",
                },
            );
        }

        function voiceUtteranceQueueHasWork() {
            return !!(
                app.voiceUtteranceCurrent ||
                app.voiceUtteranceQueue?.length ||
                app.voiceUtterancePumpTimer
            );
        }

        function resetVoiceSpeechQueue() {
            app.voiceUtteranceGeneration = Number(app.voiceUtteranceGeneration || 0) + 1;
            app.voiceUtteranceQueue = [];
            app.voiceUtteranceCurrent = null;
            app.voiceCurrentIdleSince = 0;
            if (app.voiceUtterancePumpTimer != null) {
                clearTimeout(app.voiceUtterancePumpTimer);
                app.voiceUtterancePumpTimer = null;
            }
            window.speechSynthesis?.cancel?.();
        }

        function suspendCurrentVoiceUtteranceForModal() {
            const entry = app.voiceUtteranceCurrent;
            if (!entry) return;
            clearTimeout(entry.startTimer);
            //Detach before cancel: late end/error events belong to the old utterance.
            app.voiceUtteranceCurrent = null;
            app.voiceCurrentIdleSince = 0;
            app.voiceUtteranceQueue.unshift({
                ...entry,
                text: entry.text.slice(entry.resumeCharacterIndex || 0),
                resumeCharacterIndex: 0,
                started: false,
                utterance: null,
                startTimer: null,
            });
            //Online voices can remain stuck after native pause/resume. Keep our queue
            //and submit a fresh utterance when the last blocking modal closes.
            window.speechSynthesis.cancel();
        }

        function scheduleVoiceUtterancePump(delayMs = 0) {
            if (app.voiceUtterancePumpTimer != null || app.voiceUtteranceCurrent)
                return;
            app.voiceUtterancePumpTimer = setTimeout(() => {
                app.voiceUtterancePumpTimer = null;
                pumpVoiceUtteranceQueue();
            }, Math.max(0, Number(delayMs) || 0));
        }

        function finishQueuedVoiceUtterance(entry, eventName = "ended", event = null) {
            if (app.voiceUtteranceCurrent !== entry) return;
            clearTimeout(entry.startTimer);
            app.voiceUtteranceCurrent = null;
            app.voiceCurrentIdleSince = 0;
            log(
                `Voice utterance ${eventName}`,
                compactJson({
                    messageId: entry.messageId,
                    voice: entry.voice?.name || "",
                    textLength: entry.text.length,
                    error: event?.error || "",
                }),
                { type: "voice", level: eventName === "error" ? "warn" : "message" },
            );
            scheduleVoiceUtterancePump();
        }

        function speechVoiceFailedThisSession(voiceOrName = "") {
            const name = textSlot(voiceOrName?.name || voiceOrName, "");
            return !!name && app.failedSpeechVoiceNames?.has(name);
        }

        function markSpeechVoiceFailed(voiceOrName = "") {
            const name = textSlot(voiceOrName?.name || voiceOrName, "");
            if (!name) return;
            app.failedSpeechVoiceNames ||= new Set();
            app.failedSpeechVoiceNames.add(name);
        }

        function replacementVoiceForQueuedEntry(entry = {}) {
            loadVoices();
            const currentName = textSlot(entry.voice?.name, "");
            const gender = normalizedCharacterGender(
                entry.voiceCharacter?.gender || entry.voiceGender,
            );
            let candidates = visibleVoices().filter(
                (voice) =>
                    voice?.name !== currentName &&
                    !speechVoiceFailedThisSession(voice),
            );
            if (gender === "male" || gender === "female") {
                const genderMatches = candidates.filter(
                    (voice) => voiceGenderFromName(voice.name) === gender,
                );
                if (genderMatches.length) candidates = genderMatches;
            }
            const local = candidates.filter((voice) => voice.localService === true);
            if (!local.length) {
                const browserDefault = {
                    name: "Browser Default",
                    lang: "",
                    localService: true,
                    systemDefault: true,
                };
                return speechVoiceFailedThisSession(browserDefault)
                    ? null
                    : browserDefault;
            }
            return bestCompatibleVoice({
                voices: local,
                slot: entry.voiceCharacter ? "Character" : entry.voiceSlot,
                gender,
            });
        }

        function persistStartedVoiceFallback(entry = {}) {
            if (!entry.pendingVoiceFallback) return;
            entry.pendingVoiceFallback = false;
            const voiceName = textSlot(entry.voice?.name, "");
            if (!voiceName || entry.voice?.systemDefault) return;

            if (entry.voiceCharacter || entry.voiceCharacterName) {
                const liveCharacter = entry.voiceCharacterName
                    ? storedVoiceCharacterForSpeaker(entry.voiceCharacterName)
                    : null;
                const character = liveCharacter || entry.voiceCharacter;
                if (character) {
                    const changed = updateOwnedRuntimeCharacter(
                        character,
                        entry.voiceCharacterName,
                        (target) => setRuntimeCharacterVoice(target, voiceName),
                    );
                    if (changed) scheduleActiveGameSave();
                }
                return;
            }

            const settingKey =
                entry.voiceSlot === "Narrator"
                    ? "narratorVoiceName"
                    : [
                          "defaultMalePlayerVoiceName",
                          "defaultNonMalePlayerVoiceName",
                      ].includes(entry.voiceSlot)
                      ? entry.voiceSlot
                      : "";
            if (settingKey && app.settings[settingKey] !== voiceName) {
                app.settings[settingKey] = voiceName;
                saveSettingsNow("working speech voice selected");
            }
        }

        function retryQueuedVoiceUtterance(entry, event = null) {
            const errorName = String(event?.error || "").trim().toLowerCase();
            if (["canceled", "cancelled", "interrupted"].includes(errorName)) return false;
            markSpeechVoiceFailed(entry.voice);
            if (entry.started || Number(entry.voiceRetryCount || 0) >= 3) return false;
            const replacement = replacementVoiceForQueuedEntry(entry);
            if (!replacement) return false;

            clearTimeout(entry.startTimer);
            app.voiceUtteranceCurrent = null;
            window.speechSynthesis.cancel();
            entry.voice = replacement;
            entry.voiceRetryCount = Number(entry.voiceRetryCount || 0) + 1;
            entry.pendingVoiceFallback = true;
            entry.utterance = null;
            app.voiceUtteranceQueue.unshift(entry);
            log(
                "Voice utterance retrying",
                compactJson({
                    messageId: entry.messageId,
                    failedVoice: event?.failedVoice || "",
                    replacementVoice: replacement.name,
                    localService: replacement.localService === true,
                    attempt: entry.voiceRetryCount,
                    error: event?.error || "",
                }),
                { type: "voice", level: "warn" },
            );
            scheduleVoiceUtterancePump(80);
            return true;
        }

        function pumpVoiceUtteranceQueue() {
            if (app.voiceUtteranceCurrent || app.voicePaused || app.narrationModalPauseDepth > 0)
                return;
            const generation = Number(app.voiceUtteranceGeneration || 0);
            let entry = app.voiceUtteranceQueue.shift();
            while (
                entry &&
                (entry.generation !== generation ||
                    (entry.messageId != null &&
                        app.stoppedVoiceMessageIds.has(String(entry.messageId))))
            )
                entry = app.voiceUtteranceQueue.shift();
            if (!entry) {
                renderVoicePauseButton();
                return;
            }
            if (speechVoiceFailedThisSession(entry.voice)) {
                const replacement = replacementVoiceForQueuedEntry(entry);
                if (!replacement) {
                    entry.onerror?.({ error: "no-working-voice" });
                    scheduleVoiceUtterancePump();
                    return;
                }
                entry.voice = replacement;
                entry.pendingVoiceFallback = true;
            }
            const utterance = new SpeechSynthesisUtterance(entry.text);
            utterance.voice = entry.voice?.systemDefault ? null : entry.voice;
            utterance.rate = entry.rate;
            utterance.pitch = entry.pitch;
            entry.started = false;
            entry.resumeCharacterIndex = 0;
            entry.utterance = utterance;
            app.voiceUtteranceCurrent = entry;
            utterance.onboundary = (event) => {
                if (app.voiceUtteranceCurrent !== entry || event.name !== "word") return;
                if (Number.isInteger(event.charIndex) && event.charIndex >= 0 && event.charIndex < entry.text.length)
                    entry.resumeCharacterIndex = event.charIndex;
            };
            utterance.onstart = () => {
                if (app.voiceUtteranceCurrent !== entry) return;
                entry.started = true;
                app.voiceCurrentIdleSince = 0;
                clearTimeout(entry.startTimer);
                log(
                    "Voice utterance started",
                    compactJson({
                        messageId: entry.messageId,
                        voice: entry.voice?.name || "",
                        textLength: entry.text.length,
                    }),
                    { type: "voice", level: "message" },
                );
                persistStartedVoiceFallback(entry);
                entry.onstart?.();
                renderVoicePauseButton();
            };
            utterance.onend = (event) => {
                if (app.voiceUtteranceCurrent !== entry) return;
                entry.onend?.(event);
                finishQueuedVoiceUtterance(entry, "ended", event);
            };
            utterance.onerror = (event) => {
                if (app.voiceUtteranceCurrent !== entry) return;
                const errorName = String(event?.error || "").trim().toLowerCase();
                if (
                    entry.started ||
                    ["canceled", "cancelled", "interrupted"].includes(errorName)
                ) {
                    app.voiceUtteranceQueue = (app.voiceUtteranceQueue || []).filter(
                        (queued) =>
                            String(queued?.messageId ?? "") !==
                            String(entry.messageId ?? ""),
                    );
                }
                const failedVoice = entry.voice?.name || "";
                if (
                    retryQueuedVoiceUtterance(entry, {
                        error: event?.error || "synthesis-failed",
                        failedVoice,
                    })
                )
                    return;
                entry.onerror?.(event);
                finishQueuedVoiceUtterance(entry, "error", event);
            };
            log(
                "Voice utterance submitted",
                compactJson({
                    messageId: entry.messageId,
                    voice: entry.voice?.name || "",
                    localService: entry.voice?.localService === true,
                    textLength: entry.text.length,
                    remainingSegments: app.voiceUtteranceQueue.length,
                }),
                { type: "voice", level: "message" },
            );
            window.speechSynthesis.speak(utterance);
            entry.startTimer = setTimeout(() => {
                if (app.voiceUtteranceCurrent !== entry || entry.started) return;
                log(
                    "Voice utterance start timed out",
                    compactJson({
                        messageId: entry.messageId,
                        voice: entry.voice?.name || "",
                        speaking: !!window.speechSynthesis?.speaking,
                        pending: !!window.speechSynthesis?.pending,
                        paused: !!window.speechSynthesis?.paused,
                    }),
                    { type: "voice", level: "warn" },
                );
                const failedVoice = entry.voice?.name || "";
                app.voiceUtteranceCurrent = null;
                window.speechSynthesis.cancel();
                if (
                    retryQueuedVoiceUtterance(entry, {
                        error: "start-timeout",
                        failedVoice,
                    })
                )
                    return;
                entry.onerror?.({ error: "start-timeout" });
                app.voiceUtteranceGeneration =
                    Number(app.voiceUtteranceGeneration || 0) + 1;
                app.voiceUtteranceQueue = [];
                renderVoicePauseButton();
            }, 4000);
            renderVoicePauseButton();
        }

        function enqueueVoiceUtterance(entry = {}) {
            app.voiceUtteranceQueue ||= [];
            app.voiceUtteranceQueue.push({
                ...entry,
                generation: Number(app.voiceUtteranceGeneration || 0),
            });
            scheduleVoiceUtterancePump();
            renderVoicePauseButton();
        }

        function speakText(text, slotOrVoiceName = "Narrator", opts = {}) {
            if (
                opts.messageId != null &&
                app.stoppedVoiceMessageIds.has(String(opts.messageId))
            )
                return;
            if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
                log(
                    "Voice unavailable",
                    "This browser does not expose speech synthesis.",
                );
                return;
            }
            if (opts.auto !== false && !app.settings.autoVoice) {
                stopReadingMessage();
                renderVoicePauseButton();
                return;
            }
            if (opts.replaceQueue) resetVoiceSpeechQueue();
            const hasMessageId = opts.messageId != null;
            const selectedVoice = pickVoice(slotOrVoiceName, opts.voiceName);
            if (!selectedVoice) {
                log(
                    "Voice skipped",
                    "No non-blacklisted speech voice is available for this browser/profile.",
                    { type: "message", level: "warn" },
                );
                return;
            }
            let utteranceToken = null;
            const finishVoiceMessageProgress = () => {
                if (!hasMessageId) return;
                setTimeout(() => {
                    if (voiceUtteranceQueueHasWork() || app.voicePaused) {
                        maybeReleaseAutoVoiceGate(opts.messageId);
                        return;
                    }
                    const message = findEntryById(opts.messageId);
                    if (message?.text)
                        app.voiceHighlightLastEnd = String(message.text).length;
                    maybeReleaseAutoVoiceGate(opts.messageId);
                }, 120);
            };
            const highlightSegment = () => {
                if (utteranceToken == null) return;
                const range = opts.messageRange || null;
                if (!range || !Number.isFinite(Number(range.start))) return;
                updateVoiceRangeHighlight(
                    opts.messageId,
                    Number(range.start),
                    Number(range.length) || 0,
                );
            };
            enqueueVoiceUtterance({
                text: String(text || ""),
                voice: selectedVoice,
                rate: opts.rate ?? 0.92,
                pitch: opts.pitch ?? 1,
                messageId: opts.messageId,
                voiceSlot: slotOrVoiceName,
                voiceCharacter: opts.voiceCharacter || null,
                voiceCharacterName: opts.voiceCharacterName || "",
                voiceGender: opts.voiceGender || "",
                onstart: hasMessageId
                    ? () => {
                        utteranceToken = ensureActiveVoiceMessage(opts.messageId);
                        highlightSegment();
                    }
                    : null,
                onend: hasMessageId
                    ? () => {
                        finishVoiceMessageProgress();
                        if (utteranceToken != null)
                            clearActiveVoiceMessageWhenDone(utteranceToken);
                    }
                    : null,
                onerror: hasMessageId
                    ? () => {
                        finishVoiceMessageProgress();
                        if (utteranceToken != null)
                            clearActiveVoiceMessageWhenDone(utteranceToken);
                    }
                    : null,
            });
        }

        function previewVoice(slot, selectId) {
            const select = $(selectId);
            const voiceName = select?.value || "";
            const samples = voicePreviewSamples();

            speakText(samples[slot] || samples.Narrator, slot, {
                voiceName,
                auto: false,
                replaceQueue: true,
            });
            setStatus(`Previewing ${voiceName || slot}`);
            log("Voice preview", voiceName || slot);
        }

        function voicePreviewSamples() {
            return {
                Narrator:
                    "The path opens before you, bright with danger and promise.",
                "Feminine Lead": "Hi, I'm your companion. Let's go on an adventure!",
                "Masculine Lead": "Hi, I'm your companion. Let's go on an adventure!",
            };
        }

        function characterVoicePreviewText(name) {
            return `Hi, I'm ${name || "your companion"}. Let's go on an adventure!`;
        }

        function bindVoiceCycler({
            selectId,
            searchId,
            prevId,
            nextId,
            testId,
            slot,
            sample,
            selected = "",
            gender = "",
        }) {
            const select = $(selectId);
            if (!select) return;
            const search = $(searchId);
            const previewText =
                sample || voicePreviewSamples()[slot] || voicePreviewSamples().Narrator;
            let selectedVoiceName =
                gender === "male" || gender === "female"
                    ? resolveCharacterVoiceName(selected, { gender }, selected)
                    : resolveVoiceName(selected || slot, slot);

            const renderOptions = () => {
                const current = select.value || selectedVoiceName;
                const query = String(search?.value || "").trim().toLowerCase();
                const voices = filteredVoices(query, current, gender);

                select.innerHTML =
                    voices
                    .map((voice) => {
                        const genderLabel = voiceGenderFromName(voice.name);
                        const label = `${voice.name} (${voice.lang})${
                            genderLabel !== "unknown" ? ` - ${genderLabel}` : ""
                        }${
                            isBadVoiceName(voice.name) ? " - rough" : ""
                        }`;
                        return `<option value="${escapeHtml(voice.name)}">${escapeHtml(label)}</option>`;
                    })
                    .join("");

                if ([...select.options].some((option) => option.value === current)) {
                    select.value = current;
                    selectedVoiceName = current;
                } else if (select.options.length) {
                    select.selectedIndex = 0;
                    selectedVoiceName = select.value;
                }
            };

            const previewSelected = () => {
                const voiceName = select.value;
                speakText(previewText, voiceName || slot, {
                    voiceName,
                    auto: false,
                    replaceQueue: true,
                });
                setStatus(`Previewing ${voiceName || slot}`);
            };

            const step = (delta) => {
                const options = [...select.options].filter((option) => option.value);
                if (!options.length) return;
                const currentIndex = options.findIndex(
                    (option) => option.value === select.value,
                );
                const nextIndex =
                    currentIndex < 0
                        ? delta > 0
                            ? 0
                            : options.length - 1
                        : (currentIndex + delta + options.length) %
                          options.length;
                select.value = options[nextIndex].value;
                previewSelected();
                select.dispatchEvent(
                    new CustomEvent("emberadventureslite-setting-commit", {
                        bubbles: true,
                    }),
                );
            };

            renderOptions();
            if (search) search.oninput = renderOptions;
            if ($(prevId)) $(prevId).onclick = () => step(-1);
            if ($(nextId)) $(nextId).onclick = () => step(1);
            if ($(testId)) $(testId).onclick = previewSelected;
            select.addEventListener("change", () => {
                previewSelected();
                select.dispatchEvent(
                    new CustomEvent("emberadventureslite-setting-commit", {
                        bubbles: true,
                    }),
                );
            });
        }

        function filteredVoices(query, selected = "", gender = "") {
            const voices = visibleVoicesForGender(gender, selected);
            if (!query) return voices;
            const filtered = voices.filter((voice) =>
                `${voice.name} ${voice.lang}`.toLowerCase().includes(query),
            );
            const selectedVoice = voices.find((voice) => voice.name === selected);
            if (
                selectedVoice &&
                !filtered.some((voice) => voice.name === selectedVoice.name)
            )
                filtered.unshift(selectedVoice);
            return filtered;
        }

        function splitVoiceParts(text) {
            // Inline voice tags are sticky only inside this one message. Later
            // untagged quotes reuse the previous tagged speaker, and each part gets a
            // visible range so the reader highlights speaker-delimited segments
            // instead of using fragile per-word browser boundary matching.
            // Range rule: never trim the whole source before calculating ranges.
            // Highlight offsets are rendered against message.text, so leading
            // whitespace/newlines must stay in the coordinate system.
            const clean = String(text || "")
                .replace(/<[^>]+>/g, "");
            const parts = [];
            const re = /(?:((?:\([^()\n]{1,140}\)\s*)+))?"([^"\n]+)"/g;
            let activeSpeaker = "";
            let stickyQuoteSpeaker = "";
            const suppressSingleSpeakerLabels =
                shouldSuppressSingleSpeakerInlineVoiceLabels(clean);
            let visibleCursor = 0;
            let last = 0,
                m;
            const pushNarrationSegment = (rawSegment, segmentStart) => {
                const visible = renderInlineVoiceTagsForSplit(
                    rawSegment,
                    activeSpeaker,
                    suppressSingleSpeakerLabels,
                );
                const value = visible.trim();
                if (!value) return visible.length;
                // A tag identifies quoted speech only. Scene narration remains in
                // the Narrator voice even when it appears between one character's
                // consecutive lines.
                parts.push(...narrationVoiceParts(visible, segmentStart));
                const nextSpeaker = lastSpeakerPrefix(value);
                if (nextSpeaker) activeSpeaker = nextSpeaker;
                return visible.length;
            };
            const pushInlineVoiceLabelPart = (tag, segmentStart) => {
                const label = inlineVoiceTagDisplayLabel(
                    tag,
                    activeSpeaker,
                    suppressSingleSpeakerLabels,
                );
                if (!label) return 0;
                parts.push({
                    kind: "narration",
                    speaker: "",
                    text: label,
                    start: segmentStart,
                    end: segmentStart + label.length,
                });
                return label.length + 1;
            };
            const pushNarration = (block, baseStart = 0) => {
                const raw = String(block || "");
                const tagPattern = /\(([^()\n]{1,140})\)\s*/g;
                let rawCursor = 0;
                let visibleOffset = 0;
                let tagMatch;
                while ((tagMatch = tagPattern.exec(raw))) {
                    const tag = parseInlineVoiceTag(tagMatch[1]);
                    if (!inlineVoiceTagCanSwitchSpeaker(tag)) continue;
                    visibleOffset += pushNarrationSegment(
                        raw.slice(rawCursor, tagMatch.index),
                        baseStart + visibleOffset,
                    );
                    if (
                        tag.explicitGender &&
                        !speakerExistsAsEntity(tag.speaker)
                    ) {
                        ensureTempSpeaker(tag.speaker, tag.gender);
                    }
                    visibleOffset += pushInlineVoiceLabelPart(
                        tag,
                        baseStart + visibleOffset,
                    );
                    if (isPlayerEntityName(tag.speaker)) {
                        activeSpeaker = "";
                        stickyQuoteSpeaker = "";
                    } else {
                        activeSpeaker = tag.speaker;
                        stickyQuoteSpeaker = tag.speaker;
                    }
                    rawCursor = tagMatch.index + tagMatch[0].length;
                }
                pushNarrationSegment(raw.slice(rawCursor), baseStart + visibleOffset);
            };
            while ((m = re.exec(clean))) {
                const before = clean.slice(last, m.index);
                const visibleBefore = renderInlineVoiceTagsForSplit(
                    before,
                    activeSpeaker,
                    suppressSingleSpeakerLabels,
                );
                if (visibleBefore.trim()) pushNarration(before, visibleCursor);
                visibleCursor += visibleBefore.length;
                const tagBodies = [...String(m[1] || "").matchAll(/\(([^()\n]{1,140})\)/g)];
                const tag = tagBodies.length
                    ? parseInlineVoiceTag(tagBodies[tagBodies.length - 1][1] || "")
                    : null;
                if (
                    tag?.speaker &&
                    tag.explicitGender &&
                    !speakerExistsAsEntity(tag.speaker)
                ) {
                    ensureTempSpeaker(tag.speaker, tag.gender);
                }
                const explicitTagSpeaker = !!tag?.speaker;
                const quoteSpeaker = explicitTagSpeaker
                    ? tag.speaker
                    : stickyQuoteSpeaker || activeSpeaker;
                let labelVisibleLength = 0;
                if (explicitTagSpeaker) {
                    labelVisibleLength = pushInlineVoiceLabelPart(tag, visibleCursor);
                    if (isPlayerEntityName(tag.speaker)) {
                        activeSpeaker = "";
                        stickyQuoteSpeaker = "";
                    } else {
                        activeSpeaker = tag.speaker;
                        stickyQuoteSpeaker = tag.speaker;
                    }
                }
                const quoteText = assistantVisibleMessageText(m[2] || "");
                const visibleMatchLength = explicitTagSpeaker
                    ? labelVisibleLength + quoteText.length + 2
                    : renderInlineVoiceTagsForSplit(
                          m[0] || "",
                          activeSpeaker,
                          suppressSingleSpeakerLabels,
                      ).length;
                if (m[2].trim()) {
                    // Voice ranges are rendered against message.text, not raw
                    // voiceText. Strip the same display-only markdown here or
                    // emphasis like *we* shifts every later highlight range.
                    const quoteStartInMatch = explicitTagSpeaker
                        ? labelVisibleLength + 1
                        : renderInlineVoiceTagsForSplit(
                              m[0] || "",
                              activeSpeaker,
                              suppressSingleSpeakerLabels,
                          ).indexOf(quoteText);
                    const segmentStartInMatch =
                        quoteStartInMatch >= 0
                            ? quoteStartInMatch + firstNonWhitespaceIndex(quoteText)
                            : firstNonWhitespaceIndex(quoteText);
                    const segmentEndInMatch =
                        quoteStartInMatch >= 0
                            ? quoteStartInMatch + lastNonWhitespaceEnd(quoteText)
                            : lastNonWhitespaceEnd(quoteText);
                    // Dialogue speech ranges are relative to the text inside quotes.
                    // If they start on the opening quote, the visible range must
                    // still exclude the quote itself so highlights stay aligned.
                    parts.push(
                        dialogueVoicePart(
                            quoteText.trim(),
                            quoteSpeaker,
                            visibleCursor + segmentStartInMatch,
                            visibleCursor + segmentEndInMatch,
                            {
                                stickySpeakerFallback:
                                    !explicitTagSpeaker && !!quoteSpeaker,
                                stickySpeakerSource: !explicitTagSpeaker && quoteSpeaker
                                    ? "previous inline voice tag"
                                    : "",
                            },
                        ),
                    );
                }
                visibleCursor += visibleMatchLength;
                last = re.lastIndex;
            }
            const restRaw = clean.slice(last);
            const restVisible = renderInlineVoiceTagsForSplit(
                restRaw,
                activeSpeaker,
                suppressSingleSpeakerLabels,
            );
            if (restVisible.trim()) pushNarration(restRaw, visibleCursor);
            return parts.length
                ? parts
                : narrationVoiceParts(assistantVisibleMessageText(clean), 0);
        }

        function firstNonWhitespaceIndex(text = "") {
            const match = String(text || "").match(/\S/);
            return match ? match.index : 0;
        }

        function lastNonWhitespaceEnd(text = "") {
            const value = String(text || "");
            const match = value.match(/\s*$/);
            return match ? value.length - match[0].length : value.length;
        }

        function narrationVoiceParts(text, baseStart = 0) {
            const parts = [];
            const value = String(text || "");
            const linePattern = /[^\n]+/g;
            let match;
            while ((match = linePattern.exec(value))) {
                const rawLine = match[0];
                const trimmed = rawLine.trim();
                if (!trimmed) continue;
                const stripped = stripSpeakerPrefix(trimmed);
                const lineText = String(stripped.text || "").trim();
                if (!lineText) continue;
                const lineTextIndex = rawLine.indexOf(lineText);
                const start =
                    baseStart +
                    match.index +
                    (lineTextIndex >= 0 ? lineTextIndex : firstNonWhitespaceIndex(rawLine));
                parts.push({
                    kind: "narration",
                    speaker: "",
                    text: lineText,
                    start,
                    end: start + lineText.length,
                });
            }
            return parts;
        }

        function dialogueVoicePart(
            text,
            activeSpeaker = "",
            start = null,
            end = null,
            options = {},
        ) {
            return {
                kind: "dialogue",
                speaker: activeSpeaker || "",
                text: String(text || "").trim(),
                start,
                end,
                stickySpeakerFallback: !!options.stickySpeakerFallback,
                stickySpeakerSource: textSlot(options.stickySpeakerSource, ""),
            };
        }

        function lastSpeakerPrefix(text = "") {
            let speaker = "";
            for (const line of String(text || "").split(/\n+/)) {
                const prefix = detectSpeakerPrefix(line.trim());
                if (prefix) speaker = prefix;
            }
            return speaker;
        }

        function stripSpeakerPrefix(text) {
            const raw = String(text || "").trim();
            const speaker = detectSpeakerPrefix(raw);
            if (!speaker) return { speaker: "", text: raw };

            return {
                speaker,
                text: raw.replace(new RegExp(`^${escapeRegExp(speaker)}\\s*[:\\-]\\s*`, "i"), ""),
            };
        }

        function detectSpeakerPrefix(text) {
            const genericSection = String(text || "").match(
                /^\s*([A-Z][A-Za-z0-9 .,'-]{1,78})\s*:\s*$/,
            );
            if (genericSection) {
                const candidate = genericSection[1].trim();
                // Narration can introduce dialogue with a colon, e.g.
                // "A deep, amused voice rumbles:". That is not a speaker label
                // and must not override sticky voice fallback for the quote.
                if (looksLikeStandaloneSpeakerLabel(candidate)) return candidate;
            }
            const names = [
                ...new Set([
                    "Player",
                    ...Object.keys(app.state.characters || {}),
                    ...Object.keys(app.state.temp_speakers || {}),
                    ...allNpcNamesFromState(app.state),
                    ...(app.state.scene?.npcs_present || []),
                ]),
            ].sort((a, b) => b.length - a.length);
            for (const name of names) {
                const pattern = new RegExp(`^${escapeRegExp(name)}\\s*[:\\-]`, "i");
                if (pattern.test(text)) return name;
            }
            return "";
        }

        function looksLikeStandaloneSpeakerLabel(candidate = "") {
            const value = String(candidate || "").trim();
            if (!value || /[,;]/.test(value)) return false;
            if (
                /\b(?:says?|asks?|calls?|rumbles?|shouts?|whispers?|mutters?|replies?|growls?|yells?|speaks?)\b/i.test(
                    value,
                )
            )
                return false;
            const words = value.split(/\s+/).filter(Boolean);
            if (words.length > 4) return false;
            return words.every((word) => /^[A-Z0-9][A-Za-z0-9.'-]*$/.test(word));
        }

        function refreshVoiceCache() {
            app.voices = window.speechSynthesis?.getVoices?.() || [];
            app.voiceCacheInitialized = true;
            catalogVoiceGenders();
        }

        function loadVoices() {
            if (!app.voiceCacheInitialized)
                refreshVoiceCache();
            return app.voices;
        }

        function catalogVoiceGenders() {
            app.settings.voiceGenderMap ||= {};
            let changed = false;
            for (const voice of app.voices || []) {
                if (!voice?.name) continue;
                if (app.settings.voiceGenderMap[voice.name]) continue;
                app.settings.voiceGenderMap[voice.name] = "unknown";
                changed = true;
            }
            if (changed) {
                saveSettingsNow("voice gender catalog updated");
            }
        }

        function isEnglishVoice(voice) {
            return /^en[-_]/i.test(String(voice?.lang || ""));
        }

        function visibleVoices(selected = "") {
            const voices = app.voices || [];
            const filtered = app.settings.showNonEnglishVoices
                ? voices
                : voices.filter(isEnglishVoice);
            const visible = filtered.filter(
                (voice) =>
                    !speechVoiceFailedThisSession(voice) &&
                    (voiceNameMatchesRequest(voice.name, selected) ||
                        !isBlacklistedVoiceName(voice.name)),
            );
            const selectedVoice = findVoiceByRequestedName(
                voices.filter((voice) => !speechVoiceFailedThisSession(voice)),
                selected,
            );

            if (
                selectedVoice &&
                !visible.some((voice) => voice.name === selectedVoice.name)
            )
                return [selectedVoice, ...visible];

            return visible;
        }

        function visibleVoicesForGender(gender = "", selected = "") {
            const desired = normalizedCharacterGender(gender);
            const voices = visibleVoices(selected);
            if (desired !== "male" && desired !== "female") return voices;

            let filtered = voices.filter(
                (voice) => voiceGenderFromName(voice.name) === desired,
            );
            if (!filtered.length) return [];
            const selectedVoice = findVoiceByRequestedName(
                voices.filter(
                    (voice) => voiceGenderFromName(voice.name) === desired,
                ),
                selected,
            );
            if (
                selectedVoice &&
                !filtered.some((voice) => voice.name === selectedVoice.name)
            )
                filtered.unshift(selectedVoice);

            return filtered;
        }

        function availableAllowedCharacterVoices(gender = "") {
            loadVoices();
            const all = visibleVoices();
            const normalized = normalizedCharacterGender(gender);
            return all.filter(
                (voice) => voiceGenderFromName(voice.name) === normalized,
            );
        }

        function trustedBrowserFallbackVoice(gender = "") {
            const normalized = normalizedCharacterGender(gender);
            if (normalized !== "male" && normalized !== "female") return null;
            const browser = voiceBrowserKind();
            const requestedNames = [
                ...(VOICE_BROWSER_FALLBACKS[browser]?.[normalized] || []),
                ...(VOICE_BROWSER_FALLBACKS.generic?.[normalized] || []),
            ];
            const voices = visibleVoices();
            for (const requested of requestedNames) {
                const matched = findVoiceByRequestedName(voices, requested);
                if (
                    matched &&
                    !isBadVoiceName(matched.name) &&
                    !speechVoiceFailedThisSession(matched)
                )
                    return matched;
            }
            return null;
        }

        function randomAvailableCharacterVoice(gender = "") {
            const voices = availableAllowedCharacterVoices(gender);
            if (!voices.length)
                return trustedBrowserFallbackVoice(gender)?.name || "";
            return voices[Math.floor(Math.random() * voices.length)]?.name || "";
        }

        function savedCharacterVoiceName(character = {}) {
            const definitionVoice = isPlainObject(character?.voice)
                ? textSlot(character.voice.preferred_voice_name, "")
                : "";
            return textSlot(
                character?.runtime_voice ||
                    (typeof character?.voice === "string"
                        ? character.voice
                        : definitionVoice),
                "",
            );
        }

        function setRuntimeCharacterVoice(character = {}, voice = "") {
            const next = textSlot(voice, "");
            if (!next || !isPlainObject(character)) return false;
            if (isPlainObject(character.voice)) {
                if (character.runtime_voice === next) return false;
                character.runtime_voice = next;
                return true;
            }
            if (character.voice === next) return false;
            character.voice = next;
            return true;
        }

        function discardRedundantTempSpeaker(name = "", character = null) {
            const speakerName = textSlot(name, "");
            const tempSpeaker = app.state.temp_speakers?.[speakerName];
            if (!speakerName || !tempSpeaker || !isPlainObject(character)) return false;

            // Temp speakers are only bridges until a real party character or NPC
            // exists. Keeping both creates competing voice assignments.
            if (!savedCharacterVoiceName(character)) {
                const tempVoice = availableSavedCharacterVoice(tempSpeaker);
                if (tempVoice) setRuntimeCharacterVoice(character, tempVoice);
            }
            delete app.state.temp_speakers[speakerName];
            return true;
        }

        function availableSavedCharacterVoice(character = {}) {
            const requested = savedCharacterVoiceName(character);
            if (!requested || isGenericVoiceSlot(requested) || isBadVoiceName(requested))
                return "";
            const matched = findVoiceByRequestedName(app.voices || [], requested);
            if (
                !matched ||
                isBadVoiceName(matched.name) ||
                speechVoiceFailedThisSession(matched)
            )
                return "";
            if (!voiceMatchesCharacterGender(matched.name, character)) return "";
            return matched.name;
        }

        function resolvePersistentCharacterVoice(character = {}, name = "", options = {}) {
            if (!isPlainObject(character)) return "";
            loadVoices();
            const persist = options.persist !== false;
            const saved = availableSavedCharacterVoice(character);
            if (saved) {
                const changed = persist
                    ? updateOwnedRuntimeCharacter(character, name, (target) =>
                          setRuntimeCharacterVoice(target, saved),
                      )
                    : setRuntimeCharacterVoice(character, saved);
                if (changed && persist) scheduleActiveGameSave();
                return saved;
            }
            const isPlayer = character === app.state.player;
            const replacement = isPlayer
                ? defaultPlayerVoiceForGender(character.gender)
                : randomAvailableCharacterVoice(character.gender);
            if (!replacement) return "";
            const changed = persist
                ? updateOwnedRuntimeCharacter(character, name, (target) =>
                      setRuntimeCharacterVoice(target, replacement),
                  )
                : setRuntimeCharacterVoice(character, replacement);
            if (changed && persist) scheduleActiveGameSave();
            return replacement;
        }

        function voiceNameMatchesRequest(name = "", requested = "") {
            const voiceName = String(name || "").trim();
            const request = String(requested || "").trim();
            if (!voiceName || !request) return false;
            if (voiceName === request) return true;
            const lowerName = voiceName.toLowerCase();
            const lowerRequest = request.toLowerCase();
            if (lowerName.includes(lowerRequest)) return true;
            const requestWords = lowerRequest
                .replace(/\bmicrosoft\b/g, "")
                .split(/[^a-z0-9]+/i)
                .filter(Boolean);
            if (!requestWords.length) return false;
            let index = 0;
            for (const word of requestWords) {
                index = lowerName.indexOf(word, index);
                if (index < 0) return false;
                index += word.length;
            }
            return true;
        }

        function findVoiceByRequestedName(voices = [], requested = "") {
            const request = String(requested || "").trim();
            if (!request) return null;
            const exactMatches = voices.filter((voice) => voice.name === request);
            const fuzzyMatches = voices.filter((voice) =>
                voiceNameMatchesRequest(voice.name, request),
            );
            return (
                exactMatches.find((voice) => !isBadVoiceName(voice.name)) ||
                fuzzyMatches.find((voice) => !isBadVoiceName(voice.name)) ||
                exactMatches[0] ||
                fuzzyMatches[0] ||
                null
            );
        }

        function voiceBrowserKind() {
            const ua = String(globalThis.navigator?.userAgent || "");
            if (/\bEdg\//.test(ua)) return "edge";
            if (/\bFirefox\//.test(ua)) return "firefox";
            if (/\bChrome\/|\bCriOS\//.test(ua)) return "chrome";
            if (/\bSafari\//.test(ua)) return "safari";
            return "generic";
        }

        function voiceFallbackRole(slot = "", gender = "") {
            const normalized = normalizedCharacterGender(gender);
            if (normalized === "male" || normalized === "female") return normalized;
            const slotRoles = {
                defaultMalePlayerVoiceName: "male",
                defaultNonMalePlayerVoiceName: "female",
            };
            if (slotRoles[slot]) return slotRoles[slot];
            return "narrator";
        }

        function browserVoiceFallbackNames(role = "narrator", browserKind = voiceBrowserKind()) {
            const kind = VOICE_BROWSER_FALLBACKS[browserKind]
                ? browserKind
                : "generic";
            return [
                ...(VOICE_BROWSER_FALLBACKS[kind]?.[role] || []),
                ...(kind === "generic" ? [] : VOICE_BROWSER_FALLBACKS.generic?.[role] || []),
            ];
        }

        function firstUsableVoice(voices = []) {
            return (
                voices.find((voice) => isEnglishVoice(voice) && !isBadVoiceName(voice.name)) ||
                voices.find((voice) => !isBadVoiceName(voice.name)) ||
                null
            );
        }

        function bestCompatibleVoice({
            voices = app.voices || [],
            requested = "",
            slot = "Narrator",
            gender = "",
            browserKind = voiceBrowserKind(),
        } = {}) {
            const available = (Array.isArray(voices) ? voices : []).filter(
                (voice) => !speechVoiceFailedThisSession(voice),
            );
            const role = voiceFallbackRole(slot, gender);
            const requestedMatch = findVoiceByRequestedName(available, requested);
            if (requestedMatch && !isBadVoiceName(requestedMatch.name)) {
                const requestedGender = voiceGenderFromName(requestedMatch.name);
                if (
                    role === "narrator" ||
                    requestedGender === role ||
                    requestedGender === "unknown"
                )
                    return requestedMatch;
            }

            for (const name of browserVoiceFallbackNames(role, browserKind)) {
                const match = findVoiceByRequestedName(available, name);
                if (match && !isBadVoiceName(match.name)) return match;
            }

            const genderMatches =
                role === "male" || role === "female"
                    ? available.filter(
                          (voice) =>
                              voiceGenderFromName(voice.name) === role &&
                              !isBadVoiceName(voice.name),
                      )
                    : [];
            if (genderMatches.length) return genderMatches[0];
            return firstUsableVoice(available);
        }

        const canonicalDefaultVoiceNameCache = new Set(
            Object.values(CANONICAL_DEFAULT_VOICES || {}),
        );
        function canonicalDefaultVoiceShortNames() {
            return canonicalDefaultVoiceNameCache;
        }

        function isCanonicalDefaultVoiceRequest(name = "") {
            const request = String(name || "").trim();
            if (!request) return false;
            return [...canonicalDefaultVoiceShortNames()].some((defaultName) =>
                voiceNameMatchesRequest(request, defaultName),
            );
        }

        function isAllowedCanonicalDefaultVoiceName(name = "") {
            const lower = String(name || "").toLowerCase();
            if (/multilingual/.test(lower)) return false;
            return [...canonicalDefaultVoiceShortNames()].some((defaultName) =>
                voiceNameMatchesRequest(name, defaultName),
            );
        }

        function selectedVoiceMatchesGender(voices = [], selected = "", desired = "") {
            return voices.find(
                (voice) =>
                    voiceNameMatchesRequest(voice.name, selected) &&
                    voiceGenderFromName(voice.name) === desired,
            );
        }

        function resolveVoiceName(value = "", slot = "Narrator") {
            const requested = String(value || "").trim();
            const voices = visibleVoices(requested);
            const matched = findVoiceByRequestedName(voices, requested);
            if (
                requested &&
                !isGenericVoiceSlot(requested) &&
                !isBadVoiceName(matched?.name || requested) &&
                (!voices.length || matched)
            )
                return matched?.name || requested;

            return bestCompatibleVoice({
                voices,
                requested,
                slot,
            })?.name || "";
        }

        function resolveCharacterVoiceName(value = "", character = {}, name = "") {
            const requested = String(value || "").trim();
            const gender = normalizedCharacterGender(character?.gender);
            const voices = availableAllowedCharacterVoices(gender);
            const matched = findVoiceByRequestedName(voices, requested);
            if (
                requested &&
                !isGenericVoiceSlot(requested) &&
                !isBadVoiceName(matched?.name || requested) &&
                matched &&
                voiceMatchesCharacterGender(matched.name, character)
            )
                return matched.name;

            return randomAvailableCharacterVoice(gender);
        }

        function defaultVoiceForGender(gender = "", requested = "") {
            //Kept as a narrow compatibility wrapper for creation paths that still
            //need an immediately selectable character voice. Character playback
            //persists this result on first use instead of relying on a global default.
            return randomAvailableCharacterVoice(gender);
        }

        function defaultPlayerVoiceForGender(gender = "", requested = "") {
            const normalized = normalizedCharacterGender(gender);
            const isMale = normalized === "male";
            const key = isMale
                ? "defaultMalePlayerVoiceName"
                : "defaultNonMalePlayerVoiceName";
            const candidate = String(requested || app.settings[key] || "").trim();
            const voices = visibleVoicesForGender(isMale ? "male" : "female", candidate);
            const matched = findVoiceByRequestedName(voices, candidate);

            if (
                candidate &&
                !isGenericVoiceSlot(candidate) &&
                !isBadVoiceName(matched?.name || candidate) &&
                (!voices.length || matched)
            ) {
                return matched?.name || candidate;
            }

            return bestCompatibleVoice({
                voices,
                requested: candidate,
                slot: key,
                gender: isMale ? "male" : "female",
            })?.name || "";
        }

        function pickVoice(slot, explicitName = "") {
            loadVoices();
            const s = app.settings;
            if (slot && !isGenericVoiceSlot(slot)) {
                const characterVoice = findVoiceByRequestedName(app.voices, slot);
                if (characterVoice && !isBadVoiceName(characterVoice.name))
                    return characterVoice;
            }
            const wanted = resolveVoiceName(explicitName || s.narratorVoiceName, slot);
            const explicit = findVoiceByRequestedName(app.voices, wanted);
            // Saved/requested voices can point at Microsoft David or another blocked
            // browser default. Do not let that selected value bypass the blacklist.
            if (explicit && !isBadVoiceName(explicit.name)) return explicit;

            return (
                bestCompatibleVoice({
                    voices: visibleVoices(wanted),
                    requested: wanted,
                    slot,
                }) ||
                firstUsableVoice(app.voices || []) ||
                null
            );
        }

        function isBadVoiceName(name) {
            return isBlacklistedVoiceName(name);
        }

        function isDefaultBlacklistedVoiceName(name = "") {
            const lower = String(name || "").toLowerCase();
            return DEFAULT_VOICE_BLACKLIST.some((bad) =>
                lower.includes(String(bad || "").toLowerCase()),
            );
        }

        function isBlacklistedVoiceName(name = "") {
            if (isAllowedCanonicalDefaultVoiceName(name)) return false;
            const lower = String(name || "").toLowerCase();
            if (/multilingual/.test(lower)) return true;
            return (app.settings.voiceBlacklist || []).some((bad) =>
                !isCanonicalDefaultVoiceRequest(bad) &&
                lower.includes(String(bad || "").toLowerCase()),
            );
        }

        function isGenericVoiceSlot(value) {
            return [
                "Narrator",
                "Feminine Lead",
                "Masculine Lead",
                "Default male player voice",
                "Default non-male player voice",
            ].includes(
                String(value || ""),
            );
        }

        function speakerExistsAsEntity(name = "") {
            const wanted = normalizeNameForMatch(name);
            if (!wanted) return false;
            if (isPlayerEntityName(name, app.state))
                return true;
            if (resolveExactCharacterDefinitionName(name, app.state, ""))
                return true;
            if (
                !!findDuplicateCharacterName(
                    name,
                    Object.keys(app.state.characters || {}),
                )
            )
                return true;
            return (
                !!findNpcInDirectory(app.state.npc_directory, name) ||
                !!findDuplicateCharacterName(name, allNpcNamesFromState(app.state))
            );
        }

        function extractTempSpeakers(source = {}) {
            const input = isPlainObject(source) ? source : {};
            const out = {};
            for (const [rawName, rawSpeaker] of Object.entries(input)) {
                if (!isPlainObject(rawSpeaker)) continue;
                const name = sanitizeSpeakerMetadataName(rawSpeaker.name || rawName);
                if (!name) continue;
                const gender = normalizeSpeakerGender(rawSpeaker.gender || "");
                out[name] = {
                    name,
                    gender,
                    voice: textSlot(rawSpeaker.voice, "") || randomVoiceForGender(gender),
                    first_seen_message_id: rawSpeaker.first_seen_message_id ?? null,
                };
            }
            return out;
        }

        function ensureTempSpeaker(name = "", gender = "neutral", messageId = null) {
            const speakerName = sanitizeSpeakerMetadataName(name);
            if (!speakerName || speakerExistsAsEntity(speakerName)) return null;
            app.state.temp_speakers ||= {};
            const existing = app.state.temp_speakers[speakerName];
            if (existing) {
                const nextGender = normalizeSpeakerGender(gender);
                if (existing.gender === "neutral" && nextGender !== "neutral")
                    existing.gender = nextGender;
                if (!existing.voice)
                    existing.voice =
                        defaultVoiceForKnownSpeakerGender(existing.gender) ||
                        randomVoiceForGender(existing.gender);
                return existing;
            }
            const normalizedGender = normalizeSpeakerGender(gender);
            const entry = {
                name: speakerName,
                gender: normalizedGender,
                voice:
                    defaultVoiceForKnownSpeakerGender(normalizedGender) ||
                    randomVoiceForGender(normalizedGender),
                first_seen_message_id: messageId,
            };
            app.state.temp_speakers[speakerName] = entry;
            return entry;
        }

        function defaultVoiceForKnownSpeakerGender(gender = "") {
            const normalized = normalizeSpeakerGender(gender);
            if (normalized === "male") return defaultVoiceForGender("male");
            if (normalized === "female") return defaultVoiceForGender("female");
            return "";
        }

        function randomVoiceForGender(gender = "neutral") {
            const normalized = normalizeSpeakerGender(gender);
            loadVoices();
            const voices =
                normalized === "male" || normalized === "female"
                    ? availableAllowedCharacterVoices(normalized)
                    : visibleVoices();
            const used = new Set([
                app.state.player?.voice,
                ...Object.values(app.state.characters || {}).map((c) => c?.voice),
                ...Object.values(app.state.temp_speakers || {}).map((c) => c?.voice),
            ].filter(Boolean));
            const candidates = voices.filter(
                (voice) => !isBadVoiceName(voice.name) && !used.has(voice.name),
            );
            const pool = candidates.length
                ? candidates
                : voices.filter((voice) => !isBadVoiceName(voice.name));
            if (pool.length)
                return pool[Math.floor(Math.random() * pool.length)].name;
            return normalized === "male" || normalized === "female"
                ? ""
                : resolveVoiceName(app.settings.narratorVoiceName, "Narrator");
        }

        function randomKnownVoiceForGender(gender = "neutral") {
            const normalized = normalizeSpeakerGender(gender);
            if (normalized !== "male" && normalized !== "female") return "";
            const voices = availableAllowedCharacterVoices(normalized);
            const used = new Set([
                app.state.player?.voice,
                ...Object.values(app.state.characters || {}).map((c) => c?.voice),
                ...Object.values(app.state.temp_speakers || {}).map((c) => c?.voice),
            ].filter(Boolean));
            const candidates = voices.filter(
                (voice) =>
                    !isBadVoiceName(voice.name) &&
                    voiceGenderFromName(voice.name) === normalized &&
                    !used.has(voice.name),
            );
            const pool = candidates.length
                ? candidates
                : voices.filter(
                      (voice) =>
                          !isBadVoiceName(voice.name) &&
                          voiceGenderFromName(voice.name) === normalized,
                  );
            if (pool.length)
                return pool[Math.floor(Math.random() * pool.length)].name;
            return "";
        }

        function normalizedCharacterGender(gender = "") {
            return canonicalCharacterGenderValue(gender) === "male" ? "male" : "female";
        }

        function canonicalCharacterGenderValue(gender = "") {
            const value = String(gender || "").trim();
            const key = value.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
            if (key === "male" || key === "trans male") return "male";
            return value;
        }

        function voiceMatchesCharacterGender(voiceName = "", character = {}) {
            const gender = normalizedCharacterGender(character?.gender);
            return voiceGenderFromName(voiceName) === gender;
        }

        function voiceGenderFromName(name = "") {
            const saved = app.settings?.voiceGenderMap?.[name];
            if (saved === "male" || saved === "female" || saved === "unknown")
                return saved;
            return "unknown";
        }


        function stableIndex(value, length) {
            let hash = 0;
            const text = String(value || "");
            for (let i = 0; i < text.length; i++)
                hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
            return length ? hash % length : 0;
        }



















































































































































































































































































        function jsonpRequest(url, params = {}) {
            return new Promise((resolve, reject) => {
                const callbackName = `__emberAdventuresJsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
                const script = document.createElement("script");
                const target = new URL(url);
                let finished = false;
                target.searchParams.set("callback", callbackName);
                for (const [key, value] of Object.entries(params)) {
                    target.searchParams.set(key, value);
                }
                const cleanup = () => {
                    finished = true;
                    delete window[callbackName];
                    script.remove();
                };
                window[callbackName] = (data) => {
                    if (finished) return;
                    cleanup();
                    resolve(data);
                };
                script.onerror = () => {
                    if (finished) return;
                    cleanup();
                    reject(new Error(`JSONP failed loading ${target.href}`));
                };
                script.src = target.href;
                document.head.appendChild(script);
            });
        }

        async function normalizeFetchResult(raw) {
            if (raw && typeof raw.text === "function") {
                const bodyText = await raw.text();
                return {
                    status: raw.status || 0,
                    bodyText,
                    async json() {
                        return bodyText ? JSON.parse(bodyText) : null;
                    },
                    async peekJson() {
                        try {
                            return bodyText ? JSON.parse(bodyText) : null;
                        } catch {
                            return bodyText;
                        }
                    },
                };
            }
            const data = raw?.data ?? raw?.body ?? raw?.response ?? raw;
            const bodyText =
                typeof data === "string" ? data : JSON.stringify(data ?? {});
            return {
                status: raw?.status || raw?.statusCode || 200,
                bodyText,
                async json() {
                    return typeof data === "string"
                        ? JSON.parse(data || "{}")
                        : (data ?? {});
                },
                async peekJson() {
                    return typeof data === "string"
                        ? tryJson(data) || data
                        : (data ?? {});
                },
            };
        }





































































        function sceneParticipantNames(state = app.state) {
            return [
                ...new Set([
                    "Player",
                    ...(state?.scene?.party_members_present || []),
                    ...(state?.scene?.npcs_present || []),
                ].filter(Boolean)),
            ];
        }

        function sceneParticipantEntities(state = app.state) {
            const entities = [];
            for (const name of sceneParticipantNames(state)) {
                if (isPlayerEntityName(name, state)) {
                    if (state.player) entities.push(state.player);
                    continue;
                }
                if (state.characters?.[name]) {
                    entities.push(state.characters[name]);
                    continue;
                }
                const npc = getNpcEntryFromState(state, name);
                if (npc?.full_character) entities.push(npc.full_character);
                else if (npc) entities.push(npc);
            }
            return entities;
        }








































































































































        //Direct AI output is the sole permissive structured-data boundary. This
        //repair must run before the repaired value enters canonical validation.
        function repairAiGeneratedState(state) {
            state =
                state && typeof state === "object"
                    ? state
                    : clone(defaultState);



            state.meta = {
                ...clone(defaultState.meta),
                ...(state.meta || {}),
                story_source: {
                    ...clone(defaultState.meta.story_source),
                    ...(state.meta?.story_source || {}),
                },
                genres: repairAiEntertainmentPreferences(state.meta?.genres || []),
            };
            delete state.meta.state_version;
            state.location = {
                ...clone(defaultState.location),
                ...extractLocation(state.location),
            };
            state.world_map = extractWorldMap(state.world_map, state);
            hydrateMissingLocationFromMap(state);
            ensureCurrentLocationLabel(state);
            state.time = {
                ...clone(defaultState.time),
                ...pickNumberSlots(state.time, [
                    "year",
                    "month",
                    "day",
                    "hour",
                    "minute",
                ]),
            };
            state.scene = {
                ...clone(defaultState.scene),
                ...extractScene(state.scene),
            };
            state.player = {
                ...clone(defaultState.player),
                ...extractPlayer(state.player, defaultState.player, {
                    allowMetadata: true,
                    allowPersonalityDescription: true,
                }),
            };
            state.player.personality_description ||= textSlot(
                state.player.personality,
                defaultState.player.personality_description,
            );
            state.player.source = entitySourceSlot(state.player.source);
            state.player.creator = entityCreatorSlot(state.player.creator);
            state.player.creation_tool = entityCreationToolSlot(
                state.player.creation_tool,
            );

            state.player.appearance = {
                ...clone(defaultState.player.appearance),
                ...(isPlainObject(state.player.appearance)
                    ? state.player.appearance
                    : {}),
            };
            state.player.appearance = repairAiBodyStatsObject(
                state.player.appearance,
            );
            state.player.clothing = {
                ...clone(defaultState.player.clothing),
                ...exactClothingSlots(
                    repairAiClothingAliases(state.player.clothing || {}),
                ),
            };
            state.player.outfits = repairAiOutfitList(state.player.outfits);
            state.player.fallback_name = textSlot(
                state.player.fallback_name,
                "",
            );
            if (!state.player.fallback_name) delete state.player.fallback_name;
            state.player.fallback_outfits = repairAiOutfitList(
                state.player.fallback_outfits,
            );
            if (!state.player.fallback_outfits.length)
                delete state.player.fallback_outfits;
            state.player.fallback_starting_outfit_id = textSlot(
                state.player.fallback_starting_outfit_id,
                "",
            );
            if (!state.player.fallback_starting_outfit_id)
                delete state.player.fallback_starting_outfit_id;
            if (
                state.player.active_outfit_id &&
                !state.player.outfits.some(
                    (outfit) => outfit.id === state.player.active_outfit_id,
                )
            )
                state.player.active_outfit_id = "";
            state.player.held_items = {
                ...clone(defaultState.player.held_items),
                ...(state.player.held_items || {}),
            };
            state.player.image = {
                ...clone(defaultState.player.image),
                ...(state.player.image || {}),
            };
            state.player.default_seed = repairAiProfileImageSeed(state.player.default_seed, 0);
            state.player.image_prompt_config = repairAiImagePromptConfig(
                state.player.image_prompt_config || state.player.image || { seed: 0 },
                state.player.default_seed,
            );
            if (state.player.default_profile_image != null)
                state.player.default_profile_image = profileImageSlotFromExactInput(
                    state.player.default_profile_image,
                );
            if (state.player.profile_image_presentations != null)
                state.player.profile_image_presentations =
                    createProfileImagePresentations(
                        state.player.profile_image_presentations,
                    );
            resolveActiveProfileImageReference(state.player);
            const playerOptions = storyTemplatePlayerOptions(state);
            if (playerOptions.length) {
                state.players = playerOptions.map((option) =>
                    materializeCharacterForRuntime(option.character, option.name, {
                        allowMetadata: true,
                    }),
                );
            } else {
                delete state.players;
            }
            state.world_flags = {
                ...clone(defaultState.world_flags),
                ...extractWorldFlags(state.world_flags),
            };
            state.progression = {};
            state.numeric_precision = numericPrecisionMaps(state.numeric_precision);
            state.objectives = extractObjectives(state.objectives, state);
            state.future_cast = repairAiFutureCast(state.future_cast);
            state.story_inventory = repairAiStoryInventory(state.story_inventory);
            state.reward_bundles = repairAiRewardBundles(state.reward_bundles);
            state.reward_templates = repairAiRewardTemplates(state.reward_templates);
            state.character_shop_cost_templates = repairAiCharacterShopCostTemplates(
                state.character_shop_cost_templates,
            );
            state.story_clock = repairAiStoryClock(state.story_clock);
            state.story_pacing = repairAiStoryPacing(state.story_pacing);
            state.timed_events = repairAiTimedEvents(state.timed_events);
            state.story_shops = repairAiStoryShops(state.story_shops);
            state.story_job_offers = repairAiStoryJobOffers(state.story_job_offers);
            state.story_job_offer_history = repairAiStoryJobOfferHistory(
                state.story_job_offer_history,
            );
            state.active_generated_jobs = repairAiActiveGeneratedJobs(
                state.active_generated_jobs,
            );
            state.story_generated_npc_pool = repairAiStoryGeneratedNpcPool(
                state.story_generated_npc_pool,
            );
            pruneRuntimeDuplicateFutureCast(state);
            state.story_rules = repairAiStoryRules(state.story_rules);
            delete state.story_flags;
            state.temp_speakers = extractTempSpeakers(state.temp_speakers);
            state.npc_directory = extractNpcDirectory(state.npc_directory, state);
            repairAiFutureCastBackedNpcShells(state);
            ensureSceneNpcDefinitions();
            state.story_memory = extractStoryMemory(state.story_memory);
            delete state.game_loop;
            state.characters ||= {};
            const cleanedCharacters = {};
            const seenCharacterNames = [...playerDuplicateNames(state)];
            for (const [name, c] of Object.entries(state.characters)) {
                const characterName = textSlot(c?.name, name);
                const normalizedCharacterName = normalizeNameForMatch(characterName);
                const exactDuplicate = seenCharacterNames.some(
                    (existingName) =>
                        normalizeNameForMatch(existingName) === normalizedCharacterName,
                );
                if (
                    isReservedStateLabelName(characterName) ||
                    isPlayerEntityName(characterName, state) ||
                    exactDuplicate
                )
                    continue;
                cleanedCharacters[characterName] = c;
                seenCharacterNames.push(characterName);
            }
            state.characters = cleanedCharacters;
            for (const [name, c] of Object.entries(state.characters)) {
                if (!c || typeof c !== "object")
                    state.characters[name] = blankCharacterTemplate(name);
                state.characters[name] = materializeCharacterDefinitionForRuntimeFields(
                    state.characters[name],
                    name,
                );
                const ch = state.characters[name];
                ch.gender ||= "unspecified";
                ch.age = repairAiAdultAge(
                    ch.age || ch.appearance?.age,
                    name,
                    ch.role,
                    "party character sanitize",
                );
                ch.role ||= "adult character";
                ch.relationship_to_player ||= "unknown";
                ch.personality_description ||= textSlot(
                    ch.personality,
                    `${name} is a distinct adult character whose deeper personality should remain consistent across scenes.`,
                );
                ch.trust = repairAiState10(ch.trust);
                ch.attraction = repairAiState10(ch.attraction);
                ch.affection = repairAiState10(ch.affection);
                ch.boldness = repairAiCharacterBoldness(
                    ch.boldness,
                    rollCharacterBoldness(),
                );
                ch.state_of_mind ||= "neutral";
                ch.physical_state ||= "normal";
                ch.pose ||= "standing";
                const rawAppearance = isPlainObject(ch.appearance)
                    ? ch.appearance
                    : {
                          extra_description:
                              typeof ch.appearance === "string"
                                  ? ch.appearance
                                  : "",
                      };
                ch.appearance = {
                    ...blankAppearanceTemplate(),
                    ...rawAppearance,
                };
                ch.appearance = repairAiBodyStatsObject(ch.appearance);
                ch.clothing = {
                    ...blankClothingTemplate(),
                    ...exactClothingSlots(repairAiClothingAliases(ch.clothing || {})),
                };
                ch.outfits = repairAiOutfitList(ch.outfits);
                if (
                    ch.active_outfit_id &&
                    !ch.outfits.some((outfit) => outfit.id === ch.active_outfit_id)
                )
                    ch.active_outfit_id = "";
                ch.held_items = {
                    right_hand: null,
                    left_hand: null,
                    ...(ch.held_items || {}),
                };
                ch.inventory = exactInventoryList(ch.inventory);
                ch.known_facts = Array.isArray(ch.known_facts)
                    ? ch.known_facts
                    : [];
                ch.image = {
                    seed_enabled: true,
                    seed: Math.floor(Math.random() * 999999),
                    style: "high detail fantasy RPG art",
                    negative: "",
                    ...(ch.image || {}),
                };
                if (ch.image.seed == null || ch.image.seed === "")
                    ch.image.seed = 0;
                ch.default_seed = repairAiProfileImageSeed(ch.default_seed, 0);
                ch.image_prompt_config = repairAiImagePromptConfig(
                    ch.image_prompt_config || ch.image || { seed: 0 },
                    ch.default_seed,
                );
                if (ch.default_profile_image != null)
                    ch.default_profile_image = profileImageSlotFromExactInput(
                        ch.default_profile_image,
                    );
                resolveActiveProfileImageReference(ch);
            }
            delete state.player.trust;
            delete state.player.attract;
            delete state.player.affect;
            delete state.player.attraction;
            delete state.player.affection;
            for (const location of Object.values(
                state.npc_directory?.locations || {},
            )) {
                if (!location?.characters) continue;
                for (const name of Object.keys(location.characters)) {
                    const npc = location.characters[name];
                    const allowFutureCast =
                        npcIsFutureCastBacked(npc, state) ||
                        npcIsFutureCastBacked({ ...npc, name }, state);
                    if (
                        isInvalidStoredNpcName(name, state, { allowFutureCast }) ||
                        isInvalidStoredNpcName(npc?.name, state, { allowFutureCast })
                    )
                        delete location.characters[name];
                }
            }

            if (app.enforceSoloOpening) {
                state.characters = {};
                state.scene ||= {};
                if (app.preserveSoloOpeningSceneNpcs) {
                    state.scene.party_members_present = [
                        ...new Set(state.scene.party_members_present || []),
                    ];
                    state.scene.image_characters = [
                        ...new Set(
                            state.scene.image_characters || [playerEntityDisplayName(state)],
                        ),
                    ];
                    replaceSceneNpcPresence(
                        state,
                        [...new Set(state.scene.npcs_present || [])].filter(
                            (name) => name && !isPlayerEntityName(name, state),
                        ),
                        "solo opening NPC preservation",
                    );
                } else {
                    state.scene.party_members_present = [];
                    state.scene.image_characters = [playerEntityDisplayName(state)];
                    replaceSceneNpcPresence(state, [], "solo opening enforced");
                }
            }
            const names = Object.keys(state.characters || {});
            const npcNames = allNpcNamesFromState(state);
            const entityNames = [...names, ...npcNames];
            const imageEligibleNames = [
                playerEntityDisplayName(state),
                ...names,
                ...npcNames.filter((name) => imageEntityFromState(name, state)),
            ];
            const repairAiSceneEntityList = (list, allowedNames) =>
                Array.isArray(list)
                    ? [
                          ...new Set(
                              list
                                  .map((n) => resolveEntityName(n, state, ""))
                                  .map((n) =>
                                      isPlayerEntityName(n, state)
                                          ? playerEntityDisplayName(state)
                                          : n,
                                  )
                                  .filter((n) => allowedNames.includes(n)),
                          ),
                      ]
                    : [];
            state.scene.party_members_present = Array.isArray(
                state.scene.party_members_present,
            )
                ? repairAiSceneEntityList(state.scene.party_members_present, entityNames)
                : [];
            state.scene.image_characters = Array.isArray(
                state.scene.image_characters,
            )
                ? repairAiSceneEntityList(state.scene.image_characters, imageEligibleNames)
                : [];
            if (!state.scene.image_characters.length)
                state.scene.image_characters = imageEligibleNames.includes(
                    state.scene.party_members_present[0],
                )
                    ? [state.scene.party_members_present[0]]
                    : [playerEntityDisplayName(state)];
            replaceSceneNpcPresence(
                state,
                repairAiSceneEntityList(state.scene.npcs_present, npcNames).filter((name) =>
                    isValidNearbyNpcName(name, state),
                ),
                "AI state repair",
            );
            pruneUnsupportedSceneFields(state.scene);
            state.player.age = repairAiAdultAge(
                state.player.age,
                state.player.name,
                state.player.role,
                "player sanitize",
            );
            state.player.inventory = exactInventoryList(state.player.inventory);
            state.player.known_facts = Array.isArray(state.player.known_facts)
                ? state.player.known_facts
                : [];
            // The player is always present in normal EmberAdventures play, but is
            // intentionally tracked separately from scene/NPC lists so AI does
            // not treat the player as a writable character.
            delete state.scene.player_present;
            delete state.scene.image_includes_player;
            state.recent_changes = Array.isArray(state.recent_changes)
                ? state.recent_changes.slice(0, 8)
                : [];
            reconcileStoryRuntimeState(state, "sanitize");
            return state;
        }
