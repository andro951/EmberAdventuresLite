"use strict";

importScripts("./schema-contract.js");
const Schema = self.EmberStorageSchema;
const NoResponse = Symbol("no-response");
const queuesBySaveId = new Map();
const committedFingerprintsBySaveId = new Map();
const transactionChunksByRequestId = new Map();
const saveCreationChunksByRequestId = new Map();
const snapshotCaptureStateBySaveId = new Map();
let databasePromise = null;
let activeSaveId = null;
let activeQueue = null;
let pendingActivation = null;
let healthIntervalId = null;
let currentPhase = "idle";
let currentChangeId = null;
let fault = null;
let activeSaveLockRelease = null;
let activeSaveLockName = null;

//#region Messaging And Health

function postMessageToController(message) {
  self.postMessage(message);
}
function postResponse(requestId, value) {
  postMessageToController({
    type: "response",
    requestId,
    ok: true,
    value
  });
}
function postFailure(requestId, error) {
  postMessageToController({
    type: "response",
    requestId,
    ok: false,
    error: {
      name: error?.name || "Error",
      message: error?.message || String(error)
    }
  });
}
function activePendingCount() {
  return activeQueue?.pendingByChangeId.size || 0;
}
function postHealth() {
  postMessageToController({
    type: "persistence.health",
    activeSaveId,
    activeSessionNumber: activeQueue?.sesNum ?? null,
    committedChangeId: activeQueue?.comId ?? null,
    currentChangeId,
    phase: currentPhase,
    pendingCount: activePendingCount(),
    at: Date.now()
  });
}
function setPhase(phase, changeId = currentChangeId) {
  currentPhase = phase;
  currentChangeId = changeId;
  postHealth();
}
function startHealth() {
  if (healthIntervalId != null) return;
  healthIntervalId = setInterval(postHealth, 1000);
}
function stopHealthIfIdle() {
  if (currentPhase !== "idle" || activePendingCount() > 0 || pendingActivation != null) return;
  clearInterval(healthIntervalId);
  healthIntervalId = null;
}

//#endregion Messaging And Health

//#region IndexedDB Setup

function indexedDbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}
function indexedDbTransactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => {};
  });
}
function createDatabaseSchema(database) {
  for (const [storeName, storeSchema] of Object.entries(Schema.stores)) {
    const options = {
      keyPath: storeSchema.keyPath,
      autoIncrement: storeSchema.autoIncrement
    };
    let objectStore;
    try {
      objectStore = database.createObjectStore(storeName, options);
    } catch (error) {
      throw new Error(`Could not create object store ${storeName}: ${error.message}`);
    }
    for (const indexSchema of storeSchema.indexes) {
      try {
        objectStore.createIndex(indexSchema.name, indexSchema.keyPath, {
          unique: indexSchema.unique,
          multiEntry: indexSchema.multiEntry
        });
      } catch (error) {
        throw new Error(`Could not create index ${storeName}.${indexSchema.name}: ${error.message}`);
      }
    }
  }
}
function verifyDatabaseSchema(database) {
  const expectedStoreNames = Object.keys(Schema.stores).sort();
  const actualStoreNames = Array.from(database.objectStoreNames).sort();
  if (JSON.stringify(expectedStoreNames) !== JSON.stringify(actualStoreNames)) throw new Error("IndexedDB object stores do not match the generated schema contract.");
  const transaction = database.transaction(expectedStoreNames, "readonly");
  for (const storeName of expectedStoreNames) {
    const store = transaction.objectStore(storeName);
    const expectedIndexes = Schema.stores[storeName].indexes.map(index => index.name).sort();
    const actualIndexes = Array.from(store.indexNames).sort();
    if (JSON.stringify(expectedIndexes) !== JSON.stringify(actualIndexes)) throw new Error(`IndexedDB indexes do not match the contract for ${storeName}.`);
  }
}
function openDatabase() {
  if (databasePromise != null) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(Schema.databaseName, Schema.version);
    request.onupgradeneeded = event => {
      const database = request.result;
      if (event.oldVersion !== 0) throw new Error("This diagnostic backend has no migration or backward-compatibility path.");
      createDatabaseSchema(database);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      try {
        verifyDatabaseSchema(database);
        resolve(database);
      } catch (error) {
        database.close();
        reject(error);
      }
    };
    request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
    request.onblocked = () => reject(new Error("IndexedDB open was blocked by another page."));
  });
  databasePromise.catch(() => databasePromise = null);
  return databasePromise;
}
function resetDatabase() {
  const closePromise = databasePromise == null ? Promise.resolve() : databasePromise.then(database => database.close(), () => {});
  return closePromise.then(() => {
    databasePromise = null;
    activeSaveId = null;
    activeQueue = null;
    releaseSaveLock();
    pendingActivation = null;
    queuesBySaveId.clear();
    committedFingerprintsBySaveId.clear();
    snapshotCaptureStateBySaveId.clear();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(Schema.databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not delete diagnostic database."));
      request.onblocked = () => reject(new Error("Database deletion was blocked by another page."));
    });
  });
}

//#endregion IndexedDB Setup

//#region Record Validation

function exactPositiveSafeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${path} must be a positive safe integer.`);
  return value;
}
function exactIntegerInRange(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${path} must be a safe integer from ${minimum} through ${maximum}.`);
  return value;
}
function exactNonblankText(value, path) {
  if (typeof value !== "string" || !value || value !== value.trim()) throw new Error(`${path} must be nonblank text without leading or trailing whitespace.`);
  return value;
}
function keyPathFields(keyPath) {
  return Array.isArray(keyPath) ? keyPath : [keyPath];
}
function recordKey(storeName, record) {
  const fields = keyPathFields(Schema.stores[storeName].keyPath);
  const values = fields.map(field => record[field]);
  return Array.isArray(Schema.stores[storeName].keyPath) ? values : values[0];
}
function isValidKeyPart(value) {
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (Array.isArray(value)) return value.length > 0 && value.every(isValidKeyPart);
  return false;
}
function validateStoreName(storeName) {
  if (!Object.prototype.hasOwnProperty.call(Schema.stores, storeName)) throw new Error(`Unknown object store: ${storeName}.`);
}
function assertNoSessionBlobUrls(value, path = "record", seen = new WeakSet()) {
  if (typeof value === "string") {
    if (/blob:https?:\/\//i.test(value)) throw new Error(`${path} contains a temporary browser blob URL. Persist the image in assetBlobs instead.`);
    return;
  }
  if (value == null || typeof value !== "object" || value instanceof Blob || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) assertNoSessionBlobUrls(value[index], `${path}.${index}`, seen);
    return;
  }
  for (const [field, item] of Object.entries(value)) assertNoSessionBlobUrls(item, `${path}.${field}`, seen);
}
function scalarTypeOptions(typeSpec) {
  return typeSpec.replace(/\s+FK/g, "").split(/[|/]/).map(value => value.trim()).filter(Boolean);
}
function validateFieldType(storeName, fieldName, fieldSchema, value) {
  if (fieldSchema.kind === "array") {
    if (!Array.isArray(value)) throw new Error(`${storeName}.${fieldName} must be an array.`);
    return;
  }
  if (fieldSchema.kind === "object") {
    if (value == null || typeof value !== "object" || Array.isArray(value) || value instanceof Blob) throw new Error(`${storeName}.${fieldName} must be an object.`);
    return;
  }
  const typeSpec = fieldSchema.typeSpec || "bounded value";
  const options = scalarTypeOptions(typeSpec);
  if (typeSpec === "clothing slot | hand | null") {
    const validSlots = new Set(["hat", "hairAccessory", "face", "ears", "neck", "shoulders", "bra", "undershirt", "shirt", "overShirt", "coat", "back", "hands", "rightWrist", "leftWrist", "rightFingers", "leftFingers", "waist", "beltAccessory", "underwear", "pants", "skirt", "legwear", "socks", "feet", "otherAccessory", "hand"]);
    if (value != null && !validSlots.has(value)) throw new Error(`${storeName}.${fieldName} must be a clothing slot, hand, or null.`);
    return;
  }
  if (value == null) {
    if (options.includes("null") || /\/null|\|null/.test(typeSpec)) return;
    throw new Error(`${storeName}.${fieldName} may not be null.`);
  }
  if (typeSpec === "Blob") {
    if (!(value instanceof Blob)) throw new Error(`${storeName}.${fieldName} must be a Blob.`);
    return;
  }
  if (/^(structured|bounded)/.test(typeSpec)) {
    if (typeof value === "function" || typeof value === "symbol") throw new Error(`${storeName}.${fieldName} must be structured-clone compatible.`);
    return;
  }
  const primitiveOptions = options.filter(option => ["string", "number", "integer", "boolean"].includes(option));
  const enumOptions = options.filter(option => !["string", "number", "integer", "boolean", "null"].includes(option));
  const primitiveMatches = primitiveOptions.some(option => {
    if (option === "integer") return Number.isInteger(value);
    return typeof value === option && (option !== "number" || Number.isFinite(value));
  });
  if (primitiveOptions.length > 0 && !primitiveMatches) throw new Error(`${storeName}.${fieldName} must match ${typeSpec}.`);
  if (primitiveOptions.length === 0 && enumOptions.length > 0 && (typeof value !== "string" || !enumOptions.includes(value))) throw new Error(`${storeName}.${fieldName} must be one of: ${enumOptions.join(", ")}.`);
  if (typeof value === "number" && typeof fieldSchema.description === "string") {
    const rangeMatch = fieldSchema.description.match(/from\s+(-?\d+(?:\.\d+)?)\s+through\s+(-?\d+(?:\.\d+)?)/i);
    if (rangeMatch != null && (value < Number(rangeMatch[1]) || value > Number(rangeMatch[2]))) throw new Error(`${storeName}.${fieldName} must be from ${rangeMatch[1]} through ${rangeMatch[2]}.`);
  }
}
function validateRecord(storeName, record, expectedSaveId = null) {
  validateStoreName(storeName);
  if (record == null || typeof record !== "object" || Array.isArray(record)) throw new Error(`${storeName} record must be a plain object.`);
  assertNoSessionBlobUrls(record, storeName);
  const storeSchema = Schema.stores[storeName];
  const autoIncrementField = storeSchema.autoIncrement ? keyPathFields(storeSchema.keyPath)[0] : null;
  for (const fieldName of Object.keys(record)) {
    if (!Object.prototype.hasOwnProperty.call(storeSchema.fields, fieldName)) throw new Error(`${storeName}.${fieldName} is not defined by the storage contract.`);
  }
  for (const [fieldName, fieldSchema] of Object.entries(storeSchema.fields)) {
    if (fieldName === autoIncrementField && !Object.prototype.hasOwnProperty.call(record, fieldName)) continue;
    if (fieldSchema.required && !Object.prototype.hasOwnProperty.call(record, fieldName)) throw new Error(`${storeName}.${fieldName} is required.`);
    if (Object.prototype.hasOwnProperty.call(record, fieldName)) validateFieldType(storeName, fieldName, fieldSchema, record[fieldName]);
  }
  if (expectedSaveId != null && Object.prototype.hasOwnProperty.call(storeSchema.fields, "saveId") && record.saveId !== expectedSaveId) throw new Error(`${storeName}.saveId must match transaction saveId ${expectedSaveId}.`);
  if (!storeSchema.autoIncrement || Object.prototype.hasOwnProperty.call(record, keyPathFields(storeSchema.keyPath)[0])) {
    const key = recordKey(storeName, record);
    if (!isValidKeyPart(key)) throw new Error(`${storeName} has an invalid IndexedDB primary key.`);
  }
  const serializedRecord = JSON.stringify(record);
  if (serializedRecord.length > 262144) throw new Error(`${storeName} record exceeds the 262144-byte bounded-record limit.`);
  if (serializedRecord.length > 16384) {
    postMessageToController({
      type: "persistence.warning",
      warning: "large-record",
      storeName,
      serializedBytes: serializedRecord.length
    });
  }
  if (Object.prototype.hasOwnProperty.call(storeSchema.fields, "saveId") && containsEmbeddedImageData(record)) throw new Error(`${storeName} save-owned records may not contain embedded image data.`);
}
function containsEmbeddedImageData(value) {
  if (typeof value === "string") return /^data:image\//i.test(value);
  if (Array.isArray(value)) return value.some(containsEmbeddedImageData);
  if (value == null || typeof value !== "object" || value instanceof Blob) return false;
  return Object.values(value).some(containsEmbeddedImageData);
}
function validateDiagnosticStoreAccess(storeName) {
  validateStoreName(storeName);
  if (["save", "state", "characters", "objectives", "images"].includes(storeName)) throw new Error(`Whole-save persistence is forbidden: ${storeName}.`);
}

//#endregion Record Validation

//#region Domain Conversion

