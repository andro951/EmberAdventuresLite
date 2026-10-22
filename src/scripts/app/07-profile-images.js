
        function autosizeLibraryCardText(rootNode = document) {
            const root = rootNode || document;
            const lines = [...(root.querySelectorAll?.("[data-library-fit-text]") || [])];
            const canvas = autosizeLibraryCardText.canvas ||
                (autosizeLibraryCardText.canvas = document.createElement("canvas"));
            const context = canvas.getContext("2d");
            const measurements = [];
            for (const line of lines) {
                if (!line.isConnected || line.offsetParent === null) continue;
                const available = line.parentElement?.clientWidth || line.clientWidth || 0;
                if (!available || !context) continue;
                const style = getComputedStyle(line);
                const base = Number(line.dataset.libraryBaseFontSize) ||
                    parseFloat(style.fontSize) ||
                    14;
                line.dataset.libraryBaseFontSize = String(base);
                context.font = `${style.fontStyle} ${style.fontWeight} ${base}px ${style.fontFamily}`;
                const needed = context.measureText(line.textContent || "").width || available;
                const next = needed > available ? Math.max(7, base * (available / needed)) : base;
                measurements.push({
                    line,
                    fontSize: `${Math.min(base, next)}px`,
                });
            }
            for (const measurement of measurements)
                measurement.line.style.fontSize = measurement.fontSize;
            autosizeStoryTitleCardOverlayText(root);
        }

        function autosizeStoryTitleCardOverlayText(rootNode = document) {
            const root = rootNode || document;
            const titles = [...(root.querySelectorAll?.(
                ".story-title-card-overlay-text, .story-library-card-title-text",
            ) || [])].filter(
                (title) => title.isConnected && title.offsetParent !== null,
            );
            for (const title of titles) {
                // Container-query units already scale these titles. Clamp line count
                // instead of forcing up to 24 synchronous layout passes per card.
                title.style.removeProperty("width");
                title.style.removeProperty("font-size");
                title.style.display = "-webkit-box";
                title.style.webkitBoxOrient = "vertical";
                title.style.webkitLineClamp = title.classList.contains(
                    "story-title-card-overlay-text",
                ) ? "3" : "2";
                title.style.overflow = "hidden";
            }
        }

        function scheduleAutosizeLibraryCardText(rootNode = document) {
            const root = rootNode || document;
            if (app.libraryCardAutosizeFrame) {
                if (app.libraryCardAutosizeRoot !== root)
                    app.libraryCardAutosizeRoot = document;
                return;
            }
            app.libraryCardAutosizeRoot = root;
            app.libraryCardAutosizeFrame = requestAnimationFrame(() => {
                const scheduledRoot = app.libraryCardAutosizeRoot || document;
                app.libraryCardAutosizeFrame = 0;
                app.libraryCardAutosizeRoot = null;
                autosizeLibraryCardText(scheduledRoot);
            });
        }

        const PROFILE_IMAGE_RECORD_FIELDS = Object.freeze([
            "id", "saveId", "at", "source", "model", "seed", "prompt",
            "negativePrompt", "owner_name", "character_id", "male",
            "source_image_id", "profile", "favorite",
            "html", "pending", "error", "hosted_url", "hosted_at", "hosted_size",
            "crop", "replaced_by", "replaced_reason",
        ]);
        const PROFILE_IMAGE_REQUIRED_FIELDS = Object.freeze(
            PROFILE_IMAGE_RECORD_FIELDS.filter(
                (field) => !["replaced_by", "replaced_reason"].includes(field),
            ),
        );

        function validateProfileImageStore(images) {
            const errors = [];
            if (!Array.isArray(images))
                return validationResult([
                    validationError("profileImages", "type", "profileImages must be an array."),
                ]);
            const ids = new Set();
            images.forEach((image, index) => {
                const path = `profileImages.${index}`;
                errors.push(
                    ...exactObjectFieldValidationErrors(image, PROFILE_IMAGE_RECORD_FIELDS, path),
                    ...requiredExactFieldsValidationErrors(image, PROFILE_IMAGE_REQUIRED_FIELDS, path),
                );
                if (!isPlainObject(image)) return;
                if (typeof image.id !== "string" || !image.id)
                    errors.push(validationError(`${path}.id`, "required", `${path}.id must be non-empty text.`));
                else if (ids.has(image.id))
                    errors.push(validationError(`${path}.id`, "duplicate", `Duplicate profile image id ${image.id}.`));
                ids.add(image.id);
                if (typeof image.character_id !== "string" || !image.character_id)
                    errors.push(validationError(`${path}.character_id`, "required", `${path}.character_id must be non-empty text.`));
                for (const field of ["saveId", "at", "source", "model", "prompt", "negativePrompt", "owner_name", "character_id", "source_image_id", "html", "error", "hosted_url", "hosted_at"])
                    if (typeof image[field] !== "string")
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
                for (const field of ["profile", "favorite", "pending"])
                    if (typeof image[field] !== "boolean")
                        errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be a boolean.`));
                if (image.male !== null && typeof image.male !== "boolean")
                    errors.push(validationError(`${path}.male`, "type", `${path}.male must be a boolean or null.`));
                if (!Number.isSafeInteger(image.hosted_size) || image.hosted_size < 0)
                    errors.push(validationError(`${path}.hosted_size`, "type", `${path}.hosted_size must be a non-negative safe integer.`));
                if (image.crop !== null && !isPlainObject(image.crop))
                    errors.push(validationError(`${path}.crop`, "type", `${path}.crop must be an object or null.`));
            });
            return validationResult(errors);
        }

        function exactProfileImageStore(images) {
            const validation = validateProfileImageStore(images);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(images);
        }

        function profileStoreImageById(id) {
            const wanted = String(id || "");
            if (!wanted) return null;
            return (app.profileImages || []).find(
                (image) => String(image.id) === wanted,
            ) || null;
        }

        function upsertProfileStoreImage(image, ownerName = "", options = {}) {
            const source = exactProfileImageStore([image])[0];
            const record = {
                ...source,
                owner_name: ownerName || source.owner_name,
            };
            // Profile image rule: reusable character portraits are shared by
            // character identity, not by save. Normal scene images are save-owned;
            // profile image history remains in the shared profile-image store.
            record.saveId = "";
            app.profileImages ||= [];
            const index = app.profileImages.findIndex(
                (item) => String(item.id) === String(record.id),
            );
            if (index >= 0) app.profileImages[index] = { ...app.profileImages[index], ...record };
            else app.profileImages.unshift(record);
            app.profileImages = exactProfileImageStore(app.profileImages);
            app.profileImageResolutionEpoch =
                (Number(app.profileImageResolutionEpoch) || 0) + 1;
            const stored = profileStoreImageById(record.id);
            if (options.save !== false && stored) saveProfileImageRecordsNow([stored], "profile image history changed");
            return stored;
        }

        function profileImageOwnerNameForHandle(name, entity = profileEntity(name)) {
            const displayName = profileDisplayName(name);
            const entityName = String(entity?.name || "").trim();
            // Profile image ownership rule: "Player" is only the UI handle for
            // app.state.player. It must never be used as a reusable portrait
            // owner, or one story's player portrait can leak into another story.
            return String(name || "") === "Player"
                ? entityName || displayName || ""
                : entityName || displayName || String(name || "").trim();
        }

        function profileImageEntityRecord(image) {
            if (!isPlainObject(image))
                throw new Error("Profile image reference must be an object.");
            if (Object.hasOwn(image, "html")) {
                const record = exactProfileImageStore([image])[0];
                delete record.html;
                return record;
            }
            const fields = PROFILE_IMAGE_RECORD_FIELDS.filter((field) => field !== "html");
            const required = PROFILE_IMAGE_REQUIRED_FIELDS.filter((field) => field !== "html");
            const path = "profile image reference";
            const errors = [
                ...exactObjectFieldValidationErrors(image, fields, path),
                ...requiredExactFieldsValidationErrors(image, required, path),
            ];
            if (errors.length)
                throw new Error(validationErrorsText(validationResult(errors)));
            return clone(image);
        }

        function replaceEmbeddedProfileImageRecord(entity, image) {
            if (!Array.isArray(entity?.profile_images)) return;
            const record = profileImageEntityRecord(image);
            entity.profile_images = entity.profile_images.map((item) =>
                String(item.id) === String(record.id) ? record : item,
            );
        }

        function profileImagesForEntity(entity, options = {}) {
            if (options.validateActive !== false)
                resolveActiveProfileImageReference(entity);
            const runtimeImages = Array.isArray(entity?.profile_images);
            const referenceImages = isPlainObject(entity?.profile_images);
            const exactCharacterId = String(entity?.id || "").trim();
            // A clean definition may have only the explicit default pointer;
            // keep that pointer available during reload recovery even when a
            // presentation field is incomplete. The active-image filter
            // below still enforces the entity's current presentation.
            const defaultLocalId =
                defaultProfileLocalImageId(entity) ||
                configuredDefaultProfileLocalImageId(entity);
            const activeLocalId = runtimeImages
                ? entity.profile_image_id
                : referenceImages
                  ? entity.profile_images.active_image_id
                  : "";
            const embeddedImages = runtimeImages
                ? entity.profile_images
                : referenceImages
                  ? entity.profile_images.image_ids.map((id) => profileStoreImageById(id))
                  : [];
            const refs = [
                defaultLocalId ? profileImageByStoreId(defaultLocalId) : null,
                activeLocalId ? profileImageByStoreId(activeLocalId) : null,
                ...embeddedImages,
                ...(app.profileImages || []).filter((image) =>
                    exactCharacterId &&
                    String(image.character_id || image.characterId || "").trim() ===
                        exactCharacterId,
                ),
            ].filter(Boolean);
            return refs
                .map((image) => ({
                    ...image,
                    ...(profileStoreImageById(image.id) || {}),
                }))
                .filter(
                    (image, index, all) =>
                        image?.id &&
                        all.findIndex((other) => String(other.id) === String(image.id)) ===
                            index,
                )
                .filter(
                    (image) =>
                        image?.id &&
                        !app.deletedProfileImageIds?.has?.(String(image.id)),
                );
        }

        function profileImageMalePresentation(entity = {}) {
            return normalizedCharacterGender(entity?.gender) === "male";
        }

        function profileImageMatchesPresentation(image, entity = {}) {
            return (
                typeof image?.male === "boolean" &&
                image.male === profileImageMalePresentation(entity)
            );
        }

        // A presentation change or deleted image can leave an invalid active
        // pointer on a runtime character or projected library presentation.
        // Strict lookup remains non-mutating; automatic recovery paths call
        // this before resolving the image.
        function clearInvalidRuntimeProfileImagePointer(entity) {
            if (!isPlainObject(entity) || !entity.profile_image_id) return false;
            const activeId = String(entity.profile_image_id);
            const active =
                (Array.isArray(entity.profile_images)
                    ? entity.profile_images.find(
                          (image) => String(image?.id) === activeId,
                      )
                    : null) ||
                profileStoreImageById(activeId);
            if (active && profileImageMatchesPresentation(active, entity)) return false;
            entity.profile_image_id = "";
            devTestLog("Cleared invalid runtime profile image pointer", {
                characterId: entity.id || entity.character_id || "",
                characterName: entity.name || "",
                staleImageId: activeId,
                staleMale: typeof active?.male === "boolean" ? active.male : null,
                currentMale: profileImageMalePresentation(entity),
                reason: active ? "wrong presentation" : "missing image",
            });
            return true;
        }

        function profileImagesForActivePresentation(entity) {
            return profileImagesForEntity(entity).filter((image) =>
                profileImageMatchesPresentation(image, entity),
            );
        }

        function createProfileImagePresentations(value = {}) {
            if (!isPlainObject(value))
                throw new Error("profile_image_presentations must be an object.");
            const male = Object.hasOwn(value, "male")
                ? profileImageSlotFromExactInput(value.male)
                : emptyProfileImageSlot(true);
            const nonMale = Object.hasOwn(value, "non_male")
                ? profileImageSlotFromExactInput(value.non_male)
                : emptyProfileImageSlot(false);
            male.male = true;
            nonMale.male = false;
            return { male, non_male: nonMale };
        }

        function defaultProfileImageSlotIsConfigured(slot = {}) {
            const clean = profileImageSlotFromExactInput(slot);
            return defaultProfileImageSlotHasRealReference(clean);
        }

        function defaultProfileImageSlotIsPlaceholder(slot = {}) {
            const clean = profileImageSlotFromExactInput(slot);
            const source = String(clean.source || "").trim().toLowerCase();
            const note = String(clean.note || "").trim().toLowerCase();
            return (
                source === "placeholder" ||
                source === "fake placeholder" ||
                note.includes("temporary transparent placeholder")
            );
        }

        function smokeProfilePlaceholdersAllowed() {
            return !!(
                devSmokeSuiteState().running ||
                devCurrentSmokeScenarioToken()
            );
        }

        function defaultProfileImageSlotHasRealReference(slot = {}) {
            const clean = profileImageSlotFromExactInput(slot);
            if (defaultProfileImageSlotIsPlaceholder(clean))
                return smokeProfilePlaceholdersAllowed() &&
                    !!(clean.url || clean.local_image_id);
            return !!(clean.url || clean.local_image_id);
        }

        function profileImageRecordIsPlaceholder(image = {}) {
            if (!image || typeof image !== "object") return false;
            const source = String(image.source || "").trim().toLowerCase();
            const note = String(image.note || "").trim().toLowerCase();
            return (
                source === "placeholder" ||
                source === "fake placeholder" ||
                note.includes("temporary transparent placeholder")
            );
        }

        function profileImageRecordIsBlockedPlaceholder(image = {}) {
            return profileImageRecordIsPlaceholder(image) &&
                !smokeProfilePlaceholdersAllowed();
        }

        function defaultProfileImagePlaceholderIssue(slot = {}, label = "profile image") {
            if (!isPlainObject(slot) || smokeProfilePlaceholdersAllowed())
                return "";
            const source = String(slot.source || "").trim().toLowerCase();
            const note = String(slot.note || "").trim().toLowerCase();
            if (
                source !== "placeholder" &&
                source !== "fake placeholder" &&
                !note.includes("temporary transparent placeholder")
            )
                return "";
            return `${label} uses placeholder image data. Use null/blank for missing images or a real image reference.`;
        }

        function profileImagePresentationSlot(entity = {}, male = false) {
            const presentations = createProfileImagePresentations(
                entity?.profile_image_presentations,
            );
            const explicit = male ? presentations.male : presentations.non_male;
            if (defaultProfileImageSlotHasRealReference(explicit)) return explicit;
            const fallback = profileImageSlotFromExactInput(entity?.default_profile_image);
            return fallback.male === male && defaultProfileImageSlotHasRealReference(fallback)
                ? fallback
                : explicit;
        }

        function profileImagesForPresentation(entity = {}, male = false) {
            return profileImagesForEntity(entity).filter(
                (image) => typeof image?.male === "boolean" && image.male === male,
            );
        }

        function profileImageReferencesForState(state = app.state) {
            const cached = app.profileImageReferenceCache;
            if (
                state === app.state &&
                cached?.state === state &&
                cached.revision === app.profileImageReferenceRevision
            )
                return cached.refs;
            const refs = { ids: new Set(), owners: new Set() };
            const addOwner = (name) => {
                const value = String(name || "").trim();
                if (value) refs.owners.add(value);
            };
            const visit = (value, ownerName = "") => {
                if (!value || typeof value !== "object") return;
                if (Array.isArray(value)) {
                    for (const item of value) visit(item, ownerName);
                    return;
                }
                const nextOwner = String(value.name || ownerName || "").trim();
                addOwner(nextOwner);
                const lists = [
                    ...(Array.isArray(value.profile_images) ? value.profile_images : []),
                    ...(Array.isArray(value.profile_images_list)
                        ? value.profile_images_list
                        : []),
                ];
                for (const image of lists) {
                    if (image?.id != null) refs.ids.add(String(image.id));
                    addOwner(image?.owner_name || nextOwner);
                }
                for (const child of Object.values(value)) visit(child, nextOwner);
            };
            addOwner(state?.player?.name);
            for (const name of Object.keys(state?.characters || {})) addOwner(name);
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [name, npc] of Object.entries(location?.characters || {})) {
                    addOwner(name);
                    addOwner(npc?.name);
                    addOwner(npc?.full_character?.name);
                }
            }
            visit(state);
            if (state === app.state) {
                app.profileImageReferenceCache = {
                    state,
                    revision: app.profileImageReferenceRevision,
                    refs,
                };
            }
            return refs;
        }

        function profileImagesForState(state = app.state, images = []) {
            const refs = profileImageReferencesForState(state);
            return (Array.isArray(images) ? images : []).filter((image) => {
                if (!image) return false;
                const id = String(image.id || "");
                return id && refs.ids.has(id);
            });
        }

        function stripEmbeddedProfileImageHtml(value) {
            if (!value || typeof value !== "object") return value;
            if (Array.isArray(value)) {
                value.forEach(stripEmbeddedProfileImageHtml);
                return value;
            }
            if (Array.isArray(value.profile_images)) {
                value.profile_images = value.profile_images
                    .map(profileImageEntityRecord)
                    .filter(Boolean);
            }
            if (Array.isArray(value.profile_images_list)) {
                value.profile_images_list = value.profile_images_list
                    .map(profileImageEntityRecord)
                    .filter(Boolean);
            }
            for (const child of Object.values(value)) stripEmbeddedProfileImageHtml(child);
            return value;
        }

        function repairAiRuntimeProfileImages(images, characterId) {
            if (!Array.isArray(images)) return [];
            return images
                .filter(isPlainObject)
                .map((image) => profileImageEntityRecord(createProfileImageRecord({
                    ...image,
                    character_id: characterId,
                })));
        }

        function resolveActiveProfileImageReference(entity) {
            if (!isPlainObject(entity))
                throw new Error("Runtime character must be an object before resolving a profile image.");
            // Immutable character definitions do not own runtime image references.
            // Their shared images are resolved by character identity instead.
            if (!Object.hasOwn(entity, "profile_images")) return;
            const runtimeImages = Array.isArray(entity.profile_images);
            if (!runtimeImages && !isPlainObject(entity.profile_images))
                throw new Error(`${entity.name || "Character"}.profile_images must be an exact image-reference object or runtime array.`);
            if (!runtimeImages) {
                const errors = [
                    ...exactObjectFieldValidationErrors(
                        entity.profile_images,
                        CHARACTER_IMAGE_COLLECTION_FIELDS,
                        `${entity.name || "Character"}.profile_images`,
                    ),
                    ...requiredExactFieldsValidationErrors(
                        entity.profile_images,
                        CHARACTER_IMAGE_COLLECTION_FIELDS,
                        `${entity.name || "Character"}.profile_images`,
                    ),
                ];
                if (typeof entity.profile_images.active_image_id !== "string")
                    errors.push(validationError("profile_images.active_image_id", "type", "profile_images.active_image_id must be text."));
                if (!Array.isArray(entity.profile_images.image_ids) || entity.profile_images.image_ids.some((id) => typeof id !== "string" || !id))
                    errors.push(validationError("profile_images.image_ids", "type", "profile_images.image_ids must contain only non-empty text ids."));
                if (new Set(entity.profile_images.image_ids || []).size !== (entity.profile_images.image_ids || []).length)
                    errors.push(validationError("profile_images.image_ids", "duplicate", "profile_images.image_ids cannot contain duplicates."));
                if (errors.length) throw new Error(validationErrorsText(validationResult(errors)));
                if (
                    entity.profile_images.active_image_id &&
                    !entity.profile_images.image_ids.includes(entity.profile_images.active_image_id)
                )
                    throw new Error("profile_images.active_image_id must reference profile_images.image_ids.");
                return;
            }
            if (typeof entity.profile_image_id !== "string")
                throw new Error(`${entity.name || "Runtime character"}.profile_image_id must be text.`);
            const ids = new Set();
            for (let index = 0; index < entity.profile_images.length; index++) {
                const image = entity.profile_images[index];
                if (!isPlainObject(image) || typeof image.id !== "string" || !image.id)
                    throw new Error(`${entity.name || "Runtime character"}.profile_images.${index}.id must be non-empty text.`);
                if (ids.has(image.id))
                    throw new Error(`${entity.name || "Runtime character"}.profile_images.${index}.id duplicates ${image.id}.`);
                ids.add(image.id);
            }
            if (!entity.profile_image_id) return;
            const active = entity.profile_images.find(
                (image) => image.id === entity.profile_image_id,
            ) || profileStoreImageById(entity.profile_image_id);
            if (!active)
                throw new Error(`${entity.name || "Runtime character"}.profile_image_id references a missing image.`);
            if (!profileImageMatchesPresentation(active, entity))
                throw new Error(`${entity.name || "Runtime character"}.profile_image_id references the wrong gender presentation.`);
        }

        const activeProfileImageResolutionCache = new WeakMap();

        function activeProfileImageCacheToken(entity = {}) {
            return [
                app.profileImageResolutionEpoch || 0,
                (app.profileImages || []).length,
                entity.name || "",
                entity.gender || "",
                entity.profile_image_id || "",
                (entity.profile_images || []).length,
            ].join("|");
        }

        function activeProfileImage(entity) {
            const start = perfNow();
            if (!entity || typeof entity !== "object") return null;
            const cacheToken = activeProfileImageCacheToken(entity);
            const cached = activeProfileImageResolutionCache.get(entity);
            if (cached?.token === cacheToken) return cached.result;
            resolveActiveProfileImageReference(entity);
            const images = profileImagesForActivePresentation(entity);
            const newestFinished = newestProfileImage(
                images.filter(profileImageIsFinished),
            );
            const newestPending = newestProfileImage(
                images.filter(
                    (image) => image.pending && !image.error,
                ),
            );
            const result = (
                images.find(
                    (image) =>
                        String(image.id) === String(entity.profile_image_id) &&
                        profileImageMatchesPresentation(image, entity) &&
                        (profileImageIsFinished(image) || image.error),
                ) ||
                newestFinished ||
                images.find(
                    (image) =>
                        String(image.id) === String(entity.profile_image_id) &&
                        profileImageMatchesPresentation(image, entity) &&
                        image.pending &&
                        !image.error,
                ) ||
                newestPending ||
                null
            );
            activeProfileImageResolutionCache.set(entity, {
                token: activeProfileImageCacheToken(entity),
                result,
            });
            const ms = perfNow() - start;
            if (ms >= 10)
                perfConsole(
                    "character library activeProfileImage slow",
                    {
                        ms: Math.round(ms),
                        name: entity.name || "",
                        imageCount: images.length,
                    },
                    "warn",
                );
            return result;
        }

        function activeProfileImageForAutomaticQueue(entity) {
            clearInvalidRuntimeProfileImagePointer(entity);
            return activeProfileImage(entity);
        }

        function localActiveProfileImage(entity) {
            if (!entity || typeof entity !== "object") return null;
            resolveActiveProfileImageReference(entity);
            const images = Array.isArray(entity.profile_images)
                ? entity.profile_images
                : [];
            return (
                images.find(
                    (image) =>
                        String(image.id) === String(entity.profile_image_id || "") &&
                        profileImageMatchesPresentation(image, entity),
                ) ||
                images.find((image) => profileImageMatchesPresentation(image, entity)) ||
                null
            );
        }

        function profileImageNeedsGeneration(image) {
            if (!image) return true;
            if (profileImageRecordIsPlaceholder(image)) return true;
            if (image.pending) return !profileImageRealHtml(image.html);
            if (image.error) return false;
            return !profileImageRealHtml(image.html);
        }

        function defaultProfileImageUrl(entity) {
            if (entity?.default_profile_image == null) return "";
            const slot = profileImageSlotFromExactInput(entity?.default_profile_image);
            {}
            return profileImageMatchesPresentation(slot, entity) &&
                defaultProfileImageSlotHasRealReference(slot)
                ? textSlot(slot.url, "")
                : "";
        }

        function defaultProfileLocalImageId(entity) {
            if (entity?.default_profile_image == null) return "";
            const slot = profileImageSlotFromExactInput(entity?.default_profile_image);
            if (
                profileImageMatchesPresentation(slot, entity) &&
                defaultProfileImageSlotHasRealReference(slot)
            )
                return textSlot(slot.local_image_id, "");

            // Reloaded library definitions can retain a valid local pointer
            // while the slot's presentation metadata is absent or stale. A
            // stored image with the correct presentation is authoritative for
            // recovery; never accept a mismatched male/non-male image.
            const configuredId = configuredDefaultProfileLocalImageId(entity);
            const stored = profileImageByStoreId(configuredId);
            return stored && profileImageMatchesPresentation(stored, entity)
                ? configuredId
                : "";
        }

        function configuredDefaultProfileLocalImageId(entity) {
            if (entity?.default_profile_image == null) return "";
            return textSlot(
                profileImageSlotFromExactInput(entity?.default_profile_image)
                    .local_image_id,
                "",
            );
        }

        function profileImageByStoreId(id = "") {
            const wanted = String(id || "");
            if (!wanted) return null;
            return (app.profileImages || []).find(
                (image) => String(image?.id || "") === wanted,
            ) || null;
        }

        function profileImageIsFinished(image) {
            return !!image?.id &&
                !profileImageRecordIsBlockedPlaceholder(image) &&
                !image.pending &&
                !image.error &&
                !!profileImageRealHtml(image.html);
        }

        function profileImageCreatedOrder(image = {}) {
            const timestamp = Date.parse(
                textSlot(image.at || image.requestedAt, ""),
            );
            if (Number.isFinite(timestamp)) return [2, timestamp];
            const numericId = Number(image.id);
            if (Number.isFinite(numericId)) return [1, numericId];
            return [0, 0];
        }

        function newestProfileImage(images = []) {
            return [...images].sort((left, right) => {
                const leftOrder = profileImageCreatedOrder(left);
                const rightOrder = profileImageCreatedOrder(right);
                if (leftOrder[0] !== rightOrder[0])
                    return rightOrder[0] - leftOrder[0];
                if (leftOrder[1] !== rightOrder[1])
                    return rightOrder[1] - leftOrder[1];
                return String(right.id || "").localeCompare(
                    String(left.id || ""),
                );
            })[0] || null;
        }

        function clearMissingLocalProfileImageRefs(entity) {
            if (!entity || typeof entity !== "object") return false;
            let changed = clearInvalidRuntimeProfileImagePointer(entity);
            resolveActiveProfileImageReference(entity);
            const defaultId = defaultProfileLocalImageId(entity);
            const activeId = String(entity.profile_image_id || "").trim();
            const missingDefault =
                !!defaultId && !profileImageIsFinished(profileImageByStoreId(defaultId));
            const missingActive =
                !!activeId && !profileImageIsFinished(profileImageByStoreId(activeId));
            if (missingDefault) {
                entity.default_profile_image = profileImageSlotFromExactInput({
                    ...entity.default_profile_image,
                    local_image_id: "",
                });
                changed = true;
            }
            if (missingActive) {
                entity.profile_image_id = "";
                changed = true;
            }
            if (changed) {
                log(
                    "Profile image reference repaired",
                    `${entity.name || "Character"} had a default/active profile image id with no stored local image record. The stale id was cleared so a new image can be generated.`,
                    { type: "image", level: "warn" },
                );
            }
            return changed;
        }

        function localDefaultProfileImage(entity) {
            const start = perfNow();
            if (!entity || typeof entity !== "object") return null;
            resolveActiveProfileImageReference(entity);
            const localId = defaultProfileLocalImageId(entity);
            const images = profileImagesForActivePresentation(entity);
            let image = localId
                ? images.find((item) => String(item.id || "") === localId) ||
                  profileImageByStoreId(localId)
                : null;
            if (
                profileImageMatchesPresentation(image, entity) &&
                profileImageIsFinished(image)
            ) {
                const ms = perfNow() - start;
                if (ms >= 10)
                    perfConsole(
                        "character library localDefaultProfileImage slow",
                        {
                            ms: Math.round(ms),
                            name: entity.name || "",
                            imageCount: images.length,
                            foundDefault: true,
                        },
                        "warn",
                    );
                return image;
            }
            image = images.find(profileImageIsFinished) || null;
            if (image?.id) {
                setLocalDefaultProfileImage(entity, image.id, image, {
                    keepUrl: true,
                    save: false,
                });
                const ms = perfNow() - start;
                if (ms >= 10)
                    perfConsole(
                        "character library localDefaultProfileImage slow",
                        {
                            ms: Math.round(ms),
                            name: entity.name || "",
                            imageCount: images.length,
                            repairedDefault: true,
                        },
                        "warn",
                    );
                return image;
            }
            clearMissingLocalProfileImageRefs(entity);
            const ms = perfNow() - start;
            if (ms >= 10)
                perfConsole(
                    "character library localDefaultProfileImage slow",
                    {
                        ms: Math.round(ms),
                        name: entity.name || "",
                        imageCount: images.length,
                        missing: true,
                    },
                    "warn",
                );
            return null;
        }

        function setLocalDefaultProfileImage(entity, imageId, image = null, options = {}) {
            if (!entity || !imageId) return false;
            const found =
                image ||
                profileImagesForEntity(entity).find(
                    (item) => String(item.id || "") === String(imageId),
                ) ||
                profileImageByStoreId(imageId);
            const currentMalePresentation = profileImageMalePresentation(entity);
            if (
                !found ||
                (found.male !== currentMalePresentation &&
                    options.allowInactivePresentation !== true)
            )
                return false;
            const foundSeed =
                found?.seed !== undefined && found?.seed !== null && found?.seed !== ""
                    ? exactProfileImageSeed(found.seed, "profile image record seed")
                    : null;
            const current = entity.default_profile_image == null
                ? emptyProfileImageSlot(profileImageMalePresentation(entity))
                : profileImageSlotFromExactInput(entity.default_profile_image);
            const currentConfigured = !!(current.url || current.local_image_id);
            const presentations = createProfileImagePresentations(
                entity.profile_image_presentations,
            );
            const presentationKey = found.male ? "male" : "non_male";
            const currentPresentation = profileImageSlotFromExactInput(
                presentations[presentationKey],
            );
            const nextPresentation = profileImageSlotFromExactInput({
                ...currentPresentation,
                url:
                    options.keepUrl !== false
                        ? currentPresentation.url || found?.hosted_url || current.url || ""
                        : found?.hosted_url || currentPresentation.url || current.url || "",
                local_image_id: String(imageId),
                source: found?.source || current.source || "local",
                seed: foundSeed ?? currentPresentation.seed ?? current.seed,
                prompt: found?.prompt || currentPresentation.prompt || current.prompt || "",
                negative_prompt: "",
                note:
                    currentPresentation.note ||
                    current.note ||
                    "Local default profile image selected in the Character Library.",
                male: found.male,
            });
            presentations[presentationKey] = clone(nextPresentation);
            entity.profile_image_presentations = presentations;
            if (
                found.male === currentMalePresentation &&
                (!currentConfigured || current.male === found.male)
            ) {
                const nextDefault = profileImageSlotFromExactInput({
                    ...nextPresentation,
                    url:
                        options.keepUrl !== false
                            ? current.url || nextPresentation.url || found?.hosted_url || ""
                            : found?.hosted_url || nextPresentation.url || current.url || "",
                });
                entity.default_profile_image = nextDefault;
            }
            if (foundSeed !== null && found.male === currentMalePresentation) {
                if ("default_seed" in entity || entity.image_prompt_config) {
                    entity.default_seed = foundSeed;
                    entity.image_prompt_config = imagePromptConfigFromExactInput(
                        {
                            ...(isPlainObject(entity.image_prompt_config)
                                ? entity.image_prompt_config
                                : {}),
                            seed: foundSeed,
                        },
                        foundSeed,
                    );
                } else {
                    entity.image ||= {};
                    entity.image.seed_enabled = true;
                    entity.image.seed = foundSeed;
                }
            }
            if (options.setActive !== false) entity.profile_image_id = String(imageId);
            if (options.save !== false) scheduleActiveGameSave();
            return true;
        }

        function defaultProfileImageHasBeenTried(entity) {
            const url = defaultProfileImageUrl(entity);
            if (!url) return true;
            return !!entity?.profile_default_image_attempted_url &&
                String(entity.profile_default_image_attempted_url) === String(url);
        }

        function dataUrlFromBlob(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ""));
                reader.onerror = () => reject(reader.error || new Error("Could not read default profile image."));
                reader.readAsDataURL(blob);
            });
        }

        async function fetchDefaultProfileImage(url, options = {}, timeoutMs = 15000) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeout);
            }
        }

        function profileImageRequestEntityIsCurrent(name = "", entity = null) {
            return (
                !!entity &&
                profileEntityForHandle(name, profileEntityCharacterId(entity)) === entity
            );
        }

        async function localProfileImageContentSha256(image = {}) {
            const extracted = extractImageDataUrl(
                image.html || image.url || image.hosted_url,
            );
            if (extracted?.bytes)
                return imageArchiveSha256(extracted.bytes);
            const imageId = textSlot(image.id, "");
            if (!imageId) return "";
            const asset = await app.persistence.getRecord("assetBlobs", imageId);
            if (!(asset?.blob instanceof Blob)) return "";
            return imageArchiveSha256(
                new Uint8Array(await asset.blob.arrayBuffer()),
            );
        }

        async function exactDownloadedProfileImageDuplicate(
            entity = {},
            malePresentation = false,
            blob = null,
        ) {
            const characterId = profileEntityCharacterId(entity);
            const candidates = (app.profileImages || []).filter(
                (image) =>
                    String(image?.character_id || "") === characterId &&
                    image?.male === !!malePresentation &&
                    profileImageIsFinished(image),
            );
            if (!(blob instanceof Blob)) return null;
            const downloadedHash = await imageArchiveSha256(
                new Uint8Array(await blob.arrayBuffer()),
            );
            for (const candidate of candidates) {
                const candidateHash = await localProfileImageContentSha256(candidate);
                if (candidateHash && candidateHash === downloadedHash)
                    return candidate;
            }
            return null;
        }

        async function copyProfileImagePresentationIfAvailable(
            name,
            malePresentation,
            reason = "profile image presentation",
            options = {},
        ) {
            const entity = profileEntity(name);
            const active = activeProfileImage(entity);
            if (!entity) return false;
            const targetMalePresentation = !!malePresentation;
            const targetIsCurrentPresentation =
                targetMalePresentation === profileImageMalePresentation(entity);
            const forceHostedDownload = options.forceHostedDownload === true;
            const activeIdBeforeLoad = textSlot(entity.profile_image_id, "");
            const defaultSlot = profileImagePresentationSlot(
                entity,
                targetMalePresentation,
            );
            const configuredImage = defaultSlot.local_image_id
                ? profileImageByStoreId(defaultSlot.local_image_id)
                : null;
            if (
                !forceHostedDownload &&
                configuredImage &&
                profileImageIsFinished(configuredImage) &&
                configuredImage.male === targetMalePresentation
            ) {
                setLocalDefaultProfileImage(entity, configuredImage.id, configuredImage, {
                    allowInactivePresentation: true,
                    keepUrl: true,
                    save: false,
                    setActive:
                        targetIsCurrentPresentation && options.setActive !== false,
                });
                if (targetIsCurrentPresentation && options.setActive !== false) {
                    entity.profile_image_id = configuredImage.id;
                    syncCharacterLibraryProfileSelection(name, configuredImage.id);
                }
                log(
                    "Default profile image adopted",
                    `${profileDisplayName(name)} adopted its existing imported profile image before generation fallback.`,
                    {
                        type: "image",
                        level: "message",
                        details: { name, imageId: configuredImage.id, reason },
                    },
                );
                return true;
            }
            {}
            if (
                !forceHostedDownload &&
                targetIsCurrentPresentation &&
                active &&
                !profileImageNeedsGeneration(active)
            ) {
                const defaultStoreImage = defaultSlot.local_image_id
                    ? profileImageByStoreId(defaultSlot.local_image_id)
                    : null;
                if (!defaultSlot.local_image_id || !profileImageIsFinished(defaultStoreImage)) {
                    const ownerName = profileImageOwnerNameForHandle(name, entity);
                    const storedActive =
                        upsertProfileStoreImage(active, ownerName, {
                            save: options.save !== false,
                        }) || active;
                    setLocalDefaultProfileImage(entity, storedActive.id || active.id, storedActive, {
                        keepUrl: true,
                        save: false,
                        setActive: options.setActive !== false,
                    });
                    if (options.setActive !== false) {
                        entity.profile_image_id = storedActive.id || active.id;
                        syncCharacterLibraryProfileSelection(name, storedActive.id || active.id);
                    }
                    if (options.cleanDefinitionProfileFields) {
                        delete entity.profile_images;
                        delete entity.profile_images_list;
                        delete entity.profile_image_id;
                        delete entity.images;
                    }
                    log(
                        "Default profile image attached",
                        `${profileDisplayName(name)} default profile image attached from existing local profile-image storage.`,
                        { type: "image", level: "message" },
                    );
                }
                return true;
            }
            if (defaultSlot.male !== targetMalePresentation) return false;
            if (!defaultProfileImageSlotHasRealReference(defaultSlot)) return false;
            const url = textSlot(defaultSlot.url, "");
            if (!url) return false;
            if (
                !forceHostedDownload &&
                targetIsCurrentPresentation &&
                defaultProfileImageHasBeenTried(entity)
            )
                return false;
            if (targetIsCurrentPresentation)
                entity.profile_default_image_attempted_url = url;
            try {
                let html = "";
                let downloadedBlob = null;
                if (/^data:image\//i.test(url)) {
                    const extracted = extractImageDataUrl(url);
                    if (extracted?.bytes)
                        downloadedBlob = new Blob([extracted.bytes], {
                            type: `image/${extracted.ext || "png"}`,
                        });
                    html = `<img src="${escapeHtml(url)}" alt="Default profile image">`;
                } else {
                    try {
                        const response = await fetchDefaultProfileImage(url, {
                            cache: "force-cache",
                        });
                        if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const blob = await response.blob();
                        if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                        if (!String(blob.type || "").startsWith("image/"))
                            throw new Error("Default profile URL did not return an image.");
                        downloadedBlob = blob;
                        const dataUrl = await dataUrlFromBlob(blob);
                        if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                        html = `<img src="${escapeHtml(dataUrl)}" alt="Default profile image">`;
                    } catch (err) {
                        if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                        const fallback = imageTagForStoredSrc(url);
                        if (!fallback) throw err;
                        html = fallback;
                        log(
                            "Default profile hosted image fallback",
                            `${profileDisplayName(name)} default profile image could not be copied locally; using hosted URL fallback: ${err.message || err}`,
                            {
                                type: "image",
                                level: "warning",
                                details: {
                                    requestedName: String(name || "").trim(),
                                    resolvedName: String(entity?.name || "").trim(),
                                    reason,
                                    url,
                                    error: err?.message || String(err),
                                },
                            },
                        );
                    }
                }
                if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                const ownerName = profileImageOwnerNameForHandle(name, entity);
                const duplicate = await exactDownloadedProfileImageDuplicate(
                    entity,
                    targetMalePresentation,
                    downloadedBlob,
                );
                if (duplicate) {

                    setLocalDefaultProfileImage(entity, duplicate.id, duplicate, {
                        allowInactivePresentation: true,
                        keepUrl: true,
                        save: false,
                        setActive:
                            targetIsCurrentPresentation && options.setActive !== false,
                    });
                    if (targetIsCurrentPresentation && options.setActive !== false) {
                        entity.profile_image_id = duplicate.id;
                        syncCharacterLibraryProfileSelection(name, duplicate.id);
                    }
                    if (options.cleanDefinitionProfileFields) {
                        delete entity.profile_images;
                        delete entity.profile_images_list;
                        delete entity.profile_image_id;
                        delete entity.images;
                    }
                    log(
                        "Hosted profile image duplicate reused",
                        `${profileDisplayName(name)} hosted ${targetMalePresentation ? "male" : "non-male"} profile image matched existing local image ${duplicate.id}. The duplicate download was discarded.`,
                        {
                            type: "image",
                            level: "message",
                            details: { name, imageId: duplicate.id, reason, url },
                        },
                    );
                    return true;
                }
                const image = upsertProfileStoreImage(createProfileImageRecord({
                    source: defaultSlot.source,
                    model: "default",
                    seed: defaultSlot.seed,
                    prompt: defaultSlot.prompt,
                    character_id: entity.id,
                    html,
                    male: targetMalePresentation,
                }), ownerName, {
                    save: options.save !== false,
                });
                if (image) {
                    const activeAfterLoad = activeProfileImage(entity);
                    const activeChangedWhileLoading =
                        textSlot(entity.profile_image_id, "") !== activeIdBeforeLoad &&
                        activeAfterLoad &&
                        !profileImageNeedsGeneration(activeAfterLoad);
                    const setActive =
                        targetIsCurrentPresentation &&
                        options.setActive !== false &&
                        !activeChangedWhileLoading;
                    setLocalDefaultProfileImage(entity, image.id, image, {
                        allowInactivePresentation: true,
                        keepUrl: true,
                        save: false,
                        setActive,
                    });
                    if (setActive) {
                        entity.profile_image_id = image.id;
                        syncCharacterLibraryProfileSelection(name, image.id);
                    }
                    if (options.cleanDefinitionProfileFields) {
                        delete entity.profile_images;
                        delete entity.profile_images_list;
                        delete entity.profile_image_id;
                        delete entity.images;
                    }
                    log(
                        "Default profile image copied",
                        `${profileDisplayName(name)} default profile image copied locally before generation.`,
                        { type: "image", level: "message" },
                    );
                    return true;
                }
            } catch (err) {
                if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
                const resolvedName = String(entity?.name || profileDisplayName(name) || name || "").trim();
                const requestedName = String(name || "").trim();
                const urlKind = /^data:image\//i.test(url)
                    ? "data-url"
                    : /^https?:\/\//i.test(url)
                      ? "remote-url"
                      : url
                        ? "other"
                        : "missing";
                log(
                    "Default profile image failed",
                    `${resolvedName || requestedName || "Unknown character"} default profile image could not be copied: ${err.message || err}`,
                    {
                        type: "image",
                        level: "error",
                        details: {
                            requestedName,
                            resolvedName,
                            displayName: profileDisplayName(name),
                            reason,
                            error: err?.message || String(err),
                            defaultImage: {
                                source: defaultSlot.source || "",
                                local_image_id: defaultSlot.local_image_id || "",
                                urlKind,
                                url,
                                prompt: defaultSlot.prompt || "",
                                seed: defaultSlot.seed ?? null,
                            },
                            activeProfileImage: active
                                ? {
                                      id: active.id || "",
                                      source: active.source || "",
                                      pending: !!active.pending,
                                      hasHtml: !!profileImageRealHtml(active.html),
                                  }
                                : null,
                        },
                    },
                );
            } finally {
                if (
                    options.save !== false &&
                    profileImageRequestEntityIsCurrent(name, entity)
                )
                    scheduleActiveGameSave();
            }
            return false;
        }

        async function copyDefaultProfileImageIfAvailable(
            name,
            reason = "default profile image",
            options = {},
        ) {
            const entity = profileEntity(name);
            if (!entity) return false;
            return copyProfileImagePresentationIfAvailable(
                name,
                profileImageMalePresentation(entity),
                reason,
                options,
            );
        }

        async function resolveMissingProfileImage(name, reason = "profile missing", options = {}) {
            const entity = profileEntity(name);
            const active = activeProfileImageForAutomaticQueue(entity);
            if (
                !entity ||
                (active && !profileImageNeedsGeneration(active) && !options.force)
            )
                return false;
            const copiedDefault = options.skipDefault
                ? false
                : await copyDefaultProfileImageIfAvailable(name, reason);
            if (!profileImageRequestEntityIsCurrent(name, entity)) return false;
            const activeAfterDefault = activeProfileImageForAutomaticQueue(entity);
            if (copiedDefault || (activeAfterDefault && !profileImageNeedsGeneration(activeAfterDefault))) {
                refreshProfileImageSurfaces(name);
                return true;
            }
            if (options.allowGeneration === false) {
                if (options.markSkipped) entity.profile_image_auto_skip = true;
                scheduleActiveGameSave();
                return false;
            }
                queueProfileImage(name, {
                    reason,
                    source: options.source || "",
                    force: !!options.force || !!activeAfterDefault,
                    allowImportSkipped: !!options.allowImportSkipped,
                    pendingImageId:
                        options.pendingImageId ||
                        (activeAfterDefault?.pending &&
                        !profileImageRealHtml(activeAfterDefault.html)
                            ? activeAfterDefault.id
                            : ""),
                });
                return true;
            }

        const RUNTIME_PROFILE_GENERATION_REASONS = new Set([
            "startup",
            "story template start",
            "world generation",
            "resumed world generation draft",
            "world generation player ready",
            "uninspected npc preview",
            "npc inspected",
            "character library visible",
            "cast browser visible",
            "profile picker",
            "player select option",
            "entered scene",
            "joined party",
            "objective introduced character",
            "generated job npc",
            "speaker entered scene",
            "story shop purchase",
            "scene card profile watchdog",
        ]);
        const PROFILE_IMPORT_SKIP_CLEAR_REASONS = new Set([
            "entered scene",
            "joined party",
            "npc inspected",
            "manual",
            "profile picker",
            "character library visible",
            "cast browser visible",
        ]);
        const ACTIVE_CAST_PROFILE_REASONS = new Set([
            "startup",
            "entered scene",
            "joined party",
            "world generation",
            "resumed world generation draft",
            "world generation player ready",
            "story template start",
            "objective introduced character",
        ]);

        function normalizedProfileImageReason(reason = "") {
            return String(reason || "").trim().toLowerCase();
        }

        function shouldGenerateRuntimeProfileImage(name, reason = "", options = {}) {
            if (options.allowRuntimeProfileGeneration === true) return true;
            return RUNTIME_PROFILE_GENERATION_REASONS.has(
                normalizedProfileImageReason(reason || options.reason),
            );
        }

        function queueNormalImageInsteadOfAutomaticProfile(
            name,
            reason = "profile missing",
            options = {},
        ) {
            const entity = profileEntity(name);
            if (!entity) return false;
            if (entity.profile_image_auto_skip && !options.allowImportSkipped)
                return false;
            entity.profile_image_auto_skip = true;
            queueOneOffCharacterImage(name, `${profileDisplayName(name)} ${reason}`);
            scheduleActiveGameSave();
            return true;
        }

        function queueMissingProfileImageAfterDefaultAttempt(name, reason = "profile missing", options = {}) {
            const entity = profileEntity(name);
            const active = activeProfileImageForAutomaticQueue(entity);
            if (
                !entity ||
                (active && !profileImageNeedsGeneration(active) && !options.force)
            )
                return false;
            if (
                entity?.default_profile_image != null &&
                false
            )
                return false;
            const defaultUrl = options.skipDefault
                ? ""
                : defaultProfileImageUrl(entity);
            if (!defaultUrl || defaultProfileImageHasBeenTried(entity)) {
                if (options.allowGeneration === false) {
                    if (options.markSkipped) entity.profile_image_auto_skip = true;
                    scheduleActiveGameSave();
                    return false;
                }
                if (!shouldGenerateRuntimeProfileImage(name, reason, options)) {
                    queueNormalImageInsteadOfAutomaticProfile(name, reason, options);
                    return false;
                }
                queueProfileImage(name, {
                    reason,
                    source: options.source || "",
                    force: !!options.force || !!active,
                    allowImportSkipped: !!options.allowImportSkipped,
                    allowDuringSmoke: options.allowDuringSmoke === true,
                    pendingImageId:
                        options.pendingImageId ||
                        (active?.pending && !profileImageRealHtml(active.html)
                            ? active.id
                            : ""),
                });
                return true;
            }
            // Profile image rule: default image is always tried before generated
            // fallback. This async branch lets UI events remain fire-and-forget.
            resolveMissingProfileImage(name, reason, options)
                .catch((err) => {
                    log(
                        "Default profile image resolution failed",
                        `${profileDisplayName(name)} could not resolve its default profile image: ${err?.message || err}`,
                        { type: "image", level: "warning" },
                    );
                })
                .finally(() => {
                    setTimeout(
                        () => queueFirstVisibleCharacterLibraryMissingProfile(),
                        0,
                    );
                });
            return true;
        }

        function profileImageById(entity, id) {
            resolveActiveProfileImageReference(entity);
            return profileImagesForEntity(entity).find(
                (image) => String(image.id) === String(id),
            );
        }

        function rememberProfileImage(
            name,
            image,
            { setActive = true, save = true, characterId = "" } = {},
        ) {
            const entity = profileEntityForHandle(
                name,
                characterId || image?.character_id,
            );
            if (!entity) return null;
            const exactCharacterId = String(entity.id || "").trim();
            if (!exactCharacterId)
                throw new Error("A completed profile image requires the character's exact id.");
            const expectedCharacterId = String(
                characterId || image?.character_id || "",
            ).trim();
            if (expectedCharacterId && expectedCharacterId !== exactCharacterId)
                throw new Error(
                    `Completed profile image character identity changed from ${expectedCharacterId} to ${exactCharacterId}.`,
                );
            const existingActiveId = Object.hasOwn(entity, "profile_image_id")
                ? textSlot(entity.profile_image_id, "")
                : isPlainObject(entity.profile_images)
                  ? textSlot(entity.profile_images.active_image_id, "")
                  : "";
            const record = createProfileImageRecord({
                ...image,
                character_id: exactCharacterId,
                male:
                    typeof image?.male === "boolean"
                        ? image.male
                        : profileImageMalePresentation(entity),
                saveId: image.saveId || activeSaveId() || "",
                id: image.id || String(Date.now() + Math.random()),
                at: image.at || new Date().toISOString(),
            });
            if (!record) return null;
            const stored =
                upsertProfileStoreImage(
                    record,
                    profileImageOwnerNameForHandle(name, entity),
                    { save: false },
                ) || record;
            const entityRecord = profileImageEntityRecord(stored);
            entity.profile_images = [
                entityRecord,
                ...(Array.isArray(entity.profile_images)
                    ? entity.profile_images
                    : []),
            ].filter(
                (item, index, all) =>
                    all.findIndex((other) => String(other.id) === String(item.id)) ===
                    index,
            );
            if (setActive) {
                entity.profile_image_id = entityRecord.id;
                setLocalDefaultProfileImage(entity, entityRecord.id, stored, {
                    keepUrl: true,
                    save: false,
                });
                if (persistentProfileImageRecord(stored))
                    syncCharacterLibraryProfileSelection(name, entityRecord.id);
            }
            else entity.profile_image_id = existingActiveId;
            pruneProfileImages(entity, name, !!app.settings.downloadOldImagesBeforeDelete);
            if (save && persistentProfileImageRecord(stored)) {
                saveProfileImageRecordsNow([stored], "profile image history changed", {
                    selectProfileImages: setActive,
                });
                scheduleActiveGameSave();
            }
            return profileImageById(entity, entityRecord.id);
        }

        function discardTransientGeneratedProfileImage(name, record, characterId = "") {
            if (!record?.id || record.pending !== true) return false;
            if (!/^(?:auto-)?generated(?:\b|-)/i.test(String(record.source || "")))
                return false;
            const imageId = String(record.id);
            const entity = profileEntityForHandle(name, characterId || record.character_id);
            app.profileImages = (app.profileImages || []).filter(
                (image) => String(image?.id || "") !== imageId,
            );
            if (Array.isArray(entity?.profile_images))
                entity.profile_images = entity.profile_images.filter(
                    (image) => String(image?.id || "") !== imageId,
                );
            if (String(entity?.profile_image_id || "") === imageId)
                entity.profile_image_id = "";
            if (app.profileImageLiveHtmlCache)
                delete app.profileImageLiveHtmlCache[imageId];
            return true;
        }

        function updateProfileImageHtml(name, imageId, html, updates = {}) {
            const entity = profileEntityForHandle(name, updates.characterId);
            if (!entity) return;
            const image = profileImageById(entity, imageId);
            if (!image) return;
            const shouldSave = updates.save !== false;
            const stableHtml = stableImageHtmlToString(profileImageRealHtml(html));
            if (stableHtml) {
                image.html = stableHtml;
                if (app.profileImageLiveHtmlCache)
                    delete app.profileImageLiveHtmlCache[String(image.id)];
            } else if (updates.pending) {
                const liveHtml =
                    liveImageHtmlToString(html) ||
                    (isTrustedImageUiHtml(imageHtmlToString(html))
                        ? imageHtmlToString(html)
                        : "");
                if (liveHtml) {
                    app.profileImageLiveHtmlCache ||= {};
                    app.profileImageLiveHtmlCache[String(image.id)] = liveHtml;
                }
            } else {
                image.html = "";
                if (app.profileImageLiveHtmlCache)
                    delete app.profileImageLiveHtmlCache[String(image.id)];
            }
            if ("pending" in updates) image.pending = !!updates.pending;
            if ("error" in updates) image.error = String(updates.error || "");
            for (const key of [
                "source",
                "model",
                "seed",
                "prompt",
                "negativePrompt",
                "male",
                "profile",
                            ]) {
                if (key in updates) image[key] = updates[key];
            }
            upsertProfileStoreImage(
                image,
                profileImageOwnerNameForHandle(name, entity),
                { save: false },
            );
            replaceEmbeddedProfileImageRecord(entity, image);
            if (shouldSave && persistentProfileImageRecord(image)) {
                const selected = String(entity.profile_image_id || "") === String(image.id);
                if (selected) syncCharacterLibraryProfileSelection(name, image.id);
                saveProfileImageRecordsNow([image], "profile image history changed", {
                    selectProfileImages: selected,
                });
                scheduleActiveGameSave();
            }
            renderProfileImageDom(name, image);
        }

        function renderLiveProfileImageResult(
            name,
            imageId,
            result,
            characterId = "",
        ) {
            const image = (app.profileImages || []).find(
                (candidate) => String(candidate?.id || "") === String(imageId),
            );

            const html = profileImageRealHtml(result);
            if (!html) return false;
            let rendered = false;
            const selector = `[data-profile-live-id="${cssEscape(String(imageId))}"]`;
            document.querySelectorAll(selector).forEach((target) => {
                if (storyPlayerSelectIsScrolling() && target.closest("[data-player-select-modal]")) {
                    deferStoryPlayerSelectProfileRender(name, imageId);
                    return;
                }
                target.innerHTML = html.replace("<img ", '<img class="profile-image-thumb" ');
                activatePluginIframes(target);
                rendered = true;
            });
            const entity = profileEntityForHandle(name, characterId);
            if (entity && String(entity.profile_image_id || "") === String(imageId)) {
                const stableId = profileEntityCharacterId(entity);
                const buttonSelector = stableId
                    ? `[data-character-action="profile"][data-character-id="${cssEscape(stableId)}"]`
                    : `[data-character-action="profile"][data-character-name="${cssEscape(String(name))}"]`;
                document.querySelectorAll(buttonSelector).forEach((button) => {
                    button.innerHTML = `<div class="profile-image-thumb-wrap" data-profile-live-id="${escapeHtml(String(imageId))}">${html.replace("<img ", '<img class="profile-image-thumb" ')}</div>`;
                    activatePluginIframes(button);
                    rendered = true;
                });
            }
            return rendered;
        }

        function renderProfileImageDom(name, image, options = {}) {
            const selector = `[data-profile-live-id="${cssEscape(String(image.id))}"]`;
            const entity = profileEntityForHandle(
                name,
                options.characterId || image?.character_id,
            );
            const ownerKey = profileImageOwnerKey(name, entity);
            const ownerSelector = `[data-profile-owner-key="${cssEscape(ownerKey)}"]`;
            const targets = new Set([
                ...document.querySelectorAll(selector),
                ...document.querySelectorAll(ownerSelector),
            ]);
            targets.forEach((target) => {
                if (
                    !options.afterPlayerSelectScroll &&
                    storyPlayerSelectIsScrolling() &&
                    target.closest("[data-player-select-modal]")
                ) {
                    deferStoryPlayerSelectProfileRender(name, image.id);
                    return;
                }
                target.dataset.profileLiveId = String(image.id);
                target.innerHTML = profileImageInnerHtml(image);
                activatePluginIframes(target);
            });
            if (entity && String(entity.profile_image_id || "") === String(image.id)) {
                const stableId = profileEntityCharacterId(entity);
                const buttonSelector = stableId
                    ? `[data-character-action="profile"][data-character-id="${cssEscape(stableId)}"]`
                    : `[data-character-action="profile"][data-character-name="${cssEscape(String(name))}"]`;
                document.querySelectorAll(buttonSelector).forEach((button) => {
                    button.innerHTML = `<div class="profile-image-thumb-wrap" data-profile-live-id="${escapeHtml(String(image.id))}">${profileImageInnerHtml(image)}</div>`;
                    activatePluginIframes(button);
                });
            }
            const cardSelector = `[data-profile-image-id="${cssEscape(String(image.id))}"]`;
            document.querySelectorAll(cardSelector).forEach((card) => {
                const meta = card.querySelector(".image-card-meta");
                if (meta) meta.textContent = "";
                const favorite = card.querySelector(".image-favorite-button");
                if (favorite) {
                    favorite.classList.toggle("speak-on", !!image.favorite);
                    favorite.classList.toggle("speak-off", !image.favorite);
                    favorite.title = image.favorite ? "Unfavorite image" : "Favorite image";
                    favorite.innerHTML = image.favorite ? "&#9733;" : "&#9734;";
                }
            });
            if (!image.pending) releaseStoryCharacterShopProfileOverride(name);
        }

        function captureProfileImageLiveHtml() {
            const cache = {};
            document.querySelectorAll("[data-profile-live-id]").forEach((target) => {
                const id = String(target.dataset.profileLiveId || "");
                if (!id) return;
                const html = profileImageRealHtml(target.innerHTML);
                if (html) cache[id] = html;
            });
            return cache;
        }

        function pruneProfileImages(entity, name, downloadOld) {
            resolveActiveProfileImageReference(entity);
            refreshKeptImageRuntimeSet();
            pruneGlobalReusableImageHistories(downloadOld);
            const images = profileImagesForEntity(entity);
            const limit = profileImageHistoryLimit();
            const buckets = [
                images.filter((image) => image.male === true),
                images.filter((image) => image.male === false),
                images.filter((image) => typeof image.male !== "boolean"),
            ];
            if (buckets.every((bucket) => bucket.length <= limit)) return [];
            const activeId = String(entity.profile_image_id || "");
            const configuredDefaultId = configuredDefaultProfileLocalImageId(entity);
            // Profile image retention rule: creating/generating a profile image
            // must not overwrite or delete existing images. The only automatic
            // deletion path is this cap cleanup, using the normal image-history
            // cap, and it may delete only the oldest non-favorited image that is
            // not currently active/in use.
            const protectedImages = images.filter(
                (image) =>
                    image.favorite ||
                    String(image.id) === activeId ||
                    String(image.id) === configuredDefaultId ||
                    imageKeptAtRuntime(image.id),
            );
            const protectedIds = new Set(
                protectedImages.map((image) => String(image.id)),
            );
            const removed = buckets.flatMap((bucket) => {
                const eligible = bucket.filter(
                    (image) => !protectedIds.has(String(image.id)),
                );
                const excess = Math.max(0, eligible.length - limit);
                return eligible
                    .slice()
                    .sort(
                        (a, b) =>
                            (Date.parse(a.at || "") || 0) -
                            (Date.parse(b.at || "") || 0),
                    )
                    .slice(0, excess);
            });
            const removedIds = new Set(removed.map((image) => String(image.id)));
            if (!removedIds.size) return [];
            const kept = images.filter((image) => !removedIds.has(String(image.id)));
            const keptIds = new Set(kept.map((image) => String(image.id)));
            entity.profile_images = kept.map(profileImageEntityRecord).filter(Boolean);
            entity.profile_image_id =
                kept.find((image) => String(image.id) === activeId)?.id ||
                kept[0]?.id ||
                "";
            app.profileImages = (app.profileImages || []).filter(
                (image) =>
                    String(image.owner_name || "") !== String(name || "") ||
                    keptIds.has(String(image.id)),
            );
            deleteProfileImageRecordsNow(
                removed.map((image) => ({ id: image.id })),
                "profile image history pruned",
            );
            if (downloadOld) downloadProfileImageArchive(name, removed);
            refreshKeptImageRuntimeSet();
            return removed;
        }

        function pruneGlobalReusableImageHistories(downloadOld = false) {
            const limit = profileImageHistoryLimit();
            const candidates = [];
            const protectedIds = new Set();
            refreshKeptImageRuntimeSet();

            for (const image of app.images || []) {
                const id = String(image?.id || "");
                if (!id) continue;
                if (image.favorite || imageKeptAtRuntime(id)) {
                    protectedIds.add(`normal:${id}`);
                    continue;
                }
                candidates.push({
                    kind: "normal",
                    id,
                    image,
                    at: Date.parse(image.at || "") || 0,
                });
            }

            for (const name of profileImageNames()) {
                const entity = profileEntity(name);
                if (!entity) continue;
                const activeId = String(defaultProfileLocalImageId(entity) || entity.profile_image_id || "");
                for (const image of profileImagesForEntity(entity, {
                    validateActive: false,
                })) {
                    const id = String(image.id || "");
                    if (!id) continue;
                    if (image.favorite || id === activeId || imageKeptAtRuntime(id)) {
                        protectedIds.add(`profile:${id}`);
                        continue;
                    }
                    candidates.push({
                        kind: "profile",
                        owner: name,
                        id,
                        at: Date.parse(image.at || "") || 0,
                    });
                }
            }

            for (const template of app.storyTemplates || []) {
                const storyId = String(template.id || "");
                const activeId = String(storyTitleCardActiveId(template) || "");
                for (const image of storyTitleCardImages(template)) {
                    const id = String(image.id || "");
                    if (!id) continue;
                    if (image.favorite || id === activeId) {
                        protectedIds.add(`story:${storyId}:${id}`);
                        continue;
                    }
                    candidates.push({
                        kind: "story",
                        storyId,
                        id,
                        at: Date.parse(image.at || "") || 0,
                    });
                }
            }

            if (candidates.length <= limit) return [];
            const removed = candidates
                .slice()
                .sort((a, b) => a.at - b.at)
                .slice(0, candidates.length - limit);
            const removedProfileIds = new Set(
                removed.filter((item) => item.kind === "profile").map((item) => item.id),
            );
            const removedNormalIds = new Set(
                removed.filter((item) => item.kind === "normal").map((item) => item.id),
            );
            const removedStoryIds = new Map();
            for (const item of removed.filter((entry) => entry.kind === "story")) {
                if (!removedStoryIds.has(item.storyId)) removedStoryIds.set(item.storyId, new Set());
                removedStoryIds.get(item.storyId).add(item.id);
            }
            if (removedNormalIds.size) {
                const removedNormalImages = (app.images || []).filter((image) =>
                    removedNormalIds.has(String(image.id || "")),
                );
                app.images = (app.images || []).filter(
                    (image) => !removedNormalIds.has(String(image.id || "")),
                );
                if (downloadOld) downloadImageHistoryArchive(removedNormalImages);
                scheduleActiveGameSave();
            }
            if (removedProfileIds.size) {
                app.profileImages = (app.profileImages || []).filter(
                    (image) => !removedProfileIds.has(String(image.id || "")),
                );
                for (const name of profileImageNames()) {
                    const entity = profileEntity(name);
                    if (!entity) continue;
                    entity.profile_images = (entity.profile_images || []).filter(
                        (image) => !removedProfileIds.has(String(image.id || "")),
                    );
                    if (removedProfileIds.has(String(entity.profile_image_id || ""))) {
                        entity.profile_image_id = "";
                    }
                }
                deleteProfileImageRecordsNow(
                    removed.filter((item) => item.kind === "profile").map((item) => ({ id: item.id })),
                    "global profile image history pruned",
                );
            }
            for (const [storyId, ids] of removedStoryIds.entries()) {
                const template = storyTemplateById(storyId);
                if (!template) continue;
                replaceStoryTitleCardStoreImages(
                    template,
                    storyTitleCardImages(template).filter(
                        (image) => !ids.has(String(image.id || "")),
                    ),
                );
            }
            if (removedStoryIds.size)
                deleteStoryTitleImageRecordsNow(
                    removed
                        .filter((item) => item.kind === "story")
                        .map((item) => ({ id: item.id })),
                    "global story image history pruned",
                );
            return removed;
        }

        function downloadProfileImageArchive(name, images) {
            if (!images?.length) return;
            const safeName = profileDisplayName(name).replace(/[^a-z0-9]+/gi, "-");
            const archive = buildImageArchiveFiles({
                type: "old-profile-images",
                character: profileDisplayName(name),
                images,
            });
            const blob = makeZip(archive.files);
            const a = document.createElement("a");
            const stamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-profile-images-${safeName}-${stamp}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function allUsedAndFavoriteImagesForArchive() {
            refreshKeptImageRuntimeSet();
            const byKey = new Map();
            const add = (image, kind = "image") => {
                if (!image?.id) return;
                byKey.set(`${kind}:${String(image.owner_name || "")}:${String(image.id)}`, {
                    ...image,
                    archive_kind: kind,
                    favorite: image.favorite === true,
                });
            };
            for (const image of app.images || []) {
                if (image.favorite || imageKeptAtRuntime(image.id)) add(image, "image");
            }
            for (const name of profileImageNames()) {
                const entity = profileEntity(name);
                if (!entity) continue;
                const activeId = String(entity.profile_image_id || "");
                for (const image of profileImagesForEntity(entity)) {
                    if (
                        image.favorite ||
                        String(image.id) === activeId ||
                        imageKeptAtRuntime(image.id)
                    )
                        add({ ...image, owner_name: name }, "profile");
                }
            }
            for (const image of app.profileImages || []) {
                if (image.favorite || imageKeptAtRuntime(image.id)) add(image, "profile");
            }
            return [...byKey.values()];
        }

        function downloadAllKeptImages() {
            const images = allUsedAndFavoriteImagesForArchive();
            if (!images.length) {
                showNotice("No Images", "No favorited or actively used images were found.");
                return;
            }
            const archive = buildImageArchiveFiles({
                type: "kept-images",
                images,
            });
            const blob = makeZip(archive.files);
            const a = document.createElement("a");
            const stamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-kept-images-${stamp}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function imageArchiveRecordKey(image = {}, kind = "image", owner = "", path = "") {
            const id = String(image.id || "").trim();
            if (id) return `${kind}:id:${id}`;
            const localId = String(image.local_image_id || "").trim();
            if (localId) return `${kind}:local:${localId}`;
            const source = String(image.url || image.hosted_url || image.html || "").trim();
            if (source) return `${kind}:source:${source.slice(0, 1000)}`;
            return [kind, owner, path].map((part) => String(part || "")).join("|");
        }

        function imageArchiveRecordTitle(image = {}, kind = "image", owner = "", path = "") {
            return (
                image.title ||
                image.reason ||
                image.name ||
                owner ||
                path.split(".").filter(Boolean).slice(-2).join("-") ||
                kind ||
                image.id ||
                "image"
            );
        }

        function addImageArchiveRecord(map, image, kind = "image", owner = "", path = "") {
            if (!image || typeof image !== "object") return;
            const html = image.html || image.url || image.hosted_url || "";
            const hasImageReference =
                !!image.id ||
                !!image.local_image_id ||
                !!image.html ||
                !!image.url ||
                !!image.hosted_url ||
                !!image.prompt ||
                !!image.negativePrompt ||
                !!image.negative_prompt;
            if (!hasImageReference) return;
            const key = imageArchiveRecordKey(image, kind, owner, path);
            if (!key || map.has(key)) return;
            map.set(key, {
                ...image,
                html,
                archive_kind: kind,
                archive_owner: owner,
                archive_path: path,
                title: imageArchiveRecordTitle(image, kind, owner, path),
            });
        }

        function addCharacterImagesToArchive(map, character, owner = "", path = "") {
            if (!character || typeof character !== "object") return;
            const name = String(owner || character.name || character.id || path || "").trim();
            for (const [index, image] of (character.profile_images || []).entries()) {
                addImageArchiveRecord(
                    map,
                    image,
                    "profile",
                    name,
                    `${path}.profile_images.${index}`,
                );
            }
            addImageArchiveRecord(
                map,
                character.default_profile_image,
                "profile",
                name,
                `${path}.default_profile_image`,
            );
            addImageArchiveRecord(
                map,
                character.profile_image,
                "profile",
                name,
                `${path}.profile_image`,
            );
            for (const presentation of ["male", "non_male", "female"]) {
                addImageArchiveRecord(
                    map,
                    character.profile_image_presentations?.[presentation],
                    "profile",
                    name,
                    `${path}.profile_image_presentations.${presentation}`,
                );
            }
        }

        function addStateImagesToArchive(map, state = {}, owner = "state", path = "state") {
            if (!state || typeof state !== "object") return;
            addImageArchiveRecord(
                map,
                { html: state.meta?.title_image_html, title: state.meta?.title || "Story Title Image" },
                "story-title",
                owner,
                `${path}.meta.title_image_html`,
            );
            addCharacterImagesToArchive(map, state.player, state.player?.name || "Player", `${path}.player`);
            for (const [index, player] of (state.players || []).entries()) {
                addCharacterImagesToArchive(
                    map,
                    player,
                    player?.name || `Player ${index + 1}`,
                    `${path}.players.${index}`,
                );
            }
            for (const [id, character] of Object.entries(state.characters || {})) {
                addCharacterImagesToArchive(
                    map,
                    character,
                    character?.name || id,
                    `${path}.characters.${id}`,
                );
            }
            for (const [id, npc] of Object.entries(state.npcs || {})) {
                addCharacterImagesToArchive(
                    map,
                    npc.full_character || npc,
                    npc.full_character?.name || npc.name || id,
                    `${path}.npcs.${id}${npc.full_character ? ".full_character" : ""}`,
                );
            }
            for (const [id, future] of Object.entries(state.future_cast?.items || {})) {
                addCharacterImagesToArchive(
                    map,
                    future.full_character || future,
                    future.full_character?.name || future.name || id,
                    `${path}.future_cast.items.${id}${future.full_character ? ".full_character" : ""}`,
                );
            }
        }

        function addStoryTemplateImagesToArchive(map, template = {}, path = "story") {
            if (!template || typeof template !== "object") return;
            const owner = template.title || template.name || template.id || path;
            for (const [index, image] of storyTitleCardImages(template).entries()) {
                addImageArchiveRecord(
                    map,
                    image,
                    "story-title",
                    owner,
                    `${path}.title_card_images.${index}`,
                );
            }
            addImageArchiveRecord(
                map,
                template.title_card_image,
                "story-title",
                owner,
                `${path}.title_card_image`,
            );
            addStateImagesToArchive(map, template.state, owner, `${path}.state`);
        }

        async function allImagesForArchive() {
            const byKey = new Map();
            for (const [index, image] of (app.images || []).entries()) {
                addImageArchiveRecord(byKey, image, "image", "active game", `app.images.${index}`);
            }
            for (const [index, image] of (app.profileImages || []).entries()) {
                addImageArchiveRecord(
                    byKey,
                    image,
                    "profile",
                    image.owner_name || "profile image store",
                    `app.profileImages.${index}`,
                );
            }
            for (const [index, image] of (app.storyTitleCardImages || []).entries()) {
                addImageArchiveRecord(
                    byKey,
                    image,
                    "story-title",
                    image.story_id || "story title-card store",
                    `app.storyTitleCardImages.${index}`,
                );
            }
            addStateImagesToArchive(byKey, app.state, "active game", "app.state");

            const [
                storedProfiles,
                storedStoryTitleCards,
                loadedStoryTemplates,
                characterLibrary,
            ] = await Promise.all([
                loadPerRecordLibrary(PROFILE_IMAGE_KEY, []),
                loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, []),
                loadPerRecordLibrary(STORY_TEMPLATE_KEY, [], {
                    deferStoryValidation: true,
                }),
                loadPerRecordLibrary(CHARACTER_LIBRARY_KEY, []),
            ]);
            const storyTemplates = await validateHydratedStoryTemplateRecords(
                loadedStoryTemplates,
                { persist: false },
            );

            for (const [index, image] of (storedProfiles || []).entries()) {
                addImageArchiveRecord(
                    byKey,
                    image,
                    "profile",
                    image.owner_name || "profile image store",
                    `profileImageStore.${index}`,
                );
            }
            for (const [index, image] of (storedStoryTitleCards || []).entries()) {
                addImageArchiveRecord(
                    byKey,
                    image,
                    "story-title",
                    image.story_id || "story title-card store",
                    `storyTitleCardStore.${index}`,
                );
            }
            for (const [index, template] of (storyTemplates || []).entries()) {
                addStoryTemplateImagesToArchive(
                    byKey,
                    template,
                    `storyTemplates.${template?.id || index}`,
                );
            }
            for (const [index, character] of (characterLibrary || []).entries()) {
                addCharacterImagesToArchive(
                    byKey,
                    character,
                    character?.name || character?.id || `Character ${index + 1}`,
                    `characterLibrary.${character?.id || index}`,
                );
            }
            for (const record of saveIndexRecords()) {
                try {
                    const save = await fullSaveRecordForExport(record);
                    if (!save) continue;
                    const owner = save.index?.name || save.index?.title || save.index?.saveId || "save";
                    for (const [index, image] of (save.images || []).entries()) {
                        addImageArchiveRecord(
                            byKey,
                            image,
                            "image",
                            owner,
                            `saves.${save.index?.saveId || "save"}.images.${index}`,
                        );
                    }
                    addStateImagesToArchive(
                        byKey,
                        save.state,
                        owner,
                        `saves.${save.index?.saveId || "save"}.state`,
                    );
                } catch (err) {
                    log("Image export save skipped", err.message || String(err), {
                        level: "warning",
                        type: "storage",
                        details: { saveId: record?.saveId || "" },
                    });
                }
            }
            return [...byKey.values()];
        }

        async function imageArchiveBytes(image = {}) {
            const data = extractImageDataUrl(image.html || image.url || image.hosted_url);
            if (data) return data;
            const src = extractImageSrc(image.html) || image.url || image.hosted_url || "";
            if (!src) return null;
            if (/^data:image\//i.test(src)) return extractImageDataUrl(src);
            try {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const contentType = response.headers.get("content-type") || "";
                const bytes = new Uint8Array(await response.arrayBuffer());
                return {
                    ext: imageMimeExtension(contentType || imageSrcExtension(src)),
                    bytes,
                    dataUrl: "",
                };
            } catch (err) {
                return {
                    ext: imageSrcExtension(src),
                    bytes: null,
                    dataUrl: "",
                    error: err.message || String(err),
                };
            }
        }

        async function buildImageArchiveFilesAsync({ type, images, character = "" }) {
            const metadataImages = [];
            const files = {};
            for (const [index, image] of (images || []).entries()) {
                const extracted = await imageArchiveBytes(image);
                const baseName = safeArchiveFileName(
                    `${String(index + 1).padStart(3, "0")}-${image.title || image.reason || image.id || "image"}`,
                );
                let imageFile = "";
                if (extracted?.bytes) {
                    imageFile = `${baseName}.${extracted.ext || "png"}`;
                    files[imageFile] = extracted.bytes;
                }
                const metadata = imageDownloadMetadata(image, imageFile);
                if (extracted?.error) metadata.image_export_error = extracted.error;
                files[`${baseName}.json`] = JSON.stringify(metadata, null, 2);
                metadataImages.push(metadata);
            }

            files["metadata.json"] = JSON.stringify(
                {
                    app: "EmberAdventures",
                    type,
                    character,
                    exportedAt: new Date().toISOString(),
                    count: images.length,
                    imageFileCount: Object.keys(files).filter(
                        (name) => /\.(?:png|jpe?g|webp|gif)$/i.test(name),
                    ).length,
                    imageFiles: Object.keys(files).filter(
                        (name) => /\.(?:png|jpe?g|webp|gif)$/i.test(name),
                    ),
                    images: metadataImages,
                },
                null,
                2,
            );
            files["README.txt"] =
                "This archive contains all EmberAdventures image records that could be found, plus same-name JSON sidecars.\nSome browser-hosted or remote images may export metadata only if the browser cannot read the image bytes.\n";
            return { files, metadataImages };
        }

        const IMAGE_RESTORATION_ARCHIVE_VERSION = 1;
        const MAX_IN_MEMORY_IMAGE_ZIP_BYTES = 96 * 1024 * 1024;

        function imageArchiveBase64FromBytes(bytes = new Uint8Array()) {
            let value = "";
            for (let offset = 0; offset < bytes.length; offset += 32768)
                value += String.fromCharCode(
                    ...bytes.subarray(offset, Math.min(offset + 32768, bytes.length)),
                );
            return btoa(value);
        }

        async function imageArchiveSha256(bytes = new Uint8Array()) {
            const digest = await crypto.subtle.digest("SHA-256", bytes);
            return [...new Uint8Array(digest)]
                .map((value) => value.toString(16).padStart(2, "0"))
                .join("");
        }

        async function normalizedImageExportIndex() {
            await flushLargeSaves();
            const payload = await app.persistence.exportAllImageIndex();
            if (
                !isPlainObject(payload) ||
                payload.app !== "EmberAdventures" ||
                payload.exportType !== "all-images-index" ||
                !isPlainObject(payload.records)
            )
                throw new Error("Normalized image export index is invalid.");
            return payload;
        }

        function imageArchiveRecordLabel(records = {}, imageId = "") {
            for (const values of Object.values(records || {})) {
                const record = (values || []).find(
                    (item) => String(item?.imageId || "") === String(imageId),
                );
                if (!record) continue;
                return textSlot(
                    record.characterId ||
                        record.storyId ||
                        record.itemId ||
                        record.outfitId ||
                        record.rewardId ||
                        record.storyTitle ||
                        imageId,
                    imageId,
                );
            }
            return imageId;
        }

        function imageArchiveFileExtension(mimeType = "") {
            return imageMimeExtension(String(mimeType || "image/png"));
        }

        function imageArchivePayloadWithoutUnavailableGeneratedImages(payload = {}) {
            const records = clone(payload.records || {});
            const assets = Array.isArray(records.assetBlobs) ? records.assetBlobs : [];
            const assetIds = new Set(assets.map((record) => String(record.imageId || "")));
            const omittedIds = new Set();
            const warnings = [];
            const metadataStores = Object.entries(records).filter(
                ([storeName]) =>
                    storeName !== "assetBlobs" &&
                    !/Selections$/.test(storeName) &&
                    storeName !== "storyImageTargets",
            );

            for (const [storeName, values] of metadataStores) {
                for (const record of values || []) {
                    const imageId = String(record?.imageId || "");
                    const url = String(record?.url || "");
                    if (imageId && assetIds.has(imageId) && /^blob:/i.test(url)) {
                        delete record.url;
                        continue;
                    }
                    const unavailable = imageId && !assetIds.has(imageId) && (!url || /^blob:/i.test(url));
                    if (!unavailable) continue;
                    const warning = {
                        path: `records.${storeName}.${imageId}`,
                        imageId,
                        url,
                        generated: imageSourceWasGenerated(record.source),
                        message: "Image has neither a durable local asset nor a usable hosted URL.",
                    };
                    warnings.push(warning);
                    if (warning.generated) omittedIds.add(imageId);
                }
            }

            if (omittedIds.size) {
                for (const [storeName, values] of Object.entries(records)) {
                    if (storeName === "assetBlobs") continue;
                    records[storeName] = (values || []).filter(
                        (record) => !omittedIds.has(String(record?.imageId || "")),
                    );
                }
            }

            return { records, assets, warnings, omittedIds };
        }

        function imageRestorationExportContext(payload = {}) {
            const prepared = imageArchivePayloadWithoutUnavailableGeneratedImages(payload);
            const records = prepared.records;
            delete records.assetBlobs;
            return { payload, prepared, records, assets: [] };
        }

        async function imageRestorationAsset(context, asset, index) {
            const stored = await app.persistence.getRecord("assetBlobs", asset.imageId);
            if (!(stored?.blob instanceof Blob))
                throw new Error(`assetBlobs.${asset.imageId} does not contain its stored image bytes.`);
            if (stored.blob.size !== asset.byteLength)
                throw new Error(`assetBlobs.${asset.imageId} has the wrong byte length.`);
            const bytes = new Uint8Array(await stored.blob.arrayBuffer());
            const label = safeArchiveFileName(
                imageArchiveRecordLabel(context.records, asset.imageId),
            ).slice(0, 80) || "image";
            const imageId = (
                safeArchiveFileName(asset.imageId || `image-${index + 1}`)
                    .slice(0, 80) || `image-${index + 1}`
            );
            const file = `images/${String(index + 1).padStart(4, "0")}-${label}-${imageId}.${imageArchiveFileExtension(asset.mimeType)}`;
            const manifestAsset = {
                imageId: asset.imageId,
                mimeType: asset.mimeType,
                byteLength: asset.byteLength,
                contentHash: asset.contentHash,
                sha256: await imageArchiveSha256(bytes),
                file,
            };
            return { bytes, file, manifestAsset };
        }

        function imageRestorationManifest(context) {
            return {
                app: "EmberAdventures",
                exportType: "all-images-restoration",
                archiveVersion: IMAGE_RESTORATION_ARCHIVE_VERSION,
                schemaVersion: context.payload.schemaVersion,
                exportedAt: new Date().toISOString(),
                records: context.records,
                assets: context.assets,
                warnings: context.prepared.warnings,
            };
        }

        function imageRestorationReadme() {
            return [
                "This is an EmberAdventures image restoration archive.",
                "For a complete transfer, import the matching EmberAdventures data backup first, then import this image archive.",
                "Import the ZIP directly, or import this folder.",
                "Deleting an image file before folder import intentionally excludes that image and its selection references.",
                "Do not edit manifest.json or rename image files.",
            ].join("\n");
        }

        async function buildRestorableImageArchive(payload) {
            const context = imageRestorationExportContext(payload);
            const files = {};

            for (const [index, asset] of context.prepared.assets.entries()) {
                if (context.prepared.omittedIds.has(String(asset.imageId || ""))) continue;
                const entry = await imageRestorationAsset(context, asset, index);
                files[entry.file] = entry.bytes;
                context.assets.push(entry.manifestAsset);
            }

            const manifest = imageRestorationManifest(context);
            files["manifest.json"] = JSON.stringify(manifest, null, 2);
            files["README.txt"] = imageRestorationReadme();
            return { files, manifest };
        }

        async function writeImageRestorationFile(directory, path, content) {
            const parts = path.split("/");
            let targetDirectory = directory;
            for (const part of parts.slice(0, -1)) {
                try {
                    targetDirectory = await targetDirectory.getDirectoryHandle(part, {
                        create: true,
                    });
                } catch (error) {
                    throw new Error(
                        `Could not create image export directory "${part}" while writing "${path}" (${error?.name || "Error"}): ${error?.message || String(error)}`,
                    );
                }
            }
            let handle = null;
            try {
                handle = await targetDirectory.getFileHandle(parts.at(-1), {
                    create: true,
                });
            } catch (error) {
                throw new Error(
                    `Could not create image export file "${path}" (${error?.name || "Error"}): ${error?.message || String(error)}`,
                );
            }
            const writable = await handle.createWritable();
            try {
                await writable.write(content);
            } finally {
                await writable.close();
            }
        }

        async function exportAllImagesToFolder(parentDirectory, payload, options = {}) {
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const folderName = `emberadventureslite-all-images-${stamp}`;
            let directory = null;
            try {
                directory = await parentDirectory.getDirectoryHandle(folderName, {
                    create: true,
                });
            } catch (error) {
                throw new Error(
                    `Could not create image export folder "${folderName}" (${error?.name || "Error"}): ${error?.message || String(error)}`,
                );
            }
            const context = imageRestorationExportContext(payload);
            const exportAssets = context.prepared.assets
                .map((asset, index) => ({ asset, index }))
                .filter(({ asset }) =>
                    !context.prepared.omittedIds.has(String(asset.imageId || "")),
                );
            const totalFiles = exportAssets.length + 2;
            let completedFiles = 0;
            const reportProgress = (detail = "") =>
                options.onProgress?.({
                    completed: completedFiles,
                    total: totalFiles,
                    detail,
                });
            reportProgress("Preparing image files");

            for (const { asset, index } of exportAssets) {
                const entry = await imageRestorationAsset(context, asset, index);
                await writeImageRestorationFile(directory, entry.file, entry.bytes);
                context.assets.push(entry.manifestAsset);
                completedFiles++;
                reportProgress(entry.file);
            }

            const manifest = imageRestorationManifest(context);
            await writeImageRestorationFile(
                directory,
                "manifest.json",
                JSON.stringify(manifest, null, 2),
            );
            completedFiles++;
            reportProgress("manifest.json");
            await writeImageRestorationFile(directory, "README.txt", imageRestorationReadme());
            completedFiles++;
            reportProgress("README.txt");
            return manifest;
        }

        const imageExportDirectoryHelperWindows = new WeakMap();

        function releaseImageExportDirectory(directory = null) {
            const helper = directory && typeof directory === "object"
                ? imageExportDirectoryHelperWindows.get(directory)
                : null;
            if (!helper) return;
            imageExportDirectoryHelperWindows.delete(directory);
            if (!helper.closed) helper.close();
        }

        function updateImageExportDirectoryHelper(directory = null, progress = {}) {
            const helper = directory && typeof directory === "object"
                ? imageExportDirectoryHelperWindows.get(directory)
                : null;
            const status = helper?.closed
                ? null
                : helper?.document?.querySelector?.("p");
            if (!status) return;
            status.textContent = `Exporting ${Number(progress.completed || 0)}/${Number(progress.total || 0)}${progress.detail ? `: ${progress.detail}` : ""}`;
        }

        function chooseImageExportDirectory(options = {}) {
            const currentWindow = options.currentWindow || window;
            if (currentWindow.self === currentWindow.top) {
                if (typeof currentWindow.showDirectoryPicker !== "function")
                    return Promise.reject(
                        new Error("This browser does not provide folder export."),
                    );
                return currentWindow.showDirectoryPicker({ mode: "readwrite" });
            }
            return new Promise((resolve, reject) => {
                const helper = options.openWindow
                    ? options.openWindow()
                    : currentWindow.open(
                          "",
                          "_blank",
                          "popup=yes,width=520,height=320,resizable=yes,scrollbars=yes",
                      );
                if (!helper) {
                    reject(
                        new Error(
                            "The browser blocked the folder-export window. Allow pop-ups for EmberAdventures and try again.",
                        ),
                    );
                    return;
                }
                let settled = false;
                const finish = (directory = null, error = null) => {
                    if (settled) return;
                    settled = true;
                    clearInterval(closeTimer);
                    if (error || !directory) {
                        if (!helper.closed) helper.close();
                        if (error) reject(error);
                        else resolve(null);
                        return;
                    }
                    imageExportDirectoryHelperWindows.set(directory, helper);
                    const status = helper.document?.querySelector?.("p");
                    if (status)
                        status.textContent =
                            "Folder selected. Keep this window open while EmberAdventures writes the image archive.";
                    resolve(directory);
                };
                let closeTimer = setInterval(() => {
                    if (helper.closed) finish(null);
                }, 250);
                try {
                    const document = helper.document;
                    document.title = "EmberAdventures Folder Export";
                    document.body.replaceChildren();
                    document.body.style.cssText =
                        "margin:0;min-height:100vh;display:grid;place-items:center;background:#171a20;color:#f5f2eb;font:16px system-ui,sans-serif";
                    const panel = document.createElement("main");
                    panel.style.cssText =
                        "width:min(420px,calc(100vw - 40px));display:grid;gap:18px;text-align:center";
                    const title = document.createElement("h1");
                    title.textContent = "EmberAdventures Folder Export";
                    title.style.cssText = "margin:0;font-size:24px";
                    const choose = document.createElement("button");
                    choose.type = "button";
                    choose.textContent = "Choose Export Folder";
                    choose.style.cssText =
                        "padding:14px;border:1px solid #ba852c;border-radius:6px;background:#8a611d;color:white;font:inherit;cursor:pointer";
                    const cancel = document.createElement("button");
                    cancel.type = "button";
                    cancel.textContent = "Cancel";
                    cancel.style.cssText =
                        "padding:10px;border:1px solid #454b57;border-radius:6px;background:#222731;color:white;font:inherit;cursor:pointer";
                    const status = document.createElement("p");
                    status.textContent =
                        "Choose where the image restoration folder will be created.";
                    status.style.cssText = "margin:0;color:#c9c2b5";
                    choose.onclick = async () => {
                        if (typeof helper.showDirectoryPicker !== "function") {
                            finish(
                                null,
                                new Error(
                                    "This browser does not provide folder export.",
                                ),
                            );
                            return;
                        }
                        choose.disabled = true;
                        status.textContent = "Waiting for folder selection...";
                        try {
                            const directory = await helper.showDirectoryPicker({
                                mode: "readwrite",
                            });
                            finish(directory);
                        } catch (error) {
                            if (error?.name === "AbortError") {
                                choose.disabled = false;
                                status.textContent = "No folder selected.";
                                return;
                            }
                            finish(null, error);
                        }
                    };
                    cancel.onclick = () => finish(null);
                    panel.append(title, status, choose, cancel);
                    document.body.append(panel);
                    choose.focus();
                } catch (error) {
                    finish(null, error);
                }
            });
        }

        async function exportAllImages() {
            const destination = await showChoice(
                "Export All Images",
                "Folder export writes one image at a time and is recommended for large libraries.",
                [
                    { value: "folder", label: "Export Folder", className: "primary" },
                    { value: "zip", label: "Export ZIP" },
                    { value: "cancel", label: "Cancel" },
                ],
            );
            if (!destination || destination === "cancel") return;
            let parentDirectory = null;
            if (destination === "folder") {
                try {
                    parentDirectory = await chooseImageExportDirectory();
                } catch (error) {
                    if (error?.name !== "AbortError")
                        showNotice("Folder Export Failed", error?.message || String(error));
                    return;
                }
                if (!parentDirectory) return;
            }
            try {
                await withSavingOverlay(async () => {
                    try {
                        const payload = await normalizedImageExportIndex();
                        const localBytes = (payload.records.assetBlobs || []).reduce(
                            (total, asset) => total + Number(asset.byteLength || 0),
                            0,
                        );
                        if (destination === "folder") {
                            const activityId = app.savingOverlayActivityIds?.at?.(-1) || "";
                            const manifest = await exportAllImagesToFolder(
                                parentDirectory,
                                payload,
                                {
                                    onProgress: (progress) => {
                                        updateActivityTaskProgress(activityId, {
                                            ...progress,
                                            label: "Exporting images",
                                        });
                                        updateImageExportDirectoryHelper(
                                            parentDirectory,
                                            progress,
                                        );
                                    },
                                },
                            );
                            showNotice(
                                manifest.warnings.length
                                    ? "Images Exported with Warnings"
                                    : "Images Exported",
                                `Exported ${manifest.assets.length} local image file${manifest.assets.length === 1 ? "" : "s"} without loading the full library into memory.${manifest.warnings.length ? ` ${manifest.warnings.length} inaccessible image record${manifest.warnings.length === 1 ? " was" : "s were"} listed in manifest.json.` : ""}`,
                            );
                            return;
                        }
                        if (localBytes > MAX_IN_MEMORY_IMAGE_ZIP_BYTES)
                            throw new Error(
                                `ZIP export would require loading ${Math.ceil(localBytes / 1024 / 1024)} MB of images into this tab and constructing another archive buffer. That can crash the browser renderer. Use Export Folder instead.`,
                            );
                        const archive = await buildRestorableImageArchive(payload);
                        const blob = makeZip(archive.files);
                        const a = document.createElement("a");
                        const stamp = new Date()
                            .toISOString()
                            .replace(/[:.]/g, "-")
                            .slice(0, 19);
                        a.href = URL.createObjectURL(blob);
                        a.download = `emberadventureslite-all-images-${stamp}.zip`;
                        document.body.append(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(a.href);
                        showNotice(
                            archive.manifest.warnings.length
                                ? "Images Exported with Warnings"
                                : "Images Exported",
                            `Exported ${archive.manifest.assets.length} local image file${archive.manifest.assets.length === 1 ? "" : "s"} and exact normalized image records.${archive.manifest.warnings.length ? ` ${archive.manifest.warnings.length} inaccessible image record${archive.manifest.warnings.length === 1 ? " was" : "s were"} listed in manifest.json.` : ""}`,
                        );
                    } catch (err) {
                        showNotice("Image Export Failed", err.message || String(err));
                    }
                }, "Exporting all images...");
            } finally {
                releaseImageExportDirectory(parentDirectory);
            }
        }

        function chooseImageArchiveFolder() {
            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.webkitdirectory = true;
                input.onchange = () => resolve([...(input.files || [])]);
                input.oncancel = () => resolve([]);
                input.click();
            });
        }

        async function imageArchiveFilesFromFolder(files = []) {
            const list = Array.from(files || []);
            const firstParts = list
                .map((file) => String(file.webkitRelativePath || file.name).split("/")[0])
                .filter(Boolean);
            const sharedRoot = firstParts.length && firstParts.every((part) => part === firstParts[0])
                ? `${firstParts[0]}/`
                : "";
            const result = {};
            for (const file of list) {
                let path = String(file.webkitRelativePath || file.name).replaceAll("\\", "/");
                if (sharedRoot && path.startsWith(sharedRoot)) path = path.slice(sharedRoot.length);
                if (!path || path.startsWith("/") || path.includes("../"))
                    throw new Error(`Image archive contains an invalid path: ${path || "(empty)"}.`);
                if (Object.hasOwn(result, path))
                    throw new Error(`Image archive contains duplicate file ${path}.`);
                result[path] = new Uint8Array(await file.arrayBuffer());
            }
            return result;
        }

        function exactImageRestorationManifest(manifest = {}) {
            if (!isPlainObject(manifest))
                throw new Error("Image restoration manifest must be an object.");
            const fields = [
                "app",
                "exportType",
                "archiveVersion",
                "schemaVersion",
                "exportedAt",
                "records",
                "assets",
                "warnings",
            ];
            const unknown = Object.keys(manifest).filter((field) => !fields.includes(field));
            if (unknown.length)
                throw new Error(`Image restoration manifest has unknown field ${unknown[0]}.`);
            if (fields.some((field) => !Object.hasOwn(manifest, field)))
                throw new Error("Image restoration manifest is missing required fields.");
            if (manifest.app !== "EmberAdventures")
                throw new Error('Image restoration manifest app must be exactly "EmberAdventures".');
            if (manifest.exportType !== "all-images-restoration")
                throw new Error('Image restoration manifest exportType must be exactly "all-images-restoration".');
            if (manifest.archiveVersion !== IMAGE_RESTORATION_ARCHIVE_VERSION)
                throw new Error(`Image restoration archive version ${manifest.archiveVersion} is not supported.`);
            if (!Number.isSafeInteger(manifest.schemaVersion) || manifest.schemaVersion < 1)
                throw new Error("Image restoration manifest schemaVersion must be a positive safe integer.");
            if (typeof manifest.exportedAt !== "string" || !manifest.exportedAt.trim())
                throw new Error("Image restoration manifest exportedAt must be non-empty text.");
            if (!isPlainObject(manifest.records) || !Array.isArray(manifest.assets))
                throw new Error("Image restoration manifest records and assets are invalid.");
            if (!Array.isArray(manifest.warnings))
                throw new Error("Image restoration manifest warnings must be an array.");
            for (const [index, warning] of manifest.warnings.entries()) {
                const warningFields = ["path", "imageId", "url", "generated", "message"];
                if (
                    !isPlainObject(warning) ||
                    Object.keys(warning).length !== warningFields.length ||
                    Object.keys(warning).some((field) => !warningFields.includes(field)) ||
                    warningFields.some((field) => !Object.hasOwn(warning, field))
                )
                    throw new Error(`Image restoration manifest warnings.${index} is invalid.`);
                if (
                    typeof warning.path !== "string" ||
                    typeof warning.imageId !== "string" ||
                    typeof warning.url !== "string" ||
                    typeof warning.generated !== "boolean" ||
                    typeof warning.message !== "string"
                )
                    throw new Error(`Image restoration manifest warnings.${index} has invalid field types.`);
            }
            return manifest;
        }

        async function remapImageRestorationSaveIds(records = {}) {
            const storyImages = Array.isArray(records.storyImages)
                ? records.storyImages
                : [];
            const storyImageTargets = Array.isArray(records.storyImageTargets)
                ? records.storyImageTargets
                : [];
            if (!storyImages.length && !storyImageTargets.length) return records;

            const currentSaveIds = new Set(
                saveIndexRecords().map((record) => String(record.saveId || "")),
            );
            const existingStoryImages = await app.persistence.listSharedRecords(
                "storyImages",
                { limit: 10000 },
            );
            const existingByImageId = new Map();
            for (const record of existingStoryImages.records || []) {
                const imageId = String(record.imageId || "");
                if (!imageId) continue;
                const matches = existingByImageId.get(imageId) || [];
                matches.push(record);
                existingByImageId.set(imageId, matches);
            }

            const saveIdMap = new Map();
            const rememberMapping = (sourceSaveId, targetSaveId, imageId) => {
                const source = String(sourceSaveId || "");
                const target = String(targetSaveId || "");
                const prior = saveIdMap.get(source);
                if (prior && prior !== target)
                    throw new Error(
                        `Image archive save ${source} maps to multiple imported saves while restoring ${imageId}.`,
                    );
                saveIdMap.set(source, target);
            };

            for (const record of storyImages) {
                const sourceSaveId = String(record.saveId || "");
                const imageId = String(record.imageId || "");
                const matches = existingByImageId.get(imageId) || [];
                const targetIds = [...new Set(matches.map((item) => String(item.saveId || "")))];
                if (targetIds.length > 1)
                    throw new Error(
                        `Image ${imageId} belongs to multiple local saves and cannot be restored unambiguously.`,
                    );
                if (targetIds.length === 1) {
                    rememberMapping(sourceSaveId, targetIds[0], imageId);
                    continue;
                }
                if (currentSaveIds.has(sourceSaveId)) {
                    rememberMapping(sourceSaveId, sourceSaveId, imageId);
                    continue;
                }
                throw new Error(
                    `Image archive save ${sourceSaveId} is not available. Import the matching data backup before importing its images.`,
                );
            }

            const remap = (record) => {
                const sourceSaveId = String(record.saveId || "");
                const targetSaveId = saveIdMap.get(sourceSaveId) ||
                    (currentSaveIds.has(sourceSaveId) ? sourceSaveId : "");
                if (!targetSaveId)
                    throw new Error(
                        `Image archive save ${sourceSaveId} is not available. Import the matching data backup before importing its images.`,
                    );
                return {
                    ...record,
                    saveId: Number(targetSaveId),
                };
            };
            records.storyImages = storyImages.map(remap);
            records.storyImageTargets = storyImageTargets.map(remap);
            return records;
        }

        async function normalizedImageImportPayload(files = {}) {
            const manifestBytes = files["manifest.json"];
            if (!manifestBytes)
                throw new Error("Image restoration archive does not contain manifest.json.");
            const manifest = exactImageRestorationManifest(
                JSON.parse(new TextDecoder().decode(manifestBytes)),
            );
            const omittedIds = new Set();
            const assetRecords = [];
            const imageIds = new Set();
            const assetFiles = new Set();

            for (const asset of manifest.assets) {
                const fields = ["imageId", "mimeType", "byteLength", "contentHash", "sha256", "file"];
                const unknown = Object.keys(asset || {}).filter((field) => !fields.includes(field));
                if (!isPlainObject(asset) || unknown.length || fields.some((field) => !Object.hasOwn(asset, field)))
                    throw new Error(`Image restoration asset ${asset?.imageId || "record"} is invalid.`);
                if (typeof asset.imageId !== "string" || !asset.imageId || asset.imageId.trim() !== asset.imageId)
                    throw new Error("Image restoration asset imageId must be exact non-empty text.");
                if (imageIds.has(asset.imageId))
                    throw new Error(`Image restoration manifest duplicates imageId ${asset.imageId}.`);
                imageIds.add(asset.imageId);
                if (typeof asset.mimeType !== "string" || !/^image\/[a-z0-9.+-]+$/i.test(asset.mimeType))
                    throw new Error(`Image restoration asset ${asset.imageId} has an invalid MIME type.`);
                if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength < 0)
                    throw new Error(`Image restoration asset ${asset.imageId} has an invalid byte length.`);
                if (typeof asset.contentHash !== "string" || !asset.contentHash)
                    throw new Error(`Image restoration asset ${asset.imageId} has an invalid content hash.`);
                if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256))
                    throw new Error(`Image restoration asset ${asset.imageId} has an invalid SHA-256 hash.`);
                if (
                    typeof asset.file !== "string" ||
                    !asset.file ||
                    asset.file.startsWith("/") ||
                    asset.file.includes("\\") ||
                    asset.file.split("/").some((part) => !part || part === "." || part === "..") ||
                    !asset.file.startsWith("images/")
                )
                    throw new Error(`Image restoration asset ${asset.imageId} has an invalid file path.`);
                if (assetFiles.has(asset.file))
                    throw new Error(`Image restoration manifest duplicates file ${asset.file}.`);
                assetFiles.add(asset.file);
                const bytes = files[asset.file];
                if (!bytes) {
                    omittedIds.add(String(asset.imageId));
                    continue;
                }
                if (bytes.length !== asset.byteLength)
                    throw new Error(`${asset.file} has the wrong byte length.`);
                if ((await imageArchiveSha256(bytes)) !== asset.sha256)
                    throw new Error(`${asset.file} failed its SHA-256 integrity check.`);
                assetRecords.push({
                    imageId: asset.imageId,
                    mimeType: asset.mimeType,
                    byteLength: asset.byteLength,
                    contentHash: asset.contentHash,
                    base64: imageArchiveBase64FromBytes(bytes),
                });
            }

            const approvedFiles = new Set([
                "manifest.json",
                "README.txt",
                ...manifest.assets.map((asset) => asset.file),
            ]);
            const unapprovedFile = Object.keys(files).find((file) => !approvedFiles.has(file));
            if (unapprovedFile)
                throw new Error(`Image restoration archive contains unapproved file ${unapprovedFile}.`);

            const records = await remapImageRestorationSaveIds(
                clone(manifest.records),
            );
            const restoredAssetIds = new Set(
                assetRecords.map((record) => String(record.imageId || "")),
            );
            for (const [storeName, values] of Object.entries(records)) {
                if (!Array.isArray(values))
                    throw new Error(`Image restoration records.${storeName} must be an array.`);
                records[storeName] = values.filter(
                    (record) => !omittedIds.has(String(record?.imageId || "")),
                );
                if (storeName === "assetBlobs") continue;
                for (const record of records[storeName]) {
                    const imageId = String(record?.imageId || "");
                    if (
                        imageId &&
                        restoredAssetIds.has(imageId) &&
                        /^blob:/i.test(String(record?.url || ""))
                    )
                        delete record.url;
                }
            }
            const selectionImageStores = {
                characterProfileImageSelections: "characterProfileImages",
                storyItemImageSelections: "storyItemImages",
                storyOutfitImageSelections: "storyOutfitImages",
                storyTitleImageSelections: "storyTitleImages",
            };
            const unresolvedSelections = [];
            for (const [selectionStore, imageStore] of Object.entries(selectionImageStores)) {
                const importedImageIds = new Set(
                    (records[imageStore] || []).map((record) => String(record?.imageId || "")),
                );
                for (const selection of records[selectionStore] || []) {
                    const imageId = selection?.imageId;
                    if (imageId == null || importedImageIds.has(String(imageId))) continue;
                    unresolvedSelections.push({ selectionStore, imageStore, selection });
                }
            }
            if (unresolvedSelections.length) {
                const currentIndex = await app.persistence.exportAllImageIndex();
                const currentImageIds = new Map(
                    Object.values(selectionImageStores).map((imageStore) => [
                        imageStore,
                        new Set(
                            (currentIndex.records?.[imageStore] || []).map(
                                (record) => String(record?.imageId || ""),
                            ),
                        ),
                    ]),
                );
                const orphanedSelections = new Set(
                    unresolvedSelections
                        .filter(({ imageStore, selection }) =>
                            !currentImageIds.get(imageStore)?.has(String(selection.imageId)),
                        )
                        .map(({ selection }) => selection),
                );
                for (const selectionStore of Object.keys(selectionImageStores))
                    records[selectionStore] = (records[selectionStore] || []).filter(
                        (selection) => !orphanedSelections.has(selection),
                    );
            }
            records.assetBlobs = assetRecords;
            return {
                payload: {
                    app: "EmberAdventures",
                    exportType: "all-images",
                    schemaVersion: manifest.schemaVersion,
                    records,
                },
                omitted: omittedIds.size,
            };
        }

        async function importAllImages() {
            const source = await showChoice(
                "Import All Images",
                "Choose an EmberAdventures image restoration ZIP or an extracted archive folder.",
                [
                    { value: "zip", label: "Choose ZIP", className: "primary" },
                    { value: "folder", label: "Choose Folder" },
                    { value: "cancel", label: "Cancel" },
                ],
            );
            if (!source || source === "cancel") return;
            const selected = source === "folder"
                ? await chooseImageArchiveFolder()
                : await chooseComputerImportFiles({
                      accept: "application/zip,.zip",
                      multiple: false,
                  });
            if (!selected.length) return;

            return withSavingOverlay(async () => {
                try {
                    const files = source === "folder"
                        ? await imageArchiveFilesFromFolder(selected)
                        : unzipStoredFiles(await selected[0].arrayBuffer());
                    const prepared = await normalizedImageImportPayload(files);
                    const result = await app.persistence.importAllImages(
                        new Blob([JSON.stringify(prepared.payload)], {
                            type: "application/json",
                        }),
                    );
                    app.profileImages = await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []);
                    app.storyTitleCardImages = await loadPerRecordLibrary(
                        STORY_TITLE_CARD_IMAGE_KEY,
                        [],
                    );
                    app.imageArchiveRestorePending = false;
                    refreshKeptImageRuntimeSet();
                    renderImagePanel();
                    refreshOpenImageViewer();
                    showNotice(
                        "Images Imported",
                        `Imported ${result.imported} normalized record${result.imported === 1 ? "" : "s"}, restored ${result.replaced || 0} selection${result.replaced === 1 ? "" : "s"}, and skipped ${result.skipped} exact existing record${result.skipped === 1 ? "" : "s"}${prepared.omitted ? `, while intentionally omitting ${prepared.omitted} image${prepared.omitted === 1 ? "" : "s"} with deleted files` : ""}.`,
                    );
                } catch (error) {
                    showNotice("Image Import Failed", error?.message || String(error));
                }
            }, "Importing all images...");
        }

        async function uploadImageMetadata() {
            const files = await chooseImportFiles({
                accept: `${COMPRESSED_JSON_IMPORT_ACCEPT},application/zip,.zip`,
                multiple: true,
            });
            if (!files.length) return;
                return withSavingOverlay(async () => {
                try {
                    let imported = 0;
                    for (const file of files) {
                        const data = /\.zip$/i.test(file.name)
                            ? imageMetadataFromZip(await file.arrayBuffer())
                            : JSON.parse(await compressedJsonBlobText(file, file.name));
                        imported += importImageMetadataPayload(data);
                    }
                    refreshKeptImageRuntimeSet();
                    if (!(await flushActiveGameSave())) return;
                    renderImagePanel();
                    refreshOpenImageViewer();
                    showNotice(
                        "Images Imported",
                        `Imported ${imported} image${imported === 1 ? "" : "s"} as local records.`,
                    );
                } catch (err) {
                    showNotice("Image Upload Failed", err.message || String(err));
                }
                }, files.length === 1 ? "Importing image data..." : `Importing ${files.length} image files...`);
        }

        function imageMetadataFromZip(buffer) {
            const files = unzipStoredFiles(buffer);
            const metadata = files["metadata.json"];
            if (!metadata) throw new Error("Image zip did not contain metadata.json.");
            return JSON.parse(new TextDecoder().decode(metadata));
        }

        function unzipStoredFiles(buffer) {
            const bytes = new Uint8Array(buffer);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const files = {};
            let offset = 0;
            while (offset + 30 <= bytes.length) {
                const sig = view.getUint32(offset, true);
                if (sig !== 0x04034b50) break;
                const method = view.getUint16(offset + 8, true);
                const compressedSize = view.getUint32(offset + 18, true);
                const nameLength = view.getUint16(offset + 26, true);
                const extraLength = view.getUint16(offset + 28, true);
                const nameStart = offset + 30;
                const dataStart = nameStart + nameLength + extraLength;
                const dataEnd = dataStart + compressedSize;
                if (dataEnd > bytes.length) break;
                const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
                if (method !== 0)
                    throw new Error(`Unsupported compressed image archive entry: ${name}`);
                files[name] = bytes.slice(dataStart, dataEnd);
                offset = dataEnd;
            }
            return files;
        }

        function importImageMetadataPayload(data) {
            const images = [
                ...(Array.isArray(data?.images) ? data.images : []),
                ...(Array.isArray(data?.profileImages)
                    ? data.profileImages.map((image) => ({
                          ...image,
                          archive_kind: image.archive_kind || "profile",
                      }))
                    : []),
            ];
            if (!images.length) return 0;
            let count = 0;
            for (const raw of images) {
                const image = { ...raw, favorite: raw.favorite === true };
                const kind = String(raw.archive_kind || "").toLowerCase();
                if (kind === "profile" || raw.profile || raw.owner_name) {
                    const record = exactProfileImageStore([image])[0];
                    upsertProfileStoreImage(
                        { ...record, favorite: record.favorite === true },
                        record.owner_name,
                    );
                    count++;
                } else {
                    const record = safeImageHistoryForStorage([
                        { ...image, favorite: image.favorite === true },
                    ])[0];
                    if (!record) continue;
                    const index = (app.images || []).findIndex(
                        (item) => String(item.id) === String(record.id),
                    );
                    if (index >= 0)
                        app.images[index] = {
                            ...app.images[index],
                            ...record,
                            favorite: record.favorite === true,
                        };
                    else app.images = [record, ...(app.images || [])];
                    count++;
                }
            }
            app.images = safeImageHistoryForStorage(app.images || []);
            app.profileImages = exactProfileImageStore(app.profileImages || []);
            return count;
        }

        function profileImageNames() {
            const names = [
                "Player",
                ...Object.keys(app.state.characters || {}),
            ];
            for (const location of Object.values(
                app.state.npc_directory?.locations || {},
            )) {
                for (const [name, npc] of Object.entries(location?.characters || {})) {
                    if (!npc?.inspected || !npc.full_character) continue;
                    names.push(name);
                }
            }
            return [...new Set(names)].filter((name) => profileEntity(name));
        }

        function isPlayerProfileImageName(name, state = app.state) {
            const value = String(name || "").trim();
            if (!value) return false;
            if (value === "Player") return true;
            const playerName = String(state?.player?.name || "").trim();
            return !!playerName && value === playerName;
        }

        function activeCastProfileImageNames(state = app.state) {
            const names = [
                ...(state?.scene?.party_members_present || []),
                ...(state?.scene?.npcs_present || []),
                ...(state?.scene?.image_characters || []),
            ];
            return [...new Set(names)]
                .filter((name) => !isPlayerProfileImageName(name, state))
                .filter(Boolean)
                .filter((name) => profileEntity(name));
        }

        function ensureProfileImagesForAll(reason = "auto") {
            if (!app.state?.meta?.setup_complete) return;
            if (reason === "startup" && app.profileImagesBootstrapped) return;
            if (reason === "startup") app.profileImagesBootstrapped = true;
            const normalizedReason = normalizedProfileImageReason(reason);
            const activeCastOnly = ACTIVE_CAST_PROFILE_REASONS.has(normalizedReason);
            const names =
                activeCastOnly
                    ? activeCastProfileImageNames(app.state)
                    : profileImageNames();
            if (["startup", "story template start"].includes(normalizedReason))
                names.unshift("Player");
            for (const name of names) {
                const entity = profileEntity(name);
                if (!profileImageEntityHasOwnerIdentity(name, entity)) continue;
                const ownerKey = profileImageOwnerKey(name, entity);
                const active = activeProfileImageForAutomaticQueue(entity);
                const stalePending =
                    active?.pending &&
                    !isActiveProfileImageRecord(active) &&
                    !app.profileImageGenerating.has(ownerKey) &&
                    !app.profileImageQueued.has(ownerKey);
                if (!active || profileImageNeedsGeneration(active) || stalePending)
                    queueMissingProfileImageAfterDefaultAttempt(name, reason, {
                        reason,
                        force: !!active || stalePending,
                        allowImportSkipped: true,
                        pendingImageId: stalePending ? active?.id || "" : "",
                    });
            }
        }

        function queueProfileImagesForNames(names = [], reason = "auto") {
            const allowImportSkipped = PROFILE_IMPORT_SKIP_CLEAR_REASONS.has(
                normalizedProfileImageReason(reason),
            );
            for (const name of names) {
                const entity = profileEntity(name);
                if (!profileImageEntityHasOwnerIdentity(name, entity)) continue;
                const ownerKey = profileImageOwnerKey(name, entity);
                const active = activeProfileImageForAutomaticQueue(entity);
                const requestInFlight =
                    isActiveProfileImageRecord(active) ||
                    app.profileImageGenerating.has(ownerKey) ||
                    app.profileImageQueued.has(ownerKey);
                const stalePending =
                    active?.pending &&
                    !isActiveProfileImageRecord(active) &&
                    !app.profileImageGenerating.has(ownerKey) &&
                    !app.profileImageQueued.has(ownerKey);
                if (
                    entity &&
                    !requestInFlight &&
                    (!active || profileImageNeedsGeneration(active) || stalePending)
                )
                    queueMissingProfileImageAfterDefaultAttempt(name, reason, {
                        reason,
                        force: !!active || stalePending,
                        allowImportSkipped,
                        pendingImageId: stalePending ? active?.id || "" : "",
                    });
            }
        }

        function queueProfileImageIfMissing(name, reason = "profile missing", options = {}) {
            const entity = profileEntity(name);
            if (!profileImageEntityHasOwnerIdentity(name, entity)) return false;
            const ownerKey = profileImageOwnerKey(name, entity);
            const active = activeProfileImageForAutomaticQueue(entity);
            if (
                isActiveProfileImageRecord(active) ||
                app.profileImageGenerating.has(ownerKey) ||
                app.profileImageQueued.has(ownerKey)
            )
                return false;
            const stalePending =
                active?.pending &&
                !isActiveProfileImageRecord(active) &&
                !app.profileImageGenerating.has(ownerKey) &&
                !app.profileImageQueued.has(ownerKey);
            if (!active || profileImageNeedsGeneration(active) || stalePending) {
                queueMissingProfileImageAfterDefaultAttempt(name, reason, {
                    reason,
                    skipDefault: options.skipDefault === true,
                    force: !!active || stalePending,
                    allowImportSkipped:
                        options.allowImportSkipped === true ||
                        PROFILE_IMPORT_SKIP_CLEAR_REASONS.has(
                            normalizedProfileImageReason(reason),
                        ),
                    allowDuringSmoke: options.allowDuringSmoke === true,
                    allowRuntimeProfileGeneration:
                        options.allowRuntimeProfileGeneration === true,
                    pendingImageId: stalePending ? active?.id || "" : "",
                });
                return true;
            }
            return false;
        }

        function queueMissingProfileImagesForSceneAdditions(
            beforeState,
            afterState = app.state,
            reason = "entered scene",
        ) {
            const sceneNames = (state) =>
                new Set([
                    ...(state?.scene?.party_members_present || []),
                    ...(state?.scene?.npcs_present || []),
                    ...(state?.scene?.image_characters || []),
                ].filter(Boolean));
            const beforeNames = sceneNames(beforeState);
            const added = [...sceneNames(afterState)].filter(
                (name) => !beforeNames.has(name) && !isPlayerEntityName(name, afterState),
            );
            // Scene updates may surface a full character/NPC before the player opens
            // their card. Queue only newly added entities that lack a portrait so
            // entering a scene does not regenerate existing profile images.
            for (const name of added) queueProfileImageIfMissing(name, reason);
        }

        function sceneProfileCardNames(state = app.state) {
            const scene = state?.scene || {};
            return [
                ...new Set(
                    [
                        "Player",
                        ...(scene.party_members_present || []),
                        ...(scene.npcs_present || []),
                    ]
                        .map((name) => String(name || "").trim())
                        .filter(Boolean),
                ),
            ];
        }

        function queueMissingProfileImagesForSceneCards(
            reason = "scene card profile watchdog",
            options = {},
        ) {
            if (stateIsNotActiveGameContext() || app.mainMenuOpen) return 0;
            if (devSmokeSuiteState()?.running && !options.allowDuringSmoke) return 0;
            let queued = 0;
            for (const name of sceneProfileCardNames(app.state)) {
                if (queueProfileImageIfMissing(name, reason, {
                    allowDuringSmoke: options.allowDuringSmoke === true,
                    allowRuntimeProfileGeneration: true,
                })) queued++;
            }
            return queued;
        }

        function startSceneProfileImageWatchdog() {
            if (app.sceneProfileImageWatchdogTimer) return;
            app.sceneProfileImageWatchdogTimer = setInterval(
                () => queueMissingProfileImagesForSceneCards(),
                1000,
            );
        }

        function preserveGeneratedProfileImages(targetState, sourceState = app.state) {
            if (!targetState || !sourceState || targetState === sourceState)
                return targetState;
            const copyProfileFields = (target, source) => {
                if (!target || !source) return;
                resolveActiveProfileImageReference(source);
                resolveActiveProfileImageReference(target);
                if (!activeProfileImage(target) && activeProfileImage(source)) {
                    target.profile_images = clone(source.profile_images || []);
                    target.profile_image_id = source.profile_image_id || "";
                }
            };
            copyProfileFields(targetState.player, sourceState.player);
            for (const [name, targetCharacter] of Object.entries(
                targetState.characters || {},
            )) {
                copyProfileFields(
                    targetCharacter,
                    sourceState.characters?.[name],
                );
            }
            return targetState;
        }

        function queueProfileImage(name, options = {}) {
            const traceGeneratedJobQueueExit = (reason, details = {}) => {
                if (normalizedProfileImageReason(options.reason) !== "generated job npc")
                    return;
                devTestLog("Generated job profile queue exited", {
                    name,
                    reason,
                    ...details,
                });
            };
            // Smoke restore is not gameplay. Restoring the player's runtime can
            // expose missing portraits, but automatic discovery must stay idle
            // until the suite has finished restoring every canonical store.
            if (devSmokeSuiteBlocksImageWork() && options.allowDuringSmoke !== true) {
                traceGeneratedJobQueueExit("smoke guard");
                devTestLog("Profile image queue skipped during smoke restore", {
                    name: String(name || ""),
                    reason: String(options.reason || ""),
                });
                return false;
            }
            const entity = profileEntity(name);
            if (!entity) {
                traceGeneratedJobQueueExit("entity missing");
                return false;
            }
            const ownerKey = profileImageOwnerKey(name, entity);
            const reason = String(options.reason || "");
            const importSkipCanBeCleared =
                options.allowImportSkipped ||
                PROFILE_IMPORT_SKIP_CLEAR_REASONS.has(
                    normalizedProfileImageReason(reason),
                );
            if (entity.profile_image_auto_skip && !importSkipCanBeCleared) {
                traceGeneratedJobQueueExit("automatic profile skipped", {
                    allowImportSkipped: options.allowImportSkipped === true,
                });
                return false;
            }
            if (entity.profile_image_auto_skip && importSkipCanBeCleared)
                delete entity.profile_image_auto_skip;
            const active = activeProfileImageForAutomaticQueue(entity);
            if (isActiveProfileImageRecord(active) && !options.force) {
                traceGeneratedJobQueueExit("active request exists");
                return false;
            }
            if (active && !options.force) {
                traceGeneratedJobQueueExit("active profile exists", { active });
                return false;
            }
            if (
                app.profileImageGenerating.has(ownerKey) ||
                app.profileImageQueued.has(ownerKey)
            )
            {
                traceGeneratedJobQueueExit("owner already queued", { ownerKey });
                return false;
            }
            if (app.imageArchiveRestorePending && options.manual !== true) {
                traceGeneratedJobQueueExit("image archive restore pending");
                return false;
            }
            const characterId = String(entity.id || "").trim();
            const expectedMale = profileImageMalePresentation(entity);
            const pendingImageId = String(options.pendingImageId || "").trim();
            if (pendingImageId) {
                const pendingRecord = profileStoreImageById(pendingImageId);
                if (!pendingRecord)
                    throw new Error(
                        `Profile image retry ${pendingImageId} does not reference an existing stored image.`,
                    );
                if (String(pendingRecord.character_id || "").trim() !== characterId)
                    throw new Error(
                        `Profile image retry ${pendingImageId} does not belong to character ${characterId}.`,
                    );
                if (pendingRecord.male !== expectedMale)
                    throw new Error(
                        `Profile image retry ${pendingImageId} does not match the character's current presentation.`,
                    );
            }
            let seed = 0;
            try {
                seed = profileImageGenerationSeed(entity, options);
            } catch (err) {
                traceGeneratedJobQueueExit("queue identity creation failed", {
                    error: err?.message || String(err),
                });
                log(
                    "Profile image queue failed",
                    err?.message || String(err),
                    {
                        type: "image",
                        level: "error",
                        details: {
                            requestedName: String(name || "").trim(),
                            resolvedName: String(entity?.name || "").trim(),
                            characterId: profileEntityCharacterId(entity),
                            gender: String(entity?.gender || ""),
                            profileImageId: String(entity?.profile_image_id || ""),
                            activeImage: Array.isArray(entity?.profile_images)
                                ? entity.profile_images.find(
                                      (image) =>
                                          String(image?.id || "") ===
                                          String(entity?.profile_image_id || ""),
                                  ) || null
                                : null,
                        },
                    },
                );
                return false;
            }
            app.profileImageQueued.add(ownerKey);
            const shouldUseRandomSeed = options.randomSeed === true;
            app.profileImageQueue.push({
                name,
                characterId,
                ownerKey,
                options: {
                    ...options,
                    seed,
                    randomSeed: shouldUseRandomSeed,
                    pendingImageId,
                    ownerKey,
                    expectedMale,
                },
            });
            document
                .querySelectorAll(
                    `[data-profile-owner-key="${cssEscape(ownerKey)}"]`,
                )
                .forEach((target) => {
                    target.innerHTML = profileImageLoadingHtml(
                        "Profile image generation in progress",
                    );
                });
            refreshOpenProfileImageModal(name);
            runProfileImageQueue().catch((err) => {
                log(
                    "Profile image queue failed",
                    err?.message || String(err),
                    { type: "image", level: "error" },
                );
            });
            return true;
        }

        function profilePromptEntityWithoutEditorIgnoredFields(entity = {}) {
            const draft = clone(entity || {});
            delete draft.clothing;
            delete draft.outfits;
            delete draft.active_outfit_id;
            delete draft.starting_outfit_id;
            return draft;
        }

        function profileImagePromptSignature(name, entity, options = {}) {
            const signatureEntity = options.ignoreEditorOutfitFields
                ? profilePromptEntityWithoutEditorIgnoredFields(entity)
                : entity;
            const model = resolvedProfileImageModel(signatureEntity);
            const styled = applyImageArtStyle(
                buildProfileImagePrompt(name, signatureEntity),
                buildProfileNegativePrompt(signatureEntity),
                model,
            );
            return {
                model,
                prompt: styled.prompt,
                negativePrompt: styled.negativePrompt,
            };
        }

        function profileEditorRefreshSignature(name, entity) {
            return profileImagePromptSignature(name, entity, {
                ignoreEditorOutfitFields: true,
            });
        }

        function profileImagePromptSignaturesMatch(left, right) {
            return (
                selectedImageModel(left?.model) === selectedImageModel(right?.model) &&
                String(left?.prompt || "") === String(right?.prompt || "") &&
                String(left?.negativePrompt || "") ===
                    String(right?.negativePrompt || "")
            );
        }

        function profileImagePromptChanged(name, entity) {
            const active = activeProfileImageForAutomaticQueue(entity);
            if (!active) return false;
            const signature = profileImagePromptSignature(name, entity);
            return (
                selectedImageModel(active.model) !== signature.model ||
                String(active.prompt || "") !== String(signature.prompt || "") ||
                String(active.negativePrompt || "") !==
                    String(signature.negativePrompt || "")
            );
        }

        function queueProfileImageIfNeeded(name, reason = "profile changed") {
            const entity = profileEntity(name);
            if (!entity) return;
            const ownerKey = profileImageOwnerKey(name, entity);
            const active = activeProfileImageForAutomaticQueue(entity);
            const stalePending =
                active?.pending &&
                !isActiveProfileImageRecord(active) &&
                !app.profileImageGenerating.has(ownerKey) &&
                !app.profileImageQueued.has(ownerKey);
            if (!active || profileImageNeedsGeneration(active)) {
                queueMissingProfileImageAfterDefaultAttempt(name, reason, {
                    reason,
                    force: !!active || stalePending,
                    pendingImageId: stalePending ? active?.id || "" : "",
                });
                return;
            }
            // Editor autosaves can change profile prompt text. A
            // prompt-signature change queues a new profile image after editor
            // close; it must not overwrite the existing active image record.
            if (stalePending || profileImagePromptChanged(name, entity)) {
                queueProfileImage(name, {
                    reason,
                    force: true,
                    pendingImageId: stalePending ? active?.id || "" : "",
                });
            }
        }

        function startManualProfileImageGeneration(name, options = {}) {
            if (!profileEntity(name)) return;
            generateProfileImage(name, {
                ...options,
                manual: true,
                randomSeed: options.randomSeed === true,
                reason: options.reason || "manual profile",
                source: options.source || "generated",
            }).finally(() => {
                refreshOpenProfileImageModal(name);
            });
        }

        function imageSrcFromHtml(html = "") {
            const text = String(html || "");
            if (!text) return "";
            try {
                const container = document.createElement("div");
                container.innerHTML = text;
                return String(container.querySelector("img")?.getAttribute("src") || "");
            } catch {
                const match = text.match(/<img\b[^>]*\bsrc=(["'])(.*?)\1/i);
                return match ? String(match[2] || "") : "";
            }
        }

        function setGeneratedProfileImageAsDefault(name, record, options = {}) {
            const entity = profileEntity(name);
            if (!entity || !record) return false;
            const html = profileImageRealHtml(record.html || record);
            if (!html || !record.id) return false;
            // Profile-image rule: a reusable definition stores only a default
            // local pointer plus optional hosted URL/metadata. It never stores
            // profile-image history or generated data URLs in the definition.
            const current = profileImageSlotFromExactInput(entity.default_profile_image);
            const currentConfigured = !!(current.url || current.local_image_id);
            if (!currentConfigured || current.male === record.male) {
                entity.default_profile_image = profileImageSlotFromExactInput({
                    ...current,
                    url: record.hosted_url || current.url || "",
                    local_image_id: String(record.id),
                    source: options.source || "generated-in-emberadventures",
                    seed: record.seed ?? null,
                    prompt: record.prompt || "",
                    negative_prompt: "",
                    note:
                        options.note ||
                        "Generated in EmberAdventures and stored as this character's default profile image.",
                    male: record.male,
                });
            }
            entity.profile_image_id = String(record.id);
            entity.profile_default_image_attempted_url = "";
            scheduleActiveGameSave();
            refreshProfileImageSurfaces(name);
            refreshOpenProfileImageModal(name);
            return true;
        }

        async function generateDefaultProfileImageForCharacter(name) {
            const entity = profileEntity(name);
            if (!entity) return;
            const record = await generateProfileImage(name, {
                manual: true,
                randomSeed: true,
                reason: "generated default profile image",
                source: "generated default",
            });
            if (setGeneratedProfileImageAsDefault(name, record)) {
                showNotice(
                    "Default Image Saved",
                    `${profileDisplayName(name)} now has this generated profile image saved as the default image.`,
                );
            } else {
                showNotice(
                    "Default Image Failed",
                    "The profile image did not finish with a usable image, so it could not be saved as the default image.",
                );
            }
        }

        async function runProfileImageQueue() {
            if (app.profileImageQueueRunning) return;
            const generation = app.gameRuntimeGeneration;
            app.profileImageQueueRunning = true;
            try {
                while (app.profileImageQueue.length) {
                    if (generation !== app.gameRuntimeGeneration) return;
                    const next = app.profileImageQueue[0];
                    await waitForNormalImageRequestsIdle(
                        "profile image queue",
                        generation,
                    );
                    if (generation !== app.gameRuntimeGeneration) return;
                    app.profileImageQueue.shift();
                    const ownerKey = next.ownerKey || next.name;
                    try {
                        await generateProfileImage(next.name, {
                            ...next.options,
                            characterId: next.characterId || next.options?.characterId || "",
                        });
                    } finally {
                        const ownerStillQueued = app.profileImageQueue.some(
                            (item) => (item.ownerKey || item.name) === ownerKey,
                        );
                        if (!ownerStillQueued) {
                            app.profileImageQueued.delete(ownerKey);
                            // The Characters modal intentionally queues one visible
                            // missing portrait at a time. Its completion refresh can
                            // happen before this owner leaves the queue, so ask the
                            // modal to select the next missing card after ownership
                            // is released.
                            queueFirstVisibleCastMissingProfile?.();
                        }
                    }
                }
            } finally {
                app.profileImageQueueRunning = false;
            }
        }

        async function waitForNormalImageRequestsIdle(
            reason = "image queue",
            generation = app.gameRuntimeGeneration,
        ) {
            let logged = false;
            while (
                generation === app.gameRuntimeGeneration &&
                (app.activeImageRequests?.size ||
                    perfNow() < Math.max(0, Number(app.normalImagePriorityUntil) || 0))
            ) {
                if (!logged) {
                    logged = true;
                    devLog("Profile image queue waiting for normal image", {
                        label: "image generation",
                        reason,
                        activeImageRequests: [
                            ...(app.activeImageRequests || new Set()),
                        ],
                        normalImagePriorityUntil:
                            Math.max(0, Number(app.normalImagePriorityUntil) || 0),
                        summary:
                            "Profile image generation is waiting so it does not run beside a normal image request or immediate normal-image startup.",
                    });
                }
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }

        async function generateProfileImage(name, options = {}) {
            const generation = app.gameRuntimeGeneration;
            const entity = profileEntityForHandle(name, options.characterId);
            const manual = options.manual === true;
            if (!entity) return null;
            const characterId = String(entity.id || "").trim();
            if (!characterId)
                throw new Error("Profile image generation requires the character's exact id.");
            if (options.characterId && String(options.characterId) !== characterId)
                throw new Error(
                    `Profile image request character changed from ${options.characterId} to ${characterId}.`,
                );
            const expectedMale = options.expectedMale;
            if (
                typeof expectedMale === "boolean" &&
                profileImageMalePresentation(entity) !== expectedMale
            )
                return null;
            const ownerKey = String(options.ownerKey || profileImageOwnerKey(name, entity));
            if (ownerKey !== profileImageOwnerKey(name, entity))
                throw new Error("Profile image request ownership changed before generation.");
            let record = null;
            let generationKey = "";
            let livePerchanceOutputSeen = false;
            try {
                if (!manual) {
                    await waitForNormalImageRequestsIdle(
                        options.reason || "automatic profile image generation",
                        generation,
                    );
                    if (generation !== app.gameRuntimeGeneration) return null;
                }
                const seed = profileImageGenerationSeed(entity, options);
                const model = resolvedProfileImageModel(entity, options);
                const rawPrompt = sanitizeImagePromptForMode(
                    options.prompt || buildProfileImagePrompt(name, entity),
                    { entity },
                );
                const rawNegativePrompt =
                    options.negativePrompt ||
                    buildProfileNegativePrompt(entity, {});
                const styled = options.exactPrompt
                    ? { prompt: rawPrompt, negativePrompt: rawNegativePrompt }
                    : applyImageArtStyle(rawPrompt, rawNegativePrompt, model);
                const prompt = styled.prompt;
                const negativePrompt = styled.negativePrompt;
                record = options.pendingImageId
                    ? profileImageById(entity, options.pendingImageId)
                    : null;
                log(
                    "Profile image prompt before send",
                    `Character: ${profileDisplayName(name)}\nReason: ${options.reason || "profile"}\nStyle: ${imageModelLabel(model)}\nSeed: ${seed}\nNegative: ${negativePrompt || "(none)"}\n\n${prompt}`,
                    { type: "image", level: "message" },
                );
                if (record) {
                    Object.assign(record, {
                        source: options.source || record.source || "generated",
                        model,
                        seed,
                        prompt,
                        negativePrompt,
                        profile: true,
                        male: profileImageMalePresentation(entity),
                        pending: true,
                        error: "",
                    });
                    updateProfileImageHtml(name, record.id, record.html, {
                        characterId,
                        pending: true,
                        error: "",
                        source: record.source,
                        model: record.model,
                        seed: record.seed,
                        prompt: record.prompt,
                        negativePrompt: record.negativePrompt,
                        profile: record.profile,
                        male: record.male,
                    });
                } else {
                    record = rememberProfileImage(name, {
                        character_id: characterId,
                        source: options.source || "generated",
                        model,
                        seed,
                        prompt,
                        negativePrompt,
                        html: imageLoadingHtml(""),
                        profile: true,
                        male: profileImageMalePresentation(entity),
                        pending: true,
                    }, { characterId, setActive: false, save: false });
                }
                if (!record) return null;
                livePerchanceOutputSeen = !!profileImageRealHtml(record.html);
                supersedeActiveProfileImageRequest(
                    ownerKey,
                    record,
                    options.reason || "profile",
                );
                generationKey = ownerKey;
                app.profileImageGenerating.add(generationKey);
                app.activeProfileImageRequestByOwner ||= {};
                app.profileImageRequestOwnerById ||= {};
                app.supersededProfileImageRequests ||= new Set();
                app.supersededProfileImageRequests.delete(String(record.id));
                app.activeProfileImageRequestByOwner[ownerKey] = String(record.id);
                app.profileImageRequestOwnerById[String(record.id)] = ownerKey;
                refreshOpenProfileImageModal(name);
                app.activeProfileImageRequests.add(String(record.id));
                devLogProfileImageLifecycle("Profile image request started", name, record, {
                    reason: options.reason || "profile",
                    ownerKey,
                    manual,
                    model,
                    seed,
                    promptLength: prompt.length,
                    negativePromptLength: negativePrompt.length,
                });
                let iframeLogged = false;
                const watchdogIds = [10000, 30000, 60000].map((delayMs) =>
                    setTimeout(() => {
                        if (!isCurrentProfileImageRequest(ownerKey, record)) return;
                        devLogProfileImageLifecycle(
                            `Profile image request still pending after ${formatDurationMs(delayMs)}`,
                            name,
                            record,
                            {
                                delayMs,
                                summary:
                                    "Profile image request is still active; this records whether the plugin iframe or stable image HTML has appeared.",
                            },
                        );
                    }, delayMs),
                );
                const html = await generateImageHtml(
                        prompt,
                        negativePrompt,
                        seed,
                        model,
                        {
                            label: manual ? "manual profile image generation" : "profile image generation",
                            promptType: manual ? "manual profile image" : "profile image",
                            promptEditorReplay: {
                                name,
                                manual,
                                reason: options.reason || "profile",
                            },
                            resolution: PROFILE_IMAGE_RESOLUTION,
                            timeoutMs: options.timeoutMs,
                            onPluginResult: (resultObj) => {
                                if (generation !== app.gameRuntimeGeneration) return;
                                if (!record) return;
                                if (!isCurrentProfileImageRequest(ownerKey, record)) return;
                                devLogProfileImageLifecycle(
                                    "Profile image plugin result object received",
                                    name,
                                    record,
                                    {
                                        pluginResult:
                                            imagePluginResultDebugSummary(resultObj),
                                    },
                                );
                                const resultHtml = profileImageRealHtml(resultObj);
                                if (/<iframe\b/i.test(String(resultHtml || ""))) return;
                                if (!resultHtml) return;
                                livePerchanceOutputSeen = true;
                                renderLiveProfileImageResult(
                                    name,
                                    record.id,
                                    resultHtml,
                                    characterId,
                                );
                                updateProfileImageHtml(name, record.id, resultHtml, {
                                    characterId,
                                    pending: true,
                                    error: "",
                                    source: record.source,
                                    model: record.model,
                                    seed: record.seed,
                                    prompt: record.prompt,
                                    negativePrompt: record.negativePrompt,
                                    profile: record.profile,
                                    male: record.male,
                                });
                            },
                            onIframe: (iframeHtml, iframeEl = null) => {
                                if (generation !== app.gameRuntimeGeneration) return;
                                if (!record) return;
                                if (!isCurrentProfileImageRequest(ownerKey, record)) return;
                                if (!iframeLogged) {
                                    iframeLogged = true;
                                    devLogProfileImageLifecycle(
                                        "Profile image plugin iframe received",
                                        name,
                                        record,
                                        {
                                            iframeHtmlKind:
                                                imageHtmlDebugKind(iframeHtml),
                                            iframeHtmlStart: String(
                                                iframeHtml || "",
                                            ).slice(0, 180),
                                        },
                                    );
                                }
                            },
                            ensureIframeHost: true,
                            iframeHostKey: profileImageRequestIframeHostKey(ownerKey),
                            suppressVisibleIframe: false,
                        },
                    ).finally(() => {
                    watchdogIds.forEach(clearTimeout);
                });
                devLogProfileImageLifecycle("Profile image plugin await finished", name, record, {
                    returnedHtmlKind: imageHtmlDebugKind(html),
                    returnedHtmlStart: String(html || "").slice(0, 180),
                    livePerchanceOutputSeen,
                    ownerKey,
                });
                if (generation !== app.gameRuntimeGeneration) return null;
                if (!isCurrentProfileImageRequest(ownerKey, record)) {
                    devLogProfileImageLifecycle(
                        "Profile image late result ignored",
                        name,
                        record,
                        {
                            ownerKey,
                            summary:
                                "A newer profile image request for this owner is active, so this result is ignored.",
                        },
                    );
                    return null;
                }
                const completedEntity = profileEntityForHandle(name, characterId);
                if (
                    !completedEntity ||
                    String(completedEntity.id || "").trim() !== characterId ||
                    profileImageOwnerKey(name, completedEntity) !== ownerKey
                )
                    throw new Error(
                        "Profile image result no longer exactly matches its requested character and presentation.",
                    );
                updateProfileImageHtml(
                    name,
                    record.id,
                    html ||
                        record.html ||
                        imageLoadingHtml("Image plugin returned no usable image."),
                    {
                        characterId,
                        pending: !(html || livePerchanceOutputSeen),
                        error:
                            html || livePerchanceOutputSeen
                                ? ""
                                : "Profile image returned no usable image.",
                        source: record.source,
                        model: record.model,
                        seed: record.seed,
                        prompt: record.prompt,
                        negativePrompt: record.negativePrompt,
                        profile: record.profile,
                        male: record.male,
                    },
                );
                devLogProfileImageLifecycle("Profile image stored successfully", name, record, {
                    returnedHtmlKind: imageHtmlDebugKind(html),
                    livePerchanceOutputSeen,
                });
                if (record && (html || livePerchanceOutputSeen)) {
                    const refreshedEntity = profileEntityForHandle(name, characterId);
                    if (refreshedEntity) {
                        refreshedEntity.profile_image_id = record.id;
                        setLocalDefaultProfileImage(refreshedEntity, record.id, record, {
                            keepUrl: true,
                            save: false,
                        });
                        syncCharacterLibraryProfileSelection(name, record.id);
                        scheduleActiveGameSave();
                        refreshProfileImageSurfaces(name);
                        await app.work.flush(
                            `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                        );
                        await app.work.flush(
                            `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                        );
                    }
                }
                log(
                    record ? "Profile image saved" : "Profile image not saved",
                    record && (html || livePerchanceOutputSeen)
                        ? `${profileDisplayName(name)} profile image updated.`
                        : `${profileDisplayName(name)} profile image returned no usable image.`,
                    {
                        type: "image",
                        level: record && (html || livePerchanceOutputSeen) ? "message" : "error",
                    },
                );
                return record;
            } catch (err) {
                if (generation !== app.gameRuntimeGeneration) return null;
                if (record && !isCurrentProfileImageRequest(ownerKey, record)) {
                    devLogProfileImageLifecycle(
                        "Profile image superseded failure ignored",
                        name,
                        record,
                        {
                            ownerKey,
                            error: err?.message || String(err),
                            summary:
                                "A replaced profile image request failed or timed out after a newer request started; this is ignored.",
                        },
                    );
                    return null;
                }
                if (record?.pending)
                    updateProfileImageHtml(
                        name,
                        record.id,
                        imageLoadingHtml(err.message || String(err)),
                        {
                            pending: false,
                            error: err.message || String(err),
                        },
                    );
                devLogProfileImageLifecycle("Profile image request failed", name, record, {
                    error: err?.message || String(err),
                });
                log(
                    "Profile image failed",
                    `${profileDisplayName(name)}: ${err.message || err}`,
                    { type: "image", level: imageRequestFailureLogLevel(err) },
                );
                return null;
            } finally {
                const requestIsCurrent = record
                    ? isCurrentProfileImageRequest(ownerKey, record)
                    : false;
                if (record?.id) {
                    app.activeProfileImageRequests.delete(String(record.id));
                    if (app.profileImageRequestOwnerById)
                        delete app.profileImageRequestOwnerById[String(record.id)];
                    app.supersededProfileImageRequests?.delete?.(String(record.id));
                }
                if (
                    requestIsCurrent &&
                    app.activeProfileImageRequestByOwner?.[ownerKey] === String(record?.id || "")
                ) {
                    delete app.activeProfileImageRequestByOwner[ownerKey];
                }
                if (
                    generationKey &&
                    (requestIsCurrent || !activeProfileImageRequestIdForOwner(ownerKey))
                )
                    app.profileImageGenerating.delete(generationKey);
                else if (!generationKey) app.profileImageGenerating.delete(name);
                if (generation !== app.gameRuntimeGeneration) return;
                devLogProfileImageLifecycle("Profile image request finalized", name, record, {
                    activeRequestCleared: !!record?.id,
                });
                scheduleActiveGameSave();
                refreshOpenProfileImageModal(
                    profileEntityForHandle(name, record?.character_id)?.name || name,
                );
                runPendingPresenceCleanupIfIdle();
                setTimeout(() => queueFirstVisibleCharacterLibraryMissingProfile(), 0);
            }
        }

        function isActiveProfileImageRecord(image) {
            return !!image?.id && app.activeProfileImageRequests?.has?.(String(image.id));
        }

        function buildProfileImagePrompt(name, entity, options = {}) {
            if (isUninspectedNpcPreviewEntity(entity))
                return buildUninspectedNpcPreviewImagePrompt(name, entity);
            if (imageEntityIsAnimal(entity)) {
                return joinPromptParts([
                    `portrait of ${cleanPromptText(entity.name || profileDisplayName(name) || name)}`,
                    cleanPromptText(entity.species),
                    cleanPromptText(entity.physical_description),
                    cleanPromptText(entity.state_of_mind),
                    "single animal, full head and body visible, centered composition",
                    buildProfileBackgroundPrompt(entity, {
                        genres: profileImageBackgroundGenres(name, entity, options),
                        backgroundOverride: options.backgroundOverride,
                    }),
                    "strictly nonsexual animal depiction, no humanoid anatomy, no clothing",
                ]);
            }
            const promptContext = createImagePromptContext(entity, {
                profile: true,
                includesLowerBody: false,
            });
            const clothing = buildProfileUpperClothingPrompt(entity, promptContext);
            const model = resolvedProfileImageModel(entity, {});
            const styleBlock = useFantasyRpgLocalImageStyle(model)
                ? defaultFantasyRpgImageStyleBlock("profile", model)
                : "";
            return joinPromptParts([
                buildProfilePortraitLead(name, entity),
                cleanPromptText(entity?.role),
                buildProfileBodyPrompt(entity, promptContext),
                profileClothingSentence(clothing),
                cleanPromptText(entity?.appearance?.extra_description),
                presentationOnlyExtraDescription(entity),
                cleanPromptText(currentAppearanceForProfilePrompt(name, entity)),
                profileImageSfwSafetyPhrase(entity),
                "single-character upper-body portrait, framed from the top of the head to the natural waistline, entire face visible, full torso visible, lower clothing may meet the bottom edge of the frame, the lower body continues beyond the bottom edge, centered upright composition, no downward camera angle, no full-body composition",
                buildProfileBackgroundPrompt(entity, {
                    genres: profileImageBackgroundGenres(name, entity, options),
                    backgroundOverride: options.backgroundOverride,
                }),
                styleBlock,
            ]);
        }

        function buildProfilePortraitLead(name, entity = {}) {
            const a = entity.appearance || {};
            const displayName = cleanPromptText(entity?.name || profileDisplayName(name) || name);
            const raceAndGender = imageSpeciesAgeGenderPhrase(entity);
            const details = [
                appendPromptNoun(a.skin_color, "skin"),
                appendPromptNoun(a.eye_color, "eyes"),
                buildHairPhrase(a),
            ]
                .map(cleanPromptText)
                .filter(Boolean);
            const subject = joinWords([raceAndGender]);
            const description = subject
                ? `${displayName}, ${subject}${details.length ? ` with ${profilePromptList(details)}` : ""}`
                : `${displayName}${details.length ? ` with ${profilePromptList(details)}` : ""}`;
            return `portrait of ${description}`;
        }

        function profilePromptList(items = []) {
            const parts = items.map(cleanPromptText).filter(Boolean);
            if (parts.length <= 1) return parts[0] || "";
            if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
            return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
        }

        function imageAgeGenderPhrase(entity = {}) {
            const noun = genderNoun(entity?.gender, entity?.appearance?.species);
            const age = Number(entity?.age);
            if (Number.isFinite(age) && age >= 0) {
                return age >= 18
                    ? `${Math.round(age)}-year-old adult ${noun}`
                    : `${Math.round(age)}-year-old ${noun}`;
            }
            return `adult ${noun}`;
        }

        function imageSpeciesAgeGenderPhrase(entity = {}) {
            const species = cleanPromptText(entity?.appearance?.species);
            const ageGender = imageAgeGenderPhrase(entity);
            return species && !ageGender.toLowerCase().includes(species.toLowerCase())
                ? joinWords([species, ageGender])
                : ageGender;
        }

        function runtimeOwnsProfileEntity(name, entity) {
            if (!entity) return false;
            if (entity === app.state?.player) return true;
            if (Object.values(app.state?.characters || {}).includes(entity)) return true;
            const npc = findNpcEntryExact(name)?.npc || getNpcEntry(name);
            return entity === npc || entity === npc?.full_character;
        }

        function profileImageBackgroundGenres(name, entity = {}, options = {}) {
            if (Object.prototype.hasOwnProperty.call(options, "genres"))
                return approvedGenreList(options.genres || []);
            const entityGenres = approvedGenreList(entity?.genres || []);
            if (entityGenres.length) return entityGenres;
            if (!runtimeOwnsProfileEntity(name, entity)) return [];
            return approvedGenreList(
                app.state?.meta?.genres || app.state?.meta?.genre || [],
            );
        }

        function buildProfileBackgroundPrompt(entity = {}, options = {}) {
            const explicitBackground = cleanPromptText(options.backgroundOverride);
            const defaultCharacterBackground = imageEntityIsAnimal(entity)
                ? ""
                : cleanPromptText(entity?.default_image_background);
            const concepts = [];
            const genres = Object.prototype.hasOwnProperty.call(options, "genres")
                ? approvedGenreList(options.genres || [])
                : approvedGenreList(entity?.genres || []);
            const genreConcepts = {
                fantasy: "softly painted fantasy interior",
                dark_fantasy: "softly painted dark-fantasy interior",
                adventure: "softly painted adventure setting",
                romance: "softly painted warm interior",
                "sci-fi": "softly painted science-fiction interior",
                science_fiction: "softly painted science-fiction interior",
                cyberpunk: "softly painted neon city interior",
                horror: "softly painted eerie interior",
                mystery: "softly painted mysterious interior",
                modern: "softly painted modern interior",
                historical: "softly painted historical interior",
                western: "softly painted frontier interior",
                school: "softly painted school interior",
                cozy: "softly painted cozy interior",
                supernatural: "softly painted supernatural interior",
                "post-apocalyptic": "softly painted post-apocalyptic shelter",
                mythology: "softly painted mythic interior",
                war: "softly painted wartime command interior",
            };
            for (const genre of genres) {
                const key = String(genre || "").trim().toLowerCase().replace(/\s+/g, "_");
                const concept = genreConcepts[key];
                if (concept && !concepts.includes(concept)) concepts.push(concept);
                if (concepts.length === 2) break;
            }
            return joinPromptParts([
                explicitBackground || defaultCharacterBackground || (concepts.length
                    ? concepts.join(" and ")
                    : "softly painted fantasy interior"),
                "softly blurred background",
                "low detail background",
                "subtle depth",
                "no other people",
            ]);
        }

        function profileClothingSentence(text) {
            const clothing = cleanPromptText(text);
            return clothing ? `wearing ${clothing}` : "";
        }

        function currentAppearanceForProfilePrompt(name, entity = {}) {
            const direct = textSlot(entity?.current_appearance, "");
            if (direct) return direct;
            const npc = findNpcEntryExact(name)?.npc || getNpcEntry(name);
            return textSlot(npc?.current_appearance, "");
        }

        function isUninspectedNpcPreviewEntity(entity = {}) {
            if (!entity || entity.inspected === true || entity.full_character) return false;
            //The inspection flag is authoritative. Restored shells also carry
            //relationship and personality fields without being full characters.
            if (entity.inspected === false) return true;
            if (
                isPlainObject(entity.clothing) ||
                isPlainObject(entity.appearance) ||
                Array.isArray(entity.outfits) ||
                Array.isArray(entity.known_facts) ||
                textSlot(entity.personality_description, "") ||
                textSlot(entity.speech_style, "") ||
                textSlot(entity.relationship_to_player, "")
            )
                return false;
            return !!(
                entity.inspected === false ||
                entity.note ||
                entity.current_appearance ||
                entity.relationship
            );
        }

        function buildUninspectedNpcPreviewImagePrompt(name, npc = {}) {
            return joinPromptParts([
                cleanPromptText(npc.name || profileDisplayName(name) || name),
                cleanPromptText(npc.gender),
                cleanPromptText(npc.role || "local NPC"),
                cleanPromptText(npc.note),
                cleanPromptText(npc.current_appearance),
                "uninspected NPC preview portrait",
                "use only visible known details",
                "do not reveal hidden character details",
                "square upper body silhouette portrait",
                "head near the top of the frame",
                "shoulders and upper torso visible",
                "slightly obscured identity",
                profileImageSfwSafetyPhrase(npc),
            ]);
        }

        function profileImageSfwSafetyPhrase(entity) {
            return ("SFW portrait, non-explicit, modest upper-body presentation");
        }

        function buildProfileBodyPrompt(entity = {}, promptContext = {}) {
            const appearance = entity?.appearance || {};
            return [
                "height",
                "shoulder_width",
                "chest",
                "upper_body_build",
                "midsection_build",
                "arm_length",
            ]
                .map((slot) =>
                    bodyStatPhrase(slot, appearance?.[slot], {
                        useDefault: false,
                        entity,
                        promptContext,
                    }),
                )
                .filter(Boolean)
                .join(", ");
        }

        function profilePromptOutfitForEntity(entity = {}) {
            const outfits = Array.isArray(entity?.outfits) ? entity.outfits : [];
            const outfitId = textSlot(entity?.active_outfit_id || entity?.starting_outfit_id);
            return (
                outfits.find((item) => outfitId && String(item?.id || "") === outfitId) ||
                outfits[0] ||
                null
            );
        }



        function profilePromptClothingForEntity(entity = {}) {
            const selected = profilePromptOutfitForEntity(entity);
            if (isPlainObject(selected?.clothing))
                return exactClothingSlots(selected.clothing);
            if (isPlainObject(entity?.clothing))
                return exactClothingSlots(entity.clothing);
            return exactClothingSlots({});
        }

        function buildProfileUpperClothingPrompt(entity = {}, promptContext = {}) {
            const clothing = projectClothingForImagePrompt(
                profilePromptClothingForEntity(entity),
                entity,
                promptContext,
            );
            promptContext.chestCovered = hasUpperBodyCovering(clothing);
            return joinVisibleClothing(clothing, { profile: true, entity });
        }

        function buildProfileNegativePrompt(entity, options = {}) { return buildClothedImageNegativePrompt(); }

        function charactersModalOpen() {
            return !!(
                $("modal")?.classList.contains("open") &&
                $("modalBox")?.querySelector?.("#characterDirectorySearch")
            );
        }

        function openProfileImageModal(name) {
            const entity = profileEntity(name);
            if (!entity) return;
            if (charactersModalOpen()) {
                openProfileImagePopupModal(name);
                return;
            }
            openModal(profileImageModalHtml(name));
            $("modalBox")?.setAttribute("data-profile-image-modal-box", "1");
            $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
            bindProfileImageModalControls(
                name,
                $("modalBox")?.querySelector?.("[data-profile-image-modal]") || document,
            );
            scheduleProfileImageLoadingAutosize($("modalBox") || document);
            hydrateVisibleProfileImageLocalAssets($("modalBox") || document);
        }

        function openProfileImagePopupModal(name) {
            const entity = profileEntity(name);
            if (!entity) return;
            const existingModal = [...document.querySelectorAll(
                ".popup-modal.open [data-profile-image-modal]",
            )].find((modal) => modal.dataset.profileImageModal === String(name));
            if (existingModal) {
                const overlay = existingModal.closest(".popup-modal");
                const box = existingModal.closest(".modal-box");
                document.body.append(overlay);
                return { overlay, box, close: () => overlay.remove() };
            }

            const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(profileDisplayName(name))} Profile Image</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                ${profileImageModalHtml(name, { showImageLabButton: true })}
            `);
            popup.box.setAttribute("data-profile-image-modal-box", "1");
            popup.box.setAttribute("data-fullscreen-list-modal", "1");
            bindProfileImageModalControls(
                name,
                popup.box.querySelector?.("[data-profile-image-modal]") || popup.box,
            );
            scheduleProfileImageLoadingAutosize(popup.box);
            hydrateVisibleProfileImageLocalAssets(popup.box);
            return popup;
        }

        async function hydrateProfileImageLocalAsset(imageId = "", root = document) {
            const id = String(imageId || "");
            if (!id || !app.persistence?.getRecord) return false;
            const asset = await app.persistence.getRecord("assetBlobs", id);
            if (!(asset?.blob instanceof Blob)) return false;
            const image = profileStoreImageById(id);
            if (!image) return false;
            const source = sharedImageRuntimeSource(
                "characterProfileImages",
                { imageId: id, url: image.hosted_url || "" },
                asset,
            );
            if (!source) return false;
            image.html = `<img loading="lazy" decoding="async" src="${escapeHtml(source)}">`;
            const selector = `[data-profile-live-id="${cssEscape(id)}"] img`;
            for (const element of root?.querySelectorAll?.(selector) || [])
                element.src = source;
            return true;
        }

        function hydrateVisibleProfileImageLocalAssets(root = document) {
            const ids = [
                ...new Set(
                    [...(root?.querySelectorAll?.("[data-profile-live-id]") || [])]
                        .map((element) => String(element.dataset.profileLiveId || ""))
                        .filter(Boolean),
                ),
            ];
            if (!ids.length) return Promise.resolve([]);
            return mapWithConcurrency(ids, 4, (imageId) =>
                hydrateProfileImageLocalAsset(imageId, root),
            ).catch((error) => {
                devTestLog("Visible profile image local-asset hydration failed", {
                    message: error?.message || String(error),
                    imageIds: ids,
                });
                return [];
            });
        }

        function profileImageModalHtml(name, options = {}) {
            const entity = profileEntity(name);
            if (!entity) return "";
            resolveActiveProfileImageReference(entity);
            const displayName = profileDisplayName(name);
            const images = profileImagesForActivePresentation(entity);
            const activeId = activeProfileImageIdForGallery(entity, images);
            const positionContext = profileImagePositionContext(images);
            const relatedImages = profileRelatedImages(name)
                .map((image) => imageCardHtml(image, { profileTarget: name }))
                .join("");
            const gallery = images.length
                ? images
                      .map((image) =>
                          profileImageOptionHtml(
                              name,
                              image,
                              activeId,
                              positionContext,
                          ),
                      )
                      .join("")
                : `<div class="hint">No profile images yet. Generate one.</div>`;
            const globalProfileModel = selectedProfileImageModel(
                app.settings.defaultProfileImageModel,
            );
            const definitionProfileModel = profileDefinitionImageModel(entity);
            const mutableProfileModel = profileMutableImageModel(entity);
            const resolvedProfileModel = resolvedProfileImageModel(entity);

            const defaultSeed = defaultProfileImageSeed(entity);
            const randomSeedEnabled = profileImageRandomSeedEnabled(name);
            return `
                <div data-profile-image-modal="${escapeHtml(name)}">
                <h2>${escapeHtml(displayName)} Profile Image</h2>
                <p class="hint">Showing ${profileImageMalePresentation(entity) ? "male" : "female"} profile images. Profile images are stored on this character only and do not appear in the main image column. Up to ${escapeHtml(positionContext.limit)} are kept per presentation.</p>
                <div class="profile-image-style-panel">
                    <div class="grid2">
                        <label>Global default style
                            <input value="${escapeHtml(imageModelLabel(globalProfileModel))}" readonly>
                        </label>
                        <label>Character definition default
                            <input value="${escapeHtml(imageModelLabel(definitionProfileModel))}" readonly>
                        </label>
                    </div>
                    <label>Current game override
                        <select data-profile-style-override="${escapeHtml(name)}">
                            <option value="" ${mutableProfileModel ? "" : "selected"}>Use resolved default (${escapeHtml(imageModelLabel(resolvedProfileModel))})</option>
                            ${imageModelOptions()
                                .map(
                                    (model) =>
                                        `<option value="${escapeHtml(model.value)}" ${model.value === mutableProfileModel ? "selected" : ""}>${escapeHtml(model.label)}</option>`,
                                )
                                .join("")}
                        </select>
                    </label>
                </div>
                <div class="profile-image-seed-panel">
                    <label>Default seed
                        <input data-profile-seed-input="${escapeHtml(name)}" type="number" min="0" max="999999999" step="1" value="${escapeHtml(defaultSeed)}" ${randomSeedEnabled ? "disabled" : ""}>
                    </label>
                    <label class="inline-check check-row">
                        <input data-profile-random-seed="${escapeHtml(name)}" type="checkbox" ${randomSeedEnabled ? "checked" : ""}>
                        Randomize seed each image
                    </label>
                    <button type="button" data-profile-action="random-seed">Generate new random seed</button>
                </div>
                <div class="row" style="margin-top:.65rem">
                    <button class="primary" id="generateProfileImageBtn" data-profile-action="generate">Generate new profile image</button>
                    ${
                        options.showImageLabButton
                            ? `<button class="blue" type="button" onclick="EmberAdventures.openProfileImageLabForProfile(${htmlJsArg(name)})">Image Lab</button>`
                            : ""
                    }
                </div>
                <div class="profile-gallery">${gallery}</div>
                <h3>Scene Images Using ${escapeHtml(displayName)}</h3>
                <p class="hint">These are normal scene images where this character/player was included, including group images.</p>
                <div class="profile-related-images">${relatedImages || `<div class="hint">No scene images found for this character yet.</div>`}</div>
                </div>
            `;
        }

        function refreshOpenProfileImageModal(name) {
            const modals = [...document.querySelectorAll("[data-profile-image-modal]")].filter(
                (node) => node.dataset.profileImageModal === String(name),
            );
            if (!modals.length) return;
            const entity = profileEntity(name);
            if (!entity) return;
            resolveActiveProfileImageReference(entity);
            const images = profileImagesForActivePresentation(entity);
            const activeId = activeProfileImageIdForGallery(entity, images);
            const positionContext = profileImagePositionContext(images);
            for (const modal of modals) {
                const gallery = modal.querySelector(".profile-gallery");
                if (gallery) {
                    syncProfileImageGalleryDom(
                        name,
                        gallery,
                        images,
                        activeId,
                        positionContext,
                    );
                }
                const generateButton = modal.querySelector("[data-profile-action='generate']");
                if (generateButton) {
                    generateButton.disabled = false;
                    generateButton.textContent = "Generate new profile image";
                }
                const seedInput = modal.querySelector("[data-profile-seed-input]");
                if (seedInput && !seedInput.matches(":focus")) {
                    seedInput.value = String(defaultProfileImageSeed(entity));
                }
                bindProfileImageModalControls(name, modal);
            }
            scheduleProfileImageLoadingAutosize(document);
        }

        function activeProfileImageIdForGallery(entity = {}, images = []) {
            const availableIds = new Set(
                images.map((image) => String(image?.id || "")).filter(Boolean),
            );
            return [
                String(entity?.profile_image_id || ""),
                String(defaultProfileLocalImageId(entity) || ""),
            ].find((imageId) => imageId && availableIds.has(imageId)) || "";
        }

        function syncProfileImageGalleryDom(
            name,
            gallery,
            images = [],
            activeId = "",
            positionContext = profileImagePositionContext(images),
        ) {
            if (!gallery) return;
            if (!images.length) {
                gallery.innerHTML = `<div class="hint">No profile images yet. Generate one.</div>`;
                return;
            }
            const existing = new Map(
                [...gallery.querySelectorAll("[data-profile-image-id]")].map((card) => [
                    String(card.dataset.profileImageId || ""),
                    card,
                ]),
            );
            const fragment = document.createDocumentFragment();
            for (const image of images) {
                const id = String(image.id || "");
                let card = existing.get(id);
                const active = id === String(activeId || "");
                if (!card) {
                    const template = document.createElement("template");
                    template.innerHTML = profileImageOptionHtml(
                        name,
                        image,
                        activeId,
                        positionContext,
                    ).trim();
                    card = template.content.firstElementChild;
                    if (card) activatePluginIframes(card);
                } else {
                    // Profile-image refreshes must preserve existing img/iframe nodes.
                    // Rebuilding old cards reloads the first generated Perchance image
                    // when a new portrait is requested, so only metadata/buttons change.
                    card.classList.toggle("active", active);
                    const heading = card.querySelector(".image-card-heading");
                    if (heading)
                        heading.innerHTML = profileImageCardHeadingHtml(
                            image,
                            active,
                            positionContext,
                        );
                    const title = card.querySelector(".image-card-title");
                    if (title)
                        title.textContent = active
                            ? "Active Profile Image"
                            : "Profile Image";
                    const meta = card.querySelector(".image-card-meta");
                    if (meta)
                        meta.textContent = "";
                    const selectButton = card.querySelector('[data-profile-action="select"]');
                    if (selectButton) {
                        selectButton.disabled = active;
                        selectButton.textContent = active ? "Active" : "Use this";
                    }
                    const favorite = card.querySelector(".image-favorite-button");
                    if (favorite) {
                        favorite.classList.toggle("speak-on", !!image.favorite);
                        favorite.classList.toggle("speak-off", !image.favorite);
                        favorite.title = image.favorite ? "Unfavorite image" : "Favorite image";
                        favorite.innerHTML = image.favorite ? "&#9733;" : "&#9734;";
                    }
                }
                if (card) fragment.appendChild(card);
            }
            gallery.replaceChildren(fragment);
        }

        function bindProfileImageModalControls(name, root = document) {
            const styleOverride = root.querySelector?.("[data-profile-style-override]");
            if (styleOverride && styleOverride.dataset.bound !== "1") {
                styleOverride.dataset.bound = "1";
                styleOverride.onchange = () => {
                    setProfileImageStyleOverride(name, styleOverride.value);
                };
            }
            const generateButton = root.querySelector?.("[data-profile-action='generate']");
            if (generateButton) {
                generateButton.disabled = false;
                generateButton.onclick = () => {
                    startManualProfileImageGeneration(
                        name,
                        profileImageSeedOptionsFromModal(name, root),
                    );
                };
            }
            const seedInput = root.querySelector?.("[data-profile-seed-input]");
            const randomSeedToggle = root.querySelector?.("[data-profile-random-seed]");
            if (seedInput && seedInput.dataset.bound !== "1") {
                seedInput.dataset.bound = "1";
                let seedSaveTimer = null;
                const persistSeed = () => {
                    clearTimeout(seedSaveTimer);
                    seedSaveTimer = null;
                    seedInput.value = String(saveProfileImageDefaultSeed(name, seedInput.value));
                };
                seedInput.oninput = () => {
                    clearTimeout(seedSaveTimer);
                    seedSaveTimer = setTimeout(persistSeed, 200);
                };
                seedInput.onblur = persistSeed;
            }
            if (randomSeedToggle && randomSeedToggle.dataset.bound !== "1") {
                randomSeedToggle.dataset.bound = "1";
                randomSeedToggle.onchange = () => {
                    setProfileImageRandomSeedEnabled(name, randomSeedToggle.checked);
                    if (seedInput) seedInput.disabled = randomSeedToggle.checked;
                };
            }
            const randomSeedButton = root.querySelector?.("[data-profile-action='random-seed']");
            if (randomSeedButton && randomSeedButton.dataset.bound !== "1") {
                randomSeedButton.dataset.bound = "1";
                randomSeedButton.onclick = () => {
                    const seed = saveProfileImageDefaultSeed(name, randomProfileImageSeed());
                    if (seedInput) {
                        seedInput.value = String(seed);
                        seedInput.disabled = false;
                    }
                    if (randomSeedToggle) randomSeedToggle.checked = false;
                    setProfileImageRandomSeedEnabled(name, false);
                };
            }
            root.querySelectorAll("[data-profile-action]").forEach((button) => {
                if (
                    button.dataset.profileAction === "generate" ||
                    button.dataset.profileAction === "random-seed"
                )
                    return;
                button.onclick = () => {
                    const id = button.dataset.profileId;
                    if (button.dataset.profileAction === "select")
                        return selectProfileImageFromUi(name, id);
                    if (button.dataset.profileAction === "delete")
                        return deleteProfileImage(name, id);
                    return undefined;
                };
            });
        }

        function setProfileImageStyleOverride(name, value = "") {
            const entity = profileEntity(name);
            if (!entity) return;
            entity.image ||= {};
            const selected = String(value || "").trim();
            if (selected) entity.image.profile_style = selectedProfileImageModel(selected);
            else delete entity.image.profile_style;
            scheduleActiveGameSave();
            refreshOpenProfileImageModal(name);
        }

        function refreshOpenProfileRelatedImages() {
            for (const modal of document.querySelectorAll("[data-profile-image-modal]")) {
                const name = modal.dataset.profileImageModal;
                const target = modal.querySelector(".profile-related-images");
                if (!name || !target) continue;
                const relatedImages = profileRelatedImages(name)
                    .map((image) => imageCardHtml(image, { profileTarget: name }))
                    .join("");
                target.innerHTML =
                    relatedImages ||
                    `<div class="hint">No scene images found for this character yet.</div>`;
                activatePluginIframes(target);
            }
        }

        function profileRelatedImageMatchesPresentation(image, name, entity = {}) {
            const normalize = (value) => normalizeNameForMatch(String(value || ""));
            const currentTargets = new Set(
                [
                    name,
                    entity.id,
                    entity.character_id,
                    entity.name,
                    profileDisplayName(name),
                    resolvedEntityDisplayName(name, app.state, name),
                ]
                    .map(normalize)
                    .filter(Boolean),
            );
            const oppositeTargets = new Set(
                [
                    entity.fallback_name,
                    resolvedEntityDisplayName(
                        entity.fallback_name,
                        app.state,
                        entity.fallback_name,
                    ),
                ]
                    .map(normalize)
                    .filter(Boolean),
            );
            const currentPresentation = profileImageMalePresentation(entity)
                ? "male"
                : "non_male";
            const oppositePresentation = currentPresentation === "male" ? "non_male" : "male";
            const directPresentation =
                image?.presentation === "male" || image?.presentation === "non_male"
                    ? image.presentation
                    : "";
            if (directPresentation)
                return directPresentation === currentPresentation;
            const metadata = normalizedImageTargetPresentations(
                image?.target_presentations,
            );
            if (Object.keys(metadata).length) {
                const targetAliases = new Set([
                    ...currentTargets,
                    ...oppositeTargets,
                ]);
                const matchedPresentations = new Set();
                for (const [target, presentation] of Object.entries(metadata)) {
                    const normalizedTarget = normalize(target);
                    const resolvedTarget = normalize(
                        resolvedEntityDisplayName(target, app.state, target),
                    );
                    if (
                        targetAliases.has(normalizedTarget) ||
                        targetAliases.has(resolvedTarget)
                    )
                        matchedPresentations.add(presentation);
                }
                return (
                    matchedPresentations.has(currentPresentation) &&
                    !matchedPresentations.has(oppositePresentation)
                );
            }

            const ambiguousTargets = new Set(["Player"].map(normalize));
            const legacyCurrentTargets = new Set(
                [...currentTargets].filter((target) => !ambiguousTargets.has(target)),
            );
            const targets = Array.isArray(image?.targets)
                ? image.targets.map(normalize).filter(Boolean)
                : [];
            const matchesCurrent = targets.some((target) =>
                legacyCurrentTargets.has(target),
            );
            const matchesOpposite = targets.some((target) =>
                oppositeTargets.has(target),
            );
            return matchesCurrent && !matchesOpposite;
        }

        function profileRelatedImages(name) {
            const entity = profileEntity(name) || {};
            const targetKeys = new Set();
            const addTargetKey = (value) => {
                const text = String(value || "").trim();
                if (!text) return;
                targetKeys.add(normalizeNameForMatch(text));
                targetKeys.add(
                    normalizeNameForMatch(
                        resolvedEntityDisplayName(text, app.state, text),
                    ),
                );
            };
            [
                entity.id,
                entity.character_id,
                entity.name,
                entity.fallback_name,
                profileDisplayName(name),
            ].forEach(addTargetKey);
            if (!String(name || "").startsWith("character-library|"))
                addTargetKey(name);
            targetKeys.delete("");
            const visible = [
                ...visibleImagesForRender(),
                ...(app.characterImages || []).filter(
                    (image) => true,
                ),
            ];
            const seenIds = new Set();
            return visible
                .filter((image) => {
                    const id = String(image?.id || "");
                    if (!id || seenIds.has(id)) return false;
                    seenIds.add(id);
                    return true;
                })
                .filter((image) => {
                    if (image.profile) return false;
                    if (!profileRelatedImageMatchesPresentation(image, name, entity))
                        return false;
                    const targets = Array.isArray(image.targets)
                        ? image.targets.flatMap((item) => {
                              const text = String(item || "").trim();
                              return [
                                  normalizeNameForMatch(text),
                                  normalizeNameForMatch(
                                      resolvedEntityDisplayName(text, app.state, text),
                                  ),
                              ];
                          })
                        : [];
                    if (targets.some((item) => targetKeys.has(item)))
                        return true;
                    const title = String(image.title || "");
                    return title
                        .split(",")
                        .flatMap((part) => {
                            const text = part.trim();
                            return [
                                normalizeNameForMatch(text),
                                normalizeNameForMatch(
                                    resolvedEntityDisplayName(text, app.state, text),
                                ),
                            ];
                        })
                        .some((item) => targetKeys.has(item));
                })
                .slice(0, 24);
        }

        function profileImageCardHeadingHtml(image, active = false, positionContext = {}) {
            return `
                <strong class="image-card-title">${active ? "Active Profile Image" : "Profile Image"}</strong>
                <span class="image-mode-row">

                    ${profileImagePositionBadgeHtml(image, positionContext, active)}
                </span>
            `;
        }

        function profileImageOptionHtml(
            name,
            image,
            activeId,
            positionContext = profileImagePositionContext([image]),
        ) {
            const active = String(image.id) === String(activeId);
            const nameArg = htmlJsArg(name);
            const imageArg = htmlJsArg(image.id);

            const canPreview =
                profileImageRealHtml(image.html) &&
                !image.pending &&
                !image.error;
            return `
                <div class="image-card profile-option ${active ? "active" : ""}" data-profile-image-id="${escapeHtml(image.id)}">
                    <div class="image-card-heading">
                        ${profileImageCardHeadingHtml(image, active, positionContext)}
                    </div>
                    <div class="image-render profile-image-live ${canPreview ? "clickable-image-render" : ""}" data-profile-live-id="${escapeHtml(image.id)}" ${canPreview ? `title="View full size" onclick="EmberAdventures.openProfileImagePreview(${nameArg}, ${imageArg})"` : ""}>
                        ${profileImageInnerHtml(image)}
                        ${canPreview ? `<button type="button" class="image-preview-hitbox" title="View full size" aria-label="View full size profile image" onclick="event.stopPropagation(); EmberAdventures.openProfileImagePreview(${nameArg}, ${imageArg})"></button>` : ""}
                    </div>
                    <div class="image-card-toolbar">
                        <button ${active ? "disabled" : ""} data-profile-action="select" data-profile-id="${escapeHtml(image.id)}">${active ? "Active" : "Use this"}</button>
                        ${canPreview ? `<button class="icon-button" title="Download profile image" onclick="EmberAdventures.downloadProfileImageRecord(${nameArg}, ${imageArg})">&#11015;</button>` : ""}
                        <button class="icon-button blue" title="Load in Image Lab" onclick="EmberAdventures.loadProfileImageInLab(${nameArg}, ${imageArg})">&#128300;</button>
                        <button class="icon-button image-favorite-button ${image.favorite ? "speak-on" : "speak-off"}" title="${image.favorite ? "Unfavorite image" : "Favorite image"}" onclick="EmberAdventures.toggleProfileImageFavorite(${nameArg}, ${imageArg})">${image.favorite ? "&#9733;" : "&#9734;"}</button>
                        <button class="icon-button danger" title="Delete image" onclick="EmberAdventures.deleteProfileImage(${nameArg}, ${imageArg})">&#128465;</button>
                    </div>
                </div>
            `;
        }

        function profileImageInnerHtml(image) {
            {}
            const rawLiveCachedHtml =
                image?.pending && image?.id
                    ? app.profileImageLiveHtmlCache?.[String(image.id)] || ""
                    : "";
            const liveCachedHtml = /<iframe\b/i.test(String(rawLiveCachedHtml || ""))
                ? profileImagePendingInfoHtml(rawLiveCachedHtml, "Perchance image generation")
                : rawLiveCachedHtml;
            const rendered = renderStoredImageHtml(
                profileImageRealHtml(image?.html) || liveCachedHtml,
            );
            if (rendered) {
                return rendered.replace("<img ", '<img class="profile-image-thumb" ');
            }
            if (image?.pending) {
                return profileImageLoadingHtml(image.error || "Profile image generation in progress");
            }
            if (image?.error) return profileImageFailedHtml(image);
            return `<div class="profile-image-placeholder ${image?.error ? "static" : ""}" aria-label="${escapeHtml(image?.error || "No profile image")}"></div>`;
        }

        function profileImageLoadingHtml(message = "Profile image generation in progress") {
            return `<div class="profile-image-loading">${loadingSpinnerHtml(message)}</div>`;
        }

        function randomProfileImageSeed() {
            return Math.floor(Math.random() * 999999999);
        }

        function randomProfileImageSeedExcept(avoidSeed = null) {
            const avoid = avoidSeed == null ? null : exactProfileImageSeed(avoidSeed, "profile image avoided seed");
            let seed = randomProfileImageSeed();
            if (avoid != null && seed === avoid) seed = (seed % 999999998) + 1;
            return seed;
        }

        function profileImageGenerationSeed(entity, options = {}) {
            if (options.seed != null)
                return exactProfileImageSeed(
                    options.seed,
                    "profile image generation seed",
                );
            if (options.randomSeed)
                return randomProfileImageSeedExcept(
                    options.avoidSeed ?? defaultProfileImageSeed(entity),
                );
            return defaultProfileImageSeed(entity);
        }

        function exactProfileImageSeed(value, path = "profile image seed") {
            if (!Number.isSafeInteger(value) || value < 0)
                throw new Error(`${path} must be a non-negative safe integer.`);
            return value;
        }

        function parseProfileImageSeedInput(value, fallback = 0, path = "profile image seed input") {
            const exactFallback = exactProfileImageSeed(fallback, `${path} fallback`);
            if (value == null || value === "") return exactFallback;
            const parsed = typeof value === "number" ? value : Number(value);
            return exactProfileImageSeed(parsed, path);
        }

        function repairAiProfileImageSeed(value, fallback = 0) {
            const repairedFallback = Number.isFinite(Number(fallback))
                ? Math.max(0, Math.round(Number(fallback)))
                : 0;
            const number = Number(value);
            if (!Number.isFinite(number)) return repairedFallback;
            return Math.max(0, Math.round(number));
        }

        function defaultProfileImageSeed(entity = {}) {
            if (!entity || typeof entity !== "object") return 0;
            if (entity.default_seed != null)
                return exactProfileImageSeed(entity.default_seed, "character.default_seed");
            if (entity.image_prompt_config?.seed != null)
                return exactProfileImageSeed(entity.image_prompt_config.seed, "character.image_prompt_config.seed");
            if (entity.image?.seed != null)
                return exactProfileImageSeed(entity.image.seed, "character.image.seed");
            return 0;
        }

        function normalImageSeedForEntities(entities = []) {
            const primary = entities[0]?.[1];
            if (!primary) return undefined;
            if (entities.length === 1) {
                const profile = activeProfileImage(primary);
                if (
                    profile?.seed !== undefined &&
                    profile?.seed !== null &&
                    profile.seed !== "" &&
                    profile.seed !== "random"
                )
                    return exactProfileImageSeed(profile.seed, "profile image seed");
            }
            return primary.image?.seed_enabled
                ? exactProfileImageSeed(primary.image.seed, "character image seed")
                : undefined;
        }

        function profileImageRandomSeedEnabled(name) {
            app.profileImageRandomSeedByName ||= {};
            return !!app.profileImageRandomSeedByName[String(name || "")];
        }

        function setProfileImageRandomSeedEnabled(name, enabled) {
            app.profileImageRandomSeedByName ||= {};
            const key = String(name || "");
            if (!key) return;
            if (enabled) app.profileImageRandomSeedByName[key] = true;
            else delete app.profileImageRandomSeedByName[key];
        }

        function saveProfileImageDefaultSeed(name, seed) {
            const entity = profileEntity(name);
            if (!entity) return 0;
            const cleanSeed = parseProfileImageSeedInput(seed, defaultProfileImageSeed(entity), "profile image seed");
            if ("default_seed" in entity || entity.image_prompt_config) {
                entity.default_seed = cleanSeed;
                entity.image_prompt_config = imagePromptConfigFromExactInput(
                    {
                        ...(isPlainObject(entity.image_prompt_config)
                            ? entity.image_prompt_config
                            : {}),
                        seed: cleanSeed,
                    },
                    cleanSeed,
                );
            } else {
                entity.image ||= {};
                entity.image.seed_enabled = true;
                entity.image.seed = cleanSeed;
            }
            if (!syncCharacterLibraryProfileSeed(name, cleanSeed))
                scheduleActiveGameSave();
            return cleanSeed;
        }

        function profileImageSeedOptionsFromModal(name, root = document) {
            const randomize = !!root.querySelector?.("[data-profile-random-seed]")?.checked;
            const seedInput = root.querySelector?.("[data-profile-seed-input]");
            if (randomize) {
                setProfileImageRandomSeedEnabled(name, true);
                return {
                    randomSeed: true,
                    avoidSeed: parseProfileImageSeedInput(seedInput?.value, defaultProfileImageSeed(profileEntity(name)), "profile image seed"),
                };
            }
            setProfileImageRandomSeedEnabled(name, false);
            const seed = saveProfileImageDefaultSeed(name, seedInput?.value);
            if (seedInput) seedInput.value = String(seed);
            return { randomSeed: false, seed };
        }

        function refreshProfileImageSurfaces(name) {
            // Any action that changes the active/stored profile image must refresh
            // the left cards and the open Characters modal; otherwise the profile
            // picker can show the new image while an open character directory stays
            // on its original loading placeholder until the modal is reopened.
            renderCharacters();
            activatePluginIframes($("characterList"));
            activatePluginIframes($("playerList"));
            activatePluginIframes($("npcSceneList"));
            refreshCharactersModalIfOpen();
            const openStoryShopId = mainModalOpen()
                ? $("modalBox")
                    ?.querySelector?.("[data-story-shop]")
                    ?.getAttribute?.("data-story-shop")
                : "";
            if (openStoryShopId)
                openStoryShopModal(openStoryShopId);
            else if ($("modalBox")?.matches?.("[data-image-viewer-modal]"))
                refreshOpenImageViewer();
            else refreshOpenProfileImageModal(name);
            refreshCharacterLibraryProfileSurfaces(name);
        }

        async function selectProfileImage(name, id) {
            const entity = profileEntity(name);
            const image = entity ? profileImageById(entity, id) : null;
            if (!entity || !image || !profileImageMatchesPresentation(image, entity)) return;
            {}
            const characterId = String(entity.id || entity.character_id || "").trim();
            if (!characterId)
                throw new Error(`${profileDisplayName(name)} must have a character id before selecting a profile image.`);
            const storedImage = upsertProfileStoreImage(
                {
                    ...image,
                    character_id: characterId,
                },
                profileImageOwnerNameForHandle(name, entity),
                { save: false },
            );
            if (!storedImage)
                throw new Error(`${profileDisplayName(name)} profile image could not be prepared for storage.`);
            entity.profile_image_id = String(id);
            setLocalDefaultProfileImage(entity, id, storedImage, {
                keepUrl: true,
                save: false,
            });
            syncCharacterLibraryProfileSelection(name, id);
            refreshKeptImageRuntimeSet();
            scheduleActiveGameSave();
            // Refresh before persistence so the selection feels immediate. Awaiting
            // IndexedDB does not block the main thread, but it does ensure a reload
            // cannot interrupt the authoritative selection write.
            refreshProfileImageSurfaces(name);
            beginLibrarySaving("Saving profile image selection...");
            try {
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                const entries = await sharedImageStorageEntries(
                    PROFILE_IMAGE_KEY,
                    [storedImage],
                    { selectProfileImages: true },
                );
                await app.persistence.putSharedRecords(entries);
                await app.work.flush(
                    `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                );
            } finally {
                endLibrarySaving();
            }
        }

        async function selectProfileImageFromUi(name, id) {
            try {
                await selectProfileImage(name, id);
                return true;
            } catch (error) {
                const message = error?.message || String(error);
                log("Profile image selection failed", message, {
                    type: "image",
                    level: "warning",
                    details: { name, id },
                });
                await showNotice("Profile Image Selection Failed", message);
                return false;
            }
        }

        function carryNpcShellProfileImagesToInspectedCharacter(npc, fullCharacter, name = "") {
            if (!npc || !fullCharacter) return false;
            const displayName = String(fullCharacter.name || npc.name || name || "").trim();
            const shellImages = [
                ...(Array.isArray(npc.profile_images) ? npc.profile_images : []),
                ...(Array.isArray(npc.profile_images_list) ? npc.profile_images_list : []),
                ...(npc.profile_image_id ? [{ id: npc.profile_image_id }] : []),
            ]
                .map((image) => ({
                    ...image,
                    ...(profileStoreImageById(image?.id) || {}),
                }))
                .filter((image) => image?.id);
            if (!shellImages.length) return false;
            resolveActiveProfileImageReference(fullCharacter);
            const existingIds = new Set(
                (fullCharacter.profile_images || []).map((image) => String(image.id || "")),
            );
            let changed = false;
            for (const image of shellImages) {
                const id = String(image.id || "");
                if (!id || existingIds.has(id)) continue;
                const stored =
                    upsertProfileStoreImage(
                        {
                            ...image,
                            owner_name: displayName,
                            source: image.source || "uninspected NPC preview",
                        },
                        displayName,
                    ) || image;
                fullCharacter.profile_images.push(profileImageEntityRecord(stored));
                existingIds.add(id);
                changed = true;
            }
            if (changed) {
                resolveActiveProfileImageReference(fullCharacter);
            }
            return changed;
        }

        function toggleProfileImageFavorite(name, id) {
            const entity = profileEntity(name);
            const image = entity ? profileImageById(entity, id) : null;
            if (!image) return;
            image.favorite = !image.favorite;
            upsertProfileStoreImage(
                image,
                profileImageOwnerNameForHandle(name, entity),
            );
            replaceEmbeddedProfileImageRecord(entity, image);
            refreshKeptImageRuntimeSet();
            scheduleActiveGameSave();
            refreshProfileImageSurfaces(name);
        }

        function promoteSceneImageToProfile(name, imageId) {
            const source = (app.images || []).find(
                (image) => String(image.id) === String(imageId),
            );
            if (!source || source.pending || source.error) return;
            const entity = profileEntity(name);
            if (!entity) return;
            const html = imageHtmlToString(source.html);
            if (!profileImageRealHtml(html)) {
                showNotice(
                    "Profile Image Failed",
                    "That scene image is not available yet.",
                );
                return;
            }
            openSceneImageProfileCropModal(name, source, html);
        }

        function decodeHtmlAttribute(value = "") {
            const textarea = document.createElement("textarea");
            textarea.innerHTML = String(value || "");
            return textarea.value;
        }

        function imageSourceUrlFromHtml(html = "") {
            const text = String(html || "").trim();
            if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) return text;
            const match = text.match(/<img\b[^>]*\bsrc=(["'])(.*?)\1/i);
            return match ? decodeHtmlAttribute(match[2]) : "";
        }

        function openSceneImageProfileCropModal(name, source, html = "") {
            {}
            const src = imageSourceUrlFromHtml(html);
            if (!src) {
                showNotice(
                    "Profile Image Failed",
                    "That scene image cannot be cropped into a profile image.",
                );
                return;
            }
            const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Crop Profile Image</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <div class="profile-crop-editor" data-profile-crop-editor>
                    <div>
                        <div class="profile-crop-stage" data-profile-crop-stage>
                            <img alt="Crop source image" data-profile-crop-image>
                            <div class="profile-crop-frame" aria-hidden="true"></div>
                        </div>
                        <p class="hint">Drag the image to position it. Use the slider or mouse wheel to zoom.</p>
                    </div>
                    <div class="profile-crop-controls">
                        <strong>${escapeHtml(profileDisplayName(name))}</strong>
                        <label>Zoom
                            <input type="range" min="1" max="4" step="0.01" value="1" data-profile-crop-zoom>
                        </label>
                        <div class="profile-crop-preview">
                            <canvas width="512" height="512" data-profile-crop-preview></canvas>
                        </div>
                        <div class="row">
                            <button type="button" class="primary" data-profile-crop-use>Use Cropped Image</button>
                            <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Cancel</button>
                        </div>
                    </div>
                </div>
            `);
            popup.box.setAttribute("data-profile-crop-modal", "1");
            setupProfileCropEditor(popup, name, source, src);
        }

        function setupProfileCropEditor(popup, name, source, src) {
            const box = popup?.box;
            const stage = box?.querySelector?.("[data-profile-crop-stage]");
            const img = box?.querySelector?.("[data-profile-crop-image]");
            const zoom = box?.querySelector?.("[data-profile-crop-zoom]");
            const preview = box?.querySelector?.("[data-profile-crop-preview]");
            const useButton = box?.querySelector?.("[data-profile-crop-use]");
            if (!stage || !img || !zoom || !preview || !useButton) return;
            useButton.disabled = true;
            const state = {
                source,
                naturalWidth: 1,
                naturalHeight: 1,
                scale: 1,
                minScale: 1,
                x: 0,
                y: 0,
                dragging: false,
                startX: 0,
                startY: 0,
                originX: 0,
                originY: 0,
            };
            let cachedStageSize = 512;
            const updateStageSize = () => {
                cachedStageSize = stage.getBoundingClientRect().width || cachedStageSize || 512;
            };
            updateStageSize();
            const stageResizeObserver = typeof ResizeObserver === "function"
                ? new ResizeObserver(updateStageSize)
                : null;
            stageResizeObserver?.observe(stage);
            const stageSize = () => cachedStageSize;
            const clamp = () => {
                const size = stageSize();
                const width = state.naturalWidth * state.scale;
                const height = state.naturalHeight * state.scale;
                state.x = Math.min(0, Math.max(size - width, state.x));
                state.y = Math.min(0, Math.max(size - height, state.y));
            };
            const drawPreview = () => {
                const ctx = preview.getContext("2d");
                if (!ctx) return;
                const size = stageSize();
                const ratio = preview.width / size;
                ctx.clearRect(0, 0, preview.width, preview.height);
                ctx.drawImage(
                    img,
                    state.x * ratio,
                    state.y * ratio,
                    state.naturalWidth * state.scale * ratio,
                    state.naturalHeight * state.scale * ratio,
                );
            };
            const renderCrop = () => {
                clamp();
                img.style.width = `${state.naturalWidth * state.scale}px`;
                img.style.height = `${state.naturalHeight * state.scale}px`;
                img.style.transform = `translate(${state.x}px, ${state.y}px)`;
                drawPreview();
            };
            const setScale = (nextScale, anchorX = stageSize() / 2, anchorY = stageSize() / 2) => {
                const previous = state.scale || state.minScale;
                const scale = Math.max(state.minScale, Math.min(state.minScale * 4, Number(nextScale) || state.minScale));
                if (Math.abs(scale - previous) < 0.001) return;
                const imageX = (anchorX - state.x) / previous;
                const imageY = (anchorY - state.y) / previous;
                state.scale = scale;
                state.x = anchorX - imageX * scale;
                state.y = anchorY - imageY * scale;
                zoom.value = String(state.scale);
                zoom.min = String(state.minScale);
                zoom.max = String(state.minScale * 4);
                renderCrop();
            };
            img.onload = () => {
                state.naturalWidth = img.naturalWidth || 1;
                state.naturalHeight = img.naturalHeight || 1;
                const size = stageSize();
                state.minScale = Math.max(
                    size / state.naturalWidth,
                    size / state.naturalHeight,
                );
                state.scale = state.minScale;
                state.x = (size - state.naturalWidth * state.scale) / 2;
                state.y = (size - state.naturalHeight * state.scale) / 2;
                zoom.min = String(state.minScale);
                zoom.max = String(state.minScale * 4);
                zoom.value = String(state.scale);
                renderCrop();
                box.dataset.profileCropReady = "1";
                useButton.disabled = false;
            };
            img.onerror = () => {
                showNotice(
                    "Crop Failed",
                    "That image could not be loaded for cropping.",
                );
                popup.close();
            };
            if (/^https?:\/\//i.test(src)) img.crossOrigin = "anonymous";
            img.src = src;
            zoom.oninput = () => setScale(Number(zoom.value));
            stage.onpointerdown = (event) => {
                state.dragging = true;
                state.startX = event.clientX;
                state.startY = event.clientY;
                state.originX = state.x;
                state.originY = state.y;
                stage.setPointerCapture?.(event.pointerId);
            };
            let pointerFrame = 0;
            let pendingPointer = null;
            stage.onpointermove = (event) => {
                if (!state.dragging) return;
                pendingPointer = { x: event.clientX, y: event.clientY };
                if (pointerFrame) return;
                pointerFrame = requestAnimationFrame(() => {
                    pointerFrame = 0;
                    if (!pendingPointer || !state.dragging) return;
                    state.x = state.originX + pendingPointer.x - state.startX;
                    state.y = state.originY + pendingPointer.y - state.startY;
                    pendingPointer = null;
                    renderCrop();
                });
            };
            stage.onpointerup = (event) => {
                state.dragging = false;
                stage.releasePointerCapture?.(event.pointerId);
            };
            stage.onpointercancel = () => {
                state.dragging = false;
            };
            stage.onwheel = (event) => {
                event.preventDefault();
                const rect = stage.getBoundingClientRect();
                const factor = event.deltaY < 0 ? 1.08 : 0.92;
                setScale(
                    state.scale * factor,
                    event.clientX - rect.left,
                    event.clientY - rect.top,
                );
            };
            useButton.onclick = async () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = 768;
                    canvas.height = 768;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error("Canvas is unavailable.");
                    const size = stageSize();
                    const ratio = canvas.width / size;
                    ctx.drawImage(
                        img,
                        state.x * ratio,
                        state.y * ratio,
                        state.naturalWidth * state.scale * ratio,
                        state.naturalHeight * state.scale * ratio,
                    );
                    const blob = await new Promise((resolve, reject) =>
                        canvas.toBlob(
                            (value) => value ? resolve(value) : reject(new Error("PNG encoding failed.")),
                            "image/png",
                        ),
                    );
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ""));
                        reader.onerror = () => reject(reader.error || new Error("PNG reading failed."));
                        reader.readAsDataURL(blob);
                    });
                    finalizeSceneImageProfileCrop(name, source, dataUrl);
                    popup.close();
                } catch (err) {
                    showNotice(
                        "Crop Failed",
                        err?.message ||
                            "The browser blocked cropping this image. Try downloading the image and regenerating a profile image instead.",
                    );
                }
            };
            window.addEventListener("resize", renderCrop, { once: true });
        }

        function finalizeSceneImageProfileCrop(name, source, croppedDataUrl) {
            const entity = profileEntity(name);
            if (!entity || !croppedDataUrl) return null;
            const image = rememberProfileImage(name, {
                source: "scene image",
                model: selectedImageModel(source.model),
                seed: source.seed ?? "copied",
                prompt: source.prompt || "",
                negativePrompt: source.negativePrompt || "",
                source_image_id: source.id,
                crop: { square: true },
                html: `<img src="${escapeHtml(croppedDataUrl)}" alt="${escapeHtml(profileDisplayName(name))} profile image">`,
                favorite: !!source.favorite,
                title: `${profileDisplayName(name)} profile image`,
                reason: source.reason || "scene image",
                profile: true,
            });
            if (!image) return;
            refreshKeptImageRuntimeSet();
            refreshProfileImageSurfaces(name);
            return image;
        }

        function loadProfileImageInLab(name, id) {
            const entity = profileEntity(name);
            const image = entity ? profileImageById(entity, id) : null;
            if (!image) return;
            {}
            openImageLabModal({
                ...image,
                title: `${profileDisplayName(name)} Profile Image`,
                reason: image.source || "profile image",
                targets: [name],
                profile: true,
                popup: profileImageModalIsPopup(name),
            });
        }

        function openProfileImageLabForProfile(name) {
            const entity = profileEntity(name);
            if (!entity) return;
            openImageLabModal({
                title: `${profileDisplayName(name)} Profile Image`,
                reason: "profile image",
                targets: [name],
                profile: true,
                prompt: buildProfileImagePrompt(name, entity),
                negativePrompt: buildProfileNegativePrompt(entity),
                seed: profileImageRandomSeedEnabled(name)
                    ? "random"
                    : defaultProfileImageSeed(entity),
                model: resolvedProfileImageModel(entity),
                popup: profileImageModalIsPopup(name),
            });
        }

        function profileImageModalIsPopup(name) {
            return !![...document.querySelectorAll("[data-profile-image-modal]")].find(
                (node) =>
                    node.dataset.profileImageModal === String(name) &&
                    !!node.closest(".popup-modal"),
            );
        }

        function downloadProfileImageRecord(name, id) {
            const entity = profileEntity(name);
            const image = entity ? profileImageById(entity, id) : null;
            if (!image) return;
            {}
            return downloadSingleImageRecord(
                image,
                `${profileDisplayName(name)}-${image.source || "profile-image"}`,
            );
        }

        function characterLibraryRecordForProfileEntity(entity = null) {
            const direct = (app.characterDefinitions || []).find(
                (record) =>
                    !record?.publicEntry &&
                    characterLibraryRecordEntity(record) === entity,
            );
            if (direct) return direct;
            const overrideName = Object.entries(app.profileEntityOverrides || {})
                .find(([, value]) => value === entity)?.[0] || "";
            if (!overrideName) return null;
            return characterLibraryRecordForProfileName(overrideName);
        }

        function removeProfileImage(name, id, options = {}) {
            const entity = profileEntity(name);
            if (!entity) return false;
            const imageId = String(id || "");
            const removed = profileImageById(entity, imageId);
            if (!removed) return false;
            const clearDeletedPresentationSlot = (target) => {
                if (!isPlainObject(target?.profile_image_presentations)) return;
                const presentations = createProfileImagePresentations(
                    target.profile_image_presentations,
                );
                let changed = false;
                for (const key of ["male", "non_male"]) {
                    const slot = profileImageSlotFromExactInput(presentations[key]);
                    if (String(slot.local_image_id || "") !== imageId) continue;
                    presentations[key] = profileImageSlotFromExactInput({
                        ...slot,
                        local_image_id: "",
                    });
                    changed = true;
                }
                if (changed) target.profile_image_presentations = presentations;
            };
            const libraryRecord = characterLibraryRecordForProfileEntity(entity);
            const wasActive = String(entity.profile_image_id || "") === imageId;
            const wasDefault = defaultProfileLocalImageId(entity) === imageId;
            app.deletedProfileImageIds ||= new Set();
            app.deletedProfileImageIds.add(imageId);
            if (wasActive) entity.profile_image_id = "";
            deleteProfileImageRecordsNow([{ id: removed.id }], "profile image deleted");
            if (Array.isArray(entity.profile_images)) {
                entity.profile_images = entity.profile_images.filter(
                    (image) => String(image.id) !== imageId,
                );
            } else if (isPlainObject(entity.profile_images)) {
                entity.profile_images = characterDefinitionImageOwnerSlot({
                    ...entity.profile_images,
                    image_ids: (entity.profile_images.image_ids || []).filter(
                        (id) => String(id || "") !== imageId,
                    ),
                    active_image_id:
                        String(entity.profile_images.active_image_id || "") === imageId
                            ? ""
                            : entity.profile_images.active_image_id,
                });
            }
            app.profileImages = (app.profileImages || []).filter(
                (image) => String(image.id) !== imageId,
            );
            clearDeletedPresentationSlot(entity);
            if (libraryRecord?.character) {
                if (Array.isArray(libraryRecord.character.profile_images)) {
                    libraryRecord.character.profile_images =
                        libraryRecord.character.profile_images.filter(
                            (image) => String(image?.id || "") !== imageId,
                        );
                } else if (isPlainObject(libraryRecord.character.profile_images)) {
                    libraryRecord.character.profile_images =
                        characterDefinitionImageOwnerSlot(
                            {
                                ...libraryRecord.character.profile_images,
                                image_ids: (
                                    libraryRecord.character.profile_images.image_ids || []
                                ).filter((id) => String(id || "") !== imageId),
                                active_image_id:
                                    String(
                                        libraryRecord.character.profile_images
                                            .active_image_id || "",
                                    ) === imageId
                                        ? ""
                                        : libraryRecord.character.profile_images
                                              .active_image_id,
                            },
                        );
                }
                if (
                    String(libraryRecord.character.profile_image_id || "") === imageId
                )
                    libraryRecord.character.profile_image_id = "";
                const libraryDefault = profileImageSlotFromExactInput(
                    libraryRecord.character.default_profile_image,
                );
                if (String(libraryDefault.local_image_id || "") === imageId)
                    libraryRecord.character.default_profile_image =
                        profileImageSlotFromExactInput({
                            ...libraryDefault,
                            local_image_id: "",
                        });
            }
            clearDeletedPresentationSlot(libraryRecord?.character);
            const nextProfile = newestProfileImage(
                profileImagesForActivePresentation(entity).filter(
                    profileImageIsFinished,
                ),
            );
            if (wasActive) entity.profile_image_id = nextProfile?.id || "";
            if ((wasActive || wasDefault) && nextProfile) {
                setLocalDefaultProfileImage(entity, nextProfile.id, nextProfile, {
                    keepUrl: true,
                    save: false,
                });
            } else if (wasActive || wasDefault) {
                entity.default_profile_image = profileImageSlotFromExactInput({
                    ...(entity.default_profile_image || {}),
                    local_image_id: "",
                });
            }
            if (libraryRecord) {
                syncCharacterLibraryProfileSelection(name, entity.profile_image_id || "");
                saveCharacterLibraryRecordsNow(
                    [libraryRecord],
                    "character library profile image deleted",
                );
            }
            refreshKeptImageRuntimeSet();
            scheduleActiveGameSave();
            refreshProfileImageSurfaces(name);
            const hasProfile = !!activeProfileImage(entity);
            if (!hasProfile && options.queueReplacement !== false) {
                queueMissingProfileImageAfterDefaultAttempt(
                    name,
                    libraryRecord ? "character library visible" : "profile picker",
                    {
                        allowImportSkipped: true,
                        skipDefault: true,
                    },
                );
                refreshProfileImageSurfaces(name);
            }
            return true;
        }

        async function deleteProfileImage(name, id) {
            if (!profileEntity(name)) return;
            if (
                !(await showConfirm("Delete Profile Image", "Delete this profile image?", {
                    confirmText: "Delete",
                    danger: true,
                }))
            )
                return;
            if (!removeProfileImage(name, id)) return;
            beginLibrarySaving("Deleting profile image...");
            try {
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                );
            } finally {
                endLibrarySaving();
            }
        }

        function expandThreadWindowAtTop(thread = $("thread")) {
            if (!thread) return false;
            const currentMessageCount = visibleMessagesForRender().length;
            if (thread.scrollTop > 48 || app.threadRenderLimit >= currentMessageCount)
                return false;
            app.work.scheduleUi(
                "thread-expand-window",
                () => {
                    const latestMessageCount = visibleMessagesForRender().length;
                    app.threadRenderLimit = Math.min(
                        latestMessageCount,
                        Number(app.threadRenderLimit || 180) +
                            Number(app.threadRenderStep || 120),
                    );
                    renderThread("load earlier transcript window");
                },
                { priority: "background" },
            );
            return true;
        }
