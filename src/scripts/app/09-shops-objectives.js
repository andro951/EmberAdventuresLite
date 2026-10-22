
        function openStoryShopsModal() {
            const shops = unlockedStoryShops();
            if (!shops.length) {
                openStoryShopFullscreen(`
                    <div class="character-shop-shell">
                        ${storyShopHeaderHtml({ title: "Shops & Job Boards" }, "", {
                            backAction: "EmberAdventures.closeModal()",
                            backTitle: "Close shops",
                            includeLocation: false,
                        })}
                        <div class="character-shop-empty">No shops or job boards are available in this story yet.</div>
                    </div>
                `, "shop-directory");
                return false;
            }
            const search = String(app.storyShopDirectorySearch || "");
            const inventory = ensureStoryInventory(app.state);
            const rows = shops
                .map((shop) => `
                    <button class="story-shop-directory-card" type="button" data-story-shop-card="${escapeHtml(String(shop.id || ""))}" data-story-shop-title="${escapeHtml(String(shop.title || ""))}" onclick="EmberAdventures.enterStoryShop(${htmlJsArg(shop.id)})">
                        <div class="story-shop-card-heading">
                            <div>
                                <div class="story-shop-card-title">${escapeHtml(shop.title)}</div>
                                <div class="story-shop-card-meta">${escapeHtml(shop.subtype || humanizeIdentifierLabel(shop.type))}</div>
                            </div>
                            <span class="character-shop-status available">${escapeHtml(humanizeIdentifierLabel(shop.type))}</span>
                        </div>
                        <div class="story-shop-card-meta">${escapeHtml(storyShopLocationLabel(shop))}</div>
                        ${shop.description ? `<p class="story-shop-card-description">${escapeHtml(shop.description)}</p>` : ""}
                    </button>`)
                .join("");
            openStoryShopFullscreen(`
                <div class="character-shop-shell">
                    ${storyShopHeaderHtml({
                        title: "Shops & Job Boards",
                        subtype: `${shops.length} available`,
                    }, `${inventory.coins || 0} coins`, {
                        backAction: "EmberAdventures.closeModal()",
                        backTitle: "Close shops",
                        includeLocation: false,
                    })}
                    <div class="character-shop-toolbar">
                        <input type="search" value="${escapeHtml(search)}" placeholder="Search shop titles..." aria-label="Search shops by title" oninput="EmberAdventures.filterStoryShopDirectory(this.value)">
                        <span class="story-shop-toolbar-note">Rank ${escapeHtml(String(inventory.adventurer_rank || 0))}</span>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openStoryInventoryModal()"><span class="tool-icon">&#127991;</span><span class="tool-label">Inventory</span></button>
                    </div>
                    <div class="story-shop-directory">${rows}</div>
                    <div class="character-shop-empty" data-story-shop-search-empty hidden>No shop titles match that search.</div>
                </div>
            `, "shop-directory");
            filterStoryShopDirectory(search);
            return true;
        }

        function filterStoryShopDirectory(value = "") {
            const search = String(value || "");
            const query = search.trim().toLocaleLowerCase();
            app.storyShopDirectorySearch = search;
            const box = $("modalBox");
            const cards = [...(box?.querySelectorAll?.("[data-story-shop-card]") || [])];
            let shown = 0;
            for (const card of cards) {
                const title = String(card.dataset.storyShopTitle || "").toLocaleLowerCase();
                card.hidden = !!query && !title.includes(query);
                if (!card.hidden) shown += 1;
            }
            const empty = box?.querySelector?.("[data-story-shop-search-empty]");
            if (empty) empty.hidden = shown > 0 || cards.length === 0;
            return shown;
        }

        function storyShopHeaderHtml(shop = {}, balanceText = "", options = {}) {
            const location = options.includeLocation === false ? "" : storyShopLocationLabel(shop);
            const subtitle = [shop.subtype || humanizeIdentifierLabel(shop.type), location]
                .filter(Boolean)
                .join(" / ");
            const backAction = options.backAction || "EmberAdventures.openStoryShopsModal()";
            const backTitle = options.backTitle || "Back to shops";
            return `
                <div class="character-shop-header">
                    <div class="character-shop-heading">
                        <div class="character-shop-title">${escapeHtml(shop.title || "Shop")}</div>
                        ${subtitle ? `<div class="character-shop-subtitle">${escapeHtml(subtitle)}</div>` : ""}
                        ${shop.description ? `<div class="character-shop-subtitle">${escapeHtml(shop.description)}</div>` : ""}
                    </div>
                    <div class="character-shop-header-actions row">
                        ${balanceText ? `<div class="character-shop-balance">${escapeHtml(balanceText)}</div>` : ""}
                        <button class="icon-button" type="button" title="${escapeHtml(backTitle)}" onclick="${escapeHtml(backAction)}">&times;</button>
                    </div>
                </div>`;
        }

        function openStoryShopFullscreen(html = "", scrollKey = "story-shop") {
            openModal(html, { hideClose: true, scrollKey });
            $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
            $("modalBox")?.setAttribute("data-character-shop-modal", "1");
            scheduleAutosizeLibraryCardText($("modalBox"));
            return true;
        }

        function storyShopOwnerCardHtml(shop = {}) {
            const ownerId = textSlot(shop.owner_npc_id, "");
            if (!ownerId) return "";
            const locationId = storyShopNpcLocationId(shop);
            const owner = ensureStoryShopOwnerNpc(shop, locationId, {
                reason: "story shop owner",
                note: `${shop.title} owner.`,
                location_label: storyShopLocationLabel(shop),
            });
            const ownerName = owner?.name || resolveStoryShopOwnerName(shop);
            if (!ownerName) return "";
            const npc = getNpcEntryFromState(app.state, ownerName);
            const ownerEntity = npc?.full_character || npc;
            const profile = activeProfileImage(ownerEntity);
            const profileHtml = profile
                ? profileImageInnerHtml(profile)
                : `<div class="profile-image-placeholder" aria-label="Shop owner profile image placeholder"></div>`;
            return `
                <div class="character-shop-owner">
                    <div class="character-shop-owner-main">
                        <button class="character-shop-owner-profile" type="button" title="View ${escapeHtml(ownerName)} profile images" data-character-action="profile" data-character-name="${escapeHtml(ownerName)}" onclick="EmberAdventures.openProfileImageModal(${htmlJsArg(ownerName)})">${profile?.id ? `<div class="profile-image-thumb-wrap" data-profile-live-id="${escapeHtml(String(profile.id))}">${profileHtml}</div>` : profileHtml}</button>
                        <div><div class="character-shop-owner-name">${escapeHtml(ownerName)}</div><div class="hint">${escapeHtml(npc?.role || "shop owner")}</div></div>
                    </div>
                    <button class="tool-button" type="button" onclick="EmberAdventures.chatWithStoryShopOwner(${htmlJsArg(shop.id)})"><span class="tool-icon">&#128172;</span><span class="tool-label">Chat</span></button>
                </div>`;
        }

        function storyCharacterShopPurchaseMode(shop = {}, item = {}) {
            const itemMode = String(item.purchase_mode || "").trim().toLowerCase();
            if (["acquire", "service"].includes(itemMode)) return itemMode;
            return String(shop.purchase_mode || "").trim().toLowerCase() === "service"
                ? "service"
                : "acquire";
        }

        function storyCharacterShopPurchaseIsRepeatable(shop = {}, item = {}) {
            if (typeof item.repeatable === "boolean") return item.repeatable;
            return shop.repeatable === true;
        }

        function storyCharacterShopListingIsAcquired(shop = {}, item = {}) {
            return (
                storyCharacterShopPurchaseMode(shop, item) === "acquire" &&
                item.purchased === true
            );
        }

        function storyCharacterShopListingIsAvailable(shop = {}, item = {}) {
            if (item.removed === true) return false;
            if (storyCharacterShopPurchaseIsRepeatable(shop, item)) return true;
            return item.purchased !== true;
        }

        function storyCharacterShopUiState(shop = {}) {
            app.storyCharacterShopUi ||= {};
            const existing = app.storyCharacterShopUi[shop.id] || {};
            const available = (shop.items || []).filter((item) =>
                storyCharacterShopListingIsAvailable(shop, item),
            );
            const acquired = (shop.items || []).filter((item) =>
                storyCharacterShopListingIsAcquired(shop, item),
            );
            const view = existing.view === "acquired" && acquired.length ? "acquired" : "available";
            const visible = view === "acquired" ? acquired : available;
            const selectedCharacterId = visible.some(
                (item) => item.character_id === existing.selectedCharacterId,
            )
                ? existing.selectedCharacterId
                : visible[0]?.character_id || "";
            app.storyCharacterShopUi[shop.id] = {
                view,
                selectedCharacterId,
                search: String(existing.search || ""),
                sort: ["default", "name", "price-low", "price-high"].includes(existing.sort)
                    ? existing.sort
                    : "default",
            };
            return app.storyCharacterShopUi[shop.id];
        }

        function storyCharacterShopPurchaseVerb(shop = {}) {
            return textSlot(shop.purchase_verb, "");
        }

        function storyCharacterShopPurchaseCompletedVerb(shop = {}) {
            return textSlot(shop.purchase_completed_verb, "");
        }

        function releaseStoryCharacterShopProfileOverride(name = "") {
            const key = String(name || "");
            if (!key || !app.storyCharacterShopProfileOverrides?.has?.(key)) return false;
            app.storyCharacterShopProfileOverrides.delete(key);
            delete app.profileEntityOverrides?.[key];
            return true;
        }

        function queueStoryCharacterShopProfileImage(shop = {}, item = null) {
            if (
                !item ||
                item.locked ||
                item.removed ||
                storyCharacterShopListingIsAcquired(shop, item)
            )
                return false;
            const entry = resolveFutureCastEntryById(item.character_id);
            if (!entry) return false;
            const name =
                textSlot(entry.name || entry.full_character?.name, "") ||
                humanizeIdentifierLabel(item.character_id);
            if (!name) return false;
            const full = futureCharacterFullCharacter(entry, name, app.state);
            entry.full_character = removeRuntimeClothingFromCharacterDefinition(
                addImmutableDefinitionFields(clone(full), name),
            );
            app.profileImageStoryScopeByEntity ||= new WeakMap();
            app.profileImageStoryScopeByEntity.set(
                entry.full_character,
                String(app.state?.meta?.story_id || "").trim(),
            );
            const profile = activeProfileImage(full);
            if (profile && !profileImageNeedsGeneration(profile)) return false;
            app.profileEntityOverrides ||= {};
            app.storyCharacterShopProfileOverrides ||= new Set();
            app.profileEntityOverrides[name] = entry.full_character;
            app.storyCharacterShopProfileOverrides.add(name);
            const reason = `selected in ${shop.title}`;
            const queued = queueMissingProfileImageAfterDefaultAttempt(name, reason, {
                reason,
                allowImportSkipped: true,
                allowRuntimeProfileGeneration: true,
            });
            if (!queued) releaseStoryCharacterShopProfileOverride(name);
            return queued;
        }

        function queueVisibleStoryCharacterShopProfileImages(shop = {}, items = []) {
            let queued = false;
            for (const item of items || []) {
                if (
                    item?.locked ||
                    item?.removed ||
                    storyCharacterShopListingIsAcquired(shop, item)
                )
                    continue;
                queued = queueStoryCharacterShopProfileImage(shop, item) || queued;
            }
            return queued;
        }

        function characterShopCostTemplate(shop = {}, state = app.state) {
            const id = textSlot(shop.cost_template_id, "");
            return id ? state.character_shop_cost_templates?.[id] || null : null;
        }

        function characterShopStatCostPlan(shop = {}, item = {}, state = app.state) {
            const costTemplate = characterShopCostTemplate(shop, state);
            if (!costTemplate)
                return { template: null, valid: true, costsMet: true, costs: [], effects: [] };
            const entry = resolveFutureCastEntryById(item.character_id, state);
            if (!entry) throw new Error(`Character-shop character not found: ${item.character_id}`);
            const name = textSlot(entry.name || entry.full_character?.name, "") || humanizeIdentifierLabel(item.character_id);
            const full = futureCharacterFullCharacter(entry, name, state);
            const stats = full.stats || {};
            const costs = (costTemplate.costs || []).map((cost, index) => {
                const required = stats[cost.required_stat];
                if (!Number.isFinite(required)) throw new Error(`${name} is missing numeric stats.${cost.required_stat}.`);
                const availableResult = evaluateNumericExpression(state, cost.available_expression, `character_shop_cost_templates.${shop.cost_template_id}.costs.${index}.available_expression`);
                const available = quantizeRational(availableResult.value, 6).value;
                return {
                    label: cost.label,
                    available,
                    required,
                    op: cost.op,
                    met: compareRequirementValues(available, cost.op, required),
                };
            });
            const effects = (costTemplate.effects || []).map((effect) => {
                const value = stats[effect.value_stat];
                if (!Number.isFinite(value)) throw new Error(`${name} is missing numeric stats.${effect.value_stat}.`);
                const path = assertSafeRewardPath(effect.field_path, `character_shop_cost_templates.${shop.cost_template_id}.effects.field_path`);
                const before = existingNumberAtPath(state, path, path.join("."));
                const result = applyRationalOperation(rationalFromNumber(before), rationalFromNumber(value), effect.operation);
                const precision = numericDestinationPrecision(state, { path }, {});
                const after = quantizeRational(result, precision).value;
                return {
                    label: effect.label,
                    before,
                    after,
                    value,
                    operation: effect.operation,
                    path,
                };
            });
            return {
                template: costTemplate,
                valid: true,
                costsMet: costs.every((cost) => cost.met),
                costs,
                effects,
            };
        }

        function storyCharacterShopListingState(shop = {}, item = {}) {
            const entry = resolveFutureCastEntryById(item.character_id);
            const name =
                textSlot(entry?.name || entry?.full_character?.name, "") ||
                humanizeIdentifierLabel(item.character_id);
            const full = entry ? futureCharacterFullCharacter(entry, name, app.state) : null;
            const requirementResults = storyRequirementResults(item.requirements || [], app.state);
            const requirementsMet = requirementResults.every((result) => result.met);
            const inventory = ensureStoryInventory(app.state);
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            const price = Math.max(0, Number(item.price || 0));
            const balance = Math.max(0, Number(inventory[currency] || 0));
            let statCostPlan;
            try {
                statCostPlan = characterShopStatCostPlan(shop, item, app.state);
            } catch (error) {
                statCostPlan = { valid: false, costsMet: false, costs: [], effects: [], error: error.message };
            }
            return {
                shop,
                item,
                entry,
                full,
                name,
                currency,
                price,
                balance,
                purchaseMode: storyCharacterShopPurchaseMode(shop, item),
                repeatable: storyCharacterShopPurchaseIsRepeatable(shop, item),
                acquired: storyCharacterShopListingIsAcquired(shop, item),
                available: storyCharacterShopListingIsAvailable(shop, item),
                authoredLocked: item.locked === true,
                affordable: balance >= price,
                requirementsMet,
                requirementResults,
                statCostPlan,
            };
        }

        function storyCharacterShopStatus(view = {}) {
            if (view.acquired) return { className: "acquired", text: "Acquired" };
            if (!view.available)
                return {
                    className: "acquired",
                    text: view.purchaseMode === "service" ? "Completed" : "Unavailable",
                };
            if (view.authoredLocked) return { className: "locked", text: "Locked" };
            if (!view.requirementsMet) return { className: "locked", text: "Requirements" };
            if (!view.statCostPlan?.valid || !view.statCostPlan?.costsMet)
                return { className: "locked", text: "Requirements" };
            if (!view.affordable) return { className: "unaffordable", text: "Insufficient funds" };
            return { className: "available", text: "Available" };
        }

        function storyCharacterShopProfileHtml(view = {}) {
            if (view.authoredLocked)
                return `<div class="character-shop-lock-placeholder" aria-label="Locked character">&#128274;</div>`;
            const profile = activeProfileImage(view.full);
            if (!profile) return `<div class="profile-image-placeholder" aria-label="No profile image"></div>`;
            return `<div data-profile-live-id="${escapeHtml(String(profile.id || ""))}">${profileImageInnerHtml(profile)}</div>`;
        }

        function storyCharacterShopSpeciesLabel(view = {}) {
            const full = view.full || {};
            return textSlot(
                full.appearance?.species || full.species || view.entry?.species,
                "",
            );
        }

        function storyCharacterShopListingHtml(shop = {}, item = {}, selectedCharacterId = "") {
            const view = storyCharacterShopListingState(shop, item);
            const status = storyCharacterShopStatus(view);
            const role = view.authoredLocked
                ? textSlot(item.unlock_reason, "This character is not available yet.")
                : textSlot(view.full?.role || view.entry?.role, "Available character");
            const speciesLabel = view.authoredLocked
                ? textSlot(item.unlock_reason, "This character is not available yet.")
                : storyCharacterShopSpeciesLabel(view);
            const search = view.authoredLocked
                ? view.name
                : `${view.name} ${speciesLabel} ${role}`;
            return `
                <button class="character-shop-listing ${view.item.character_id === selectedCharacterId ? "selected" : ""}"
                    type="button"
                    data-character-shop-listing
                    data-search="${escapeHtml(search.toLowerCase())}"
                    onclick="EmberAdventures.selectStoryShopCharacter(${htmlJsArg(shop.id)}, ${htmlJsArg(view.item.character_id)})">
                    <div class="character-shop-listing-image">${storyCharacterShopProfileHtml(view)}</div>
                    <div>
                        <div class="character-shop-listing-name" data-library-fit-text>${escapeHtml(view.name)}</div>
                        <div class="character-shop-listing-meta" data-library-fit-text>${escapeHtml(speciesLabel)}</div>
                    </div>
                    <div class="character-shop-status-row">
                        <span class="character-shop-status ${status.className}">${escapeHtml(status.text)}</span>
                        ${view.authoredLocked ? "" : `<strong>${escapeHtml(String(view.price))} ${escapeHtml(view.currency)}</strong>`}
                    </div>
                </button>`;
        }

        function storyCharacterShopRequirementHtml(view = {}) {
            const normal = view.requirementResults
                .map(
                    (result) =>
                        `<li class="${result.met ? "met" : "unmet"}">${result.met ? "&#10003;" : "&#10007;"} ${escapeHtml(result.label)}</li>`,
                )
                .join("");
            const statCosts = (view.statCostPlan?.costs || []).map((cost) =>
                `<li class="${cost.met ? "met" : "unmet"}">${cost.met ? "&#10003;" : "&#10007;"} ${escapeHtml(cost.label)}: ${escapeHtml(String(cost.available))} ${escapeHtml(cost.op)} ${escapeHtml(String(cost.required))}</li>`,
            ).join("");
            const effects = (view.statCostPlan?.effects || []).map((effect) =>
                `<li class="met">${escapeHtml(effect.label)}: ${escapeHtml(String(effect.before))} &rarr; ${escapeHtml(String(effect.after))}</li>`,
            ).join("");
            const error = view.statCostPlan?.error
                ? `<li class="unmet">${escapeHtml(view.statCostPlan.error)}</li>`
                : "";
            return normal || statCosts || effects || error
                ? `<ul class="character-shop-requirements">${normal}${statCosts}${effects}${error}</ul>`
                : "";
        }

        function storyCharacterShopDetailHtml(shop = {}, item = null) {
            if (!item)
                return `<div class="character-shop-empty">No characters are available in this section.</div>`;
            const view = storyCharacterShopListingState(shop, item);
            const status = storyCharacterShopStatus(view);
            const verb = storyCharacterShopPurchaseVerb(shop);
            if (view.authoredLocked) {
                return `
                    <div class="character-shop-detail-heading">
                        <div class="character-shop-detail-image">${storyCharacterShopProfileHtml(view)}</div>
                        <div class="character-shop-detail-summary">
                            <div class="character-shop-detail-name">${escapeHtml(view.name)}</div>
                            <p class="hint">${escapeHtml(item.unlock_reason || "This character is not available yet.")}</p>
                            <span class="character-shop-status locked">Locked</span>
                        </div>
                    </div>`;
            }
            const role = textSlot(view.full?.role || view.entry?.role, "Available character");
            const age = Number(view.full?.age || view.entry?.age || 0);
            const gender = textSlot(view.full?.gender || view.entry?.gender, "");
            const description = displayRuntimeTemplateText(textSlot(
                view.entry?.summary ||
                    view.entry?.note ||
                    view.full?.personality_description,
                "No additional details are available.",
            ));
            const purchaseDisabled = !view.available || !view.affordable || !view.requirementsMet || !view.statCostPlan?.valid || !view.statCostPlan?.costsMet;
            const remaining = Math.max(0, view.balance - view.price);
            return `
                <div class="character-shop-detail-heading">
                    <div class="character-shop-detail-image">${storyCharacterShopProfileHtml(view)}</div>
                    <div class="character-shop-detail-summary">
                        <div class="character-shop-detail-name">${escapeHtml(view.name)}</div>
                        <div class="hint">${escapeHtml([role, age ? `age ${age}` : "", gender].filter(Boolean).join(" / "))}</div>
                        <div class="character-shop-detail-price">${escapeHtml(String(view.price))} ${escapeHtml(view.currency)}</div>
                        <span class="character-shop-status ${status.className}">${escapeHtml(status.text)}</span>
                    </div>
                </div>
                <p class="character-shop-description">${escapeHtml(description)}</p>
                ${storyCharacterShopRequirementHtml(view)}
                ${view.available && !view.affordable ? `<p class="hint">You need ${escapeHtml(String(view.price - view.balance))} more ${escapeHtml(view.currency)}.</p>` : ""}
                ${!purchaseDisabled ? `<p class="hint">Balance after ${escapeHtml(verb.toLowerCase())}: ${escapeHtml(String(remaining))} ${escapeHtml(view.currency)}.</p>` : ""}
                <div class="character-shop-actions">
                    <button class="tool-button" type="button" onclick="EmberAdventures.inspectStoryShopCharacter(${htmlJsArg(shop.id)}, ${htmlJsArg(item.character_id)})"><span class="tool-icon">&#128269;</span><span class="tool-label">View</span></button>
                    <button class="tool-button" type="button" onclick="EmberAdventures.chatWithStoryShopCharacter(${htmlJsArg(shop.id)}, ${htmlJsArg(item.character_id)})"><span class="tool-icon">&#128172;</span><span class="tool-label">Chat</span></button>
                    ${view.available ? `<button class="tool-button primary" type="button" ${purchaseDisabled ? `disabled title="${escapeHtml(!view.affordable ? "Insufficient funds" : "Requirements not met")}"` : ""} onclick="EmberAdventures.buyStoryShopCharacter(${htmlJsArg(shop.id)}, ${htmlJsArg(item.character_id)})"><span class="tool-label">${escapeHtml(verb)}</span></button>` : ""}
                </div>`;
        }

        function storyCharacterShopOwnerStripHtml(shop = {}) {
            return storyShopOwnerCardHtml(shop);
        }

        function storyCharacterShopSortedItems(shop = {}, ui = {}) {
            const items = (shop.items || []).filter((item) =>
                ui.view === "acquired"
                    ? storyCharacterShopListingIsAcquired(shop, item)
                    : storyCharacterShopListingIsAvailable(shop, item),
            );
            if (ui.sort === "default") return items;
            return [...items].sort((a, b) => {
                const left = storyCharacterShopListingState(shop, a);
                const right = storyCharacterShopListingState(shop, b);
                if (ui.sort === "name") return left.name.localeCompare(right.name);
                if (ui.sort === "price-high") return right.price - left.price || left.name.localeCompare(right.name);
                return left.price - right.price || left.name.localeCompare(right.name);
            });
        }

        function openStoryShopModal(shopId = "") {
            const shop = storyShopById(shopId);
            if (!shop) return openStoryShopsModal();
            if (shop.type === "job") return openStoryJobBoardModal(shop.id);
            if (shop.type === "general") return openStoryGeneralShopModal(shop.id);
            if (shop.type === "clothing") return openStoryClothingShopModal(shop.id);
            const inventory = ensureStoryInventory(app.state);
            const ui = storyCharacterShopUiState(shop);
            const items = storyCharacterShopSortedItems(shop, ui);
            const selectedItem = items.find((item) => item.character_id === ui.selectedCharacterId) || null;
            queueVisibleStoryCharacterShopProfileImages(shop, items);
            const cards = items
                .map((item) => storyCharacterShopListingHtml(shop, item, ui.selectedCharacterId))
                .join("") || `<div class="character-shop-empty">${ui.view === "acquired" ? "No characters have been acquired from this shop." : "No available characters right now."}</div>`;
            const acquiredCount = (shop.items || []).filter((item) =>
                storyCharacterShopListingIsAcquired(shop, item),
            ).length;
            const location = storyShopLocationLabel(shop);
            openModal(`
                <div class="character-shop-shell" data-story-shop="${escapeHtml(shop.id)}" data-character-shop="${escapeHtml(shop.id)}">
                    <div class="character-shop-header">
                        <div class="character-shop-heading">
                            <div class="character-shop-title">${escapeHtml(shop.title)}</div>
                            <div class="character-shop-subtitle">${escapeHtml([shop.subtype || "Character Shop", location].filter(Boolean).join(" / "))}</div>
                            ${shop.description ? `<div class="character-shop-subtitle">${escapeHtml(shop.description)}</div>` : ""}
                        </div>
                        <div class="character-shop-header-actions row">
                            <div class="character-shop-balance">${escapeHtml(String(inventory[exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`)] || 0))} ${escapeHtml(exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`))}</div>
                            <button class="icon-button" type="button" title="Back to shops" onclick="EmberAdventures.openStoryShopsModal()">&#8592;</button>
                            <button class="icon-button" type="button" title="Close" onclick="EmberAdventures.closeModal()">&times;</button>
                        </div>
                    </div>
                    ${storyCharacterShopOwnerStripHtml(shop)}
                    <div class="character-shop-content">
                        <section class="character-shop-stock" aria-label="Characters for sale">
                            <div class="character-shop-toolbar">
                                <div class="character-shop-view-tabs">
                                    <button type="button" class="${ui.view === "available" ? "active" : ""}" onclick="EmberAdventures.setStoryCharacterShopView(${htmlJsArg(shop.id)}, 'available')">Available</button>
                                    <button type="button" class="${ui.view === "acquired" ? "active" : ""}" ${acquiredCount ? "" : "disabled"} onclick="EmberAdventures.setStoryCharacterShopView(${htmlJsArg(shop.id)}, 'acquired')">Acquired (${acquiredCount})</button>
                                </div>
                                <input type="search" value="${escapeHtml(ui.search)}" placeholder="Search characters..." aria-label="Search shop characters" oninput="EmberAdventures.filterStoryCharacterShopListings(${htmlJsArg(shop.id)}, this.value)">
                                <select aria-label="Sort shop characters" onchange="EmberAdventures.setStoryCharacterShopSort(${htmlJsArg(shop.id)}, this.value)">
                                    <option value="default" ${ui.sort === "default" ? "selected" : ""}>Shop order</option>
                                    <option value="name" ${ui.sort === "name" ? "selected" : ""}>Name</option>
                                    <option value="price-low" ${ui.sort === "price-low" ? "selected" : ""}>Price: low to high</option>
                                    <option value="price-high" ${ui.sort === "price-high" ? "selected" : ""}>Price: high to low</option>
                                </select>
                            </div>
                            <div class="character-shop-grid">${cards}</div>
                        </section>
                        <aside class="character-shop-detail" aria-label="Selected character details">
                            ${storyCharacterShopDetailHtml(shop, selectedItem)}
                        </aside>
                    </div>
                </div>
            `, { hideClose: true, scrollKey: `character-shop:${shop.id}` });
            $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
            $("modalBox")?.setAttribute("data-character-shop-modal", "1");
            filterStoryCharacterShopListings(shop.id, ui.search);
            scheduleAutosizeLibraryCardText($("modalBox"));
            return true;
        }

        function storyGeneralShopSalePrice(shop = {}, listing = {}) {
            const value = Math.max(0, Number(listing.item?.value || 0));
            const markup = Math.max(1, Number(shop.markup || 1));
            return Math.ceil(value * markup);
        }

        function storyGeneralShopItemCardHtml(shop = {}, listing = {}) {
            const inventory = ensureStoryInventory(app.state);
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            const price = storyGeneralShopSalePrice(shop, listing);
            const stock = listing.quantity == null ? null : Math.max(0, Number(listing.quantity || 0));
            const requirements = [
                ...(listing.requirements || []),
                { path: `story_inventory.${currency}`, op: ">=", value: price },
            ];
            const requirementResults = storyRequirementResults(requirements, app.state);
            const unavailable =
                listing.locked === true ||
                stock === 0 ||
                requirementResults.some((result) => !result.met);
            const stockText = stock == null ? "In stock" : `Stock: ${stock}`;
            const statusText = stock === 0
                ? "Out of stock"
                : unavailable
                  ? "Unavailable"
                  : "Available";
            const statusClass = unavailable ? "locked" : "available";
            return `
                <div class="story-shop-product-card">
                    <div class="story-shop-summary-row">
                        <div class="story-shop-product-image" data-story-item-image="${escapeHtml(String(listing.item?.id || listing.id || ""))}">${storyInventoryItemImageHtml(listing.item || {})}</div>
                        <div>
                            <div class="story-shop-card-title">${escapeHtml(listing.title || listing.item?.name || "Item")}</div>
                            <div class="story-shop-card-price">${escapeHtml(String(price))} ${escapeHtml(currency)}</div>
                            <div class="story-shop-card-meta">Value ${escapeHtml(String(listing.item?.value || 0))} / ${escapeHtml(stockText)}</div>
                        </div>
                    </div>
                <p class="story-shop-card-description">${escapeRuntimeTemplateText(listing.summary || listing.item?.description || "")}</p>
                    ${listing.unlock_reason && unavailable ? `<p class="story-shop-card-meta">${escapeHtml(listing.unlock_reason)}</p>` : ""}
                    <div class="story-shop-card-actions">
                        <span class="character-shop-status ${statusClass}">${escapeHtml(statusText)}</span>
                        <button class="tool-button primary" type="button" ${unavailable ? "disabled" : ""} onclick="EmberAdventures.buyStoryGeneralShopItem(${htmlJsArg(shop.id)}, ${htmlJsArg(listing.id)})"><span class="tool-label">Buy</span></button>
                    </div>
                </div>`;
        }

        function storyGeneralShopSellCardHtml(shop = {}, item = {}) {
            const canSell = item.sellable !== false && item.quest_item !== true && Number(item.value || 0) > 0;
            return `
                <div class="story-shop-product-card">
                    <div class="story-shop-summary-row">
                        <div class="story-shop-product-image" data-story-item-image="${escapeHtml(String(item.id || ""))}">${storyInventoryItemImageHtml(item)}</div>
                        <div>
                            <div class="story-shop-card-title">${escapeHtml(item.name)}</div>
                            <div class="story-shop-card-price">${escapeHtml(String(item.value || 0))} ${escapeHtml(exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`))} each</div>
                            <div class="story-shop-card-meta">Quantity ${escapeHtml(String(item.quantity || 1))}${item.quest_item ? " / Quest item" : ""}</div>
                        </div>
                    </div>
                    <p class="story-shop-card-description">${escapeHtml(item.description || "")}</p>
                    <div class="story-shop-card-actions">
                        <span class="character-shop-status ${canSell ? "available" : "locked"}">${canSell ? "Sellable" : "Cannot sell"}</span>
                        <button class="tool-button primary" type="button" ${canSell ? "" : "disabled"} onclick="EmberAdventures.sellStoryInventoryItem(${htmlJsArg(shop.id)}, ${htmlJsArg(item.id)}, false)"><span class="tool-label">Sell One</span></button>
                        <button class="tool-button" type="button" ${canSell ? "" : "disabled"} onclick="EmberAdventures.sellStoryInventoryItem(${htmlJsArg(shop.id)}, ${htmlJsArg(item.id)}, true)"><span class="tool-label">Sell Stack</span></button>
                    </div>
                </div>`;
        }

        function openStoryGeneralShopModal(shopId = "", tab = "buy") {
            const shop = storyShopById(shopId);
            if (!shop || shop.type !== "general") return openStoryShopsModal();
            const inventory = ensureStoryInventory(app.state);
            const activeTab = tab === "sell" ? "sell" : "buy";
            const canBuy = activeTab === "buy";
            if (canBuy) queueMissingStoryShopItemImages(shop);
            else if (shop.buying?.enabled) queueMissingStoryInventoryItemImages(inventory);
            const cards = canBuy
                ? (shop.items || []).map((item) => storyGeneralShopItemCardHtml(shop, item)).join("") ||
                  `<div class="character-shop-empty">No items are available.</div>`
                : shop.buying?.enabled
                  ? inventory.items.map((item) => storyGeneralShopSellCardHtml(shop, item)).join("") ||
                    `<div class="character-shop-empty">You have nothing to sell.</div>`
                  : `<div class="character-shop-empty">This shop does not buy items.</div>`;
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            openStoryShopFullscreen(`
                <div class="character-shop-shell" data-story-shop="${escapeHtml(shop.id)}">
                    ${storyShopHeaderHtml(shop, `${inventory[currency] || 0} ${currency}`)}
                    ${storyShopOwnerCardHtml(shop)}
                    <div class="character-shop-toolbar">
                        <div class="character-shop-view-tabs">
                            <button type="button" class="${canBuy ? "active" : ""}" onclick="EmberAdventures.openStoryGeneralShopModal(${htmlJsArg(shop.id)}, 'buy')">Buy</button>
                            <button type="button" class="${!canBuy ? "active" : ""}" ${shop.buying?.enabled ? "" : "disabled"} onclick="EmberAdventures.openStoryGeneralShopModal(${htmlJsArg(shop.id)}, 'sell')">Sell</button>
                        </div>
                        <span class="story-shop-toolbar-note">Markup ${escapeHtml(String(shop.markup))}x</span>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openStoryInventoryModal()"><span class="tool-icon">&#127991;</span><span class="tool-label">Inventory</span></button>
                        ${!canBuy && shop.buying?.enabled ? `<button class="tool-button" type="button" onclick="EmberAdventures.sellAllStoryLoot(${htmlJsArg(shop.id)})"><span class="tool-label">Sell All Loot</span></button>` : ""}
                    </div>
                    <div class="story-shop-catalog">${cards}</div>
                </div>
            `, `general-shop:${shop.id}:${activeTab}`);
            return true;
        }

        function buyStoryGeneralShopItem(shopId = "", listingId = "") {
            const shop = storyShopById(shopId);
            const listing = shop?.items?.find((item) => String(item.id) === String(listingId));
            if (!shop || shop.type !== "general" || !listing || listing.locked)
                return showNotice("Purchase Unavailable", "That item cannot be bought right now.");
            if (listing.quantity != null && Number(listing.quantity) <= 0)
                return showNotice("Out of Stock", "That item is out of stock.");
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            const price = storyGeneralShopSalePrice(shop, listing);
            const requirements = [
                ...(listing.requirements || []),
                { path: `story_inventory.${currency}`, op: ">=", value: price },
            ];
            if (!requirementsMet(requirements, app.state))
                return showNotice("Requirements Not Met", "You do not meet the requirements for that purchase.");
            const purchaseSequence = Math.max(0, Number(listing.purchase_count || 0) || 0) + 1;
            const rewardObjective = {
                id: `shop-purchase:${shop.id}:${listing.id}`,
                title: `Purchase ${listing.title || listing.item.name}`,
            };
            const rewardEntries = objectiveRewardEntriesForList(
                listing.rewards,
                app.state,
                "",
                rewardObjective.id,
            );
            const groups = rewardApplicationGroupsForEntries({
                state: app.state,
                objective: rewardObjective,
                entries: rewardEntries,
                sourceType: "shop",
                sourceId: shop.id,
                siteId: `listing-${listing.id}--purchase-${purchaseSequence}`,
            });
            const applyPurchaseEffects = (state) => {
                const targetShop = state.story_shops?.[shop.id];
                const targetListing = targetShop?.items?.find(
                    (item) => String(item.id) === String(listing.id),
                );
                if (!targetListing)
                    throw new Error(`Shop listing disappeared during purchase: ${shop.id}/${listing.id}`);
                if (
                    targetListing.quantity != null &&
                    Number(targetListing.quantity || 0) <= 0
                )
                    throw new Error(`Shop listing is out of stock: ${shop.id}/${listing.id}`);
                adjustStoryInventoryItemValue(state, currency, -price);
                addStoryInventoryItem(state, {
                    ...runtimeSaveCloneValue(targetListing.item || listing.item),
                    quantity: 1,
                });
                if (targetListing.quantity != null)
                    targetListing.quantity = Math.max(
                        0,
                        Number(targetListing.quantity || 0) - 1,
                    );
                targetListing.purchase_count = purchaseSequence;
                state.recent_changes = [
                    `Bought ${targetListing.item?.name || listing.item.name} from ${targetShop?.title || shop.title} for ${price} ${currency}.`,
                    ...(state.recent_changes || []),
                ].slice(0, 8);
            };
            applyRewardApplicationGroupsAtomically(
                app.state,
                groups,
                "shop_purchase",
                {
                    extraRoots: ["story_inventory", "story_shops", "recent_changes"],
                    prepareDraft: applyPurchaseEffects,
                    applyBaseEffects: applyPurchaseEffects,
                    baseEffectsCountAsApplied: true,
                },
            );
            scheduleActiveGameSave();
            render();
            openStoryGeneralShopModal(shop.id, "buy");
            return true;
        }

        function storyShopOutfitRecipientOptions(selectedName = "Player") {
            return ["Player", ...Object.keys(app.state.characters || {})]
                .map((name) => `<option value="${escapeHtml(name)}" ${name === selectedName ? "selected" : ""}>${escapeHtml(name)}</option>`)
                .join("");
        }

        function characterOwnsStoryShopOutfit(entity = {}, shopId = "", outfitId = "") {
            return exactEntityOutfits(entity).some(
                (outfit) =>
                    outfit.source_shop_id === shopId &&
                    outfit.source_outfit_id === outfitId,
            );
        }

        function storyClothingShopItemCardHtml(shop = {}, listing = {}) {
            const selectId = `outfit-recipient-${objectiveIdFromTitle(shop.id, "shop")}-${objectiveIdFromTitle(listing.id, "outfit")}`;
            const clothing = Object.entries(listing.outfit?.clothing || {})
                .map(([slot, value]) => `${slot.replaceAll("_", " ")}: ${clothingItemText(value)}`)
                .join(" / ");
            const results = storyRequirementResults(listing.requirements || [], app.state);
            const locked = listing.locked === true || results.some((result) => !result.met);
            return `
                <div class="story-shop-product-card">
                    <div class="story-shop-summary-row">
                        <div class="story-shop-product-image" data-story-outfit-image="${escapeHtml(String(listing.outfit?.id || listing.id || ""))}">${storyShopOutfitImageHtml(listing.outfit || {})}</div>
                        <div>
                            <div class="story-shop-card-title">${escapeHtml(listing.title || listing.outfit?.name || "Outfit")}</div>
                            <div class="story-shop-card-price">${escapeHtml(String(listing.price || 0))} ${escapeHtml(exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`))}</div>
                            <span class="character-shop-status ${locked ? "locked" : "available"}">${locked ? "Locked" : "Available"}</span>
                        </div>
                    </div>
                    <p class="story-shop-card-description">${escapeRuntimeTemplateText(listing.summary || clothing)}</p>
                    <div class="story-shop-recipient">
                        <label for="${escapeHtml(selectId)}">Recipient</label>
                        <select id="${escapeHtml(selectId)}">${storyShopOutfitRecipientOptions()}</select>
                    </div>
                    ${listing.unlock_reason && locked ? `<p class="story-shop-card-meta">${escapeHtml(listing.unlock_reason)}</p>` : ""}
                    <div class="story-shop-card-actions">
                        <button class="tool-button primary" type="button" ${locked ? "disabled" : ""} onclick="EmberAdventures.buyStoryClothingShopOutfit(${htmlJsArg(shop.id)}, ${htmlJsArg(listing.id)}, document.getElementById(${htmlJsArg(selectId)})?.value || 'Player')"><span class="tool-label">Buy Outfit</span></button>
                    </div>
                </div>`;
        }

        function openStoryClothingShopModal(shopId = "") {
            const shop = storyShopById(shopId);
            if (!shop || shop.type !== "clothing") return openStoryShopsModal();
            const inventory = ensureStoryInventory(app.state);
            queueMissingStoryClothingShopOutfitImages(shop);
            const cards = (shop.items || [])
                .filter((item) => true)
                .map((item) => storyClothingShopItemCardHtml(shop, item))
                .join("") || `<div class="character-shop-empty">No outfits are available.</div>`;
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            openStoryShopFullscreen(`
                <div class="character-shop-shell" data-story-shop="${escapeHtml(shop.id)}">
                    ${storyShopHeaderHtml(shop, `${inventory[currency] || 0} ${currency}`)}
                    ${storyShopOwnerCardHtml(shop)}
                    <div class="character-shop-toolbar">
                        <span class="story-shop-toolbar-note">Choose who receives each purchased outfit.</span>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openStoryInventoryModal()"><span class="tool-icon">&#127991;</span><span class="tool-label">Inventory</span></button>
                    </div>
                    <div class="story-shop-catalog">${cards}</div>
                </div>
            `, `clothing-shop:${shop.id}`);
            return true;
        }

        async function buyStoryClothingShopOutfit(shopId = "", listingId = "", recipientName = "Player") {
            const shop = storyShopById(shopId);
            const listing = shop?.items?.find((item) => String(item.id) === String(listingId));
            const entity = recipientName === "Player"
                ? app.state.player
                : app.state.characters?.[recipientName];
            if (!shop || shop.type !== "clothing" || !listing || !entity || listing.locked)
                return showNotice("Purchase Unavailable", "That outfit or recipient is not available.");
            {}
            if (characterOwnsStoryShopOutfit(entity, shop.id, listing.id))
                return showNotice("Already Owned", `${recipientName} already owns that outfit.`);
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            const price = Math.max(1, Math.floor(Number(listing.price || 0) || 0));
            const requirements = [
                ...(listing.requirements || []),
                { path: `story_inventory.${currency}`, op: ">=", value: price },
            ];
            if (!requirementsMet(requirements, app.state))
                return showNotice("Requirements Not Met", "You do not meet the requirements for that purchase.");
            const purchasedOutfit = exactOutfitRecord({
                ...clone(listing.outfit),
                origin: `Purchased from ${shop.title}`,
                source_shop_id: shop.id,
                source_outfit_id: listing.id,
            });
            if (!purchasedOutfit)
                return showNotice("Invalid Outfit", "That outfit definition is incomplete.");
            const balance = Math.max(0, Number(ensureStoryInventory(app.state)[currency] || 0));
            const confirmed = await showConfirm(
                `Buy ${purchasedOutfit.name}?`,
                `Buy ${purchasedOutfit.name} for ${recipientName} for ${price} ${currency}? Your remaining balance will be ${Math.max(0, balance - price)} ${currency}.`,
                { confirmText: "Buy Outfit", cancelText: "Cancel" },
            );
            if (!confirmed) return false;

            const existingIds = new Set(exactEntityOutfits(entity).map((outfit) => outfit.id));
            if (existingIds.has(purchasedOutfit.id))
                purchasedOutfit.id = `${purchasedOutfit.id}-${objectiveIdFromTitle(shop.id, "shop")}`;
            entity.outfits.push(purchasedOutfit);
            exactEntityOutfits(entity);
            adjustStoryInventoryItemValue(app.state, currency, -price);
            app.state.recent_changes = [
                `${recipientName} received ${purchasedOutfit.name} from ${shop.title}.`,
                ...(app.state.recent_changes || []),
            ].slice(0, 8);
            scheduleActiveGameSave();
            render();
            openStoryClothingShopModal(shop.id);
            return true;
        }

        function selectStoryShopCharacter(shopId = "", characterId = "") {
            const shop = storyShopById(shopId);
            if (!shop?.items?.some((item) => item.character_id === characterId)) return false;
            const ui = storyCharacterShopUiState(shop);
            ui.selectedCharacterId = characterId;
            openStoryShopModal(shop.id);
            return true;
        }

        function setStoryCharacterShopView(shopId = "", view = "available") {
            const shop = storyShopById(shopId);
            if (!shop) return false;
            const ui = storyCharacterShopUiState(shop);
            ui.view = view === "acquired" ? "acquired" : "available";
            ui.selectedCharacterId = "";
            openStoryShopModal(shop.id);
            return true;
        }

        function setStoryCharacterShopSort(shopId = "", sort = "default") {
            const shop = storyShopById(shopId);
            if (!shop) return false;
            const ui = storyCharacterShopUiState(shop);
            ui.sort = ["default", "name", "price-low", "price-high"].includes(sort)
                ? sort
                : "default";
            openStoryShopModal(shop.id);
            return true;
        }

        function filterStoryCharacterShopListings(shopId = "", value = "") {
            const ui = app.storyCharacterShopUi?.[shopId];
            if (!ui) return false;
            ui.search = String(value || "").trim().toLowerCase();
            const root = $("modalBox")?.querySelector?.(`[data-character-shop="${cssEscape(shopId)}"]`);
            root?.querySelectorAll?.("[data-character-shop-listing]").forEach((card) => {
                card.hidden = !!ui.search && !String(card.dataset.search || "").includes(ui.search);
            });
            return true;
        }

        function inspectStoryShopCharacter(shopId = "", characterId = "") {
            const shop = storyShopById(shopId);
            const item = shop?.items?.find((candidate) => candidate.character_id === characterId);
            if (!shop || !item || item.locked) return false;
            const view = storyCharacterShopListingState(shop, item);
            const details = [
                ["Personality", view.full?.personality_description],
                ["Speech", view.full?.speech_style],
                ["Relationship", view.full?.relationship_to_player],
                ["Background", view.full?.background],
            ].filter(([, value]) => String(value || "").trim());
            const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(view.name)}</strong>
                    <button type="button" class="modal-close" title="Close">&times;</button>
                </div>
                <div class="character-shop-detail-heading">
                    <div class="character-shop-detail-image">${storyCharacterShopProfileHtml(view)}</div>
                    <div class="character-shop-detail-summary">
                        <div class="character-shop-detail-name">${escapeHtml(view.name)}</div>
                        <div class="hint">${escapeHtml([view.full?.role, view.full?.age ? `age ${view.full.age}` : "", view.full?.gender].filter(Boolean).join(" / "))}</div>
                    </div>
                </div>
                ${details.map(([label, value]) => `<section><h3>${escapeHtml(label)}</h3><p>${escapeHtml(value)}</p></section>`).join("") || `<p class="hint">No additional details are available.</p>`}
                <div class="row" style="margin-top:.9rem">
                    <button type="button" class="tool-button" data-character-shop-inspect-close>Close</button>
                    <button class="tool-button" type="button" data-character-shop-inspect-chat>Chat</button>
                </div>
            `);
            popup.box.querySelector(".modal-close").onclick = popup.close;
            popup.box.querySelector("[data-character-shop-inspect-close]").onclick = popup.close;
            popup.box.querySelector("[data-character-shop-inspect-chat]").onclick = () => {
                popup.close();
                chatWithStoryShopCharacter(shopId, characterId);
            };
            return true;
        }

        function chatWithStoryShopOwner(shopId = "") {
            const shop = storyShopById(shopId);
            if (!shop) return false;
            const locationId = storyShopNpcLocationId(shop);
            const owner = ensureStoryShopOwnerNpc(shop, locationId, {
                reason: "story shop owner chat",
                note: `${shop.title} owner.`,
                location_label: storyShopLocationLabel(shop),
            });
            if (!owner?.name) return false;
            setStoryShopChatScenePresence([owner.name], "", shop);
            return openStoryShopChatPopup(shop, owner.name, { presentNames: [owner.name] });
        }

        function setStoryShopChatScenePresence(npcNames = [], partyName = "", shop = {}) {
            const before = {
                party: [...(app.state.scene?.party_members_present || [])],
                npcs: [...(app.state.scene?.npcs_present || [])],
            };
            const exactNpcNames = [...new Set((npcNames || []).filter(Boolean))]
                .filter((name) => name !== partyName);
            updateSceneRuntime((scene) => {
                replaceSceneNpcPresence(
                    app.state,
                    exactNpcNames,
                    "story shop chat opened",
                );
                if (partyName)
                    scene.party_members_present = [
                        ...new Set([...(scene.party_members_present || []), partyName]),
                    ];
            });
            stateTrace("story shop chat scene established", {
                label: shop.title || shop.id || "story shop",
                shopId: shop.id || "",
                before,
                after: {
                    party: [...(app.state.scene?.party_members_present || [])],
                    npcs: [...(app.state.scene?.npcs_present || [])],
                },
                summary: `Established exact scene membership for ${shop.title || "shop conversation"}.`,
            });
        }

        function chatWithStoryShopCharacter(shopId = "", characterId = "") {
            const shop = storyShopById(shopId);
            if (!shop) return false;
            const item = shop.items?.find((candidate) => candidate.character_id === characterId);
            const locationId = storyShopNpcLocationId(shop);
            const owner = shop.owner_npc_id
                ? ensureStoryShopOwnerNpc(shop, locationId, {
                      reason: "story shop owner chat",
                      note: `${shop.title} owner.`,
                      location_label: storyShopLocationLabel(shop),
                  })
                : null;
            const acquiredName = storyCharacterShopListingIsAcquired(shop, item)
                ? textSlot(resolveFutureCastEntryById(characterId)?.name, "") ||
                  humanizeIdentifierLabel(characterId)
                : "";
            const guest = acquiredName && app.state.characters?.[acquiredName]
                ? { name: acquiredName }
                : ensureFutureCastNpcInDirectory(characterId, locationId, {
                      reason: "story shop character chat",
                      note: `Available at ${shop.title}; cannot join unless purchased through the shop UI.`,
                      location_label: storyShopLocationLabel(shop),
                  });
            setStoryShopChatScenePresence(
                [owner?.name, guest?.name].filter(Boolean),
                acquiredName,
                shop,
            );
            const targetName = guest?.name || owner?.name || "";
            app.storyShopReturnId = shop.id;
            app.state.recent_changes = [
                `Started shop conversation at ${shop.title}.`,
                ...(app.state.recent_changes || []),
            ].slice(0, 8);
            scheduleActiveGameSave();
            render();
            if (!targetName) return false;
            return openStoryShopChatPopup(shop, targetName, {
                presentNames: [owner?.name, guest?.name].filter(Boolean),
            });
        }

        function storyShopChatMessages(session = app.storyShopChatSession || {}) {
            const startEntryId = Number(session.startEntryId || 0);
            return visibleMessagesForRender().filter(
                (message) => Number(message.entryId || message.id || 0) > startEntryId,
            );
        }

        function storyShopChatImages(session = app.storyShopChatSession || {}, messages = []) {
            const startedAt = Number(session.startedAt || 0);
            const messageIds = new Set(messages.map((message) => String(message.id || "")));
            return visibleImagesForRender().filter((image) => {
                const anchor = String(image.requestedAfterMessageId || "");
                if (anchor && messageIds.has(anchor)) return true;
                return (Date.parse(image.requestedAt || image.at || "") || 0) >= startedAt;
            });
        }

        function renderStoryShopChatView() {
            const session = app.storyShopChatSession;
            const thread = $("modalBox")?.querySelector?.("[data-story-shop-chat-thread]");
            if (!session || !thread) return false;
            const messages = storyShopChatMessages(session);
            renderThread("story shop chat", {
                element: thread,
                messages,
                images: storyShopChatImages(session, messages),
                renderLimit: Number.MAX_SAFE_INTEGER,
                showWindowNotice: false,
                scrollToBottomOnce: true,
            });
            const guidance = $("modalBox")?.querySelector?.("[data-story-shop-chat-guidance]");
            const quickActions = $("modalBox")?.querySelector?.("[data-story-shop-chat-quick-actions]");
            if (guidance) guidance.innerHTML = $("composerGuidance")?.innerHTML || "";
            if (quickActions) quickActions.innerHTML = $("quickActions")?.innerHTML || "";
            activatePluginIframes($("modalBox"));
            return true;
        }

        function openStoryShopChatPopup(shop = {}, targetName = "", options = {}) {
            if (!targetName) return false;
            app.storyShopChatSession = {
                shopId: shop.id || "",
                shopTitle: shop.title || "",
                targetName,
                presentNames: [...new Set((options.presentNames || []).filter(Boolean))],
                startEntryId: Math.max(
                    0,
                    ...(app.messages || []).map((message) => Number(message.entryId || message.id || 0)),
                ),
                startedAt: Date.now(),
            };
            scheduleActiveGameSave();
            openStoryShopFullscreen(`
                <div class="story-shop-chat-shell">
                    ${storyShopHeaderHtml({
                        title: targetName,
                        subtype: shop.title || "Shop conversation",
                    }, "", {
                        backAction: "EmberAdventures.closeStoryShopChat()",
                        backTitle: "Return to shop",
                        includeLocation: false,
                    })}
                    <section class="thread story-shop-chat-thread" data-story-shop-chat-thread></section>
                    <section class="composer story-shop-chat-composer">
                        <div class="composer-guidance" data-story-shop-chat-guidance></div>
                        <div class="quick-action-controls" data-story-shop-chat-quick-actions></div>
                        <div class="composer-input-row">
                            <textarea data-story-shop-chat-input placeholder="Describe what you do or say..." onkeydown="if(event.key === 'Enter' && !event.shiftKey){event.preventDefault(); EmberAdventures.submitStoryShopChatMessage();}"></textarea>
                            <div class="composer-actions">
                                <button class="tool-button primary" type="button" onclick="EmberAdventures.submitStoryShopChatMessage()"><span class="tool-icon">&#10148;</span><span class="tool-label">Send</span></button>
                                <button class="tool-button info" type="button" onclick="EmberAdventures.requestStoryShopChatImage()"><span class="tool-icon">&#128247;</span><span class="tool-label">Image</span></button>
                            </div>
                        </div>
                    </section>
                </div>
            `, `story-shop-chat:${shop.id || "shop"}`);
            $("modalBox")?.setAttribute("data-story-shop-chat-modal", "1");
            app.modalCloseCallback = () => {
                app.storyShopChatSession = null;
            };
            renderStoryShopChatView();
            return true;
        }

        function closeStoryShopChat() {
            const shopId = String(app.storyShopChatSession?.shopId || app.storyShopReturnId || "");
            app.storyShopChatSession = null;
            app.modalCloseCallback = null;
            if (shopId && storyShopById(shopId)) return openStoryShopModal(shopId);
            closeModal();
            return true;
        }

        async function submitStoryShopChatMessage() {
            const session = app.storyShopChatSession || {};
            const input = $("modalBox")?.querySelector?.("[data-story-shop-chat-input]");
            const text = String(input?.value || "").trim();
            if (!text) return false;
            if (input) input.value = "";
            await submitUserText(text);
            renderStoryShopChatView();
            return true;
        }

        function requestStoryShopChatImage() {
            const session = app.storyShopChatSession || {};
            const targetName = resolveEntityName(
                session.targetName,
                app.state,
                String(session.targetName || "").trim(),
            );
            if (!targetName) return false;
            app.state.scene ||= {};
            app.state.scene.image_characters = [targetName];
            requestImage();
            return true;
        }

        function storyShopPurchaseExpectedOwners(
            shopId = "",
            characterName = "",
            statCostPlan = {},
            options = {},
        ) {
            const owners = [
                { kind: "inventory", recordId: "current" },
                { kind: "shop", recordId: shopId },
                { kind: "state-root", recordId: "recent_changes" },
            ];
            if (characterName) {
                owners.push({ kind: "character", recordId: characterName });
                owners.push({ kind: "future-cast-runtime", recordId: "current" });
                owners.push({ kind: "scene", recordId: "current" });
                if (!options.acquire)
                    owners.push({ kind: "npc-directory", recordId: "current" });
            }
            if (options.startsObjective)
                owners.push({ kind: "objective-runtime", recordId: "current" });
            for (const effect of statCostPlan.effects || [])
                owners.push(...stateRecordOwnersForPath(effect.path || []));
            return [...new Map(
                owners
                    .filter((owner) => owner.kind !== "*")
                    .map((owner) => [mutationOwnerKey(owner), owner]),
            ).values()];
        }

        function applyValidatedStoryShopPurchase({
            shopId = "",
            characterId = "",
            characterName = "",
            currency = "",
            purchaseMode = "acquire",
            statCostPlan = {},
        } = {}) {
            const liveShop = storyShopById(shopId);
            const liveItem = liveShop?.items?.find(
                (candidate) => candidate.character_id === characterId,
            );
            const liveEntry = resolveFutureCastEntryById(characterId);
            if (!liveShop || !liveItem || !liveEntry)
                throw new Error("The validated character purchase no longer exists.");
            const acquire = purchaseMode === "acquire";
            const expectedOwners = storyShopPurchaseExpectedOwners(
                shopId,
                characterName,
                statCostPlan,
                {
                    acquire,
                    startsObjective: !!characterStoryObjectiveId(liveItem),
                },
            );
            return runDomainMutation(
                "buyStoryShopCharacter",
                expectedOwners,
                () => {
                    for (const effect of statCostPlan.effects || [])
                        setPathValue(app.state, effect.path, effect.after);
                    adjustStoryInventoryItemValue(app.state, currency, -liveItem.price);
                    liveItem.purchase_count =
                        Math.max(0, Number(liveItem.purchase_count || 0) || 0) + 1;
                    if (acquire) {
                        liveItem.purchased = true;
                        if (!isPlainObject(app.state.characters))
                            throw new Error("The active game has no valid character runtime.");
                        if (!app.state.characters[characterName])
                            app.state.characters[characterName] = futureCharacterFullCharacter(
                                liveEntry,
                                characterName,
                                app.state,
                            );
                        if (!isPlainObject(app.state.scene))
                            throw new Error("The active game has no valid scene runtime.");
                        if (liveShop.post_purchase_presence !== "roster")
                            app.state.scene.party_members_present = [
                                ...new Set([
                                    ...(app.state.scene.party_members_present || []),
                                    characterName,
                                ]),
                            ];
                        liveEntry.status = "joined";
                    } else {
                        if (!storyCharacterShopPurchaseIsRepeatable(liveShop, liveItem))
                            liveItem.purchased = true;
                        ensureFutureCastNpcInDirectory(
                            characterId,
                            storyShopNpcLocationId(liveShop),
                            {
                                reason: "story shop service purchase",
                                note: `Available through ${liveShop.title}.`,
                                location_label: storyShopLocationLabel(liveShop),
                                shopLocked: false,
                            },
                        );
                        if (!isPlainObject(app.state.scene))
                            throw new Error("The active game has no valid scene runtime.");
                        replaceSceneNpcPresence(
                            app.state,
                            [characterName],
                            "story shop service purchased",
                        );
                    }
                    startCharacterStoryObjectiveIfPresent(app.state, liveItem, {
                        sourceId: liveShop.id,
                        sourceTitle: liveShop.title,
                    });
                    app.state.recent_changes = [
                        purchaseMode === "service"
                            ? `${storyCharacterShopPurchaseCompletedVerb(liveShop)} ${characterName} at ${liveShop.title} for ${liveItem.price} ${currency}.`
                            : `${characterName} was ${storyCharacterShopPurchaseCompletedVerb(liveShop)} from ${liveShop.title}.`,
                        ...(app.state.recent_changes || []),
                    ].slice(0, 8);
                },
                { shopId, characterId, characterName, purchaseMode },
            );
        }

        async function queueStoryShopPurchaseOpening(
            shop = {},
            item = {},
            characterName = "",
            currency = "",
            purchaseMode = "",
        ) {
            const effectivePurchaseMode =
                ["acquire", "service"].includes(purchaseMode)
                    ? purchaseMode
                    : storyCharacterShopPurchaseMode(shop, item);
            if (effectivePurchaseMode !== "service")
                return false;
            const opening = item.purchase_opening;
            const dialogue = displayRuntimeTemplateText(textSlot(opening?.dialogue, ""));
            if (!dialogue) return false;
            const guidance = displayRuntimeTemplateText(textSlot(opening?.guidance, ""));
            const price = Number(item.price || 0);
            const facts = [
                `A service booking just happened at ${shop.title} for ${price} ${currency}.`,
                `Use this authored purchase greeting as ${characterName}'s opening line in the reply: ${dialogue}`,
                guidance ? `Apply this authored purchase guidance: ${guidance}` : "",
                `Have ${characterName} begin the booked service naturally and direct the player into the next moment of the scene.`,
            ].filter(Boolean);
            await enqueueSceneDirective({
                text: "Continue booked service",
                skipUserStateCheck: true,
                source: "shop_purchase_opening",
                directive: facts.join("\n\n"),
            });
            return true;
        }

        async function buyStoryShopCharacter(shopId = "", characterId = "") {
            const shop = storyShopById(shopId);
            const item = shop?.items?.find((entry) => entry.character_id === characterId);
            if (
                !shop ||
                !item ||
                item.locked ||
                !storyCharacterShopListingIsAvailable(shop, item)
            )
                return showNotice("Purchase Unavailable", "That character cannot be bought right now.");
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            const requirements = [
                ...(item.requirements || []),
                ...(item.price > 0 ? [{ path: `story_inventory.${currency}`, op: ">=", value: item.price }] : []),
            ];
            if (!requirementsMet(requirements, app.state))
                return showNotice("Requirements Not Met", "You do not meet the requirements for that purchase.");
            let statCostPlan;
            try {
                statCostPlan = characterShopStatCostPlan(shop, item, app.state);
            } catch (error) {
                return showNotice("Purchase Configuration Error", error.message);
            }
            if (!statCostPlan.costsMet)
                return showNotice("Requirements Not Met", "You do not meet the character stat costs for that purchase.");
            const entry = resolveFutureCastEntryById(characterId);
            if (!entry) return showNotice("Missing Character", "The shop character definition is missing.");
            const name =
                textSlot(entry.name || entry.full_character?.name, "") ||
                humanizeIdentifierLabel(characterId);
            const verb = storyCharacterShopPurchaseVerb(shop);
            const balance = Math.max(0, Number(ensureStoryInventory(app.state)[currency] || 0));
            const statSummary = [
                ...statCostPlan.costs.map((cost) => `${cost.label}: ${cost.available} ${cost.op} ${cost.required}`),
                ...statCostPlan.effects.map((effect) => `${effect.label}: ${effect.before} -> ${effect.after}`),
            ].join("\n");
            const confirmed = await showConfirm(
                `${verb} ${name}?`,
                `${verb} ${name} for ${item.price || 0} ${currency}? Your remaining balance will be ${Math.max(0, balance - (item.price || 0))} ${currency}.${statSummary ? `\n\n${statSummary}` : ""}`,
                { confirmText: verb, cancelText: "Cancel" },
            );
            if (!confirmed) return false;

            const currentShop = storyShopById(shopId);
            const currentItem = currentShop?.items?.find((candidate) => candidate.character_id === characterId);
            if (
                !currentShop ||
                !currentItem ||
                currentItem.locked ||
                !storyCharacterShopListingIsAvailable(currentShop, currentItem)
            )
                return showNotice("Purchase Unavailable", "That character cannot be bought right now.");
            const currentRequirements = [
                ...(currentItem.requirements || []),
                ...(currentItem.price > 0
                    ? [{ path: `story_inventory.${currency}`, op: ">=", value: currentItem.price }]
                    : []),
            ];
            if (!requirementsMet(currentRequirements, app.state))
                return showNotice("Requirements Not Met", "The purchase requirements changed before confirmation.");
            try {
                statCostPlan = characterShopStatCostPlan(currentShop, currentItem, app.state);
            } catch (error) {
                return showNotice("Purchase Configuration Error", error.message);
            }
            if (!statCostPlan.costsMet)
                return showNotice("Requirements Not Met", "The character stat costs changed before confirmation.");
            const purchaseMode = storyCharacterShopPurchaseMode(
                currentShop,
                currentItem,
            );
            applyValidatedStoryShopPurchase({
                shopId,
                characterId,
                characterName: name,
                currency,
                purchaseMode,
                statCostPlan,
            });
            const appliedShop = storyShopById(shopId);
            releaseStoryCharacterShopProfileOverride(name);
            if (purchaseMode === "service") {
                closeModal();
                await queueStoryShopPurchaseOpening(
                    { ...appliedShop, purchase_mode: purchaseMode },
                    item,
                    name,
                    currency,
                    purchaseMode,
                );
            } else {
                queueProfileImageIfMissing(name, "story shop purchase");
            }
            const ui = storyCharacterShopUiState(appliedShop);
            ui.view = purchaseMode === "acquire" ? "acquired" : "available";
            ui.selectedCharacterId = characterId;
            scheduleActiveGameSave();
            render();
            if (purchaseMode !== "service")
                openStoryShopModal(shop.id);
            return true;
        }

        function openStoryJobBoardModal(shopId = "") {
            const board = storyShopById(shopId);
            if (!board) return openStoryShopsModal();
            const inventory = ensureStoryInventory(app.state);
            const offers = ensureJobOffersForBoard(board.id);
            const cards = offers
                .map((offer) => storyJobOfferCardHtml(board, offer))
                .join("") || `<div class="character-shop-empty">No jobs are available. Wait for the board to refresh.</div>`;
            openStoryShopFullscreen(`
                <div class="character-shop-shell" data-story-shop="${escapeHtml(board.id)}">
                    ${storyShopHeaderHtml(board, `${inventory.coins || 0} coins`)}
                    ${storyShopOwnerCardHtml(board)}
                    <div class="character-shop-toolbar">
                        <span class="story-shop-toolbar-note">Rank ${escapeHtml(String(inventory.adventurer_rank || 0))} / ${escapeHtml(String(inventory.adventurer_xp || 0))} XP</span>
                        <button class="tool-button primary" type="button" onclick="EmberAdventures.waitForNewGeneratedJobs(${htmlJsArg(board.id)})"><span class="tool-icon">&#8635;</span><span class="tool-label">Wait for New Jobs</span></button>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openStoryInventoryModal()"><span class="tool-icon">&#127991;</span><span class="tool-label">Inventory</span></button>
                    </div>
                    <div class="story-shop-catalog">${cards}</div>
                </div>
            `, `job-board:${board.id}`);
            return true;
        }

        function storyJobOfferCardHtml(board = {}, offer = {}) {
            const activeDuplicate = Object.values(app.state.active_generated_jobs || {}).some((job) =>
                offer.source === "story"
                    ? job.source === "story" && job.story_job_id === offer.story_job_id && job.status === "active"
                    : job.template_id === offer.template_id && job.status === "active",
            );
            const requirementResults = storyRequirementResults(offer.requirements || [], app.state);
            const locked =
                offer.locked === true || requirementResults.some((result) => !result.met);
            const reqHtml = requirementResults.length
                ? `<ul class="story-shop-requirements">${requirementResults.map((result) => `<li class="${result.met ? "met" : "unmet"}">${escapeHtml(result.label)}</li>`).join("")}</ul>`
                : "";
            const acceptAction = offer.source === "story"
                ? `EmberAdventures.acceptStoryJob(${htmlJsArg(board.id)}, ${htmlJsArg(offer.story_job_id)})`
                : `EmberAdventures.acceptGeneratedJob(${htmlJsArg(board.id)}, ${htmlJsArg(offer.offer_id)})`;
            const statusText = activeDuplicate ? "Active" : locked ? "Locked" : "Available";
            const statusClass = activeDuplicate ? "acquired" : locked ? "locked" : "available";
            return `
                <div class="story-shop-product-card">
                    <div class="story-shop-card-heading">
                        <div>
                            <div class="story-shop-card-title">${escapeHtml(offer.title)}</div>
                            <div class="story-shop-card-meta">Rank ${escapeHtml(String(offer.rank || 0))}${offer.source === "story" ? " / Story" : " / Generated"}</div>
                        </div>
                        <span class="character-shop-status ${statusClass}">${escapeHtml(statusText)}</span>
                    </div>
                    <p class="story-shop-card-description">${escapeRuntimeTemplateText(offer.summary || "")}</p>
                    ${offer.unlock_reason && locked ? `<p class="story-shop-card-meta">${escapeHtml(offer.unlock_reason)}</p>` : ""}
                    ${reqHtml}
                    <div class="story-shop-card-price">${escapeHtml(String(offer.reward_coins || 0))} coins / ${escapeHtml(String(offer.reward_xp || 0))} XP</div>
                    <div class="story-shop-card-actions">
                        <button class="tool-button primary" type="button" ${activeDuplicate || locked ? "disabled" : ""} onclick="${acceptAction}"><span class="tool-label">Accept Job</span></button>
                    </div>
                </div>`;
        }

        function waitForNewGeneratedJobs(boardId = "") {
            app.state.story_job_offers ||= {};
            app.state.story_job_offers[boardId] = [];
            ensureJobOffersForBoard(boardId, { force: true });
            scheduleActiveGameSave();
            openStoryJobBoardModal(boardId);
            return true;
        }

        function openStoryInventoryModal() {
            const inventory = ensureStoryInventory(app.state);
            queueMissingStoryInventoryItemImages(inventory);
            const itemCards = inventory.items.length
                ? inventory.items.map(storyInventoryItemCardHtml).join("")
                : `<p class="hint">No story inventory items yet.</p>`;
            const jobs = Object.values(app.state.active_generated_jobs || {});
            const jobCards = jobs.length
                ? jobs.map((job) => `
                    <div class="stat-card">
                        <div class="row" style="justify-content:space-between;align-items:flex-start">
                            <div>
                                <div class="character-name">${escapeHtml(job.title)}</div>
                                <div class="hint">${escapeHtml(job.status || "active")}</div>
                            </div>
                            <button class="tool-button danger" type="button" onclick="EmberAdventures.abandonGeneratedJob(${htmlJsArg(job.id)})"><span class="tool-label">Abandon</span></button>
                        </div>
                    </div>`)
                : `<p class="hint">No active generated jobs.</p>`;
            openModal(`
                <div class="hint">Coins: ${escapeHtml(String(inventory.coins || 0))} / Rank: ${escapeHtml(String(inventory.adventurer_rank || 0))} / XP: ${escapeHtml(String(inventory.adventurer_xp || 0))}</div>
                <div class="row" style="margin-top:.75rem">
                    <button class="tool-button" type="button" onclick="EmberAdventures.openStoryShopsModal()"><span class="tool-label">Shops</span></button>
                </div>
                <h3>Items</h3>
                <div class="character-card-grid">${itemCards}</div>
                <h3>Jobs</h3>
                <div class="stack">${jobCards}</div>
            `, { title: "Story Inventory" });
        }

        const RUNTIME_STORY_IMAGE_SLOT_FIELDS = Object.freeze([
            "id", "title", "prompt", "negative_prompt", "seed", "model", "source",
            "url", "hosted_url", "favorite", "local_image_id", "html",
        ]);

        function runtimeStoryImageValidationErrors(value, path = "story image") {
            if (value == null) return [];
            if (!isPlainObject(value))
                return [validationError(path, "type", `${path} must be an object or null.`)];
            const errors = exactObjectFieldValidationErrors(
                value,
                RUNTIME_STORY_IMAGE_SLOT_FIELDS,
                path,
            );
            for (const field of RUNTIME_STORY_IMAGE_SLOT_FIELDS.filter(
                (field) => !["seed", "favorite"].includes(field),
            ))
                if (Object.hasOwn(value, field) && typeof value[field] !== "string")
                    errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
            if (
                Object.hasOwn(value, "seed") &&
                value.seed !== null &&
                typeof value.seed !== "string" &&
                (typeof value.seed !== "number" || !Number.isFinite(value.seed))
            )
                errors.push(validationError(`${path}.seed`, "type", `${path}.seed must be text, a finite number, or null.`));
            if (Object.hasOwn(value, "favorite") && typeof value.favorite !== "boolean")
                errors.push(validationError(`${path}.favorite`, "type", `${path}.favorite must be a boolean.`));
            return errors;
        }

        function runtimeStoryImageSlotFromExactInput(value = null, fallback = {}) {
            const slot = value || {};
            const fieldErrors = runtimeStoryImageValidationErrors(value, "story image");
            if (fieldErrors.length)
                throw new Error(validationErrorsText({ errors: fieldErrors }));

            const url = slot.url || slot.hosted_url || "";
            const localImageId = slot.local_image_id || fallback.local_image_id || fallback.image_id || "";
            const prompt = slot.prompt || fallback.prompt || fallback.image_prompt || "";
            const negativePrompt = slot.negative_prompt || fallback.negative_prompt || "";
            const html = stableImageHtmlToString(slot.html || "");
            if (
                !url &&
                !localImageId &&
                !prompt &&
                !negativePrompt &&
                !html &&
                slot.seed == null &&
                !(slot.model || fallback.model)
            )
                return null;
            return {
                id: slot.id || "",
                url,
                hosted_url: slot.hosted_url || "",
                local_image_id: localImageId,
                source: slot.source || "",
                prompt,
                negative_prompt: negativePrompt,
                seed: slot.seed ?? fallback.seed ?? null,
                model: slot.model || fallback.model || "",
                html,
                favorite: slot.favorite === true,
            };
        }

        function authoredStoryImageSlotUrl(slot = null) {
            return textSlot(slot?.url || slot?.hosted_url, "");
        }

        function authoredStoryImageSlotHtml(slot = null) {
            if (!slot) return "";
            return (
                stableImageHtmlToString(slot.html || "") ||
                imageTagForStoredSrc(authoredStoryImageSlotUrl(slot))
            );
        }

        function authoredStoryImageSlotHasReference(slot = null) {
            return !!(
                authoredStoryImageSlotHtml(slot) ||
                textSlot(slot?.local_image_id, "")
            );
        }

        function storyAssetImageRecord(owner = {}) {
            const slot = runtimeStoryImageSlotFromExactInput(owner?.image, {
                image_id: owner?.image_id,
                image_prompt: owner?.image_prompt,
            });
            const id = String(
                owner?.image_id || slot?.local_image_id || "",
            ).trim();
            if (!id) return null;
            return (app.images || []).find((image) => String(image.id) === id) || null;
        }

        function syncStoryAssetImageRecord(owner = {}, record = null) {
            if (!owner || !record?.id) return false;
            owner.image_id = String(record.id);
            return true;
        }

        function storyInventoryItemImageRecord(item = {}) {
            return storyAssetImageRecord(item);
        }

        function storyInventoryItemImageHtml(item = {}) {
            const image = storyInventoryItemImageRecord(item);
            const html = image ? renderImageRecordHtml(image) : "";
            if (html) return html;
            if (image?.pending)
                return `<div class="profile-image-loading">${loadingSpinnerHtml("Generating item image")}</div>`;
            const authored = authoredStoryImageSlotHtml(
                runtimeStoryImageSlotFromExactInput(item?.image),
            );
            if (authored) return authored;
            return `<div class="profile-image-placeholder" aria-label="Item image placeholder"></div>`;
        }

        function storyInventoryImagePrompt(item = {}) {
            return joinPromptParts([
                "square fantasy RPG inventory item icon",
                "one object only, centered composition, object fills most of the square frame",
                "clean plain dark neutral background",
                "isolated item art, no scene, no environment",
                "no hands, no person, no creature, no text, no watermark",
                item.image_prompt || item.description || item.name,
            ]);
        }

        function storyInventoryImageNegativePrompt() {
            return "text, letters, watermark, logo, signature, person, human, hands, face, extra objects, cluttered background, blurry, low quality";
        }

        function queueMissingStoryInventoryItemImages(inventory = ensureStoryInventory(app.state)) {
            for (const item of inventory.items || []) {
                const record = storyInventoryItemImageRecord(item);
                if (
                    record?.pending ||
                    renderImageRecordHtml(record) ||
                    authoredStoryImageSlotHtml(
                        runtimeStoryImageSlotFromExactInput(item?.image),
                    )
                )
                    continue;
                if (!item?.image_prompt) continue;
                generateStoryInventoryItemImageForItem(item);
            }
        }

        function discardRollbackSnapshot(snapshotId = "") {
            const id = String(snapshotId || "");
            const index = (app.snapshots || []).findIndex(
                (snapshot) => String(snapshot.id || "") === id,
            );
            if (index < 0) return false;
            const removed = app.snapshots[index];
            const wasNewest = index === app.snapshots.length - 1;
            if (index + 1 < app.snapshots.length) {
                const next = app.snapshots[index + 1];
                next.reverseRuntimeChanges = [
                    ...(next.reverseRuntimeChanges || []),
                    ...(removed.reverseRuntimeChanges || []),
                ];
                markRuntimeCollectionDirty("snapshots", String(next.id || ""), "put");
            }
            app.snapshots.splice(index, 1);
            markRuntimeCollectionDirty("snapshots", id, "delete");
            if (app.snapshots.length) app.snapshots[0].reverseRuntimeChanges = [];
            if (wasNewest) {
                app.snapshotHeadExtraReverseChanges = [
                    ...(app.snapshotHeadExtraReverseChanges || []),
                    ...(removed.reverseRuntimeChanges || []),
                ];
            }
            return true;
        }

        function queueMissingStoryShopItemImages(shop = {}) {
            let queued = false;
            for (const listing of shop.items || []) {
                const item = listing?.item;
                const record = storyInventoryItemImageRecord(item);
                if (
                    record?.pending ||
                    renderImageRecordHtml(record) ||
                    authoredStoryImageSlotHtml(
                        runtimeStoryImageSlotFromExactInput(item?.image),
                    )
                )
                    continue;
                if (!item?.image_prompt) continue;
                queued = generateStoryInventoryItemImageForItem(item) || queued;
            }
            return queued;
        }

        function refreshStoryInventoryItemImageSurfaces(itemId = "") {
            const id = String(itemId || "");
            if (!id || !document?.querySelectorAll) return false;
            const inventory = ensureStoryInventory(app.state);
            let item = inventory.items.find((entry) => String(entry.id) === id);
            if (!item) {
                for (const shop of Object.values(app.state.story_shops || {})) {
                    const listing = (shop?.items || []).find(
                        (entry) => String(entry?.item?.id || "") === id,
                    );
                    if (listing?.item) {
                        item = listing.item;
                        break;
                    }
                }
            }
            if (!item) return false;
            document
                .querySelectorAll(`[data-story-item-image="${cssEscape(id)}"]`)
                .forEach((container) => {
                    container.innerHTML = storyInventoryItemImageHtml(item);
                    activatePluginIframes(container);
                });
            return true;
        }

        function generateStoryInventoryItemImage(itemId = "", options = {}) {
            const inventory = ensureStoryInventory(app.state);
            const item = inventory.items.find((entry) => String(entry.id) === String(itemId));
            return generateStoryInventoryItemImageForItem(item, options);
        }

        function generateStoryInventoryItemImageForItem(item = null, options = {}) {
            if (!item?.image_prompt) return false;
            const existing = storyInventoryItemImageRecord(item);
            if (existing?.pending || renderImageRecordHtml(existing)) return false;
            const model = activeNormalImageModel();
            const styled = applyImageArtStyle(
                storyInventoryImagePrompt(item),
                storyInventoryImageNegativePrompt(),
                model,
            );
            const record = rememberImage({
                title: item.name || "Story Item",
                reason: "story inventory item image",
                model,
                seed: "random",
                prompt: styled.prompt,
                negativePrompt: styled.negativePrompt,
                html: imageLoadingHtml("Generating item image"),
                pending: true,
                targets: [],
                requestedAt: new Date().toISOString(),
                promptType: "story inventory item image",
                hideFromChat: true,
            });
            syncStoryAssetImageRecord(item, record);
            scheduleActiveGameSave();
            refreshStoryInventoryItemImageSurfaces(item.id);
            if (options.startRequest !== false)
                startStoredImageRequest(record).finally(() =>
                    refreshStoryInventoryItemImageSurfaces(item.id),
                );
            return true;
        }

        function storyShopOutfitImageRecord(outfit = {}) {
            return storyAssetImageRecord(outfit);
        }

        function storyShopOutfitImageHtml(outfit = {}) {
            const image = storyShopOutfitImageRecord(outfit);
            const html = image ? renderImageRecordHtml(image) : "";
            if (html) return html;
            if (image?.pending)
                return `<div class="profile-image-loading">${loadingSpinnerHtml("Generating outfit image")}</div>`;
            const authored = authoredStoryImageSlotHtml(
                runtimeStoryImageSlotFromExactInput(outfit?.image),
            );
            if (authored) return authored;
            return `<div class="profile-image-placeholder" aria-label="Outfit image placeholder"></div>`;
        }

        function storyShopOutfitImagePrompt(outfit = {}, listing = {}) {
            const clothing = Object.entries(outfit.clothing || {})
                .filter(([, value]) => !isEmptyClothingValue(value))
                .map(([slot, value]) => `${slot.replaceAll("_", " ")}: ${clothingItemText(value)}`)
                .join(", ");
            return joinPromptParts([
                "square fantasy RPG outfit shop icon",
                "one complete outfit displayed neatly on a simple mannequin or hanger",
                "centered composition, outfit fills most of the square frame",
                "clean plain dark neutral background",
                "no model face, no person, no text, no watermark",
                outfit.image_prompt || listing.image_prompt || listing.summary || outfit.name,
                clothing,
            ]);
        }

        function storyShopOutfitImageNegativePrompt() {
            return "text, letters, watermark, logo, signature, face, person, hands, extra outfits, cluttered background, blurry, low quality";
        }

        function queueMissingStoryClothingShopOutfitImages(shop = {}) {
            let queued = false;
            for (const listing of shop.items || []) {
                const outfit = listing?.outfit;
                if (!outfit || false) continue;
                outfit.image_prompt ||= textSlot(listing.image_prompt || listing.summary, "");
                const record = storyShopOutfitImageRecord(outfit);
                if (
                    record?.pending ||
                    renderImageRecordHtml(record) ||
                    authoredStoryImageSlotHtml(
                        runtimeStoryImageSlotFromExactInput(outfit?.image),
                    )
                )
                    continue;
                queued = generateStoryShopOutfitImageForListing(listing) || queued;
            }
            return queued;
        }

        function refreshStoryShopOutfitImageSurfaces(outfitId = "") {
            const id = String(outfitId || "");
            if (!id || !document?.querySelectorAll) return false;
            let outfit = null;
            for (const shop of Object.values(app.state.story_shops || {})) {
                const listing = (shop?.items || []).find(
                    (entry) => String(entry?.outfit?.id || "") === id,
                );
                if (listing?.outfit) {
                    outfit = listing.outfit;
                    break;
                }
            }
            if (!outfit) return false;
            document
                .querySelectorAll(`[data-story-outfit-image="${cssEscape(id)}"]`)
                .forEach((container) => {
                    container.innerHTML = storyShopOutfitImageHtml(outfit);
                    activatePluginIframes(container);
                });
            return true;
        }

        function generateStoryShopOutfitImageForListing(listing = {}, options = {}) {
            const outfit = listing?.outfit;
            if (!outfit || false) return false;
            const existing = storyShopOutfitImageRecord(outfit);
            if (existing?.pending || renderImageRecordHtml(existing)) return false;
            const model = activeNormalImageModel();
            const styled = applyImageArtStyle(
                storyShopOutfitImagePrompt(outfit, listing),
                storyShopOutfitImageNegativePrompt(),
                model,
            );
            const forceSfw = true;
            const record = rememberImage({
                title: outfit.name || listing.title || "Shop Outfit",
                reason: "story shop outfit image",
                model,
                seed: "random",
                prompt: styled.prompt,
                negativePrompt: styled.negativePrompt,
                html: imageLoadingHtml("Generating outfit image"),
                pending: true,
                targets: [],
                requestedAt: new Date().toISOString(),
                promptType: "story shop outfit image",
                hideFromChat: true,
            });
            syncStoryAssetImageRecord(outfit, record);
            scheduleActiveGameSave();
            refreshStoryShopOutfitImageSurfaces(outfit.id);
            if (options.startRequest !== false)
                startStoredImageRequest(record).finally(() =>
                    refreshStoryShopOutfitImageSurfaces(outfit.id),
                );
            return true;
        }

        function storyInventoryItemCardHtml(item = {}) {
            return `
                <div class="stat-card">
                    <div class="character-name">${escapeHtml(item.name)}</div>
                    <div class="profile-image-button" style="width:96px;height:96px" data-story-item-image="${escapeHtml(String(item.id || ""))}">
                        ${storyInventoryItemImageHtml(item)}
                    </div>
                    <div class="hint">Qty ${escapeHtml(String(item.quantity || 1))} / Value ${escapeHtml(String(item.value || 0))}${item.quest_item ? " / Quest" : ""}</div>
                    <p class="hint">${escapeHtml(item.description || item.image_prompt || "")}</p>
                    <div class="row">
                        <button class="tool-button" type="button" onclick="EmberAdventures.inspectStoryInventoryItem(${htmlJsArg(item.id)})"><span class="tool-icon">&#128269;</span><span class="tool-label">View</span></button>
                    </div>
                </div>`;
        }

        function inspectStoryInventoryItem(itemId = "") {
            const item = ensureStoryInventory(app.state).items.find(
                (entry) => String(entry.id) === String(itemId),
            );
            if (!item) return openStoryInventoryModal();
            if (item.image_prompt) generateStoryInventoryItemImage(item.id);
            openModal(`
                <p><strong>${escapeHtml(item.name)}</strong></p>
                <div class="profile-image-button" style="width:160px;height:160px;margin:.75rem 0" data-story-item-image="${escapeHtml(String(item.id || ""))}">
                    ${storyInventoryItemImageHtml(item)}
                </div>
                <p class="hint">Quantity ${escapeHtml(String(item.quantity || 1))} / Value ${escapeHtml(String(item.value || 0))}</p>
                <p>${escapeHtml(item.description || "No description.")}</p>
                ${item.image_prompt ? `<p class="hint">Image prompt: ${escapeHtml(item.image_prompt)}</p>` : ""}
                <div class="row" style="margin-top:.9rem">
                    <button type="button" onclick="EmberAdventures.openStoryInventoryModal()">Back</button>
                </div>
            `, { title: "Item" });
        }

        function sellStoryInventoryItem(shopId = "", itemId = "", sellStack = false) {
            const shop = storyShopById(shopId);
            const inventory = ensureStoryInventory(app.state);
            const item = inventory.items.find((entry) => String(entry.id) === String(itemId));
            if (
                !shop ||
                shop.type !== "general" ||
                shop.buying?.enabled !== true ||
                !item ||
                item.sellable === false ||
                item.quest_item === true ||
                Number(item.value || 0) <= 0
            )
                return false;
            const quantity = sellStack ? Math.max(1, Number(item.quantity || 1)) : 1;
            item.quantity = Math.max(0, Number(item.quantity || 1) - quantity);
            const currency = exactStoryInventoryItemId(shop.currency, `story shop ${shop.id}.currency`);
            inventory.items = inventory.items.filter((entry) => Number(entry.quantity || 0) > 0);
            // Currency adjustment normalizes story_inventory, so commit the item
            // mutation first instead of filtering a stale array afterward.
            adjustStoryInventoryItemValue(app.state, currency, Number(item.value || 0) * quantity);
            scheduleActiveGameSave();
            render();
            openStoryGeneralShopModal(shop.id, "sell");
            return true;
        }

        function sellAllStoryLoot(shopId = "") {
            const shop = storyShopById(shopId);
            if (!shop || shop.type !== "general" || shop.buying?.enabled !== true) return false;
            const inventory = ensureStoryInventory(app.state);
            let gained = 0;
            for (const item of inventory.items) {
                if (
                    item.sellable === false ||
                    item.quest_item === true ||
                    Number(item.value || 0) <= 0
                )
                    continue;
                gained += Number(item.value || 0) * Number(item.quantity || 1);
                item.quantity = 0;
            }
            inventory.items = inventory.items.filter((entry) => Number(entry.quantity || 0) > 0);
            adjustStoryInventoryItemValue(app.state, shop.currency, gained);
            scheduleActiveGameSave();
            render();
            openStoryGeneralShopModal(shop.id, "sell");
            return true;
        }

        function renderScene() {
            const location = currentLocationDetail(app.state);
            const scene = app.state.scene || {};
            const sceneCard = $("sceneCard");
            if (!sceneCard) return;
            const preservedProfileNodes = preserveActiveProfileImageNodes(sceneCard);
            const place =
                location.specific_place ||
                location.district ||
                location.settlement_name ||
                "Unknown place";
            const locationLine = [
                location.district,
                location.settlement_name,
                location.region,
                location.world,
            ]
                .filter(Boolean)
                .join(" / ");
            const activeCharacters =
                (scene.party_members_present || []).join(", ") ||
                "none";
            const imageCharacters =
                (scene.image_characters || []).join(", ") ||
                "none";

            const adultMode = false;
            const objectiveLabel = sceneObjectiveLabel(app.state);

            sceneCard.innerHTML = `
        <strong>${escapeHtml(place)}</strong>
        <div class="hint">${escapeHtml(locationLine)}</div>
        ${""}
        <div class="state-chip-row">
          ${""}
        </div>
        ${
            reducedUiEnabled()
                ? `<div class="hint"><b>Objective:</b> ${escapeRuntimeTemplateText(objectiveLabel || "none")}</div>
                   <div class="hint"><b>Scene:</b> ${escapeRuntimeTemplateText(scene.summary || "")}</div>`
                : `<div class="hint"><b>Active:</b> ${escapeHtml(activeCharacters)}</div>
                   <div class="hint"><b>Image:</b> ${escapeHtml(imageCharacters)}</div>
                   ${renderNearbyCharacters()}
                   ${""}
                   <div class="hint"><b>Current objective:</b> ${escapeRuntimeTemplateText(objectiveLabel || "none")}</div>
                   <div class="hint"><b>Scene:</b> ${escapeRuntimeTemplateText(scene.summary || "")}</div>`
        }
        <div class="scene-controls">
          <button class="tool-button" title="Show party members and NPCs" onclick="EmberAdventures.openCharactersModal()"><span class="tool-icon">&#128101;</span><span class="tool-label">Characters</span></button>
          <button class="tool-button" title="Find someone in the current area" onclick="EmberAdventures.openFindCharacterModal()"><span class="tool-icon">&#128269;</span><span class="tool-label">Find</span></button>
          <button class="tool-button" title="Open shops and job boards" onclick="EmberAdventures.openStoryShopsModal()"><span class="tool-icon">&#127978;</span><span class="tool-label">Shops</span></button>
          ${""}
        </div>
      `;
            restoreActiveProfileImageNodes(sceneCard, preservedProfileNodes);
        }

        function renderMapCard() {
            const card = $("mapCard");
            if (!card) return;
            const map = app.state.world_map || {};
            const current = currentMapLocation();
            const parent = current?.parent_id ? map.locations?.[current.parent_id] : null;
            const children = mapChildLocations(current?.id).slice(0, 4);
            const connected = connectedMapLocations(current?.id).slice(0, 4);
            const nearby = [...children, ...connected]
                .filter((node, index, list) => node && list.findIndex((x) => x.id === node.id) === index)
                .slice(0, 5);
            card.innerHTML = `
                <div class="map-mini">
                    <strong>${escapeHtml(current?.name || "Unmapped Location")}</strong>
                    <div class="map-trail">${escapeHtml(mapTrailText(current?.id) || "No map trail yet")}</div>
                    <div class="hint"><b>Scale:</b> ${escapeHtml(current?.scale || "scene")} / <b>Type:</b> ${escapeHtml(current?.type || "place")}</div>
                    ${parent ? `<div class="hint"><b>Inside:</b> ${escapeHtml(parent.name)}</div>` : ""}
                    <div class="hint"><b>Nearby map nodes:</b> ${escapeHtml(nearby.map((node) => node.name).join(", ") || "none discovered")}</div>
                    <div class="row">
                        <button class="tool-button primary" type="button" onclick="EmberAdventures.openMapModal()" title="Open visual travel map"><span class="tool-icon">&#128506;</span><span class="tool-label">Open Map</span></button>
                        <button class="tool-button" type="button" onclick="EmberAdventures.openMapLocationEditor()" title="Add a location"><span class="tool-icon">&#10010;</span><span class="tool-label">Add</span></button>
                    </div>
                </div>
            `;
        }

        function renderNearbyCharacters() {
            const nearby = (app.state.scene?.npcs_present || []).filter(
                (name) => isValidNearbyNpcName(name),
            );
            if (!nearby.length) return `<div class="hint"><b>Nearby:</b> none noticed</div>`;
            const rows = nearby
                .slice(0, 6)
                .map((name) => {
                    const npc = getNpcEntry(name);
                    const title = npc?.role ? ` - ${npc.role}` : "";
                    const gender = npcGenderLabel(npc);
                    const genderText = gender ? ` / ${gender}` : "";
                    const dead = npcIsDead(npc);
                    const statusText = dead ? " / dead" : "";
                    const age = npc?.age || npc?.full_character?.age;
                    const ageText = Number(age) ? ` / ${Number(age)}` : "";
                    const nameArg = htmlJsArg(name);
                    if (npc?.inspected && npc.full_character) {
                        return npcCardHtml(name, npc, {
                            locationId: currentNpcLocationId(),
                        });
                    }
                    return `
                        <div class="nearby-row">
                            <div class="nearby-name">${escapeHtml(name + statusText + genderText + ageText + title)}</div>
                            <div class="nearby-actions">
                                ${app.state.characters?.[name] ? "" : `<button class="icon-button warn" title="Remove from scene" onclick="EmberAdventures.removeNpcFromScene(${nameArg})">X</button>`}
                                ${dead ? "" : `<button class="icon-button" title="Inspect character" onclick="EmberAdventures.inspectNpc(${nameArg})">&#128269;</button>
                                <button class="icon-button party-off" title="Invite to party" onclick="EmberAdventures.inviteNpc(${nameArg})">&#128233;</button>`}
                                ${dead ? `<button class="icon-button" title="Restore NPC" onclick="EmberAdventures.restoreNpc(${nameArg})">&#8635;</button>` : ""}
                                ${app.state.characters?.[name] || dead ? "" : `<button class="icon-button danger" title="Mark NPC dead" onclick="EmberAdventures.killNpc(${nameArg})">&#9760;</button>`}
                            </div>
                        </div>
                    `;
                })
                .join("");
            return `<div class="hint"><b>Nearby</b></div><div class="nearby-list">${rows}</div>`;
        }

        function renderQuestCard() {
            const objective = currentObjectiveTarget();
            const questCard = $("questCard");
            if (!questCard) return;
            if (directObjectiveChoiceIsWaiting()) {
                questCard.innerHTML = `
        <div class="character-name"><span class="objective-title-main">Choice Required</span></div>
        <div class="hint" style="margin-top:.4rem">Choose how to continue.</div>
        <div class="quest-controls">
          <button class="tool-button primary" title="Choose how to continue" onclick="EmberAdventures.openDirectObjectiveChoiceModal()"><span class="tool-icon">&#9873;</span><span class="tool-label">Choose</span></button>
        </div>
      `;
                return;
            }
            const kindClass = objective
                ? objectiveIsSide(objective)
                    ? "objective-title-side"
                    : "objective-title-main"
                : "";
            const description = objective
                ? objectiveDisplayGoal(objective) || "No description."
                : "Open Objectives to choose what EmberAdventures should track.";
            const unavailable =
                objective &&
                !objectiveCompletionRequirementsMet(objective, app.state);

            questCard.innerHTML = `
        <div class="character-name"><span class="${kindClass} ${unavailable ? "objective-title-unavailable" : ""}">${escapeHtml(objective?.title || "No objective selected")}</span></div>
        <div class="hint" style="margin-top:.4rem">${escapeRuntimeTemplateText(description)}</div>
        ${unavailable ? `<div class="hint objective-title-unavailable">${escapeHtml(objectiveCompletionRequirementsText(objective, app.state))}</div>` : ""}
        <div class="quest-controls">
          <button class="tool-button primary" title="Choose which objective the AI should push toward" onclick="EmberAdventures.openObjectivePickerModal()"><span class="tool-icon">&#127919;</span><span class="tool-label">Objectives</span></button>
        </div>
      `;
        }

        function activeObjective(state = app.state) {
            const log = state.objectives || {};
            if (log.no_current === true) return null;
            const items = Array.isArray(log.items) ? log.items : [];
            const statusCache = new Map();
            const recordedActive = objectiveRuntimeLookup(state).byId.get(
                String(log.active_id || ""),
            );
            if (
                recordedActive &&
                !objectiveIsSide(recordedActive) &&
                objectiveCanBeShown(recordedActive, state, statusCache)
            )
                return recordedActive;
            let firstSelectable = null;
            for (const item of items) {
                if (objectiveIsSide(item)) continue;
                if (!objectiveCanBeShown(item, state, statusCache)) continue;
                if (effectiveObjectiveStatus(item, state, statusCache) === "active")
                    return item;
                if (objectiveCanBeSelected(item, state, statusCache))
                    firstSelectable ||= item;
            }
            return firstSelectable;
        }

        function activeSideObjectives(state = app.state) {
            const active = [];
            const statusCache = new Map();
            for (const item of state.objectives?.items || []) {
                if (
                    objectiveIsSide(item) &&
                    !objectiveIsComplete(item, state, statusCache) &&
                    objectiveCanBeShown(item, state, statusCache)
                )
                    active.push(item);
                if (active.length >= 4) break;
            }
            return active;
        }

        function currentObjectiveTarget(state = app.state) {
            // "Stop Tracking" is an explicit no-target state; stale focus ids must
            // not keep driving the left panel, top objective panel, or AI prompt.
            if (state.objectives?.no_current === true) return null;
            const items = state.objectives?.items || [];
            const focusId = String(state.objectives?.focus_id || "").trim();
            const focused = focusId
                ? items.find((item) => String(item.id) === focusId)
                : null;
            if (focused && objectiveCanBeShown(focused, state)) return focused;
            return activeObjective(state);
        }

        function selectedObjectiveRuntime(state = app.state) {
            const objective = currentObjectiveTarget(state);
            const activeMain = activeObjective(state);
            const kind = objective
                ? objectiveIsSide(objective)
                    ? "side"
                    : "main"
                : "";
            return {
                selected_objective_id: objective?.id || "",
                selected_objective_kind: kind,
                objective,
                active_main: activeMain,
            };
        }

        function objectiveDisplayGoal(objective = null, state = app.state) {
            const value = String(
                objective?.summary ||
                    objective?.objective ||
                    objective?.title ||
                    objective?.id ||
                    "",
            ).trim();
            return resolveRuntimeMessageTemplateText(value, state);
        }

        function sceneObjectiveLabel(state = app.state) {
            const objective = selectedObjectiveRuntime(state).objective;
            return objectiveDisplayGoal(objective);
        }

        function storyRuntimeProgressionForPrompt(progression = {}) {
            return {};
        }

        function selectedObjectiveForPrompt(state = app.state) {
            const runtime = selectedObjectiveRuntime(state);
            const objective = runtime.objective;
            if (!objective) return null;
            return runtimeObjectiveForPrompt({
                ...objective,
                kind: runtime.selected_objective_kind,
                available_now: objective.available_now !== false,
                blocked_reason: textSlot(objective.blocked_reason, ""),
                requires: objectiveRequiredIds(objective),
            });
        }

        function objectiveSuggestionFromText(text, reason = "conflicting story hook") {
            const title = textSlot(text, "");
            if (!title) return null;
            return {
                id: objectiveIdFromTitle(title, `suggestion-${Date.now()}`),
                title,
                reason,
                available_now: true,
                status: "suggested",
            };
        }

        function reconcileStoryRuntimeState(
            state = app.state,
            reason = "story reconcile",
            options = {},
        ) {
            if (!state || typeof state !== "object") return state;
            // A newly loaded/replaced runtime state cannot share the prior save's
            // immutable definition or sparse runtime maps. Install the matching
            // definition before objective, reward, or UI reconciliation reads it.
            if (state === app.state) {
                const definitionChanged =
                    !app.storyDefinition ||
                    app.storyDefinition.revisionId !== state?.meta?.definition_revision_id;
                if (definitionChanged) {
                    if (state?.meta?.smoke_test_runtime === true) {
                        // Synthetic smokes deliberately replace their full state
                        // in-process. Keep that test-only fixture support out of
                        // production save/load/reconciliation paths.
                        installImmutableStoryDefinitionFromState(state);
                    }
                    else
                        throw new Error(
                            "Runtime reconciliation requires the matching immutable story definition. Load or create the save through the story-definition worker first.",
                        );
                } else if (app.runtimeStateReference !== state) {
                    // Restoring or replacing an entire save state keeps the same
                    // immutable definition, but its sparse mutable aggregates
                    // belong to the replacement state, not the previous save.
                    app.objectiveRuntime = objectiveRuntimeFromState(
                        state,
                        app.storyDefinition,
                    );
                    app.objectiveRuntimeLookup = null;
                    app.objectiveRuntimeNeedsFullSync = false;
                    app.jobRuntime = runtimeJobAggregateFromState(state);
                    app.storyRulesRuntime = storyRulesRuntimeFromState(
                        state,
                        app.storyDefinition,
                    );
                    app.runtimeStateReference = state;
                }
            }
            assertObjectiveRuntimeControls(state.objectives);
            updateObjectivePrerequisiteLocks(
                state,
                options.changedObjectiveIds || null,
                options,
            );
            const changedIds = Array.isArray(options.changedObjectiveIds)
                ? options.changedObjectiveIds
                : [];
            const byId = objectiveRuntimeLookup(state).byId;
            for (const changedId of changedIds) {
                const objective = byId.get(String(changedId || ""));
                if (!objective)
                    throw new Error(
                        `Runtime objective ${changedId} does not exist in the active objective view.`,
                    );
                if (!objectiveDefinitionById(objective.id))
                    throw new Error(
                        `Runtime objective ${objective.id} has no immutable authored or generated-job definition.`,
                    );
            }
            const items = state.objectives.items;
            const focused = items.find(
                (item) => String(item.id) === String(state.objectives.focus_id),
            );
            if (!focused || !objectiveIsSide(focused) || !objectiveCanBeSelected(focused, state))
                state.objectives.focus_id = "";
            const activeMain = activeObjective(state);
            if (activeMain?.id) state.objectives.active_id = activeMain.id;
            const selected = selectedObjectiveRuntime(state).objective;
            const selectedLabel = objectiveDisplayGoal(selected);
            const staleSceneObjective = textSlot(state.scene?.objective, "");
            if (
                staleSceneObjective &&
                selectedLabel &&
                normalizeNameForMatch(staleSceneObjective) !==
                    normalizeNameForMatch(selectedLabel)
            ) {
                const suggestions =
                    state === app.state
                        ? app.objectiveRuntime.suggestions
                        : objectiveRuntimeFromState(state).suggestions;
                const duplicate = suggestions.some(
                    (item) =>
                        normalizeNameForMatch(item.title) ===
                        normalizeNameForMatch(staleSceneObjective),
                );
                if (!duplicate) {
                    const suggestion = objectiveSuggestionFromText(
                        staleSceneObjective,
                        `${reason}: previous scene objective differed from selected objective`,
                    );
                    if (suggestion) suggestions.unshift(suggestion);
                }
            }
            state.progression = {};
            if (state.scene) delete state.scene.objective;
            return state;
        }

        function formatSideObjectiveSummary(objectives) {
            if (!Array.isArray(objectives) || !objectives.length) return "";
            return `<details style="margin-top:.45rem"><summary>Side objectives (${objectives.length})</summary><div class="hint">${escapeRuntimeTemplateText(objectives.map((item) => item.title || item.id).join(" | "))}</div></details>`;
        }

        function visibleObjectiveChoices(state = app.state) {
            const choices = [];
            const statusCache = new Map();
            const activeMainId = String(activeObjective(state)?.id || "");
            const noCurrent = state.objectives?.no_current === true;
            for (const objective of state.objectives?.items || []) {
                if (objectiveIsSide(objective)) continue;
                if (!objectiveCanBeShown(objective, state, statusCache)) continue;
                if (directObjectiveChoiceIsWaiting(state) && objectiveIsDirectChoice(objective))
                    continue;
                // Older Stop Tracking behavior could leave the next main objective
                // queued while no objective is selected. Keep selectable queued
                // objectives visible so the player can recover by selecting one.
                if (
                    effectiveObjectiveStatus(objective, state, statusCache) !== "active" &&
                    String(objective.id || "") !== activeMainId &&
                    !objectiveExplicitlySelectable(objective) &&
                    !(noCurrent && objectiveCanBeSelected(objective, state, statusCache))
                )
                    continue;
                choices.push({ kind: "main", objective });
            }
            for (const objective of state.objectives?.items || []) {
                if (!objectiveIsSide(objective)) continue;
                if (!objectiveCanBeShown(objective, state, statusCache)) continue;
                choices.push({ kind: "side", objective });
            }
            const seen = new Set();
            return choices.filter(({ objective }) => {
                const id = String(objective?.id || "");
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
        }

        function openObjectivePickerModal(expandObjectiveId = "") {
            if (!expandObjectiveId && directObjectiveChoiceIsWaiting(app.state))
                return openDirectObjectiveChoiceModal();
            const current = currentObjectiveTarget();
            const choices = visibleObjectiveChoices();
            const expandedId =
                String(expandObjectiveId || app.objectivePickerExpandedId || current?.id || "")
                    .trim();
            app.objectivePickerExpandedId = expandedId;
            const currentDescription = current
                ? current.summary ||
                  current.objective ||
                  objectiveDisplayGoal(current) ||
                  "No description."
                : "No objective is currently being tracked.";
            openModal(`
                <h2>Objectives</h2>
                ${pendingRewardChoicesHtml()}
                <div class="stat-card">
                    <div class="character-name">
                        <span class="${
                            current
                                ? objectiveIsSide(current)
                                    ? "objective-title-side"
                                    : "objective-title-main"
                                : ""
                    }">${escapeRuntimeTemplateText(current?.title || "No objective selected")}</span>
                    </div>
                    <div class="hint" style="margin-top:.45rem">${escapeRuntimeTemplateText(currentDescription)}</div>
                    ${
                        current
                            ? `<div class="row" style="margin-top:.65rem">
                                  <button type="button" class="tool-button warn" onclick="EmberAdventures.stopTrackingObjectiveFromPicker()">
                                      <span class="tool-icon">&#8709;</span>
                                      <span class="tool-label">Stop Tracking</span>
                                  </button>
                               </div>`
                            : ""
                    }
                </div>
                ${objectivePickerSectionHtml(
                    "objective-picker-main",
                    "Main Story",
                    choices.filter(({ kind }) => kind === "main").map(({ objective }) => objective),
                    expandedId,
                    current,
                )}
                ${objectivePickerSectionHtml(
                    "objective-picker-side",
                    "Side Objectives",
                    choices.filter(({ kind }) => kind === "side").map(({ objective }) => objective),
                    expandedId,
                    current,
                )}
            `);
            requestAnimationFrame(() => {
                const row = expandedId
                    ? document.querySelector(
                          `[data-objective-picker-id="${cssEscape(expandedId)}"]`,
                      )
                    : null;
                row?.scrollIntoView?.({ block: "nearest" });
            });
        }

        function objectivePickerSectionHtml(sectionId, title, objectives, expandedId, current) {
            const rows = objectives.length
                ? objectives
                      .map((objective) =>
                          objectivePickerRowHtml(objective, expandedId, current),
                      )
                      .join("")
                : `<div class="hint">No visible objectives.</div>`;
            return `
                <details class="panel-section" ${detailsOpenAttr(sectionId, true)} ontoggle="EmberAdventures.setLeftPanelSectionOpen('${sectionId}', this.open)">
                    <summary class="panel-title">${escapeHtml(title)}</summary>
                    <div class="panel-section-body objective-button-list">${rows}</div>
                </details>
            `;
        }

        function objectivePickerRowHtml(objective, expandedId, current) {
            const id = String(objective.id || "");
            const expanded = id && id === String(expandedId || "");
            const selected = current && String(current.id) === id;
            const locked = currentLockedObjective(app.state);
            const lockedByOther =
                !!locked && String(locked.id || "") !== String(objective.id || "");
            const disabled = lockedByOther || !objectiveCanBeSelected(objective, app.state);
            const titleClass = objectiveIsSide(objective)
                ? "objective-title-side"
                : "objective-title-main";
            const unavailable =
                !objectiveCompletionRequirementsMet(objective, app.state);
            const description = objectiveDisplayGoal(objective) || "No description.";
            return `
                <div class="objective-picker-row ${selected ? "active" : ""}" data-objective-picker-id="${escapeHtml(id)}">
                    <button type="button" class="tool-button objective-picker-toggle" onclick="EmberAdventures.openObjectivePickerModal(${htmlJsArg(id)})">
                        <span class="tool-label ${titleClass} ${unavailable ? "objective-title-unavailable" : ""}">${escapeRuntimeTemplateText(objective.title || id || "Objective")}</span>
                    </button>
                    ${
                        expanded
                            ? `<div class="objective-picker-detail">
                                  <div class="hint">${escapeRuntimeTemplateText(description)}</div>
                                  ${objectiveLockedUntilComplete(objective) ? `<div class="hint">Locked until complete.</div>` : ""}
                                  ${lockedByOther ? `<div class="hint">Finish ${escapeRuntimeTemplateText(locked.title || locked.id)} before switching objectives.</div>` : ""}
                                  ${objective.blocked_reason ? `<div class="hint">${escapeRuntimeTemplateText(objective.blocked_reason)}</div>` : ""}
                                  ${unavailable ? `<div class="hint objective-title-unavailable">${escapeHtml(objectiveCompletionRequirementsText(objective, app.state))}</div>` : ""}
                                  <div class="row">
                                      <button type="button" class="tool-button ${selected ? "success objective-selected-button" : "success"}" ${disabled ? "disabled" : ""} onclick="EmberAdventures.selectObjectiveFromPicker(${htmlJsArg(id)})">
                                          <span class="tool-label">${selected ? "Selected" : "Select"}</span>
                                      </button>
                                  </div>
                              </div>`
                            : ""
                    }
                </div>
            `;
        }

        function selectObjectiveFromPicker(objectiveId) {
            const pendingReply = app.pendingObjectiveChoiceReply;
            setObjectiveFocus(objectiveId, { renderAfter: false });
            if (pendingReply && !app.pendingObjectiveChoiceReply)
                app.pendingObjectiveChoiceReply = pendingReply;
            app.objectivePickerExpandedId = String(objectiveId || "");
            if (resumePendingObjectiveChoiceReply("objective selected from picker"))
                return;
            // The picker stays open, but the main objective displays behind it
            // must refresh immediately after Stop Tracking -> Select.
            render();
            openObjectivePickerModal(objectiveId);
        }

        function stopTrackingObjectiveFromPicker() {
            clearCurrentObjective({ close: false, renderAfter: false });
            app.objectivePickerExpandedId = "";
            // The picker stays open, but the left card/top panel behind it must
            // clear immediately when tracking is stopped.
            render();
            openObjectivePickerModal();
        }

        function objectiveRequiresLabel(objective = {}) {
            const ids = objectiveRequiredIds(objective);
            if (!ids.length) return "";
            const completed = completedObjectiveIds(app.state);
            const labels = ids.map((id) => {
                const item = (app.state.objectives?.items || []).find(
                    (objectiveItem) => String(objectiveItem.id) === String(id),
                );
                const label = item?.title || id;
                return `${completed.has(String(id)) ? "done" : "locked"}: ${label}`;
            });
            return `<div class="hint"><b>Requires:</b> ${escapeHtml(labels.join(" | "))}</div>`;
        }

        function openSetObjectiveModal() {
            reconcileStoryRuntimeState(app.state, "open set objective");
            const current = currentObjectiveTarget();
            const existingItems = app.state.objectives?.items || [];
            const objectiveOptions = existingItems
                .filter(
                    (objective) =>
                        !objectiveIsComplete(objective) &&
                        (String(objective.id || "") === String(current?.id || "") ||
                            objectiveCanBeSelected(objective, app.state)),
                )
                .map(
                    (objective) =>
                        `<option value="${escapeHtml(objective.id)}" ${
                            objective.id === current?.id ? "selected" : ""
                        }>${escapeRuntimeTemplateText(`${objectiveIsSide(objective) ? "Side" : "Story"}: ${objective.title || objective.id}`)}</option>`,
                )
                .join("");
            openModal(`
                <h2>Select Objective</h2>
                <p class="hint">Objective definitions are immutable during play. Create or edit authored objectives in the Story Builder; this control only changes which existing objective is tracked.</p>
                <label>
                    Existing objective
                    <select id="setObjectiveExisting">
                        <option value="__none__">No current objective</option>
                        ${objectiveOptions}
                    </select>
                </label>
                <div class="row" style="margin-top:.9rem">
                    <button class="primary" type="button" onclick="EmberAdventures.saveSetObjectiveModal()">Select Objective</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Cancel</button>
                </div>
            `);
        }

        function saveSetObjectiveModal() {
            const existingId = String($("setObjectiveExisting")?.value || "").trim();
            if (!existingId || existingId === "__none__") {
                clearCurrentObjective({ close: true });
                return;
            }
            const objective = (app.state.objectives?.items || []).find(
                (item) => String(item.id || "") === existingId,
            );
            if (!objective)
                return showNotice(
                    "Objective Not Found",
                    "Only an existing authored or generated-job objective can be selected.",
                );
            setObjectiveFocus(existingId, { renderAfter: false });
            syncSparseObjectiveRuntimeControls(app.state);
            scheduleActiveGameSave();
            closeModal();
            render();
        }

        function imageModelSelectOptionsHtml(selectedValue = "") {
            const selected = selectedImageModel(selectedValue);
            return imageModelOptions()
                .map(
                    (model) =>
                        `<option value="${escapeHtml(model.value)}" ${model.value === selected ? "selected" : ""}>${escapeHtml(model.label)}</option>`,
                )
                .join("");
        }

        function profileDefinitionImageModel(entity = {}) {
            return selectedProfileImageModel(
                entity?.image_prompt_config?.profile_style ||
                    entity?.image_prompt_config?.profile_image_style ||
                    entity?.default_profile_image?.style ||
                    "",
            );
        }

        function profileMutableImageModel(entity = {}) {
            const value =
                entity?.image?.profile_style ||
                entity?.image?.profile_image_style ||
                "";
            return value ? selectedProfileImageModel(value) : "";
        }

        function resolvedProfileImageModel(entity = {}, options = {}) {
            return selectedProfileImageModel(
                options.model ||
                    profileMutableImageModel(entity) ||
                    profileDefinitionImageModel(entity) ||
                    app.settings.defaultProfileImageModel ||
                    PROFILE_IMAGE_MODEL_DEFAULT,
            );
        }

        function setObjectiveFocus(objectiveId, options = {}) {
            app.state.objectives ||= { active_id: "", focus_id: "", items: [] };
            reconcileStoryRuntimeState(app.state, "objective selection");
            const objective = (app.state.objectives.items || []).find(
                (item) => String(item.id) === String(objectiveId),
            );
            if (!objective || !objectiveCanBeSelected(objective, app.state)) return;
            const locked = currentLockedObjective(app.state);
            if (locked && String(locked.id || "") !== String(objective.id || "")) {
                if (options.suppressNotice !== true)
                    showNotice(
                        "Objective Locked",
                        `Finish ${locked.title || locked.id} before switching objectives.`,
                    );
                return;
            }
            chooseObjectiveExclusiveBranch(objective, app.state);
            if (objectiveIsSide(objective)) {
                app.state.objectives.focus_id = objective.id;
            } else {
                app.state.objectives.active_id = objective.id;
                app.state.objectives.focus_id = "";
            }
            app.state.objectives.no_current = false;
            clearObjectiveChoiceState(app.state);
            reconcileStoryRuntimeState(app.state, "selected objective");
            scheduleActiveGameSave();
            if (options.close !== false) closeModal();
            if (options.renderAfter !== false) render();
        }

        function clearCurrentObjective(options = {}) {
            app.state.objectives ||= { active_id: "", focus_id: "", items: [] };
            const locked = currentLockedObjective(app.state);
            if (locked) {
                if (objectiveIsSide(locked)) {
                    app.state.objectives.focus_id = locked.id;
                } else {
                    app.state.objectives.active_id = locked.id;
                    app.state.objectives.focus_id = "";
                }
                app.state.objectives.no_current = false;
                if (options.close !== false) closeModal();
                if (options.renderAfter !== false) render();
                if (options.suppressNotice !== true)
                    showNotice(
                        "Objective Locked",
                        `Finish ${locked.title || locked.id} before clearing objectives.`,
                    );
                return;
            }
            app.state.objectives.active_id = "";
            app.state.objectives.focus_id = "";
            app.state.objectives.no_current = true;
            clearObjectiveChoiceState(app.state);
            reconcileStoryRuntimeState(app.state, "clear current objective");
            scheduleActiveGameSave();
            if (options.close !== false) closeModal();
            if (options.renderAfter !== false) render();
        }

        function choosePendingObjective(objectiveId) {
            const pendingReply = app.pendingObjectiveChoiceReply;
            if (!objectiveId) {
                clearCurrentObjective();
                if (pendingReply && !app.pendingObjectiveChoiceReply)
                    app.pendingObjectiveChoiceReply = pendingReply;
                resumePendingObjectiveChoiceReply("pending objective cleared");
                return;
            }
            setObjectiveFocus(objectiveId);
            if (pendingReply && !app.pendingObjectiveChoiceReply)
                app.pendingObjectiveChoiceReply = pendingReply;
            resumePendingObjectiveChoiceReply("pending objective selected");
        }

        function fallbackObjectiveChoiceCandidates(state = app.state, completedObjectiveId = "") {
            const completedId = String(completedObjectiveId || "");
            return visibleObjectiveChoices(state)
                .map(({ objective }) => objective)
                .filter(
                    (objective) =>
                        objective &&
                        String(objective.id || "") !== completedId &&
                        objectiveCanBeSelected(objective, state),
                );
        }

        function openDirectObjectiveChoiceModal() {
            const choices = currentDirectChoiceCandidates(app.state);
            if (!choices.length) return false;
            cancelDirectObjectiveChoiceAutoOpen();
            const currentText = $("input")?.value || "";
            app.directObjectiveChoiceCopiedText = currentText;
            const rows = choices
                .map((objective) => {
                    const locked = directObjectiveChoiceRequirementResults(objective).some(
                        (item) => !item.met,
                    );
                    return `
                        <div class="stat-card">
                            <div class="row" style="justify-content:space-between;align-items:flex-start">
                                <div>
                                    <div class="character-name">${escapeRuntimeTemplateText(objective.title || objective.id)}</div>
                                    ${objective.choice_response_mode === "exact_text" ? `<div class="hint" style="margin-top:.35rem"><q>${escapeRuntimeTemplateText(objective.player_text || "")}</q></div>` : ""}
                                    ${directObjectiveChoicePublicDetailsMarkup(objective)}
                                </div>
                                <button class="tool-button primary" type="button" ${locked ? "disabled" : ""} onclick="EmberAdventures.openDirectObjectiveChoiceResponseModal(${htmlJsArg(objective.id)})">
                                    <span class="tool-label">Choose</span>
                                </button>
                            </div>
                        </div>`;
                })
                .join("");
            openModal(`
                <h2>Choose</h2>
                <div class="stack" style="margin-top:.75rem">${rows}</div>
            `);
            return true;
        }

        function directObjectiveChoiceRequirementResults(choice = {}, state = app.state) {
            return storyRequirementResults(choice.requirements || [], state);
        }

        function compareRequirementValues(left, operator, right) {
            const numericLeft = Number(left);
            const numericRight = Number(right);
            const useNumbers = Number.isFinite(numericLeft) && Number.isFinite(numericRight);
            const a = useNumbers ? numericLeft : String(left ?? "");
            const b = useNumbers ? numericRight : String(right ?? "");
            switch (operator) {
                case ">":
                    return a > b;
                case ">=":
                    return a >= b;
                case "<":
                    return a < b;
                case "<=":
                    return a <= b;
                case "!=":
                case "!==":
                    return a !== b;
                case "=":
                case "==":
                case "===":
                    return a === b;
                default:
                    return false;
            }
        }

        function directObjectiveChoiceRequirementValue(pathText = "", state = app.state) {
            const path = String(pathText || "").trim();
            if (!path) return undefined;
            const relationshipMatch = path.match(/^(.+?)\s+(trust|attraction|affection)$/i);
            if (relationshipMatch) {
                const targetName = relationshipMatch[1].trim();
                const stat = relationshipMatch[2].toLowerCase();
                const entity =
                    state?.characters?.[targetName] ||
                    state?.npcs?.[targetName] ||
                    (String(state?.player?.name || "").toLowerCase() ===
                    targetName.toLowerCase()
                        ? state.player
                        : null);
                return entity?.relationships?.[stat] ?? entity?.[stat];
            }
            const normalized = path.includes(".")
                ? path
                : state?.story_inventory && Object.prototype.hasOwnProperty.call(state.story_inventory, path)
                  ? `story_inventory.${path}`
                  : path;
            return normalized.split(".").reduce((value, key) => value?.[key], state);
        }

        function directObjectiveChoiceRequirementMet(requirement = "", state = app.state) {
            const text = String(requirement || "").trim();
            const match = text.match(/^(.+?)\s*(>=|<=|!==|!=|===|==|=|>|<)\s*(.+)$/);
            if (!match) return false;
            const left = directObjectiveChoiceRequirementValue(match[1], state);
            const rightRaw = match[3].trim();
            const right =
                /^-?\d+(?:\.\d+)?$/.test(rightRaw)
                    ? Number(rightRaw)
                    : rightRaw.replace(/^["']|["']$/g, "");
            return compareRequirementValues(left, match[2], right);
        }

        function directObjectiveChoicePublicDetailsMarkup(choice = {}) {
            const rows = [];
            for (const item of directObjectiveChoiceRequirementResults(choice)) {
                rows.push(
                    `<li><span style="color:var(${item.met ? "--accent" : "--danger"})">${escapeHtml(item.label)}</span></li>`,
                );
            }
            const rewards = Array.isArray(choice.rewards) ? choice.rewards : [];
            for (const reward of rewards) {
                if (!isPlainObject(reward)) continue;
                const type = String(reward.type || "").trim();
                if (["add_item", "grant_item"].includes(type)) {
                    const item = textSlot(reward.item || reward.name || reward.title, "");
                    if (item) rows.push(`<li><span style="color:var(--accent)">${escapeHtml(item)} +1</span></li>`);
                }
                if (type === "remove_state_list_item" || type === "remove_item") {
                    const item = textSlot(reward.item || reward.name || reward.value, "");
                    if (item) rows.push(`<li><span style="color:var(--danger)">${escapeHtml(item)} -1</span></li>`);
                }
                if (type === "set_state_field") {
                    const path = Array.isArray(reward.field_path) ? reward.field_path.map(String) : [];
                    if (path[0] === "story_inventory") {
                        const label = path.slice(1).join(".");
                        if (label)
                            rows.push(`<li><span class="hint">${escapeHtml(label)} = ${escapeHtml(String(reward.value ?? ""))}</span></li>`);
                    }
                }
                if (type === "adjust_story_inventory") {
                    const label = textSlot(reward.path || reward.field || reward.currency, "coins").replace(/^story_inventory\./, "");
                    const amount = Number(reward.amount ?? reward.delta ?? reward.value ?? 0) || 0;
                    rows.push(`<li><span style="color:var(${amount >= 0 ? "--accent" : "--danger"})">${escapeHtml(label)} ${amount >= 0 ? "+" : ""}${escapeHtml(String(amount))}</span></li>`);
                }
                if (type === "add_story_item") {
                    const item = textSlot(reward.name || reward.title || reward.item, "");
                    if (item) rows.push(`<li><span style="color:var(--accent)">${escapeHtml(item)} +1</span></li>`);
                }
            }
            if (!rows.length) return "";
            return `<ul class="hint" style="margin:.45rem 0 0 1rem">${rows.join("")}</ul>`;
        }

        function openDirectObjectiveChoiceResponseModal(objectiveId) {
            const objective = currentDirectChoiceCandidates(app.state).find(
                (item) => String(item.id) === String(objectiveId),
            );
            if (!objective) {
                openDirectObjectiveChoiceModal();
                return false;
            }
            if (directObjectiveChoiceRequirementResults(objective).some((item) => !item.met)) {
                openDirectObjectiveChoiceModal();
                return false;
            }
            const composerText = $("input")?.value || "";
            const copiedText = composerText.trim()
                ? composerText
                : app.directObjectiveChoiceCopiedText != null
                  ? app.directObjectiveChoiceCopiedText
                  : composerText;
            const exactText =
                objective.choice_response_mode === "exact_text"
                    ? textSlot(objective.player_text, "")
                    : "";
            openModal(`
                <h2>${escapeRuntimeTemplateText(objective.title || "Choose")}</h2>
                ${directObjectiveChoicePublicDetailsMarkup(objective)}
                ${exactText ? `<div class="stat-card" style="margin-top:.75rem"><div class="hint">The player will say:</div><q>${escapeRuntimeTemplateText(exactText)}</q></div>` : `<textarea id="directObjectiveChoiceText" rows="6" placeholder="Optional response...">${escapeHtml(copiedText)}</textarea>`}
                <div class="row" style="margin-top:.9rem">
                    <button class="primary" type="button" onclick="EmberAdventures.confirmDirectObjectiveChoice(${htmlJsArg(objective.id)})">Confirm</button>
                    <button type="button" onclick="EmberAdventures.openDirectObjectiveChoiceModal()">Back</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `);
            const responseField = $("directObjectiveChoiceText");
            responseField?.addEventListener("keydown", (event) => {
                if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.isComposing ||
                    event.repeat
                )
                    return;
                event.preventDefault();
                if (responseField.dataset.submitting === "true") return;
                responseField.dataset.submitting = "true";
                responseField.__directObjectiveChoiceSubmitPromise =
                    submitDirectObjectiveChoice(objective.id, {
                        responseText: responseField.value || "",
                        closeModal: true,
                        autoMode: false,
                    }).finally(() => {
                        delete responseField.dataset.submitting;
                    });
            });
            responseField?.focus?.();
            return true;
        }

        function playerDeathStateLooksDead(state = app.state) {
            return deathStateLooksDead(entityDeathState(state?.player || {}));
        }

        function gameIsOver(state = app.state) {
            return !!state?.meta?.game_over || playerDeathStateLooksDead(state);
        }

        function markGameOver(details = {}) {
            app.state.meta ||= {};
            app.state.meta.game_over = true;
            app.state.meta.game_over_at = new Date().toISOString();
            app.state.meta.game_over_reason = textSlot(details.reason, "The game ended.");
            app.state.meta.game_over_objective_id = textSlot(details.objectiveId, "");
            app.state.meta.game_over_choice_id = textSlot(details.choiceId, "");
        }

        function gameEndedNoticeText() {
            return "The game has ended, you cannot send more messages.";
        }

        function addGameEndedBlockedMessage() {
            addGameMessage(gameEndedNoticeText(), "Game");
            setTurnStage("game_over", "Game Over");
            scheduleActiveGameSave();
            render();
        }

        function gameOverChatMessageText() {
            return "GAME OVER\n\nUse the choose-differently button on this message to return to change your last decision if you want to continue playing.";
        }

        function queueItemAllowedAfterGameOver(item = {}) {
            return String(item?.source || "").toLowerCase() === "game_over";
        }

        function buildGameOverReplyDirective({ objective, responseText = "" } = {}) {
            const playerName = playerNameForPrompt();
            const instruction = textSlot(
                objective?.completion_instruction ||
                    objective?.completion_criteria ||
                    objective?.summary,
                "",
            );
            return [
                "GAME OVER: Write the final in-scene narration for the fatal ending now.",
                `The player chose: ${objective?.title || objective?.id || "a fatal choice"}.`,
                responseText
                    ? `The player's written response for the choice was:\n${responseText}`
                    : "",
                instruction
                    ? `Fatal outcome guidance:\n${instruction}`
                    : "",
                `${playerName} dies here. Show the immediate scene-specific fatal consequence clearly. Do not continue the adventure, offer a next objective, ask what happens next, or describe rollback/UI controls. End with a clear Game Over beat.`,
            ]
                .map((item) => String(item || "").trim())
                .filter(Boolean)
                .join("\n\n");
        }

        function completeDirectObjectiveChoice(objectiveId, options = {}) {
            const objective = currentDirectChoiceCandidates(app.state).find(
                (item) => String(item.id) === String(objectiveId),
            );
            if (!objective || !objectiveIsDirectChoice(objective))
                throw new Error(`Direct choice objective is not available: ${objectiveId}`);
            if (!objectiveCompletionRequirementsMet(objective, app.state))
                throw new Error(
                    objectiveCompletionRequirementsText(
                        objective,
                        app.state,
                    ) || "The objective cannot be completed yet.",
                );
            const beforeState = objectiveDebugStateProjection(app.state);
            const objectiveTransaction = beginObjectiveMutationTransaction(
                app.state,
                `direct choice ${objective.id}`,
            );
            const parentObjectiveId = objective.parent_objective_id || objective.id;
            const parentObjective = (app.state.objectives?.items || []).find(
                (item) => String(item.id) === String(parentObjectiveId),
            );
            let completed = null;
            let rewardResult = null;
            let earlyRewardMessages = [];
            let earlyUnlockGreetings = [];
            try {
                if (objective.direct_choice_option && parentObjective) {
                    captureObjectiveMutationEntry(app.state, parentObjective);
                    parentObjective.selected_choice_id = objective.id;
                    parentObjective.selected_choice_title = objective.title || objective.id;
                }
                const previousRewardMessageBuffer = app.objectiveRewardMessageBuffer;
                const previousUnlockGreetingBuffer = app.objectiveUnlockGreetingBuffer;
                app.objectiveRewardMessageBuffer = [];
                app.objectiveUnlockGreetingBuffer = [];
                try {
                    const groups = objectiveRewardApplicationGroups(
                        parentObjective || objective,
                        app.state,
                    );
                    applyRewardApplicationGroupsAtomically(
                        app.state,
                        groups,
                        "direct choice",
                        {
                            applyRewardsBeforeBaseEffects: true,
                            reportFailure: options.reportFailure !== false,
                            applyBaseEffects: () => {
                                completed = completeCurrentObjective(
                                    app.state,
                                    parentObjectiveId,
                                );
                                if (!completed)
                                    throw new Error(
                                        `Direct choice objective could not be completed: ${objectiveId}`,
                                    );
                                rewardResult = applyObjectiveProgressRewards(
                                    beforeState,
                                    app.state,
                                    "objective",
                                    { silentGameMessage: true },
                                );
                            },
                            baseEffectsCountAsApplied: true,
                        },
                    );
                    earlyRewardMessages = [
                        ...(app.objectiveRewardMessageBuffer || []),
                    ];
                    earlyUnlockGreetings = [
                        ...(app.objectiveUnlockGreetingBuffer || []),
                    ];
                } finally {
                    app.objectiveRewardMessageBuffer = previousRewardMessageBuffer;
                    app.objectiveUnlockGreetingBuffer = previousUnlockGreetingBuffer;
                }
                if (!completed)
                    throw new Error(`Direct choice objective could not be completed: ${objectiveId}`);
                if (earlyRewardMessages.length || earlyUnlockGreetings.length) {
                    rewardResult ||= {
                        applied: true,
                        message: "",
                        completedRewardApplied: true,
                        timedEventsApplied: false,
                        storyTimelineApplied: false,
                        rewardOnlyApplied: false,
                        rewardMessages: [],
                        unlockGreetings: [],
                    };
                    rewardResult.completedRewardApplied = true;
                    rewardResult.rewardMessages = [
                        ...earlyRewardMessages,
                        ...(rewardResult.rewardMessages || []),
                    ];
                    rewardResult.unlockGreetings = [
                        ...earlyUnlockGreetings,
                        ...(rewardResult.unlockGreetings || []),
                    ];
                }
                assertRuntimeObjectivesAndProgression(app.state);
                finishObjectiveMutationTransaction(objectiveTransaction, true);
            } catch (error) {
                // A direct choice must be all-or-nothing without cloning the complete game.
                // Restore only objective runtime entries/control fields touched by the choice;
                // reward application already restores its affected aggregate roots atomically.
                finishObjectiveMutationTransaction(objectiveTransaction, false);
                throw error;
            }
            const gameMessage = objective.direct_choice_option
                ? objectiveCompletionMessage(objective) ||
                    objectiveCompletionGameMessage(completed, rewardResult)
                : objectiveCompletionGameMessage(completed, rewardResult);
            scheduleActiveGameSave();
            return {
                checked: true,
                source: "choice",
                completionControl: "choice",
                completed: clone(completed),
                rewardResult: clone(rewardResult || {}),
                objectiveGameMessage: gameMessage,
                deferObjectiveModals: true,
            };
        }

        async function submitDirectObjectiveChoice(objectiveId, options = {}) {
            if (app.directObjectiveChoiceSubmissionInProgress) return false;
            let responseText = formatComposerText(
                String(options.responseText ?? "").trim(),
            );
            const objective = currentDirectChoiceCandidates(app.state).find(
                (item) => String(item.id) === String(objectiveId),
            );
            if (!objective) {
                await showNotice("Choice Unavailable", "That choice is no longer available.");
                return false;
            }
            if (!directObjectiveChoiceIsSelectable(objective)) {
                await showNotice("Choice Locked", "That choice is not currently available.");
                return false;
            }
            if (objective.choice_response_mode === "exact_text")
                responseText = formatComposerText(
                    textSlot(objective.player_text, ""),
                );
            const closeImmediately = options.closeModal !== false && !options.autoMode;
            const timingStarted = perfNow();
            app.directObjectiveChoiceSubmissionInProgress = true;
            app.directObjectiveChoiceCopiedText = responseText;
            if (closeImmediately) {
                closeModal();
                setTurnStage("objective", "Applying choice...");
                await waitForRenderedFrame();
            }
            const snapshotStarted = perfNow();
            let result = null;
            let choiceSnapshot = null;
            try {
                choiceSnapshot = snapshotState("before direct objective choice", {
                    type: "direct_objective_choice",
                    objectiveId: objective.id,
                    objectiveTitle: objective.title || objective.id,
                    parentObjectiveId: objective.parent_objective_id || objective.id,
                });
                const completionStarted = perfNow();
                result = completeDirectObjectiveChoice(objective.id);
                stateTrace("direct objective choice committed", {
                    label: "objective",
                    objectiveId: objective.id,
                    snapshotMs: Math.round(completionStarted - snapshotStarted),
                    completionMs: Math.round(perfNow() - completionStarted),
                    elapsedMs: Math.round(perfNow() - timingStarted),
                    summary: "The selected choice was committed and queued for narration.",
                });
            } catch (err) {
                if (choiceSnapshot?.id) {
                    discardRollbackSnapshot(choiceSnapshot.id);
                }
                app.directObjectiveChoiceSubmissionInProgress = false;
                await showNotice("Choice Failed", err.message || String(err));
                if (closeImmediately) {
                    openDirectObjectiveChoiceResponseModal(objective.id);
                    const responseField = $("directObjectiveChoiceText");
                    if (responseField) responseField.value = responseText;
                }
                return false;
            }
            app.directObjectiveChoiceSubmissionInProgress = false;
            if ($("input")) {
                $("input").value = "";
                resizeComposerInput();
            }
            if (options.closeModal !== false && !closeImmediately) closeModal();
            if (playerDeathStateLooksDead(app.state)) {
                app.queue = [];
                markGameOver({
                    reason:
                        objectiveCompletionMessage(objective) ||
                        result?.objectiveGameMessage ||
                        objective?.title ||
                        "The player died.",
                    objectiveId: objective.parent_objective_id || objective.id,
                    choiceId: objective.id,
                });
                addGameMessage(
                    gameOverChatMessageText(),
                    "Game",
                    {
                        choiceSnapshotId: choiceSnapshot?.id || "",
                        choiceObjectiveId: objective.id,
                        choiceTitle: objective.title || objective.id,
                    },
                );
                app.queue.push({
                    text: "Game Over",
                    visibleText: "",
                    skipUserStateCheck: true,
                    commandOnly: false,
                    directive: buildGameOverReplyDirective({
                        objective,
                        responseText,
                    }),
                    source: "game_over",
                    speaker: "",
                    autoRead: false,
                    objectiveResult: result,
                });
                setTurnStage("game_over", "Game Over");
                scheduleActiveGameSave();
                render();
                if (!queueProcessingBlocked()) setTimeout(() => processQueue(), 0);
                return true;
            }
            const directive = [
                `${playerNameForPrompt()} chose: ${objective.title || objective.id}.`,
                responseText
                    ? "Use the player's written response as the visible action/dialogue for this choice."
                    : "The player did not add a written response; continue from the chosen path without inventing extra player speech.",
            ].join(" ");
            if (responseText) {
                app.queue.push({
                    text: responseText,
                    visibleText: responseText,
                    skipUserStateCheck: false,
                    commandOnly: false,
                    directive,
                    source: "choice",
                    speaker: app.state.player?.name || "Player",
                    autoRead: !!app.settings.autoReadPlayerMessages,
                    autoTurn: !!options.autoMode,
                    objectiveResult: result,
                    choiceSnapshotId: choiceSnapshot?.id || "",
                    choiceObjectiveId: objective.id,
                    choiceTitle: objective.title || objective.id,
                });
            } else {
                addGameMessage(`Choice: ${objective.title || objective.id}`, "Game", {
                    autoRead: false,
                    choiceSnapshotId: choiceSnapshot?.id || "",
                    choiceObjectiveId: objective.id,
                    choiceTitle: objective.title || objective.id,
                });
                app.queue.push({
                    text: `Choice: ${objective.title || objective.id}`,
                    visibleText: "",
                    skipUserStateCheck: true,
                    commandOnly: false,
                    directive,
                    source: "choice_continue",
                    speaker: "",
                    autoRead: false,
                    autoTurn: !!options.autoMode,
                    objectiveResult: result,
                    choiceSnapshotId: choiceSnapshot?.id || "",
                    choiceObjectiveId: objective.id,
                    choiceTitle: objective.title || objective.id,
                });
            }
            setTurnStage("reply", "Writing scene reply...");
            render();
            if (!queueProcessingBlocked()) {
                if (options.autoMode) await processQueue();
                else setTimeout(() => processQueue(), 0);
            }
            return true;
        }

        function resumePendingObjectiveChoiceReply(reason = "objective choice resolved") {
            const pending = app.pendingObjectiveChoiceReply;
            if (!pending?.queueItem) return false;
            // Branch-choice rule: when player-controlled objective completion
            // opens an objective picker, the narrator reply waits. After the
            // player selects the next objective, resume the same player turn
            // without adding a duplicate player message or rerunning completed
            // player-objective checks.
            app.pendingObjectiveChoiceReply = null;
            app.queue.unshift({
                ...pending.queueItem,
                objectiveResult: pending.objectiveResult || null,
                resumeAfterObjectiveChoice: true,
            });
            closeModal();
            scheduleActiveGameSave();
            render();
            setStatus(`Objective selected; resuming scene reply.`);
            stateTrace("objective choice reply resumed", {
                label: "objective",
                reason,
                completedCount:
                    pending.objectiveResult?.completedResults?.length || 0,
                summary: "Resuming narrator reply after objective choice.",
            });
            setTimeout(() => {
                if (!app.busy && app.queue.length) processQueue();
            }, 0);
            return true;
        }

        function maybeOpenObjectiveChoiceModal() {
            const choice = app.state.objectives?.pending_choice;
            const ids = Array.isArray(choice?.objective_ids) ? choice.objective_ids : [];
            const choices = ids
                .map((id) =>
                    (app.state.objectives?.items || []).find(
                        (item) => String(item.id) === String(id),
                    ),
                )
                .filter((item) => item && objectiveCanBeSelected(item, app.state));
            if (!choices.length) return false;
            if (beginAutoPendingObjectiveChoice("pending objective choice")) return true;
            if (mainModalOpen()) return false;
            if (choices.every((item) => objectiveIsDirectChoice(item)))
                return scheduleDirectObjectiveChoiceAutoOpen(
                    "pending objective choice",
                    app.activeVoiceMessageId,
                );
            const rows = choices
                .map(
                    (objective) => `
                        <div class="stat-card">
                            <div class="row" style="justify-content:space-between;align-items:flex-start">
                                <div>
                                    <div class="character-name">${escapeRuntimeTemplateText(objective.title || objective.id)}</div>
                                    <div class="hint">${escapeHtml(objectiveIsSide(objective) ? "Side objective" : "Main story")} / ${escapeHtml(effectiveObjectiveStatus(objective, app.state) || "queued")}</div>
                                </div>
                                <button class="tool-button primary" type="button" onclick="EmberAdventures.choosePendingObjective(${htmlJsArg(objective.id)})">Select</button>
                            </div>
                            <div class="hint" style="margin-top:.45rem">${escapeRuntimeTemplateText(objectiveDisplayGoal(objective) || "")}</div>
                        </div>`,
                )
                .join("");
            openModal(`
                <h2>Choose Next Objective</h2>
                <p class="hint">${escapeHtml(choice.message || "Choose one objective to make it the current AI target, or intentionally continue with no selected objective.")}</p>
                <div class="stack" style="margin-top:.75rem">${rows}</div>
                <div class="row" style="margin-top:.9rem">
                    <button type="button" onclick="EmberAdventures.choosePendingObjective('')">Continue With No Objective</button>
                </div>
            `);
            return true;
        }

        function pendingObjectiveSelectionCandidates(state = app.state) {
            const choice = state?.objectives?.pending_choice;
            const ids = Array.isArray(choice?.objective_ids) ? choice.objective_ids : [];
            return ids
                .map((id) =>
                    (state?.objectives?.items || []).find(
                        (item) => String(item.id) === String(id),
                    ),
                )
                .filter((item) => item && objectiveCanBeSelected(item, state));
        }

        function autoPendingObjectiveChoicePromptChoices(state = app.state) {
            return pendingObjectiveSelectionCandidates(state)
                .filter((item) => !objectiveIsDirectChoice(item))
                .map((objective, index) => ({
                    id: objective.id,
                    title: objective.title || objective.id,
                    summary: objective.summary || objectiveDisplayGoal(objective) || "",
                    kind: objectiveIsSide(objective) ? "side" : "main",
                    order: index + 1,
                }));
        }

        function buildAutoPendingObjectiveChoicePrompt(state = app.state) {
            const playerName = playerNameForPrompt();
            const stateContext = compactJson(buildAutoPlayerTurnStateContext());
            const syncedChatContext =
                promptStateSyncRangeText(syncedConversationContextForPrompt(6), state) || "#";
            const unsyncedChatContext =
                promptStateSyncRangeText(pendingStateSyncMessages(), state) || "#";
            const choiceContext = compactJson(autoPendingObjectiveChoicePromptChoices(state));
            return withUniversalAiPromptContext(
                `You are playing EmberAdventures for the player in automatic mode.
Choose which available objective ${playerName} should pursue next.

Use ${playerName}'s saved personality, known facts, relationships, current state, recent actions, and user guidance. Choose the route that best follows what the player has actually been doing and what they could reasonably know. Do not use hidden rewards, future spoilers, author-only notes, or route order as decision evidence. Main and side objectives are both valid when they fit the player's behavior.

Return ONLY compact JSON:
{"id":"objective_id"}

Rules:
- id must exactly match one available objective id.
- You must choose one of the listed objectives.
- Do not choose by list position or assume the first route is preferred.

AVAILABLE OBJECTIVES:
${choiceContext}

STATE ACCESSIBLE TO THE PLAYER:
${stateContext}

CHAT ALREADY INCLUDED IN STATE, PROVIDED ONLY FOR CONVERSATION CONTEXT:
${syncedChatContext}

CHAT SINCE STATE WAS LAST UPDATED:
${unsyncedChatContext}`,
                { includeStoryRules: false },
            );
        }

        async function chooseAutoPendingObjectiveWithAi(state = app.state) {
            const choices = pendingObjectiveSelectionCandidates(state).filter(
                (item) => !objectiveIsDirectChoice(item),
            );
            if (!choices.length)
                throw new Error("No selectable pending objective was available.");
            if (choices.length === 1) return choices[0];
            const raw = await aiText(buildAutoPendingObjectiveChoicePrompt(state), {
                label: "auto pending objective choice",
                process: "auto objective",
                type: "objective",
                throttleKey: "auto-pending-objective-choice",
                stopSequences: ["\n\n"],
            });
            const data = parseJsonObject(raw) || parsePartialTopLevelJsonObject(raw) || {};
            const selectedId = String(data.id || data.objective_id || data.choice || "").trim();
            const objective = choices.find((item) => String(item.id) === selectedId);
            if (!objective) {
                throw new Error(
                    selectedId
                        ? `AI returned invalid objective id: ${selectedId}`
                        : "AI did not return an objective id.",
                );
            }
            return objective;
        }

        async function runAutoPendingObjectiveChoice(reason = "auto") {
            const objective = await chooseAutoPendingObjectiveWithAi(app.state);
            stateTrace("auto pending objective selected", {
                label: "objective",
                reason,
                objectiveId: objective.id,
                objectiveTitle: objective.title || objective.id,
                choices: autoPendingObjectiveChoicePromptChoices(app.state),
                summary: "AI selected the next objective for automatic mode.",
            });
            choosePendingObjective(objective.id);
            return true;
        }

        function beginAutoPendingObjectiveChoice(reason = "auto") {
            if (!app.settings.autoVisualNovel) return false;
            if (!autoModeCompletesObjectivesEnabled()) return false;
            if (!app.state.objectives?.pending_choice) return false;
            if (pendingObjectiveChoiceIsDirect(app.state)) return false;
            if (app.autoPendingObjectiveChoiceInProgress) return true;
            if (mainModalOpen()) return false;
            if (!autoPendingObjectiveChoicePromptChoices(app.state).length) return false;
            app.autoPendingObjectiveChoiceInProgress = true;
            setTurnStage("objective", "Choosing next objective...");
            runAutoPendingObjectiveChoice(reason)
                .catch((err) => {
                    stateTrace("auto pending objective choice failed", {
                        label: "objective",
                        reason,
                        error: err?.message || String(err),
                        summary: err?.message || String(err),
                    });
                    addMessage(
                        "system",
                        "Auto objective choice failed: " + (err?.message || String(err)),
                    );
                    setTurnStage("error", "Auto objective choice failed");
                    render();
                })
                .finally(() => {
                    app.autoPendingObjectiveChoiceInProgress = false;
                });
            return true;
        }

        function maybeOpenObjectiveCompletionModal() {
            const pending = app.state.objectives?.pending_completion_message;
            if (!pending?.message) return false;

            if (mainModalOpen()) return false;
            const title = resolveRuntimeMessageTemplateText(pending.title || "Story Complete", app.state);
            const message = resolveRuntimeMessageTemplateText(pending.message, app.state);
            openModal("", { title });
            const paragraph = document.createElement("p");
            paragraph.textContent = message;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "primary";
            button.textContent = "OK";
            button.onclick = acknowledgeObjectiveCompletion;
            $("modalBox").append(paragraph, button);
            return true;
        }

        function acknowledgeObjectiveCompletion() {
            if (app.state.objectives) delete app.state.objectives.pending_completion_message;
            scheduleActiveGameSave();
            closeModal();
            render();
        }

        function formatObjectiveSteps(objective) {
            return "";
        }

        function formatSkills(skills) {
            return "";
        }

        function renderQuickActions() {
            let quickActions = $("quickActions");
            if (gameIsOver()) {
                quickActions.innerHTML = `
                <button type="button" class="tool-button" disabled aria-label="Game Over"><span class="tool-icon">&#9632;</span><span class="tool-label">Game Over</span></button>
                <button type="button" class="tool-button" disabled aria-label="Game Over"><span class="tool-icon">&#9632;</span><span class="tool-label">Game Over</span></button>
                <button type="button" class="tool-button reduced-ui-chat-hidden" disabled aria-label="Game Over"><span class="tool-icon">&#9632;</span><span class="tool-label">Game Over</span></button>
                <button type="button" class="tool-button reduced-ui-chat-hidden" disabled aria-label="Game Over"><span class="tool-icon">&#9632;</span><span class="tool-label">Game Over</span></button>
                <button id="voicePauseBtn" class="tool-button icon-only hidden" type="button" aria-label="Pause voice" data-help="Pause or resume the current voice playback." onclick="EmberAdventures.toggleVoicePause()"><span class="tool-icon">&#9208;</span></button>
            `;
                return;
            }
            const autoClass = app.settings.autoVisualNovel
                ? "tool-button success is-on"
                : "tool-button is-off";
            const autoTitle = app.settings.autoVisualNovel
                ? "Auto visual novel is on. Click to stop automatic next turns."
                : "Auto visual novel is off. Click to let the AI continue scenes automatically.";

            const suggestionButtons = (app.contextualSuggestions || [])
                .map(
                    (item, index) =>
                        `<button type="button" class="tool-button ${item.tone || ""}" aria-label="${escapeHtml(item.title || item.text || item.label || "Suggested action")}" data-help="${escapeHtml(item.title || item.text || item.label || "Suggested action")}" data-contextual-suggestion="${index}"><span class="tool-icon">${item.icon || "&#8227;"}</span><span class="tool-label">${escapeHtml(item.label)}</span></button>`,
                )
                .join("");
            quickActions.innerHTML = `
                <button type="button" class="tool-button warn reduced-ui-chat-hidden" aria-label="Send an instruction directly to the AI to update game state" data-help="Send an instruction directly to the AI to update game state." onclick="EmberAdventures.openAiCommandModal()"><span class="tool-icon">&#129302;</span><span class="tool-label">AI Command</span></button>
                <button class="tool-button primary" type="button" aria-label="Continue: passively observe the scene without taking action" data-help="Passively observe the scene without taking action." onclick="EmberAdventures.continueScene()"><span class="tool-icon">&#9654;</span><span class="tool-label">Continue</span></button>
                <button class="${autoClass}" type="button" aria-label="${escapeHtml(autoTitle)}" data-help="Toggle to have AI take turns for you." aria-pressed="${app.settings.autoVisualNovel ? "true" : "false"}" onclick="EmberAdventures.toggleAutoVisualNovel()"><span class="tool-icon">&#9193;</span><span class="tool-label">Auto</span></button>
                <button class="tool-button reduced-ui-chat-hidden" type="button" aria-label="Roll a d20 and submit the result" data-help="Roll a d20 and submit the result." onclick="EmberAdventures.rollD20()"><span class="tool-icon">&#9856;</span><span class="tool-label">Roll d20</span></button>

                <button class="tool-button reduced-ui-chat-hidden" type="button" aria-label="Find someone nearby or in the current city" data-help="Find someone nearby or in the current city." onclick="EmberAdventures.openFindCharacterModal()"><span class="tool-icon">&#128269;</span><span class="tool-label">Find</span></button>

                ${suggestionButtons}
                <button id="voicePauseBtn" class="tool-button icon-only hidden" type="button" aria-label="Pause voice" data-help="Pause or resume the current voice playback." onclick="EmberAdventures.toggleVoicePause()"><span class="tool-icon">&#9208;</span></button>
            `;
            quickActions
                .querySelectorAll("[data-contextual-suggestion]")
                .forEach((button) => {
                    button.onclick = () => {
                        const item =
                            app.contextualSuggestions?.[
                                Number(button.dataset.contextualSuggestion)
                            ];
                        if (!item) return;
                        quick(item.text, item.mode || "act");
                    };
                });
        }

        function quick(text, mode = "") {
            if (text === "roll a d20") {
                rollD20();
                return;
            }

            if (mode) app.settings.composerMode = exactComposerMode(mode);
            scheduleActiveGameSave();
            $("input").value = text;
            $("input").focus?.();
            renderComposerGuidance();
        }

        async function rollD20() {
            if (gameIsOver()) {
                addGameEndedBlockedMessage();
                return;
            }
            const prompt = await showPrompt(
                "Roll d20",
                "What is this roll trying to decide?",
                "",
                {
                    rows: 4,
                    submitText: "Roll",
                },
            );
            if (prompt == null) return;
            return submitD20Roll(prompt);
        }

        function d20RollDirective(result, prompt = "") {
            const intent = String(prompt || "").trim();
            const intentBlock = intent
                ? `\n\nROLL INTENT:\n${intent}`
                : "";
            return `The player is invoking a d20 game-mechanic roll to resolve a specific uncertain outcome. This is not an in-world spoken action and should not be described as physically rolling dice unless the scene already involves dice.${intentBlock}

D20 RESULT:
${result}/20

Use the player's roll intent as the primary thing being resolved. Interpret the result like a Dungeons & Dragons style d20 check: very low rolls create failure, a serious complication, or success at a meaningful cost; middling rolls create partial success, tradeoffs, or an unstable outcome; high rolls create strong success with fewer costs; a natural 20 should feel especially favorable without breaking established facts. Preserve player agency: resolve consequences around the attempted outcome, but do not make the player take extra actions they did not choose. Keep the result grounded in the current scene, character abilities, danger level, and recent context.`;
        }

        function submitD20Roll(prompt = "") {
            if (gameIsOver()) {
                addGameEndedBlockedMessage();
                return;
            }
            const result = Math.floor(Math.random() * 20) + 1;
            const intent = String(prompt || "").trim();
            const visibleText = intent
                ? `D20 roll: ${result}/20\n${intent}`
                : `D20 roll: ${result}/20`;
            // Player action tools must enter the same story queue path as normal
            // chat messages. Pre-creating a command message here skips objective
            // checks and lets background state work get ahead of the player turn.
            app.queue.push({
                text: visibleText,
                visibleText,
                skipUserStateCheck: false,
                commandOnly: false,
                directive: d20RollDirective(result, intent),
                source: "d20",
                speaker: app.state.player?.name || "Player",
                autoRead: !!app.settings.autoReadPlayerMessages,
            });
            render();
            if (!queueProcessingBlocked()) return processQueue();
            return false;
        }





















































































































        function togglePresence(name) {
            const targetName = resolveEntityName(
                name,
                app.state,
                String(name || "").trim(),
            );
            if (!targetName || isPlayerEntityName(targetName, app.state)) return;
            app.state.scene ||= {};
            const wasPresent = (app.state.scene.party_members_present || []).includes(
                targetName,
            );
            app.state.scene.party_members_present = toggleNameInList(
                app.state.scene.party_members_present,
                targetName,
            );
            const isPresent = app.state.scene.party_members_present.includes(targetName);
            if (wasPresent && !isPresent) {
                app.state.scene.image_characters = (
                    app.state.scene.image_characters || []
                ).filter((item) => item !== targetName);
            }
            if (!app.state.scene.party_members_present.length)
                app.state.scene.party_members_present = ["Player"];
            // Only normalize the scene presence and image lists touched by this action.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeSceneReferences(app.state);
            scheduleActiveGameSave();
            if (!wasPresent && isPresent)
                queueProfileImageIfMissing(targetName, "entered scene");
            render();
            if (wasPresent && !isPresent)
                cleanupRemovedCharacterReferences(targetName, "scene");
        }

        function toggleImageTarget(name) {
            app.state.scene ||= {};
            const resolvedName = resolveEntityName(
                name,
                app.state,
                String(name || "").trim(),
            );
            const targetName = isPlayerEntityName(resolvedName, app.state)
                ? playerEntityDisplayName(app.state)
                : resolvedName;
            if (!targetName) return;
            const wasImageTarget = (
                app.state.scene.image_characters || []
            ).includes(targetName);
            const entity = imageEntityFromState(targetName, app.state);
            const isPresent =
                isPlayerEntityName(targetName, app.state) ||
                [
                    ...(app.state.scene.party_members_present || []),
                    ...(app.state.scene.npcs_present || []),
                ].includes(targetName);
            if (!wasImageTarget && !isPresent) {
                showNotice(
                    "Character Not Present",
                    `${targetName} must be present in the scene before they can be included in images.`,
                );
                return;
            }
            if (!wasImageTarget && !entity) {
                showNotice(
                    "Inspect NPC First",
                    `${targetName} needs a full inspected character profile before they can be included in images.`,
                );
                return;
            }
            app.state.scene.image_characters = toggleNameInList(
                app.state.scene.image_characters,
                targetName,
            );
            app.lastImageSignature = "";
            // SANITIZE REPLACED: image-target toggle must only update scene.image_characters; full sanitize can rewrite profile images and re-add Player.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeSceneReferences(app.state);
            scheduleActiveGameSave();
            render();
            if (
                targetName !== playerEntityDisplayName(app.state) &&
                wasImageTarget &&
                    !(app.state.scene.image_characters || []).includes(targetName)
            )
                cleanupRemovedCharacterReferences(targetName, "image");
        }

        function toggleNameInList(list, name) {
            const values = Array.isArray(list) ? [...new Set(list)] : [];
            return values.includes(name)
                ? values.filter((item) => item !== name)
                : [...values, name];
        }

        function captureProfileState(name) {
            const entity = profileEntity(name);
            if (!entity) return null;
            return {
                    profile_image_id: entity.profile_image_id || "",
                    profile_images: clone(entity.profile_images || []).filter(
                        (image) => !image.pending,
                    ),
                };
            }

        function restoreProfileState(name, profileState) {
            if (!profileState) return;
            const entity = profileEntity(name);
            if (!entity) return;
            entity.profile_images = clone(profileState.profile_images || []);
            entity.profile_image_id = profileState.profile_image_id || "";
        }

        function imageGenerationActive() {
            return !!(
                app.activeImageRequests?.size ||
                app.activeProfileImageRequests?.size ||
                app.profileImageGenerating?.size
            );
        }

        function queuePresenceCleanup(name, scope = "scene") {
            if (!name || name === "Player") return;
            app.pendingPresenceCleanup ||= [];
            const normalized = normalizeNameForMatch(name);
            const alreadyQueued = app.pendingPresenceCleanup.some(
                (item) =>
                    normalizeNameForMatch(item.name) === normalized &&
                    String(item.scope || "scene") === String(scope || "scene"),
            );
            if (!alreadyQueued)
                app.pendingPresenceCleanup.push({ name, scope: scope || "scene" });
        }

        function runPendingPresenceCleanupIfIdle() {
            if (app.presenceCleanupRunning || imageGenerationActive()) return;
            const next = app.pendingPresenceCleanup?.shift?.();
            if (!next) return;
            cleanupRemovedCharacterReferences(next.name, next.scope);
        }

        async function cleanupRemovedCharacterReferences(name, scope = "scene") {
            if (!name || name === "Player" || app.presenceCleanupRunning) return;
            if (imageGenerationActive()) {
                queuePresenceCleanup(name, scope);
                return;
            }
            app.presenceCleanupRunning = true;
            const beforeProfileState = captureProfileState(name);
            const removedNormalized = normalizeNameForMatch(name);
            const stripRemovedFromSceneLists = () => {
                app.state.scene ||= {};
                // Image-target removal is not scene removal. It may clean visual
                // wording, but must not remove the character from scene, nearby,
                // or speak lists.
                const keys =
                    scope === "image"
                        ? ["image_characters"]
                        : [
                              "party_members_present",
                              "image_characters",
                              "npcs_present",
                          ];
                for (const key of keys) {
                    app.state.scene[key] = (app.state.scene[key] || []).filter(
                        (item) => normalizeNameForMatch(item) !== removedNormalized,
                    );
                }
                assertRuntimeSceneReferences(app.state);
            };
            const label = `${scope} character removal cleanup`;
            if (scope === "image") {
                stripRemovedFromSceneLists();
                restoreProfileState(name, beforeProfileState);
                app.lastImageSignature = "";
                scheduleActiveGameSave();
                stateTrace("presence cleanup skipped ai", {
                    label,
                    removed: name,
                    scope,
                    summary: `Removed ${name} from image targets without AI cleanup.`,
                });
                app.presenceCleanupRunning = false;
                runPendingPresenceCleanupIfIdle();
                return;
            }
            const cleanupBase = clone(app.state);
            const context = buildPresenceCleanupContext(name, scope);
            const instruction = `You are cleaning EmberAdventures state after a player removed a character from ${scope === "image" ? "the image target list" : "the scene"}.
Output ONLY minified structured JSON ops or {}. No markdown.

Use only this shape:
{"s":[{"path":["path","parts"],"value":"value"}],"n":[{"path":["path","parts"]}],"a":[{"path":["path","parts"],"value":"value"}]}
Only include changed paths. Prefer 0 to 4 ops. If no cleanup is needed, return {} exactly.
Allowed path roots: scene, party_members, player, recent_changes.

Removed character: ${name}
Cleanup scope: ${scope}

Rules:
- Do not add the removed character back to scene.party_members_present, scene.image_characters, or any image/action slot.
- If scope is "scene", remove or rewrite mentions of the removed party member from scene summary/objective/image_action and from present party members' pose, state_of_mind, physical_state, relationship_to_player, held_items, clothing, and known_facts if they imply the removed party member is physically present.
- If scope is "image", remove or rewrite visual references to the removed character from image_action, poses, held_items, clothing, and visual descriptions. Non-visual memories can remain.
- Keep all remaining present party members coherent.
- Clothing slots are hard state slots. Allowed clothing slots only: ${validClothingSlots().join(", ")}. Do not invent keys.

CURRENT RELEVANT STATE:
${compactStateText(context)}

JSON PATCH:`;

            try {
                setStatus("Cleaning scene references...");
                const cleanupAiOptions = { label };
                stateTrace("presence cleanup started", {
                    label,
                    removed: name,
                    scope,
                    ...finalAiPromptLogDetails(instruction, cleanupAiOptions),
                    summary: `Checking stale ${scope} references for ${name}.`,
                });
                const raw = await aiText(instruction, {
                    ...cleanupAiOptions,
                    nonCriticalFailure: true,
                    startWith: "{",
                    hideStartWith: false,
                });
                stateTrace("presence cleanup response", {
                    label,
                    response: raw,
                    summary: `Cleanup AI returned ${String(raw || "").length} chars.`,
                });
                const parsed = parseCompactAiPatch(raw, cleanupBase, [], {
                    requireOperations: true,
                });
                const patch = parsed.valid ? parsed.patch : {};
                if (!parsed.valid || isEmptyPatch(patch)) {
                    stateTrace("presence cleanup no changes", {
                        label,
                        summary: parsed.valid
                            ? "No stale references found."
                            : `Cleanup patch rejected: ${parsed.errors.join("; ")}`,
                    });
                    return;
                }
                app.state = applyStatePatch(cleanupBase, patch, {
                    source: `${scope} cleanup`,
                    currentState: app.state,
                });
                stripRemovedFromSceneLists();
                restoreProfileState(name, beforeProfileState);
                assertRuntimeSceneReferences(app.state);
                assertRuntimeNpcReferences(app.state);
                assertRuntimeObjectivesAndProgression(app.state);
                app.lastImageSignature = "";
                scheduleActiveGameSave();
                render();
                stateTrace("presence cleanup applied", {
                    label,
                    patch,
                    summary: `Applied stale-reference cleanup for ${name}.`,
                });
            } catch (err) {
                log("Presence cleanup failed", err.message || err, {
                    type: "state",
                    level: "warning",
                });
                stateTrace("presence cleanup failed", {
                    label,
                    error: err.message || String(err),
                    summary: err.message || String(err),
                });
            } finally {
                app.presenceCleanupRunning = false;
                setStatus("Ready");
                runPendingPresenceCleanupIfIdle();
            }
        }

        function buildPresenceCleanupContext(removedName, scope) {
            const presentNames = [
                ...new Set([
                    "Player",
                    ...(app.state.scene?.party_members_present || []),
                    ...(app.state.scene?.image_characters || []),
                ]),
            ];
            const partyMembers = {};
            for (const name of presentNames) {
                if (name === "Player") continue;
                const c = app.state.characters?.[name];
                if (!c) continue;
                partyMembers[name] = {
                    role: c.role,
                    relationship_to_player: c.relationship_to_player,
                    state_of_mind: c.state_of_mind,
                    physical_state: c.physical_state,
                    pose: c.pose,
                    clothing: c.clothing,
                    held_items: c.held_items,
                    appearance: c.appearance,
                    ...promptKnownFactFields(c, 6),
                };
            }

            return {
                scope,
                removedName,
                location: app.state.location,
                scene: app.state.scene,
                player: {
                    name: app.state.player?.name,
                    role: app.state.player?.role,
                    pose: app.state.player?.pose,
                    clothing: app.state.player?.clothing,
                    held_items: app.state.player?.held_items,
                    appearance: app.state.player?.appearance,
                },
                party_members: partyMembers,
            };
        }



        function currentMapLocation() {
            const map = app.state.world_map || {};
            return map.locations?.[map.current_location_id] || null;
        }

        function mapLocation(id) {
            return app.state.world_map?.locations?.[safeMapId(id)] || null;
        }

        function mapChildLocations(parentId, map = app.state.world_map || {}) {
            const cleanParentId = parentId ? safeMapId(parentId) : "";
            return Object.values(map.locations || {})
                .filter((node) => (node.parent_id || "") === cleanParentId)
                .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        }

        function connectedMapLocations(id, map = app.state.world_map || {}) {
            const node = id ? map.locations?.[safeMapId(id)] : null;
            if (!node) return [];
            return (node.connections || [])
                .map((targetId) => map.locations?.[safeMapId(targetId)])
                .filter(Boolean);
        }

        function mapVisibleLocationIds(centerId, limit = 18, map = app.state.world_map || {}) {
            const center = map.locations?.[safeMapId(centerId)] || currentMapLocation();
            if (!center) return Object.keys(map.locations || {}).slice(0, limit);
            const ids = new Set([center.id]);

            if (center.parent_id) ids.add(center.parent_id);
            for (const child of mapChildLocations(center.id, map)) ids.add(child.id);
            for (const node of connectedMapLocations(center.id, map)) ids.add(node.id);

            if (center.parent_id) {
                for (const sibling of mapChildLocations(center.parent_id, map))
                    ids.add(sibling.id);
            }

            if (ids.size < 4 && map.focus_location_id) {
                ids.add(map.focus_location_id);
                for (const child of mapChildLocations(map.focus_location_id, map))
                    ids.add(child.id);
            }

            return [...ids]
                .filter((id) => map.locations?.[id])
                .slice(0, limit);
        }

        function mapTrailIds(
            id = app.state.world_map?.current_location_id,
            map = app.state.world_map || {},
        ) {
            const trail = [];
            let cursor = map.locations?.[safeMapId(id)];
            const seen = new Set();
            while (cursor && !seen.has(cursor.id)) {
                trail.unshift(cursor.id);
                seen.add(cursor.id);
                cursor = cursor.parent_id ? map.locations?.[cursor.parent_id] : null;
            }
            return trail;
        }

        function mapTrailText(
            id = app.state.world_map?.current_location_id,
            map = app.state.world_map || {},
        ) {
            return mapTrailIds(id, map)
                .map((nodeId) => map.locations?.[nodeId]?.name)
                .filter(Boolean)
                .join(" / ");
        }

        function locationDetailFromMapNode(node) {
            return locationDetailFromMapNodeForState(app.state, node);
        }

        function locationDetailFromMapNodeForState(state = app.state, node) {
            const map = state?.world_map || {};
            const trail = [];
            let cursor = node?.id ? map.locations?.[safeMapId(node.id)] || node : node;
            const seen = new Set();
            while (cursor && !seen.has(cursor.id)) {
                trail.unshift(cursor);
                seen.add(cursor.id);
                cursor = cursor.parent_id ? map.locations?.[safeMapId(cursor.parent_id)] : null;
            }
            const detail = {};
            for (const item of trail) {
                Object.assign(detail, extractLocation(item.detail || {}));
                if (!detail.specific_place && item?.scale === "site")
                    detail.specific_place = item.name;
                if (!detail.district && item?.scale === "district")
                    detail.district = item.name;
                if (!detail.settlement_name && item?.scale === "settlement")
                    detail.settlement_name = item.name;
                if (!detail.region && item?.scale === "region")
                    detail.region = item.name;
                if (!detail.continent && item?.scale === "continent")
                    detail.continent = item.name;
                if (!detail.world && item?.scale === "planet")
                    detail.world = item.name;
            }
            return {
                ...(state?.location || {}),
                ...detail,
                // Map node IDs and NPC-directory IDs are separate stable keys.
                // Preserve the authored NPC location unless the map node explicitly
                // supplies its own NPC-directory location ID.
                npc_location_id:
                    textSlot(extractLocation(node?.detail || {}).npc_location_id, "") ||
                    currentNpcLocationId(state) ||
                    textSlot(node?.id, ""),
            };
        }

        function currentLocationDetail(state = app.state) {
            const map = state?.world_map || {};
            const current = map.locations?.[safeMapId(map.current_location_id)];
            if (!current) return state?.location || {};
            return locationDetailFromMapNodeForState(state, current);
        }

        function hydrateMissingLocationFromMap(state = app.state) {
            if (!state || typeof state !== "object") return state;
            state.location ||= {};
            const detail = currentLocationDetail(state);
            for (const key of [
                "universe",
                "world",
                "continent",
                "region",
                "settlement_type",
                "settlement_name",
                "district",
                "specific_place",
            ]) {
                if (!state.location[key] && detail[key]) state.location[key] = detail[key];
            }
            return state;
        }

        function currentLocationDisplayLabel(state = app.state) {
            const location = currentLocationDetail(state);
            return textSlot(
                location.specific_place ||
                    location.district ||
                    location.settlement_name ||
                    location.region ||
                    location.continent ||
                    location.world,
                "",
            );
        }

        function fallbackCurrentLocationLabel(state = app.state) {
            const map = state?.world_map || {};
            const current = map.locations?.[safeMapId(map.current_location_id)];
            return (
                textSlot(current?.name, "") ||
                textSlot(current?.detail?.specific_place, "") ||
                textSlot(current?.detail?.settlement_name, "") ||
                "Starting Area"
            );
        }

        function ensureCurrentLocationLabel(state = app.state) {
            if (!state || typeof state !== "object") return state;
            state.location ||= {};
            if (currentLocationDisplayLabel(state)) return state;
            const fallback = fallbackCurrentLocationLabel(state);
            if (!fallback) return state;
            state.location.specific_place ||= fallback;
            state.world_map = extractWorldMap(state.world_map, state);
            hydrateMissingLocationFromMap(state);
            return state;
        }

        function canTravelToMapLocation(id, map = app.state.world_map || {}) {
            const target = map.locations?.[safeMapId(id)];
            const current = map.locations?.[safeMapId(map.current_location_id)] || null;
            if (!target || !current) return false;
            if (target.id === current.id) return false;
            if (target.discovered === false) return false;
            if (target.travel_enabled === false) return false;
            if (target.parent_id === current.id || current.parent_id === target.id)
                return true;
            if ((current.connections || []).map(safeMapId).includes(target.id))
                return true;
            if ((target.connections || []).map(safeMapId).includes(current.id))
                return true;
            return current.parent_id && target.parent_id === current.parent_id;
        }

        function mapTravelLabel(id, map = app.state.world_map || {}) {
            const target = map.locations?.[safeMapId(id)] || null;
            if (!target) return "Unknown";
            if (target.id === map.current_location_id)
                return "Current";
            if (canTravelToMapLocation(target.id, map)) return "Travel";
            if (target.discovered === false) return "Undiscovered";
            return "Too far";
        }

        function openMapModal(selectedId = app.state.world_map?.current_location_id) {
            const map = extractWorldMap(app.state.world_map, app.state);
            const current = map.locations?.[safeMapId(map.current_location_id)] || null;
            const selected = map.locations?.[safeMapId(selectedId)] || current;
            const visibleIds = mapVisibleLocationIds(
                map.focus_location_id || current?.id,
                24,
                map,
            );
            const visible = visibleIds
                .map((id) => map.locations[id])
                .filter(Boolean);
            const nodeButtons = visible
                .map((node) => mapNodeButtonHtml(node, selected?.id, map))
                .join("");
            const edges = mapEdgeSvg(visible);
            const selectedChildren = selected
                ? mapChildLocations(selected.id, map)
                : [];
            const selectedConnections = selected
                ? connectedMapLocations(selected.id, map)
                : [];
            const side = selected
                ? mapSelectedLocationPanel(selected, selectedChildren, selectedConnections, map)
                : `<div class="stat-card">Select a mapped location.</div>`;

            openModal(`
                <h2>Locations Map</h2>
                <p class="hint">Click a marker to show details and travel actions. Hover markers for a quick summary. Use Focus to zoom into a planet, region, city, building, or room-scale map.</p>
                <div class="map-layout">
                    <div class="map-canvas">
                        ${edges}
                        ${nodeButtons}
                    </div>
                    <div class="map-side">
                        <div class="stat-card">
                            <strong>Current</strong>
                            <div>${escapeHtml(current?.name || "Unknown")}</div>
                            <div class="map-trail">${escapeHtml(mapTrailText(current?.id))}</div>
                            <div class="row" style="margin-top:.55rem">
                                <button type="button" onclick="EmberAdventures.focusMapLocation(${htmlJsArg(current?.id || "")})">Focus Current</button>
                                <button type="button" onclick="EmberAdventures.openMapLocationEditor(${htmlJsArg(current?.id || "")})">Add Inside</button>
                            </div>
                        </div>
                        ${side}
                    </div>
                </div>
            `);
        }

        function openDiscord() {
            window.open("https://discord.gg/tsYxHYaWFc", "_blank", "noopener,noreferrer");
        }

        function mapNodeButtonHtml(node, selectedId = "", map = app.state.world_map || {}) {
            const currentId = map.current_location_id;
            const left = clampMapPercent(node.x, 50);
            const top = clampMapPercent(node.y, 50);
            const classes = [
                "map-node",
                node.id === currentId ? "current" : "",
                node.id === selectedId ? "selected" : "",
                node.discovered === false ? "undiscovered" : "",
            ]
                .filter(Boolean)
                .join(" ");
            const travelLabel = mapTravelLabel(node.id, map);
            const summary = textSlot(node.summary, "") || textSlot(node.detail, "") || "No description yet.";
            const title = `${node.name || "Location"} - ${node.scale || node.type || "place"} - ${travelLabel}. ${summary}`;
            return `
                <button type="button" class="${classes}" style="left:${left}%; top:${top}%" title="${escapeHtml(title)}" onclick="EmberAdventures.clickMapNode(${htmlJsArg(node.id)})">
                    <span class="map-node-icon" aria-hidden="true">${mapLocationIcon(node)}</span>
                    <span class="map-node-title">${escapeHtml(node.name)}</span>
                    <span class="map-node-type">${escapeHtml(travelLabel)}</span>
                    <span class="map-node-detail" aria-hidden="true">
                        <strong>${escapeHtml(node.name || "Location")}</strong>
                        ${escapeHtml(summary)}
                        <span class="hint">${escapeHtml(node.type || "place")} / ${escapeHtml(node.scale || "site")} / ${escapeHtml(travelLabel)}</span>
                    </span>
                </button>
            `;
        }

        function mapLocationIcon(node = {}) {
            return "?";
        }

        function mapEdgeSvg(visibleNodes) {
            const byId = Object.fromEntries(visibleNodes.map((node) => [node.id, node]));
            const lines = [];
            const seen = new Set();
            for (const node of visibleNodes) {
                const targets = [
                    node.parent_id,
                    ...(node.connections || []),
                ].filter(Boolean);
                for (const targetId of targets) {
                    const target = byId[safeMapId(targetId)];
                    if (!target) continue;
                    const key = [node.id, target.id].sort().join("|");
                    if (seen.has(key)) continue;
                    seen.add(key);
                    lines.push(
                        `<line class="map-edge" x1="${clampMapPercent(node.x, 50)}%" y1="${clampMapPercent(node.y, 50)}%" x2="${clampMapPercent(target.x, 50)}%" y2="${clampMapPercent(target.y, 50)}%"></line>`,
                    );
                }
            }
            return `<svg class="map-edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join("")}</svg>`;
        }

        function mapSelectedLocationPanel(
            node,
            children,
            connections,
            map = app.state.world_map || {},
        ) {
            const childNames = children.map((item) => item.name).join(", ");
            const connectionNames = connections.map((item) => item.name).join(", ");
            return `
                <div class="stat-card">
                    <strong>${escapeHtml(node.name)}</strong>
                    <div class="hint">${escapeHtml(node.type || "place")} / ${escapeHtml(node.scale || "site")}</div>
                    <p>${escapeHtml(node.summary || "No description yet.")}</p>
                    <div class="map-trail">${escapeHtml(mapTrailText(node.id, map))}</div>
                    <div class="hint"><b>Inside:</b> ${escapeHtml(childNames || "none mapped")}</div>
                    <div class="hint"><b>Connected:</b> ${escapeHtml(connectionNames || "none")}</div>
                    <div class="row" style="margin-top:.7rem">
                        <button type="button" class="primary" ${canTravelToMapLocation(node.id, map) ? "" : "disabled"} onclick="EmberAdventures.travelToMapLocation(${htmlJsArg(node.id)})">Travel</button>
                        <button type="button" onclick="EmberAdventures.focusMapLocation(${htmlJsArg(node.id)})">Focus</button>
                        <button type="button" onclick="EmberAdventures.openMapLocationEditor(${htmlJsArg(node.id)})">Add Inside</button>
                        <button type="button" onclick="EmberAdventures.openMapLocationEditor(${htmlJsArg(node.parent_id || "")}, ${htmlJsArg(node.id)})">Edit</button>
                    </div>
                </div>
            `;
        }

        function clickMapNode(id) {
            const node = mapLocation(id);
            if (!node) return;
            openMapModal(node.id);
        }

        function focusMapLocation(id) {
            const node = mapLocation(id);
            if (!node) return;
            app.state.world_map.focus_location_id = node.id;
            scheduleActiveGameSave();
            openMapModal(node.id);
        }

        async function travelToMapLocation(id) {
            if (queueProcessingBlocked()) {
                setStatus("Wait for the current turn to finish before traveling.");
                log("Map travel paused", "Finish the current AI turn before changing locations.", {
                    type: "system",
                    level: "message",
                });
                return;
            }
            const node = mapLocation(id);
            if (!node || !canTravelToMapLocation(node.id)) {
                log("Map travel blocked", node?.name || id, {
                    type: "system",
                    level: "message",
                });
                openMapModal(id);
                return;
            }
            app.state.world_map.current_location_id = node.id;
            app.state.world_map.focus_location_id = node.parent_id || node.id;
            app.state.world_map.travel_history = [
                node.id,
                ...(app.state.world_map.travel_history || []).filter(
                    (item) => item !== node.id,
                ),
            ];
            app.state.location = locationDetailFromMapNode(node);
            app.state.scene ||= {};
            app.state.objectives ||= { active_id: "", focus_id: "", items: [], suggestions: [] };
            app.state.objectives.suggestions ||= [];
            const travelSuggestion = objectiveSuggestionFromText(
                `Explore ${node.name}.`,
                "Map travel made this location relevant.",
            );
            if (
                travelSuggestion &&
                !app.state.objectives.suggestions.some(
                    (item) =>
                        normalizeNameForMatch(item.title) ===
                        normalizeNameForMatch(travelSuggestion.title),
                )
            )
                app.state.objectives.suggestions.unshift(travelSuggestion);
            app.state.scene.summary = `The scene shifts to ${node.name}.`;
            pruneSceneForLocationChange(app.state);
            replaceSceneNpcPresence(
                app.state,
                [
                    ...(app.state.scene?.npcs_present || []),
                    ...(Array.isArray(node.npcs) ? node.npcs : []),
                ],
                "map travel scene NPC additions",
            );
            app.state.recent_changes = [
                `Traveled to ${node.name}.`,
                ...(app.state.recent_changes || []),
            ].slice(0, 8);
            const beforeTravelRewards = clone(app.state);
            applyObjectiveProgressRewards(beforeTravelRewards, app.state, "travel");
            // SANITIZE REPLACED: map travel changes known location/objective fields; use targeted travel/location normalization.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
            assertRuntimeLocationState(app.state);
            scheduleActiveGameSave();
            closeModal();
            render();
            await submitUserText(
                `Travel to ${node.name}. The player arrives at this mapped location and observes what is happening there.`,
            );
        }

        function openMapLocationEditor(parentId = "", editId = "") {
            app.state.world_map = extractWorldMap(app.state.world_map, app.state);
            const map = app.state.world_map;
            const parent = parentId ? map.locations?.[safeMapId(parentId)] : currentMapLocation();
            const existing = editId ? map.locations?.[safeMapId(editId)] : null;
            const node = existing || {
                name: "",
                type: "place",
                scale: parent?.scale === "settlement" ? "district" : "site",
                parent_id: parent?.id || "",
                x: 50,
                y: 50,
                discovered: true,
                travel_enabled: true,
                summary: "",
                detail: {},
                connections: parent?.id ? [parent.id] : [],
                npcs: [],
            };
            openModal(`
                <h2>${existing ? "Edit Location" : "Add Location"}</h2>
                <p class="hint">Locations can be planets, regions, cities, buildings, rooms, or anything else the current universe needs. Parent controls nesting; connections control travel lines.</p>
                <div class="grid2">
                    <label>Name <input id="mapLocName" value="${escapeHtml(node.name || "")}"></label>
                    <label>Type <input id="mapLocType" value="${escapeHtml(node.type || "place")}"></label>
                    <label>Scale <input id="mapLocScale" value="${escapeHtml(node.scale || "site")}"></label>
                    <label>Parent ID <input id="mapLocParent" value="${escapeHtml(node.parent_id || "")}"></label>
                    <label>X position <input id="mapLocX" type="number" min="5" max="95" value="${escapeHtml(node.x ?? 50)}"></label>
                    <label>Y position <input id="mapLocY" type="number" min="5" max="95" value="${escapeHtml(node.y ?? 50)}"></label>
                </div>
                <label style="margin-top:.6rem">Summary <textarea id="mapLocSummary" rows="4">${escapeHtml(node.summary || "")}</textarea></label>
                <details class="state-branch" open>
                    <summary>Details</summary>
                    <div id="mapLocDetailEditor" class="state-editor-tree">
                        ${buildFriendlyStateEditor(node.detail || {}, ["map_detail"], 1, { profile: "map_detail" })}
                    </div>
                </details>
                <label>Connections <textarea id="mapLocConnections" rows="3" placeholder="One location id per line">${escapeHtml((node.connections || []).join("\n"))}</textarea></label>
                <label>Nearby NPCs <input id="mapLocNpcs" value="${escapeHtml((node.npcs || []).join(", "))}"></label>
                <label class="check-row"><input id="mapLocDiscovered" type="checkbox" ${node.discovered !== false ? "checked" : ""}> <span>Discovered</span></label>
                <label class="check-row"><input id="mapLocTravel" type="checkbox" ${node.travel_enabled !== false ? "checked" : ""}> <span>Travel enabled</span></label>
                <div class="row" style="margin-top:.8rem">
                    ${existing ? "" : `<button class="primary" id="addMapLocationBtn">Add Location</button>`}
                    ${existing ? `<button class="danger" id="deleteMapLocationBtn">Delete</button>` : ""}
                    <button type="button" onclick="EmberAdventures.openMapModal(${htmlJsArg(existing?.id || parent?.id || "")})">Back to Map</button>
                </div>
            `);
            if ($("addMapLocationBtn"))
                $("addMapLocationBtn").onclick = () =>
                    saveMapLocationFromEditor(existing?.id || "", {
                        close: true,
                        snapshot: true,
                    });
            if (existing)
                bindModalAutoSave(
                    (options) =>
                        saveMapLocationFromEditor(existing.id, {
                            close: false,
                            snapshot: false,
                        }),
                    "Location Autosave Failed",
                    `edited map location ${node.name || existing.id}`,
                );
            if ($("deleteMapLocationBtn"))
                $("deleteMapLocationBtn").onclick = () => deleteMapLocation(existing.id);
        }

        function saveMapLocationFromEditor(
            existingId = "",
            { close = true, snapshot = true } = {},
        ) {
            const map = app.state.world_map || { locations: {} };
            const existingNode = existingId
                ? map.locations?.[safeMapId(existingId)] || {}
                : {};
            const detailDraft = $("mapLocDetailEditor")
                ? readFriendlyStateEditor(
                      { map_detail: existingNode.detail || {} },
                      $("mapLocDetailEditor"),
                  )
                : { map_detail: {} };
            const detail = isPlainObject(detailDraft.map_detail)
                ? detailDraft.map_detail
                : {};
            const name = $("mapLocName")?.value?.trim() || "New Location";
            const id = existingId
                ? safeMapId(existingId)
                : uniqueMapId(name, map.locations || {});
            const parentId = $("mapLocParent")?.value?.trim();
            const connections = linesFromTextarea("mapLocConnections")
                .map(safeMapId)
                .filter(Boolean);
            if (parentId) connections.push(safeMapId(parentId));
            const node = extractMapNode(id, {
                id,
                name,
                type: $("mapLocType")?.value,
                scale: $("mapLocScale")?.value,
                parent_id: parentId,
                x: $("mapLocX")?.value,
                y: $("mapLocY")?.value,
                discovered: $("mapLocDiscovered")?.checked,
                travel_enabled: $("mapLocTravel")?.checked,
                summary: $("mapLocSummary")?.value,
                detail,
                connections: [...new Set(connections)],
                npcs: String($("mapLocNpcs")?.value || "")
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
            });
            if (!node) return;
            app.state.world_map.locations[node.id] = node;
            for (const targetId of node.connections || []) {
                const target = app.state.world_map.locations[targetId];
                if (!target) continue;
                target.connections = [
                    ...new Set([...(target.connections || []), node.id]),
                ];
            }
            app.state.world_map.focus_location_id = node.parent_id || node.id;
            // SANITIZE REPLACED: map editor save validates the edited map node
            // above; only location/map/objective scene references need refreshing.
            // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and map travel/editor smoke coverage.
            assertRuntimeLocationState(app.state);
            scheduleActiveGameSave();
            render();
            if (close) openMapModal(node.id);
        }

        async function deleteMapLocation(id) {
            const cleanId = safeMapId(id);
            const map = app.state.world_map || {};
            const node = map.locations?.[cleanId];
            if (!node) return;
            if (cleanId === map.current_location_id) {
                showNotice(
                    "Cannot Delete Current Location",
                    "You cannot delete the current location. Travel somewhere else first.",
                );
                return;
            }
            if (
                !(await showConfirm(
                    "Delete Map Location",
                    `Delete ${node.name} from the map?`,
                    { confirmText: "Delete", danger: true },
                ))
            )
                return;
            delete map.locations[cleanId];
            for (const item of Object.values(map.locations || {})) {
                item.connections = (item.connections || []).filter(
                    (targetId) => safeMapId(targetId) !== cleanId,
                );
                if (item.parent_id === cleanId) item.parent_id = "";
            }
            map.focus_location_id = map.current_location_id;
            app.state.world_map = extractWorldMap(map, app.state);
            scheduleActiveGameSave();
            render();
            openMapModal(map.current_location_id);
        }


        function toggleSeed(name) {
            const c = imageSettingsEntity(name);
            if (!c) return;
            c.image ||= {};
            c.image.seed_enabled = !c.image.seed_enabled;
            if (c.image.seed == null || c.image.seed === "")
                c.image.seed = 0;
            scheduleActiveGameSave();
        }
        function randomizeSeed(name) {
            const c = imageSettingsEntity(name);
            if (!c) return;
            c.image ||= {};
            c.image.seed_enabled = true;
            c.image.seed = Math.floor(Math.random() * 999999999);
            app.lastImageSignature = "";
            scheduleActiveGameSave();
        }

        function openCharacterImageSettings(name) {
            const character = imageSettingsEntity(name);
            if (!character) return;
            loadVoices();
            character.image ||= {};
            const resolvedVoice = resolvePersistentCharacterVoice(
                character,
                name === "Player" ? app.state.player?.name || "Player" : name,
            );
            const voiceOptions = characterVoiceOptions(
                resolvedVoice,
                character.gender,
            );
            const displayName =
                name === "Player"
                    ? app.state.player?.name || "Player"
                    : name;

            openModal(`
                <h2>${escapeHtml(displayName)} Settings</h2>
                <div class="grid2">
                    <label class="voice-picker">
                        Voice
                        <input id="characterSettingsVoiceSearch" placeholder="Search voices">
                        <div class="select-stepper">
                            <select id="characterSettingsVoice">${voiceOptions}</select>
                            <button type="button" id="characterSettingsVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="characterSettingsVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="characterSettingsVoiceTest" title="Test selected voice">Test</button>
                        </div>
                    </label>
                    <label>Use fixed image seed
                        <select id="characterSeedEnabled">
                            <option value="true">On</option>
                            <option value="false">Off, use random each image</option>
                        </select>
                    </label>
                    <label>Image seed
                        <input id="characterSeedValue" type="number" min="0" max="999999999" value="${escapeHtml(defaultProfileImageSeed(character))}">
                    </label>
                </div>
                <p class="hint">A fixed seed keeps the character visually consistent. Turn it off when you want every image to drift naturally.</p>
                <div class="row" style="margin-top: .8rem">
                    <button id="newCharacterSeedBtn">Generate new random seed</button>
                </div>
            `);

            $("characterSeedEnabled").value = String(
                character.image.seed_enabled !== false,
            );
            const applyCharacterImageSettings = () => {
                const selectedVoice = resolveCharacterVoiceName(
                    $("characterSettingsVoice").value,
                    character,
                    displayName,
                );
                setRuntimeCharacterVoice(character, selectedVoice);
                character.image ||= {};
                character.image.seed_enabled =
                    $("characterSeedEnabled").value === "true";
                const cleanSeed = parseProfileImageSeedInput(
                    $("characterSeedValue").value,
                    0,
                    "character image seed",
                );
                character.image.seed = cleanSeed;
                if ("default_seed" in character || character.image_prompt_config) {
                    character.default_seed = cleanSeed;
                    character.image_prompt_config = imagePromptConfigFromExactInput(
                        {
                            ...(isPlainObject(character.image_prompt_config)
                                ? character.image_prompt_config
                                : {}),
                            seed: cleanSeed,
                            seed_enabled: character.image.seed_enabled,
                        },
                        cleanSeed,
                    );
                }
                app.lastImageSignature = "";
                scheduleActiveGameSave();
            };
            const autosaveCharacterImageSettings = () => {
                applyCharacterImageSettings();
                setStatus("Saved");
            };
            bindVoiceCycler({
                selectId: "characterSettingsVoice",
                searchId: "characterSettingsVoiceSearch",
                prevId: "characterSettingsVoicePrev",
                nextId: "characterSettingsVoiceNext",
                testId: "characterSettingsVoiceTest",
                slot: resolvedVoice || displayName,
                sample: characterVoicePreviewText(displayName),
                selected: resolvedVoice,
                gender: character.gender,
            });
            $("newCharacterSeedBtn").onclick = () => {
                $("characterSeedValue").value = String(
                    Math.floor(Math.random() * 999999999),
                );
                $("characterSeedEnabled").value = "true";
                autosaveCharacterImageSettings();
            };
            $("characterSettingsVoice").addEventListener(
                "change",
                autosaveCharacterImageSettings,
            );
            $("characterSettingsVoice").addEventListener(
                "emberadventureslite-setting-commit",
                autosaveCharacterImageSettings,
            );
            $("characterSeedEnabled").onchange = autosaveCharacterImageSettings;
            $("characterSeedValue").onblur = autosaveCharacterImageSettings;
        }
        function imageSettingsEntity(name) {
            if (name === "Player") {
                app.state.player ||= clone(defaultState.player);
                app.state.player.image ||= {};
                return app.state.player;
            }
            const character = app.state.characters?.[name];
            if (character) {
                character.image ||= {};
                return character;
            }
            const npc = getNpcEntry(name);
            if (npc?.full_character) {
                discardRedundantTempSpeaker(name, npc.full_character);
                npc.full_character.image ||= {};
                return npc.full_character;
            }
            if (npc) {
                discardRedundantTempSpeaker(name, npc);
                npc.image ||= {};
                return npc;
            }
            return null;
        }
        async function newThread() {
            if (
                !(await showConfirm(
                    "Start New Thread",
                    "Clear the visible chat history but keep the current world/state?",
                    { confirmText: "Clear Chat" },
                ))
            )
                return;
            app.messages = [];
            addMessage(
                "system",
                "New thread started. Current state was preserved.",
            );
            scheduleActiveGameSave();
        }
        function sceneClothingStatusText() {
            const names = clothingEntityNamesInScene(app.state);
            let topOff = 0;
            let bottomOff = 0;
            let anyOff = 0;
            for (const name of names) {
                const entity = entityForClothingName(name, app.state);
                if (!entity) continue;
                const top = clothingTopSlots().some(
                    (slot) => !clothingItemText(entity.clothing?.[slot]),
                );
                const bottom = clothingBottomSlots().some(
                    (slot) => !clothingItemText(entity.clothing?.[slot]),
                );
                if (top) topOff++;
                if (bottom) bottomOff++;
                if (top || bottom) anyOff++;
            }
            if (!anyOff) return "clothed";
            return `${anyOff} scene character(s) with clothing off; top ${topOff}, bottom ${bottomOff}`;
        }