function convertDomainOperation(saveId, operation, diagnostic) {
  EmberPersistenceDomainOperationContract.assertExact(operation);
  switch (operation.type) {
    case "runtime.records.replace":
      {
        const allowedStores = new Set(["sceneImageTargets", "worldValues", "runtimeLocationDefinitions", "locationRuntime", "locationConnections", "timedEventRuntime", "timedEventAppliedStages", "storyMemoryNotes", "recentChanges", "storyRuleAdds", "storyRuleRemovals", "pendingObjectiveRouteChoices", "pendingObjectiveRouteOptions", "objectiveRuntime", "objectiveProgressNotes", "objectiveExclusiveGroupChoices", "pendingRewardChoices", "pendingRewardChoiceOptions", "futureCharacters", "npcShells", "generatedNpcPoolEntries", "shopRuntime", "shopItemRuntime", "runtimeJobDefinitions", "generatedJobRuntime", "generatedJobProgressValues", "generatedJobCompletedSteps", "storyJobOffers"]);
        const storeName = exactNonblankText(operation.storeName, "runtime.records.replace.storeName");
        if (!allowedStores.has(storeName)) throw new Error(`runtime.records.replace cannot write ${storeName || "(missing store)"}.`);
        if (!Array.isArray(operation.records)) throw new Error("runtime.records.replace requires a records array.");
        if (operation.match != null && (typeof operation.match !== "object" || Array.isArray(operation.match))) throw new Error("runtime.records.replace match must be an object.");
        return [{
          action: "replace-save-records",
          storeName,
          match: {
            ...(operation.match || {})
          },
          records: operation.records.map(record => ({
            ...record,
            saveId
          }))
        }];
      }
    case "snapshot.begin":
      return [{
        action: "add",
        storeName: "snapshots",
        record: {
          ...operation.snapshot,
          saveId
        }
      }, {
        action: "trim-snapshots",
        keep: 24
      }];
    case "snapshot.rollback":
      return [{
        action: "rollback-snapshot",
        snapshotId: operation.snapshotId
      }];
    case "snapshot.commit":
      return [{
        action: "commit-snapshot",
        snapshotId: operation.snapshotId,
        completedAt: operation.completedAt
      }];
    case "snapshot.delete":
      return [{
        action: "delete-snapshot",
        snapshotId: operation.snapshotId
      }];
    case "message.add":
      return [{
        action: "add",
        storeName: "messages",
        record: {
          ...operation.message,
          saveId
        }
      }];
    case "message.put":
      return [{
        action: "put",
        storeName: "messages",
        record: {
          ...operation.message,
          saveId
        }
      }];
    case "message.delete":
      return [{
        action: "delete",
        storeName: "messages",
        key: [saveId, operation.messageId]
      }];
    case "character.relationship.set":
      return [{
        action: "merge",
        storeName: "characterRelationshipStats",
        key: [saveId, operation.characterId],
        values: operation.values
      }];
    case "character.scene.set":
      return [{
        action: "merge",
        storeName: "characterSceneState",
        key: [saveId, operation.characterId],
        values: operation.values
      }];
    case "character.durable.set":
      return [{
        action: "merge",
        storeName: "characterDurableState",
        key: [saveId, operation.characterId],
        values: operation.values
      }];
    case "character.stat.set":
      return [{
        action: "put",
        storeName: "characterStats",
        record: {
          saveId,
          characterId: operation.characterId,
          statId: operation.statId,
          value: operation.value
        }
      }];
    case "character.materialize":
      {
        const allowedStores = new Set(["saveCharacterDefinitions", "characterAppearance", "characterSettings", "characterDurableState", "characterRelationshipStats", "characterStats", "characterFacts", "characterSceneState", "items", "characterOutfits", "equippedItems", "temporaryRemovedItems", "npcShells"]);
        if (!Array.isArray(operation.records) || !operation.records.length) throw new Error("character.materialize requires normalized records.");
        return operation.records.map(entry => {
          if (!allowedStores.has(entry?.storeName)) throw new Error(`character.materialize cannot write ${entry?.storeName || "(missing store)"}.`);
          return {
            action: "add",
            storeName: entry.storeName,
            record: {
              ...entry.record,
              saveId
            }
          };
        });
      }
    case "character.replace":
      {
        const allowedStores = new Set(["saveCharacterDefinitions", "characterAppearance", "characterSettings", "characterDurableState", "characterRelationshipStats", "characterStats", "characterFacts", "characterSceneState", "items", "characterOutfits", "equippedItems", "temporaryRemovedItems", "npcShells"]);
        if (!Array.isArray(operation.records) || !operation.records.length) throw new Error("character.replace requires normalized records.");
        const records = operation.records.map(entry => {
          if (!allowedStores.has(entry?.storeName)) throw new Error(`character.replace cannot write ${entry?.storeName || "(missing store)"}.`);
          return {
            storeName: entry.storeName,
            record: {
              ...entry.record,
              saveId
            }
          };
        });
        return [{
          action: "replace-character",
          characterId: operation.characterId,
          records,
          storeNames: [...allowedStores]
        }];
      }
    case "character.delete":
      return [{
        action: "delete-character",
        characterId: operation.characterId
      }];
    case "character.fact.add":
      return [{
        action: "add",
        storeName: "characterFacts",
        record: {
          ...operation.fact,
          saveId
        }
      }];
    case "character.fact.remove":
      return [{
        action: "delete",
        storeName: "characterFacts",
        key: [saveId, operation.characterId, operation.factId]
      }];
    case "temporary.speaker.put":
      return [{
        action: "put",
        storeName: "temporarySpeakers",
        record: {
          ...operation.speaker,
          saveId
        }
      }];
    case "objective.runtime.set":
      return [{
        action: "upsert-sparse",
        storeName: "objectiveRuntime",
        key: [saveId, operation.objectiveId],
        baseRecord: {
          saveId,
          objectiveId: operation.objectiveId
        },
        values: operation.values
      }];
    case "objective.control.set":
      return [{
        action: "merge",
        storeName: "objectiveControl",
        key: saveId,
        values: operation.values
      }];
    case "objective.progress.add":
      return [{
        action: "add",
        storeName: "objectiveProgressNotes",
        record: {
          ...operation.note,
          saveId
        }
      }];
    case "reward.invocation.add":
      return [{
        action: "add",
        storeName: "rewardInvocations",
        record: {
          ...operation.invocation,
          saveId
        }
      }];
    case "story.rule.add":
      return [{
        action: "put",
        storeName: "storyRuleAdds",
        record: {
          ...operation.rule,
          saveId
        }
      }];
    case "story.rule.remove":
      return [{
        action: "delete",
        storeName: "storyRuleAdds",
        key: [saveId, operation.ruleId]
      }, {
        action: "put",
        storeName: "storyRuleRemovals",
        record: {
          saveId,
          ruleId: operation.ruleId
        }
      }];
    case "story.value.set":
      return [{
        action: "put",
        storeName: "storyValues",
        record: {
          ...operation.record,
          saveId
        }
      }];
    case "story.value.delete":
      return [{
        action: "delete",
        storeName: "storyValues",
        key: [saveId, operation.root, operation.pathKey]
      }];
    case "story.root.replace":
      return [{
        action: "replace-story-root",
        root: exactNonblankText(operation.root, "story.root.replace.root"),
        value: operation.value
      }];
    case "story.list.add":
      return [{
        action: "put",
        storeName: "storyListItems",
        record: {
          ...operation.record,
          saveId
        }
      }];
    case "story.list.remove":
      return [{
        action: "delete",
        storeName: "storyListItems",
        key: [saveId, operation.root, operation.listPathKey, operation.itemKey]
      }];
    case "scene.member.add":
      return [{
        action: "put",
        storeName: "sceneMembers",
        record: {
          saveId,
          characterId: operation.characterId
        }
      }];
    case "scene.member.remove":
      return [{
        action: "delete",
        storeName: "sceneMembers",
        key: [saveId, operation.characterId]
      }];
    case "party.member.add":
      return [{
        action: "put",
        storeName: "partyMembers",
        record: {
          saveId,
          characterId: operation.characterId
        }
      }];
    case "party.member.remove":
      return [{
        action: "delete",
        storeName: "partyMembers",
        key: [saveId, operation.characterId]
      }];
    case "future.character.set":
      return [{
        action: "upsert-sparse",
        storeName: "futureCharacters",
        key: [saveId, operation.characterId],
        baseRecord: {
          saveId,
          characterId: operation.characterId
        },
        values: operation.values
      }];
    case "npc.shell.set":
      return [{
        action: "merge",
        storeName: "npcShells",
        key: [saveId, operation.characterId],
        values: operation.values
      }];
    case "npc.shell.put":
      return [{
        action: "put",
        storeName: "npcShells",
        record: {
          ...operation.shell,
          saveId
        }
      }];
    case "npc.shell.delete":
      return [{
        action: "delete",
        storeName: "npcShells",
        key: [saveId, operation.characterId]
      }];
    case "scene.runtime.set":
      return [{
        action: "merge",
        storeName: "sceneRuntime",
        key: saveId,
        values: operation.values
      }];
    case "location.current.set":
      return [{
        action: "put",
        storeName: "currentLocation",
        record: {
          saveId,
          locationId: operation.locationId
        }
      }];
    case "location.runtime.set":
      return [{
        action: "merge",
        storeName: "locationRuntime",
        key: [saveId, operation.locationId],
        values: operation.values
      }];
    case "location.runtime.put":
      return [{
        action: "put",
        storeName: "locationRuntime",
        record: {
          saveId,
          locationId: operation.locationId,
          ...operation.values
        }
      }];
    case "location.runtime.delete":
      return [{
        action: "delete",
        storeName: "locationRuntime",
        key: [saveId, operation.locationId]
      }];
    case "location.definition.put":
      return [{
        action: "put",
        storeName: "runtimeLocationDefinitions",
        record: {
          ...operation.location,
          saveId
        }
      }];
    case "location.definition.delete":
      return [{
        action: "delete",
        storeName: "runtimeLocationDefinitions",
        key: [saveId, operation.locationId]
      }];
    case "location.connection.set":
      return [{
        action: "put",
        storeName: "locationConnections",
        record: {
          saveId,
          fromLocationId: operation.fromLocationId,
          toLocationId: operation.toLocationId,
          present: operation.present === true
        }
      }];
    case "time.set":
      return [{
        action: "merge",
        storeName: "gameTime",
        key: saveId,
        values: operation.values
      }];
    case "timed.event.set":
      return [{
        action: "merge",
        storeName: "timedEventRuntime",
        key: [saveId, operation.timedEventId],
        values: operation.values
      }];
    case "timed.stage.add":
      return [{
        action: "put",
        storeName: "timedEventAppliedStages",
        record: {
          saveId,
          timedEventId: operation.timedEventId,
          stageId: operation.stageId
        }
      }];
    case "item.put":
      return [{
        action: "put",
        storeName: "items",
        record: {
          ...operation.item,
          saveId
        }
      }];
    case "item.delete":
      return [{
        action: "delete",
        storeName: "items",
        key: [saveId, operation.itemId]
      }];
    case "equipment.set":
      return [{
        action: "put",
        storeName: "equippedItems",
        record: {
          ...operation.record,
          saveId
        }
      }];
    case "temporary.items.set":
      return [{
        action: "put",
        storeName: "temporaryRemovedItems",
        record: {
          ...operation.record,
          saveId
        }
      }];
    case "outfit.put":
      return [{
        action: "put",
        storeName: "characterOutfits",
        record: {
          ...operation.outfit,
          saveId
        }
      }];
    case "outfit.delete":
      return [{
        action: "delete",
        storeName: "characterOutfits",
        key: [saveId, operation.characterId, operation.outfitId]
      }];
    case "shop.runtime.set":
      return [{
        action: "merge",
        storeName: "shopRuntime",
        key: [saveId, operation.shopId],
        values: operation.values
      }];
    case "shop.item.set":
      return [{
        action: "upsert-sparse",
        storeName: "shopItemRuntime",
        key: [saveId, operation.shopId, operation.itemId],
        baseRecord: {
          saveId,
          shopId: operation.shopId,
          itemId: operation.itemId
        },
        values: operation.values
      }];
    case "job.definition.add":
      return [{
        action: "add",
        storeName: "runtimeJobDefinitions",
        record: {
          ...operation.job,
          saveId
        }
      }];
    case "job.runtime.set":
      return [{
        action: "upsert-sparse",
        storeName: "generatedJobRuntime",
        key: [saveId, operation.jobId],
        baseRecord: {
          saveId,
          jobId: operation.jobId
        },
        values: operation.values
      }];
    case "job.progress.set":
      return [{
        action: "put",
        storeName: "generatedJobProgressValues",
        record: {
          saveId,
          jobId: operation.jobId,
          pathKey: operation.pathKey,
          value: operation.value
        }
      }];
    case "job.step.complete":
      return [{
        action: "put",
        storeName: "generatedJobCompletedSteps",
        record: {
          saveId,
          jobId: operation.jobId,
          stepId: operation.stepId
        }
      }];
    case "job.offer.put":
      return [{
        action: "put",
        storeName: "storyJobOffers",
        record: {
          ...operation.offer,
          saveId
        }
      }];
    case "save.header.set":
      return [{
        action: "merge",
        storeName: "saveHeaders",
        key: saveId,
        values: operation.values
      }];
    case "story.image.put":
      return [{
        action: "put",
        storeName: "storyImages",
        record: {
          ...operation.image,
          saveId
        }
      }];
    case "story.image.delete":
      return [{
        action: "delete",
        storeName: "storyImages",
        key: [saveId, operation.imageId]
      }];
    case "story.image.target.put":
      return [{
        action: "put",
        storeName: "storyImageTargets",
        record: {
          saveId,
          imageId: operation.imageId,
          characterId: operation.characterId
        }
      }];
    case "story.image.target.delete":
      return [{
        action: "delete",
        storeName: "storyImageTargets",
        key: [saveId, operation.imageId, operation.characterId]
      }];
    case "image.asset.put":
      return [{
        action: "put",
        storeName: "assetBlobs",
        record: operation.asset
      }];
    case "image.asset.delete":
      return [{
        action: "delete",
        storeName: "assetBlobs",
        key: operation.imageId
      }];
    case "character.settings.set":
      return [{
        action: "merge",
        storeName: "characterSettings",
        key: [saveId, operation.characterId],
        values: operation.values
      }];
    case "save.session.close":
      return [{
        action: "close-session"
      }];
    case "diagnostic.record.add":
    case "diagnostic.record.put":
    case "diagnostic.record.delete":
      {
        if (!diagnostic) throw new Error(`${operation.type} is restricted to the diagnostic harness.`);
        validateDiagnosticStoreAccess(operation.storeName);
        if (operation.type === "diagnostic.record.delete") return [{
          action: "delete",
          storeName: operation.storeName,
          key: operation.key
        }];
        const diagnosticRecord = {
          ...operation.record
        };
        if (Object.prototype.hasOwnProperty.call(Schema.stores[operation.storeName].fields, "saveId")) diagnosticRecord.saveId = diagnosticRecord.saveId ?? saveId;
        return [{
          action: operation.type.endsWith("add") ? "add" : "put",
          storeName: operation.storeName,
          record: diagnosticRecord
        }];
      }
    default:
      throw new Error(`Unsupported domain operation: ${operation.type}.`);
  }
}
function comparableKey(storeName, key) {
  return `${storeName}:${JSON.stringify(key)}`;
}
async function snapshotCaptureState(database, saveId, snapshotId) {
  const cached = snapshotCaptureStateBySaveId.get(saveId);
  if (cached?.snapshotId === snapshotId) return cached;
  const transaction = database.transaction("snapshotReverseOperations", "readonly");
  const records = await indexedDbRequest(transaction.objectStore("snapshotReverseOperations").index("bySave").getAll(IDBKeyRange.only(saveId)));
  const matching = records.filter(record => record.snapshotId === snapshotId);
  const state = {
    snapshotId,
    nextOperationIndex: matching.reduce((maximum, record) => Math.max(maximum, record.operationIndex), 0) + 1,
    capturedKeys: new Set(matching.map(record => comparableKey(record.targetStore, record.targetKey)))
  };
  snapshotCaptureStateBySaveId.set(saveId, state);
  return state;
}
async function captureSnapshotReverseOperations(database, envelope, recordOperations) {
  const snapshotId = envelope.snapshotId;
  if (snapshotId === undefined) return recordOperations;
  exactNonblankText(snapshotId, "transaction.snapshotId");
  const state = await snapshotCaptureState(database, envelope.saveId, snapshotId);
  const candidates = [];
  for (const operation of recordOperations) {
    if (!operation.storeName || ["snapshots", "snapshotRelatedMessages", "snapshotReverseOperations", "assetBlobs"].includes(operation.storeName)) continue;
    const key = operation.key ?? recordKey(operation.storeName, operation.record);
    const comparable = comparableKey(operation.storeName, key);
    if (state.capturedKeys.has(comparable)) continue;
    state.capturedKeys.add(comparable);
    candidates.push({
      operation,
      key
    });
  }
  if (!candidates.length) return recordOperations;
  const storeNames = Array.from(new Set(candidates.map(candidate => candidate.operation.storeName)));
  const transaction = database.transaction(storeNames, "readonly");
  const priorRecords = await Promise.all(candidates.map(candidate => indexedDbRequest(transaction.objectStore(candidate.operation.storeName).get(candidate.key))));
  const captured = [];
  candidates.forEach((candidate, index) => {
    const previousRecord = priorRecords[index];
    const reverse = {
      saveId: envelope.saveId,
      snapshotId,
      operationIndex: state.nextOperationIndex++,
      targetStore: candidate.operation.storeName,
      targetKey: candidate.key,
      operation: previousRecord == null ? "delete" : "put"
    };
    if (previousRecord != null) reverse.previousRecord = previousRecord;
    captured.push({
      action: "put",
      storeName: "snapshotReverseOperations",
      record: reverse
    });
    if (candidate.operation.storeName === "messages" && candidate.operation.action === "add") {
      captured.push({
        action: "put",
        storeName: "snapshotRelatedMessages",
        record: {
          saveId: envelope.saveId,
          snapshotId,
          messageId: candidate.operation.record.messageId
        }
      });
    }
  });
  return [...recordOperations, ...captured];
}
async function expandSnapshotRollback(database, saveId, recordOperations) {
  const rollback = recordOperations.find(operation => operation.action === "rollback-snapshot");
  if (!rollback) return recordOperations;
  if (recordOperations.length !== 1) throw new Error("snapshot.rollback must be the only operation in its transaction.");
  const snapshotId = exactNonblankText(rollback.snapshotId, "snapshot.rollback.snapshotId");
  const transaction = database.transaction(["snapshots", "snapshotRelatedMessages", "snapshotReverseOperations"], "readonly");
  const [snapshot, related, reverse] = await Promise.all([indexedDbRequest(transaction.objectStore("snapshots").get([saveId, snapshotId])), indexedDbRequest(transaction.objectStore("snapshotRelatedMessages").index("bySave").getAll(IDBKeyRange.only(saveId))), indexedDbRequest(transaction.objectStore("snapshotReverseOperations").index("bySave").getAll(IDBKeyRange.only(saveId)))]);
  if (!snapshot) throw new Error(`Snapshot ${snapshotId} does not exist for save ${saveId}.`);
  const matchingRelated = related.filter(record => record.snapshotId === snapshotId);
  const matchingReverse = reverse.filter(record => record.snapshotId === snapshotId).sort((left, right) => right.operationIndex - left.operationIndex);
  const expanded = matchingReverse.map(record => record.operation === "put" ? {
    action: "put",
    storeName: record.targetStore,
    record: record.previousRecord
  } : {
    action: "delete",
    storeName: record.targetStore,
    key: record.targetKey
  });
  expanded.push(...matchingRelated.map(record => ({
    action: "delete",
    storeName: "snapshotRelatedMessages",
    key: [saveId, snapshotId, record.messageId]
  })));
  expanded.push(...matchingReverse.map(record => ({
    action: "delete",
    storeName: "snapshotReverseOperations",
    key: [saveId, snapshotId, record.operationIndex]
  })));
  expanded.push({
    action: "delete",
    storeName: "snapshots",
    key: [saveId, snapshotId]
  });
  snapshotCaptureStateBySaveId.delete(saveId);
  return expanded;
}
async function expandSnapshotCommit(database, saveId, recordOperations) {
  const commit = recordOperations.find(operation => operation.action === "commit-snapshot");
  if (!commit) return recordOperations;
  if (recordOperations.length !== 1) throw new Error("snapshot.commit must be the only operation in its transaction.");
  const snapshotId = exactNonblankText(commit.snapshotId, "snapshot.commit.snapshotId");
  const completedAt = exactNonblankText(commit.completedAt, "snapshot.commit.completedAt");
  const transaction = database.transaction("snapshots", "readonly");
  const snapshot = await indexedDbRequest(transaction.objectStore("snapshots").get([saveId, snapshotId]));
  if (!snapshot) throw new Error(`Snapshot ${snapshotId} does not exist for save ${saveId}.`);
  return [{
    action: "put",
    storeName: "snapshots",
    record: {
      ...snapshot,
      completedAt
    }
  }];
}
async function expandSnapshotPruning(database, saveId, recordOperations) {
  const trim = recordOperations.find(operation => operation.action === "trim-snapshots");
  if (!trim) return recordOperations;
  const withoutTrim = recordOperations.filter(operation => operation !== trim);
  const transaction = database.transaction(["snapshots", "snapshotRelatedMessages", "snapshotReverseOperations"], "readonly");
  const [snapshots, related, reverse] = await Promise.all([indexedDbRequest(transaction.objectStore("snapshots").index("bySave").getAll(IDBKeyRange.only(saveId))), indexedDbRequest(transaction.objectStore("snapshotRelatedMessages").index("bySave").getAll(IDBKeyRange.only(saveId))), indexedDbRequest(transaction.objectStore("snapshotReverseOperations").index("bySave").getAll(IDBKeyRange.only(saveId)))]);
  const keep = exactPositiveSafeInteger(trim.keep, "snapshot retention count");
  const removeCount = Math.max(0, snapshots.length - keep + 1);
  const removedIds = new Set(snapshots.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))).slice(0, removeCount).map(snapshot => snapshot.snapshotId));
  if (!removedIds.size) return withoutTrim;
  withoutTrim.push(...related.filter(record => removedIds.has(record.snapshotId)).map(record => ({
    action: "delete",
    storeName: "snapshotRelatedMessages",
    key: [saveId, record.snapshotId, record.messageId]
  })));
  withoutTrim.push(...reverse.filter(record => removedIds.has(record.snapshotId)).map(record => ({
    action: "delete",
    storeName: "snapshotReverseOperations",
    key: [saveId, record.snapshotId, record.operationIndex]
  })));
  withoutTrim.push(...snapshots.filter(snapshot => removedIds.has(snapshot.snapshotId)).map(snapshot => ({
    action: "delete",
    storeName: "snapshots",
    key: [saveId, snapshot.snapshotId]
  })));
  return withoutTrim;
}
async function expandCharacterReplacements(database, saveId, recordOperations) {
  const replacements = recordOperations.filter(operation => operation.action === "replace-character");
  if (!replacements.length) return recordOperations;
  const expanded = recordOperations.filter(operation => operation.action !== "replace-character");
  for (const replacement of replacements) {
    const replacementKeys = new Set(replacement.records.map(entry => comparableKey(entry.storeName, recordKey(entry.storeName, entry.record))));
    for (const storeName of replacement.storeNames) {
      const transaction = database.transaction(storeName, "readonly");
      const existing = await indexedDbRequest(transaction.objectStore(storeName).index("bySave").getAll(IDBKeyRange.only(saveId)));
      for (const record of existing) {
        if (record.characterId !== replacement.characterId) continue;
        const key = recordKey(storeName, record);
        if (!replacementKeys.has(comparableKey(storeName, key))) expanded.push({
          action: "delete",
          storeName,
          key
        });
      }
    }
    expanded.push(...replacement.records.map(entry => ({
      action: "put",
      storeName: entry.storeName,
      record: entry.record
    })));
  }
  return expanded;
}
async function expandExplicitRecordDeletes(database, saveId, recordOperations) {
  const characterDeletes = recordOperations.filter(operation => operation.action === "delete-character");
  const snapshotDeletes = recordOperations.filter(operation => operation.action === "delete-snapshot");
  if (!characterDeletes.length && !snapshotDeletes.length) return recordOperations;
  const expanded = recordOperations.filter(operation => !["delete-character", "delete-snapshot"].includes(operation.action));
  const characterStores = ["saveCharacterDefinitions", "characterAppearance", "characterSettings", "characterDurableState", "characterRelationshipStats", "characterStats", "characterFacts", "characterSceneState", "items", "characterOutfits", "equippedItems", "temporaryRemovedItems", "npcShells", "partyMembers", "sceneMembers", "sceneImageTargets"];
  for (const operation of characterDeletes) {
    const characterId = exactNonblankText(operation.characterId, "character.delete.characterId");
    for (const storeName of characterStores) {
      const transaction = database.transaction(storeName, "readonly");
      const records = await indexedDbRequest(transaction.objectStore(storeName).index("bySave").getAll(IDBKeyRange.only(saveId)));
      for (const record of records) {
        if (record.characterId === characterId) expanded.push({
          action: "delete",
          storeName,
          key: recordKey(storeName, record)
        });
      }
    }
  }
  if (snapshotDeletes.length) {
    const transaction = database.transaction(["snapshots", "snapshotRelatedMessages", "snapshotReverseOperations"], "readonly");
    const [snapshots, related, reverse] = await Promise.all([indexedDbRequest(transaction.objectStore("snapshots").index("bySave").getAll(IDBKeyRange.only(saveId))), indexedDbRequest(transaction.objectStore("snapshotRelatedMessages").index("bySave").getAll(IDBKeyRange.only(saveId))), indexedDbRequest(transaction.objectStore("snapshotReverseOperations").index("bySave").getAll(IDBKeyRange.only(saveId)))]);
    const removedIds = new Set(snapshotDeletes.map(operation => exactNonblankText(operation.snapshotId, "snapshot.delete.snapshotId")));
    expanded.push(...related.filter(record => removedIds.has(record.snapshotId)).map(record => ({
      action: "delete",
      storeName: "snapshotRelatedMessages",
      key: recordKey("snapshotRelatedMessages", record)
    })));
    expanded.push(...reverse.filter(record => removedIds.has(record.snapshotId)).map(record => ({
      action: "delete",
      storeName: "snapshotReverseOperations",
      key: recordKey("snapshotReverseOperations", record)
    })));
    expanded.push(...snapshots.filter(record => removedIds.has(record.snapshotId)).map(record => ({
      action: "delete",
      storeName: "snapshots",
      key: recordKey("snapshots", record)
    })));
  }
  return expanded;
}
function stableStoryItemKey(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function storyRootRecordOperations(saveId, root, value, path = [], output = []) {
  if (Array.isArray(value)) {
    const listPathKey = path.join(".");
    value.forEach((item, index) => output.push({
      action: "put",
      storeName: "storyListItems",
      record: {
        saveId,
        root,
        listPathKey,
        itemKey: stableStoryItemKey(item),
        sequence: index + 1,
        value: structuredClone(item)
      }
    }));
    return output;
  }
  if (value != null && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) storyRootRecordOperations(saveId, root, nestedValue, [...path, key], output);
    return output;
  }
  if (path.length) {
    output.push({
      action: "put",
      storeName: "storyValues",
      record: {
        saveId,
        root,
        pathKey: path.join("."),
        value: value ?? null
      }
    });
  }
  return output;
}
async function expandStoryRootReplacements(database, saveId, recordOperations) {
  const replacements = recordOperations.filter(operation => operation.action === "replace-story-root");
  if (!replacements.length) return recordOperations;
  const expanded = recordOperations.filter(operation => operation.action !== "replace-story-root");
  const storeNames = ["storyValues", "storyListItems", "storyMapEntries"];
  for (const replacement of replacements) {
    if (!replacement.root) throw new Error("story.root.replace requires a root.");
    for (const storeName of storeNames) {
      const transaction = database.transaction(storeName, "readonly");
      const existing = await indexedDbRequest(transaction.objectStore(storeName).index("bySave").getAll(IDBKeyRange.only(saveId)));
      for (const record of existing) {
        if (record.root !== replacement.root) continue;
        expanded.push({
          action: "delete",
          storeName,
          key: recordKey(storeName, record)
        });
      }
    }
    expanded.push(...storyRootRecordOperations(saveId, replacement.root, replacement.value));
  }
  return expanded;
}
async function expandSaveRecordReplacements(database, saveId, recordOperations) {
  const replacements = recordOperations.filter(operation => operation.action === "replace-save-records");
  if (!replacements.length) return recordOperations;
  const expanded = recordOperations.filter(operation => operation.action !== "replace-save-records");
  for (const replacement of replacements) {
    const transaction = database.transaction(replacement.storeName, "readonly");
    const store = transaction.objectStore(replacement.storeName);
    const existing = await indexedDbRequest(store.index("bySave").getAll(IDBKeyRange.only(saveId)));
    const matchesScope = record => Object.entries(replacement.match || {}).every(([field, value]) => Object.is(record[field], value));
    for (const record of existing) {
      if (!matchesScope(record)) continue;
      expanded.push({
        action: "delete",
        storeName: replacement.storeName,
        key: recordKey(replacement.storeName, record)
      });
    }
    for (const record of replacement.records) expanded.push({
      action: "put",
      storeName: replacement.storeName,
      record
    });
  }
  return expanded;
}
async function findSnapshotByMessage(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const messageId = exactNonblankText(message.messageId, "messageId");
  const database = await openDatabase();
  const transaction = database.transaction(["snapshotRelatedMessages", "snapshots"], "readonly");
  const related = await indexedDbRequest(transaction.objectStore("snapshotRelatedMessages").index("byMessage").get([saveId, messageId]));
  if (!related) return null;
  return indexedDbRequest(transaction.objectStore("snapshots").get([saveId, related.snapshotId]));
}
async function listIncompleteSnapshots(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const database = await openDatabase();
  const transaction = database.transaction("snapshots", "readonly");
  const snapshots = await indexedDbRequest(transaction.objectStore("snapshots").index("bySave").getAll(IDBKeyRange.only(saveId)));
  return snapshots.filter(snapshot => !snapshot.completedAt).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
}
function convertTransaction(envelope) {
  if (!Array.isArray(envelope.operations) || envelope.operations.length === 0) throw new Error("Transaction operations are required.");
  const recordOperations = [];
  for (const operation of envelope.operations) recordOperations.push(...convertDomainOperation(envelope.saveId, operation, envelope.diagnostic === true));
  const closeCount = recordOperations.filter(operation => operation.action === "close-session").length;
  if (closeCount > 0 && (closeCount !== 1 || recordOperations.length !== 1)) throw new Error("save.session.close must be the only operation in its transaction.");
  return recordOperations;
}

