function clamp(value, min, max) {
    const numeric = Number(value);
    const low = Number(min);
    const high = Number(max);
    if (!Number.isFinite(numeric)) return Number.isFinite(low) ? low : 0;
    if (!Number.isFinite(low) && !Number.isFinite(high)) return numeric;
    if (!Number.isFinite(low)) return Math.min(numeric, high);
    if (!Number.isFinite(high)) return Math.max(numeric, low);
    return Math.min(high, Math.max(low, numeric));
  }
  const MENU_ASSET_URLS = Object.freeze({
    "BackgroundImage.png": "https://user.uploads.dev/file/32bbf452275230c5f6e10b3256c331e0.png",
    "BackgroundImage2.png": "https://user.uploads.dev/file/51f3d5362cf873d10449f80d2947b626.png",
    "EmberAdventuresLogo2.png": "https://user.uploads.dev/file/fc6f055b580f5f1a6c07e022a502e1a5.png",
    "BottomButtons.png": "https://user.uploads.dev/file/05419ffb138536619b72d820093f340f.png",
    "BottomButtons2.png": "https://user.uploads.dev/file/4ee5bb93a372e9c2488f0179fd2aba58.png",
    "CampfireButton.png": "https://user.uploads.dev/file/6d7c9ec9fdb765c67884427a9f8299bd.png",
    "CompassButton.png": "https://user.uploads.dev/file/48905d8400a02c6c1ea808ee7dd0440e.png",
    "EmberAdventuresLogo.png": "https://user.uploads.dev/file/47cb3ca9d63172643c18287bfdb1a35d.png",
    "EmberAdventuresLogo3.png": "https://user.uploads.dev/file/f258a159dd1a3da852844803b7f7435d.png",
    "HoodedFigureButton.png": "https://user.uploads.dev/file/5770f60f24204530c1e5bc92401d627c.png",
    "JournalButton.png": "https://user.uploads.dev/file/14022ab6b414fb0689bc95cec2a2daa5.png",
    "OpenBookButton.png": "https://user.uploads.dev/file/4ea0ff73d076d14bafca690c184b540f.png",
    "OpenGatesButton.png": "https://user.uploads.dev/file/c6fc58db157dd0e24c85126e961b474e.png",
    "QuillAndInkButton.png": "https://user.uploads.dev/file/aaac7ac8df1d8c35940c708b0afe1ae7.png"
  });
  const MAIN_MENU_BACKGROUND_ASSET = "BackgroundImage2.png";
  const MAIN_MENU_LOGO_ASSET = "EmberAdventuresLogo2.png";
  function menuAssetUrl(name) {
    if (["localhost", "127.0.0.1"].includes(location.hostname)) return `/menu_assets/${encodeURIComponent(name)}`;
    return MENU_ASSET_URLS[name] || "";
  }
  function mainMenuPreloadAssetNames() {
    return [MAIN_MENU_BACKGROUND_ASSET, MAIN_MENU_LOGO_ASSET, "BottomButtons2.png", "CompassButton.png", "OpenGatesButton.png", "JournalButton.png", "OpenBookButton.png", "HoodedFigureButton.png"];
  }
  const mainMenuPreloadedImages = new Map();
  const mainMenuPreloadPaintTick = () => new Promise(resolve => {
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : callback => setTimeout(callback, 16);
    raf(() => raf(resolve));
  });
  function mainMenuAssetUrls() {
    return [...new Set(mainMenuPreloadAssetNames().map(menuAssetUrl).filter(Boolean))];
  }
  function mainMenuImageReady(url) {
    const image = mainMenuPreloadedImages.get(url);
    return !!image && image.complete && image.naturalWidth > 0;
  }
  function mainMenuAssetsReadyForPaint() {
    return mainMenuAssetUrls().every(mainMenuImageReady);
  }
  function preloadImageUrl(url) {
    if (!url) return Promise.resolve(false);
    if (mainMenuImageReady(url)) return Promise.resolve(true);
    return new Promise(resolve => {
      const image = new Image();
      image.onload = async () => {
        try {
          if (typeof image.decode === "function") await image.decode();
        } catch (err) {
          log("Main menu asset decode failed", err.message || String(err), {
            type: "system",
            level: "warn",
            url
          });
        }
        await mainMenuPreloadPaintTick();
        mainMenuPreloadedImages.set(url, image);
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.decoding = "async";
      image.src = url;
    });
  }
  function preloadMainMenuAssets() {
    if (app.mainMenuAssetsPreloaded) return Promise.resolve(true);
    if (app.mainMenuAssetsPreloadPromise) return app.mainMenuAssetsPreloadPromise;
    const urls = mainMenuAssetUrls();
    app.mainMenuAssetsPreloadPromise = Promise.all(urls.map(preloadImageUrl)).then(async results => {
      app.mainMenuAssetPreloadFailures = results.filter(ok => !ok).length;
      if (app.mainMenuAssetPreloadFailures) {
        log("Main menu asset preload had failures", {
          failures: app.mainMenuAssetPreloadFailures,
          total: urls.length
        }, {
          type: "system",
          level: "warn"
        });
      }
      await mainMenuPreloadPaintTick();
      app.mainMenuAssetsPreloaded = mainMenuAssetsReadyForPaint();
      if (!app.mainMenuAssetsPreloaded) app.mainMenuAssetsPreloadPromise = null;
      return app.mainMenuAssetsPreloaded;
    }).catch(err => {
      app.mainMenuAssetsPreloaded = false;
      app.mainMenuAssetPreloadFailures = urls.length;
      app.mainMenuAssetsPreloadPromise = null;
      log("Main menu asset preload failed", err.message || String(err), {
        type: "system",
        level: "warn"
      });
      return false;
    });
    return app.mainMenuAssetsPreloadPromise;
  }
  function renderMainMenuLoading(menu) {
    menu.innerHTML = `
                <div class="main-menu-loading" aria-label="Loading EmberAdventures menu">
                    <div class="main-menu-loading-box">
                        <div class="main-menu-loading-spinner" aria-hidden="true"></div>
                        <div class="main-menu-loading-title">Loading EmberAdventures</div>
                    </div>
                </div>
            `;
  }
  const PERF_PREFIX = "EmberAdventures perf";
  const perfNow = () => performance?.now?.() || Date.now();
  const perfBytes = text => {
    const value = String(text ?? "");
    try {
      return new Blob([value]).size;
    } catch {
      return value.length * 2;
    }
  };
  const perfKb = bytes => Math.round((Number(bytes) || 0) / 102.4) / 10;
  const perfCount = value => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    return 0;
  };
  function startLongTaskObserver() {
    if (app.longTaskObserver || typeof PerformanceObserver !== "function") return false;
    try {
      const supported = PerformanceObserver.supportedEntryTypes || [];
      if (!supported.includes("longtask")) return false;
      let pending = [];
      let flushTimer = 0;
      const flush = () => {
        flushTimer = 0;
        if (!pending.length) return;
        const entries = pending;
        pending = [];
        const durations = entries.map(entry => entry.duration);
        const totalMs = durations.reduce((total, duration) => total + duration, 0);
        const maxMs = Math.max(...durations);
        const attribution = entries.flatMap(entry => entry.attribution || []).map(item => ({
          name: String(item?.name || ""),
          containerType: String(item?.containerType || ""),
          containerName: String(item?.containerName || ""),
          containerId: String(item?.containerId || ""),
          containerSrc: String(item?.containerSrc || "")
        })).filter((item, index, values) => values.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(item)) === index);
        recordDevTraceEntry({
          type: "performance",
          logType: "performance",
          logLevel: maxMs >= 1000 || totalMs >= 2000 ? "warning" : "message",
          title: "Browser main-thread long-task burst",
          detail: {
            count: entries.length,
            totalMs: Math.round(totalMs),
            maxMs: Math.round(maxMs),
            firstStartedAtMs: Math.round(entries[0].startTime),
            lastStartedAtMs: Math.round(entries[entries.length - 1].startTime),
            ...(app.aiActive ? {
              aiLabel: app.aiActive.label || "",
              aiProvider: app.aiActive.provider || "",
              aiStreamedChars: Number(app.aiActive.streamedChars || 0)
            } : {}),
            ...(attribution.length ? {
              attribution
            } : {})
          }
        });
      };
      app.longTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration < 100) continue;
          pending.push(entry);
        }
        if (pending.length && !flushTimer) flushTimer = setTimeout(flush, 1000);
      });
      app.longTaskObserver.observe({
        entryTypes: ["longtask"]
      });
      return true;
    } catch (err) {
      return false;
    }
  }
  function startLongAnimationFrameObserver() {
    if (app.longAnimationFrameObserver || typeof PerformanceObserver !== "function") return false;
    try {
      const supported = PerformanceObserver.supportedEntryTypes || [];
      if (!supported.includes("long-animation-frame")) return false;
      let pending = [];
      let flushTimer = 0;
      const flush = () => {
        flushTimer = 0;
        if (!pending.length) return;
        const entries = pending;
        pending = [];
        const worst = entries.reduce((left, right) => right.duration > left.duration ? right : left);
        const scripts = (worst.scripts || []).map(script => ({
          durationMs: Math.round(script.duration || 0),
          sourceFunctionName: String(script.sourceFunctionName || ""),
          sourceUrl: String(script.sourceURL || ""),
          invoker: String(script.invoker || ""),
          forcedStyleAndLayoutDurationMs: Math.round(script.forcedStyleAndLayoutDuration || 0)
        })).sort((left, right) => right.durationMs - left.durationMs).slice(0, 8);
        recordDevTraceEntry({
          type: "performance",
          logType: "performance",
          logLevel: worst.duration >= 1000 ? "warning" : "message",
          title: "Browser long-animation-frame burst",
          detail: {
            count: entries.length,
            worstDurationMs: Math.round(worst.duration),
            renderStartMs: Math.round(worst.renderStart || 0),
            styleAndLayoutStartMs: Math.round(worst.styleAndLayoutStart || 0),
            blockingDurationMs: Math.round(worst.blockingDuration || 0),
            scripts
          }
        });
      };
      app.longAnimationFrameObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 100) pending.push(entry);
        }
        if (pending.length && !flushTimer) flushTimer = setTimeout(flush, 1000);
      });
      app.longAnimationFrameObserver.observe({
        entryTypes: ["long-animation-frame"]
      });
      return true;
    } catch (err) {
      return false;
    }
  }
  function startEventLoopStallMonitor() {
    if (app.eventLoopStallMonitorStarted) return false;
    app.eventLoopStallMonitorStarted = true;
    const intervalMs = 2000;
    const reportThresholdMs = 500;
    const reportCooldownMs = 10000;
    let expectedAt = performance.now() + intervalMs;
    let lastReportedAt = 0;
    let previousRenderStats = {
      ...ensureRenderStats()
    };
    const schedule = () => {
      app.eventLoopStallMonitorTimer = setTimeout(sample, intervalMs);
      expectedAt = performance.now() + intervalMs;
    };
    const sample = () => {
      const now = performance.now();
      const delayMs = Math.max(0, now - expectedAt);
      if (document.visibilityState === "visible" && delayMs >= reportThresholdMs && now - lastReportedAt >= reportCooldownMs) {
        lastReportedAt = now;
        const renderStats = ensureRenderStats();
        const orderedWork = app.work?.orderedSnapshot?.() || [];
        const memory = performance.memory;
        recordDevTraceEntry({
          type: "performance",
          logType: "performance",
          logLevel: delayMs >= 2000 ? "warning" : "message",
          title: "Browser event-loop stall",
          detail: {
            delayMs: Math.round(delayMs),
            domNodes: document.getElementsByTagName("*").length,
            imagesInDom: document.images?.length || 0,
            iframesInDom: document.getElementsByTagName("iframe").length,
            openModals: document.querySelectorAll(".popup-modal, dialog[open]").length,
            fullRendersSinceLastStall: renderStats.fullRenderCount - Number(previousRenderStats.fullRenderCount || 0),
            threadRendersSinceLastStall: renderStats.threadRenderCount - Number(previousRenderStats.threadRenderCount || 0),
            imagePanelRendersSinceLastStall: renderStats.imagePanelRenderCount - Number(previousRenderStats.imagePanelRenderCount || 0),
            lastFullRenderReason: renderStats.lastFullRenderReason || "",
            orderedWorkLanes: orderedWork.length,
            orderedWorkQueued: orderedWork.reduce((total, lane) => total + (lane.queued?.length || 0), 0),
            backgroundJobs: app.work?.jobs?.size || 0,
            pendingUiWork: app.work?.uiWork?.size || 0,
            activeImageRequests: app.activeImageRequests?.size || 0,
            activeProfileImageRequests: app.activeProfileImageRequests?.size || 0,
            profileImageQueueLength: app.profileImageQueue?.length || 0,
            profileImageQueueRunning: !!app.profileImageQueueRunning,
            profileImagesGenerating: app.profileImageGenerating?.size || 0,
            messages: app.messages?.length || 0,
            runtimeCharacters: Object.keys(app.state?.characters || {}).length,
            storedImages: app.images?.length || 0,
            storedProfileImages: app.profileImages?.length || 0,
            ...(memory ? {
              usedJsHeapBytes: memory.usedJSHeapSize,
              totalJsHeapBytes: memory.totalJSHeapSize,
              jsHeapLimitBytes: memory.jsHeapSizeLimit
            } : {})
          }
        });
        previousRenderStats = {
          ...renderStats
        };
      }
      schedule();
    };
    schedule();
    return true;
  }
  function debugConsoleEnabled() {
    return logSettingEnabled("performance");
  }
  function isStorageMinorPerfLabel(label = "") {
    return /^(stringify |largeStorage(?:Get|Set|Remove)$|active game save (?:queued|flushing|total)$|saveMessageHistory$)/i.test(String(label || ""));
  }
  function perfConsole(label, data = {}, level = "log") {
    const logType = isStorageMinorPerfLabel(label) ? "storageMinor" : "performance";
    if (logType === "storageMinor" && !logSettingEnabled(logType)) return;
    if (!logSettingEnabled(logType) && !smokeDevTraceCaptureActive()) return;
    const entry = {
      title: `${PERF_PREFIX}: ${label}`,
      type: "performance",
      logType,
      logLevel: level === "error" ? "error" : level === "warn" ? "warning" : "message",
      label,
      detail: data,
      at: new Date().toISOString()
    };
    writeConsoleLog(entry);
    recordDevTraceEntry(entry);
  }
  function perfTimed(label, fn, options = {}) {
    const start = perfNow();
    try {
      const result = fn();
      const ms = perfNow() - start;
      const threshold = options.thresholdMs ?? 75;
      if (ms >= threshold) perfConsole(label, {
        ms: Math.round(ms),
        ...options.data
      }, "warn");
      return result;
    } catch (err) {
      perfConsole(`${label} failed`, {
        ms: Math.round(perfNow() - start),
        error: err?.message || String(err)
      }, "error");
      throw err;
    }
  }
  function createWorkManager() {
    const lanes = new Map();
    const jobs = new Map();
    const uiWork = new Map();
    const maintenance = new Map();
    let nextJobId = 1;
    const createJob = (kind, resourceKey, label, action, options = {}) => ({
      id: `work-${nextJobId++}`,
      kind,
      resourceKey: String(resourceKey || "global"),
      label: String(label || resourceKey || "Background work"),
      action,
      state: "queued",
      queuedAt: Date.now(),
      startedAt: 0,
      completedAt: 0,
      generation: Number(options.generation || 0),
      error: "",
      cancelled: false,
      propagateError: options.propagateError === true,
      resolve: null,
      reject: null,
      promise: null
    });
    const settleJob = (job, value, error = null) => {
      job.completedAt = Date.now();
      jobs.delete(job.id);
      if (error) job.reject?.(error);else job.resolve?.(value);
    };
    const runNext = async resourceKey => {
      const lane = lanes.get(resourceKey);
      if (!lane || lane.running) return;
      const job = lane.queue.shift();
      if (!job) {
        lanes.delete(resourceKey);
        return;
      }
      lane.running = job;
      job.state = "running";
      job.startedAt = Date.now();
      let result = false;
      let failure = null;
      try {
        if (job.cancelled) {
          job.state = "cancelled";
        } else {
          result = await job.action(job);
          job.state = job.cancelled ? "cancelled" : "completed";
        }
      } catch (err) {
        job.state = "failed";
        job.error = err?.message || String(err);
        result = false;
        if (job.propagateError) failure = err;else recordStorageFailure?.(job.resourceKey, err);
      }
      lane.running = null;
      settleJob(job, result, failure);
      if (lanes.get(resourceKey) !== lane) return;
      if (lane.queue.length) queueMicrotask(() => runNext(resourceKey));else lanes.delete(resourceKey);
    };
    const enqueueOrdered = (resourceKey, label, action, options = {}) => {
      const key = String(resourceKey || "global");
      const lane = lanes.get(key) || {
        running: null,
        queue: []
      };
      lanes.set(key, lane);
      if (options.coalesce) {
        const replaced = lane.queue.find(item => item.state === "queued" && item.label === String(label || key));
        if (replaced) {
          replaced.action = action;
          replaced.queuedAt = Date.now();
          return replaced.promise;
        }
      }
      const job = createJob("ordered", key, label, action, options);
      job.promise = new Promise((resolve, reject) => {
        job.resolve = resolve;
        job.reject = reject;
      });
      jobs.set(job.id, job);
      lane.queue.push(job);
      queueMicrotask(() => runNext(key));
      return job.promise;
    };
    const startBackground = (jobKey, label, action, options = {}) => {
      const key = String(jobKey || label || "background");
      const current = jobs.get(key);
      if (current && options.replace !== true) return current.promise;
      if (current) current.cancelled = true;
      const job = createJob("background", key, label, action, options);
      job.id = key;
      job.promise = Promise.resolve().then(async () => {
        if (job.cancelled) return false;
        job.state = "running";
        job.startedAt = Date.now();
        const result = await action(job);
        job.state = job.cancelled ? "cancelled" : "completed";
        return result;
      }).catch(err => {
        job.state = "failed";
        job.error = err?.message || String(err);
        if (typeof options.onError === "function") options.onError(err, job);else log?.("Background work failed", `${job.label}: ${job.error}`, {
          type: "system",
          level: "warning",
          details: {
            jobId: job.id,
            resourceKey: job.resourceKey
          }
        });
        return false;
      }).finally(() => {
        job.completedAt = Date.now();
        if (jobs.get(key) === job) jobs.delete(key);
      });
      jobs.set(key, job);
      return job.promise;
    };
    const scheduleMaintenance = (jobKey, label, action) => {
      const key = String(jobKey || label || "maintenance");
      if (maintenance.has(key)) return maintenance.get(key);
      const run = () => startBackground(`maintenance:${key}`, label, action).finally(() => {
        maintenance.delete(key);
      });
      const promise = new Promise(resolve => {
        const callback = () => Promise.resolve(run()).then(resolve);
        if (typeof requestIdleCallback === "function") requestIdleCallback(callback, {
          timeout: 2000
        });else setTimeout(callback, 0);
      });
      maintenance.set(key, promise);
      return promise;
    };
    const UI_FRAME_BUDGET_MS = 4;
    const UI_PRIORITY = Object.freeze({
      immediate: 0,
      interaction: 1,
      content: 2,
      background: 3
    });
    let uiSequence = 0;
    const scheduleUiFrame = () => {
      if (uiWork.frame) return;
      const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : callback => setTimeout(() => callback(perfNow()), 0);
      const run = () => {
        if (!uiWork.frame) return;
        const frame = uiWork.frame;
        uiWork.frame = null;
        if (frame?.fallbackId) clearTimeout(frame.fallbackId);
        const started = perfNow();
        const pending = [...uiWork.values()].sort((left, right) => left.priority - right.priority || left.sequence - right.sequence);
        for (const job of pending) {
          if (uiWork.get(job.key) !== job) continue;
          uiWork.delete(job.key);
          try {
            job.action();
          } catch (err) {
            reportAppIssue?.(err, {
              title: "UI refresh failed",
              type: "system",
              context: job.key
            });
          }
          if (perfNow() - started >= UI_FRAME_BUDGET_MS) break;
        }
        if (uiWork.size) scheduleUiFrame();
      };
      const frame = {
        fallbackId: 0
      };
      uiWork.frame = frame;
      frame.fallbackId = setTimeout(run, 100);
      if (typeof requestAnimationFrame === "function") frame.rafId = schedule(run);else run();
    };
    const scheduleUi = (surfaceKey, action, options = {}) => {
      const key = String(surfaceKey || "ui");
      const priorityName = String(options.priority || "content");
      const priority = Number.isFinite(options.priority) ? Number(options.priority) : UI_PRIORITY[priorityName] ?? UI_PRIORITY.content;
      uiWork.set(key, {
        key,
        action,
        priority,
        sequence: ++uiSequence
      });
      scheduleUiFrame();
    };
    const flushUi = async () => {
      while (uiWork.size || uiWork.frame) {
        await new Promise(resolve => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          const fallback = setTimeout(finish, 100);
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
            clearTimeout(fallback);
            finish();
          });else {
            clearTimeout(fallback);
            finish();
          }
        });
      }
      return true;
    };
    const flush = async (resourceKey = "") => {
      const key = String(resourceKey || "");
      while (true) {
        const pending = key ? [lanes.get(key)?.running, ...(lanes.get(key)?.queue || [])] : [...lanes.values()].flatMap(lane => [lane.running, ...lane.queue]);
        const promises = pending.filter(Boolean).map(job => job.promise);
        if (!promises.length) return true;
        const results = await Promise.all(promises);
        if (results.some(result => result === false)) return false;
      }
    };
    const orderedSnapshot = () => [...lanes.entries()].map(([resourceKey, lane]) => ({
      resourceKey,
      running: lane.running ? {
        id: lane.running.id,
        label: lane.running.label,
        state: lane.running.state,
        runningMs: Math.max(0, Date.now() - lane.running.startedAt)
      } : null,
      queued: lane.queue.map(job => ({
        id: job.id,
        label: job.label,
        state: job.state,
        queuedMs: Math.max(0, Date.now() - job.queuedAt)
      }))
    }));
    const abandonOrdered = (resourceKey, reason = "ordered work abandoned") => {
      const key = String(resourceKey || "");
      const lane = lanes.get(key);
      if (!lane) return false;
      lanes.delete(key);
      const abandoned = [lane.running, ...lane.queue].filter(Boolean);
      lane.queue = [];
      for (const job of abandoned) {
        job.cancelled = true;
        job.state = "cancelled";
        job.error = reason;
        settleJob(job, false);
      }
      return true;
    };
    const cancel = (jobKey, reason = "cancelled") => {
      const key = String(jobKey || "");
      const job = jobs.get(key);
      if (!job) return false;
      job.cancelled = true;
      job.error = reason;
      return true;
    };
    return {
      enqueueOrdered,
      startBackground,
      scheduleMaintenance,
      scheduleUi,
      flushUi,
      flush,
      orderedSnapshot,
      abandonOrdered,
      cancel,
      jobs,
      lanes,
      uiWork,
      maintenance
    };
  }
  async function mapWithConcurrency(values = [], limit = 4, action = async value => value) {
    const items = Array.from(values || []);
    const results = new Array(items.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await action(items[index], index);
      }
    };
    const workers = Array.from({
      length: Math.min(Math.max(1, Number(limit) || 1), items.length)
    }, worker);
    await Promise.all(workers);
    return results;
  }
  const app = {
    state: clone(defaultState),
    settings: clone(defaultSettings),
    messages: [],
    messageIndex: new Map(),
    messageListRevision: 1,
    imageTimelineRevision: 1,
    queueRevision: 1,
    streamingMessageUpdates: new Map(),
    threadRenderLimit: 180,
    snapshots: [],
    snapshotListRevision: 1,
    snapshotHeadExtraReverseChanges: [],
    gameSaves: [],
    storyTemplates: [],
    storyTitleCardImages: [],
    characterDefinitions: [],
    images: [],
    profileImages: [],
    profileImageResolutionEpoch: 1,
    creatorIdentityRegistry: {
      identities: [],
      last_used_creator_id: ""
    },
    profileEntityOverrides: {},
    stateSyncCheckpoint: null,
    worldGenerationCheckpoint: null,
    currentGameSaveId: "",
    activeSaveId: "",
    saveIndex: [],
    storyBuilder: null,
    supabaseSession: null,
    publicLibraryViewMode: "stories",
    mainMenuExplicitlyOpened: false,
    pendingStoryTemplateStart: null,
    gameRuntimeGeneration: 1,
    mobileDrawer: "",
    imageVisibleCount: 18,
    devTrace: [],
    devTraceNextId: 1,
    performanceMetrics: {
      dirtyRecordCount: 0,
      recordsWritten: 0,
      messagesWritten: 0,
      snapshotsWritten: 0,
      imagesWritten: 0,
      autosaveMaterializeMs: 0,
      autosavePostMessageMs: 0,
      autosaveWorkerMs: 0,
      autosavePayloadBytes: 0,
      snapshotCreateMs: 0,
      objectiveCompletionMs: 0,
      streamChunkCount: 0,
      streamRenderCount: 0,
      mutationJournalOperations: 0,
      mutationJournalUniquePaths: 0,
      mutationJournalEstimatedBytes: 0,
      objectiveRuntimeEstimatedBytes: 0,
      objectiveRuntimeWriteMs: 0,
      objectiveRuntimeMaterializeMs: 0,
      objectiveDependencyVisits: 0,
      objectiveFullNormalizationVisits: 0,
      rewardInvocationCollisionCount: 0,
      generatedIdCollisionCount: 0,
      directMutationBypassCount: 0,
      fullSaveFallbackCount: 0
    },
    work: createWorkManager(),
    activityTasks: new Map(),
    activityTaskNextId: 1,
    activityTaskStartedAt: 0,
    librarySavePendingCount: 0,
    librarySaveActivityId: "",
    librarySaveActivityLabel: "",
    librarySaveActivityShowTimer: null,
    librarySaveActivityHideTimer: null,
    uiBusyActions: new Map(),
    uiBusyGroups: new Map(),
    uiBusyNextId: 1,
    uiBusyObserver: null,
    uiBusyRefreshQueued: false,
    blockingUiActions: [],
    gameStateRevision: 1,
    turnTaskNextId: 1,
    persistenceRevisions: {},
    saveImageDurableSignatures: {},
    profileImageReferenceRevision: 1,
    profileImageReferenceCache: null,
    saveHeaderSummaryCache: null,
    pendingObjectiveChoiceReply: null,
    directObjectiveChoiceAutoOpenKey: "",
    directObjectiveChoiceAutoOpenReadingMessageId: "",
    directObjectiveChoiceAutoOpenTimer: null,
    directObjectiveChoiceSubmissionInProgress: false,
    autoDirectObjectiveChoiceInProgress: false,
    autoPendingObjectiveChoiceInProgress: false,
    busy: false,
    queue: [],
    aiActive: null,
    aiQueue: [],
    activeImageRequests: new Set(),
    recentSceneImageVisualStates: new Map(),
    normalImagePriorityUntil: 0,
    turnSceneImageCollector: null,
    voices: [],
    voiceCacheInitialized: false,
    smokeSuiteCompletionAudioContext: null,
    lastImageSignature: "",
    activeVoiceMessageId: null,
    activeVoiceToken: 0,
    autoAdvanceWaitingForVoiceMessageId: null,
    voicePaused: false,
    narrationModalPauseDepth: 0,
    narrationModalPausedSpeech: false,
    voiceHighlight: null,
    voiceHighlightLastEnd: 0,
    activeVoiceStartedAt: 0,
    voiceUtteranceQueue: [],
    voiceUtteranceCurrent: null,
    voiceUtteranceGeneration: 0,
    voiceUtterancePumpTimer: null,
    voiceIdleWatchdogTimer: null,
    voiceCurrentIdleSince: 0,
    failedSpeechVoiceNames: new Set(),
    stoppedVoiceMessageIds: new Set(),
    streamedVoiceReplyIds: new Set(),
    autoVoiceStartedMessageIds: new Set(),
    voiceMetadataPendingMessageIds: new Set(),
    pendingVoiceDialogueParts: new Map(),
    voiceDefinitionCharacterCache: new Map(),
    cancelledAiMessageIds: new Set(),
    onboardingDraft: null,
    profileImageQueue: [],
    profileImageGenerating: new Set(),
    profileImageQueued: new Set(),
    profileImageRequestOwnerById: {},
    activeProfileImageRequestByOwner: {},
    supersededProfileImageRequests: new Set(),
    npcInspectionInFlight: new Set(),
    activeProfileImageRequests: new Set(),
    storyPlayerSelectScrollBusyUntil: 0,
    storyPlayerSelectScrollTimer: null,
    deferredStoryPlayerSelectProfileRenders: new Map(),
    sceneProfileImageWatchdogTimer: null,
    pendingPresenceCleanup: [],
    profileImagesBootstrapped: false,
    contextualSuggestions: [],
    turnStage: "idle",
    statusText: "Ready",
    activeStateCheck: null,
    stateSync: {
      running: false,
      queued: false,
      status: "",
      startMessageId: null,
      blockStartEntryId: 0,
      blockEndEntryId: 0,
      blockSnapshotId: "",
      processingMessageIds: [],
      lastRangeText: "",
      startedAt: 0,
      completedStepKeys: [],
      generation: 0
    },
    pendingRegenerateMessage: null,
    startupBlankReplyRepairStarted: false,
    currentReplyDirective: "",
    currentReplyMode: "",
    pendingNpcInvite: null,
    activeQueueSource: "",
    autoPlayerTurnGenerating: false,
    autoAdvanceTimer: null,
    largeStoragePending: new Map(),
    storageFailures: root.__emberAdventuresStorageFailures || [],
    gameAutosaveTimer: null,
    gameAutosaveRunning: false,
    suppressGameAutosave: false,
    worldGenerationHeartbeatTimer: null,
    worldGenerationJob: null,
    mainMenuOpen: true,
    activeTopPanel: "objective"
  };
  app.settings = {
    ...clone(defaultSettings),
    ...(app.settings || {}),
    voiceGenderMap: {
      ...clone(defaultSettings.voiceGenderMap),
      ...(app.settings?.voiceGenderMap || {})
    }
  };
  if (EMBERADVENTURES_DEBUG_ALL_LOGS) {
    app.settings.devMode = true;
    for (const id of LOG_SETTING_IDS) app.settings[id] = true;
  }
  flushEarlyPerformanceEntries();

  // Track runtime mutations at their durable ownership boundaries. Ordinary
  // saves materialize only dirty aggregate records; no complete worker shadow exists.
  const runtimeSaveMutationTracker = {
    revision: 1,
    operations: {
      state: [],
      messages: [],
      snapshots: [],
      images: []
    },
    operationIndexByKind: {
      state: new Map(),
      messages: new Map(),
      snapshots: new Map(),
      images: new Map()
    },
    // Snapshot rollback keeps only the first pre-change value for a path
    // until the next checkpoint. Repeated writes are coalesced.
    snapshotStateOperations: [],
    snapshotBeforeByPath: new Map(),
    maxOperationsPerKind: 4000,
    maxSnapshotOperations: 4000
  };
  const runtimeAggregateDirtyTracker = {
    baselineRequired: true,
    baselineReason: "startup",
    records: new Map(),
    messages: new Map(),
    snapshots: new Map(),
    images: new Map(),
    inFlight: new Map(),
    nextBatchId: 1,
    lastPersistedRecordKeys: new Set(),
    lastPersistedMessageIds: new Set(),
    lastPersistedSnapshotIds: new Set(),
    lastPersistedImageIds: new Set()
  };
  function requireRuntimePersistenceBaseline(reason = "untracked runtime mutation") {
    const normalizedReason = String(reason || "untracked runtime mutation");
    if (!runtimeAggregateDirtyTracker.baselineRequired) log("Persistence baseline required", normalizedReason, {
      type: "storage",
      level: "warning"
    });
    runtimeAggregateDirtyTracker.baselineRequired = true;
    runtimeAggregateDirtyTracker.baselineReason = normalizedReason;
  }
  function runtimeDirtyKey(kind = "", recordId = "current") {
    return `${String(kind || "state-root")}\u001f${String(recordId || "current")}`;
  }
  function markRuntimeRecordDirty(kind = "state-root", recordId = "current", operation = "put") {
    const normalizedKind = String(kind || "state-root");
    const normalizedId = String(recordId || "current");
    runtimeAggregateDirtyTracker.records.set(runtimeDirtyKey(normalizedKind, normalizedId), {
      kind: normalizedKind,
      recordId: normalizedId,
      operation
    });
    queueSaveRecordProjection(normalizedKind, normalizedId, operation);
  }
  function markRuntimeCollectionDirty(collection = "messages", id = "", operation = "put") {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;
    const target = runtimeAggregateDirtyTracker[collection];
    if (!(target instanceof Map)) return;
    target.set(normalizedId, {
      id: normalizedId,
      operation
    });
    if (collection === "snapshots") app.snapshotListRevision = Number(app.snapshotListRevision || 0) + 1;
    queueSaveCollectionProjection(collection, normalizedId, operation);
  }
  function stateRecordOwnersForPath(path = []) {
    if (!Array.isArray(path) || !path.length) return [{
      kind: "*",
      recordId: "*"
    }];
    const rootName = String(path[0] || "");
    const childId = path.length > 1 ? String(path[1] ?? "") : "";
    if (rootName === "characters") {
      if (!childId) return [{
        kind: "*",
        recordId: "*"
      }];
      return [{
        kind: "character",
        recordId: childId
      }];
    }
    if (rootName === "objectives") {
      return [{
        kind: "objective-runtime",
        recordId: "current"
      }];
    }
    if (["active_generated_jobs", "story_job_offers", "story_job_offer_history"].includes(rootName)) return [{
      kind: "job-runtime",
      recordId: "current"
    }];
    if (rootName === "story_generated_npc_pool") return [{
      kind: "generated-npc-pool",
      recordId: "current"
    }];
    if (rootName === "story_rules") return [{
      kind: "story-rules-runtime",
      recordId: "current"
    }];
    if (rootName === "timed_events") {
      if (!childId) return [{
        kind: "*",
        recordId: "*"
      }];
      return [{
        kind: "timed-event",
        recordId: childId
      }];
    }
    if (rootName === "story_shops") {
      if (!childId) return [{
        kind: "*",
        recordId: "*"
      }];
      return [{
        kind: "shop",
        recordId: childId
      }];
    }
    if (rootName === "player") return [{
      kind: "player",
      recordId: "current"
    }];
    if (rootName === "scene") return [{
      kind: "scene",
      recordId: "current"
    }];
    if (rootName === "meta") return [{
      kind: "meta",
      recordId: "current"
    }];
    if (rootName === "story_inventory") return [{
      kind: "inventory",
      recordId: "current"
    }];
    if (rootName === "world_map") {
      const field = String(path[1] || "");
      if (!field || field === "locations" && path.length <= 2) return [{
        kind: "*",
        recordId: "*"
      }];
      if (field === "locations") return [{
        kind: "location",
        recordId: String(path[2])
      }];
      return [{
        kind: "world-map",
        recordId: "current"
      }];
    }
    if (rootName === "location") return [{
      kind: "location-runtime",
      recordId: "current"
    }];
    if (rootName === "world_flags") return [{
      kind: "world-runtime",
      recordId: "current"
    }];
    if (rootName === "npc_directory") {
      if (String(path[1] || "") === "locations" && path.length >= 5 && String(path[3] || "") === "characters") return [{
        kind: "npc",
        recordId: runtimeNpcRecordId(path[2], path[4])
      }];
      return [{
        kind: "npc-directory",
        recordId: "current"
      }];
    }
    if (rootName === "future_cast") return [{
      kind: "future-cast-runtime",
      recordId: "current"
    }];
    if (rootName === "story_clock") return [{
      kind: "story-clock",
      recordId: "current"
    }];
    if (rootName === "story_pacing") return [{
      kind: "story-pacing",
      recordId: "current"
    }];
    if (rootName === "story_memory") return [{
      kind: "story-memory",
      recordId: "current"
    }];
    if (rootName === "numeric_precision") return [{
      kind: "numeric-precision",
      recordId: "current"
    }];
    if (["reward_bundles", "reward_templates", "character_shop_cost_templates"].includes(rootName)) return [{
      kind: "immutable-definition",
      recordId: rootName
    }];
    return [{
      kind: "state-root",
      recordId: rootName || "current"
    }];
  }
  function markRuntimeDirtyFromMutation(kind = "state", operation = {}) {
    const path = Array.isArray(operation.path) ? operation.path : [];
    if (kind === "state") {
      if (path[0] === "npc_directory" && path[1] === "locations" && path.length === 3 && operation.op === "delete") for (const npcKey of Object.keys(operation.beforeValue?.characters || {})) markRuntimeRecordDirty("npc", runtimeNpcRecordId(path[2], npcKey), "delete");
      if (path[0] === "npc_directory" && path[1] === "locations" && path[3] === "characters" && path.length === 4) {
        const beforeCharacters = operation.beforeValue || {};
        const nextCharacters = operation.value || {};
        for (const npcKey of new Set([...Object.keys(beforeCharacters), ...Object.keys(nextCharacters)])) markRuntimeRecordDirty("npc", runtimeNpcRecordId(path[2], npcKey), Object.prototype.hasOwnProperty.call(nextCharacters, npcKey) ? "put" : "delete");
      }
      syncObjectiveRuntimeFromMutationPath(path, operation);
      const owners = stateRecordOwnersForPath(path);
      if (owners.some(owner => owner.kind === "*")) {
        requireRuntimePersistenceBaseline(`unkeyed state mutation at ${path.join(".") || "state root"}`);
        return;
      }
      for (const owner of owners) {
        const independentlyKeyedDelete = operation.op === "delete" && (owner.kind === "character" && path.length === 2 || owner.kind === "location" && path.length === 3 || owner.kind === "npc" && path.length === 5 || owner.kind === "timed-event" && path.length === 2 || owner.kind === "shop" && path.length === 2);
        markRuntimeRecordDirty(owner.kind, owner.recordId, independentlyKeyedDelete ? "delete" : "put");
      }
      return;
    }
    const collection = kind === "images" ? "images" : kind;
    if (!["messages", "snapshots", "images"].includes(collection)) return;
    const index = Number(path[0]);
    const before = runtimeSaveUnwrap(operation.beforeValue);
    const current = Number.isInteger(index) ? runtimeSaveUnwrap(app[kind]?.[index]) : null;
    const candidate = operation.op === "delete" ? before : current || operation.value;
    const id = String(candidate?.id ?? candidate?.entryId ?? candidate?.snapshotId ?? candidate?.imageId ?? "").trim();
    if (id) markRuntimeCollectionDirty(collection, id, operation.op === "delete" ? "delete" : "put");else if (!path.length) requireRuntimePersistenceBaseline(`unkeyed ${collection} collection replacement`);
  }

  // Rendering consumes the same tracked state mutations as persistence, but it
  // only schedules surfaces affected by the changed top-level state roots.
  const runtimeRenderMutationRoots = new Set();
  const runtimeSaveProxyCache = new WeakMap();
  const runtimeSaveProxyTargets = new WeakMap();
  function runtimeSavePathPart(property) {
    if (typeof property === "number") return property;
    if (typeof property !== "string") return null;
    return /^\d+$/.test(property) ? Number(property) : property;
  }
  function runtimeSaveUnwrap(value) {
    return runtimeSaveProxyTargets.get(value) || value;
  }
  function runtimeSaveUnwrapContainer(value) {
    const rawValue = runtimeSaveUnwrap(value);
    if (rawValue !== value) return rawValue;
    if (Array.isArray(value)) {
      let changed = false;
      const unwrapped = value.map(item => {
        const rawItem = runtimeSaveUnwrap(item);
        if (rawItem !== item) changed = true;
        return rawItem;
      });
      return changed ? unwrapped : value;
    }
    if (isPlainObject(value)) {
      let changed = false;
      const entries = Object.entries(value).map(([key, item]) => {
        const rawItem = runtimeSaveUnwrap(item);
        if (rawItem !== item) changed = true;
        return [key, rawItem];
      });
      return changed ? Object.fromEntries(entries) : value;
    }
    return value;
  }
  function runtimeMutationTouchesImmutableDefinition(path = []) {
    if (!app.storyDefinition || !Array.isArray(path) || !path.length) return false;
    return ["reward_bundles", "reward_templates", "character_shop_cost_templates"].includes(String(path[0] || ""));
  }
  function runtimeSaveCloneValue(value) {
    const rawValue = runtimeSaveUnwrap(value);
    return rawValue === undefined ? undefined : clone(rawValue);
  }
  function runtimeSaveValueAtPath(kind = "state", path = []) {
    let value = runtimeSaveUnwrap(app[kind]);
    for (const part of path || []) {
      if (!value || typeof value !== "object") return undefined;
      value = runtimeSaveUnwrap(value[part]);
    }
    return value;
  }
  function runtimeSaveOperationAffectsProfileImageReferences(kind = "state", path = []) {
    if (kind !== "state" || !path.length) return path.length === 0;
    const [root, property, nestedProperty] = path;
    if (root === "player") return !property || ["name", "profile_image_id", "profile_images", "profile_images_list"].includes(String(property));
    if (root === "players") return path.length <= 2 || ["name", "profile_image_id", "profile_images", "profile_images_list"].includes(String(nestedProperty));
    if (root === "characters") return path.length <= 2 || ["name", "profile_image_id", "profile_images", "profile_images_list"].includes(String(nestedProperty));
    return ["npc_directory", "future_cast"].includes(root);
  }
  function invalidateProfileImageReferenceCache() {
    app.profileImageReferenceRevision++;
    app.profileImageReferenceCache = null;
  }
  function runtimeMutationPathKey(path = []) {
    return (Array.isArray(path) ? path : []).map(part => String(part)).join("\u001f");
  }
  function coalesceRuntimeSaveOperation(kind = "state", operation = {}, revision = 0) {
    const operations = runtimeSaveMutationTracker.operations[kind];
    const index = runtimeSaveMutationTracker.operationIndexByKind[kind];
    if (!operations || !(index instanceof Map)) return;
    const path = Array.isArray(operation.path) ? [...operation.path] : [];
    const pathKey = runtimeMutationPathKey(path);
    const existingIndex = index.get(pathKey);
    const next = {
      op: operation.op === "delete" ? "delete" : "set",
      path,
      ...(operation.op === "delete" ? {} : {
        value: runtimeSaveUnwrap(operation.value)
      }),
      revision
    };
    if (existingIndex != null && operations[existingIndex]) {
      operations[existingIndex] = next;
      return;
    }
    index.set(pathKey, operations.length);
    operations.push(next);
    if (operations.length <= runtimeSaveMutationTracker.maxOperationsPerKind) return;
    // A bounded fallback is safer than unbounded heap growth. Collapse to
    // the smallest owner root, not a complete-save serialization request.
    const roots = new Set(operations.map(item => String(item.path?.[0] ?? "")));
    operations.length = 0;
    index.clear();
    for (const root of roots) {
      const collapsedPath = root ? [root] : [];
      const collapsed = {
        op: "set",
        path: collapsedPath,
        value: runtimeSaveValueAtPath(kind, collapsedPath),
        revision
      };
      index.set(runtimeMutationPathKey(collapsedPath), operations.length);
      operations.push(collapsed);
    }
  }
  function recordRuntimeSaveOperation(kind = "state", operation = {}) {
    if (!runtimeSaveMutationTracker.operations[kind]) return;
    if (!app.mutationObservation.active.length) app.performanceMetrics.directMutationBypassCount = Number(app.performanceMetrics.directMutationBypassCount || 0) + 1;
    const revision = ++runtimeSaveMutationTracker.revision;
    queueRuntimeSaveProjection(kind, operation);
    coalesceRuntimeSaveOperation(kind, operation, revision);
    if (kind === "state") {
      const path = Array.isArray(operation.path) ? [...operation.path] : [];
      const pathKey = runtimeMutationPathKey(path);
      if (!runtimeSaveMutationTracker.snapshotBeforeByPath.has(pathKey)) {
        const beforeExists = operation.beforeExists === true;
        const entry = {
          op: operation.op === "delete" ? "delete" : "set",
          path,
          beforeExists,
          ...(beforeExists ? {
            beforeValue: runtimeSaveCloneValue(operation.beforeValue)
          } : {})
        };
        runtimeSaveMutationTracker.snapshotBeforeByPath.set(pathKey, entry);
        runtimeSaveMutationTracker.snapshotStateOperations.push(entry);
        if (runtimeSaveMutationTracker.snapshotStateOperations.length > runtimeSaveMutationTracker.maxSnapshotOperations) {
          // The hard cap must not discard rollback information. Rebuild
          // each affected root as it existed at the checkpoint, then keep
          // one bounded root backup. This expensive path runs only after
          // thousands of unique mutations in one checkpoint interval.
          const grouped = new Map();
          for (const item of runtimeSaveMutationTracker.snapshotStateOperations) {
            const root = String(item.path?.[0] ?? "");
            (grouped.get(root) || grouped.set(root, []).get(root)).push(item);
          }
          const collapsed = [];
          for (const [root, items] of grouped) {
            const inverse = [...items].reverse().map(item => item.beforeExists ? {
              op: "set",
              path: [...item.path],
              value: runtimeSaveCloneValue(item.beforeValue)
            } : {
              op: "delete",
              path: [...item.path]
            });
            const wholeState = root === "";
            const current = wholeState ? runtimeSaveCloneValue(runtimeSaveUnwrap(app.state)) : {
              [root]: runtimeSaveCloneValue(runtimeSaveUnwrap(app.state?.[root]))
            };
            const reconstructed = applyReverseStatePatch(current, inverse);
            const topLevelEntry = items.find(item => item.path?.length === (wholeState ? 0 : 1));
            const beforeExists = topLevelEntry ? topLevelEntry.beforeExists === true : true;
            collapsed.push({
              op: "set",
              path: wholeState ? [] : [root],
              beforeExists,
              ...(beforeExists ? {
                beforeValue: runtimeSaveCloneValue(wholeState ? reconstructed : reconstructed?.[root])
              } : {})
            });
          }
          runtimeSaveMutationTracker.snapshotStateOperations = collapsed;
          runtimeSaveMutationTracker.snapshotBeforeByPath = new Map(collapsed.map(item => [runtimeMutationPathKey(item.path), item]));
        }
      }
      runtimeRenderMutationRoots.add(String(path[0] ?? "") || "*");
    }
    if (kind === "messages") touchMessageRevision?.();
    if (kind === "images") app.imageTimelineRevision = Number(app.imageTimelineRevision || 0) + 1;
    if (runtimeSaveOperationAffectsProfileImageReferences(kind, operation.path)) invalidateProfileImageReferenceCache();
    markRuntimeDirtyFromMutation(kind, operation);
  }
  function clearCommittedRuntimeSaveMutations(revision = 0) {
    const committedRevision = Math.max(0, Number(revision) || 0);
    for (const kind of Object.keys(runtimeSaveMutationTracker.operations)) {
      const retained = (runtimeSaveMutationTracker.operations[kind] || []).filter(operation => Number(operation?.revision) > committedRevision);
      runtimeSaveMutationTracker.operations[kind] = retained;
      runtimeSaveMutationTracker.operationIndexByKind[kind] = new Map(retained.map((operation, index) => [runtimeMutationPathKey(operation?.path || []), index]));
    }
  }
  function markRuntimeSaveMutation(kind = "state", root = "") {
    const path = root === "" || root == null ? [] : [String(root)];
    recordRuntimeSaveOperation(kind, {
      op: "set",
      path,
      value: runtimeSaveValueAtPath(kind, path)
    });
  }
  function trackedRuntimeValue(value, kind, path = []) {
    if (!value || typeof value !== "object") return value;
    const rawValue = runtimeSaveUnwrap(value);
    const cacheKey = path.map(String).join("\u001f");
    let cachedByPath = runtimeSaveProxyCache.get(rawValue);
    if (!cachedByPath) {
      cachedByPath = new Map();
      runtimeSaveProxyCache.set(rawValue, cachedByPath);
    }
    const cached = cachedByPath.get(cacheKey);
    if (cached) return cached;
    const proxy = new Proxy(rawValue, {
      get(target, property, receiver) {
        // JSON cloning is still used at explicit setup/rollback
        // boundaries. Return the raw graph there so serialization
        // does not recursively re-enter this mutation proxy.
        if (property === "toJSON") return () => target;
        const part = runtimeSavePathPart(property);
        if (part == null) return Reflect.get(target, property, receiver);
        return trackedRuntimeValue(Reflect.get(target, property, receiver), kind, [...path, part]);
      },
      set(target, property, nextValue, receiver) {
        const part = runtimeSavePathPart(property);
        const mutationPath = part == null ? path : [...path, part];
        if (kind === "state" && runtimeMutationTouchesImmutableDefinition(mutationPath)) throw new Error(`Immutable story definition data cannot change during gameplay: ${mutationPath.join(".")}`);
        const rawValue = runtimeSaveUnwrapContainer(nextValue);
        const previousValue = Reflect.get(target, property, receiver);
        const previousExists = Object.prototype.hasOwnProperty.call(target, property);
        const changed = previousValue !== rawValue;
        const result = Reflect.set(target, property, rawValue, receiver);
        if (changed && part != null) recordRuntimeSaveOperation(kind, {
          op: "set",
          path: [...path, part],
          value: rawValue,
          beforeExists: previousExists,
          beforeValue: runtimeSaveUnwrap(previousValue)
        });
        return result;
      },
      deleteProperty(target, property) {
        const part = runtimeSavePathPart(property);
        const mutationPath = part == null ? path : [...path, part];
        if (kind === "state" && runtimeMutationTouchesImmutableDefinition(mutationPath)) throw new Error(`Immutable story definition data cannot be deleted during gameplay: ${mutationPath.join(".")}`);
        const existed = Object.prototype.hasOwnProperty.call(target, property);
        const previousValue = Reflect.get(target, property);
        const result = Reflect.deleteProperty(target, property);
        if (existed && part != null) recordRuntimeSaveOperation(kind, {
          op: "delete",
          path: [...path, part],
          beforeExists: true,
          beforeValue: runtimeSaveUnwrap(previousValue)
        });
        return result;
      }
    });
    cachedByPath.set(cacheKey, proxy);
    runtimeSaveProxyTargets.set(proxy, rawValue);
    return proxy;
  }
  function installRuntimeSaveMutationTracking(property, kind) {
    let value = trackedRuntimeValue(runtimeSaveUnwrap(app[property]), kind, []);
    Object.defineProperty(app, property, {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: nextValue => {
        const previousValue = runtimeSaveUnwrap(value);
        const pendingChangedRoots = Array.isArray(nextValue?.__runtimePatchRoots) ? [...nextValue.__runtimePatchRoots] : null;
        const pendingCharacterKeys = Array.isArray(nextValue?.__runtimePatchCharacterKeys) ? [...nextValue.__runtimePatchCharacterKeys] : [];
        const pendingNpcKeys = Array.isArray(nextValue?.__runtimePatchNpcKeys) ? [...nextValue.__runtimePatchNpcKeys] : [];
        const pendingLocationIds = Array.isArray(nextValue?.__runtimePatchLocationIds) ? [...nextValue.__runtimePatchLocationIds] : [];
        const pendingNpcDirectoryMetadataChanged = nextValue?.__runtimePatchNpcDirectoryMetadataChanged === true;
        const rawValue = runtimeSaveUnwrapContainer(nextValue);
        value = trackedRuntimeValue(rawValue, kind, []);
        const changedRoots = kind === "state" ? pendingChangedRoots || (Array.isArray(rawValue?.__runtimePatchRoots) ? rawValue.__runtimePatchRoots : null) : null;
        if (changedRoots) {
          for (const root of changedRoots) {
            const key = String(root || "");
            if (!key) continue;
            if (key === "characters" && pendingCharacterKeys.length) {
              for (const characterKey of pendingCharacterKeys) {
                const recordId = String(characterKey || "");
                if (!recordId) continue;
                const nextExists = Object.prototype.hasOwnProperty.call(rawValue.characters || {}, recordId);
                recordRuntimeSaveOperation(kind, {
                  op: nextExists ? "set" : "delete",
                  path: ["characters", recordId],
                  ...(nextExists ? {
                    value: runtimeSaveUnwrap(rawValue.characters[recordId])
                  } : {}),
                  beforeExists: Object.prototype.hasOwnProperty.call(previousValue?.characters || {}, recordId),
                  beforeValue: runtimeSaveUnwrap(previousValue?.characters?.[recordId])
                });
              }
              continue;
            }
            if (key === "characters") {
              // Character aggregates are persisted as individually
              // owned records. A state replacement may carry only
              // the root marker when no character was actually
              // changed; never send that unowned root to the
              // normalized save projector.
              const beforeCharacters = previousValue?.characters || {};
              const nextCharacters = rawValue?.characters || {};
              const changedCharacterKeys = new Set([...Object.keys(beforeCharacters), ...Object.keys(nextCharacters)].filter(characterKey => JSON.stringify(beforeCharacters[characterKey]) !== JSON.stringify(nextCharacters[characterKey])));
              for (const characterKey of changedCharacterKeys) {
                const nextExists = Object.prototype.hasOwnProperty.call(nextCharacters, characterKey);
                recordRuntimeSaveOperation(kind, {
                  op: nextExists ? "set" : "delete",
                  path: ["characters", characterKey],
                  ...(nextExists ? {
                    value: runtimeSaveUnwrap(nextCharacters[characterKey])
                  } : {}),
                  beforeExists: Object.prototype.hasOwnProperty.call(beforeCharacters, characterKey),
                  beforeValue: runtimeSaveUnwrap(beforeCharacters[characterKey])
                });
              }
              continue;
            }
            if (key === "npc_directory") {
              const npcKeys = pendingNpcKeys.length ? pendingNpcKeys : rawValue?.__runtimePatchNpcKeys || [];
              if (pendingNpcDirectoryMetadataChanged || rawValue?.__runtimePatchNpcDirectoryMetadataChanged === true || !npcKeys.length) markRuntimeRecordDirty("npc-directory", "current");
              for (const recordId of npcKeys) markRuntimeRecordDirty("npc", recordId);
              continue;
            }
            if (key === "world_map") {
              markRuntimeRecordDirty("world-map", "current");
              for (const locationId of pendingLocationIds) markRuntimeRecordDirty("location", locationId);
              continue;
            }
            recordRuntimeSaveOperation(kind, {
              op: "set",
              path: [key],
              value: runtimeSaveUnwrap(rawValue[key]),
              beforeExists: Object.prototype.hasOwnProperty.call(previousValue || {}, key),
              beforeValue: runtimeSaveUnwrap(previousValue?.[key])
            });
          }
          return;
        }
        recordRuntimeSaveOperation(kind, {
          op: "set",
          path: [],
          value: rawValue,
          beforeExists: previousValue != null,
          beforeValue: previousValue
        });
      }
    });
  }
  installRuntimeSaveMutationTracking("state", "state");
  installRuntimeSaveMutationTracking("messages", "messages");
  installRuntimeSaveMutationTracking("snapshots", "snapshots");
  installRuntimeSaveMutationTracking("images", "images");
  app.storyDefinition ||= null;
  app.runtimeDefinitions ||= {
    jobsById: {},
    charactersById: {},
    locationsById: {}
  };
  app.objectiveRuntime ||= createEmptyObjectiveRuntime();
  app.objectiveRuntimeNeedsFullSync ||= false;
  app.rewardRuntime ||= {
    appliedInvocationIds: {}
  };
  app.jobRuntime ||= {
    activeJobsById: {},
    runtimeByJobId: {}
  };
  app.storyRulesRuntime ||= {
    added: [],
    removedKeys: []
  };
  app.mutationObservation ||= {
    enabled: true,
    active: [],
    completed: [],
    failures: [],
    nextId: 1
  };
  app.domainRevisions ||= Object.create(null);
  const RUNTIME_DEFINITION_NAMESPACES = Object.freeze({
    job: "job-",
    character: "runtime-character-",
    location: "runtime-location-"
  });
  const OBJECTIVE_RUNTIME_FIELDS = new Set(["status", "selected_outcome_id", "selected_outcome_message_id", "progress_notes", "selected_choice_id", "selected_choice_title", "selected_output_id", "available_now", "blocked_reason", "auto_completed_from_prereqs", "completed_at"]);
  function createEmptyObjectiveRuntime() {
    return {
      activeMainObjectiveId: "",
      focusedSideObjectiveId: "",
      noCurrent: false,
      statusById: {},
      selectedOutcomeById: {},
      selectedOutcomeMessageById: {},
      selectedChoiceById: {},
      selectedChoiceTitleById: {},
      selectedOutputById: {},
      progressNotesById: {},
      activationAiCheckAttemptedById: {},
      activationNumberById: {},
      pendingRewardChoices: [],
      pendingChoice: null,
      exclusiveGroupChoices: {},
      suggestions: [],
      completionMessage: "",
      completedMainMessage: "",
      pendingCompletionMessage: null
    };
  }
  function stableJsonValue(value) {
    if (Array.isArray(value)) return value.map(stableJsonValue);
    if (!value || typeof value !== "object") return value;
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableJsonValue(value[key]);
    return out;
  }
  function stableJsonString(value) {
    return JSON.stringify(stableJsonValue(value));
  }
  function stableContentHash(value) {
    const text = stableJsonString(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
  }
  function runtimeOverlayDiff(baseValue, currentValue) {
    if (Object.is(baseValue, currentValue)) return null;
    const baseObject = isPlainObject(baseValue);
    const currentObject = isPlainObject(currentValue);
    if (!baseObject || !currentObject) {
      if (stableJsonString(baseValue) === stableJsonString(currentValue)) return null;
      return {
        type: "replace",
        value: runtimeSaveCloneValue(currentValue)
      };
    }
    const set = {};
    const removed = [];
    const keys = new Set([...Object.keys(baseValue || {}), ...Object.keys(currentValue || {})]);
    for (const key of keys) {
      const baseHas = Object.prototype.hasOwnProperty.call(baseValue, key);
      const currentHas = Object.prototype.hasOwnProperty.call(currentValue, key);
      if (!currentHas) {
        if (baseHas) removed.push(key);
        continue;
      }
      const child = runtimeOverlayDiff(baseHas ? baseValue[key] : undefined, currentValue[key]);
      if (child) set[key] = child;
    }
    if (!removed.length && !Object.keys(set).length) return null;
    return {
      type: "object",
      set,
      removed
    };
  }
  function applyRuntimeOverlay(baseValue, overlay) {
    if (!overlay) return runtimeSaveCloneValue(baseValue);
    if (overlay.type === "replace") return runtimeSaveCloneValue(overlay.value);
    if (overlay.type !== "object") throw new Error("Invalid runtime overlay record.");
    const next = isPlainObject(baseValue) ? runtimeSaveCloneValue(baseValue) : {};
    for (const key of overlay.removed || []) delete next[key];
    for (const [key, child] of Object.entries(overlay.set || {})) next[key] = applyRuntimeOverlay(next[key], child);
    return next;
  }
  function generatedPersistentId(prefix = "runtime") {
    const cleanPrefix = String(prefix || "runtime").replace(/[^a-z0-9-]+/gi, "-");
    const random = root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `${cleanPrefix}-${random}`.toLowerCase();
  }
  function safeRuntimeIdPart(value = "") {
    const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
    if (!normalized) throw new Error("A stable runtime id component is required.");
    return normalized;
  }
  function generatedJobObjectiveId(jobId, stepId) {
    return `job-${safeRuntimeIdPart(jobId)}--${safeRuntimeIdPart(stepId)}`;
  }
  function assertGeneratedIdAvailable(id = "", type = "runtime") {
    const target = String(id || "").trim();
    if (!target) throw new Error(`${type} id is required.`);
    const collisions = [app.storyDefinition?.objectivesById?.[target], app.storyDefinition?.characterDefinitionsById?.[target], app.storyDefinition?.locationDefinitionsById?.[target], app.runtimeDefinitions?.charactersById?.[target], app.runtimeDefinitions?.locationsById?.[target], app.runtimeDefinitions?.jobsById?.[target], app.jobRuntime?.activeJobsById?.[target], app.jobRuntime?.runtimeByJobId?.[target], app.state?.active_generated_jobs?.[target], (app.state?.objectives?.items || []).find(objective => String(objective?.id || "") === target)];
    if (collisions.some(Boolean)) throw new Error(`${type} id collision: ${target}`);
    return target;
  }
  function assertGeneratedJobObjectiveIdsAvailable(jobId = "", objectiveIds = [], state = app.state) {
    const persistedJobId = String(jobId || "").trim();
    if (!persistedJobId) throw new Error("Generated job id is required.");
    const existingObjectiveIds = new Set((state?.objectives?.items || []).map(objective => String(objective?.id || "").trim()));
    for (const definition of Object.values(app.runtimeDefinitions?.jobsById || {})) {
      for (const objective of Array.isArray(definition?.objectives) ? definition.objectives : []) {
        const id = String(objective?.id || "").trim();
        if (id) existingObjectiveIds.add(id);
      }
    }
    for (const objectiveId of objectiveIds || []) {
      const id = String(objectiveId || "").trim();
      if (!id.startsWith(`job-${safeRuntimeIdPart(persistedJobId)}--`)) throw new Error(`Generated job objective id does not match persisted job id: ${id}`);
      if (app.storyDefinition?.objectivesById?.[id] || existingObjectiveIds.has(id)) throw new Error(`Generated job objective id collision: ${id}`);
    }
    return true;
  }
  function deepFreezeDefinition(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreezeDefinition(child, seen);
    return Object.freeze(value);
  }
  function objectiveDefinitionFromRuntimeObjective(objective = {}, index = 0) {
    const definition = {};
    for (const [key, value] of Object.entries(objective || {})) {
      if (OBJECTIVE_RUNTIME_FIELDS.has(key)) continue;
      definition[key] = clone(value);
    }
    definition.id = String(definition.id || "").trim();
    if (!definition.id) throw new Error(`Objective at index ${index} has no id. EmberAdventures does not generate or repair objective ids.`);
    definition.initialStatus = String(objective.initialStatus || objective.initial_status || objective.status || "hidden");
    delete definition.initial_status;
    return definition;
  }
  function characterDefinitionFields(character = {}, fallbackId = "") {
    const id = String(character.id || character.character_id || fallbackId || "").trim();
    return {
      id,
      name: String(character.name || fallbackId || id || "").trim(),
      age: character.age,
      gender: character.gender,
      role: character.role,
      personality_description: character.personality_description,
      appearance: clone(character.appearance || {}),
      prompt_definition: clone(character.prompt_definition || character.promptDefinition || {}),
      default_profile_image: clone(character.default_profile_image || null),
      default_seed: character.default_seed,
      default_image_background: character.default_image_background,
      image_prompt_config: clone(character.image_prompt_config || {}),
      authored_role: character.authored_role || character.authoredRole || ""
    };
  }
  function characterRuntimeFields(character = {}, definitionId = "", baseDefinition = null) {
    const staticKeys = new Set(["id", "character_id", "name", "age", "gender", "role", "personality_description", "appearance", "prompt_definition", "promptDefinition", "default_profile_image", "default_seed", "default_image_background", "image_prompt_config", "authored_role", "authoredRole", "definition_id", "definitionId"]);
    const runtime = {
      definitionId
    };
    for (const [key, value] of Object.entries(character || {})) {
      if (staticKeys.has(key)) continue;
      if (value === undefined) throw new Error(`Character runtime field ${key} is undefined.`);
      runtime[key] = clone(value);
    }
    // Definition-like fields may legitimately change within one save
    // (manual current-game edits, transformations, presentation changes).
    // Preserve only their sparse save-specific overlay; never rewrite the
    // immutable authored/generated definition itself.
    const currentDefinition = characterDefinitionFields(character, definitionId);
    currentDefinition.id = definitionId || currentDefinition.id;
    const definitionOverlay = runtimeOverlayDiff(baseDefinition || {}, currentDefinition);
    if (definitionOverlay) runtime.definitionOverlay = definitionOverlay;
    // Concrete selected voices are mutable save-owned state.
    if (character.voice != null) runtime.voice = clone(character.voice);
    return runtime;
  }
  function objectiveRuntimeFromState(state = app.state, definition = app.storyDefinition) {
    const authored = definition?.objectivesById || {};
    const runtime = {
      ...createEmptyObjectiveRuntime(),
      activeMainObjectiveId: String(state?.objectives?.active_id || ""),
      focusedSideObjectiveId: String(state?.objectives?.focus_id || ""),
      noCurrent: state?.objectives?.no_current === true,
      progressNotesById: clone(state?.objectives?.progress_notes || {}),
      pendingRewardChoices: clone(state?.objectives?.pending_reward_choices || []),
      pendingChoice: clone(state?.objectives?.pending_choice || null),
      exclusiveGroupChoices: clone(state?.objectives?.exclusive_group_choices || {}),
      suggestions: clone(state?.objectives?.suggestions || []),
      completionMessage: String(state?.objectives?.completion_message || ""),
      completedMainMessage: String(state?.objectives?.completed_main_message || ""),
      pendingCompletionMessage: clone(state?.objectives?.pending_completion_message || null)
    };
    for (const objective of Array.isArray(state?.objectives?.items) ? state.objectives.items : []) {
      const id = String(objective?.id || "").trim();
      if (!id) continue;
      const objectiveDefinition = objectiveDefinitionById(id) || authored[id] || {};
      const initialStatus = String(objectiveDefinition.initialStatus || objectiveDefinition.status || "hidden");
      const status = String(objective.status || initialStatus);
      if (status !== initialStatus) runtime.statusById[id] = status;
      const selectedOutcomeId = String(objective.selected_outcome_id || "");
      if (selectedOutcomeId) runtime.selectedOutcomeById[id] = selectedOutcomeId;
      const selectedMessageId = String(objective.selected_outcome_message_id || "");
      if (selectedMessageId) runtime.selectedOutcomeMessageById[id] = selectedMessageId;
      const selectedChoiceId = String(objective.selected_choice_id || "");
      if (selectedChoiceId) runtime.selectedChoiceById[id] = selectedChoiceId;
      const selectedChoiceTitle = String(objective.selected_choice_title || "");
      if (selectedChoiceTitle) runtime.selectedChoiceTitleById[id] = selectedChoiceTitle;
      const selectedOutputId = String(objective.selected_output_id || "");
      if (selectedOutputId) runtime.selectedOutputById[id] = selectedOutputId;
      const notes = objective.progress_notes;
      if (notes != null && notes !== "" && !runtime.progressNotesById[id]) runtime.progressNotesById[id] = clone(notes);
    }
    return runtime;
  }
  function objectiveInitialRuntimeStatus(id = "", objective = null) {
    const definition = objectiveDefinitionById(id) || objective || {};
    return String(definition.initialStatus || definition.status || "hidden");
  }
  function clearSparseObjectiveRuntimeEntry(id = "") {
    const key = String(id || "").trim();
    if (!key || !app.objectiveRuntime) return;
    for (const mapName of ["statusById", "selectedOutcomeById", "selectedOutcomeMessageById", "selectedChoiceById", "selectedChoiceTitleById", "selectedOutputById", "progressNotesById", "activationAiCheckAttemptedById", "activationNumberById"]) {
      if (app.objectiveRuntime[mapName]) delete app.objectiveRuntime[mapName][key];
    }
    updateObjectiveRuntimeLookupStatus(app.state, key, objectiveInitialRuntimeStatus(key));
  }
  function syncSparseObjectiveRuntimeEntry(objective = null, state = app.state, options = {}) {
    if (state !== app.state || !objective || typeof objective !== "object") return false;
    const id = String(objective.id || "").trim();
    if (!id) return false;
    app.objectiveRuntime ||= createEmptyObjectiveRuntime();
    const runtime = app.objectiveRuntime;
    const initialStatus = objectiveInitialRuntimeStatus(id, objective);
    const status = String(objective.status || initialStatus);
    if (status === initialStatus) delete runtime.statusById[id];else runtime.statusById[id] = status;
    const selectedOutcomeId = String(objective.selected_outcome_id || "");
    if (selectedOutcomeId) runtime.selectedOutcomeById[id] = selectedOutcomeId;else delete runtime.selectedOutcomeById[id];
    const selectedOutcomeMessageId = String(objective.selected_outcome_message_id || "");
    if (selectedOutcomeMessageId) runtime.selectedOutcomeMessageById[id] = selectedOutcomeMessageId;else delete runtime.selectedOutcomeMessageById[id];
    const selectedChoiceId = String(objective.selected_choice_id || "");
    if (selectedChoiceId) runtime.selectedChoiceById[id] = selectedChoiceId;else delete runtime.selectedChoiceById[id];
    const selectedChoiceTitle = String(objective.selected_choice_title || "");
    if (selectedChoiceTitle) runtime.selectedChoiceTitleById[id] = selectedChoiceTitle;else delete runtime.selectedChoiceTitleById[id];
    const selectedOutputId = String(objective.selected_output_id || "");
    if (selectedOutputId) runtime.selectedOutputById[id] = selectedOutputId;else delete runtime.selectedOutputById[id];
    const notes = objective.progress_notes ?? state?.objectives?.progress_notes?.[id];
    if (notes != null && notes !== "" && (!Array.isArray(notes) || notes.length)) runtime.progressNotesById[id] = runtimeSaveCloneValue(notes);else delete runtime.progressNotesById[id];
    app.objectiveRuntimeNeedsFullSync = false;
    updateObjectiveRuntimeLookupStatus(state, id, status);
    if (options.markDirty !== false) markRuntimeRecordDirty("objective-runtime", "current");
    if (options.bumpRevision !== false) bumpDomainRevision("objectives");
    return true;
  }
  function syncSparseObjectiveRuntimeControls(state = app.state, options = {}) {
    if (state !== app.state) return false;
    app.objectiveRuntime ||= createEmptyObjectiveRuntime();
    const source = state?.objectives || {};
    Object.assign(app.objectiveRuntime, {
      activeMainObjectiveId: String(source.active_id || ""),
      focusedSideObjectiveId: String(source.focus_id || ""),
      noCurrent: source.no_current === true,
      pendingRewardChoices: runtimeSaveCloneValue(source.pending_reward_choices || []),
      pendingChoice: runtimeSaveCloneValue(source.pending_choice || null),
      exclusiveGroupChoices: runtimeSaveCloneValue(source.exclusive_group_choices || {}),
      suggestions: runtimeSaveCloneValue(source.suggestions || []),
      completionMessage: String(source.completion_message || ""),
      completedMainMessage: String(source.completed_main_message || ""),
      pendingCompletionMessage: runtimeSaveCloneValue(source.pending_completion_message || null)
    });
    app.objectiveRuntime.progressNotesById = runtimeSaveCloneValue(source.progress_notes || {});
    app.objectiveRuntimeNeedsFullSync = false;
    if (options.markDirty !== false) markRuntimeRecordDirty("objective-runtime", "current");
    if (options.bumpRevision !== false) bumpDomainRevision("objectives");
    return true;
  }
  function syncObjectiveRuntimeFromMutationPath(path = [], operation = {}) {
    if (!app.storyDefinition || !Array.isArray(path) || path[0] !== "objectives") return;
    const field = String(path[1] || "");
    if (field === "items") {
      const index = Number(path[2]);
      if (Number.isInteger(index) && index >= 0) {
        const current = app.state?.objectives?.items?.[index];
        const currentId = String(current?.id || "").trim();
        if (path.length === 3) {
          const prior = runtimeSaveUnwrap(operation.beforeValue);
          const priorId = String(prior?.id || "").trim();
          if (priorId && priorId !== currentId) clearSparseObjectiveRuntimeEntry(priorId);
          if (priorId !== currentId) app.objectiveRuntimeLookup = null;
        }
        if (currentId) syncSparseObjectiveRuntimeEntry(current, app.state, {
          markDirty: false,
          bumpRevision: false
        });
        return;
      }
      if (String(path[2] || "") === "length") return;
      app.objectiveRuntimeLookup = null;
      throw new Error(`Unsupported bulk objective mutation at ${path.join(".")}. ` + "Objective definitions are immutable; update sparse objective runtime instead.");
    }
    if (field === "progress_notes" && path.length > 2) {
      const id = String(path[2] || "").trim();
      if (id) {
        const value = app.state?.objectives?.progress_notes?.[id];
        if (value != null && (!Array.isArray(value) || value.length)) app.objectiveRuntime.progressNotesById[id] = runtimeSaveCloneValue(value);else delete app.objectiveRuntime.progressNotesById[id];
        return;
      }
    }
    if (["active_id", "focus_id", "no_current", "pending_reward_choices", "pending_choice", "exclusive_group_choices", "suggestions", "completion_message", "completed_main_message", "pending_completion_message", "progress_notes"].includes(field)) {
      syncSparseObjectiveRuntimeControls(app.state, {
        markDirty: false,
        bumpRevision: false
      });
      return;
    }
    throw new Error(`Unsupported objective mutation at ${path.join(".")}. ` + "Objective definitions are immutable; update sparse objective runtime instead.");
  }
  function createEmptyRewardRuntime() {
    return {
      appliedInvocationIds: {}
    };
  }
  function storyRuleStableKey(rule) {
    return stableContentHash(rule);
  }
  function storyRulesRuntimeFromState(state = app.state, definition = app.storyDefinition) {
    const authored = Array.isArray(definition?.storyRules) ? definition.storyRules : [];
    const current = Array.isArray(state?.story_rules) ? state.story_rules : [];
    const authoredKeys = new Map(authored.map(rule => [storyRuleStableKey(rule), rule]));
    const currentKeys = new Map(current.map(rule => [storyRuleStableKey(rule), rule]));
    return {
      added: current.filter(rule => !authoredKeys.has(storyRuleStableKey(rule))).map(clone),
      removedKeys: authored.filter(rule => !currentKeys.has(storyRuleStableKey(rule))).map(storyRuleStableKey)
    };
  }
  function effectiveStoryRules(definition = app.storyDefinition, runtime = app.storyRulesRuntime) {
    const removed = new Set(runtime?.removedKeys || []);
    return [...(Array.isArray(definition?.storyRules) ? definition.storyRules.filter(rule => !removed.has(storyRuleStableKey(rule))) : []), ...(Array.isArray(runtime?.added) ? runtime.added : [])].map(clone);
  }
  function runtimeJobDefinitionFromJob(job = {}) {
    const runtimeKeys = new Set(["status", "progress", "current_step_id", "currentStepId", "completed_step_ids", "completedStepIds", "accepted_at", "acceptedAt", "completed_at", "completedAt"]);
    const definition = {};
    for (const [key, value] of Object.entries(job || {})) {
      if (runtimeKeys.has(key)) continue;
      definition[key] = clone(value);
    }
    return definition;
  }
  function runtimeJobStateFromJob(job = {}, definitionId = "") {
    return {
      definitionId,
      status: job.status || "active",
      progress: clone(job.progress || {}),
      currentStepId: String(job.current_step_id || job.currentStepId || ""),
      completedStepIds: clone(job.completed_step_ids || job.completedStepIds || []),
      acceptedAt: job.accepted_at || job.acceptedAt || "",
      completedAt: job.completed_at || job.completedAt || ""
    };
  }
  function rebuildRuntimeJobObjectiveIndexes(runtimeDefinitions = app.runtimeDefinitions) {
    if (!runtimeDefinitions || typeof runtimeDefinitions !== "object") throw new Error("Runtime definitions are required.");
    const objectivesById = {};
    const objectiveDependentsById = {};
    const objectiveIdsByExclusiveGroup = {};
    for (const job of Object.values(runtimeDefinitions.jobsById || {})) {
      for (const objective of Array.isArray(job?.objectives) ? job.objectives : []) {
        const id = String(objective?.id || "").trim();
        if (!id) throw new Error("Generated job objective id is required.");
        if (objectivesById[id]) throw new Error(`Generated job objective id is duplicated: ${id}.`);
        objectivesById[id] = objective;
        for (const requiredId of objectiveRequiredIds(objective)) (objectiveDependentsById[requiredId] ||= []).push(id);
        for (const transition of objectiveOutputTransitions(objective)) {
          const targetId = String(transition.objective_id || transition.next_objective_id || "").trim();
          if (targetId) (objectiveDependentsById[id] ||= []).push(targetId);
        }
        const group = objectiveExclusiveGroup(objective);
        if (group) (objectiveIdsByExclusiveGroup[group] ||= []).push(id);
      }
    }
    runtimeDefinitions.objectivesById = objectivesById;
    for (const [id, ids] of Object.entries(objectiveDependentsById)) objectiveDependentsById[id] = [...new Set(ids)].sort();
    runtimeDefinitions.objectiveDependentsById = objectiveDependentsById;
    runtimeDefinitions.objectiveIdsByExclusiveGroup = objectiveIdsByExclusiveGroup;
    return runtimeDefinitions;
  }
  function ensureRuntimeJobObjectiveIndexes(runtimeDefinitions = app.runtimeDefinitions) {
    if (!runtimeDefinitions?.objectivesById || !runtimeDefinitions?.objectiveDependentsById || !runtimeDefinitions?.objectiveIdsByExclusiveGroup) rebuildRuntimeJobObjectiveIndexes(runtimeDefinitions);
    return runtimeDefinitions;
  }
  function ensureRuntimeJobDefinition(job = {}, fallbackId = "") {
    const existingId = String(job.definition_id || job.definitionId || job.id || fallbackId || "").trim();
    const id = existingId || generatedPersistentId("job");
    const existing = app.runtimeDefinitions.jobsById[id];
    if (!existing) {
      assertGeneratedIdAvailable(id, "runtime job");
      const definition = runtimeJobDefinitionFromJob({
        ...job,
        id
      });
      definition.id = id;
      app.runtimeDefinitions.jobsById[id] = deepFreezeDefinition(definition);
      rebuildRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
      markRuntimeRecordDirty("runtime-definition", `job:${id}`);
    }
    if (!job.definition_id) job.definition_id = id;
    return id;
  }
  function registerGeneratedJobRuntime(job = {}) {
    const jobId = String(job.id || "").trim();
    if (!jobId) throw new Error("Generated job id is required.");
    const definitionId = ensureRuntimeJobDefinition(job, jobId);
    app.jobRuntime ||= {
      activeJobsById: {},
      runtimeByJobId: {}
    };
    app.jobRuntime.activeJobsById[jobId] = {
      definitionId
    };
    app.jobRuntime.runtimeByJobId[jobId] = runtimeJobStateFromJob(job, definitionId);
    job.definition_id = definitionId;
    markRuntimeRecordDirty("job-runtime", "current");
    bumpDomainRevision("jobs");
    return job;
  }
  function materializeGeneratedJobObjectiveView(jobId = "", state = app.state) {
    const id = String(jobId || "").trim();
    const activeJob = state?.active_generated_jobs?.[id];
    const definitionId = String(activeJob?.definition_id || activeJob?.definitionId || app.jobRuntime?.activeJobsById?.[id]?.definitionId || id).trim();
    const definition = app.runtimeDefinitions?.jobsById?.[definitionId];
    if (!id || !definition) throw new Error(`Generated job ${id || "(missing id)"} has no immutable definition.`);
    const rawState = runtimeSaveUnwrap(state);
    rawState.objectives ||= {
      active_id: "",
      focus_id: "",
      items: []
    };
    rawState.objectives.items ||= [];
    const existingIds = new Set(rawState.objectives.items.map(objective => String(objective?.id || "").trim()).filter(Boolean));
    for (const objectiveDefinition of definition.objectives || []) {
      const objectiveId = String(objectiveDefinition?.id || "").trim();
      if (!objectiveId) throw new Error(`Generated job ${id} has an objective without an id.`);
      if (existingIds.has(objectiveId)) throw new Error(`Generated job objective id collision: ${objectiveId}`);
      const objective = clone(objectiveDefinition);
      objective.status = Object.prototype.hasOwnProperty.call(app.objectiveRuntime?.statusById || {}, objectiveId) ? app.objectiveRuntime.statusById[objectiveId] : objectiveDefinition.initialStatus || objectiveDefinition.status || "hidden";
      if (app.objectiveRuntime?.selectedOutcomeById?.[objectiveId]) objective.selected_outcome_id = app.objectiveRuntime.selectedOutcomeById[objectiveId];
      if (app.objectiveRuntime?.selectedOutcomeMessageById?.[objectiveId]) objective.selected_outcome_message_id = app.objectiveRuntime.selectedOutcomeMessageById[objectiveId];
      if (app.objectiveRuntime?.selectedChoiceById?.[objectiveId]) objective.selected_choice_id = app.objectiveRuntime.selectedChoiceById[objectiveId];
      if (app.objectiveRuntime?.selectedChoiceTitleById?.[objectiveId]) objective.selected_choice_title = app.objectiveRuntime.selectedChoiceTitleById[objectiveId];
      if (app.objectiveRuntime?.selectedOutputById?.[objectiveId]) objective.selected_output_id = app.objectiveRuntime.selectedOutputById[objectiveId];
      if (app.objectiveRuntime?.progressNotesById?.[objectiveId] != null) objective.progress_notes = clone(app.objectiveRuntime.progressNotesById[objectiveId]);
      rawState.objectives.items.push(objective);
      existingIds.add(objectiveId);
    }
    if (state === app.state) {
      app.objectiveRuntimeLookup = null;
      runtimeRenderMutationRoots.add("objectives");
    }
    return rawState.objectives.items;
  }
  function removeGeneratedJobObjectiveViewEntries(objectiveIds = [], state = app.state) {
    const ids = objectiveIds instanceof Set ? objectiveIds : new Set((objectiveIds || []).map(String));
    const rawState = runtimeSaveUnwrap(state);
    if (!Array.isArray(rawState?.objectives?.items) || !ids.size) return false;
    const retained = rawState.objectives.items.filter(objective => !ids.has(String(objective?.id || "")));
    if (retained.length === rawState.objectives.items.length) return false;
    rawState.objectives.items = retained;
    if (state === app.state) {
      app.objectiveRuntimeLookup = null;
      runtimeRenderMutationRoots.add("objectives");
    }
    return true;
  }
  function rebuildGeneratedJobObjectiveViews(state = app.state) {
    const rawState = runtimeSaveUnwrap(state);
    const generatedObjectiveIds = new Set();
    for (const definition of Object.values(app.runtimeDefinitions?.jobsById || {})) {
      for (const objective of definition?.objectives || []) {
        const objectiveId = String(objective?.id || "").trim();
        if (objectiveId) generatedObjectiveIds.add(objectiveId);
      }
    }
    if (generatedObjectiveIds.size) removeGeneratedJobObjectiveViewEntries(generatedObjectiveIds, state);
    for (const jobId of Object.keys(rawState?.active_generated_jobs || {})) materializeGeneratedJobObjectiveView(jobId, state);
  }
  function ensureRuntimeCharacterDefinition(character = {}, fallbackName = "") {
    const authoredId = String(character.id || character.character_id || "").trim();
    if (authoredId && app.storyDefinition?.characterDefinitionsById?.[authoredId]) return authoredId;
    const existingId = String(character.definition_id || character.definitionId || "").trim();
    const id = existingId || assertGeneratedIdAvailable(generatedPersistentId(RUNTIME_DEFINITION_NAMESPACES.character.replace(/-$/, "")), "runtime character");
    if (!app.runtimeDefinitions.charactersById[id]) {
      const definition = characterDefinitionFields(character, id);
      definition.id = id;
      definition.name ||= fallbackName || id;
      app.runtimeDefinitions.charactersById[id] = deepFreezeDefinition(definition);
      markRuntimeRecordDirty("runtime-definition", `character:${id}`);
    }
    if (!character.definition_id) character.definition_id = id;
    return id;
  }
  function immutableStoryDefinitionFromState(state = app.state, options = {}) {
    const objectiveItems = Array.isArray(state?.objectives?.items) ? state.objectives.items : [];
    const precompiledObjectives = options.objectiveCompilation || null;
    const objectivesById = precompiledObjectives?.objectivesById || {};
    const objectiveOrder = precompiledObjectives?.objectiveOrder || [];
    const objectiveDependentsById = precompiledObjectives?.objectiveDependentsById || {};
    const objectiveIdsByExclusiveGroup = precompiledObjectives?.objectiveIdsByExclusiveGroup || {};
    if (!precompiledObjectives) {
      for (let index = 0; index < objectiveItems.length; index++) {
        const definition = objectiveDefinitionFromRuntimeObjective(objectiveItems[index], index);
        if (String(definition.id).startsWith("job-")) throw new Error(`Authored objective ids may not use reserved job namespace: ${definition.id}`);
        if (objectivesById[definition.id]) throw new Error(`Duplicate authored objective id: ${definition.id}`);
        objectivesById[definition.id] = definition;
        objectiveOrder.push(definition.id);
      }
      for (const [id, objective] of Object.entries(objectivesById)) {
        for (const requiredId of objectiveRequiredIds(objective)) {
          (objectiveDependentsById[requiredId] ||= []).push(id);
        }
        for (const transition of objectiveOutputTransitions(objective)) {
          const targetId = String(transition.objective_id || transition.next_objective_id || "").trim();
          if (targetId) (objectiveDependentsById[id] ||= []).push(targetId);
        }
        const group = objectiveExclusiveGroup(objective);
        if (group) (objectiveIdsByExclusiveGroup[group] ||= []).push(id);
      }
      for (const [id, ids] of Object.entries(objectiveDependentsById)) objectiveDependentsById[id] = [...new Set(ids)].sort();
      for (const ids of Object.values(objectiveIdsByExclusiveGroup)) ids.sort();
    }
    const characterDefinitionsById = {};
    for (const [name, character] of Object.entries(state?.characters || {})) {
      const definition = characterDefinitionFields(character, character.id || name);
      definition.id ||= safeRuntimeIdPart(name);
      characterDefinitionsById[definition.id] = definition;
    }
    for (const location of Object.values(state?.npc_directory?.locations || {})) {
      for (const [name, npc] of Object.entries(location?.characters || {})) {
        if (!isPlainObject(npc?.full_character)) continue;
        const definition = characterDefinitionFields(npc.full_character, npc.definition_id || npc.full_character.id || objectiveIdFromTitle(name, "npc"));
        definition.id ||= safeRuntimeIdPart(name);
        if (characterDefinitionsById[definition.id]) {
          const existingName = normalizeNameForMatch(characterDefinitionsById[definition.id]?.name);
          if (existingName !== normalizeNameForMatch(definition.name)) throw new Error(`Character definition id collision: ${definition.id}`);
        } else {
          characterDefinitionsById[definition.id] = definition;
        }
      }
    }
    const futureCastDefinitionsById = {};
    for (const [id, entry] of Object.entries(state?.future_cast?.items || {})) {
      const definition = clone(entry);
      if (isPlainObject(entry?.full_character)) {
        const characterDefinition = characterDefinitionFields(entry.full_character, entry.full_character.id || entry.character_id || id);
        characterDefinition.id ||= safeRuntimeIdPart(id);
        characterDefinitionsById[characterDefinition.id] ||= characterDefinition;
        definition.character_definition_id = characterDefinition.id;
        delete definition.full_character;
      }
      futureCastDefinitionsById[id] = definition;
    }
    const locationDefinitionsById = {};
    for (const [id, location] of Object.entries(state?.world_map?.locations || {})) {
      locationDefinitionsById[id] = clone(location);
    }
    const storyId = String(options.storyId || state?.meta?.story_source?.id || state?.meta?.story_source?.title || state?.meta?.story_id || "original");
    const content = {
      storyId,
      metadata: clone(state?.meta?.story_source || {}),
      objectivesById,
      objectiveOrder,
      objectiveDependentsById,
      objectiveIdsByExclusiveGroup,
      characterDefinitionsById,
      locationDefinitionsById,
      futureCastDefinitionsById,
      futureCastEnabledDefault: state?.future_cast?.enabled !== false,
      timedEventDefinitionsById: clone(state?.timed_events || {}),
      rewardDefinitionsById: clone(state?.reward_bundles || {}),
      rewardTemplatesById: clone(state?.reward_templates || {}),
      characterShopCostTemplatesById: clone(state?.character_shop_cost_templates || {}),
      shopDefinitionsById: clone(state?.story_shops || {}),
      storyRules: clone(state?.story_rules || [])
    };
    const contentHash = stableContentHash(content);
    const revisionId = String(options.revisionId || state?.meta?.definition_revision_id || generatedPersistentId("story-revision"));
    const definition = {
      revisionId,
      storyId,
      contentHash,
      ...content,
      initialRuntimeTemplate: null
    };
    return definition;
  }
  function installImmutableStoryDefinitionFromState(state = app.state, options = {}) {
    const definition = immutableStoryDefinitionFromState(state, options);
    app.storyDefinition = deepFreezeDefinition(definition);
    app.objectiveRuntime = objectiveRuntimeFromState(state, app.storyDefinition);
    app.objectiveRuntimeNeedsFullSync = false;
    app.rewardRuntime = createEmptyRewardRuntime();
    app.storyRulesRuntime = storyRulesRuntimeFromState(state, app.storyDefinition);
    state.meta ||= {};
    state.meta.definition_revision_id = definition.revisionId;
    state.meta.definition_content_hash = definition.contentHash;
    app.runtimeStateReference = state;
    markRuntimeRecordDirty("objective-runtime", "current");
    markRuntimeRecordDirty("reward-runtime", "current");
    markRuntimeRecordDirty("story-rules-runtime", "current");
    return definition;
  }
  function readonlyDefinitionView(value, cache = new WeakMap()) {
    if (!value || typeof value !== "object") return value;
    const cached = cache.get(value);
    if (cached) return cached;
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        return readonlyDefinitionView(Reflect.get(target, key, receiver), cache);
      },
      set() {
        return false;
      },
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      }
    });
    cache.set(value, proxy);
    return proxy;
  }
  function adoptWorkerCompiledStoryDefinition(compiled = {}, state = app.state) {
    const definition = compiled?.definition;
    if (!definition || typeof definition !== "object" || !definition.revisionId) throw new Error("Story-definition worker returned no compiled definition.");
    // Structured cloning from the worker does not retain Object.freeze().
    // This lazy readonly view keeps authored data immutable without walking
    // thousands of definition objects again on the UI thread.
    app.storyDefinition = readonlyDefinitionView(definition);
    app.objectiveRuntime = compiled.objectiveRuntime || objectiveRuntimeFromState(state, app.storyDefinition);
    app.rewardRuntime = compiled.rewardRuntime || createEmptyRewardRuntime();
    app.storyRulesRuntime = compiled.storyRulesRuntime || storyRulesRuntimeFromState(state, app.storyDefinition);
    app.jobRuntime = compiled.jobRuntime || runtimeJobAggregateFromState(state);
    app.objectiveRuntimeNeedsFullSync = false;
    state.meta ||= {};
    state.meta.definition_revision_id = app.storyDefinition.revisionId;
    state.meta.definition_content_hash = app.storyDefinition.contentHash;
    app.runtimeStateReference = state;
    markRuntimeRecordDirty("objective-runtime", "current");
    markRuntimeRecordDirty("reward-runtime", "current");
    markRuntimeRecordDirty("story-rules-runtime", "current");
    return app.storyDefinition;
  }
  async function compileStoryDefinitionRuntimeInWorker(state = app.state, options = {}) {
    const sourceState = runtimeSaveUnwrap(state);
    const reportProgress = message => {
      const text = String(message || "Building story definition");
      troubleshootingLog("story definition worker progress", {
        message: text,
        objectives: Array.isArray(sourceState?.objectives?.items) ? sourceState.objectives.items.length : 0
      });
      options.onProgress?.(text);
    };
    const compiled = await storyImportWorkerRequest("compile-story-definition", {
      state: sourceState,
      definitionRevisionId: options.definitionRevisionId || "",
      validatedObjectiveGraph: options.validatedObjectiveGraph || null
    }, {
      onProgress: reportProgress
    });
    return compiled;
  }
  function authoredObjectiveDefinition(id = "") {
    return app.storyDefinition?.objectivesById?.[String(id || "")] || null;
  }
  function generatedJobObjectiveDefinition(id = "") {
    const target = String(id || "").trim();
    if (!target) return null;
    ensureRuntimeJobObjectiveIndexes(app.runtimeDefinitions);
    return app.runtimeDefinitions?.objectivesById?.[target] || null;
  }
  function objectiveDefinitionById(id = "") {
    return authoredObjectiveDefinition(id) || generatedJobObjectiveDefinition(id);
  }
  function explicitObjectiveRuntimeStatus(id = "") {
    const key = String(id || "");
    return Object.prototype.hasOwnProperty.call(app.objectiveRuntime?.statusById || {}, key) ? app.objectiveRuntime.statusById[key] : undefined;
  }
  function effectiveObjectiveStatus(idOrObjective, state = app.state, resolvedStatusCache = null) {
    const requestedId = String(typeof idOrObjective === "string" ? idOrObjective : idOrObjective?.id || "");
    if (!requestedId) return "hidden";
    if (resolvedStatusCache instanceof Map && resolvedStatusCache.has(requestedId)) return resolvedStatusCache.get(requestedId);
    const status = recordedObjectiveStatus(idOrObjective, state);
    if (resolvedStatusCache instanceof Map) resolvedStatusCache.set(requestedId, status);
    return status;
  }
  const OBJECTIVE_MUTABLE_VIEW_FIELDS = Object.freeze(["status", "selected_outcome_id", "selected_outcome_message_id", "progress_notes", "available_now", "blocked_reason", "auto_completed_from_prereqs", "pending_choice", "selected_choice_id", "selected_choice_title", "selected_output_id"]);
  function beginObjectiveMutationTransaction(state = app.state, label = "objective mutation") {
    const existing = app.activeObjectiveMutationTransaction;
    if (existing && existing.state === state) {
      existing.depth += 1;
      return {
        transaction: existing,
        owner: false
      };
    }
    const transaction = {
      state,
      label,
      depth: 1,
      entries: new Map(),
      controls: null,
      recentChanges: null,
      runtimeControl: null,
      stateFields: new Map()
    };
    app.activeObjectiveMutationTransaction = transaction;
    return {
      transaction,
      owner: true
    };
  }
  function captureObjectiveMutationControls(state = app.state) {
    const transaction = app.activeObjectiveMutationTransaction;
    if (!transaction || transaction.state !== state || transaction.controls) return;
    const objectives = state?.objectives || {};
    transaction.controls = {};
    for (const key of ["active_id", "focus_id", "no_current", "pending_choice", "pending_reward_choices", "progress_notes", "suggestions", "exclusive_group_choices"]) {
      transaction.controls[key] = {
        existed: Object.prototype.hasOwnProperty.call(objectives, key),
        value: runtimeSaveCloneValue(objectives[key])
      };
    }
    transaction.runtimeControl = {
      activeMainObjectiveId: app.objectiveRuntime?.activeMainObjectiveId || "",
      focusedSideObjectiveId: app.objectiveRuntime?.focusedSideObjectiveId || "",
      noCurrent: app.objectiveRuntime?.noCurrent === true,
      pendingRewardChoices: runtimeSaveCloneValue(app.objectiveRuntime?.pendingRewardChoices || []),
      progressNotesById: runtimeSaveCloneValue(app.objectiveRuntime?.progressNotesById || {}),
      pendingChoice: runtimeSaveCloneValue(app.objectiveRuntime?.pendingChoice || null),
      exclusiveGroupChoices: runtimeSaveCloneValue(app.objectiveRuntime?.exclusiveGroupChoices || {}),
      suggestions: runtimeSaveCloneValue(app.objectiveRuntime?.suggestions || []),
      completionMessage: String(app.objectiveRuntime?.completionMessage || ""),
      completedMainMessage: String(app.objectiveRuntime?.completedMainMessage || ""),
      pendingCompletionMessage: runtimeSaveCloneValue(app.objectiveRuntime?.pendingCompletionMessage || null)
    };
    transaction.recentChanges = {
      existed: Object.prototype.hasOwnProperty.call(state || {}, "recent_changes"),
      value: runtimeSaveCloneValue(state?.recent_changes)
    };
  }
  function captureObjectiveMutationEntry(state = app.state, objectiveOrId = "") {
    const transaction = app.activeObjectiveMutationTransaction;
    if (!transaction || transaction.state !== state) return;
    const id = String(typeof objectiveOrId === "object" ? objectiveOrId?.id || "" : objectiveOrId || "").trim();
    if (!id || transaction.entries.has(id)) return;
    captureObjectiveMutationControls(state);
    const objective = typeof objectiveOrId === "object" ? objectiveOrId : (state?.objectives?.items || []).find(item => String(item?.id || "") === id);
    const fields = {};
    for (const key of OBJECTIVE_MUTABLE_VIEW_FIELDS) {
      fields[key] = {
        existed: !!objective && Object.prototype.hasOwnProperty.call(objective, key),
        value: objective ? runtimeSaveCloneValue(objective[key]) : undefined
      };
    }
    const runtime = {};
    for (const [mapName, map] of Object.entries({
      statusById: app.objectiveRuntime?.statusById,
      selectedOutcomeById: app.objectiveRuntime?.selectedOutcomeById,
      selectedOutcomeMessageById: app.objectiveRuntime?.selectedOutcomeMessageById,
      selectedChoiceById: app.objectiveRuntime?.selectedChoiceById,
      selectedChoiceTitleById: app.objectiveRuntime?.selectedChoiceTitleById,
      selectedOutputById: app.objectiveRuntime?.selectedOutputById,
      progressNotesById: app.objectiveRuntime?.progressNotesById,
      activationAiCheckAttemptedById: app.objectiveRuntime?.activationAiCheckAttemptedById,
      activationNumberById: app.objectiveRuntime?.activationNumberById
    })) {
      runtime[mapName] = {
        existed: !!map && Object.prototype.hasOwnProperty.call(map, id),
        value: runtimeSaveCloneValue(map?.[id])
      };
    }
    transaction.entries.set(id, {
      id,
      objective,
      fields,
      runtime
    });
  }
  function captureObjectiveMutationStateFields(state = app.state, keys = []) {
    const transaction = app.activeObjectiveMutationTransaction;
    if (!transaction || transaction.state !== state) return;
    transaction.stateFields ||= new Map();
    for (const key of keys) {
      if (!key || transaction.stateFields.has(key)) continue;
      transaction.stateFields.set(key, {
        existed: Object.prototype.hasOwnProperty.call(state, key),
        value: runtimeSaveCloneValue(state[key])
      });
    }
  }
  function finishObjectiveMutationTransaction(handle, commit = true) {
    const transaction = handle?.transaction;
    if (!transaction) return;
    transaction.depth = Math.max(0, transaction.depth - 1);
    if (!handle.owner) return;
    if (!commit) {
      const state = transaction.state;
      const objectives = state?.objectives || {};
      for (const entry of transaction.entries.values()) {
        if (entry.objective) {
          for (const [key, saved] of Object.entries(entry.fields)) {
            if (saved.existed) entry.objective[key] = runtimeSaveCloneValue(saved.value);else delete entry.objective[key];
          }
        }
        for (const [mapName, saved] of Object.entries(entry.runtime)) {
          app.objectiveRuntime[mapName] ||= {};
          if (saved.existed) app.objectiveRuntime[mapName][entry.id] = runtimeSaveCloneValue(saved.value);else delete app.objectiveRuntime[mapName][entry.id];
        }
      }
      for (const [key, saved] of Object.entries(transaction.controls || {})) {
        if (saved.existed) objectives[key] = runtimeSaveCloneValue(saved.value);else delete objectives[key];
      }
      if (transaction.runtimeControl) {
        Object.assign(app.objectiveRuntime, runtimeSaveCloneValue(transaction.runtimeControl));
      }
      if (transaction.recentChanges?.existed) state.recent_changes = runtimeSaveCloneValue(transaction.recentChanges.value);else if (transaction.recentChanges) delete state.recent_changes;
      for (const [key, saved] of transaction.stateFields || []) {
        if (saved.existed) state[key] = runtimeSaveCloneValue(saved.value);else delete state[key];
      }
      app.objectiveRuntimeLookup = null;
    }
    if (app.activeObjectiveMutationTransaction === transaction) app.activeObjectiveMutationTransaction = null;
  }
  function objectiveDebugStateProjection(state = app.state) {
    return {
      objectives: {
        items: (state?.objectives?.items || []).map(objective => ({
          id: objective?.id || "",
          title: objective?.title || "",
          type: objective?.type || "",
          status: effectiveObjectiveStatus(objective, state),
          requires: objectiveRequiredIds(objective)
        }))
      }
    };
  }
  function setObjectiveRuntimeStatus(state = app.state, objectiveOrId = "", status = "hidden") {
    const id = String(typeof objectiveOrId === "object" ? objectiveOrId?.id || "" : objectiveOrId || "").trim();
    if (!id) throw new Error("Objective id is required for a runtime status update.");
    const objective = typeof objectiveOrId === "object" ? objectiveOrId : (state?.objectives?.items || []).find(item => String(item?.id || "") === id);
    const nextStatus = String(status || "hidden");
    const previousStatus = recordedObjectiveStatus(objective || id, state);
    if (previousStatus === nextStatus) return nextStatus;
    captureObjectiveMutationEntry(state, objective || id);
    if (objective) objective.status = nextStatus;
    if (state === app.state) {
      app.objectiveRuntime ||= objectiveRuntimeFromState(state, app.storyDefinition);
      app.objectiveRuntime.statusById ||= {};
      const initial = String(objectiveDefinitionById(id)?.initialStatus || objectiveDefinitionById(id)?.status || "hidden");
      if (nextStatus === initial) delete app.objectiveRuntime.statusById[id];else app.objectiveRuntime.statusById[id] = nextStatus;
      if (/^(complete|completed|done|success|succeeded)$/i.test(previousStatus) && !objectiveCompletionStatus(nextStatus)) {
        app.objectiveRuntime.activationNumberById ||= {};
        app.objectiveRuntime.activationAiCheckAttemptedById ||= {};
        app.objectiveRuntime.activationNumberById[id] = Number(app.objectiveRuntime.activationNumberById[id] || 0) + 1;
        delete app.objectiveRuntime.activationAiCheckAttemptedById[id];
      }
      markRuntimeRecordDirty("objective-runtime", "current");
      bumpDomainRevision("objectives");
      runtimeRenderMutationRoots.add("objectives");
      updateObjectiveRuntimeLookupStatus(state, id, nextStatus);
    }
    return nextStatus;
  }
  function setObjectiveRuntimeSelection(state = app.state, objectiveOrId = "", outcomeId = "", messageId = "") {
    const id = String(typeof objectiveOrId === "object" ? objectiveOrId?.id || "" : objectiveOrId || "").trim();
    if (!id) throw new Error("Objective id is required for a runtime outcome update.");
    const objective = typeof objectiveOrId === "object" ? objectiveOrId : (state?.objectives?.items || []).find(item => String(item?.id || "") === id);
    captureObjectiveMutationEntry(state, objective || id);
    if (objective) {
      if (outcomeId) objective.selected_outcome_id = String(outcomeId);else delete objective.selected_outcome_id;
      if (messageId) objective.selected_outcome_message_id = String(messageId);else delete objective.selected_outcome_message_id;
    }
    if (state === app.state) {
      app.objectiveRuntime ||= objectiveRuntimeFromState(state, app.storyDefinition);
      app.objectiveRuntime.selectedOutcomeById ||= {};
      app.objectiveRuntime.selectedOutcomeMessageById ||= {};
      if (outcomeId) app.objectiveRuntime.selectedOutcomeById[id] = String(outcomeId);else delete app.objectiveRuntime.selectedOutcomeById[id];
      if (messageId) app.objectiveRuntime.selectedOutcomeMessageById[id] = String(messageId);else delete app.objectiveRuntime.selectedOutcomeMessageById[id];
      markRuntimeRecordDirty("objective-runtime", "current");
      bumpDomainRevision("objectives");
    }
  }
  function syncObjectiveRuntimeControls(state = app.state) {
    if (state !== app.state) return;
    captureObjectiveMutationControls(state);
    app.objectiveRuntime ||= objectiveRuntimeFromState(state, app.storyDefinition);
    app.objectiveRuntime.activeMainObjectiveId = String(state?.objectives?.active_id || "");
    app.objectiveRuntime.focusedSideObjectiveId = String(state?.objectives?.focus_id || "");
    app.objectiveRuntime.noCurrent = state?.objectives?.no_current === true;
    app.objectiveRuntime.pendingRewardChoices = runtimeSaveCloneValue(state?.objectives?.pending_reward_choices || []);
    app.objectiveRuntime.progressNotesById = runtimeSaveCloneValue(state?.objectives?.progress_notes || {});
    app.objectiveRuntime.pendingChoice = runtimeSaveCloneValue(state?.objectives?.pending_choice || null);
    app.objectiveRuntime.exclusiveGroupChoices = runtimeSaveCloneValue(state?.objectives?.exclusive_group_choices || {});
    app.objectiveRuntime.suggestions = runtimeSaveCloneValue(state?.objectives?.suggestions || []);
    app.objectiveRuntime.completionMessage = String(state?.objectives?.completion_message || "");
    app.objectiveRuntime.completedMainMessage = String(state?.objectives?.completed_main_message || "");
    app.objectiveRuntime.pendingCompletionMessage = runtimeSaveCloneValue(state?.objectives?.pending_completion_message || null);
    markRuntimeRecordDirty("objective-runtime", "current");
    bumpDomainRevision("objectives");
  }
  function registerObjectiveRuntimeEntries(objectives = [], state = app.state) {
    if (state !== app.state) return false;
    app.objectiveRuntimeLookup = null;
    for (const objective of objectives) syncSparseObjectiveRuntimeEntry(objective, state, {
      markDirty: false,
      bumpRevision: false
    });
    syncSparseObjectiveRuntimeControls(state, {
      markDirty: false,
      bumpRevision: false
    });
    markRuntimeRecordDirty("objective-runtime", "current");
    bumpDomainRevision("objectives");
    return true;
  }
  function removeObjectiveRuntimeEntries(objectiveIds = [], state = app.state) {
    if (state !== app.state) return false;
    for (const id of objectiveIds) clearSparseObjectiveRuntimeEntry(id);
    app.objectiveRuntimeLookup = null;
    syncSparseObjectiveRuntimeControls(state, {
      markDirty: false,
      bumpRevision: false
    });
    markRuntimeRecordDirty("objective-runtime", "current");
    bumpDomainRevision("objectives");
    return true;
  }
  function runtimeDefinitionRecordValue(recordId = "") {
    const [type, id] = String(recordId || "").split(":", 2);
    if (type === "job") return clone(app.runtimeDefinitions.jobsById[id]);
    if (type === "character") return clone(app.runtimeDefinitions.charactersById[id]);
    if (type === "location") return clone(app.runtimeDefinitions.locationsById[id]);
    return null;
  }
  function mutationOwnerKey(owner = {}) {
    return runtimeDirtyKey(owner.kind, owner.recordId);
  }
  function beginDomainMutation(name = "mutation", expectedOwners = [], details = {}) {
    const observation = {
      id: app.mutationObservation.nextId++,
      name: String(name || "mutation"),
      expectedOwners: new Set(expectedOwners.map(mutationOwnerKey)),
      beforeDirty: new Set(runtimeAggregateDirtyTracker.records.keys()),
      details: clone(details || {}),
      mutationRevision: runtimeSaveMutationTracker.revision,
      operationLengths: Object.fromEntries(Object.entries(runtimeSaveMutationTracker.operations).map(([kind, operations]) => [kind, operations.length])),
      startedAt: perfNow()
    };
    app.mutationObservation.active.push(observation);
    return observation;
  }
  function finishDomainMutation(observation, error = null) {
    if (!observation) return;
    const index = app.mutationObservation.active.indexOf(observation);
    if (index >= 0) app.mutationObservation.active.splice(index, 1);
    const after = new Set(runtimeAggregateDirtyTracker.records.keys());
    const observedOwners = [...after].filter(key => !observation.beforeDirty.has(key));
    const missing = [...observation.expectedOwners].filter(key => !after.has(key));
    const unexpected = observedOwners.filter(key => observation.expectedOwners.size && !observation.expectedOwners.has(key));
    const proxyObservedOwners = new Set();
    for (const [kind, operations] of Object.entries(runtimeSaveMutationTracker.operations)) {
      const startIndex = Number(observation.operationLengths?.[kind]) || 0;
      for (const operation of operations.slice(startIndex)) {
        if (kind === "state") {
          for (const owner of stateRecordOwnersForPath(operation.path || [])) {
            if (owner.kind !== "*") proxyObservedOwners.add(mutationOwnerKey(owner));
          }
        } else if (["messages", "snapshots", "images"].includes(kind)) {
          proxyObservedOwners.add(`${kind}*`);
        }
      }
    }
    const unmatchedProxyOwners = [...proxyObservedOwners].filter(key => {
      if (observation.expectedOwners.has(key)) return false;
      const [kind] = key.split("", 1);
      return !observation.expectedOwners.has(`${kind}*`);
    });
    const result = {
      ...observation,
      expectedOwners: [...observation.expectedOwners],
      beforeDirty: [...observation.beforeDirty],
      observedOwners,
      proxyObservedOwners: [...proxyObservedOwners],
      missing,
      unexpected,
      unmatchedProxyOwners,
      elapsedMs: Math.round(perfNow() - observation.startedAt),
      error: error ? String(error?.message || error) : ""
    };
    app.mutationObservation.completed.push(result);
    if (app.mutationObservation.completed.length > 500) app.mutationObservation.completed.splice(0, app.mutationObservation.completed.length - 500);
    if (error || missing.length || unexpected.length || unmatchedProxyOwners.length) {
      app.mutationObservation.failures.push(result);
      if (unmatchedProxyOwners.length) app.performanceMetrics.directMutationBypassCount += unmatchedProxyOwners.length;
    }
  }
  function runDomainMutation(name, expectedOwners, action, details = {}) {
    const observation = beginDomainMutation(name, expectedOwners, details);
    try {
      const result = action();
      finishDomainMutation(observation);
      return result;
    } catch (error) {
      finishDomainMutation(observation, error);
      throw error;
    }
  }
  function bumpDomainRevision(domain = "state") {
    const key = String(domain || "state");
    app.domainRevisions[key] = Number(app.domainRevisions[key] || 0) + 1;
    return app.domainRevisions[key];
  }
  function updateCharacterRuntime(characterId = "", updater = () => {}) {
    const id = String(characterId || "");
    const entry = Object.entries(app.state?.characters || {}).find(([name, character]) => name === id || String(character?.id || "") === id);
    if (!entry) throw new Error(`Unknown runtime character: ${id}`);
    const [name, character] = entry;
    return runDomainMutation("updateCharacterRuntime", [{
      kind: "character",
      recordId: name
    }], () => {
      const result = updater(character);
      markRuntimeRecordDirty("character", name);
      bumpDomainRevision("characters");
      runtimeRenderMutationRoots.add("characters");
      return result;
    }, {
      characterId: id
    });
  }
  function updateObjectiveRuntime(objectiveId = "", updater = () => {}) {
    const id = String(objectiveId || "");
    return runDomainMutation("updateObjectiveRuntime", [{
      kind: "objective-runtime",
      recordId: "current"
    }], () => {
      const result = updater(app.objectiveRuntime, id);
      markRuntimeRecordDirty("objective-runtime", "current");
      bumpDomainRevision("objectives");
      runtimeRenderMutationRoots.add("objectives");
      return result;
    }, {
      objectiveId: id
    });
  }
  function updateRewardRuntime(updater = () => {}, invocationId = "") {
    return runDomainMutation("updateRewardRuntime", [{
      kind: "reward-runtime",
      recordId: "current"
    }], () => {
      const result = updater(app.rewardRuntime);
      markRuntimeRecordDirty("reward-runtime", "current");
      bumpDomainRevision("rewards");
      return result;
    }, {
      invocationId
    });
  }
  function updateStoryRulesRuntime(updater = () => {}) {
    return runDomainMutation("updateStoryRulesRuntime", [{
      kind: "story-rules-runtime",
      recordId: "current"
    }], () => {
      const result = updater(app.storyRulesRuntime);
      app.state.story_rules = effectiveStoryRules();
      markRuntimeRecordDirty("story-rules-runtime", "current");
      bumpDomainRevision("story-rules");
      runtimeRenderMutationRoots.add("story_rules");
      return result;
    });
  }
  function updateStateRuntimeRecord(kind = "state-root", recordId = "current", updater = () => {}) {
    return runDomainMutation(`update:${kind}`, [{
      kind,
      recordId
    }], () => {
      const result = updater();
      markRuntimeRecordDirty(kind, recordId);
      bumpDomainRevision(kind);
      return result;
    });
  }
  function updatePlayerRuntime(updater = () => {}) {
    return runDomainMutation("updatePlayerRuntime", [{
      kind: "player",
      recordId: "current"
    }], () => {
      const result = updater(app.state.player);
      markRuntimeRecordDirty("player", "current");
      bumpDomainRevision("player");
      runtimeRenderMutationRoots.add("player");
      return result;
    });
  }
  function updateSceneRuntime(updater = () => {}) {
    return runDomainMutation("updateSceneRuntime", [{
      kind: "scene",
      recordId: "current"
    }], () => {
      const result = updater(app.state.scene);
      markRuntimeRecordDirty("scene", "current");
      bumpDomainRevision("scene");
      runtimeRenderMutationRoots.add("scene");
      return result;
    });
  }
  function updateJobRuntime(updater = () => {}, jobId = "") {
    return runDomainMutation("updateJobRuntime", [{
      kind: "job-runtime",
      recordId: "current"
    }], () => {
      const result = updater(app.jobRuntime, String(jobId || ""));
      markRuntimeRecordDirty("job-runtime", "current");
      bumpDomainRevision("jobs");
      return result;
    }, {
      jobId
    });
  }
  function updateWorldRuntime(updater = () => {}) {
    return runDomainMutation("updateWorldRuntime", [{
      kind: "world-runtime",
      recordId: "current"
    }, {
      kind: "world-map",
      recordId: "current"
    }, {
      kind: "location-runtime",
      recordId: "current"
    }], () => {
      const result = updater(app.state);
      markRuntimeRecordDirty("world-runtime", "current");
      markRuntimeRecordDirty("world-map", "current");
      markRuntimeRecordDirty("location-runtime", "current");
      bumpDomainRevision("world");
      runtimeRenderMutationRoots.add("world_map");
      runtimeRenderMutationRoots.add("location");
      return result;
    });
  }
  function updateInventoryRuntime(updater = () => {}) {
    return runDomainMutation("updateInventoryRuntime", [{
      kind: "inventory",
      recordId: "current"
    }], () => {
      const result = updater(app.state.story_inventory);
      markRuntimeRecordDirty("inventory", "current");
      bumpDomainRevision("inventory");
      runtimeRenderMutationRoots.add("story_inventory");
      return result;
    });
  }
  function updateTimedEventRuntime(eventId = "", updater = () => {}) {
    const id = String(eventId || "");
    return runDomainMutation("updateTimedEventRuntime", [{
      kind: "timed-event",
      recordId: id
    }], () => {
      const event = app.state.timed_events?.[id];
      if (!event) throw new Error(`Unknown timed event: ${id}`);
      const result = updater(event);
      markRuntimeRecordDirty("timed-event", id);
      bumpDomainRevision("timed-events");
      return result;
    }, {
      eventId: id
    });
  }
  function updateShopRuntime(shopId = "", updater = () => {}) {
    const id = String(shopId || "");
    return runDomainMutation("updateShopRuntime", [{
      kind: "shop",
      recordId: id
    }], () => {
      const shop = app.state.story_shops?.[id];
      if (!shop) throw new Error(`Unknown story shop: ${id}`);
      const result = updater(shop);
      markRuntimeRecordDirty("shop", id);
      bumpDomainRevision("shops");
      return result;
    }, {
      shopId: id
    });
  }
  function updateNpcDirectoryRuntime(updater = () => {}, name = "") {
    const result = updater(app.state.npc_directory);
    markRuntimeRecordDirty("npc-directory", "current");
    const target = findNpcEntryInState(app.state, name);
    if (target) markRuntimeRecordDirty("npc", runtimeNpcRecordId(target.locationId, target.key));
    bumpDomainRevision("npc-directory");
    runtimeRenderMutationRoots.add("npc_directory");
    return result;
  }
  function updateTempSpeakerRuntime(updater = () => {}, name = "") {
    return runDomainMutation("updateTempSpeakerRuntime", [{
      kind: "temp-speakers",
      recordId: "current"
    }], () => {
      const result = updater(app.state.temp_speakers);
      markRuntimeRecordDirty("temp-speakers", "current");
      bumpDomainRevision("temp-speakers");
      return result;
    }, {
      name
    });
  }
  
