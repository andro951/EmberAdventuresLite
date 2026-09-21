(() => {
  const root = window.root || window;
  const EMBERADVENTURES_BUILD = Object.freeze({
    buildId: String(globalThis.__EMBER_ADVENTURES_BUILD__?.buildId || "unknown"),
    sourceHash: String(globalThis.__EMBER_ADVENTURES_BUILD__?.sourceHash || "unknown"),
    privateTests: globalThis.__EMBER_ADVENTURES_BUILD__?.privateTests === true
  });
  function emberAdventuresBuildInfo() {
    return {
      ...EMBERADVENTURES_BUILD
    };
  }
  const earlyPerchancePluginFrameError = (message = "") => /contentWindow|streamTextFromIframe|startStreamingResponse|iframe was not ready|iframe.*removed|aiTextPlugin|textToImagePlugin/i.test(String(message || ""));
  const suppressEarlyPerchancePluginFrameError = (event, rawMessage = "") => {
    const message = String(rawMessage || "");
    if (!earlyPerchancePluginFrameError(message)) return false;
    // Perchance's ai-text-plugin can throw an internal iframe startup
    // rejection even when the awaited request succeeds or retries. This
    // must be installed before app init so Perchance's own code-error
    // banner does not show for the known plugin-frame race.
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    return true;
  };
  if (!root.__emberAdventuresEarlyPluginFrameSuppressorBound) {
    root.__emberAdventuresEarlyPluginFrameSuppressorBound = true;
    const previousUnhandled = root.onunhandledrejection;
    const previousError = root.onerror;
    const handleEarlyUnhandledRejection = event => {
      suppressEarlyPerchancePluginFrameError(event, event?.reason?.message || String(event?.reason || ""));
    };
    const handleEarlyError = event => {
      suppressEarlyPerchancePluginFrameError(event, event?.message || event?.error?.message || "");
    };
    root.addEventListener?.("unhandledrejection", handleEarlyUnhandledRejection, true);
    root.addEventListener?.("error", handleEarlyError, true);
    root.onunhandledrejection = event => {
      if (suppressEarlyPerchancePluginFrameError(event, event?.reason?.message || String(event?.reason || ""))) return true;
      return typeof previousUnhandled === "function" ? previousUnhandled.call(root, event) : undefined;
    };
    root.onerror = (message, source, lineno, colno, error) => {
      if (earlyPerchancePluginFrameError(error?.message || String(message || ""))) return true;
      return typeof previousError === "function" ? previousError.call(root, message, source, lineno, colno, error) : undefined;
    };
  }
  const SETTINGS_KEY = "emberadventures-lite-settings-v2",
    STATE_SYNC_CHECKPOINT_KEY = "emberadventures-lite-state-sync-checkpoint",
    WORLD_GENERATION_CHECKPOINT_KEY = "emberadventures-lite-world-generation-checkpoint",
    STORY_TEMPLATE_KEY = "emberadventures-lite-story-templates",
    STORY_TITLE_CARD_IMAGE_KEY = "emberadventures-lite-story-title-card-images",
    CHARACTER_LIBRARY_KEY = "emberadventures-lite-character-library",
    PROFILE_IMAGE_KEY = "emberadventures-lite-profile-images",
    USER_PROFILE_KEY = "emberadventures-lite-user-profiles",
    CREATOR_IDENTITY_KEY = "emberadventures-lite-creator-identities";
  const ACTIVE_SAVE_KEY = "active/current";
  const SAVE_INDEX_ALL_KEY = "save/all";
  function emberAdventuresPersistenceWorkerMain() {
    "use strict";

    const DATABASE_NAME = "emberadventures-lite-data";
    const DATABASE_VERSION = 3;
    const KV_STORE = "kv";
    const LIBRARY_RECORD_STORE = "library_records";
    const SAVE_HEADER_STORE = "save_headers";
    const SAVE_RECORD_STORE = "save_records";
    const SAVE_MESSAGE_STORE = "save_messages";
    const SAVE_SNAPSHOT_STORE = "save_snapshots";
    const IMAGE_RECORD_STORE = "image_records";
    const STORY_DEFINITION_STORE = "story_definitions";
    const DEV_TRACE_STORE = "dev_trace_chunks";
    const LEGACY_DATABASE_NAMES = [];
    let database = null;
    let databasePromise = null;
    let savePumpRunning = false;
    const pendingSaveBatches = new Map();
    let devTraceWriteChain = Promise.resolve();
    let devTraceGeneration = 0;
    function requestResult(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
      });
    }
    function transactionFinished(transaction) {
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
      });
    }
    function ensureIndex(store, name, keyPath, options = {
      unique: false
    }) {
      if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
    }
    function ensureLibraryRecordIndexes(store) {
      ensureIndex(store, "type", "type");
      ensureIndex(store, "id", "id");
      ensureIndex(store, "updated_at", "updated_at");
    }
    function ensureSaveOwnedIndexes(store) {
      ensureIndex(store, "saveId", "saveId");
    }
    function openDatabase() {
      if (database) return Promise.resolve(database);
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
          let libraryStore;
          if (!db.objectStoreNames.contains(LIBRARY_RECORD_STORE)) {
            libraryStore = db.createObjectStore(LIBRARY_RECORD_STORE, {
              keyPath: "key"
            });
          } else {
            libraryStore = request.transaction.objectStore(LIBRARY_RECORD_STORE);
          }
          ensureLibraryRecordIndexes(libraryStore);
          let headerStore;
          if (!db.objectStoreNames.contains(SAVE_HEADER_STORE)) {
            headerStore = db.createObjectStore(SAVE_HEADER_STORE, {
              keyPath: "saveId"
            });
          } else {
            headerStore = request.transaction.objectStore(SAVE_HEADER_STORE);
          }
          ensureIndex(headerStore, "updatedAt", "updatedAt");
          ensureIndex(headerStore, "definitionRevisionId", "definitionRevisionId");
          let recordStore;
          if (!db.objectStoreNames.contains(SAVE_RECORD_STORE)) {
            recordStore = db.createObjectStore(SAVE_RECORD_STORE, {
              keyPath: ["saveId", "kind", "recordId"]
            });
          } else {
            recordStore = request.transaction.objectStore(SAVE_RECORD_STORE);
          }
          ensureSaveOwnedIndexes(recordStore);
          ensureIndex(recordStore, "saveKind", ["saveId", "kind"]);
          let messageStore;
          if (!db.objectStoreNames.contains(SAVE_MESSAGE_STORE)) {
            messageStore = db.createObjectStore(SAVE_MESSAGE_STORE, {
              keyPath: ["saveId", "messageId"]
            });
          } else {
            messageStore = request.transaction.objectStore(SAVE_MESSAGE_STORE);
          }
          ensureSaveOwnedIndexes(messageStore);
          ensureIndex(messageStore, "saveSequence", ["saveId", "sequence"]);
          let snapshotStore;
          if (!db.objectStoreNames.contains(SAVE_SNAPSHOT_STORE)) {
            snapshotStore = db.createObjectStore(SAVE_SNAPSHOT_STORE, {
              keyPath: ["saveId", "snapshotId"]
            });
          } else {
            snapshotStore = request.transaction.objectStore(SAVE_SNAPSHOT_STORE);
          }
          ensureSaveOwnedIndexes(snapshotStore);
          ensureIndex(snapshotStore, "saveCreatedAt", ["saveId", "createdAt"]);
          let imageStore;
          if (!db.objectStoreNames.contains(IMAGE_RECORD_STORE)) {
            imageStore = db.createObjectStore(IMAGE_RECORD_STORE, {
              keyPath: ["ownerType", "imageId"]
            });
          } else {
            imageStore = request.transaction.objectStore(IMAGE_RECORD_STORE);
          }
          ensureIndex(imageStore, "ownerType", "ownerType");
          ensureIndex(imageStore, "saveId", "saveId");
          let definitionStore;
          if (!db.objectStoreNames.contains(STORY_DEFINITION_STORE)) {
            definitionStore = db.createObjectStore(STORY_DEFINITION_STORE, {
              keyPath: "revisionId"
            });
          } else {
            definitionStore = request.transaction.objectStore(STORY_DEFINITION_STORE);
          }
          ensureIndex(definitionStore, "storyId", "storyId");
          ensureIndex(definitionStore, "contentHash", "contentHash");
          if (!db.objectStoreNames.contains(DEV_TRACE_STORE)) {
            db.createObjectStore(DEV_TRACE_STORE, {
              keyPath: "chunkId",
              autoIncrement: true
            });
          }
        };
        request.onsuccess = () => {
          database = request.result;
          database.onversionchange = () => {
            database.close();
            database = null;
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          databasePromise = null;
          reject(request.error || new Error("IndexedDB open failed."));
        };
        request.onblocked = () => {
          databasePromise = null;
          reject(new Error("IndexedDB open was blocked by another EmberAdventures page."));
        };
      });
      return databasePromise;
    }
    async function kvGet(key) {
      const db = await openDatabase();
      const transaction = db.transaction(KV_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const value = await requestResult(transaction.objectStore(KV_STORE).get(key));
      await finished;
      return value;
    }
    async function kvSet(key, value) {
      const db = await openDatabase();
      const transaction = db.transaction(KV_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      transaction.objectStore(KV_STORE).put(value, key);
      await finished;
      return true;
    }
    async function kvDelete(key) {
      const db = await openDatabase();
      const transaction = db.transaction(KV_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      transaction.objectStore(KV_STORE).delete(key);
      await finished;
      return true;
    }
    async function kvKeys() {
      const db = await openDatabase();
      const transaction = db.transaction(KV_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const keys = await requestResult(transaction.objectStore(KV_STORE).getAllKeys());
      await finished;
      return keys;
    }
    function queueDevTraceStoreWork(work) {
      const generation = devTraceGeneration;
      const run = () => generation === devTraceGeneration ? work() : {
        cancelled: true
      };
      const next = devTraceWriteChain.then(run, run);
      devTraceWriteChain = next.catch(() => {});
      return next;
    }
    async function appendDevTraceChunk(entries = []) {
      const chunk = Array.isArray(entries) ? entries : [];
      if (!chunk.length) return {
        appended: 0
      };
      const db = await openDatabase();
      const transaction = db.transaction(DEV_TRACE_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      transaction.objectStore(DEV_TRACE_STORE).add({
        at: new Date().toISOString(),
        entries: structuredClone(chunk)
      });
      await finished;
      return {
        appended: chunk.length
      };
    }
    async function resetDevTraceArchive() {
      const db = await openDatabase();
      const transaction = db.transaction(DEV_TRACE_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      transaction.objectStore(DEV_TRACE_STORE).clear();
      await finished;
      return true;
    }
    async function devTraceArchiveChunks() {
      const db = await openDatabase();
      const transaction = db.transaction(DEV_TRACE_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const chunks = await requestResult(transaction.objectStore(DEV_TRACE_STORE).getAll());
      await finished;
      return chunks;
    }
    async function devTraceArchiveEntries() {
      const chunks = await devTraceArchiveChunks();
      return chunks.flatMap(chunk => Array.isArray(chunk?.entries) ? chunk.entries : []);
    }
    function workerDevTraceTextValue(value) {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          return JSON.parse(trimmed);
        } catch {}
      }
      return value.replace(/\\n/g, "\n");
    }
    function workerIndentDevTraceText(text, spaces = 2) {
      const pad = " ".repeat(spaces);
      return String(text || "").split("\n").map(line => `${pad}${line}`).join("\n");
    }
    function workerFormatDevTraceValue(value, level = 1) {
      const prepared = workerDevTraceTextValue(value);
      const indent = " ".repeat(level * 2);
      if (prepared == null) return `${indent}${String(prepared)}`;
      if (typeof prepared === "string") return workerIndentDevTraceText(prepared, level * 2);
      if (typeof prepared === "number" || typeof prepared === "boolean") return `${indent}${String(prepared)}`;
      if (Array.isArray(prepared)) {
        if (!prepared.length) return `${indent}[]`;
        return prepared.map(item => {
          const normalized = workerDevTraceTextValue(item);
          if (normalized == null || typeof normalized === "string" || typeof normalized === "number" || typeof normalized === "boolean") {
            const line = workerFormatDevTraceValue(normalized, 0).trimEnd();
            return `${indent}- ${line.trimStart()}`;
          }
          return `${indent}-\n${workerFormatDevTraceValue(normalized, level + 1)}`;
        }).join("\n");
      }
      if (typeof prepared === "object") {
        const entries = Object.entries(prepared);
        if (!entries.length) return `${indent}{}`;
        return entries.map(([key, item]) => {
          const normalized = workerDevTraceTextValue(item);
          if (normalized == null || typeof normalized === "number" || typeof normalized === "boolean" || typeof normalized === "string" && !normalized.includes("\n")) return `${indent}${key}: ${String(normalized)}`;
          return `${indent}${key}:\n${workerFormatDevTraceValue(normalized, level + 1)}`;
        }).join("\n");
      }
      return `${indent}${String(prepared)}`;
    }
    function workerExactDevTraceCopyBlock(kind = "TEXT", text = "", entry = {}) {
      const safeKind = String(kind || "TEXT").replace(/[^A-Z0-9_-]/gi, "_").toUpperCase();
      const meta = [entry.id != null ? `id=${entry.id}` : "", entry.promptFingerprint ? `fingerprint=${entry.promptFingerprint}` : ""].filter(Boolean);
      return [`<<<EMBERADVENTURES_${safeKind}_EXACT_COPY_START${meta.length ? ` ${meta.join(" ")}` : ""}>>>`, String(text || ""), `<<<EMBERADVENTURES_${safeKind}_EXACT_COPY_END>>>`].join("\n");
    }
    function workerFormatDevTraceEntry(entry = {}, index = 0) {
      const title = entry.title || entry.type || "Dev Log Entry";
      const meta = [entry.id != null ? `id=${entry.id}` : "", entry.at || "", entry.logType ? `type=${entry.logType}` : "", entry.logLevel ? `level=${entry.logLevel}` : ""].filter(Boolean);
      const skip = new Set(["id", "at", "title", "type", "logType", "logLevel"]);
      if (entry.detail && entry.text) skip.add("text");
      const exactBlocks = [];
      if (title === "AI prompt" && typeof entry.prompt === "string") {
        skip.add("prompt");
        exactBlocks.push(["prompt:", workerExactDevTraceCopyBlock("PROMPT", entry.prompt, entry)].join("\n"));
      }
      const body = [...exactBlocks, ...Object.entries(entry).filter(([key]) => !skip.has(key)).map(([key, value]) => {
        const normalized = workerDevTraceTextValue(value);
        if (normalized == null || typeof normalized === "number" || typeof normalized === "boolean" || typeof normalized === "string" && !normalized.includes("\n")) return `${key}: ${String(normalized)}`;
        return `${key}:\n${workerFormatDevTraceValue(normalized, 1)}`;
      })].join("\n\n");
      return [`===== #${entry.id ?? index + 1} ${title} =====`, meta.length ? meta.join(" | ") : "", body].filter(Boolean).join("\n");
    }
    async function buildDevTraceArchiveExport(exportedAt = "", asBlob = false) {
      const chunks = await devTraceArchiveChunks();
      let entryCount = 0;
      const sections = ["EmberAdventures Dev Log", `Exported: ${exportedAt || new Date().toISOString()}`, ""];
      for (const chunk of chunks) {
        for (const entry of Array.isArray(chunk?.entries) ? chunk.entries : []) {
          sections.push(workerFormatDevTraceEntry(entry, entryCount));
          sections.push("");
          entryCount += 1;
        }
      }
      if (!entryCount) sections.push("(Dev Log is empty.)");
      const text = sections.join("\n");
      return {
        blob: asBlob ? new Blob([text], {
          type: "text/plain"
        }) : null,
        text: asBlob ? "" : text,
        entryCount,
        chunkCount: chunks.length
      };
    }
    async function devTraceArchiveStats() {
      const chunks = await devTraceArchiveChunks();
      return {
        chunkCount: chunks.length,
        entryCount: chunks.reduce((total, chunk) => total + (Array.isArray(chunk?.entries) ? chunk.entries.length : 0), 0)
      };
    }
    async function recordRowsByType(type) {
      const db = await openDatabase();
      const transaction = db.transaction(LIBRARY_RECORD_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const rows = await requestResult(transaction.objectStore(LIBRARY_RECORD_STORE).index("type").getAll(type));
      await finished;
      return rows;
    }
    async function replaceRecordType(type, rows) {
      const db = await openDatabase();
      const transaction = db.transaction(LIBRARY_RECORD_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      const store = transaction.objectStore(LIBRARY_RECORD_STORE);
      const existingKeys = await requestResult(store.index("type").getAllKeys(type));
      const wantedKeys = new Set(rows.map(row => row.key));
      for (const key of existingKeys) if (!wantedKeys.has(key)) store.delete(key);
      for (const row of rows) store.put(row);
      await finished;
      return true;
    }
    async function putRecordRows(rows) {
      if (!rows.length) return true;
      const db = await openDatabase();
      const transaction = db.transaction(LIBRARY_RECORD_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      const store = transaction.objectStore(LIBRARY_RECORD_STORE);
      for (const row of rows) store.put(row);
      await finished;
      return true;
    }
    async function deleteRecordRows(keys) {
      if (!keys.length) return true;
      const db = await openDatabase();
      const transaction = db.transaction(LIBRARY_RECORD_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      const store = transaction.objectStore(LIBRARY_RECORD_STORE);
      for (const key of keys) store.delete(key);
      await finished;
      return true;
    }
    function imageSourceFromRecord(record) {
      const direct = String(record?.url || "").trim();
      if (direct) return direct;
      const html = String(record?.html || "");
      const match = html.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
      return match?.[2] || "";
    }
    async function preparedSaveImageRecord(saveId, row = {}) {
      const fields = ["imageId", "ownerType", "value"];
      if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Image record must be an object.");
      for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`Image record field ${key} is not allowed.`);
      for (const key of fields) if (!Object.hasOwn(row, key)) throw new Error(`Image record.${key} is required.`);
      const {
        imageId,
        ownerType
      } = row;
      if (typeof imageId !== "string" || !imageId) throw new Error("Image record.imageId must be non-empty text.");
      if (typeof ownerType !== "string" || !ownerType) throw new Error("Image record.ownerType must be non-empty text.");
      if (!row.value || Object.getPrototypeOf(row.value) !== Object.prototype) throw new Error("Image record.value must be an object.");
      const value = structuredClone(row.value);
      let blob = null;
      const source = imageSourceFromRecord(value);
      if (!blob && /^(?:data:image\/|blob:)/i.test(source)) {
        const response = await fetch(source);
        blob = await response.blob();
      }
      if (blob) {
        value.html = "";
        value.url = "";
      }
      return {
        ownerType,
        imageId,
        saveId,
        value,
        blob
      };
    }
    function structuredProfileImageIds(value, out = new Set(), seen = new WeakSet()) {
      if (!value || typeof value !== "object" || seen.has(value)) return out;
      seen.add(value);
      if (Array.isArray(value)) {
        for (const item of value) structuredProfileImageIds(item, out, seen);
        return out;
      }
      const activeId = String(value.profile_image_id || "").trim();
      if (activeId) out.add(activeId);
      for (const key of ["profile_images", "profile_images_list"]) {
        for (const image of Array.isArray(value[key]) ? value[key] : []) {
          const id = String(image?.id || "").trim();
          if (id) out.add(id);
        }
      }
      const defaultLocalId = String(value.default_profile_image?.local_image_id || "").trim();
      if (defaultLocalId) out.add(defaultLocalId);
      for (const child of Object.values(value)) structuredProfileImageIds(child, out, seen);
      return out;
    }
    function bytesToBase64(bytes) {
      let binary = "";
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, Math.min(bytes.length, index + chunkSize)));
      }
      return btoa(binary);
    }
    async function portableImageValue(value = {}, blob = null) {
      const portable = structuredClone(value || {});
      if (blob instanceof Blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const dataUrl = `data:${blob.type || "image/png"};base64,${bytesToBase64(bytes)}`;
        portable.url = dataUrl;
        portable.html = `<img loading="lazy" decoding="async" src="${dataUrl}">`;
      }
      return portable;
    }
    function libraryStorageInfo(key = "", record = {}) {
      const sourceKey = String(key || "");
      let type = "";
      let id = "";
      if (sourceKey === "emberadventures-lite-story-templates") {
        type = "story";
        id = String(record.id || record.title || "").trim();
      } else if (sourceKey === "emberadventures-lite-story-title-card-images") {
        type = "story-title-image";
        id = [String(record.story_key || record.story_id || record.story_title || "").trim(), String(record.id || "").trim()].filter(Boolean).join("|");
      } else if (sourceKey === "emberadventures-lite-character-library") {
        type = "character";
        id = String(record.id || record.name || "").trim();
      } else if (sourceKey === "emberadventures-lite-profile-images") {
        type = "profile-image";
        id = String(record.id || "").trim();
      }
      return type && id ? {
        type,
        id
      } : null;
    }
    async function libraryRowsForStorage(key = "", records = []) {
      const now = new Date().toISOString();
      const rows = [];
      for (const record of Array.isArray(records) ? records : []) {
        const info = libraryStorageInfo(key, record);
        if (!info) continue;
        const value = structuredClone(record);
        let blob = null;
        if (info.type === "character" && value.character?.default_profile_image) {
          const slot = value.character.default_profile_image;
          const localSrc = imageSourceFromRecord(slot);
          if (slot.local_image_id && /^(?:data:image\/|blob:)/i.test(localSrc)) {
            slot.html = "";
            slot.url = "";
          }
        }
        if (info.type === "story-title-image" || info.type === "profile-image") {
          const source = imageSourceFromRecord(value);
          if (/^(?:data:image\/|blob:)/i.test(source)) {
            const response = await fetch(source);
            blob = await response.blob();
            value.html = "";
            value.url = "";
          }
        }
        rows.push({
          key: `${info.type}|${info.id}`,
          type: info.type,
          id: info.id,
          updated_at: now,
          value,
          blob
        });
      }
      return rows;
    }
    function exactWorkerSaveRecord(row = {}) {
      const fields = ["saveId", "kind", "recordId", "value"];
      if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Save record must be an object.");
      for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`Save record field ${key} is not allowed.`);
      for (const key of fields) if (!Object.hasOwn(row, key)) throw new Error(`Save record.${key} is required.`);
      for (const key of ["saveId", "kind", "recordId"]) if (typeof row[key] !== "string" || !row[key]) throw new Error(`Save record.${key} must be non-empty text.`);
      return row;
    }
    function stableWorkerValue(value) {
      if (Array.isArray(value)) return value.map(stableWorkerValue);
      if (!value || typeof value !== "object") return value;
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = stableWorkerValue(value[key]);
      return out;
    }
    function stableWorkerString(value) {
      return JSON.stringify(stableWorkerValue(value));
    }
    function exactWorkerMessageRecord(saveId, row = {}) {
      const fields = ["messageId", "sequence", "value"];
      if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Message record must be an object.");
      for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`Message record field ${key} is not allowed.`);
      for (const key of fields) if (!Object.hasOwn(row, key)) throw new Error(`Message record.${key} is required.`);
      if (typeof saveId !== "string" || !saveId) throw new Error("Message record saveId must be non-empty text.");
      if (typeof row.messageId !== "string" || !row.messageId) throw new Error("Message record.messageId must be non-empty text.");
      if (!Number.isSafeInteger(row.sequence) || row.sequence <= 0) throw new Error("Message record.sequence must be a positive safe integer.");
      if (!row.value || Object.getPrototypeOf(row.value) !== Object.prototype) throw new Error("Message record.value must be an object.");
      return {
        saveId,
        ...row
      };
    }
    function exactWorkerSnapshotRecord(saveId, row = {}) {
      const fields = ["snapshotId", "createdAt", "value"];
      if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Snapshot record must be an object.");
      for (const key of Object.keys(row)) if (!fields.includes(key)) throw new Error(`Snapshot record field ${key} is not allowed.`);
      for (const key of fields) if (!Object.hasOwn(row, key)) throw new Error(`Snapshot record.${key} is required.`);
      if (typeof saveId !== "string" || !saveId) throw new Error("Snapshot record saveId must be non-empty text.");
      for (const key of ["snapshotId", "createdAt"]) if (typeof row[key] !== "string" || !row[key]) throw new Error(`Snapshot record.${key} must be non-empty text.`);
      if (!row.value || Object.getPrototypeOf(row.value) !== Object.prototype) throw new Error("Snapshot record.value must be an object.");
      return {
        saveId,
        ...row
      };
    }
    async function writeSaveBatch(payload = {}) {
      const workerStartedAt = performance.now();
      const fields = ["saveId", "revision", "baseRevision", "header", "records", "recordDeletes", "messages", "messageDeletes", "snapshots", "snapshotDeletes", "images", "imageDeletes"];
      if (!payload || Object.getPrototypeOf(payload) !== Object.prototype) throw new Error("Save batch must be an object.");
      for (const key of Object.keys(payload)) if (!fields.includes(key)) throw new Error(`Save batch field ${key} is not allowed.`);
      for (const key of fields) if (!Object.hasOwn(payload, key)) throw new Error(`Save batch.${key} is required.`);
      const saveId = payload.saveId;
      if (typeof saveId !== "string" || !saveId) throw new Error("Save batch.saveId must be non-empty text.");
      const revision = payload.revision;
      const expectedBaseRevision = payload.baseRevision;
      if (!Number.isSafeInteger(expectedBaseRevision) || expectedBaseRevision < 0) throw new Error("Save batch.baseRevision must be a non-negative safe integer.");
      if (!Number.isInteger(revision) || revision <= expectedBaseRevision) throw new Error(`Save batch revision must be an integer greater than base revision ${expectedBaseRevision}.`);
      const preparedImages = [];
      for (const key of ["records", "recordDeletes", "messages", "messageDeletes", "snapshots", "snapshotDeletes", "images", "imageDeletes"]) if (!Array.isArray(payload[key])) throw new Error(`Save batch.${key} must be an array.`);
      if (!payload.header || Object.getPrototypeOf(payload.header) !== Object.prototype) throw new Error("Save batch.header must be an object.");
      for (const row of payload.images) preparedImages.push(await preparedSaveImageRecord(saveId, row));
      const stores = [SAVE_HEADER_STORE, SAVE_RECORD_STORE, SAVE_MESSAGE_STORE, SAVE_SNAPSHOT_STORE, IMAGE_RECORD_STORE];
      const db = await openDatabase();
      const transaction = db.transaction(stores, "readwrite");
      const finished = transactionFinished(transaction);
      const headerStore = transaction.objectStore(SAVE_HEADER_STORE);
      const existingHeader = await requestResult(headerStore.get(saveId));
      const durableRevision = Number(existingHeader?.durableRevision) || 0;
      if (existingHeader && durableRevision !== expectedBaseRevision || !existingHeader && expectedBaseRevision !== 0) {
        transaction.abort();
        throw new Error(`Save revision mismatch for ${saveId}: expected ${expectedBaseRevision}, found ${durableRevision}.`);
      }
      const recordStore = transaction.objectStore(SAVE_RECORD_STORE);
      for (const row of payload.records) {
        const exact = exactWorkerSaveRecord({
          ...row,
          saveId
        });
        if (exact.kind === "runtime-definition") {
          const existing = await requestResult(recordStore.get([saveId, exact.kind, exact.recordId]));
          if (existing) {
            if (stableWorkerString(existing.value) !== stableWorkerString(exact.value)) {
              transaction.abort();
              try {
                await finished;
              } catch {
                // The deliberate abort is reported below.
              }
              throw new Error(`Immutable runtime definition collision for ${exact.recordId}.`);
            }
            continue;
          }
        }
        recordStore.put(exact);
      }
      for (const row of payload.recordDeletes) {
        if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Save record delete must be an object.");
        const keys = Object.keys(row);
        if (keys.length !== 2 || !keys.includes("kind") || !keys.includes("recordId")) throw new Error("Save record delete requires exactly kind and recordId.");
        if (typeof row.kind !== "string" || !row.kind || typeof row.recordId !== "string" || !row.recordId) throw new Error("Save record delete kind and recordId must be non-empty text.");
        recordStore.delete([saveId, row.kind, row.recordId]);
      }
      const messageStore = transaction.objectStore(SAVE_MESSAGE_STORE);
      for (const row of payload.messages) {
        messageStore.put(exactWorkerMessageRecord(saveId, row));
      }
      for (const messageId of payload.messageDeletes) {
        if (typeof messageId !== "string" || !messageId) throw new Error("Message delete id must be non-empty text.");
        messageStore.delete([saveId, messageId]);
      }
      const snapshotStore = transaction.objectStore(SAVE_SNAPSHOT_STORE);
      for (const row of payload.snapshots) {
        snapshotStore.put(exactWorkerSnapshotRecord(saveId, row));
      }
      for (const snapshotId of payload.snapshotDeletes) {
        if (typeof snapshotId !== "string" || !snapshotId) throw new Error("Snapshot delete id must be non-empty text.");
        snapshotStore.delete([saveId, snapshotId]);
      }
      const imageStore = transaction.objectStore(IMAGE_RECORD_STORE);
      for (const row of preparedImages) imageStore.put(row);
      for (const row of payload.imageDeletes) {
        if (!row || Object.getPrototypeOf(row) !== Object.prototype) throw new Error("Image delete must be an object.");
        const keys = Object.keys(row);
        if (keys.length !== 2 || !keys.includes("ownerType") || !keys.includes("imageId")) throw new Error("Image delete requires exactly ownerType and imageId.");
        if (typeof row.ownerType !== "string" || !row.ownerType || typeof row.imageId !== "string" || !row.imageId) throw new Error("Image delete ownerType and imageId must be non-empty text.");
        imageStore.delete([row.ownerType, row.imageId]);
      }
      const now = new Date().toISOString();
      const header = {
        ...(existingHeader || {}),
        ...(payload.header || {}),
        saveId,
        durableRevision: revision,
        updatedAt: payload.header?.updatedAt || now,
        createdAt: existingHeader?.createdAt || payload.header?.createdAt || now
      };
      headerStore.put(header);
      await finished;
      let serializedPayloadBytes = 0;
      try {
        serializedPayloadBytes = JSON.stringify({
          header: payload.header || {},
          records: payload.records || [],
          recordDeletes: payload.recordDeletes || [],
          messages: payload.messages || [],
          messageDeletes: payload.messageDeletes || [],
          snapshots: payload.snapshots || [],
          snapshotDeletes: payload.snapshotDeletes || [],
          images: (payload.images || []).map(row => ({
            imageId: row.imageId,
            ownerType: row.ownerType,
            value: row.value
          })),
          imageDeletes: payload.imageDeletes || []
        }).length;
      } catch {
        serializedPayloadBytes = 0;
      }
      return {
        saveId,
        durableRevision: revision,
        recordCount: Array.isArray(payload.records) ? payload.records.length : 0,
        messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
        snapshotCount: Array.isArray(payload.snapshots) ? payload.snapshots.length : 0,
        imageCount: preparedImages.length,
        serializedPayloadBytes,
        workerMs: Math.max(0, performance.now() - workerStartedAt)
      };
    }
    async function rowsForSave(storeName, saveId) {
      const db = await openDatabase();
      const transaction = db.transaction(storeName, "readonly");
      const finished = transactionFinished(transaction);
      const rows = await requestResult(transaction.objectStore(storeName).index("saveId").getAll(saveId));
      await finished;
      return rows;
    }
    async function loadSave(saveId = "") {
      const id = String(saveId || "").trim();
      if (!id) return null;
      const db = await openDatabase();
      const transaction = db.transaction(SAVE_HEADER_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const header = await requestResult(transaction.objectStore(SAVE_HEADER_STORE).get(id));
      await finished;
      if (!header) return null;
      const [records, messages, snapshots, images] = await Promise.all([rowsForSave(SAVE_RECORD_STORE, id), rowsForSave(SAVE_MESSAGE_STORE, id), rowsForSave(SAVE_SNAPSHOT_STORE, id), rowsForSave(IMAGE_RECORD_STORE, id)]);
      messages.sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
      snapshots.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      return {
        header,
        records,
        messages,
        snapshots,
        images
      };
    }
    async function deleteRowsBySaveId(transaction, storeName, saveId) {
      const store = transaction.objectStore(storeName);
      const keys = await requestResult(store.index("saveId").getAllKeys(saveId));
      for (const key of keys) store.delete(key);
    }
    async function deleteSave(saveId = "") {
      const id = String(saveId || "").trim();
      if (!id) return false;
      const stores = [SAVE_HEADER_STORE, SAVE_RECORD_STORE, SAVE_MESSAGE_STORE, SAVE_SNAPSHOT_STORE, IMAGE_RECORD_STORE];
      const db = await openDatabase();
      const transaction = db.transaction(stores, "readwrite");
      const finished = transactionFinished(transaction);
      transaction.objectStore(SAVE_HEADER_STORE).delete(id);
      await deleteRowsBySaveId(transaction, SAVE_RECORD_STORE, id);
      await deleteRowsBySaveId(transaction, SAVE_MESSAGE_STORE, id);
      await deleteRowsBySaveId(transaction, SAVE_SNAPSHOT_STORE, id);
      await deleteRowsBySaveId(transaction, IMAGE_RECORD_STORE, id);
      await finished;
      return true;
    }
    async function storeStoryDefinition(definition = {}) {
      const revisionId = String(definition.revisionId || "").trim();
      if (!revisionId) throw new Error("Story definition requires revisionId.");
      const db = await openDatabase();
      const transaction = db.transaction(STORY_DEFINITION_STORE, "readwrite");
      const finished = transactionFinished(transaction);
      const store = transaction.objectStore(STORY_DEFINITION_STORE);
      const existing = await requestResult(store.get(revisionId));
      if (existing && stableWorkerString(existing) !== stableWorkerString(definition)) {
        transaction.abort();
        try {
          await finished;
        } catch {
          // The deliberate abort is reported below.
        }
        throw new Error(`Immutable story definition collision for ${revisionId}.`);
      }
      if (!existing) store.put(structuredClone(definition));
      await finished;
      return {
        revisionId,
        existed: !!existing
      };
    }
    async function loadStoryDefinition(revisionId = "") {
      const id = String(revisionId || "").trim();
      if (!id) return null;
      const db = await openDatabase();
      const transaction = db.transaction(STORY_DEFINITION_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const value = await requestResult(transaction.objectStore(STORY_DEFINITION_STORE).get(id));
      await finished;
      return value || null;
    }
    async function listSaveHeaders() {
      const db = await openDatabase();
      const transaction = db.transaction(SAVE_HEADER_STORE, "readonly");
      const finished = transactionFinished(transaction);
      const rows = await requestResult(transaction.objectStore(SAVE_HEADER_STORE).getAll());
      await finished;
      return rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    }
    async function exportSave(saveId = "") {
      const loaded = await loadSave(saveId);
      if (!loaded) return null;
      const definitionRevisionId = String(loaded.header?.definitionRevisionId || "");
      const definition = definitionRevisionId ? await loadStoryDefinition(definitionRevisionId) : null;
      const images = [];
      for (const row of loaded.images || []) {
        images.push({
          ownerType: row.ownerType,
          imageId: row.imageId,
          saveId: row.saveId,
          value: await portableImageValue(row.value, row.blob)
        });
      }
      const profileIds = structuredProfileImageIds([...(loaded.records || []).map(row => row.value), definition]);
      const profileRows = profileIds.size ? (await recordRowsByType("profile-image")).filter(row => profileIds.has(String(row.id || ""))) : [];
      const profileImages = [];
      for (const row of profileRows) {
        profileImages.push({
          imageId: String(row.id || ""),
          value: await portableImageValue(row.value, row.blob)
        });
      }
      return {
        format: "emberadventures-lite-save-v2",
        exportedAt: new Date().toISOString(),
        header: loaded.header,
        definition,
        records: loaded.records,
        messages: loaded.messages,
        snapshots: loaded.snapshots,
        images,
        profileImages
      };
    }
    function parsedWorkerJson(value, fallback) {
      if (value == null || value === "") return fallback;
      try {
        return JSON.parse(String(value));
      } catch {
        return fallback;
      }
    }
    async function portableLibraryRecords(type = "") {
      const rows = await recordRowsByType(type);
      const values = [];
      for (const row of rows) {
        values.push(type === "profile-image" || type === "story-title-image" ? await portableImageValue(row.value, row.blob) : structuredClone(row.value));
      }
      return values;
    }
    function respondProgress(requestId, phase, detail = {}) {
      postMessage({
        requestId,
        progress: {
          phase: String(phase || ""),
          ...detail
        }
      });
    }
    function emergencyExportScopeIdSet(scope = null, key = "") {
      if (!scope || !Array.isArray(scope[key])) return null;
      return new Set(scope[key].map(String).filter(Boolean));
    }
    function emergencyExportScopedRecords(records = [], scopeIds = null, idForRecord = record => record?.id) {
      if (!(scopeIds instanceof Set)) return records;
      return records.filter(record => scopeIds.has(String(idForRecord(record) || "")));
    }
    async function buildEmergencyExport(requestId, payload = {}) {
      respondProgress(requestId, "loading saves");
      const scope = payload.scope || null;
      const saveIds = emergencyExportScopeIdSet(scope, "saveIds");
      const storyIds = emergencyExportScopeIdSet(scope, "storyIds");
      const characterIds = emergencyExportScopeIdSet(scope, "characterIds");
      const profileImageIds = emergencyExportScopeIdSet(scope, "profileImageIds");
      const storyTitleImageIds = emergencyExportScopeIdSet(scope, "storyTitleImageIds");
      const saveIndex = emergencyExportScopedRecords(await listSaveHeaders(), saveIds, record => record?.saveId);
      const saves = [];
      for (let index = 0; index < saveIndex.length; index++) {
        respondProgress(requestId, "loading save", {
          current: index + 1,
          total: saveIndex.length
        });
        const save = await exportSave(saveIndex[index].saveId);
        if (save) saves.push(save);
      }
      respondProgress(requestId, "loading libraries");
      let [storyTemplates, characterDefinitions, profileImages, storyTitleCardImages] = await Promise.all([portableLibraryRecords("story"), portableLibraryRecords("character"), portableLibraryRecords("profile-image"), portableLibraryRecords("story-title-image")]);
      storyTemplates = emergencyExportScopedRecords(storyTemplates, storyIds);
      characterDefinitions = emergencyExportScopedRecords(characterDefinitions, characterIds);
      profileImages = emergencyExportScopedRecords(profileImages, profileImageIds);
      storyTitleCardImages = emergencyExportScopedRecords(storyTitleCardImages, storyTitleImageIds);
      const activePointer = parsedWorkerJson(await kvGet("active/current"), null);
      const settings = parsedWorkerJson(await kvGet("emberadventures-lite-settings-v2"), {});
      const creatorIdentityRegistry = parsedWorkerJson(await kvGet("emberadventures-lite-creator-identities"), {});
      respondProgress(requestId, "serializing");
      const exportPayload = {
        activeSaveId: saveIndex.find(record => String(record?.saveId || "") === String(activePointer?.saveId || ""))?.saveId || saveIndex[0]?.saveId || "",
        saveIndex,
        saves,
        settings,
        creatorIdentityRegistry,
        storyTemplates,
        characterDefinitions,
        profileImages,
        storyTitleCardImages,
        storageFailures: Array.isArray(payload.storageFailures) ? payload.storageFailures : [],
        exportedAt: new Date().toISOString(),
        app: "EmberAdventures",
        diagnosticExport: {
          durableWorkerExport: true,
          runtimeSnapshotIncluded: false,
          build: payload.build || null
        }
      };
      const json = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([json], {
        type: "application/json"
      });
      respondProgress(requestId, "ready", {
        bytes: blob.size,
        saveCount: saves.length
      });
      return {
        blob,
        bytes: blob.size,
        saveCount: saves.length,
        storyCount: storyTemplates.length,
        characterCount: characterDefinitions.length
      };
    }
    async function deleteDatabaseByName(name = "") {
      const databaseName = String(name || "").trim();
      if (!databaseName) return true;
      if (database && database.name === databaseName) database.close();
      database = null;
      databasePromise = null;
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error(`IndexedDB deletion failed for ${databaseName}.`));
        request.onblocked = () => reject(new Error(`IndexedDB deletion was blocked for ${databaseName}. Close other EmberAdventures or EmberQuest tabs, then try again.`));
      });
      return true;
    }
    function isEmberGameDatabaseName(name = "") {
      return /ember\s*[-_]?\s*(?:adventures|quest)/i.test(String(name || ""));
    }
    async function discoveredEmberGameDatabaseNames() {
      const names = new Set(LEGACY_DATABASE_NAMES);
      if (typeof indexedDB.databases !== "function") return [...names];
      try {
        const entries = await indexedDB.databases();
        for (const entry of entries || []) {
          const name = String(entry?.name || "").trim();
          if (name && isEmberGameDatabaseName(name)) names.add(name);
        }
      } catch {}
      return [...names];
    }
    async function deleteAllEmberGameDatabases() {
      devTraceGeneration++;
      pendingSaveBatches.clear();
      const names = await discoveredEmberGameDatabaseNames();
      const failures = [];
      for (const name of names) {
        try {
          await deleteDatabaseByName(name);
        } catch (error) {
          failures.push({
            name,
            error: error?.message || String(error)
          });
        }
      }
      if (failures.length) {
        throw new Error(`Could not delete all EmberAdventures/EmberQuest databases: ${failures.map(item => `${item.name}: ${item.error}`).join(" | ")}`);
      }
      await openDatabase();
      return {
        deleted: names
      };
    }
    function respond(requestId, ok, result = null, error = "") {
      postMessage({
        requestId,
        ok,
        result,
        error
      });
    }
    async function processSaveQueue() {
      if (savePumpRunning) return;
      savePumpRunning = true;
      try {
        while (pendingSaveBatches.size) {
          const [saveId, pending] = pendingSaveBatches.entries().next().value;
          pendingSaveBatches.delete(saveId);
          for (let index = 0; index < pending.payloads.length; index++) {
            try {
              const result = await writeSaveBatch(pending.payloads[index]);
              respond(pending.requestIds[index], true, result);
            } catch (error) {
              respond(pending.requestIds[index], false, null, error?.message || String(error));
            }
          }
        }
      } finally {
        savePumpRunning = false;
        if (pendingSaveBatches.size) processSaveQueue();
      }
    }
    function queueSaveBatch(requestId, payload) {
      const saveId = String(payload.saveId || "");
      const pending = pendingSaveBatches.get(saveId);
      if (pending) {
        pending.payloads.push(payload);
        pending.requestIds.push(requestId);
      } else {
        pendingSaveBatches.set(saveId, {
          payloads: [payload],
          requestIds: [requestId]
        });
      }
      setTimeout(processSaveQueue, 0);
    }
    async function handleRequest(requestId, type, payload) {
      if (type === "ready") {
        await openDatabase();
        return {
          databaseName: DATABASE_NAME,
          databaseVersion: DATABASE_VERSION,
          stores: {
            saveHeaders: SAVE_HEADER_STORE,
            saveRecords: SAVE_RECORD_STORE,
            messages: SAVE_MESSAGE_STORE,
            snapshots: SAVE_SNAPSHOT_STORE,
            images: IMAGE_RECORD_STORE,
            storyDefinitions: STORY_DEFINITION_STORE,
            devTrace: DEV_TRACE_STORE
          }
        };
      }
      if (type === "kv-get") return kvGet(payload.key);
      if (type === "kv-get-json") {
        const stored = await kvGet(payload.key);
        return stored == null ? payload.fallback : JSON.parse(stored);
      }
      if (type === "kv-set") return kvSet(payload.key, payload.value);
      if (type === "kv-set-json") return kvSet(payload.key, JSON.stringify(payload.value));
      if (type === "kv-delete") return kvDelete(payload.key);
      if (type === "kv-keys") return kvKeys();
      if (type === "json-parse") {
        const texts = Array.isArray(payload.texts) ? payload.texts : [];
        return texts.map(text => JSON.parse(String(text || "")));
      }
      if (type === "json-parse-safe") {
        const texts = Array.isArray(payload.texts) ? payload.texts : [];
        return texts.map(text => {
          try {
            return {
              value: JSON.parse(String(text || ""))
            };
          } catch (error) {
            return {
              error: error?.message || String(error)
            };
          }
        });
      }
      if (type === "json-stringify") return JSON.stringify(payload.value, null, 2);
      if (type === "json-stringify-blob") return new Blob([JSON.stringify(payload.value, null, payload.pretty === false ? undefined : 2)], {
        type: "application/json"
      });
      if (type === "records-load-type") return recordRowsByType(payload.type);
      if (type === "records-replace-type") return replaceRecordType(payload.type, payload.rows || []);
      if (type === "records-put") return putRecordRows(payload.rows || []);
      if (type === "records-store-library") {
        const rows = await libraryRowsForStorage(payload.key, payload.records || []);
        if (payload.replace === true) return replaceRecordType(payload.recordType, rows);
        return putRecordRows(rows);
      }
      if (type === "records-delete") return deleteRecordRows(payload.keys || []);
      if (type === "dev-trace-append") return queueDevTraceStoreWork(() => appendDevTraceChunk(payload.entries || []));
      if (type === "dev-trace-reset") {
        devTraceGeneration += 1;
        return queueDevTraceStoreWork(resetDevTraceArchive);
      }
      if (type === "dev-trace-read") return queueDevTraceStoreWork(devTraceArchiveEntries);
      if (type === "dev-trace-stats") return queueDevTraceStoreWork(devTraceArchiveStats);
      if (type === "dev-trace-export") return queueDevTraceStoreWork(() => buildDevTraceArchiveExport(payload.exportedAt, true));
      if (type === "dev-trace-export-text") return queueDevTraceStoreWork(() => buildDevTraceArchiveExport(payload.exportedAt, false));
      if (type === "save-load") return loadSave(payload.saveId);
      if (type === "save-delete") return deleteSave(payload.saveId);
      if (type === "save-list") return listSaveHeaders();
      if (type === "save-export") return exportSave(payload.saveId);
      if (type === "emergency-export") return buildEmergencyExport(requestId, payload);
      if (type === "story-definition-put") return storeStoryDefinition(payload.definition || {});
      if (type === "story-definition-get") return loadStoryDefinition(payload.revisionId);
      if (type === "database-delete" || type === "database-delete-all") return deleteAllEmberGameDatabases();
      if (type === "flush") {
        while (savePumpRunning || pendingSaveBatches.size) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        await devTraceWriteChain;
        return true;
      }
      throw new Error("Unknown persistence worker request: " + type);
    }
    self.onmessage = event => {
      const request = event.data || {};
      if (request.type === "save-write-batch") {
        queueSaveBatch(request.requestId, request.payload || {});
        return;
      }
      Promise.resolve(handleRequest(request.requestId, request.type, request.payload || {})).then(result => respond(request.requestId, true, result)).catch(error => respond(request.requestId, false, null, error?.message || String(error)));
    };
  }
  function generatedWorkerError(workerName = "worker", event = null) {
    event?.preventDefault?.();
    const fileName = String(event?.filename || "").trim();
    const line = Number(event?.lineno || 0);
    const column = Number(event?.colno || 0);
    const location = fileName ? ` (${fileName}${line ? `:${line}${column ? `:${column}` : ""}` : ""})` : "";
    const message = `${workerName} failed: ${String(event?.message || "Unknown worker error")}${location}`;
    console.error(message, event);
    return new Error(message);
  }
  const earlyPerformanceEntries = [];
  function queueEarlyPerformanceEntry(label = "startup", data = {}, level = "log") {
    earlyPerformanceEntries.push({
      label,
      data,
      level
    });
  }
  function flushEarlyPerformanceEntries() {
    for (const entry of earlyPerformanceEntries.splice(0)) perfConsole(entry.label, entry.data, entry.level);
  }
  function startPersistenceWorkerEarly() {
    const source = `(${emberAdventuresPersistenceWorkerMain.toString()})();`;
    const workerUrl = URL.createObjectURL(new Blob([source], {
      type: "text/javascript"
    }));
    let worker;
    try {
      worker = new Worker(workerUrl, {
        name: "emberadventures-lite-persistence"
      });
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
    let nextRequestId = 0;
    let failure = null;
    const pending = new Map();
    const rejectPending = error => {
      failure = error instanceof Error ? error : new Error(String(error));
      for (const request of pending.values()) {
        request.reject(failure);
      }
      pending.clear();
    };
    worker.onmessage = event => {
      const response = event.data || {};
      const request = pending.get(response.requestId);
      if (!request) return;
      if (response.progress) {
        request.onProgress?.(response.progress);
        return;
      }
      pending.delete(response.requestId);
      if (response.ok) request.resolve(response.result);else request.reject(new Error(response.error || "Persistence worker request failed."));
    };
    worker.onerror = event => {
      rejectPending(generatedWorkerError("Persistence worker", event));
    };
    worker.onmessageerror = () => {
      rejectPending(new Error("The EmberAdventures persistence worker received invalid data."));
    };
    const request = (type, payload = {}, options = {}) => {
      if (failure) return Promise.reject(failure);
      const requestId = `persistence-${++nextRequestId}`;
      return new Promise((resolve, reject) => {
        pending.set(requestId, {
          resolve,
          reject,
          type,
          onProgress: typeof options.onProgress === "function" ? options.onProgress : null
        });
        const postStartedAt = globalThis.performance?.now?.() || Date.now();
        try {
          worker.postMessage({
            requestId,
            type,
            payload
          });
        } catch (error) {
          pending.delete(requestId);
          reject(error);
          return;
        }
        const postMessageMs = Math.max(0, (globalThis.performance?.now?.() || Date.now()) - postStartedAt);
        if (postMessageMs >= 8.34) queueEarlyPerformanceEntry("persistence worker postMessage", {
          type,
          ms: Math.round(postMessageMs * 10) / 10,
          records: payload?.records?.length || 0,
          messages: payload?.messages?.length || 0,
          snapshots: payload?.snapshots?.length || 0,
          images: payload?.images?.length || 0
        }, postMessageMs >= 50 ? "warn" : "log");
      });
    };
    let ready = request("ready");
    return {
      worker,
      request,
      get ready() {
        return ready;
      },
      reinitialize() {
        ready = request("ready");
        return ready;
      },
      pending,
      get failure() {
        return failure;
      }
    };
  }
  const persistenceWorkerClient = startPersistenceWorkerEarly();
  root.__emberAdventuresPersistenceWorkerClient = persistenceWorkerClient;
  function persistenceWorkerRequest(type, payload = {}, options = {}) {
    return persistenceWorkerClient.ready.then(() => persistenceWorkerClient.request(type, payload, options));
  }
  function storyImportWorkerSource() {
    const scriptSources = [...document.scripts].map(script => String(script.textContent || "")).filter(Boolean);
    const dependencyScript = scriptSources.find(source => source.includes("var EmberBrotliCodec="));
    const applicationScript = scriptSources.find(source => source.includes("function validateStoryDefinition") && source.includes("function storyTemplateRecordFromPayload"));
    if (!dependencyScript) throw new Error("The story import worker could not locate the Brotli codec source.");
    const initStart = applicationScript?.search(/^  init\(\)\.catch\(/m) ?? -1;
    if (initStart < 0) throw new Error("The story import worker could not locate the EmberAdventures application source.");
    const applicationBody = applicationScript.slice(0, initStart);
    const importWorkerStart = applicationBody.search(/^  function storyImportWorkerSource\(\)/m);
    const importWorkerEnd = applicationBody.search(/^  const SUPABASE_PROJECT_URL/m);
    if (importWorkerStart < 0 || importWorkerEnd <= importWorkerStart) throw new Error("The story import worker could not isolate its bootstrap code.");
    const workerApplicationBody = applicationBody.slice(0, importWorkerStart) + applicationBody.slice(importWorkerEnd);
    return String.raw`
                const window = self;
                const document = {
                    scripts: [],
                    body: null,
                    addEventListener() {},
                    removeEventListener() {},
                    getElementById() { return null; },
                    querySelector() { return null; },
                    querySelectorAll() { return []; },
                    createElement() { return {}; },
                };
                const localStorage = {
                    getItem() { return null; },
                    setItem() {},
                    removeItem() {},
                };
                ${dependencyScript}
                ${workerApplicationBody}

                const pendingStoryImports = new Map();
                let nextStoryImportToken = 0;
                const workerReplyTargets = new Map();

                function workerImportProgress(requestId, message = "Working") {
                    (workerReplyTargets.get(requestId) || self).postMessage({
                        requestId,
                        progress: String(message || "Working")
                    });
                }

                function workerGithubResponseError(text = "", fallback = "") {
                    try {
                        const parsed = JSON.parse(String(text || ""));
                        return String(parsed?.message || fallback || "GitHub request failed.").trim();
                    }
                    catch {
                        return String(text || fallback || "GitHub request failed.").trim().slice(0, 500);
                    }
                }

                async function workerGithubFetch(requestUrl = "", options = {}, mode = "github") {
                    const startedAt = Date.now();
                    try {
                        return await fetch(requestUrl, options);
                    }
                    catch (error) {
                        let host = "";
                        try {
                            host = new URL(requestUrl).hostname;
                        }
                        catch (urlError) {
                            host = "";
                        }
                        const online =
                            typeof navigator !== "undefined" &&
                            typeof navigator.onLine === "boolean"
                            ? String(navigator.onLine)
                            : "unknown";
                        throw new Error(
                            "GitHub network request failed before an HTTP response was received. " +
                            "Mode: " + mode + ". " +
                            "Host: " + (host || "unknown") + ". " +
                            "Request URL: " + requestUrl + ". " +
                            "Duration: " + (Date.now() - startedAt) + "ms. " +
                            "Worker online: " + online + ". " +
                            "Fetch error: " + String(error?.name || "Error") + ": " +
                            String(error?.message || error || "Unknown fetch failure.")
                        );
                    }
                }

                async function workerDownloadGithubImportFile(item = {}) {
                    const url = String(item?.url || "").trim();
                    const token = String(item?.token || "").trim();
                    if (!url) throw new Error("GitHub import URL is required.");
                    if (!token) {
                        const requestUrl = githubRawImportUrl(url);
                        if (!/^https:\/\//i.test(requestUrl))
                            throw new Error("GitHub import URL must start with https://: " + url);
                        const response = await workerGithubFetch(
                            requestUrl,
                            { cache: "no-store" },
                            "public raw download",
                        );
                        if (!response.ok)
                            throw new Error(
                                "GitHub could not download " + url + " (" + response.status + " " + (response.statusText || "error") + "). If this is a private repo, paste a GitHub fine-grained token with Contents: Read access.",
                            );
                        return {
                            name: githubFileNameFromUrl(requestUrl),
                            type: String(response.headers.get("content-type") || "application/octet-stream"),
                            blob: await response.blob(),
                        };
                    }
                    const reference = githubFileReferenceFromUrl(url);
                    if (!reference)
                        throw new Error("Private GitHub import needs a GitHub blob URL or raw.githubusercontent.com URL: " + url);
                    // GitHub's normal Contents JSON omits inline content for files
                    // larger than 1 MB. Requesting the raw representation avoids a
                    // second Git-blob API call and a large base64 decode in the worker.
                    const requestUrl = githubContentsApiUrl(reference);
                    const response = await workerGithubFetch(
                        requestUrl,
                        {
                            cache: "no-store",
                            headers: {
                                Accept: "application/vnd.github.raw+json",
                                ...githubTokenHeaders(token),
                            },
                        },
                        "authenticated contents API download",
                    );
                    if (!response.ok) {
                        const text = await response.text();
                        throw new Error(
                            "GitHub could not download " + url + " (" + response.status + " " + (response.statusText || "error") + "): " + workerGithubResponseError(text, "Check the URL and token Contents: Read access."),
                        );
                    }
                    return {
                        name: githubFileNameFromUrl(reference.path),
                        type: String(response.headers.get("content-type") || "application/octet-stream"),
                        blob: new Blob([await response.arrayBuffer()], {
                            type: String(response.headers.get("content-type") || "application/octet-stream"),
                        }),
                    };
                }

                async function workerDownloadGoogleDriveImportFile(item = {}) {
                    const record = item?.record || {};
                    const token = String(item?.token || "").trim();
                    const id = String(record.id || "").trim();
                    const name = String(record.name || "google-drive-import.json").trim();
                    const mimeType = String(record.mimeType || "application/json").trim();
                    if (!id) throw new Error("Google Drive returned a file without an id.");
                    const nativeGoogleDocument = mimeType === "application/vnd.google-apps.document";
                    const requestUrl = nativeGoogleDocument
                        ? "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "/export?mimeType=" + encodeURIComponent("text/plain") + "&key=" + encodeURIComponent(GOOGLE_PICKER_API_KEY)
                        : "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media&supportsAllDrives=true&key=" + encodeURIComponent(GOOGLE_PICKER_API_KEY);
                    const response = await fetch(requestUrl, {
                        headers: { Authorization: "Bearer " + token },
                    });
                    if (!response.ok) {
                        const body = await response.text();
                        const parsed = parseJsonObject(body) || {};
                        const reason = String(parsed.error?.errors?.[0]?.reason || "").trim();
                        const message = String(parsed.error?.message || body || response.statusText || "").trim();
                        throw new Error(
                            "Google Drive could not download " + name + " (" + response.status + (reason ? " " + reason : "") + "): " + (message || "Unknown Google Drive error."),
                        );
                    }
                    const blob = await response.blob();
                    return {
                        name: nativeGoogleDocument && !/\.json$/i.test(name) ? name + ".json" : name,
                        type: nativeGoogleDocument ? "application/json" : mimeType || blob.type || "application/octet-stream",
                        blob,
                    };
                }

                async function workerListGithubDirectoryEntries(reference = {}, token = "") {
                    const response = await fetch(githubContentsApiUrl(reference), {
                        cache: "no-store",
                        headers: {
                            Accept: "application/vnd.github+json",
                            ...githubTokenHeaders(token),
                        },
                    });
                    const text = await response.text();
                    if (!response.ok)
                        throw new Error(
                            "GitHub could not list " + reference.owner + "/" + reference.repo + (reference.path ? "/" + reference.path : "") + " (" + response.status + " " + (response.statusText || "error") + "). Check the repo/folder and token Contents: Read access.",
                        );
                    const data = JSON.parse(text);
                    if (!Array.isArray(data)) throw new Error("GitHub path is a file, not a folder.");
                    return data
                        .filter((entry) => entry?.type === "dir" || compressedJsonFileName(entry?.name))
                        .map((entry) => ({
                            name: String(entry.name || ""),
                            path: String(entry.path || ""),
                            type: String(entry.type || ""),
                            url: entry.type === "file"
                                ? githubFileUrlFromReference({ ...reference, path: entry.path })
                                : "",
                        }));
                }

                async function workerPrepareCharacterImports(files = [], context = {}, requestId = "") {
                    const results = [];
                    const list = Array.from(files || []);
                    for (let index = 0; index < list.length; index++) {
                        const file = list[index];
                        try {
                            const data = JSON.parse(await storyImportFileText(file));
                            const validation = validateCharacterExport(data);
                            if (!validation.ok)
                                throw new Error(validationErrorsText(validation));
                            results.push({
                                records: Array.isArray(data.characters)
                                    ? clone(data.characters)
                                    : [{ character_definition: clone(data.character_definition) }],
                            });
                        }
                        catch (error) {
                            results.push({
                                error:
                                    String(file?.name || "Character import") + ": " +
                                String(error?.message || error),
                            });
                        }
                        workerImportProgress(requestId, "Importing " + (index + 1) + "/" + list.length);
                    }
                    return results;
                }

                function workerValidateCharacterImports(records = []) {
                    return Array.from(records || []).map((record) => ({
                        name: record?.character_definition?.name || "Imported Character",
                        validation: validateCharacterDefinition(record.character_definition),
                    }));
                }

                function storyImportSummary(record = {}, token = "") {
                    return {
                        token,
                        id: String(record.id || ""),
                        title: String(record.title || "Story template"),
                        creator_id: String(record.creator_id || ""),
                        creator: String(record.creator || ""),

                    };
                }

                async function storyImportFileText(file) {
                    return compressedJsonBlobText(file, file?.name || "");
                }

                async function prepareStoryImports(files = []) {
                    const results = [];
                    for (const file of Array.from(files || [])) {
                        try {
                            const data = clone(JSON.parse(await storyImportFileText(file)));
                            const sourceValidation = validateStoryExport(data);
                            if (!sourceValidation.ok)
                                throw new Error(
                                    validationErrorsText(sourceValidation),
                                );
                            const record = clone(data.storyTemplate);
                            cacheValidatedStoryDefinitionArtifact(
                                record,
                                storyDefinitionArtifactFromValidatedTemplate(record),
                            );
                            const token = "story-import-" + (++nextStoryImportToken);
                            pendingStoryImports.set(token, record);
                            results.push({
                                record: {
                                    ...storyImportSummary(record, token),

                                },
                            });
                        }
                        catch (error) {
                            results.push({
                                error:
                                    String(file?.name || "Story template") +
                                    ": " +
                                    String(error?.message || error),
                            });
                        }
                    }
                    return results;
                }

                function prepareStoryImportPayloads(payloads = []) {
                    const results = [];
                    for (const sourcePayload of Array.from(payloads || [])) {
                        try {
                            const payload = clone(sourcePayload);
                            const sourceValidation = validateStoryExport(payload);
                            if (!sourceValidation.ok)
                                throw new Error(
                                    validationErrorsText(sourceValidation),
                                );
                            const record = clone(payload.storyTemplate);
                            cacheValidatedStoryDefinitionArtifact(
                                record,
                                storyDefinitionArtifactFromValidatedTemplate(record),
                            );
                            const token = "story-import-" + (++nextStoryImportToken);
                            pendingStoryImports.set(token, record);
                            results.push({
                                record: {
                                    ...storyImportSummary(record, token),

                                },
                            });
                        }
                        catch (error) {
                            results.push({ error: String(error?.message || error) });
                        }
                    }
                    return results;
                }

                function validateLibraryImportPayload(kind = "", payload = {}) {
                    if (kind === "story") {
                        const validation = validateStoryExport(payload);
                        if (!validation.ok)
                            throw new Error(validationErrorsText(validation));
                        return true;
                    }
                    if (kind === "character") {
                        const validation = validateCharacterExport(payload);
                        if (!validation.ok)
                            throw new Error(validationErrorsText(validation));
                        return true;
                    }
                    throw new Error("Unsupported library import kind: " + kind + ".");
                }

                async function compileStoryLibraryRecords(
                    records = [],
                    requestId = "",
                ) {
                    const sources = Array.from(records || []);
                    const compiled = [];
                    for (let index = 0; index < sources.length; index++) {
                        const source = sources[index];
                        const sourceValidation = validateStoryDefinition(source);
                        if (!sourceValidation.ok)
                            throw new Error(
                                "Story " +
                                    (index + 1) +
                                    ": " +
                                    validationErrorsText(sourceValidation),
                            );
                        const record = clone(source);
                        const artifact = cacheValidatedStoryDefinitionArtifact(
                            record,
                            storyDefinitionArtifactFromValidatedTemplate(record),
                        );
                        compiled.push(record);
                        workerImportProgress(
                            requestId,
                            "Validating stories " +
                                (index + 1) +
                                "/" +
                                sources.length,
                        );
                        if ((index + 1) % 10 === 0) await workerYield();
                    }
                    return compiled.map((record) => ({
                        record,
                        artifact: validatedStoryDefinitionArtifacts.get(record),
                    }));
                }

                async function commitStoryImports(items = []) {
                    const records = [];
                    for (const item of Array.from(items || [])) {
                        const record = pendingStoryImports.get(String(item?.token || ""));
                        if (!record) continue;
                        const artifact = validatedStoryDefinitionArtifacts.get(record);
                        if (!artifact)
                            throw new Error("Pending story import lost its validated compilation artifact.");
                        records.push({
                            record,
                            artifact,
                            creator_identity: item?.creator_identity || null,
                        });
                    }
                    for (const item of Array.from(items || []))
                        pendingStoryImports.delete(String(item?.token || ""));
                    return records;
                }

                function workerYield() {
                    return new Promise((resolve) => setTimeout(resolve, 0));
                }

                async function compileObjectiveDefinitionInBatches(state = {}, requestId = "") {
                    const items = Array.isArray(state?.objectives?.items)
                        ? state.objectives.items
                        : [];
                    const total = items.length;
                    const objectivesById = {};
                    const objectiveOrder = [];
                    for (let index = 0; index < total; index++) {
                        const definition = objectiveDefinitionFromRuntimeObjective(items[index], index);
                        if (String(definition.id).startsWith("job-"))
                            throw new Error("Authored objective ids may not use reserved job namespace: " + definition.id);
                        if (objectivesById[definition.id])
                            throw new Error("Duplicate authored objective id: " + definition.id);
                        objectivesById[definition.id] = definition;
                        objectiveOrder.push(definition.id);
                        if ((index + 1) % 100 === 0 || index + 1 === total) {
                            workerImportProgress(
                                requestId,
                                "Building objective definition " + (index + 1) + "/" + total,
                            );
                            await workerYield();
                        }
                    }
                    const objectiveDependentsById = {};
                    const objectiveIdsByExclusiveGroup = {};
                    for (let index = 0; index < objectiveOrder.length; index++) {
                        const id = objectiveOrder[index];
                        const objective = objectivesById[id];
                        for (const requiredId of objectiveRequiredIds(objective))
                            (objectiveDependentsById[requiredId] ||= []).push(id);
                        for (const transition of objectiveOutputTransitions(objective)) {
                            const targetId = String(
                                transition.objective_id ||
                                    transition.next_objective_id ||
                                    "",
                            ).trim();
                            if (targetId)
                                (objectiveDependentsById[id] ||= []).push(
                                    targetId,
                                );
                        }
                        const group = objectiveExclusiveGroup(objective);
                        if (group) (objectiveIdsByExclusiveGroup[group] ||= []).push(id);
                        if ((index + 1) % 100 === 0 || index + 1 === objectiveOrder.length) {
                            workerImportProgress(
                                requestId,
                                "Building objective dependency map " + (index + 1) + "/" + total,
                            );
                            await workerYield();
                        }
                    }
                    for (const [id, ids] of Object.entries(objectiveDependentsById))
                        objectiveDependentsById[id] = [...new Set(ids)].sort();
                    for (const ids of Object.values(objectiveIdsByExclusiveGroup)) ids.sort();
                    return {
                        objectivesById,
                        objectiveOrder,
                        objectiveDependentsById,
                        objectiveIdsByExclusiveGroup,
                    };
                }

                async function compileObjectiveDefinitionFromValidatedGraphInBatches(
                    state = {},
                    validatedGraph = {},
                    requestId = "",
                ) {
                    const items = Array.isArray(state?.objectives?.items)
                        ? state.objectives.items
                        : [];
                    const objectiveOrder = Array.isArray(
                        validatedGraph?.objectiveOrder,
                    )
                        ? validatedGraph.objectiveOrder
                        : [];
                    if (items.length !== objectiveOrder.length)
                        throw new Error(
                            "Validated objective graph does not match the story runtime objective count.",
                        );

                    const objectivesById = {};
                    for (let index = 0; index < items.length; index++) {
                        const expectedId = String(objectiveOrder[index] || "");
                        const actualId = String(items[index]?.id || "").trim();
                        if (!actualId || actualId !== expectedId)
                            throw new Error(
                                "Validated objective graph does not match the story runtime objective order.",
                            );
                        objectivesById[actualId] =
                            objectiveDefinitionFromRuntimeObjective(
                                items[index],
                                index,
                            );
                        if ((index + 1) % 100 === 0 || index + 1 === items.length) {
                            workerImportProgress(
                                requestId,
                                "Materializing validated objective definition " +
                                    (index + 1) + "/" + items.length,
                            );
                            await workerYield();
                        }
                    }

                    return {
                        objectivesById,
                        objectiveOrder: [...objectiveOrder],
                        objectiveDependentsById: clone(
                            validatedGraph.objectiveDependentsById || {},
                        ),
                        objectiveIdsByExclusiveGroup: clone(
                            validatedGraph.objectiveIdsByExclusiveGroup || {},
                        ),
                    };
                }

                async function objectiveRuntimeFromStateInBatches(
                    state = app.state,
                    definition = app.storyDefinition,
                    requestId = "",
                ) {
                    const authored = definition?.objectivesById || {};
                    const runtime = {
                        ...createEmptyObjectiveRuntime(),
                        activeMainObjectiveId: String(state?.objectives?.active_id || ""),
                        focusedSideObjectiveId: String(state?.objectives?.focus_id || ""),
                        noCurrent: state?.objectives?.no_current === true,
                        progressNotesById: clone(state?.objectives?.progress_notes || {}),
                        pendingRewardChoices: clone(state?.objectives?.pending_reward_choices || []),
                        pendingChoice: clone(state?.objectives?.pending_choice || null),
                        exclusiveGroupChoices: clone(
                            state?.objectives?.exclusive_group_choices || {},
                        ),
                        suggestions: clone(state?.objectives?.suggestions || []),
                        completionMessage: String(state?.objectives?.completion_message || ""),
                        completedMainMessage: String(
                            state?.objectives?.completed_main_message || "",
                        ),
                        pendingCompletionMessage: clone(
                            state?.objectives?.pending_completion_message || null,
                        ),
                    };
                    const items = Array.isArray(state?.objectives?.items)
                        ? state.objectives.items
                        : [];
                    for (let index = 0; index < items.length; index++) {
                        const objective = items[index];
                        const id = String(objective?.id || "").trim();
                        if (id) {
                            const objectiveDefinition = objectiveDefinitionById(id) || authored[id] || {};
                            const initialStatus = String(
                                objectiveDefinition.initialStatus || objectiveDefinition.status || "hidden",
                            );
                            const status = String(objective.status || initialStatus);
                            if (status !== initialStatus) runtime.statusById[id] = status;
                            const selectedOutcomeId = String(
                                objective.selected_outcome_id || "",
                            );
                            if (selectedOutcomeId) runtime.selectedOutcomeById[id] = selectedOutcomeId;
                            const selectedMessageId = String(
                                objective.selected_outcome_message_id ||
                                    "",
                            );
                            if (selectedMessageId)
                                runtime.selectedOutcomeMessageById[id] = selectedMessageId;
                            const selectedChoiceId = String(
                                objective.selected_choice_id || "",
                            );
                            if (selectedChoiceId) runtime.selectedChoiceById[id] = selectedChoiceId;
                            const selectedChoiceTitle = String(
                                objective.selected_choice_title || "",
                            );
                            if (selectedChoiceTitle)
                                runtime.selectedChoiceTitleById[id] = selectedChoiceTitle;
                            const selectedOutputId = String(
                                objective.selected_output_id ||
                                    "",
                            );
                            if (selectedOutputId)
                                runtime.selectedOutputById[id] = selectedOutputId;
                            const notes = objective.progress_notes;
                            if (notes != null && notes !== "" && !runtime.progressNotesById[id])
                                runtime.progressNotesById[id] = clone(notes);
                        }
                        if ((index + 1) % 100 === 0 || index + 1 === items.length) {
                            workerImportProgress(
                                requestId,
                                "Building sparse objective runtime " + (index + 1) + "/" + items.length,
                            );
                            await workerYield();
                        }
                    }
                    return runtime;
                }

                async function compileStoryDefinitionRuntime(
                    state = {},
                    revisionId = "",
                    requestId = "",
                    options = {},
                ) {
                    workerImportProgress(requestId, "Preparing objective definition");
                    app.state = state;
                    app.runtimeDefinitions = {
                        jobsById: {},
                        charactersById: {},
                        locationsById: {},
                    };
                    const objectiveCompilation = options.validatedObjectiveGraph
                        ? await compileObjectiveDefinitionFromValidatedGraphInBatches(
                              state,
                              options.validatedObjectiveGraph,
                              requestId,
                          )
                        : await compileObjectiveDefinitionInBatches(
                              state,
                              requestId,
                          );
                    workerImportProgress(requestId, "Objective definition indexed");
                    const definition = immutableStoryDefinitionFromState(state, {
                        revisionId: String(revisionId || "").trim(),
                        objectiveCompilation,
                    });
                    workerImportProgress(requestId, "Story definition assembled");
                    app.storyDefinition = deepFreezeDefinition(definition);
                    workerImportProgress(requestId, "Story definition frozen");
                    app.objectiveRuntime = await objectiveRuntimeFromStateInBatches(
                        state,
                        app.storyDefinition,
                        requestId,
                    );
                    state.meta ||= {};
                    state.meta.definition_revision_id = app.storyDefinition.revisionId;
                    state.meta.definition_content_hash = app.storyDefinition.contentHash;
                    app.runtimeStateReference = state;
                    workerImportProgress(requestId, "Sparse objective runtime ready");
                    app.rewardRuntime = createEmptyRewardRuntime();
                    app.storyRulesRuntime = storyRulesRuntimeFromState(
                        state,
                        app.storyDefinition,
                    );
                    app.jobRuntime = runtimeJobAggregateFromState(state);
                    workerImportProgress(requestId, "Creating immutable runtime seed");
                    const mutable = clone(app.storyDefinition);
                    mutable.sourceRevisionId = String(
                        revisionId || mutable.revisionId || "",
                    ).trim();
                    workerImportProgress(requestId, "Definition copy ready");
                    mutable.initialRuntimeTemplate = {
                        records: materializeRuntimeRecordRows(
                            allRuntimeRecordDescriptors(state),
                            state,
                        ),
                    };
                    workerImportProgress(requestId, "Runtime seed records ready");
                    const hashInput = clone(mutable);
                    workerImportProgress(requestId, "Definition hash input ready");
                    delete hashInput.revisionId;
                    delete hashInput.contentHash;
                    mutable.contentHash = stableContentHash(hashInput);
                    mutable.revisionId = "story-runtime-" + mutable.contentHash;
                    workerImportProgress(requestId, "Definition hash ready");
                    const compiledDefinition = deepFreezeDefinition(mutable);
                    workerImportProgress(requestId, "Compiled definition frozen");
                    state.meta.definition_revision_id = compiledDefinition.revisionId;
                    state.meta.definition_content_hash = compiledDefinition.contentHash;
                    workerImportProgress(requestId, "Definition ready");
                    return {
                        definition: compiledDefinition,
                        objectiveRuntime: app.objectiveRuntime,
                        rewardRuntime: app.rewardRuntime,
                        storyRulesRuntime: app.storyRulesRuntime,
                        jobRuntime: app.jobRuntime,
                    };
                }

                async function materializeStoryRuntime(payload = {}, requestId = "") {
                    let state = clone(payload.state || {});
                    if (!String(state?.player?.id || "").trim())
                        throw new Error(
                            "Story runtime player id is required and cannot be empty.",
                        );
                    state = materializeStoryDefinitionCharactersForRuntime(state);
                    // This worker has no active user profile. Keep the
                    // profile-independent runtime pass here; profile-specific
                    // presentation must be applied by game orchestration after
                    // the profile has been hydrated.
                    state = materializeRuntimeDisplayReferences(state, state);
                    const messages = materializeRuntimeDisplayReferences(
                        Array.isArray(payload.messages) ? payload.messages : [],
                        state,
                    ).map((message, index) => ({
                        ...message,
                        id: index + 1,
                        entryId: index + 1,
                    }));
                    finalizeRuntimeCharacterNameKeys(state);
                    const compiledRuntime = payload.compileDefinition === true
                        ? await compileStoryDefinitionRuntime(
                              state,
                               payload.definitionRevisionId,
                               requestId,
                               {
                                   validatedObjectiveGraph:
                                       payload.validatedObjectiveGraph || null,
                               },
                           )
                        : null;
                    return { state, messages, compiledRuntime };
                }

                function handleStoryImportWorkerMessage(event, replyTarget = self) {
                    const request = event.data || {};
                    const requestId = request.requestId;
                    workerReplyTargets.set(requestId, replyTarget);
                    const reply = (ok, result = null, error = "", transfer = []) => {
                        workerReplyTargets.delete(requestId);
                        replyTarget.postMessage({ requestId, ok, result, error }, transfer);
                    };
                    if (request.type === "compress-json") {
                        const format = String(request.payload?.format || "").trim();
                        const source = new Blob(
                            [String(request.payload?.text || "")],
                            { type: "application/json" },
                        );
                        compressBlobWithFormat(source, format)
                            .then((result) => result.arrayBuffer())
                            .then((buffer) => reply(true, buffer, "", [buffer]))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "download-import-file") {
                        const source = String(request.payload?.source || "").trim();
                        workerImportProgress(requestId, "Downloading");
                        const download = source === "google-drive"
                            ? workerDownloadGoogleDriveImportFile(request.payload?.item || {})
                            : workerDownloadGithubImportFile(request.payload?.item || {});
                        download
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "list-github-import-directory") {
                        workerImportProgress(requestId, "Loading");
                        workerListGithubDirectoryEntries(
                            request.payload?.reference || {},
                            request.payload?.token || "",
                        )
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "prepare-character-import") {
                        workerPrepareCharacterImports(
                            request.payload?.files || [],
                            request.payload?.context || {},
                            requestId,
                        )
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "validate-character-import") {
                        try {
                            reply(
                                true,
                                workerValidateCharacterImports(request.payload?.records || []),
                            );
                        }
                        catch (error) {
                            reply(false, null, error?.stack || error?.message || String(error));
                        }
                        return;
                    }
                    if (request.type === "prepare-story-import") {
                        prepareStoryImports(request.payload?.files || [])
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "prepare-story-import-payload") {
                        try {
                            reply(
                                true,
                                prepareStoryImportPayloads(request.payload?.payloads || []),
                            );
                        }
                        catch (error) {
                            reply(false, null, error?.stack || error?.message || String(error));
                        }
                        return;
                    }
                    if (request.type === "validate-library-import") {
                        try {
                            reply(
                                true,
                                validateLibraryImportPayload(
                                    request.payload?.kind,
                                    request.payload?.payload,
                                ),
                            );
                        }
                        catch (error) {
                            reply(false, null, error?.stack || error?.message || String(error));
                        }
                        return;
                    }
                    if (request.type === "compile-story-validation-artifact") {
                        try {
                            const template = request.payload?.template || {};
                            reply(true, applyValidatedStoryDefinitionArtifact(template));
                        }
                        catch (error) {
                            reply(false, null, error?.stack || error?.message || String(error));
                        }
                        return;
                    }
                    if (request.type === "compile-story-library-records") {
                        compileStoryLibraryRecords(
                            request.payload?.records || [],
                            request.requestId,
                        )
                            .then((result) => reply(true, result))
                            .catch((error) =>
                                reply(false, null, error?.stack || error?.message || String(error)),
                            );
                        return;
                    }
                    if (request.type === "commit-story-import") {
                        commitStoryImports(request.payload?.items || [])
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "discard-story-import") {
                        for (const token of request.payload?.tokens || [])
                            pendingStoryImports.delete(String(token || ""));
                        reply(true, true);
                        return;
                    }
                    if (request.type === "materialize-story-runtime") {
                        materializeStoryRuntime(request.payload || {}, requestId)
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    if (request.type === "compile-story-definition") {
                        compileStoryDefinitionRuntime(
                            request.payload?.state || {},
                            request.payload?.definitionRevisionId || "",
                            requestId,
                            {
                                validatedObjectiveGraph:
                                    request.payload?.validatedObjectiveGraph || null,
                            },
                        )
                            .then((result) => reply(true, result))
                            .catch((error) => reply(false, null, error?.stack || error?.message || String(error)));
                        return;
                    }
                    reply(false, null, "Unknown story import worker request: " + request.type);
                }

                self.onmessage = (event) => {
                    const request = event.data || {};
                    if (request.type === "connect-library-validation") {
                        const port = request.port;
                        if (!(port instanceof MessagePort))
                            throw new Error("Library validation connection requires a MessagePort.");
                        port.onmessage = (portEvent) => handleStoryImportWorkerMessage(portEvent, port);
                        port.start();
                        return;
                    }
                    handleStoryImportWorkerMessage(event, self);
                };
            })();`;
  }
  function startStoryImportWorkerEarly() {
    const source = storyImportWorkerSource();
    const workerUrl = URL.createObjectURL(new Blob([source], {
      type: "text/javascript"
    }));
    let worker;
    try {
      worker = new Worker(workerUrl, {
        name: "emberadventures-lite-story-import"
      });
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
    let nextRequestId = 0;
    let failure = null;
    const pending = new Map();
    const rejectPending = error => {
      failure = error instanceof Error ? error : new Error(String(error));
      for (const request of pending.values()) request.reject(failure);
      pending.clear();
    };
    worker.onmessage = event => {
      const response = event.data || {};
      const request = pending.get(response.requestId);
      if (!request) return;
      if (response.progress != null) {
        request.onProgress?.(String(response.progress || "Working"));
        return;
      }
      pending.delete(response.requestId);
      if (response.ok) {
        request.resolve(response.result);
      } else request.reject(new Error(response.error || "Story import worker request failed."));
    };
    worker.onerror = event => rejectPending(generatedWorkerError("Story import worker", event));
    worker.onmessageerror = () => rejectPending(new Error("The story import worker received invalid data."));
    return {
      worker,
      request(type, payload = {}, options = {}) {
        if (failure) return Promise.reject(failure);
        const requestId = `story-import-${++nextRequestId}`;
        return new Promise((resolve, reject) => {
          pending.set(requestId, {
            resolve,
            reject,
            type,
            onProgress: options.onProgress
          });
          try {
            worker.postMessage({
              requestId,
              type,
              payload
            });
          } catch (error) {
            pending.delete(requestId);
            reject(error);
          }
        });
      },
      pending,
      get failure() {
        return failure;
      }
    };
  }
  const storyImportWorkerClient = startStoryImportWorkerEarly();
  globalThis.__emberAdventuresConnectLibraryValidationWorker = libraryWorker => {
    if (!(libraryWorker instanceof Worker)) throw new Error("Library validation connection requires a Worker.");
    const channel = new MessageChannel();
    storyImportWorkerClient.worker.postMessage({
      type: "connect-library-validation",
      port: channel.port1
    }, [channel.port1]);
    libraryWorker.postMessage({
      type: "library.validation-connect",
      port: channel.port2
    }, [channel.port2]);
  };
  async function storyImportWorkerRequest(type, payload = {}, options = {}) {
    const result = await storyImportWorkerClient.request(type, payload, options);
    if (["commit-story-import", "compile-story-library-records"].includes(type) && Array.isArray(result)) {
      const records = result.map(item => {
        cacheValidatedStoryDefinitionArtifact(item.record, item.artifact);
        setStoryLibraryCreatorMetadata(item.record, item.creator_identity);
        return item.record;
      });
      if (type === "commit-story-import" && records.length) {
        for (let index = 0; index < records.length; index++) await savePerRecordLibraryRecords(STORY_TEMPLATE_KEY, [records[index]], {
          creatorIdentity: result[index]?.creator_identity || null
        });
      }
      return records;
    }
    return result;
  }
  globalThis.__emberAdventuresValidateLibraryImport = (kind, payload) => storyImportWorkerRequest("validate-library-import", {
    kind,
    payload
  });
  async function compileStoryTemplateValidationArtifact(template = {}, options = {}) {
    const rawTemplate = runtimeSaveUnwrapContainer(template);
    const rawState = runtimeSaveUnwrapContainer(rawTemplate?.state);
    const workerTemplate = rawState === rawTemplate?.state ? rawTemplate : {
      ...rawTemplate,
      state: rawState
    };
    const compiled = await storyImportWorkerRequest("compile-story-validation-artifact", {
      template: workerTemplate
    }, {
      onProgress: options.onProgress
    });
    cacheValidatedStoryDefinitionArtifact(template, compiled);
    return template;
  }
  function compileStoryTemplateLibraryRecords(records = [], options = {}) {
    return storyImportWorkerRequest("compile-story-library-records", {
      records
    }, {
      onProgress: options.onProgress
    });
  }
  const SUPABASE_PROJECT_URL = "";
  const SUPABASE_PUBLISHABLE_KEY = "";
  const SUPABASE_SESSION_KEY = "emberadventures-lite-supabase-session";
  const GOOGLE_PICKER_API_KEY = "AIzaSyAuATFsOg_ReQZXyxSphudAyz9CIA0xAhE";
  const GOOGLE_PICKER_APP_ID = "944492826525";
  const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const PUBLIC_LIBRARY_AUTH_REDIRECT_URL = "";
  const PUBLIC_LIBRARY_QUERY_CACHE_KEY = "emberadventures-lite-public-library-query-cache-v2";
  const PUBLIC_LIBRARY_QUERY_CACHE_VERSION = 7;
  const PUBLIC_LIBRARY_QUERY_CACHE_MAX_ENTRIES = 12;
  //Curated entries point directly at permanent Perchance uploads. These
  //lists are intentionally independent from the Supabase browsing index.
  //Use the dev-only Featured Content Publisher to generate source-ready
  //entries after uploading the selected local definitions and images.
  const PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS = [];
  const PUBLIC_LIBRARY_FEATURED_STORY_URLS = [];
  const PUBLIC_LIBRARY_SANDBOX_STORY_URLS = [];
  // Save storage rule: active game data lives in RAM while playing and
  // is persisted as revisioned dirty aggregate records. Messages, snapshots,
  // images, settings/profile data, and global libraries keep their owning stores.
  const LARGE_STORAGE_DB_NAME = "emberadventures-lite-data";
  const LARGE_STORAGE_KEYS = [STATE_SYNC_CHECKPOINT_KEY, WORLD_GENERATION_CHECKPOINT_KEY, STORY_TEMPLATE_KEY, STORY_TITLE_CARD_IMAGE_KEY, CHARACTER_LIBRARY_KEY, PROFILE_IMAGE_KEY, CREATOR_IDENTITY_KEY];
  const MAX_USER_PROFILES = 10;
  const defaultState = {
    meta: {
      app: "EmberAdventures",
      genres: ["fantasy"],
      setup_complete: false,
      story_guidance: "",
      story_source: {
        mode: "original",
        title: "",
        description: "",
        modifications: ""
      }
    },
    location: {
      npc_location_id: "starting-area",
      universe: "",
      world: "",
      continent: "",
      region: "",
      settlement_type: "",
      settlement_name: "",
      district: "",
      specific_place: ""
    },
    world_map: {
      current_location_id: "starting-area",
      focus_location_id: "starting-area",
      travel_history: [],
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
          summary: "The starting area for a new adventure.",
          detail: {},
          npcs: [],
          connections: []
        }
      }
    },
    time: {
      year: 1482,
      month: 10,
      day: 7,
      hour: 8,
      minute: 0
    },
    scene: {
      summary: "The party is beginning a fantasy RPG adventure.",
      objective: "Discover the first meaningful lead.",
      party_members_present: [],
      image_characters: [],
      npcs_present: [],
      image_action: "standing in torchlight"
    },
    player: {
      name: "Player",
      source: null,
      creator: null,
      creation_tool: null,
      can_die: false,
      romanceable: true,
      age: 18,
      gender: "",
      role: "commoner",
      relationship_to_player: "self",
      trust: 0,
      attraction: 0,
      affection: 0,
      personality_description: "A grounded, adaptable protagonist whose personality is defined by player choices.",
      boldness: 5,
      state_of_mind: "neutral",
      physical_state: "normal",
      pose: "standing",
      voice: "Narrator",
      appearance: {
        species: "human",
        height: 10,
        body_description: "",

        skin_color: "",
        eye_color: "",
        hair_color: "",
        hair_length: "",
        hair_type: "",
        extra_description: "",
        extra_description_lower_body: "",
        male_only_extra_description: null,
        non_male_only_extra_description: null,
        nonhuman_lower_body: false
      },
      clothing: {
        hat: null,
        hair_accessory: null,
        face: null,
        ears: null,
        neck: null,
        shoulders: null,
        bra: null,
        undershirt: "simple shirt",
        shirt: "adventurer's jacket",
        over_shirt: null,
        coat: null,
        back: null,
        hands: null,
        right_wrist: null,
        left_wrist: null,
        right_fingers: null,
        left_fingers: null,
        waist: "belt",
        belt_accessory: null,
        underwear: "basic underwear",
        pants: "travel pants",
        skirt: null,
        legwear: null,
        socks: null,
        feet: "boots",
        other_accessory: null
      },
      outfits: [],
      active_outfit_id: "",
      held_items: {
        right_hand: null,
        left_hand: null
      },
      image: {
        seed_enabled: true,
        seed: 915321,
        style: "high detail fantasy RPG character art, cinematic lighting",
        negative: ""
      },
      default_seed: 915321,
      image_prompt_config: {
        seed_enabled: true,
        seed: 915321,
        style: "high detail fantasy RPG character art, cinematic lighting",
        profile_style: "",
        negative: "",
        negative_prompt: ""
      },
      default_profile_image: {
        url: "",
        local_image_id: "",
        source: "",
        seed: null,
        prompt: "",
        negative_prompt: "",
        note: "",
        male: false
      },
      profile_image_presentations: {
        male: {
          url: "",
          local_image_id: "",
          source: "",
          seed: null,
          prompt: "",
          negative_prompt: "",
          note: "",
          male: true
        },
        non_male: {
          url: "",
          local_image_id: "",
          source: "",
          seed: null,
          prompt: "",
          negative_prompt: "",
          note: "",
          male: false
        }
      },
      profile_images: [],
      profile_image_id: "",
      inventory: ["coin pouch"],
      known_facts: []
    },
    characters: {},
    npc_directory: {
      locations: {
        "starting-area": {
          label: "Starting Area",
          characters: {}
        }
      }
    },
    world_flags: {
      magic_level: "high",
      tone: "adventurous"
    },
    progression: {},
    objectives: {
      active_id: "",
      focus_id: "",
      items: [],
      pending_reward_choices: []
    },
    reward_bundles: {},
    reward_templates: {},
    character_shop_cost_templates: {},
    numeric_precision: {
      story_inventory: {},
      character_stats: {}
    },
    future_cast: {
      enabled: true,
      items: {}
    },
    story_inventory: {
      coins: 0,
      adventurer_xp: 0,
      adventurer_rank: 0,
      items: []
    },
    story_clock: {
      elapsed_minutes: 0,
      label: "Day 1, 8:00 AM"
    },
    story_pacing: {
      mode: "player_controlled",
      pending_event_id: "",
      timeline: {}
    },
    timed_events: {},
    story_shops: {},
    story_job_offers: {},
    story_job_offer_history: {},
    active_generated_jobs: {},
    story_generated_npc_pool: {},
    temp_speakers: {},
    story_rules: [],
    story_memory: {
      world_notes: [],
      unresolved_threads: [],
      relationship_notes: [],
      rules_and_constraints: [],
      ai_private_notes: []
    },
    recent_changes: []
  };
  const BODY_STAT_DEFAULTS = Object.freeze({ height: 10 });
  const bodyStatPhrases = {
    height: [`absurdly tiny adult figure, about 2'6" / 76 cm tall`, `extraordinarily tiny adult figure, about 3'0" / 91 cm tall`, `exceptionally tiny adult figure, about 3'6" / 107 cm tall`, `extremely short adult figure, about 4'0" / 122 cm tall`, `unusually short adult figure, about 4'4" / 132 cm tall`, `very short adult figure, about 4'8" / 142 cm tall`, `short adult figure, about 5'0" / 152 cm tall`, `moderately short adult figure, about 5'2" / 157 cm tall`, `slightly short adult figure, about 5'4" / 163 cm tall`, `a little below average height, about 5'6" / 168 cm tall`, `average adult height, about 5'8" / 173 cm tall`, `a little above average height, about 5'10" / 178 cm tall`, `moderately tall adult figure, about 6'0" / 183 cm tall`, `tall adult figure, about 6'3" / 191 cm tall`, `very tall adult figure, about 6'6" / 198 cm tall`, `exceptionally tall adult figure, about 7'0" / 213 cm tall`, `giant-scale adult figure, about 7'6" / 229 cm tall`, `extremely tall fantasy figure, about 8'0" / 244 cm tall`, `enormous fantasy figure, about 9'0" / 274 cm tall`, `colossal fantasy figure, about 10'6" / 320 cm tall`, `absurd extreme-fantasy height, about 12'0" / 366 cm tall`],

  };
  const STATE_SYNC_FREE_MESSAGE_SLACK = 5;
  const PERCHANCE_IMAGE_MODEL_DEFAULT = "fantasy-rpg";
  const PROFILE_IMAGE_MODEL_DEFAULT = "game-art-icon";
  const PROFILE_IMAGE_RESOLUTION = "768x768";
  const STORY_TITLE_CARD_IMAGE_RESOLUTION = "768x768";
  const SAVE_ALL_NORMAL_DELAY_MS = 5000;
  const SAVE_ALL_URGENT_DELAY_MS = 500;
  const IMAGE_ART_STYLE_PRESETS = [{
    value: "fantasy-rpg",
    label: "Cinematic Fantasy",
    hint: "Use a polished fantasy adventure image style."
  }, {
    value: "polished-animation",
    label: "Polished",
    hint: "Use polished high-budget animated fantasy character art."
  }, {
    value: "none",
    label: "None",
    hint: "Use no art-style wrapper and no extra default style block."
  }, {
    value: "game-art-icon",
    label: "Game Art Icon",
    prompt: "{prompt}, game art icon, polished RPG character icon, square character portrait, clean readable silhouette, high quality game UI portrait, detailed painted game asset",
    negative: ""
  }, {
    value: "painted-anime",
    label: "Painted Anime",
    prompt: "{prompt}, painterly anime artwork, world-class masterpiece, fine details, breathtaking artwork, painterly art style, high quality, 8k, very detailed, high resolution, exquisite composition and lighting"
  }, {
    value: "casual-photo",
    label: "Casual Photo",
    prompt: "A casual photo of {prompt}. It's a casual photo."
  }, {
    value: "cinematic",
    label: "Cinematic",
    prompt: "{prompt}, cinematic shot, dynamic lighting, 75mm, Technicolor, Panavision, cinemascope, sharp focus, fine details, HDR, realistic, key visual, film still, cinematic color grading, depth of field"
  }, {
    value: "digital-painting",
    label: "Digital Painting",
    prompt: "{prompt}, breathtaking digital art, trending on artstation, 8k, high resolution, best quality, world-class masterpiece digital painting"
  }, {
    value: "concept-art",
    label: "Concept Art",
    prompt: "{prompt}, concept art, digital art, illustration, 8k, fine details, sharp, very detailed, high resolution, world-class masterpiece"
  }, {
    value: "3d-disney-character",
    label: "3D Disney Character",
    prompt: "3D cartoon Disney character portrait render, {prompt}, bokeh, highly detailed, Pixar render, CGI animation, cute big reflective eyes, cinematic film, Disney-style octane render, superb lighting and detail"
  }, {
    value: "2d-disney-character",
    label: "2D Disney Character",
    prompt: "2D cartoon Disney character digital art of {prompt}, superb linework, classic 2D Disney style art, Disney-style character concept, trending on artstation"
  }, {
    value: "disney-sketch",
    label: "Disney Sketch",
    prompt: "Glen Keane character concept art black and white pencil sketch of {prompt}, rough pencil sketch, loose Disney-style character concept art sketch, nice sketchy pencil strokes"
  }, {
    value: "concept-sketch",
    label: "Concept Sketch",
    prompt: "black and white technical drawing showcasing {prompt}, annotation details, pencil strokes, annotated technical concept art sketch, pencil texture"
  }, {
    value: "painterly",
    label: "Painterly",
    prompt: "painterly digital painting, {prompt}, painterly brush strokes, world-class painterly masterpiece"
  }, {
    value: "oil-painting",
    label: "Oil Painting",
    prompt: "breathtaking alla prima oil painting, {prompt}, oil on linen, painterly oil on canvas, exquisite composition and lighting, modern painterly masterpiece"
  }, {
    value: "oil-painting-realism",
    label: "Oil Painting - Realism",
    prompt: "breathtaking oil painting, {prompt}, photorealistic oil painting, fine details, very detailed"
  }, {
    value: "oil-painting-old",
    label: "Oil Painting - Old",
    prompt: "{prompt}, oil painting in the style of Jean-Francois Millet and Gustave Courbet and Jules Breton"
  }, {
    value: "oil-painting-70s-pulp",
    label: "Oil Painting - 70s Pulp",
    prompt: "1970s vintage pulp art, ultra realistic, exquisite lighting and composition, polished, masterpiece, glossy pulp art, Amazing Stories, Weird Tales, {prompt}",
    negative: ""
  }, {
    value: "professional-photo",
    label: "Professional Photo",
    prompt: "{prompt}, sharp focus, depth of field, HDR, professional lighting, taken with Canon EOS R5, DSLR, 75mm lens"
  }, {
    value: "anime",
    label: "Anime",
    prompt: "anime art of {prompt}, world-class masterpiece, best quality, anime art, beautiful composition"
  }, {
    value: "drawn-anime",
    label: "Drawn Anime",
    prompt: "anime-style illustration with perfect clean lines, illustration of {prompt}, bold linework, cel shaded, professional anime illustration, flawless line work, perfect composition"
  }, {
    value: "anime-screencap",
    label: "Anime Screencap",
    prompt: "Anime screencap, {prompt}, beautiful visual quality, remastered, extremely high quality, high production value, exquisite anime screencap style image",
    negative: ""
  }, {
    value: "cute-anime",
    label: "Cute Anime",
    prompt: "adorable, cute, kawaii, {prompt}, cute moe anime character portrait, featured on pixiv, very detailed, adorable anime-inspired artwork"
  }, {
    value: "soft-anime",
    label: "Soft Anime",
    prompt: "{prompt}, anime masterpiece with soft lighting, gentle intricate style, highly detailed, pixiv, anime art, high quality"
  }, {
    value: "fantasy-painting",
    label: "Fantasy Painting",
    prompt: "{prompt}, d&d, fantasy, highly detailed, digital painting, artstation, sharp focus, fantasy art, illustration, world-class masterpiece artwork"
  }, {
    value: "fantasy-landscape",
    label: "Fantasy Landscape",
    prompt: "{prompt}, fantasy matte painting, detailed matte painting, superb composition, vivid fantasy art, breathtaking fantasy masterpiece"
  }, {
    value: "fantasy-portrait",
    label: "Fantasy Portrait",
    prompt: "{prompt}, d&d, fantasy, highly detailed, digital painting, artstation, sharp focus, fantasy character art, illustration, world-class masterpiece"
  }, {
    value: "studio-ghibli",
    label: "Studio Ghibli",
    prompt: "Studio Ghibli style artwork of {prompt}, Studio Ghibli style art film still, sharp, very detailed, high resolution, anime, classic Studio Ghibli style artwork"
  }, {
    value: "vintage-comic",
    label: "Vintage Comic",
    prompt: "comic book style art of {prompt}, drawing, 1940s, 1950s, hand-drawn, color, high resolution, best quality, closeup"
  }, {
    value: "franco-belgian-comic",
    label: "Franco-Belgian Comic",
    prompt: "franco-belgian color comic about {prompt}, bande dessinee, franco-belgian comic panel, masterpiece, intricate, detailed, best quality"
  }, {
    value: "tintin-comic",
    label: "Tintin Comic",
    prompt: "color comic panel in the style of Herge about {prompt}, tintin style, french comic panel, franco-belgian style, masterpiece"
  }, {
    value: "medieval",
    label: "Medieval",
    prompt: "medieval illuminated manuscript picture of {prompt}, medieval illuminated manuscript art, 16th century, detailed medieval masterpiece"
  }, {
    value: "pixel-art",
    label: "Pixel Art",
    prompt: "{prompt}, best pixel art, neo-geo graphical style, retro nostalgic masterpiece, 16-bit pixel art, 2D pixel art style, masterful dithering, beautiful palette"
  }, {
    value: "illustration",
    label: "Illustration",
    prompt: "breathtaking illustration of {prompt}, illustration, masterpiece, breathtaking illustration, impeccable attention to detail and composition"
  }, {
    value: "cute-illustration",
    label: "Cute Illustration",
    prompt: "A cute cartoon showing {prompt}, soft cute minimalist webcomic-style illustration, clean lines, soft flat pastel colors, wholesome and endearing"
  }, {
    value: "flat-illustration",
    label: "Flat Illustration",
    prompt: "{prompt}, illustration, flat, 2D, vector art, masterpiece, crisp lines, minimal flat design"
  }, {
    value: "watercolor",
    label: "Watercolor",
    prompt: "{prompt}, watercolor, high resolution, intricate details, concept art, watercolor on textured paper"
  }, {
    value: "vintage-pulp-art",
    label: "Vintage Pulp Art",
    prompt: "1970s vintage pulp art, {prompt}, glossy pulp art, Amazing Stories, Weird Tales, high resolution, best quality"
  }, {
    value: "fantasy-world-map",
    label: "Fantasy World Map",
    prompt: "beautiful fantasy map of {prompt}, high-resolution artistic map, topographic terrain, crisp, beautiful colors"
  }, {
    value: "fantasy-city-map",
    label: "Fantasy City Map",
    prompt: "an aerial view of a city, TTRPG city map showing the full city, {prompt}, fantasy art, beautiful fantasy map"
  }, {
    value: "3d-isometric-icon",
    label: "3D Isometric Icon",
    prompt: "{prompt}, 3D isometric render, 3D app icon, clean isometric design, centered, soft smooth lighting, square image"
  }, {
    value: "tattoo-design",
    label: "Tattoo Design",
    prompt: "amazing tattoo design, {prompt}, breathtaking tattoo design, incredible tattoo design"
  }, {
    value: "waifu",
    label: "Waifu",
    prompt: "{prompt}, waifu character portrait, 1girl, very high resolution, semi-realistic anime art, intricate anime artwork, stunning composition"
  }, {
    value: "traditional-japanese",
    label: "Traditional Japanese",
    prompt: "{prompt}, ukiyo-e art style, traditional japanese masterpiece"
  }, {
    value: "claymation",
    label: "Claymation",
    prompt: "{prompt}, claymation, incredible claymation style, clay texture, stop-motion clay"
  }, {
    value: "cartoon",
    label: "Cartoon",
    prompt: "{prompt}, cartoon-style art, superb linework, nice colors and composition, bold linework, masterpiece, cute cartoon art style"
  }, {
    value: "cursed-photo",
    label: "Cursed Photo",
    prompt: "cursed photo of {prompt}, creepy and cursed, unsettling photo, bad photo, weird photo, nightmare fuel"
  }];
  const DEFAULT_VOICE_BLACKLIST = [
  // Tested macOS voices that are novelty, effect, child, or otherwise
  // unsuitable for normal narrator and character playback.
  "Samantha", "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Eddy (English (United States))", "Eddy (English (United Kingdom))", "Flo (English (United States))", "Flo (English (United Kingdom))", "Fred", "Good News", "Grandma (English (United States))", "Grandma (English (United Kingdom))", "Grandpa (English (United States))", "Grandpa (English (United Kingdom))", "Jester", "Junior", "Kathy", "Organ", "Ralph", "Reed (English (United States))", "Reed (English (United Kingdom))", "Rocko (English (United States))", "Rocko (English (United Kingdom))", "Sandy (English (United States))", "Sandy (English (United Kingdom))", "Shelley (English (United States))", "Shelley (English (United Kingdom))", "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox", "David", "Mark", "Zira", "Maisie Online", "Ana Online", "Ava Online", "William Online", "Tina Dragon HD Flash Latest Online", "Annette Online", "Carly Online", "Darren Online", "Duncan Online", "Elise Online", "Freya Online", "Joanne Online", "Ken Online", "Kim Online", "Neil Online", "Tim Online", "Tina Online", "Abbi Online", "Alfie Online", "Bella Online", "Elliot Online", "Ethan Online", "Hollie Online", "Noah Online", "Oliver Online", "Olivia Online", "Aarti Indic Online", "Arjun Indic Online", "Neerja Indic Online", "Prabhat Indic Online", "Aarav Online", "Aashi Online", "Aarti Online", "Arjun Online", "Ananya Online", "Kavya Online", "Kunal Online", "Rehaan Online", "Davis Online", "Jane Online", "Jason Online", "Kai Online", "Luna Online", "Sara Online", "Tony Online", "Nancy Online", "Amber Online", "Ashley Online", "Brandon Online", "Cora Online", "Elizabeth Online", "Jacob Online", "Monica Online", "Ada Multilingual Online", "Ollie Multilingual Online", "Amanda Multilingual Online", "Adam Multilingual Online", "Phoebe Multilingual Online", "Alloy Turbo Multilingual Online", "Echo Turbo Multilingual Online", "Fable Turbo Multilingual Online", "Onyx Turbo Multilingual Online", "Nova Turbo Multilingual Online", "Shimmer Turbo Multilingual Online", "Cora Multilingual Online", "Christopher Multilingual Online", "Brandon Multilingual Online", "Davis Multilingual Online", "Derek Multilingual Online", "Dustin Multilingual Online", "Evelyn Multilingual Online", "Jenny Multilingual Online", "Lewis Multilingual Online", "Lola Multilingual Online", "Nancy Multilingual Online", "Ryan Multilingual Online", "Samuel Multilingual Online", "Serena Multilingual Online", "Steffan Multilingual Online"];
  const DEFAULT_VOICE_GENDER_MAP = {
    "Daniel": "male",
    "Rishi": "male",
    "Google UK English Male": "male",
    "Karen": "female",
    "Moira": "female",
    "Tessa": "female",
    "Google US English": "female",
    "Google UK English Female": "female"
  };
  const LOCAL_CODEX_TEXT_MODELS = {
    "5.6 Sol": "gpt-5.6-sol",
    "5.6 Terra": "gpt-5.6-terra",
    "5.6 Luna": "gpt-5.6-luna",
    "5.5": "gpt-5.5",
    "5.4": "gpt-5.4",
    "5.4-Mini": "gpt-5.4-mini",
    "5.3-Codex-Spark": "gpt-5.3-codex-spark"
  };
  const defaultSettings = {
    devMode: true,
    logAi: false,
    logCommand: false,
    logImage: false,
    logPerformance: false,
    logState: false,
    logStorage: false,
    logStorageMinor: false,
    logSystem: false,
    logTroubleshooting: false,
    logVoice: false,
    autoVoice: true,
    autoReadPlayerMessages: true,
    readGameMessages: true,
    autoImages: true,
    showImagesInChat: true,
    showAiStatusMessages: true,
    showAffectionStats: true,
    showNonEnglishVoices: false,
    preferredCharacterGender: "",
    swapAllGendersToPreferred: false,
    storyPlayerSelectGender: "",
    reducedUi: true,
    characterLibraryCardSize: "large",
    characterLibraryColumnDensity: null,
    characterLibraryColumns: null,
    storyLibraryColumnDensity: null,
    storyLibraryColumns: null,
    aiMessageLength: "short",
    localCodexTextModel: "5.4-Mini",
    localCodexTextEffort: "light",
    localCodexTextUrl: "http://127.0.0.1:51820/api/text/generate",
    stateCheckMode: "groups",
    playerReadDisablePromptSeen: false,
    characterReadDisablePromptSeen: false,
    playerInputHelpSeen: false,
    betaNotesSeen: false,
    // Public-library publishing requires complete creator/source/creation_tool metadata before upload.
    // Future moderation-quality improvement: suggest canonical source-name matches before submit so
    // duplicate franchise/source names do not fragment public search results.
    publicLibraryIndexFileName: "emberadventures-lite-public-library-index.json",
    publicLibraryIndexUrl: "",
    publicLibrarySupabaseUrl: SUPABASE_PROJECT_URL,
    publicLibrarySupabaseAnonKey: SUPABASE_PUBLISHABLE_KEY,
    publicReportReplyEmails: [],
    publicLibraryCreationTools: ["ChatGPT", "Codex", "Perchance AI", "Claude", "Gemini", "Grok", "Manual / Human Written"],
    publicLibraryCreationToolCatalog: [{
      tool: "ChatGPT",
      models: ["GPT-5.2", "GPT-5.2 Pro", "GPT-5.2 ChatGPT", "GPT-5.1", "GPT-5", "GPT-4.1", "GPT-4o"],
      intelligenceLevels: ["Instant", "Thinking", "Pro", "Low", "Medium", "High", "XHigh"]
    }, {
      tool: "Codex",
      models: ["5.5", "5.4", "5.3", "5.2", "5.1", "5"],
      intelligenceLevels: ["Low", "Medium", "High", "XHigh"],
      labelPattern: "{tool} {model} ({intelligence})"
    }, {
      tool: "Claude",
      models: ["Opus 4.1", "Sonnet 4", "Sonnet 3.7", "Sonnet 3.5", "Haiku 3.5"],
      intelligenceLevels: []
    }, {
      tool: "Gemini",
      models: ["3 Pro Preview", "3 Flash Preview", "2.5 Flash", "2.5 Flash Image", "2.0 Flash"],
      intelligenceLevels: []
    }, {
      tool: "Grok",
      models: ["4.20", "4.1 Fast", "4"],
      intelligenceLevels: []
    }, {
      tool: "Perchance AI",
      models: ["Default", "Minimal"],
      intelligenceLevels: []
    }, {
      tool: "Manual / Human Written",
      models: [],
      intelligenceLevels: []
    }],
    voiceBlacklist: [...DEFAULT_VOICE_BLACKLIST],
    narratorVoiceName: "Ava Online",
    defaultMalePlayerVoiceName: "Andrew Online",
    defaultNonMalePlayerVoiceName: "Libby Online",
    voiceGenderMap: {
      ...DEFAULT_VOICE_GENDER_MAP
    },
    imageLabWarningAccepted: false,
    imageMode: "smart",
    imageModel: PERCHANCE_IMAGE_MODEL_DEFAULT,
    defaultProfileImageModel: PROFILE_IMAGE_MODEL_DEFAULT,
    imageHistoryLimit: 300,
    imageRequestTimeoutSeconds: 120,
    downloadOldImagesBeforeDelete: false,
    composerMode: "act",
    autoVisualNovel: false,
    autoModeType: "take_player_turns",
    autoModeCompletesObjectives: true,
    currentGameSaveId: "",
    storyGuidance: "",
    characterBoldnessOffset: 2,
    leftPanelGroup: "characters",
    leftPanelSections: {},
    leftPanelScroll: {}
  };
  const EMBERADVENTURES_DEBUG_ALL_LOGS = (() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get("debugAllLogs") === "1" || localStorage.getItem("emberadventures-lite-debug-all-logs") === "1";
    } catch {
      return false;
    }
  })();
  const EMBERADVENTURES_DEBUG_TEST_SCENARIO = (() => {
    try {
      return new URLSearchParams(location.search).get("debugScenario") || localStorage.getItem("emberadventures-lite-debug-scenario") || "";
    } catch {
      return "";
    }
  })();
  const LOG_SETTING_BY_TYPE = {
    ai: "logAi",
    command: "logCommand",
    image: "logImage",
    performance: "logPerformance",
    state: "logState",
    storage: "logStorage",
    storageMinor: "logStorageMinor",
    system: "logSystem",
    troubleshooting: "logTroubleshooting",
    voice: "logVoice"
  };
  const LOG_SETTING_IDS = Object.values(LOG_SETTING_BY_TYPE);
  const DEV_TRACE_LIMIT = 1000;
  const DEV_TRACE_ARCHIVE_BATCH_SIZE = 20;
  const DEV_TRACE_ARCHIVE_FLUSH_DELAY_MS = 250;
  let devTraceArchivePendingEntries = [];
  let devTraceArchiveFlushTimer = 0;
  let devTraceArchiveInitialized = false;
  let devTraceArchiveStartupPromise = null;
  let devTraceArchiveOperation = Promise.resolve();
  let devTraceArchiveFailure = null;
  const EMBERADVENTURES_DEBUG_TEST_RUN_ID = String(Date.now());
  const clone = obj => JSON.parse(JSON.stringify(obj));
  
