
        function runtimeMessageTemplateCharacterToken(requested = "") {
            const explicit = String(requested || "").match(
                /^character(?:[_-]([a-z][a-z_-]*))?(?:\s*:\s*(.+))?$/i,
            );
            if (!explicit) return null;
            const token = String(explicit[1] || "").toLowerCase().replace(/_/g, "-");
            const characterId = String(explicit[2] || "").trim();
            const capitalized = /-cap$/.test(token);
            const kind = runtimeMessageTemplateReferenceKind(token);
            if (!kind) return null;
            return { characterId, kind, capitalized, self: !characterId };
        }

        const runtimeMessageTemplateConditionalPattern = /\|\[([MF])\|([^\[\]|]+)\|([^\[\]|]+)\]\|/g;
        const runtimeMessageTemplateSimplePattern = /\|\[([^\[\]|]{1,160})\]\|/g;

        function runtimeMessageTemplateConditionalPresentation(
            defaultPresentation = "M",
            preferredGenders = null,
        ) {
            const fallback = defaultPresentation === "F" ? "F" : "M";
            const preferred = Array.isArray(preferredGenders)
                ? preferredGenders
                : preferredRuntimeCharacterGenders();
            if (!preferred.length) return fallback;
            const male = preferred.includes("male");
            const nonMale = preferred.some((gender) => gender !== "male");
            if (male === nonMale) return fallback;
            return male ? "M" : "F";
        }

        function materializeRuntimeConditionalText(text = "", preferredGenders = null) {
            return String(text || "").replace(
                runtimeMessageTemplateConditionalPattern,
                (_match, defaultPresentation, maleText, femaleText) =>
                    runtimeMessageTemplateConditionalPresentation(
                        defaultPresentation,
                        preferredGenders,
                    ) === "M"
                        ? maleText
                        : femaleText,
            );
        }

        function runtimeMessageTemplateReferenceKind(token = "") {
            const normalized = String(token || "")
                .toLowerCase()
                .replace(/_/g, "-")
                .replace(/-cap$/, "");
            const kinds = {
                "": "name",
                first: "first",
                pronoun: "subject",
                "subject-pronoun": "subject",
                "object-pronoun": "object",
                "possessive-pronoun": "possessive",
                "independent-possessive-pronoun": "independent-possessive",
                "reflexive-pronoun": "reflexive",
                "person-term": "person-term",
                honorific: "honorific",
                "formal-address": "formal-address",
                "monarch-title": "monarch-title",
                "royal-heir-title": "royal-heir-title",
                "noble-title": "noble-title",
                "spouse-term": "spouse-term",
                "parent-term": "parent-term",
                "child-term": "child-term",
                "sibling-term": "sibling-term",
                "uncle-aunt-term": "uncle-aunt-term",
                "nephew-niece-term": "nephew-niece-term",
            };
            return kinds[normalized] || "";
        }

        function runtimeMessageTemplatePlayerTokenKind(normalized = "") {
            const key = String(normalized || "").toLowerCase().replace(/[_\s]+/g, "-");
            if (key === "player" || key === "player-name") return "name";
            if (key === "player-first" || key === "player-first-name") return "first";
            if (!key.startsWith("player-")) return "";
            return runtimeMessageTemplateReferenceKind(key.slice("player-".length));
        }

        const runtimeMessageTemplateGenderedReferenceKinds = Object.freeze([
            "subject",
            "object",
            "possessive",
            "independent-possessive",
            "reflexive",
            "person-term",
            "honorific",
            "formal-address",
            "monarch-title",
            "royal-heir-title",
            "noble-title",
            "spouse-term",
            "parent-term",
            "child-term",
            "sibling-term",
            "uncle-aunt-term",
            "nephew-niece-term",
        ]);

        function runtimeMessageTemplateGenderedValue(
            gender = "",
            kind = "subject",
            capitalized = false,
        ) {
            const male = normalizedCharacterGender(gender) === "male";
            const values = male
                ? {
                      subject: "he",
                      object: "him",
                      possessive: "his",
                      "independent-possessive": "his",
                      reflexive: "himself",
                      "person-term": "man",
                      honorific: "Mr.",
                      "formal-address": "sir",
                      "monarch-title": "king",
                      "royal-heir-title": "prince",
                      "noble-title": "lord",
                      "spouse-term": "husband",
                      "parent-term": "father",
                      "child-term": "son",
                      "sibling-term": "brother",
                      "uncle-aunt-term": "uncle",
                      "nephew-niece-term": "nephew",
                  }
                : {
                      subject: "she",
                      object: "her",
                      possessive: "her",
                      "independent-possessive": "hers",
                      reflexive: "herself",
                      "person-term": "woman",
                      honorific: "Ms.",
                      "formal-address": "ma'am",
                      "monarch-title": "queen",
                      "royal-heir-title": "princess",
                      "noble-title": "lady",
                      "spouse-term": "wife",
                      "parent-term": "mother",
                      "child-term": "daughter",
                      "sibling-term": "sister",
                      "uncle-aunt-term": "aunt",
                      "nephew-niece-term": "niece",
                  };
            const value = values[kind] || values.subject;
            if (kind === "honorific") return value;
            return capitalized ? value.charAt(0).toUpperCase() + value.slice(1) : value;
        }

        function runtimeMessageTemplatePronoun(gender = "", kind = "subject", capitalized = false) {
            return runtimeMessageTemplateGenderedValue(gender, kind, capitalized);
        }

        function buildRuntimeDisplayReferenceMap(state = app.state) {
            const entities = new Map();
            const materializedNames = state?.__runtimeTemplateReferenceNames || {};
            const addEntity = (aliases, character) => {
                if (!character || typeof character !== "object") return;
                for (const alias of aliases) {
                    const key = normalizeRuntimeMessageTemplateKey(alias);
                    if (key && !entities.has(key)) entities.set(key, character);
                }
            };
            addEntity([state?.player?.id], state?.player);
            for (const [key, character] of Object.entries(state?.characters || {}))
                addEntity([key, character?.id, character?.name, character?.fallback_name], character);
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const character = npc?.full_character || npc;
                    addEntity(
                        [key, npc?.id, npc?.npc_id, npc?.name, character?.id, character?.name, character?.fallback_name],
                        character,
                    );
                }
            }
            for (const [key, entry] of Object.entries(state?.future_cast?.items || {})) {
                const character = entry?.full_character || entry?.character || entry;
                addEntity(
                    [key, entry?.id, entry?.character_id, entry?.name, character?.id, character?.name, character?.fallback_name],
                    character,
                );
            }

            const replacements = new Map();
            const addCharacterReplacement = (alias, character) => {
                const normalizedAlias = normalizeRuntimeMessageTemplateKey(alias);
                if (!normalizedAlias || !character) return;
                const displayName = String(materializedNames[normalizedAlias] || character.name || alias || "").trim();
                if (!displayName) return;
                const values = {
                    name: displayName,
                    first: firstRuntimeName(displayName),
                };
                for (const kind of runtimeMessageTemplateGenderedReferenceKinds) {
                    values[kind] = runtimeMessageTemplateGenderedValue(
                        character.gender,
                        kind,
                        false,
                    );
                    values[`${kind}-cap`] = runtimeMessageTemplateGenderedValue(
                        character.gender,
                        kind,
                        true,
                    );
                }
                for (const [kind, result] of Object.entries(values)) {
                    const mapKey = `character:${normalizedAlias}:${kind}`;
                    if (!replacements.has(mapKey)) replacements.set(mapKey, result);
                }
            };
            for (const [alias, character] of entities) addCharacterReplacement(alias, character);
            for (const [alias, displayName] of Object.entries(materializedNames)) {
                const normalizedAlias = normalizeRuntimeMessageTemplateKey(alias);
                if (!normalizedAlias || !displayName) continue;
                replacements.set(`character:${normalizedAlias}:name`, displayName);
                replacements.set(`character:${normalizedAlias}:first`, firstRuntimeName(displayName));
            }

            const playerName = textSlot(state?.player?.name, "Player") || "Player";
            const addPlayer = (key, value) => replacements.set(`player:${key}`, value);
            addPlayer("name", playerName);
            addPlayer("first", firstRuntimeName(playerName));
            for (const kind of runtimeMessageTemplateGenderedReferenceKinds) {
                addPlayer(
                    kind,
                    runtimeMessageTemplateGenderedValue(
                        state?.player?.gender,
                        kind,
                        false,
                    ),
                );
                addPlayer(
                    `${kind}-cap`,
                    runtimeMessageTemplateGenderedValue(
                        state?.player?.gender,
                        kind,
                        true,
                    ),
                );
            }
            return replacements;
        }

        function mapRuntimeDisplayReferenceToken(
            requested = "",
            replacements = new Map(),
            selfCharacter = null,
        ) {
            const explicitCharacter = runtimeMessageTemplateCharacterToken(requested);
            if (explicitCharacter) {
                if (explicitCharacter.self) {
                    if (!selfCharacter)
                        return `[missing self character]`;
                    if (explicitCharacter.kind === "name" || explicitCharacter.kind === "first") {
                        const name = textSlot(selfCharacter.name, "");
                        return explicitCharacter.kind === "first" ? firstRuntimeName(name) : name;
                    }
                    return runtimeMessageTemplateGenderedValue(
                        selfCharacter.gender,
                        explicitCharacter.kind,
                        explicitCharacter.capitalized,
                    );
                }
                const alias = normalizeRuntimeMessageTemplateKey(explicitCharacter.characterId);
                const kind = explicitCharacter.capitalized
                    ? `${explicitCharacter.kind}-cap`
                    : explicitCharacter.kind;
                return (
                    replacements.get(`character:${alias}:${kind}`) ||
                    `[missing character: ${explicitCharacter.characterId || "unknown"}]`
                );
            }
            const normalized = String(requested || "").toLowerCase().replace(/[_\s]+/g, "-");
            const kind = runtimeMessageTemplatePlayerTokenKind(normalized);
            if (!kind) return `[unknown reference: ${requested}]`;
            const capitalized = /-cap$/.test(normalized);
            return replacements.get(`player:${capitalized ? `${kind}-cap` : kind}`) || "";
        }

        function materializeRuntimeDisplayReferenceText(
            text = "",
            replacements = new Map(),
            selfCharacter = null,
        ) {
            if (!String(text || "").includes("|[")) return String(text || "");
            return materializeRuntimeConditionalText(text).replace(runtimeMessageTemplateSimplePattern, (match, key) =>
                mapRuntimeDisplayReferenceToken(
                    String(key || "").trim(),
                    replacements,
                    selfCharacter,
                ),
            );
        }

        function runtimeTemplateSelfCharacter(value = null, inherited = null) {
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

        function materializeRuntimeDisplayReferencesWithSelf(
            value,
            replacements = new Map(),
            selfCharacter = null,
        ) {
            if (typeof value === "string")
                return materializeRuntimeDisplayReferenceText(value, replacements, selfCharacter);
            if (Array.isArray(value))
                return value.map((item) =>
                    materializeRuntimeDisplayReferencesWithSelf(item, replacements, selfCharacter),
                );
            if (!isPlainObject(value)) return value;
            const ownCharacter = runtimeTemplateSelfCharacter(value, selfCharacter);
            const out = {};
            for (const [key, item] of Object.entries(value))
                out[key] = materializeRuntimeDisplayReferencesWithSelf(
                    item,
                    replacements,
                    ownCharacter,
                );
            return out;
        }

        // Template display markers are resolved exactly once when a new save is
        // created. Build the character lookup once, then scan the serialized
        // payload once so large stories do not repeatedly search their full cast.
        function materializeRuntimeDisplayReferences(value, state = app.state) {
            const replacements = buildRuntimeDisplayReferenceMap(state);
            if (typeof value === "string")
                return materializeRuntimeDisplayReferenceText(value, replacements);
            if (value == null || typeof value !== "object") return value;
            const serialized = JSON.stringify(value);
            if (!serialized.includes("|[")) return value;
            if (/\|\[character(?:[_-][a-z][a-z_-]*)?\]\|/i.test(serialized))
                return materializeRuntimeDisplayReferencesWithSelf(value, replacements);
            const conditionalResolved = materializeRuntimeConditionalText(serialized);
            const resolved = conditionalResolved.replace(runtimeMessageTemplateSimplePattern, (match, key) =>
                mapRuntimeDisplayReferenceToken(String(key || "").trim(), replacements),
            );
            if (resolved === serialized) return value;
            const materialized = JSON.parse(resolved);
            const referenceNames = value.__runtimeTemplateReferenceNames;
            if (referenceNames)
                Object.defineProperty(materialized, "__runtimeTemplateReferenceNames", {
                    value: referenceNames,
                    configurable: true,
                    enumerable: false,
                });
            return materialized;
        }

        function displayRuntimeTemplateText(text = "", selfCharacter = null) {
            return resolveRuntimeMessageTemplateText(String(text || ""), app.state, {
                selfCharacter,
            });
        }

        function escapeRuntimeTemplateText(text = "", selfCharacter = null) {
            return escapeHtml(displayRuntimeTemplateText(text, selfCharacter));
        }

        function runtimeMessageTemplateEntity(value = "", state = app.state) {
            const wanted = normalizeRuntimeMessageTemplateKey(value);
            if (!wanted) return null;
            if (normalizeRuntimeMessageTemplateKey(state?.player?.id) === wanted)
                return state.player;
            for (const [key, character] of Object.entries(state?.characters || {})) {
                const names = [key, character?.id, character?.name, character?.fallback_name];
                if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                    return character;
            }
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const character = npc?.full_character || npc;
                    const names = [
                        key,
                        npc?.id,
                        npc?.npc_id,
                        npc?.name,
                        character?.id,
                        character?.name,
                        character?.fallback_name,
                    ];
                    if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                        return character;
                }
            }
            for (const [key, entry] of Object.entries(state?.future_cast?.items || {})) {
                const character = entry?.full_character || entry?.character || entry;
                const names = [
                    key,
                    entry?.id,
                    entry?.character_id,
                    entry?.name,
                    character?.id,
                    character?.name,
                    character?.fallback_name,
                ];
                if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                    return character;
            }
            return null;
        }

        function runtimeMessageTemplateEntityName(value = "", state = app.state, options = {}) {
            const wanted = normalizeRuntimeMessageTemplateKey(value);
            if (!wanted) return "";
            const format = (name) => options.firstName ? firstRuntimeName(name) : name;
            const materializedName = state?.__runtimeTemplateReferenceNames?.[wanted];
            if (materializedName) return format(materializedName);
            for (const [key, character] of Object.entries(state?.characters || {})) {
                const names = [
                    key,
                    character?.id,
                    character?.name,
                    character?.fallback_name,
                ];
                if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                    return format(currentPresentationName(key, state));
            }
            for (const location of Object.values(state?.npc_directory?.locations || {})) {
                for (const [key, npc] of Object.entries(location?.characters || {})) {
                    const character = npc?.full_character || npc;
                    const names = [
                        key,
                        npc?.id,
                        npc?.npc_id,
                        npc?.name,
                        character?.id,
                        character?.name,
                        character?.fallback_name,
                    ];
                    if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                        return format(currentPresentationName(key, state));
                }
            }
            for (const [key, entry] of Object.entries(state?.future_cast?.items || {})) {
                const character = entry?.full_character || entry?.character || entry;
                const names = [
                    key,
                    entry?.id,
                    entry?.character_id,
                    entry?.name,
                    character?.id,
                    character?.name,
                        character?.fallback_name,
                    ];
                    if (names.some((name) => normalizeRuntimeMessageTemplateKey(name) === wanted))
                        return format(currentPresentationName(key, state));
            }
            return "";
        }

        function firstRuntimeName(name = "") {
            const text = textSlot(name, "");
            return text.split(/\s+/).filter(Boolean)[0] || text;
        }

        function normalizeRuntimeMessageTemplateKey(value = "") {
            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[_\s]+/g, "-")
                .replace(/[^a-z0-9-]+/g, "")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "");
        }

        function assistantVisibleMessageText(text = "") {
            return renderInlineVoiceTagsForDisplay(String(text || "")).replace(/\*/g, "");
        }

























        function profileImageHistoryLimit() {
            const limit = exactImageHistoryLimit(app.settings?.imageHistoryLimit);
            if (app.settings) app.settings.imageHistoryLimit = limit;
            return limit;
        }

        function profileImagePositionContext(images = []) {
            const limit = profileImageHistoryLimit();
            const sorted = (Array.isArray(images) ? images : [])
                .map((image, index) => ({
                    image,
                    index,
                    time: Date.parse(image?.at || "") || 0,
                }))
                .sort((a, b) => b.time - a.time || a.index - b.index);
            const positions = new Map();
            sorted.forEach((entry, index) => {
                if (entry.image?.id) positions.set(String(entry.image.id), index + 1);
            });
            return { limit, positions };
        }

        function profileImagePositionColor(position = 1, limit = 1) {
            const max = Math.max(1, Number(limit) || 1);
            const ratio =
                max <= 1
                    ? 0
                    : Math.max(0, Math.min(1, (Number(position) - 1) / (max - 1)));
            const hue =
                ratio <= 0.5
                    ? 130 - (130 - 48) * (ratio / 0.5)
                    : 48 - (48 - 4) * ((ratio - 0.5) / 0.5);
            return `hsl(${Math.round(hue)}, 78%, 62%)`;
        }

        function profileImagePositionBadgeHtml(image = {}, context = {}, active = false) {
            const limit = Math.max(1, Number(context.limit) || profileImageHistoryLimit());
            if (image?.favorite) {
                return `<span class="profile-image-position-badge favorite" title="Favorited profile images are protected from automatic deletion.">&#9733;</span>`;
            }
            const position =
                context.positions?.get?.(String(image?.id || "")) ||
                Math.max(1, Number(image?.position) || 1);
            const color = profileImagePositionColor(position, limit);
            const title = active
                ? `Position ${position} of ${limit}. Active profile images are protected from automatic deletion.`
                : `Position ${position} of ${limit}. Older non-favorited, inactive images are deleted first if the image cap is exceeded.`;
            return `<span class="profile-image-position-badge ${active ? "protected" : ""}" style="color:${escapeHtml(color)}" title="${escapeHtml(title)}">${escapeHtml(position)}/${escapeHtml(limit)}</span>`;
        }

        function visibleMessagesForRender() {
            return combinedEntriesForRender().filter(
                (message) =>
                    message?.role !== "log" &&
                    !message?.hiddenWhileRegenerating &&
                    true,
            );
        }

        function findMessageById(id) {
            const key = String(id);
            const index =
                app.messageIndex && app.messageIndexSource === app.messages
                    ? app.messageIndex
                    : rebuildMessageIndex();
            return index.get(key) || null;
        }

        function findEntryById(id) {
            return findMessageById(id);
        }

        function visibleImagesForRender() {
            return (Array.isArray(app.images) ? app.images : []).filter(
                (image) => !image?.hideFromChat && true,
            );
        }

        function setToolButtonLabel(id, label) {
            const button = $(id);
            if (!button) return;
            const labelEl = button.querySelector(".tool-label");
            if (labelEl) labelEl.textContent = label;
            else button.textContent = label;
            button.setAttribute("aria-label", label);
        }

        function setToolButtonDisabled(id, disabled = true) {
            const button = $(id);
            if (!button) return;
            button.disabled = !!disabled;
        }

        function captureRenderFocusState() {
            const el = document.activeElement;
            if (!el || el === document.body || !document.contains(el)) return null;
            const selectors = [];
            if (el.id) selectors.push(`#${cssEscape(el.id)}`);
            for (const attr of [
                "name",
                "data-focus-key",
                "data-profile-image-id",
                "data-profile-live-id",
                "data-character-card",
                "data-npc-name",
            ]) {
                const value = el.getAttribute?.(attr);
                if (value)
                    selectors.push(
                        `${el.tagName.toLowerCase()}[${attr}="${cssEscape(value)}"]`,
                    );
            }
            if (!selectors.length) return null;
            const state = {
                selector: selectors.join(","),
                selectionStart: null,
                selectionEnd: null,
            };
            if (
                (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
                typeof el.selectionStart === "number"
            ) {
                state.selectionStart = el.selectionStart;
                state.selectionEnd = el.selectionEnd;
            }
            return state;
        }

        function restoreRenderFocusState(state) {
            if (!state?.selector) return;
            const el = document.querySelector(state.selector);
            if (!el || !document.contains(el)) return;
            try {
                el.focus({ preventScroll: true });
                if (
                    state.selectionStart != null &&
                    typeof el.setSelectionRange === "function"
                ) {
                    const length = String(el.value ?? "").length;
                    el.setSelectionRange(
                        Math.min(state.selectionStart, length),
                        Math.min(state.selectionEnd ?? state.selectionStart, length),
                    );
                }
            } catch (err) {
                devLog(
                    "Focus restore failed",
                    {
                        label: "render focus",
                        error: err.message || String(err),
                        summary: state.selector,
                    },
                    "log",
                );
            }
        }

        function ensureRenderStats() {
            app.devRenderStats ||= {
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
            return app.devRenderStats;
        }

        function recordRenderStat(kind, reason = "") {
            const stats = ensureRenderStats();
            const text = String(reason || "").trim();
            if (kind === "full") {
                stats.fullRenderCount += 1;
                stats.lastFullRenderReason = text;
                if (
                    text &&
                    (
                        app.activeVoiceMessageId ||
                        app.activeImageRequests?.size
                    ) &&
                    !/^allowed:/i.test(text)
                ) {
                    stats.broadDuringRuntimeCount += 1;
                    devLog(
                        "Broad render during active runtime work",
                        {
                            label: "render",
                            reason: text,
                            activeVoiceMessageId: app.activeVoiceMessageId || "",
                            activeImageRequests: app.activeImageRequests?.size || 0,
                            summary: text,
                        },
                        "warn",
                    );
                }
            } else if (kind === "thread") {
                stats.threadRenderCount += 1;
                stats.lastThreadRenderReason = text;
            } else if (kind === "imagePanel") {
                stats.imagePanelRenderCount += 1;
                stats.lastImagePanelRenderReason = text;
            } else if (kind === "playHud") {
                stats.playHudRenderCount += 1;
            }
        }

        function render(reason = "") {
            recordRenderStat("full", reason);
            const focusState = captureRenderFocusState();
            renderNow();
            restoreRenderFocusState(focusState);
        }

        function requestRenderRegions(regions = {}, reason = "") {
            app.pendingRenderRegions ||= {};
            for (const key of Object.keys(regions || {})) {
                if (regions[key]) app.pendingRenderRegions[key] = true;
            }
            const stats = ensureRenderStats();
            const text = String(reason || "").trim();
            if (text) stats.regionReasons = [...(stats.regionReasons || []), text].slice(-20);
            if (app.pendingRenderRegions.full) {
                app.pendingRenderRegions = {};
                render(text || "region requested full render");
                return;
            }
            const renderers = {
                hud: () => renderPlayHud(text || "region hud"),
                objective: () => renderTopObjectivePanel(),
                left: () => renderLeftPanel(),
                characters: () => renderCharacters(),
                scene: () => renderScene(),
                quest: () => renderQuestCard(),
                quickActions: () => renderQuickActions(),
                composer: () => renderComposerGuidance(),
                imageModel: () => renderImageModelSelect(),
                imagePanel: () => renderImagePanel(text || "region image panel"),
                thread: () => renderThread(text || "region thread"),
                topbar: () => updateTopToolbarVisibility(),
                mobileDrawers: () => updateMobileDrawerState(),
            };
            const priority = { topbar: "interaction", mobileDrawers: "interaction", composer: "interaction", quickActions: "interaction", thread: "content", hud: "content" };
            const pending = app.pendingRenderRegions;
            app.pendingRenderRegions = {};
            for (const [key, action] of Object.entries(renderers)) {
                if (!pending[key]) continue;
                app.work.scheduleUi(`region:${key}`, () => {
                    const started = perfNow();
                    action();
                    const ms = perfNow() - started;
                    if (ms >= 8.33) perfConsole(`render region ${key}`, { ms: Math.round(ms * 100) / 100, reason: text }, "warn");
                }, { priority: priority[key] || "content" });
            }
            app.work.scheduleUi("region:shared-finalize", () => {

                renderVoicePauseButton();
            }, { priority: "background" });
        }


        const FULL_UI_REFRESH_REGIONS = Object.freeze({
            hud: true,
            objective: true,
            left: true,
            characters: true,
            scene: true,
            quest: true,
            quickActions: true,
            composer: true,
            imageModel: true,
            imagePanel: true,
            thread: true,
            topbar: true,
            mobileDrawers: true,
        });

        function requestRuntimeMutationRender(reason = "runtime mutation") {
            const roots = new Set(runtimeRenderMutationRoots);
            runtimeRenderMutationRoots.clear();
            const regions = { hud: true, topbar: true };
            const broad = roots.has("*") || !roots.size;
            const includes = (...names) => broad || names.some((name) => roots.has(name));

            if (includes("objectives", "progression", "reward_bundles", "reward_templates"))
                Object.assign(regions, { objective: true, quest: true, left: true, quickActions: true });
            if (includes("characters", "player", "future_cast", "npc_directory", "temp_speakers"))
                Object.assign(regions, { left: true, characters: true, scene: true, imagePanel: true });
            if (includes("scene", "location", "world_map", "time", "story_clock", "story_pacing", "timed_events"))
                Object.assign(regions, { left: true, scene: true, quickActions: true, composer: true, imagePanel: true });
            if (includes("story_inventory", "story_shops", "story_job_offers", "active_generated_jobs"))
                Object.assign(regions, { left: true, characters: true, scene: true, quickActions: true });
            if (includes("meta", "world_flags", "story_rules", "story_memory"))
                Object.assign(regions, { objective: true, left: true, characters: true, scene: true, quest: true, quickActions: true, composer: true, imagePanel: true });

            if (Number(app.lastRuntimeRenderMessageRevision || 0) !== Number(app.messageListRevision || 0)) {
                regions.thread = true;
                app.lastRuntimeRenderMessageRevision = Number(app.messageListRevision || 0);
            }
            requestRenderRegions(regions, reason);
        }

        function renderNow() {
            const started = perfNow();
            const stages = [];
            const runStage = (name, action) => {
                const stageStarted = perfNow();
                const result = action();
                stages.push({
                    name,
                    ms: Math.round((perfNow() - stageStarted) * 100) / 100,
                });
                return result;
            };
            const finish = () => {
                const ms = perfNow() - started;
                if (ms >= 100)
                    perfConsole(
                        "render",
                        {
                            ms: Math.round(ms),
                            messages: (app.messages || []).length,
                            characters: Object.keys(app.state?.characters || {}).length,
                            nearby: (app.state?.scene?.npcs_present || []).length,
                            images: (app.images || []).length,
                            profileImages: (app.profileImages || []).length,
                            stages,
                        },
                        "warn",
                    );
            };

            app.profileImageLiveHtmlCache = runStage(
                "capture profile image HTML",
                captureProfileImageLiveHtml,
            );
            runStage("reduced UI class", applyReducedUiClass);


            runStage("main menu", renderMainMenu);
            // The main menu does not display the game thread, image history, or
            // scene cards. Rebuilding them here was the dominant menu render cost.
            if (app.mainMenuOpen) {
                runStage("top toolbar", updateTopToolbarVisibility);
                runStage("mobile drawers", updateMobileDrawerState);
                runStage("voice pause button", renderVoicePauseButton);
                finish();
                return;
            }
            runStage("top objective", renderTopObjectivePanel);
            runStage("play HUD", renderPlayHud);
            runStage("thread", renderThread);
            runStage("left panel", renderLeftPanel);
            runStage("characters", renderCharacters);
            scheduleProfileImageLoadingAutosize();
            runStage("scene", renderScene);
            runStage("activate character images", () => activatePluginIframes($("characterList")));
            runStage("activate player images", () => activatePluginIframes($("playerList")));
            runStage("activate NPC images", () => activatePluginIframes($("npcSceneList")));
            runStage("activate scene image", () => activatePluginIframes($("sceneCard")));
            runStage("quest card", renderQuestCard);


            runStage("composer guidance", renderComposerGuidance);
            runStage("quick actions", renderQuickActions);
            runStage("image model", renderImageModelSelect);
            runStage("image panel", renderImagePanel);
            runStage("top toolbar", updateTopToolbarVisibility);
            runStage("mobile drawers", updateMobileDrawerState);


            setToolButtonLabel(
                "sendBtn",
                gameIsOver()
                    ? "Game Over"
                    : directObjectiveChoiceIsWaiting()
                    ? "Choose"
                    : queueProcessingBlocked()
                    ? `Queue (${app.queue.length})`
                    : "Send",
            );
            setToolButtonLabel(
                "imageBtn",
                "Image",
            );
            runStage("voice pause button", renderVoicePauseButton);
            if ($("imageBtn")) $("imageBtn").disabled = false;

            finish();
        }

        function renderTopObjectivePanel() {
            const panel = $("topObjectivePanel");
            if (!panel) return;
            const objective = currentObjectiveTarget();
            const pendingTimelineEvent = readyStoryTimelineEvent(app.state);
            const nextTimelineEvent = nextWaitingTimelineEvent(app.state);
            if (!objective && !pendingTimelineEvent && !nextTimelineEvent) {
                panel.classList.add("hidden");
                panel.textContent = "";
                panel.title = "";
                return;
            }
            panel.classList.remove("hidden");
            const objectiveHtml = objective
                ? `<strong>Objective:</strong> ${escapeRuntimeTemplateText(objective.title || objective.id || "Untitled objective")}`
                : `<strong>Objective:</strong> Free exploration`;
            const timelineHtml = pendingTimelineEvent
                ? `<span style="margin-left:.75rem"><strong>Story Event:</strong> ${escapeHtml(pendingTimelineEvent.title || pendingTimelineEvent.id)}</span>
                   <button type="button" class="secondary small" style="margin-left:.5rem" onclick="EmberAdventures.openStoryTimelineEventPrompt()">Start</button>
                   <button type="button" class="small" onclick="EmberAdventures.declineTimelineEventFromUi()">Skip</button>`
                : nextTimelineEvent
                  ? `<span style="margin-left:.75rem"><strong>Next Event:</strong> ${escapeHtml(nextTimelineEvent.title || nextTimelineEvent.id)}</span>
                     <button type="button" class="secondary small" style="margin-left:.5rem" onclick="EmberAdventures.waitForStoryTimelineEvent()">Wait</button>`
                  : "";
            panel.innerHTML = `${objectiveHtml}${timelineHtml}`;
            panel.title = objective
                ? `Objective: ${displayRuntimeTemplateText(objective.title || objective.id || "Untitled objective")}`
                : "No selected objective";
        }

        function renderPlayHud(reason = "") {
            recordRenderStat("playHud", reason);
            const statusText = app.statusText || statusTextForStage(app.turnStage);
            syncTopPanelVisibility();
            const status = $("status");
            if (status) status.textContent = statusText;
            const working = $("workingText");
            if (working) working.textContent = statusText;

            const over = gameIsOver();
            setToolButtonLabel(
                "sendBtn",
                over
                    ? "Game Over"
                    : directObjectiveChoiceIsWaiting()
                    ? "Choose"
                    : queueProcessingBlocked()
                    ? `Queue (${app.queue.length})`
                    : "Send",
            );
            setToolButtonDisabled("sendBtn", over);
            setToolButtonLabel("imageBtn", "Image");


            renderVoicePauseButton();
            renderComposerGuidance();
            renderQuickActions();
        }

        function setTopPanel(panel = "objective") { setLeftPanelGroup(panel); }

        function syncTopPanelVisibility() {
            const group = visibleLeftPanelGroup(app.settings.leftPanelGroup);
            const buttons = {
                objective: $("objectivePanelBtn"),
                scene: $("scenePanelBtn"),
            };
            const objectiveLabel = buttons.objective?.querySelector(".tool-label");
            if (objectiveLabel) {
                const objective = currentObjectiveTarget();
                objectiveLabel.textContent = objective
                    ? displayRuntimeTemplateText(objective.title || "Objective")
                    : "Objective";
            }
            for (const [key, button] of Object.entries(buttons))
                button?.classList.toggle("active", key === group);
        }

        function visibleLeftPanelGroup(value) { return exactLeftPanelGroup(value); }

        function resetLeftPanelForNewGame() {
            // New playthroughs should always start on the party/NPC panel, regardless of
            // which left-panel group the previous game was using.
            app.settings.leftPanelGroup = "characters";
            app.settings.leftPanelScroll ||= {};
            app.settings.leftPanelScroll.characters = 0;
        }

        function leftPanelGroups() {
            return [
                { id: "characters", label: "Party", icon: "&#128101;" },
                { id: "objective", label: "Objective", icon: "&#127919;" },
                { id: "scene", label: "Scene", icon: "&#127917;" },
                ...(([])),
            ];
        }

        function setLeftPanelGroup(group) {
            saveLeftPanelScroll();
            app.settings.leftPanelGroup = exactLeftPanelGroup(group);
            scheduleActiveGameSave();
            render();
        }

        function leftPanelSectionOpen(id, fallback = true) {
            app.settings.leftPanelSections ||= {};
            return app.settings.leftPanelSections[id] ?? fallback;
        }

        function setLeftPanelSectionOpen(id, open) {
            app.settings.leftPanelSections ||= {};
            app.settings.leftPanelSections[id] = !!open;
            scheduleActiveGameSave();
        }

        function saveLeftPanelScroll() {
            const panel = $("leftPanel");
            if (!panel) return;
            app.settings.leftPanelScroll ||= {};
            app.settings.leftPanelScroll[visibleLeftPanelGroup(app.settings.leftPanelGroup)] =
                panel.scrollTop || 0;
        }

        function restoreLeftPanelScroll() {
            const panel = $("leftPanel");
            if (!panel) return;
            const group = visibleLeftPanelGroup(app.settings.leftPanelGroup);
            const top = Number(app.settings.leftPanelScroll?.[group] || 0);
            requestAnimationFrame(() => {
                if ($("leftPanel")) $("leftPanel").scrollTop = top;
            });
        }

        function detailsOpenAttr(id, fallback = true) {
            return leftPanelSectionOpen(id, fallback) ? "open" : "";
        }

        function renderLeftPanel() {
            const tabs = $("leftGroupTabs");
            const body = $("leftGroupBody");
            if (!tabs || !body) return;
            const group = visibleLeftPanelGroup(app.settings.leftPanelGroup);
            tabs.innerHTML = leftPanelGroups()
                .map(
                    (item) => `
                        <button type="button" class="tool-button left-group-tab ${group === item.id ? "active" : ""}" data-left-group="${escapeHtml(item.id)}" onclick="EmberAdventures.setLeftPanelGroup('${item.id}')">
                            <span class="tool-icon">${item.icon}</span>
                            <span class="tool-label">${escapeHtml(item.label)}</span>
                        </button>
                    `,
                )
                .join("");
            body.innerHTML = leftPanelGroupHtml(group);

            restoreLeftPanelScroll();
        }



        function leftPanelGroupHtml(group) {
            if (group === "objective") return objectiveLeftPanelHtml();
            if (group === "scene") return sceneLeftPanelHtml();

            return charactersLeftPanelHtml();
        }

        function leftPanelDetails(id, title, bodyHtml, { open = true } = {}) {
            return `
                <details class="panel-section" ${detailsOpenAttr(id, open)} ontoggle="EmberAdventures.setLeftPanelSectionOpen('${id}', this.open)">
                    <summary class="panel-title">${escapeHtml(title)}</summary>
                    <div class="panel-section-body">${bodyHtml}</div>
                </details>
            `;
        }

        function charactersLeftPanelHtml() {
            return `
                <div class="left-group-panel">
                    ${leftPanelDetails("characters-player", app.state.player?.name || "Main Character", `<div id="playerList" class="stack"></div>`)}
                    ${leftPanelDetails("characters-party", "Party", `<div id="characterList" class="stack"></div>`)}
                    ${leftPanelDetails("characters-npcs", "NPCs", `<div id="npcSceneList" class="stack"></div>`)}
                </div>
            `;
        }

        function objectiveLeftPanelHtml() {
            return `
                <div class="left-group-panel">
                    <div id="questCard" class="stat-card"></div>
                    ${objectiveChoiceSectionHtml("objective-main", "Main Story", false)}
                    ${objectiveChoiceSectionHtml("objective-side", "Side Objectives", true)}
                </div>
            `;
        }

        function objectiveChoiceSectionHtml(sectionId, title, side) {
            const choices = visibleObjectiveChoices()
                .map((entry) => entry.objective)
                .filter((objective) => !!objective && objectiveIsSide(objective) === side);
            const current = currentObjectiveTarget();
            const rows = choices.length
                ? choices
                      .map((objective) => objectiveChoiceRowHtml(objective, current))
                      .join("")
                : `<div class="hint">No available ${side ? "side" : "main-story"} objectives.</div>`;
            return leftPanelDetails(
                sectionId,
                title,
                `<div class="objective-list">${rows}</div>`,
                { open: false },
            );
        }

        function objectiveChoiceRowHtml(objective, current) {
            const selected = current && String(current.id) === String(objective.id);
            const disabled = !objectiveCanBeSelected(objective, app.state);
            const kindClass = objectiveIsSide(objective)
                ? "objective-title-side"
                : "objective-title-main";
            const unavailableClass = disabled
                ? "objective-title-unavailable"
                : "";
            return `
                <button type="button" class="objective-row objective-name-button ${selected ? "active" : ""}" ${disabled ? "disabled" : ""} onclick="EmberAdventures.openObjectivePickerModal(${htmlJsArg(objective.id)})">
                    <strong class="${kindClass} ${unavailableClass}">${escapeRuntimeTemplateText(objective.title || objective.id || "Objective")}</strong>
                </button>
            `;
        }

        function sceneLeftPanelHtml() {
            const location = currentLocationDetail(app.state);
            const scene = app.state.scene || {};
            const locationRows = [
                ["World", location.world || location.universe || "Unknown"],
                ["Region", location.region || "Unknown"],
                ["Settlement", location.settlement_name || "Unknown"],
                ["District", location.district || "Unknown"],
                ["Place", location.specific_place || "Unknown"],
            ];
            const activeNames = sceneAiVisibleNames(scene);
            const imageNames = (scene.image_characters || []).filter(Boolean);
            return `
                <div class="left-group-panel">
                    ${leftPanelDetails(
                        "scene-location",
                        "Location",
                        `<div class="left-location-row">${locationRows
                            .map(([label, value]) => leftPanelMetric(label, value))
                            .join("")}</div>`,
                    )}
                    ${leftPanelDetails(
                        "scene-summary",
                        "SUMMARY",
                        `<div>${escapeRuntimeTemplateText(scene.summary || "No scene summary.")}</div>`,
                    )}
                    ${leftPanelDetails(
                        "scene-names",
                        "In Scene",
                        leftNameListHtml(activeNames, "No one listed in the scene.", { excludePlayer: true }),
                    )}
                    ${leftPanelDetails(
                        "scene-images",
                        "In Images",
                        leftNameListHtml(imageNames, "No image subjects listed."),
                    )}
                    <div class="row">
                        <button class="tool-button" type="button" onclick="EmberAdventures.openCharactersModal()"><span class="tool-icon">&#128101;</span><span class="tool-label">Characters</span></button>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openFindCharacterModal()"><span class="tool-icon">&#128269;</span><span class="tool-label">Find</span></button>
                    </div>
                </div>
            `;
        }



        function leftNameListHtml(names, emptyText, options = {}) {
            return sceneNameListHtml(names, emptyText, options);
        }

        function sceneAiVisibleNames(scene = app.state.scene || {}) {
            return [
                ...new Set([
                    ...(scene.party_members_present || []),
                    ...(scene.npcs_present || []),
                ].filter(Boolean)),
            ];
        }

        function sceneNameListHtml(names, emptyText, options = {}) {
            const clean = [
                ...new Set(
                    (Array.isArray(names) ? names : [])
                        .map((name) => String(name || "").trim())
                        .filter(Boolean)
                        .filter((name) => !(options.excludePlayer && isPlayerEntityName(name, app.state))),
                ),
            ];
            if (!clean.length) return `<div class="hint">${escapeHtml(emptyText)}</div>`;
            return `<div class="left-name-list">${clean.map(sceneNameButtonHtml).join("")}</div>`;
        }

        function nonPlayerSceneEntityNames(names = [], state = app.state) {
            // The player is supplied to AI prompts through the dedicated `player`
            // object or derived booleans. Do not include the
            // player in active/nearby/speaker scene lists, because those lists are
            // writable NPC/party context and can make the AI try to control them.
            return (Array.isArray(names) ? names : [])
                .map((name) => String(name || "").trim())
                .filter(Boolean)
                .filter((name) => !isPlayerEntityName(name, state));
        }

        function sceneNameButtonHtml(name) {
            const label = promptEntityName(name, app.state);
            return `<button type="button" class="left-metric scene-name-button" onclick="EmberAdventures.openSceneEntity(${htmlJsArg(name)})"><strong>${escapeHtml(label)}</strong></button>`;
        }

        function openSceneEntity(name) {
            if (isPlayerEntityName(name, app.state)) {
                openPlayerModal();
                return;
            }
            if (app.state.characters?.[name]) {
                openCharactersModal();
                requestAnimationFrame(() => {
                    document
                        .querySelector(`[data-character-card][data-character-name="${cssEscape(String(name))}"]`)
                        ?.scrollIntoView?.({ block: "center" });
                });
                return;
            }
            const npc = findNpcEntryExact(name);
            if (npc) {
                openNpcDirectoryModal(npc.locationId);
                requestAnimationFrame(() => {
                    const search = $("npcDirectorySearch");
                    if (search) {
                        search.value = npc.npc?.name || npc.key || name;
                        filterNpcDirectoryModal(search.value);
                    }
                });
            }
        }

        function leftPanelMetric(label, value) {
            return `<div class="left-metric"><span class="hint">${escapeHtml(label)}</span><strong>${escapeHtml(value || "none")}</strong></div>`;
        }

        function statusTextForStage(stage) {
            return (
                {
                    idle: "Ready",
                    game_over: "Game Over",
                    user_state: "Checking player action",
                    reply: "Writing scene reply",
                    assistant_state: "Updating game state",
                    effects: "Running voice, images, and toys",
                    image: "Generating image",
                    working: "Working",
                    error: "Needs attention",
                }[stage] || "Ready"
            );
        }

        function renderComposerGuidance() {
            const container = $("composerGuidance");
            if (!container) return;
            const suggestions = contextualSuggestions();
            app.contextualSuggestions = suggestions;
            container.innerHTML = "";
            const input = $("input");
            if (input) input.placeholder = composerPlaceholder();
        }

        function composerModeButton(mode, label, title, current) {
            return "";
        }

        function setComposerMode(mode) {
            scheduleActiveGameSave();
            renderComposerGuidance();
        }

        function composerHelpText(mode) {
            return "";
        }

        function composerPlaceholder(mode) {
            return 'Type dialogue in quotes, or describe actions/thoughts/context...';
        }

        function formatComposerText(text) {
            return String(text || "").trim();
        }

        function resizeComposerInput() {
            const input = $("input");
            if (!input) return;
            const thread = $("thread");
            const composer = input.closest(".composer");
            const currentComposerHeight = composer?.getBoundingClientRect?.().height || 0;
            const threadHeight = thread?.getBoundingClientRect?.().height || 0;
            const availableChatHeight =
                threadHeight + currentComposerHeight || window.innerHeight || 0;
            const minHeight = 42;
            const maxHeight = Math.max(minHeight, Math.floor(availableChatHeight * 0.5));
            input.style.height = `${minHeight}px`;
            const nextHeight = Math.min(input.scrollHeight, maxHeight);
            input.style.height = `${Math.max(minHeight, nextHeight)}px`;
            input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
        }

        function contextualSuggestions() {
            const target =
                (app.state.scene?.party_members_present || []).find((name) => name !== "Player") ||
                (app.state.scene?.npcs_present || []).find((name) => name !== "Player") ||
                "";
            const out = [];
            {}
            return out.slice(0, 4);
        }
        function imageModelOptions() {
            return IMAGE_ART_STYLE_PRESETS;
        }

        function selectedImageModel(value = app.settings.imageModel) {
            value =
                !value ||
                value === "default" ||
                value === "perchance-stable-diffusion"
                    ? PERCHANCE_IMAGE_MODEL_DEFAULT
                    : value;
            return imageModelOptions().some((model) => model.value === value)
                ? value
                : PERCHANCE_IMAGE_MODEL_DEFAULT;
        }

        function selectedProfileImageModel(value = app.settings.defaultProfileImageModel) {
            const selected = selectedImageModel(value || PROFILE_IMAGE_MODEL_DEFAULT);
            return selected || PROFILE_IMAGE_MODEL_DEFAULT;
        }

        function storyDefaultImageModelFromSource(source = {}) {
            const raw =
                source?.default_image_model ||
                source?.default_image_style ||
                source?.image_model ||
                source?.image_style ||
                source?.state?.meta?.default_image_model ||
                source?.state?.meta?.default_image_style ||
                source?.state?.meta?.image_model ||
                source?.state?.meta?.image_style ||
                source?.meta?.default_image_model ||
                source?.meta?.default_image_style ||
                source?.meta?.image_model ||
                source?.meta?.image_style ||
                "";
            return raw ? selectedImageModel(raw) : "";
        }

        function currentStoryDefaultImageModel(state = app.state) {
            const raw =
                state?.meta?.default_image_model ||
                state?.meta?.default_image_style ||
                state?.meta?.image_model ||
                state?.meta?.image_style ||
                "";
            return raw ? selectedImageModel(raw) : "";
        }

        function activeNormalImageModel(state = app.state) {
            return selectedImageModel(
                currentStoryDefaultImageModel(state) || app.settings.imageModel,
            );
        }

        function applyStoryDefaultImageModelToCharacter(character = {}, state = app.state, options = {}) {
            if (!isPlainObject(character)) return character;
            const model = currentStoryDefaultImageModel(state);
            if (!model) return character;
            character.image_prompt_config = imagePromptConfigFromExactInput(
                character.image_prompt_config || character.image || { seed: 0 },
                character.default_seed,
            ) || {
                seed_enabled: true,
                seed: exactProfileImageSeed(character.default_seed, "character.default_seed"),
                style: "",
                profile_style: "",
                negative: "",
                negative_prompt: "",
            };
            if (options.force === true || !character.image_prompt_config.style)
                character.image_prompt_config.style = model;
            character.image ||= {};
            if (options.force === true || !character.image.style) character.image.style = model;
            return character;
        }

        function imageModelLabel(value) {
            const selected = selectedImageModel(value);
            return (
                imageModelOptions().find((model) => model.value === selected)
                    ?.label || "None"
            );
        }

        function applyImageArtStyle(prompt, negativePrompt, value = app.settings.imageModel) {
            const selected = selectedImageModel(value);
            const style = imageModelOptions().find((item) => item.value === selected);
            if (!style || !style.prompt) {
                return {
                    prompt: String(prompt || ""),
                    negativePrompt: String(negativePrompt || ""),
                };
            }
            const basePrompt = String(prompt || "");
            const baseNegative = String(negativePrompt || "");
            const styledPrompt = String(style.prompt || "{prompt}").replaceAll(
                "{prompt}",
                basePrompt,
            );
            return {
                prompt: styledPrompt,
                negativePrompt: baseNegative,
            };
        }

        function useFantasyRpgLocalImageStyle(value = activeNormalImageModel()) {
            const selected = selectedImageModel(value);
            return selected === "fantasy-rpg" || selected === "polished-animation";
        }

        function defaultFantasyRpgImageStyleBlock(kind = "character", model = activeNormalImageModel()) {
            const selected = selectedImageModel(model);
            if (selected === "polished-animation") {
                return kind === "profile"
                    ? "polished high-budget animated film still, semi-realistic 3D anime character art, cinematic character render, smooth realistic skin shading, detailed expressive face, soft cinematic studio lighting, high-end fantasy animation, clean anatomy, glossy but natural skin, dramatic composition, no comic panel, no text, no watermark, no label, no speech bubble, no photorealistic live-action, no real photo"
                    : "polished high-budget animated film still, semi-realistic 3D anime character art, cinematic character render, smooth realistic skin shading, detailed expressive face, soft cinematic studio lighting, high-end fantasy animation, clean anatomy, glossy but natural skin, dramatic composition, no comic panel, no text, no watermark, no label, no speech bubble, no photorealistic live-action, no real photo";
            }
            return kind === "profile"
                ? "cinematic fantasy lighting, high detail fantasy RPG character art, cinematic lighting"
                : "cinematic fantasy lighting, high detail fantasy RPG character art, cinematic lighting";
        }

        function discoverImageModelOptions() {
            // Art styles are local prompt wrappers based on Perchance's
            // t2i-styles presets. They are not backend model options.
        }

        function renderImageModelSelect() {
            const select = $("imageModelSelect");
            if (!select) return;
            const selected = selectedImageModel();
            app.settings.imageModel = selected;
            select.innerHTML = imageModelOptions()
                .map(
                    (model) =>
                        `<option value="${escapeHtml(model.value)}" ${model.value === selected ? "selected" : ""}>${escapeHtml(model.label)}</option>`,
                )
                .join("");
            select.title =
                imageModelOptions().find((model) => model.value === selected)
                    ?.hint || "";
        }

        function renderImagePanel(reason = "") {
            recordRenderStat("imagePanel", reason);
            const panel = $("imagePanel");
            if (!panel) return;

            const images = visibleImagesForRender();
            const visibleCount = Math.max(18, Number(app.imageVisibleCount) || 18);
            const visible = images.slice(0, visibleCount);
            const visibleIds = new Set(visible.map((image) => imageDomId(image.id)));

            const structureSignature = [
                images.length,
                visibleCount,
                ...visible.map((image) =>
                    `${imageDomId(image.id)}:${isActiveImageRecord(image) ? "active" : "idle"}:${
                        image.pending ? "pending" : image.error ? "error" : "finished"
                    }:${renderImageRecordHtml(image) ? "rendered" : "empty"}`,
                ),
            ].join("|");
            if (panel.dataset.structureSignature === structureSignature) return;
            panel.dataset.structureSignature = structureSignature;

            const cardsById = new Map(
                [...panel.querySelectorAll(".image-card[data-image-id]")].map((card) => [
                    card.dataset.imageId,
                    card,
                ]),
            );

            panel.querySelectorAll(".image-card[data-image-id]").forEach((card) => {
                if (
                    !visibleIds.has(card.dataset.imageId) &&
                    !isActiveImageDomId(card.dataset.imageId)
                ) {
                    cardsById.delete(card.dataset.imageId);
                    card.remove();
                }
            });
            panel.querySelector("[data-load-older-images]")?.remove();

            let anchor = null;
            if (images.length > visible.length) {
                const loadOlder = document.createElement("button");
                loadOlder.type = "button";
                loadOlder.style.width = "100%";
                loadOlder.dataset.loadOlderImages = "1";
                loadOlder.textContent = `Load older images (${images.length - visible.length})`;
                loadOlder.onclick = showOlderImages;
                panel.append(loadOlder);
                anchor = loadOlder;
            }

            for (let i = visible.length - 1; i >= 0; i--) {
                const image = visible[i];
                const id = imageDomId(image.id);
                let card = cardsById.get(id);

                if (!card) {
                    const wrapper = document.createElement("div");
                    wrapper.innerHTML = imageCardHtml(image).trim();
                    card = wrapper.firstElementChild;
                    cardsById.set(id, card);
                    panel.insertBefore(card, anchor);
                    activatePluginIframes(card);
                } else {
                    const canPreview = !!renderImageRecordHtml(image) && !image.pending && !image.error;
                    const cardCanPreview = !!card.querySelector(
                        ".image-preview-hitbox, button[title='Download image']",
                    );
                    if (canPreview !== cardCanPreview) {
                        const wrapper = document.createElement("div");
                        wrapper.innerHTML = imageCardHtml(image).trim();
                        const replacement = wrapper.firstElementChild;
                        card.replaceWith(replacement);
                        card = replacement;
                        cardsById.set(id, card);
                        activatePluginIframes(card);
                    }
                    updateImageCardMetadata(card, image);
                    if (isActiveImageRecord(image)) continue;
                    if (card.nextElementSibling !== anchor) panel.insertBefore(card, anchor);
                }
                anchor = card;
            }
        }



        function isActiveImageRecord(image) {
            return !!image?.id && app.activeImageRequests?.has?.(String(image.id));
        }

        function isActiveImageDomId(domId) {
            if (!app.activeImageRequests?.size) return false;
            for (const activeId of app.activeImageRequests) {
                if (imageDomId(activeId) === String(domId)) return true;
            }
            return false;
        }

        function imageCardHtml(image, options = {}) {
            const renderedImage = renderImageRecordHtml(image);
            const id = imageDomId(image.id);
            const imageArg = htmlJsArg(image.id);
            const profileTarget = String(options.profileTarget || "");
            const profileTargetArg = htmlJsArg(profileTarget);
            const canPreview = renderedImage && !image.pending && !image.error;
            const nameText = imageDisplayNameText(image);
            return `
                <div class="image-card" data-image-id="${escapeHtml(id)}" data-profile-target="${escapeHtml(profileTarget)}">
                    <div class="image-card-heading">
                        <strong class="image-card-title" title="${escapeHtml(nameText)}">${escapeHtml(nameText)}</strong>

                    </div>
                    <div class="image-render ${canPreview ? "clickable-image-render" : ""}" ${canPreview ? `title="View full size" onclick="EmberAdventures.openImagePreview(${imageArg})"` : ""}>
                        ${imageRecordBodyHtml(image)}
                        ${canPreview ? `<button type="button" class="image-preview-hitbox" title="View full size" aria-label="View full size image" onclick="event.stopPropagation(); EmberAdventures.openImagePreview(${imageArg})"></button>` : ""}
                    </div>
                    <div class="image-card-toolbar">
                        ${profileTarget && canPreview ? `<button type="button" title="Copy this scene image into ${escapeHtml(profileDisplayName(profileTarget))}'s profile images" onclick="EmberAdventures.promoteSceneImageToProfile(${profileTargetArg}, ${imageArg})">Use as Profile</button>` : ""}
                        ${canPreview ? `<button class="icon-button" title="Download image" onclick="EmberAdventures.downloadImageRecord(${imageArg})">&#11015;</button>` : ""}
                        <button class="icon-button blue" title="Load in Image Lab" onclick="EmberAdventures.loadImageInLab(${imageArg}, { popup: ${profileTarget ? "true" : "false"}, profileTarget: ${profileTargetArg} })">&#128300;</button>
                        <button class="icon-button image-favorite-button ${image.favorite ? "speak-on" : "speak-off"}" title="${image.favorite ? "Unfavorite image" : "Favorite image"}" onclick="EmberAdventures.toggleImageFavorite(${imageArg})">${image.favorite ? "&#9733;" : "&#9734;"}</button>
                        <button class="icon-button danger" title="Delete image" onclick="EmberAdventures.deleteImageRecord(${imageArg})">&#128465;</button>
                    </div>
                </div>
            `;
        }

        function chatImagesHtml(images = visibleImagesForRender()) {
            if (app.settings?.showImagesInChat === false) return "";
            if (!images.length) return "";
            const orderedImages = images
                .map((image, index) => ({ image, index }))
                .sort(sortChatImagesByRequest)
                .map((entry) => entry.image);
            return `
                <section class="chat-image-gallery" aria-label="Generated images in chat">
                    ${orderedImages.map((image) => imageCardHtml(image)).join("")}
                </section>
            `;
        }

        function chatImagesRequestedAfterMessageId(messageId = "") {
            if (app.settings?.showImagesInChat === false) return "";
            const wanted = String(messageId || "");
            const images = visibleImagesForRender()
                .filter((image) => String(image.requestedAfterMessageId || "") === wanted);
            return chatImagesHtml(images);
        }

        function chatImagesWithoutVisibleRequestAnchorHtml(visibleMessageIds = new Set()) {
            if (app.settings?.showImagesInChat === false) return "";
            const images = visibleImagesForRender()
                .filter((image) => {
                    const anchor = String(image.requestedAfterMessageId || "");
                    return !anchor || !visibleMessageIds.has(anchor);
                });
            return chatImagesHtml(images);
        }

        function imageChatSortTime(image = {}) {
            return Date.parse(image.requestedAt || image.at || "") || 0;
        }

        function imageChatSortOrder(image = {}, fallback = 0) {
            return Number(image.requestOrder) || Number(image.id) || fallback || 0;
        }

        function sortChatImagesByRequest(a, b) {
            const timeDiff = imageChatSortTime(a.image) - imageChatSortTime(b.image);
            if (timeDiff) return timeDiff;
            const orderDiff =
                imageChatSortOrder(a.image, a.index) -
                imageChatSortOrder(b.image, b.index);
            if (orderDiff) return orderDiff;
            return a.index - b.index;
        }

        function buildChatImageTimeline(
            visibleMessageIds = new Set(),
            knownMessageIds = new Set(),
            firstVisibleTime = 0,
            sourceImages = visibleImagesForRender(),
        ) {
            if (app.settings?.showImagesInChat === false)
                return { byAnchor: new Map(), floating: [] };
            const byAnchor = new Map();
            const floating = [];
            sourceImages
                .map((image, index) => ({ image, index }))
                .sort(sortChatImagesByRequest)
                .forEach((entry) => {
                    const anchor = String(entry.image.requestedAfterMessageId || "");
                    if (anchor && visibleMessageIds.has(anchor)) {
                        if (!byAnchor.has(anchor)) byAnchor.set(anchor, []);
                        byAnchor.get(anchor).push(entry.image);
                    } else if (anchor && knownMessageIds.has(anchor)) return;
                    else if (
                        firstVisibleTime &&
                        imageChatSortTime(entry.image) &&
                        imageChatSortTime(entry.image) < firstVisibleTime
                    )
                        return;
                    else floating.push(entry);
                });
            return { byAnchor, floating };
        }

        function keepThreadAtTopForLoadingImages(el) {
            if (!el) return;
            const scrollTop = () => {
                el.scrollTop = 0;
            };
            requestAnimationFrame(scrollTop);
            el.querySelectorAll(".chat-image-gallery img, .chat-image-gallery iframe").forEach(
                (node) => {
                    if (node.tagName === "IMG" && node.complete) return;
                    node.addEventListener("load", scrollTop, { once: true });
                    node.addEventListener("error", scrollTop, { once: true });
                },
            );
        }

        function imageDisplayNames(image = {}) {
            const targets = Array.isArray(image.targets)
                ? image.targets.map((name) => promptEntityName(name)).filter(Boolean)
                : [];
            const uniqueTargets = [...new Set(targets)];
            if (uniqueTargets.length) return uniqueTargets;
            const title = String(image.title || "").trim();
            return [title || "Image"];
        }

        function imageDisplayNameText(image = {}) {
            return imageDisplayNames(image).join(", ");
        }

        function allProfileImageRecordsForViewer() {
            return profileImageNames()
                .flatMap((name) => {
                    const entity = profileEntity(name);
                    resolveActiveProfileImageReference(entity);
                    return profileImagesForEntity(entity).map((image) => ({
                        name,
                        image,
                        active: String(image.id) === String(entity.profile_image_id || ""),
                    }));
                })
                .filter((item) => item.image);
        }

        function profileImageViewerCardHtml(item) {
            const { name, image, active } = item;
            const nameArg = htmlJsArg(name);
            const imageArg = htmlJsArg(image.id);
            const canPreview = profileImageRealHtml(image.html) && !image.pending && !image.error;
            return `
                <div class="image-card profile-option ${active ? "active" : ""}" data-profile-image-id="${escapeHtml(image.id)}">
                    <div class="image-card-heading">
                        <strong class="image-card-title">${escapeHtml(profileDisplayName(name))} ${active ? "Profile Image" : "Profile Image"}</strong>

                    </div>
                    <div class="image-render profile-image-live ${canPreview ? "clickable-image-render" : ""}" data-profile-live-id="${escapeHtml(image.id)}" ${canPreview ? `title="View full size" onclick="EmberAdventures.openProfileImagePreview(${nameArg}, ${imageArg}, 'all')"` : ""}>
                        ${profileImageInnerHtml(image)}
                        ${canPreview ? `<button type="button" class="image-preview-hitbox" title="View full size" aria-label="View full size profile image" onclick="event.stopPropagation(); EmberAdventures.openProfileImagePreview(${nameArg}, ${imageArg}, 'all')"></button>` : ""}
                    </div>
                    <div class="image-card-toolbar">
                        <button ${active ? "disabled" : ""} data-profile-action="select" data-profile-id="${escapeHtml(image.id)}" onclick="EmberAdventures.selectProfileImageFromUi(${nameArg}, ${imageArg})">${active ? "Active" : "Use this"}</button>
                        ${canPreview ? `<button class="icon-button" title="Download profile image" onclick="EmberAdventures.downloadProfileImageRecord(${nameArg}, ${imageArg})">&#11015;</button>` : ""}
                        <button class="icon-button blue" title="Load in Image Lab" onclick="EmberAdventures.loadProfileImageInLab(${nameArg}, ${imageArg})">&#128300;</button>
                        <button class="icon-button image-favorite-button ${image.favorite ? "speak-on" : "speak-off"}" title="${image.favorite ? "Unfavorite image" : "Favorite image"}" onclick="EmberAdventures.toggleProfileImageFavorite(${nameArg}, ${imageArg})">${image.favorite ? "&#9733;" : "&#9734;"}</button>
                        <button class="icon-button danger" title="Delete image" onclick="EmberAdventures.deleteProfileImage(${nameArg}, ${imageArg})">&#128465;</button>
                    </div>
                </div>
            `;
        }

        function openImageViewerModal() {
            const profileItems = allProfileImageRecordsForViewer();
            const normalImages = visibleImagesForRender();
            openModal(`
                <h2>All Images</h2>
                <details class="image-viewer-profile-group">
                    <summary>Profile Images (${profileItems.length})</summary>
                    <div class="image-viewer-grid">
                        ${
                            profileItems.length
                                ? profileItems.map(profileImageViewerCardHtml).join("")
                                : `<div class="hint">No character profile images yet.</div>`
                        }
                    </div>
                </details>
                <h3>Images (${normalImages.length})</h3>
                <div class="image-viewer-grid">
                    ${
                        normalImages.length
                            ? normalImages.map(imageCardHtml).join("")
                            : `<div class="hint">No saved images yet.</div>`
                    }
                </div>
            `);
            $("modalBox")?.setAttribute("data-image-viewer-modal", "1");
            $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
            activatePluginIframes($("modalBox"));
        }

        function normalImagePreviewItems() {
            return visibleImagesForRender()
                .map((image) => {
                    const renderedImage = renderStoredImageHtml(image.html);
                    if (!renderedImage || image.pending || image.error) return null;
                    return {
                        kind: "normal",
                        id: String(image.id),
                        title: image.title || "Image",
                        names: imageDisplayNames(image),
                        meta: `${image.favorite ? "favorite / " : ""}${image.pending ? "generating / " : ""}${image.error ? "failed / " : ""}${image.reason || "image"} / style ${imageModelLabel(image.model)}`,
                        seed: imagePreviewSeedText(image),
                        prompt: image.prompt || "",
                        negativePrompt: image.negativePrompt || image.negative_prompt || "",
                        html: renderedImage,
                    };
                })
                .filter(Boolean);
        }

        function profileImagePreviewItems(name = "", scope = "entity") {
            const names =
                scope === "all"
                    ? profileImageNames()
                    : [String(name || "")].filter(Boolean);
            return names
                .flatMap((profileName) => {
                    const entity = profileEntity(profileName);
                    if (!entity) return [];
                    return profileImagesForEntity(entity).map((image) => {
                        const renderedImage = renderStoredImageHtml(
                            profileImageRealHtml(image.html),
                        );
                        if (!renderedImage || image.pending || image.error) return null;
                        const selected =
                            String(image.id) === String(entity.profile_image_id || "");
                        return {
                            kind: "profile",
                            id: String(image.id),
                            name: profileName,
                            title: `${profileDisplayName(profileName)} Profile Image`,
                            meta: `${selected ? "selected / " : ""}${image.favorite ? "favorite / " : ""}${image.source || "generated"} / style ${imageModelLabel(image.model)}`,
                            seed: imagePreviewSeedText(image),
                            prompt: image.prompt || "",
                            negativePrompt: image.negativePrompt || image.negative_prompt || "",
                            html: renderedImage,
                        };
                    });
                })
                .filter(Boolean);
        }

        function imagePreviewPromptText(item = {}) {
            return String(item.prompt || "")
                .replace(/\s*\(\s*seed\s*:::\s*[^)]*?\)\s*/gi, " ")
                .replace(/\s*\bseed\s*:\s*\(\s*[^)]*?\)\s*/gi, " ")
                .replace(/[ \t]{2,}/g, " ")
                .trim();
        }

        function imagePreviewSeedFromPrompt(prompt = "") {
            const text = String(prompt || "");
            const match =
                text.match(/\(\s*seed\s*:::\s*([^)]+?)\s*\)/i) ||
                text.match(/\bseed\s*:\s*\(\s*([^)]+?)\s*\)/i);
            return match ? String(match[1] || "").trim() : "";
        }

        function imagePreviewSeedText(image = {}) {
            const seed = image?.seed;
            if (seed !== undefined && seed !== null && String(seed).trim()) {
                return String(seed).trim();
            }
            return imagePreviewSeedFromPrompt(image?.prompt || "") || "random";
        }

        function renderImagePreviewPopup(popup, items, index) {
            if (!popup || !items.length) return;
            const safeIndex = Math.max(0, Math.min(items.length - 1, index));
            const item = items[safeIndex];
            const promptText = imagePreviewPromptText(item);
            const negativePrompt = String(item.negativePrompt || "").trim();
            popup.box.innerHTML = `
                <div class="image-preview-stage">
                    <div class="image-preview-content">${item.html}</div>
                    <div class="image-preview-controls">
                        <button type="button" class="icon-button image-preview-info-toggle" title="Image info">i</button>
                        <button type="button" class="icon-button" title="Close">X</button>
                    </div>
                    <button type="button" class="icon-button image-preview-nav prev" title="Previous image" ${items.length <= 1 ? "disabled" : ""}><span>&lsaquo;</span></button>
                    <button type="button" class="icon-button image-preview-nav next" title="Next image" ${items.length <= 1 ? "disabled" : ""}><span>&rsaquo;</span></button>
                </div>
                <div class="image-preview-details ${popup.showInfo ? "open" : ""}">
                    <h2>${escapeHtml(item.title || "Image")}</h2>
                    ${item.names?.length ? `<div class="hint"><b>Names:</b> ${escapeHtml(item.names.join(", "))}</div>` : ""}
                    <div class="hint">${escapeHtml(item.meta || "")} / ${safeIndex + 1} of ${items.length}</div>
                    <div class="hint"><b>Seed:</b> ${escapeHtml(item.seed || "random")}</div>
                    ${
                        promptText
                            ? `<details><summary>Prompt</summary><pre>${escapeHtml(promptText)}</pre></details>`
                            : ""
                    }
                    ${
                        negativePrompt
                            ? `<details><summary>Negative prompt</summary><pre>${escapeHtml(negativePrompt)}</pre></details>`
                            : ""
                    }
                </div>
            `;
            popup.box.querySelector("button[title='Close']").onclick = popup.close;
            popup.box.querySelector(".image-preview-info-toggle").onclick = () => {
                popup.showInfo = !popup.showInfo;
                popup.box.querySelector(".image-preview-details")?.classList.toggle("open", popup.showInfo);
            };
            popup.box.querySelector(".image-preview-nav.prev").onclick = () => {
                renderImagePreviewPopup(
                    popup,
                    items,
                    (safeIndex - 1 + items.length) % items.length,
                );
            };
            popup.box.querySelector(".image-preview-nav.next").onclick = () => {
                renderImagePreviewPopup(popup, items, (safeIndex + 1) % items.length);
            };
            activatePluginIframes(popup.box);
        }

        function openImagePreviewFromItems(items, selectedId, selectedName = "", options = {}) {
            const filtered = (items || []).filter(Boolean);
            if (!filtered.length) return;
            const selectedIndex = filtered.findIndex(
                (item) =>
                    String(item.id) === String(selectedId) &&
                    (!selectedName || String(item.name || "") === String(selectedName)),
            );
            const popup = openPopupModal("");
            popup.showInfo = !!options.showInfo;
            popup.overlay.classList.add("image-preview-modal");
            popup.box.classList.add("image-preview-box");
            popup.overlay.onclick = (event) => {
                if (event.target === popup.overlay) popup.close();
            };
            renderImagePreviewPopup(
                popup,
                filtered,
                selectedIndex >= 0 ? selectedIndex : 0,
            );
        }

        function openImagePreview(id) {
            openImagePreviewFromItems(normalImagePreviewItems(), id);
        }

        function openProfileImagePreview(name, id, scope = "entity") {
            openImagePreviewFromItems(
                profileImagePreviewItems(name, scope),
                id,
                scope === "all" ? "" : name,
            );
        }

        function refreshOpenImageViewer() {
            if (!$("modalBox")?.matches?.("[data-image-viewer-modal]")) return;
            openImageViewerModal();
        }

        function imageDomId(id) {
            return String(id ?? "").replace(/"/g, "&quot;");
        }

        function updateImageCardMetadata(card, image) {
            if (!card) return;
            const title = card.querySelector(".image-card-title");
            if (title) {
                const nameText = imageDisplayNameText(image);
                title.textContent = nameText;
                title.title = nameText;
            }
            const favorite = card.querySelector(".image-favorite-button");
            if (favorite) {
                favorite.classList.toggle("speak-on", !!image.favorite);
                favorite.classList.toggle("speak-off", !image.favorite);
                favorite.title = image.favorite ? "Unfavorite image" : "Favorite image";
                favorite.innerHTML = image.favorite ? "&#9733;" : "&#9734;";
            }
        }

        function rerenderNormalImageCards(image) {
            if (!image?.id) return;
            const selector = `.image-card[data-image-id="${cssEscape(imageDomId(image.id))}"]`;
            for (const card of [...document.querySelectorAll(selector)]) {
                const renderTarget = card.querySelector(".image-render");
                if (renderTarget) {
                    renderTarget.innerHTML = imageRecordBodyHtml(image);
                    activatePluginIframes(renderTarget);
                }
                updateImageCardMetadata(card, image);
            }
        }

        function removeNormalImageCards(imageId) {
            const selector = `.image-card[data-image-id="${cssEscape(imageDomId(imageId))}"]`;
            document.querySelectorAll(selector).forEach((card) => {
                const gallery = card.closest(".chat-image-gallery");
                card.remove();
                if (gallery && !gallery.querySelector(".image-card")) gallery.remove();
            });
        }

        function refreshImageRecordSurfaces(imageId, options = {}) {
            const image = (Array.isArray(app.images) ? app.images : []).find(
                (item) => String(item.id) === String(imageId),
            );
            if (image) {
                rerenderNormalImageCards(image);
                updateImageCardMetadata(
                    document.querySelector(
                        `.image-card[data-image-id="${cssEscape(imageDomId(image.id))}"]`,
                    ),
                    image,
                );
            } else {
                removeNormalImageCards(imageId);
            }
            if (options.imagePanelStructure) {
                requestRenderRegions(
                    { imagePanel: true },
                    options.reason || "image panel structure changed",
                );
            }
            if (options.threadStructure) {
                requestRenderRegions(
                    { thread: true },
                    options.reason || "chat image timeline changed",
                );
            }
            if (options.profileRelated !== false) refreshOpenProfileRelatedImages();
            if (options.viewer !== false) refreshOpenImageViewer();
        }

        function renderStoredImageHtml(value) {
            const html = String(value || "").trim();
            if (!html) return "";
            if (isTrustedImageUiHtml(html)) return html;
            const stable = stableImageHtmlToString(html);
            return stable.replace(/<img\b(?![^>]*\bloading=)/i, '<img loading="lazy" decoding="async"');
        }

        function trustedStoredImageSrc(src = "") {
            const text = String(src || "").trim();
            return (
                /^data:image\//i.test(text) ||
                /^blob:/i.test(text) ||
                /^https:\/\/user\.uploads\.dev\/file\//i.test(text) ||
                /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(text)
            );
        }

        function imageTagForStoredSrc(src = "") {
            return trustedStoredImageSrc(src)
                ? `<img loading="lazy" decoding="async" src="${escapeHtml(String(src || "").trim())}" alt="Generated image">`
                : "";
        }

        function isTrustedImageUiHtml(html = "") {
            const text = String(html || "").trim();
            return (
                /class=["'][^"']*\bimage-loading-block\b/i.test(text) ||
                /class=["'][^"']*\bprofile-image-loading\b/i.test(text)
            );
        }

        function stableImageHtmlToString(value) {
            const live = imageHtmlToString(value);
            const text = String(live || "").trim();
            if (!text || isTrustedImageUiHtml(text)) return "";
            const direct = imageTagForStoredSrc(text);
            if (direct) return direct;
            try {
                const holder = document.createElement("div");
                holder.innerHTML = text;
                const img = holder.querySelector("img[src]");
                return imageTagForStoredSrc(img?.getAttribute("src") || "");
            } catch {
                return "";
            }
        }

        function liveImageHtmlToString(value) {
            const text = imageHtmlToString(value).trim();
            if (!text) return "";
            const stable = stableImageHtmlToString(text);
            if (stable) return stable;
            try {
                const holder = document.createElement("div");
                holder.innerHTML = text;
                const iframe = holder.querySelector("iframe");
                if (iframe) return iframe.outerHTML || "";
            } catch {
                return "";
            }
        }

        function renderImageRecordHtml(image) {
            const liveHtml =
                image?.pending && image?.id
                    ? app.imageLiveHtmlCache?.[String(image.id)] || ""
                    : "";
            return liveHtml ||
                renderStoredImageHtml(image?.html || "") ||
                imageTagForStoredSrc(image?.url || image?.hosted_url || "");
        }

        function rememberImage(image) {
            const storedId = String(image.id ?? `${Date.now()}-${Math.random()}`);
            const pendingHtml = app.pendingFinishedImages?.[String(storedId)];
            if (pendingHtml && app.pendingFinishedImages)
                delete app.pendingFinishedImages[String(storedId)];
            const record = {
                id: storedId,
                saveId: String(image.saveId || activeSaveId() || ""),
                at: new Date().toISOString(),
                favorite: false,
                title: image.title || "Image",
                reason: image.reason || "image",
                model: selectedImageModel(image.model),
                seed: image.seed ?? "random",
                prompt: String(image.prompt || ""),
                negativePrompt: String(image.negativePrompt || ""),
                html: stableImageHtmlToString(pendingHtml || image.html),
                requestedAt: String(image.requestedAt || image.at || new Date().toISOString()),
                requestOrder: Number(image.requestOrder) || nextEntryId(),
                requestedAfterMessageId: String(image.requestedAfterMessageId || ""),
                pending: !!image.pending,
                error: String(image.error || ""),
                targets: Array.isArray(image.targets)
                    ? image.targets.map(String).filter(Boolean)
                    : [],
                target_presentations: normalizedImageTargetPresentations(
                    image.target_presentations,
                ),
                hideFromChat: image.hideFromChat === true,
                profile: !!image.profile,
                promptType: String(image.promptType || ""),
                storyImageRewardId: String(image.storyImageRewardId || ""),
                hosted_url: String(image.hosted_url || ""),
                hosted_at: String(image.hosted_at || ""),
                hosted_size: Math.max(0, Math.round(Number(image.hosted_size) || 0)),
            };
            app.images = [
                record,
                ...(Array.isArray(app.images) ? app.images : []),
            ];
            pruneImageHistory(!!app.settings.downloadOldImagesBeforeDelete);
            scheduleActiveGameSave();
            if (!record.hideFromChat) {
                refreshImageRecordSurfaces(record.id, {
                    imagePanelStructure: true,
                    threadStructure: true,
                    reason: "normal image record added",
                });
            }
            return record;
        }

        function latestNormalImageChatMessageId() {
            return (
                [...(app.messages || [])]
                    .filter((message) => message?.role !== "log")
                    .at(-1)?.id || ""
            );
        }

        function createNormalImageRequest(image = {}, options = {}) {
            const record = rememberImage({
                ...image,
                requestedAt: String(
                    image.requestedAt || image.at || new Date().toISOString(),
                ),
                requestOrder:
                    Number(image.requestOrder) > 0
                        ? Number(image.requestOrder)
                        : nextEntryId(),
                requestedAfterMessageId: String(
                    image.requestedAfterMessageId ||
                        latestNormalImageChatMessageId(),
                ),
                profile: false,
            });
            if (options.startRequest !== false)
                startStoredImageRequest(record, options.requestOptions || {});
            return record;
        }

        function loadingSpinnerHtml(label = "Loading") {
            return `<div class="loading-spinner" role="status" aria-label="${escapeHtml(label || "Loading")}"></div>`;
        }

        function imageLoadingHtml(message = "Image generation in progress") {
            return `<div class="image-loading-block">${loadingSpinnerHtml(message)}</div>`;
        }

        function imageFailedHtml(message = "Image generation failed.", retryCall = "") {
            const retry = retryCall
                ? `<button type="button" class="image-retry-button" onclick="event.stopPropagation(); ${retryCall}">Retry</button>`
                : "";
            return `
                <div class="image-failed-block" role="alert">
                    <div class="image-failed-message">${escapeHtml(message || "Image generation failed.")}</div>
                    ${retry}
                </div>
            `;
        }

        function imageRecordBodyHtml(image = {}) {
            const renderedImage = renderImageRecordHtml(image);
            if (renderedImage) return renderedImage;
            if (image.error)
                return imageFailedHtml(
                    image.error,
                    `EmberAdventures.retryNormalImageRequest(${htmlJsArg(image.id)})`,
                );
            return imageLoadingHtml("Image generation in progress");
        }

        function profileImageFailedHtml(image = {}) {
            const imageArg = htmlJsArg(image.id);
            return `
                <div class="image-failed-block" role="alert">
                    <div class="image-failed-message">${escapeHtml(image.error || "Profile image generation failed.")}</div>
                    <span
                        class="image-retry-button"
                        role="button"
                        tabindex="0"
                        onclick="event.preventDefault(); event.stopPropagation(); EmberAdventures.retryProfileImageRequest(${imageArg})"
                        onkeydown="if(event.key === 'Enter' || event.key === ' '){ event.preventDefault(); event.stopPropagation(); EmberAdventures.retryProfileImageRequest(${imageArg}); }"
                    >Retry</span>
                </div>
            `;
        }

        function resetFailedImageRequestsForLoadedSave() {
            let normalCount = 0;
            let profileCount = 0;
            for (const image of app.images || []) {
                if (!image?.error || !image.prompt) continue;
                image.pending = true;
                image.error = "";
                image.html = "";
                normalCount++;
            }
            for (const image of app.profileImages || []) {
                if (!image?.error || !image.prompt) continue;
                image.pending = true;
                image.error = "";
                image.html = "";
                profileCount++;
            }
            if (normalCount || profileCount) {
                devLog("Failed image requests reset after save load", {
                    label: "image generation",
                    normalCount,
                    profileCount,
                    summary:
                        "Failed saved image requests were returned to the normal pending-image resume path.",
                });
            }
            return { normalCount, profileCount };
        }

        function resumePendingImageRequests() {
            for (const image of app.images || []) {
                if (!image?.pending || !image.prompt) continue;
                startStoredImageRequest(image, { resumed: true });
            }
        }

        function resumePendingProfileImageRequests() {
            if (!app.state?.meta?.setup_complete) return;
            for (const name of profileImageNames()) {
                const entity = profileEntity(name);
                const ownerKey = profileImageOwnerKey(name, entity);
                const active = activeProfileImage(entity);
                if (
                    active?.pending &&
                    !isActiveProfileImageRecord(active) &&
                    !app.profileImageGenerating.has(ownerKey) &&
                    !app.profileImageQueued.has(ownerKey)
                ) {
                    queueProfileImage(name, {
                        reason: "resuming pending profile image",
                        force: true,
                        pendingImageId: active.id,
                    });
                }
            }
        }

        function renderLiveImageResult(imageId, result) {
            const html = imageHtmlToString(result);
            if (!html) return false;
            const card = [
                ...document.querySelectorAll(".image-card[data-image-id]"),
            ].find((item) => item.dataset.imageId === imageDomId(imageId));
            const renderTarget = card?.querySelector(".image-render");
            if (!renderTarget) return false;
            renderTarget.innerHTML = html;
            activatePluginIframes(renderTarget);
            return true;
        }

        function imageGenerationDebugEnabled() {
            return (
                !!app.settings?.devMode ||
                (typeof devCurrentSmokeScenarioToken === "function" &&
                    !!devCurrentSmokeScenarioToken())
            );
        }

        function imageHtmlDebugKind(html = "") {
            const text = String(html || "");
            if (!text.trim()) return "empty";
            if (/^data:image\//i.test(text)) return "data-url";
            if (trustedStoredImageSrc(text)) return "image-url";
            if (/<img\b/i.test(text)) return "img-html";
            if (/<iframe\b/i.test(text)) return "iframe-html";
            if (/image-loading-block/i.test(text)) return "loading-ui";
            if (/https?:\/\/[^"'\s]+\.(?:png|jpe?g|webp|gif)/i.test(text))
                return "image-url";
            return "other";
        }

        function imagePluginResultDebugSummary(result) {
            const html = imageHtmlToString(result);
            const stable = stableImageHtmlToString(result);
            return {
                type: result == null ? String(result) : typeof result,
                keys:
                    result && typeof result === "object"
                        ? Object.keys(result).slice(0, 20)
                        : [],
                hasOnFinishPromise: !!result?.onFinishPromise,
                hasIframeHtml: !!result?.iframeHtml,
                htmlKind: imageHtmlDebugKind(html),
                hasStableHtml: !!stable,
                htmlStart: String(html || "").slice(0, 180),
            };
        }

        function normalImageRequestDebugSummary(record = {}) {
            const image = (Array.isArray(app.images) ? app.images : []).find(
                (item) => String(item.id) === String(record?.id),
            );
            const liveHtml =
                record?.id && app.imageLiveHtmlCache
                    ? app.imageLiveHtmlCache[String(record.id)] || ""
                    : "";
            const activeProfileRecords = [];
            for (const profile of app.profileImages || []) {
                if (
                    profile?.pending ||
                    app.activeProfileImageRequests?.has?.(String(profile?.id || ""))
                ) {
                    activeProfileRecords.push({
                        id: profile.id,
                        owner: profile.owner_name || profile.name || "",
                        pending: !!profile.pending,
                        error: profile.error || "",
                        hasHtml: devLooksLikeRealImageHtml(profile.html),
                        htmlKind: imageHtmlDebugKind(profile.html),
                    });
                }
            }
            return {
                imageId: record?.id || "",
                reason: record?.reason || image?.reason || "",
                title: record?.title || image?.title || "",
                requestOrder: record?.requestOrder ?? image?.requestOrder ?? null,
                pending: image?.pending ?? record?.pending ?? null,
                error: image?.error || record?.error || "",
                hasHtml: devLooksLikeRealImageHtml(image?.html || record?.html),
                htmlKind: imageHtmlDebugKind(image?.html || record?.html),
                htmlStart: String(image?.html || record?.html || "").slice(0, 180),
                liveHtmlKind: imageHtmlDebugKind(liveHtml),
                liveHtmlStart: String(liveHtml || "").slice(0, 180),
                activeImageRequests: [...(app.activeImageRequests || new Set())],
                activeProfileImageRequests: [
                    ...(app.activeProfileImageRequests || new Set()),
                ],
                profileQueueLength: app.profileImageQueue?.length || 0,
                profileQueueRunning: !!app.profileImageQueueRunning,
                profileQueued: [...(app.profileImageQueued || new Set())],
                profileGenerating: [...(app.profileImageGenerating || new Set())],
                activeProfileRecords,
            };
        }

        function devLogNormalImageLifecycle(title, record, details = {}) {
            if (!imageGenerationDebugEnabled()) return;
            devLog(title, {
                label: "image generation",
                imageId: record?.id || "",
                reason: record?.reason || "",
                summary: details.summary || title,
                ...normalImageRequestDebugSummary(record),
                ...details,
            });
        }

        function profileImageRequestDebugSummary(name, record = {}) {
            const entity = profileEntity(name);
            const image =
                record?.id && entity
                    ? profileImageById(entity, record.id) || record
                    : record;
            const liveHtml =
                record?.id && app.profileImageLiveHtmlCache
                    ? app.profileImageLiveHtmlCache[String(record.id)] || ""
                    : "";
            return {
                name: profileDisplayName(name),
                imageId: record?.id || "",
                pending: image?.pending ?? record?.pending ?? null,
                error: image?.error || record?.error || "",
                hasHtml: devLooksLikeRealImageHtml(image?.html || record?.html),
                htmlKind: imageHtmlDebugKind(image?.html || record?.html),
                htmlStart: String(image?.html || record?.html || "").slice(0, 180),
                liveHtmlKind: imageHtmlDebugKind(liveHtml),
                liveHtmlStart: String(liveHtml || "").slice(0, 180),
                activeImageRequests: [...(app.activeImageRequests || new Set())],
                activeProfileImageRequests: [
                    ...(app.activeProfileImageRequests || new Set()),
                ],
                profileQueueLength: app.profileImageQueue?.length || 0,
                profileQueueRunning: !!app.profileImageQueueRunning,
                profileQueued: [...(app.profileImageQueued || new Set())],
                profileGenerating: [...(app.profileImageGenerating || new Set())],
            };
        }

        function devLogProfileImageLifecycle(title, name, record, details = {}) {
            if (!imageGenerationDebugEnabled()) return;
            devLog(title, {
                label: "image generation",
                imageId: record?.id || "",
                name: profileDisplayName(name),
                summary: details.summary || title,
                ...profileImageRequestDebugSummary(name, record),
                ...details,
            });
        }

        function updateImageLiveHtml(imageId, html) {
            app.imageLiveHtmlCache ||= {};
            const key = String(imageId);
            const text = liveImageHtmlToString(html);
            if (text) app.imageLiveHtmlCache[key] = text;
            else delete app.imageLiveHtmlCache[key];
        }

        function updateStoredImageHtml(imageId, html, updates = {}) {
            const image = (Array.isArray(app.images) ? app.images : []).find(
                (item) => String(item.id) === String(imageId),
            );
            if (!image) {
                const stableHtml = stableImageHtmlToString(html);
                if (!stableHtml) return;
                app.pendingFinishedImages = app.pendingFinishedImages || {};
                app.pendingFinishedImages[String(imageId)] = stableHtml;
                return;
            }

            const stableHtml = stableImageHtmlToString(html);
            if (stableHtml) {
                image.html = stableHtml;
                if (app.imageLiveHtmlCache) delete app.imageLiveHtmlCache[String(imageId)];
            } else if (updates.pending) {
                updateImageLiveHtml(imageId, html);
            } else {
                image.html = "";
                if (app.imageLiveHtmlCache) delete app.imageLiveHtmlCache[String(imageId)];
            }
            if ("pending" in updates) image.pending = !!updates.pending;
            if ("error" in updates) image.error = String(updates.error || "");
            scheduleActiveGameSave();

            rerenderNormalImageCards(image);
        }

        function imageHtmlToString(value) {
            if (!value) return "";
            if (typeof value === "string") return value;
            if (value instanceof String) return String(value);
            if (value instanceof Element) return value.outerHTML || "";
            if (Array.isArray(value)) {
                return value.map(imageHtmlToString).filter(Boolean).join("");
            }
            if (typeof value === "object") {
                for (const key of [
                    "html",
                    "outerHTML",
                    "iframeHtml",
                    "imageHtml",
                    "content",
                    "result",
                    "value",
                    "element",
                    "el",
                    "node",
                ]) {
                    if (value[key]) {
                        const text = imageHtmlToString(value[key]);
                        if (text) return text;
                    }
                }
                try {
                    const text = String(value);
                    if (
                        text &&
                        text !== "[object Object]" &&
                        text !== "[object Promise]"
                    )
                        return text;
                } catch {
                    return "";
                }
            }
            return "";
        }

        function safeImageHistoryForStorage(images, options = {}) {
            return (Array.isArray(images) ? images : []).map((image) => ({
                id: image.id,
                saveId: String(image.saveId || ""),
                at: image.at,
                favorite: !!image.favorite,
                title: String(image.title || "Image"),
                reason: String(image.reason || "image"),
                model: selectedImageModel(image.model),
                seed: image.seed ?? "random",
                prompt: String(image.prompt || ""),
                negativePrompt: String(image.negativePrompt || ""),
                html:
                    options.trustStableStrings && typeof image.html === "string"
                        ? image.html
                        : stableImageHtmlToString(image.html),
                requestedAt: String(image.requestedAt || image.at || ""),
                requestedAfterMessageId: String(image.requestedAfterMessageId || ""),
                pending: !!image.pending,
                error: String(image.error || ""),
                targets: Array.isArray(image.targets)
                    ? image.targets.map(String).filter(Boolean)
                    : [],
                target_presentations: normalizedImageTargetPresentations(
                    image.target_presentations,
                ),
                hideFromChat: image.hideFromChat === true,
                profile: !!image.profile,
                promptType: String(image.promptType || ""),
                storyImageRewardId: String(image.storyImageRewardId || ""),
                hosted_url: String(image.hosted_url || ""),
                hosted_at: String(image.hosted_at || ""),
                hosted_size: Math.max(0, Math.round(Number(image.hosted_size) || 0)),
            }));
        }

        function saveImageHistorySignature(images = []) {
            return (Array.isArray(images) ? images : [])
                .map((image) =>
                    [
                        image.id,
                        image.at,
                        image.favorite ? 1 : 0,
                        image.pending ? 1 : 0,
                        image.error,
                        String(image.html || "").length,
                        image.prompt,
                    ].join("|"),
                )
                .join("\n");
        }

        function showOlderImages() {
            const images = visibleImagesForRender();
            app.imageVisibleCount = Math.min(
                images.length,
                Math.max(18, Number(app.imageVisibleCount) || 18) + 18,
            );
            renderImagePanel();
        }

        function exactImageHistoryLimit(value) {
            if (!Number.isInteger(value) || value < 1 || value > 2000)
                throw new Error("imageHistoryLimit must be an integer from 1 through 2000.");
            return value;
        }

        function exactImageRequestTimeoutSeconds(value) {
            if (!Number.isInteger(value) || value < 10 || value > 900)
                throw new Error("imageRequestTimeoutSeconds must be an integer from 10 through 900.");
            return value;
        }

        function imageRequestTimeoutMs(options = {}) {
            const explicit = Number(options.timeoutMs);
            if (Number.isFinite(explicit) && explicit > 0) return explicit;
            const seconds = exactImageRequestTimeoutSeconds(
                app.settings?.imageRequestTimeoutSeconds,
            );
            if (app.settings) app.settings.imageRequestTimeoutSeconds = seconds;
            return seconds * 1000;
        }

        function imageRequestTimeoutError(timeoutMs = 120000) {
            const seconds = Math.max(1, Math.round(Number(timeoutMs) / 1000));
            const error = new Error(
                `Image generation timed out after ${seconds} second${seconds === 1 ? "" : "s"}.`,
            );
            error.code = "IMAGE_REQUEST_TIMEOUT";
            return error;
        }

        function imageRequestFailureLogLevel(error) {
            return error?.code === "IMAGE_REQUEST_TIMEOUT" ||
                /image generation timed out after/i.test(
                    String(error?.message || error || ""),
                )
                ? "message"
                : "error";
        }

        async function waitForImageRequestWithTimeout(request, options = {}) {
            const timeoutMs = imageRequestTimeoutMs(options);
            let timeoutId = null;
            try {
                return await Promise.race([
                    Promise.resolve(request),
                    new Promise((resolve, reject) => {
                        timeoutId = setTimeout(
                            () => reject(imageRequestTimeoutError(timeoutMs)),
                            timeoutMs,
                        );
                    }),
                ]);
            } finally {
                if (timeoutId != null) clearTimeout(timeoutId);
            }
        }

        function pruneImageHistory(downloadOld) {
            const limit = exactImageHistoryLimit(app.settings?.imageHistoryLimit);
            app.settings.imageHistoryLimit = limit;
            if (!Array.isArray(app.images)) app.images = [];
            refreshKeptImageRuntimeSet();
            const removable = app.images
                .filter(
                    (image) =>
                        image &&
                        !image.favorite &&
                        !imageKeptAtRuntime(String(image.id || "")),
                )
                .sort(
                    (left, right) =>
                        (Date.parse(left.at || "") || 0) -
                        (Date.parse(right.at || "") || 0),
                );
            const removed = removable.slice(0, Math.max(0, app.images.length - limit));
            if (removed.length) {
                const removedIds = new Set(removed.map((image) => String(image.id || "")));
                app.images = app.images.filter(
                    (image) => !removedIds.has(String(image?.id || "")),
                );
                if (downloadOld) downloadImageHistoryArchive(removed);
            }
            app.imageVisibleCount = Math.min(
                Math.max(18, Number(app.imageVisibleCount) || 18),
                app.images.length || 18,
            );
            return removed;
        }

        function cleanImageHistoryInMemory() {
            app.images = safeImageHistoryForStorage(app.images || []);
        }

        function removeImageRecord(id, options = {}) {
            const index = (app.images || []).findIndex(
                (image) => String(image.id) === String(id),
            );
            if (index < 0) return false;
            app.images.splice(index, 1);
            if (options.save !== false) scheduleActiveGameSave();
            if (options.refresh !== false)
                refreshImageRecordSurfaces(id, {
                    imagePanelStructure: true,
                    threadStructure: true,
                    reason: options.reason || "normal image record deleted",
                });
            return true;
        }

        async function deleteImageRecord(id) {
            const imageId = String(id || "");
            const saveImage = (app.images || []).find(
                (image) => String(image.id) === imageId,
            );
            const characterImage = (app.characterImages || []).find(
                (image) => String(image.id) === imageId,
            );
            if (!saveImage && !characterImage) return false;
            if (
                !(await showConfirm(
                    "Delete Image",
                    "Delete this image from the image list?",
                    { confirmText: "Delete", danger: true },
                ))
            )
                return false;
            if (saveImage) return removeImageRecord(imageId);
            try {
                await app.persistence.deleteSharedImage("characterImages", imageId);
                app.characterImages = (app.characterImages || []).filter(
                    (image) => String(image.id) !== imageId,
                );
                revokeSessionImageObjectUrl(`characterImages|${imageId}`);
                refreshOpenProfileRelatedImages();
                log("Character image deleted", `Deleted stored character image ${imageId}.`, {
                    type: "image",
                    level: "message",
                });
                return true;
            } catch (error) {
                const message = error?.message || String(error);
                showNotice("Image Delete Failed", message);
                log("Character image delete failed", message, {
                    type: "image",
                    level: "error",
                });
                return false;
            }
        }

        function toggleImageFavorite(id) {
            const image = (app.images || []).find(
                (item) => String(item.id) === String(id),
            );
            if (!image) return;
            image.favorite = !image.favorite;
            refreshKeptImageRuntimeSet();
            scheduleActiveGameSave();
            refreshImageRecordSurfaces(image.id, {
                reason: "normal image favorite toggled",
            });
        }

        function loadImageInLab(id, options = {}) {
            const image = (app.images || []).find(
                (item) => String(item.id) === String(id),
            );
            if (!image) return;
            const profileTarget = String(options.profileTarget || "").trim();
            openImageLabModal({
                ...image,
                targets: profileTarget
                    ? [profileTarget]
                    : Array.isArray(image.targets)
                      ? image.targets
                      : [],
                profile: image.profile === true || !!profileTarget,
                popup: !!options.popup,
            });
        }

        function imageRecordForDownload(id) {
            return [
                ...(Array.isArray(app.images) ? app.images : []),
                ...(Array.isArray(app.characterImages) ? app.characterImages : []),
            ].find((item) => String(item.id) === String(id));
        }

        function downloadImageRecord(id) {
            const image = imageRecordForDownload(id);
            if (!image) return;
            return downloadSingleImageRecord(
                image,
                image.title || image.reason || "image",
            );
        }

        function downloadImageHistoryArchive(images) {
            if (!images?.length) return;
            const archive = buildImageArchiveFiles({
                type: "old-image-history",
                images,
            });
            const blob = makeZip(archive.files);
            const a = document.createElement("a");
            const stamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-old-images-${stamp}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function buildImageArchiveFiles({ type, images, character = "" }) {
            const metadataImages = [];
            const files = {};
            for (const [index, image] of (images || []).entries()) {
                const extracted = extractImageDataUrl(image.html);
                const baseName = safeArchiveFileName(
                    `${String(index + 1).padStart(3, "0")}-${image.title || image.reason || image.id || "image"}`,
                );
                let imageFile = "";
                if (extracted) {
                    imageFile = `${baseName}.${extracted.ext}`;
                    files[imageFile] = extracted.bytes;
                }
                const metadata = imageDownloadMetadata(image, imageFile);
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
                    imageFiles: Object.keys(files).filter(
                        (name) => /\.(?:png|jpe?g|webp|gif)$/i.test(name),
                    ),
                    images: metadataImages,
                },
                null,
                2,
            );
            files["README.txt"] =
                "This archive contains generated EmberAdventures images and same-name JSON sidecars.\nmetadata.json is an aggregate index. Each image sidecar preserves its prompt, negative prompt, model, seed, targets, and other available generation metadata.\n";
            return { files, metadataImages };
        }

        function extractImageDataUrl(html) {
            const text = imageHtmlToString(html);
            const direct = text.match(/^(data:image\/[^;]+;base64,[a-z0-9+/=]+)$/i);
            const src = text.match(/src=["'](data:image\/[^;]+;base64,[^"']+)["']/i);
            const dataUrl = direct?.[1] || src?.[1] || "";
            if (!dataUrl) return null;
            const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/i);
            if (!match) return null;
            const ext = imageMimeExtension(match[1]);
            try {
                return {
                    ext,
                    bytes: base64ToBytes(match[2]),
                    dataUrl,
                };
            } catch {
                return null;
            }
        }

        function extractImageSrc(html) {
            const text = imageHtmlToString(html);
            const directData = text.match(/^(data:image\/[^;]+;base64,[a-z0-9+/=]+)$/i);
            if (directData?.[1]) return directData[1];
            const src = text.match(/src=["']([^"']+)["']/i);
            return src?.[1] || "";
        }

        function normalizedImageTargetPresentations(value) {
            if (!isPlainObject(value)) return {};
            const output = {};
            for (const [target, presentation] of Object.entries(value)) {
                const key = String(target || "").trim();
                const normalized =
                    presentation === "male"
                        ? "male"
                        : presentation === "non_male"
                          ? "non_male"
                          : "";
                if (key && normalized) output[key] = normalized;
            }
            return output;
        }

        function imageSrcExtension(src = "") {
            const data = src.match(/^data:image\/([^;]+);/i);
            if (data) return imageMimeExtension(data[1]);
            const url = String(src || "").split("?")[0];
            const ext = url.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
            if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || ""))
                return ext === "jpeg" ? "jpg" : ext;
            return "png";
        }

        function imageDownloadMetadata(image, imageFileName = "") {
            const metadata = isPlainObject(image) ? { ...image } : {};
            delete metadata.html;
            metadata.image_file = imageFileName;
            metadata.exported_at = new Date().toISOString();
            return metadata;
        }

        function downloadImageMetadataSidecar(metadata, filename) {
            const blob = new Blob([JSON.stringify(metadata, null, 2)], {
                type: "application/json",
            });
            const a = document.createElement("a");
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = filename;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        async function downloadSingleImageRecord(image, label = "image") {
            const src =
                extractImageSrc(image?.html) ||
                String(image?.url || image?.hosted_url || "").trim();
            if (!src) {
                showNotice("Download Failed", "This image does not have downloadable image data yet.");
                return;
            }
            let downloadUrl = src;
            let revokeDownloadUrl = false;
            let extension = imageSrcExtension(src);
            try {
                if (!/^(?:data:image\/|blob:)/i.test(src)) {
                    const response = await fetch(src, { cache: "no-store" });
                    if (!response.ok)
                        throw new Error(`Image download returned HTTP ${response.status}.`);
                    const blob = await response.blob();
                    if (blob.type && !/^image\//i.test(blob.type))
                        throw new Error(`Image download returned ${blob.type} instead of image data.`);
                    if (/^image\//i.test(blob.type))
                        extension = imageMimeExtension(blob.type.replace(/^image\//i, ""));
                    downloadUrl = URL.createObjectURL(blob);
                    revokeDownloadUrl = true;
                }
                const a = document.createElement("a");
                const stamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-")
                    .slice(0, 19);
                const baseName = `${safeArchiveFileName(label || image?.id || "image")}-${stamp}`;
                const imageFileName = `${baseName}.${extension}`;
                a.href = downloadUrl;
                a.download = imageFileName;
                document.body.append(a);
                a.click();
                a.remove();
                downloadImageMetadataSidecar(
                    imageDownloadMetadata(image, imageFileName),
                    `${baseName}.json`,
                );
            } catch (error) {
                showNotice(
                    "Download Failed",
                    error?.message || "The image could not be downloaded.",
                );
            } finally {
                if (revokeDownloadUrl)
                    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            }
        }

        async function imageRecordBlobForUpload(image) {
            const src = extractImageSrc(image?.html) || image?.hosted_url || "";
            if (!src) throw new Error("This image does not have uploadable image data yet.");
            if (/^https:\/\/user\.uploads\.dev\/file\//i.test(src)) {
                return { hostedUrl: src, blob: null };
            }
            try {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return { blob: await response.blob(), hostedUrl: "" };
            } catch (err) {
                if (/^https?:\/\//i.test(src))
                    return { hostedUrl: src, blob: null };
                throw new Error(`Could not read image data for upload: ${err.message || err}`);
            }
        }

        function applyHostedImageMetadata(image, upload) {
            const url = hostedUploadUrlText(upload?.url, "Hosted image upload");
            const existingHtml = imageHtmlToString(image.html).trim();
            image.hosted_url = url;
            image.hosted_at = new Date().toISOString();
            image.hosted_size = Math.max(0, Math.round(Number(upload.size) || 0));
            if (!existingHtml) image.html = url;
            return image;
        }

        async function shareImageRecord(id) {
            const image = (app.images || []).find(
                (item) => String(item.id) === String(id),
            );
            if (!image) return;
            if (image.hosted_url) {
                await showHostedShareResult("Hosted Image URL", image.hosted_url);
                return;
            }

            try {
                setStatus("Uploading image...");
                const { blob, hostedUrl } = await imageRecordBlobForUpload(image);
                const upload = hostedUrl
                    ? { url: hostedUrl, size: 0 }
                    : await uploadBlobToUserUploads(blob, "Image upload");
                applyHostedImageMetadata(image, upload);
                scheduleActiveGameSave();
                refreshImageRecordSurfaces(image.id, {
                    reason: "normal image hosted metadata updated",
                });
                await showHostedShareResult("Hosted Image URL", upload.url);
            } catch (err) {
                showNotice("Image Share Failed", err.message || String(err));
            } finally {
                setStatus("Ready");
            }
        }

        async function shareProfileImageRecord(name, id) {
            const entity = profileEntity(name);
            const image = entity ? profileImageById(entity, id) : null;
            if (!image) return;
            if (image.hosted_url) {
                await showHostedShareResult("Hosted Profile Image URL", image.hosted_url);
                return;
            }

            try {
                setStatus("Uploading profile image...");
                const { blob, hostedUrl } = await imageRecordBlobForUpload(image);
                const upload = hostedUrl
                    ? { url: hostedUrl, size: 0 }
                    : await uploadBlobToUserUploads(blob, "Profile image upload");
                applyHostedImageMetadata(image, upload);
                upsertProfileStoreImage(
                    image,
                    profileImageOwnerNameForHandle(name, entity),
                );
                replaceEmbeddedProfileImageRecord(entity, image);
                scheduleActiveGameSave();
                refreshProfileImageSurfaces(name);
                await showHostedShareResult("Hosted Profile Image URL", upload.url);
            } catch (err) {
                showNotice("Profile Image Share Failed", err.message || String(err));
            } finally {
                setStatus("Ready");
            }
        }

        function imageMimeExtension(mimePart) {
            const clean = String(mimePart || "").toLowerCase();
            if (clean.includes("jpeg") || clean.includes("jpg")) return "jpg";
            if (clean.includes("webp")) return "webp";
            if (clean.includes("gif")) return "gif";
            return "png";
        }

        function base64ToBytes(base64) {
            const binary = atob(String(base64 || "").replace(/\s+/g, ""));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        }

        function safeArchiveFileName(value) {
            return (
                String(value || "image")
                    .replace(/[^a-z0-9._-]+/gi, "-")
                    .replace(/^-+|-+$/g, "")
                    .slice(0, 80) || "image"
            );
        }

        function downloadImageHistoryArchiveJsonOnly(images) {
            if (!images?.length) return;
            const payload = {
                app: "EmberAdventures",
                type: "old-image-history",
                exportedAt: new Date().toISOString(),
                count: images.length,
                images,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
            });
            const a = document.createElement("a");
            const stamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = URL.createObjectURL(blob);
            a.download = `emberadventureslite-old-images-${stamp}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function refreshKeptImageRuntimeSet() {
            const kept = new Set();
            for (const image of app.images || []) {
                if (image?.favorite) kept.add(String(image.id));
            }
            for (const image of app.profileImages || []) {
                if (image?.favorite) kept.add(String(image.id));
            }
            for (const name of profileImageNames()) {
                const entity = profileEntity(name);
                if (!entity) continue;
                const activeId = String(entity.profile_image_id || "");
                const configuredDefaultId = configuredDefaultProfileLocalImageId(entity);
                const profileImages = profileImagesForEntity(entity, {
                    validateActive: false,
                });
                const newestByPresentation = [true, false]
                    .map((male) =>
                        profileImages
                            .filter(
                                (image) =>
                                    image.male === male &&
                                    profileImageIsFinished(image),
                            )
                            .sort(
                                (a, b) =>
                                    (Date.parse(b.at || "") || 0) -
                                    (Date.parse(a.at || "") || 0),
                            )[0],
                    )
                    .filter(Boolean);
                for (const image of profileImages) {
                    if (image.favorite || String(image.id) === activeId)
                        kept.add(String(image.id));
                    if (
                        String(image.id) === configuredDefaultId ||
                        newestByPresentation.some(
                            (newest) => String(newest.id) === String(image.id),
                        )
                    )
                        kept.add(String(image.id));
                    if (image.source_image_id) kept.add(String(image.source_image_id));
                }
            }
            app.keptImageIds = kept;
            return kept;
        }

        function imageKeptAtRuntime(id) {
            if (!app.keptImageIds) refreshKeptImageRuntimeSet();
            return app.keptImageIds?.has?.(String(id));
        }

        function profileEntityCharacterId(entity = {}) {
            return String(
                entity?.id || entity?.character_id || entity?.definition_id || "",
            ).trim();
        }

        function profileEntityByCharacterId(characterId) {
            const wanted = String(characterId || "").trim();
            if (!wanted) return null;
            const candidates = [];
            if (app.state?.player) candidates.push(app.state.player);
            for (const character of Object.values(app.state?.characters || {}))
                candidates.push(character);
            for (const location of Object.values(app.state?.npc_directory?.locations || {})) {
                for (const collectionName of ["characters", "npcs"]) {
                    for (const record of Object.values(location?.[collectionName] || {})) {
                        candidates.push(record?.full_character || record);
                    }
                }
            }
            for (const entry of Object.values(app.state?.future_cast?.items || {})) {
                candidates.push(
                    entry?.full_character ||
                        entry?.character ||
                        entry?.npc?.full_character ||
                        entry?.npc,
                );
            }
            for (const override of Object.values(app.profileEntityOverrides || {}))
                candidates.push(override);
            return (
                candidates.find(
                    (entity) => profileEntityCharacterId(entity) === wanted,
                ) || null
            );
        }

        function profileEntityForHandle(name, characterId = "") {
            const override = app.profileEntityOverrides?.[String(name || "")];
            const wantedId = String(characterId || "").trim();
            if (
                override?.profile_image_request_key &&
                (!wantedId || profileEntityCharacterId(override) === wantedId)
            )
                return override;
            return profileEntityByCharacterId(characterId) || profileEntity(name);
        }

        function characterReferenceMatchesEntity(reference, name, entity = {}) {
            const value = String(reference || "").trim();
            if (!value) return false;
            return [
                name,
                entity?.name,
                profileEntityCharacterId(entity),
            ].some((candidate) => String(candidate || "").trim() === value);
        }

        function profileEntity(name) {
            // Party promotion can leave a same-name NPC shell behind for history.
            // Profile UI/actions must prefer the party character so promotion
            // does not appear to hide or regenerate the portrait on the card.
            if (name === "Player") return app.state.player;
            const override = app.profileEntityOverrides?.[String(name || "")];
            // Story-player cards use a stable request key because their names can
            // collide with characters in the currently loaded game. The request
            // must keep resolving to the card character until selection closes.
            if (override?.profile_image_request_key) return override;
            const partyCharacter = app.state.characters?.[name];
            if (partyCharacter) return partyCharacter;
            const npc = findNpcEntryExact(name)?.npc || getNpcEntry(name);
            if (npc?.full_character || npc) return npc?.full_character || npc;
            if (override) return override;
            return profileEntityByCharacterId(name);
        }

        function profileDisplayName(name) {
            if (name === "Player") return app.state.player?.name || "Player";
            return profileEntity(name)?.name || name;
        }

        function profileImageOwnerKey(name, entity = profileEntity(name)) {
            if (name === "Player" || entity === app.state.player) {
                const presentation = profileImageMalePresentation(entity)
                    ? "male"
                    : "non_male";
                return `Player|${presentation}`;
            }
            const requestKey = String(entity?.profile_image_request_key || "").trim();
            if (
                requestKey &&
                Object.values(app.profileEntityOverrides || {}).some(
                    (override) => override === entity,
                )
            )
                return requestKey;
            if (!entity || typeof entity !== "object")
                throw new Error(
                    `Profile image request ${String(name || "(unknown)")} requires an exact character entity.`,
                );
            const characterId = String(entity.id || "").trim();
            if (!characterId)
                throw new Error(
                    `Profile image request ${String(entity.name || name || "(unknown)")} requires the character's exact id.`,
                );
            const alternateId = String(entity.character_id || "").trim();
            if (alternateId && alternateId !== characterId)
                throw new Error(
                    `Profile image character identity mismatch: id ${characterId} does not match character_id ${alternateId}.`,
                );
            const storyId = String(
                app.profileImageStoryScopeByEntity?.get?.(entity) || "",
            ).trim();
            const presentation = profileImageMalePresentation(entity)
                ? "male"
                : "non_male";
            return `${storyId ? `${storyId}|` : ""}${characterId}|${presentation}`;
        }

        function profileImageEntityHasOwnerIdentity(name, entity = profileEntity(name)) {
            if (name === "Player" || entity === app.state.player) return true;
            return !!String(entity?.id || "").trim();
        }

        function profileImageRequestIsPending(name, entity = profileEntity(name)) {
            if (!profileImageEntityHasOwnerIdentity(name, entity)) return false;
            const ownerKey = profileImageOwnerKey(name, entity);
            return (
                app.profileImageGenerating?.has(ownerKey) ||
                app.profileImageQueued?.has(ownerKey)
            );
        }

        function activeProfileImageRequestIdForOwner(ownerKey) {
            return String(app.activeProfileImageRequestByOwner?.[String(ownerKey || "")] || "");
        }

        function isCurrentProfileImageRequest(ownerKey, record) {
            const id = String(record?.id || "");
            if (!id) return false;
            if (app.supersededProfileImageRequests?.has?.(id)) return false;
            if (!app.activeProfileImageRequests?.has?.(id)) return false;
            return activeProfileImageRequestIdForOwner(ownerKey) === id;
        }

        function profileImageRequestIframeHostKey(ownerKey) {
            return `profile-image:${String(ownerKey || "").replace(/[^\w.-]+/g, "_")}`;
        }

        function normalImageRequestIframeHostKey(imageId) {
            return `normal-image:${String(imageId || "").replace(/[^\w.-]+/g, "_")}`;
        }

        function supersedeActiveProfileImageRequest(ownerKey, nextRecord, reason = "") {
            const owner = String(ownerKey || "");
            const nextId = String(nextRecord?.id || "");
            const oldId = activeProfileImageRequestIdForOwner(owner);
            if (!owner || !oldId || oldId === nextId) return;
            app.supersededProfileImageRequests ||= new Set();
            app.supersededProfileImageRequests.add(oldId);
            app.activeProfileImageRequests?.delete?.(oldId);
            if (app.profileImageRequestOwnerById)
                delete app.profileImageRequestOwnerById[oldId];
            removeImageGenerationIframeHost(
                profileImageRequestIframeHostKey(owner),
                "replacing active profile image generation",
            );
            const oldRecord = (app.profileImages || []).find(
                (image) => String(image?.id || "") === oldId,
            );
            if (oldRecord?.pending) {
                oldRecord.pending = false;
                oldRecord.error = "";
                oldRecord.replaced_by = nextId;
                oldRecord.replaced_reason = reason || "new profile image request";
            }
            devLogProfileImageLifecycle(
                "Profile image request superseded",
                owner,
                oldRecord || { id: oldId },
                {
                    ownerKey: owner,
                    replacedBy: nextId,
                    reason: reason || "new profile image request",
                    summary:
                        "A newer profile image request for the same owner replaced this pending request; late results will be ignored.",
                },
            );
        }

        function createProfileImageRecord(image = {}) {
            if (!isPlainObject(image))
                throw new Error("A new profile image record must be an object.");
            const record = {
                id: image.id ?? String(Date.now() + Math.random()),
                saveId: image.saveId ?? "",
                at: image.at ?? new Date().toISOString(),
                source: image.source ?? "generated",
                model: image.model ?? selectedImageModel(),
                seed: exactProfileImageSeed(
                    image.seed ?? 0,
                    "profile image record seed",
                ),
                prompt: image.prompt ?? "",
                negativePrompt: image.negativePrompt ?? "",
                owner_name: image.owner_name ?? "",
                character_id: image.character_id,
                male: image.male ?? null,
                source_image_id: image.source_image_id ?? "",
                profile: image.profile ?? true,
                favorite: image.favorite ?? false,
                html: stableImageHtmlToString(image.html ?? ""),
                pending: image.pending ?? false,
                error: image.error ?? "",
                hosted_url: image.hosted_url ?? "",
                hosted_at: image.hosted_at ?? "",
                hosted_size: image.hosted_size ?? 0,
                crop: image.crop ?? null,
            };
            if (Object.hasOwn(image, "replaced_by")) record.replaced_by = image.replaced_by;
            if (Object.hasOwn(image, "replaced_reason"))
                record.replaced_reason = image.replaced_reason;
            const validation = validateProfileImageStore([record]);
            if (!validation.ok) throw new Error(validationErrorsText(validation));
            return record;
        }

        function isImageLoadingHtml(value) {
            const html = String(value || "").trim();
            return /class=["'][^"']*\bimage-loading-block\b/i.test(html);
        }

        function profileImageRealHtml(value) {
            const html = imageHtmlToString(value);
            if (isImageLoadingHtml(html)) return "";
            if (/class=["'][^"']*\bprofile-image-loading\b/i.test(html)) return "";
            if (
                app.devSmokeSuite?.running !== true &&
                /alt=["']Smoke fake image["']/i.test(html)
            )
                return "";
            return html;
        }

        function profileImageIframeRequestInfo(iframeHtml) {
            const info = {};
            try {
                const holder = document.createElement("div");
                holder.innerHTML = String(iframeHtml || "");
                const iframe = holder.querySelector("iframe");
                const dataSrc =
                    iframe?.dataset?.src ||
                    iframe?.getAttribute("data-src") ||
                    iframe?.getAttribute("src") ||
                    "";
                if (iframe?.id) info.iframeId = iframe.id;
                const urlHashIndex = dataSrc.indexOf("#");
                if (urlHashIndex >= 0) {
                    const encoded = dataSrc.slice(urlHashIndex + 1);
                    const decoded = JSON.parse(decodeURIComponent(encoded));
                    if (decoded && typeof decoded === "object") Object.assign(info, decoded);
                }
            } catch {}
            return info;
        }

        function safeProfileImageIframeStatusText(iframeEl) {
            if (!iframeEl) return "";
            try {
                const doc =
                    iframeEl.contentDocument ||
                    iframeEl.contentWindow?.document ||
                    null;
                if (!doc) return "";
                const selectors = [
                    "[data-status]",
                    "[data-loading-message]",
                    "[data-generation-status]",
                    ".loading-message",
                    ".status",
                    ".progress",
                    ".message",
                    "body",
                ];
                for (const selector of selectors) {
                    const text = String(
                        doc.querySelector(selector)?.textContent || "",
                    )
                        .replace(/\s+/g, " ")
                        .trim();
                    if (text) return text.slice(0, 180);
                }
            } catch {}
            return "";
        }

        function profileImagePendingInfoHtml(
            iframeHtml,
            message = "Perchance image generation",
            statusText = "",
        ) {
            const info = profileImageIframeRequestInfo(iframeHtml);
            const rows = [];
            if (info.resolution) rows.push(`Resolution: ${info.resolution}`);
            if (info.seed !== undefined && info.seed !== null) rows.push(`Seed: ${info.seed}`);
            if (info.guidanceScale !== undefined && info.guidanceScale !== null)
                rows.push(`Guidance: ${info.guidanceScale}`);
            if (info.requestId) rows.push(`Request: ${String(info.requestId).slice(0, 14)}`);
            const metaHtml = rows
                .slice(0, 4)
                .map((row) => `<div class="profile-image-loading-meta">${escapeHtml(row)}</div>`)
                .join("");
            return `
                <div class="profile-image-loading profile-image-loading-rich">
                    <div class="profile-image-loading-title">${escapeHtml(message || "Perchance image generation")}</div>
                    ${metaHtml}
                    ${statusText ? `<div class="profile-image-loading-status">${escapeHtml(statusText)}</div>` : ""}
                    ${loadingSpinnerHtml("Profile image generation in progress")}
                </div>
            `;
        }

        function scheduleProfileImageLoadingAutosize(rootNode = document) {
            requestAnimationFrame(() => autosizeProfileImageLoadingOverlays(rootNode));
        }

        function autosizeProfileImageLoadingOverlays(rootNode = document) {
            const overlays = [
                ...((rootNode || document).querySelectorAll?.(".profile-image-loading-rich") || []),
            ];
            for (const overlay of overlays) autosizeProfileImageLoadingOverlay(overlay);
        }

        function autosizeProfileImageLoadingOverlay(overlay) {
            const box = overlay?.closest?.(
                ".profile-image-button, .profile-image-live, .profile-image-thumb-wrap, .image-render",
            );
            const width = Math.max(0, box?.clientWidth || overlay.clientWidth || 0);
            const height = Math.max(0, box?.clientHeight || overlay.clientHeight || width);
            if (!width || !height) return;
            const lines = [
                ...overlay.querySelectorAll(
                    ".profile-image-loading-title, .profile-image-loading-meta, .profile-image-loading-status",
                ),
            ];
            if (!lines.length) return;
            overlay.style.removeProperty("--profile-loading-font-size");
            const measuringSize = Math.max(10, Math.min(18, width * 0.16));
            overlay.style.setProperty("--profile-loading-font-size", `${measuringSize}px`);
            let widest = 1;
            for (const line of lines) {
                line.style.whiteSpace = "nowrap";
                widest = Math.max(widest, line.scrollWidth || 1);
            }
            const spinner = overlay.querySelector(".loading-spinner");
            const lineCount = lines.length + (spinner ? 1.8 : 0);
            const maxByWidth = measuringSize * ((width * 0.9) / widest);
            const maxByHeight = (height * 0.84) / Math.max(1, lineCount * 1.12);
            const fontSize = Math.max(6, Math.min(22, maxByWidth, maxByHeight));
            overlay.style.setProperty("--profile-loading-font-size", `${fontSize}px`);
        }

