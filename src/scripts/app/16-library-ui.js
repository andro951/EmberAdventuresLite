function storyLibraryCardMatchesFilters(card, panel, nameQuery = "") {
    if (!matchesSearchTokens(card.querySelector?.(".character-name")?.textContent || "", searchTokens(nameQuery))) return false;
    const fields = JSON.parse(card.dataset.libraryFilterFields);
    if (![].every(tag => [].has(tag))) return false;
    if ([].some(tag => [].has(tag))) return false;
    for (const input of panel?.querySelectorAll?.("[data-story-library-filter], [data-story-library-filter-extra]") || []) {
      const key = input.dataset.storyLibraryFilter || input.dataset.storyLibraryFilterExtra;
      if (input.type === "checkbox") {
        if (input.checked && false && void 0 !== "1") return false;
        continue;
      }
      const value = String(input.value || "").trim();
      if (value && !libraryFieldMatchesFilter(fields, key, value)) return false;
    }
    return true;
  }
  function runPublicStorySearch() {
    app.storyLibraryPublicSearch ||= {};
    app.storyLibraryPublicSearch.skipCacheOnce = true;
    return runPublicStorySearchPage({
      reset: true
    });
  }
  function publicLibrarySearchBatchSize() {
    return 50;
  }
  function publicLibraryRpcEntry(row = {}) {
    return publicLibraryEntryFromSupabaseSearchRow(row);
  }
  function publicLibrarySearchCache() {
    app.publicLibrarySearchCache ||= {
      version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
      entries: {}
    };
    return app.publicLibrarySearchCache;
  }
  function exactPublicLibrarySearchCache(raw, path = "public_library_search_cache") {
    if (!isPlainObject(raw)) throw new Error(`${path} must be an object.`);
    const cacheFields = new Set(["version", "entries"]);
    for (const field of Object.keys(raw)) if (!cacheFields.has(field)) throw new Error(`${path}.${field} is not an approved field.`);
    for (const field of cacheFields) if (!Object.hasOwn(raw, field)) throw new Error(`${path}.${field} is required.`);
    if (raw.version !== PUBLIC_LIBRARY_QUERY_CACHE_VERSION) throw new Error(`${path}.version must be exactly ${PUBLIC_LIBRARY_QUERY_CACHE_VERSION}.`);
    if (!isPlainObject(raw.entries)) throw new Error(`${path}.entries must be an object.`);
    const entryFields = new Set(["items", "hasNext", "cursor", "savedAt"]);
    const entries = {};
    for (const [cacheKey, entry] of Object.entries(raw.entries)) {
      const entryPath = `${path}.entries.${cacheKey}`;
      if (!cacheKey) throw new Error(`${path}.entries keys must be non-empty text.`);
      if (!isPlainObject(entry)) throw new Error(`${entryPath} must be an object.`);
      for (const field of Object.keys(entry)) if (!entryFields.has(field)) throw new Error(`${entryPath}.${field} is not an approved field.`);
      for (const field of entryFields) if (!Object.hasOwn(entry, field)) throw new Error(`${entryPath}.${field} is required.`);
      if (!Array.isArray(entry.items)) throw new Error(`${entryPath}.items must be an array.`);
      if (typeof entry.hasNext !== "boolean") throw new Error(`${entryPath}.hasNext must be true or false.`);
      if (entry.cursor !== null) {
        if (!isPlainObject(entry.cursor)) throw new Error(`${entryPath}.cursor must be an object or null.`);
        const cursorFields = new Set(["value", "id"]);
        for (const field of Object.keys(entry.cursor)) if (!cursorFields.has(field)) throw new Error(`${entryPath}.cursor.${field} is not an approved field.`);
        for (const field of cursorFields) if (!Object.hasOwn(entry.cursor, field)) throw new Error(`${entryPath}.cursor.${field} is required.`);
        if (typeof entry.cursor.value !== "string" || !entry.cursor.value) throw new Error(`${entryPath}.cursor.value must be non-empty text.`);
        if (typeof entry.cursor.id !== "string" || !entry.cursor.id) throw new Error(`${entryPath}.cursor.id must be non-empty text.`);
      }
      if (typeof entry.savedAt !== "string" || !entry.savedAt || !Number.isFinite(Date.parse(entry.savedAt))) throw new Error(`${entryPath}.savedAt must be a valid timestamp.`);
      entries[cacheKey] = {
        items: entry.items.map((item, index) => exactPublicLibraryEntry(item, `${entryPath}.items.${index}`)),
        hasNext: entry.hasNext,
        cursor: entry.cursor === null ? null : clone(entry.cursor),
        savedAt: entry.savedAt
      };
    }
    return {
      version: raw.version,
      entries
    };
  }
  function publicLibrarySearchCacheKey(itemType = "story", filters = {}, sort = "highest-rated") {
    return JSON.stringify({
      version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
      project: publicLibrarySupabaseUrl(),
      itemType,
      filters,
      sort,
      eligibility: {}
    });
  }
  async function loadPublicLibrarySearchCache() {
    if (app.publicLibrarySearchCacheLoaded) return publicLibrarySearchCache();
    app.publicLibrarySearchCacheLoaded = true;
    const stored = await largeStorageGet(PUBLIC_LIBRARY_QUERY_CACHE_KEY);
    if (stored !== null && stored !== undefined) {
      if (stored?.version === PUBLIC_LIBRARY_QUERY_CACHE_VERSION) app.publicLibrarySearchCache = exactPublicLibrarySearchCache(stored);else await largeStorageRemove(PUBLIC_LIBRARY_QUERY_CACHE_KEY);
    }
    return publicLibrarySearchCache();
  }
  function savePublicLibrarySearchCache() {
    const cache = exactPublicLibrarySearchCache(publicLibrarySearchCache());
    const retainedEntries = Object.entries(cache.entries).sort((left, right) => right[1].savedAt.localeCompare(left[1].savedAt)).slice(0, PUBLIC_LIBRARY_QUERY_CACHE_MAX_ENTRIES);
    cache.entries = Object.fromEntries(retainedEntries);
    return largeSetStorageItem(PUBLIC_LIBRARY_QUERY_CACHE_KEY, clone(cache));
  }
  function invalidatePublicLibrarySearchCache() {
    app.publicLibrarySearchCache = {
      version: PUBLIC_LIBRARY_QUERY_CACHE_VERSION,
      entries: {}
    };
    return largeStorageRemove(PUBLIC_LIBRARY_QUERY_CACHE_KEY);
  }
  function publicLibrarySearchRpcBody(searchState = {}) {
    const filters = searchState.filters || {};
    return {
      item_type: "story",
      search_text: filters.search || "",
      creator_text: filters.creator || "",
      creation_tool_text: filters.creation_tool || "",
      required_genres: publicTagListSlot(filters.genres || []),
      sort_mode: app.storyLibrarySorts?.public || "highest-rated",
      cursor_value: searchState.cursor?.value || null,
      cursor_id: searchState.cursor?.id || null,
      result_limit: publicLibrarySearchBatchSize() + 1
    };
  }
  async function fetchPublicStorySearchPage(searchState = {}) {
    const body = publicLibrarySearchRpcBody(searchState);
    const requested = Math.max(1, Number(body.result_limit || 1) - 1);
    const rows = (await publicLibraryFetch("/rest/v1/rpc/search_public_library_items", {
      method: "POST",
      body
    })) || [];
    const acceptedRows = rows.slice(0, requested);
    const last = acceptedRows.at(-1) || null;
    return {
      items: acceptedRows.map(publicLibraryRpcEntry).filter(Boolean),
      hasNext: rows.length > requested,
      cursor: last ? {
        value: last.ordering_value || null,
        id: last.id
      } : null
    };
  }
  async function runPublicStorySearchPage({
    reset = false
  } = {}) {
    const button = $("storyLibraryPublicSearchBtn");
    const hint = $("storyLibraryPublicSearchHint");
    const results = document.querySelector(`[data-story-library-results="public"]`);
    if (reset) app.storyLibraryPublicFiltersDirty = false;
    if (button) button.disabled = true;
    app.storyLibraryPublicSearch ||= {};
    if (reset) app.storyLibraryPublicSearch.generation = (app.storyLibraryPublicSearch.generation || 0) + 1;
    const searchGeneration = app.storyLibraryPublicSearch.generation || 0;
    const criteriaRevision = app.storyLibraryPublicCriteriaRevision || 0;
    if (reset) {
      app.storyLibraryPublicSearch.items = [];
      app.storyLibraryPublicSearch.hasNext = false;
      app.storyLibraryPublicSearch.paginationError = false;
      app.storyLibraryPublicSearch.filters = storyLibraryFilterValues("public");
      app.storyLibraryPublicSearch.total = Number.isSafeInteger(app.publicLibraryTotalItemCounts?.story) ? app.publicLibraryTotalItemCounts.story : Number.isSafeInteger(app.storyLibraryPublicSearch.total) ? app.storyLibraryPublicSearch.total : null;
      app.storyLibraryPublicSearch.cursor = null;
      if (results) results.innerHTML = `<div class="character-library-empty-state">Searching public stories...</div>`;
    } else if (app.storyLibraryPublicSearch.loading || !app.storyLibraryPublicSearch.hasNext) {
      return;
    }
    app.storyLibraryPublicSearch.paginationError = false;
    app.storyLibraryPublicSearch.loading = true;
    updatePublicLibraryLoadMoreButton("story");
    if (hint) hint.textContent = "Fetching public stories...";
    try {
      const searchState = app.storyLibraryPublicSearch;
      const totalPromise = reset || !Number.isSafeInteger(searchState.total) ? refreshPublicLibraryTotalItemCount("story", searchState) : Promise.resolve(searchState.total);
      const filters = searchState.filters || storyLibraryFilterValues("public");
      const cacheKey = publicLibrarySearchCacheKey("story", filters, app.storyLibrarySorts?.public || "highest-rated");
      await loadPublicLibrarySearchCache();
      const skipCache = !!searchState.skipCacheOnce;
      delete searchState.skipCacheOnce;
      const cachedEntry = reset && !skipCache ? publicLibrarySearchCache().entries[cacheKey] : null;
      const cached = cachedEntry && Date.now() - new Date(cachedEntry.savedAt || 0).getTime() < 10 * 60 * 1000 ? cachedEntry : null;
      const page = cached ? {
        items: cached.items,
        hasNext: cached.hasNext,
        cursor: cached.cursor
      } : await fetchPublicStorySearchPage(searchState);
      if (searchGeneration !== app.storyLibraryPublicSearch.generation || criteriaRevision !== (app.storyLibraryPublicCriteriaRevision || 0)) return;
      const byId = new Map((reset ? [] : searchState.items || []).map(item => [item.id, item]));
      for (const item of page.items || []) byId.set(item.id, item);
      searchState.items = [...byId.values()];
      searchState.hasNext = !!page.hasNext;
      searchState.cursor = page.cursor;
      await totalPromise;
      if (!cached) {
        publicLibrarySearchCache().entries[cacheKey] = {
          items: searchState.items,
          hasNext: searchState.hasNext,
          cursor: searchState.cursor,
          savedAt: new Date().toISOString()
        };
        savePublicLibrarySearchCache();
      }
      app.publicLibraryLastIndex = mergePublicLibraryIndexItems(app.publicLibraryLastIndex || publicLibraryEmptyIndex(), searchState.items);
      if (results) {
        results.innerHTML = searchState.items.length ? searchState.items.map(publicStoryLibraryCardHtml).join("") : `<div class="character-library-empty-state">No public stories matched that search.</div>`;
        scheduleAutosizeLibraryCardText(results);
      }
      if (hint) hint.textContent = searchState.hasNext ? "Scroll down or use Load More for more public stories." : `Loaded ${searchState.items.length} public stor${searchState.items.length === 1 ? "y" : "ies"}.`;
      const count = $("storyLibrarySearchCount-public");
      if (count) count.textContent = libraryResultCountText(searchState.items.length, searchState.total ?? searchState.items.length, "story");
      updateUnifiedLibraryResultLabel();
    } catch (err) {
      app.storyLibraryPublicSearch.paginationError = !reset;
      if (hint) hint.textContent = reset ? "Public story search failed." : "Could not load more public stories.";
      if (reset && results) results.innerHTML = `<div class="character-library-empty-state">${escapeHtml(err.message || String(err))}</div>`;
    } finally {
      if (searchGeneration === app.storyLibraryPublicSearch.generation) app.storyLibraryPublicSearch.loading = false;
      updateStoryLibraryContentBadgeVisibility(document.querySelector(`[data-story-library-tab-panel="public"]`));
      updatePublicLibraryLoadMoreButton("story");
    }
  }
  function storyLibrarySortPublicEntries(entries = [], tab = "public") {
    const sort = app.storyLibrarySorts?.[tab] || "name-az";
    return [...entries].sort((a, b) => {
      if (sort === "name-za") return String(b.name || "").localeCompare(String(a.name || ""));
      if (sort === "source-az") return String(a.source || "").localeCompare(String(b.source || "")) || String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "updated-new") return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }
  function filterStoryTemplateLibraryModal(query = "") {
    const tab = storyLibraryActiveTab();
    const panel = document.querySelector(`[data-story-library-tab-panel="${cssEscape(tab)}"]`);
    if (!panel || tab === "public") return;
    const nameQuery = query || panel.querySelector?.("[data-story-library-name-search]")?.value || "";
    let visible = 0;
    panel.querySelectorAll("[data-story-library-card]").forEach(card => {
      const show = storyLibraryCardMatchesFilters(card, panel, nameQuery);
      card.style.display = show ? "" : "none";
      if (show) visible++;
    });
    const count = $(`storyLibrarySearchCount-${tab}`);
    const total = panel.querySelectorAll("[data-story-library-card]").length;
    if (count) count.textContent = libraryResultCountText(visible, total, "story");
    updateStoryLibraryContentBadgeVisibility(panel);
    scheduleAutosizeLibraryCardText(panel);
    queueFirstVisibleStoryLibraryMissingTitleCard();
  }
  function setStoryLibrarySort(tab = storyLibraryActiveTab(), value = "name-az") {
    const cleanTab = ["public", "local", "mine"].includes(tab) ? tab : storyLibraryActiveTab();
    const cleanValue = ["highest-rated", "newest", "oldest", "updated", "name-az", "name-za", "source-az", "updated-new"].includes(value) ? value : cleanTab === "public" ? "highest-rated" : "name-az";
    app.storyLibrarySorts ||= {};
    app.storyLibrarySorts[cleanTab] = cleanValue;
    if (cleanTab === "public") {
      runPublicStorySearch();
      return;
    }
    refreshStoryLibraryActiveTabCards();
    saveSettingsNow("story library sort changed");
  }
  function setStoryLibraryCardSize(value = "large") {
    const cleanValue = ["tiny", "small", "medium", "large", "huge"].includes(value) ? value : "large";
    app.settings ||= {};
    app.settings.storyLibraryCardSize = cleanValue;
    document.querySelectorAll(".character-library-shell, .library-home[data-library-type=\"story\"]").forEach(shell => {
      shell.classList.remove("card-size-tiny", "card-size-small", "card-size-medium", "card-size-large", "card-size-huge");
      shell.classList.add(`card-size-${cleanValue}`);
    });
    document.querySelectorAll("[data-story-library-card-size-select]").forEach(select => {
      select.value = cleanValue;
    });
    updateUnifiedLibraryResponsiveSizing();
    scheduleAutosizeLibraryCardText($("modalBox"));
    saveSettingsNow("story library card size changed");
  }
  function refreshStoryLibraryActiveTabCards(options = {}) {
    const tab = options.tab || storyLibraryActiveTab();
    if (tab === "public") return;
    const panel = document.querySelector(`[data-story-library-tab-panel="${cssEscape(tab)}"]`);
    const results = panel?.querySelector?.(`[data-story-library-results="${cssEscape(tab)}"]`);
    if (!panel || !results) return;
    const query = panel.querySelector?.("[data-story-library-name-search]")?.value || "";
    const allRecords = storyLibraryTabRecords(tab);
    const criteria = storyLibraryFilterCriteria(panel, query);
    const count = $(`storyLibrarySearchCount-${tab}`);
    results.setAttribute("aria-busy", "true");
    if (count) count.textContent = `Filtering ${allRecords.length} story/stories...`;
    const complete = (records, immediate = false) => {
      if (!results.isConnected || options.allowHidden !== true && storyLibraryActiveTab() !== tab) return;
      results.removeAttribute("aria-busy");
      renderVirtualLibraryRecords({
        key: `story:${tab}`,
        results,
        records,
        htmlForRecord: storyLibraryRecordHtml,
        emptyHtml: `<p class="hint">${tab === "mine" ? "No stories belong to the selected creator yet." : "No matching stories available yet."}</p>`,
        afterRender: () => queueFirstVisibleStoryLibraryMissingTitleCard(),
        immediate
      });
      if (count) count.textContent = libraryResultCountText(records.length, allRecords.length, "story");
      updateStoryLibraryContentBadgeVisibility(panel);
    };
    if (options.immediateSmall === true && allRecords.length <= 12) {
      const records = allRecords.filter(record => storyLibraryRecordMatchesCriteria(record, criteria)).sort(storyLibraryRecordComparator(tab));
      complete(records, true);
      return;
    }
    frameBudgetedFilterAndSort({
      key: `story-filter:${tab}`,
      records: allRecords,
      predicate: record => storyLibraryRecordMatchesCriteria(record, criteria),
      compare: storyLibraryRecordComparator(tab),
      onComplete: records => complete(records, false)
    });
  }
  function queueFirstVisibleStoryLibraryMissingTitleCard() {
    if (app.suppressStoryLibraryTitleCardAutoQueue) {
      log("Story title-card auto queue skipped", "Auto queue is suppressed.", {
        type: "image",
        level: "message",
        details: {
          reason: "suppressed"
        }
      });
      return false;
    }
    const tab = storyLibraryActiveTab();
    if (tab === "public") {
      log("Story title-card auto queue skipped", "Public story tab does not auto-generate local title cards.", {
        type: "image",
        level: "message",
        details: {
          reason: "public-tab",
          tab
        }
      });
      return false;
    }
    const activeGeneration = pruneStaleStoryTitleCardGeneration();
    if (activeGeneration.size) {
      log("Story title-card auto queue waiting", "A story title-card image is already generating.", {
        type: "image",
        level: "message",
        details: {
          reason: "generation-active",
          activeIds: [...activeGeneration.keys()]
        }
      });
      return false;
    }
    const panel = document.querySelector(`[data-story-library-tab-panel="${cssEscape(tab)}"]`);
    if (!panel || panel.hidden) {
      log("Story title-card auto queue skipped", "The active story library tab panel is not visible.", {
        type: "image",
        level: "message",
        details: {
          reason: "panel-hidden",
          tab,
          hasPanel: !!panel
        }
      });
      return false;
    }
    let visibleMissingCount = 0;
    for (const card of panel.querySelectorAll("[data-story-library-card]")) {
      if (card.style.display === "none") continue;
      const id = card.dataset.storyLibraryId || "";
      const template = storyTemplateById(id);
      if (!template || storyTemplateTitleCardSrc(template)) continue;
      visibleMissingCount += 1;
      if (storyTitleCardImportIsPreparing(id)) {
        log("Story title-card auto queue waiting", `${template.title || id} is still restoring its imported story image.`, {
          type: "image",
          level: "message",
          details: {
            reason: "import-image-preparing",
            storyId: id,
            storyTitle: template.title || ""
          }
        });
        return false;
      }
      const stalePending = staleStoryTitleCardPendingImage(template);
      if (storyTitleCardHasPendingImage(template)) continue;
      if (app.storyTitleCardGenerationFailed?.has?.(id)) continue;
      log("Story title-card auto queue starting", `${template.title || id} has no usable story image; starting generation.`, {
        type: "image",
        level: "message",
        details: {
          storyId: id,
          storyTitle: template.title || "",
          reusedPendingImageId: stalePending?.id || "",
          visibleMissingCount,
          activeImageId: storyTitleCardActiveId(template),
          storedImageCount: storyTitleCardImages(template).length
        }
      });
      generateStoryTemplateTitleCardImage(id, {
        auto: true,
        pendingImageId: stalePending?.id || ""
      });
      return true;
    }
    log("Story title-card auto queue idle", "No visible local story needs a title-card image.", {
      type: "image",
      level: "message",
      details: {
        tab,
        visibleMissingCount
      }
    });
    return false;
  }
  function storyLibraryInfoHtml(template = {}, publicEntry = null) {
    const record = validatedStoryTemplateRecord(template);
    const computedExtra = publicLibraryStoryExtraMetadata(record);
    const publicExtra = publicEntry || {};
    const preferComputedCount = key => {
      const computed = computedExtra[key];
      const hosted = publicExtra[key];
      if (Number.isFinite(computed) && computed > 0) return computed;
      if (Number.isFinite(hosted)) return hosted;
      return computed ?? hosted ?? 0;
    };
    const computedPlayerSelect = computedExtra.player_select === true;
    const extra = {
      ...computedExtra,
      ...publicExtra,
      player_select: computedPlayerSelect || publicExtra.player_select === true,
      player_option_count: preferComputedCount("player_option_count"),
      main_objective_count: preferComputedCount("main_objective_count"),
      side_objective_count: preferComputedCount("side_objective_count"),
      future_character_count: preferComputedCount("future_character_count"),
      starting_party_member_count: preferComputedCount("starting_party_member_count"),
      starting_npc_count: preferComputedCount("starting_npc_count")
    };
    const info = [...(publicEntry ? [] : [["Source", storySourceDisplayLabel(record.source || publicEntry?.source)]]), ["Creator", storyLibraryCreator(record) || publicEntry?.creator || "unknown"], ["Created with", record.creation_tool || publicEntry?.creation_tool || "unknown"], ["Created", storyTemplateDateTimeLabel(record.createdAt)], ["Genres", genreDisplayList(record.genres || record.state?.meta?.genres || publicEntry?.genres || []).join(", ") || "none"], ...[], ["Player select", extra.player_select ? `${extra.player_option_count || 0} options` : "No"], ["Default image style", record.default_image_model ? imageModelLabel(record.default_image_model) : `Global default (${imageModelLabel(app.settings.imageModel)})`], ["Main objectives", extra.main_objective_count ?? 0], ["Side objectives", extra.side_objective_count ?? 0], ["Future characters", extra.future_character_count ?? 0], ["Starting party members", extra.starting_party_member_count ?? 0], ["Starting NPCs", extra.starting_npc_count ?? 0]];
    return `
                <div class="stack character-library-definition-info">
                    <p class="hint">${escapeHtml(record.description || publicEntry?.description || "Story definition.")}</p>
                    ${info.map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value ?? "unknown"))}</div>`).join("")}
                </div>
            `;
  }
  function openStoryLibraryLayer(html, options = {}) {
    const popup = openCharacterLibraryLayer(html, {
      title: options.title || "Story Definition",
      attr: options.attr || "data-story-library-layer"
    });
    popup.box.setAttribute("data-story-library-layer", "1");
    return popup;
  }
  async function openStoryLibraryDetail(id = "") {
    return openStoryLibraryDetailNow(id);
  }
  function openStoryLibraryDetailNow(id = "") {
    const template = storyTemplateById(id);
    if (!template) {
      showNotice("Story Not Found", "Refresh the Story Library and try again.");
      return;
    }
    const title = template.title || "Untitled Story";
    openStoryLibraryLayer(`
                <div data-story-library-detail="${escapeHtml(id)}">
                    <h2>${escapeHtml(title)}</h2>
                    <div class="row story-definition-status-row" style="margin:.15rem 0 .7rem">
                        ${""}
                    </div>
                    <div class="split-grid">
                        <button type="button" class="profile-image-button character-library-detail-image story-library-detail-title-card" title="Open story images" onclick="EmberAdventures.openStoryTitleCardImageModal(${htmlJsArg(id)})">
                            ${storyTemplateTitleCardMarkup(template, {
      pending: storyTitleCardIsGenerating(id)
    })}
                        </button>
                        ${storyLibraryInfoHtml(template)}
                    </div>
                    <div class="row" style="margin-top:.85rem">
                        <label>Default generated image style
                            <select data-story-default-image-model="${escapeHtml(id)}" onchange="EmberAdventures.saveStoryDefaultImageModel(${htmlJsArg(id)}, this.value)">
                                <option value="" ${template.default_image_model ? "" : "selected"}>Use global default (${escapeHtml(imageModelLabel(app.settings.imageModel))})</option>
                                ${imageModelOptions().map(model => `<option value="${escapeHtml(model.value)}" ${selectedImageModel(template.default_image_model || "") === model.value && template.default_image_model ? "selected" : ""}>${escapeHtml(model.label)}</option>`).join("")}
                            </select>
                        </label>
                    </div>
                    <div class="row" style="margin-top:.85rem">
                        <button class="primary" type="button" onclick="EmberAdventures.startStoryTemplate(${htmlJsArg(id)})">Start Adventure</button>
                        <button type="button" class="icon-button" title="Edit definition" onclick="EmberAdventures.openStoryBuilder(${htmlJsArg(id)})">&#9998;</button>
                        <button type="button" onclick="EmberAdventures.exportStoryTemplate(${htmlJsArg(id)})">Export</button>
                        <button type="button" class="good" onclick="EmberAdventures.publishStoryTemplateToPublicIndex(${htmlJsArg(id)})">${publicStoryPublishingAvailable() ? "Publish" : "Publishing — Coming soon"}</button>
                        <button type="button" class="danger" onclick="EmberAdventures.deleteStoryTemplate(${htmlJsArg(id)})">Delete</button>
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                </div>
            `, {
      title: "Story Definition",
      attr: "data-story-library-detail-modal"
    });
    activatePluginIframes(document);
  }
  async function openPublicStoryLibraryDetail(entryId = "", detailMode = "public") {
    const ownedMode = detailMode === "mine";
    const ownedEntry = ownedMode ? ownedPublicLibraryEntryById(entryId) : null;
    let entry = ownedMode ? ownedEntry : publicLibraryEntryById(entryId) || ownedPublicLibraryEntryById(entryId);
    if (!entry) {
      showNotice("Public Story Not Found", "Run the public story search again and try this story once more.");
      return;
    }
    let ownerPreview = null;
    try {
      if (ownedMode && (!entry.supabase_current_version_id || String(entry.url || "").startsWith("supabase://hidden-library-item/"))) {
        ownerPreview = await resolveOwnedPublicLibraryDetailPreview(entryId);
        entry = ownerPreview.entry;
      }
      const payload = entry.url ? entry.curated ? await fetchCuratedStoryPayload(entry) : await fetchVerifiedPublicLibraryPayload(entry) : null;
      const template = storyTemplateRecordFromPayload(payload);
      app.storyLibraryPublicPayloads ||= {};
      app.storyLibraryPublicPayloads[entry.id] = template;
      openStoryLibraryLayer(`
                    <h2>${escapeHtml(ownerPreview ? template.title : entry.name || template.title || "Public Story")}</h2>
                    ${ownedPublicLibraryHiddenPreviewHtml(ownerPreview)}
                    <div class="row story-definition-status-row" style="margin:.15rem 0 .7rem">
                        ${""}
                    </div>
                    <div class="split-grid">
                        <div class="profile-image-button character-library-detail-image story-library-detail-title-card">
                            ${entry.image_url ? `<div class="profile-image-thumb-wrap"><img class="profile-image-thumb" src="${escapeHtml(entry.image_url)}" alt="${escapeHtml(entry.name || "Public story")}"></div>` : storyTemplateTitleCardMarkup(template)}
                        </div>
                        ${storyLibraryInfoHtml(template, entry)}
                    </div>
                    <div class="row" style="margin-top:.85rem">
                        ${ownedEntry ? ownedPublicLibraryDetailActionsHtml(ownedEntry) : `<button class="primary" type="button" onclick="EmberAdventures.importPublicStoryToLibrary(${htmlJsArg(entry.id)})">Download / Import</button>
                        ${entry.curated ? "" : `<button type="button" onclick="EmberAdventures.openPublicLibraryVersionHistoryModal(${htmlJsArg(entry.id)})">Versions</button>
                        <button type="button" class="good" onclick="EmberAdventures.openRatePublicStoryModal(${htmlJsArg(entry.id)})">Rate</button>
                        <button type="button" class="icon-button warn" title="Report Story" onclick="EmberAdventures.openReportPublicStoryModal(${htmlJsArg(entry.id)})">&#9888;</button>`}`}
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                `, {
        title: "Public Story"
      });
    } catch (err) {
      openStoryLibraryLayer(`
                    <h2>${escapeHtml(entry.name || "Public Story")}</h2>
                    <p class="hint">Unable to fetch the hosted story payload.</p>
                    <pre class="json-view">${escapeHtml(err.message || String(err))}</pre>
                    <div class="row" style="margin-top:.8rem">
                        ${ownedMode && ownedEntry ? ownedPublicLibraryDetailActionsHtml(ownedEntry) : ""}
                        <button type="button" onclick="EmberAdventures.closeContainingPopup(this)">Back</button>
                    </div>
                `, {
        title: "Public Story"
      });
    }
  }
  async function importPublicStoryToLibrary(entryId = "") {
    const entry = publicLibraryEntryById(entryId);
    if (!entry) {
      showNotice("Public Story Not Found", "Run the public story search again and try this story once more.");
      return;
    }
    return withActivityTask("Downloading", async ({
      update
    }) => {
      let template = app.storyLibraryPublicPayloads?.[entry.id] || null;
      if (!template) {
        if (!entry.url) {
          showNotice("Public Story Missing Payload", "This public story does not have a downloadable payload URL.");
          return;
        }
        template = storyTemplateRecordFromPayload(entry.curated ? await fetchCuratedStoryPayload(entry) : await fetchVerifiedPublicLibraryPayload(entry));
      }
      update("Importing");
      return importStoryTemplatePayload({
        storyTemplate: template
      }, {
        title: "Public Story Imported"
      });
    }, {
      priority: 85,
      kind: "import"
    });
  }
  function refreshStoryLibraryTitleCardSurfaces(id = "") {
    app.work.scheduleUi(`story-title-card:${id}`, () => {
      const template = storyTemplateById(id);
      if (!template) return;
      const markup = storyTemplateTitleCardMarkup(template, {
        pending: storyTitleCardIsGenerating(id)
      });
      document.querySelectorAll(`[data-story-library-id="${cssEscape(id)}"] .story-library-title-card`).forEach(node => {
        node.innerHTML = markup;
      });
      document.querySelectorAll(`[data-story-library-detail="${cssEscape(id)}"] .story-library-detail-title-card`).forEach(node => {
        node.innerHTML = markup;
      });
      activatePluginIframes(document);
    });
  }
  async function generateStoryTemplateTitleCardImage(id = "", options = {}) {
    const template = storyTemplateById(id);
    if (!template) {
      showNotice("Story Not Found", "Refresh the Story Library and try again.");
      return;
    }
    if (options.auto && storyTemplateTitleCardSrc(template)) return;
    storyTitleCardGeneratingMap();
    app.storyTitleCardGenerationFailed ||= new Set();
    if (!options.auto) {
      app.storyTitleCardGenerationFailed.delete(id);
    }
    if (storyTitleCardIsGenerating(id)) {
      if (!options.auto) {
        cancelStoryTitleCardGeneration(id, "manual title-card generation restart");
      } else {
        await new Promise(resolve => {
          const tick = () => {
            if (!storyTitleCardIsGenerating(id)) {
              resolve(storyTemplateTitleCardSrc(storyTemplateById(id)));
              return;
            }
            setTimeout(tick, 100);
          };
          tick();
        });
        return;
      }
    }
    const stalePendingBeforeStart = staleStoryTitleCardPendingImage(template);
    const generationToken = markStoryTitleCardGenerating(id);
    refreshStoryLibraryTitleCardSurfaces(id);
    const started = perfNow();
    let providerStarted = 0;
    let iframeStatusInterval = null;
    let pendingRecord = null;
    let committedStoryTitleCardRecord = null;
    let liveStoryTitleCardResultPoll = null;
    const clearStoryTitleCardLiveResultPoll = () => {
      if (liveStoryTitleCardResultPoll) {
        clearInterval(liveStoryTitleCardResultPoll);
        liveStoryTitleCardResultPoll = null;
      }
    };
    try {
      const slot = createStoryTitleCardImageSlot(template.title_card_image, template.state, template);
      const model = selectedImageModel(options.model || slot.model || app.settings.imageModel);
      const seed = options.seed !== undefined ? options.seed : options.randomSeed ? randomProfileImageSeedExcept(options.avoidSeed ?? exactProfileImageSeed(slot.seed, "story title image seed")) : exactProfileImageSeed(slot.seed, "story title image seed");
      const storyImageMode = "";
      const prompt = storyTitleCardPromptWithRules(textSlot(options.prompt, "") || slot.prompt || defaultStoryTitleCardPrompt(template.state, template), template.state, template);
      const safePrompt = sanitizeFamilyFriendlyImagePrompt(prompt, {});
      const negativePrompt = buildStoryTitleCardNegativePrompt();
      const reusablePendingId = textSlot(options.pendingImageId, "") || stalePendingBeforeStart?.id || "";
      pendingRecord = reusablePendingId ? storyTitleCardImageById(template, reusablePendingId) : null;
      if (pendingRecord) {
        Object.assign(pendingRecord, {
          source: options.auto ? "auto-generated" : "generated",
          reason: "story title card",
          title: `${template.title || "Story"} story image`,
          prompt: safePrompt,
          negativePrompt,
          seed,
          model,
          html: profileImageRealHtml(pendingRecord.html || ""),
          pending: true,
          error: ""
        });
        setStoryTitleCardDefault(template, pendingRecord.id, pendingRecord, {
          save: false
        });
        replaceStoryTitleCardStoreImages(template, [pendingRecord, ...storyTitleCardImages(template).filter(image => String(image.id) !== String(pendingRecord.id))]);
        saveStoryTitleCardChanges(template, [pendingRecord]);
      } else {
        pendingRecord = rememberStoryTitleCardImage(id, {
          id: `story-title-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          source: options.auto ? "auto-generated" : "generated",
          reason: "story title card",
          title: `${template.title || "Story"} story image`,
          prompt: safePrompt,
          negativePrompt,
          seed,
          model,
          html: "",
          pending: true,
          favorite: false
        }, {
          setActive: true
        });
      }
      refreshStoryLibraryTitleCardSurfaces(id);
      refreshOpenStoryTitleCardImageModal(id);
      scheduleProfileImageLoadingAutosize(document);
      log("Story title-card generation started", `${template.title || id}\nMode: ${storyImageMode}\nSeed: ${String(seed)}\nModel: ${model}`, {
        type: "image"
      });
      let loggedNoUsableLiveResult = false;
      const commitGeneratedStoryTitleCardHtml = (result, source = "result") => {
        if (storyTitleCardGenerationToken(id) !== generationToken) return null;
        if (committedStoryTitleCardRecord) return committedStoryTitleCardRecord;
        const html = stableImageHtmlToString(profileImageRealHtml(result) || result);
        const src = imageSrcFromHtml(html) || extractImageSrc(html) || "";
        if (!html || !src) {
          if (source === "final" && !loggedNoUsableLiveResult) {
            loggedNoUsableLiveResult = true;
            log("Story title-card result had no image", `${template.title || id} title-card generation returned without usable image HTML.`, {
              type: "image",
              level: "warning",
              details: {
                storyId: id,
                storyTitle: template.title || "",
                source,
                pendingImageId: pendingRecord?.id || "",
                rawType: typeof result,
                rawKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 20) : []
              }
            });
          }
          return null;
        }
        const finishedRecord = createStoryTitleCardHistoryRecord({
          ...(pendingRecord || {}),
          html,
          url: src,
          hosted_url: pendingRecord?.hosted_url || "",
          pending: false,
          error: "",
          prompt: safePrompt,
          seed,
          model,
          favorite: pendingRecord?.favorite || false
        }, template.state, template);
        if (!finishedRecord) return null;
        if (pendingRecord) {
          Object.assign(pendingRecord, finishedRecord, {
            pending: false,
            error: ""
          });
        }
        replaceStoryTitleCardStoreImages(template, [finishedRecord, ...storyTitleCardImages(template).filter(image => String(image.id) !== String(finishedRecord.id))]);
        template.title_card_image = storyTitleCardImageSlotFromRecord(finishedRecord, template.state, template);
        template.updatedAt = new Date().toISOString();
        const normalizedTemplate = storyTemplateById(id);
        if (normalizedTemplate) {
          replaceStoryTitleCardStoreImages(normalizedTemplate, [finishedRecord, ...storyTitleCardImages(normalizedTemplate).filter(image => String(image.id) !== String(finishedRecord.id))]);
          normalizedTemplate.title_card_image = storyTitleCardImageSlotFromRecord(finishedRecord, normalizedTemplate.state, normalizedTemplate);
          normalizedTemplate.updatedAt = new Date().toISOString();
        }
        saveStoryTitleCardChanges(normalizedTemplate || template, [finishedRecord]);
        if (app.storyTitleCardLiveHtmlCache) delete app.storyTitleCardLiveHtmlCache[String(id)];
        if (app.storyTitleCardLiveHtmlCache && pendingRecord?.id) delete app.storyTitleCardLiveHtmlCache[String(pendingRecord.id)];
        clearStoryTitleCardLiveResultPoll();
        if (iframeStatusInterval) {
          clearInterval(iframeStatusInterval);
          iframeStatusInterval = null;
        }
        clearStoryTitleCardGenerating(id, generationToken);
        refreshStoryLibraryTitleCardSurfaces(id);
        refreshOpenStoryTitleCardImageModal(id);
        setStatus("Story title card generated");
        committedStoryTitleCardRecord = storyTitleCardImageById(storyTemplateById(id), finishedRecord.id) || finishedRecord;
        log("Story title-card generation finished", `${template.title || id} title-card image saved.`, {
          type: "image",
          level: "message",
          details: {
            storyId: id,
            storyTitle: template.title || "",
            imageId: finishedRecord.id,
            source,
            elapsedMs: Math.round(perfNow() - started),
            preparationMs: providerStarted ? Math.round(providerStarted - started) : 0,
            providerAndCommitMs: providerStarted ? Math.round(perfNow() - providerStarted) : 0
          }
        });
        return committedStoryTitleCardRecord;
      };
      providerStarted = perfNow();
      log("Story title-card provider request started", template.title || id, {
        type: "image",
        level: "message",
        details: {
          storyId: id,
          preparationMs: Math.round(providerStarted - started)
        }
      });
      const html = await generateImageHtml(safePrompt, negativePrompt, seed, model, {
        label: "story title card",
        promptType: "story title card image",
        promptEditorReplay: {
          storyId: id
        },
        resolution: STORY_TITLE_CARD_IMAGE_RESOLUTION,
        requirePlugin: true,
        iframeHostKey: storyTitleCardImageIframeHostKey(id),
        onPluginResult: resultObj => {
          if (storyTitleCardGenerationToken(id) !== generationToken) return;
          if (committedStoryTitleCardRecord) return;
          if (commitGeneratedStoryTitleCardHtml(resultObj, "plugin-result")) return;
          if (!liveStoryTitleCardResultPoll && resultObj && typeof resultObj === "object") {
            liveStoryTitleCardResultPoll = setInterval(() => {
              if (storyTitleCardGenerationToken(id) !== generationToken) {
                clearStoryTitleCardLiveResultPoll();
                return;
              }
              if (!storyTitleCardIsGenerating(id) || committedStoryTitleCardRecord) {
                clearStoryTitleCardLiveResultPoll();
                return;
              }
              commitGeneratedStoryTitleCardHtml(resultObj, "plugin-result-poll");
            }, 900);
          }
        },
        onIframe: (iframeHtml, iframeEl = null) => {
          let lastPendingStatus = "";
          const updatePendingStatus = () => {
            if (storyTitleCardGenerationToken(id) !== generationToken) return;
            if (!storyTitleCardIsGenerating(id)) return;
            const statusText = safeProfileImageIframeStatusText(iframeEl);
            const nextPendingStatus = statusText || "Generating story title card";
            if (lastPendingStatus === nextPendingStatus) return;
            lastPendingStatus = nextPendingStatus;
            app.storyTitleCardLiveHtmlCache ||= {};
            app.storyTitleCardLiveHtmlCache[String(id)] = profileImagePendingInfoHtml(iframeHtml, "Perchance image generation", nextPendingStatus);
            if (pendingRecord?.id) app.storyTitleCardLiveHtmlCache[String(pendingRecord.id)] = app.storyTitleCardLiveHtmlCache[String(id)];
            refreshStoryLibraryTitleCardSurfaces(id);
            refreshOpenStoryTitleCardImageModal(id);
            scheduleProfileImageLoadingAutosize(document);
          };
          updatePendingStatus();
          if (iframeEl && !iframeStatusInterval) {
            iframeStatusInterval = setInterval(updatePendingStatus, 900);
          }
        },
        ensureIframeHost: true
      });
      const committed = commitGeneratedStoryTitleCardHtml(html, "final");
      if (committed) {
        perfConsole("story title-card generation", {
          id,
          ms: Math.round(perfNow() - started),
          mode: ""
        });
        return committed;
      }
      if (!imageSrcFromHtml(html) && !extractImageSrc(html)) {
        throw new Error("Story title-card generation returned no usable image.");
      }
    } catch (err) {
      if (storyTitleCardGenerationToken(id) !== generationToken) return null;
      if (committedStoryTitleCardRecord) return committedStoryTitleCardRecord;
      if (options.auto) app.issuePopupOpen = false;
      app.storyTitleCardGenerationFailed.add(id);
      if (pendingRecord?.id) {
        const failed = storyTitleCardImageById(template, pendingRecord.id);
        if (failed) {
          const failedHasImage = profileImageRealHtml(failed.html);
          if (!failedHasImage) {
            const failedId = String(failed.id || "");
            const clearFailedPending = targetTemplate => {
              if (!targetTemplate) return;
              replaceStoryTitleCardStoreImages(targetTemplate, storyTitleCardImages(targetTemplate).filter(image => String(image.id || "") !== failedId));
              if (storyTitleCardActiveId(targetTemplate) === failedId) {
                targetTemplate.title_card_image = emptyStoryTitleCardImageSlot();
              }
            };
            clearFailedPending(template);
            clearFailedPending(storyTemplateById(id));
          } else {
            failed.pending = false;
            failed.error = err.message || String(err);
          }
          saveStoryTitleCardChanges(template, failedHasImage ? [failed] : []);
        } else if (storyTitleCardActiveId(template) === String(pendingRecord.id || "")) {
          template.title_card_image = emptyStoryTitleCardImageSlot();
          const currentTemplate = storyTemplateById(id);
          if (currentTemplate && storyTitleCardActiveId(currentTemplate) === String(pendingRecord.id || "")) {
            currentTemplate.title_card_image = emptyStoryTitleCardImageSlot();
          }
          saveStoryTitleCardChanges(template, []);
        }
      }
      const failureTemplate = storyTemplateById(id) || template;
      log(options.auto ? "Story title-card auto generation failed" : "Story title-card generation failed", `${template.title || id}\n${err.message || String(err)}`, {
        type: "image",
        level: options.auto ? "message" : "error",
        details: {
          storyId: id,
          storyTitle: template.title || "",
          auto: !!options.auto,
          pendingImageId: pendingRecord?.id || "",
          activeImageIdAfterCleanup: storyTitleCardActiveId(failureTemplate),
          hasActiveImageAfterCleanup: !!activeStoryTitleCardImage(failureTemplate),
          storedImageCountAfterCleanup: storyTitleCardImages(failureTemplate).length,
          generationStillMarkedActive: storyTitleCardIsGenerating(id),
          elapsedMs: Math.round(perfNow() - started),
          error: err.message || String(err)
        }
      });
      if (!options.auto) showNotice("Title Card Failed", err.message || String(err));
    } finally {
      clearStoryTitleCardLiveResultPoll?.();
      if (iframeStatusInterval) clearInterval(iframeStatusInterval);
      clearStoryTitleCardGenerating(id, generationToken);
      if (app.storyTitleCardLiveHtmlCache) delete app.storyTitleCardLiveHtmlCache[String(id)];
      if (app.storyTitleCardLiveHtmlCache && pendingRecord?.id) delete app.storyTitleCardLiveHtmlCache[String(pendingRecord.id)];
      refreshStoryLibraryTitleCardSurfaces(id);
      refreshOpenStoryTitleCardImageModal(id);
      if (!app.suppressStoryLibraryTitleCardAutoQueue) setTimeout(() => queueFirstVisibleStoryLibraryMissingTitleCard(), 0);
    }
  }
  function openStoryCreationChoicePanel() {
    const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Create New Story</strong>
                    <button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p class="hint">Choose how you want to create the story. You can build it directly in Ember Adventures, or use an AI assistant with the included EmberAdventuresLite authoring guide.</p>
                <div class="story-creation-choice-grid">
                    <button type="button" class="story-creation-choice primary" data-story-creation-manual>
                        <strong>Create in Ember Adventures</strong>
                        <span>Open the built-in story builder and create the story directly in the game.</span>
                    </button>
                    <button type="button" class="story-creation-choice blue" data-story-creation-ai="chatgpt">
                        <strong>Use ChatGPT</strong>
                        <span>Open ChatGPT with the included story authoring guide.</span>
                    </button>
                    <button type="button" class="story-creation-choice" data-story-creation-ai="codex">
                        <strong>Use Codex</strong>
                        <span>Open Codex with the included story authoring guide.</span>
                    </button>
                </div>
            `);
    popup.box.setAttribute("data-story-creation-choice", "1");
    popup.box.querySelector("[data-story-creation-manual]").onclick = async () => {
      popup.close();
      await createManualStoryTemplate();
    };
    popup.box.querySelectorAll("[data-story-creation-ai]").forEach(button => {
      button.onclick = () => {
        const target = button.dataset.storyCreationAi === "codex" ? "codex" : "chatgpt";
        popup.close();
        startExternalAiStoryCreation(target);
      };
    });
  }
  function openCharacterCreationChoicePanel() {
    const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Create New Character</strong>
                    <button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p class="hint">Choose how you want to create the character. You can build it directly in Ember Adventures, or use an AI assistant with the official EmberAdventures character skill.</p>
                <div class="story-creation-choice-grid">
                    <button type="button" class="story-creation-choice primary" data-character-creation-manual>
                        <strong>Create in Ember Adventures</strong>
                        <span>Open the built-in character editor and save a reusable character definition.</span>
                    </button>
                    <button type="button" class="story-creation-choice blue" data-character-creation-ai="chatgpt">
                        <strong>Use ChatGPT</strong>
                        <span>Open ChatGPT with the included character authoring guide.</span>
                    </button>
                    <button type="button" class="story-creation-choice" data-character-creation-ai="codex">
                        <strong>Use Codex</strong>
                        <span>Open Codex with the included character authoring guide.</span>
                    </button>
                </div>
            `);
    popup.box.setAttribute("data-character-creation-choice", "1");
    popup.box.querySelector("[data-character-creation-manual]").onclick = () => {
      popup.close();
      openManualCharacterCreateModal({
        library: true,
        layered: true
      });
    };
    popup.box.querySelectorAll("[data-character-creation-ai]").forEach(button => {
      button.onclick = () => {
        const target = button.dataset.characterCreationAi === "codex" ? "codex" : "chatgpt";
        popup.close();
        startExternalAiCharacterCreation(target);
      };
    });
  }
  function externalAiStoryPromptWithCursorSpace(text = "") {
    const body = String(text || "").replace(/\s+$/g, "");
    return `${body}\n\n`;
  }
  async function loadExternalAiStoryPrompt() {
    return externalAiStoryPromptWithCursorSpace(globalThis.__liteAuthoringGuides.story);
  }
  async function loadExternalAiCharacterPrompt() {
    return externalAiStoryPromptWithCursorSpace(globalThis.__liteAuthoringGuides.character);
  }
  function externalAiStoryUrl(target, prompt) {
    const encoded = encodeURIComponent(prompt || "");
    if (target === "codex") return `codex://new?prompt=${encoded}`;
    return `https://chatgpt.com/?q=${encoded}`;
  }
  function openLocalCodexApp(url = "codex://") {
    try {
      const link = document.createElement("a");
      link.href = url || "codex://";
      link.rel = "noopener noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.remove(), 0);
      return true;
    } catch (err) {
      log("Codex desktop app open failed", err?.message || String(err), {
        type: "troubleshooting",
        level: "warn"
      });
      return false;
    }
  }
  async function startExternalAiStoryCreation(target = "chatgpt") {
    const label = target === "codex" ? "Codex" : "ChatGPT";
    let openedWindow = null;
    const isCodex = target === "codex";
    if (!isCodex) {
      try {
        openedWindow = window.open("about:blank", "_blank");
        if (openedWindow) openedWindow.opener = null;
      } catch (err) {
        log(`${label} blank window open failed`, err?.message || String(err), {
          type: "troubleshooting",
          level: "warn"
        });
      }
    }
    const prompt = await loadExternalAiStoryPrompt(target);
    const url = externalAiStoryUrl(target, prompt);
    let opened = false;
    try {
      if (isCodex) {
        opened = openLocalCodexApp(url);
      } else if (openedWindow) {
        openedWindow.location.href = url;
        opened = true;
      } else {
        opened = !!window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      log(`${label} story prompt open failed`, err?.message || String(err), {
        type: "troubleshooting",
        level: "warn"
      });
    }
    openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(label)} Prompt Ready</strong>
                    <button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p>We attempted to open ${escapeHtml(label)} with the default EmberAdventures story prompt.</p>
                <p class="hint">After the default prompt, describe the story you want to write.</p>
                <p class="hint">When the story creation process is finished, ${escapeHtml(label)} should provide a story JSON file. Save that JSON file, then import it with the Import Story button in Ember Adventures.</p>
                <p class="hint">If the prompt did not appear, use Copy Prompt and paste it into a new ${isCodex ? "task" : "chat"}.</p>
                ${opened ? "" : `<p class="hint">If ${escapeHtml(label)} did not open, open it manually and use Copy Prompt.</p>`}
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.closeContainingPopup(this)">OK</button>
                    <button type="button" onclick="navigator.clipboard?.writeText(${htmlJsArg(prompt)})">Copy Prompt</button>
                </div>
            `);
  }
  async function startExternalAiCharacterCreation(target = "chatgpt") {
    const label = target === "codex" ? "Codex" : "ChatGPT";
    let openedWindow = null;
    const isCodex = target === "codex";
    if (!isCodex) {
      try {
        openedWindow = window.open("about:blank", "_blank");
        if (openedWindow) openedWindow.opener = null;
      } catch (err) {
        log(`${label} blank window open failed`, err?.message || String(err), {
          type: "troubleshooting",
          level: "warn"
        });
      }
    }
    const prompt = await loadExternalAiCharacterPrompt(target);
    const url = externalAiStoryUrl(target, prompt);
    let opened = false;
    try {
      if (isCodex) {
        opened = openLocalCodexApp(url);
      } else if (openedWindow) {
        openedWindow.location.href = url;
        opened = true;
      } else {
        opened = !!window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      log(`${label} character prompt open failed`, err?.message || String(err), {
        type: "troubleshooting",
        level: "warn"
      });
    }
    openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">${escapeHtml(label)} Prompt Ready</strong>
                    <button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p>We attempted to open ${escapeHtml(label)} with the default EmberAdventures character prompt.</p>
                <p class="hint">After the default prompt, describe the character you want to create.</p>
                <p class="hint">When the character creation process is finished, ${escapeHtml(label)} should provide a character JSON file. Save that JSON file, then import it with the Import Character button in Ember Adventures.</p>
                <p class="hint">If the prompt did not appear, use Copy Prompt and paste it into a new ${isCodex ? "task" : "chat"}.</p>
                ${opened ? "" : `<p class="hint">If ${escapeHtml(label)} did not open, open it manually and use Copy Prompt.</p>`}
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.closeContainingPopup(this)">OK</button>
                    <button type="button" onclick="navigator.clipboard?.writeText(${htmlJsArg(prompt)})">Copy Prompt</button>
                </div>
            `);
  }
  async function createManualStoryTemplate() {
    const creatorIdentity = selectedCreatorIdentity() || (await chooseCreatorIdentityForImport("This new story", {
      confirmText: "Create"
    }));
    if (!creatorIdentity) return null;
    const now = new Date().toISOString();
    const id = `manual-story-${Date.now()}`;
    const state = clone(defaultState);
    state.meta ||= {};
    state.meta.setup_complete = true;
    state.meta.story_source = {
      mode: "original",
      title: "Original",
      description: "",
      modifications: ""
    };
    state.meta.story_guidance = "";
    state.meta.genres = ["fantasy"];
    state.player = addImmutableDefinitionFields({
      ...blankCharacterTemplate("Player"),
      name: "Player",
      romanceable: false,
      relationship_to_player: "self",
      role: "protagonist",
      appearance: {
        ...blankAppearanceTemplate()
      },
      outfits: [{
        id: "default",
        name: "Default Outfit",
        clothing: {
          shirt: "plain shirt",
          pants: "plain trousers"
        }
      }],
      starting_outfit_id: "default",
      fallback_name: "Player Alternate",
      fallback_outfits: [{
        id: "fallback-default",
        name: "Fallback Default Outfit",
        clothing: {
          shirt: "plain shirt",
          pants: "plain trousers"
        }
      }],
      fallback_starting_outfit_id: "fallback-default"
    }, "Player");
    delete state.players;
    state.characters = {};
    state.npc_directory = {
      locations: {
        "starting-area": {
          label: "Starting Area",
          characters: {}
        }
      }
    };
    state.scene = {
      ...clone(defaultState.scene || {}),
      summary: "A new EmberAdventures story begins.",
      party_members_present: ["Player"],
      npcs_present: [],
      image_characters: ["Player"]
    };
    state.objectives = {
      active_id: "opening-objective",
      focus_id: "",
      items: [{
        id: "opening-objective",
        title: "Opening Objective",
        type: "story",
        kind: "main",
        status: "active",
        summary: "Choose what to do first.",
        while_active_guidance: "Keep the new story at its first playable moment while the player decides what to do.",
        requires: [],
        rewards: [],
        travel_location_id: "",
        travel_location_name: "",
        exclusive_group: "",
        selectable: false,
        available_now: true,
        blocked_reason: "",
        notes: [],
        completion_message: "",
        completion_control: "player",
        evaluate_ai_on_activation: false,
        completion_criteria: "Return yes when the player has taken the first concrete opening action.",
        completion_instruction: "Continue naturally from the player's first opening action.",
        next_objectives: [{
          id: "opening-objective-freeplay-ending",
          completion_instruction: "Continue naturally from the player's first opening action.",
          rewards: [],
          ending_type: "freeplay",
          ending_message: "Continue the story in freeplay after the opening action."
        }],
        auto_completed_from_prereqs: false
      }]
    };
    state.future_cast = {
      enabled: true,
      items: {}
    };
    state.recent_changes = [];
    const playerDefinitionRecord = runtimeCharacterDefinitionRecord("Player", {
      ...state.player,
      age: 18,
      gender: "female",
      role: "protagonist",
      personality_description: "An adaptable protagonist ready to begin a new story.",
      speech_style: "Player-directed dialogue.",
      boldness: 5,
      default_seed: 0,
      image_prompt_config: {
        seed_enabled: true,
        seed: 0,
        style: "",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      }
    }, creatorIdentity);
    const playerDefinition = clone(playerDefinitionRecord.character);
    delete playerDefinition.genres;
    const templateState = {
      meta: {
        app: "EmberAdventures",
        genres: ["fantasy"],
        story_guidance: "Keep the new story focused on the player's choices.",
        story_source: {
          mode: "original",
          title: "New Story",
          description: "A manually created EmberAdventures story template.",
          modifications: []
        },
        default_image_model: selectedImageModel(app.settings?.imageModel)
      },
      player: playerDefinition,
      players: [],
      characters: {},
      future_cast: {
        enabled: false,
        items: {}
      },
      location: {
        universe: "New Story",
        world: "New World",
        continent: "",
        region: "Starting Region",
        settlement_type: "",
        settlement_name: "",
        district: "",
        specific_place: "Starting Area",
        npc_location_id: "starting-area"
      },
      npc_directory: state.npc_directory,
      scene: {
        summary: "A new EmberAdventures story begins.",
        party_members_present: [],
        image_characters: [],
        npcs_present: [],
        image_action: "standing at the beginning of a new story"
      },
      story_rules: [],
      story_inventory: {
        items: []
      },
      world_flags: {},
      world_map: {
        current_location_id: "starting-area",
        focus_location_id: "starting-area",
        travel_history: ["starting-area"],
        locations: {
          "starting-area": {
            id: "starting-area",
            name: "Starting Area",
            type: "place",
            scale: "site",
            parent_id: "",
            x: 0,
            y: 0,
            discovered: true,
            travel_enabled: true,
            summary: "The first playable location.",
            detail: {},
            npcs: [],
            connections: []
          }
        }
      },
      objectives: {
        active_id: "opening-objective",
        no_current: false,
        items: [{
          id: "opening-objective",
          title: "Opening Objective",
          type: "story",
          status: "active",
          summary: "Choose what to do first.",
          while_active_guidance: "Keep the new story at its first playable moment while the player decides what to do.",
          completion_control: "player",
          completion_criteria: "Return yes when the player has taken the first concrete opening action.",
          next_objectives: [{
            id: "opening-objective-freeplay-ending",
            completion_instruction: "Continue naturally from the player's first opening action.",
            rewards: [],
            ending_type: "freeplay",
            ending_message: "Continue the story in freeplay after the opening action."
          }]
        }]
      },
      time: {
        year: 1,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0
      },
      story_memory: {
        world_notes: [],
        unresolved_threads: [],
        relationship_notes: [],
        rules_and_constraints: [],
        ai_private_notes: []
      },
      recent_changes: [],
      story_clock: {
        elapsed_minutes: 0,
        label: "Day 1, 12:00 PM"
      },
      story_pacing: {
        mode: "player_controlled",
        pending_event_id: "",
        timeline: {}
      },
      timed_events: {}
    };
    const record = validatedStoryTemplateRecord({
      id,
      title: "New Story",
      description: "A manually created EmberAdventures story template.",
      createdAt: now,
      updatedAt: now,
      allow_any_player: false,
      any_player_starting_state: {},
      default_image_model: selectedImageModel(app.settings?.imageModel),
      title_card_subjects: ["A new EmberAdventures story"],
      title_card_image: emptyStoryTitleCardImageSlot(),
      state: templateState,
      messages: [{
        role: "assistant",
        speaker: "Narrator",
        text: "The story begins at its first playable moment.",
        at: now
      }],
      source: "Original",
      app: "EmberAdventures",
      templateType: "story",
      creation_tool: "Manual EmberAdventures Story Builder",
      genres: ["fantasy"]
    });
    setStoryLibraryCreatorMetadata(record, creatorIdentity);
    assertValidStoryDefinition(record, "manual story template");
    applyValidatedStoryDefinitionArtifact(record);
    app.storyTemplates ||= [];
    app.storyTemplates.push(record);
    queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, [record], "manual story template created");
    const savedRecord = app.storyTemplates.find(item => item.id === record.id) || app.storyTemplates.find(item => item.title === record.title) || record;
    openStoryBuilder(savedRecord.id);
    return savedRecord;
  }
  async function startStoryTemplate(id) {
    const template = storyTemplateById(id);
    if (!template) {
      showNotice("Story Not Found", "That story template could not be found.");
      return;
    }
    closeStoryLibraryPopups();
    const playerOptions = storyTemplatePlayerOptions(template);
    if (playerOptions.length > 1 || storyTemplateAllowsAnyPlayer(template)) {
      app.pendingStoryTemplateStart = {
        templateId: template.id
      };
      app.mainMenuOpen = true;
      app.onboardingDraft = null;
      renderMainMenu();
      openStoryPlayerSelectModal(template.id);
      return;
    }
    await startStoryTemplateFromPlayerSelection(template, playerOptions[0] || null, false);
  }
  function showStoryStartLoading(template = {}, playerOption = null) {
    const playerName = textSlot(playerOption?.name || playerOption?.character?.name, "your character");
    openModal(`
                <section class="story-start-loading" data-story-start-loading>
                    ${loadingSpinnerHtml("Starting story")}
                    <h2>Starting Adventure</h2>
                    <p class="hint" data-story-start-loading-message>Preparing ${escapeHtml(playerName)}...</p>
                </section>
            `, {
      hideClose: true,
      setupBlackout: true,
      scrollKey: `story_start:${template.id || ""}`,
      closeDestination: ""
    });
    $("modalBox")?.setAttribute("data-story-start-loading-modal", "1");
  }
  function setStoryStartLoadingMessage(message = "Preparing story...") {
    const label = $("modalBox")?.querySelector?.("[data-story-start-loading-message]");
    if (label) label.textContent = String(message || "Preparing story...");
  }
  async function startStoryTemplateFromPlayerSelection(template, playerOption, unusedArgument4878172, savePresentation = null) {
    showStoryStartLoading(template, playerOption);
    app.lastStoryStartError = "";
    app.lastStoryStartErrorStack = "";
    // Give the player immediate visual acknowledgement before expensive
    // save and worker work begins.
    await waitForRenderedFrame();
    try {
      const started = await startStoryTemplateWithPlayerOption(template, playerOption, false, savePresentation);
      if (started === false) showNotice("Story Start Failed", "EmberAdventures could not prepare the previous game for replacement.");
      if (started === false) app.lastStoryStartError = "EmberAdventures could not prepare the previous game for replacement.";
      return started;
    } catch (error) {
      app.lastStoryStartError = error?.message || String(error);
      app.lastStoryStartErrorStack = error?.stack || "";
      showNotice("Story Start Failed", app.lastStoryStartError);
      return false;
    }
  }
  async function startStoryTemplateWithPlayerOption(template, playerOption = null, unusedArgument4879644 = null, savePresentation = null) {
    if (!template) return;
    const normalizedStoryDefinition = storyDefinitionForExport(template);
    await validateHydratedStoryTemplateRecords([normalizedStoryDefinition], {
      persist: false,
      onProgress: message => setStoryStartLoadingMessage(String(message || "Validating stored story"))
    });
    const validatedObjectiveGraph = assertValidatedStoryDefinitionArtifact(normalizedStoryDefinition, `Starting ${template.title || "story"}`);
    const selectedPlayerId = playerOption ? selectedStoryPlayerRuntimeId(playerOption) : textSlot(template?.state?.player?.id, "");
    if (!selectedPlayerId) throw new Error("Story runtime player id is required and cannot be empty.");
    const selectedPlayerName = textSlot(playerOption?.name || playerOption?.character?.name, "");
    const selectedPlayerUsesMalePresentation = profileImageMalePresentation(playerOption?.character || {});
    const selectedPlayerRequestKey = textSlot(playerOption?.character?.profile_image_request_key, `story-player:${template.id}:${selectedPlayerId}:${selectedPlayerUsesMalePresentation ? "male" : "non_male"}`);
    const selectedStoryPlayerOverride = app.profileEntityOverrides?.[selectedPlayerRequestKey] || null;
    const selectedStoryPlayerSource = selectedStoryPlayerOverride && textSlot(selectedStoryPlayerOverride.id, "") === selectedPlayerId && profileImageMalePresentation(selectedStoryPlayerOverride) === selectedPlayerUsesMalePresentation ? selectedStoryPlayerOverride : null;
    const selectedPlayerSource = playerOption?.fromCharacterLibrary ? playerOption.libraryEntity || playerOption.character || null : selectedStoryPlayerSource || playerOption?.character || null;
    const normalizedPlayerDefinitions = [...(Array.isArray(normalizedStoryDefinition.state?.players) ? normalizedStoryDefinition.state.players : []), normalizedStoryDefinition.state?.player].filter(isPlainObject);
    const normalizedSelectedPlayer = normalizedPlayerDefinitions.find(character => textSlot(character.id, "") === selectedPlayerId);
    if (!playerOption?.fromCharacterLibrary && !normalizedSelectedPlayer) throw new Error(`Selected player ${selectedPlayerId} is missing from the normalized story definition.`);
    if (!playerOption?.fromCharacterLibrary && normalizedSelectedPlayer.boldness == null) throw new Error(`Selected player ${selectedPlayerId} has no authored boldness in the normalized story definition.`);
    const normalizedStoryImport = app.library.importPayload("story", storyExportPayloadFromDefinition(normalizedStoryDefinition));
    let normalizedLibraryPlayerImport = null;
    if (playerOption?.fromCharacterLibrary && selectedPlayerSource) normalizedLibraryPlayerImport = app.library.importPayload("character", characterDefinitionFileForExport(selectedPlayerSource.character || selectedPlayerSource));
    const selectedPlayerProfileImages = selectedPlayerSource ? profileImagesForEntity(selectedPlayerSource).map(clone) : [];
    const selectedPlayerActiveProfileId = selectedPlayerSource?.profile_image_id || "";
    setStoryStartLoadingMessage("Saving current game...");
    if (!(await saveCurrentGameBeforeRuntimeReplacement("story template start"))) return false;
    cancelAllGameProcesses("starting story template");
    // The imported/editor-saved definition was already validated and
    // compiled. Story start only applies the selected player and creates
    // mutable runtime state; it must not repair the authored template.
    const normalizedStory = await normalizedStoryImport;
    const normalizedLibraryPlayer = await normalizedLibraryPlayerImport;
    const normalizedSelection = {
      source: playerOption?.fromCharacterLibrary ? "library" : "story",
      characterId: selectedPlayerId,
      ...(playerOption?.presentationGender ? {
        presentation: playerOption.presentationGender
      } : {}),
      ...(normalizedLibraryPlayer?.entry?.revisionId ? {
        revisionId: normalizedLibraryPlayer.entry.revisionId
      } : {})
    };
    devTestLog("story materialization player selection", normalizedSelection);
    const preferredCharacterGenders = preferredRuntimeCharacterGenders();
    const swapAllGendersToPreferred = app.settings.swapAllGendersToPreferred === true;
    devTestLog("new game presentation preferences", {
      preferredCharacterGenders,
      swapAllGendersToPreferred
    });
    const normalizedGame = await app.library.materializeNewGame({
      storyId: normalizedStory.entry.storyId,
      revisionId: normalizedStory.entry.revisionId,
      selection: normalizedSelection,
      preferredCharacterGenders,
      swapAllGendersToPreferred
    });
    if (app.persistence.activeSaveState) await app.persistence.closeActiveSave();
    const normalizedSave = await app.persistence.createSave(normalizedGame.header, normalizedGame.initialRecords);
    await app.persistence.activateSave(normalizedSave.saveId);
    const templateSaveId = String(normalizedSave.saveId);
    app.saveSessionContext = {
      storyId: normalizedStory.entry.storyId,
      revisionId: normalizedStory.entry.revisionId
    };
    setStoryStartLoadingMessage("Preparing story...");
    await loadSaveIndexRecords();
    const loadedRuntimeSave = await loadSaveIntoRuntime(templateSaveId, {
      showCompatibilityNotice: false,
      scrollChatToBottom: false
    });
    if (!textSlot(app.state?.player?.id, "")) throw new Error("Story runtime player id is required and cannot be empty. " + `Selected ${selectedPlayerId}; save ${templateSaveId}; ` + `loaded ${JSON.stringify(loadedRuntimeSave)}; ` + `loaded player ${JSON.stringify({
      id: app.state?.player?.id,
      name: app.state?.player?.name
    })}.`);
    app.profileEntityOverrides = {};
    app.onboardingDraft = null;
    stampRuntimeSaveOwnership(templateSaveId);
    assertExactMessageStorage();
    prepareTemplateOpeningVoiceTags();
    setStoryStartLoadingMessage("Loading player...");
    const runtimePlayerUsesMalePresentation = characterPresentationUsesMaleFields(app.state.player?.gender);
    const runtimePlayerProfileImages = selectedPlayerProfileImages.filter(image => typeof image?.male !== "boolean" || image.male === runtimePlayerUsesMalePresentation);
    if (runtimePlayerProfileImages.length) {
      for (const image of runtimePlayerProfileImages) upsertProfileStoreImage(image, app.state.player?.name || selectedPlayerName || "Player");
      app.state.player.profile_images = runtimePlayerProfileImages.map(profileImageEntityRecord).filter(Boolean);
      app.state.player.profile_image_id = selectedPlayerActiveProfileId || app.state.player.profile_images[0]?.id || "";
      resolveActiveProfileImageReference(app.state.player);
    }
    if (playerOption?.fromCharacterLibrary && selectedPlayerSource) copyLibraryProfileImageToRuntimeCharacter(app.state.player, selectedPlayerSource, app.state.player?.name || selectedPlayerName || "Player");
    const storyTitleImageHtml = savePresentation?.html || storySaveTitleImageHtmlFromTemplate(template);
    if (storyTitleImageHtml) {
      app.state.meta.title_image_html = storyTitleImageHtml;
      app.state.meta.title_image_alt = savePresentation?.name || template.title || stateStoryTitle(app.state) || "Story";
    } else {
      delete app.state.meta.title_image_html;
      delete app.state.meta.title_image_alt;
    }
    app.pendingStoryTemplateStart = null;
    app.saveSessionActive = true;
    initializeSaveProjectionState();
    resetLeftPanelForNewGame();
    // SANITIZE REPLACED: the template state was already accepted at the
    // boundary; post-start tweaks only need targeted content/scene/objective cleanup.
    // SANITIZE TEST: Covered by story-template start UI and player-select smoke coverage.
    applyRuntimeContentPolicy(app.state);
    assertRuntimeSceneReferences(app.state);
    if (textSlot(app.state.player?.id, "") !== selectedPlayerId) throw new Error(`Normalized story materialization selected ${app.state.player?.id || "no player"} instead of ${selectedPlayerId}.`);
    app.state.meta.save_id = templateSaveId;
    stampRuntimeSaveOwnership(templateSaveId);
    markRuntimeRecordDirty("player", "current");
    markRuntimeRecordDirty("meta", "current");
    setStoryStartLoadingMessage("Opening story...");
    app.existingGameChatScrollToBottom = false;
    app.newGameChatScrollToTop = true;
    startOpeningSceneImageNow();
    ensureProfileImagesForAll("story template start");
    // Assign the active save id before writing the first aggregate baseline.
    stampRuntimeSaveOwnership(templateSaveId);
    setSaveIndexRecords([...saveIndexRecords().filter(record => record.saveId !== templateSaveId), saveIndexRecordFromRuntime(`started story template: ${template.title}`)]);
    await saveGeneratedGame(`started story template: ${template.title}`);
    flushScheduledSaveAll("started story template");
    await app.work.flush(`save:${templateSaveId}`);
    app.mainMenuOpen = false;
    closeModal({
      ignoreCloseDestination: true
    });
    render();
    scrollThreadToTopSoon();
    await waitForRenderedFrame();
    setStatus("Story template loaded");
    if (!app.messages.length) {
      addMessage("system", "Story template loaded. The first move is yours.");
    }
    showPlayerInputHelpOnce(app.messages.find(m => m.role === "assistant")?.id || "", {
      force: true
    });
    return true;
  }
  function waitForRenderedFrame() {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      // Background tabs can throttle animation frames indefinitely.
      // The loading UI has already been inserted before this wait, so
      // a short fallback keeps the action live without waiting forever.
      const fallback = setTimeout(finish, 100);
      if (typeof requestAnimationFrame !== "function") {
        clearTimeout(fallback);
        finish();
        return;
      }
      requestAnimationFrame(() => {
        if (settled) return;
        requestAnimationFrame(() => {
          clearTimeout(fallback);
          finish();
        });
      });
    });
  }
  function storyPlayerSelectProfileHtml(option = {}) {
    const character = option.character || {};
    const activeImage = activeProfileImage(character);
    if (activeImage && !profileImageNeedsGeneration(activeImage)) return profileImageInnerHtml(activeImage);
    const name = textSlot(option.name || character.name, "");
    const ownerKey = profileImageOwnerKey(name, character);
    if (name && (app.profileImageQueued?.has?.(ownerKey) || app.profileImageGenerating?.has?.(ownerKey))) {
      return `<div class="profile-image-loading">${loadingSpinnerHtml("Perchance image generation")}</div>`;
    }
    const defaultSlot = profileImageSlotFromExactInput(character.default_profile_image);
    const defaultUrl = defaultProfileImageSlotHasRealReference(defaultSlot) ? textSlot(defaultSlot.url, "") : "";
    if (defaultUrl) {
      return `<img class="profile-image-thumb" alt="${escapeHtml(option.name || character.name || "Playable character")}" src="${escapeHtml(defaultUrl)}">`;
    }
    return `<div class="profile-image-placeholder static" aria-label="No profile image"></div>`;
  }
  function storyPlayerSelectProfileLiveId(option = {}) {
    const image = activeProfileImage(option.character || {});
    return image?.id ? String(image.id) : "";
  }
  function storyPlayerSelectIsScrolling() {
    return $("modalBox")?.matches?.("[data-player-select-modal='1']") && perfNow() < Number(app.storyPlayerSelectScrollBusyUntil || 0);
  }
  function scheduleDeferredStoryPlayerSelectProfileRenders() {
    clearTimeout(app.storyPlayerSelectScrollTimer);
    const waitMs = Math.max(0, Number(app.storyPlayerSelectScrollBusyUntil || 0) - perfNow());
    app.storyPlayerSelectScrollTimer = setTimeout(() => {
      if (storyPlayerSelectIsScrolling()) {
        scheduleDeferredStoryPlayerSelectProfileRenders();
        return;
      }
      const deferred = [...(app.deferredStoryPlayerSelectProfileRenders || new Map()).entries()];
      app.deferredStoryPlayerSelectProfileRenders?.clear?.();
      for (const [imageId, name] of deferred) {
        const entity = profileEntity(name);
        const image = (entity ? profileImageById(entity, imageId) : null) || profileStoreImageById(imageId);
        if (image) renderProfileImageDom(name, image, {
          afterPlayerSelectScroll: true
        });
      }
    }, waitMs + 24);
  }
  function deferStoryPlayerSelectProfileRender(name, imageId) {
    if (!imageId) return;
    app.deferredStoryPlayerSelectProfileRenders ||= new Map();
    app.deferredStoryPlayerSelectProfileRenders.set(String(imageId), String(name || ""));
    scheduleDeferredStoryPlayerSelectProfileRenders();
  }
  function noteStoryPlayerSelectScroll() {
    app.storyPlayerSelectScrollBusyUntil = perfNow() + 220;
    scheduleDeferredStoryPlayerSelectProfileRenders();
  }
  function bindStoryPlayerSelectScrollTracking() {
    const box = $("modalBox");
    if (!box || box.dataset.playerSelectScrollTracking === "1") return;
    box.dataset.playerSelectScrollTracking = "1";
    box.addEventListener("scroll", noteStoryPlayerSelectScroll, {
      passive: true
    });
  }
  function storyPlayerSelectDisplayText(text = "", option = {}) {
    const character = option?.character || {};
    const characterKey = textSlot(option?.selectionName || option?.name || character?.name, "");
    const tokenState = {
      player: character,
      characters: characterKey ? {
        [characterKey]: character
      } : {},
      npc_directory: {
        locations: {
          courtyard: {
            label: "Courtyard",
            characters: {}
          }
        }
      }
    };
    return resolveRuntimeMessageTemplateText(text, tokenState);
  }
  function queueStoryPlayerSelectProfileImages(options = [], reason = "player select option") {
    app.profileEntityOverrides ||= {};
    for (const option of options || []) {
      const name = textSlot(option?.name || option?.character?.name, "");
      const character = option?.character;
      if (!name || !character) continue;
      const requestName = textSlot(character.profile_image_request_key, name);
      app.profileEntityOverrides[requestName] = character;
      const ownerKey = profileImageOwnerKey(requestName, character);
      const active = activeProfileImage(character);
      const requestInFlight = isActiveProfileImageRecord(active) || app.profileImageGenerating.has(ownerKey) || app.profileImageQueued.has(ownerKey);
      const stalePending = active?.pending && !requestInFlight;
      if (!requestInFlight && (!active || profileImageNeedsGeneration(active) || stalePending)) {
        queueMissingProfileImageAfterDefaultAttempt(requestName, reason, {
          reason,
          force: !!active || stalePending,
          allowImportSkipped: true,
          pendingImageId: stalePending ? active?.id || "" : ""
        });
      }
    }
  }
  function openStoryPlayerSelectModal(templateId) {
    const template = storyTemplateById(templateId);
    if (!template) {
      showNotice("Story Not Found", "That story template could not be found.");
      return;
    }
    const options = storyTemplatePlayerOptions(template);
    const allowsAnyPlayer = storyTemplateAllowsAnyPlayer(template);
    if (options.length <= 1 && !allowsAnyPlayer) {
      const pending = app.pendingStoryTemplateStart;
      startStoryTemplateWithPlayerOption(template, options[0] ? storyPlayerOptionPresentation(options[0], storyPlayerSelectGenderChoice(template.id, template)) : null, false);
      return;
    }
    const selectedGender = storyPlayerSelectGenderChoice(template.id, template);
    const keyedOptions = options.map((option, index) => ({
      ...option,
      profileImageRequestBase: `story-player:${template.id}:${textSlot(option.id, `option-${index}`)}`
    }));
    const defaultOptions = keyedOptions.map(option => storyPlayerOptionPresentation(option, ""));
    const displayOptions = selectedGender ? keyedOptions.map(option => storyPlayerOptionPresentation(option, selectedGender)) : defaultOptions;
    queueStoryPlayerSelectProfileImages(defaultOptions, "player select option");
    if (selectedGender) queueStoryPlayerSelectProfileImages(displayOptions, "player select option");
    const cards = displayOptions.map(option => {
      const c = option.character || {};
      const liveId = storyPlayerSelectProfileLiveId(option);
      const profileOwnerKey = profileImageOwnerKey(textSlot(option.name || c.name, ""), c);
      const facts = [c.gender, c.age ? `${c.age} years old` : "", c.role].filter(Boolean).join(" / ");
      return `
                        <section class="stat-card player-select-card" data-story-player-select-card="${escapeHtml(option.name)}">
                            <div class="profile-image-thumb-wrap" data-profile-owner-key="${escapeHtml(profileOwnerKey)}" ${liveId ? `data-profile-live-id="${escapeHtml(liveId)}"` : ""}>${storyPlayerSelectProfileHtml(option)}</div>
                            <div class="character-name">${escapeHtml(option.name)}</div>
                            ${facts ? `<div class="hint">${escapeHtml(facts)}</div>` : ""}
                            <p>${escapeHtml(storyPlayerSelectDisplayText(c.personality_description || "Playable character option.", option))}</p>
                            <div class="row">
                                <button class="primary" type="button" onclick="EmberAdventures.startStoryTemplatePlayerChoice(${htmlJsArg(template.id)}, ${htmlJsArg(option.selectionName || option.name)})">Choose ${escapeHtml(option.name)}</button>
                            </div>
                        </section>
                    `;
    }).join("");
    const libraryCard = allowsAnyPlayer ? `
                    <section class="stat-card player-select-card" data-story-any-player-card>
                        <div class="profile-image-thumb-wrap"><div class="player-select-library-tile">Select Character From Library</div></div>
                        <p>Use any character saved in your local Character Library</p>
                        <div class="row">
                            <button class="primary" type="button" onclick="EmberAdventures.openStoryAnyPlayerLibrary(${htmlJsArg(template.id)})">Open Character Library</button>
                        </div>
                    </section>
                ` : "";
    openModal(`
                <h2>Choose Your Character</h2>
                <p class="hint">Pick the character you want to play before the opening scene begins.</p>
                ${storyPlayerSelectGenderControlHtml(template.id, template)}
                <div class="player-select-grid">${cards}${libraryCard}</div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.openStoryTemplateLibrary({ skipBack: true })">Back</button>
                </div>
            `, {
      scrollKey: `player_select:${template.id}`
    });
    $("modalBox")?.setAttribute("data-player-select-modal", "1");
    $("modalBox")?.setAttribute("data-player-select-return-to-main-menu", "1");
    bindStoryPlayerSelectScrollTracking();
    activatePluginIframes($("modalBox"));
  }
  async function startStoryTemplatePlayerChoice(templateId, playerName) {
    const template = storyTemplateById(templateId);
    if (!template) {
      showNotice("Story Not Found", "That story template could not be found.");
      return;
    }
    const option = storyTemplatePlayerOptions(template).find(item => item.name === playerName);
    if (!option) {
      showNotice("Character Not Found", "That starting player option could not be found.");
      return;
    }
    const pending = app.pendingStoryTemplateStart;
    return await startStoryTemplateFromPlayerSelection(template, storyPlayerOptionPresentation(option, storyPlayerSelectGenderChoice(template.id, template)), false);
  }
  function storyAnyPlayerLibraryCardHtml(templateId = "", record = {}) {
    const recordId = characterLibraryRecordId(record);
    const canonicalEntity = characterLibraryRecordEntity(record) || {};
    const selectedGender = characterPresentationOverride(record) || storyPlayerSelectGenderChoice(templateId, storyTemplateById(templateId));
    const entity = characterLibraryPresentation(canonicalEntity, characterLibraryRecordId(record) || canonicalEntity.name, selectedGender, {
      allowNonRomanceable: !!characterPresentationOverride(record)
    });
    const name = entity.name || record.name || "Unnamed Character";
    const profileEntity = clone(entity);
    const profile = localDefaultProfileImage(profileEntity) || activeProfileImage(profileEntity);
    const profileHtml = profile ? profileImageInnerHtml(profile) : "";
    const meta = [entity.gender, entity.role, entitySourceSlot(entity.source || record.source)].filter(Boolean).join(" / ");
    const searchText = [name, entity.gender, entity.role, entity.species, entity.personality_description, entitySourceSlot(entity.source || record.source)].filter(Boolean).join(" ");
    return `
                <div class="selectable-card-wrap" data-story-any-player-library-card data-character-library-record-id="${escapeHtml(recordId)}" data-search="${escapeHtml(searchText)}">
                    <button type="button" class="character-card character-library-definition-card character-library-cast-picker-card" onclick="EmberAdventures.startStoryTemplateLibraryPlayerChoice(${htmlJsArg(templateId)}, ${htmlJsArg(recordId)})">
                        <span class="character-library-card-name">${escapeHtml(name)}</span>
                        <span class="profile-image-button character-library-definition-image">
                            ${profileHtml ? `<span class="profile-image-thumb-wrap">${profileHtml}</span>` : `<span class="profile-image-placeholder" aria-label="No profile image"></span>`}
                        </span>
                        <span class="character-library-card-meta">${escapeHtml(meta)}</span>
                        <span class="character-library-card-action">Play as this character</span>
                    </button>
                </div>
            `;
  }
  function openStoryAnyPlayerLibrary(templateId = "") {
    const template = storyTemplateById(templateId);
    if (!template || !storyTemplateAllowsAnyPlayer(template)) {
      showNotice("Story Not Found", "This story does not allow a Character Library player.");
      return;
    }
    const records = localCharacterLibraryRecordsForCast();
    const body = records.length ? records.map(record => storyAnyPlayerLibraryCardHtml(templateId, record)).join("") : `<p class="hint">No local character definitions are available. Create or import a character, then return to this picker.</p>`;
    const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Select Character From Library</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p class="hint">The story will copy your selected character into this new playthrough and apply its story-specific starting fields.</p>
                ${storyPlayerSelectGenderControlHtml(template.id, template, "library")}
                <label>Search local library
                    <input type="search" placeholder="Name, role, source..." oninput="EmberAdventures.filterStoryAnyPlayerLibrary(this.value)">
                </label>
                <p class="hint" data-story-any-player-count style="margin:.35rem 0 .75rem"></p>
                <div class="character-library-grid card-size-large" data-story-any-player-results>${body}</div>
            `);
    popup.box.setAttribute("data-story-any-player-picker", templateId);
    popup.box.setAttribute("data-fullscreen-list-modal", "1");
    for (const card of popup.box.querySelectorAll("[data-character-library-record-id]")) {
      const record = characterLibraryRecordById(card.dataset.characterLibraryRecordId);
      appendCharacterPresentationControl(card, record, () => {
        closeContainingPopup(popup.box);
        openStoryAnyPlayerLibrary(templateId);
      });
    }
    filterStoryAnyPlayerLibrary("");
  }
  function filterStoryAnyPlayerLibrary(query = "") {
    const popup = document.querySelector("[data-story-any-player-picker]");
    if (!popup) return;
    const tokens = searchTokens(query);
    const cards = [...popup.querySelectorAll("[data-story-any-player-library-card]")];
    let visible = 0;
    for (const card of cards) {
      const show = matchesSearchTokens(card.dataset.search || "", tokens);
      card.style.display = show ? "" : "none";
      if (show) visible++;
    }
    const count = popup.querySelector("[data-story-any-player-count]");
    if (count) count.textContent = tokens.length ? `${visible} matching character${visible === 1 ? "" : "s"}` : `${cards.length} character${cards.length === 1 ? "" : "s"}`;
  }
  async function startStoryTemplateLibraryPlayerChoice(templateId = "", recordId = "") {
    const template = storyTemplateById(templateId);
    const record = characterLibraryRecordById(recordId);
    const entity = characterLibraryRecordEntity(record);
    if (!template || !storyTemplateAllowsAnyPlayer(template)) {
      showNotice("Story Not Found", "This story does not allow a Character Library player.");
      return;
    }
    if (!record || !entity) {
      showNotice("Character Not Found", "That Character Library definition is no longer available.");
      return;
    }
    const pending = app.pendingStoryTemplateStart;
    document.querySelector("[data-story-any-player-picker]")?.closest?.(".popup-modal")?.remove();
    const selectedGender = characterPresentationOverride(record) || storyPlayerSelectGenderChoice(template.id, template);
    const projectedEntity = characterLibraryPresentation(entity, recordId || entity.name, selectedGender, {
      allowNonRomanceable: !!characterPresentationOverride(record)
    });
    const name = textSlot(projectedEntity.name || record.name || entity.name, "Player");
    await startStoryTemplateFromPlayerSelection(template, {
      id: characterLibraryRecordId(record),
      name,
      character: clone(projectedEntity),
      libraryEntity: clone(record.character),
      fromCharacterLibrary: true,
      presentationGender: selectedGender
    }, false);
  }
  function editStoryTemplate(id) {
    openStoryBuilder(id);
  }
  function legacyEditStoryTemplate(id) {
    const template = storyTemplateById(id);
    if (!template) return;
    openModal(`
                <h2>Edit Story Template</h2>
                <p class="hint">Edit the reusable starting state before play. Fields that are managed by profiles, map travel, scene targeting, or safer dedicated UIs are hidden here.</p>
                <label>Story name <input id="storyTemplateTitle" value="${escapeHtml(template.title || "")}"></label>
                <label>Description <textarea id="storyTemplateDescription" rows="3">${escapeHtml(template.description || "")}</textarea></label>
                <details open>
                    <summary>Starting State</summary>
                    <div id="storyTemplateEditor" class="state-editor-tree" data-template-id="${escapeHtml(template.id)}">${buildFriendlyStateEditor(template.state, [], 0, {
      profile: "template"
    })}</div>
                </details>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.startStoryTemplate(${htmlJsArg(template.id)})">Start Game</button>
                    <button type="button" onclick="EmberAdventures.exportStoryTemplate(${htmlJsArg(template.id)})">Export</button>
                    <button type="button" class="blue" onclick="EmberAdventures.shareStoryTemplate(${htmlJsArg(template.id)})">Share</button>
                    <button type="button" class="good" onclick="EmberAdventures.publishStoryTemplateToPublicIndex(${htmlJsArg(template.id)})">${publicStoryPublishingAvailable() ? "Publish" : "Publishing — Coming soon"}</button>
                    <button type="button" onclick="EmberAdventures.openStoryTemplateLibrary()">Back</button>
                </div>
            `);
    const saveTemplate = async () => {
      try {
        const candidate = {
          ...template,
          title: $("storyTemplateTitle")?.value.trim() || "Untitled Story",
          description: $("storyTemplateDescription")?.value.trim() || "",
          state: readFriendlyStateEditor(template.state, $("storyTemplateEditor")),
          updatedAt: new Date().toISOString()
        };
        assertValidStoryDefinition(candidate, `story template editor save ${candidate.title || ""}`);
        await app.work.enqueueOrdered(`story-template-editor:${template.id}`, `compile story template ${template.id}`, async () => {
          await compileStoryTemplateValidationArtifact(candidate, {
            onProgress: message => setStatus(String(message || "Compiling story definition"))
          });
          Object.assign(template, candidate);
          queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, [storyTemplateById(template.id) || template], "story template editor saved");
        });
        setStatus("Story template saved");
        return true;
      } catch (error) {
        setStatus("Story template save failed");
        showNotice("Story Template Save Failed", String(error?.message || error));
        return false;
      }
    };
    ["storyTemplateTitle", "storyTemplateDescription"].forEach(id => {
      const field = $(id);
      if (field) field.onblur = saveTemplate;
    });
    bindStateEditorAutoSave("storyTemplateEditor", saveTemplate, "story template edit", "Story Template Save Failed");
  }
  async function deleteStoryTemplate(id) {
    const template = storyTemplateById(id);
    if (!template) return;
    const title = template.title || "this story";
    const retainedTitleCardImages = storyTitleCardImages(template).map(image => clone(image));
    if (!(await showConfirm("Delete Story Definition", `Delete ${title} from the local story library?`, {
      confirmText: "Delete",
      danger: true
    }))) return;
    const deleted = await app.work.enqueueOrdered(`library:${libraryRecordStorageType(STORY_TEMPLATE_KEY)}`, `delete story ${id}`, () => deletePerRecordLibraryRecords(STORY_TEMPLATE_KEY, [{
      id: template.id
    }]));
    if (deleted === false) return;
    app.storyTemplates = (app.storyTemplates || []).filter(template => String(template.id) !== String(id));
    if (retainedTitleCardImages.length) {
      const retainedIds = new Set(retainedTitleCardImages.map(image => String(image.id)));
      app.storyTitleCardImages = exactStoryTitleCardImageStore([...(app.storyTitleCardImages || []).filter(image => !retainedIds.has(String(image.id))), ...retainedTitleCardImages]);
    }
    closeStoryLibraryDefinitionLayers(id);
    refreshStoryLibraryActiveTabCards();
  }
  function closeStoryLibraryDefinitionLayers(id = "") {
    const wanted = String(id || "");
    document.querySelectorAll("[data-story-library-layer='1']").forEach(box => {
      const layerId = box.querySelector?.("[data-story-library-detail]")?.dataset.storyLibraryDetail || "";
      if (!wanted || layerId === wanted) closeContainingPopup(box);
    });
  }
  function exportStoryTemplate(id) {
    const template = storyTemplateById(id);
    if (!template) return;
    const storyTemplate = storyDefinitionForExport(template);
    const blob = new Blob([JSON.stringify({
      app: "EmberAdventures",
      exportType: "story-template",
      storyTemplate,
      exportedAt: new Date().toISOString()
    }, null, 2)], {
      type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(template.title || "emberadventures-lite-story").replace(/[^a-z0-9_-]+/gi, "-")}.json`;
    a.click();
  }
  function cleanStoryDefinitionMessageForExport(message = {}) {
    const clean = {};
    const role = textSlot(message.role, "");
    const speaker = textSlot(message.speaker, "");
    const text = textSlot(message.text, "");
    if (role) clean.role = role;
    if (speaker) clean.speaker = speaker;
    if (text) clean.text = text;
    if (message.at) clean.at = message.at;
    return clean;
  }
  function characterDefinitionFileForExport(recordOrCharacter = {}, options = {}) {
    const character = characterDefinitionProjectionForExport(recordOrCharacter, options);
    return {
      character_definition: character
    };
  }
  function characterDefinitionProjectionForExport(recordOrCharacter = {}) {
    if (!isPlainObject(recordOrCharacter)) throw new Error("Character export source must be an object.");
    if (Object.hasOwn(recordOrCharacter, "character_definition")) {
      const validation = validateCharacterExport(recordOrCharacter);
      if (!validation.ok) throw new Error(validationErrorsText(validation));
      return clone(recordOrCharacter.character_definition);
    }
    if (Object.hasOwn(recordOrCharacter, "character")) {
      const validation = validateCharacterLibraryRecord(recordOrCharacter);
      if (!validation.ok) throw new Error(validationErrorsText(validation));
      return clone(recordOrCharacter.character);
    }
    const validation = validateCharacterDefinition(recordOrCharacter);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return clone(recordOrCharacter);
  }
  function storyDefinitionForExport(template = {}) {
    if (!isPlainObject(template)) throw new Error("Story export source must be an object.");
    const definition = clone(template);
    definition.state = stripRuntimeTemplateFields(definition.state);
    delete definition.creator_id;
    delete definition.creator;
    return validatedStoryTemplateRecord(definition);
  }
  function storyExportPayloadFromDefinition(template = {}, exportedAt = new Date().toISOString()) {
    const validation = validateStoryDefinition(template);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return {
      app: "EmberAdventures",
      exportType: "story-template",
      storyTemplate: clone(template),
      exportedAt
    };
  }
  function storyTemplateRecordFromPayload(data) {
    const validation = validateStoryExport(data);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return clone(data.storyTemplate);
  }
  async function importStoryTemplatePayload(data, options = {}) {
    const returnTab = options.tab || app.storyLibraryLastTab || rememberedStoryLibraryTab("public");
    const importPayload = clone(data);
    const upgradedCharacterNames = false;
    const sourceValidation = validateStoryExport(importPayload);
    if (!sourceValidation.ok) {
      const message = validationErrorsText(sourceValidation);
      if (options.showNotice !== false) showNotice(options.title || "Story Definition Invalid", message);
      reportAppIssue(new Error(`Story import rejected:\n${message}`), {
        title: "Story Import Rejected",
        type: "system",
        context: "importStoryTemplatePayload",
        details: {
          errors: sourceValidation.errors
        }
      });
      return null;
    }
    const record = storyTemplateRecordFromPayload(importPayload);
    const duplicate = (app.storyTemplates || []).find(item => String(item?.id || "") === String(record?.id || ""));
    if (duplicate) {
      if (options.showNotice !== false) showNotice("Story Already Imported", `${duplicate.title || record.title || "That story"} is already in the local Story Library.`);
      return duplicate;
    }
    logDefinitionValidationWarnings(sourceValidation, `${record.title || "Story template"} import`);
    await compileStoryTemplateValidationArtifact(record, {
      onProgress: message => setStatus(String(message || "Compiling story definition"))
    });
    app.storyTemplates ||= [];
    app.storyTemplates.push(record);
    const importedRecord = record;
    storyTitleCardImportPreparationSet().add(String(importedRecord.id || ""));
    if (options.persist !== false) {
      const persisted = await app.work.enqueueOrdered(`library:${libraryRecordStorageType(STORY_TEMPLATE_KEY)}`, `import story ${importedRecord.id}`, () => savePerRecordLibraryRecords(STORY_TEMPLATE_KEY, [importedRecord]));
      if (persisted === false) {
        storyTitleCardImportPreparationSet().delete(String(importedRecord.id || ""));
        app.storyTemplates = (app.storyTemplates || []).filter(item => String(item.id || "") !== String(importedRecord.id || ""));
        return null;
      }
    }
    const titleCardPreparation = prepareImportedStoryTitleCard(importedRecord, options.title || "story template import");
    if (options.awaitTitleCardPreparation === true) await titleCardPreparation;
    if (options.openLibrary !== false) openStoryTemplateLibrary({
      skipBack: true,
      tab: returnTab
    });
    const hidden = false;
    if (options.showNotice !== false) showNotice(options.title || "Story Template Imported", `${importedRecord.title || "Story template"} was imported into the Story Library.`);
    return importedRecord;
  }
  function clearImportedStoryImageFavorites(value, seen = new Set()) {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Object.prototype.hasOwnProperty.call(value, "favorite")) value.favorite = false;
    if (Array.isArray(value)) {
      value.forEach(item => clearImportedStoryImageFavorites(item, seen));
      return;
    }
    for (const item of Object.values(value)) {
      if (item && typeof item === "object") clearImportedStoryImageFavorites(item, seen);
    }
  }
  async function shareStoryTemplate(id) {
    const template = storyTemplateById(id);
    if (!template) return;
    const storyTemplate = storyDefinitionForExport(template);
    const validation = validateStoryDefinition(storyTemplate);
    if (!validation.ok) {
      showNotice("Story Share Failed", `${template.title || "Story template"} is invalid:\n${validationErrorsText(validation)}`);
      reportAppIssue(new Error(`Story share rejected:\n${validationErrorsText(validation)}`), {
        title: "Story Share Rejected",
        type: "system",
        context: "shareStoryTemplate",
        details: {
          errors: validation.errors
        }
      });
      return;
    }
    const payload = {
      app: "EmberAdventures",
      exportType: "story-template",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      privateShare: true,
      storyTemplate
    };
    if (!(await confirmHostedUpload(payload, "story template"))) return;
    try {
      setStatus("Uploading story template...");
      const upload = await uploadCompressedStoryJson(payload, "Story template upload");
      const url = hostedShareUrl("story", template.title || "story", upload.fileName);
      await showHostedShareResult("Story Share Link", url, `Uploaded ${Math.round(upload.size / 1024)} KB to user.uploads.dev.`);
    } catch (err) {
      showNotice("Story Share Failed", err.message || String(err));
    } finally {
      setStatus("Ready");
    }
  }
  async function prepareStoryTemplateImportFiles(files = []) {
    const list = Array.from(files || []);
    const prepared = await storyImportWorkerRequest("prepare-story-import", {
      files: list
    });
    const candidates = prepared.map(item => item?.record).filter(Boolean);
    const failures = prepared.map(item => item?.error).filter(Boolean);
    const classificationUpgrades = candidates.filter(candidate => (void 0)?.length).map(candidate => ({
      title: candidate.title,
      characterNames: void 0
    }));
    const missingCreatorCandidates = candidates.filter(candidate => !candidate.creator_id);
    let batchCreatorIdentity = null;
    if (missingCreatorCandidates.length) {
      const plural = candidates.length > 1;
      batchCreatorIdentity = await chooseCreatorIdentityForImport(plural ? "These imported stories" : missingCreatorCandidates[0].title || "Imported story", {
        plural
      });
      if (!batchCreatorIdentity) {
        await storyImportWorkerRequest("discard-story-import", {
          tokens: candidates.map(item => item.token)
        });
        return {
          imported: [],
          failures,
          classificationUpgrades,
          cancelled: true
        };
      }
    }
    const committed = [];
    for (const candidate of candidates) {
      committed.push({
        token: candidate.token,
        ...(!candidate.creator_id && batchCreatorIdentity ? {
          creator_identity: exactCreatorIdentity(batchCreatorIdentity)
        } : {})
      });
    }
    const imported = committed.length ? await storyImportWorkerRequest("commit-story-import", {
      items: committed
    }) : [];
    return {
      imported,
      failures,
      classificationUpgrades,
      cancelled: false
    };
  }
  async function readStoryTemplateImportFileText(file) {
    return compressedJsonBlobText(file, file?.name || "");
  }
  async function uploadStoryTemplate() {
    let files = [];
    try {
      files = await chooseImportFiles({
        accept: COMPRESSED_JSON_IMPORT_ACCEPT,
        multiple: true
      });
    } catch (err) {
      showNotice("Import Failed", err.message || String(err));
      return;
    }
    if (!files.length) return;
    const returnTab = app.storyLibraryLastTab || rememberedStoryLibraryTab("public");
    return withSavingOverlay(async () => {
      const {
        imported,
        failures,
        classificationUpgrades,
        cancelled
      } = await prepareStoryTemplateImportFiles(files);
      if (cancelled) return;
      if (!imported.length) {
        showNotice("Story Import Failed", failures.join("\n") || "No valid story templates were selected.");
        return;
      }
      try {
        app.storyTemplates ||= [];
        app.storyTemplates.push(...imported);
        for (const record of imported) storyTitleCardImportPreparationSet().add(String(record.id || ""));
        //The import worker has already persisted every accepted record
        //before returning it here. Do not clone and write the complete
        //story payload a second time on the page thread.
        for (const record of imported) {
          prepareImportedStoryTitleCard(record, "story file import");
        }
        openStoryTemplateLibrary({
          skipBack: true,
          tab: returnTab
        });
        const hiddenCount = imported.filter(record => false).length;
        const importedText = imported.length === 1 ? `${imported[0].title || "Story template"} was imported into the Story Library.` : `${imported.length} story templates were imported into the Story Library.`;
        const hiddenText = "";
        const failureText = failures.length ? `\n\n${failures.length} file(s) failed:\n${failures.join("\n")}` : "";
        const upgradeText = "";
        showNotice(failures.length ? "Story Upload Partially Complete" : "Story Upload Complete", `${importedText}${hiddenText}${upgradeText}${failureText}`);
      } catch (err) {
        logImportException("Story file import failed", err, {
          requestKind: "story-file-import",
          fileCount: files.length,
          fileNames: files.map(file => String(file?.name || "").trim()).filter(Boolean)
        });
        showNotice("Story Import Failed", err.message || String(err));
      }
    }, files.length === 1 ? "Importing story..." : `Importing ${files.length} stories...`);
  }
  function devTestLog(label, data = {}) {
    if (!EMBERADVENTURES_DEBUG_ALL_LOGS) return;
    // Smoke harness rule: browser console capture can retain stale logs
    // across tabs/origins, so debug smoke tests also write a current-page
    // DOM marker that automation can read without depending on console
    // history.
    root.__emberAdventuresLiveTestLog ||= [];
    root.__emberAdventuresLiveTestLog.push(label);
    let marker = document.getElementById("__emberadventures-lite-live-test-log");
    if (!marker) {
      marker = document.createElement("pre");
      marker.id = "__emberadventures-lite-live-test-log";
      marker.hidden = true;
      document.body.appendChild(marker);
    }
    marker.textContent = root.__emberAdventuresLiveTestLog.join("\n");
    devLog(`live test ${label}`, data);
  }
  function devAssert(condition, message, data = {}) {
    if (condition) {
      devTestLog(`PASS: ${message}`, data);
      return;
    }
    window.__liteLastAssertionFailure = {
      message,
      data: clone(data)
    };
    devLog(`live test FAIL: ${message}`, data);
    throw new Error(message);
  }
  function devStateFieldPath(field) {
    try {
      return JSON.parse(decodeURIComponent(field?.dataset?.statePath || "[]"));
    } catch {
      return [];
    }
  }
  function devFieldByPath(rootSelector, targetPath) {
    return [...document.querySelectorAll(`${rootSelector} [data-state-path], ${rootSelector} [data-state-array-add-path]`)].find(field => {
      const rawPath = field.dataset.statePath || field.dataset.stateArrayAddPath || "[]";
      let path = [];
      try {
        path = JSON.parse(decodeURIComponent(rawPath));
      } catch {
        path = [];
      }
      return JSON.stringify(path) === JSON.stringify(targetPath);
    });
  }
  function devFieldWithPathPrefix(rootSelector, prefixPath) {
    return [...document.querySelectorAll(`${rootSelector} [data-state-path]`)].find(field => {
      const path = devStateFieldPath(field);
      return prefixPath.every((part, index) => String(path[index]) === String(part));
    });
  }
  function devVisibleText(root = document.body) {
    const target = root || document.body;
    if (!target) return "";
    const hiddenTags = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || hiddenTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest?.("script,style,template,noscript")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const parts = [];
    while (walker.nextNode()) {
      const text = String(walker.currentNode.nodeValue || "").trim();
      if (text) parts.push(text);
    }
    return parts.join("\n");
  }
  function devResetPreferenceSettingsForSmoke() {
    for (const key of preferenceSettingKeys()) app.settings[key] = clone(defaultSettings[key]);
    return {settings: app.settings};
  }
  async function devSeedTessaPlaytestData() {
    devTestLog("Scenario start: tessa-playtest-seed");
    const profile = devResetPreferenceSettingsForSmoke({});
    app.settings.autoImages = true;
    app.settings.showAiStatusMessages = true;
    const template = devSmokeObjectiveChainTemplate();
    devUpsertStoryTemplatesForSmoke([template]);
    devTestLog("Objective-chain playtest seed used synthetic smoke template", {
      id: template.id,
      title: template.title
    });
    app.mainMenuOpen = true;
    scheduleActiveGameSave();
    await flushLargeSaves();
    render();
  }
  async function devRunTessaObjectiveChainSmokeTest() {
    devTestLog("Scenario start: tessa-objective-chain-smoke");
    try {
      devResetForLiveTest("tessa-objective-chain-smoke");
      await devSeedTessaPlaytestData();
      const template = devSmokeObjectiveChainTemplate();
      devAssert(!!template?.state, "Synthetic objective-chain template is available");
      // SANITIZE KEEP (dev fixture): smoke test loads a full template state through the boundary normalizer.
      // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
      const materialized = await storyImportWorkerRequest("materialize-story-runtime", {
        state: clone(template.state),
        messages: clone(template.messages || [])
      });
      app.state = repairAiGeneratedState(materialized.state);
      app.messages = (materialized.messages || template.messages || []).map((message, index) => ({
        ...message,
        id: index + 1,
        entryId: index + 1
      }));
      app.state.meta ||= {};
      app.state.meta.setup_complete = true;
      app.mainMenuOpen = false;
      await devCompileCurrentStoryFixture("tessa-objective-chain-smoke");
      reconcileStoryRuntimeState(app.state, "tessa objective chain seed");
      devAssert(currentObjectiveTarget()?.id === "choose-tessas-first-retort", "Synthetic objective chain starts on the current opening objective", currentObjectiveTarget());
      const completeObjectiveForTest = id => {
        const before = clone(app.state);
        const completed = completeCurrentObjective(app.state, id);
        const rewardResult = applyObjectiveProgressRewards(before, app.state, "tessa-objective-chain-smoke", {
          silentGameMessage: true
        });
        reconcileStoryRuntimeState(app.state, `tessa test completed ${id}`);
        devAssert(!!completed, `Objective can be completed: ${id}`, {
          rewardResult,
          objectives: app.state.objectives
        });
        return rewardResult;
      };
      const objectiveById = id => app.state.objectives?.items?.find(item => item.id === id);
      const assertComplete = id => devAssert(objectiveIsComplete(objectiveById(id)), `Objective is complete: ${id}`, objectiveById(id));
      const completeAvailableObjectiveGraph = () => {
        let completedCount = 0;
        let guard = 0;
        while (guard < (app.state.objectives?.items || []).length + 20) {
          guard += 1;
          reconcileStoryRuntimeState(app.state, `tessa objective graph loop ${guard}`);
          const completedIds = completedObjectiveIds(app.state);
          const target = (app.state.objectives?.items || []).find(item => !objectiveIsComplete(item) && !objectiveBlockedByExclusiveGroup(item, app.state) && objectiveRequiredIds(item).every(id => completedIds.has(String(id))));
          if (!target) break;
          target.status = /^(hidden|locked|future)$/i.test(String(target.status || "")) ? "queued" : target.status || "active";
          target.available_now = true;
          setObjectiveFocus(target.id);
          completeObjectiveForTest(target.id);
          completedCount += 1;
        }
        devAssert(guard < (app.state.objectives?.items || []).length + 20, "Synthetic objective graph completion loop terminates", app.state.objectives);
        return completedCount;
      };
      const completedCount = completeAvailableObjectiveGraph();
      for (const objective of app.state.objectives.items) assertComplete(objective.id);
      devAssert(app.state.objectives.items.every(objectiveIsComplete), "Synthetic objective graph reaches 100% completion", {
        completedCount,
        objectives: app.state.objectives
      });
      showNotice("Live Test Passed", "Synthetic objective chain smoke test passed.");
      scheduleActiveGameSave();
      render();
      devTestLog("Scenario complete: tessa-objective-chain-smoke");
    } finally {
      devCancelSmokeImageWorkForRestore();
      await app.work.flush();
      await devCleanupSmokeStoryLibraryArtifacts("Tessa objective chain smoke story artifacts cleaned");
      const titleImages = exactStoryTitleCardImageStore(app.storyTitleCardImages || []);
      const profileImages = exactProfileImageStore(app.profileImages || []);
      if (titleImages.length) await deletePerRecordLibraryRecords(STORY_TITLE_CARD_IMAGE_KEY, titleImages.map(image => ({
        id: image.id
      })));
      if (profileImages.length) await deletePerRecordLibraryRecords(PROFILE_IMAGE_KEY, profileImages.map(image => ({
        id: image.id
      })));
      app.storyTitleCardImages = [];
      app.profileImages = [];
      await flushLargeSaves();
    }
  }
  async function devRunLeftPanelGroupTessaSmokeTest() {
    devTestLog("Scenario start: left-panel-group-tessa-smoke");
    try {
      devResetForLiveTest("left-panel-group-tessa-smoke");
      await devSeedTessaPlaytestData();
      const template = devSmokeObjectiveChainTemplate();
      devAssert(!!template?.state, "Synthetic left-panel template is available");
      // SANITIZE KEEP (dev fixture): smoke test loads a full template state through the boundary normalizer.
      // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
      app.state = repairAiGeneratedState(clone(template.state));
      app.messages = (template.messages || []).map((message, index) => ({
        ...clone(message),
        id: index + 1,
        entryId: index + 1
      }));
      app.images = [];
      app.queue = [];
      app.busy = false;
      assertExactMessageStorage();
      app.state.meta ||= {};
      app.state.meta.setup_complete = true;
      app.mainMenuOpen = false;
      app.settings.leftPanelGroup = "characters";
      app.settings.leftPanelSections = {
        "characters-player": true,
        "characters-party": true,
        "characters-npcs": true,
        "objective-main": true,
        "objective-side": true,
        "scene-location": true,
        "scene-names": true,
        "scene-images": true
      };
      app.settings.leftPanelScroll = {};
      await devCompileCurrentStoryFixture("left-panel-group-tessa-smoke");
      reconcileStoryRuntimeState(app.state, "left panel group Tessa smoke seed");
      scheduleActiveGameSave();
      render();
      devAssert(/Smoke Fixture Objective Chain/i.test(template.title || "") && /Smoke Chain Tester/i.test(app.state.player?.name || ""), "Synthetic objective-chain story is active", {
        title: template.title,
        player: app.state.player?.name
      });
      devAssert(!!$("leftGroupTabs"), "left panel group tabs render");
      devAssert(!!$("leftGroupBody"), "left panel group body renders");
      devAssert(!$("contextDrawer"), "context drawer was removed");
      devAssert(!!$("imagePanel"), "right column remains the image column");
      setLeftPanelGroup("characters");
      devAssert(!!$("playerList"), "characters group renders player list");
      devAssert(!!$("characterList"), "characters group renders character list");
      devAssert(!!$("npcSceneList"), "characters group renders NPC list");
      setLeftPanelGroup("objective");
      devAssert(!!$("questCard"), "objective group renders selected objective");
      devAssert(!/Set Objective|No Current Objective/i.test($("leftGroupBody")?.textContent || ""), "objective group removes redundant set/no-current controls");
      devAssert(/Main Story/i.test($("leftGroupBody")?.textContent || "") && /Side Objectives/i.test($("leftGroupBody")?.textContent || ""), "objective group includes main and side lists");
      openObjectivePickerModal("force-the-contract-onto-the-table");
      devAssert(/Stop Tracking/i.test($("modalBox")?.textContent || "") && !/Set Objective|No Current Objective/i.test($("modalBox")?.textContent || ""), "objective modal uses the merged simple picker");
      closeModal();
      setLeftPanelGroup("scene");
      devAssert(/Location/i.test($("leftGroupBody")?.textContent || "") && /In Scene/i.test($("leftGroupBody")?.textContent || "") && /In Images/i.test($("leftGroupBody")?.textContent || ""), "scene group renders location, scene names, and image names");
      devAssert(!/Open Map|Travel/i.test($("leftGroupBody")?.textContent || ""), "scene group does not include map navigation");
      setLeftPanelSectionOpen("objective-main", false);
      devAssert(app.settings.leftPanelSections?.["objective-main"] === false, "left panel dropdown state persists");
      $("leftPanel").scrollTop = 37;
      saveLeftPanelScroll();
      devAssert(Number(app.settings.leftPanelScroll?.[app.settings.leftPanelGroup] || 0) >= 0, "left panel scroll state persists");
      devAssert(getComputedStyle(document.querySelector(".composer")).gridArea === "composer", "composer remains in composer grid area");
      addMessage("system", "Left panel group Tessa smoke test passed.");
      scheduleActiveGameSave();
      render();
      devTestLog("Scenario complete: left-panel-group-tessa-smoke", {
        template: template.title,
        selectedGroup: app.settings.leftPanelGroup
      });
    } finally {
      devCancelSmokeImageWorkForRestore();
      await app.work.flush();
      await devCleanupSmokeStoryLibraryArtifacts("left panel group Tessa smoke story artifacts cleaned");
      const titleImages = exactStoryTitleCardImageStore(app.storyTitleCardImages || []);
      const profileImages = exactProfileImageStore(app.profileImages || []);
      if (titleImages.length) await deletePerRecordLibraryRecords(STORY_TITLE_CARD_IMAGE_KEY, titleImages.map(image => ({
        id: image.id
      })));
      if (profileImages.length) await deletePerRecordLibraryRecords(PROFILE_IMAGE_KEY, profileImages.map(image => ({
        id: image.id
      })));
      app.storyTitleCardImages = [];
      app.profileImages = [];
      await flushLargeSaves();
    }
  }
  async function devRunTessaNaturalPlaythroughTest() {
    devTestLog("Scenario start: tessa-natural-playthrough");
    await devSeedTessaPlaytestData();
    const template = (app.storyTemplates || []).find(item => String(item.id || "") === "story-tessa-castle-deassle-rev22" || String(item.title || "").includes("Tessa the Tasslebearer"));
    devAssert(!!template?.state, "Tessa template is available for natural playthrough");
    // SANITIZE KEEP (dev fixture): smoke test loads a full template state through the boundary normalizer.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState(clone(template.state));
    app.messages = clone(template.messages || []);
    app.images = [];
    app.queue = [];
    app.busy = false;
    app.state.meta ||= {};
    app.state.meta.setup_complete = true;
    app.mainMenuOpen = false;
    app.settings.playerInputHelpSeen = true;
    reconcileStoryRuntimeState(app.state, "tessa natural playthrough seed");
    scheduleActiveGameSave();
    render();
    const objectiveById = id => app.state.objectives?.items?.find(item => item.id === id);
    const waitForIdle = async label => {
      await devWaitFor(() => !app.busy && !app.queue.length, 150000, `${label} to finish`);
      await devWaitFor(() => app.turnStage !== "reply" && app.turnStage !== "assistant_state", 30000, `${label} turn stage idle`).catch(() => {});
    };
    const playTurn = async ({
      id,
      objectiveId = "",
      explore = false,
      text
    }) => {
      if (objectiveId) {
        setObjectiveFocus(objectiveId);
        devAssert(currentObjectiveTarget()?.id === objectiveId, `selected objective for turn ${id}`, currentObjectiveTarget());
      } else if (explore) {
        clearCurrentObjective({
          close: false
        });
        devAssert(!currentObjectiveTarget(), `cleared current objective for exploration turn ${id}`, selectedObjectiveRuntime(app.state));
      }
      const beforeMessages = app.messages.length;
      await devSendComposerMessageLikePlayer(text);
      await waitForIdle(`turn ${id}`);
      devAssert(app.messages.length >= beforeMessages + 2, `turn ${id} generated a player message and assistant reply`, {
        beforeMessages,
        afterMessages: app.messages.length
      });
    };
    const assertComplete = id => devAssert(objectiveIsComplete(objectiveById(id)), `natural playthrough completed objective: ${id}`, objectiveById(id));
    await playTurn({
      id: "explore-throne-hall",
      explore: true,
      text: "Before dealing with the confessor, I slowly inspect the throne hall, the contract table, the servants, and the nervous knights. I want to learn who looks afraid, who looks guilty, and where the contract is being guarded."
    });
    await playTurn({
      id: "father-hardon",
      objectiveId: "break-the-confessors-blockade",
      text: "I step forward and challenge Father Hardon in front of the entire court. \"No private purity inspection. Defend your rules in public or admit they are fake.\" I force him to explain himself until Lord De'Assle and the servants can see that his inspection demand is a scam, then I make him step aside."
    });
    assertComplete("break-the-confessors-blockade");
    devAssert(app.state.objectives?.pending_choice?.objective_ids?.length >= 3 || objectiveCanBeSelected(objectiveById("force-the-contract-onto-the-table"), app.state), "first objective exposes multiple next choices during natural playthrough", app.state.objectives);
    await playTurn({
      id: "claim-contract",
      objectiveId: "force-the-contract-onto-the-table",
      text: "I turn from Father Hardon to Lord De'Assle and tap the crypt contract. \"The obstacle is gone. Put my name on the job, stamp it, and tell every clerk in this castle that the lower crypt contract belongs to me.\" I stay at the table until the contract is formally granted."
    });
    assertComplete("force-the-contract-onto-the-table");
    await playTurn({
      id: "signature",
      objectiveId: "get-a-real-signature",
      text: "I keep the contract on the table and force Lord De'Assle to sign it properly in front of witnesses, so nobody can pretend the lower crypt job was never granted."
    });
    assertComplete("get-a-real-signature");
    await playTurn({
      id: "guards-question",
      objectiveId: "question-the-returned-guards",
      text: "I visit the embarrassed guards and question them carefully about the lower crypt. I get them to describe the route, the doors, the sounds, and the many-handed thing that scared them."
    });
    assertComplete("question-the-returned-guards");
    await playTurn({
      id: "maid-whisper",
      objectiveId: "follow-the-maids-whisper",
      text: "I follow the maid's whisper out of the public hall and listen carefully to what the servants know about Father Hardon's hidden leverage."
    });
    assertComplete("follow-the-maids-whisper");
    await playTurn({
      id: "ledger-search",
      objectiveId: "steal-the-purity-ledger",
      text: "I search the Rectory of Reflection. I check Father Hardon's desk, shelves, loose stones, and hidden compartments until I find his hidden purity ledger and take it."
    });
    assertComplete("steal-the-purity-ledger");
    await playTurn({
      id: "ledger-expose",
      objectiveId: "expose-the-ledger",
      text: "I carry the purity ledger back into public view and read out enough entries for the court, servants, and guards to understand Father Hardon's scam. I make sure the ledger is witnessed so it cannot be buried."
    });
    assertComplete("expose-the-ledger");
    await playTurn({
      id: "knights",
      objectiveId: "shame-the-knights-bench",
      text: "I confront the sniggering knights in the training yard. I beat them in a public contest of courage and authority until they stop mocking me and admit I am the one handling the castle's crisis."
    });
    assertComplete("shame-the-knights-bench");
    await playTurn({
      id: "servants-key",
      objectiveId: "earn-the-laundry-key",
      text: "I speak with the servants respectfully and use what I learned in the hall to earn their trust. I convince them to give me the laundry passage key into the lower crypt."
    });
    assertComplete("earn-the-laundry-key");
    await playTurn({
      id: "confessor-key",
      objectiveId: "take-the-gold-key",
      text: "With the ledger exposed, I return to Father Hardon's office and claim the gold key he used as leverage. I take possession of the Confessor's gold key and make sure nobody can take it back."
    });
    assertComplete("take-the-gold-key");
    await playTurn({
      id: "knights-key",
      objectiveId: "claim-the-iron-key",
      text: "I demand the iron key from the chastened knights. They surrender the old armory stair key, and I add the knights' iron key to the silver and gold keys."
    });
    assertComplete("claim-the-iron-key");
    await playTurn({
      id: "prepare-descent",
      objectiveId: "prepare-the-descent-plan",
      text: "I gather the stamped contract, the guards' testimony, and the completed keyring. I make the final descent plan at the crypt entrance and assign everyone their role before we open the way down."
    });
    assertComplete("prepare-the-descent-plan");
    await playTurn({
      id: "enter-crypt",
      objectiveId: "enter-the-pantsless-crypt",
      text: "I unlock the lower doors and descend into the pantsless crypt. I cross the threshold, enter the lower crypts beneath Castle De'Assle, and follow the signs of the many-handed menace."
    });
    assertComplete("enter-the-pantsless-crypt");
    await playTurn({
      id: "oath-seals",
      objectiveId: "survive-the-oath-seals",
      text: "I push through the oath seals and keep moving until their traps, warnings, and shame magic no longer block the descent."
    });
    assertComplete("survive-the-oath-seals");
    await playTurn({
      id: "final-menace",
      objectiveId: "face-the-many-handed-warden",
      text: "I confront the many-handed menace in its chamber. I use the contract authority, the guards' route, and the three-key access to defeat or neutralize it completely, ending the lower crypt crisis for Castle De'Assle."
    });
    assertComplete("face-the-many-handed-warden");
    await playTurn({
      id: "warden-fate",
      objectiveId: "choose-the-wardens-fate",
      text: "I decide the warden's fate clearly and make the court accept that choice as part of resolving the crypt's curse."
    });
    assertComplete("choose-the-wardens-fate");
    await playTurn({
      id: "shame-engine",
      objectiveId: "break-the-castles-shame-engine",
      text: "I break the castle's shame engine so Father Hardon's rules and the crypt's old punishment cannot keep controlling people."
    });
    assertComplete("break-the-castles-shame-engine");
    await playTurn({
      id: "payment",
      objectiveId: "settle-the-contract-payment",
      text: "I return with the contract resolved and demand the promised payment for ending the lower crypt crisis."
    });
    assertComplete("settle-the-contract-payment");
    devAssert(app.state.objectives.items.every(objectiveIsComplete), "natural playthrough completed every Tessa objective", app.state.objectives);
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: tessa-natural-playthrough");
  }
  function devResetForLiveTest(label) {
    cancelActiveStateWork(`live test ${label}`);
    disableAutoVisualNovel(`live test ${label}`);
    cancelTurnSceneImageCollector();
    // Each smoke installs a complete synthetic runtime. Detach mutation
    // observation before replacing that root so a timed-out prior smoke
    // cannot route fixture setup into its still-open save session.
    app.saveSessionActive = false;
    app.saveSessionContext = null;
    cancelSaveProjectionFlush();
    cleanupSmokeScenarioUi();
    clearTimeout(app.activeGameSaveTimer);
    app.activeGameSaveTimer = null;
    app.activeGameSaveDeadlineAt = 0;
    app.activeGameSaveDirty = false;
    app.activeGameSavePendingReason = "";
    app.activeGameSaveQueuedCount = 0;
    app.activeGameSaveFirstQueuedAt = 0;
    app.activeGameSaveRunning = false;
    app.queue = [];
    app.busy = false;
    app.voicePaused = false;
    app.narrationModalPauseDepth = 0;
    app.narrationModalPausedSpeech = false;
    app.worldGenerationJob = null;
    app.worldGenerationLoadingActive = false;
    app.worldGenerationStarted = false;
    app.worldGenerationProgress = null;
    app.pendingWorldGenerationPrompt = "";
    app.mainMenuOpen = false;
    // Smoke reset must not simulate a fresh page load for the pre-main

    // tests explicitly reset these flags when they need to exercise it.
    app.onboardingDraft = null;
    clearTimeout(app.startupBlankReplyRepairTimer);
    app.startupBlankReplyRepairTimer = null;
    app.startupBlankReplyRepairStarted = false;
    app.startupBlankReplyRepairNoticeShown = false;
    app.messages = [];
    app.images = [];
    app.activeImageRequests = new Set();
    app.normalImagePriorityUntil = 0;
    app.profileImages = [];
    app.deletedProfileImageIds = new Set();
    app.profileEntityOverrides = {};
    app.profileImageQueue = [];
    app.profileImageGenerating = new Set();
    app.profileImageQueued = new Set();
    app.activeProfileImageRequests = new Set();
    app.profileImageRequestOwnerById = {};
    app.activeProfileImageRequestByOwner = {};
    app.supersededProfileImageRequests = new Set();
    app.profileImageQueueRunning = false;
    app.pendingEditorProfileRefreshes = {};
    app.storyTitleCardImages = [];
    app.storyTitleCardGenerating = new Map();
    app.storyTitleCardGenerationTokens = {};
    app.storyTitleCardGenerationFailed = new Set();
    app.storyTitleCardImportPreparing = new Set();
    app.storyTitleCardImportErrors = {};
    app.storyTitleCardLiveHtmlCache = {};
    for (const hostKey of Object.keys(imageGenerationIframeHostMap())) removeImageGenerationIframeHost(hostKey, `smoke reset ${label}`);
    if (!globalThis.__emberAdventuresKeepSmokeImagePluginOverride && globalThis.__emberAdventuresPluginOverrides) delete globalThis.__emberAdventuresPluginOverrides.textToImagePlugin;
    if (globalThis.__emberAdventuresKeepSmokeImagePluginOverride) {
      devAssert(typeof globalThis.__emberAdventuresPluginOverrides?.textToImagePlugin === "function", "deterministic image smoke provider survives the scenario reset", {
        label
      });
    }
    app.snapshots = [];
    // SANITIZE KEEP (dev fixture): test reset normalizes defaultState before synthetic scenarios.
    // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
    app.state = repairAiGeneratedState(clone(defaultState));
    app.state.location = {
      ...(app.state.location || {}),
      npc_location_id: "smoke-start",
      specific_place: "Smoke Start"
    };
    app.state.npc_directory = {
      locations: {
        "smoke-start": {
          label: "Smoke Start",
          characters: {}
        }
      }
    };
    app.state.meta ||= {};
    app.state.meta.smoke_test_runtime = true;
    // Each smoke authors its synthetic fixture before installing an immutable
    // definition revision. Never let a prior scenario's frozen definition or
    // dirty aggregate ownership leak into the next scenario.
    app.storyDefinition = null;
    app.objectiveRuntime = createEmptyObjectiveRuntime();
    app.objectiveRuntimeLookup = null;
    app.objectiveRuntimeNeedsFullSync = false;
    app.rewardRuntime = {
      appliedInvocationIds: {}
    };
    app.jobRuntime = {
      activeJobsById: {},
      runtimeByJobId: {}
    };
    app.storyRulesRuntime = {
      added: [],
      removedKeys: []
    };
    app.runtimeDefinitions = {
      jobsById: {},
      charactersById: {},
      locationsById: {}
    };
    // Smoke scenarios author their fixture after reset, then explicitly
    // compile it before exercising immutable-definition runtime behavior.
    runtimeAggregateDirtyTracker.baselineRequired = true;
    runtimeAggregateDirtyTracker.records.clear();
    runtimeAggregateDirtyTracker.messages.clear();
    runtimeAggregateDirtyTracker.snapshots.clear();
    runtimeAggregateDirtyTracker.images.clear();
    runtimeAggregateDirtyTracker.inFlight.clear();
    runtimeAggregateDirtyTracker.lastPersistedRecordKeys.clear();
    runtimeAggregateDirtyTracker.lastPersistedMessageIds.clear();
    runtimeAggregateDirtyTracker.lastPersistedSnapshotIds.clear();
    runtimeAggregateDirtyTracker.lastPersistedImageIds.clear();
    setActiveSaveId("");
    assertExactMessageStorage();
  }
  async function devCompileCurrentStoryFixture(label = "smoke fixture") {
    const state = runtimeSaveUnwrap(app.state);
    state.meta ||= {};
    state.meta.smoke_test_runtime = true;
    const compiled = await compileStoryDefinitionRuntimeInWorker(state, {
      definitionRevisionId: generatedPersistentId(`smoke-${safeRuntimeIdPart(label)}`),
      onProgress: message => {
        const suite = devSmokeSuiteState();
        suite.currentScenarioProgress = String(message || "Building story definition");
        renderDevSmokeSuiteStatus();
      }
    });
    adoptWorkerCompiledStoryDefinition(compiled, app.state);
    return app.storyDefinition;
  }
  async function devInstallObjectiveFixture(objectives = {}, label = "objective fixture") {
    app.storyDefinition = null;
    app.objectiveRuntime = createEmptyObjectiveRuntime();
    app.objectiveRuntimeLookup = null;
    app.objectiveRuntimeNeedsFullSync = false;
    const state = runtimeSaveUnwrap(app.state);
    state.objectives = clone(objectives);
    state.objectives.active_id = String(state.objectives.active_id || "");
    state.objectives.no_current = state.objectives.no_current === true;
    return devCompileCurrentStoryFixture(label);
  }
  function devUpsertStoryTemplatesForSmoke(records = []) {
    // Smoke library rule: smoke fixtures may add temporary story
    // templates, but must never replace the player's imported story
    // library. Story-dependent smokes read from that library.
    const existing = Array.isArray(app.storyTemplates) ? app.storyTemplates : [];
    const normalizedRecords = [];
    for (const source of records || []) {
      const completedSource = devCompleteSmokeObjectiveGuidance(source);
      assertValidStoryDefinition(completedSource, "smoke story fixture");
      const record = validatedStoryTemplateRecord(completedSource);
      assertValidStoryDefinition(record, "normalized smoke story fixture");
      applyValidatedStoryDefinitionArtifact(record);
      normalizedRecords.push(record);
    }
    const recordIds = new Set(normalizedRecords.map(record => String(record.id || "")));
    app.storyTemplates = [...existing.filter(record => !recordIds.has(String(record.id || ""))), ...normalizedRecords];
    if (normalizedRecords.length) queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, normalizedRecords, "smoke story templates upserted");
    return normalizedRecords;
  }
  function devCompleteSmokeObjectiveGuidance(source = {}) {
    const completed = clone(source);
    const objectives = completed?.state?.objectives?.items || completed?.objectives || [];
    for (const objective of objectives) {
      if (!isPlainObject(objective)) continue;
      if (textSlot(objective.while_active_guidance, "")) continue;
      objective.while_active_guidance = `Keep the fake smoke-test scene focused on ${textSlot(objective.title, objective.id || "this objective")}.`;
    }
    return completed;
  }
  function devSettingsSnapshotForSmoke() {
    return {settings: clone(localSettingsForStorage())};
  }
  function devInstallSmokeSettingsSandbox(settings) {
    let storedSettings = clone(settings);
    const original = {listSettings: app.library.listSettings, putSettings: app.library.putSettings, deleteSettings: app.library.deleteSettings};
    app.library.listSettings = async () => {
      const values = await original.listSettings();
      if (storedSettings === null) delete values[SETTINGS_KEY];
      else values[SETTINGS_KEY] = clone(storedSettings);
      return values;
    };
    app.library.putSettings = async values => {
      if (Object.hasOwn(values, SETTINGS_KEY)) storedSettings = clone(values[SETTINGS_KEY]);
      const remaining = Object.fromEntries(Object.entries(values).filter(([key]) => key !== SETTINGS_KEY));
      return Object.keys(remaining).length ? original.putSettings(remaining) : {saved: 1};
    };
    app.library.deleteSettings = async keys => {
      if (keys.includes(SETTINGS_KEY)) storedSettings = null;
      const remaining = keys.filter(key => key !== SETTINGS_KEY);
      return remaining.length ? original.deleteSettings(remaining) : {deleted: 1};
    };
    return {restore() {
      app.library.listSettings = original.listSettings;
      app.library.putSettings = original.putSettings;
      app.library.deleteSettings = original.deleteSettings;
    }};
  }
  function devPublicLibraryRuntimeSnapshotForSmoke() {
    const characterPayloads = {
      ...(app.characterLibraryPublicPayloads || {})
    };
    const storyPayloads = {
      ...(app.storyLibraryPublicPayloads || {})
    };
    const snapshot = clone({
      characterLibraryOwnedCharacterEntries: app.characterLibraryOwnedCharacterEntries || [],
      characterLibraryOwnedCharactersLoading: app.characterLibraryOwnedCharactersLoading === true,
      storyLibraryOwnedStoryEntries: app.storyLibraryOwnedStoryEntries || [],
      storyLibraryOwnedStoriesLoading: app.storyLibraryOwnedStoriesLoading === true,
      publicLibraryOwnedIndex: app.publicLibraryOwnedIndex || null,
      publicLibraryLastIndex: app.publicLibraryLastIndex || null,
      publicLibraryTotalItemCounts: app.publicLibraryTotalItemCounts || {},
      characterLibraryPublicSearch: app.characterLibraryPublicSearch || null,
      storyLibraryPublicSearch: app.storyLibraryPublicSearch || null,
      characterLibraryPublicFiltersDirty: app.characterLibraryPublicFiltersDirty === true,
      storyLibraryPublicFiltersDirty: app.storyLibraryPublicFiltersDirty === true,
      characterLibraryPublicCriteriaRevision: app.characterLibraryPublicCriteriaRevision || 0,
      storyLibraryPublicCriteriaRevision: app.storyLibraryPublicCriteriaRevision || 0,
      publicLibrarySearchCache: app.publicLibrarySearchCache || null,
      publicLibrarySearchCacheLoaded: app.publicLibrarySearchCacheLoaded === true,
      ownedPublicLibraryVersionStateCache: app.ownedPublicLibraryVersionStateCache || {},
      hiddenPublicLibraryCacheMembership: app.hiddenPublicLibraryCacheMembership || {},
      characterLibraryLastTab: app.characterLibraryLastTab || "local",
      storyLibraryLastTab: app.storyLibraryLastTab || "local"
    });
    // Hosted payloads can contain complete stories and embedded character
    // definitions. Cache isolation needs a new key container, not a deep
    // copy of immutable payload values; cloning those values can create a
    // large delayed garbage-collection burst after every smoke run.
    snapshot.characterLibraryPublicPayloads = characterPayloads;
    snapshot.storyLibraryPublicPayloads = storyPayloads;
    return snapshot;
  }
  function devRestorePublicLibraryRuntimeSnapshotForSmoke(snapshot = {}) {
    app.characterLibraryOwnedCharacterEntries = clone(snapshot.characterLibraryOwnedCharacterEntries || []);
    app.characterLibraryOwnedCharactersLoading = snapshot.characterLibraryOwnedCharactersLoading === true;
    app.storyLibraryOwnedStoryEntries = clone(snapshot.storyLibraryOwnedStoryEntries || []);
    app.storyLibraryOwnedStoriesLoading = snapshot.storyLibraryOwnedStoriesLoading === true;
    app.publicLibraryOwnedIndex = clone(snapshot.publicLibraryOwnedIndex || null);
    app.publicLibraryLastIndex = clone(snapshot.publicLibraryLastIndex || null);
    app.publicLibraryTotalItemCounts = clone(snapshot.publicLibraryTotalItemCounts || {});
    app.characterLibraryPublicSearch = clone(snapshot.characterLibraryPublicSearch || null);
    app.storyLibraryPublicSearch = clone(snapshot.storyLibraryPublicSearch || null);
    if (app.characterLibraryPublicSearch) app.characterLibraryPublicSearch.loading = false;
    if (app.storyLibraryPublicSearch) app.storyLibraryPublicSearch.loading = false;
    app.characterLibraryPublicFiltersDirty = snapshot.characterLibraryPublicFiltersDirty === true;
    app.storyLibraryPublicFiltersDirty = snapshot.storyLibraryPublicFiltersDirty === true;
    app.characterLibraryPublicCriteriaRevision = snapshot.characterLibraryPublicCriteriaRevision || 0;
    app.storyLibraryPublicCriteriaRevision = snapshot.storyLibraryPublicCriteriaRevision || 0;
    app.characterLibraryPublicPayloads = {
      ...(snapshot.characterLibraryPublicPayloads || {})
    };
    app.storyLibraryPublicPayloads = {
      ...(snapshot.storyLibraryPublicPayloads || {})
    };
    app.publicLibrarySearchCache = clone(snapshot.publicLibrarySearchCache || null);
    app.publicLibrarySearchCacheLoaded = snapshot.publicLibrarySearchCacheLoaded === true;
    app.ownedPublicLibraryVersionStateCache = clone(snapshot.ownedPublicLibraryVersionStateCache || {});
    app.hiddenPublicLibraryCacheMembership = clone(snapshot.hiddenPublicLibraryCacheMembership || {});
    app.characterLibraryLastTab = snapshot.characterLibraryLastTab || "local";
    app.storyLibraryLastTab = snapshot.storyLibraryLastTab || "local";
  }
  async function devAssertExactSettingsSnapshotForSmoke(snapshot = {}) {
    const stored = (await app.library.listSettings())[SETTINGS_KEY];
    if (JSON.stringify(localSettingsForStorage()) !== JSON.stringify(snapshot.settings) || JSON.stringify(stored) !== JSON.stringify(snapshot.settings))
      throw new Error("Smoke settings restoration failed.");
    return true;
  }
  function devSelectSettingsForSmokeScenario(scenario = {}) {
    devResetPreferenceSettingsForSmoke();
    app.settings.devMode = true;
  }
  async function devRestoreSettingsSnapshotForSmoke(snapshot = {}) {
    app.settings = hydrateRuntimeSettingsFromExactStoredSettings(snapshot.settings);
    await saveSettingsNow("smoke settings restored");
    await flushLargeSaves();
    await devAssertExactSettingsSnapshotForSmoke(snapshot);
  }
  function devSmokeClone(value) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch {
        // Some runtime smoke fixtures retain DOM/plugin objects. Their
        // established JSON snapshot remains the compatible fallback.
      }
    }
    return clone(value);
  }
  function devSaveLibrarySnapshotForSmoke() {
    return {
      saveIndex: devSmokeClone(saveIndexRecords()),
      activeSaveId: activeSaveId(),
      runtime: {
        state: devSmokeClone(app.state || defaultState),
        messages: devSmokeClone(app.messages || []),
        images: devSmokeClone(app.images || []),
        snapshots: devSmokeClone(app.snapshots || []),
        snapshotHeadExtraReverseChanges: devSmokeClone(app.snapshotHeadExtraReverseChanges || []),
        activeSaveId: activeSaveId(),
        storyDefinition: devSmokeClone(app.storyDefinition || null),
        runtimeDefinitions: devSmokeClone(app.runtimeDefinitions || null),
        objectiveRuntime: devSmokeClone(app.objectiveRuntime || null),
        rewardRuntime: devSmokeClone(app.rewardRuntime || null),
        storyRulesRuntime: devSmokeClone(app.storyRulesRuntime || null),
        jobRuntime: devSmokeClone(app.jobRuntime || null),
        saveSessionContext: devSmokeClone(app.saveSessionContext || null),
        saveSessionActive: app.saveSessionActive === true,
        existingGameMessagePage: devSmokeClone(app.existingGameMessagePage || null)
      }
    };
  }
  function devFullLibrarySnapshotForSmoke() {
    return {
      storyTemplates: devSmokeClone(app.storyTemplates || []),
      storyTitleCardImages: devSmokeClone(app.storyTitleCardImages || []),
      characterDefinitions: devSmokeClone(app.characterDefinitions || []),
      profileImages: devSmokeClone(app.profileImages || []),
      settingsSnapshot: devSettingsSnapshotForSmoke(),
      saveLibrary: devSaveLibrarySnapshotForSmoke()
    };
  }
  function devSmokeRecordIdSet(records = [], idForRecord = record => record?.id) {
    return new Set((Array.isArray(records) ? records : []).map(record => String(idForRecord(record) || "").trim()).filter(Boolean));
  }
  function devSmokeAddedRecordIds(current = [], original = [], idForRecord = record => record?.id) {
    const originalIds = devSmokeRecordIdSet(original, idForRecord);
    return [...devSmokeRecordIdSet(current, idForRecord)].filter(id => !originalIds.has(id));
  }
  function devSmokeMissingRecordIds(current = [], original = [], idForRecord = record => record?.id) {
    const currentIds = devSmokeRecordIdSet(current, idForRecord);
    return [...devSmokeRecordIdSet(original, idForRecord)].filter(id => !currentIds.has(id));
  }
  function devSmokeAddedStorageIds(current = [], originalIds = [], key = "") {
    const original = new Set((Array.isArray(originalIds) ? originalIds : []).map(id => String(id || "").trim()).filter(Boolean));
    return (Array.isArray(current) ? current : []).map(record => libraryRecordStorageId(key, record)).filter(id => id && !original.has(id));
  }
  function devSmokeMissingStorageIds(current = [], originalIds = [], key = "") {
    const currentIds = new Set((Array.isArray(current) ? current : []).map(record => String(libraryRecordStorageId(key, record) || "").trim()).filter(Boolean));
    return (Array.isArray(originalIds) ? originalIds : []).map(id => String(id || "").trim()).filter(id => id && !currentIds.has(id));
  }
  async function devSmokeCreatedArtifactDifferences(librarySnapshot = {}, persistentSnapshot = {}, options = {}) {
    const storedSaveRecords = app.persistence?.started ? (await app.persistence.listSaves({}))?.entries || [] : saveIndexRecords();
    if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true) {
      const saveLibrary = librarySnapshot.saveLibrary || {};
      return {
        storyTemplates: devSmokeAddedRecordIds(app.storyTemplates, librarySnapshot.storyTemplates),
        missingStoryTemplates: devSmokeMissingRecordIds(app.storyTemplates, librarySnapshot.storyTemplates),
        storyTitleCardImages: devSmokeAddedRecordIds(app.storyTitleCardImages, librarySnapshot.storyTitleCardImages),
        missingStoryTitleCardImages: devSmokeMissingRecordIds(app.storyTitleCardImages, librarySnapshot.storyTitleCardImages),
        characterDefinitions: devSmokeAddedRecordIds(app.characterDefinitions, librarySnapshot.characterDefinitions),
        missingCharacterDefinitions: devSmokeMissingRecordIds(app.characterDefinitions, librarySnapshot.characterDefinitions),
        profileImages: devSmokeAddedRecordIds(app.profileImages, librarySnapshot.profileImages),
        missingProfileImages: devSmokeMissingRecordIds(app.profileImages, librarySnapshot.profileImages),
        saves: devSmokeAddedRecordIds(storedSaveRecords, saveLibrary.saveIndex, record => record?.saveId),
        missingSaves: devSmokeMissingRecordIds(storedSaveRecords, saveLibrary.saveIndex, record => record?.saveId),
        runtimeImages: devSmokeAddedRecordIds(app.images, saveLibrary.runtime?.images),
        missingRuntimeImages: devSmokeMissingRecordIds(app.images, saveLibrary.runtime?.images),
        localStorageKeys: [],
        largeStorageKeys: [],
        missingLocalStorageKeys: [],
        missingLargeStorageKeys: []
      };
    }
    await flushLargeSaves();
    const fastScenarioCheck = options.fastScenarioCheck === true;
    const storedStoryTemplates = fastScenarioCheck ? app.storyTemplates || [] : await loadPerRecordLibrary(STORY_TEMPLATE_KEY, app.storyTemplates || [], {
      deferStoryValidation: true
    });
    const storedStoryTitleCardImages = fastScenarioCheck ? [] : await loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || []);
    const storedCharacterDefinitions = fastScenarioCheck ? app.characterDefinitions || [] : await loadPerRecordLibrary(CHARACTER_LIBRARY_KEY, app.characterDefinitions || []);
    const storedProfileImages = fastScenarioCheck ? [] : await loadPerRecordLibrary(PROFILE_IMAGE_KEY, app.profileImages || []);
    const settingsSnapshot = librarySnapshot.settingsSnapshot || {};
    const saveLibrary = librarySnapshot.saveLibrary || {};
    const runtime = saveLibrary.runtime || {};
    const originalLocalKeys = new Set(Object.keys(persistentSnapshot.local || {}));
    const originalLargeKeys = new Set(Object.keys(persistentSnapshot.large || {}));
    const currentLocalKeys = new Set(smokeLocalStorageKeys());
    const currentLargeKeys = new Set(await smokeLargeStorageKeys());
    return {
      storyTemplates: devSmokeAddedStorageIds(storedStoryTemplates, librarySnapshot.persistentLibraryIds?.storyTemplates, STORY_TEMPLATE_KEY),
      missingStoryTemplates: devSmokeMissingStorageIds(storedStoryTemplates, librarySnapshot.persistentLibraryIds?.storyTemplates, STORY_TEMPLATE_KEY),
      storyTitleCardImages: fastScenarioCheck ? [] : devSmokeAddedStorageIds(storedStoryTitleCardImages, librarySnapshot.persistentLibraryIds?.storyTitleCardImages, STORY_TITLE_CARD_IMAGE_KEY),
      missingStoryTitleCardImages: fastScenarioCheck ? [] : devSmokeMissingStorageIds(storedStoryTitleCardImages, librarySnapshot.persistentLibraryIds?.storyTitleCardImages, STORY_TITLE_CARD_IMAGE_KEY),
      characterDefinitions: devSmokeAddedStorageIds(storedCharacterDefinitions, librarySnapshot.persistentLibraryIds?.characterDefinitions, CHARACTER_LIBRARY_KEY),
      missingCharacterDefinitions: devSmokeMissingStorageIds(storedCharacterDefinitions, librarySnapshot.persistentLibraryIds?.characterDefinitions, CHARACTER_LIBRARY_KEY),
      profileImages: fastScenarioCheck ? [] : devSmokeAddedStorageIds(storedProfileImages, librarySnapshot.persistentLibraryIds?.profileImages, PROFILE_IMAGE_KEY),
      missingProfileImages: fastScenarioCheck ? [] : devSmokeMissingStorageIds(storedProfileImages, librarySnapshot.persistentLibraryIds?.profileImages, PROFILE_IMAGE_KEY),
      saves: devSmokeAddedRecordIds(storedSaveRecords, saveLibrary.saveIndex, record => record?.saveId),
      missingSaves: devSmokeMissingRecordIds(storedSaveRecords, saveLibrary.saveIndex, record => record?.saveId),
      runtimeImages: devSmokeAddedRecordIds(app.images, runtime.images),
      missingRuntimeImages: devSmokeMissingRecordIds(app.images, runtime.images),
      localStorageKeys: [...currentLocalKeys].filter(key => !originalLocalKeys.has(key)),
      largeStorageKeys: [...currentLargeKeys].filter(key => !originalLargeKeys.has(key)),
      missingLocalStorageKeys: [...originalLocalKeys].filter(key => !currentLocalKeys.has(key)),
      missingLargeStorageKeys: [...originalLargeKeys].filter(key => !currentLargeKeys.has(key))
    };
  }
  function devSmokeScenarioArtifactDifferenceMessages(differences = {}) {
    const scenarioDifferences = {
      ...differences
    };
    delete scenarioDifferences.runtimeImages;
    delete scenarioDifferences.missingRuntimeImages;
    return devSmokeArtifactDifferenceMessages(scenarioDifferences);
  }
  function devSmokeArtifactDifferenceMessages(differences = {}) {
    return Object.entries(differences).filter(([, values]) => Array.isArray(values) && values.length).map(([type, values]) => `${type}: ${values.join(", ")}`);
  }
  async function devAbandonOrderedWorkForSmokeRestore(reason = "smoke restore") {
    // Library writes share the worker but are not part of the synthetic save session.
    for (const lane of app.work.orderedSnapshot?.() || []) {
      if (!String(lane.resourceKey).startsWith("library:")) continue;
      if ((await app.work.flush(lane.resourceKey)) === false) throw new Error(`${reason}: library work failed before smoke rollback.`);
    }
    const orderedWork = app.work.orderedSnapshot?.() || [];
    for (const lane of orderedWork) app.work.abandonOrdered(lane.resourceKey, `${reason}: abandoned leftover ordered work`);
    if (orderedWork.some(lane => lane.running && String(lane.resourceKey).startsWith("save:"))) await app.persistence.abandonActiveSaveForTest();
    if (orderedWork.length) devTestLog("Smoke cleanup abandoned leftover ordered work", {
      reason,
      orderedWork
    });
    return orderedWork;
  }
  async function devRemoveLateSmokeLibraryArtifacts(differences = {}) {
    const libraries = [{
      differenceKey: "storyTemplates",
      storageKey: STORY_TEMPLATE_KEY,
      appKey: "storyTemplates",
      normalize: records => records
    }, {
      differenceKey: "storyTitleCardImages",
      storageKey: STORY_TITLE_CARD_IMAGE_KEY,
      appKey: "storyTitleCardImages",
      normalize: exactStoryTitleCardImageStore
    }, {
      differenceKey: "characterDefinitions",
      storageKey: CHARACTER_LIBRARY_KEY,
      appKey: "characterDefinitions",
      normalize: validatedCharacterLibraryDefinitions
    }, {
      differenceKey: "profileImages",
      storageKey: PROFILE_IMAGE_KEY,
      appKey: "profileImages",
      normalize: exactProfileImageStore
    }];
    let removed = false;
    for (const library of libraries) {
      const ids = new Set((differences[library.differenceKey] || []).map(id => String(id || "").trim()).filter(Boolean));
      if (!ids.size) continue;
      await deletePerRecordLibraryRecords(library.storageKey, [...ids].map(id => ({
        id
      })));
      app[library.appKey] = library.normalize((app[library.appKey] || []).filter(record => !ids.has(String(libraryRecordStorageId(library.storageKey, record) || ""))));
      removed = true;
    }
    return removed;
  }
  async function devCleanupDeclaredScenarioArtifacts(librarySnapshot = {}, reason = "declared smoke scenario artifacts cleaned") {
    const baselineStoryIds = devSmokeRecordIdSet(librarySnapshot.storyTemplates);
    const addedSmokeStories = (app.storyTemplates || []).filter(record => !baselineStoryIds.has(String(record?.id || "")) && isSmokeStoryLibraryArtifact(record));
    if (addedSmokeStories.length) {
      const ids = new Set(addedSmokeStories.map(record => String(record.id || "")));
      app.storyTemplates = (app.storyTemplates || []).filter(record => !ids.has(String(record?.id || "")));
      await deletePerRecordLibraryRecords(STORY_TEMPLATE_KEY, addedSmokeStories.map(record => ({
        id: libraryRecordStorageId(STORY_TEMPLATE_KEY, record)
      })));
    }
    const baselineStoryTitleCardIds = devSmokeRecordIdSet(librarySnapshot.storyTitleCardImages, record => libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record));
    const addedSmokeStoryTitleCards = (app.storyTitleCardImages || []).filter(record => {
      const id = String(libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record) || "");
      return !baselineStoryTitleCardIds.has(id) && ((devSmokeSuiteState().createdTitleImageIds || []).includes(id) || isSmokeStoryTitleCardImageArtifact(record));
    });
    if (addedSmokeStoryTitleCards.length) {
      const ids = new Set(addedSmokeStoryTitleCards.map(record => String(libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record) || "")));
      app.storyTitleCardImages = exactStoryTitleCardImageStore((app.storyTitleCardImages || []).filter(record => !ids.has(String(libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record) || ""))));
      await deletePerRecordLibraryRecords(STORY_TITLE_CARD_IMAGE_KEY, addedSmokeStoryTitleCards.map(record => ({
        id: libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record)
      })));
    }
    const baselineCharacterIds = devSmokeRecordIdSet(librarySnapshot.characterDefinitions, record => libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record));
    const addedSmokeCharacters = (app.characterDefinitions || []).filter(record => {
      const id = String(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || "");
      return !baselineCharacterIds.has(id) && isSmokeCharacterLibraryArtifact(record);
    });
    if (addedSmokeCharacters.length) {
      const ids = new Set(addedSmokeCharacters.map(record => String(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || "")));
      app.characterDefinitions = validatedCharacterLibraryDefinitions((app.characterDefinitions || []).filter(record => !ids.has(String(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || ""))));
      await deletePerRecordLibraryRecords(CHARACTER_LIBRARY_KEY, addedSmokeCharacters.map(record => ({
        id: libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record)
      })));
    }
    const baselineProfileImageIds = devSmokeRecordIdSet(librarySnapshot.profileImages, record => libraryRecordStorageId(PROFILE_IMAGE_KEY, record));
    const createdProfileImageIds = new Set(devSmokeSuiteState().createdProfileImageIds || []);
    const addedSmokeProfileImages = (app.profileImages || []).filter(record => {
      const id = String(libraryRecordStorageId(PROFILE_IMAGE_KEY, record) || "");
      return !baselineProfileImageIds.has(id) && (createdProfileImageIds.has(String(record.id)) || isSmokeProfileImageArtifact(record));
    });
    if (addedSmokeProfileImages.length) {
      const ids = new Set(addedSmokeProfileImages.map(record => String(libraryRecordStorageId(PROFILE_IMAGE_KEY, record) || "")));
      app.profileImages = exactProfileImageStore((app.profileImages || []).filter(record => !ids.has(String(libraryRecordStorageId(PROFILE_IMAGE_KEY, record) || ""))));
      await deletePerRecordLibraryRecords(PROFILE_IMAGE_KEY, addedSmokeProfileImages.map(record => ({
        id: libraryRecordStorageId(PROFILE_IMAGE_KEY, record)
      })));
    }
    const baselineSaveIds = devSmokeRecordIdSet(librarySnapshot.saveLibrary?.saveIndex, record => record?.saveId);
    const savePage = app.persistence?.started ? await app.persistence.listSaves({}) : {
      entries: saveIndexRecords()
    };
    const addedSmokeSaves = (savePage?.entries || []).filter(record => !baselineSaveIds.has(String(record?.saveId || "")) && isSmokeSaveIndexArtifact(record));
    for (const record of addedSmokeSaves) await deleteSaveStorage(record.saveId);
    if (addedSmokeStories.length || addedSmokeStoryTitleCards.length || addedSmokeCharacters.length || addedSmokeProfileImages.length || addedSmokeSaves.length) devTestLog("Declared smoke scenario artifacts cleaned", {
      reason,
      storyTemplates: addedSmokeStories.map(record => record.id),
      storyTitleCardImages: addedSmokeStoryTitleCards.map(record => libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record)),
      characterDefinitions: addedSmokeCharacters.map(record => libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record)),
      profileImages: addedSmokeProfileImages.map(record => libraryRecordStorageId(PROFILE_IMAGE_KEY, record)),
      saves: addedSmokeSaves.map(record => record.saveId)
    });
    return !!(addedSmokeStories.length || addedSmokeStoryTitleCards.length || addedSmokeCharacters.length || addedSmokeProfileImages.length || addedSmokeSaves.length);
  }
  async function devCleanupDeclaredScenarioArtifactsAfterFlush(librarySnapshot = {}, reason = "declared smoke scenario artifacts cleaned after flush") {
    const removed = await devCleanupDeclaredScenarioArtifacts(librarySnapshot, reason);
    if (removed) await flushLargeSaves();
    return removed;
  }
  async function devRestoreAndVerifySmokeBaseline(librarySnapshot = {}, persistentSnapshot = {}, reason = "smoke baseline restored") {
    devSmokeSuiteState().currentScenarioConfig = null;
    const finalCleanupErrors = [];
    const cleanupStageTimings = [];
    const timeCleanupStage = async (stage, action) => {
      const startedAt = performance.now();
      const suite = devSmokeSuiteState();
      suite.currentScenarioProgress = `Restoring smoke baseline: ${stage}`;
      writeDevSmokeRunPhase({
        phase: suite.currentScenarioProgress
      });
      renderDevSmokeSuiteStatus();
      try {
        return await action();
      } finally {
        cleanupStageTimings.push({
          stage,
          durationMs: Math.round(performance.now() - startedAt)
        });
      }
    };
    const cancelQueuedWork = () => {
      cancelSmokeSuiteScenarioWork(reason);
      devCancelSmokeImageWorkForRestore();
      devCancelSmokePersistenceWorkForRestore();
    };
    await devWithSmokeRestorePhase(async () => {
      cancelQueuedWork();
      try {
        await timeCleanupStage("abandon queued work", () => devAbandonOrderedWorkForSmokeRestore(reason));
      } catch (error) {
        finalCleanupErrors.push(`work queue: ${error?.message || error}`);
      }

      // Allow callbacks already scheduled by the scenario to enter the
      // ordered queue before the single authoritative restore pass.
      await timeCleanupStage("settle scheduled callbacks", () => new Promise(resolve => setTimeout(resolve, 0)));
      cancelQueuedWork();
      try {
        await timeCleanupStage("abandon late queued work", () => devAbandonOrderedWorkForSmokeRestore(reason));
      } catch (error) {
        finalCleanupErrors.push(`late work queue: ${error?.message || error}`);
      }
      if (app.smokeImageIsolationBaseline) {
        try {
          await timeCleanupStage("restore image-store isolation", () => app.persistence.restoreSmokeImageIsolation(app.smokeImageIsolationBaseline));
        } catch (error) {
          finalCleanupErrors.push(`image stores: ${error?.message || error}`);
        }
      }
      if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true) {
        try {
          await timeCleanupStage("clean hosted uploads", () => devCleanupSmokeHostedUploads(reason));
        } catch (error) {
          finalCleanupErrors.push(`hosted uploads: ${error?.message || error}`);
        }
      }
      cleanupSmokeScenarioUi();
      try {
        await timeCleanupStage("restore libraries and active save", () => devRestoreFullLibrarySnapshotForSmoke(librarySnapshot, reason));
      } catch (error) {
        finalCleanupErrors.push(`library records: ${error?.message || error}`);
      }
      devRestorePublicLibraryRuntimeSnapshotForSmoke(librarySnapshot.publicLibraryRuntime || {});
      if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true) {
        try {
          await timeCleanupStage("restore persistent settings", () => devRestorePersistentStorageSnapshotForSmoke(persistentSnapshot));
        } catch (error) {
          finalCleanupErrors.push(`persistent settings: ${error?.message || error}`);
        }
      }
      await timeCleanupStage("flush restored storage", flushLargeSaves);
    });
    let differences = await timeCleanupStage("verify restored baseline", () => devSmokeCreatedArtifactDifferences(librarySnapshot, persistentSnapshot, {
      fastScenarioCheck: true
    }));
    if (await timeCleanupStage("remove late library artifacts", () => devRemoveLateSmokeLibraryArtifacts(differences))) {
      await timeCleanupStage("flush late cleanup", flushLargeSaves);
      differences = await timeCleanupStage("verify late cleanup", () => devSmokeCreatedArtifactDifferences(librarySnapshot, persistentSnapshot, {
        fastScenarioCheck: true
      }));
    }
    const messages = devSmokeArtifactDifferenceMessages(differences);
    if (messages.length) {
      const currentSettings = await app.library.listSettings();
      finalCleanupErrors.push(`remaining differences: ${messages.join("; ")}. Baseline settings keys: ${Object.keys(persistentSnapshot.large || {}).join(", ") || "none"}.`);
    }
    if (finalCleanupErrors.length) throw new Error(`Final smoke cleanup reported ${finalCleanupErrors.length} problem(s): ${[...new Set(finalCleanupErrors)].join(" | ")}`);
    devTestLog("Final smoke baseline restore timings", {
      stages: cleanupStageTimings,
      totalDurationMs: cleanupStageTimings.reduce((total, stage) => total + stage.durationMs, 0)
    });
    return clone(cleanupStageTimings);
  }
  function devRestoreSmokeRuntimeCatalog(appKey, baselineRecords = []) {
    if (appKey !== "storyTemplates" && appKey !== "characterDefinitions") throw new Error(`Unsupported smoke runtime catalog ${appKey}.`);
    // Share immutable definitions, never the baseline's mutable membership array.
    app[appKey] = [...baselineRecords];
    return app[appKey];
  }
  async function devRestoreSmokeScenarioBaseline(librarySnapshot = {}, persistentSnapshot = {}, reason = "smoke scenario baseline restored") {
    const cleanupStageTimeoutMs = 60000;
    const cleanupStageTimings = [];
    const timeCleanupStage = async (stage, action) => {
      const startedAt = performance.now();
      let failure = null;
      const suite = devSmokeSuiteState();
      suite.currentScenarioProgress = `Cleaning scenario artifacts: ${stage}`;
      writeDevSmokeRunPhase({
        phase: suite.currentScenarioProgress
      });
      const statusBox = $("smokeSuiteStatus");
      if (statusBox) statusBox.textContent = `Running ${suite.currentScenario || "smoke suite"}: ${suite.currentScenarioProgress} ${(suite.results || []).length}/${suite.totalScenarios || 0} finished.`;
      let timeoutId = null;
      try {
        return await Promise.race([Promise.resolve().then(action), new Promise((resolve, reject) => {
          timeoutId = setTimeout(() => {
            const orderedWork = app.work.orderedSnapshot?.() || [];
            const error = new Error(`Smoke cleanup stage "${stage}" exceeded ${Math.round(cleanupStageTimeoutMs / 1000)} seconds.`);
            error.smokeCleanupOrderedWork = orderedWork;
            reject(error);
          }, cleanupStageTimeoutMs);
        })]);
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        clearTimeout(timeoutId);
        cleanupStageTimings.push({
          stage,
          durationMs: Math.round(performance.now() - startedAt),
          orderedWork: failure?.smokeCleanupOrderedWork || undefined
        });
        if (failure) failure.smokeCleanupStageTimings = clone(cleanupStageTimings);
      }
    };
    const timeSynchronousCleanupStage = (stage, action) => {
      const startedAt = performance.now();
      try {
        return action();
      } finally {
        cleanupStageTimings.push({
          stage,
          durationMs: Math.round(performance.now() - startedAt)
        });
      }
    };
    const cleanup = async () => {
      timeSynchronousCleanupStage("cancel queued scenario work", () => {
        cancelSmokeSuiteScenarioWork(reason);
        devCancelSmokeImageWorkForRestore();
        devCancelSmokePersistenceWorkForRestore();
      });
      await timeCleanupStage("abandon leftover ordered work", () => devAbandonOrderedWorkForSmokeRestore(reason));
      if (app.smokeImageIsolationBaseline) {
        await timeCleanupStage("restore image-store isolation", () => app.persistence.restoreSmokeImageIsolation(app.smokeImageIsolationBaseline, {
          keepActive: true
        }));
      }
      if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true) await timeCleanupStage("clean hosted smoke uploads", () => devCleanupSmokeHostedUploads(reason));
      timeSynchronousCleanupStage("reset scenario UI", cleanupSmokeScenarioUi);
    };
    await devWithSmokeRestorePhase(cleanup);

    // Let callbacks scheduled by the scenario reach the ordered queue,
    // then delete only records that were not present in its baseline.
    await timeCleanupStage("yield scheduled callbacks", () => new Promise(resolve => setTimeout(resolve, 0)));
    await timeCleanupStage("remove declared scenario artifacts", () => devCleanupDeclaredScenarioArtifacts(librarySnapshot, reason));
    await timeCleanupStage("flush large storage", flushLargeSaves);
    await timeCleanupStage("restore shared public search cache", async () => {
      const originalCache = persistentSnapshot.large?.[PUBLIC_LIBRARY_QUERY_CACHE_KEY];
      if (originalCache === undefined) await awaitLargeStorageRemove(PUBLIC_LIBRARY_QUERY_CACHE_KEY);else await largeStorageSet(PUBLIC_LIBRARY_QUERY_CACHE_KEY, clone(originalCache));
    });
    await timeCleanupStage("remove declared scenario artifacts after flush", () => devCleanupDeclaredScenarioArtifactsAfterFlush(librarySnapshot, reason));
    let differences = await timeCleanupStage("scan artifacts before recovery", () => devSmokeCreatedArtifactDifferences(librarySnapshot, persistentSnapshot, {
      fastScenarioCheck: true
    }));
    const recoveredDifferenceMessages = devSmokeScenarioArtifactDifferenceMessages(differences);
    const changedRecords = timeSynchronousCleanupStage("compare protected records", () => {
      const storyRecordsChanged = !smokeDurableLibraryRecordsEqual(STORY_TEMPLATE_KEY, app.storyTemplates, librarySnapshot.storyTemplates);
      const characterRecordsChanged = !smokeDurableLibraryRecordsEqual(CHARACTER_LIBRARY_KEY, app.characterDefinitions, librarySnapshot.characterDefinitions);
      return {
        storyRecordsChanged,
        characterRecordsChanged
      };
    });
    const {
      storyRecordsChanged,
      characterRecordsChanged
    } = changedRecords;
    await devWithSmokeRestorePhase(async () => {
      await timeCleanupStage("remove added library artifacts", () => devRemoveLateSmokeLibraryArtifacts(differences));
      if (storyRecordsChanged) timeSynchronousCleanupStage("restore story runtime catalog", () => {
        devRestoreSmokeRuntimeCatalog("storyTemplates", librarySnapshot.storyTemplates || []);
      });
      if (characterRecordsChanged) timeSynchronousCleanupStage("restore character runtime catalog", () => {
        devRestoreSmokeRuntimeCatalog("characterDefinitions", librarySnapshot.characterDefinitions || []);
      });
      const settingsSnapshot = librarySnapshot.settingsSnapshot || {};
      app.settings = hydrateRuntimeSettingsFromExactStoredSettings(settingsSnapshot.settings);
      await saveSettingsNow("smoke settings baseline restored");
      timeSynchronousCleanupStage("restore public library runtime", () => devRestorePublicLibraryRuntimeSnapshotForSmoke(librarySnapshot.publicLibraryRuntime || {}));
      timeSynchronousCleanupStage("reset runtime state", () => {
        app.saveSessionActive = false;
        app.saveSessionContext = null;
        cancelSaveProjectionFlush();
        setSaveIndexRecords(clone(librarySnapshot.saveLibrary?.saveIndex || []));
        setActiveSaveId("");
        app.state = clone(defaultState);
        app.messages = [];
        app.images = [];
        app.snapshots = [];
        app.snapshotHeadExtraReverseChanges = [];
      });
      if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ !== true) await timeCleanupStage("restore persistent settings baseline", () => devRestorePersistentStorageSnapshotForSmoke(persistentSnapshot));
    });
    differences = await timeCleanupStage("scan artifacts after recovery", () => devSmokeCreatedArtifactDifferences(librarySnapshot, persistentSnapshot, {
      fastScenarioCheck: true
    }));
    if (await timeCleanupStage("remove late library artifacts", () => devRemoveLateSmokeLibraryArtifacts(differences))) {
      await timeCleanupStage("flush late large-storage writes", flushLargeSaves);
      differences = await timeCleanupStage("scan artifacts after late recovery", () => devSmokeCreatedArtifactDifferences(librarySnapshot, persistentSnapshot, {
        fastScenarioCheck: true
      }));
    }
    const messages = devSmokeScenarioArtifactDifferenceMessages(differences);
    if (messages.length) throw new Error(`Smoke scenario cleanup left created artifacts (${messages.join("; ")}).`);
    if (recoveredDifferenceMessages.length) {
      const error = new Error(`Smoke scenario required catch-all cleanup for artifacts its own cleanup left behind (${recoveredDifferenceMessages.join("; ")}).`);
      error.smokeCleanupRecovered = true;
      error.smokeCleanupStageTimings = clone(cleanupStageTimings);
      throw error;
    }
    return clone(cleanupStageTimings);
  }
  function isSmokeStoryTitleCardImageArtifact(image = {}) {
    if (["story-cap-favorite", "story-cap-active"].includes(image.id)) return true;
    if (image?.smoke_test_artifact === true) return true;
    const id = textSlot(image?.id, "");
    const storyId = textSlot(image?.story_id || image?.storyId, "");
    const storyKey = textSlot(image?.story_key || image?.storyKey, "");
    const storyTitle = textSlot(image?.story_title || image?.storyTitle, "");
    const storageId = libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, image);
    if (/^smoke-cleanup-/i.test(id)) return true;
    if (/^smoke-cleanup-/i.test(storyId)) return true;
    if (/^smoke-cleanup-/i.test(storyKey)) return true;
    if (/^smoke-cleanup-/i.test(storageId)) return true;
    if (/^smoke-fixture-/i.test(id)) return true;
    if (/^smoke-fixture-/i.test(storyId)) return true;
    if (/^smoke-fixture-/i.test(storyKey)) return true;
    if (/^smoke-fixture-/i.test(storageId)) return true;
    if (/^imported-old-version-smoke-story-title-card(?:-|$)/i.test(id)) return true;
    if (/^story-title-card-manual-story-\d+-/i.test(id) && /^New Story$/i.test(storyTitle)) return true;
    if (/^manual-story-\d+$/i.test(storyId) && /^New Story$/i.test(storyTitle)) return true;
    return false;
  }
  function isSmokeProfileImageArtifact(image = {}) {
    if (image?.smoke_test_artifact === true) return true;
    const diagnosticText = [image?.id, image?.name, image?.owner, image?.owner_name, image?.owner_key, image?.character_id, image?.characterId, image?.source, image?.reason].map(value => textSlot(value, "")).join("\n");
    if (/smoke|debug harness|test harness/i.test(diagnosticText)) return true;
    if (/^(?:Nia Solen|Trunc Vale|Miran Vale|Veyran Swap Library)$/i.test(textSlot(image?.owner_name, ""))) return true;
    return /^profile-(?:map-mentor|story-player-roland|story-player-lilith)-(?:male|non_male)-/i.test(textSlot(image?.id, ""));
  }
  function isSmokeSaveIndexArtifact(record = {}) {
    if (record?.smokeTestRuntime === true) return true;
    const title = textSlot(record?.storyTitle || record?.name || record?.displayName, "");
    if (/^(?:Library Gate Test|Smoke Cleanup Save|Story Library UI Smoke|Smoke Fixture Objective Chain)$/i.test(title)) return true;
    return textSlot(record?.storyTitle, "") === "Library Gate Test" && textSlot(record?.playerName, "") === "Gate Tester";
  }
  async function devRecoverInterruptedSmokeArtifactBaseline(baseline = {}) {
    const removed = {
      images: 0,
      storyTemplates: 0,
      storyTitleCardImages: 0,
      characterDefinitions: 0,
      profileImages: 0,
      saves: 0
    };
    const imageResult = await app.persistence.restoreSmokeImageIsolation(baseline.images);
    removed.images = Number(imageResult?.deleted) || 0;
    const cleanupPerRecord = async (key, baselineIds, fallback, options = {}) => {
      const expected = new Set((baselineIds || []).map(id => String(id || "")).filter(Boolean));
      const current = await loadPerRecordLibrary(key, fallback, options);
      const added = current.filter(record => {
        const id = String(libraryRecordStorageId(key, record) || "");
        return id && !expected.has(id);
      });
      if (added.length) await deletePerRecordLibraryRecords(key, added.map(record => ({
        id: libraryRecordStorageId(key, record)
      })));
      return {
        current,
        added
      };
    };
    const stories = await cleanupPerRecord(STORY_TEMPLATE_KEY, baseline.storyTemplates, app.storyTemplates || [], {
      deferStoryValidation: true
    });
    removed.storyTemplates = stories.added.length;
    app.storyTemplates = stories.current.filter(record => !stories.added.includes(record));
    const titleImages = await cleanupPerRecord(STORY_TITLE_CARD_IMAGE_KEY, baseline.storyTitleCardImages, app.storyTitleCardImages || []);
    removed.storyTitleCardImages = titleImages.added.length;
    app.storyTitleCardImages = exactStoryTitleCardImageStore(titleImages.current.filter(record => !titleImages.added.includes(record)));
    const characters = await cleanupPerRecord(CHARACTER_LIBRARY_KEY, baseline.characterDefinitions, app.characterDefinitions || [], {
      deferDefinitionValidation: true
    });
    removed.characterDefinitions = characters.added.length;
    app.characterDefinitions = validatedCharacterLibraryDefinitions(characters.current.filter(record => !characters.added.includes(record)));
    const profileImages = await cleanupPerRecord(PROFILE_IMAGE_KEY, baseline.profileImages, app.profileImages || []);
    removed.profileImages = profileImages.added.length;
    app.profileImages = exactProfileImageStore(profileImages.current.filter(record => !profileImages.added.includes(record)));
    const expectedSaveIds = new Set((baseline.saves || []).map(id => String(id || "")));
    const savePage = await app.persistence.listSaves({});
    const addedSaves = (savePage?.entries || []).filter(header => !expectedSaveIds.has(String(header.saveId || "")));
    for (const header of addedSaves) await app.persistence.deleteSave(Number(header.saveId));
    removed.saves = addedSaves.length;
    await loadSaveIndexRecords();
    return removed;
  }
  async function devCleanupAbandonedSmokeArtifactsBeforeSuite() {
    // A smoke can queue a library save immediately before cleanup. Let
    // every pending write land first so deletion is the final operation.
    await flushLargeSaves();
    const uniqueDeletionReferences = (key, records) => [...new Set(records.map(record => String(libraryRecordStorageId(key, record) || "")).filter(Boolean))].map(id => ({
      id
    }));
    const storedStoryTemplates = await loadPerRecordLibrary(STORY_TEMPLATE_KEY, app.storyTemplates || [], {
      deferStoryValidation: true
    });
    const smokeStories = [...(app.storyTemplates || []), ...(storedStoryTemplates || [])].filter(record => record?.smoke_test_artifact === true || isSmokeStoryLibraryArtifact(record));
    const smokeStoryIds = new Set(smokeStories.map(record => String(record.id || "")).filter(Boolean));
    const storedCharacterDefinitions = await loadPerRecordLibrary(CHARACTER_LIBRARY_KEY, app.characterDefinitions || [], {
      deferDefinitionValidation: true
    });
    const smokeCharacters = validatedCharacterLibraryDefinitions([...new Map([...(app.characterDefinitions || []), ...(storedCharacterDefinitions || [])].map(record => [libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record), record])).values()]).filter(record => record?.smoke_test_artifact === true || String(record?.id || "").startsWith("smoke-cleanup-") || isSmokeCharacterLibraryArtifact(record));
    const smokeCharacterNames = new Set(smokeCharacters.map(record => String(record?.name || record?.character?.name || record?.definition?.name || "").trim()).filter(Boolean));
    const legacySmokeCharacterIds = new Set(["public-library-mira"]);
    const storedStoryTitleImages = await loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || []);
    const currentStoryTitleImages = exactStoryTitleCardImageStore(app.storyTitleCardImages || []);
    const exactStoredStoryTitleImages = exactStoryTitleCardImageStore(storedStoryTitleImages || []);
    const smokeTitleImages = [...new Map([...currentStoryTitleImages, ...exactStoredStoryTitleImages].map(image => [libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, image), image])).values()].filter(image => smokeStoryIds.has(String(image.story_id || "")) || isSmokeStoryTitleCardImageArtifact(image));
    const storedProfileImages = await loadPerRecordLibrary(PROFILE_IMAGE_KEY, app.profileImages || []);
    const currentProfileImages = exactProfileImageStore(app.profileImages || []);
    const exactStoredProfileImages = exactProfileImageStore(storedProfileImages || []);
    const smokeProfileImages = [...new Map([...currentProfileImages, ...exactStoredProfileImages].map(image => [image.id, image])).values()].filter(image => image?.smoke_test_artifact === true || String(image?.id || "").startsWith("smoke-cleanup-") || String(image?.id || "").startsWith("profile-smoke-") || legacySmokeCharacterIds.has(String(image?.character_id || "")) || smokeCharacterNames.has(String(image.owner_name || "").trim()));
    if (smokeStories.length) {
      app.storyTemplates = (app.storyTemplates || []).filter(record => !smokeStoryIds.has(String(record.id || "")));
      await deletePerRecordLibraryRecords(STORY_TEMPLATE_KEY, uniqueDeletionReferences(STORY_TEMPLATE_KEY, smokeStories));
    }
    if (smokeTitleImages.length) {
      const removedIds = new Set(smokeTitleImages.map(image => String(libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, image) || "")));
      app.storyTitleCardImages = exactStoryTitleCardImageStore((app.storyTitleCardImages || []).filter(image => !removedIds.has(String(libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, image) || ""))));
      await deletePerRecordLibraryRecords(STORY_TITLE_CARD_IMAGE_KEY, uniqueDeletionReferences(STORY_TITLE_CARD_IMAGE_KEY, smokeTitleImages));
    }
    if (smokeCharacters.length) {
      const removedIds = new Set(smokeCharacters.map(record => String(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || "")));
      app.characterDefinitions = validatedCharacterLibraryDefinitions((app.characterDefinitions || []).filter(record => !removedIds.has(String(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record) || ""))));
      await deletePerRecordLibraryRecords(CHARACTER_LIBRARY_KEY, uniqueDeletionReferences(CHARACTER_LIBRARY_KEY, smokeCharacters));
    }
    if (smokeProfileImages.length) {
      const removedIds = new Set(smokeProfileImages.map(image => String(image.id || "")));
      app.profileImages = exactProfileImageStore((app.profileImages || []).filter(image => !removedIds.has(String(image.id || ""))));
      await deletePerRecordLibraryRecords(PROFILE_IMAGE_KEY, uniqueDeletionReferences(PROFILE_IMAGE_KEY, smokeProfileImages));
    }
    const normalizedSmokeStories = (await listAllLibraryEntries("story")).filter(entry => isSmokeStoryLibraryArtifact({
      id: entry?.storyId,
      smoke_test_artifact: entry?.smokeTestArtifact === true
    }));
    for (const entry of normalizedSmokeStories) await app.library.deleteEntry("story", entry.storyId);
    const storedSavePage = app.persistence?.started ? await app.persistence.listSaves({}) : {
      entries: saveIndexRecords()
    };
    const smokeSaveIds = (storedSavePage?.entries || []).filter(isSmokeSaveIndexArtifact).map(record => String(record?.saveId || "").trim()).filter(Boolean);
    for (const saveId of smokeSaveIds) await deleteSaveStorage(saveId);
    if (app.persistence?.started) await loadSaveIndexRecords();
    for (const key of smokeLocalStorageKeys()) {
      if (key.startsWith("emberadventures-lite-smoke-cleanup-")) safeRemoveStorageItem(key);
    }
    await flushLargeSaves();
  }
  function isSmokeStoryLibraryArtifact(record = {}) {
    const id = textSlot(record?.id, "");
    if (record?.smoke_test_artifact === true) return true;
    if (/^smoke-cleanup-/i.test(id)) return true;
    if (/^smoke-/i.test(id)) return true;
    if (/^story-builder(?:-metadata)?-smoke-/i.test(id)) return true;
    if (/^deterministic-profile-start-.*-smoke$/i.test(id)) return true;
    if (/^public-download-smoke-/i.test(id)) return true;
    if (/^public-publish-.*smoke$/i.test(id)) return true;
    if (/^supabase-live-/i.test(id)) return true;
    if (id === "character-attached-story-smoke") return true;
    if (/^(editor-access-template|export-story-template|global-cap-story-smoke)$/i.test(id)) return true;
    if (/^version-download-imported-v1(?:-|$)/i.test(id)) return true;
    if (/^(?:live-template-start-test|story-player-select-test|first-upload-smoke|second-upload-smoke|definition-smoke-story)$/i.test(id)) return true;
    if (/^(?:story-any-player-select-smoke|story-library-ui-smoke-|manual-story-\d+$)/i.test(id)) return true;
    if (/^unclaimed-story-identity-(?:alpha|beta)-smoke$/i.test(id)) return true;
    return false;
  }
  function stripSmokeStoryLibraryArtifacts(records = []) {
    return (Array.isArray(records) ? records : []).filter(record => !isSmokeStoryLibraryArtifact(record));
  }
  function devCleanupSmokeStoryLibraryArtifacts(reason = "smoke story artifacts cleaned") {
    const existing = Array.isArray(app.storyTemplates) ? app.storyTemplates : [];
    const smokeArtifacts = existing.filter(isSmokeStoryLibraryArtifact);
    if (!smokeArtifacts.length) return Promise.resolve();
    app.storyTemplates = existing.filter(record => !isSmokeStoryLibraryArtifact(record));
    return queuePerRecordLibraryRecordsDelete(STORY_TEMPLATE_KEY, smokeArtifacts.map(record => ({
      id: libraryRecordStorageId(STORY_TEMPLATE_KEY, record)
    })), reason);
  }
  function isSmokeStoryTitleCardArtifact(image = {}) {
    const imageId = String(image?.id || "").trim();
    const storyId = String(image?.story_id || "").trim();
    const storyKey = String(image?.story_key || "").trim();
    return image?.smoke_test_artifact === true || /^smoke-cleanup-/i.test(imageId) || /^smoke-cleanup-/i.test(storyId) || /^smoke-cleanup-/i.test(storyKey) || /^story-library-ui-smoke(?:-|$)/.test(imageId) || /^story-library-ui-smoke(?:-|$)/.test(storyId) || /^story:story-library-ui-smoke(?:-|$)/.test(storyKey) || /^imported-old-version-smoke-story-title-card(?:-|$)/i.test(imageId);
  }
  function devCleanupSmokeStoryTitleCardArtifacts(reason = "smoke story title-card artifacts cleaned") {
    const existing = exactStoryTitleCardImageStore(app.storyTitleCardImages || []);
    const smokeArtifacts = existing.filter(isSmokeStoryTitleCardArtifact);
    if (!smokeArtifacts.length) return Promise.resolve();
    app.storyTitleCardImages = existing.filter(image => !isSmokeStoryTitleCardArtifact(image));
    const deletionReferences = [...new Set(smokeArtifacts.map(record => libraryRecordStorageId(STORY_TITLE_CARD_IMAGE_KEY, record)).filter(Boolean))].map(id => ({
      id
    }));
    return queuePerRecordLibraryRecordsDelete(STORY_TITLE_CARD_IMAGE_KEY, deletionReferences, reason);
  }
  function stableStorageCompare(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  function smokeLibraryDurableComparisonRecord(key = "", record = {}) {
    const type = libraryRecordStorageType(key);
    if (type === "story") {
      const definition = {
        ...record
      };
      delete definition.creator_id;
      delete definition.creator;
      return definition;
    }
    if (type === "character") {
      if (Object.hasOwn(record, "character_definition")) return {
        character_definition: record.character_definition
      };
      if (Object.hasOwn(record, "character")) return {
        character_definition: record.character
      };
      return {
        character_definition: record
      };
    }
    if (type !== "profile-image" && type !== "story-title-image") return record;
    const htmlSource = extractImageSrc(record.html);
    const durableUrl = textSlot(record.hosted_url || record.url, "");
    const source = /^blob:/i.test(htmlSource) && durableUrl ? durableUrl : htmlSource || durableUrl;
    const common = {
      imageId: textSlot(record.id, ""),
      source: textSlot(record.source, ""),
      model: textSlot(record.model, ""),
      seed: record.seed ?? null,
      prompt: textSlot(record.prompt, ""),
      negativePrompt: textSlot(record.negativePrompt, ""),
      url: /^(?:data:image\/|blob:)/i.test(source) ? "" : source
    };
    if (type === "profile-image") {
      return {
        ...common,
        characterId: textSlot(record.character_id, ""),
        presentation: record.male === true ? "male" : "non_male",
        favorite: record.favorite === true,
        createdAt: textSlot(record.at, "")
      };
    }
    return {
      ...common,
      storyId: textSlot(record.story_id, ""),
      storyTitle: textSlot(record.story_title || record.storyTitle, "")
    };
  }
  function smokeDurableValuesEqual(left, right) {
    if (Object.is(left, right)) return true;
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right)) return false;
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index++) {
        if (!smokeDurableValuesEqual(left[index], right[index])) return false;
      }
      return true;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!Object.hasOwn(right, key) || !smokeDurableValuesEqual(left[key], right[key])) return false;
    }
    return true;
  }
  function smokeDurableLibraryRecordsEqual(key = "", current = [], baseline = []) {
    const baselineById = new Map((baseline || []).map(record => [String(libraryRecordStorageId(key, record) || ""), smokeLibraryDurableComparisonRecord(key, record)]));
    if ((current || []).length !== baselineById.size) return false;
    for (const record of current || []) {
      const id = String(libraryRecordStorageId(key, record) || "");
      if (!baselineById.has(id) || !smokeDurableValuesEqual(smokeLibraryDurableComparisonRecord(key, record), baselineById.get(id))) return false;
    }
    return true;
  }
  async function devRestorePerRecordLibrarySnapshotForSmoke(key, snapshot = [], current = [], normalize = records => records, reason = "smoke library restored") {
    const original = normalize(snapshot || []);
    const existing = normalize(current || []);
    const originalById = new Map(original.map(record => [libraryRecordStorageId(key, record), record]).filter(([id]) => id));
    const existingById = new Map(existing.map(record => [libraryRecordStorageId(key, record), record]).filter(([id]) => id));
    const added = existing.filter(record => {
      const id = libraryRecordStorageId(key, record);
      return id && !originalById.has(id);
    });
    const changed = original.filter(record => {
      const id = libraryRecordStorageId(key, record);
      const existingRecord = existingById.get(id);
      return !existingRecord || !smokeDurableValuesEqual(smokeLibraryDurableComparisonRecord(key, existingRecord), smokeLibraryDurableComparisonRecord(key, record));
    });
    if (added.length) await deletePerRecordLibraryRecords(key, added.map(record => ({
      id: libraryRecordStorageId(key, record)
    })));
    const isolatedStoreName = key === PROFILE_IMAGE_KEY ? "characterProfileImages" : key === STORY_TITLE_CARD_IMAGE_KEY ? "storyTitleImages" : "";
    const isolatedBaselineIds = new Set(isolatedStoreName && app.smokeImageIsolationBaseline ? (app.smokeImageIsolationBaseline[isolatedStoreName] || []).map(id => String(id || "")) : []);
    const recordsToRestore = changed.filter(record => !isolatedBaselineIds.has(String(libraryRecordStorageId(key, record) || "")));
    if (recordsToRestore.length) await savePerRecordLibraryRecords(key, recordsToRestore, {
      reason: `${reason}: restore changed records`
    });
    return [...original];
  }
  async function devRestoreStoryTemplatesForSmoke(snapshot = [], reason = "smoke story library restored") {
    const original = Array.isArray(snapshot) ? snapshot : [];
    const stored = await loadPerRecordLibrary(STORY_TEMPLATE_KEY, app.storyTemplates || [], {
      deferStoryValidation: true
    });
    app.storyTemplates = await devRestorePerRecordLibrarySnapshotForSmoke(STORY_TEMPLATE_KEY, original, stored, records => Array.isArray(records) ? records : [], reason);
  }
  async function devRestoreStoryTitleCardImagesForSmoke(snapshot = [], reason = "smoke story title images restored") {
    const original = exactStoryTitleCardImageStore(snapshot || []);
    const stored = await loadPerRecordLibrary(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || []);
    app.storyTitleCardImages = await devRestorePerRecordLibrarySnapshotForSmoke(STORY_TITLE_CARD_IMAGE_KEY, original, stored, exactStoryTitleCardImageStore, reason);
  }
  async function devRestoreCharacterDefinitionsForSmoke(snapshot = [], reason = "smoke character library restored") {
    const original = validatedCharacterLibraryDefinitions(snapshot || []);
    const stored = await loadPerRecordLibrary(CHARACTER_LIBRARY_KEY, app.characterDefinitions || [], {
      deferDefinitionValidation: true
    });
    app.characterDefinitions = await devRestorePerRecordLibrarySnapshotForSmoke(CHARACTER_LIBRARY_KEY, original, stored, records => Array.isArray(records) ? records : [], reason);
  }
  async function devRestoreProfileImagesForSmoke(snapshot = [], reason = "smoke profile images restored") {
    if (snapshot === null) {
      app.profileImages = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []));
      return;
    }
    const original = exactProfileImageStore(snapshot || []);
    const stored = await loadPerRecordLibrary(PROFILE_IMAGE_KEY, app.profileImages || []);
    app.profileImages = await devRestorePerRecordLibrarySnapshotForSmoke(PROFILE_IMAGE_KEY, original, stored, exactProfileImageStore, reason);
  }
  function isSmokeCharacterLibraryArtifact(record = {}) {
    const character = record?.character || record?.definition || record || {};
    const name = textSlot(record?.name || character?.name, "");
    const source = textSlot(record?.source || character?.source, "");
    const creator = textSlot(record?.creator || character?.creator, "");
    const role = textSlot(record?.role || character?.role, "");
    const wrapperId = textSlot(record?.id, "");
    const storageId = textSlot(libraryRecordStorageId(CHARACTER_LIBRARY_KEY, record), "");
    const characterId = textSlot(character?.id, "");
    const ids = [wrapperId, storageId, characterId];
    if (/smoke|debug harness|test harness/i.test(`${name}\n${source}\n${creator}\n${role}\n${ids.join("\n")}`)) return true;
    if (/^Imported (Profile Generator|Refresh Tester)$/i.test(name)) return true;
    if (/^(Library Party Recruit|Nara Quill|New Ally|Nolan Reed|Tor Bran)$/i.test(name)) return true;
    if (/^Nia Solen$/i.test(name)) return true;
    if (/^Public Library Mira$/i.test(name)) return true;
    if (ids.some(id => /^(?:library-delete-replacement|miran-library|veyra-swap-library|featured-alpha)$/i.test(id))) return true;
    if (ids.some(id => /^(?:public-download-ally-|public-library-mira-smoke-)/i.test(id))) return true;
    return false;
  }
  function stripSmokeCharacterLibraryArtifacts(records = []) {
    return validatedCharacterLibraryDefinitions(records || []).filter(record => !isSmokeCharacterLibraryArtifact(record));
  }
  async function devRestoreFullLibrarySnapshotForSmoke(snapshot = {}, reason = "smoke snapshot restored") {
    // Save hydration can repopulate shared runtime/library caches. Restore
    // the save first, then make each captured shared library authoritative.
    await devRestoreSaveLibrarySnapshotForSmoke(snapshot.saveLibrary || {}, {
      useCapturedRuntime: true
    });
    if (globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true) {
      await devRestoreStoryTemplatesForSmoke(Array.isArray(snapshot.storyTemplates) ? snapshot.storyTemplates : app.storyTemplates || [], `${reason}: story library`);
      await devRestoreStoryTitleCardImagesForSmoke(snapshot.storyTitleCardImages || [], `${reason}: story title images`);
      await devRestoreCharacterDefinitionsForSmoke(snapshot.characterDefinitions || [], `${reason}: character library`);
      await devRestoreProfileImagesForSmoke(snapshot.profileImages || [], `${reason}: profile images`);
    } else {
      devRestoreSmokeRuntimeCatalog("storyTemplates", snapshot.storyTemplates || []);
      app.storyTitleCardImages = exactStoryTitleCardImageStore(snapshot.storyTitleCardImages || []);
      devRestoreSmokeRuntimeCatalog("characterDefinitions", snapshot.characterDefinitions || []);
      app.profileImages = exactProfileImageStore(snapshot.profileImageRuntimeRecords || []);
    }
    await devRestoreSettingsSnapshotForSmoke(snapshot.settingsSnapshot || {});
  }
  function devCancelSmokeImageWorkForRestore() {
    try {
      app.profileImageQueue = [];
      app.profileImageGenerating = new Set();
      app.profileImageQueued = new Set();
      app.activeProfileImageRequests = new Set();
      app.profileImageRequestOwnerById = {};
      app.activeProfileImageRequestByOwner = {};
      app.supersededProfileImageRequests = new Set();
      app.profileImageQueueRunning = false;
      app.pendingEditorProfileRefreshes = {};
      app.imageQueue = [];
      app.imageGenerating = false;
    } catch {}
  }
  function devCancelSmokePersistenceWorkForRestore() {
    try {
      clearTimeout(app.activeGameSaveTimer);
      app.activeGameSaveTimer = null;
      app.activeGameSaveDeadlineAt = 0;
      app.activeGameSaveDirty = false;
      app.activeGameSavePendingReason = "";
      app.activeGameSaveQueuedCount = 0;
      app.activeGameSaveFirstQueuedAt = 0;
      app.activeGameSaveRunning = false;
    } catch {}
  }
  async function devRestoreSaveLibrarySnapshotForSmoke(snapshot = {}, options = {}) {
    // Smoke save rule: every synthetic save uses a unique id and is removed
    // through the same aggregate lifecycle as production. Existing durable
    // player saves are never rewritten from a smoke's in-memory projection.
    cancelSmokeSuiteScenarioWork("restoring smoke save snapshot");
    devCancelSmokeImageWorkForRestore();
    devCancelSmokePersistenceWorkForRestore();
    const snapshotSaveIds = new Set((snapshot.saveIndex || []).map(record => String(record?.saveId || "").trim()).filter(Boolean));
    for (const lane of app.work.orderedSnapshot?.() || []) {
      const match = /^save:(.+)$/i.exec(String(lane.resourceKey || ""));
      if (!match || snapshotSaveIds.has(match[1])) continue;
      app.work.abandonOrdered(lane.resourceKey, `restoring smoke save snapshot removed synthetic save lane ${lane.resourceKey}`);
    }
    await app.work.flush(`library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`);
    const restoredActiveId = String(snapshot.activeSaveId || "").trim();
    const capturedRuntime = snapshot.runtime || {};
    const reuseCapturedSaveSession = options.useCapturedRuntime === true && capturedRuntime.saveSessionActive === true && restoredActiveId && app.persistence?.activeSaveState?.saveId === Number(restoredActiveId);
    clearTimeout(app.gameAutosaveTimer);
    app.gameAutosaveTimer = null;
    app.saveSessionActive = false;
    cancelSaveProjectionFlush();
    if (app.persistence?.activeSaveState && !reuseCapturedSaveSession) await app.persistence.abandonActiveSaveForTest();
    saveProjectionQueue.flushing = null;
    app.saveSessionContext = null;
    if (app.persistence) {
      const normalizedSavePage = await app.persistence.listSaves({});
      for (const header of normalizedSavePage?.entries || []) {
        const id = String(header?.saveId || "").trim();
        if (id && !snapshotSaveIds.has(id)) await app.persistence.deleteSave(Number(header.saveId));
      }
    }
    await loadSaveIndexRecords();
    if (options.useCapturedRuntime === true) {
      const runtime = capturedRuntime;
      setActiveSaveId(restoredActiveId || String(runtime.activeSaveId || "").trim());
      app.state = clone(runtime.state || defaultState);
      app.state.meta ||= {};
      delete app.state.meta.smoke_test_runtime;
      app.messages = clone(runtime.messages || []);
      app.images = safeImageHistoryForStorage(runtime.images || []);
      app.snapshots = Array.isArray(runtime.snapshots) ? clone(runtime.snapshots) : [];
      app.snapshotHeadExtraReverseChanges = clone(runtime.snapshotHeadExtraReverseChanges || []);
      app.storyDefinition = runtime.storyDefinition ? readonlyDefinitionView(clone(runtime.storyDefinition)) : null;
      app.runtimeDefinitions = clone(runtime.runtimeDefinitions || {
        jobsById: {},
        charactersById: {},
        locationsById: {}
      });
      rebuildRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
      app.objectiveRuntime = clone(runtime.objectiveRuntime || null);
      app.rewardRuntime = clone(runtime.rewardRuntime || null);
      app.storyRulesRuntime = clone(runtime.storyRulesRuntime || null);
      app.jobRuntime = clone(runtime.jobRuntime || null);
      app.saveSessionContext = clone(runtime.saveSessionContext || null);
      app.existingGameMessagePage = clone(runtime.existingGameMessagePage || null);
      if (restoredActiveId && runtime.saveSessionActive === true && app.persistence?.started) {
        if (!reuseCapturedSaveSession) await app.persistence.activateSave(Number(restoredActiveId));
        app.saveSessionActive = true;
        initializeSaveProjectionState();
        cancelSaveProjectionFlush();
      } else {
        runtimeAggregateDirtyTracker.baselineRequired = true;
        runtimeAggregateDirtyTracker.records.clear();
        runtimeAggregateDirtyTracker.messages.clear();
        runtimeAggregateDirtyTracker.snapshots.clear();
        runtimeAggregateDirtyTracker.images.clear();
      }
      assertExactMessageStorage();
      refreshKeptImageRuntimeSet();
      await persistActiveSavePointer();
      return;
    }
    if (restoredActiveId && findSaveIndexRecord(restoredActiveId)) {
      app.suppressSaveProjections = true;
      try {
        await loadSaveIntoRuntime(restoredActiveId, {
          setActive: true
        });
        if (app.state?.meta) delete app.state.meta.smoke_test_runtime;
        await Promise.resolve();
        cancelSaveProjectionFlush();
      } finally {
        app.suppressSaveProjections = false;
      }
      return;
    }
    setActiveSaveId(String(snapshot.runtime?.activeSaveId || "").trim());
    app.state = clone(snapshot.runtime?.state || defaultState);
    app.state.meta ||= {};
    delete app.state.meta.smoke_test_runtime;
    app.messages = clone(snapshot.runtime?.messages || []);
    app.images = safeImageHistoryForStorage(snapshot.runtime?.images || []);
    app.snapshots = Array.isArray(snapshot.runtime?.snapshots) ? clone(snapshot.runtime.snapshots) : [];
    app.snapshotHeadExtraReverseChanges = clone(snapshot.runtime?.snapshotHeadExtraReverseChanges || []);
    app.profileImages = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []));
    runtimeAggregateDirtyTracker.baselineRequired = true;
    runtimeAggregateDirtyTracker.records.clear();
    runtimeAggregateDirtyTracker.messages.clear();
    runtimeAggregateDirtyTracker.snapshots.clear();
    runtimeAggregateDirtyTracker.images.clear();
    assertExactMessageStorage();
    refreshKeptImageRuntimeSet();
    await persistActiveSavePointer();
  }
  function devAcceptPlayerInputHelpIfShown() {
    const modal = $("modal");
    const box = $("modalBox");
    if (!modal?.classList?.contains("open") || !box) return false;
    if (!/How to Play/i.test(box.textContent || "")) return false;
    const startButton = [...box.querySelectorAll("button")].find(button => /Start Playing/i.test(button.textContent || ""));
    devAssert(!!startButton, "player input help modal has Start Playing button");
    startButton.click();
    devAssert(!$("modal")?.classList?.contains("open"), "player input help modal closes through UI button");
    return true;
  }
  function devWaitFor(predicate, timeoutMs = 10000, label = "condition", options = {}) {
    const started = Date.now();
    const token = options?.smokeToken || null;
    return new Promise((resolve, reject) => {
      const tick = () => {
        try {
          if (token) devAssertSmokeScenarioActive(token, label);
          if (predicate()) {
            resolve(true);
            return;
          }
          if (Date.now() - started >= timeoutMs) {
            const activityTasks = [...(app.activityTasks?.values?.() || [])].map(task => ({
              id: task.id,
              kind: task.kind,
              label: task.label,
              elapsedMs: Date.now() - Number(task.startedAt || Date.now())
            }));
            const persistenceRequests = [...(persistenceWorkerClient?.pending?.entries?.() || [])].map(([id, request]) => ({
              id,
              type: request?.type || ""
            }));
            const storyImportRequests = [...(storyImportWorkerClient?.pending?.entries?.() || [])].map(([id, request]) => ({
              id,
              type: request?.type || ""
            }));
            reject(new Error(`Timed out waiting for ${label}. Diagnostics: ${JSON.stringify({
              elapsedMs: Date.now() - started,
              activityTasks,
              persistenceRequests,
              storyImportRequests,
              busy: !!app.busy,
              queueLength: app.queue?.length || 0,
              saveQueued: !!app.saveQueued,
              saveInProgress: !!app.saveInProgress,
              lastStoryStartError: String(app.lastStoryStartError || ""),
              activeSaveId: String(app.activeSaveId || ""),
              saveSessionActive: !!app.saveSessionActive,
              imageCount: app.images?.length || 0,
              imageTargets: imageTargetNames?.() || []
            })}`));
            return;
          }
          setTimeout(tick, 25);
        } catch (err) {
          reject(err);
        }
      };
      tick();
    });
  }
  function devSmokeSettle(turns = 1) {
    // UI smoke actions generally update synchronously. Yield one task so
    // queued event handlers and promise continuations can finish without
    // adding an arbitrary 50-250 ms delay to every assertion.
    let promise = Promise.resolve();
    for (let index = 0; index < Math.max(1, Number(turns) || 1); index++) {
      promise = promise.then(() => new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(null);
      }));
    }
    return promise;
  }
  async function devSendComposerMessageLikePlayer(text) {
    devAcceptPlayerInputHelpIfShown();
    const input = $("input");
    const send = $("sendBtn");
    devAssert(!!input && !!send, "composer input and Send button exist");
    devAssert(!send.disabled, "Send button is enabled before player message");
    input.focus?.();
    if (!app.devComposerAutosizeChecked) {
      app.devComposerAutosizeChecked = true;
      input.value = Array(80).fill("This is a long composer autosize line.").join("\n");
      input.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      const threadHeight = $("thread")?.getBoundingClientRect?.().height || 0;
      const composerHeight = input.closest(".composer")?.getBoundingClientRect?.().height || 0;
      const cap = Math.max(42, Math.floor((threadHeight + composerHeight) * 0.5));
      devAssert(input.getBoundingClientRect().height <= cap + 2, "composer textarea autosize is capped to half the available chat area", {
        height: input.getBoundingClientRect().height,
        cap
      });
    }
    input.value = String(text || "");
    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    devAssert(!$("inputPreview") && getComputedStyle(input).resize === "none" && ["auto", "hidden"].includes(getComputedStyle(input).overflowY), "composer textarea has no preview box, cannot be manually resized, and autosizes with internal scroll", {
      resize: getComputedStyle(input).resize,
      overflowY: getComputedStyle(input).overflowY,
      height: input.style.height
    });
    const beforeCount = app.messages.length;
    send.click();
    await devWaitFor(() => app.messages.length > beforeCount, 12000, "player message to be queued via Send button");
    devAssert(app.messages.length > beforeCount, "player message submitted through composer UI", {
      beforeCount,
      afterCount: app.messages.length
    });
  }
  function devLooksLikeRealImageHtml(html) {
    const text = String(html || "");
    if (!text.trim() || /image-loading-block/i.test(text)) return false;
    if (stableImageHtmlToString(text)) return true;
    if (trustedStoredImageSrc(text)) return true;
    return /(<img\b|data:image\/|https?:\/\/[^"'\s]+\.(?:png|jpe?g|webp|gif))/i.test(text);
  }
  function devSmokeOnePixelDataUrl() {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  }
  async function devWithRealPerchanceImagePlugin(scenarioId, run) {
    const pluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
    const hadKeepOverrideFlag = Object.prototype.hasOwnProperty.call(globalThis, "__emberAdventuresKeepSmokeImagePluginOverride");
    const previousKeepOverrideFlag = globalThis.__emberAdventuresKeepSmokeImagePluginOverride;
    const hadOverride = Object.prototype.hasOwnProperty.call(pluginOverrides, "textToImagePlugin");
    const previousOverride = pluginOverrides.textToImagePlugin;
    try {
      // Real image smoke rule: these scenarios must hit the live
      // Perchance text-to-image plugin. Fake overrides belong only in
      // deterministic short smokes.
      delete globalThis.__emberAdventuresKeepSmokeImagePluginOverride;
      delete pluginOverrides.textToImagePlugin;
      const imagePlugin = perchancePlugin("textToImagePlugin");
      devAssert(!!imagePlugin, `${scenarioId} requires the real Perchance text-to-image plugin`);
      devTestLog("Real image plugin ready", {
        scenarioId,
        pluginType: typeof imagePlugin,
        overrideRemoved: true,
        hadPreviousOverride: hadOverride
      });
      return await run();
    } finally {
      if (hadOverride) pluginOverrides.textToImagePlugin = previousOverride;else delete pluginOverrides.textToImagePlugin;
      if (hadKeepOverrideFlag) globalThis.__emberAdventuresKeepSmokeImagePluginOverride = previousKeepOverrideFlag;else delete globalThis.__emberAdventuresKeepSmokeImagePluginOverride;
      devTestLog("Real image plugin override restored", {
        scenarioId,
        restoredOverride: hadOverride
      });
    }
  }
  function devProfileImageDiagnostics(name, image = null) {
    const entity = profileEntity(name);
    const profiles = profileImagesForEntity(entity || {});
    const active = activeProfileImage(entity);
    const stored = image?.id ? (app.profileImages || []).find(record => String(record.id) === String(image.id)) : null;
    const card = document.querySelector(`[data-character-action="profile"][data-character-name="${cssEscape(String(name))}"]`);
    return {
      name,
      entityExists: !!entity,
      activeId: active?.id || "",
      entityDefaultSeed: entity?.default_seed ?? null,
      entityPromptSeed: entity?.image_prompt_config?.seed ?? null,
      entityImageSeed: entity?.image?.seed ?? null,
      defaultProfileImageSeed: entity ? defaultProfileImageSeed(entity) : null,
      activeSeed: active?.seed ?? null,
      activePending: active?.pending ?? null,
      activeError: active?.error || "",
      activeHasHtml: devLooksLikeRealImageHtml(active?.html),
      requestedId: image?.id || "",
      requestedSeed: image?.seed ?? null,
      requestedPending: image?.pending ?? null,
      requestedError: image?.error || "",
      requestedHasHtml: devLooksLikeRealImageHtml(image?.html),
      storedExists: !!stored,
      storedSeed: stored?.seed ?? null,
      storedPending: stored?.pending ?? null,
      storedError: stored?.error || "",
      storedHasHtml: devLooksLikeRealImageHtml(stored?.html),
      profileCount: profiles.length,
      profileIds: profiles.map(profile => ({
        id: profile.id,
        source: profile.source,
        seed: profile.seed ?? null,
        pending: profile.pending,
        error: profile.error || "",
        hasHtml: devLooksLikeRealImageHtml(profile.html)
      })),
      queue: [...(app.profileImageQueued || new Set())],
      generating: [...(app.profileImageGenerating || new Set())],
      queueLength: app.profileImageQueue?.length || 0,
      queueRunning: !!app.profileImageQueueRunning,
      activeRequestIds: [...(app.activeProfileImageRequests || new Set())],
      cardExists: !!card,
      cardHasImageHtml: devLooksLikeRealImageHtml(card?.innerHTML || ""),
      cardHtmlStart: String(card?.innerHTML || "").slice(0, 180)
    };
  }
  function devProfileImageDiagnosticsHasPendingWithoutWork(diagnostics) {
    if (!diagnostics) return false;
    const hasPendingProfile = (diagnostics.profileIds || []).some(profile => profile?.pending && !profile.error && !profile.hasHtml);
    return hasPendingProfile && !diagnostics.queueRunning && !diagnostics.queueLength && !(diagnostics.queue || []).length && !(diagnostics.generating || []).length && !(diagnostics.activeRequestIds || []).length;
  }
  function devProfileImageRequestActiveForName(name, imageId = "") {
    const wantedName = String(name || "");
    const wantedId = String(imageId || "");
    return wantedId && app.activeProfileImageRequests?.has?.(wantedId) || app.profileImageGenerating?.has?.(wantedName) || app.profileImageGenerating?.has?.(wantedId);
  }
  async function devClearSmokeProfileImagesForNames(names, characterIds = []) {
    const ownerNames = new Set((Array.isArray(names) ? names : [names]).map(name => String(name || "").trim()).filter(Boolean));
    const ownerIds = new Set((Array.isArray(characterIds) ? characterIds : [characterIds]).map(id => String(id || "").trim()).filter(Boolean));
    if (!ownerNames.size && !ownerIds.size) return;
    const belongsToSmokeFixture = image => ownerNames.has(String(image?.owner_name || "").trim()) || ownerIds.has(String(image?.character_id || image?.characterId || "").trim());
    const currentRemoved = exactProfileImageStore(app.profileImages || []).filter(belongsToSmokeFixture);
    // Smoke-only isolation rule: profile-image history is intentionally
    // shared between saves in gameplay, but real-image smokes must not
    // inherit a previous smoke's stale pending record for the same name.
    app.profileImages = exactProfileImageStore((app.profileImages || []).filter(image => !belongsToSmokeFixture(image)));
    try {
      const sharedAll = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []));
      const sharedRemoved = sharedAll.filter(belongsToSmokeFixture);
      const shared = sharedAll.filter(image => !belongsToSmokeFixture(image));
      app.profileImages = exactProfileImageStore(shared);
      const removed = [...currentRemoved, ...sharedRemoved];
      if (removed.length) {
        const deletionReferences = [...new Set(removed.map(image => String(image.id || "")).filter(Boolean))].map(id => ({
          id
        }));
        await deletePerRecordLibraryRecords(PROFILE_IMAGE_KEY, deletionReferences);
        app.profileImages = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, []));
      }
    } catch (err) {
      devTestLog("Smoke profile image shared cleanup failed", {
        names: [...ownerNames],
        characterIds: [...ownerIds],
        error: err?.message || String(err)
      });
    }
    for (const name of ownerNames) {
      const entity = profileEntity(name);
      if (!entity) continue;
      entity.profile_images = [];
      entity.profile_image_id = "";
    }
  }
  async function devWaitForGeneratedProfileImage(name, timeoutMs = DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, label = "real generated profile image") {
    const queuedWaitStartedAt = performance.now();
    const smokeToken = devCurrentSmokeScenarioToken();
    const startDiagnostics = devProfileImageDiagnostics(name);
    const activeIdAtStart = String(startDiagnostics.activeId || "");
    devTestLog("Real profile image wait start", {
      name,
      label,
      perImageTimeoutMs: timeoutMs,
      activeId: activeIdAtStart,
      diagnostics: startDiagnostics
    });
    if (devProfileImageDiagnosticsHasPendingWithoutWork(startDiagnostics)) {
      const err = new Error(`Stale pending profile image record for ${name}: pending profile exists but no queue, generation, or active request is running.`);
      devTestLog("Real profile image stale pending detected", {
        name,
        label,
        diagnostics: startDiagnostics,
        error: err.message
      });
      throw err;
    }
    try {
      await devWaitFor(() => {
        const diagnostics = devProfileImageDiagnostics(name);
        const activeId = String(activeIdAtStart || diagnostics.activeId || "");
        return devProfileImageRequestActiveForName(name, activeId) || profileImagesForEntity(profileEntity(name) || {}).some(image => image?.source === "generated" && image.pending === false && !image.error && devLooksLikeRealImageHtml(image.html));
      }, DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS, `${label} request to start`, {
        smokeToken
      });
      if (smokeToken) devAssertSmokeScenarioActive(smokeToken, label);
      const activeStartedAt = performance.now();
      devTestLog("Real profile image request active", {
        name,
        label,
        queuedWaitMs: Math.round(activeStartedAt - queuedWaitStartedAt),
        perImageTimeoutMs: timeoutMs,
        diagnostics: devProfileImageDiagnostics(name)
      });
      await devWaitFor(() => profileImagesForEntity(profileEntity(name) || {}).some(image => image?.source === "generated" && image.pending === false && !image.error && devLooksLikeRealImageHtml(image.html)), timeoutMs, label, {
        smokeToken
      });
      await devWaitFor(() => {
        const diagnostics = devProfileImageDiagnostics(name);
        return !(diagnostics.generating || []).length && !(diagnostics.queue || []).length && !(diagnostics.activeRequestIds || []).length && !diagnostics.queueRunning;
      }, DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS, `${label} request to finalize`, {
        smokeToken
      });
      if (smokeToken) devAssertSmokeScenarioActive(smokeToken, label);
      const image = profileImagesForEntity(profileEntity(name) || {}).find(profile => profile?.source === "generated" && profile.pending === false && !profile.error && devLooksLikeRealImageHtml(profile.html));
      devTestLog("Real profile image wait success", {
        name,
        label,
        activeElapsedMs: Math.round(performance.now() - activeStartedAt),
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        diagnostics: devProfileImageDiagnostics(name, image)
      });
      return image;
    } catch (err) {
      if (smokeToken && (smokeToken.cancelled || app.activeSmokeScenarioToken !== smokeToken)) throw err;
      const noLivePlugin = !perchancePlugin("textToImagePlugin");
      const noActiveProfileWork = !(app.profileImageQueue || []).length && !(app.profileImageGenerating || new Set()).size && !(app.profileImageQueued || new Set()).size && !(app.activeProfileImageRequests || new Set()).size;
      const finalDiagnostics = devProfileImageDiagnostics(name);
      const stalePending = devProfileImageDiagnosticsHasPendingWithoutWork(finalDiagnostics);
      devTestLog("Real profile image wait failed", {
        name,
        label,
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        error: err?.message || String(err),
        likelyCause: noLivePlugin ? "Live Perchance text-to-image plugin is unavailable." : stalePending ? "A pending profile image record exists without any queue, generation, or active request; this is stale smoke/app state." : noActiveProfileWork ? "No active/pending profile-image work was found; this is likely an EmberAdventures queue/trigger issue." : "Profile-image work exists but did not finish with stored non-pending HTML before timeout; this may be Perchance slowness/outage or an EmberAdventures result-storage issue.",
        diagnostics: finalDiagnostics
      });
      throw err;
    }
  }
  async function devWaitForGeneratedNormalImage(timeoutMs = DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, label = "real generated normal image") {
    const queuedWaitStartedAt = performance.now();
    const smokeToken = devCurrentSmokeScenarioToken();
    let targetId = "";
    try {
      await devWaitFor(() => {
        const image = (app.images || []).find(item => item?.id && (item.pending || item.error || devLooksLikeRealImageHtml(item.html)));
        if (!image?.id) return false;
        targetId = String(image.id);
        return true;
      }, DEV_REAL_PERCHANCE_NORMAL_IMAGE_REQUEST_START_TIMEOUT_MS, `${label} request to be queued`, {
        smokeToken
      });
      const activeStartedAt = performance.now();
      devTestLog("Real normal image request active", {
        label,
        imageId: targetId,
        queuedWaitMs: Math.round(activeStartedAt - queuedWaitStartedAt),
        perImageTimeoutMs: timeoutMs,
        images: (app.images || []).map(image => ({
          id: image.id,
          pending: image.pending,
          error: image.error || "",
          hasHtml: devLooksLikeRealImageHtml(image.html)
        })),
        diagnostics: normalImageRequestDebugSummary((app.images || []).find(image => String(image.id || "") === targetId) || {
          id: targetId
        })
      });
      await devWaitFor(() => {
        const image = (app.images || []).find(item => String(item.id || "") === targetId);
        return !!image && image.pending === false && !image.error && devLooksLikeRealImageHtml(image.html);
      }, timeoutMs, label, {
        smokeToken
      });
      const image = (app.images || []).find(item => String(item.id || "") === targetId);
      devTestLog("Real normal image wait success", {
        label,
        imageId: targetId,
        activeElapsedMs: Math.round(performance.now() - activeStartedAt),
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        image
      });
      return image;
    } catch (err) {
      const noLivePlugin = !perchancePlugin("textToImagePlugin");
      devTestLog("Real normal image wait failed", {
        label,
        imageId: targetId,
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        error: err?.message || String(err),
        likelyCause: noLivePlugin ? "Live Perchance text-to-image plugin is unavailable." : targetId ? "Normal image request exists but did not finish with stored non-pending HTML before timeout; this may be Perchance slowness/outage or an EmberAdventures result-storage issue." : "No normal image request was queued; this is likely an EmberAdventures story-start/image-trigger issue.",
        images: (app.images || []).map(image => ({
          id: image.id,
          reason: image.reason || "",
          title: image.title || "",
          requestOrder: image.requestOrder ?? null,
          pending: image.pending,
          error: image.error || "",
          hasHtml: devLooksLikeRealImageHtml(image.html),
          htmlKind: imageHtmlDebugKind(image.html),
          htmlStart: String(image.html || "").slice(0, 180),
          liveHtmlKind: imageHtmlDebugKind(app.imageLiveHtmlCache?.[String(image.id)] || "")
        })),
        diagnostics: normalImageRequestDebugSummary((app.images || []).find(image => String(image.id || "") === targetId) || {
          id: targetId
        }),
        activeImageRequests: [...(app.activeImageRequests || new Set())]
      });
      throw err;
    }
  }
  async function devWaitForActiveProfileImageReady(name, timeoutMs = DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, label = "real active profile image") {
    const queuedWaitStartedAt = performance.now();
    const smokeToken = devCurrentSmokeScenarioToken();
    const activeIdAtStart = String(devProfileImageDiagnostics(name).activeId || "");
    try {
      await devWaitFor(() => {
        const diagnostics = devProfileImageDiagnostics(name);
        const activeId = String(activeIdAtStart || diagnostics.activeId || "");
        const active = activeProfileImage(profileEntity(name));
        return devProfileImageRequestActiveForName(name, activeId) || !!active && active.pending === false && !active.error && devLooksLikeRealImageHtml(active.html);
      }, DEV_REAL_PERCHANCE_PROFILE_IMAGE_REQUEST_START_TIMEOUT_MS, `${label} request to start`, {
        smokeToken
      });
      const activeStartedAt = performance.now();
      devTestLog("Real active profile image request active", {
        name,
        label,
        queuedWaitMs: Math.round(activeStartedAt - queuedWaitStartedAt),
        perImageTimeoutMs: timeoutMs,
        diagnostics: devProfileImageDiagnostics(name)
      });
      await devWaitFor(() => {
        const active = activeProfileImage(profileEntity(name));
        return !!active && active.pending === false && !active.error && devLooksLikeRealImageHtml(active.html);
      }, timeoutMs, label, {
        smokeToken
      });
      const image = activeProfileImage(profileEntity(name));
      devTestLog("Real active profile image wait success", {
        name,
        label,
        activeElapsedMs: Math.round(performance.now() - activeStartedAt),
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        diagnostics: devProfileImageDiagnostics(name, image)
      });
      return image;
    } catch (err) {
      devTestLog("Real active profile image wait failed", {
        name,
        label,
        totalElapsedMs: Math.round(performance.now() - queuedWaitStartedAt),
        error: err?.message || String(err),
        diagnostics: devProfileImageDiagnostics(name)
      });
      throw err;
    }
  }
  function devAssertProfileImageDisplayedAndStored(name, image, label) {
    setLeftPanelGroup("characters");
    renderCharacters();
    const entity = profileEntity(name);
    const active = activeProfileImage(entity);
    const stored = (app.profileImages || []).find(record => String(record.id) === String(image?.id || ""));
    const card = document.querySelector(`[data-character-action="profile"][data-character-name="${cssEscape(String(name))}"]`);
    devTestLog("Real profile image display/storage check", {
      label,
      requestedId: String(image?.id || ""),
      activeId: String(active?.id || ""),
      activePending: active?.pending,
      activeError: String(active?.error || ""),
      activeHtmlReady: devLooksLikeRealImageHtml(active?.html || ""),
      storedFound: !!stored,
      storedPending: stored?.pending,
      storedError: String(stored?.error || ""),
      storedHtmlReady: devLooksLikeRealImageHtml(stored?.html || ""),
      cardFound: !!card,
      cardHtmlReady: devLooksLikeRealImageHtml(card?.innerHTML || ""),
      diagnostics: devProfileImageDiagnostics(name, image)
    });
    devAssert(!!image?.id && !!entity && String(active?.id || "") === String(image.id) && active.pending === false && !active.error && devLooksLikeRealImageHtml(active.html) && !!stored && stored.pending === false && !stored.error && devLooksLikeRealImageHtml(stored.html) && devLooksLikeRealImageHtml(card?.innerHTML || ""), label, {
      name,
      active,
      stored,
      cardHtmlStart: String(card?.innerHTML || "").slice(0, 180)
    });
  }
  function devAssertProfileImageStored(name, image, label) {
    const entity = profileEntity(name);
    const active = activeProfileImage(entity);
    const stored = (app.profileImages || []).find(record => String(record.id) === String(image?.id || ""));
    devTestLog("Real profile image storage check", {
      label,
      diagnostics: devProfileImageDiagnostics(name, image)
    });
    devAssert(!!image?.id && !!entity && String(active?.id || "") === String(image.id) && active.pending === false && !active.error && devLooksLikeRealImageHtml(active.html) && !!stored && stored.pending === false && !stored.error && devLooksLikeRealImageHtml(stored.html), label, {
      name,
      active,
      stored
    });
  }
  function devRealProfileStartTemplateState(targetKind) {
    const base = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: `Real Profile Start ${targetKind} Smoke`
        }
      },
      player: devCompleteSmokeGenderPresentation({
        ...clone(defaultState.player || {}),
        id: `smoke-real-profile-start-${targetKind}-player`,
        name: "Real Start Player",
        age: 27,
        gender: "female",
        role: "starting player portrait tester",
        boldness: 5,
        speech_style: "Calm, direct, and observant.",
        trust: 0,
        attraction: 0,
        affection: 0,
        image: {
          appearance: "hazel eyes, chestnut hair, blue travel cloak"
        }
      }, "Real Start Player", {
        profileImages: false
      }),
      characters: {},
      npc_directory: {
        locations: {
          courtyard: {
            label: "Courtyard",
            characters: {}
          }
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "A real profile start smoke begins in a quiet courtyard.",
        party_members_present: [],
        npcs_present: [],
        image_characters: ["Player"],
        image_action: "standing in a quiet fantasy courtyard"
      },
      location: {
        ...clone(defaultState.location || {}),
        npc_location_id: "courtyard",
        specific_place: "Courtyard"
      },
      objectives: {
        active_id: "real-profile-start-objective",
        focus_id: "real-profile-start-objective",
        items: [devSmokeObjective("real-profile-start-objective", "Begin the Portrait Test", {
          status: "active",
          next_objectives: [{
            id: "real-profile-start-ending",
            completion_instruction: "Conclude the portrait test.",
            rewards: [],
            ending_type: "freeplay",
            ending_message: "The portrait test can continue in freeplay."
          }]
        })]
      }
    });
    if (targetKind !== "player") {
      base.player.default_profile_image = profileImageSlotFromExactInput({
        url: devSmokeOnePixelDataUrl(),
        local_image_id: "",
        source: "smoke fixture",
        seed: 0,
        prompt: "Existing player portrait for isolated target smoke.",
        negative_prompt: "",
        note: "Fake existing player portrait.",
        male: false
      });
    }
    if (targetKind === "character") {
      base.characters = {
        "Real Start Ally": devCompleteSmokeGenderPresentation({
          ...blankCharacterTemplate("Real Start Ally"),
          id: "smoke-real-profile-start-character-ally",
          name: "Real Start Ally",
          age: 29,
          gender: "female",
          role: "starting party portrait tester",
          boldness: 5,
          speech_style: "Warm, direct, and concise.",
          trust: 0,
          attraction: 0,
          affection: 0,
          image: {
            appearance: "black bob haircut, gold earrings, green mantle"
          }
        }, "Real Start Ally", {
          profileImages: false
        })
      };
      base.scene.party_members_present = ["Real Start Ally"];
      base.scene.image_characters = ["Player", "Real Start Ally"];
    }
    if (targetKind === "npc") {
      base.npc_directory = {
        locations: {
          courtyard: {
            label: "Courtyard",
            characters: {
              "Real Start Mentor": {
                name: "Real Start Mentor",
                age: 36,
                gender: "female",
                role: "starting inspected NPC portrait tester",
                relationship: "opening mentor",
                inspected: true,
                full_character: materializeCharacterForRuntime(devCompleteSmokeGenderPresentation({
                  ...blankCharacterTemplate("Real Start Mentor"),
                  id: "smoke-real-profile-start-npc-mentor",
                  name: "Real Start Mentor",
                  age: 36,
                  gender: "female",
                  role: "starting inspected NPC portrait tester",
                  boldness: 5,
                  speech_style: "Measured, patient, and precise.",
                  trust: 0,
                  attraction: 0,
                  affection: 0,
                  image: {
                    appearance: "silver hair, violet eyes, embroidered scholar robe"
                  }
                }, "Real Start Mentor", {
                  profileImages: false
                }), "Real Start Mentor")
              }
            }
          }
        }
      };
      base.scene.npcs_present = ["Real Start Mentor"];
      base.scene.image_characters = ["Player", "Real Start Mentor"];
    }
    addImmutableDefinitionFieldsToState(base);
    return base;
  }
  async function devRunRealProfileStartSmokeTest(targetKind, useRealPerchance = true) {
    const scenarioId = `${useRealPerchance ? "real-" : "deterministic-"}profile-start-${targetKind}-smoke`;
    const targetName = targetKind === "player" ? "Player" : targetKind === "character" ? "Real Start Ally" : "Real Start Mentor";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    const withImagePlugin = useRealPerchance ? devWithRealPerchanceImagePlugin : devWithDeterministicImagePlugin;
    return withImagePlugin(scenarioId, async () => {
      const originalStartGenerateImageHtml = generateImageHtml;
      if (useRealPerchance) {
        generateImageHtml = (...args) => {
          const options = args[4] || {};
          const promptType = String(options.promptType || options.label || "");
          const requestedName = String(options.promptEditorReplay?.name || "");
          if (/profile image/i.test(promptType) && requestedName === targetName) return originalStartGenerateImageHtml(...args);
          return devSmokeFakeImageHtml(...args);
        };
      }
      try {
        devResetForLiveTest(scenarioId);
        devResetPreferenceSettingsForSmoke({});
        await devClearSmokeProfileImagesForNames(["Player", "Real Start Ally", "Real Start Mentor"], [`smoke-real-profile-start-${targetKind}-player`, "smoke-real-profile-start-character-ally", "smoke-real-profile-start-npc-mentor"]);
        const sourceState = devRealProfileStartTemplateState(targetKind);
        sourceState.player.clothing = {
          shirt: "plain portrait smoke shirt",
          pants: "plain portrait smoke trousers"
        };
        sourceState.player.outfits = [{
          id: "default",
          name: "Default",
          clothing: clone(sourceState.player.clothing || {})
        }];
        sourceState.player.active_outfit_id = "default";
        sourceState.player.starting_outfit_id = "default";
        const template = devSmokeStoryRecord({
          id: scenarioId,
          title: `Real Profile Start ${targetKind} Smoke`,
          description: `Starts a game and verifies ${targetKind} profile generation.`,
          source: "Original / smoke",
          genres: ["fantasy"],
          player: sourceState.player,
          characters: sourceState.characters,
          npc_directory: sourceState.npc_directory,
          npc_location_id: sourceState.location?.npc_location_id,
          location: sourceState.location,
          party_members_present: sourceState.scene?.party_members_present || [],
          image_characters: sourceState.scene?.image_characters || [],
          npcs_present: sourceState.scene?.npcs_present || [],
          objectives: [devSmokeObjective("real-profile-start-objective", "Begin the Portrait Test", {
            status: "active",
            completion_control: "player",
            completion_criteria: "The player begins the portrait test.",
            next_objectives: [{
              id: "portrait-smoke-ending",
              completion_instruction: "Conclude the portrait smoke.",
              rewards: [],
              ending_type: "freeplay",
              ending_message: "The portrait smoke continues in freeplay."
            }]
          })],
          active_id: "real-profile-start-objective",
          messages: [{
            role: "assistant",
            speaker: "Narrator",
            text: "The courtyard is quiet enough for a portrait smoke test."
          }]
        });
        const targetDefinition = targetKind === "player" ? template.state.player : targetKind === "character" ? template.state.characters?.["Real Start Ally"] : template.state.npc_directory?.locations?.courtyard?.characters?.["Real Start Mentor"]?.full_character;
        targetDefinition.default_profile_image = emptyProfileImageSlot(false);
        targetDefinition.profile_image_presentations = {
          male: emptyProfileImageSlot(true),
          non_male: emptyProfileImageSlot(false)
        };
        targetDefinition.profile_images = {
          active_image_id: "",
          image_ids: []
        };
        delete targetDefinition.profile_image_id;
        app.profileImageResolutionEpoch = (Number(app.profileImageResolutionEpoch) || 0) + 1;
        const inheritedProfile = activeProfileImage(targetDefinition);
        devAssert(!String(inheritedProfile?.id || "").trim() && !profileImageRealHtml(inheritedProfile?.html), `${scenarioId} fixture does not inherit a profile image from an earlier smoke`, {
          targetName,
          targetProfileImageId: targetDefinition.profile_image_id || "",
          sharedProfiles: (app.profileImages || []).filter(image => String(image.owner_name || "") === targetName || String(image.character_id || image.characterId || "") === String(targetDefinition.id || "")).map(image => image.id),
          inheritedProfileId: inheritedProfile?.id || ""
        });
        devUpsertStoryTemplatesForSmoke([template]);
        devTestLog("Real profile start template trigger", {
          scenarioId,
          targetKind,
          targetName
        });
        await startStoryTemplate(template.id);
        devAcceptPlayerInputHelpIfShown();
        render();
        devTestLog("Real profile start after template load", {
          scenarioId,
          diagnostics: devProfileImageDiagnostics(targetName),
          activeSaveId: activeSaveId(),
          saveIndexCount: saveIndexRecords().length
        });
        const generatedProfile = await devWaitForGeneratedProfileImage(targetName, DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, `real start ${targetKind} missing profile image generation to finish`);
        render();
        devAssert(!!generatedProfile && devLooksLikeRealImageHtml(generatedProfile.html), `real started-game ${targetKind} missing automatic portrait request creates a profile image`, {
          activeProfile: generatedProfile,
          diagnostics: devProfileImageDiagnostics(targetName)
        });
        addMessage("system", `Real profile start ${targetKind} smoke passed.`);
        render();
        devTestLog(`Scenario complete: ${scenarioId}`);
      } finally {
        generateImageHtml = originalStartGenerateImageHtml;
        await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
      }
    });
  }
  async function devRunRealProfileStartPlayerSmokeTest() {
    // Manual image coverage already exercises the player profile path
    // against Perchance. Keep deterministic coverage for every start
    // target so missing normalized scene membership fails locally too.
    await devRunRealProfileStartSmokeTest("player", false);
    await devRunRealProfileStartSmokeTest("character", false);
    await devRunRealProfileStartSmokeTest("npc", false);
  }
  function devRunRealProfileStartCharacterSmokeTest() {
    return devRunRealProfileStartSmokeTest("character", false);
  }
  function devRunRealProfileStartNpcSmokeTest() {
    return devRunRealProfileStartSmokeTest("npc", false);
  }
  async function devRunImageAndProfileUiTest(options = {}) {
    const scenarioId = options.scenarioId || "image-profile-ui";
    const requireRealPerchancePlugin = options.requireRealPerchancePlugin === true;
    devTestLog(`Scenario start: ${scenarioId}`);
    devResetForLiveTest(scenarioId);
    closeModal();
    devResetPreferenceSettingsForSmoke({});
    const pluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
    const hadTextToImageOverride = Object.prototype.hasOwnProperty.call(pluginOverrides, "textToImagePlugin");
    const previousTextToImageOverride = pluginOverrides.textToImagePlugin;
    const fakeTextToImagePlugin = () => ({
      onFinishPromise: Promise.resolve({
        dataUrl: devSmokeOnePixelDataUrl()
      })
    });
    if (requireRealPerchancePlugin) {
      delete pluginOverrides.textToImagePlugin;
    } else {
      // Smoke rule: image-profile-ui always uses a deterministic fake.
      // Only real-perchance-image-generation-smoke is allowed to hit the
      // live Perchance text-to-image plugin.
      pluginOverrides.textToImagePlugin = fakeTextToImagePlugin;
    }
    const imagePlugin = perchancePlugin("textToImagePlugin");
    devAssert(!requireRealPerchancePlugin || !!imagePlugin, "real Perchance text-to-image plugin is available for live image generation smoke");
    const useFakeImagePlugin = !requireRealPerchancePlugin;
    devAssert(requireRealPerchancePlugin || imagePlugin === fakeTextToImagePlugin, "image-profile-ui uses deterministic fake image plugin", {
      scenarioId,
      useFakeImagePlugin
    });
    const unsafeProfileImage = createProfileImageRecord({
      id: "unsafe-profile-image-smoke",
      character_id: "image-tester",
      owner_name: "Image Tester",
      html: "<scr" + "ipt>window.__bad=1</scr" + "ipt><img src=x onerror=\"window.__bad=1\">",
      pending: false,
      error: ""
    });
    devAssert(unsafeProfileImage && !unsafeProfileImage.html, "unsafe profile image HTML is rejected instead of persisted", unsafeProfileImage);
    app.state = {
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true,
        story_source: {
          mode: "original",
          title: "Live Image Test"
        }
      },
      player: {
        ...clone(defaultState.player || {}),
        id: "image-tester",
        name: "Image Tester",
        age: 24,
        gender: "non-male",
        role: "fantasy scout",
        personality_description: "Practical, alert, and ready for a portrait test.",
        image: {
          appearance: "short dark hair, green cloak, leather travel gear"
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        summary: "Image test at a lantern-lit fantasy market",
        objective: "Verify manual image generation",
        party_members_present: ["Player"],
        image_characters: ["Player"],
        npcs_present: [],
        image_action: "standing beside a carved wooden sign at a lantern-lit fantasy market"
      },
      objectives: {
        active_id: "image_test",
        focus_id: "image_test",
        items: [{
          id: "image_test",
          title: "Verify Image Generation",
          type: "story",
          status: "active",
          summary: "Test normal and profile image generation.",
          objective: "Generate one normal image and one profile image.",
          steps: [],
          notes: [],
          rewards: []
        }]
      }
    };
    const openingEntryId = nextEntryId();
    app.messages = [{
      id: openingEntryId,
      entryId: openingEntryId,
      role: "assistant",
      speaker: "Narrator",
      text: "A lantern-lit market waits quietly while the image test begins.",
      at: new Date().toISOString()
    }];
    app.settings.reducedUi = false;
    app.settings.showAffectionStats = true;
    applyReducedUiClass();
    scheduleActiveGameSave();
    render();
    const visibleImageUiText = devVisibleText($("imagePanel"));
    devAssert(!/Waiting for Perchance image generation|Profile portrait|Portrate/i.test(visibleImageUiText), "image/profile UI does not show banned loading or placeholder labels", {
      text: visibleImageUiText.slice(0, 2000)
    });
    const autosizeFixture = document.createElement("div");
    autosizeFixture.style.cssText = "position:absolute;left:-10000px;top:0;opacity:0;pointer-events:none;";
    const pendingIframeHtml = `<iframe data-src="#${encodeURIComponent(JSON.stringify({
      resolution: "768x768",
      seed: 401373475,
      guidanceScale: 7,
      requestId: "0.810952478411"
    }))}"></iframe>`;
    autosizeFixture.innerHTML = `
                <div class="profile-image-button" style="width:96px;height:96px">
                    ${profileImagePendingInfoHtml(pendingIframeHtml, "Perchance image generation", "Generating preview")}
                </div>
                <div class="profile-image-button" style="width:240px;height:240px">
                    ${profileImagePendingInfoHtml(pendingIframeHtml, "Perchance image generation", "Generating preview")}
                </div>
            `;
    document.body.appendChild(autosizeFixture);
    autosizeProfileImageLoadingOverlays(autosizeFixture);
    const [smallPending, largePending] = [...autosizeFixture.querySelectorAll(".profile-image-loading-rich")];
    const smallFont = parseFloat(getComputedStyle(smallPending).getPropertyValue("--profile-loading-font-size"));
    const largeFont = parseFloat(getComputedStyle(largePending).getPropertyValue("--profile-loading-font-size"));
    const smallSpinner = smallPending.querySelector(".loading-spinner")?.getBoundingClientRect?.().width || 0;
    const largeSpinner = largePending.querySelector(".loading-spinner")?.getBoundingClientRect?.().width || 0;
    devAssert(largeFont > smallFont && largeSpinner > smallSpinner, "profile image pending details and spinner scale to available card space", {
      smallFont,
      largeFont,
      smallSpinner,
      largeSpinner
    });
    autosizeFixture.remove();
    const imageButton = $("imageBtn");
    devAssert(!!imageButton && !imageButton.disabled, "manual image button is visible and enabled");
    const beforeImages = (app.images || []).length;
    imageButton.click();
    await devWaitFor(() => (app.images || []).length > beforeImages, DEV_REAL_PERCHANCE_MANUAL_IMAGE_RECORD_TIMEOUT_MS, "manual image record to be created");
    const sceneImages = app.images || [];
    const sceneImage = sceneImages[sceneImages.length - 1];
    devAssert(sceneImage?.pending, "manual image starts as pending", sceneImage);
    const sceneImageById = () => (app.images || []).find(image => image.id === sceneImage.id);
    await devWaitFor(() => sceneImageById()?.pending === false && !sceneImageById()?.error && devLooksLikeRealImageHtml(sceneImageById()?.html), requireRealPerchancePlugin ? DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS : 90000, "manual scene image to receive generated image output");
    const finishedSceneImage = sceneImageById();
    devAssert(finishedSceneImage?.pending === false && !finishedSceneImage?.error && devLooksLikeRealImageHtml(finishedSceneImage?.html), "manual scene image received generated image html", {
      pending: finishedSceneImage?.pending,
      error: finishedSceneImage?.error,
      htmlStart: String(finishedSceneImage?.html || "").slice(0, 120)
    });
    setLeftPanelGroup("characters");
    render();
    const profileButton = document.querySelector(`[data-character-action="profile"][data-character-name="${cssEscape(app.state.player?.name || "")}"]`) || document.querySelector('[data-character-action="profile"][data-character-name="Player"]') || document.querySelector('[data-character-action="profile"]');
    devAssert(!!profileButton, "visible current-player profile image button exists");
    profileButton.click();
    const modal = $("modal");
    devAssert(modal?.classList?.contains("open") && /Profile Image/i.test($("modalBox")?.textContent || ""), "profile image modal opened through player card");
    devAssert($("modalBox")?.matches?.("[data-profile-image-modal-box='1']"), "profile image modal uses fullscreen layout");
    devAssert(!/Waiting for Perchance image generation|Profile portrait|Portrate/i.test(devVisibleText($("modalBox"))), "profile image modal does not show banned loading or placeholder labels", {
      text: devVisibleText($("modalBox")).slice(0, 1200)
    });
    devAssert(![...$("modalBox").querySelectorAll("button")].some(button => /upload|share/i.test(button.textContent || button.title || "")), "profile image modal exposes neither upload nor public share buttons", [...$("modalBox").querySelectorAll("button")].map(button => button.textContent || button.title || ""));
    devAssert(!!$("modalBox").querySelector(".profile-related-images [data-image-id] .image-preview-hitbox"), "profile image modal renders related normal images as previewable full image cards");
    const generateProfileButton = $("generateProfileImageBtn");
    devAssert(!!generateProfileButton && !generateProfileButton.disabled, "generate profile image button is visible and enabled");
    const beforeProfiles = profileImagesForEntity(app.state.player || {}).length;
    generateProfileButton.click();
    await devWaitFor(() => profileImagesForEntity(app.state.player || {}).length > beforeProfiles, DEV_REAL_PERCHANCE_MANUAL_IMAGE_RECORD_TIMEOUT_MS, "manual profile image record to be created");
    await devWaitFor(() => profileImagesForEntity(app.state.player || {}).some(image => image.pending === false && !image.error && devLooksLikeRealImageHtml(image.html)), requireRealPerchancePlugin ? DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS : 90000, "manual profile image to receive generated image output");
    const profileImages = profileImagesForEntity(app.state.player || {});
    devAssert(profileImages.some(image => image.pending === false && !image.error && devLooksLikeRealImageHtml(image.html)), "manual profile image received generated image html", {
      count: profileImages.length,
      activeId: app.state.player?.profile_image_id
    });
    const closeButton = $("modalBox")?.querySelector(".modal-close");
    devAssert(!!closeButton, "profile image modal has visible close button");
    closeButton.click();
    render();
    devAssert(!$("modal")?.classList?.contains("open"), "profile image modal closes through visible close button");
    await devWaitFor(() => {
      const playerCard = document.querySelector('[data-character-action="profile"][data-character-name="Player"]');
      return devLooksLikeRealImageHtml(playerCard?.innerHTML || "");
    }, 5000, "party card profile image thumbnail to update");
    devAssert(devLooksLikeRealImageHtml(document.querySelector('[data-character-action="profile"][data-character-name="Player"]')?.innerHTML || ""), "party card profile thumbnail shows generated profile image after modal close");
    if (requireRealPerchancePlugin) {
      devAssertProfileImageDisplayedAndStored("Player", activeProfileImage(app.state.player), "real manual profile image is finished, stored, active, and displayed");
    }
    if (hadTextToImageOverride) pluginOverrides.textToImagePlugin = previousTextToImageOverride;else delete pluginOverrides.textToImagePlugin;
    addMessage("system", "Image/profile UI smoke test passed.");
    render();
    devTestLog(`Scenario complete: ${scenarioId}`, {
      images: app.images.length,
      profileImages: profileImages.length,
      fakeImagePlugin: useFakeImagePlugin,
      realPerchancePluginRequired: requireRealPerchancePlugin
    });
  }
  async function devRunRealPerchanceImageGenerationSmokeTest() {
    return devRunImageAndProfileUiTest({
      scenarioId: "real-perchance-image-generation-smoke",
      requireRealPerchancePlugin: true
    });
  }
  async function devRunRealProfileManualRefreshSmokeTest() {
    const scenarioId = "real-profile-manual-refresh-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    return devWithDeterministicImagePlugin(scenarioId, async () => {
      try {
        devResetForLiveTest(scenarioId);
        devResetPreferenceSettingsForSmoke({});
        const oldHtml = `<img src="${devSmokeOnePixelDataUrl()}" alt="existing real-manual smoke portrait">`;
        app.state = repairAiGeneratedState({
          ...clone(defaultState),
          meta: {
            ...clone(defaultState.meta || {}),
            setup_complete: true,
            story_source: {
              mode: "original",
              title: "Real Profile Manual Refresh Smoke"
            }
          },
          player: {
            ...clone(defaultState.player || {}),
            id: "real-scene-entry-player",
            name: "Real Manual Tester",
            age: 26,
            gender: "female",
            role: "portrait regression tester",
            image: {
              appearance: "auburn hair, blue cloak, calm expression"
            }
          },
          scene: {
            ...clone(defaultState.scene || {}),
            party_members_present: ["Player"],
            image_characters: ["Player"]
          }
        });
        app.profileImages = [];
        rememberProfileImage("Player", {
          id: "real-manual-existing",
          source: "existing",
          model: "default",
          seed: 111,
          prompt: "Existing manual profile smoke portrait",
          html: oldHtml,
          profile: true,
          pending: false,
          error: ""
        }, {
          setActive: true
        });
        scheduleActiveGameSave();
        render();
        openProfileImageModal("Player");
        const existingCardBefore = document.querySelector('[data-profile-image-id="real-manual-existing"]');
        const existingImageBefore = existingCardBefore?.querySelector("img");
        devAssert(!!existingCardBefore && !!existingImageBefore, "real manual refresh starts with an existing profile image card");
        devTestLog("Real profile manual refresh trigger", {
          before: devProfileImageDiagnostics("Player")
        });
        $("generateProfileImageBtn")?.click();
        const generated = await devWaitForGeneratedProfileImage("Player", DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, "real manual profile image generation to finish");
        const existingCardAfter = document.querySelector('[data-profile-image-id="real-manual-existing"]');
        const existingImageAfter = existingCardAfter?.querySelector("img");
        devAssert(existingCardAfter === existingCardBefore && existingImageAfter === existingImageBefore, "real manual profile generation preserves existing profile image DOM", {
          sameCard: existingCardAfter === existingCardBefore,
          sameImage: existingImageAfter === existingImageBefore
        });
        devAssert(activeProfileImage(app.state.player)?.id === generated.id && profileImagesForEntity(app.state.player).some(image => image.id === "real-manual-existing"), "real manual profile generation creates a new active image without deleting the old one", {
          active: activeProfileImage(app.state.player),
          profiles: profileImagesForEntity(app.state.player).map(image => image.id)
        });
        devAssertProfileImageDisplayedAndStored("Player", generated, "real manual profile image is finished, stored, active, and displayed");
        closeModal();
        addMessage("system", "Real profile manual refresh smoke passed.");
        render();
        devTestLog(`Scenario complete: ${scenarioId}`);
      } finally {
        await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
      }
    });
  }
  async function devRunRealProfileSceneEntrySmokeTest() {
    const scenarioId = "real-profile-scene-entry-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    return devWithDeterministicImagePlugin(scenarioId, async () => {
      try {
        devResetForLiveTest(scenarioId);
        devResetPreferenceSettingsForSmoke({});
        app.state = repairAiGeneratedState({
          ...clone(defaultState),
          meta: {
            ...clone(defaultState.meta || {}),
            setup_complete: true,
            story_source: {
              mode: "original",
              title: "Real Profile Scene Entry Smoke"
            }
          },
          player: {
            ...clone(defaultState.player || {}),
            id: "real-scene-entry-player",
            name: "Scene Entry Tester",
            age: 27,
            gender: "female",
            profile_image_id: "scene-entry-player-existing",
            profile_images: [{
              id: "scene-entry-player-existing",
              male: false
            }]
          },
          characters: {
            "Real Scene Ally": {
              ...blankCharacterTemplate("Real Scene Ally"),
              id: "real-scene-ally",
              name: "Real Scene Ally",
              age: 29,
              gender: "female",
              role: "scene-entry ally",
              image: {
                appearance: "short black hair, emerald scarf, bright eyes"
              }
            }
          },
          scene: {
            ...clone(defaultState.scene || {}),
            party_members_present: [],
            npcs_present: [],
            image_characters: ["Player"]
          }
        });
        app.profileImages = exactProfileImageStore([createProfileImageRecord({
          id: "scene-entry-player-existing",
          character_id: app.state.player.id,
          owner_name: "Player",
          male: false,
          source: "existing",
          html: `<img src="${devSmokeOnePixelDataUrl()}" alt="existing player">`
        })]);
        scheduleActiveGameSave();
        render();
        devTestLog("Real profile scene-entry trigger", {
          before: devProfileImageDiagnostics("Real Scene Ally"),
          scene: app.state.scene
        });
        togglePresence("Real Scene Ally");
        const generated = await devWaitForActiveProfileImageReady("Real Scene Ally", DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, "real scene-entry profile image generation to finish");
        render();
        devAssert(!!generated && activeProfileImage(app.state.characters["Real Scene Ally"])?.id === generated.id && activeProfileImage(app.state.player)?.id === "scene-entry-player-existing", "real scene-entry auto generation creates the missing first profile image without changing existing portraits", {
          generated,
          allyProfile: activeProfileImage(app.state.characters["Real Scene Ally"]),
          playerProfile: activeProfileImage(app.state.player)
        });
        addMessage("system", "Real profile scene-entry smoke passed.");
        render();
        devTestLog(`Scenario complete: ${scenarioId}`);
      } finally {
        await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
      }
    });
  }
  async function devRunRealProfileObjectiveRewardSmokeTest() {
    const scenarioId = "real-profile-objective-reward-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    // The dedicated Perchance image smoke owns live provider coverage.
    // This scenario isolates the objective reward and queue behavior.
    return devWithDeterministicImagePlugin(scenarioId, async () => {
      try {
        devResetForLiveTest(scenarioId);
        devResetPreferenceSettingsForSmoke({});
        const futureFull = materializeCharacterForRuntime({
          ...blankCharacterTemplate("Real Reward Mira"),
          id: "real-reward-mira",
          name: "Real Reward Mira",
          age: 31,
          gender: "female",
          role: "objective reward guide",
          personality_description: "Patient, focused, and practical.",
          image: {
            appearance: "silver braid, violet mantle, lantern pin"
          }
        }, "Real Reward Mira");
        app.state = repairAiGeneratedState({
          ...clone(defaultState),
          meta: {
            ...clone(defaultState.meta || {}),
            setup_complete: true,
            story_source: {
              mode: "original",
              title: "Real Profile Objective Reward Smoke"
            }
          },
          location: {
            ...clone(defaultState.location || {}),
            npc_location_id: "real-reward-square",
            settlement_name: "Reward Town",
            specific_place: "real reward square"
          },
          future_cast: {
            enabled: true,
            items: {
              "real-reward-mira": {
                id: "real-reward-mira",
                name: "Real Reward Mira",
                age: 31,
                gender: "female",
                role: "objective reward guide",
                full_character: futureFull,
                status: "future",
                location_hint: "real reward square",
                npc_location_id: "real-reward-square"
              }
            }
          },
          objectives: {
            active_id: "real-reward-introduce",
            items: [{
              id: "real-reward-introduce",
              title: "Introduce Real Reward Mira",
              type: "story",
              status: "complete",
              summary: "Introduce the reward character.",
              completion_control: "player",
              completion_criteria: "Already complete for smoke.",
              rewards: [{
                type: "introduce_future_character",
                character_id: "real-reward-mira",
                npc_location_id: "real-reward-square",
                scene_presence: "nearby"
              }]
            }, {
              id: "real-reward-promote",
              title: "Promote Real Reward Mira",
              type: "story",
              status: "active",
              summary: "Promote the reward character.",
              completion_control: "player",
              completion_criteria: "Already complete for smoke.",
              rewards: [{
                type: "promote_future_character_to_party",
                character_id: "real-reward-mira"
              }]
            }]
          }
        });
        app.profileImages = [];
        app.messages = [];
        scheduleActiveGameSave();
        const beforeIntroduce = clone(app.state);
        devTestLog("Real profile objective reward introduce trigger", {
          before: devProfileImageDiagnostics("Real Reward Mira")
        });
        applyObjectiveProgressRewards(beforeIntroduce, app.state, scenarioId, {
          silentGameMessage: true
        });
        const rewardImage = await devWaitForActiveProfileImageReady("Real Reward Mira", DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, "real objective-introduced NPC profile image generation to finish");
        const beforePromote = clone(app.state);
        const promoteObjective = app.state.objectives.items.find(item => item.id === "real-reward-promote");
        if (promoteObjective) promoteObjective.status = "complete";
        devTestLog("Real profile objective reward promote trigger", {
          before: devProfileImageDiagnostics("Real Reward Mira")
        });
        applyObjectiveProgressRewards(beforePromote, app.state, `${scenarioId}-promote`, {
          silentGameMessage: true
        });
        const partyProfile = activeProfileImage(app.state.characters["Real Reward Mira"]);
        render();
        devAssert(!!app.state.characters["Real Reward Mira"] && !!rewardImage && devLooksLikeRealImageHtml(rewardImage.html) && partyProfile?.id === rewardImage.id && profileEntity("Real Reward Mira") === app.state.characters["Real Reward Mira"], "real objective reward introduction/promotion creates the missing first profile image", {
          rewardImage,
          partyProfile,
          npcProfile: activeProfileImage(getNpcEntry("Real Reward Mira", "real-reward-square")?.full_character)
        });
        addMessage("system", "Real profile objective reward smoke passed.");
        render();
        devTestLog(`Scenario complete: ${scenarioId}`);
      } finally {
        await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
      }
    });
  }
  async function devRunRealProfileEditorRefreshSmokeTest() {
    const scenarioId = "real-profile-editor-refresh-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    return devWithDeterministicImagePlugin(scenarioId, async () => {
      try {
        devResetForLiveTest(scenarioId);
        devResetPreferenceSettingsForSmoke({});
        app.state = repairAiGeneratedState({
          ...clone(defaultState),
          meta: {
            ...clone(defaultState.meta || {}),
            setup_complete: true,
            story_source: {
              mode: "original",
              title: "Real Profile Editor Refresh Smoke"
            }
          },
          characters: {
            "Real Editor Kara": {
              ...blankCharacterTemplate("Real Editor Kara"),
              id: "real-editor-kara",
              name: "Real Editor Kara",
              age: 28,
              gender: "female",
              role: "editor portrait tester",
              image: {
                appearance: "brown hair, white blouse, red ribbon"
              },
              profile_image_id: "real-editor-existing",
              profile_images: [{
                id: "real-editor-existing",
                male: false
              }]
            }
          },
          scene: {
            ...clone(defaultState.scene || {}),
            party_members_present: ["Real Editor Kara"],
            image_characters: ["Player", "Real Editor Kara"]
          }
        });
        app.profileImages = exactProfileImageStore([createProfileImageRecord({
          id: "real-editor-existing",
          character_id: app.state.characters["Real Editor Kara"].id,
          owner_name: "Real Editor Kara",
          male: false,
          source: "existing",
          model: "default",
          seed: 222,
          prompt: "old editor profile",
          html: `<img src="${devSmokeOnePixelDataUrl()}" alt="old editor profile">`
        })]);
        scheduleActiveGameSave();
        render();
        editCharacter("Real Editor Kara");
        const modalText = $("modalBox")?.textContent || "";
        devAssert(/Edit Real Editor Kara/i.test(modalText), "real editor refresh character editor opens");
        app.state.characters["Real Editor Kara"].appearance.hair_color = "bright copper";
        app.state.characters["Real Editor Kara"].image.appearance = "bright copper hair, white blouse, red ribbon, determined smile";
        deferEditorProfileRefresh("Real Editor Kara", "character editor closed");
        devTestLog("Real profile editor refresh trigger", {
          before: devProfileImageDiagnostics("Real Editor Kara")
        });
        closeModal();
        const generated = await devWaitForGeneratedProfileImage("Real Editor Kara", DEV_REAL_PERCHANCE_IMAGE_TIMEOUT_MS, "real editor-close profile refresh generation to finish");
        render();
        devAssert(!!generated && generated.id !== "real-editor-existing" && profileImagesForEntity(app.state.characters["Real Editor Kara"]).some(image => image.id === "real-editor-existing") && activeProfileImage(app.state.characters["Real Editor Kara"])?.id === generated.id, "real editor-close refresh creates one new active profile image and preserves the old one", {
          active: activeProfileImage(app.state.characters["Real Editor Kara"]),
          profiles: profileImagesForEntity(app.state.characters["Real Editor Kara"]).map(image => image.id)
        });
        devAssertProfileImageDisplayedAndStored("Real Editor Kara", generated, "real editor refresh profile image is finished, stored, active, and displayed");
        addMessage("system", "Real profile editor refresh smoke passed.");
        render();
        devTestLog(`Scenario complete: ${scenarioId}`);
      } finally {
        await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
      }
    });
  }
  async function devRunRealProfileImportSmallSmokeTest() {
    const scenarioId = "real-profile-import-small-smoke";
    devTestLog(`Scenario start: ${scenarioId}`);
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    try {
      devResetForLiveTest(scenarioId);
      devResetPreferenceSettingsForSmoke({});
      app.state = repairAiGeneratedState({
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true,
          story_source: {
            mode: "original",
            title: "Real Profile Import Small Smoke"
          }
        },
        characters: {},
        scene: {
          ...clone(defaultState.scene || {}),
          party_members_present: [],
          npcs_present: [],
          image_characters: ["Player"]
        }
      });
      app.profileImages = [];
      const onePixelDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
      await devImportCharacterRecords([{
        character_definition: {
          ...devSmokeCharacterRecord("Real Import Small").character,
          name: "Real Import Small",
          age: 30,
          gender: "female",
          role: "small import portrait tester",
          default_profile_image: profileImageSlotFromExactInput({
            ...devSmokeDefaultProfileImage("Real Import Small", false),
            url: onePixelDataUrl,
            source: "small import non-male default",
            prompt: "small import default portrait",
            male: false
          }),
          profile_image_presentations: {
            male: profileImageSlotFromExactInput({
              ...devSmokeDefaultProfileImage("Real Import Small Male", true),
              url: onePixelDataUrl,
              source: "small import male default",
              prompt: "small import male default portrait",
              male: true
            }),
            non_male: profileImageSlotFromExactInput({
              ...devSmokeDefaultProfileImage("Real Import Small", false),
              url: onePixelDataUrl,
              source: "small import non-male default",
              prompt: "small import default portrait",
              male: false
            })
          }
        }
      }], {
        playerWarningAccepted: true
      });
      const importNoticeText = String(document.querySelector(".popup-modal #noticeText")?.textContent || document.querySelector(".popup-modal")?.textContent || "").trim();
      document.querySelector(".popup-modal #noticeOkBtn")?.click();
      devTestLog("Real profile small import trigger", {
        afterImport: JSON.stringify({
          diagnostics: devProfileImageDiagnostics("Real Import Small"),
          importNoticeText,
          characterNames: Object.keys(app.state.characters || {})
        })
      });
      devAssert(activeProfileImage(app.state.characters["Real Import Small"])?.source === "small import non-male default" && !app.state.characters["Real Import Small"]?.profile_image_auto_skip && !app.profileImageQueue?.length && !app.profileImageQueued?.size && !app.profileImageGenerating?.size, "real small character import copies supplied profile presentation without generating", {
        profile: activeProfileImage(app.state.characters["Real Import Small"]),
        skip: app.state.characters["Real Import Small"]?.profile_image_auto_skip,
        queue: app.profileImageQueue?.map?.(item => item?.name),
        queued: [...(app.profileImageQueued || new Set())],
        generating: [...(app.profileImageGenerating || new Set())]
      });
      addMessage("system", "Real profile small import smoke passed.");
      render();
      devTestLog(`Scenario complete: ${scenarioId}`);
    } finally {
      await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
    }
  }
  async function devRunProfileImageRefreshPreserveSmokeTest() {
    devTestLog("Scenario start: profile-image-refresh-preserve-smoke");
    devResetForLiveTest("profile-image-refresh-preserve-smoke");
    devResetPreferenceSettingsForSmoke({});
    const previousTextToImagePlugin = globalThis.textToImagePlugin;
    const existingOneHtml = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    const existingTwoHtml = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    globalThis.textToImagePlugin = () => ({
      iframeHtml: '<iframe data-src="about:blank#new-profile-image-smoke"></iframe>',
      onFinishPromise: new Promise(resolve => setTimeout(() => resolve({
        dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
      }), 300))
    });
    try {
      app.state = repairAiGeneratedState({
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true
        },
        player: {
          ...clone(defaultState.player || {}),
          id: "profile-refresh-preserve-player",
          name: "Public Download Ally",
          age: 25,
          gender: "non-male",
          role: "portrait smoke tester",
          image: {
            appearance: "silver hair, blue cloak, confident expression"
          }
        },
        scene: {
          ...clone(defaultState.scene || {}),
          party_members_present: ["Player"],
          image_characters: ["Player"]
        }
      });
      app.profileImages = [];
      rememberProfileImage("Player", {
        id: "existing-profile-1",
        source: "generated",
        model: "default",
        seed: 111,
        prompt: "Existing profile one",
        negativePrompt: "",
        html: existingOneHtml,
        profile: true,
        pending: false,
        error: ""
      }, {
        setActive: true
      });
      rememberProfileImage("Player", {
        id: "existing-profile-2",
        source: "generated",
        model: "default",
        seed: 222,
        prompt: "Existing profile two",
        negativePrompt: "",
        html: existingTwoHtml,
        profile: true,
        favorite: true,
        pending: false,
        error: ""
      }, {
        setActive: false
      });
      scheduleActiveGameSave();
      render();
      openProfileImageModal("Player");
      const profilesBefore = profileImagesForEntity(app.state.player || {});
      const storeBefore = new Map(["existing-profile-1", "existing-profile-2"].map(id => [id, clone(profileStoreImageById(id))]));
      const firstCardBefore = document.querySelector('[data-profile-image-id="existing-profile-1"]');
      const firstImageBefore = firstCardBefore?.querySelector("img");
      const secondCardBefore = document.querySelector('[data-profile-image-id="existing-profile-2"]');
      const secondImageBefore = secondCardBefore?.querySelector("img");
      const firstOuterHtmlBefore = firstImageBefore?.outerHTML || "";
      const secondOuterHtmlBefore = secondImageBefore?.outerHTML || "";
      devAssert(profilesBefore.length === 2 && app.state.player?.profile_image_id === "existing-profile-1" && !!firstCardBefore && !!firstImageBefore && !!secondCardBefore && !!secondImageBefore, "existing profile picker starts with two stable generated images", {
        count: profilesBefore.length,
        activeId: app.state.player?.profile_image_id
      });
      $("generateProfileImageBtn")?.click();
      await devWaitFor(() => profileImagesForEntity(app.state.player || {}).length === 3, 5000, "new manual profile image record to be added");
      const firstCardAfter = document.querySelector('[data-profile-image-id="existing-profile-1"]');
      const firstImageAfter = firstCardAfter?.querySelector("img");
      const secondCardAfter = document.querySelector('[data-profile-image-id="existing-profile-2"]');
      const secondImageAfter = secondCardAfter?.querySelector("img");
      devAssert(firstCardAfter === firstCardBefore && firstImageAfter === firstImageBefore && secondCardAfter === secondCardBefore && secondImageAfter === secondImageBefore && firstImageAfter?.outerHTML === firstOuterHtmlBefore && secondImageAfter?.outerHTML === secondOuterHtmlBefore, "generating a new portrait preserves existing profile card image DOM instead of reloading it", {
        sameCard: firstCardAfter === firstCardBefore,
        sameImage: firstImageAfter === firstImageBefore,
        sameSecondCard: secondCardAfter === secondCardBefore,
        sameSecondImage: secondImageAfter === secondImageBefore
      });
      await devWaitFor(() => profileImagesForEntity(app.state.player || {}).some(image => image.id !== "existing-profile-1" && image.id !== "existing-profile-2" && devLooksLikeRealImageHtml(image.html)), 10000, "new profile image to finish without disturbing existing portraits");
      const profilesAfter = profileImagesForEntity(app.state.player || {});
      const newProfiles = profilesAfter.filter(image => image.id !== "existing-profile-1" && image.id !== "existing-profile-2");
      const firstStoreAfter = profileStoreImageById("existing-profile-1");
      const secondStoreAfter = profileStoreImageById("existing-profile-2");
      devAssert(profilesAfter.length === 3 && newProfiles.length === 1 && app.state.player?.profile_image_id === newProfiles[0]?.id && !!firstStoreAfter && !!secondStoreAfter && firstStoreAfter.html === storeBefore.get("existing-profile-1")?.html && secondStoreAfter.html === storeBefore.get("existing-profile-2")?.html && firstStoreAfter.prompt === "Existing profile one" && secondStoreAfter.prompt === "Existing profile two" && secondStoreAfter.favorite === true && !firstStoreAfter.pending && !secondStoreAfter.pending && !firstStoreAfter.error && !secondStoreAfter.error, "manual profile generation creates one new active image without overwriting, deleting, or mutating existing profile images", {
        profileIds: profilesAfter.map(image => image.id),
        activeId: app.state.player?.profile_image_id,
        newIds: newProfiles.map(image => image.id),
        firstStoreAfter,
        secondStoreAfter
      });
      addMessage("system", "Profile image refresh preserve smoke test passed.");
      showNotice("Live Test Passed", "Profile image refresh preserve smoke test passed.");
      scheduleActiveGameSave();
      render();
      devTestLog("Scenario complete: profile-image-refresh-preserve-smoke");
    } finally {
      if (typeof previousTextToImagePlugin === "undefined") delete globalThis.textToImagePlugin;else globalThis.textToImagePlugin = previousTextToImagePlugin;
    }
  }
  async function devRunCharacterCardExportLayoutSmokeTest() {
    devTestLog("Scenario start: character-card-export-layout-smoke");
    devResetForLiveTest("character-card-export-layout-smoke");
    devResetPreferenceSettingsForSmoke({});
    app.settings.reducedUi = false;
    app.state = repairAiGeneratedState({
      ...clone(defaultState),
      meta: {
        ...clone(defaultState.meta || {}),
        setup_complete: true
      },
      characters: {
        "Layout Ally": {
          ...blankCharacterTemplate("Layout Ally"),
          name: "Layout Ally",
          age: 28,
          gender: "female",
          role: "layout tester with a deliberately long role label",
          outfits: [{
            id: "layout-outfit",
            name: "Layout outfit",
            clothing: {
              shirt: "linen shirt"
            }
          }],
          active_outfit_id: "layout-outfit"
        }
      },
      scene: {
        ...clone(defaultState.scene || {}),
        party_members_present: ["Player", "Layout Ally"],
        image_characters: ["Player", "Layout Ally"],
        npcs_present: ["New NPC"]
      },
      npc_directory: {
        locations: {
          "layout-town": {
            label: "layout town",
            characters: {
              "New NPC": {
                name: "New NPC",
                age: 30,
                gender: "male",
                role: "tester",
                relationship: "neutral",
                inspected: true,
                full_character: {
                  ...blankCharacterTemplate("New NPC"),
                  name: "New NPC",
                  age: 30,
                  gender: "male",
                  role: "tester"
                }
              }
            }
          }
        }
      }
    });
    const characterHtml = partyCharacterCardHtml("Layout Ally", app.state.characters["Layout Ally"], {
      exportName: "Layout Ally",
      searchText: "Layout Ally"
    });
    const npcHtml = npcDirectoryCardHtml("New NPC", app.state.npc_directory.locations["layout-town"].characters["New NPC"], "layout-town");
    const host = document.createElement("div");
    host.innerHTML = `${characterHtml}${npcHtml}`;
    const characterWrap = host.querySelector("[data-character-directory-card]");
    const npcWrap = host.querySelector("[data-npc-directory-row]");
    devAssert(characterWrap && npcWrap && !host.querySelector(".card-export-check") && !host.querySelector("[data-character-export-name]") && !host.querySelector("[data-npc-export-key]"), "in-game character/NPC cards do not show export checkbox controls", {
      characterHtml: characterWrap?.outerHTML,
      npcHtml: npcWrap?.outerHTML
    });
    devAssert(!host.querySelector(".clothing-controls") && !host.querySelector("[data-character-action='top-off']") && !host.querySelector("[data-character-action='bottom-off']") && !host.querySelector("[data-character-action='all-off']") && !host.querySelector("[data-character-action='dress']"), "Direct character/NPC cards hide manual clothing controls", {
      html: host.innerHTML
    });
    openCharactersModal();
    devAssert($("modalBox")?.querySelector?.(".modal-chrome-title")?.textContent?.trim() === "Characters" && !$("modalBox")?.querySelector?.("[data-character-name='Player']") && !!$("modalBox")?.querySelector?.("[data-character-name='Layout Ally']"), "Characters modal uses the chrome title and does not show the player card", {
      text: $("modalBox")?.textContent || ""
    });
    const modalOutfitControls = $("modalBox")?.querySelector?.("[data-character-name='Layout Ally'] .outfit-controls");
    const modalOutfitSelect = modalOutfitControls?.querySelector?.("select");
    const modalOutfitSave = modalOutfitControls?.querySelector?.("[data-character-action='save-outfit']");
    const styleText = [...document.querySelectorAll("style")].map(style => style.textContent || "").join("\n");
    devAssert(modalOutfitControls && modalOutfitSelect && modalOutfitSave && /\.character-card\s+\.outfit-controls\s*\{[^}]*--outfit-control-height:\s*2\.5rem[^}]*flex-wrap:\s*nowrap[^}]*width:\s*100%/s.test(styleText) && /\.character-card\s+\.outfit-controls\s+select\s*\{[^}]*flex:\s*1 1 auto[^}]*min-width:\s*0[^}]*height:\s*var\(--outfit-control-height\)[^}]*min-height:\s*var\(--outfit-control-height\)/s.test(styleText) && /\.character-card\s+\.outfit-controls\s+\.icon-button\s*\{[^}]*width:\s*var\(--outfit-control-height\)[^}]*height:\s*var\(--outfit-control-height\)[^}]*flex:\s*0 0 var\(--outfit-control-height\)[^}]*aspect-ratio:\s*1\s*\/\s*1/s.test(styleText), "Characters modal outfit dropdown and save button stay on one row with matching heights", {
      hasControls: !!modalOutfitControls,
      hasSelect: !!modalOutfitSelect,
      hasSave: !!modalOutfitSave,
      rulePresent: /outfit-control-height/.test(styleText)
    });
    devAssert(!$("modalBox")?.querySelector?.(".clothing-controls") && !$("modalBox")?.querySelector?.("[data-character-action='top-off']") && !$("modalBox")?.querySelector?.("[data-character-action='bottom-off']") && !$("modalBox")?.querySelector?.("[data-character-action='all-off']") && !$("modalBox")?.querySelector?.("[data-character-action='dress']"), "Characters UI cards hide top off, bottoms off, all off, and all on controls", {
      text: $("modalBox")?.textContent || ""
    });
    closeModal();
    app.settings.leftPanelGroup = "characters";
    app.settings.leftPanelSections ||= {};
    app.settings.leftPanelSections["characters-party"] = true;
    app.settings.leftPanelSections["characters-npcs"] = true;
    renderLeftPanel();
    renderCharacters();
    const leftOutfitControls = document.querySelector("#characterList [data-character-name='Layout Ally'] .outfit-controls");
    const leftOutfitSelect = leftOutfitControls?.querySelector?.("select");
    const leftOutfitSave = leftOutfitControls?.querySelector?.("[data-character-action='save-outfit']");
    const leftRole = document.querySelector("#characterList [data-character-name='Layout Ally'] .character-meta");
    devAssert(leftOutfitControls && leftOutfitSelect && leftOutfitSave && /\.character-card\s+\.outfit-controls\s*\{[^}]*flex-wrap:\s*nowrap[^}]*width:\s*100%/s.test(styleText) && /\.character-card\s+\.outfit-controls\s+select\s*\{[^}]*flex:\s*1 1 auto[^}]*min-width:\s*0/s.test(styleText) && /\.character-card\s+\.outfit-controls\s+\.icon-button\s*\{[^}]*width:\s*var\(--outfit-control-height\)[^}]*height:\s*var\(--outfit-control-height\)[^}]*flex:\s*0 0 var\(--outfit-control-height\)[^}]*aspect-ratio:\s*1\s*\/\s*1/s.test(styleText) && (!leftRole || getComputedStyle(leftRole).whiteSpace === "nowrap"), "left column card outfit controls stay on one row and role stays on one line", {
      hasControls: !!leftOutfitControls,
      hasSelect: !!leftOutfitSelect,
      hasSave: !!leftOutfitSave,
      roleWhiteSpace: leftRole ? getComputedStyle(leftRole).whiteSpace : ""
    });
    devAssert(!document.querySelector("#characterList .clothing-controls") && !document.querySelector("#characterList [data-character-action='top-off']") && !document.querySelector("#characterList [data-character-action='bottom-off']") && !document.querySelector("#characterList [data-character-action='all-off']") && !document.querySelector("#characterList [data-character-action='dress']"), "Left-panel character cards hide top off, bottoms off, all off, and all on controls", {
      html: document.querySelector("#characterList")?.innerHTML || ""
    });
    devAssert(!document.querySelector("#npcSceneList .clothing-controls") && !document.querySelector("#npcSceneList [data-character-action='top-off']") && !document.querySelector("#npcSceneList [data-character-action='bottom-off']") && !document.querySelector("#npcSceneList [data-character-action='all-off']") && !document.querySelector("#npcSceneList [data-character-action='dress']"), "Left-panel NPC cards hide top off, bottoms off, all off, and all on controls", {
      html: document.querySelector("#npcSceneList")?.innerHTML || ""
    });
    devResetPreferenceSettingsForSmoke({});
    app.settings.reducedUi = false;
    app.state.meta ||= {};
    addMessage("system", "Character card export controls smoke test passed.");
    showNotice("Live Test Passed", "Character card export controls smoke test passed.");
    scheduleActiveGameSave();
    render();
    devTestLog("Scenario complete: character-card-export-layout-smoke");
  }
  async function devRunProfileCategoryUiTest() {
    const snapshot = devSettingsSnapshotForSmoke();
    try {
      devResetForLiveTest("profile-category-ui");
      openSettingsModal();
      devAssert(!document.querySelector("#profileName"), "settings have no profile controls");
      $("autoVoice").checked = !app.settings.autoVoice;
      $("autoVoice").dispatchEvent(new Event("change", {bubbles: true}));
      $("preferredCharacterGender").value = "female";
      $("preferredCharacterGender").dispatchEvent(new Event("change", {bubbles: true}));
      saveSettingsFromModal(false);
      await flushLargeSaves();
      const stored = (await app.library.listSettings())[SETTINGS_KEY];
      app.settings = hydrateRuntimeSettingsFromExactStoredSettings(stored);
      devAssert(app.settings.autoVoice === $("autoVoice").checked && preferredRuntimeCharacterGenders()[0] === "female", "preferences survive storage hydration without a profile");
      devAssert(!Object.hasOwn(stored, "activeUserProfileId"), "removed preferences are absent from durable settings");
      beginNewAdventureStorySelection();
      devAssert(!!document.querySelector("[data-library-home]") && !$("profileName"), "new adventure opens the library directly");
    } finally {
      await devRestoreSettingsSnapshotForSmoke(snapshot);
    }
  }
  async function devRunOnboardingCharacterSettingsUiTest() {
    const snapshot = devSettingsSnapshotForSmoke();
    try {
      devResetForLiveTest("onboarding-character-settings-ui");
      openSettingsModal();
      $("openBoldnessBtn").click();
      const choices = [...document.querySelectorAll("[data-boldness-choice]")];
      devAssert(choices.length === 10, "boldness settings show all ten choices");
      choices[0].click();
      await flushLargeSaves();
      const stored = (await app.library.listSettings())[SETTINGS_KEY];
      devAssert(stored.characterBoldnessOffset === -4, "boldness choice saves directly to normal settings");
      beginOnboardingWorldSetup();
      devAssert(app.onboardingDraft.step === 6 && !$("profileName"), "story setup has no profile steps");
    } finally {
      await devRestoreSettingsSnapshotForSmoke(snapshot);
    }
  }
  async function devRunStoryTemplateStartUiTest() {
    devTestLog("Scenario start: story-template-start-ui");
    devSmokeSuiteState().currentScenarioProgress = "Preparing story fixture";
    const saveSnapshot = devSaveLibrarySnapshotForSmoke();
    try {
      devResetForLiveTest("story-template-start-ui");
      devResetPreferenceSettingsForSmoke({});
      // SANITIZE KEEP (dev fixture): synthetic story-template state setup for tests.
      // SANITIZE TEST: Existing smoke-test setup; no extra smoke test is needed unless this fixture starts masking runtime behavior.
      const templateState = repairAiGeneratedState({
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true,
          story_source: {
            mode: "original",
            title: "Template Start Test"
          }
        },
        player: devCompleteSmokeGenderPresentation({
          ...clone(defaultState.player || {}),
          id: "smoke-template-start-player",
          name: "Template Tester",
          age: 23,
          gender: "male",
          role: "apprentice cartographer",
          personality_description: "Careful, curious, and ready to test a template start.",
          speech_style: "Measured, observant, and concise.",
          boldness: 5,
          romanceable: false,
          relationship_to_player: "new map-room acquaintance",
          trust: 5,
          attraction: 0,
          affection: 0,
          state_of_mind: "focused",
          physical_state: "healthy",
          pose: "standing beside the map table",
          starting_trust: 5,
          starting_attraction: 0,
          starting_affection: 0,
          profile_image_id: "template-player-profile-image",
          profile_images: [{
            id: "template-player-profile-image",
            source: "template default",
            prompt: "template tester profile image",
            male: true,
            html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" alt="Template profile image">`
          }]
        }, "Template Tester"),
        scene: {
          ...clone(defaultState.scene || {}),
          summary: "A quiet map room waits for the first move",
          objective: "Inspect the map table",
          party_members_present: [],
          image_characters: ["Player"],
          npcs_present: ["Map Mentor"],
          image_action: "standing beside a table covered in old maps"
        },
        characters: {},
        location: {
          ...clone(defaultState.location || {}),
          npc_location_id: "map-room",
          specific_place: "Map Room"
        },
        npc_directory: {
          locations: {
            "map-room": {
              label: "Map Room",
              characters: {
                "Map Mentor": {
                  name: "Map Mentor",
                  age: 34,
                  gender: "female",
                  role: "opening guide",
                  relationship: "the opening guide for the template",
                  note: "Opening NPC present in the first scene. Not a party member.",
                  inspected: true,
                  full_character: devCompleteSmokeGenderPresentation({
                    ...blankCharacterTemplate("Map Mentor"),
                    id: "map-mentor",
                    name: "Map Mentor",
                    age: 34,
                    gender: "female",
                    role: "opening guide",
                    speech_style: "Patient, practical, and direct.",
                    boldness: 5,
                    romanceable: false,
                    relationship_to_player: "opening guide",
                    trust: 5,
                    attraction: 0,
                    affection: 0,
                    state_of_mind: "patient",
                    physical_state: "healthy",
                    pose: "standing beside the map table"
                  }, "Map Mentor")
                }
              }
            }
          }
        },
        objectives: {
          active_id: "template-start",
          focus_id: "template-start",
          items: [{
            id: "template-start",
            title: "Inspect the Map Table",
            type: "story",
            summary: "Begin from a reusable template.",
            while_active_guidance: "Keep the opening focused on the map table until the player inspects it.",
            completion_control: "player",
            completion_criteria: "Return yes when the player inspects the marked route on the map table.",
            completion_requirements: [],
            next_objectives: [{
              id: "marked-route-ending",
              completion_instruction: "Conclude the marked route test.",
              rewards: [],
              ending_type: "freeplay",
              ending_message: "The marked route is understood and the player may continue freely."
            }]
          }]
        }
      });
      delete templateState.players;
      templateState.player.outfits = [{
        id: "template-player-outfit",
        name: "Template Player Outfit",
        clothing: {
          shirt: "plain cartographer shirt",
          pants: "plain cartographer trousers",
          feet: "plain cartographer boots"
        }
      }];
      templateState.player.active_outfit_id = "template-player-outfit";
      templateState.player.boldness = 5;
      Object.assign(templateState.player, {
        romanceable: false,
        relationship_to_player: "new map-room acquaintance",
        trust: 5,
        attraction: 0,
        affection: 0,
        default_seed: 0
      });
      const templateMentor = templateState.npc_directory.locations["map-room"].characters["Map Mentor"].full_character;
      templateMentor.outfits = [{
        id: "template-mentor-outfit",
        name: "Template Mentor Outfit",
        clothing: {
          shirt: "plain mentor shirt",
          pants: "plain mentor trousers",
          feet: "plain mentor boots"
        }
      }];
      templateMentor.active_outfit_id = "template-mentor-outfit";
      Object.assign(templateMentor, {
        romanceable: false,
        relationship_to_player: "opening guide",
        trust: 5,
        attraction: 0,
        affection: 0,
        default_seed: 0
      });
      devUpsertStoryTemplatesForSmoke([devSmokeStoryRecord({
        id: "live-template-start-test",
        title: "Template Start Test",
        description: "A small reusable template for start-flow testing.",
        genres: ["fantasy"],
        player: templateState.player,
        npc_directory: templateState.npc_directory,
        npc_location_id: "map-room",
        location: templateState.location,
        npcs_present: ["Map Mentor"],
        image_characters: [],
        scene_summary: templateState.scene.summary,
        image_action: templateState.scene.image_action,
        objectives: templateState.objectives.items,
        active_id: "template-start",
        opening_text: 'The map room is quiet. (|[character:map-mentor]|) "The red route is the one that matters."'
      })]);
      scheduleActiveGameSave();
      const startSmokePluginOverrides = globalThis.__emberAdventuresPluginOverrides ||= {};
      const hadStartSmokeImageOverride = Object.prototype.hasOwnProperty.call(startSmokePluginOverrides, "textToImagePlugin");
      const previousStartSmokeImageOverride = startSmokePluginOverrides.textToImagePlugin;
      startSmokePluginOverrides.textToImagePlugin = () => ({
        onFinishPromise: Promise.resolve({
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
        })
      });
      devResetPreferenceSettingsForSmoke({});
      const originalShowConfirm = showConfirm;
      const startPrompts = [];
      try {
        showConfirm = async (title, message, options) => {
          startPrompts.push({
            title,
            message,
            options
          });
          return false;
        };
        devSmokeSuiteState().currentScenarioProgress = "Starting story";
        await startStoryTemplate("live-template-start-test");
        devAcceptPlayerInputHelpIfShown();
        await devWaitFor(() => (app.images || []).some(image => image.reason === "opening scene"), 2000, "new story opening image request to be created");
        const newStoryThread = $("thread");
        devAssert(!!newStoryThread && newStoryThread.scrollTop === 0, "new story starts the chat at the top after opening image generation begins", {
          scrollTop: newStoryThread?.scrollTop,
          scrollHeight: newStoryThread?.scrollHeight,
          clientHeight: newStoryThread?.clientHeight
        });
        const startedMentor = getNpcEntryFromState(app.state, "Map Mentor")?.full_character;
        devAssert(Object.values(app.state.player?.clothing || {}).some(value => !!clothingItemText(value)) && Object.values(startedMentor?.clothing || {}).some(value => !!clothingItemText(value)), "story start copies selected outfits into runtime clothing for the player and opening NPC", {
          playerClothing: app.state.player?.clothing,
          npcClothing: startedMentor?.clothing
        });
        devAssert(app.state?.meta?.story_source?.title === "Template Start Test", "story start retains the selected template identity");
      } finally {
        showConfirm = originalShowConfirm;
        if (hadStartSmokeImageOverride) startSmokePluginOverrides.textToImagePlugin = previousStartSmokeImageOverride;else delete startSmokePluginOverrides.textToImagePlugin;
      }
      devResetPreferenceSettingsForSmoke({});
      const originalSpeakTextForOpeningReuse = speakText;
      const openingSpeakCalls = [];
      try {
        app.settings.autoVoice = true;
        speakText = (text, slotOrVoiceName = "Narrator", opts = {}) => {
          openingSpeakCalls.push({
            text,
            slotOrVoiceName,
            opts: clone(opts)
          });
          if (opts?.messageId != null) {
            app.activeVoiceMessageId = opts.messageId;
            app.activeVoiceStartedAt = Date.now();
            app.autoVoiceStartedMessageIds.add(String(opts.messageId));
          }
        };
        devSmokeSuiteState().currentScenarioProgress = "Starting voice-cancel story";
        await startStoryTemplate("live-template-start-test");
        await devWaitFor(() => $("modal")?.classList?.contains("open") && /How to Play/i.test($("modalBox")?.textContent || ""), 12000, "first start writing-help modal before cancel/restart voice regression");
        const firstOpeningMessage = (app.messages || []).find(message => message.role === "assistant");
        devAcceptPlayerInputHelpIfShown();
        devAssert(firstOpeningMessage && openingSpeakCalls.some(call => String(call.opts?.messageId) === String(firstOpeningMessage.id)), "first Start Playing begins reading the story-template opening message", {
          firstOpeningMessage,
          openingSpeakCalls
        });
        stopReadingMessage(false);
        devAssert(app.stoppedVoiceMessageIds.has(String(firstOpeningMessage.id)), "canceling the first opening read records that message id as stopped", {
          firstOpeningId: firstOpeningMessage.id,
          stopped: [...(app.stoppedVoiceMessageIds || [])]
        });
        const callsAfterCancel = openingSpeakCalls.length;
        devSmokeSuiteState().currentScenarioProgress = "Restarting voice story";
        await startStoryTemplate("live-template-start-test");
        await devWaitFor(() => $("modal")?.classList?.contains("open") && /How to Play/i.test($("modalBox")?.textContent || ""), 12000, "second start writing-help modal after canceling first opening read");
        const secondOpeningMessage = (app.messages || []).find(message => message.role === "assistant");
        devAcceptPlayerInputHelpIfShown();
        const secondReadCall = openingSpeakCalls.slice(callsAfterCancel).find(call => String(call.opts?.messageId) === String(secondOpeningMessage?.id));
        devAssert(secondOpeningMessage && String(secondOpeningMessage.id) === String(firstOpeningMessage.id) && !!secondReadCall, "starting the same template again after canceling the first opening read starts reading the new opening", {
          firstOpeningId: firstOpeningMessage?.id,
          secondOpeningId: secondOpeningMessage?.id,
          callsAfterCancel,
          openingSpeakCalls,
          stopped: [...(app.stoppedVoiceMessageIds || [])]
        });
      } finally {
        speakText = originalSpeakTextForOpeningReuse;
        stopReadingMessage(false);
        clearVoiceMessageRuntimeState();
        if ($("modal")?.classList?.contains("open")) closeModal();
      }
      devResetPreferenceSettingsForSmoke({});
      openStoryTemplateLibrary({
        skipBack: true
      });
      devAssert(!!$("modalBox")?.querySelector?.("[data-library-home][data-library-type='story']"), "story library opens for template start test");
      devAssert(/Template Start Test/i.test($("modalBox")?.textContent || ""), "story library shows the test template");
      const templateCard = [...$("modalBox").querySelectorAll("[data-story-library-card]")].find(card => /Template Start Test/i.test(card.textContent || ""));
      devAssert(!!templateCard, "story template has visible library card");
      templateCard.click();
      await devWaitFor(() => !!document.querySelector("[data-story-library-detail]"), 2000, "story template detail panel to open");
      const startButton = [...(document.querySelector("[data-story-library-detail]")?.querySelectorAll("button") || [])].find(button => /Start/i.test(button.textContent || ""));
      devAssert(!!startButton, "story template has visible Start button");
      app.settings.playerInputHelpSeen = false;
      app.pendingPlayerInputHelpReadMessageId = "";
      startButton.click();
      await devWaitFor(() => app.state?.meta?.story_source?.title === "Template Start Test", 8000, "story template state to become active");
      devAssert(app.state?.meta?.setup_complete === true, "started template has setup_complete state");
      if (activeSaveId() !== app.state?.meta?.save_id || app.storyDefinition?.revisionId !== app.state?.meta?.definition_revision_id) devTestLog("Story start ownership mismatch", {
        activeSaveId: activeSaveId(),
        stateSaveId: app.state?.meta?.save_id || "",
        definitionRevisionId: app.storyDefinition?.revisionId || "",
        stateDefinitionRevisionId: app.state?.meta?.definition_revision_id || ""
      });
      devAssert(activeSaveId() === app.state?.meta?.save_id && app.storyDefinition?.revisionId === app.state?.meta?.definition_revision_id, "story start atomically installs matching save ownership and immutable definition", {
        activeSaveId: activeSaveId(),
        stateSaveId: app.state?.meta?.save_id || "",
        definitionRevisionId: app.storyDefinition?.revisionId || "",
        stateDefinitionRevisionId: app.state?.meta?.definition_revision_id || ""
      });
      devAssert(app.currentGameSaveId, "starting story template creates or selects a game save");
      const startedStorySaveRecord = findSaveIndexRecord(app.currentGameSaveId || activeSaveId());
      const expectedTitleImageUrl = storyTemplateById("live-template-start-test")?.title_card_image?.url || "";
      devTestLog("story start title image projection", {
        expectedTitleImageUrl,
        titleImageHtml: startedStorySaveRecord?.titleImageHtml || "",
        stateTitleImageHtml: app.state?.meta?.title_image_html || ""
      });
      devAssert(/img/i.test(startedStorySaveRecord?.titleImageHtml || "") && !!expectedTitleImageUrl && (startedStorySaveRecord?.titleImageHtml || "").includes(expectedTitleImageUrl), "starting a normal story uses the story title-card image as the saved-game card image", {
        save: startedStorySaveRecord,
        meta: app.state?.meta,
        expectedTitleImageUrl
      });
      devAssert(!app.state.characters?.["Map Mentor"] && !!getNpcEntry("Map Mentor") && (app.state.scene?.npcs_present || []).includes("Map Mentor"), "opening non-party NPC stays in npc_directory while remaining active in scene", {
        characters: app.state.characters,
        npc: getNpcEntry("Map Mentor"),
        active: app.state.scene?.npcs_present
      });
      const profileAttemptedOrActive = name => {
        const entity = profileEntity(name);
        return !!activeProfileImage(entity) || profileImagesForEntity(entity || {}).length > 0 || (app.profileImageQueue || []).some(item => item?.name === name) || app.profileImageQueued?.has?.(name) || app.profileImageGenerating?.has?.(name);
      };
      await devWaitFor(() => profileAttemptedOrActive("Map Mentor"), 5000, "starting-character profile image background resolution");
      await devWaitFor(() => profileAttemptedOrActive("Player"), 5000, "player profile image background resolution");
      const mapMentorProfileImage = activeProfileImage(profileEntity("Map Mentor"));
      const playerProfileImage = activeProfileImage(profileEntity("Player"));
      devAssert(profileAttemptedOrActive("Map Mentor"), "story start queues or generates missing active starting-character profile images", {
        mapMentorProfileImage,
        diagnostics: devProfileImageDiagnostics("Map Mentor"),
        images: app.images,
        profileQueue: app.profileImageQueue,
        profileQueued: [...app.profileImageQueued],
        profileGenerating: [...app.profileImageGenerating]
      });
      devAssert(profileAttemptedOrActive("Player"), "story start queues or generates missing player profile image", {
        playerProfileImage,
        diagnostics: devProfileImageDiagnostics("Player"),
        profileQueue: app.profileImageQueue,
        profileQueued: [...app.profileImageQueued],
        profileGenerating: [...app.profileImageGenerating]
      });
      devAssert((app.messages || []).some(message => message.role === "assistant"), "started story template loads opening assistant message", {
        messages: app.messages.length
      });
      const openingMessage = (app.messages || []).find(message => message.role === "assistant");
      devAssert(openingMessage && !/\(Map Mentor\)/i.test(openingMessage.text || "") && !/Map Mentor/i.test(openingMessage.text || "") && /\(Map Mentor\)/i.test(openingMessage.voiceText || "") && (openingMessage.voiceSpeakers || []).includes("Map Mentor"), "template opening single-speaker voice tags stay hidden visibly and remain preserved for reading", openingMessage);
      await devWaitFor(() => (app.images || []).length > 0, 8000, "starting story template to queue an opening scene image record");
      devAssert((app.images || []).filter(image => /opening scene/i.test(image?.reason || "")).length === 1, "starting story template queues exactly one opening scene image record", {
        images: app.images
      });
      devAssert((app.images || []).some(image => /opening scene/i.test(image?.reason || "") && ((image.targets || []).includes("Player") || (image.targets || []).includes("Template Tester")) && !(image.targets || []).includes("Map Mentor")), "story template opening image follows scene.image_characters and targets the player only", {
        images: app.images,
        imageCharacters: app.state.scene?.image_characters
      });
      const ownershipMismatches = saveOwnershipMismatchDetails(activeSaveId());
      devAssert(ownershipMismatches.length === 0, "starting story template stamps save ownership on messages, images, and embedded profile images", {
        ownershipMismatches
      });
      let finalInputHelpShown = false;
      try {
        await devWaitFor(() => $("modal")?.classList?.contains("open") && /How to Play/i.test($("modalBox")?.textContent || ""), 1200, "first-input help modal to appear after starting template");
        finalInputHelpShown = true;
      } catch (err) {
        finalInputHelpShown = false;
      }
      devAssert(app.state?.meta?.story_source?.title === "Template Start Test" && app.state?.meta?.setup_complete === true && app.mainMenuOpen === false && !app.onboardingDraft, "story template game is active before optional first-input help is accepted", {
        story: app.state?.meta?.story_source,
        setupComplete: app.state?.meta?.setup_complete,
        mainMenuOpen: app.mainMenuOpen,
        onboardingDraft: !!app.onboardingDraft,
        finalInputHelpShown,
        playerInputHelpSeen: app.settings?.playerInputHelpSeen
      });
      if (finalInputHelpShown) devAcceptPlayerInputHelpIfShown();
      devAssert(!$("modal")?.classList?.contains("open") || !/How to Play/i.test($("modalBox")?.textContent || ""), "story template first-input help modal is accepted before play continues");
      addMessage("system", "Story template start UI smoke test passed.");
      showNotice("Live Test Passed", "Story template start UI smoke test passed.");
      devTestLog("Scenario complete: story-template-start-ui", {
        currentGameSaveId: app.currentGameSaveId,
        messages: app.messages.length,
        images: app.images.length
      });
    } finally {
      await devRestoreSaveLibrarySnapshotForSmoke(saveSnapshot);
    }
  }
  
