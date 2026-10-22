"use strict";

importScripts("./schema-contract.js");

const Schema = self.EmberStorageSchema;
const NoResponse = Symbol("no-response");
const queuesBySaveId = new Map();
const committedFingerprintsBySaveId = new Map();
const transactionChunksByRequestId = new Map();

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
    if (healthIntervalId != null)
        return;

    healthIntervalId = setInterval(postHealth, 1000);
}

function stopHealthIfIdle() {
    if (currentPhase !== "idle" || activePendingCount() > 0 || pendingActivation != null)
        return;

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
        }
        catch (error) {
            throw new Error(`Could not create object store ${storeName}: ${error.message}`);
        }

        for (const indexSchema of storeSchema.indexes) {
            try {
                objectStore.createIndex(indexSchema.name, indexSchema.keyPath, {
                    unique: indexSchema.unique,
                    multiEntry: indexSchema.multiEntry
                });
            }
            catch (error) {
                throw new Error(`Could not create index ${storeName}.${indexSchema.name}: ${error.message}`);
            }
        }
    }
}

function verifyDatabaseSchema(database) {
    const expectedStoreNames = Object.keys(Schema.stores).sort();
    const actualStoreNames = Array.from(database.objectStoreNames).sort();

    if (JSON.stringify(expectedStoreNames) !== JSON.stringify(actualStoreNames))
        throw new Error("IndexedDB object stores do not match the generated schema contract.");

    const transaction = database.transaction(expectedStoreNames, "readonly");

    for (const storeName of expectedStoreNames) {
        const store = transaction.objectStore(storeName);
        const expectedIndexes = Schema.stores[storeName].indexes.map((index) => index.name).sort();
        const actualIndexes = Array.from(store.indexNames).sort();

        if (JSON.stringify(expectedIndexes) !== JSON.stringify(actualIndexes))
            throw new Error(`IndexedDB indexes do not match the contract for ${storeName}.`);
    }
}

