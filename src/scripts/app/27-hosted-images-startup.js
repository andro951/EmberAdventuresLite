
        async function runHostedImageUploadTest() {
            try {
                const tinyPng =
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
                setUploadTestResult("Uploading test image...");
                const blob = await fetch(tinyPng).then((res) => res.blob());
                const upload = await uploadBlobToUserUploads(blob, "Test image upload", { testUpload: true });
                setUploadTestResult("Fetching test image...");
                const response = await fetch(upload.url);
                if (!response.ok) throw new Error(`Image URL returned HTTP ${response.status}.`);
                const fetched = await response.blob();
                if (!fetched.size) throw new Error("Fetched image was empty.");
                setUploadTestResult("Deleting test image upload...");
                await cleanupHostedUploads([upload], "Test image upload");
                setUploadTestResult("Image upload test passed.");
            } catch (err) {
                setUploadTestResult("Image upload test failed.");
                showNotice("Image Upload Test Failed", err.message || String(err));
            }
        }

        function publicLibrarySupabaseUrl() {
            return String(app.settings.publicLibrarySupabaseUrl || SUPABASE_PROJECT_URL || "")
                .trim()
                .replace(/\/rest\/v1\/?$/i, "")
                .replace(/\/+$/g, "");
        }

        function publicLibrarySupabaseAnonKey() {
            return String(app.settings.publicLibrarySupabaseAnonKey || SUPABASE_PUBLISHABLE_KEY || "").trim();
        }

        function publicLibrarySupabaseConfigured() {
            return !!publicLibrarySupabaseUrl() && !!publicLibrarySupabaseAnonKey();
        }

        function publicLibraryApproxBytes(value) {
            try {
                return new Blob([typeof value === "string" ? value : JSON.stringify(value ?? "")]).size;
            } catch {
                return String(value ?? "").length;
            }
        }

        function publicLibraryQueryState() {
            app.publicLibraryQuery ||= {
                search: "",
                submittedSearch: "",
                page: 0,
                pageSize: 25,
                lastMode: "",
                lastCount: 0,
                lastHasNext: false,
                filters: {},
                submittedFilters: {},
            };
            app.publicLibraryQuery.filters ||= {};
            app.publicLibraryQuery.submittedFilters ||= {};
            app.publicLibraryQuery.pageSize = Math.min(
                50,
                Math.max(1, Number(app.publicLibraryQuery.pageSize || 25)),
            );
            app.publicLibraryQuery.page = Math.max(0, Number(app.publicLibraryQuery.page || 0));
            return app.publicLibraryQuery;
        }

        function publicLibrarySearchHint(text = "") {
            const el = $("publicLibrarySearchHint");
            if (el) el.textContent = text;
        }

        function schedulePublicLibrarySearchHint() {
            if (app.publicLibrarySearchHintTimer) clearTimeout(app.publicLibrarySearchHintTimer);
            app.publicLibrarySearchHintTimer = setTimeout(() => {
                const query = publicLibraryQueryState();
                const current = String($("publicLibraryStorySearch")?.value || "").trim();
                const filters = publicLibraryCleanFilters(publicLibraryFilterControlValues());
                if (
                    current !== String(query.submittedSearch || "").trim() ||
                    !publicLibraryFiltersEqual(filters, query.submittedFilters || {})
                )
                    publicLibrarySearchHint("Press Search or Enter to search.");
            }, 2000);
        }

        function handlePublicLibrarySearchInput() {
            publicLibraryQueryState().search = String($("publicLibraryStorySearch")?.value || "");
            publicLibrarySearchHint("");
            schedulePublicLibrarySearchHint();
        }

        function publicLibraryFilterControlValues(root = document) {
            return {
                genre: String(root.querySelector?.("#publicLibraryGenreFilter")?.value || "").trim(),
                source: String(root.querySelector?.("#publicLibrarySourceFilter")?.value || "").trim(),
                creator: String(root.querySelector?.("#publicLibraryCreatorFilter")?.value || "").trim(),
                gender: String(root.querySelector?.("#publicLibraryGenderFilter")?.value || "").trim(),
                ageMin: String(root.querySelector?.("#publicLibraryAgeMinFilter")?.value || "").trim(),
                ageMax: String(root.querySelector?.("#publicLibraryAgeMaxFilter")?.value || "").trim(),
            };
        }

        function publicLibraryCleanFilters(filters = {}) {
            const clean = {};
            for (const [key, value] of Object.entries(filters || {})) {
                const text = String(value ?? "").trim();
                if (text) clean[key] = text;
            }
            return clean;
        }

        function publicLibraryFiltersEqual(a = {}, b = {}) {
            return JSON.stringify(publicLibraryCleanFilters(a)) === JSON.stringify(publicLibraryCleanFilters(b));
        }

        function handlePublicLibraryFilterInput() {
            const query = publicLibraryQueryState();
            query.filters = publicLibraryCleanFilters(publicLibraryFilterControlValues());
            publicLibrarySearchHint("");
            schedulePublicLibrarySearchHint();
        }

        function handlePublicLibrarySearchKey(event) {
            if (event?.key === "Enter") {
                event.preventDefault();
                inspectPublicLibraryIndex({ resetPage: true });
            }
        }

        function saveSupabaseSession(session = null) {
            app.supabaseSession = session && session.access_token ? session : null;
            if (!isOfficialEmberAdventuresAdminUser(app.supabaseSession?.user))
                clearAdminInboxAvailability();
            if (app.supabaseSession)
                largeSetStorageItem(SUPABASE_SESSION_KEY, app.supabaseSession, {
                    json: true,
                });
            else largeRemoveStorageItem(SUPABASE_SESSION_KEY);
        }

        function supabaseSessionAccessToken() {
            return app.supabaseSession?.access_token || "";
        }

        function isSupabaseAuthSessionError(err) {
            return /\b(?:bad_jwt|invalid JWT|JWT|refresh_token|401)\b/i.test(
                String(err?.message || err || ""),
            );
        }

        function supabaseSignedInUser() {
            return app.supabaseSession?.user || null;
        }

        function isOfficialEmberAdventuresAdminUser(user = null) {
            return (
                String(user?.id || "") === OFFICIAL_EMBERADVENTURES_OWNER_USER_ID &&
                String(user?.email || "").trim().toLowerCase() ===
                    OFFICIAL_EMBERADVENTURES_OWNER_EMAIL
            );
        }

        const FEATURED_CONTENT_PUBLISHER_DRAFT_KEY =
            "emberadventureslite-featured-content-publisher-draft-v1";

        function featuredContentPublisherAuthorized() {
            return app.settings?.devMode === true &&
                isOfficialEmberAdventuresAdminUser(supabaseSignedInUser());
        }

        function featuredContentPublisherDraft() {
            if (!featuredContentPublisherAuthorized())
                return { featuredCharacters: [], featuredStories: [], sandboxStories: [] };
            const parsed = tryJson(
                localStorage.getItem(FEATURED_CONTENT_PUBLISHER_DRAFT_KEY) || "{}",
            ) || {};
            return {
                featuredCharacters: Array.isArray(parsed.featuredCharacters)
                    ? parsed.featuredCharacters.filter((entry) => entry?.url && entry?.characterId)
                    : [],
                featuredStories: Array.isArray(parsed.featuredStories)
                    ? parsed.featuredStories.filter((entry) => entry?.url && entry?.storyId)
                    : [],
                sandboxStories: Array.isArray(parsed.sandboxStories)
                    ? parsed.sandboxStories.filter((entry) => entry?.url && entry?.storyId)
                    : [],
            };
        }

        function saveFeaturedContentPublisherDraft(draft = {}) {
            if (!featuredContentPublisherAuthorized())
                throw new Error("Featured content publishing requires the official EmberAdventures developer account.");
            localStorage.setItem(
                FEATURED_CONTENT_PUBLISHER_DRAFT_KEY,
                JSON.stringify({
                    featuredCharacters: draft.featuredCharacters || [],
                    featuredStories: draft.featuredStories || [],
                    sandboxStories: draft.sandboxStories || [],
                }),
            );
        }

        function uniqueFeaturedManifestEntries(entries = [], idField = "storyId") {
            const byId = new Map();
            for (const entry of entries.filter(Boolean)) {
                const id = String(entry[idField] || "").trim();
                if (id && entry.url) byId.set(id, entry);
            }
            return [...byId.values()];
        }

        function featuredContentCharacterManifest() {
            //Publisher drafts retain upload history, not the active Featured lineup.
            return [...PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS];
        }

        function featuredCharacterConfiguredEntry(characterId = "") {
            const wanted = String(characterId || "");
            return PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.find(
                (entry) => String(entry?.characterId || "") === wanted,
            ) || null;
        }

        function featuredCharacterDraftEntry(characterId = "") {
            const wanted = String(characterId || "");
            return featuredContentPublisherDraft().featuredCharacters.find(
                (entry) => String(entry?.characterId || "") === wanted,
            ) || null;
        }

        function featuredCharacterManifestEntry(characterId = "") {
            return featuredCharacterDraftEntry(characterId) ||
                featuredCharacterConfiguredEntry(characterId);
        }

        function featuredCharacterLocalRecord(characterId = "") {
            const wanted = String(characterId || "");
            return characterLibraryRecords().find(
                (record) => String(record?.id || "") === wanted,
            ) || null;
        }

        function featuredCharacterVersionRecord(entry = {}) {
            return {
                version: Math.max(1, Number(entry.version) || 1),
                url: String(entry.url || ""),
                revision: String(entry.revision || ""),
                payloadSha256: String(entry.payloadSha256 || ""),
                payloadSizeBytes: Number(entry.payloadSizeBytes || 0),
                uploadedAt: String(entry.uploadedAt || ""),
            };
        }

        function featuredCharacterVersions(entry = {}) {
            const versions = Array.isArray(entry.versions)
                ? entry.versions.map(featuredCharacterVersionRecord)
                : [];
            if (entry.url && !versions.some((version) => version.url === entry.url))
                versions.push(featuredCharacterVersionRecord(entry));
            versions.sort((a, b) => a.version - b.version);
            return versions;
        }

        function nextFeaturedCharacterManifestEntry(record = {}, upload = {}) {
            const previous = featuredCharacterManifestEntry(record.id) || {};
            const versions = featuredCharacterVersions(previous);
            const version = versions.reduce(
                (highest, item) => Math.max(highest, item.version),
                0,
            ) + 1;
            const nextVersion = featuredCharacterVersionRecord({
                version,
                url: publicUploadFileUrl(upload.fileName),
                revision: upload.sha256.slice(0, 16),
                payloadSha256: upload.sha256,
                payloadSizeBytes: upload.payloadSizeBytes,
                uploadedAt: new Date().toISOString(),
            });
            return {
                ...nextVersion,
                characterId: record.id,
                creator: record.creator,
                creatorId: record.creator_id,
                versions: [...versions, nextVersion],
            };
        }

        function featuredContentStoryManifest(group = "featured") {
            const draft = featuredContentPublisherDraft();
            const configured = group === "sandbox"
                ? PUBLIC_LIBRARY_SANDBOX_STORY_URLS
                : PUBLIC_LIBRARY_FEATURED_STORY_URLS;
            const staged = group === "sandbox"
                ? draft.sandboxStories
                : draft.featuredStories;
            return uniqueFeaturedManifestEntries([...configured, ...staged], "storyId");
        }

        function featuredContentManifestSource(draft = featuredContentPublisherDraft()) {
            const sourceArray = (entries) => JSON.stringify(entries || [], null, 4)
                .split("\n")
                .map((line, index) => index ? `        ${line}` : line)
                .join("\n");
            const characters = uniqueFeaturedManifestEntries(
                [...PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS, ...draft.featuredCharacters],
                "characterId",
            );
            const featuredStories = uniqueFeaturedManifestEntries(
                [...PUBLIC_LIBRARY_FEATURED_STORY_URLS, ...draft.featuredStories],
                "storyId",
            );
            const sandboxStories = uniqueFeaturedManifestEntries(
                [...PUBLIC_LIBRARY_SANDBOX_STORY_URLS, ...draft.sandboxStories],
                "storyId",
            );
            return [
                `const PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS = ${sourceArray(characters)};`,
                `const PUBLIC_LIBRARY_FEATURED_STORY_URLS = ${sourceArray(featuredStories)};`,
                `const PUBLIC_LIBRARY_SANDBOX_STORY_URLS = ${sourceArray(sandboxStories)};`,
            ].join("\n\n");
        }

        function assertFeaturedContentPublisherAuthorized() {
            if (featuredContentPublisherAuthorized()) return true;
            showNotice(
                "Featured Content Publisher Unavailable",
                `Featured content publishing requires dev mode and the signed-in ${OFFICIAL_EMBERADVENTURES_OWNER_EMAIL} account.`,
            );
            return false;
        }

        function batchCharacterImageToolAuthorized() {
            return app.settings?.devMode === true &&
                isOfficialEmberAdventuresAdminUser(supabaseSignedInUser());
        }

        function assertBatchCharacterImageToolAuthorized() {
            if (batchCharacterImageToolAuthorized()) return true;
            showNotice(
                "Batch Character Images Unavailable",
                `This developer tool requires dev mode and the signed-in ${OFFICIAL_EMBERADVENTURES_OWNER_EMAIL} account.`,
            );
            return false;
        }



        function batchCharacterImageToolState() {
            app.batchCharacterImageTool ||= {
                sessionId: `batch-character-images-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                selected: new Set(),
                outfitByCharacterId: {},
                lastActualOutfitByCharacterId: {},
                query: "",
                queue: [],
                running: false,
                activeJob: null,
                cancelled: false,
                trackedImages: [],
                failedJobs: [],
                nextRequestId: 1,
            };
            app.batchCharacterImageTool.query ||= "";
            app.batchCharacterImageTool.lastActualOutfitByCharacterId ||= {};
            app.batchCharacterImageTool.failedJobs ||= [];
            return app.batchCharacterImageTool;
        }

        function batchCharacterImageToolNewImageId(state) {
            const requestId = state.nextRequestId++;
            return `${Date.now()}-${requestId}-${Math.random().toString(36).slice(2)}`;
        }

        function batchCharacterImageToolRecords() {
            return characterLibraryRecords().filter((record) =>
                !record?.publicEntry && !!characterLibraryRecordEntity(record),
            );
        }

        function batchCharacterImageToolShownRecords(state = batchCharacterImageToolState()) {
            const query = String(state.query || "").trim().toLocaleLowerCase();
            return batchCharacterImageToolRecords().filter((record) => {
                if (!query) return true;
                const entity = characterLibraryRecordEntity(record);
                return String(entity?.name || record?.name || "")
                    .toLocaleLowerCase()
                    .includes(query);
            });
        }

        function batchCharacterImageToolOutfit(entity, selectedId = "") {
            const outfits = exactEntityOutfits(clone(entity));
            return outfits.find((outfit) => String(outfit.id) === String(selectedId)) || outfits[0] || null;
        }

        function batchCharacterImageToolInitialOutfitId(entity = {}) {
            const outfits = exactEntityOutfits(clone(entity));
            const preferredIds = [entity.starting_outfit_id, entity.active_outfit_id];
            return String(
                preferredIds.find((id) =>
                    outfits.some((outfit) => String(outfit.id) === String(id || "")),
                ) || outfits[0]?.id || "",
            );
        }

        function batchCharacterImageToolImageElement(image = null) {
            const frame = document.createElement("div");

            frame.className = "profile-image-thumb-wrap";
            const storedSource = String(
                image?.html || image?.url || image?.hosted_url || "",
            ).trim();
            const source = extractImageSrc(storedSource) ||
                (storedSource.startsWith("<") ? "" : storedSource);
            if (source) {
                const element = document.createElement("img");

                element.loading = "lazy";
                element.decoding = "async";
                element.alt = image?.title || "Character image";
                element.src = source;
                frame.append(element);
            }
            else {
                const placeholder = document.createElement("div");

                placeholder.className = "profile-image-placeholder";
                placeholder.setAttribute("aria-label", "No character image");
                frame.append(placeholder);
            }
            return frame;
        }

        function batchCharacterImageToolOutputElement(image = {}) {
            const card = document.createElement("div");
            const frame = document.createElement("div");
            const storedSource = String(
                image.html || image.url || image.hosted_url || "",
            ).trim();
            const source = extractImageSrc(storedSource) ||
                (storedSource.startsWith("<") ? "" : storedSource);

            card.className = "image-card";
            frame.className = "image-render";
            frame.style.aspectRatio = "2 / 3";
            frame.style.minHeight = "0";
            if (trustedStoredImageSrc(source)) {
                const element = document.createElement("img");

                element.loading = "lazy";
                element.decoding = "async";
                element.alt = image.title || "Character image";
                element.src = source;
                element.style.width = "100%";
                element.style.height = "100%";
                element.style.objectFit = "contain";
                frame.append(element);
            }
            card.append(frame);
            return card;
        }

        function batchCharacterImageToolFailureElement(failure = {}, state) {
            const card = document.createElement("div");
            const title = document.createElement("strong");
            const message = document.createElement("p");
            const retry = document.createElement("button");

            card.className = "image-card batch-character-image-failure";
            title.textContent = `${failure.job?.entity?.name || "Character image"} failed`;
            message.className = "hint";
            message.textContent = failure.error || "Image generation failed.";
            retry.type = "button";
            retry.textContent = "Retry";
            retry.disabled = batchCharacterImageToolSessionBusy(state);
            retry.onclick = () => retryBatchCharacterImageFailure(failure);
            card.append(title, message, retry);
            return card;
        }

        function batchCharacterImageToolCardElement(record, state) {
            const context = characterLibraryPresentationContext(record);
            const entity = context?.entity || characterLibraryRecordEntity(record);
            const id = String(record.id || "");
            const outfits = exactEntityOutfits(clone(entity));
            const initialOutfitId = batchCharacterImageToolInitialOutfitId(entity);
            const selectedOutfitId = Object.prototype.hasOwnProperty.call(
                state.outfitByCharacterId,
                id,
            )
                ? state.outfitByCharacterId[id]
                : initialOutfitId;
            state.outfitByCharacterId[id] = selectedOutfitId;
            state.lastActualOutfitByCharacterId[id] ||= initialOutfitId;
            const profile = characterProfilePresentationCandidate(
                entity,
                characterPresentationUsesMaleFields(entity.gender),
            );
            const hasImage = !!(
                profile?.html || profile?.url || profile?.hosted_url
            );
            const selected = state.selected.has(id);
            const card = document.createElement("div");
            const name = document.createElement("div");
            const outfitLabel = document.createElement("label");
            const outfitSelect = document.createElement("select");
            const selectLabel = document.createElement("label");
            const checkbox = document.createElement("input");

            card.className = `character-card batch-character-image-card${selected ? " selected" : ""}`;
            card.dataset.batchCharacterId = id;
            card.setAttribute("role", "button");
            card.setAttribute("aria-selected", selected ? "true" : "false");
            card.tabIndex = 0;
            card.style.outline = selected ? "2px solid #2f9e5b" : "none";
            card.style.outlineOffset = selected ? "-2px" : "0";
            card.onclick = () => toggleBatchCharacterImage(id);
            card.onkeydown = (event) => {
                if (!["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                toggleBatchCharacterImage(id);
            };
            name.className = "character-name";
            name.textContent = entity.name || record.name || "Character";
            outfitLabel.textContent = "Outfit ";
            outfitLabel.style.minWidth = "0";
            outfitLabel.onclick = (event) => event.stopPropagation();
            outfitSelect.dataset.batchOutfit = id;
            outfitSelect.style.width = "100%";
            outfitSelect.style.minWidth = "0";
            outfitSelect.onclick = (event) => event.stopPropagation();
            outfitSelect.onchange = (event) => {
                event.stopPropagation();
                setBatchCharacterImageOutfit(id, outfitSelect.value);
            };





            outfitSelect.append();
            for (const outfit of outfits) {
                const option = document.createElement("option");

                option.value = outfit.id;
                option.textContent = outfit.name || outfit.id;
                option.selected = String(outfit.id) === String(selectedOutfitId);
                outfitSelect.append(option);
            }
            selectLabel.className = "batch-character-image-select check-row";
            selectLabel.onclick = (event) => event.stopPropagation();
            checkbox.type = "checkbox";
            checkbox.checked = selected;
            checkbox.onchange = (event) => {
                event.stopPropagation();
                toggleBatchCharacterImage(id);
            };
            selectLabel.append(checkbox, document.createTextNode(" Select"));
            outfitLabel.append(outfitSelect);
            card.append(
                name,
                batchCharacterImageToolImageElement(hasImage ? profile : null),
                outfitLabel,
                selectLabel,
            );
            return card;
        }

        function batchCharacterImageToolSessionBusy(state = batchCharacterImageToolState()) {
            return state.running || state.queue.length > 0;
        }

        function batchCharacterImageToolRender() {
            const modal = $("modalBox");
            if (!modal?.querySelector?.("[data-batch-character-image-tool]")) return;
            const state = batchCharacterImageToolState();
            const records = batchCharacterImageToolShownRecords(state);
            const output = state.trackedImages.filter((image) => image && !image.error);
            const failures = state.failedJobs.filter((failure) => failure?.job);
            const grid = modal.querySelector("[data-batch-character-image-grid]");
            if (grid)
                grid.replaceChildren(
                    ...records.map((record) =>
                        batchCharacterImageToolCardElement(record, state),
                    ),
                );
            const outputGrid = modal.querySelector("[data-batch-character-image-output]");
            if (outputGrid) {
                if (output.length || failures.length)
                    outputGrid.replaceChildren(
                        ...output.map((image) => batchCharacterImageToolOutputElement(image)),
                        ...failures.map((failure) =>
                            batchCharacterImageToolFailureElement(failure, state),
                        ),
                    );
                else {
                    const empty = document.createElement("p");

                    empty.className = "hint";
                    empty.textContent = "Completed images will appear here.";
                    outputGrid.replaceChildren(empty);
                }
            }
            const download = modal.querySelector("[data-batch-character-image-download]");
            const busy = batchCharacterImageToolSessionBusy(state);
            if (download) download.disabled = busy || !state.trackedImages.length;
            const retryFailed = modal.querySelector(
                "[data-batch-character-image-retry-failed]",
            );
            if (retryFailed) retryFailed.disabled = busy || !failures.length;
            const generate = modal.querySelector("[data-batch-character-image-generate]");
            if (generate) generate.disabled = !state.selected.size;
            const status = modal.querySelector("[data-batch-character-image-status]");
            if (status) {
                const activeName = String(state.activeJob?.name || "").trim();
                status.textContent = busy
                    ? `${output.length} completed, ${failures.length} failed; ${activeName ? `Generating ${activeName}` : "Starting next image"}; ${state.queue.length} queued. A stalled image may take up to ${exactImageRequestTimeoutSeconds(app.settings.imageRequestTimeoutSeconds)} seconds to time out before the queue continues.`
                    : `${output.length} completed image${output.length === 1 ? "" : "s"}, ${failures.length} failed image${failures.length === 1 ? "" : "s"}.`;
            }
        }

        function retryBatchCharacterImageFailure(failure = null) {
            if (!assertBatchCharacterImageToolAuthorized()) return false;
            const state = batchCharacterImageToolState();
            const index = state.failedJobs.indexOf(failure);
            if (index < 0 || !failure?.job) return false;
            const job = clone(failure.job);
            job.imageId = batchCharacterImageToolNewImageId(state);
            state.failedJobs.splice(index, 1);
            state.queue.push(job);
            batchCharacterImageToolRender();
            runBatchCharacterImageQueue(state);
            return true;
        }

        function retryAllBatchCharacterImageFailures() {
            if (!assertBatchCharacterImageToolAuthorized()) return false;
            const state = batchCharacterImageToolState();
            if (batchCharacterImageToolSessionBusy(state) || !state.failedJobs.length)
                return false;
            const failures = state.failedJobs.splice(0);
            for (const failure of failures) {
                if (!failure?.job) continue;
                const job = clone(failure.job);
                job.imageId = batchCharacterImageToolNewImageId(state);
                state.queue.push(job);
            }
            batchCharacterImageToolRender();
            runBatchCharacterImageQueue(state);
            return true;
        }

        function filterBatchCharacterImages(query = "") {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            batchCharacterImageToolState().query = String(query || "");
            batchCharacterImageToolRender();
        }

        function selectAllShownBatchCharacterImages() {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            const state = batchCharacterImageToolState();
            for (const record of batchCharacterImageToolShownRecords(state))
                state.selected.add(String(record.id || ""));
            batchCharacterImageToolRender();
        }

        function deselectAllBatchCharacterImages() {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            batchCharacterImageToolState().selected.clear();
            batchCharacterImageToolRender();
        }

        function toggleBatchCharacterImage(id = "") {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            const state = batchCharacterImageToolState();
            const key = String(id || "");
            if (state.selected.has(key)) state.selected.delete(key);
            else state.selected.add(key);
            batchCharacterImageToolRender();
        }

        function setBatchCharacterImageOutfit(id = "", outfitId = "") {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            const state = batchCharacterImageToolState();
            state.outfitByCharacterId[String(id || "")] = String(outfitId || "");
            batchCharacterImageToolRender();
        }



        function restoreBatchCharacterImageOutfits() {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            const state = batchCharacterImageToolState();
            for (const record of batchCharacterImageToolRecords()) {
                const entity = characterLibraryPresentationContext(record)?.entity || characterLibraryRecordEntity(record);
                state.outfitByCharacterId[String(record.id || "")] = batchCharacterImageToolInitialOutfitId(entity);
            }

            batchCharacterImageToolRender();
        }

        async function batchCharacterImageStorageEntries(image = {}) {
            const source = extractImageSrc(image.html);
            if (!source) throw new Error(`${image.title || "Character image"} has no finished image source.`);
            const response = await fetch(source);
            if (!response.ok) throw new Error(`Character image fetch returned HTTP ${response.status}.`);
            const blob = await response.blob();
            const imageId = String(image.id || "");
            return [
                {
                    storeName: "characterImages",
                    record: {
                        imageId,
                        characterId: String(image.characterId || ""),
                        presentation: image.presentation === "male" ? "male" : "non_male",
                        favorite: false,
                        model: String(image.model || ""),
                        seed: image.seed ?? null,
                        prompt: String(image.prompt || ""),
                        negativePrompt: String(image.negativePrompt || ""),
                        url: "",
                    },
                },
                {
                    storeName: "assetBlobs",
                    record: {
                        imageId,
                        blob,
                        mimeType: blob.type || "image/png",
                        byteLength: blob.size,
                        contentHash: await sharedImageBlobSha256(blob),
                    },
                },
            ];
        }

        async function runBatchCharacterImageQueue(state) {
            if (state.running || state.cancelled) return;
            state.running = true;
            batchCharacterImageToolRender();
            try {
                while (!state.cancelled && state.queue.length) {
                    const job = state.queue.shift();
                    const entity = job.entity;
                    const entities = [[entity.name, entity]];
                    const image = {
                        id: job.imageId,
                        characterId: job.characterId,
                        presentation: job.presentation,
                        title: entity.name,
                        pending: true,
                        error: "",
                    };
                    state.activeJob = {
                        imageId: job.imageId,
                        name: entity.name,
                        startedAt: Date.now(),
                    };
                    batchCharacterImageToolRender();
                    try {
                        Object.assign(
                            image,
                            prepareNormalImageRequest(
                                entities,
                                "developer batch character image",
                                {
                                    includeSceneContext: false,
                                    backgroundOverride: buildProfileBackgroundPrompt(entity),
                                    targets: [entity.id || entity.name],
                                },
                            ),
                            {
                                id: job.imageId,
                                characterId: job.characterId,
                                presentation: job.presentation,
                                error: "",
                            },
                        );
                        const seed = image.seed === "random" ? undefined : image.seed;
                        image.html = await generateImageHtml(
                            image.prompt,
                            image.negativePrompt,
                            seed,
                            image.model,
                            normalImageRequestGenerationOptions(image, {
                                ensureIframeHost: true,
                                iframeHostKey: normalImageRequestIframeHostKey(image.id),
                            }),
                        );
                        image.pending = false;
                        if (!image.html) throw new Error("Image plugin returned no finished image.");
                        if (state.cancelled || app.batchCharacterImageTool !== state) continue;
                        await app.persistence.putSharedRecords(
                            await batchCharacterImageStorageEntries(image),
                        );
                        app.characterImages ||= [];
                        app.characterImages.unshift(image);
                        state.trackedImages.push(image);
                    } catch (error) {
                        image.pending = false;
                        image.error = error?.message || String(error);
                        if (!state.cancelled && app.batchCharacterImageTool === state) {
                            state.failedJobs.push({
                                job: clone(job),
                                error: image.error,
                            });
                            log("Batch character image failed", image.error, {
                                type: "image",
                                level: imageRequestFailureLogLevel(error),
                                characterId: job.characterId,
                                characterName: entity.name,
                                presentation: job.presentation,
                            });
                        }
                    } finally {
                        state.activeJob = null;
                    }
                    batchCharacterImageToolRender();
                }
            } finally {
                state.activeJob = null;
                state.running = false;
                batchCharacterImageToolRender();
            }
        }

        function generateBatchCharacterImages() {
            if (!assertBatchCharacterImageToolAuthorized()) return false;
            const state = batchCharacterImageToolState();
            const recordsById = new Map(
                batchCharacterImageToolRecords().map((record) => [String(record.id), record]),
            );
            for (const id of [...state.selected]) {
                const record = recordsById.get(id);
                const context = record ? characterLibraryPresentationContext(record) : null;
                const source = context?.entity || characterLibraryRecordEntity(record);
                if (!record || !source) continue;
                const entity = clone(source);
                const selectedOutfitId = state.outfitByCharacterId[id] ||
                    batchCharacterImageToolInitialOutfitId(entity);
                const outfit = batchCharacterImageToolOutfit(entity, selectedOutfitId);
                if (outfit) {
                    entity.active_outfit_id = outfit.id;
                    entity.clothing = clone(outfit.clothing || {});
                    entity.held_items = clone(outfit.held_items || {});
                }
                state.queue.push({
                    imageId: batchCharacterImageToolNewImageId(state),
                    characterId: String(entity.id || id),
                    presentation: context?.presentationKey === "male" ? "male" : "non_male",
                    entity,
                });
            }
            state.selected.clear();
            batchCharacterImageToolRender();
            runBatchCharacterImageQueue(state);
            return true;
        }

        function cancelBatchCharacterImageToolQueue() {
            const state = app.batchCharacterImageTool;
            if (state) {
                state.cancelled = true;
                state.queue.length = 0;
                const activeImageId = String(state.activeJob?.imageId || "");
                if (activeImageId)
                    removeImageGenerationIframeHost(
                        normalImageRequestIframeHostKey(activeImageId),
                        "batch character image tool closed",
                    );
            }
            app.batchCharacterImageTool = null;
        }

        function closeBatchCharacterImageTool() {
            closeModal();
        }

        async function downloadBatchCharacterImages() {
            if (!assertBatchCharacterImageToolAuthorized()) return false;
            const state = batchCharacterImageToolState();
            if (batchCharacterImageToolSessionBusy(state) || !state.trackedImages.length)
                return false;
            const archive = await buildImageArchiveFilesAsync({
                type: "batch-character-images",
                images: state.trackedImages,
            });
            const failures = archive.metadataImages.filter(
                (image) => image.image_export_error,
            );
            if (failures.length) {
                showNotice(
                    "Batch Image Download Failed",
                    `${failures.length} generated image${failures.length === 1 ? "" : "s"} could not be read for download. The output list was kept so you can retry.`,
                );
                return false;
            }
            const url = URL.createObjectURL(makeZip(archive.files));
            const link = document.createElement("a");
            link.href = url;
            link.download = `emberadventureslite-batch-character-images-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            state.trackedImages = [];
            batchCharacterImageToolRender();
            return true;
        }

        function openBatchCharacterImageTool() {
            if (!assertBatchCharacterImageToolAuthorized()) return;
            batchCharacterImageToolState();
            openModal("", { title: "Batch Character Images" });
            const modal = $("modalBox");
            const root = document.createElement("div");
            const hint = document.createElement("p");
            const selectionTools = document.createElement("div");
            const search = document.createElement("input");
            const selectAllShown = document.createElement("button");
            const deselectAll = document.createElement("button");

            const restoreOutfits = document.createElement("button");
            const grid = document.createElement("div");
            const actions = document.createElement("div");
            const generate = document.createElement("button");
            const retryFailed = document.createElement("button");
            const download = document.createElement("button");
            const close = document.createElement("button");
            const status = document.createElement("p");
            const outputTitle = document.createElement("h3");
            const output = document.createElement("div");

            modal.dataset.batchCharacterImageToolModal = "1";
            root.dataset.batchCharacterImageTool = "1";
            hint.className = "hint";
            hint.textContent =
                "Select local characters and one saved outfit for each. Each Generate All click adds one normal solo-character image per selected character.";
            selectionTools.className = "row";
            search.type = "search";
            search.value = batchCharacterImageToolState().query;
            search.placeholder = "Search character names...";
            search.setAttribute("aria-label", "Search batch characters by name");
            search.dataset.batchCharacterImageSearch = "1";
            search.oninput = () => filterBatchCharacterImages(search.value);
            selectAllShown.type = "button";
            selectAllShown.dataset.batchCharacterImageSelectShown = "1";
            selectAllShown.textContent = "Select All Shown";
            selectAllShown.onclick = selectAllShownBatchCharacterImages;
            deselectAll.type = "button";
            deselectAll.dataset.batchCharacterImageDeselectAll = "1";
            deselectAll.textContent = "Deselect All";
            deselectAll.onclick = deselectAllBatchCharacterImages;




            restoreOutfits.type = "button";
            restoreOutfits.dataset.batchCharacterImageRestoreOutfits = "1";
            restoreOutfits.textContent = "Restore Outfits";
            restoreOutfits.onclick = restoreBatchCharacterImageOutfits;
            selectionTools.append(
                search,
                selectAllShown,
                deselectAll,
                restoreOutfits,
            );
            grid.className = "character-library-grid card-size-large";
            grid.dataset.batchCharacterImageGrid = "1";
            applyCompactCharacterSelectionGridSize(grid);
            actions.className = "row";
            actions.style.marginTop = ".8rem";
            generate.type = "button";
            generate.className = "primary";
            generate.dataset.batchCharacterImageGenerate = "1";
            generate.textContent = "Generate All";
            generate.onclick = generateBatchCharacterImages;
            retryFailed.type = "button";
            retryFailed.dataset.batchCharacterImageRetryFailed = "1";
            retryFailed.textContent = "Retry Failed";
            retryFailed.onclick = retryAllBatchCharacterImageFailures;
            download.type = "button";
            download.dataset.batchCharacterImageDownload = "1";
            download.textContent = "Download All";
            download.onclick = downloadBatchCharacterImages;
            close.type = "button";
            close.textContent = "Close";
            close.onclick = closeBatchCharacterImageTool;
            status.className = "hint";
            status.dataset.batchCharacterImageStatus = "1";
            outputTitle.textContent = "Completed This Tool Session";
            output.className = "character-library-grid card-size-large";
            output.dataset.batchCharacterImageOutput = "1";
            actions.append(generate, retryFailed, download, close);
            root.append(hint, selectionTools, grid, actions, status, outputTitle, output);
            modal.append(root);
            batchCharacterImageToolRender();
        }

        function featuredContentPublisherSelectionHtml(kind = "character", id = "") {
            const dataAttribute = kind === "story"
                ? "data-featured-publisher-story"
                : "data-featured-publisher-character";
            return `
                <label class="featured-content-publisher-selection" onclick="event.stopPropagation()">
                    <input type="checkbox" ${dataAttribute} value="${escapeHtml(id)}" onchange="EmberAdventures.syncFeaturedContentPublisherCard(this)">
                    <span>Select</span>
                </label>
            `;
        }

        function featuredContentPublisherCharacterRowsHtml(published = false) {
            const records = characterLibraryRecords().filter((record) =>
                published
                    ? !!featuredCharacterManifestEntry(record.id)
                    : !featuredCharacterManifestEntry(record.id),
            );
            return records.map((record) => {
                const recordId = characterLibraryRecordId(record);
                const configured = !!featuredCharacterConfiguredEntry(record.id);
                const draftEntry = featuredCharacterDraftEntry(record.id);
                const staged = !!draftEntry &&
                    draftEntry.url !== featuredCharacterConfiguredEntry(record.id)?.url;
                const state = staged ? "staged" : configured ? "published" : "available";
                return `
                    <div class="featured-content-publisher-card ${escapeHtml(state)}" data-featured-publisher-card="character" data-featured-character-state="${escapeHtml(state)}">
                        ${characterLibraryRecordHtml(record, {
                            clickExpression: published
                                ? `EmberAdventures.openFeaturedCharacterManager(${htmlJsArg(recordId)})`
                                : "event.stopPropagation()",
                            footerHtml: published
                                ? `<div class="featured-content-publisher-status">${staged ? "Pending manifest update" : "Featured"}</div>`
                                : featuredContentPublisherSelectionHtml("character", recordId),
                        })}
                    </div>
                `;
            }).join("") || `<p class="hint">${published ? "No local Featured Characters are configured." : "No unpublished local characters are available."}</p>`;
        }

        function featuredContentPublisherStoryRowsHtml() {
            return (app.storyTemplates || [])
                .map((template) => {
                    const sandbox = /^sandbox\b/i.test(String(template.title || ""));
                    const storyId = template.id || "";
                    const footerHtml = `
                        <div class="featured-content-publisher-story-controls" onclick="event.stopPropagation()">
                            ${featuredContentPublisherSelectionHtml("story", storyId)}
                            <label>
                                <span>Section</span>
                                <select data-featured-publisher-story-group="${escapeHtml(storyId)}" aria-label="Library section">
                                    <option value="featured" ${sandbox ? "" : "selected"}>Featured Stories</option>
                                    <option value="sandbox" ${sandbox ? "selected" : ""}>Sandbox Stories</option>
                                </select>
                            </label>
                        </div>
                    `;
                    return `
                        <div class="featured-content-publisher-card" data-featured-publisher-card="story">
                            ${storyLibraryRecordHtml(template, {
                                clickExpression: `EmberAdventures.toggleFeaturedContentPublisherCard('story', ${htmlJsArg(storyId)})`,
                                footerHtml,
                            })}
                        </div>
                    `;
                })
                .join("") || `<p class="hint">No local stories are available.</p>`;
        }

        function openBulkPublicCharacterUploader() {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const state = app.bulkPublicCharacterUpload ||= { running: false, stop: false, rows: [] };
            if (!state.running) {
                const previous = new Map(state.rows.map((row) => [row.id, row]));
                state.rows = characterLibraryRecords().map((record) => {
                    const id = characterLibraryRecordId(record);
                    return previous.get(id) || {
                        id, name: record.name, selected: false, status: "Ready", error: "",
                    };
                });
            }

            openModal("", { title: "Bulk Public Library Upload", closeDestination: "main-menu" });
            const root = document.createElement("div");
            root.dataset.bulkPublicUploader = "";
            const intro = document.createElement("p");
            intro.textContent = "Publish local characters and their profile images to the public library. Each character is uploaded separately. Results remain here until you reload the app.";
            const search = document.createElement("input");
            search.type = "search";
            search.placeholder = "Search character names...";
            search.setAttribute("aria-label", "Search character names only");

            const progress = document.createElement("p");
            progress.setAttribute("role", "status");
            const list = document.createElement("div");
            list.className = "character-library-grid card-size-large";
            applyCompactCharacterSelectionGridSize(list);
            const controls = document.createElement("div");
            controls.className = "row";
            const makeButton = (label, action) => {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = label;
                button.onclick = action;
                controls.append(button);
                return button;
            };
            const displayedNames = new Map();
            const visible = (row) => {
                const record = characterLibraryRecordById(row.id);
                const query = search.value.trim().toLowerCase();
                const name = displayedNames.get(row.id) || "";
                return name.toLowerCase().includes(query);
            };
            const selectAll = makeButton("Select All Shown", () => {
                for (const row of state.rows) {
                    if (visible(row) && row.status !== "Published") row.selected = true;
                }

                refresh();
            });
            const deselect = makeButton("Deselect All", () => {
                for (const row of state.rows) row.selected = false;
                refresh();
            });
            const upload = makeButton("Publish Selected", () => runBulkPublicCharacterUpload(false));
            const retry = makeButton("Retry Failed", () => runBulkPublicCharacterUpload(true));
            const stop = makeButton("Stop After Current", () => {
                state.stop = true;
                refresh();
            });
            const views = state.rows.map((row) => {
                const record = characterLibraryRecordById(row.id);
                const context = characterLibraryPresentationContext(record);
                const entity = context?.entity || characterLibraryRecordEntity(record);
                const profile = characterProfilePresentationCandidate(
                    entity,
                    characterPresentationUsesMaleFields(entity.gender),
                );
                const line = document.createElement("div");
                line.className = "character-card batch-character-image-card";
                line.dataset.bulkPublicCharacterId = row.id;
                line.setAttribute("role", "checkbox");
                line.tabIndex = 0;
                const toggle = () => {
                    if (state.running || row.status === "Published") return;
                    row.selected = !row.selected;
                    refresh();
                };
                line.onclick = toggle;
                line.onkeydown = (event) => {
                    if (event.target !== line || !["Enter", " "].includes(event.key)) return;
                    event.preventDefault();
                    toggle();
                };
                const label = document.createElement("label");
                label.className = "batch-character-image-select check-row";
                label.onclick = (event) => event.stopPropagation();
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.onchange = toggle;
                checkbox.setAttribute("aria-label", `Select ${entity.name || row.name}`);
                const name = document.createElement("div");
                name.className = "character-name";
                name.textContent = entity.name || row.name;
                displayedNames.set(row.id, name.textContent);
                const status = document.createElement("div");
                status.style.overflowWrap = "anywhere";
                label.append(checkbox, document.createTextNode(" Select"));
                line.append(name, batchCharacterImageToolImageElement(profile), label, status);
                list.append(line);
                return { row, line, checkbox, status };
            });
            const refresh = () => {
                for (const view of views) {
                    view.line.hidden = !visible(view.row);
                    view.checkbox.checked = view.row.selected;
                    view.checkbox.disabled = state.running || view.row.status === "Published";
                    view.line.classList.toggle("selected", view.row.selected);
                    view.line.setAttribute("aria-checked", String(view.row.selected));
                    view.line.setAttribute("aria-disabled", String(view.checkbox.disabled));
                    view.line.style.outline = view.row.selected ? "2px solid #2f9e5b" : "none";
                    view.line.style.outlineOffset = view.row.selected ? "-2px" : "0";
                    view.status.textContent = ` ${view.row.status}${view.row.error ? ": " + view.row.error : ""}`;
                }

                selectAll.disabled = deselect.disabled = state.running;
                upload.disabled = state.running || !state.rows.some((row) => row.selected && row.status !== "Published");
                retry.disabled = state.running || !state.rows.some((row) => row.status === "Failed");
                stop.disabled = !state.running || state.stop;
                progress.textContent = `${state.rows.filter((row) => row.selected && row.status !== "Published").length} selected; ${state.rows.filter((row) => row.status === "Published").length} published; ${state.rows.filter((row) => row.status === "Failed").length} failed. ${state.running ? state.stop ? "Stopping after the current character." : "Upload in progress." : "Ready."}`;
            };
            search.oninput = refresh;
            state.refresh = refresh;
            root.append(intro, search, controls, progress, list);
            $("modalBox").append(root);
            refresh();
        }

        async function runBulkPublicCharacterUpload(retryFailed = false) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const state = app.bulkPublicCharacterUpload;
            if (!state || state.running) return;
            const rows = state.rows.filter((row) => retryFailed
                ? row.status === "Failed"
                : row.selected && row.status !== "Published");
            if (!rows.length) return;
            state.running = true;
            state.stop = false;
            state.refresh?.();
            try {
                const publishOptions = {};
                if (!(await confirmPublicLibraryPublish("characters", `${rows.length} selected characters`, publishOptions))) return;
                for (const row of rows) {
                    if (state.stop) break;
                    if (!featuredContentPublisherAuthorized()) {
                        state.stop = true;
                        showNotice("Bulk Upload Stopped", "The official developer account and dev mode are required.");
                        break;
                    }

                    row.status = "Uploading";
                    row.error = "";
                    state.refresh?.();
                    try {
                        const record = characterLibraryRecordById(row.id);
                        if (!record) throw new Error("The local character is no longer available.");
                        if (!characterRecordHasCreatorIdentity(record))
                            throw new Error("Assign a creator to this character before publishing.");
                        const result = await publishCharacterLibraryDefinition(row.id, {
                            skipPublishConfirm: true,
                            bulkUpload: true,
                            hidePreviousVersion: publishOptions.hidePreviousVersion,
                            onPublishNotice: (title, message) => {
                                if (title !== "Upload Successful") row.error = `${title}: ${message}`;
                            },
                        });
                        if (!result?.result?.results?.[0]?.item?.id)
                            throw new Error(row.error || "Publishing did not return a Supabase item ID.");
                        row.status = "Published";
                        row.selected = false;
                    } catch (err) {
                        row.status = "Failed";
                        row.error = err.message || String(err);
                        log("Bulk character upload failed", { characterId: row.id, message: row.error }, { type: "troubleshooting", level: "error" });
                    }

                    state.refresh?.();
                }
            } finally {
                state.running = false;
                state.refresh?.();
            }
        }

        function openFeaturedContentPublisher(tab = "characters") {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const selectedTab = tab === "stories" ? "stories" : "characters";
            const draft = featuredContentPublisherDraft();
            openModal(`
                <div data-featured-content-publisher data-featured-content-tab="${selectedTab}">
                    <p class="hint">Uploads selected content and every required image directly to permanent Perchance hosting. It does not read from or write to the Supabase public library.</p>
                    <div class="tab-row">
                        <button type="button" class="${selectedTab === "characters" ? "active" : ""}" onclick="EmberAdventures.openFeaturedContentPublisher('characters')">Characters</button>
                        <button type="button" class="${selectedTab === "stories" ? "active" : ""}" onclick="EmberAdventures.openFeaturedContentPublisher('stories')">Stories</button>
                    </div>
                    <section ${selectedTab === "characters" ? "" : "hidden"}>
                        <h3>Featured Characters</h3>
                        <p class="hint">Select a featured character to manage its versions and hosted images.</p>
                        <div class="featured-content-publisher-grid">${featuredContentPublisherCharacterRowsHtml(true)}</div>
                        <div class="row" style="margin-top:.8rem">
                            <button type="button" class="warn" onclick="EmberAdventures.repairBundledFeaturedCharacterFiles(this)">Create Individual Files for Bundled Characters</button>
                        </div>
                        <h3 style="margin-top:1.2rem">Available Characters</h3>
                        <div class="featured-content-publisher-grid">${featuredContentPublisherCharacterRowsHtml(false)}</div>
                        <div class="row" style="margin-top:.8rem">
                            <button type="button" onclick="EmberAdventures.setFeaturedContentPublisherSelection('character', true)">Select All</button>
                            <button type="button" onclick="EmberAdventures.setFeaturedContentPublisherSelection('character', false)">Deselect All</button>
                            <button class="primary" type="button" onclick="EmberAdventures.publishSelectedFeaturedCharacters(this)">Upload Selected Characters</button>
                        </div>
                    </section>
                    <section ${selectedTab === "stories" ? "" : "hidden"}>
                        <div class="featured-content-publisher-grid">${featuredContentPublisherStoryRowsHtml()}</div>
                        <div class="row" style="margin-top:.8rem">
                            <button type="button" onclick="EmberAdventures.setFeaturedContentPublisherSelection('story', true)">Select All</button>
                            <button type="button" onclick="EmberAdventures.setFeaturedContentPublisherSelection('story', false)">Deselect All</button>
                            <button class="primary" type="button" onclick="EmberAdventures.publishSelectedFeaturedStories(this)">Upload Selected Stories</button>
                        </div>
                    </section>
                    <label style="margin-top:1rem">Source manifest
                        <textarea rows="12" readonly data-featured-content-manifest>${escapeHtml(featuredContentManifestSource(draft))}</textarea>
                    </label>
                    <p class="hint">After verifying the rails, put this generated source into the three manifest constants in 00-bootstrap-storage.js. Staged entries preview immediately in this browser only.</p>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" onclick="EmberAdventures.copyFeaturedContentManifest()">Copy Manifest</button>
                        <button type="button" onclick="EmberAdventures.downloadFeaturedContentManifest()">Download Manifest</button>
                        <button type="button" class="danger" onclick="EmberAdventures.clearFeaturedContentPublisherDraft()">Clear Staged Manifest</button>
                        <button type="button" onclick="EmberAdventures.openMainMenuDataToolsModal()">Back</button>
                    </div>
                </div>
            `, { title: "Featured Content Publisher", closeDestination: "main-menu" });
        }

        function replaceFeaturedManifestEntry(entries = [], nextEntry = {}, idField = "storyId") {
            return uniqueFeaturedManifestEntries([...entries, nextEntry], idField);
        }

        function selectedFeaturedPublisherIds(selector = "") {
            return [...document.querySelectorAll(`${selector}:checked`)]
                .map((input) => String(input.value || "").trim())
                .filter(Boolean);
        }

        function setFeaturedContentPublisherSelection(kind = "character", selected = true) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const selector = kind === "story"
                ? "[data-featured-publisher-story]"
                : "[data-featured-publisher-character]";
            document.querySelectorAll(selector).forEach((input) => {
                input.checked = selected === true;
                syncFeaturedContentPublisherCard(input);
            });
        }

        function syncFeaturedContentPublisherCard(input = null) {
            const wrapper = input?.closest?.("[data-featured-publisher-card]");
            const card = wrapper?.querySelector?.(".character-library-definition-card");
            const selected = input?.checked === true;
            wrapper?.classList.toggle("selected", selected);
            card?.setAttribute("aria-selected", selected ? "true" : "false");
        }

        function toggleFeaturedContentPublisherCard(kind = "character", id = "") {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const selector = kind === "story"
                ? "[data-featured-publisher-story]"
                : "[data-featured-publisher-character]";
            const input = [...document.querySelectorAll(selector)].find(
                (candidate) => String(candidate.value || "") === String(id || ""),
            );
            if (!input) return;
            input.checked = !input.checked;
            syncFeaturedContentPublisherCard(input);
        }

        async function featuredHostedCharacterRecord(characterId = "", version = null) {
            const entry = featuredCharacterManifestEntry(characterId);
            if (!entry) throw new Error("That character is not configured as Featured.");
            const selected = version || featuredCharacterVersions(entry).at(-1);
            if (!selected?.url) throw new Error("The selected Featured version has no payload URL.");
            const payload = await fetchCuratedJsonPayload({
                ...curatedCharacterManifestEntry(entry),
                url: selected.url,
                payloadSha256: selected.payloadSha256,
                payloadSizeBytes: selected.payloadSizeBytes,
            });
            const records = publicCharacterPayloadRecordsForEntry(payload, {
                ...entry,
                curated: true,
                definition_id: characterId,
            });
            const definition = records[0]?.character_definition;
            if (!definition)
                throw new Error(`Featured character ${characterId} has no character definition.`);
            return characterLibraryRecordFromDefinition(definition, {
                creator: entry.creator,
                creator_id: entry.creatorId,
            });
        }

        function featuredPublisherImagePreviewHtml(character = {}, male = false, label = "Image") {
            const slot = characterProfilePresentationCandidate(character, male);
            const stored = slot?.local_image_id
                ? profileImageByStoreId(slot.local_image_id)
                : null;
            const imageUrl = textSlot(
                slot?.url || slot?.hosted_url || stored?.hosted_url,
                "",
            );
            const html = stored?.html || slot?.html
                ? profileImageInnerHtml(stored || slot)
                : "";
            return characterLibraryCardImageHtml({
                html,
                imageUrl,
                alt: label,
            }) || `<div class="profile-image-placeholder" aria-label="${escapeHtml(label)} unavailable"></div>`;
        }

        function featuredCharacterVersionButtonsHtml(entry = {}) {
            const versions = featuredCharacterVersions(entry);
            return versions.map((version) => `
                <button type="button" class="${version.url === entry.url ? "good featured" : ""}" data-featured-character-version="${escapeHtml(version.version)}" onclick="EmberAdventures.selectFeaturedCharacterVersion(${htmlJsArg(entry.characterId)}, ${escapeHtml(version.version)})">v${escapeHtml(version.version)}</button>
            `).join("");
        }

        function openFeaturedCharacterManager(recordId = "") {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const record = characterLibraryRecordById(recordId) ||
                featuredCharacterLocalRecord(recordId);
            const entry = featuredCharacterManifestEntry(record?.id || "");
            if (!record || !entry) return;
            const versions = featuredCharacterVersions(entry);
            const selected = versions.find((version) => version.url === entry.url) || versions.at(-1);
            app.featuredCharacterManager = {
                recordId,
                selectedVersion: selected?.version || 1,
                hostedRecord: null,
            };
            document
                .querySelectorAll("[data-featured-character-manager]")
                .forEach((box) => box.closest?.(".popup-modal")?.remove());
            openCharacterLibraryLayer(`
                <div data-featured-character-manager="${escapeHtml(record.id)}">
                    <h2>${escapeHtml(record.name)}</h2>
                    <div class="featured-character-version-buttons">${featuredCharacterVersionButtonsHtml(entry)}</div>
                    <div data-featured-character-version-detail><p class="hint">Loading hosted version...</p></div>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                </div>
            `, { title: "Manage Featured Character", attr: "data-featured-character-manager-layer" });
            selectFeaturedCharacterVersion(record.id, selected?.version || 1);
        }

        async function selectFeaturedCharacterVersion(characterId = "", versionNumber = 1) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const entry = featuredCharacterManifestEntry(characterId);
            const version = featuredCharacterVersions(entry).find(
                (item) => item.version === Number(versionNumber),
            );
            const detail = document.querySelector("[data-featured-character-version-detail]");
            if (!entry || !version || !detail) return;
            detail.innerHTML = `<p class="hint">Loading version ${escapeHtml(version.version)}...</p>`;
            document.querySelectorAll("[data-featured-character-version]").forEach((button) =>
                button.classList.toggle(
                    "selected",
                    Number(button.dataset.featuredCharacterVersion) === version.version,
                ),
            );
            try {
                const hostedRecord = await featuredHostedCharacterRecord(characterId, version);
                if (!document.querySelector("[data-featured-character-version-detail]")) return;
                app.featuredCharacterManager = {
                    recordId: characterLibraryRecordId(
                        featuredCharacterLocalRecord(characterId) || hostedRecord,
                    ),
                    characterId,
                    selectedVersion: version.version,
                    hostedRecord,
                };
                const localRecord = featuredCharacterLocalRecord(characterId);
                const hostedCharacter = hostedRecord.character;
                const localCharacter = localRecord?.character || {};
                detail.innerHTML = `
                    <div class="featured-character-link-list">
                        <a href="${escapeHtml(version.url)}" target="_blank" rel="noopener">Character file</a>
                        <a href="${escapeHtml(characterProfilePresentationCandidate(hostedCharacter, true)?.url || characterProfilePresentationCandidate(hostedCharacter, true)?.hosted_url || "")}" target="_blank" rel="noopener">Male image</a>
                        <a href="${escapeHtml(characterProfilePresentationCandidate(hostedCharacter, false)?.url || characterProfilePresentationCandidate(hostedCharacter, false)?.hosted_url || "")}" target="_blank" rel="noopener">Non-male image</a>
                    </div>
                    <div class="featured-character-image-grid">
                        ${[true, false].map((male) => `
                            <section>
                                <h3>${male ? "Male" : "Non-male"} Presentation</h3>
                                <div class="featured-character-image-compare">
                                    <div><strong>Hosted</strong>${featuredPublisherImagePreviewHtml(hostedCharacter, male, "Hosted profile image")}</div>
                                    <div><strong>Active Local</strong>${featuredPublisherImagePreviewHtml(localCharacter, male, "Active local profile image")}</div>
                                </div>
                                <label class="featured-character-replace-control check-row">
                                    <input type="checkbox" data-featured-replace-image="${male ? "male" : "non_male"}">
                                    <span>Replace hosted image with active local image</span>
                                </label>
                            </section>
                        `).join("")}
                    </div>
                    <div class="row" style="margin-top:.8rem">
                        <button class="primary" type="button" onclick="EmberAdventures.updateFeaturedCharacterFromManager(this)">Publish New Version</button>
                    </div>
                `;
            } catch (err) {
                detail.innerHTML = `<p class="error-text">${escapeHtml(err.message || String(err))}</p>`;
            }
        }

        function featuredCharacterWithHostedImages(
            localRecord = {},
            hostedRecord = {},
            replacements = {},
        ) {
            const next = clone(localRecord);
            next.character.profile_image_presentations = createProfileImagePresentations(
                next.character.profile_image_presentations || {},
            );
            for (const male of [true, false]) {
                const key = male ? "male" : "non_male";
                if (replacements[key] === true) continue;
                const hosted = characterProfilePresentationCandidate(
                    hostedRecord.character,
                    male,
                );
                if (!textSlot(hosted?.url || hosted?.hosted_url, ""))
                    throw new Error(`${male ? "Male" : "Non-male"} hosted image URL is missing.`);
                next.character.profile_image_presentations[key] =
                    profileImageSlotFromExactInput({
                        ...emptyProfileImageSlot(male),
                        url: textSlot(hosted.url || hosted.hosted_url, ""),
                        local_image_id: "",
                        source: textSlot(hosted.source, "hosted profile image"),
                        seed: hosted.seed ?? null,
                        prompt: textSlot(hosted.prompt, ""),
                        negative_prompt: textSlot(
                            hosted.negative_prompt || hosted.negativePrompt,
                            "",
                        ),
                        note: textSlot(hosted.note, ""),
                        male,
                    });
            }
            const defaultKey = characterPresentationUsesMaleFields(next.character.gender)
                ? "male"
                : "non_male";
            next.character.default_profile_image = profileImageSlotFromExactInput(
                next.character.profile_image_presentations[defaultKey],
            );
            return next;
        }

        async function uploadFeaturedCharacterVersion(record = {}, options = {}) {
            const imageUploads = [];
            let upload = null;
            try {
                const prepared = options.skipImagePreparation
                    ? { records: [record] }
                    : await prepareCharacterRecordsForPublicPublish([record], {
                          uploadCollector: imageUploads,
                          pendingPublicUpload: true,
                      });
                const preparedRecord = prepared.records[0];
                await verifyPublicHostedImageManifest(
                    publicCharacterHostedImageManifest([preparedRecord]),
                    { label: preparedRecord.name },
                );
                upload = await uploadCompressedJson(
                    hostedCharacterSharePayload([
                        characterDefinitionProjectionForExport(preparedRecord),
                    ]),
                    `${preparedRecord.name} featured character`,
                    {
                        compression: "gzip",
                        pendingPublicUpload: true,
                        fileName: preparedRecord.name || preparedRecord.id,
                    },
                );
                const draft = featuredContentPublisherDraft();
                draft.featuredCharacters = replaceFeaturedManifestEntry(
                    draft.featuredCharacters,
                    nextFeaturedCharacterManifestEntry(preparedRecord, upload),
                    "characterId",
                );
                saveFeaturedContentPublisherDraft(draft);
                markHostedUploadsCommitted([upload, ...imageUploads]);
                return { record: preparedRecord, upload, imageUploads };
            } catch (err) {
                await cleanupHostedUploads(
                    [upload, ...imageUploads],
                    `${record.name || "Featured character"} upload failure`,
                );
                throw err;
            }
        }

        async function updateFeaturedCharacterFromManager(button = null) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const manager = app.featuredCharacterManager || {};
            const localRecord = featuredCharacterLocalRecord(manager.characterId) ||
                characterLibraryRecordById(manager.recordId);
            if (!localRecord || !manager.hostedRecord) return;
            const replacements = {
                male: !!document.querySelector('[data-featured-replace-image="male"]:checked'),
                non_male: !!document.querySelector('[data-featured-replace-image="non_male"]:checked'),
            };
            const imageCount = Object.values(replacements).filter(Boolean).length;
            if (!(await showConfirm(
                "Publish Featured Character Version",
                `Upload 1 character file and up to ${imageCount} replacement image file${imageCount === 1 ? "" : "s"}? Existing hosted images will otherwise be reused.`,
            ))) return;
            button?.setAttribute("disabled", "");
            try {
                const next = featuredCharacterWithHostedImages(
                    storedCharacterLibraryRecord(localRecord),
                    manager.hostedRecord,
                    replacements,
                );
                await uploadFeaturedCharacterVersion(next);
                downloadFeaturedContentManifestSnapshot();
                app.publicLibraryCuratedEntries = {};
                app.publicLibraryCuratedPayloadCache = {};
                app.publicLibraryCuratedPayloadRequests = new Map();
                openFeaturedCharacterManager(localRecord.id);
                showNotice("Featured Character Updated", `Published a new version of ${localRecord.name}.`);
            } catch (err) {
                showNotice("Featured Character Update Failed", err.message || String(err));
            } finally {
                button?.removeAttribute("disabled");
            }
        }

        async function repairBundledFeaturedCharacterFiles(button = null) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const configuredUrlCounts = PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.reduce((counts, entry) => {
                counts.set(entry.url, (counts.get(entry.url) || 0) + 1);
                return counts;
            }, new Map());
            const eligible = PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.filter((entry) => {
                const draftEntry = featuredCharacterDraftEntry(entry.characterId);
                return (configuredUrlCounts.get(entry.url) || 0) > 1 &&
                    (!draftEntry || draftEntry.url === entry.url) &&
                    !!featuredCharacterLocalRecord(entry.characterId);
            });
            if (!eligible.length) {
                showNotice("No Bundled Characters", "Every local Featured Character already has an individual character file.");
                return;
            }
            if (!(await showConfirm(
                "Create Individual Character Files",
                `Upload ${eligible.length} individual character files and 0 image files? Existing hosted image URLs will be reused.`,
            ))) return;
            button?.setAttribute("disabled", "");
            let completed = 0;
            try {
                for (const entry of eligible) {
                    setStatus(`Creating individual file ${completed + 1} of ${eligible.length}...`);
                    const localRecord = storedCharacterLibraryRecord(
                        featuredCharacterLocalRecord(entry.characterId),
                    );
                    const hostedRecord = await featuredHostedCharacterRecord(
                        entry.characterId,
                        featuredCharacterVersions(entry).find(
                            (version) => version.url === entry.url,
                        ),
                    );
                    const next = featuredCharacterWithHostedImages(
                        localRecord,
                        hostedRecord,
                        { male: false, non_male: false },
                    );
                    await uploadFeaturedCharacterVersion(next, {
                        skipImagePreparation: true,
                    });
                    completed++;
                }
                app.publicLibraryCuratedEntries = {};
                app.publicLibraryCuratedPayloadCache = {};
                app.publicLibraryCuratedPayloadRequests = new Map();
                openFeaturedContentPublisher("characters");
                showNotice("Individual Character Files Created", `Uploaded ${completed} character files and 0 image files.`);
            } catch (err) {
                showNotice("Individual Character File Upload Failed", err.message || String(err));
            } finally {
                if (completed) downloadFeaturedContentManifestSnapshot();
                button?.removeAttribute("disabled");
                setStatus("Ready");
            }
        }

        async function publishSelectedFeaturedCharacters(button = null) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const ids = selectedFeaturedPublisherIds("[data-featured-publisher-character]");
            const records = ids
                .map(characterLibraryRecordById)
                .filter(Boolean)
                .map(storedCharacterLibraryRecord);
            if (!records.length) {
                showNotice("No Characters Selected", "Select at least one local character to upload.");
                return;
            }
            const alreadyFeatured = records.filter((record) =>
                featuredCharacterManifestEntry(record.id),
            );
            if (alreadyFeatured.length) {
                showNotice(
                    "Featured Character Already Published",
                    `${alreadyFeatured.map((record) => record.name).join(", ")} must be updated from the Featured Characters section.`,
                );
                return;
            }
            const payload = hostedCharacterSharePayload(records);
            {}
            button?.setAttribute("disabled", "");
            let completed = 0;
            try {
                for (const [index, record] of records.entries()) {
                    let upload = null;
                    const imageUploads = [];
                    try {
                        setStatus(`Preparing character ${index + 1} of ${records.length}: ${record.name}`);
                        const prepared = await prepareCharacterRecordsForPublicPublish(
                            [record],
                            {
                                uploadCollector: imageUploads,
                                pendingPublicUpload: true,
                            },
                        );
                        const preparedRecord = prepared.records[0];
                        await verifyPublicHostedImageManifest(
                            publicCharacterHostedImageManifest([preparedRecord]),
                            { label: record.name },
                        );
                        const hostedPayload = hostedCharacterSharePayload([
                            characterDefinitionProjectionForExport(preparedRecord),
                        ]);
                        upload = await uploadCompressedJson(
                            hostedPayload,
                            `${record.name} featured character`,
                            {
                                compression: "gzip",
                                pendingPublicUpload: true,
                                fileName: record.name || record.id,
                            },
                        );
                        const draft = featuredContentPublisherDraft();
                        draft.featuredCharacters = replaceFeaturedManifestEntry(
                            draft.featuredCharacters,
                            nextFeaturedCharacterManifestEntry(preparedRecord, upload),
                            "characterId",
                        );
                        saveFeaturedContentPublisherDraft(draft);
                        markHostedUploadsCommitted([upload, ...imageUploads]);
                        completed++;
                    } catch (err) {
                        await cleanupHostedUploads(
                            [upload, ...imageUploads],
                            `${record.name} featured character upload failure`,
                        );
                        throw err;
                    }
                }
                app.publicLibraryCuratedEntries = {};
                app.publicLibraryCuratedPayloadCache = {};
                app.publicLibraryCuratedPayloadRequests = new Map();
                openFeaturedContentPublisher("characters");
                showNotice("Featured Characters Uploaded", `Uploaded ${completed} individual character file${completed === 1 ? "" : "s"} without Supabase.`);
            } catch (err) {
                showNotice("Featured Character Upload Failed", err.message || String(err));
            } finally {
                if (completed) downloadFeaturedContentManifestSnapshot();
                button?.removeAttribute("disabled");
                setStatus("Ready");
            }
        }

        async function publishSelectedFeaturedStories(button = null) {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const ids = selectedFeaturedPublisherIds("[data-featured-publisher-story]");
            const selections = ids.map((id) => ({
                template: storyTemplateById(id),
                group: [...document.querySelectorAll("[data-featured-publisher-story-group]")]
                    .find((select) => select.dataset.featuredPublisherStoryGroup === id)
                    ?.value === "sandbox"
                    ? "sandbox"
                    : "featured",
            })).filter((entry) => entry.template);
            if (!selections.length) {
                showNotice("No Stories Selected", "Select at least one local story to upload.");
                return;
            }
            const confirmationPayload = {
                stories: selections.map((selection) =>
                    storyExportPayloadFromDefinition(
                        storyDefinitionForExport(selection.template),
                    ),
                ),
            };
            {}
            button?.setAttribute("disabled", "");
            let completed = 0;
            try {
                for (const [index, selection] of selections.entries()) {
                    let upload = null;
                    const imageUploads = [];
                    try {
                        setStatus(`Preparing story ${index + 1} of ${selections.length}: ${selection.template.title || "Story"}`);
                        const prepared = await prepareStoryTemplateForPublicPublish(
                            selection.template,
                            { pendingPublicUpload: true },
                        );
                        imageUploads.push(...prepared.uploads);
                        await verifyPublicHostedImageManifest(
                            publicStoryHostedImageManifest(prepared.template),
                            { label: `${selection.group} story` },
                        );
                        const payload = storyExportPayloadFromDefinition(
                            storyDefinitionForExport(prepared.template),
                        );
                        upload = await uploadCompressedStoryJson(
                            payload,
                            `${selection.template.title || "Story"} curated upload`,
                            {
                                pendingPublicUpload: true,
                                fileName: selection.template.title || selection.template.id,
                            },
                        );
                        const manifestEntry = {
                            url: publicUploadFileUrl(upload.fileName),
                            storyId: prepared.template.id,
                            revision: upload.sha256.slice(0, 16),
                            payloadSha256: upload.sha256,
                            payloadSizeBytes: upload.payloadSizeBytes,
                        };
                        const draft = featuredContentPublisherDraft();
                        const field = selection.group === "sandbox"
                            ? "sandboxStories"
                            : "featuredStories";
                        draft[field] = replaceFeaturedManifestEntry(
                            draft[field],
                            manifestEntry,
                            "storyId",
                        );
                        saveFeaturedContentPublisherDraft(draft);
                        markHostedUploadsCommitted([upload, ...imageUploads]);
                        completed++;
                    } catch (err) {
                        await cleanupHostedUploads(
                            [upload, ...imageUploads],
                            `${selection.template.title || "Story"} curated upload failure`,
                        );
                        throw err;
                    }
                }
                app.publicLibraryCuratedEntries = {};
                app.publicLibraryCuratedPayloadCache = {};
                app.publicLibraryCuratedPayloadRequests = new Map();
                openFeaturedContentPublisher("stories");
                showNotice("Featured Stories Uploaded", `Uploaded ${completed} stor${completed === 1 ? "y" : "ies"} without Supabase.`);
            } catch (err) {
                showNotice("Featured Story Upload Failed", err.message || String(err));
            } finally {
                if (completed) downloadFeaturedContentManifestSnapshot();
                button?.removeAttribute("disabled");
                setStatus("Ready");
            }
        }

        async function copyFeaturedContentManifest() {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            const copied = await copyTextToClipboard(featuredContentManifestSource());
            showNotice(
                copied ? "Manifest Copied" : "Manifest Copy Failed",
                copied ? "The source-ready featured content manifest is on the clipboard." : "The browser blocked clipboard access. Use Download Manifest instead.",
            );
        }

        function downloadFeaturedContentManifest() {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            downloadTextPayload(
                featuredContentManifestSource(),
                "emberadventureslite-featured-content-manifest.js",
            );
        }

        function downloadFeaturedContentManifestSnapshot() {
            if (!featuredContentPublisherAuthorized()) return;
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            downloadTextPayload(
                featuredContentManifestSource(),
                `emberadventureslite-featured-content-manifest-${timestamp}.js`,
            );
        }

        function clearFeaturedContentPublisherDraft() {
            if (!assertFeaturedContentPublisherAuthorized()) return;
            localStorage.removeItem(FEATURED_CONTENT_PUBLISHER_DRAFT_KEY);
            app.publicLibraryCuratedEntries = {};
            app.publicLibraryCuratedPayloadCache = {};
            app.publicLibraryCuratedPayloadRequests = new Map();
            openFeaturedContentPublisher("characters");
        }

        function clearAdminInboxAvailability() {
            app.adminInboxAvailable = false;
            app.adminInboxCounts = { reports: 0, developerIssues: 0 };
            renderAdminInboxButton();
        }

        function currentPerchanceGeneratorUrl() {
            const generator = String(root.generatorName || window.generatorName || "").trim();
            if (!generator || /^(minimal|welcome)$/i.test(generator)) return "";
            return `https://perchance.org/${encodeURIComponent(generator)}`;
        }

        function supabaseRedirectUrl() {
            const preferred =
                currentPerchanceGeneratorUrl() || PUBLIC_LIBRARY_AUTH_REDIRECT_URL;
            const url = new URL(preferred || window.location.href);
            url.hash = "";
            url.searchParams.delete("access_token");
            url.searchParams.delete("refresh_token");
            url.searchParams.delete("expires_at");
            url.searchParams.delete("expires_in");
            url.searchParams.delete("token_type");
            url.searchParams.delete("type");
            url.searchParams.delete("provider_token");
            url.searchParams.delete("provider_refresh_token");
            return url.toString();
        }

        function supabaseRedirectCleanupUrl() {
            const url = new URL(window.location.href);
            url.hash = "";
            for (const key of [
                "access_token",
                "refresh_token",
                "expires_at",
                "expires_in",
                "token_type",
                "type",
                "provider_token",
                "provider_refresh_token",
            ]) {
                url.searchParams.delete(key);
            }
            return `${url.pathname}${url.search}${url.hash}`;
        }

        function publicLibraryNavigate(url) {
            try {
                if (window.top && window.top !== window) {
                    window.top.location.href = url;
                    return;
                }
            } catch {}
            try {
                window.open(url, "_blank", "noopener");
                return;
            } catch {}
            window.location.href = url;
        }

        function handleSupabaseAuthRedirect() {
            const hash = String(window.location.hash || "");
            if (!hash.includes("access_token=")) return false;
            const params = new URLSearchParams(hash.replace(/^#/, ""));
            const accessToken = params.get("access_token") || "";
            const refreshToken = params.get("refresh_token") || "";
            const providerToken = params.get("provider_token") || "";
            const providerRefreshToken = params.get("provider_refresh_token") || "";
            if (!accessToken) return false;
            const expiresAt =
                Number(params.get("expires_at")) ||
                Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600);
            saveSupabaseSession({
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: params.get("token_type") || "bearer",
                expires_at: expiresAt,
                provider_token: providerToken,
                provider_refresh_token: providerRefreshToken,
                user: app.supabaseSession?.user || null,
            });
            history.replaceState(null, document.title, supabaseRedirectCleanupUrl());
            publicLibraryRefreshCurrentUser().catch((err) =>
                log("Supabase user refresh failed after redirect", err.message || err, {
                    type: "system",
                    level: "warn",
                }),
            );
            return true;
        }

        function publicLibraryResponseError(path, method, status, detail, statusText) {
            const diagnostic = `Supabase ${method} ${path} failed (${status}): ${detail || statusText}`;
            let message = "";
            let policyRejected = false;
            try {
                const response = JSON.parse(detail);
                if (response?.code === "P0001" && typeof response.message === "string")
                    message = response.message.trim();
                policyRejected = response?.code === "P0001" && status === 400;
            } catch {
                //Non-JSON failures retain their diagnostic description.
            }
            const error = new Error(message || diagnostic);
            error.diagnostic = diagnostic;
            error.status = status;
            error.policyRejected = policyRejected;
            return error;
        }

        async function publicLibraryFetch(path, options = {}, didRetryAuthRefresh = false) {
            if (!publicLibrarySupabaseConfigured())
                throw new Error("Supabase is not configured.");
            const baseUrl = publicLibrarySupabaseUrl();
            const anonKey = publicLibrarySupabaseAnonKey();
            const cleanPath = String(path || "").startsWith("/")
                ? String(path || "")
                : `/${path || ""}`;
            const url = `${baseUrl}${cleanPath}`;
            const startedAt = performance.now();
            const headers = {
                apikey: anonKey,
                ...(options.body != null ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {}),
            };
            const token = options.auth === false ? "" : supabaseSessionAccessToken();
            headers.Authorization = `Bearer ${token || anonKey}`;
            const response = await fetch(url, {
                ...options,
                headers,
                body:
                    options.body != null && typeof options.body !== "string"
                        ? JSON.stringify(options.body)
                        : options.body,
            });
            if (!response.ok) {
                let detail = "";
                try {
                    detail = await response.text();
                } catch {}
                const canRefreshAndRetry =
                    options.auth !== false &&
                    !didRetryAuthRefresh &&
                    !cleanPath.startsWith("/auth/v1/token") &&
                    isSupabaseAuthSessionError(
                        `${response.status} ${detail || response.statusText}`,
                    );
                if (canRefreshAndRetry) {
                    const refreshedSession = await publicLibraryRefreshSessionIfNeeded({
                        force: true,
                    });
                    if (refreshedSession?.access_token) {
                        log(
                            "Supabase session refreshed after request rejection",
                            `Path: ${cleanPath}\nStatus: ${response.status}\nRetrying once with refreshed session.`,
                            { type: "system", level: "warn" },
                        );
                        return publicLibraryFetch(path, options, true);
                    }
                }
                log(
                    "Supabase request failed",
                    `Path: ${cleanPath}\nStatus: ${response.status}\nDuration: ${Math.round(performance.now() - startedAt)}ms\nAuth: ${options.auth === false ? "anonymous" : token ? "session" : "publishable key"}`,
                    { type: "system", level: "warn" },
                );
                const error = publicLibraryResponseError(
                    cleanPath, options.method || "GET", response.status, detail, response.statusText,
                );
                log("Supabase response error", error.diagnostic, { type: "system", level: "error" });
                throw error;
            }
            const text = await response.text();
            const parsed = text ? JSON.parse(text) : null;
            const rowCount = Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === "object" ? 1 : 0;
            log(
                "Supabase request",
                [
                    `Method: ${options.method || "GET"}`,
                    `Path: ${cleanPath}`,
                    `Auth: ${options.auth === false ? "anonymous" : token ? "session" : "publishable key"}`,
                    `Rows: ${rowCount}`,
                    `Approx bytes: ${publicLibraryApproxBytes(text)}`,
                    `Duration: ${Math.round(performance.now() - startedAt)}ms`,
                ].join("\n"),
                { type: "system", level: "message" },
            );
            return parsed;
        }

        async function publicLibraryExactCount(path, options = {}) {
            if (!publicLibrarySupabaseConfigured())
                throw new Error("Supabase is not configured.");
            const baseUrl = publicLibrarySupabaseUrl();
            const anonKey = publicLibrarySupabaseAnonKey();
            const cleanPath = String(path || "").startsWith("/")
                ? String(path || "")
                : `/${path || ""}`;
            const token = options.auth === false ? "" : supabaseSessionAccessToken();
            const headers = {
                apikey: anonKey,
                Authorization: `Bearer ${token || anonKey}`,
                Prefer: "count=exact",
                Range: "0-0",
                ...(options.headers || {}),
            };
            const response = await fetch(`${baseUrl}${cleanPath}`, {
                ...options,
                method: options.method || "GET",
                headers,
            });
            if (!response.ok) {
                let detail = "";
                try {
                    detail = await response.text();
                } catch {}
                throw new Error(
                    `Supabase ${options.method || "GET"} ${cleanPath} count failed (${response.status}): ${detail || response.statusText}`,
                );
            }
            const range = response.headers.get("content-range") || "";
            const match = range.match(/\/(\d+)$/);
            return match ? Number(match[1]) : 0;
        }

        async function publicLibraryTotalItemCount(type = "story") {
            const cleanType = type === "character" ? "character" : "story";
            return publicLibraryExactCount(
                `/rest/v1/library_items?select=id&${EmberSharedLibraryFormat.queryScope()}&visibility=eq.public&type=eq.${postgrestValue(cleanType)}`,
                { auth: false },
            );
        }

        async function refreshPublicLibraryTotalItemCount(type = "story", searchState = {}) {
            const cleanType = type === "character" ? "character" : "story";
            app.publicLibraryTotalItemCounts ||= {};
            try {
                const total = await publicLibraryTotalItemCount(cleanType);
                app.publicLibraryTotalItemCounts[cleanType] = total;
                searchState.total = total;
                return total;
            } catch (error) {
                log(
                    "Public library total count failed",
                    `${cleanType}: ${error?.message || String(error)}`,
                    { type: "system", level: "warn" },
                );
                const retained = app.publicLibraryTotalItemCounts[cleanType];
                if (Number.isSafeInteger(retained)) searchState.total = retained;
                return searchState.total ?? null;
            }
        }

        function libraryResultCountText(visible = 0, total = 0, singular = "result") {
            const cleanVisible = Math.max(0, Number(visible) || 0);
            const cleanTotal = Math.max(0, Number(total) || 0);
            const plural = singular.endsWith("y")
                ? `${singular.slice(0, -1)}ies`
                : `${singular}s`;
            return `${cleanVisible} ${cleanVisible === 1 ? singular : plural} of ${cleanTotal} total`;
        }

        async function publicLibraryRefreshCurrentUser() {
            if (!supabaseSessionAccessToken()) return null;
            try {
                const user = await publicLibraryFetch("/auth/v1/user");
                app.supabaseSession.user = user || null;
                saveSupabaseSession(app.supabaseSession);
                await refreshCreatorIdentitiesFromSupabase(user);
                return user;
            } catch (err) {
                if (!isSupabaseAuthSessionError(err)) throw err;
                log("Supabase session cleared", err.message || String(err), {
                    type: "system",
                    level: "warn",
                });
                saveSupabaseSession(null);
                return null;
            }
        }

        async function refreshCreatorIdentitiesFromSupabase(user = supabaseSignedInUser()) {
            if (!user?.id || !supabaseSessionAccessToken()) return [];
            const rows = await publicLibraryFetch(
                `/rest/v1/creator_identities?select=creator_id,creator_name,owner_user_id,created_at,updated_at&owner_user_id=eq.${postgrestValue(user.id)}&order=creator_name.asc`,
            );
            const registry = creatorIdentityRegistry();
            const byId = new Map(
                registry.identities.map((identity) => [identity.creator_id, identity]),
            );
            for (const row of rows || []) {
                const identity = exactCreatorIdentity(row);
                if (byId.has(identity.creator_id))
                    byId.set(identity.creator_id, identity);
            }
            registry.identities = [...byId.values()].sort((a, b) =>
                a.creator_name.localeCompare(b.creator_name),
            );
            if (
                !registry.identities.some(
                    (identity) => identity.creator_id === registry.last_used_creator_id,
                )
            )
                registry.last_used_creator_id = registry.identities[0]?.creator_id || "";
            saveCreatorIdentityRegistry("signed-in creator identities refreshed");
            refreshMineCreatorIdentityControls();
            return rows || [];
        }

        async function ensureCreatorIdentityInSupabase(creatorId = "", creatorName = "") {
            const identity = creatorIdentityById(creatorId) ||
                createCreatorIdentityRecord({
                    creator_id: creatorId,
                    creator_name: creatorName,
                });
            if (!identity) throw new Error("Select a creator before publishing.");
            let reservationError = creatorIdentityNameReservationError(
                identity.creator_name,
                supabaseSignedInUser(),
            );
            if (reservationError) throw new Error(reservationError);
            const user = await requirePublicLibraryAuth();
            reservationError = creatorIdentityNameReservationError(
                identity.creator_name,
                user,
            );
            if (reservationError) throw new Error(reservationError);
            if (identity.owner_user_id === user.id) return identity;
            const existing = await publicLibraryFetch(
                `/rest/v1/creator_identities?select=creator_id,owner_user_id&creator_id=eq.${postgrestValue(identity.creator_id)}&limit=1`,
            );
            if (existing?.[0]?.owner_user_id && existing[0].owner_user_id !== user.id)
                throw new Error("This creator identity belongs to another account.");
            const existingByName = await publicLibraryFetch(
                `/rest/v1/creator_identities?select=creator_id,creator_name,owner_user_id,created_at,updated_at&owner_user_id=eq.${postgrestValue(user.id)}&creator_name=ilike.${postgrestValue(identity.creator_name)}&limit=1`,
            );
            if (existingByName?.[0]?.creator_id) {
                const claimed = exactCreatorIdentity(existingByName[0]);
                {
                    identity.creator_id = claimed.creator_id;
                    identity.creator_name = claimed.creator_name;
                    identity.owner_user_id = user.id;
                    identity.updated_at = claimed.updated_at || new Date().toISOString();
                    saveCreatorIdentityRegistry("creator identity linked to account");
                    return claimed;
                }
            }
            const now = new Date().toISOString();
            const rows = await publicLibraryFetch("/rest/v1/creator_identities?on_conflict=creator_id", {
                method: "POST",
                headers: {
                    Prefer: "resolution=merge-duplicates,return=representation",
                },
                body: {
                    creator_id: identity.creator_id,
                    creator_name: identity.creator_name,
                    owner_user_id: user.id,
                    updated_at: now,
                },
            });
            identity.owner_user_id = user.id;
            identity.updated_at = now;
            saveCreatorIdentityRegistry("creator identity linked to account");
            return rows?.[0] || identity;
        }

        async function publicLibraryRefreshSessionIfNeeded({ force = false } = {}) {
            if (app.supabaseSessionRefreshPromise)
                return app.supabaseSessionRefreshPromise;

            const session = app.supabaseSession;
            if (!session?.refresh_token) return session || null;
            const expiresAtMs = Number(session.expires_at || 0) * 1000;
            if (!force && expiresAtMs && Date.now() < expiresAtMs - 60 * 1000) return session;

            const refreshPromise = publicLibraryFetch(
                "/auth/v1/token?grant_type=refresh_token",
                {
                    method: "POST",
                    auth: false,
                    body: { refresh_token: session.refresh_token },
                },
            ).then((refreshed) => {
                saveSupabaseSession({
                    ...session,
                    ...refreshed,
                    user: refreshed?.user || session.user || null,
                });
                return app.supabaseSession;
            }).catch((err) => {
                if (!isSupabaseAuthSessionError(err)) throw err;
                log("Supabase refresh session cleared", err.message || String(err), {
                    type: "system",
                    level: "warn",
                });
                saveSupabaseSession(null);
                return null;
            });
            app.supabaseSessionRefreshPromise = refreshPromise;
            return refreshPromise.then(
                (value) => {
                    if (app.supabaseSessionRefreshPromise === refreshPromise)
                        app.supabaseSessionRefreshPromise = null;
                    return value;
                },
                (error) => {
                    if (app.supabaseSessionRefreshPromise === refreshPromise)
                        app.supabaseSessionRefreshPromise = null;
                    throw error;
                },
            );
        }

        async function requirePublicLibraryAuth() {
            await publicLibraryRefreshSessionIfNeeded();
            if (!supabaseSessionAccessToken())
                throw new Error("Sign in before publishing or submitting public feedback.");
            if (!supabaseSignedInUser()) await publicLibraryRefreshCurrentUser();
            return supabaseSignedInUser();
        }

        async function ensurePublicLibraryPublishAuth() {
            try {
                await publicLibraryRefreshSessionIfNeeded();
                if (supabaseSessionAccessToken() && !supabaseSignedInUser()) {
                    await publicLibraryRefreshCurrentUser();
                }
            } catch (err) {
                log("Public library auth refresh failed", err.message || String(err), {
                    type: "system",
                    level: "warn",
                });
            }
            const user = supabaseSignedInUser();
            if (user && supabaseSessionAccessToken()) return user;
            openPopupModal(`
                <h2>Sign In Required</h2>
                <p class="hint">You must sign in to publish stories or characters.</p>
                ${publicLibraryAuthControlsHtml()}
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Close</button>
                </div>
            `);
            return null;
        }

        async function signInPublicLibraryWithGoogle(options = {}) {
            if (!publicLibrarySupabaseConfigured()) {
                showNotice("Supabase Not Configured", "Public library sign-in needs the Supabase URL and publishable key.");
                return;
            }
            const params = new URLSearchParams({
                provider: "google",
                redirect_to: supabaseRedirectUrl(),
            });
            if (options.driveAccess === true) params.set("scopes", GOOGLE_DRIVE_FILE_SCOPE);
            publicLibraryNavigate(`${publicLibrarySupabaseUrl()}/auth/v1/authorize?${params}`);
        }

        async function signOutPublicLibrary() {
            try {
                if (supabaseSessionAccessToken()) {
                    await publicLibraryFetch("/auth/v1/logout", {
                        method: "POST",
                    }).catch(() => null);
                }
            } finally {
                saveSupabaseSession(null);
                publicLibraryIndexStatus("Signed out.");
                refreshPublicLibraryAccountUi();
            }
        }

        function publicLibraryAuthControlsHtml() {
            const user = supabaseSignedInUser();
            if (user) {
                const label = user.email || user.user_metadata?.full_name || user.id || "signed-in user";
                return `
                    <div class="stat-card">
                        <div class="character-name">Google account connected</div>
                        <p class="hint">${escapeHtml(label)}</p>
                        <div class="row">
                            <button type="button" class="danger" onclick="EmberAdventures.signOutPublicLibrary()">Sign Out</button>
                        </div>
                    </div>
                `;
            }
            if (supabaseSessionAccessToken()) {
                return `
                    <div class="stat-card">
                        <div class="character-name">Checking Google account...</div>
                        <p class="hint">A sign-in session exists. Checking account details now.</p>
                        <div class="row">
                            <button type="button" class="danger" onclick="EmberAdventures.signOutPublicLibrary()">Sign Out</button>
                        </div>
                        <p id="publicLibraryAuthStatus" class="hint" aria-live="polite"></p>
                    </div>
                `;
            }
            return `
                <div class="stat-card">
                    <div class="character-name">Not signed in</div>
                    <p class="hint">Signing in is only required to publish characters and stories.</p>
                    <div class="row">
                        <button type="button" class="primary" onclick="EmberAdventures.signInPublicLibraryWithGoogle()">Sign in with Google</button>
                    </div>
                    <p id="publicLibraryAuthStatus" class="hint" aria-live="polite"></p>
                </div>
            `;
        }

        function refreshPublicLibraryAccountUi() {
            const user = supabaseSignedInUser();
            const avatarUrl = user ? publicAccountAvatarUrl() : "";
            for (const button of document.querySelectorAll(".library-account-button")) {
                const label = user ? "Google account signed in" : "Google account";
                button.title = label;
                button.setAttribute("aria-label", label);
                button.replaceChildren();
                if (avatarUrl) {
                    const image = document.createElement("img");
                    image.src = avatarUrl;
                    image.alt = "";
                    button.appendChild(image);
                }
                else button.textContent = "👤";
            }
            const card = $("publicLibraryAccountCard");
            if (card) card.innerHTML = publicLibraryAuthControlsHtml();
            if ($("modalBox")?.dataset.publicLibraryAccountModal === "1") {
                const title = $("publicLibraryAccountStatusTitle");
                if (title) title.textContent = supabaseSignedInUser() ? "Signed in" : "Not signed in";
            }
            if (!$("mainMenu")?.classList.contains("hidden")) renderMainMenu();
        }

        function openPublicLibraryAccountModal() {
            const libraryOpen = !!$("modalBox")?.querySelector?.("[data-library-home]");
            const html = `
                <div id="publicLibraryAccountCard">
                    ${publicLibraryAuthControlsHtml()}
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.openPublicPrivacyNotice()">Privacy</button>
                    <button type="button" onclick="${libraryOpen ? "EmberAdventures.closeContainingPopup(this)" : "EmberAdventures.closeModal()"}">Close</button>
                </div>
            `;
            let box;
            if (libraryOpen) {
                document.querySelector(".popup-modal [data-public-library-account-overlay]")?.closest?.(".popup-modal")?.remove();
                const popup = openCharacterLibraryLayer(`<div data-public-library-account-overlay>${html}</div>`, {
                    title: "Google Account",
                    attr: "data-public-library-account-overlay-box",
                });
                box = popup.box;
            } else {
                openModal(html, { title: "Google Account" });
                box = $("modalBox");
            }
            if (box) box.dataset.publicLibraryAccountModal = "1";
            if (supabaseSessionAccessToken() && !supabaseSignedInUser()) {
                refreshPublicLibraryUser().catch((err) => {
                    publicLibraryIndexStatus("Session refresh failed.");
                    log("Public account refresh failed", err.message || String(err), {
                        type: "system",
                        level: "warn",
                    });
                });
            }
        }

        function openPublicPrivacyNotice() {
            openPopupModal(`
                <h2>Public Features Privacy</h2>
                <p>Google sign-in is used for public publishing, ratings, creator ownership, and private diagnostic reports. EmberAdventures stores your Supabase account identifier, linked creator IDs, public uploads, ratings, and reports so those features work across devices.</p>
                <p>Public stories, characters, creator names, ratings, and public metadata can be seen by anyone. Your email address is not displayed on public library cards.</p>
                <p>Diagnostics are private and are sent only after explicit consent. They can contain story text, saves, profile settings, error details, and device information. Public-content reports are reviewed privately by the developer.</p>
                <p>You can sign out at any time. Contact the EmberAdventures developer through the official Discord to request account-linked public data removal.</p>
                <div class="row"><button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Close</button></div>
            `);
        }

        async function refreshPublicLibraryUser() {
            try {
                await publicLibraryRefreshSessionIfNeeded();
                await publicLibraryRefreshCurrentUser();
                publicLibraryIndexStatus("Session refreshed.");
                refreshPublicLibraryAccountUi();
            } catch (err) {
                showNotice("Session Refresh Failed", err.message || String(err));
                publicLibraryIndexStatus("Session refresh failed.");
            }
        }

        function publicLibraryEmptyIndex() {
            const now = new Date().toISOString();
            return {
                app: "EmberAdventures",
                type: "public-library-index",
                schemaVersion: 1,
                created_at: now,
                updated_at: now,
                items: [],
                story_feedback: [],
            };
        }

        const PUBLIC_LIBRARY_INDEX_FIELDS = new Set([
            "app",
            "type",
            "schemaVersion",
            "created_at",
            "updated_at",
            "items",
            "story_feedback",
        ]);
        const PUBLIC_LIBRARY_ENTRY_FIELDS = new Set([
            "id", "type", "name", "title", "description", "url", "image_url",
            "male_name", "non_male_name", "male_image_url", "non_male_image_url",
            "creator", "creator_id", "creation_tool", "source", "definition_id",
            "genres",
            "gender", "age", "species", "role", "voice_gender",
            "player_select", "player_option_count", "main_objective_count",
            "side_objective_count", "future_character_count",
            "starting_party_member_count", "starting_npc_count", "tags",
            "visibility", "updated_at", "curated", "payload_sha256",
            "payload_size_bytes", "supabase_item_id", "owner_user_id", "content_hash",
            "supabase_current_version_id", "version_number", "rating_total",
            "rating_count", "rating_average", "user_rating", "story_feedback",
        ]);
        const PUBLIC_STORY_FEEDBACK_FIELDS = new Set([
            "id", "entry_id", "type", "rating", "report_reason", "comment",
            "creator", "at",
        ]);

        function validatePublicStoryFeedback(feedback = {}, path = "story_feedback") {
            const errors = exactObjectFieldValidationErrors(
                feedback,
                PUBLIC_STORY_FEEDBACK_FIELDS,
                path,
            );
            for (const field of PUBLIC_STORY_FEEDBACK_FIELDS) {
                if (!Object.hasOwn(feedback, field))
                    errors.push(
                        validationError(
                            `${path}.${field}`,
                            "required",
                            `${field} is required.`,
                        ),
                    );
            }
            for (const field of ["id", "entry_id", "type", "report_reason", "comment", "creator", "at"])
                if (typeof feedback[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be text.`));
            if (!["rating", "report"].includes(feedback.type))
                errors.push(validationError(`${path}.type`, "value", "type is invalid."));
            if (feedback.rating !== null && (!Number.isInteger(feedback.rating) || feedback.rating < 0 || feedback.rating > 10))
                errors.push(validationError(`${path}.rating`, "type", "rating must be null or an integer from 0 through 10."));

            return validationResult(errors);
        }

        function exactPublicStoryFeedback(feedback = {}, path = "story_feedback") {
            const validation = validatePublicStoryFeedback(feedback, path);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(feedback);
        }

        function validatePublicLibraryEntry(entry = {}, path = "public_library_entry") {
            const errors = exactObjectFieldValidationErrors(
                entry,
                PUBLIC_LIBRARY_ENTRY_FIELDS,
                path,
            );
            for (const field of [
                "id", "type", "name", "url", "creator", "creation_tool", "source",
                "genres",
            ]) {
                if (!Object.hasOwn(entry, field))
                    errors.push(validationError(`${path}.${field}`, "required", `${field} is required.`));
            }
            for (const field of ["id", "type", "name", "url", "creator", "creation_tool", "source"])
                if (typeof entry[field] !== "string" || !entry[field])
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be non-empty text.`));
            if (!["story-template", "character", "player", "npc", "image"].includes(entry.type))
                errors.push(validationError(`${path}.type`, "value", "type is invalid."));
            for (const field of [])
                if (typeof entry[field] !== "boolean")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be true or false.`));
            const optionalTextFields = [
                "title", "description", "image_url", "male_name", "non_male_name",
                "male_image_url", "non_male_image_url", "creator_id", "definition_id",
                "gender", "species", "role", "voice_gender",
                "visibility", "updated_at", "payload_sha256", "supabase_item_id",
                "owner_user_id", "content_hash", "supabase_current_version_id",
            ];
            for (const field of optionalTextFields)
                if (Object.hasOwn(entry, field) && typeof entry[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be text.`));
            for (const field of ["player_select", "curated"])
                if (Object.hasOwn(entry, field) && typeof entry[field] !== "boolean")
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be true or false.`));

            for (const field of ["genres", "tags"])
                if (Object.hasOwn(entry, field) && !Array.isArray(entry[field]))
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be an array.`));
                else if (
                    Array.isArray(entry[field]) &&
                    entry[field].some((value) => typeof value !== "string")
                )
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must contain only text values.`));
            if (Object.hasOwn(entry, "age") && entry.age !== null) {
                try {
                    exactAdultAge(entry.age, `${path}.age`);
                } catch (error) {
                    errors.push(validationError(`${path}.age`, "type", error.message));
                }
            }
            for (const field of [
                "player_option_count", "main_objective_count", "side_objective_count",
                "future_character_count", "starting_party_member_count", "starting_npc_count",
                "version_number", "rating_total", "rating_count",
            ]) {
                if (
                    Object.hasOwn(entry, field) &&
                    (!Number.isSafeInteger(entry[field]) || entry[field] < 0)
                )
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be a nonnegative safe integer.`));
            }
            if (
                Object.hasOwn(entry, "payload_size_bytes") &&
                entry.payload_size_bytes !== null &&
                (!Number.isSafeInteger(entry.payload_size_bytes) || entry.payload_size_bytes < 0)
            )
                errors.push(validationError(`${path}.payload_size_bytes`, "type", "payload_size_bytes must be null or a nonnegative safe integer."));
            for (const field of ["rating_average", "user_rating"])
                if (
                    Object.hasOwn(entry, field) &&
                    entry[field] !== null &&
                    (typeof entry[field] !== "number" || !Number.isFinite(entry[field]) || entry[field] < 0 || entry[field] > 10)
                )
                    errors.push(validationError(`${path}.${field}`, "type", `${field} must be null or a finite number from 0 through 10.`));
            if (Object.hasOwn(entry, "story_feedback")) {
                if (!Array.isArray(entry.story_feedback)) {
                    errors.push(validationError(`${path}.story_feedback`, "type", "story_feedback must be an array."));
                } else {
                    entry.story_feedback.forEach((feedback, index) => {
                        errors.push(
                            ...validatePublicStoryFeedback(
                                feedback,
                                `${path}.story_feedback.${index}`,
                            ).errors,
                        );
                    });
                }
            }
            return validationResult(errors);
        }

        function exactPublicLibraryEntry(entry = {}, path = "public_library_entry") {
            const validation = validatePublicLibraryEntry(entry, path);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return clone(entry);
        }

        function exactPublicLibraryIndex(raw = {}) {
            const errors = exactObjectFieldValidationErrors(
                raw,
                PUBLIC_LIBRARY_INDEX_FIELDS,
                "public_library_index",
            );
            for (const field of PUBLIC_LIBRARY_INDEX_FIELDS) {
                if (!Object.hasOwn(raw, field))
                    errors.push(
                        validationError(
                            `public_library_index.${field}`,
                            "required",
                            `${field} is required.`,
                        ),
                    );
            }
            if (raw.app !== "EmberAdventures")
                errors.push(
                    validationError(
                        "public_library_index.app",
                        "value",
                        'app must be exactly "EmberAdventures".',
                    ),
                );
            if (raw.type !== "public-library-index")
                errors.push(
                    validationError(
                        "public_library_index.type",
                        "value",
                        'type must be exactly "public-library-index".',
                    ),
                );
            if (raw.schemaVersion !== 1)
                errors.push(
                    validationError(
                        "public_library_index.schemaVersion",
                        "value",
                        "schemaVersion must be exactly 1.",
                    ),
                );
            if (!Array.isArray(raw.items))
                errors.push(
                    validationError(
                        "public_library_index.items",
                        "type",
                        "items must be an array.",
                    ),
                );
            if (!Array.isArray(raw.story_feedback))
                errors.push(
                    validationError(
                        "public_library_index.story_feedback",
                        "type",
                        "story_feedback must be an array.",
                    ),
                );
            if (errors.length)
                throw new Error(validationErrorsText(validationResult(errors)));
            const index = clone(raw);
            index.items = raw.items.map((entry, entryIndex) =>
                exactPublicLibraryEntry(entry, `public_library_index.items.${entryIndex}`),
            );
            const validStoryIds = new Set(
                index.items
                    .filter((entry) => entry.type === "story-template")
                    .map((entry) => String(entry.id || "")),
            );
            index.story_feedback = raw.story_feedback.map((feedback, feedbackIndex) =>
                exactPublicStoryFeedback(
                    feedback,
                    `public_library_index.story_feedback.${feedbackIndex}`,
                ),
            );
            const orphanFeedback = index.story_feedback.find(
                (feedback) =>
                    validStoryIds.size && !validStoryIds.has(feedback.entry_id),
            );
            if (orphanFeedback)
                throw new Error(
                    `Public story feedback ${orphanFeedback.id} references missing entry ${orphanFeedback.entry_id}.`,
                );
            return index;
        }

        function publicLibraryRequiredText(value) {
            return textSlot(value, "");
        }

        function exactPublicLibraryAge(value, path = "public_library_entry.age") {
            if (value == null) return null;
            return exactAdultAge(value, path);
        }

        function publicStoryRatingFromInput(value) {
            if (!Number.isInteger(value) || value < 0 || value > 10) return null;
            return value;
        }

        function createPublicStoryFeedback(input = {}) {
            if (!isPlainObject(input))
                throw new Error("Public story feedback must be an object.");
            const entryId = publicLibraryRequiredText(input.entry_id);
            const cleanType = input.type;
            if (!entryId)
                throw new Error("Public story feedback entry_id is required.");
            if (!["rating", "report"].includes(cleanType))
                throw new Error(
                    "Public story feedback type must be rating or report.",
                );
            const rating = publicStoryRatingFromInput(input.rating);
            if (cleanType === "rating" && rating == null)
                throw new Error("Public story rating must be an integer from 0 through 10.");
            const reportReason = publicLibraryRequiredText(input.report_reason).slice(0, 120);
            if (cleanType === "report" && !reportReason)
                throw new Error("Public story report_reason is required for a report.");
            const comment = publicLibraryRequiredText(input.comment).slice(0, 1500);
            const at = publicLibraryRequiredText(input.at);
            const creator = publicLibraryRequiredText(input.creator).slice(0, 80);
            if (!at || !creator)
                throw new Error("Public story feedback creator and at are required.");
            const id =
                publicLibraryRequiredText(input.id) ||
                publicLibraryFeedbackId({
                    entry_id: entryId,
                    type: cleanType,
                    rating,
                    report_reason: reportReason,
                    comment,
                    creator,
                    at,
                });
            return exactPublicStoryFeedback({
                id,
                entry_id: entryId,
                type: cleanType,
                rating: cleanType === "rating" ? rating : null,
                report_reason: cleanType === "report" ? reportReason : "",
                comment,
                creator,
                at,
            });
        }

        function publicLibraryFeedbackId(feedback = {}) {
            const base = [
                feedback.entry_id,
                feedback.type,
                feedback.rating ?? "",
                feedback.report_reason || "",
                feedback.comment || "",
                feedback.creator || "",
                feedback.at || "",
            ].join("|");
            let hash = 2166136261;
            for (let i = 0; i < base.length; i++) {
                hash ^= base.charCodeAt(i);
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            }
            return `feedback-${(hash >>> 0).toString(16)}`;
        }

        function publicLibraryStoryFeedbackSummary(index = {}, entryId = "") {
            const id = String(entryId || "");
            const feedback = (index.story_feedback || []).filter(
                (item) => String(item.entry_id || "") === id,
            );
            const ratings = feedback
                .filter((item) => item.type === "rating" && item.rating != null)
                .map((item) => Number(item.rating))
                .filter(Number.isFinite);
            const reports = feedback.filter((item) => item.type === "report");
            const tagSuggestions = feedback.filter((item) => item.type === "tag_suggestion");
            const average = ratings.length
                ? ratings.reduce((total, value) => total + value, 0) / ratings.length
                : 0;
            return {
                ratingCount: ratings.length,
                ratingAverage: average,
                reportCount: reports.length,
                latestReportReason: reports.at(-1)?.report_reason || "",
                tagSuggestionCount: tagSuggestions.length,
            };
        }

        function publicLibraryStoryFeedbackText(index = {}, entryId = "") {
            const summary = publicLibraryStoryFeedbackSummary(index, entryId);
            const ratingText = summary.ratingCount
                ? `Rating: ${summary.ratingAverage.toFixed(1)}/10 from ${summary.ratingCount}`
                : "Rating: none yet";
            const reportText = summary.reportCount
                ? `Reports: ${summary.reportCount}${summary.latestReportReason ? `, latest: ${summary.latestReportReason}` : ""}`
                : "Reports: none";
            const tagText = summary.tagSuggestionCount
                ? `Tag suggestions: ${summary.tagSuggestionCount}`
                : "Tag suggestions: none";
            return `${ratingText} / ${reportText} / ${tagText}`;
        }

        function publicLibraryContentHash(entry) {
            const base = [
                entry.type,
                entry.name,
                entry.source,
                entry.creator,
                entry.creator_id,
                entry.creation_tool,
                entry.gender,
                entry.age,
                ...(Array.isArray(entry.genres) ? entry.genres : []),
                ...(Array.isArray(entry.tags) ? entry.tags : []),
                entry.url,
                entry.image_url,
                entry.male_name,
                entry.non_male_name,
                entry.male_image_url,
                entry.non_male_image_url,
            ].join("|");
            let hash = 2166136261;
            for (let i = 0; i < base.length; i++) {
                hash ^= base.charCodeAt(i);
                hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
            }
            return `fnv1a-${(hash >>> 0).toString(16)}`;
        }

        function createPublicLibraryEntry(input = {}, options = {}) {
            if (!isPlainObject(input))
                throw new Error("Public library entry must be an object.");
            const type = publicLibraryRequiredText(input.type);
            const name = publicLibraryRequiredText(input.name);
            const url = publicLibraryRequiredText(input.url);
            const source = entitySourceSlot(input.source);
            const creator = entityCreatorSlot(input.creator);
            const creatorId = textSlot(input.creator_id, "");
            const creation_tool = entityCreationToolSlot(input.creation_tool);
            const gender = publicLibraryRequiredText(input.gender);
            const age = exactPublicLibraryAge(input.age);




            const genres = approvedGenreList(input.genres || []);

            const requiresCreatorIdentity =
                !options.allowMissingCreatorIdentity &&
                (type === "story-template" || ["character", "player", "npc"].includes(type));
            if (
                !type ||
                !name ||
                !url ||
                !creator ||
                !creation_tool ||
                (requiresCreatorIdentity && !creatorId)
            )
                throw new Error(
                    "Public library entry requires type, name, url, creator, creation_tool, and creator_id for stories and characters.",
                );
            const entry = {
                id: publicLibraryRequiredText(input.id) || publicLibraryEntryId({ type, name, source, creator }),
                type,
                name,
                title: publicLibraryRequiredText(input.title || name),
                description: publicLibraryRequiredText(input.description),
                url,
                image_url: publicLibraryRequiredText(input.image_url),
                male_name: publicLibraryRequiredText(input.male_name),
                non_male_name: publicLibraryRequiredText(input.non_male_name),
                male_image_url: publicLibraryRequiredText(input.male_image_url),
                non_male_image_url: publicLibraryRequiredText(input.non_male_image_url),
                creator,
                creator_id: creatorId,
                creation_tool: creation_tool,
                source,
                definition_id: publicLibraryRequiredText(input.definition_id),
                genres,
                gender,
                age,
                species: publicLibraryRequiredText(input.species),
                role: publicLibraryRequiredText(input.role),
                voice_gender: publicLibraryRequiredText(input.voice_gender),
                player_select: input.player_select === true,
                player_option_count: Number(input.player_option_count ?? 1),
                main_objective_count: Number(input.main_objective_count ?? 0),
                side_objective_count: Number(input.side_objective_count ?? 0),
                future_character_count: Number(input.future_character_count ?? 0),
                starting_party_member_count: Number(input.starting_party_member_count ?? 0),
                starting_npc_count: Number(input.starting_npc_count ?? 0),
                tags: stringListSlot(input.tags, []),
                visibility: publicLibraryRequiredText(input.visibility) || "public",
                updated_at: publicLibraryRequiredText(input.updated_at) || new Date().toISOString(),
                curated: input.curated === true,
                payload_sha256: publicLibraryRequiredText(input.payload_sha256),
                payload_size_bytes:
                    input.payload_size_bytes == null
                        ? null
                        : Number(input.payload_size_bytes),
            };
            entry.supabase_item_id = publicLibraryRequiredText(input.supabase_item_id);
            entry.owner_user_id = publicLibraryRequiredText(input.owner_user_id);
            entry.content_hash = publicLibraryRequiredText(input.content_hash) || publicLibraryContentHash(entry);
            return exactPublicLibraryEntry(entry);
        }

        function publicLibraryEntryId(entry = {}) {
            return [
                safeUploadSlug(entry.type || "item"),
                safeUploadSlug(entry.source || "source"),
                safeUploadSlug(entry.name || "name"),
                safeUploadSlug(entry.creator || "creator"),
            ].join(":");
        }

        function publicLibrarySourceIsOriginal(source = "") {
            const clean = String(source || "").trim().toLowerCase();
            return !clean || clean === "original";
        }

        function publicLibrarySourceBlockReason(entry = {}) {
            const type = String(entry.type || "");
            if (!(type === "story-template" || ["character", "player", "npc"].includes(type)))
                return "";
            const source = publicLibraryRequiredText(entry.source);
            if (publicLibrarySourceIsOriginal(source)) return "";
            return `${entry.name || "This item"} is marked as source material (${source}). Source-based stories and characters can be used locally, but cannot be published to EmberAdventures public hosting.`;
        }

        function publicCharacterPolicyErrors(character = {}, label = "Character", allowYoungerStoryCharacter = false) {
            if (!isPlainObject(character)) return [];
            const errors = [];
            const age = Number(character.age);
            if (!allowYoungerStoryCharacter && Number.isFinite(age) && age < 18)
                errors.push(`${label} is under 18 and cannot be published.`);

            if (
                character.real_person === true ||
                character.is_real_person === true ||
                character.based_on_real_person === true
            )
                errors.push(`${label} is marked as a real person and cannot be published.`);
            return errors;
        }

        function publicStoryPolicyErrors(template = {}) {
            return storyDefinitionCharacterEntries(template).flatMap((entry) =>
                publicCharacterPolicyErrors(
                    entry.character,
                    entry.character?.name || entry.path || "Story character",
                    true,
                ),
            );
        }

        function publicLibraryPublishPolicyErrors(entry = {}) {
            const errors = [];
            for (const key of ["type", "name", "url", "creator", "creation_tool"]) {
                if (!publicLibraryRequiredText(entry[key])) errors.push(`${key} is required`);
            }
            const sourceBlock = publicLibrarySourceBlockReason(entry);
            if (sourceBlock) errors.push(sourceBlock);
            const type = String(entry.type || "");
            const requiresStoryCharacterMetadata =
                type === "story-template" || ["character", "player", "npc"].includes(type);
            if (requiresStoryCharacterMetadata) {
                if (!publicLibraryRequiredText(entry.creator_id))
                    errors.push("creator_id is required");
                if (!Array.isArray(entry.genres) || !entry.genres.length)
                    errors.push("approved genre is required");


                if (!publicLibraryRequiredText(entry.image_url))
                    errors.push("default image is required");
            }
            if (["character", "player", "npc"].includes(type)) {
                if (!publicLibraryRequiredText(entry.gender)) errors.push("gender is required");
                if (exactPublicLibraryAge(entry.age) === null) errors.push("age is required");
                if (!publicLibraryRequiredText(entry.male_name))
                    errors.push("male presentation name is required");
                if (!publicLibraryRequiredText(entry.non_male_name))
                    errors.push("female presentation name is required");
                if (!publicLibraryRequiredText(entry.male_image_url))
                    errors.push("male profile image is required");
                if (!publicLibraryRequiredText(entry.non_male_image_url))
                    errors.push("female profile image is required");
            }
            return errors;
        }

        function publicLibraryCharacterMetadata(record = {}, url = "") {
            const validation = validateCharacterLibraryRecord(record);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            const character = record.character;
            const name = record.name;
            const presentationNames = characterPresentationNames(character);
            const defaultImage = profileImageSlotFromExactInput(character.default_profile_image);
            const localDefault = defaultImage.local_image_id
                ? profileImageByStoreId(defaultImage.local_image_id)
                : null;
            const pendingLocalDefault =
                url === "pending" &&
                localDefault &&
                (localDefault.hosted_url || profileImageRealHtml(localDefault.html || ""));
            const presentationImageUrl = (male) => {
                const image = characterProfilePresentationCandidate(character, male);
                const imageUrl = textSlot(image?.url || image?.hosted_url, "");
                if (imageUrl) return imageUrl;
                return url === "pending" && image ? "pending" : "";
            };
            return createPublicLibraryEntry({
                type: "character",
                definition_id: record.id,
                name,
                url,
                image_url:
                    defaultImage.url ||
                    localDefault?.hosted_url ||
                    (pendingLocalDefault ? "pending" : "") ||
                    presentationImageUrl(
                        characterPresentationUsesMaleFields(character.gender),
                    ) ||
                    "",
                male_name: presentationNames.male,
                non_male_name: presentationNames.non_male,
                male_image_url: presentationImageUrl(true),
                non_male_image_url: presentationImageUrl(false),
                creator: record.creator,
                creator_id: record.creator_id,
                creation_tool: character.creation_tool,
                source: character.source,
                gender: character.gender,
                age: character.age,
                species: character.appearance.species,
                role: character.role,
                voice_gender: character.gender,
                genres: character.genres,
                tags: [character.role, character.appearance.species].filter(Boolean),
            });
        }

        function publicLibraryStoryMetadata(
            template = {},
            url = "",
            creatorIdentity = selectedCreatorIdentity(),
        ) {
            const record = storyDefinitionForExport(template);
            const extra = publicLibraryStoryExtraMetadata(record);
            return createPublicLibraryEntry({
                type: "story-template",
                definition_id: record.id,
                name: record.title,
                description: extra.description,
                url,
                creator: creatorIdentity?.creator_name || "",
                creator_id: creatorIdentity?.creator_id || "",
                creation_tool: record.creation_tool,
                source: record.source,
                gender: "mixed",
                age: 18,
                image_url: record.title_card_image?.url || "",
                genres: record.genres,
                ...extra,
                tags: [],
            });
        }

        function publicLibraryImageMetadata(image = {}, url = "") {
            return createPublicLibraryEntry({
                type: "image",
                name: image.owner_name || image.reason || `Image ${image.id || ""}`.trim(),
                url: url || image.hosted_url || image.url || "",
                image_url: url || image.hosted_url || image.url || "",
                creator: image.creator || selectedCreatorIdentity()?.creator_name || "",
                creation_tool: image.creation_tool || image.model || "Perchance Image",
                source: image.source || "generated",
                gender: image.gender || "",
                age: image.age ?? null,
                tags: [image.model, image.reason].filter(Boolean),
            });
        }

        function publicLibraryItemTypeForDb(entry = {}) {
            const type = String(entry.type || "").trim();
            if (type === "story" || type === "story-template") return "story";
            if (["character", "player", "npc"].includes(type)) return "character";
            return "";
        }

        function publicLibraryItemNameForDb(entry = {}) {
            return publicLibraryRequiredText(entry.name);
        }

        function publicLibraryVoiceGenderForDb(entry = {}) {
            const value = String(entry.voice_gender || entry.gender || "")
                .trim()
                .toLowerCase();
            return value === "male" ? "male" : value ? "non_male" : null;
        }

        function publicLibraryItemPayloadForDb(entry = {}) {
            const type = publicLibraryItemTypeForDb(entry);
            const name = publicLibraryItemNameForDb(entry);
            const row = {
                type,
                definition_id: publicLibraryRequiredText(entry.definition_id) || safeUploadSlug(name),
                slug: publicLibraryEntryId({
                    type,
                    name,
                    source: entry.source,
                    creator: entry.creator,
                }),
                creator: entry.creator,
                creator_id: entry.creator_id,
                // Authored definitions use "Original". The public database
                // represents original-only rows with an empty source.
                source: publicLibrarySourceIsOriginal(entry.source) ? "" : entry.source,
                creation_tool: entry.creation_tool,
                genres: approvedGenreList(entry.genres || []),
                ...EmberSharedLibraryFormat.publicationScope(),
                visibility: "public",
            };
            if (type === "story") {
                row.title = name;
                row.description = publicLibraryRequiredText(entry.description) || name;
                row.player_select = !!entry.player_select;
                row.player_option_count = Math.max(1, Number(entry.player_option_count || 1));
                row.main_objective_count = Math.max(0, Number(entry.main_objective_count || 0));
                row.side_objective_count = Math.max(0, Number(entry.side_objective_count || 0));
                row.future_character_count = Math.max(0, Number(entry.future_character_count || 0));
                row.starting_party_member_count = Math.max(
                    0,
                    Number(entry.starting_party_member_count ?? 0),
                );
                row.starting_npc_count = Math.max(0, Number(entry.starting_npc_count || 0));
            } else if (type === "character") {
                row.name = name;
                row.male_name = publicLibraryRequiredText(entry.male_name);
                row.non_male_name = publicLibraryRequiredText(entry.non_male_name);
                row.male_image_url = publicLibraryRequiredText(entry.male_image_url);
                row.non_male_image_url = publicLibraryRequiredText(entry.non_male_image_url);
                row.gender = publicLibraryRequiredText(entry.gender);
                row.fallback_gender = null;
                row.age = exactPublicLibraryAge(entry.age);
                row.species = publicLibraryRequiredText(entry.species);
                row.role = publicLibraryRequiredText(entry.role);
                row.voice_gender = publicLibraryVoiceGenderForDb(entry);
            }
            return row;
        }

        function publicLibraryVersionMetadataSnapshot(item = {}) {
            const validated = validateSupabasePublicItemRow(
                item,
                "public_version_metadata_source",
            );
            const snapshot = {};
            for (const field of SUPABASE_PUBLIC_VERSION_METADATA_FIELDS)
                snapshot[field] = clone(validated[field]);
            return validateSupabasePublicVersionMetadataSnapshot(snapshot);
        }

        function publicLibraryEntryFromSupabaseSearchRow(raw = {}) {
            const item = EmberSharedLibraryFormat.metadataToLite(validateSupabasePublicSearchRow(raw));
            const type = item.type === "story" ? "story-template" : "character";
            const name = item.type === "story" ? item.title : item.name;
            const source = item.source === "" ? "Original" : item.source;
            return exactPublicLibraryEntry({
                id: item.id,
                type,
                name,
                title: name,
                description: item.description || "",
                url: item.payload_url,
                image_url: item.image_url || "",
                male_name: item.male_name || "",
                non_male_name: item.non_male_name || "",
                male_image_url: item.male_image_url || "",
                non_male_image_url: item.non_male_image_url || "",
                creator: item.creator,
                creator_id: item.creator_id,
                creation_tool: item.creation_tool,
                source,
                definition_id: item.definition_id,




                genres: [...item.genres],
                gender: item.gender || (item.type === "story" ? "mixed" : ""),
                age: item.age,
                species: item.species || "",
                role: item.role || "",
                voice_gender: item.voice_gender || "",
                player_select: item.player_select,
                player_option_count: item.player_option_count,
                main_objective_count: item.main_objective_count,
                side_objective_count: item.side_objective_count,
                future_character_count: item.future_character_count,
                starting_party_member_count: item.starting_party_member_count,
                starting_npc_count: item.starting_npc_count,
                tags: [],
                visibility: "public",
                updated_at: item.updated_at,
                curated: false,
                payload_sha256: item.payload_sha256 || "",
                payload_size_bytes: item.payload_size_bytes,
                supabase_item_id: item.id,
                owner_user_id: "",
                content_hash: publicLibraryContentHash({
                    type,
                    name,
                    source,
                    creator: item.creator,
                    creator_id: item.creator_id,
                    creation_tool: item.creation_tool,
                    gender: item.gender || "",
                    age: item.age,

                    genres: item.genres,
                    tags: [],
                    url: item.payload_url,
                    image_url: item.image_url || "",
                    male_name: item.male_name || "",
                    non_male_name: item.non_male_name || "",
                    male_image_url: item.male_image_url || "",
                    non_male_image_url: item.non_male_image_url || "",
                }),
                supabase_current_version_id: item.current_version_id || "",
                version_number: 0,
                rating_total: item.rating_total,
                rating_count: item.rating_count,
                rating_average: item.rating_average,
                user_rating: item.user_rating,
                story_feedback: [],
            });
        }

        function publicLibraryEntryFromSupabaseItem(rawItem = {}, rawVersion = null) {
            const item = EmberSharedLibraryFormat.metadataToLite(validateSupabasePublicItemRow(rawItem));
            const version = rawVersion == null
                ? null
                : validateSupabasePublicVersionRow(rawVersion);
            if (!version && (item.current_version_id !== null || item.visibility !== "hidden"))
                throw new Error(
                    "A Supabase item without a current version must be hidden.",
                );
            if (version && version.item_id !== item.id)
                throw new Error(
                    `public_version_row.item_id must exactly match public_item_row.id (${item.id}).`,
                );
            if (version && version.id !== item.current_version_id)
                throw new Error(
                    "public_version_row.id must exactly match public_item_row.current_version_id.",
                );
            const type = item.type === "story" ? "story-template" : "character";
            const name = item.type === "story" ? item.title : item.name;
            const source = item.source === "" ? "Original" : item.source;
            const payloadUrl = version?.payload_url || `supabase://hidden-library-item/${item.id}`;
            const imageUrl =
                version?.image_url ||
                item.non_male_image_url ||
                item.male_image_url ||
                "";
            return exactPublicLibraryEntry({
                id: item.id,
                type,
                name,
                title: name,
                description: item.description ?? "",
                url: payloadUrl,
                image_url: imageUrl,
                male_name: item.male_name ?? "",
                non_male_name: item.non_male_name ?? "",
                male_image_url: item.male_image_url ?? "",
                non_male_image_url: item.non_male_image_url ?? "",
                creator: item.creator,
                creator_id: item.creator_id,
                creation_tool: item.creation_tool,
                source,
                definition_id: item.definition_id,




                genres: [...item.genres],
                gender: item.gender ?? (item.type === "story" ? "mixed" : ""),
                age: item.age,
                species: item.species ?? "",
                role: item.role ?? "",
                voice_gender: item.voice_gender ?? "",
                player_select: item.player_select,
                player_option_count: item.player_option_count,
                main_objective_count: item.main_objective_count,
                side_objective_count: item.side_objective_count,
                future_character_count: item.future_character_count,
                starting_party_member_count: item.starting_party_member_count,
                starting_npc_count: item.starting_npc_count,
                tags: [],
                visibility: item.visibility,
                updated_at: item.updated_at,
                curated: false,
                payload_sha256: version?.payload_sha256 ?? "",
                payload_size_bytes: version?.payload_size_bytes ?? null,
                supabase_item_id: item.id,
                owner_user_id: item.owner_user_id,
                content_hash: publicLibraryContentHash({
                    type,
                    name,
                    source,
                    creator: item.creator,
                    creator_id: item.creator_id,
                    creation_tool: item.creation_tool,
                    gender: item.gender ?? "",
                    age: item.age,

                    genres: item.genres,
                    tags: [],
                    url: payloadUrl,
                    image_url: imageUrl,
                    male_name: item.male_name ?? "",
                    non_male_name: item.non_male_name ?? "",
                    male_image_url: item.male_image_url ?? "",
                    non_male_image_url: item.non_male_image_url ?? "",
                }),
                supabase_current_version_id: item.current_version_id || "",
                version_number: version?.version_number ?? 0,
                rating_total: 0,
                rating_count: item.rating_count,
                rating_average: item.rating_average,
                user_rating: null,
                story_feedback: [],
            });
        }

        function ownedPublicLibraryEntryFromVersionPreview(
            rawItem = {},
            rawVersion = null,
            presentationImages = {},
        ) {
            if (!rawVersion) return publicLibraryEntryFromSupabaseItem(rawItem, null);
            const previewItem = clone(rawItem);
            previewItem.current_version_id = rawVersion.id;
            const entry = publicLibraryEntryFromSupabaseItem(previewItem, rawVersion);
            if (rawItem.current_version_id) return entry;
            entry.visibility = "hidden";
            entry.supabase_current_version_id = "";
            entry.image_url = rawVersion.image_url || entry.image_url;
            entry.male_image_url =
                presentationImages.maleImageUrl ||
                rawItem.male_image_url ||
                rawVersion.image_url ||
                "";
            entry.non_male_image_url =
                presentationImages.nonMaleImageUrl ||
                rawItem.non_male_image_url ||
                rawVersion.image_url ||
                "";
            return entry;
        }

        function publicLibraryFeedbackRowsForIndex(feedbackByItemId = new Map()) {
            return [...feedbackByItemId.entries()].flatMap(([itemId, rows]) =>
                (rows || [])
                    .map((raw) =>
                        createPublicStoryFeedback({
                            id: raw.id,
                            entry_id: itemId,
                            type: raw.kind,
                            rating: raw.rating,
                            report_reason: raw.report_reason,
                            comment: raw.comment,
                            creator: raw.user_id || "user",
                            at: raw.created_at,
                        }),
                    ),
            );
        }

        function publicLibraryStoryExtraMetadata(template = {}) {
            const record = storyDefinitionForExport(template);
            const objectives = Array.isArray(record.state?.objectives?.items)
                ? record.state.objectives.items
                : [];
            const mainObjectives = objectives.filter((item) => !objectiveIsSide(item));
            const sideObjectives = objectives.filter(objectiveIsSide);
            const playerOptions = storyTemplatePlayerOptions(record.state);
            const futureItems = isPlainObject(record.state?.future_cast?.items)
                ? record.state.future_cast.items
                : {};
            const npcLocations = isPlainObject(record.state?.npc_directory?.locations)
                ? record.state.npc_directory.locations
                : {};
            const startingNpcCount = Object.values(npcLocations).reduce((total, location) => {
                const characters = isPlainObject(location?.characters)
                    ? Object.keys(location.characters).length
                    : 0;
                const npcs = isPlainObject(location?.npcs) ? Object.keys(location.npcs).length : 0;
                return total + Math.max(characters, npcs);
            }, 0);
            return {
                description: record.description || record.summary || record.title || "EmberAdventures story template",
                player_select: playerOptions.length > 1,
                player_option_count: Math.max(1, playerOptions.length || 1),
                main_objective_count: mainObjectives.length,
                side_objective_count: sideObjectives.length,
                future_character_count: Array.isArray(record.future_characters)
                    ? record.future_characters.length
                    : Array.isArray(record.state?.future_cast?.characters)
                      ? record.state.future_cast.characters.length
                      : Object.keys(futureItems).length,
                starting_party_member_count: Object.keys(record.state?.characters || {}).length,
                starting_npc_count: startingNpcCount,
            };
        }

        function mergePublicLibraryIndexItems(index = {}, entries = [], options = {}) {
            const next = exactPublicLibraryIndex(index);
            const byId = new Map(next.items.map((item) => [item.id, item]));
            for (const [entryIndex, raw] of entries.entries()) {
                const entry = exactPublicLibraryEntry(
                    raw,
                    `public_library_entries.${entryIndex}`,
                );
                byId.set(entry.id, entry);
            }
            next.items = [...byId.values()].sort((a, b) =>
                `${a.type}:${a.source}:${a.name}`.localeCompare(`${b.type}:${b.source}:${b.name}`),
            );
            next.updated_at = new Date().toISOString();
            return next;
        }

        function publicLibraryStoryRowsHtml(index = {}) {
            const mode = app.publicLibraryViewMode || "stories";
            const entries = (index.items || []).filter((entry) =>
                mode === "characters" ? entry.type === "character" : entry.type === "story-template",
            );
            if (!entries.length)
                return `<p class="hint">No public ${mode === "characters" ? "characters" : "stories"} found.</p>`;
            const tokens = searchTokens(publicLibraryQueryState().submittedSearch || "");
            return entries
                .filter((entry) => {
                    const summary = publicLibraryStoryFeedbackSummary(index, entry.id);
                    const searchText = [
                        entry.name,
                        entry.source,
                        entry.creator,
                        ...(entry.genres || []),
                        ...(entry.tags || []),
                    ].join(" ");
                    return matchesSearchTokens(searchText, tokens);
                })
                .map((entry) => {
                    const feedbackSummary = publicLibraryStoryFeedbackSummary(index, entry.id);
                    const summary = publicLibraryStoryFeedbackText(index, entry.id);
                    const genreText = (entry.genres || []).join(", ") || "No genre";
                    return `
                        <div class="stat-card">
                            <div class="character-name">${escapeHtml(entry.name || "Untitled")} </div>
                            ${entry.description ? `<p class="hint">${escapeHtml(entry.description)}</p>` : ""}
                            ${entry.type === "story-template" ? `<div class="hint">${escapeHtml(summary)}</div>` : ""}
                            <div class="hint">Creator: ${escapeHtml(entry.creator || "unknown")} / Genres: ${escapeHtml(genreText)}</div>
                            ${entry.type === "character" ? `<div class="hint">Gender: ${escapeHtml(entry.gender || "unknown")} / Age: ${escapeHtml(entry.age || "unknown")} / Role: ${escapeHtml(entry.role || "unknown")}</div>` : ""}
                            ${""}
                            <div class="row" style="margin-top:.55rem">
                                <button type="button" class="primary" onclick="EmberAdventures.importPublicLibraryEntry(${htmlJsArg(entry.id)})">Download</button>
                                <button type="button" onclick="EmberAdventures.openPublicLibraryVersionHistoryModal(${htmlJsArg(entry.id)})">Versions</button>
                                ${entry.type === "story-template" ? `<button type="button" class="good" onclick="EmberAdventures.openRatePublicStoryModal(${htmlJsArg(entry.id)})">Rate Story</button>` : ""}
                            </div>
                        </div>
                    `;
                })
                .join("") || `<p class="hint">No public ${mode === "characters" ? "characters" : "stories"} match that search.</p>`;
        }

        function renderPublicLibraryStoryList(index = app.publicLibraryLastIndex || null) {
            const target = $("publicLibraryStoryList");
            if (!target) return;
            target.innerHTML = index
                ? publicLibraryStoryRowsHtml(index)
                : `<p class="hint">Press Search to view public library results.</p>`;
        }

        function publicLibraryOwnedRowsHtml(index = {}) {
            const entries = Array.isArray(index.items) ? index.items : [];
            if (!entries.length) return `<p class="hint">No public uploads for this account yet.</p>`;
            return entries
                .map((entry) => {
                    const isHidden = String(entry.visibility || "public") === "hidden";
                    const versionText = entry.version_number ? `Version ${entry.version_number}` : "No version";
                    const sourceText =
                        entry.type === "story-template"
                            ? storySourceDisplayLabel(entry.source)
                            : entry.source || "unknown";
                    return `
                        <div class="stat-card">
                            <div class="character-name">${escapeHtml(entry.name || "Untitled")} <span class="profile-select-status">${escapeHtml(entry.type === "character" ? "Character" : "Story")}</span></div>
                            ${entry.description ? `<p class="hint">${escapeHtml(entry.description)}</p>` : ""}
                            <div class="hint">Visibility: ${escapeHtml(entry.visibility || "public")} / ${escapeHtml(versionText)}</div>
                            <div class="hint">Source: ${escapeHtml(sourceText)} / Creator: ${escapeHtml(entry.creator || "unknown")}</div>
                            <div class="row" style="margin-top:.55rem">
                                <button type="button" class="primary" onclick="EmberAdventures.importPublicLibraryEntry(${htmlJsArg(entry.id)})">Download</button>
                                <button type="button" onclick="EmberAdventures.openPublicLibraryVersionHistoryModal(${htmlJsArg(entry.id)})">Versions</button>
                                <button type="button" class="${isHidden ? "good" : "warn"}" onclick="EmberAdventures.setOwnedPublicLibraryItemVisibility(${htmlJsArg(entry.id)}, ${htmlJsArg(isHidden ? "public" : "hidden")})">${isHidden ? "Make Public" : "Hide / Unpublish"}</button>
                            </div>
                        </div>
                    `;
                })
                .join("");
        }

        function renderOwnedPublicLibraryUploads(index = app.publicLibraryOwnedIndex || null) {
            const target = $("publicLibraryOwnedList");
            if (!target) return;
            target.innerHTML = index
                ? publicLibraryOwnedRowsHtml(index)
                : `<p class="hint">Sign in, then refresh to see your public uploads.</p>`;
        }

        function postgrestValue(value) {
            return encodeURIComponent(String(value ?? "").replaceAll('"', '\\"'));
        }

        function postgrestInList(values = []) {
            return values.map((value) => `"${String(value ?? "").replaceAll('"', '\\"')}"`).join(",");
        }

        function postgrestTagSet(value = "", options = {}) {
            const tags = options.genres
                ? approvedGenreList([value])
                : publicTagListSlot([value]);
            return tags.map(postgrestValue).join(",");
        }

        function publicLibraryPostgrestFilters(filters = {}) {
            const clean = publicLibraryCleanFilters(filters);
            const parts = [EmberSharedLibraryFormat.queryScope()];
            if (clean.genre) parts.push(`genres=cs.{${postgrestTagSet(clean.genre, { genres: true })}}`);
            if (clean.source) parts.push(`source=ilike.*${postgrestValue(clean.source)}*`);
            if (clean.creator) parts.push(`creator=ilike.*${postgrestValue(clean.creator)}*`);



            if (clean.gender) parts.push(`gender=ilike.*${postgrestValue(clean.gender)}*`);
            const ageMin = Number(clean.ageMin);
            const ageMax = Number(clean.ageMax);
            if (Number.isFinite(ageMin) && ageMin > 0) parts.push(`age=gte.${Math.floor(ageMin)}`);
            if (Number.isFinite(ageMax) && ageMax > 0) parts.push(`age=lte.${Math.floor(ageMax)}`);
            return parts.length ? `&${parts.join("&")}` : "";
        }

        async function fetchPublicLibraryIndex(options = {}) {
            const query = publicLibraryQueryState();
            const limit = Math.min(50, Math.max(1, Number(options.limit || options.pageSize || query.pageSize || 25)));
            const page = Math.max(0, Number(options.page ?? query.page ?? 0));
            const start = page * limit;
            const end = start + limit - 1;
            const mode = options.mode || app.publicLibraryViewMode || "stories";
            const typeFilter =
                mode === "characters" ? "&type=eq.character" : mode === "all" ? "" : "&type=eq.story";
            const search = String(options.search ?? query.submittedSearch ?? "").trim();
            const searchFilter = search
                ? `&or=(title.ilike.*${postgrestValue(search)}*,name.ilike.*${postgrestValue(search)}*,creator.ilike.*${postgrestValue(search)}*,source.ilike.*${postgrestValue(search)}*)`
                : "";
            const filterParams = publicLibraryPostgrestFilters(options.filters || query.submittedFilters || {});
            const items =
                (await publicLibraryFetch(
                    `/rest/v1/library_items?select=${SUPABASE_PUBLIC_ITEM_ROW_FIELDS.join(",")}&visibility=eq.public${typeFilter}${searchFilter}${filterParams}&order=updated_at.desc&limit=${limit}&offset=${start}`,
                    { auth: false },
                )) || [];
            const currentVersionIds = items
                .map((item) => item.current_version_id)
                .filter(Boolean);
            const versions = currentVersionIds.length
                ? await publicLibraryFetch(
                      `/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&visible=eq.true&id=in.(${postgrestInList(currentVersionIds)})`,
                      { auth: false },
                  )
                : [];
            const versionById = new Map((versions || []).map((version) => [version.id, version]));
            const index = publicLibraryEmptyIndex();
            index.items = items
                .filter((item) => versionById.has(item.current_version_id))
                .map((item) =>
                    publicLibraryEntryFromSupabaseItem(
                        item,
                        versionById.get(item.current_version_id) || null,
                        [],
                    ),
                )
                .filter((entry) => entry && publicLibraryRequiredText(entry.image_url));
            index.story_feedback = [];
            return index;
        }

        async function fetchOwnedPublicLibraryHiddenPreviewVersions(itemIds = []) {
            if (!itemIds.length) return [];
            try {
                const rows = await publicLibraryFetch("/rest/v1/rpc/owned_library_hidden_previews", {
                    method: "POST",
                    body: { target_item_ids: itemIds },
                });
                return (rows || []).map((raw, index) => {
                    const version = clone(raw);
                    delete version.male_image_url;
                    delete version.non_male_image_url;
                    return {
                        version: validateSupabasePublicVersionRow(
                            version,
                            `owned_hidden_preview_versions.${index}`,
                        ),
                        maleImageUrl: publicLibraryRequiredText(raw.male_image_url),
                        nonMaleImageUrl: publicLibraryRequiredText(raw.non_male_image_url),
                    };
                });
            } catch (error) {
                if (!/PGRST202|owned_library_hidden_previews|could not find the function|schema cache/i.test(
                    String(error?.message || error),
                )) throw error;
                log(
                    "Owned hidden preview batch RPC unavailable",
                    "Using the compatible per-item version-state fallback.",
                    { type: "system", level: "warn" },
                );
                const states = await Promise.all(
                    itemIds.map(async (itemId) =>
                        exactOwnedPublicLibraryVersionState(
                            await publicLibraryFetch(
                                "/rest/v1/rpc/owned_library_version_state",
                                {
                                    method: "POST",
                                    body: { target_item_id: itemId },
                                },
                            ),
                        ),
                    ),
                );
                return states.flatMap((state) => {
                    const latest = [...state.versions].sort(
                        (left, right) =>
                            Number(right.version_number || 0) -
                            Number(left.version_number || 0),
                    )[0];
                    if (!latest) return [];
                    const version = clone(latest);
                    delete version.visible;
                    return [{
                        version,
                        maleImageUrl: publicLibraryRequiredText(
                            state.item?.male_image_url,
                        ),
                        nonMaleImageUrl: publicLibraryRequiredText(
                            state.item?.non_male_image_url,
                        ),
                    }];
                });
            }
        }

        async function fetchOwnedPublicLibraryIndex(options = {}) {
            const user = await requirePublicLibraryAuth();
            const limit = Math.min(50, Math.max(1, Number(options.limit || options.pageSize || 25)));
            const page = Math.max(0, Number(options.page || 0));
            const mode = options.mode || "all";
            const typeFilter =
                mode === "characters" ? "&type=eq.character" : mode === "stories" ? "&type=eq.story" : "";
            const items =
                (await publicLibraryFetch(
                    `/rest/v1/library_items?select=${SUPABASE_PUBLIC_ITEM_ROW_FIELDS.join(",")}&${EmberSharedLibraryFormat.queryScope()}&owner_user_id=eq.${postgrestValue(user.id)}${typeFilter}&order=updated_at.desc&limit=${limit}&offset=${page * limit}`,
                )) || [];
            const currentVersionIds = items.map((item) => item.current_version_id).filter(Boolean);
            const hiddenItemIds = items
                .filter((item) => !item.current_version_id)
                .map((item) => item.id);
            const [versions, hiddenPreviewVersions] = await Promise.all([
                currentVersionIds.length
                    ? publicLibraryFetch(
                          `/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&id=in.(${postgrestInList(currentVersionIds)})`,
                      )
                    : [],
                hiddenItemIds.length
                    ? fetchOwnedPublicLibraryHiddenPreviewVersions(hiddenItemIds)
                    : [],
            ]);
            const versionById = new Map((versions || []).map((version) => [version.id, version]));
            const hiddenPreviewByItemId = new Map(
                (hiddenPreviewVersions || []).map((preview) => [
                    preview.version.item_id,
                    preview,
                ]),
            );
            const index = publicLibraryEmptyIndex();
            index.items = items
                .map((item) => {
                    const hiddenPreview = hiddenPreviewByItemId.get(item.id) || null;
                    return ownedPublicLibraryEntryFromVersionPreview(
                        item,
                        versionById.get(item.current_version_id) ||
                            hiddenPreview?.version ||
                            null,
                        hiddenPreview || {},
                    );
                })
                .filter(Boolean);
            return index;
        }

        async function replacePublicLibraryIndex(index) {
            // Public library storage now lives in Supabase. This function remains
            // only for old mocked smokes and compatibility with index-shaped data.
            app.publicLibraryLastIndex = exactPublicLibraryIndex(index);
            return { url: "supabase://library_items", index: app.publicLibraryLastIndex };
        }

        async function findOwnedPublicLibraryItem(entry = {}) {
            const user = await requirePublicLibraryAuth();
            const dbType = publicLibraryItemTypeForDb(entry);
            const definitionId = publicLibraryRequiredText(entry.definition_id) || safeUploadSlug(publicLibraryItemNameForDb(entry));
            const rows =
                (await publicLibraryFetch(
                    `/rest/v1/library_items?select=${SUPABASE_PUBLIC_ITEM_ROW_FIELDS.join(",")}&owner_user_id=eq.${postgrestValue(user.id)}&type=eq.${postgrestValue(dbType)}&creator_id=eq.${postgrestValue(entry.creator_id)}&definition_id=eq.${postgrestValue(definitionId)}&limit=1`,
                )) || [];
            return rows.length
                ? validateSupabasePublicItemRow(rows[0], "owned_public_item")
                : null;
        }

        function publicLibraryCapMessage() {
            return "You have reached the publishing cap. Contact the EmberAdventures Discord to request an increase. This limit exists to prevent malicious uploading, and increases are usually approved.";
        }

        async function publicLibraryUploaderPolicy(user = null) {
            if (!user?.id) return { story_cap: 100, character_cap: 1000, banned: false };
            const rows =
                (await publicLibraryFetch(
                    `/rest/v1/library_uploader_limits?select=${SUPABASE_PUBLIC_UPLOADER_POLICY_ROW_FIELDS.join(",")}&user_id=eq.${postgrestValue(user.id)}&limit=1`,
                )) || [];
            if (!rows.length)
                return { story_cap: 100, character_cap: 1000, banned: false, ban_reason: null };
            return validateSupabasePublicUploaderPolicyRow(
                rows[0],
                "public_uploader_policy",
            );
        }

        async function publicLibraryOwnedItemCount(user = null, dbType = "story") {
            if (!user?.id) return 0;
            const capProbeLimit = dbType === "character" ? 1001 : 101;
            const rows =
                (await publicLibraryFetch(
                    `/rest/v1/library_items?select=id&owner_user_id=eq.${postgrestValue(user.id)}&type=eq.${postgrestValue(dbType)}&limit=${capProbeLimit}`,
                )) || [];
            return rows.length;
        }

        async function ensurePublicLibraryPublishAllowed(entries = []) {
            const user = await requirePublicLibraryAuth();
            const sourceEntries = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
            const sourceErrors = sourceEntries
                .map(publicLibrarySourceBlockReason)
                .filter(Boolean);
            if (sourceErrors.length) throw new Error(sourceErrors.join("\n"));
            for (const entry of sourceEntries) {
                const claimedIdentity = await ensureCreatorIdentityInSupabase(
                    entry.creator_id,
                    entry.creator,
                );
                if (claimedIdentity?.creator_id) entry.creator_id = claimedIdentity.creator_id;
                if (claimedIdentity?.creator_name) entry.creator = claimedIdentity.creator_name;
            }
            for (const entry of sourceEntries) {
                const dbType = publicLibraryItemTypeForDb(entry);
                if (!dbType) continue;
                await publicLibraryFetch(
                    "/rest/v1/rpc/public_library_publish_preflight",
                    {
                        method: "POST",
                        body: {
                            target_type: dbType,
                            target_definition_id:
                                publicLibraryRequiredText(entry.definition_id) ||
                                safeUploadSlug(publicLibraryItemNameForDb(entry)),
                            target_creator_id: entry.creator_id,
                        },
                    },
                );
            }
            return { user };
        }

        async function latestPublicLibraryVersionNumber(itemId = "") {
            const rows =
                (await publicLibraryFetch(
                    `/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&item_id=eq.${postgrestValue(itemId)}&order=version_number.desc&limit=1`,
                )) || [];
            return rows.length
                ? validateSupabasePublicVersionRow(
                      rows[0],
                      "latest_public_version",
                  ).version_number
                : 0;
        }

        async function upsertPublicLibraryEntryToSupabase(entry = {}, version = {}) {
            const user = await requirePublicLibraryAuth();
            const dbRow = publicLibraryItemPayloadForDb(entry);
            if (!dbRow.type) throw new Error("Only story and character public library items are supported.");
            const payloadUrl = Object.hasOwn(version, "payload_url")
                ? version.payload_url
                : entry.url;
            const payloadSha256 = Object.hasOwn(version, "payload_sha256")
                ? version.payload_sha256
                : null;
            const payloadSizeBytes = Object.hasOwn(version, "payload_size_bytes")
                ? version.payload_size_bytes
                : null;
            const imageUrl = Object.hasOwn(version, "image_url")
                ? version.image_url
                : entry.image_url || null;
            const changeSummary = Object.hasOwn(version, "change_summary")
                ? version.change_summary
                : "Published public library version.";
            if (typeof payloadUrl !== "string" || !payloadUrl)
                throw new Error("public version payload_url must be non-empty text.");
            for (const [field, value] of [
                ["payload_sha256", payloadSha256],
                ["image_url", imageUrl],
            ])
                if (value !== null && typeof value !== "string")
                    throw new Error(`public version ${field} must be text or null.`);
            if (
                payloadSizeBytes !== null &&
                (!Number.isSafeInteger(payloadSizeBytes) || payloadSizeBytes < 0)
            )
                throw new Error(
                    "public version payload_size_bytes must be a nonnegative safe integer or null.",
                );
            if (typeof changeSummary !== "string")
                throw new Error("public version change_summary must be text.");
            const raw = await publicLibraryFetch(
                "/rest/v1/rpc/publish_public_library_item_version",
                {
                    method: "POST",
                    body: {
                        item_payload: dbRow,
                        version_payload: {
                            hide_previous_version: version.hide_previous_version === true,
                            payload_url: payloadUrl,
                            payload_sha256: payloadSha256,
                            payload_size_bytes: payloadSizeBytes,
                            image_url: imageUrl,
                            change_summary: changeSummary,
                        },
                    },
                },
            );
            const result = Array.isArray(raw) ? raw[0] : raw;
            if (!isPlainObject(result))
                throw new Error("Supabase did not return the atomic public publish result.");
            const allowedResultFields = new Set(["i", "v", "w", "p", "n"]);
            for (const field of Object.keys(result))
                if (!allowedResultFields.has(field))
                    throw new Error(`atomic_public_publish.${field} is not an approved field.`);
            for (const field of allowedResultFields)
                if (!Object.hasOwn(result, field))
                    throw new Error(`atomic_public_publish.${field} is required.`);
            const updatedItem = validateSupabasePublicItemRow(
                result.i,
                "atomic_public_publish.item",
            );
            const currentVersion = validateSupabasePublicVersionRow(
                result.v,
                "atomic_public_publish.version",
            );
            if (updatedItem.owner_user_id !== user.id)
                throw new Error("Atomic public publish returned an item owned by another account.");
            if (currentVersion.item_id !== updatedItem.id)
                throw new Error("Atomic public publish returned a version for another item.");
            if (updatedItem.current_version_id !== currentVersion.id)
                throw new Error("Atomic public publish did not select the returned version.");
            if (typeof result.w !== "boolean")
                throw new Error("atomic_public_publish.w must be true or false.");
            for (const field of ["p", "n"])
                if (!Number.isSafeInteger(result[field]) || result[field] < 0)
                    throw new Error(`atomic_public_publish.${field} must be a nonnegative safe integer.`);
            if (result.n !== result.p + 1 || currentVersion.version_number !== result.n)
                throw new Error("Atomic public publish returned inconsistent version numbers.");
            return {
                item: updatedItem,
                version: currentVersion,
                entry: publicLibraryEntryFromSupabaseItem(updatedItem, currentVersion),
                wasUpdate: result.w,
                previousVersionNumber: result.p,
                versionNumber: result.n,
            };
        }

        async function cleanupPublicLibrarySupabaseItem(itemId = "") {
            const id = String(itemId || "").trim();
            if (!id) return false;
            await publicLibraryFetch(`/rest/v1/library_items?id=eq.${postgrestValue(id)}`, {
                method: "DELETE",
            });
            log("Supabase public test item deleted", `library_items.id=${id}`, {
                type: "system",
                level: "message",
            });
            return true;
        }

        async function cleanupPublicLibrarySupabaseResults(results = [], options = {}) {
            const throwOnFailure = options.throwOnFailure !== false;
            const failures = [];
            const cleanedItemIds = new Set();
            for (const result of (Array.isArray(results) ? results : [results]).filter(Boolean)) {
                const itemId = result.item?.id || result.entry?.supabase_item_id || result.entry?.id || "";
                if (!itemId || cleanedItemIds.has(itemId)) continue;
                cleanedItemIds.add(itemId);
                try {
                    await cleanupPublicLibrarySupabaseItem(itemId);
                } catch (err) {
                    failures.push({
                        itemId,
                        error: err?.message || String(err),
                    });
                    log("Supabase public test cleanup failed", err.message || String(err), {
                        type: "system",
                        level: "warn",
                    });
                }
            }
            if (failures.length && throwOnFailure)
                throw new Error(
                    `Supabase public test cleanup failed for ${failures.length} item(s): ${failures
                        .map((failure) => `${failure.itemId || "(missing id)"}: ${failure.error}`)
                        .join("; ")}`,
                );
            return {
                ok: failures.length === 0,
                failures,
            };
        }

        async function addEntriesToPublicLibraryIndex(entries = [], options = {}) {
            const sourceEntries = Array.isArray(entries) ? entries : [entries];
            const exactEntries = sourceEntries.map((entry, index) =>
                exactPublicLibraryEntry(entry, `public_library_entries.${index}`),
            );
            const errors = exactEntries.flatMap((entry) =>
                publicLibraryPublishPolicyErrors(entry).map((error) => `${entry.name}: ${error}`),
            );
            if (errors.length)
                throw new Error(`Public library metadata is incomplete:\n${errors.join("\n")}`);
            const results = [];
            for (const entry of exactEntries) {
                results.push(
                    await upsertPublicLibraryEntryToSupabase(entry, {
                        hide_previous_version: entry.type === "character" && options.hidePreviousVersion === true,
                        payload_url: entry.url,
                        image_url: entry.image_url || null,
                        payload_sha256: entry.payload_sha256 || null,
                        payload_size_bytes: entry.payload_size_bytes || null,
                    }),
                );
            }
            const publishedEntries = results.map(
                (result) => result.entry || exactEntries[results.indexOf(result)],
            );
            for (const [index, result] of results.entries())
                applyPublishedPublicLibraryResult(result, publishedEntries[index]);
            const index = mergePublicLibraryIndexItems(
                app.publicLibraryLastIndex || publicLibraryEmptyIndex(),
                publishedEntries,
            );
            app.publicLibraryLastIndex = index;
            return {
                upload: { url: "supabase://library_items" },
                index,
                entries: publishedEntries,
                results,
            };
        }

        function upsertPublicLibraryEntryList(list, entry) {
            if (!Array.isArray(list) || !entry?.id) return false;
            const index = list.findIndex(
                (item) => String(item.supabase_item_id || item.id || "") === String(entry.id),
            );
            if (index < 0) list.push(clone(entry));
            else Object.assign(list[index], clone(entry));
            return true;
        }

        function applyPublishedPublicLibraryResult(result = {}, fallbackEntry = null) {
            const entry = result.entry || fallbackEntry;
            if (!entry?.id) return;
            const isCharacter = entry.type === "character";
            upsertPublicLibraryEntryList(
                isCharacter
                    ? (app.characterLibraryOwnedCharacterEntries ||= [])
                    : (app.storyLibraryOwnedStoryEntries ||= []),
                entry,
            );
            if (app.publicLibraryOwnedIndex?.items)
                upsertPublicLibraryEntryList(app.publicLibraryOwnedIndex.items, entry);
            patchPublicLibrarySearchCaches(entry, true);
            app.ownedPublicLibraryVersionStateCache ||= {};
            for (const key of Object.keys(app.ownedPublicLibraryVersionStateCache))
                if (key.endsWith(`:${entry.id}`))
                    delete app.ownedPublicLibraryVersionStateCache[key];
            if (isCharacter) renderCharacterLibraryOwnedPublicCharacters();
            else refreshStoryLibraryActiveTabCards({ immediateSmall: true });
        }

        async function addPublicStoryFeedback(entryId, feedback = {}) {
            const user = await requirePublicLibraryAuth();
            const index = app.publicLibraryLastIndex || (await fetchPublicLibraryIndex({ mode: "all" }));
            const entry = (index.items || []).find(
                (item) =>
                    item.type === "story-template" &&
                    String(item.id || "") === String(entryId || ""),
            );
            if (!entry) throw new Error("That public story was not found in the current index.");
            const normalized = createPublicStoryFeedback({
                ...feedback,
                entry_id: entry.id,
                creator: feedback.creator || activeUserProfile()?.name || "anonymous",
                at: feedback.at || new Date().toISOString(),
            });
            if (!normalized) throw new Error("Story feedback is incomplete.");
            if (normalized.type === "rating") {
                await publicLibraryFetch("/rest/v1/rpc/set_library_rating", {
                    method: "POST",
                    body: {
                        target_item_id: entry.supabase_item_id || entry.id,
                        target_rating: normalized.rating,
                    },
                });
                await invalidatePublicLibrarySearchCache();
                return { upload: { url: "supabase://library_ratings" }, index, entry, feedback: normalized };
            }
            await publicLibraryFetch("/rest/v1/library_feedback", {
                method: "POST",
                body: {
                    item_id: entry.supabase_item_id || entry.id,
                    user_id: user.id,
                    kind: normalized.type,
                    rating: normalized.rating,
                    report_reason: normalized.report_reason || null,
                    comment: normalized.comment || "",
                    suggested_kink_tags: [],
                },
            });
            const next = await fetchPublicLibraryIndex({ mode: "stories" });
            app.publicLibraryLastIndex = next;
            renderPublicLibraryStoryList(next);
            return { upload: { url: "supabase://library_feedback" }, index: next, entry, feedback: normalized };
        }

        const PUBLIC_REPORT_REASON_LABELS = {inappropriate_content: "Inappropriate content",
            real_person: "Real person",
            copyrighted_source_material: "Copyrighted/source material",
            wrong_genre: "Wrong genre",
            spam_scam_malicious: "Spam, scam, or malicious content",
            hate_harassment: "Hate or harassment",
            other: "Other",
        };

        function publicReportReasonsForEntry() {
            return ["inappropriate_content", "real_person", "copyrighted_source_material", "wrong_genre", "spam_scam_malicious", "hate_harassment", "other"];
        }

        function publicReportEntryById(entryId = "") {
            const id = String(entryId || "");
            return (
                publicLibraryEntryById(id) ||
                ownedPublicLibraryEntryById(id) ||
                (app.characterLibraryPublicSearch?.items || []).find(
                    (entry) => String(entry.id || "") === id,
                ) ||
                (app.storyLibraryPublicSearch?.items || []).find(
                    (entry) => String(entry.id || "") === id,
                ) ||
                null
            );
        }

        async function confirmPublicLibraryPublish(label = "item", name = "", options = {}) {
            if (options.skipPublishConfirm) return true;
            const cleanName = textSlot(name, label || "this item");
            return new Promise((resolve) => {
                const popup = openPopupModal(`
                    <h2>Publish Publicly?</h2>
                    <p>Publish <strong>${escapeHtml(cleanName)}</strong> to the EmberAdventures public library?</p>
                    <div class="publish-rules">
                        <p>Public uploads must be your own original work. EmberAdventures currently rejects source-based stories and characters even when you have adaptation permission.</p>
                        <p>Keep public uploads suitable for a general audience. Do not publish private information, harassment, hate, scams, malware, or illegal content.</p>
                        <p>Public uploads may be reported, hidden, or removed. Repeated or serious violations may remove publishing access.</p>
                        <p>Your Google account identifies your publisher account and connects it to your creator IDs. EmberAdventures stores the account identifier needed to manage your public uploads, ratings, and reports.</p>
                        <label class="check-row"><input type="checkbox" data-public-publish-accept> <span>I own or have permission to publish this content and it follows these rules.</span></label>
                    </div>
                    <div class="row" style="margin-top:.8rem">
                        <button type="button" class="primary" data-public-publish-confirm disabled>Publish</button>
                        <button type="button" data-public-publish-cancel>Cancel</button>
                    </div>
                `);
                const finish = (value) => {
                    popup.close();
                    resolve(value);
                };
                if (label === "characters" || options.characterPublishing === true) {
                    const row = document.createElement("label");
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = options.hidePreviousVersion !== false;
                    options.hidePreviousVersion = checkbox.checked;
                    checkbox.onchange = () => { options.hidePreviousVersion = checkbox.checked; };
                    row.className = "check-row";
                    row.append(checkbox, document.createTextNode(" Hide the immediately previous version, if one exists"));
                    popup.box.querySelector(".publish-rules").appendChild(row);
                }
                const accept = popup.box.querySelector("[data-public-publish-accept]");
                const confirm = popup.box.querySelector("[data-public-publish-confirm]");
                accept.onchange = () => { confirm.disabled = !accept.checked; };
                confirm.onclick = () => finish(true);
                popup.box.querySelector("[data-public-publish-cancel]").onclick = () => finish(false);
            });
        }

        function publicReportItemType(entry = {}) {
            return entry.type === "character" ? "character" : "story";
        }

        function publicReportCheckboxListHtml(values = [], selected = [], options = {}) {
            const selectedSet = new Set((selected || []).map((value) => String(value).toLowerCase()));
            const labeler = options.genre ? genreDisplayLabel : (value) => value;
            return `<div class="report-picker-grid">
                ${(values || [])
                    .map((value) => {
                        const clean = String(value || "").trim();
                        if (!clean) return "";
                        return `<label class="check-row"><input type="checkbox" data-report-picker="${escapeHtml(options.kind || "")}" value="${escapeHtml(clean)}" ${selectedSet.has(clean.toLowerCase()) ? "checked" : ""}> <span>${escapeHtml(labeler(clean))}</span></label>`;
                    })
                    .join("")}
            </div>`;
        }

        function publicReportModalHtml(entry = {}) {
            const type = publicReportItemType(entry);
            const reasons = publicReportReasonsForEntry(entry);
            const savedReplyEmails = stringListSlot(app.settings.publicReportReplyEmails || []);
            const currentGenres = approvedGenreList(entry.genres || []);

            return `
                <h2>Report ${type === "character" ? "Character" : "Story"}</h2>
                <p class="hint">Tell us what looks wrong with this public ${type}. Reports are sent directly to the creator of EmberAdventures.</p>
                <p class="hint">${escapeHtml(entry.name || entry.title || "Untitled")}</p>
                <div class="stack">
                    ${reasons
                        .map(
                            (reason) =>
                                `<label class="check-row"><input type="checkbox" data-public-report-reason value="${escapeHtml(reason)}"> <span>${escapeHtml(PUBLIC_REPORT_REASON_LABELS[reason] || reason)}</span></label>`,
                        )
                        .join("")}
                </div>
                <details id="publicReportGenrePicker" class="state-editor-section hidden" style="margin-top:.75rem">
                    <summary>Suggested Genres</summary>
                    ${publicReportCheckboxListHtml(entertainmentPreferenceOptions(), currentGenres, { kind: "genres", genre: true })}
                </details>
                <label style="margin-top:.75rem">Optional Description
                    <textarea id="publicReportDetails" rows="4" maxlength="1000" placeholder="Optional Description"></textarea>
                </label>
                <label>Reply email
                    <input id="publicReportReplyEmail" type="email" list="publicReportReplyEmailList" value="${escapeHtml(savedReplyEmails[0] || "")}" placeholder="Optional reply email">
                    <datalist id="publicReportReplyEmailList">
                        ${savedReplyEmails.map((email) => `<option value="${escapeHtml(email)}"></option>`).join("")}
                    </datalist>
                </label>
                <div class="row" style="margin-top:.8rem">
                    <button class="danger" id="submitPublicReportBtn">Submit Report</button>
                    <button id="cancelPublicReportBtn">Cancel</button>
                </div>
            `;
        }

        function selectedPublicReportValues(rootNode, selector) {
            return [...(rootNode?.querySelectorAll?.(`${selector}:checked`) || [])]
                .map((input) => String(input.value || "").trim())
                .filter(Boolean);
        }

        function rememberPublicReportReplyEmail(email = "") {
            const clean = String(email || "").trim();
            if (!clean) return;
            const list = [clean, ...stringListSlot(app.settings.publicReportReplyEmails || [])]
                .filter((value, index, array) => array.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index)
                .slice(0, 8);
            app.settings.publicReportReplyEmails = list;
            scheduleActiveGameSave();
        }

        function buildPublicReportPayload(entry = {}, formRoot = document) {
            const reasons = selectedPublicReportValues(formRoot, "[data-public-report-reason]");
            const details = publicLibraryRequiredText(formRoot.querySelector("#publicReportDetails")?.value || "");
            if (!reasons.length) throw new Error("Select at least one report reason.");
            if (reasons.includes("other") && !details)
                throw new Error("Optional Description is required when Other is selected.");
            const user = supabaseSignedInUser();
            const suggestedGenres = reasons.includes("wrong_genre")
                ? approvedGenreList(selectedPublicReportValues(formRoot, "[data-report-picker='genres']"))
                : [];

            const report = {
                item_id: entry.supabase_item_id || entry.id,
                item_type: publicReportItemType(entry),
                item_title: entry.name || entry.title || "",
                uploader_id: entry.owner_user_id || "",
                reporter_id: user?.id || "",
                reporter_email: user?.email || "",
                reasons,
                details,
                suggested_genres: suggestedGenres,
                reply_email: publicLibraryRequiredText(formRoot.querySelector("#publicReportReplyEmail")?.value || ""),
                content_url: entry.url || "",
                image_url: entry.image_url || "",
            };
            for (const key of Object.keys(report)) {
                const value = report[key];
                if (Array.isArray(value) && !value.length) delete report[key];
                else if (value == null || value === "") delete report[key];
            }
            return report;
        }

        async function submitPublicLibraryReport(entry = {}, formRoot = document) {
            const report = buildPublicReportPayload(entry, formRoot);
            const body = {
                item_id: report.item_id,
                item_type: report.item_type,
                item_title: report.item_title,
                uploader_id: report.uploader_id,
                reporter_id: report.reporter_id,
                reporter_email: report.reporter_email,
                reasons: EmberSharedLibraryFormat.reportReasons(report.reasons),
                details: report.details,
                suggested_genres: report.suggested_genres,
                reply_email: report.reply_email,
                content_url: report.content_url,
                image_url: report.image_url,
            };
            for (const key of Object.keys(body)) {
                const value = body[key];
                if (Array.isArray(value) && !value.length) delete body[key];
                else if (value == null || value === "") delete body[key];
            }
            await publicLibraryFetch("/rest/v1/library_reports", {
                method: "POST",
                auth: supabaseSessionAccessToken() ? undefined : false,
                body,
            });
            log(
                "Public report submitted",
                prettyJson({
                    item_id: body.item_id || "",
                    item_type: body.item_type || "",
                    item_title: body.item_title || "",
                    reasons: body.reasons || [],
                    reporter: body.reporter_email || body.reporter_id || "anonymous",
                    hasDetails: !!body.details,
                    hasReplyEmail: !!body.reply_email,
                }),
                { type: "troubleshooting", level: "message" },
            );
            rememberPublicReportReplyEmail(report.reply_email || "");
            return report;
        }

        function openReportPublicLibraryItemModal(entryId = "") {
            const entry = publicReportEntryById(entryId);
            if (!entry) {
                showNotice("Public Item Not Found", "Run the public search again and try reporting this item once more.");
                return;
            }
            const popup = openPopupModal(publicReportModalHtml(entry));
            const close = () => popup.close();
            const syncCorrectionPickers = () => {
                const reasons = selectedPublicReportValues(popup.box, "[data-public-report-reason]");
                const genrePicker = popup.box?.querySelector("#publicReportGenrePicker");

                genrePicker?.classList.toggle("hidden", !reasons.includes("wrong_genre"));
                if (genrePicker) genrePicker.open = reasons.includes("wrong_genre");
            };
            popup.box?.querySelectorAll("[data-public-report-reason]").forEach((input) => {
                input.addEventListener("change", syncCorrectionPickers);
            });
            syncCorrectionPickers();
            popup.box?.querySelector("#cancelPublicReportBtn")?.addEventListener("click", close);
            popup.box?.querySelector("#submitPublicReportBtn")?.addEventListener("click", async () => {
                try {
                    setStatus("Submitting report...");
                    await submitPublicLibraryReport(entry, popup.box);
                    close();
                    showNotice("Report Submitted", "Thank you. The report was sent to the creator of EmberAdventures.");
                } catch (err) {
                    showNotice("Report Failed", err.message || String(err));
                } finally {
                    setStatus("Ready");
                }
            });
        }

        function openReportPublicCharacterModal(entryId) {
            openReportPublicLibraryItemModal(entryId);
        }

        function reportManagerReviewPayloadFromHash() {
            const hash = String(window.location.hash || "").replace(/^#/, "");
            if (!hash) return null;
            const params = new URLSearchParams(hash);
            const encoded = params.get("review");
            if (!encoded) return null;
            try {
                const payload = JSON.parse(encoded);
                return exactReportManagerReviewPayload(payload);
            } catch (err) {
                throw new Error(
                    `Report Manager review link is invalid: ${err.message || String(err)}`,
                );
            }
        }

        function clearReportManagerReviewHash() {
            if (!String(window.location.hash || "").includes("review=")) return;
            try {
                const url = new URL(window.location.href);
                url.hash = "";
                window.history.replaceState({}, document.title, url.toString());
            } catch {
                window.location.hash = "";
            }
        }

        const REPORT_MANAGER_REVIEW_FIELDS = new Set([
            "source",
            "item_type",
            "item_id",
            "item_title",
            "content_url",
            "image_url",
            "report_count",
        ]);

        function exactReportManagerReviewPayload(payload = {}) {
            const errors = [
                ...exactObjectFieldValidationErrors(
                    payload,
                    REPORT_MANAGER_REVIEW_FIELDS,
                    "report_manager_review",
                ),
                ...requiredExactFieldsValidationErrors(
                    payload,
                    [...REPORT_MANAGER_REVIEW_FIELDS],
                    "report_manager_review",
                ),
            ];
            if (!isPlainObject(payload))
                throw new Error(validationErrorsText(validationResult(errors)));
            if (payload.source !== "EmberAdventuresReportManager")
                errors.push(
                    validationError(
                        "report_manager_review.source",
                        "value",
                        'source must be exactly "EmberAdventuresReportManager".',
                    ),
                );
            if (!["story", "character"].includes(payload.item_type))
                errors.push(
                    validationError(
                        "report_manager_review.item_type",
                        "value",
                        'item_type must be exactly "story" or "character".',
                    ),
                );
            for (const field of ["item_id", "item_title", "content_url"])
                errors.push(
                    ...requiredExactTextValidationErrors(
                        payload[field],
                        `report_manager_review.${field}`,
                    ),
                );
            if (typeof payload.image_url !== "string")
                errors.push(
                    validationError(
                        "report_manager_review.image_url",
                        "type",
                        "image_url must be text.",
                    ),
                );
            if (!Number.isSafeInteger(payload.report_count) || payload.report_count < 1)
                errors.push(
                    validationError(
                        "report_manager_review.report_count",
                        "type",
                        "report_count must be a positive safe integer.",
                    ),
                );
            if (errors.length)
                throw new Error(validationErrorsText(validationResult(errors)));
            return clone(payload);
        }

        function publicLibraryEntryFromReportManagerReview(payload = {}) {
            const review = exactReportManagerReviewPayload(payload);
            const type = review.item_type === "character" ? "character" : "story-template";
            return createPublicLibraryEntry({
                id: review.item_id,
                type,
                title: review.item_title,
                name: review.item_title,
                description: `Opened from ${review.report_count} public report${review.report_count === 1 ? "" : "s"}.`,
                url: review.content_url,
                image_url: review.image_url,
                source: "EmberAdventures Report Manager",
                creator: "EmberAdventures Report Manager",
                creation_tool: "EmberAdventures Report Manager",
                visibility: "hidden",
            }, { allowMissingCreatorIdentity: true });
        }

        async function handleReportManagerReviewHashOnStartup() {
            if (app.reportManagerReviewHashHandled) return false;
            const payload = reportManagerReviewPayloadFromHash();
            if (!payload) return false;
            app.reportManagerReviewHashHandled = true;
            clearReportManagerReviewHash();
            const entry = publicLibraryEntryFromReportManagerReview(payload);
            if (!entry) {
                showNotice(
                    "Report Review Link Invalid",
                    "This report review link does not include the hosted JSON URL needed to open the item.",
                );
                return true;
            }
            app.publicLibraryLastIndex = mergePublicLibraryIndexItems(
                app.publicLibraryLastIndex || publicLibraryEmptyIndex(),
                [entry],
                { allowMissingCreatorIdentity: true },
            );
            if (entry.type === "character") {
                openCharacterLibraryModal({ tab: "public" });
                await openPublicCharacterLibraryDetail(entry.id);
            } else {
                openStoryTemplateLibrary({ tab: "public", skipBack: true });
                await openPublicStoryLibraryDetail(entry.id);
            }
            return true;
        }

        function renderAdminInboxButton() {
            const counts = app.adminInboxCounts || { reports: 0, developerIssues: 0 };
            const total = Math.max(0, Number(counts.reports || 0)) +
                Math.max(0, Number(counts.developerIssues || 0));
            const button = $("adminInboxBtn");
            const badge = $("adminInboxBadge");
            if (badge) badge.textContent = String(total);
            button?.classList.toggle("hidden", !app.adminInboxAvailable);
            if (button)
                button.title = `${counts.reports || 0} public reports, ${counts.developerIssues || 0} developer issues`;
        }

        function openAdminInboxNotice() {
            if (
                !isOfficialEmberAdventuresAdminUser(supabaseSignedInUser()) ||
                !app.adminInboxAvailable
            ) {
                clearAdminInboxAvailability();
                return false;
            }
            const counts = app.adminInboxCounts || { reports: 0, developerIssues: 0 };
            openPopupModal(`
                <h2>Administrator Inbox</h2>
                <div class="grid2">
                    <div class="panel"><strong>${Number(counts.reports || 0)}</strong><br><span class="hint">Public content reports</span></div>
                    <div class="panel"><strong>${Number(counts.developerIssues || 0)}</strong><br><span class="hint">Open developer issues</span></div>
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="window.open('http://127.0.0.1:8765','_blank','noopener')">Open Report Manager</button>
                    <button type="button" onclick="EmberAdventures.refreshAdminInboxCounts()">Refresh</button>
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Close</button>
                </div>
            `);
            return true;
        }

        async function notifyAdminPublicReportCount(options = {}) {
            const startup = !!options.startup;
            if (!startup) return null;
            if (!supabaseSessionAccessToken()) {
                clearAdminInboxAvailability();
                log("Admin report startup check skipped", "No Supabase session token is available.", {
                    type: "troubleshooting",
                    level: "message",
                });
                return null;
            }
            const currentUser = supabaseSignedInUser();
            if (currentUser && !isOfficialEmberAdventuresAdminUser(currentUser)) {
                clearAdminInboxAvailability();
                return null;
            }
            try {
                log("Admin report startup check started", "Checking Supabase for unhandled public reports.", {
                    type: "troubleshooting",
                    level: "message",
                });
                await publicLibraryRefreshSessionIfNeeded();
                if (!supabaseSessionAccessToken()) {
                    log("Admin report startup check skipped", "Supabase session was not available after refresh.", {
                        type: "troubleshooting",
                        level: "message",
                    });
                    return null;
                }
                if (!supabaseSignedInUser()) await publicLibraryRefreshCurrentUser();
                const user = supabaseSignedInUser();
                if (!isOfficialEmberAdventuresAdminUser(user)) {
                    clearAdminInboxAvailability();
                    return null;
                }
                const compact = await publicLibraryFetch("/rest/v1/rpc/admin_inbox_counts", {
                    method: "POST",
                    body: {},
                });
                const counts = {
                    reports: Math.max(0, Number(compact?.r || 0)),
                    developerIssues: Math.max(0, Number(compact?.d || 0)),
                };
                app.adminInboxAvailable = true;
                app.adminInboxCounts = counts;
                renderAdminInboxButton();
                log(
                    "Admin report startup check completed",
                    prettyJson({
                        ...counts,
                        userId: user?.id || "",
                        userEmail: user?.email || "",
                    }),
                    { type: "troubleshooting", level: counts.reports + counts.developerIssues ? "warn" : "message" },
                );
                return counts;
            } catch (err) {
                clearAdminInboxAvailability();
                log("Admin report startup check skipped", err.message || String(err), {
                    type: "system",
                    level: "message",
                });
                return null;
            }
        }

        async function uploadCharacterProfilePresentationForPublic(
            character = {},
            male = false,
            label = "Character",
            options = {},
        ) {
            const candidate = characterProfilePresentationCandidate(character, male);
            if (!candidate)
                throw new Error(`${label} needs a ${male ? "male" : "female"} profile image before it can be published.`);
            const localImageId = textSlot(
                candidate.local_image_id || candidate.id,
                "",
            );
            const storedImage = localImageId
                ? profileImageByStoreId(localImageId)
                : null;
            const localImage = storedImage || (candidate.id
                ? createProfileImageRecord({
                      ...candidate,
                      character_id: candidate.character_id || character.id,
                      male,
                  })
                : null);
            let imageUrl = textSlot(
                candidate.url || candidate.hosted_url || localImage?.hosted_url,
                "",
            );
            let upload = null;
            if (!imageUrl) {
                if (localImageId && !localImage)
                    throw new Error(
                        `${label} ${male ? "male" : "female"} profile image references missing local image ${localImageId}.`,
                    );
                if (!localImage || !profileImageIsFinished(localImage))
                    throw new Error(`${label} ${male ? "male" : "female"} profile image has not finished generating.`);
                const { blob, hostedUrl } = await imageRecordBlobForUpload(localImage);
                imageUrl = hostedUrl || localImage.hosted_url || "";
                if (!imageUrl) {
                    upload = await uploadBlobToUserUploads(
                        blob,
                        `${label} ${male ? "male" : "female"} profile image`,
                        { testUpload: !!options.testUpload, pendingPublicUpload: true },
                    );
                    imageUrl = hostedUploadUrlText(upload.url, `${label} profile image upload`);
                }
            }
            if (!imageUrl)
                throw new Error(`${label} ${male ? "male" : "female"} profile image upload did not return a hosted URL.`);
            if (localImage?.id && (upload || !localImage.hosted_url)) {
                const hostedImage = applyHostedImageMetadata(
                    createProfileImageRecord(localImage),
                    upload || {
                        url: imageUrl,
                        size: localImage.hosted_size || 0,
                    },
                );
                upsertProfileStoreImage(
                    hostedImage,
                    profileImageOwnerNameForHandle(character.name || label, character),
                );
                if (storedImage) Object.assign(storedImage, hostedImage);
            }
            const source = Object.hasOwn(candidate, "local_image_id")
                ? profileImageSlotFromExactInput(candidate)
                : profileImageSlotFromExactInput({
                      ...emptyProfileImageSlot(male),
                      source: textSlot(candidate.source, "profile image"),
                      seed: candidate.seed ?? null,
                      prompt: textSlot(candidate.prompt, ""),
                      male,
                  });
            return {
                slot: profileImageSlotFromExactInput({
                    ...source,
                    url: imageUrl,
                    local_image_id: "",
                    source: source.source || localImage?.source || "profile image",
                    seed: source.seed ?? localImage?.seed ?? null,
                    prompt: source.prompt || localImage?.prompt || "",
                    negative_prompt: "",
                    male,
                }),
                upload,
            };
        }

        async function uploadCharacterProfileImagesForPublic(record = {}, options = {}) {
            const validation = validateCharacterLibraryRecord(record);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            const nextRecord = clone(record);
            const nextCharacter = nextRecord.character;
            const cleanPublicProfileFields = () => {
                nextRecord.active_profile_image_ids =
                    emptyCharacterLibraryActiveProfileImageIds();
                nextCharacter.profile_images = characterDefinitionImageOwnerSlot(null);
                nextCharacter.images = characterDefinitionImageOwnerSlot(null);
            };
            const label = nextCharacter.name;
            const maleResult = await uploadCharacterProfilePresentationForPublic(
                nextCharacter,
                true,
                label,
                options,
            );
            if (
                maleResult.upload &&
                Array.isArray(options.uploadCollector) &&
                !options.uploadCollector.includes(maleResult.upload)
            )
                options.uploadCollector.push(maleResult.upload);
            const nonMaleResult = await uploadCharacterProfilePresentationForPublic(
                nextCharacter,
                false,
                label,
                options,
            );
            if (
                nonMaleResult.upload &&
                Array.isArray(options.uploadCollector) &&
                !options.uploadCollector.includes(nonMaleResult.upload)
            )
                options.uploadCollector.push(nonMaleResult.upload);
            nextCharacter.profile_image_presentations = {
                male: maleResult.slot,
                non_male: nonMaleResult.slot,
            };
            nextCharacter.default_profile_image = characterPresentationUsesMaleFields(
                nextCharacter.gender,
            )
                ? clone(maleResult.slot)
                : clone(nonMaleResult.slot);
            cleanPublicProfileFields();
            return {
                record: nextRecord,
                uploads: [maleResult.upload, nonMaleResult.upload].filter(Boolean),
            };
        }

        async function prepareCharacterRecordsForPublicPublish(records = [], options = {}) {
            const prepared = [];
            const uploads = [];
            for (const record of (Array.isArray(records) ? records : [records]).filter(Boolean)) {
                const result = await uploadCharacterProfileImagesForPublic(record, options);
                const validation = validateCharacterLibraryRecord(result.record);
                if (!validation.ok) throw new Error(validationErrorsText(validation));
                prepared.push(result.record);
                uploads.push(...(result.uploads || []));
            }
            return { records: prepared, uploads };
        }





        function storyImageUploadAttestationErrors(template = {}) {
            const titleSlot = createStoryTitleCardImageSlot(template.title_card_image, template.state, template);
            const activeTitle = activeStoryTitleCardImage(template);
            if (/^local upload$/i.test(String(activeTitle?.source || titleSlot.source || "")) &&
                (activeTitle?.upload_attestation_classification || titleSlot.upload_attestation_classification) !== "sfw")
                return ["Confirm that the uploaded story image is suitable for a general audience before publishing."];

            return [];
        }

        async function publishCharacterRecordsToPublicIndex(records, label = "character", options = {}) {
            const publishNotice = (title, message) => {
                if (options.onPublishNotice)
                    options.onPublishNotice(title, message);
                else
                    showNotice(title, message);
            };
            const validRecords = (Array.isArray(records) ? records : [records]).filter(Boolean);
            if (!validRecords.length) {
                publishNotice("Publish Failed", "No valid character records were found.");
                return;
            }
            const reservedCreatorError = validRecords
                .map((record) =>
                    creatorIdentityNameReservationError(
                        record?.creator,
                        supabaseSignedInUser(),
                    ),
                )
                .find(Boolean);
            if (reservedCreatorError) {
                publishNotice("Creator Name Reserved", reservedCreatorError);
                return null;
            }
            for (const [index, record] of validRecords.entries()) {
                const validation = validateCharacterLibraryRecord(record);
                if (!validation.ok)
                    throw new Error(`characters.${index}: ${validationErrorsText(validation)}`);
            }
            const sfwImageErrors = validRecords.flatMap((record) =>
                [],
            );
            if (sfwImageErrors.length) {
                publishNotice(
                    "SFW Profile Images Required",
                    [...new Set(sfwImageErrors)].join("\n"),
                );
                return null;
            }
            const missingCreatorRecords = validRecords.filter(
                (record) => !characterRecordHasCreatorIdentity(record),
            );
            if (missingCreatorRecords.length) {
                publishNotice(
                    "Public Metadata Required",
                    `${compactNameList(
                        missingCreatorRecords.map(
                            (record) => record.name || "Unnamed character",
                        ),
                    )} ${missingCreatorRecords.length === 1 ? "does" : "do"} not identify a creator. Assign the creator during import or from the local character library before publishing.`,
                );
                return null;
            }
            const policyErrors = validRecords.flatMap((record) =>
                publicCharacterPolicyErrors(record.character, record.name),
            );
            if (policyErrors.length) {
                publishNotice("Public Publish Blocked", [...new Set(policyErrors)].join("\n"));
                return null;
            }
            const presentationErrors = validRecords.flatMap((record) =>
                characterPresentationCompatibilityIssues(record.character, {
                    requireProfileImages: true,
                }),
            );
            if (presentationErrors.length) {
                publishNotice(
                    "Public Character Presentation Required",
                    [...new Set(presentationErrors)].join("\n"),
                );
                return null;
            }
            const definitionErrors = validRecords.flatMap((record) => {
                const validation = validateCharacterLibraryRecord(record);
                return validation.ok
                    ? []
                    : validation.errors.map(
                          (error) => `${record.name || "Character"}: ${error.path}: ${error.message}`,
                      );
            });
            if (definitionErrors.length) {
                publishNotice("Public Character Invalid", definitionErrors.join("\n"));
                reportAppIssue(new Error(`Character publish rejected:\n${definitionErrors.join("\n")}`), {
                    title: "Character Publish Rejected",
                    type: "system",
                    context: "publishCharacterRecordsToPublicIndex",
                    details: { definitionErrors },
                });
                return null;
            }
            const preflight = validRecords
                .map((record) => publicLibraryCharacterMetadata(record, "pending"))
                .filter(Boolean);
            if (preflight.length !== validRecords.length) {
                publishNotice(
                    "Public Metadata Required",
                    "Each character needs a name, creator identity, creation tool, approved genre, gender, age, and profile image before it can be published.",
                );
                return;
            }
            const errors = preflight.flatMap((entry) =>
                publicLibraryPublishPolicyErrors(entry).map((error) => `${entry.name}: ${error}`),
            );
            if (errors.length) {
                publishNotice("Public Metadata Required", errors.join("\n"));
                return;
            }
            try {
                await ensurePublicLibraryPublishAuth();
                await ensurePublicLibraryPublishAllowed(preflight);
            } catch (err) {
                publishNotice("Public Publish Blocked", err.message || String(err));
                return null;
            }
            options.characterPublishing = true;
            if (
                !(await confirmPublicLibraryPublish(
                    label,
                    validRecords.length === 1
                        ? publicLibraryCharacterMetadata(validRecords[0], "pending")?.name || label
                        : `${validRecords.length} ${label}s`,
                    options,
                ))
            )
                return null;
            const confirmPayload = hostedCharacterSharePayload(validRecords);
            {}
            let metadataSubmissionStarted = false;
            let upload = null;
            const imageUploads = [];
            let publishStage = "prepare character profile images";
            try {
                const prepared = await prepareCharacterRecordsForPublicPublish(
                    validRecords,
                    {
                        ...options,
                        uploadCollector: imageUploads,
                    },
                );
                for (const imageUpload of prepared.uploads)
                    if (!imageUploads.includes(imageUpload))
                        imageUploads.push(imageUpload);
                publishStage = "verify character profile image hosting";
                await verifyPublicHostedImageManifest(
                    publicCharacterHostedImageManifest(prepared.records),
                    { label: "character publication" },
                );
                publishStage = "build character export payload";
                const payload = hostedCharacterSharePayload(
                    prepared.records.map((record) =>
                        characterDefinitionProjectionForExport(record),
                    ),
                );
                setStatus("Publishing character metadata...");
                publishStage = "upload character export payload";
                upload = await uploadCompressedJson(payload, "Public character upload", {
                    testUpload: !!options.testUpload,
                    pendingPublicUpload: true,
                });
                const recordUrl = publicUploadFileUrl(upload.fileName);
                publishStage = "build public character metadata";
                const entries = prepared.records
                    .map((record) => publicLibraryCharacterMetadata(record, recordUrl))
                    .filter(Boolean);
                for (const entry of entries) {
                    entry.payload_sha256 = upload.sha256;
                    entry.payload_size_bytes = upload.payloadSizeBytes;
                }
                if (entries.length !== prepared.records.length)
                    throw new Error(
                        "Public library metadata is incomplete. Each character needs a name, creator identity, creation tool, approved genre, gender, age, and profile image.",
                    );
                publishStage = "write public character metadata";
                protectPublicUploadsBeforePublish([upload, ...imageUploads]);
                metadataSubmissionStarted = true;
                const result = await addEntriesToPublicLibraryIndex(entries, options);
                markHostedUploadsCommitted([upload, ...imageUploads]);
                if (options.cleanupAfterPublish) {
                    await cleanupPublicLibrarySupabaseResults(result.results || []);
                    await cleanupHostedUploads(
                        [upload, ...imageUploads],
                        "Public character smoke upload",
                    );
                }
                publishNotice(
                    "Upload Successful",
                    `Uploaded ${entries.length} character${entries.length === 1 ? "" : "s"}.`,
                );
                return { result, upload, imageUploads, payload, entries };
            } catch (err) {
                log(
                    "Public character publish failed",
                    prettyJson({
                        stage: publishStage,
                        characterIds: validRecords.map((record) => record.id),
                        characterNames: validRecords.map((record) => record.name),
                        message: err?.message || String(err),
                        stack: err?.stack || "",
                    }),
                    { type: "troubleshooting", level: "error" },
                );
                if (!metadataSubmissionStarted)
                    await cleanupHostedUploads(
                        [upload, ...imageUploads],
                        "Public character upload failure",
                    );

                if (metadataSubmissionStarted)
                    log("Public publish uploads retained", err.message || String(err), {
                        type: "troubleshooting", level: "error",
                    });

                publishNotice("Public Publish Failed", (err.message || String(err)) +
                    (metadataSubmissionStarted && !err.policyRejected
                        ? "\nUploaded files have been preserved because the database may have accepted this publication. Check the Public Library before retrying."
                        : ""));
                return null;
            } finally {
                setStatus("Ready");
            }
        }

        async function prepareStoryTemplateForPublicPublish(template = {}, options = {}) {
            const nextTemplate = storyDefinitionForExport(template);
            const uploads = [];
            const slot = createStoryTitleCardImageSlot(
                nextTemplate.title_card_image,
                nextTemplate.state,
                nextTemplate,
            );
            const storedImage = storyTitleCardImageById(template, slot.id);
            const existingUrl = slot.url || storedImage?.hosted_url || storedImage?.url || "";
            if (existingUrl && /^https?:\/\//i.test(existingUrl)) {
                nextTemplate.title_card_image = createStoryTitleCardImageSlot(
                    {
                        ...slot,
                        url: existingUrl,
                    },
                    nextTemplate.state,
                    nextTemplate,
                );
            } else {
                const imageSrc = existingUrl || storedImage?.html || "";
                nextTemplate.title_card_image = createStoryTitleCardImageSlot(
                    {
                        ...slot,
                        url: imageSrc,
                    },
                    nextTemplate.state,
                    nextTemplate,
                );
                if (imageSrc) {
                    const { blob, hostedUrl } = await imageRecordBlobForUpload({
                        html: imageSrc,
                        hosted_url: /^https?:\/\//i.test(imageSrc) ? imageSrc : "",
                    });
                    let imageUrl = hostedUrl || "";
                    if (!imageUrl) {
                        const upload = await uploadBlobToUserUploads(
                            blob,
                            `${nextTemplate.title || "story"} title card image`,
                            { testUpload: !!options.testUpload, pendingPublicUpload: true },
                        );
                        uploads.push(upload);
                        imageUrl = upload.url;
                    }
                    nextTemplate.title_card_image = createStoryTitleCardImageSlot(
                        { ...slot, url: imageUrl },
                        nextTemplate.state,
                        nextTemplate,
                    );
                }
            }

            for (const target of storyBuilderImageTargets(nextTemplate.state)) {
                const male = await uploadCharacterProfilePresentationForPublic(
                    target.character,
                    true,
                    target.name || target.key || "Story character",
                    options,
                );
                const nonMale = await uploadCharacterProfilePresentationForPublic(
                    target.character,
                    false,
                    target.name || target.key || "Story character",
                    options,
                );
                if (male.upload) uploads.push(male.upload);
                if (nonMale.upload) uploads.push(nonMale.upload);
                target.character.profile_image_presentations = {
                    male: male.slot,
                    non_male: nonMale.slot,
                };
                target.character.default_profile_image = characterPresentationUsesMaleFields(
                    target.character.gender,
                ) ? clone(male.slot) : clone(nonMale.slot);
            }

            for (const entry of storyBuilderImageManifest(nextTemplate)) {
                let imageSlot = null;
                if (entry.kind === "unlock") imageSlot = entry.entry?.on_unlock?.image;
                if (entry.kind === "authored-asset") imageSlot = entry.asset;
                if (entry.kind === "story-reward") imageSlot = entry.reward?.image;
                if (!imageSlot || typeof imageSlot !== "object") continue;
                const imageSrc = publicHostedImageUrl(
                    imageSlot.url || imageSlot.hosted_url || imageSrcFromHtml(imageSlot.html || ""),
                );
                if (!imageSrc || /^https:\/\//i.test(imageSrc)) continue;
                const { blob, hostedUrl } = await imageRecordBlobForUpload({
                    html: imageSrc,
                    hosted_url: "",
                });
                let imageUrl = hostedUrl || "";
                if (!imageUrl) {
                    const upload = await uploadBlobToUserUploads(
                        blob,
                        `${entry.title || entry.slotId || "story image"}`,
                        { testUpload: !!options.testUpload, pendingPublicUpload: true },
                    );
                    uploads.push(upload);
                    imageUrl = upload.url;
                }
                imageSlot.url = imageUrl;
                if (Object.hasOwn(imageSlot, "hosted_url")) imageSlot.hosted_url = imageUrl;
                if (Object.hasOwn(imageSlot, "html")) imageSlot.html = "";
            }
            return {
                template: storyDefinitionForExport(nextTemplate),
                uploads,
            };
        }

        function publicStoryPublishingAvailable() {
            return isOfficialEmberAdventuresAdminUser(supabaseSignedInUser());
        }

        async function publishStoryTemplateToPublicIndex(id, options = {}) {
            if (!publicStoryPublishingAvailable()) {
                showNotice("Story Publishing — Coming Soon", "Public story publishing is coming soon. You can still create, play, import, and export stories locally.");
                return null;
            }

            const template = storyTemplateById(id);
            if (!template) return;
            const initialCreatorIdentity = selectedCreatorIdentity();
            const reservedCreatorError = creatorIdentityNameReservationError(
                initialCreatorIdentity?.creator_name || "",
                supabaseSignedInUser(),
            );
            if (reservedCreatorError) {
                showNotice("Creator Name Reserved", reservedCreatorError);
                return null;
            }


            const sourceBlock = publicLibrarySourceBlockReason({
                type: "story-template",
                name: template.title || "This story",
                source: template.source,
            });
            if (sourceBlock) {
                showNotice("Public Publish Blocked", sourceBlock);
                return null;
            }
            const initialPolicyErrors = publicStoryPolicyErrors(
                storyDefinitionForExport(template),
            );
            if (initialPolicyErrors.length) {
                showNotice(
                    "Public Publish Blocked",
                    [...new Set(initialPolicyErrors)].join("\n"),
                );
                return null;
            }
            const imageErrors = storyImageUploadAttestationErrors(template);
            if (imageErrors.length) {
                showNotice(
                    "Story Image Confirmation Required",
                    [...new Set(imageErrors)].join("\n"),
                );
                return null;
            }
            const creatorIdentity = initialCreatorIdentity ||
                await chooseCreatorIdentityForImport(
                    `${template.title || "This story"} story`,
                    { confirmText: "Publish" },
                );
            app.playerEditorBaseline = clone(app.state.player);
            if (!creatorIdentity) return null;
            const authUser = await ensurePublicLibraryPublishAuth();
            if (!authUser) return null;
            const sourceDefinitionValidation = validateStoryDefinition(template);
            if (!sourceDefinitionValidation.ok) {
                showNotice(
                    "Public Story Invalid",
                    `${template.title || "Story template"} is invalid:\n${validationErrorsText(sourceDefinitionValidation)}`,
                );
                reportAppIssue(new Error(`Story publish rejected:\n${validationErrorsText(sourceDefinitionValidation)}`), {
                    title: "Story Publish Rejected",
                    type: "system",
                    context: "publishStoryTemplateToPublicIndex",
                    details: { errors: sourceDefinitionValidation.errors },
                });
                return null;
            }
            const sourcePresentationIssues =
                storyCharacterPresentationCompatibilityIssues(template, {
                    requireProfileImages: true,
                });
            if (sourcePresentationIssues.length) {
                const message = [...new Set(sourcePresentationIssues)].join("\n");
                showNotice(
                    "Public Story Presentation Required",
                    `Every character in a public story needs complete male and female presentation data:\n\n${message}`,
                );
                reportAppIssue(new Error(`Story publish rejected:\n${message}`), {
                    title: "Story Publish Rejected",
                    type: "system",
                    context: "publishStoryTemplateToPublicIndex",
                    details: { errors: sourcePresentationIssues },
                });
                return null;
            }
            const cleanTemplate = storyDefinitionForExport(template);
            const policyErrors = publicStoryPolicyErrors(cleanTemplate);
            if (policyErrors.length) {
                showNotice("Public Publish Blocked", [...new Set(policyErrors)].join("\n"));
                return null;
            }
            const definitionValidation = validateStoryDefinition(cleanTemplate);
            if (!definitionValidation.ok) {
                showNotice(
                    "Public Story Invalid",
                    `${cleanTemplate.title || "Story template"} is invalid:\n${validationErrorsText(definitionValidation)}`,
                );
                reportAppIssue(new Error(`Story publish rejected:\n${validationErrorsText(definitionValidation)}`), {
                    title: "Story Publish Rejected",
                    type: "system",
                    context: "publishStoryTemplateToPublicIndex",
                    details: { errors: definitionValidation.errors },
                });
                return null;
            }
            const cleanPresentationIssues =
                storyCharacterPresentationCompatibilityIssues(cleanTemplate, {
                    requireProfileImages: true,
                });
            if (cleanPresentationIssues.length) {
                const message = [...new Set(cleanPresentationIssues)].join("\n");
                showNotice(
                    "Public Story Presentation Required",
                    `Every character in a public story needs complete male and female presentation data:\n\n${message}`,
                );
                reportAppIssue(new Error(`Story publish rejected:\n${message}`), {
                    title: "Story Publish Rejected",
                    type: "system",
                    context: "publishStoryTemplateToPublicIndex",
                    details: { errors: cleanPresentationIssues },
                });
                return null;
            }
            const preflight = publicLibraryStoryMetadata(
                cleanTemplate,
                "pending",
                creatorIdentity,
            );
            if (!preflight) {
                showNotice(
                    "Public Metadata Required",
                    "The story needs a name, creator identity, creation tool, approved genre, and title-card image before it can be published.",
                );
                return;
            }
            const errors = publicLibraryPublishPolicyErrors(preflight).filter(
                (error) => error !== "default image is required",
            );
            if (errors.length) {
                showNotice("Public Metadata Required", errors.join("\n"));
                return;
            }
            try {
                await ensurePublicLibraryPublishAllowed([preflight]);
            } catch (err) {
                showNotice("Public Publish Blocked", err.message || String(err));
                return null;
            }
            let metadataSubmissionStarted = false;
            let upload = null;
            const imageUploads = [];
            try {
                if (
                    !(await confirmPublicLibraryPublish(
                        "story",
                        cleanTemplate.title || template.title || "Story Template",
                        options,
                    ))
                )
                    return null;
                const previewPayload = storyExportPayloadFromDefinition(cleanTemplate);
                const prepared = await prepareStoryTemplateForPublicPublish(template, options);
                imageUploads.push(...prepared.uploads);
                await verifyPublicHostedImageManifest(
                    publicStoryHostedImageManifest(prepared.template),
                    { label: "story publication" },
                );
                const payload = storyExportPayloadFromDefinition(
                    storyDefinitionForExport(prepared.template),
                );
                const preparedPreflight = publicLibraryStoryMetadata(
                    prepared.template,
                    "pending",
                    creatorIdentity,
                );
                const preparedErrors = preparedPreflight
                    ? publicLibraryPublishPolicyErrors(preparedPreflight).map((error) =>
                          error === "default image is required"
                              ? "title-card image is required"
                              : error,
                      )
                    : ["story metadata is incomplete"];
                if (preparedErrors.length)
                    throw new Error(
                        `Public library metadata is incomplete: ${(preparedPreflight?.name || cleanTemplate.title || "Story Template")}: ${preparedErrors.join(", ")}`,
                    );
                {}
                setStatus("Publishing story metadata...");
                upload = await uploadCompressedStoryJson(payload, "Public story template upload", {
                    testUpload: !!options.testUpload,
                    pendingPublicUpload: true,
                });
                const recordUrl = publicUploadFileUrl(upload.fileName);
                const entry = publicLibraryStoryMetadata(
                    prepared.template,
                    recordUrl,
                    creatorIdentity,
                );
                if (!entry)
                    throw new Error(
                        "Public library metadata is incomplete. The story needs a name, creator identity, creation tool, approved genre, and title-card image.",
                    );
                entry.payload_sha256 = upload.sha256;
                entry.payload_size_bytes = upload.payloadSizeBytes;
                protectPublicUploadsBeforePublish([upload, ...imageUploads]);
                metadataSubmissionStarted = true;
                const result = await addEntriesToPublicLibraryIndex([entry]);
                markHostedUploadsCommitted([upload, ...imageUploads]);
                if (options.cleanupAfterPublish) {
                    await cleanupPublicLibrarySupabaseResults(result.results || []);
                    await cleanupHostedUploads([upload, ...imageUploads], "Public story smoke upload");
                }
                const published = result.results?.[0];
                showNotice(
                    "Public Library Updated",
                    published?.wasUpdate
                        ? `Published ${entry.name} as version ${published.versionNumber}.`
                        : `Added ${entry.name} to the public metadata index.`,
                );
                return { result, upload, imageUploads, payload, entry };
            } catch (err) {
                if (!metadataSubmissionStarted)
                    await cleanupHostedUploads(
                        [upload, ...imageUploads],
                        "Public story upload failure",
                    );

                if (metadataSubmissionStarted)
                    log("Public publish uploads retained", err.message || String(err), {
                        type: "troubleshooting", level: "error",
                    });

                showNotice("Public Publish Failed", (err.message || String(err)) +
                    (metadataSubmissionStarted && !err.policyRejected
                        ? "\nUploaded files have been preserved because the database may have accepted this publication. Check the Public Library before retrying."
                        : ""));
                return null;
            } finally {
                setStatus("Ready");
            }
        }

        async function publishImageRecordToPublicIndex(id) {
            const image = (app.images || []).find((item) => String(item.id) === String(id));
            if (!image) return;
            try {
                setStatus("Publishing image metadata...");
                let imageUrl = image.hosted_url || "";
                if (!imageUrl) {
                    const { blob, hostedUrl } = await imageRecordBlobForUpload(image);
                    if (hostedUrl) {
                        imageUrl = hostedUrl;
                        image.hosted_url = hostedUrl;
                    } else {
                        const upload = await uploadBlobToUserUploads(blob, "Public image upload");
                        applyHostedImageMetadata(image, upload);
                        imageUrl = upload.url;
                    }
                    scheduleActiveGameSave();
                    refreshImageRecordSurfaces(image.id, {
                        reason: "public image hosted metadata updated",
                    });
                }
                const entry = publicLibraryImageMetadata(image, imageUrl);
                if (!entry) {
                    showNotice(
                        "Public Metadata Required",
                        "The image needs name, source, creator, and creation_tool metadata before it can be added to the public index.",
                    );
                    return;
                }
                const errors = publicLibraryPublishPolicyErrors(entry);
                if (errors.length) {
                    showNotice("Public Metadata Required", errors.join("\n"));
                    return;
                }
                const result = await addEntriesToPublicLibraryIndex([entry]);
                showNotice(
                    "Public Library Updated",
                    `Added ${entry.name} to the public metadata index.`,
                );
            } catch (err) {
                showNotice("Public Publish Failed", err.message || String(err));
            } finally {
                setStatus("Ready");
            }
        }

        function publicLibraryStoryById(entryId) {
            const entry = publicLibraryEntryById(entryId);
            return ["story-template", "character"].includes(entry?.type) ? entry : null;
        }

        function openRatePublicStoryModal(entryId) {
            const entry = publicLibraryStoryById(entryId);
            if (!entry) {
                showNotice("Public Item Not Found", "Fetch the public library again before rating this item.");
                return;
            }
            if (!supabaseSessionAccessToken()) {
                showNotice("Sign In Required", `Sign in with Google before rating a public ${entry.type === "character" ? "character" : "story"}.`);
                openPublicLibraryAccountModal();
                return;
            }
            if (entry.owner_user_id && entry.owner_user_id === supabaseSignedInUser()?.id) {
                showNotice("Cannot Rate Your Own Item", "You cannot rate an item published by your own account.");
                return;
            }
            document.querySelectorAll("[data-public-rating-layer]").forEach(closeContainingPopup);
            const popup = openStoryLibraryLayer(`
                <h2>Rate ${escapeHtml(entry.name || "Public Item")}</h2>
                <p class="hint">Choose an integer rating from 0 through 10. You can change or remove your rating later.</p>
                <div class="public-rating-picker">
                    ${Array.from({ length: 11 }, (_, rating) => `<button type="button" class="${entry.user_rating === rating ? "active" : ""}" onclick="EmberAdventures.submitPublicStoryRating(${htmlJsArg(entry.id)},${rating})">${rating}</button>`).join("")}
                </div>
                <div class="row" style="margin-top:.8rem">
                    ${entry.user_rating == null ? "" : `<button type="button" class="danger" onclick="EmberAdventures.removePublicStoryRating(${htmlJsArg(entry.id)})">Remove Rating</button>`}
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Cancel</button>
                </div>
            `, { title: entry.type === "character" ? "Rate Character" : "Rate Story" });
            popup.box.dataset.publicRatingLayer = entry.id;
        }

        function refreshVisiblePublicLibraryResults(type = "story") {
            const isCharacter = type === "character";
            const searchState = isCharacter
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            const results = document.querySelector(
                isCharacter
                    ? `[data-character-library-results="public"]`
                    : `[data-story-library-results="public"]`,
            );
            if (!results || !Array.isArray(searchState?.items)) return;
            results.innerHTML = searchState.items
                .map(isCharacter ? publicCharacterLibraryCardHtml : publicStoryLibraryCardHtml)
                .join("");
            scheduleAutosizeLibraryCardText(results);
            const count = $(
                isCharacter
                    ? "characterLibrarySearchCount-public"
                    : "storyLibrarySearchCount-public",
            );
            if (count)
                count.textContent = libraryResultCountText(
                    searchState.items.length,
                    searchState.total ?? searchState.items.length,
                    isCharacter ? "character" : "story",
                );
            updateUnifiedLibraryResultLabel();
        }

        async function handlePublicRatingAction(action, ...args) {
            try {
                return await action(...args);
            } catch (err) {
                log("Public rating failed", err?.message || String(err), {
                    type: "system",
                    level: "error",
                });
                showNotice("Rating Not Saved", err?.message || String(err));
                return false;
            }
        }

        async function submitPublicStoryRating(entryId = "", rating = 0) {
            const entry = publicLibraryStoryById(entryId);
            if (!entry) throw new Error("Public story was not found.");
            const ratingLayer = document.querySelector(`[data-public-rating-layer="${cssEscape(entry.id)}"]`);
            const rows = await publicLibraryFetch("/rest/v1/rpc/set_library_rating", {
                method: "POST",
                body: {
                    target_item_id: entry.supabase_item_id || entry.id,
                    target_rating: publicStoryRatingFromInput(rating),
                },
            });
            const summary = rows?.[0] || {};
            entry.user_rating = publicStoryRatingFromInput(rating);
            entry.rating_total = Number(summary.rating_total ?? entry.rating_total ?? 0);
            entry.rating_count = Number(summary.rating_count ?? entry.rating_count ?? 0);
            entry.rating_average = Number(summary.rating_average ?? entry.rating_average ?? 0);
            await invalidatePublicLibrarySearchCache();
            closeContainingPopup(ratingLayer);
            refreshVisiblePublicLibraryResults(entry.type === "character" ? "character" : "story");
        }

        async function removePublicStoryRating(entryId = "") {
            const entry = publicLibraryStoryById(entryId);
            if (!entry) throw new Error("Public story was not found.");
            const ratingLayer = document.querySelector(`[data-public-rating-layer="${cssEscape(entry.id)}"]`);
            const rows = await publicLibraryFetch("/rest/v1/rpc/remove_library_rating", {
                method: "POST",
                body: { target_item_id: entry.supabase_item_id || entry.id },
            });
            const summary = rows?.[0] || {};
            entry.user_rating = null;
            entry.rating_total = Number(summary.rating_total ?? entry.rating_total ?? 0);
            entry.rating_count = Number(summary.rating_count ?? entry.rating_count ?? 0);
            entry.rating_average = Number(summary.rating_average ?? entry.rating_average ?? 0);
            await invalidatePublicLibrarySearchCache();
            closeContainingPopup(ratingLayer);
            refreshVisiblePublicLibraryResults(entry.type === "character" ? "character" : "story");
        }

        function openReportPublicStoryModal(entryId) {
            openReportPublicLibraryItemModal(entryId);
        }

        async function openPublicLibraryIndexModal() {
            const mode = app.publicLibraryViewMode || "stories";
            const query = publicLibraryQueryState();
            openModal(`
                <h2>Public Library</h2>
                <p class="hint">Search public EmberAdventures stories and characters. Downloads are imported into your local library just like file imports.</p>
                ${publicLibraryAuthControlsHtml()}
                <details class="dev-only-tool">
                    <summary>Supabase Settings</summary>
                    <label>Supabase URL <input id="publicLibrarySupabaseUrl" value="${escapeHtml(app.settings.publicLibrarySupabaseUrl || SUPABASE_PROJECT_URL)}"></label>
                    <label>Publishable key <input id="publicLibrarySupabaseAnonKey" value="${escapeHtml(app.settings.publicLibrarySupabaseAnonKey || SUPABASE_PUBLISHABLE_KEY)}"></label>
                </details>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" class="${mode === "stories" ? "primary" : ""}" onclick="EmberAdventures.setPublicLibraryViewMode('stories')">Stories</button>
                    <button type="button" class="${mode === "characters" ? "primary" : ""}" onclick="EmberAdventures.setPublicLibraryViewMode('characters')">Characters</button>
                    <button type="button" onclick="EmberAdventures.inspectOwnedPublicLibraryUploads()">My Uploads</button>
                    <button type="button" onclick="EmberAdventures.savePublicLibraryIndexSettings()">Save Settings</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Close</button>
                </div>
                <div id="publicLibraryIndexStatus" class="hint" style="margin-top:.8rem">Ready.</div>
                <h3>Public ${mode === "characters" ? "Characters" : "Stories"}</h3>
                <p class="hint">Change filters freely, then press Search or Enter. EmberAdventures does not fetch public-library data while you type.</p>
                <div class="row" style="align-items:flex-end">
                    <label style="flex:1">Search
                        <input id="publicLibraryStorySearch" type="search" placeholder="Name, source, creator..." value="${escapeHtml(query.search || query.submittedSearch || "")}" oninput="EmberAdventures.handlePublicLibrarySearchInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                    </label>
                    <label style="max-width:9rem">Page size
                        <select id="publicLibraryPageSize" onchange="EmberAdventures.setPublicLibraryPageSize(this.value)">
                            ${[10, 25, 50].map((size) => `<option value="${size}" ${Number(query.pageSize) === size ? "selected" : ""}>${size}</option>`).join("")}
                        </select>
                    </label>
                    <button type="button" class="primary" onclick="EmberAdventures.inspectPublicLibraryIndex({resetPage:true})">Search</button>
                </div>
                <div class="grid3">
                    <label>Genre
                        <input id="publicLibraryGenreFilter" value="${escapeHtml(query.filters?.genre ?? query.submittedFilters?.genre ?? "")}" placeholder="fantasy" oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                    </label>
                    <label>Source
                        <input id="publicLibrarySourceFilter" value="${escapeHtml(query.filters?.source ?? query.submittedFilters?.source ?? "")}" placeholder="original, franchise..." oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                    </label>
                    <label>Creator
                        <input id="publicLibraryCreatorFilter" value="${escapeHtml(query.filters?.creator ?? query.submittedFilters?.creator ?? "")}" placeholder="creator name" oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                    </label>
                    ${mode === "characters" ? `
                        <label>Gender
                            <input id="publicLibraryGenderFilter" value="${escapeHtml(query.filters?.gender ?? query.submittedFilters?.gender ?? "")}" placeholder="female, male, non-binary..." oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                        </label>
                        <label>Minimum age
                            <input id="publicLibraryAgeMinFilter" type="number" min="0" value="${escapeHtml(query.filters?.ageMin ?? query.submittedFilters?.ageMin ?? "")}" oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                        </label>
                        <label>Maximum age
                            <input id="publicLibraryAgeMaxFilter" type="number" min="0" value="${escapeHtml(query.filters?.ageMax ?? query.submittedFilters?.ageMax ?? "")}" oninput="EmberAdventures.handlePublicLibraryFilterInput()" onkeydown="EmberAdventures.handlePublicLibrarySearchKey(event)">
                        </label>
                    ` : ""}
                </div>
                <div id="publicLibrarySearchHint" class="hint" style="min-height:1.2em; margin-top:.25rem"></div>
                <div id="publicLibraryStoryList" class="stack">
                    <p class="hint">Press Search to view public ${mode === "characters" ? "characters" : "stories"}.</p>
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" id="publicLibraryPrevPageBtn" onclick="EmberAdventures.publicLibraryPreviousPage()" ${query.page <= 0 ? "disabled" : ""}>Previous</button>
                    <span id="publicLibraryPageLabel" class="hint">Page ${query.page + 1}</span>
                    <button type="button" id="publicLibraryNextPageBtn" onclick="EmberAdventures.publicLibraryNextPage()" ${query.lastHasNext ? "" : "disabled"}>Next</button>
                </div>
                <h3>My Public Uploads</h3>
                <p class="hint">Signed-in uploads can be hidden without deleting their payloads. Publishing the same owned story or character creates a new version.</p>
                <div id="publicLibraryOwnedList" class="stack">
                    <p class="hint">Sign in, then click My Uploads.</p>
                </div>
            `);
            renderPublicLibraryStoryList(app.publicLibraryLastIndex || null);
            renderOwnedPublicLibraryUploads(app.publicLibraryOwnedIndex || null);
        }

        function publicLibraryIndexStatus(text) {
            const el = $("publicLibraryIndexStatus");
            if (el) el.textContent = text;
            const authEl = $("publicLibraryAuthStatus");
            if (authEl) authEl.textContent = text;
            setStatus(text);
        }

        function savePublicLibraryIndexSettings() {
            if ($("publicLibrarySupabaseUrl"))
                app.settings.publicLibrarySupabaseUrl =
                    $("publicLibrarySupabaseUrl").value.trim() || SUPABASE_PROJECT_URL;
            if ($("publicLibrarySupabaseAnonKey"))
                app.settings.publicLibrarySupabaseAnonKey =
                    $("publicLibrarySupabaseAnonKey").value.trim() || SUPABASE_PUBLISHABLE_KEY;
            scheduleActiveGameSave();
            publicLibraryIndexStatus("Saved public library settings.");
        }

        function setPublicLibraryViewMode(mode = "stories") {
            app.publicLibraryViewMode = mode === "characters" ? "characters" : "stories";
            publicLibraryQueryState().page = 0;
            openPublicLibraryIndexModal();
        }

        function setPublicLibraryPageSize(value) {
            const query = publicLibraryQueryState();
            query.pageSize = Math.min(50, Math.max(1, Number(value || 25)));
            query.page = 0;
            inspectPublicLibraryIndex({ resetPage: true });
        }

        async function createEmptyPublicLibraryIndex() {
            showNotice("Supabase Public Library", "The public library is now managed by Supabase. Empty index uploads are no longer used.");
        }

        async function inspectPublicLibraryIndex(options = {}) {
            try {
                options = isPlainObject(options) ? options : {};
                const query = publicLibraryQueryState();
                if (options.resetPage) query.page = 0;
                query.search = String($("publicLibraryStorySearch")?.value ?? query.search ?? "").trim();
                query.filters = publicLibraryCleanFilters(publicLibraryFilterControlValues());
                query.submittedSearch = query.search;
                query.submittedFilters = { ...query.filters };
                if (app.publicLibrarySearchHintTimer) clearTimeout(app.publicLibrarySearchHintTimer);
                publicLibrarySearchHint("");
                savePublicLibraryIndexSettings();
                publicLibraryIndexStatus("Fetching public library...");
                const index = await fetchPublicLibraryIndex({
                    page: query.page,
                    pageSize: query.pageSize,
                    search: query.submittedSearch,
                    filters: query.submittedFilters,
                });
                app.publicLibraryLastIndex = index;
                query.lastMode = app.publicLibraryViewMode || "stories";
                query.lastCount = index.items.length;
                query.lastHasNext = index.items.length >= query.pageSize;
                renderPublicLibraryStoryList(index);
                updatePublicLibraryPaginationControls();
                publicLibraryIndexStatus(`Public library loaded. Page ${query.page + 1}. Items: ${index.items.length}. Feedback rows: ${(index.story_feedback || []).length}.`);
            } catch (err) {
                showNotice("Public Library Fetch Failed", err.message || String(err));
                publicLibraryIndexStatus("Public library fetch failed.");
            }
        }

        async function inspectOwnedPublicLibraryUploads(options = {}) {
            try {
                publicLibraryIndexStatus("Fetching your public uploads...");
                const index = await fetchOwnedPublicLibraryIndex({
                    mode: options.mode || "all",
                    page: options.page || 0,
                    pageSize: options.pageSize || 50,
                });
                app.publicLibraryOwnedIndex = index;
                renderOwnedPublicLibraryUploads(index);
                publicLibraryIndexStatus(`Your public uploads loaded. Items: ${index.items.length}.`);
                return index;
            } catch (err) {
                showNotice("My Uploads Failed", err.message || String(err));
                publicLibraryIndexStatus("My Uploads fetch failed.");
                return null;
            }
        }

        function ownedPublicLibraryEntryById(entryId = "") {
            const id = String(entryId || "");
            return [
                ...(app.publicLibraryOwnedIndex?.items || []),
                ...(app.characterLibraryOwnedCharacterEntries || []),
                ...(app.storyLibraryOwnedStoryEntries || []),
            ].find(
                (item) =>
                    String(item.supabase_item_id || item.id || "") === id,
            ) || null;
        }

        function showPublicLibraryUpdateInstructions(entryId = "") {
            const entry = ownedPublicLibraryEntryById(entryId) || publicLibraryEntryById(entryId);
            const isCharacter = entry?.type === "character";
            const type = isCharacter ? "character" : "story";
            showNotice(
                "How to Publish an Update",
                `To publish an updated/new version of a ${type}, just use the Publish button on that ${type} again from your library and it will publish a new version and make it the default one.`,
            );
        }

        function updateOwnedPublicLibraryVisibility(entryId = "", visibility = "public") {
            const id = String(entryId || "");
            const lists = [
                app.publicLibraryOwnedIndex?.items,
                app.characterLibraryOwnedCharacterEntries,
                app.storyLibraryOwnedStoryEntries,
            ];
            for (const list of lists) {
                if (!Array.isArray(list)) continue;
                for (const item of list)
                    if (String(item.supabase_item_id || item.id || "") === id)
                        item.visibility = visibility;
            }
            if (Array.isArray(app.publicLibraryLastIndex?.items)) {
                if (visibility === "hidden")
                    app.publicLibraryLastIndex.items =
                        app.publicLibraryLastIndex.items.filter(
                            (item) =>
                                String(item.supabase_item_id || item.id || "") !== id,
                        );
                else {
                    const publicEntry = app.publicLibraryLastIndex.items.find(
                        (item) =>
                            String(item.supabase_item_id || item.id || "") === id,
                    );
                    if (publicEntry) publicEntry.visibility = visibility;
                }
            }

            const characterTarget = document.querySelector(
                "[data-character-library-published-results='mine']",
            );
            if (characterTarget)
                renderCharacterLibraryOwnedPublicCharacters();

            const storyTarget = document.querySelector(
                "[data-story-library-published-results='mine']",
            );
            if (storyTarget)
                storyTarget.innerHTML = storyLibrarySortPublicEntries(
                    app.storyLibraryOwnedStoryEntries || [],
                    "mine",
                )
                    .map((item) => publicStoryLibraryCardHtml(item, { owned: true }))
                    .join("");
            renderOwnedPublicLibraryUploads(app.publicLibraryOwnedIndex || null);
        }

        async function setOwnedPublicLibraryItemVisibility(entryId = "", visibility = "hidden") {
            const entry = ownedPublicLibraryEntryById(entryId) || publicLibraryEntryById(entryId);
            if (!entry?.supabase_item_id && !entry?.id) {
                showNotice("Public Item Not Found", "Refresh My Uploads and try again.");
                return;
            }
            const nextVisibility = visibility === "public" ? "public" : "hidden";
            try {
                setStatus(nextVisibility === "public" ? "Making public..." : "Hiding public item...");
                const raw = await publicLibraryFetch(
                    "/rest/v1/rpc/set_owned_library_item_visibility",
                    {
                        method: "POST",
                        body: {
                            target_item_id: entry.supabase_item_id || entry.id,
                            target_visible: nextVisibility === "public",
                        },
                    },
                );
                const state = exactOwnedPublicLibraryVersionState(raw);
                applyOwnedPublicLibraryVersionState(state);
                await invalidatePublicLibrarySearchCache();
                updateOwnedPublicLibraryVisibility(
                    entry.supabase_item_id || entry.id,
                    nextVisibility,
                );
                if (app.publicLibraryLastIndex) renderPublicLibraryStoryList(app.publicLibraryLastIndex);
                showNotice(
                    nextVisibility === "public" ? "Public Item Restored" : "Public Item Hidden",
                    nextVisibility === "public"
                        ? `${entry.name || "Public item"} is visible in public browse again.`
                        : `${entry.name || "Public item"} is hidden from anonymous public browse. You can still see it in My Uploads.`,
                );
            } catch (err) {
                showNotice("Visibility Update Failed", err.message || String(err));
            } finally {
                setStatus("Ready");
            }
        }

        function updatePublicLibraryPaginationControls() {
            const query = publicLibraryQueryState();
            if ($("publicLibraryPrevPageBtn")) $("publicLibraryPrevPageBtn").disabled = query.page <= 0;
            if ($("publicLibraryNextPageBtn")) $("publicLibraryNextPageBtn").disabled = !query.lastHasNext;
            if ($("publicLibraryPageLabel")) $("publicLibraryPageLabel").textContent = `Page ${query.page + 1}`;
        }

        async function publicLibraryPreviousPage() {
            const query = publicLibraryQueryState();
            if (query.page <= 0) return;
            query.page -= 1;
            await inspectPublicLibraryIndex();
        }

        async function publicLibraryNextPage() {
            const query = publicLibraryQueryState();
            if (!query.lastHasNext) return;
            query.page += 1;
            await inspectPublicLibraryIndex();
        }

        function publicLibraryEntryById(entryId = "") {
            const id = String(entryId || "");
            return (app.publicLibraryLastIndex?.items || []).find((item) => String(item.id || "") === id) ||
                app.publicLibraryCuratedEntries?.[id];
        }

        async function fetchPublicLibraryVersionsForEntry(entryId = "") {
            const entry = publicLibraryEntryById(entryId) || ownedPublicLibraryEntryById(entryId);
            if (!entry) throw new Error("That public item was not found in the current library results.");
            const itemId = entry.supabase_item_id || entry.id;
            if (!itemId) throw new Error("That public item does not have a Supabase item id.");
            const rows =
                (await publicLibraryFetch(
                    `/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&item_id=eq.${postgrestValue(itemId)}&visible=eq.true&order=version_number.desc`,
                    { auth: false },
                )) || [];
            return rows.map((row, index) =>
                validateSupabasePublicVersionRow(
                    row,
                    `public_version_history.${index}`,
                ),
            );
        }

        function decodePublicLibraryVisibilityMask(encoded = "", maxVersionNumber = 0) {
            const maxVersion = Number(maxVersionNumber || 0);
            if (!Number.isSafeInteger(maxVersion) || maxVersion < 0)
                throw new Error("Compact version visibility max version must be a nonnegative safe integer.");
            let binary = "";
            try {
                binary = atob(String(encoded || ""));
            } catch {
                throw new Error("Compact version visibility mask must be valid Base64.");
            }
            const expectedBytes = Math.ceil(maxVersion / 8);
            if (binary.length !== expectedBytes)
                throw new Error(`Compact version visibility mask must contain exactly ${expectedBytes} byte${expectedBytes === 1 ? "" : "s"}.`);
            return (versionNumber) => {
                const number = Number(versionNumber || 0);
                if (!Number.isSafeInteger(number) || number < 1 || number > maxVersion) return false;
                const offset = number - 1;
                return !!(binary.charCodeAt(Math.floor(offset / 8)) & (1 << (offset % 8)));
            };
        }

        function exactOwnedPublicLibraryVersionState(raw = {}, path = "owned_public_version_state") {
            if (!raw || typeof raw !== "object" || Array.isArray(raw))
                throw new Error(`${path} must be an object.`);
            const allowed = new Set(["i", "c", "p", "n", "m", "v", "d"]);
            for (const field of Object.keys(raw))
                if (!allowed.has(field)) throw new Error(`${path}.${field} is not an approved field.`);
            for (const field of allowed)
                if (!Object.hasOwn(raw, field)) throw new Error(`${path}.${field} is required.`);
            if (typeof raw.i !== "string" || !raw.i)
                throw new Error(`${path}.i must be non-empty text.`);
            if (raw.c !== null && (typeof raw.c !== "string" || !raw.c))
                throw new Error(`${path}.c must be non-empty text or null.`);
            if (typeof raw.p !== "boolean") throw new Error(`${path}.p must be true or false.`);
            if (!Number.isSafeInteger(raw.n) || raw.n < 0 || raw.n > 65535)
                throw new Error(`${path}.n must be an integer from 0 through 65535.`);
            if (typeof raw.m !== "string") throw new Error(`${path}.m must be Base64 text.`);
            if (!Array.isArray(raw.v)) throw new Error(`${path}.v must be an array.`);
            const isVisible = decodePublicLibraryVisibilityMask(raw.m, raw.n);
            const versionIds = new Set();
            const versionNumbers = new Set();
            const versions = raw.v.map((value, index) => {
                if (!Array.isArray(value) || value.length !== 8)
                    throw new Error(`${path}.v.${index} must contain exactly 8 values.`);
                const row = {
                    id: value[0],
                    item_id: raw.i,
                    version_number: value[1],
                    payload_url: value[2],
                    payload_sha256: value[3],
                    payload_size_bytes: value[4],
                    image_url: value[5],
                    metadata_snapshot: null,
                    change_summary: value[6],
                    created_at: value[7],
                };
                validateSupabasePublicVersionRow(row, `${path}.v.${index}`);
                if (row.version_number > raw.n)
                    throw new Error(`${path}.v.${index}.version_number exceeds the visibility mask range.`);
                if (versionIds.has(row.id)) throw new Error(`${path}.v contains duplicate version id ${row.id}.`);
                if (versionNumbers.has(row.version_number))
                    throw new Error(`${path}.v contains duplicate version number ${row.version_number}.`);
                versionIds.add(row.id);
                versionNumbers.add(row.version_number);
                row.visible = raw.p && isVisible(row.version_number);
                return row;
            });
            if (raw.c !== null && !versionIds.has(raw.c))
                throw new Error(`${path}.c must identify one of the returned versions.`);
            const currentVersion = versions.find((version) => version.id === raw.c);
            if (raw.p && (!currentVersion || !currentVersion.visible))
                throw new Error(`${path} cannot be public without a visible current version.`);
            const item = validateSupabasePublicItemRow(raw.d, `${path}.d`);
            if (item.id !== raw.i)
                throw new Error(`${path}.d.id must exactly match ${path}.i.`);
            if (item.current_version_id !== raw.c)
                throw new Error(`${path}.d.current_version_id must exactly match ${path}.c.`);
            if ((item.visibility === "public") !== raw.p)
                throw new Error(`${path}.d.visibility must exactly match ${path}.p.`);
            return {
                itemId: raw.i,
                currentVersionId: raw.c,
                public: raw.p,
                versions,
                item,
            };
        }

        function publicLibraryVersionConsistencyReport(state = {}, resolvedEntry = {}) {
            const item = state.item || {};
            const versions = Array.isArray(state.versions) ? state.versions : [];
            const visibleVersions = versions
                .filter((version) => version.visible === true)
                .sort((left, right) =>
                    Number(right.version_number || 0) - Number(left.version_number || 0),
                );
            const newestVisible = visibleVersions[0] || null;
            const currentVersion = versions.find(
                (version) => String(version.id || "") === String(state.currentVersionId || ""),
            ) || null;
            const issues = [];
            if (String(item.current_version_id || "") !== String(state.currentVersionId || ""))
                issues.push("item current_version_id differs from RPC current version");
            if (
                state.public === true &&
                String(newestVisible?.id || "") !== String(state.currentVersionId || "")
            )
                issues.push("public item current version is not the newest visible version");
            if (
                currentVersion?.image_url &&
                resolvedEntry?.image_url &&
                String(currentVersion.image_url) !== String(resolvedEntry.image_url)
            )
                issues.push("resolved entry image differs from current version image");
            if (
                currentVersion?.image_url &&
                ![
                    item.male_image_url,
                    item.non_male_image_url,
                ].filter(Boolean).includes(currentVersion.image_url)
            )
                issues.push("item presentation images omit the current version image");
            return {
                itemId: String(state.itemId || item.id || ""),
                currentVersionId: String(state.currentVersionId || ""),
                currentVersionNumber: currentVersion?.version_number || null,
                newestVisibleVersionId: String(newestVisible?.id || ""),
                newestVisibleVersionNumber: newestVisible?.version_number || null,
                visibleVersions: visibleVersions.map((version) => ({
                    id: String(version.id || ""),
                    versionNumber: version.version_number,
                    imageUrl: String(version.image_url || ""),
                })),
                itemPresentationImageUrls: {
                    male: String(item.male_image_url || ""),
                    nonMale: String(item.non_male_image_url || ""),
                },
                resolvedImageUrl: String(resolvedEntry?.image_url || ""),
                issues,
            };
        }

        function logPublicLibraryVersionConsistency(state = {}, resolvedEntry = {}, stage = "") {
            const report = publicLibraryVersionConsistencyReport(state, resolvedEntry);
            log(
                "Public library version consistency check",
                `${stage || "version state loaded"}: ${report.issues.length ? report.issues.join("; ") : "OK"}`,
                {
                    type: "system",
                    level: "message",
                    details: report,
                },
            );
            return report;
        }

        function ownedPublicLibraryVersionStateCacheKey(entry = {}) {
            const ownerId = String(supabaseSignedInUser?.()?.id || "signed-in");
            const itemId = String(entry.supabase_item_id || entry.id || "");
            return `${ownerId}:${itemId}`;
        }

        async function fetchOwnedPublicLibraryVersionState(entryId = "", options = {}) {
            const entry = ownedPublicLibraryEntryById(entryId) || publicLibraryEntryById(entryId);
            if (!entry) throw new Error("That owned public item was not found.");
            const itemId = entry.supabase_item_id || entry.id;
            const cacheKey = ownedPublicLibraryVersionStateCacheKey(entry);
            const cached = app.ownedPublicLibraryVersionStateCache?.[cacheKey];
            const expectedCurrentVersionId = String(entry.supabase_current_version_id || "");
            if (
                options.refresh !== true &&
                cached &&
                (!expectedCurrentVersionId || String(cached.currentVersionId || "") === expectedCurrentVersionId)
            )
                return clone(cached);
            const raw = await publicLibraryFetch("/rest/v1/rpc/owned_library_version_state", {
                method: "POST",
                body: { target_item_id: itemId },
            });
            return exactOwnedPublicLibraryVersionState(raw);
        }

        async function resolveOwnedPublicLibraryDetailPreview(entryId = "") {
            const entry = ownedPublicLibraryEntryById(entryId);
            if (!entry) throw new Error("That owned public item was not found.");
            const state = await fetchOwnedPublicLibraryVersionState(entryId);
            applyOwnedPublicLibraryVersionState(state);
            const currentVersion = state.versions.find(
                (version) => String(version.id || "") === String(state.currentVersionId || ""),
            ) || null;
            const version = currentVersion || [...state.versions].sort(
                (left, right) => Number(right.version_number || 0) - Number(left.version_number || 0),
            )[0] || null;
            if (!version?.payload_url)
                throw new Error("No hosted revision is available for this published item.");
            const currentEntry = ownedPublicLibraryEntryById(entryId) || entry;
            return {
                entry: {
                    ...clone(currentEntry),
                    url: version.payload_url,
                    image_url: version.image_url || currentEntry.image_url || "",
                    payload_sha256: version.payload_sha256,
                    payload_size_bytes: version.payload_size_bytes,
                },
                state,
                version,
                hiddenPreview: state.public !== true,
            };
        }

        function ownedPublicLibraryHiddenPreviewHtml(preview = null) {
            if (!preview?.hiddenPreview) return "";
            return `<div class="panel hint" style="margin-bottom:.8rem" data-owned-hidden-version-preview>All versions are hidden. Previewing Version ${escapeHtml(preview.version?.version_number || "?")} as the publisher.</div>`;
        }

        function patchPublicLibraryEntryList(list, resolvedEntry, visible, options = {}) {
            if (!Array.isArray(list)) return false;
            const id = String(resolvedEntry?.supabase_item_id || resolvedEntry?.id || "");
            const index = list.findIndex(
                (item) => String(item.supabase_item_id || item.id || "") === id,
            );
            if (index < 0) return false;
            if (!visible && options.publicOnly) list.splice(index, 1);
            else Object.assign(list[index], clone(resolvedEntry));
            return true;
        }

        function publicLibraryEntryMatchesSubmittedFilters(
            entry = {},
            filters = {},
            eligibility = {},
        ) {
            const searchText = [
                entry.title,
                entry.name,
                entry.male_name,
                entry.non_male_name,
                entry.description,
                entry.creator,
                ...(entry.genres || []),
            ].filter(Boolean).join(" ");
            if (
                filters.search &&
                !String(searchText).toLowerCase().includes(
                    String(filters.search).trim().toLowerCase(),
                )
            ) return false;
            if (
                filters.creator &&
                !String(entry.creator || "").toLowerCase().includes(
                    String(filters.creator).trim().toLowerCase(),
                )
            ) return false;
            if (
                filters.creation_tool &&
                !String(entry.creation_tool || "").toLowerCase().includes(
                    String(filters.creation_tool).trim().toLowerCase(),
                )
            ) return false;
            if (
                filters.source &&
                !String(entry.source || "").toLowerCase().includes(
                    String(filters.source).trim().toLowerCase(),
                )
            ) return false;
            const genres = new Set(publicTagListSlot(entry.genres || []));

            if (!publicTagListSlot(filters.genres || []).every((tag) => genres.has(tag)))
                return false;

            return true;
        }

        function publicLibraryCacheKeyCriteria(cacheKey = "") {
            try {
                const parsed = JSON.parse(String(cacheKey || ""));
                return isPlainObject(parsed) ? parsed : null;
            } catch {
                return null;
            }
        }

        function patchPublicLibrarySearchCaches(resolvedEntry, visible) {
            const entryId = String(
                resolvedEntry?.supabase_item_id || resolvedEntry?.id || "",
            );
            const isCharacter = resolvedEntry.type === "character";
            const searchState = isCharacter
                ? app.characterLibraryPublicSearch
                : app.storyLibraryPublicSearch;
            app.hiddenPublicLibraryCacheMembership ||= {};
            const membership = app.hiddenPublicLibraryCacheMembership[entryId] || {
                lastIndex: false,
                activeSearch: false,
                cacheKeys: [],
            };
            const patchTrackedList = (
                list,
                membershipField,
                matchesSubmittedFilters = false,
            ) => {
                if (
                    visible &&
                    (membership[membershipField] || matchesSubmittedFilters)
                ) {
                    upsertPublicLibraryEntryList(list, resolvedEntry);
                    return;
                }
                if (!visible) {
                    const hadEntry = patchPublicLibraryEntryList(
                        list,
                        resolvedEntry,
                        false,
                        { publicOnly: true },
                    );
                    if (hadEntry) membership[membershipField] = true;
                    return;
                }
                patchPublicLibraryEntryList(list, resolvedEntry, true, {
                    publicOnly: true,
                });
            };
            patchTrackedList(app.publicLibraryLastIndex?.items, "lastIndex", true);
            patchTrackedList(
                searchState?.items,
                "activeSearch",
                publicLibraryEntryMatchesSubmittedFilters(
                    resolvedEntry,
                    searchState?.filters || {},
                    {},
                ),
            );
            for (const [cacheKey, cached] of Object.entries(
                publicLibrarySearchCache().entries || {},
            )) {
                const criteria = publicLibraryCacheKeyCriteria(cacheKey);
                if (
                    visible &&
                    (
                        membership.cacheKeys.includes(cacheKey) ||
                        (
                            criteria?.itemType === (isCharacter ? "character" : "story") &&
                            publicLibraryEntryMatchesSubmittedFilters(
                                resolvedEntry,
                                criteria.filters || {},
                                criteria.eligibility || {},
                            )
                        )
                    )
                ) {
                    upsertPublicLibraryEntryList(cached.items, resolvedEntry);
                    continue;
                }
                if (!visible) {
                    const hadEntry = patchPublicLibraryEntryList(
                        cached.items,
                        resolvedEntry,
                        false,
                        { publicOnly: true },
                    );
                    if (hadEntry && !membership.cacheKeys.includes(cacheKey))
                        membership.cacheKeys.push(cacheKey);
                    continue;
                }
                patchPublicLibraryEntryList(cached.items, resolvedEntry, true, {
                    publicOnly: true,
                });
            }
            if (visible) delete app.hiddenPublicLibraryCacheMembership[entryId];
            else app.hiddenPublicLibraryCacheMembership[entryId] = membership;
            Promise.resolve(savePublicLibrarySearchCache()).catch((error) => {
                log(
                    "Public library cache update failed",
                    error?.message || String(error),
                    {
                        type: "storage",
                        level: "warn",
                    },
                );
            });
            refreshVisiblePublicLibraryResults(isCharacter ? "character" : "story");
        }

        function applyOwnedPublicLibraryVersionState(state = {}) {
            const currentVersion = (state.versions || []).find(
                (version) => String(version.id || "") === String(state.currentVersionId || ""),
            );
            if (state.currentVersionId !== null && state.currentVersionId !== "" && !currentVersion)
                throw new Error("Owned public version state did not include its current version.");
            const previewVersion = currentVersion || [...(state.versions || [])].sort(
                (left, right) => Number(right.version_number || 0) - Number(left.version_number || 0),
            )[0] || null;
            const existingEntry =
                ownedPublicLibraryEntryById(state.itemId) ||
                publicLibraryEntryById(state.itemId) ||
                {
                    id: state.itemId,
                    supabase_item_id: state.itemId,
                    type: state.item?.type === "story" ? "story-template" : "character",
                };
            const wasPublic = existingEntry.visibility === "public";
            let resolvedEntry = null;
            if (previewVersion) {
                const previewVersionRow = clone(previewVersion);
                delete previewVersionRow.visible;
                resolvedEntry = ownedPublicLibraryEntryFromVersionPreview(
                    state.item,
                    previewVersionRow,
                );
            }
            logPublicLibraryVersionConsistency(
                state,
                resolvedEntry || existingEntry,
                "owner visibility state applied",
            );
            const lists = [
                app.publicLibraryOwnedIndex?.items,
                app.characterLibraryOwnedCharacterEntries,
                app.storyLibraryOwnedStoryEntries,
            ];
            for (const list of lists) {
                if (resolvedEntry) {
                    patchPublicLibraryEntryList(list, resolvedEntry, true);
                    continue;
                }
                if (!Array.isArray(list)) continue;
                const item = list.find(
                    (candidate) =>
                        String(candidate.supabase_item_id || candidate.id || "") ===
                        String(state.itemId || ""),
                );
                if (item)
                    Object.assign(item, {
                        visibility: "hidden",
                        supabase_current_version_id: "",
                    });
            }
            patchPublicLibrarySearchCaches(
                resolvedEntry || existingEntry,
                state.public,
            );
            if (wasPublic !== (state.public === true)) {
                const type = state.item?.type === "story" ? "story" : "character";
                const delta = state.public ? 1 : -1;
                app.publicLibraryTotalItemCounts ||= {};
                if (Number.isSafeInteger(app.publicLibraryTotalItemCounts[type]))
                    app.publicLibraryTotalItemCounts[type] = Math.max(
                        0,
                        app.publicLibraryTotalItemCounts[type] + delta,
                    );
                const searchState = type === "character"
                    ? app.characterLibraryPublicSearch
                    : app.storyLibraryPublicSearch;
                if (Number.isSafeInteger(searchState?.total))
                    searchState.total = Math.max(0, searchState.total + delta);
                refreshVisiblePublicLibraryResults(type);
            }
            updateOwnedPublicLibraryVisibility(
                state.itemId,
                state.public ? "public" : "hidden",
            );
            app.publicLibraryVersionHistory ||= {};
            app.publicLibraryVersionHistory[state.itemId] = state.versions;
            const entry = ownedPublicLibraryEntryById(state.itemId) || publicLibraryEntryById(state.itemId) || {
                id: state.itemId,
            };
            app.ownedPublicLibraryVersionStateCache ||= {};
            app.ownedPublicLibraryVersionStateCache[ownedPublicLibraryVersionStateCacheKey(entry)] = clone(state);
        }

        function publicLibraryVersionRowsHtml(entry = {}, versions = []) {
            if (!versions.length) return `<p class="hint">No version history was found for this item.</p>`;
            return versions
                .map((version) => {
                    const versionNumber = publicLibraryRequiredText(version.version_number || version.version) || "?";
                    const created = publicLibraryRequiredText(version.created_at) || "unknown date";
                    const summary = publicLibraryRequiredText(version.change_summary) || "No change summary.";
                    const payloadUrl = publicLibraryRequiredText(version.payload_url);
                    const currentBadge =
                        String(version.id || "") === String(entry.supabase_current_version_id || "")
                            ? ` <span class="profile-select-status">Current</span>`
                            : "";
                    return `
                        <div class="stat-card">
                            <div class="character-name">Version ${escapeHtml(versionNumber)}${currentBadge}</div>
                            <div class="hint">${escapeHtml(created)}</div>
                            <p class="hint">${escapeHtml(summary)}</p>
                            ${payloadUrl ? `<div class="hint">Payload available</div>` : `<div class="hint">Payload missing</div>`}
                            <div class="row" style="margin-top:.55rem">
                                <button type="button" class="primary" ${payloadUrl ? "" : "disabled"} onclick="EmberAdventures.importPublicLibraryEntryVersion(${htmlJsArg(entry.id)}, ${htmlJsArg(version.id || "")})">Download This Version</button>
                            </div>
                        </div>
                    `;
                })
                .join("");
        }

        function ownedPublicLibraryVersionRowsHtml(entry = {}, versions = []) {
            if (!versions.length) return `<p class="hint">No versions were found for this item.</p>`;
            return versions
                .map((version) => {
                    const current = String(version.id || "") === String(entry.supabase_current_version_id || "");
                    return `
                        <div class="stat-card" data-owned-public-version="${escapeHtml(version.id || "")}">
                            <div class="character-name">Version ${escapeHtml(version.version_number)}${current ? ` <span class="profile-select-status">Default</span>` : ""}</div>
                            <div class="hint">${escapeHtml(publicLibraryRequiredText(version.created_at) || "unknown date")}</div>
                            <p class="hint">${escapeHtml(publicLibraryRequiredText(version.change_summary) || "No change summary.")}</p>
                            ${entry.type === "character" ? `
                                <div class="row" style="margin-top:.55rem">
                                    <button type="button" class="public-version-view-button" onclick="EmberAdventures.openOwnedPublicCharacterVersionDetail(${htmlJsArg(entry.id)}, ${htmlJsArg(version.id)}, this)">View</button>
                                </div>
                            ` : ""}
                            <div class="public-version-visibility-controls" role="group" aria-label="Version ${escapeHtml(version.version_number)} visibility">
                                <button type="button" class="public-version-show-button" aria-pressed="${version.visible ? "true" : "false"}" onclick="EmberAdventures.setOwnedPublicLibraryVersionVisibility(${htmlJsArg(entry.id)}, ${htmlJsArg(version.id)}, true)">Show${version.visible ? " &#10003;" : ""}</button>
                                <button type="button" class="public-version-hide-button" aria-pressed="${version.visible ? "false" : "true"}" onclick="EmberAdventures.setOwnedPublicLibraryVersionVisibility(${htmlJsArg(entry.id)}, ${htmlJsArg(version.id)}, false)">Hide${version.visible ? "" : " &#10003;"}</button>
                            </div>
                        </div>
                    `;
                })
                .join("");
        }

        const ownedPublicLibraryVersionVisibilityPending = new Set();
        const ownedPublicLibraryVersionVisibilitySettled = new Map();

        function ownedPublicLibraryVersionManagerKey(entry = {}) {
            return String(entry.supabase_item_id || entry.id || "");
        }

        function ownedPublicLibraryVersionManagers(entryKey = "") {
            const key = String(entryKey || "");
            return [...document.querySelectorAll("[data-owned-public-version-manager]")]
                .filter((manager) => String(manager.dataset.ownedPublicEntryId || "") === key);
        }

        function setOwnedPublicLibraryVersionStatus(status, message = "", busy = false) {
            if (!status) return;
            status.classList.toggle("owned-public-version-status-busy", busy);
            status.setAttribute("aria-live", "polite");
            status.setAttribute("aria-busy", busy ? "true" : "false");
            status.innerHTML = busy
                ? `<span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`
                : escapeHtml(message);
        }

        function setOwnedPublicLibraryVersionManagersBusy(entryKey = "", busy = false) {
            for (const manager of ownedPublicLibraryVersionManagers(entryKey)) {
                manager.dataset.visibilityPending = busy ? "true" : "false";
                for (const controls of manager.querySelectorAll(
                    ".public-version-visibility-controls",
                )) controls.setAttribute("aria-disabled", busy ? "true" : "false");
                for (const button of manager.querySelectorAll(
                    ".public-version-view-button, .public-version-show-button, .public-version-hide-button",
                )) button.disabled = busy;
            }
        }

        async function openOwnedPublicCharacterVersionDetail(
            entryId = "",
            versionId = "",
            sourceButton = null,
        ) {
            if (sourceButton) closeContainingPopup(sourceButton);
            return openPublicCharacterLibraryDetail(entryId, "public", versionId);
        }

        async function openOwnedPublicLibraryVersionManager(entryId = "", sourceButton = null) {
            const entry = ownedPublicLibraryEntryById(entryId);
            if (!entry) {
                showNotice("Public Item Not Found", "Refresh your published items and try again.");
                return;
            }
            if (sourceButton?.closest?.("[data-public-character-detail]"))
                closeContainingPopup(sourceButton);
            const popup = openStoryLibraryLayer(`
                <h2>Manage Published Versions</h2>
                <p class="hint">${escapeHtml(entry.name || "Untitled public item")}</p>
                <div id="ownedPublicVersionStatus" class="hint owned-public-version-status" role="status">Fetching versions...</div>
                <div id="ownedPublicVersionList" class="stack"></div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                </div>
            `, { title: "Manage Published Versions", attr: "data-owned-public-version-manager" });
            const entryKey = ownedPublicLibraryVersionManagerKey(entry);
            if (popup.box) popup.box.dataset.ownedPublicEntryId = entryKey;
            if (ownedPublicLibraryVersionVisibilityPending.has(entryKey)) {
                setOwnedPublicLibraryVersionManagersBusy(entryKey, true);
                setOwnedPublicLibraryVersionStatus(
                    popup.box?.querySelector?.("#ownedPublicVersionStatus"),
                    "Updating version visibility...",
                    true,
                );
            }
            try {
                const state = await fetchOwnedPublicLibraryVersionState(entry.id);
                applyOwnedPublicLibraryVersionState(state);
                const list = popup.box?.querySelector?.("#ownedPublicVersionList");
                if (list) list.innerHTML = ownedPublicLibraryVersionRowsHtml(entry, state.versions);
                const status = popup.box?.querySelector?.("#ownedPublicVersionStatus");
                const pending = ownedPublicLibraryVersionVisibilityPending.has(entryKey);
                setOwnedPublicLibraryVersionManagersBusy(entryKey, pending);
                setOwnedPublicLibraryVersionStatus(
                    status,
                    pending
                        ? "Updating version visibility..."
                        : `${state.versions.length} version${state.versions.length === 1 ? "" : "s"}. ${state.public ? "At least one version is public." : "All versions are hidden."}`,
                    pending,
                );
            } catch (err) {
                const status = popup.box?.querySelector?.("#ownedPublicVersionStatus");
                setOwnedPublicLibraryVersionStatus(
                    status,
                    "Version management fetch failed.",
                );
                const list = popup.box?.querySelector?.("#ownedPublicVersionList");
                if (list) list.innerHTML = `<p class="hint">${escapeHtml(err.message || String(err))}</p>`;
                if (devSmokeSuiteState().running) throw err;
            }
        }

        async function setOwnedPublicLibraryVersionVisibility(entryId = "", versionId = "", visible = true) {
            const entry = ownedPublicLibraryEntryById(entryId);
            if (!entry) {
                showNotice("Public Item Not Found", "Refresh your published items and try again.");
                return;
            }
            const entryKey = ownedPublicLibraryVersionManagerKey(entry);
            if (ownedPublicLibraryVersionVisibilityPending.has(entryKey)) return null;
            ownedPublicLibraryVersionVisibilityPending.add(entryKey);
            let settleVisibilityOperation = null;
            ownedPublicLibraryVersionVisibilitySettled.set(
                entryKey,
                new Promise((resolve) => {
                    settleVisibilityOperation = resolve;
                }),
            );
            setOwnedPublicLibraryVersionManagersBusy(entryKey, true);
            const manager = ownedPublicLibraryVersionManagers(entryKey).at(-1);
            const status = manager?.querySelector?.("#ownedPublicVersionStatus");
            try {
                setOwnedPublicLibraryVersionStatus(
                    status,
                    visible ? "Showing version..." : "Hiding version...",
                    true,
                );
                if (visible) {
                    let versions = app.publicLibraryVersionHistory?.[entry.id] || [];
                    let version = versions.find(
                        (item) => String(item.id || "") === String(versionId || ""),
                    );
                    if (!version) {
                        const before = await fetchOwnedPublicLibraryVersionState(entry.id);
                        versions = before.versions;
                        version = versions.find(
                            (item) => String(item.id || "") === String(versionId || ""),
                        );
                    }
                    if (!version) throw new Error("The selected public version was not found.");
                    setOwnedPublicLibraryVersionStatus(
                        status,
                        "Verifying hosted files before showing version...",
                        true,
                    );
                    const payload = await fetchVerifiedPublicLibraryPayload({
                        ...entry,
                        url: version.payload_url,
                        payload_sha256: version.payload_sha256,
                        payload_size_bytes: version.payload_size_bytes,
                    });
                    await verifyPublicHostedImageManifest(
                        publicHostedImageManifestFromPayload(payload, entry.type),
                        {
                            label: `${entry.name || "Public item"} version ${version.version_number}`,
                            onStatus: (message) => {
                                setOwnedPublicLibraryVersionStatus(status, message, true);
                            },
                        },
                    );
                }
                const raw = await publicLibraryFetch("/rest/v1/rpc/set_owned_library_version_visibility", {
                    method: "POST",
                    body: {
                        target_version_id: versionId,
                        target_visible: visible === true,
                    },
                });
                const state = exactOwnedPublicLibraryVersionState(raw);
                if (state.itemId !== String(entry.supabase_item_id || entry.id || ""))
                    throw new Error("The visibility update returned state for the wrong public item.");
                applyOwnedPublicLibraryVersionState(state);
                for (const currentManager of ownedPublicLibraryVersionManagers(entryKey)) {
                    const list = currentManager.querySelector?.("#ownedPublicVersionList");
                    if (list)
                        list.innerHTML = ownedPublicLibraryVersionRowsHtml(
                            entry,
                            state.versions,
                        );
                    setOwnedPublicLibraryVersionStatus(
                        currentManager.querySelector?.("#ownedPublicVersionStatus"),
                        `${state.versions.length} version${state.versions.length === 1 ? "" : "s"}. ${state.public ? "At least one version is public." : "All versions are hidden."}`,
                    );
                }
                return state;
            } catch (err) {
                for (const currentManager of ownedPublicLibraryVersionManagers(entryKey))
                    setOwnedPublicLibraryVersionStatus(
                        currentManager.querySelector?.("#ownedPublicVersionStatus"),
                        "Visibility update failed.",
                    );
                log(
                    "Public version visibility update failed",
                    prettyJson({
                        entryId: String(entryId || ""),
                        versionId: String(versionId || ""),
                        visible: visible === true,
                        message: err?.message || String(err),
                        stack: err?.stack || "",
                    }),
                    { type: "troubleshooting", level: "error" },
                );
                showNotice("Visibility Update Failed", err.message || String(err));
                if (devSmokeSuiteState().running) throw err;
                return null;
            } finally {
                ownedPublicLibraryVersionVisibilityPending.delete(entryKey);
                setOwnedPublicLibraryVersionManagersBusy(entryKey, false);
                settleVisibilityOperation?.();
                ownedPublicLibraryVersionVisibilitySettled.delete(entryKey);
            }
        }

        async function openPublicLibraryVersionHistoryModal(entryId = "") {
            const entry = publicLibraryEntryById(entryId) || ownedPublicLibraryEntryById(entryId);
            if (!entry) {
                showNotice("Public Item Not Found", "Refresh the public library and try again.");
                return;
            }
            const popup = openStoryLibraryLayer(`
                <h2>Version History</h2>
                <p class="hint">${escapeHtml(entry.name || "Untitled public item")}</p>
                <div id="publicLibraryVersionHistoryStatus" class="hint">Fetching versions...</div>
                <div id="publicLibraryVersionHistoryList" class="stack"></div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                </div>
            `, { title: "Version History", attr: "data-public-library-version-history" });
            try {
                const versions = await fetchPublicLibraryVersionsForEntry(entry.id);
                app.publicLibraryVersionHistory ||= {};
                app.publicLibraryVersionHistory[entry.id] = versions;
                const list = popup.box?.querySelector?.("#publicLibraryVersionHistoryList");
                if (list) list.innerHTML = publicLibraryVersionRowsHtml(entry, versions);
                const status = popup.box?.querySelector?.("#publicLibraryVersionHistoryStatus");
                if (status) status.textContent = `Loaded ${versions.length} version${versions.length === 1 ? "" : "s"}.`;
            } catch (err) {
                const status = popup.box?.querySelector?.("#publicLibraryVersionHistoryStatus");
                if (status) status.textContent = "Version history fetch failed.";
                const list = popup.box?.querySelector?.("#publicLibraryVersionHistoryList");
                if (list) list.innerHTML = `<p class="hint">${escapeHtml(err.message || String(err))}</p>`;
            }
        }

        async function importPublicLibraryEntry(entryId = "", options = {}) {
            const entry = publicLibraryEntryById(entryId) || ownedPublicLibraryEntryById(entryId);
            if (!entry) {
                if (options.showNotice !== false)
                    showNotice("Public Item Not Found", "Refresh the public library and try again.");
                return;
            }
            if (!entry.url) {
                if (options.showNotice !== false)
                    showNotice("Public Item Missing Payload", "This public item does not have a downloadable payload URL.");
                return;
            }
            const activityId = beginActivityTask("Downloading", {
                priority: 85,
                kind: "import",
            });
            try {
                setStatus("Downloading public item...");
                const payload = entry.curated
                    ? await fetchJsonFromPublicUploadUrl(entry.url)
                    : await fetchVerifiedPublicLibraryPayload(entry);
                if (entry.type === "story-template") {
                    await importStoryTemplatePayload(payload, {
                        title: "Public Story Imported",
                        openLibrary: options.openLibrary,
                        persist: options.persist,
                        showNotice: options.showNotice,
                        awaitTitleCardPreparation:
                            options.awaitTitleCardPreparation === true,
                    });
                } else {
                    const records = characterImportRecordsFromExport(payload);
                    const imported = await importCharacterDefinitionsFromRecords(
                        records,
                        characterLibraryMetadataFromPublicEntry(entry),
                        { replaceMatchingDefinition: true },
                    );
                    setStatus("Ready");
                    if (options.showNotice !== false)
                        showNotice("Public Item Imported", `${entry.name || "Public item"} was imported into your local library.`);
                    return imported;
                }
                setStatus("Ready");
                if (options.showNotice !== false)
                    showNotice("Public Item Imported", `${entry.name || "Public item"} was imported into your local library.`);
            } catch (err) {
                setStatus("Ready");
                logImportException("Public import failed", err, {
                    entryId: String(entry.id || "").trim(),
                    entryType: String(entry.type || "").trim(),
                    entryName: String(entry.name || "").trim(),
                    payloadUrl: String(entry.url || "").trim(),
                    requestKind: "public-library-import",
                });
                if (options.showNotice !== false)
                    showNotice("Public Import Failed", err.message || String(err));
            } finally {
                endActivityTask(activityId);
            }
        }

        async function importPublicLibraryEntryVersion(entryId = "", versionId = "", options = {}) {
            const entry = publicLibraryEntryById(entryId) || ownedPublicLibraryEntryById(entryId);
            if (!entry) {
                if (options.showNotice !== false)
                    showNotice("Public Item Not Found", "Refresh the public library and try again.");
                return;
            }
            const cached = app.publicLibraryVersionHistory?.[entry.id] || [];
            let version = cached.find((item) => String(item.id || "") === String(versionId || ""));
            if (!version) {
                const versions = await fetchPublicLibraryVersionsForEntry(entry.id);
                app.publicLibraryVersionHistory ||= {};
                app.publicLibraryVersionHistory[entry.id] = versions;
                version = versions.find((item) => String(item.id || "") === String(versionId || ""));
            }
            if (!version?.payload_url) {
                if (options.showNotice !== false)
                    showNotice("Public Version Missing Payload", "This public version does not have a downloadable payload URL.");
                return;
            }
            const activityId = beginActivityTask("Downloading", {
                priority: 85,
                kind: "import",
            });
            try {
                setStatus("Downloading public version...");
                const payload = await fetchVerifiedPublicLibraryPayload({
                    ...entry,
                    url: version.payload_url,
                    payload_sha256: version.payload_sha256,
                    payload_size_bytes: version.payload_size_bytes,
                });
                if (entry.type === "story-template") {
                    await importStoryTemplatePayload(payload, {
                        title: "Public Story Version Imported",
                        openLibrary: options.openLibrary,
                        persist: options.persist,
                        showNotice: options.showNotice,
                        awaitTitleCardPreparation:
                            options.awaitTitleCardPreparation === true,
                    });
                } else {
                    const records = characterImportRecordsFromExport(payload);
                    const versionRecords = characterImportRecordsWithVersionMetadata(
                        records,
                        version,
                        entry,
                    );
                    const imported = await importCharacterDefinitionsFromRecords(
                        versionRecords,
                        {
                            creator_id: entry.creator_id || "",
                            creator: entry.creator || "",
                        },
                        { replaceMatchingDefinition: true },
                    );
                    log(
                        "Public character version imported",
                        `Imported ${entry.name || "public character"} version ${version.version_number}.`,
                        {
                            type: "image",
                            level: "message",
                            details: {
                                entryId: String(entry.id || ""),
                                definitionId: String(entry.definition_id || ""),
                                versionId: String(version.id || ""),
                                versionNumber: version.version_number,
                                importedIds: imported.map((record) => record.id),
                                maleImageUrl:
                                    version.metadata_snapshot?.male_image_url || "",
                                nonMaleImageUrl:
                                    version.metadata_snapshot?.non_male_image_url || "",
                            },
                        },
                    );
                }
                setStatus("Ready");
                if (options.showNotice !== false)
                    showNotice(
                        "Public Version Imported",
                        `${entry.name || "Public item"} version ${version.version_number || "?"} was imported into your local library.`,
                    );
            } catch (err) {
                setStatus("Ready");
                logImportException("Public version import failed", err, {
                    entryId: String(entry.id || "").trim(),
                    entryType: String(entry.type || "").trim(),
                    entryName: String(entry.name || "").trim(),
                    versionId: String(version.id || "").trim(),
                    payloadUrl: String(version.payload_url || "").trim(),
                    requestKind: "public-library-version-import",
                });
                if (options.showNotice !== false)
                    showNotice("Public Version Import Failed", err.message || String(err));
            } finally {
                endActivityTask(activityId);
            }
        }

        function characterExportEnvelope(records) {
            const items = (Array.isArray(records) ? records : [records])
                .filter(Boolean)
                .map((record) => characterDefinitionFileForExport(record));
            if (items.length === 1) return items[0];
            return {
                characters: items,
            };
        }

        function hostedCharacterSharePayload(records) {
            const items = (Array.isArray(records) ? records : [records])
                .filter(Boolean)
                .map((record) => characterDefinitionFileForExport(record));
            return items.length === 1 ? items[0] : { characters: items };
        }

        async function shareCharacterRecords(records, label = "character") {
            const validRecords = (Array.isArray(records) ? records : [records]).filter(Boolean);
            if (!validRecords.length) {
                showNotice("Share Failed", "No valid character records were found.");
                return;
            }
            const definitionErrors = validRecords.flatMap((record) => {
                const validation = validateCharacterLibraryRecord(record);
                return validation.ok
                    ? []
                    : validation.errors.map(
                          (error) => `${record.name || "Character"}: ${error.path}: ${error.message}`,
                      );
            });
            if (definitionErrors.length) {
                showNotice("Character Share Failed", definitionErrors.join("\n"));
                reportAppIssue(new Error(`Character share rejected:\n${definitionErrors.join("\n")}`), {
                    title: "Character Share Rejected",
                    type: "system",
                    context: "shareCharacterRecords",
                    details: { definitionErrors },
                });
                return null;
            }
            const payload = hostedCharacterSharePayload(validRecords);
            {}
            try {
                setStatus("Uploading character...");
                const upload = await uploadCompressedJson(payload, "Character upload");
                const slug =
                    validRecords.length === 1
                        ? validRecords[0].name || label
                        : `${validRecords.length}-characters`;
                const url = hostedShareUrl("character", slug, upload.fileName);
                await showHostedShareResult(
                    "Character Share Link",
                    url,
                    `Uploaded ${validRecords.length} character record${validRecords.length === 1 ? "" : "s"} to user.uploads.dev.`,
                );
            } catch (err) {
                showNotice("Character Share Failed", err.message || String(err));
            } finally {
                setStatus("Ready");
            }
        }

        function sharePlayerCharacter() {
            flushOpenCharacterEditorForExport("Player");
            return shareCharacterRecords([exportRecordForPlayer()], "player");
        }

        function shareCharacter(name) {
            flushOpenCharacterEditorForExport(name);
            const record = exportRecordForCharacter(name);
            if (!record) {
                showNotice("Share Failed", `${name} is not in the party member state.`);
                return;
            }
            return shareCharacterRecords([record], "character");
        }

        function shareNpc(name, locationLabel = "") {
            flushOpenCharacterEditorForExport(name, locationLabel);
            const record = exportRecordForNpc(name, locationLabel);
            if (!record) {
                showNotice("Share Failed", `${name} is not in the known NPC directory.`);
                return;
            }
            return shareCharacterRecords([record], "NPC");
        }

        function shareSelectedCharacters() {
            const names = selectedCharacterExportNames();
            if (!names.length) {
                showNotice("Nothing Selected", "Select one or more characters to share.");
                return;
            }
            const records = names
                .map((name) => (name === "Player" ? exportRecordForPlayer() : exportRecordForCharacter(name)))
                .filter(Boolean);
            return shareCharacterRecords(records, "selected characters");
        }

        function shareSelectedNpcs(locationLabel = "") {
            const records = selectedNpcExportKeys()
                .map((key) => exportRecordForNpc(key, locationLabel))
                .filter(Boolean);
            if (!records.length) {
                showNotice("Nothing Selected", "Select one or more known characters to share.");
                return;
            }
            return shareCharacterRecords(records, "selected NPCs");
        }

        function publishPlayerCharacterToPublicIndex() {
            flushOpenCharacterEditorForExport("Player");
            return publishCharacterRecordsToPublicIndex([exportRecordForPlayer()], "player");
        }

        function publishCharacterToPublicIndex(name) {
            flushOpenCharacterEditorForExport(name);
            const record = exportRecordForCharacter(name);
            if (!record) {
                showNotice("Publish Failed", `${name} is not in the party member state.`);
                return;
            }
            return publishCharacterRecordsToPublicIndex([record], "character");
        }

        function publishNpcToPublicIndex(name, locationLabel = "") {
            flushOpenCharacterEditorForExport(name, locationLabel);
            const record = exportRecordForNpc(name, locationLabel);
            if (!record) {
                showNotice("Publish Failed", `${name} is not in the known NPC directory.`);
                return;
            }
            return publishCharacterRecordsToPublicIndex([record], "NPC");
        }

        function publishSelectedCharactersToPublicIndex() {
            const names = selectedCharacterExportNames();
            if (!names.length) {
                showNotice("Nothing Selected", "Select one or more characters to publish.");
                return;
            }
            const records = names
                .map((name) => (name === "Player" ? exportRecordForPlayer() : exportRecordForCharacter(name)))
                .filter(Boolean);
            return publishCharacterRecordsToPublicIndex(records, "selected characters");
        }

        function publishSelectedNpcsToPublicIndex(locationLabel = "") {
            const records = selectedNpcExportKeys()
                .map((key) => exportRecordForNpc(key, locationLabel))
                .filter(Boolean);
            if (!records.length) {
                showNotice("Nothing Selected", "Select one or more known characters to publish.");
                return;
            }
            return publishCharacterRecordsToPublicIndex(records, "selected NPCs");
        }

        function exportRecordForPlayer() {
            const player = runtimeCharacterDefinitionRecord(
                app.state.player?.name || "Player",
                app.state.player || defaultState.player,
            ).character;
            return characterLibraryRecordFromDefinition(player);
        }

        function exportRecordForCharacter(name) {
            const character = app.state.characters?.[name];
            if (!character) return null;
            const exportedCharacter = runtimeCharacterDefinitionRecord(
                name,
                character,
            ).character;
            return characterLibraryRecordFromDefinition(exportedCharacter);
        }

        function exportRecordForNpc(name, locationId = "") {
            const target = findNpcEntryExact(name, locationId) || findNpcEntryExact(name, "");
            if (!target?.npc) return null;
            const displayName = target.npc.name || target.key || name;
            if (!target.npc.full_character)
                throw new Error(`${displayName} has no complete character definition to publish.`);
            return characterLibraryRecordFromDefinition(
                runtimeCharacterDefinitionRecord(
                    displayName,
                    target.npc.full_character,
                ).character,
            );
        }

        function flushOpenCharacterEditorForExport(name, locationLabel = "") {
            if ($("playerFriendlyEditor")) {
                if (flushStateEditorAutoSave("modalBox")) return;
                savePlayerFromModal({ snapshot: false });
                return;
            }
            if ($("charFriendlyEditor") && name) {
                if (flushStateEditorAutoSave("charFriendlyEditor")) return;
                const current = app.state.characters?.[name];
                if (!current) return;
                const beforeCharacter = clone(current);
                const next = readCharacterDefinitionManagedEditor(
                    current,
                    $("charFriendlyEditor"),
                );
                // SANITIZE REPLACED: export flush for an open character editor uses
                // the same targeted party-character validator as autosave.
                // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and character import/export smoke coverage.
                finalizeRuntimePartyCharacterAfterEditor(name, next);
                scheduleActiveGameSave();
                deferEditorProfileRefreshIfPromptInputsChanged(
                    name,
                    beforeCharacter,
                    next,
                    "character editor closed",
                );
                return;
            }
            if ($("npcFriendlyEditor") && name) {
                if (flushStateEditorAutoSave("npcFriendlyEditor")) return;
                const target = findNpcEntryExact(name, locationLabel);
                if (!target?.npc?.full_character) return;
                const beforeNpc = clone(target.npc.full_character);
                const draft = readCharacterDefinitionManagedEditor(
                    target.npc.full_character,
                    $("npcFriendlyEditor"),
                );
                target.npc.full_character = draft;
                const directoryData = readNpcDirectoryDataFromCharacterEditor(
                    $("npcFriendlyEditor"),
                );
                // SANITIZE REPLACED: export flush for an open NPC editor uses the
                // same targeted NPC/full-character validator as autosave.
                // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and character import/export smoke coverage.
                finalizeRuntimeNpcAfterEditor(target.npc, name, directoryData);
                deferEditorProfileRefreshIfPromptInputsChanged(
                    name,
                    beforeNpc,
                    target.npc.full_character || draft,
                    "NPC editor closed",
                );
                scheduleActiveGameSave();
            }
        }

        function exportPlayerCharacter() {
            flushOpenCharacterEditorForExport("Player");
            const record = exportRecordForPlayer();
            downloadJsonPayload(
                characterDefinitionFileForExport(record),
                `emberadventureslite-player-${safeArchiveFileName(record.name || "Player")}.json`,
            );
        }

        function exportCharacter(name) {
            flushOpenCharacterEditorForExport(name);
            const record = exportRecordForCharacter(name);
            if (!record) {
                showNotice("Export Failed", `${name} is not in the party member state.`);
                return;
            }
            downloadJsonPayload(
                characterDefinitionFileForExport(record),
                `emberadventureslite-character-${safeArchiveFileName(name)}.json`,
            );
        }

        function exportNpc(name, locationLabel = "") {
            flushOpenCharacterEditorForExport(name, locationLabel);
            const record = exportRecordForNpc(name, locationLabel);
            if (!record) {
                showNotice("Export Failed", `${name} is not in the known NPC directory.`);
                return;
            }
            downloadJsonPayload(
                characterDefinitionFileForExport(record),
                `emberadventureslite-npc-${safeArchiveFileName(record.name || name)}.json`,
            );
        }

        function selectedCharacterExportNames() {
            return [
                ...document.querySelectorAll("[data-character-export-name]:checked"),
            ].map((input) => input.dataset.characterExportName).filter(Boolean);
        }

        function exportSelectedCharacters() {
            const names = selectedCharacterExportNames();
            if (!names.length) {
                showNotice("Nothing Selected", "Select one or more characters to export.");
                return;
            }
            const records = [];
            for (const name of names) {
                records.push(name === "Player" ? exportRecordForPlayer() : exportRecordForCharacter(name));
            }
            const validRecords = records.filter(Boolean);
            if (!validRecords.length) {
                showNotice("Export Failed", "No valid selected characters were found.");
                return;
            }
            downloadJsonPayload(
                characterExportEnvelope(validRecords),
                `emberadventureslite-characters-${safeArchiveFileName(new Date().toISOString())}.json`,
            );
        }

        function selectedNpcExportKeys() {
            return [...document.querySelectorAll("[data-npc-export-key]:checked")]
                .map((input) => input.dataset.npcExportKey)
                .filter(Boolean);
        }

        function exportSelectedNpcs(locationLabel = "") {
            const keys = selectedNpcExportKeys();
            if (!keys.length) {
                showNotice("Nothing Selected", "Select one or more known characters to export.");
                return;
            }
            const records = keys
                .map((key) => exportRecordForNpc(key, locationLabel))
                .filter(Boolean);
            if (!records.length) {
                showNotice("Export Failed", "No valid selected known characters were found.");
                return;
            }
            downloadJsonPayload(
                characterExportEnvelope(records),
                `emberadventureslite-npcs-${safeArchiveFileName(locationLabel || "known-characters")}.json`,
            );
        }

        function characterImportRecordsFromExport(payload) {
            payload = EmberSharedLibraryFormat.toLite(payload);
            const validation = validateCharacterExport(payload);
            if (!validation.ok) {
                throw new Error(
                    `Character import is invalid:\n${validationErrorsText(validation)}`,
                );
            }
            const definitions = Object.hasOwn(payload, "characters")
                ? payload.characters.map((record) => record.character_definition)
                : [payload.character_definition];
            return definitions.map((definition) => ({
                character_definition: clone(definition),
            }));
        }

        function characterImportRecordsWithVersionMetadata(
            records = [],
            version = {},
            entry = {},
        ) {
            const snapshot = version?.metadata_snapshot;
            if (!snapshot || snapshot.type !== "character") return records;
            const definitionId = textSlot(
                snapshot.definition_id || entry.definition_id,
                "",
            );
            return records.map((record) => {
                const next = clone(record);
                const character = next.character_definition;
                if (!character || (definitionId && character.id !== definitionId))
                    return next;
                const presentations = createProfileImagePresentations(
                    character.profile_image_presentations || {},
                );
                for (const male of [true, false]) {
                    const key = male ? "male" : "non_male";
                    const url = textSlot(
                        male
                            ? snapshot.male_image_url
                            : snapshot.non_male_image_url,
                        "",
                    );
                    if (!url) continue;
                    presentations[key] = profileImageSlotFromExactInput({
                        ...presentations[key],
                        url,
                        local_image_id: "",
                        male,
                    });
                }
                character.profile_image_presentations = presentations;
                const defaultKey = characterPresentationUsesMaleFields(character.gender)
                    ? "male"
                    : "non_male";
                character.default_profile_image = profileImageSlotFromExactInput(
                    presentations[defaultKey],
                );
                return next;
            });
        }
        function applyImportedPlayer(character, fallbackName = "Player") {
            character = materializeCharacterDefinitionForRuntimeFields(character, fallbackName);
            const player = {
                ...clone(defaultState.player),
                ...clone(character || {}),
            };
            player.name =
                textSlot(player.name, "") ||
                textSlot(fallbackName, "") ||
                "Player";
            player.role = textSlot(player.role, defaultState.player.role);
            player.voice = textSlot(player.voice, defaultState.player.voice);
            player.inventory = exactInventoryList(
                Array.isArray(player.inventory)
                    ? player.inventory
                    : clone(defaultState.player.inventory || []),
            );
            player.known_facts = Array.isArray(player.known_facts)
                ? player.known_facts
                : clone(defaultState.player.known_facts || []);
            if (!isPlainObject(player.appearance))
                player.appearance = clone(defaultState.player.appearance || {});
            if (!isPlainObject(player.clothing))
                player.clothing = clone(defaultState.player.clothing || {});
            else player.clothing = exactClothingSlots(player.clothing);
            if (!isPlainObject(player.held_items))
                player.held_items = clone(defaultState.player.held_items || {});
            if (!isPlainObject(player.image))
                player.image = clone(defaultState.player.image || {});
            player.default_seed = exactProfileImageSeed(player.default_seed, "state.player.default_seed");
            player.image_prompt_config = imagePromptConfigFromExactInput(
                player.image_prompt_config || player.image || { seed: 0 },
                player.default_seed,
            );
            if (player.default_profile_image != null)
                player.default_profile_image = profileImageSlotFromExactInput(
                    player.default_profile_image,
                );
            player.source = entitySourceSlot(player.source);
            player.creator = entityCreatorSlot(player.creator);
            player.creation_tool = entityCreationToolSlot(
                player.creation_tool,
            );
            player.age = exactAdultAge(player.age, `imported player ${player.name || "Player"}.age`);
            delete player.relationship_to_player;
            delete player.trust;
            delete player.attraction;
            delete player.affection;
            delete player.boldness;
            delete player.state_of_mind;
            delete player.physical_state;
            delete player.pose;
            app.state.player = player;
        }

        function applyImportedPartyCharacter(record) {
            const character = materializeCharacterDefinitionForRuntimeFields(
                record.character || record.npc?.full_character || {},
                record.name,
            );
            const name =
                textSlot(record.name, "") ||
                textSlot(character.name, "") ||
                "Imported Character";
            app.state.characters ||= {};
            app.state.characters[name] = materializeCharacterForRuntime(character, name);
            return name;
        }

        function applyImportedNpc(record) {
            const sourceNpc = clone(record.npc || {});
            const sourceCharacter = materializeCharacterDefinitionForRuntimeFields(
                record.character || sourceNpc.full_character || {},
                record.name || sourceNpc.name,
            );
            const name =
                textSlot(record.name, "") ||
                textSlot(sourceNpc.name, "") ||
                textSlot(sourceCharacter.name, "") ||
                textSlot(record.key, "") ||
                "Imported NPC";
            const locationId = requireNpcLocationId(
                app.state,
                textSlot(record.npc_location_id, ""),
                "Imported NPC",
            );
            const location = ensureNpcDirectoryLocation(
                app.state,
                locationId,
                textSlot(record.location_label, currentSettlementName()),
            );
            location.characters ||= {};
            const existing = location.characters[name] || {};
            location.characters[name] = {
                ...existing,
                ...sourceNpc,
                name,
                gender:
                    sourceCharacter.gender ||
                    sourceNpc.gender ||
                    existing.gender ||
                    "unspecified",
                age: exactAdultAge(
                    sourceCharacter.age ?? sourceNpc.age,
                    `imported party character ${name}.age`,
                ),
                role:
                    sourceCharacter.role ||
                    sourceNpc.role ||
                    existing.role ||
                    "local",
                relationship:
                    sourceCharacter.relationship_to_player ||
                    sourceNpc.relationship ||
                    existing.relationship ||
                    "unknown",
                note:
                    sourceNpc.note ||
                    existing.note ||
                    `Imported known character ${name}.`,
                inspected:
                    !!sourceNpc.inspected ||
                    !!(sourceCharacter && Object.keys(sourceCharacter).length),
                full_character:
                    sourceCharacter && Object.keys(sourceCharacter).length
                        ? materializeCharacterForRuntime(sourceCharacter, name)
                        : sourceNpc.full_character || existing.full_character || null,
            };
            return name;
        }

        function importedCharacterRecordName(record = {}) {
            const character = record.character || record.character_definition || record.npc?.full_character || record.entity || {};
            return (
                textSlot(record.name, "") ||
                textSlot(record.npc?.name, "") ||
                textSlot(character.name, "") ||
                textSlot(record.key, "") ||
                ""
            );
        }

        function activeGameHasCharacterName(name = "") {
            const wanted = normalizeNameForMatch(name);
            if (!wanted) return false;
            if (normalizeNameForMatch(app.state?.player?.name || "Player") === wanted) return true;
            if (
                Object.entries(app.state?.characters || {}).some(([key, character]) =>
                    [
                        key,
                        character?.name,
                        character?.full_character?.name,
                    ].some((item) => normalizeNameForMatch(item || "") === wanted),
                )
            )
                return true;
            const npcLocations = app.state?.npc_directory?.locations || {};
            return Object.values(npcLocations).some((location) => {
                const characters = location?.characters || location?.npcs || {};
                return Object.entries(characters || {}).some(([key, npc]) =>
                    [
                        key,
                        npc?.name,
                        npc?.full_character?.name,
                        npc?.character?.name,
                    ].some((item) => normalizeNameForMatch(item || "") === wanted),
                );
            });
        }

        function localCharacterLibraryHasName(name = "") {
            const wanted = normalizeNameForMatch(name);
            if (!wanted) return false;
            return (app.characterDefinitions || []).some((record) =>
                [
                    record?.name,
                    record?.character?.name,
                    record?.character_definition?.name,
                    record?.npc?.name,
                    record?.npc?.full_character?.name,
                    record?.entity?.name,
                    record?.key,
                ].some((item) => normalizeNameForMatch(item || "") === wanted),
            );
        }

        async function importCharacterRecords(records, options = {}) {
            const sourceRecords = Array.from(records || []);
            if (!sourceRecords.length) {
                showNotice("Import Failed", "No character records were found.");
                return;
            }
            const validations = await validateCharacterImportRecordsInWorker(sourceRecords);
            validations.forEach((item) =>
                logDefinitionValidationWarnings(
                    item.validation,
                    `${item.name || "Imported Character"} import`,
                ),
            );
            const definitionErrors = importedCharacterDefinitionErrorsFromValidations(validations);
            if (definitionErrors.length) {
                showNotice(
                    "Character Definition Invalid",
                    definitionErrors
                        .map((error) => `${error.path}: ${error.message}`)
                        .join("\n"),
                );
                return;
            }
            const validRecords = sourceRecords.map((record) => ({
                kind: options.forceKind || (options.playerOnly ? "player" : "character"),
                name: record.character_definition.name,
                character: clone(record.character_definition),
            }));
            let importRecords = validRecords;
            const skippedGameDuplicates = [];
            if (!options.playerOnly) {
                importRecords = validRecords.filter((record) => {
                    if (record.kind === "player") return true;
                    const name = importedCharacterRecordName(record);
                    if (!name || !activeGameHasCharacterName(name)) return true;
                    skippedGameDuplicates.push(name);
                    return false;
                });
            }
            if (!importRecords.length) {
                showNotice(
                    "No New Characters Imported",
                    skippedGameDuplicates.length
                        ? `Skipped ${skippedGameDuplicates.length} character${skippedGameDuplicates.length === 1 ? "" : "s"} already in this game: ${compactNameList(skippedGameDuplicates)}.`
                        : "No importable character records were found.",
                );
                return;
            }
            if (
                options.playerOnly &&
                !importRecords.some((record) => record.kind === "player" || record.character)
            ) {
                showNotice("Import Failed", "No importable player record was found.");
                return;
            }
            const includesPlayer = importRecords.some(
                (record) => record.kind === "player" || options.playerOnly,
            );
            const oldPlayerNameBeforeImport = includesPlayer
                ? String(app.state.player?.name || "Player").trim()
                : "";
            if (includesPlayer && !options.playerWarningAccepted) {
                const choice = await showChoice(
                    "Import Player?",
                    "Importing a player replaces the current player. Export the current player first?",
                    [
                        { value: "export", label: "Export First", className: "primary" },
                        { value: "replace", label: "Replace" },
                        { value: "cancel", label: "Cancel" },
                    ],
                );
                if (choice === "cancel") return;
                if (choice === "export") exportPlayerCharacter();
            }

            const imported = [];
            // PROFILE IMAGE RULE: importing characters only copies usable default
            // profile images. Generated portraits are deferred until a visible
            // UI surface or scene relevance explicitly queues one.
            const importedNewProfileNames = [];
            const importedPartyNames = [];
            for (const record of importRecords) {
                if (options.playerOnly) {
                    applyImportedPlayer(
                        record.character || record.npc?.full_character || record.npc,
                        record.name,
                    );
                    imported.push("Player");
                    break;
                }
                if (record.kind === "player") {
                    applyImportedPlayer(record.character, record.name);
                    imported.push("Player");
                } else if (record.kind === "npc") {
                    const name =
                        textSlot(record.name, "") ||
                        textSlot(record.npc?.name, "") ||
                        textSlot(record.character?.name, "") ||
                        textSlot(record.key, "") ||
                        "Imported NPC";
                    const locationId = requireNpcLocationId(
                        app.state,
                        textSlot(record.npc_location_id, ""),
                        "Imported NPC",
                    );
                    const existed = !!findNpcEntryExact(name, locationId)?.npc;
                    const importedName = applyImportedNpc(record);
                    imported.push(importedName);
                    if (!existed) {
                        importedNewProfileNames.push(importedName);
                        const entity = profileEntity(importedName);
                        if (entity) entity.profile_image_auto_skip = true;
                    }
                } else {
                    const character = record.character || record.npc?.full_character || {};
                    const name =
                        textSlot(record.name, "") ||
                        textSlot(character.name, "") ||
                        "Imported Character";
                    const existed = !!app.state.characters?.[name];
                    const importedName = applyImportedPartyCharacter(record);
                    imported.push(importedName);
                    importedPartyNames.push(importedName);
                    if (!existed) {
                        importedNewProfileNames.push(importedName);
                        const entity = profileEntity(importedName);
                        if (entity) entity.profile_image_auto_skip = true;
                    }
                }
            }
            if (importedPartyNames.length) {
                app.state.scene ||= {};
                app.state.scene.party_members_present = [
                    ...new Set([
                        ...(app.state.scene.party_members_present || []),
                        ...importedPartyNames,
                    ]),
                ];
                replaceSceneNpcPresence(
                    app.state,
                    (app.state.scene.npcs_present || []).filter(
                        (name) => !importedPartyNames.includes(name),
                    ),
                    "imported NPC promoted to party",
                );
            }
            // SANITIZE REPLACED: imported records are validated per entity before
            // merge; the final import pass only normalizes touched player/NPC/scene fields.
            // SANITIZE TEST: Covered by character import/export and profile import edge smoke coverage.
            if (includesPlayer) finalizeRuntimePlayerAfterEditor(oldPlayerNameBeforeImport);
            assertRuntimeNpcReferences(app.state);
            assertRuntimeSceneReferences(app.state);

            scheduleActiveGameSave();
            if (
                includesPlayer &&
                profileEntity("Player") &&
                !activeProfileImage(profileEntity("Player")) &&
                !importedNewProfileNames.includes("Player")
            )
                importedNewProfileNames.push("Player");
            let missingProfileNames = importedNewProfileNames.filter((name) => {
                const entity = profileEntity(name);
                return entity && !activeProfileImage(entity);
            });
            const copiedDefaultProfileImages = [];
            for (const name of missingProfileNames) {
                const copiedDefault = await copyDefaultProfileImageIfAvailable(
                    name,
                    "character import default profile",
                    { save: false },
                );
                if (copiedDefault) {
                    const entity = profileEntity(name);
                    const image =
                        activeProfileImage(entity) ||
                        profileImageByStoreId(defaultProfileLocalImageId(entity));
                    if (image) copiedDefaultProfileImages.push(image);
                }
            }
            missingProfileNames = importedNewProfileNames.filter((name) => {
                const entity = profileEntity(name);
                return entity && !activeProfileImage(entity);
            });
            for (const name of importedNewProfileNames) {
                const entity = profileEntity(name);
                if (!entity) continue;
                if (missingProfileNames.includes(name))
                    entity.profile_image_auto_skip = true;
                else delete entity.profile_image_auto_skip;
            }
            if (missingProfileNames.length) {
                log(
                    "Profile images deferred",
                    `Imported ${missingProfileNames.length} new character${missingProfileNames.length === 1 ? "" : "s"} without profile images. Generated portraits will start when the character becomes visible or relevant.`,
                    { type: "image", level: "message" },
                );
            }
            if (copiedDefaultProfileImages.length)
                saveProfileImageRecordsNow(copiedDefaultProfileImages, "character import profile images");
            scheduleActiveGameSave();
            requestRuntimeMutationRender("character records imported");
            renderLeftPanel();
            renderCharacters();
            refreshOpenCharacterLibraryAfterImport();
            showNotice(
                "Import Complete",
                `Imported ${imported.length} character${imported.length === 1 ? "" : "s"}.${skippedGameDuplicates.length ? ` Skipped ${skippedGameDuplicates.length} already in game: ${compactNameList(skippedGameDuplicates)}.` : ""}${missingProfileNames.length ? " Missing profile images were deferred until needed." : ""}`,
            );
        }

        async function characterImportLibraryMetadata(raw = {}, libraryMetadata = {}) {
            const metadata = { ...libraryMetadata };
            if (
                textSlot(metadata.creator_id, "") &&
                entityCreatorSlot(metadata.creator)
            ) {
                return metadata;
            }
            const creatorIdentity = await chooseCreatorIdentityForImport(
                importedCharacterRecordName(raw) || "Imported character",
            );
            if (!creatorIdentity) return null;
            metadata.creator_id = creatorIdentity.creator_id;
            metadata.creator = creatorIdentity.creator_name;
            return metadata;
        }

        async function characterImportBatchLibraryMetadata(
            records = [],
            libraryMetadata = {},
        ) {
            const metadata = { ...libraryMetadata };
            if (
                textSlot(metadata.creator_id, "") &&
                entityCreatorSlot(metadata.creator)
            ) {
                return metadata;
            }
            const plural = records.length > 1;
            const creatorIdentity = await chooseCreatorIdentityForImport(
                plural
                    ? "These imported characters"
                    : importedCharacterRecordName(records[0]) || "Imported character",
                { plural },
            );
            if (!creatorIdentity) return null;
            metadata.creator_id = creatorIdentity.creator_id;
            metadata.creator = creatorIdentity.creator_name;
            return metadata;
        }

        async function importCharacterDefinitionsFromRecords(
            records = [],
            libraryMetadata = {},
            options = {},
        ) {
            if (!Array.isArray(records))
                throw new Error("Character import records must be an array.");
            const validRecords = records;
            if (!validRecords.length) {
                showNotice("Import Failed", "No character records were found.");
                return [];
            }
            const validations = await validateCharacterImportRecordsInWorker(validRecords);
            validations.forEach((item) =>
                logDefinitionValidationWarnings(
                    item.validation,
                    `${item.name || "Imported Character"} import`,
                ),
            );
            const definitionErrors = importedCharacterDefinitionErrorsFromValidations(validations);
            if (definitionErrors.length) {
                showNotice(
                    "Character Definition Invalid",
                    definitionErrors
                        .map((error) => `${error.path}: ${error.message}`)
                        .join("\n"),
                );
                return [];
            }
            const importableRecords = [];
            const skippedExisting = [];
            const skippedBatchDuplicates = [];
            const seenNames = new Set();
            for (const raw of validRecords) {
                const name = importedCharacterRecordName(raw);
                const key = normalizeNameForMatch(name);
                if (key && seenNames.has(key)) {
                    skippedBatchDuplicates.push(name);
                    continue;
                }
                if (key) seenNames.add(key);
                const definitionId = textSlot(
                    raw?.character_definition?.id,
                    "",
                );
                const replacesExactDefinition =
                    options.replaceMatchingDefinition === true &&
                    !!definitionId &&
                    (app.characterDefinitions || []).some(
                        (record) => String(record?.id || "") === definitionId,
                    );
                if (
                    name &&
                    localCharacterLibraryHasName(name) &&
                    !replacesExactDefinition
                ) {
                    skippedExisting.push(name);
                    continue;
                }
                importableRecords.push(raw);
            }
            const skippedNames = [
                ...new Set([...skippedExisting, ...skippedBatchDuplicates].filter(Boolean)),
            ];
            if (!importableRecords.length) {
                showNotice(
                    "No New Characters Imported",
                    skippedNames.length
                        ? `Skipped ${skippedNames.length} duplicate character${skippedNames.length === 1 ? "" : "s"}: ${compactNameList(skippedNames)}.`
                        : "No reusable character definitions were found.",
                );
                return [];
            }
            const batchLibraryMetadata = await characterImportBatchLibraryMetadata(
                importableRecords,
                libraryMetadata,
            );
            if (!batchLibraryMetadata) return [];
            const libraryRecords = [];
            for (const raw of importableRecords) {
                const metadata = await characterImportLibraryMetadata(
                    raw,
                    batchLibraryMetadata,
                );
                if (!metadata) return [];
                libraryRecords.push(
                    characterLibraryRecordFromDefinition(
                        raw.character_definition,
                        metadata,
                    ),
                );
            }
            let imported = upsertCharacterLibraryDefinitionsBatch(libraryRecords);
            if (!imported.length) {
                showNotice("Import Failed", "No reusable character definitions were found.");
                return [];
            }
            app.profileEntityOverrides ||= {};
            const importedProfileNames = [];
            for (const record of imported) {
                const registered = registerCharacterLibraryProfileEntity(record);
                if (registered?.name && !importedProfileNames.includes(registered.name))
                    importedProfileNames.push(registered.name);
            }
            const copiedDefaultProfileImages = [];
            const presentationCopies = importedProfileNames.flatMap((name) => [
                { name, male: true },
                { name, male: false },
            ]);
            const copiedDefaults = await mapWithConcurrency(
                presentationCopies,
                4,
                async ({ name, male }) => ({
                    name,
                    male,
                    copied: await copyProfileImagePresentationIfAvailable(
                        name,
                        male,
                        `character library import ${male ? "male" : "non-male"} profile`,
                        {
                            setActive: false,
                            cleanDefinitionProfileFields: true,
                            forceHostedDownload: true,
                            save: false,
                        },
                    ),
                }),
            );
            for (const result of copiedDefaults) {
                if (!result.copied) continue;
                const entity = profileEntity(result.name);
                const presentationSlot = profileImagePresentationSlot(
                    entity,
                    result.male,
                );
                const image = presentationSlot.local_image_id
                    ? profileImageByStoreId(presentationSlot.local_image_id)
                    : null;
                if (
                    image &&
                    !copiedDefaultProfileImages.some(
                        (stored) => String(stored.id) === String(image.id),
                    )
                )
                    copiedDefaultProfileImages.push(image);
            }
            for (const record of imported) {
                const registeredName = characterLibraryProfileName(record);
                const entity = profileEntity(registeredName);
                const entityPresentations = createProfileImagePresentations(
                    entity?.profile_image_presentations,
                );
                const hasDefaultProfileImage = !!entity?.default_profile_image?.local_image_id;
                const hasPresentationProfileImage =
                    !!entityPresentations.male.local_image_id ||
                    !!entityPresentations.non_male.local_image_id;
                if (!hasDefaultProfileImage && !hasPresentationProfileImage) continue;
                record.character = {
                    ...(record.character || {}),
                    default_profile_image: clone(entity.default_profile_image),
                    profile_image_presentations: clone(entityPresentations),
                };
                record.active_profile_image_ids = {
                    male: entityPresentations.male.local_image_id || "",
                    non_male: entityPresentations.non_male.local_image_id || "",
                };
                const libraryRecord = (app.characterDefinitions || []).find(
                    (item) =>
                        item.id === record.id ||
                        normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name),
                );
                if (libraryRecord?.character) {
                    libraryRecord.character.default_profile_image = clone(entity.default_profile_image);
                    libraryRecord.character.profile_image_presentations = clone(entityPresentations);
                    libraryRecord.active_profile_image_ids = clone(
                        record.active_profile_image_ids,
                    );
                }
            }
            app.profileEntityOverrides ||= {};
            const refreshedImported = imported
                .map((record) =>
                    (app.characterDefinitions || []).find(
                        (item) =>
                            item.id === record.id ||
                            normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name),
                    ) || record,
                )
                .filter(Boolean);
            for (const record of refreshedImported) {
                registerCharacterLibraryProfileEntity(record);
                const registeredName = characterLibraryProfileName(record);
                const entity = profileEntity(registeredName);
                if (entity?.default_profile_image?.local_image_id && record?.character) {
                    record.character.default_profile_image = clone(entity.default_profile_image);
                    record.character.profile_image_presentations = clone(
                        entity.profile_image_presentations,
                    );
                    const presentationKey = characterLibraryPresentationKeyForGender(
                        entity.gender,
                    );
                    record.active_profile_image_ids =
                        exactCharacterLibraryActiveProfileImageIds(
                            record.active_profile_image_ids,
                        );
                    record.active_profile_image_ids[presentationKey] =
                        entity.default_profile_image.local_image_id;
                }
            }
            const missingProfileNames = importedProfileNames.filter((name) => {
                const entity = profileEntity(name);
                return entity && !activeProfileImage(entity);
            });
            for (const name of missingProfileNames) {
                const entity = profileEntity(name);
                if (entity) entity.profile_image_auto_skip = true;
            }
            if (missingProfileNames.length) {
                log(
                    "Profile images deferred",
                    `Imported ${missingProfileNames.length} character definition${missingProfileNames.length === 1 ? "" : "s"} without profile images. Generated portraits will start from the visible Character Library list.`,
                    { type: "image", level: "message" },
                );
            }
            app.characterDefinitions = (app.characterDefinitions || []).map(
                projectCharacterLibraryDefinitionProfileFields,
            );
            const refreshedImportedForSave = refreshedImported
                .map((record) =>
                    (app.characterDefinitions || []).find(
                        (item) =>
                            item.id === record.id ||
                            normalizeNameForMatch(item.name) === normalizeNameForMatch(record.name),
                    ) || record,
                )
                .filter(Boolean);
            const persisted = await app.work.enqueueOrdered(
                `library:${libraryRecordStorageType(CHARACTER_LIBRARY_KEY)}`,
                "import character definitions",
                () =>
                    savePerRecordLibraryRecords(
                        CHARACTER_LIBRARY_KEY,
                        refreshedImportedForSave,
                    ),
            );
            if (persisted === false) {
                const importedIds = new Set(imported.map((record) => String(record.id || "")));
                app.characterDefinitions = (app.characterDefinitions || []).filter(
                    (record) => !importedIds.has(String(record.id || "")),
                );
                const copiedImageIds = new Set(
                    copiedDefaultProfileImages.map((image) => String(image.id || "")),
                );
                app.profileImages = (app.profileImages || []).filter(
                    (image) => !copiedImageIds.has(String(image.id || "")),
                );
                return [];
            }
            if (copiedDefaultProfileImages.length) {
                saveProfileImageRecordsNow(
                    copiedDefaultProfileImages,
                    "character definition import profile images",
                    { selectProfileImages: true },
                );
                await app.work.flush(
                    `library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`,
                );
                for (const image of copiedDefaultProfileImages) {
                    const presentation = image.male === true
                        ? "male"
                        : "non_male";
                    const storedImage = await app.persistence.getRecord(
                        "characterProfileImages",
                        image.id,
                    );
                    const storedSelection = await app.persistence.getRecord(
                        "characterProfileImageSelections",
                        [image.character_id, presentation],
                    );
                    if (!storedImage)
                        throw new Error(
                            `${image.owner_name || "Imported character"} ${presentation} hosted profile image was not saved.`,
                        );
                    if (String(storedSelection?.imageId || "") !== String(image.id))
                        throw new Error(
                            `${image.owner_name || "Imported character"} ${presentation} hosted profile image was saved without its active selection.`,
                        );
                }
            }
            refreshOpenCharacterLibraryAfterImport();
            showNotice(
                "Import Complete",
                `Imported ${imported.length} character definition${imported.length === 1 ? "" : "s"}.${skippedNames.length ? ` Skipped ${skippedNames.length} duplicate${skippedNames.length === 1 ? "" : "s"}: ${compactNameList(skippedNames)}.` : ""}${missingProfileNames.length ? " Missing profile images were deferred until visible." : ""}`,
            );
            return imported;
        }

        function refreshOpenCharacterLibraryAfterImport() {
            const box = $("modalBox");
            if (!box?.matches?.("[data-character-library-modal='1']")) return;
            const tab = characterLibraryActiveTab();
            if (tab === "public") return;
            refreshCharacterLibraryActiveTabCards({
                tab,
                allowHidden: true,
                immediateSmall: true,
            });
            updateUnifiedLibraryResultLabel();
        }

        let googlePickerApiPromise = null;

        function chooseComputerImportFiles(options = {}) {
            if (typeof options.computerPicker === "function")
                return Promise.resolve(options.computerPicker(options));
            return new Promise((resolve) => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = options.accept || "application/json,.json";
                input.multiple = options.multiple === true;
                input.onchange = () => resolve([...(input.files || [])]);
                input.oncancel = () => resolve([]);
                input.click();
            });
        }

        async function downloadImportFilesWithActivity(items = [], downloadFile) {
            const list = Array.from(items || []);
            if (!list.length) return [];
            return withActivityTask(
                list.length === 1 ? "Downloading" : `Downloading 0/${list.length}`,
                async ({ update }) => {
                    let completed = 0;
                    return mapWithConcurrency(list, 4, async (item) => {
                        try {
                            return await downloadFile(item);
                        } finally {
                            completed++;
                            update(
                                list.length === 1
                                    ? "Downloading"
                                    : `Downloading ${completed}/${list.length}`,
                            );
                        }
                    });
                },
                { priority: 85, kind: "import" },
            );
        }

        function googleDriveProviderToken() {
            return String(app.supabaseSession?.provider_token || "").trim();
        }

        function clearGoogleDriveProviderToken() {
            if (!app.supabaseSession) return;
            const session = { ...app.supabaseSession };
            delete session.provider_token;
            delete session.provider_refresh_token;
            saveSupabaseSession(session);
        }

        function googlePickerOrigin() {
            const ancestorOrigins = window.location.ancestorOrigins;
            if (ancestorOrigins?.length)
                return String(ancestorOrigins[ancestorOrigins.length - 1] || window.location.origin);
            const referrer = String(document.referrer || "").trim();
            if (referrer && URL.canParse?.(referrer)) return new URL(referrer).origin;
            return window.location.origin;
        }

        function loadGooglePickerApi() {
            if (window.google?.picker) return Promise.resolve(window.google.picker);
            if (googlePickerApiPromise) return googlePickerApiPromise;
            googlePickerApiPromise = new Promise((resolve, reject) => {
                const finishLoad = () => {
                    if (!window.gapi?.load) {
                        reject(new Error("Google Picker could not initialize."));
                        return;
                    }
                    window.gapi.load("picker", {
                        callback: () => resolve(window.google?.picker || null),
                        onerror: () => reject(new Error("Google Picker could not load.")),
                    });
                };
                const existing = document.querySelector("script[data-ember-google-picker]");
                if (existing) {
                    if (window.gapi?.load) {
                        finishLoad();
                        return;
                    }
                    existing.addEventListener("load", finishLoad, { once: true });
                    existing.addEventListener(
                        "error",
                        () => reject(new Error("Google Picker script could not load.")),
                        { once: true },
                    );
                    return;
                }
                const script = document.createElement("script");
                script.src = "https://apis.google.com/js/api.js";
                script.async = true;
                script.dataset.emberGooglePicker = "1";
                script.onload = finishLoad;
                script.onerror = () => reject(new Error("Google Picker script could not load."));
                document.head.appendChild(script);
            });
            googlePickerApiPromise = googlePickerApiPromise.catch((error) => {
                googlePickerApiPromise = null;
                throw error;
            });
            return googlePickerApiPromise;
        }

        async function validatedGoogleDriveProviderToken() {
            const token = googleDriveProviderToken();
            if (!token) return "";
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/about?fields=user&key=${encodeURIComponent(GOOGLE_PICKER_API_KEY)}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            if (response.ok) return token;
            const body = await response.text();
            const parsed = parseJsonObject(body) || {};
            const reason = String(parsed.error?.errors?.[0]?.reason || "").trim();
            const message = String(parsed.error?.message || body || response.statusText || "").trim();
            devLog("Google Drive connection preflight failed", {
                type: "system",
                level: "error",
                status: response.status,
                reason,
                message,
            });
            if (
                response.status === 401 ||
                reason === "authError" ||
                reason === "insufficientPermissions"
            ) {
                clearGoogleDriveProviderToken();
                return "";
            }
            if (reason === "accessNotConfigured" || reason === "serviceDisabled")
                throw new Error(
                    "Google Drive API is not enabled for the configured Google Cloud project.",
                );
            throw new Error(
                `Google Drive connection failed (${response.status}${reason ? ` ${reason}` : ""}): ${message || "Unknown Google Drive error."}`,
            );
        }

        function googleDriveDownloadError(response, body = "", documentRecord = {}) {
            const parsed = parseJsonObject(body) || {};
            const reason = String(parsed.error?.errors?.[0]?.reason || "").trim();
            const googleMessage = String(parsed.error?.message || body || response.statusText || "").trim();
            const name = String(documentRecord.name || "selected file").trim();
            devLog("Google Drive import download failed", {
                type: "system",
                level: "error",
                status: response.status,
                reason,
                message: googleMessage,
                fileId: String(documentRecord.id || "").trim(),
                fileName: name,
                mimeType: String(documentRecord.mimeType || "").trim(),
            });
            if (response.status === 401 || reason === "authError") {
                clearGoogleDriveProviderToken();
                return new Error(
                    "Google Drive permission expired. Choose Google Drive again to reconnect.",
                );
            }
            if (reason === "insufficientPermissions") {
                clearGoogleDriveProviderToken();
                return new Error(
                    "Google Drive access was not granted. Choose Google Drive again and approve file access.",
                );
            }
            if (reason === "appNotAuthorizedToFile")
                return new Error(
                    `Google Drive selected ${name}, but did not authorize EmberAdventures to download it. The Google OAuth client, Picker API key, and Picker App ID must use the same Google Cloud project.`,
                );
            if (reason === "accessNotConfigured" || reason === "serviceDisabled")
                return new Error(
                    "Google Drive API is not enabled for the configured Google Cloud project.",
                );
            return new Error(
                `Google Drive could not download ${name} (${response.status}${reason ? ` ${reason}` : ""}): ${googleMessage || "Unknown Google Drive error."}`,
            );
        }

        function importFileFromWorkerDownload(result = {}) {
            const blob = result?.blob;
            if (!(blob instanceof Blob))
                throw new Error("Import download worker did not return file data.");
            return new File(
                [blob],
                String(result?.name || "import.json"),
                { type: String(result?.type || blob.type || "application/json") },
            );
        }

        function logImportException(label, error, details = {}) {
            const exception = error instanceof Error ? error : new Error(String(error || "Unknown import error."));
            const message = exception.message || String(exception);
            log(
                label,
                [
                    `Name: ${exception.name || "Error"}`,
                    `Message: ${message}`,
                    exception.stack ? `Stack:\n${exception.stack}` : "",
                ]
                    .filter(Boolean)
                    .join("\n"),
                {
                    type: "system",
                    level: "error",
                    details: {
                        ...details,
                        errorName: exception.name || "Error",
                        errorMessage: message,
                        errorStack: exception.stack || "",
                    },
                },
            );
        }

        function expectedImportRejection(error) {
            return error?.expectedImportRejection === true;
        }

        function importRejectionError(messages = []) {
            const error = new Error(Array.from(messages || []).filter(Boolean).join("\n"));
            error.expectedImportRejection = true;
            return error;
        }

        function handleCharacterImportFailure(label, error, details = {}) {
            if (!expectedImportRejection(error))
                logImportException(label, error, details);
            showNotice("Import Failed", error?.message || String(error));
        }

        function importDownloadNetworkDiagnostic(source = "", item = {}) {
            const kind = String(source || "").trim();
            if (kind !== "github") return null;
            const inputUrl = String(item?.url || "").trim();
            const tokenPresent = !!String(item?.token || "").trim();
            const reference = githubFileReferenceFromUrl(inputUrl);
            const resolvedUrl = githubRawImportUrl(inputUrl);
            const endpointUrl = tokenPresent && reference
                ? githubContentsApiUrl(reference)
                : resolvedUrl;
            return {
                inputUrl,
                resolvedUrl,
                endpointUrl,
                mode: tokenPresent
                    ? "authenticated contents API download"
                    : "public raw download",
                tokenPresent,
            };
        }

        async function logImportDownloadNetworkProbe(source = "", item = {}) {
            const diagnostic = importDownloadNetworkDiagnostic(source, item);
            if (!diagnostic?.endpointUrl) return null;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const startedAt = performance.now();
            const details = {
                ...diagnostic,
                pageOrigin: String(window.location?.origin || ""),
                pageProtocol: String(window.location?.protocol || ""),
                navigatorOnline:
                    typeof navigator.onLine === "boolean" ? navigator.onLine : null,
                documentVisibility: String(document.visibilityState || "unknown"),
            };
            try {
                const response = await fetch(diagnostic.endpointUrl, {
                    method: "HEAD",
                    cache: "no-store",
                    headers: diagnostic.tokenPresent
                        ? {
                              Accept: "application/vnd.github.raw+json",
                              ...githubTokenHeaders(item?.token || ""),
                          }
                        : undefined,
                    signal: controller.signal,
                });
                return {
                    ...details,
                    probeMethod: "HEAD",
                    durationMs: Math.round(performance.now() - startedAt),
                    responseReceived: true,
                    status: response.status,
                    statusText: response.statusText || "",
                    responseType: response.type || "",
                    redirected: response.redirected,
                    finalUrl: response.url || "",
                };
            }
            catch (error) {
                return {
                    ...details,
                    probeMethod: "HEAD",
                    durationMs: Math.round(performance.now() - startedAt),
                    responseReceived: false,
                    timedOut: error?.name === "AbortError",
                    errorName: String(error?.name || "Error"),
                    errorMessage: String(error?.message || error || "Unknown probe failure."),
                    errorStack: String(error?.stack || ""),
                };
            }
            finally {
                clearTimeout(timeout);
            }
        }

        async function downloadImportFileInWorker(source = "", item = {}, options = {}) {
            try {
                const result = await storyImportWorkerRequest(
                    "download-import-file",
                    { source, item },
                    { onProgress: options.onProgress },
                );
                return importFileFromWorkerDownload(result);
            } catch (error) {
                const networkDiagnostic = importDownloadNetworkDiagnostic(source, item);
                const networkProbe = await logImportDownloadNetworkProbe(source, item);
                logImportException("Import download failed", error, {
                    source: String(source || ""),
                    url: String(item?.url || "").trim(),
                    fileId: String(item?.record?.id || "").trim(),
                    fileName: String(item?.record?.name || item?.name || "").trim(),
                    requestKind: "download-import-file",
                    ...(networkDiagnostic || {}),
                    networkProbe,
                });
                throw error;
            }
        }

        async function downloadGoogleDriveImportFile(documentRecord = {}, token = "") {
            try {
                return await downloadImportFileInWorker("google-drive", {
                    record: documentRecord,
                    token,
                });
            }
            catch (error) {
                if (/\b(?:401|authError|insufficientPermissions)\b/i.test(String(error?.message || error)))
                    clearGoogleDriveProviderToken();
                throw error;
            }
        }

        function googleDriveMimeTypesForImport(options = {}) {
            if (options.googleMimeTypes) return String(options.googleMimeTypes);
            const accept = String(options.accept || "application/json,.json").toLowerCase();
            const mimeTypes = new Set();
            if (accept.includes("image/*") || accept.includes("image/")) {
                mimeTypes.add("image/png");
                mimeTypes.add("image/jpeg");
                mimeTypes.add("image/webp");
                mimeTypes.add("image/gif");
            }
            if (
                accept.includes("application/json") ||
                accept.includes(".json") ||
                accept.includes("text/plain")
            ) {
                mimeTypes.add("application/json");
                mimeTypes.add("text/plain");
                mimeTypes.add("application/vnd.google-apps.document");
            }
            if (COMPRESSED_JSON_FORMATS.some((entry) =>
                entry.extensions.some((extension) => accept.includes(extension)),
            )) {
                for (const entry of COMPRESSED_JSON_FORMATS) {
                    mimeTypes.add(entry.mimeType);
                    entry.mimeTypes.forEach((type) => mimeTypes.add(type));
                }
                // Google Drive commonly records uploaded compressed files as a
                // generic binary type even when their extension is specific.
                mimeTypes.add("application/octet-stream");
            }
            if (accept.includes("application/zip") || accept.includes(".zip")) {
                mimeTypes.add("application/zip");
                mimeTypes.add("application/x-zip-compressed");
            }
            return [...mimeTypes].join(",");
        }

        async function chooseGoogleDriveImportFiles(options = {}) {
            if (typeof options.googleDrivePicker === "function")
                return options.googleDrivePicker(options);
            if (!GOOGLE_PICKER_API_KEY || !GOOGLE_PICKER_APP_ID) {
                showNotice(
                    "Google Drive Setup Required",
                    "Google Drive importing needs the Google Picker API key and Cloud project number configured in EmberAdventures.",
                );
                return [];
            }
            const hadToken = !!googleDriveProviderToken();
            const token = await validatedGoogleDriveProviderToken();
            if (!token) {
                const permissionText = hadToken
                    ? "Google Drive importing needs a current permission grant to open only the files you select. After Google reconnects, open Import again."
                    : "Google Drive importing needs permission to open only the files you select. After Google connects, open Import again.";
                const connect = await showConfirm(
                    hadToken ? "Reconnect Google Drive?" : "Connect Google Drive?",
                    permissionText,
                    {
                        confirmText: hadToken ? "Reconnect Drive" : "Connect Drive",
                        cancelText: "Cancel",
                    },
                );
                if (connect) signInPublicLibraryWithGoogle({ driveAccess: true });
                return [];
            }
            const picker = await loadGooglePickerApi();
            if (!picker) throw new Error("Google Picker is unavailable.");
            const selected = await new Promise((resolve, reject) => {
                let pickerInstance = null;
                let settled = false;
                devLog("Google Picker opening", {
                    type: "system",
                    level: "message",
                    origin: googlePickerOrigin(),
                    multiple: options.multiple === true,
                });
                const finish = (value, error = null) => {
                    if (settled) return;
                    settled = true;
                    pickerInstance?.setVisible(false);
                    pickerInstance?.dispose();
                    if (error) reject(error);
                    else resolve(value);
                };
                const view = new picker.DocsView(picker.ViewId.DOCS)
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(false);
                const mimeTypes = googleDriveMimeTypesForImport(options);
                if (mimeTypes) view.setMimeTypes(mimeTypes);
                if (picker.DocsViewMode?.LIST) view.setMode(picker.DocsViewMode.LIST);
                const builder = new picker.PickerBuilder()
                    .setOAuthToken(token)
                    .setDeveloperKey(GOOGLE_PICKER_API_KEY)
                    .setAppId(GOOGLE_PICKER_APP_ID)
                    .setOrigin(googlePickerOrigin())
                    .addView(view)
                    .setCallback((data) => {
                        if (data.action === picker.Action.PICKED)
                            finish([...(data.docs || [])]);
                        else if (data.action === picker.Action.CANCEL) finish([]);
                        else if (data.action === picker.Action.ERROR) {
                            devLog("Google Picker callback error", {
                                type: "system",
                                level: "error",
                                data,
                            });
                            finish([], new Error("Google Picker reported an error."));
                        }
                    });
                if (options.multiple === true)
                    builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
                pickerInstance = builder.build();
                pickerInstance.setVisible(true);
            });
            if (!selected.length) return [];
            devLog("Google Drive import files selected", {
                type: "system",
                level: "message",
                count: selected.length,
                files: selected.map((record) => ({
                    id: String(record.id || "").trim(),
                    name: String(record.name || "").trim(),
                    mimeType: String(record.mimeType || "").trim(),
                })),
            });
            return downloadImportFilesWithActivity(selected, (record) =>
                downloadGoogleDriveImportFile(record, token),
            );
        }

        function githubImportUrlsFromText(text = "") {
            const raw = String(text || "");
            const urls = [];
            raw.replace(/\[[^\]]*]\((https:\/\/[^)\s]+)\)/gi, (_match, url) => {
                urls.push(url);
                return "";
            });
            raw.replace(/https:\/\/[^\s)]+/gi, (url) => {
                urls.push(url);
                return "";
            });
            return [...new Set(urls)]
                .map(normalizeGithubImportUrl)
                .filter(Boolean);
        }

        const GITHUB_IMPORT_TOKEN_VAULT_KEY = "emberadventureslite-github-import-token-vault";
        const GITHUB_IMPORT_FOLDER_HISTORY_KEY = "emberadventureslite-github-import-folder-history";

        function githubImportTokenVault() {
            const data = parseJsonObject(localStorage.getItem(GITHUB_IMPORT_TOKEN_VAULT_KEY) || "{}") || {};
            return isPlainObject(data) ? data : {};
        }

        function githubImportOwnerFromUrl(url = "") {
            const reference = githubFileReferenceFromUrl(url);
            return String(reference?.owner || "").trim();
        }

        function savedGithubImportToken(owner = "") {
            const key = String(owner || "").trim().toLowerCase();
            const record = githubImportTokenVault()[key];
            return String(record?.token || "").trim();
        }

        function saveGithubImportToken(owner = "", token = "") {
            const key = String(owner || "").trim().toLowerCase();
            const clean = String(token || "").trim();
            if (!key || !clean) return;
            const vault = githubImportTokenVault();
            vault[key] = {
                owner: String(owner || "").trim(),
                token: clean,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(GITHUB_IMPORT_TOKEN_VAULT_KEY, JSON.stringify(vault));
        }

        function githubImportFolderHistory() {
            let data = [];
            try {
                data = JSON.parse(localStorage.getItem(GITHUB_IMPORT_FOLDER_HISTORY_KEY) || "[]");
            } catch {
                data = [];
            }
            return (Array.isArray(data) ? data : [])
                .filter((record) => isPlainObject(record))
                .map((record) => ({
                    url: String(record.url || "").trim(),
                    label: String(record.label || "").trim(),
                    owner: String(record.owner || "").trim(),
                    repo: String(record.repo || "").trim(),
                    updatedAt: String(record.updatedAt || "").trim(),
                }))
                .filter((record) => record.url && record.owner && record.repo);
        }

        function githubFolderUrlFromReference(reference = {}) {
            if (!reference?.owner || !reference?.repo) return "";
            const path = githubPathSegments(reference.path)
                .map(encodeURIComponent)
                .join("/");
            const pathPart = path ? `/${path}` : "";
            return `https://github.com/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}/tree/${encodeURIComponent(reference.ref || "main")}${pathPart}`;
        }

        function githubFolderLabelFromReference(reference = {}) {
            if (!reference?.owner || !reference?.repo) return "";
            return `${reference.owner}/${reference.repo}${reference.path ? `/${reference.path}` : ""}`;
        }

        function rememberGithubImportFolder(reference = {}) {
            const url = githubFolderUrlFromReference(reference);
            const label = githubFolderLabelFromReference(reference);
            if (!url || !label) return;
            const normalizedUrl = url.toLowerCase();
            const next = [
                {
                    url,
                    label,
                    owner: String(reference.owner || "").trim(),
                    repo: String(reference.repo || "").trim(),
                    updatedAt: new Date().toISOString(),
                },
                ...githubImportFolderHistory().filter(
                    (record) => String(record.url || "").toLowerCase() !== normalizedUrl,
                ),
            ].slice(0, 20);
            localStorage.setItem(GITHUB_IMPORT_FOLDER_HISTORY_KEY, JSON.stringify(next));
        }

        function githubImportOwnersFromUrls(urls = []) {
            return [...new Set(
                (Array.isArray(urls) ? urls : [])
                    .map(githubImportOwnerFromUrl)
                    .filter(Boolean)
                    .map((owner) => owner.toLowerCase()),
            )];
        }

        function githubRawImportUrl(url = "") {
            const raw = normalizeGithubImportUrl(url);
            if (!raw) return "";
            if (/^https:\/\/raw\.githubusercontent\.com\//i.test(raw)) return raw;
            if (!/^https:\/\/github\.com\//i.test(raw)) return raw;
            const match = raw.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
            if (!match) return raw;
            return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`;
        }

        function githubFileReferenceFromUrl(url = "") {
            const raw = normalizeGithubImportUrl(url);
            let match = raw.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
            if (match)
                return {
                    owner: match[1],
                    repo: match[2],
                    ref: match[3],
                    path: match[4].split(/[?#]/)[0],
                };
            match = raw.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
            if (match)
                return {
                    owner: match[1],
                    repo: match[2],
                    ref: match[3],
                    path: match[4].split(/[?#]/)[0],
                };
            return null;
        }

        function githubDirectoryReferenceFromText(text = "") {
            const raw = normalizeGithubImportUrl(text);
            if (!raw) return null;
            let match = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
            if (match)
                return {
                    owner: match[1],
                    repo: match[2],
                    ref: "main",
                    path: "",
                };
            match = raw.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/?(.*))?$/i);
            if (match)
                return {
                    owner: match[1],
                    repo: match[2],
                    ref: match[3] || "main",
                    path: (match[4] || "").split(/[?#]/)[0],
                };
            return githubFileReferenceFromUrl(raw);
        }

        function normalizeGithubImportUrl(url = "") {
            let clean = String(url || "").trim();
            while (clean.length > 1 && clean.endsWith("/"))
                clean = clean.slice(0, -1);
            return clean;
        }

        function githubPathSegments(path = "") {
            return String(path || "")
                .split("/")
                .filter(Boolean)
                .map((segment) => {
                    try {
                        return decodeURIComponent(segment);
                    } catch {
                        return segment;
                    }
                });
        }

        function githubContentsApiUrl(reference = {}) {
            const path = githubPathSegments(reference.path)
                .map(encodeURIComponent)
                .join("/");
            const pathPart = path ? `/${path}` : "";
            return `https://api.github.com/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}/contents${pathPart}?ref=${encodeURIComponent(reference.ref || "main")}`;
        }

        function githubFileUrlFromReference(reference = {}) {
            const path = githubPathSegments(reference.path)
                .map(encodeURIComponent)
                .join("/");
            return `https://github.com/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}/blob/${encodeURIComponent(reference.ref || "main")}/${path}`;
        }

        function githubFileNameFromUrl(url = "") {
            const raw = String(url || "").split(/[?#]/)[0] || "";
            const name = decodeURIComponent(raw.split("/").filter(Boolean).pop() || "github-import.json");
            return compressedJsonFileName(name) ? name : `${name}.json`;
        }

        function githubTokenHeaders(token = "") {
            const clean = String(token || "").trim();
            return clean ? { Authorization: `Bearer ${clean}` } : {};
        }

        async function downloadGithubImportFile(url = "", token = "") {
            return downloadImportFileInWorker("github", { url, token });
        }

        async function listGithubDirectoryEntries(reference = {}, token = "") {
            try {
                return await storyImportWorkerRequest("list-github-import-directory", {
                    reference,
                    token,
                });
            } catch (error) {
                logImportException("GitHub import directory fetch failed", error, {
                    owner: String(reference?.owner || "").trim(),
                    repo: String(reference?.repo || "").trim(),
                    ref: String(reference?.ref || "").trim(),
                    path: String(reference?.path || "").trim(),
                    requestKind: "list-github-import-directory",
                });
                throw error;
            }
        }

        function showGithubImportPrompt() {
            return new Promise((resolve) => {
                const savedOwners = Object.values(githubImportTokenVault())
                    .map((record) => String(record?.owner || "").trim())
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b));
                const savedText = savedOwners.length
                    ? `Saved local tokens: ${savedOwners.join(", ")}. Matching saved tokens are used automatically.`
                    : "No GitHub tokens are saved on this device yet.";
                const savedFolderOptions = githubImportFolderHistory()
                    .map(
                        (record) =>
                            `<option value="${escapeHtml(record.url)}">${escapeHtml(record.label || record.url)}</option>`,
                    )
                    .join("");
                const popup = openPopupModal(`
                    <h2>Import from GitHub</h2>
                    <p class="hint">Paste one or more GitHub file URLs. Public files work without a token. Private repos need a GitHub fine-grained token.</p>
                    <textarea id="githubImportUrls" rows="6" placeholder="https://github.com/owner/repo/blob/main/story.json"></textarea>
                    <label style="margin-top:.6rem">Saved folders
                        <select id="githubImportSavedFolder">
                            <option value="">Choose a remembered folder...</option>
                            ${savedFolderOptions}
                        </select>
                    </label>
                    <label style="margin-top:.6rem">Browse a repo folder
                        <input id="githubImportFolder" type="text" placeholder="owner/repo or https://github.com/owner/repo/tree/main/folder">
                    </label>
                    <div class="row" style="margin-top:.45rem">
                        <button type="button" id="githubImportLoadFolderBtn">Load Folder</button>
                    </div>
                    <div id="githubImportFolderResults" class="hint" style="margin-top:.5rem"></div>
                    <p class="hint">${escapeHtml(savedText)}</p>
                    <details style="margin-top:.65rem" open>
                        <summary>How to make a token for a private repo</summary>
                        <ol class="hint" style="margin:.5rem 0 0 1.2rem">
                            <li>Open GitHub fine-grained tokens.</li>
                            <li>Click <strong>Generate new token</strong>.</li>
                            <li>Set <strong>Repository access</strong> to <strong>Only select repositories</strong>.</li>
                            <li>Select the private repo that contains your story or character files.</li>
                            <li>Under <strong>Repository permissions</strong>, set <strong>Contents</strong> to <strong>Read-only</strong>.</li>
                            <li>Leave every other permission as <strong>No access</strong>, generate the token, then paste it below.</li>
                        </ol>
                        <div class="row" style="margin-top:.55rem">
                            <button type="button" onclick="window.open('https://github.com/settings/personal-access-tokens/new', '_blank', 'noopener')">Open GitHub Token Page</button>
                        </div>
                    </details>
                    <label style="margin-top:.6rem">GitHub token for private repos
                        <input id="githubImportToken" type="password" autocomplete="off" placeholder="Optional">
                    </label>
                    <label class="check-row" style="margin-top:.45rem">
                        <input id="githubImportSaveToken" type="checkbox" checked>
                        <span>Save this token locally for the GitHub owner in the URL.</span>
                    </label>
                    <p class="hint">Saved tokens stay on this device only. They are keyed by GitHub owner, such as andro951, and are not saved to your profile or synced.</p>
                    <div class="row" style="margin-top:.8rem">
                        <button class="primary" id="githubImportSubmitBtn">Import</button>
                        <button id="githubImportCancelBtn">Cancel</button>
                    </div>
                `);
                let selectedUrls = [];
                let currentFolder = null;
                const tokenValue = () => popup.box.querySelector("#githubImportToken")?.value || "";
                const renderSavedFolderOptions = () => {
                    const select = popup.box.querySelector("#githubImportSavedFolder");
                    if (!select) return;
                    const options = githubImportFolderHistory()
                        .map(
                            (record) =>
                                `<option value="${escapeHtml(record.url)}">${escapeHtml(record.label || record.url)}</option>`,
                        )
                        .join("");
                    select.innerHTML = `
                        <option value="">Choose a remembered folder...</option>
                        ${options}
                    `;
                    if (!options)
                        select.disabled = true;
                    else
                        select.disabled = false;
                };
                const renderFolderEntries = (reference, entries = []) => {
                    currentFolder = reference;
                    const folders = entries.filter((entry) => entry.type === "dir");
                    const files = entries.filter((entry) => entry.type === "file");
                    const folderButtons = folders
                        .map(
                            (entry, index) =>
                                `<button type="button" data-github-folder-index="${index}">&#128193; ${escapeHtml(entry.name)}</button>`,
                        )
                        .join("");
                    const fileRows = files
                        .map(
                            (entry, index) =>
                                `<label class="check-row"><input type="checkbox" data-github-file-index="${index}"> <span>${escapeHtml(entry.name)}</span></label>`,
                        )
                        .join("");
                    popup.box.querySelector("#githubImportFolderResults").innerHTML = `
                        <div><strong>${escapeHtml(reference.owner)}/${escapeHtml(reference.repo)}${reference.path ? `/${escapeHtml(reference.path)}` : ""}</strong></div>
                        ${folderButtons ? `<div class="row" style="margin-top:.45rem">${folderButtons}</div>` : ""}
                        ${fileRows || `<p class="hint">No JSON or compressed JSON files in this folder.</p>`}
                    `;
                    popup.box.querySelectorAll("[data-github-folder-index]").forEach((button) => {
                        button.onclick = () => {
                            const entry = folders[Number(button.dataset.githubFolderIndex)];
                            if (!entry) return;
                            loadFolder({
                                ...reference,
                                path: entry.path,
                            });
                        };
                    });
                    popup.box.querySelectorAll("[data-github-file-index]").forEach((input) => {
                        input.onchange = () => {
                            selectedUrls = files
                                .filter((_entry, index) => !!popup.box.querySelector(`[data-github-file-index="${index}"]`)?.checked)
                                .map((entry) => entry.url);
                        };
                    });
                    selectedUrls = [];
                };
                const showFolderError = (message) => {
                    popup.box.querySelector("#githubImportFolderResults").innerHTML =
                        `<p class="hint">${escapeHtml(message || "GitHub folder could not be loaded.")}</p>`;
                };
                const loadFolder = (reference) => {
                    if (!reference) {
                        showFolderError("Enter a GitHub repo or folder URL first.");
                        return;
                    }
                    popup.box.querySelector("#githubImportFolderResults").textContent = "Loading GitHub folder...";
                    listGithubDirectoryEntries(reference, tokenValue() || savedGithubImportToken(reference.owner))
                        .then((entries) => {
                            rememberGithubImportFolder(reference);
                            renderSavedFolderOptions();
                            renderFolderEntries(reference, entries);
                        })
                        .catch((error) => showFolderError(error.message || String(error)));
                };
                const finish = (value) => {
                    popup.close();
                    resolve(value);
                };
                popup.box.querySelector("#githubImportLoadFolderBtn").onclick = () =>
                    loadFolder(
                        githubDirectoryReferenceFromText(
                            popup.box.querySelector("#githubImportFolder")?.value || "",
                        ),
                    );
                popup.box.querySelector("#githubImportSavedFolder").onchange = (event) => {
                    const url = String(event.target?.value || "").trim();
                    if (!url) return;
                    const input = popup.box.querySelector("#githubImportFolder");
                    if (input) input.value = url;
                    loadFolder(githubDirectoryReferenceFromText(url));
                };
                popup.box.querySelector("#githubImportSubmitBtn").onclick = () =>
                    finish({
                        urls: [
                            popup.box.querySelector("#githubImportUrls")?.value || "",
                            ...selectedUrls,
                        ].join("\n"),
                        token: popup.box.querySelector("#githubImportToken")?.value || "",
                        saveToken: !!popup.box.querySelector("#githubImportSaveToken")?.checked,
                        folderOwner: currentFolder?.owner || "",
                    });
                popup.box.querySelector("#githubImportCancelBtn").onclick = () => finish(null);
                popup.box.querySelector("#githubImportUrls")?.focus?.();
            });
        }

        async function chooseGithubImportFiles(options = {}) {
            if (typeof options.githubPicker === "function")
                return options.githubPicker(options);
            const value = await showGithubImportPrompt();
            if (!value) return [];
            const urls = githubImportUrlsFromText(value.urls);
            if (!urls.length) return [];
            const pastedToken = String(value.token || "").trim();
            if (pastedToken && value.saveToken) {
                for (const owner of [...githubImportOwnersFromUrls(urls), String(value.folderOwner || "").toLowerCase()].filter(Boolean))
                    saveGithubImportToken(owner, pastedToken);
            }
            devLog("GitHub import URLs selected", {
                type: "system",
                level: "message",
                count: urls.length,
                authenticated: !!pastedToken || urls.some((url) => !!savedGithubImportToken(githubImportOwnerFromUrl(url))),
            });
            return downloadImportFilesWithActivity(urls, (url) =>
                downloadGithubImportFile(
                    url,
                    pastedToken || savedGithubImportToken(githubImportOwnerFromUrl(url)),
                ),
            );
        }

        async function chooseImportFiles(options = {}) {
            let source = String(options.source || "").trim();
            if (!source && options.allowGoogleDrive !== false) {
                source = await showChoice(
                    options.sourceTitle || "Import Files",
                    "Choose where to import files from.",
                    [
                        { value: "computer", label: "Computer", className: "primary" },
                        { value: "google-drive", label: "Google Drive" },
                        { value: "github", label: "GitHub" },
                        { value: "cancel", label: "Cancel" },
                    ],
                );
            }
            if (!source) source = "computer";
            if (source === "cancel") return [];
            if (source === "google-drive") return chooseGoogleDriveImportFiles(options);
            if (source === "github") return chooseGithubImportFiles(options);
            return chooseComputerImportFiles(options);
        }

        async function parseImportFilesInWorker(files = [], label = "Importing") {
            const list = Array.from(files || []);
            if (!list.length) return [];
            return runBackgroundTask(
                "import-json",
                `${label} 0/${list.length}`,
                async ({ update }) => {
                    let completed = 0;
                    const texts = await mapWithConcurrency(list, 4, async (file) => {
                        const text = await file.text();
                        completed++;
                        update(`${label} ${completed}/${list.length}`);
                        return text;
                    });
                    update(`${label} ${list.length}/${list.length}`);
                    return persistenceWorkerRequest("json-parse", { texts });
                },
                { priority: 80, workLabel: "parse imported JSON" },
            );
        }

        async function prepareCharacterImportRecordsInWorker(files = [], context = {}, label = "Importing") {
            const list = Array.from(files || []);
            if (!list.length) return [];
            return runBackgroundTask(
                "character-import-prepare",
                `${label} 0/${list.length}`,
                async ({ update }) => {
                    const prepared = await storyImportWorkerRequest(
                        "prepare-character-import",
                        { files: list, context },
                        { onProgress: update },
                    );
                    const failures = prepared.map((item) => item?.error).filter(Boolean);
                    if (failures.length) throw importRejectionError(failures);
                    return prepared.flatMap((item) => item?.records || []);
                },
                {
                    priority: 80,
                    workLabel: "prepare imported character records",
                    propagateError: true,
                },
            );
        }

        async function validateCharacterImportRecordsInWorker(records = []) {
            const list = Array.from(records || []);
            if (!list.length) return [];
            return storyImportWorkerRequest("validate-character-import", { records: list });
        }

        function importedCharacterDefinitionErrorsFromValidations(validations = []) {
            return (validations || []).flatMap((item) =>
                (item?.validation?.errors || []).map((error) => ({
                    ...error,
                    path: `${item?.name || "Imported Character"}.${error.path}`,
                })),
            );
        }

        async function pickCharacterImportFiles(options = {}) {
            try {
                const files = await chooseImportFiles({
                    ...options,
                    accept: COMPRESSED_JSON_IMPORT_ACCEPT,
                    multiple: options.multiple !== false,
                    sourceTitle: options.playerOnly ? "Import Player" : "Import Characters",
                });
                if (!files.length) return;
                return await withActivityTask(files.length === 1 ? "Importing 1/1" : `Importing 0/${files.length}`, async () => {
                    const records = await prepareCharacterImportRecordsInWorker(
                        files,
                        { kind: options.defaultKind },
                        "Importing",
                    );
                    await importCharacterRecords(records, options);
                }, {
                    priority: 85,
                    kind: "import",
                });
            } catch (e) {
                handleCharacterImportFailure("Character import failed", e, {
                    requestKind: "character-file-import",
                    playerOnly: options.playerOnly === true,
                    defaultKind: String(options.defaultKind || "").trim(),
                });
            }
        }

        function importCharacters() {
            return pickCharacterImportFiles({ multiple: true });
        }

        function importPartyCharacters() {
            return pickCharacterImportFiles({
                multiple: true,
                defaultKind: "character",
                forceKind: "character",
            });
        }

        function importNpcs() {
            return pickCharacterImportFiles({
                multiple: true,
                defaultKind: "npc",
                forceKind: "npc",
            });
        }

        async function importCharacterDefinitions() {
            try {
                const files = await chooseImportFiles({
                    accept: COMPRESSED_JSON_IMPORT_ACCEPT,
                    multiple: true,
                    sourceTitle: "Import Character Definitions",
                });
                if (!files.length) return;
                return await withActivityTask(files.length === 1 ? "Importing 1/1" : `Importing 0/${files.length}`, async () => {
                    const records = await prepareCharacterImportRecordsInWorker(
                        files,
                        {},
                        "Importing",
                    );
                    await importCharacterDefinitionsFromRecords(records);
                }, {
                    priority: 85,
                    kind: "import",
                });
            } catch (e) {
                handleCharacterImportFailure("Character definition import failed", e, {
                    requestKind: "character-definition-file-import",
                });
            }
        }

        async function importPlayer() {
            const choice = await showChoice(
                "Import Player?",
                "Importing a player deletes the current player state. Export the current player first?",
                [
                    { value: "export", label: "Export First", className: "primary" },
                    { value: "replace", label: "Replace" },
                    { value: "cancel", label: "Cancel" },
                ],
            );
            if (choice === "cancel") return;
            if (choice === "export") exportPlayerCharacter();
            return pickCharacterImportFiles({
                multiple: true,
                playerOnly: true,
                playerWarningAccepted: true,
                defaultKind: "player",
            });
        }

        const DIAGNOSTIC_EXPORT_PHASE_KEY =
            "emberadventureslite-diagnostic-export-phase";

        function diagnosticMemorySnapshot() {
            const memory = performance?.memory;
            return {
                usedJsHeapBytes: Number(memory?.usedJSHeapSize) || 0,
                totalJsHeapBytes: Number(memory?.totalJSHeapSize) || 0,
                jsHeapLimitBytes: Number(memory?.jsHeapSizeLimit) || 0,
                deviceMemoryGb: Number(navigator.deviceMemory) || 0,
                hardwareConcurrency: Number(navigator.hardwareConcurrency) || 0,
            };
        }

        function readDiagnosticExportPhase() {
            try {
                return (
                    JSON.parse(
                        localStorage.getItem(DIAGNOSTIC_EXPORT_PHASE_KEY) ||
                            "null",
                    ) || null
                );
            } catch {
                return null;
            }
        }

        async function refreshAdminInboxCounts() {
            const result = await notifyAdminPublicReportCount({ startup: true });
            if (result) openAdminInboxNotice();
            return result;
        }

        const PUBLIC_HOSTED_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
        const PUBLIC_HOSTED_IMAGE_TIMEOUT_MS = 30000;

        function publicHostedImageUrl(value = "") {
            return String(value || "").trim();
        }

        function publicCharacterHostedImageManifest(records = []) {
            const entries = [];
            for (const record of (Array.isArray(records) ? records : [records]).filter(Boolean)) {
                const character =
                    record.character_definition || record.character || record;
                for (const [presentation, male] of [["male", true], ["non-male", false]]) {
                    const slot = profileImagePresentationSlot(character, male) || {};
                    entries.push({
                        label: `${character.name || record.name || "Character"} ${presentation} profile`,
                        url: publicHostedImageUrl(slot.url || slot.hosted_url),
                    });
                }
            }
            return entries;
        }

        function publicStoryHostedImageManifest(template = {}) {
            return storyBuilderImageManifest(template)
                .filter((entry) => {
                    if (entry.kind !== "story-reward") return true;
                    const slot = entry.reward?.image || {};
                    return !!publicHostedImageUrl(slot.url || slot.hosted_url);
                })
                .map((entry) => {
                    let url = "";
                    if (entry.kind === "title")
                        url = publicHostedImageUrl(template.title_card_image?.url || template.title_card_image?.hosted_url);
                    else if (entry.kind === "profile") {
                        const slot = profileImagePresentationSlot(entry.character, entry.male === true) || {};
                        url = publicHostedImageUrl(slot.url || slot.hosted_url);
                    } else if (entry.kind === "unlock") {
                        const slot = entry.entry?.on_unlock?.image || {};
                        url = publicHostedImageUrl(slot.url || slot.hosted_url);
                    } else if (entry.kind === "story-reward") {
                        const slot = entry.reward?.image || {};
                        url = publicHostedImageUrl(slot.url || slot.hosted_url);
                    } else if (entry.kind === "authored-asset") {
                        const slot = entry.asset || {};
                        url = publicHostedImageUrl(slot.url || slot.hosted_url);
                    }
                    return {
                        label: `${entry.group || "Story"}: ${entry.title || entry.slotId || entry.kind}`,
                        url,
                    };
                });
        }

        async function decodeVerifiedHostedImage(blob, label = "Hosted image") {
            if (typeof createImageBitmap === "function") {
                try {
                    const bitmap = await createImageBitmap(blob);
                    const valid = bitmap.width > 0 && bitmap.height > 0;
                    bitmap.close?.();
                    if (valid) return;
                } catch {
                    // Some browser builds reject valid small PNGs here. The
                    // normal image decoder below remains an independent check.
                }
            }
            if (typeof Image !== "function" || !URL?.createObjectURL)
                throw new Error(`${label} could not be decoded by this browser.`);
            const objectUrl = URL.createObjectURL(blob);
            try {
                await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0
                        ? resolve()
                        : reject(new Error(`${label} decoded with no dimensions.`));
                    image.onerror = () => reject(new Error(`${label} could not be decoded as an image.`));
                    image.src = objectUrl;
                });
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        }

        async function verifyPublicHostedImageOnce(entry = {}) {
            const label = String(entry.label || "Hosted image");
            const url = publicHostedImageUrl(entry.url);
            if (!/^https:\/\//i.test(url))
                throw new Error(`${label} must have a durable HTTPS hosted URL before publication.`);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PUBLIC_HOSTED_IMAGE_TIMEOUT_MS);
            try {
                const response = await fetch(url, {
                    cache: "no-store",
                    credentials: "omit",
                    referrerPolicy: "no-referrer",
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
                const contentType = String(response.headers?.get?.("content-type") || "").split(";")[0].trim().toLowerCase();
                if (!/^image\/(?:png|jpeg|webp)$/.test(contentType))
                    throw new Error(`${label} returned unsupported content type ${contentType || "unknown"}.`);
                const declaredSize = Number(response.headers?.get?.("content-length") || 0);
                if (declaredSize > PUBLIC_HOSTED_IMAGE_MAX_BYTES)
                    throw new Error(`${label} exceeds the 20 MB public image limit.`);
                const blob = await response.blob();
                if (!blob.size) throw new Error(`${label} returned an empty file.`);
                if (blob.size > PUBLIC_HOSTED_IMAGE_MAX_BYTES)
                    throw new Error(`${label} exceeds the 20 MB public image limit.`);
                await decodeVerifiedHostedImage(blob, label);
                return { label, url, bytes: blob.size, contentType };
            } catch (err) {
                if (err?.name === "AbortError")
                    throw new Error(`${label} did not respond within 30 seconds.`);
                throw err;
            } finally {
                clearTimeout(timer);
            }
        }

        async function verifyPublicHostedImage(entry = {}) {
            return retryTransientHostedRead(() =>
                verifyPublicHostedImageOnce(entry),
            );
        }

        async function verifyPublicHostedImageManifest(entries = [], options = {}) {
            const manifest = (Array.isArray(entries) ? entries : []).filter(Boolean);
            if (!manifest.length) throw new Error("The publication contains no reusable image slots.");
            const missing = manifest.filter((entry) => !publicHostedImageUrl(entry.url));
            if (missing.length)
                throw new Error(`Missing required public images:\n${missing.map((entry) => `- ${entry.label}`).join("\n")}`);
            const byUrl = new Map();
            for (const entry of manifest) {
                const url = publicHostedImageUrl(entry.url);
                if (!byUrl.has(url)) byUrl.set(url, entry);
            }
            const verified = [];
            let current = 0;
            const updateStatus = typeof options.onStatus === "function"
                ? options.onStatus
                : setStatus;
            for (const entry of byUrl.values()) {
                current++;
                updateStatus(`Verifying hosted image ${current} of ${byUrl.size}: ${entry.label}`);
                verified.push(await verifyPublicHostedImage(entry));
            }
            log("Public hosted image manifest verified", prettyJson({
                label: options.label || "publication",
                slots: manifest.length,
                uniqueFiles: verified.length,
                files: verified,
            }), { type: "troubleshooting", level: "message" });
            return verified;
        }

        function publicHostedImageManifestFromPayload(payload = {}, type = "") {
            if (type === "story-template")
                return publicStoryHostedImageManifest(storyTemplateRecordFromPayload(payload));
            return publicCharacterHostedImageManifest(characterImportRecordsFromExport(payload));
        }

        function writeDiagnosticExportPhase(update = {}) {
            const current = readDiagnosticExportPhase() || {};
            const next = {
                ...current,
                ...update,
                heartbeatAt: new Date().toISOString(),
                memory: diagnosticMemorySnapshot(),
            };
            localStorage.setItem(
                DIAGNOSTIC_EXPORT_PHASE_KEY,
                JSON.stringify(next),
            );
            return next;
        }

        function beginDiagnosticExport(fileName = "") {
            const at = new Date().toISOString();
            const record = {
                id: crypto.randomUUID(),
                status: "in_progress",
                phase: "starting",
                fileName: String(fileName || ""),
                startedAt: at,
                heartbeatAt: at,
                userAgent: navigator.userAgent,
                memory: diagnosticMemorySnapshot(),
            };
            localStorage.setItem(
                DIAGNOSTIC_EXPORT_PHASE_KEY,
                JSON.stringify(record),
            );
            return record;
        }

        function finishDiagnosticExport(status = "complete", detail = {}) {
            return writeDiagnosticExportPhase({
                status,
                phase: status,
                finishedAt: new Date().toISOString(),
                ...detail,
            });
        }

        function reportInterruptedDiagnosticExport() {
            const previous = readDiagnosticExportPhase();
            if (!previous) return null;
            if (previous.status !== "in_progress") {
                localStorage.removeItem(DIAGNOSTIC_EXPORT_PHASE_KEY);
                return null;
            }
            const issue = reportAppIssue(
                new Error(
                    `The previous diagnostic export ended before completion during "${previous.phase || "unknown"}". Chrome may have terminated or discarded the page.`,
                ),
                {
                    severity: "warning",
                    title: "Diagnostic Export Interrupted",
                    context: "diagnostic export",
                    details: {
                        previous,
                        restoredPageWasDiscarded: !!document.wasDiscarded,
                        navigationType:
                            performance
                                .getEntriesByType?.("navigation")?.[0]?.type ||
                            "",
                        currentMemory: diagnosticMemorySnapshot(),
                    },
                },
            );
            localStorage.removeItem(DIAGNOSTIC_EXPORT_PHASE_KEY);
            return issue;
        }

        function downloadDiagnosticBlob(blob, fileName = "") {
            if (!(blob instanceof Blob))
                throw new Error(
                    "The current library worker did not return a diagnostic export file.",
                );
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = String(fileName || "emberadventureslite-issue-backup.json");
            app.__emberAdventuresLastBlobDownload = {
                filename: link.download,
                blob,
            };
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 2000);
        }

        async function exportEmergencyData(fileName = "", options = {}) {
            const diagnostic = beginDiagnosticExport(fileName);
            let heartbeat = 0;
            try {
                heartbeat = setInterval(
                    () =>
                        writeDiagnosticExportPhase({
                            id: diagnostic.id,
                            status: "in_progress",
                        }),
                    1000,
                );
                writeDiagnosticExportPhase({
                    id: diagnostic.id,
                    phase: "reading current durable store",
                });
                const result = await app.library.diagnosticExport({
                    build: emberAdventuresBuildInfo(),
                    storageFailures:
                        app.storageFailures ||
                        root.__emberAdventuresStorageFailures ||
                        [],
                    scope: options?.scope || null,
                    onProgress: (progress) => {
                        const phase = String(
                            progress?.phase || "working",
                        );
                        writeDiagnosticExportPhase({
                            id: diagnostic.id,
                            phase,
                            progress,
                        });
                        devLog("Diagnostic export progress", progress);
                    },
                });
                writeDiagnosticExportPhase({
                    id: diagnostic.id,
                    phase: "starting download",
                    result: {
                        bytes: Number(result?.bytes) || 0,
                        profileCount: Number(result?.profileCount) || 0,
                        storyCount: Number(result?.storyCount) || 0,
                        characterCount: Number(result?.characterCount) || 0,
                    },
                });
                downloadDiagnosticBlob(result?.blob, fileName);
                finishDiagnosticExport("complete", {
                    id: diagnostic.id,
                    result: {
                        bytes: Number(result?.bytes) || 0,
                        profileCount: Number(result?.profileCount) || 0,
                    },
                });
                return result;
            } catch (error) {
                finishDiagnosticExport("failed", {
                    id: diagnostic.id,
                    error: error?.message || String(error),
                });
                throw error;
            } finally {
                if (heartbeat) clearInterval(heartbeat);
            }
        }

        async function buildDiagnosticExportPayload() {
            flushScheduledSaveAll("saved before diagnostic export");
            flushCurrentGameAutosaveIfPossible("autosaved before diagnostic export");
            await flushLargeSaves();
            const saveIndex = saveIndexRecords();
            const saves = (
                await Promise.all(
                    saveIndex.map(async (record) => {
                        const save = await loadSaveRecord(record.saveId);
                        if (!save) return null;
                        return {
                            index: save.index,
                            state: save.state,
                            messages: save.messages,
                            snapshotCount: save.snapshots?.length || 0,
                        };
                    }),
                )
            ).filter(Boolean);
            const imageMetadata = (records = []) =>
                (Array.isArray(records) ? records : []).map((record) => {
                    const next = { ...record };
                    delete next.html;
                    delete next.image_html;
                    return next;
                });
            return {
                build: emberAdventuresBuildInfo(),
                activeSaveId: activeSaveId(),
                saveIndex,
                saves,
                settings: localSettingsForStorage(),
                userProfiles: validatedUserProfiles(app.userProfiles),
                creatorIdentityRegistry: creatorIdentityRegistry(),
                storyTemplates: app.storyTemplates,
                characterDefinitions: validatedCharacterLibraryDefinitions(app.characterDefinitions || []),
                profileImages: imageMetadata(exactProfileImageStore(
                    (await loadPerRecordLibrary(PROFILE_IMAGE_KEY, app.profileImages || [])) || [],
                )),
                storyTitleCardImages: imageMetadata(exactStoryTitleCardImageStore(
                    (await loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || [])) || [],
                )),
                runtimeSnapshot: {
                    activeSaveId: activeSaveId(),
                    state: gameSaveStateForStorage(app.state),
                    messages: app.messages,
                    imageMetadata: imageMetadata(app.images),
                    snapshotCount: app.snapshots?.length || 0,
                },
                storageFailures: app.storageFailures || root.__emberAdventuresStorageFailures || [],
                exportedAt: new Date().toISOString(),
                app: "EmberAdventures",
            };
        }

        const FULL_BACKUP_EXPORT_V1_FIELDS = Object.freeze([
            "app",
            "exportType",
            "schemaVersion",
            "exportedAt",
            "activeSaveId",
            "saveIndex",
            "saves",
            "settings",
            "userProfiles",
            "creatorIdentityRegistry",
            "storyTemplates",
            "characterDefinitions",
            "profileImages",
            "storyTitleCardImages",
            "storageFailures",
        ]);
        const FULL_BACKUP_EXPORT_V2_FIELDS = Object.freeze([
            "app",
            "exportType",
            "schemaVersion",
            "exportedAt",
            "activeSaveId",
            "saveIndex",
            "saves",
            "settings",
            "userProfiles",
            "creatorIdentityRegistry",
            "storyTemplates",
            "characterDefinitions",
            "imageArchiveRequired",
            "storageFailures",
        ]);

        function validateFullBackupExport(data = {}) {
            const fields = data?.schemaVersion === 1
                ? FULL_BACKUP_EXPORT_V1_FIELDS
                : FULL_BACKUP_EXPORT_V2_FIELDS;
            const errors = [
                ...exactObjectFieldValidationErrors(
                    data,
                    fields,
                    "full backup",
                ),
                ...requiredExactFieldsValidationErrors(
                    data,
                    fields,
                    "full backup",
                ),
            ];
            if (!isPlainObject(data)) return validationResult(errors);
            if (data.app !== "EmberAdventures")
                errors.push(validationError("app", "value", 'app must be exactly "EmberAdventures".'));
            if (data.exportType !== "full-backup")
                errors.push(validationError("exportType", "value", 'exportType must be exactly "full-backup".'));
            if (![1, 2].includes(data.schemaVersion))
                errors.push(validationError("schemaVersion", "value", "schemaVersion must be exactly 1 or 2."));
            if (data.schemaVersion === 2 && data.imageArchiveRequired !== true)
                errors.push(validationError("imageArchiveRequired", "value", "imageArchiveRequired must be true."));
            errors.push(...requiredExactTextValidationErrors(data.exportedAt, "exportedAt"));
            if (data.activeSaveId !== null && (!Number.isSafeInteger(data.activeSaveId) || data.activeSaveId < 1))
                errors.push(validationError("activeSaveId", "type", "activeSaveId must be a positive safe integer or null."));

            const requireArray = (field) => {
                if (!Array.isArray(data[field])) {
                    errors.push(validationError(field, "type", `${field} must be an array.`));
                    return false;
                }
                return true;
            };

            if (requireArray("saveIndex"))
                data.saveIndex.forEach((record, index) => {
                    errors.push(...validateSaveIndexRecord(record, `saveIndex.${index}`).errors);
                });
            if (requireArray("saves"))
                data.saves.forEach((save, index) => {
                    if (!isPlainObject(save))
                        errors.push(validationError(`saves.${index}`, "type", `saves.${index} must be a save-export object.`));
                });
            if (isPlainObject(data.settings))
                errors.push(...validateStoredSettings(data.settings).errors);
            else
                errors.push(validationError("settings", "type", "settings must be an object."));
            if (requireArray("userProfiles"))
                data.userProfiles.forEach((profile, index) => {
                    errors.push(...validateUserProfileDefinition(profile, `userProfiles.${index}`).errors);
                });
            if (isPlainObject(data.creatorIdentityRegistry))
                errors.push(...validateCreatorIdentityRegistry(data.creatorIdentityRegistry).errors);
            else
                errors.push(validationError("creatorIdentityRegistry", "type", "creatorIdentityRegistry must be an object."));
            if (requireArray("storyTemplates"))
                data.storyTemplates.forEach((story, index) => {
                    const validation = validateStoryDefinition(story);
                    errors.push(...validation.errors.map((error) => ({
                        ...error,
                        path: `storyTemplates.${index}.${error.path}`,
                    })));
                });
            if (requireArray("characterDefinitions"))
                data.characterDefinitions.forEach((record, index) => {
                    errors.push(...validateCharacterLibraryRecord(record, `characterDefinitions.${index}`).errors);
                });
            if (data.schemaVersion === 1) {
                if (Array.isArray(data.profileImages))
                    errors.push(...validateProfileImageStore(data.profileImages).errors);
                else
                    errors.push(validationError("profileImages", "type", "profileImages must be an array."));
                if (Array.isArray(data.storyTitleCardImages))
                    errors.push(...validateStoryTitleCardImageStore(data.storyTitleCardImages).errors);
                else
                    errors.push(validationError("storyTitleCardImages", "type", "storyTitleCardImages must be an array."));
            }
            requireArray("storageFailures");
            return validationResult(errors);
        }

        async function exportData(options = {}) {
            const emergency = !!options?.emergency;
            const fileName =
                typeof options?.fileName === "string" && options.fileName.trim()
                    ? options.fileName.trim()
                    : "emberadventureslite-export.json";
            if (emergency)
                return exportEmergencyData(fileName, {
                    scope: options?.scope || null,
                });
            if (!emergency) {
                flushScheduledSaveAll("saved before export");
                flushCurrentGameAutosaveIfPossible("autosaved before export");
            }
            await flushLargeSaves();
            const scope = options?.scope || null;
            const scopedIds = (key = "") =>
                scope && Array.isArray(scope[key])
                    ? new Set(scope[key].map(String).filter(Boolean))
                    : null;
            const scopedRecords = (
                records = [],
                ids = null,
                idForRecord = (record) => record?.id,
            ) =>
                ids instanceof Set
                    ? records.filter((record) =>
                          ids.has(String(idForRecord(record) || "")),
                      )
                    : records;
            const saveIndex = scopedRecords(
                saveIndexRecords(),
                scopedIds("saveIds"),
                (record) => record?.saveId,
            ).map((record) => ({
                ...record,
                titleImageHtml: "",
            }));
            const saves = [];

            for (const record of saveIndex) {
                const exported = await app.persistence.exportSave(Number(record.saveId));

                if (!(exported?.blob instanceof Blob))
                    throw new Error(`Saved game ${record.saveId} could not be exported.`);

                saves.push(JSON.parse(await exported.blob.text()));
            }
            const selectedActiveSaveId = Number(
                saveIndex.find(
                    (record) => String(record.saveId) === String(activeSaveId()),
                )?.saveId || saveIndex[0]?.saveId || 0,
            );
            const payload = {
                    activeSaveId:
                        Number.isSafeInteger(selectedActiveSaveId) &&
                        selectedActiveSaveId > 0
                            ? selectedActiveSaveId
                            : null,
                    saveIndex,
                    saves,
                    settings: localSettingsForStorage(),
                    userProfiles: validatedUserProfiles(app.userProfiles),
                    creatorIdentityRegistry: creatorIdentityRegistry(),
                    storyTemplates: scopedRecords(
                        app.storyTemplates,
                        scopedIds("storyIds"),
                    ),
                    characterDefinitions: scopedRecords(
                        validatedCharacterLibraryDefinitions(
                            app.characterDefinitions || [],
                        ),
                        scopedIds("characterIds"),
                    ),
                    imageArchiveRequired: true,
                    storageFailures:
                        app.storageFailures ||
                        root.__emberAdventuresStorageFailures ||
                        [],
                    exportedAt: new Date().toISOString(),
                    app: "EmberAdventures",
                    exportType: "full-backup",
                    schemaVersion: 2,
                };
            const validation = validateFullBackupExport(payload);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            downloadJsonPayload(payload, fileName, {
                portableBlobUrls: false,
                pretty: false,
            });
        }
        async function backupNow() {
            await exportData({ fileName: "emberadventureslite-backup.json" });
            showNotice(
                "Backup Started",
                "Your browser should download an EmberAdventures backup file.",
            );
        }
        async function importData() {
            const files = await chooseImportFiles({
                accept: COMPRESSED_JSON_IMPORT_ACCEPT,
                multiple: false,
            });
            const file = files[0];
            if (!file) return;
                return withSavingOverlay(async () => {
                try {
                    const data = JSON.parse(await compressedJsonBlobText(file, file.name));
                    if (data?.exportType === "story-template") {
                        await importStoryTemplatePayload(data, {
                            openLibrary: false,
                            showNotice: true,
                        });
                        return;
                    }
                    if (data?.exportType === "full-backup") {
                        const validation = validateFullBackupExport(data);
                        if (!validation.ok) throw new Error(validationErrorsText(validation));
                        for (const key of localSettingKeys())
                            app.settings[key] = clone(data.settings[key]);
                        app.userProfiles = validatedUserProfiles(data.userProfiles);
                        app.creatorIdentityRegistry = exactCreatorIdentityRegistry(
                            data.creatorIdentityRegistry,
                        );
                        saveCreatorIdentityRegistry("backup imported");
                        app.storyTemplates = await compileStoryTemplateLibraryRecords(
                            data.storyTemplates,
                            {
                                onProgress: (message) =>
                                    setStatus(String(message || "Validating imported stories")),
                            },
                        );
                        app.characterDefinitions = validatedCharacterLibraryDefinitions(
                            data.characterDefinitions,
                        );
                        if (data.schemaVersion === 1) {
                            app.storyTitleCardImages = exactStoryTitleCardImageStore(
                                data.storyTitleCardImages,
                            );
                            saveStoryTitleImagesNow("legacy export import story title images");
                            app.profileImages = exactProfileImageStore(data.profileImages);
                            saveProfileImagesNow("legacy export import profile images");
                        }
                        else app.imageArchiveRestorePending = true;
                        saveStoryLibraryNow("export import story templates");
                        saveCharacterLibraryNow("export import character definitions");
                        const importedSaves = data.saves;
                        const importedSaveIdsByOriginalId = new Map();
                        let firstSaveId = "";

                        for (const saveBundle of importedSaves) {
                            const saveExport = clone(saveBundle);
                            const originalSaveId = String(
                                saveExport.records?.saveHeaders?.[0]?.saveId || "",
                            );
                            const importedRecord = await writeImportedSaveBundle(saveExport);
                            const importedSaveId = String(importedRecord?.saveId || "");

                            if (!firstSaveId)
                                firstSaveId = importedSaveId;
                            if (originalSaveId && importedSaveId)
                                importedSaveIdsByOriginalId.set(originalSaveId, importedSaveId);
                        }
                        const requestedActive = String(data.activeSaveId || "").trim();
                        const nextActive = importedSaveIdsByOriginalId.get(requestedActive) || firstSaveId;
                        if (nextActive)
                            await loadSaveIntoRuntime(nextActive, {
                                setActive: true,
                                scrollChatToBottom: true,
                            });

                        if (!(await flushActiveGameSave())) return;
                        log("Import complete", file.name);
                        if (data.schemaVersion === 2)
                            await showNotice(
                                "Data Imported",
                                "The data backup was imported. Import its matching image archive next to restore all images.",
                            );
                        return;
                    }
                    throw new Error(
                        "This does not look like a current EmberAdventures export.",
                    );
                } catch (e) {
                    showNotice("Import Failed", e.message || String(e));
                }
                }, "Importing Ember Adventures data...");
        }

        function devPlaytestMessageSummary(limit = 12) {
            return (app.messages || []).slice(-Math.max(1, Number(limit) || 12)).map((message) => ({
                id: message.id,
                role: message.role || "",
                speaker: message.speaker || "",
                text: String(message.text || ""),
                streaming: !!message.streaming,
                generationStopped: !!message.generationStopped,
            }));
        }

        function devPlaytestStateSummary() {
            const objective = currentObjectiveTarget(app.state);
            return {
                title: storyTemplateTitle(app.state),
                player: app.state?.player?.name || "",
                location: {
                    world: app.state?.location?.world || "",
                    region: app.state?.location?.region || "",
                    specific_place: app.state?.location?.specific_place || "",
                },
                scene: {
                    summary: app.state?.scene?.summary || "",
                    party_members_present: clone(app.state?.scene?.party_members_present || []),
                    npcs_present: clone(app.state?.scene?.npcs_present || []),
                },
                objective: objective
                    ? {
                          id: objective.id || "",
                          title: objective.title || "",
                          status: objective.status || "",
                          completion_control: objective.completion_control || "",
                      }
                    : null,
                story_rules: clone(app.state?.story_rules || []),
            };
        }

        function devPlaytestPromptSummary() {
            const call = app.promptEditorLastTextCall || null;
            return call
                ? {
                      label: call.label || "",
                      promptType: call.promptType || "",
                      at: call.at || "",
                      promptLength: String(call.prompt || "").length,
                      promptFingerprint: promptFingerprint(call.prompt || ""),
                      responseLength: String(call.response || "").length,
                  }
                : null;
        }

        function devPlaytestUiSummary() {
            const modal = $("modal");
            const modalOpen = !!modal?.classList?.contains("open");
            const modalBox = $("modalBox");
            const visibleText = (node) =>
                String(node?.textContent || "").replace(/\s+/g, " ").trim();
            const buttonSummary = (root = document) =>
                [...root.querySelectorAll("button")]
                    .filter((button) => button.offsetParent !== null)
                    .slice(0, 80)
                    .map((button) => ({
                        text: visibleText(button).slice(0, 120),
                        title: button.getAttribute("title") || "",
                        ariaLabel: button.getAttribute("aria-label") || "",
                        id: button.id || "",
                        disabled: !!button.disabled,
                    }));
            return {
                reducedUi: !!document.getElementById("app")?.classList?.contains("reduced-ui"),
                modalOpen,
                modal: modalOpen
                    ? {
                          title:
                              modalBox?.querySelector(".modal-chrome-title")?.textContent?.trim?.() ||
                              modalBox?.querySelector("h2,h3")?.textContent?.trim?.() ||
                              "",
                          text: visibleText(modalBox).slice(0, 1200),
                          buttons: buttonSummary(modalBox),
                      }
                    : null,
                composer: {
                    value: $("input")?.value || "",
                    placeholder: $("input")?.getAttribute("placeholder") || "",
                    sendText: visibleText($("sendBtn")),
                    sendDisabled: !!$("sendBtn")?.disabled,
                    imageDisabled: !!$("imageBtn")?.disabled,
                },
                topObjectiveText: visibleText($("topObjectivePanel")),
                visibleButtons: buttonSummary(document),
            };
        }

        function devPlaytestRecentTrace(limit = 60) {
            return (Array.isArray(app.devTrace) ? app.devTrace : [])
                .slice(-Math.max(1, Number(limit) || 60))
                .map((entry) => ({
                    id: entry.id,
                    at: entry.at || "",
                    type: entry.logType || entry.type || "",
                    level: entry.logLevel || entry.level || "",
                    title: entry.title || "",
                    detail: String(entry.detail || entry.text || "").slice(0, 2000),
                }));
        }

        function devPlaytestImageSummary(limit = 30) {
            return (Array.isArray(app.images) ? app.images : [])
                .slice(0, Math.max(1, Number(limit) || 30))
                .map((image) => ({
                    id: image.id || "",
                    kind: image.kind || image.type || "",
                    label: image.label || image.title || image.name || "",
                    characters: clone(image.characters || image.character_names || []),
                    pending: !!image.pending,
                    error: image.error || "",
                    hasHtml: !!image.html,
                    hasUrl: !!(image.url || image.hosted_url),
                    prompt: String(image.prompt || "").slice(0, 1200),
                    negativePrompt: String(image.negative_prompt || image.negativePrompt || "").slice(0, 1200),
                    createdAt: image.createdAt || image.created_at || "",
                }));
        }

        function devPlaytestPromptSourceSummary(type = "text") {
            const groups = type === "images" ? promptEditorImageSources() : promptEditorTextSources();
            return groups.map((group) => ({
                label: group.label || group.group || "",
                sources: (group.sources || group.buttons || []).map((source) => {
                    const out = {
                        id: source.id || "",
                        label: source.label || "",
                        group: group.label || group.group || "",
                        buildFrom: source.buildFrom || "",
                    };
                    try {
                        if (type === "images") {
                            const built = source.build?.() || {};
                            out.prompt = typeof built === "string" ? built : String(built.prompt || "");
                            out.negativePrompt = String(built.negativePrompt || "");
                        } else {
                            out.prompt = String(source.build?.() || "");
                        }
                    } catch (err) {
                        out.error = err?.message || String(err);
                    }
                    try {
                        out.shell = String(source.shellBuild?.() || "");
                    } catch (err) {
                        out.shellError = err?.message || String(err);
                    }
                    return out;
                }),
            }));
        }

        function devPlaytestImagePromptSamples() {
            const party = Array.isArray(app.state?.scene?.party_members_present)
                ? app.state.scene.party_members_present
                : [];
            const npcs = Array.isArray(app.state?.scene?.npcs_present)
                ? app.state.scene.npcs_present
                : [];
            const names = [
                ...party,
                ...npcs,
            ].filter(Boolean);
            return names.slice(0, 3).map((name) => {
                try {
                    const entity = runtimeImageEntity(name);
                    return {
                        id: "live-normal-character",
                        label: `Live normal image: ${name}`,
                        name,
                        prompt: buildImagePrompt(name, entity),
                        negativePrompt: buildNegativeImagePrompt(entity),
                    };
                } catch (err) {
                    return {
                        id: "live-normal-character",
                        label: `Live normal image: ${name}`,
                        name,
                        error: err?.message || String(err),
                    };
                }
            });
        }

        function devMergeAuditState(base = {}, patch = {}) {
            const out = clone(base || {});
            for (const [key, value] of Object.entries(patch || {})) {
                if (isPlainObject(value) && isPlainObject(out[key])) {
                    out[key] = devMergeAuditState(out[key], value);
                } else {
                    out[key] = clone(value);
                }
            }
            return out;
        }

        function devBuildImageAuditPrompt(sample = {}) {
            const priorState = app.state;
            const priorOnboardingDraft = app.onboardingDraft;
            const priorUserProfiles = app.userProfiles;
            const priorActiveUserProfileId = app.settings.activeUserProfileId;
            const statePatch = isPlainObject(sample.statePatch) ? sample.statePatch : {};
            app.state = devMergeAuditState(app.state || defaultState, statePatch);
            try {
                const entries = Array.isArray(sample.entities)
                    ? sample.entities
                    : [[sample.name || sample.entity?.name || "Audit Character", sample.entity || {}]];
                const normalizedEntries = entries
                    .map((entry) => {
                        if (Array.isArray(entry)) return [String(entry[0] || ""), entry[1] || {}];
                        return [String(entry?.name || "Audit Character"), entry?.entity || entry || {}];
                    })
                    .filter(([name, entity]) => name && entity);
                app.state.characters ||= {};
                app.state.scene ||= {};
                app.state.scene.party_members_present ||= [];
                for (const [name, entity] of normalizedEntries) {
                    app.state.characters[name] = clone(entity);
                    if (!app.state.scene.party_members_present.includes(name))
                        app.state.scene.party_members_present.push(name);
                }

                const runtimeEntries = normalizedEntries.map(([name]) => [
                    name,
                    app.state.characters[name],
                ]);
                const primary = runtimeEntries[0]?.[1] || {};
                const prompt =
                    sample.kind === "profile"
                        ? buildProfileImagePrompt(
                              normalizedEntries[0]?.[0] || "Audit Character",
                              primary,
                          )
                        : sample.kind === "story_title_card"
                          ? storyTitleCardPromptWithRules(
                                sample.prompt || "",
                                app.state,
                                sample.template || {},
                            )
                          : sample.group
                            ? buildGroupImagePrompt(runtimeEntries, {  })
                            : buildImagePrompt(runtimeEntries[0]?.[0] || "Audit Character", primary, {

                              });
                const safePrompt = sanitizeImagePromptForMode(prompt, {
                    entity: primary,
                });
                const negativePrompt =
                    sample.kind === "story_title_card"
                        ? buildStoryTitleCardNegativePrompt()
                        : sample.kind === "profile"
                          ? buildProfileNegativePrompt(primary, {

                            })
                          : sample.group
                            ? buildGroupImageNegativePrompt(runtimeEntries, {

                              })
                            : buildNegativeImagePrompt(primary);
                const model = activeNormalImageModel();
                const styled = applyImageArtStyle(safePrompt, negativePrompt, model);
                return {
                    prompt: safePrompt,
                    rawPrompt: prompt,
                    negativePrompt,
                    productionPrompt: styled.prompt,
                    productionNegativePrompt: styled.negativePrompt,
                    seed: normalImageSeedForEntities(runtimeEntries),
                    model,
                    resolution: "512x768",

                };
            } finally {
                app.state = priorState;
                app.onboardingDraft = priorOnboardingDraft;
                app.userProfiles = priorUserProfiles;
                app.settings.activeUserProfileId = priorActiveUserProfileId;
            }
        }

        function devPlaytestSummary() {
            const stateMessages = stateSyncMessageEntries();
            const stateSyncMessages = stateMessages.map((message) => ({
                id: message.id,
                entryId: Number(message.entryId || message.id || 0),
                role: message.role || "",
                stateSyncStatus: message.stateSyncStatus || "",
                textLength: String(message.text || "").trim().length,
            }));
            return {
                status: app.status || "",
                busy: !!app.busy,
                queueLength: app.queue?.length || 0,
                aiQueueLength: app.aiQueue?.length || 0,
                aiActive: app.aiActive
                    ? {
                          label: app.aiActive.label || "",
                          promptChars: app.aiActive.promptChars || 0,
                          streamedChars: app.aiActive.streamedChars || 0,
                      }
                    : null,
                autoVisualNovel: !!app.settings?.autoVisualNovel,
                autoModeType: app.settings?.autoModeType || "",
                stateSync: {
                    running: !!app.stateSync?.running,
                    queued: !!app.stateSync?.queued,
                    status: app.stateSync?.status || "",
                    currentGroup: app.stateSync?.currentGroup || "",
                    processingMessageIds: clone(app.stateSync?.processingMessageIds || []),
                    completedStepKeys: clone(app.stateSync?.completedStepKeys || []),
                    blockStartEntryId: Number(app.stateSync?.blockStartEntryId || 0),
                    blockEndEntryId: Number(app.stateSync?.blockEndEntryId || 0),
                    pendingMessageIds: pendingStateSyncMessages().map((message) => message.id),
                    messages: stateSyncMessages,
                },
                state: devPlaytestStateSummary(),
                messages: devPlaytestMessageSummary(20),
                lastStoryStartError: textSlot(app.lastStoryStartError, ""),
                lastStoryStartErrorStack: textSlot(
                    app.lastStoryStartErrorStack,
                    "",
                ),
                lastPrompt: devPlaytestPromptSummary(),
                ui: devPlaytestUiSummary(),
                recentTrace: devPlaytestRecentTrace(80),
                images: devPlaytestImageSummary(40),
            };
        }

        async function devPlaytestUpsertStoryPayload(payload, options = {}) {
            const record = storyTemplateRecordFromPayload(payload);
            assertValidStoryDefinition(record, "dev playtest story record");
            await compileStoryTemplateValidationArtifact(record);
            app.storyTemplates ||= [];
            const existingIndex = app.storyTemplates.findIndex(
                (item) =>
                    String(item.id || "") === String(record.id || "") ||
                    (!!item.title && !!record.title && item.title === record.title),
            );
            if (existingIndex >= 0) app.storyTemplates[existingIndex] = record;
            else app.storyTemplates.push(record);
            invalidateStoryLibraryVisibleTemplatesCache();
            if (options.persist === true) saveStoryTemplateRecordsNow([record], "dev playtest story loaded");
            const stored =
                app.storyTemplates.find((item) => String(item.id || "") === String(record.id || "")) ||
                app.storyTemplates.find((item) => item.title === record.title) ||
                record;
            return {
                id: stored.id || "",
                title: stored.title || "",
                playerOptions: storyTemplatePlayerOptions(stored).map((option, index) => ({
                    index,
                    name: option?.name || option?.character?.name || "",
                })),
            };
        }

        async function devPlaytestStartStoryPayload(payload, options = {}) {
            if (!app.library && globalThis.EmberRuntime) {
                await globalThis.EmberRuntime.start();
                app.persistence = globalThis.EmberRuntime.persistence;
                app.library = globalThis.EmberRuntime.library;
                app.turn = globalThis.EmberRuntime.turn;
            }
            const loaded = await devPlaytestUpsertStoryPayload(payload, options);
            const template = storyTemplateById(loaded.id);
            if (!template) throw new Error("Dev playtest story load failed.");
            const playerOptions = storyTemplatePlayerOptions(template);
            const playerIndex = Math.max(0, Number(options.playerIndex) || 0);
            const playerOption = playerOptions[playerIndex] || playerOptions[0] || null;

            await startStoryTemplateWithPlayerOption(template, playerOption, undefined);
            return devPlaytestSummary();
        }

        function devPlaytestUpsertCharacterPayload(payload, options = {}) {
            const exportValidation = validateCharacterExport(payload);
            if (!exportValidation.ok)
                throw new Error(
                    `Dev playtest character payload is invalid:\n${validationErrorsText(exportValidation)}`,
                );
            if (Object.hasOwn(payload, "characters") && payload.characters.length !== 1)
                throw new Error("Dev playtest character payload must contain exactly one character.");
            const definition = Object.hasOwn(payload, "character_definition")
                ? payload.character_definition
                : payload.characters[0].character_definition;
            const record = characterLibraryRecordFromDefinition(definition, {
                creator_id: options.creator_id || "",
                creator: options.creator || "",
            });
            app.characterDefinitions ||= [];
            const existingIndex = app.characterDefinitions.findIndex(
                (item) =>
                    String(item.id || "") === String(record.id || "") ||
                    normalizeNameForMatch(item.name || item.character?.name) ===
                        normalizeNameForMatch(record.name || record.character?.name),
            );
            if (existingIndex >= 0) app.characterDefinitions[existingIndex] = record;
            else app.characterDefinitions.push(record);
            app.characterDefinitions = validatedCharacterLibraryDefinitions(
                app.characterDefinitions,
            );
            if (options.persist === true)
                saveCharacterLibraryRecordsNow([record], "dev playtest character loaded");
            const stored =
                app.characterDefinitions.find((item) => String(item.id || "") === String(record.id || "")) ||
                app.characterDefinitions.find(
                    (item) =>
                        normalizeNameForMatch(item.name || item.character?.name) ===
                        normalizeNameForMatch(record.name || record.character?.name),
                ) ||
                record;
            return {
                id: characterLibraryRecordId(stored),
                name: stored.name || stored.character?.name || "",
            };
        }

        async function devPlaytestStartCharacterChatPayloads(targetPayload, playerPayload, options = {}) {
            const target = devPlaytestUpsertCharacterPayload(targetPayload, options);
            const player = devPlaytestUpsertCharacterPayload(playerPayload, options);
            const launchMode = ["story", "chat"].includes(options.launchMode)
                ? options.launchMode
                : undefined;
            const result = await startCharacterDefinitionChatGame(target.id, player.id, {
                launchMode,
                skipOpeningGreeting: options.skipOpeningGreeting === true,
                openingSetup: isPlainObject(options.openingSetup)
                    ? options.openingSetup
                    : undefined,
            });
            if (launchMode === "story" && result !== true) {
                const storyStartError = textSlot(app.lastStoryStartError, "").trim();
                const diagnosticStack = textSlot(
                    app.lastStoryStartErrorStack,
                    "",
                ).trim();
                const error = new Error(
                    storyStartError ||
                        "Character attached-story launch did not report successful start.",
                );
                if (diagnosticStack) error.stack = diagnosticStack;
                error.diagnosticStack = diagnosticStack;
                throw error;
            }
            return devPlaytestSummary();
        }

        function devPlaytestSelectObjective(objectiveId) {
            setObjectiveFocus(objectiveId, { close: false, renderAfter: false });
            render();
            return devPlaytestSummary();
        }

        function devPlaytestCompleteObjective(objectiveId, source = "dev playtest") {
            app.state.objectives ||= { active_id: "", focus_id: "", items: [] };
            reconcileStoryRuntimeState(app.state, "dev playtest complete objective");
            const objective = (app.state.objectives.items || []).find(
                (item) => String(item.id || "") === String(objectiveId || ""),
            );
            if (!objective) throw new Error(`Dev playtest objective not found: ${objectiveId}`);
            const beforeState = clone(app.state);
            setObjectiveRuntimeStatus(app.state, objective, "complete");
            updateObjectivePrerequisiteLocks(app.state, [objective.id]);
            const rewardResult = applyObjectiveProgressRewards(beforeState, app.state, source, {
                silentGameMessage: true,
            });
            flushObjectiveUnlockGreetings(rewardResult);
            reconcileStoryRuntimeState(app.state, "dev playtest completed objective");
            render();
            return devPlaytestSummary();
        }

        window.EmberAdventuresDevPlaytest = {
            validateStoryExport: (payload) => clone(validateStoryExport(payload)),
            useVerificationProfile: async () => {
                if (!app.persistence && globalThis.EmberRuntime) {
                    await globalThis.EmberRuntime.start();
                    app.persistence = globalThis.EmberRuntime.persistence;
                    app.library = globalThis.EmberRuntime.library;
                    app.turn = globalThis.EmberRuntime.turn;
                }
                const profile = makeUserProfileFromDraft({profile_name: "Story Verification", character_boldness_offset: 0});
                profile.id = "story-verification";
                profile.story_generation_notice_seen = true;
                app.userProfiles = [profile];
                app.settings.activeUserProfileId = profile.id;
                saveProfilesNow("story verification profile");
                saveSettingsNow("story verification profile");
                await app.work.flush();
                return true;
            },
            normalizedStoryObjective: (payload, objectiveId) => {
                const record = storyTemplateRecordFromPayload(payload);
                const normalized = storyDefinitionForExport(record);
                return clone((normalized.state?.objectives?.items || []).find(
                    (objective) => String(objective?.id || "") === String(objectiveId || ""),
                ) || null);
            },
            normalizedStoryPlayers: (payload) => {
                const record = storyTemplateRecordFromPayload(payload);
                const normalized = storyDefinitionForExport(record);
                return {
                    record: storyTemplatePlayerOptions(record).map((option) => ({ id: option.id, name: option.name })),
                    normalized: storyTemplatePlayerOptions(normalized).map((option) => ({ id: option.id, name: option.name })),
                    player: clone(normalized.state?.player || null),
                };
            },
            diagnoseNormalizedStoryStart: async (payload) => {
                if (!app.library && globalThis.EmberRuntime) {
                    await globalThis.EmberRuntime.start();
                    app.persistence = globalThis.EmberRuntime.persistence;
                    app.library = globalThis.EmberRuntime.library;
                }
                const record = storyTemplateRecordFromPayload(payload);
                const normalized = storyDefinitionForExport(record);
                const imported = await app.library.importPayload(
                    "story",
                    storyExportPayloadFromDefinition(normalized),
                );
                const option = storyTemplatePlayerOptions(normalized)[0];
                const game = await app.library.materializeNewGame({
                    storyId: imported.entry.storyId,
                    revisionId: imported.entry.revisionId,
                    selection: { source: "story", characterId: option.id },
                });
                const created = await app.persistence.createSave(game.header, game.initialRecords);
                const reconstructed = await app.library.reconstructRuntimeSave(created.saveId);
                await app.persistence.deleteSave(created.saveId);
                return {
                    option: { id: option.id, name: option.name },
                    header: game.header,
                    reconstructedPlayer: clone(reconstructed.state?.player || null),
                };
            },
            loadStoryPayload: devPlaytestUpsertStoryPayload,
            startStoryPayload: devPlaytestStartStoryPayload,
            loadCharacterPayload: devPlaytestUpsertCharacterPayload,
            startCharacterChatPayloads: devPlaytestStartCharacterChatPayloads,
            selectObjective: devPlaytestSelectObjective,
            completeObjective: devPlaytestCompleteObjective,
            submitUserText: async (text) => {
                await submitUserText(text);
                return devPlaytestSummary();
            },
            continueScene: async () => {
                continueScene();
                return devPlaytestSummary();
            },
            setAuto: (enabled, mode = "") => {
                if (mode) app.settings.autoModeType = exactAutoModeType(mode);
                if (!!app.settings.autoVisualNovel !== !!enabled) {
                    toggleAutoVisualNovel();
                } else {
                    saveSettingsNow("dev playtest auto mode changed");
                    renderPlayHud("dev playtest auto mode changed");
                }
                return devPlaytestSummary();
            },
            summary: devPlaytestSummary,
            messages: devPlaytestMessageSummary,
            state: devPlaytestStateSummary,
            lastPrompt: () => app.promptEditorLastTextCall || null,
            promptSources: devPlaytestPromptSourceSummary,
            imagePromptSamples: devPlaytestImagePromptSamples,
            buildImageAuditPrompt: devBuildImageAuditPrompt,
        };

        window.EmberAdventures = {
            sendUserMessage,
            submitAiCommandFromModal,
            newThread,
            openSettingsModal,
            openWorldModal,
            openMapModal,
            openStoryShopsModal,
            filterStoryShopDirectory,
            enterStoryShop,
            openStoryShopModal,
            openStoryGeneralShopModal,
            openStoryClothingShopModal,
            openStoryJobBoardModal,
            openStoryInventoryModal,
            inspectStoryShopCharacter,
            selectStoryShopCharacter,
            setStoryCharacterShopView,
            setStoryCharacterShopSort,
            filterStoryCharacterShopListings,
            chatWithStoryShopOwner,
            chatWithStoryShopCharacter,
            closeStoryShopChat,
            submitStoryShopChatMessage,
            requestStoryShopChatImage,
            buyStoryShopCharacter,
            buyStoryGeneralShopItem,
            buyStoryClothingShopOutfit,
            waitForNewGeneratedJobs,
            acceptStoryJob,
            acceptGeneratedJob,
            abandonGeneratedJob,
            inspectStoryInventoryItem,
            sellStoryInventoryItem,
            sellAllStoryLoot,
            clickMapNode,
            focusMapLocation,
            travelToMapLocation,
            resolvePendingRewardChoice,
            openMapLocationEditor,
            saveMapLocationFromEditor,
            deleteMapLocation,
            readMessage,
            stopReadingMessage,
            stopGeneratingMessage,
            editMessage,
            deleteMessage,
            openRegenerateMessageModal,
            redoMessage,
            inspectNpc,
            inviteNpc,
            removeNpcFromScene,
            toggleNpcScenePresence,
            openNpcDirectoryModal,
            openFindCharacterModal,
            closeModal,
            closeContainingPopup,
            setComposerMode,
            openAiCommandModal,
            openObjectivePickerModal,
            openSetObjectiveModal,
            saveSetObjectiveModal,
            setObjectiveFocus,
            selectObjectiveFromPicker,
            stopTrackingObjectiveFromPicker,
            clearCurrentObjective,
            choosePendingObjective,
            waitForStoryTimelineEvent,
            openStoryTimelineEventPrompt,
            declineTimelineEventFromUi,
            openDirectObjectiveChoiceModal,
            openDirectObjectiveChoiceResponseModal,
            confirmDirectObjectiveChoice,
            restoreDirectObjectiveChoiceFromMessage,
            maybeOpenObjectiveChoiceModal,
            maybeOpenObjectiveCompletionModal,
            acknowledgeObjectiveCompletion,
            acceptObjectiveSuggestion,
            dismissObjectiveSuggestion,
            continueScene,
            toggleAutoVisualNovel,
            toggleVoicePause,
            rollD20,
            requestImage,
            requestManualImage,
            closePlayerInputHelp,
            selectCharacterOutfit,
            saveCharacterCurrentOutfit,
            openCharactersModal,
            filterCharactersModal,
            openCastAddFromLibraryModal,
            setCastLibraryPickerMode,
            filterCastAddFromLibrary,
            addCharacterFromLibrary,
            openPlayerModal,
            exportPlayerCharacter,
            sharePlayerCharacter,
            publishPlayerCharacterToPublicIndex,
            exportCharacter,
            shareCharacter,
            publishCharacterToPublicIndex,
            exportSelectedCharacters,
            shareSelectedCharacters,
            publishSelectedCharactersToPublicIndex,
            importCharacters,
            importPartyCharacters,
            importNpcs,
            importCharacterDefinitions,
            importCharacterDefinitionsFromRecords,
            importPlayer,
            exportData,
            exportGameSave,
            backupNow,
            emergencyExportData,
            importData,
            importGameSave,
            exportNpc,
            shareNpc,
            publishNpcToPublicIndex,
            exportSelectedNpcs,
            shareSelectedNpcs,
            publishSelectedNpcsToPublicIndex,
            openCharacterLibraryModal,
            openUnifiedLibrary,
            switchUnifiedLibraryType,
            switchUnifiedLibraryTab,
            toggleUnifiedLibraryFilters,
            handleUnifiedLibrarySearch,
            runUnifiedLibraryPublicSearch,
            setUnifiedLibraryTextFilter,
            toggleUnifiedLibraryContentFilter,
            setUnifiedLibraryColumns,
            stepUnifiedLibraryColumns,
            openUnifiedLibraryPicker,
            clearUnifiedLibraryFilters,
            setMineCreatorIdentity,
            loadPublishedMineItems,
            openCharacterLibraryDetail,
            openCharacterDefinitionChatPlayerPrompt,
            openCharacterDefinitionChatPlayerPicker,
            filterCharacterChatPlayerPicker,
            setCharacterChatLaunchMode,
            startCharacterDefinitionFromChatPicker,
            startCharacterDefinitionChatGame,
            setCharacterChatCustomLocationEnabled,
            setCharacterChatOpeningOverrideEnabled,
            toggleCharacterChatAuthoredOpeningDetails,
            cancelCharacterChatOpeningSetup,
            confirmCharacterChatOpeningSetup,
            openPublicCharacterLibraryDetail,
            importPublicCharacterToLibrary,
            openCharacterLibraryImages,
            openCharacterLibrarySettings,
            saveCharacterLibrarySettings,
            editCharacterLibraryDefinition,
            saveCharacterLibraryDefinitionEditor,
            exportCharacterLibraryDefinition,
            shareCharacterLibraryDefinition,
            publishCharacterLibraryDefinition,
            deleteCharacterLibraryDefinition,
            defaultCharacterGenderTags,
            setFriendlyGenderField,
            switchCharacterLibraryTab,
            setCharacterLibrarySort,
            setCharacterLibraryCardSize,
            toggleCharacterLibraryFilters,
            handleCharacterLibraryFilterInput,
            setCharacterLibraryFilterValue,
            openCharacterLibraryFilterPicker,
            toggleCharacterLibraryFilterPickerOption,
            filterCharacterLibraryFilterPicker,
            saveCharacterLibraryFilterPicker,
            runPublicCharacterSearch,
            loadNextPublicLibraryPage,
            openManualCharacterCreateModal,
            setManualCharacterCreateTargetMode,
            saveManualCharacterCreateModal,
            filterCharacterLibraryModal,
            filterStoryTemplateLibraryModal,
            filterNpcDirectoryModal,
            editCharacter,
            editNpc,
            openNpcShellEditor,
            saveNpcShellEditor,
            deleteNpc,
            killNpc,
            restoreNpc,
            addCharacter,
            addNpcFromCharacterDefinition,
            deleteCharacter,
            openCharacterGeneratorModal,
            setGeneratedCharacterTargetMode,
            saveRuntimeCharacterToLibrary,
            quick,
            toggleImageTarget,
            showOlderImages,
            retryNormalImageRequest,
            deleteImageRecord,
            downloadImageRecord,
            shareImageRecord,
            toggleImageFavorite,
            loadImageInLab,
            openImageViewerModal,
            openImagePreview,
            openProfileImagePreview,
            deleteQueuedMessage,
            autosizeStateTextarea,
            openProfileImageModal,
            selectProfileImage,
            selectProfileImageFromUi,
            toggleProfileImageFavorite,
            promoteSceneImageToProfile,
            loadProfileImageInLab,
            openProfileImageLabForProfile,
            closeImageLabSurface,
            downloadProfileImageRecord,
            shareProfileImageRecord,
            deleteProfileImage,
            retryProfileImageRequest,
            generateProfileImage,
            generateDefaultProfileImageForCharacter,
            setGeneratedProfileImageAsDefault,
            toggleSeed,
            randomizeSeed,
            openCharacterImageSettings,
            nullFriendlyStateField,
            undressFriendlyClothingField,
            dressFriendlyInventoryItem,
            removeFriendlyStateListItem,
            addFriendlyStateListItem,
            openImageLabModal,
            downloadAllKeptImages,
            exportAllImages,
            importAllImages,
            uploadImageMetadata,
            openGuideModal,
            openBetaNotesModal,
            showPlayerInputHelpOnce,
            openDiscord,
            openMainMenu,
            closeMainMenuToGame,
            openMobileDrawer,
            closeMobileDrawer,
            openMainMenuDataToolsModal,
            openBatchCharacterImageTool,
            toggleBatchCharacterImage,
            setBatchCharacterImageOutfit,
            generateBatchCharacterImages,
            downloadBatchCharacterImages,
            closeBatchCharacterImageTool,
            openFeaturedContentPublisher,
            openFeaturedCharacterManager,
            selectFeaturedCharacterVersion,
            updateFeaturedCharacterFromManager,
            repairBundledFeaturedCharacterFiles,
            publishSelectedFeaturedCharacters,
            publishSelectedFeaturedStories,
            setFeaturedContentPublisherSelection,
            syncFeaturedContentPublisherCard,
            toggleFeaturedContentPublisherCard,
            copyFeaturedContentManifest,
            downloadFeaturedContentManifest,
            clearFeaturedContentPublisherDraft,
            openManageImagesModal,
            filterManagedImages,
            toggleManagedImageSelection,
            toggleAllManagedImages,
            deleteSelectedManagedImages,
            deleteManagedImage,
            deleteManagedImageGroup,
            openManageCharactersModal,
            openManagedCharacterDetail,
            toggleManagedCharacterSelection,
            toggleAllManagedCharacters,
            deleteSelectedManagedCharacters,
            confirmDeleteDatabase,
            openPromptEditorModal,
            switchPromptEditorTab,
            loadPromptEditorSource,
            updatePromptEditorProfileEntity,
            updatePromptEditorImageTargets,
            sendPromptEditorText,
            sendPromptEditorImage,
            generateImageLabFreeform,
            togglePromptEditorTranscriptItem,
            deletePromptEditorTranscriptItem,
            copyPromptEditorTranscriptItem,
            downloadPromptEditorTranscriptItem,
            downloadPromptEditorTranscript,
            setTopPanel,
            setLeftPanelGroup,
            openSceneEntity,
            setLeftPanelSectionOpen,
            saveLeftPanelScroll,
            renderMainMenu,
            openMainMenuProfiles,
            openProfileCreationModal,
            selectMainMenuProfile,
            exportMainMenuProfile,
            importMainMenuProfile,
            deleteMainMenuProfile,
            openStoryTemplateLibrary,
            switchStoryLibraryTab,
            setStoryLibrarySort,
            setStoryLibraryCardSize,
            toggleStoryLibraryFilters,
            handleStoryLibraryFilterInput,
            reloadCuratedPublicStoryRails,
            reloadCuratedPublicCharacterRail,
            openStoryLibraryFilterPicker,
            toggleStoryLibraryFilterPickerOption,
            filterStoryLibraryFilterPicker,
            saveStoryLibraryFilterPicker,
            runPublicStorySearch,
            openStoryLibraryDetail,
            openPublicStoryLibraryDetail,
            importPublicStoryToLibrary,
            generateStoryTemplateTitleCardImage,
            openStoryTitleCardImageModal,
            selectStoryTitleCardImage,
            toggleStoryTitleCardFavorite,
            deleteStoryTitleCardImage,
            downloadStoryTitleCardRecord,
            openStoryTitleCardPreview,
            openStoryTitleCardImageLab,
            loadStoryTitleCardInLab,
            saveStoryDefaultImageModel,
            resumeWorldGenerationCheckpoint,
            discardWorldGenerationCheckpoint,
            exportWorldGenerationCheckpoint,
            startStoryTemplate,
            openStoryPlayerSelectModal,
            setStoryPlayerSelectGender,
            startStoryTemplatePlayerChoice,
            openStoryAnyPlayerLibrary,
            filterStoryAnyPlayerLibrary,
            startStoryTemplateLibraryPlayerChoice,
            editStoryTemplate,
            openStoryCreationChoicePanel,
            openCharacterCreationChoicePanel,
            startExternalAiStoryCreation,
            startExternalAiCharacterCreation,
            createManualStoryTemplate,
            openStoryBuilder,
            closeStoryBuilder,
            startAiStoryCreationFromBuilder,
            setStoryBuilderPanel,
            storyBuilderToggleNavigationPanel,
            storyBuilderToggleDetailsPanel,
            storyBuilderCloseWorkspacePanels,
            saveStoryBuilderDraft,
            storyBuilderUndo,
            storyBuilderRedo,
            exportStoryBuilderDraft,
            storyBuilderAddStructuredEntry,
            storyBuilderAddPlayerOption,
            storyBuilderAddStartingCharacter,
            storyBuilderAddOpeningNpc,
            storyBuilderDeleteCastEntry,
            storyBuilderEditCharacterDefinition,
            storyBuilderSaveCharacterDefinition,
            storyBuilderAddObjective,
            storyBuilderAddNextObjective,
            storyBuilderAddChoiceObjective,
            storyBuilderAddOutcomeRoute,
            storyBuilderMoveOutcomeRoute,
            storyBuilderDeleteOutcomeRoute,
            storyBuilderDuplicateObjective,
            storyBuilderSelectObjective,
            storyBuilderSetStartingObjective,
            storyBuilderSetObjectiveControlMode,
            storyBuilderSetObjectiveEditorType,
            storyBuilderSetChoiceResponseMode,
            storyBuilderSetChoiceObjective,
            storyBuilderSetObjectiveOutputMode,
            storyBuilderSetObjectiveAutoComplete,
            storyBuilderSetRequirementCheckOnly,
            storyBuilderSetOutputEndingType,
            storyBuilderAddOutput,
            storyBuilderMoveOutput,
            storyBuilderDeleteOutput,
            storyBuilderApplyOutputField,
            storyBuilderToggleOutputDialogue,
            storyBuilderAddDialogueLine,
            storyBuilderApplyDialogueLine,
            storyBuilderRemoveDialogueLine,
            storyBuilderApplyDialogueCharacter,
            openStoryBuilderNodePicker,
            selectStoryBuilderNodeTarget,
            openStoryBuilderLocationPicker,
            selectStoryBuilderLocation,
            filterStoryBuilderPicker,
            openStoryBuilderRequirementEditor,
            updateStoryBuilderRequirementDraft,
            saveStoryBuilderRequirement,
            deleteStoryBuilderRequirement,
            closeStoryBuilderRequirementEditor,
            openStoryBuilderRewardEditor,
            openStoryBuilderReusableRewardEditor,
            updateStoryBuilderRewardDraft,
            updateStoryBuilderRewardOutfitField,
            setStoryBuilderGrantOutfitMode,
            addStoryBuilderRewardClothing,
            removeStoryBuilderRewardClothing,
            renameStoryBuilderRewardClothingSlot,
            updateStoryBuilderRewardClothingDescription,
            saveStoryBuilderReward,
            deleteStoryBuilderReward,
            closeStoryBuilderRewardEditor,
            openStoryBuilderReusableRewardsManager,
            setStoryBuilderReusableRewardsTab,
            createStoryBuilderReusableReward,
            renameStoryBuilderReusableReward,
            addStoryBuilderRewardTemplateParameter,
            renameStoryBuilderRewardTemplateParameter,
            deleteStoryBuilderRewardTemplateParameter,
            replaceStoryBuilderReusableRewardReferences,
            deleteStoryBuilderReusableReward,
            closeStoryBuilderReusableRewardsManager,
            openStoryBuilderInputsEditor,
            setStoryBuilderInputMode,
            toggleStoryBuilderInput,
            addStoryBuilderInputGroup,
            removeStoryBuilderInputGroup,
            saveStoryBuilderInputs,
            closeStoryBuilderInputsEditor,
            storyBuilderOpenValidationIssue,
            storyBuilderAutoLayout,
            storyBuilderFitTree,
            storyBuilderZoomTree,
            storyBuilderHandleTreeWheel,
            storyBuilderToggleInspectorFocus,
            storyBuilderToggleNodeList,
            storyBuilderCloseMobileInspector,
            storyBuilderStartLinkObjective,
            buildStoryBuilderObjectiveGraphLayout,
            setStoryBuilderGraphComponent,
            setStoryBuilderGraphSearch,
            storyBuilderDeleteFutureCharacter,
            storyBuilderGenerateTitleCardImage,
            storyBuilderGenerateDefaultProfileImage,
            storyBuilderGenerateUnlockImage,
            storyBuilderGenerateManifestImage,
            storyBuilderGenerateAllMissingImages,
            storyBuilderStopImageQueueAfterCurrent,
            storyBuilderToggleImageAutogen,
            setStoryBuilderImageFilter,
            storyBuilderMoveObjective,
            storyBuilderDeleteObjective,
            addFriendlyStateObjectField,
            deleteStoryTemplate,
            exportStoryTemplate,
            shareStoryTemplate,
            uploadStoryTemplate,
            openUploadTestModal,
            runHostedJsonUploadTest,
            runHostedImageUploadTest,
            importHostedImageUrl,
            compressBlobWithGzip,
            decompressBlobWithGzip,
            uploadCompressedJson,
            uploadCompressedStoryJson,
            fetchCompressedJsonFromUpload,
            uploadJsonFileToUserUploads,
            safeUploadSlug,
            publicUploadFileUrl,
            parseHostedShareParam,
            openPublicLibraryIndexModal,
            openPublicLibraryAccountModal,
            openPublicPrivacyNotice,
            savePublicLibraryIndexSettings,
            setPublicLibraryViewMode,
            signInPublicLibraryWithGoogle,
            signOutPublicLibrary,
            refreshPublicLibraryUser,
            importPublicLibraryEntry,
            importPublicLibraryEntryVersion,
            openPublicLibraryVersionHistoryModal,
            openOwnedPublicLibraryVersionManager,
            openOwnedPublicCharacterVersionDetail,
            setOwnedPublicLibraryVersionVisibility,
            openAdminInboxNotice,
            refreshAdminInboxCounts,
            inspectOwnedPublicLibraryUploads,
            setOwnedPublicLibraryItemVisibility,
            showPublicLibraryUpdateInstructions,
            createEmptyPublicLibraryIndex,
            inspectPublicLibraryIndex,
            fetchPublicLibraryIndex,
            fetchOwnedPublicLibraryIndex,
            replacePublicLibraryIndex,
            addEntriesToPublicLibraryIndex,
            createPublicLibraryEntry,
            exactPublicLibraryIndex,
            publicLibraryCharacterMetadata,
            publicLibraryStoryMetadata,
            publicLibraryImageMetadata,
            createPublicStoryFeedback,
            publicLibraryStoryFeedbackSummary,
            publicLibraryStoryFeedbackText,
            addPublicStoryFeedback,
            openRatePublicStoryModal,
            submitPublicStoryRating: (...args) => handlePublicRatingAction(submitPublicStoryRating, ...args),
            removePublicStoryRating: (...args) => handlePublicRatingAction(removePublicStoryRating, ...args),
            openReportPublicStoryModal,
            openReportPublicCharacterModal,
            openReportPublicLibraryItemModal,
            submitPublicLibraryReport,
            renderPublicLibraryStoryList,
            handlePublicLibrarySearchInput,
            handlePublicLibraryFilterInput,
            handlePublicLibrarySearchKey,
            setPublicLibraryPageSize,
            publicLibraryPreviousPage,
            publicLibraryNextPage,
            publishCharacterRecordsToPublicIndex,
            publishStoryTemplateToPublicIndex,
            publishImageRecordToPublicIndex,
            tempCloseOnboarding,
            openDevTraceModal,
            openDevSmokeSuiteModal,
            runAllDevSmokeScenarios,
            runQuickDevSmokeScenarios,
            runMediumDevSmokeScenarios,
            runShortMediumDevSmokeScenarios,
            runPublicHostingSmokeScenarios,
            runExtensiveSupabaseTests,
            runListedExtensiveSupabaseTests,
            runListedDevSmokeScenarios,
            runDevSmokeScenarioById,
            devRunSmokeTimeoutLifecycleRegression,
            downloadSmokeSuiteReport,
            getDevSmokeSuiteState: () => clone(devSmokeSuiteState()),
            getDevSmokeSuiteProgress: () => {
                const suite = devSmokeSuiteState();
                return {
                    current: String(suite.currentScenario || ""),
                    progress: String(suite.currentScenarioProgress || ""),
                    running: suite.running === true,
                    restoring: suite.restoring === true,
                    persistencePending: [
                        ...(app.persistence?.diagnosticState?.().requests || []).map(
                            (request) => String(request.type || "unknown"),
                        ),
                        ...(app.persistence?.diagnosticState?.().pendingEntries || []).map(
                            (transaction) => [
                                transaction.transactionType || "transaction",
                                `change=${transaction.changeId}`,
                                transaction.operations
                                    ?.map((operation) => operation.type || "unknown")
                                    .join("+") || "no-operations",
                                transaction.lastError
                                    ? `error=${transaction.lastError}`
                                    : "",
                            ].filter(Boolean).join(" "),
                        ),
                    ],
                    normalizedMutations: {
                        owners: saveProjectionQueue.owners.size,
                        collections: saveProjectionQueue.collections.size,
                        flushing: !!saveProjectionQueue.flushing,
                        phase: saveProjectionQueue.phase,
                    },
                    storyWorker: clone(app.storyImportWorkerMetrics || null),
                };
            },
            isReady: () => app.ready === true,
            isSystemReady: () => !!app.persistence && !!app.library && !!app.turn,
            getObjectiveFlowReport: () => app.debugObjectiveFlowReport || "",
            openStateModal,
            openGameSavesModal,
            restoreGameSave,
            renameGameSave,
            deleteGameSave,
            getRenderStats: () => clone(ensureRenderStats()),
            resetRenderStats: () => {
                app.devRenderStats = {
                    fullRenderCount: 0,
                    threadRenderCount: 0,
                    imagePanelRenderCount: 0,
                    playHudRenderCount: 0,
                    broadDuringRuntimeCount: 0,
                    lastFullRenderReason: "",
                    lastThreadRenderReason: "",
                    lastImagePanelRenderReason: "",
                    regionReasons: [],
                };
                return clone(app.devRenderStats);
            },
            buildImagePrompt,
            buildNegativeImagePrompt,
            getBuildInfo: emberAdventuresBuildInfo,
        };
        globalThis.__installEmberAdventuresPrivateRuntimeTests?.(
            window.EmberAdventures,
        );
        installUiActionWrappers(window.EmberAdventures);
        init().catch((err) => {
            log("EmberAdventures startup failed", err.message || String(err), {
                type: "system",
                level: "error",
            });
            recordStorageFailure("startup", err);
            showEmergencyExportFallback(err.message || String(err));
            render();
        });
    })();
