function dismissObjectiveSuggestion(suggestionId) {
    app.state.objectives ||= {
      suggestions: []
    };
    app.state.objectives.suggestions = (app.state.objectives.suggestions || []).filter(item => String(item.id) !== String(suggestionId));
    scheduleActiveGameSave();
    openObjectivePickerModal();
    render();
  }
  async function applyPlayerKillRewards(npc, context = {}) {
    const fallback = {
      items: [],
      reason: ""
    };
    try {
      if (npc?.kill_reward_applied) return {
        items: [],
        reason: "Kill rewards were already applied."
      };
      setTurnStage("working", "Deciding loot...");
      const raw = await aiText(playerKillRewardInstruction(npc, context), {
        startWith: "{",
        hideStartWith: false,
        label: "npc loot rewards",
        promptEditorReplay: {
          npc: clone(npc || {}),
          context: clone(context || {})
        }
      });
      const data = parseJsonObject(raw) || fallback;
      const items = (Array.isArray(data.items) ? data.items : []).map(item => typeof item === "string" ? item : textSlot(item?.name || item?.item || item?.title, "")).map(item => item.trim()).filter(Boolean).slice(0, 8);
      app.state.player ||= {};
      app.state.player.inventory = [...new Set([...(app.state.player.inventory || []), ...items])];
      if (items.length) {
        app.state.recent_changes = [`${context.name || npc?.name || "NPC"} loot: ${items.join(", ")}.`, ...(app.state.recent_changes || [])].slice(0, 8);
      }
      if (npc) npc.kill_reward_applied = true;
      return {
        items,
        reason: textSlot(data.reason, "")
      };
    } catch (err) {
      log("NPC loot rewards failed", err.message || err, {
        type: "state",
        level: "error"
      });
      return fallback;
    } finally {
      if (app.turnStage !== "error") setTurnStage("idle", "Ready");
    }
  }
  async function applyPendingPlayerKillRewards(beforeState, afterState, source = "state") {
    const beforeEntries = new Map(npcRewardIdentityList(beforeState).map(entry => [entry.id, entry]));
    const pending = [];
    for (const entry of npcRewardIdentityList(afterState)) {
      if (!entry.npc || entry.rewarded) continue;
      const before = beforeEntries.get(entry.id);
      const deathChanged = !npcIsDead(before?.npc || {}) && npcIsDead(entry.npc);
      const playerCaused = entry.killedByPlayer && explicitPlayerCausedDeathEvidence({
        killedBy: entry.npc.killed_by,
        state: afterState
      });
      troubleshootingLog("npc kill reward validation", {
        source,
        name: entry.name,
        deathChanged,
        playerCaused,
        rewarded: entry.rewarded,
        before: npcDeathTraceFields(before?.npc || {}),
        after: npcDeathTraceFields(entry.npc)
      });
      if (deathChanged && playerCaused) pending.push(entry);
    }
    for (const entry of pending) {
      const reward = await applyPlayerKillRewards(entry.npc, {
        name: entry.name,
        locationLabel: entry.locationLabel
      });
      addGameMessage(playerKillGameMessage(entry.name, reward), "Game");
    }
  }
  function npcRewardIdentityList(state) {
    const out = [];
    for (const [locationLabel, location] of Object.entries(state?.npc_directory?.locations || {})) {
      for (const [key, npc] of Object.entries(location?.characters || {})) {
        if (!npc || typeof npc !== "object") continue;
        const name = npc.name || key;
        const id = `${normalizeNameForMatch(locationLabel)}:${normalizeNameForMatch(name)}`;
        out.push({
          id,
          key,
          name,
          npc,
          locationLabel,
          killedByPlayer: npcIsDead(npc) && !!npc.killed_by_player && explicitPlayerCausedDeathEvidence({
            killedBy: npc.killed_by,
            state
          }),
          rewarded: !!npc.kill_reward_applied
        });
      }
    }
    return out;
  }
  function playerKillRewardInstruction(npc, context = {}) {
    const compactNpc = {
      name: context.name || npc?.name || "",
      gender: npc?.gender || "",
      age: npc?.age || "",
      role: npc?.role || "",
      relationship: npc?.relationship || "",
      note: npc?.note || "",
      inspected: !!npc?.inspected,
      full_character: npc?.full_character ? {
        role: npc.full_character.role,
        inventory: npc.full_character.inventory || [],
        held_items: npc.full_character.held_items || {},
        clothing: npc.full_character.clothing || {},
        ...promptKnownFactFields(npc.full_character, 4)
      } : null
    };
    return `You are deciding deterministic loot after the player killed a non-party NPC.
Return ONLY raw valid JSON. First character must be { and last character must be }. No markdown, no code fence, no prose:
{"items":[],"reason":""}

Rules:
- The player killed this NPC.
- Return only loot items and a short reason. Do not include any other reward fields.
- Award only items the NPC plausibly carried or dropped and that matter enough to track. Keep item names short.
- Do not award body parts, gore, joke items, or huge loot piles.
- If there should be no loot, return an empty items array.

NPC:
${compactJson(compactNpc)}

CONTEXT:
${compactJson({
      player: {
        name: app.state.player?.name,
        inventory: app.state.player?.inventory || []
      },
      location: app.state.location,
      scene: app.state.scene,
      current_objective: currentObjectiveTarget(),
      recent_changes: app.state.recent_changes || []
    })}

JSON:`;
  }
  function playerKillGameMessage(name, reward = {}) {
    const parts = [`${name} was killed by ${app.state.player?.name || "the player"}.`];
    if (reward?.items?.length) parts.push(`Loot gained: ${reward.items.join(", ")}.`);
    if (!reward?.items?.length) parts.push("No tracked loot gained.");
    return parts.join(" ");
  }
  function openNpcDirectoryModal(selectedLocationId = currentNpcLocationId()) {
    const directory = app.state.npc_directory || {
      locations: {}
    };
    const locations = Object.keys(directory.locations || {});
    const current = locations.includes(selectedLocationId) ? selectedLocationId : locations[0] || currentNpcLocationId();
    const location = getNpcLocation(current) || {
      label: textSlot(app.state.location?.specific_place, "Current location"),
      characters: {}
    };
    const directoryNames = new Set(Object.entries(location.characters || {}).flatMap(([key, npc]) => [key, npc?.name]).filter(Boolean));
    const directoryRows = Object.entries(location.characters || {}).map(([key, npc]) => npcDirectoryCardHtml(key, npc, current)).join("");
    const sceneOnlyRows = (app.state.scene?.npcs_present || []).filter(name => name && !directoryNames.has(name)).map(name => `
                    <div class="selectable-card-wrap" data-npc-directory-row data-search="${escapeHtml(`${name} scene-only nearby`)}">
                        <div class="character-card active">
                            <div class="character-name"><span>${escapeHtml(name)}</span><span>scene-only</span></div>
                            <div class="character-meta">Nearby scene entry</div>
                            <div class="icon-row">
                                <button class="icon-button warn" title="Remove from scene" onclick="EmberAdventures.removeNpcFromScene(${htmlJsArg(name)})">X</button>
                                <button class="icon-button" title="Edit NPC state" onclick="EmberAdventures.editNpc(${htmlJsArg(name)}, ${htmlJsArg(current)})">&#9998;</button>
                            </div>
                        </div>
                    </div>
                `).join("");
    const rows = directoryRows || `<p class="hint">No known non-party characters here yet.</p>`;
    const sceneOnlyBlock = sceneOnlyRows ? `<div class="hint" style="margin-top:.75rem"><b>Scene-only entries</b></div>${sceneOnlyRows}` : "";
    const options = locations.map(id => `<option value="${escapeHtml(id)}" ${id === current ? "selected" : ""}>${escapeHtml(directory.locations?.[id]?.label || id)}</option>`).join("");
    openModal(`
                <h2>Known Characters</h2>
                <label>Town or city
                    <select id="npcLocationSelect">${options}</select>
                </label>
                <label>Search known characters
                    <input id="npcDirectorySearch" type="search" placeholder="Name, job, note, source..." oninput="EmberAdventures.filterNpcDirectoryModal(this.value)">
                </label>
                <p class="hint" id="npcDirectorySearchCount" style="margin:.35rem 0 .75rem"></p>
                <div class="stack" style="margin-top: .75rem">
                    <div class="character-card-grid">${rows}${sceneOnlyBlock}</div>
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button onclick="EmberAdventures.openFindCharacterModal()">Find Character</button>
                    <button class="blue" onclick="EmberAdventures.openCastAddFromLibraryModal('npc')">Add from Library</button>
                </div>
            `);
    $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
    $("npcLocationSelect").onchange = () => openNpcDirectoryModal($("npcLocationSelect").value);
    filterNpcDirectoryModal("");
  }
  function npcDirectoryCardHtml(key, npc, locationId = "") {
    const full = npc?.full_character || {};
    const searchText = [key, npc?.name, npc?.gender, npc?.age, npc?.role, npc?.relationship, npc?.note, npc?.current_appearance, npcIsDead(npc) ? "dead" : "alive", entitySourceSlot(npc?.source ?? full.source), entityCreatorSlot(npc?.creator ?? full.creator), entityCreationToolSlot(npc?.creation_tool ?? full.creation_tool), full.role, full.personality_description, full.relationship_to_player].filter(Boolean).join(" ");
    const body = npc?.inspected && npc.full_character ? npcCardHtml(key, npc, {
      locationId,
      presenceMode: "toggle"
    }) : partialNpcCardHtml(key, npc, locationId);
    return `<div class="selectable-card-wrap" data-npc-directory-row data-search="${escapeHtml(searchText)}">
                ${body}
            </div>`;
  }
  function partialNpcCardHtml(key, npc = {}, locationId = "", options = {}) {
    const name = npc.name || key;
    const dead = npcIsDead(npc);
    const profileEntity = npc.full_character || npc;
    const profile = Object.hasOwn(profileEntity, "profile_images") ? activeProfileImage(profileEntity) : null;
    const characterId = profileEntityCharacterId(profileEntity);
    const profilePending = profileImageRequestIsPending(name, profileEntity);
    const profileHtml = profile ? profileImageInnerHtml(profile) : profilePending ? imageLoadingHtml("") : "";
    const targetName = resolveEntityName(key, app.state, key);
    const isNearby = [...(app.state.scene?.npcs_present || []), ...(app.state.scene?.party_members_present || [])].includes(targetName);
    const gender = npcGenderLabel(npc);
    const isPartyCharacter = !!app.state.characters?.[name] || !!app.state.characters?.[key];
    const sceneCard = !!options.sceneCard;
    const isImageTarget = (app.state.scene?.image_characters || []).includes(targetName);
    const presenceMode = options.presenceMode || "toggle";
    const presenceButton = presenceMode === "remove" ? `<button class="icon-button warn" title="Remove from scene" onclick="EmberAdventures.removeNpcFromScene(${htmlJsArg(key)})">X</button>` : `<button class="icon-button ${isNearby ? "party-on" : "party-off"}" title="${isNearby ? "Remove from scene" : "Add to scene"}" onclick="EmberAdventures.toggleNpcScenePresence(${htmlJsArg(key)})">&#128101;</button>`;
    return `
                <div class="character-card ${isNearby ? "active" : ""}" data-character-card data-character-name="${escapeHtml(name)}" ${characterId ? `data-character-id="${escapeHtml(characterId)}"` : ""}>
                    <div class="character-name">
                        <span>${escapeHtml(name)}</span>
                        <span>${dead ? "dead" : npc.age ? npc.age : "age ?"}</span>
                    </div>
                    <button class="profile-image-button" title="Open preview image picker" data-character-id="${escapeHtml(characterId)}" onclick="EmberAdventures.openProfileImageModal(${htmlJsArg(name)})">
                        ${profileHtml ? `<div class="profile-image-thumb-wrap" ${profile ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>` : `<div class="profile-image-placeholder static" aria-label="NPC not inspected"></div>`}
                    </button>
                    <div class="character-meta">${escapeHtml([gender, npc.role, npc.relationship].filter(Boolean).join(" / ") || "Known NPC")}</div>
                    ${""}
                    <div class="icon-row">
                        ${presenceButton}
                        ${dead ? `<button class="icon-button" title="Restore NPC" onclick="EmberAdventures.restoreNpc(${htmlJsArg(key)}, ${htmlJsArg(locationId)})">&#8635;</button>` : `<button class="icon-button" title="Inspect character" onclick="EmberAdventures.inspectNpc(${htmlJsArg(key)})">&#128269;</button>
                        <button class="icon-button ${isImageTarget ? "image-on" : "image-off"}" title="${isImageTarget ? "Remove from images" : isNearby ? "Include in images" : "Add to scene before including in images"}" data-character-action="image" data-character-name="${escapeHtml(targetName)}" ${!isNearby && !isImageTarget ? "disabled" : ""}>&#128247;</button>
                        ${sceneCard ? "" : `<button class="icon-button danger" title="Mark NPC dead" onclick="EmberAdventures.killNpc(${htmlJsArg(key)}, ${htmlJsArg(locationId)})">&#9760;</button>`}`}
                        <button class="icon-button" title="Edit NPC state" data-character-action="npc-edit" data-character-name="${escapeHtml(key)}" data-npc-location="${escapeHtml(locationId)}">&#9998;</button>
                        <button class="icon-button" title="NPC settings" data-character-action="settings" data-character-name="${escapeHtml(name)}">&#9881;</button>
                        ${sceneCard ? "" : `<button class="icon-button danger" title="Delete NPC permanently" onclick="EmberAdventures.deleteNpc(${htmlJsArg(key)}, ${htmlJsArg(locationId)})">&#128465;</button>`}
                    </div>
                </div>
            `;
  }
  function filterNpcDirectoryModal(query = "") {
    const tokens = searchTokens(query);
    const rows = [...document.querySelectorAll("[data-npc-directory-row]")];
    let visible = 0;
    for (const row of rows) {
      const show = matchesSearchTokens(row.dataset.search || "", tokens);
      row.style.display = show ? "" : "none";
      if (show) visible++;
    }
    const count = $("npcDirectorySearchCount");
    if (count) count.textContent = tokens.length ? `${visible} matching known character${visible === 1 ? "" : "s"}` : `${rows.length} known character${rows.length === 1 ? "" : "s"} in this location`;
  }
  function openFindCharacterModal() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    const location = getNpcLocation() || {
      label: textSlot(app.state.location?.specific_place, "Current location"),
      characters: {}
    };
    const options = Object.keys(location.characters || {}).map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    openModal(`
                <h2>Find Character</h2>
                <p class="hint">Look for a known character in ${escapeHtml(location.label)}. This uses local game-state rules and can fail.</p>
                <label>Character
                    <select id="findNpcName">${options}</select>
                </label>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" id="findNpcBtn">Find</button>
                    <button onclick="EmberAdventures.openCharactersModal()">Characters</button>
                </div>
            `);
    $("findNpcBtn").onclick = () => findNpc($("findNpcName").value);
  }
  function findNpc(name) {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    const npc = getNpcEntry(name);
    if (!npc) return;
    const chance = 0.82;
    const found = Math.random() <= chance;
    // Find is a player action, not a silent state tweak. Queue it as a
    // normal player turn so objectives and state catch-up treat it like
    // chat, while the directive carries the local find result.
    if (found) {
      ensureNpcEntry(name, npc);
      app.state.scene ||= {};
      app.state.scene.npcs_present = [...new Set([...(app.state.scene.npcs_present || []), name])];
      assertRuntimeSceneReferences(app.state);
      scheduleActiveGameSave();
    }
    const visibleText = found ? `I look for ${name} and find them nearby.` : `I look for ${name}, but cannot find them right now.`;
    closeModal();
    // Rule: Find is still a normal player-story action, but the local
    // search result should always be explicit in chat as a Game message
    // so success/failure is visible even before the narrator responds.
    addGameMessage(found ? `${name} was found nearby.` : `${name} could not be found right now.`, "Game");
    app.queue.push({
      text: visibleText,
      visibleText,
      skipUserStateCheck: false,
      commandOnly: false,
      source: "find",
      speaker: app.state.player?.name || "Player",
      autoRead: !!app.settings.autoReadPlayerMessages,
      directive: found ? `${name} has been found nearby. Continue naturally from the player finding ${name}.` : `${name} could not be found right now. Continue naturally from the failed attempt without forcing ${name} into the scene.`
    });
    render();
    if (!queueProcessingBlocked()) processQueue();
  }
  function objectiveIdFromTitle(title, fallback = "objective") {
    return String(title || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
  }
  function objectiveTitleFromStepText(text, fallback = "Objective") {
    const title = textSlot(text, fallback).replace(/[.?]+$/g, "").trim();
    return title || fallback;
  }
  function uniqueObjectiveId(base, usedIds, fallback = "objective") {
    const clean = objectiveIdFromTitle(base, fallback);
    let candidate = clean;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${clean}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }
  function repairAiObjectiveStepFields(objective = {}) {
    const repaired = clone(objective);
    delete repaired.steps;
    delete repaired.current_step_id;
    delete repaired.currentStepId;
    delete repaired.selected_step;
    delete repaired.selected_step_id;
    delete repaired.selectedStep;
    delete repaired.selectedStepId;
    return repaired;
  }
  function repairAiObjectiveExclusiveGroup(objective = {}) {
    return textSlot(objective.exclusive_group || objective.exclusiveGroup || objective.branch_group || objective.branchGroup, "");
  }
  function splitObjectivesIntoSingleStepItems(items = []) {
    const usedIds = new Set();
    const result = [];
    for (const objective of Array.isArray(items) ? items : []) {
      if (!isPlainObject(objective)) continue;
      const id = uniqueObjectiveId(objective.id || objective.title || objective.objective, usedIds, `objective-${result.length + 1}`);
      result.push(repairAiObjectiveStepFields({
        ...objective,
        id,
        requires: objectiveRequiredIds(objective),
        exclusive_group: repairAiObjectiveExclusiveGroup(objective),
        selectable: objectiveExplicitlySelectable(objective)
      }));
    }
    return result;
  }
  function extractObjectives(source, contextState = {}) {
    const input = isPlainObject(source) ? source : {};
    // Direct AI-generated state may return a keyed objective map. This
    // repair is not used for imported or stored story definitions.
    const sourceItems = Array.isArray(input.items) ? input.items : isPlainObject(input.items) ? Object.values(input.items) : Array.isArray(input.objectives) ? input.objectives : isPlainObject(input.objectives) ? Object.values(input.objectives) : [];
    const items = sourceItems.length ? sourceItems.filter(isPlainObject).map((objective, index) => {
      const title = textSlot(objective.title, "");
      const summary = textSlot(objective.summary || objective.objective, "");
      const completionControl = objectiveCompletionControl(objective);
      if (!title || !summary && completionControl !== "reward_only") return null;
      const id = textSlot(objective.id, objectiveIdFromTitle(title, `objective-${index + 1}`));
      return {
        id,
        title,
        type: textSlot(objective.type, "story"),
        status: textSlot(objective.status, "active"),
        summary,
        requires: objectiveRequiredIds(objective),
        exclusive_group: repairAiObjectiveExclusiveGroup(objective),
        selectable: objectiveExplicitlySelectable(objective),
        ...(typeof objective.available_now === "boolean" ? {
          available_now: objective.available_now
        } : {}),
        blocked_reason: textSlot(objective.blocked_reason, ""),
        locked_until_complete: objectiveLockedUntilComplete(objective),
        notes: stringListSlot(objective.notes, []),
        rewards: extractObjectiveRewards(objective.rewards),
        next_objectives: objectiveNextOptions(objective),
        route_control: objectiveRouteControl(objective),
        outcome_routes: objectiveOutcomeRoutes(objective),
        selected_outcome_id: textSlot(objective.selected_outcome_id || objective.selectedOutcomeId, ""),
        selected_outcome_message_id: textSlot(objective.selected_outcome_message_id || objective.selectedOutcomeMessageId, ""),
        choices: extractObjectiveChoices(objective.choices || objective.choice_options),
        completion_message: objectiveCompletionMessage(objective),
        completion_control: completionControl,
        completion_requirements: objectiveCompletionRequirements(objective),
        requirement_check_only: objective.requirement_check_only === true,
        evaluate_ai_on_activation: objectiveEvaluatesAiOnActivation(objective),
        completion_criteria: textSlot(objective.completion_criteria || objective.completionCriteria, ""),
        while_active_guidance: textSlot(objective.while_active_guidance, ""),
        completion_instruction: textSlot(objective.completion_instruction || objective.completionInstruction || objective.on_complete_instruction || objective.onCompleteInstruction, ""),
        ...(objectiveCompletionControl(objective) === "choice" ? {
          choice_response_mode: objectiveChoiceResponseMode(objective)
        } : {}),
        ...(objectiveUsesDialogueDelivery(objective) ? {
          dialogue_lines: objectiveDialogueLines(objective)
        } : {}),
        auto_completed_from_prereqs: objective.auto_completed_from_prereqs === true,
        travel_location_id: textSlot(objective.travel_location_id || objective.location_id, ""),
        travel_location_name: textSlot(objective.travel_location_name || objective.location_name, "")
      };
    }).filter(Boolean).map(repairAiObjectiveStepFields) : [];
    const singleStepItems = splitObjectivesIntoSingleStepItems(items);
    const objectiveContext = {
      ...contextState,
      objectives: {
        ...(contextState.objectives || {}),
        items: singleStepItems,
        exclusive_group_choices: repairAiObjectiveExclusiveChoices(input.exclusive_group_choices)
      }
    };
    const noCurrent = input.no_current === true;
    const active_id = noCurrent ? "" : textSlot(input.active_id, "") || singleStepItems.find(objective => !objectiveIsSide(objective) && objective.status === "active" && objectiveCanBeSelected(objective, objectiveContext))?.id || singleStepItems.find(objective => !objectiveIsSide(objective) && objectiveCanBeSelected(objective, objectiveContext))?.id || "";
    const focus_id = textSlot(input.focus_id, "");
    const activeObjective = singleStepItems.find(objective => String(objective.id) === active_id);
    const resolvedActiveId = noCurrent ? "" : activeObjective && objectiveCanBeSelected(activeObjective, objectiveContext) ? activeObjective.id : singleStepItems.find(objective => !objectiveIsSide(objective) && objectiveCanBeSelected(objective, objectiveContext) && objective.status === "active")?.id || singleStepItems.find(objective => !objectiveIsSide(objective) && objectiveCanBeSelected(objective, objectiveContext))?.id || "";
    if (!noCurrent) {
      for (const objective of singleStepItems) {
        if (objectiveIsSide(objective) || objectiveIsComplete(objective) || !objectiveCanBeSelected(objective, objectiveContext)) continue;
        if (String(objective.id) === String(resolvedActiveId)) {
          objective.status = "active";
        } else if (/^active$/i.test(String(objective.status || ""))) {
          objective.status = "queued";
        }
      }
    }
    const focusObjective = singleStepItems.find(objective => String(objective.id) === focus_id);
    return {
      active_id: resolvedActiveId,
      focus_id: !noCurrent && focusObjective && objectiveCanBeSelected(focusObjective, objectiveContext) ? focusObjective.id : "",
      no_current: noCurrent,
      items: singleStepItems,
      completion_message: textSlot(input.completion_message, ""),
      completed_main_message: textSlot(input.completed_main_message, ""),
      pending_completion_message: isPlainObject(input.pending_completion_message) ? clone(input.pending_completion_message) : null,
      pending_choice: isPlainObject(input.pending_choice) ? clone(input.pending_choice) : null,
      pending_reward_choices: Array.isArray(input.pending_reward_choices) ? input.pending_reward_choices.filter(isPlainObject) : [],
      progress_notes: isPlainObject(input.progress_notes) ? Object.fromEntries(Object.entries(input.progress_notes).map(([id, notes]) => [String(id), Array.isArray(notes) ? notes.map(note => String(note || "").replace(/\s+/g, " ").trim()).filter(Boolean) : []]).filter(([, notes]) => notes.length)) : {},
      exclusive_group_choices: repairAiObjectiveExclusiveChoices(input.exclusive_group_choices),
      suggestions: (Array.isArray(input.suggestions) ? input.suggestions : []).filter(isPlainObject).map((item, index) => ({
        id: textSlot(item.id, objectiveIdFromTitle(item.title || item.objective || item.reason, `suggestion-${index + 1}`)),
        title: textSlot(item.title || item.objective, ""),
        reason: textSlot(item.reason, ""),
        available_now: item.available_now !== false,
        status: textSlot(item.status, "suggested")
      })).filter(item => item.title)
    };
  }
  function mergeObjectivesForStatePatch(current, patch, contextState = {}) {
    const existing = extractObjectives(current, contextState);
    const incoming = extractObjectives(patch, contextState);
    const existingItems = existing.items || [];
    const byId = new Map(existingItems.map(objective => [objective.id, objective]));
    for (const objective of incoming.items || []) {
      const prior = byId.get(objective.id);
      if (!prior) {
        throw new Error(`Runtime state patches cannot define new objectives: ${objective.id}. ` + "Author the objective in the immutable story definition or create it through the generated-job system.");
      }
      byId.set(objective.id, mergeExistingObjectiveProgress(prior, objective));
    }
    const items = [...existingItems.map(objective => byId.get(objective.id) || objective), ...[...byId.values()].filter(objective => !existingItems.some(existingObjective => existingObjective.id === objective.id))];
    const objectiveContext = {
      ...contextState,
      objectives: {
        ...(contextState.objectives || {}),
        items,
        exclusive_group_choices: repairAiObjectiveExclusiveChoices({
          ...(existing.exclusive_group_choices || {}),
          ...(incoming.exclusive_group_choices || {})
        })
      }
    };
    updateObjectivePrerequisiteLocks(objectiveContext, (incoming.items || []).map(objective => objective.id));
    let activeId = existing.active_id;
    const activeObjective = items.find(objective => String(objective.id) === String(activeId));
    if (!activeId || objectiveIsSide(activeObjective) || !objectiveCanBeSelected(activeObjective, objectiveContext)) {
      const nextObjective = items.find(objective => !objectiveIsSide(objective) && objectiveCanBeSelected(objective, objectiveContext) && /^active$/i.test(String(objective.status || ""))) || items.find(objective => !objectiveIsSide(objective) && objectiveCanBeSelected(objective, objectiveContext));
      if (nextObjective?.id) {
        activeId = nextObjective.id;
      } else {
        activeId = "";
      }
    }
    for (const objective of items) {
      if (objectiveIsComplete(objective) || !objectiveCanBeSelected(objective, objectiveContext)) continue;
      if (objectiveIsSide(objective)) continue;
      if (String(objective.id) === String(activeId)) {
        objective.status = "active";
      } else if (/^active$/i.test(String(objective.status || ""))) {
        objective.status = "queued";
      }
    }
    return {
      active_id: activeId,
      focus_id: (items || []).some(objective => String(objective.id) === String(existing.focus_id) && objectiveCanBeSelected(objective, objectiveContext)) ? existing.focus_id : "",
      items,
      pending_reward_choices: [...(existing.pending_reward_choices || [])],
      progress_notes: {
        ...(existing.progress_notes || {}),
        ...(incoming.progress_notes || {})
      },
      exclusive_group_choices: repairAiObjectiveExclusiveChoices({
        ...(existing.exclusive_group_choices || {}),
        ...(incoming.exclusive_group_choices || {})
      }),
      suggestions: [...(existing.suggestions || []), ...(incoming.suggestions || [])]
    };
  }
  function mergeExistingObjectiveProgress(prior = {}, incoming = {}) {
    const sideObjective = objectiveIsSide(prior);
    const incomingWouldComplete = objectiveIsComplete(incoming);
    if (!sideObjective && incomingWouldComplete) {
      troubleshootingLog("blocked main objective patch completion", {
        id: prior.id,
        title: prior.title,
        priorStatus: prior.status,
        incomingStatus: incoming.status
      });
    }
    return repairAiObjectiveStepFields({
      ...prior,
      status: sideObjective ? textSlot(incoming.status, prior.status || "active") : prior.status || "active",
      notes: mergeObjectiveNotes(prior.notes, incoming.notes)
    });
  }
  function mergeObjectiveNotes(existing = [], incoming = []) {
    return [...new Set([...stringListSlot(existing, []), ...stringListSlot(incoming, [])])];
  }
  function extractObjectiveRewards(rewards) {
    return Array.isArray(rewards) ? rewards.map(compiledObjectiveReward) : [];
  }
  function repairAiObjectiveReward(reward) {
    if (typeof reward === "string") {
      const bundleId = textSlot(reward, "");
      return bundleId ? {
        type: "apply_reward_bundle",
        bundle_id: bundleId
      } : null;
    }
    if (!isPlainObject(reward)) return null;
    const type = textSlot(reward.type || (reward.bundle_id || reward.bundle || reward.reward_bundle ? "apply_reward_bundle" : ""), "");
    if (!type) return null;
    const out = {
      ...reward,
      type
    };
    if (/^(apply_reward_bundle|reward_bundle|bundle)$/i.test(type) || out.bundle_id || out.bundle || out.reward_bundle) {
      out.type = "apply_reward_bundle";
      out.bundle_id = textSlot(out.bundle_id || out.bundle || out.reward_bundle || out.id, "");
    }
    if (/^(apply_reward_template|reward_template|template)$/i.test(type) || out.template_id || out.reward_template) {
      out.type = "apply_reward_template";
      out.template_id = textSlot(out.template_id || out.reward_template || out.id, "");
      out.arguments = isPlainObject(out.arguments) ? clone(out.arguments) : {};
    }
    if (out.type === "apply_reward_bundle" && !out.bundle_id) return null;
    if (out.type === "apply_reward_template" && !out.template_id) return null;
    return out;
  }
  function repairAiRewardBundles(input = {}) {
    const out = {};
    const addBundle = (id, rewards) => {
      const bundleId = textSlot(id, "");
      if (!bundleId || !Array.isArray(rewards)) return;
      out[bundleId] = (Array.isArray(rewards) ? rewards : []).map(repairAiObjectiveReward).filter(Boolean);
    };
    if (Array.isArray(input)) {
      for (const item of input) {
        if (!isPlainObject(item)) continue;
        addBundle(item.id || item.bundle_id || item.key || item.name, item.rewards || item.items);
      }
      return out;
    }
    if (!isPlainObject(input)) return out;
    for (const [id, rewards] of Object.entries(input)) {
      if (Array.isArray(rewards)) addBundle(id, rewards);else if (isPlainObject(rewards)) addBundle(rewards.id || rewards.bundle_id || id, rewards.rewards || rewards.items);
    }
    return out;
  }
  function repairAiNumericPrecision(input = {}) {
    const forbidden = new Set(["__proto__", "prototype", "constructor"]);
    const repairMap = value => {
      if (!isPlainObject(value)) return {};
      const repaired = {};
      for (const [key, precision] of Object.entries(value)) {
        if (!key || forbidden.has(key) || !Number.isInteger(precision) || precision < 1 || precision > 6) continue;
        repaired[key] = precision;
      }
      return repaired;
    };
    return {
      story_inventory: repairMap(input?.story_inventory),
      character_stats: repairMap(input?.character_stats)
    };
  }
  function repairAiRewardTemplates(input = {}) {
    const out = {};
    if (!isPlainObject(input)) return out;
    const forbidden = new Set(["__proto__", "prototype", "constructor"]);
    for (const [rawId, rawTemplate] of Object.entries(input)) {
      if (!isPlainObject(rawTemplate)) continue;
      const id = textSlot(rawTemplate.id || rawId, "");
      if (!id || forbidden.has(id)) continue;
      const parameters = {};
      for (const [name, definition] of Object.entries(isPlainObject(rawTemplate.parameters) ? rawTemplate.parameters : {})) {
        const type = textSlot(isPlainObject(definition) ? definition.type : definition, "").toLowerCase();
        if (!textSlot(name, "") || forbidden.has(name) || !["character_id", "path"].includes(type)) continue;
        parameters[name] = {
          type
        };
      }
      out[id] = {
        parameters,
        rewards: (Array.isArray(rawTemplate.rewards || rawTemplate.items) ? rawTemplate.rewards || rawTemplate.items : []).map(repairAiObjectiveReward).filter(Boolean)
      };
    }
    return out;
  }
  function rewardTemplateSchemaValidationErrors(input = {}, rootPath = "reward_templates") {
    if (input == null) return [];
    if (!isPlainObject(input)) return [validationError(rootPath, "type", "reward_templates must be an object keyed by template id.")];
    const errors = [];
    const forbidden = new Set(["__proto__", "prototype", "constructor"]);
    for (const [templateId, template] of Object.entries(input)) {
      const path = `${rootPath}.${templateId}`;
      if (!textSlot(templateId, "") || !isPlainObject(template)) {
        errors.push(validationError(path, "type", "Reward template must be an object."));
        continue;
      }
      if (forbidden.has(templateId)) {
        errors.push(validationError(path, "unsafe", `Reward template ids cannot be "${templateId}".`));
        continue;
      }
      errors.push(...exactObjectFieldValidationErrors(template, ["parameters", "rewards"], path));
      const parameters = template.parameters;
      if (!isPlainObject(parameters)) errors.push(validationError(`${path}.parameters`, "type", "Reward template parameters must be an object."));
      const parameterTypes = {};
      for (const [name, definition] of Object.entries(isPlainObject(parameters) ? parameters : {})) {
        if (!isPlainObject(definition)) {
          errors.push(validationError(`${path}.parameters.${name}`, "type", "Template parameter definition must be an object with exactly one type field."));
          continue;
        }
        errors.push(...exactObjectFieldValidationErrors(definition, ["type"], `${path}.parameters.${name}`));
        const type = definition.type;
        if (!textSlot(name, "")) errors.push(validationError(`${path}.parameters`, "key", "Template parameter names cannot be blank."));else if (forbidden.has(name)) errors.push(validationError(`${path}.parameters.${name}`, "unsafe", `Template parameter names cannot be "${name}".`));
        if (!["character_id", "path"].includes(type)) errors.push(validationError(`${path}.parameters.${name}.type`, "enum", "Template parameter type must be character_id or path."));else parameterTypes[name] = type;
      }
      const rewards = template.rewards;
      if (!Array.isArray(rewards) || !rewards.length) errors.push(validationError(`${path}.rewards`, "required", "Reward templates require at least one reward."));
      const visit = (value, valuePath, expectedType = "") => {
        const placeholder = rewardTemplatePlaceholder(value);
        if (placeholder) {
          if (!parameterTypes[placeholder]) errors.push(validationError(valuePath, "reference", `Unknown reward template parameter: ${placeholder}.`));else if (expectedType && parameterTypes[placeholder] !== expectedType) errors.push(validationError(valuePath, "type", `Parameter ${placeholder} must have type ${expectedType} in this field.`));
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => visit(item, `${valuePath}.${index}`));
          return;
        }
        if (!isPlainObject(value)) return;
        for (const [key, item] of Object.entries(value)) {
          const fieldType = ["character_id", "value_character_id"].includes(key) ? "character_id" : ["path", "field_path", "value_path"].includes(key) ? "path" : "";
          visit(item, `${valuePath}.${key}`, fieldType);
        }
      };
      visit(rewards, `${path}.rewards`);
    }
    return errors;
  }
  function rewardTemplatePlaceholder(value) {
    if (!isPlainObject(value) || Object.keys(value).length !== 1) return "";
    return textSlot(value.parameter, "");
  }
  function validateRewardTemplateArgument(value, type, label) {
    if (type === "character_id") {
      const id = textSlot(value, "");
      if (!id) throw new Error(`${label} must be a non-empty character id.`);
      return id;
    }
    if (type === "path") {
      const errors = rewardPathValidationErrors(value, label);
      if (errors.length) throw new Error(errors[0].message);
      return value.map(part => String(part));
    }
    throw new Error(`${label} has unsupported parameter type: ${type}`);
  }
  function instantiateRewardTemplateValue(value, parameters, argumentsMap, label) {
    const parameterName = rewardTemplatePlaceholder(value);
    if (parameterName) {
      const definition = parameters[parameterName];
      if (!definition) throw new Error(`${label} references unknown parameter: ${parameterName}`);
      if (!Object.hasOwn(argumentsMap, parameterName)) throw new Error(`${label} is missing argument: ${parameterName}`);
      return clone(validateRewardTemplateArgument(argumentsMap[parameterName], definition.type, `${label}.${parameterName}`));
    }
    if (Array.isArray(value)) return value.map(item => instantiateRewardTemplateValue(item, parameters, argumentsMap, label));
    if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, instantiateRewardTemplateValue(item, parameters, argumentsMap, label)]));
    return value;
  }
  function instantiateRewardTemplate(templateId, template, argumentsMap = {}) {
    if (!isPlainObject(template)) throw new Error(`Objective reward template was not found: ${templateId}`);
    const parameters = isPlainObject(template.parameters) ? template.parameters : {};
    if (!isPlainObject(argumentsMap)) throw new Error(`Reward template ${templateId} arguments must be an object.`);
    for (const name of Object.keys(argumentsMap)) {
      if (!Object.hasOwn(parameters, name)) throw new Error(`Reward template ${templateId} received unknown argument: ${name}`);
    }
    for (const [name, definition] of Object.entries(parameters)) {
      if (!Object.hasOwn(argumentsMap, name)) throw new Error(`Reward template ${templateId} is missing argument: ${name}`);
      validateRewardTemplateArgument(argumentsMap[name], definition.type, `reward_templates.${templateId}.arguments.${name}`);
    }
    return template.rewards.map(reward => instantiateRewardTemplateValue(reward, parameters, argumentsMap, `reward_templates.${templateId}`));
  }
  function extractObjectiveChoices(choices) {
    return Array.isArray(choices) ? choices.filter(isPlainObject).map((choice, index) => {
      const id = textSlot(choice.id || choice.key, `choice-${index + 1}`);
      const title = textSlot(choice.title || choice.label || choice.name, id);
      const summary = textSlot(choice.summary || choice.description || choice.text, "");
      if (!id || !title) return null;
      return {
        id,
        title,
        summary,
        player_text: textSlot(choice.player_text || choice.playerText, ""),
        rewards: extractObjectiveRewards(choice.rewards),
        next_objective_id: textSlot(choice.next_objective_id || choice.objective_id || choice.next_id, ""),
        target_input_group_id: textSlot(choice.target_input_group_id || choice.targetInputGroupId, ""),
        completion_instruction: textSlot(choice.completion_instruction || choice.completionInstruction, ""),
        dialogue_lines: Array.isArray(choice.dialogue_lines) ? choice.dialogue_lines.map(String) : [],
        travel_location_id: textSlot(choice.travel_location_id || choice.travelLocationId, ""),
        effects: stringListSlot(choice.effects, []),
        requirements: Array.isArray(choice.requirements) ? choice.requirements.map(requirement => isPlainObject(requirement) ? clone(requirement) : String(requirement || "").trim()).filter(requirement => isPlainObject(requirement) ? true : !!requirement) : [],
        requires: Array.isArray(choice.requires) ? choice.requires.map(String).filter(Boolean) : [],
        default: choice.default === true,
        available_now: choice.available_now !== false,
        blocked_reason: textSlot(choice.blocked_reason, "")
      };
    }).filter(Boolean) : [];
  }
  function repairAiFutureCastScenePresence(value) {
    const presence = textSlot(value, "nearby").toLowerCase();
    return presence === "active" ? "nearby" : presence;
  }
  function repairAiFutureCast(source) {
    const input = isPlainObject(source) ? source : {};
    const rawItems = isPlainObject(input.items) ? input.items : isPlainObject(input) ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== "enabled" && key !== "items")) : {};
    const items = {};
    for (const [rawId, rawEntry] of Object.entries(rawItems || {})) {
      if (!isPlainObject(rawEntry)) continue;
      const name = textSlot(rawEntry.name || rawEntry.full_character?.name, rawId);
      const id = textSlot(rawEntry.id, objectiveIdFromTitle(name, rawId));
      const full = isPlainObject(rawEntry.full_character) ? materializeCharacterForRuntime(rawEntry.full_character, name) : null;
      if (full && rawEntry.can_die != null) full.can_die = rawEntry.can_die === true;
      if (full) {
        full.profile_images = repairAiRuntimeProfileImages([...(Array.isArray(rawEntry.profile_images) ? rawEntry.profile_images : []), ...(Array.isArray(full.profile_images) ? full.profile_images : [])].map(image => ({
          ...image,
          favorite: image.favorite === true
        })), full.id);
        if (full.profile_images.length) full.profile_image_id = full.profile_image_id || full.profile_images[0].id;
        removeRuntimeClothingFromCharacterDefinition(addImmutableDefinitionFields(full, name));
      }
      items[id] = {
        id,
        name,
        status: textSlot(rawEntry.status, "locked"),
        canonical_order: Number(rawEntry.canonical_order || 0),
        introduce_as: textSlot(rawEntry.introduce_as, "npc"),
        can_die: rawEntry.can_die != null ? rawEntry.can_die === true : full?.can_die === true,
        location_hint: textSlot(rawEntry.location_hint, ""),
        scene_presence: repairAiFutureCastScenePresence(rawEntry.scene_presence),
        role: textSlot(rawEntry.role, ""),
        relationship: textSlot(rawEntry.relationship, ""),
        note: textSlot(rawEntry.note || rawEntry.summary, ""),
        greeting: textSlot(rawEntry.greeting || rawEntry.on_unlock?.greeting, ""),
        personality_description: textSlot(rawEntry.personality_description, full?.personality_description || ""),
        full_character: full,
        profile_images: Array.isArray(rawEntry.profile_images) ? rawEntry.profile_images.map(image => ({
          ...image,
          favorite: image.favorite === true
        })) : [],
        images: Array.isArray(rawEntry.images) ? rawEntry.images.map(image => ({
          ...image,
          favorite: image.favorite === true
        })) : [],
        meet_condition: rawEntry.meet_condition || null,
        join_condition: rawEntry.join_condition || null,
        on_purchase_objective: textSlot(rawEntry.on_purchase_objective || rawEntry.purchase_story_objective || rawEntry.purchase_objective || rawEntry.purchase_story || rawEntry.character_story_objective || rawEntry.character_story, ""),
        on_unlock: isPlainObject(rawEntry.on_unlock) ? clone(rawEntry.on_unlock) : {},
        unlocked_by: textSlot(rawEntry.unlocked_by, ""),
        last_triggered_reason: textSlot(rawEntry.last_triggered_reason, "")
      };
    }
    return {
      enabled: input.enabled !== false,
      items
    };
  }
  function compactFutureCastForPrompt(futureCast = app.state.future_cast) {
    const cast = repairAiFutureCast(futureCast);
    return {
      enabled: cast.enabled,
      items: Object.fromEntries(Object.entries(cast.items || {}).slice(0, 30).map(([id, entry]) => [id, {
        name: entry.name,
        status: entry.status,
        location_hint: entry.location_hint,
        introduce_as: entry.introduce_as
      }]))
    };
  }
  function storyMemoryCategories() {
    return ["world_notes", "unresolved_threads", "relationship_notes", "rules_and_constraints", "ai_private_notes"];
  }
  function extractStoryMemory(source) {
    const base = clone(defaultState.story_memory);
    const input = isPlainObject(source) ? source : {};
    const out = {};
    for (const key of storyMemoryCategories()) {
      out[key] = stringListSlot(input[key], base[key] || []).map(note => textSlot(note, "")).filter(Boolean).filter((note, index, arr) => arr.indexOf(note) === index);
    }
    return out;
  }
  const APPEARANCE_STAT_KEYS = ["height"];
  function repairAiGeneratedAppearanceStats(stats) {
    if (!isPlainObject(stats)) return {};
    const out = {};
    for (const key of APPEARANCE_STAT_KEYS) {
      const value = stats[key];
      if (value == null) continue;
      out[key] = typeof value === "number" ? Math.max(0, Math.min(20, Math.round(value))) : textSlot(value);
    }
    out.body_description = textSlot(stats.body_description, "");
    out.extra_description_lower_body = textSlot(stats.extra_description_lower_body, "");
    out.nonhuman_lower_body = stats.nonhuman_lower_body === true;
    return out;
  }
  function relationshipStatIsCapped(stat = "") {
    return ["trust", "attraction", "affection"].includes(String(stat || ""));
  }
  function relationshipStatAdjustedValue(current, requestedDelta, stat = "") {
    const currentNumber = strictFiniteNumber(current);
    const raw = strictFiniteNumber(requestedDelta);
    if (currentNumber == null || raw == null) return null;
    const before = exactState10(currentNumber);
    if (!relationshipStatIsCapped(stat)) return clamp10(before + raw);
    const delta = Math.max(-2, Math.min(2, raw));
    return clamp10(before + delta);
  }
  function relationshipStatCappedAbsoluteValue(current, requestedValue, stat = "") {
    const currentNumber = strictFiniteNumber(current);
    const requestedNumber = strictFiniteNumber(requestedValue);
    if (currentNumber == null || requestedNumber == null) return null;
    const before = exactState10(currentNumber);
    const target = repairAiState10(requestedNumber);
    if (!relationshipStatIsCapped(stat)) return target;
    const delta = Math.max(-2, Math.min(2, target - before));
    return clamp10(before + delta);
  }
  function parseCompactAiPatch(raw, baseState = app.state, allowedRoots = [], options = {}) {
    const data = parseJsonObject(raw);
    const errors = [];
    if (!data) return {
      valid: false,
      patch: {},
      errors: ["invalid JSON"]
    };
    const hasCompactOps = ["s", "n", "a", "d", "r"].some(key => Object.prototype.hasOwnProperty.call(data, key));
    if (!hasCompactOps) {
      if (options.requireOperations === true && Object.keys(data).length) return {
        valid: false,
        patch: {},
        errors: ["state updates require s, n, a, d, or r operations; direct root object patches are unsupported"],
        raw
      };
      const invalid = validatePatchShape(data);
      return {
        valid: !invalid.length,
        patch: data,
        errors: invalid,
        raw
      };
    }
    const patch = {};
    const setOps = Array.isArray(data.s) ? data.s : [];
    const nullOps = Array.isArray(data.n) ? data.n : [];
    const deleteOps = Array.isArray(data.d) ? data.d : [];
    const addOps = Array.isArray(data.a) ? data.a : [];
    const relativeOps = Array.isArray(data.r) ? data.r : [];
    let acceptedCount = 0;
    const compactOpPath = (op, kind) => {
      if (isPlainObject(op)) {
        const path = op.path ?? op.p;
        if (path == null) return {
          error: `bad ${kind} op missing path ${compactJson(op)}`
        };
        return {
          path
        };
      }
      if (kind === "set" || kind === "add" || kind === "relative") {
        if (!Array.isArray(op) || op.length < 2) return {
          error: `bad ${kind} op ${compactJson(op)}`
        };
        if (op.length === 2) return {
          path: op[0],
          value: op[1]
        };
        return {
          path: op.slice(0, -1),
          value: op[op.length - 1]
        };
      }
      if (Array.isArray(op) && op.length === 1) return {
        path: op[0]
      };
      return {
        path: op
      };
    };
    const compactOpValue = (op, parsedOp, kind) => {
      if (isPlainObject(op)) {
        if (Object.prototype.hasOwnProperty.call(op, "value")) return op.value;
        if (Object.prototype.hasOwnProperty.call(op, "v")) return op.v;
        return {
          error: `bad ${kind} op missing value ${compactJson(op)}`
        };
      }
      return parsedOp.value;
    };
    for (const key of Object.keys(data)) {
      if (!["s", "n", "a", "d", "r"].includes(key)) {
        if (key === "recent_changes") errors.push('recent_changes must be appended via "a"');else if (hasCompactOps) errors.push(`unexpected patch key ${key}`);
      }
    }
    for (const op of setOps) {
      const opShape = compactOpPath(op, "set");
      if (opShape.error) {
        errors.push(opShape.error);
        continue;
      }
      const value = compactOpValue(op, opShape, "set");
      if (value && value.error) {
        errors.push(value.error);
        continue;
      }
      const parsed = parseCompactPatchPath(opShape.path, baseState, allowedRoots);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      setPathValue(patch, parsed.path, compactPatchValue(value, parsed.path));
      acceptedCount++;
    }
    for (const pathText of [...nullOps, ...deleteOps]) {
      const opShape = compactOpPath(pathText, "null");
      if (opShape.error) {
        errors.push(opShape.error);
        continue;
      }
      const parsed = parseCompactPatchPath(opShape.path, baseState, allowedRoots);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      setPathValue(patch, parsed.path, null);
      acceptedCount++;
    }
    for (const op of addOps) {
      const opShape = compactOpPath(op, "add");
      if (opShape.error) {
        errors.push(opShape.error);
        continue;
      }
      const value = compactOpValue(op, opShape, "add");
      if (value && value.error) {
        errors.push(value.error);
        continue;
      }
      const parsed = parseCompactPatchPath(opShape.path, baseState, allowedRoots);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      const current = hasPathValue(patch, parsed.path) ? getPathValue(patch, parsed.path) : getPathValue(baseState, parsed.path);
      const added = compactPatchValue(value, parsed.path);
      if (parsed.path.join(".") === "recent_changes" && Array.isArray(added)) {
        errors.push("recent_changes append value must be one string, not an array");
        continue;
      }
      setPathValue(patch, parsed.path, Array.isArray(current) ? [...current, added] : [added]);
      acceptedCount++;
    }
    for (const op of relativeOps) {
      const opShape = compactOpPath(op, "relative");
      if (opShape.error) {
        errors.push(opShape.error);
        continue;
      }
      const value = compactOpValue(op, opShape, "relative");
      if (value && value.error) {
        errors.push(value.error);
        continue;
      }
      const parsed = parseCompactPatchPath(opShape.path, baseState, allowedRoots);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      const delta = strictFiniteNumber(value);
      if (delta == null) {
        errors.push(`bad relative op nonnumeric value ${compactJson(op)}`);
        continue;
      }
      const current = hasPathValue(patch, parsed.path) ? getPathValue(patch, parsed.path) : getPathValue(baseState, parsed.path);
      const stat = parsed.path[parsed.path.length - 1];
      const adjusted = relationshipStatAdjustedValue(current, delta, stat);
      if (adjusted == null) {
        errors.push(`bad relative op current value is missing or nonnumeric ${compactJson(op)}`);
        continue;
      }
      setPathValue(patch, parsed.path, adjusted);
      acceptedCount++;
    }
    return {
      valid: !errors.length,
      patch,
      errors,
      raw,
      acceptedCount
    };
  }
  function compactPatchValue(value, path = []) {
    const last = path[path.length - 1];
    if (value === "t") return true;
    if (value === "f") return false;
    if (value === "n") return null;
    return value;
  }
  function parseCompactPatchPath(pathText, state = app.state, allowedRoots = []) {
    // AI repair responses should use path arrays for names/keys with
    // spaces. Dotted paths remain supported for older compact patches,
    // but arrays prevent "Duskfall Plaza" style keys from being split
    // or repaired into invalid paths.
    let rawParts = Array.isArray(pathText) ? pathText.map(part => String(part || "").trim()).filter(Boolean) : String(pathText || "").split(".").map(part => part.trim()).filter(Boolean);
    if (rawParts.length === 1 && rawParts[0].includes(".")) {
      rawParts = rawParts[0].split(".").map(part => part.trim()).filter(Boolean);
    }
    if (!rawParts.length) return {
      error: "empty path"
    };
    const top = rawParts[0];
    const allowedTop = new Set(["location", "world_map", "npc_directory", "time", "scene", "player", "characters", "party_members", "world_flags", "objectives", "future_cast", "story_memory", "recent_changes", ...allowedRoots]);
    if (!allowedTop.has(top)) return {
      error: `invalid top-level path ${top}`
    };
    if ((top === "characters" || top === "party_members") && rawParts.length >= 2) {
      const rest = rawParts.slice(1).join(".");
      const names = Object.keys(state.characters || {}).sort((a, b) => b.length - a.length);
      const match = resolveCharacterName(rawParts[1], state, "") || names.find(name => rest === name || rest.startsWith(`${name}.`) || normalizeNameForMatch(rest.split(".")[0]) === normalizeNameForMatch(name)) || rawParts[1];
      const after = rest === match ? [] : rest.startsWith(`${match}.`) ? rest.slice(match.length + 1).split(".") : rawParts.slice(2);
      const path = ["characters", match, ...after.filter(Boolean)];
      const clothingError = validateClothingPath(path);
      if (clothingError) return {
        error: clothingError
      };
      return {
        path
      };
    }
    const clothingError = validateClothingPath(rawParts);
    if (clothingError) return {
      error: clothingError
    };
    return {
      path: rawParts
    };
  }
  function validateClothingPath(path) {
    const clothingIndex = path.indexOf("clothing");
    if (clothingIndex < 0) return "";
    const slot = path[clothingIndex + 1];
    if (!slot) return "";
    if (!validClothingSlots().includes(slot)) return `invalid clothing slot ${path.join(".")}; allowed: ${validClothingSlots().join(",")}`;
    return "";
  }
  function validatePatchShape(patch) {
    const errors = [];
    const walk = (value, path = []) => {
      if (validateClothingPath(path)) errors.push(validateClothingPath(path));
      if (!isPlainObject(value)) return;
      for (const [key, child] of Object.entries(value)) {
        walk(child, [...path, key]);
      }
    };
    walk(patch, []);
    return [...new Set(errors)];
  }
  function getPathValue(target, path) {
    let cursor = target;
    for (const key of path) {
      if (cursor == null) return undefined;
      cursor = cursor[key];
    }
    return cursor;
  }
  function hasPathValue(target, path) {
    let cursor = target;
    for (const key of path) {
      if (cursor == null) return false;
      if (!Object.prototype.hasOwnProperty.call(Object(cursor), key)) return false;
      cursor = cursor[key];
    }
    return true;
  }
  async function repairCompactAiPatch({
    source,
    text,
    stateContextText,
    previousRaw,
    previousPatch,
    errors,
    beforeState
  }) {
    let lastRaw = previousRaw;
    const initial = preflightGameAiStatePatch({
      valid: !(errors || []).length,
      patch: previousPatch || {},
      errors: errors || ["invalid state JSON patch"]
    });
    let lastErrors = initial.errors;
    let lastPatch = initial.patch;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const repairPrompt = buildCompactPatchRepairInstruction({
        source,
        text,
        stateContextText,
        previousRaw: lastRaw,
        previousPatch: lastPatch,
        errors: lastErrors
      });
      const raw = await aiText(repairPrompt, {
        startWith: "{",
        hideStartWith: false,
        label: `${source} state JSON patch repair ${attempt}`,
        logType: "state",
        allowDuringStateSync: true
      });
      if (raw === lastRaw) break;
      const parsed = preflightGameAiStatePatch(parseCompactAiPatch(raw, beforeState, [], {
        requireOperations: true
      }));
      if (parsed.valid && !parsed.errors.length) return parsed;
      lastRaw = raw;
      lastPatch = parsed.patch;
      lastErrors = parsed.errors.length ? parsed.errors : ["invalid repair"];
    }
    return {
      valid: false,
      patch: lastPatch,
      errors: lastErrors,
      raw: lastRaw
    };
  }
  function buildCompactPatchRepairInstruction({
    source,
    text,
    stateContextText,
    previousRaw,
    previousPatch,
    errors
  }) {
    return `Repair an EmberAdventures state JSON patch.
Output ONLY minified structured JSON ops or {}. No markdown.
Use only this shape:
{
  "s": [{"path": ["path", "parts"], "value": "value"}],
  "n": [{"path": ["path", "parts"]}],
  "a": [{"path": ["path", "parts"], "value": "value"}]
}
If no valid changes remain, return {}.
Use path arrays instead of dotted strings whenever a key or name can contain spaces, e.g. ["npc_directory","locations","Duskfall Plaza","characters","Valtos","name"].
Objective definitions and objective runtime are engine-owned. Never return an operation whose path begins with "objectives".
recent_changes must be a list of short real facts from the message. Do not return placeholders, examples, ordinal filler, todo text, or generic filler.
Prefer 0 to 3 ops. Do not add explanations.
Rejected items:
${(errors || []).join("\n")}

Previous raw response:
${String(previousRaw || "").slice(0, 1200)}

Accepted patch so far:
${compactJson(previousPatch || {})}

State:
${stateContextText}

${String(source || "message").toUpperCase()} MESSAGE:
${text}

JSON PATCH:`;
  }
  function generatedBodyDescriptionRuleText(path = "appearance.body_description") {
    return `${path} is concise text describing overall build and proportions, such as slender, stocky, athletic, or broad and muscular. Avoid detailed descriptions of individual body parts. Leave it empty when no overall build is specified.`;
  }
  function extractWorldCharacterSeed(item) {
    if (!isPlainObject(item)) return null;
    const name = String(item.name || "Companion").replace(/[^\w '\-]/g, "").trim() || "Companion";
    return {
      name,
      age: repairAiAdultAge(item.age, item.name, item.role, "AI objective suggestion"),
      gender: textSlot(item.gender, "female") || "female",
      role: textSlot(item.role, "adult companion") || "adult companion",
      relationship_to_player: textSlot(item.relationship_to_player, "new companion") || "new companion",
      personality_description: textSlot(item.personality_description || item.personality, "curious, observant, and motivated by the opening conflict") || "curious, observant, and motivated by the opening conflict",
      speech_style: textSlot(item.speech_style || item.dialogue_style, ""),
      boldness: repairAiCharacterBoldness(item.boldness),
      outfit: textSlot(item.outfit, "fantasy adventuring outfit") || "fantasy adventuring outfit",
      hook: textSlot(item.hook, `${name} has a reason to travel with the hero.`),
      appearance: textSlot(item.appearance, ""),
      appearance_stats: repairAiGeneratedAppearanceStats(item.appearance_stats)
    };
  }
  function mergeWorldChunk(state, chunk) {
    if (!isPlainObject(chunk)) return state;
    const location = extractLocation(chunk.location);
    const scene = extractScene(chunk.scene);
    const worldFlags = extractWorldFlags(chunk.world_flags);
    const player = extractPlayer(chunk.player, state.player, {
      allowPersonalityDescription: true
    });
    if (Object.keys(location).length) state.location = {
      ...state.location,
      ...location
    };
    if (isPlainObject(chunk.world_map)) {
      const currentBeforeMap = state.world_map?.current_location_id || "";
      state.world_map = mergeWorldMap(state.world_map, chunk.world_map, state);
      const requestedCurrent = chunk.world_map.current_location_id ? safeMapId(chunk.world_map.current_location_id) : "";
      // During generation, honor the AI's explicit current_location_id
      // when that node exists. Without this, sparse location objects can
      // make normalization drift to a connected future/undiscovered node.
      if (requestedCurrent && state.world_map.locations?.[requestedCurrent] && currentBeforeMap !== requestedCurrent) {
        state.world_map.current_location_id = requestedCurrent;
        state.world_map.focus_location_id = state.world_map.locations[requestedCurrent].parent_id || requestedCurrent;
      }
    }
    if (Object.keys(scene).length) state.scene = {
      ...state.scene,
      ...scene
    };
    if (Object.keys(worldFlags).length) state.world_flags = {
      ...state.world_flags,
      ...worldFlags
    };
    if (Object.keys(player).length) state.player = {
      ...state.player,
      ...player
    };
    state.progression = {};
    if (isPlainObject(chunk.objectives)) {
      if (isPlainObject(chunk.objectives.reward_bundles)) state.reward_bundles = repairAiRewardBundles({
        ...(state.reward_bundles || {}),
        ...chunk.objectives.reward_bundles
      });
      if (isPlainObject(chunk.objectives.reward_templates)) state.reward_templates = repairAiRewardTemplates({
        ...(state.reward_templates || {}),
        ...chunk.objectives.reward_templates
      });
      if (isPlainObject(chunk.objectives.numeric_precision)) state.numeric_precision = repairAiNumericPrecision({
        story_inventory: {
          ...(state.numeric_precision?.story_inventory || {}),
          ...(chunk.objectives.numeric_precision.story_inventory || {})
        },
        character_stats: {
          ...(state.numeric_precision?.character_stats || {}),
          ...(chunk.objectives.numeric_precision.character_stats || {})
        }
      });
      state.objectives = extractObjectives({
        ...(state.objectives || {}),
        ...chunk.objectives
      }, state);
    }
    if (isPlainObject(chunk.reward_bundles)) state.reward_bundles = repairAiRewardBundles({
      ...(state.reward_bundles || {}),
      ...chunk.reward_bundles
    });
    if (isPlainObject(chunk.reward_templates)) state.reward_templates = repairAiRewardTemplates({
      ...(state.reward_templates || {}),
      ...chunk.reward_templates
    });
    if (isPlainObject(chunk.numeric_precision)) state.numeric_precision = repairAiNumericPrecision({
      story_inventory: {
        ...(state.numeric_precision?.story_inventory || {}),
        ...(chunk.numeric_precision.story_inventory || {})
      },
      character_stats: {
        ...(state.numeric_precision?.character_stats || {}),
        ...(chunk.numeric_precision.character_stats || {})
      }
    });
    if (isPlainObject(chunk.future_cast)) state.future_cast = repairAiFutureCast({
      ...(state.future_cast || {}),
      ...chunk.future_cast
    });
    if (Array.isArray(chunk.story_rules)) state.story_rules = repairAiStoryRules([...(state.story_rules || []), ...chunk.story_rules]);
    delete state.story_flags;
    if (isPlainObject(chunk.story_memory)) state.story_memory = extractStoryMemory({
      ...(state.story_memory || {}),
      ...chunk.story_memory
    });
    if (Array.isArray(chunk.recent_changes)) state.recent_changes = stringListSlot(chunk.recent_changes, state.recent_changes || []).slice(0, 8);
    if (Array.isArray(chunk.characters)) {
      const extractedCharacters = chunk.characters.slice(0, 5).map(extractWorldCharacterSeed).filter(Boolean);
      const distinctCharacters = uniqueGeneratedCharacters(extractedCharacters, personNameDuplicatePool(state));
      state.characters = {};
      for (const item of distinctCharacters) {
        state.characters[item.name] = makeWorldCharacter(item.name, item.age, item.gender, item.role, item.relationship_to_player, item.personality_description, item.speech_style, item.outfit, item.hook || `${item.name} has a reason to travel with the hero.`);
        state.characters[item.name].boldness = repairAiCharacterBoldness(item.boldness);
        if (item.appearance) state.characters[item.name].appearance.extra_description = item.appearance;
        if (isPlainObject(item.appearance_stats)) {
          for (const [key, value] of Object.entries(item.appearance_stats)) {
            if (value == null) continue;
            state.characters[item.name].appearance[key] = key === "nonhuman_lower_body" ? value === true : typeof value === "number" ? Math.max(0, Math.min(20, Math.round(value))) : textSlot(value);
          }
        }
      }
      const firstName = Object.keys(state.characters)[0];
      if (firstName) {
        state.scene.party_members_present = [firstName];
        state.scene.image_characters = [firstName];
      } else {
        state.scene.party_members_present = ["Player"];
        state.scene.image_characters = ["Player"];
        replaceSceneNpcPresence(state, [], "world chunk merged with no party member");
      }
    }
    return reconcileStoryRuntimeState(state, "world chunk merge");
  }
  function saveRuntimeStateEditorFromTree(tree = $("friendlyStateEditor"), source = "state editor") {
    const before = clone(app.state);
    app.state = readFriendlyStateEditor(app.state, tree || document);
    applyObjectiveProgressRewards(before, app.state, source);
    scheduleActiveGameSave();
  }
  function bindRuntimeStateEditorAutoSave() {
    bindStateEditorAutoSave("friendlyStateEditor", () => saveRuntimeStateEditorFromTree($("friendlyStateEditor"), "state editor"), "friendly state edit", "State Editor Autosave Failed");
  }
  function openStateModal() {
    if (!app.settings?.devMode) {
      showNotice("Advanced Mode Required", "Raw state editing is hidden in normal play. Enable Dev mode in Settings to open the advanced state editor.");
      return;
    }
    openModal(`
                <p class="hint">State is the editable game record: location, objectives, inventory, relationships, images, map, and runtime facts. Use the structured fields below.</p>
                <details open>
                    <summary>Structured editor</summary>
                    <div id="friendlyStateEditor" class="state-editor-tree">${buildFriendlyStateEditor(completeFriendlyStateEditorSchema(app.state), [], 0, {
      profile: "runtime"
    })}</div>
                </details>
            `, {
      title: "Edit State"
    });
    bindRuntimeStateEditorAutoSave();
  }
  function completeFriendlyStateEditorSchema(value = {}) {
    const draft = clone(value || {});
    completeFriendlyEntityForEditor(draft.player);
    for (const character of Object.values(draft.characters || {})) {
      completeFriendlyEntityForEditor(character);
    }
    if (draft.npc) {
      completeFriendlyEntityForEditor(draft.npc, {
        completeTopLevelClothing: isPlainObject(draft.npc.clothing)
      });
      completeFriendlyEntityForEditor(draft.npc.full_character);
    }
    if (draft.character_definition) {
      delete draft.character_definition.clothing;
      completeFriendlyEntityForEditor(draft.character_definition, {
        completeTopLevelClothing: false
      });
    }
    if (draft.game_managed_data) completeFriendlyEntityForEditor(draft.game_managed_data);
    for (const location of Object.values(draft.npc_directory?.locations || {})) {
      for (const npc of Object.values(location?.characters || {})) {
        completeFriendlyEntityForEditor(npc?.full_character);
      }
    }
    return draft;
  }
  function completeFriendlyEntityForEditor(entity, options = {}) {
    if (!isPlainObject(entity)) return;
    if (options.completeTopLevelClothing !== false) entity.clothing = completeClothingSlotsForEditor(entity.clothing || {});
    if (Array.isArray(entity.outfits)) {
      for (const outfit of entity.outfits) {
        if (!isPlainObject(outfit)) continue;
        outfit.clothing = completeClothingSlotsForEditor(outfit.clothing || {});
      }
    }
  }
  function buildFriendlyStateEditor(value, path = [], depth = 0, options = {}) {
    const readonly = !!options.readonly;
    if (path.at(-1) === "chat_story_template") {
      const section = document.createElement("div");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Story";
      button.dataset.characterStoryEditor = "true";
      const stored = document.createElement("input");
      stored.type = "hidden";
      stored.dataset.statePath = statePathAttr(path);
      stored.dataset.stateKind = "json";
      stored.value = JSON.stringify(value);
      section.append(button, stored);
      return section.outerHTML;
    }
    if (Array.isArray(value)) {
      const label = path[path.length - 1] || "state";
      const simpleReadonlyList = readonly && value.every(item => !Array.isArray(item) && !isPlainObject(item));
      const rows = simpleReadonlyList ? value.map(item => `<div class="state-readonly-list-value">${escapeHtml(item == null ? "" : String(item))}</div>`).join("") : value.map((item, index) => `
                        <div class="state-array-item" data-state-array-item-path="${statePathAttr([...path, index])}">
                            <div class="state-array-child">${buildFriendlyStateEditorItem(item, [...path, index], depth + 1, options)}</div>
                            ${readonly ? "" : `<button type="button" class="icon-button" title="Remove ${escapeHtml(label)} item" onclick="EmberAdventures.removeFriendlyStateListItem(this)">X</button>`}
                        </div>
                    `).join("");
      return `
                    <details class="state-branch" ${depth < 2 ? "open" : ""}>
                        <summary>${escapeHtml(stateEditorDisplayLabel(label, options))} list</summary>
                        <div class="state-children ${simpleReadonlyList ? "state-readonly-list-values" : ""}">${rows || `<p class="hint">Empty list.</p>`}</div>
                        ${readonly ? "" : `<button type="button" class="tool-button" style="margin-top:.45rem" data-state-array-add-path="${statePathAttr(path)}" onclick="EmberAdventures.addFriendlyStateListItem(this)">+ Add ${escapeHtml(stateEditorDisplayLabel(label, options))} item</button>`}
                    </details>
                `;
    }
    if (isPlainObject(value)) {
      const entries = Object.entries(value).filter(([key]) => shouldShowStateEditorField([...path, key], options));
      if (entries.length === 1 && path.length && options.profile !== "story_builder") {
        const [key, child] = entries[0];
        return buildFriendlyStateEditor(child, [...path, key], depth, options);
      }
      const label = path.length ? path[path.length - 1] : "state";
      const children = entries.map(([key, child]) => buildFriendlyStateEditor(child, [...path, key], depth + 1, options)).join("");
      return `
                    <details class="state-branch" ${depth < 2 ? "open" : ""}>
                        <summary>${escapeHtml(stateEditorDisplayLabel(label, options))}</summary>
                        <div class="state-children">${children}</div>
                        ${!readonly && options.profile === "story_builder" ? `<button type="button" class="tool-button" data-state-object-add-path="${statePathAttr(path)}" onclick="EmberAdventures.addFriendlyStateObjectField(this)">+ Add field</button>` : ""}
                    </details>
                `;
    }
    const label = path[path.length - 1] || "value";
    const fieldHint = stateEditorFieldHint(path);
    const kind = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : value == null ? "null" : "string";
    if (kind === "boolean") {
      const row = document.createElement("label");
      row.className = "state-field";
      row.style.gridTemplateColumns = "minmax(0, 1fr) auto";
      row.style.alignItems = "center";
      const name = document.createElement("span");
      name.className = "state-field-name";
      name.textContent = label;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.stateKind = "boolean";
      checkbox.dataset.statePath = encodeURIComponent(JSON.stringify(path));
      checkbox.defaultChecked = !!value;
      checkbox.disabled = readonly;
      row.append(name, checkbox);
      if (fieldHint && options.profile !== "character") {
        const hint = document.createElement("small");
        hint.className = "hint";
        hint.style.gridColumn = "1 / -1";
        hint.textContent = fieldHint;
        row.append(hint);
      }
      return row.outerHTML;
    }
    const genderPicks = !readonly && kind === "string" && path[path.length - 1] === "gender" ? `<div class="character-library-gender-picks">${defaultCharacterGenderTags().map(tag => `<button type="button" onclick="EmberAdventures.setFriendlyGenderField(this, ${htmlJsArg(tag)})">${escapeHtml(tag)}</button>`).join("")}</div>` : "";
    const valueControl = !readonly && options.profile === "story_builder" && stateEditorSelectOptions(path).length ? `<select data-state-kind="${kind}" data-state-path="${statePathAttr(path)}">${stateEditorSelectOptions(path).map(option => `<option value="${escapeHtml(option)}" ${String(value ?? "") === option ? "selected" : ""}>${escapeHtml(stateEditorDisplayLabel(option, options))}</option>`).join("")}</select>` : kind === "string" ? `<textarea ${stateEditorInputAttributes(path, kind)} class="state-textarea" placeholder="${escapeHtml(fieldHint)}" data-state-kind="${kind}" data-state-path="${statePathAttr(path)}" rows="${stateEditorTextareaRows(value)}" ${readonly ? "readonly" : ""}>${escapeHtml(value == null ? "" : value)}</textarea>` : `<input ${stateEditorInputAttributes(path, kind)} placeholder="${escapeHtml(fieldHint)}" data-state-kind="${kind}" data-state-path="${statePathAttr(path)}" value="${escapeHtml(value == null ? "" : value)}" ${readonly ? "readonly" : ""}>`;
    const fieldControl = genderPicks ? `<div class="state-field-control-stack">${valueControl}${genderPicks}</div>` : valueControl;
    const actionButtons = readonly || typeof path.at(-1) === "number" ? "" : `
                    ${isClothingSlotPath(path) || isHeldItemSlotPath(path) ? `<button type="button" class="icon-button clothing-remove" title="Move ${escapeHtml(label)} to inventory" onclick="EmberAdventures.unequipFriendlyClothingField(this)">&#128085;&#8600;</button>` : ""}
                    <button type="button" class="icon-button ${value == null ? "is-off" : ""}" title="Set ${escapeHtml(label)} to null" onclick="EmberAdventures.nullFriendlyStateField(this)">X</button>
                `;
    const row = document.createElement("label");
    row.className = "state-field";
    const listValue = typeof path.at(-1) === "number";
    if (listValue) row.style.gridTemplateColumns = "minmax(0, 1fr)";else {
      const name = document.createElement("span");
      name.className = "state-field-name";
      name.textContent = stateEditorDisplayLabel(label, options);
      row.append(name);
    }
    const control = document.createElement("div");
    control.className = "state-field-control";
    control.innerHTML = fieldControl;
    if (listValue) control.querySelector("input, textarea, select")?.setAttribute("aria-label", `${path.at(-2)} item ${path.at(-1) + 1}`);
    if (actionButtons) {
      const actions = document.createElement("div");
      actions.className = "state-field-actions";
      actions.innerHTML = actionButtons;
      control.append(actions);
    }
    if (fieldHint && options.profile !== "character") {
      const hint = document.createElement("small");
      hint.className = "hint";
      hint.textContent = fieldHint;
      control.append(hint);
    }
    row.append(control);
    return row.outerHTML;
  }
  function stateEditorDisplayLabel(label = "", options = {}) {
    if (label === "body_description") return "Body description";
    if (options.profile === "character" && (String(label).startsWith("starting_") || ["right_hand", "left_hand", "can_die", "romanceable"].includes(label))) return String(label).replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
    if (options.profile !== "story_builder") return String(label || "");
    return String(label || "").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }
  function stateEditorSelectOptions(path = []) {
    const key = String(path[path.length - 1] || "");
    const joined = path.map(String).join(".");
    if (key === "type" && joined.includes("rewards")) return [...supportedObjectiveRewardTypes()];
    if (key === "op" || key === "operator") return ["truthy", "==", "!=", ">", ">=", "<", "<="];
    if (key === "type" && joined.includes("story_shops")) return ["general", "clothing", "character", "job"];
    if (key === "purchase_mode" && joined.includes("story_shops")) return ["acquire", "service"];
    if (key === "completion_control") return ["player", "ai", "choice", "reward_only"];
    if (key === "route_control") return ["", "ai"];
    if (key === "default_mode") return ["always_eligible", "only_if_no_other_eligible"];
    if (key === "operation") return ["set", "add", "subtract", "multiply", "divide"];
    return [];
  }
  function stateEditorFieldHint(path = []) {
    const key = path[path.length - 1];
    if (["starting_trust", "starting_attraction", "starting_affection"].includes(key)) return "Starting value from 0 to 10";
    if (path.includes("starting_held_items")) return "Item held in this hand at the start; leave blank for an empty hand";
    if (path.includes("starting_inventory")) return "An item carried at the start";
    if (path.includes("chat_starting_location")) {
      const hints = {
        "label": "Short location name, such as \"Coffee shop.\" Used as the location's displayed name.",
        "place": "Description, such as \"A quiet corner booth in a downtown coffee shop.\"",
        "activity": "What the characters are doing, such as \"sitting together and talking.\""
      };
      if (hints[key]) return hints[key];
    }
    if (key === "body_description") return "Overall build, such as slender, stocky, athletic, or broad and muscular.";
    if (key === "boldness") return "1-10 or text description";
    if (bodyStatKeys().includes(key)) return "0-20 or text description";
    if (path.includes("starting_known_facts")) return "A lasting fact about this character";
    const characterField = path.includes("character_definition") || path.includes("game_managed_data");
    if (characterField) {
      const hints = {
        age: "Enter age in years.",
        gender: "Use the buttons below, or type a gender if not listed.",
        name: "Enter a name.",
        role: "Short occupation or social role; maximum 40 characters.",
        personality_description: "Describe enduring personality, motivations, habits, and behavior.",
        speech_style: "Describe vocabulary, tone, cadence, and distinctive speech habits.",
        species: "Enter species or biological identity, such as human or elf.",
        skin_color: "Bare color phrase, such as warm brown; omit the word skin.",
        eye_color: "Describe eye color.",
        hair_color: "Describe hair color.",
        hair_length: "Describe hair length, such as shoulder-length.",
        hair_type: "Hair texture/type, such as wavy or tightly coiled; put styling in the outfit hair accessory slot.",
        hair_accessory: "Hairstyle, hair accessories, or both; for example, hair gathered into a loose braid.",
        catalog_hook: "Short, spoiler-free reason to chat with this character.",
        chat_opening_message: "Write the opening narration and dialogue for character chat.",
        chat_story: "Describe the premise for character chat.",
        default_image_background: "Describe the setting for profile images.",
        extra_description: "Permanent visual details not covered elsewhere, such as scars or markings; omit clothing and hairstyle.",
        starting_relationship_to_player: "Describe the initial relationship to the player.",
        starting_state_of_mind: "Describe the initial mood or mental state.",
        starting_physical_state: "Describe the initial physical condition.",
        starting_pose: "Describe this character's own posture or interaction with an object."
      };
      if (hints[key]) return hints[key];
      if (path.includes("clothing")) return `Describe the outfit's ${String(key).replaceAll("_", " ")}; leave blank if unused.`;
      return `Enter ${String(typeof key === "number" ? path[path.length - 2] : key).replaceAll("_", " ")}.`;
    }
    if (key === "nonhuman_lower_body") return "Enable only when normal humanoid hips and legs are replaced by a distinct nonhuman lower body.";
    if (key === "extra_description_lower_body") return "Concrete durable visual details below the waist. Required as a recommendation when nonhuman lower body is enabled; omitted from profile portraits.";
    if (key === "purchase_mode") return "Acquire adds the character to the player's roster. Service charges for access while keeping the character as an NPC.";
    if (key === "repeatable") return "Repeatable service listings can be purchased more than once. Acquisition listings cannot be repeatable.";
    if (key === "on_purchase_objective") return "Optional objective to start after this listing is purchased.";
    return "";
  }
  function stateEditorTextareaRows(value = "") {
    return 1;
  }
  function autosizeStateTextarea(field) {
    if (!field || field.tagName?.toLowerCase() !== "textarea") return;
    field.style.overflowY = "hidden";
    field.style.height = "0px";
    const borderAdjust = field.offsetHeight && field.clientHeight ? field.offsetHeight - field.clientHeight : 0;
    field.style.height = `${Math.max(field.scrollHeight + borderAdjust, 1)}px`;
  }
  function autosizeStateTextareas(root = document) {
    root?.querySelectorAll?.("textarea.state-textarea").forEach(field => autosizeStateTextarea(field));
  }
  function stateEditorElementPathToken(element) {
    const field = element?.matches?.("[data-state-path]") ? element : element?.querySelector?.("[data-state-path]");
    if (field?.dataset?.statePath) return {
      kind: "field",
      path: field.dataset.statePath
    };
    const item = element?.matches?.("[data-state-array-item-path]") ? element : element?.closest?.("[data-state-array-item-path]");
    if (item?.dataset?.stateArrayItemPath) return {
      kind: "item",
      path: item.dataset.stateArrayItemPath
    };
    return null;
  }
  function captureStateEditorScrollAnchor(tree) {
    const box = stateEditorScrollContainer(tree);
    if (!tree || !box) return null;
    const boxRect = box.getBoundingClientRect();
    const targetTop = boxRect.top + 54;
    const preferredKind = tree.dataset.stateEditorPreferredAnchorKind || "";
    const preferredPath = tree.dataset.stateEditorPreferredAnchorPath || "";
    const preserveScrollOnly = tree.dataset.stateEditorPreserveScrollOnly === "true";
    const rows = [...tree.querySelectorAll(".state-field, .state-array-item")];
    const preferred = preferredPath ? rows.map(row => {
      const token = stateEditorElementPathToken(row);
      if (!token) return null;
      if (token.kind !== preferredKind || token.path !== preferredPath) return null;
      const rect = row.getBoundingClientRect();
      return {
        ...token,
        offset: rect.top - boxRect.top,
        distance: 0,
        preferred: true
      };
    }).filter(Boolean) : [];
    const candidates = rows.map(row => {
      const token = stateEditorElementPathToken(row);
      if (!token) return null;
      const rect = row.getBoundingClientRect();
      if (rect.bottom < boxRect.top || rect.top > boxRect.bottom) return null;
      return {
        ...token,
        offset: rect.top - boxRect.top,
        distance: Math.abs(rect.top - targetTop)
      };
    }).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 8);
    delete tree.dataset.stateEditorPreferredAnchorKind;
    delete tree.dataset.stateEditorPreferredAnchorPath;
    delete tree.dataset.stateEditorPreserveScrollOnly;
    return {
      scrollContainer: box === tree ? "tree" : "modal",
      scrollTop: box.scrollTop || 0,
      candidates: preserveScrollOnly || preferredPath && !preferred.length ? [] : [...preferred, ...candidates]
    };
  }
  function stateEditorScrollContainer(tree) {
    if (tree && tree.scrollHeight > tree.clientHeight + 2 && getComputedStyle(tree).overflowY !== "visible") return tree;
    return $("modalBox");
  }
  function setStateEditorPreferredAnchor(tree, kind, path) {
    if (!tree || !kind || !path) return;
    tree.dataset.stateEditorPreferredAnchorKind = kind;
    tree.dataset.stateEditorPreferredAnchorPath = path;
  }
  function preserveStateEditorScrollOnly(tree) {
    if (!tree) return;
    tree.dataset.stateEditorPreserveScrollOnly = "true";
  }
  function logStateEditorScrollDebug(title, detail = {}) {
    devLog(title, {
      ...detail,
      logType: "troubleshooting"
    });
  }
  const EMBER_ADVENTURES_DISCORD_URL = "";
  async function requestStoryImageClassificationAttestation() {
    const accepted = await showConfirm("Use This Story Image?", "Use an image suitable for a general audience, with clothed characters and no graphic content.", {
      confirmText: "Use Image",
      cancelText: "Cancel"
    });
    return accepted ? "general-audience" : null;
  }
  async function uploadLocalStoryTitleCardImage(storyId = "") {
    const template = storyTemplateById(storyId);
    if (!template) return;
    const file = await chooseLocalImageFile();
    if (!file) return;
    const classification = await requestStoryImageClassificationAttestation();
    if (!classification) return;
    try {
      const dataUrl = await dataUrlFromBlob(file);
      const image = rememberStoryTitleCardImage(storyId, {
        id: `story-title-upload-${storyId || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        source: "local upload",
        reason: "local story image upload",
        title: template.title || "Story image",
        prompt: `Uploaded story image: ${file.name || "local image"}`,
        negativePrompt: "",
        seed: 0,
        model: "upload",
        html: `<img src="${escapeHtml(dataUrl)}" alt="${escapeHtml(template.title || "Story")} uploaded story image">`,
        favorite: false,
        upload_attestation_classification: classification,
        upload_attested_by: textSlot(supabaseSignedInUser()?.id, "") || "local-user",
        upload_attested_at: new Date().toISOString(),
        upload_attestation_policy_version: true
      }, {
        setActive: false
      });
      if (image) {
        refreshStoryTitleCardSurfaces(storyId);
        showNotice("Story Image Uploaded", `${file.name || "Image"} was added to ${template.title || "this story"}'s image history.`);
      }
    } catch (err) {
      showNotice("Story Image Upload Failed", err.message || String(err));
    }
  }
  async function chooseLocalImageFile() {
    const files = await chooseImportFiles({
      accept: "image/*",
      multiple: false
    });
    return files[0] || null;
  }
  function restoreStateEditorScrollAnchor(tree, anchor) {
    const box = anchor?.scrollContainer === "tree" ? tree : stateEditorScrollContainer(tree);
    if (!tree || !box || !anchor) return;
    const findMatch = candidate => {
      const selector = candidate.kind === "item" ? "[data-state-array-item-path]" : "[data-state-path]";
      return [...tree.querySelectorAll(selector)].find(element => {
        const value = candidate.kind === "item" ? element.dataset.stateArrayItemPath : element.dataset.statePath;
        return value === candidate.path;
      });
    };
    for (const candidate of anchor.candidates || []) {
      const element = findMatch(candidate);
      const row = element?.closest?.(".state-field, .state-array-item") || element;
      if (!row) continue;
      const beforeTop = row.getBoundingClientRect().top;
      box.scrollTop += beforeTop - box.getBoundingClientRect().top - candidate.offset;
      logStateEditorScrollDebug("State editor scroll restored", {
        matched: candidate,
        scrollContainer: box === tree ? "tree" : "modal",
        previousScrollTop: anchor.scrollTop || 0,
        restoredScrollTop: box.scrollTop || 0
      });
      return;
    }
    box.scrollTop = anchor.scrollTop || 0;
    logStateEditorScrollDebug("State editor scroll restored by fallback", {
      scrollContainer: box === tree ? "tree" : "modal",
      previousScrollTop: anchor.scrollTop || 0,
      restoredScrollTop: box.scrollTop || 0,
      candidates: anchor.candidates || []
    });
  }
  const stateEditorScrollRestoreVersions = new Map();
  function restoreStateEditorScrollAnchorAfterLayout(treeOrGetter, anchor) {
    const resolveTree = () => typeof treeOrGetter === "function" ? treeOrGetter() : treeOrGetter;
    const restoreKey = resolveTree()?.id || "state-editor";
    const restoreVersion = (stateEditorScrollRestoreVersions.get(restoreKey) || 0) + 1;
    stateEditorScrollRestoreVersions.set(restoreKey, restoreVersion);
    const restoreCurrentAnchor = () => {
      if (stateEditorScrollRestoreVersions.get(restoreKey) !== restoreVersion) return;
      restoreStateEditorScrollAnchor(resolveTree(), anchor);
    };
    restoreCurrentAnchor();
    requestAnimationFrame(() => {
      if (stateEditorScrollRestoreVersions.get(restoreKey) !== restoreVersion) return;
      autosizeStateTextareas($("modalBox") || document);
      restoreCurrentAnchor();
    });
    setTimeout(() => {
      if (stateEditorScrollRestoreVersions.get(restoreKey) !== restoreVersion) return;
      autosizeStateTextareas($("modalBox") || document);
      restoreCurrentAnchor();
    }, 80);
    setTimeout(() => {
      if (stateEditorScrollRestoreVersions.get(restoreKey) !== restoreVersion) return;
      const tree = resolveTree();
      const box = anchor?.scrollContainer === "tree" ? tree : stateEditorScrollContainer(tree);
      if (!box) return;
      logStateEditorScrollDebug("State editor scroll settled after rebuild", {
        scrollContainer: box === tree ? "tree" : "modal",
        expectedScrollTop: anchor.scrollTop || 0,
        actualScrollTop: box.scrollTop || 0,
        drift: Math.round((box.scrollTop || 0) - (anchor.scrollTop || 0))
      });
    }, 1000);
  }
  document.addEventListener("input", event => {
    const field = event.target;
    if (!field?.matches?.("textarea.state-textarea")) return;
    autosizeStateTextarea(field);
    requestAnimationFrame(() => autosizeStateTextarea(field));
  });
  document.addEventListener("click", event => {
    if (!event.target?.closest?.("[data-character-story-editor]")) return;
    showNotice("Story Editor Not Available Yet", "Creating or editing a full Story is not supported in the character editor yet. For now, use chat_story for a detailed description of the setting, background, and everything that has happened up to the opening. Long descriptions are welcome there. Your character changes remain in the editor; close this notice to continue editing.");
  });
  function buildFriendlyStateEditorItem(value, path = [], depth = 0, options = {}) {
    if (path[path.length - 2] === "inventory") return buildFriendlyInventoryItemEditor(value, path, options);
    return buildFriendlyStateEditor(value, path, depth, options);
  }
  function buildFriendlyInventoryItemEditor(value, path = [], options = {}) {
    const readonly = !!options.readonly;
    const itemText = clothingItemText(value);
    const slot = isPlainObject(value) ? value.clothing_slot : "";
    const heldSlot = isPlainObject(value) ? value.held_item_slot : "";
    const itemSlot = slot || heldSlot;
    const removedBy = isPlainObject(value) ? value.removed_by : "";
    return `
                <label class="state-field">
                    <span class="state-field-name">item${itemSlot ? ` (${escapeHtml(itemSlot)})` : ""}</span>
                    <div class="state-field-control">
                        <textarea class="state-textarea" data-state-kind="string" data-state-path="${statePathAttr(isPlainObject(value) ? [...path, "item"] : path)}" rows="${stateEditorTextareaRows(itemText)}" ${readonly ? "readonly" : ""}>${escapeHtml(itemText)}</textarea>
                        ${itemSlot && !readonly ? `<div class="state-field-actions"><button type="button" class="icon-button clothing-dress" title="Dress ${escapeHtml(itemText)}" onclick="EmberAdventures.dressFriendlyInventoryItem(this)">&#8598;&#128085;</button></div>` : ""}
                    </div>
                    ${removedBy ? `<span class="hint">removed by ${escapeHtml(removedBy)}</span>` : ""}
                </label>
            `;
  }
  function isClothingSlotPath(path = []) {
    const clothingIndex = path.indexOf("clothing");
    if (clothingIndex < 0) return false;
    return validClothingSlots().includes(path[clothingIndex + 1]);
  }
  function isHeldItemSlotPath(path = []) {
    const heldIndex = path.indexOf("held_items");
    if (heldIndex < 0) return false;
    return ["right_hand", "left_hand"].includes(path[heldIndex + 1]);
  }
  function stateEditorProfileForPath(path = [], options = {}) {
    if (options.profile) return options.profile;
    if (path[0] === "character_definition" || path[0] === "game_managed_data") return "character";
    if (path[0] === "map_detail") return "map_detail";
    if (app.storyBuilder) return "template";
    return "runtime";
  }
  function shouldShowStateEditorField(path, options = {}) {
    const key = path[path.length - 1];
    const root = path[0];
    const joined = path.map(String).join(".");
    const profile = stateEditorProfileForPath(path, options);
    if (options.definitionOnly && root === "character_definition" && path[1] === "clothing") return false;
    if (profile === "story_builder") return true;
    if (options.definitionOnly && ["outfits", "starting_outfit_id"].includes(key)) return true;
    if (root === "character_definition" || root === "game_managed_data") {
      if (options.definitionOnly && root === "character_definition" && ["outfits", "starting_outfit_id"].includes(key)) return true;
      if (CHARACTER_EDITOR_HIDDEN_KEYS.has(key)) return false;
      return true;
    }
    if (profile === "map_detail") {
      return !["id", "tags", "npcs", "future_npcs", "hidden", "profile_images", "images", "image", "seed"].includes(key);
    }
    if (profile === "runtime") {
      if (runtimeStateEditorHiddenCharacterField(key)) return false;
      if (["meta", "location", "world_map", "objectives", "future_cast", "progression", "players", "recent_changes"].includes(root)) return false;
    }
    if (profile === "template") {
      if (["meta", "location", "world_map", "objectives", "future_cast", "progression", "recent_changes"].includes(root)) return false;
      if (["profile_images", "profile_images_list", "profile_image_id", "images", "image"].includes(key)) return false;
    }
    if (["player", "characters", "npc", "future_cast"].includes(root)) {
      if (CHARACTER_EDITOR_HIDDEN_KEYS.has(key)) return false;
    }
    if (root === "meta") return false;
    if (root === "location") return false;
    if (root === "world_map") return false;
    if (root === "scene" && ["objective", "party_members_present", "image_characters", "npcs_present", "image_action", "manual_clothing_off"].includes(key)) return false;
    {
      if (root === "scene" && [].includes(key)) return false;
    }
    if (joined === "objectives.active_id") return false;
    return !["voice", "image", "profile_images_list", "profile_images", "profile_image_id", "player_preferences", "story_guidance", "story_source", "starting_cast_policy", "travel_history", "locations", "active_id"].includes(key);
  }
  function runtimeStateEditorHiddenCharacterField(key = "") {
    const value = String(key || "");
    if (value.startsWith("starting_")) return true;
    return ["default_seed", "default_profile_image", "image_prompt_config", "profile_default_image_attempted_url", "profile_images", "profile_images_list", "profile_image_id", "active_outfit_id", "outfits", "voice"].includes(value);
  }
  function stateEditorInputAttributes(path, kind) {
    if (bodyStatKeys().includes(path[path.length - 1]) && kind === "number") return `type="number" step="1" min="0" max="20"`;
    if (kind !== "number") return "";
    const rule = stateNumberRule(path);
    const step = ["trust", "attraction", "affection"].includes(path[path.length - 1]) ? "0.5" : "1";
    const attrs = [`type="number"`, `step="${step}"`];
    if (rule.min != null) attrs.push(`min="${rule.min}"`);
    if (rule.max != null) attrs.push(`max="${rule.max}"`);
    return attrs.join(" ");
  }
  function bodyStatKeys() {
    return ["height"];
  }
  function defaultCharacterGenderTags() {
    return ["female", "male", "non-binary", "trans female", "trans male", "trans non-binary"];
  }
  function setFriendlyGenderField(button, value = "") {
    const field = button?.closest?.(".state-field")?.querySelector?.("[data-state-path]");
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    field.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  function stateNumberRule(path) {
    const key = path[path.length - 1];
    if (["starting_trust", "starting_attraction", "starting_affection"].includes(key)) return {
      min: 0,
      max: 10
    };
    if (bodyStatKeys().includes(key)) return {
      min: 0,
      max: 20
    };
    if (["trust", "attraction", "affection", "age", "year", "month", "day", "hour", "minute", "current_act", "index"].includes(key)) return {
      min: 0,
      max: ["trust", "attraction", "affection"].includes(key) ? 10 : null
    };
    if (key === "boldness") return {};
    return {};
  }
  function repairAiBodyStatValue(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return Math.max(0, Math.min(20, Math.round(value)));
    }
    const text = String(value || "").trim();
    if (!text) return null;
    if (/^-?\d+$/.test(text)) return Math.max(0, Math.min(20, Number(text)));
    if (/^-?\d*\.\d+$/.test(text)) {
      return Math.max(0, Math.min(20, Math.round(Number(text))));
    }
    return text;
  }
  function parseBodyStatInput(value) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (/^-?\d+$/.test(text)) {
      const number = Number(text);
      if (number < 0 || number > 20) throw new Error("Body stat numbers must be whole numbers from 0 to 20, or a text descriptor.");
      return number;
    }
    if (/^-?\d*\.\d+$/.test(text)) throw new Error("Body stat numbers must be whole numbers from 0 to 20, or a text descriptor.");
    return text;
  }
  function repairAiBodyStatsObject(appearance = {}, options = {}) {
    if (!isPlainObject(appearance)) return appearance;
    const next = {
      ...appearance
    };
    const legacyFeatureKey = ["notable", "features"].join("_");
    const legacyCamelFeatureKey = ["notable", "Features"].join("");
    const legacyNotable = textSlot(next[legacyFeatureKey] ?? next[legacyCamelFeatureKey], "");
    delete next[legacyFeatureKey];
    delete next[legacyCamelFeatureKey];
    if (legacyNotable) {
      const currentExtra = textSlot(next.extra_description, "");
      const normalizedCurrent = normalizeNameForMatch(currentExtra);
      const normalizedLegacy = normalizeNameForMatch(legacyNotable);
      if (!currentExtra) next.extra_description = legacyNotable;else if (!normalizedCurrent.includes(normalizedLegacy)) next.extra_description = `${currentExtra}; ${legacyNotable}`;
    }
    for (const key of bodyStatKeys()) {
      if (Object.hasOwn(next, key)) next[key] = repairAiBodyStatValue(next[key]);
    }
    next.body_description = textSlot(next.body_description, "");
    next.extra_description = textSlot(next.extra_description, "");
    next.extra_description_lower_body = textSlot(next.extra_description_lower_body, "");
    next.nonhuman_lower_body = next.nonhuman_lower_body === true;
    return next;
  }
  function coerceStateEditorValue(path, kind, field) {
    if (field.dataset.forceNull === "true") return null;
    const raw = String(field.value ?? "").trim();
    if (kind === "boolean") return field.checked;
    if (["starting_trust", "starting_attraction", "starting_affection"].includes(path.at(-1))) return raw === "" ? null : Number(raw);
    if (path.at(-1) === "age") {
      if (!raw) return null;
      const age = Number(raw);
      if (!Number.isSafeInteger(age) || age < 0) throw new Error("Age must be a nonnegative whole number.");
      return age;
    }
    if (kind === "null") return raw || null;
    if (kind === "array") return raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
    if (kind === "json") return JSON.parse(raw);
    if (bodyStatKeys().includes(path[path.length - 1])) {
      return parseBodyStatInput(raw);
    }
    if (path[path.length - 1] === "boldness") {
      if (field.dataset.customDescription === "true") return exactCharacterBoldness(raw);
      return exactCharacterBoldness(raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw);
    }
    if (kind === "number") {
      const rule = stateNumberRule(path);
      const key = path[path.length - 1];
      const decimalsAllowed = ["trust", "attraction", "affection"].includes(key);
      const number = Number(raw) || 0;
      const normalized = decimalsAllowed ? number : Math.round(number);
      return Math.max(rule.min ?? -Number.MAX_SAFE_INTEGER, Math.min(rule.max ?? Number.MAX_SAFE_INTEGER, normalized));
    }
    return raw;
  }
  function nullFriendlyStateField(button) {
    const field = button?.closest?.(".state-field-control")?.querySelector?.("[data-state-path]") || button?.parentElement?.querySelector?.("[data-state-path]");
    if (!field) return;
    const tree = button?.closest?.(".state-editor-tree");
    logStateEditorScrollDebug("State editor null button clicked", {
      path: field.dataset.statePath || "",
      scrollContainer: stateEditorScrollContainer(tree) === tree ? "tree" : "modal",
      scrollTop: stateEditorScrollContainer(tree)?.scrollTop || 0
    });
    preserveStateEditorScrollOnly(tree);
    setStateEditorPreferredAnchor(tree, "field", field.dataset.statePath || "");
    field.dataset.forceNull = "true";
    if (field.type === "checkbox") field.checked = false;else field.value = "";
    button.classList.add("is-off");
    field.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    field.dispatchEvent(new Event("blur", {
      bubbles: true
    }));
    if (tree?.id) flushStateEditorAutoSave(tree.id, {
      force: true
    });
  }
  function unequipFriendlyClothingField(button) {
    const field = button?.closest?.(".state-field-control")?.querySelector?.("[data-state-path]") || button?.parentElement?.querySelector?.("[data-state-path]");
    const tree = button?.closest?.(".state-editor-tree") || $("modalBox");
    if (!field || !tree) return;
    const item = String(field.value || "").trim();
    if (!item) {
      nullFriendlyStateField(button);
      return;
    }
    logStateEditorScrollDebug("State editor clothing-off button clicked", {
      path: field.dataset.statePath || "",
      item,
      treeId: tree.id || "",
      scrollContainer: stateEditorScrollContainer(tree) === tree ? "tree" : "modal",
      scrollTop: stateEditorScrollContainer(tree)?.scrollTop || 0
    });
    preserveStateEditorScrollOnly(tree);
    setStateEditorPreferredAnchor(tree, "field", field.dataset.statePath || "");
    const marker = document.createElement("input");
    marker.type = "hidden";
    marker.dataset.stateClothingUnequipPath = field.dataset.statePath;
    marker.dataset.stateClothingUnequipItem = item;
    tree.appendChild(marker);
    field.dataset.forceNull = "true";
    field.value = "";
    button.classList.add("is-off");
    refreshFriendlyStateEditorTree(tree);
  }
  function dressFriendlyInventoryItem(button) {
    const field = button?.closest?.(".state-field-control")?.querySelector?.("[data-state-path]") || button?.parentElement?.querySelector?.("[data-state-path]");
    const item = button?.closest?.("[data-state-array-item-path]");
    const tree = button?.closest?.(".state-editor-tree") || $("modalBox");
    if (!field || !item || !tree) return;
    logStateEditorScrollDebug("State editor clothing-on button clicked", {
      path: field.dataset.statePath || "",
      itemPath: item.dataset.stateArrayItemPath || "",
      treeId: tree.id || "",
      scrollContainer: stateEditorScrollContainer(tree) === tree ? "tree" : "modal",
      scrollTop: stateEditorScrollContainer(tree)?.scrollTop || 0
    });
    preserveStateEditorScrollOnly(tree);
    setStateEditorPreferredAnchor(tree, "item", item.dataset.stateArrayItemPath || "");
    const marker = document.createElement("input");
    marker.type = "hidden";
    marker.dataset.stateInventoryDressPath = item.dataset.stateArrayItemPath;
    tree.appendChild(marker);
    refreshFriendlyStateEditorTree(tree);
  }
  function statePathAttr(path) {
    return escapeHtml(encodeURIComponent(JSON.stringify(path)));
  }
  function readFriendlyStateEditor(baseState = app.state, root = document) {
    const draft = clone(baseState || app.state);
    const container = root || document;
    for (const field of container.querySelectorAll("[data-character-editor-genres]")) draft.character_definition.genres = exactEntertainmentPreferences(JSON.parse(field.dataset.characterEditorGenres));
    container.querySelectorAll("[data-state-path]").forEach(field => {
      if (field.disabled) return;
      const path = JSON.parse(decodeURIComponent(field.dataset.statePath || "[]"));
      const kind = field.dataset.stateKind || "string";
      const value = coerceStateEditorValue(path, kind, field);
      setPathValue(draft, path, value);
    });
    container.querySelectorAll("[data-state-array-remove-path]").forEach(marker => {
      const path = JSON.parse(decodeURIComponent(marker.dataset.stateArrayRemovePath || "[]"));
      removePathValue(draft, path);
    });
    container.querySelectorAll("[data-state-array-add-path][data-state-array-pending='true']").forEach(button => {
      const path = JSON.parse(decodeURIComponent(button.dataset.stateArrayAddPath || "[]"));
      const list = getPathValue(draft, path);
      if (Array.isArray(list)) list.push(defaultArrayItemForPath(path));
    });
    container.querySelectorAll("[data-state-object-add-path][data-state-object-add-key]").forEach(marker => {
      const path = JSON.parse(decodeURIComponent(marker.dataset.stateObjectAddPath || "[]"));
      const key = String(marker.dataset.stateObjectAddKey || "").trim();
      if (!key) return;
      const target = path.length ? getPathValue(draft, path) : draft;
      if (!isPlainObject(target) || Object.hasOwn(target, key)) return;
      target[key] = defaultObjectFieldValueForPath(path, key);
    });
    container.querySelectorAll("[data-state-clothing-unequip-path]").forEach(marker => {
      const path = JSON.parse(decodeURIComponent(marker.dataset.stateClothingUnequipPath || "[]"));
      const item = marker.dataset.stateClothingUnequipItem || "";
      applyFriendlyUnequipToDraft(draft, path, item);
      marker.remove();
    });
    container.querySelectorAll("[data-state-inventory-dress-path]").forEach(marker => {
      const path = JSON.parse(decodeURIComponent(marker.dataset.stateInventoryDressPath || "[]"));
      applyFriendlyDressToDraft(draft, path);
      marker.remove();
    });
    return draft;
  }
  function friendlyEditorEntityFromPath(draft, path = []) {
    if (path[0] === "player") return {
      entity: draft.player,
      name: "Player"
    };
    if (path[0] === "characters") return {
      entity: draft.characters?.[path[1]],
      name: path[1]
    };
    if (path[0] === "npc") return {
      entity: draft.npc,
      name: draft.npc?.name || "NPC"
    };
    if (path[0] === "game_managed_data") return {
      entity: draft.game_managed_data,
      name: draft.character_definition?.name || draft.game_managed_data?.name || "Character"
    };
    if (path[0] === "character_definition") return {
      entity: draft.character_definition,
      name: draft.character_definition?.name || "Character"
    };
    return {
      entity: null,
      name: ""
    };
  }
  function applyFriendlyUnequipToDraft(draft, path = [], item = "") {
    const clothingIndex = path.indexOf("clothing");
    const heldIndex = path.indexOf("held_items");
    const isHeldItem = heldIndex >= 0;
    const slot = isHeldItem ? path[heldIndex + 1] : path[clothingIndex + 1];
    if (!slot || (isHeldItem ? !["right_hand", "left_hand"].includes(slot) : !validClothingSlots().includes(slot))) return;
    const {
      entity,
      name
    } = friendlyEditorEntityFromPath(draft, path);
    if (!entity) return;
    entity.inventory = exactInventoryList(entity.inventory);
    pushInventoryItem(entity, item, isHeldItem ? {
      held_item_slot: slot,
      removed_by: "manual"
    } : {
      clothing_slot: slot,
      removed_by: "manual"
    });
    setPathValue(draft, path, null);
    if (draft.scene && (path[0] === "player" || path[0] === "characters")) {
      draft.scene.manual_clothing_off ||= {};
      draft.scene.manual_clothing_off[name] ||= {};
      draft.scene.manual_clothing_off[name][slot] = true;
    }
  }
  function applyFriendlyDressToDraft(draft, inventoryItemPath = []) {
    const index = Number(inventoryItemPath[inventoryItemPath.length - 1]);
    if (!Number.isInteger(index)) return;
    const entityPath = inventoryItemPath.slice(0, -2);
    const {
      entity,
      name
    } = friendlyEditorEntityFromPath(draft, entityPath);
    if (!entity || !Array.isArray(entity.inventory)) return;
    const item = entity.inventory[index];
    const slot = isPlainObject(item) ? item.clothing_slot : "";
    const heldSlot = isPlainObject(item) ? item.held_item_slot : "";
    const itemText = clothingItemText(item);
    if (heldSlot) {
      if (!itemText || !["right_hand", "left_hand"].includes(heldSlot)) return;
      entity.held_items ||= {};
      const current = clothingItemText(entity.held_items[heldSlot]);
      if (current) pushInventoryItem(entity, current, {
        held_item_slot: heldSlot,
        removed_by: "manual"
      });
      entity.held_items[heldSlot] = itemText;
      entity.inventory.splice(index, 1);
      if (draft.scene && name) {
        draft.scene.manual_clothing_off ||= {};
        draft.scene.manual_clothing_off[name] ||= {};
        delete draft.scene.manual_clothing_off[name][heldSlot];
        if (!Object.keys(draft.scene.manual_clothing_off[name]).length) delete draft.scene.manual_clothing_off[name];
      }
      return;
    }
    if (!itemText || !slot || !validClothingSlots().includes(slot)) return;
    entity.clothing ||= {};
    const current = clothingItemText(entity.clothing[slot]);
    if (current) pushInventoryItem(entity, current, {
      clothing_slot: slot,
      removed_by: "manual"
    });
    entity.clothing[slot] = itemText;
    entity.inventory.splice(index, 1);
    const key = name || "Player";
    if (draft.scene && (entityPath[0] === "player" || entityPath[0] === "characters")) {
      if (slot && draft.scene.manual_clothing_off?.[key]) {
        delete draft.scene.manual_clothing_off[key][slot];
      }
    }
  }
  function readFriendlyNpcEditor(current = {}, root = $("npcFriendlyEditor")) {
    const draft = completeFriendlyStateEditorSchema(readFriendlyStateEditor({
      npc: clone(current || {})
    }, root));
    return draft.npc || current || {};
  }
  const CHARACTER_EDITOR_HIDDEN_KEYS = new Set(["id", "source", "creator", "creation_tool", "image", "image_prompt_config", "profile_images", "profile_images_list", "profile_image_id", "default_profile_image", "default_seed", "seed", "outfits", "starting_outfit_id", "active_outfit_id", "voice"]);
  const CHARACTER_DEFINITION_EDITOR_KEYS = ["name", "catalog_hook", "genres", "can_die", "romanceable", "age", "gender", "role", "personality_description", "speech_style", "boldness", "appearance", "starting_relationship_to_player", "starting_trust", "starting_attraction", "starting_affection", "starting_state_of_mind", "starting_physical_state", "starting_pose", "starting_held_items", "starting_inventory", "starting_known_facts", "chat_story", "chat_opening_message", "chat_starting_location", "chat_story_template", "stats"];
  const CHARACTER_GAME_MANAGED_EDITOR_KEYS = ["relationship_to_player", "trust", "attraction", "affection", "state_of_mind", "physical_state", "pose", "clothing", "held_items", "inventory", "known_facts", "power"];
  const CHARACTER_LIBRARY_DEFINITION_EDITOR_KEYS = [...CHARACTER_DEFINITION_EDITOR_KEYS, "default_image_background", "outfits", "starting_outfit_id", "fallback_name", "fallback_outfits", "fallback_starting_outfit_id", "fallback_gender"];
  function characterEditorSectionForKey(key = "") {
    if (CHARACTER_EDITOR_HIDDEN_KEYS.has(key)) return "";
    if (CHARACTER_DEFINITION_EDITOR_KEYS.includes(key) || key.startsWith("starting_") || key.startsWith("default_")) return "character_definition";
    return "game_managed_data";
  }
  function characterDefinitionManagedSplit(entity = {}, options = {}) {
    const definition = {};
    const managed = {};
    const full = addImmutableDefinitionFields(clone(entity || {}), entity?.name || options.entityLabel || "");
    for (const key of CHARACTER_DEFINITION_EDITOR_KEYS) {
      if (key in full) definition[key] = clone(full[key]);
    }
    for (const key of CHARACTER_GAME_MANAGED_EDITOR_KEYS) {
      if (key in full) managed[key] = clone(full[key]);
    }
    {}
    for (const [key, value] of Object.entries(full)) {
      const section = characterEditorSectionForKey(key);
      if (!section) continue;
      const target = section === "character_definition" ? definition : managed;
      if (!(key in target)) target[key] = clone(value);
    }
    delete definition.clothing;
    if (options.npcDirectoryData) {
      managed.npc_directory_data = clone(options.npcDirectoryData);
    }
    return {
      character_definition: definition,
      game_managed_data: managed
    };
  }
  function buildCharacterDefinitionManagedEditor(entity = {}, options = {}) {
    const split = completeFriendlyStateEditorSchema(characterDefinitionManagedSplit(entity, options));
    return `
                <details class="state-branch" open>
                    <summary>Character Definition</summary>
                    <div class="state-children">
                        ${buildFriendlyStateEditorObjectChildren(split.character_definition, ["character_definition"], 1, {
      profile: "character"
    })}
                    </div>
                </details>
                <details class="state-branch" open>
                    <summary>Game Managed Data</summary>
                    <div class="state-children">
                        ${buildFriendlyStateEditorObjectChildren(split.game_managed_data, ["game_managed_data"], 1, {
      profile: "character"
    })}
                    </div>
                </details>
            `;
  }
  function characterDefinitionOnlySplit(entity = {}, options = {}) {
    const full = addImmutableDefinitionFields(clone(entity || {}), entity?.name || options.entityLabel || "");
    removeRuntimeClothingFromCharacterDefinition(full);
    if (options.readonly === true && !false) {
    }
    const definition = {};
    if (!Object.hasOwn(full, "catalog_hook")) full.catalog_hook = "";
    if (!Object.hasOwn(full, "default_image_background")) full.default_image_background = "";
    if (!Object.hasOwn(full, "chat_story")) full.chat_story = "";
    if (!Object.hasOwn(full, "chat_opening_message")) full.chat_opening_message = "";
    if (!Object.hasOwn(full, "chat_starting_location")) full.chat_starting_location = {
      label: "",
      place: "",
      activity: ""
    };
    if (!Object.hasOwn(full, "chat_story_template")) full.chat_story_template = null;
    if (!options.readonly) {
      for (const key of ["starting_known_facts"]) if (!Object.hasOwn(full, key)) full[key] = [];
    }
    for (const key of CHARACTER_LIBRARY_DEFINITION_EDITOR_KEYS) {
      if (key in full) definition[key] = clone(full[key]);
    }
    return {
      character_definition: definition
    };
  }
  function buildCharacterDefinitionOnlyEditor(entity = {}, options = {}) {
    const split = completeFriendlyStateEditorSchema(characterDefinitionOnlySplit(entity, options));
    return `
                <details class="state-branch" ${options.rootOpen === false ? "" : "open"}>
                    <summary>Character Definition</summary>
                    <div class="state-children">
                        ${buildFriendlyStateEditorObjectChildren(split.character_definition, ["character_definition"], 1, {
      profile: "character",
      definitionOnly: true,
      readonly: !!options.readonly
    })}
                    </div>
                </details>
            `;
  }
  function readCharacterDefinitionOnlyEditor(current = {}, root = document) {
    const base = characterDefinitionOnlySplit(current);
    const draft = completeFriendlyStateEditorSchema(readFriendlyStateEditor(base, root));
    const next = clone(current || {});
    for (const key of CHARACTER_GAME_MANAGED_EDITOR_KEYS) {
      delete next[key];
    }
    for (const [key, value] of Object.entries(draft.character_definition || {})) {
      if (CHARACTER_EDITOR_HIDDEN_KEYS.has(key) && key !== "outfits" && key !== "starting_outfit_id") continue;
      next[key] = value;
    }
    removeRuntimeClothingFromCharacterDefinition(next);
    if (Object.hasOwn(next, "default_image_background")) {
      if (typeof next.default_image_background !== "string") throw new Error("character.default_image_background must be text when present.");
      next.default_image_background = next.default_image_background.trim();
      if (!next.default_image_background) delete next.default_image_background;
    }
    return next;
  }
  function buildFriendlyStateEditorObjectChildren(value = {}, rootPath = [], depth = 1, options = {}) {
    const entries = Object.entries(value || {}).filter(([key]) => shouldShowStateEditorField([...rootPath, key], options));
    return entries.map(([key, child]) => buildFriendlyStateEditor(child, [...rootPath, key], depth, options)).join("") || `<p class="hint">No editable fields.</p>`;
  }
  function readCharacterDefinitionManagedEditor(current = {}, root = document) {
    const base = characterDefinitionManagedSplit(current);
    const draft = completeFriendlyStateEditorSchema(readFriendlyStateEditor(base, root));
    const next = clone(current || {});
    const clothingBefore = normalizedClothingSignature(current?.clothing);
    for (const [key, value] of Object.entries(draft.character_definition || {})) {
      if (key !== "clothing" && !CHARACTER_EDITOR_HIDDEN_KEYS.has(key)) next[key] = value;
    }
    for (const [key, value] of Object.entries(draft.game_managed_data || {})) {
      if (key === "npc_directory_data" || CHARACTER_EDITOR_HIDDEN_KEYS.has(key)) continue;
      next[key] = value;
    }
    const clothingAfter = normalizedClothingSignature(next?.clothing);
    if (next.active_outfit_id && clothingBefore !== clothingAfter) {
      // Manual clothing edits make the current outfit custom. Keep the
      // saved outfit list, but clear active_outfit_id so sanitizers do
      // not immediately reapply the previous outfit and discard typing.
      next.active_outfit_id = "";
    }
    return next;
  }
  function normalizedClothingSignature(clothing = {}) {
    return JSON.stringify(exactClothingSlots(clothing || {}));
  }
  function mergeEditorDraftChanges(previousDraft, currentValue, nextDraft) {
    if (JSON.stringify(previousDraft) === JSON.stringify(nextDraft)) return currentValue === undefined ? undefined : clone(currentValue);
    if (!isPlainObject(previousDraft) || !isPlainObject(currentValue) || !isPlainObject(nextDraft)) return nextDraft === undefined ? undefined : clone(nextDraft);
    const merged = clone(currentValue);
    const keys = new Set([...Object.keys(previousDraft), ...Object.keys(nextDraft)]);
    for (const key of keys) {
      const hadBefore = Object.prototype.hasOwnProperty.call(previousDraft, key);
      const hasNext = Object.prototype.hasOwnProperty.call(nextDraft, key);
      if (hadBefore && !hasNext) {
        delete merged[key];
        continue;
      }
      if (!hasNext) continue;
      if (nextDraft[key] === undefined) {
        delete merged[key];
        continue;
      }
      merged[key] = mergeEditorDraftChanges(previousDraft[key], currentValue?.[key], nextDraft[key]);
    }
    return merged;
  }
  function readNpcDirectoryDataFromCharacterEditor(root = document) {
    const draft = readFriendlyStateEditor({
      character_definition: {},
      game_managed_data: {}
    }, root);
    return draft.game_managed_data?.npc_directory_data || {};
  }
  function configureCharacterLibraryOutfitEditor(container) {
    for (const item of container.querySelectorAll("[data-state-array-item-path]")) {
      const path = JSON.parse(decodeURIComponent(item.dataset.stateArrayItemPath));
      if (path.length !== 3 || path[0] !== "character_definition" || path[1] !== "outfits") continue;
      const panel = item.querySelector(":scope > .state-array-child > details");
      if (!panel || panel.dataset.outfitEditor === "1") continue;
      panel.dataset.outfitEditor = "1";
      panel.open = false;
      const summary = panel.querySelector(":scope > summary");
      const children = panel.querySelector(":scope > .state-children");
      const fields = [...panel.querySelectorAll("[data-state-path]")];
      const nameField = fields.find(field => {
        const fieldPath = JSON.parse(decodeURIComponent(field.dataset.statePath));
        return fieldPath.length === 4 && fieldPath[3] === "name";
      });
      const updateName = () => {
        summary.textContent = nameField?.value || `Outfit ${Number(path[2]) + 1}`;
      };
      updateName();
      nameField?.addEventListener("input", updateName);
      for (const field of fields) {
        const fieldPath = JSON.parse(decodeURIComponent(field.dataset.statePath));
        if (fieldPath.length !== 5 || fieldPath[3] !== "clothing") continue;
        const row = field.closest(".state-field");
        const clothingPanel = row.closest("details");
        if (clothingPanel !== panel) {
          children.insertBefore(row, clothingPanel);
          if (!clothingPanel.querySelector("[data-state-path]")) clothingPanel.remove();
        }
        const textarea = document.createElement("textarea");
        textarea.className = "state-textarea";
        textarea.dataset.statePath = field.dataset.statePath;
        textarea.dataset.stateKind = "null";
        textarea.value = field.value;
        textarea.rows = 2;
        field.replaceWith(textarea);
        row.querySelector(".state-field-name").textContent = stateEditorDisplayLabel(fieldPath[4], {
          profile: "story_builder"
        });
        row.querySelector(".clothing-remove")?.remove();
        const clearButton = row.querySelector(".state-field-actions button");
        if (clearButton) {
          clearButton.textContent = "Clear";
          clearButton.title = "Empty this clothing slot";
        }
        textarea.addEventListener("input", () => {
          delete textarea.dataset.forceNull;
          clearButton?.classList.toggle("is-off", !textarea.value.trim());
        });
      }
      const removeButton = item.querySelector(":scope > button");
      if (removeButton) {
        removeButton.textContent = "Remove outfit";
        children.append(removeButton);
      }
      panel.addEventListener("toggle", () => {
        if (panel.open) autosizeStateTextareas(panel);
      });
    }
  }
  function bindStateEditorAutoSave(containerId, saveFn, reason, errorTitle) {
    const container = $(containerId);
    if (!container) return;
    if (containerId === "characterLibraryDefinitionEditor") configureCharacterLibraryOutfitEditor(container);
    app.stateEditorAutoSaveBindings ||= new Map();
    const previous = app.stateEditorAutoSaveBindings.get(containerId);
    if (previous?.timer) clearTimeout(previous.timer);
    const binding = {
      container,
      timer: null,
      dirty: false,
      running: false,
      run() {
        if (!binding.dirty || binding.running) return false;
        clearTimeout(binding.timer);
        binding.timer = null;
        binding.running = true;
        binding.dirty = false;
        try {
          saveFn();
          binding.lastError = null;
          setStatus("Saved");
          return true;
        } catch (e) {
          binding.lastError = e;
          binding.dirty = true;
          showNotice(errorTitle || "Autosave Failed", e.message || String(e));
          return false;
        } finally {
          binding.running = false;
        }
      },
      schedule() {
        binding.dirty = true;
        clearTimeout(binding.timer);
        binding.timer = setTimeout(() => binding.run(), 900);
        setStatus("Editing");
      }
    };
    app.stateEditorAutoSaveBindings.set(containerId, binding);
    const schedule = () => binding.schedule();
    container.querySelectorAll("input, textarea, select").forEach(field => {
      const tag = field.tagName.toLowerCase();
      if (tag === "textarea") {
        autosizeStateTextarea(field);
        field.oninput = () => {
          autosizeStateTextarea(field);
          requestAnimationFrame(() => autosizeStateTextarea(field));
          schedule();
        };
        return;
      }
      if (tag === "input") field.oninput = schedule;
      field.onchange = schedule;
    });
    setTimeout(() => autosizeStateTextareas(container), 0);
  }
  function flushStateEditorAutoSave(containerId = "", options = {}) {
    const binding = app.stateEditorAutoSaveBindings?.get?.(containerId);
    if (!binding) return false;
    if (options.force !== false) binding.dirty = true;
    const saved = binding.run();
    if (options.remove === true) app.stateEditorAutoSaveBindings.delete(containerId);
    return saved;
  }
  function discardStateEditorAutoSave(containerId = "") {
    const binding = app.stateEditorAutoSaveBindings?.get?.(containerId);
    if (!binding) return;
    clearTimeout(binding.timer);
    app.stateEditorAutoSaveBindings.delete(containerId);
  }
  function bindModalAutoSave(saveFn, errorTitle = "Autosave Failed", snapshotReason = "modal edit") {
    const container = $("modalBox");
    if (!container) return;
    bindStateEditorAutoSave("modalBox", () => saveFn({
      close: false,
      snapshot: false
    }), snapshotReason, errorTitle);
  }
  function setPathValue(target, path, value) {
    if (!path.length) return;
    let cursor = target;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!isPlainObject(cursor[key]) && !Array.isArray(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    }
    cursor[path[path.length - 1]] = value;
  }
  function removePathValue(target, path) {
    if (!path.length) return;
    let cursor = target;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor?.[path[i]];
      if (cursor == null) return;
    }
    const key = path[path.length - 1];
    if (Array.isArray(cursor)) cursor.splice(Number(key), 1);else if (isPlainObject(cursor)) delete cursor[key];
  }
  function defaultArrayItemForPath(path = []) {
    const joined = path.map(String).join(".");
    const key = path[path.length - 1];
    if (joined === "messages" || joined.endsWith(".messages")) return {
      role: "assistant",
      content: "Write the next opening message."
    };
    if (joined === "objectives.items") return {
      id: `objective-${Date.now()}`,
      title: "New objective",
      type: "story",
      status: "active",
      summary: "",
      requires: [],
      exclusive_group: "",
      selectable: false,
      notes: [],
      rewards: [],
      travel_location_id: "",
      travel_location_name: ""
    };
    if (joined === "objective_rewards" || joined.endsWith(".rewards")) return storyBuilderDefaultReward("introduce_future_character");
    if (joined.endsWith(".requirements")) return {
      path: "story_inventory.value",
      op: ">=",
      value: 0
    };
    if (joined.endsWith(".next_objectives")) return {
      objective_id: "",
      requirements: []
    };
    if (joined.endsWith(".choices")) return {
      id: `choice-${Date.now()}`,
      title: "New Choice",
      summary: "",
      requirements: [],
      rewards: [],
      next_objective_id: ""
    };
    if (joined.endsWith(".outcome_routes")) return {
      id: `outcome-${Date.now()}`,
      criteria: "Describe the private outcome.",
      requirements: [],
      rewards: [],
      next_objective_id: "",
      fallback: false,
      default_mode: "always_eligible"
    };
    if (joined.endsWith(".dialogue_lines")) return "(Speaker) \"Exact line.\"";
    if (joined.endsWith(".outfits") || joined.endsWith("_outfits")) return {
      id: `outfit-${Date.now()}`,
      name: "",
      clothing: completeClothingSlotsForEditor({})
    };
    if (joined.includes("story_shops") && joined.endsWith(".items")) return {
      id: `item-${Date.now()}`,
      title: "New Item",
      description: "",
      price: 0,
      locked: false,
      requirements: [],
      purchase_rewards: [],
      on_purchase_objective: ""
    };
    if (joined.endsWith(".profile_images") || joined.endsWith(".images")) return {
      title: "Reward image",
      html: "",
      prompt: "",
      favorite: false
    };
    return "";
  }
  function storyBuilderPatchLabel(op = {}) {
    const path = String(op.path || "").replace(/^draft\.?/, "").split(".").filter(Boolean).map(part => stateEditorDisplayLabel(part, {
      profile: "story_builder"
    })).join(" / ");
    const action = {
      set: "Set",
      merge: "Update",
      append: "Add to",
      delete: "Remove"
    }[String(op.op || "").toLowerCase()] || "Change";
    return `${action} ${path || "story"}`;
  }
  function storyBuilderPatchSummary(value) {
    if (value === undefined) return "";
    if (value === null) return "Empty value";
    if (typeof value === "string") return value.length > 180 ? `${value.slice(0, 177)}...` : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (isPlainObject(value)) {
      const title = value.title || value.name || value.id;
      return title ? String(title) : `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
    }
    return "Structured value";
  }
  function renderStoryBuilderAiPatchReview(ops = null) {
    if (!Array.isArray(ops) || !ops.length) return `<p class="hint story-builder-ai-empty">No proposed changes yet.</p>`;
    return `
                <div class="story-builder-ai-review" aria-label="Proposed story changes">
                    ${ops.map((op, index) => `
                                <label class="story-builder-ai-change">
                                    <input type="checkbox" data-story-builder-patch-index="${index}" checked>
                                    <span>
                                        <strong>${escapeHtml(storyBuilderPatchLabel(op))}</strong>
                                        <small>${escapeHtml(storyBuilderPatchSummary(op.value))}</small>
                                    </span>
                                </label>
                            `).join("")}
                </div>
            `;
  }
  function storyBuilderFutureShellValue(entry = {}) {
    const value = clone(entry || {});
    delete value.full_character;
    delete value.profile_images;
    delete value.images;
    delete value.on_unlock;
    delete value.greeting;
    delete value.name;
    delete value.status;
    delete value.location_hint;
    return value;
  }
  function storyBuilderDefaultReward(type = "introduce_future_character") {
    const stateField = {
      type,
      character_id: "",
      field_path: [],
      value: ""
    };
    const outfit = {
      id: "",
      name: "",
      clothing: {}
    };
    const templates = {
      introduce_future_character: {
        type,
        character_id: "",
        npc_location_id: "",
        scene_presence: "nearby"
      },
      make_future_character_recruitable: {
        type,
        character_id: ""
      },
      promote_future_character_to_party: {
        type,
        character_id: ""
      },
      remove_character_shop_listing: {
        type,
        shop_id: "",
        character_id: ""
      },
      add_item: {
        type,
        character_id: "",
        item: "",
        quantity: 1
      },
      grant_item: {
        type,
        character_id: "",
        item: "",
        quantity: 1
      },
      add_story_item: {
        type,
        item: {
          id: "",
          name: "",
          description: "",
          quantity: 1,
          value: 0
        }
      },
      adjust_story_inventory: {
        type,
        field: "",
        amount: 0
      },
      advance_time: {
        type,
        minutes: 0
      },
      unlock_location: {
        type,
        location_id: ""
      },
      add_story_rule: {
        type,
        rule: ""
      },
      remove_story_rule: {
        type,
        rule: ""
      },
      set_state_field: stateField,
      modify_integer: {
        ...stateField,
        operation: "add",
        amount: 0
      },
      modify_number: {
        ...stateField,
        operation: "add",
        amount: 0
      },
      adjust_relationship: {
        type,
        character_id: "",
        trust: 0,
        attraction: 0,
        affection: 0
      },
      grant_outfit: {
        type,
        character_id: "",
        outfit,
        equip: false
      },
      equip_outfit: {
        type,
        character_id: "",
        outfit_id: ""
      },
      delete_outfit: {
        type,
        character_id: "",
        outfit_id: ""
      },
      delete_all_outfits: {
        type,
        character_id: ""
      },
      add_state_list_item: stateField,
      remove_state_list_item: stateField,
      kill_character: {
        type,
        character_id: "",
        death_note: "",
        ignore_can_die: false
      },
      generate_profile_image: {
        type,
        character_id: "",
        prompt: "",
        negative_prompt: ""
      },
      generate_solo_normal_image: {
        type,
        character_id: "",
        prompt: "",
        negative_prompt: ""
      },
      generate_story_image: {
        type,
        id: "",
        title: "",
        prompt: "",
        negative_prompt: ""
      },
      start_objective: {
        type,
        objective_id: ""
      },
      complete_objective: {
        type,
        objective_id: ""
      },
      complete_generated_job: {
        type,
        job_id: ""
      },
      apply_reward_bundle: {
        type,
        bundle_id: ""
      },
      apply_reward_template: {
        type,
        template_id: "",
        arguments: {}
      }
    };
    return clone(templates[type] || {
      type
    });
  }
  function storyBuilderReplaceRewardTypeField(field) {
    if (!field?.matches?.("select[data-state-path]") || !field.closest("#storyBuilderObjectiveCollectionsEditor")) return false;
    let path;
    try {
      path = JSON.parse(decodeURIComponent(field.dataset.statePath || "[]"));
    } catch {
      return false;
    }
    if (path.at(-1) !== "type" || !path.map(String).includes("rewards")) return false;
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const tree = $("storyBuilderObjectiveCollectionsEditor");
    if (!objective || !tree) return false;
    document.querySelectorAll("[data-tree-objective-field]").forEach(objectiveField => storyBuilderApplyTreeInspectorField(objectiveField, {
      persist: false,
      rerender: false
    }));
    const value = readFriendlyStateEditor(storyBuilderObjectiveCollectionsValue(objective), tree);
    setPathValue(value, path.slice(0, -1), storyBuilderDefaultReward(String(field.value || "")));
    storyBuilderApplyObjectiveCollections(objective, value);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel({
      defer: true
    });
    return true;
  }
  function defaultObjectFieldValueForPath(path = [], key = "") {
    const joined = path.map(String).join(".");
    if (joined.endsWith("locations")) return {
      id: key,
      name: key,
      label: key,
      type: "location",
      discovered: false,
      travel_enabled: false,
      summary: "",
      detail: {},
      connections: [],
      npcs: [],
      characters: {}
    };
    if (joined.endsWith("timed_events")) return {
      id: key,
      title: key,
      enabled: true,
      trigger: {
        elapsed_minutes: 0
      },
      rewards: []
    };
    if (joined.endsWith("reward_bundles")) return {
      id: key,
      title: key,
      rewards: []
    };
    if (joined.endsWith("reward_templates")) return {
      id: key,
      title: key,
      parameters: [],
      rewards: []
    };
    if (joined.endsWith("story_shops")) return {
      id: key,
      title: key,
      type: "item",
      location: "",
      npc_location_id: "",
      unlocked: true,
      items: []
    };
    if (joined.endsWith("character_shop_cost_templates")) return {
      type: "stat",
      costs: [],
      effects: []
    };
    if (joined.endsWith("stats") || joined.endsWith("world_flags") || joined.endsWith("numeric_precision")) return 0;
    return {};
  }
  function removeFriendlyStateListItem(button) {
    const item = button?.closest?.("[data-state-array-item-path]");
    const tree = button?.closest?.(".state-editor-tree");
    if (!item || !tree) return;
    const marker = document.createElement("input");
    marker.type = "hidden";
    marker.dataset.stateArrayRemovePath = item.dataset.stateArrayItemPath;
    tree.appendChild(marker);
    item.querySelectorAll("input, textarea, select, button").forEach(field => {
      if (field !== button) field.disabled = true;
    });
    item.remove();
    setTimeout(() => refreshFriendlyStateEditorTree(tree), 0);
  }
  function addFriendlyStateListItem(button) {
    if (!button) return;
    button.dataset.stateArrayPending = "true";
    const tree = button.closest(".state-editor-tree");
    setTimeout(() => refreshFriendlyStateEditorTree(tree), 0);
  }
  async function addFriendlyStateObjectField(button) {
    const tree = button?.closest?.(".state-editor-tree");
    if (!button || !tree) return;
    const path = JSON.parse(decodeURIComponent(button.dataset.stateObjectAddPath || "[]"));
    const key = await showPrompt("Add Field", "Stable field id or name?", "", {
      rows: 2,
      submitText: "Add"
    });
    if (!key) return;
    const marker = document.createElement("input");
    marker.type = "hidden";
    marker.dataset.stateObjectAddPath = encodeURIComponent(JSON.stringify(path));
    marker.dataset.stateObjectAddKey = String(key).trim();
    tree.appendChild(marker);
    refreshFriendlyStateEditorTree(tree);
  }
  async function saveLegacyStoryTemplateTreeEdit(templateId = "", tree = null) {
    const template = storyTemplateById(templateId);
    if (!template || !tree) return false;
    try {
      const candidate = {
        ...clone(template),
        state: stripRuntimeTemplateFields(readFriendlyStateEditor(template.state, tree)),
        updatedAt: new Date().toISOString()
      };
      assertValidStoryDefinition(candidate, `story template editor ${candidate.title || candidate.id}`);
      const record = validatedStoryTemplateRecord(candidate);
      assertValidStoryDefinition(record, `normalized story template editor ${record.title || record.id}`);
      await app.work.enqueueOrdered(`story-template-editor:${record.id}`, `compile story template ${record.id}`, async () => {
        await compileStoryTemplateValidationArtifact(record, {
          onProgress: message => setStatus(String(message || "Compiling story definition"))
        });
        const index = (app.storyTemplates || []).findIndex(item => String(item?.id || "") === String(record.id));
        if (index < 0) throw new Error(`Story template not found: ${record.id}.`);
        app.storyTemplates[index] = record;
        invalidateStoryLibraryVisibleTemplatesCache();
        queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, record, "story template friendly editor saved");
      });
      editStoryTemplate(record.id);
      return true;
    } catch (error) {
      reportAppIssue(error, {
        title: "Story Template Save Failed",
        type: "system",
        context: "story template friendly editor"
      });
      showNotice("Story Template Save Failed", String(error?.message || error));
      return false;
    }
  }
  function refreshFriendlyStateEditorTree(tree) {
    if (!tree) return;
    if (tree.id === "storyBuilderAnyPlayerEditor" || tree.id === "storyBuilderStructuredEditor" || tree.id === "storyBuilderObjectiveCollectionsEditor" || tree.hasAttribute("data-story-builder-future-shell")) {
      if (saveStoryBuilderVisibleFields() !== false) storyBuilderQueueAutosave();
      renderStoryBuilder();
      return;
    }
    if (tree.id === "storyBuilderStateEditor" && app.storyBuilder?.draft) {
      app.storyBuilder.draft.state = stripRuntimeTemplateFields(readFriendlyStateEditor(app.storyBuilder.draft.state, tree));
      app.storyBuilder.dirty = true;
      saveStoryBuilderDraft(false);
      renderStoryBuilder();
      return;
    }
    if (tree.id === "manualCharacterCreateEditor") {
      const scrollAnchor = captureStateEditorScrollAnchor(tree);
      const libraryMode = app.manualCharacterCreateMode === "library";
      app.manualCharacterDraft = libraryMode ? readCharacterDefinitionOnlyEditor(app.manualCharacterDraft, tree) : readCharacterDefinitionManagedEditor(app.manualCharacterDraft, tree);
      tree.innerHTML = libraryMode ? buildCharacterDefinitionOnlyEditor(app.manualCharacterDraft) : buildCharacterDefinitionManagedEditor(app.manualCharacterDraft);
      appendAuthoringSkillLink(tree);
      autosizeStateTextareas(tree);
      restoreStateEditorScrollAnchorAfterLayout(tree, scrollAnchor);
      return;
    }
    const templateId = tree.dataset.templateId;
    if (templateId) {
      void saveLegacyStoryTemplateTreeEdit(templateId, tree);
      return;
    }
    if (tree.id === "friendlyStateEditor") {
      const scrollAnchor = captureStateEditorScrollAnchor(tree);
      saveRuntimeStateEditorFromTree(tree, "state editor array edit");
      tree.innerHTML = buildFriendlyStateEditor(completeFriendlyStateEditorSchema(app.state), [], 0, {
        profile: "runtime"
      });
      bindRuntimeStateEditorAutoSave();
      autosizeStateTextareas(tree);
      restoreStateEditorScrollAnchorAfterLayout(tree, scrollAnchor);
      return;
    }
    if (tree.id === "charFriendlyEditor") {
      const name = tree.dataset.characterName || "";
      const scrollAnchor = captureStateEditorScrollAnchor(tree);
      if (name) flushOpenCharacterEditorForExport(name);
      if (name) editCharacter(name);
      restoreStateEditorScrollAnchorAfterLayout(() => $("charFriendlyEditor"), scrollAnchor);
      return;
    }
    if (tree.id === "playerFriendlyEditor") {
      const scrollAnchor = captureStateEditorScrollAnchor(tree);
      savePlayerFromModal({
        close: false
      });
      openPlayerModal();
      restoreStateEditorScrollAnchorAfterLayout(() => $("playerFriendlyEditor"), scrollAnchor);
      return;
    }
    if (tree.id === "npcFriendlyEditor") {
      const name = tree.dataset.npcName || "";
      const locationLabel = tree.dataset.npcLocation || "";
      const scrollAnchor = captureStateEditorScrollAnchor(tree);
      if (name) flushOpenCharacterEditorForExport(name, locationLabel);
      if (name) editNpc(name, locationLabel);
      restoreStateEditorScrollAnchorAfterLayout(() => $("npcFriendlyEditor"), scrollAnchor);
      return;
    }
  }
  function clearDeletedCurrentGameRuntime() {
    cancelAllGameProcesses("deleted current saved game");
    clearTimeout(app.gameAutosaveTimer);
    app.gameAutosaveTimer = null;
    app.state = clone(defaultState);
    app.messages = [];
    app.images = [];
    app.snapshots = [];
    refreshKeptImageRuntimeSet();
    assertExactMessageStorage();
    app.mainMenuOpen = true;
    render();
  }
  function openGameSavesModal(options = {}) {
    const allowDeleteCurrent = options?.allowDeleteCurrent === true;
    const saveDateLabel = (value = "") => {
      const date = new Date(value || "");
      return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
    };
    const visibleSaves = saveIndexRecords();
    const rows = visibleSaves.slice().reverse().map(save => {
      const idArg = htmlJsArg(save.saveId);
      const title = gameSaveDisplayName(save);
      const isCurrent = String(activeSaveId() || "") === String(save.saveId);
      const deleteAllowed = !isCurrent || allowDeleteCurrent;
      const currentDeletionVisible = isCurrent && allowDeleteCurrent;
      const deleteArg = allowDeleteCurrent ? `{allowCurrent:true,fromRevisit:true}` : `{}`;
      const titleImageHtml = imageHtmlToString(save.titleImageHtml || "");
      const titleImageMarkup = titleImageHtml ? titleImageHtml.replace("<img ", '<img class="profile-image-thumb" ') : `<div class="profile-image-placeholder" aria-label="No saved game image"></div>`;
      return `
                            <div class="character-card character-library-definition-card saved-game-card ${currentDeletionVisible ? "current-adventure-card" : ""}" data-saved-game-card data-save-id="${escapeHtml(save.saveId)}">
                                <div class="character-library-card-topline">
                                    <h3 class="character-name" data-library-fit-text>${escapeHtml(title)}</h3>
                                    <span>${isCurrent ? `<span class="profile-select-status ${currentDeletionVisible ? "current-adventure" : ""}">${currentDeletionVisible ? "Current Adventure" : "Current"}</span>` : ""}${""}</span>
                                </div>
                                <div class="profile-image-button character-library-definition-image" aria-label="${escapeHtml(save.titleImageAlt || title)}">
                                    <div class="profile-image-thumb-wrap">${titleImageMarkup}</div>
                                </div>
                                <div class="character-library-card-meta">
                                    <span data-library-fit-text>${escapeHtml(save.reason || "saved game")}</span>
                                </div>
                                <div class="saved-game-date-list">
                                    <span><strong>Date Created:</strong> ${escapeHtml(saveDateLabel(save.createdAt || save.at || save.updatedAt))}</span>
                                    <span><strong>Last Played:</strong> ${escapeHtml(saveDateLabel(save.updatedAt || save.at || save.createdAt))}</span>
                                </div>
                                ${""}
                                <div class="saved-game-actions">
                                    <button ${`onclick="EmberAdventures.restoreGameSave(${idArg})"`}>Restore Game</button>
                                    <button onclick="EmberAdventures.exportGameSave(${idArg})">Export</button>
                                    <button onclick="EmberAdventures.renameGameSave(${idArg})">Rename</button>
                                    <button class="danger" ${deleteAllowed ? `onclick="EmberAdventures.deleteGameSave(${idArg}, ${deleteArg})"` : "disabled title=\"You cannot delete the current game from this menu\""}>Delete</button>
                                </div>
                            </div>
                        `;
    }).join("") || `<p class="hint">No saved games match the selected content filters.</p>`;
    openModal(`
                <h2>Saved Games</h2>
                <div class="row saved-games-header-actions">
                    <p class="hint">These preserve state, chat messages, and image history so you can swap back after starting a new game.</p>
                    <button class="primary" type="button" onclick="EmberAdventures.importGameSave({allowDeleteCurrent:${allowDeleteCurrent ? "true" : "false"}})">Import Save</button>
                </div>
                <div class="row saved-games-content-filters" aria-label="Saved game content filters">
                    
                    ${""}
                    <span class="hint">${visibleSaves.length} shown</span>
                </div>
                <div class="character-library-grid card-size-large saved-games-grid">${rows}</div>
            `);
    $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
    scheduleAutosizeLibraryCardText($("modalBox"));
  }
  function findGameSaveById(id) {
    return findSaveIndexRecord(id);
  }
  async function restoreGameSave(id, options = {}) {
    let save = findGameSaveById(id);
    if (!save) return;
    const saveBundle = await fullSaveRecordForExport(save);
    const saveForGate = {
      ...(saveBundle?.index || save),
      state: saveBundle?.state,
      messages: saveBundle?.messages,
      images: saveBundle?.images,
      profileImages: saveBundle?.profileImages
    };
    if (options.skipRestoreConfirm !== true && !(await showConfirm("Restore Saved Game?", `Restore saved game: ${gameSaveDisplayName(save)}?`, {
      confirmText: "Restore"
    }))) return;
    const blockingId = beginBlockingUiAction("Loading game");
    await waitForRenderedFrame();
    try {
      clearTimeout(app.gameAutosaveTimer);
      app.gameAutosaveTimer = null;
      if (!(await saveCurrentGameBeforeRuntimeReplacement("game restore"))) return;
      save = findGameSaveById(id);
      if (!save) return;
      cancelAllGameProcesses("restoring saved game");
      app.suppressGameAutosave = true;
      try {
        const loadedSave = await loadSaveIntoRuntime(save.saveId, {
          setActive: true,
          scrollChatToBottom: true
        });
        if (!loadedSave) return;
        // Aggregate records were strictly validated before materialization. Do not
        // run a broad whole-state repair pass after load; invalid canonical data must
        // fail at the owning record boundary instead of being silently repaired.
        app.state.meta ||= {};
        app.state.meta.save_id = save.saveId;
        stampRuntimeSaveOwnership(save.saveId);
        app.mainMenuOpen = false;
        assertExactMessageStorage();
        refreshKeptImageRuntimeSet();
      } finally {
        app.suppressGameAutosave = false;
      }
      closeModal();
      render();
      continueStartupFlow();
    } finally {
      endBlockingUiAction(blockingId);
    }
  }
  async function renameGameSave(id) {
    const save = findGameSaveById(id);
    if (!save) return;
    const nextName = await showPrompt("Rename Saved Game", "Choose a clear name for this saved game.", gameSaveDisplayName(save), {
      rows: 2,
      submitText: "Rename"
    });
    if (nextName === null) return;
    const trimmed = String(nextName || "").trim();
    if (!trimmed) {
      showNotice("Name Required", "Saved game names cannot be blank.");
      return;
    }
    await writeSaveIndexRecord({
      ...save,
      name: uniqueGameSaveName(trimmed, save.saveId),
      renamedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    openGameSavesModal();
  }
  async function deleteGameSave(id, options = {}) {
    const save = findGameSaveById(id);
    if (!save) return;
    const isCurrent = String(activeSaveId() || "") === String(id);
    const allowCurrent = options?.allowCurrent === true && options?.fromRevisit === true;
    if (isCurrent && !allowCurrent) {
      showNotice("Current Game", "You cannot delete the saved game you are currently playing.");
      return;
    }
    if (!(await showConfirm("Delete Saved Game?", `${isCurrent ? "Delete the current saved game" : "Delete saved game"}: ${gameSaveDisplayName(save)}? This cannot be undone.`, {
      confirmText: "Delete",
      danger: true,
      warningText: isCurrent ? "WARNING: You are deleting your Current Adventure." : ""
    }))) return;
    await deleteSaveStorage(id);
    if (isCurrent) clearDeletedCurrentGameRuntime();
    openGameSavesModal({
      allowDeleteCurrent: !!options?.fromRevisit
    });
  }
  function openCharactersModal(initialSearch = "") {
    // Event handlers can accidentally pass PointerEvent/MouseEvent here.
    // Treat only real strings as search text so the in-game Characters search box
    // never opens with "[object PointerEvent]".
    initialSearch = typeof initialSearch === "string" ? initialSearch : "";
    const entries = Object.entries(app.state.characters || {}).map(([name, character]) => [name, character, false]);
    const cards = entries.map(([name, character, isPlayer]) => {
      const searchText = [name, character?.name, character?.gender, character?.age, character?.role, character?.speech_style, character?.relationship_to_player, character?.personality_description, entitySourceSlot(character?.source), entityCreatorSlot(character?.creator)].filter(Boolean).join(" ");
      return partyCharacterCardHtml(name, character, {
        isPlayer,
        presenceMode: "toggle",
        exportName: name,
        searchText
      });
    }).join("");
    const npcCards = renderAllNpcCardsForCharactersModal();
    openModal(`
                <label>Search characters
                    <input id="characterDirectorySearch" type="search" placeholder="Name, role, source..." oninput="EmberAdventures.filterCharactersModal(this.value)">
                </label>
                <p class="hint" id="characterDirectorySearchCount" style="margin:.35rem 0 .75rem"></p>
                <div class="stack">
                    <div class="row">
                        <button class="good" onclick="EmberAdventures.openCharacterGeneratorModal({fromCharacters:true})">Make Character With AI</button>
                        <button onclick="EmberAdventures.openManualCharacterCreateModal({fromCharacters:true})">Make Character Manually</button>
                        <button class="blue" onclick="EmberAdventures.openCastAddFromLibraryModal('party')">Add from Library</button>
                    </div>
                    <div class="character-name"><span>Party</span></div>
                    <div class="character-card-grid">${cards || `<p class="hint">No characters yet.</p>`}</div>
                    <div class="character-name" style="margin-top:.75rem"><span>NPCs</span></div>
                    <div class="character-card-grid">${npcCards}</div>
                </div>
            `, {
      title: "Characters"
    });
    $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
    bindPartyCharacterCardActions($("modalBox"));
    const searchInput = $("characterDirectorySearch");
    if (searchInput) searchInput.value = initialSearch || "";
    filterCharactersModal(initialSearch || "");
  }
  function filterCharactersModal(query = "") {
    const tokens = searchTokens(query);
    const cards = [...document.querySelectorAll("[data-character-directory-card]")];
    let visible = 0;
    for (const card of cards) {
      const show = matchesSearchTokens(card.dataset.search || "", tokens);
      card.style.display = show ? "" : "none";
      if (show) visible++;
    }
    const count = $("characterDirectorySearchCount");
    if (count) count.textContent = tokens.length ? `${visible} matching character${visible === 1 ? "" : "s"}` : `${cards.length} character${cards.length === 1 ? "" : "s"}`;
    queueFirstVisibleCastMissingProfile();
  }
  function refreshCharactersModalIfOpen() {
    // Closed modals keep their DOM for cheap reopen/cleanup, so checking
    // only for #characterDirectorySearch can reopen a stale Characters
    // modal when left-column card buttons are clicked. Only refresh the
    // directory while the modal is actually visible.
    if (!$("modal")?.classList.contains("open")) return false;
    const modalBox = $("modalBox");
    if (!modalBox?.querySelector?.("#characterDirectorySearch")) return false;
    if (app.profileImageModalRefreshInProgress) return false;
    const query = $("characterDirectorySearch")?.value || "";
    app.profileImageModalRefreshInProgress = true;
    try {
      openCharactersModal(query);
      return true;
    } finally {
      app.profileImageModalRefreshInProgress = false;
    }
  }
  function queueFirstVisibleCastMissingProfile() {
    const modalBox = $("modalBox");
    if (!$("modal")?.classList.contains("open") || !modalBox?.querySelector?.("#characterDirectorySearch")) return false;
    if (app.profileImageQueue?.length || 0 || app.profileImageQueued?.size || 0 || app.profileImageGenerating?.size || 0) return false;
    const cards = [...modalBox.querySelectorAll("[data-character-directory-card] .character-card[data-character-name]")];
    for (const card of cards) {
      const wrapper = card.closest("[data-character-directory-card]");
      if (wrapper?.style?.display === "none") continue;
      const name = card.dataset.characterName || "";
      if (!name || name === "Player") continue;
      const entity = profileEntity(name);
      if (!profileImageEntityHasOwnerIdentity(name, entity)) continue;
      const ownerKey = profileImageOwnerKey(name, entity);
      if (activeProfileImage(entity) || app.profileImageQueued?.has(ownerKey) || app.profileImageGenerating?.has(ownerKey)) continue;
      queueMissingProfileImageAfterDefaultAttempt(name, "cast browser visible", {
        allowImportSkipped: true,
        allowDuringSmoke: true
      });
      refreshProfileImageSurfaces(name);
      return true;
    }
    return false;
  }
  function runtimeCastNameExists(name = "") {
    const wanted = normalizeNameForMatch(name);
    if (!wanted) return false;
    if (normalizeNameForMatch(playerNameForPrompt(app.state)) === wanted) return true;
    if (Object.keys(app.state.characters || {}).some(existing => normalizeNameForMatch(existing) === wanted)) return true;
    return !!findNpcInDirectory(app.state.npc_directory, name)?.npc;
  }
  function uniqueRuntimeCastName(baseName = "Library Character") {
    const base = textSlot(baseName, "Library Character") || "Library Character";
    if (!runtimeCastNameExists(base)) return base;
    let index = 2;
    while (runtimeCastNameExists(`${base} ${index}`)) index++;
    return `${base} ${index}`;
  }
  function localCharacterLibraryRecordsForCast() {
    return characterLibraryRecords().filter(record => !record.publicEntry && characterLibraryRecordEntity(record));
  }
  function castLibraryPickerCardHtml(record, mode = "party") {
    const recordId = characterLibraryRecordId(record);
    const pickerMode = mode === "npc" ? "npc" : "party";
    const entity = characterLibraryChosenEntity(record) || {};
    const name = entity.name || record.name || "Unnamed Character";
    const profile = characterProfilePresentationCandidate(characterLibraryPresentationContext(record)?.entity || entity, entity.gender === "male");
    const profileHtml = profile ? profileImageInnerHtml(profile) : "";
    const meta = [entity.gender, entity.role, entitySourceSlot(entity.source || record.source)].filter(Boolean).join(" / ");
    const searchText = [name, entity.gender, entity.role, entity.species, entity.personality_description, entity.speech_style, entitySourceSlot(entity.source || record.source), entityCreatorSlot(entity.creator || record.creator)].filter(Boolean).join(" ");
    return `
                <div class="selectable-card-wrap" data-cast-library-card data-record-id="${escapeHtml(recordId)}" data-search="${escapeHtml(searchText)}">
                    <button type="button" class="character-card character-library-definition-card character-library-cast-picker-card" onclick="EmberAdventures.addCharacterFromLibrary(${htmlJsArg(recordId)}, ${htmlJsArg(pickerMode)})">
                        <span class="character-library-card-name">${escapeHtml(name)}</span>
                        <span class="profile-image-button character-library-definition-image">
                            ${profileHtml ? `<span class="profile-image-thumb-wrap">${profileHtml}</span>` : `<span class="profile-image-placeholder" aria-label="No profile image"></span>`}
                        </span>
                        <span class="character-library-card-meta">${escapeHtml(meta)}</span>
                        <span class="character-library-card-action">${pickerMode === "npc" ? "Add NPC" : "Add Party Member"}</span>
                    </button>
                </div>
            `;
  }
  function mountCastPresentationControls(root) {
    for (const card of root.querySelectorAll("[data-cast-library-card]")) {
      const record = characterLibraryRecordById(card.dataset.recordId);
      appendCharacterPresentationControl(card, record, () => setCastLibraryPickerMode(root.dataset.castLibraryPicker));
    }
  }
  function openCastAddFromLibraryModal(mode = "party") {
    const pickerMode = mode === "npc" ? "npc" : "party";
    const records = localCharacterLibraryRecordsForCast();
    const body = records.length ? records.map(record => castLibraryPickerCardHtml(record, pickerMode)).join("") : `<p class="hint">No local character definitions are available. Add characters from Character Library first.</p>`;
    const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Add from Library</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <div class="row" style="margin:.4rem 0 .75rem">
                    <button type="button" data-cast-picker-mode-button="party" class="${pickerMode === "party" ? "primary" : ""}" onclick="EmberAdventures.setCastLibraryPickerMode('party')">Party Member</button>
                    <button type="button" data-cast-picker-mode-button="npc" class="${pickerMode === "npc" ? "primary" : ""}" onclick="EmberAdventures.setCastLibraryPickerMode('npc')">NPC</button>
                </div>
                <label>Search local library
                    <input id="castLibrarySearch" type="search" placeholder="Name, role, source..." oninput="EmberAdventures.filterCastAddFromLibrary(this.value)">
                </label>
                <p class="hint" id="castLibrarySearchCount" style="margin:.35rem 0 .75rem"></p>
                <div class="character-library-grid card-size-large" data-cast-library-results>
                    ${body}
                </div>
            `);
    popup.box.setAttribute("data-cast-library-picker", pickerMode);
    popup.box.setAttribute("data-fullscreen-list-modal", "1");
    mountCastPresentationControls(popup.box);
    filterCastAddFromLibrary("");
  }
  function setCastLibraryPickerMode(mode = "party") {
    const popup = document.querySelector("[data-cast-library-picker]");
    if (!popup) return;
    const pickerMode = mode === "npc" ? "npc" : "party";
    popup.setAttribute("data-cast-library-picker", pickerMode);
    for (const button of popup.querySelectorAll("[data-cast-picker-mode-button]")) {
      button.classList.toggle("primary", button.dataset.castPickerModeButton === pickerMode);
    }
    const query = popup.querySelector("#castLibrarySearch")?.value || "";
    const records = localCharacterLibraryRecordsForCast();
    const results = popup.querySelector("[data-cast-library-results]");
    if (results) {
      results.innerHTML = records.length ? records.map(record => castLibraryPickerCardHtml(record, pickerMode)).join("") : `<p class="hint">No local character definitions are available. Add characters from Character Library first.</p>`;
    }
    mountCastPresentationControls(popup);
    filterCastAddFromLibrary(query);
  }
  function filterCastAddFromLibrary(query = "") {
    const popup = document.querySelector("[data-cast-library-picker]");
    if (!popup) return;
    const tokens = searchTokens(query);
    const cards = [...popup.querySelectorAll("[data-cast-library-card]")];
    let visible = 0;
    for (const card of cards) {
      const show = matchesSearchTokens(card.dataset.search || "", tokens);
      card.style.display = show ? "" : "none";
      if (show) visible++;
    }
    const count = popup.querySelector("#castLibrarySearchCount");
    if (count) count.textContent = tokens.length ? `${visible} matching character${visible === 1 ? "" : "s"}` : `${cards.length} character${cards.length === 1 ? "" : "s"}`;
  }
  function copyLibraryProfileImageToRuntimeCharacter(character, definition, finalName) {
    if (!character || !definition) return;
    resolveActiveProfileImageReference(definition);
    resolveActiveProfileImageReference(character);
    const sourceImage = profileImagesForEntity(definition).find(image => profileImageMatchesPresentation(image, character) && profileImageIsFinished(image)) || null;
    if (!sourceImage?.id || !profileImageIsFinished(sourceImage)) return;
    const stored = upsertProfileStoreImage({
      ...sourceImage,
      id: sourceImage.id
    }, finalName) || sourceImage;
    const entityRecord = profileImageEntityRecord(stored);
    if (!entityRecord?.id) return;
    character.profile_images = [entityRecord, ...(Array.isArray(character.profile_images) ? character.profile_images : [])].filter((item, index, all) => item?.id && all.findIndex(other => String(other.id) === String(item.id)) === index);
    character.profile_image_id = entityRecord.id;
    setLocalDefaultProfileImage(character, entityRecord.id, stored, {
      keepUrl: true,
      save: false
    });
  }
  function storyTitleCardRandomSeedEnabled(storyId = "") {
    app.storyTitleCardRandomSeedById ||= {};
    return !!app.storyTitleCardRandomSeedById[String(storyId || "")];
  }
  function setStoryTitleCardRandomSeedEnabled(storyId = "", enabled = false) {
    app.storyTitleCardRandomSeedById ||= {};
    const key = String(storyId || "");
    if (!key) return;
    if (enabled) app.storyTitleCardRandomSeedById[key] = true;else delete app.storyTitleCardRandomSeedById[key];
  }
  function saveStoryTitleCardDefaultSeed(storyId = "", seed = 0) {
    const template = storyTemplateById(storyId);
    if (!template) return 0;
    const slot = createStoryTitleCardImageSlot(template.title_card_image, template.state, template);
    const cleanSeed = parseProfileImageSeedInput(seed, exactProfileImageSeed(slot.seed, "story title image seed"), "story title image seed");
    template.title_card_image = createStoryTitleCardImageSlot({
      ...slot,
      seed: cleanSeed
    }, template.state, template);
    saveStoryTitleCardChanges(template, []);
    return cleanSeed;
  }
  function saveStoryTitleCardModel(storyId = "", model = "") {
    const template = storyTemplateById(storyId);
    if (!template) return;
    const slot = createStoryTitleCardImageSlot(template.title_card_image, template.state, template);
    template.title_card_image = createStoryTitleCardImageSlot({
      ...slot,
      model: model ? selectedImageModel(model) : app.settings.imageModel
    }, template.state, template);
    saveStoryTitleCardChanges(template, []);
    refreshStoryTitleCardSurfaces(storyId);
  }
  function saveStoryDefaultImageModel(storyId = "", model = "") {
    const template = storyTemplateById(storyId);
    if (!template) return;
    const selected = model ? selectedImageModel(model) : "";
    if (selected) template.default_image_model = selected;else delete template.default_image_model;
    template.state ||= {};
    template.state.meta ||= {};
    if (selected) template.state.meta.default_image_model = selected;else delete template.state.meta.default_image_model;
    queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, storyTemplateById(storyId) || template, "story default image style changed");
    refreshStoryLibraryTitleCardSurfaces(storyId);
    const root = document.querySelector(`[data-story-library-detail="${cssEscape(storyId)}"]`);
    if (root) {
      const info = root.querySelector(".character-library-definition-info");
      const normalized = storyTemplateById(storyId);
      if (info && normalized) info.outerHTML = storyLibraryInfoHtml(normalized);
    }
  }
  function storyTitleCardSeedOptionsFromModal(storyId = "", root = document) {
    const template = storyTemplateById(storyId);
    const slot = createStoryTitleCardImageSlot(template?.title_card_image, template?.state, template);
    const randomize = !!root.querySelector?.("[data-story-title-card-random-seed]")?.checked;
    const seedInput = root.querySelector?.("[data-story-title-card-seed]");
    const styleSelect = root.querySelector?.("[data-story-title-card-style]");
    const model = styleSelect?.value ? selectedImageModel(styleSelect.value) : selectedImageModel(slot.model || app.settings.imageModel);
    if (randomize) {
      setStoryTitleCardRandomSeedEnabled(storyId, true);
      return {
        randomSeed: true,
        avoidSeed: parseProfileImageSeedInput(seedInput?.value, exactProfileImageSeed(slot.seed, "story title image seed"), "story title image seed"),
        model
      };
    }
    setStoryTitleCardRandomSeedEnabled(storyId, false);
    const seed = saveStoryTitleCardDefaultSeed(storyId, seedInput?.value);
    if (seedInput) seedInput.value = String(seed);
    return {
      randomSeed: false,
      seed,
      model
    };
  }
  function characterLibraryChatPickerCardHtml(targetRecordId = "", playerRecord = {}) {
    const recordId = characterLibraryRecordId(playerRecord);
    const entity = characterLibraryChosenEntity(playerRecord) || {};
    const name = entity.name || playerRecord.name || "Unnamed Character";
    const profileEntity = characterLibraryPresentationContext(playerRecord)?.entity || clone(entity);
    const profile = localDefaultProfileImage(profileEntity) || activeProfileImage(profileEntity);
    const profileHtml = profile ? profileImageInnerHtml(profile) : "";
    const meta = [entity.gender, entity.role, entitySourceSlot(entity.source || playerRecord.source)].filter(Boolean).join(" / ");
    const searchText = [name, entity.gender, entity.role, entity.personality_description, entity.speech_style, entitySourceSlot(entity.source || playerRecord.source), entityCreatorSlot(entity.creator || playerRecord.creator)].filter(Boolean).join(" ");
    return `
                <div class="selectable-card-wrap" data-character-chat-player-card data-character-chat-player-id="${escapeHtml(recordId)}" data-search="${escapeHtml(searchText)}">
                    <button type="button" class="character-card character-library-definition-card character-library-cast-picker-card" onclick="EmberAdventures.startCharacterDefinitionFromChatPicker(${htmlJsArg(targetRecordId)}, ${htmlJsArg(recordId)})">
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
  async function openCharacterDefinitionChatPlayerPrompt(recordId = "") {
    const record = characterLibraryRecordById(recordId);
    const entity = characterLibraryRecordEntity(record);
    if (!record || !entity) {
      showNotice("Character Not Found", "That character definition is not available.");
      return;
    }
    openCharacterDefinitionChatPlayerPicker(recordId);
  }
  function openCharacterDefinitionChatPlayerPicker(recordId = "") {
    const targetRecord = characterLibraryRecordById(recordId);
    const targetEntity = characterLibraryRecordEntity(targetRecord);
    if (!targetRecord || !targetEntity) {
      showNotice("Character Not Found", "That character definition is not available.");
      return;
    }
    const targetKey = normalizeNameForMatch(targetRecord.name || targetEntity.name);
    const records = localCharacterLibraryRecordsForCast().filter(record => {
      const entity = characterLibraryRecordEntity(record);
      if (!entity) return false;
      if (String(characterLibraryRecordId(record)) === String(recordId)) return false;
      return normalizeNameForMatch(record.name || entity.name) !== targetKey;
    });
    const body = records.length ? records.map(record => characterLibraryChatPickerCardHtml(recordId, record)).join("") : `<p class="hint">No other local character definitions are available. Create a player character first, then use Chat again.</p>`;
    const popup = openPopupModal(`
                <div class="modal-chrome-header">
                    <strong class="modal-chrome-title">Choose Your Player</strong>
                    <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                </div>
                <p class="hint">Select or create the character you want to play as with ${escapeHtml(targetRecord.name || targetEntity.name || "this character")}.</p>
                <div class="row" style="margin:.45rem 0 .75rem">
                    <button type="button" class="good" onclick="EmberAdventures.closeContainingPopup(this); EmberAdventures.openCharacterGeneratorModal({library:true})">Make Character With AI</button>
                    <button type="button" onclick="EmberAdventures.closeContainingPopup(this); EmberAdventures.openManualCharacterCreateModal({library:true})">Make Character Manually</button>
                </div>
                <label>Search local library
                    <input id="characterChatPlayerSearch" type="search" placeholder="Name, role, source..." oninput="EmberAdventures.filterCharacterChatPlayerPicker(this.value)">
                </label>
                <p class="hint" id="characterChatPlayerSearchCount" style="margin:.35rem 0 .75rem"></p>
                <div class="character-library-grid card-size-large" data-character-chat-player-results>
                    ${body}
                </div>
            `);
    popup.box.setAttribute("data-character-chat-player-picker", recordId);
    popup.box.setAttribute("data-fullscreen-list-modal", "1");
    for (const card of popup.box.querySelectorAll("[data-character-chat-player-id]")) {
      const player = characterLibraryRecordById(card.dataset.characterChatPlayerId);
      appendCharacterPresentationControl(card, player, () => {
        closeContainingPopup(popup.box);
        openCharacterDefinitionChatPlayerPicker(recordId);
      });
    }
    filterCharacterChatPlayerPicker("");
  }
  function openCharacterChatLaunchChoice(recordId, playerRecordId) {
    const targetRecord = characterLibraryRecordById(recordId);
    const targetEntity = characterLibraryRecordEntity(targetRecord);
    if (!targetRecord || !targetEntity || !characterLibraryRecordById(playerRecordId)) return showNotice("Character Not Found", "One of the selected characters is no longer available.");
    document.querySelector("[data-character-chat-player-picker]")?.closest(".popup-modal")?.remove();
    const authoredOpening = characterChatAuthoredOpening(targetEntity);
    const embeddedStory = isPlainObject(targetEntity.chat_story_template) ? targetEntity.chat_story_template : null;
    const defaultLaunchMode = embeddedStory ? "story" : authoredOpening.hasContent ? "chat" : "custom";
    const popup = openPopupModal("");
    popup.box.dataset.characterChatLaunchChoice = "1";
    const choices = document.createElement("section");
    choices.dataset.characterChatStoryChoice = "";
    const heading = document.createElement("h3");
    heading.textContent = "How do you want to begin?";
    const input = document.createElement("input");
    input.id = "characterChatLaunchMode";
    input.type = "hidden";
    choices.append(heading, input);
    for (const [mode, label, description, available] of [["story", "Play Story", embeddedStory ? `${embeddedStory.title}: ${embeddedStory.description || "Play the authored objectives, progression, and endings."}` : "No attached story is available.", !!embeddedStory], ["chat", "Use Character Opening", "Begin with the character’s authored opening and continue freely, without the attached story’s objectives.", authoredOpening.hasContent], ["custom", "Custom Opening", "Choose your own location and opening guidance for a freeform game.", true]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = mode === "story" ? "characterChatModeStory" : mode === "chat" ? "characterChatModeChat" : "characterChatModeCustom";
      button.textContent = label;
      button.disabled = !available;
      button.onclick = () => setCharacterChatLaunchMode(mode);
      const detail = document.createElement("p");
      detail.textContent = description;
      choices.append(button, detail);
    }
    const description = document.createElement("p");
    description.id = "characterChatLaunchModeDescription";
    description.setAttribute("role", "status");
    choices.append(description);
    popup.box.appendChild(choices);
    setCharacterChatLaunchMode(defaultLaunchMode);
    const proceed = document.createElement("button");
    proceed.type = "button";
    proceed.className = "primary";
    proceed.textContent = "Continue";
    proceed.onclick = () => {
      const selected = input.value;
      closeContainingPopup(proceed);
      startCharacterDefinitionChatGame(recordId, playerRecordId, {
        launchMode: selected === "story" ? "story" : "chat",
        customOpening: selected === "custom"
      });
    };
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to Player Selection";
    back.onclick = () => {
      closeContainingPopup(back);
      openCharacterDefinitionChatPlayerPicker(recordId);
    };
    choices.append(back, proceed);
  }
  function setCharacterChatLaunchMode(mode = "chat") {
    const selected = ["story", "chat", "custom"].includes(mode) ? mode : "chat";
    const input = $("characterChatLaunchMode");
    if (input) input.value = selected;
    const chatButton = $("characterChatModeChat");
    const storyButton = $("characterChatModeStory");
    for (const [button, active] of [[chatButton, selected === "chat"], [storyButton, selected === "story"], [$("characterChatModeCustom"), selected === "custom"]]) {
      if (!button) continue;
      button.classList.toggle("primary", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    const description = $("characterChatLaunchModeDescription");
    if (description) description.textContent = selected === "story" ? "Play the complete authored story with its own opening, objectives, progression, and endings." : selected === "custom" ? "Custom Opening selected. Continue to enter your setup." : "Character Opening selected. Continue to review the authored opening.";
  }
  function startCharacterDefinitionFromChatPicker(targetRecordId = "", playerRecordId = "") {
    return openCharacterChatLaunchChoice(targetRecordId, playerRecordId);
  }
  function filterCharacterChatPlayerPicker(query = "") {
    const popup = document.querySelector("[data-character-chat-player-picker]");
    if (!popup) return;
    const tokens = searchTokens(query);
    const cards = [...popup.querySelectorAll("[data-character-chat-player-card]")];
    let visible = 0;
    for (const card of cards) {
      const show = matchesSearchTokens(card.dataset.search || "", tokens);
      card.style.display = show ? "" : "none";
      if (show) visible++;
    }
    const count = popup.querySelector("#characterChatPlayerSearchCount");
    if (count) count.textContent = tokens.length ? `${visible} matching character${visible === 1 ? "" : "s"}` : `${cards.length} character${cards.length === 1 ? "" : "s"}`;
  }
  function characterStorySavePresentation(record) {
    const context = characterLibraryPresentationContext(record);
    const entity = context?.entity;
    if (!entity) return null;
    const image = characterProfilePresentationCandidate(entity, characterPresentationUsesMaleFields(entity.gender));
    if (!image) return null;
    const html = stableImageHtmlToString(image.html || "") || imageTagForStoredSrc(image.url || image.hosted_url || "");
    return html ? {
      html,
      name: entity.name || record.name || "Character"
    } : null;
  }
  function chatTitleImageHtmlFromCharacter(entity = {}) {
    const image = localDefaultProfileImage(entity) || activeProfileImage(entity);
    return profileImageIsFinished(image) ? imageHtmlToString(image.html || "") : "";
  }
  function storySaveTitleImageHtmlFromTemplate(template = {}) {
    const image = activeStoryTitleCardImage(template) || template.title_card_image;
    const html = stableImageHtmlToString(image?.html || "");
    const url = image?.url || image?.hosted_url || "";
    return html || imageTagForStoredSrc(url);
  }
  const CHARACTER_CHAT_OPENING_LOCATIONS = Object.freeze([Object.freeze({
    id: "busy-dining-hall",
    label: "Busy Dining Hall",
    place: "a busy public dining hall filled with diners, conversation, and food service",
    activity: "sitting together at a small table in a busy public dining hall"
  }), Object.freeze({
    id: "bar-counter",
    label: "Bar Counter",
    place: "an active bar counter with stools and patrons nearby",
    activity: "sitting beside each other on stools at an active bar counter"
  }), Object.freeze({
    id: "casual-dinner",
    label: "Dinner Together (Casual)",
    place: "a casual restaurant with an informal dinner table",
    activity: "sharing a casual dinner at a small restaurant table"
  }), Object.freeze({
    id: "fancy-dinner",
    label: "Dinner Together (Fancy)",
    place: "an elegant formal restaurant with a carefully set dinner table",
    activity: "sharing a formal dinner at an elegant restaurant table"
  }), Object.freeze({
    id: "park",
    label: "Park",
    place: "a public park with a broad walking path",
    activity: "walking together along a public park path"
  }), Object.freeze({
    id: "crowded-cafe",
    label: "Crowded Cafe",
    place: "a crowded cafe with closely spaced tables and constant conversation",
    activity: "sitting together at a small table in a crowded cafe"
  }), Object.freeze({
    id: "tavern-common-room",
    label: "Tavern Common Room",
    place: "a busy tavern common room with occupied tables and an active hearth",
    activity: "sitting together in a busy tavern common room"
  }), Object.freeze({
    id: "open-air-marketplace",
    label: "Open-Air Marketplace",
    place: "a crowded open-air marketplace lined with active stalls",
    activity: "walking together through a crowded open-air marketplace"
  }), Object.freeze({
    id: "festival",
    label: "Festival",
    place: "a crowded public festival with performers, decorations, and food vendors",
    activity: "walking together through a crowded public festival"
  }), Object.freeze({
    id: "fair",
    label: "Fair",
    place: "a busy public fair with games, rides, exhibits, and vendors",
    activity: "walking together through a busy public fair"
  }), Object.freeze({
    id: "library-reading-area",
    label: "Library Reading Area",
    place: "a quiet public library reading area with shared tables",
    activity: "sitting near each other at a library reading table"
  }), Object.freeze({
    id: "museum",
    label: "Museum",
    place: "a public museum exhibition hall",
    activity: "standing together before an exhibit in a public museum"
  }), Object.freeze({
    id: "art-gallery",
    label: "Art Gallery",
    place: "a public art gallery lined with displayed works",
    activity: "standing together before a display in a public art gallery"
  }), Object.freeze({
    id: "transit-station",
    label: "Transit Station",
    place: "a busy transit station waiting area",
    activity: "waiting together in a busy transit station"
  }), Object.freeze({
    id: "training-ground",
    label: "Training Ground",
    place: "an active public training ground with practice underway",
    activity: "meeting beside an active public training ground"
  }), Object.freeze({
    id: "workplace-break-room",
    label: "Workplace Break Room",
    place: "a shared workplace break room during a scheduled break",
    activity: "sitting together in a shared workplace break room"
  }), Object.freeze({
    id: "campfire",
    label: "Campfire",
    place: "a campsite gathered around a burning campfire at night",
    activity: "sitting across from each other beside a campfire"
  }), Object.freeze({
    id: "beach",
    label: "Beach",
    place: "a public beach beside the water",
    activity: "walking together along a public beach"
  }), Object.freeze({
    id: "lakeshore",
    label: "Lakeshore",
    place: "a public lakeshore beside calm water",
    activity: "walking together along a public lakeshore"
  }), Object.freeze({
    id: "scenic-overlook",
    label: "Scenic Overlook",
    place: "a public scenic overlook with a wide unobstructed view",
    activity: "standing together at a public scenic overlook"
  }), Object.freeze({
    id: "player-living-room",
    label: "Player's Living Room",
    place: "the player's living room",
    activity: "sitting together in the player's living room"
  }), Object.freeze({
    id: "character-living-room",
    label: "Character's Living Room",
    place: "the character's living room",
    activity: "sitting together in the character's living room"
  }), Object.freeze({
    id: "player-bedroom",
    label: "Player's Bedroom",
    place: "the player's bedroom",
    activity: "together in the player's bedroom"
  }), Object.freeze({
    id: "character-bedroom",
    label: "Character's Bedroom",
    place: "the character's bedroom",
    activity: "together in the character's bedroom"
  })]);
  let pendingCharacterChatStartRequest = null;
  function characterChatOpeningLocation(locationId = "busy-dining-hall") {
    const location = CHARACTER_CHAT_OPENING_LOCATIONS.find(item => item.id === locationId);
    if (!location) throw new Error(`Unknown character-chat opening location: ${locationId}.`);
    return location;
  }
  function characterChatAuthoredOpening(character = {}) {
    const story = textSlot(character.chat_story, "");
    const openingMessage = textSlot(character.chat_opening_message, "");
    const sourceLocation = isPlainObject(character.chat_starting_location) ? character.chat_starting_location : {};
    const location = {
      label: textSlot(sourceLocation.label, ""),
      place: textSlot(sourceLocation.place, ""),
      activity: textSlot(sourceLocation.activity, "")
    };
    const hasLocation = Object.values(location).every(Boolean);
    return {
      story,
      openingMessage,
      location: hasLocation ? location : null,
      hasContent: !!(story || openingMessage || hasLocation)
    };
  }
  function exactCharacterChatOpeningSetup(input = {}) {
    if (!isPlainObject(input)) throw new Error("Character-chat opening setup must be an object.");
    const unknown = Object.keys(input).find(key => !["locationId", "customLocation", "openingGuidance", "story", "openingMessage", "location"].includes(key));
    if (unknown) throw new Error(`Character-chat opening setup.${unknown} is not an approved field.`);
    const customLocation = String(input.customLocation || "").trim();
    const openingGuidance = String(input.openingGuidance || "").trim();
    const story = String(input.story || openingGuidance).trim();
    const openingMessage = String(input.openingMessage || "").trim();
    if (isPlainObject(input.location)) {
      const location = {
        label: textSlot(input.location.label, ""),
        place: textSlot(input.location.place, ""),
        activity: textSlot(input.location.activity, "")
      };
      if (Object.values(location).every(Boolean)) return {
        id: "authored",
        ...location,
        openingGuidance,
        story,
        openingMessage
      };
    }
    if (customLocation) {
      return {
        id: "custom",
        label: customLocation,
        place: customLocation,
        activity: `together at ${customLocation}`,
        openingGuidance,
        story,
        openingMessage
      };
    }
    return {
      ...characterChatOpeningLocation(String(input.locationId || "busy-dining-hall")),
      openingGuidance,
      story,
      openingMessage
    };
  }
  function setCharacterChatCustomLocationEnabled(enabled = false) {
    const select = $("characterChatOpeningLocation");
    const wrap = $("characterChatCustomLocationWrap");
    const input = $("characterChatCustomLocation");
    if (select) select.disabled = !!enabled;
    if (wrap) {
      wrap.hidden = !enabled;
      wrap.style.display = enabled ? "" : "none";
    }
    if (input) {
      input.required = !!enabled;
      input.setCustomValidity("");
      if (enabled) input.focus();
    }
  }
  function cancelCharacterChatOpeningSetup() {
    closeModal();
  }
  function toggleCharacterChatAuthoredOpeningDetails() {
    const details = $("characterChatAuthoredOpeningDetails");
    const button = $("characterChatAuthoredOpeningShow");
    if (!details || !button) return;
    details.hidden = !details.hidden;
    details.style.display = details.hidden ? "none" : "";
    button.textContent = details.hidden ? "Show" : "Hide";
  }
  function setCharacterChatOpeningOverrideEnabled(enabled = false) {
    const controls = $("characterChatOpeningOverrideControls");
    if (!controls) return;
    controls.hidden = !enabled;
    controls.style.display = enabled ? "" : "none";
    if (enabled) setCharacterChatCustomLocationEnabled($("characterChatCustomLocationEnabled")?.checked === true);
  }
  function openCharacterChatOpeningSetupModal() {
    if (!pendingCharacterChatStartRequest) return;
    const authored = pendingCharacterChatStartRequest.options?.authoredOpening || {};
    const hasAuthored = authored.hasContent === true;
    const targetName = textSlot(pendingCharacterChatStartRequest.options?.targetName, "This character");
    const optionsHtml = CHARACTER_CHAT_OPENING_LOCATIONS.map((location, index) => `<option value="${escapeHtml(location.id)}"${index === 0 ? " selected" : ""}>${escapeHtml(location.label)}</option>`).join("");
    app.modalCloseCallback = () => {
      const request = pendingCharacterChatStartRequest;
      pendingCharacterChatStartRequest = null;
      request?.resolve(false);
    };
    const authoredLocation = authored.location ? `${authored.location.label}: ${authored.location.place}\nCurrent activity: ${authored.location.activity}` : "No authored starting location.";
    const authoredHtml = hasAuthored ? `
                    <div class="character-chat-authored-opening" data-character-chat-authored-opening="1">
                        <div class="character-chat-authored-opening-header">
                            <strong>${escapeHtml(targetName)} includes an authored opening.</strong>
                            <button id="characterChatAuthoredOpeningShow" type="button" onclick="EmberAdventures.toggleCharacterChatAuthoredOpeningDetails()">Show</button>
                        </div>
                        <div id="characterChatAuthoredOpeningDetails" class="character-chat-authored-opening-details" hidden style="display:none">
                            <div><strong>Story</strong><p>${escapeHtml(authored.story || "No authored story context.")}</p></div>
                            <div><strong>Opening Message</strong><p>${escapeHtml(authored.openingMessage || "The AI will generate the opening message.")}</p></div>
                            <div><strong>Starting Location</strong><p>${escapeHtml(authoredLocation)}</p></div>
                        </div>
                        <label class="character-chat-opening-checkbox-row">
                            <input id="characterChatOverrideAuthoredOpening" type="checkbox" onchange="EmberAdventures.setCharacterChatOpeningOverrideEnabled(this.checked)">
                            Customize instead
                        </label>
                    </div>` : "";
    openModal(`
                <h2>Set Up Your Opening</h2>
                ${authoredHtml}
                <div id="characterChatOpeningOverrideControls"${hasAuthored ? " hidden style=\"display:none\"" : ""}>
                    <p class="hint">Choose exactly where the opening begins, then optionally tell the AI what kind of opening you want.</p>
                    <label>Starting Location
                        <select id="characterChatOpeningLocation">${optionsHtml}</select>
                    </label>
                    <label class="character-chat-opening-checkbox-row">
                        <input id="characterChatCustomLocationEnabled" type="checkbox" onchange="EmberAdventures.setCharacterChatCustomLocationEnabled(this.checked)">
                        Use a custom location
                    </label>
                    <label id="characterChatCustomLocationWrap" hidden style="display:none">Custom Location
                        <textarea id="characterChatCustomLocation" rows="3" maxlength="1000" placeholder="Describe the exact place where the opening begins."></textarea>
                    </label>
                    <label style="margin-top:.6rem">Opening Guidance <span class="hint">(optional)</span>
                        <textarea id="characterChatOpeningGuidance" rows="5" maxlength="3000" placeholder="Describe the situation, tone, or kind of opening you want."></textarea>
                    </label>
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button type="button" onclick="EmberAdventures.cancelCharacterChatOpeningSetup()">Cancel</button>
                    <button class="primary" type="button" onclick="EmberAdventures.confirmCharacterChatOpeningSetup()">Start Game</button>
                </div>
            `, {
      hideClose: true
    });
    $("modalBox")?.setAttribute("data-character-chat-opening-setup", "1");
    if (pendingCharacterChatStartRequest.options?.customOpening) {
      const override = $("characterChatOverrideAuthoredOpening");
      if (override) override.checked = true;
      setCharacterChatOpeningOverrideEnabled(true);
    }
  }
  async function confirmCharacterChatOpeningSetup() {
    const request = pendingCharacterChatStartRequest;
    if (!request) return false;
    const authored = request.options?.authoredOpening || {};
    const useAuthored = authored.hasContent === true && $("characterChatOverrideAuthoredOpening")?.checked !== true;
    const customEnabled = $("characterChatCustomLocationEnabled")?.checked === true;
    const customInput = $("characterChatCustomLocation");
    const customLocation = customEnabled ? String(customInput?.value || "").trim() : "";
    if (customEnabled && !customLocation) {
      customInput?.setCustomValidity("Enter the custom starting location.");
      customInput?.reportValidity();
      return false;
    }
    const openingSetup = useAuthored ? {
      location: authored.location,
      openingGuidance: authored.story || "",
      story: authored.story || "",
      openingMessage: authored.openingMessage || ""
    } : {
      locationId: String($("characterChatOpeningLocation")?.value || "busy-dining-hall"),
      customLocation,
      openingGuidance: String($("characterChatOpeningGuidance")?.value || "").trim()
    };
    pendingCharacterChatStartRequest = null;
    app.modalCloseCallback = null;
    closeModal();
    try {
      const result = await startCharacterDefinitionChatGame(request.targetRecordId, request.playerRecordId, {
        ...request.options,
        openingSetup
      });
      request.resolve(result);
      return true;
    } catch (error) {
      request.reject(error);
      return false;
    }
  }
  function promptCharacterChatOpeningSetup(targetRecordId, playerRecordId, unusedArgument10245860, options) {
    if (pendingCharacterChatStartRequest) pendingCharacterChatStartRequest.resolve(false);
    document.querySelector("[data-character-chat-player-picker]")?.closest(".popup-modal")?.remove();
    document.querySelector("[data-character-library-detail-modal='1']")?.closest(".popup-modal")?.remove();
    closeStoryLibraryPopups();
    return new Promise((resolve, reject) => {
      pendingCharacterChatStartRequest = {
        targetRecordId,
        playerRecordId,
        options,
        resolve,
        reject
      };
      const afterHelp = () => openCharacterChatOpeningSetupModal();
      const shown = showPlayerInputHelpOnce("", {
        force: true,
        save: false,
        afterClose: afterHelp
      });
      if (!shown) afterHelp();
    });
  }
  async function startCharacterDefinitionChatGame(targetRecordId = "", playerRecordId = "", options = {}) {
    const targetRecord = characterLibraryRecordById(targetRecordId);
    const playerRecord = characterLibraryRecordById(playerRecordId);
    const targetDefinition = clone(characterLibraryChosenEntity(targetRecord) || {});
    const playerDefinition = clone(characterLibraryChosenEntity(playerRecord) || {});
    if (!targetRecord || !targetDefinition || !Object.keys(targetDefinition).length) {
      showNotice("Character Not Found", "That chat character definition is no longer available.");
      return;
    }
    if (!playerRecord || !playerDefinition || !Object.keys(playerDefinition).length) {
      showNotice("Player Required", "Choose or create a local character definition to play as first.");
      return;
    }
    const playerName = textSlot(playerDefinition.name || playerRecord.name, "Player");
    const targetName = textSlot(targetDefinition.name || targetRecord.name, "Chat Partner");
    if (normalizeNameForMatch(playerName) === normalizeNameForMatch(targetName)) {
      showNotice("Choose Another Player", "Choose a different character definition for yourself.");
      return;
    }
    const launchMode = options.launchMode === "story" ? "story" : "chat";
    const sourceStoryTemplate = isPlainObject(targetDefinition.chat_story_template) ? targetDefinition.chat_story_template : null;
    if (launchMode === "story" && !sourceStoryTemplate) {
      showNotice("Story Not Available", `${targetName} does not include an attached story. Choose Just Chat instead.`);
      return;
    }
    const boundStoryTemplate = launchMode === "story" ? characterChatStoryTemplateWithPrincipal(sourceStoryTemplate, targetDefinition) : null;
    if (boundStoryTemplate) {
      document.querySelector("[data-character-chat-player-picker]")?.closest(".popup-modal")?.remove();
      document.querySelector("[data-character-library-detail-modal='1']")?.closest(".popup-modal")?.remove();
      closeStoryLibraryPopups();
      return startStoryTemplateFromPlayerSelection(boundStoryTemplate, {
        id: textSlot(playerDefinition.id, characterLibraryRecordId(playerRecord)),
        name: playerName,
        character: clone(playerDefinition),
        libraryEntity: clone(characterLibraryRecordEntity(playerRecord) || playerDefinition),
        fromCharacterLibrary: true,
        presentationGender: supportedAdaptiveCharacterGender(playerDefinition.gender)
      }, false, characterStorySavePresentation(targetRecord));
    }
    if (!characterPresentationOverride(targetRecord)) adaptRuntimeCharacterGender(targetDefinition, `character-chat:${targetRecordId}`);
    applyCharacterLibraryPreferredVoice(targetRecord, targetDefinition);
    applyCharacterLibraryPreferredVoice(playerRecord, playerDefinition);
    const authoredOpening = characterChatAuthoredOpening(targetDefinition);
    if (!options.openingSetup && options.skipOpeningGreeting !== true) {
      return promptCharacterChatOpeningSetup(targetRecordId, playerRecordId, false, {
        ...options,
        authoredOpening,
        targetName
      });
    }
    const openingSetup = exactCharacterChatOpeningSetup(options.openingSetup || {});
    let blockingId = beginBlockingUiAction("Starting chat");
    await waitForRenderedFrame();
    try {
      const player = materializeCharacterDefinitionForRuntimeFields(playerDefinition, playerName, {
        preferStartingInventory: true
      });
      player.name = playerName;
      const partyMember = materializeCharacterForRuntime(targetDefinition, targetName, {
        allowMetadata: false,
        preferStartingInventory: true
      });
      partyMember.name = targetName;
      copyLibraryProfileImageToRuntimeCharacter(player, playerDefinition, playerName);
      copyLibraryProfileImageToRuntimeCharacter(partyMember, targetDefinition, targetName);
      const titleImageHtml = chatTitleImageHtmlFromCharacter(partyMember);
      const titleImageId = textSlot(activeProfileImage(partyMember)?.id, "");
      const chatLocationId = "character-chat-opening-location";
      const chatLocationDescription = openingSetup.place;
      const state = {
        ...clone(defaultState),
        meta: {
          ...clone(defaultState.meta || {}),
          setup_complete: true,
          title_image_html: titleImageHtml,
          title_image_alt: targetName,
          story_guidance: openingSetup.story,
          story_source: {
            mode: "character_game",
            title: `Game with ${targetName}`,
            description: `Open-ended game with ${targetName}.`
          }
        },
        location: {
          ...clone(defaultState.location || {}),
          npc_location_id: chatLocationId,
          settlement_name: "",
          specific_place: chatLocationDescription
        },
        world_map: {
          current_location_id: chatLocationId,
          focus_location_id: chatLocationId,
          locations: {
            [chatLocationId]: {
              id: chatLocationId,
              name: openingSetup.label,
              type: "place",
              scale: "site",
              parent_id: "",
              x: 0,
              y: 0,
              discovered: true,
              travel_enabled: false,
              summary: chatLocationDescription,
              detail: {},
              npcs: [],
              connections: []
            }
          }
        },
        scene: {
          ...clone(defaultState.scene || {}),
          summary: `${playerName} and ${targetName} are ${openingSetup.activity}.`,
          objective: "",
          party_members_present: [targetName],
          image_characters: [targetName],
          npcs_present: [],
          image_action: openingSetup.activity
        },
        player,
        characters: {
          [targetName]: partyMember
        },
        npc_directory: {
          locations: {
            [chatLocationId]: {
              label: openingSetup.label,
              characters: {}
            }
          }
        },
        objectives: {
          active_id: "",
          focus_id: "",
          items: [],
          pending_reward_choices: []
        },
        future_cast: {
          enabled: false,
          items: {}
        },
        story_memory: {
          world_notes: [],
          unresolved_threads: [],
          relationship_notes: [],
          rules_and_constraints: [],
          ai_private_notes: []
        },
        recent_changes: []
      };
      const openingMessages = openingSetup.openingMessage ? [{
        role: "assistant",
        speaker: targetName,
        text: resolveRuntimeMessageTemplateText(openingSetup.openingMessage, state, {
          selfCharacter: partyMember
        }),
        at: new Date().toISOString()
      }] : [];
      if (!(await saveCurrentGameBeforeRuntimeReplacement("character game start"))) return;
      cancelAllGameProcesses("starting character game");
      app.profileEntityOverrides = {};
      app.onboardingDraft = null;
      app.pendingStoryTemplateStart = null;
      resetLeftPanelForNewGame();
      await createNewActiveSave(`character game: ${targetName}`, {
        state,
        messages: openingMessages,
        images: [],
        profileImages: app.profileImages,
        snapshots: [],
        titleImageId
      });
      startOpeningSceneImageNow();
      ensureProfileImagesForAll("character game start");
      await app.work.flush(`save:${activeSaveId()}`);
      app.mainMenuOpen = false;
      document.querySelector("[data-character-chat-player-picker]")?.closest(".popup-modal")?.remove();
      document.querySelector("[data-character-library-detail-modal='1']")?.closest(".popup-modal")?.remove();
      closeStoryLibraryPopups();
      closeModal({
        ignoreCloseDestination: true
      });
      render();
      await waitForRenderedFrame();
      setStatus(`Game with ${targetName} started`);
      if (options.skipOpeningGreeting !== true) {
        endBlockingUiAction(blockingId);
        blockingId = "";
        if (openingSetup.openingMessage) readCharacterChatAuthoredOpening();else await startCharacterChatOpeningGreeting(targetName, openingSetup);
      }
    } finally {
      if (blockingId) endBlockingUiAction(blockingId);
    }
  }
  function readCharacterChatAuthoredOpening() {
    if (!app.settings.autoVoice || voiceIsPaused()) return;
    const opening = (app.messages || []).find(message => message.role === "assistant");
    if (!opening?.id || app.autoVoiceStartedMessageIds.has(String(opening.id))) return;
    app.autoVoiceStartedMessageIds.add(String(opening.id));
    readMessage(opening.id, {
      sequence: false
    });
  }
  function characterChatOpeningGuidancePrompt(characterName = "the character", playerName = "the player", openingGuidance = "") {
    const guidance = String(openingGuidance || "").trim();
    if (guidance) return `\n\nUse that relationship to shape how ${characterName} behaves and speaks with ${playerName}.\n\nThe player provided this guidance for the opening:\n\n${guidance}\n\nCreate the opening scene around that guidance. Establish the location and the immediate circumstances clearly enough that the player understands where they are, what they are currently doing, and what is happening around them.\n\nYou may describe ordinary actions by ${playerName} that are needed to establish the scene, but do not make ${playerName} speak, make an important decision, or assign them thoughts or feelings.\n\nFollow the player's requested direction naturally. The opening may be longer, more active, dramatic, intimate, or conversational when the guidance calls for it. End at a point where ${playerName} can naturally respond or act.`;
    return `\n\nUse that relationship to determine how familiar, reserved, or informal ${characterName}'s greeting should be.\n\nBegin with a short paragraph establishing the immediate environment, where ${playerName} and ${characterName} are, and what they are currently doing. You may give ${playerName} an ordinary action appropriate to the location, such as eating, walking, waiting, browsing, resting, or sitting nearby.\n\nThen have ${characterName} naturally greet ${playerName} with one short spoken line. The line may be a greeting, introduction, observation, or simple question about something specific in the immediate scene.\n\nDo not make ${playerName} speak, decide anything important, or reveal thoughts or feelings. Keep the interaction casual and leave an easy opportunity for ${playerName} to respond.`;
  }
  async function startCharacterChatOpeningGreeting(targetName = "", openingSetup = {}) {
    const characterName = textSlot(targetName, firstCharacterName() || "the character");
    const playerName = playerNameForPrompt();
    const character = app.state.characters?.[characterName] || {};
    const relationship = textSlot(character.relationship_to_player || character.starting_relationship_to_player, "none");
    const setup = openingSetup;
    const guidance = characterChatOpeningGuidancePrompt(characterName, playerName, setup.openingGuidance);
    const locationDirective = setup.id === "custom" ? `The opening takes place at this exact location: ${setup.place}.` : `The opening takes place at ${setup.label}: ${setup.place}.`;
    await enqueueSceneDirective({
      text: "Begin the character chat",
      visibleText: "",
      skipUserStateCheck: true,
      source: "character_chat_opening",
      directive: `${locationDirective}\n\n${characterName}'s current relationship with ${playerName} is ${relationship}.${guidance}`
    });
  }
  function addCharacterFromLibrary(recordId = "", mode = "party") {
    const refreshCharactersAfterAdd = charactersModalOpen();
    const charactersQueryBeforeAdd = refreshCharactersAfterAdd ? $("characterDirectorySearch")?.value || "" : "";
    const charactersScrollBeforeAdd = refreshCharactersAfterAdd ? $("modalBox")?.scrollTop || 0 : 0;
    const record = characterLibraryRecordById(recordId);
    const definition = clone(characterLibraryChosenEntity(record) || {});
    if (!record || !definition || !Object.keys(definition).length) {
      showNotice("Character Not Found", "That local character definition is no longer available.");
      return;
    }
    const npcMode = mode === "npc";
    const baseName = definition.name || record.name || (npcMode ? "Library NPC" : "Library Character");
    if (activeGameHasCharacterName(baseName)) {
      showNotice("Character Already In Game", `${baseName} is already in this game. Add from Library is blocked to avoid duplicate cast members.`);
      return;
    }
    let finalName = baseName;
    definition.name = finalName;
    if (!characterPresentationOverride(record)) adaptRuntimeCharacterGender(definition, `library-add:${recordId}`);
    applyCharacterLibraryPreferredVoice(record, definition);
    finalName = textSlot(definition.name, finalName);
    const character = materializeCharacterForRuntime(definition, finalName, {
      allowMetadata: false
    });
    copyLibraryProfileImageToRuntimeCharacter(character, definition, finalName);
    app.state.scene ||= {};
    if (npcMode) {
      const location = ensureNpcDirectoryLocation(app.state, currentNpcLocationId(), currentSettlementName());
      location.characters ||= {};
      location.characters[finalName] = {
        name: finalName,
        gender: character.gender || "unspecified",
        age: repairAiAdultAge(character.age, character.name, character.role, "AI character draft"),
        role: character.role || "local",
        relationship: character.relationship_to_player || "unknown",
        note: `Added from the local Character Library.`,
        inspected: true,
        full_character: character
      };
      app.state.scene.npcs_present = [...new Set([...(app.state.scene.npcs_present || []), finalName])];
      assertRuntimeNpcReferences(app.state);
      assertRuntimeSceneReferences(app.state);
      if (!activeProfileImage(character)) queueProfileImageIfMissing(finalName, "entered scene");
    } else {
      app.state.characters ||= {};
      app.state.characters[finalName] = character;
      app.state.scene.party_members_present = [...new Set([...(app.state.scene.party_members_present || ["Player"]), finalName])];
      assertRuntimeSceneReferences(app.state);
      if (!activeProfileImage(character)) queueProfileImageIfMissing(finalName, "joined party");
    }
    scheduleActiveGameSave();
    document.querySelector("[data-cast-library-picker]")?.closest(".popup-modal")?.remove();
    render();
    if (refreshCharactersAfterAdd) {
      openCharactersModal(charactersQueryBeforeAdd);
      if ($("modalBox")) $("modalBox").scrollTop = charactersScrollBeforeAdd;
    } else {
      openCharactersModal(finalName);
    }
  }
  function openPlayerModal() {
    const p = app.state.player || {};
    app.playerEditorBaseline = clone(p);
    openModal(`
                <div id="playerFriendlyEditor" class="state-editor-tree">
                    ${buildCharacterDefinitionManagedEditor(p, {
      entityLabel: "Player"
    })}
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" onclick="EmberAdventures.generateDefaultProfileImageForCharacter('Player')">Generate Default Image</button>
                    <button class="blue" onclick="EmberAdventures.importPlayer()">Import Player</button>
                    <button onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `, {
      title: "Player"
    });
    bindModalAutoSave(savePlayerFromModal, "Player Autosave Failed", "edited player");
  }
  function savePlayerFromModal({
    close = false,
    snapshot = true
  } = {}) {
    app.state.player ||= {};
    const oldPlayerName = String(app.state.player.name || "").trim();
    const beforePlayer = clone(app.state.player);
    const previousDraft = clone(app.playerEditorBaseline || beforePlayer);
    const nextDraft = readCharacterDefinitionManagedEditor(previousDraft, $("playerFriendlyEditor"));
    app.state.player = mergeEditorDraftChanges(previousDraft, app.state.player, nextDraft);
    // SANITIZE REPLACED: player editor save only validates the player record

    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and character editor autosave smoke coverage.
    finalizeRuntimePlayerAfterEditor(oldPlayerName);
    scheduleActiveGameSave();
    deferEditorProfileRefreshIfPromptInputsChanged("Player", beforePlayer, app.state.player, "player editor closed");
    if (close) closeModal();
  }
  function syncPlayerVisualNameReferences(oldName, newName) {
    oldName = String(oldName || "").trim();
    newName = String(newName || "").trim();
    if (!oldName || !newName || oldName === newName) return;
    const oldFirstName = oldName.split(/\s+/)[0];
    const replace = value => {
      let text = String(value || "");
      for (const candidate of [oldName, oldFirstName]) {
        if (!candidate || candidate === newName) continue;
        text = text.replace(new RegExp(`\\b${escapeRegExp(candidate)}\\b`, "g"), newName);
      }
      return text;
    };
    if (app.state.scene) {
      app.state.scene.summary = replace(app.state.scene.summary);
      app.state.scene.image_action = replace(app.state.scene.image_action);
      app.state.scene.image_characters = (app.state.scene.image_characters || []).map(name => sceneNameMatches(name, oldName) ? newName : name);
      app.state.scene.party_members_present = (app.state.scene.party_members_present || []).filter(name => !sceneNameMatches(name, oldName));
      app.state.scene.npcs_present = (app.state.scene.npcs_present || []).filter(name => !sceneNameMatches(name, oldName));
    }
  }
  function editCharacter(name) {
    const c = app.state.characters[name];
    let editorBaseline = clone(c || {});
    openModal(`
                <div id="charFriendlyEditor" class="state-editor-tree" data-character-name="${escapeHtml(name)}">
                    ${buildCharacterDefinitionManagedEditor(c, {
      entityLabel: name
    })}
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" onclick="EmberAdventures.generateDefaultProfileImageForCharacter(${htmlJsArg(name)})">Generate Default Image</button>
                    <button class="danger" onclick="EmberAdventures.deleteCharacter(${htmlJsArg(name)})">Delete</button>
                    <button onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `, {
      title: `Edit ${name}`
    });
    bindStateEditorAutoSave("charFriendlyEditor", () => {
      const beforeCharacter = clone(app.state.characters[name] || c || {});
      const nextDraft = readCharacterDefinitionManagedEditor(editorBaseline, $("charFriendlyEditor"));
      const next = mergeEditorDraftChanges(editorBaseline, app.state.characters[name] || c, nextDraft);
      // SANITIZE REPLACED: character editor save only validates the edited

      // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and character editor autosave smoke coverage.
      finalizeRuntimePartyCharacterAfterEditor(name, next);
      scheduleActiveGameSave();
      deferEditorProfileRefreshIfPromptInputsChanged(name, beforeCharacter, next, "character editor closed");
      editorBaseline = clone(app.state.characters[name] || next);
    }, `edited character ${name}`, "Character Autosave Failed");
  }
  function removeRuntimeCharacter(name, options = {}) {
    if (!app.state.characters?.[name]) return false;
    delete app.state.characters[name];
    app.state.scene.party_members_present = (app.state.scene.party_members_present || []).filter(n => n !== name);
    app.state.scene.image_characters = (app.state.scene.image_characters || []).filter(n => n !== name);
    // SANITIZE REPLACED: deleting a party character should only normalize character directory and scene/speak/image references.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke and character profile import edge smoke coverage.
    assertRuntimeSceneReferences(app.state);
    if (options.save !== false) scheduleActiveGameSave();
    if (options.close !== false) closeModal();
    return true;
  }
  async function deleteCharacter(name) {
    if (!app.state.characters?.[name]) return;
    if (!(await showConfirm("Delete Character?", `Delete ${name} from this story state?`, {
      confirmText: "Delete",
      danger: true
    }))) {
      return;
    }
    removeRuntimeCharacter(name);
  }
  function mountCharacterEditorGenres(container) {
    const add = [...container.querySelectorAll("[data-state-array-add-path]")].find(button => decodeURIComponent(button.dataset.stateArrayAddPath) === JSON.stringify(["character_definition", "genres"]));
    if (!add) return;
    const branch = add.closest("details");
    const values = [...branch.querySelectorAll("[data-state-path]")].map(field => field.value);
    const section = document.createElement("div");
    section.dataset.characterEditorGenres = JSON.stringify(values);
    const heading = document.createElement("strong");
    heading.textContent = "Genres";
    const summary = document.createElement("p");
    summary.textContent = values.join(", ") || "None selected";
    const choose = document.createElement("button");
    choose.type = "button";
    choose.textContent = "Choose Genres";
    choose.onclick = () => openCharacterLibraryFilterPicker("genres", {
      selected: JSON.parse(section.dataset.characterEditorGenres),
      onApply: picked => {
        section.dataset.characterEditorGenres = JSON.stringify(picked);
        summary.textContent = picked.join(", ") || "None selected";
        section.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
    });
    section.append(heading, summary, choose);
    branch.replaceWith(section);
  }
  function mountCharacterScaleModes(container) {
    for (let field of container.querySelectorAll("[data-state-path]")) {
      const path = JSON.parse(decodeURIComponent(field.dataset.statePath));
      const key = path.at(-1);
      if (key !== "boldness" && !bodyStatKeys().includes(key)) continue;
      if (field.disabled || field.readOnly || field.dataset.scaleModeMounted) continue;
      if (field.tagName !== "TEXTAREA") {
        const textarea = document.createElement("textarea");
        for (const attribute of field.attributes) {
          if (!["type", "min", "max", "step"].includes(attribute.name)) textarea.setAttribute(attribute.name, attribute.value);
        }
        textarea.value = field.value;
        field.replaceWith(textarea);
        field = textarea;
      }
      field.classList.add("state-textarea");
      field.rows = 1;
      field.dataset.scaleModeMounted = "true";
      const mode = document.createElement("select");
      mode.setAttribute("aria-label", `${key} input mode`);
      for (const [value, label] of [["scale", "Scale"], ["custom", "Custom Description"]]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        mode.append(option);
      }
      mode.value = field.dataset.stateKind === "number" ? "scale" : "custom";
      const update = () => {
        const custom = mode.value === "custom";
        field.dataset.customDescription = String(custom);
        field.dataset.stateKind = custom ? "string" : "number";
        field.inputMode = custom ? "text" : "numeric";
        autosizeStateTextarea(field);
        requestAnimationFrame(() => autosizeStateTextarea(field));
      };
      mode.onchange = () => {
        field.value = mode.value === "custom" ? "" : key === "boldness" ? "5" : "10";
        update();
        field.focus();
      };
      update();
      field.before(mode);
      field.parentElement.style.gridTemplateColumns = "minmax(0, min(11rem, 35%)) minmax(0, 1fr) auto";
      mode.style.width = "100%";
      mode.style.minWidth = "0";
    }
  }
  function appendAuthoringSkillLink(container, kind = "character") {
    if (!container) return;
    if (kind === "character") {
      mountCharacterEditorGenres(container);
      mountCharacterScaleModes(container);
      for (const field of container.querySelectorAll("input[data-state-path], textarea[data-state-path]")) {
        if (field.type === "checkbox" || field.type === "hidden") continue;
        field.placeholder = stateEditorFieldHint(JSON.parse(decodeURIComponent(field.dataset.statePath)));
      }
    }
    if (container.querySelector("[data-authoring-skill-link]")) return;
    const link = document.createElement("a");
    link.dataset.authoringSkillLink = kind;
    link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(globalThis.__liteAuthoringGuides[kind]);
    link.download = `emberadventures-lite-${kind}-authoring.md`;
    link.textContent = kind === "story" ? "Download Story Authoring Guide" : "Download Character Authoring Guide";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    container.prepend(link);
  }
  function confirmManualCharacterDiscard(container, close) {
    const editor = container?.querySelector("#manualCharacterCreateEditor");
    if (!editor || !app.manualCharacterDraft) return false;
    if (editor.dataset.discardConfirmationPending === "true") return true;
    editor.dataset.discardConfirmationPending = "true";
    showConfirm("Discard New Character?", "Are you sure you want to close? All progress on this new character will be lost.", {
      confirmText: "Discard Character",
      cancelText: "Keep Editing",
      danger: true
    }).then(discard => {
      delete editor.dataset.discardConfirmationPending;
      if (!discard || !editor.isConnected) return;
      app.manualCharacterDraft = null;
      app.manualCharacterCreateMode = "";
      close();
    });
    return true;
  }
  function newManualLibraryCharacterDraft() {
    const timestamp = new Date().toISOString();
    const outfit = id => ({
      id,
      name: "",
      clothing: blankClothingTemplate()
    });
    return {
      version: 1,
      id: generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")),
      name: "",
      source: "Original",
      creation_tool: "EmberAdventures Character Editor",
      genres: [],
      can_die: false,
      romanceable: true,
      age: null,
      gender: "",
      role: "",
      personality_description: "",
      speech_style: "",
      boldness: 5,
      appearance: {
        ...blankAppearanceTemplate(),
        species: ""
      },
      outfits: [outfit("default")],
      starting_outfit_id: "default",
      fallback_name: "",
      fallback_outfits: [outfit("fallback-default")],
      fallback_starting_outfit_id: "fallback-default",
      starting_relationship_to_player: "",
      starting_trust: 0,
      starting_attraction: 0,
      starting_affection: 0,
      starting_state_of_mind: "",
      starting_physical_state: "",
      starting_pose: "",
      starting_held_items: {
        right_hand: null,
        left_hand: null
      },
      starting_inventory: [],
      starting_known_facts: [],
      default_seed: 0,
      image_prompt_config: {
        seed_enabled: true,
        seed: 0,
        style: "",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      },
      default_profile_image: emptyProfileImageSlot(false),
      profile_image_presentations: {
        male: emptyProfileImageSlot(true),
        non_male: emptyProfileImageSlot(false)
      },
      profile_images: {
        active_image_id: "",
        image_ids: []
      },
      images: {
        active_image_id: "",
        image_ids: []
      },
      voice: null,
      created_at: timestamp,
      updated_at: timestamp
    };
  }
  function openManualCharacterCreateModal(options = {}) {
    const draft = options.library ? newManualLibraryCharacterDraft() : blankCharacterTemplate("");
    for (const key of ["name", "role", "personality_description", "speech_style", "relationship_to_player", "state_of_mind", "physical_state", "pose", "fallback_name"]) {
      if (!options.library || Object.hasOwn(draft, key)) draft[key] = "";
    }
    draft.appearance.species = "";
    draft.age = null;
    draft.gender = "";
    if (!options.library) draft.known_facts = [];
    draft.starting_known_facts = [];
    Object.assign(draft, {
      starting_relationship_to_player: "",
      starting_trust: 0,
      starting_attraction: 0,
      starting_affection: 0,
      starting_state_of_mind: "",
      starting_physical_state: "",
      starting_pose: "",
      starting_held_items: {
        right_hand: null,
        left_hand: null
      },
      starting_inventory: [],
      starting_outfit_id: "default",
      chat_story_template: null
    });
    for (const outfit of [...draft.outfits, ...draft.fallback_outfits]) {
      outfit.name = "";
      for (const slot of Object.keys(outfit.clothing)) outfit.clothing[slot] = "";
    }
    const npcMode = options.mode === "npc" || options.npc === true;
    const libraryMode = !!options.library;
    const layeredMode = !!options.fromCharacters || !!options.layered || charactersModalOpen();
    if (!libraryMode) {
      draft.source = null;
      draft.creator = null;
    }
    app.manualCharacterCreateMode = libraryMode ? "library" : npcMode ? "npc" : "game";
    app.manualCharacterDraft = draft;
    const title = libraryMode ? "Create Character Definition" : npcMode ? "Create NPC" : "Create Party Member";
    const bodyHtml = `
                ${libraryMode ? "" : `<div class="row" style="margin-bottom:.75rem">
                              <button type="button" data-manual-character-target-button="game" class="${npcMode ? "" : "primary"}" onclick="EmberAdventures.setManualCharacterCreateTargetMode('game')">Party Member</button>
                              <button type="button" data-manual-character-target-button="npc" class="${npcMode ? "primary" : ""}" onclick="EmberAdventures.setManualCharacterCreateTargetMode('npc')">NPC</button>
                           </div>
                           <input id="manualCharacterCreateTargetMode" type="hidden" value="${npcMode ? "npc" : "game"}">`}
                <div id="manualCharacterCreateEditor" class="state-editor-tree">
                    ${libraryMode ? buildCharacterDefinitionOnlyEditor(draft, {
      entityLabel: "New Character"
    }) : buildCharacterDefinitionManagedEditor(draft, {
      entityLabel: "New Character"
    })}
                </div>
                <div class="row" style="margin-top: .8rem">
                    <button id="manualCharacterCreateSaveButton" class="primary" onclick="EmberAdventures.saveManualCharacterCreateModal()">${libraryMode ? "Save Character" : npcMode ? "Save NPC" : "Save Party Member"}</button>
                    <button onclick="${layeredMode ? "EmberAdventures.closeContainingPopup(this)" : "EmberAdventures.closeModal()"}">Cancel</button>
                </div>
            `;
    if (layeredMode) {
      const popup = openPopupModal(`
                    <div class="modal-chrome-header">
                        <strong class="modal-chrome-title">${escapeHtml(title)}</strong>
                        <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                    </div>
                    ${bodyHtml}
                `);
      appendAuthoringSkillLink($("manualCharacterCreateEditor"));
      popup.box.setAttribute("data-manual-character-create-layer", "1");
      popup.box.setAttribute("data-fullscreen-list-modal", "1");
      return;
    }
    openModal(bodyHtml, {
      title
    });
    appendAuthoringSkillLink($("manualCharacterCreateEditor"));
  }
  function setManualCharacterCreateTargetMode(mode = "game") {
    const nextMode = mode === "npc" ? "npc" : "game";
    const input = $("manualCharacterCreateTargetMode");
    if (input) input.value = nextMode;
    for (const button of document.querySelectorAll("[data-manual-character-target-button]")) {
      button.classList.toggle("primary", button.dataset.manualCharacterTargetButton === nextMode);
    }
    const saveButton = $("manualCharacterCreateSaveButton");
    if (saveButton) saveButton.textContent = nextMode === "npc" ? "Save NPC" : "Save Party Member";
    const title = $("modalTitle");
    if (title) title.textContent = nextMode === "npc" ? "Create NPC" : "Create Party Member";
  }
  function uniqueCharacterName(baseName = "New Ally", options = {}) {
    const base = textSlot(baseName, "New Ally") || "New Ally";
    if (options.library) {
      const names = new Set((app.characterDefinitions || []).map(item => item.name));
      if (!names.has(base)) return base;
      let index = 2;
      while (names.has(`${base} ${index}`)) index++;
      return `${base} ${index}`;
    }
    if (!app.state.characters?.[base]) return base;
    let index = 2;
    while (app.state.characters?.[`${base} ${index}`]) index++;
    return `${base} ${index}`;
  }
  function uniqueNpcName(baseName = "New NPC", locationId = currentNpcLocationId()) {
    const base = textSlot(baseName, "New NPC") || "New NPC";
    const location = getNpcLocation(locationId) || {
      characters: {}
    };
    const existing = new Set(Object.keys(location.characters || {}));
    if (!existing.has(base) && !findNpcInDirectory(app.state.npc_directory, base)?.npc) return base;
    let index = 2;
    while (existing.has(`${base} ${index}`) || findNpcInDirectory(app.state.npc_directory, `${base} ${index}`)?.npc) index++;
    return `${base} ${index}`;
  }
  async function saveManualCharacterCreateModal() {
    const editor = $("manualCharacterCreateEditor");
    if (!editor) return;
    const createPopup = editor.closest?.(".popup-modal");
    const libraryMode = app.manualCharacterCreateMode === "library";
    const selectedMode = !libraryMode && $("manualCharacterCreateTargetMode") ? $("manualCharacterCreateTargetMode").value : app.manualCharacterCreateMode;
    const npcMode = selectedMode === "npc";
    const draft = libraryMode ? readCharacterDefinitionOnlyEditor(app.manualCharacterDraft || blankCharacterTemplate("New Character"), editor) : readCharacterDefinitionManagedEditor(app.manualCharacterDraft || blankCharacterTemplate("New Character"), editor);
    if (!Number.isSafeInteger(draft.age) || draft.age < 0 || !draft.gender?.trim()) {
      showNotice("Age and Gender Required", "Enter an age and choose or type a gender before saving.");
      return;
    }
    if (!draft.name?.trim()) {
      showNotice("Character Name Required", "Enter a character name before saving.");
      return;
    }
    if (!libraryMode && npcMode && draft.name === "New Ally") draft.name = "New NPC";
    if (!libraryMode && !npcMode && draft.name === "New NPC") draft.name = "New Ally";
    const name = uniqueCharacterName(draft.name || "New Ally", {
      library: libraryMode
    });
    let finalName = npcMode ? uniqueNpcName(draft.name || "New NPC", currentNpcLocationId()) : name;
    draft.name = finalName;
    if (libraryMode) {
      const validation = validateCharacterDefinition(draft);
      if (!validation.ok) {
        app.manualCharacterDraft = draft;
        reportAppIssue(new Error(validation.errors.map(error => `${error.path}: ${error.message}`).join("\n")), {
          title: "Character Needs Corrections",
          context: "manual character editor",
          type: "validation"
        });
        showNotice("Character Needs Corrections", "Your draft is still open. Correct these fields, then save again:\n\n" + validation.errors.map(error => `${error.path}: ${error.message}`).join("\n"));
        return;
      }
      const creatorIdentity = selectedCreatorIdentity() || (await chooseCreatorIdentityForImport("This new character", {
        confirmText: "Create"
      }));
      if (!creatorIdentity) return;
      const record = upsertCharacterLibraryDefinition(characterLibraryRecordFromDefinition(draft, {
        creator_id: creatorIdentity.creator_id,
        creator: creatorIdentity.creator_name
      }));
      scheduleActiveGameSave();
      app.manualCharacterDraft = null;
      app.manualCharacterCreateMode = "";
      createPopup?.remove?.();
      openCharacterLibraryDetail(characterLibraryRecordId(record));
      return;
    }
    if (!textSlot(draft.id, "")) {
      draft.id = assertGeneratedIdAvailable(generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")), "manual runtime character");
    }
    if (npcMode) {
      const location = ensureNpcDirectoryLocation(app.state, currentNpcLocationId(), currentSettlementName());
      location.characters ||= {};
      location.characters[finalName] = {
        name: finalName,
        gender: draft.gender || "unspecified",
        age: repairAiAdultAge(draft.age, draft.name, draft.role, "AI character draft"),
        role: draft.role || "local",
        relationship: draft.relationship_to_player || "unknown",
        note: `Created from a character definition in this game.`,
        inspected: true,
        full_character: materializeCharacterForRuntime(draft, finalName)
      };
      app.state.scene ||= {};
      app.state.scene.npcs_present = [...new Set([...(app.state.scene.npcs_present || []), finalName])];
      assertRuntimeSceneReferences(app.state);
      scheduleActiveGameSave();
      queueProfileImageIfMissing(finalName, "entered scene");
      app.manualCharacterDraft = null;
      app.manualCharacterCreateMode = "";
      createPopup?.remove?.();
      editNpc(finalName, currentNpcLocationId());
      return;
    }
    adaptRuntimeCharacterGender(draft, `manual-party:${finalName}`);
    finalName = textSlot(draft.name, finalName);
    app.state.characters ||= {};
    app.state.characters[finalName] = materializeCharacterForRuntime(draft, finalName);
    // Manual character creation adds a current-game party character.
    // Reusable export/import data lives in Character Definition fields;
    // Game Managed Data remains playthrough-local.
    assertRuntimeSceneReferences(app.state);
    scheduleActiveGameSave();
    app.manualCharacterDraft = null;
    app.manualCharacterCreateMode = "";
    createPopup?.remove?.();
    editCharacter(finalName);
  }
  async function addCharacter() {
    openManualCharacterCreateModal();
  }
  async function addNpcFromCharacterDefinition() {
    openManualCharacterCreateModal({
      mode: "npc"
    });
  }
  function characterVoiceOptions(selected = "", gender = "", options = {}) {
    const voices = visibleVoicesForGender(gender, selected);
    const automatic = options.allowAutomatic === true && !textSlot(selected, "");
    const selectedValue = automatic ? "" : resolveCharacterVoiceName(selected, {
      gender
    }, selected);
    return `${options.allowAutomatic === true ? `<option value="" ${automatic ? "selected" : ""}>Automatic based on character gender</option>` : ""}${voices.map(voice => {
      const genderLabel = voiceGenderFromName(voice.name);
      const label = `${voice.name} (${voice.lang})${genderLabel !== "unknown" ? ` - ${genderLabel}` : ""}${isBadVoiceName(voice.name) ? " - rough" : ""}`;
      return `<option value="${escapeHtml(voice.name)}" ${voice.name === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("")}`;
  }
  function defaultPlayerVoiceOptions(selected = "", gender = "") {
    const selectedValue = defaultPlayerVoiceForGender(gender, selected);
    const voices = visibleVoicesForGender(normalizedCharacterGender(gender) === "male" ? "male" : "female", selectedValue);
    return voices.map(voice => {
      const genderLabel = voiceGenderFromName(voice.name);
      const label = `${voice.name} (${voice.lang})${genderLabel !== "unknown" ? ` - ${genderLabel}` : ""}${isBadVoiceName(voice.name) ? " - rough" : ""}`;
      return `<option value="${escapeHtml(voice.name)}" ${voice.name === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }
  function openCharacterGeneratorModal(options = {}) {
    const libraryMode = !!options.library;
    const layeredMode = !!options.fromCharacters || !!options.layered || charactersModalOpen();
    const title = "Make Character With AI";
    const bodyHtml = `
                <p class="hint">Describe the adult character, their role in the adventure, and what makes them visually distinct.</p>
                <p class="hint">${escapeHtml(aiCharacterDefinitionTimeWarningText("Making a character with AI"))}</p>
                ${libraryMode ? `<input id="generatedCharacterTargetMode" type="hidden" value="library">` : `<div class="row" style="margin-bottom:.75rem">
                              <button type="button" data-generated-character-target-button="party" class="primary" onclick="EmberAdventures.setGeneratedCharacterTargetMode('party')">Party Member</button>
                              <button type="button" data-generated-character-target-button="npc" onclick="EmberAdventures.setGeneratedCharacterTargetMode('npc')">NPC</button>
                           </div>
                           <input id="generatedCharacterTargetMode" type="hidden" value="party">`}
                <textarea id="characterPrompt" rows="7" placeholder="A charming elven duelist who knows the noble cipher and might become a rival, ally, or romance..."></textarea>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" id="generateCharacterBtn">Generate</button>
                    <button onclick="${layeredMode ? "EmberAdventures.closeContainingPopup(this)" : "EmberAdventures.closeModal()"}">Close</button>
                </div>
            `;
    if (layeredMode) {
      const popup = openPopupModal(`
                    <div class="modal-chrome-header">
                        <strong class="modal-chrome-title">${escapeHtml(title)}</strong>
                        <button type="button" class="modal-close" onclick="EmberAdventures.closeContainingPopup(this)">X</button>
                    </div>
                    ${bodyHtml}
                `);
      popup.box.setAttribute("data-character-generator-layer", "1");
      popup.box.setAttribute("data-fullscreen-list-modal", "1");
    } else {
      openModal(bodyHtml, {
        title
      });
    }
    $("generateCharacterBtn").onclick = generateCharacterFromPrompt;
  }
  function setGeneratedCharacterTargetMode(mode = "party") {
    const nextMode = mode === "npc" ? "npc" : "party";
    const input = $("generatedCharacterTargetMode");
    if (input) input.value = nextMode;
    for (const button of document.querySelectorAll("[data-generated-character-target-button]")) {
      button.classList.toggle("primary", button.dataset.generatedCharacterTargetButton === nextMode);
    }
  }
  async function generateCharacterFromPrompt() {
    const generateButton = $("generateCharacterBtn");
    const generatorPopup = generateButton?.closest?.(".popup-modal");
    const promptText = $("characterPrompt").value.trim();
    if (!promptText) return;
    const rawTargetMode = $("generatedCharacterTargetMode")?.value || "party";
    const targetMode = rawTargetMode === "library" ? "library" : rawTargetMode === "npc" ? "npc" : "party";
    const libraryMode = targetMode === "library";
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";
    if (generatorPopup) generatorPopup.remove();else closeModal();
    if (!libraryMode) {
      app.busy = true;
      setTurnStage("working", "Generating character with AI...");
      renderThread();
    } else {
      setStatus("Generating character with AI...");
    }
    const instruction = buildGeneratedCharacterAiInstruction({
      mode: "create",
      promptText
    });
    try {
      const raw = await aiText(instruction, {
        startWith: "{",
        hideStartWith: false,
        label: "generate character",
        promptEditorReplay: {
          mode: "create",
          promptText
        }
      });
      let data = parseJsonObject(raw);
      if (!data) data = parsePartialTopLevelJsonObject(raw);
      if (!data?.name || !data?.character) throw new Error("Character JSON was missing name or character.");
      if (isInvalidGeneratedPersonName(data.name)) throw new Error(`${data.name} is not a valid generated character name. Generate exactly a first and last name with no title or role words.`);
      const finalName = targetMode === "library" ? uniqueCharacterName(data.name, {
        library: true
      }) : targetMode === "npc" ? uniqueNpcName(data.name, currentSettlementName()) : uniqueRuntimeCastName(data.name);
      const duplicate = findDuplicateCharacterName(finalName, targetMode === "library" ? (app.characterDefinitions || []).map(record => record.name) : [...playerDuplicateNames(), ...Object.keys(app.state.characters || {})]);
      if (duplicate) throw new Error(`${finalName} looks too similar to existing character ${duplicate}. Generate a character with a distinct first or last name.`);
      data.name = finalName;
      data.character.name = finalName;
      const generatedCharacter = finalizeGeneratedCharacterFromAiPayload(data, data.name);
      generatedCharacter.name = data.name;
      generatedCharacter.outfits = [{
        id: "default",
        name: "Default Outfit",
        clothing: exactClothingSlots(repairAiClothingAliases(generatedCharacter.clothing || {}))
      }];
      generatedCharacter.active_outfit_id = "default";
      ensureGeneratedCharacterFallbackPresentation(generatedCharacter, data.name);
      addImmutableDefinitionFields(generatedCharacter, data.name);
      if (targetMode !== "library") {
        adaptRuntimeCharacterGender(generatedCharacter, `ai-created:${targetMode}:${data.name}`);
        data.name = textSlot(generatedCharacter.name, data.name);
      }
      // SANITIZE KEEP (boundary): generated character output is AI-created state and needs broad validation for now.
      // SANITIZE TEST: Existing AI/story-generation traces cover this boundary broadly; add a focused regression before splitting it.
      if (targetMode === "library") {
        const creatorIdentity = selectedCreatorIdentity() || (await chooseCreatorIdentityForImport("This generated character", {
          confirmText: "Save"
        }));
        if (!creatorIdentity) return;
        const generatedRecord = runtimeCharacterDefinitionRecord(data.name, generatedCharacter, creatorIdentity);
        const record = upsertCharacterLibraryDefinition(generatedRecord);
        queuePerRecordLibraryRecordsSave(CHARACTER_LIBRARY_KEY, record, "AI character definition generated");
        openCharacterLibraryDetail(characterLibraryRecordId(record));
        setStatus("Ready");
      } else if (targetMode === "npc") {
        const location = ensureNpcDirectoryLocation(app.state, currentNpcLocationId(), currentSettlementName());
        location.characters ||= {};
        location.characters[data.name] = {
          name: data.name,
          gender: generatedCharacter.gender || "unspecified",
          age: repairAiAdultAge(generatedCharacter.age, generatedCharacter.name, generatedCharacter.role, "AI generated character"),
          role: generatedCharacter.role || "local",
          relationship: generatedCharacter.relationship_to_player || "unknown",
          note: "Generated with Perchance AI in this game.",
          inspected: true,
          full_character: generatedCharacter
        };
        app.state.scene ||= {};
        app.state.scene.npcs_present = [...new Set([...(app.state.scene.npcs_present || []), data.name])];
      } else {
        app.state.scene ||= {};
        app.state.scene.party_members_present ||= [];
        app.state.characters[data.name] = generatedCharacter;
        if (!app.state.scene.party_members_present.includes(data.name)) app.state.scene.party_members_present.push(data.name);
      }
      if (!libraryMode) {
        // SANITIZE REPLACED: generated character JSON is normalized
        // before insertion; runtime insertion only touches cast/scene lists.
        // SANITIZE TEST: Covered by AI character generation contract and runtime-narrow-sanitize smoke coverage.
        if (targetMode === "npc") assertRuntimeNpcReferences(app.state);else assertRuntimeSceneReferences(app.state);
        scheduleActiveGameSave();
        queueOneOffCharacterImage(data.name, "character generated");
        addGameMessage(targetMode === "npc" ? `${data.name} has been added as an NPC.` : `${data.name} has joined the party.`, "Game");
        maybePromptSaveRuntimeCharacterToLibrary(data.name);
        setTurnStage("idle", "Ready");
      }
    } catch (e) {
      if (!libraryMode) setTurnStage("error", "Character generation failed");else setStatus("Ready");
      showNotice("Character Generation Failed", e.message || String(e));
    } finally {
      if (!libraryMode) {
        app.busy = false;
        if (app.turnStage !== "error") setTurnStage("idle", "Ready");
        renderThread();
      }
      if (generateButton?.isConnected) {
        generateButton.disabled = false;
        generateButton.textContent = "Generate";
      }
    }
  }
  function openSettingsModal() {
    loadVoices();
    app.settings.narratorVoiceName = resolveVoiceName(app.settings.narratorVoiceName, "Narrator");
    app.settings.defaultMalePlayerVoiceName = defaultPlayerVoiceForGender("male", app.settings.defaultMalePlayerVoiceName);
    app.settings.defaultNonMalePlayerVoiceName = defaultPlayerVoiceForGender("female", app.settings.defaultNonMalePlayerVoiceName);
    const voiceOptions = visibleVoices(app.settings.narratorVoiceName).map(v => `<option value="${escapeHtml(v.name)}" ${v.name === app.settings.narratorVoiceName ? "selected" : ""}>${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("");
    const defaultMalePlayerVoiceOptions = defaultPlayerVoiceOptions(app.settings.defaultMalePlayerVoiceName, "male");
    const defaultNonMalePlayerVoiceOptions = defaultPlayerVoiceOptions(app.settings.defaultNonMalePlayerVoiceName, "female");
    const adultMode = false;
    const localCodexSettingsHtml = `<label>Codex text model
                    <select id="localCodexTextModel">
                        ${Object.keys(LOCAL_CODEX_TEXT_MODELS).map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("")}
                    </select>
                </label>
                <label>Codex intelligence
                    <select id="localCodexTextEffort">
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="extra_high">Extra High</option>
                    </select>
                </label>
                <label>Local Codex bridge URL <input id="localCodexTextUrl" value="${escapeHtml(app.settings.localCodexTextUrl || defaultSettings.localCodexTextUrl)}"></label>`;
    const settingsHtml = `
                <div class="grid2">
                    <p>Developer mode is always enabled in EmberAdventuresLite.</p>
                    <label class="check-row"><input id="autoVoice" type="checkbox"> <span>Auto voice</span></label>
                    <label class="check-row"><input id="autoReadPlayerMessages" type="checkbox"> <span>Auto-read player messages</span></label>
                    <label class="check-row"><input id="readGameMessages" type="checkbox"> <span>Read game messages</span></label>
                    <label class="check-row"><input id="autoImages" type="checkbox"> <span>Auto images</span></label>
                    <label class="check-row"><input id="showImagesInChat" type="checkbox"> <span>Show images in chat</span></label>
                    <label class="check-row"><input id="showAiStatusMessages" type="checkbox"> <span>Show AI status messages</span></label>
                    <label class="check-row"><input id="showAffectionStats" type="checkbox"> <span>Show affection stats</span></label>
                    <label class="check-row"><input id="showNonEnglishVoices" type="checkbox"> <span>Show non-English voices</span></label>
                    <label>Preferred character presentation <select id="preferredCharacterGender"><option value="">Keep authored presentation</option><option value="male">Male</option><option value="female">Female</option></select></label>
                    <label class="check-row"><input id="swapAllGendersToPreferred" type="checkbox"> <span>Swap all non-player genders to preferred</span></label>
                    <label class="check-row"><input id="reducedUi" type="checkbox"> <span>Reduced UI</span></label>
                    <label>AI message length <select id="aiMessageLength"><option value="normal">Normal</option><option value="short">Short</option><option value="very_short">Very Short</option></select></label>
                    ${localCodexSettingsHtml}
                    <label class="check-row"><input id="downloadOldImagesBeforeDelete" type="checkbox"> <span>Download old images instead of only deleting them</span></label>
                    <div class="row">
                        <button type="button" onclick="EmberAdventures.downloadAllKeptImages()">Download Kept Images</button>
                    </div>
                    <label>Auto mode type <select id="autoModeType"><option value="take_player_turns">Take player turns</option><option value="player_as_npc">Player as NPC</option></select></label>
                    <label class="check-row"><input id="autoModeCompletesObjectives" type="checkbox"> <span>Auto mode completes objectives</span></label>
                    <label>State check mode <select id="stateCheckMode"><option value="groups">Groups</option><option value="all">All in one</option></select></label>
                    <label>Image mode <select id="imageMode"><option value="smart">Smart changes</option><option value="every">Every reply</option><option value="manual">Manual only</option></select></label>
                    <label>Default profile image art style
                        <select id="defaultProfileImageModel">${imageModelSelectOptionsHtml(app.settings.defaultProfileImageModel || PROFILE_IMAGE_MODEL_DEFAULT)}</select>
                    </label>
                    <label>Clear oldest non-favorite image after <input id="imageHistoryLimit" type="number" min="1" max="2000" value="${escapeHtml(app.settings.imageHistoryLimit)}"></label>
                    <label>Image request timeout (seconds) <input id="imageRequestTimeoutSeconds" type="number" min="10" max="900" value="${escapeHtml(app.settings.imageRequestTimeoutSeconds)}"></label>
                    <label class="voice-picker">
                        Narrator voice
                        <input id="narratorVoiceSearch" placeholder="Search voices">
                        <div class="select-stepper">
                            <select id="narratorVoiceName">${voiceOptions}</select>
                            <button type="button" id="narratorVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="narratorVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="narratorVoiceTest" title="Test selected narrator voice">Test</button>
                        </div>
                    </label>
                    <label class="voice-picker">
                        Default main character male voice
                        <input id="defaultMalePlayerVoiceSearch" placeholder="Search male player voices">
                        <div class="select-stepper">
                            <select id="defaultMalePlayerVoiceName">${defaultMalePlayerVoiceOptions}</select>
                            <button type="button" id="defaultMalePlayerVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="defaultMalePlayerVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="defaultMalePlayerVoiceTest" title="Test selected male player voice">Test</button>
                        </div>
                    </label>
                    <label class="voice-picker">
                        Default main character non-male voice
                        <input id="defaultNonMalePlayerVoiceSearch" placeholder="Search non-male player voices">
                        <div class="select-stepper">
                            <select id="defaultNonMalePlayerVoiceName">${defaultNonMalePlayerVoiceOptions}</select>
                            <button type="button" id="defaultNonMalePlayerVoicePrev" title="Previous voice">&#9650;</button>
                            <button type="button" id="defaultNonMalePlayerVoiceNext" title="Next voice">&#9660;</button>
                            <button type="button" id="defaultNonMalePlayerVoiceTest" title="Test selected non-male player voice">Test</button>
                        </div>
                    </label>
                </div>
                <p class="hint">Voice currently uses the browser's built-in speech synthesis, not AI voice generation. Browsers only expose voices already available to that browser or operating system; EmberAdventures cannot force a browser to download missing voices. Full characters can still override their own voice from the Characters menu.</p>
                
                <h3>Public Features</h3>
                <button type="button" onclick="EmberAdventures.openPublicPrivacyNotice()">Privacy Notice</button>
                ${""}
                ${""}
                <h3>Character Boldness</h3>
                <p class="hint">Numeric character boldness is scaled from 1-5 up to 1-10 without rewriting character state. Text boldness is used directly.</p>
                <button type="button" id="openBoldnessBtn">Edit Character Boldness Defaults</button>
                <h3>Logs</h3>
                <p class="hint">All diagnostic logging is off by default. Enabled categories write to Dev Log and the browser console.</p>
                <div class="row" style="margin-bottom:.55rem">
                    <button type="button" id="enableAllLogsBtn">Enable All Logs</button>
                    <button type="button" id="disableAllLogsBtn">Disable All Logs</button>
                </div>
                <div class="grid2">
                    <label class="check-row"><input id="logAi" type="checkbox"> <span>AI calls</span></label>
                    <label class="check-row"><input id="logState" type="checkbox"> <span>State updates</span></label>
                    <label class="check-row"><input id="logImage" type="checkbox"> <span>Image generation</span></label>
                    <label class="check-row"><input id="logVoice" type="checkbox"> <span>Voice/reader</span></label>
                    
                    <label class="check-row"><input id="logCommand" type="checkbox"> <span>AI commands</span></label>
                    <label class="check-row"><input id="logTroubleshooting" type="checkbox"> <span>Troubleshooting</span></label>
                    <label class="check-row"><input id="logStorage" type="checkbox"> <span>Storage failures</span></label>
                    <label class="check-row"><input id="logStorageMinor" type="checkbox"> <span>Storage (minor)</span></label>
                    <label class="check-row"><input id="logPerformance" type="checkbox"> <span>Performance</span></label>
                    <label class="check-row"><input id="logSystem" type="checkbox"> <span>System/debug</span></label>
                </div>
                <div class="row dev-only-tool" style="margin-top: .8rem">
                    <button onclick="EmberAdventures.openDevTraceModal()"><span class="tool-icon">&#128295;</span> Dev Log</button>
                    <button onclick="EmberAdventures.openDevSmokeSuiteModal()">Run Smoke Tests</button>
                </div>
            `;
    const libraryOpen = !!$("modalBox")?.querySelector?.("[data-library-home]");
    if (libraryOpen) {
      document.querySelector(".popup-modal [data-library-settings-overlay]")?.closest?.(".popup-modal")?.remove();
      openCharacterLibraryLayer(`<div data-library-settings-overlay>${settingsHtml}</div>`, {
        title: "Settings",
        attr: "data-library-settings-overlay-box"
      });
    } else {
      openModal(settingsHtml, {
        title: "Settings"
      });
    }
    for (const [key, value] of Object.entries(app.settings)) {
      if (!$(key)) continue;
      if ($(key).type === "checkbox") $(key).checked = !!value;else $(key).value = String(value);
    }
    bindVoicePreviewControls();
    bindSettingsAutoSave();
    if ($("openBoldnessBtn")) $("openBoldnessBtn").onclick = openBoldnessModal;
  }
  function makeZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
      const nameBytes = encoder.encode(name);
      const data = content instanceof Uint8Array ? content : content instanceof ArrayBuffer ? new Uint8Array(content) : encoder.encode(String(content ?? ""));
      const crc = crc32(data);
      const localHeader = zipHeader(0x04034b50, [[20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2]]);
      const centralHeader = zipHeader(0x02014b50, [[20, 2], [20, 2], [0, 2], [0, 2], [0, 2], [0, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]);
      localParts.push(localHeader, nameBytes, data);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + data.length;
    }
    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const endHeader = zipHeader(0x06054b50, [[0, 2], [0, 2], [Object.keys(files).length, 2], [Object.keys(files).length, 2], [centralSize, 4], [offset, 4], [0, 2]]);
    return new Blob([...localParts, ...centralParts, endHeader]);
  }
  function zipHeader(signature, fields) {
    const size = 4 + fields.reduce((total, [, bytes]) => total + bytes, 0);
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let at = 0;
    view.setUint32(at, signature, true);
    at += 4;
    for (const [value, byteCount] of fields) {
      if (byteCount === 2) view.setUint16(at, value, true);else view.setUint32(at, value >>> 0, true);
      at += byteCount;
    }
    return bytes;
  }
  function crc32(bytes) {
    const table = crc32.table || (crc32.table = Array.from({
      length: 256
    }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1;
      return c >>> 0;
    }));
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = table[(crc ^ byte) & 0xff] ^ crc >>> 8;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function bindVoicePreviewControls() {
    const controls = [["narratorVoiceName", "Narrator", "narratorVoiceSearch", "narratorVoicePrev", "narratorVoiceNext", "narratorVoiceTest", ""], ["defaultMalePlayerVoiceName", "Default male player voice", "defaultMalePlayerVoiceSearch", "defaultMalePlayerVoicePrev", "defaultMalePlayerVoiceNext", "defaultMalePlayerVoiceTest", "male-player"], ["defaultNonMalePlayerVoiceName", "Default non-male player voice", "defaultNonMalePlayerVoiceSearch", "defaultNonMalePlayerVoicePrev", "defaultNonMalePlayerVoiceNext", "defaultNonMalePlayerVoiceTest", "female-player"]];
    for (const [id, slot, searchId, prevId, nextId, testId, gender] of controls) {
      const select = $(id);
      if (!select) continue;
      app.settings[id] = gender === "male-player" ? defaultPlayerVoiceForGender("male", app.settings[id]) : gender === "female-player" ? defaultPlayerVoiceForGender("female", app.settings[id]) : resolveVoiceName(app.settings[id], slot);
      bindVoiceCycler({
        selectId: id,
        searchId,
        prevId,
        nextId,
        testId,
        slot,
        selected: app.settings[id],
        gender: gender === "male-player" ? "male" : gender === "female-player" ? "female" : gender
      });
      select.onclick = event => event.stopPropagation?.();
    }
  }
  function settingsModalSettingIds() {
    return ["autoVoice", "autoReadPlayerMessages", "readGameMessages", "autoImages", "showImagesInChat", "showAiStatusMessages", "showAffectionStats", "showNonEnglishVoices", "swapAllGendersToPreferred", "preferredCharacterGender", "reducedUi", "aiMessageLength", "localCodexTextModel", "localCodexTextEffort", "localCodexTextUrl", "downloadOldImagesBeforeDelete", "autoModeType", "autoModeCompletesObjectives", "stateCheckMode", "imageMode", "imageModel", "defaultProfileImageModel", "imageHistoryLimit", "imageRequestTimeoutSeconds",
    // Log checkboxes are normal settings. They must be in the modal
    // save list so toggling one category persists when Settings is
    // closed and reopened; the all-logs buttons are only shortcuts.
    ...LOG_SETTING_IDS, "narratorVoiceName", "defaultMalePlayerVoiceName", "defaultNonMalePlayerVoiceName"];
  }
  function bindSettingsAutoSave() {
    const commit = settingId => saveSettingsFromModal(false, {
      settingIds: settingId ? [settingId] : []
    });
    const setAllLogs = enabled => {
      for (const id of LOG_SETTING_IDS) {
        const el = $(id);
        if (el) el.checked = !!enabled;
        app.settings[id] = !!enabled;
      }
      saveSettingsNow(enabled ? "all logs enabled" : "all logs disabled");
      setStatus(enabled ? "All logs enabled" : "All logs disabled");
    };
    if ($("enableAllLogsBtn")) $("enableAllLogsBtn").onclick = () => setAllLogs(true);
    if ($("disableAllLogsBtn")) $("disableAllLogsBtn").onclick = () => setAllLogs(false);
    for (const id of settingsModalSettingIds()) {
      const el = $(id);
      if (!el) continue;
      if (el.tagName === "SELECT" || el.type === "checkbox") {
        const existingChange = el.onchange;
        el.onchange = event => {
          existingChange?.call(el, event);
          commit(id);
        };
        el.addEventListener("emberadventures-lite-setting-commit", () => commit(id));
        continue;
      }
      el.onchange = () => commit(id);
      el.onblur = () => commit(id);
      el.onkeydown = event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        el.blur?.();
        commit(id);
      };
    }
  }
  function saveSettingsFromModal(close = true, options = {}) {
    const oldAutoVoice = app.settings.autoVoice;
    const oldShowAiStatusMessages = app.settings.showAiStatusMessages;
    const oldShowImagesInChat = app.settings.showImagesInChat;
    const oldReducedUi = reducedUiEnabled();
    const oldDevMode = !!app.settings.devMode;
    const ids = settingsModalSettingIds();
    const requestedSettingIds = Array.isArray(options.settingIds) ? new Set(options.settingIds.map(String)) : null;
    const settingIdsToSave = requestedSettingIds ? ids.filter(id => requestedSettingIds.has(id)) : ids;
    for (const id of settingIdsToSave) {
      if (!$(id)) continue;
      let value = $(id).type === "checkbox" ? $(id).checked : $(id).value;
      if (value === "true") value = true;
      if (value === "false") value = false;
      if (id === "imageHistoryLimit") value = exactImageHistoryLimit(Number(value));
      if (id === "imageRequestTimeoutSeconds") value = exactImageRequestTimeoutSeconds(Number(value));
      if (id === "defaultProfileImageModel") value = selectedProfileImageModel(value);
      if (id === "stateCheckMode") value = value === "all" ? "all" : "groups";
      if (id === "autoModeType") value = exactAutoModeType(value);
      if (id === "aiMessageLength") value = ["normal", "short", "very_short"].includes(String(value)) ? String(value) : "short";
      if (id === "localCodexTextModel") value = exactLocalCodexTextModel(value);
      if (id === "localCodexTextEffort") value = exactLocalCodexTextEffort(value);
      if (id === "localCodexTextUrl") value = String(value || "").trim() || defaultSettings.localCodexTextUrl;
      if (id === "narratorVoiceName") value = resolveVoiceName(value, "Narrator");
      if (id === "defaultMalePlayerVoiceName") value = defaultPlayerVoiceForGender("male", value);
      if (id === "defaultNonMalePlayerVoiceName") value = defaultPlayerVoiceForGender("female", value);
      app.settings[id] = value;
    }

    // SANITIZE REPLACED: settings save should only apply settings-driven content/profile normalization.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
    applyRuntimeContentPolicy(app.state);
    pruneImageHistory(!!app.settings.downloadOldImagesBeforeDelete);
    if (oldAutoVoice && !app.settings.autoVoice) stopReadingMessage();
    saveSettingsNow("settings modal changed");
    if (oldShowAiStatusMessages !== app.settings.showAiStatusMessages || oldShowImagesInChat !== app.settings.showImagesInChat) renderThread();
    applyReducedUiClass();
    if (oldReducedUi !== reducedUiEnabled()) render();else if (oldDevMode !== !!app.settings.devMode) updateTopToolbarVisibility();
    if (close) closeModal();
  }
  const OMIT_BROKEN_GENERATED_IMAGE = Symbol("omit broken generated image");
  function recordPortableImageWarning(warnings, generatedImageRecord, path, url, error) {
    const warning = {
      path,
      imageId: textSlot(generatedImageRecord?.id || generatedImageRecord?.imageId, ""),
      url,
      generated: !!generatedImageRecord,
      error: error?.message || String(error || "")
    };
    warnings.push(warning);
    devLog("Inaccessible image reference encountered during export", {
      label: "image export",
      ...warning,
      summary: warning.generated ? "The known generated image was omitted from the exported copy. Stored data was not changed." : "The inaccessible reference was preserved in the exported copy. Stored data was not changed."
    });
  }
  async function portableBlobUrl(url, generatedImageRecord, path, warnings) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Image fetch returned HTTP ${response.status}.`);
      return dataUrlFromBlob(await response.blob());
    } catch (error) {
      recordPortableImageWarning(warnings, generatedImageRecord, path, url, error);
      return generatedImageRecord ? OMIT_BROKEN_GENERATED_IMAGE : url;
    }
  }
  async function portableJsonPayload(value, seen = new WeakSet(), generatedImageRecord = null, path = "$", warnings = []) {
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (/^blob:/i.test(value)) return portableBlobUrl(value, generatedImageRecord, path, warnings);
      const urls = [...new Set(value.match(/blob:[^\s"'<>]+/gi) || [])];
      let portable = value;
      for (const url of urls) {
        const replacement = await portableBlobUrl(url, generatedImageRecord, path, warnings);
        if (replacement === OMIT_BROKEN_GENERATED_IMAGE) return replacement;
        portable = portable.split(url).join(replacement);
      }
      return portable;
    }
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[circular reference]";
    const result = Array.isArray(value) ? [] : {};
    const generatedRecord = imageSourceWasGenerated(value.source) && !!textSlot(value.id || value.imageId, "") && ["html", "url", "hosted_url", "image_file"].some(key => Object.hasOwn(value, key)) ? value : generatedImageRecord;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const portable = await portableJsonPayload(value[index], seen, generatedRecord, `${path}.${index}`, warnings);
        if (portable !== OMIT_BROKEN_GENERATED_IMAGE) result.push(portable);
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        const portable = await portableJsonPayload(item, seen, generatedRecord, `${path}.${key}`, warnings);
        if (portable === OMIT_BROKEN_GENERATED_IMAGE) return OMIT_BROKEN_GENERATED_IMAGE;
        result[key] = portable;
      }
    }
    return result;
  }
  function jsonPayloadContainsBlobReference(value) {
    const pending = [value];
    const seen = new WeakSet();
    while (pending.length) {
      const current = pending.pop();
      if (typeof current === "string") {
        if (/blob:/i.test(current)) return true;
        continue;
      }
      if (!current || typeof current !== "object" || seen.has(current)) continue;
      seen.add(current);
      if (Array.isArray(current)) {
        for (let index = current.length - 1; index >= 0; index--) pending.push(current[index]);
      } else {
        for (const key in current) if (Object.hasOwn(current, key)) pending.push(current[key]);
      }
    }
    return false;
  }
  function downloadJsonPayload(payload, filename, options = {}) {
    if (EMBERADVENTURES_DEBUG_TEST_SCENARIO || app.devSmokeSuite?.running) {
      app.__emberAdventuresLastJsonDownload = {
        filename,
        payload: clone(payload),
        at: new Date().toISOString()
      };
      if (app.devSmokeSuite?.running) return;
    }
    runBackgroundTask(`json-export:${Date.now()}:${filename}`, "Exporting", async () => {
      const warnings = [];
      const portable = options.portableBlobUrls !== false && jsonPayloadContainsBlobReference(payload) ? await portableJsonPayload(payload, new WeakSet(), null, "$", warnings) : payload;
      if (portable === OMIT_BROKEN_GENERATED_IMAGE) throw new Error("The export root was an unusable generated image record.");
      const blob = await persistenceWorkerRequest("json-stringify-blob", {
        value: portable,
        pretty: options.pretty !== false
      });
      if (!(blob instanceof Blob)) throw new Error("The export worker did not return a JSON file.");
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (warnings.length) {
        app.lastPortableExportWarnings = clone(warnings);
        showNotice("Export Completed with Warnings", `${warnings.length} inaccessible image reference${warnings.length === 1 ? " was" : "s were"} encountered. See the developer trace for exact object paths and URLs. Stored data was not changed.`);
      }
      return true;
    }, {
      priority: 60,
      workLabel: `export ${filename}`
    });
  }
  function uploadPluginFunction() {
    return perchancePlugin("uploadPlugin") || root.uploadPlugin || window.uploadPlugin || null;
  }
  function hostedUploadSupported() {
    return !!uploadPluginFunction();
  }
  const COMPRESSED_JSON_FORMATS = Object.freeze([Object.freeze({
    format: "brotli",
    extension: ".json.br",
    extensions: Object.freeze([".json.br", ".br"]),
    mimeType: "application/br",
    mimeTypes: Object.freeze(["application/br", "application/x-br", "application/brotli", "application/x-brotli"])
  }), Object.freeze({
    format: "gzip",
    extension: ".json.gz",
    extensions: Object.freeze([".json.gz", ".gz"]),
    mimeType: "application/gzip",
    mimeTypes: Object.freeze(["application/gzip", "application/x-gzip"])
  }), Object.freeze({
    format: "deflate",
    extension: ".json.zz",
    extensions: Object.freeze([".json.zz", ".zz", ".zlib", ".deflate"]),
    mimeType: "application/zlib",
    mimeTypes: Object.freeze(["application/zlib", "application/x-deflate"])
  }), Object.freeze({
    format: "deflate-raw",
    extension: ".json.deflate-raw",
    extensions: Object.freeze([".json.deflate-raw", ".deflate-raw"]),
    mimeType: "application/deflate-raw",
    mimeTypes: Object.freeze(["application/deflate-raw"])
  })]);
  const COMPRESSED_JSON_IMPORT_ACCEPT = ["application/json", ".json", ...COMPRESSED_JSON_FORMATS.flatMap(entry => [entry.mimeType, ...entry.extensions])].join(",");
  function compressedJsonFormat(value = {}, sourceName = "") {
    const name = String(sourceName || value?.name || "").split(/[?#]/)[0].toLowerCase();
    const type = String(value?.type || "").split(";")[0].trim().toLowerCase();
    return COMPRESSED_JSON_FORMATS.find(entry => entry.extensions.some(extension => name.endsWith(extension))) || COMPRESSED_JSON_FORMATS.find(entry => entry.mimeTypes.includes(type)) || null;
  }
  function compressedJsonFileName(name = "") {
    const clean = String(name || "").split(/[?#]/)[0].toLowerCase();
    return clean.endsWith(".json") || !!compressedJsonFormat({
      name: clean
    });
  }
  function compressionStreamForFormat(StreamType, format = "") {
    if (typeof StreamType !== "function") return null;
    try {
      return new StreamType(format);
    } catch {
      return null;
    }
  }
  function brotliCodec() {
    const codec = globalThis.EmberBrotliCodec;
    if (typeof codec?.compress !== "function" || typeof codec?.decompress !== "function") {
      throw new Error("The bundled Brotli codec is unavailable. Reload EmberAdventures and try again.");
    }
    return codec;
  }
  async function compressBlobWithBrotli(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const compressed = await brotliCodec().compress(bytes, {
      quality: 11
    });
    return new Blob([compressed], {
      type: "application/br"
    });
  }
  async function decompressBlobWithBrotli(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const decompressed = await brotliCodec().decompress(bytes);
    return new Blob([decompressed], {
      type: "application/json"
    });
  }
  async function compressBlobWithFormat(blob, format = "gzip") {
    const descriptor = COMPRESSED_JSON_FORMATS.find(entry => entry.format === String(format || "").trim());
    if (!descriptor) throw new Error(`Unknown JSON compression format: ${format}`);
    const stream = compressionStreamForFormat(window.CompressionStream, descriptor.format);
    if (!stream) {
      if (descriptor.format === "brotli") return compressBlobWithBrotli(blob);
      throw new Error(`This browser does not support ${descriptor.format} compressed JSON files. Use JSON, Brotli, or gzip instead.`);
    }
    const output = await new Response(blob.stream().pipeThrough(stream)).blob();
    return new Blob([output], {
      type: descriptor.mimeType
    });
  }
  async function decompressBlobWithFormat(blob, format = "gzip") {
    const descriptor = COMPRESSED_JSON_FORMATS.find(entry => entry.format === String(format || "").trim());
    if (!descriptor) throw new Error(`Unknown JSON compression format: ${format}`);
    const stream = compressionStreamForFormat(window.DecompressionStream, descriptor.format);
    if (!stream) {
      if (descriptor.format === "brotli") return decompressBlobWithBrotli(blob);
      throw new Error(`This browser does not support ${descriptor.format} compressed JSON files. Use JSON, Brotli, or gzip instead.`);
    }
    return new Response(blob.stream().pipeThrough(stream)).blob();
  }
  async function compressedJsonBlobText(blob, sourceName = "") {
    const descriptor = compressedJsonFormat(blob, sourceName);
    if (!descriptor) return blob.text();
    return (await decompressBlobWithFormat(blob, descriptor.format)).text();
  }
  function compressBlobWithGzip(blob) {
    return compressBlobWithFormat(blob, "gzip");
  }
  function decompressBlobWithGzip(blob) {
    return decompressBlobWithFormat(blob, "gzip");
  }
  function publicUploadFileUrl(fileName) {
    const clean = String(fileName || "").split(/[?#]/)[0].replace(/^https:\/\/user\.uploads\.dev\/file\//i, "").replace(/[^a-z0-9._-]/gi, "");
    if (!clean) throw new Error("Missing hosted upload file name.");
    return `https://user.uploads.dev/file/${clean}`;
  }
  function safeUploadSlug(name) {
    return safeArchiveFileName(name || "emberadventures").replaceAll("~", "").replace(/^-+|-+$/g, "").slice(0, 64) || "emberadventures";
  }
  function parseHostedShareParam(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const parts = text.split("~");
    const fileName = parts.pop();
    return {
      slug: parts.join("~"),
      fileName: String(fileName || "").replace(/[^a-z0-9._-]/gi, "")
    };
  }
  function hostedShareUrl(kind, slug, fileName) {
    const param = `${safeUploadSlug(slug)}~${String(fileName || "").replace(/[^a-z0-9._-]/gi, "")}`;
    const generator = String(root.generatorName || window.generatorName || "minimal").trim() || "minimal";
    return `https://perchance.org/${generator}?${encodeURIComponent(kind)}=${encodeURIComponent(param)}`;
  }

  //Perchance may enforce a longer minimum. Smoke uploads request one day
  //and accept that provider minimum when it is longer.
  const TEST_UPLOAD_EXPIRES_IN_SECONDS = 24 * 60 * 60;
  function testUploadPluginOptions(options = {}) {
    if (!options.testUpload) return undefined;
    return {
      expiresIn: TEST_UPLOAD_EXPIRES_IN_SECONDS,
      expires_in: TEST_UPLOAD_EXPIRES_IN_SECONDS,
      expiresInSeconds: TEST_UPLOAD_EXPIRES_IN_SECONDS
    };
  }
  function hostedUploadDeletionUrl(upload = {}) {
    return String(upload.deletionUrl || upload.deleteUrl || upload.delete_url || upload.deletion_url || upload.raw?.deletionUrl || upload.raw?.deleteUrl || upload.raw?.delete_url || upload.raw?.deletion_url || "").trim();
  }
  function hostedUploadUrlText(value, label = "Hosted upload") {
    const url = typeof value === "string" ? value.trim() : "";
    if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error(`${label} did not return a valid text URL.`);
    return url;
  }
  function perchanceUploadUrlText(value, label = "Perchance upload") {
    return hostedUploadUrlText(String(value || ""), label);
  }
  async function deleteHostedUpload(upload = {}, label = "test upload") {
    const deletionUrl = hostedUploadDeletionUrl(upload);
    if (!deletionUrl) {
      log("Hosted test upload cleanup skipped", `${label} did not return a deletion URL. Perchance may keep it until its configured expiry.`, {
        type: "system",
        level: "warn"
      });
      return false;
    }
    const response = await fetch(deletionUrl);
    if (!response.ok) throw new Error(`${label} cleanup failed: deletion URL returned HTTP ${response.status}.`);
    devForgetSmokeHostedUpload(upload);
    forgetPendingPublicUploads([upload]);
    log("Hosted test upload deleted", `${label}\n${upload.url || ""}`, {
      type: "system",
      level: "message"
    });
    return true;
  }
  async function cleanupHostedUploads(uploads = [], label = "test upload") {
    for (const upload of uploads.filter(Boolean)) {
      try {
        await deleteHostedUpload(upload, label);
      } catch (err) {
        log("Hosted test upload cleanup failed", err.message || String(err), {
          type: "system",
          level: "warn"
        });
      }
    }
  }
  const PENDING_PUBLIC_UPLOADS_KEY = "emberadventures-lite-pending-public-uploads-v1";
  function pendingPublicUploadLedger() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_PUBLIC_UPLOADS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(entry => entry?.deletionUrl) : [];
    } catch {
      return [];
    }
  }
  function savePendingPublicUploadLedger(entries = []) {
    try {
      localStorage.setItem(PENDING_PUBLIC_UPLOADS_KEY, JSON.stringify(entries));
    } catch (err) {
      log("Pending public upload ledger save failed", err.message || String(err), {
        type: "system",
        level: "warn"
      });
    }
  }
  function rememberPendingPublicUpload(upload = {}, label = "public upload") {
    const deletionUrl = hostedUploadDeletionUrl(upload);
    if (!deletionUrl) return;
    const ledger = pendingPublicUploadLedger().filter(entry => entry.deletionUrl !== deletionUrl);
    ledger.push({
      deletionUrl,
      url: String(upload.url || ""),
      label: String(label || "public upload"),
      createdAt: Date.now()
    });
    savePendingPublicUploadLedger(ledger);
  }
  function forgetPendingPublicUploads(uploads = []) {
    const deletionUrls = new Set(uploads.filter(Boolean).map(hostedUploadDeletionUrl).filter(Boolean));
    if (!deletionUrls.size) return;
    savePendingPublicUploadLedger(pendingPublicUploadLedger().filter(entry => !deletionUrls.has(entry.deletionUrl)));
  }
  function protectPublicUploadsBeforePublish(uploads = []) {
    const deletionUrls = new Set(uploads.filter(Boolean).map(hostedUploadDeletionUrl).filter(Boolean));
    const ledger = pendingPublicUploadLedger();
    for (const entry of ledger) {
      if (deletionUrls.has(entry.deletionUrl)) entry.publicationAttempted = true;
    }

    //Persist protection before submitting metadata; a reload must not delete possibly published files.
    localStorage.setItem(PENDING_PUBLIC_UPLOADS_KEY, JSON.stringify(ledger));
  }
  function markHostedUploadsCommitted(uploads = []) {
    forgetPendingPublicUploads(uploads);
  }
  async function cleanupAbandonedPublicUploads(options = {}) {
    const staleBefore = Date.now() - Math.max(60000, Number(options.minimumAgeMs || 60 * 60 * 1000));
    const ledger = pendingPublicUploadLedger();
    const stale = ledger.filter(entry => !entry.publicationAttempted && Number(entry.createdAt || 0) <= staleBefore);
    const retained = ledger.filter(entry => entry.publicationAttempted || Number(entry.createdAt || 0) > staleBefore);
    for (const entry of stale) {
      try {
        const response = await fetch(entry.deletionUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        log("Abandoned public upload deleted", `${entry.label}\n${entry.url}`, {
          type: "system",
          level: "message"
        });
      } catch (err) {
        retained.push(entry);
        log("Abandoned public upload cleanup failed", `${entry.label}: ${err.message || String(err)}`, {
          type: "system",
          level: "warn"
        });
      }
    }
    savePendingPublicUploadLedger(retained);
    return {
      deleted: stale.length - retained.filter(entry => stale.includes(entry)).length,
      remaining: retained.length
    };
  }
  let perchanceUploadQueueTail = Promise.resolve();
  function enqueuePerchanceUpload(action) {
    const task = perchanceUploadQueueTail.catch(() => null).then(action);
    perchanceUploadQueueTail = task.catch(() => null);
    return task;
  }
  async function uploadBlobToUserUploads(blob, label = "upload", options = {}) {
    const plugin = uploadPluginFunction();
    if (!plugin) throw new Error("The Perchance upload plugin is not loaded. Reload the hosted Perchance editor after updating left.js.");
    const pluginOptions = testUploadPluginOptions(options);
    const result = await enqueuePerchanceUpload(() => pluginOptions ? plugin(blob, pluginOptions) : plugin(blob));
    if (result?.error) {
      const detail = result.error === "disallowed_content" ? " The upload was blocked by Perchance moderation. If this is a false positive, make adult ages and context explicit before trying again." : "";
      throw new Error(`${label} failed: ${result.error}.${detail}`);
    }
    if (!result?.url) throw new Error(`${label} failed: uploadPlugin returned no URL.`);
    // Perchance plugin values can be string-like objects. Convert the trusted
    // transport value here so schema records only ever receive primitive text.
    const url = perchanceUploadUrlText(result.url, label);
    const fileName = url.replace(/^https:\/\/user\.uploads\.dev\/file\//i, "");
    const upload = {
      url,
      fileName,
      size: Number(result.size || blob.size || 0),
      deletionUrl: hostedUploadDeletionUrl(result),
      expiresInSeconds: options.testUpload ? TEST_UPLOAD_EXPIRES_IN_SECONDS : null,
      raw: result
    };
    if (options.testUpload) devRegisterSmokeHostedUpload(upload, label);
    if (options.pendingPublicUpload) rememberPendingPublicUpload(upload, label);
    return upload;
  }
  function stringifyHostedJsonPayload(payload, options = {}) {
    return JSON.stringify(payload, null, options.pretty ? 2 : 0);
  }
  async function uploadCompressedJson(payload, label = "JSON upload", options = {}) {
    const json = stringifyHostedJsonPayload(payload, options);
    const blob = new Blob([json], {
      type: "application/json"
    });
    const compression = String(options.compression || "gzip").trim();
    const descriptor = COMPRESSED_JSON_FORMATS.find(entry => entry.format === compression);
    if (!descriptor) throw new Error(`Unknown JSON compression format: ${compression}`);
    const compressedBlob = descriptor.format === "brotli" ? new Blob([await storyImportWorkerRequest("compress-json", {
      text: json,
      format: descriptor.format
    })], {
      type: descriptor.mimeType
    }) : await compressBlobWithFormat(blob, descriptor.format);
    const packageName = `${safeUploadSlug(options.fileName || label || "emberadventures")}${descriptor.extension}`;
    const packageFile = new File([compressedBlob], packageName, {
      type: descriptor.mimeType
    });
    const digest = await crypto.subtle.digest("SHA-256", await packageFile.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    const upload = await uploadBlobToUserUploads(packageFile, label, options);
    return {
      ...upload,
      sha256,
      payloadSizeBytes: packageFile.size,
      rawPayloadSizeBytes: blob.size,
      compressed: true,
      compression: descriptor.format,
      prettyPrinted: options.pretty === true
    };
  }
  async function uploadCompressedStoryJson(payload, label = "Story JSON upload", options = {}) {
    return uploadCompressedJson(payload, label, {
      ...options,
      compression: "brotli",
      pretty: true
    });
  }
  async function uploadJsonFileToUserUploads(payload, fileName, label = "JSON upload", options = {}) {
    const cleanFileName = safeArchiveFileName(fileName || "emberadventures-lite-public-library-index.json").replace(/[^a-z0-9._-]/gi, "").slice(0, 120) || "emberadventures-lite-public-library-index.json";
    const file = new File([JSON.stringify(payload, null, 2)], cleanFileName, {
      type: "application/json"
    });
    return uploadBlobToUserUploads(file, label, options);
  }
  async function fetchAfterResponseStart(url, options = {}, timeoutMs = 15000) {
    let timeoutId = null;
    // Only time out before response headers arrive. Hosted story/character
    // files can be large, so downloading the body must not be killed by time.
    const started = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timed out waiting for the server to respond.")), timeoutMs);
    });
    try {
      return await Promise.race([fetch(url, options), started]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  function transientHostedReadError(err) {
    const message = String(err?.message || err || "");
    return err?.name === "AbortError" || /failed to fetch|networkerror|load failed|timed out/i.test(message) || /(?:HTTP\s+|hosted file \()(?:408|425|429|5\d\d)\b/i.test(message);
  }
  async function retryTransientHostedRead(action) {
    try {
      return await action();
    } catch (err) {
      if (!transientHostedReadError(err)) throw err;
      await new Promise(resolve => setTimeout(resolve, 250));
      return action();
    }
  }
  async function parseHostedJsonBlob(blob, sourceName = "") {
    const descriptor = compressedJsonFormat(blob, sourceName);
    if (descriptor) return JSON.parse(await compressedJsonBlobText(blob, sourceName));
    const plainText = await blob.text();
    try {
      return JSON.parse(plainText);
    } catch (plainError) {
      const attempts = [];
      for (const format of ["brotli", "gzip", "deflate", "deflate-raw"]) {
        try {
          const decompressed = await decompressBlobWithFormat(blob, format);
          return JSON.parse(await decompressed.text());
        } catch (error) {
          attempts.push(`${format}: ${error?.message || String(error)}`);
        }
      }
      throw new SyntaxError(`Hosted JSON is neither plain JSON nor a supported compressed JSON format. ${plainError?.message || String(plainError)} Decompression attempts: ${attempts.join(" | ")}`);
    }
  }
  async function fetchCompressedJsonFromUpload(fileName) {
    const url = publicUploadFileUrl(fileName);
    const response = await fetchAfterResponseStart(url);
    if (!response.ok) throw new Error(`Could not load hosted file (${response.status}).`);
    const blob = await response.blob();
    return parseHostedJsonBlob(blob, fileName);
  }
  async function fetchJsonFromPublicUploadUrl(url) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return null;
    const response = await fetchAfterResponseStart(cleanUrl + (cleanUrl.includes("?") ? "&" : "?") + `cache_bust=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Could not load public library index (${response.status}).`);
    const blob = await response.blob();
    return parseHostedJsonBlob(blob, cleanUrl);
  }
  async function fetchVerifiedPublicLibraryPayloadOnce(entry = {}) {
    const url = String(entry.url || "").trim();
    if (!url) throw new Error("Public item does not have a payload URL.");
    const response = await fetchAfterResponseStart(url + (url.includes("?") ? "&" : "?") + `cache_bust=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Could not load hosted file (${response.status}).`);
    const blob = await response.blob();
    if (entry.payload_size_bytes && Number(entry.payload_size_bytes) !== blob.size) throw new Error(`Hosted payload size does not match its published version (${blob.size} instead of ${entry.payload_size_bytes} bytes).`);
    if (entry.payload_sha256) {
      const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      if (hash !== String(entry.payload_sha256).toLowerCase()) throw new Error("Hosted payload hash does not match its published version.");
    }
    // This boundary verifies only the hosted bytes. The story or
    // character importer owns the one canonical schema validation pass.
    return parseHostedJsonBlob(blob, url);
  }
  async function fetchVerifiedPublicLibraryPayload(entry = {}) {
    return retryTransientHostedRead(() => fetchVerifiedPublicLibraryPayloadOnce(entry));
  }
  async function confirmHostedUpload(label = "file", payload = {}, options = {}) {
    if (options.skipConfirm === true) return true;
    return showConfirm("Upload File?", `Upload this ${label}? Anyone with its link may be able to access it.`, {
      confirmText: "Upload",
      cancelText: "Cancel"
    });
  }
  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard?.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  async function showHostedShareResult(title, url, details = "") {
    const copied = await copyTextToClipboard(url);
    openModal(`
                <h2>${escapeHtml(title)}</h2>
                <p class="hint">${escapeHtml(details || "Hosted upload complete. The URL is public to anyone who has the link.")}</p>
                <label>Share URL <input id="hostedShareUrl" value="${escapeHtml(url)}" readonly></label>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="navigator.clipboard?.writeText(document.getElementById('hostedShareUrl').value)">Copy URL</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Close</button>
                </div>
                ${copied ? `<p class="hint">Copied to clipboard.</p>` : ""}
            `);
  }
  function openUploadTestModal() {
    openModal(`
                <h2>Hosted Upload Test</h2>
                <p class="hint">These tests upload tiny private test files to Perchance user.uploads.dev, fetch them back, and verify the round trip. Uploaded files are public to anyone with the returned URL.</p>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.runHostedJsonUploadTest()">Test JSON Round Trip</button>
                </div>
                <div id="uploadTestResult" class="hint" style="margin-top:.8rem">Ready.</div>
            `);
  }
  function setUploadTestResult(message) {
    const el = $("uploadTestResult");
    if (el) el.textContent = message;
    setStatus(message);
  }
  async function runHostedJsonUploadTest() {
    try {
      const payload = {
        app: "EmberAdventures",
        exportType: "upload-test",
        schemaVersion: 1,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      };
      setUploadTestResult("Uploading test JSON...");
      const upload = await uploadCompressedJson(payload, "Test JSON upload", {
        testUpload: true
      });
      setUploadTestResult("Fetching test JSON...");
      const fetched = await fetchCompressedJsonFromUpload(upload.fileName);
      if (fetched.nonce !== payload.nonce) throw new Error("Fetched JSON did not match the uploaded payload.");
      setUploadTestResult("Deleting test JSON upload...");
      await cleanupHostedUploads([upload], "Test JSON upload");
      setUploadTestResult("JSON upload test passed.");
    } catch (err) {
      setUploadTestResult("JSON upload test failed.");
      showNotice("JSON Upload Test Failed", err.message || String(err));
    }
  }
  
