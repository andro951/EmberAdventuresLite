function renderThread(reason = "", options = {}) {
    recordRenderStat("thread", reason);
    const el = options.element || $("thread");
    if (!el) return;
    const mainThread = !options.element;
    const threadWasEmpty = !String(el.innerHTML || "").trim();
    const loadingEarlier = reason === "load earlier transcript window";
    const suppliedMessages = Array.isArray(options.messages) ? options.messages : null;
    const messages = [];
    const allVisibleMessages = suppliedMessages || visibleMessagesForRender();
    const renderLimit = Number.isFinite(options.renderLimit) ? Math.max(1, Number(options.renderLimit)) : Math.max(40, Number(app.threadRenderLimit || 180));
    const windowStart = Math.max(0, allVisibleMessages.length - renderLimit);
    const visibleMessages = allVisibleMessages.slice(windowStart);
    const firstVisibleTime = Date.parse(visibleMessages[0]?.at || "") || 0;
    const visibleMessageIds = new Set(visibleMessages.map(message => String(message.id || "")));
    const knownMessageIds = new Set((suppliedMessages || combinedEntriesForRender()).map(message => String(message.id || "")));
    const chatImageTimeline = buildChatImageTimeline(visibleMessageIds, knownMessageIds, firstVisibleTime, Array.isArray(options.images) ? options.images : visibleImagesForRender());
    const structureSignature = threadStructureSignature(visibleMessages, chatImageTimeline, false);
    if (!threadWasEmpty && !app.newGameChatScrollToTop && !app.existingGameChatScrollToBottom && el.dataset.structureSignature === structureSignature) {
      if (mainThread) {
        syncThreadStateIndicator();
        syncThreadAiWorkingIndicator();
        if (app.storyShopChatSession) renderStoryShopChatView();
      }
      return;
    }
    const threadWasAtBottom = threadViewportIsAtBottom(el);
    const viewportAnchor = captureThreadViewportAnchor(el);
    const previousScrollTop = Number(el.scrollTop) || 0;
    if (windowStart > 0 && options.showWindowNotice !== false) {
      messages.push(`
          <article class="message system thread-window-notice">
            <div class="bubble">Showing the newest ${escapeHtml(visibleMessages.length)} of ${escapeHtml(allVisibleMessages.length)} messages. Scroll to the top to load earlier messages.</div>
          </article>
        `);
    }
    let floatingImageIndex = 0;
    const flushFloatingImagesBefore = message => {
      if (!chatImageTimeline.floating.length) return;
      const messageTime = Date.parse(message?.at || "") || 0;
      const batch = [];
      while (floatingImageIndex < chatImageTimeline.floating.length) {
        const entry = chatImageTimeline.floating[floatingImageIndex];
        const imageTime = imageChatSortTime(entry.image);
        if (messageTime && imageTime && imageTime >= messageTime) break;
        batch.push(entry.image);
        floatingImageIndex += 1;
      }
      if (batch.length) messages.push(chatImagesHtml(batch));
    };
    for (const message of visibleMessages) {
      flushFloatingImagesBefore(message);
      const readingButton = String(app.activeVoiceMessageId || "") === String(message.id) ? `<button class="message-action danger" data-voice-stop-action="1" title="Stop reading" onclick="EmberAdventures.stopReadingMessage(true)">&#128263;</button>` : "";
      const timeText = new Date(message.at).toLocaleTimeString();
      const isInlineMeta = message.role === "user" || message.role === "assistant" || message.role === "command" || message.role === "game";
      const speakerLabel = displayMessageSpeaker(message);
      const topLine = isInlineMeta ? `<div class="speaker message-topline">
                                <span>${escapeHtml(speakerLabel)}</span>
                                <span class="message-time-inline">${escapeHtml(timeText)}</span>
                            </div>` : speakerLabel ? `<div class="speaker">${escapeHtml(speakerLabel)}</div>` : "";
      const actions = message.role === "user" || message.role === "assistant" ? (() => {
        const messageIdArg = htmlJsArg(message.id);
        const canMutate = messageMutationAllowed(message);
        const currentlyGenerating = messageIsGenerating(message.id);
        const activelyGenerating = messageIsActivelyGenerating(message.id);
        const disabledAttrs = canMutate ? "" : `disabled title="No pre-message state backup exists for this processed message"`;
        const deleteButton = messageCanShowDeleteAction(message) ? `<button class="message-action danger" data-message-mutation-action="1" ${disabledAttrs} onclick="EmberAdventures.deleteMessage(${messageIdArg})">&#128465;</button>` : "";
        const stopGeneratingButton = message.role === "assistant" && activelyGenerating ? `<button class="message-action danger" data-stop-generating-message="1" title="Stop generating and keep the text already received" onclick="EmberAdventures.stopGeneratingMessage(${messageIdArg})">&#9632;</button>` : "";
        const editButton = !currentlyGenerating ? `<button class="message-action" data-message-mutation-action="1" ${disabledAttrs} onclick="EmberAdventures.editMessage(${messageIdArg})">&#9998;</button>` : "";
        return `<div class="message-actions">
                            ${readingButton}
                            ${directObjectiveChoiceRollbackButton(message)}
                            ${stopGeneratingButton}
                            <button class="message-action blue" title="Read from here" onclick="EmberAdventures.readMessage(${messageIdArg})">&#128266;</button>
                            ${editButton}
                            ${deleteButton}
                            ${message.role === "assistant" ? `<button class="message-action blue" data-message-mutation-action="1" ${canMutate ? `title="Regenerate Message"` : disabledAttrs} onclick="EmberAdventures.openRegenerateMessageModal(${messageIdArg})">&#8635;</button>` : ""}
                        </div>`;
      })() : message.role === "command" ? `<div class="message-actions">
                            <button class="message-action danger" title="Delete command" onclick="EmberAdventures.deleteMessage(${htmlJsArg(message.id)})">&#128465;</button>
                        </div>` : message.role === "game" ? `<div class="message-actions">
                            ${readingButton}
                            ${directObjectiveChoiceRollbackButton(message)}
                            <button class="message-action blue" title="Read from here" onclick="EmberAdventures.readMessage(${htmlJsArg(message.id)})">&#128266;</button>
                        </div>` : `<div class="message-actions">
                            ${readingButton}
                            <button class="message-action blue" title="Read from here" onclick="EmberAdventures.readMessage(${htmlJsArg(message.id)})">&#128266;</button>
                        </div>`;
      const voiceClass = String(app.activeVoiceMessageId || "") === String(message.id) ? " voice-active" : "";
      const syncClass = stateSyncClassForMessage(message);
      const syncStyle = stateSyncStyleForMessage(message);
      messages.push(`
          <article class="message ${message.role} ${syncClass}${voiceClass}" data-message-id="${escapeHtml(message.id)}"${syncStyle ? ` style="${syncStyle}"` : ""}>
            ${topLine}
            <div class="bubble"><div class="message-content">${formatMessageWithVoiceHighlight(message)}</div></div>
            ${actions}
            ${isInlineMeta ? "" : `<div class="msg-meta">${escapeHtml(timeText)}</div>`}
          </article>
        `);
      const inlineImages = chatImagesHtml(chatImageTimeline.byAnchor.get(String(message.id || "")) || []);
      if (inlineImages) messages.push(inlineImages);
      if (showThreadLoadingHeartbeatMessages() && app.stateSync?.running && String(app.stateSync.startMessageId || "") === String(message.id)) {
        const syncGroupClass = app.stateSync.currentGroup ? ` group-${cssEscape(app.stateSync.currentGroup)}` : "";
        const syncStyle = stateSyncProgressStyle(stateSyncProgressRatio());
        messages.push(`
          <article class="message system state-sync-indicator${syncGroupClass}" style="${syncStyle}">
            <div class="bubble">
              <span>${escapeHtml(app.stateSync.status || "Updating game state")}</span>
              <span class="dots"></span>
            </div>
          </article>
        `);
      }
    }
    const activeAiLabel = app.aiActive && app.aiActive.logType !== "image" ? app.aiActive.label || "request" : "";
    const visibleAiQueue = (app.aiQueue || []).filter(item => item.logType !== "image");
    const workingText = activeAiLabel ? `Using AI: ${activeAiLabel}${visibleAiQueue.length ? ` (${visibleAiQueue.length} waiting)` : ""}` : visibleAiQueue.length ? `AI queue: ${visibleAiQueue.length} request(s) waiting` : app.statusText || statusTextForStage(app.turnStage) || "Working";
    const showAiStatusText = app.settings.showAiStatusMessages !== false;
    if (showThreadAiWorkingIndicator() && (app.busy || activeAiLabel || visibleAiQueue.length)) {
      messages.push(`
          <article class="message system working-indicator">
            <div class="bubble">
              ${showAiStatusText ? `<span id="workingText">${escapeHtml(workingText)}</span>` : ""}
              <span class="dots"></span>
            </div>
          </article>
        `);
    }
    if (app.queue.length) {
      messages.push(...app.queue.map((item, index) => exactQueueItem(item, `queue[${index}]`)).map((item, queueIndex) => ({
        item,
        queueIndex
      })).filter(({
        item
      }) => item.visibleText).map(({
        item,
        queueIndex
      }, visibleIndex) => `
          <article class="message user queued-message" data-queue-index="${queueIndex}">
            <div class="speaker message-topline">
              <span>${escapeHtml(item.speaker || (item.source === "command" ? "AI Command" : app.state.player?.name || "Player"))}</span>
              <span class="message-time-inline">Queued ${visibleIndex + 1}/${app.queue.length}</span>
            </div>
            <div class="bubble">${formatMessage(item.visibleText)}</div>
            <div class="message-actions">
              <button class="message-action danger" title="Delete queued message" onclick="EmberAdventures.deleteQueuedMessage(${queueIndex})">&#128465;</button>
            </div>
          </article>
        `));
    }
    if (floatingImageIndex < chatImageTimeline.floating.length) {
      messages.push(chatImagesHtml(chatImageTimeline.floating.slice(floatingImageIndex).map(entry => entry.image)));
    }
    el.innerHTML = messages.join("");
    el.dataset.structureSignature = structureSignature;
    el.querySelectorAll("img").forEach(img => {
      img.loading = "lazy";
      img.decoding = "async";
    });
    activatePluginIframes(el);
    if (mainThread && !el.dataset.performanceScrollBound) {
      el.dataset.performanceScrollBound = "1";
      el.addEventListener("scroll", () => expandThreadWindowAtTop(el), {
        passive: true
      });
    }
    let stabilityAnchor = viewportAnchor;
    if (!mainThread && options.scrollToBottomOnce && !el.dataset.initialScrollComplete) {
      el.scrollTop = el.scrollHeight;
      el.dataset.initialScrollComplete = "1";
    } else if (mainThread && app.existingGameChatScrollToBottom) {
      el.scrollTop = el.scrollHeight;
      app.existingGameChatScrollToBottom = false;
      stabilityAnchor = captureThreadViewportAnchor(el);
    } else if (mainThread && app.newGameChatScrollToTop) {
      el.scrollTop = 0;
      keepThreadAtTopForLoadingImages(el);
      stabilityAnchor = captureThreadViewportAnchor(el);
    } else if (loadingEarlier) {
      restoreThreadViewportAnchor(el, viewportAnchor);
    } else if (threadWasAtBottom) {
      el.scrollTop = el.scrollHeight;
      stabilityAnchor = null;
    } else {
      // Preserve the same visible message rather than only restoring a
      // numeric scrollTop. Text and image heights can change while the
      // reader is looking at an older part of the conversation.
      if (!restoreThreadViewportAnchor(el, viewportAnchor)) el.scrollTop = previousScrollTop;
    }
    if (mainThread) {
      syncThreadViewportStability(el, stabilityAnchor, {
        pinnedToBottom: threadViewportIsAtBottom(el)
      });
      if (app.storyShopChatSession) renderStoryShopChatView();
    }
  }
  function retryNormalImageRequest(imageId = "") {
    const image = (app.images || []).find(item => String(item?.id || "") === String(imageId || ""));
    if (!image?.prompt || isActiveImageRecord(image)) return false;
    updateStoredImageHtml(image.id, imageLoadingHtml("Retrying image generation"), {
      pending: true,
      error: ""
    });
    startStoredImageRequest(image, {
      resumed: true
    }).catch(err => {
      log("Image retry failed", err?.message || String(err), {
        type: "image",
        level: "error"
      });
    });
    return true;
  }
  function retryProfileImageRequest(imageId = "") {
    const id = String(imageId || "");
    const stored = profileStoreImageById(id);
    const name = profileImageNames().find(candidate => {
      const entity = profileEntity(candidate);
      return !!entity && !!profileImageById(entity, id);
    });
    if (!stored?.prompt || !name || isActiveProfileImageRecord(stored)) return false;
    updateProfileImageHtml(name, id, imageLoadingHtml("Retrying profile image"), {
      pending: true,
      error: ""
    });
    return queueProfileImage(name, {
      reason: "manual retry after image failure",
      force: true,
      pendingImageId: id
    });
  }
  function threadViewportAnchorIdentity(node = null) {
    if (!node) return null;
    if (node.dataset?.messageId != null) return {
      type: "message",
      value: String(node.dataset.messageId)
    };
    if (node.dataset?.imageId != null) return {
      type: "image",
      value: String(node.dataset.imageId)
    };
    if (node.dataset?.queueIndex != null) return {
      type: "queue",
      value: String(node.dataset.queueIndex)
    };
    return null;
  }
  function threadViewportAnchorNode(thread, identity = null) {
    if (!thread || !identity) return null;
    const value = cssEscape(identity.value);
    if (identity.type === "message") return thread.querySelector(`[data-message-id="${value}"]`);
    if (identity.type === "image") return thread.querySelector(`[data-image-id="${value}"]`);
    if (identity.type === "queue") return thread.querySelector(`[data-queue-index="${value}"]`);
    return null;
  }
  function captureThreadViewportAnchor(thread = $("thread")) {
    if (!thread) return {
      identity: null,
      offset: 0,
      scrollTop: 0
    };
    const scrollTop = Number(thread.scrollTop) || 0;
    const candidates = [...thread.children].filter(node => threadViewportAnchorIdentity(node));
    let low = 0;
    let high = candidates.length - 1;
    let anchorIndex = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candidates[middle].offsetTop <= scrollTop) {
        anchorIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    while (anchorIndex < candidates.length - 1 && candidates[anchorIndex].offsetTop + candidates[anchorIndex].offsetHeight <= scrollTop) anchorIndex += 1;
    const visible = candidates[anchorIndex] || null;
    const threadRect = thread.getBoundingClientRect();
    const visibleRect = visible?.getBoundingClientRect();
    return {
      identity: threadViewportAnchorIdentity(visible),
      offset: visibleRect ? visibleRect.top - threadRect.top : 0,
      scrollTop
    };
  }
  function threadViewportIsAtBottom(thread = $("thread"), tolerance = 2) {
    if (!thread) return false;
    return Number(thread.scrollHeight || 0) - Number(thread.scrollTop || 0) - Number(thread.clientHeight || 0) <= Math.max(0, Number(tolerance) || 0);
  }
  function restoreThreadViewportAnchor(thread = $("thread"), anchor = null) {
    if (!thread || !anchor) return false;
    const node = threadViewportAnchorNode(thread, anchor.identity);
    if (!node) {
      thread.scrollTop = Number(anchor.scrollTop) || 0;
      return false;
    }
    const threadRect = thread.getBoundingClientRect();
    const nextOffset = node.getBoundingClientRect().top - threadRect.top;
    thread.scrollTop += nextOffset - Number(anchor.offset || 0);
    return true;
  }
  function mutateThreadPreservingViewport(action, thread = $("thread")) {
    if (typeof action !== "function") return undefined;
    if (!thread) return action();
    const wasAtBottom = threadViewportIsAtBottom(thread);
    const anchor = captureThreadViewportAnchor(thread);
    const previousScrollTop = Number(thread.scrollTop) || 0;
    const stability = app.threadViewportStability;
    const wasRestoring = !!stability?.restoring;
    if (stability?.thread === thread) stability.restoring = true;
    try {
      return action();
    } finally {
      if (wasAtBottom) thread.scrollTop = thread.scrollHeight;else if (!restoreThreadViewportAnchor(thread, anchor)) thread.scrollTop = previousScrollTop;
      if (stability?.thread === thread) {
        stability.pinnedToBottom = wasAtBottom;
        stability.anchor = wasAtBottom ? null : captureThreadViewportAnchor(thread);
        stability.lastKnownScrollTop = Number(thread.scrollTop) || 0;
        stability.restoring = wasRestoring;
      }
    }
  }
  function syncThreadViewportStability(thread = $("thread"), anchor = null, options = {}) {
    if (!thread) return;
    const previous = app.threadViewportStability;
    if (previous?.thread && previous.thread !== thread) {
      previous.resizeObserver?.disconnect?.();
    }
    const state = previous?.thread === thread ? previous : {
      thread,
      anchor: null,
      lastKnownScrollTop: Number(thread.scrollTop) || 0,
      captureFrame: 0,
      restoreFrame: 0,
      restoring: false,
      pinnedToBottom: false,
      resizeObserver: null
    };
    app.threadViewportStability = state;
    if (options.pinnedToBottom != null) state.pinnedToBottom = !!options.pinnedToBottom;
    if (state.pinnedToBottom) state.anchor = null;else if (anchor) state.anchor = anchor;
    if (!state.scrollBound) {
      state.scrollBound = true;
      thread.addEventListener("scroll", () => {
        if (state.restoring) return;
        // A manual scroll supersedes any pending restoration. This
        // prevents a late image resize from snapping the reader
        // back to the position from before the manual scroll.
        state.anchor = null;
        state.lastKnownScrollTop = Number(thread.scrollTop) || 0;
        state.pinnedToBottom = threadViewportIsAtBottom(thread);
        if (state.captureFrame || typeof requestAnimationFrame !== "function") {
          if (typeof requestAnimationFrame !== "function") state.anchor = captureThreadViewportAnchor(thread);
          return;
        }
        state.captureFrame = requestAnimationFrame(() => {
          state.captureFrame = 0;
          if (!state.restoring) {
            state.pinnedToBottom = threadViewportIsAtBottom(thread);
            state.anchor = state.pinnedToBottom ? null : captureThreadViewportAnchor(thread);
          }
        });
      }, {
        passive: true
      });
    }
    const observeChildren = () => {
      if (!state.resizeObserver) return;
      state.resizeObserver.disconnect();
      [...thread.children].forEach(child => state.resizeObserver.observe(child));
    };
    const scheduleRestore = () => {
      if (state.restoring || state.restoreFrame || typeof requestAnimationFrame !== "function") return;
      const currentScrollTop = Number(thread.scrollTop) || 0;
      if (currentScrollTop !== state.lastKnownScrollTop) {
        // The browser or a caller changed the position since the
        // anchor was captured. Treat that as the new position rather
        // than restoring an older one over it.
        state.anchor = null;
        state.lastKnownScrollTop = currentScrollTop;
        return;
      }
      state.restoreFrame = requestAnimationFrame(() => {
        state.restoreFrame = 0;
        if (state.restoring) return;
        state.restoring = true;
        if (state.pinnedToBottom) thread.scrollTop = thread.scrollHeight;else if (state.anchor) restoreThreadViewportAnchor(thread, state.anchor);
        state.lastKnownScrollTop = Number(thread.scrollTop) || 0;
        state.restoring = false;
      });
    };
    if (!state.resizeObserver && typeof ResizeObserver === "function") state.resizeObserver = new ResizeObserver(() => scheduleRestore());
    observeChildren();
    if (!state.pinnedToBottom && !state.anchor) state.anchor = captureThreadViewportAnchor(thread);
    state.lastKnownScrollTop = Number(thread.scrollTop) || 0;
    scheduleRestore();
  }
  function threadStructureSignature(visibleMessages = [], chatImageTimeline = {
    byAnchor: new Map(),
    floating: []
  }, unusedArgument2061725 = 0) {
    const first = visibleMessages[0];
    const last = visibleMessages[visibleMessages.length - 1];
    const lastImage = (app.images || [])[app.images.length - 1];
    // Queue/status updates must not rebuild the transcript, but queue
    // content changes must still add or remove the visible queue rows.
    const queueSignature = (app.queue || []).map((item, index) => {
      const queued = exactQueueItem(item, `queue[${index}]`);
      return [index, queued.messageId || "", queued.source || "", queued.speaker || "", queued.visibleText || ""].join(":");
    }).join("|");
    // A rollback snapshot changes only the action row. Include its
    // availability in the structural signature so removing a snapshot
    // immediately removes the stale Choose Differently control.
    const rollbackActions = visibleMessages.filter(message => message?.choiceSnapshotId).map(message => `${message.id}:${choiceRollbackSnapshotForMessage(message) ? "1" : "0"}`).join("|");
    return [Number(app.messageListRevision || 0), Number(app.imageTimelineRevision || 0), visibleMessages.length, first?.id || "", first?._renderRevision || 0, last?.id || "", last?._renderRevision || 0, (app.images || []).length, lastImage?.id || "", lastImage?.status || "", app.settings?.showImagesInChat === false ? "no-images" : "images", app.settings?.showAiStatusMessages === false ? "no-status" : "status", String(app.activeVoiceMessageId || ""), queueSignature, rollbackActions].join("\u001f");
  }
  function scrollThreadToTopSoon() {
    requestAnimationFrame(() => {
      if (!app.newGameChatScrollToTop) return;
      const thread = $("thread");
      if (!thread) return;
      thread.scrollTop = 0;
      keepThreadAtTopForLoadingImages(thread);
      app.newGameChatScrollToTop = false;
    });
  }
  function showThreadLoadingHeartbeatMessages() {
    // Reduced UI is intended to hide transient heartbeat/status messages in
    // the chat thread. Keep real status fields updated elsewhere, but keep
    // state-update dot messages out of the reduced chat view.
    return app.settings.showAiStatusMessages !== false && !reducedUiEnabled();
  }
  function showThreadAiWorkingIndicator() {
    // The AI usage/working indicator is the main visible cue that the app
    // is doing work, so reduced UI must not hide it.
    return app.settings.showAiStatusMessages !== false;
  }
  function syncThreadAiWorkingIndicator() {
    const thread = $("thread");
    if (!thread) return;
    const existing = thread.querySelector(":scope > .working-indicator");
    const activeAiLabel = app.aiActive && app.aiActive.logType !== "image" ? app.aiActive.label || "request" : "";
    const visibleAiQueue = (app.aiQueue || []).filter(item => item.logType !== "image");
    const shouldShow = showThreadAiWorkingIndicator() && (app.busy || activeAiLabel || visibleAiQueue.length);
    if (!shouldShow) {
      if (existing) mutateThreadPreservingViewport(() => existing.remove(), thread);
      return;
    }
    const workingText = activeAiLabel ? `Using AI: ${activeAiLabel}${visibleAiQueue.length ? ` (${visibleAiQueue.length} waiting)` : ""}` : visibleAiQueue.length ? `AI queue: ${visibleAiQueue.length} request(s) waiting` : app.statusText || statusTextForStage(app.turnStage) || "Working";
    if (existing) {
      const label = existing.querySelector("#workingText");
      if (label && label.textContent !== workingText) mutateThreadPreservingViewport(() => {
        label.textContent = workingText;
      }, thread);
      return;
    }
    mutateThreadPreservingViewport(() => thread.insertAdjacentHTML("beforeend", `<article class="message system working-indicator">
                    <div class="bubble">
                        ${app.settings.showAiStatusMessages !== false ? `<span id="workingText">${escapeHtml(workingText)}</span>` : ""}
                        <span class="dots"></span>
                    </div>
                </article>`), thread);
  }
  function syncThreadStateIndicator() {
    const thread = $("thread");
    if (!thread) return;
    const existing = thread.querySelector(":scope > .state-sync-indicator");
    const shouldShow = showThreadLoadingHeartbeatMessages() && !!app.stateSync?.running;
    if (!shouldShow) {
      if (existing) mutateThreadPreservingViewport(() => existing.remove(), thread);
      return;
    }
    const startArticle = thread.querySelector(`[data-message-id="${cssEscape(String(app.stateSync.startMessageId || ""))}"]`);
    if (!startArticle) return;
    const syncGroupClass = app.stateSync.currentGroup ? ` group-${cssEscape(app.stateSync.currentGroup)}` : "";
    const syncStyle = stateSyncProgressStyle(stateSyncProgressRatio());
    const status = app.stateSync.status || "Updating game state";
    if (!existing) {
      mutateThreadPreservingViewport(() => startArticle.insertAdjacentHTML("afterend", `<article class="message system state-sync-indicator${syncGroupClass}" style="${syncStyle}">
                                <div class="bubble">
                                    <span>${escapeHtml(status)}</span>
                                    <span class="dots"></span>
                                </div>
                            </article>`), thread);
      return;
    }
    const label = existing.querySelector(".bubble > span:first-child");
    if (existing.className === `message system state-sync-indicator${syncGroupClass}` && existing.getAttribute("style") === syncStyle && label?.textContent === status && existing.previousElementSibling === startArticle) return;
    mutateThreadPreservingViewport(() => {
      existing.className = `message system state-sync-indicator${syncGroupClass}`;
      existing.setAttribute("style", syncStyle);
      const label = existing.querySelector(".bubble > span:first-child");
      if (label) label.textContent = status;
      if (existing.previousElementSibling !== startArticle) startArticle.insertAdjacentElement("afterend", existing);
    }, thread);
  }
  function pruneSnapshotsAfter(snapshot) {
    const index = (app.snapshots || []).findIndex(item => String(item.id || "") === String(snapshot?.id || ""));
    if (index >= 0) app.snapshots = app.snapshots.slice(0, index + 1);
    if (index >= 0) {
      runtimeSaveMutationTracker.snapshotStateOperations = [];
    }
  }
  function cancelStateWorkForMessageMutation(messageIds, reason) {
    const ids = [...new Set((Array.isArray(messageIds) ? messageIds : [messageIds]).map(id => String(id || "")).filter(Boolean))];
    ids.forEach(id => cancelAiRequestsForMessage(id, reason));
    const mutationEntryIds = ids.map(id => Number(findMessageById(id)?.entryId || id || 0)).filter(entryId => Number.isFinite(entryId) && entryId > 0);
    const blockEnd = Number(app.stateSync?.blockEndEntryId || 0);
    const touchesStateSyncBlock = !!app.stateSync?.running && mutationEntryIds.some(entryId => !blockEnd || entryId <= blockEnd);
    const activeCheckIds = new Set([app.activeStateCheck?.messageId, ...(Array.isArray(app.activeStateCheck?.messageIds) ? app.activeStateCheck.messageIds : [])].map(id => String(id || "")).filter(Boolean));
    const touchesActiveCheck = app.activeStateCheck && (!activeCheckIds.size || ids.some(id => activeCheckIds.has(String(id))));
    if (touchesActiveCheck) {
      app.activeStateCheck.cancelled = true;
      app.activeStateCheck.reason = reason;
      app.activeStateCheck.cancel?.();
      app.activeStateCheck = null;
    }
    if (!touchesStateSyncBlock && !touchesActiveCheck) return false;
    app.stateSync.generation = Number(app.stateSync.generation || 0) + 1;
    app.stateSync.running = false;
    app.stateSync.queued = false;
    app.stateSync.startMessageId = null;
    app.stateSync.blockStartEntryId = 0;
    app.stateSync.blockEndEntryId = 0;
    app.stateSync.blockSnapshotId = "";
    app.stateSync.processingMessageIds = [];
    app.stateSync.stateSnapshot = null;
    app.stateSync.currentGroup = "";
    app.stateSync.completedStepKeys = [];
    app.stateSync.lastRangeText = "";
    app.stateSync.status = "";
    clearStateSyncCheckpoint();
    return true;
  }
  function cancelActiveStateWork(reason = "state work cancelled") {
    if (app.activeStateCheck) {
      app.activeStateCheck.cancelled = true;
      app.activeStateCheck.reason = reason;
      app.activeStateCheck.cancel?.();
    }
    app.activeStateCheck = null;
    app.stateSync.generation = Number(app.stateSync.generation || 0) + 1;
    app.stateSync.running = false;
    app.stateSync.queued = false;
    app.stateSync.startMessageId = null;
    app.stateSync.blockStartEntryId = 0;
    app.stateSync.blockEndEntryId = 0;
    app.stateSync.blockSnapshotId = "";
    app.stateSync.processingMessageIds = [];
    app.stateSync.stateSnapshot = null;
    app.stateSync.currentGroup = "";
    app.stateSync.completedStepKeys = [];
    app.stateSync.lastRangeText = "";
    app.stateSync.status = "";
    clearStateSyncCheckpoint();
    stateTrace("state work cancelled", {
      label: "state",
      reason,
      summary: `Cancelled active state work because ${reason}.`
    });
    log("State work cancelled", reason, {
      type: "state",
      level: "message"
    });
  }
  function cancelAllGameProcesses(reason = "game changed") {
    // Game lifecycle rule: starting or loading a different game must
    // invalidate every async process from the previous game. Clearing
    // queues is not enough because old AI/image/plugin promises can
    // finish late; the runtime generation token makes those continuations
    // harmless after the game boundary changes.
    app.gameRuntimeGeneration = Number(app.gameRuntimeGeneration || 1) + 1;
    app.recentSceneImageVisualStates = new Map();
    cancelActiveStateWork(reason);
    disableAutoVisualNovel(reason);
    clearAutoAdvanceTimer();
    stopReadingMessage(false);
    clearVoiceMessageRuntimeState();
    app.queue = [];
    app.busy = false;
    app.autoPlayerTurnGenerating = false;
    for (const request of app.aiQueue || []) {
      request.opts ||= {};
      request.opts.cancelled = true;
      request.cancelled = true;
      request.reject?.(aiCancelledError(request.opts?.messageId, reason));
    }
    app.aiQueue = [];
    if (app.aiActive) {
      app.aiActive.opts ||= {};
      app.aiActive.opts.cancelled = true;
      app.aiActive.cancelled = true;
      app.aiActive.reject?.(aiCancelledError(app.aiActive.opts?.messageId, reason));
    }
    app.aiActive = null;
    app.activeImageRequests = new Set();
    app.activeProfileImageRequests = new Set();
    app.profileImageRequestOwnerById = {};
    app.activeProfileImageRequestByOwner = {};
    app.supersededProfileImageRequests = new Set();
    app.profileImageQueue = [];
    app.profileImageQueued = new Set();
    app.profileImageGenerating = new Set();
    app.profileImageQueueRunning = false;
    app.npcInspectionInFlight = new Set();
    app.pendingPresenceCleanup = [];
    app.presenceCleanupRunning = false;
    app.pendingNpcInvite = null;
    app.pendingObjectiveChoiceReply = null;
    app.pendingRegenerateMessage = null;
    app.currentReplyDirective = "";
    app.currentReplyMode = "";
    app.activeQueueSource = "";
    app.voiceMetadataPendingMessageIds = new Set();
    app.pendingVoiceDialogueParts = new Map();
    clearTimeout(app.worldGenerationHeartbeatTimer);
    app.worldGenerationHeartbeatTimer = null;
    app.worldGenerationJob = null;
    app.worldGenerationLoadingActive = false;
    app.worldGenerationStarted = false;
    app.pendingWorldGenerationPrompt = "";
    setTurnStage("idle", "Ready");
  }
  function disableAutoVisualNovel(reason = "new game loaded") {
    if (!app.settings.autoVisualNovel) return;
    app.settings.autoVisualNovel = false;
    clearAutoAdvanceTimer();
    app.autoAdvanceWaitingForVoiceMessageId = null;
    troubleshootingLog("auto mode disabled", {
      reason
    });
  }
  function restoreMessageMutationBackup(message, reason, fallbackBackup = null) {
    if (!messageStateWasProcessed(message)) return {
      restored: false
    };
    const backup = stateBackupForMessage(message) || fallbackBackup;
    if (!backup) {
      showNotice("No State Backup", "This message has already been processed, and EmberAdventures does not have a state backup from before it. It cannot be edited, deleted, or refreshed safely.");
      return null;
    }
    if (app.saveSessionActive) {
      return (async () => {
        const snapshotId = String(backup.id || backup.snapshotId || "").trim();
        const saveId = activeSaveId();
        if (!snapshotId || !saveId) throw new Error("Processed message rollback requires an active save and persisted snapshot.");
        await flushRuntimeSaveProjections();
        await app.persistence.rollbackSnapshot(snapshotId);
        await loadSaveIntoRuntime(saveId, {
          scrollChatToBottom: false
        });
        return {
          restored: true,
          backup,
          startMessageId: backup.startMessageId || message.stateBackupStartMessageId || message.id
        };
      })();
    }
    // SANITIZE REPLACED: message rewind restores the exact captured runtime
    // snapshot. Bad snapshots are bugs and must not be silently repaired.
    // SANITIZE TEST: Covered by message action rollback smoke coverage.
    restoreRuntimeSnapshotForMessageRollback(backup);
    pruneSnapshotsAfter(backup);
    return {
      restored: true,
      backup,
      startMessageId: backup.startMessageId || message.stateBackupStartMessageId || message.id
    };
  }
  function trimMessagesForMutation(targetId, mode, resetStartId = "", targetEntryFallback = 0, resetEntryFallback = 0) {
    const targetEntryId = Number(findMessageById(targetId)?.entryId || targetEntryFallback || targetId || 0);
    const resetEntryId = Number(findMessageById(resetStartId)?.entryId || resetEntryFallback || resetStartId || targetEntryId);
    const removedIds = [];
    app.messages = (app.messages || []).filter(message => {
      const entryId = Number(message.entryId || message.id || 0);
      if (entryId > targetEntryId) {
        removedIds.push(message.id);
        return false;
      }
      if (mode === "delete" && (String(message.id) === String(targetId) || entryId === targetEntryId)) {
        removedIds.push(message.id);
        return false;
      }
      return true;
    });
    if (removedIds.length) {
      rebuildMessageIndex();
      touchMessageRevision();
    }
    for (const removedId of removedIds) {
      stopReadingMessageIfActive(removedId);
      clearPendingVoiceMetadataGate(removedId);
      cancelAiRequestsForMessage(removedId, "message list changed");
      cancelActiveStateCheckForMessage(removedId, "message list changed");
    }
    for (const message of app.messages || []) {
      const entryId = Number(message.entryId || message.id || 0);
      if (entryId >= resetEntryId && isStoryMessageRole(message.role)) {
        message.stateSyncStatus = "pending";
        delete message.stateBackupId;
        delete message.stateBackupStartMessageId;
      }
    }
  }
  function prepareMessageStateMutation(message, {
    mode = "edit",
    reason = "message changed"
  } = {}) {
    // Invariant: edit, delete, and regenerate all enter through this
    // state-reset path. If any small or full state pass already touched the
    // message, restore the pre-message backup first; if no pass touched it,
    // the reset is a no-op because there are no state effects to unwind.
    if (!message || !isStoryMessageRole(message.role)) return null;
    if (!messageMutationAllowed(message)) {
      showNotice("No State Backup", "This processed message cannot be changed because EmberAdventures does not have a pre-message state backup for it.");
      return null;
    }
    const targetId = message.id;
    const targetEntryId = Number(message.entryId || message.id || 0);
    const affectedMessageIds = (app.messages || []).filter(item => {
      const entryId = Number(item.entryId || item.id || 0);
      return entryId >= targetEntryId && isStoryMessageRole(item.role);
    }).map(item => item.id);
    const blockBackup = activeStateSyncBlockBackupForMessage(message);
    const knownStartMessageId = blockBackup?.startMessageId || message.stateBackupStartMessageId || targetId;
    const knownStartEntryId = Number(findMessageById(knownStartMessageId)?.entryId || 0);
    cancelStateWorkForMessageMutation(affectedMessageIds.length ? affectedMessageIds : [targetId], reason);

    // Only a completed or active broad state pass requires the full
    // background recheck after this mutation.
    const needsFullStateRecheck = messageBroadStateWasProcessed(message);
    const restore = restoreMessageMutationBackup(message, reason, blockBackup);
    const finishPreparation = restored => {
      if (!restored) return null;
      const stateRecheckStartMessageId = restored.startMessageId || targetId;
      const snapshotStartEntryId = [...(restored.backup?.runtime?.messages || []), ...(restored.backup?.messages || [])].find(item => String(item?.id) === String(stateRecheckStartMessageId))?.entryId;
      const restoredStartMessage = (app.messages || []).find(item => String(item?.id) === String(stateRecheckStartMessageId));
      const stateRecheckStartEntryId = [knownStartEntryId, restoredStartMessage?.entryId, snapshotStartEntryId, targetEntryId].map(value => Number(value)).find(value => Number.isFinite(value) && value > 0) || targetEntryId;
      trimMessagesForMutation(targetId, mode === "delete" ? "delete" : "edit", stateRecheckStartMessageId, targetEntryId, stateRecheckStartEntryId);
      return {
        mode,
        restored: !!restored.restored,
        needsFullStateRecheck,
        targetId,
        targetEntryId,
        affectedMessageIds,
        stateRecheckStartMessageId,
        stateRecheckStartEntryId
      };
    };
    return restore && typeof restore.then === "function" ? restore.then(finishPreparation) : finishPreparation(restore);
  }
  function requestFullStateRecheckAfterMessageMutation(reason = "message changed") {
    // Fully incorporated message edits/deletes/regenerates must all rerun the
    // normal background state updater from the restored backup point forward.
    // Regenerate must not do a private inline state check because that skips
    // the same pending-message/status path edit and delete use.
    if (!pendingStateSyncMessages().length) return false;
    enqueueStateSync(reason);
    return true;
  }
  async function editMessage(id) {
    const message = findMessageById(id);
    if (!message || !isStoryMessageRole(message.role)) return;
    if (!messageMutationAllowed(message)) {
      await showNotice("No State Backup", "This processed message cannot be edited because there is no pre-message state backup available.");
      return;
    }
    const next = await showPrompt("Edit Message", "", message.text || "", {
      rows: 8,
      submitText: "Done"
    });
    if (next == null) return;
    const mutation = await prepareMessageStateMutation(message, {
      mode: "edit",
      reason: "message edited"
    });
    if (!mutation) return;
    const editedMessage = findMessageById(id);
    if (!editedMessage) return;
    editedMessage.text = next;
    editedMessage.edited = true;
    delete editedMessage.voiceText;
    delete editedMessage.voiceMeta;
    delete editedMessage.voiceSpeakers;
    clearPendingVoiceMetadataGate(editedMessage.id);
    editedMessage.stateSyncStatus = "pending";
    touchMessageRevision(editedMessage);
    scheduleActiveGameSave();
    if (editedMessage.role === "user") {
      app.queue.push({
        text: editedMessage.text || next,
        visibleText: editedMessage.text || next,
        skipUserStateCheck: false,
        commandOnly: false,
        source: "user",
        speaker: editedMessage.speaker || app.state.player?.name || "Player",
        autoRead: !!app.settings.autoReadPlayerMessages,
        messageId: editedMessage.id
      });
      setStatus(`Queued ${app.queue.length} message(s)`);
      requestRuntimeMutationRender("user message edited");
      if (!queueProcessingBlocked()) processQueue();
      return;
    }
    await runImmediateChecksForMutatedMessage(editedMessage, {
      reason: "message edited",
      stateRecheckStartMessageId: mutation.stateRecheckStartMessageId
    });
    if (mutation.needsFullStateRecheck) requestFullStateRecheckAfterMessageMutation("message edited");
    requestRuntimeMutationRender("assistant message edited");
  }
  function readMessage(id, options = {}) {
    // Reading a different message starts a fresh segment-highlight session;
    // splitVoiceParts keeps sticky quote speakers local to each message.
    const message = findEntryById(id);
    if (!message) return;
    if (options.sequence !== false && !options.appendIfBusy) {
      readMessageSequenceFrom(id);
      return;
    }
    readSingleMessage(message, options);
  }
  function readMessageSequenceFrom(id) {
    const entries = readableVoiceMessagesFrom(id);
    if (!entries.length) return;
    // Manual read buttons restart at the clicked message and enqueue later
    // visible messages so the active stop button follows the message currently
    // being spoken instead of sticking to the newest message in the thread.
    stopReadingMessage(false);
    app.stoppedVoiceMessageIds.clear();
    for (const [index, entry] of entries.entries()) {
      readSingleMessage(entry, {
        appendIfBusy: index > 0,
        sequence: false,
        manualSequence: true,
        voiceSessionPrepared: index === 0
      });
    }
  }
  function readableVoiceMessagesFrom(id) {
    const entries = visibleMessagesForRender().filter(isReadableVoiceMessage);
    const startIndex = entries.findIndex(entry => String(entry.id) === String(id));
    return startIndex >= 0 ? entries.slice(startIndex) : [];
  }
  function isReadableVoiceMessage(message = {}) {
    if (!message || message.role === "command") return false;
    return !!String(message.text || "").trim();
  }
  function readSingleMessage(message, options = {}) {
    if (voiceIsPaused()) {
      stopReadingMessage(false);
      app.stoppedVoiceMessageIds.delete(String(message.id));
    }
    const autoVoice = !(options.manual || options.manualSequence);
    if (message.role === "assistant") {
      if (message.gameMessageType === "unlock_greeting" && message.speaker) {
        speakCharacterText(message.text, message.speaker, message.id, {
          appendIfBusy: !!options.appendIfBusy,
          auto: autoVoice
        });
        return;
      }
      speakReply(message.voiceText || message.text, message.speaker || firstCharacterName(), message.id, {
        gateDialogueUntilMetadata: !!options.gateDialogueUntilMetadata,
        appendIfBusy: !!options.appendIfBusy,
        auto: autoVoice,
        voiceSessionPrepared: !!options.voiceSessionPrepared
      });
      return;
    }
    if (message.role === "user") {
      speakPlayerText(message.text, message.id, {
        appendIfBusy: !!options.appendIfBusy,
        auto: autoVoice,
        voiceSessionPrepared: !!options.voiceSessionPrepared
      });
      return;
    }
    if (message.role === "game" && message.gameMessageType === "unlock_greeting" && message.speaker) {
      speakCharacterText(message.text, message.speaker, message.id, {
        appendIfBusy: !!options.appendIfBusy,
        auto: autoVoice
      });
      return;
    }
    const appendIfBusy = !!options.appendIfBusy && !!(voiceUtteranceQueueHasWork() || window.speechSynthesis?.speaking || window.speechSynthesis?.pending);
    speakText(message.text, "Narrator", {
      auto: false,
      append: appendIfBusy,
      replaceQueue: !appendIfBusy && !options.voiceSessionPrepared,
      messageId: message.id
    });
  }
  function setActiveVoiceMessage(messageId) {
    const previousMessageId = app.activeVoiceMessageId;
    app.stoppedVoiceMessageIds.delete(String(messageId));
    app.activeVoiceMessageId = messageId;
    // Record actual speech start here, not when an utterance is merely queued.
    // Queued messages should not steal Auto-mode gating or the stop button.
    app.autoVoiceStartedMessageIds.add(String(messageId));
    app.activeVoiceToken += 1;
    app.activeVoiceStartedAt = Date.now();
    app.voicePaused = false;
    app.voiceHighlight = null;
    app.voiceHighlightLastEnd = 0;
    scheduleDirectObjectiveChoiceAutoOpen("voice started", messageId);
    syncActiveVoiceMessageDom(previousMessageId, messageId);
    renderVoicePauseButton();
    const token = app.activeVoiceToken;
    clearTimeout(app.voiceIdleWatchdogTimer);
    const checkForIdleVoice = () => {
      if (token !== app.activeVoiceToken) return;
      if (clearIdleVoiceState()) return;
      if (token !== app.activeVoiceToken || app.activeVoiceMessageId == null) return;
      app.voiceIdleWatchdogTimer = setTimeout(checkForIdleVoice, 100);
    };
    app.voiceIdleWatchdogTimer = setTimeout(checkForIdleVoice, 1500);
    return app.activeVoiceToken;
  }
  function ensureActiveVoiceMessage(messageId) {
    if (messageId == null) return null;
    app.stoppedVoiceMessageIds.delete(String(messageId));
    if (String(app.activeVoiceMessageId || "") === String(messageId)) return app.activeVoiceToken;
    return setActiveVoiceMessage(messageId);
  }
  function clearActiveVoiceMessage(token = app.activeVoiceToken) {
    if (token !== app.activeVoiceToken) return;
    clearTimeout(app.voiceIdleWatchdogTimer);
    app.voiceIdleWatchdogTimer = null;
    const previousMessageId = app.activeVoiceMessageId;
    finishDirectObjectiveChoiceAutoOpenAfterReading(app.activeVoiceMessageId);
    app.activeVoiceMessageId = null;
    app.activeVoiceStartedAt = 0;
    app.voicePaused = false;
    app.voiceHighlight = null;
    app.voiceHighlightLastEnd = 0;
    syncActiveVoiceMessageDom(previousMessageId, null);
    renderVoicePauseButton();
  }
  function clearActiveVoiceMessageWhenDone(token) {
    setTimeout(() => {
      if (voiceUtteranceQueueHasWork() || window.speechSynthesis?.speaking || window.speechSynthesis?.pending || window.speechSynthesis?.paused || app.voicePaused) return;
      clearActiveVoiceMessage(token);
    }, 160);
  }
  function stopReadingMessageIfActive(messageId) {
    // Stopping the active message clears the current segment highlight. Sticky
    // quote speakers are local split results, so no speaker state survives.
    if (messageId == null) return;
    app.stoppedVoiceMessageIds.add(String(messageId));
    clearPendingVoiceMetadataGate(messageId);
    if (String(app.activeVoiceMessageId) !== String(messageId)) return;
    const previousMessageId = app.activeVoiceMessageId;
    cancelDirectObjectiveChoiceAutoOpen();
    app.activeVoiceToken += 1;
    app.activeVoiceMessageId = null;
    app.activeVoiceStartedAt = 0;
    app.voicePaused = false;
    app.voiceHighlight = null;
    app.voiceHighlightLastEnd = 0;
    resetVoiceSpeechQueue();
    syncActiveVoiceMessageDom(previousMessageId, null);
    renderVoicePauseButton();
  }
  function stopReadingMessage(askDisableAutoRead = false) {
    // Full cancellations and sequence restarts clear the current segment
    // highlight. Sticky quote speakers are local split results.
    const activeId = app.activeVoiceMessageId;
    const activeMessage = findEntryById(activeId);
    if (activeId != null) app.stoppedVoiceMessageIds.add(String(activeId));
    clearPendingVoiceMetadataGate(activeId);
    cancelDirectObjectiveChoiceAutoOpen();
    app.activeVoiceToken += 1;
    app.activeVoiceMessageId = null;
    app.activeVoiceStartedAt = 0;
    app.voicePaused = false;
    app.voiceHighlight = null;
    app.voiceHighlightLastEnd = 0;
    resetVoiceSpeechQueue();
    maybeAskDisableAutoRead(activeMessage, askDisableAutoRead);
    syncActiveVoiceMessageDom(activeId, null);
    renderVoicePauseButton();
  }
  function syncActiveVoiceMessageDom(previousMessageId = null, activeMessageId = null) {
    const ids = new Set([previousMessageId, activeMessageId].filter(id => id != null).map(String));
    for (const id of ids) {
      const article = document.querySelector(`#thread [data-message-id="${cssEscape(id)}"]`);
      if (!article) continue;
      const active = String(activeMessageId ?? "") === id;
      article.classList.toggle("voice-active", active);
      const actions = article.querySelector(".message-actions");
      const existingStop = actions?.querySelector("[data-voice-stop-action]");
      if (active && actions && !existingStop) actions.insertAdjacentHTML("afterbegin", `<button class="message-action danger" data-voice-stop-action="1" title="Stop reading" onclick="EmberAdventures.stopReadingMessage(true)">&#128263;</button>`);
      if (!active) existingStop?.remove();
      const message = findEntryById(id);
      const content = article.querySelector(".message-content");
      if (message && content) content.innerHTML = formatMessageWithVoiceHighlight(message);
    }
  }
  function clearVoiceMessageRuntimeState() {
    // Voice ids are message-local, and template/game starts can reuse ids
    // like 1. Game boundaries must not inherit stopped/started flags from
    // the previous save.
    app.stoppedVoiceMessageIds?.clear?.();
    app.autoVoiceStartedMessageIds?.clear?.();
    app.streamedVoiceReplyIds?.clear?.();
    app.voiceMetadataPendingMessageIds?.clear?.();
    app.pendingVoiceDialogueParts?.clear?.();
    clearTimeout(app.voiceIdleWatchdogTimer);
    app.voiceIdleWatchdogTimer = null;
    resetVoiceSpeechQueue();
    cancelDirectObjectiveChoiceAutoOpen();
  }
  function clearIdleVoiceState() {
    if (app.activeVoiceMessageId == null) return false;
    const synth = window.speechSynthesis;
    const current = app.voiceUtteranceCurrent;
    const queued = !!app.voiceUtteranceQueue?.length;
    const synthIsIdle = !(synth?.speaking || synth?.pending || app.voicePaused);
    if (!current) {
      app.voiceCurrentIdleSince = 0;
      if (queued && synthIsIdle) scheduleVoiceUtterancePump();
    } else if (synthIsIdle) {
      const now = Date.now();
      if (!app.voiceCurrentIdleSince) app.voiceCurrentIdleSince = now;
      if (now - app.voiceCurrentIdleSince >= 1200) {
        log("Voice utterance idle recovery", compactJson({
          messageId: current.messageId,
          textLength: String(current.text || "").length,
          remainingSegments: app.voiceUtteranceQueue?.length || 0
        }), {
          type: "voice",
          level: "warn"
        });
        current.onend?.({
          recovery: "idle-watchdog"
        });
        finishQueuedVoiceUtterance(current, "recovered");
        app.voiceCurrentIdleSince = 0;
      }
    } else {
      app.voiceCurrentIdleSince = 0;
    }
    if (voiceUtteranceQueueHasWork() || synth?.speaking || synth?.pending || app.voicePaused) return false;
    const startedAt = Number(app.activeVoiceStartedAt || 0);
    if (startedAt && Date.now() - startedAt < 1200) return false;
    finishDirectObjectiveChoiceAutoOpenAfterReading(app.activeVoiceMessageId);
    app.activeVoiceToken += 1;
    clearTimeout(app.voiceIdleWatchdogTimer);
    app.voiceIdleWatchdogTimer = null;
    app.activeVoiceMessageId = null;
    app.activeVoiceStartedAt = 0;
    app.voiceHighlight = null;
    app.voiceHighlightLastEnd = 0;
    renderThread();
    renderVoicePauseButton();
    return true;
  }
  function voicePlaybackIsVisible() {
    const synth = window.speechSynthesis;
    return !!(synth && (synth.speaking || synth.pending || synth.paused || voiceUtteranceQueueHasWork() || app.activeVoiceMessageId != null));
  }
  function pauseNarrationForModal() {
    app.narrationModalPauseDepth += 1;
    const synth = window.speechSynthesis;
    if (synth && !app.voicePaused && !synth.paused && (synth.speaking || synth.pending)) {
      app.narrationModalPausedSpeech = true;
      app.voicePaused = true;
      synth.pause?.();
    }
    renderVoicePauseButton();
  }
  function resumeNarrationForModal() {
    app.narrationModalPauseDepth = Math.max(0, Number(app.narrationModalPauseDepth || 0) - 1);
    if (app.narrationModalPauseDepth > 0) return;
    const synth = window.speechSynthesis;
    if (app.narrationModalPausedSpeech) {
      app.narrationModalPausedSpeech = false;
      app.voicePaused = false;
      synth?.resume?.();
    }
    scheduleVoiceUtterancePump();
    renderThread();
    renderVoicePauseButton();
  }
  function voiceIsPaused() {
    return !!(app.narrationModalPauseDepth > 0 || app.voicePaused || window.speechSynthesis?.paused);
  }
  function renderVoicePauseButton() {
    const button = $("voicePauseBtn");
    if (!button) return;
    const synth = window.speechSynthesis;
    const visible = voicePlaybackIsVisible();
    button.classList.toggle("hidden", !visible);
    if (!visible) return;
    const paused = voiceIsPaused();
    const icon = button.querySelector(".tool-icon");
    if (icon) icon.innerHTML = paused ? "&#9658;" : "&#9208;";
    button.title = paused ? "Resume voice" : "Pause voice";
    button.setAttribute("aria-label", button.title);
  }
  function toggleVoicePause() {
    const synth = window.speechSynthesis;
    if (!synth || !voicePlaybackIsVisible()) return;
    if (app.voicePaused || synth.paused) {
      app.voicePaused = false;
      synth.resume?.();
    } else if (synth.speaking || synth.pending || voiceUtteranceQueueHasWork() || app.activeVoiceMessageId != null) {
      app.voicePaused = true;
      synth.pause?.();
    }
    renderThread();
    renderVoicePauseButton();
  }
  async function maybeAskDisableAutoRead(message, enabled) {
    if (!enabled || !message) return;
    if (message.role === "user" && !app.settings.playerReadDisablePromptSeen) {
      app.settings.playerReadDisablePromptSeen = true;
      if (await showConfirm("Disable Player Auto-Read?", "Disable automatic reading for your player messages? You can turn it back on later in Settings. You can also change the player voice from the player settings and the narrator voice from main Settings.", {
        confirmText: "Disable"
      })) {
        app.settings.autoReadPlayerMessages = false;
        saveSettingsNow("player auto-read disabled");
      }
      scheduleActiveGameSave();
      return;
    }
    if (message.role === "assistant" && !app.settings.characterReadDisablePromptSeen) {
      app.settings.characterReadDisablePromptSeen = true;
      if (await showConfirm("Disable Character Auto-Read?", "Disable automatic reading for character replies? You can turn it back on later in Settings. You can also change each character's voice from their character settings and the narrator voice from main Settings.", {
        confirmText: "Disable"
      })) {
        app.settings.autoVoice = false;
        saveSettingsNow("character auto-read disabled");
      }
      scheduleActiveGameSave();
    }
  }
  function stateSyncClassForMessage(message = {}) {
    if (!isStoryMessageRole(message.role)) return "";
    const status = message.stateSyncStatus || "pending";
    if (status === "processing") {
      const isInActiveRange = app.stateSync?.running && (app.stateSync.processingMessageIds || []).some(id => String(id) === String(message.id));
      if (!isInActiveRange) return "state-sync-pending";
      const groupClass = app.stateSync.currentGroup ? ` group-${cssEscape(app.stateSync.currentGroup)}` : "";
      return `state-sync-processing${groupClass}`;
    }
    if (status === "synced") return "state-sync-complete";
    return "state-sync-pending";
  }
  function stateSyncStyleForMessage(message = {}) {
    if (!isStoryMessageRole(message.role)) return "";
    const status = message.stateSyncStatus || "pending";
    if (status === "synced") return stateSyncProgressStyle(1);
    if (status === "processing") {
      const isInActiveRange = app.stateSync?.running && (app.stateSync.processingMessageIds || []).some(id => String(id) === String(message.id));
      return stateSyncProgressStyle(isInActiveRange ? stateSyncProgressRatio() : 0);
    }
    return stateSyncProgressStyle(0);
  }
  function stateSyncProgressRatio() {
    if (!app.stateSync?.running) return 0;
    const total = stateSyncTotalStepCount();
    if (!total) return 0;
    return Math.max(0, Math.min(1, stateSyncCompletedStepCount() / total));
  }
  function stateSyncProgressStyle(ratio = 0) {
    const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    const orange = {
      r: 245,
      g: 158,
      b: 11
    };
    const green = {
      r: 34,
      g: 197,
      b: 94
    };
    const r = Math.round(orange.r + (green.r - orange.r) * clamped);
    const g = Math.round(orange.g + (green.g - orange.g) * clamped);
    const b = Math.round(orange.b + (green.b - orange.b) * clamped);
    return `--state-sync-border: rgba(${r}, ${g}, ${b}, 0.82); --state-sync-shadow: rgba(${r}, ${g}, ${b}, 0.18);`;
  }
  async function deleteMessage(id) {
    const message = findMessageById(id);
    if (!message) return;
    if (!isStoryMessageRole(message.role)) {
      if (!(await showConfirm("Delete Message", "Delete this message?", {
        confirmText: "Delete",
        danger: true
      }))) return;
      stopReadingMessageIfActive(id);
      removeMessageById(id);
      requestRenderRegions({
        thread: true,
        hud: true
      }, "non-story message deleted");
      return;
    }
    if (!messageMutationAllowed(message)) {
      await showNotice("No State Backup", "This processed message cannot be deleted because there is no pre-message state backup available.");
      return;
    }
    if (!(await showConfirm("Delete Message", "Delete this message?", {
      confirmText: "Delete",
      danger: true
    }))) return;
    stopReadingMessageIfActive(id);
    const mutation = await prepareMessageStateMutation(message, {
      mode: "delete",
      reason: "message deleted"
    });
    if (!mutation) return;
    if (!mutation.restored) cancelAiRequestsForMessage(id, "message deleted");
    scheduleActiveGameSave();
    const stateRecheckMessages = stateRecheckMessageRangeByEntryIds(mutation.stateRecheckStartEntryId, mutation.targetEntryId);
    await runImmediateChecksForMutatedRange(stateRecheckMessages, {
      reason: "message deleted"
    });
    if (mutation.needsFullStateRecheck && stateRecheckMessages.length) requestFullStateRecheckAfterMessageMutation("message deleted");
    requestRuntimeMutationRender("message deleted");
  }
  function openRegenerateMessageModal(id) {
    const message = findMessageById(id);
    if (!message || message.role !== "assistant") return;
    if (!messageMutationAllowed(message)) {
      showNotice("No State Backup", "This processed message cannot be regenerated because there is no pre-message state backup available.");
      return;
    }
    openModal(`
                <h2>Regenerate Message</h2>
                <p class="hint">Optional: tell the AI what was wrong or what you want changed. Leave it blank to simply try again.</p>
                <textarea id="regenerateFeedback" rows="6" placeholder="Example: Make it less rushed, let Lilith answer directly, include more scene description, or avoid repeating the last line."></textarea>
                <div class="row" style="margin-top: .8rem">
                    <button class="primary" id="confirmRegenerateBtn">Regenerate</button>
                </div>
            `);
    $("regenerateFeedback")?.focus?.();
    $("confirmRegenerateBtn").onclick = () => {
      const feedback = $("regenerateFeedback")?.value || "";
      closeModal();
      redoMessage(id, feedback);
    };
  }
  async function redoMessage(id, feedback = "") {
    return regenerateAssistantMessage(id, feedback, {
      reason: "message refreshed",
      statusText: "Regenerating message...",
      noBackupTitle: "No State Backup",
      noBackupMessage: "This processed message cannot be refreshed because there is no pre-message state backup available."
    });
  }
  async function regenerateAssistantMessage(id, feedback = "", options = {}) {
    const message = findMessageById(id);
    if (!message || message.role !== "assistant") return false;
    if (!messageMutationAllowed(message)) {
      await showNotice(options.noBackupTitle || "No State Backup", options.noBackupMessage || "This processed message cannot be regenerated safely because there is no pre-message state backup available.");
      return false;
    }
    if (app.busy) {
      if (aiRequestMatchesMessage(app.aiActive, id)) {
        const mutation = await prepareMessageStateMutation(message, {
          mode: "regenerate",
          reason: options.reason || "streaming message regenerated"
        });
        if (!mutation) return false;
        const redoTarget = findMessageById(id);
        if (!redoTarget) return false;
        stopReadingMessageIfActive(id);
        cancelAiRequestsForMessage(id, "streaming message regenerated");
        redoTarget.text = "";
        redoTarget.hiddenWhileRegenerating = true;
        redoTarget.redone = true;
        redoTarget.stateSyncStatus = "pending";
        delete redoTarget.voiceText;
        delete redoTarget.voiceMeta;
        delete redoTarget.voiceSpeakers;
        clearPendingVoiceMetadataGate(id);
        app.pendingRegenerateMessage = {
          id,
          feedback
        };
        scheduleActiveGameSave();
        setStatus("Cancelling streamed message...");
        requestRuntimeMutationRender("streaming message regenerated");
        return true;
      }
      if (cancelActiveStateCheckForMessage(id, "message regeneration requested")) {
        app.pendingRegenerateMessage = {
          id,
          feedback
        };
        setStatus("Cancelling stale state check...");
        requestRuntimeMutationRender("state check cancelled for regeneration");
      }
      return false;
    }
    const mutation = await prepareMessageStateMutation(message, {
      mode: "regenerate",
      reason: options.reason || "message refreshed"
    });
    if (!mutation) return false;
    const redoTarget = findMessageById(id);
    if (!redoTarget) return false;
    redoTarget.text = "";
    redoTarget.hiddenWhileRegenerating = true;
    redoTarget.redone = true;
    redoTarget.stateSyncStatus = "pending";
    scheduleActiveGameSave();
    app.busy = true;
    let needsQueuedFullStateRecheck = false;
    requestRuntimeMutationRender("message regeneration started");
    try {
      setStatus(options.statusText || "Regenerating message...");
      const reply = await generateReply(id, feedback);
      if (!findMessageById(id)) return false;
      updateMessage(id, reply);
      await runImmediateChecksForMutatedMessage(findMessageById(id), {
        text: reply,
        reason: options.reason || "message refreshed",
        stateRecheckStartMessageId: mutation.stateRecheckStartMessageId
      });
      needsQueuedFullStateRecheck = !!mutation.needsFullStateRecheck;
      await afterReplyEffects(reply, id);
      setStatus("Ready");
      return true;
    } catch (err) {
      if (isAiCancelledError(err)) {
        setStatus("Ready");
        return false;
      }
      delete message.hiddenWhileRegenerating;
      message.text = "Regenerate failed: " + (err.message || err);
      setStatus("Error");
      scheduleActiveGameSave();
      return false;
    } finally {
      app.busy = false;
      if (needsQueuedFullStateRecheck) requestFullStateRecheckAfterMessageMutation(options.reason || "message refreshed");
      requestRuntimeMutationRender("message regeneration finished");
    }
  }
  function formatMessage(text) {
    return formatMessageRanges(displayRuntimeTemplateText(text));
  }
  function formatMessageWithVoiceHighlight(message = {}) {
    const highlight = app.voiceHighlight;
    const text = displayRuntimeTemplateText(message.text);
    if (!highlight || String(highlight.messageId) !== String(message.id) || !Number.isFinite(highlight.start) || !Number.isFinite(highlight.end) || highlight.end <= highlight.start || highlight.start < 0 || highlight.end > text.length) return formatMessage(text);
    return formatMessageRanges(text, {
      start: highlight.start,
      end: highlight.end
    });
  }
  function isVisibleVoiceSpeakerLabel(text = "") {
    const label = String(text || "").trim();
    if (!label || label.length > 80) return false;
    if (/[":;,.!?()[\]{}]/.test(label)) return false;
    return !!(isPlayerEntityName(label) || speakerExistsAsEntity(label) || voiceCharacterForSpeaker(label, null) || /^[A-Z][A-Za-z0-9'?-]*(?:\s+[A-Z][A-Za-z0-9'?-]*){0,4}$/.test(label));
  }
  function formatMessageSegmentHtml(rawText = "", className = "") {
    const parts = String(rawText || "").split(/(\n+)/);
    return parts.map(part => {
      if (!part) return "";
      if (/^\n+$/.test(part)) return part.replace(/\n/g, "<br>");
      if (className !== "story-action") return escapeHtml(part);
      const leading = part.match(/^\s*/)?.[0] || "";
      const trailing = part.match(/\s*$/)?.[0] || "";
      const core = part.trim();
      if (!isVisibleVoiceSpeakerLabel(core)) return escapeHtml(part);
      return `${escapeHtml(leading)}<span class="story-voice-label">${escapeHtml(core)}</span>${escapeHtml(trailing)}`;
    }).join("");
  }
  function formatMessageRanges(text = "", highlight = null) {
    const value = String(text || "");
    const ranges = [];
    const quoteRegex = /"[^"\n]+"/g;
    let cursor = 0;
    let match;
    while (match = quoteRegex.exec(value)) {
      if (match.index > cursor) ranges.push({
        start: cursor,
        end: match.index,
        className: "story-action"
      });
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
        className: "story-dialogue"
      });
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) ranges.push({
      start: cursor,
      end: value.length,
      className: "story-action"
    });
    if (!ranges.length) ranges.push({
      start: 0,
      end: 0,
      className: "story-action"
    });
    const highlightStart = Number(highlight?.start);
    const highlightEnd = Number(highlight?.end);
    const hasHighlight = Number.isFinite(highlightStart) && Number.isFinite(highlightEnd) && highlightEnd > highlightStart;
    const renderSegment = (start, end, className, active = false) => {
      if (end <= start) return "";
      const html = formatMessageSegmentHtml(value.slice(start, end), className);
      const content = active ? `<span class="voice-current-word">${html}</span>` : html;
      return `<span class="${className}">${content}</span>`;
    };
    return ranges.map(range => {
      if (!hasHighlight || highlightEnd <= range.start || highlightStart >= range.end) return renderSegment(range.start, range.end, range.className);
      return renderSegment(range.start, Math.max(range.start, highlightStart), range.className) + renderSegment(Math.max(range.start, highlightStart), Math.min(range.end, highlightEnd), range.className, true) + renderSegment(Math.min(range.end, highlightEnd), range.end, range.className);
    }).join("");
  }
  function recentChatForPrompt(limit = 16, separator = "\n\n") {
    return app.messages.filter(message => isStoryMessageRole(message.role) && String(message.text || "").trim()).slice(-limit).map(message => {
      const speaker = promptEntityName(message.speaker || (message.role === "assistant" ? "Narrator" : app.state.player?.name || "the player"));
      return `${speaker}: ${displayRuntimeTemplateText(message.text)}`;
    }).join(separator);
  }
  function renderCharacters() {
    const scene = app.state.scene || {};
    const playerList = $("playerList");
    const characterList = $("characterList");
    const npcList = $("npcSceneList");
    const preservedPlayerNodes = preserveActiveProfileImageNodes(playerList);
    const preservedCharacterNodes = preserveActiveProfileImageNodes(characterList);
    const preservedNpcNodes = preserveActiveProfileImageNodes(npcList);
    const activeNames = [...(scene.party_members_present || []), ...(scene.npcs_present || [])].filter(Boolean);
    const partyEntries = Object.entries(app.state.characters || {}).map(([name, character]) => [name, character, false]).filter(([name, character]) => activeNames.some(reference => characterReferenceMatchesEntity(reference, name, character)));
    if (playerList) playerList.innerHTML = partyCharacterCardHtml("Player", app.state.player || {}, {
      isPlayer: true,
      presenceMode: "none"
    });
    if (characterList) characterList.innerHTML = partyEntries.length ? partyEntries.map(([name, character, isPlayer]) => partyCharacterCardHtml(name, character, {
      isPlayer,
      presenceMode: "remove"
    })).join("") : `<div class="hint">No party members in the scene.</div>`;
    if (npcList) npcList.innerHTML = renderSceneNpcCards();
    restoreActiveProfileImageNodes(playerList, preservedPlayerNodes);
    restoreActiveProfileImageNodes(characterList, preservedCharacterNodes);
    restoreActiveProfileImageNodes(npcList, preservedNpcNodes);
    bindPartyCharacterCardActions(playerList);
    bindPartyCharacterCardActions(characterList);
    bindPartyCharacterCardActions(npcList);
  }
  function refreshCharacterSurfaces(name = "", options = {}) {
    const targetName = String(name || "");
    renderLeftPanel();
    renderCharacters();
    refreshCharactersModalIfOpen();
    renderScene();
    renderQuickActions();
    if (targetName) {
      refreshProfileImageSurfaces(targetName);
      refreshCharacterLibraryProfileSurfaces(targetName);
    }
    if (options.thread) requestRenderRegions({
      thread: true
    }, options.reason || "character surface thread refresh");
    if (options.imagePanel) requestRenderRegions({
      imagePanel: true
    }, options.reason || "character surface image refresh");
  }
  function refreshSceneCharacterSurfaces(names = [], options = {}) {
    const uniqueNames = [...new Set((names || []).map(String).filter(Boolean))];
    renderLeftPanel();
    renderCharacters();
    refreshCharactersModalIfOpen();
    renderScene();
    renderQuickActions();
    for (const name of uniqueNames) {
      refreshProfileImageSurfaces(name);
      refreshCharacterLibraryProfileSurfaces(name);
    }
    if (options.thread) requestRenderRegions({
      thread: true
    }, options.reason || "scene character thread refresh");
    if (options.imagePanel) requestRenderRegions({
      imagePanel: true
    }, options.reason || "scene character image refresh");
  }
  function sceneNpcNames() {
    const scene = app.state.scene || {};
    const partyEntries = Object.entries(app.state.characters || {});
    const player = app.state.player || {};
    return [...(scene.party_members_present || []), ...(scene.npcs_present || [])].filter(reference => reference && reference !== "Player").filter(reference => !characterReferenceMatchesEntity(reference, "Player", player) && !partyEntries.some(([name, character]) => characterReferenceMatchesEntity(reference, name, character))).filter((name, index, list) => list.indexOf(name) === index);
  }
  function renderSceneNpcCards() {
    const names = sceneNpcNames();
    if (!names.length) return `<div class="hint">No NPCs in the scene.</div>`;
    return names.map(name => {
      const found = findNpcInDirectory(app.state.npc_directory, name);
      const key = found?.key || name;
      const locationId = found?.locationId || currentNpcLocationId();
      const npc = found?.npc || {
        name,
        inspected: false
      };
      const searchText = [name, npc?.name, npc?.gender, npc?.age, npc?.role, npc?.relationship, npc?.note, npc?.full_character?.role, npc?.full_character?.personality_description, npc?.full_character?.speech_style, entitySourceSlot(npc?.full_character?.source), entityCreatorSlot(npc?.full_character?.creator)].filter(Boolean).join(" ");
      const cardHtml = npc?.inspected && npc.full_character ? npcCardHtml(key, npc, {
        locationId,
        presenceMode: "toggle",
        sceneCard: true
      }) : partialNpcCardHtml(key, npc, locationId, {
        presenceMode: "remove",
        sceneCard: true
      });
      return `<div class="selectable-card-wrap" data-character-directory-card data-search="${escapeHtml(searchText)}">${cardHtml}</div>`;
    }).join("");
  }
  function renderAllNpcCardsForCharactersModal() {
    const rows = [];
    const seen = new Set();
    for (const [locationId, location] of Object.entries(app.state.npc_directory?.locations || {})) {
      for (const [key, npc] of Object.entries(location?.characters || {})) {
        const name = npc?.name || key;
        const dedupeKey = normalizeNameForMatch(name || key);
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const searchText = [name, key, location?.label, npc?.gender, npc?.age, npc?.role, npc?.relationship, npc?.note, npc?.current_appearance, npc?.full_character?.role, npc?.full_character?.personality_description, npc?.full_character?.speech_style, npc?.full_character?.relationship_to_player, entitySourceSlot(npc?.source ?? npc?.full_character?.source), entityCreatorSlot(npc?.creator ?? npc?.full_character?.creator)].filter(Boolean).join(" ");
        const cardHtml = npc?.inspected && npc.full_character ? npcCardHtml(key, npc, {
          locationId,
          presenceMode: "toggle",
          sceneCard: true
        }) : partialNpcCardHtml(key, npc, locationId, {
          sceneCard: true
        });
        rows.push(`<div class="selectable-card-wrap" data-character-directory-card data-search="${escapeHtml(searchText)}">${cardHtml}</div>`);
      }
    }
    for (const name of sceneNpcNames()) {
      const dedupeKey = normalizeNameForMatch(name);
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const cardHtml = partialNpcCardHtml(name, {
        name,
        inspected: false
      }, currentNpcLocationId(), {
        presenceMode: "remove",
        sceneCard: true
      });
      rows.push(`<div class="selectable-card-wrap" data-character-directory-card data-search="${escapeHtml(`${name} scene nearby`)}">${cardHtml}</div>`);
    }
    return rows.join("") || `<div class="hint">No known NPCs yet.</div>`;
  }
  function cardHtmlWithExportControl(cardHtml = "", controlHtml = "") {
    if (!controlHtml) return cardHtml;
    // Export checkboxes belong inside the visual card. Rendering them as
    // floating siblings above the card can overlap/hide character names
    // as grid cards resize.
    return String(cardHtml).replace(/(<div class="character-card[^>]*>)/, `$1${controlHtml}`);
  }
  function characterOutfitControlsHtml(name, character) {
    if (reducedUiEnabled() || imageEntityIsAnimal(character)) return "";
    const outfits = availableCharacterOutfits(character, name || "character");
    const activeId = character?.active_outfit_id || "";
    const placeholderSelected = activeId ? "" : "selected";
    const options = outfits.map(outfit => `<option value="${escapeHtml(outfit.id)}" ${outfit.id === activeId ? "selected" : ""}>${escapeHtml(outfit.name)}</option>`).join("");
    // Outfit swaps are deliberate clothing-state changes. The card keeps
    // the swap UI local so players can change saved outfits without using
    // the raw state editor, and the AI can use the same active_outfit_id.
    return `
                <div class="row outfit-controls" style="gap:.35rem; margin-top:.45rem">
                    <select title="Saved outfits" ${outfits.length ? "" : "disabled"} onchange="EmberAdventures.selectCharacterOutfit(${htmlJsArg(name)}, this.value)">
                        <option value="" disabled ${placeholderSelected}>${outfits.length ? "Choose outfit" : "No saved outfits"}</option>
                        ${options}
                    </select>
                    <button type="button" class="icon-button" title="Save current clothing as outfit" data-character-action="save-outfit" data-character-name="${escapeHtml(name)}">&#128190;</button>
                </div>
            `;
  }
  function partyCharacterCardHtml(name, character, options = {}) {
    const scene = app.state.scene || {};
    const isPlayer = !!options.isPlayer;
    const animal = imageEntityIsAnimal(character);
    const adultMode = false;
    const showAffectionStats = app.settings.showAffectionStats !== false && !reducedUiEnabled();
    const showClothingControls = adultMode;
    const displayName = character.name || (isPlayer ? playerNameForPrompt(app.state) : name);
    const isPresent = isPlayer || [...(scene.party_members_present || []), ...(scene.npcs_present || [])].some(reference => characterReferenceMatchesEntity(reference, name, character));
    const isImageTarget = (scene.image_characters || []).some(reference => characterReferenceMatchesEntity(reference, name, character));
    const characterId = profileEntityCharacterId(character);
    const profile = activeProfileImage(character);
    const profilePending = profileImageRequestIsPending(name, character);
    const profileHtml = profile ? profileImageInnerHtml(profile) : profilePending ? imageLoadingHtml("") : "";
    const metaText = character.role || character.relationship_to_player || "";
    const meterHtml = isPlayer ? "" : [meter("trust", character.trust), animal ? "" : meter("attraction", character.attraction), meter("affection", character.affection), ""].join("");
    const presenceMode = options.presenceMode || "toggle";
    const presenceButton = presenceMode === "none" ? "" : presenceMode === "remove" ? `<button type="button" class="icon-button warn" title="Remove from scene" data-character-action="present-remove" data-character-name="${escapeHtml(name)}">X</button>` : `<button type="button" class="icon-button ${isPresent ? "party-on" : "party-off"}" title="${isPresent ? "Remove from scene" : "Add to scene"}" data-character-action="present" data-character-name="${escapeHtml(name)}">&#128101;</button>`;
    const card = `
                <div class="character-card ${isPresent ? "active" : ""}" data-character-card data-character-name="${escapeHtml(name)}" ${characterId ? `data-character-id="${escapeHtml(characterId)}"` : ""} ${options.searchText ? `data-search="${escapeHtml(options.searchText)}"` : ""}>
                  <div class="character-name">
                    <span>${escapeHtml(displayName)}</span>
                    <span class="character-age">${Number(character.age) ? Number(character.age) : "age ?"}</span>
                  </div>
                  <button type="button" class="profile-image-button" title="Open profile image picker" data-character-action="profile" data-character-name="${escapeHtml(name)}" ${characterId ? `data-character-id="${escapeHtml(characterId)}"` : ""}>
                    ${profileHtml ? `<div class="profile-image-thumb-wrap" ${profile ? `data-profile-live-id="${escapeHtml(profile.id)}"` : ""}>${profileHtml}</div>` : `<div class="profile-image-placeholder" aria-label="No profile image"></div>`}
                  </button>
                  <div class="character-meta" style="--meta-len:${Math.max(1, String(metaText).length)}">${escapeHtml(metaText)}</div>
                  ${characterOutfitControlsHtml(name, character)}
                  ${showAffectionStats && meterHtml ? `<div class="meters love-stat-meters">${meterHtml}</div>` : ""}
                  <div class="icon-row">
                    ${presenceButton}
                    <button type="button" class="icon-button ${isImageTarget ? "image-on" : "image-off"}" title="${isImageTarget ? "Remove from images" : isPresent ? "Include in images" : "Add to scene before including in images"}" data-character-action="image" data-character-name="${escapeHtml(name)}" ${!isPresent && !isImageTarget ? "disabled" : ""}>&#128247;</button>
                    <button type="button" class="icon-button" title="${isPlayer ? "Edit player state" : "Edit character state"}" data-character-action="${isPlayer ? "player" : "edit"}" data-character-name="${escapeHtml(name)}">&#9998;</button>
                    <button type="button" class="icon-button" title="${isPlayer ? "Player settings" : "Character settings"}" data-character-action="settings" data-character-name="${escapeHtml(name)}">&#9881;</button>
                  </div>
                  ${""}
                </div>
            `;
    if (options.searchText || options.exportName) return `<div class="selectable-card-wrap" data-character-directory-card data-search="${escapeHtml(options.searchText || "")}">
                    ${card}
                </div>`;
    return card;
  }
  function bindPartyCharacterCardActions(root = document) {
    root?.querySelectorAll?.("[data-character-action]").forEach(button => {
      button.onclick = event => {
        // Left-column card actions live inside other interactive panels.
        // Keep these clicks local so image-target toggles cannot bubble
        // into card/list navigation and accidentally open Characters.
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const name = button.dataset.characterName;
        const action = button.dataset.characterAction;
        const refreshDirectoryAfter = ["present", "present-remove", "image", "top-off", "bottom-off", "all-off", "dress", "save-outfit"].includes(action);
        if (action === "present") togglePresence(name);
        if (action === "present-remove") togglePresence(name);
        if (action === "image") toggleImageTarget(name);
        if (action === "profile") openProfileImageModal(name);
        if (action === "player") openPlayerModal();
        if (action === "edit") editCharacter(name);
        if (action === "npc-edit") editNpc(name, button.dataset.npcLocation || "");
        if (action === "settings") openCharacterImageSettings(name);
        if (action === "dress") dressCharacterClothing(name);
        if (action === "save-outfit") saveCharacterCurrentOutfit(name);
        if (refreshDirectoryAfter) refreshCharactersModalIfOpen();
      };
    });
  }
  function preserveActiveProfileImageNodes(container) {
    const preserved = new Map();
    container?.querySelectorAll?.("[data-profile-live-id]").forEach(node => {
      const id = String(node.dataset.profileLiveId || "");
      if (!id || !shouldPreserveProfileImageNode(id, node)) return;
      const marker = document.createTextNode("");
      node.replaceWith(marker);
      preserved.set(id, node);
    });
    return preserved;
  }
  function restoreActiveProfileImageNodes(container, preserved = new Map()) {
    if (!container || !preserved?.size) return;
    for (const [id, node] of preserved.entries()) {
      const target = container.querySelector(`[data-profile-live-id="${cssEscape(id)}"]`);
      if (target) target.replaceWith(node);
    }
  }
  function shouldPreserveProfileImageNode(id, node) {
    const image = profileImageRecordById(id);
    return !!(image?.pending || node?.querySelector?.("iframe") || node?.querySelector?.("[data-src]"));
  }
  function profileImageRecordById(id) {
    const wanted = String(id || "");
    if (!wanted) return null;
    for (const name of profileImageNames()) {
      const entity = profileEntity(name);
      const image = profileImagesForEntity(entity).find(item => String(item.id) === wanted);
      if (image) return image;
    }
    return null;
  }
  function meterIconLabel(label = "") {
    const key = String(label || "").toLowerCase().trim();
    const icons = {
      trust: "🛡",
      attraction: "✨",
      affection: "♥"
    };
    const text = icons[key] || label;
    return `<span class="meter-label-icon" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(text)}</span>`;
  }
  function meter(label, value = 0) {
    const raw = Math.max(0, Math.min(10, Number(value) || 0));
    const v = raw * 10;
    const cleanLabel = String(label || "");
    return `
        <div class="meter" title="${escapeHtml(cleanLabel)}" data-meter="${escapeHtml(cleanLabel.toLowerCase())}" data-meter-value="${escapeHtml(String(raw))}">
          ${meterIconLabel(cleanLabel)}
          <div class="bar" title="${escapeHtml(cleanLabel)}"><span style="width: ${v}%"></span></div>
          <span>${Number.isInteger(raw) ? raw : raw.toFixed(1)}</span>
        </div>
      `;
  }
  function storyShopById(shopId = "", state = app.state) {
    const shops = isPlainObject(state.story_shops) ? state.story_shops : {};
    return shops[String(shopId || "")] || null;
  }
  function unlockedStoryShops(state = app.state) {
    const shops = isPlainObject(state.story_shops) ? state.story_shops : {};
    return Object.values(shops).filter(shop => shop.unlocked !== false);
  }
  function resolveFutureCastEntryById(characterId = "", state = app.state) {
    const id = String(characterId || "").trim();
    if (!id) return null;
    const items = futureCastItems(state);
    return items[id] || null;
  }
  function resolveStoryShopOwnerName(shop = {}, state = app.state) {
    const id = textSlot(shop.owner_npc_id, "");
    if (!id) return "";
    const future = resolveFutureCastEntryById(id, state);
    if (future) return textSlot(future.name || future.full_character?.name, "") || humanizeIdentifierLabel(id);
    const found = findNpcEntryInState(state, id);
    if (found) return textSlot(found.npc?.name, "") || humanizeIdentifierLabel(found.key || id);
    return humanizeIdentifierLabel(id);
  }
  function storyShopLocationLabel(shop = {}) {
    return textSlot(shop.location?.specific_place, "") || textSlot(shop.location?.settlement_name, "") || textSlot(shop.location?.district, "") || textSlot(shop.title, "Shop");
  }
  function ensureFutureCastNpcInDirectory(characterId = "", locationId = "", options = {}) {
    const entry = resolveFutureCastEntryById(characterId);
    if (!entry) return null;
    const name = textSlot(entry.name || entry.full_character?.name, "") || humanizeIdentifierLabel(characterId);
    if (!name) return null;
    const resolvedLocationId = requireNpcLocationId(app.state, locationId, "Story shop NPC");
    const location = ensureNpcDirectoryLocation(app.state, resolvedLocationId, textSlot(options.location_label, currentSettlementName()));
    const characters = location.characters;
    const full = futureCharacterFullCharacter(entry, name, app.state);
    characters[name] = {
      ...(characters[name] || {}),
      name,
      gender: full.gender || entry.gender || "unspecified",
      age: exactStoryCharacterAge(full.age ?? entry.age, `shop NPC ${name}.age`),
      role: textSlot(entry.role || full.role, "shop character"),
      relationship: textSlot(entry.relationship || full.relationship_to_player, "shop contact"),
      note: textSlot(options.note || entry.note || entry.summary, "Available through a story shop."),
      inspected: true,
      can_die: full.can_die === true,
      recruitable: false,
      future_character_id: characterId,
      full_character: full,
      shop_locked: options.shopLocked !== false
    };
    synchronizeRuntimeNpcIdentity(characters[name], name);
    releaseStoryCharacterShopProfileOverride(name);
    applyFutureCharacterImagesToGallery(app.state, entry, name);
    queueProfileImageIfMissing(name, options.reason || "story shop character", {
      allowRuntimeProfileGeneration: true
    });
    return {
      name,
      npc: characters[name],
      locationId: resolvedLocationId,
      locationLabel: location.label
    };
  }
  function storyShopOwnerRole(shop = {}) {
    if (shop.type === "job") return "guild registrar";
    if (shop.type === "character") return "shop owner";
    if (shop.type === "general") return "merchant";
    if (shop.type === "clothing") return "clothier";
    return "shop owner";
  }
  function ensureStoryShopOwnerNpc(shop = {}, locationId = "", options = {}) {
    const ownerId = textSlot(shop.owner_npc_id, "");
    if (!ownerId) return null;
    const futureOwner = ensureFutureCastNpcInDirectory(ownerId, locationId, options);
    if (futureOwner) return futureOwner;
    const name = resolveStoryShopOwnerName(shop) || humanizeIdentifierLabel(ownerId);
    if (!name) return null;
    const resolvedLocationId = requireNpcLocationId(app.state, locationId, "Story shop owner");
    const location = ensureNpcDirectoryLocation(app.state, resolvedLocationId, textSlot(options.location_label, currentSettlementName()));
    const characters = location.characters;
    const existing = characters[name] || {};
    const full = materializeCharacterForRuntime({
      ...blankCharacterTemplate(name),
      ...(existing.full_character || {}),
      name,
      role: textSlot(existing.full_character?.role || existing.role, storyShopOwnerRole(shop)),
      personality_description: textSlot(existing.full_character?.personality_description || existing.note || shop.description, `${name} runs ${shop.title || "this shop"} and handles customers professionally.`)
    }, name, { embeddedStory: true });
    const definitionId = ensureRuntimeCharacterDefinition(full, name);
    full.id = definitionId;
    full.definition_id = definitionId;
    characters[name] = {
      ...existing,
      name,
      definition_id: definitionId,
      gender: full.gender || existing.gender || "unspecified",
      age: exactStoryCharacterAge(full.age ?? existing.age, `shop owner ${name}.age`),
      role: full.role || storyShopOwnerRole(shop),
      relationship: textSlot(existing.relationship || full.relationship_to_player, "shop contact"),
      note: textSlot(options.note || existing.note || shop.description, `${shop.title || "Shop"} owner.`),
      inspected: true,
      can_die: full.can_die === true,
      recruitable: false,
      shop_owner_id: ownerId,
      full_character: full
    };
    synchronizeRuntimeNpcIdentity(characters[name], name);
    queueProfileImageIfMissing(name, options.reason || "story shop owner", {
      allowImportSkipped: true,
      allowRuntimeProfileGeneration: true,
      skipDefault: true
    });
    return {
      name,
      npc: characters[name],
      locationId: resolvedLocationId,
      locationLabel: location.label
    };
  }
  function enterStoryShop(shopId = "") {
    const shop = storyShopById(shopId);
    if (!shop || shop.unlocked === false) {
      showNotice("Shop Unavailable", "That shop is not available right now.");
      return false;
    }
    if (shop.location != null && !isPlainObject(shop.location)) {
      showNotice("Shop Configuration Error", `${shop.title || shop.id} has an invalid location. Reimport the story after fixing story_shops.${shop.id}.location.`);
      return false;
    }
    app.state.location = {
      ...(app.state.location || {}),
      ...(shop.location || {}),
      npc_location_id: storyShopNpcLocationId(shop)
    };
    app.state.scene ||= {};
    replaceSceneNpcPresence(app.state, [], "enter story shop");
    const locationId = storyShopNpcLocationId(shop);
    const ownerId = textSlot(shop.owner_npc_id, "");
    if (ownerId) {
      const owner = ensureStoryShopOwnerNpc(shop, locationId, {
        reason: "story shop owner",
        note: `${shop.title} owner.`,
        location_label: storyShopLocationLabel(shop)
      });
      const ownerName = owner?.name || resolveStoryShopOwnerName(shop);
      if (ownerName) replaceSceneNpcPresence(app.state, [ownerName], "story shop owner placed in scene");
    }
    app.state.recent_changes = [`Entered ${shop.title}.`, ...(app.state.recent_changes || [])].slice(0, 8);
    scheduleActiveGameSave();
    render();
    openStoryShopModal(shop.id);
    return true;
  }
  
