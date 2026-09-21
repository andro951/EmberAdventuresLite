function rebuildMessageIndex() {
    const index = new Map();
    for (const message of Array.isArray(app.messages) ? app.messages : []) {
      if (!message || message.id == null) continue;
      index.set(String(message.id), message);
    }
    app.messageIndex = index;
    app.messageIndexSource = app.messages;
    return index;
  }
  function touchMessageRevision(message = null) {
    app.messageListRevision = Number(app.messageListRevision || 0) + 1;
    if (message && typeof message === "object") message._renderRevision = Number(message._renderRevision || 0) + 1;
    return app.messageListRevision;
  }
  const RUNTIME_MESSAGE_FIELDS = Object.freeze(["id", "entryId", "role", "speaker", "text", "stateSyncStatus", "at", "saveId", "detail", "autoRead", "autoTurn", "choiceObjectiveId", "choiceSnapshotId", "gameMessageType", "objectiveComplete", "replySource", "stateBackupId", "stateBackupStartMessageId", "streaming", "temporary", "visibleText", "voiceMeta", "voiceSpeakers", "voiceText", "_renderRevision", "hiddenWhileRegenerating", "generationStopped", "relatedMessageIds", "choiceTitle"]);
  function validateRuntimeMessageStorage(messages) {
    const errors = [];
    if (!Array.isArray(messages)) return validationResult([validationError("messages", "type", "Runtime messages must be an array.")]);
    const ids = new Set();
    let previousEntryId = 0;
    for (const [index, message] of messages.entries()) {
      const path = `messages.${index}`;
      errors.push(...exactObjectFieldValidationErrors(message, RUNTIME_MESSAGE_FIELDS, path), ...requiredExactFieldsValidationErrors(message, ["id", "entryId", "role", "speaker", "text", "at"], path));
      if (!isPlainObject(message)) continue;
      if (!["string", "number"].includes(typeof message.id) || String(message.id) === "") errors.push(validationError(`${path}.id`, "type", `${path}.id must be non-empty text or a number.`));
      if (!Number.isSafeInteger(message.entryId) || message.entryId <= 0) errors.push(validationError(`${path}.entryId`, "type", `${path}.entryId must be a positive safe integer.`));
      const identity = String(message.id);
      if (ids.has(identity)) errors.push(validationError(`${path}.id`, "duplicate", `Duplicate runtime message id ${message.id}.`));
      ids.add(identity);
      if (Number.isSafeInteger(message.entryId) && message.entryId <= previousEntryId) errors.push(validationError(`${path}.entryId`, "order", "Runtime messages must already be in ascending entryId order."));
      previousEntryId = message.entryId;
      for (const field of ["role", "speaker", "text", "at"]) if (typeof message[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${path}.${field} must be text.`));
      if (message.role === "log") errors.push(validationError(`${path}.role`, "unsupported", "Log entries cannot be stored as runtime messages."));
    }
    return validationResult(errors);
  }
  function assertExactMessageStorage() {
    const validation = validateRuntimeMessageStorage(app.messages);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    rebuildMessageIndex();
    app.nextEntryId = Math.max(1, ...(app.messages || []).map(entry => entry.entryId + 1));
    return app.messages;
  }
  function nextEntryId() {
    const id = Math.max(1, Number(app.nextEntryId || 1));
    app.nextEntryId = id + 1;
    return id;
  }
  function entrySort(a, b) {
    const aId = Number(a?.entryId || a?.id || 0);
    const bId = Number(b?.entryId || b?.id || 0);
    if (aId !== bId) return aId - bId;
    return String(a?.at || "").localeCompare(String(b?.at || ""));
  }
  function combinedEntriesForRender() {
    // Message IDs are assigned monotonically and storage normalization sorts once.
    // Returning the canonical array avoids an O(n log n) copy for every lookup/render.
    return Array.isArray(app.messages) ? app.messages : [];
  }
  function compactMessageForStorage(message) {
    const validation = validateRuntimeMessageStorage([message]);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    const compact = clone(message);
    delete compact.id;
    delete compact.entryId;
    delete compact.saveId;
    delete compact._renderRevision;
    delete compact.hiddenWhileRegenerating;
    delete compact.relatedMessageIds;
    delete compact.choiceTitle;
    return compact;
  }
  const STORED_MESSAGE_ROW_FIELDS = Object.freeze(["saveId", "messageId", "sequence", "role", "speaker", "text", "detail", "at", "stateSyncStatus", "autoTurn", "autoRead", "replySource", "generationStopped", "objectiveComplete", "choiceObjectiveId", "choiceSnapshotId", "stateBackupId"]);
  const STORED_MESSAGE_REQUIRED_ROW_FIELDS = Object.freeze(["saveId", "messageId", "sequence", "role", "speaker", "text", "detail", "at"]);
  function runtimeMessageFromStoredRow(row) {
    const errors = [...exactObjectFieldValidationErrors(row, STORED_MESSAGE_ROW_FIELDS, "message"), ...requiredExactFieldsValidationErrors(row, STORED_MESSAGE_REQUIRED_ROW_FIELDS, "message")];
    if (isPlainObject(row)) {
      if (!Number.isSafeInteger(row.saveId) || row.saveId <= 0) errors.push(validationError("message.saveId", "type", "message.saveId must be a positive safe integer."));
      if (typeof row.messageId !== "string" || !row.messageId) errors.push(validationError("message.messageId", "type", "message.messageId must be non-empty text."));
      if (!Number.isSafeInteger(row.sequence) || row.sequence <= 0) errors.push(validationError("message.sequence", "type", "message.sequence must be a positive safe integer."));
    }
    if (errors.length) throw new Error(validationErrorsText(validationResult(errors)));
    const runtime = {
      ...clone(row),
      id: row.messageId,
      entryId: row.sequence,
      saveId: String(row.saveId)
    };
    delete runtime.messageId;
    delete runtime.sequence;
    const validation = validateRuntimeMessageStorage([runtime]);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return runtime;
  }
  function saveMessageHistory() {
    const saveId = activeSaveId();
    if (!saveId) return false;
    assertActiveSaveRuntimeOwnership(saveId);
    scheduleActiveGameSaveSoon("message history save");
    return true;
  }
  function assertActiveSaveRuntimeOwnership(saveId = activeSaveId()) {
    if (typeof saveId !== "string" || !saveId || saveId.trim() !== saveId) throw new Error("Active save id must be exact non-empty trimmed text.");
    if (!isPlainObject(app.state)) throw new Error("Active save runtime state must be an object.");
    if (!isPlainObject(app.state.meta)) throw new Error("Active save runtime state.meta must be an object.");
    if (app.state.meta.save_id !== saveId) throw new Error(`Active save runtime ownership mismatch: expected ${saveId}, received ${JSON.stringify(app.state.meta.save_id)}.`);
    return true;
  }
  function stateForStorage(state = app.state) {
    const next = clone(state || defaultState);
    next.meta ||= {};
    delete next.meta.player_preferences;
    if (next.scene) delete next.scene.objective;
    if (next.progression) delete next.progression.current_goal;
    delete next.meta.title_image_html;
    stripEmbeddedProfileImageHtml(next);
    return next;
  }
  function gameSaveStateForStorage(state = app.state) {
    const next = stateForStorage(state);
    next.meta ||= {};
    return next;
  }
  const SNAPSHOT_FIELDS = Object.freeze(["id", "createdAt", "reason", "messageBoundaryId", "messageCount", "modifiedMessagesBefore", "deletedMessagesBefore", "reverseRuntimeChanges", "queueState", "runtimeFlags", "rewardRuntime", "type", "messageIds", "startMessageId", "objectiveId", "objectiveTitle", "parentObjectiveId"]);
  function snapshotForStorage(snapshot, path = "snapshot") {
    if (!isPlainObject(snapshot)) throw new Error(`${path} must be an object.`);
    const allowed = new Set(SNAPSHOT_FIELDS);
    const unknown = Object.keys(snapshot).find(field => !allowed.has(field));
    if (unknown) throw new Error(`${path}.${unknown} is not an approved field.`);
    for (const field of ["id", "createdAt", "reason", "messageBoundaryId"]) if (typeof snapshot[field] !== "string" || !snapshot[field]) throw new Error(`${path}.${field} must be non-empty text.`);
    if (Object.hasOwn(snapshot, "messageCount") && (!Number.isSafeInteger(snapshot.messageCount) || snapshot.messageCount < 0)) throw new Error(`${path}.messageCount must be a nonnegative safe integer.`);
    if (!isPlainObject(snapshot.modifiedMessagesBefore)) throw new Error(`${path}.modifiedMessagesBefore must be an object.`);
    for (const field of ["deletedMessagesBefore", "reverseRuntimeChanges", "queueState"]) if (!Array.isArray(snapshot[field])) throw new Error(`${path}.${field} must be an array.`);
    snapshot.queueState.forEach((item, index) => exactQueueItem(item, `${path}.queueState[${index}]`));
    if (!isPlainObject(snapshot.runtimeFlags)) throw new Error(`${path}.runtimeFlags must be an object.`);
    if (!isPlainObject(snapshot.rewardRuntime)) throw new Error(`${path}.rewardRuntime must be an object.`);
    const rewardRuntimeFields = Object.keys(snapshot.rewardRuntime);
    if (rewardRuntimeFields.length !== 1 || rewardRuntimeFields[0] !== "appliedInvocationIds" || !isPlainObject(snapshot.rewardRuntime.appliedInvocationIds)) throw new Error(`${path}.rewardRuntime must contain only an appliedInvocationIds object.`);
    for (const [invocationId, record] of Object.entries(snapshot.rewardRuntime.appliedInvocationIds)) {
      if (!invocationId) throw new Error(`${path}.rewardRuntime contains an empty invocation id.`);
      if (!isPlainObject(record)) throw new Error(`${path}.rewardRuntime.appliedInvocationIds.${invocationId} must be an object.`);
      const fields = Object.keys(record);
      if (fields.length !== 3 || !fields.includes("appliedAt") || !fields.includes("sourceType") || !fields.includes("sourceId")) throw new Error(`${path}.rewardRuntime.appliedInvocationIds.${invocationId} has invalid fields.`);
      for (const field of ["appliedAt", "sourceType", "sourceId"]) if (typeof record[field] !== "string" || !record[field]) throw new Error(`${path}.rewardRuntime.appliedInvocationIds.${invocationId}.${field} must be non-empty text.`);
    }
    const runtimeFlagFields = new Set(["pendingNpcInvite", "pendingObjectiveChoiceReply", "pendingRegenerateMessage", "currentReplyDirective", "currentReplyMode", "activeQueueSource", "autoPlayerTurnGenerating"]);
    const unknownRuntimeFlag = Object.keys(snapshot.runtimeFlags).find(field => !runtimeFlagFields.has(field));
    if (unknownRuntimeFlag) throw new Error(`${path}.runtimeFlags.${unknownRuntimeFlag} is not an approved field.`);
    for (const field of runtimeFlagFields) if (!Object.hasOwn(snapshot.runtimeFlags, field)) throw new Error(`${path}.runtimeFlags.${field} is required.`);
    for (const field of ["pendingNpcInvite", "pendingObjectiveChoiceReply", "pendingRegenerateMessage"]) if (snapshot.runtimeFlags[field] !== null && !isPlainObject(snapshot.runtimeFlags[field])) throw new Error(`${path}.runtimeFlags.${field} must be an object or null.`);
    for (const field of ["currentReplyDirective", "currentReplyMode", "activeQueueSource"]) if (typeof snapshot.runtimeFlags[field] !== "string") throw new Error(`${path}.runtimeFlags.${field} must be text.`);
    if (typeof snapshot.runtimeFlags.autoPlayerTurnGenerating !== "boolean") throw new Error(`${path}.runtimeFlags.autoPlayerTurnGenerating must be true or false.`);
    for (const field of ["type", "startMessageId", "objectiveId", "objectiveTitle", "parentObjectiveId"]) if (Object.hasOwn(snapshot, field) && (typeof snapshot[field] !== "string" || !snapshot[field])) throw new Error(`${path}.${field} must be non-empty text when present.`);
    if (Object.hasOwn(snapshot, "messageIds")) {
      if (!Array.isArray(snapshot.messageIds) || !snapshot.messageIds.length) throw new Error(`${path}.messageIds must be a non-empty array.`);
      const seen = new Set();
      snapshot.messageIds.forEach((id, index) => {
        if (typeof id !== "string" || !id) throw new Error(`${path}.messageIds[${index}] must be non-empty text.`);
        if (seen.has(id)) throw new Error(`${path}.messageIds[${index}] duplicates ${id}.`);
        seen.add(id);
      });
    }
    return clone(snapshot);
  }
  function saveSettingsNow(reason = "settings changed") {
    if (!app.library) {
      log("Settings save skipped", `Storage is unavailable during ${reason}.`, {
        type: "storage",
        level: "warning"
      });
      return Promise.resolve(false);
    }
    const promise = app.library.putSettings({
      [SETTINGS_KEY]: localSettingsForStorage()
    });
    trackLargeStoragePromise(SETTINGS_KEY, promise);
    return promise;
  }
  function saveStoryLibraryNow(reason = "story library changed") {
    const smoke = devSmokeSuiteState?.();
    if (smoke?.running && !smoke.restoring) {
      devTestLog("Blocked destructive story-library replacement during smoke", {
        reason,
        recordCount: (app.storyTemplates || []).length
      });
      return false;
    }
    queuePerRecordLibrarySave(STORY_TEMPLATE_KEY, app.storyTemplates || [], reason);
    return true;
  }
  function saveStoryTemplateRecordsNow(records = [], reason = "story record changed") {
    const validated = assertHydratedStoryTemplateRecords(records);
    if (!validated.length) return false;
    return queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, validated, reason);
  }
  function saveStoryTitleImagesNow(reason = "story title images changed") {
    const smoke = devSmokeSuiteState?.();
    if (smoke?.running && !smoke.restoring) {
      devTestLog("Blocked destructive story-title image replacement during smoke", {
        reason,
        recordCount: (app.storyTitleCardImages || []).length
      });
      return false;
    }
    queuePerRecordLibrarySave(STORY_TITLE_CARD_IMAGE_KEY, app.storyTitleCardImages || [], reason);
    return true;
  }
  function saveStoryTitleImageRecordsNow(records = [], reason = "story title image changed") {
    const normalized = exactStoryTitleCardImageStore(records);
    if (!normalized.length) return false;
    return queuePerRecordLibraryRecordsSave(STORY_TITLE_CARD_IMAGE_KEY, normalized, reason);
  }
  function deleteStoryTitleImageRecordsNow(records = [], reason = "story title image deleted") {
    const normalized = exactLibraryRecordDeletionReferences(records);
    if (!normalized.length) return false;
    return queuePerRecordLibraryRecordsDelete(STORY_TITLE_CARD_IMAGE_KEY, normalized, reason);
  }
  function saveCharacterLibraryNow(reason = "character library changed") {
    const smoke = devSmokeSuiteState?.();
    if (smoke?.running && !smoke.restoring) {
      devTestLog("Blocked destructive character-library replacement during smoke", {
        reason,
        recordCount: (app.characterDefinitions || []).length
      });
      return false;
    }
    queuePerRecordLibrarySave(CHARACTER_LIBRARY_KEY, app.characterDefinitions || [], reason);
    return true;
  }
  function saveCharacterLibraryRecordsNow(records = [], reason = "character record changed") {
    const normalized = validatedCharacterLibraryDefinitions(records.map(record => projectCharacterLibraryDefinitionProfileFields(clone(record))));
    if (!normalized.length) return false;
    return queuePerRecordLibraryRecordsSave(CHARACTER_LIBRARY_KEY, normalized, reason);
  }
  function saveProfileImagesNow(reason = "profile images changed") {
    app.profileImageResolutionEpoch++;
    invalidateProfileImageReferenceCache();
    const smoke = devSmokeSuiteState?.();
    if (smoke?.running && !smoke.restoring) {
      devTestLog("Blocked destructive profile-image replacement during smoke", {
        reason,
        recordCount: (app.profileImages || []).length
      });
      return false;
    }
    queuePerRecordLibrarySave(PROFILE_IMAGE_KEY, app.profileImages || [], reason);
    return true;
  }
  function saveProfileImageRecordsNow(records = [], reason = "profile image changed", options = {}) {
    app.profileImageResolutionEpoch++;
    invalidateProfileImageReferenceCache();
    const normalized = exactProfileImageStore(records).filter(persistentProfileImageRecord);
    if (!normalized.length) return false;
    return queuePerRecordLibraryRecordsSave(PROFILE_IMAGE_KEY, normalized, reason, options);
  }
  function deleteProfileImageRecordsNow(records = [], reason = "profile image deleted") {
    app.profileImageResolutionEpoch++;
    invalidateProfileImageReferenceCache();
    const normalized = exactLibraryRecordDeletionReferences(records);
    if (!normalized.length) return false;
    return queuePerRecordLibraryRecordsDelete(PROFILE_IMAGE_KEY, normalized, reason);
  }
  function performActiveGameSave(reason = "save active game") {
    if (app.saveSessionActive) {
      scheduleSaveProjectionFlush();
      return;
    }
    // A closed save session has no writable owner. Drop stale timer work.
    cancelScheduledActiveGameSave();
  }
  function scheduleActiveGameSave(reason = "active game save") {
    return scheduleSaveAll(reason);
  }
  function scheduleActiveGameSaveSoon(reason = "urgent active game save") {
    return scheduleSaveAll(reason, {
      urgent: true
    });
  }
  function cancelScheduledActiveGameSave() {
    clearTimeout(app.activeGameSaveTimer);
    app.activeGameSaveTimer = null;
    app.activeGameSaveDeadlineAt = 0;
    app.activeGameSaveDirty = false;
    app.activeGameSavePendingReason = "";
    app.activeGameSaveQueuedCount = 0;
    app.activeGameSaveFirstQueuedAt = 0;
  }
  function scheduleSaveAll(reason = "active game save", options = {}) {
    if (app.saveSessionActive) {
      scheduleSaveProjectionFlush();
      return true;
    }
    // Saving does not alter objective state. Keep the derived objective index
    // alive so unrelated autosaves cannot force a large graph rescan.
    noteGameStateRevision(reason);
    const alreadyQueued = !!app.activeGameSaveTimer;
    const delayMs = options?.urgent ? SAVE_ALL_URGENT_DELAY_MS : SAVE_ALL_NORMAL_DELAY_MS;
    const now = Date.now();
    const nextDeadline = now + delayMs;
    const existingDeadline = Number(app.activeGameSaveDeadlineAt || 0);
    app.activeGameSaveDirty = true;
    app.activeGameSavePendingReason = reason;
    app.activeGameSaveQueuedCount = (app.activeGameSaveQueuedCount || 0) + 1;
    app.activeGameSaveFirstQueuedAt ||= perfNow();
    if (alreadyQueued && existingDeadline && existingDeadline <= nextDeadline) {
      if (Array.isArray(app.activeGameSaveScheduleSmokeLog)) {
        app.activeGameSaveScheduleSmokeLog.push({
          reason,
          delayMs,
          deadlineAt: existingDeadline,
          unchanged: true
        });
      }
      return false;
    }
    clearTimeout(app.activeGameSaveTimer);
    app.activeGameSaveDeadlineAt = nextDeadline;
    app.activeGameSaveTimer = setTimeout(() => flushScheduledSaveAll("scheduled active game save"), delayMs);
    if (Array.isArray(app.activeGameSaveScheduleSmokeLog)) {
      app.activeGameSaveScheduleSmokeLog.push({
        reason,
        delayMs,
        deadlineAt: nextDeadline,
        unchanged: false
      });
    }
    if (!alreadyQueued) perfConsole("active game save queued", {
      reason,
      delayMs
    }, "log");
    return true;
  }
  function flushScheduledSaveAll(reason = "flush active game save") {
    if (app.saveSessionActive) {
      cancelScheduledActiveGameSave();
      return flushRuntimeSaveProjections();
    }
    {
      const pendingReason = app.activeGameSavePendingReason || reason;
      const queuedCount = app.activeGameSaveQueuedCount || 0;
      const queuedMs = app.activeGameSaveFirstQueuedAt ? Math.round(perfNow() - app.activeGameSaveFirstQueuedAt) : 0;
      if (app.activeGameSaveDirty) {
        perfConsole("active game save discarded", {
          reason: pendingReason,
          trigger: reason,
          queuedCount,
          queuedMs
        }, "log");
        if (Array.isArray(app.activeGameSaveFlushSmokeLog)) {
          app.activeGameSaveFlushSmokeLog.push({
            reason: pendingReason,
            trigger: reason,
            at: Date.now(),
            queuedCount,
            queuedMs,
            discarded: true
          });
        }
      }
    }
    cancelScheduledActiveGameSave();
    return false;
  }
  function flushScheduledSaveAllIfPossible(reason = "flush active game save") {
    try {
      flushScheduledSaveAll(reason);
    } catch (err) {
      recordStorageFailure(ACTIVE_SAVE_KEY, err);
    }
  }
  function showSavingOverlay(message = "Saving...") {
    app.savingOverlayDepth = (app.savingOverlayDepth || 0) + 1;
    app.savingOverlayActivityIds ||= [];
    const id = beginActivityTask(message, {
      priority: 70,
      kind: "requested"
    });
    app.savingOverlayActivityIds.push(id);
    return document.getElementById("emberAdventuresActivityIndicator");
  }
  function hideSavingOverlay() {
    app.savingOverlayDepth = Math.max(0, (app.savingOverlayDepth || 1) - 1);
    const id = app.savingOverlayActivityIds?.pop?.();
    if (id) endActivityTask(id);
  }
  async function withSavingOverlay(action, message = "Saving...") {
    showSavingOverlay(message);
    await waitForRenderedFrame?.();
    try {
      return await action();
    } finally {
      hideSavingOverlay();
    }
  }
  async function flushActiveGameSave() {
    return withSavingOverlay(async () => {
      scheduleActiveGameSave("flush active game save");
      flushScheduledSaveAll("flush active game save");
      const saveId = activeSaveId();
      const saved = saveId ? await app.work.flush(`save:${saveId}`) : true;
      const workerSaved = saved ? await flushPersistenceWorkerSave(saveId) : false;
      if (!saved || !workerSaved) {
        recordStorageFailure(ACTIVE_SAVE_KEY, new Error("Blocking save flush failed"));
        await showNotice("Save Failed", "EmberAdventures could not finish saving. The current action was stopped so your active game is not replaced before the save succeeds.");
        return false;
      }
      return true;
    });
  }

  // Snapshot policy: snapshots are for message-timeline rollback, not
  // general manual undo. The intended long-term flow is to capture the
  // state before a normal AI state update, keep that backup only after the
  // update saves, and use it when edit/regenerate rewinds to that message.
  // Manual UI actions should save normally without creating snapshots.
  const MESSAGE_STATE_SNAPSHOT_LIMIT = 24;
  function snapshotComparableState(state = app.state) {
    return stateForStorage(state || defaultState);
  }
  function buildReverseStatePatch(currentValue, previousValue, path = [], patch = []) {
    // Do not JSON-stringify every nested subtree before descending. That
    // turns a normal deep diff into repeated whole-state serialization.
    if (Object.is(currentValue, previousValue)) return patch;
    const currentArray = Array.isArray(currentValue);
    const previousArray = Array.isArray(previousValue);
    if (currentArray && previousArray) {
      const sharedLength = Math.min(currentValue.length, previousValue.length);
      for (let index = 0; index < sharedLength; index++) {
        buildReverseStatePatch(currentValue[index], previousValue[index], [...path, index], patch);
      }
      if (currentValue.length !== previousValue.length) {
        patch.push({
          op: "splice",
          path: [...path],
          index: sharedLength,
          deleteCount: Math.max(0, currentValue.length - sharedLength),
          items: clone(previousValue.slice(sharedLength))
        });
      }
      return patch;
    }
    if (isPlainObject(currentValue) && isPlainObject(previousValue)) {
      const currentKeys = Object.keys(currentValue);
      const previousKeys = Object.keys(previousValue);
      const previousKeySet = new Set(previousKeys);
      const currentKeySet = new Set(currentKeys);
      for (const key of currentKeys) {
        if (!previousKeySet.has(key)) {
          patch.push({
            op: "delete",
            path: [...path, key]
          });
          continue;
        }
        buildReverseStatePatch(currentValue[key], previousValue[key], [...path, key], patch);
      }
      for (const key of previousKeys) {
        if (!currentKeySet.has(key)) {
          patch.push({
            op: "set",
            path: [...path, key],
            value: clone(previousValue[key])
          });
        }
      }
      return patch;
    }
    patch.push({
      op: "set",
      path: [...path],
      value: clone(previousValue)
    });
    return patch;
  }
  function validSnapshotPatchPath(path) {
    return Array.isArray(path) && path.every(part => typeof part === "number" && Number.isInteger(part) && part >= 0 || typeof part === "string" && part !== "__proto__" && part !== "prototype" && part !== "constructor");
  }
  function snapshotPatchParent(rootValue, path = []) {
    let parent = rootValue;
    for (const part of path.slice(0, -1)) {
      if (!parent || typeof parent !== "object") return null;
      parent = parent[part];
    }
    return parent;
  }
  function cloneAffectedStateForPatch(state, patch = []) {
    const source = runtimeSaveUnwrap(state || {});
    const next = {
      ...source
    };
    const roots = new Set();
    for (const operation of Array.isArray(patch) ? patch : []) {
      if (!operation || !validSnapshotPatchPath(operation.path)) continue;
      if (!operation.path.length) return runtimeSaveCloneValue(source);
      roots.add(operation.path[0]);
    }
    for (const root of roots) next[root] = runtimeSaveCloneValue(source[root]);
    return next;
  }
  function applyReverseStatePatch(state, patch = []) {
    let next = cloneAffectedStateForPatch(state, patch);
    for (const operation of Array.isArray(patch) ? patch : []) {
      if (!operation || !validSnapshotPatchPath(operation.path)) continue;
      if (!operation.path.length) {
        if (operation.op === "set") next = runtimeSaveCloneValue(operation.value);
        continue;
      }
      const parent = snapshotPatchParent(next, operation.path);
      if (!parent || typeof parent !== "object") continue;
      const key = operation.path[operation.path.length - 1];
      if (operation.op === "set") {
        parent[key] = runtimeSaveCloneValue(operation.value);
      } else if (operation.op === "delete") {
        if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1);else delete parent[key];
      } else if (operation.op === "splice" && Array.isArray(parent[key])) {
        parent[key].splice(Math.max(0, Number(operation.index) || 0), Math.max(0, Number(operation.deleteCount) || 0), ...clone(Array.isArray(operation.items) ? operation.items : []));
      }
    }
    return next;
  }
  function compactSnapshotList(snapshots = []) {
    const source = Array.isArray(snapshots) ? snapshots : [];
    const retained = source.slice(-MESSAGE_STATE_SNAPSHOT_LIMIT);
    const compact = retained.map((snapshot, index) => snapshotForStorage(snapshot, `snapshots[${index}]`));
    if (compact.length) compact[0].reverseRuntimeChanges = [];
    return compact;
  }
  function snapshotHeadPatchForStorage() {
    if (!(app.snapshots || []).length) return [];
    return [...snapshotReversePatchFromMutationJournal(), ...(app.snapshotHeadExtraReverseChanges || []).map(runtimeSaveCloneValue)];
  }
  function snapshotReversePatchFromMutationJournal() {
    const patch = [];
    const operations = runtimeSaveMutationTracker.snapshotStateOperations || [];
    for (let index = operations.length - 1; index >= 0; index--) {
      const operation = operations[index];
      if (!operation || !validSnapshotPatchPath(operation.path)) continue;
      if (operation.beforeExists) {
        patch.push({
          op: "set",
          path: [...operation.path],
          value: runtimeSaveCloneValue(operation.beforeValue)
        });
      } else {
        patch.push({
          op: "delete",
          path: [...operation.path]
        });
      }
    }
    return patch;
  }
  function latestSnapshotStateFromCurrent(headPatch = null) {
    if (!(app.snapshots || []).length) return null;
    return applyReverseStatePatch(app.state, Array.isArray(headPatch) ? headPatch : snapshotHeadPatchForStorage());
  }
  function stateForRollbackSnapshot(snapshot = {}) {
    const targetIndex = (app.snapshots || []).findIndex(item => item.id === snapshot.id);
    if (targetIndex < 0) return null;
    let state = app.state;
    const headPatch = snapshotHeadPatchForStorage();
    if (headPatch.length) state = applyReverseStatePatch(state, headPatch);
    for (let index = app.snapshots.length - 1; index > targetIndex; index--) {
      const reverse = app.snapshots[index].reverseRuntimeChanges || [];
      state = applyReverseStatePatch(state, reverse);
    }
    return state;
  }
  function runtimeSnapshotForMessageRollback() {
    const messages = Array.isArray(app.messages) ? app.messages : [];
    const last = messages[messages.length - 1];
    return {
      messageBoundaryId: String(last?.id ?? last?.entryId ?? ""),
      messageCount: messages.length,
      queueState: clone(app.queue || []),
      runtimeFlags: {
        pendingNpcInvite: clone(app.pendingNpcInvite),
        pendingObjectiveChoiceReply: clone(app.pendingObjectiveChoiceReply),
        pendingRegenerateMessage: clone(app.pendingRegenerateMessage),
        currentReplyDirective: app.currentReplyDirective,
        currentReplyMode: app.currentReplyMode,
        activeQueueSource: app.activeQueueSource,
        autoPlayerTurnGenerating: app.autoPlayerTurnGenerating
      },
      rewardRuntime: clone(app.rewardRuntime || createEmptyRewardRuntime())
    };
  }
  function restoreMessagesToSnapshotBoundary(snapshot = {}) {
    const boundaryId = Number(snapshot.messageBoundaryId || 0);
    const boundaryCount = Math.max(0, Number(snapshot.messageCount || 0));
    let messages = Array.isArray(app.messages) ? [...app.messages] : [];
    if (boundaryId > 0) messages = messages.filter(message => Number(message?.entryId || message?.id || 0) <= boundaryId);else if (boundaryCount >= 0) messages = messages.slice(0, boundaryCount);
    const modified = snapshot.modifiedMessagesBefore || {};
    messages = messages.map(message => {
      const id = String(message?.id ?? message?.entryId ?? "");
      return Object.prototype.hasOwnProperty.call(modified, id) ? clone(modified[id]) : message;
    });
    for (const deleted of Array.isArray(snapshot.deletedMessagesBefore) ? snapshot.deletedMessagesBefore : []) {
      const id = String(deleted?.id ?? deleted?.entryId ?? "");
      if (id && !messages.some(message => String(message?.id ?? message?.entryId ?? "") === id)) messages.push(clone(deleted));
    }
    app.messages = messages.sort(entrySort);
  }
  function restoreRuntimeSnapshotForMessageRollback(snapshot = {}) {
    stopReadingMessage(false);
    clearVoiceMessageRuntimeState();
    const preservedTitleImageHtml = app.state?.meta?.title_image_html || "";
    const restoredState = stateForRollbackSnapshot(snapshot);
    if (!restoredState) throw new Error("Rollback snapshot state could not be reconstructed.");
    app.state = restoredState;
    app.state.meta ||= {};
    if (preservedTitleImageHtml) app.state.meta.title_image_html = preservedTitleImageHtml;
    if (!app.storyDefinition || app.storyDefinition.revisionId !== app.state.meta.definition_revision_id) {
      if (app.state.meta.smoke_test_runtime === true) {
        // Synthetic smoke snapshots may intentionally restore a
        // replacement fixture. Production rollback never recompiles
        // authored definitions on the UI thread.
        installImmutableStoryDefinitionFromState(app.state);
      } else {
        throw new Error("Rollback snapshot does not match the active immutable story definition.");
      }
    } else {
      app.objectiveRuntime = objectiveRuntimeFromState(app.state, app.storyDefinition);
      app.objectiveRuntimeLookup = null;
      app.objectiveRuntimeNeedsFullSync = false;
      app.jobRuntime = runtimeJobAggregateFromState(app.state);
      app.storyRulesRuntime = storyRulesRuntimeFromState(app.state, app.storyDefinition);
    }
    restoreMessagesToSnapshotBoundary(snapshot);
    const exactSnapshot = snapshotForStorage(snapshot);
    app.rewardRuntime = clone(exactSnapshot.rewardRuntime);
    app.queue = clone(exactSnapshot.queueState);
    const runtime = exactSnapshot.runtimeFlags;
    app.pendingNpcInvite = clone(runtime.pendingNpcInvite);
    app.pendingObjectiveChoiceReply = clone(runtime.pendingObjectiveChoiceReply);
    app.pendingRegenerateMessage = clone(runtime.pendingRegenerateMessage);
    app.currentReplyDirective = runtime.currentReplyDirective;
    app.currentReplyMode = runtime.currentReplyMode;
    app.activeQueueSource = runtime.activeQueueSource;
    app.autoPlayerTurnGenerating = runtime.autoPlayerTurnGenerating;
    requireRuntimePersistenceBaseline("snapshot rollback restored runtime state");
    assertExactMessageStorage();
  }
  function snapshotState(reason, meta = {}) {
    if (typeof reason !== "string" || !reason) throw new Error("snapshot reason must be non-empty text.");
    if (!isPlainObject(meta)) throw new Error("snapshot metadata must be an object.");
    const snapshotStartedAt = perfNow();
    const saveId = activeSaveId();
    const runtime = runtimeSnapshotForMessageRollback();
    const reverseRuntimeChanges = (app.snapshots || []).length ? snapshotReversePatchFromMutationJournal() : [];
    const snapshot = snapshotForStorage({
      id: meta.id || `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      reason,
      reverseRuntimeChanges,
      messageBoundaryId: runtime.messageBoundaryId,
      messageCount: runtime.messageCount,
      modifiedMessagesBefore: {},
      deletedMessagesBefore: [],
      queueState: runtime.queueState,
      runtimeFlags: runtime.runtimeFlags,
      rewardRuntime: runtime.rewardRuntime,
      ...meta
    });
    app.snapshots.push(snapshot);
    if (app.snapshots.length > MESSAGE_STATE_SNAPSHOT_LIMIT) {
      const removed = app.snapshots.splice(0, app.snapshots.length - MESSAGE_STATE_SNAPSHOT_LIMIT);
      for (const item of removed) markRuntimeCollectionDirty("snapshots", item.id, "delete");
    }
    if (app.snapshots.length) app.snapshots[0].reverseRuntimeChanges = [];
    runtimeSaveMutationTracker.snapshotStateOperations = [];
    runtimeSaveMutationTracker.snapshotBeforeByPath.clear();
    app.snapshotHeadExtraReverseChanges = [];
    markRuntimeCollectionDirty("snapshots", snapshot.id, "put");
    if (saveId) scheduleActiveGameSaveSoon("snapshot save");
    app.performanceMetrics.snapshotCreateMs = Math.max(0, perfNow() - snapshotStartedAt);
    return snapshot;
  }
  function createMessageStateBackup(messageIds = [], reason = "before message state update") {
    // This is the supported snapshot entry point for edit/regenerate
    // rollback: restore to the state before this message's consequences,
    // then rerun state updates forward from the edited/regenerated text.
    if (!Array.isArray(messageIds) || !messageIds.length) throw new Error("message backup ids must be a non-empty array.");
    const ids = messageIds.map((id, index) => {
      if (!(typeof id === "string" || typeof id === "number") || String(id) === "") throw new Error(`message backup ids[${index}] must be non-empty text or a number.`);
      return String(id);
    });
    const seenIds = new Set();
    ids.forEach((id, index) => {
      if (seenIds.has(id)) throw new Error(`message backup ids[${index}] duplicates ${id}.`);
      seenIds.add(id);
    });
    if (typeof reason !== "string" || !reason) throw new Error("message backup reason must be non-empty text.");
    const messages = ids.map(findMessageById).filter(Boolean);
    const missingBackupMessages = messages.filter(message => !message.stateBackupId || !stateBackupForMessage(message));
    if (!missingBackupMessages.length) return messages.map(stateBackupForMessage).find(Boolean) || null;
    const snapshot = snapshotState(reason, {
      type: "message_state_backup",
      messageIds: ids,
      startMessageId: ids[0]
    });
    for (const message of missingBackupMessages) {
      message.stateBackupId = snapshot.id;
      message.stateBackupStartMessageId = snapshot.startMessageId;
    }
    saveMessageHistory();
    return snapshot;
  }
  function stateBackupForMessage(message) {
    if (!message?.stateBackupId) return null;
    return (app.snapshots || []).find(snapshot => String(snapshot.id || "") === String(message.stateBackupId)) || null;
  }
  function snapshotById(snapshotId = "") {
    const id = String(snapshotId || "").trim();
    if (!id) return null;
    return (app.snapshots || []).find(snapshot => String(snapshot.id || "") === id) || null;
  }
  function activeStateSyncBlockBackupForMessage(message = {}) {
    if (!app.stateSync?.running || !message) return null;
    const snapshot = snapshotById(app.stateSync.blockSnapshotId);
    if (!snapshot) return null;
    const entryId = Number(message.entryId || message.id || 0);
    const blockStart = Number(app.stateSync.blockStartEntryId || 0);
    const blockEnd = Number(app.stateSync.blockEndEntryId || 0);
    if (!Number.isFinite(entryId) || entryId <= 0) return null;
    if (blockStart && entryId < blockStart) return null;
    if (blockEnd && entryId > blockEnd) return null;
    return snapshot;
  }
  function messageStateWasProcessed(message = {}) {
    return message.stateSyncStatus === "synced" || message.stateSyncStatus === "processing";
  }
  function messageBroadStateWasProcessed(message = {}) {
    return message.stateSyncStatus === "synced" || message.stateSyncStatus === "processing";
  }
  function messageMutationAllowed(message = {}) {
    return !messageStateWasProcessed(message) || !!stateBackupForMessage(message) || !!activeStateSyncBlockBackupForMessage(message);
  }
  function messageCanShowDeleteAction(message = {}) {
    // Invariant: normal assistant replies answer a player message, so
    // deleting only the AI response would leave an orphaned player turn.
    // Continue replies are the exception because Continue creates no
    // visible player message; deleting that AI continuation is safe.
    if (message.role === "assistant") return String(message.replySource || "") === "continue";
    return message.role === "user";
  }
  function defaultGameSaveName(reason = "Saved Game", state = app.state) {
    const title = state?.meta?.story_source?.title || state?.location?.world || reason || "Saved Game";
    return String(title || "Saved Game").trim() || "Saved Game";
  }
  function gameSaveDisplayName(save = {}) {
    return String(save.name || "").trim() || defaultGameSaveName(save.reason || "Saved Game", save.state);
  }
  function isActiveGameSaveStorageKey(key = "") {
    const text = String(key || "");
    return text === ACTIVE_SAVE_KEY || text === SAVE_INDEX_ALL_KEY || text.startsWith("save:") || text.startsWith("save-record:") || text.startsWith("save-message:") || text.startsWith("save-snapshot:") || text.startsWith("save-image:");
  }
  function newSaveId(prefix = "save") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const SAVE_INDEX_RECORD_FIELDS = new Set(["saveId", "name", "storyTitle", "playerName", "createdAt", "updatedAt", "reason", "titleImageHtml", "titleImageAlt", "messageCount", "imageCount", "profileImageCount", "snapshotCount", "smokeTestRuntime"]);
  function validateSaveIndexRecord(record = {}, path = "saveIndex") {
    const errors = [];
    if (!isPlainObject(record)) return validationResult([validationError(path, "type", "Save index record must be an object.")]);
    errors.push(...exactObjectFieldValidationErrors(record, SAVE_INDEX_RECORD_FIELDS, path));
    for (const field of ["saveId", "name", "storyTitle", "playerName", "createdAt", "updatedAt", "reason", "titleImageHtml", "titleImageAlt"]) {
      if (typeof record[field] !== "string") errors.push(validationError(`${path}.${field}`, "type", `${field} must be a string.`));
    }
    if (typeof record.saveId === "string" && !/^\d+$/.test(record.saveId)) errors.push(validationError(`${path}.saveId`, "format", "saveId must be a numeric string."));
    if (typeof record.name === "string" && !record.name.trim()) errors.push(validationError(`${path}.name`, "required", "name is required."));
    for (const field of ["messageCount", "imageCount", "profileImageCount", "snapshotCount"]) {
      if (!Number.isInteger(record[field]) || record[field] < 0) errors.push(validationError(`${path}.${field}`, "type", `${field} must be a non-negative integer.`));
    }
    for (const field of ["smokeTestRuntime"]) {
      if (typeof record[field] !== "boolean") errors.push(validationError(`${path}.${field}`, "type", `${field} must be a boolean.`));
    }
    return validationResult(errors);
  }
  function exactSaveIndexRecord(record = {}, path = "saveIndex") {
    const validation = validateSaveIndexRecord(record, path);
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return clone(record);
  }
  function saveIndexRecordFromStoredHeader(header = {}, story = null) {
    const titleImageUrl = String(story?.titleImageUrl || "").trim();
    const sharedTitleImage = header.titleImageId ? profileStoreImageById(header.titleImageId) : null;
    const sharedTitleImageHtml = profileImageIsFinished(sharedTitleImage) ? imageHtmlToString(sharedTitleImage.html || "") : "";
    const createdAt = new Date(header.createdAt).toISOString();
    const updatedAt = new Date(header.lastCommittedAt ?? header.createdAt).toISOString();
    return exactSaveIndexRecord({
      saveId: String(header.saveId),
      name: String(header.displayName),
      storyTitle: String(story?.title || header.displayName),
      playerName: String(header.playerName || ""),
      createdAt,
      updatedAt,
      reason: "saved game",
      titleImageHtml: sharedTitleImageHtml || (titleImageUrl ? imageTagForStoredSrc(titleImageUrl) : ""),
      titleImageAlt: String(story?.title || header.displayName),
      messageCount: Number(header.messageCount || 0),
      imageCount: Number(header.imageCount || 0),
      profileImageCount: Number(header.profileImageCount || 0),
      snapshotCount: Number(header.snapshotCount || 0),
      smokeTestRuntime: header.smokeTestRuntime === true
    });
  }
  function activeSaveId() {
    if (typeof app.activeSaveId !== "string" || app.activeSaveId.trim() !== app.activeSaveId) throw new Error("app.activeSaveId must be exact trimmed text.");
    if (typeof app.currentGameSaveId !== "string" || app.currentGameSaveId.trim() !== app.currentGameSaveId) throw new Error("app.currentGameSaveId must be exact trimmed text.");
    if (app.activeSaveId && app.currentGameSaveId && app.activeSaveId !== app.currentGameSaveId) throw new Error("Active save id pointers do not match.");
    return app.activeSaveId || app.currentGameSaveId;
  }
  function setActiveSaveId(saveId = "") {
    if (typeof saveId !== "string" || saveId.trim() !== saveId) throw new Error("Active save id must be exact trimmed text.");
    app.activeSaveId = saveId;
    app.currentGameSaveId = saveId;
    app.settings.currentGameSaveId = saveId;
    return saveId;
  }
  function activeSavePointerForStorage() {
    const saveId = activeSaveId();
    return saveId ? {
      saveId
    } : null;
  }
  async function persistActiveSavePointer() {
    if (!app.library) throw new Error("The normalized application worker is required to persist the active save selection.");
    app.settings.currentGameSaveId = activeSaveId();
    await app.library.putSettings({
      [SETTINGS_KEY]: localSettingsForStorage()
    });
    return true;
  }
  function saveIndexRecords() {
    return (Array.isArray(app.saveIndex) ? app.saveIndex : []).map((record, index) => exactSaveIndexRecord(record, `saveIndex.${index}`)).sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
  }
  function setSaveIndexRecords(records = []) {
    const byId = new Map();
    for (const [index, record] of (records || []).entries()) {
      const exact = exactSaveIndexRecord(record, `saveIndex.${index}`);
      byId.set(exact.saveId, exact);
    }
    app.saveIndex = [...byId.values()].sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")));
    app.gameSaves = app.saveIndex;
    return app.saveIndex;
  }
  function findSaveIndexRecord(saveId = activeSaveId()) {
    const id = String(saveId || "").trim();
    if (!id) return null;
    return saveIndexRecords().find(record => String(record.saveId) === id) || null;
  }
  async function awaitLargeStorageSetJson(key, value) {
    return awaitLargeStorageSet(key, value, {
      json: true
    });
  }
  async function loadSaveIndexRecords() {
    if (app.persistence?.started) {
      const [page, storyLibrary] = await Promise.all([app.persistence.listSaves({
        limit: 200
      }), app.library?.listLibrary("story", {
        limit: 200
      }).catch(() => ({
        entries: []
      })) || {
        entries: []
      }]);
      const storiesById = new Map((storyLibrary?.entries || []).map(entry => [entry.storyId, entry]));
      return setSaveIndexRecords((page?.entries || []).map(header => saveIndexRecordFromStoredHeader(header, storiesById.get(header.storyId))));
    }
    throw new Error("The normalized persistence worker is required to list saved games.");
  }
  async function persistSaveIndexRecords() {
    // Headers are persisted with their owning save transaction. This method
    // only refreshes the in-memory projection from durable headers.
    return loadSaveIndexRecords();
  }
  async function loadActiveSaveFromStorage() {
    await loadSaveIndexRecords();
    const rememberedSaveId = String(app.settings.currentGameSaveId || "").trim();
    app.lastActiveSaveId = findSaveIndexRecord(rememberedSaveId) ? rememberedSaveId : "";
    app.activeSaveId = "";
    app.currentGameSaveId = "";
    app.storyDefinition = null;
    app.runtimeDefinitions = {
      jobsById: {},
      charactersById: {},
      locationsById: {}
    };
    app.objectiveRuntime = createEmptyObjectiveRuntime();
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
    app.state = clone(defaultState);
    app.messages = [];
    app.snapshots = [];
    app.images = [];
    app.profileImages = exactProfileImageStore(app.profileImages || []);
    app.profileImagesBootstrapped = false;
    requireRuntimePersistenceBaseline("active save pointer reset");
    assertExactMessageStorage();
    return !!app.lastActiveSaveId;
  }
  function runtimeDefinitionsFromAggregateRows(rows = []) {
    const runtimeDefinitions = {
      jobsById: {},
      charactersById: {},
      locationsById: {}
    };
    for (const row of rows || []) {
      if (row?.kind !== "runtime-definition") continue;
      const [type, id] = String(row.recordId || "").split(":", 2);
      if (!id || !row.value) continue;
      if (type === "job") runtimeDefinitions.jobsById[id] = deepFreezeDefinition(clone(row.value));
      if (type === "character") runtimeDefinitions.charactersById[id] = deepFreezeDefinition(clone(row.value));
      if (type === "location") runtimeDefinitions.locationsById[id] = deepFreezeDefinition(clone(row.value));
    }
    rebuildRuntimeJobObjectiveIndexes(runtimeDefinitions);
    return runtimeDefinitions;
  }
  function aggregateRowMap(rows = []) {
    const map = new Map();
    for (const row of rows || []) map.set(runtimeDirtyKey(row.kind, row.recordId), row.value);
    return map;
  }
  function materializedCharacterFromRuntimeRecord(record = {}, definitions = {}) {
    const definitionId = String(record?.definitionId || record?.runtime?.definitionId || "");
    const definition = definitions[definitionId];
    if (!definition) throw new Error(`Character runtime record is missing definition ${definitionId}.`);
    const runtime = clone(record?.runtime || {});
    const resolvedDefinition = applyRuntimeOverlay(definition, runtime.definitionOverlay || null);
    delete runtime.definitionOverlay;
    delete runtime.definitionId;
    return {
      ...resolvedDefinition,
      ...runtime,
      definition_id: definitionId,
      name: record?.name || resolvedDefinition.name || definitionId
    };
  }
  function materializeStateFromAggregateBundle(bundle = {}, definition = null) {
    if (!definition || typeof definition !== "object") throw new Error("Saved game is missing its immutable story definition revision.");
    const rows = Array.isArray(bundle.records) ? bundle.records : [];
    const rowMap = aggregateRowMap(rows);
    const runtimeDefinitions = runtimeDefinitionsFromAggregateRows(rows);
    const state = clone(defaultState);
    for (const [root, kind] of Object.entries(RUNTIME_DIRECT_ROOT_KINDS)) {
      if (root === "npc_directory" || root === "future_cast") continue;
      const value = rowMap.get(runtimeDirtyKey(kind, "current"));
      if (value !== undefined && value !== null) state[root] = clone(value);
    }
    for (const row of rows) {
      if (row.kind === "state-root") state[row.recordId] = clone(row.value);
    }
    state.meta ||= {};
    state.meta.definition_revision_id = definition.revisionId;
    state.meta.definition_content_hash = definition.contentHash;
    state.meta.save_id = String(bundle.header?.saveId || state.meta.save_id || "");
    state.characters = {};
    const allCharacterDefinitions = {
      ...(definition.characterDefinitionsById || {}),
      ...(runtimeDefinitions.charactersById || {})
    };
    for (const row of rows.filter(item => item.kind === "character")) {
      const character = materializedCharacterFromRuntimeRecord(row.value, allCharacterDefinitions);
      state.characters[character.name || row.recordId] = character;
    }
    state.npc_directory = materializeNpcDirectoryRecord(rowMap.get(runtimeDirtyKey("npc-directory", "current")) || {
      locations: {}
    }, allCharacterDefinitions, rows);
    state.future_cast = materializeFutureCastRuntime(rowMap.get(runtimeDirtyKey("future-cast-runtime", "current")) || {}, definition, allCharacterDefinitions);
    const objectiveRuntime = clone(rowMap.get(runtimeDirtyKey("objective-runtime", "current")) || createEmptyObjectiveRuntime());
    const objectiveOrder = Array.isArray(definition.objectiveOrder) ? definition.objectiveOrder : Object.keys(definition.objectivesById || {});
    state.objectives = {
      active_id: objectiveRuntime.activeMainObjectiveId || "",
      focus_id: objectiveRuntime.focusedSideObjectiveId || "",
      no_current: objectiveRuntime.noCurrent === true,
      progress_notes: clone(objectiveRuntime.progressNotesById || {}),
      pending_reward_choices: clone(objectiveRuntime.pendingRewardChoices || []),
      pending_choice: clone(objectiveRuntime.pendingChoice || null),
      exclusive_group_choices: clone(objectiveRuntime.exclusiveGroupChoices || {}),
      completion_message: String(objectiveRuntime.completionMessage || ""),
      completed_main_message: String(objectiveRuntime.completedMainMessage || ""),
      pending_completion_message: clone(objectiveRuntime.pendingCompletionMessage || null),
      suggestions: clone(objectiveRuntime.suggestions || []),
      items: objectiveOrder.map(id => {
        const authored = clone(definition.objectivesById?.[id] || {
          id
        });
        authored.status = Object.prototype.hasOwnProperty.call(objectiveRuntime.statusById || {}, id) ? objectiveRuntime.statusById[id] : authored.initialStatus || authored.status || "hidden";
        if (objectiveRuntime.selectedOutcomeById?.[id]) authored.selected_outcome_id = objectiveRuntime.selectedOutcomeById[id];
        if (objectiveRuntime.selectedOutcomeMessageById?.[id]) authored.selected_outcome_message_id = objectiveRuntime.selectedOutcomeMessageById[id];
        if (objectiveRuntime.selectedChoiceById?.[id]) authored.selected_choice_id = objectiveRuntime.selectedChoiceById[id];
        if (objectiveRuntime.selectedChoiceTitleById?.[id]) authored.selected_choice_title = objectiveRuntime.selectedChoiceTitleById[id];
        if (objectiveRuntime.selectedOutputById?.[id]) authored.selected_output_id = objectiveRuntime.selectedOutputById[id];
        if (objectiveRuntime.progressNotesById?.[id] != null) authored.progress_notes = clone(objectiveRuntime.progressNotesById[id]);
        return authored;
      })
    };
    const rewardRuntime = clone(rowMap.get(runtimeDirtyKey("reward-runtime", "current")) || {
      appliedInvocationIds: {}
    });
    const storyRulesRuntime = clone(rowMap.get(runtimeDirtyKey("story-rules-runtime", "current")) || {
      added: [],
      removedKeys: []
    });
    const removedRules = new Set(storyRulesRuntime.removedKeys || []);
    state.story_rules = [...(definition.storyRules || []).filter(rule => !removedRules.has(storyRuleStableKey(rule))), ...(storyRulesRuntime.added || [])].map(clone);
    const jobRuntime = clone(rowMap.get(runtimeDirtyKey("job-runtime", "current")) || {
      activeJobsById: {},
      runtimeByJobId: {}
    });
    state.active_generated_jobs = {};
    const materializedObjectiveIds = new Set((state.objectives.items || []).map(objective => String(objective?.id || "")).filter(Boolean));
    for (const [jobId, active] of Object.entries(jobRuntime.activeJobsById || {})) {
      const definitionId = String(active?.definitionId || jobId);
      const jobDefinition = runtimeDefinitions.jobsById?.[definitionId];
      if (!jobDefinition) throw new Error(`Generated job ${jobId} is missing definition ${definitionId}.`);
      const runtime = jobRuntime.runtimeByJobId?.[jobId] || {};
      state.active_generated_jobs[jobId] = {
        ...clone(jobDefinition),
        ...clone(runtime),
        id: jobId,
        definition_id: definitionId
      };
      for (const objectiveDefinition of jobDefinition.objectives || []) {
        const objectiveId = String(objectiveDefinition?.id || "");
        if (!objectiveId) continue;
        if (materializedObjectiveIds.has(objectiveId)) throw new Error(`Generated job objective id collision during load: ${objectiveId}`);
        const objective = clone(objectiveDefinition);
        objective.status = Object.prototype.hasOwnProperty.call(objectiveRuntime.statusById || {}, objectiveId) ? objectiveRuntime.statusById[objectiveId] : objectiveDefinition.initialStatus || objectiveDefinition.status || "hidden";
        if (objectiveRuntime.selectedOutcomeById?.[objectiveId]) objective.selected_outcome_id = objectiveRuntime.selectedOutcomeById[objectiveId];
        if (objectiveRuntime.selectedOutcomeMessageById?.[objectiveId]) objective.selected_outcome_message_id = objectiveRuntime.selectedOutcomeMessageById[objectiveId];
        if (objectiveRuntime.selectedChoiceById?.[objectiveId]) objective.selected_choice_id = objectiveRuntime.selectedChoiceById[objectiveId];
        if (objectiveRuntime.selectedChoiceTitleById?.[objectiveId]) objective.selected_choice_title = objectiveRuntime.selectedChoiceTitleById[objectiveId];
        if (objectiveRuntime.selectedOutputById?.[objectiveId]) objective.selected_output_id = objectiveRuntime.selectedOutputById[objectiveId];
        if (objectiveRuntime.progressNotesById?.[objectiveId] != null) objective.progress_notes = clone(objectiveRuntime.progressNotesById[objectiveId]);
        state.objectives.items.push(objective);
        materializedObjectiveIds.add(objectiveId);
      }
    }
    state.world_map ||= {};
    state.world_map.locations = {};
    const worldMapControl = rowMap.get(runtimeDirtyKey("world-map", "current"));
    if (worldMapControl) Object.assign(state.world_map, clone(worldMapControl));
    for (const row of rows.filter(item => item.kind === "location")) {
      const definitionId = String(row.value?.definitionId || row.recordId);
      const base = definition.locationDefinitionsById?.[row.recordId] || runtimeDefinitions.locationsById?.[definitionId];
      if (!base) throw new Error(`Location ${row.recordId} is missing definition ${definitionId}.`);
      state.world_map.locations[row.recordId] = applyRuntimeOverlay(base, row.value?.overlay || null);
      if (definitionId !== row.recordId) state.world_map.locations[row.recordId].definition_id = definitionId;
    }
    state.timed_events = Object.fromEntries(rows.filter(item => item.kind === "timed-event").map(item => [item.recordId, applyRuntimeOverlay(definition.timedEventDefinitionsById?.[item.recordId] || {}, item.value?.overlay || null)]));
    state.story_shops = Object.fromEntries(rows.filter(item => item.kind === "shop").map(item => [item.recordId, applyRuntimeOverlay(definition.shopDefinitionsById?.[item.recordId] || {}, item.value?.overlay || null)]));
    state.reward_bundles = clone(definition.rewardDefinitionsById || {});
    state.reward_templates = clone(definition.rewardTemplatesById || {});
    state.character_shop_cost_templates = clone(definition.characterShopCostTemplatesById || {});
    return {
      state,
      runtimeDefinitions,
      objectiveRuntime,
      rewardRuntime,
      storyRulesRuntime,
      jobRuntime
    };
  }
  async function loadSaveIntoRuntime(saveId = "", options = {}) {
    const id = String(saveId || "").trim();
    const storedIndexRecord = findSaveIndexRecord(id);
    if (!id || !storedIndexRecord) throw new Error("Saved game was not found.");
    if (!app.persistence?.started || !/^\d+$/.test(id)) throw new Error("Only current normalized EmberAdventures saves can be loaded.");
    {
      cancelScheduledActiveGameSave();
      if (app.persistence.activeSaveState?.saveId !== Number(id)) {
        if (app.persistence.activeSaveState) await app.persistence.closeActiveSave();
        await app.persistence.activateSave(Number(id));
      }
      const [reconstructed, loaded] = await Promise.all([app.library.reconstructRuntimeSave(Number(id)), app.persistence.loadSave(Number(id), 40)]);
      const indexRecord = saveIndexRecordFromStoredHeader(reconstructed.header, {
        title: reconstructed.definition?.metadata?.title || reconstructed.header.displayName
      });
      app.saveSessionActive = false;
      cancelSaveProjectionFlush();
      app.storyDefinition = readonlyDefinitionView(reconstructed.definition);
      app.state = reconstructed.state;
      app.runtimeDefinitions = reconstructed.runtimeDefinitions || {
        jobsById: {},
        charactersById: {},
        locationsById: {}
      };
      rebuildRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
      app.objectiveRuntime = reconstructed.objectiveRuntime;
      app.rewardRuntime = reconstructed.rewardRuntime;
      app.storyRulesRuntime = storyRulesRuntimeFromState(app.state, app.storyDefinition);
      app.jobRuntime = runtimeJobAggregateFromState(app.state);
      app.state.meta ||= {};
      app.state.meta.save_id = id;
      app.state.meta.definition_revision_id = reconstructed.definition.revisionId;
      app.state.meta.definition_content_hash = reconstructed.definition.contentHash;
      app.messages = (loaded.recordsByStore?.messages || []).map(runtimeMessageFromStoredRow);
      app.images = safeImageHistoryForStorage(reconstructed.images || []);
      app.snapshots = Array.isArray(reconstructed.snapshots) ? reconstructed.snapshots : [];
      app.saveSessionContext = {
        storyId: reconstructed.header.storyId,
        revisionId: reconstructed.header.revisionId
      };
      app.saveSessionActive = true;
      initializeSaveProjectionState();
      assertExactMessageStorage();
      setActiveSaveId(id);
      app.existingGameMessagePage = loaded.messagePage || null;
      if (options.scrollChatToBottom === true) {
        app.newGameChatScrollToTop = false;
        app.existingGameChatScrollToBottom = true;
      }
      return indexRecord;
    }
    runtimeAggregateDirtyTracker.baselineRequired = false;
    runtimeAggregateDirtyTracker.records.clear();
    runtimeAggregateDirtyTracker.messages.clear();
    runtimeAggregateDirtyTracker.snapshots.clear();
    runtimeAggregateDirtyTracker.images.clear();
    runtimeAggregateDirtyTracker.lastPersistedRecordKeys = new Set((saveRecord.records || []).map(row => runtimeDirtyKey(row.kind, row.recordId)));
    runtimeAggregateDirtyTracker.lastPersistedMessageIds = new Set(app.messages.map(message => String(message?.id ?? message?.entryId ?? "")));
    runtimeAggregateDirtyTracker.lastPersistedSnapshotIds = new Set(app.snapshots.map(snapshot => snapshot.id));
    runtimeAggregateDirtyTracker.lastPersistedImageIds = new Set(app.images.map(image => String(image?.id ?? image?.imageId ?? "")));
    app.persistenceRevisions[`save:${id}`] = {
      runtimeRevision: Number(saveRecord.header?.durableRevision) || 0,
      queuedRevision: Number(saveRecord.header?.durableRevision) || 0,
      durableRevision: Number(saveRecord.header?.durableRevision) || 0,
      error: ""
    };
    app.profileImagesBootstrapped = false;
    if (options.scrollChatToBottom === true) {
      app.newGameChatScrollToTop = false;
      app.existingGameChatScrollToBottom = true;
    }
    assertExactMessageStorage();
    refreshKeptImageRuntimeSet();
    setActiveSaveId(id);
    cancelDirectObjectiveChoiceAutoOpen();
    app.directObjectiveChoiceAutoOpenKey = directObjectiveChoiceAutoOpenKey(app.state);
    await persistActiveSavePointer();
    return indexRecord;
  }
  async function createNewActiveSave(reason = "new game", options = {}) {
    cancelScheduledActiveGameSave();
    if (app.persistence?.activeSaveState) {
      await flushRuntimeSaveProjections();
      await app.persistence.closeActiveSave();
    }
    app.saveSessionActive = false;
    cancelSaveProjectionFlush();
    const loadedProfileImages = exactProfileImageStore(await loadPerRecordLibrary(PROFILE_IMAGE_KEY, [])).filter(image => String(image.owner_name).trim() !== "Player");
    const incomingProfileImages = exactProfileImageStore(Array.isArray(options.profileImages) ? options.profileImages : []).filter(image => String(image.owner_name).trim() !== "Player");
    const profileImagesById = new Map(loadedProfileImages.map(image => [image.id, image]));
    const changedIncomingProfileImages = [];
    for (const image of incomingProfileImages) {
      const stored = profileImagesById.get(image.id);
      if (!stored || stableJsonString(stored) !== stableJsonString(image)) changedIncomingProfileImages.push(image);
      profileImagesById.set(image.id, image);
    }
    app.profileImages = exactProfileImageStore([...profileImagesById.values()]);
    // Prepare the replacement while detached from the observed runtime.
    let nextState = clone(options.state || defaultState);
    if (devSmokeSuiteState().running) {
      nextState.meta ||= {};
      nextState.meta.smoke_test_runtime = true;
    }
    let insertedStructuralFreeplay = false;
    nextState.objectives ||= {
      active_id: "",
      focus_id: "",
      items: []
    };
    if (!Array.isArray(nextState.objectives.items) || !nextState.objectives.items.length) {
      insertedStructuralFreeplay = true;
      nextState.objectives = {
        ...nextState.objectives,
        active_id: "generated-freeplay",
        focus_id: "generated-freeplay",
        items: [{
          id: "generated-freeplay",
          title: "Continue the Adventure",
          type: "story",
          status: "active",
          summary: "Continue this open-ended adventure.",
          while_active_guidance: "Respond naturally to the player and continue the current scene.",
          completion_control: "player",
          completion_criteria: "Complete when the player deliberately ends this open-ended adventure.",
          completion_instruction: "Conclude the current adventure in a way that follows the player's action.",
          next_objectives: [{
            id: "generated-freeplay-ending",
            completion_instruction: "Conclude the current adventure in a way that follows the player's action.",
            rewards: [],
            ending_type: "freeplay",
            ending_message: "The adventure continues in freeplay."
          }]
        }]
      };
    }
    nextState = materializeRuntimeSavePresentations(nextState);
    nextState = materializeRuntimeDisplayReferences(nextState, nextState);
    nextState.meta ||= {};
    finalizeRuntimeCharacterNameKeys(nextState);
    const previousProjectionSuppression = app.suppressSaveProjections;
    app.suppressSaveProjections = true;
    try {
      app.state = nextState;
    } finally {
      app.suppressSaveProjections = previousProjectionSuppression;
    }
    cancelDirectObjectiveChoiceAutoOpen();
    app.directObjectiveChoiceAutoOpenKey = "";
    app.messages = materializeRuntimeDisplayReferences(Array.isArray(options.messages) ? clone(options.messages) : [], app.state);
    app.images = Array.isArray(options.images) ? clone(options.images) : [];
    if (changedIncomingProfileImages.length) {
      saveProfileImageRecordsNow(changedIncomingProfileImages, "new active save profile images merged");
      await app.work.flush(`library:${libraryRecordStorageType(PROFILE_IMAGE_KEY)}`);
    }
    app.snapshots = Array.isArray(options.snapshots) ? clone(options.snapshots) : [];
    app.profileImagesBootstrapped = false;
    app.runtimeDefinitions = {
      jobsById: {},
      charactersById: {},
      locationsById: {}
    };
    const compiledDefinition = await compileStoryDefinitionRuntimeInWorker(app.state, {
      definitionRevisionId: options.definitionRevisionId || "",
      onProgress: options.onDefinitionProgress || (message => setStatus(String(message || "Building story definition")))
    });
    adoptWorkerCompiledStoryDefinition(compiledDefinition, app.state);
    const generatedTitle = textSlot(app.state?.meta?.story_source?.title || app.state?.location?.universe, "Generated Adventure");
    const definition = storyDefinitionWithInitialRuntimeSeed();
    const selectedPlayerId = textSlot(app.state?.player?.id, "");
    if (!selectedPlayerId) throw new Error("Generated adventure player id is required.");
    const normalizedGame = await app.library.materializeRuntimeGame({
      storyId: definition.storyId,
      revisionId: definition.revisionId,
      contentHash: definition.contentHash,
      title: generatedTitle,
      state: clone(app.state),
      messages: clone(app.messages),
      titleImageId: textSlot(options.titleImageId, "")
    });
    await app.persistence.putStoryDefinition(normalizedGame.immutableStory.definition, normalizedGame.immutableStory.compiledIndexes);
    if (insertedStructuralFreeplay) {
      for (const entry of normalizedGame.initialRecords) {
        if (entry.storeName === "objectiveControl") {
          entry.record.activeMainObjectiveId = null;
          entry.record.focusedSideObjectiveId = null;
        }
        if (entry.storeName === "objectiveRuntime" && entry.record.objectiveId === "generated-freeplay") entry.record.status = "complete";
      }
    }
    const created = await app.persistence.createSave({
      ...normalizedGame.header,
      displayName: uniqueGameSaveName(generatedTitle)
    }, normalizedGame.initialRecords);
    await app.persistence.activateSave(created.saveId);
    const id = String(created.saveId);
    await loadSaveIndexRecords();
    await loadSaveIntoRuntime(id, {
      showCompatibilityNotice: false,
      scrollChatToBottom: false
    });
    if (insertedStructuralFreeplay) {
      updateObjectiveRuntime("generated-freeplay", runtime => {
        runtime.noCurrent = true;
        runtime.activeMainObjectiveId = "";
        runtime.focusedSideObjectiveId = "";
        runtime.statusById["generated-freeplay"] = "complete";
        app.state.objectives.no_current = true;
        app.state.objectives.active_id = "";
        app.state.objectives.focus_id = "";
      });
      await flushRuntimeSaveProjections();
    }
    return id;
  }
  const RUNTIME_DIRECT_ROOT_KINDS = Object.freeze({
    meta: "meta",
    player: "player",
    scene: "scene",
    location: "location-runtime",
    world_flags: "world-runtime",
    story_inventory: "inventory",
    npc_directory: "npc-directory",
    future_cast: "future-cast-runtime",
    story_clock: "story-clock",
    story_pacing: "story-pacing",
    story_memory: "story-memory",
    numeric_precision: "numeric-precision",
    temp_speakers: "temp-speakers",
    progression: "progression-runtime",
    story_generated_npc_pool: "generated-npc-pool"
  });
  function authoredCharacterDefinitionForRuntime(character = {}, fallbackName = "") {
    const definitions = app.storyDefinition?.characterDefinitionsById || {};
    const explicitId = String(character?.id || character?.character_id || "").trim();
    if (explicitId && definitions[explicitId]) return definitions[explicitId];
    const normalizedName = normalizeNameForMatch?.(character?.name || fallbackName) || String(character?.name || fallbackName || "").toLowerCase();
    return Object.values(definitions).find(definition => (normalizeNameForMatch?.(definition?.name) || String(definition?.name || "").toLowerCase()) === normalizedName) || null;
  }
  function runtimeCharacterRecordValue(recordId = "", state = app.state) {
    const name = String(recordId || "");
    const character = state?.characters?.[name];
    if (!character) return null;
    const authored = authoredCharacterDefinitionForRuntime(character, name);
    const definitionId = authored?.id || ensureRuntimeCharacterDefinition(character, name);
    const baseDefinition = authored || app.runtimeDefinitions.charactersById?.[definitionId] || null;
    return {
      name,
      definitionId,
      runtime: characterRuntimeFields(character, definitionId, baseDefinition)
    };
  }
  function runtimeJobAggregateFromState(state = app.state) {
    const activeJobsById = {};
    const runtimeByJobId = {};
    for (const [jobKey, job] of Object.entries(state?.active_generated_jobs || {})) {
      const jobId = String(job?.id || jobKey || "").trim();
      if (!jobId) continue;
      const definitionId = ensureRuntimeJobDefinition(job, jobId);
      activeJobsById[jobId] = {
        definitionId
      };
      runtimeByJobId[jobId] = runtimeJobStateFromJob(job, definitionId);
    }
    app.jobRuntime = {
      activeJobsById,
      runtimeByJobId
    };
    return clone(app.jobRuntime);
  }
  function runtimeNpcRecordId(locationId = "", npcKey = "") {
    return JSON.stringify([String(locationId || ""), String(npcKey || "")]);
  }
  function parseRuntimeNpcRecordId(recordId = "") {
    const parsed = JSON.parse(String(recordId || ""));
    if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed[0] || !parsed[1]) throw new Error(`Invalid NPC runtime record id: ${recordId}.`);
    return {
      locationId: String(parsed[0]),
      npcKey: String(parsed[1])
    };
  }
  function runtimeNpcDirectoryRecordValue(state = app.state) {
    const directory = runtimeSaveCloneValue(state?.npc_directory || {
      locations: {}
    });
    for (const location of Object.values(directory.locations || {})) delete location.characters;
    return directory;
  }
  function runtimeNpcRecordValue(recordId = "", state = app.state) {
    const {
      locationId,
      npcKey
    } = parseRuntimeNpcRecordId(recordId);
    const source = state?.npc_directory?.locations?.[locationId]?.characters?.[npcKey];
    if (!source) return null;
    const npc = runtimeSaveCloneValue(source);
    if (isPlainObject(npc.full_character)) {
      const fullCharacter = source.full_character;
      const authored = authoredCharacterDefinitionForRuntime(fullCharacter, npcKey);
      const definitionId = authored?.id || ensureRuntimeCharacterDefinition(fullCharacter, npcKey);
      npc.definition_id = definitionId;
      npc.full_character_runtime = characterRuntimeFields(fullCharacter, definitionId, authored || app.runtimeDefinitions.charactersById?.[definitionId] || null);
      delete npc.full_character;
    }
    return {
      locationId,
      npcKey,
      npc
    };
  }
  function materializeNpcDirectoryRecord(record = {}, definitions = {}, rows = []) {
    const directory = runtimeSaveCloneValue(record || {
      locations: {}
    });
    directory.locations ||= {};
    if (Object.values(directory.locations).some(location => Object.prototype.hasOwnProperty.call(location || {}, "characters"))) throw new Error("Saved NPC directory uses the obsolete aggregate character layout. Delete or recreate the save.");
    for (const row of rows.filter(item => item.kind === "npc")) {
      const locationId = String(row.value?.locationId || "");
      const npcKey = String(row.value?.npcKey || "");
      if (!locationId || !npcKey || !isPlainObject(row.value?.npc)) throw new Error(`NPC runtime row ${row.recordId} is invalid.`);
      directory.locations[locationId] ||= {
        label: locationId
      };
      directory.locations[locationId].characters ||= {};
      directory.locations[locationId].characters[npcKey] = runtimeSaveCloneValue(row.value.npc);
    }
    for (const location of Object.values(directory.locations || {})) {
      location.characters ||= {};
      for (const [name, npc] of Object.entries(location.characters)) {
        const definitionId = String(npc?.definition_id || npc?.full_character_runtime?.definitionId || "");
        if (!definitionId || !npc?.full_character_runtime) continue;
        const definition = definitions[definitionId];
        if (!definition) throw new Error(`NPC ${name} is missing character definition ${definitionId}.`);
        const runtime = runtimeSaveCloneValue(npc.full_character_runtime);
        const resolvedDefinition = applyRuntimeOverlay(definition, runtime.definitionOverlay || null);
        delete runtime.definitionOverlay;
        delete runtime.definitionId;
        npc.full_character = {
          ...resolvedDefinition,
          ...runtime,
          definition_id: definitionId,
          name: npc.name || resolvedDefinition.name || name
        };
        synchronizeRuntimeNpcIdentity(npc, name);
        delete npc.full_character_runtime;
      }
    }
    return directory;
  }
  function futureCastRuntimeRecordValue(state = app.state) {
    const authored = {
      enabled: app.storyDefinition?.futureCastEnabledDefault !== false,
      items: app.storyDefinition?.futureCastDefinitionsById || {}
    };
    const current = runtimeSaveCloneValue(state?.future_cast || {
      enabled: true,
      items: {}
    });
    for (const [id, entry] of Object.entries(current.items || {})) {
      const definitionId = String(entry?.character_definition_id || entry?.full_character?.definition_id || "");
      if (isPlainObject(entry?.full_character)) {
        const authoredCharacter = authoredCharacterDefinitionForRuntime(entry.full_character, entry.name || id);
        const resolvedId = authoredCharacter?.id || definitionId || ensureRuntimeCharacterDefinition(entry.full_character, entry.name || id);
        entry.character_definition_id = resolvedId;
        entry.full_character_runtime = characterRuntimeFields(entry.full_character, resolvedId, authoredCharacter || app.runtimeDefinitions.charactersById?.[resolvedId] || null);
        delete entry.full_character;
      }
    }
    return {
      overlay: runtimeOverlayDiff(authored, current)
    };
  }
  function materializeFutureCastRuntime(record = {}, definition = {}, definitions = {}) {
    const authored = {
      enabled: definition.futureCastEnabledDefault !== false,
      items: runtimeSaveCloneValue(definition.futureCastDefinitionsById || {})
    };
    const futureCast = applyRuntimeOverlay(authored, record?.overlay || null);
    for (const [id, entry] of Object.entries(futureCast.items || {})) {
      const definitionId = String(entry?.character_definition_id || entry?.full_character_runtime?.definitionId || "");
      if (!definitionId || !entry?.full_character_runtime) continue;
      const characterDefinition = definitions[definitionId];
      if (!characterDefinition) throw new Error(`Future-cast entry ${id} is missing character definition ${definitionId}.`);
      const runtime = runtimeSaveCloneValue(entry.full_character_runtime);
      const resolvedDefinition = applyRuntimeOverlay(characterDefinition, runtime.definitionOverlay || null);
      delete runtime.definitionOverlay;
      delete runtime.definitionId;
      entry.full_character = {
        ...resolvedDefinition,
        ...runtime,
        definition_id: definitionId,
        name: entry.name || resolvedDefinition.name || id
      };
      delete entry.full_character_runtime;
    }
    return futureCast;
  }
  function runtimeWorldMapControlValue(state = app.state) {
    const source = clone(state?.world_map || {});
    delete source.locations;
    return source;
  }
  function runtimeLocationRecordValue(recordId = "", state = app.state) {
    const id = String(recordId || "");
    const location = state?.world_map?.locations?.[id];
    if (!location) return null;
    let definitionId = id;
    let authored = app.storyDefinition?.locationDefinitionsById?.[id];
    if (!authored) {
      const existingDefinitionId = String(location.definition_id || "");
      definitionId = existingDefinitionId || generatedPersistentId("runtime-location");
      authored = app.runtimeDefinitions.locationsById[definitionId];
      if (!authored && !existingDefinitionId) assertGeneratedIdAvailable(definitionId, "runtime location");
      if (!authored) {
        authored = deepFreezeDefinition({
          id: definitionId,
          ...clone(location)
        });
        app.runtimeDefinitions.locationsById[definitionId] = authored;
        markRuntimeRecordDirty("runtime-definition", `location:${definitionId}`);
      }
      if (!location.definition_id) location.definition_id = definitionId;
    }
    return {
      id,
      definitionId,
      overlay: runtimeOverlayDiff(authored || {}, location)
    };
  }
  function runtimeRecordValue(kind = "state-root", recordId = "current", state = app.state) {
    const id = String(recordId || "current");
    if (kind === "character") return runtimeCharacterRecordValue(id, state);
    if (kind === "objective-runtime") {
      const startedAt = perfNow();
      if (app.objectiveRuntimeNeedsFullSync) throw new Error("Objective runtime requires an unsupported full rebuild. " + "Fix the mutation path instead of scanning the immutable objective tree.");
      const value = clone(app.objectiveRuntime || createEmptyObjectiveRuntime());
      app.performanceMetrics.objectiveRuntimeMaterializeMs = Math.max(0, perfNow() - startedAt);
      try {
        app.performanceMetrics.objectiveRuntimeEstimatedBytes = JSON.stringify(value).length;
      } catch {
        app.performanceMetrics.objectiveRuntimeEstimatedBytes = 0;
      }
      return value;
    }
    if (kind === "reward-runtime") {
      return clone(app.rewardRuntime);
    }
    if (kind === "job-runtime") return runtimeJobAggregateFromState(state);
    if (kind === "story-rules-runtime") {
      app.storyRulesRuntime = storyRulesRuntimeFromState(state, app.storyDefinition);
      return clone(app.storyRulesRuntime);
    }
    if (kind === "runtime-definition") return runtimeDefinitionRecordValue(id);
    if (kind === "world-map") return runtimeWorldMapControlValue(state);
    if (kind === "location") return runtimeLocationRecordValue(id, state);
    if (kind === "npc-directory") return runtimeNpcDirectoryRecordValue(state);
    if (kind === "npc") return runtimeNpcRecordValue(id, state);
    if (kind === "future-cast-runtime") return futureCastRuntimeRecordValue(state);
    if (kind === "timed-event") return {
      id,
      overlay: runtimeOverlayDiff(app.storyDefinition?.timedEventDefinitionsById?.[id] || {}, state?.timed_events?.[id] ?? {})
    };
    if (kind === "shop") return {
      id,
      overlay: runtimeOverlayDiff(app.storyDefinition?.shopDefinitionsById?.[id] || {}, state?.story_shops?.[id] ?? {})
    };
    if (kind === "immutable-definition") throw new Error(`Immutable story definition data was mutated: ${id}`);
    const root = Object.entries(RUNTIME_DIRECT_ROOT_KINDS).find(([, value]) => value === kind)?.[0];
    if (root) {
      const value = clone(state?.[root] ?? null);
      if (root === "meta" && value) {
        delete value.player_preferences;
        delete value.title_image_html;
      }
      if (root === "scene" && value) delete value.objective;
      if (root === "progression" && value) delete value.current_goal;
      stripEmbeddedProfileImageHtml(value);
      return value;
    }
    if (kind === "state-root") {
      const value = clone(state?.[id] ?? null);
      stripEmbeddedProfileImageHtml(value);
      return value;
    }
    return null;
  }
  function allRuntimeRecordDescriptors(state = app.state) {
    const descriptors = [];
    for (const kind of Object.values(RUNTIME_DIRECT_ROOT_KINDS)) descriptors.push({
      kind,
      recordId: "current"
    });
    descriptors.push({
      kind: "world-map",
      recordId: "current"
    }, {
      kind: "objective-runtime",
      recordId: "current"
    }, {
      kind: "reward-runtime",
      recordId: "current"
    }, {
      kind: "job-runtime",
      recordId: "current"
    }, {
      kind: "story-rules-runtime",
      recordId: "current"
    });
    for (const name of Object.keys(state?.characters || {})) descriptors.push({
      kind: "character",
      recordId: name
    });
    for (const [locationId, location] of Object.entries(state?.npc_directory?.locations || {})) for (const npcKey of Object.keys(location?.characters || {})) descriptors.push({
      kind: "npc",
      recordId: runtimeNpcRecordId(locationId, npcKey)
    });
    for (const id of Object.keys(state?.world_map?.locations || {})) descriptors.push({
      kind: "location",
      recordId: id
    });
    for (const id of Object.keys(state?.timed_events || {})) descriptors.push({
      kind: "timed-event",
      recordId: id
    });
    for (const id of Object.keys(state?.story_shops || {})) descriptors.push({
      kind: "shop",
      recordId: id
    });
    for (const [root, value] of Object.entries(state || {})) {
      if (root in RUNTIME_DIRECT_ROOT_KINDS || ["characters", "world_map", "objectives", "active_generated_jobs", "story_rules", "timed_events", "story_shops", "reward_bundles", "reward_templates", "character_shop_cost_templates", "story_generated_npc_pool"].includes(root)) continue;
      if (value !== undefined) descriptors.push({
        kind: "state-root",
        recordId: root
      });
    }
    for (const id of Object.keys(app.runtimeDefinitions.jobsById || {})) descriptors.push({
      kind: "runtime-definition",
      recordId: `job:${id}`
    });
    for (const id of Object.keys(app.runtimeDefinitions.charactersById || {})) descriptors.push({
      kind: "runtime-definition",
      recordId: `character:${id}`
    });
    for (const id of Object.keys(app.runtimeDefinitions.locationsById || {})) descriptors.push({
      kind: "runtime-definition",
      recordId: `location:${id}`
    });
    const unique = new Map();
    for (const descriptor of descriptors) unique.set(runtimeDirtyKey(descriptor.kind, descriptor.recordId), descriptor);
    return [...unique.values()];
  }
  function materializeRuntimeRecordRows(descriptors = [], state = app.state) {
    const rows = [];
    for (const descriptor of descriptors) {
      const value = runtimeRecordValue(descriptor.kind, descriptor.recordId, state);
      if (value === undefined) continue;
      rows.push({
        kind: descriptor.kind,
        recordId: descriptor.recordId,
        value
      });
    }
    return rows;
  }
  function runtimeRecordOwnerIsDirty(kind = "state-root", recordId = "current") {
    if (runtimeAggregateDirtyTracker.baselineRequired) return true;
    return runtimeAggregateDirtyTracker.records.has(runtimeDirtyKey(kind, recordId));
  }
  function dirtyRuntimeRecordIds(kind = "state-root") {
    if (runtimeAggregateDirtyTracker.baselineRequired) return null;
    const ids = [];
    for (const entry of runtimeAggregateDirtyTracker.records.values()) {
      if (entry.kind === kind && entry.operation !== "delete") ids.push(entry.recordId);
    }
    return ids;
  }
  function syncRuntimeArchitectureBeforeSave(options = {}) {
    let full = options.full === true || runtimeAggregateDirtyTracker.baselineRequired;
    if (!app.storyDefinition || app.storyDefinition.revisionId !== app.state?.meta?.definition_revision_id) {
      throw new Error("Active save has no matching immutable story definition. Reopen the save before saving.");
    }
    if (app.objectiveRuntimeNeedsFullSync) throw new Error("Objective runtime requires an unsupported full rebuild. " + "Fix the mutation path instead of scanning the immutable objective tree.");
    if (full || runtimeRecordOwnerIsDirty("story-rules-runtime", "current")) app.storyRulesRuntime = storyRulesRuntimeFromState(app.state, app.storyDefinition);
    if (full || runtimeRecordOwnerIsDirty("job-runtime", "current")) runtimeJobAggregateFromState(app.state);
    // Generated character definitions referenced by NPC/future-cast runtime
    // must be created before the dirty batch is captured. Otherwise the
    // runtime row could commit one revision before its immutable definition.
    if (full || runtimeRecordOwnerIsDirty("npc-directory", "current")) runtimeNpcDirectoryRecordValue(app.state);
    const npcRecordIds = full ? allRuntimeRecordDescriptors(app.state).filter(item => item.kind === "npc").map(item => item.recordId) : dirtyRuntimeRecordIds("npc") || [];
    for (const recordId of npcRecordIds) runtimeNpcRecordValue(recordId, app.state);
    if (full || runtimeRecordOwnerIsDirty("future-cast-runtime", "current")) futureCastRuntimeRecordValue(app.state);
    const characterNames = full ? Object.keys(app.state?.characters || {}) : dirtyRuntimeRecordIds("character") || [];
    for (const name of characterNames) {
      const character = app.state?.characters?.[name];
      if (character && !authoredCharacterDefinitionForRuntime(character, name)) ensureRuntimeCharacterDefinition(character, name);
    }
    const locationIds = full ? Object.keys(app.state?.world_map?.locations || {}) : dirtyRuntimeRecordIds("location") || [];
    for (const id of locationIds) if (app.state?.world_map?.locations?.[id]) runtimeLocationRecordValue(id, app.state);
  }
  function storyDefinitionWithInitialRuntimeSeed() {
    if (!app.storyDefinition?.initialRuntimeTemplate) throw new Error("The immutable story definition must be compiled by the background worker before saving.");
    return app.storyDefinition;
  }
  async function ensureStoryDefinitionPersisted() {
    // Resolve any new definition revision before persisting the header that
    // references it. This prevents a state/definition mismatch from writing
    // a save that points at an unpersisted revision.
    syncRuntimeArchitectureBeforeSave();
    const definition = storyDefinitionWithInitialRuntimeSeed();
    app.persistedStoryDefinitionRevisions ||= new Set();
    if (app.persistedStoryDefinitionRevisions.has(definition.revisionId)) return definition;
    await persistenceWorkerRequest("story-definition-put", {
      definition: clone(definition)
    });
    app.persistedStoryDefinitionRevisions.add(definition.revisionId);
    return definition;
  }
  function currentMessageRecord(messageId = "") {
    const id = String(messageId || "");
    return (app.messages || []).find(message => String(message?.id ?? message?.entryId ?? "") === id) || null;
  }
  function currentSnapshotRecord(snapshotId = "") {
    const id = String(snapshotId || "");
    return (app.snapshots || []).find(snapshot => snapshot.id === id) || null;
  }
  function currentImageRecord(imageId = "") {
    const id = String(imageId || "");
    return (app.images || []).find(image => String(image?.id ?? image?.imageId ?? "") === id) || null;
  }
  function beginRuntimePersistenceBatch(reason = "active game save") {
    syncRuntimeArchitectureBeforeSave();
    const mutationOperations = Object.values(runtimeSaveMutationTracker.operations).reduce((total, operations) => total + (operations?.length || 0), 0);
    const mutationUniquePaths = Object.values(runtimeSaveMutationTracker.operationIndexByKind).reduce((total, index) => total + (index?.size || 0), 0);
    app.performanceMetrics.mutationJournalOperations = mutationOperations;
    app.performanceMetrics.mutationJournalUniquePaths = mutationUniquePaths;
    try {
      app.performanceMetrics.mutationJournalEstimatedBytes = JSON.stringify(runtimeSaveMutationTracker.operations).length;
    } catch {
      app.performanceMetrics.mutationJournalEstimatedBytes = 0;
    }
    const batchId = `runtime-batch-${runtimeAggregateDirtyTracker.nextBatchId++}`;
    const baseline = runtimeAggregateDirtyTracker.baselineRequired;
    const baselineReason = runtimeAggregateDirtyTracker.baselineReason || "";
    if (baseline) stateTrace("persistence baseline materializing", {
      label: reason,
      baselineReason,
      summary: `Full persistence baseline required: ${baselineReason || "reason unavailable"}.`
    });
    let recordEntries;
    let messageEntries;
    let snapshotEntries;
    let imageEntries;
    if (baseline) {
      const currentRecords = new Map(allRuntimeRecordDescriptors(app.state).map(item => [runtimeDirtyKey(item.kind, item.recordId), {
        ...item,
        operation: "put"
      }]));
      for (const key of runtimeAggregateDirtyTracker.lastPersistedRecordKeys) {
        if (currentRecords.has(key)) continue;
        const [kind, recordId] = String(key).split("\u001f", 2);
        currentRecords.set(key, {
          kind,
          recordId,
          operation: "delete"
        });
      }
      recordEntries = [...currentRecords.values()];
      const currentMessageIds = new Set((app.messages || []).map(message => String(message?.id ?? message?.entryId ?? "")));
      messageEntries = [...[...currentMessageIds].map(id => ({
        id,
        operation: "put"
      })), ...[...runtimeAggregateDirtyTracker.lastPersistedMessageIds].filter(id => !currentMessageIds.has(id)).map(id => ({
        id,
        operation: "delete"
      }))];
      const currentSnapshotIds = new Set((app.snapshots || []).map(snapshot => snapshot.id));
      snapshotEntries = [...[...currentSnapshotIds].map(id => ({
        id,
        operation: "put"
      })), ...[...runtimeAggregateDirtyTracker.lastPersistedSnapshotIds].filter(id => !currentSnapshotIds.has(id)).map(id => ({
        id,
        operation: "delete"
      }))];
      const currentImageIds = new Set((app.images || []).map(image => String(image?.id ?? image?.imageId ?? "")));
      imageEntries = [...[...currentImageIds].map(id => ({
        id,
        operation: "put"
      })), ...[...runtimeAggregateDirtyTracker.lastPersistedImageIds].filter(id => !currentImageIds.has(id)).map(id => ({
        id,
        operation: "delete"
      }))];
    } else {
      recordEntries = [...runtimeAggregateDirtyTracker.records.values()];
      messageEntries = [...runtimeAggregateDirtyTracker.messages.values()];
      snapshotEntries = [...runtimeAggregateDirtyTracker.snapshots.values()];
      imageEntries = [...runtimeAggregateDirtyTracker.images.values()];
    }
    runtimeAggregateDirtyTracker.baselineRequired = false;
    runtimeAggregateDirtyTracker.baselineReason = "";
    runtimeAggregateDirtyTracker.records.clear();
    runtimeAggregateDirtyTracker.messages.clear();
    runtimeAggregateDirtyTracker.snapshots.clear();
    runtimeAggregateDirtyTracker.images.clear();
    const batch = {
      id: batchId,
      reason,
      baseline,
      baselineReason,
      mutationRevision: runtimeSaveMutationTracker.revision,
      recordEntries,
      messageEntries,
      snapshotEntries,
      imageEntries
    };
    runtimeAggregateDirtyTracker.inFlight.set(batchId, batch);
    app.performanceMetrics.dirtyRecordCount = recordEntries.length;
    return batch;
  }
  function restoreRuntimePersistenceBatch(batch) {
    if (!batch) return;
    runtimeAggregateDirtyTracker.inFlight.delete(batch.id);
    if (batch.baseline) requireRuntimePersistenceBaseline(`failed baseline batch ${batch.id} restored`);
    // Mutations may occur while a batch is in flight. On failure, restore
    // only ownership entries that have not since been replaced by newer
    // puts/deletes; the live mutation always wins over the failed batch.
    for (const entry of batch.recordEntries || []) {
      const key = runtimeDirtyKey(entry.kind, entry.recordId);
      if (!runtimeAggregateDirtyTracker.records.has(key)) runtimeAggregateDirtyTracker.records.set(key, entry);
    }
    for (const entry of batch.messageEntries || []) if (!runtimeAggregateDirtyTracker.messages.has(entry.id)) runtimeAggregateDirtyTracker.messages.set(entry.id, entry);
    for (const entry of batch.snapshotEntries || []) if (!runtimeAggregateDirtyTracker.snapshots.has(entry.id)) runtimeAggregateDirtyTracker.snapshots.set(entry.id, entry);
    for (const entry of batch.imageEntries || []) if (!runtimeAggregateDirtyTracker.images.has(entry.id)) runtimeAggregateDirtyTracker.images.set(entry.id, entry);
  }
  function commitRuntimePersistenceBatch(batch) {
    if (!batch) return;
    runtimeAggregateDirtyTracker.inFlight.delete(batch.id);
    for (const entry of batch.recordEntries || []) {
      const key = runtimeDirtyKey(entry.kind, entry.recordId);
      if (entry.operation === "delete") runtimeAggregateDirtyTracker.lastPersistedRecordKeys.delete(key);else runtimeAggregateDirtyTracker.lastPersistedRecordKeys.add(key);
    }
    for (const entry of batch.messageEntries || []) {
      if (entry.operation === "delete") runtimeAggregateDirtyTracker.lastPersistedMessageIds.delete(entry.id);else runtimeAggregateDirtyTracker.lastPersistedMessageIds.add(entry.id);
    }
    for (const entry of batch.snapshotEntries || []) {
      if (entry.operation === "delete") runtimeAggregateDirtyTracker.lastPersistedSnapshotIds.delete(entry.id);else runtimeAggregateDirtyTracker.lastPersistedSnapshotIds.add(entry.id);
    }
    for (const entry of batch.imageEntries || []) {
      if (entry.operation === "delete") runtimeAggregateDirtyTracker.lastPersistedImageIds.delete(entry.id);else runtimeAggregateDirtyTracker.lastPersistedImageIds.add(entry.id);
    }
  }
  function saveBatchPayload(batch, saveId, indexRecord, revisionState, revision) {
    const requestedRecordPuts = (batch.recordEntries || []).filter(entry => entry.operation !== "delete");
    const recordDeletes = (batch.recordEntries || []).filter(entry => entry.operation === "delete").map(entry => ({
      kind: entry.kind,
      recordId: entry.recordId
    }));
    const keyedKinds = new Set(["character", "npc", "location", "timed-event", "shop", "runtime-definition"]);
    const records = [];
    for (const entry of requestedRecordPuts) {
      const value = runtimeRecordValue(entry.kind, entry.recordId, app.state);
      if ((value === null || value === undefined) && keyedKinds.has(entry.kind)) {
        recordDeletes.push({
          kind: entry.kind,
          recordId: entry.recordId
        });
        continue;
      }
      if (value === undefined) continue;
      records.push({
        kind: entry.kind,
        recordId: entry.recordId,
        value
      });
    }
    const messages = [];
    const messageDeletes = [];
    for (const entry of batch.messageEntries || []) {
      if (entry.operation === "delete") {
        messageDeletes.push(entry.id);
        continue;
      }
      const message = currentMessageRecord(entry.id);
      if (!message) {
        messageDeletes.push(entry.id);
        continue;
      }
      messages.push({
        messageId: entry.id,
        sequence: Number(message.entryId || message.id || 0),
        value: compactMessageForStorage(message)
      });
    }
    const snapshots = [];
    const snapshotDeletes = [];
    for (const entry of batch.snapshotEntries || []) {
      if (entry.operation === "delete") {
        snapshotDeletes.push(entry.id);
        continue;
      }
      const snapshot = currentSnapshotRecord(entry.id);
      if (!snapshot) {
        snapshotDeletes.push(entry.id);
        continue;
      }
      snapshots.push({
        snapshotId: entry.id,
        createdAt: snapshot.createdAt,
        value: snapshotForStorage(snapshot)
      });
    }
    const images = [];
    const imageDeletes = [];
    for (const entry of batch.imageEntries || []) {
      if (entry.operation === "delete") {
        imageDeletes.push({
          imageId: entry.id,
          ownerType: saveImageOwnerType(saveId)
        });
        continue;
      }
      const image = currentImageRecord(entry.id);
      if (!image) {
        imageDeletes.push({
          imageId: entry.id,
          ownerType: saveImageOwnerType(saveId)
        });
        continue;
      }
      images.push({
        imageId: entry.id,
        ownerType: saveImageOwnerType(saveId),
        value: clone(image)
      });
    }
    const now = new Date().toISOString();
    return {
      saveId,
      revision,
      baseRevision: Number(revisionState.durableRevision) || 0,
      header: {
        ...clone(indexRecord),
        saveId,
        definitionRevisionId: app.storyDefinition?.revisionId || "",
        definitionContentHash: app.storyDefinition?.contentHash || "",
        updatedAt: now
      },
      records,
      recordDeletes,
      messages,
      messageDeletes,
      snapshots,
      snapshotDeletes,
      images,
      imageDeletes
    };
  }
  function saveActiveGame(reason = "saved game", options = {}) {
    if (app.saveSessionActive) {
      scheduleSaveProjectionFlush();
      return true;
    }
    if (!app.state?.meta?.setup_complete && !options.allowCreate) return false;
    throw new Error("A current normalized save session is required before game state can be saved.");
    /* istanbul ignore next -- prerelease aggregate persistence is intentionally unreachable. */
    const existingId = activeSaveId();
    if (existingId && app.deletedSaveIds?.has?.(existingId)) return false;
    if (devSmokeSuiteState().running && !options.allowSmokeRestore) {
      if (app.state?.meta?.smoke_test_runtime) return false;
      if (existingId && app.smokeProtectedSaveIds instanceof Set && app.smokeProtectedSaveIds.has(existingId)) return false;
    }
    if (app.state?.meta?.smoke_test_runtime && !devSmokeSuiteState().running) {
      log("Smoke Save Refused", "Blocked a delayed smoke-test runtime from saving over the active game.", {
        level: "warning",
        type: "storage",
        details: {
          reason,
          activeSaveId: existingId
        }
      });
      return false;
    }
    if (!existingId) {
      if (!options.allowCreate) return false;
      setActiveSaveId(newSaveId("save"));
    }
    const saveId = activeSaveId();
    app.state.meta ||= {};
    app.state.meta.save_id = saveId;
    const indexRecord = saveIndexRecordFromRuntime(reason);
    setSaveIndexRecords([...saveIndexRecords().filter(record => record.saveId !== saveId), indexRecord]);
    const revisionState = app.persistenceRevisions[`save:${saveId}`] ||= {
      runtimeRevision: 0,
      queuedRevision: 0,
      durableRevision: 0,
      error: ""
    };
    const revision = ++revisionState.runtimeRevision;
    revisionState.queuedRevision = revision;
    const promise = app.work.enqueueOrdered(`save:${saveId}`, `persist aggregate save ${saveId}`, async () => {
      await ensureStoryDefinitionPersisted();
      const materializeStartedAt = perfNow();
      const batch = beginRuntimePersistenceBatch(reason);
      const payload = saveBatchPayload(batch, saveId, indexRecord, revisionState, revision);
      const materializeMs = Math.max(0, perfNow() - materializeStartedAt);
      app.performanceMetrics.autosaveMaterializeMs = materializeMs;
      if (materializeMs >= 8.34) perfConsole("active save batch materialized", {
        saveId,
        revision,
        ms: Math.round(materializeMs * 10) / 10,
        records: payload.records?.length || 0,
        messages: payload.messages?.length || 0,
        snapshots: payload.snapshots?.length || 0,
        images: payload.images?.length || 0,
        baseline: batch.baseline
      }, materializeMs >= 50 ? "warn" : "log");
      try {
        const started = perfNow();
        const result = await persistenceWorkerRequest("save-write-batch", payload);
        const totalSaveMs = Math.max(0, perfNow() - started);
        const workerMs = Math.max(0, Number(result?.workerMs) || 0);
        app.performanceMetrics.autosaveWorkerMs = workerMs;
        app.performanceMetrics.autosavePostMessageMs = Math.max(0, totalSaveMs - workerMs);
        app.performanceMetrics.autosavePayloadBytes = Number(result?.serializedPayloadBytes) || 0;
        app.performanceMetrics.recordsWritten += Number(result?.recordCount) || 0;
        app.performanceMetrics.messagesWritten += Number(result?.messageCount) || 0;
        app.performanceMetrics.snapshotsWritten += Number(result?.snapshotCount) || 0;
        app.performanceMetrics.imagesWritten += Number(result?.imageCount) || 0;
        if ((payload.records || []).some(row => row.kind === "objective-runtime")) app.performanceMetrics.objectiveRuntimeWriteMs = workerMs;
        revisionState.durableRevision = Number(result?.durableRevision) || revision;
        revisionState.error = "";
        const commitStartedAt = perfNow();
        commitRuntimePersistenceBatch(batch);
        clearCommittedRuntimeSaveMutations(batch.mutationRevision);
        const commitMs = Math.max(0, perfNow() - commitStartedAt);
        if (commitMs >= 8.34) perfConsole("active save batch committed", {
          saveId,
          revision,
          ms: Math.round(commitMs * 10) / 10,
          mutationRevision: batch.mutationRevision
        }, commitMs >= 50 ? "warn" : "log");
        await persistenceWorkerRequest("kv-set-json", {
          key: ACTIVE_SAVE_KEY,
          value: activeSavePointerForStorage()
        });
        perfConsole("aggregate save durable", {
          saveId,
          revision,
          records: Number(result?.recordCount) || 0,
          messages: Number(result?.messageCount) || 0,
          snapshots: Number(result?.snapshotCount) || 0,
          images: Number(result?.imageCount) || 0,
          baseline: batch.baseline,
          ms: Math.round(totalSaveMs),
          workerMs: Math.round(workerMs),
          materializeMs: Math.round(materializeMs * 10) / 10,
          commitMs: Math.round(commitMs * 10) / 10,
          payloadBytes: app.performanceMetrics.autosavePayloadBytes,
          worker: true
        });
        return true;
      } catch (error) {
        restoreRuntimePersistenceBatch(batch);
        throw error;
      }
    }, {
      coalesce: true
    });
    trackLargeStoragePromise(`save:${saveId}`, promise);
    const handleSaveFailure = (error = null) => {
      const failure = error instanceof Error ? error : new Error(revisionState.error || `Aggregate save ${saveId} did not complete successfully.`);
      revisionState.error = failure.message;
      app.activeGameSaveDirty = true;
      app.activeGameSavePendingReason = "retry failed active game save";
      recordStorageFailure(`save:${saveId}`, failure);
      scheduleActiveGameSave("retry failed active game save");
    };
    // Ordered work resolves false when its action throws. Handle both that
    // contract and an unexpected rejected promise so autosave failures are
    // never silently left without a retry.
    promise.then(saved => {
      if (saved === false) handleSaveFailure();
    }).catch(handleSaveFailure);
    return true;
  }
  async function writeSaveIndexRecord(record = {}) {
    const exact = exactSaveIndexRecord(record);
    if (!app.persistence?.started) throw new Error("Only current normalized saves can be renamed.");
    await app.persistence.renameSave(Number(exact.saveId), exact.name);
    await loadSaveIndexRecords();
    return true;
    /* istanbul ignore next -- prerelease aggregate persistence is intentionally unreachable. */
    const saveId = exact.saveId;
    const saved = await app.work.enqueueOrdered(`save:${saveId}`, `update save header ${saveId}`, async () => {
      const loaded = await persistenceWorkerRequest("save-load", {
        saveId
      });
      if (!loaded?.header) return false;
      const baseRevision = Number(loaded.header.durableRevision) || 0;
      const revision = baseRevision + 1;
      await persistenceWorkerRequest("save-write-batch", {
        saveId,
        baseRevision,
        revision,
        header: {
          ...loaded.header,
          ...normalized,
          saveId,
          updatedAt: new Date().toISOString()
        },
        records: [],
        messages: [],
        snapshots: [],
        images: []
      });
      const revisionState = app.persistenceRevisions[`save:${saveId}`] ||= {
        runtimeRevision: 0,
        queuedRevision: 0,
        durableRevision: 0,
        error: ""
      };
      revisionState.runtimeRevision = Math.max(Number(revisionState.runtimeRevision) || 0, revision);
      revisionState.queuedRevision = Math.max(Number(revisionState.queuedRevision) || 0, revision);
      revisionState.durableRevision = revision;
      revisionState.error = "";
      return true;
    });
    if (!saved) return false;
    await loadSaveIndexRecords();
    return true;
  }
  async function deleteSaveStorage(saveId = "") {
    const id = String(saveId || "").trim();
    if (!id) return false;
    if (!app.persistence?.started || !/^\d+$/.test(id)) throw new Error("Only current normalized saves can be deleted.");
    app.deletedSaveIds ||= new Set();
    app.deletedSaveIds.add(id);
    if (app.persistence.activeSaveState?.saveId === Number(id)) {
      cancelScheduledActiveGameSave();
      await flushRuntimeSaveProjections();
      await app.persistence.closeActiveSave();
      app.saveSessionActive = false;
      app.saveSessionContext = null;
    }
    await app.persistence.deleteSave(Number(id));
    setSaveIndexRecords(saveIndexRecords().filter(record => record.saveId !== id));
    if (activeSaveId() === id) {
      setActiveSaveId("");
    }
    app.deletedSaveIds.delete(id);
    forgetDeletedSaveRuntimeBookkeeping(id);
    return true;
  }
  function forgetDeletedSaveRuntimeBookkeeping(saveId = "") {
    const id = String(saveId || "").trim();
    if (!id) return;
    delete app.persistenceRevisions[`save:${id}`];
    if (app.saveImageDurableSignatures) {
      delete app.saveImageDurableSignatures[id];
      delete app.saveImageDurableSignatures[`save:${id}`];
    }
  }
  function validationResult(errors = [], warnings = []) {
    return {
      ok: !errors.length,
      errors,
      warnings
    };
  }
  function validationError(path, code, message) {
    return {
      path,
      code,
      message
    };
  }
  async function loadSaveRecord(saveId = "") {
    const id = String(saveId || "").trim();
    if (!app.persistence?.started || !app.library || !/^\d+$/.test(id)) throw new Error("Only current normalized EmberAdventures saves can be loaded.");
    return fullSaveRecordForExport(findSaveIndexRecord(id));
  }
  async function loadSaveImages(saveId = "") {
    const id = String(saveId || "").trim();
    if (!app.library || !/^\d+$/.test(id)) throw new Error("Only current normalized EmberAdventures save images can be loaded.");
    const reconstructed = await app.library.reconstructRuntimeSave(Number(id));
    return safeImageHistoryForStorage(reconstructed.images || []);
  }
  async function fullSaveRecordForExport(record = {}) {
    const exact = exactSaveIndexRecord(record);
    if (app.persistence?.started) {
      const saveId = Number(exact.saveId);
      const [reconstructed, loaded] = await Promise.all([app.library.reconstructRuntimeSave(saveId), app.persistence.loadSave(saveId, 40)]);
      const messages = (loaded.recordsByStore?.messages || []).map(runtimeMessageFromStoredRow);
      return {
        format: "emberadventures-lite-normalized-save-runtime",
        header: reconstructed.header,
        index: saveIndexRecordFromStoredHeader(reconstructed.header, {
          title: reconstructed.definition?.metadata?.title || reconstructed.header.displayName
        }),
        definition: reconstructed.definition,
        state: reconstructed.state,
        messages,
        images: safeImageHistoryForStorage(reconstructed.images || []),
        profileImages: [],
        objectiveRuntime: reconstructed.objectiveRuntime,
        rewardRuntime: reconstructed.rewardRuntime,
        recordsByStore: reconstructed.recordsByStore
      };
    }
    throw new Error("Only current normalized EmberAdventures saves can be exported.");
  }
  async function writeImportedSaveBundle(bundle = {}) {
    const imported = await app.persistence.importSave(new Blob([JSON.stringify(bundle)], {
      type: "application/json"
    }));
    await loadSaveIndexRecords();
    return findSaveIndexRecord(String(imported.saveId));
  }
  async function exportGameSave(id = "") {
    const save = findGameSaveById(id);
    if (!save) {
      showNotice("Save Not Found", "That saved game is no longer available.");
      return;
    }
    if (String(activeSaveId()) === String(id)) {
      flushCurrentGameAutosaveIfPossible("autosaved before save export");
      if (!(await flushActiveGameSave())) return;
    }
    const result = await app.persistence.exportSave(Number(id));
    if (!(result?.blob instanceof Blob)) {
      showNotice("Export Failed", "The saved game data could not be loaded.");
      return;
    }
    downloadDiagnosticBlob(result.blob, `emberadventures-lite-save-${safeArchiveFileName(gameSaveDisplayName(save))}.json`);
  }
  async function importGameSave(options = {}) {
    const allowDeleteCurrent = options?.allowDeleteCurrent === true;
    const files = await chooseImportFiles({
      accept: COMPRESSED_JSON_IMPORT_ACCEPT,
      multiple: false
    });
    const file = files[0];
    if (!file) return;
    await withSavingOverlay(async () => {
      try {
        const imported = await app.persistence.importSave(compressedJsonFormat(file) ? new File([await compressedJsonBlobText(file, file.name)], file.name.replace(/\.(?:br|gz|zst|zstd|zz|zlib|deflate(?:-raw)?)$/i, ""), {
          type: "application/json"
        }) : file);
        await loadSaveIndexRecords();
        const index = findSaveIndexRecord(String(imported.saveId));
        openGameSavesModal({
          allowDeleteCurrent
        });
        showNotice("Saved Game Imported", `${gameSaveDisplayName(index)} is now available in Saved Games.`);
      } catch (error) {
        showNotice("Import Failed", error.message || String(error));
      }
    }, "Importing saved game...");
  }
  function stateStoryTitle(state = app.state) {
    return state?.meta?.story_source?.title || state?.location?.universe || state?.meta?.title || "Current Game";
  }
  function saveHeaderSummaryRecordId(record = {}, fallback = "") {
    return String(record?.id ?? record?.entryId ?? record?.imageId ?? fallback ?? "").trim();
  }
  function saveHeaderMessageProjection(message = {}) {
    return {
      counted: message?.role !== "log"
    };
  }
  function saveHeaderImageProjection(image = {}) {
    return {};
  }
  function replaceSaveHeaderProjection(cache, collection, id, projection = null) {
    const map = cache[collection];
    if (!(map instanceof Map) || !id) return;
    const countField = collection === "messageById" ? "messageCount" : "imageCount";
    const previous = map.get(id);
    if (previous?.counted !== false && previous && collection === "messageById") cache[countField] = Math.max(0, Number(cache[countField] || 0) - 1);else if (previous && collection === "imageById") cache[countField] = Math.max(0, Number(cache[countField] || 0) - 1);
    if (!projection) {
      map.delete(id);
      return;
    }
    map.set(id, projection);
    if (collection === "messageById") {
      if (projection.counted !== false) cache[countField] += 1;
    } else cache[countField] += 1;
  }
  function rebuildSaveHeaderSummaryCache() {
    const cache = {
      messageRevision: Number(app.messageListRevision || 0),
      imageRevision: Number(app.imageTimelineRevision || 0),
      profileRevision: Number(app.profileImageReferenceRevision || 0),
      snapshotRevision: Number(app.snapshotListRevision || 0),
      messageById: new Map(),
      imageById: new Map(),
      messageCount: 0,
      imageCount: 0,
      profileImageCount: 0,
      snapshotCount: (app.snapshots || []).length
    };
    for (const [index, message] of (app.messages || []).entries()) {
      const id = saveHeaderSummaryRecordId(message, `message-index-${index}`);
      replaceSaveHeaderProjection(cache, "messageById", id, saveHeaderMessageProjection(message));
    }
    for (const [index, image] of (app.images || []).entries()) {
      const id = saveHeaderSummaryRecordId(image, `image-index-${index}`);
      replaceSaveHeaderProjection(cache, "imageById", id, saveHeaderImageProjection(image));
    }
    const activeProfileImages = profileImagesForState(app.state, app.profileImages || []);
    cache.profileImageCount = activeProfileImages.length;
    app.saveHeaderSummaryCache = cache;
    return cache;
  }
  function refreshDirtySaveHeaderSummaryCollection(cache, collection = "messages", revision = 0) {
    const revisionField = collection === "messages" ? "messageRevision" : "imageRevision";
    const targetRevision = Number(revision || 0);
    if (Number(cache[revisionField] || 0) === targetRevision) return true;
    const dirty = runtimeAggregateDirtyTracker[collection];
    if (!(dirty instanceof Map) || !dirty.size) return false;
    const source = collection === "messages" ? app.messages || [] : app.images || [];
    const mapName = collection === "messages" ? "messageById" : "imageById";
    for (const entry of dirty.values()) {
      const id = String(entry?.id || "").trim();
      if (!id) return false;
      if (entry.operation === "delete") {
        replaceSaveHeaderProjection(cache, mapName, id, null);
        continue;
      }
      const record = source.find(item => saveHeaderSummaryRecordId(item) === id);
      if (!record) return false;
      replaceSaveHeaderProjection(cache, mapName, id, collection === "messages" ? saveHeaderMessageProjection(record) : saveHeaderImageProjection(record));
    }
    cache[revisionField] = targetRevision;
    return true;
  }
  function activeSaveHeaderSummary() {
    let cache = app.saveHeaderSummaryCache;
    if (!cache || !(cache.messageById instanceof Map) || !(cache.imageById instanceof Map) || runtimeAggregateDirtyTracker.baselineRequired) cache = rebuildSaveHeaderSummaryCache();
    if (!refreshDirtySaveHeaderSummaryCollection(cache, "messages", app.messageListRevision) || !refreshDirtySaveHeaderSummaryCollection(cache, "images", app.imageTimelineRevision)) cache = rebuildSaveHeaderSummaryCache();
    const profileRevision = Number(app.profileImageReferenceRevision || 0);
    if (Number(cache.profileRevision || 0) !== profileRevision) {
      const activeProfileImages = profileImagesForState(app.state, app.profileImages || []);
      cache.profileImageCount = activeProfileImages.length;
      cache.profileRevision = profileRevision;
    }
    const snapshotRevision = Number(app.snapshotListRevision || 0);
    if (Number(cache.snapshotRevision || 0) !== snapshotRevision) {
      cache.snapshotCount = (app.snapshots || []).length;
      cache.snapshotRevision = snapshotRevision;
    }
    return {
      messageCount: cache.messageCount,
      imageCount: cache.imageCount,
      profileImageCount: cache.profileImageCount,
      snapshotCount: cache.snapshotCount
    };
  }
  function saveIndexRecordFromRuntime(reason = "saved game") {
    const id = activeSaveId();
    const existing = findSaveIndexRecord(id) || {};
    const now = new Date().toISOString();
    const summary = activeSaveHeaderSummary();
    return exactSaveIndexRecord({
      saveId: id,
      name: existing.name || defaultGameSaveName(reason, app.state),
      storyTitle: stateStoryTitle(app.state),
      playerName: app.state?.player?.name || "",
      createdAt: existing.createdAt || now,
      updatedAt: now,
      reason,
      titleImageHtml: stableImageHtmlToString(app.state?.meta?.title_image_html || ""),
      titleImageAlt: String(app.state?.meta?.title_image_alt || stateStoryTitle(app.state) || "").trim(),
      messageCount: summary.messageCount,
      imageCount: summary.imageCount,
      profileImageCount: summary.profileImageCount,
      snapshotCount: summary.snapshotCount,
      smokeTestRuntime: app.state?.meta?.smoke_test_runtime === true || devSmokeSuiteState().running === true
    });
  }
  function stampRuntimeSaveOwnership(saveId = activeSaveId()) {
    const id = String(saveId || "").trim();
    if (!id) return;
    app.state ||= clone(defaultState);
    app.state.meta ||= {};
    app.state.meta.save_id = id;
  }
  function saveOwnershipMismatchDetails(saveId = activeSaveId()) {
    return [];
  }
  function assertRuntimeSaveOwnership(saveId = activeSaveId(), reason = "save") {
    return true;
  }
  function setCurrentGameSaveId(id = "") {
    app.currentGameSaveId = id || "";
    app.settings.currentGameSaveId = app.currentGameSaveId;
  }
  function persistCurrentGameSaveId() {
    app.settings.currentGameSaveId = app.currentGameSaveId || "";
    saveSettingsNow("current game save id changed");
  }
  function uniqueGameSaveName(base = "Saved Game", excludeId = "") {
    const cleanBase = String(base || "Saved Game").trim() || "Saved Game";
    const used = new Set(saveIndexRecords().filter(save => String(save.saveId) !== String(excludeId)).map(save => gameSaveDisplayName(save).toLowerCase()));
    if (!used.has(cleanBase.toLowerCase())) return cleanBase;
    for (let index = 2; index < 1000; index++) {
      const candidate = `${cleanBase} (${index})`;
      if (!used.has(candidate.toLowerCase())) return candidate;
    }
    return `${cleanBase} (${Date.now()})`;
  }
  function gameSaveMessagesForStorage(messages = app.messages) {
    return (Array.isArray(messages) ? messages : []).filter(message => message?.role !== "log").sort(entrySort).map(compactMessageForStorage);
  }
  function shouldAutosaveCurrentGame() {
    if (app.suppressGameAutosave) return false;
    if (app.worldGenerationStarted) return false;
    if (app.onboardingDraft) return false;
    if (!app.state?.meta?.setup_complete) return false;
    if (!activeSaveId()) return false;
    return true;
  }
  function scheduleCurrentGameAutosave(reason = "autosaved current game") {
    if (!shouldAutosaveCurrentGame()) return;
    if (app.saveSessionActive) {
      scheduleSaveProjectionFlush();
      return;
    }
    clearTimeout(app.gameAutosaveTimer);
    app.gameAutosaveTimer = setTimeout(() => flushCurrentGameAutosave(reason), 1200);
  }
  function flushCurrentGameAutosave(reason = "autosaved current game") {
    clearTimeout(app.gameAutosaveTimer);
    app.gameAutosaveTimer = null;
    if (!shouldAutosaveCurrentGame() || app.gameAutosaveRunning) return;
    app.gameAutosaveRunning = true;
    try {
      saveCurrentGame(reason);
    } finally {
      app.gameAutosaveRunning = false;
    }
  }
  function flushCurrentGameAutosaveIfPossible(reason = "autosaved current game") {
    try {
      flushCurrentGameAutosave(reason);
    } catch (err) {
      recordStorageFailure(ACTIVE_SAVE_KEY, err);
    }
  }
  function saveCurrentGame(reason = "saved game") {
    if (!app.state?.meta?.setup_complete) return false;
    if (!app.saveSessionActive || !app.persistence?.activeSaveState) return false;
    return saveActiveGame(reason);
  }
  async function saveCurrentGameBeforeRuntimeReplacement(reason = "saved before replacing game") {
    if (!app.state?.meta?.setup_complete) return true;
    cancelScheduledActiveGameSave();
    if (app.saveSessionActive) {
      await flushRuntimeSaveProjections();
      await app.persistence.closeActiveSave();
      app.saveSessionActive = false;
      return true;
    }
    if (!activeSaveId()) return true;
    throw new Error(`Active save ${activeSaveId()} has no normalized persistence session during ${reason}.`);
  }
  async function saveGeneratedGame(reason = "new game created") {
    if (app.persistence?.activeSaveState) {
      app.saveSessionActive = true;
      await flushRuntimeSaveProjections();
      return true;
    }
    await createNewActiveSave(reason, {
      state: app.state,
      messages: app.messages,
      images: app.images,
      profileImages: app.profileImages,
      snapshots: app.snapshots,
      onDefinitionProgress: setStoryStartLoadingMessage
    });
    return true;
  }
  function storyTemplatePlayerOptions(templateOrState = {}) {
    const state = templateOrState?.state || templateOrState || {};
    const raw = state.players;
    const options = [];
    const add = (value, key = "") => {
      if (!isPlainObject(value)) return;
      const character = clone(value);
      character.gender = canonicalCharacterGenderValue(character.gender);
      delete character.clothing;
      const name = textSlot(character.name, key);
      if (!name || options.some(item => item.name === name)) return;
      options.push({
        id: textSlot(value.id, objectiveIdFromTitle(name, key || name)),
        name,
        character
      });
    };
    if (Array.isArray(raw)) raw.forEach((value, index) => add(value, `player-${index + 1}`));else if (isPlainObject(raw)) {
      if (Array.isArray(raw.options)) raw.options.forEach((value, index) => add(value, `player-${index + 1}`));else Object.entries(raw).forEach(([key, value]) => add(value, key));
    }
    return options;
  }
  function storyTemplateAllowsAnyPlayer(template = {}) {
    if (template?.allow_any_player === true) return true;
    if (storyTemplatePlayerOptions(template).length > 0) return false;
    const fixedPlayer = template?.state?.player;
    return !(isPlainObject(fixedPlayer) && textSlot(fixedPlayer.name, ""));
  }
  function storyPlayerSelectDefaultGender() {
    return textSlot(app.settings?.storyPlayerSelectGender, "");
  }
  function storyPlayerSelectGenderChoice(templateId = "", template = null) {
    app.storyPlayerSelectGenderChoices ||= {};
    const saved = textSlot(app.storyPlayerSelectGenderChoices[templateId], "");
    if (saved) return supportedAdaptiveCharacterGender(saved);
    return storyPlayerSelectDefaultGender(template);
  }
  function storyPlayerSelectGenderLabel(gender = "") {
    if (!textSlot(gender, "")) return "Story default";
    const value = supportedAdaptiveCharacterGender(gender);
    if (value === "male") return "Male";
    return "Female";
  }
  function storyPlayerSelectGenderControlHtml(templateId = "", template = {}, refreshTarget = "player-select") {
    const selected = storyPlayerSelectGenderChoice(templateId, template);
    const option = (value, label) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
    return `
                <label class="inline-field compact-field">Player presentation
                    <select onchange="EmberAdventures.setStoryPlayerSelectGender(${htmlJsArg(templateId)}, this.value, ${htmlJsArg(refreshTarget)})">
                        ${option("", "Story default")}
                        ${option("male", "Male")}
                        ${option("female", "Female")}
                        
                    </select>
                </label>
            `;
  }
  function storyPlayerOptionPresentation(option = {}, gender = "") {
    const originalName = textSlot(option.name || option.character?.name, "");
    const targetGender = textSlot(gender, "");
    const character = targetGender ? characterLibraryPresentation(option.character || {}, option.id || originalName, targetGender, {
      allowNonRomanceable: true
    }) : clone(option.character || {});
    delete character.clothing;
    const requestBase = textSlot(option.profileImageRequestBase, "");
    if (requestBase) {
      character.profile_image_request_key = `${requestBase}:${profileImageMalePresentation(character) ? "male" : "non_male"}`;
    }
    const name = textSlot(character.name, originalName);
    return {
      ...option,
      name,
      selectionName: originalName || name,
      character,
      presentationGender: targetGender
    };
  }
  function setStoryPlayerSelectGender(templateId = "", gender = "", refreshTarget = "player-select") {
    app.storyPlayerSelectGenderChoices ||= {};
    const value = textSlot(gender, "");
    const selected = value ? supportedAdaptiveCharacterGender(value) : "";
    app.settings.storyPlayerSelectGender = selected;
    if (selected) app.storyPlayerSelectGenderChoices[templateId] = selected;else delete app.storyPlayerSelectGenderChoices[templateId];
    saveSettingsNow("story player presentation changed");
    if (refreshTarget === "library") {
      document.querySelector("[data-story-any-player-picker]")?.closest?.(".popup-modal")?.remove();
      openStoryAnyPlayerLibrary(templateId);
      return;
    }
    openStoryPlayerSelectModal(templateId);
  }
  