//#endregion Domain Conversion

//#region Generic Record Writer

function applyRecordOperation(transaction, recordOperation, saveId, done, fail) {
  if (recordOperation.action === "close-session") {
    done();
    return;
  }
  const store = transaction.objectStore(recordOperation.storeName);
  if (recordOperation.action === "delete") {
    if (!isValidKeyPart(recordOperation.key)) throw new Error(`${recordOperation.storeName} delete key is invalid.`);
    const request = store.delete(recordOperation.key);
    request.onsuccess = done;
    return;
  }
  if (recordOperation.action === "merge" || recordOperation.action === "upsert-sparse") {
    if (!isValidKeyPart(recordOperation.key)) throw new Error(`${recordOperation.storeName} update key is invalid.`);
    const getRequest = store.get(recordOperation.key);
    getRequest.onsuccess = () => {
      try {
        if (!getRequest.result && recordOperation.action === "merge") throw new Error(`${recordOperation.storeName} cannot update missing record ${JSON.stringify(recordOperation.key)}. Initial save materialization must create complete records.`);
        const mergedRecord = {
          ...(getRequest.result || recordOperation.baseRecord),
          ...(recordOperation.values || {})
        };
        validateRecord(recordOperation.storeName, mergedRecord, saveId);
        const putRequest = store.put(mergedRecord);
        putRequest.onsuccess = done;
      } catch (error) {
        fail(error);
      }
    };
    return;
  }
  validateRecord(recordOperation.storeName, recordOperation.record, saveId);
  const request = recordOperation.action === "add" ? store.add(recordOperation.record) : store.put(recordOperation.record);
  request.onsuccess = done;
}
function writeTransaction(queue, envelope, recordOperations) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const closeSession = recordOperations.some(operation => operation.action === "close-session");
    const affectedStoreNames = Array.from(new Set(["saveCommitState", ...recordOperations.filter(operation => operation.storeName != null).map(operation => operation.storeName)]));
    if (recordOperations.some(operation => false)) {
      for (const storeName of ["saveHeaders", "sceneMembers"]) if (!affectedStoreNames.includes(storeName)) affectedStoreNames.push(storeName);
    }
    let transaction;
    try {
      transaction = database.transaction(affectedStoreNames, "readwrite", {
        durability: "strict"
      });
    } catch (error) {
      reject(error);
      return;
    }
    let operationIndex = 0;
    let finishedWriting = false;
    transaction.oncomplete = () => {
      if (!finishedWriting) {
        reject(new Error("IndexedDB completed before all record operations were scheduled."));
        return;
      }
      resolve({
        affectedStoreNames,
        closeSession,
        committedAt: Date.now()
      });
    };
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => {};
    const writeNext = () => {
      if (operationIndex < recordOperations.length) {
        const recordOperation = recordOperations[operationIndex++];
        try {
          applyRecordOperation(transaction, recordOperation, envelope.saveId, writeNext, error => {
            transaction.abort();
            reject(error);
          });
        } catch (error) {
          transaction.abort();
          reject(error);
        }
        return;
      }
      const cursorRecord = {
        saveId: envelope.saveId,
        sesNum: envelope.sesNum,
        comId: envelope.changeId,
        isOpen: !closeSession,
        time: Date.now()
      };
      validateRecord("saveCommitState", cursorRecord, envelope.saveId);
      const cursorRequest = transaction.objectStore("saveCommitState").put(cursorRecord);
      cursorRequest.onsuccess = () => finishedWriting = true;
    };
    writeNext();
  }));
}

//#endregion Generic Record Writer

//#region Save Queues

