  async function openMainMenu() {
    try {
      if (!(await flushActiveGameSave())) {
        forceMainMenuAfterError("The active game could not be saved before opening the main menu.");
        return;
      }
    } catch (err) {
      forceMainMenuAfterError(err?.message || err);
      showEmergencyExportFallback(err);
      return;
    }
    app.mainMenuOpen = true;
    app.mainMenuExplicitlyOpened = true;
    stopReadingMessage();
    closeModal();
    render();
  }
  function activeRuntimeDestinationReady() {
    try {
      if (!app.state?.meta?.setup_complete) return false;
      const saveId = activeSaveId();
      if (!saveId || !/^\d+$/.test(saveId)) return false;
      if (!findSaveIndexRecord(saveId)) return false;
      if (String(app.state?.meta?.save_id || "") !== saveId) return false;
      if (!app.saveSessionActive) return false;
      return app.persistence?.activeSaveState?.saveId === Number(saveId);
    } catch (error) {
      log("Current runtime destination rejected", error?.message || String(error), {
        type: "storage",
        level: "warn"
      });
      return false;
    }
  }
  function closeMainMenuToGame() {
    if (!activeRuntimeDestinationReady()) {
      showNotice("Current Game Unavailable", "The current game is not fully loaded. Use Load Adventure to open a saved game.");
      return;
    }
    app.mainMenuOpen = false;
    closeModal();
    render();
    continueStartupFlow();
  }
  function playMainMenuTick() {
    const now = Date.now();
    if (now - (app.lastMainMenuTickAt || 0) < 85) return;
    app.lastMainMenuTickAt = now;
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      app.mainMenuAudioContext ||= new AudioContextCtor();
      const ctx = app.mainMenuAudioContext;
      if (ctx.state === "suspended") ctx.resume?.();
      const tone = (freq, duration = 0.06, type = "sine", gainValue = 0.05, endFreq = null) => {
        const start = ctx.currentTime;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
        amp.gain.setValueAtTime(0.0001, start);
        amp.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(amp);
        amp.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      };
      const noise = (duration = 0.035, gainValue = 0.06, filterFreq = 4200, filterType = "highpass") => {
        const start = ctx.currentTime;
        const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const p = i / length;
          data[i] = (Math.random() * 2 - 1) * (1 - p);
        }
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const amp = ctx.createGain();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, start);
        amp.gain.setValueAtTime(gainValue, start);
        amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(amp);
        amp.connect(ctx.destination);
        source.start(start);
      };
      // Matches CrimsonDragonForge/Signal Forge's CDF.Audio.button:
      // short high-pass UI noise plus a brief descending square tone.
      noise(0.022, 0.07, 6200, "highpass");
      tone(2100, 0.016, "square", 0.015, 1200);
    } catch {}
  }
  function unlockMainMenuAudio() {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      app.mainMenuAudioContext ||= new AudioContextCtor();
      if (app.mainMenuAudioContext.state === "suspended") app.mainMenuAudioContext.resume?.();
    } catch {}
  }
  function bindMainMenuHoverCues(menu) {
    menu.addEventListener("pointerdown", unlockMainMenuAudio, {
      once: true
    });
    menu.addEventListener("keydown", unlockMainMenuAudio, {
      once: true
    });
    menu.querySelectorAll("[data-main-menu-cue]").forEach(button => {
      const play = event => {
        if (button.disabled) return;
        recordMainMenuCueDiagnostic(event?.type || "cue", button);
        playMainMenuTick();
      };
      button.addEventListener("mouseenter", play);
      button.addEventListener("focus", play);
    });
  }
  function promptEditorState() {
    app.promptEditor ||= {
      tab: "text",
      label: "",
      group: "",
      source: "",
      text: "",
      imagePrompt: "",
      imageNegativePrompt: "",
      imageSeed: "",
      imageResolution: "512x768",
      imageModel: "",
      selectedProfileName: "",
      selectedImageTargets: [],
      transcript: [],
      transcriptNextId: 1
    };
    return app.promptEditor;
  }
  function promptEditorPromptKey(value = "") {
    return String(value || "manual").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "manual";
  }
  function promptEditorLastCallsStore(type = "text") {
    const key = type === "images" ? "promptEditorLastImageCallsByType" : "promptEditorLastTextCallsByType";
    app.settings ||= {};
    app.settings[key] ||= app[key] || {};
    app[key] = app.settings[key];
    return app.settings[key];
  }
  function rememberPromptEditorAiCall(type = "text", record = {}) {
    if (!app.settings?.devMode) return;
    const label = String(record.label || (type === "images" ? "image generation" : "ai text"));
    const key = promptEditorPromptKey(record.promptType || label);
    const snapshot = compactPromptEditorReplaySnapshot(record.snapshot);
    const clean = {
      ...record,
      label,
      promptType: record.promptType || label,
      promptKey: key,
      at: record.at || new Date().toISOString(),
      ...(snapshot ? {
        snapshot
      } : {}),
      response: typeof record.response === "string" ? record.response.slice(0, 4000) : record.response
    };
    if (!snapshot) delete clean.snapshot;
    const store = promptEditorLastCallsStore(type);
    store[key] = clean;
    const entries = Object.entries(store).sort((a, b) => String(b[1]?.at || "").localeCompare(String(a[1]?.at || "")));
    for (const [oldKey] of entries.slice(40)) delete store[oldKey];
    if (type === "images") app.promptEditorLastImageCall = clean;else app.promptEditorLastTextCall = clean;
    saveSettingsNow("prompt editor replay capture");
  }
  function compactPromptEditorReplaySnapshot(value = {}) {
    if (!value || typeof value !== "object") return null;
    const snapshot = {
      ...value
    };
    delete snapshot.state;
    delete snapshot.messages;
    delete snapshot.settings;
    return Object.keys(snapshot).length ? snapshot : null;
  }
  function promptEditorSnapshotForReplay(extra = {}) {
    return compactPromptEditorReplaySnapshot({
      activeProfileId: app.activeProfileId || "",
      ...extra
    });
  }
  function withPromptEditorReplaySnapshot(call = {}, build = () => "") {
    if (!call?.snapshot || typeof build !== "function") return build();
    const snapshot = call.snapshot || {};
    const previousActiveProfileId = app.activeProfileId;
    try {
      if (snapshot.activeProfileId != null) app.activeProfileId = snapshot.activeProfileId;
      return build();
    } finally {
      app.activeProfileId = previousActiveProfileId;
    }
  }
  function promptEditorSourceShellComment(source = {}, type = "text") {
    const lines = [`[PROMPT SHELL: ${source.label || source.id || "Prompt"}]`, `[COMMENT: This is the empty/source template for the ${type === "images" ? "image" : "text"} prompt. Bracketed COMMENT lines mark runtime data that is filled when EmberAdventures sends the real prompt.]`];
    if (source.buildFrom) lines.push(`[COMMENT: Builder: ${source.buildFrom}.]`);
    if (source.dynamicData) lines.push(`[COMMENT: Dynamic data: ${source.dynamicData}.]`);
    if (source.extraShellNote) lines.push(`[COMMENT: ${source.extraShellNote}]`);
    return lines.join("\n");
  }
  function promptEditorGenericShellFromLast(call = {}, source = {}, type = "text") {
    const prompt = String(call.prompt || "");
    const comments = promptEditorSourceShellComment({
      ...source,
      label: source.label || call.label || call.promptType || "Captured prompt",
      buildFrom: source.buildFrom || `captured ${type === "images" ? "generateImageHtml" : "aiText"} call label "${call.label || ""}"`,
      dynamicData: source.dynamicData || "the exact last sent prompt is captured at the AI boundary while Dev Mode is enabled"
    }, type);
    if (!prompt) return `${comments}\n\n[COMMENT: No last prompt has been captured for this prompt type yet.]`;
    return `${comments}\n\n${prompt}`;
  }
  function promptEditorFindLastCall(type = "text", source = {}) {
    const store = promptEditorLastCallsStore(type);
    const candidates = Object.values(store);
    const keys = [source.id, source.promptKey, ...(source.lastKeys || [])].map(promptEditorPromptKey).filter(Boolean);
    const patterns = (source.lastLabels || []).map(pattern => {
      try {
        return pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
      } catch {
        return null;
      }
    }).filter(Boolean);
    return candidates.filter(call => {
      const key = promptEditorPromptKey(call.promptKey || call.promptType || call.label);
      return keys.includes(key) || patterns.some(pattern => pattern.test(call.label || "") || pattern.test(call.promptType || ""));
    }).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))[0] || null;
  }
  function promptEditorBuildShell(type = "text", source = {}) {
    if (typeof source.shellBuild === "function") return `${promptEditorSourceShellComment(source, type)}\n\n${source.shellBuild()}`;
    return promptEditorGenericShellFromLast(promptEditorFindLastCall(type, source), source, type);
  }
  function promptEditorSourceMatchesCall(source = {}, call = {}) {
    if (!source || !call) return false;
    const sourceKeys = [source.id, source.promptKey, ...(source.lastKeys || [])].map(promptEditorPromptKey).filter(Boolean);
    const callKey = promptEditorPromptKey(call.promptKey || call.promptType || call.label);
    if (callKey && sourceKeys.includes(callKey)) return true;
    const patterns = (source.lastLabels || []).map(pattern => {
      try {
        return pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
      } catch {
        return null;
      }
    }).filter(Boolean);
    return patterns.some(pattern => pattern.test(call.label || "") || pattern.test(call.promptType || ""));
  }
  function promptEditorStaticSourceForCall(type = "text", call = {}) {
    const groups = type === "images" ? promptEditorImageSources() : promptEditorTextSources();
    for (const group of groups) {
      if (/^Captured /.test(group.group || "")) continue;
      for (const source of group.buttons || []) {
        if (promptEditorSourceMatchesCall(source, call)) return source;
      }
    }
    return null;
  }
  function promptEditorBuildLast(type = "text", source = {}, callOverride = null) {
    const call = callOverride || promptEditorFindLastCall(type, source);
    if (!call?.prompt) return `No last ${type === "images" ? "image" : "text"} prompt has been captured for "${source.label || source.id}" while Dev Mode was enabled.`;
    const staticSource = !source.buildLast && !source.build ? promptEditorStaticSourceForCall(type, call) : null;
    if (staticSource && staticSource !== source && (staticSource.buildLast || staticSource.build)) return promptEditorBuildLast(type, staticSource, call);
    if (typeof source.buildLast === "function") {
      const rebuilt = source.buildLast(call);
      return type === "text" ? finalAiTextInstruction(rebuilt, call?.snapshot?.opts || {}) : rebuilt;
    }
    if (typeof source.build === "function") return call.prompt;
    if (type === "images") {
      return [call.prompt, "", `[NEGATIVE PROMPT: ${call.negativePrompt || "(none)"}]`, `[SEED: ${call.seed ?? "random"}]`, `[RESOLUTION: ${call.resolution || "512x768"}]`, `[MODEL: ${call.imageModel || ""}]`].join("\n");
    }
    return call.prompt;
  }
  function promptEditorCapturedCallsGroup(type = "text") {
    const store = promptEditorLastCallsStore(type);
    const buttons = Object.values(store).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).map(call => ({
      id: `captured-${call.promptKey || promptEditorPromptKey(call.label)}`,
      label: call.promptType || call.label || "Captured prompt",
      buildFrom: type === "images" ? "captured at generateImageHtml(...) boundary" : "captured at aiText(...) boundary",
      dynamicData: "this item appears automatically after EmberAdventures sends this prompt type while Dev Mode is enabled",
      lastKeys: [call.promptKey || call.label]
    }));
    return {
      group: type === "images" ? "Captured Image Prompt Types" : "Captured Text Prompt Types",
      buttons
    };
  }
  function promptEditorReplayData(call = {}) {
    return call?.snapshot?.promptEditorReplay || call?.snapshot?.opts?.promptEditorReplay || {};
  }
  function promptEditorLatestPlayerText() {
    return [...(app.messages || [])].reverse().find(message => message.role === "user")?.text || "";
  }
  function promptEditorLatestMessageText() {
    return [...(app.messages || [])].reverse().find(message => message.text)?.text || "";
  }
  function promptEditorManualSpeakerResponseText() {
    return $("promptEditorText")?.value || promptEditorState().text || promptEditorLatestMessageText() || "Paste the final narrator response with voice tags here before sending this prompt.";
  }
  function promptEditorStateContextText() {
    return JSON.stringify(buildStateCheckContext(app.state), null, 2);
  }
  function promptEditorTextSources() {
    const latestPlayerText = promptEditorLatestPlayerText();
    const latestText = promptEditorLatestMessageText();
    const currentObjective = currentObjectiveTarget(app.state);
    const objectiveSource = latestPlayerText || latestText || "The player acts.";
    const groupButton = group => ({
      id: `state-${group.id}`,
      label: group.label || group.id,
      buildFrom: `buildGroupedStateInstruction(${group.id})`,
      dynamicData: `latest message text and groupedStateContext("${group.id}")`,
      lastLabels: [new RegExp(`state group ${escapeRegExp(group.id)}|${escapeRegExp(group.label || group.id)}`, "i")],
      build: () => buildGroupedStateInstruction(group, "dev prompt editor", latestText || "No recent message.", groupedStateContext(group.id)),
      shellBuild: () => buildGroupedStateInstruction(group, "[COMMENT: source label such as player message, assistant response, or dev prompt editor]", "[COMMENT: latest message text being evaluated]", `[COMMENT: groupedStateContext("${group.id}") JSON for this group's allowed state roots]`)
    });
    return [{
      group: "Main Response",
      buttons: [{
        id: "character-reply",
        label: "Character reply / narrator response",
        buildFrom: "withUniversalAiPromptContext(buildReplyInstruction(...))",
        dynamicData: "universal story guidance, player preferences, current objective, sanitized runtime state, recent chat, and optional regeneration feedback",
        lastLabels: [/reply|narrator|character reply/i],
        build: () => withUniversalAiPromptContext(buildReplyInstruction("", {})),
        shellBuild: () => withUniversalAiPromptContext(`[COMMENT: buildReplyInstruction(regenerateFeedback, options) fills this prompt.]

ACTIVE OBJECTIVE:
[COMMENT: activeObjectiveTextForNarratorPrompt(app.state)]

STATE:
[COMMENT: JSON.stringify(stateForAiPrompt(app.state), null, 2)]

RECENT CHAT:
[COMMENT: replyPromptConversationContextText(options)]

PLAYER MESSAGE / REGENERATION FEEDBACK:
[COMMENT: latest player message or regenerateFeedback]`)
      }, {
        id: "auto-player",
        label: "Auto player turn",
        buildFrom: "buildAutoPlayerTurnPrompt()",
        dynamicData: "sceneForAiPrompt, playerAccessibleEntityForPrompt, accessibleCharactersForPrompt, known NPC context, current objective, and recent chat",
        lastLabels: [/auto player/i],
        build: () => buildAutoPlayerTurnPrompt(),
        shellBuild: () => `[COMMENT: buildAutoPlayerTurnPrompt() fills this prompt.]

STATE:
[COMMENT: scene/player/party/NPC/objective context built from app.state]

RECENT CHAT:
[COMMENT: syncedConversationContextForPrompt(...)]

OUTPUT:
[COMMENT: one player turn/action text]`
      }]
    }, {
      group: "Objective Checks",
      buttons: [{
        id: "current-objective",
        label: "Current objective check",
        buildFrom: "buildObjectiveCompletionInstruction(...)",
        dynamicData: "currentObjectiveTarget(app.state), latest player/message text, and buildStateCheckContext(app.state)",
        lastLabels: [/objective completion|objective check/i],
        build: () => currentObjective ? buildObjectiveCompletionInstruction({
          objective: currentObjective,
          source: "player",
          text: objectiveSource,
          stateContextText: promptEditorStateContextText()
        }) : "No current objective is selected in the active game.",
        shellBuild: () => `[COMMENT: buildObjectiveCompletionInstruction({ objective, source, text, stateContextText }) fills this prompt.]

OBJECTIVE:
[COMMENT: objectiveForCompletionPrompt(currentObjectiveTarget(app.state))]

SOURCE/TEXT:
[COMMENT: latest player message or latest narrative message]

STATE:
[COMMENT: JSON.stringify(buildStateCheckContext(app.state), null, 2)]`
      }]
    }, {
      group: "State Updates",
      buttons: [...(typeof stateCheckGroups === "function" ? stateCheckGroups().map(groupButton) : []), {
        id: "scene-removal-check",
        label: "Scene removal check",
        buildFrom: "buildSceneRemovalCheckInstruction(...)",
        dynamicData: "current scene presence, latest queued turn text, and recent messages",
        lastLabels: [/scene removal check/i],
        build: () => {
          const replay = promptEditorReplayData(promptEditorFindLastCall("text", {
            lastLabels: [/scene removal check/i]
          }));
          return buildSceneRemovalCheckInstruction({
            text: replay.text || latestText || "No recent message.",
            messageId: replay.messageId || null
          });
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          return buildSceneRemovalCheckInstruction({
            text: replay.text || latestText || "No recent message.",
            messageId: replay.messageId || null
          });
        },
        shellBuild: () => `You are EmberAdventures's scene-presence cleanup checker.
Return # if nobody should be removed.
Otherwise return ONLY minified JSON in this exact compact shape:
{"p":["Party Member Name"],"n":["NPC Name"]}

Task:
[COMMENT: Decide whether any currently-present party members or NPCs should be removed from the current scene before the next narrator reply.]

Current party members:
[COMMENT: current non-player scene.party_members_present names plus short role hints]

Current NPCs:
[COMMENT: current scene.npcs_present names plus short role hints]

Recent messages:
[COMMENT: compact recent chat messages from stateSyncMessageEntries().slice(-4)]

Latest turn:
[COMMENT: latest queued turn text and message id]

Output:`
      }, {
        id: "legacy-state-check",
        label: "Legacy state check",
        buildFrom: "buildStateCheckInstruction(...)",
        dynamicData: "latest message text and JSON.stringify(buildStateCheckContext(app.state), null, 2)",
        lastLabels: [/legacy state|state check/i],
        build: () => buildStateCheckInstruction("dev prompt editor", latestText || "No recent message.", promptEditorStateContextText()),
        shellBuild: () => buildStateCheckInstruction("[COMMENT: source label]", "[COMMENT: latest message text being evaluated]", "[COMMENT: JSON.stringify(buildStateCheckContext(app.state), null, 2)]")
      }]
    }, {
      group: "NPC / Character Processing",
      buttons: [{
        id: "speaker-extraction",
        label: "Manual NPC/speaker extraction from response",
        buildFrom: "withUniversalAiPromptContext(buildPostResponsePeopleMetadataInstruction(...))",
        dynamicData: "the selected/typed narrator response text from Prompt Editor or latest message",
        lastLabels: [/npc|speaker|people metadata|post response/i],
        build: () => withUniversalAiPromptContext(buildPostResponsePeopleMetadataInstruction(promptEditorManualSpeakerResponseText())),
        shellBuild: () => withUniversalAiPromptContext(buildPostResponsePeopleMetadataInstruction("[COMMENT: final narrator response / assistant message text to inspect for speakers and NPC metadata]"))
      }]
    }, {
      group: "Image Decisions",
      buttons: [{
        id: "image-decision",
        label: "Image decision",
        buildFrom: "buildImageDecisionInstruction(...)",
        dynamicData: "latest message text and groupedStateContext('image')",
        lastLabels: [/image decision/i],
        build: () => {
          const group = stateCheckGroups().find(item => item.id === "image");
          return buildImageDecisionInstruction("dev prompt editor", latestText || "No recent message.", groupedStateContext(group?.id || "image"));
        },
        shellBuild: () => buildImageDecisionInstruction("[COMMENT: source label]", "[COMMENT: latest message text for image decision]", "[COMMENT: groupedStateContext('image') JSON]")
      }]
    }, {
      group: "Repair Prompts",
      buttons: [...(typeof stateCheckGroups === "function" ? stateCheckGroups().map(group => ({
        id: `repair-state-${group.id}`,
        label: `${group.label || group.id} repair`,
        buildFrom: "grouped state repair prompt in runGroupedStateCheck(...)",
        dynamicData: "group id, accepted changes summary, rejected/errors, rejected raw patch, and current state for this group",
        lastLabels: [new RegExp(`state group ${escapeRegExp(group.id)} repair|${escapeRegExp(group.label || group.id)}.*repair`, "i")],
        shellBuild: () => `Repair this EmberAdventures grouped patch.
Group:${group.id}
Return ONLY minified structured JSON ops or {}. No markdown.
Use only this shape:
{
  "s": [{"path": ["path", "parts"], "value": "value"}],
  "n": [{"path": ["path", "parts"]}],
  "a": [{"path": ["path", "parts"], "value": "value"}],
  "r": [{"path": ["path", "parts"], "value": 1}]
}
If no valid changes remain, return {}.
Allowed roots:[COMMENT: group.allowedRoots for ${group.id}]
Paths must be arrays. Use path arrays whenever a key or name can contain spaces.
Do not wrap the patch in root{...}; every path must begin with an allowed root.
Rejected paths outside this group's allowed roots must be dropped, not repaired.
Objective definitions and objective runtime are engine-owned. Never return an operation whose path begins with "objectives".

Accepted changes summary:
[COMMENT: accepted patch summary from the first validator pass]

Rejected/errors:
[COMMENT: validator rejection messages for this group]

Rejected raw:
[COMMENT: only raw rejected patch lines/items from the first AI response]

Current state for this group:
[COMMENT: groupedStateContext("${group.id}") at repair time]

Source text:
[COMMENT: message text that originally caused this grouped state update]`
      })) : []), {
        id: "objective-completion-retry-repair",
        label: "Objective completion retry / repair",
        buildFrom: "buildObjectiveCompletionRetryInstruction(originalInstruction, invalidRaw)",
        dynamicData: "original objective completion prompt and invalid raw response",
        lastLabels: [/objective.*repair|objective.*retry/i],
        shellBuild: () => `[COMMENT: buildObjectiveCompletionRetryInstruction(originalInstruction, invalidRaw) fills this prompt.]

ORIGINAL OBJECTIVE PROMPT:
[COMMENT: exact objective completion prompt sent before the invalid response]

INVALID RAW RESPONSE:
[COMMENT: raw text returned by the model that failed validation]

OUTPUT:
[COMMENT: corrected objective-completion JSON only]`
      }, {
        id: "compact-patch-repair",
        label: "Compact patch repair",
        buildFrom: "buildCompactPatchRepairInstruction(...)",
        dynamicData: "allowed roots, rejected raw patch, error text, and compact state context",
        lastLabels: [/compact.*repair|patch repair|repair.*patch/i],
        shellBuild: () => `[COMMENT: buildCompactPatchRepairInstruction({ ... }) fills this prompt.]

ALLOWED ROOTS:
[COMMENT: roots allowed by the compact patch caller]

REJECTED RAW PATCH:
[COMMENT: invalid compact patch response]

ERRORS:
[COMMENT: validator errors]

CURRENT STATE:
[COMMENT: compact state relevant to the caller]

OUTPUT:
[COMMENT: repaired JSON patch only]`
      }, {
        id: "single-slot-repair",
        label: "Single-slot value repair",
        buildFrom: "single-value slot repair prompt in repairCommaFilledSingleValueSlots(...)",
        dynamicData: "violating paths whose values contained comma-separated text where one value is required",
        lastLabels: [/single-slot repair/i],
        shellBuild: () => `[COMMENT: Single-slot repair prompt shell.]

VIOLATIONS:
[COMMENT: paths and values where a slot must hold exactly one value]

CURRENT PATCH:
[COMMENT: state patch being repaired]

OUTPUT:
[COMMENT: JSON with corrected single-value slot strings only]`
      }]
    }, {
      group: "Other Text Prompts",
      buttons: [{
        id: "ai-command-patch",
        label: "AI command patch",
        buildFrom: "buildAiCommandPatchInstruction(command, stateContextText)",
        dynamicData: "player command text and JSON.stringify(buildStateCheckContext(app.state), null, 2)",
        lastLabels: [/AI command patch/i],
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          if (!replay.command || !replay.stateContextText) return call.prompt || "No replay inputs were captured for the AI command patch.";
          return buildAiCommandPatchInstruction(replay.command, replay.stateContextText);
        },
        shellBuild: () => `[COMMENT: buildAiCommandPatchInstruction(command, stateContextText) fills this prompt.]

COMMAND:
[COMMENT: player command text]

STATE:
[COMMENT: JSON.stringify(buildStateCheckContext(app.state), null, 2)]

OUTPUT:
[COMMENT: structured command patch JSON]`
      }, {
        id: "opening-scene",
        label: "Opening scene",
        buildFrom: "opening scene narrator prompt in start game flow",
        dynamicData: "selected story template, selected player, opening objective, and starting state",
        lastLabels: [/opening scene/i],
        shellBuild: () => `[COMMENT: Opening scene prompt shell.]

STORY:
[COMMENT: selected story template title, description, source/original metadata, opening objective]

PLAYER:
[COMMENT: selected player character from profile/story setup]

STATE:
[COMMENT: initial runtime state prepared for the new game]

OUTPUT:
[COMMENT: opening narration exactly as the first game message]`
      }, {
        id: "stale-reference-check",
        label: "Stale reference check",
        buildFrom: "stale reference cleanup prompt",
        dynamicData: "scope, removed/renamed entity name, and affected state references",
        lastLabels: [/stale .*references/i],
        shellBuild: () => `[COMMENT: Stale reference check prompt shell.]

SCOPE:
[COMMENT: deleted/renamed story, character, NPC, or related entity scope]

NAME:
[COMMENT: entity name being checked]

STATE REFERENCES:
[COMMENT: compact list of references that may need cleanup]

OUTPUT:
[COMMENT: JSON cleanup recommendation]`
      }, {
        id: "post-response-speaker-metadata",
        label: "Post-response speaker metadata",
        buildFrom: "buildPostResponsePeopleMetadataInstruction(...)",
        dynamicData: "assistant/narrator response text and missing required speaker tags",
        lastLabels: [/post response|speaker|people metadata/i],
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          if (!replay.visibleWithVoiceTags) return call.prompt || "No replay inputs were captured for post-response speaker metadata.";
          return withUniversalAiPromptContext(buildPostResponsePeopleMetadataInstruction(replay.visibleWithVoiceTags, replay.missing || [], replay.options || {}));
        },
        shellBuild: () => withUniversalAiPromptContext(buildPostResponsePeopleMetadataInstruction("[COMMENT: visible assistant response text with voice tags]", ["[COMMENT: missing required speaker names]"]))
      }, {
        id: "story-builder-future-character",
        label: "Story builder future character",
        buildFrom: "storyBuilderGenerateFutureCharacter() inline instruction",
        dynamicData: "requested name/concept, characterDefinitionTemplateForAiPrompt(...), generatedBodyDescriptionRuleText(...), and current builder draft summary",
        lastLabels: [/story builder future character/i],
        shellBuild: () => `[COMMENT: Story Builder future character prompt shell.]

CHARACTER CONCEPT:
[COMMENT: user-entered future character name or concept]

IMMUTABLE CHARACTER DEFINITION SHAPE:
[COMMENT: prettyJson(characterDefinitionTemplateForAiPrompt(name))]

RULES:
[COMMENT: generatedChestRuleText and current character-definition rules]

CURRENT TEMPLATE SUMMARY:
[COMMENT: title, description, story_source, and current objective titles from app.storyBuilder.draft]`
      }, {
        id: "story-builder-patch",
        label: "Story builder patch",
        buildFrom: "Story Builder AI patch instruction",
        dynamicData: "user edit request plus current story builder draft JSON",
        lastLabels: [/story builder patch/i],
        shellBuild: () => `[COMMENT: Story Builder patch prompt shell.]

USER REQUEST:
[COMMENT: requested changes typed in Story Builder]

CURRENT STORY TEMPLATE:
[COMMENT: prettyJson(app.storyBuilder.draft), truncated for prompt budget]

OUTPUT:
[COMMENT: JSON patch for story template draft]`
      }, {
        id: "story-lookup-summary",
        label: "Story lookup summary",
        buildFrom: "story lookup/check story setup prompt",
        dynamicData: "story concept/source text and user modifications from story setup",
        lastLabels: [/story lookup summary/i],
        shellBuild: () => `[COMMENT: Story lookup summary prompt shell.]

STORY REQUEST:
[COMMENT: story/source concept from story setup]

USER MODIFICATIONS:
[COMMENT: user modifications typed in story setup]

OUTPUT:
[COMMENT: JSON story summary/source recognition result]`
      }, {
        id: "story-starting-party-prefill",
        label: "Story starting party prefill",
        buildFrom: "story setup starting party prefill prompt",
        dynamicData: "story request, user modifications, and current draft setup",
        lastLabels: [/story starting party prefill/i],
        shellBuild: () => `[COMMENT: Story starting party prefill prompt shell.]

STORY REQUEST:
[COMMENT: story/source concept from setup]

USER MODIFICATIONS:
[COMMENT: user modifications typed in setup]

CURRENT DRAFT:
[COMMENT: setup draft fields relevant to starting party/player options]

OUTPUT:
[COMMENT: JSON starting-party suggestions]`
      }, {
        id: "world-generation",
        label: "World / story generation attempt",
        buildFrom: "generateWorld(...) attempt prompt",
        dynamicData: "setupPrompt/onboarding setup, selected profile, story settings, and attempt number",
        lastLabels: [/world generation|attempt \d+/i],
        shellBuild: () => `[COMMENT: generateWorld(setupPrompt, options) fills this prompt.]

SETUP PROMPT:
[COMMENT: onboardingSetupPrompt() / manual story setup text]

PROFILE / PLAYER:
[COMMENT: selected profile and player-start data]

WORLD/STORY RULES:
[COMMENT: opening, objective, map, future cast, and story-template generation rules]

OUTPUT:
[COMMENT: JSON story/world template]`
      }, {
        id: "npc-inspection",
        label: "NPC inspection",
        buildFrom: "NPC inspection instruction",
        dynamicData: "short NPC description, current appearance, scene context, and character definition shape/rules",
        lastLabels: [/npc inspection/i],
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          if (!replay.promptText && !replay.npc) return call.prompt || "No replay inputs were captured for NPC inspection.";
          return buildGeneratedCharacterAiInstruction({
            mode: "inspect",
            name: replay.name,
            npc: replay.npc,
            promptText: replay.promptText || ""
          });
        },
        shellBuild: () => `[COMMENT: NPC inspection prompt shell.]

NPC DESCRIPTION:
[COMMENT: known non-inspected NPC fields and recent visible context]

SCENE CONTEXT:
[COMMENT: current location, scene, and relevant recent messages]

CHARACTER SHAPE:
[COMMENT: characterDefinitionTemplateForAiPrompt(name) / runtime character fields expected from inspection]

OUTPUT:
[COMMENT: JSON inspected NPC character data]`
      }, {
        id: "npc-loot-rewards",
        label: "NPC loot rewards",
        buildFrom: "playerKillRewardInstruction(npc, context)",
        dynamicData: "defeated/killed NPC, player context, current inventory/reward context",
        lastLabels: [/npc loot rewards/i],
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          if (!replay.npc) return call.prompt || "No replay inputs were captured for NPC loot rewards.";
          return playerKillRewardInstruction(replay.npc, replay.context || {});
        },
        shellBuild: () => `[COMMENT: playerKillRewardInstruction(npc, context) fills this prompt.]

NPC:
[COMMENT: defeated NPC summary]

CONTEXT:
[COMMENT: current scene, player, existing inventory, and reward constraints]

OUTPUT:
[COMMENT: JSON loot/reward result]`
      }, {
        id: "generate-character",
        label: "Generate character",
        buildFrom: "buildGeneratedCharacterAiInstruction(...)",
        dynamicData: "user prompt/concept, party-member-or-NPC target, current story context, and character generation rules",
        lastLabels: [/generate character/i],
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          if (!replay.promptText) return call.prompt || "No replay inputs were captured for generated character creation.";
          return buildGeneratedCharacterAiInstruction({
            mode: replay.mode || "create",
            promptText: replay.promptText,
            targetKind: replay.targetKind,
            source: replay.source
          });
        },
        shellBuild: () => buildGeneratedCharacterAiInstruction({
          promptText: "[COMMENT: user-entered character concept]",
          targetKind: "[COMMENT: party_member or npc]",
          source: "[COMMENT: UI source such as Characters menu or Character Library]"
        })
      }, {
        id: "state-json-patch-repair",
        label: "State JSON patch repair",
        buildFrom: "buildCompactPatchRepairInstruction(...) for state JSON patches",
        dynamicData: "previous raw response, previous parsed patch, validator errors, source label, and allowed state paths",
        lastLabels: [/state JSON patch repair/i],
        shellBuild: () => `[COMMENT: State JSON patch repair shell.]

PREVIOUS RAW:
[COMMENT: previous AI raw response]

PREVIOUS PATCH:
[COMMENT: parsed patch, if any]

ERRORS:
[COMMENT: validation errors]

OUTPUT:
[COMMENT: corrected JSON patch only]`
      }]
    }, promptEditorCapturedCallsGroup("text")];
  }
  function promptEditorImageEntities() {
    const entries = [];
    const add = (name, entity, source) => {
      const cleanName = String(name || "").trim();
      if (!cleanName || !entity) return;
      entries.push({
        name: cleanName,
        source,
        entity
      });
    };
    add(playerNameForPrompt(), app.state.player, "Current game player");
    for (const [name, entity] of Object.entries(app.state.characters || {})) add(name, entity, "Current game character");
    for (const npc of promptEditorNpcList(app.state)) {
      const name = npc?.name || npc?.full_character?.name;
      add(name, npc.full_character || npc, npc.full_character ? "Inspected NPC" : "Non-inspected NPC");
    }
    for (const record of characterLibraryRecords()) add(record.name, characterLibraryRecordEntity(record), "Character Library");
    return entries;
  }
  function promptEditorNpcList(state = app.state) {
    const list = [];
    const seen = new Set();
    const addNpc = npc => {
      if (!npc || typeof npc !== "object") return;
      const name = String(npc.name || npc.full_character?.name || "").trim();
      if (!name || seen.has(normalizeNameForMatch(name))) return;
      seen.add(normalizeNameForMatch(name));
      list.push(npc);
    };
    for (const npc of state?.scene?.npcs_present || []) {
      if (typeof npc === "string") continue;
      addNpc(npc);
    }
    for (const npc of state?.scene?.party_members_present || []) {
      if (typeof npc === "string") continue;
      addNpc(npc);
    }
    for (const loc of Object.values(state?.world_map?.locations || {})) {
      for (const npc of [...(loc?.npcs || []), ...(loc?.future_npcs || [])]) addNpc(npc);
    }
    for (const npc of Object.values(state?.npc_directory || {})) addNpc(npc);
    return list;
  }
  function promptEditorSelectedProfileEntity() {
    const state = promptEditorState();
    const entries = promptEditorImageEntities();
    return entries.find(entry => entry.name === state.selectedProfileName) || entries[0] || null;
  }
  function promptEditorSelectedImageTargetEntities() {
    const state = promptEditorState();
    const entries = promptEditorImageEntities();
    const selected = new Set(state.selectedImageTargets || []);
    const chosen = entries.filter(entry => selected.has(entry.name));
    return chosen.length ? chosen : entries.slice(0, 1);
  }
  function promptEditorImageSources() {
    return [{
      group: "Normal Scene Images",
      buttons: [{
        id: "normal-scene",
        label: "Normal scene image",
        buildFrom: "sanitizeFamilyFriendlyImagePrompt(buildGroupImagePrompt(...))",
        dynamicData: "currently selected normal image characters from Prompt Editor entity selector; runtime normal images use imageTargetNames()",
        lastLabels: [/image generation|normal image/i],
        build: () => {
          const targets = promptEditorSelectedImageTargetEntities();
          return sanitizeFamilyFriendlyImagePrompt(buildGroupImagePrompt(targets.map(entry => [entry.name, entry.entity])));
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          const targetNames = Array.isArray(replay.targets) && replay.targets.length ? replay.targets : imageTargetNames();
          const entities = targetNames.map(name => [name, runtimeImageEntity(name)]).filter(([, entity]) => entity);
          if (!entities.length) return call.prompt || "No image targets were available in the replay snapshot.";
          return sanitizeFamilyFriendlyImagePrompt(buildGroupImagePrompt(entities), {
            entity: entities[0][1]
          });
        },
        shellBuild: () => `[COMMENT: Normal scene image shell.]
[COMMENT: Builder: sanitizeFamilyFriendlyImagePrompt(buildGroupImagePrompt(targets))]
[COMMENT: Targets come from imageTargetNames() in real gameplay, or Prompt Editor selected normal image characters here.]

GROUP / SOLO IMAGE PROMPT:
[COMMENT: buildGroupImagePrompt([[name, runtimeImageEntity(name)], ...])]

NEGATIVE PROMPT:
[COMMENT: buildNegativeImagePrompt(primaryEntity)]

SEED:
[COMMENT: primaryEntity.image.seed when seed_enabled is true; otherwise random]`
      }]
    }, {
      group: "Profile Images",
      buttons: [{
        id: "profile-image",
        label: "Profile image",
        buildFrom: "buildProfileImagePrompt(name, entity)",
        dynamicData: "selected profile image entity from current game, inspected NPC, non-inspected NPC, or character library",
        lastLabels: [/profile image/i],
        build: () => {
          const target = promptEditorSelectedProfileEntity();
          return target ? sanitizeFamilyFriendlyImagePrompt(buildProfileImagePrompt(target.name, target.entity), {
            entity: target.entity
          }) : "No profile image source is available.";
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          const name = replay.name || promptEditorSelectedProfileEntity()?.name || "";
          const entity = profileEntity(name);
          return entity ? sanitizeFamilyFriendlyImagePrompt(buildProfileImagePrompt(name, entity), {
            entity
          }) : call.prompt || "No profile image entity was available in the replay snapshot.";
        },
        shellBuild: () => `[COMMENT: Profile image shell.]
[COMMENT: Builder: buildProfileImagePrompt(name, entity)]

CHARACTER UPPER BODY PROMPT:
[COMMENT: name/display data, currentAppearanceForProfilePrompt(...), buildProfileBodyPrompt(...), buildProfileUpperClothingPrompt(...)]

NEGATIVE PROMPT:
[COMMENT: buildProfileNegativePrompt(entity)]

SEED:
[COMMENT: entity.image.seed or image_prompt_config.seed / default seed path, normalized with 0 as valid]`
      }, {
        id: "uninspected-npc",
        label: "Non-inspected NPC preview image",
        buildFrom: "buildUninspectedNpcPreviewImagePrompt(name, npc)",
        dynamicData: "selected non-inspected NPC preview record",
        lastLabels: [/non-inspected|npc preview/i],
        build: () => {
          const target = promptEditorImageEntities().find(entry => entry.source === "Non-inspected NPC") || promptEditorSelectedProfileEntity();
          return target ? sanitizeFamilyFriendlyImagePrompt(buildUninspectedNpcPreviewImagePrompt(target.name, target.entity), {
            entity: target.entity
          }) : "No non-inspected NPC is available.";
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          const name = replay.name || "";
          const entity = profileEntity(name);
          return entity?.full_character ? sanitizeFamilyFriendlyImagePrompt(buildUninspectedNpcPreviewImagePrompt(name, entity), {
            entity
          }) : call.prompt || "No non-inspected NPC replay source was available.";
        },
        shellBuild: () => `[COMMENT: Non-inspected NPC preview image shell.]
[COMMENT: Builder: buildUninspectedNpcPreviewImagePrompt(name, npc)]

NPC PREVIEW PROMPT:
[COMMENT: short visible NPC description and preview-safe appearance fields only]

NEGATIVE PROMPT:
[COMMENT: buildProfileNegativePrompt(entity)]`
      }]
    }, {
      group: "Story / Library Images",
      buttons: [{
        id: "character-library-profile",
        label: "Character library profile image",
        buildFrom: "buildProfileImagePrompt(record.name, characterLibraryRecordEntity(record))",
        dynamicData: "selected character library definition entity",
        lastLabels: [/character library.*profile|profile image/i],
        build: () => {
          const target = promptEditorImageEntities().find(entry => entry.source === "Character Library") || promptEditorSelectedProfileEntity();
          return target ? sanitizeFamilyFriendlyImagePrompt(buildProfileImagePrompt(target.name, target.entity), {
            entity: target.entity
          }) : "No character library source is available.";
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          const name = replay.name || promptEditorSelectedProfileEntity()?.name || "";
          const entity = profileEntity(name) || promptEditorImageEntities().find(entry => entry.name === name)?.entity;
          return entity ? sanitizeFamilyFriendlyImagePrompt(buildProfileImagePrompt(name, entity), {
            entity
          }) : call.prompt || "No character library profile source was available in the replay snapshot.";
        },
        shellBuild: () => `[COMMENT: Character library profile image shell.]
[COMMENT: Builder: buildProfileImagePrompt(record.name, characterLibraryRecordEntity(record))]

CHARACTER DEFINITION PROFILE PROMPT:
[COMMENT: immutable character definition appearance/default clothing/profile style]

NEGATIVE PROMPT:
[COMMENT: buildProfileNegativePrompt(entity)]`
      }, {
        id: "story-title-card",
        label: "Story title card image",
        buildFrom: "defaultStoryTitleCardPrompt(template.state, template) / story image generation path",
        dynamicData: "story description, source/original flag, genres, visual title-card subjects, and title-card image settings",
        lastLabels: [/title|story/i],
        build: () => {
          const template = typeof selectedStoryTemplate === "function" && selectedStoryTemplate() || typeof currentStoryTemplate === "function" && currentStoryTemplate() || {
            title: storyTemplateTitle(app.state),
            description: storyTemplateDescription(app.state),
            state: app.state
          };
          return sanitizeFamilyFriendlyImagePrompt(defaultStoryTitleCardPrompt(template.state || template, template), {});
        },
        buildLast: call => {
          const replay = promptEditorReplayData(call);
          const template = replay.storyId ? storyTemplateById(replay.storyId) : null;
          return template ? sanitizeFamilyFriendlyImagePrompt(storyTitleCardPromptWithRules(defaultStoryTitleCardPrompt(template.state || template, template), template.state || template, template), {}) : call.prompt || "No story template was available in the replay snapshot.";
        },
        shellBuild: () => `[COMMENT: Story title card image shell.]
[COMMENT: Builder: defaultStoryTitleCardPrompt(template.state, template), or exact saved story image prompt if edited.]

STORY TITLE CARD PROMPT:
[COMMENT: story description/summary, source/original status for local display, genres, visual title-card subjects, and cover-background composition guidance. The generated image should not include rendered words; EmberAdventures overlays the story title in the UI.]

NEGATIVE PROMPT:
[COMMENT: Anti-text and anti-logo terms are intentionally included because EmberAdventures overlays story titles in the UI instead of asking the image generator to render words.]`
      }]
    }, promptEditorCapturedCallsGroup("images")];
  }
  function promptEditorSourceButtonHtml(type, source) {
    const id = String(source.id || promptEditorPromptKey(source.label));
    return `
                <div class="prompt-editor-source-row">
                    <span>${escapeHtml(source.label || id)}</span>
                    <button type="button" onclick="EmberAdventures.loadPromptEditorSource(${htmlJsArg(type)}, ${htmlJsArg(id)}, 'shell')">Shell</button>
                    <button type="button" onclick="EmberAdventures.loadPromptEditorSource(${htmlJsArg(type)}, ${htmlJsArg(id)}, 'last')">Last</button>
                </div>
            `;
  }
  function promptEditorSourceGroupsHtml(type = "text") {
    const groups = type === "images" ? promptEditorImageSources() : promptEditorTextSources();
    return groups.filter(group => (group.buttons || []).length).map((group, index) => `
                        <details ${index < 2 ? "open" : ""}>
                            <summary>${escapeHtml(group.group)}</summary>
                            <div class="prompt-editor-button-grid">
                                ${(group.buttons || []).map(button => promptEditorSourceButtonHtml(type, button)).join("")}
                            </div>
                        </details>
                    `).join("");
  }
  function promptEditorEntitySelectorsHtml() {
    const state = promptEditorState();
    const entries = promptEditorImageEntities();
    if (!state.selectedProfileName && entries[0]) state.selectedProfileName = entries[0].name;
    if (!(state.selectedImageTargets || []).length && entries[0]) state.selectedImageTargets = [entries[0].name];
    return `
                <div class="grid two">
                    <label>Profile image source
                        <select id="promptEditorProfileEntity" onchange="EmberAdventures.updatePromptEditorProfileEntity(this.value)">
                            ${entries.map(entry => `<option value="${escapeHtml(entry.name)}" ${entry.name === state.selectedProfileName ? "selected" : ""}>${escapeHtml(entry.name)} - ${escapeHtml(entry.source)}</option>`).join("")}
                        </select>
                    </label>
                    <label>Normal image characters
                        <select id="promptEditorImageTargets" multiple size="5" onchange="EmberAdventures.updatePromptEditorImageTargets([...this.selectedOptions].map(o => o.value))">
                            ${entries.map(entry => `<option value="${escapeHtml(entry.name)}" ${(state.selectedImageTargets || []).includes(entry.name) ? "selected" : ""}>${escapeHtml(entry.name)} - ${escapeHtml(entry.source)}</option>`).join("")}
                        </select>
                    </label>
                </div>
            `;
  }
  function promptEditorMetaHtml() {
    const state = promptEditorState();
    const text = state.tab === "images" ? state.imagePrompt : state.text;
    return `
                <div class="prompt-editor-meta">
                    <span>${escapeHtml(state.label || "No prompt selected")}</span>
                    <span>${escapeHtml(state.group || state.tab)}</span>
                    <span>${String(text || "").length.toLocaleString()} chars</span>
                    <span>${escapeHtml(state.source || "current game")}</span>
                </div>
            `;
  }
  function promptEditorTranscriptHtml() {
    const items = promptEditorState().transcript || [];
    return items.map((item, index) => {
      const displayNumber = index + 1;
      const collapsed = !!item.collapsed;
      const title = item.title || item.kind || "Message";
      return `
                        <div class="prompt-editor-message ${escapeHtml(item.kind || "")} ${item.streaming ? "streaming" : ""} ${collapsed ? "collapsed" : ""}" data-prompt-editor-message-id="${escapeHtml(item.id || "")}">
                            <div class="prompt-editor-message-header">
                                <strong class="prompt-editor-message-title"><span class="prompt-editor-message-number">#${displayNumber}</span><span>${escapeHtml(title)}</span></strong>
                                <span class="row">
                                    <button type="button" onclick="EmberAdventures.togglePromptEditorTranscriptItem(${index})">${collapsed ? "Expand" : "Collapse"}</button>
                                    <button type="button" onclick="EmberAdventures.copyPromptEditorTranscriptItem(${index})">Copy</button>
                                    <button type="button" onclick="EmberAdventures.downloadPromptEditorTranscriptItem(${index})">Download</button>
                                    <button type="button" class="danger" onclick="EmberAdventures.deletePromptEditorTranscriptItem(${index})">Delete</button>
                                </span>
                            </div>
                            <pre>${escapeHtml(item.text || "")}</pre>
                        </div>
                    `;
    }).join("") || `<p class="hint">No prompt editor messages yet.</p>`;
  }
  function promptEditorTabHtml() {
    const state = promptEditorState();
    const isImages = state.tab === "images";
    return `
                <div class="prompt-editor-shell">
                    <div class="prompt-editor-tabs">
                        <button type="button" class="${!isImages ? "active" : ""}" onclick="EmberAdventures.switchPromptEditorTab('text')">Text</button>
                        <button type="button" class="${isImages ? "active" : ""}" onclick="EmberAdventures.switchPromptEditorTab('images')">Images</button>
                        <button type="button" onclick="EmberAdventures.downloadPromptEditorTranscript()">Download Transcript</button>
                    </div>
                    ${isImages ? promptEditorEntitySelectorsHtml() : `<p class="hint">Pick a prompt source, edit the text, then send it directly to Perchance. Responses are plain text and do not affect the game.</p>`}
                    <div class="prompt-editor-body">
                        <aside class="prompt-editor-source-panel">${promptEditorSourceGroupsHtml(state.tab)}</aside>
                        <section class="prompt-editor-work-panel">
                            ${promptEditorMetaHtml()}
                            <textarea id="promptEditorText" class="prompt-editor-textarea" spellcheck="false">${escapeHtml(isImages ? state.imagePrompt : state.text)}</textarea>
                            <div class="row">
                                ${isImages ? `
                                            <label>Seed <input id="promptEditorImageSeed" type="number" value="${escapeHtml(state.imageSeed || "")}" placeholder="random"></label>
                                            <label>Resolution <input id="promptEditorImageResolution" value="${escapeHtml(state.imageResolution || "512x768")}"></label>
                                            <button class="primary" type="button" onclick="EmberAdventures.sendPromptEditorImage()">Generate Preview</button>
                                        ` : `<button class="primary" type="button" onclick="EmberAdventures.sendPromptEditorText()">Send Text</button>`}
                            </div>
                            <div id="promptEditorPreview" class="${isImages ? "prompt-editor-image-preview" : "prompt-editor-transcript"}">${isImages ? `<p class="hint">Generated image previews appear here only.</p>` : promptEditorTranscriptHtml()}</div>
                        </section>
                    </div>
                </div>
            `;
  }
  function openPromptEditorModal() {
    const state = promptEditorState();
    state.tab ||= "text";
    openModal(promptEditorTabHtml(), {
      title: "Prompt Editor",
      scrollKey: "prompt-editor"
    });
    $("modalBox")?.setAttribute("data-prompt-editor-modal", "1");
  }
  function refreshPromptEditorModal() {
    const box = $("modalBox");
    if (!box?.matches?.("[data-prompt-editor-modal='1']")) return;
    box.innerHTML = `<div class="modal-chrome-header"><div class="modal-chrome-title">Prompt Editor</div><button type="button" class="modal-close" title="Close" onclick="EmberAdventures.closeModal()">&times;</button></div>` + promptEditorTabHtml();
    box.setAttribute("data-prompt-editor-modal", "1");
  }
  function switchPromptEditorTab(tab = "text") {
    const state = promptEditorState();
    state.tab = tab === "images" ? "images" : "text";
    refreshPromptEditorModal();
  }
  function findPromptEditorSource(type = "text", id = "") {
    const groups = type === "images" ? promptEditorImageSources() : promptEditorTextSources();
    for (const group of groups) {
      const found = (group.buttons || []).find(button => button.id === id);
      if (found) return {
        group: group.group,
        source: found
      };
    }
    return null;
  }
  function loadPromptEditorSource(type = "text", id = "", variant = "shell") {
    const found = findPromptEditorSource(type, id);
    if (!found) return;
    const state = promptEditorState();
    try {
      const useLast = variant === "last";
      const lastCall = useLast ? promptEditorFindLastCall(type, found.source) : null;
      const text = String(useLast && lastCall?.snapshot ? withPromptEditorReplaySnapshot(lastCall, () => {
        const rebuilt = findPromptEditorSource(type, id)?.source || found.source;
        return promptEditorBuildLast(type, rebuilt, lastCall);
      }) : useLast ? promptEditorBuildLast(type, found.source, lastCall) : promptEditorBuildShell(type, found.source));
      state.label = `${found.source.label || id} - ${useLast ? "Last" : "Shell"}`;
      state.group = found.group;
      state.source = useLast ? "last sent prompt" : "prompt shell";
      if (type === "images") {
        state.tab = "images";
        state.imagePrompt = text;
      } else {
        state.tab = "text";
        state.text = text;
      }
    } catch (err) {
      const text = `Prompt source failed: ${err.message || String(err)}`;
      if (type === "images") state.imagePrompt = text;else state.text = text;
    }
    refreshPromptEditorModal();
  }
  function updatePromptEditorTextFromDom() {
    const state = promptEditorState();
    const text = $("promptEditorText")?.value || "";
    if (state.tab === "images") state.imagePrompt = text;else state.text = text;
  }
  function updatePromptEditorProfileEntity(value = "") {
    promptEditorState().selectedProfileName = String(value || "");
    refreshPromptEditorModal();
  }
  function updatePromptEditorImageTargets(values = []) {
    promptEditorState().selectedImageTargets = values.map(String).filter(Boolean);
  }
  function appendPromptEditorTranscript(kind = "message", title = "Message", text = "") {
    const state = promptEditorState();
    state.transcript ||= [];
    state.transcriptNextId = Number(state.transcriptNextId || 1);
    const item = {
      id: `prompt-editor-message-${state.transcriptNextId++}`,
      kind,
      title,
      text: String(text || ""),
      at: new Date().toISOString(),
      collapsed: false,
      streaming: false
    };
    state.transcript.push(item);
    if (state.transcript.length > 100) state.transcript.shift();
    return item.id;
  }
  function renderPromptEditorTranscriptOnly() {
    const preview = $("promptEditorPreview");
    const state = promptEditorState();
    if (!preview || state.tab === "images") return;
    preview.innerHTML = promptEditorTranscriptHtml();
    preview.scrollTop = preview.scrollHeight;
  }
  function updatePromptEditorTranscriptItem(id = "", updates = {}) {
    const item = (promptEditorState().transcript || []).find(entry => entry.id === id);
    if (!item) return;
    Object.assign(item, updates);
    const element = document.querySelector(`[data-prompt-editor-message-id="${cssEscape(id)}"]`);
    if (!element) {
      renderPromptEditorTranscriptOnly();
      return;
    }
    element.classList.toggle("streaming", !!item.streaming);
    element.classList.toggle("collapsed", !!item.collapsed);
    const pre = element.querySelector("pre");
    if (pre) pre.textContent = item.text || "";
    element.scrollIntoView({
      block: "nearest"
    });
  }
  function togglePromptEditorTranscriptItem(index) {
    const item = promptEditorState().transcript?.[Number(index)];
    if (!item) return;
    item.collapsed = !item.collapsed;
    renderPromptEditorTranscriptOnly();
  }
  function deletePromptEditorTranscriptItem(index) {
    const state = promptEditorState();
    if (!Array.isArray(state.transcript)) return;
    state.transcript.splice(Number(index), 1);
    renderPromptEditorTranscriptOnly();
  }
  async function sendPromptEditorText() {
    updatePromptEditorTextFromDom();
    const state = promptEditorState();
    const prompt = String(state.text || "");
    appendPromptEditorTranscript("sent", state.label || "Sent prompt", prompt);
    refreshPromptEditorModal();
    const responseId = appendPromptEditorTranscript("response", `Response: ${state.label || "manual text"}`, "");
    updatePromptEditorTranscriptItem(responseId, {
      text: "Waiting for streamed response...",
      streaming: true
    });
    try {
      const raw = await aiText(prompt, {
        label: `prompt editor: ${state.label || "manual text"}`,
        logType: "system",
        hasUniversalContext: true,
        onStream: streamed => {
          updatePromptEditorTranscriptItem(responseId, {
            text: streamed || "",
            streaming: true
          });
        }
      });
      updatePromptEditorTranscriptItem(responseId, {
        text: raw,
        streaming: false
      });
    } catch (err) {
      updatePromptEditorTranscriptItem(responseId, {
        kind: "error",
        title: "Text generation error",
        text: err.message || String(err),
        streaming: false
      });
    }
    renderPromptEditorTranscriptOnly();
  }
  async function sendPromptEditorImage() {
    updatePromptEditorTextFromDom();
    const state = promptEditorState();
    const prompt = String(state.imagePrompt || "");
    const safePrompt = sanitizeFamilyFriendlyImagePrompt(prompt, {});
    const seedText = $("promptEditorImageSeed")?.value || state.imageSeed || "";
    const resolution = $("promptEditorImageResolution")?.value || state.imageResolution || "512x768";
    state.imageSeed = seedText;
    state.imageResolution = resolution;
    appendPromptEditorTranscript("sent", state.label || "Sent image prompt", safePrompt);
    const preview = $("promptEditorPreview");
    if (preview) preview.innerHTML = imageLoadingHtml("Prompt Editor image preview");
    try {
      const html = await generateImageHtml(safePrompt, "", seedText !== "" ? parseProfileImageSeedInput(seedText, 0, "prompt editor seed") : undefined, app.settings.imageModel, {
        label: "prompt editor image preview",
        promptType: "prompt editor image preview",
        resolution,
        promptEditorPreview: true
      });
      appendPromptEditorTranscript("image", `Image preview: ${state.label || "manual image"}`, safePrompt);
      const currentPreview = $("promptEditorPreview");
      if (currentPreview) currentPreview.innerHTML = html || `<p class="hint">No image output returned.</p>`;
    } catch (err) {
      appendPromptEditorTranscript("error", "Image generation error", err.message || String(err));
      const currentPreview = $("promptEditorPreview");
      if (currentPreview) currentPreview.innerHTML = `<p class="hint">${escapeHtml(err.message || String(err))}</p>`;
    }
  }
  function promptEditorTranscriptItemText(index) {
    const item = promptEditorState().transcript?.[Number(index)] || {};
    return `${item.title || item.kind || "Prompt Editor Message"}\n${item.at || ""}\n\n${item.text || ""}`;
  }
  async function copyPromptEditorTranscriptItem(index) {
    await copyTextToClipboard(promptEditorTranscriptItemText(index));
  }
  function downloadTextPayload(text = "", filename = "emberadventures.txt") {
    const blob = new Blob([String(text || "")], {
      type: "text/plain"
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPromptEditorTranscriptItem(index) {
    const item = promptEditorState().transcript?.[Number(index)] || {};
    downloadTextPayload(promptEditorTranscriptItemText(index), `emberadventures-lite-prompt-editor-${safeArchiveFileName(item.title || item.kind || "message")}.txt`);
  }
  function downloadPromptEditorTranscript() {
    const text = (promptEditorState().transcript || []).map((_, index) => promptEditorTranscriptItemText(index)).join("\n\n===== NEXT MESSAGE =====\n\n");
    downloadTextPayload(text || "No Prompt Editor transcript entries.", `emberadventures-lite-prompt-editor-${Date.now()}.txt`);
  }
  function openMainMenuDataToolsModal() {
    const devSmokeButton = `<button type="button" onclick="EmberAdventures.openDevSmokeSuiteModal()"><span class="tool-icon" aria-hidden="true">&#128221;</span><span>Run Smoke Tests</span></button>`;
    const devPromptButton = `<button type="button" onclick="EmberAdventures.openPromptEditorModal()"><span class="tool-icon" aria-hidden="true">&#128196;</span><span>Prompt Editor</span></button>`;
    const runtimeTestButton = globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true && typeof window.EmberAdventures?.openRuntimeTests === "function" ? `<button type="button" onclick="EmberAdventures.openRuntimeTests()"><span class="tool-icon" aria-hidden="true">&#128295;</span><span>Runtime Tests</span></button>` : "";
    const featuredContentPublisherButton = app.settings?.devMode === true && isOfficialEmberAdventuresAdminUser(supabaseSignedInUser()) ? `<button type="button" onclick="EmberAdventures.openFeaturedContentPublisher()"><span class="tool-icon" aria-hidden="true">&#9733;</span><span>Featured Content Publisher</span></button>` : "";
    openModal(`
                <p class="hint">Import files, export files, and use developer tools.</p>
                <div class="grid two main-menu-tools-grid">
                    <button type="button" class="primary" onclick="EmberAdventures.importData()"><span class="tool-icon" aria-hidden="true">&#8679;</span><span>Import Data</span></button>
                    <button type="button" onclick="EmberAdventures.exportData()"><span class="tool-icon" aria-hidden="true">&#8681;</span><span>Export Data</span></button>
                    <button type="button" onclick="EmberAdventures.exportAllImages()"><span class="tool-icon" aria-hidden="true">&#128230;</span><span>Export All Images</span></button>
                    <button type="button" onclick="EmberAdventures.importAllImages()"><span class="tool-icon" aria-hidden="true">&#8679;</span><span>Import All Images</span></button>
                    <button type="button" onclick="EmberAdventures.openManageImagesModal()"><span class="tool-icon" aria-hidden="true">&#128444;</span><span>Manage Images</span></button>
                    <button type="button" onclick="EmberAdventures.openManageCharactersModal()"><span class="tool-icon" aria-hidden="true">&#128101;</span><span>Manage Characters</span></button>
                    <button type="button" class="danger" onclick="EmberAdventures.confirmDeleteDatabase()"><span class="tool-icon" aria-hidden="true">&#128465;</span><span>Delete DB</span></button>
                    ${devSmokeButton}
                    ${devPromptButton}
                    ${featuredContentPublisherButton}
                    ${runtimeTestButton}
                </div>
            `, {
      title: "Tools"
    });
    const creatorButton = document.createElement("button");
    creatorButton.type = "button";
    const creatorIcon = document.createElement("span");
    creatorIcon.className = "tool-icon";
    creatorIcon.textContent = "✎";
    creatorIcon.setAttribute("aria-hidden", "true");
    creatorButton.append(creatorIcon, document.createTextNode("Manage Creator Names"));
    creatorButton.onclick = openManageCreatorNames;
    $("modalBox").querySelector(".main-menu-tools-grid").appendChild(creatorButton);
    if (batchCharacterImageToolAuthorized()) {
      const grid = $("modalBox")?.querySelector(".main-menu-tools-grid");
      const button = document.createElement("button");
      const icon = document.createElement("span");
      const label = document.createElement("span");
      button.type = "button";
      button.title = "Generate normal images for selected local characters";
      button.onclick = openBatchCharacterImageTool;
      icon.className = "tool-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "\uD83C\uDFA8";
      label.textContent = "Batch Character Images";
      button.append(icon, label);
      grid?.append(button);
    }
    if (featuredContentPublisherAuthorized()) {
      const button = document.createElement("button");
      button.type = "button";
      const icon = document.createElement("span");
      icon.className = "tool-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "↑";
      const label = document.createElement("span");
      label.textContent = "Bulk Public Library Upload";
      button.append(icon, label);
      button.onclick = openBulkPublicCharacterUploader;
      $("modalBox")?.querySelector(".main-menu-tools-grid")?.append(button);
    }
  }
  const ManagedImageCategoryByStore = Object.freeze({
    characterProfileImages: "Profile Images",
    characterImages: "Character Images",
    storyTitleImages: "Title Images",
    storyItemImages: "Item Images",
    storyOutfitImages: "Outfit Images",
    storyRewardImages: "Reward Images",
    storyImages: "Scene Images"
  });
  function managedImagesState() {
    app.managedImages ||= {
      items: [],
      saveHeaders: [],
      itemsByKey: new Map(),
      groupsByKey: new Map(),
      objectUrls: new Map(),
      observer: null,
      openGroups: null,
      query: "",
      selectedKeys: new Set(),
      restoreScrollTop: null,
      deleting: false
    };
    return app.managedImages;
  }
  function managedImageKey(item = {}) {
    return `${item.storeName}|${item.saveId ?? ""}|${item.imageId}`;
  }
  function managedImageDeleteReference(item = {}) {
    return item.storeName === "storyImages" ? {
      storeName: item.storeName,
      imageId: item.imageId,
      saveId: item.saveId
    } : {
      storeName: item.storeName,
      imageId: item.imageId
    };
  }
  function cleanupManagedImageThumbnails() {
    const state = managedImagesState();
    state.observer?.disconnect?.();
    state.observer = null;
    for (const url of state.objectUrls.values()) URL.revokeObjectURL(url);
    state.objectUrls.clear();
  }
  function managedCharacterNameMap(items = []) {
    const names = new Map();
    const register = (value = {}) => {
      const character = value?.full_character || value?.character || value?.npc?.full_character || value?.npc || value;
      const id = String(character?.id || character?.character_id || value?.id || "");
      const name = String(character?.name || value?.name || "");
      if (id && name && !names.has(id)) names.set(id, name);
    };
    for (const record of app.characterDefinitions || []) {
      const character = record.character || record.character_definition || {};
      const id = String(record.id || character.id || "");
      const name = String(record.name || character.name || "");
      if (id && name) names.set(id, name);
    }
    for (const template of app.storyTemplates || []) {
      const state = template.state || {};
      Object.values(state.characters || {}).forEach(register);
      for (const location of Object.values(state.npc_directory?.locations || {})) {
        Object.values(location?.characters || {}).forEach(register);
        Object.values(location?.npcs || {}).forEach(register);
      }
      Object.values(state.future_cast?.items || {}).forEach(register);
      (template.future_characters || []).forEach(register);
      storyTemplatePlayerOptions(template).forEach(option => register(option.character));
    }
    for (const image of app.profileImages || []) {
      const id = String(image.character_id || "");
      const name = String(image.owner_name || image.name || "");
      if (id && name && !names.has(id)) names.set(id, name);
    }
    for (const item of items) {
      const id = String(item.characterId || "");
      if (id && !names.has(id)) names.set(id, id);
    }
    return names;
  }
  function managedStandaloneCharacterIds() {
    return new Set((app.characterDefinitions || []).map(record => {
      const character = record.character || record.character_definition || {};
      return String(record.id || character.id || "");
    }).filter(Boolean));
  }
  function managedStoryCharacterSpeciesValue(character = {}) {
    return textSlot(character?.appearance?.species || character?.species, "");
  }
  function managedStoryCharacterOwners() {
    const owners = new Map();
    const register = (storyId, storyTitle, value = {}, options = {}) => {
      const character = value?.full_character || value?.character || value?.npc || value;
      const characterId = String(character?.id || character?.character_id || character?.definition_id || value?.id || "");
      if (!storyId || !characterId) return;
      if (!owners.has(characterId)) owners.set(characterId, []);
      let owner = owners.get(characterId).find(candidate => candidate.storyId === storyId);
      if (!owner) {
        owner = {
          storyId,
          storyTitle,
          character,
          player: false,
          shops: []
        };
        owners.get(characterId).push(owner);
      }
      if (!owner.character?.name && character?.name || !managedStoryCharacterSpeciesValue(owner.character) && managedStoryCharacterSpeciesValue(character)) owner.character = character;
      if (options.player === true) owner.player = true;
      return owner;
    };
    for (const template of app.storyTemplates || []) {
      const storyId = String(template.id || template.story_id || "");
      const storyTitle = String(template.title || template.name || storyId);
      const state = template.state || {};
      Object.values(state.characters || {}).forEach(value => register(storyId, storyTitle, value));
      for (const location of Object.values(state.npc_directory?.locations || {})) {
        Object.values(location?.characters || {}).forEach(value => register(storyId, storyTitle, value));
        Object.values(location?.npcs || {}).forEach(value => register(storyId, storyTitle, value));
      }
      Object.values(state.future_cast?.items || {}).forEach(value => register(storyId, storyTitle, value));
      (template.future_characters || state.future_cast?.characters || []).forEach(value => register(storyId, storyTitle, value));
      storyTemplatePlayerOptions(template).forEach(option => register(storyId, storyTitle, option.character, {
        player: true
      }));
      for (const shop of Object.values(state.story_shops || {})) {
        if (String(shop?.type || "") !== "character") continue;
        const shopId = String(shop.id || "");
        const shopTitle = String(shop.title || shop.name || shopId || "Character Shop");
        for (const item of Array.isArray(shop.items) ? shop.items : []) {
          const characterId = String(item?.character_id || "");
          if (!characterId) continue;
          const owner = register(storyId, storyTitle, {
            id: characterId
          });
          if (owner && !owner.shops.some(candidate => candidate.id === shopId)) owner.shops.push({
            id: shopId,
            title: shopTitle
          });
        }
      }
    }
    return owners;
  }
  function managedStoryNameMap(items = [], saveHeaders = []) {
    const names = new Map();
    for (const template of app.storyTemplates || []) {
      const id = String(template.id || template.story_id || "");
      const name = String(template.title || template.name || "");
      if (id && name) names.set(id, name);
    }
    for (const item of items) {
      const id = String(item.storyId || "");
      const name = String(item.storyTitle || "");
      if (id && name && !names.has(id)) names.set(id, name);
    }
    for (const header of saveHeaders) {
      const id = String(header.storyId || "");
      const name = String(header.displayName || "");
      if (id && name && !names.has(id)) names.set(id, name);
    }
    return names;
  }
  function managedImageRegisterGroup(label, items) {
    const state = managedImagesState();
    const key = `managed-image-group-${state.groupsByKey.size + 1}`;
    state.groupsByKey.set(key, items.map(managedImageKey));
    return `<button type="button" class="danger managed-image-group-delete" data-managed-image-group-delete="${key}" onclick="event.preventDefault(); event.stopPropagation(); EmberAdventures.deleteManagedImageGroup('${key}')">Delete ${escapeHtml(label)}</button>`;
  }
  function managedImageReadableIdentifier(value = "") {
    return String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function managedImageSearchNames(item = {}, characterNames = new Map()) {
    const names = new Set();
    const add = value => {
      const name = String(value || "").trim();
      if (name) names.add(name);
    };
    const addIdentifierName = value => {
      add(managedImageReadableIdentifier(value));
    };
    if (item.characterId) add(characterNames.get(String(item.characterId)) || "");
    if (item.storeName === "storyTitleImages") add(item.storyTitle);
    if (item.storeName === "storyItemImages") addIdentifierName(item.itemId);
    if (item.storeName === "storyOutfitImages") addIdentifierName(item.outfitId);
    if (item.storeName === "storyRewardImages") add(item.title || managedImageReadableIdentifier(item.rewardImageId));
    if (item.storeName === "storyImages") {
      (item.targetNames || []).forEach(add);
      add(item.title);
    }
    if (!names.size) add(item.title);
    return [...names];
  }
  function managedImageCardLabel(item = {}) {
    if (item.storeName === "characterProfileImages") return item.presentation === "male" ? "Male profile" : "Non-male profile";
    if (item.storeName === "characterImages") return item.presentation === "male" ? "Male character image" : "Non-male character image";
    if (item.storeName === "storyTitleImages") return item.storyTitle || "Story title image";
    if (item.storeName === "storyItemImages") return item.itemId || "Story item";
    if (item.storeName === "storyOutfitImages") return [item.characterId, item.outfitId].filter(Boolean).join(" / ") || "Story outfit";
    if (item.storeName === "storyRewardImages") return item.title || item.rewardImageId || "Story reward";
    return item.title || "Scene image";
  }
  function managedImageGridHtml(items = []) {
    if (!items.length) return `<p class="hint managed-image-empty">No local images in this group.</p>`;
    return `<div class="managed-image-grid">${items.map(item => {
      const key = managedImageKey(item);
      return `
                    <article class="managed-image-card" data-managed-image-card="${escapeHtml(key)}" data-managed-image-search="${escapeHtml((item.managedSearchNames || []).join("\n").toLocaleLowerCase())}">
                        <label class="managed-image-select" title="Select image">
                            <input type="checkbox" ${managedImagesState().selectedKeys.has(key) ? "checked" : ""} onchange="EmberAdventures.toggleManagedImageSelection(${htmlJsArg(key)}, this.checked)">
                            <span class="sr-only">Select ${escapeHtml(managedImageCardLabel(item))}</span>
                            <span class="managed-image-thumbnail" data-managed-image-thumbnail="${escapeHtml(key)}">
                                <span class="spinner" aria-label="Loading image"></span>
                            </span>
                        </label>
                        <button type="button" class="danger managed-image-delete" title="Delete image" aria-label="Delete ${escapeHtml(managedImageCardLabel(item))}" onclick="event.preventDefault(); event.stopPropagation(); EmberAdventures.deleteManagedImage(${htmlJsArg(key)})">Delete</button>
                        <div class="managed-image-card-label">${escapeHtml(managedImageCardLabel(item))}</div>
                    </article>`;
    }).join("")}</div>`;
  }
  function managedImageDetailsHtml(path, label, items, bodyHtml, options = {}) {
    const state = managedImagesState();
    const open = state.openGroups == null || state.openGroups.has(path);
    const deleteButton = items.length ? managedImageRegisterGroup(label, items) : "";
    return `
                <details class="managed-image-group ${options.root ? "managed-image-root-group" : ""}" data-managed-image-group-path="${escapeHtml(path)}" ${open ? "open" : ""}>
                    <summary>
                        <span>${escapeHtml(label)} <span class="managed-image-count">${items.length}</span></span>
                        ${deleteButton}
                    </summary>
                    <div class="managed-image-group-body">${bodyHtml}</div>
                </details>`;
  }
  function managedCharacterGroupsHtml(items = [], options = {}) {
    const names = managedCharacterNameMap(items);
    const byCharacter = new Map();
    for (const item of items) {
      const id = item.characterId || "Unknown character";
      if (!byCharacter.has(id)) byCharacter.set(id, []);
      byCharacter.get(id).push(item);
    }
    const owners = [...byCharacter.entries()].sort((left, right) => String(names.get(left[0]) || left[0]).localeCompare(String(names.get(right[0]) || right[0])));
    const body = owners.map(([characterId, characterItems]) => {
      const categories = Object.entries(ManagedImageCategoryByStore).filter(([storeName]) => storeName.startsWith("character")).map(([storeName, label]) => {
        const categoryItems = characterItems.filter(item => item.storeName === storeName);
        return categoryItems.length ? managedImageDetailsHtml(`${options.pathPrefix || "character"}:${characterId}:${storeName}`, label, categoryItems, managedImageGridHtml(categoryItems)) : "";
      }).join("");
      return managedImageDetailsHtml(`${options.pathPrefix || "character"}:${characterId}`, names.get(characterId) || characterId, characterItems, categories);
    }).join("");
    return managedImageDetailsHtml(options.path || "characters", options.label || "Characters", items, body || managedImageGridHtml([]), {
      root: options.root !== false
    });
  }
  function managedStorySceneGroupsHtml(storyId, items, saveHeaders) {
    const headersById = new Map(saveHeaders.map(header => [String(header.saveId), header]));
    const bySave = new Map();
    for (const item of items) {
      const key = String(item.saveId || "Unknown save");
      if (!bySave.has(key)) bySave.set(key, []);
      bySave.get(key).push(item);
    }
    return [...bySave.entries()].map(([saveId, saveItems]) => {
      const header = headersById.get(saveId);
      const label = header?.displayName ? `${header.displayName} (Save ${saveId})` : `Save ${saveId}`;
      return managedImageDetailsHtml(`story:${storyId}:scene:${saveId}`, label, saveItems, managedImageGridHtml(saveItems));
    }).join("");
  }
  function managedStoryCharacterSpecies(item = {}) {
    return managedStoryCharacterSpeciesValue(item.managedStoryOwner?.character) || "Unknown species";
  }
  function managedStoryShopCharacterGroupsHtml(storyId, items = []) {
    if (!items.length) return "";
    const byShop = new Map();
    for (const item of items) {
      const shop = item.managedStoryOwner?.shops?.[0] || {
        id: "unknown-shop",
        title: "Unknown Shop"
      };
      if (!byShop.has(shop.id)) byShop.set(shop.id, {
        shop,
        items: []
      });
      byShop.get(shop.id).items.push(item);
    }
    const shops = [...byShop.values()].sort((left, right) => left.shop.title.localeCompare(right.shop.title));
    const body = shops.map(({
      shop,
      items: shopItems
    }) => {
      const bySpecies = new Map();
      for (const item of shopItems) {
        const species = managedStoryCharacterSpecies(item);
        if (!bySpecies.has(species)) bySpecies.set(species, []);
        bySpecies.get(species).push(item);
      }
      const speciesGroups = [...bySpecies.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([species, speciesItems]) => managedCharacterGroupsHtml(speciesItems, {
        path: `story:${storyId}:shop:${shop.id}:species:${species}`,
        pathPrefix: `story:${storyId}:shop:${shop.id}:species:${species}:character`,
        label: species,
        root: false
      })).join("");
      return managedImageDetailsHtml(`story:${storyId}:shop:${shop.id}`, shop.title, shopItems, speciesGroups);
    }).join("");
    return managedImageDetailsHtml(`story:${storyId}:shop-characters`, "Shop Characters", items, body);
  }
  function managedStoryGroupsHtml(items = [], saveHeaders = []) {
    const names = managedStoryNameMap(items, saveHeaders);
    const headersBySaveId = new Map(saveHeaders.map(header => [String(header.saveId), header]));
    const byStory = new Map();
    for (const item of items) {
      const storyId = item.managedStoryId ? String(item.managedStoryId) : item.storeName === "storyImages" ? String(headersBySaveId.get(String(item.saveId))?.storyId || `save-${item.saveId}`) : String(item.storyId || "Unknown story");
      if (!byStory.has(storyId)) byStory.set(storyId, []);
      byStory.get(storyId).push(item);
    }
    const stories = [...byStory.entries()].sort((left, right) => String(names.get(left[0]) || left[0]).localeCompare(String(names.get(right[0]) || right[0])));
    const body = stories.map(([storyId, storyItems]) => {
      const characterItems = storyItems.filter(item => item.storeName.startsWith("character"));
      const playerCharacterItems = characterItems.filter(item => item.managedStoryOwner?.player === true);
      const shopCharacterItems = characterItems.filter(item => item.managedStoryOwner?.player !== true && item.managedStoryOwner?.shops?.length);
      const otherCharacterItems = characterItems.filter(item => item.managedStoryOwner?.player !== true && !item.managedStoryOwner?.shops?.length);
      const categories = Object.entries(ManagedImageCategoryByStore).filter(([storeName]) => storeName.startsWith("story")).map(([storeName, label]) => {
        const categoryItems = storyItems.filter(item => item.storeName === storeName);
        if (!categoryItems.length) return "";
        const categoryBody = storeName === "storyImages" ? managedStorySceneGroupsHtml(storyId, categoryItems, saveHeaders) : managedImageGridHtml(categoryItems);
        return managedImageDetailsHtml(`story:${storyId}:${storeName}`, label, categoryItems, categoryBody);
      }).join("");
      const playerCharacters = playerCharacterItems.length ? managedCharacterGroupsHtml(playerCharacterItems, {
        path: `story:${storyId}:player-characters`,
        pathPrefix: `story:${storyId}:player-character`,
        label: "Player Characters",
        root: false
      }) : "";
      const shopCharacters = managedStoryShopCharacterGroupsHtml(storyId, shopCharacterItems);
      const otherCharacters = otherCharacterItems.length ? managedCharacterGroupsHtml(otherCharacterItems, {
        path: `story:${storyId}:other-characters`,
        pathPrefix: `story:${storyId}:other-character`,
        label: "Other Characters",
        root: false
      }) : "";
      return managedImageDetailsHtml(`story:${storyId}`, names.get(storyId) || storyId, storyItems, `${playerCharacters}${otherCharacters}${shopCharacters}${categories}`);
    }).join("");
    return managedImageDetailsHtml("stories", "Stories", items, body || managedImageGridHtml([]), {
      root: true
    });
  }
  function rememberManagedImageOpenGroups() {
    const state = managedImagesState();
    const groups = $("modalBox")?.querySelectorAll?.("[data-managed-image-group-path]") || [];
    state.openGroups = new Set([...groups].filter(group => group.open).map(group => group.dataset.managedImageGroupPath));
  }
  async function loadManagedImageThumbnail(element) {
    const state = managedImagesState();
    const key = element?.dataset?.managedImageThumbnail || "";
    const item = state.itemsByKey.get(key);
    if (!item || element.dataset.loaded === "1") return;
    element.dataset.loaded = "1";
    try {
      let url = "";
      if (item.hasLocalAsset) {
        const asset = await app.persistence.getRecord("assetBlobs", item.imageId);
        if (!(asset?.blob instanceof Blob)) throw new Error("Local image data is missing.");
        url = URL.createObjectURL(asset.blob);
        state.objectUrls.set(key, url);
      } else {
        url = String(item.url || "").trim();
        if (!/^(?:https?:|data:image\/|blob:)/i.test(url)) throw new Error("Image data and hosted URL are unavailable.");
      }
      if (!element.isConnected || !state.itemsByKey.has(key)) return;
      const image = document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = managedImageCardLabel(item);
      image.onerror = () => {
        if (element.isConnected) element.innerHTML = `<span class="managed-image-load-error">Image unavailable</span>`;
      };
      image.src = url;
      element.replaceChildren(image);
    } catch (error) {
      if (element.isConnected) element.innerHTML = `<span class="managed-image-load-error">Image unavailable</span>`;
    }
  }
  function initializeManagedImageThumbnails() {
    const state = managedImagesState();
    state.observer?.disconnect?.();
    const thumbnails = [...($("modalBox")?.querySelectorAll?.("[data-managed-image-thumbnail]") || [])];
    if (!("IntersectionObserver" in window)) {
      thumbnails.forEach(loadManagedImageThumbnail);
      return;
    }
    state.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        state.observer?.unobserve(entry.target);
        loadManagedImageThumbnail(entry.target);
      }
    }, {
      root: $("modalBox"),
      rootMargin: "400px 0px"
    });
    thumbnails.forEach(thumbnail => state.observer.observe(thumbnail));
  }
  function filterManagedImages(value = "") {
    const state = managedImagesState();
    const query = String(value || "").trim().toLocaleLowerCase();
    state.query = String(value || "");
    const modal = $("modalBox");
    if (!modal?.matches?.("[data-manage-images-modal='1']")) return;
    const cards = [...modal.querySelectorAll("[data-managed-image-card]")];
    for (const card of cards) {
      const matches = !query || String(card.dataset.managedImageSearch || "").includes(query);
      card.hidden = !matches;
    }
    const groups = [...modal.querySelectorAll("[data-managed-image-group-path]")].reverse();
    for (const group of groups) {
      const visibleCards = [...group.querySelectorAll("[data-managed-image-card]")].filter(card => !card.hidden);
      group.hidden = !!query && !visibleCards.length;
      const count = group.querySelector(":scope > summary .managed-image-count");
      if (count) count.textContent = String(visibleCards.length);
      const deleteButton = group.querySelector(":scope > summary [data-managed-image-group-delete]");
      const groupKey = deleteButton?.dataset?.managedImageGroupDelete || "";
      if (groupKey) state.groupsByKey.set(groupKey, visibleCards.map(card => card.dataset.managedImageCard));
    }
    const noMatches = modal.querySelector("[data-managed-images-no-matches]");
    if (noMatches) noMatches.hidden = !query || cards.some(card => !card.hidden);
    updateManagedImageSelectionControls();
  }
  function visibleManagedImageKeys() {
    const modal = $("modalBox");
    if (!modal?.matches?.("[data-manage-images-modal='1']")) return [];
    return [...modal.querySelectorAll("[data-managed-image-card]")].filter(card => !card.hidden).map(card => card.dataset.managedImageCard).filter(Boolean);
  }
  function updateManagedImageSelectionControls() {
    const state = managedImagesState();
    for (const key of [...state.selectedKeys]) {
      if (!state.itemsByKey.has(key)) state.selectedKeys.delete(key);
    }
    const modal = $("modalBox");
    if (!modal?.matches?.("[data-manage-images-modal='1']")) return;
    for (const card of modal.querySelectorAll("[data-managed-image-card]")) {
      const selected = state.selectedKeys.has(card.dataset.managedImageCard);
      card.classList.toggle("selected", selected);
      const checkbox = card.querySelector(".managed-image-select input[type='checkbox']");
      if (checkbox) checkbox.checked = selected;
    }
    const visibleKeys = visibleManagedImageKeys();
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => state.selectedKeys.has(key));
    const selectAll = modal.querySelector("[data-managed-images-select-all]");
    if (selectAll) {
      selectAll.disabled = !visibleKeys.length || state.deleting;
      selectAll.textContent = allVisibleSelected ? "Deselect All Shown" : "Select All Shown";
    }
    const deleteSelected = modal.querySelector("[data-managed-images-delete-selected]");
    if (deleteSelected) {
      deleteSelected.disabled = !state.selectedKeys.size || state.deleting;
      deleteSelected.textContent = state.selectedKeys.size ? `Delete Selected (${state.selectedKeys.size})` : "Delete Selected";
    }
  }
  function toggleManagedImageSelection(key = "", checked = false) {
    const state = managedImagesState();
    const exactKey = String(key || "");
    if (!state.itemsByKey.has(exactKey)) return;
    if (checked) state.selectedKeys.add(exactKey);else state.selectedKeys.delete(exactKey);
    updateManagedImageSelectionControls();
  }
  function toggleAllManagedImages() {
    const state = managedImagesState();
    const visibleKeys = visibleManagedImageKeys();
    const deselect = visibleKeys.length > 0 && visibleKeys.every(key => state.selectedKeys.has(key));
    for (const key of visibleKeys) {
      if (deselect) state.selectedKeys.delete(key);else state.selectedKeys.add(key);
    }
    updateManagedImageSelectionControls();
  }
  function deleteSelectedManagedImages() {
    const state = managedImagesState();
    return deleteManagedImageKeys([...state.selectedKeys], "the selected images");
  }
  function renderManagedImagesModal() {
    const state = managedImagesState();
    cleanupManagedImageThumbnails();
    state.groupsByKey = new Map();
    const characterNames = managedCharacterNameMap(state.items);
    const items = state.items.map(item => ({
      ...item,
      managedSearchNames: managedImageSearchNames(item, characterNames)
    }));
    state.itemsByKey = new Map(items.map(item => [managedImageKey(item), item]));
    const standaloneCharacterIds = managedStandaloneCharacterIds();
    const storyCharacterOwners = managedStoryCharacterOwners();
    const characterItems = [];
    const storyCharacterItems = [];
    for (const item of items.filter(value => value.storeName.startsWith("character"))) {
      const characterId = String(item.characterId || "");
      const storyOwner = storyCharacterOwners.get(characterId)?.[0];
      if (storyOwner && !standaloneCharacterIds.has(characterId)) {
        storyCharacterItems.push({
          ...item,
          managedStoryOwner: storyOwner,
          managedStoryId: storyOwner.storyId,
          storyId: storyOwner.storyId,
          storyTitle: storyOwner.storyTitle
        });
      } else characterItems.push(item);
    }
    const storyItems = [...items.filter(item => item.storeName.startsWith("story")), ...storyCharacterItems];
    const classifiedKeys = new Set([...characterItems, ...storyItems].map(managedImageKey));
    const unclassifiedItems = items.filter(item => !classifiedKeys.has(managedImageKey(item)));
    const unclassified = unclassifiedItems.length ? managedImageDetailsHtml("unclassified", "Unclassified Images", unclassifiedItems, managedImageGridHtml(unclassifiedItems), {
      root: true
    }) : "";
    const empty = !state.items.length ? `<div class="managed-images-empty"><strong>No local images</strong><p>Generated local images will appear here.</p></div>` : "";
    openModal(`
                <div class="managed-images-toolbar">
                    <input type="search" value="${escapeHtml(state.query)}" placeholder="Search image names..." aria-label="Search images by character, item, reward, or place name" oninput="EmberAdventures.filterManagedImages(this.value)">
                    <div class="managed-images-selection-actions">
                        <button type="button" data-managed-images-select-all onclick="EmberAdventures.toggleAllManagedImages()">Select All Shown</button>
                        <button type="button" class="danger" data-managed-images-delete-selected onclick="EmberAdventures.deleteSelectedManagedImages()" disabled>Delete Selected</button>
                    </div>
                    <p class="hint">${state.items.length} image record${state.items.length === 1 ? "" : "s"}. Delete buttons permanently remove the selected image record and any local image data.</p>
                </div>
                <div class="managed-images-browser">
                    <div class="managed-images-empty" data-managed-images-no-matches hidden><strong>No matching images</strong><p>No image names match this search.</p></div>
                    ${empty || `${managedCharacterGroupsHtml(characterItems)}${managedStoryGroupsHtml(storyItems, state.saveHeaders)}${unclassified}`}
                </div>
            `, {
      title: "Manage Images",
      closeDestination: "main-menu",
      scrollKey: "manage-images"
    });
    $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
    $("modalBox")?.setAttribute("data-manage-images-modal", "1");
    app.modalCloseCallback = cleanupManagedImageThumbnails;
    filterManagedImages(state.query);
    const browser = $("modalBox")?.querySelector?.(".managed-images-browser");
    if (browser && Number.isFinite(state.restoreScrollTop)) browser.scrollTop = state.restoreScrollTop;
    state.restoreScrollTop = null;
    requestAnimationFrame(initializeManagedImageThumbnails);
  }
  async function refreshManagedImagesModal() {
    const state = managedImagesState();
    const catalog = await app.persistence.listManagedImages();
    state.items = Array.isArray(catalog?.items) ? catalog.items : [];
    state.saveHeaders = Array.isArray(catalog?.saveHeaders) ? catalog.saveHeaders : [];
    renderManagedImagesModal();
  }
  async function openManageImagesModal() {
    const state = managedImagesState();
    state.openGroups = null;
    state.query = "";
    state.selectedKeys = new Set();
    state.restoreScrollTop = null;
    openModal(`<div class="blocking-loading-content"><span class="spinner"></span><strong>Loading images...</strong></div>`, {
      title: "Manage Images",
      closeDestination: "main-menu"
    });
    $("modalBox")?.setAttribute("data-fullscreen-list-modal", "1");
    $("modalBox")?.setAttribute("data-manage-images-modal", "1");
    try {
      await refreshManagedImagesModal();
    } catch (error) {
      showNotice("Manage Images Failed", error?.message || String(error));
    }
  }
  function removeManagedImagesFromRuntime(items = []) {
    const removedImageIds = new Set(items.map(item => item.imageId));
    const profileItems = items.filter(item => item.storeName === "characterProfileImages");
    const removedProfileIds = new Set(profileItems.map(item => item.imageId));
    const clearProfileReferences = entity => {
      if (!entity || typeof entity !== "object") return false;
      let changed = false;
      if (removedProfileIds.has(String(entity.profile_image_id || ""))) {
        entity.profile_image_id = "";
        changed = true;
      }
      if (removedProfileIds.has(String(entity.default_profile_image?.local_image_id || ""))) {
        entity.default_profile_image = {
          ...entity.default_profile_image,
          local_image_id: ""
        };
        changed = true;
      }
      if (Array.isArray(entity.profile_images)) {
        const filtered = entity.profile_images.filter(image => !removedProfileIds.has(String(image?.id || image?.local_image_id || "")));
        if (filtered.length !== entity.profile_images.length) {
          entity.profile_images = filtered;
          changed = true;
        }
      } else if (entity.profile_images && typeof entity.profile_images === "object") {
        const imageIds = (entity.profile_images.image_ids || []).filter(imageId => !removedProfileIds.has(String(imageId || "")));
        const activeImageId = removedProfileIds.has(String(entity.profile_images.active_image_id || "")) ? "" : entity.profile_images.active_image_id;
        if (imageIds.length !== (entity.profile_images.image_ids || []).length || activeImageId !== entity.profile_images.active_image_id) {
          entity.profile_images = {
            ...entity.profile_images,
            image_ids: imageIds,
            active_image_id: activeImageId
          };
          changed = true;
        }
      }
      for (const presentation of ["male", "non_male"]) {
        const slot = entity.profile_image_presentations?.[presentation];
        if (!removedProfileIds.has(String(slot?.local_image_id || ""))) continue;
        entity.profile_image_presentations[presentation] = {
          ...slot,
          local_image_id: ""
        };
        changed = true;
      }
      return changed;
    };
    const changedCharacterRecords = [];
    for (const record of app.characterDefinitions || []) {
      const character = record.character || record.character_definition;
      let changed = clearProfileReferences(character);
      if (record.active_profile_image_ids && typeof record.active_profile_image_ids === "object") {
        for (const presentation of ["male", "non_male"]) {
          if (!removedProfileIds.has(String(record.active_profile_image_ids[presentation] || ""))) continue;
          record.active_profile_image_ids[presentation] = "";
          changed = true;
        }
      }
      if (changed) changedCharacterRecords.push(record);
    }
    clearProfileReferences(app.state?.player);
    for (const character of Object.values(app.state?.characters || {})) clearProfileReferences(character);
    if (changedCharacterRecords.length) saveCharacterLibraryRecordsNow(changedCharacterRecords, "managed profile image deletion");
    app.deletedProfileImageIds ||= new Set();
    removedProfileIds.forEach(imageId => app.deletedProfileImageIds.add(imageId));
    app.profileImages = (app.profileImages || []).filter(image => !removedProfileIds.has(String(image.id)));
    const removedCharacterImageIds = new Set(items.filter(item => item.storeName === "characterImages").map(item => String(item.imageId || "")));
    app.characterImages = (app.characterImages || []).filter(image => !removedCharacterImageIds.has(String(image.id || "")));
    const removedTitleIds = new Set(items.filter(item => item.storeName === "storyTitleImages").map(item => item.imageId));
    app.storyTitleCardImages = (app.storyTitleCardImages || []).filter(image => !removedTitleIds.has(String(image.id)));
    const changedStoryTemplates = [];
    for (const template of app.storyTemplates || []) {
      if (!removedTitleIds.has(String(template.title_card_image?.local_image_id || ""))) continue;
      template.title_card_image = emptyStoryTitleCardImageSlot();
      changedStoryTemplates.push(template);
    }
    if (changedStoryTemplates.length) saveStoryTemplateRecordsNow(changedStoryTemplates, "managed story title image deletion");
    for (const header of app.saveIndex || []) {
      if (!removedImageIds.has(String(header.titleImageId || ""))) continue;
      delete header.titleImageId;
    }
    const activeId = String(activeSaveId() || "");
    const activeSceneIds = new Set(items.filter(item => item.storeName === "storyImages" && String(item.saveId) === activeId).map(item => item.imageId));
    if (activeSceneIds.size) {
      for (const imageId of activeSceneIds) removeImageRecord(imageId, {
        save: false,
        refresh: false
      });
      scheduleActiveGameSave();
    }
    refreshKeptImageRuntimeSet();
  }
  function applyManagedProfileSelectionChanges(changes = [], removedItems = []) {
    const selections = new Map(changes.map(change => [`${String(change.characterId || "")}\u0000${String(change.presentation || "")}`, String(change.imageId || "")]));
    if (!selections.size) return;
    const removedIds = new Set(removedItems.filter(item => item.storeName === "characterProfileImages").map(item => String(item.imageId || "")));
    const applyToEntity = entity => {
      if (!entity || typeof entity !== "object") return false;
      const characterId = String(entity.id || entity.character_id || "");
      if (!characterId) return false;
      let changed = false;
      if (Array.isArray(entity.profile_images)) {
        const filtered = entity.profile_images.filter(image => !removedIds.has(String(image?.id || "")));
        if (filtered.length !== entity.profile_images.length) {
          entity.profile_images = filtered;
          changed = true;
        }
      }
      for (const presentation of ["male", "non_male"]) {
        const key = `${characterId}\u0000${presentation}`;
        if (!selections.has(key)) continue;
        const imageId = selections.get(key);
        const male = presentation === "male";
        if (isPlainObject(entity.profile_image_presentations)) {
          const slot = profileImageSlotFromExactInput(entity.profile_image_presentations[presentation]);
          entity.profile_image_presentations[presentation] = profileImageSlotFromExactInput({
            ...slot,
            local_image_id: imageId,
            source: imageId ? "shared" : slot.source,
            male
          });
          changed = true;
        }
        if (profileImageMalePresentation(entity) !== male) continue;
        entity.profile_image_id = imageId;
        const replacement = profileStoreImageById(imageId);
        if (replacement) {
          setLocalDefaultProfileImage(entity, imageId, replacement, {
            keepUrl: true,
            save: false
          });
        } else if (isPlainObject(entity.default_profile_image)) {
          entity.default_profile_image = profileImageSlotFromExactInput({
            ...entity.default_profile_image,
            local_image_id: ""
          });
        }
        changed = true;
      }
      return changed;
    };
    const changedCharacterRecords = [];
    for (const record of app.characterDefinitions || []) {
      const character = record.character || record.character_definition;
      let changed = applyToEntity(character);
      for (const presentation of ["male", "non_male"]) {
        const characterId = String(character?.id || record.id || "");
        const key = `${characterId}\u0000${presentation}`;
        if (!selections.has(key)) continue;
        record.active_profile_image_ids ||= {
          male: "",
          non_male: ""
        };
        record.active_profile_image_ids[presentation] = selections.get(key);
        changed = true;
      }
      if (changed) changedCharacterRecords.push(record);
    }
    const visited = new WeakSet();
    const visit = value => {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      applyToEntity(value);
      for (const child of Object.values(value)) visit(child);
    };
    visit(app.state);
    if (changedCharacterRecords.length) saveCharacterLibraryRecordsNow(changedCharacterRecords, "managed profile image replacement selected");
    app.profileImageResolutionEpoch = (Number(app.profileImageResolutionEpoch) || 0) + 1;
    invalidateProfileImageReferenceCache();
    if (app.saveSessionActive) scheduleActiveGameSave();
  }
  async function deleteManagedImageKeys(keys = [], label = "images") {
    const state = managedImagesState();
    if (state.deleting) return;
    const items = [...new Set(keys)].map(key => state.itemsByKey.get(key)).filter(Boolean);
    if (!items.length) return;
    const count = items.length;
    const message = count === 1 ? "Delete this local image permanently?" : `Delete all ${count} local images in ${label} permanently?`;
    if (!(await showConfirm("Delete Images", message, {
      confirmText: "Delete",
      danger: true
    }))) return;
    state.deleting = true;
    updateManagedImageSelectionControls();
    rememberManagedImageOpenGroups();
    state.restoreScrollTop = $("modalBox")?.querySelector?.(".managed-images-browser")?.scrollTop ?? 0;
    try {
      removeManagedImagesFromRuntime(items);
      const result = await app.persistence.deleteManagedImages(items.map(managedImageDeleteReference));
      applyManagedProfileSelectionChanges(result?.profileSelectionChanges || [], items);
      items.forEach(item => state.selectedKeys.delete(managedImageKey(item)));
      await refreshManagedImagesModal();
    } catch (error) {
      state.restoreScrollTop = null;
      showNotice("Delete Images Failed", error?.message || String(error));
    } finally {
      state.deleting = false;
      updateManagedImageSelectionControls();
    }
  }
  function deleteManagedImage(key = "") {
    return deleteManagedImageKeys([String(key || "")], "this image");
  }
  function deleteManagedImageGroup(groupKey = "") {
    const state = managedImagesState();
    const keys = state.groupsByKey.get(String(groupKey || "")) || [];
    return deleteManagedImageKeys(keys, "this group");
  }
  function publicAccountAvatarUrl() {
    const user = supabaseSignedInUser?.();
    const metadata = user?.user_metadata || user?.raw_user_meta_data || {};
    return String(metadata.avatar_url || metadata.picture || metadata.image || user?.avatar_url || "").trim();
  }
  function mainMenuAccountButtonHtml() {
    return "";
  }
  function mainMenuDiagnosticSnapshot(menu = $("mainMenu"), appEl = $("app")) {
    const active = document.activeElement;
    const hovered = menu?.querySelector?.("button:hover");
    const focused = menu?.contains?.(active) ? active : null;
    return {
      open: !!app.mainMenuOpen,
      explicitlyOpened: !!app.mainMenuExplicitlyOpened,
      setupComplete: !!app.state?.meta?.setup_complete,
      onboarding: !!app.onboardingDraft,
      hidden: !!menu?.classList?.contains("hidden"),
      appHidden: !!appEl?.classList?.contains("main-menu-hidden"),
      assetPreloaded: !!app.mainMenuAssetsPreloaded,
      assetsReady: mainMenuAssetsReadyForPaint(),
      assetFailures: app.mainMenuAssetPreloadFailures || 0,
      modalOpen: mainModalOpen(),
      libraryOpen: !!$("modalBox")?.querySelector?.("[data-library-home]"),
      actionCount: menu?.querySelectorAll?.(".main-menu-action")?.length || 0,
      pulsingCount: menu?.querySelectorAll?.(".main-menu-action.pulse-no-saves")?.length || 0,
      hoveredButton: hovered?.textContent?.trim?.().replace(/\s+/g, " ").slice(0, 80) || "",
      focusedButton: focused?.textContent?.trim?.().replace(/\s+/g, " ").slice(0, 80) || "",
      bgMode: ""
    };
  }
  function recordMainMenuRenderDiagnostic(stage = "render", details = {}) {
    const menu = $("mainMenu");
    const appEl = $("app");
    const setupIncomplete = !app.state?.meta?.setup_complete;
    const showMenu = (app.mainMenuOpen || setupIncomplete || void 0) && !app.onboardingDraft;
    if (!showMenu && stage !== "asset-wait") return;
    if (devSmokeSuiteState()?.running || app.activeSmokeScenarioToken) return;
    const now = Date.now();
    app.mainMenuRenderDiagnostics ||= {
      count: 0,
      lastAt: 0,
      recent: [],
      lastLogAt: 0,
      lastStage: ""
    };
    const diag = app.mainMenuRenderDiagnostics;
    const sinceLastMs = diag.lastAt ? now - diag.lastAt : null;
    diag.count += 1;
    diag.lastAt = now;
    diag.recent = [...diag.recent.filter(time => now - time < 3000), now];
    const recentRenderCount3s = diag.recent.length;
    const longIdle = sinceLastMs != null && sinceLastMs > 10 * 60 * 1000;
    const burst = showMenu && recentRenderCount3s >= 12;
    const unusualStage = !["start", "rendered"].includes(stage);
    const shouldLog = longIdle || burst || unusualStage || now - diag.lastLogAt > 10 * 60 * 1000;
    if (!shouldLog) return;
    diag.lastLogAt = now;
    diag.lastStage = stage;
    const stack = new Error().stack?.split("\n").slice(2, 8).map(line => line.trim()).join(" | ") || "";
    log("Main menu render diagnostic", stage, {
      type: "troubleshooting",
      level: "message",
      details: {
        renderCount: diag.count,
        recentRenderCount3s,
        sinceLastMs,
        ...mainMenuDiagnosticSnapshot(menu, appEl),
        ...details,
        stack
      }
    });
  }
  function recordMainMenuCueDiagnostic(eventType = "", button = null) {
    const now = Date.now();
    app.mainMenuCueDiagnostics ||= {
      count: 0,
      lastAt: 0,
      recent: [],
      lastLogAt: 0
    };
    const diag = app.mainMenuCueDiagnostics;
    const sinceLastMs = diag.lastAt ? now - diag.lastAt : null;
    diag.count += 1;
    diag.lastAt = now;
    diag.recent = [...diag.recent.filter(time => now - time < 2000), now];
    const recentCueCount2s = diag.recent.length;
    const burst = recentCueCount2s >= 6;
    const longIdle = sinceLastMs != null && sinceLastMs > 10 * 60 * 1000;
    if (!burst && !longIdle && now - diag.lastLogAt < 10 * 60 * 1000) return;
    diag.lastLogAt = now;
    log("Main menu cue diagnostic", eventType, {
      type: "troubleshooting",
      level: "message",
      details: {
        cueCount: diag.count,
        recentCueCount2s,
        sinceLastMs,
        buttonText: button?.textContent?.trim?.().replace(/\s+/g, " ").slice(0, 80) || "",
        buttonClass: button?.className || "",
        ...mainMenuDiagnosticSnapshot()
      }
    });
  }
  function renderMainMenu() {
    const menu = $("mainMenu");
    const appEl = $("app");
    if (!menu || !appEl) return;
    const setupIncomplete = !app.state?.meta?.setup_complete;
    const onboardingModalMissing = !!app.onboardingDraft && !mainModalOpen();
    const showMenu = (app.mainMenuOpen || setupIncomplete || void 0) && !app.onboardingDraft || onboardingModalMissing;
    recordMainMenuRenderDiagnostic("start", {
      setupIncomplete,
      showMenu,
      backedOut: !!void 0
    });
    appEl.classList.toggle("main-menu-hidden", showMenu);
    menu.classList.toggle("hidden", !showMenu);
    if (onboardingModalMissing && !app.onboardingModalRecoveryQueued) {
      app.onboardingModalRecoveryQueued = true;
      queueMicrotask(() => {
        app.onboardingModalRecoveryQueued = false;
        if (!app.onboardingDraft || mainModalOpen()) return;
        try {
          renderOnboardingStep();
        } catch (error) {
          log("Onboarding modal recovery failed", error?.message || String(error), {
            type: "system",
            level: "error"
          });
        }
      });
    }
    if (!showMenu) return;
    menu.classList.add("main-menu-art");
    if (!app.mainMenuAssetsPreloaded || !mainMenuAssetsReadyForPaint()) {
      app.mainMenuAssetsPreloaded = false;
      recordMainMenuRenderDiagnostic("asset-wait", {
        assetUrls: mainMenuAssetUrls()
      });
      renderMainMenuLoading(menu);
      preloadMainMenuAssets().then(ready => {
        if ($("mainMenu")?.classList.contains("hidden")) return;
        if (ready) renderMainMenu();else setTimeout(renderMainMenu, 1000);
      });
      return;
    }
    if (!app.mainMenuExplicitlyOpened && !app.onboardingDraft) {
      recordMainMenuRenderDiagnostic("auto-library-open");
      app.mainMenuOpen = false;
      menu.classList.add("hidden");
      appEl.classList.remove("main-menu-hidden");
      if (!mainModalOpen() && !app.autoLibraryOpenQueued) {
        app.autoLibraryOpenQueued = true;
        queueMicrotask(() => {
          app.autoLibraryOpenQueued = false;
          if (app.mainMenuExplicitlyOpened || app.onboardingDraft || mainModalOpen()) return;
          try {
            openUnifiedLibrary({
              type: "story",
              tab: "public",
              returnToMainMenuOnEscape: true
            });
          } catch (error) {
            app.mainMenuOpen = true;
            app.mainMenuExplicitlyOpened = true;
            log("Automatic story library open failed", error?.message || String(error), {
              type: "system",
              level: "error"
            });
            renderMainMenu();
          }
        });
      }
      return;
    }
    const latestSave = latestGameSave();
    const canContinueCurrent = activeRuntimeDestinationReady();
    let currentSave = null;
    if (canContinueCurrent) currentSave = findSaveIndexRecord(activeSaveId());
    const button = ({
      title,
      description,
      image,
      onclick = "",
      disabled = false,
      extraClass = ""
    }) => `
                <button
                    type="button"
                    class="main-menu-action ${escapeHtml(extraClass)}"
                    data-main-menu-cue="1"
                    ${onclick && !disabled ? `onclick="${onclick}"` : ""}
                    ${disabled ? "disabled" : ""}
                >
                    <img src="${menuAssetUrl(image)}" alt="" aria-hidden="true">
                    <span class="main-menu-action-text">
                        <strong class="main-menu-action-title">${escapeHtml(title)}</strong>
                        <span class="main-menu-action-description">${escapeHtml(description)}</span>
                    </span>
                </button>
            `;
    menu.innerHTML = `
                <img class="main-menu-bg" src="${menuAssetUrl(mainMenuBackgroundAsset())}" alt="" aria-hidden="true">
                <div class="main-menu-bg-shade" aria-hidden="true"></div>
                ${mainMenuAccountButtonHtml()}
                <div class="main-menu-shell">
                    <section class="main-menu-content-scroll" aria-label="Main menu">
                        <div class="main-menu-content">
                            <img class="main-menu-logo" src="${menuAssetUrl(MAIN_MENU_LOGO_ASSET)}" alt="" aria-hidden="true">
                            <div class="main-menu-actions">
                                ${button({
      title: "Continue Adventure",
      description: canContinueCurrent ? "Continue the current game." : latestSave ? "Continue the last game played." : "No saved games yet.",
      image: "CompassButton.png",
      onclick: canContinueCurrent ? "EmberAdventures.closeMainMenuToGame()" : latestSave ? `EmberAdventures.restoreGameSave(${htmlJsArg(latestSave.saveId)}, {skipRestoreConfirm:true})` : "",
      disabled: !canContinueCurrent && !latestSave
    })}
                                ${button({
      title: "Begin New Adventure",
      description: "Start a new game.",
      image: "OpenGatesButton.png",
      onclick: "EmberAdventures.openWorldModal({skipConfirm:true})",
      extraClass: latestSave ? "" : "pulse-no-saves"
    })}
                                ${button({
      title: "Load Adventure",
      description: latestSave ? "Load a saved game." : "No saved games yet.",
      image: "JournalButton.png",
      onclick: "EmberAdventures.openGameSavesModal({allowDeleteCurrent:true})",
      disabled: !latestSave
    })}
                                ${button({
      title: "Story Library",
      description: "Choose, edit, import, or export stories.",
      image: "OpenBookButton.png",
      onclick: "EmberAdventures.openStoryTemplateLibrary({skipBack:true})"
    })}
                                ${button({
      title: "Character Library",
      description: "View, import, export, or manage characters.",
      image: "HoodedFigureButton.png",
      onclick: "EmberAdventures.openCharacterLibraryModal({fromMainMenu:true})"
    })}
                            </div>
                        </div>
                    </section>
                    <footer class="main-menu-bottom-wrap" aria-label="Main menu tools">
                        <div class="main-menu-bottom-bar">
                            <img src="${menuAssetUrl("BottomButtons2.png")}" alt="" aria-hidden="true">
                            <button type="button" class="main-menu-bottom-hit settings" data-main-menu-cue="1" aria-label="Settings" onclick="EmberAdventures.openSettingsModal()"></button>
                            <button type="button" class="main-menu-bottom-hit tools" data-main-menu-cue="1" aria-label="Tools" onclick="EmberAdventures.openMainMenuDataToolsModal()"></button>
                            <button type="button" class="main-menu-bottom-hit notes" data-main-menu-cue="1" aria-label="Version Notes" onclick="EmberAdventures.openBetaNotesModal()"></button>
                            <button type="button" class="main-menu-bottom-hit discord discord-button" data-main-menu-cue="1" aria-label="Discord" onclick="EmberAdventures.openDiscord()"></button>
                        </div>
                    </footer>
                </div>
            `;
    bindMainMenuHoverCues(menu);
    recordMainMenuRenderDiagnostic("rendered", {
      latestSaveId: latestSave?.saveId || "",
      currentSaveId: currentSave?.saveId || ""
    });
    if (EMBERADVENTURES_DEBUG_ALL_LOGS && EMBERADVENTURES_DEBUG_TEST_SCENARIO && app.mainMenuDebugScenarioRunId !== EMBERADVENTURES_DEBUG_TEST_RUN_ID) {
      app.mainMenuDebugScenarioRunId = EMBERADVENTURES_DEBUG_TEST_RUN_ID;
      app.liveTestStartedScenario = "";
      app.liveTestStartedRunId = "";
      setTimeout(() => {
        devRunLiveTestScenario();
      }, 50);
    }
  }
  function refreshMainMenuIfVisible() {
    if (!$("mainMenu")?.classList.contains("hidden")) renderMainMenu();
  }
  function maybeShowWorldGenerationRecoveryNotice() {
    if (EMBERADVENTURES_DEBUG_ALL_LOGS && EMBERADVENTURES_DEBUG_TEST_SCENARIO) {
      app.worldGenerationCheckpoint = null;
      clearWorldGenerationCheckpoint().catch(err => log("Debug checkpoint cleanup failed", err.message || err, {
        type: "system",
        level: "error"
      }));
      return false;
    }
    const checkpoint = exactWorldGenerationCheckpoint(app.worldGenerationCheckpoint);
    if (!checkpoint || activeWorldGenerationJob()) return false;
    const popup = openPopupModal(`
                <h2>Resume Story Generation?</h2>
                <p class="hint">A partial story-generation draft was saved: ${escapeHtml(worldGenerationCheckpointLabel(checkpoint))}</p>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" id="startupResumeWorldGenBtn">Resume</button>
                    <button id="startupExportWorldGenBtn">Export Partial</button>
                    <button class="danger" id="startupDiscardWorldGenBtn">Discard</button>
                    <button id="startupSkipWorldGenBtn">Later</button>
                </div>
            `);
    popup.box.querySelector("#startupResumeWorldGenBtn").onclick = () => {
      popup.close();
      resumeWorldGenerationCheckpoint();
    };
    popup.box.querySelector("#startupExportWorldGenBtn").onclick = () => {
      exportWorldGenerationCheckpoint();
    };
    popup.box.querySelector("#startupDiscardWorldGenBtn").onclick = async () => {
      popup.close();
      await discardWorldGenerationCheckpoint();
      if (!app.state.meta.setup_complete) openWorldModal({
        skipConfirm: true
      });else showPlayerInputHelpOnce();
    };
    popup.box.querySelector("#startupSkipWorldGenBtn").onclick = () => {
      popup.close();
      if (!app.state.meta.setup_complete) openWorldModal({
        skipConfirm: true
      });else showPlayerInputHelpOnce();
    };
    return true;
  }
  function startupBlankAssistantMessage() {
    if (app.startupBlankReplyRepairStarted) return null;
    if (!Array.isArray(app.messages) || !app.messages.length) return null;
    const lastStoryMessage = [...app.messages].reverse().find(message => isStoryMessageRole(message.role));
    if (lastStoryMessage?.role === "assistant" && !String(lastStoryMessage.text || "").trim()) return lastStoryMessage;
    return null;
  }
  function startupBlankReplyRepairNeedsManualProvider() {
    return currentLaunchTextProvider() === "local-codex" || app.settings?.textProvider === "local-codex";
  }
  function removeStartupBlankAssistantMessage(message, title, detail) {
    if (!message || message.role !== "assistant") return false;
    if (String(message.text || "").trim()) return false;
    const beforeCount = app.messages.length;
    app.messages = app.messages.filter(item => item.id !== message.id);
    if (app.messages.length === beforeCount) return false;
    clearTimeout(app.startupBlankReplyRepairTimer);
    app.startupBlankReplyRepairTimer = null;
    setStatus("Ready");
    setTurnStage("idle", "Ready");
    scheduleActiveGameSave();
    if (!app.startupBlankReplyRepairNoticeShown) {
      app.startupBlankReplyRepairNoticeShown = true;
      showNotice(title, detail);
    }
    render();
    return true;
  }
  function scheduleStartupBlankAssistantMessageRepair(message) {
    if (!message || app.startupBlankReplyRepairStarted) return;
    clearTimeout(app.startupBlankReplyRepairTimer);
    app.startupBlankReplyRepairTimer = setTimeout(() => {
      app.startupBlankReplyRepairTimer = null;
      const current = findMessageById(message.id);
      if (!current || current.role !== "assistant" || String(current.text || "").trim()) {
        continueStartupFlow();
        return;
      }
      if (app.busy || app.aiActive || app.aiQueue.length || app.stateSync?.running) {
        scheduleStartupBlankAssistantMessageRepair(current);
        return;
      }
      repairStartupBlankAssistantMessage(current);
    }, 8000);
    setStatus("Blank reply found; repair queued...");
    setTurnStage("idle", "Blank reply found; repair queued...");
    render();
  }
  async function repairStartupBlankAssistantMessage(message) {
    if (!message || app.startupBlankReplyRepairStarted) return;
    app.startupBlankReplyRepairStarted = true;
    setStatus("Regenerating blank reply...");
    setTurnStage("reply", "Regenerating blank reply...");
    render();
    try {
      await regenerateAssistantMessage(message.id, "", {
        reason: "startup blank reply repair",
        statusText: "Regenerating blank reply...",
        noBackupTitle: "Cannot Repair Blank Reply",
        noBackupMessage: "The last assistant message is blank, but it was already included in state and EmberAdventures no longer has the pre-message state backup needed to regenerate it safely."
      });
    } catch (err) {
      if (isAiCancelledError(err)) {
        setStatus("Ready");
        return;
      }
      const target = findMessageById(message.id);
      if (target) removeStartupBlankAssistantMessage(target, "Reply Repair Failed", err.message || String(err));
      setStatus("Error");
      scheduleActiveGameSave();
    } finally {
      render();
      if (app.turnStage !== "error") {
        setTurnStage("idle", "Ready");
        continueStartupFlow();
      }
    }
  }
  function openBetaNotesModal(options = {}) {
    app.modalCloseCallback = typeof options.afterClose === "function" ? options.afterClose : null;
    openModal("", {
      title: "Alpha Notes",
      setupBlackout: true
    });
    const box = $("modalBox");
    const intro = document.createElement("p");
    intro.className = "hint";
    intro.textContent = "EmberAdventures is an early public Alpha. Features are still being developed, and you may encounter bugs or unfinished systems.";
    box.appendChild(intro);
    const notes = [["Getting started", "Open the Character Library and scroll through to find a character you want to chat with. Some characters have guided stories, while others only have opening messages. You can also customize the opening message to whatever you want."], ["Creating characters and stories", "The currently supported workflow is to use ChatGPT or Codex to create character and story files, then import them into the game. The in-game character and story editors are not finished."], ["Public Library", "You can browse and download public characters, and sign in to publish your own characters. Public story publishing is coming soon."], ["Keep backups", "Your local library and saves are stored in this browser. Signing in does not turn them into cloud backups. Export copies of anything you want to keep, especially before clearing browser data or switching browsers or devices. Alpha updates may change save compatibility."], ["AI can make mistakes", "Generated narration, character behavior, and images may contain mistakes or inconsistencies. Use the available editing or retry controls when a result needs correcting."], ["Voice compatibility varies", "Available voices depend on your browser and operating system, so voice options and playback may differ between devices."], ["Map is an early preview", "The map provides navigation context and is still under development."], ["Reporting problems", "Use the game's issue-reporting tools for bugs, and include what you were doing and any available error details. Use the Public Library's report action for problems with a published item."]];
    const stack = document.createElement("div");
    stack.className = "stack";
    for (const [title, text] of notes) {
      const card = document.createElement("div");
      card.className = "stat-card";
      const heading = document.createElement("div");
      heading.className = "character-name";
      heading.textContent = title;
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      card.append(heading, paragraph);
      stack.appendChild(card);
    }
    box.appendChild(stack);
    const actions = document.createElement("div");
    actions.className = "row";
    actions.style.marginTop = ".8rem";
    const privacy = document.createElement("button");
    privacy.type = "button";
    privacy.textContent = "Public Features Privacy";
    privacy.onclick = () => openPublicPrivacyNotice();
    const close = document.createElement("button");
    close.type = "button";
    close.className = "primary";
    close.textContent = "OK";
    close.onclick = () => closeModal();
    actions.append(privacy, close);
    box.appendChild(actions);
  }
  function showPlayerInputHelpOnce(readMessageId = "", options = {}) {
    const force = !!options.force;
    if (app.settings.playerInputHelpSeen && !force) return false;
    app.settings.playerInputHelpSeen = true;
    app.pendingPlayerInputHelpReadMessageId = readMessageId || "";
    if (options.save !== false) scheduleActiveGameSave();
    app.modalCloseCallback = typeof options.afterClose === "function" ? options.afterClose : null;
    const example = `"I'll check the door." I move closer and listen for movement inside.`;
    openModal(`
                <h2>How to Play</h2>
                <p class="hint">You can speak using double quotes, or type outside the quotes to say what your player does next.</p>
                <div class="stat-card">
                    <strong>Example</strong>
                    <div class="bubble" style="margin-top:.45rem">${formatMessage(example)}</div>
                    <p class="hint"><span class="story-dialogue">"I'll check the door."</span> is treated as you speaking.</p>
                    <p class="hint"><span class="story-action">I move closer and listen for movement inside.</span> is treated as actions, thoughts, or scene context.</p>
                </div>
                <p class="hint">Use Continue when you want to observe the scene without acting.</p>
                <p class="hint">Toggle Auto when you want the AI to take turns for you. You can turn it off whenever you want to take control again.</p>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.closePlayerInputHelp(${htmlJsArg(readMessageId || "")})">Start Playing</button>
                </div>
            `);
    return true;
  }
  function closePlayerInputHelp(readMessageId = null) {
    const messageId = readMessageId == null ? app.pendingPlayerInputHelpReadMessageId || "" : textSlot(readMessageId, "");
    app.pendingPlayerInputHelpReadMessageId = "";
    closeModal();
    if (messageId && app.settings.autoVoice) readMessage(messageId, {
      sequence: false
    });
  }
  function clearUnfinishedSetupSampleState() {
    if (app.state?.meta?.setup_complete) return;
    app.state.characters = {};
    app.state.npc_directory = {
      locations: {}
    };
    app.state.scene ||= {};
    app.state.scene.party_members_present = [];
    app.state.scene.image_characters = [];
    replaceSceneNpcPresence(app.state, [], "story shop opened");
    app.state.objectives = {
      active_id: "",
      items: []
    };
    app.state.objectives.focus_id = "";
    app.state.story_memory = clone(defaultState.story_memory);
    if (app.state.player && app.state.player.gender === "unspecified") app.state.player.gender = "";
    app.messages = [];
    app.images = [];
  }
  function bind() {
    $("sendBtn").onclick = () => window.EmberAdventures.sendUserMessage();
    if ($("continueBtn")) $("continueBtn").onclick = () => window.EmberAdventures.continueScene();
    if ($("voicePauseBtn")) $("voicePauseBtn").onclick = toggleVoicePause;
    $("input").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        window.EmberAdventures.sendUserMessage();
      }
    });
    $("input").addEventListener("input", resizeComposerInput);
    window.addEventListener("resize", resizeComposerInput);
    resizeComposerInput();
    if ($("imageBtn")) $("imageBtn").onclick = () => window.EmberAdventures.requestManualImage();
    $("imageLabBtn").onclick = openImageLabModal;
    $("imageViewerBtn").onclick = openImageViewerModal;
    if ($("stopToyBtn")) $("stopToyBtn").onclick = false;
    if ($("betaNotesBtn")) $("betaNotesBtn").onclick = () => openBetaNotesModal();
    if ($("mainMenuBtn")) $("mainMenuBtn").onclick = () => window.EmberAdventures.openMainMenu();
    if ($("mobileLeftDrawerBtn")) $("mobileLeftDrawerBtn").onclick = () => openMobileDrawer("left");
    if ($("mobileRightDrawerBtn")) $("mobileRightDrawerBtn").onclick = () => openMobileDrawer("right");
    $("shopsBtn").onclick = openStoryShopsModal;
    $("mapBtn").onclick = openMapModal;
    $("stateBtn").onclick = openStateModal;
    $("charactersBtn").onclick = () => openCharactersModal();
    $("guideBtn").onclick = openGuideModal;
    if ($("promptBtn")) $("promptBtn").onclick = openPromptModal;
    if ($("newThreadBtn")) $("newThreadBtn").onclick = () => window.EmberAdventures.newThread();
    $("settingsBtn").onclick = openSettingsModal;
    if ($("exportBtn")) $("exportBtn").onclick = () => window.EmberAdventures.exportData();
    if ($("importBtn")) $("importBtn").onclick = () => window.EmberAdventures.importData();
    if ($("savedGamesToolBtn")) $("savedGamesToolBtn").onclick = openGameSavesModal;
    window.addEventListener("beforeunload", () => {
      flushScheduledSaveAllIfPossible("saved before page unload");
      flushCurrentGameAutosaveIfPossible("autosaved before page unload");
      flushLargeSaves();
    });
    window.addEventListener("pagehide", () => {
      flushScheduledSaveAllIfPossible("saved before page hide");
      flushCurrentGameAutosaveIfPossible("autosaved before page hide");
      flushLargeSaves();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushScheduledSaveAllIfPossible("saved before page hidden");
        flushCurrentGameAutosaveIfPossible("autosaved before page hidden");
        flushLargeSaves();
      }
    });
    bindToolMenuDismissal();
    bindAdaptiveTopToolbar();
    bindMobileDrawerControls();
    $("imageModelSelect").onchange = () => {
      app.settings.imageModel = $("imageModelSelect").value;
      saveSettingsNow("image art style changed");
      log("Image art style selected", imageModelOptions().find(model => model.value === app.settings.imageModel)?.label || app.settings.imageModel, {
        type: "image",
        level: "message"
      });
    };
    $("modal").onclick = () => {};
    document.addEventListener("keydown", event => {
      if (closeSimpleNoticePopupFromKey(event)) return;
      if (event.key !== "Escape") return;
      if (closeTopmostPopupFromEscape(event)) return;
      const openToolMenus = [...document.querySelectorAll(".tool-menu[open]")];
      if (openToolMenus.length) {
        event.preventDefault();
        openToolMenus.at(-1).removeAttribute("open");
        return;
      }
      if (!$("modal")?.classList.contains("open")) return;
      if (app.onboardingDraft) return;
      if ($("modalBox")?.querySelector?.("[data-library-return-to-main-menu='1']")) {
        event.preventDefault();
        openMainMenu();
        return;
      }
      closeModal();
    });
  }
  function closeToolMenu() {
    document.querySelectorAll(".tool-menu[open]").forEach(menu => menu.removeAttribute("open"));
  }
  function bindToolMenuDismissal() {
    const menu = document.querySelector(".tool-menu");
    if (!menu || menu.dataset.dismissBound === "1") return;
    menu.dataset.dismissBound = "1";
    document.addEventListener("pointerdown", event => {
      if (!menu.open) return;
      if (menu.contains(event.target)) return;
      closeToolMenu();
    });
    menu.addEventListener("click", event => {
      if (!event.target?.closest?.(".tool-menu-panel button")) return;
      setTimeout(closeToolMenu, 0);
    });
  }
  function bindAdaptiveTopToolbar() {
    if (root.__emberAdventuresAdaptiveTopToolbarBound) return;
    root.__emberAdventuresAdaptiveTopToolbarBound = true;
    window.addEventListener("resize", () => updateTopToolbarVisibility());
    requestAnimationFrame(updateTopToolbarVisibility);
  }
  function bindMobileDrawerControls() {
    if (root.__emberAdventuresMobileDrawerControlsBound) return;
    root.__emberAdventuresMobileDrawerControlsBound = true;
    // TODO: Mobile drawer swipe controls are intentionally left in place,
    // but they still did not work in manual testing on an Android phone.
    // The side-tab buttons work; revisit this with real-device debugging.
    let swipeStart = null;
    let swipeHandled = false;
    const recordSwipeStart = (event, point) => {
      if (!drawerLayoutActive()) return;
      if (!point) return;
      swipeStart = {
        x: point.clientX,
        y: point.clientY,
        at: Date.now()
      };
      swipeHandled = false;
    };
    const finishSwipe = (point, allowEarly = false) => {
      if (!swipeStart || swipeHandled || !drawerLayoutActive()) return false;
      const start = swipeStart;
      if (!point) return;
      const dx = point.clientX - start.x;
      const dy = point.clientY - start.y;
      if (Date.now() - start.at > 900) {
        swipeStart = null;
        return false;
      }
      const threshold = allowEarly ? 86 : 64;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.25) return false;
      swipeHandled = true;
      swipeStart = null;
      handleMobileDrawerSwipe(dx > 0 ? "right" : "left");
      return true;
    };
    const recordSwipeMove = point => {
      finishSwipe(point, true);
    };
    const recordSwipeEnd = point => {
      finishSwipe(point, false);
      swipeStart = null;
    };
    const cancelSwipe = () => {
      swipeStart = null;
      swipeHandled = false;
    };
    window.addEventListener("resize", () => {
      updateMobileDrawerTop();
      if (!drawerLayoutActive() || app.mobileDrawer === "left" && !mobileLayoutActive() || app.mobileDrawer === "right" && !rightDrawerLayoutActive()) closeMobileDrawer();else updateMobileDrawerState();
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !app.mobileDrawer) return;
      closeMobileDrawer();
    });
    document.addEventListener("touchstart", event => {
      recordSwipeStart(event, event.touches?.[0]);
    }, {
      passive: true
    });
    document.addEventListener("touchend", event => {
      recordSwipeEnd(event.changedTouches?.[0]);
    }, {
      passive: true
    });
    document.addEventListener("touchmove", event => {
      recordSwipeMove(event.touches?.[0]);
    }, {
      passive: true
    });
    document.addEventListener("touchcancel", cancelSwipe, {
      passive: true
    });
    document.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") return;
      recordSwipeStart(event, event);
    }, {
      passive: true
    });
    document.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse") return;
      recordSwipeMove(event);
    }, {
      passive: true
    });
    document.addEventListener("pointerup", event => {
      if (event.pointerType === "mouse") return;
      recordSwipeEnd(event);
    }, {
      passive: true
    });
    document.addEventListener("pointercancel", event => {
      if (event.pointerType === "mouse") return;
      cancelSwipe();
    }, {
      passive: true
    });
    requestAnimationFrame(updateMobileDrawerState);
  }
  function mobileLayoutActive() {
    const matchMedia = app.devMatchMediaOverride || root.matchMedia;
    return !!matchMedia?.("(max-width: 1020px)")?.matches;
  }
  function rightDrawerLayoutActive() {
    const matchMedia = app.devMatchMediaOverride || root.matchMedia;
    return !!matchMedia?.("(max-width: 1280px)")?.matches;
  }
  function drawerLayoutActive() {
    return mobileLayoutActive() || rightDrawerLayoutActive();
  }
  function updateMobileDrawerTop() {
    const appEl = $("app");
    const topbar = document.querySelector(".topbar");
    if (!appEl || !topbar) return;
    appEl.style.setProperty("--mobile-drawer-top", `${Math.ceil(topbar.getBoundingClientRect().height)}px`);
  }
  function updateMobileDrawerState() {
    updateMobileDrawerTop();
    const appEl = $("app");
    if (!appEl) return;
    const drawer = app.mobileDrawer === "right" ? "right" : app.mobileDrawer === "left" ? "left" : "";
    app.mobileDrawer = drawer;
    appEl.classList.toggle("mobile-left-drawer-open", drawer === "left");
    appEl.classList.toggle("mobile-right-drawer-open", drawer === "right");
    $("mobileLeftDrawerBtn")?.classList.toggle("primary", drawer === "left");
    $("mobileRightDrawerBtn")?.classList.toggle("primary", drawer === "right");
  }
  function openMobileDrawer(side) {
    const requested = side === "right" ? "right" : "left";
    if (app.mobileDrawer === requested) app.mobileDrawer = "";else app.mobileDrawer = requested;
    updateMobileDrawerState();
  }
  function showMobileDrawer(side) {
    const requested = side === "right" ? "right" : side === "left" ? "left" : "";
    if (requested === "left" && !mobileLayoutActive() || requested === "right" && !rightDrawerLayoutActive()) return;
    app.mobileDrawer = requested;
    updateMobileDrawerState();
  }
  function handleMobileDrawerSwipe(direction) {
    if (!drawerLayoutActive()) return;
    const swipe = direction === "right" ? "right" : "left";
    if (swipe === "left") {
      if (app.mobileDrawer === "left") closeMobileDrawer();else if (!app.mobileDrawer) showMobileDrawer("right");else updateMobileDrawerState();
      return;
    }
    if (app.mobileDrawer === "right") closeMobileDrawer();else if (!app.mobileDrawer) showMobileDrawer("left");else updateMobileDrawerState();
  }
  function closeMobileDrawer() {
    if (!app.mobileDrawer && !$("app")?.classList.contains("mobile-left-drawer-open") && !$("app")?.classList.contains("mobile-right-drawer-open")) {
      updateMobileDrawerTop();
      return;
    }
    app.mobileDrawer = "";
    updateMobileDrawerState();
  }
  function updateTopToolbarVisibility() {
    const topbar = document.querySelector(".topbar");
    const actions = document.querySelector(".top-actions");
    if (!topbar || !actions) return;
    const candidates = [...actions.querySelectorAll("[data-top-priority]")];
    if (!candidates.length) return;
    candidates.forEach(button => button.classList.remove("top-overflow-hidden"));
    const overflowAmount = () => Math.ceil(topbar.scrollWidth - topbar.clientWidth);
    if (overflowAmount() <= 0) return;
    const hideOrder = [...candidates].sort((a, b) => Number(b.dataset.topPriority || 0) - Number(a.dataset.topPriority || 0));
    for (const button of hideOrder) {
      if (overflowAmount() <= 0) break;
      button.classList.add("top-overflow-hidden");
    }
  }
  function addMessage(role, text, speaker = "", extra = {}) {
    // Message ownership is assigned when the message is created. Normal
    // saves verify this and fail loudly on mismatch; they do not repair it.
    text = sanitizeDisplayMessageText(role, text);
    if (Object.hasOwn(extra, "entryId")) throw new Error("addMessage accepts id, not the obsolete entryId input alias.");
    const entryId = nextEntryId();
    const id = extra.id ?? entryId;
    const ownerSaveId = extra.saveId ?? activeSaveId() ?? "";
    const message = {
      id,
      entryId,
      role,
      speaker,
      text,
      detail: extra.detail ?? "normal",
      stateSyncStatus: extra.stateSyncStatus || (isStoryMessageRole(role) ? "pending" : ""),
      at: new Date().toISOString(),
      ...(ownerSaveId ? {
        saveId: ownerSaveId
      } : {}),
      ...extra
    };
    const validation = validateRuntimeMessageStorage([message]);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    app.messages.push(message);
    (app.messageIndex || rebuildMessageIndex()).set(String(id), message);
    touchMessageRevision(message);
    markRuntimeCollectionDirty("messages", String(id), "put");
    scheduleActiveGameSave();
    return message;
  }
  function isStoryMessageRole(role) {
    return role === "user" || role === "assistant";
  }
  function addGameMessage(text, speaker = "Game", extra = {}) {
    const message = addMessage("game", text, speaker, {
      stateSyncStatus: "",
      ...extra
    });
    render();
    if (extra.autoRead !== false && app.settings.readGameMessages !== false && app.settings.autoVoice && !voiceIsPaused()) readMessage(message.id, {
      appendIfBusy: true,
      sequence: false
    });
    return message;
  }
  function choiceRollbackSnapshotForMessage(message = {}) {
    if (!message?.choiceSnapshotId) return null;
    return snapshotById(message.choiceSnapshotId);
  }
  function directObjectiveChoiceRollbackButton(message = {}) {
    if (!choiceRollbackSnapshotForMessage(message)) return "";
    return `<button class="message-action blue" title="Choose differently" onclick="EmberAdventures.restoreDirectObjectiveChoiceFromMessage(${htmlJsArg(message.id)})">&#9998;</button>`;
  }
  async function restoreDirectObjectiveChoiceFromMessage(messageId) {
    const message = findEntryById(messageId);
    const snapshot = choiceRollbackSnapshotForMessage(message);
    if (!snapshot) {
      await showNotice("Choice Backup Missing", "EmberAdventures no longer has the state backup from before this choice, so it cannot safely roll back to choose differently.");
      return false;
    }
    cancelAllGameProcesses("direct objective choice rollback");
    if (app.saveSessionActive) {
      await flushRuntimeSaveProjections();
      await app.persistence.rollbackSnapshot(String(snapshot.id || snapshot.snapshotId || ""));
      await loadSaveIntoRuntime(activeSaveId(), {
        scrollChatToBottom: false
      });
      app.directObjectiveChoiceAutoOpenKey = "";
      render();
      if (directObjectiveChoiceIsWaiting(app.state)) openDirectObjectiveChoiceModal();
      return true;
    }
    restoreRuntimeSnapshotForMessageRollback(snapshot);
    pruneSnapshotsAfter(snapshot);
    app.directObjectiveChoiceAutoOpenKey = "";
    scheduleActiveGameSave();
    render();
    if (directObjectiveChoiceIsWaiting(app.state)) openDirectObjectiveChoiceModal();
    return true;
  }
  function displayMessageSpeaker(message = {}) {
    if (message.role === "assistant" && Array.isArray(message.voiceSpeakers) && message.voiceSpeakers.length) {
      return message.voiceSpeakers.map(name => currentPresentationName(name, app.state)).join(", ");
    }
    const speaker = message.speaker || (message.role === "command" ? "AI Command" : message.role === "game" ? "Game" : "");
    return currentPresentationName(speaker, app.state);
  }
  function troubleshootingLog(title, detail = {}) {
    if (!logSettingEnabled("troubleshooting") && !smokeDevTraceCaptureActive()) return null;
    const source = typeof detail === "function" ? detail() : detail;
    return log(`Troubleshoot ${title}`, () => compactJson(Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key, traceValue(value)]))), {
      type: "troubleshooting",
      level: "message"
    });
  }
  function troubleshootingWarning(title, detail = {}) {
    if (!logSettingEnabled("troubleshooting") && !smokeDevTraceCaptureActive()) return null;
    const source = typeof detail === "function" ? detail() : detail;
    return log(`Troubleshoot ${title}`, () => compactJson(Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [key, traceValue(value)]))), {
      type: "troubleshooting",
      level: "warning"
    });
  }
  function removeMessageById(id) {
    const key = String(id);
    const before = app.messages.length;
    app.messages = app.messages.filter(message => String(message.id) !== key);
    app.messageIndex?.delete(key);
    app.voiceTokenCache?.delete(key);
    if (app.messages.length !== before) {
      touchMessageRevision();
      markRuntimeCollectionDirty("messages", key, "delete");
      scheduleActiveGameSave();
    }
  }
  function updateMessageTextDom(message, options = {}) {
    const article = document.querySelector(`#thread [data-message-id="${cssEscape(String(message?.id || ""))}"]`);
    const content = article?.querySelector?.(".message-content") || article?.querySelector?.(".bubble");
    if (!article || !content || !message) return false;
    if (options.streaming) {
      let streamNode = content.querySelector?.(".message-stream-text");
      if (!streamNode) {
        content.replaceChildren();
        streamNode = document.createElement("span");
        streamNode.className = "message-stream-text";
        content.append(streamNode);
      }
      streamNode.textContent = displayRuntimeTemplateText(message.text);
    } else {
      content.innerHTML = formatMessageWithVoiceHighlight(message);
      content.querySelectorAll?.("img").forEach(img => {
        img.loading = "lazy";
        img.decoding = "async";
      });
      app.voiceTokenCache?.delete(String(message.id));
    }
    const speaker = article.querySelector(".message-topline > span:first-child");
    if (speaker) speaker.textContent = displayMessageSpeaker(message);
    syncMessageGenerationActions(message.id);
    return true;
  }
  function syncMessageGenerationActions(messageId) {
    const article = document.querySelector(`#thread [data-message-id="${cssEscape(String(messageId || ""))}"]`);
    const actions = article?.querySelector?.(".message-actions");
    if (!actions) return;
    const currentlyGenerating = messageIsGenerating(messageId);
    const activelyGenerating = messageIsActivelyGenerating(messageId);
    let stopButton = actions.querySelector("[data-stop-generating-message]");
    if (activelyGenerating && !stopButton) {
      stopButton = document.createElement("button");
      stopButton.type = "button";
      stopButton.className = "message-action danger";
      stopButton.title = "Stop generating and keep the text already received";
      stopButton.setAttribute("data-stop-generating-message", "1");
      stopButton.innerHTML = "&#9632;";
      stopButton.onclick = () => stopGeneratingMessage(messageId);
      actions.prepend(stopButton);
    } else if (!activelyGenerating) {
      stopButton?.remove();
    }
    actions.querySelectorAll("[data-message-mutation-action]").forEach(button => button.classList.toggle("hidden", currentlyGenerating));
  }
  function updateMessage(id, text, options = {}) {
    const message = findMessageById(id);
    if (!message) return null;
    message.text = sanitizeDisplayMessageText(message.role, text);
    message.at = message.at || new Date().toISOString();
    touchMessageRevision(message);
    if (options.save !== false) {
      markRuntimeCollectionDirty("messages", String(message.id), "put");
      scheduleActiveGameSave();
    }
    const renderMode = options.render || "thread";
    if (renderMode === "message" && updateMessageTextDom(message, {
      streaming: options.streaming === true
    })) {
      if (options.hud === true) requestRenderRegions({
        hud: true
      }, options.reason || "message text updated");
    } else if (renderMode !== "none") {
      requestRenderRegions({
        thread: true,
        hud: options.hud === true
      }, options.reason || "message text updated");
    }
    return message;
  }
  function queueStreamingMessageUpdate(messageId, rawText, options = {}) {
    app.performanceMetrics.streamChunkCount = Number(app.performanceMetrics.streamChunkCount || 0) + 1;
    const key = String(messageId || "");
    if (!key) return;
    const pending = app.streamingMessageUpdates || (app.streamingMessageUpdates = new Map());
    const current = pending.get(key) || {
      timer: 0,
      rawText: "",
      options: {}
    };
    current.rawText = String(rawText || "");
    current.options = {
      ...current.options,
      ...options
    };
    pending.set(key, current);
    const flush = () => {
      current.timer = 0;
      if (pending.get(key) !== current) return;
      pending.delete(key);
      const message = findMessageById(key);
      if (!message || app.cancelledAiMessageIds.has(key)) return;
      let visible = current.options.resetText ?? "";
      if (!current.options.reset) {
        visible = sanitizeDisplayMessageText("assistant", incrementalStreamingVisibleText(current, current.rawText, app.currentReplyMode === "auto"));
      }
      delete message.hiddenWhileRegenerating;
      app.performanceMetrics.streamRenderCount = Number(app.performanceMetrics.streamRenderCount || 0) + 1;
      updateMessage(key, visible, {
        render: "message",
        streaming: true,
        save: false
      });
    };
    if (options.done || options.reset) {
      if (current.timer) clearTimeout(current.timer);
      flush();
      return;
    }
    if (!current.timer) current.timer = setTimeout(flush, 50);
  }
  function flushStreamingMessageUpdate(messageId) {
    const key = String(messageId || "");
    const current = app.streamingMessageUpdates?.get(key);
    if (!current) return false;
    if (current.timer) clearTimeout(current.timer);
    current.timer = 0;
    app.streamingMessageUpdates.delete(key);
    return true;
  }
  function sanitizeDisplayMessageText(role, text) {
    const value = String(text || "");
    return role === "assistant" ? assistantVisibleMessageText(value) : value;
  }
  function resolveRuntimeMessageTemplateText(text = "", state = app.state, options = {}) {
    if (!String(text || "").includes("|[")) return String(text || "");
    const playerName = textSlot(state?.player?.name, "Player") || "Player";
    return materializeRuntimeConditionalText(text).replace(runtimeMessageTemplateSimplePattern, (match, key) => {
      const requested = String(key || "").trim();
      if (!requested) return match;
      const explicitCharacter = runtimeMessageTemplateCharacterToken(requested);
      if (explicitCharacter) {
        if (explicitCharacter.self) {
          const entity = options.selfCharacter;
          if (!entity) return "[missing self character]";
          if (explicitCharacter.kind === "name" || explicitCharacter.kind === "first") {
            const name = textSlot(entity.name, "");
            return explicitCharacter.kind === "first" ? firstRuntimeName(name) : name;
          }
          return runtimeMessageTemplateGenderedValue(entity.gender, explicitCharacter.kind, explicitCharacter.capitalized);
        }
        const characterId = explicitCharacter.characterId;
        const entity = runtimeMessageTemplateEntity(characterId, state);
        if (explicitCharacter.kind === "name" || explicitCharacter.kind === "first") {
          const resolved = runtimeMessageTemplateEntityName(characterId, state, {
            firstName: explicitCharacter.kind === "first"
          });
          return resolved || `[missing character: ${characterId || "unknown"}]`;
        }
        if (!entity) return `[missing character: ${characterId || "unknown"}]`;
        return runtimeMessageTemplateGenderedValue(entity.gender, explicitCharacter.kind, explicitCharacter.capitalized);
      }
      const normalized = requested.toLowerCase().replace(/[_\s]+/g, "-");
      const playerTokenKind = runtimeMessageTemplatePlayerTokenKind(normalized);
      if (playerTokenKind === "name") return playerName;
      if (playerTokenKind === "first") return firstRuntimeName(playerName);
      if (playerTokenKind) {
        return runtimeMessageTemplateGenderedValue(state?.player?.gender, playerTokenKind, /-cap$/.test(normalized));
      }
      return `[unknown reference: ${requested}]`;
    });
  }
  