function openDatabase() {
    if (databasePromise != null)
        return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(Schema.databaseName, Schema.version);

        request.onupgradeneeded = (event) => {
            const database = request.result;

            if (event.oldVersion !== 0)
                throw new Error("This diagnostic backend has no migration or backward-compatibility path.");

            createDatabaseSchema(database);
        };
        request.onsuccess = () => {
            const database = request.result;

            database.onversionchange = () => database.close();

            try {
                verifyDatabaseSchema(database);
                resolve(database);
            }
            catch (error) {
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
    const closePromise = databasePromise == null
        ? Promise.resolve()
        : databasePromise.then((database) => database.close(), () => {});

    return closePromise.then(() => {
        databasePromise = null;
        activeSaveId = null;
        activeQueue = null;
        releaseSaveLock();
        pendingActivation = null;
        queuesBySaveId.clear();
        committedFingerprintsBySaveId.clear();

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

function keyPathFields(keyPath) {
    return Array.isArray(keyPath) ? keyPath : [keyPath];
}

function recordKey(storeName, record) {
    const fields = keyPathFields(Schema.stores[storeName].keyPath);
    const values = fields.map((field) => record[field]);

    return Array.isArray(Schema.stores[storeName].keyPath) ? values : values[0];
}

function isValidKeyPart(value) {
    if (typeof value === "string")
        return value.length > 0;

    if (typeof value === "number")
        return Number.isFinite(value);

    if (value instanceof Date)
        return Number.isFinite(value.getTime());

    if (Array.isArray(value))
        return value.length > 0 && value.every(isValidKeyPart);

    return false;
}

function validateStoreName(storeName) {
    if (!Object.prototype.hasOwnProperty.call(Schema.stores, storeName))
        throw new Error(`Unknown object store: ${storeName}.`);
}

function scalarTypeOptions(typeSpec) {
    return typeSpec
        .replace(/\s+FK/g, "")
        .split(/[|/]/)
        .map((value) => value.trim())
        .filter(Boolean);
}

function validateFieldType(storeName, fieldName, fieldSchema, value) {
    if (fieldSchema.kind === "array") {
        if (!Array.isArray(value))
            throw new Error(`${storeName}.${fieldName} must be an array.`);
        return;
    }

    if (fieldSchema.kind === "object") {
        if (value == null || typeof value !== "object" || Array.isArray(value) || value instanceof Blob)
            throw new Error(`${storeName}.${fieldName} must be an object.`);
        return;
    }

    const typeSpec = fieldSchema.typeSpec || "bounded value";
    const options = scalarTypeOptions(typeSpec);

    if (typeSpec === "clothing slot | hand | null") {
        const validSlots = new Set([
            "hat", "hairAccessory", "face", "ears", "neck", "shoulders", "bra", "undershirt",
            "shirt", "overShirt", "coat", "back", "hands", "rightWrist", "leftWrist", "rightFingers",
            "leftFingers", "waist", "beltAccessory", "underwear", "pants", "skirt", "legwear", "socks",
            "feet", "otherAccessory", "hand"
        ]);

        if (value != null && !validSlots.has(value))
            throw new Error(`${storeName}.${fieldName} must be a clothing slot, hand, or null.`);
        return;
    }

    if (value == null) {
        if (options.includes("null") || /\/null|\|null/.test(typeSpec))
            return;
        throw new Error(`${storeName}.${fieldName} may not be null.`);
    }

    if (typeSpec === "Blob") {
        if (!(value instanceof Blob))
            throw new Error(`${storeName}.${fieldName} must be a Blob.`);
        return;
    }

    if (/^(structured|bounded)/.test(typeSpec)) {
        if (typeof value === "function" || typeof value === "symbol")
            throw new Error(`${storeName}.${fieldName} must be structured-clone compatible.`);
        return;
    }

    const primitiveOptions = options.filter((option) => ["string", "number", "integer", "boolean"].includes(option));
    const enumOptions = options.filter((option) => !["string", "number", "integer", "boolean", "null"].includes(option));
    const primitiveMatches = primitiveOptions.some((option) => {
        if (option === "integer")
            return Number.isInteger(value);
        return typeof value === option && (option !== "number" || Number.isFinite(value));
    });

    if (primitiveOptions.length > 0 && !primitiveMatches)
        throw new Error(`${storeName}.${fieldName} must match ${typeSpec}.`);

    if (primitiveOptions.length === 0 && enumOptions.length > 0 && (typeof value !== "string" || !enumOptions.includes(value)))
        throw new Error(`${storeName}.${fieldName} must be one of: ${enumOptions.join(", ")}.`);

    if (typeof value === "number" && typeof fieldSchema.description === "string") {
        const rangeMatch = fieldSchema.description.match(/from\s+(-?\d+(?:\.\d+)?)\s+through\s+(-?\d+(?:\.\d+)?)/i);

        if (rangeMatch != null && (value < Number(rangeMatch[1]) || value > Number(rangeMatch[2])))
            throw new Error(`${storeName}.${fieldName} must be from ${rangeMatch[1]} through ${rangeMatch[2]}.`);
    }
}

function validateRecord(storeName, record, expectedSaveId = null) {
    validateStoreName(storeName);

    if (record == null || typeof record !== "object" || Array.isArray(record))
        throw new Error(`${storeName} record must be a plain object.`);

    const storeSchema = Schema.stores[storeName];
    const autoIncrementField = storeSchema.autoIncrement
        ? keyPathFields(storeSchema.keyPath)[0]
        : null;

    for (const fieldName of Object.keys(record)) {
        if (!Object.prototype.hasOwnProperty.call(storeSchema.fields, fieldName))
            throw new Error(`${storeName}.${fieldName} is not defined by the storage contract.`);
    }

    for (const [fieldName, fieldSchema] of Object.entries(storeSchema.fields)) {
        if (fieldName === autoIncrementField && !Object.prototype.hasOwnProperty.call(record, fieldName))
            continue;

        if (fieldSchema.required && !Object.prototype.hasOwnProperty.call(record, fieldName))
            throw new Error(`${storeName}.${fieldName} is required.`);

        if (Object.prototype.hasOwnProperty.call(record, fieldName))
            validateFieldType(storeName, fieldName, fieldSchema, record[fieldName]);
    }

    if (expectedSaveId != null && Object.prototype.hasOwnProperty.call(storeSchema.fields, "saveId") && record.saveId !== expectedSaveId)
        throw new Error(`${storeName}.saveId must match transaction saveId ${expectedSaveId}.`);

    if (!storeSchema.autoIncrement || Object.prototype.hasOwnProperty.call(record, keyPathFields(storeSchema.keyPath)[0])) {
        const key = recordKey(storeName, record);

        if (!isValidKeyPart(key))
            throw new Error(`${storeName} has an invalid IndexedDB primary key.`);
    }

    const serializedRecord = JSON.stringify(record);

    if (serializedRecord.length > 262144)
        throw new Error(`${storeName} record exceeds the 262144-byte bounded-record limit.`);

    if (serializedRecord.length > 16384) {
        postMessageToController({
            type: "persistence.warning",
            warning: "large-record",
            storeName,
            serializedBytes: serializedRecord.length
        });
    }

    if (Object.prototype.hasOwnProperty.call(storeSchema.fields, "saveId") && containsEmbeddedImageData(record))
        throw new Error(`${storeName} save-owned records may not contain embedded image data.`);
}

function containsEmbeddedImageData(value) {
    if (typeof value === "string")
        return /^data:image\//i.test(value);

    if (Array.isArray(value))
        return value.some(containsEmbeddedImageData);

    if (value == null || typeof value !== "object" || value instanceof Blob)
        return false;

    return Object.values(value).some(containsEmbeddedImageData);
}

function validateDiagnosticStoreAccess(storeName) {
    validateStoreName(storeName);

    if (["save", "state", "characters", "objectives", "images"].includes(storeName))
        throw new Error(`Whole-save persistence is forbidden: ${storeName}.`);
}

//#endregion Record Validation




//#region Domain Conversion

function convertDomainOperation(saveId, operation, diagnostic) {
    if (operation == null || typeof operation !== "object")
        throw new Error("Domain operation must be an object.");

    switch (operation.type) {
        case "message.add":
            return [{ action: "add", storeName: "messages", record: { ...operation.message, saveId } }];

        case "character.relationship.set":
            return [{
                action: "merge",
                storeName: "characterRelationshipStats",
                key: [saveId, operation.characterId],
                defaults: {
                    saveId,
                    characterId: operation.characterId,
                    trust: 0,
                    attraction: 0,
                    affection: 0
                },
                values: operation.values
            }];

        case "character.fact.add":
            return [{ action: "add", storeName: "characterFacts", record: { ...operation.fact, saveId } }];

        case "character.fact.remove":
            return [{ action: "delete", storeName: "characterFacts", key: [saveId, operation.characterId, operation.factId] }];

        case "objective.runtime.set":
            return [{
                action: "merge",
                storeName: "objectiveRuntime",
                key: [saveId, operation.objectiveId],
                defaults: { saveId, objectiveId: operation.objectiveId },
                values: operation.values
            }];

        case "reward.invocation.add":
            return [{ action: "add", storeName: "rewardInvocations", record: { ...operation.invocation, saveId } }];

        case "story.value.set":
            return [{ action: "put", storeName: "storyValues", record: { ...operation.record, saveId } }];

        case "story.list.add":
            return [{ action: "put", storeName: "storyListItems", record: { ...operation.record, saveId } }];

        case "story.list.remove":
            return [{
                action: "delete",
                storeName: "storyListItems",
                key: [saveId, operation.root, operation.listPathKey, operation.itemKey]
            }];

        case "scene.member.add":
            return [{ action: "put", storeName: "sceneMembers", record: { saveId, characterId: operation.characterId } }];

        case "scene.member.remove":
            return [{ action: "delete", storeName: "sceneMembers", key: [saveId, operation.characterId] }];

        case "item.put":
            return [{ action: "put", storeName: "items", record: { ...operation.item, saveId } }];

        case "equipment.set":
            return [{ action: "put", storeName: "equippedItems", record: { ...operation.record, saveId } }];

        case "save.session.close":
            return [{ action: "close-session" }];

        case "diagnostic.record.add":
        case "diagnostic.record.put":
        case "diagnostic.record.delete": {
            if (!diagnostic)
                throw new Error(`${operation.type} is restricted to the diagnostic harness.`);

            validateDiagnosticStoreAccess(operation.storeName);

            if (operation.type === "diagnostic.record.delete")
                return [{ action: "delete", storeName: operation.storeName, key: operation.key }];

            const diagnosticRecord = { ...operation.record };

            if (Object.prototype.hasOwnProperty.call(Schema.stores[operation.storeName].fields, "saveId"))
                diagnosticRecord.saveId = diagnosticRecord.saveId ?? saveId;

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

function convertTransaction(envelope) {
    if (!Array.isArray(envelope.operations) || envelope.operations.length === 0)
        throw new Error("Transaction operations are required.");

    const recordOperations = [];

    for (const operation of envelope.operations)
        recordOperations.push(...convertDomainOperation(envelope.saveId, operation, envelope.diagnostic === true));

    const closeCount = recordOperations.filter((operation) => operation.action === "close-session").length;

    if (closeCount > 0 && (closeCount !== 1 || recordOperations.length !== 1))
        throw new Error("save.session.close must be the only operation in its transaction.");

    return recordOperations;
}

//#endregion Domain Conversion




//#region Generic Record Writer

function applyRecordOperation(transaction, recordOperation, saveId, done) {
    if (recordOperation.action === "close-session") {
        done();
        return;
    }

    const store = transaction.objectStore(recordOperation.storeName);

    if (recordOperation.action === "delete") {
        if (!isValidKeyPart(recordOperation.key))
            throw new Error(`${recordOperation.storeName} delete key is invalid.`);

        const request = store.delete(recordOperation.key);
        request.onsuccess = done;
        return;
    }

    if (recordOperation.action === "merge") {
        if (!isValidKeyPart(recordOperation.key))
            throw new Error(`${recordOperation.storeName} merge key is invalid.`);

        const getRequest = store.get(recordOperation.key);
        getRequest.onsuccess = () => {
            const mergedRecord = {
                ...recordOperation.defaults,
                ...(getRequest.result || {}),
                ...(recordOperation.values || {})
            };

            validateRecord(recordOperation.storeName, mergedRecord, saveId);

            const putRequest = store.put(mergedRecord);
            putRequest.onsuccess = done;
        };
        return;
    }

    validateRecord(recordOperation.storeName, recordOperation.record, saveId);

    const request = recordOperation.action === "add"
        ? store.add(recordOperation.record)
        : store.put(recordOperation.record);
    request.onsuccess = done;
}

function writeTransaction(queue, envelope, recordOperations) {
    return openDatabase().then((database) => new Promise((resolve, reject) => {
        const closeSession = recordOperations.some((operation) => operation.action === "close-session");
        const affectedStoreNames = Array.from(new Set([
            "saveCommitState",
            ...recordOperations
                .filter((operation) => operation.storeName != null)
                .map((operation) => operation.storeName)
        ]));
        let transaction;

        try {
            transaction = database.transaction(affectedStoreNames, "readwrite", { durability: "strict" });
        }
        catch (error) {
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
                    applyRecordOperation(transaction, recordOperation, envelope.saveId, writeNext);
                }
                catch (error) {
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

    while (fingerprints.size > 256)
        fingerprints.delete(fingerprints.keys().next().value);
}

function processActiveQueue() {
    if (activeQueue == null || activeQueue.processing)
        return;

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
    }
    catch (error) {
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

    setPhase("opening-transaction", queuedTransaction.envelope.changeId);

    writeTransaction(activeQueue, queuedTransaction.envelope, recordOperations).then((result) => {
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
    }).catch((error) => {
        activeQueue.processing = false;
        activeQueue.processingChangeId = null;
        setPhase("transaction-failed", queuedTransaction.envelope.changeId);
        postFailure(queuedTransaction.requestId, error);
    });
}

function receiveTransaction(requestId, envelope) {
    if (!Number.isInteger(envelope?.saveId) || !Number.isInteger(envelope?.sesNum) || !Number.isInteger(envelope?.changeId))
        throw new Error("saveId, sesNum, and changeId must be integers.");

    if (!Array.isArray(envelope.operations) || envelope.operations.length < 1 || envelope.operations.length > 500)
        throw new Error("A save transaction must contain from 1 through 500 domain operations.");

    const queue = queuesBySaveId.get(envelope.saveId);

    if (queue == null)
        throw new Error(`Save ${envelope.saveId} does not have an active or buffered session.`);

    if (queue.sesNum !== envelope.sesNum)
        throw new Error(`Save ${envelope.saveId} expected session ${queue.sesNum}, received ${envelope.sesNum}.`);

    const fingerprint = transactionFingerprint(envelope);
    const fingerprintKey = `${envelope.sesNum}:${envelope.changeId}`;
    const committedFingerprint = committedFingerprintsBySaveId.get(envelope.saveId)?.get(fingerprintKey);

    if (envelope.changeId <= queue.comId) {
        if (committedFingerprint != null && committedFingerprint !== fingerprint)
            throw new Error(`Conflicting committed transaction ${envelope.saveId}/${fingerprintKey}.`);

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
        if (existing.fingerprint !== fingerprint)
            throw new Error(`Conflicting pending transaction ${envelope.saveId}/${fingerprintKey}.`);

        existing.requestId = requestId;
        return;
    }

    queue.pendingByChangeId.set(envelope.changeId, { requestId, envelope, fingerprint });

    if (envelope.changeId > queue.nextExpectedChangeId && queue.processingChangeId !== queue.nextExpectedChangeId) {
        postMessageToController({
            type: "persistence.resend.requested",
            saveId: envelope.saveId,
            sesNum: envelope.sesNum,
            missingChangeId: queue.nextExpectedChangeId,
            receivedChangeId: envelope.changeId
        });
    }

    if (activeQueue === queue)
        processActiveQueue();
}

function receiveTransactionChunk(message) {
    const envelope = message.envelope;

    if (!Number.isInteger(envelope?.saveId) || !Number.isInteger(envelope?.sesNum) || !Number.isInteger(envelope?.changeId))
        throw new Error("Chunked transaction identity is invalid.");

    if (!Number.isInteger(message.startIndex) || message.startIndex < 0 || !Array.isArray(message.operations))
        throw new Error("Chunked transaction payload is invalid.");

    let staged = transactionChunksByRequestId.get(message.requestId);

    if (staged == null) {
        if (message.startIndex !== 0)
            throw new Error("The first transaction chunk must start at operation zero.");

        staged = { envelope, operations: [] };
        transactionChunksByRequestId.set(message.requestId, staged);
    }

    if (staged.operations.length !== message.startIndex)
        throw new Error("Transaction chunks must arrive once and in order.");

    if (staged.envelope.saveId !== envelope.saveId || staged.envelope.sesNum !== envelope.sesNum || staged.envelope.changeId !== envelope.changeId)
        throw new Error("Transaction chunk identity changed during transfer.");

    staged.operations.push(...message.operations);

    if (staged.operations.length > 500) {
        transactionChunksByRequestId.delete(message.requestId);
        throw new Error("A chunked save transaction cannot exceed 500 domain operations.");
    }

    if (message.complete === true) {
        transactionChunksByRequestId.delete(message.requestId);
        receiveTransaction(message.requestId, { ...staged.envelope, operations: staged.operations });
    }
}

//#endregion Save Queues




//#region Save Lifecycle

function acquireSaveLock(saveId, waitMilliseconds = 0, steal = false) {
    if (activeSaveLockRelease != null)
        return Promise.reject(new Error("This persistence worker already owns a save lock."));

    if (navigator.locks == null)
        return Promise.reject(new Error("This browser does not support the Web Locks API required for exclusive save ownership."));

    const lockName = `emberadventures-save-${saveId}`;

    if (steal) {
        return new Promise((resolve, reject) => {
            navigator.locks.request(lockName, { mode: "exclusive", steal: true }, (lock) => {
                activeSaveLockName = lockName;
                return new Promise((release) => {
                    activeSaveLockRelease = release;
                    resolve(true);
                });
            }).catch(reject);
        });
    }

    const deadline = performance.now() + waitMilliseconds;

    return new Promise((resolve, reject) => {
        const attempt = () => {
            navigator.locks.request(lockName, { mode: "exclusive", ifAvailable: true }, (lock) => {
                if (lock == null) {
                    if (performance.now() < deadline) {
                        setTimeout(attempt, 25);
                        return undefined;
                    }

                    resolve(false);
                    return undefined;
                }

                activeSaveLockName = lockName;
                return new Promise((release) => {
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
    return openDatabase().then((database) => new Promise((resolve, reject) => {
        const initialRecords = Array.isArray(message.initialRecords) ? message.initialRecords : [];
        const storeNames = Array.from(new Set([
            "saveHeaders",
            "saveCommitState",
            ...initialRecords.map((record) => record.storeName)
        ]));

        for (const storeName of storeNames)
            validateStoreName(storeName);

        for (const initialRecord of initialRecords) {
            if (!Object.prototype.hasOwnProperty.call(Schema.stores[initialRecord.storeName].fields, "saveId"))
                throw new Error(`Initial save record ${initialRecord.storeName} is not save-owned.`);

            validateRecord(initialRecord.storeName, { ...initialRecord.record, saveId: 1 }, 1);
        }

        const transaction = database.transaction(storeNames, "readwrite", { durability: "strict" });
        const header = { ...message.header };
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
                const record = { ...initialRecord.record, saveId };

                validateRecord(initialRecord.storeName, record, saveId);
                transaction.objectStore(initialRecord.storeName).add(record);
            }
        };
        transaction.oncomplete = () => resolve({ saveId });
        transaction.onabort = () => reject(transaction.error || new Error("Creating the save failed."));
        transaction.onerror = () => {};
    }));
}

function readCommitState(saveId) {
    return openDatabase().then((database) => {
        const transaction = database.transaction("saveCommitState", "readonly");
        return indexedDbRequest(transaction.objectStore("saveCommitState").get(saveId));
    });
}

function writeActivatedCommitState(commitState) {
    return openDatabase().then((database) => {
        const transaction = database.transaction("saveCommitState", "readwrite", { durability: "strict" });
        transaction.objectStore("saveCommitState").put(commitState);
        return indexedDbTransactionComplete(transaction);
    });
}

function activateSaveRequest(message) {
    if (activeQueue != null) {
        if (pendingActivation != null)
            throw new Error("Only one pending save activation is allowed.");

        pendingActivation = message;
        startHealth();
        postHealth();
        return Promise.resolve(NoResponse);
    }

    return acquireSaveLock(message.saveId).then((acquired) => {
        if (!acquired)
            throw new Error(`Save ${message.saveId} is already open in another tab.`);

        return readCommitState(message.saveId);
    }).then((commitState) => {
        if (commitState == null)
            throw new Error(`Save ${message.saveId} does not exist.`);

        const activatedState = {
            saveId: message.saveId,
            sesNum: commitState.sesNum + 1,
            comId: 0,
            isOpen: true,
            time: Date.now()
        };

        return writeActivatedCommitState(activatedState).then(() => {
            activeSaveId = message.saveId;
            activeQueue = queueForSession(message.saveId, activatedState.sesNum, 0);
            setPhase("idle", null);

            return activatedState;
        });
    }).catch((error) => {
        if (activeSaveId == null)
            releaseSaveLock();
        throw error;
    });
}

function resumeSaveRequest(message) {
    if (activeQueue != null)
        throw new Error("Cannot resume while another save is active.");

    return acquireSaveLock(message.saveId, 0, true).then((acquired) => {
        if (!acquired)
            throw new Error(`Save ${message.saveId} is already open in another tab.`);

        return readCommitState(message.saveId);
    }).then((commitState) => {
        if (commitState == null || !commitState.isOpen)
            throw new Error(`Save ${message.saveId} has no open persistence session to resume.`);

        activeSaveId = message.saveId;
        activeQueue = queueForSession(message.saveId, commitState.sesNum, commitState.comId);
        setPhase("idle", null);

        return commitState;
    }).catch((error) => {
        if (activeSaveId == null)
            releaseSaveLock();
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

    activateSaveRequest(message).then((result) => {
        postResponse(message.requestId, result);
    }).catch((error) => postFailure(message.requestId, error));
}

//#endregion Save Lifecycle




//#region Loading, Paging, And Deletion

function recordsForSave(database, storeName, saveId) {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    if (storeName === "saveHeaders")
        return indexedDbRequest(store.get(saveId)).then((value) => value == null ? [] : [value]);

    return indexedDbRequest(store.index("bySave").getAll(IDBKeyRange.only(saveId)));
}

function newestMessages(database, saveId, limit, beforeSequence = Infinity) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500)
        return Promise.reject(new Error("Message page limit must be an integer from 1 through 500."));

    if (beforeSequence !== Infinity && (!Number.isFinite(beforeSequence) || beforeSequence < 1))
        return Promise.reject(new Error("beforeSequence must be a positive finite number or Infinity."));

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

function loadSave(message) {
    return openDatabase().then((database) => readCommitState(message.saveId).then((commitState) => {
        if (commitState == null)
            throw new Error(`Save ${message.saveId} does not exist.`);

        const saveOwnedStoreNames = Object.entries(Schema.stores)
            .filter(([name, store]) => name !== "messages" && Object.prototype.hasOwnProperty.call(store.fields, "saveId"))
            .map(([name]) => name);
        const recordsByStore = {};

        setPhase("loading", null);
        startHealth();

        return Promise.all(saveOwnedStoreNames.map((storeName) => {
            return recordsForSave(database, storeName, message.saveId).then((records) => {
                recordsByStore[storeName] = records;
            });
        })).then(() => newestMessages(database, message.saveId, message.messageLimit ?? 40)).then((messages) => {
            recordsByStore.messages = messages;
            const storeNames = Object.keys(recordsByStore);

            for (const storeName of storeNames) {
                const records = recordsByStore[storeName];

                for (let index = 0; index < records.length; index += 100) {
                    postMessageToController({
                        type: "save.load.chunk",
                        requestId: message.requestId,
                        storeName,
                        records: records.slice(index, index + 100)
                    });
                }
            }

            setPhase("idle", null);
            stopHealthIfIdle();

            return {
                saveId: message.saveId,
                chunked: true,
                storeNames,
                messagePage: {
                    count: messages.length,
                    oldestSequence: messages[0]?.sequence ?? null,
                    newestSequence: messages[messages.length - 1]?.sequence ?? null
                }
            };
        });
    }));
}

function deleteSaveRecords(message) {
    if (activeSaveId === message.saveId)
        throw new Error("An active save must close before deletion.");

    return openDatabase().then(async (database) => {
        const childStoreNames = Object.entries(Schema.stores)
            .filter(([name, store]) => {
                return Object.prototype.hasOwnProperty.call(store.fields, "saveId")
                    && name !== "saveHeaders"
                    && name !== "saveCommitState";
            })
            .map(([name]) => name);
        let deletedRecords = 0;
        startHealth();
        setPhase("deleting", null);

        try {
            for (const storeName of childStoreNames) {
                let hasMore = true;

                while (hasMore) {
                    const transaction = database.transaction(storeName, "readwrite", { durability: "relaxed" });
                    const store = transaction.objectStore(storeName);
                    const keys = await indexedDbRequest(store.index("bySave").getAllKeys(IDBKeyRange.only(message.saveId), 50));

                    for (const key of keys)
                        store.delete(key);

                    await indexedDbTransactionComplete(transaction);
                    deletedRecords += keys.length;
                    hasMore = keys.length === 50;
                    postHealth();

                    if (hasMore)
                        await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            const finalTransaction = database.transaction(["saveCommitState", "saveHeaders"], "readwrite", { durability: "strict" });
            finalTransaction.objectStore("saveCommitState").delete(message.saveId);
            finalTransaction.objectStore("saveHeaders").delete(message.saveId);
            await indexedDbTransactionComplete(finalTransaction);
            deletedRecords += 2;
            setPhase("idle", null);
            stopHealthIfIdle();

            return { saveId: message.saveId, deletedRecords };
        }
        catch (error) {
            setPhase("idle", null);
            stopHealthIfIdle();
            throw error;
        }
    });
}

function countStoreRecords(message) {
    validateStoreName(message.storeName);

    return openDatabase().then((database) => {
        const transaction = database.transaction(message.storeName, "readonly");
        const store = transaction.objectStore(message.storeName);

        if (message.saveId != null && store.indexNames.contains("bySave"))
            return indexedDbRequest(store.index("bySave").count(IDBKeyRange.only(message.saveId)));

        return indexedDbRequest(store.count());
    });
}

function getRecord(message) {
    validateStoreName(message.storeName);

    return openDatabase().then((database) => {
        const transaction = database.transaction(message.storeName, "readonly");
        return indexedDbRequest(transaction.objectStore(message.storeName).get(message.key));
    });
}

function getImmutableDefinition(message) {
    const storesByKind = {
        story: "storyDefinitions",
        character: "authoredCharacterDefinitions"
    };
    const storeName = storesByKind[message.kind];

    if (!storeName)
        return Promise.reject(new Error("Definition kind must be story or character."));
    if (!String(message.id || "").trim() || !String(message.revisionId || "").trim())
        return Promise.reject(new Error("Definition id and revisionId are required."));

    return openDatabase().then((database) => {
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

    if (!storeName)
        return Promise.reject(new Error("Library kind must be story or character."));

    const offset = Number.isInteger(message.offset) && message.offset >= 0 ? message.offset : 0;
    const limit = Number.isInteger(message.limit) ? message.limit : 60;

    if (limit < 1 || limit > 200)
        return Promise.reject(new Error("Library page limit must be from 1 through 200."));

    const query = String(message.query || "").trim().toLowerCase().slice(0, 160);

    return openDatabase().then(async (database) => {
        const transaction = database.transaction(storeName, "readonly");
        let entries = await indexedDbRequest(transaction.objectStore(storeName).getAll());

        if (query) {
            entries = entries.filter((entry) => {
                const searchableValues = message.kind === "story"
                    ? [entry.title, entry.description, entry.source, entry.creator, ...(entry.genres || [])]
                    : [entry.name, entry.fallbackName, entry.role, entry.source, entry.creator, entry.gender, ...(entry.genres || [])];

                return searchableValues.some((value) => String(value || "").toLowerCase().includes(query));
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

    return openDatabase().then((database) => {
        const transaction = database.transaction(message.storeName, "readwrite", { durability: "strict" });
        transaction.objectStore(message.storeName).put(message.record);

        return indexedDbTransactionComplete(transaction).then(() => ({ seeded: true }));
    });
}

function seedDiagnosticRecords(message) {
    if (!Array.isArray(message.records) || message.records.length < 1 || message.records.length > 500)
        return Promise.reject(new Error("Diagnostic record batches must contain 1 through 500 records."));

    for (const entry of message.records) {
        validateStoreName(entry.storeName);
        validateRecord(entry.storeName, entry.record);
    }

    const storeNames = Array.from(new Set(message.records.map((entry) => entry.storeName)));

    return openDatabase().then((database) => {
        const transaction = database.transaction(storeNames, "readwrite", { durability: "strict" });

        for (const entry of message.records)
            transaction.objectStore(entry.storeName).put(entry.record);

        return indexedDbTransactionComplete(transaction).then(() => ({ seeded: message.records.length }));
    });
}

function validateDiagnosticRecord(message) {
    validateRecord(message.storeName, message.record, message.expectedSaveId ?? null);
    return Promise.resolve({ valid: true });
}

//#endregion Loading, Paging, And Deletion




//#region Request Routing

function inspectSchema() {
    return openDatabase().then((database) => {
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
            return resetDatabase().then(() => ({ reset: true }));

        case "schema.inspect":
            return inspectSchema();

        case "save.create":
            return createSave(message);

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
            return readCommitState(message.saveId);

        case "save.load":
            return loadSave(message);

        case "messages.page":
            return openDatabase().then((database) => newestMessages(
                database,
                message.saveId,
                message.limit ?? 40,
                message.beforeSequence
            ));

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

        case "diagnostic.record.seed":
            return seedDiagnosticRecord(message);

        case "diagnostic.records.seed":
            return seedDiagnosticRecords(message);

        case "diagnostic.record.validate":
            return validateDiagnosticRecord(message);

        case "diagnostic.fault.set":
            fault = message.fault;
            return Promise.resolve({ fault });

        case "persistence.status":
            postHealth();
            return Promise.resolve({ activeSaveId, activeSessionNumber: activeQueue?.sesNum ?? null });

        default:
            throw new Error(`Unknown worker request type: ${message.type}.`);
    }
}

self.onmessage = (event) => {
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
    }
    catch (error) {
        postFailure(message.requestId, error);
        return;
    }

    if (result === NoResponse)
        return;

    Promise.resolve(result).then((value) => {
        if (value !== NoResponse)
            postResponse(message.requestId, value);
    }).catch((error) => postFailure(message.requestId, error));
};

self.addEventListener("unhandledrejection", (event) => {
    postMessageToController({
        type: "worker.unhandledrejection",
        error: event.reason?.message || String(event.reason)
    });
});

//#endregion Request Routing