function transactionFingerprint(envelope) {
  return JSON.stringify({
    saveId: envelope.saveId,
    sesNum: envelope.sesNum,
    changeId: envelope.changeId,
    transactionType: envelope.transactionType,
    snapshotId: envelope.snapshotId || null,
    operations: envelope.operations
  });
}
function queueForSession(saveId, sesNum, comId) {
  const queue = {
    saveId,
    sesNum,
    comId,
    nextExpectedChangeId: comId + 1,
    pendingByChangeId: new Map(),
    processing: false,
    processingChangeId: null,
    closed: false
  };
  queuesBySaveId.set(saveId, queue);
  return queue;
}
function rememberCommittedFingerprint(envelope, fingerprint) {
  let fingerprints = committedFingerprintsBySaveId.get(envelope.saveId);
  if (fingerprints == null) {
    fingerprints = new Map();
    committedFingerprintsBySaveId.set(envelope.saveId, fingerprints);
  }
  fingerprints.set(`${envelope.sesNum}:${envelope.changeId}`, fingerprint);
  while (fingerprints.size > 256) fingerprints.delete(fingerprints.keys().next().value);
}
function processActiveQueue() {
  if (activeQueue == null || activeQueue.processing) return;
  const queuedTransaction = activeQueue.pendingByChangeId.get(activeQueue.nextExpectedChangeId);
  if (queuedTransaction == null) {
    setPhase("idle", null);
    stopHealthIfIdle();
    return;
  }
  activeQueue.processing = true;
  activeQueue.processingChangeId = queuedTransaction.envelope.changeId;
  activeQueue.pendingByChangeId.delete(queuedTransaction.envelope.changeId);
  startHealth();
  setPhase("converting", queuedTransaction.envelope.changeId);
  if (fault?.mode === "hang-before-commit" && fault.changeId === queuedTransaction.envelope.changeId) {
    setPhase("diagnostic-hang", queuedTransaction.envelope.changeId);
    while (true) {}
  }
  if (fault?.mode === "crash-before-commit" && fault.changeId === queuedTransaction.envelope.changeId) {
    setPhase("diagnostic-crash-before-commit", queuedTransaction.envelope.changeId);
    self.close();
    return;
  }
  let recordOperations;
  try {
    recordOperations = convertTransaction(queuedTransaction.envelope);
  } catch (error) {
    activeQueue.processing = false;
    activeQueue.processingChangeId = null;
    postFailure(queuedTransaction.requestId, error);
    setPhase("rejected", queuedTransaction.envelope.changeId);
    return;
  }
  if (fault?.mode === "reject-before-commit" && fault.changeId === queuedTransaction.envelope.changeId) {
    const errorName = fault.errorName || "QuotaExceededError";
    const errorMessage = fault.errorMessage || "Diagnostic storage rejection before commit.";
    fault = null;
    activeQueue.processing = false;
    activeQueue.processingChangeId = null;
    setPhase("rejected", queuedTransaction.envelope.changeId);
    postFailure(queuedTransaction.requestId, new DOMException(errorMessage, errorName));
    return;
  }
  setPhase("preparing-transaction", queuedTransaction.envelope.changeId);
  openDatabase().then(database => expandSaveRecordReplacements(database, queuedTransaction.envelope.saveId, recordOperations).then(expanded => expandStoryRootReplacements(database, queuedTransaction.envelope.saveId, expanded)).then(expanded => expandExplicitRecordDeletes(database, queuedTransaction.envelope.saveId, expanded)).then(expanded => expandCharacterReplacements(database, queuedTransaction.envelope.saveId, expanded)).then(replaced => expandSnapshotPruning(database, queuedTransaction.envelope.saveId, replaced)).then(pruned => expandSnapshotCommit(database, queuedTransaction.envelope.saveId, pruned)).then(committed => expandSnapshotRollback(database, queuedTransaction.envelope.saveId, committed)).then(expanded => captureSnapshotReverseOperations(database, queuedTransaction.envelope, expanded))).then(preparedOperations => {
    setPhase("opening-transaction", queuedTransaction.envelope.changeId);
    return writeTransaction(activeQueue, queuedTransaction.envelope, preparedOperations);
  }).then(result => {
    setPhase("committed", queuedTransaction.envelope.changeId);
    activeQueue.comId = queuedTransaction.envelope.changeId;
    activeQueue.nextExpectedChangeId = activeQueue.comId + 1;
    activeQueue.processing = false;
    activeQueue.processingChangeId = null;
    rememberCommittedFingerprint(queuedTransaction.envelope, queuedTransaction.fingerprint);
    if (fault?.mode === "crash-after-commit-before-ack" && fault.changeId === queuedTransaction.envelope.changeId) {
      self.close();
      return;
    }
    postResponse(queuedTransaction.requestId, {
      saveId: queuedTransaction.envelope.saveId,
      sesNum: queuedTransaction.envelope.sesNum,
      changeId: queuedTransaction.envelope.changeId,
      alreadyCommitted: false,
      affectedStoreNames: result.affectedStoreNames,
      committedAt: result.committedAt
    });
    if (result.closeSession) {
      activeQueue.closed = true;
      releaseSaveLock();
      activeSaveId = null;
      activeQueue = null;
      activatePendingSave();
      return;
    }
    processActiveQueue();
  }).catch(error => {
    activeQueue.processing = false;
    activeQueue.processingChangeId = null;
    setPhase("transaction-failed", queuedTransaction.envelope.changeId);
    postFailure(queuedTransaction.requestId, error);
  });
}
function receiveTransaction(requestId, envelope) {
  if (!Number.isInteger(envelope?.saveId) || !Number.isInteger(envelope?.sesNum) || !Number.isInteger(envelope?.changeId)) throw new Error("saveId, sesNum, and changeId must be integers.");
  if (!Array.isArray(envelope.operations) || envelope.operations.length < 1 || envelope.operations.length > 500) throw new Error("A save transaction must contain from 1 through 500 domain operations.");
  const queue = queuesBySaveId.get(envelope.saveId);
  if (queue == null) throw new Error(`Save ${envelope.saveId} does not have an active or buffered session.`);
  if (queue.sesNum !== envelope.sesNum) throw new Error(`Save ${envelope.saveId} expected session ${queue.sesNum}, received ${envelope.sesNum}.`);
  const fingerprint = transactionFingerprint(envelope);
  const fingerprintKey = `${envelope.sesNum}:${envelope.changeId}`;
  const committedFingerprint = committedFingerprintsBySaveId.get(envelope.saveId)?.get(fingerprintKey);
  if (envelope.changeId <= queue.comId) {
    if (committedFingerprint != null && committedFingerprint !== fingerprint) throw new Error(`Conflicting committed transaction ${envelope.saveId}/${fingerprintKey}.`);
    postResponse(requestId, {
      saveId: envelope.saveId,
      sesNum: envelope.sesNum,
      changeId: envelope.changeId,
      alreadyCommitted: true,
      affectedStoreNames: []
    });
    return;
  }
  const existing = queue.pendingByChangeId.get(envelope.changeId);
  if (existing != null) {
    if (existing.fingerprint !== fingerprint) throw new Error(`Conflicting pending transaction ${envelope.saveId}/${fingerprintKey}.`);
    existing.requestId = requestId;
    return;
  }
  queue.pendingByChangeId.set(envelope.changeId, {
    requestId,
    envelope,
    fingerprint
  });
  if (envelope.changeId > queue.nextExpectedChangeId && queue.processingChangeId !== queue.nextExpectedChangeId) {
    postMessageToController({
      type: "persistence.resend.requested",
      saveId: envelope.saveId,
      sesNum: envelope.sesNum,
      missingChangeId: queue.nextExpectedChangeId,
      receivedChangeId: envelope.changeId
    });
  }
  if (activeQueue === queue) processActiveQueue();
}
function receiveTransactionChunk(message) {
  const envelope = message.envelope;
  if (!Number.isInteger(envelope?.saveId) || !Number.isInteger(envelope?.sesNum) || !Number.isInteger(envelope?.changeId)) throw new Error("Chunked transaction identity is invalid.");
  if (!Number.isInteger(message.startIndex) || message.startIndex < 0 || !Array.isArray(message.operations)) throw new Error("Chunked transaction payload is invalid.");
  let staged = transactionChunksByRequestId.get(message.requestId);
  if (staged == null) {
    if (message.startIndex !== 0) throw new Error("The first transaction chunk must start at operation zero.");
    staged = {
      envelope,
      operations: []
    };
    transactionChunksByRequestId.set(message.requestId, staged);
  }
  if (staged.operations.length !== message.startIndex) throw new Error("Transaction chunks must arrive once and in order.");
  if (staged.envelope.saveId !== envelope.saveId || staged.envelope.sesNum !== envelope.sesNum || staged.envelope.changeId !== envelope.changeId) throw new Error("Transaction chunk identity changed during transfer.");
  staged.operations.push(...message.operations);
  if (staged.operations.length > 500) {
    transactionChunksByRequestId.delete(message.requestId);
    throw new Error("A chunked save transaction cannot exceed 500 domain operations.");
  }
  if (message.complete === true) {
    transactionChunksByRequestId.delete(message.requestId);
    receiveTransaction(message.requestId, {
      ...staged.envelope,
      operations: staged.operations
    });
  }
}

//#endregion Save Queues

//#region Save Lifecycle

function acquireSaveLock(saveId, waitMilliseconds = 0, steal = false) {
  if (activeSaveLockRelease != null) return Promise.reject(new Error("This persistence worker already owns a save lock."));
  if (navigator.locks == null) return Promise.reject(new Error("This browser does not support the Web Locks API required for exclusive save ownership."));
  const lockName = `emberadventures-lite-save-${saveId}`;
  if (steal) {
    return new Promise((resolve, reject) => {
      navigator.locks.request(lockName, {
        mode: "exclusive",
        steal: true
      }, lock => {
        activeSaveLockName = lockName;
        return new Promise(release => {
          activeSaveLockRelease = release;
          resolve(true);
        });
      }).catch(reject);
    });
  }
  const deadline = performance.now() + waitMilliseconds;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      navigator.locks.request(lockName, {
        mode: "exclusive",
        ifAvailable: true
      }, lock => {
        if (lock == null) {
          if (performance.now() < deadline) {
            setTimeout(attempt, 25);
            return undefined;
          }
          resolve(false);
          return undefined;
        }
        activeSaveLockName = lockName;
        return new Promise(release => {
          activeSaveLockRelease = release;
          resolve(true);
        });
      }).catch(reject);
    };
    attempt();
  });
}
function releaseSaveLock() {
  const release = activeSaveLockRelease;
  activeSaveLockRelease = null;
  activeSaveLockName = null;
  release?.();
}
function createSave(message) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    if (!Array.isArray(message.initialRecords)) throw new Error("initialRecords must be an array.");
    const initialRecords = message.initialRecords;
    const storeNames = Array.from(message.initialStoreNames || new Set(["saveHeaders", "saveCommitState", ...initialRecords.map(record => record.storeName)]));
    for (const storeName of storeNames) validateStoreName(storeName);
    if (message.initialRecordsValidated !== true) {
      for (const initialRecord of initialRecords) {
        if (!Object.prototype.hasOwnProperty.call(Schema.stores[initialRecord.storeName].fields, "saveId")) throw new Error(`Initial save record ${initialRecord.storeName} is not save-owned.`);
        validateRecord(initialRecord.storeName, {
          ...initialRecord.record,
          saveId: 1
        }, 1);
      }
    }
    const transaction = database.transaction(storeNames, "readwrite", {
      durability: "strict"
    });
    const header = {
      ...message.header
    };
    let saveId;
    delete header.saveId;
    validateRecord("saveHeaders", header);
    const headerRequest = transaction.objectStore("saveHeaders").add(header);
    headerRequest.onsuccess = () => {
      saveId = headerRequest.result;
      const commitState = {
        saveId,
        sesNum: 0,
        comId: 0,
        isOpen: false,
        time: Date.now()
      };
      transaction.objectStore("saveCommitState").add(commitState);
      for (const initialRecord of initialRecords) {
        const record = {
          ...initialRecord.record,
          saveId
        };
        if (message.initialRecordsValidated !== true) validateRecord(initialRecord.storeName, record, saveId);
        transaction.objectStore(initialRecord.storeName).add(record);
      }
    };
    transaction.oncomplete = () => resolve({
      saveId
    });
    transaction.onabort = () => reject(transaction.error || new Error("Creating the save failed."));
    transaction.onerror = () => {};
  }));
}
async function putStoryDefinition(message) {
  const definition = message.definition;
  const compiled = message.compiledIndexes;
  validateRecord("storyDefinitions", definition);
  validateRecord("compiledStoryIndexes", compiled);
  if (definition.storyId !== compiled.storyId || definition.revisionId !== compiled.revisionId) throw new Error("Immutable story definition and compiled indexes must use the same identity.");
  if (definition.contentHash !== compiled.definitionContentHash) throw new Error("Immutable story definition and compiled indexes must use the same content hash.");
  const database = await openDatabase();
  const key = [definition.storyId, definition.revisionId];
  const readTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readonly");
  const [existingDefinition, existingCompiled] = await Promise.all([indexedDbRequest(readTransaction.objectStore("storyDefinitions").get(key)), indexedDbRequest(readTransaction.objectStore("compiledStoryIndexes").get(key))]);
  if (existingDefinition && existingDefinition.contentHash !== definition.contentHash) throw new Error(`Immutable story definition collision for ${definition.storyId} revision ${definition.revisionId}.`);
  if (existingCompiled && existingCompiled.definitionContentHash !== compiled.definitionContentHash) throw new Error(`Compiled story definition collision for ${definition.storyId} revision ${definition.revisionId}.`);
  if (existingDefinition && existingCompiled) return {
    stored: false
  };
  const writeTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readwrite", {
    durability: "strict"
  });
  writeTransaction.objectStore("storyDefinitions").put(definition);
  writeTransaction.objectStore("compiledStoryIndexes").put(compiled);
  await indexedDbTransactionComplete(writeTransaction);
  return {
    stored: true
  };
}
function beginChunkedSaveCreation(message) {
  if (!Number.isInteger(message.totalRecords) || message.totalRecords < 1) throw new Error("Chunked save creation requires a positive totalRecords value.");
  if (saveCreationChunksByRequestId.has(message.requestId)) throw new Error(`Save creation request ${message.requestId} is already staged.`);
  saveCreationChunksByRequestId.set(message.requestId, {
    header: message.header,
    totalRecords: message.totalRecords,
    records: [],
    storeNames: new Set(["saveHeaders", "saveCommitState"])
  });
  return NoResponse;
}
function receiveSaveCreationChunk(message) {
  const staged = saveCreationChunksByRequestId.get(message.requestId);
  if (staged == null) throw new Error(`Save creation request ${message.requestId} was not started.`);
  if (!Number.isInteger(message.startIndex) || message.startIndex !== staged.records.length) throw new Error("Save creation chunks must arrive once and in order.");
  if (!Array.isArray(message.records) || message.records.length < 1 || message.records.length > 50) throw new Error("A save creation chunk must contain from 1 through 50 records.");
  try {
    for (const initialRecord of message.records) {
      validateStoreName(initialRecord.storeName);
      if (!Object.prototype.hasOwnProperty.call(Schema.stores[initialRecord.storeName].fields, "saveId")) throw new Error(`Initial save record ${initialRecord.storeName} is not save-owned.`);
      validateRecord(initialRecord.storeName, {
        ...initialRecord.record,
        saveId: 1
      }, 1);
      staged.storeNames.add(initialRecord.storeName);
    }
  } catch (error) {
    saveCreationChunksByRequestId.delete(message.requestId);
    throw error;
  }
  staged.records.push(...message.records);
  if (staged.records.length > staged.totalRecords) {
    saveCreationChunksByRequestId.delete(message.requestId);
    throw new Error("Save creation received more records than declared.");
  }
  if (message.complete !== true) return NoResponse;
  saveCreationChunksByRequestId.delete(message.requestId);
  if (staged.records.length !== staged.totalRecords) throw new Error(`Save creation expected ${staged.totalRecords} records and received ${staged.records.length}.`);
  return createSave({
    header: staged.header,
    initialRecords: staged.records,
    initialRecordsValidated: true,
    initialStoreNames: staged.storeNames
  });
}
function readCommitState(saveId) {
  return openDatabase().then(database => {
    const transaction = database.transaction("saveCommitState", "readonly");
    return indexedDbRequest(transaction.objectStore("saveCommitState").get(saveId));
  });
}
function writeActivatedCommitState(commitState) {
  return openDatabase().then(database => {
    const transaction = database.transaction("saveCommitState", "readwrite", {
      durability: "strict"
    });
    transaction.objectStore("saveCommitState").put(commitState);
    return indexedDbTransactionComplete(transaction);
  });
}
function activateSaveRequest(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  if (activeQueue != null) {
    if (pendingActivation != null) throw new Error("Only one pending save activation is allowed.");
    pendingActivation = message;
    startHealth();
    postHealth();
    return Promise.resolve(NoResponse);
  }
  return acquireSaveLock(saveId).then(acquired => {
    if (!acquired) throw new Error(`Save ${saveId} is already open in another tab.`);
    return readCommitState(saveId);
  }).then(commitState => {
    if (commitState == null) throw new Error(`Save ${saveId} does not exist.`);
    const activatedState = {
      saveId,
      sesNum: commitState.sesNum + 1,
      comId: 0,
      isOpen: true,
      time: Date.now()
    };
    return writeActivatedCommitState(activatedState).then(() => {
      activeSaveId = saveId;
      activeQueue = queueForSession(saveId, activatedState.sesNum, 0);
      setPhase("idle", null);
      return activatedState;
    });
  }).catch(error => {
    if (activeSaveId == null) releaseSaveLock();
    throw error;
  });
}
function resumeSaveRequest(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  if (activeQueue != null) throw new Error("Cannot resume while another save is active.");
  return acquireSaveLock(saveId, 0, true).then(acquired => {
    if (!acquired) throw new Error(`Save ${saveId} is already open in another tab.`);
    return readCommitState(saveId);
  }).then(commitState => {
    if (commitState == null || !commitState.isOpen) throw new Error(`Save ${saveId} has no open persistence session to resume.`);
    activeSaveId = saveId;
    activeQueue = queueForSession(saveId, commitState.sesNum, commitState.comId);
    setPhase("idle", null);
    return commitState;
  }).catch(error => {
    if (activeSaveId == null) releaseSaveLock();
    throw error;
  });
}
function activatePendingSave() {
  if (pendingActivation == null) {
    setPhase("idle", null);
    stopHealthIfIdle();
    return;
  }
  const message = pendingActivation;
  pendingActivation = null;
  activateSaveRequest(message).then(result => {
    postResponse(message.requestId, result);
  }).catch(error => postFailure(message.requestId, error));
}

