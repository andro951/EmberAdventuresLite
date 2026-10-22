
        async function devRunCharacterLibraryPublicSearchSmokeTest() {
            devTestLog("Scenario start: character-library-public-search-smoke");
            devResetForLiveTest("character-library-public-search-smoke");
            const initialPreferenceProfile = devCreateTestProfile({

            });
            const originalFetch = publicLibraryFetch;
            const originalWindowFetch = window.fetch;
            const originalPayloadFetch = fetchJsonFromPublicUploadUrl;
            const originalVerifiedPayloadFetch = fetchVerifiedPublicLibraryPayload;
            const publicMiraCharacterId = `public-library-mira-smoke-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
            const isPublicCharacterSearchSmokeArtifactName = (name = "") =>
                [
                    "Public Library Mira",
                    "Public Missing Image Smoke",
                    "Public Publish Character Smoke",
                    "Zed Initially Hidden",
                ].includes(String(name || ""));
            const withoutPublicCharacterSearchSmokeArtifacts = (entries = []) =>
                (entries || []).filter(
                    (entry) =>
                        !isPublicCharacterSearchSmokeArtifactName(
                            entry?.name || entry?.title,
                        ),
                );
            const originalDefinitions = clone(app.characterDefinitions || []).filter(
                (record) =>
                    !isPublicCharacterSearchSmokeArtifactName(
                        record?.name || record?.character?.name,
                    ),
            );
            const originalProfileImages = clone(app.profileImages || []).filter(
                (image) => !isPublicCharacterSearchSmokeArtifactName(image?.owner_name),
            );
            const originalSession = app.supabaseSession ? clone(app.supabaseSession) : null;
            const originalSupabaseUrl = app.settings.publicLibrarySupabaseUrl;
            const originalSupabaseAnonKey = app.settings.publicLibrarySupabaseAnonKey;
            const originalSearchCache = app.publicLibrarySearchCache
                ? clone(app.publicLibrarySearchCache)
                : null;
            const originalSearchCacheLoaded = app.publicLibrarySearchCacheLoaded;
            const originalOwnedVersionStateCache = app.ownedPublicLibraryVersionStateCache
                ? clone(app.ownedPublicLibraryVersionStateCache)
                : null;
            const originalPublicPayloads = app.characterLibraryPublicPayloads
                ? { ...app.characterLibraryPublicPayloads }
                : null;
            const originalCuratedEntries = app.publicLibraryCuratedEntries
                ? clone(app.publicLibraryCuratedEntries)
                : null;
            const originalCuratedPayloadCache = app.publicLibraryCuratedPayloadCache
                ? clone(app.publicLibraryCuratedPayloadCache)
                : null;
            const originalCuratedPayloadRequests = app.publicLibraryCuratedPayloadRequests;
            const originalFeaturedCharacterManifest = clone(
                PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS,
            );
            const originalFeaturedPublisherDraft = localStorage.getItem(
                FEATURED_CONTENT_PUBLISHER_DRAFT_KEY,
            );
            const originalOwnedCharacterEntries = withoutPublicCharacterSearchSmokeArtifacts(
                clone(app.characterLibraryOwnedCharacterEntries || []),
            );
            const originalOwnedCharactersLoading =
                app.characterLibraryOwnedCharactersLoading === true;
            const originalOwnedIndex = app.publicLibraryOwnedIndex
                ? {
                    ...clone(app.publicLibraryOwnedIndex),
                    items: withoutPublicCharacterSearchSmokeArtifacts(
                        clone(app.publicLibraryOwnedIndex.items || []),
                    ),
                }
                : null;
            const originalLastIndex = app.publicLibraryLastIndex
                ? {
                    ...clone(app.publicLibraryLastIndex),
                    items: withoutPublicCharacterSearchSmokeArtifacts(
                        clone(app.publicLibraryLastIndex.items || []),
                    ),
                }
                : null;
            const calls = [];
            let visibilityMutationGate = null;
            const characterUrl = "https://user.uploads.dev/file/public-character-library-smoke.json";
            const featuredCharacterUrl =
                `https://user.uploads.dev/file/featured-character-library-smoke-${crypto.randomUUID()}.json`;
            const hiddenLatestImageUrl = "https://example.invalid/public-character-library-version-3.jpg";
            const initiallyHiddenImageUrl = "https://example.invalid/initially-hidden-version-2.jpg";
            const initiallyHiddenMaleImageUrl = "https://example.invalid/initially-hidden-version-2-male.jpg";
            const onePixelDataUrl =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
            const featuredAlpha = devSmokeCharacterRecord("Featured Alpha");
            const featuredBeta = devSmokeCharacterRecord("Featured Beta", {
                character: {  },
                record: {  },
            });
            let featuredCharacterFetches = 0;
            let featuredAlphaHostedProfileFetches = 0;
            const originalStorageFailures = new Set(app.storageFailures || []);
            try {
                // Profile switches also refresh hidden local cards; keep real records out of this test.
                app.characterDefinitions = validatedCharacterLibraryDefinitions([]);
                app.profileImages = exactProfileImageStore([]);
                const existingFeaturedAlphaMaleImage = createProfileImageRecord({
                    id: "featured-alpha-existing-male-image",
                    character_id: featuredAlpha.id,
                    owner_name: featuredAlpha.name,
                    source: "existing local smoke image",
                    model: "smoke",
                    html: `<img src="${onePixelDataUrl}" alt="Existing Featured Alpha male image">`,
                    male: true,
                    pending: false,
                    error: "",
                });
                app.profileImages = exactProfileImageStore([
                    existingFeaturedAlphaMaleImage,
                    ...app.profileImages,
                ]);
                app.characterLibraryPublicPayloads = {};
                app.publicLibraryCuratedEntries = {};
                app.publicLibraryCuratedPayloadCache = {};
                app.publicLibraryCuratedPayloadRequests = new Map();
                localStorage.removeItem(FEATURED_CONTENT_PUBLISHER_DRAFT_KEY);
                PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.splice(
                    0,
                    PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.length,
                    ...[featuredAlpha, featuredBeta].map((record) => ({
                        url: featuredCharacterUrl,
                        characterId: record.id,
                        creator: record.creator,
                        creatorId: record.creator_id,
                        revision: "smoke-revision",
                    })),
                );
                app.publicLibrarySearchCache = {
                    version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
                    entries: {},
                };
                app.publicLibrarySearchCacheLoaded = true;
                app.ownedPublicLibraryVersionStateCache = {};
                app.settings.publicLibrarySupabaseUrl = "https://character-library-smoke.supabase.co";
                app.settings.publicLibrarySupabaseAnonKey = "character-library-smoke-anon";
                window.fetch = async (url, options = {}) => {
                    const textUrl = String(url || "");
                    if (textUrl.startsWith(featuredCharacterUrl)) {
                        featuredCharacterFetches++;
                        return new Response(
                            JSON.stringify(
                                hostedCharacterSharePayload([
                                    featuredAlpha,
                                    featuredBeta,
                                ]),
                            ),
                            {
                                status: 200,
                                headers: { "content-type": "application/json" },
                            },
                        );
                    }
                    if (
                        textUrl.includes("/rest/v1/library_items?select=id") &&
                        textUrl.includes("visibility=eq.public") &&
                        textUrl.includes("type=eq.character")
                    ) {
                        return {
                            ok: true,
                            status: 200,
                            headers: { get: (name) => String(name || "").toLowerCase() === "content-range" ? "0-0/12" : "" },
                            text: async () => "[]",
                        };
                    }
                    if (/^https:\/\/example\.(?:com|invalid)\//i.test(textUrl)) {
                        if (/emberadventureslite-smoke-character-profile-featured-alpha/i.test(textUrl))
                            featuredAlphaHostedProfileFetches++;
                        const encoded = onePixelDataUrl.split(",")[1];
                        const bytes = Uint8Array.from(atob(encoded), (value) =>
                            value.charCodeAt(0),
                        );
                        return new Response(
                            new Blob([bytes], { type: "image/png" }),
                            {
                                status: 200,
                                headers: {
                                    "content-type": "image/png",
                                    "content-length": String(bytes.byteLength),
                                },
                            },
                        );
                    }
                    return originalWindowFetch.call(window, url, options);
                };
                publicLibraryFetch = async (path, options = {}) => {
                    calls.push({ path, options: clone(options) });
                    const compactItem = (isPublic = true) =>
                        devSmokeSupabasePublicItemRow({
                            id: "public-char-library-smoke",
                            type: "character",
                            definition_id: publicMiraCharacterId,
                            name: "Public Library Mira",
                            male_name: "Public Library Milo",
                            non_male_name: "Public Library Mira",
                            male_image_url: onePixelDataUrl,
                            non_male_image_url: onePixelDataUrl,
                            current_version_id:
                                "public-char-library-version",
                            visibility: isPublic ? "public" : "hidden",
                            gender: "female",
                            age: 28,
                            species: "human",
                            role: "library tester",
                            voice_gender: "female",
                        });
                    const compactVersionRows = [
                        ["public-char-library-version-3", 3, `${characterUrl}?v=3`, null, 303, hiddenLatestImageUrl, "Third version.", "2026-08-28T03:00:00.000Z"],
                        ["public-char-library-version-2", 2, `${characterUrl}?v=2`, null, 302, onePixelDataUrl, "Second version.", "2026-08-28T02:00:00.000Z"],
                        ["public-char-library-version", 1, characterUrl, null, 301, onePixelDataUrl, "First version.", "2026-08-28T01:00:00.000Z"],
                    ];
                    if (
                        path === "/rest/v1/rpc/owned_library_version_state" &&
                        options.body?.target_item_id === "initially-hidden-character"
                    )
                        return {
                            i: "initially-hidden-character",
                            c: null,
                            p: false,
                            n: 2,
                            m: "AA==",
                            v: [
                                ["initially-hidden-version-2", 2, `${characterUrl}?hidden=v2`, null, 202, initiallyHiddenImageUrl, "Newest hidden version.", "2026-08-28T04:00:00.000Z"],
                                ["initially-hidden-version-1", 1, `${characterUrl}?hidden=v1`, null, 201, onePixelDataUrl, "Older hidden version.", "2026-08-28T03:00:00.000Z"],
                            ],
                            d: devSmokeSupabasePublicItemRow({
                                id: "initially-hidden-character",
                                owner_user_id: "owned-public-user",
                                type: "character",
                                definition_id: "initially-hidden-character-definition",
                                name: "Zed Initially Hidden",
                                current_version_id: null,
                                visibility: "hidden",
                                male_image_url: initiallyHiddenMaleImageUrl,
                                non_male_image_url: initiallyHiddenImageUrl,
                            }),
                        };
                    if (path === "/rest/v1/rpc/owned_library_version_state")
                        return {
                            i: "public-char-library-smoke",
                            c: "public-char-library-version",
                            p: true,
                            n: 3,
                            m: "BQ==",
                            v: compactVersionRows,
                            d: compactItem(true),
                        };
                    if (path === "/rest/v1/rpc/owned_library_hidden_previews")
                        throw new Error(
                            "Supabase POST /rest/v1/rpc/owned_library_hidden_previews failed (404): PGRST202 Could not find the function in the schema cache.",
                        );
                    if (path === "/rest/v1/rpc/set_owned_library_version_visibility") {
                        if (visibilityMutationGate) await visibilityMutationGate;
                        const hidingLastVisibleVersion =
                            options.body?.target_version_id === "public-char-library-version" &&
                            options.body?.target_visible === false;
                        return {
                            i: "public-char-library-smoke",
                            c: hidingLastVisibleVersion ? null : "public-char-library-version",
                            p: !hidingLastVisibleVersion,
                            n: 3,
                            m: hidingLastVisibleVersion ? "AA==" : "AQ==",
                            v: compactVersionRows,
                            d: {
                                ...compactItem(!hidingLastVisibleVersion),
                                male_image_url: hidingLastVisibleVersion
                                    ? hiddenLatestImageUrl
                                    : onePixelDataUrl,
                                non_male_image_url: hidingLastVisibleVersion
                                    ? hiddenLatestImageUrl
                                    : onePixelDataUrl,
                                current_version_id: hidingLastVisibleVersion
                                    ? null
                                    : "public-char-library-version",
                            },
                        };
                    }
                    if (path === "/rest/v1/rpc/search_public_library_items" && options.method === "POST") {
                        if (options.body?.search_text === "No matches") return [];
                        return [devSmokeSupabasePublicSearchRow({
                            id: "public-char-library-smoke",
                            type: "character",
                            definition_id: publicMiraCharacterId,
                            name: "Public Library Mira",
                            title: "Public Library Mira",
                            description: "Mock hosted character.",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            source: "Smoke Source",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                            gender: "female",
                            age: 28,
                            species: "human",
                            role: "arcane scout",
                            rating_total: 8,
                            rating_count: 1,
                            rating_average: 8,
                            current_version_id: "public-char-library-version",
                            payload_url: characterUrl,
                            image_url: onePixelDataUrl,
                            male_image_url: devSmokeDefaultProfileImage(
                                "Public Library Mira Male",
                                true,
                            ).url,
                            non_male_image_url: onePixelDataUrl,
                            male_name: "Public Library Milo",
                            non_male_name: "Public Library Mira",
                            ordering_value: "public library mira",
                            updated_at: new Date().toISOString(),
                        })];
                    }
                    if (path.startsWith("/rest/v1/library_items")) {
                        return [
                            devSmokeSupabasePublicItemRow({
                                id: "public-char-library-smoke",
                                owner_user_id: "owned-public-user",
                                type: "character",
                                definition_id: publicMiraCharacterId,
                                name: "Public Library Mira",
                                title: null,
                                description: "Mock hosted character.",
                                creator: "debug harness",
                                creator_id: "00000000-0000-4000-8000-000000000001",
                                source: "Original",
                                creation_tool: "debug harness",
                                genres: ["fantasy"],
                                gender: "female",
                                age: 28,
                                species: "human",
                                role: "arcane scout",
                                current_version_id: "public-char-library-version",
                                visibility: "public",
                                male_image_url: devSmokeDefaultProfileImage(
                                    "Public Library Mira Male",
                                    true,
                                ).url,
                                non_male_image_url: onePixelDataUrl,
                                male_name: "Public Library Milo",
                                non_male_name: "Public Library Mira",
                                updated_at: new Date().toISOString(),
                            }),
                            devSmokeSupabasePublicItemRow({
                                id: "public-char-library-missing-image-smoke",
                                owner_user_id: "owned-public-user",
                                type: "character",
                                definition_id: "public-char-library-missing-image-smoke-definition",
                                name: "Public Missing Image Smoke",
                                title: null,
                                description: "Mock hosted character missing required image.",
                                creator: "debug harness",
                                creator_id: "00000000-0000-4000-8000-000000000001",
                                source: "Original",
                                creation_tool: "debug harness",
                                genres: ["fantasy"],
                                gender: "female",
                                age: 29,
                                species: "human",
                                role: "image validation scout",
                                current_version_id: "public-char-library-missing-image-version",
                                visibility: "public",
                                updated_at: new Date().toISOString(),
                            }),
                            ...(path.includes("owner_user_id=eq.")
                                ? [
                                      devSmokeSupabasePublicItemRow({
                                          id: "initially-hidden-character",
                                          owner_user_id: "owned-public-user",
                                          type: "character",
                                          definition_id: "initially-hidden-character-definition",
                                          name: "Zed Initially Hidden",
                                          title: null,
                                          description: "Mock fully hidden hosted character.",
                                          creator: "debug harness",
                                          creator_id: "00000000-0000-4000-8000-000000000001",
                                          source: "Original",
                                          creation_tool: "debug harness",
                                          genres: ["fantasy"],
                                          gender: "female",
                                          age: 28,
                                          species: "human",
                                          role: "hidden preview tester",
                                          current_version_id: null,
                                          visibility: "hidden",
                                          male_image_url: onePixelDataUrl,
                                          non_male_image_url: onePixelDataUrl,
                                          updated_at: new Date().toISOString(),
                                      }),
                                  ]
                                : []),
                        ];
                    }
                    if (path.startsWith("/rest/v1/library_versions")) {
                        return [
                            devSmokeSupabasePublicVersionRow({
                                id: "public-char-library-version",
                                item_id: "public-char-library-smoke",
                                version_number: 1,
                                payload_url: characterUrl,
                                image_url: onePixelDataUrl,
                                created_at: new Date().toISOString(),
                            }),
                            devSmokeSupabasePublicVersionRow({
                                id: "public-char-library-missing-image-version",
                                item_id: "public-char-library-missing-image-smoke",
                                version_number: 1,
                                payload_url: "https://user.uploads.dev/file/public-missing-image-smoke.json",
                                image_url: null,
                                created_at: new Date().toISOString(),
                            }),
                        ];
                    }
                    if (path.startsWith("/rest/v1/library_feedback")) return [];
                    throw new Error(`Unexpected public character library fetch: ${path}`);
                };
                fetchJsonFromPublicUploadUrl = async (url) => {
                    if (url !== characterUrl) throw new Error(`Unexpected payload URL: ${url}`);
                    return devSmokeCharacterRecord("Public Library Mira", {
                        character: {
                            id: publicMiraCharacterId,
                            gender: "female",
                            age: 28,
                            role: "arcane scout",
                            source: "Smoke Source",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                        },
                        record: { id: publicMiraCharacterId },
                    });
                };
                fetchVerifiedPublicLibraryPayload = async (entry) => {
                    if (entry.url !== characterUrl) throw new Error(`Unexpected verified payload URL: ${entry.url}`);
                    return hostedCharacterSharePayload([
                        devSmokeCharacterRecord("Public Library Mira", {
                            character: {
                                id: publicMiraCharacterId,
                                gender: "female",
                                age: 28,
                                role: "arcane scout",
                                source: "Original",
                                creator: "debug harness",
                                creator_id: "00000000-0000-4000-8000-000000000001",
                                creation_tool: "debug harness",
                                genres: ["fantasy"],
                            },
                            record: { id: publicMiraCharacterId },
                        }),
                    ]);
                };
                cleanupSmokeScenarioUi();
                openCharacterLibraryModal({ fromMainMenu: true, tab: "public" });
                await devWaitFor(
                    () =>
                        !!$("modalBox")?.querySelector?.("[data-library-home][data-library-type='character']") &&
                        characterLibraryActiveTab() === "public" &&
                        !$("modalBox")?.querySelector?.("[data-character-library-tab-panel='public']")?.hidden,
                    3000,
                    "Character Library public tab to open",
                );
                devAssert(
                    characterLibraryActiveTab() === "public" &&
                        !$("modalBox")?.querySelector?.("[data-character-library-tab-panel='public']")?.hidden &&
                        (
                            document.querySelector("[data-character-library-tab='public']")?.classList.contains("active") ||
                            characterLibraryActiveTab() === "public"
                        ),
                    "Character Library defaults to visibly selected Public Characters tab",
                );
                await devWaitFor(
                    () => app.characterLibraryPublicSearch?.loading === false,
                    3000,
                    "initial public character search to settle",
                );
                const unifiedSearch = $("modalBox")?.querySelector?.("[data-unified-library-search]");
                if (unifiedSearch) {
                    unifiedSearch.value = "No matches";
                    handleUnifiedLibrarySearch(unifiedSearch.value);
                }
                await runUnifiedLibraryPublicSearch();
                const emptySearchCalls = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items" &&
                        call.options?.body?.search_text === "No matches",
                ).length;
                openCharacterLibraryModal({ fromMainMenu: true, tab: "public" });
                await devWaitFor(
                    () => app.characterLibraryPublicSearch?.loading === false,
                    3000,
                    "cached empty public character search to settle",
                );
                devAssert(
                    $("modalBox")?.querySelector?.("[data-unified-library-search]")?.value === "No matches" &&
                        calls.filter(
                            (call) =>
                                call.path === "/rest/v1/rpc/search_public_library_items" &&
                                call.options?.body?.search_text === "No matches",
                        ).length === emptySearchCalls,
                    "reopening Public Characters retains the last query and reuses cached empty results",
                    { emptySearchCalls, calls },
                );
                const restoredSearch = $("modalBox")?.querySelector?.("[data-unified-library-search]");
                if (restoredSearch) {
                    restoredSearch.value = "";
                    handleUnifiedLibrarySearch("");
                }
                await runUnifiedLibraryPublicSearch();
                const characterFeatureRails = () => [...($("modalBox")?.querySelectorAll?.(
                    "[data-character-library-story-rails] .character-library-story-rail",
                ) || [])];
                devAssert(!document.querySelector("[data-public-character-card] [data-character-presentation-control]"),
                    "public library grid cards do not contain gender selection controls");
                const liveFeaturedCharacterRailText = () =>
                    $("modalBox")?.querySelector?.(
                        "[data-character-library-story-rails] .character-library-story-rail",
                    )?.textContent || "";
                await devWaitFor(
                    () =>
                        /Featured Alpha/i.test(characterFeatureRails()[0]?.textContent || "") &&
                        /Featured Beta/i.test(characterFeatureRails()[0]?.textContent || ""),
                    3000,
                    "featured character bundle to render",
                );
                devAssert(
                    characterFeatureRails().length === 1 &&
                        /Featured Characters/i.test(characterFeatureRails()[0]?.textContent || "") &&
                        /Featured Alpha/i.test(characterFeatureRails()[0]?.textContent || "") &&
                        /Featured Beta/i.test(characterFeatureRails()[0]?.textContent || "") &&
                        /Community Characters/i.test(
                            $("modalBox")?.querySelector?.(
                                "[data-character-library-tab-panel='public']",
                            )?.textContent || "",
                        ) &&
                        featuredCharacterFetches === 1 &&
                        !/Featured Stories|Sandbox Stories/i.test(
                            $("modalBox")?.querySelector?.(
                                "[data-character-library-tab-panel='public']",
                            )?.textContent || "",
                        ),
                    "public Character Library renders SFW featured characters from one cached Perchance bundle without Supabase",
                    {
                        rails: characterFeatureRails().map((rail) => rail.textContent || ""),
                        featuredCharacterFetches,
                    },
                );
                const featuredAlphaEntry = Object.values(
                    app.publicLibraryCuratedEntries || {},
                ).find((entry) => entry.definition_id === featuredAlpha.id);
                const featuredAlphaImports = await importPublicCharacterToLibrary(
                    featuredAlphaEntry?.id || "",
                );
                const importedFeaturedAlpha = featuredAlphaImports?.[0] || null;
                const featuredAlphaImages = (app.profileImages || []).filter(
                    (image) => String(image.character_id || "") === featuredAlpha.id,
                );
                const storedFeaturedAlphaMaleSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [featuredAlpha.id, "male"],
                );
                const storedFeaturedAlphaNonMaleSelection = await app.persistence.getRecord(
                    "characterProfileImageSelections",
                    [featuredAlpha.id, "non_male"],
                );
                devAssert(
                    featuredAlphaImports?.length === 1 &&
                        importedFeaturedAlpha?.id === featuredAlpha.id &&
                        !(app.characterDefinitions || []).some(
                            (record) => record.id === featuredBeta.id,
                        ) &&
                        featuredAlphaHostedProfileFetches === 2 &&
                        featuredAlphaImages.length === 2 &&
                        featuredAlphaImages.filter((image) => image.male === true).length === 1 &&
                        featuredAlphaImages.filter((image) => image.male === false).length === 1 &&
                        importedFeaturedAlpha.active_profile_image_ids?.male ===
                            existingFeaturedAlphaMaleImage.id &&
                        !!importedFeaturedAlpha.active_profile_image_ids?.non_male &&
                        importedFeaturedAlpha.active_profile_image_ids.non_male !==
                            existingFeaturedAlphaMaleImage.id &&
                        storedFeaturedAlphaMaleSelection?.imageId ===
                            importedFeaturedAlpha.active_profile_image_ids.male &&
                        storedFeaturedAlphaNonMaleSelection?.imageId ===
                            importedFeaturedAlpha.active_profile_image_ids.non_male,
                    "downloading one featured character imports only its manifest character, always fetches both hosted images, reuses exact local duplicates, and durably activates both presentations",
                    {
                        requestedId: featuredAlpha.id,
                        importedIds: (featuredAlphaImports || []).map(
                            (record) => record.id,
                        ),
                        featuredAlphaHostedProfileFetches,
                        featuredAlphaImages: featuredAlphaImages.map((image) => ({
                            id: image.id,
                            male: image.male,
                        })),
                        activeProfileImageIds:
                            importedFeaturedAlpha?.active_profile_image_ids,
                        storedProfileImageSelections: {
                            male: storedFeaturedAlphaMaleSelection,
                            non_male: storedFeaturedAlphaNonMaleSelection,
                        },
                    },
                );
                const profileImageCountBeforePublicSearch =
                    (app.profileImages || []).length;
                const callsBeforeSearchInput = calls.length;
                const unifiedSearchInput = document.querySelector("[data-unified-library-search]");
                unifiedSearchInput.value = "mira";
                unifiedSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 50));
                devAssert(
                    calls.length === callsBeforeSearchInput &&
                        !document.querySelector("[data-unified-library-public-search]")?.disabled &&
                        /Press Search/i.test($("characterLibraryPublicSearchHint")?.textContent || ""),
                    "merged public character library loads an initial page, then does not refetch edited criteria until Search is used",
                    { calls, hint: $("characterLibraryPublicSearchHint")?.textContent },
                );
                await runUnifiedLibraryPublicSearch();
                await new Promise((resolve) => setTimeout(resolve, 100));

                const loadMoreButton = $("modalBox")?.querySelector?.(
                    "[data-public-library-load-more='character']",
                );
                app.characterLibraryPublicSearch.hasNext = true;
                app.characterLibraryPublicSearch.loading = true;
                updatePublicLibraryLoadMoreButton("character");
                devAssert(
                    !loadMoreButton?.hidden &&
                        loadMoreButton.disabled &&
                        loadMoreButton.getAttribute("aria-busy") === "true" &&
                        !!loadMoreButton.querySelector(".loading-spinner"),
                    "public character pagination shows a disabled loading circle in the Load More button",
                    { html: loadMoreButton?.outerHTML || "" },
                );
                app.characterLibraryPublicSearch.loading = false;
                updatePublicLibraryLoadMoreButton("character");
                const paginationCallsBeforeScroll = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                const libraryBox = $("modalBox");
                libraryBox.scrollTop = Math.max(
                    0,
                    libraryBox.scrollHeight - libraryBox.clientHeight,
                );
                const downwardWheel = new Event("wheel", { bubbles: true });
                Object.defineProperty(downwardWheel, "deltaY", { value: 1 });
                libraryBox.dispatchEvent(downwardWheel);
                await devWaitFor(
                    () => app.characterLibraryPublicSearch?.loading === false,
                    3000,
                    "public character scroll pagination to settle",
                );
                const paginationCallsAfterScroll = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                devAssert(
                    paginationCallsAfterScroll === paginationCallsBeforeScroll + 1,
                    "one downward scroll attempt at the library bottom requests exactly one additional public-character batch",
                    {
                        paginationCallsBeforeScroll,
                        paginationCallsAfterScroll,
                    },
                );
                await openPublicCharacterLibraryDetail(
                    "public-char-library-smoke",
                    "public",
                );
                await new Promise((resolve) => setTimeout(resolve, 100));
                const publicDetailLayer = document.querySelector("[data-character-library-layer='1']");
                devTestLog("Public character detail rendered", {
                    text: publicDetailLayer?.textContent || "",
                    html: (publicDetailLayer?.innerHTML || "").slice(0, 2000),
                });
                const readonlyDefinition = publicDetailLayer?.querySelector?.(
                    ".character-library-readonly-definition",
                );
                const definitionRoot = readonlyDefinition?.querySelector?.(
                    ":scope > details.state-branch",
                );
                const readonlyDefinitionStyle = readonlyDefinition
                    ? getComputedStyle(readonlyDefinition)
                    : null;
                const genresList = [...(readonlyDefinition?.querySelectorAll?.("details.state-branch") || [])]
                    .find((details) =>
                        /^genres list$/i.test(
                            details.querySelector(":scope > summary")?.textContent?.trim() || "",
                        ),
                    );
                devAssert(
                    /Public Character|Public Library Mira/i.test(publicDetailLayer?.textContent || "") &&
                        !!readonlyDefinition &&
                        definitionRoot?.open === false &&
                        readonlyDefinitionStyle?.overflow === "visible" &&
                        readonlyDefinitionStyle?.maxHeight === "none" &&
                        genresList?.querySelectorAll(".state-readonly-list-value").length === 1 &&
                        !genresList?.querySelector(".state-array-item") &&
                        !/\bvalue\b/i.test(genresList?.textContent || "") &&
                        /Character Definition/i.test(publicDetailLayer?.textContent || "") &&
                        /arcane scout/i.test(publicDetailLayer?.textContent || "") &&
                        !/Readonly Definition/i.test(publicDetailLayer?.textContent || ""),
                    "public character detail renders its full definition collapsed without a nested scrollbar",
                    {
                        text: publicDetailLayer?.textContent || "",
                        definitionOpen: definitionRoot?.open,
                        overflow: readonlyDefinitionStyle?.overflow,
                        maxHeight: readonlyDefinitionStyle?.maxHeight,
                        genresList: genresList?.textContent || "",
                    },
                );
                const publicSearchCallsBeforeImport = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                const publicMiraImports = await importPublicCharacterToLibrary(
                    "public-char-library-smoke",
                );
                const publicSearchCallsAfterImport = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                if (!(publicMiraImports || []).some((record) => record.name === "Public Library Mira"))
                    devTestLog("Public character import mismatch", {
                        imported: publicMiraImports,
                        definitionNames: (app.characterDefinitions || []).map(
                            (record) => record.name,
                        ),
                        failureText: (app.storageFailures || []).slice(-3)
                            .map((failure) => `${failure.key}: ${failure.message}`)
                            .join(" | "),
                        popupText:
                            [...document.querySelectorAll(".popup-modal.open")].at(-1)
                                ?.textContent || "",
                    });
                devAssert(
                    (publicMiraImports || []).some(
                        (record) => record.name === "Public Library Mira",
                    ) &&
                        (app.characterDefinitions || []).some(
                        (record) => record.name === "Public Library Mira",
                    ) &&
                        !app.state.characters?.["Public Library Mira"] &&
                        publicSearchCallsAfterImport ===
                            publicSearchCallsBeforeImport,
                    "public character import stores the definition without touching active game characters or repeating the Supabase search",
                    {
                        imported: publicMiraImports,
                        definitions: app.characterDefinitions,
                        characters: app.state.characters,
                        publicSearchCallsBeforeImport,
                        publicSearchCallsAfterImport,
                        popupText:
                            [...document.querySelectorAll(".popup-modal.open")].at(-1)
                                ?.textContent || "",
                    },
                );
                const importedMira = (app.characterDefinitions || []).find(
                    (record) => record.name === "Public Library Mira",
                );
                const registeredMira = registerCharacterLibraryProfileEntity(
                    importedMira,
                    "female",
                );
                saveProfileImageDefaultSeed(registeredMira?.name, 24681357);
                devAssert(
                    importedMira?.character?.default_seed === 24681357 &&
                        importedMira?.character?.image_prompt_config?.seed === 24681357,
                    "character image-panel seed changes persist to the standalone library definition without generating an image",
                    { record: importedMira },
                );
                openCharacterLibrarySettings(characterLibraryRecordId(importedMira));
                const preferredVoiceSelect = $("characterLibraryPreferredVoiceName");
                preferredVoiceSelect?.append(
                    new Option("Smoke Installed Voice", "Smoke Installed Voice"),
                );
                if (preferredVoiceSelect) preferredVoiceSelect.value = "Smoke Installed Voice";
                saveCharacterLibrarySettings();
                const settingsSavedMira = (app.characterDefinitions || []).find(
                    (record) => record.id === importedMira.id,
                );
                devAssert(
                    settingsSavedMira?.character?.voice === null &&
                        settingsSavedMira?.preferred_voice_name === "Smoke Installed Voice",
                    "character settings keep authored voice null and save the browser voice as local library metadata",
                    { record: settingsSavedMira },
                );
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                saveSupabaseSession({
                    access_token: "mock-character-library-token",
                    refresh_token: "mock-character-library-refresh",
                    token_type: "bearer",
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    user: { id: "owned-public-user", email: "owned@example.com" },
                });
                app.characterLibraryOwnedCharactersLoading = false;
                app.characterLibraryOwnedCharacterEntries = [];
                openCharacterLibraryModal({ fromMainMenu: true, tab: "mine" });
                await refreshCharacterLibraryOwnedPublicCharacters();
                await devWaitFor(
                    () =>
                        calls.some(
                            (call) =>
                                call.path.startsWith("/rest/v1/library_items") &&
                                /owner_user_id=eq\.owned-public-user/.test(call.path) &&
                                /type=eq\.character/.test(call.path),
                        ) &&
                        /Public Library Mira/i.test(
                            document.querySelector("[data-character-library-published-results='mine']")?.textContent || "",
                        ),
                    3000,
                    "owned public character to render in My Characters",
                );
                const initiallyHiddenPublishedImage = document.querySelector(
                    "[data-character-library-published-results='mine'] [data-public-entry-id='initially-hidden-character'] img",
                );
                devAssert(
                    calls.some(
                        (call) =>
                            call.path.startsWith("/rest/v1/library_items") &&
                            /owner_user_id=eq\.owned-public-user/.test(call.path) &&
                            /type=eq\.character/.test(call.path),
                        ) &&
                        /Public Library Mira/i.test(
                            document.querySelector("[data-character-library-published-results='mine']")
                                ?.textContent || "",
                        ) &&
                        !/Public Missing Image Smoke/i.test(
                            document.querySelector("[data-character-library-published-results='mine']")
                                ?.textContent || "",
                        ) &&
                        initiallyHiddenPublishedImage?.getAttribute("src") ===
                            initiallyHiddenImageUrl &&
                        calls.filter(
                            (call) =>
                                call.path ===
                                "/rest/v1/rpc/owned_library_hidden_previews",
                        ).length === 1 &&
                        calls.filter(
                            (call) =>
                                call.path === "/rest/v1/rpc/owned_library_version_state" &&
                                call.options?.body?.target_item_id ===
                                    "initially-hidden-character",
                        ).length === 1,
                    "My Characters resolves fully hidden cards before first render even when the batch RPC requires its compatibility fallback",
                    {
                        calls,
                        initiallyHiddenImageUrl:
                            initiallyHiddenPublishedImage?.getAttribute("src") || "",
                        mineResults:
                            document.querySelector("[data-character-library-published-results='mine']")
                                ?.textContent || "",
                    },
                );
                const supabaseCallsBeforeProfileChange = calls.length;
                const malePreferenceProfile = devCreateTestProfile({

                });

                malePreferenceProfile.settings.preferredCharacterGender = "male";
                hydrateUserProfileRuntime(malePreferenceProfile,{includeSettings:true});
                await refreshUnifiedLibraryAfterProfileChange();
                await devWaitFor(
                    () =>
                        /Featured Alpha Alternate/i.test(liveFeaturedCharacterRailText()) &&
                        /Featured Beta/i.test(liveFeaturedCharacterRailText()),
                    3000,
                    "featured characters to rerender for the male-preference profile",
                );
                const publishedAfterProfileChange = document.querySelector(
                    "[data-character-library-published-results='mine']",
                );
                const hiddenPublishedImageAfterProfileChange = document.querySelector(
                    "[data-character-library-published-results='mine'] [data-public-entry-id='initially-hidden-character'] img",
                );
                devAssert(
                    /Public Library Milo/i.test(publishedAfterProfileChange?.textContent || "") &&
                        hiddenPublishedImageAfterProfileChange?.getAttribute("src") ===
                            initiallyHiddenMaleImageUrl &&
                        /Featured Alpha Alternate/i.test(liveFeaturedCharacterRailText()) &&
                        /Featured Beta/i.test(liveFeaturedCharacterRailText()) &&
                        featuredCharacterFetches === 1 &&
                        calls.length === supabaseCallsBeforeProfileChange,
                    "profile changes rerender Published and Featured character presentations without additional Perchance or Supabase communication",
                    {
                        callsBefore: supabaseCallsBeforeProfileChange,
                        callsAfter: calls.length,
                        hiddenPublishedImageUrl:
                            hiddenPublishedImageAfterProfileChange?.getAttribute("src") || "",
                        publishedText: publishedAfterProfileChange?.textContent || "",
                    },
                );
                hydrateNoUserProfileRuntime();
                await refreshUnifiedLibraryAfterProfileChange({

                    previousLibraryContent: "both",
                });
                await devWaitFor(
                    () =>
                        /Featured Alpha/i.test(liveFeaturedCharacterRailText()) &&
                        /Featured Alpha Alternate/i.test(liveFeaturedCharacterRailText()) &&
                        /Featured Beta/i.test(liveFeaturedCharacterRailText()),
                    3000,
                    "featured characters to retain current presentation settings without an active profile",
                );
                devAssert(!activeUserProfile() && app.settings.preferredCharacterGender === "male",
                    "clearing a profile selection preserves the current presentation setting");

                hydrateUserProfileRuntime(malePreferenceProfile, { includeSettings: true });
                await refreshUnifiedLibraryAfterProfileChange();
                await devWaitFor(
                    () =>
                        /Featured Alpha Alternate/i.test(liveFeaturedCharacterRailText()) &&
                        /Featured Beta/i.test(liveFeaturedCharacterRailText()),
                    3000,
                    "male-preference profile to be restored after no-profile coverage",
                );
                const ownedCharacterCard = document.querySelector(
                    "[data-character-library-published-results='mine'] [data-public-entry-id='public-char-library-smoke']",
                );
                app.publicLibraryLastIndex = {
                    ...(app.publicLibraryLastIndex || {}),
                    items: [],
                };
                app.publicLibraryCuratedEntries = {};
                ownedCharacterCard?.click();
                await new Promise((resolve) => setTimeout(resolve, 100));
                const navigationVersionManager = ownedPublicLibraryVersionManagers(
                    "public-char-library-smoke",
                ).at(-1);
                const navigationVersionRows = [
                    ...(navigationVersionManager?.querySelectorAll?.(
                        "[data-owned-public-version]",
                    ) || []),
                ];
                devAssert(
                    !ownedCharacterCard?.querySelector?.(
                        "[data-owned-public-detail-action]",
                    ) &&
                        !!navigationVersionManager &&
                        navigationVersionRows.length === 3 &&
                        navigationVersionRows.every((row) =>
                            !!row.querySelector(".public-version-view-button"),
                        ) &&
                        !document.querySelector("[data-public-character-detail]"),
                    "Mine published character cards open version management directly and every revision has View",
                    {
                        managerConnected:
                            document.body.contains(navigationVersionManager),
                        versionCount: navigationVersionRows.length,
                        viewButtonCount:
                            navigationVersionManager?.querySelectorAll?.(
                                ".public-version-view-button",
                            )?.length || 0,
                    },
                );
                const versionOneRow = navigationVersionManager?.querySelector?.(
                    '[data-owned-public-version="public-char-library-version"]',
                );
                await openOwnedPublicCharacterVersionDetail(
                    "public-char-library-smoke",
                    "public-char-library-version",
                    versionOneRow?.querySelector?.(".public-version-view-button"),
                );
                const viewedOwnedVersion = document.querySelector(
                    "[data-public-character-detail]",
                );
                devAssert(
                    !document.body.contains(navigationVersionManager) &&
                        /Download \/ Import/.test(
                            viewedOwnedVersion?.textContent || "",
                        ) &&
                        /\bVersions\b/.test(
                            viewedOwnedVersion?.textContent || "",
                        ) &&
                        !/\bManage\b/.test(
                            viewedOwnedVersion?.textContent || "",
                        ) &&
                        viewedOwnedVersion?.querySelector?.(
                            "[data-public-character-detail-action='import']",
                        )?.getAttribute?.("onclick")?.includes(
                            "importPublicLibraryEntryVersion",
                        ),
                    "View closes Manage and opens the selected revision in the standard Public character panel",
                    {
                        managerConnected:
                            document.body.contains(navigationVersionManager),
                        text: viewedOwnedVersion?.textContent || "",
                        importAction:
                            viewedOwnedVersion?.querySelector?.(
                                "[data-public-character-detail-action='import']",
                            )?.getAttribute?.("onclick") || "",
                    },
                );
                closeContainingPopup(viewedOwnedVersion);
                await openPublicCharacterLibraryDetail(
                    "public-char-library-smoke",
                    "public",
                );
                const publicCharacterDetail = [
                    ...document.querySelectorAll("[data-character-library-layer]"),
                ].at(-1);
                devAssert(
                    /Download \/ Import/.test(
                        publicCharacterDetail?.textContent || "",
                    ) &&
                        /\bVersions\b/.test(
                            publicCharacterDetail?.textContent || "",
                        ) &&
                        !/\bManage\b/.test(
                            publicCharacterDetail?.textContent || "",
                        ),
                    "the Public character detail remains a consumer view for its owner",
                    { text: publicCharacterDetail?.textContent || "" },
                );
                await openOwnedPublicLibraryVersionManager("public-char-library-smoke");
                await devWaitFor(
                    () => document.querySelectorAll("[data-owned-public-version]").length === 3,
                    3000,
                    "compact owned version state to render",
                );
                const initialVersionRows = [...document.querySelectorAll("[data-owned-public-version]")];
                devAssert(
                    initialVersionRows[0]?.querySelector?.(".public-version-show-button")?.getAttribute("aria-pressed") === "true" &&
                        initialVersionRows[0]?.querySelector?.(".public-version-show-button")?.textContent?.includes("✓") &&
                        initialVersionRows[1]?.querySelector?.(".public-version-hide-button")?.getAttribute("aria-pressed") === "true" &&
                        initialVersionRows[1]?.querySelector?.(".public-version-hide-button")?.textContent?.includes("✓") &&
                        initialVersionRows[2]?.querySelector?.(".public-version-show-button")?.getAttribute("aria-pressed") === "true",
                    "compact visibility mask maps version bits and clearly marks the selected fixed-color control",
                    { rows: initialVersionRows.map((row) => ({
                        text: row.textContent || "",
                        showPressed: row.querySelector(".public-version-show-button")?.getAttribute("aria-pressed"),
                        hidePressed: row.querySelector(".public-version-hide-button")?.getAttribute("aria-pressed"),
                        showText: row.querySelector(".public-version-show-button")?.textContent,
                        hideText: row.querySelector(".public-version-hide-button")?.textContent,
                    })) },
                );
                await openOwnedPublicLibraryVersionManager("public-char-library-smoke");
                devAssert(
                    calls.filter(
                        (call) =>
                            call.path === "/rest/v1/rpc/owned_library_version_state" &&
                            call.options?.body?.target_item_id ===
                                "public-char-library-smoke",
                    ).length === 1,
                    "reopening Manage reuses authoritative owned version state",
                    { calls },
                );
                const hiddenItemState = exactOwnedPublicLibraryVersionState({
                    i: "public-char-library-smoke",
                    c: "public-char-library-version",
                    p: false,
                    n: 3,
                    m: "BQ==",
                    v: [
                        ["public-char-library-version-3", 3, `${characterUrl}?v=3`, null, 303, onePixelDataUrl, "Third version.", "2026-08-28T03:00:00.000Z"],
                        ["public-char-library-version-2", 2, `${characterUrl}?v=2`, null, 302, onePixelDataUrl, "Second version.", "2026-08-28T02:00:00.000Z"],
                        ["public-char-library-version", 1, characterUrl, null, 301, onePixelDataUrl, "First version.", "2026-08-28T01:00:00.000Z"],
                    ],
                    d: devSmokeSupabasePublicItemRow({
                        id: "public-char-library-smoke",
                        type: "character",
                        definition_id: publicMiraCharacterId,
                        name: "Public Library Mira",
                        male_name: "Public Library Milo",
                        non_male_name: "Public Library Mira",
                        male_image_url: onePixelDataUrl,
                        non_male_image_url: onePixelDataUrl,
                        current_version_id: "public-char-library-version",
                        visibility: "hidden",
                        gender: "female",
                        age: 28,
                        species: "human",
                        role: "library tester",
                        voice_gender: "female",
                    }),
                });
                devAssert(
                    hiddenItemState.public === false &&
                        hiddenItemState.versions.every((version) => version.visible === false),
                    "item-level hidden visibility overrides stale shown version bits",
                    hiddenItemState,
                );
                const legacyImageMismatchState = {
                    itemId: "public-char-library-smoke",
                    currentVersionId: "public-char-library-version",
                    public: true,
                    versions: [
                        {
                            id: "public-char-library-version-2",
                            version_number: 2,
                            visible: false,
                            image_url: "https://example.invalid/version-2.jpg",
                        },
                        {
                            id: "public-char-library-version",
                            version_number: 1,
                            visible: true,
                            image_url: "https://example.invalid/version-1.jpg",
                        },
                    ],
                    item: {
                        id: "public-char-library-smoke",
                        current_version_id: "public-char-library-version",
                        male_image_url: "https://example.invalid/version-2.jpg",
                        non_male_image_url: "https://example.invalid/version-2.jpg",
                    },
                };
                const legacyImageMismatchReport =
                    publicLibraryVersionConsistencyReport(
                        legacyImageMismatchState,
                        { image_url: "https://example.invalid/version-1.jpg" },
                    );
                devAssert(
                    legacyImageMismatchReport.issues.includes(
                        "item presentation images omit the current version image",
                    ) &&
                        legacyImageMismatchReport.currentVersionNumber === 1 &&
                        legacyImageMismatchReport.newestVisibleVersionNumber === 1,
                    "version diagnostics identify stale item presentation URLs when visibility and current version disagree",
                    legacyImageMismatchReport,
                );
                const searchCacheBeforeVisibilityChange = clone(
                    publicLibrarySearchCache(),
                );
                let releaseVisibilityMutation = null;
                visibilityMutationGate = new Promise((resolve) => {
                    releaseVisibilityMutation = resolve;
                });
                const visibilityCallsBefore = calls.filter(
                    (call) =>
                        call.path ===
                        "/rest/v1/rpc/set_owned_library_version_visibility",
                ).length;
                const visibilityUpdate = setOwnedPublicLibraryVersionVisibility(
                    "public-char-library-smoke",
                    "public-char-library-version-3",
                    false,
                );
                let pendingObservationError = null;
                try {
                    await devWaitFor(
                        () => {
                            const manager = ownedPublicLibraryVersionManagers(
                                "public-char-library-smoke",
                            ).at(-1);
                            const buttons = [
                                ...(manager?.querySelectorAll?.(
                                    ".public-version-show-button, .public-version-hide-button",
                                ) || []),
                            ];
                            return (
                                buttons.length === 6 &&
                                buttons.every((button) => button.disabled) &&
                                manager
                                    ?.querySelector?.("#ownedPublicVersionStatus")
                                    ?.getAttribute("aria-busy") === "true"
                            );
                        },
                        3000,
                        "shared version visibility loading state",
                    );
                } catch (error) {
                    pendingObservationError = error;
                }
                const blockedVisibilityUpdate = setOwnedPublicLibraryVersionVisibility(
                    "public-char-library-smoke",
                    "public-char-library-version-2",
                    true,
                );
                await Promise.resolve();
                const visibilityCallsWhilePending = calls.filter(
                    (call) =>
                        call.path ===
                        "/rest/v1/rpc/set_owned_library_version_visibility",
                ).length;
                releaseVisibilityMutation?.();
                visibilityMutationGate = null;
                await Promise.all([visibilityUpdate, blockedVisibilityUpdate]);
                if (pendingObservationError) throw pendingObservationError;
                const managerAfterVisibility = ownedPublicLibraryVersionManagers(
                    "public-char-library-smoke",
                ).at(-1);
                const buttonsAfterVisibility = [
                    ...(managerAfterVisibility?.querySelectorAll?.(
                        ".public-version-show-button, .public-version-hide-button",
                    ) || []),
                ];
                devAssert(
                    visibilityCallsWhilePending === visibilityCallsBefore + 1 &&
                        buttonsAfterVisibility.length === 6 &&
                        buttonsAfterVisibility.every((button) => !button.disabled) &&
                        managerAfterVisibility
                            ?.querySelector?.("#ownedPublicVersionStatus")
                            ?.getAttribute("aria-busy") === "false",
                    "owned version Show and Hide controls share one loading lock and reject concurrent mutations",
                    {
                        visibilityCallsBefore,
                        visibilityCallsWhilePending,
                        buttonCount: buttonsAfterVisibility.length,
                    },
                );
                const ownedStateReadsBeforeManagerReopen = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/owned_library_version_state" &&
                        call.options?.body?.target_item_id ===
                            "public-char-library-smoke",
                ).length;
                await openPublicCharacterLibraryDetail(
                    "public-char-library-smoke",
                    "mine",
                );
                const reopenedManager = ownedPublicLibraryVersionManagers(
                    "public-char-library-smoke",
                ).at(-1);
                const reopenedVersionThree = reopenedManager?.querySelector?.(
                    "[data-owned-public-version='public-char-library-version-3']",
                );
                const ownedStateReadsAfterManagerReopen = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/owned_library_version_state" &&
                        call.options?.body?.target_item_id ===
                            "public-char-library-smoke",
                ).length;
                devAssert(
                    !!reopenedManager &&
                        reopenedVersionThree
                            ?.querySelector?.(".public-version-hide-button")
                            ?.getAttribute?.("aria-pressed") === "true" &&
                        app.publicLibraryVersionHistory?.[
                            "public-char-library-smoke"
                        ]?.find((version) => version.version_number === 3)
                            ?.visible === false &&
                        ownedStateReadsAfterManagerReopen ===
                            ownedStateReadsBeforeManagerReopen,
                    "reopening an owned character shows changed version state from the authoritative cache without another Supabase read",
                    {
                        ownedStateReadsBeforeManagerReopen,
                        ownedStateReadsAfterManagerReopen,
                        versionThreeText:
                            reopenedVersionThree?.textContent || "",
                    },
                );
                closeContainingPopup(reopenedManager);
                const visibilityMutation = calls.find(
                    (call) => call.path === "/rest/v1/rpc/set_owned_library_version_visibility",
                );
                devAssert(
                    visibilityMutation?.options?.method === "POST" &&
                        visibilityMutation?.options?.body?.target_version_id === "public-char-library-version-3" &&
                        visibilityMutation?.options?.body?.target_visible === false &&
                        app.publicLibraryVersionHistory?.["public-char-library-smoke"]?.find(
                            (version) => version.version_number === 3,
                        )?.visible === false,
                    "owned version visibility uses one explicit RPC mutation and applies its returned mask",
                    { visibilityMutation, history: app.publicLibraryVersionHistory?.["public-char-library-smoke"] },
                );
                await openOwnedPublicLibraryVersionManager("public-char-library-smoke");
                devAssert(
                    calls.filter(
                        (call) =>
                            call.path === "/rest/v1/rpc/owned_library_version_state" &&
                            call.options?.body?.target_item_id ===
                                "public-char-library-smoke",
                    ).length === 1,
                    "visibility mutation response refreshes the cached version state without another read",
                    { calls },
                );
                await setOwnedPublicLibraryVersionVisibility(
                    "public-char-library-smoke",
                    "public-char-library-version",
                    false,
                );
                const allHiddenPublishedCardImage = document.querySelector(
                    "[data-character-library-published-results='mine'] [data-public-entry-id='public-char-library-smoke'] img",
                );
                devAssert(
                    app.characterLibraryOwnedCharacterEntries.find(
                        (entry) => entry.id === "public-char-library-smoke",
                    )?.visibility === "hidden" &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.supabase_current_version_id === "" &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.version_number === 3 &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.url === `${characterUrl}?v=3` &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.image_url === hiddenLatestImageUrl &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.male_image_url === hiddenLatestImageUrl &&
                        app.characterLibraryOwnedCharacterEntries.find(
                            (entry) => entry.id === "public-char-library-smoke",
                        )?.non_male_image_url === hiddenLatestImageUrl &&
                        allHiddenPublishedCardImage?.getAttribute("src") === hiddenLatestImageUrl &&
                        (app.publicLibraryVersionHistory?.["public-char-library-smoke"] || []).every(
                            (version) => version.visible === false,
                        ),
                    "an all-zero visibility mask hides the item while the Mine preview falls back to the highest owned revision",
                    {
                        entry: app.characterLibraryOwnedCharacterEntries.find(
                            (item) => item.id === "public-char-library-smoke",
                        ),
                        history: app.publicLibraryVersionHistory?.["public-char-library-smoke"],
                        renderedImageUrl: allHiddenPublishedCardImage?.getAttribute("src") || "",
                    },
                );
                const hiddenWithoutCurrentVersion = publicLibraryEntryFromSupabaseItem(
                    devSmokeSupabasePublicItemRow({
                        id: "hidden-owned-item",
                        type: "character",
                        name: "Hidden Owned Character",
                        current_version_id: null,
                        visibility: "hidden",
                        male_image_url: onePixelDataUrl,
                        non_male_image_url: onePixelDataUrl,
                    }),
                    null,
                );
                devAssert(
                    hiddenWithoutCurrentVersion.visibility === "hidden" &&
                    hiddenWithoutCurrentVersion.supabase_current_version_id === "" &&
                        hiddenWithoutCurrentVersion.version_number === 0 &&
                        hiddenWithoutCurrentVersion.url.startsWith("supabase://hidden-library-item/"),
                    "owned hidden items without a current version remain valid library entries",
                    hiddenWithoutCurrentVersion,
                );
                const searchCacheAfterVisibilityChange =
                    publicLibrarySearchCache();
                const cachedPublicItemsAfterVisibilityChange = Object.values(
                    searchCacheAfterVisibilityChange.entries || {},
                ).flatMap((entry) => entry.items || []);
                devAssert(
                    JSON.stringify(searchCacheAfterVisibilityChange) !==
                        JSON.stringify(searchCacheBeforeVisibilityChange) &&
                        !cachedPublicItemsAfterVisibilityChange.some(
                            (entry) =>
                                String(entry.supabase_item_id || entry.id || "") ===
                                "public-char-library-smoke",
                        ) &&
                        !!app.hiddenPublicLibraryCacheMembership?.[
                            "public-char-library-smoke"
                        ],
                    "owned version visibility patches cached public results locally and remembers hidden-item membership without refetching",
                    {
                        before: searchCacheBeforeVisibilityChange,
                        after: searchCacheAfterVisibilityChange,
                        membership:
                            app.hiddenPublicLibraryCacheMembership?.[
                                "public-char-library-smoke"
                            ],
                    },
                );
                delete app.hiddenPublicLibraryCacheMembership?.[
                    "public-char-library-smoke"
                ];
                const publicSearchCallsBeforeRestore = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                await setOwnedPublicLibraryVersionVisibility(
                    "public-char-library-smoke",
                    "public-char-library-version",
                    true,
                );
                const publicSearchCallsAfterRestore = calls.filter(
                    (call) =>
                        call.path === "/rest/v1/rpc/search_public_library_items",
                ).length;
                const restoredPublicCard = document.querySelector(
                    "[data-character-library-results='public'] [data-public-entry-id='public-char-library-smoke']",
                );
                const restoredPublicCount = $(
                    "characterLibrarySearchCount-public",
                )?.textContent || "";
                devAssert(
                    app.characterLibraryPublicSearch?.items?.some(
                        (entry) => entry.id === "public-char-library-smoke",
                    ) &&
                        !!restoredPublicCard &&
                        /1 character of 12 total/i.test(restoredPublicCount) &&
                        publicSearchCallsAfterRestore ===
                            publicSearchCallsBeforeRestore,
                    "showing a formerly fully hidden version restores matching active public results and counts locally without repeating the Supabase search",
                    {
                        searchCallsBefore: publicSearchCallsBeforeRestore,
                        searchCallsAfter: publicSearchCallsAfterRestore,
                        activeItems: app.characterLibraryPublicSearch?.items,
                        restoredCard: restoredPublicCard?.textContent || "",
                        restoredPublicCount,
                    },
                );
                closeModal();
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                devCreateTestProfile({ name: "Smoke Male Profile" });
                openCharacterLibraryModal({ fromMainMenu: true, tab: "public" });
                await new Promise((resolve) => setTimeout(resolve, 100));
                openCharacterLibraryFilterPicker("genres");
                await new Promise((resolve) => setTimeout(resolve, 50));
                const fantasyGenre = [...document.querySelectorAll("[data-character-library-picker-option]")].find(
                    (button) => /^fantasy$/i.test(button.textContent || ""),
                );
                devAssert(!!fantasyGenre, "genre picker shows approved genre options");
                fantasyGenre.click();
                saveCharacterLibraryFilterPicker("genres");
                devAssert(
                    /fantasy/i.test(characterLibraryFilterValues("public").genres || "") &&
                        /fantasy/i.test($("modalBox")?.querySelector?.("[data-character-library-filter-summary='genres']")?.textContent || ""),
                    "genre picker writes readonly picked genre list into filters",
                );
                devAssert(
                    !(app.storageFailures || []).some((failure) =>
                        !originalStorageFailures.has(failure),
                    ),
                    "public character library profile switches do not produce storage failures",
                );
                devTestLog("Scenario complete: character-library-public-search-smoke");
            } finally {
                publicLibraryFetch = originalFetch;
                window.fetch = originalWindowFetch;
                fetchJsonFromPublicUploadUrl = originalPayloadFetch;
                fetchVerifiedPublicLibraryPayload = originalVerifiedPayloadFetch;
                app.settings.publicLibrarySupabaseUrl = originalSupabaseUrl;
                app.settings.publicLibrarySupabaseAnonKey = originalSupabaseAnonKey;
                app.publicLibrarySearchCache = originalSearchCache;
                app.publicLibrarySearchCacheLoaded = originalSearchCacheLoaded;
                app.ownedPublicLibraryVersionStateCache = originalOwnedVersionStateCache || {};
                app.characterLibraryPublicPayloads = originalPublicPayloads || {};
                app.publicLibraryCuratedEntries = originalCuratedEntries || {};
                app.publicLibraryCuratedPayloadCache = originalCuratedPayloadCache || {};
                app.publicLibraryCuratedPayloadRequests =
                    originalCuratedPayloadRequests || new Map();
                PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.splice(
                    0,
                    PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS.length,
                    ...originalFeaturedCharacterManifest,
                );
                if (originalFeaturedPublisherDraft === null)
                    localStorage.removeItem(FEATURED_CONTENT_PUBLISHER_DRAFT_KEY);
                else
                    localStorage.setItem(
                        FEATURED_CONTENT_PUBLISHER_DRAFT_KEY,
                        originalFeaturedPublisherDraft,
                    );
                app.characterLibraryOwnedCharacterEntries = originalOwnedCharacterEntries;
                app.characterLibraryOwnedCharactersLoading = originalOwnedCharactersLoading;
                app.publicLibraryOwnedIndex = originalOwnedIndex;
                app.publicLibraryLastIndex = originalLastIndex;
                app.characterDefinitions = validatedCharacterLibraryDefinitions(originalDefinitions);
                app.profileImages = exactProfileImageStore(originalProfileImages);
                saveSupabaseSession(originalSession);
                devAssert(
                    ![
                        ...(app.characterLibraryOwnedCharacterEntries || []),
                        ...(app.publicLibraryOwnedIndex?.items || []),
                        ...(app.publicLibraryLastIndex?.items || []),
                    ].some((entry) =>
                        isPublicCharacterSearchSmokeArtifactName(
                            entry?.name || entry?.title,
                        ),
                    ),
                    "public character library smoke restores every owned-library cache",
                );
                scheduleActiveGameSave();
                document.querySelectorAll(".popup-modal").forEach((node) => node.remove());
                closeModal();
            }
        }

        async function devRunCharacterLibraryTabSwitchDeferredSmokeTest() {
            devTestLog("Scenario start: character-library-tab-switch-deferred-smoke");
            devResetForLiveTest("character-library-tab-switch-deferred-smoke");
            devCreateTestProfile({  });
            const originalDefinitions = clone(app.characterDefinitions || []);
            const originalFilter = filterCharacterLibraryModal;
            const originalQueue = queueFirstVisibleCharacterLibraryMissingProfile;
            let filterCalls = 0;
            let queueCalls = 0;
            try {
                app.characterDefinitions = validatedCharacterLibraryDefinitions([
                    devSmokeCharacterRecord("Deferred Tab Tester", {
                        character: {
                            name: "Deferred Tab Tester",
                            gender: "female",
                            age: 28,
                            role: "tab switch tester",
                            source: "Smoke Source",
                            creator: "debug harness",
                            creator_id: "00000000-0000-4000-8000-000000000001",
                            creation_tool: "debug harness",
                            genres: ["fantasy"],
                        },
                    }),
                ]);
                openCharacterLibraryModal({ fromMainMenu: true, tab: "public" });
                await new Promise((resolve) => setTimeout(resolve, 80));
                filterCharacterLibraryModal = (...args) => {
                    filterCalls += 1;
                    return originalFilter(...args);
                };
                queueFirstVisibleCharacterLibraryMissingProfile = (...args) => {
                    queueCalls += 1;
                    return originalQueue(...args);
                };
                switchUnifiedLibraryTab("local");
                devAssert(
                    characterLibraryActiveTab() === "local" &&
                        !document.querySelector("[data-character-library-tab-panel='local']")?.hidden &&
                        filterCalls === 0 &&
                        queueCalls === 0,
                    "Local Characters tab becomes visible before expensive local filter/profile work runs",
                    { activeTab: characterLibraryActiveTab(), filterCalls, queueCalls },
                );
                await new Promise((resolve) => setTimeout(resolve, 80));
                devAssert(
                    filterCalls > 0 && queueCalls > 0,
                    "Local Characters deferred filter/profile work runs after tab paint",
                    { filterCalls, queueCalls },
                );
                devTestLog("Scenario complete: character-library-tab-switch-deferred-smoke");
            } finally {
                filterCharacterLibraryModal = originalFilter;
                queueFirstVisibleCharacterLibraryMissingProfile = originalQueue;
                app.characterDefinitions = validatedCharacterLibraryDefinitions(originalDefinitions);
                closeModal();
                scheduleActiveGameSave();
            }
        }

        async function devRunCharacterLibraryLocalPaginationSmokeTest() {
            devTestLog("Scenario start: character-library-local-pagination-smoke");
            devResetForLiveTest("character-library-local-pagination-smoke");
            devCreateTestProfile({  });
            const originalDefinitions = clone(app.characterDefinitions || []);
            const originalQueue = queueFirstVisibleCharacterLibraryMissingProfile;
            const originalNextVisualWorkFrame = nextVisualWorkFrame;
            let queuedFrames = [];
            try {
                app.characterDefinitions = validatedCharacterLibraryDefinitions(
                    Array.from({ length: 140 }, (_, index) =>
                        devSmokeCharacterRecord(`Local Pagination ${index + 1}`, {
                            record: { id: `local-pagination-${index + 1}` },
                        }),
                    ),
                );
                queueFirstVisibleCharacterLibraryMissingProfile = () => false;
                openCharacterLibraryModal({ fromMainMenu: true, tab: "local" });
                const results = document.querySelector(
                    "[data-character-library-results='local']",
                );
                const state = virtualLibraryState("character:local");
                const localSearch = document.querySelector(
                    "[data-character-library-name-search='local']",
                );
                localSearch.value = "Local Pagination";
                localSearch.dispatchEvent(new Event("input", { bubbles: true }));
                await devWaitFor(
                    () =>
                        !!results?.querySelector?.("[data-virtual-library-more]") &&
                        state.rendered === state.batch,
                    3000,
                    "local character initial batch",
                );
                const button = results.querySelector("[data-virtual-library-more]");
                devAssert(
                    state.rendered === 48 &&
                        !results.querySelector("[data-character-library-card] [data-character-presentation-control]") &&
                        results.querySelectorAll("[data-character-library-card]").length === 48 &&
                        !state.loading,
                    "local character library renders one batch without eagerly chaining another",
                    {
                        rendered: state.rendered,
                        batch: state.batch,
                        cards: results.querySelectorAll("[data-character-library-card]").length,
                    },
                );

                const originalAppendMore = state.appendMore;
                let loadCalls = 0;
                state.appendMore = () => {
                    const wasLoading = state.loading;
                    const renderedBefore = state.rendered;
                    const result = originalAppendMore();
                    if (!wasLoading && state.rendered > renderedBefore) loadCalls += 1;
                    return result;
                };
                queuedFrames = [];
                nextVisualWorkFrame = (callback) => {
                    queuedFrames.push(callback);
                    return queuedFrames.length;
                };
                const firstButtonLoad = button.onclick();
                const duplicateButtonLoad = button.onclick();
                devTestLog("Local pagination button state", {
                    loadCalls,
                    firstPromise: typeof firstButtonLoad,
                    duplicatePromise: typeof duplicateButtonLoad,
                    samePromise: firstButtonLoad === duplicateButtonLoad,
                    loading: state.loading,
                    disabled: button.disabled,
                    ariaBusy: button.getAttribute("aria-busy"),
                    hasSpinner: !!button.querySelector(".loading-spinner"),
                    rendered: state.rendered,
                    queuedFrames: queuedFrames.length,
                });
                devAssert(
                    loadCalls === 1 &&
                        firstButtonLoad === duplicateButtonLoad &&
                        state.loading &&
                        button.disabled &&
                        button.getAttribute("aria-busy") === "true" &&
                        !!button.querySelector(".loading-spinner"),
                    "local Load More uses one shared in-flight promise with disabled spinner state",
                    { loadCalls, samePromise: firstButtonLoad === duplicateButtonLoad, html: button.outerHTML },
                );
                while (queuedFrames.length) queuedFrames.shift()();
                await firstButtonLoad;
                nextVisualWorkFrame = originalNextVisualWorkFrame;
                devAssert(
                    state.rendered === 96 &&
                        loadCalls === 1 &&
                        !state.loading &&
                        !button.disabled,
                    "local Load More appends exactly one batch and restores the fallback button",
                    { rendered: state.rendered, loadCalls, loading: state.loading },
                );

                const libraryBox = $("modalBox");
                Object.defineProperties(libraryBox, {
                    scrollTop: { configurable: true, writable: true, value: 0 },
                    scrollHeight: { configurable: true, value: 1000 },
                    clientHeight: { configurable: true, value: 100 },
                });
                libraryBox.scrollTop = 900;
                libraryBox.dispatchEvent(new Event("scroll"));
                devAssert(
                    state.rendered === 96 && state.bottomReached === true,
                    "reaching the local library bottom arms pagination without loading eagerly",
                    { rendered: state.rendered, bottomReached: state.bottomReached },
                );
                const beforeScrollLoad = state.rendered;
                const downwardWheel = new Event("wheel", { bubbles: true });
                Object.defineProperty(downwardWheel, "deltaY", { value: 1 });
                libraryBox.dispatchEvent(downwardWheel);
                libraryBox.dispatchEvent(downwardWheel);
                await devWaitFor(
                    () => !state.loading,
                    3000,
                    "local character downward pagination",
                );
                devAssert(
                    loadCalls === 2 &&
                        beforeScrollLoad === 96 &&
                        state.rendered === 140 &&
                        state.bottomReached === false,
                    "a second downward attempt at the local bottom loads exactly one next batch and deduplicates repeated attempts",
                    {
                        loadCalls,
                        beforeScrollLoad,
                        rendered: state.rendered,
                        bottomReached: state.bottomReached,
                    },
                );
                libraryBox.scrollTop = 0;
                libraryBox.dispatchEvent(new Event("scroll"));
                const upwardWheel = new Event("wheel", { bubbles: true });
                Object.defineProperty(upwardWheel, "deltaY", { value: -1 });
                libraryBox.dispatchEvent(upwardWheel);
                devAssert(
                    state.rendered === 140 && loadCalls === 2,
                    "upward local-library scrolling does not request another batch",
                    { rendered: state.rendered, loadCalls },
                );

                const filterGeneration = state.generation;
                setCharacterLibraryNameSearch("local", "Local Pagination 1");
                await devWaitFor(
                    () =>
                        state.generation > filterGeneration &&
                        state.rendered === 48 &&
                        !!results.querySelector("[data-virtual-library-more]"),
                    3000,
                    "local character same-tab filter rerender",
                );
                const filteredRecordCount = state.records.length;
                devAssert(
                    filteredRecordCount > 48 &&
                        state.rendered === 48 &&
                        state.bottomReached === false,
                    "filtering the active local tab resets its pagination gesture state",
                    {
                        records: filteredRecordCount,
                        rendered: state.rendered,
                        bottomReached: state.bottomReached,
                    },
                );
                const appendAfterFilter = state.appendMore;
                let filteredLoadCalls = 0;
                state.appendMore = () => {
                    filteredLoadCalls += 1;
                    return appendAfterFilter();
                };
                libraryBox.scrollTop = 900;
                libraryBox.dispatchEvent(new Event("scroll"));
                devAssert(
                    state.bottomReached === true && filteredLoadCalls === 0,
                    "the current local listener remains armed-only after a same-key rerender",
                    { bottomReached: state.bottomReached, filteredLoadCalls },
                );
                const filteredDownwardWheel = new Event("wheel", { bubbles: true });
                Object.defineProperty(filteredDownwardWheel, "deltaY", { value: 1 });
                libraryBox.dispatchEvent(filteredDownwardWheel);
                libraryBox.dispatchEvent(filteredDownwardWheel);
                await devWaitFor(
                    () => !state.loading,
                    3000,
                    "local character filtered downward pagination",
                );
                devAssert(
                    filteredLoadCalls === 1 &&
                        state.rendered === filteredRecordCount &&
                        state.bottomReached === false,
                    "same-key rerender keeps one dynamic bottom-scroll listener without duplicate loads",
                    {
                        filteredLoadCalls,
                        rendered: state.rendered,
                        bottomReached: state.bottomReached,
                    },
                );
                devTestLog("Scenario complete: character-library-local-pagination-smoke");
            } finally {
                nextVisualWorkFrame = originalNextVisualWorkFrame;
                queueFirstVisibleCharacterLibraryMissingProfile = originalQueue;
                queuedFrames = [];
                app.characterDefinitions = validatedCharacterLibraryDefinitions(originalDefinitions);
                closeModal();
                scheduleActiveGameSave();
            }
        }

        async function devRunManualLibraryCreationUiCoverage() {
            const originalCreator = selectedCreatorIdentity;
            const identity = createCreatorIdentityRecord({ creator_id: "manual-ui-smoke-creator", creator_name: "Manual UI Smoke Creator" });
            let draftId = "";
            const wait = () => new Promise(resolve => setTimeout(resolve, 40));
            const field = path => devFieldByPath("#manualCharacterCreateEditor", ["character_definition", ...path]);
            const enter = (path, value) => {
                const input = field(path);
                devAssert(!!input, "creation UI contains the requested field", { path });
                input.focus();
                input.value = value;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
            };
            try {
                selectedCreatorIdentity = () => identity;
                openCharacterCreationChoicePanel();
                document.querySelector("[data-character-creation-manual]").click();
                await wait();
                draftId = app.manualCharacterDraft.id;
                $("manualCharacterCreateEditor").querySelector("[data-character-editor-genres] button").click();
                [...document.querySelectorAll('[data-character-library-picker-option]')].find(button => /^fantasy$/i.test(button.textContent)).click();
                saveCharacterLibraryFilterPicker("genres");
                const name = "Manual Library UI Smoke Character";
                for (const [path, value] of [
                    [["name"], name], [["fallback_name"], "Manual Library UI Smoke Alternate"],
                    [["age"], "30"], [["gender"], "female"], [["role"], "Test companion"],
                    [["personality_description"], "A patient synthetic test companion."],
                    [["speech_style"], "Clear and concise."], [["appearance", "species"], "human"],
                    [["outfits", 0, "name"], "Test Outfit"], [["fallback_outfits", 0, "name"], "Alternate Outfit"],
                    [["starting_held_items", "right_hand"], "Test chisel"],
                    [["starting_held_items", "left_hand"], "Test mallet"],
                ]) enter(path, value);
                for (const key of ["starting_known_facts", "starting_inventory"]) {
                    for (let i = 0; i < 4; i++) {
                        const add = [...$("manualCharacterCreateEditor").querySelectorAll("[data-state-array-add-path]")].find(button =>
                            decodeURIComponent(button.dataset.stateArrayAddPath) === JSON.stringify(["character_definition", key]));
                        add.click();
                        await wait();
                        enter([key, i], `Synthetic ${key} entry ${i}`);
                    }
                    const row = field([key, 1]).closest("[data-state-array-item-path]");
                    devAssert(row.querySelectorAll("button").length === 1,
                        "text list row has only one remove action and no null action", { key });
                    row.querySelector("button").click();
                    await wait();
                    devAssert(field([key, 1]).value === `Synthetic ${key} entry 2`,
                        "removing a populated list row preserves and reindexes remaining text", { key });
                }
                //An unfinished list row must show a correction notice, never replace the draft with recovery UI.
                enter(["starting_known_facts", 0], "");
                $("manualCharacterCreateSaveButton").click();
                await wait();
                const notice = document.querySelector('[data-simple-notice-popup="1"]');
                devAssert(notice?.textContent.includes("Character Needs Corrections") && field(["name"]).value === name,
                    "invalid save preserves the live filled character editor");
                notice.querySelector("#noticeOkBtn").click();
                enter(["starting_known_facts", 0], "Corrected synthetic fact");
                for (let attempt = 0; attempt < 100 && $("manualCharacterCreateSaveButton").disabled; attempt++) await wait();
                $("manualCharacterCreateSaveButton").click();
                for (let attempt = 0; attempt < 100 && !characterLibraryRecordById(characterLibraryRecordId({ id: draftId })); attempt++) await wait();
                const record = characterLibraryRecordById(characterLibraryRecordId({ id: draftId }));
                const saved = record && characterLibraryRecordEntity(record);
                devAssert(saved?.name === name && saved?.gender === "female" &&
                    saved?.starting_known_facts?.length === 3 && saved?.starting_inventory?.length === 3 &&
                    saved?.starting_held_items?.left_hand === "Test mallet" &&
                    saved?.starting_held_items?.right_hand === "Test chisel",
                    "manual creation saves the completed character and retains list edits and held items", { saved });
            }
            finally {
                selectedCreatorIdentity = originalCreator;
                app.manualCharacterDraft = null;
                app.manualCharacterCreateMode = "";
                document.querySelectorAll('[data-manual-character-create-layer], [data-character-creation-choice]').forEach(box => box.closest(".popup-modal")?.remove());
                if (draftId && characterLibraryRecordById(characterLibraryRecordId({ id: draftId }))) {
                    await deletePerRecordLibraryRecords(CHARACTER_LIBRARY_KEY, [{ id: draftId }]);
                    app.characterDefinitions = app.characterDefinitions.filter(record => record.id !== draftId);
                }
                closeModal();
            }
        }

        async function devRunManualCharacterEditorSmokeTest() {
            devTestLog("Scenario start: manual-character-editor-smoke");
            devResetForLiveTest("manual-character-editor-smoke");
            devCreateTestProfile({  });
            await devRunManualLibraryCreationUiCoverage();
            const authoredDraft = newManualLibraryCharacterDraft();
            Object.assign(authoredDraft, {
                name: "Synthetic Draft Tester", fallback_name: "Synthetic Alternate Tester",
                age: 30, gender: "female", role: "Test companion",
                personality_description: "A patient synthetic test companion.", genres: ["fantasy"],
            });
            authoredDraft.appearance.species = "human";
            authoredDraft.outfits[0].name = "Test Outfit";
            authoredDraft.fallback_outfits[0].name = "Alternate Test Outfit";
            const addedOutfit = defaultArrayItemForPath(["character_definition", "outfits"]);
            addedOutfit.name = "Second Test Outfit";
            authoredDraft.outfits.push(addedOutfit);
            const draftValidation = validateCharacterDefinition(authoredDraft);
            devAssert(draftValidation.ok,
                "new library draft with completed author fields and an added outfit satisfies the canonical definition validator",
                draftValidation);
            const draftEditorHost = document.createElement("div");
            draftEditorHost.innerHTML = buildCharacterDefinitionOnlyEditor(authoredDraft);
            const draftReadback = readCharacterDefinitionOnlyEditor(authoredDraft, draftEditorHost);
            const readbackValidation = validateCharacterDefinition(draftReadback);
            const backgroundRecord = devSmokeCharacterRecord(
                "Background Contract Character",
                {
                    record: { id: "background-contract-character" },
                    character: {
                        id: "background-contract-character",
                        default_image_background:
                            "a moonlit rooftop garden above a quiet city",
                    },
                },
            );
            const backgroundCharacter = backgroundRecord.character;
            const omittedBackgroundCharacter = clone(backgroundCharacter);
            delete omittedBackgroundCharacter.default_image_background;
            const blankBackgroundCharacter = clone(backgroundCharacter);
            blankBackgroundCharacter.default_image_background = "";
            devAssert(
                validateCharacterDefinition(backgroundCharacter).ok &&
                    validateCharacterDefinition(omittedBackgroundCharacter).ok &&
                    !validateCharacterDefinition(blankBackgroundCharacter).ok &&
                    !validateCharacterDefinition(backgroundCharacter, "character", {
                        embedded: true,
                    }).ok,
                "default image background is optional nonempty standalone character data and is rejected from story-embedded characters",
            );
            const editorProjection = characterDefinitionOnlySplit(backgroundCharacter);
            const profilePrompt = buildProfileImagePrompt(
                backgroundCharacter.name,
                backgroundCharacter,
            );
            const explicitProfilePrompt = buildProfileImagePrompt(
                backgroundCharacter.name,
                backgroundCharacter,
                { backgroundOverride: "an explicit white studio" },
            );
            const soloPrompt = buildImagePrompt(
                backgroundCharacter.name,
                backgroundCharacter,
                { includeSceneContext: false },
            );
            const explicitSoloPrompt = buildImagePrompt(
                backgroundCharacter.name,
                backgroundCharacter,
                {
                    includeSceneContext: false,
                    backgroundOverride: "an explicit black studio",
                },
            );
            const groupPrompt = buildGroupImagePrompt([
                [backgroundCharacter.name, backgroundCharacter],
                ["Second Character", clone(omittedBackgroundCharacter)],
            ]);
            devAssert(
                editorProjection.character_definition.default_image_background ===
                    backgroundCharacter.default_image_background &&
                    profilePrompt.includes(backgroundCharacter.default_image_background) &&
                    soloPrompt.includes(backgroundCharacter.default_image_background) &&
                    explicitProfilePrompt.includes("an explicit white studio") &&
                    !explicitProfilePrompt.includes(backgroundCharacter.default_image_background) &&
                    explicitSoloPrompt.includes("an explicit black studio") &&
                    !explicitSoloPrompt.includes(backgroundCharacter.default_image_background) &&
                    !groupPrompt.includes(backgroundCharacter.default_image_background),
                "default image background survives editor projection, supplies solo fallbacks, yields to explicit settings, and stays out of group images",
            );
            const soloReward = {
                type: "generate_solo_normal_image",
                target: backgroundCharacter.name,
                reason: "solo reward prompt contract",
                outfit_id: "default",
                description: "silver hair, a fitted red travel coat, and polished boots",
                background: "a quiet blue studio",
            };
            const promptCharacter = clone(backgroundCharacter);
            promptCharacter.pose = "leaning dramatically against the tavern bar";
            promptCharacter.state_of_mind = "smirking at a nearby rival";
            promptCharacter.physical_state = "breathing hard after a chase";
            promptCharacter.held_items = {
                right_hand: "a tankard of ale",
                left_hand: "a glowing dagger",
            };
            promptCharacter.image = {
                image_type: "dramatic scene illustration",
                view: "three-quarter view",
                expression: "a sly grin",
                background: "the crowded tavern interior",
            };
            const previousLocation = app.state.location;
            const previousScene = app.state.scene;
            app.state.location = { specific_place: "the crowded tavern interior" };
            app.state.scene = {
                ...(previousScene || {}),
                image_characters: [promptCharacter.name],
                image_action: "raising a tankard toward the rival",
            };
            const descriptionPrompt = buildImagePrompt(
                promptCharacter.name,
                promptCharacter,
                {
                    descriptionOverride: soloReward.description,
                    clothingOverride: promptCharacter.clothing,
                    heldItemsOverride: promptCharacter.held_items,
                },
            );
            const descriptionWithBackgroundPrompt = buildImagePrompt(
                promptCharacter.name,
                promptCharacter,
                {
                    descriptionOverride: soloReward.description,
                    backgroundOverride: soloReward.background,
                    clothingOverride: promptCharacter.clothing,
                    heldItemsOverride: promptCharacter.held_items,
                },
            );
            devAssert(
                exactObjectiveRewardValidationErrors(soloReward, "reward").length === 0 &&
                    descriptionPrompt.includes(soloReward.description) &&
                    !descriptionPrompt.includes(promptCharacter.pose) &&
                    !descriptionPrompt.includes(promptCharacter.state_of_mind) &&
                    !descriptionPrompt.includes(promptCharacter.physical_state) &&
                    !descriptionPrompt.includes(promptCharacter.image.expression) &&
                    !descriptionPrompt.includes("the crowded tavern interior") &&
                    !descriptionPrompt.includes(backgroundCharacter.default_image_background) &&
                    !descriptionPrompt.includes("raising a tankard") &&
                    !descriptionPrompt.includes("tankard of ale") &&
                    !descriptionPrompt.includes("glowing dagger") &&
                    descriptionWithBackgroundPrompt.includes(soloReward.background) &&
                    !descriptionWithBackgroundPrompt.includes("the crowded tavern interior") &&
                    !descriptionWithBackgroundPrompt.includes("raising a tankard") &&
                    !descriptionWithBackgroundPrompt.includes(promptCharacter.pose),
                "solo normal image rewards accept optional description/background fields and description mode suppresses scene-derived visual context",
                {
                    descriptionPrompt,
                    descriptionWithBackgroundPrompt,
                },
            );
            app.state.location = previousLocation;
            app.state.scene = previousScene;
            // SANITIZE KEEP (dev fixture): synthetic current-game state for manual character UI.
            // SANITIZE TEST: This smoke covers manual character creation and generated-default-image metadata wiring.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Manual Character Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Manual Tester",
                    age: 30,
                    gender: "male",
                    role: "character editor tester",
                },
                characters: {},
                scene: {
                    ...clone(defaultState.scene || {}),
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
            });
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Manual character editor smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();

            openManualCharacterCreateModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Create Party Member/i.test($("modalBox")?.textContent || "") &&
                    !!$("manualCharacterCreateEditor"),
                "current-game Create Party Member opens the manual character editor",
            );

            const characterEditor = $("manualCharacterCreateEditor");
            const definitionHost = document.createElement("div");
            definitionHost.innerHTML = buildCharacterDefinitionOnlyEditor(app.manualCharacterDraft);
            const startingValues = {
                starting_relationship_to_player: "none",
                starting_trust: 2,
                starting_attraction: 3,
                starting_affection: 4,
                starting_state_of_mind: "Focused on a synthetic test task.",
                starting_physical_state: "Healthy and uninjured.",
                starting_pose: "Standing beside a workbench.",
            };
            const definitionField = path => [...definitionHost.querySelectorAll("[data-state-path]")].find(field =>
                decodeURIComponent(field.dataset.statePath) === JSON.stringify(["character_definition", ...path]));
            for (const [key, value] of Object.entries(startingValues)) {
                const field = definitionField([key]);
                devAssert(!!field, "library editor exposes each starting state field", { key });
                field.value = String(value);
            }
            for (const key of ["can_die", "romanceable"]) {
                const field = definitionField([key]);
                devAssert(field?.type === "checkbox", "library editor exposes character flags as checkboxes", { key });
                field.checked = !app.manualCharacterDraft[key];
            }
            definitionField(["starting_held_items", "right_hand"]).value = "Test chisel";
            definitionField(["starting_held_items", "left_hand"]).value = "Test mallet";
            const inventoryAdd = [...definitionHost.querySelectorAll("[data-state-array-add-path]")].find(button =>
                decodeURIComponent(button.dataset.stateArrayAddPath) === JSON.stringify(["character_definition", "starting_inventory"]));
            devAssert(!!inventoryAdd && !!definitionField(["fallback_name"]) && !!definitionField(["fallback_starting_outfit_id"]),
                "library editor exposes starting inventory and alternate presentation fields");
            inventoryAdd.dataset.stateArrayPending = "true";
            const editedDefinition = readCharacterDefinitionOnlyEditor(app.manualCharacterDraft, definitionHost);
            const storyButton = characterEditor.querySelector("[data-character-story-editor]");
            const storyField = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "chat_story_template"]);
            const draftNameField = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "name"]);
            draftNameField.value = "New Ally";
            const draftBeforeNotice = app.manualCharacterDraft;
            devAssert(storyButton?.textContent === "Story" && storyField?.type === "hidden",
                "attached story uses a Story button instead of an editable text field");
            storyButton.click();
            const storyNotice = document.querySelector('[data-simple-notice-popup="1"]');
            devAssert(storyNotice?.textContent.includes("chat_story") && storyNotice.textContent.includes("Not Available Yet"),
                "Story button explains the unavailable editor and detailed chat setup alternative");
            storyNotice.querySelector("#noticeOkBtn").click();
            devAssert(characterEditor.isConnected && draftNameField.value === "New Ally" && app.manualCharacterDraft === draftBeforeNotice &&
                coerceStateEditorValue(["chat_story_template"], "json", storyField) === null,
                "closing the Story notice preserves unsaved character edits and the attached-story value");
            const preservedStory = {lite: true, title: "Synthetic attached story preservation", state: { marker: [1, "unchanged"] } };
            const preservationHost = document.createElement("div");
            preservationHost.innerHTML = buildFriendlyStateEditor(preservedStory, ["chat_story_template"]);
            devAssert(JSON.stringify(coerceStateEditorValue(["chat_story_template"], "json", preservationHost.querySelector("input"))) === JSON.stringify(preservedStory),
                "existing attached story data remains intact behind the unavailable Story button");

            const scaleFields = [...$("manualCharacterCreateEditor").querySelectorAll("[data-scale-mode-mounted]")];
            devAssert(
                scaleFields.some(field => JSON.parse(decodeURIComponent(field.dataset.statePath)).at(-1) === "boldness") &&
                    scaleFields.some(field => bodyStatKeys().includes(JSON.parse(decodeURIComponent(field.dataset.statePath)).at(-1))),
                "manual editor exposes both boldness and appearance scale fields",
            );
            for (const field of scaleFields) {
                const path = JSON.parse(decodeURIComponent(field.dataset.statePath));
                const previousValue = field.value;
                const mode = field.previousElementSibling;
                const previousMode = mode.value;
                for (const details of $("manualCharacterCreateEditor").querySelectorAll("details")) {
                    details.open = true;
                }

                mode.value = "custom";
                mode.dispatchEvent(new Event("change", { bubbles: true }));
                const shortHeight = field.getBoundingClientRect().height;
                field.value = "A detailed synthetic appearance description with enough words to wrap onto several lines. ".repeat(12);
                field.dispatchEvent(new Event("input", { bubbles: true }));
                await new Promise(resolve => requestAnimationFrame(resolve));
                devAssert(
                    field.tagName === "TEXTAREA" && field.classList.contains("state-textarea") &&
                        field.getBoundingClientRect().height > shortHeight &&
                        field.clientHeight >= field.scrollHeight - 2,
                    "scale descriptions expand using the shared text editor behavior",
                    { path },
                );
                mode.value = "scale";
                mode.dispatchEvent(new Event("change", { bubbles: true }));
                const numericValue = field.value;
                field.focus();
                const wheel = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
                field.dispatchEvent(wheel);
                devAssert(
                    field.tagName === "TEXTAREA" && field.inputMode === "numeric" &&
                        field.dataset.stateKind === "number" && field.value === numericValue &&
                        !wheel.defaultPrevented &&
                        coerceStateEditorValue(path, "number", field) === Number(numericValue),
                    "numeric scale fields preserve numeric values without wheel stepping or preventing page scroll",
                    { path },
                );
                mode.value = previousMode;
                mode.dispatchEvent(new Event("change", { bubbles: true }));
                field.value = previousValue;
                field.dispatchEvent(new Event("input", { bubbles: true }));
            }

            for (const outfit of [...app.manualCharacterDraft.outfits, ...app.manualCharacterDraft.fallback_outfits])
                outfit.name = "Smoke Outfit";
            for (const field of $("manualCharacterCreateEditor").querySelectorAll("[data-state-path]")) {
                const path = JSON.parse(decodeURIComponent(field.dataset.statePath));
                if (path.at(-1) === "name" && path.some(key => key === "outfits" || key === "fallback_outfits"))
                    field.value = "Smoke Outfit";
            }
            {
                const manualSmokeName = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", "name"]);
                if (!manualSmokeName.value) manualSmokeName.value = "New Ally";
                for (const [path, value] of [
                    [["age"], "30"], [["gender"], "female"],
                    [["role"], "Smoke companion"], [["personality_description"], "A patient synthetic test companion."],
                    [["appearance", "species"], "human"],
                ]) {
                    const field = devFieldByPath("#manualCharacterCreateEditor", ["character_definition", ...path]);
                    field.value = value;
                }
            }
            await saveManualCharacterCreateModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const character = app.state.characters["New Ally"];
            devAssert(
                !!character &&
                    /Edit New Ally/i.test($("modalBox")?.textContent || ""),
                "manual character save creates a current-game party character and opens edit mode",
                character,
            );
            devAssert(
                /Generate Default Image/i.test($("modalBox")?.textContent || ""),
                "manual character edit modal exposes Generate Default Image",
            );

            const oldImageCount = profileImagesForEntity(character).length;
            const fakeImage = rememberProfileImage("New Ally", {
                source: "manual smoke",
                model: "smoke",
                seed: 12345,
                prompt: "Manual smoke character portrait.",
                negativePrompt: "",
                html:
                    '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Manual smoke profile image">',
                profile: true,
            });
            devAssert(!!fakeImage, "fake profile image record is stored before default promotion");
            const promoted = setGeneratedProfileImageAsDefault(
                "New Ally",
                fakeImage,
                { source: "manual smoke" },
            );
            const nextCharacter = app.state.characters["New Ally"];
            devAssert(
                promoted &&
                    nextCharacter.default_profile_image?.local_image_id === fakeImage.id &&
                    !/^data:image\/png/i.test(
                        String(nextCharacter.default_profile_image?.url || ""),
                    ),
                "generated profile image can be saved as the character default image",
                nextCharacter.default_profile_image,
            );
            devAssert(
                profileImagesForEntity(nextCharacter).length >= oldImageCount + 1,
                "saving a generated default image preserves profile image history",
                profileImagesForEntity(nextCharacter),
            );

            closeModal();
            addMessage("system", "Manual character editor smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: manual-character-editor-smoke");
        }

        async function devRunPromptGuidanceDevtoolsSmokeTest() {
            devTestLog("Scenario start: prompt-guidance-devtools-smoke");
            devResetForLiveTest("prompt-guidance-devtools-smoke");
            devCreateTestProfile({  });
            // SANITIZE KEEP (dev fixture): synthetic prompt/devtools state setup.
            // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Prompt Guidance Smoke",
                    },
                    story_guidance: "Initial smoke guidance.",
                    genres: ["anime", "sci-fi", "romance"],
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Prompt Tester",
                    age: 24,
                    gender: "non-male",
                    role: "prompt auditor",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Prompt test room.",
                    party_members_present: ["Player"],
                    image_characters: ["Player"],
                    npcs_present: [],
                },
                objectives: {
                    active_id: "prompt-objective",
                    focus_id: "",
                    items: [
                        {
                            id: "prompt-objective",
                            title: "Inspect Prompt Context",
                            type: "story",
                            status: "active",
                            summary: "Verify prompt surfaces.",
                            completion_control: "player",
                            completion_criteria:
                                "Confirm selected objective appears in prompt.",
                            completion_instruction:
                                "Show that prompt objective context is available without leaking future objectives.",
                            notes: [],
                            rewards: [],
                        },
                        {
                            id: "future-hidden-objective",
                            title: "Hidden Future Objective",
                            type: "story",
                            status: "hidden",
                            summary: "Should not be selected.",
                            completion_control: "player",
                            completion_criteria: "Do not push this yet.",
                            completion_instruction: "This hidden objective must not leak.",
                            notes: [],
                            rewards: [],
                        },
                    ],
                },
            });
            app.devTrace = [];
            app.devTraceNextId = 1;
            appendDevTraceEntry({
                type: "smoke",
                label: "seeded dev trace",
                prompt: "Line one\nLine two",
                detail: "{\"nested\":\"Alpha\\nBeta\"}",
            });
            await flushDevTraceArchive();
            const seededArchiveStats = await devTraceArchiveStats();
            devAssert(
                seededArchiveStats.entryCount >= 1,
                "seeded Dev Log entry is persisted in the worker archive",
                seededArchiveStats,
            );
            app.messages = [
                {
                    id: nextEntryId(),
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Prompt guidance and devtools smoke test ready.",
                    at: new Date().toISOString(),
                },
            ];
            scheduleActiveGameSave();
            render();
            app.settings.devMode = false;
            applyReducedUiClass();
            const devOnlyHidden = [...document.querySelectorAll(".dev-only-tool")].every(
                (element) =>
                    element.hidden === true ||
                    getComputedStyle(element).display === "none",
            );
            devAssert(
                devOnlyHidden &&
                    !!$("settingsBtn") &&
                    getComputedStyle($("settingsBtn")).display !== "none",
                "dev-only tools are hidden when Dev mode is off while Settings stays visible",
                {
                    devOnly: [...document.querySelectorAll(".dev-only-tool")].map(
                        (element) => ({
                            text: element.textContent,
                            hidden: element.hidden,
                            display: getComputedStyle(element).display,
                        }),
                    ),
                    settingsDisplay: $("settingsBtn")
                        ? getComputedStyle($("settingsBtn")).display
                        : "missing",
                },
            );
            app.settings.devMode = true;
            applyReducedUiClass();
            devAssert(
                [...document.querySelectorAll(".dev-only-tool")].some(
                    (element) => /State/i.test(element.textContent || "") &&
                        getComputedStyle(element).display !== "none",
                ),
                "dev-only tools become available when Dev mode is on",
                [...document.querySelectorAll(".dev-only-tool")].map((element) => ({
                    text: element.textContent,
                    display: getComputedStyle(element).display,
                })),
            );

            openGuideModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                /Story Guidance/i.test($("modalBox")?.textContent || "") &&
                    !!$("storyGuidance"),
                "Guidance modal opens",
            );
            $("storyGuidance").value =
                "Use this guidance from smoke: keep objectives precise.";
            $("storyGuidance").dispatchEvent(new Event("blur", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 150));
            devAssert(
                app.state.meta.story_guidance ===
                    "Use this guidance from smoke: keep objectives precise.",
                "Guidance modal autosaves story guidance",
                app.state.meta,
            );

            openPromptModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const promptText = $("modalBox")?.querySelector("textarea")?.value || "";
            devAssert(
                /Prompt Inspector/i.test($("modalBox")?.textContent || "") &&
                    promptText.includes("Use this guidance from smoke"),
                "Prompt inspector opens with guidance and keeps selected objective context out until an objective directive is present",
                { promptStart: promptText.slice(0, 1200) },
            );
            devAssert(
                !promptText.includes("Hidden Future Objective"),
                "Prompt inspector does not expose hidden future objective title",
            );
            {
                const previousReplyMode = app.currentReplyMode;
                const previousAutoModeType = app.settings.autoModeType;
                app.currentReplyMode = "normal";
                app.settings.autoModeType = "off";
                const playerControlledObjectiveText =
                    activeObjectiveTextForNarratorPrompt(app.state);
                app.currentReplyMode = "auto";
                app.settings.autoModeType = "player_as_npc";
                const narratorObjectiveText = activeObjectiveTextForNarratorPrompt(
                    app.state,
                );
                app.currentReplyMode = previousReplyMode;
                app.settings.autoModeType = previousAutoModeType;
                const verifierObjective = objectiveForCompletionPrompt(
                    app.state.objectives.items[0],
                );
                devAssert(
                    narratorObjectiveText.includes("Inspect Prompt Context") &&
                        narratorObjectiveText.includes("Verify prompt surfaces.") &&
                        narratorObjectiveText.includes(
                            "Completion criteria: Confirm selected objective appears in prompt.",
                        ) &&
                        playerControlledObjectiveText.includes(
                            "Inspect Prompt Context",
                        ) &&
                        playerControlledObjectiveText.includes(
                            "Verify prompt surfaces.",
                        ) &&
                        playerControlledObjectiveText.includes(
                            "Completion criteria: Confirm selected objective appears in prompt.",
                        ) &&
                        playerControlledObjectiveText.includes(
                            "This objective is player-controlled.",
                        ) &&
                        !narratorObjectiveText.includes(
                            "Show that prompt objective context is available without leaking future objectives.",
                        ) &&
                        !playerControlledObjectiveText.includes(
                            "Show that prompt objective context is available without leaking future objectives.",
                        ) &&
                        verifierObjective.description === "Verify prompt surfaces." &&
                        verifierObjective.completion_condition ===
                            "Confirm selected objective appears in prompt." &&
                        !Object.prototype.hasOwnProperty.call(
                            verifierObjective,
                            "completion_instruction",
                    ),
                    "narrator and verifier objective context expose only title, description, and completion condition",
                    {
                        narratorObjectiveText,
                        playerControlledObjectiveText,
                        verifierObjective,
                    },
                );
            }
            devAssert(
                promptText.includes("Your job is to keep the player engaged and entertained.") &&
                    promptText.includes("Make the messages flow well between messages.") &&
                    promptText.includes("In conversation mode, focus on dialogue, not descriptions. Responses should be very brief.") &&
                    promptText.includes("Avoid exposition and info dumps.") &&
                    promptText.includes("Characters should speak from their current emotion, goal, knowledge, and situation") &&
                    promptText.includes("Avoid empty choice-commentary dialogue.") &&
                    promptText.includes("Do not invent a new external crisis, patrol, drone, attack, interruption, alarm, or threat every reply.") &&
                    promptText.includes("Do not use formulaic recap structures like") &&
                    promptText.includes("Do not overuse ticking-clock wording") &&
                    promptText.includes("Default to 250-650 characters for ordinary replies") &&
                    promptText.includes("Do not use slash speaker labels"),
                "narrator prompt includes current engagement, flow, conversation-mode, and anti-formula guidance",
                { promptStart: promptText.slice(0, 1800) },
            );
            devAssert(
                normalizeAiTextOutput('"No no NO\u2014" She lunges. Freeze\u2014do not move.') ===
                    '"No no NO\u2E3A" She lunges. Freeze\u2E3Ado not move.',
                "AI text output displays em dashes with a visually distinct long dash",
            );
            devAssert(
                promptText.includes(
                    "multi-character, state-based anime sci-fi romance RPG text game",
                ) && !promptText.includes("state-based fantasy RPG text game"),
                "narrator prompt uses current story genres instead of hardcoded fantasy",
                { promptStart: promptText.slice(0, 500) },
            );
            devAssert(
                !/Mira Venn|Unknown Woman|Bandit Leader|Bandit 1|Guard 1|Villager 3|Attacker 2/i.test(
                    promptText,
                ) &&
                    /Do not use unknown placeholders, numbered placeholders, role labels, generic descriptors/i.test(
                        promptText,
                    ),
                "narrator prompt avoids concrete placeholder examples that can bias arbitrary stories",
                { promptStart: promptText.slice(0, 2400) },
            );
            {
                const autoPlayerPrompt = buildAutoPlayerTurnInstruction();
                devAssert(
                    !/hay dust|barn|Bad:|Good:/i.test(autoPlayerPrompt) &&
                        /plain player intent, not narrator-style sensory prose/i.test(
                            autoPlayerPrompt,
                        ) &&
                        /Every quoted line you write must be spoken by Prompt Tester/i.test(
                            autoPlayerPrompt,
                        ) &&
                        /small reversible action instead of solving the whole problem at once/i.test(
                            autoPlayerPrompt,
                        ),
                    "auto-player prompt avoids story-specific examples and keeps ownership on the player",
                    { promptStart: autoPlayerPrompt.slice(0, 1400) },
                );
                const autoPlayerFinalPrompt = buildAutoPlayerTurnPrompt();
                devAssert(
                    autoPlayerFinalPrompt.includes("EMBERADVENTURES STORY GUIDANCE") &&
                        autoPlayerFinalPrompt.includes(
                            "Use this guidance from smoke: keep objectives precise.",
                        ) &&
                        autoPlayerFinalPrompt.includes(
                            "You are playing EmberAdventures for the player in automatic mode.",
                        ) &&
                        (autoPlayerFinalPrompt.match(/EMBERADVENTURES STORY GUIDANCE \(/g) || [])
                            .length === 1,
                    "auto-player final prompt includes universal context exactly once",
                    { promptStart: autoPlayerFinalPrompt.slice(0, 1600) },
                );
            }
            {
                const runtimePromptState = stateForAiPrompt(app.state);
                devAssert(
                    !("progression" in runtimePromptState),
                    "AI prompt state hides shelved XP/progression internals",
                    runtimePromptState,
                );
                hydrateUserProfileRuntime(devSmokeTestProfile("second"), {includeSettings:true});
                const originalInstruction =
                    "Create a full adult character definition for this non-party NPC.\n\nAnswer:";
                const universalPrompt =
                    withUniversalAiPromptContext(originalInstruction);

            }

            openDevTraceModal();
            await new Promise((resolve) => setTimeout(resolve, 150));
            const devTracePopup = document.querySelector(
                '.popup-modal[data-dev-trace-popup="1"]',
            );
            const devTraceRoot = devTracePopup || $("modalBox");
            const devTraceText = devTraceRoot?.querySelector?.("#devTraceText")?.value || "";
            devAssert(
                /Dev Log/i.test(devTraceRoot?.textContent || "") &&
                    devTraceText.includes("seeded dev trace"),
                "Dev trace modal opens with trace text",
            );
            devAssert(
                devTraceText.includes("Line one\n  Line two") &&
                    devTraceText.includes("nested:\n    Alpha\n    Beta") &&
                    !devTraceText.includes("Alpha\\nBeta"),
                "Dev trace modal renders prompts and JSON-string details as readable text with real newlines",
                { devTraceText },
            );
            $("clearDevTraceBtn")?.click();
            await devWaitFor(
                () => Array.isArray(app.devTrace) && app.devTrace.length === 0,
                3000,
                "Dev Log archive clear",
            );
            const postClearTrace = Array.isArray(app.devTrace) ? app.devTrace : [];
            const postClearTraceText = formatDevTraceText(postClearTrace);
            const postClearArchiveStats = await devTraceArchiveStats();
            devAssert(
                !postClearTraceText.includes("seeded dev trace") &&
                    !postClearTraceText.includes("Line one") &&
                    !postClearTraceText.includes("Alpha") &&
                    postClearArchiveStats.entryCount === 0 &&
                    postClearArchiveStats.chunkCount === 0,
                "Dev trace clear button removes recent entries and the complete worker archive",
                { postClearTrace, postClearArchiveStats },
            );

            closeModal();
            addMessage("system", "Prompt guidance and devtools smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: prompt-guidance-devtools-smoke");
        }

        async function devRunTurnSourceParitySmokeTest() {
            devTestLog("Scenario start: turn-source-parity-smoke");
            devResetForLiveTest("turn-source-parity-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: player-facing action sources are real player
            // turns. They must pass through the same objective verifier and
            // narrator reply path as typed chat, with only their directive/text
            // differing by source.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Turn Source Parity Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Turn Tester",
                    age: 24,
                    gender: "male",
                    role: "turn-source auditor",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Turn source smoke room.",
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
                objectives: {
                    active_id: "turn-source-objective",
                    focus_id: "turn-source-objective",
                    items: [
                        {
                            id: "turn-source-objective",
                            title: "Check Turn Source",
                            type: "story",
                            status: "active",
                            summary: "Exercise every player-facing turn source.",
                            completion_control: "player",
                            completion_criteria:
                                "Only complete if the smoke explicitly says the objective is done.",
                            rewards: [],
                            requires: [],
                        },
                    ],
                },
            });
            app.messages = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            app.settings.stateCheckMode = "groups";
            await devCompileCurrentStoryFixture("turn-source-parity-smoke");
            scheduleActiveGameSave();
            render();

            const originalAiText = aiText;
            const aiCalls = [];
            try {
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    aiCalls.push({ label, instruction: String(instruction || "") });
                    if (/objective check/i.test(label)) return "no";
                    if (/character reply/i.test(label))
                        return "The smoke narrator gives a short response.";
                    return "{}";
                };

            const sources = ["user", "invite", "auto_player", "d20", "find"];
                for (const source of sources) {
                    const beforeCount = app.messages.length;
                    app.queue.push({
                        source,
                        text: `${source} internal directive text`,
                        visibleText: `${source} visible player text`,
                        speaker: app.state.player.name,
                        autoTurn: source === "auto_player",
                        autoRead: false,
                    });
                    await processQueue();
                    const newMessages = app.messages.slice(beforeCount);
                    const userMessage = newMessages.find((message) => message.role === "user");
                    const assistantMessage = newMessages.find(
                        (message) => message.role === "assistant",
                    );
                    devAssert(
                        userMessage?.text === `${source} visible player text` &&
                            assistantMessage?.replySource === source,
                        `${source} source creates a visible player message and matching assistant reply`,
                        { source, newMessages },
                    );
                    devAssert(
                        source !== "auto_player" || userMessage?.autoTurn === true,
                        "auto_player source preserves the auto-turn marker on the user message",
                        { source, userMessage },
                    );
                    for (const message of app.messages) {
                        if (isStoryMessageRole(message.role)) {
                            message.stateSyncStatus = "synced";

                        }
                    }
                    app.stateSync.queued = false;
                    await new Promise((resolve) => setTimeout(resolve, 20));
                }

                const objectiveCalls = aiCalls.filter((call) =>
                    /objective check/i.test(call.label),
                );
                const replyCalls = aiCalls.filter((call) =>
                    /character reply/i.test(call.label),
                );
                devAssert(
                    objectiveCalls.length === sources.length &&
                        replyCalls.length === sources.length,
                    "every player-facing turn source runs objective verification before a narrator reply",
                    { objectiveCalls: objectiveCalls.map((call) => call.label), replyCalls },
                );
                devAssert(
                    objectiveCalls.every((call) =>
                        /Exercise every player-facing turn source/.test(call.instruction),
                    ),
                    "turn-source objective checks include the selected objective summary",
                    objectiveCalls.map((call) => call.instruction.slice(0, 900)),
                );
                devAssert(
                    !queueItemCreatesPlayerStoryMessage({
                        source: "position",
                        text: "Position smoke",
                        visibleText: "Position smoke",
                    }),
                    "scene-tool selections are excluded from player-story turn parity",
                );
            } finally {
                aiText = originalAiText;
                for (const message of app.messages) {
                    if (isStoryMessageRole(message.role)) {
                        message.stateSyncStatus = "synced";

                    }
                }
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "Turn source parity smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: turn-source-parity-smoke");
        }

        async function devRunContinueObjectiveControlSmokeTest() {
            devTestLog("Scenario start: continue-objective-control-smoke");
            devResetForLiveTest("continue-objective-control-smoke");
            devCreateTestProfile({  });
            const seedObjectiveState = async (completionControl) => {
                // Smoke invariant: Continue is not a player action. It can only
                // ask whether an AI-controlled plot point should resolve now;
                // player-controlled objectives stay untouched until a real player
                // action source is queued.
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Continue Objective Smoke",
                        },
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        name: "Continue Tester",
                        age: 24,
                        gender: "male",
                        role: "continue auditor",
                    },
                    scene: {
                        ...clone(defaultState.scene || {}),
                        summary: "Continue objective smoke room.",
                        party_members_present: [],
                        npcs_present: [],
                        image_characters: ["Player"],
                    },
                    objectives: {
                        active_id: `${completionControl}-continue-objective`,
                        focus_id: `${completionControl}-continue-objective`,
                        items: [
                            {
                                id: `${completionControl}-continue-objective`,
                                title:
                                    completionControl === "ai"
                                        ? "Resolve Plot Point"
                                        : "Take Player Action",
                                type: "story",
                                status: "active",
                                summary:
                                    completionControl === "ai"
                                        ? "Let the narrator resolve the immediate danger."
                                        : "Make the player take a concrete action.",
                                completion_control: completionControl,
                                completion_criteria:
                                    completionControl === "ai"
                                        ? "The next narrator response should resolve the immediate danger."
                                        : "The player must take a concrete action.",
                                next_objectives: [
                                    {
                                        id: `${completionControl}-continue-output`,
                                        objective_id: `${completionControl}-continue-followup`,
                                        target_input_group_id: `${completionControl}-continue-followup-input`,
                                        completion_instruction:
                                            completionControl === "ai"
                                                ? "Resolve Plot Point by resolving the immediate danger."
                                                : "Continue after the player's action.",
                                        requirements: [],
                                        rewards: [],
                                    },
                                ],
                                rewards: [],
                            },
                            {
                                id: `${completionControl}-continue-followup`,
                                title: "Continue Follow-Up",
                                type: "story",
                                status: "hidden",
                                summary: "Continue after the tested objective.",
                                while_active_guidance: "Continue the smoke-test scene.",
                                completion_control: "player",
                                completion_criteria: "The player continues after the tested objective.",
                                next_objectives: [{
                                    id: "continue-objective-ending",
                                    completion_instruction: "Conclude the Continue route.",
                                    rewards: [],
                                    ending_type: "freeplay",
                                    ending_message: "The Continue objective smoke route is complete.",
                                }],
                                rewards: [],
                            },
                        ],
                    },
                });
                app.messages = [];
                app.queue = [];
                app.settings.autoVoice = false;
                app.settings.autoImages = false;
                app.settings.stateCheckMode = "groups";
                await devCompileCurrentStoryFixture(
                    `continue-objective-control-${completionControl}-smoke`,
                );
                scheduleActiveGameSave();
                render();
            };

            const originalAiText = aiText;
            try {
                const playerCalls = [];
                await seedObjectiveState("player");
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    playerCalls.push({ label, instruction: String(instruction || "") });
                    if (/objective check/i.test(label))
                        throw new Error("Player-controlled Continue should not run objective verifier.");
                    if (/character reply/i.test(label))
                        return "The narrator waits for the player's real action.";
                    return "{}";
                };
                continueScene();
                await new Promise((resolve) => setTimeout(resolve, 100));
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    !objectiveIsComplete(currentObjectiveTarget(app.state)) &&
                        app.messages.some((message) => message.role === "assistant") &&
                        !app.messages.some((message) => message.role === "game"),
                    "Continue does not complete player-controlled objectives or add a completion Game message",
                    {
                        objective: currentObjectiveTarget(app.state),
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                        playerCalls: playerCalls.map((call) => call.label),
                    },
                );

                const aiCalls = [];
                await seedObjectiveState("ai");
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    aiCalls.push({ label, instruction: String(instruction || "") });
                    if (/objective check/i.test(label)) return "yes";
                    if (/character reply/i.test(label)) {
                        devAssert(
                            /Resolve Plot Point/i.test(instruction) &&
                                /immediate danger/i.test(instruction),
                            "AI-controlled Continue passes the pre-checked completion instruction into the narrator prompt",
                            instruction.slice(0, 1600),
                        );
                        return "The narrator resolves the immediate danger.";
                    }
                    return "{}";
                };
                continueScene();
                await new Promise((resolve) => setTimeout(resolve, 100));
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                const assistantIndex = app.messages.findIndex(
                    (message) => message.role === "assistant",
                );
                const gameIndex = app.messages.findIndex(
                    (message) => message.role === "game",
                );
                devAssert(
                    objectiveIsComplete(
                        (app.state.objectives?.items || []).find(
                            (item) => item.id === "ai-continue-objective",
                        ),
                    ) &&
                        assistantIndex >= 0 &&
                        gameIndex > assistantIndex &&
                        aiCalls.some((call) => /objective check/i.test(call.label)),
                    "Continue can complete AI-controlled plot points and shows the Game notice after the narrator response",
                    {
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                        aiCalls: aiCalls.map((call) => call.label),
                    },
                );
            } finally {
                aiText = originalAiText;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "Continue objective control smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: continue-objective-control-smoke");
        }

        async function devRunObjectiveCompletionTimingSmokeTest() {
            devTestLog("Scenario start: objective-completion-timing-smoke");
            devResetForLiveTest("objective-completion-timing-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: objective rewards/state are applied before the
            // narrator prompt so the reply can use unlocked state, but the visible
            // Game completion notice appears only after that narrator reply.
            const seed = async () => {
                const futureFull = blankCharacterTemplate("Tarin Voss");
                futureFull.name = "Tarin Voss";
                futureFull.age = 30;
                futureFull.gender = "female";
                futureFull.role = "timing witness";
                app.state = repairAiGeneratedState({
                    ...clone(defaultState),
                    meta: {
                        ...clone(defaultState.meta || {}),
                        setup_complete: true,
                        story_source: {
                            mode: "original",
                            title: "Objective Timing Smoke",
                        },
                    },
                    player: {
                        ...clone(defaultState.player || {}),
                        name: "Timing Tester",
                        age: 25,
                        gender: "male",
                    },
                    location: {
                        ...clone(defaultState.location || {}),
                        npc_location_id: "timing-square",
                        specific_place: "Timing Square",
                    },
                    npc_directory: {
                        locations: {
                            "timing-square": {
                                label: "Timing Square",
                                characters: {},
                            },
                        },
                    },
                    future_cast: {
                        enabled: true,
                        items: {
                            "timing-npc": {
                                id: "timing-npc",
                                name: "Tarin Voss",
                                age: 30,
                                gender: "female",
                                role: "timing witness",
                                full_character: futureFull,
                                status: "future",
                                location_hint: "timing square",
                            },
                        },
                    },
                    objectives: {
                        active_id: "timing-objective",
                        focus_id: "timing-objective",
                        items: [
                            {
                                id: "timing-objective",
                                title: "Reach the Timing Square",
                                type: "story",
                                status: "active",
                                summary: "Reach the timing square.",
                                completion_control: "player",
                                completion_criteria:
                                    "The player reaches the timing square.",
                                next_objectives: [
                                    {
                                        id: "timing-objective-output",
                                        objective_id: "report-to-the-captain",
                                        target_input_group_id: "report-to-the-captain-input",
                                        completion_instruction:
                                            "Introduce Tarin Voss as the witness to the arrival.",
                                        requirements: [],
                                        rewards: [],
                                    },
                                ],
                                rewards: [
                                    {
                                        type: "introduce_future_character",
                                        character_id: "timing-npc",
                                        npc_location_id: "timing-square",
                                        scene_presence: "nearby",
                                    },
                                ],
                            },
                            {
                                id: "report-to-the-captain",
                                title: "Report to the Captain",
                                type: "story",
                                status: "hidden",
                                summary: "Tell the captain what happened in the timing square.",
                                completion_control: "player",
                                completion_criteria:
                                    "The player reports the timing-square events to the captain.",
                                next_objectives: [{
                                    id: "report-to-the-captain-ending",
                                    completion_instruction: "Conclude the timing smoke route.",
                                    rewards: [],
                                    ending_type: "freeplay",
                                    ending_message: "The objective timing smoke route is complete.",
                                }],
                                rewards: [],
                            },
                        ],
                    },
                });
                app.messages = [];
                app.queue = [];
                app.settings.autoVoice = false;
                app.settings.autoImages = false;
                await devCompileCurrentStoryFixture("objective-completion-timing-smoke");
                scheduleActiveGameSave();
                render();
            };

            const originalAiText = aiText;
            try {
                const calls = [];
                const narratorReplyPrompts = [];
                await seed();
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    calls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/objective check/i.test(label)) {

                    }
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label))
                        return /Reach the Timing Square/i.test(finalPrompt)
                            ? '{"s":"c"}'
                            : '{"s":"n"}';
                    if (/character reply/i.test(label)) {
                        narratorReplyPrompts.push(finalPrompt);
                        return "Tarin Voss steps forward as the square comes into view.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I reach the timing square.",
                    visibleText: "I reach the timing square.",
                    source: "user",
                    speaker: "Timing Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 20));
                }
                const narratorReplyPrompt = narratorReplyPrompts[0] || "";
                devAssert(
                    /Tarin Voss/.test(narratorReplyPrompt) &&
                        /Introduce Tarin Voss/.test(narratorReplyPrompt) &&
                        /These previous objective\(s\) were completed by the player's response/i.test(
                            narratorReplyPrompt,
                        ) &&
                        /ACTIVE OBJECTIVE:/i.test(narratorReplyPrompt) &&
                        /Report to the Captain: Tell the captain what happened in the timing square\./i.test(
                            narratorReplyPrompt,
                        ) &&
                        /Completion criteria: The player reports the timing-square events to the captain\./i.test(
                            narratorReplyPrompt,
                        ) &&
                        /This objective is player-controlled\. Do not write it as completed unless a TURN DIRECTIVE/i.test(
                            narratorReplyPrompt,
                        ),
                    "completed objective directive and the next player-controlled objective's three safe guidance fields are present",
                    narratorReplyPrompt.slice(0, 2200),
                );
                const userIndex = app.messages.findIndex(
                    (message) => message.role === "user",
                );
                const assistantIndex = app.messages.findIndex(
                    (message) => message.role === "assistant",
                );
                const gameIndex = app.messages.findIndex(
                    (message) => message.role === "game",
                );
                devAssert(
                    objectiveIsComplete(app.state.objectives.items[0]) &&
                        getNpcEntry("Tarin Voss", "timing square") &&
                        userIndex >= 0 &&
                        assistantIndex > userIndex &&
                        gameIndex > assistantIndex &&
                        /Objective complete: Reach the Timing Square/.test(
                            app.messages[gameIndex]?.text || "",
                        ) &&
                        /New NPC: Tarin Voss/.test(app.messages[gameIndex]?.text || "") &&
                        !/Story rule|state field|reward|introduced at/i.test(
                            app.messages[gameIndex]?.text || "",
                        ),
                    "objective completion notice is deferred until after the narrator response while state/rewards apply first",
                    {
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            speaker: message.speaker,
                            text: message.text,
                        })),
                        objective: app.state.objectives.items[0],
                        npc: getNpcEntry("Tarin Voss", "timing square"),
                        calls: calls.map((call) => call.label),
                    },
                );
                const hiddenRewardNotice = objectiveCompletionGameMessage(
                    { id: "hidden-reward-smoke", title: "Hide Internal Rewards" },
                    {
                        rewardMessages: [
                            "Story rule added. (Hide Internal Rewards)",
                            "Story state field set: player.appearance.chest. (Hide Internal Rewards)",
                            "Lena Rowe was introduced at Smoke Town. (Hide Internal Rewards)",
                            "Mira Voss joined the party. (Hide Internal Rewards)",
                        ],
                    },
                );
                devAssert(
                    hiddenRewardNotice ===
                        "Objective complete: Hide Internal Rewards. New character: Mira Voss. New NPC: Lena Rowe.",
                    "objective completion notices hide internal reward mechanics and show only new visible people",
                    hiddenRewardNotice,
                );

                const seedChain = () => {
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Objective Chain Smoke",
                            },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "Chain Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "Objective chain smoke room.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "chain-player-one",
                            focus_id: "chain-player-one",
                            items: [
                                {
                                    id: "chain-player-one",
                                    title: "Open the First Door",
                                    type: "story",
                                    status: "active",
                                    summary: "Open the first door.",
                                    completion_control: "player",
                                    completion_criteria: "The player opens the first door.",
                                    next_objectives: [
                                        {
                                            id: "chain-player-one-output",
                                            objective_id: "chain-player-two",
                                            target_input_group_id: "chain-player-two-input",
                                            completion_instruction: "Open the first door.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "chain-player-two",
                                    title: "Take the Hall Key",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Take the hall key.",
                                    completion_control: "player",
                                    completion_criteria: "The player takes the hall key.",
                                    next_objectives: [
                                        {
                                            id: "chain-player-two-output",
                                            objective_id: "chain-ai-three",
                                            target_input_group_id: "chain-ai-three-input",
                                            completion_instruction: "Take the hall key.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "chain-ai-three",
                                    title: "Ambush in the Hall",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Let the hall ambush happen.",
                                    completion_control: "ai",
                                    completion_criteria:
                                        "The next narrator response should spring the hall ambush.",
                                    next_objectives: [{
                                        id: "objective-chain-ending",
                                        completion_instruction: "Conclude the objective chain.",
                                        rewards: [],
                                        ending_type: "freeplay",
                                        ending_message: "The objective chain smoke route is complete.",
                                    }],
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                    scheduleActiveGameSave();
                    render();
                };
                const chainCalls = [];
                seedChain();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-chain-smoke",
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    chainCalls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/objective check/i.test(label)) {

                    }
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label)) return '{"s":"c"}';
                    if (/character reply/i.test(label)) {
                        devAssert(
                            /These previous objective\(s\) were completed by the player's response:/i.test(
                                finalPrompt,
                            ) &&
                                /- Open the First Door/i.test(finalPrompt) &&
                                !/- Take the Hall Key/i.test(finalPrompt) &&
                                !/story is ready.*Ambush in the Hall/is.test(
                                    finalPrompt,
                                ) &&
                                !/push only toward this selected objective: "Take the Hall Key"/i.test(
                                    finalPrompt,
                                ) &&
                                !/This is player-controlled/i.test(
                                    finalPrompt,
                                ),
                            "one player message completes only the selected player objective without exposing the next player-controlled objective to the narrator prompt",
                            finalPrompt.slice(0, 2600),
                        );
                        return "The hall key clicks free just as shadows move in the corridor.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I open the first door and take the hall key.",
                    visibleText: "I open the first door and take the hall key.",
                    source: "user",
                    speaker: "Chain Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    objectiveIsComplete(app.state.objectives.items[0]) &&
                        !objectiveIsComplete(app.state.objectives.items[1]) &&
                        !objectiveIsComplete(app.state.objectives.items[2]) &&
                        app.state.objectives.active_id === "chain-player-two" &&
                        app.messages.filter((message) => message.role === "game").length === 1 &&
                        chainCalls.filter((call) => /objective check/i.test(call.label)).length === 1,
                    "selected player-objective check does not sprint through newly unlocked objectives from one message",
                    {
                        objectives: app.state.objectives.items.map((objective) => ({
                            id: objective.id,
                            status: objective.status,
                        })),
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                        calls: chainCalls.map((call) => call.label),
                    },
                );

                const seedActivationAiRoute = (evaluateOnActivation) => {
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: { mode: "original", title: "Activation AI Route Smoke" },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "Activation Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "A private conversation has just ended.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "activation-player",
                            focus_id: "activation-player",
                            items: [
                                {
                                    id: "activation-player",
                                    title: "Leave the Conversation",
                                    type: "story",
                                    status: "active",
                                    summary: "End the conversation when you are ready.",
                                    completion_control: "player",
                                    completion_criteria: "The player clearly leaves the conversation.",
                                    next_objectives: [
                                        {
                                            id: "activation-player-output",
                                            objective_id: "activation-ai",
                                            target_input_group_id: "activation-ai-input",
                                            completion_instruction: "End the conversation.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "activation-ai",
                                    title: "Record the First Impression",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Privately assess the completed conversation.",
                                    completion_control: "ai",
                                    evaluate_ai_on_activation: evaluateOnActivation,
                                    route_control: "ai",
                                    completion_criteria: "Complete immediately when the conversation already provides enough evidence to assess the first impression.",
                                    outcome_routes: [
                                        {
                                            id: "respectful",
                                            criteria: "The player was respectful.",
                                            requirements: [],
                                            rewards: [],
                                            next_objective_id: "activation-final",
                                            target_input_group_id: "activation-final-respectful-input",
                                            completion_instruction: "Continue from the respectful first impression.",
                                        },
                                        {
                                            id: "fallback",
                                            criteria: "Use only when no other route fits.",
                                            requirements: [],
                                            fallback: true,
                                            next_objective_id: "activation-final",
                                            target_input_group_id: "activation-final-fallback-input",
                                            completion_instruction: "Continue from the fallback first impression.",
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "activation-final",
                                    title: "Continue the Story",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Continue after the private assessment.",
                                    completion_control: "player",
                                    completion_criteria: "The player continues.",
                                    next_objectives: [{
                                        id: "activation-route-ending",
                                        completion_instruction: "Conclude the activation route.",
                                        rewards: [],
                                        ending_type: "freeplay",
                                        ending_message: "The activation route smoke is complete.",
                                    }],
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [
                        {
                            id: "activation-history",
                            role: "user",
                            speaker: "Activation Tester",
                            text: "Thank you for speaking with me honestly.",
                        },
                    ];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                };
                const activationCalls = [];
                seedActivationAiRoute(true);
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-activation-route-smoke",
                );
                const activationGameMessageCountBefore = app.messages.filter(
                    (message) => message.role === "game",
                ).length;
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    activationCalls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/objective .*route/i.test(label)) return '{"o":"respectful"}';
                    if (/objective check/i.test(label)) return '{"s":"c"}';
                    return "{}";
                };
                const activationParentResult = await runObjectiveCompletionPass({
                    source: "player",
                    text: "I leave the conversation now.",
                    phase: "pre",
                    suppressGameMessage: true,
                });
                devAssert(
                        objectiveIsComplete(app.state.objectives.items[0]) &&
                        objectiveIsComplete(app.state.objectives.items[1]) &&
                        app.state.objectives.active_id === "activation-final" &&
                        app.state.objectives.items[1]?.selected_outcome_id === "respectful" &&
                        activationCalls.some(
                            (call) => /activation objective check/i.test(call.label),
                        ) &&
                        app.messages.filter((message) => message.role === "game").length ===
                            activationGameMessageCountBefore,
                    "activation-flagged AI objectives resolve their hidden route immediately without a visible completion notice",
                    { activationParentResult, activationCalls, state: clone(app.state) },
                );

                seedActivationAiRoute(false);
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-normal-ai-route-smoke",
                );
                const normalAiActivationCalls = [];
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    normalAiActivationCalls.push({ label, opts: clone(opts || {}) });
                    if (/objective check/i.test(label)) return '{"s":"c"}';
                    return "{}";
                };
                await runObjectiveCompletionPass({
                    source: "player",
                    text: "I leave the conversation now.",
                    phase: "pre",
                    suppressGameMessage: true,
                });
                devAssert(
                    objectiveIsComplete(app.state.objectives.items[0]) &&
                        !objectiveIsComplete(app.state.objectives.items[1]) &&
                        app.state.objectives.active_id === "activation-ai" &&
                        !normalAiActivationCalls.some((call) => call.opts?.source === "activation"),
                    "ordinary AI-controlled objectives remain active until a normal turn check instead of evaluating on activation",
                    { normalAiActivationCalls, state: clone(app.state) },
                );

                const seedAiPostCheck = () => {
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "AI Objective Post Check Smoke",
                            },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "AI Timing Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "A gate fight is underway.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "defeat-gate-raiders",
                            focus_id: "defeat-gate-raiders",
                            items: [
                                {
                                    id: "defeat-gate-raiders",
                                    title: "Defeat the Gate Raiders",
                                    type: "story",
                                    status: "active",
                                    summary: "End the gate fight.",
                                    completion_control: "ai",
                                    completion_criteria:
                                        "Complete only when the narrator has shown the gate raiders defeated, routed, captured, or no longer an immediate threat.",
                                    next_objectives: [
                                        {
                                            id: "defeat-gate-raiders-output",
                                            objective_id: "gate-raiders-followup",
                                            target_input_group_id: "gate-raiders-followup-input",
                                            completion_instruction:
                                                "Show the immediate aftermath of the defeated gate raiders.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "gate-raiders-followup",
                                    title: "Continue Beyond the Gate",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Continue after the gate is secure.",
                                    while_active_guidance: "Continue beyond the secured gate.",
                                    completion_control: "player",
                                    completion_criteria: "The player continues beyond the gate.",
                                    next_objectives: [{
                                        id: "gate-raider-ending",
                                        completion_instruction: "Conclude the gate-raider route.",
                                        rewards: [],
                                        ending_type: "freeplay",
                                        ending_message: "The gate-raider smoke route is complete.",
                                    }],
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                    scheduleActiveGameSave();
                    render();
                };
                const aiPostCalls = [];
                seedAiPostCheck();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-ai-post-check-smoke",
                );
                const incompleteAiDirective =
                    objectiveSteeringNarratorDirective({
                        progress: true,
                    });
                devAssert(
                    /Respond naturally to the player's action/i.test(
                        incompleteAiDirective,
                    ) &&
                        /Do not invent, prolong, renew, or replace obstacles merely to keep the objective incomplete/i.test(
                            incompleteAiDirective,
                        ) &&
                        !/Show meaningful progress/i.test(incompleteAiDirective),
                    "incomplete AI-controlled objectives forbid manufactured blockers without demanding artificial progress",
                    incompleteAiDirective,
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    aiPostCalls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/character reply/i.test(label)) {
                        const replyCount = aiPostCalls.filter((call) =>
                            /character reply/i.test(call.label),
                        ).length;
                        devAssert(
                            replyCount === 1 &&
                                /Show the immediate aftermath of the defeated gate raiders\./i.test(
                                    finalPrompt,
                                ),
                            "pre-checked AI-controlled completion gives its instruction to the single normal narrator reply",
                            finalPrompt.slice(0, 2200),
                        );
                        return "The last raider drops their blade and runs. The gate is clear. The battered guards lower their weapons as the danger finally passes.";
                    }
                    if (/objective check/i.test(label)) {
                        devAssert(
                            /story-advance verifier/i.test(finalPrompt) &&
                                /CONTINUE MESSAGE/i.test(finalPrompt) &&
                                /before the narrator reply/i.test(finalPrompt) &&
                                /authorizes the narrator to produce the objective's result in the upcoming reply/i.test(
                                    finalPrompt,
                                ) &&
                                /result does not need to have already happened in previous messages/i.test(
                                    finalPrompt,
                                ) &&
                                /only narrator-, environment-, or NPC-controlled follow-through remains/i.test(
                                    finalPrompt,
                                ),
                            "AI-controlled completion authorizes narrator-controlled follow-through before narration",
                            finalPrompt.slice(0, 1800),
                        );
                        return '{"s":"c"}';
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "Continue",
                    visibleText: "",
                    skipUserStateCheck: true,
                    source: "continue",
                    directive: continueSceneDirective("observe"),
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                        objectiveIsComplete(app.state.objectives.items[0]) &&
                        aiPostCalls.filter((call) => /character reply/i.test(call.label)).length === 1 &&
                        aiPostCalls.filter((call) => /objective check/i.test(call.label)).length === 1 &&
                        aiPostCalls.findIndex((call) => /objective check/i.test(call.label)) <
                            aiPostCalls.findIndex((call) => /character reply/i.test(call.label)) &&
                        (() => {
                            const messageRoles = app.messages.map((message) => message.role);
                            const firstAssistant = messageRoles.indexOf("assistant");
                            const completionNotice = messageRoles.indexOf("game");
                            return (
                                firstAssistant >= 0 &&
                                completionNotice > firstAssistant &&
                                messageRoles.filter((role) => role === "assistant").length === 1
                            );
                        })(),
                    "AI-controlled objective completes before one narrator reply without a follow-up message",
                    {
                        objectives: app.state.objectives.items,
                        calls: aiPostCalls.map((call) => call.label),
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );

                seedAiPostCheck();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-progress-only-smoke",
                );
                const progressOnlyCalls = [];
                aiText = async (instruction, opts = {}) => {
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    progressOnlyCalls.push(finalPrompt);
                    return '{"s":"p","n":"The raiders are losing ground."}';
                };
                const progressOnlyResult = await runObjectiveCompletionPass({
                    source: "assistant",
                    text: "The raiders fall back from the gate but keep fighting.",
                    phase: "post_progress",
                });
                devAssert(
                    progressOnlyResult?.progress &&
                        !objectiveIsComplete(app.state.objectives.items[0]) &&
                        objectiveProgressNotes(app.state, "defeat-gate-raiders").includes(
                            "The raiders are losing ground.",
                        ) &&
                        /after the narrator reply/i.test(progressOnlyCalls[0] || "") &&
                        /Never complete the objective here/i.test(progressOnlyCalls[0] || ""),
                    "post-narrator AI objective check records progress only and leaves the objective active",
                    { progressOnlyResult, progressOnlyCalls },
                );

                const seedAutoPlayerPostCheck = () => {
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Auto Player Objective Smoke",
                            },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "Auto Timing Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "Auto player stands before a narrow bridge.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "cross-the-bridge",
                            focus_id: "cross-the-bridge",
                            items: [
                                {
                                    id: "cross-the-bridge",
                                    title: "Cross the Bridge",
                                    type: "story",
                                    status: "active",
                                    summary: "Cross the bridge.",
                                    completion_control: "player",
                                    completion_criteria:
                                        "Complete only when the player crosses the bridge.",
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                    app.settings.autoModeType = "player_as_npc";
                    scheduleActiveGameSave();
                    render();
                };
                const autoPlayerCalls = [];
                seedAutoPlayerPostCheck();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-auto-player-smoke",
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    autoPlayerCalls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/character reply/i.test(label)) {
                        devAssert(
                            /Auto mode is controlling the player as a character/i.test(
                                finalPrompt,
                            ) &&
                                /Cross the Bridge/i.test(finalPrompt),
                            "auto-player-as-character replies may complete player-controlled objectives naturally",
                            finalPrompt.slice(0, 1800),
                        );
                        return "Auto Timing Tester crosses the bridge and waits on the far side.";
                    }
                    if (/objective check/i.test(label)) {
                        devAssert(
                            /player-action[\s\S]*verifier/i.test(finalPrompt) &&
                                /ASSISTANT[_ ]PLAYER[_ ]CONTROL MESSAGE/i.test(finalPrompt) &&
                                /crosses the bridge/i.test(finalPrompt),
                            "auto-player-as-character uses the player-objective verifier after the assistant reply",
                            finalPrompt.slice(0, 1800),
                        );
                        return '{"s":"c"}';
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "Auto mode turn.",
                    visibleText: "",
                    source: "auto",
                    autoTurn: true,
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    objectiveIsComplete(app.state.objectives.items[0]) &&
                        autoPlayerCalls.findIndex((call) => /character reply/i.test(call.label)) >= 0 &&
                        autoPlayerCalls.findIndex((call) => /objective check/i.test(call.label)) >
                            autoPlayerCalls.findIndex((call) => /character reply/i.test(call.label)),
                    "auto-player-as-character can complete a player-controlled objective only after the assistant reply",
                    {
                        objectives: app.state.objectives.items,
                        calls: autoPlayerCalls.map((call) => call.label),
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );
                app.settings.autoModeType = "take_player_turns";

                const seedProgressCheck = () => {
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Objective Progress Smoke",
                            },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "Progress Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "A cautious conversation is underway.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "earn-first-trust",
                            focus_id: "earn-first-trust",
                            items: [
                                {
                                    id: "earn-first-trust",
                                    title: "Earn First Trust",
                                    type: "story",
                                    status: "active",
                                    summary: "Show enough restraint for the stranger to consider trusting you.",
                                    completion_control: "player",
                                    completion_criteria:
                                        "Complete only when the player has shown clear restraint and received a first trust response.",
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                    scheduleActiveGameSave();
                    render();
                };
                const progressCalls = [];
                seedProgressCheck();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-progress-note-smoke",
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    const finalPrompt = finalAiTextInstruction(instruction, opts);
                    progressCalls.push({ label, instruction: finalPrompt, opts: clone(opts || {}) });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label))
                        return '{"s":"p","n":"The player lowered their weapon but has not earned trust yet."}';
                    if (/character reply/i.test(label)) {
                        devAssert(
                            /Recent progress toward this objective: The player lowered their weapon but has not earned trust yet\./i.test(
                                finalPrompt,
                            ),
                            "objective progress notes are included in the next narrator prompt without completing the objective",
                            finalPrompt.slice(0, 2200),
                        );
                        return "The stranger watches the lowered weapon but keeps her distance.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I lower my weapon, but stay quiet.",
                    visibleText: "I lower my weapon, but stay quiet.",
                    source: "user",
                    speaker: "Progress Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    !objectiveIsComplete(app.state.objectives.items[0]) &&
                        objectiveProgressNotes(app.state, "earn-first-trust").includes(
                            "The player lowered their weapon but has not earned trust yet.",
                        ),
                    "objective progress result stores a bounded hidden note and leaves the objective active",
                    {
                        objective: app.state.objectives.items[0],
                        notes: objectiveProgressNotes(app.state, "earn-first-trust"),
                        calls: progressCalls.map((call) => call.label),
                    },
                );

                const seedBranch = () => {
                    app.pendingObjectiveChoiceReply = null;
                    app.state = repairAiGeneratedState({
                        ...clone(defaultState),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            setup_complete: true,
                            story_source: {
                                mode: "original",
                                title: "Objective Branch Smoke",
                            },
                        },
                        player: {
                            ...clone(defaultState.player || {}),
                            name: "Branch Tester",
                            age: 25,
                            gender: "male",
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            summary: "Objective branch smoke room.",
                            party_members_present: [],
                            npcs_present: [],
                            image_characters: ["Player"],
                        },
                        objectives: {
                            active_id: "branch-gate",
                            focus_id: "branch-gate",
                            items: [
                                {
                                    id: "branch-gate",
                                    title: "Open the Branch Gate",
                                    type: "story",
                                    status: "active",
                                    summary: "Open the gate that creates a route choice.",
                                    completion_control: "player",
                                    completion_criteria: "The player opens the branch gate.",
                                    next_objectives: [
                                        {
                                            id: "branch-gate-left-output",
                                            objective_id: "branch-left",
                                            target_input_group_id: "branch-left-input",
                                            completion_instruction: "Open the left route first.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                        {
                                            id: "branch-gate-right-output",
                                            objective_id: "branch-right",
                                            target_input_group_id: "branch-right-input",
                                            completion_instruction: "Open the right route if it has priority.",
                                            requirements: [],
                                            rewards: [],
                                        },
                                    ],
                                    rewards: [],
                                },
                                {
                                    id: "branch-left",
                                    title: "Take the Left Route",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Take the left route.",
                                    completion_control: "player",
                                    completion_criteria: "The player takes the left route.",
                                    next_objectives: [{
                                        id: "branch-left-ending",
                                        completion_instruction: "Conclude the left route.",
                                        rewards: [],
                                        ending_type: "freeplay",
                                        ending_message: "The left branch smoke route is complete.",
                                    }],
                                    rewards: [],
                                },
                                {
                                    id: "branch-right",
                                    title: "Take the Right Route",
                                    type: "story",
                                    status: "hidden",
                                    summary: "Take the right route.",
                                    completion_control: "player",
                                    completion_criteria: "The player takes the right route.",
                                    next_objectives: [{
                                        id: "branch-right-ending",
                                        completion_instruction: "Conclude the right route.",
                                        rewards: [],
                                        ending_type: "freeplay",
                                        ending_message: "The right branch smoke route is complete.",
                                    }],
                                    rewards: [],
                                },
                            ],
                        },
                    });
                    app.messages = [];
                    app.queue = [];
                    app.settings.autoVoice = false;
                    app.settings.autoImages = false;
                    scheduleActiveGameSave();
                    render();
                };
                const branchCalls = [];
                seedBranch();
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-branch-smoke",
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    branchCalls.push({ label, instruction: String(instruction || "") });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label)) return "yes";
                    if (/character reply/i.test(label)) {
                        devAssert(
                                /These previous objective\(s\) were completed by the player's response:/i.test(
                                    instruction,
                                ) &&
                                /- Open the Branch Gate/i.test(instruction) &&
                                !/push only toward this selected objective: "Take the Left Route"/i.test(
                                    instruction,
                                ),
                            "objective branch selection resumes the held narrator reply with completed-objective context while hiding player-controlled branch steering",
                            instruction.slice(0, 2400),
                        );
                        return "The left route opens into a narrow corridor.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I open the branch gate.",
                    visibleText: "I open the branch gate.",
                    source: "user",
                    speaker: "Branch Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    !app.pendingObjectiveChoiceReply &&
                        app.messages.some((message) => message.role === "user") &&
                        app.messages.some((message) => message.role === "assistant") &&
                        !app.state.objectives?.pending_choice &&
                        currentObjectiveTarget(app.state)?.id === "branch-left",
                    "ordered deterministic outputs select the first eligible branch without pausing the narrator reply",
                    {
                        pending: !!app.pendingObjectiveChoiceReply,
                        pendingChoice: app.state.objectives?.pending_choice,
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );
                devAssert(
                    !app.pendingObjectiveChoiceReply &&
                        currentObjectiveTarget(app.state)?.id === "branch-left" &&
                        app.messages.some((message) => message.role === "assistant") &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /Objective complete: Open the Branch Gate/.test(
                                    message.text || "",
                                ),
                        ),
                    "deterministic branch completion keeps one player message, one narrator reply, and one completion notice",
                    {
                        currentObjective: currentObjectiveTarget(app.state),
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );

                const noCompletionCalls = [];
                await seed();
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    noCompletionCalls.push({
                        label,
                        instruction: String(instruction || ""),
                    });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label)) return '{"s":"n"}';
                    if (/character reply/i.test(label)) {
                        devAssert(
                            /ACTIVE OBJECTIVE:/i.test(instruction) &&
                                /Reach the Timing Square: Reach the timing square\./i.test(
                                    instruction,
                                ) &&
                                /Completion criteria: The player reaches the timing square\./i.test(
                                    instruction,
                                ) &&
                                /This objective is player-controlled\./i.test(
                                    instruction,
                                ) &&
                                !/Introduce Tarin Voss as the witness to the arrival/i.test(
                                    instruction,
                                ) &&
                                !/Objective completion story instruction/i.test(
                                    instruction,
                                ),
                            "incomplete player-controlled objective replies receive only the three safe objective fields and completion boundary",
                            instruction.slice(0, 2200),
                        );
                        return "The square remains just out of reach.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I head toward the timing square.",
                    visibleText: "I head toward the timing square.",
                    source: "user",
                    speaker: "Timing Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    !objectiveIsComplete(app.state.objectives.items[0]) &&
                        app.messages.some((message) => message.role === "assistant") &&
                        !app.messages.some((message) => message.role === "game"),
                    "objective-check no result produces guidance but no completion message",
                    {
                        objective: app.state.objectives.items[0],
                        calls: noCompletionCalls.map((call) => call.label),
                    },
                );
                {
                    const objectionObjective = {
                        id: "figure-out-hidden-form",
                        title: "Figure Out What You Signed",
                        type: "story",
                        status: "active",
                        summary: "Find out what the hidden form and badge mean.",
                        completion_control: "player",
                        completion_criteria:
                            "The player asks about, objects to, disputes, challenges, or presses about the hidden form, badge, registration, agreement, or what they supposedly signed.",
                        rewards: [],
                        requires: [],
                    };
                    const objectionPrompt = buildObjectiveCompletionInstruction({
                        source: "player",
                        text: "What the hell are you talking about? I never agreed to any of this. How did I even get here?",
                        objective: objectionObjective,
                        recentMessages: [],
                    });
                    const objectionPromptRules = objectionPrompt.split("\nSTATE:")[0] || objectionPrompt;
                devAssert(
                    /PLAYER OBJECTION RULE/i.test(objectionPromptRules) &&
                            /I never agreed/i.test(objectionPrompt) &&
                            /Evaluate the objective shown below/i.test(
                                objectionPromptRules,
                            ) &&
                            /This is player-controlled: return \{"s":"c"\} only when/i.test(
                                objectionPromptRules,
                            ) &&
                            /Return ONLY compact JSON/i.test(objectionPromptRules) &&
                            /\{"s":"n"\}/i.test(objectionPromptRules) &&
                            /\{"s":"p","n":"short hidden note"\}/i.test(
                                objectionPromptRules,
                            ) &&
                            /\{"s":"c"\}/i.test(objectionPromptRules) &&
                            /Use only the objective's own wording/i.test(
                                objectionPromptRules,
                            ) &&
                            !/Return exactly one lowercase word/i.test(
                                objectionPromptRules,
                            ) &&
                            !/authoritative story-progress checker/i.test(
                                objectionPromptRules,
                            ) &&
                            !/Evaluate the single objective shown below/i.test(
                                objectionPromptRules,
                            ) &&
                            !/Check only the current target objective shown below/i.test(
                                objectionPromptRules,
                            ) &&
                            !/single-milestone story gates/i.test(
                                objectionPromptRules,
                            ) &&
                            !/situation\/agreement\/registration\/badge\/form\/contract/i.test(
                                objectionPromptRules,
                            ) &&
                            !/Examples that usually count|hidden-form|suspicious deal|strange device|false accusation|unexplained magic/i.test(
                                objectionPromptRules,
                            ) &&
                            !/Generic example:|contracts, recruitment|open a box/i.test(
                                objectionPromptRules,
                            ),
                    "player-controlled objective verifier prompt treats objections as possible completion for hidden-form objectives",
                    objectionPromptRules.slice(0, 2200),
                );
                }


                await seed();
                devCreateTestProfile({  });
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");

                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label)) return "no";
                    if (/character reply/i.test(label)) {

                        return "The quiet conversation continues without story nudging.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I keep enjoying the moment.",
                    visibleText: "I keep enjoying the moment.",
                    source: "user",
                    speaker: "Timing Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }

                const lastObjectiveCalls = [];
                await seed();
                devCreateTestProfile({  });

                app.storyDefinition = null;
                app.state.objectives.items = app.state.objectives.items.filter(
                    (objective) => objective.id === "timing-objective",
                );
                delete app.state.objectives.items[0].next_objectives;
                app.state.objectives.items[0].next_objectives = [{
                    id: "timing-objective-final-ending",
                    completion_instruction: "Conclude the final timing smoke route.",
                    rewards: [],
                    ending_type: "freeplay",
                    ending_message: "The final objective timing smoke route is complete.",
                }];
                await devCompileCurrentStoryFixture(
                    "objective-completion-timing-last-objective-smoke",
                );
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    lastObjectiveCalls.push({
                        label,
                        instruction: String(instruction || ""),
                    });
                    if (/scene removal check/i.test(label)) return "#";
                    if (/objective check/i.test(label)) return "yes";
                    if (/character reply/i.test(label)) {
                        devAssert(
                            !/NEXT OBJECTIVE GUIDANCE|CURRENT OBJECTIVE GUIDANCE/i.test(
                                instruction,
                            ),
                            "last objective completion has no next-objective steering",
                            instruction.slice(0, 2200),
                        );
                        return "Tarin Voss marks the end of the current storyline.";
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "I reach the timing square.",
                    visibleText: "I reach the timing square.",
                    source: "user",
                    speaker: "Timing Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    objectiveIsComplete(app.state.objectives.items[0]) &&
                        !currentObjectiveTarget(app.state),
                    "last objective completion leaves no steering target",
                    {
                        objective: app.state.objectives.items[0],
                        currentObjective: currentObjectiveTarget(app.state),
                        calls: lastObjectiveCalls.map((call) => call.label),
                    },
                );

                const noObjectiveCalls = [];
                await seed();
                app.state.objectives.no_current = true;
                app.state.objectives.focus_id = "";
                app.state.objectives.active_id = "";
                aiText = async (instruction, opts = {}) => {
                    noObjectiveCalls.push({
                        label: String(opts.label || ""),
                        instruction: String(instruction || ""),
                    });
                    if (/scene removal check/i.test(String(opts.label || ""))) return "#";
                    if (/objective check/i.test(String(opts.label || "")))
                        throw new Error("Objective verifier should not run with no selected objective.");
                    if (/character reply/i.test(String(opts.label || "")))
                        return "No tracked objective is checked.";
                    return "{}";
                };
                app.queue.push({
                    text: "I do something unrelated.",
                    visibleText: "I do something unrelated.",
                    source: "user",
                    speaker: "Timing Tester",
                });
                await processQueue();
                while (app.busy || app.queue.length) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                devAssert(
                    noObjectiveCalls.every(
                        (call) => !/objective check/i.test(call.label),
                    ) && !app.messages.some((message) => message.role === "game"),
                    "no objective verifier call or completion message happens when no objective is selected",
                    noObjectiveCalls.map((call) => call.label),
                );
            } finally {
                aiText = originalAiText;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "Objective completion timing smoke test passed.");
            showNotice("Live Test Passed", "Objective completion timing smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: objective-completion-timing-smoke");
        }

        async function devRunNoAgencyRetrySmokeTest() {
            devTestLog("Scenario start: no-agency-retry-smoke");
            devResetForLiveTest("no-agency-retry-smoke");
            devCreateTestProfile({  });
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "No Agency Retry Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Kael Mercer",
                    age: 25,
                    gender: "male",
                    role: "retry smoke player",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "A badge is stuck to Kael's chest.",
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
            });
            app.messages = [];
            app.queue = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            const assistant = addMessage("assistant", "", "Narrator", {
                autoRead: false,
            });
            const originalAiText = aiText;
            const aiCalls = [];
            try {
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    aiCalls.push({ label, instruction: String(instruction || "") });
                    if (/character reply/i.test(label)) {
                        return "Kael Mercer reaches for the badge before Lira stops him.";
                    }
                    if (/post-response NPC extraction/i.test(label))
                        return '{"speakers":[],"new_npcs":[]}';
                    return "{}";
                };
                await generateReply(assistant.id);
                const updated = findMessageById(assistant.id);
                const characterReplyCalls = aiCalls.filter((call) =>
                    /character reply/i.test(call.label),
                );
                devAssert(
                    characterReplyCalls.length === 1 &&
                        !aiCalls.some((call) => /agency retry/i.test(call.label)) &&
                        /Kael Mercer reaches for the badge/i.test(updated?.text || ""),
                    "assistant replies are not retried or replaced by post-response player-agency heuristics",
                    {
                        aiCalls: aiCalls.map((call) => call.label),
                        message: updated,
                    },
                );
            } finally {
                aiText = originalAiText;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }
            addMessage("system", "No agency retry smoke test passed.");
            showNotice("Live Test Passed", "No agency retry smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: no-agency-retry-smoke");
        }

        async function devRunAiPriorityStateSyncSmokeTest() {
            devTestLog("Scenario start: ai-priority-state-sync-smoke");
            devResetForLiveTest("ai-priority-state-sync-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: player-facing AI work must be able to interrupt
            // background catch-up state sync, while explicit state/tool calls that
            // opt into allowDuringStateSync may run without cancelling that work.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "AI Priority Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Priority Tester",
                    age: 25,
                    gender: "female",
                },
            });
            app.messages = [
                {
                    id: "priority-assistant",
                    entryId: 1,
                    role: "assistant",
                    speaker: "Narrator",
                    text: "Pending state sync message.",
                    stateSyncStatus: "pending",
                    at: new Date().toISOString(),
                },
            ];
            const originalRunAiTextNow = runAiTextNow;
            try {
                runAiTextNow = async () => "ok";
                let cancelled = false;
                app.stateSync.running = true;
                app.stateSync.queued = false;
                app.activeStateCheck = {
                    id: "priority-check",
                    source: "assistant",
                    messageIds: ["priority-assistant"],
                    cancel: () => {
                        cancelled = true;
                    },
                };
                const result = await aiText("priority reply", {
                    label: "character reply",
                    logType: "ai",
                });
                devAssert(
                    result === "ok" &&
                        cancelled &&
                        app.stateSync.queued === true,
                    "normal AI requests pause active background state sync",
                    {
                        result,
                        cancelled,
                        stateSync: app.stateSync,
                        activeStateCheck: app.activeStateCheck,
                    },
                );

                cancelled = false;
                app.stateSync.running = true;
                app.stateSync.queued = false;
                app.activeStateCheck = {
                    id: "allow-check",
                    source: "assistant",
                    messageIds: ["priority-assistant"],
                    cancel: () => {
                        cancelled = true;
                    },
                };
                await aiText("state tool work", {
                    label: "AI command patch",
                    logType: "command",
                    allowDuringStateSync: true,
                });
                devAssert(
                    !cancelled &&
                        app.stateSync.running === true &&
                        app.stateSync.queued === false,
                    "AI requests marked allowDuringStateSync do not cancel background state sync",
                    {
                        cancelled,
                        stateSync: app.stateSync,
                        activeStateCheck: app.activeStateCheck,
                    },
                );

                {
                    const savedMessages = clone(app.messages || []);
                    const savedQueue = clone(app.queue || []);
                    const savedStateSync = clone(app.stateSync || {});
                    const savedNpcInspection = app.npcInspectionInFlight;
                    const originalRunStateCheck = runStateCheck;
                    const originalAiTextForAuto = aiText;
                    const order = [];
                    try {
                        app.messages = Array.from(
                            { length: STATE_SYNC_FREE_MESSAGE_SLACK + 1 },
                            (_, index) => ({
                                id: `auto-backlog-${index}`,
                                entryId: index + 1,
                                role: index % 2 ? "assistant" : "user",
                                speaker: index % 2 ? "Narrator" : "Priority Tester",
                                text: `Auto backlog message ${index + 1}.`,
                                stateSyncStatus: "pending",
                                at: new Date().toISOString(),
                            }),
                        );
                        app.queue = [];
                        app.stateSync = {
                            ...clone(savedStateSync),
                            running: false,
                            queued: false,
                            status: "",
                            processingMessageIds: [],
                            completedStepKeys: [],
                            generation: 0,
                        };
                        app.activeStateCheck = null;
                        app.aiActive = null;
                        app.aiQueue = [];
                        app.npcInspectionInFlight = new Set();
                        runStateCheck = async (_source, _text, options = {}) => {
                            order.push(options.forceOneStep ? "state-one-step" : "state");
                            return true;
                        };
                        aiText = async (_instruction, opts = {}) => {
                            order.push(opts.label || "ai");
                            app.npcInspectionInFlight = new Set(["block-auto-queue"]);
                            return "\"I test the auto backlog gate.\"";
                        };
                        await generateAndQueueAutoPlayerTurn("auto backlog smoke");
                        devAssert(
                            order[0] === "state-one-step" &&
                                order[1] === "auto player turn" &&
                                app.queue.some(
                                    (item) =>
                                        item.source === "auto_player" &&
                                        /auto backlog gate/i.test(item.text || ""),
                                ),
                            "auto-player turn generation forces one state-sync catch-up step before building the next auto player prompt",
                            { order, queue: app.queue, stateSync: app.stateSync },
                        );
                        app.messages = [
                            {
                                id: "latest-player-auto-block",
                                entryId: 991,
                                role: "user",
                                speaker: "Priority Tester",
                                text: "I already took a turn.",
                                stateSyncStatus: "pending",
                                at: new Date().toISOString(),
                            },
                        ];
                        devAssert(
                            autoPlayerTurnCanStart("latest-player smoke") === false,
                            "auto-player turn generation is blocked when the latest story message is already a player turn",
                            { messages: app.messages },
                        );
                        app.messages = [
                            {
                                id: "recent-player-duplicate",
                                entryId: 992,
                                role: "user",
                                speaker: "Priority Tester",
                                text: "I check the door.",
                                stateSyncStatus: "synced",
                                at: new Date().toISOString(),
                            },
                            {
                                id: "recent-assistant-before-duplicate",
                                entryId: 993,
                                role: "assistant",
                                speaker: "Narrator",
                                text: "The door creaks under your hand.",
                                stateSyncStatus: "synced",
                                at: new Date().toISOString(),
                            },
                        ];
                        devAssert(
                            autoPlayerTurnWouldDuplicateRecentPlayerMessage(
                                '"I check the door."',
                                "duplicate smoke",
                            ) === true,
                            "auto-player turn generation is blocked when it repeats a recent player message",
                            { messages: app.messages },
                        );
                    } finally {
                        runStateCheck = originalRunStateCheck;
                        aiText = originalAiTextForAuto;
                        app.messages = savedMessages;
                        app.queue = savedQueue;
                        app.stateSync = savedStateSync;
                        app.npcInspectionInFlight = savedNpcInspection;
                        app.autoPlayerTurnGenerating = false;
                    }
                }

                const originalAiText = aiText;
                let repairCalls = 0;
                const invalidSceneTimePatch = `scene{
summary=priority test scene
}
characters{
Priority Tester{
pose=should not repair before reply
}
}`;
                try {
                    aiText = async () => {
                        repairCalls += 1;
                        return "{}";
                    };
                    app.stateSync.running = true;
                    app.stateSync.queued = false;
                    app.aiQueue = [];
                    app.activeStateCheck = {
                        id: "forced-one-step-check",
                        source: "assistant",
                        messageIds: ["priority-assistant"],
                        cancelled: false,
                    };
                    const forcedResult = await parseAndRepairGroupedPatch({
                        group: stateCheckGroups()[0],
                        source: "assistant",
                        text: "Priority test.",
                        raw: invalidSceneTimePatch,
                        context: groupedStateContext("scene_time", app.state),
                        beforeState: app.state,
                        forceOneStep: true,
                    });
                    devAssert(
                        repairCalls === 0 &&
                            forcedResult.valid &&
                            forcedResult.patch?.scene?.summary,
                        "forced pre-reply catch-up keeps accepted scene fields without repair AI calls",
                        { repairCalls, forcedResult },
                    );

                    app.aiQueue = [
                        {
                            label: "character reply",
                            logType: "ai",
                            opts: {},
                        },
                    ];
                    const yieldedResult = await parseAndRepairGroupedPatch({
                        group: stateCheckGroups()[0],
                        source: "assistant",
                        text: "Priority test.",
                        raw: invalidSceneTimePatch,
                        context: groupedStateContext("scene_time", app.state),
                        beforeState: app.state,
                    });
                    devAssert(
                        repairCalls === 0 &&
                            yieldedResult.valid &&
                            yieldedResult.patch?.scene?.summary,
                        "background state repair yields to queued character reply instead of starting another repair AI call",
                        { repairCalls, yieldedResult, aiQueue: app.aiQueue },
                    );
                } finally {
                    aiText = originalAiText;
                }
            } finally {
                runAiTextNow = originalRunAiTextNow;
                app.aiActive = null;
                app.aiQueue = [];
                app.activeStateCheck = null;
                app.stateSync.running = false;
                app.stateSync.queued = false;
            }
            addMessage("system", "AI priority state sync smoke test passed.");
            showNotice("Live Test Passed", "AI priority state sync smoke test passed.");
            scheduleActiveGameSave();
            render();
            const brokenMessageActions = [
                ...document.querySelectorAll("#thread .message-actions button"),
            ].filter((button) =>
                /\($/.test(String(button.getAttribute("onclick") || "").trim()),
            );
            devAssert(
                brokenMessageActions.length === 0,
                "message action handlers remain valid for string message ids",
                brokenMessageActions.map((button) => button.outerHTML),
            );
            devTestLog("Scenario complete: ai-priority-state-sync-smoke");
        }

        async function devRunAiTimingLogSmokeTest() {
            devTestLog("Scenario start: ai-timing-log-smoke");
            devResetForLiveTest("ai-timing-log-smoke");
            devCreateTestProfile({  });
            const originalRunAiTextNow = runAiTextNow;
            const originalLog = log;
            const capturedLogs = [];
            try {
                log = (title, detail = "", opts = {}) => {
                    capturedLogs.push({ title, detail, opts });
                    return originalLog(title, detail, opts);
                };
                runAiTextNow = async (instruction, opts = {}) => {
                    await new Promise((resolve) => setTimeout(resolve, 25));
                    if (app.aiActive) {
                        app.aiActive.firstStreamAt = performance.now();
                        app.aiActive.streamedChars = 12;
                    }
                    opts.onStream?.("hello world!", "hello world!", false);
                    return "hello world!";
                };
                const text = await aiText("timing smoke prompt", {
                    label: "timing smoke request",
                    logType: "ai",
                    processLabel: "Timing Smoke Process",
                    onStream: () => {},
                });
                await new Promise((resolve) => setTimeout(resolve, 20));
                devAssert(text === "hello world!", "timing smoke AI request returns mocked text");
                const finished = capturedLogs.find(
                    (entry) =>
                        entry.title === "Chat AI finished" &&
                        /timing smoke request/.test(entry.detail || ""),
                );
                devAssert(
                    !!finished &&
                        /Process: Timing Smoke Process/.test(finished.detail || "") &&
                        /Queue wait:/.test(finished.detail || "") &&
                        /Active duration:/.test(finished.detail || "") &&
                        /Total since queued:/.test(finished.detail || "") &&
                        /Prompt chars:/.test(finished.detail || "") &&
                        /Response chars:/.test(finished.detail || "") &&
                        /Streamed chars:/.test(finished.detail || "") &&
                        /First stream:/.test(finished.detail || ""),
                    "AI finished log uses the standard timing fields",
                    finished,
                );
            } finally {
                runAiTextNow = originalRunAiTextNow;
                log = originalLog;
                app.aiActive = null;
                app.aiQueue = [];
            }
            addMessage("system", "AI timing log smoke test passed.");
            showNotice("Live Test Passed", "AI timing log smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: ai-timing-log-smoke");
        }

        async function devRunHostedGenerationContractChecks() {
            const originalFetch = globalThis.fetch;
            const originalPreferences = generationPreferences;
            const originalLaunch = hostingLaunchPreferences;
            const stored = localStorage.getItem(GENERATION_PREFERENCES_KEY);
            const surface = document.createElement("div");
            const preferences = {text: "hosting-proxy", image: "hosting-proxy", proxyUrl: "http://127.0.0.1:51840"};
            const requests = [];
            try {
                hostingLaunchPreferences = () => null;
                generationPreferences = () => preferences;
                localStorage.setItem(GENERATION_PREFERENCES_KEY, JSON.stringify(preferences));
                appendGenerationSettings(surface);
                const textControl = surface.querySelector("#generation-text");
                textControl.value = "game";
                textControl.dispatchEvent(new Event("change", {bubbles: true}));
                devAssert(savedGenerationPreferences().text === "game", "hosted generation controls autosave without a Save button");
                const urlControl = surface.querySelector("#generation-proxyUrl");
                urlControl.value = "https://not-a-local-bridge.example";
                urlControl.dispatchEvent(new Event("change", {bubbles: true}));
                devAssert(savedGenerationPreferences().proxyUrl === preferences.proxyUrl && surface.querySelector('[role="status"]').textContent.includes("loopback"),
                    "invalid hosting settings report the problem and preserve the last valid value");
                devAssert(EmberGenerationContract.launchPreferences("?emberHosting=http%3A%2F%2F127.0.0.1%3A51840").text === "hosting-proxy",
                    "published launch query selects hosted text and images");
                globalThis.fetch = async (url, options) => {
                    requests.push({url, options, payload: JSON.parse(options.body)});
                    return new Response(JSON.stringify(String(url).endsWith("/text")
                        ? {text: "A synthetic reply."}
                        : {image: "data:image/png;base64,aGVsbG8="}));
                };
                const reply = await runAiTextNow("Synthetic hosting smoke instruction", {startWith: "Opening: ", stopSequences: ["END"]});
                devAssert(reply === "Opening: A synthetic reply." && requests.length === 1 && requests[0].payload.stopSequences[0] === "END",
                    "actual text executor preserves prefixes and stops through the hosted route");
                const imageHtml = await generateHostedImageHtml("Synthetic landscape", "text, watermark", 42, {resolution: "512x768"});
                devAssert(imageHtml.includes("data:image/png;base64,") && requests[1].payload.width === 832 && requests[1].payload.height === 1216 && requests[1].payload.seed === 42,
                    "hosted images keep the seed and use the portrait resolution");
                devAssert(requests.every(request => request.options.headers["X-Ember-Generation"] === "1" && request.options.targetAddressSpace === "loopback"),
                    "hosted requests identify the game and request browser loopback access");
                globalThis.fetch = async () => {
                    requests.push({failed: true});
                    return new Response(JSON.stringify({error: "Synthetic hosting rejection"}), {status: 429});
                };
                let failure = "";
                try { await runAiTextNow("Synthetic hosting failure"); }
                catch (error) { failure = error.message; }
                devAssert(requests.length === 3 && failure.includes("Synthetic hosting rejection"),
                    "hosted failures surface after one request without switching to another provider");
            }
            finally {
                globalThis.fetch = originalFetch;
                generationPreferences = originalPreferences;
                hostingLaunchPreferences = originalLaunch;
                if (stored === null)
                    localStorage.removeItem(GENERATION_PREFERENCES_KEY);
                else
                    localStorage.setItem(GENERATION_PREFERENCES_KEY, stored);
            }
        }

        async function devRunOllamaProviderSmokeTest() {
            devResetForLiveTest("ollama-provider-smoke");
            const oldFetch = globalThis.fetch;
            const oldWindowTransport = globalThis.EmberOllamaWindowTransport;
            const oldPlayerDiscovery = globalThis.EmberOllamaPlayerDiscovery;
            const oldConfig = clone(app.settings.ollama);
            const oldKey = app.ollamaAccessKey;
            const oldNotice = showNotice;
            const oldGenerationPreferences = generationPreferences;
            try {
                await devRunHostedGenerationContractChecks();
                generationPreferences = () => ({text: "game", image: "perchance", proxyUrl: "http://127.0.0.1:51840"});
                devCreateTestProfile({});
                app.settings.ollama = {...globalThis.EmberOllama.defaults};
                app.ollamaAccessKey = "";
                //Keep the UI smoke self-contained even inside a Perchance frame that requires the connection window.
                globalThis.EmberOllamaWindowTransport = {request: (config, path, init) => globalThis.fetch(`${config.url}${path}`, init), adopt() {}, hasWindow: () => false};
                globalThis.EmberOllamaPlayerDiscovery = {find: () => ({popup: {close() {}}, promise: Promise.resolve([{name: "Synthetic Host", url: "https://smoke.tail.ts.net"}])})};
                let requests = [];
                let finishLoad;
                let rejectNextStatus = false;
                globalThis.fetch = async (url, options = {}) => {
                    requests.push({url, options});
                    if (String(url).endsWith("/api/pair"))
                        return new Response(JSON.stringify({token: "synthetic-smoke-host-key-1234567890"}));
                    if (String(url).endsWith("/api/model/load"))
                        return new Promise(resolve => {finishLoad = () => resolve(new Response(JSON.stringify({ready: true, model: "smoke-model:latest"})));});
                    if (String(url).endsWith("/api/status")) {
                        if (rejectNextStatus) {
                            rejectNextStatus = false;
                            return new Response(JSON.stringify({error: "Synthetic expired connection"}), {status: 401});
                        }
                        return new Response(JSON.stringify({models: ["smoke-model:latest"], modelLabels: {"smoke-model:latest": "Smoke Model.gguf"}, availableFiles: [
                            {name: "ea-local-smoke-one:latest", label: "Smoke-One.gguf"},
                            {name: "ea-local-smoke-two:latest", label: "Smoke-Two.gguf"}
                        ], running: []}));
                    }
                    return new Response(JSON.stringify({delta: "Synthetic ", done: false}) + "\n" + JSON.stringify({delta: "reply.", done: true, reason: "stop"}) + "\n");
                };
                openSettingsModal();
                devAssert($("ollama-reasoning").type === "checkbox" && !$("ollama-reasoning").checked &&
                    /much longer/.test($("ollama-reasoning").title), "reasoning checkbox defaults off and explains the delay");
                $("ollama-provider").value = "ollama";
                $("ollama-provider").dispatchEvent(new Event("change", {bubbles:true}));
                devAssert(!$("ollama-accessKey"), "connection does not require a manual access key");
                const panel = document.querySelector("[data-ollama-settings]");
                devAssert(![...panel.querySelectorAll("button")].some(button => button.textContent === "Save Text Settings"), "text settings do not require a Save button");
                devAssert(app.settings.ollama.provider === "ollama" && app.settings.textProvider === "ollama", "provider changes save immediately even before model selection");
                const connect = [...panel.querySelectorAll("button")].find(button => button.textContent.startsWith("Refresh Models"));
                $("ollama-model").dispatchEvent(new Event("pointerdown", {bubbles: true, cancelable: true}));
                await devWaitFor(() => !connect.disabled, 2000, "Ollama fake host model list");
                devAssert([...$("ollama-model").options].some(option => option.value === "smoke-model:latest"), "opening model picker discovers installed models");
                devAssert([...$("ollama-model").options].some(option => option.value === "smoke-model:latest" && option.textContent === "Smoke Model.gguf"),
                    "registered GGUF models show the original filename instead of their internal tag");
                devAssert(!$("ollama-num_ctx"), "context allocation is managed internally and has no player setting");
                devAssert([...$("ollama-model").options].some(option => option.value === "ea-local-smoke-one:latest" && option.textContent.includes("import on first use")),
                    "model picker includes GGUF files in the host folder for on-demand import");
                devAssert($("ollama-model").value === "", "single installed model still requires selection so its change event loads it");
                devAssert(requests.some(request => String(request.url).endsWith("/api/pair")), "connect requests host approval before listing models");
                rejectNextStatus = true;
                connect.click();
                await devWaitFor(() => !connect.disabled, 2000, "synthetic host reconnect");
                devAssert(requests.filter(request => String(request.url).endsWith("/api/pair")).length === 2, "expired connection is paired again when Connect is clicked");
                devAssert(![...panel.querySelectorAll("button")].some(button => button.textContent.includes("Enable Tailscale")),
                    "Tailscale is configured in the standalone host panel");
                devAssert([...panel.querySelectorAll("button")].some(button => button.textContent.includes("Download Windows player connector")),
                    "the playing computer can download its connector directly from the game");
                $("ollama-model").value = "smoke-model:latest";
                $("ollama-model").dispatchEvent(new Event("change", {bubbles:true}));
                devAssert(app.settings.ollama.model === "smoke-model:latest" && !!app.ollamaAccessKey, "model and approved connection are active before loading finishes");
                devAssert(!!finishLoad && !panel.querySelector("progress").hidden && !panel.querySelector("progress").hasAttribute("value"), "model selection shows indeterminate loading until the host confirms readiness");
                finishLoad();
                await devWaitFor(() => panel.querySelector("progress").value === 1, 2000, "synthetic model readiness");
                $("ollama-temperature").value = "0.6";
                $("ollama-seed").value = "17";
                $("ollama-temperature").dispatchEvent(new Event("input", {bubbles:true}));
                $("ollama-seed").dispatchEvent(new Event("input", {bubbles:true}));
                devAssert(app.settings.ollama.model === "smoke-model:latest" && app.settings.ollama.temperature === "0.6", "actual settings controls commit the chosen model and tuning");
                $("ollama-temperature").value = "invalid";
                $("ollama-temperature").dispatchEvent(new Event("input", {bubbles:true}));
                devAssert(app.settings.ollama.temperature === "0.6" && panel.querySelector('[role="status"]').textContent.startsWith("Not saved:"), "invalid drafts preserve the last valid settings and explain why");
                $("ollama-temperature").value = "0.6";
                $("ollama-temperature").dispatchEvent(new Event("input", {bubbles:true}));
                closeModal();
                const chunks = [];
                const reply = await runAiTextNow("Synthetic smoke instruction", {onStream: (text, delta, done) => chunks.push({text, delta, done})});
                devAssert(reply === "Synthetic reply." && chunks.filter(chunk => !chunk.done).length === 2, "Ollama streams before its final text result");
                devAssert(!JSON.stringify(localSettingsForStorage()).includes("synthetic-smoke-host-key"), "host key is excluded from persisted settings");
                const request = JSON.parse(requests.at(-1).options.body);
                devAssert(request.config.seed === "17" && request.config.model === "smoke-model:latest" && request.config.reasoning === false, "request includes selected model, seed and disabled reasoning");
                openSettingsModal();
                $("ollama-connection").value = "tailscale";
                $("ollama-connection").dispatchEvent(new Event("change", {bubbles: true}));
                devAssert($("ollama-url").value === "" && app.settings.ollama.connection === "local" &&
                    document.querySelector('[data-ollama-settings] [role="status"]').textContent.includes("Searching Tailscale"),
                    "switching to Tailscale starts discovery without overwriting valid local settings");
                await devWaitFor(() => app.settings.ollama.url === "https://smoke.tail.ts.net", 2000, "synthetic Tailscale host discovery");
                devAssert(app.settings.ollama.connection === "tailscale" && app.settings.ollama.url === "https://smoke.tail.ts.net",
                    "discovered Tailscale host saves the remote connection automatically");
                devAssert(!$("ollama-model").parentElement.hidden, "Tailscale offers model selection too");
                $("ollama-reasoning").click();
                devAssert(app.settings.ollama.reasoning === true && localSettingsForStorage().ollama.reasoning === true,
                    "reasoning checkbox persists its enabled boolean");
                closeModal();
                openSettingsModal();
                devAssert($("ollama-reasoning").checked, "reasoning selection survives reopening settings");
                $("ollama-reasoning").click();
                devAssert(app.settings.ollama.reasoning === false, "reasoning can be disabled again");
                closeModal();
                requests = [];
                globalThis.fetch = async () => {requests.push(true); throw new TypeError("Synthetic connection failure");};
                let failed = false;
                try { await runAiTextNow("Synthetic failure"); } catch { failed = true; }
                devAssert(failed && requests.length === 1, "Ollama network failures do not silently retry or switch providers");
                showNotice = () => {};
                app.mainMenuOpen = true;
                app.messages = [{id: "ollama-smoke-blank", role: "assistant", text: "", entryId: 1}];
                continueStartupFlow();
                devAssert(!findMessageById("ollama-smoke-blank"), "startup does not automatically contact a manually connected Ollama host to repair blank replies");
            }
            finally {
                globalThis.fetch = oldFetch;
                globalThis.EmberOllamaWindowTransport = oldWindowTransport;
                globalThis.EmberOllamaPlayerDiscovery = oldPlayerDiscovery;
                app.settings.ollama = oldConfig;
                app.ollamaAccessKey = oldKey;
                showNotice = oldNotice;
                generationPreferences = oldGenerationPreferences;
                closeModal();
            }
        }

        function devExactObjectiveTimingPrompt() {
            return `You are EmberAdventures's player-action objective verifier.
Return ONLY compact JSON. No markdown, punctuation outside JSON, or explanation.
Use:
{"s":"n"} = no meaningful progress
{"s":"p","n":"short hidden note"} = meaningful progress, not complete
{"s":"c"} = complete

Rules:
- Evaluate the objective shown below.
- This is player-controlled: return {"s":"c"} only when the player's latest message or already-established player action means the player has done enough for the next narrator reply to show the objective's immediate outcome.
- Return {"s":"p","n":"..."} when the player moved toward the objective but it should remain selected.
- PLAYER OBJECTION RULE: for objectives about understanding, questioning, investigating, pressing, clarifying, confronting, objecting to, disputing, refusing, or challenging the current situation, completion requires the player to push hard enough that the next narrator reply should reveal or resolve the objective now.
- Use only the objective's own wording and the provided state/messages to decide what kind of objection matters. Do not import examples, objects, phrases, or story concepts from outside this objective.
- For movement/transition objectives, reaching the threshold, entrance, surroundings, or first scene event at the destination counts unless the objective requires a precise named place.
- Return {"s":"n"} if the objective is only planned, offered, discussed, or still missing a required concrete outcome.
- Be forgiving about setup/transition objectives, but strict about objectives that require exact named outcomes, explicit commitments, or irreversible results.
- Objective-specific completion criteria: Leave the barn with Durandal and get your first look at the village outside.

STATE:
{
  "location": {
    "universe": "Harem in the Labyrinth of Another World",
    "world": "The Other World",
    "continent": "",
    "region": "Countryside near the first village",
    "settlement_type": "village outskirts",
    "settlement_name": "First Village",
    "district": "Barn and fields",
    "specific_place": "inside a straw-filled barn"
  },
  "scene": {
    "summary": "Michio has woken in a barn in the other world, found the sword beside him, and identified it as Durandal.",
    "party_members_present": [],
    "npcs_present": []
  },
  "current_objective": {
    "id": "leave-the-barn",
    "title": "Leave the Barn",
    "summary": "Step out of the barn with Durandal and get your first look at the village outside.",
    "completion_control": "player",
    "completion_criteria": "Leave the barn with Durandal and get your first look at the village outside."
  },
  "recent_messages": [
    {
      "id": 1,
      "role": "assistant",
      "speaker": "Narrator",
      "text": "Michio wakes on the floor of an unfamiliar barn. The last thing he remembers is finishing a strange fantasy RPG-like setup screen, but this place feels real.

A sword lies beside him in the straw. When he uses Appraisal, the answer comes clearly: Durandal. It is his starting weapon, and it is now in his possession.

Michio stands with Durandal in hand. Through the barn doorway, he can see a small village beginning its morning."
    },
    {
      "id": 34,
      "role": "user",
      "speaker": "Michio Kaga",
      "text": "He walks out of the barn."
    }
  ]
}

PLAYER MESSAGE:
He walks out of the barn.

Compact JSON:`;
        }

        function devParseTimingMs(detail = "", label = "Active duration") {
            const match = String(detail).match(
                new RegExp(`${label}:\\s*([\\d,]+)ms`, "i"),
            );
            return match ? Number(match[1].replace(/,/g, "")) : null;
        }

        function devLivePerchanceTextSmokeRunId(label = "text") {
            return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }

        async function devRunExactObjectiveAiTimingSmokeTest() {
            devTestLog("Scenario start: exact-objective-ai-timing-smoke");
            devResetForLiveTest("exact-objective-ai-timing-smoke");
            devCreateTestProfile({  });
            const diagnosticRunId = devLivePerchanceTextSmokeRunId("exact-objective");
            const prompt = `${devExactObjectiveTimingPrompt()}

DIAGNOSTIC RUN ID:
${diagnosticRunId}

Ignore the diagnostic run id. It exists only to keep live smoke prompts unique.`;
            devTestLog("Exact objective live text diagnostic run id", {
                diagnosticRunId,
            });
            devAssert(
                prompt.length > 3000 && /Compact JSON:/i.test(prompt),
                "exact objective timing smoke uses the copied prompt text length",
                { promptLength: prompt.length },
            );
            devAssert(
                !!perchancePlugin("aiTextPlugin"),
                "exact objective timing smoke must run inside the Perchance-hosted loader where aiTextPlugin exists",
            );
            const originalLog = log;
            const capturedLogs = [];
            try {
                log = (title, detail = "", opts = {}) => {
                    capturedLogs.push({ title, detail, opts });
                    return originalLog(title, detail, opts);
                };
                const startedAt = performance.now();
                let response = "";
                try {
                    response = await Promise.race([
                        aiText(prompt, {
                            label: "exact objective timing smoke",
                            logType: "state",
                            processLabel: "Exact Objective Timing Smoke",
                            textProviderOverride: "perchance",
                            startWith: "",
                            hideStartWith: true,
                            stopSequences: [],
                        }),
                        devWaitFor(
                            () => false,
                            60000,
                            "live Perchance exact objective AI response",
                        ),
                    ]);
                } catch (err) {
                    if (/Timed out waiting for live Perchance exact objective AI response/i.test(err?.message || ""))
                        throw smokeSkipError(
                            "Live Perchance text did not return an exact-objective response within 60s.",
                        );
                    throw err;
                }
                const wallMs = Math.round(performance.now() - startedAt);
                const finished = capturedLogs.find(
                    (entry) =>
                        entry.title === "State AI finished" &&
                        /Exact Objective Timing Smoke/.test(entry.detail || ""),
                );
                const rawResponse = capturedLogs.find(
                    (entry) =>
                        entry.title === "State AI raw response before processing" &&
                        /exact objective timing smoke/.test(entry.detail || ""),
                );
                const timingDetail = finished?.detail || rawResponse?.detail || "";
                const activeMs = devParseTimingMs(timingDetail);
                const totalMs = devParseTimingMs(timingDetail, "Total since queued");
                const queueMs = devParseTimingMs(timingDetail, "Queue wait");
                const parsedTimingResult = parseObjectiveCompletionResult(response);
                devAssert(
                    parsedTimingResult.status !== "invalid_response",
                    "exact objective timing smoke returns valid compact objective status",
                    { response, parsedTimingResult },
                );
                devAssert(
                    Number.isFinite(activeMs) && activeMs >= 0,
                    "exact objective timing smoke captured active AI duration",
                    { activeMs, totalMs, queueMs, wallMs, rawResponse },
                );
                const summary = [
                    `Exact objective AI timing result: ${String(response).trim()}`,
                    `Diagnostic run id: ${diagnosticRunId}`,
                    `Prompt chars: ${prompt.length}`,
                    `Active AI duration: ${activeMs}ms`,
                    `Total since queued: ${totalMs}ms`,
                    `Queue wait: ${queueMs}ms`,
                    `Measured wall time around aiText(): ${wallMs}ms`,
                ].join("\n");
                recordDevTraceEntry({
                    title: "Exact objective AI timing smoke result",
                    label: "exact objective timing smoke",
                    prompt,
                    response: String(response).trim(),
                    diagnosticRunId,
                    activeMs,
                    totalMs,
                    queueMs,
                    wallMs,
                    logType: "state",
                    logLevel: "message",
                });
                addMessage("system", summary);
                showNotice("Live Test Passed", summary);
                scheduleActiveGameSave();
                render();
            } finally {
                log = originalLog;
                app.aiActive = null;
                app.aiQueue = [];
            }
            devTestLog("Scenario complete: exact-objective-ai-timing-smoke");
        }

        async function devRunFindCharacterTurnSmokeTest() {
            devTestLog("Scenario start: find-character-turn-smoke");
            devResetForLiveTest("find-character-turn-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: Find always reports the local search outcome as
            // a Game message, then queues the normal player-story turn so the
            // narrator and objective/state systems see the same action.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Find Character Turn Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Find Tester",
                    age: 24,
                    gender: "female",
                    role: "search auditor",
                },
                location: {
                    ...clone(defaultState.location || {}),
                    settlement_name: "Smoke Village",
                    specific_place: "market lane",
                    npc_location_id: "smoke-village",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Find character smoke room.",
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
                npc_directory: {
                    locations: {
                        "smoke-village": {
                            label: "Smoke Village",
                            characters: {
                                "New Ally": {
                                    name: "New Ally",
                                    gender: "female",
                                    age: 29,
                                    role: "guard",
                                    relationship: "neutral",
                                    inspected: false,
                                    status: "alive",
                                },
                                "Darin Holt": {
                                    name: "Darin Holt",
                                    gender: "male",
                                    age: 32,
                                    role: "merchant",
                                    relationship: "neutral",
                                    inspected: false,
                                    status: "alive",
                                },
                            },
                        },
                    },
                },
                objectives: {
                    active_id: "find-smoke-objective",
                    focus_id: "find-smoke-objective",
                    items: [
                        {
                            id: "find-smoke-objective",
                            title: "Find Smoke Objective",
                            type: "story",
                            status: "active",
                            summary: "Use Find without completing the objective.",
                            completion_control: "player",
                            completion_criteria:
                                "Only complete if the player says the smoke objective is complete.",
                            rewards: [],
                            requires: [],
                        },
                    ],
                },
            });
            app.messages = [];
            app.queue = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            app.settings.stateCheckMode = "groups";
            await devCompileCurrentStoryFixture("find-character-turn-smoke");
            scheduleActiveGameSave();
            render();

            const originalAiText = aiText;
            const originalRandom = Math.random;
            try {
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    if (/objective check/i.test(label)) return "no";
                    if (/character reply/i.test(label))
                        return "The narrator responds to the search outcome.";
                    return "{}";
                };

                const waitForFindTurnSettled = async () => {
                    const deadline = Date.now() + 10000;
                    while (Date.now() < deadline) {
                        const stateSyncActive =
                            !!app.stateSync?.running || !!app.stateSync?.queued;
                        const aiWorkActive =
                            !!app.aiActive ||
                            !!app.activeStateCheck ||
                            !!app.aiQueue?.length;
                        if (!app.busy && !app.queue.length && !stateSyncActive && !aiWorkActive)
                            return;
                        await new Promise((resolve) => setTimeout(resolve, 50));
                    }
                    throw new Error(
                        `Find smoke turn did not settle: busy=${!!app.busy}, queue=${app.queue.length}, stateSyncRunning=${!!app.stateSync?.running}, stateSyncQueued=${!!app.stateSync?.queued}, aiActive=${!!app.aiActive}, activeStateCheck=${!!app.activeStateCheck}, aiQueue=${app.aiQueue?.length || 0}`,
                    );
                };

                Math.random = () => 0;
                findNpc("New Ally");
                await waitForFindTurnSettled();
                devAssert(
                    (app.state.scene.npcs_present || []).includes("New Ally") &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /New Ally was found nearby/i.test(message.text || ""),
                        ) &&
                        app.messages.some(
                            (message) =>
                                message.role === "user" &&
                                /find them nearby/i.test(message.text || ""),
                        ) &&
                        app.messages.some((message) => message.role === "assistant"),
                    "Find success adds nearby NPC, Game result, user story turn, and narrator reply",
                    {
                        nearby: app.state.scene.npcs_present,
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );

                Math.random = () => 1;
                const beforeFailureCount = app.messages.length;
                findNpc("Darin Holt");
                await waitForFindTurnSettled();
                const failureMessages = app.messages.slice(beforeFailureCount);
                devAssert(
                    !(app.state.scene.npcs_present || []).includes("Darin Holt") &&
                        failureMessages.some(
                            (message) =>
                                message.role === "game" &&
                                /Darin Holt could not be found/i.test(message.text || ""),
                        ) &&
                        failureMessages.some(
                            (message) =>
                                message.role === "user" &&
                                /cannot find them/i.test(message.text || ""),
                        ) &&
                        failureMessages.some((message) => message.role === "assistant"),
                    "Find failure leaves NPC out of scene but still adds Game result, user story turn, and narrator reply",
                    {
                        nearby: app.state.scene.npcs_present,
                        failureMessages: failureMessages.map((message) => ({
                            role: message.role,
                            text: message.text,
                        })),
                    },
                );
            } finally {
                aiText = originalAiText;
                Math.random = originalRandom;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "Find character turn smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: find-character-turn-smoke");
        }

        async function devRunAiCommandDirectSmokeTest() {
            devTestLog("Scenario start: ai-command-direct-smoke");
            devResetForLiveTest("ai-command-direct-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: AI Command is a direct state patcher. It must not
            // create a visible command/story message; it reports success/failure
            // with Game messages only.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "AI Command Direct Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Command Tester",
                    age: 24,
                    gender: "female",
                    role: "command auditor",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Original command smoke summary.",
                    party_members_present: [],
                    npcs_present: [],
                    image_characters: ["Player"],
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "command-hall",
                    specific_place: "Command Hall",
                },
                npc_directory: {
                    locations: {
                        "command-hall": {
                            label: "Command Hall",
                            characters: {
                                "Command Portrait": {
                                    id: "command-portrait",
                                    name: "Command Portrait",
                                    gender: "female",
                                    age: 30,
                                    role: "command witness",
                                    inspected: true,
                                    full_character: materializeCharacterForRuntime(
                                        {
                                            ...blankCharacterTemplate("Command Portrait"),
                                            id: "command-portrait",
                                            name: "Command Portrait",
                                            age: 30,
                                            gender: "female",
                                            role: "command witness",
                                        },
                                        "Command Portrait",
                                    ),
                                },
                            },
                        },
                    },
                },
            });
            app.messages = [];
            app.queue = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            app.settings.stateCheckMode = "groups";
            await devCompileCurrentStoryFixture("ai-command-direct-smoke");
            scheduleActiveGameSave();
            render();

            const originalAiText = aiText;
            try {
                let commandPatchCalls = 0;
                aiText = async (instruction, opts = {}) => {
                    if (/AI command patch/i.test(String(opts.label || ""))) {
                        commandPatchCalls += 1;
                        return commandPatchCalls === 1
                            ? prettyJson({
                                  s: [
                                      {
                                          path: ["scene", "summary"],
                                          value:
                                              "Updated by direct AI command smoke.",
                                      },
                                      {
                                          path: [
                                              "scene",
                                              "npcs_present",
                                          ],
                                          value: ["Command Portrait"],
                                      },
                                  ],
                                  a: [
                                      {
                                          path: ["recent_changes"],
                                          value:
                                              "Command smoke changed the scene summary.",
                                      },
                                  ],
                              })
                            : prettyJson({});
                    }
                    return "{}";
                };
                app.queue.push({
                    text: "Change the scene summary for the smoke test.",
                    visibleText: "Change the scene summary for the smoke test.",
                    commandOnly: true,
                    source: "command",
                    messageId: null,
                });
                await processQueue();
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(
                            getNpcEntry("Command Portrait")?.full_character,
                        );
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "AI Command scene-entry patch to finish the NPC profile image",
                );
                const commandPortrait = activeProfileImage(
                    getNpcEntry("Command Portrait")?.full_character,
                );
                devAssert(
                    app.state.scene.summary === "Updated by direct AI command smoke." &&
                        app.state.scene.npcs_present.includes("Command Portrait") &&
                        commandPortrait?.pending === false &&
                        !commandPortrait?.error &&
                        devLooksLikeRealImageHtml(commandPortrait?.html) &&
                        !app.messages.some((message) => message.role === "command") &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /AI command applied/i.test(message.text || ""),
                        ),
                    "AI Command applies state and reports completion only as a Game message",
                    {
                        scene: app.state.scene,
                        commandPortrait,
                        messages: app.messages.map((message) => ({
                            role: message.role,
                            speaker: message.speaker,
                            text: message.text,
                        })),
                    },
                );

                const beforeNoopCount = app.messages.length;
                app.queue.push({
                    text: "No-op command smoke.",
                    visibleText: "No-op command smoke.",
                    commandOnly: true,
                    source: "command",
                    messageId: null,
                });
                await processQueue();
                const noopMessages = app.messages.slice(beforeNoopCount);
                devAssert(
                    !noopMessages.some((message) => message.role === "command") &&
                        noopMessages.some(
                            (message) =>
                                message.role === "game" &&
                                /made no state changes/i.test(message.text || ""),
                        ),
                    "AI Command no-op reports as a Game message without exposing the command as chat",
                    noopMessages,
                );
            } finally {
                aiText = originalAiText;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "AI command direct smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: ai-command-direct-smoke");
        }

        async function devRunInspectNpcDirectSmokeTest() {
            devTestLog("Scenario start: inspect-npc-direct-smoke");
            devResetForLiveTest("inspect-npc-direct-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: Inspect NPC is a direct info/state tool. It may
            // add a Game completion message and queue a profile image, but must
            // not create player/assistant story turns.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Inspect NPC Direct Smoke",
                    },
                },
                player: devSmokeRuntimeCharacter("Inspect Tester", {
                    age: 24,
                    gender: "female",
                    role: "inspection auditor",
                }),
                location: {
                    ...clone(defaultState.location || {}),
                    settlement_name: "Smoke Village",
                    specific_place: "market lane",
                    npc_location_id: "market-lane",
                },
                world_map: {
                    current_location_id: "smoke-market-lane",
                    focus_location_id: "smoke-market-lane",
                    travel_history: ["smoke-market-lane"],
                    locations: {
                        "smoke-market-lane": {
                            id: "smoke-market-lane",
                            name: "Market Lane",
                            type: "place",
                            scale: "site",
                            discovered: true,
                            travel_enabled: true,
                            summary: "A public market lane with record stalls.",
                            connections: ["glass-alembic-vault"],
                        },
                        "glass-alembic-vault": {
                            id: "glass-alembic-vault",
                            name: "Glass Alembic Vault",
                            type: "alchemy shop",
                            scale: "site",
                            discovered: false,
                            travel_enabled: false,
                            summary:
                                "Hidden future alchemy shop for a locked future cast member.",
                            connections: ["smoke-market-lane"],
                        },
                    },
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Inspect NPC smoke room.",
                    party_members_present: [],
                    npcs_present: ["Nia Solen"],
                    image_characters: ["Player"],
                },
                npc_directory: {
                    locations: {
                        "market-lane": {
                            label: "market lane",
                            characters: {
                                "Nia Solen": {
                                    id: "nia-solen",
                                    name: "Nia Solen",
                                    gender: "female",
                                    age: 31,
                                    role: "scribe",
                                    relationship: "neutral",
                                    inspected: false,
                                    status: "alive",
                                    note: "Keeps village records.",
                                },
                            },
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
                            full_character: devSmokeRuntimeCharacter(
                                "Future Alchemist",
                                {
                                    role: "prism slime alchemist",
                                    personality_description:
                                        "Uses living potions and secret glass lab equipment.",
                                },
                            ),
                        },
                    },
                },
            });
            app.messages = [
                {
                    id: 1,
                    role: "assistant",
                    speaker: "Nia Solen",
                    text: `"Records don't lie. People do." She keeps one ink-stained hand on her ledger as she watches the street.`,
                    ts: Date.now(),
                },
            ];
            app.queue = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            app.settings.stateCheckMode = "groups";
            scheduleActiveGameSave();
            render();

            // AI-state repair must retain the shell identity before save.
            const smokeNpc = getNpcEntry("Nia Solen");
            const smokeNpcId = smokeNpc?.id;
            devAssert(!!smokeNpcId, "new NPC production path assigns a stable shell identity", smokeNpc);

            const uninspectedSaveOperations = await characterSaveOperations({
                kind: "npc",
                recordId: JSON.stringify(["market-lane", "Nia Solen"]),
                structural: true,
            });
            devAssert(
                uninspectedSaveOperations.length === 1 &&
                    uninspectedSaveOperations[0].type === "npc.shell.put" &&
                    uninspectedSaveOperations[0].shell.characterId === smokeNpcId &&
                    uninspectedSaveOperations[0].shell.inspected === false,
                "uninspected NPC saves as a shell without requiring full appearance",
                uninspectedSaveOperations,
            );

            const originalAiText = aiText;
            const originalProcessQueue = processQueue;
            let processQueueCalledAfterInspection = false;
            let replacedNpcDuringInspection = false;
            let aiTextCallCount = 0;
            let releaseNiaInspection = null;
            const niaInspectionGate = new Promise((resolve) => {
                releaseNiaInspection = resolve;
            });
            try {
                app.disableSmokeNpcInspectionAutoConfirm = true;
                app.state.npc_directory.locations["market-lane"].characters["Cancel Vale"] = {
                    id: "cancel-vale",
                    name: "Cancel Vale",
                    gender: "female",
                    age: 28,
                    role: "market witness",
                    relationship: "neutral",
                    inspected: false,
                    status: "alive",
                    note: "Used to verify inspection cancellation.",
                };
                aiText = async (instruction, opts = {}) => {
                    aiTextCallCount += 1;
                    if (/npc inspection/i.test(String(opts.label || ""))) {
                        if (/Trunc Vale/i.test(instruction)) {
                            return `{"gender":"female","age":29,"role":"dock guard","personality_description":"A reliable guard who notices small details before they become trouble.","relationship_to_player":"neutral","appearance":{"species":"human","hair_color":"black","eye_color":"brown"},"clothing":{"shirt":"blue guard tunic"},"known_facts":["Trunc Vale patrols the dock road."],"image":{"seed_en`;
                        }
                        devAssert(
                            !/Future Alchemist|Glass Alembic Vault|prism slime|living potions|secret glass lab/i.test(
                                instruction,
                            ),
                            "NPC inspection prompt hides locked future cast and hidden future map details",
                            instruction,
                        );
                        devAssert(
                            /Records don't lie|ink-stained hand|ledger/i.test(
                                instruction,
                            ),
                            "NPC inspection prompt includes recent visible context for the inspected NPC",
                            instruction,
                        );
                        await niaInspectionGate;
                        const foundNpc = findNpcEntryInState(app.state, "Nia Solen");
                        if (foundNpc) {
                            app.state.npc_directory.locations[
                                foundNpc.locationId
                            ].characters[foundNpc.key] = {
                                ...foundNpc.npc,
                                note: "Replacement record created during slow inspection.",
                                inspected: false,
                            };
                            replacedNpcDuringInspection = true;
                        }
                        const character = devSmokeRuntimeCharacter("Nia Solen", {
                            age: 31,
                            gender: "female",
                            role: "village scribe",
                            personality_description:
                                "Careful, observant, and practical.",
                            relationship_to_player: "neutral",
                            state_of_mind: "curious",
                            physical_state: "healthy",
                            appearance: {
                                summary: "Adult woman with ink-stained fingers.",
                            },
                            clothing: {
                                shirt: "plain scribe robes",
                            },
                        });
                        character.id = "inspection-generated-different-id";
                        character.fallback_outfits = ["Scribe robes (alternate fit)"];
                        character.fallback_starting_outfit_id = "alternate_scribe";
                        return prettyJson(character);
                    }
                    return "{}";
                };
                processQueue = async () => {
                    processQueueCalledAfterInspection = true;
                    app.queue = [];
                };
                const aiTextCallsBeforeCancel = aiTextCallCount;
                const cancelInspection = inspectNpc("Cancel Vale");
                await devWaitFor(
                    () =>
                        /NPC Inspection Takes Time/i.test(
                            document.body.textContent || "",
                        ) &&
                        !!document.querySelector(".popup-modal #confirmNoBtn"),
                    1000,
                    "NPC inspection duration confirmation with cancel button",
                );
                document.querySelector(".popup-modal #confirmNoBtn")?.click();
                const canceledInspection = await cancelInspection;
                devAssert(
                    canceledInspection === null &&
                        getNpcEntry("Cancel Vale")?.inspected !== true &&
                        !(app.npcInspectionInFlight || new Set()).has("Cancel Vale") &&
                        aiTextCallCount === aiTextCallsBeforeCancel,
                    "Cancel on NPC inspection duration confirmation cancels inspection before AI work starts",
                    {
                        canceledInspection,
                        npc: getNpcEntry("Cancel Vale"),
                        inFlight: [...(app.npcInspectionInFlight || [])],
                        aiTextCallCount,
                        aiTextCallsBeforeCancel,
                    },
                );
                const firstInspection = inspectNpc("Nia Solen");
                await devWaitFor(
                    () =>
                        /NPC Inspection Takes Time/i.test(
                            document.body.textContent || "",
                        ),
                    1000,
                    "first profile NPC inspection duration notice",
                );
                devAssert(
                    !!document.querySelector(".popup-modal #confirmYesBtn") &&
                        !!document.querySelector(".popup-modal #confirmNoBtn"),
                    "NPC inspection duration confirmation offers Inspect and Cancel before the long request starts",
                );
                document.querySelector(".popup-modal #confirmYesBtn")?.click();
                await devWaitFor(
                    () => (app.npcInspectionInFlight || new Set()).has("Nia Solen"),
                    1000,
                    "first NPC inspection is marked in-flight before duplicate click",
                );
                const duplicateResult = await inspectNpc("Nia Solen");
                document.querySelector(".popup-modal #noticeOkBtn")?.click();
                await new Promise((resolve) => setTimeout(resolve, 50));
                devAssert(
                    duplicateResult === null,
                    "duplicate inspection request for the same NPC is rejected while first request is running",
                    {
                        duplicateResult,
                        inFlight: [...(app.npcInspectionInFlight || [])],
                    },
                );
                app.busy = false;
                await submitUserText("Queued while inspection is running.");
                devAssert(
                    app.queue.length === 1 &&
                        !processQueueCalledAfterInspection &&
                        app.queue[0]?.visibleText === "Queued while inspection is running.",
                    "typed player message queues during NPC inspection even if busy flag is stale",
                    {
                        queue: app.queue,
                        processQueueCalledAfterInspection,
                        inFlight: [...(app.npcInspectionInFlight || [])],
                        busy: app.busy,
                    },
                );
                releaseNiaInspection?.();
                const inspected = await firstInspection;
                await new Promise((resolve) => setTimeout(resolve, 50));
                const savePromptAfterInspection = document.querySelector(".popup-modal.open");
                if (/Save Character\?/i.test(savePromptAfterInspection?.textContent || "")) {
                    savePromptAfterInspection.querySelector("#confirmYesBtn")?.click();
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                document
                    .querySelector(".popup-modal.open[data-simple-notice-popup='1'] #noticeOkBtn")
                    ?.click();
                const npcAfterInspect = getNpcEntry("Nia Solen");
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(
                            getNpcEntry("Nia Solen")?.full_character,
                        );
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "NPC inspection gameplay path to finish its profile image",
                );
                const inspectedProfile = activeProfileImage(
                    npcAfterInspect?.full_character,
                );
                devAssert(!!inspected, "Inspect NPC returns a full inspected character", { inspected });
                devAssert(replacedNpcDuringInspection, "Inspect NPC smoke replaced the shell during slow inspection", { replacedNpcDuringInspection });
                devAssert(npcAfterInspect?.inspected === true, "Inspect NPC marks the NPC inspected after completion", { npc: npcAfterInspect });
                devAssert(!!npcAfterInspect?.full_character, "Inspect NPC stores full character data on the NPC", { npc: npcAfterInspect });
                devAssert(
                    npcAfterInspect?.id === smokeNpcId &&
                        npcAfterInspect?.full_character?.id === smokeNpcId &&
                        npcShellSaveOperation({
                            kind: "npc",
                            recordId: JSON.stringify(["market-lane", "Nia Solen"]),
                        }, npcAfterInspect).shell.inspected === true,
                    "inspection retains the NPC shell identity through full-character save projection",
                    { id: npcAfterInspect?.id, fullId: npcAfterInspect?.full_character?.id },
                );
                devAssert(
                    !!textSlot(npcAfterInspect?.full_character?.fallback_name, "") &&
                        exactOutfitList(
                            npcAfterInspect?.full_character?.fallback_outfits || [],
                        ).length > 0 &&
                        !!textSlot(
                            npcAfterInspect?.full_character?.fallback_starting_outfit_id,
                            "",
                        ),
                    "Inspect NPC repairs AI outfit labels into complete alternate presentation data before materialization",
                    { fullCharacter: npcAfterInspect?.full_character },
                );
                const alternateOutfit = npcAfterInspect?.full_character?.fallback_outfits?.[0];
                devAssert(
                    alternateOutfit?.name === "Scribe robes (alternate fit)" &&
                        alternateOutfit?.clothing?.shirt === "plain scribe robes" &&
                        alternateOutfit?.id === npcAfterInspect?.full_character?.fallback_starting_outfit_id,
                    "Inspect NPC retains wardrobe details and resolves the repaired alternate starting outfit id",
                    { alternateOutfit, character: npcAfterInspect?.full_character },
                );
                devAssert(
                    inspectedProfile?.pending === false &&
                        !inspectedProfile?.error &&
                        devLooksLikeRealImageHtml(inspectedProfile?.html),
                    "Inspect NPC production action finishes and stores the inspected character profile image",
                    { inspectedProfile },
                );
                devAssert(/Replacement record/.test(npcAfterInspect?.note || ""), "Inspect NPC preserves concurrent shell fields while adding full data", { npc: npcAfterInspect });
                devAssert(
                    app.messages.some(
                        (message) =>
                            message.role === "game" &&
                            /Nia Solen has been inspected/i.test(message.text || ""),
                    ),
                    "Inspect NPC adds a Game completion message",
                    app.messages.map((message) => ({
                        role: message.role,
                        text: message.text,
                    })),
                );
                devAssert(
                    !app.messages.some((message) =>
                        ["user", "command"].includes(message.role),
                    ),
                    "Inspect NPC does not add player or command story turns",
                    app.messages.map((message) => ({
                        role: message.role,
                        text: message.text,
                    })),
                );
                devAssert(
                    processQueueCalledAfterInspection,
                    "Inspect NPC resumes queued player messages after the direct inspection finishes",
                    { queueLength: app.queue.length },
                );
                app.state.npc_directory.locations["market-lane"].characters["Trunc Vale"] = {
                    name: "Trunc Vale",
                    gender: "female",
                    age: 29,
                    role: "dock guard",
                    relationship: "neutral",
                    inspected: false,
                    status: "alive",
                    note: "Watches the dock road.",
                };
                const truncatedInspectionPromise = inspectNpc("Trunc Vale");
                await devWaitFor(
                    () =>
                        /NPC Inspection Takes Time/i.test(
                            document.body.textContent || "",
                        ) &&
                        !!document.querySelector(".popup-modal #confirmYesBtn"),
                    1000,
                    "NPC inspection duration confirmation is shown again for the same profile",
                );
                document.querySelector(".popup-modal #confirmYesBtn")?.click();
                const truncatedInspection = await truncatedInspectionPromise;
                const truncAfterInspect = getNpcEntry("Trunc Vale");
                devAssert(
                    !!truncatedInspection &&
                        truncAfterInspect?.inspected === true &&
                        truncAfterInspect?.full_character?.role === "dock guard" &&
                        exactOutfitList(truncAfterInspect.full_character.fallback_outfits).some(
                            (outfit) => outfit.id === truncAfterInspect.full_character.fallback_starting_outfit_id,
                        ) &&
                        truncAfterInspect.full_character.image_prompt_config?.seed === 0,
                    "Inspect NPC recovers completed fields from truncated JSON and fills missing definition defaults",
                    { truncatedInspection, truncAfterInspect },
                );
                devAssert(
                    !activeUserProfile()?.npc_inspection_duration_notice_seen,
                    "NPC inspection duration confirmation is not stored as a one-time profile flag",
                    activeUserProfile(),
                );
            } finally {
                aiText = originalAiText;
                processQueue = originalProcessQueue;
                app.disableSmokeNpcInspectionAutoConfirm = false;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "Inspect NPC direct smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: inspect-npc-direct-smoke");
        }

        async function devRunNpcInspectInviteSmokeTest() {
            devTestLog("Scenario start: npc-inspect-invite-smoke");
            devResetForLiveTest("npc-inspect-invite-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: inviting an uninspected NPC first performs the
            // direct inspection step, then sends the invite as a normal player
            // story turn. Acceptance promotes the NPC to party and removes stale
            // nearby duplication while preserving the normal post-reply checks.
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "NPC Inspect Invite Smoke",
                    },
                },
                player: {
                    ...clone(defaultState.player || {}),
                    name: "Invite Tester",
                    age: 24,
                    gender: "male",
                    role: "party recruiter",
                },
                location: {
                    ...clone(defaultState.location || {}),
                    npc_location_id: "gate-plaza",
                    settlement_name: "Invite Town",
                    specific_place: "gate plaza",
                },
                scene: {
                    ...clone(defaultState.scene || {}),
                    summary: "Invite smoke plaza.",
                    party_members_present: [],
                    npcs_present: ["Real Import Small"],
                    image_characters: ["Player"],
                },
                npc_directory: {
                    locations: {
                        "gate-plaza": {
                            label: "gate plaza",
                            characters: {
                                "Real Import Small": {
                                    id: "real-import-small",
                                    name: "Real Import Small",
                                    gender: "female",
                                    age: 28,
                                    role: "scout",
                                    relationship: "neutral",
                                    inspected: false,
                                    status: "alive",
                                    note: "Watches the gate.",
                                },
                            },
                        },
                    },
                },
                objectives: {
                    active_id: "",
                    items: [],
                },
            });
            app.messages = [];
            app.queue = [];
            app.settings.autoVoice = false;
            app.settings.autoImages = false;
            app.settings.stateCheckMode = "groups";
            scheduleActiveGameSave();
            render();

            const originalAiText = aiText;
            const originalShowPrompt = showPrompt;
            const originalShowNotice = showNotice;
            const originalRunImmediateChecksForMutatedMessage =
                runImmediateChecksForMutatedMessage;
            const originalEnqueueStateSync = enqueueStateSync;
            const immediateChecks = [];
            const stateSyncReasons = [];
            const notices = [];
            const originalDisableSmokeNpcInspectionAutoConfirm =
                app.disableSmokeNpcInspectionAutoConfirm;
            const acceptNpcInspectionIfShown = async (label = "NPC inspection duration confirmation") => {
                await devWaitFor(
                    () =>
                        /NPC Inspection Takes Time/i.test(
                            document.body.textContent || "",
                        ) &&
                        !!document.querySelector(".popup-modal #confirmYesBtn"),
                    1000,
                    label,
                );
                document.querySelector(".popup-modal #confirmYesBtn")?.click();
            };
            try {
                app.disableSmokeNpcInspectionAutoConfirm = true;
                showPrompt = async () => "Please join my party and help scout the road.";
                showNotice = async (title, message, buttonText) => {
                    notices.push({ title, message, buttonText });
                    return true;
                };
                runImmediateChecksForMutatedMessage = async (message, opts = {}) => {
                    immediateChecks.push({
                        id: message?.id,
                        role: message?.role,
                        reason: opts.reason || "",
                    });
                    return true;
                };
                enqueueStateSync = (reason = "") => {
                    stateSyncReasons.push(reason);
                    app.stateSync.queued = true;
                    return true;
                };
                aiText = async (instruction, opts = {}) => {
                    const label = String(opts.label || "");
                    if (/npc inspection/i.test(label)) {
                        const character = blankCharacterTemplate("Real Import Small");
                        character.name = "Real Import Small";
                        character.age = 28;
                        character.gender = "female";
                        character.role = "gate scout";
                        character.personality_description =
                            "Alert, direct, and willing to travel for a good cause.";
                        character.relationship_to_player = "curious";
                        character.appearance.summary =
                            "Adult scout with a green cloak and a short spear.";
                        character.outfits = [
                            {
                                id: "gate-scout",
                                name: "Gate Scout",
                                clothing: {
                                    shirt: "plain travel shirt",
                                    coat: "green travel cloak",
                                    pants: "leather travel trousers",
                                    feet: "leather boots",
                                },
                            },
                        ];
                        character.starting_outfit_id = "gate-scout";
                        return prettyJson(character);
                    }
                    if (/character reply/i.test(label)) {
                        return 'Real Import Small studies him, then nods. "Fine. I will join you." [INVITE_ACCEPTED: Real Import Small]';
                    }
                    return "{}";
                };

                const invitePromise = inviteNpc("Real Import Small");
                await acceptNpcInspectionIfShown("NPC invite inspection duration confirmation");
                await invitePromise;
                await devWaitFor(
                    () =>
                        !!app.state.characters?.["Real Import Small"] &&
                        app.messages.some(
                            (message) =>
                                message.role === "assistant" &&
                                /I will join you/i.test(message.text || ""),
                        ),
                    4000,
                    "NPC invite acceptance to promote the inspected NPC",
                );
                await devWaitFor(
                    () => {
                        const image = activeProfileImage(
                            app.state.characters?.["Real Import Small"],
                        );
                        return (
                            image?.pending === false &&
                            !image?.error &&
                            devLooksLikeRealImageHtml(image?.html)
                        );
                    },
                    5000,
                    "NPC inspect-and-invite gameplay path to finish the party profile image",
                );

                const rinaNpc = getNpcEntry("Real Import Small");
                const userInvite = app.messages.find(
                    (message) =>
                        message.role === "user" &&
                        /Please join my party/i.test(message.text || ""),
                );
                const assistantInvite = app.messages.find(
                    (message) =>
                        message.role === "assistant" &&
                        message.replySource === "invite",
                );
                devAssert(
                    rinaNpc?.inspected === true &&
                        !!rinaNpc?.full_character &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /Real Import Small has been inspected/i.test(message.text || ""),
                        ),
                    "uninspected invite performs NPC inspection before sending invite",
                    { npc: rinaNpc, messages: app.messages },
                );
                devAssert(
                    !!userInvite &&
                        /Please join my party/i.test(userInvite.text || "") &&
                        !!assistantInvite &&
                        !/\[INVITE_ACCEPTED/i.test(assistantInvite.text || ""),
                    "invite is queued as a normal player story turn and acceptance marker is hidden",
                    { userInvite, assistantInvite },
                );
                devAssert(
                    !!app.state.characters?.["Real Import Small"] &&
                        (app.state.scene.party_members_present || []).includes("Real Import Small") &&
                        !(app.state.scene.npcs_present || []).includes("Real Import Small") &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /Real Import Small joined the party/i.test(message.text || ""),
                        ) &&
                        profileImagesForEntity(
                            app.state.characters?.["Real Import Small"],
                        ).length === 1 &&
                        devLooksLikeRealImageHtml(
                            activeProfileImage(
                                app.state.characters?.["Real Import Small"],
                            )?.html,
                        ),
                    "accepted invite promotes NPC to party, removes the nearby duplicate, and finishes exactly one profile image",
                    {
                        characters: app.state.characters,
                        scene: app.state.scene,
                        messages: app.messages,
                        profile: activeProfileImage(
                            app.state.characters?.["Real Import Small"],
                        ),
                    },
                );
                const promotedNpcCard = npcCardHtml("Real Import Small", rinaNpc, {
                    locationLabel: "gate plaza",
                });
                await inviteNpc("Real Import Small");
                devAssert(
                    !/Invite to party/i.test(promotedNpcCard) &&
                        notices.some((notice) => /Already In Party/i.test(notice.title || "")) &&
                        app.messages.some(
                            (message) =>
                                message.role === "game" &&
                                /Real Import Small is already in the party/i.test(message.text || ""),
                        ),
                    "same-name NPC shell after promotion does not show a stale invite button or silently no-op",
                    {
                        promotedNpcCard,
                        notices,
                        messages: app.messages,
                    },
                );
                devAssert(
                    immediateChecks.some(
                        (item) =>
                            item.role === "assistant" &&
                            item.reason === "assistant reply",
                    ) &&
                        stateSyncReasons.includes("assistant reply"),
                    "invite replies run the same immediate checks and state-sync enqueue as normal replies",
                    { immediateChecks, stateSyncReasons },
                );
            } finally {
                app.disableSmokeNpcInspectionAutoConfirm =
                    originalDisableSmokeNpcInspectionAutoConfirm;
                aiText = originalAiText;
                showPrompt = originalShowPrompt;
                showNotice = originalShowNotice;
                runImmediateChecksForMutatedMessage =
                    originalRunImmediateChecksForMutatedMessage;
                enqueueStateSync = originalEnqueueStateSync;
                app.busy = false;
                app.queue = [];
                app.stateSync.queued = false;
                app.stateSync.running = false;
            }

            addMessage("system", "NPC inspect invite smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: npc-inspect-invite-smoke");
        }

        async function devRunStoryTemplateMigrationSmokeTest() {
            devTestLog("Scenario start: template-migration-smoke");
            devResetForLiveTest("template-migration-smoke");
            devCreateTestProfile({  });
            const canonical = devSmokeTemplateRecord({
                id: "strict-objective-smoke-template",
                title: "Strict Objective Smoke",
            });
            const cases = [
                ["objective", "Legacy duplicate objective text."],
                ["steps", [{ id: "legacy-step", text: "Legacy step" }]],
                ["requires", ["legacy-objective"]],
            ];
            for (const [field, value] of cases) {
                const malformed = clone(canonical);
                malformed.state.objectives.items[0][field] = value;
                const validation = validateStoryDefinition(malformed);
                devAssert(
                    !validation.ok &&
                        validation.errors.some((error) =>
                            String(error.path || "").includes(field),
                        ),
                    `story imports reject obsolete objective field ${field}`,
                    validation,
                );
                let threw = false;
                try {
                    validatedStoryTemplateRecord(malformed);
                } catch (error) {
                    threw = String(error?.message || "").includes(field);
                }
                devAssert(
                    threw,
                    `the canonical story boundary rejects ${field} instead of migrating it`,
                );
            }
            const canonicalValidation = validateStoryDefinition(canonical);
            devAssert(
                !canonicalValidation.errors.some((error) =>
                    /^(title_card_image|editor_data\.story_tree\.output_modes|state\.objectives\.items\.0\.type)/.test(
                        String(error.path || ""),
                    ),
                ),
                "canonical title-card fields, optional editor output metadata, and story objective type pass strict validation",
                canonicalValidation,
            );
            for (const completionControl of ["choice", "reward_only"]) {
                const withoutCriteria = clone(canonical);
                const objective = withoutCriteria.state.objectives.items[0];
                objective.completion_control = completionControl;
                delete objective.completion_criteria;
                if (completionControl === "reward_only")
                    objective.requirement_check_only = true;
                else
                    delete objective.requirement_check_only;
                const withoutCriteriaValidation = validateStoryDefinition(withoutCriteria);
                devAssert(
                    !withoutCriteriaValidation.errors.some(
                        (error) =>
                            error.path === "state.objectives.items.0.completion_criteria",
                    ),
                    `${completionControl} objectives accept an omitted completion_criteria field`,
                    withoutCriteriaValidation,
                );

                objective.completion_criteria = "";
                const withCriteriaValidation = validateStoryDefinition(withoutCriteria);
                devAssert(
                    withCriteriaValidation.errors.some(
                        (error) =>
                            error.path === "state.objectives.items.0.completion_criteria" &&
                            error.code === "forbidden",
                    ),
                    `${completionControl} objectives reject the completion_criteria field instead of accepting an empty placeholder`,
                    withCriteriaValidation,
                );
            }
            for (const completionControl of ["player", "ai"]) {
                const missingCriteria = clone(canonical);
                const objective = missingCriteria.state.objectives.items[0];
                objective.completion_control = completionControl;
                delete objective.completion_criteria;
                const missingCriteriaValidation = validateStoryDefinition(missingCriteria);
                devAssert(
                    missingCriteriaValidation.errors.some(
                        (error) =>
                            error.path === "state.objectives.items.0.completion_criteria",
                    ),
                    `${completionControl} objectives still require non-empty completion_criteria text`,
                    missingCriteriaValidation,
                );
            }
            const invalidMainType = clone(canonical);
            invalidMainType.state.objectives.items[0].type = "main";
            const invalidMainTypeValidation = validateStoryDefinition(invalidMainType);
            devAssert(
                invalidMainTypeValidation.errors.some(
                    (error) =>
                        error.path === "state.objectives.items.0.type" &&
                        /story.*side/i.test(error.message || ""),
                ),
                "strict story validation rejects the obsolete main objective type",
                invalidMainTypeValidation,
            );
            const invalidTitleCardField = clone(canonical);
            invalidTitleCardField.title_card_image.negative_prompt = "obsolete alias";
            const invalidTitleCardValidation = validateStoryDefinition(
                invalidTitleCardField,
            );
            devAssert(
                invalidTitleCardValidation.errors.some(
                    (error) =>
                        error.path === "title_card_image.negative_prompt" &&
                        error.code === "unknown_field",
                ),
                "strict story validation rejects obsolete title-card field aliases",
                invalidTitleCardValidation,
            );
            const invalidOutputModes = clone(canonical);
            invalidOutputModes.editor_data = {
                story_tree: {
                    positions: {},
                    viewport: { x: 0, y: 0, zoom: 1 },
                },
            };
            invalidOutputModes.editor_data.story_tree.output_modes = [];
            const invalidOutputModesValidation = validateStoryDefinition(
                invalidOutputModes,
            );
            devAssert(
                invalidOutputModesValidation.errors.some(
                    (error) =>
                        error.path === "editor_data.story_tree.output_modes" &&
                        error.code === "type",
                ),
                "optional editor output metadata remains strictly typed when present",
                invalidOutputModesValidation,
            );
            addMessage("system", "Strict story objective rejection smoke test passed.");
            showNotice("Live Test Passed", "Strict story objective rejection smoke test passed.");
            devTestLog("Scenario complete: template-migration-smoke");
        }

        async function devRunImmutableDefinitionSmokeTest() {
            devTestLog("Scenario start: immutable-definition-smoke");
            devResetForLiveTest("immutable-definition-smoke");
            devCreateTestProfile({  });
            const definitionCharacter = {
                ...devSmokeCharacterDefinition("Nia Definition", {
                    gender: "female",
                    role: "definition tester",
                }),
                name: "Nia Definition",
                age: 29,
                gender: "female",
                role: "definition tester",
                personality_description: "Nia is a precise test character.",
                boldness: 6,
                starting_relationship_to_player: "new ally",
                starting_trust: 3,
                starting_attraction: 4,
                starting_affection: 2,
                starting_state_of_mind: "curious",
                starting_physical_state: "healthy",
                starting_pose: "checking her gear",
                appearance: {
                    ...devSmokeCharacterDefinition("Nia Definition").appearance,
                    species: "human",
                    height: 6,
                    upper_body_build: 8,
                    chest: 5,
                    midsection_build: 8,
                    hip_width: 10,
                    leg_length: 10,
                    arm_length: 10,
                },
                outfits: [
                    {
                        id: "unused",
                        name: "Unused",
                        clothing: {
                            shirt: "red unused shirt",
                            pants: "gray unused trousers",
                        },
                    },
                    {
                        id: "default",
                        name: "Default",
                        clothing: {
                            shirt: "blue travel shirt",
                            pants: "black trousers",
                            feet: "brown boots",
                        },
                    },
                ],
                starting_outfit_id: "default",
                starting_held_items: {
                    right_hand: "silver wand",
                    left_hand: null,
                },
                starting_inventory: ["Map case"],
                starting_known_facts: ["Nia knows the test route."],
                default_seed: 0,
                image_prompt_config: {
                    seed_enabled: true,
                    seed: 0,
                    style: "definition style",
                    profile_style: "",
                    negative: "",
                    negative_prompt: "",
                },
                default_profile_image: emptyProfileImageSlot(false),
                voice: {
                    gender_bucket: "non_male",
                    preferred_voice_name: "",
                },
                voice: null,
            };
            const runtime = materializeCharacterForRuntime(
                materializeCharacterDefinitionForRuntime(
                    definitionCharacter,
                    "Nia Definition",
                ),
                "Nia Definition",
            );
            devAssert(runtime.name === "Nia Definition", "definition name becomes runtime name", { runtime });
            devAssert(runtime.relationship_to_player === "new ally", "definition starting relationship becomes runtime relationship", { runtime });
            devAssert(runtime.state_of_mind === "curious" && runtime.physical_state === "healthy" && runtime.pose === "checking her gear", "definition starting mood/body/pose become runtime fields", { runtime });
            devAssert(runtime.inventory.includes("Map case") && runtime.known_facts.includes("Nia knows the test route.") && runtime.held_items.right_hand === "silver wand", "definition starting inventory/facts/held items become runtime fields", { runtime });
            devAssert(runtime.clothing.shirt === "blue travel shirt", "definition starting outfit becomes runtime clothing", { runtime });
            devAssert(runtime.image.seed === 0 && runtime.default_seed === 0 && runtime.image_prompt_config.seed === 0, "definition image defaults become runtime image config", { runtime });
            devAssert(!isPlainObject(runtime.voice), "definition voice metadata does not remain as runtime voice object", { runtime });

            const missingSeedValidation = validateCharacterDefinition({
                ...definitionCharacter,
                name: "Missing Seed Definition",
                default_seed: null,
                image_prompt_config: {
                    ...definitionCharacter.image_prompt_config,
                    seed: null,
                },
            });
            devAssert(
                !missingSeedValidation.ok &&
                    missingSeedValidation.errors.some((error) =>
                        /seed/i.test(String(error.path || error.message || "")),
                    ),
                "missing/null character definition seeds are rejected instead of repaired",
                missingSeedValidation,
            );

            const legacyStoryPayload = {
                app: "EmberAdventures",
                exportType: "story-definition",
                story_definition: {},
            };
            const legacyStoryValidation = validateStoryExport(legacyStoryPayload);
            devAssert(
                !legacyStoryValidation.ok &&
                    legacyStoryValidation.errors.some(
                        (error) => String(error.path || "").endsWith("story_definition"),
                    ),
                "obsolete story_definition wrappers are rejected instead of converted",
                legacyStoryValidation,
            );

            const definitionPlayer = {
                ...definitionCharacter,
                id: "definition-player",
                name: "Definition Player",
                starting_relationship_to_player: "self",
            };
            const vossDefinition = {
                ...definitionCharacter,
                id: "voss-definition",
                name: "Voss Definition",
                gender: "male",
                role: "test guard",
                voice: {
                    gender_bucket: "male",
                    preferred_voice_name: "",
                },
            };
            const futureDefinition = {
                ...definitionCharacter,
                id: "future-definition",
                name: "Future Definition",
            };
            const record = devSmokeTemplateRecord({lite: true,
                id: "definition-smoke-story",
                title: "Definition Smoke Story",
                description: "Definition smoke description.",
                state: {
                    player: definitionPlayer,
                    location: {
                        npc_location_id: "definition-hall",
                    },
                    characters: {
                        "Nia Definition": definitionCharacter,
                    },
                    npc_directory: {
                        locations: {
                            "definition-hall": {
                                label: "Definition Hall",
                                characters: {
                                    "Voss Definition": {
                                        name: "Voss Definition",
                                        gender: "male",
                                        age: 34,
                                        role: "test guard",
                                        relationship: "neutral",
                                        inspected: true,
                                        status: "alive",
                                        note: "Guards the definition hall.",
                                        full_character: vossDefinition,
                                    },
                                },
                            },
                        },
                    },
                    future_cast: {
                        enabled: true,
                        items: {
                            "future-definition": {
                                id: "future-definition",
                                name: "Future Definition",
                                status: "locked",
                                role: futureDefinition.role,
                                location_hint: "Definition Hall",
                                full_character: futureDefinition,
                            },
                        },
                    },
                },
            });
            record.state.objectives.items[0].summary = "Test the definition import.";
            assertValidStoryDefinition(record, "canonical definition materialization smoke");
            devAssert(
                    record.title === "Definition Smoke Story" &&
                    record.state.player.name === "Definition Player" &&
                    record.state.characters["Nia Definition"]?.starting_inventory?.includes("Map case") &&
                    record.state.npc_directory.locations["definition-hall"]?.characters?.["Voss Definition"]?.full_character?.role === "test guard" &&
                    record.state.future_cast.items["future-definition"]?.full_character?.name === "Future Definition" &&
                    record.state.objectives.items[0]?.summary === "Test the definition import.",
                "canonical story definitions materialize every character container",
                { record },
            );
            const definitionEntries = storyDefinitionCharacterEntries(record);
            const definitionClothingAudit = definitionEntries.map((entry) => ({
                path: entry.path,
                hasClothing: Object.hasOwn(entry.character, "clothing"),
            }));
            devTestLog(
                "Definition clothing audit",
                definitionClothingAudit,
            );
            devAssert(
                definitionEntries.length >= 4 &&
                    definitionEntries.every(
                        (entry) =>
                            !Object.hasOwn(entry.character, "clothing"),
                    ),
                "every story character container keeps clothing out of immutable definitions",
                {
                    entries: definitionClothingAudit,
                },
            );
            const runtimeState =
                materializeStoryDefinitionCharactersForRuntime(
                    clone(record.state),
                );
            const runtimeNpcCharacters =
                runtimeState.npc_directory.locations["definition-hall"];
            devAssert(
                runtimeState.player.clothing?.shirt === "blue travel shirt" &&
                    runtimeState.characters["Nia Definition"]?.clothing
                        ?.shirt === "blue travel shirt" &&
                    runtimeNpcCharacters.characters?.["Voss Definition"]
                        ?.full_character?.clothing?.shirt ===
                        "blue travel shirt",
                "fixed player, party, and both NPC-directory containers copy the selected outfit into runtime clothing",
                { runtimeState },
            );
            const arrayPlayer = {
                ...definitionCharacter,
                id: "array-player-definition",
                name: "Array Player Definition",
            };
            const arrayPlayerOption = storyTemplatePlayerOptions({
                players: [arrayPlayer],
            })[0];
            const arrayPlayerState =
                materializeStoryDefinitionCharactersForRuntime(
                    applySelectedStoryPlayerToState(
                        clone(record.state),
                        arrayPlayerOption,
                        record,
                    ),
                );
            const optionsPlayer = {
                ...definitionCharacter,
                id: "options-player-definition",
                name: "Options Player Definition",
            };
            const optionsPlayerOption = storyTemplatePlayerOptions({
                players: { options: [optionsPlayer] },
            })[0];
            const optionsPlayerState =
                materializeStoryDefinitionCharactersForRuntime(
                    applySelectedStoryPlayerToState(
                        clone(record.state),
                        optionsPlayerOption,
                        record,
                    ),
                );
            const mapPlayer = {
                ...definitionCharacter,
                id: "map-player-definition",
                name: "Map Player Definition",
            };
            const mapPlayerOption = storyTemplatePlayerOptions({
                players: {
                    "map-player-definition": mapPlayer,
                },
            })[0];
            const mapPlayerState =
                materializeStoryDefinitionCharactersForRuntime(
                    applySelectedStoryPlayerToState(
                        clone(record.state),
                        mapPlayerOption,
                        record,
                    ),
                );
            devAssert(
                !Object.hasOwn(arrayPlayerOption.character, "clothing") &&
                    !Object.hasOwn(optionsPlayerOption.character, "clothing") &&
                    !Object.hasOwn(mapPlayerOption.character, "clothing") &&
                    arrayPlayerState.player.clothing?.shirt ===
                        "blue travel shirt" &&
                    optionsPlayerState.player.clothing?.shirt ===
                        "blue travel shirt" &&
                    mapPlayerState.player.clothing?.shirt ===
                        "blue travel shirt",
                "array, options-array, and keyed-map player definitions stay definition-only until selection, then materialize runtime clothing",
                {
                    arrayPlayerOption,
                    optionsPlayerOption,
                    mapPlayerOption,
                },
            );
            const futureRuntime = futureCharacterFullCharacter(
                record.state.future_cast.items["future-definition"],
                "Future Definition",
                runtimeState,
            );
            devAssert(
                futureRuntime.clothing?.shirt === "blue travel shirt" &&
                    !Object.hasOwn(
                        record.state.future_cast.items["future-definition"]
                            .full_character,
                        "clothing",
                    ),
                "future-cast definitions remain clothing-free and materialize the selected outfit for introduction or promotion",
                { futureRuntime },
            );
            const emptyCurrentRelationshipEntry = clone(
                record.state.future_cast.items["future-definition"],
            );
            emptyCurrentRelationshipEntry.relationship = "not yet met";
            emptyCurrentRelationshipEntry.full_character.starting_relationship_to_player =
                "not yet met";
            emptyCurrentRelationshipEntry.full_character.relationship_to_player = "";
            const relationshipRuntime = futureCharacterFullCharacter(
                emptyCurrentRelationshipEntry,
                "Future Definition",
                runtimeState,
            );
            devAssert(
                relationshipRuntime.relationship_to_player === "not yet met",
                "future-cast runtime materialization preserves the authored shell relationship when the current relationship slot is empty",
                { relationshipRuntime },
            );
            const invalidDefinitionCharacter = {
                ...definitionCharacter,
                clothing: { shirt: "invalid definition shirt" },
            };
            const invalidCharacterClothingValidation =
                validateCharacterDefinition(invalidDefinitionCharacter);
            const invalidStoryClothing = clone(record);
            invalidStoryClothing.state.future_cast.items[
                "future-definition"
            ].full_character.clothing = {
                shirt: "invalid definition shirt",
            };
            const invalidStoryClothingValidation =
                validateStoryDefinition(invalidStoryClothing);
            devAssert(
                invalidCharacterClothingValidation.errors.some(
                    (error) => String(error.path || "").endsWith("clothing"),
                ) &&
                    !invalidStoryClothingValidation.ok &&
                    invalidStoryClothingValidation.errors.some(
                        (error) => String(error.path || "").endsWith("clothing"),
                    ),
                "character and story import validation reject definition-level clothing instead of repairing it",
                {
                    invalidCharacterClothingValidation,
                    invalidStoryClothingValidation,
                },
            );
            const promptProjection = playerAccessibleEntityForPrompt(record.state.characters["Nia Definition"] || {});
            devAssert(
                !("default_seed" in promptProjection) &&
                    !("image_prompt_config" in promptProjection) &&
                    !("default_profile_image" in promptProjection),
                "definition-only image/default metadata is hidden from ordinary prompt projections",
                { promptProjection },
            );
            let dirtyExportError = "";
            try {
                storyDefinitionForExport({
                    ...record,
                    lastPlayedAt: "2026-06-13T00:00:00.000Z",
                });
            } catch (error) {
                dirtyExportError = String(error?.message || error);
            }
            const exactExportStory = storyDefinitionForExport(record);
            devAssert(
                /lastPlayedAt.*not an approved field/i.test(dirtyExportError) &&
                    exactExportStory.id === record.id &&
                    exactExportStory.title === record.title,
                "story definition export rejects unapproved runtime metadata and preserves exact valid definitions",
                { dirtyExportError, exactExportStory },
            );
            let dirtyCharacterError = "";
            const standaloneDefinitionCharacter = {
                ...definitionCharacter,
                genres: ["fantasy"],
            };
            try {
                characterDefinitionProjectionForExport({
                    ...standaloneDefinitionCharacter,
                    clothing: { shirt: "runtime shirt" },
                });
            } catch (error) {
                dirtyCharacterError = String(error?.message || error);
            }
            const exactExportCharacter =
                characterDefinitionProjectionForExport(standaloneDefinitionCharacter);
            devAssert(
                /clothing.*not an approved field/i.test(dirtyCharacterError) &&
                    exactExportCharacter.starting_relationship_to_player === "new ally" &&
                    exactExportCharacter.starting_outfit_id === "default",
                "character definition export rejects runtime fields and preserves exact valid definitions",
                { dirtyCharacterError, exactExportCharacter },
            );
            devUpsertStoryTemplatesForSmoke([record]);
            addMessage("system", "Immutable definition smoke test passed.");
            showNotice("Live Test Passed", "Immutable definition smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: immutable-definition-smoke");
        }

        async function devRunLargeObjectiveRuntimeSmokeTest() {
            devTestLog("Scenario start: large-objective-runtime-smoke");
            devResetForLiveTest("large-objective-runtime-smoke");
            await setDevSmokeScenarioProgress("Building 2,000-objective fixture");
            const objectiveCount = 2000;
            const items = Array.from({ length: objectiveCount }, (_, index) => ({
                id: `large-objective-${index}`,
                title: `Large Objective ${index}`,
                type: "story",
                summary: `Synthetic objective ${index}.`,
                while_active_guidance:
                    `Keep the synthetic large-objective smoke focused on objective ${index}.`,
                completion_control: "player",
                completion_criteria: `Complete synthetic objective ${index}.`,
                status: index === 0 ? "active" : "hidden",
                next_objectives:
                    index < objectiveCount - 1
                        ? [{
                              id: `large-output-${index}`,
                              objective_id: `large-objective-${index + 1}`,
                              target_input_group_id: `large-input-${index + 1}`,
                              requirements: [],
                              fallback: true,
                              completion_instruction: `Advance past synthetic objective ${index}.`,
                              rewards: [],
                          }]
                        : [{
                              id: `large-objective-${index}-ending`,
                              completion_instruction: `Complete synthetic objective ${index}.`,
                              rewards: [],
                              ending_type: "freeplay",
                              ending_message: "The synthetic large-objective test is complete.",
                          }],
                rewards: [],
            }));
            app.state = clone(defaultState);
            app.state.meta = {
                ...clone(defaultState.meta || {}),
                setup_complete: true,
                story_source: { mode: "original", title: "Synthetic Large Objective Smoke" },
            };
            app.state.objectives = {
                active_id: items[0].id,
                no_current: false,
                items,
            };
            app.runtimeDefinitions = { jobsById: {}, charactersById: {}, locationsById: {} };
            const validationTemplate = devSmokeTemplateRecord({
                id: "large-objective-runtime-smoke",
                title: "Large Objective Runtime Smoke",
            });
            validationTemplate.state.objectives = app.state.objectives;
            await setDevSmokeScenarioProgress("Validating 2,000-objective graph in worker");
            await compileStoryTemplateValidationArtifact(validationTemplate);
            const validatedObjectiveGraph =
                assertValidatedStoryDefinitionArtifact(
                    validationTemplate,
                    "large objective smoke",
                );
            devAssert(
                validatedObjectiveGraph?.objectiveOrder?.length === objectiveCount &&
                    Object.keys(
                        validatedObjectiveGraph?.objectiveDependentsById || {},
                    ).length === objectiveCount - 1,
                "large objective import validation compiles a linear dependency index",
                {
                    objectiveCount:
                        validatedObjectiveGraph?.objectiveOrder?.length || 0,
                    dependencyCount: Object.keys(
                        validatedObjectiveGraph?.objectiveDependentsById || {},
                    ).length,
                },
            );
            await setDevSmokeScenarioProgress("Starting objective-definition worker");
            const workerProgress = [];
            const compiledDefinition = await compileStoryDefinitionRuntimeInWorker(app.state, {
                validatedObjectiveGraph,
                onProgress: (message) => {
                    workerProgress.push(String(message || ""));
                    devTestLog("Large objective worker progress", { message });
                    const suite = devSmokeSuiteState();
                    suite.currentScenarioProgress = String(message || "Building objectives");
                    renderDevSmokeSuiteStatus();
                },
            });
            adoptWorkerCompiledStoryDefinition(compiledDefinition, app.state);
            const initialObjectiveLookup = objectiveRuntimeLookup(app.state);
            setObjectiveRuntimeStatus(app.state, items[0], "active");
            devAssert(
                app.objectiveRuntimeLookup === initialObjectiveLookup &&
                    initialObjectiveLookup.completedIds.size === 0 &&
                    Object.keys(app.objectiveRuntime.statusById || {}).length === 0,
                "an unchanged objective status keeps the large-graph lookup and sparse runtime unchanged",
                {
                    lookupPreserved:
                        app.objectiveRuntimeLookup === initialObjectiveLookup,
                    completedCount: initialObjectiveLookup.completedIds.size,
                    runtimeOverrides: app.objectiveRuntime.statusById,
                },
            );
            devAssert(
                workerProgress.filter((message) =>
                    new RegExp(`^(Materializing validated objective definition|Building sparse objective runtime)\\s+\\d+\\/${objectiveCount}$`).test(message),
                ).length === (objectiveCount / 100) * 2 &&
                    workerProgress.includes(
                        `Materializing validated objective definition ${objectiveCount}/${objectiveCount}`,
                    ) &&
                    workerProgress.includes(`Building sparse objective runtime ${objectiveCount}/${objectiveCount}`) &&
                    !workerProgress.some((message) =>
                        /^(Building objective dependency map|Normalizing objective runtime)/.test(
                            message,
                        ),
                    ),
                "large objective startup uses the validated graph and reports only definition materialization plus sparse runtime work",
                { workerProgressCount: workerProgress.length, workerProgress },
            );
            await setDevSmokeScenarioProgress("Checking detached runtime seed");
            const seedPlayerRecord = app.storyDefinition.initialRuntimeTemplate.records.find(
                (row) => row.kind === "player" && row.recordId === "current",
            );
            devAssert(
                Object.keys(app.storyDefinition.objectivesById || {}).length === objectiveCount &&
                    Object.keys(app.storyDefinition.objectiveDependentsById || {}).length === objectiveCount - 1 &&
                    Object.keys(app.objectiveRuntime.statusById || {}).length === 0,
                "2,000 authored objectives remain immutable while runtime status overrides start sparse",
                {
                    authoredCount: Object.keys(app.storyDefinition.objectivesById || {}).length,
                    dependentRoots: Object.keys(app.storyDefinition.objectiveDependentsById || {}).length,
                    runtimeOverrideCount: Object.keys(app.objectiveRuntime.statusById || {}).length,
                },
            );
            const persistedRuntimeRows = materializeRuntimeRecordRows(
                allRuntimeRecordDescriptors(app.state),
                app.state,
            );
            const persistedObjectiveRuntime = persistedRuntimeRows.find(
                (row) => row.kind === "objective-runtime" && row.recordId === "current",
            );
            devAssert(
                !persistedRuntimeRows.some(
                    (row) => row.kind === "state-root" && row.recordId === "objectives",
                ) &&
                    !Array.isArray(persistedObjectiveRuntime?.value?.items) &&
                    !Object.prototype.hasOwnProperty.call(
                        persistedObjectiveRuntime?.value || {},
                        "objectivesById",
                    ),
                "active-save runtime rows persist sparse objective state, not the authored objective tree",
                {
                    objectiveRuntimeKeys: Object.keys(persistedObjectiveRuntime?.value || {}),
                    persistedRowKinds: persistedRuntimeRows.map((row) => row.kind),
                },
            );
            const originalSeedPlayerName = seedPlayerRecord?.value?.name || "";
            const originalRuntimePlayerName = app.state.player.name;
            app.state.player.name = "Mutated Runtime Player";
            devAssert(
                originalSeedPlayerName === originalRuntimePlayerName &&
                    seedPlayerRecord?.value?.name === originalRuntimePlayerName &&
                    seedPlayerRecord?.value !== app.state.player,
                "initial runtime seed is deeply detached from mutable runtime state",
                { seedPlayerRecord, runtimePlayer: app.state.player },
            );
            app.state.player.name = originalRuntimePlayerName;
            app.performanceMetrics ||= {};
            app.performanceMetrics.objectiveDependencyVisits = 0;
            app.performanceMetrics.objectiveFullNormalizationVisits = 0;
            runtimeAggregateDirtyTracker.records.clear();
            await setDevSmokeScenarioProgress("Completing first objective and checking sparse updates");
            const transaction = beginObjectiveMutationTransaction(app.state, "large objective completion");
            const completed = completeCurrentObjective(app.state, items[0].id);
            finishObjectiveMutationTransaction(transaction, true);
            const dirtyKeys = [...runtimeAggregateDirtyTracker.records.keys()];
            const transitionDiagnostic = app.lastObjectiveTransitionDiagnostic;
            devTestLog("Large objective completion result", {
                completedId: completed?.id || "",
                completedStatus: effectiveObjectiveStatus(items[0], app.state),
                nextStatus: effectiveObjectiveStatus(items[1], app.state),
                dependencyVisits: app.performanceMetrics.objectiveDependencyVisits,
                fullVisits: app.performanceMetrics.objectiveFullNormalizationVisits,
                runtimeOverrideCount: Object.keys(
                    app.objectiveRuntime.statusById || {},
                ).length,
                lookupPreserved:
                    app.objectiveRuntimeLookup === initialObjectiveLookup,
                completedCached:
                    initialObjectiveLookup.completedIds.has(items[0].id),
                dirtyKeys,
                transitionDiagnostic,
            });
            devAssert(
                completed?.id === items[0].id &&
                    effectiveObjectiveStatus(items[0], app.state) === "complete" &&
                    effectiveObjectiveStatus(items[1], app.state) === "active" &&
                    Number(app.performanceMetrics.objectiveDependencyVisits || 0) < 20 &&
                    Number(app.performanceMetrics.objectiveFullNormalizationVisits || 0) === 0 &&
                    Object.keys(app.objectiveRuntime.statusById || {}).length <= 2 &&
                    app.objectiveRuntimeLookup === initialObjectiveLookup &&
                    initialObjectiveLookup.completedIds.has(items[0].id) &&
                    dirtyKeys.includes(runtimeDirtyKey("objective-runtime", "current")),
                "one completion in a 2,000-objective story updates only affected dependency entries and one sparse runtime aggregate",
                {
                    dependencyVisits: app.performanceMetrics.objectiveDependencyVisits,
                    fullVisits: app.performanceMetrics.objectiveFullNormalizationVisits,
                    overrides: app.objectiveRuntime.statusById,
                    dirtyKeys,
                },
            );
            devAssert(
                transitionDiagnostic?.objectiveId === items[0].id &&
                    transitionDiagnostic?.selectedStandardTargetId ===
                        items[1].id &&
                    transitionDiagnostic?.conditionalNextId === items[1].id &&
                    transitionDiagnostic?.finalActiveId === items[1].id &&
                    transitionDiagnostic?.transitions?.[0]
                        ?.targetInStateItems === true &&
                    transitionDiagnostic?.transitions?.[0]
                        ?.targetInRuntimeLookup === true &&
                    transitionDiagnostic?.transitions?.[0]
                        ?.prerequisitesMet === true,
                "objective completion diagnostics identify the authored transition in both runtime views and its final activation",
                { transitionDiagnostic },
            );
            let mutationFailed = false;
            try {
                app.storyDefinition.objectivesById[items[0].id].title = "Mutated";
            } catch {
                mutationFailed = true;
            }
            devAssert(
                mutationFailed || app.storyDefinition.objectivesById[items[0].id].title !== "Mutated",
                "authored objective definitions reject gameplay mutation",
            );
            let bulkMutationRejected = false;
            try {
                syncObjectiveRuntimeFromMutationPath(
                    ["objectives", "items"],
                    { op: "set" },
                );
            }
            catch (error) {
                bulkMutationRejected =
                    /unsupported bulk objective mutation/i.test(
                        String(error?.message || error),
                    );
            }
            devAssert(
                bulkMutationRejected &&
                    app.objectiveRuntimeNeedsFullSync === false,
                "bulk objective-definition mutation is rejected instead of triggering a full-tree repair scan",
                {
                    bulkMutationRejected,
                    objectiveRuntimeNeedsFullSync:
                        app.objectiveRuntimeNeedsFullSync,
                },
            );
            await setDevSmokeScenarioProgress("Preparing large objective UI");
            addMessage("system", "Large objective runtime smoke test passed.");
            const lookupBeforeSaveSchedule = objectiveRuntimeLookup(app.state);
            scheduleActiveGameSave();
            devAssert(
                app.objectiveRuntimeLookup === lookupBeforeSaveSchedule,
                "scheduling an unrelated save keeps the large objective lookup cached",
            );
            await setDevSmokeScenarioProgress("Rendering large objective UI");
            render();
            await setDevSmokeScenarioProgress("Large objective UI rendered");
            devTestLog("Scenario complete: large-objective-runtime-smoke");
        }

        async function devRunStoryTemplateImportExportSmokeTest() {
            devTestLog("Scenario start: story-template-import-export-smoke");
            devResetForLiveTest("story-template-import-export-smoke");
            devCreateTestProfile({  });
            // Smoke invariant: Upload Story Templates supports multiple files.
            // Each valid payload becomes an independent story template record,
            // and export continues to emit the public story-template wrapper.
            const smokeTemplateId = (title) =>
                objectiveIdFromTitle(title, "story-template-smoke");
            const makeTemplatePayload = (title) => ({
                app: "EmberAdventures",
                exportType: "story-template",
                exportedAt: new Date().toISOString(),
                storyTemplate: devSmokeStoryRecord({
                    id: smokeTemplateId(title),
                    title,
                    description: `${title} description`,
                }),
            });

            const payloads = [
                makeTemplatePayload("First Upload Smoke"),
                makeTemplatePayload("Second Upload Smoke"),
            ];
            const missingOutfitClassification = clone(
                payloads[0].storyTemplate.state.player,
            );
            const missingOutfitClassificationValidation =
                validateCharacterDefinition(missingOutfitClassification);
            const missingObjectiveIdPayload = clone(payloads[0]);
            delete missingObjectiveIdPayload.storyTemplate.state.objectives.items[0].id;
            const missingDependencyPayload = clone(payloads[0]);
            const missingDependencyObjective =
                missingDependencyPayload.storyTemplate.state.objectives.items[0];
            missingDependencyObjective.next_objectives = [
                {
                    id: "missing-dependency-output",
                    objective_id: "missing-objective",
                    target_input_group_id: "missing-objective-input",
                    completion_instruction: "Continue to the deliberately missing objective.",
                    requirements: [],
                    rewards: [],
                },
            ];
            const activeBeforePrerequisitePayload = clone(payloads[0]);
            const activeBeforePrerequisiteId =
                activeBeforePrerequisitePayload.storyTemplate.state.objectives.items[0].id;
            const activeBeforePrerequisiteOwner =
                activeBeforePrerequisitePayload.storyTemplate.state.objectives.items[0];
            activeBeforePrerequisiteOwner.next_objectives = [
                {
                    id: `${activeBeforePrerequisiteId}-output`,
                    objective_id: `${activeBeforePrerequisiteId}-blocked`,
                    target_input_group_id: `${activeBeforePrerequisiteId}-blocked-input`,
                    completion_instruction: "Continue to the deliberately blocked objective.",
                    requirements: [],
                    rewards: [],
                },
            ];
            activeBeforePrerequisitePayload.storyTemplate.state.objectives.items.push({
                id: `${activeBeforePrerequisiteId}-blocked`,
                title: "Blocked Active Objective",
                type: "story",
                status: "hidden",
                summary: "This invalid objective starts before its prerequisite.",
                while_active_guidance:
                    "Keep the fake malformed-graph scene focused on its blocked objective.",
                completion_control: "player",
                completion_criteria: "Never reached.",
                next_objectives: [{
                    id: `${activeBeforePrerequisiteId}-blocked-ending`,
                    completion_instruction: "Never reach this objective.",
                    rewards: [],
                    ending_type: "freeplay",
                    ending_message: "The malformed active-before-input fixture ends here.",
                }],
            });
            activeBeforePrerequisitePayload.storyTemplate.state.objectives.active_id =
                `${activeBeforePrerequisiteId}-blocked`;
            const cyclicPayload = clone(payloads[0]);
            cyclicPayload.storyTemplate.id = "cyclic-objective-smoke";
            cyclicPayload.storyTemplate.title = "Cyclic Objective Smoke";
            cyclicPayload.storyTemplate.state.objectives = {
                active_id: "cycle-a",
                no_current: false,
                items: [
                    {
                        id: "cycle-a",
                        title: "Cycle A",
                        type: "story",
                        status: "active",
                        summary: "First cycle node.",
                        while_active_guidance:
                            "Keep the fake cycle scene focused on cycle A.",
                        completion_control: "player",
                        completion_criteria: "Complete cycle A.",
                        next_objectives: [
                            {
                                id: "cycle-a-output",
                                objective_id: "cycle-b",
                                target_input_group_id: "cycle-b-input",
                                completion_instruction: "Continue from cycle A to cycle B.",
                                requirements: [],
                                rewards: [],
                            },
                        ],
                        rewards: [],
                    },
                    {
                        id: "cycle-b",
                        title: "Cycle B",
                        type: "story",
                        status: "hidden",
                        summary: "Second cycle node.",
                        while_active_guidance:
                            "Keep the fake cycle scene focused on cycle B.",
                        completion_control: "player",
                        completion_criteria: "Complete cycle B.",
                        next_objectives: [
                            {
                                id: "cycle-b-output",
                                objective_id: "cycle-a",
                                target_input_group_id: "cycle-a-input",
                                completion_instruction: "Continue from cycle B to cycle A.",
                                requirements: [],
                                rewards: [],
                            },
                        ],
                        rewards: [],
                    },
                ],
            };
            const terminalOutcomePayload = clone(payloads[0]);
            terminalOutcomePayload.storyTemplate.id = "terminal-outcome-route-smoke";
            terminalOutcomePayload.storyTemplate.title = "Terminal Outcome Route Smoke";
            terminalOutcomePayload.storyTemplate.state.objectives.items[0] = {
                id: "terminal-outcome-owner",
                title: "Resolve an Optional Request",
                type: "story",
                status: "active",
                summary: "Respond to an optional request.",
                while_active_guidance:
                    "Keep the fake terminal-route scene focused on resolving the request.",
                completion_control: "ai",
                completion_criteria: "Return yes after the player responds.",
                route_control: "ai",
                next_objectives: [],
                rewards: [],
                outcome_routes: [
                    {
                        id: "terminal-outcome-refusal",
                        criteria: "Use when the player refuses the request.",
                        requirements: [],
                        rewards: [],
                        ending_type: "ending",
                        fallback: true,
                        completion_instruction: "Respect the player's refusal.",
                    },
                ],
            };
            terminalOutcomePayload.storyTemplate.state.objectives.active_id =
                "terminal-outcome-owner";
            const missingOutcomeDestinationPayload = clone(terminalOutcomePayload);
            missingOutcomeDestinationPayload.storyTemplate.id =
                "missing-outcome-destination-smoke";
            missingOutcomeDestinationPayload.storyTemplate.title =
                "Missing Outcome Destination Smoke";
            delete missingOutcomeDestinationPayload.storyTemplate.state.objectives.items[0]
                .outcome_routes[0].ending_type;
            const sharedImplicitChoicePayload = clone(payloads[0]);
            sharedImplicitChoicePayload.storyTemplate.id = "shared-implicit-choice-smoke";
            sharedImplicitChoicePayload.storyTemplate.title = "Shared Implicit Choice Smoke";
            sharedImplicitChoicePayload.storyTemplate.state.objectives = {
                active_id: "shared-choice-owner",
                no_current: false,
                items: [
                    {
                        id: "shared-choice-owner",
                        title: "Choose a Shared Route",
                        type: "story",
                        status: "active",
                        summary: "Choose one result before continuing.",
                        while_active_guidance:
                            "Keep the fake shared-transition scene focused on the choice.",
                        completion_control: "choice",
                        choices: [
                            {
                                id: "shared-choice-first",
                                title: "Choose the first result",
                                summary: "Apply the first result.",
                                rewards: [],
                                next_objective_id: "shared-choice-successor",
                                target_input_group_id: "shared-choice-first-input",
                                completion_instruction: "Continue after the first result.",
                            },
                            {
                                id: "shared-choice-second",
                                title: "Choose the second result",
                                summary: "Apply the second result.",
                                rewards: [],
                                next_objective_id: "shared-choice-successor",
                                target_input_group_id: "shared-choice-second-input",
                                completion_instruction: "Continue after the second result.",
                            },
                        ],
                        next_objectives: [],
                        rewards: [],
                    },
                    {
                        id: "shared-choice-successor",
                        title: "Continue After the Choice",
                        type: "story",
                        status: "hidden",
                        summary: "Continue after either choice.",
                        while_active_guidance:
                            "Continue the fake shared-transition scene after the choice.",
                        completion_control: "player",
                        completion_criteria: "Continue the scene.",
                        next_objectives: [{
                            id: "shared-choice-successor-ending",
                            completion_instruction: "Continue the scene.",
                            rewards: [],
                            ending_type: "freeplay",
                            ending_message: "The shared route continues in freeplay.",
                        }],
                    },
                ],
            };
            let missingArtifactError = "";
            try {
                assertValidatedStoryDefinitionArtifact(
                    payloads[0].storyTemplate,
                    "smoke uncompiled story",
                );
            }
            catch (error) {
                missingArtifactError = String(error?.message || error);
            }
            devAssert(
                /requires a validated compiled story definition/i.test(
                    missingArtifactError,
                ),
                "story start rejects definitions that did not pass the import or editor compilation boundary",
                { missingArtifactError },
            );
            const hydratedValidStory = clone(payloads[0].storyTemplate);
            await validateHydratedStoryTemplateRecords([hydratedValidStory], {
                persist: false,
            });
            devAssert(
                !!assertValidatedStoryDefinitionArtifact(
                    hydratedValidStory,
                    "smoke hydrated story",
                ),
                "startup compiles and validates a valid stored story that is missing its compiled artifact",
            );
            const hydratedInvalidStory = clone(missingObjectiveIdPayload.storyTemplate);
            let hydratedValidationError = "";
            try {
                await validateHydratedStoryTemplateRecords([hydratedInvalidStory], {
                    persist: false,
                });
            }
            catch (error) {
                hydratedValidationError = String(error?.message || error);
            }
            devAssert(
                !!hydratedValidationError &&
                    !/requires a validated compiled story definition/i.test(
                        hydratedValidationError,
                    ),
                "startup reports the strict validation error for an invalid stored story instead of reporting only a missing artifact",
                { hydratedValidationError },
            );
            const strictBoundaryPrepared = await storyImportWorkerRequest(
                "prepare-story-import-payload",
                {
                    payloads: [
                        missingObjectiveIdPayload,
                        missingDependencyPayload,
                        activeBeforePrerequisitePayload,
                        cyclicPayload,
                        terminalOutcomePayload,
                        missingOutcomeDestinationPayload,
                        sharedImplicitChoicePayload,
                    ],
                },
            );
            const strictBoundaryErrors = strictBoundaryPrepared
                .map((item) => item?.error)
                .filter(Boolean);
            const cyclicCandidate = strictBoundaryPrepared.find(
                (item) => item?.record?.id === "cyclic-objective-smoke",
            )?.record;
            const terminalOutcomeCandidate = strictBoundaryPrepared.find(
                (item) => item?.record?.id === "terminal-outcome-route-smoke",
            )?.record;
            const sharedImplicitChoiceCandidate = strictBoundaryPrepared.find(
                (item) => item?.record?.id === "shared-implicit-choice-smoke",
            )?.record;
            devAssert(
                strictBoundaryErrors.length === 4 &&
                    !!cyclicCandidate?.token &&
                    !!terminalOutcomeCandidate?.token &&
                    !!sharedImplicitChoiceCandidate?.token,
                `story import rejects malformed objective graphs without repairing them while allowing authored cycles, terminal routes, and a single shared implicit successor (errors=${strictBoundaryErrors.length}, records=${strictBoundaryPrepared.map((item) => item?.record?.id || `ERROR:${item?.error || "unknown"}`).join(" | ")})`,
                { strictBoundaryPrepared },
            );
            const strictBoundaryCandidateTokens = [
                cyclicCandidate?.token,
                terminalOutcomeCandidate?.token,
                sharedImplicitChoiceCandidate?.token,
            ].filter(Boolean);
            if (strictBoundaryCandidateTokens.length)
                await storyImportWorkerRequest("discard-story-import", {
                    tokens: strictBoundaryCandidateTokens,
                });
            const workerImportFiles = payloads.map(
                (payload, index) =>
                    new File(
                        [JSON.stringify(payload)],
                        `story-import-worker-${index + 1}.json`,
                        { type: "application/json" },
                    ),
            );
            workerImportFiles.push(
                new File(["{not valid json"], "story-import-worker-invalid.json", {
                    type: "application/json",
                }),
            );
            const workerPrepared = await storyImportWorkerRequest(
                "prepare-story-import",
                { files: workerImportFiles },
            );
            const workerCandidates = workerPrepared.map((item) => item?.record).filter(Boolean);
            const workerFailures = workerPrepared.map((item) => item?.error).filter(Boolean);
            devAssert(
                workerCandidates.length === 2 && workerFailures.length === 1,
                "story import worker accepts valid files and isolates malformed-file failures",
                { workerPrepared },
            );
            const discardedCandidate = workerCandidates.pop();
            await storyImportWorkerRequest("discard-story-import", {
                tokens: [discardedCandidate.token],
            });
            const discardedResult = await storyImportWorkerRequest(
                "commit-story-import",
                { items: [{ token: discardedCandidate.token }] },
            );
            devAssert(
                discardedResult.length === 0,
                "discarded story-import worker jobs cannot write a library record",
                { discardedResult },
            );
            const workerImported = await storyImportWorkerRequest(
                "commit-story-import",
                {
                    items: workerCandidates.map((candidate) => ({
                        token: candidate.token,
                        creator_identity: createCreatorIdentityRecord({
                            creator_id: "smoke-story-import-worker",
                            creator_name: "Smoke Story Import Worker",
                        }),
                    })),
                },
            );
            const workerImportedGraph = workerImported[0]
                ? assertValidatedStoryDefinitionArtifact(
                      workerImported[0],
                      "committed smoke story import",
                  )
                : null;
            devAssert(
                workerImported.length === 1 &&
                    definitionCreatorId(workerImported[0]) === "smoke-story-import-worker" &&
                    !Object.hasOwn(workerImported[0] || {}, "creator_id") &&
                    !Object.hasOwn(workerImported[0] || {}, "creator") &&
                    workerImportedGraph?.objectiveOrder?.length === 1,
                "story import worker stores creator ownership outside the exact story definition, compiles the validated graph, and persists only committed records",
                { workerImported },
            );
            await deletePerRecordLibraryRecords(
                STORY_TEMPLATE_KEY,
                workerImported.map((record) => ({ id: record.id })),
            );
            payloads[1].storyTemplate.state.characters ||= {};

            const imported = payloads.map(storyTemplateRecordFromPayload);
            devUpsertStoryTemplatesForSmoke(imported);
            const importedTitles = new Set(imported.map((template) => template.title));
            const smokeImportedTemplates = (app.storyTemplates || []).filter((template) =>
                importedTitles.has(template.title),
            );
            devAssert(
                smokeImportedTemplates.length === 2 &&
                    smokeImportedTemplates.some(
                        (template) => template.title === "First Upload Smoke",
                    ) &&
                    smokeImportedTemplates.some(
                        (template) => template.title === "Second Upload Smoke",
                    ),
                "multiple uploaded story-template payloads are imported as separate templates",
                smokeImportedTemplates,
            );
            devAssert(
                smokeImportedTemplates.every((template) =>
                    (template.state?.objectives?.items || []).every(
                        (objective) =>
                            !("objective" in objective) &&
                            !Array.isArray(objective.steps),
                    ),
                ),
                "imported story templates normalize to current summary-only objective schema",
                smokeImportedTemplates.map((template) => template.state?.objectives),
            );
            const importedSecond = smokeImportedTemplates.find(
                (template) => template.title === "Second Upload Smoke",
            );
            const exportedSecond = storyDefinitionForExport(importedSecond);

            const originalCreateElement = document.createElement.bind(document);
            const originalCreateObjectUrl = URL.createObjectURL;
            const exportClicks = [];
            try {
                URL.createObjectURL = () => "blob:story-template-smoke";
                document.createElement = (tagName, ...args) => {
                    const element = originalCreateElement(tagName, ...args);
                    if (String(tagName || "").toLowerCase() === "a") {
                        element.click = () => {
                            exportClicks.push({
                                href: element.href,
                                download: element.download,
                            });
                        };
                    }
                    return element;
                };
                exportStoryTemplate(imported[0].id);
            } finally {
                document.createElement = originalCreateElement;
                URL.createObjectURL = originalCreateObjectUrl;
            }
            devAssert(
                exportClicks.length === 1 &&
                    /First-Upload-Smoke\.json/i.test(exportClicks[0].download || ""),
                "story-template export still creates a downloadable JSON file",
                exportClicks,
            );

            addMessage("system", "Story template import/export smoke test passed.");
            showNotice(
                "Live Test Passed",
                "Story template import/export smoke test passed.",
            );
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: story-template-import-export-smoke");
        }

        async function devRunCanonicalStoryStatePreservationSmokeTest() {
            devTestLog("Scenario start: canonical-story-state-preservation-smoke");
            const characterNames = Array.from(
                { length: 20 },
                (_, index) => `Canonical Party ${index + 1}`,
            );
            const npcNames = Array.from(
                { length: 20 },
                (_, index) => `Canonical NPC ${index + 1}`,
            );
            const mapLocationIds = Array.from(
                { length: 35 },
                (_, index) => `canonical-location-${index + 1}`,
            );
            const longMemoryEntries = Array.from({ length: 12 }, (_, index) =>
                `Canonical memory ${index + 1}: ${"preserved authored detail ".repeat(12)}`.trim(),
            );
            const objectiveRewards = Array.from({ length: 35 }, (_, index) => ({
                type: "add_item",
                item: `Canonical reward ${index + 1}`,
            }));
            const choiceEffects = Array.from(
                { length: 12 },
                (_, index) => `canonical-effect-${index + 1}`,
            );
            const choiceRequirements = Array.from({ length: 12 }, (_, index) => ({
                path: `world_flags.canonical_${index + 1}`,
                op: "truthy",
                value: true,
            }));
            const objectiveChoices = Array.from({ length: 12 }, (_, index) => ({
                id: `canonical-choice-${index + 1}`,
                title: `Canonical Choice ${index + 1}`,
                summary: `Preserve canonical choice ${index + 1}.`,
                rewards: objectiveRewards,
                effects: choiceEffects,
                requirements: choiceRequirements,
                requires: choiceEffects,
            }));
            const objectives = Array.from({ length: 130 }, (_, index) => ({
                id: `canonical-objective-${index + 1}`,
                title: `Canonical Objective ${index + 1}`,
                type: "story",
                status: index === 0 ? "active" : "queued",
                summary: `Preserve canonical objective ${index + 1}.`,
                while_active_guidance:
                    `Keep the canonical preservation smoke focused on objective ${index + 1}.`,
                requires:
                    index === 0
                        ? []
                        : [`canonical-objective-${index}`],
                notes: longMemoryEntries,
                rewards: index === 0 ? objectiveRewards : [],
                choices: index === 0 ? objectiveChoices : [],
            }));
            const characters = Object.fromEntries(
                characterNames.map((name) => [
                    name,
                    devSmokeCharacterDefinition(name, {
                        age: 25,
                        gender: "female",
                    }),
                ]),
            );
            const npcCharacters = Object.fromEntries(
                npcNames.map((name) => [
                    name,
                    {
                        name,
                        age: 25,
                        gender: "female",
                        role: "canonical preservation NPC",
                        relationship: "neutral",
                        inspected: true,
                        full_character: devSmokeCharacterDefinition(name, {
                            age: 25,
                            gender: "female",
                        }),
                    },
                ]),
            );
            const mapLocations = Object.fromEntries(
                mapLocationIds.map((id, index) => [
                    id,
                    {
                        id,
                        name: `Canonical Location ${index + 1}`,
                        type: "place",
                        scale: "site",
                        discovered: true,
                        travel_enabled: true,
                        connections: index === 0 ? mapLocationIds.slice(1, 31) : [],
                        npcs: index === 0
                            ? Array.from(
                                  { length: 35 },
                                  (_, npcIndex) => `canonical-map-npc-${npcIndex + 1}`,
                              )
                            : [],
                    },
                ]),
            );
            const payload = {
                app: "EmberAdventures",
                exportType: "story-template",
                storyTemplate: {lite: true,
                    id: "canonical-story-state-preservation-smoke",
                    title: "Canonical Story State Preservation Smoke",
                    description: "Synthetic oversized canonical story state.",
                    creator: "debug harness",
                    creation_tool: "debug harness",
                    genres: ["fantasy"],
                    state: {
                        ...clone(defaultState),
                        player: devSmokeCharacterDefinition(
                            "Canonical Preservation Player",
                            {
                                age: 25,
                                gender: "female",
                            },
                        ),
                        meta: {
                            ...clone(defaultState.meta || {}),
                            story_source: {
                                mode: "original",
                                title: "Canonical Story State Preservation Smoke",
                            },
                        },
                        location: {
                            ...clone(defaultState.location || {}),
                            specific_place: "Canonical Location 1",
                            npc_location_id: "canonical-location-1",
                        },
                        world_map: {
                            current_location_id: mapLocationIds[0],
                            focus_location_id: mapLocationIds[0],
                            travel_history: mapLocationIds.slice(0, 30),
                            locations: mapLocations,
                        },
                        scene: {
                            ...clone(defaultState.scene || {}),
                            party_members_present: characterNames,
                            image_characters: characterNames,
                            npcs_present: npcNames,
                        },
                        characters,
                        npc_directory: {
                            locations: {
                                "canonical-location-1": {
                                    label: "Canonical Location 1",
                                    characters: npcCharacters,
                                },
                            },
                        },
                        objectives: {
                            active_id: objectives[0].id,
                            items: objectives,
                        },
                        story_clock: {
                            elapsed_minutes: 123,
                            label: "Day 1, 10:03 AM",
                        },
                        story_pacing: {
                            mode: "time_controlled",
                            timeline: {
                                "canonical-timeline-event": {
                                    id: "canonical-timeline-event",
                                    title: "Canonical Timeline Event",
                                    status: "waiting",
                                    objective_id: "canonical-objective-2",
                                    trigger: {
                                        at_elapsed_minutes: 1440,
                                    },
                                    prompt: {
                                        message: "Canonical timeline prompt.",
                                        accept_label: "Attend",
                                        decline_label: "Miss it",
                                    },
                                    accept: {
                                        objective_id: "canonical-objective-2",
                                    },
                                    missed_due_to_conflict: {
                                        message: "Canonical timeline missed.",
                                        rewards: [
                                            {
                                                type: "add_story_rule",
                                                rule_id: "canonical_timeline_missed",
                                                text: "Canonical timeline missed.",
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                        timed_events: {
                            "canonical-timer": {
                                id: "canonical-timer",
                                title: "Canonical Timer",
                                status: "waiting",
                                visibility: "vague",
                                trigger: {
                                    objective_id: "canonical-objective-1",
                                },
                                time_limit: {
                                    days: 2,
                                },
                                message: "Canonical timer message.",
                                stages: [
                                    {
                                        id: "canonical-stage",
                                        after: {
                                            hours: 3,
                                        },
                                        visibility: "visible",
                                        message: "Canonical warning.",
                                        rewards: [
                                            {
                                                type: "add_story_rule",
                                                rule_id: "canonical_timer_warning",
                                                text: "Canonical timer warning fired.",
                                            },
                                        ],
                                    },
                                ],
                                rewards: [
                                    {
                                        type: "add_story_rule",
                                        rule_id: "canonical_timer_done",
                                        text: "Canonical timer done.",
                                    },
                                ],
                            },
                        },
                        story_rules: Array.from({ length: 90 }, (_, index) => ({
                            id: `canonical-rule-${index + 1}`,
                            text: `Canonical rule ${index + 1}`,
                        })),
                        story_memory: Object.fromEntries(
                            storyMemoryCategories().map((key) => [key, longMemoryEntries]),
                        ),
                        story_shops: {
                            "canonical-shop": {
                                id: "canonical-shop",
                                title: "Canonical Shop",
                                type: "character",
                                npc_location_id: "canonical-location-1",
                                purchase_verb: "Select",
                                purchase_completed_verb: "selected",
                                visible_count: 25,
                                items: [],
                            },
                        },
                    },
                    messages: [],
                },
            };

            const exactObjectiveRewards = Array.from({ length: 35 }, (_, index) => ({
                type: "add_story_rule",
                rule_id: `canonical-reward-rule-${index + 1}`,
                text: `Canonical reward rule ${index + 1}.`,
            }));
            const exactObjectiveChoices = Array.from({ length: 12 }, (_, index) => ({
                id: `canonical-choice-${index + 1}`,
                title: `Canonical Choice ${index + 1}`,
                summary: `Preserve canonical choice ${index + 1}.`,
                completion_instruction: `Continue after canonical choice ${index + 1}.`,
                next_objective_id: "canonical-objective-2",
                target_input_group_id: `canonical-objective-2-choice-${index + 1}`,
                requirements: index === 0 ? [] : choiceRequirements,
                rewards: exactObjectiveRewards,
            }));
            const exactObjectiveSources = Array.from({ length: 130 }, (_, index) =>
                devSmokeObjective(
                    `canonical-objective-${index + 1}`,
                    `Canonical Objective ${index + 1}`,
                    {
                        status: index === 0 ? "active" : "hidden",
                        summary: `Preserve canonical objective ${index + 1}.`,
                        completion_control: index === 0 ? "choice" : "player",
                        completion_criteria:
                            index === 0
                                ? "The player selects one canonical choice."
                                : `The player completes canonical objective ${index + 1}.`,
                        rewards: index === 0 ? exactObjectiveRewards : [],
                        choices: index === 0 ? exactObjectiveChoices : undefined,
                        next_objectives:
                            index > 0 && index < 129
                                ? [`canonical-objective-${index + 2}`]
                                : undefined,
                        ending_type: index === 129 ? "freeplay" : undefined,
                        ending_message:
                            index === 129
                                ? "The canonical preservation smoke continues in freeplay."
                                : undefined,
                    },
                ),
            );
            const exactCharacters = Object.fromEntries(
                characterNames.map((name) => [
                    name,
                    devSmokeEmbeddedCharacterDefinition(name, {
                        age: 25,
                        gender: "female",
                        role: "canonical preservation party member",
                    }),
                ]),
            );
            const exactNpcCharacters = Object.fromEntries(
                npcNames.map((name) => [
                    name,
                    {
                        name,
                        age: 25,
                        gender: "female",
                        role: "canonical preservation NPC",
                        relationship: "neutral",
                        note: "Fake canonical preservation NPC.",
                        inspected: true,
                        full_character: devSmokeEmbeddedCharacterDefinition(name, {
                            age: 25,
                            gender: "female",
                            role: "canonical preservation NPC",
                        }),
                    },
                ]),
            );
            const exactMapLocations = Object.fromEntries(
                mapLocationIds.map((id, index) => [
                    id,
                    {
                        id,
                        name: `Canonical Location ${index + 1}`,
                        type: "place",
                        scale: "site",
                        parent_id: "",
                        x: index,
                        y: index,
                        discovered: true,
                        travel_enabled: true,
                        summary: `Canonical location ${index + 1}.`,
                        detail: {},
                        connections: index === 0 ? mapLocationIds.slice(1, 31) : [],
                        npcs:
                            index === 0
                                ? Array.from(
                                      { length: 35 },
                                      (_, npcIndex) => `canonical-map-npc-${npcIndex + 1}`,
                                  )
                                : [],
                    },
                ]),
            );
            payload.exportedAt = new Date().toISOString();
            payload.storyTemplate = devSmokeStoryRecord({
                id: "canonical-story-state-preservation-smoke",
                title: "Canonical Story State Preservation Smoke",
                description: "Synthetic oversized canonical story state.",
                player: devSmokeRuntimeCharacter("Canonical Preservation Player", {
                    age: 25,
                    gender: "female",
                    role: "canonical preservation player",
                }),
                characters: exactCharacters,
                npc_directory: {
                    locations: {
                        "canonical-location-1": {
                            label: "Canonical Location 1",
                            characters: exactNpcCharacters,
                        },
                    },
                },
                npc_location_id: "canonical-location-1",
                location: {
                    specific_place: "Canonical Location 1",
                    npc_location_id: "canonical-location-1",
                },
                party_members_present: characterNames,
                image_characters: characterNames,
                npcs_present: npcNames,
                objectives: exactObjectiveSources,
                active_id: "canonical-objective-1",
                story_rules: Array.from({ length: 90 }, (_, index) => ({
                    id: `canonical-rule-${index + 1}`,
                    text: `Canonical rule ${index + 1}`,
                })),
                world_map: {
                    current_location_id: mapLocationIds[0],
                    focus_location_id: mapLocationIds[0],
                    travel_history: mapLocationIds.slice(0, 30),
                    locations: exactMapLocations,
                },
            });
            payload.storyTemplate.state.story_memory = Object.fromEntries(
                storyMemoryCategories().map((key) => [key, longMemoryEntries]),
            );
            payload.storyTemplate.state.story_clock = {
                elapsed_minutes: 123,
                label: "Day 1, 10:03 AM",
            };
            payload.storyTemplate.state.story_pacing = {
                mode: "time_controlled",
                pending_event_id: "",
                timeline: {
                    "canonical-timeline-event": {
                        id: "canonical-timeline-event",
                        title: "Canonical Timeline Event",
                        status: "waiting",
                        objective_id: "canonical-objective-2",
                        trigger: { at_elapsed_minutes: 1440 },
                        prompt: {
                            message: "Canonical timeline prompt.",
                            accept_label: "Attend",
                            decline_label: "Miss it",
                        },
                        accept: { objective_id: "canonical-objective-2" },
                        missed_due_to_conflict: {
                            message: "Canonical timeline missed.",
                            rewards: [
                                {
                                    type: "add_story_rule",
                                    rule_id: "canonical_timeline_missed",
                                    text: "Canonical timeline missed.",
                                },
                            ],
                        },
                        auto_start: false,
                    },
                },
            };
            payload.storyTemplate.state.timed_events["canonical-timer"] = {
                id: "canonical-timer",
                title: "Canonical Timer",
                status: "waiting",
                visibility: "vague",
                trigger: { objective_id: "canonical-objective-1" },
                time_limit: { days: 2 },
                message: "Canonical timer message.",
                stages: [
                    {
                        id: "canonical-stage",
                        after: { hours: 3 },
                        visibility: "visible",
                        message: "Canonical warning.",
                        rewards: [
                            {
                                type: "add_story_rule",
                                rule_id: "canonical_timer_warning",
                                text: "Canonical timer warning fired.",
                            },
                        ],
                    },
                ],
                rewards: [
                    {
                        type: "add_story_rule",
                        rule_id: "canonical_timer_done",
                        text: "Canonical timer done.",
                    },
                ],
            };
            payload.storyTemplate.state.story_shops = {
                "canonical-shop": {
                    id: "canonical-shop",
                    title: "Canonical Shop",
                    type: "character",
                    unlocked: true,
                    currency: "coins",
                    npc_location_id: "canonical-location-1",
                    purchase_verb: "Select",
                    purchase_completed_verb: "selected",
                    purchase_mode: "service",
                    visible_count: 25,
                    items: [],
                },
            };

            const assertPreserved = (record, label) => {
                const state = record?.state || {};
                const firstObjective = state.objectives?.items?.[0] || {};
                const firstChoice = firstObjective.choices?.[1] || {};
                const firstMap = state.world_map?.locations?.["canonical-location-1"] || {};
                devAssert(state.objectives?.items?.length === 130, `${label} preserves more than 120 objectives`);
                devAssert(firstObjective.rewards?.length === 35, `${label} preserves more than 30 objective rewards`);
                devAssert(firstObjective.choices?.length === 12, `${label} preserves more than 8 objective choices`);
                devAssert(firstChoice.requirements?.length === 12, `${label} preserves all choice requirements`);
                devAssert(state.story_rules?.length === 90, `${label} preserves more than 80 story rules`);
                for (const key of storyMemoryCategories()) {
                    devAssert(state.story_memory?.[key]?.length === 12, `${label} preserves all ${key} entries`);
                    devAssert(
                        state.story_memory?.[key]?.[11] === longMemoryEntries[11],
                        `${label} preserves long ${key} text exactly`,
                    );
                }
                devAssert(state.scene?.party_members_present?.length === 20, `${label} preserves scene party members`);
                devAssert(state.scene?.image_characters?.length === 20, `${label} preserves scene image characters`);
                devAssert(
                    state.scene?.npcs_present?.length === 20,
                    `${label} preserves scene NPCs`,
                    {
                        expected: npcNames,
                        actual: state.scene?.npcs_present || [],
                        directoryNames: allNpcNamesFromState(state),
                    },
                );
                devAssert(firstMap.connections?.length === 30, `${label} preserves map connections`);
                devAssert(firstMap.npcs?.length === 35, `${label} preserves map NPC lists`);
                devAssert(state.world_map?.travel_history?.length === 30, `${label} preserves travel history`);
                devAssert(state.story_shops?.["canonical-shop"]?.visible_count === 25, `${label} preserves shop visible_count`);
                devAssert(state.story_clock?.elapsed_minutes === 123, `${label} preserves story clock elapsed time`);
                devAssert(
                    state.story_pacing?.mode === "time_controlled" &&
                        state.story_pacing?.timeline?.["canonical-timeline-event"]?.trigger?.at_elapsed_minutes === 1440 &&
                        state.story_pacing?.timeline?.["canonical-timeline-event"]?.accept?.objective_id === "canonical-objective-2",
                    `${label} preserves story pacing timeline`,
                    state.story_pacing,
                );
                devAssert(
                    state.timed_events?.["canonical-timer"]?.time_limit?.days === 2,
                    `${label} preserves timed event time limits`,
                    state.timed_events?.["canonical-timer"],
                );
                devAssert(
                    state.timed_events?.["canonical-timer"]?.stages?.[0]?.after?.hours === 3,
                    `${label} preserves timed event stages`,
                    state.timed_events?.["canonical-timer"],
                );
                devAssert(
                    state.timed_events?.["canonical-timer"]?.rewards?.[0]?.type === "add_story_rule",
                    `${label} preserves timed event rewards`,
                    state.timed_events?.["canonical-timer"],
                );
            };

            const imported = storyTemplateRecordFromPayload(payload);
            assertPreserved(imported, "import");
            const savedAndReloaded = validatedStoryTemplateRecord(
                JSON.parse(JSON.stringify(imported)),
            );
            assertPreserved(savedAndReloaded, "save and reload");
            const exported = storyDefinitionForExport(savedAndReloaded);
            assertPreserved(exported, "export");
            const reimported = storyTemplateRecordFromPayload({
                app: "EmberAdventures",
                exportType: "story-template",
                exportedAt: new Date().toISOString(),
                storyTemplate: JSON.parse(JSON.stringify(exported)),
            });
            assertPreserved(reimported, "export re-import");
            devTestLog("Scenario complete: canonical-story-state-preservation-smoke");
        }

        async function devRunObjectiveRewardsSmokeTest() {
            devTestLog("Scenario start: objective-rewards-smoke");
            devResetForLiveTest("objective-rewards-smoke");
            devCreateTestProfile({  });
            const npcLocationSmokeOriginalState = app.state;
            try {
                const state = clone(defaultState);
                state.location = {
                    ...state.location,
                    npc_location_id: "receiving-room",
                    settlement_name: "Aurelis",
                    specific_place: "Receiving Room",
                };
                state.npc_directory = {
                    locations: {
                        "receiving-room": {
                            label: "Caelira Vey's Divine Receiving Room",
                            characters: {},
                        },
                    },
                };
                state.future_cast = {
                    enabled: true,
                    items: {
                        "shop-ally": {
                            id: "shop-ally",
                            name: "Shop Ally",
                            npc_location_id: "receiving-room",
                            full_character: {
                                ...blankCharacterTemplate("Shop Ally"),
                                id: "shop-ally",
                                name: "Shop Ally",
                                age: 24,
                                romanceable: false,
                            },
                        },
                    },
                };
                state.story_shops = {
                    "stable-shop": {
                        id: "stable-shop",
                        title: "Stable Shop",
                        type: "general",
                        npc_location_id: "receiving-room",
                        owner_npc_id: "shop-ally",
                        items: [],
                    },
                };
                app.state = state;
                const validNpcLocationTemplate = {lite: true,
                    title: "Stable NPC Location",
                    state: clone(state),
                };
                const validNpcLocationErrors = validateStoryDefinition(validNpcLocationTemplate).errors
                    .filter((error) => /npc_location|npc_directory\.locations/.test(error.path));
                devAssert(
                    validNpcLocationErrors.length === 0,
                    "story validation accepts stable NPC location ids with a player-facing label value",
                    { validNpcLocationErrors },
                );
                const invalidNpcLocationTemplate = clone(validNpcLocationTemplate);
                invalidNpcLocationTemplate.state.npc_directory.locations = {
                    "|[character:caelira-vey]|'s Divine Receiving Room": {
                        label: "Receiving Room",
                        characters: {},
                    },
                };
                const invalidNpcLocationErrors = validateStoryDefinition(invalidNpcLocationTemplate).errors;
                devAssert(
                    invalidNpcLocationErrors.some((error) => error.code === "id"),
                    "story validation rejects display labels and runtime tokens as NPC directory keys",
                    { invalidNpcLocationErrors },
                );
                const shell = ensureNpcEntry("Location Shell", { role: "smoke contact" });
                devAssert(
                    !!shell && !!app.state.npc_directory.locations["receiving-room"].characters["Location Shell"],
                    "new runtime NPC shells use location.npc_location_id rather than a display label key",
                );
                const reward = {
                    type: "introduce_future_character",
                    character_id: "shop-ally",
                    npc_location_id: "receiving-room",
                    npc_location_label: "Receiving Room",
                };
                introduceFutureCharacterFromReward(app.state, reward, { id: "location-smoke", title: "Location Smoke" });
                devAssert(
                    !!app.state.npc_directory.locations["receiving-room"].characters["Shop Ally"],
                    "future-character rewards introduce NPCs into the authored stable location id",
                );
                const owner = ensureStoryShopOwnerNpc(app.state.story_shops["stable-shop"], "receiving-room", {
                    location_label: "Receiving Room",
                });
                devAssert(
                    owner?.locationId === "receiving-room" &&
                        !!app.state.npc_directory.locations["receiving-room"].characters[owner.name],
                    "story shop owners use the shop npc_location_id",
                    { owner },
                );
                const generated = ensureGeneratedRoleNpc("client", {
                    boardId: "stable-shop",
                    npc_location_id: "receiving-room",
                    locationLabel: "Receiving Room",
                });
                devAssert(
                    !!generated?.name &&
                        !!app.state.npc_directory.locations["receiving-room"].characters[generated.name],
                    "generated job contacts use the supplied stable NPC location id",
                    { generated },
                );
                const found = findNpcEntryInState(app.state, "Shop Ally");
                devAssert(
                    found?.locationId === "receiving-room" &&
                        found.locationLabel === "Caelira Vey's Divine Receiving Room",
                    "NPC lookup retains a stable location id while exposing the separate display label",
                    { found },
                );
                const mapState = clone(app.state);
                mapState.objectives.no_current = false;
                mapState.world_map = {
                    current_location_id: "receiving-room",
                    focus_location_id: "receiving-room",
                    travel_history: [],
                    locations: {
                        "receiving-room": {
                            id: "receiving-room",
                            name: "Receiving Room",
                            scale: "site",
                            detail: { specific_place: "Receiving Room" },
                            connections: [],
                        },
                    },
                };
                assertRuntimeLocationState(mapState);
                devAssert(
                    mapState.location.npc_location_id === "receiving-room",
                    "map location normalization carries the current stable map id into npc_location_id",
                    { location: mapState.location },
                );
            } finally {
                app.state = npcLocationSmokeOriginalState;
            }
            // Smoke invariant: objective rewards are deterministic state changes
            // owned by objective completion, not by later broad story updates.
            // This covers the common reward types in one isolated fixture.
            const futureFull = blankCharacterTemplate("Mira Reward");
            futureFull.id = "mira-reward";
            futureFull.name = "Mira Reward";
            futureFull.age = 28;
            futureFull.gender = "female";
            futureFull.role = "reward ally";
            futureFull.personality_description = "Practical and steady.";
            const validOutfitRewardTemplate = {
                state: {
                    player: {
                        ...blankCharacterTemplate("Outfit Reward Player"),
                        id: "outfit-reward-player",
                        name: "Outfit Reward Player",
                    },
                    objectives: {
                        items: [
                            {
                                id: "outfit-validation-objective",
                                completion_control: "player",
                                rewards: [
                                    {
                                        type: "grant_outfit",
                                        character_id: "outfit-reward-player",
                                        outfit: {
                                            id: "validation-uniform",
                                            name: "Validation Uniform",
                                            contexts: ["formal duty", "field work"],
                                            formality: 8,
                                            clothing: {
                                                shirt: "validation shirt",
                                                pants: "validation trousers",
                                            },
                                        },
                                    },
                                    {
                                        type: "equip_outfit",
                                        character_id: "outfit-reward-player",
                                        outfit_id: "validation-uniform",
                                    },
                                    {
                                        type: "grant_outfit",
                                        character_id: "outfit-reward-player",
                                        non_male_outfit: {
                                            id: "optional-dress",
                                            name: "Optional Dress",
                                            clothing: {
                                                shirt: "optional validation dress bodice",
                                                skirt: "optional validation dress skirt",
                                            },
                                        },
                                    },
                                    {
                                        type: "grant_outfit",
                                        character_id: "outfit-reward-player",
                                        male_outfit: {
                                            id: "paired-uniform",
                                            name: "Paired Male Uniform",
                                            clothing: {
                                                shirt: "male validation shirt",
                                            },
                                        },
                                        non_male_outfit: {
                                            id: "paired-uniform",
                                            name: "Paired Non-Male Uniform",
                                            clothing: {
                                                shirt: "non-male validation shirt",
                                            },
                                        },
                                    },
                                    {
                                        type: "equip_outfit",
                                        character_id: "outfit-reward-player",
                                        outfit_id: "paired-uniform",
                                    },
                                    {
                                        type: "delete_outfit",
                                        character_id: "outfit-reward-player",
                                        outfit_id: "validation-uniform",
                                    },
                                    {
                                        type: "delete_all_outfits",
                                        character_id: "outfit-reward-player",
                                    },
                                ],
                            },
                        ],
                    },
                },
            };
            const validOutfitRewardErrors = objectiveRewardValidationErrors(
                validOutfitRewardTemplate.state.objectives.items,
                {},
                validOutfitRewardTemplate,
            );
            devAssert(
                validOutfitRewardErrors.length === 0,
                "story validation accepts valid grant_outfit and equip_outfit objective rewards",
                { validOutfitRewardErrors },
            );
            const invalidOutfitMetadataErrors = outfitDefinitionValidationErrors(
                {
                    id: "invalid-metadata-outfit",
                    name: "Invalid Metadata Outfit",
                    contexts: ["valid context", ""],
                    formality: "formal",
                    clothing: { shirt: "validation shirt" },
                },
                "outfit",
            );
            devAssert(
                invalidOutfitMetadataErrors.some(
                    (error) => error.path === "outfit.contexts",
                ) &&
                    invalidOutfitMetadataErrors.some(
                        (error) => error.path === "outfit.formality",
                    ),
                "story validation accepts typed outfit metadata and rejects malformed metadata for rewards and clothing shops",
                { invalidOutfitMetadataErrors },
            );
            const malformedDirectChoiceRewardTemplate = {lite: true,
                title: "Malformed Direct Choice Reward",
                allow_any_player: false,
                state: {
                    player: {
                        ...blankCharacterTemplate("Choice Validation Player"),
                        id: "choice-validation-player",
                        name: "Choice Validation Player",
                        known_facts: [],
                    },
                    objectives: {
                        active_id: "choose-validation-gift",
                        items: [
                            {
                                id: "choose-validation-gift",
                                title: "Choose a Validation Gift",
                                type: "story",
                                status: "active",
                                summary: "Choose a synthetic validation gift.",
                                completion_control: "choice",
                                choices: [
                                    {
                                        id: "take-validation-gift",
                                        title: "Take the Validation Gift",
                                        rewards: [
                                            {
                                                type: "add_state_list_item",
                                                target: "Player",
                                                field_path: "known_facts",
                                                value: "This malformed path must be rejected.",
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            };
            const malformedDirectChoiceRewardErrors = validateStoryDefinition(
                malformedDirectChoiceRewardTemplate,
            ).errors;
            devAssert(
                malformedDirectChoiceRewardErrors.some(
                    (error) =>
                        error.path ===
                            "objectives.items.0.choices.0.rewards.0.field_path" &&
                        error.code === "required",
                ),
                "shared import/publish validation rejects direct-choice rewards with string field_path values",
                malformedDirectChoiceRewardErrors,
            );
            const originalDirectChoiceState = app.state;
            const malformedDirectChoiceState = clone(app.state);
            malformedDirectChoiceState.player = {
                ...clone(malformedDirectChoiceRewardTemplate.state.player),
                known_facts: [],
            };
            malformedDirectChoiceState.objectives = extractObjectives(
                malformedDirectChoiceRewardTemplate.state.objectives,
                malformedDirectChoiceState,
            );
            let malformedDirectChoiceFailure = null;
            try {
                app.state = malformedDirectChoiceState;
                await devCompileCurrentStoryFixture(
                    "objective-rewards-malformed-direct-choice-smoke",
                );
                reconcileStoryRuntimeState(
                    app.state,
                    "objective rewards malformed direct-choice smoke seed",
                );
                const beforeMalformedChoice = clone(app.state);
                try {
                    completeDirectObjectiveChoice("take-validation-gift");
                } catch (error) {
                    malformedDirectChoiceFailure = error;
                }
                devAssert(
                    !!malformedDirectChoiceFailure &&
                        JSON.stringify(app.state) === JSON.stringify(beforeMalformedChoice) &&
                        String(
                            app.state.objectives?.items?.[0]?.status || "",
                        ) === "active" &&
                        !(app.state.player?.known_facts || []).includes(
                            "This malformed path must be rejected.",
                        ),
                    "a direct-choice reward preflight failure restores the active choice without applying its reward",
                    {
                        error: malformedDirectChoiceFailure?.message || "",
                        objectives: app.state.objectives,
                        knownFacts: app.state.player?.known_facts || [],
                    },
                );
            } finally {
                app.state = originalDirectChoiceState;
            }
            const inlineObjectiveRewardTemplate = clone(validOutfitRewardTemplate);
            inlineObjectiveRewardTemplate.state.objectives.items[0].rewards = [
                {
                    type: "start_objective",
                    objective: {
                        id: "unsupported-inline-objective",
                        title: "Unsupported Inline Objective",
                    },
                },
            ];
            const inlineObjectiveRewardErrors = objectiveRewardValidationErrors(
                inlineObjectiveRewardTemplate.state.objectives.items,
                {},
                inlineObjectiveRewardTemplate,
            );
            devAssert(
                inlineObjectiveRewardErrors.some(
                    (error) =>
                        String(error.path || "").endsWith(".objective"),
                ),
                "inline start_objective.objective definitions are rejected during validation",
                { inlineObjectiveRewardErrors },
            );
            let inlineObjectiveRuntimeFailure = "";
            try {
                startObjectiveReward(
                    clone(defaultState),
                    inlineObjectiveRewardTemplate.state.objectives.items[0].rewards[0],
                    { id: "inline-objective-owner", title: "Inline Objective Owner" },
                );
            } catch (error) {
                inlineObjectiveRuntimeFailure = error?.message || String(error);
            }
            devAssert(
                /inline start_objective\.objective definitions are not supported/i.test(
                    inlineObjectiveRuntimeFailure,
                ),
                "inline start_objective.objective definitions are rejected by the runtime reward path",
                { inlineObjectiveRuntimeFailure },
            );

            const invalidOutfitRewardTemplate = clone(validOutfitRewardTemplate);
            invalidOutfitRewardTemplate.state.objectives.items[0].rewards = [
                {
                    type: "grant_outfit",
                    outfit: {
                        id: "",
                        name: "",
                        clothing: { invented_slot: "invalid clothing" },
                    },
                    equip: "yes",
                },
                {
                    type: "equip_outfit",
                    character_id: "missing-character",
                },
                {
                    type: "grant_outfit",
                    character_id: "outfit-reward-player",
                    equip: true,
                    non_male_outfit: {
                        id: "missing-male-presentation",
                        name: "Missing Male Presentation",
                        clothing: { shirt: "validation shirt" },
                    },
                },
                {
                    type: "grant_outfit",
                    character_id: "outfit-reward-player",
                    male_outfit: {
                        id: "mismatched-male-id",
                        name: "Mismatched Male",
                        clothing: { shirt: "male shirt" },
                    },
                    non_male_outfit: {
                        id: "mismatched-non-male-id",
                        name: "Mismatched Non-Male",
                        clothing: { shirt: "non-male shirt" },
                    },
                },
            ];
            const invalidOutfitRewardErrors = objectiveRewardValidationErrors(
                invalidOutfitRewardTemplate.state.objectives.items,
                {},
                invalidOutfitRewardTemplate,
            );
            devTestLog("Invalid outfit reward validation errors", {
                errors: invalidOutfitRewardErrors
                    .map((error) => `${error.path}:${error.code}`)
                    .join(" | "),
            });
            devAssert(
                invalidOutfitRewardErrors.length >= 4 &&
                    invalidOutfitRewardErrors.some((error) =>
                        String(error.path || "").endsWith("character_id"),
                    ) &&
                    invalidOutfitRewardErrors.some((error) =>
                        String(error.path || "").endsWith("outfit_id"),
                    ) &&
                    invalidOutfitRewardErrors.some(
                        (error) => error.code === "presentations",
                    ) &&
                    invalidOutfitRewardErrors.some(
                        (error) => error.code === "presentation_id",
                    ),
                "story validation rejects malformed outfit rewards before play",
                { invalidOutfitRewardErrors },
            );
            app.profileImages = [];
            app.profileImageQueue = [];
            app.profileImageGenerating = new Set();
            app.profileImageQueued = new Set();
            app.profileImageRequestOwnerById = {};
            app.activeProfileImageRequestByOwner = {};
            app.supersededProfileImageRequests = new Set();
            app.profileImageQueueRunning = true;
            app.state = repairAiGeneratedState({
                ...clone(defaultState),
                meta: {
                    ...clone(defaultState.meta || {}),
                    setup_complete: true,
                    story_source: {
                        mode: "original",
                        title: "Objective Rewards Smoke",
                    },
                },
                location: {
                    ...clone(defaultState.location || {}),
                    settlement_name: "Reward Town",
                    specific_place: "reward square",
                    npc_location_id: "reward-square",
                },
                player: {
                    ...clone(defaultState.player || {}),
                    id: "reward-tester",
                    name: "Reward Tester",
                    age: 24,
                    gender: "female",
                    inventory: [],
                },
                progression: {},
                world_map: {
                    locations: {
                        "reward-square": {
                            id: "reward-square",
                            name: "Reward Square",
                            type: "place",
                            scale: "site",
                            discovered: true,
                            travel_enabled: true,
                            connections: [],
                            summary: "",
                        },
                        "reward-gate": {
                            id: "reward-gate",
                            name: "Reward Gate",
                            type: "place",
                            scale: "site",
                            discovered: false,
                            travel_enabled: false,
                            connections: [],
                            summary: "A smoke-test destination.",
                        },
                    },
                },
                story_rules: [],
                reward_bundles: {
                    "reward-smoke-shared-unlock": [
                        {
                            type: "add_story_rule",
                            rule_id: "reward_bundle_shared",
                            text: "The reward smoke shared bundle was applied.",
                        },
                        {
                            type: "adjust_story_inventory",
                            field_path: ["story_inventory", "bundle_tokens"],
                            operation: "add",
                            amount: 2,
                        },
                    ],
                    "reward-smoke-transition": [
                        {
                            type: "add_story_rule",
                            rule_id: "reward_only_transition",
                            text: "The reward-only transition bundle was applied.",
                        },
                    ],
                },
                story_inventory: {
                    items: [],
                    bundle_tokens: 0,
                },
                story_clock: {
                    elapsed_minutes: 0,
                },
                timed_events: {
                    "reward-deadline": {
                        id: "reward-deadline",
                        title: "Reward Deadline",
                        status: "waiting",
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
                npc_directory: {
                    locations: {
                        "reward-square": {
                            label: "reward square",
                            characters: {
                                "Local Watcher": {
                                    name: "Local Watcher",
                                    gender: "female",
                                    age: 28,
                                    role: "runtime smoke NPC",
                                    relationship: "neutral",
                                    inspected: true,
                                    can_die: false,
                                    full_character: {
                                        ...blankCharacterTemplate("Local Watcher"),
                                        id: "local-watcher",
                                        name: "Local Watcher",
                                        age: 28,
                                        gender: "female",
                                        role: "runtime smoke NPC",
                                        can_die: false,
                                    },
                                },
                                "Disposable Watcher": {
                                    name: "Disposable Watcher",
                                    gender: "male",
                                    age: 31,
                                    role: "killable smoke NPC",
                                    relationship: "neutral",
                                    inspected: true,
                                    can_die: true,
                                    full_character: {
                                        ...blankCharacterTemplate("Disposable Watcher"),
                                        id: "disposable-watcher",
                                        name: "Disposable Watcher",
                                        age: 31,
                                        gender: "male",
                                        role: "killable smoke NPC",
                                        can_die: true,
                                    },
                                },
                                "Hosted Watcher": {
                                    name: "Hosted Watcher",
                                    gender: "female",
                                    age: 29,
                                    role: "hosted image smoke NPC",
                                    relationship: "neutral",
                                    inspected: true,
                                    can_die: false,
                                    full_character: {
                                        ...blankCharacterTemplate("Hosted Watcher"),
                                        id: "hosted-watcher",
                                        name: "Hosted Watcher",
                                        age: 29,
                                        gender: "female",
                                        role: "hosted image smoke NPC",
                                        can_die: false,
                                    },
                                },
                                "Unlocked Watcher": {
                                    name: "Unlocked Watcher",
                                    gender: "female",
                                    age: 33,
                                    role: "protected smoke NPC",
                                    relationship: "neutral",
                                    inspected: true,
                                    can_die: false,
                                    full_character: {
                                        ...blankCharacterTemplate("Unlocked Watcher"),
                                        id: "unlocked-watcher",
                                        name: "Unlocked Watcher",
                                        age: 33,
                                        gender: "female",
                                        role: "protected smoke NPC",
                                        can_die: false,
                                    },
                                },
                            },
                        },
                    },
                },
                future_cast: {
                    enabled: true,
                    items: {
                        "mira-reward": {
                            id: "mira-reward",
                            name: "Mira Reward",
                            age: 28,
                            gender: "female",
                            role: "reward ally",
                            full_character: futureFull,
                            greeting: "I am ready to help.",
                            status: "future",
                            location_hint: "reward square",
                        },
                        "choice-replay-ally": {
                            id: "choice-replay-ally",
                            name: "Choice Replay Ally",
                            age: 30,
                            gender: "female",
                            role: "choice replay ally",
                            full_character: {
                                ...blankCharacterTemplate("Choice Replay Ally"),
                                id: "choice-replay-ally",
                                name: "Choice Replay Ally",
                                age: 30,
                                gender: "female",
                                role: "choice replay ally",
                            },
                            greeting: "The choice replay ally is ready.",
                            status: "future",
                            location_hint: "reward square",
                        },
                    },
                },
                objectives: {
                    active_id: "reward-objective",
                    focus_id: "reward-objective",
                    items: [
                        {
                            id: "reward-objective",
                            title: "Reward Objective",
                            type: "story",
                            status: "complete",
                            summary: "Complete the reward smoke objective.",
                            completion_control: "player",
                            completion_criteria: "Already complete for smoke.",
                            rewards: [
                                "reward-smoke-shared-unlock",
                                { type: "add_item", item: "Reward Gem" },
                                {
                                    type: "advance_time",
                                    hours: 1,
                                    minutes: 30,
                                    reason: "reward smoke objective travel",
                                },
                                {
                                    type: "unlock_location",
                                    location_id: "loc-reward-gate",
                                },
                                {
                                    type: "add_story_rule",
                                    rule_id: "reward_smoke_done",
                                    text: "The reward smoke objective is complete.",
                                },
                                {
                                    type: "set_state_field",
                                    target: "Local Watcher",
                                    field_path: ["role"],
                                    value: "updated reward watcher",
                                },
                                {
                                    type: "grant_outfit",
                                    character_id: "Local Watcher",
                                    equip: true,
                                    outfit: {
                                        id: "reward-training-kit",
                                        name: "Reward Training Kit",
                                        clothing: {
                                            shirt: "smoke reward training shirt",
                                            pants: "smoke reward training trousers",
                                        },
                                    },
                                },
                                {
                                    type: "grant_outfit",
                                    character_id: "Local Watcher",
                                    outfit: {
                                        id: "reward-field-kit",
                                        name: "Reward Field Kit",
                                        contexts: ["field work"],
                                        clothing: {
                                            shirt: "smoke reward field shirt",
                                            pants: "smoke reward field trousers",
                                            feet: "smoke reward field boots",
                                        },
                                    },
                                },
                                {
                                    type: "equip_outfit",
                                    character_id: "Local Watcher",
                                    outfit_id: "reward-field-kit",
                                },
                                {
                                    type: "set_state_field",
                                    field_path: ["world_flags", "reward_smoke_ending"],
                                    value: "ENDING - REWARD SMOKE",
                                },
                                {
                                    type: "add_state_list_item",
                                    path: ["recent_changes"],
                                    value: "Reward smoke list item added.",
                                },
                                {
                                    type: "remove_state_list_item",
                                    path: ["recent_changes"],
                                    value: "Reward smoke list item added.",
                                },
                                {
                                    type: "add_state_list_item",
                                    path: ["story_rules"],
                                    value: {
                                        id: "reward-smoke-match-remove",
                                        text: "This matched story rule should be removed.",
                                    },
                                },
                                {
                                    type: "remove_state_list_item",
                                    path: ["story_rules"],
                                    match: { id: "reward-smoke-match-remove" },
                                },
                                {
                                    type: "kill_character",
                                    target: "Local Watcher",
                                    reason: "Protected death should not apply.",
                                },
                                {
                                    type: "kill_character",
                                    target: "Disposable Watcher",
                                    reason: "Disposable Watcher died for reward smoke.",
                                },
                                {
                                    type: "set_state_field",
                                    path: [
                                        "npc_directory",
                                        "locations",
                                        "reward-square",
                                        "characters",
                                        "Unlocked Watcher",
                                        "can_die",
                                    ],
                                    value: true,
                                },
                                {
                                    type: "set_state_field",
                                    target: "Unlocked Watcher",
                                    field_path: ["can_die"],
                                    value: true,
                                },
                                {
                                    type: "kill_character",
                                    target: "Unlocked Watcher",
                                    reason: "Unlocked Watcher died after can_die changed.",
                                },
                                {
                                    type: "generate_profile_image",
                                    target: "Local Watcher",
                                    reason: "reward smoke profile image",
                                },
                                {
                                    type: "generate_solo_normal_image",
                                    target: "Local Watcher",
                                    reason: "reward smoke solo image",
                                    description: "a tailored blue travel coat and polished boots",
                                    background: "a quiet moonlit courtyard",
                                },
                                {
                                    type: "generate_story_image",
                                    id: "reward-smoke-story-image",
                                    title: "Reward Smoke Door",
                                    prompt: "old locked wooden door in a torchlit stone hallway, dramatic fantasy mystery lighting",
                                    negative_prompt: "modern objects",
                                    reason: "reward smoke authored story image",
                                },
                                {
                                    type: "generate_profile_image",
                                    id: "reward-smoke-hosted-profile",
                                    target: "Hosted Watcher",
                                    reason: "reward smoke hosted profile image",
                                    image: {
                                        url: devSmokePublicImageUrl(
                                            "objective-profile",
                                            "disposable-watcher",
                                        ),
                                        prompt: "authored Disposable Watcher portrait",
                                    },
                                },
                                {
                                    type: "generate_solo_normal_image",
                                    id: "reward-smoke-hosted-solo",
                                    target: "Hosted Watcher",
                                    reason: "reward smoke hosted solo image",
                                    image: {
                                        url: devSmokePublicImageUrl(
                                            "objective-solo",
                                            "disposable-watcher",
                                        ),
                                        prompt: "authored Disposable Watcher scene image",
                                    },
                                },
                                {
                                    type: "generate_story_image",
                                    id: "reward-smoke-hosted-story-image",
                                    title: "Hosted Reward Smoke Door",
                                    reason: "reward smoke hosted story image",
                                    image: {
                                        url: devSmokePublicImageUrl(
                                            "objective-story",
                                            "hosted-door",
                                        ),
                                    },
                                },
                                {
                                    type: "start_objective",
                                    objective_id: "reward-followup",
                                },
                                {
                                    type: "start_objective",
                                    objective_id: "deadline-response",
                                    activate: false,
                                },
                                {
                                    type: "introduce_future_character",
                                    character_id: "mira-reward",
                                    scene_presence: "nearby",
                                },
                            ],
                            next_objectives: [
                                {
                                    id: "reward-objective-transition-output",
                                    objective_id: "reward-only-objective",
                                    target_input_group_id:
                                        "reward-only-objective-input",
                                    requirements: [],
                                    fallback: true,
                                },
                            ],
                        },
                        {
                            id: "reward-followup",
                            title: "Reward Followup",
                            type: "story",
                            status: "hidden",
                            summary: "Follow the reward smoke lead.",
                            completion_control: "player",
                            completion_criteria: "Follow up.",
                            rewards: [],
                        },
                        {
                            id: "deadline-response",
                            title: "Handle Deadline",
                            type: "story",
                            status: "hidden",
                            summary: "Handle the timed-event deadline now.",
                            locked_until_complete: true,
                            completion_control: "player",
                            completion_criteria: "Respond to the deadline.",
                            rewards: [],
                        },
                        {
                            id: "reward-only-objective",
                            title: "Reward Only Transition",
                            type: "story",
                            status: "hidden",
                            summary: "Apply the shared reward-only transition.",
                            completion_control: "reward_only",
                            requirement_check_only: true,
                            completion_instruction: "Apply rewards and move to the follow-up.",
                            rewards: [
                                {
                                    type: "apply_reward_bundle",
                                    bundle_id: "reward-smoke-transition",
                                },
                            ],
                            next_objectives: [
                                {
                                    id: "reward-only-followup-output",
                                    objective_id: "reward-only-followup",
                                    target_input_group_id:
                                        "reward-only-followup-input",
                                    requirements: [],
                                    fallback: true,
                                },
                            ],
                        },
                        {
                            id: "reward-only-followup",
                            title: "Reward Only Followup",
                            type: "story",
                            status: "hidden",
                            summary: "The reward-only transition reached this followup.",
                            completion_control: "player",
                            completion_criteria: "Follow up after the reward-only transition.",
                            completion_instruction: "Continue after the reward-only transition.",
                            rewards: [],
                        },
                        {
                            id: "promote-objective",
                            title: "Promote Objective",
                            type: "story",
                            status: "active",
                            summary: "Promote the reward character.",
                            completion_control: "player",
                            completion_criteria: "Already complete for smoke.",
                            rewards: [
                                {
                                    type: "promote_future_character_to_party",
                                    character_id: "mira-reward",
                                },
                            ],
                        },
                        {
                            id: "choice-replay-objective",
                            title: "Choose the Replay Ally",
                            type: "side",
                            status: "hidden",
                            summary: "Introduce an ally through a direct choice.",
                            completion_control: "choice",
                            completion_criteria: "Choose to introduce the ally.",
                            choices: [
                                {
                                    id: "introduce-choice-replay-ally",
                                    title: "Introduce the Replay Ally",
                                    summary: "Introduce the synthetic replay ally.",
                                    rewards: [
                                        {
                                            type: "introduce_future_character",
                                            character_id: "choice-replay-ally",
                                            npc_location_id: "reward-square",
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: "choice-replay-promote-objective",
                            title: "Promote the Replay Ally",
                            type: "side",
                            status: "hidden",
                            summary: "Promote the introduced replay ally.",
                            completion_control: "player",
                            completion_criteria: "Promote the replay ally.",
                            rewards: [
                                {
                                    type: "promote_future_character_to_party",
                                    character_id: "choice-replay-ally",
                                },
                            ],
                        },
                    ],
                },
            });
            app.messages = [];

            await devCompileCurrentStoryFixture("objective-rewards-smoke");
            scheduleActiveGameSave();
            render();
            setObjectiveRuntimeOutputSelection(
                app.state,
                "reward-objective",
                "reward-objective-transition-output",
            );
            devTestLog("Reward-only transition seed", {
                source: app.state.objectives.items.find(
                    (item) => item.id === "reward-objective",
                ),
                sourceStatus: effectiveObjectiveStatus(
                    app.state.objectives.items.find(
                        (item) => item.id === "reward-objective",
                    ),
                    app.state,
                ),
                selectedOutput:
                    app.objectiveRuntime?.selectedOutputById?.[
                        "reward-objective"
                    ] || "",
                targetPrerequisitesMet: objectivePrerequisitesMet(
                    app.state.objectives.items.find(
                        (item) => item.id === "reward-only-objective",
                    ),
                    app.state,
                ),
                incomingGroups: [
                    ...(
                        objectiveRuntimeLookup(app.state)
                            .incomingInputGroupsByTargetId.get(
                                "reward-only-objective",
                            ) || new Map()
                    ).entries(),
                ],
                compiledDependents:
                    app.storyDefinition?.objectiveDependentsById?.[
                        "reward-objective"
                    ] || [],
            });
            const preRewardProfileValidation = validateProfileImageStore(
                app.profileImages || [],
            );
            devAssert(
                preRewardProfileValidation.ok,
                `objective reward fixture starts with exact profile image records: ${JSON.stringify(app.profileImages || [])}`,
                preRewardProfileValidation,
            );
            const beforeState = clone(app.state);
            updateObjectivePrerequisiteLocks(app.state, [
                "reward-objective",
            ]);
            const rewardResult = applyObjectiveProgressRewards(
                beforeState,
                app.state,
                "objective-rewards-smoke",
                { silentGameMessage: true },
            );
            await devWaitFor(
                () =>
                    app.profileImageQueued.has("Mira Reward") ||
                    app.profileImageGenerating.has("Mira Reward") ||
                    app.profileImageQueue.some((item) => item?.name === "Mira Reward") ||
                    !!activeProfileImage(getNpcEntry("Mira Reward", "reward-square")?.full_character),
                1500,
                "objective reward introduced character profile image queue",
            );
            assertRuntimeObjectivesAndProgression(app.state);
            const rewardObjective = app.state.objectives.items.find(
                (item) => item.id === "reward-objective",
            );
            const followupObjective = app.state.objectives.items.find(
                (item) => item.id === "reward-followup",
            );
            const introducedNpc = getNpcEntry("Mira Reward", "reward-square");
            const localWatcher = getNpcEntry("Local Watcher", "reward-square");
            const disposableWatcher = getNpcEntry("Disposable Watcher", "reward-square");
            const unlockedWatcher = getNpcEntry("Unlocked Watcher", "reward-square");
            const introducedProfile = activeProfileImage(introducedNpc?.full_character);
            const beforePromoteState = clone(app.state);
            const promoteObjective = app.state.objectives.items.find(
                (item) => item.id === "promote-objective",
            );
            if (promoteObjective) promoteObjective.status = "complete";
            const promoteRewardResult = applyObjectiveProgressRewards(
                beforePromoteState,
                app.state,
                "objective-rewards-smoke-promote",
                { silentGameMessage: true },
            );
            assertRuntimeObjectivesAndProgression(app.state);
            const choiceReplayObjective = app.state.objectives.items.find(
                (item) => item.id === "choice-replay-objective",
            );
            setObjectiveRuntimeStatus(
                app.state,
                choiceReplayObjective,
                "active",
            );
            app.state.objectives.focus_id = choiceReplayObjective.id;
            syncObjectiveRuntimeControls(app.state);
            const choiceReplayOption = currentDirectChoiceCandidates(
                app.state,
            ).find(
                (item) => item.title === "Introduce the Replay Ally",
            );
            devAssert(
                !!choiceReplayOption,
                "choice reward replay smoke exposes the direct choice option",
                {
                    choiceReplayObjective,
                    candidates: currentDirectChoiceCandidates(app.state),
                },
            );
            const staleChoiceReplayState = clone(app.state);
            const choiceReplayResult = completeDirectObjectiveChoice(
                choiceReplayOption.id,
            );
            const introducedChoiceReplayNpc = getNpcEntry(
                "Choice Replay Ally",
                "reward-square",
            );
            const choiceReplayInvocationIds = Object.keys(
                app.rewardRuntime.appliedInvocationIds || {},
            ).filter((id) => id.startsWith("objective-choice-replay-objective--"));
            devAssert(
                choiceReplayResult?.rewardResult?.applied === true &&
                    !!introducedChoiceReplayNpc &&
                    choiceReplayInvocationIds.length === 1 &&
                    choiceReplayInvocationIds.every(
                        (id) => !id.includes("route-default"),
                    ),
                "direct-choice rewards use the selected choice as their canonical invocation site",
                {
                    choiceReplayResult,
                    introducedChoiceReplayNpc,
                    choiceReplayInvocationIds,
                },
            );
            const choiceReplayPromoteObjective = app.state.objectives.items.find(
                (item) => item.id === "choice-replay-promote-objective",
            );
            const beforeChoiceReplayPromote = clone(app.state);
            setObjectiveRuntimeStatus(
                app.state,
                choiceReplayPromoteObjective,
                "complete",
            );
            applyObjectiveProgressRewards(
                beforeChoiceReplayPromote,
                app.state,
                "objective-rewards-choice-replay-promote",
                { silentGameMessage: true },
            );
            const invocationIdsBeforeReplay = Object.keys(
                app.rewardRuntime.appliedInvocationIds || {},
            ).sort();
            let staleReplayError = null;
            try {
                applyObjectiveProgressRewards(
                    staleChoiceReplayState,
                    app.state,
                    "objective-rewards-stale-background-replay",
                    { silentGameMessage: true },
                );
            } catch (error) {
                staleReplayError = error;
            }
            const invocationIdsAfterReplay = Object.keys(
                app.rewardRuntime.appliedInvocationIds || {},
            ).sort();
            devAssert(
                !staleReplayError &&
                    !!app.state.characters?.["Choice Replay Ally"] &&
                    JSON.stringify(invocationIdsAfterReplay) ===
                        JSON.stringify(invocationIdsBeforeReplay),
                "a stale background objective baseline cannot replay a choice introduction after that character joins the party",
                {
                    error: staleReplayError?.message || "",
                    choiceReplayInvocationIds,
                    invocationIdsBeforeReplay,
                    invocationIdsAfterReplay,
                    partyCharacter: app.state.characters?.["Choice Replay Ally"],
                },
            );
            devAssert(
                rewardResult?.applied,
                "objective reward pass reports that rewards were applied",
                { rewardResult },
            );
            const rewardOnlyObjective = app.state.objectives.items.find(
                (item) => item.id === "reward-only-objective",
            );
            const rewardOnlyFollowup = app.state.objectives.items.find(
                (item) => item.id === "reward-only-followup",
            );
            devAssert(
                runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                    "The reward smoke shared bundle was applied.",
                ) &&
                    app.state.story_inventory?.bundle_tokens === 2,
                "objective reward bundle references apply shared rewards through the normal reward path",
                {
                    rewardBundles: app.state.reward_bundles,
                    storyRules: app.state.story_rules,
                    storyInventory: app.state.story_inventory,
                },
            );
            devTestLog("Reward-only transition result", {
                rewardOnlyObjective,
                rewardOnlyObjectiveStatus: effectiveObjectiveStatus(
                    rewardOnlyObjective,
                    app.state,
                ),
                rewardOnlyFollowup,
                rewardOnlyFollowupStatus: effectiveObjectiveStatus(
                    rewardOnlyFollowup,
                    app.state,
                ),
                activeId: app.state.objectives.active_id,
                selectedOutput:
                    app.objectiveRuntime?.selectedOutputById?.[
                        "reward-only-objective"
                    ] || "",
                rewardOnlyApplied: rewardResult.rewardOnlyApplied,
            });
            devAssert(
                effectiveObjectiveStatus(
                    rewardOnlyObjective,
                    app.state,
                ) === "complete" &&
                    effectiveObjectiveStatus(
                        rewardOnlyFollowup,
                        app.state,
                    ) === "active" &&
                    runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                        "The reward-only transition bundle was applied.",
                    ) &&
                    rewardResult.rewardOnlyApplied === true,
                "reward-only objectives apply rewards immediately when reached and move to their next objective",
                {
                    rewardOnlyObjective,
                    rewardOnlyFollowup,
                    activeId: app.state.objectives.active_id,
                    rewardResult,
                    storyRules: app.state.story_rules,
                },
            );
            devAssert(
                app.state.story_clock?.elapsed_minutes === 90 &&
                    app.state.timed_events?.["reward-deadline"]?.status === "active",
                "advance_time rewards move the additive story clock and start triggered timed events",
                {
                    clock: app.state.story_clock,
                    event: app.state.timed_events?.["reward-deadline"],
                },
            );
            advanceStoryTime(app.state, 60, "timed warning smoke");
            processTimedEvents(app.state, "timed warning smoke");
            devAssert(
                app.state.timed_events?.["reward-deadline"]?.applied_stage_ids?.includes("warning") &&
                    app.messages.some(
                        (message) =>
                            message.role === "game" &&
                            /deadline is getting close/i.test(message.text || ""),
                    ),
                "timed-event warning stages fire from elapsed game time and show configured player-visible messages",
                {
                    event: app.state.timed_events?.["reward-deadline"],
                    messages: app.messages.filter((message) => message.role === "game"),
                },
            );
            advanceStoryTime(app.state, 60, "timed deadline smoke");
            processTimedEvents(app.state, "timed deadline smoke");
            const deadlineObjective = app.state.objectives.items.find(
                (item) => item.id === "deadline-response",
            );
            devAssert(
                app.state.timed_events?.["reward-deadline"]?.status === "complete" &&
                    deadlineObjective?.status === "active" &&
                    deadlineObjective?.locked_until_complete === true &&
                    app.state.objectives.active_id === "deadline-response" &&
                    runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                        "The reward smoke deadline has arrived.",
                    ) &&
                    Object.keys(app.rewardRuntime.appliedInvocationIds || {}).filter((id) =>
                        id.startsWith(
                            "timed-event-reward-deadline--site-deadline--reward-",
                        ),
                    ).length === 2 &&
                    app.messages.some(
                        (message) =>
                            message.role === "game" &&
                            /deadline has arrived/i.test(message.text || ""),
                    ),
                "timed-event deadlines atomically apply exact-site reward markers, force a locked objective, and show a visible game message",
                {
                    event: app.state.timed_events?.["reward-deadline"],
                    deadlineObjective,
                    storyRules: app.state.story_rules,
                    messages: app.messages.filter((message) => message.role === "game"),
                },
            );
            setObjectiveFocus("optional-side-objective", {
                close: false,
                renderAfter: false,
                suppressNotice: true,
            });
            devAssert(
                app.state.objectives.active_id === "deadline-response" &&
                    app.state.objectives.focus_id !== "optional-side-objective",
                "locked objectives prevent switching to side objectives until complete",
                app.state.objectives,
            );
            clearCurrentObjective({
                close: false,
                renderAfter: false,
                suppressNotice: true,
            });
            devAssert(
                app.state.objectives.active_id === "deadline-response" &&
                    app.state.objectives.no_current !== true,
                "locked objectives prevent clearing the current objective until complete",
                app.state.objectives,
            );
            devAssert(
                (app.state.player.inventory || []).includes("Reward Gem"),
                "objective item reward adds the item to player inventory",
                { inventory: app.state.player.inventory },
            );
            devAssert(
                app.state.world_map.locations["loc-reward-gate"]?.discovered === true,
                "objective location reward unlocks the target location",
                { rewardGate: app.state.world_map.locations["loc-reward-gate"] },
            );
            devAssert(
                runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                    "The reward smoke objective is complete.",
                ),
                "objective story-rule reward writes the requested rule",
                { storyRules: app.state.story_rules },
            );
            devAssert(
                !runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                    "This matched story rule should be removed.",
                ),
                "objective remove_state_list_item reward removes object entries by match",
                { storyRules: app.state.story_rules },
            );
            const storyRuleText = "The reward smoke objective is complete.";
            const storyRuleId = "reward_smoke_done";
            const replyPrompt = withUniversalAiPromptContext("Reply smoke prompt.");


            const stateCheckContextText = JSON.stringify(
                buildStateCheckContext(app.state),
            );
            const autoPlayerPrompt = buildAutoPlayerTurnPrompt();
            devAssert(
                !autoPlayerPrompt.includes(storyRuleText) &&
                    !autoPlayerPrompt.includes(storyRuleId),
                "story-rule text and ids are not included in auto-player prompts",
                { autoPlayerPrompt },
            );
            devAssert(
                localWatcher?.full_character?.role === "updated reward watcher",
                "objective set_state_field reward updates target character fields",
                { localWatcher },
            );
            devAssert(
                localWatcher?.full_character?.outfits?.some(
                    (outfit) =>
                        outfit.id === "reward-field-kit" &&
                        outfit.name === "Reward Field Kit" &&
                        outfit.clothing?.shirt === "smoke reward field shirt",
                ),
                "objective grant_outfit reward adds a normalized saved outfit to the targeted character",
                { localWatcher },
            );
            devAssert(
                localWatcher?.full_character?.outfits?.some(
                    (outfit) => outfit.id === "reward-training-kit",
                ) &&
                    (rewardResult?.rewardMessages || []).some((message) =>
                        /received and equipped Reward Training Kit/i.test(
                            String(message || ""),
                        ),
                    ),
                "objective grant_outfit equip option grants and immediately applies an outfit before later rewards continue",
                {
                    localWatcher,
                    rewardMessages: rewardResult?.rewardMessages || [],
                },
            );
            devAssert(
                localWatcher?.full_character?.active_outfit_id ===
                    "reward-field-kit" &&
                    localWatcher?.full_character?.clothing?.shirt ===
                        "smoke reward field shirt" &&
                    localWatcher?.full_character?.clothing?.pants ===
                        "smoke reward field trousers",
                "objective equip_outfit reward atomically applies the saved clothing snapshot and active outfit id",
                { localWatcher },
            );
            const outfitMutationObjective = {
                id: "outfit-mutation-smoke",
                title: "Outfit Mutation Smoke",
            };
            const maleOnlyGrantApplied = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "grant_outfit",
                    character_id: "Local Watcher",
                    male_outfit: {
                        id: "male-only-optional",
                        name: "Male Only Optional",
                        clothing: { shirt: "male-only smoke shirt" },
                    },
                },
                "objective outfit mutation smoke",
            );
            const nonMaleGrantApplied = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "grant_outfit",
                    character_id: "Local Watcher",
                    non_male_outfit: {
                        id: "non-male-only-optional",
                        name: "Non-Male Only Optional",
                        clothing: { shirt: "non-male smoke shirt" },
                    },
                },
                "objective outfit mutation smoke",
            );
            devAssert(
                maleOnlyGrantApplied === false &&
                    nonMaleGrantApplied === true &&
                    !localWatcher.full_character.outfits.some(
                        (outfit) => outfit.id === "male-only-optional",
                    ) &&
                    localWatcher.full_character.outfits.some(
                        (outfit) => outfit.id === "non-male-only-optional",
                    ),
                "conditional grant_outfit adds only the finalized gender presentation and otherwise no-ops",
                { outfits: localWatcher.full_character.outfits },
            );
            const deletedOne = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "delete_outfit",
                    character_id: "Local Watcher",
                    outfit_id: "non-male-only-optional",
                },
                "objective outfit mutation smoke",
            );
            const deletedAll = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "delete_all_outfits",
                    character_id: "Local Watcher",
                },
                "objective outfit mutation smoke",
            );
            devAssert(
                deletedOne === true &&
                    deletedAll === true &&
                    localWatcher.full_character.outfits.length === 0 &&
                    !localWatcher.full_character.active_outfit_id &&
                    !validClothingSlots().some((slot) =>
                        clothingItemText(
                            localWatcher.full_character.clothing?.[slot],
                        ),
                    ),
                "delete_outfit and delete_all_outfits permanently remove runtime outfits and clear active clothing",
                { localWatcher },
            );
            const pairedNonMaleGrant = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "grant_outfit",
                    character_id: "Local Watcher",
                    equip: true,
                    male_outfit: {
                        id: "paired-runtime-kit",
                        name: "Paired Runtime Male Kit",
                        clothing: { shirt: "paired male smoke shirt" },
                    },
                    non_male_outfit: {
                        id: "paired-runtime-kit",
                        name: "Paired Runtime Non-Male Kit",
                        clothing: { shirt: "paired non-male smoke shirt" },
                    },
                },
                "objective outfit mutation smoke",
            );
            const pairedMaleGrant = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "grant_outfit",
                    character_id: "Disposable Watcher",
                    equip: true,
                    male_outfit: {
                        id: "paired-runtime-kit",
                        name: "Paired Runtime Male Kit",
                        clothing: { shirt: "paired male smoke shirt" },
                    },
                    non_male_outfit: {
                        id: "paired-runtime-kit",
                        name: "Paired Runtime Non-Male Kit",
                        clothing: { shirt: "paired non-male smoke shirt" },
                    },
                },
                "objective outfit mutation smoke",
            );
            devAssert(
                pairedNonMaleGrant === true &&
                    pairedMaleGrant === true &&
                    localWatcher.full_character.clothing?.shirt ===
                        "paired non-male smoke shirt" &&
                    disposableWatcher.full_character.clothing?.shirt ===
                        "paired male smoke shirt",
                "equipped gender-conditional grants select the finalized non-male and male runtime presentations",
                { localWatcher, disposableWatcher },
            );
            devAssert(
                app.objectiveRewardPreflightActive !== true,
                "outfit warning smoke reaches the live reward path outside preflight",
                {
                    objectiveRewardPreflightActive:
                        app.objectiveRewardPreflightActive,
                },
            );
            const staleIssuePopup = document.querySelector(
                ".popup-modal.open #issueDismissBtn",
            )?.closest(".popup-modal");
            staleIssuePopup
                ?.querySelector("#issueDismissBtn")
                ?.click();
            app.issuePopupOpen = false;
            const missingEquipApplied = applyObjectiveReward(
                app.state,
                outfitMutationObjective,
                {
                    type: "equip_outfit",
                    character_id: "Local Watcher",
                    outfit_id: "missing-runtime-outfit",
                },
                "objective outfit mutation smoke",
            );
            devAssert(
                missingEquipApplied === false &&
                    app.issuePopupOpen &&
                    !!$("issueExportBothBtn") &&
                    /Outfit Equip Failed/i.test(
                        $("issueExportBothBtn")?.closest(".popup-modal")
                            ?.textContent || "",
                    ),
                "failed outfit equip is a warning with Export Both and does not throw",
                {
                    missingEquipApplied,
                    issuePopupOpen: app.issuePopupOpen,
                },
            );
            const outfitWarningPopup = $("issueExportBothBtn")?.closest(
                ".popup-modal.open",
            );
            outfitWarningPopup
                ?.querySelector("#issueDismissBtn")
                ?.click();
            devAssert(
                !outfitWarningPopup?.isConnected && !app.issuePopupOpen,
                "outfit equip warning closes through its own popup handler",
            );
            applyRuntimeContentPolicy(app.state);
            const reloadedRewardState = repairAiGeneratedState(
                JSON.parse(JSON.stringify(app.state)),
            );
            devAssert(
                app.state.world_flags?.reward_smoke_ending ===
                    "ENDING - REWARD SMOKE" &&
                    reloadedRewardState.world_flags?.reward_smoke_ending ===
                        "ENDING - REWARD SMOKE",
                "objective set_state_field world flags survive runtime normalization and save reload",
                {
                    runtimeWorldFlags: app.state.world_flags,
                    reloadedWorldFlags: reloadedRewardState.world_flags,
                },
            );
            devAssert(
                !(app.state.recent_changes || []).includes(
                    "Reward smoke list item added.",
                ),
                "objective add/remove list rewards can add then remove a list item",
                { recentChanges: app.state.recent_changes },
            );
            devAssert(
                !npcIsDead(localWatcher),
                "objective kill_character respects can_die false",
                { localWatcher },
            );
            devAssert(
                npcIsDead(disposableWatcher),
                "objective kill_character kills can_die true targets",
                { disposableWatcher },
            );
            devAssert(
                npcIsDead(unlockedWatcher) &&
                    unlockedWatcher?.can_die === true &&
                    unlockedWatcher?.full_character?.can_die === true,
                "objective set_state_field can unlock can_die before kill_character",
                { unlockedWatcher },
            );
            devAssert(
                app.profileImageQueue.some((item) => item?.name === "Local Watcher") ||
                    app.profileImageQueued.has("Local Watcher"),
                "objective generate_profile_image queues a profile image",
                {
                    queue: app.profileImageQueue,
                    queued: [...app.profileImageQueued],
                },
            );
            devAssert(
                await devWaitFor(
                    () =>
                        (app.images || []).some((image) =>
                            /reward smoke solo image/i.test(String(image.reason || "")),
                        ),
                    1500,
                    "objective reward solo normal image queue",
                ),
                "objective generate_solo_normal_image queues a solo normal image",
                { images: app.images },
            );
            const rewardSoloImage = (app.images || []).find(
                (image) => /reward smoke solo image/i.test(String(image.reason || "")),
            );
            devAssert(
                !!rewardSoloImage &&
                    /tailored blue travel coat/i.test(String(rewardSoloImage.prompt || "")) &&
                    /quiet moonlit courtyard/i.test(String(rewardSoloImage.prompt || "")),
                "objective solo image rewards pass description and background overrides into the generated prompt",
                { rewardSoloImage },
            );
            await devWaitFor(
                () =>
                    (app.images || []).some(
                        (image) =>
                            image.storyImageRewardId === "reward-smoke-story-image",
                    ),
                1500,
                "objective reward authored story image queue",
            );
            const storyRewardImage = (app.images || []).find(
                (image) => image.storyImageRewardId === "reward-smoke-story-image",
            );
            devAssert(
                !!storyRewardImage &&
                    /old locked wooden door/i.test(String(storyRewardImage.prompt || "")) &&
                    /modern objects/i.test(
                        String(storyRewardImage.negativePrompt || ""),
                    ) &&
                    Array.isArray(storyRewardImage.targets) &&
                    storyRewardImage.targets.length === 0,
                "objective generate_story_image queues an authored non-character story image",
                { storyRewardImage, images: app.images },
            );
            const hostedProfileTarget = getNpcEntry(
                "Hosted Watcher",
                "reward-square",
            );
            const hostedProfileImage = activeProfileImage(
                hostedProfileTarget?.full_character || hostedProfileTarget,
            );
            const hostedSoloImage = (app.images || []).find(
                (image) =>
                    image.promptType === "authored solo character image" &&
                    image.reason === "reward smoke hosted solo image",
            );
            const hostedStoryImage = (app.images || []).find(
                (image) =>
                    image.storyImageRewardId ===
                    "reward-smoke-hosted-story-image",
            );
            devAssert(
                hostedProfileImage?.pending === false &&
                    hostedProfileImage?.hosted_url ===
                        devSmokePublicImageUrl(
                            "objective-profile",
                            "disposable-watcher",
                        ) &&
                    hostedSoloImage?.pending === false &&
                    hostedSoloImage?.hosted_url ===
                        devSmokePublicImageUrl(
                            "objective-solo",
                            "disposable-watcher",
                        ) &&
                    hostedStoryImage?.pending === false &&
                    hostedStoryImage?.hosted_url ===
                        devSmokePublicImageUrl(
                            "objective-story",
                            "hosted-door",
                        ),
                "profile, solo-character, and story-image rewards use authored hosted images without starting generation",
                {
                    hostedProfileImage,
                    hostedSoloImage,
                    hostedStoryImage,
                },
            );
            devAssert(
                !(rewardResult?.rewardMessages || []).some((message) =>
                    /reward_smoke_done/i.test(String(message || "")),
                ),
                "objective story-rule reward stays hidden from player-facing reward messages",
                { rewardMessages: rewardResult?.rewardMessages || [] },
            );
            devAssert(
                !!followupObjective &&
                    ["active", "queued"].includes(String(followupObjective.status || "")) &&
                    followupObjective.available_now === true,
                "objective start reward starts the follow-up story objective",
                { followupObjective, objectives: app.state.objectives },
            );
            devAssert(
                introducedNpc?.future_character_id === "mira-reward",
                "objective future-character introduction reward creates the NPC entry",
                {
                    introducedNpc,
                    npcDirectory: app.state.npc_directory,
                    scene: app.state.scene,
                },
            );
            devAssert(
                !!introducedProfile ||
                    app.profileImageQueued.has("Mira Reward") ||
                    app.profileImageQueue.some((item) => item?.name === "Mira Reward") ||
                    app.profileImageGenerating.has("Mira Reward"),
                "objective future-character introduction queues the missing first profile image",
                {
                    introducedProfile,
                    queued: [...app.profileImageQueued],
                    queue: app.profileImageQueue,
                    generating: [...app.profileImageGenerating],
                },
            );
            devAssert(
                !!app.state.characters["Mira Reward"],
                "objective future-character promotion reward adds the party character",
                {
                    promoteRewardResult,
                    partyCharacter: app.state.characters["Mira Reward"],
                    futureCast: app.state.future_cast.items["mira-reward"],
                    scene: app.state.scene,
                },
            );
            const duplicatePromotionReward = {
                type: "promote_future_character_to_party",
                character_id: "mira-reward",
            };
            const duplicatePromotionCharacter = app.state.characters["Mira Reward"];
            const duplicatePromotionPresence = clone(
                app.state.scene?.party_members_present || [],
            );
            const duplicatePromotionChanges = clone(app.state.recent_changes || []);
            let duplicatePromotionPreflightError = "";
            try {
                preflightObjectiveRewardApplications(
                    app.state,
                    [
                        {
                            objective: promoteObjective,
                            reward: duplicatePromotionReward,
                            rewardIndex: 0,
                            rewardPath: "duplicate-promotion",
                        },
                    ],
                    "objective-rewards-smoke duplicate promotion",
                );
            } catch (error) {
                duplicatePromotionPreflightError = error?.message || String(error);
            }
            const duplicatePromotionApplied = applyObjectiveReward(
                app.state,
                promoteObjective,
                duplicatePromotionReward,
                "objective-rewards-smoke duplicate promotion",
            );
            devAssert(
                !duplicatePromotionPreflightError &&
                    duplicatePromotionApplied === true &&
                    app.state.characters["Mira Reward"] === duplicatePromotionCharacter &&
                    JSON.stringify(app.state.scene?.party_members_present || []) ===
                        JSON.stringify(duplicatePromotionPresence) &&
                    JSON.stringify(app.state.recent_changes || []) ===
                        JSON.stringify(duplicatePromotionChanges),
                "duplicate future-character promotion rewards preflight and apply as no-ops",
                {
                    duplicatePromotionPreflightError,
                    duplicatePromotionApplied,
                    partyMembersPresent: app.state.scene?.party_members_present || [],
                    recentChanges: app.state.recent_changes || [],
                },
            );
            devAssert(
                !!activeProfileImage(app.state.characters["Mira Reward"]) ||
                    app.profileImageQueued.has("Mira Reward") ||
                    app.profileImageQueue.some((item) => item?.name === "Mira Reward") ||
                    app.profileImageGenerating.has("Mira Reward"),
                "objective future-character promotion preserves or continues the missing first profile image",
                {
                    partyProfile: activeProfileImage(app.state.characters["Mira Reward"]),
                    partyCharacter: app.state.characters["Mira Reward"],
                },
            );
            devAssert(
                profileEntity("Mira Reward") === app.state.characters["Mira Reward"],
                "profile entity lookup prefers the promoted party character over a same-name NPC shell",
                {
                    partyProfile: activeProfileImage(app.state.characters["Mira Reward"]),
                    npcProfile: activeProfileImage(introducedNpc?.full_character),
                },
            );
            devAssert(
                app.state.future_cast.items["mira-reward"]?.status === "joined",
                "objective future-character promotion reward marks the future cast entry joined",
                {
                    promoteRewardResult,
                    partyCharacter: app.state.characters["Mira Reward"],
                    futureCast: app.state.future_cast.items["mira-reward"],
                    scene: app.state.scene,
                },
            );
            devAssert(
                !("objective" in rewardObjective) && !("steps" in rewardObjective),
                "objective reward smoke fixture stays on the summary-only objective schema",
                { rewardObjective },
            );
            devAssert(
                rewardResult?.applied &&
                    (app.state.player.inventory || []).includes("Reward Gem") &&
                    app.state.world_map.locations["loc-reward-gate"]?.discovered === true &&
                    runtimeStoryRulesForPrompt(app.state.story_rules).includes(
                        "The reward smoke objective is complete.",
                    ) &&
                    !!followupObjective &&
                    ["active", "queued"].includes(String(followupObjective.status || "")) &&
                    followupObjective.available_now === true &&
                    introducedNpc?.future_character_id === "mira-reward" &&
                    promoteRewardResult?.applied &&
                    !!app.state.characters["Mira Reward"] &&
                    app.state.future_cast.items["mira-reward"]?.status === "joined" &&
                    !("objective" in rewardObjective) &&
                    !("steps" in rewardObjective),
                "objective rewards apply items, locations, flags, objectives, future NPC introduction, and party promotion",
                {
                    rewardResult,
                    progression: app.state.progression,
                    inventory: app.state.player.inventory,
                    rewardGate: app.state.world_map.locations["loc-reward-gate"],
                    storyRules: app.state.story_rules,
                    followupObjective,
                    introducedNpc,
                    partyCharacter: app.state.characters["Mira Reward"],
                    futureCast: app.state.future_cast.items["mira-reward"],
                },
            );
            const preflightState = clone(app.state);
            const rewardInvocationsBeforePreflight = Object.keys(
                app.rewardRuntime?.appliedInvocationIds || {},
            );
            preflightState.world_flags ||= {};
            preflightState.world_flags.preflight_first_reward = false;
            preflightState.objectives.items.push({
                id: "invalid-preflight-reward-objective",
                title: "Invalid Preflight Reward Objective",
                status: "complete",
                completion_control: "player",
                rewards: [
                    {
                        type: "set_state_field",
                        path: ["world_flags", "preflight_first_reward"],
                        value: true,
                    },
                    {
                        type: "add_state_list_item",
                        path: ["player", "starting_known_facts"],
                        value: {
                            id: "invalid-preflight-fact",
                            text: "This definition-only fact must never be applied at runtime.",
                        },
                    },
                ],
            });
            let preflightFailure = null;
            try {
                applyCompletedObjectiveRewards(
                    clone(preflightState),
                    preflightState,
                    "objective reward preflight smoke",
                );
            } catch (error) {
                preflightFailure = error;
            }
            devAssert(
                preflightFailure?.objectiveRewardFailure === true &&
                    preflightState.world_flags.preflight_first_reward === false &&
                    JSON.stringify(Object.keys(app.rewardRuntime?.appliedInvocationIds || {})) ===
                        JSON.stringify(rewardInvocationsBeforePreflight),
                "objective rewards preflight the entire transaction before applying or logging any reward",
                {
                    error: preflightFailure?.message || "",
                    details: preflightFailure?.objectiveRewardDetails,
                    worldFlags: preflightState.world_flags,
                    appliedRewards: Object.keys(app.rewardRuntime?.appliedInvocationIds || {}),
                },
            );
            const preflightFailureReported = reportObjectiveRewardFailure(
                preflightFailure,
                { source: "objective reward preflight smoke" },
            );
            devAssert(
                preflightFailureReported && app.issuePopupOpen && !!$("issueDismissBtn"),
                "objective reward preflight failures open the standard EmberAdventures issue popup",
                {
                    preflightFailureReported,
                    issuePopupOpen: app.issuePopupOpen,
                },
            );
            $("issueDismissBtn")?.click();
            app.issuePopupOpen = false;
            const immutableObjectiveMutationTemplate = {lite: true,
                id: "immutable-objective-mutation-validation-smoke",
                title: "Immutable Objective Mutation Validation Smoke",
                state: {
                    ...clone(defaultState),
                    objectives: {
                        active_id: "immutable-mutation-owner",
                        items: [
                            {
                                id: "immutable-mutation-owner",
                                title: "Immutable Mutation Owner",
                                type: "story",
                                status: "active",
                                summary: "Reject objective state mutations.",
                                completion_control: "choice",
                                completion_criteria: "Choose an option.",
                                rewards: [
                                    {
                                        type: "set_state_field",
                                        field_path: ["objectives", "active_id"],
                                        value: "invalid",
                                    },
                                ],
                                choices: [
                                    {
                                        id: "invalid-choice",
                                        title: "Invalid Choice",
                                        summary: "Invalid objective mutation.",
                                        rewards: [
                                            {
                                                type: "add_state_list_item",
                                                field_path: [
                                                    "state",
                                                    "objectives",
                                                    "items",
                                                ],
                                                value: "invalid",
                                            },
                                        ],
                                    },
                                ],
                                outcome_routes: [
                                    {
                                        id: "invalid-route",
                                        fallback: true,
                                        ending_type: "invalid",
                                        rewards: [
                                            {
                                                type: "modify_number",
                                                field_path: [
                                                    "objectives",
                                                    "invalid_progress",
                                                ],
                                                operation: "add",
                                                value: 1,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    reward_bundles: {
                        "invalid-objective-bundle": [
                            {
                                type: "remove_state_list_item",
                                field_path: ["objectives", "items"],
                                value: "invalid",
                            },
                        ],
                    },
                    reward_templates: {
                        "invalid-objective-template": {
                            parameters: {},
                            rewards: [
                                {
                                    type: "modify_integer",
                                    field_path: [
                                        "objectives",
                                        "invalid_counter",
                                    ],
                                    operation: "add",
                                    value: 1,
                                },
                            ],
                        },
                    },
                    story_shops: {
                        "invalid-objective-shop": {
                            id: "invalid-objective-shop",
                            title: "Invalid Objective Shop",
                            type: "general",
                            npc_location_id: "invalid-objective-shop",
                            items: [
                                {
                                    id: "invalid-listing",
                                    rewards: [
                                        {
                                            type: "set_state_field",
                                            field_path: [
                                                "objectives",
                                                "active_id",
                                            ],
                                            value: "invalid",
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    character_shop_cost_templates: {
                        "invalid-objective-cost-template": {
                            type: "stat",
                            costs: [
                                {
                                    label: "Invalid cost",
                                    required_stat: "invalid_cost",
                                    op: ">=",
                                    available_expression: 1,
                                },
                            ],
                            effects: [
                                {
                                    label: "Invalid objective effect",
                                    value_stat: "invalid_return",
                                    operation: "add",
                                    field_path: [
                                        "objectives",
                                        "invalid_counter",
                                    ],
                                },
                            ],
                        },
                    },
                    timed_events: {
                        "invalid-objective-timer": {
                            id: "invalid-objective-timer",
                            trigger: { immediately: true },
                            time_limit_minutes: 1,
                            rewards: [
                                {
                                    type: "set_state_field",
                                    field_path: ["objectives", "active_id"],
                                    value: "invalid",
                                },
                            ],
                            stages: [
                                {
                                    id: "invalid-stage",
                                    after_minutes: 1,
                                    rewards: [
                                        {
                                            type: "set_state_field",
                                            field_path: [
                                                "objectives",
                                                "active_id",
                                            ],
                                            value: "invalid",
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    story_pacing: {
                        timeline: {
                            "invalid-objective-pacing": {
                                id: "invalid-objective-pacing",
                                trigger: { at_elapsed_minutes: 1 },
                                accept: {
                                    rewards: [
                                        {
                                            type: "set_state_field",
                                            field_path: [
                                                "objectives",
                                                "active_id",
                                            ],
                                            value: "invalid",
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            };
            const immutableMutationErrors = validateStoryDefinition(
                immutableObjectiveMutationTemplate,
            ).errors.filter(
                (error) => error.code === "immutable_objectives",
            );
            const immutableMutationPaths = immutableMutationErrors.map(
                (error) => error.path,
            );
            devAssert(
                immutableMutationErrors.length === 10 &&
                    immutableMutationPaths.some((path) =>
                        path.includes(".choices.0.rewards.0.field_path"),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.includes(".outcome_routes.0.rewards.0.field_path"),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith("reward_bundles."),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith("reward_templates."),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith("story_shops."),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith(
                            "character_shop_cost_templates.",
                        ),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith("timed_events."),
                    ) &&
                    immutableMutationPaths.some((path) =>
                        path.startsWith("story_pacing."),
                    ),
                "story import and publish validation recursively reject objective-state mutations from every authored reward source",
                {
                    immutableMutationErrors,
                    immutableMutationPaths,
                },
            );
            const unapprovedMutationTemplate = clone(
                immutableObjectiveMutationTemplate,
            );
            unapprovedMutationTemplate.state.unapproved_runtime = {
                value: 0,
            };
            unapprovedMutationTemplate.state.objectives.items[0].rewards.push({
                type: "set_state_field",
                field_path: ["unapproved_runtime", "value"],
                value: 1,
            });
            const unapprovedMutationErrors = validateStoryDefinition(
                unapprovedMutationTemplate,
            ).errors.filter(
                (error) => error.code === "unapproved_state_path",
            );
            devAssert(
                unapprovedMutationErrors.length === 1 &&
                    unapprovedMutationErrors[0].path.includes(
                        ".rewards.1.field_path",
                    ),
                "story import and publish validation reject existing state paths outside the positive runtime mutation allowlist",
                { unapprovedMutationErrors },
            );
            const animalDefinition = {
                version: 1,
                id: "smoke-young-hawk",
                name: "Smoke Hawk",
                source: "Original",
                creation_tool: "EmberAdventures",
                can_die: false,
                gender: "female",
                age: 4,
                role: "animal companion",
                species: "hawk",
                physical_description: "A small russet hawk with bright gold eyes and a white tail tip.",
                personality_description: "Alert, loyal, curious, and quick to defend trusted companions.",
                communication_style: "Communicates through calls, posture, and deliberate gestures.",
                starting_relationship_to_player: "new animal companion",
                starting_trust: 4,
                starting_affection: 3,
                starting_state_of_mind: "watchful",
                starting_physical_state: "healthy",
                starting_pose: "perched nearby",
                starting_known_facts: [],
                created_at: "2026-08-21T00:00:00.000Z",
                updated_at: "2026-08-21T00:00:00.000Z",
            };

            devAssert(
                exactObjectiveRewardValidationErrors({
                    type: "replace_character_definition",
                    target_character_id: "smoke-young-hawk",
                    source_future_character_id: "smoke-adult-form",
                    reason: "The transformation is complete.",
                }, "reward").length === 0,
                "character-definition replacement is an exact supported reward shape",
            );
            devAssert(
                exactObjectiveRewardValidationErrors({
                    type: "generate_solo_normal_image",
                    target: "Smoke Ally",
                    reason: "Show the ceremonial look.",
                    outfit_id: "ceremonial-look",
                    description: "A ceremonial blue coat.",
                    background: "A quiet courtyard.",
                }, "reward").length === 0,
                "solo image rewards accept an outfit and optional description/background overrides without an equip reward",
            );
            devAssert(
                exactObjectiveRewardValidationErrors({
                    type: "introduce_future_character",
                    character_id: "smoke-young-hawk",
                    npc_location_id: "smoke-location",
                    scene_presence: "active",
                    reason: "The hawk arrives.",
                }, "reward").length === 0 &&
                    exactObjectiveRewardValidationErrors({
                        type: "introduce_future_character",
                        character_id: "smoke-young-hawk",
                        npc_location_id: "smoke-location",
                        scene_presence: "invalid",
                        reason: "Invalid presence.",
                    }, "reward").some((error) => error.path === "reward.scene_presence"),
                "future-character introductions distinguish active, nearby, and absent scene presence exactly",
            );
            const nativeRequiresObjectives = [
                {
                    id: "smoke-required-source",
                    status: "active",
                    completion_control: "player",
                    route_control: "deterministic",
                    next_objectives: [{
                        id: "smoke-required-source-output",
                        objective_id: "smoke-required-target",
                        target_input_group_id: "smoke-required-target-input",
                        completion_instruction: "Continue after the source objective completes.",
                        rewards: [],
                    }],
                },
                {
                    id: "smoke-required-target",
                    status: "hidden",
                    completion_control: "player",
                    route_control: "deterministic",
                    requires: ["smoke-required-source"],
                    next_objectives: [{
                        id: "smoke-required-target-ending",
                        completion_instruction: "Continue after the required objective.",
                        rewards: [],
                        ending_type: "freeplay",
                    }],
                },
            ];
            devAssert(
                objectiveTransitionContractValidationErrors(nativeRequiresObjectives).length === 0,
                "native objective links use output-level completion instruction with requirements",
                objectiveTransitionContractValidationErrors(nativeRequiresObjectives),
            );
            const missingRequiresInstruction = clone(nativeRequiresObjectives);
            missingRequiresInstruction[0].next_objectives[0].completion_instruction = "";
            devAssert(
                objectiveTransitionContractValidationErrors(missingRequiresInstruction).some(
                    (error) => error.path.endsWith(".next_objectives.0.completion_instruction"),
                ),
                "objective links reject a source output without its completion instruction",
                objectiveTransitionContractValidationErrors(missingRequiresInstruction),
            );
            app.profileImageQueueRunning = false;
            app.profileImageQueue = [];
            app.profileImageQueued.clear();
            addMessage("system", "Objective rewards smoke test passed.");
            showNotice("Live Test Passed", "Objective rewards smoke test passed.");
            scheduleActiveGameSave();
            render();
            devTestLog("Scenario complete: objective-rewards-smoke");
        }

