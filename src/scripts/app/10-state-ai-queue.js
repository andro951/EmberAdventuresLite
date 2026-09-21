const CHARACTER_BOLDNESS_PHRASES = {
    "1": "very reserved; listens carefully and rarely starts a conversation",
    "2": "reserved; responds warmly but waits for an invitation",
    "3": "cautious; sometimes offers a question or suggestion",
    "4": "mildly outgoing; starts conversations when comfortable",
    "5": "balanced; comfortably shares ideas and initiates ordinary interactions",
    "6": "confident; readily makes plans and expresses preferences",
    "7": "very confident; takes initiative and directly offers help or invitations",
    "8": "bold; proactively pursues goals and speaks candidly while respecting others",
    "9": "highly assertive; leads conversations and proposes decisive action without overriding the player",
    "10": "maximum initiative; actively creates opportunities, expresses goals clearly, and respects refusals and personal boundaries"
  };
  function clampBoldnessOffset(value) {
    return Math.max(-4, Math.min(5, Math.round(Number(value) || 0)));
  }
  function clampCharacterBoldness(value) {
    if (value == null || value === "") return 5;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 10) return 5;
    return Math.round(numeric);
  }
  function validCharacterBoldness(value) {
    return typeof value === "string" ? !!value.trim() && !Number.isFinite(Number(value)) : Number.isSafeInteger(value) && value >= 1 && value <= 10;
  }
  function exactCharacterBoldness(value, path = "boldness") {
    if (!validCharacterBoldness(value)) throw new Error(`${path} must be a whole number from 1 through 10 or a nonempty custom description.`);
    return value;
  }
  function repairAiCharacterBoldness(value, fallback = 5) {
    if (typeof value === "string" && validCharacterBoldness(value)) return value;
    const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : fallback;
    return clampCharacterBoldness(numeric);
  }
  function characterBoldnessPhrase(value, character = null) {
    if (typeof value === "string") return displayRuntimeTemplateText(exactCharacterBoldness(value), character);
    return CHARACTER_BOLDNESS_PHRASES[clampCharacterBoldness(value)] || CHARACTER_BOLDNESS_PHRASES[5];
  }
  function calculatedCharacterBoldness(character, offset = app.settings.characterBoldnessOffset) {
    const stored = exactCharacterBoldness(character?.boldness, `${textSlot(character?.name, "character")}.boldness`);
    if (typeof stored === "string") return stored;
    const maxEffective = 5 + clampBoldnessOffset(offset);
    return clampCharacterBoldness(Math.round(1 + (stored - 1) / 9 * (maxEffective - 1)));
  }
  function characterBoldnessGuidanceText(character) {
    const effective = calculatedCharacterBoldness(character);
    return characterBoldnessPhrase(effective, character);
  }
  function rollCharacterBoldness() {
    return 1 + Math.floor(Math.random() * 10);
  }
  function renderBoldnessRangeTable(offset = app.settings.characterBoldnessOffset) {
    const adjustedOffset = clampBoldnessOffset(offset);
    const maxEffective = 5 + adjustedOffset;
    return `
                <div class="setting-option-list" data-boldness-choice-list="true">
                        ${Object.entries(CHARACTER_BOLDNESS_PHRASES).map(([value, phrase]) => {
      const number = Number(value);
      const included = number <= maxEffective;
      return `
                                <button
                                    type="button"
                                    class="setting-option-button ${included ? "selected" : "dim"}"
                                    data-boldness-choice="${number}"
                                    title="Set maximum effective boldness to ${number}"
                                >
                                    <span class="setting-option-number">${number}</span>
                                    <span>${escapeHtml(phrase)}</span>
                                </button>
                            `;
    }).join("")}
                </div>
            `;
  }
  function renderSettingControlCard({
    title,
    summary,
    controlHtml,
    meaningId = "",
    meaning = "",
    meaningHtml = ""
  }) {
    return `
                <section class="stat-card setting-control-card">
                    <h3>${escapeHtml(title)}</h3>
                    <div class="setting-control-summary">${escapeHtml(summary)}</div>
                    <div class="setting-control-body">
                        ${controlHtml}
                        <div class="setting-control-meaning" ${meaningId ? `id="${escapeHtml(meaningId)}"` : ""}>${meaningHtml || escapeHtml(meaning)}</div>
                    </div>
                </section>
            `;
  }
  function renderNumberStepper(id, value, options = {}) {
    const label = options.label || "value";
    const min = options.min ?? "";
    const max = options.max ?? "";
    const inputAttrs = [`id="${escapeHtml(id)}"`, `type="number"`, min !== "" ? `min="${escapeHtml(min)}"` : "", max !== "" ? `max="${escapeHtml(max)}"` : "", `value="${escapeHtml(value)}"`, options.inputStyle ? `style="${escapeHtml(options.inputStyle)}"` : ""].filter(Boolean).join(" ");
    return `
                <div class="number-stepper">
                    <input ${inputAttrs}>
                    <button type="button" id="${escapeHtml(id)}Up" title="Increase ${escapeHtml(label)}">&#9650;</button>
                    <button type="button" id="${escapeHtml(id)}Down" title="Decrease ${escapeHtml(label)}">&#9660;</button>
                </div>
            `;
  }
  function openBoldnessModal() {
    const offset = clampBoldnessOffset(app.settings.characterBoldnessOffset);
    openModal(`
                <h2>Character Boldness Defaults</h2>
                <p class="hint">When characters are created, they are given a boldness value. You can limit the range of possible boldness options they can be given by adjusting this range. Text boldness is used directly and is not scaled.</p>
                <label>Boldness adjustment
                    ${renderNumberStepper("characterBoldnessOffset", offset, {
      label: "boldness adjustment",
      min: -4,
      max: 5
    })}
                </label>
                <div id="boldnessRangePreview">${renderBoldnessRangeTable(offset)}</div>
                <div class="row" style="margin-top:.8rem">
                    <button class="modal-x" onclick="EmberAdventures.openSettingsModal()">X</button>
                </div>
            `);
    const bindChoiceButtons = () => {
      document.querySelectorAll("#boldnessRangePreview [data-boldness-choice]").forEach(button => {
        button.onclick = () => {
          const input = $("characterBoldnessOffset");
          input.value = String(clampBoldnessOffset(Number(button.dataset.boldnessChoice) - 5));
          refresh(0);
        };
      });
    };
    const refresh = (delta = 0) => {
      const input = $("characterBoldnessOffset");
      const next = clampBoldnessOffset(Number(input.value) + delta);
      input.value = String(next);
      $("boldnessRangePreview").innerHTML = renderBoldnessRangeTable(next);
      app.settings.characterBoldnessOffset = next;
      saveSettingsNow("character boldness changed");
      setStatus("Saved");
      bindChoiceButtons();
    };
    $("characterBoldnessOffsetDown").onclick = () => refresh(-1);
    $("characterBoldnessOffsetUp").onclick = () => refresh(1);
    $("characterBoldnessOffset").oninput = () => refresh(0);
    bindChoiceButtons();
  }
  function familyFriendlyContentInstruction() {
    return "Tell a family-friendly adventure. Keep humanoid characters in opaque full-coverage clothing covering the torso and legs; do not introduce revealing outfits. Keep relationships non-explicit, and descriptions suitable for a general audience.";
  }
  function ensureSceneState() {
    app.state.scene ||= {};
  }
  function assertRuntimeSceneReferences(state = app.state) {
    if (!isPlainObject(state?.scene)) throw new Error("Runtime scene must be an object.");
    const partyNames = Object.keys(state.characters || {});
    const npcNames = allNpcNamesFromState(state);
    const presentNames = [...partyNames, ...npcNames];
    const assertList = (field, allowedNames) => {
      const list = state.scene[field];
      if (!Array.isArray(list)) throw new Error(`state.scene.${field} must be an array.`);
      const seen = new Set();
      for (let index = 0; index < list.length; index++) {
        const name = list[index];
        if (typeof name !== "string" || !name) throw new Error(`state.scene.${field}.${index} must be non-empty text.`);
        if (!allowedNames.includes(name)) throw new Error(`state.scene.${field}.${index} references unknown character ${name}.`);
        if (seen.has(name)) throw new Error(`state.scene.${field}.${index} duplicates ${name}.`);
        seen.add(name);
      }
    };
    assertList("party_members_present", presentNames);
    assertList("npcs_present", npcNames);
    for (const name of state.scene.npcs_present) if (!isValidNearbyNpcName(name, state)) throw new Error(`state.scene.npcs_present references unavailable NPC ${name}.`);
    const imageEligibleNames = [playerEntityDisplayName(state), ...state.scene.party_members_present, ...state.scene.npcs_present.filter(name => imageEntityFromState(name, state))];
    assertList("image_characters", imageEligibleNames);
    return state;
  }
  function exactRuntimeState10(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) throw new Error(`${path} must be a finite number from 0 through 10.`);
    return value;
  }
  function applyRuntimeContentPolicy(state = app.state) {
    if (!isPlainObject(state) || !isPlainObject(state.meta)) throw new Error("Runtime state.meta is required before applying content policy.");
    if (!isPlainObject(state.world_flags)) throw new Error("Runtime state.world_flags must be an object.");
    if (!Array.isArray(state.meta.genres) || state.meta.genres.some(value => typeof value !== "string")) throw new Error("Runtime state.meta.genres must be an exact array of text values.");
    for (const obsoleteField of ["genre", "player_preferences"]) if (Object.hasOwn(state.meta, obsoleteField)) throw new Error(`Runtime state.meta.${obsoleteField} is not an approved field.`);
    return state;
  }
  function assertRuntimeObjectivesAndProgression(state = app.state) {
    if (!isPlainObject(state.objectives)) throw new Error("Runtime objective state is required.");
    assertObjectiveRuntimeControls(state.objectives);
    return state;
  }
  function assertRuntimeLocationState(state = app.state) {
    if (!isPlainObject(state) || !isPlainObject(state.location)) throw new Error("Runtime state.location must be an exact object.");
    if (!isPlainObject(state.world_map) || !isPlainObject(state.world_map.locations)) throw new Error("Runtime state.world_map and world_map.locations must be exact objects.");
    for (const field of STORY_LOCATION_FIELDS) if (typeof state.location[field] !== "string") throw new Error(`Runtime state.location.${field} must be exact text.`);
    for (const field of ["current_location_id", "focus_location_id"]) if (typeof state.world_map[field] !== "string") throw new Error(`Runtime state.world_map.${field} must be exact text.`);
    if (!Array.isArray(state.world_map.travel_history) || state.world_map.travel_history.some(value => typeof value !== "string")) throw new Error("Runtime state.world_map.travel_history must be an exact array of location ids.");
    const currentLocationId = state.world_map.current_location_id;
    if (!currentLocationId || !isPlainObject(state.world_map.locations[currentLocationId])) throw new Error(`Runtime current map location does not exist: ${currentLocationId || "(blank)"}.`);
    assertRuntimeSceneReferences(state);
    assertRuntimeObjectivesAndProgression(state);
    return state;
  }
  function assertRuntimeNpcReferences(state = app.state) {
    if (!isPlainObject(state) || !isPlainObject(state.npc_directory)) throw new Error("Runtime state.npc_directory must be an exact object.");
    if (!isPlainObject(state.npc_directory.locations)) throw new Error("Runtime state.npc_directory.locations must be an exact object.");
    for (const [locationId, location] of Object.entries(state.npc_directory.locations)) {
      if (!isNpcLocationId(locationId)) throw new Error(`Runtime NPC location id is invalid: ${locationId}.`);
      if (!isPlainObject(location) || typeof location.label !== "string" || !isPlainObject(location.characters)) throw new Error(`Runtime NPC location ${locationId} must contain exact label and characters fields.`);
    }
    assertRuntimeSceneReferences(state);
    return state;
  }
  async function sendUserMessage() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    if (directObjectiveChoiceIsWaiting()) {
      openDirectObjectiveChoiceModal();
      return;
    }
    const text = formatComposerText($("input").value.trim());
    if (!text) return;
    $("input").value = "";
    resizeComposerInput();
    await submitUserText(text);
  }
  async function submitUserText(text) {
    text = String(text || "").trim();
    if (!text) return;
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    app.queue.push({
      text,
      visibleText: text,
      skipUserStateCheck: false,
      commandOnly: false,
      source: "user",
      speaker: app.state.player?.name || "Player",
      autoRead: !!app.settings.autoReadPlayerMessages
    });
    if (queueProcessingBlocked()) {
      setStatus(`Queued ${app.queue.length} message(s)`);
      render();
      return;
    }
    await processQueue();
  }
  function openAiCommandModal() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    openModal(`
                <h2>AI Command</h2>
                <p class="hint">You can send a message to the AI as a command for it to follow. This is not treated like a normal in-character message. It is meant for making changes to the game state using a message to the AI instead of updating things manually.</p>
                <textarea id="aiCommandText" rows="8" placeholder="Example: Move the scene to the tavern, make the weather turn stormy, and have Lilith become suspicious of the guild clerk."></textarea>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" id="submitAiCommandBtn">Submit Command</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Close</button>
                </div>
            `);
    $("aiCommandText")?.focus?.();
    $("submitAiCommandBtn").dataset.uiAction = "submitAiCommandFromModal";
    $("submitAiCommandBtn").onclick = () => window.EmberAdventures.submitAiCommandFromModal();
  }
  function submitAiCommandFromModal() {
    const command = $("aiCommandText")?.value.trim() || "";
    if (!command) return;
    closeModal();
    // Rule: AI Command is an out-of-character state tool, not a visible
    // story turn. Do not echo the command into chat; completion/failure
    // is reported by runAiCommandPatch as a Game message.
    app.queue.push({
      text: command,
      visibleText: command,
      skipUserStateCheck: false,
      commandOnly: true,
      source: "command",
      messageId: null
    });
    setStatus("Running AI command...");
    render();
    if (!queueProcessingBlocked()) return processQueue();
    return false;
  }
  function aiCommandStateText(command) {
    const playerName = playerNameForPrompt();
    return `${playerName} has sent this message as instructions to you, the AI running EmberAdventures. This is not an in-character action or dialogue. Do your best to accomplish the command by updating the game state consistently with the current state, content settings, present party members and NPCs, map, time, objectives, and durable story memory. Preserve ${playerName}'s agency unless the command explicitly asks you to change it.\n\nAI COMMAND:\n${command}`;
  }
  function continueScene() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    if (directObjectiveChoiceIsWaiting()) {
      if (beginAutoDirectObjectiveChoice("continue pressed")) return;
      openDirectObjectiveChoiceModal();
      return;
    }
    enqueueSceneDirective({
      text: "Continue",
      skipUserStateCheck: true,
      source: "continue",
      directive: continueSceneDirective("observe")
    });
  }
  function toggleAutoVisualNovel() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return;
    }
    app.settings.autoVisualNovel = !app.settings.autoVisualNovel;
    scheduleActiveGameSave();
    renderQuickActions();
    if (app.settings.autoVisualNovel) {
      maybeEnqueueAutoVisualNovelTurn("auto enabled", {
        allowInitial: true
      });
    } else {
      clearAutoAdvanceTimer();
      app.autoAdvanceWaitingForVoiceMessageId = null;
    }
  }
  function continueSceneDirective(mode = "observe") {
    if (mode === "auto") return "";
    const playerName = playerNameForPrompt();
    return `${playerName} chose Continue and did not send a message. Treat ${playerName} as passive, waiting, watching, and listening. Do not make ${playerName} move, speak, attack, touch, accept, refuse, or choose. Advance only NPCs, environment, consequences, tension, romance, dialogue, offers, threats, or openings for ${playerName} to answer.`;
  }
  function enqueueSceneDirective(item) {
    const queueItem = {
      text: item.text || "Continue",
      visibleText: item.visibleText || "",
      skipUserStateCheck: !!item.skipUserStateCheck,
      directive: item.directive || "",
      source: item.source || "system",
      speaker: item.speaker || "",
      autoRead: !!item.autoRead
    };
    app.queue.push(queueItem);
    if (queueProcessingBlocked()) {
      setStatus(`Queued ${app.queue.length} turn(s)`);
      render();
      return Promise.resolve(false);
    }
    return processQueue();
  }
  function enqueueAutoVisualNovelTurn(options = {}) {
    maybeEnqueueAutoVisualNovelTurn("auto", {
      ignoreVoiceGate: !!options.ignoreVoiceGate
    });
  }
  function resumeAutoVisualNovelAfterModal(reason = "modal closed") {
    if (!app.settings.autoVisualNovel) return false;
    if (mainModalOpen()) return false;
    return maybeEnqueueAutoVisualNovelTurn(reason, {
      ignoreVoiceGate: true,
      allowInitial: true
    });
  }
  function maybeEnqueueAutoVisualNovelTurn(reason = "auto", options = {}) {
    if (!app.settings.autoVisualNovel) return false;
    if (gameIsOver()) {
      app.settings.autoVisualNovel = false;
      clearAutoAdvanceTimer();
      renderQuickActions();
      return false;
    }
    if (beginAutoPendingObjectiveChoice(reason)) return true;
    if (directObjectiveChoiceIsWaiting()) {
      if (beginAutoDirectObjectiveChoice(reason)) return true;
      maybeOpenObjectiveChoiceModal();
      setTurnStage("idle", "Choose story path");
      return false;
    }
    if (autoTurnQueuedOrInProgress()) return false;
    const latestAssistant = latestReadableAssistantMessage();
    const hasAutoMessage = app.messages.some(message => message.autoTurn);
    const canSendInitial = !!options.allowInitial && !hasAutoMessage;
    if (!canSendInitial && !options.ignoreVoiceGate && latestAssistant && !latestAssistantReadStarted(latestAssistant.id)) {
      app.autoAdvanceWaitingForVoiceMessageId = latestAssistant.id;
      setStatus("Auto waiting for voice to start");
      return false;
    }
    app.autoAdvanceWaitingForVoiceMessageId = null;
    clearAutoAdvanceTimer();
    if (exactAutoModeType(app.settings.autoModeType) === "take_player_turns") {
      generateAndQueueAutoPlayerTurn(reason).catch(err => {
        app.autoPlayerTurnGenerating = false;
        stateTrace("auto player turn failed", {
          label: "auto player",
          error: err.message || String(err),
          summary: err.message || String(err)
        });
        addMessage("system", "Auto player turn failed: " + (err.message || err));
        setTurnStage("error", "Auto player turn failed");
        render();
      });
      return true;
    }
    enqueueSceneDirective({
      text: "Auto visual novel",
      skipUserStateCheck: true,
      source: "auto",
      directive: continueSceneDirective("auto"),
      autoTurn: true
    });
    setStatus(`Auto visual novel queued${reason ? `: ${reason}` : ""}`);
    return true;
  }
  function autoTurnQueuedOrInProgress() {
    return queueProcessingBlocked() || app.autoPlayerTurnGenerating || app.autoDirectObjectiveChoiceInProgress || app.autoPendingObjectiveChoiceInProgress || app.activeQueueSource === "auto" || app.activeQueueSource === "auto_player" || (app.queue || []).some(item => ["auto", "auto_player"].includes(exactQueueSource(item)));
  }
  function exactQueueSource(item) {
    return exactQueueItem(item).source;
  }
  function latestReadableAssistantMessage() {
    for (let i = app.messages.length - 1; i >= 0; i--) {
      const message = app.messages[i];
      if (message?.role === "assistant" && String(message.text || "").trim()) return message;
    }
    return null;
  }
  function latestAssistantReadProgress(messageId) {
    if (!app.settings.autoVoice) return 1;
    const activeId = app.activeVoiceMessageId;
    const synth = window.speechSynthesis;
    if (String(activeId || "") === String(messageId)) return activeVoiceReadProgress(messageId);
    if (voiceUtteranceQueueHasWork() || synth && (synth.speaking || synth.pending || synth.paused)) return 0;
    return 1;
  }
  function latestAssistantReadStarted(messageId) {
    if (!app.settings.autoVoice) return true;
    // Auto mode may queue objective/status reads after the assistant starts.
    // Track the assistant by message id so the continuation gate does not
    // depend on whichever queued utterance is currently active.
    if (app.autoVoiceStartedMessageIds.has(String(messageId))) return true;
    const activeId = app.activeVoiceMessageId;
    if (String(activeId || "") === String(messageId)) return true;
    return latestAssistantReadProgress(messageId) >= 1;
  }
  function activeVoiceReadProgress(messageId = app.activeVoiceMessageId) {
    const message = findEntryById(messageId);
    const length = String(message?.text || "").trim().length;
    if (!length) return 1;
    return Math.max(0, Math.min(1, Number(app.voiceHighlightLastEnd || 0) / length));
  }
  function maybeReleaseAutoVoiceGate(messageId = app.activeVoiceMessageId) {
    if (!app.settings.autoVisualNovel) return;
    if (app.autoAdvanceWaitingForVoiceMessageId == null) return;
    if (String(app.autoAdvanceWaitingForVoiceMessageId) !== String(messageId)) return;
    if (autoTurnQueuedOrInProgress()) return;
    if (!latestAssistantReadStarted(messageId)) return;
    app.autoAdvanceWaitingForVoiceMessageId = null;
    maybeEnqueueAutoVisualNovelTurn("voice started", {
      ignoreVoiceGate: true
    });
  }
  function clearAutoAdvanceTimer() {
    if (!app.autoAdvanceTimer) return;
    clearTimeout(app.autoAdvanceTimer);
    app.autoAdvanceTimer = null;
  }
  async function forceStateSyncCatchupBeforePriorityAi(item = {}, reason = "priority AI") {
    if (!shouldForceStateSyncBeforeQueueForSmoke(item)) return false;
    const pendingCount = pendingStateSyncMessages().length;
    setTurnStage("user_state", `Catching up game state before ${reason}...`);
    await runBackgroundStateSync(`forced catch-up before ${reason} (${pendingCount} unsynced message(s))`, {
      resumeQueue: false,
      forceOneStep: true
    });
    return true;
  }
  async function generateAndQueueAutoPlayerTurn(reason = "auto") {
    if (app.autoPlayerTurnGenerating) return false;
    if (gameIsOver()) return false;
    if (!autoPlayerTurnCanStart(reason)) return false;
    app.autoPlayerTurnGenerating = true;
    setTurnStage("reply", "Writing auto player turn...");
    setStatus(`Auto player turn generating${reason ? `: ${reason}` : ""}`);
    render();
    try {
      await forceStateSyncCatchupBeforePriorityAi({
        source: "auto_player",
        text: "Auto player turn",
        visibleText: "Auto player turn"
      }, "auto player turn");
      const raw = await aiText(buildAutoPlayerTurnPrompt(), {
        label: "auto player turn",
        hasUniversalContext: true
      });
      const text = cleanAutoPlayerTurnText(raw);
      if (!text) throw new Error("Auto player turn response was blank.");
      if (autoPlayerTurnWouldDuplicateRecentPlayerMessage(text, reason)) {
        setTurnStage("idle", "Ready");
        return false;
      }
      app.queue.push({
        text,
        visibleText: text,
        skipUserStateCheck: false,
        commandOnly: false,
        source: "auto_player",
        speaker: app.state.player?.name || "Player",
        autoRead: !!app.settings.autoReadPlayerMessages,
        autoTurn: true
      });
      setStatus(`Auto player turn queued${reason ? `: ${reason}` : ""}`);
      render();
      if (!queueProcessingBlocked()) processQueue();
      return true;
    } finally {
      app.autoPlayerTurnGenerating = false;
    }
  }
  function latestStoryMessage() {
    for (let i = app.messages.length - 1; i >= 0; i--) {
      const message = app.messages[i];
      if (message && isStoryMessageRole(message.role)) return message;
    }
    return null;
  }
  function autoPlayerTurnCanStart(reason = "auto") {
    const latest = latestStoryMessage();
    if (!latest || latest.role === "assistant") return true;
    stateTrace("auto player turn blocked", {
      label: "auto player",
      reason,
      latestMessageId: latest.id,
      latestRole: latest.role,
      summary: "Auto-player turn was blocked because the latest story message is already a player message."
    });
    return false;
  }
  function normalizeAutoPlayerDuplicateText(text = "") {
    return String(text || "").toLowerCase().replace(/[??]/g, '"').replace(/[??]/g, "'").replace(/\s+/g, " ").replace(/^[\s"']+|[\s"'.!?]+$/g, "").trim();
  }
  function autoPlayerTurnWouldDuplicateRecentPlayerMessage(text = "", reason = "auto") {
    const normalized = normalizeAutoPlayerDuplicateText(text);
    if (!normalized) return false;
    const recentPlayerMessages = [...(app.messages || [])].reverse().filter(message => message?.role === "user").slice(0, 3);
    const duplicate = recentPlayerMessages.find(message => normalizeAutoPlayerDuplicateText(message.text || "") === normalized);
    if (!duplicate) return false;
    stateTrace("auto player turn blocked", {
      label: "auto player",
      reason,
      duplicateMessageId: duplicate.id,
      text,
      summary: "Auto-player turn was blocked because it duplicated a recent player message."
    });
    return true;
  }
  function cleanAutoPlayerTurnText(text = "") {
    let out = String(text || "").trim();
    out = out.replace(/^```(?:\w+)?\s*/i, "").replace(/```\s*$/i, "").trim();
    out = out.replace(/^Scene response:\s*/i, "").trim();
    const playerName = playerNameForPrompt();
    const namePattern = escapeRegExp(playerName);
    out = out.replace(new RegExp(`^${namePattern}\\s*:\\s*`, "i"), "").trim();
    out = out.replace(/^Player\s*:\s*/i, "").trim();
    return out;
  }
  function formatAutoGeneratedChoiceDialogue(text = "") {
    const cleaned = cleanAutoPlayerTurnText(text);
    if (!cleaned) return "";
    const alreadyQuoted = cleaned.startsWith('"') && cleaned.endsWith('"') || cleaned.startsWith("\u201c") && cleaned.endsWith("\u201d");
    return alreadyQuoted ? cleaned : `"${cleaned}"`;
  }
  function requestImage() {
    const request = generateImage("manual", {}).catch(err => {
      log("Image failed", err.message || err, {
        type: "image",
        level: imageRequestFailureLogLevel(err)
      });
    });
    if (!queueProcessingBlocked()) setTurnStage("idle", "Ready");
    return request;
  }
  function requestManualImage() {
    if (gameIsOver()) {
      addGameEndedBlockedMessage();
      return false;
    }
    return requestImage();
  }
  function npcInspectionActive() {
    return !!app.npcInspectionInFlight?.size;
  }
  function queueProcessingBlocked() {
    return !!app.busy || npcInspectionActive();
  }
  async function processQueue() {
    if (queueProcessingBlocked() || !app.queue.length) return;
    if (gameIsOver() && !queueItemAllowedAfterGameOver(app.queue[0])) {
      stateTrace("queued turn blocked by game over", {
        label: "queue",
        source: app.queue[0]?.source || "",
        playerDeathState: entityDeathState(app.state?.player || {}),
        gameOver: app.state?.meta?.game_over === true,
        summary: "Discarded queued turn because the current game is over."
      });
      app.queue = [];
      addGameEndedBlockedMessage();
      return;
    }
    if (!queueItemAllowedAfterGameOver(app.queue[0]) && (await forceStateSyncCatchupBeforePriorityAi(app.queue[0], "next queued message"))) {
      if (queueProcessingBlocked() || !app.queue.length) return;
    }
    app.busy = true;
    setTurnStage("reply", "Writing scene reply...");
    const queueItem = exactQueueItem(app.queue.shift());
    app.activeQueueSource = queueItem.source || "";
    const turnImageCollectorId = startTurnSceneImageCollector(queueItem.messageId || `${queueItem.source || "turn"}-${Date.now()}`);
    const userText = queueItem.text;
    let queuedUserObjectiveCheck = null;
    let queuedUserObjectiveResult = queueItem.objectiveResult || null;
    if (queueItemCreatesPlayerStoryMessage(queueItem)) {
      const userMessage = addMessage("user", queueItem.visibleText || userText, queueItem.speaker || app.state.player?.name || "Player", {
        autoTurn: !!queueItem.autoTurn,
        choiceSnapshotId: queueItem.choiceSnapshotId || "",
        choiceObjectiveId: queueItem.choiceObjectiveId || "",
        choiceTitle: queueItem.choiceTitle || ""
      });
      queueItem.messageId = userMessage.id;
      startStateSyncSession("player message finished");
      if (queueItem.autoRead && !voiceIsPaused()) readMessage(userMessage.id, {
        sequence: false
      });
      queuedUserObjectiveCheck = {
        source: "player",
        text: queueItem.visibleText || userText,
        messageId: userMessage.id,
        deferGameMessage: !queueItem.commandOnly
      };
    } else if (queueItemReferencesExistingPlayerStoryMessage(queueItem)) {
      const userMessage = findMessageById(queueItem.messageId);
      queuedUserObjectiveCheck = {
        source: exactQueueSource(queueItem),
        text: userMessage?.text || queueItem.visibleText || userText,
        messageId: queueItem.messageId,
        deferGameMessage: !queueItem.commandOnly
      };
    } else if (String(queueItem.source || "").toLowerCase() === "continue") {
      // Rule: Continue is passive player input. It may let an
      // AI-controlled plot point resolve now, but it must never
      // complete a player-controlled objective that requires the
      // player to act, choose, travel, ask, buy, or inspect.
      queuedUserObjectiveCheck = {
        source: "continue",
        text: queueItem.visibleText || userText,
        messageId: null,
        deferGameMessage: true
      };
    }
    render();
    try {
      if (queueItem.messageId && !findMessageById(queueItem.messageId)) {
        // Message deletion rule: a queued turn is owned by the player
        // message that created it. Do not mutate scene/objective state
        // or create a reply after that message has been deleted.
        cancelAiRequestsForMessage(queueItem.messageId, "triggering player message deleted");
        setTurnStage("idle", "Ready");
        return;
      }
      // Objective verification must see the real scene membership. Run
      // removals before the pre-narration objective check, while keeping
      // command and game-over paths free of scene-removal work.
      const removedBeforeReply = queueItem.commandOnly || queueItemAllowedAfterGameOver(queueItem) || ["character_chat_opening", "shop_purchase_opening"].includes(queueItem.source) ? [] : await runScenePresenceRemovalCheckSafe({
        text: queueItem.visibleText || userText,
        messageId: queueItem.messageId || null
      });
      if (queuedUserObjectiveCheck && !queuedUserObjectiveResult) queuedUserObjectiveResult = await runObjectiveCompletionFlowSafe(queuedUserObjectiveCheck);
      if (queueItem.messageId && !findMessageById(queueItem.messageId)) {
        // Objective verification can remove or roll back its triggering
        // player message. The reply belongs to that message, so stop
        // before allocating an assistant entry in that case.
        cancelAiRequestsForMessage(queueItem.messageId, "triggering player message deleted during objective check");
        setTurnStage("idle", "Ready");
        return;
      }
      if (queuedUserObjectiveResult?.blockedForObjectiveChoice && !queueItem.resumeAfterObjectiveChoice) {
        app.pendingObjectiveChoiceReply = {
          queueItem: {
            ...queueItem,
            messageId: queueItem.messageId || null,
            objectiveResult: queuedUserObjectiveResult,
            visibleText: ""
          },
          objectiveResult: queuedUserObjectiveResult,
          createdAt: new Date().toISOString()
        };
        setTurnStage("idle", "Choose the next objective");
        scheduleActiveGameSave();
        render();
        return;
      }
      if (queueItem.commandOnly) {
        setTurnStage("user_state", "Applying AI command...");
        stateTrace("queue step", {
          label: "command",
          message: userText,
          queueLength: app.queue.length,
          summary: `Starting AI command patch. Queue length after shift: ${app.queue.length}.`
        });
        const commandStateOk = await runAiCommandPatch(userText, {
          messageId: queueItem.messageId
        });
        stateTrace("queue step complete", {
          label: "command",
          result: commandStateOk,
          summary: `AI command patch completed with result: ${commandStateOk}.`
        });
        setTurnStage("idle", "Ready");
        stateTrace("AI command complete", {
          label: "command",
          message: userText,
          summary: "AI command state update completed."
        });
        return;
      }
      stateTrace("user state skipped", {
        label: "user",
        message: userText,
        queueLength: app.queue.length,
        summary: `${queueItem.source || "user"} turn skipped the user state check; state will update after the assistant reply.`
      });
      setTurnStage("reply", "Writing scene reply...");
      stateTrace("reply generation started", {
        label: "assistant",
        summary: "Requesting character reply before state update."
      });
      const replySpeaker = assistantReplySpeakerLabel();
      const replyMessage = addMessage("assistant", "", replySpeaker, {
        autoTurn: queueItem.source === "auto" || !!queueItem.autoTurn,
        replySource: queueItem.source || "user",
        relatedMessageIds: queueItem.messageId ? [queueItem.messageId] : []
      });
      app.currentReplyMode = queueItem.source || "";
      app.currentReplyDirective = queueItemAllowedAfterGameOver(queueItem) ? queueItem.directive || "" : [queueItem.directive || "", sceneRemovalNarratorDirective(removedBeforeReply), playerCompletedObjectivesNarratorDirective(queuedUserObjectiveResult), objectiveSteeringNarratorDirective(queuedUserObjectiveResult), objectiveCompletionNarratorDirective(queuedUserObjectiveResult)].map(item => String(item || "").trim()).filter(Boolean).join("\n\n");
      const reply = await generateReply(replyMessage.id, "", {
        relatedMessageIds: queueItem.messageId ? [queueItem.messageId] : []
      });
      app.justRemovedSceneCharacters = [];
      app.currentReplyDirective = "";
      app.currentReplyMode = "";
      if (!findMessageById(replyMessage.id)) {
        setTurnStage("idle", "Ready");
        return;
      }
      const inviteResult = handlePendingNpcInvite(reply);
      const finalReply = inviteResult.text;
      stateTrace("reply generation complete", {
        label: "assistant",
        response: finalReply,
        responseLength: String(finalReply || "").length,
        summary: `Reply generated with ${String(finalReply || "").length} chars.`
      });
      updateMessage(replyMessage.id, finalReply);
      if (queueItemAllowedAfterGameOver(queueItem)) {
        setTurnStage("game_over", "Game Over");
        scheduleActiveGameSave();
        render();
        return;
      }
      startStateSyncSession("assistant message finished");
      await runImmediateChecksForMutatedMessage(replyMessage, {
        text: finalReply,
        relatedMessageIds: [queueItem.messageId],
        reason: "assistant reply",
        skipObjectiveProgress: resultCompletedAiObjective(queuedUserObjectiveResult),
        objectiveSource: queueItem.source === "auto" && exactAutoModeType(app.settings.autoModeType) === "player_as_npc" ? "assistant_player_control" : "assistant"
      });
      flushDeferredObjectiveCompletionGameMessages(queuedUserObjectiveResult);
      enqueueStateSync("assistant reply");
      setTurnStage("effects", "Running voice, images, and toys...");
      await afterReplyEffects(finalReply, replyMessage.id);
      setTurnStage("idle", "Ready");
    } catch (err) {
      app.justRemovedSceneCharacters = [];
      app.currentReplyDirective = "";
      app.currentReplyMode = "";
      if (isAiCancelledError(err)) {
        setTurnStage("idle", "Ready");
        return;
      }
      stateTrace("queue error", {
        label: "processQueue",
        error: err.message || String(err),
        summary: err.message || String(err)
      });
      addMessage("system", "Error: " + (err.message || err));
      setTurnStage("error", "Error");
    } finally {
      app.busy = false;
      if (gameIsOver() && app.turnStage !== "error") setTurnStage("game_over", "Game Over");else if (app.turnStage !== "error" && !app.queue.length) setTurnStage("idle", "Ready");else renderPlayHud();
      stateTrace("queue finished", {
        label: "processQueue",
        queueLength: app.queue.length,
        summary: `Queue finished. Remaining messages: ${app.queue.length}.`
      });
      scheduleActiveGameSave();
      const pendingRegenerate = app.pendingRegenerateMessage;
      app.pendingRegenerateMessage = null;
      app.activeQueueSource = "";
      if (pendingRegenerate) {
        setTimeout(() => redoMessage(pendingRegenerate.id, pendingRegenerate.feedback), 0);
      } else if (app.queue.length && !queueProcessingBlocked()) processQueue();else if (!gameIsOver() && app.settings.autoVisualNovel && app.turnStage !== "error") maybeEnqueueAutoVisualNovelTurn("queue idle");else if (!gameIsOver() && pendingStateSyncMessages().length) enqueueStateSync("queue idle");
      if (!gameIsOver() && !app.stateSync?.running && !app.stateSync?.queued && !pendingStateSyncMessages().length) scheduleTurnSceneImageFlush(turnImageCollectorId, 900);
    }
  }
  function queueItemCreatesPlayerStoryMessage(item = {}) {
    // Invariant: player-facing action tools are normal player turns with
    // modified directives. They must get the same objective check, AI
    // priority, and post-reply state sync behavior as typed chat.
    if (!item || item.messageId || item.commandOnly) return false;
    return ["user", "choice", "invite", "auto_player", "d20", "find"].includes(String(item.source || "").toLowerCase());
  }
  function queueItemReferencesExistingPlayerStoryMessage(item = {}) {
    if (!item || !item.messageId || item.commandOnly) return false;
    const source = String(item.source || "").toLowerCase();
    if (!["user", "choice", "invite", "auto_player", "d20", "find"].includes(source)) return false;
    const message = findMessageById(item.messageId);
    return !!message && message.role === "user";
  }
  function deleteQueuedMessage(index) {
    const queueIndex = Number(index);
    if (!Number.isInteger(queueIndex) || queueIndex < 0 || queueIndex >= app.queue.length) return false;
    app.queue.splice(queueIndex, 1);
    if (queueProcessingBlocked()) setStatus(app.queue.length ? `Queued ${app.queue.length} message(s)` : "Working");else setTurnStage("idle", "Ready");
    render();
    scheduleActiveGameSave();
    return true;
  }
  const QUEUE_ITEM_FIELDS = Object.freeze(["text", "visibleText", "skipUserStateCheck", "commandOnly", "directive", "source", "speaker", "autoRead", "autoTurn", "messageId", "objectiveResult", "resumeAfterObjectiveChoice", "choiceSnapshotId", "choiceObjectiveId", "choiceTitle"]);
  function exactQueueItem(item, path = "queue item") {
    if (!isPlainObject(item)) throw new Error(`${path} must be an object.`);
    const allowed = new Set(QUEUE_ITEM_FIELDS);
    const unknown = Object.keys(item).find(field => !allowed.has(field));
    if (unknown) throw new Error(`${path}.${unknown} is not an approved field.`);
    for (const field of ["text", "visibleText", "source"]) if (typeof item[field] !== "string") throw new Error(`${path}.${field} must be text.`);
    if (!item.text) throw new Error(`${path}.text must be non-empty text.`);
    if (!item.source) throw new Error(`${path}.source must be non-empty text.`);
    for (const field of ["directive", "speaker", "choiceSnapshotId", "choiceObjectiveId", "choiceTitle"]) if (Object.hasOwn(item, field) && typeof item[field] !== "string") throw new Error(`${path}.${field} must be text when present.`);
    for (const field of ["skipUserStateCheck", "commandOnly", "autoRead", "autoTurn", "resumeAfterObjectiveChoice"]) if (Object.hasOwn(item, field) && typeof item[field] !== "boolean") throw new Error(`${path}.${field} must be true or false when present.`);
    if (Object.hasOwn(item, "messageId") && item.messageId !== null && typeof item.messageId !== "string") throw new Error(`${path}.messageId must be text or null when present.`);
    if (Object.hasOwn(item, "objectiveResult") && item.objectiveResult !== null && !isPlainObject(item.objectiveResult)) throw new Error(`${path}.objectiveResult must be an object or null when present.`);
    return item;
  }
  function stateSyncMessageEntries() {
    return (app.messages || []).filter(message => isStoryMessageRole(message.role));
  }
  function pendingStateSyncMessages() {
    // The generated opening message is the source used to build the initial state.
    // Treating it as pending later blocks Auto mode and can leak setup/future-story data
    // through an unnecessary catch-up sync, so exclude it once setup is complete.
    markOpeningMessageSyncedIfStateAlreadyBuilt();
    return stateSyncMessageEntries().filter(message => !openingMessageAlreadyPartOfState(message)).filter(message => message.stateSyncStatus !== "synced");
  }
  function shouldForceStateSyncBeforeQueue() {
    if (queueProcessingBlocked() || app.activeStateCheck || !app.queue.length) return false;
    const nextItem = exactQueueItem(app.queue[0]);
    // Backlog catch-up rule: every queued item that will produce a normal
    // narrator reply, including typed chat, auto-player turns, invite,
    // d20, and find actions, may spend exactly one state-sync step first
    // once the unsynced backlog exceeds the slack. This prevents auto or
    // rapid play from building an infinite pending-message range while
    // still yielding back to the queued reply after one step.
    if (nextItem.commandOnly) return false;
    const pendingCount = pendingStateSyncMessages().length;
    if (!pendingCount) return false;
    const completedSteps = stateSyncCompletedStepCount();
    return pendingCount > STATE_SYNC_FREE_MESSAGE_SLACK + completedSteps;
  }
  function shouldForceStateSyncBeforeQueueForSmoke(item) {
    const savedQueue = app.queue;
    try {
      app.queue = [item];
      return shouldForceStateSyncBeforeQueue();
    } finally {
      app.queue = savedQueue;
    }
  }
  function stateSyncCompletedStepCount() {
    return new Set(app.stateSync?.completedStepKeys || []).size;
  }
  function stateSyncTotalStepCount() {
    if (!app.stateSync?.running) return 0;
    const messages = (app.stateSync.processingMessageIds || []).map(id => findMessageById(id)).filter(Boolean);
    return groupedStateWorkItems(app.stateSync.stateSnapshot || app.state).length + 1 + 0;
  }
  function stateSyncStepKey(groupId, characterName = "", targetKey = "") {
    const scopedTarget = String(targetKey || characterName || "").trim();
    return scopedTarget ? `${groupId}:${scopedTarget}` : groupId;
  }
  function stateSyncMessageIdsMatch(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((id, index) => String(id) === String(b[index]));
  }
  function clearStateSyncCheckpoint() {
    app.stateSyncCheckpoint = null;
    largeRemoveStorageItem(STATE_SYNC_CHECKPOINT_KEY);
  }
  function persistStateSyncCheckpoint(reason = "state sync step") {
    if (!app.stateSync?.running) return;
    const messageIds = (app.stateSync.processingMessageIds || []).filter(id => findMessageById(id));
    if (!messageIds.length) return;
    app.stateSyncCheckpoint = {
      messageIds,
      completedStepKeys: [...new Set(app.stateSync.completedStepKeys || [])],
      lastRangeText: app.stateSync.lastRangeText || "",
      status: app.stateSync.status || "",
      currentGroup: app.stateSync.currentGroup || "",
      blockStartEntryId: Number(app.stateSync.blockStartEntryId || 0),
      blockEndEntryId: Number(app.stateSync.blockEndEntryId || 0),
      blockSnapshotId: app.stateSync.blockSnapshotId || "",
      reason,
      updatedAt: new Date().toISOString()
    };
    largeSetStorageItem(STATE_SYNC_CHECKPOINT_KEY, app.stateSyncCheckpoint, {
      json: true
    });
  }
  function checkpointStepKeysForPending(pending = []) {
    const checkpoint = app.stateSyncCheckpoint;
    const messageIds = pending.map(message => message.id);
    if (!checkpoint || !stateSyncMessageIdsMatch(checkpoint.messageIds, messageIds)) {
      clearStateSyncCheckpoint();
      return [];
    }
    return [...new Set(checkpoint.completedStepKeys || [])];
  }
  function resetOrphanStateSyncProcessing() {
    const pending = pendingStateSyncMessages();
    const checkpointIds = app.stateSyncCheckpoint?.messageIds || [];
    const pendingIds = pending.map(message => message.id);
    const hasMatchingCheckpoint = stateSyncMessageIdsMatch(checkpointIds, pendingIds);
    let changed = false;
    for (const message of pending) {
      if (message.stateSyncStatus === "processing" && !hasMatchingCheckpoint) {
        message.stateSyncStatus = "pending";
        changed = true;
      }
    }
    if (!hasMatchingCheckpoint) clearStateSyncCheckpoint();
    markOpeningMessageSyncedIfStateAlreadyBuilt();
    if (changed) saveMessageHistory();
  }
  function markOpeningMessageSyncedIfStateAlreadyBuilt() {
    if (!app.state?.meta?.setup_complete) return false;
    const storyMessages = stateSyncMessageEntries();
    if (storyMessages.length !== 1) return false;
    const opening = storyMessages[0];
    if (opening.role !== "assistant") return false;
    if (opening.stateSyncStatus === "synced" && void 0 === "synced") return false;
    opening.stateSyncStatus = "synced";
    saveMessageHistory();
    return true;
  }
  function openingMessageAlreadyPartOfState(message = null) {
    if (!app.state?.meta?.setup_complete) return false;
    const storyMessages = stateSyncMessageEntries();
    if (storyMessages.length !== 1) return false;
    if (storyMessages[0]?.role !== "assistant") return false;
    return !!message && String(message.id) === String(storyMessages[0]?.id);
  }
  function characterStateWorkItems(state = app.state) {
    const items = [{
      characterName: "Player",
      targetType: "player",
      targetKey: "player"
    }];
    const seen = new Set(["player"]);
    const partyNames = [...(state.scene?.party_members_present || []), ...(state.scene?.image_characters || [])];
    for (const name of partyNames) {
      const normalized = normalizeNameForMatch(name);
      if (!normalized || seen.has(`party:${normalized}`) || !state.characters?.[name]) continue;
      seen.add(`party:${normalized}`);
      items.push({
        characterName: name,
        targetType: "party",
        targetKey: `party:${normalized}`
      });
    }
    for (const name of state.scene?.npcs_present || []) {
      const target = findNpcEntryInState(state, name);
      if (!target?.npc?.full_character) continue;
      const targetKey = `npc:${target.locationId}:${target.key}`;
      if (seen.has(targetKey)) continue;
      seen.add(targetKey);
      items.push({
        characterName: target.npc.full_character.name || target.npc.name || name,
        targetType: "npc",
        targetKey,
        npcLocationId: target.locationId,
        npcKey: target.key
      });
    }
    return items;
  }
  function groupedStateWorkItems(state = app.state) {
    return characterStateWorkItems(state).flatMap(target => [{
      groupId: "character_body",
      ...target
    }, {
      groupId: "character_clothing",
      ...target
    }, {
      groupId: "character_mind",
      ...target
    }]).concat([{
      groupId: "story"
    }, {
      groupId: "map_npcs"
    }]);
  }
  function startStateSyncSession(reason = "state sync") {
    // State-sync lifecycle rule: finishing any player or assistant
    // message starts a state-update session immediately. Starting only
    // captures the pending message range and backup; AI processing can
    // still wait behind player-facing replies, objective checks, voice,
    // images, and other higher-priority work.
    if (app.stateSync.running) return true;
    const pending = pendingStateSyncMessages();
    if (!pending.length) return false;
    const syncGeneration = Number(app.stateSync.generation || 0) + 1;
    app.stateSync.generation = syncGeneration;
    app.stateSync.running = true;
    app.stateSync.queued = true;
    app.stateSync.startedAt = performance.now();
    const processingMessageIds = pending.map(message => message.id);
    const blockStartEntryId = Math.min(...pending.map(message => Number(message.entryId || message.id || 0)));
    const blockEndEntryId = Math.max(...pending.map(message => Number(message.entryId || message.id || 0)));
    app.stateSync.startMessageId = pending[0].id;
    app.stateSync.blockStartEntryId = blockStartEntryId;
    app.stateSync.blockEndEntryId = blockEndEntryId;
    app.stateSync.processingMessageIds = processingMessageIds;
    const blockSnapshot = createMessageStateBackup(processingMessageIds, `before background state update (${pending.length} message(s))`);
    app.stateSync.blockSnapshotId = blockSnapshot?.id || "";
    app.stateSync.completedStepKeys = checkpointStepKeysForPending(pending);
    const processingIdSet = new Set(processingMessageIds.map(String));
    for (const message of pending) {
      if (processingIdSet.has(String(message.id))) message.stateSyncStatus = "processing";
    }
    app.stateSync.lastRangeText = stateSyncRangeText(pending);
    app.stateSync.stateSnapshot = clone(app.state);
    updateStateSyncStatus(`State update started for ${pending.length} message(s). ${reason}.`);
    scheduleActiveGameSave();
    return true;
  }
  function enqueueStateSync(reason = "state sync") {
    if (!startStateSyncSession(reason)) return;
    if (app.busy || app.aiActive || app.aiQueue.length || app.activeStateCheck) {
      app.stateSync.queued = true;
      return;
    }
    app.stateSync.queued = true;
    setTimeout(() => runBackgroundStateSync(reason), 0);
  }
  function scheduleStartupStateSync(reason = "startup catch-up") {
    clearTimeout(app.startupStateSyncTimer);
    app.startupStateSyncTimer = setTimeout(() => {
      app.startupStateSyncTimer = null;
      if (!pendingStateSyncMessages().length) return;
      if (app.busy || app.aiActive || app.aiQueue.length || app.stateSync.running) {
        perfConsole("startup state sync skipped", {
          reason,
          busy: !!app.busy,
          aiActive: !!app.aiActive,
          aiQueued: app.aiQueue?.length || 0,
          running: !!app.stateSync.running
        }, "warn");
        return;
      }
      perfConsole("startup state sync starting one-step catch-up", {
        reason,
        pending: pendingStateSyncMessages().length
      }, "log");
      runBackgroundStateSync(reason, {
        forceOneStep: true,
        resumeQueue: false,
        startup: true
      });
    }, 8000);
  }
  async function runBackgroundStateSync(reason = "state sync", options = {}) {
    if (app.busy || app.activeStateCheck || app.aiActive || app.aiQueue.length) {
      app.stateSync.queued = true;
      return;
    }
    if (!startStateSyncSession(reason)) {
      app.stateSync.queued = false;
      return;
    }
    app.stateSync.queued = false;
    const syncGeneration = Number(app.stateSync.generation || 0);
    const processingMessageIds = (app.stateSync.processingMessageIds || []).filter(id => findMessageById(id));
    const pending = processingMessageIds.map(id => findMessageById(id)).filter(Boolean);
    if (!pending.length) {
      app.stateSync.running = false;
      app.stateSync.queued = false;
      return;
    }
    const processingIdSet = new Set(processingMessageIds.map(String));
    const rangeText = app.stateSync.lastRangeText || stateSyncRangeText(pending);
    app.stateSync.lastRangeText = rangeText;
    app.stateSync.stateSnapshot ||= clone(app.state);
    updateStateSyncStatus(`Updating game state from ${pending.length} message(s). ${reason}.`);
    scheduleActiveGameSave();
    try {
      const ok = await runStateCheck("assistant", rangeText, {
        background: true,
        messageIds: pending.map(message => message.id),
        stateSnapshot: app.stateSync.stateSnapshot,
        forceOneStep: !!options.forceOneStep
      });
      if (syncGeneration !== app.stateSync.generation) return;
      if (ok) {
        for (const id of processingMessageIds) {
          const current = findMessageById(id);
          if (current && processingIdSet.has(String(current.id)) && current.stateSyncStatus === "processing") current.stateSyncStatus = "synced";
        }
        updateStateSyncStatus(`State caught up through message ${pending[pending.length - 1]?.id}.`);
      } else {
        for (const id of processingMessageIds) {
          const current = findMessageById(id);
          if (current && processingIdSet.has(String(current.id)) && current.stateSyncStatus === "processing") current.stateSyncStatus = "pending";
        }
        updateStateSyncStatus("State update paused.");
      }
    } catch (err) {
      if (isAiCancelledError(err)) {
        log("Background state update cancelled", err.message || err, {
          type: "state",
          level: "message"
        });
        for (const id of processingMessageIds) {
          const current = findMessageById(id);
          if (current && processingIdSet.has(String(current.id)) && current.stateSyncStatus === "processing") current.stateSyncStatus = "pending";
        }
        return;
      }
      app.stateSync.lastFailedAt = Date.now();
      log("Background state update failed", err.message || err, {
        type: "state",
        level: "error"
      });
      for (const id of processingMessageIds) {
        const current = findMessageById(id);
        if (current && processingIdSet.has(String(current.id)) && current.stateSyncStatus === "processing") current.stateSyncStatus = "pending";
      }
    } finally {
      if (syncGeneration !== app.stateSync.generation) return;
      app.stateSync.running = false;
      app.stateSync.startMessageId = null;
      app.stateSync.blockStartEntryId = 0;
      app.stateSync.blockEndEntryId = 0;
      app.stateSync.blockSnapshotId = "";
      app.stateSync.processingMessageIds = [];
      app.stateSync.stateSnapshot = null;
      app.stateSync.currentGroup = "";
      app.stateSync.completedStepKeys = [];
      scheduleActiveGameSave();
      const recentStateSyncFailure = app.stateSync.lastFailedAt && Date.now() - app.stateSync.lastFailedAt < 30000;
      const continuingStateSync = !options.forceOneStep && !recentStateSyncFailure && !app.aiActive && !app.aiQueue.length && pendingStateSyncMessages().length;
      if (continuingStateSync) enqueueStateSync("continuing catch-up");else {
        const collector = currentTurnSceneImageCollector();
        const resumingQueue = options.resumeQueue !== false && app.queue.length;
        if (collector) {
          if (resumingQueue) flushTurnSceneImageCollector(collector.id);else scheduleTurnSceneImageFlush(collector.id, 900);
        }
        if (resumingQueue) processQueue();
      }
    }
  }
  function stateSyncRangeText(messages = []) {
    return messages.filter(message => String(message?.text || "").trim()).map(message => {
      if (message.role === "assistant") return `[${message.id}] NARRATOR:\n${message.text || ""}`;
      const speaker = promptEntityName(message.speaker || app.state.player?.name || "the player");
      return `[${message.id}] ${message.role.toUpperCase()} ${speaker}:\n${message.text || ""}`;
    }).join("\n\n");
  }
  function stateRecheckMessageRange(startMessageId, endMessageId) {
    const fallback = findMessageById(endMessageId);
    const startEntryId = Number(findMessageById(startMessageId)?.entryId || startMessageId || fallback?.entryId || fallback?.id || 0);
    const endEntryId = Number(fallback?.entryId || fallback?.id || endMessageId || startEntryId);
    if (!Number.isFinite(startEntryId) || !Number.isFinite(endEntryId) || endEntryId < startEntryId) return fallback ? [fallback] : [];
    return stateSyncMessageEntries().filter(message => {
      const entryId = Number(message.entryId || message.id || 0);
      return entryId >= startEntryId && entryId <= endEntryId;
    }).filter(message => String(message.text || "").trim());
  }
  function stateRecheckMessageRangeByEntryIds(startEntryId, endEntryId) {
    const start = Number(startEntryId || 0);
    const end = Number(endEntryId || start);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return stateSyncMessageEntries().filter(message => {
      const entryId = Number(message.entryId || message.id || 0);
      return entryId >= start && entryId <= end;
    }).filter(message => String(message.text || "").trim());
  }
  function syncedConversationContextForPrompt(limit = 6) {
    const pendingIds = new Set(pendingStateSyncMessages().map(message => String(message.id)));
    return stateSyncMessageEntries().filter(message => message.stateSyncStatus === "synced" && !pendingIds.has(String(message.id)) && String(message.text || "").trim()).slice(-limit);
  }
  function updateStateSyncStatus(text) {
    app.stateSync.status = String(text || "Updating game state");
    renderComposerGuidance();
  }
  function updateStateSyncGroup(groupId = "", text = "") {
    app.stateSync.currentGroup = String(groupId || "");
    if (text) app.stateSync.status = String(text);
    renderComposerGuidance();
  }
  function assistantReplySpeakerLabel() {
    const names = (app.state.scene?.party_members_present || []).filter(name => name && name !== "Player");
    return names.join(", ");
  }
  function handlePendingNpcInvite(replyText = "") {
    const pending = app.pendingNpcInvite;
    if (!pending?.name) return {
      text: replyText,
      accepted: false
    };
    const name = pending.name;
    const acceptPattern = new RegExp(`\\[INVITE_ACCEPTED:\\s*${escapeRegExp(name)}\\s*\\]`, "i");
    const declinePattern = new RegExp(`\\[INVITE_DECLINED:\\s*${escapeRegExp(name)}\\s*\\]`, "i");
    const accepted = acceptPattern.test(replyText);
    const declined = declinePattern.test(replyText);
    const cleaned = String(replyText || "").replace(acceptPattern, "").replace(declinePattern, "").trim();
    if (accepted) {
      const promoted = promoteNpcToParty(name);
      addGameMessage(promoted ? `${name} joined the party.` : `${name} accepted, but could not be added to the party.`, "Game");
    }
    if (declined) addGameMessage(`${name} did not join the party.`, "Game");
    if (accepted || declined) app.pendingNpcInvite = null;
    return {
      text: cleaned || replyText,
      accepted
    };
  }
  function promoteNpcToParty(name) {
    const npc = getNpcEntry(name);
    if (!npc?.full_character) return false;
    if (app.state.characters?.[name]) return true;
    app.state.characters ||= {};
    app.state.characters[name] = materializeCharacterForRuntime(npc.full_character, name);
    app.state.scene ||= {};
    app.state.scene.party_members_present = [...new Set([...(app.state.scene.party_members_present || []), name])];
    replaceSceneNpcPresence(app.state, (app.state.scene.npcs_present || []).filter(item => normalizeNameForMatch(item) !== normalizeNameForMatch(name)), "NPC promoted to party");
    // SANITIZE REPLACED: inviting an NPC to party is a known character/list mutation; validate only party/scene/profile side effects.
    // SANITIZE TEST: Covered by runtime-narrow-sanitize-smoke for the relevant narrow validator; add a workflow-specific assertion if this call changes again.
    assertRuntimeSceneReferences(app.state);
    scheduleActiveGameSave();
    queueProfileImageIfMissing(name, "joined party");
    return true;
  }
  function finalAiTextInstruction(instruction, opts = {}) {
    return opts.hasUniversalContext ? String(instruction || "") : withUniversalAiPromptContext(instruction);
  }
  function finalAiPromptLogDetails(instruction, opts = {}) {
    const prompt = finalAiTextInstruction(instruction, opts);
    const rawPrompt = String(instruction || "");
    return {
      prompt,
      promptLength: prompt.length,
      promptFingerprint: promptFingerprint(prompt),
      promptIsFinalTextSentToAi: true,
      universalContextApplied: prompt !== rawPrompt,
      universalContextOptOut: !!opts.hasUniversalContext
    };
  }
  function enqueueAiTextRequest(instruction, opts = {}) {
    const finalInstruction = finalAiTextInstruction(instruction, opts);
    const label = opts.label || inferAiLabel(finalInstruction);
    const logType = aiLogType(label, opts);
    const hasPriorityOverBackgroundState = opts.allowDuringStateSync !== true;
    if (hasPriorityOverBackgroundState) pauseBackgroundStateSyncForAi(label);
    const queuedAt = performance.now();
    const provider = exactTextProvider(opts.textProviderOverride || currentLaunchTextProvider());
    const request = {
      id: Date.now() + Math.random(),
      label,
      logType,
      instruction: finalInstruction,
      opts,
      provider,
      providerEndpoint: provider === "local-codex" ? String(app.settings?.localCodexTextUrl || defaultSettings.localCodexTextUrl || "").trim() : "perchance",
      gameRuntimeGeneration: app.gameRuntimeGeneration,
      queuedAt,
      promptEditorSnapshot: app.settings?.devMode ? promptEditorSnapshotForReplay({
        sourceLabel: label,
        opts: clone(opts || {}),
        promptEditorReplay: clone(opts.promptEditorReplay || {})
      }) : null,
      promptChars: String(finalInstruction || "").length,
      processLabel: aiProcessLabel(label, opts),
      queuePositionAtEnqueue: app.aiQueue.length + 1
    };
    return new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
      app.aiQueue.push(request);
      if (typeof opts.onQueueStatus === "function") {
        opts.onQueueStatus({
          label,
          position: app.aiQueue.length,
          activeLabel: app.aiActive?.label || ""
        });
      }
      log(aiLogTitle(logType, "queued"), standardAiTimingText(request, {
        status: "queued",
        queuePosition: app.aiQueue.length
      }), {
        type: logType,
        level: "message"
      });
      render();
      if (hasPriorityOverBackgroundState) preemptBackgroundStateAiForPriority(label);
      runNextAiTextRequest();
    });
  }
  function aiCancelledError(messageId, reason = "cancelled") {
    const err = new Error(`AI request cancelled: ${reason}`);
    err.name = "AbortError";
    err.code = "AI_CANCELLED";
    err.messageId = messageId;
    return err;
  }
  function isAiCancelledError(err) {
    return err?.code === "AI_CANCELLED" || err?.name === "AbortError" || /AI request cancelled/i.test(err?.message || "");
  }
  function aiRequestMatchesMessage(request, messageId) {
    if (!request || messageId == null) return false;
    const id = String(messageId);
    return String(request.opts?.messageId || "") === id || Array.isArray(request.opts?.relatedMessageIds) && request.opts.relatedMessageIds.some(relatedId => String(relatedId) === id);
  }
  function messageIsGenerating(messageId) {
    return !!(aiRequestMatchesMessage(app.aiActive, messageId) && !app.aiActive?.opts?.cancelled && !app.aiActive?.cancelled);
  }
  function messageIsActivelyGenerating(messageId) {
    return !!(messageIsGenerating(messageId) && app.aiActive?.opts?.onStream && Number(app.aiActive?.streamedChars || 0) > 0);
  }
  function stopGeneratingMessage(messageId) {
    const message = findMessageById(messageId);
    if (!message || message.role !== "assistant") return false;
    if (!aiRequestMatchesMessage(app.aiActive, messageId)) return false;
    const text = String(message.text || "");
    cancelAiRequestsForMessage(messageId, "message generation stopped");
    app.stoppedVoiceMessageIds.add(String(messageId));
    clearPendingVoiceMetadataGate(messageId);
    message.generationStopped = true;
    message.hiddenWhileRegenerating = false;
    message.text = text;
    message.stateSyncStatus = "pending";
    scheduleActiveGameSave();
    setStatus("Stopping generation...");
    render();
    return true;
  }
  function cancelAiRequestsForMessage(messageId, reason = "cancelled") {
    if (messageId == null) return false;
    const id = String(messageId);
    app.cancelledAiMessageIds.add(id);
    let cancelled = false;
    const remaining = [];
    for (const request of app.aiQueue || []) {
      if (aiRequestMatchesMessage(request, id)) {
        request.opts.cancelled = true;
        request.opts.cancelReason = reason;
        request.cancelReason = reason;
        request.reject?.(aiCancelledError(id, reason));
        cancelled = true;
      } else {
        remaining.push(request);
      }
    }
    app.aiQueue = remaining;
    if (aiRequestMatchesMessage(app.aiActive, id)) {
      app.aiActive.opts.cancelled = true;
      app.aiActive.opts.cancelReason = reason;
      app.aiActive.cancelReason = reason;
      // The provider stream may not settle promptly after its consumer
      // is cancelled. Reject the queued public promise immediately so
      // edit/delete/regenerate can continue without waiting for stale
      // output to finish in the background.
      app.aiActive.reject?.(aiCancelledError(id, reason));
      cancelled = true;
    }
    if (cancelled) {
      log("AI request cancellation requested", `${reason}: ${id}`, {
        type: "ai",
        level: "message"
      });
    }
    return cancelled;
  }
  function clearStaleAiCancellationForMessage(messageId) {
    // Regenerate intentionally cancels stale work for a message, then reuses
    // that same message id for the replacement AI request. The stale cancel
    // token must not poison the new request.
    if (messageId != null) app.cancelledAiMessageIds.delete(String(messageId));
  }
  function clearStaleAiCancellationForExistingMessages(messageIds = []) {
    for (const messageId of Array.isArray(messageIds) ? messageIds : [messageIds]) {
      if (messageId == null) continue;
      if (findMessageById(messageId)) clearStaleAiCancellationForMessage(messageId);
    }
  }
  function runNextAiTextRequest() {
    if (app.aiActive || !app.aiQueue.length) return;
    const request = app.aiQueue.shift();
    if (request.gameRuntimeGeneration !== app.gameRuntimeGeneration || request.opts?.cancelled) {
      request.cancelled = true;
      request.reject?.(aiCancelledError(request.opts?.messageId, "game changed"));
      runNextAiTextRequest();
      return;
    }
    request.startedAt = performance.now();
    app.aiActive = request;
    setStatus(`Using AI: ${request.label}`);
    if (typeof request.opts.onQueueStatus === "function") {
      request.opts.onQueueStatus({
        label: request.label,
        position: 0,
        activeLabel: request.label,
        waitedMs: Math.round(performance.now() - request.queuedAt)
      });
    }
    log(aiLogTitle(request.logType, "started"), standardAiTimingText(request, {
      status: "started",
      queuePosition: 0
    }), {
      type: request.logType,
      level: "message"
    });
    syncThreadAiWorkingIndicator();
    runAiTextNow(request.instruction, request.opts).then(text => {
      if (request.gameRuntimeGeneration !== app.gameRuntimeGeneration || request.opts?.cancelled) {
        request.cancelled = true;
        request.reject(aiCancelledError(request.opts?.messageId, "game changed"));
        return;
      }
      request.finishedAt = performance.now();
      request.responseChars = String(text || "").length;
      request.resolve(text);
    }).catch(err => {
      request.finishedAt = performance.now();
      if (isAiCancelledError(err)) {
        request.cancelled = true;
        log(aiLogTitle(request.logType, "cancelled"), standardAiTimingText(request, {
          status: "cancelled",
          error: err.message || err
        }), {
          type: request.logType,
          level: "message"
        });
        request.reject(err);
        return;
      }
      request.failed = true;
      const message = err.message || String(err);
      log(aiLogTitle(request.logType, "failed"), standardAiTimingText(request, {
        status: "failed",
        error: message
      }), {
        type: request.logType,
        level: request.opts?.nonCriticalFailure ? "warning" : "error"
      });
      request.reject(err);
    }).finally(() => {
      if (request.gameRuntimeGeneration !== app.gameRuntimeGeneration) {
        if (app.aiActive === request) app.aiActive = null;
        return;
      }
      if (!request.opts.cancelled && !request.cancelled && !request.failed) log(aiLogTitle(request.logType, "finished"), standardAiTimingText(request, {
        status: "finished",
        remainingQueued: app.aiQueue.length
      }), {
        type: request.logType,
        level: "message"
      });
      if (app.statusText === `Using AI: ${request.label}`) {
        setStatus("Ready");
      }
      // A background state request can be preempted for a player-facing
      // reply. Its original plugin promise may still finish later, so it
      // must not clear a newer active AI request.
      if (app.aiActive === request) {
        app.aiActive = null;
        if (request.opts?.messageId != null) syncMessageGenerationActions(request.opts.messageId);
        syncThreadAiWorkingIndicator();
        runNextAiTextRequest();
      }
      if (!app.aiActive && !app.aiQueue.length && app.stateSync?.queued && pendingStateSyncMessages().length) {
        enqueueStateSync("resuming after higher priority AI");
      }
    });
  }
  function aiProcessLabel(label = "", opts = {}) {
    return opts.processLabel || opts.process || opts.workflow || label || "AI request";
  }
  function aiTimingSummary(request = {}, extra = {}) {
    const now = performance.now();
    const queuedAt = Number(request.queuedAt || now);
    const startedAt = Number(request.startedAt || now);
    const finishedAt = Number(request.finishedAt || 0) || (extra.status === "queued" ? queuedAt : now);
    const firstStreamAt = Number(request.firstStreamAt || 0);
    const pluginStartedAt = Number(request.pluginStartedAt || 0);
    const activeDurationMs = request.startedAt && request.finishedAt ? Math.round(finishedAt - startedAt) : request.startedAt ? Math.round(now - startedAt) : 0;
    return {
      status: extra.status || "timing",
      label: request.label || "",
      process: request.processLabel || request.label || "",
      type: request.logType || "",
      queuePosition: extra.queuePosition ?? request.queuePositionAtEnqueue ?? "",
      remainingQueued: extra.remainingQueued ?? (app.aiQueue || []).length,
      promptChars: Number(request.promptChars || 0),
      responseChars: Number(extra.responseChars ?? request.responseChars ?? 0),
      streamedChars: Number(request.streamedChars || 0),
      queueWaitMs: request.startedAt ? Math.round(startedAt - queuedAt) : Math.round(now - queuedAt),
      activeDurationMs,
      totalSinceQueuedMs: extra.status === "queued" ? 0 : Math.round(finishedAt - queuedAt),
      pluginStartMs: pluginStartedAt ? Math.round(pluginStartedAt - startedAt) : "",
      firstStreamMs: firstStreamAt ? Math.round(firstStreamAt - startedAt) : "",
      firstStreamTotalMs: firstStreamAt ? Math.round(firstStreamAt - queuedAt) : "",
      provider: request.provider || "",
      providerEndpoint: request.providerEndpoint || "",
      error: extra.error ? String(extra.error) : ""
    };
  }
  function standardAiTimingText(request = {}, extra = {}) {
    // Timing log contract: every aiText request reports the same fields
    // so slow steps can be compared across chat, state, repairs, voice,
    // image decisions, and story generation without bespoke timers.
    const data = aiTimingSummary(request, extra);
    const lines = [`Label: ${data.label}`, `Process: ${data.process}`, `Status: ${data.status}`, `Type: ${data.type}`, `Queue position: ${data.queuePosition}`, `Remaining queued AI calls: ${data.remainingQueued}`, `Provider: ${data.provider || "unknown"}`, `Provider endpoint: ${data.providerEndpoint || "unknown"}`, `Prompt chars: ${data.promptChars.toLocaleString()}`, `Response chars: ${data.responseChars.toLocaleString()}`, `Streamed chars: ${data.streamedChars.toLocaleString()}`, `Queue wait: ${data.queueWaitMs.toLocaleString()}ms`, `Active duration: ${data.activeDurationMs.toLocaleString()}ms`, `Total since queued: ${data.totalSinceQueuedMs.toLocaleString()}ms`];
    if (data.pluginStartMs !== "") lines.push(`Plugin start delay: ${data.pluginStartMs.toLocaleString()}ms`);
    if (data.firstStreamMs !== "") lines.push(`First stream: ${data.firstStreamMs.toLocaleString()}ms active / ${data.firstStreamTotalMs.toLocaleString()}ms total`);
    if (data.error) lines.push(`Error: ${data.error}`);
    return lines.join("\n");
  }
  async function aiText(instruction, opts = {}) {
    return enqueueAiTextRequest(instruction, opts);
  }
  function exactTextProvider(value) {
    if (value !== "local-codex" && value !== "perchance") throw new Error('textProvider must be exactly "local-codex" or "perchance".');
    return value;
  }
  function localCodexTextLaunchEnabled() {
    if (app.devForceLocalCodexTextLaunch) return true;
    return new URLSearchParams(location.search).get("localCodexText") === "1";
  }
  function currentLaunchTextProvider() {
    return localCodexTextLaunchEnabled() ? "local-codex" : "perchance";
  }
  function exactLocalCodexTextModel(value) {
    if (typeof value !== "string" || !Object.hasOwn(LOCAL_CODEX_TEXT_MODELS, value)) throw new Error(`localCodexTextModel must be one of: ${Object.keys(LOCAL_CODEX_TEXT_MODELS).join(", ")}.`);
    return value;
  }
  function exactLocalCodexTextEffort(value) {
    if (!["light", "medium", "high", "extra_high"].includes(value)) throw new Error('localCodexTextEffort must be exactly "light", "medium", "high", or "extra_high".');
    return value;
  }
  function localCodexRuntimeTextModel(value = "") {
    return LOCAL_CODEX_TEXT_MODELS[exactLocalCodexTextModel(value)];
  }
  function localCodexRuntimeTextEffort(value = "") {
    const normalized = exactLocalCodexTextEffort(value);
    return {
      light: "low",
      medium: "medium",
      high: "high",
      extra_high: "xhigh"
    }[normalized] || "low";
  }
  function normalizeAiTextOutput(text = "") {
    return String(text || "").replace(/\u2014/g, "\u2E3A");
  }
  function localCodexTextEndpoints(configuredEndpoint = "") {
    const configured = String(configuredEndpoint || "").trim();
    const endpoints = configured ? [configured] : [];
    if (/^https:\/\/(?:localhost|127\.0\.0\.1):51829\/api\/text\/generate\/?$/i.test(configured)) endpoints.push("http://127.0.0.1:51820/api/text/generate");else if (/^http:\/\/(?:localhost|127\.0\.0\.1):51820\/api\/text\/generate\/?$/i.test(configured)) endpoints.push("https://localhost:51829/api/text/generate");
    return [...new Set(endpoints)];
  }
  async function runAiTextNow(instruction, opts = {}) {
    const label = opts.label || inferAiLabel(instruction);
    const logType = aiLogType(label, opts);
    const activeRequest = app.aiActive?.opts === opts ? app.aiActive : null;
    let streamedText = "";
    let sawStreamChunk = false;
    const requestMessageId = opts.messageId;
    const cancellationReason = () => opts.cancelReason || opts.reason || "cancelled";
    const isCancelled = () => !!opts.cancelled || requestMessageId != null && app.cancelledAiMessageIds.has(String(requestMessageId));
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const aiPluginIframeError = err => /contentWindow|iframe was not ready|iframe.*removed/i.test(err?.message || String(err || ""));
    const aiStopReasonSucceeded = data => {
      const reason = String(data?.stopReason || "").trim().toLowerCase();
      return !reason || ["natural", "stop", "complete", "completed"].includes(reason);
    };
    const resetStreamForRetry = attempt => {
      streamedText = "";
      sawStreamChunk = false;
      if (activeRequest) activeRequest.streamedChars = 0;
      opts.onStream?.("", "", false, {
        reset: true,
        retryAttempt: attempt
      });
    };
    const streamValueFromChunk = data => {
      if (data == null) return "";
      if (typeof data === "string") return data;
      if (typeof data === "number" || typeof data === "boolean") return String(data);
      return String(data.textChunk ?? data.chunk ?? data.delta ?? data.text ?? data.generatedText ?? data.response ?? data.output ?? data.value ?? "");
    };
    const handleStreamUpdate = (...args) => {
      if (isCancelled()) return;
      if (!opts.onStream) return;
      const data = args.length > 1 ? args.find(item => streamValueFromChunk(item)) ?? args[0] : args[0];
      const value = normalizeAiTextOutput(streamValueFromChunk(data));
      if (!value) return;
      sawStreamChunk = true;
      if (activeRequest && !activeRequest.firstStreamAt) activeRequest.firstStreamAt = performance.now();
      const hasDeltaChunk = typeof data === "string" || data?.textChunk != null || data?.chunk != null || data?.delta != null;
      let delta = value;
      if (hasDeltaChunk) {
        streamedText += value;
      } else if (value.startsWith(streamedText)) {
        delta = value.slice(streamedText.length);
        streamedText = value;
      } else {
        streamedText += value;
      }
      if (activeRequest) activeRequest.streamedChars = streamedText.length;
      if (!delta) return;
      opts.onStream(streamedText, delta, false);
    };
    const options = {
      startWith: opts.startWith || "",
      hideStartWith: opts.hideStartWith ?? true,
      stopSequences: opts.stopSequences || []
    };
    if (opts.onStream) {
      options.onChunk = handleStreamUpdate;
    }
    devLog("AI prompt", aiPromptDevLogDetail(label, instruction));
    try {
      if (isCancelled()) throw aiCancelledError(requestMessageId, cancellationReason());
      if (exactTextProvider(opts.textProviderOverride || currentLaunchTextProvider()) === "local-codex") {
        if (typeof opts.onPluginStart === "function") {
          opts.onPluginStart({
            label
          });
        }
        if (activeRequest) activeRequest.pluginStartedAt = performance.now();
        const endpoint = String(app.settings?.localCodexTextUrl || defaultSettings.localCodexTextUrl).trim();
        if (!endpoint) throw new Error("Local Codex text provider URL is not configured.");
        const providerEndpoints = localCodexTextEndpoints(endpoint);
        let response = null;
        let data = null;
        let lastProviderError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt) resetStreamForRetry(attempt + 1);
          const attemptEndpoint = providerEndpoints[Math.min(attempt, providerEndpoints.length - 1)];
          try {
            response = await fetch(attemptEndpoint, {
              method: "POST",
              targetAddressSpace: "loopback",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                instruction: String(instruction || ""),
                label,
                model: localCodexRuntimeTextModel(app.settings?.localCodexTextModel),
                effort: localCodexRuntimeTextEffort(app.settings?.localCodexTextEffort),
                startWith: opts.startWith || "",
                stopSequences: opts.stopSequences || []
              })
            });
            data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || `Local Codex text provider returned HTTP ${response.status}.`);
            if (!aiStopReasonSucceeded(data)) throw new Error(`${label} returned stopReason=${data.stopReason}: ${String(data?.generatedText || data?.text || data?.response || "").trim()}`);
            const candidate = String(data?.generatedText || data?.text || data?.response || "").trim();
            if (!candidate) throw new Error("Local Codex text provider returned an empty response.");
            lastProviderError = null;
            if (activeRequest) activeRequest.pluginAttempts = attempt + 1;
            break;
          } catch (err) {
            lastProviderError = err;
            if (activeRequest) activeRequest.pluginAttempts = attempt + 1;
            if (attempt >= 1) break;
            log("Local Codex AI retry", `${label}\n${err?.message || String(err)}\nRetrying 2/2 through ${providerEndpoints[Math.min(attempt + 1, providerEndpoints.length - 1)]}...`, {
              type: logType,
              level: "message"
            });
            await delay(700);
          }
        }
        if (lastProviderError) {
          const message = lastProviderError?.message || String(lastProviderError);
          if (/failed to fetch/i.test(message)) throw new Error(`Local Codex text provider could not connect through ${providerEndpoints.join(" or ")}. Run start-emberadventures-lite-local-codex-text.bat; if it configures browser access, close every Chrome and Edge window before running it again. Otherwise launch the normal Perchance version. ${message}`);
          throw lastProviderError;
        }
        if (isCancelled()) throw aiCancelledError(requestMessageId, cancellationReason());
        const rawText = String(data?.generatedText || data?.text || data?.response || "").trim();
        const processedText = normalizeAiTextOutput(rawText).trim();
        if (!processedText) throw new Error("Local Codex text provider returned an empty response.");
        if (activeRequest) {
          activeRequest.responseChars = processedText.length;
          activeRequest.pluginAttempts = activeRequest.pluginAttempts || 1;
        }
        if (app.settings?.devMode) {
          rememberPromptEditorAiCall("text", {
            label,
            promptType: label,
            prompt: String(instruction || ""),
            options: clone(options),
            snapshot: activeRequest?.promptEditorSnapshot || promptEditorSnapshotForReplay({
              sourceLabel: label
            }),
            response: processedText,
            provider: "local-codex",
            at: new Date().toISOString()
          });
        }
        log(aiLogTitle(logType, "raw response before processing"), `Label: ${label}\nProvider: Local Codex\n${standardAiTimingText(activeRequest || {
          label,
          logType,
          processLabel: aiProcessLabel(label, opts),
          promptChars: String(instruction || "").length,
          queuedAt: performance.now(),
          startedAt: performance.now(),
          responseChars: processedText.length
        }, {
          status: "raw_response",
          responseChars: processedText.length
        })}\n\n${rawText}`, {
          type: logType,
          level: "message"
        });
        let text = processedText;
        if (opts.startWith && !text.startsWith(opts.startWith.trim())) text = opts.startWith + text;
        if (opts.onStream) opts.onStream(text, text, true);
        devLog("AI response", aiResponseDevLogDetail(label, text, data));
        return text.trim();
      }
      if (!perchancePlugin("aiTextPlugin")) {
        throw new Error("Perchance aiTextPlugin is not available yet. Reload the generator, then try again.");
      }
      if (typeof opts.onPluginStart === "function") {
        opts.onPluginStart({
          label
        });
      }
      if (activeRequest) activeRequest.pluginStartedAt = performance.now();
      await prepareAiTextPluginFrame(!!opts.onStream);
      let data = null;
      let lastPluginErr = null;
      let pluginAttempt = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        pluginAttempt = attempt + 1;
        if (attempt) resetStreamForRetry(attempt + 1);
        try {
          const aiPlugin = perchancePlugin("aiTextPlugin");
          if (!aiPlugin) {
            throw new Error("Perchance aiTextPlugin is not available yet. Reload the generator, then try again.");
          }
          // Do not wrap Perchance AI calls in a wall-clock timeout.
          // Long streamed responses are valid during story generation;
          // killing them mid-stream corrupts world/story setup.
          data = await aiPlugin({
            instruction,
            ...options
          });
          const candidateText = String(data?.generatedText || data?.text || streamedText || data?.response || (typeof data === "string" ? data : "") || "").trim();
          const successfulStopReason = aiStopReasonSucceeded(data);
          if ((!candidateText || !successfulStopReason) && attempt < 1) {
            if (activeRequest) activeRequest.pluginAttempts = pluginAttempt;
            log("Perchance AI retry", `${label}\nPerchance AI ${candidateText ? `returned stopReason=${data?.stopReason || "unknown"}` : "returned an empty response"}. Retrying 2/2...`, {
              type: logType,
              level: "message"
            });
            await delay(700);
            continue;
          }
          lastPluginErr = null;
          break;
        } catch (pluginErr) {
          if (activeRequest) activeRequest.pluginAttempts = pluginAttempt;
          if (!aiPluginIframeError(pluginErr) || attempt >= 1) throw pluginErr;
          lastPluginErr = pluginErr;
          log("Perchance AI retry", `${label}\nPerchance AI iframe was not ready. Retrying 2/2...`, {
            type: logType,
            level: "message"
          });
          initializeAiTextPlugin();
          await delay(700);
        }
      }
      if (lastPluginErr) throw lastPluginErr;
      if (isCancelled()) throw aiCancelledError(requestMessageId, cancellationReason());
      const errorText = String(data?.generatedText || data?.text || streamedText || data?.response || "").trim();
      if (!aiStopReasonSucceeded(data)) {
        throw new Error(`${label} returned stopReason=${data?.stopReason || "unknown"}: ${errorText}`);
      }
      const rawText = String(data?.generatedText || data?.text || streamedText || data?.response || (typeof data === "string" ? data : "") || "").trim();
      const processedText = normalizeAiTextOutput(rawText).trim();
      if (!processedText) throw new Error(`${label} returned an empty response after 2 attempts.`);
      if (activeRequest) {
        activeRequest.responseChars = processedText.length;
        activeRequest.pluginAttempts = activeRequest.pluginAttempts || pluginAttempt || 1;
      }
      if (app.settings?.devMode) {
        rememberPromptEditorAiCall("text", {
          label,
          promptType: label,
          prompt: String(instruction || ""),
          options: clone(options),
          snapshot: activeRequest?.promptEditorSnapshot || promptEditorSnapshotForReplay({
            sourceLabel: label
          }),
          response: processedText,
          at: new Date().toISOString()
        });
      }
      log(aiLogTitle(logType, "raw response before processing"), `Label: ${label}\n${standardAiTimingText(activeRequest || {
        label,
        logType,
        processLabel: aiProcessLabel(label, opts),
        promptChars: String(instruction || "").length,
        queuedAt: performance.now(),
        startedAt: performance.now(),
        responseChars: processedText.length
      }, {
        status: "raw_response",
        responseChars: processedText.length
      })}\n\n${rawText}`, {
        type: logType,
        level: "message"
      });
      let text = processedText;
      if (opts.startWith && !text.startsWith(opts.startWith.trim())) text = opts.startWith + text;
      if (opts.onStream && !sawStreamChunk) opts.onStream(text, text, true);else if (opts.onStream) opts.onStream(text, "", true);
      devLog("AI response", aiResponseDevLogDetail(label, text, data));
      return text.trim();
    } catch (err) {
      if (isAiCancelledError(err)) throw err;
      const message = err.message || String(err);
      const friendlyMessage = /contentWindow/i.test(message) ? "Perchance AI plugin iframe was not ready or was removed while generating. Reload the generator and try again." : message;
      devLog("AI error", {
        label,
        error: message,
        summary: friendlyMessage
      });
      throw new Error(friendlyMessage);
    }
  }
  function inferAiLabel() {
    return "aiText";
  }
  function aiLogType(label, opts = {}) {
    if (opts.logType) return opts.logType;
    const exactTypes = {
      "character reply": "ai",
      "opening scene": "ai",
      "state check": "state",
      "state repair": "state",
      "thread summary": "state",
      "character generation": "system",
      "world generation": "state",
      aiText: "system"
    };
    const exact = exactTypes[String(label || "").trim()];
    if (exact) return exact;
    return "system";
  }
  function aiLogTitle(type, action) {
    const names = {
      ai: "Chat AI",
      state: "State AI",
      command: "Command AI",
      image: "Image AI",
      voice: "Voice AI",
      system: "System AI"
    };
    return `${names[type] || "System AI"} ${action}`;
  }
  function cancelActiveStateCheckForMessage(messageId, reason = "cancelled") {
    const check = app.activeStateCheck;
    if (!check || !(String(check.messageId || "") === String(messageId) || (check.messageIds || []).some(id => String(id) === String(messageId)))) return false;
    check.cancelled = true;
    check.reason = reason;
    check.cancel?.();
    stateTrace("state check cancelled", {
      label: check.source || "state",
      messageId,
      reason,
      summary: `Cancelled state check because ${reason}.`
    });
    log("State check cancelled", reason, {
      type: "state",
      level: "message"
    });
    return true;
  }
  function pauseBackgroundStateSyncForAi(label = "AI request") {
    const check = app.activeStateCheck;
    if (!app.stateSync?.running || !check) return false;
    const reason = `${label} has priority over background state update`;
    check.cancelled = true;
    check.reason = reason;
    app.stateSync.queued = true;
    updateStateSyncStatus(`State update paused for ${label}.`);
    stateTrace("state check paused", {
      label: check.source || "state",
      reason,
      summary: `Paused background state update because ${label} needs the AI channel.`
    });
    log("State update paused", reason, {
      type: "state",
      level: "message"
    });
    check.cancel?.();
    return true;
  }
  function preemptBackgroundStateAiForPriority(label = "AI request") {
    const request = app.aiActive;
    if (!request) return false;
    // Priority rule: background state sync must never trap a real player
    // turn behind a long state-group request. We can cancel the app-level
    // state check and release the queue slot; the underlying Perchance
    // promise may finish later, but its finally block is guarded so it
    // cannot clobber the newer active request.
    if (request.logType !== "state" || request.opts?.allowDuringStateSync !== true || !app.activeStateCheck) return false;
    request.opts ||= {};
    request.opts.cancelled = true;
    request.cancelled = true;
    const activeLabel = request.label || "background state update";
    app.activeStateCheck.cancelled = true;
    app.activeStateCheck.reason = `${label} preempted ${activeLabel}`;
    app.activeStateCheck.cancel?.();
    app.aiActive = null;
    app.stateSync.queued = true;
    updateStateSyncStatus(`State update paused for ${label}.`);
    log("State update preempted", `${label} took priority over ${activeLabel}.`, {
      type: "state",
      level: "message"
    });
    render();
    runNextAiTextRequest();
    return true;
  }
  function reportObjectiveRewardFailure(error, options = {}) {
    if (!error?.objectiveRewardFailure) return false;
    if (error.objectiveRewardReported) return true;
    error.objectiveRewardReported = true;
    reportAppIssue(error, {
      title: "Objective Reward Failed",
      type: "state",
      context: "objective reward",
      details: {
        ...(error.objectiveRewardDetails || {}),
        messageId: options.messageId || null
      }
    });
    return true;
  }
  async function runObjectiveCompletionFlowSafe(options = {}) {
    try {
      return await runObjectiveCompletionFlow(options);
    } catch (err) {
      const reported = reportObjectiveRewardFailure(err, options);
      stateTrace("objective quick check failed", {
        label: `${options.source || "message"} objective check`,
        messageId: options.messageId || null,
        error: err.message || String(err),
        summary: reported ? "Objective reward preflight failed. The reward transaction was rolled back and an error popup was shown." : "Objective completion check failed; continuing the turn without objective changes."
      });
      return null;
    }
  }
  async function evaluateAiObjectivesOnActivation() {
    const results = [];
    const evaluatedIds = new Set();
    const maxEvaluations = 24;
    while (results.length < maxEvaluations) {
      const objective = currentObjectiveTarget(app.state);
      if (!objectiveEvaluatesAiOnActivation(objective)) break;
      if (!objectiveCompletionRequirementsMet(objective, app.state)) break;
      app.objectiveRuntime ||= createEmptyObjectiveRuntime();
      app.objectiveRuntime.activationAiCheckAttemptedById ||= {};
      if (app.objectiveRuntime.activationAiCheckAttemptedById[objective.id] === true) break;
      if (evaluatedIds.has(objective.id)) {
        log("AI objective activation cycle blocked", `Objective ${objective.title || objective.id} became active again while evaluating activation-triggered AI objectives.`, {
          type: "state",
          level: "warning"
        });
        break;
      }
      evaluatedIds.add(objective.id);
      app.objectiveRuntime.activationAiCheckAttemptedById[objective.id] = true;
      markRuntimeRecordDirty("objective-runtime", "current");
      bumpDomainRevision("objectives");
      const result = await runObjectiveCompletionPassSafe({
        source: "activation",
        phase: "activation",
        suppressGameMessage: true,
        autoActivation: true
      });
      if (!result?.completed) break;
      results.push(result);
    }
    if (results.length === maxEvaluations) log("AI objective activation limit reached", "Stopped an unusually long chain of activation-triggered AI objectives.", {
      type: "state",
      level: "warning"
    });
    return results;
  }
  function resultCompletedAiObjective(result = null) {
    const completedResults = Array.isArray(result?.completedResults) ? result.completedResults : [result];
    return completedResults.some(item => {
      const completed = item?.completed || {};
      return !!completed.id && objectiveCompletionControl(completed, item?.completionControl || "player") === "ai";
    });
  }
  async function runObjectiveCompletionFlow(options = {}) {
    const normalizedSource = String(options.source || "").toLowerCase();
    if (normalizedSource === "continue") return await runObjectiveCompletionPass({
      ...options,
      phase: "pre"
    });
    const canCheckPlayerObjective = ["player", "user", "auto_player", "invite", "d20", "find"].includes(normalizedSource);
    if (!canCheckPlayerObjective) return await runObjectiveCompletionPass(options);
    const aggregate = {
      checked: false,
      source: options.source || "message",
      completedResults: [],
      finalCheckResult: null,
      objectiveGameMessages: [],
      deferObjectiveModals: !!options.deferGameMessage,
      blockedForObjectiveChoice: false,
      stoppedReason: ""
    };
    const objective = currentObjectiveTarget(app.state);
    if (!objective || !objective.id || objectiveIsComplete(objective)) {
      aggregate.stoppedReason = "no_current_objective";
      return null;
    }
    const control = objectiveCompletionControl(objective);
    if (control !== "player" && control !== "ai") {
      aggregate.stoppedReason = `${control}_objective_not_prechecked`;
      return null;
    }
    const result = await runObjectiveCompletionPass({
      ...options,
      deferGameMessage: true,
      phase: "pre"
    });
    aggregate.checked = !!result;
    if (result?.completed) {
      aggregate.completedResults.push(result);
      if (result.objectiveGameMessage) aggregate.objectiveGameMessages.push(result.objectiveGameMessage);
      aggregate.deferObjectiveModals = aggregate.deferObjectiveModals || !!result.deferObjectiveModals;
      aggregate.stoppedReason = `${control}_objective_complete`;
    } else if (result?.progress) {
      aggregate.finalCheckResult = result;
      aggregate.stoppedReason = `${control}_objective_progress`;
    } else {
      aggregate.finalCheckResult = result || null;
      aggregate.stoppedReason = `${control}_objective_not_complete`;
    }
    if (app.state.objectives?.pending_choice) {
      if (pendingObjectiveChoiceIsDirect(app.state)) {
        aggregate.stoppedReason = "direct_choice_required";
      } else {
        aggregate.blockedForObjectiveChoice = true;
        aggregate.stoppedReason = "objective_choice_required";
        maybeOpenObjectiveChoiceModal();
      }
    }
    return aggregate.checked ? aggregate : null;
  }
  async function runObjectiveCompletionPass({
    source = "message",
    text = "",
    messageId = null,
    deferGameMessage = false,
    phase = "",
    suppressGameMessage = false,
    autoActivation = false
  } = {}) {
    // Objective completion must be decided only by this verifier path.
    // Both player-controlled and AI-controlled objectives are decided from
    // the player turn before narration. The narrator then receives the
    // completion directive only when that decision is affirmative.
    if (!app.state?.meta?.setup_complete) return true;
    const objective = currentObjectiveTarget(app.state);
    if (!objective || !objective.id || objectiveIsComplete(objective)) return null;
    if (!objectiveCompletionRequirementsMet(objective, app.state)) {
      troubleshootingLog("objective completion blocked by requirements", {
        objectiveId: objective.id,
        requirements: storyRequirementResults(objectiveCompletionRequirements(objective), app.state)
      });
      return {
        checked: false,
        completed: null,
        blockedByCompletionRequirements: true,
        reason: objectiveCompletionRequirementsText(objective, app.state)
      };
    }
    const normalizedSource = String(source || "").toLowerCase();
    const completionControl = objectiveCompletionControl(objective);
    if (completionControl === "choice") {
      maybeOpenObjectiveChoiceModal();
      return {
        checked: true,
        completed: null,
        blockedForObjectiveChoice: true,
        directChoice: true
      };
    }
    const isPlayerSource = ["player", "user", "auto_player", "invite", "d20", "find"].includes(normalizedSource);
    const isAssistantSource = ["assistant", "ai", "narrator", "assistant_player_control"].includes(normalizedSource);
    const isAssistantPlayerControlSource = normalizedSource === "assistant_player_control";
    const isAiPreNarratorCheck = completionControl === "ai" && (isPlayerSource || normalizedSource === "continue") && phase === "pre";
    const isAiActivationCheck = completionControl === "ai" && normalizedSource === "activation" && phase === "activation";
    const isAiProgressOnlyCheck = completionControl === "ai" && isAssistantSource && phase === "post_progress";
    if (completionControl === "player" && !isPlayerSource && !isAssistantPlayerControlSource || completionControl === "ai" && !isAssistantSource && !isAiPreNarratorCheck && !isAiActivationCheck) {
      troubleshootingLog("objective check skipped for non-player source", {
        source,
        objectiveId: objective.id,
        title: objective.title,
        completionControl
      });
      return null;
    }

    // run the normal completion check instead of suppressing progress.
    const recentMessages = stateSyncMessageEntries().slice(-8).map(message => ({
      id: message.id,
      role: message.role,
      speaker: promptEntityName(message.speaker || (message.role === "assistant" ? "Narrator" : app.state.player?.name || "the player")),
      text: message.text || ""
    }));
    const instruction = buildObjectiveCompletionInstruction({
      source,
      text,
      objective,
      recentMessages,
      phase
    });
    const aiOptions = {
      source,
      messageId,
      hasUniversalContext: true
    };
    setTurnStage("assistant_state", "Checking current objective...");
    stateTrace("objective quick check request sent", {
      label: "objective",
      messageId,
      ...finalAiPromptLogDetails(instruction, aiOptions),
      summary: `Checking whether current objective "${objective.title || objective.id}" is complete.`
    });
    const decision = await requestObjectiveCompletionDecision(instruction, {
      ...aiOptions,
      objective
    });
    const raw = decision.raw;
    let result = decision.result;
    if (isAiProgressOnlyCheck && result.status === "objective_complete") {
      // The post-narrator pass records progress only. Completion was
      // already decided before the narrator response for this turn.
      result = {
        status: "objective_progress",
        step_id: "",
        reason: "The narrator advanced the active plot point."
      };
    }
    let outcomeDecision = null;
    if (result.status === "objective_complete" && objectiveUsesAiOutcomeRouting(objective)) {
      outcomeDecision = await requestObjectiveOutcomeDecision(objective, aiOptions);
      result = {
        ...result,
        ...outcomeDecision.result
      };
    }
    troubleshootingLog("fast objective check response", {
      source,
      messageId,
      objectiveId: objective.id,
      title: objective.title,
      raw,
      result,
      outcomeDecision,
      disabledCallSites: true
    });
    stateTrace("objective quick check response", {
      label: "objective",
      messageId,
      response: raw,
      summary: `Current objective check result: ${result.status}.`
    });
    if (result.status === "objective_progress") {
      const progress = addObjectiveProgressNote(app.state, objective.id, result.reason);
      scheduleActiveGameSave();
      render();
      return {
        checked: true,
        completed: null,
        progress: true,
        progressNote: progress
      };
    }
    if (result.status === "no_change") return {
      checked: true,
      completed: null
    };
    const beforeState = objectiveDebugStateProjection(app.state);
    if (messageId != null) createMessageStateBackup([messageId], `${source} objective completion check`);
    const objectiveTransaction = beginObjectiveMutationTransaction(app.state, `${source} objective completion`);
    let completed;
    let rewardResult;
    let deferredRewardResult;
    try {
      completed = applyObjectiveVerifierResult(app.state, objective.id, result, {
        messageId
      });
      if (!completed) {
        finishObjectiveMutationTransaction(objectiveTransaction, true);
        return {
          checked: true,
          completed: null
        };
      }
      rewardResult = applyObjectiveProgressRewards(beforeState, app.state, "objective", {
        silentGameMessage: true
      });
      // Objective completion/reward application uses targeted objective/runtime
      // normalization. No complete-state transaction clone is created.
      assertRuntimeObjectivesAndProgression(app.state);
      deferredRewardResult = applyObjectiveProgressRewards(app.state, app.state, "objective deferred effects", {
        silentGameMessage: true
      });
      finishObjectiveMutationTransaction(objectiveTransaction, true);
    } catch (error) {
      finishObjectiveMutationTransaction(objectiveTransaction, false);
      throw error;
    }
    if (deferredRewardResult) {
      rewardResult = {
        applied: true,
        completedRewardApplied: true,
        rewardMessages: [...(rewardResult?.rewardMessages || []), ...(deferredRewardResult.rewardMessages || [])],
        unlockGreetings: [...(rewardResult?.unlockGreetings || []), ...(deferredRewardResult.unlockGreetings || [])]
      };
    }
    const activationResults = autoActivation ? [] : await evaluateAiObjectivesOnActivation();
    const gameMessage = objectiveCompletionGameMessage(completed, rewardResult);
    // Normal player turns need the state/rewards applied before the
    // narrator prompt, but the visible completion notice belongs after
    // the narrator response that resolves the beat. Non-narrator paths
    // still add the notice immediately so edit/delete/replay checks do
    // not lose objective feedback.
    if (!deferGameMessage && !suppressGameMessage) addGameMessage(gameMessage, "Game");
    // Do not insert separate unlock-greeting chat messages here. New
    // characters unlocked by objective rewards should be introduced inside
    // the next normal narrator response using the completion directive.
    scheduleActiveGameSave();
    render();
    if (!deferGameMessage && !suppressGameMessage) {
      if (!maybeOpenObjectiveCompletionModal()) maybeOpenObjectiveChoiceModal();
    }
    return {
      checked: true,
      source,
      completionControl,
      completed: clone(completed),
      rewardResult: clone(rewardResult || {}),
      activationResults: clone(activationResults),
      objectiveGameMessage: deferGameMessage ? gameMessage : "",
      deferObjectiveModals: !!deferGameMessage
    };
  }
  async function runObjectiveCompletionPassSafe(options = {}) {
    try {
      return await runObjectiveCompletionPass(options);
    } catch (err) {
      const reported = reportObjectiveRewardFailure(err, options);
      stateTrace("objective quick check failed", {
        label: `${options.source || "message"} objective check`,
        messageId: options.messageId || null,
        error: err.message || String(err),
        summary: reported ? "Objective reward preflight failed. The reward transaction was rolled back and an error popup was shown." : "Objective completion check failed; continuing the turn without objective changes."
      });
      return null;
    }
  }
  function playerCompletedObjectivesNarratorDirective(result = null) {
    const completedResults = Array.isArray(result?.completedResults) ? result.completedResults.filter(item => item?.completed) : [];
    if (!completedResults.length) return "";
    const objectiveLines = [];
    for (const item of completedResults) {
      const completed = item.completed || {};
      const name = completed.title || completed.id || "Objective";
      objectiveLines.push(`- ${name}`);
      const instruction = textSlot(objectiveOutputCompletionInstruction(completed), "");
      if (instruction) objectiveLines.push(`  Completion story instruction: ${instruction}`);
      const dialogueDirective = objectiveDialogueNarratorDirective(completed);
      if (dialogueDirective) objectiveLines.push(dialogueDirective);
      const rewardMessages = Array.isArray(item.rewardResult?.rewardMessages) ? item.rewardResult.rewardMessages : [];
      if (rewardMessages.length) objectiveLines.push(`  Unlocked/changed: ${rewardMessages.join(" ")}`);
      const unlockGreetings = Array.isArray(item.rewardResult?.unlockGreetings) ? item.rewardResult.unlockGreetings : [];
      if (unlockGreetings.length) objectiveLines.push(`  If an unlocked character should speak now, introduce them in this normal reply instead of creating a separate greeting message: ${unlockGreetings.map(greeting => `${greeting.speaker}: ${greeting.text}`).join(" | ")}`);
    }
    return ["These previous objective(s) were completed by the player's response:", ...objectiveLines, "", "Use the updated state and rewards from those completed objectives. Do not re-complete them, do not print objective metadata, and do not add a separate objective report."].join("\n");
  }
  function objectiveCompletionNarratorDirective(result = null) {
    if (result?.finalCheckResult) return objectiveCompletionNarratorDirective(result.finalCheckResult);
    if (Array.isArray(result?.completedResults)) return "";
    if (!result?.completed) return "";
    const completed = result.completed || {};
    const rewardMessages = Array.isArray(result.rewardResult?.rewardMessages) ? result.rewardResult.rewardMessages : [];
    const unlockGreetings = Array.isArray(result.rewardResult?.unlockGreetings) ? result.rewardResult.unlockGreetings : [];
    const instruction = textSlot(objectiveOutputCompletionInstruction(completed), "");
    const control = objectiveCompletionControl(completed, result?.completionControl);
    const title = completed.title || completed.id || "current plot point";
    const lines = control === "ai" ? [`The story is ready for this reply to complete the next plot point: "${title}".`, "Use this normal visible story response to resolve or advance that plot point naturally. Do not print a separate objective report, JSON, metadata, or an out-of-story note."] : [`The objective "${title}" was completed by the player's last action before this reply.`, "Continue with the normal visible story response using the updated state. Do not print a separate objective report, JSON, metadata, or an out-of-story note."];
    if (instruction) lines.push(`Objective completion story instruction: ${instruction}`);
    const dialogueDirective = objectiveDialogueNarratorDirective(completed);
    if (dialogueDirective) lines.push(dialogueDirective);
    if (rewardMessages.length) lines.push(`Unlocked/changed for this reply: ${rewardMessages.join(" ")}`);
    if (unlockGreetings.length) {
      lines.push(`If an unlocked character should speak now, introduce them in this normal reply instead of creating a separate greeting message: ${unlockGreetings.map(item => `${item.speaker}: ${item.text}`).join(" | ")}`);
    }
    return lines.join("\n");
  }
  function objectiveSteeringNarratorDirective(result = null) {
    // Let the player explore without forcing the active story beat forward.

    const target = currentObjectiveTarget(app.state);
    if (!target || !target.id || objectiveIsComplete(target)) return "";
    const control = objectiveCompletionControl(target);
    const autoControlsPlayer = control === "player" && app.currentReplyMode === "auto" && exactAutoModeType(app.settings?.autoModeType) === "player_as_npc";
    if (control === "player" && !autoControlsPlayer) {
      const progressNotes = objectiveProgressNotes(app.state, target.id);
      const blocked = objectiveCompletionRequirementsText(target, app.state);
      return [blocked ? `The current objective cannot complete yet. ${blocked}. Do not portray it as completed or apply its outcome.` : "", progressNotes.length ? `Recent progress toward this objective: ${progressNotes.join(" | ")}` : ""].filter(Boolean).join("\n");
    }
    const completed = result?.completed || result?.finalCheckResult?.completed || (Array.isArray(result?.completedResults) && result.completedResults.length ? result.completedResults[result.completedResults.length - 1]?.completed : null);
    const title = target.title || target.id || "current objective";
    const summary = target.summary || target.completion_criteria || objectiveDisplayGoal(target) || "";
    const heading = completed ? "NEXT OBJECTIVE GUIDANCE:" : "CURRENT OBJECTIVE GUIDANCE:";
    const lines = [heading, `If the player is being passive and they seem like they are just along for the ride, push only toward this selected objective: "${title}".`];
    const blocked = objectiveCompletionRequirementsText(target, app.state);
    if (blocked) lines.push(`The objective cannot complete yet. ${blocked}. Do not portray it as completed, run its completion instruction, or apply its outcome.`);
    if (summary) lines.push(`Selected objective summary: ${summary}`);
    const progressNotes = objectiveProgressNotes(app.state, target.id);
    if (progressNotes.length) lines.push(`Recent progress toward this objective: ${progressNotes.join(" | ")}`);
    if (control === "choice") {
      lines.push("This is a direct choice objective. Do not resolve it in prose. Wait for the player to choose through the choice UI.");
    } else if (control === "ai") {
      lines.push("This is AI-controlled. The pre-reply verifier did not select completion for this turn. Respond naturally to the player's action. Do not portray the objective's completion condition as achieved because this turn was not authorized to complete it. Do not invent, prolong, renew, or replace obstacles merely to keep the objective incomplete. Advance only the established situation when that follows naturally from the player's action; the post-reply check records progress only.");
    } else if (autoControlsPlayer) {
      lines.push("Auto mode is controlling the player as a character. You may have the player naturally act toward or complete this objective in the reply. The post-reply objective check will decide whether it completed.");
    } else {
      // Player-controlled objectives complete from player action, not
      // narrator fiat. The narrator can steer, pressure, reveal, and
      // create openings, but should not complete the objective for the
      // player unless auto mode is explicitly controlling the player.
      lines.push("This is player-controlled. Do not write the selected objective as completed in this reply. Create progress, pressure, information, or an opening that moves toward it while leaving completion for a later player action.");
    }
    return lines.join("\n");
  }
  function flushDeferredObjectiveCompletionGameMessages(result = null) {
    const results = [];
    if (Array.isArray(result?.completedResults)) results.push(...result.completedResults);
    if (result?.finalCheckResult) results.push(result.finalCheckResult);
    if (result?.completed && !results.includes(result)) results.push(result);
    let lastMessage = null;
    for (const item of results) {
      const message = flushDeferredObjectiveCompletionGameMessage(item, {
        skipModal: true
      });
      if (message) lastMessage = message;
    }
    if (result?.deferObjectiveModals) {
      if (!maybeOpenObjectiveCompletionModal()) maybeOpenObjectiveChoiceModal();
      result.deferObjectiveModals = false;
    }
    return lastMessage;
  }
  function flushDeferredObjectiveCompletionGameMessage(result = null, options = {}) {
    const text = String(result?.objectiveGameMessage || "").trim();
    if (!text) return null;
    // This helper is intentionally called only after the normal narrator
    // message has been written. The objective was completed before the
    // prompt so state/rewards are available, but the visible Game notice
    // should appear in chat after the story beat it describes.
    const message = addGameMessage(text, "Game");
    result.objectiveGameMessage = "";
    if (result.deferObjectiveModals && !options.skipModal) {
      if (!maybeOpenObjectiveCompletionModal()) maybeOpenObjectiveChoiceModal();
      result.deferObjectiveModals = false;
    }
    return message;
  }
  async function requestObjectiveCompletionDecision(instruction, options = {}) {
    // The verifier must return compact JSON. A malformed answer is not
    // treated as "no"; ask once more so bad output cannot silently block
    // progression or invent completion.
    const attempts = [];
    let prompt = instruction;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const raw = await aiText(prompt, {
        label: attempt === 1 ? `${options.source || "message"} objective check` : `${options.source || "message"} objective check retry`,
        logType: "state",
        messageId: options.messageId ?? null,
        hasUniversalContext: true
      });
      let result = parseObjectiveCompletionResult(raw);
      attempts.push({
        raw,
        result
      });
      if (result.status !== "invalid_response") return {
        raw,
        result,
        attempts
      };
      prompt = buildObjectiveCompletionRetryInstruction(instruction, raw);
    }
    const last = attempts[attempts.length - 1] || {
      raw: "",
      result: {
        status: "invalid_response",
        reason: "No response."
      }
    };
    throw new Error(`Objective checker did not return valid compact JSON after ${attempts.length} attempt(s). Last response: ${String(last.raw || "").slice(0, 160)}`);
  }
  function storyShopNpcLocationId(shop = {}, state = app.state) {
    return requireNpcLocationId(state, textSlot(shop.npc_location_id || shop.location?.npc_location_id, ""), `Story shop "${shop.title || shop.id || "unknown"}"`);
  }
  async function requestObjectiveOutcomeDecision(objective, options = {}) {
    const eligibleRoutes = eligibleObjectiveOutcomeRoutes(objective);
    if (!eligibleRoutes.length) throw new Error(`AI-routed objective ${objective?.id || ""} has no eligible outcome routes.`);
    const routing = objectiveOutcomeRoutingInstruction(objective);
    const prompt = `The objective has just been determined complete. Choose the single best eligible hidden outcome route.
Return ONLY compact JSON: {"o":"route-id"}
Do not explain the choice or reveal route metadata.
${routing}`;
    const attempts = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      const raw = await aiText(attempt === 1 ? prompt : `${prompt}\nYour previous route selection was invalid. Return one valid eligible route id only.`, {
        label: attempt === 1 ? `${options.source || "message"} objective outcome route` : `${options.source || "message"} objective outcome route retry`,
        logType: "state",
        messageId: options.messageId ?? null,
        hasUniversalContext: true
      });
      let outcomeId = "";
      try {
        const parsed = JSON.parse(stripCodeFence(raw));
        outcomeId = textSlot(parsed?.o || parsed?.outcome_id || parsed?.outcomeId, "");
      } catch {
        outcomeId = "";
      }
      const route = eligibleObjectiveOutcomeRoute(objective, outcomeId);
      attempts.push({
        raw,
        outcomeId,
        valid: !!route
      });
      if (route) return {
        raw,
        result: {
          outcome_id: route.id
        },
        attempts
      };
    }
    const fallback = defaultObjectiveOutcomeRoute(objective);
    if (fallback) {
      troubleshootingLog("objective outcome fallback used", {
        objectiveId: objective?.id || "",
        fallbackId: fallback.id,
        attempts
      });
      return {
        raw: attempts[attempts.length - 1]?.raw || "",
        result: {
          outcome_id: fallback.id,
          used_outcome_fallback: true
        },
        attempts
      };
    }
    throw new Error(`Objective outcome route picker did not return a valid eligible route after ${attempts.length} attempt(s).`);
  }
  