//#endregion Save Lifecycle

//#region Loading, Paging, And Deletion

function newestMessages(database, saveId, limit, beforeSequence = Infinity) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return Promise.reject(new Error("Message page limit must be an integer from 1 through 500."));
  if (beforeSequence !== Infinity && (!Number.isFinite(beforeSequence) || beforeSequence < 1)) return Promise.reject(new Error("beforeSequence must be a positive finite number or Infinity."));
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("messages", "readonly");
    const index = transaction.objectStore("messages").index("bySequence");
    const upperSequence = Number.isFinite(beforeSequence) ? beforeSequence - 1 : Number.MAX_SAFE_INTEGER;
    const range = IDBKeyRange.bound([saveId, 0], [saveId, upperSequence]);
    const request = index.openCursor(range, "prev");
    const records = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor == null || records.length >= limit) {
        records.reverse();
        resolve(records);
        return;
      }
      records.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("Message paging failed."));
  });
}
function streamSaveStore(database, storeName, saveId, requestId, onRecord) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const source = storeName === "saveHeaders" ? store : store.index("bySave");
    const range = storeName === "saveHeaders" ? IDBKeyRange.only(saveId) : IDBKeyRange.only(saveId);
    const request = source.openCursor(range);
    let records = [];
    let count = 0;
    const flush = () => {
      if (records.length === 0) return;
      postMessageToController({
        type: "save.load.chunk",
        requestId,
        storeName,
        records
      });
      records = [];
      postHealth();
    };
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor == null) {
        flush();
        resolve(count);
        return;
      }
      onRecord?.(storeName, cursor.value);
      records.push(cursor.value);
      count++;
      if (records.length >= 100) flush();
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error(`Loading ${storeName} failed.`));
  });
}
function loadedCharacterPronouns(gender) {
  const male = String(gender || "").trim().toLowerCase() === "male";
  return male ? {
    subject: "he",
    object: "him",
    possessive: "his",
    independent: "his",
    reflexive: "himself"
  } : {
    subject: "she",
    object: "her",
    possessive: "her",
    independent: "hers",
    reflexive: "herself"
  };
}
function loadedTextResolver(charactersById, playerCharacterId) {
  const firstName = character => String(character.name || "").trim().split(/\s+/)[0];
  const replacementFor = (type, character) => {
    const pronouns = loadedCharacterPronouns(character.gender);
    const values = {
      character: character.name,
      character_first: firstName(character),
      character_pronoun: pronouns.subject,
      character_subject_pronoun: pronouns.subject,
      character_object_pronoun: pronouns.object,
      character_possessive_pronoun: pronouns.possessive,
      character_independent_possessive_pronoun: pronouns.independent,
      character_reflexive_pronoun: pronouns.reflexive,
      player_name: character.name,
      player_first_name: firstName(character),
      player_pronoun: pronouns.subject,
      player_subject_pronoun: pronouns.subject,
      player_object_pronoun: pronouns.object,
      player_possessive_pronoun: pronouns.possessive,
      player_independent_possessive_pronoun: pronouns.independent,
      player_reflexive_pronoun: pronouns.reflexive
    };
    const normalized = String(type || "").replace(/-cap$/, "_cap");
    const capitalized = normalized.endsWith("_cap");
    const value = values[capitalized ? normalized.slice(0, -4) : normalized];
    if (value == null) return null;
    return capitalized ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  };
  return value => String(value ?? "").replace(/\|\[([^\]:]+)(?::([^\]]+))?\]\|/g, (token, type, id) => {
    const character = charactersById.get(id || playerCharacterId);
    return character == null ? token : replacementFor(type, character) ?? token;
  });
}
function immutableStoryForSave(database, saveId) {
  const headerTransaction = database.transaction("saveHeaders", "readonly");
  return indexedDbRequest(headerTransaction.objectStore("saveHeaders").get(saveId)).then(header => {
    if (header == null) throw new Error(`Save ${saveId} does not exist.`);
    const key = [header.storyId, header.revisionId];
    const definitionTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readonly");
    return Promise.all([indexedDbRequest(definitionTransaction.objectStore("storyDefinitions").get(key)), indexedDbRequest(definitionTransaction.objectStore("compiledStoryIndexes").get(key))]).then(([definition, compiled]) => {
      if (definition == null || compiled == null) throw new Error(`Save ${saveId} has no matching validated immutable story definition.`);
      if (definition.contentHash !== compiled.definitionContentHash) throw new Error(`Save ${saveId} has a mismatched compiled story definition.`);
      return {
        header,
        definition,
        compiled
      };
    });
  });
}
async function loadSave(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const database = await openDatabase();
  const immutable = await immutableStoryForSave(database, saveId);
  const commitState = await readCommitState(saveId);
  if (commitState == null) throw new Error(`Save ${saveId} has no commit state.`);
  const priorities = new Map([["saveHeaders", 0], ["saveCommitState", 1], ["saveCharacterDefinitions", 2], ["objectiveControl", 3], ["currentScene", 4], ["currentLocation", 5]]);
  const storeNames = Object.entries(Schema.stores).filter(([name, store]) => name !== "messages" && Object.prototype.hasOwnProperty.call(store.fields, "saveId")).map(([name]) => name).sort((left, right) => (priorities.get(left) ?? 100) - (priorities.get(right) ?? 100));
  const charactersById = new Map();
  let objectiveControl = null;
  let currentScene = null;
  let currentLocation = null;
  let loadedRecordCount = 0;
  setPhase("loading", null);
  startHealth();
  try {
    for (let index = 0; index < storeNames.length; index++) {
      const storeName = storeNames[index];
      loadedRecordCount += await streamSaveStore(database, storeName, saveId, message.requestId, (name, record) => {
        if (name === "saveCharacterDefinitions") charactersById.set(record.characterId, record);else if (name === "objectiveControl") objectiveControl = record;else if (name === "currentScene") currentScene = record;else if (name === "currentLocation") currentLocation = record;
      });
      postMessageToController({
        type: "save.load.progress",
        requestId: message.requestId,
        completedStores: index + 1,
        totalStores: storeNames.length,
        storeName,
        loadedRecordCount
      });
    }
    const messages = await newestMessages(database, saveId, message.messageLimit ?? 40);
    postMessageToController({
      type: "save.load.chunk",
      requestId: message.requestId,
      storeName: "messages",
      records: messages
    });
    const totalMessages = await new Promise((resolve, reject) => {
      const transaction = database.transaction("messages", "readonly");
      const request = transaction.objectStore("messages").index("bySave").count(saveId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Counting messages failed."));
    });
    const activeObjectiveId = objectiveControl?.activeMainObjectiveId || null;
    const objectiveIndex = activeObjectiveId == null ? null : immutable.compiled.objectiveIndexById?.[activeObjectiveId];
    const objective = objectiveIndex == null ? null : immutable.definition.state?.objectives?.items?.[objectiveIndex];
    const resolveText = loadedTextResolver(charactersById, immutable.header.playerCharacterId);
    const player = charactersById.get(immutable.header.playerCharacterId);
    return {
      saveId: message.saveId,
      chunked: true,
      storeNames: [...storeNames, "messages"],
      immutableStory: {
        storyId: immutable.header.storyId,
        revisionId: immutable.header.revisionId,
        contentHash: immutable.definition.contentHash,
        title: immutable.definition.title
      },
      view: {
        playerName: player?.name || "Player",
        objectiveId: activeObjectiveId,
        objectiveTitle: resolveText(objective?.title || activeObjectiveId || "Freeplay"),
        objectiveSummary: resolveText(objective?.summary || ""),
        sceneSummary: currentScene?.summary || "",
        locationId: currentLocation?.locationId || null
      },
      recordCount: loadedRecordCount + messages.length,
      messagePage: {
        count: messages.length,
        total: totalMessages,
        hasEarlier: totalMessages > messages.length,
        oldestSequence: messages[0]?.sequence ?? null,
        newestSequence: messages[messages.length - 1]?.sequence ?? null
      }
    };
  } finally {
    setPhase("idle", null);
    stopHealthIfIdle();
  }
}
function listSaves(message) {
  const offset = Number.isInteger(message.offset) && message.offset >= 0 ? message.offset : 0;
  const limit = Number.isInteger(message.limit) ? message.limit : 60;
  if (limit < 1 || limit > 200) return Promise.reject(new Error("Save page limit must be from 1 through 200."));
  const query = String(message.query || "").trim().toLowerCase().slice(0, 160);
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(["saveCommitState", "saveHeaders"], "readonly");
    const commits = transaction.objectStore("saveCommitState").index("byTime");
    const headers = transaction.objectStore("saveHeaders");
    const request = commits.openCursor(null, "prev");
    const entries = [];
    let matchedCount = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor == null) {
        resolve({
          entries,
          total: matchedCount,
          offset,
          limit
        });
        return;
      }
      const commit = cursor.value;
      const headerRequest = headers.get(commit.saveId);
      headerRequest.onsuccess = () => {
        const header = headerRequest.result;
        const matchesMode = header != null && void 0 !== true;
        const matchesQuery = !query || String(header?.displayName || "").toLowerCase().includes(query);
        if (matchesMode && matchesQuery) {
          if (matchedCount >= offset && entries.length < limit) entries.push({
            ...header,
            lastCommittedAt: commit.time,
            sessionOpen: commit.isOpen
          });
          matchedCount++;
        }
        cursor.continue();
      };
      headerRequest.onerror = () => reject(headerRequest.error || new Error("Reading a save header failed."));
    };
    request.onerror = () => reject(request.error || new Error("Listing saves failed."));
  }));
}
function inspectSaveForLoad(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  return openDatabase().then(database => immutableStoryForSave(database, saveId)).then(immutable => ({
    header: immutable.header,
    immutableStory: {
      storyId: immutable.header.storyId,
      revisionId: immutable.header.revisionId,
      contentHash: immutable.definition.contentHash,
      title: immutable.definition.title
    }
  }));
}
async function renameSave(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const displayName = exactNonblankText(message.displayName, "displayName");
  if (displayName.length > 160) throw new Error("Saved game names cannot exceed 160 characters.");
  const database = await openDatabase();
  const transaction = database.transaction("saveHeaders", "readwrite", {
    durability: "strict"
  });
  const store = transaction.objectStore("saveHeaders");
  const header = await indexedDbRequest(store.get(saveId));
  if (!header) throw new Error(`Saved game ${saveId} does not exist.`);
  const updated = {
    ...header,
    displayName
  };
  validateRecord("saveHeaders", updated);
  store.put(updated);
  await indexedDbTransactionComplete(transaction);
  return updated;
}
async function exportSave(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const database = await openDatabase();
  const immutable = await immutableStoryForSave(database, saveId);
  const records = {};
  const storeNames = Object.entries(Schema.stores).filter(([, store]) => Object.prototype.hasOwnProperty.call(store.fields, "saveId")).map(([name]) => name);
  startHealth();
  setPhase("exporting", null);
  try {
    for (const storeName of storeNames) {
      const transaction = database.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      records[storeName] = storeName === "saveHeaders" ? [await indexedDbRequest(store.get(saveId))].filter(Boolean) : await indexedDbRequest(store.index("bySave").getAll(saveId));
      postHealth();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return {
      blob: new Blob([JSON.stringify({
        app: "EmberAdventures",
        exportType: "normalized-save",
        schemaVersion: Schema.version,
        immutableStory: {
          storyId: immutable.header.storyId,
          revisionId: immutable.header.revisionId,
          contentHash: immutable.definition.contentHash,
          definition: immutable.definition,
          compiledIndexes: immutable.compiled
        },
        records
      })], {
        type: "application/json"
      }),
      fileName: `emberadventures-lite-save-${saveId}.json`
    };
  } finally {
    setPhase("idle", null);
    stopHealthIfIdle();
  }
}
function validateSaveExport(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Save export must be an object.");
  const topFields = ["app", "exportType", "schemaVersion", "immutableStory", "records"];
  for (const field of Object.keys(payload)) if (!topFields.includes(field)) throw new Error(`Save export has unknown field ${field}.`);
  for (const field of topFields) if (!Object.hasOwn(payload, field)) throw new Error(`Save export is missing ${field}.`);
  if (payload.app !== "EmberAdventures") throw new Error('Save export app must be exactly "EmberAdventures".');
  if (payload.exportType !== "normalized-save") throw new Error('Save export exportType must be exactly "normalized-save".');
  if (payload.schemaVersion !== Schema.version) throw new Error(`Save schema ${payload.schemaVersion} is not supported. Expected ${Schema.version}.`);
  const immutable = payload.immutableStory;
  if (immutable == null || typeof immutable !== "object" || Array.isArray(immutable)) throw new Error("Save export immutableStory must be an object.");
  const immutableFields = ["storyId", "revisionId", "contentHash", "definition", "compiledIndexes"];
  for (const field of Object.keys(immutable)) if (!immutableFields.includes(field)) throw new Error(`Save export immutableStory has unknown field ${field}.`);
  for (const field of immutableFields) if (!Object.hasOwn(immutable, field)) throw new Error(`Save export immutableStory is missing ${field}.`);
  for (const field of ["storyId", "revisionId", "contentHash"]) if (typeof immutable[field] !== "string" || !immutable[field].trim()) throw new Error(`immutableStory.${field} must be a non-empty string.`);
  validateRecord("storyDefinitions", immutable.definition);
  validateRecord("compiledStoryIndexes", immutable.compiledIndexes);
  if (immutable.definition.storyId !== immutable.storyId || immutable.definition.revisionId !== immutable.revisionId) throw new Error("Save export immutable story identity does not match its definition.");
  if (immutable.definition.contentHash !== immutable.contentHash || immutable.compiledIndexes.definitionContentHash !== immutable.contentHash) throw new Error("Save export immutable story hashes do not match.");
  if (payload.records == null || typeof payload.records !== "object" || Array.isArray(payload.records)) throw new Error("Save export records must be an object.");
  const exportStoreNames = Object.entries(Schema.stores).filter(([, store]) => Object.prototype.hasOwnProperty.call(store.fields, "saveId")).map(([name]) => name);
  for (const storeName of Object.keys(payload.records)) if (!exportStoreNames.includes(storeName)) throw new Error(`Save export records has unknown store ${storeName}.`);
  for (const storeName of exportStoreNames) {
    if (!Object.hasOwn(payload.records, storeName)) throw new Error(`Save export records is missing store ${storeName}.`);
    const records = payload.records[storeName];
    if (!Array.isArray(records)) throw new Error(`Save export store ${storeName} must be an array.`);
    for (const record of records) validateRecord(storeName, record);
  }
  if (payload.records.saveHeaders.length !== 1) throw new Error("Save export must contain exactly one save header.");
  const sourceSaveId = payload.records.saveHeaders[0].saveId;
  for (const [storeName, records] of Object.entries(payload.records)) for (const record of records) if (record.saveId !== sourceSaveId) throw new Error(`${storeName}.saveId must match the exported save header.`);
  return payload;
}
async function importSave(message) {
  if (!(message.file instanceof Blob)) throw new Error("Save import requires a File or Blob.");
  const payload = JSON.parse(await message.file.text());
  validateSaveExport(payload);
  const immutable = payload.immutableStory;
  const definition = immutable?.definition;
  const compiled = immutable?.compiledIndexes;
  const sourceHeaders = payload.records.saveHeaders;
  const header = {
    ...sourceHeaders[0]
  };
  delete header.saveId;
  const initialRecords = [];
  for (const [storeName, records] of Object.entries(payload.records)) {
    validateStoreName(storeName);
    if (!Array.isArray(records)) throw new Error(`Save export store ${storeName} must be an array.`);
    if (storeName === "saveHeaders" || storeName === "saveCommitState") continue;
    if (!Object.prototype.hasOwnProperty.call(Schema.stores[storeName].fields, "saveId")) throw new Error(`Save export cannot write shared store ${storeName} through save records.`);
    for (const sourceRecord of records) {
      const record = {
        ...sourceRecord
      };
      delete record.saveId;
      initialRecords.push({
        storeName,
        record
      });
    }
  }
  const database = await openDatabase();
  const key = [definition.storyId, definition.revisionId];
  const readTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readonly");
  const [existingDefinition, existingCompiled] = await Promise.all([indexedDbRequest(readTransaction.objectStore("storyDefinitions").get(key)), indexedDbRequest(readTransaction.objectStore("compiledStoryIndexes").get(key))]);
  if (existingDefinition && existingDefinition.contentHash !== definition.contentHash) throw new Error(`Immutable story definition collision for ${definition.storyId} revision ${definition.revisionId}.`);
  if (existingCompiled && existingCompiled.definitionContentHash !== compiled.definitionContentHash) throw new Error(`Compiled story definition collision for ${definition.storyId} revision ${definition.revisionId}.`);
  if (!existingDefinition || !existingCompiled) {
    const writeTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readwrite", {
      durability: "strict"
    });
    writeTransaction.objectStore("storyDefinitions").put(definition);
    writeTransaction.objectStore("compiledStoryIndexes").put(compiled);
    await indexedDbTransactionComplete(writeTransaction);
  }
  const created = await createSave({
    header,
    initialRecords
  });
  return {
    ...created,
    importedRecords: initialRecords.length
  };
}
const ExportableImageStoreNames = Object.freeze(["characterProfileImages", "characterProfileImageSelections", "characterImages", "storyTitleImages", "storyTitleImageSelections", "storyItemImages", "storyItemImageSelections", "storyOutfitImages", "storyOutfitImageSelections", "storyRewardImages", "storyImages", "storyImageTargets", "assetBlobs"]);
const ImageStoreBySelectionStore = Object.freeze({
  characterProfileImageSelections: "characterProfileImages",
  storyItemImageSelections: "storyItemImages",
  storyOutfitImageSelections: "storyOutfitImages",
  storyTitleImageSelections: "storyTitleImages"
});
const ImageOwnerFieldsByStore = Object.freeze({
  characterProfileImages: ["characterId", "presentation"],
  characterImages: ["characterId", "presentation"],
  storyTitleImages: ["storyId"],
  storyItemImages: ["storyId", "itemId"],
  storyOutfitImages: ["storyId", "characterId", "outfitId"],
  storyRewardImages: ["storyId", "rewardImageId"],
  storyImages: ["saveId"]
});
const SmokeImageOwnerStoreNames = Object.freeze(["characterProfileImages", "characterImages", "storyTitleImages", "storyItemImages", "storyOutfitImages", "storyRewardImages", "storyImages"]);
let smokeImageIsolationBaseline = null;
function smokeImageIsolationKey(value) {
  return JSON.stringify(value);
}
function smokeImageIsolationRecordKey(store, record) {
  const keyPath = store.keyPath;
  if (Array.isArray(keyPath)) return keyPath.map(field => record?.[field]);
  return record?.[keyPath];
}
function smokeImageIsolationBaselineSet(storeName) {
  if (!smokeImageIsolationBaseline) return null;
  return new Set((smokeImageIsolationBaseline[storeName] || []).map(smokeImageIsolationKey));
}
function smokeImageIsolationBaselineOwnsImageId(imageId) {
  if (!smokeImageIsolationBaseline) return false;
  const wanted = String(imageId || "");
  if (!wanted) return false;
  return SmokeImageOwnerStoreNames.some(storeName => (smokeImageIsolationBaseline[storeName] || []).some(key => String(storeName === "storyImages" && Array.isArray(key) ? key[1] : key) === wanted));
}
function assertSmokeImageIsolationMayMutate(storeName, key, action) {
  const baseline = smokeImageIsolationBaselineSet(storeName);
  if (baseline?.has(smokeImageIsolationKey(key))) throw new Error(`Smoke isolation blocked ${action} of pre-smoke ${storeName} record ${smokeImageIsolationKey(key)}.`);
}
async function beginSmokeImageIsolation(message = {}) {
  if (smokeImageIsolationBaseline) throw new Error("Smoke image isolation is already active.");
  const database = await openDatabase();
  const transaction = database.transaction(ExportableImageStoreNames, "readonly");
  const baseline = {};
  await Promise.all(ExportableImageStoreNames.map(async storeName => {
    baseline[storeName] = await indexedDbRequest(transaction.objectStore(storeName).getAllKeys());
  }));
  await indexedDbTransactionComplete(transaction);
  smokeImageIsolationBaseline = baseline;
  return {
    runId: String(message.runId || ""),
    baseline,
    counts: Object.fromEntries(Object.entries(baseline).map(([storeName, keys]) => [storeName, keys.length]))
  };
}
async function restoreSmokeImageIsolation(message = {}) {
  const baseline = message.baseline || smokeImageIsolationBaseline;
  const keepActive = message.keepActive === true;
  if (!baseline || typeof baseline !== "object") throw new Error("Smoke image isolation cannot restore without an exact baseline.");
  const database = await openDatabase();
  const missing = [];
  const deletedKeys = [];
  let deleted = 0;
  for (const storeName of ExportableImageStoreNames) {
    const baselineKeys = Array.isArray(baseline[storeName]) ? baseline[storeName] : [];
    const baselineTokens = new Set(baselineKeys.map(smokeImageIsolationKey));
    const readTransaction = database.transaction(storeName, "readonly");
    const currentKeys = await indexedDbRequest(readTransaction.objectStore(storeName).getAllKeys());
    await indexedDbTransactionComplete(readTransaction);
    const currentTokens = new Set(currentKeys.map(smokeImageIsolationKey));
    for (const key of baselineKeys) {
      if (!currentTokens.has(smokeImageIsolationKey(key))) missing.push(`${storeName}:${smokeImageIsolationKey(key)}`);
    }
    const addedKeys = currentKeys.filter(key => !baselineTokens.has(smokeImageIsolationKey(key)));
    if (!addedKeys.length) continue;
    const writeTransaction = database.transaction(storeName, "readwrite", {
      durability: "strict"
    });
    const store = writeTransaction.objectStore(storeName);
    for (const key of addedKeys) {
      store.delete(key);
      deletedKeys.push(`${storeName}:${smokeImageIsolationKey(key)}`);
    }
    await indexedDbTransactionComplete(writeTransaction);
    deleted += addedKeys.length;
  }
  if (missing.length) throw new Error(`Smoke tests removed ${missing.length} pre-existing image record(s): ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", ..." : ""}`);
  if (!keepActive) smokeImageIsolationBaseline = null;
  return {
    deleted,
    deletedKeys,
    restored: true,
    keepActive
  };
}
function bytesToBase64(bytes) {
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) value += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 32768, bytes.length)));
  return btoa(value);
}
function base64ToBytes(value) {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}
async function exportAllImages() {
  const database = await openDatabase();
  const records = {};
  let completed = 0;
  startHealth();
  setPhase("exporting-images", null);
  try {
    for (const storeName of ExportableImageStoreNames) {
      const transaction = database.transaction(storeName, "readonly");
      const values = await indexedDbRequest(transaction.objectStore(storeName).getAll());
      if (storeName === "assetBlobs") {
        records[storeName] = [];
        for (const record of values) {
          const bytes = new Uint8Array(await record.blob.arrayBuffer());
          records[storeName].push({
            ...record,
            blob: undefined,
            base64: bytesToBase64(bytes)
          });
          postHealth();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } else records[storeName] = values;
      completed++;
      postMessageToController({
        type: "image.export.progress",
        completed,
        total: ExportableImageStoreNames.length
      });
      postHealth();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const jsonBlob = new Blob([JSON.stringify({
      app: "EmberAdventures",
      exportType: "all-images",
      schemaVersion: Schema.version,
      records
    })], {
      type: "application/json"
    });
    if (typeof CompressionStream !== "function") {
      return {
        blob: jsonBlob,
        fileName: `emberadventures-lite-all-images-${new Date().toISOString().replaceAll(":", "-")}.json`
      };
    }
    const compressed = await new Response(jsonBlob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    return {
      blob: compressed,
      fileName: `emberadventures-lite-all-images-${new Date().toISOString().replaceAll(":", "-")}.json.gz`
    };
  } finally {
    setPhase("idle", null);
    stopHealthIfIdle();
  }
}
async function exportAllImageIndex() {
  const database = await openDatabase();
  const records = {};
  for (const storeName of ExportableImageStoreNames) {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    if (storeName !== "assetBlobs") {
      records[storeName] = await indexedDbRequest(store.getAll());
      continue;
    }
    records.assetBlobs = await new Promise((resolve, reject) => {
      const values = [];
      const request = store.openCursor();
      request.onerror = () => reject(request.error || new Error("Image asset index failed."));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(values);
          return;
        }
        const {
          blob,
          ...metadata
        } = cursor.value;
        values.push(metadata);
        cursor.continue();
      };
    });
  }
  return {
    app: "EmberAdventures",
    exportType: "all-images-index",
    schemaVersion: Schema.version,
    records
  };
}
async function imageImportPayload(file) {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const gzip = header[0] === 0x1f && header[1] === 0x8b;
  const blob = gzip ? await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).blob() : file;
  return JSON.parse(await blob.text());
}
function validateImageExport(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Image export must be an object.");
  const topFields = ["app", "exportType", "schemaVersion", "records"];
  for (const field of Object.keys(payload)) if (!topFields.includes(field)) throw new Error(`Image export has unknown field ${field}.`);
  for (const field of topFields) if (!Object.hasOwn(payload, field)) throw new Error(`Image export is missing ${field}.`);
  if (payload.app !== "EmberAdventures") throw new Error('Image export app must be exactly "EmberAdventures".');
  if (payload.exportType !== "all-images") throw new Error('Image export exportType must be exactly "all-images".');
  if (payload.schemaVersion !== Schema.version) throw new Error(`Image schema ${payload.schemaVersion} is not supported. Expected ${Schema.version}.`);
  if (payload.records == null || typeof payload.records !== "object" || Array.isArray(payload.records)) throw new Error("Image export records must be an object.");
  for (const storeName of Object.keys(payload.records)) if (!ExportableImageStoreNames.includes(storeName)) throw new Error(`Image export records has unknown store ${storeName}.`);
  for (const storeName of ExportableImageStoreNames) {
    if (!Object.hasOwn(payload.records, storeName)) throw new Error(`Image export records is missing store ${storeName}.`);
    const records = payload.records[storeName];
    if (!Array.isArray(records)) throw new Error(`Image export store ${storeName} must be an array.`);
    for (const source of records) {
      if (storeName !== "assetBlobs") {
        validateRecord(storeName, source, source.saveId ?? null);
        continue;
      }
      if (source == null || typeof source !== "object" || Array.isArray(source)) throw new Error("Image export assetBlobs entries must be objects.");
      const fields = ["imageId", "mimeType", "byteLength", "contentHash", "base64"];
      for (const field of Object.keys(source)) if (!fields.includes(field)) throw new Error(`Image export assetBlobs entry has unknown field ${field}.`);
      for (const field of fields) if (!Object.hasOwn(source, field)) throw new Error(`Image export assetBlobs entry is missing ${field}.`);
      for (const field of ["imageId", "mimeType", "contentHash", "base64"]) if (typeof source[field] !== "string" || !source[field]) throw new Error(`Image export assetBlobs.${field} must be non-empty text.`);
      if (!Number.isSafeInteger(source.byteLength) || source.byteLength < 0) throw new Error("Image export assetBlobs.byteLength must be a non-negative safe integer.");
    }
  }
  return payload;
}
function validateExportWithoutMutation(payload, validate, label) {
  const before = JSON.stringify(payload);
  const result = validate(payload);
  const after = JSON.stringify(payload);
  if (after !== before) throw new Error(`${label} validator mutated its input.`);
  return {
    valid: result === payload,
    unchanged: true
  };
}
function comparableImageImportRecord(value) {
  if (Array.isArray(value)) return value.map(comparableImageImportRecord);
  if (value == null || typeof value !== "object" || value instanceof Blob) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = comparableImageImportRecord(value[key]);
  return result;
}
async function importAllImages(message) {
  if (!(message.file instanceof Blob)) throw new Error("Image import requires a File or Blob.");
  startHealth();
  setPhase("importing-images", null);
  try {
    const payload = await imageImportPayload(message.file);
    validateImageExport(payload);
    const database = await openDatabase();
    const preparedByStore = new Map();
    const existingByStore = new Map();
    const conflicts = [];
    let skipped = 0;
    for (const storeName of ExportableImageStoreNames) {
      const prepared = [];
      for (const source of payload.records[storeName]) {
        if (storeName !== "assetBlobs") prepared.push(source);else {
          const {
            base64,
            ...metadata
          } = source;
          prepared.push({
            ...metadata,
            blob: new Blob([base64ToBytes(base64)], {
              type: source.mimeType
            })
          });
          postHealth();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      const incomingKeys = new Set();
      for (const record of prepared) {
        validateRecord(storeName, record, record.saveId ?? null);
        const key = JSON.stringify(recordKey(storeName, record));
        if (incomingKeys.has(key)) throw new Error(`Image import contains duplicate ${storeName} key ${key}.`);
        incomingKeys.add(key);
      }
      preparedByStore.set(storeName, prepared);
      postHealth();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    for (const storeName of ExportableImageStoreNames) {
      const transaction = database.transaction(storeName, "readonly");
      const existing = await indexedDbRequest(transaction.objectStore(storeName).getAll());
      existingByStore.set(storeName, new Map(existing.map(record => [JSON.stringify(recordKey(storeName, record)), record])));
      postHealth();
    }
    const missingByStore = new Map();
    const replacementsByStore = new Map();
    for (const storeName of ExportableImageStoreNames) {
      const existingByKey = existingByStore.get(storeName);
      const missing = [];
      const replacements = [];
      for (const record of preparedByStore.get(storeName)) {
        const key = JSON.stringify(recordKey(storeName, record));
        const prior = existingByKey.get(key);
        if (Object.hasOwn(ImageStoreBySelectionStore, storeName)) {
          const imageStoreName = ImageStoreBySelectionStore[storeName];
          const imageId = record.imageId;
          const imageAvailable = imageId == null || existingByStore.get(imageStoreName).has(JSON.stringify(imageId)) || preparedByStore.get(imageStoreName).some(image => String(image.imageId || "") === String(imageId));
          if (!imageAvailable) {
            conflicts.push(`${storeName} ${key} references unavailable ${imageStoreName} image ${JSON.stringify(imageId)}`);
            continue;
          }
        }
        if (prior == null) {
          missing.push(record);
          continue;
        }
        const same = storeName === "assetBlobs" ? prior.imageId === record.imageId && prior.mimeType === record.mimeType && prior.byteLength === record.byteLength && prior.contentHash === record.contentHash && prior.blob instanceof Blob && prior.blob.size === record.blob.size : JSON.stringify(comparableImageImportRecord(prior)) === JSON.stringify(comparableImageImportRecord(record));
        if (same) skipped++;else if (Object.hasOwn(ImageStoreBySelectionStore, storeName)) {
          replacements.push(record);
        } else if (Object.hasOwn(ImageOwnerFieldsByStore, storeName) && ImageOwnerFieldsByStore[storeName].every(field => prior[field] === record[field]) && preparedByStore.get("assetBlobs").some(asset => String(asset.imageId || "") === String(record.imageId || "")) && (!existingByStore.get("assetBlobs").has(JSON.stringify(record.imageId)) || Object.keys(record).every(field => field === "url" || JSON.stringify(comparableImageImportRecord(prior[field])) === JSON.stringify(comparableImageImportRecord(record[field]))))) {
          if (/^blob:/i.test(String(prior.url || ""))) {
            const sanitized = {
              ...prior
            };
            if (record.url && !/^blob:/i.test(String(record.url))) sanitized.url = record.url;else delete sanitized.url;
            validateRecord(storeName, sanitized, sanitized.saveId ?? null);
            replacements.push(sanitized);
          } else skipped++;
        } else conflicts.push(`${storeName} ${key}`);
      }
      missingByStore.set(storeName, missing);
      replacementsByStore.set(storeName, replacements);
      postHealth();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (conflicts.length) throw new Error(`Image import conflicts with existing records:\n${conflicts.slice(0, 20).join("\n")}${conflicts.length > 20 ? `\n...and ${conflicts.length - 20} more.` : ""}`);
    const writeStoreNames = ExportableImageStoreNames.filter(storeName => missingByStore.get(storeName).length || replacementsByStore.get(storeName).length);
    let imported = 0;
    let replaced = 0;
    if (writeStoreNames.length) {
      const transaction = database.transaction(writeStoreNames, "readwrite", {
        durability: "strict"
      });
      for (const storeName of writeStoreNames) {
        const store = transaction.objectStore(storeName);
        for (const record of missingByStore.get(storeName)) {
          store.add(record);
          imported++;
        }
        for (const record of replacementsByStore.get(storeName)) {
          store.put(record);
          replaced++;
        }
      }
      await indexedDbTransactionComplete(transaction);
    }
    return {
      imported,
      replaced,
      skipped,
      conflicts: 0
    };
  } finally {
    setPhase("idle", null);
    stopHealthIfIdle();
  }
}
function deleteSaveRecords(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  if (activeSaveId === saveId) throw new Error("An active save must close before deletion.");
  return openDatabase().then(async database => {
    const childStoreNames = Object.entries(Schema.stores).filter(([name, store]) => {
      return Object.prototype.hasOwnProperty.call(store.fields, "saveId") && name !== "saveHeaders" && name !== "saveCommitState";
    }).map(([name]) => name);
    let deletedRecords = 0;
    startHealth();
    setPhase("deleting", null);
    try {
      const countTransaction = database.transaction(childStoreNames, "readonly");
      const populatedStoreCounts = await Promise.all(childStoreNames.map(async storeName => {
        const count = await indexedDbRequest(countTransaction.objectStore(storeName).index("bySave").count(IDBKeyRange.only(saveId)));
        return {
          storeName,
          count
        };
      }));
      for (const {
        storeName,
        count
      } of populatedStoreCounts) {
        let remaining = count;
        while (remaining > 0) {
          const transaction = database.transaction(storeName, "readwrite", {
            durability: "relaxed"
          });
          const store = transaction.objectStore(storeName);
          const keys = await indexedDbRequest(store.index("bySave").getAllKeys(IDBKeyRange.only(saveId), 50));
          for (const key of keys) {
            if (ExportableImageStoreNames.includes(storeName)) assertSmokeImageIsolationMayMutate(storeName, key, "save deletion");
            store.delete(key);
          }
          await indexedDbTransactionComplete(transaction);
          deletedRecords += keys.length;
          remaining -= keys.length;
          postHealth();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      const finalTransaction = database.transaction(["saveCommitState", "saveHeaders"], "readwrite", {
        durability: "strict"
      });
      finalTransaction.objectStore("saveCommitState").delete(saveId);
      finalTransaction.objectStore("saveHeaders").delete(saveId);
      await indexedDbTransactionComplete(finalTransaction);
      deletedRecords += 2;
      setPhase("idle", null);
      stopHealthIfIdle();
      return {
        saveId,
        deletedRecords
      };
    } catch (error) {
      setPhase("idle", null);
      stopHealthIfIdle();
      throw error;
    }
  });
}
function countStoreRecords(message) {
  validateStoreName(message.storeName);
  return openDatabase().then(database => {
    const transaction = database.transaction(message.storeName, "readonly");
    const store = transaction.objectStore(message.storeName);
    if (message.saveId != null && store.indexNames.contains("bySave")) return indexedDbRequest(store.index("bySave").count(IDBKeyRange.only(exactPositiveSafeInteger(message.saveId, "saveId"))));
    return indexedDbRequest(store.count());
  });
}
function getRecord(message) {
  validateStoreName(message.storeName);
  return openDatabase().then(database => {
    const transaction = database.transaction(message.storeName, "readonly");
    return indexedDbRequest(transaction.objectStore(message.storeName).get(message.key));
  });
}
const SharedMutableStores = new Set(["assetBlobs", "characterProfileImages", "characterProfileImageSelections", "characterImages", "storyItemImages", "storyItemImageSelections", "storyOutfitImages", "storyOutfitImageSelections", "storyTitleImages", "storyTitleImageSelections", "storyRewardImages"]);
function requireSharedMutableStore(storeName) {
  validateStoreName(storeName);
  if (!SharedMutableStores.has(storeName)) throw new Error(`${storeName} is not a shared mutable image store.`);
}
function listSharedRecords(message) {
  requireSharedMutableStore(message.storeName);
  const limit = message.limit == null ? 60 : exactIntegerInRange(message.limit, "limit", 1, 10000);
  return openDatabase().then(async database => {
    const transaction = database.transaction(message.storeName, "readonly");
    const store = transaction.objectStore(message.storeName);
    const source = message.indexName ? store.index(message.indexName) : store;
    const range = Object.prototype.hasOwnProperty.call(message, "key") ? IDBKeyRange.only(message.key) : null;
    const records = await indexedDbRequest(source.getAll(range, limit));
    return {
      records,
      limit
    };
  });
}
function putSharedRecords(message) {
  if (!Array.isArray(message.records) || message.records.length < 1 || message.records.length > 100) return Promise.reject(new Error("Shared image writes must contain 1 through 100 records."));
  for (const entry of message.records) {
    requireSharedMutableStore(entry.storeName);
    validateRecord(entry.storeName, entry.record);
  }
  const storeNames = [...new Set(message.records.map(entry => entry.storeName))];
  return openDatabase().then(database => {
    const transaction = database.transaction(storeNames, "readwrite", {
      durability: "strict"
    });
    for (const entry of message.records) {
      const store = transaction.objectStore(entry.storeName);
      const key = smokeImageIsolationRecordKey(store, entry.record);
      assertSmokeImageIsolationMayMutate(entry.storeName, key, "overwrite");
      if (SmokeImageOwnerStoreNames.includes(entry.storeName) && !smokeImageIsolationBaselineSet(entry.storeName)?.has(smokeImageIsolationKey(key)) && smokeImageIsolationBaselineOwnsImageId(entry.record.imageId)) throw new Error(`Smoke isolation blocked reuse of pre-smoke image ID ${entry.record.imageId} in ${entry.storeName}.`);
      store.put(entry.record);
    }
    return indexedDbTransactionComplete(transaction).then(() => ({
      stored: message.records.length
    }));
  });
}
function deleteSharedImage(message) {
  requireSharedMutableStore(message.storeName);
  if (message.storeName === "assetBlobs") return Promise.reject(new Error("Delete the owning image record instead of deleting an asset directly."));
  return openDatabase().then(async database => {
    assertSmokeImageIsolationMayMutate(message.storeName, message.key, "deletion");
    const existingTransaction = database.transaction(message.storeName, "readonly");
    const existing = await indexedDbRequest(existingTransaction.objectStore(message.storeName).get(message.key));
    if (!existing) return {
      deleted: false
    };
    const imageId = String(existing.imageId || "");
    assertSmokeImageIsolationMayMutate("assetBlobs", imageId, "cascade deletion");
    const selectionStoresByImageStore = {
      characterProfileImages: "characterProfileImageSelections",
      storyItemImages: "storyItemImageSelections",
      storyOutfitImages: "storyOutfitImageSelections",
      storyTitleImages: "storyTitleImageSelections"
    };
    const selectionStoreName = selectionStoresByImageStore[message.storeName];
    const storeNames = [message.storeName, "assetBlobs", ...(selectionStoreName ? [selectionStoreName] : [])];
    const transaction = database.transaction(storeNames, "readwrite", {
      durability: "strict"
    });
    transaction.objectStore(message.storeName).delete(message.key);
    transaction.objectStore("assetBlobs").delete(imageId);
    if (selectionStoreName) {
      const selectionStore = transaction.objectStore(selectionStoreName);
      const selections = await indexedDbRequest(selectionStore.getAll());
      for (const selection of selections) {
        if (selection.imageId !== imageId) continue;
        assertSmokeImageIsolationMayMutate(selectionStoreName, smokeImageIsolationRecordKey(selectionStore, selection), "selection update");
        selection.imageId = null;
        selectionStore.put(selection);
      }
    }
    await indexedDbTransactionComplete(transaction);
    return {
      deleted: true,
      imageId
    };
  });
}
const ManagedImageStoreNames = Object.freeze(["characterProfileImages", "characterImages", "storyTitleImages", "storyItemImages", "storyOutfitImages", "storyRewardImages", "storyImages"]);
function managedImageCatalogRecord(storeName, record, localAssetIds, storyImageTargetNames) {
  const imageId = String(record.imageId || "");
  if (!imageId) return null;
  return {
    storeName,
    imageId,
    hasLocalAsset: localAssetIds.has(imageId),
    url: String(record.url || ""),
    characterId: String(record.characterId || ""),
    presentation: String(record.presentation || ""),
    source: String(record.source || ""),
    storyId: String(record.storyId || ""),
    storyTitle: String(record.storyTitle || ""),
    itemId: String(record.itemId || ""),
    outfitId: String(record.outfitId || ""),
    rewardImageId: String(record.rewardImageId || ""),
    title: String(record.title || ""),
    targetNames: storeName === "storyImages" ? [...(storyImageTargetNames.get(`${record.saveId}|${imageId}`) || [])] : [],
    saveId: record.saveId == null ? null : record.saveId,
    status: String(record.status || "ready")
  };
}
function listManagedImages() {
  const storeNames = [...ManagedImageStoreNames, "assetBlobs", "saveHeaders", "storyImageTargets", "saveCharacterDefinitions"];
  return openDatabase().then(async database => {
    const transaction = database.transaction(storeNames, "readonly");
    const recordRequests = ManagedImageStoreNames.map(storeName => indexedDbRequest(transaction.objectStore(storeName).getAll()));
    const assetKeysRequest = indexedDbRequest(transaction.objectStore("assetBlobs").getAllKeys());
    const saveHeadersRequest = indexedDbRequest(transaction.objectStore("saveHeaders").getAll());
    const storyImageTargetsRequest = indexedDbRequest(transaction.objectStore("storyImageTargets").getAll());
    const characterDefinitionsRequest = indexedDbRequest(transaction.objectStore("saveCharacterDefinitions").getAll());
    const [recordLists, assetKeys, saveHeaders, storyImageTargets, characterDefinitions] = await Promise.all([Promise.all(recordRequests), assetKeysRequest, saveHeadersRequest, storyImageTargetsRequest, characterDefinitionsRequest]);
    const localAssetIds = new Set(assetKeys.map(key => String(key || "")));
    const characterNames = new Map(characterDefinitions.map(character => [`${character.saveId}|${character.characterId}`, String(character.name || character.characterId || "")]));
    const storyImageTargetNames = new Map();
    for (const target of storyImageTargets) {
      const key = `${target.saveId}|${target.imageId}`;
      if (!storyImageTargetNames.has(key)) storyImageTargetNames.set(key, new Set());
      const name = characterNames.get(`${target.saveId}|${target.characterId}`) || String(target.characterId || "");
      if (name) storyImageTargetNames.get(key).add(name);
    }
    const items = [];
    for (let index = 0; index < ManagedImageStoreNames.length; index++) {
      const storeName = ManagedImageStoreNames[index];
      for (const record of recordLists[index]) {
        const item = managedImageCatalogRecord(storeName, record, localAssetIds, storyImageTargetNames);
        if (item) items.push(item);
      }
    }
    return {
      items,
      saveHeaders: saveHeaders.map(header => ({
        saveId: header.saveId,
        storyId: String(header.storyId || ""),
        displayName: String(header.displayName || "")
      }))
    };
  });
}
function exactManagedImageDeletionDescriptors(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10000) throw new Error("Managed image deletion must contain 1 through 10000 image references.");
  const keys = new Set();
  return value.map((source, index) => {
    const path = `managed image deletion references.${index}`;
    if (source == null || typeof source !== "object" || Array.isArray(source)) throw new Error(`${path} must be an object.`);
    const allowedFields = source.storeName === "storyImages" ? ["storeName", "imageId", "saveId"] : ["storeName", "imageId"];
    const fields = Object.keys(source);
    if (fields.length !== allowedFields.length || fields.some(field => !allowedFields.includes(field))) throw new Error(`${path} contains an unapproved field.`);
    if (!ManagedImageStoreNames.includes(source.storeName)) throw new Error(`${path}.storeName is not a managed image store.`);
    if (typeof source.imageId !== "string" || !source.imageId || source.imageId.trim() !== source.imageId) throw new Error(`${path}.imageId must be exact non-empty trimmed text.`);
    const saveId = source.storeName === "storyImages" ? exactPositiveSafeInteger(source.saveId, `${path}.saveId`) : null;
    const key = `${source.storeName}|${saveId ?? ""}|${source.imageId}`;
    if (keys.has(key)) throw new Error(`${path} duplicates ${key}.`);
    keys.add(key);
    return {
      storeName: source.storeName,
      imageId: source.imageId,
      saveId
    };
  });
}
function deleteManagedImages(message) {
  const references = exactManagedImageDeletionDescriptors(message.references);
  const deletesProfileImages = references.some(reference => reference.storeName === "characterProfileImages");
  const selectionStoreNames = ["characterProfileImageSelections", "storyItemImageSelections", "storyOutfitImageSelections", "storyTitleImageSelections"];
  const readStoreNames = [...new Set([...references.map(reference => reference.storeName), ...selectionStoreNames, "storyImageTargets", "saveHeaders", ...(deletesProfileImages ? ["assetBlobs"] : [])])];
  return openDatabase().then(async database => {
    for (const reference of references) {
      assertSmokeImageIsolationMayMutate(reference.storeName, reference.storeName === "storyImages" ? [reference.saveId, reference.imageId] : reference.imageId, "managed deletion");
    }
    const readTransaction = database.transaction(readStoreNames, "readonly");
    const existingRequests = references.map(reference => indexedDbRequest(readTransaction.objectStore(reference.storeName).get(reference.storeName === "storyImages" ? [reference.saveId, reference.imageId] : reference.imageId)));
    const selectionRequests = selectionStoreNames.map(storeName => indexedDbRequest(readTransaction.objectStore(storeName).getAll()));
    const targetRequest = indexedDbRequest(readTransaction.objectStore("storyImageTargets").getAll());
    const saveHeadersRequest = indexedDbRequest(readTransaction.objectStore("saveHeaders").getAll());
    const profileImageRecordsRequest = deletesProfileImages ? indexedDbRequest(readTransaction.objectStore("characterProfileImages").getAll()) : Promise.resolve([]);
    const assetBlobKeysRequest = deletesProfileImages ? indexedDbRequest(readTransaction.objectStore("assetBlobs").getAllKeys()) : Promise.resolve([]);
    const [existingRecords, selectionLists, targets, saveHeaders, profileImageRecords, assetBlobKeys] = await Promise.all([Promise.all(existingRequests), Promise.all(selectionRequests), targetRequest, saveHeadersRequest, profileImageRecordsRequest, assetBlobKeysRequest]);
    const existingReferences = references.filter((reference, index) => existingRecords[index] != null);
    if (!existingReferences.length) return {
      deleted: 0
    };
    for (const reference of existingReferences) assertSmokeImageIsolationMayMutate("assetBlobs", reference.imageId, "managed cascade deletion");
    const deletedImageIdsByStore = new Map();
    for (const reference of existingReferences) {
      if (!deletedImageIdsByStore.has(reference.storeName)) deletedImageIdsByStore.set(reference.storeName, new Set());
      deletedImageIdsByStore.get(reference.storeName).add(reference.imageId);
    }
    const deletedStoryImageKeys = new Set(existingReferences.filter(reference => reference.storeName === "storyImages").map(reference => `${reference.saveId}|${reference.imageId}`));
    const writeStoreNames = [...new Set([...existingReferences.map(reference => reference.storeName), "assetBlobs", ...selectionStoreNames, "storyImageTargets", "saveHeaders"])];
    const writeTransaction = database.transaction(writeStoreNames, "readwrite", {
      durability: "strict"
    });
    for (const reference of existingReferences) {
      writeTransaction.objectStore(reference.storeName).delete(reference.storeName === "storyImages" ? [reference.saveId, reference.imageId] : reference.imageId);
      writeTransaction.objectStore("assetBlobs").delete(reference.imageId);
    }
    const imageStoreBySelectionStore = {
      characterProfileImageSelections: "characterProfileImages",
      storyItemImageSelections: "storyItemImages",
      storyOutfitImageSelections: "storyOutfitImages",
      storyTitleImageSelections: "storyTitleImages"
    };
    const localProfileAssetIds = new Set(assetBlobKeys.map(String));
    const profileSelectionChanges = [];
    const newestRemainingProfileImage = (selection, deletedIds) => profileImageRecords.filter(record => record.characterId === selection.characterId && record.presentation === selection.presentation && !deletedIds.has(String(record.imageId || "")) && (!!String(record.url || "") || localProfileAssetIds.has(String(record.imageId || "")))).sort((left, right) => {
      const leftTimestamp = Date.parse(String(left.createdAt || ""));
      const rightTimestamp = Date.parse(String(right.createdAt || ""));
      const leftHasTimestamp = Number.isFinite(leftTimestamp);
      const rightHasTimestamp = Number.isFinite(rightTimestamp);
      if (leftHasTimestamp !== rightHasTimestamp) return rightHasTimestamp - leftHasTimestamp;
      if (leftHasTimestamp && leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
      const leftNumericId = Number(left.imageId);
      const rightNumericId = Number(right.imageId);
      const leftHasNumericId = Number.isFinite(leftNumericId);
      const rightHasNumericId = Number.isFinite(rightNumericId);
      if (leftHasNumericId !== rightHasNumericId) return rightHasNumericId - leftHasNumericId;
      if (leftHasNumericId && leftNumericId !== rightNumericId) return rightNumericId - leftNumericId;
      return String(right.imageId || "").localeCompare(String(left.imageId || ""));
    })[0] || null;
    for (let index = 0; index < selectionStoreNames.length; index++) {
      const selectionStoreName = selectionStoreNames[index];
      const selectionStore = writeTransaction.objectStore(selectionStoreNames[index]);
      const deletedIds = deletedImageIdsByStore.get(imageStoreBySelectionStore[selectionStoreName]) || new Set();
      for (const selection of selectionLists[index]) {
        if (!deletedIds.has(String(selection.imageId || ""))) continue;
        assertSmokeImageIsolationMayMutate(selectionStoreName, smokeImageIsolationRecordKey(selectionStore, selection), "managed selection update");
        const replacement = selectionStoreName === "characterProfileImageSelections" ? newestRemainingProfileImage(selection, deletedIds) : null;
        selection.imageId = replacement?.imageId || null;
        selectionStore.put(selection);
        if (selectionStoreName === "characterProfileImageSelections") profileSelectionChanges.push({
          characterId: selection.characterId,
          presentation: selection.presentation,
          imageId: selection.imageId
        });
      }
    }
    const targetStore = writeTransaction.objectStore("storyImageTargets");
    for (const target of targets) {
      if (!deletedStoryImageKeys.has(`${target.saveId}|${target.imageId}`)) continue;
      assertSmokeImageIsolationMayMutate("storyImageTargets", smokeImageIsolationRecordKey(targetStore, target), "managed target deletion");
      targetStore.delete([target.saveId, target.imageId, target.characterId]);
    }
    const saveHeaderStore = writeTransaction.objectStore("saveHeaders");
    const deletedImageIds = new Set(existingReferences.map(reference => reference.imageId));
    for (const header of saveHeaders) {
      if (!deletedImageIds.has(String(header.titleImageId || ""))) continue;
      delete header.titleImageId;
      saveHeaderStore.put(header);
    }
    await indexedDbTransactionComplete(writeTransaction);
    return {
      deleted: existingReferences.length,
      profileSelectionChanges
    };
  });
}
function getImmutableDefinition(message) {
  const storesByKind = {
    story: "storyDefinitions",
    character: "authoredCharacterDefinitions"
  };
  const storeName = storesByKind[message.kind];
  if (!storeName) return Promise.reject(new Error("Definition kind must be story or character."));
  try {
    exactNonblankText(message.id, "id");
    exactNonblankText(message.revisionId, "revisionId");
  } catch (error) {
    return Promise.reject(error);
  }
  return openDatabase().then(database => {
    const transaction = database.transaction(storeName, "readonly");
    return indexedDbRequest(transaction.objectStore(storeName).get([message.id, message.revisionId]));
  });
}
function listLibraryEntries(message) {
  const storesByKind = {
    story: "storyLibraryEntries",
    character: "characterLibraryEntries"
  };
  const storeName = storesByKind[message.kind];
  if (!storeName) return Promise.reject(new Error("Library kind must be story or character."));
  let offset;
  let limit;
  let query;
  try {
    offset = message.offset == null ? 0 : exactIntegerInRange(message.offset, "offset", 0, Number.MAX_SAFE_INTEGER);
    limit = message.limit == null ? 60 : exactIntegerInRange(message.limit, "limit", 1, 200);
    if (message.query != null && typeof message.query !== "string") throw new Error("query must be text.");
    query = (message.query || "").trim().toLowerCase().slice(0, 160);
  } catch (error) {
    return Promise.reject(error);
  }
  return openDatabase().then(async database => {
    const transaction = database.transaction(storeName, "readonly");
    let entries = await indexedDbRequest(transaction.objectStore(storeName).getAll());
    if (query) {
      entries = entries.filter(entry => {
        const searchableValues = message.kind === "story" ? [entry.title, entry.description, entry.source, entry.creator, ...(entry.genres || []), ...[]] : [entry.name, entry.fallbackName, entry.role, entry.source, entry.creator, entry.gender, ...(entry.genres || []), ...[]];
        return searchableValues.some(value => String(value || "").toLowerCase().includes(query));
      });
    }
    const titleField = message.kind === "story" ? "title" : "name";
    entries.sort((left, right) => String(left[titleField]).localeCompare(String(right[titleField]), undefined, {
      sensitivity: "base"
    }));
    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      offset,
      limit
    };
  });
}
function seedDiagnosticRecord(message) {
  validateStoreName(message.storeName);
  validateRecord(message.storeName, message.record);
  return openDatabase().then(database => {
    const transaction = database.transaction(message.storeName, "readwrite", {
      durability: "strict"
    });
    const store = transaction.objectStore(message.storeName);
    if (ExportableImageStoreNames.includes(message.storeName)) assertSmokeImageIsolationMayMutate(message.storeName, smokeImageIsolationRecordKey(store, message.record), "diagnostic overwrite");
    store.put(message.record);
    return indexedDbTransactionComplete(transaction).then(() => ({
      seeded: true
    }));
  });
}
function seedDiagnosticRecords(message) {
  if (!Array.isArray(message.records) || message.records.length < 1 || message.records.length > 500) return Promise.reject(new Error("Diagnostic record batches must contain 1 through 500 records."));
  for (const entry of message.records) {
    validateStoreName(entry.storeName);
    validateRecord(entry.storeName, entry.record);
  }
  const storeNames = Array.from(new Set(message.records.map(entry => entry.storeName)));
  return openDatabase().then(database => {
    const transaction = database.transaction(storeNames, "readwrite", {
      durability: "strict"
    });
    for (const entry of message.records) {
      const store = transaction.objectStore(entry.storeName);
      if (ExportableImageStoreNames.includes(entry.storeName)) assertSmokeImageIsolationMayMutate(entry.storeName, smokeImageIsolationRecordKey(store, entry.record), "diagnostic overwrite");
      store.put(entry.record);
    }
    return indexedDbTransactionComplete(transaction).then(() => ({
      seeded: message.records.length
    }));
  });
}
async function seedDiagnosticMessages(message) {
  const saveId = exactPositiveSafeInteger(message.saveId, "saveId");
  const firstSequence = exactPositiveSafeInteger(message.firstSequence, "firstSequence");
  const finalSequence = exactPositiveSafeInteger(message.finalSequence, "finalSequence");
  if (finalSequence < firstSequence) throw new Error("finalSequence must be greater than or equal to firstSequence.");
  if (finalSequence - firstSequence + 1 > 10000) throw new Error("Diagnostic message seeding is limited to 10,000 records.");
  const database = await openDatabase();
  let nextSequence = firstSequence;
  while (nextSequence <= finalSequence) {
    const batchEnd = Math.min(finalSequence, nextSequence + 499);
    const transaction = database.transaction("messages", "readwrite", {
      durability: "strict"
    });
    const store = transaction.objectStore("messages");
    for (let sequence = nextSequence; sequence <= batchEnd; sequence++) {
      store.put({
        saveId,
        messageId: `message-${sequence}`,
        sequence,
        role: sequence % 2 === 0 ? "assistant" : "user",
        speaker: sequence % 2 === 0 ? "Narrator" : "Diagnostic Player",
        text: `Diagnostic message ${sequence}`,
        detail: "normal",
        at: new Date(1785870000000 + sequence * 1000).toISOString()
      });
    }
    await indexedDbTransactionComplete(transaction);
    nextSequence = batchEnd + 1;
  }
  return {
    seeded: finalSequence - firstSequence + 1
  };
}
async function seedDiagnosticLibraryMetadata(message) {
  const count = exactIntegerInRange(message.count, "count", 1, 5000);
  const database = await openDatabase();
  let nextIndex = 0;
  while (nextIndex < count) {
    const batchEnd = Math.min(count, nextIndex + 250);
    const transaction = database.transaction(["storyLibraryEntries", "characterLibraryEntries"], "readwrite", {
      durability: "strict"
    });
    const storyStore = transaction.objectStore("storyLibraryEntries");
    const characterStore = transaction.objectStore("characterLibraryEntries");
    for (let index = nextIndex; index < batchEnd; index++) {
      const number = String(index).padStart(4, "0");
      const genres = [index % 2 === 0 ? "fantasy" : "science fiction"];
      storyStore.put({
        storyId: `story-${number}`,
        revisionId: "revision-1",
        title: `Story ${number}`,
        description: `Bounded card metadata for story ${number}.`,
        source: "Original",
        creator: "Diagnostic",
        creatorId: "diagnostic",
        genres
      });
      characterStore.put({
        characterId: `character-${number}`,
        revisionId: "revision-1",
        name: `Character ${number}`,
        fallbackName: `Alternate ${number}`,
        role: "Diagnostic library character",
        source: "Original",
        creator: "Diagnostic",
        creatorId: "diagnostic",
        genres,
        gender: index % 2 === 0 ? "female" : "male"
      });
    }
    await indexedDbTransactionComplete(transaction);
    nextIndex = batchEnd;
  }
  return {
    seeded: count * 2
  };
}
function validateDiagnosticRecord(message) {
  validateRecord(message.storeName, message.record, message.expectedSaveId ?? null);
  return Promise.resolve({
    valid: true
  });
}

//#endregion Loading, Paging, And Deletion

//#region Request Routing

function inspectSchema() {
  return openDatabase().then(database => {
    const stores = {};
    for (const storeName of database.objectStoreNames) {
      const transaction = database.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      stores[storeName] = {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames)
      };
    }
    return {
      databaseName: database.name,
      version: database.version,
      storeCount: database.objectStoreNames.length,
      stores
    };
  });
}
function routeRequest(message) {
  switch (message.type) {
    case "system.initialize":
      return openDatabase().then(() => ({
        databaseName: Schema.databaseName,
        version: Schema.version,
        storeCount: Object.keys(Schema.stores).length
      }));
    case "database.reset":
      return resetDatabase().then(() => ({
        reset: true
      }));
    case "schema.inspect":
      return inspectSchema();
    case "story.definition.put":
      return putStoryDefinition(message);
    case "save.create":
      return createSave(message);
    case "save.create.begin":
      return beginChunkedSaveCreation(message);
    case "save.create.chunk":
      return receiveSaveCreationChunk(message);
    case "save.session.activate":
      return activateSaveRequest(message);
    case "save.session.resume":
      return resumeSaveRequest(message);
    case "save.transaction.submit":
      receiveTransaction(message.requestId, message.envelope);
      return NoResponse;
    case "save.transaction.chunk":
      receiveTransactionChunk(message);
      return NoResponse;
    case "save.cursor.get":
      return readCommitState(exactPositiveSafeInteger(message.saveId, "saveId"));
    case "save.load":
      return loadSave(message);
    case "save.list":
      return listSaves(message);
    case "save.inspect":
      return inspectSaveForLoad(message);
    case "save.rename":
      return renameSave(message);
    case "save.export":
      return exportSave(message);
    case "save.import":
      return importSave(message);
    case "snapshot.find-by-message":
      return findSnapshotByMessage(message);
    case "snapshot.incomplete.list":
      return listIncompleteSnapshots(message);
    case "images.export-all":
      return exportAllImages();
    case "images.export-index":
      return exportAllImageIndex();
    case "images.import-all":
      return importAllImages(message);
    case "smoke.images.begin":
      return beginSmokeImageIsolation(message);
    case "smoke.images.restore":
      return restoreSmokeImageIsolation(message);
    case "messages.page":
      return openDatabase().then(database => newestMessages(database, exactPositiveSafeInteger(message.saveId, "saveId"), message.limit ?? 40, message.beforeSequence));
    case "library.list":
      return listLibraryEntries(message);
    case "definition.get":
      return getImmutableDefinition(message);
    case "save.delete":
      return deleteSaveRecords(message);
    case "diagnostic.count":
      return countStoreRecords(message);
    case "diagnostic.record.get":
      return getRecord(message);
    case "shared.records.list":
      return listSharedRecords(message);
    case "shared.records.put":
      return putSharedRecords(message);
    case "shared.image.delete":
      return deleteSharedImage(message);
    case "images.manage.list":
      return listManagedImages();
    case "images.manage.delete":
      return deleteManagedImages(message);
    case "diagnostic.record.seed":
      return seedDiagnosticRecord(message);
    case "diagnostic.records.seed":
      return seedDiagnosticRecords(message);
    case "diagnostic.messages.seed":
      return seedDiagnosticMessages(message);
    case "diagnostic.library.seed":
      return seedDiagnosticLibraryMetadata(message);
    case "diagnostic.record.validate":
      return validateDiagnosticRecord(message);
    case "diagnostic.save-export.validate":
      return validateExportWithoutMutation(message.payload, validateSaveExport, "Save export");
    case "diagnostic.image-export.validate":
      return validateExportWithoutMutation(message.payload, validateImageExport, "Image export");
    case "diagnostic.fault.set":
      fault = message.fault;
      return Promise.resolve({
        fault
      });
    case "persistence.status":
      postHealth();
      return Promise.resolve({
        activeSaveId,
        activeSessionNumber: activeQueue?.sesNum ?? null
      });
    default:
      throw new Error(`Unknown worker request type: ${message.type}.`);
  }
}
self.onmessage = event => {
  const message = event.data;
  if (message == null || typeof message !== "object" || !Number.isInteger(message.requestId)) {
    postMessageToController({
      type: "protocol.error",
      error: "Every request must include an integer requestId."
    });
    return;
  }
  let result;
  try {
    result = routeRequest(message);
  } catch (error) {
    postFailure(message.requestId, error);
    return;
  }
  if (result === NoResponse) return;
  Promise.resolve(result).then(value => {
    if (value !== NoResponse) postResponse(message.requestId, value);
  }).catch(error => postFailure(message.requestId, error));
};
self.addEventListener("unhandledrejection", event => {
  postMessageToController({
    type: "worker.unhandledrejection",
    error: event.reason?.message || String(event.reason)
  });
});

//#endregion Request Routing