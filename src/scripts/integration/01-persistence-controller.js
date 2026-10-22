"use strict";

const EmberPersistence = {};

EmberPersistence.Controller = class Controller extends EventTarget {
    constructor(workerUrl, options = {}) {
        super();

        this.workerUrl = workerUrl;
        this.watchdogMilliseconds = options.watchdogMilliseconds || 30000;
        this.initializeWatchdogMilliseconds = options.initializeWatchdogMilliseconds || 30000;
        this.replacementWatchdogMilliseconds = options.replacementWatchdogMilliseconds || 30000;
        this.imageImportWatchdogMilliseconds = options.imageImportWatchdogMilliseconds || 120000;
        this.visibilityProvider = options.visibilityProvider || (() => document.visibilityState);

        this.worker = null;
        this.workerGeneration = 0;
        this.nextRequestId = 1;
        this.requestsById = new Map();
        this.pendingSavesById = new Map();
        this.activeSaveState = null;
        this.activeSnapshotId = "";
        this.lastWorkerContactAt = 0;
        this.lastRequestPostedAt = 0;
        this.lastHealth = null;
        this.watchdogTimeoutId = null;
        this.watchdogConfirmationMilliseconds = options.watchdogConfirmationMilliseconds || 100;
        this.outboundTransactionEntries = [];
        this.outboundPumpTimeoutId = null;
        this.replacingWorker = false;
        this.started = false;

        document.addEventListener("visibilitychange", this.onVisibilityChanged);
    }

    //#region Lifecycle

    start = () => {
        if (this.started)
            return Promise.resolve(this.schemaInfo);

        this.started = true;
        this.createWorker();

        return this.request("system.initialize")
            .then((schemaInfo) => {
                this.schemaInfo = schemaInfo;
                this.dispatchStatus("ready", schemaInfo);

                return schemaInfo;
            })
            .catch((error) => {
                if (this.replacingWorker && this.replacementPromise)
                    return this.replacementPromise.then(() => this.schemaInfo);

                this.started = false;
                throw error;
            });
    }

    dispose = () => {
        clearTimeout(this.watchdogTimeoutId);
        clearTimeout(this.outboundPumpTimeoutId);
        this.watchdogTimeoutId = null;
        this.outboundPumpTimeoutId = null;
        this.outboundTransactionEntries.length = 0;
        document.removeEventListener("visibilitychange", this.onVisibilityChanged);

        if (this.worker != null)
            this.worker.terminate();

        this.worker = null;
        this.started = false;
        this.activeSnapshotId = "";
    }

    createWorker = () => {
        this.workerGeneration++;
        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = this.onWorkerMessage;
        this.worker.onerror = this.onWorkerError;
        this.worker.onmessageerror = this.onWorkerMessageError;
        this.lastWorkerContactAt = performance.now();
        this.dispatchStatus("worker-started", { generation: this.workerGeneration });
    }

    replaceWorker = (reason = "manual replacement") => {
        if (this.replacingWorker)
            return this.replacementPromise;

        this.replacingWorker = true;
        const priorActiveState = this.activeSaveState == null
            ? null
            : { ...this.activeSaveState };

        this.dispatchStatus("worker-replacing", { reason, generation: this.workerGeneration });
        clearTimeout(this.watchdogTimeoutId);
        clearTimeout(this.outboundPumpTimeoutId);
        this.watchdogTimeoutId = null;
        this.outboundPumpTimeoutId = null;

        for (const entry of this.outboundTransactionEntries)
            entry.outboundQueued = false;

        this.outboundTransactionEntries.length = 0;

        if (this.worker != null)
            this.worker.terminate();

        this.rejectControlRequests(new Error(`Persistence worker replaced: ${reason}.`));
        this.createWorker();

        let replacementTimeoutId = null;
        const replacementInitialization = this.request("system.initialize");
        const replacementTimeout = new Promise((resolve, reject) => {
            replacementTimeoutId = setTimeout(
                () => reject(
                    new Error(
                        `Persistence replacement worker did not initialize within ${Math.round(this.replacementWatchdogMilliseconds / 1000)} seconds.`,
                    ),
                ),
                this.replacementWatchdogMilliseconds,
            );
        });
        this.replacementPromise = Promise.race([
            replacementInitialization,
            replacementTimeout,
        ]).then((schemaInfo) => {
            this.schemaInfo = schemaInfo;

            if (priorActiveState == null)
                return null;

            return this.request("save.session.resume", { saveId: priorActiveState.saveId }).then((cursor) => {
                this.activeSaveState = {
                    saveId: cursor.saveId,
                    sesNum: cursor.sesNum,
                    nextChangeId: Math.max(priorActiveState.nextChangeId, cursor.comId + 1),
                    lastAcknowledgedChangeId: cursor.comId
                };

                return this.reconcilePendingSave(cursor);
            });
        }).then(() => {
            clearTimeout(replacementTimeoutId);
            this.replacingWorker = false;

            if (this.outboundTransactionEntries.length > 0 && this.outboundPumpTimeoutId == null)
                this.outboundPumpTimeoutId = setTimeout(this.pumpOutboundTransactions, 0);

            this.dispatchStatus("worker-replaced", { reason, generation: this.workerGeneration });
            this.updateWatchdog();
        }).catch((error) => {
            clearTimeout(replacementTimeoutId);
            this.rejectControlRequests(error);
            this.worker?.terminate();
            this.worker = null;
            this.replacingWorker = false;
            this.started = false;
            this.dispatchStatus("worker-replacement-failed", { reason, error: error.message });
            throw error;
        });

        return this.replacementPromise;
    }

    //#endregion Lifecycle




    //#region Worker Communication

    request = (type, values = {}) => {
        return new Promise((resolve, reject) => {
            const requestId = this.nextRequestId++;
            const request = {
                requestId,
                type,
                ...values
            };

            this.requestsById.set(requestId, {
                resolve,
                reject,
                type,
                transactionEntry: null,
                loadRecordsByStore: type === "save.load" ? {} : null
            });
            this.postRequest(request);
        });
    }

    postRequest = (request) => {
        this.lastRequestPostedAt = performance.now();
        this.updateWatchdog();

        try {
            this.worker.postMessage(request);
        }
        catch (error) {
            const pendingRequest = this.requestsById.get(request.requestId);

            if (pendingRequest?.transactionEntry == null) {
                this.requestsById.delete(request.requestId);
                pendingRequest?.reject(error);
            }
            else {
                this.requestsById.delete(request.requestId);
                pendingRequest.reject(error, pendingRequest.transactionEntry);
            }

            this.dispatchStatus("post-message-failed", {
                requestType: request.type,
                error: error.message
            });
        }
    }

    postTransactionEntry = (entry) => {
        if (entry.requestId == null) {
            entry.requestId = this.nextRequestId++;
            entry.nextOperationIndex = 0;
            entry.inFlight = true;
            this.requestsById.set(entry.requestId, {
                type: "save.transaction.submit",
                transactionEntry: entry,
                resolve: this.onTransactionAcknowledged,
                reject: this.onTransactionRejected
            });
        }

        const operations = entry.envelope.operations;

        if (operations.length <= 50) {
            this.postRequest({
                requestId: entry.requestId,
                type: "save.transaction.submit",
                envelope: entry.envelope
            });
            return;
        }

        const startIndex = entry.nextOperationIndex;
        const endIndex = Math.min(startIndex + 50, operations.length);
        entry.nextOperationIndex = endIndex;
        this.postRequest({
            requestId: entry.requestId,
            type: "save.transaction.chunk",
            envelope: {
                saveId: entry.envelope.saveId,
                sesNum: entry.envelope.sesNum,
                changeId: entry.envelope.changeId,
                transactionType: entry.envelope.transactionType,
                snapshotId: entry.envelope.snapshotId,
                diagnostic: entry.envelope.diagnostic
            },
            startIndex,
            operations: operations.slice(startIndex, endIndex),
            complete: endIndex === operations.length
        });

        if (endIndex < operations.length) {
            entry.outboundQueued = true;
            this.outboundTransactionEntries.push(entry);
        }
    }

    enqueueTransactionEntry = (entry) => {
        if (entry.outboundQueued || entry.inFlight)
            return;

        entry.outboundQueued = true;
        this.outboundTransactionEntries.push(entry);

        if (this.outboundPumpTimeoutId == null)
            this.outboundPumpTimeoutId = setTimeout(this.pumpOutboundTransactions, 0);
    }

    pumpOutboundTransactions = () => {
        this.outboundPumpTimeoutId = null;

        if (this.replacingWorker)
            return;

        const deadline = performance.now() + 2;
        let sentCount = 0;

        while (this.outboundTransactionEntries.length > 0 && sentCount < 8 && performance.now() < deadline) {
            const entry = this.outboundTransactionEntries.shift();
            entry.outboundQueued = false;
            this.postTransactionEntry(entry);
            sentCount++;
        }

        if (this.outboundTransactionEntries.length > 0)
            this.outboundPumpTimeoutId = setTimeout(this.pumpOutboundTransactions, 0);
    }

    onWorkerMessage = (event) => {
        this.lastWorkerContactAt = performance.now();
        this.updateWatchdog();

        const message = event.data;

        if (message.type === "persistence.health") {
            this.lastHealth = message;
            this.dispatchStatus("worker-health", message);
            return;
        }

        if (message.type === "persistence.resend.requested") {
            this.resendRequestedChange(message);
            return;
        }

        if (message.type === "save.load.chunk") {
            const pendingLoad = this.requestsById.get(message.requestId);

            if (pendingLoad?.loadRecordsByStore == null) {
                this.dispatchStatus("unexpected-load-chunk", message);
                return;
            }

            const records = pendingLoad.loadRecordsByStore[message.storeName] || [];
            records.push(...message.records);
            pendingLoad.loadRecordsByStore[message.storeName] = records;
            return;
        }

        if (message.type === "save.load.progress") {
            this.dispatchStatus("save-load-progress", message);
            return;
        }

        if (message.type !== "response") {
            this.dispatchStatus(message.type || "worker-message", message);
            return;
        }

        const pendingRequest = this.requestsById.get(message.requestId);

        if (pendingRequest == null) {
            this.dispatchStatus("unexpected-response", message);
            return;
        }

        this.requestsById.delete(message.requestId);

        if (message.ok && pendingRequest.loadRecordsByStore != null && message.value?.chunked) {
            for (const storeName of message.value.storeNames)
                pendingRequest.loadRecordsByStore[storeName] ||= [];

            message.value.recordsByStore = pendingRequest.loadRecordsByStore;
        }

        if (message.ok)
            pendingRequest.resolve(message.value, pendingRequest.transactionEntry);
        else
            pendingRequest.reject(new Error(message.error?.message || "Persistence worker request failed."), pendingRequest.transactionEntry);

        this.updateWatchdog();
    }

    onWorkerError = (event) => {
        event.preventDefault();
        this.dispatchStatus("worker-error", {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno
        });
        this.replaceWorker("worker error");
    }

    onWorkerMessageError = () => {
        this.dispatchStatus("worker-message-error", {});
        this.replaceWorker("worker message deserialization error");
    }

    rejectControlRequests = (error) => {
        for (const [requestId, pendingRequest] of this.requestsById) {
            if (pendingRequest.transactionEntry != null) {
                pendingRequest.transactionEntry.inFlight = false;
                pendingRequest.transactionEntry.requestId = null;
                pendingRequest.transactionEntry.nextOperationIndex = 0;
                this.requestsById.delete(requestId);
                continue;
            }

            this.requestsById.delete(requestId);
            pendingRequest.reject(error);
        }
    }

    //#endregion Worker Communication




    //#region Watchdog

    hasPendingWork = () => {
        if (this.requestsById.size > 0)
            return true;

        for (const pendingSave of this.pendingSavesById.values()) {
            if (pendingSave.unacknowledgedByChangeId.size > 0)
                return true;
        }

        return false;
    }

    currentWatchdogMilliseconds = () => {
        for (const request of this.requestsById.values())
            if (request.type === "images.import-all")
                return this.imageImportWatchdogMilliseconds;

        for (const request of this.requestsById.values())
            if (request.type === "system.initialize")
                return this.initializeWatchdogMilliseconds;

        return this.watchdogMilliseconds;
    }

    updateWatchdog = () => {
        clearTimeout(this.watchdogTimeoutId);
        this.watchdogTimeoutId = null;

        if (!this.hasPendingWork() || this.visibilityProvider() !== "visible" || this.replacingWorker)
            return;

        const elapsed = performance.now() - Math.max(
            this.lastWorkerContactAt,
            this.lastRequestPostedAt,
        );
        const remaining = Math.max(1, this.currentWatchdogMilliseconds() - elapsed);

        this.watchdogTimeoutId = setTimeout(this.onWatchdogExpired, remaining);
    }

    onWatchdogExpired = () => {
        if (!this.hasPendingWork() || this.visibilityProvider() !== "visible") {
            this.updateWatchdog();
            return;
        }

        const elapsed = performance.now() - Math.max(
            this.lastWorkerContactAt,
            this.lastRequestPostedAt,
        );

        if (elapsed < this.currentWatchdogMilliseconds()) {
            this.updateWatchdog();
            return;
        }

        //A long main-thread task can delay both this timer and an already-queued
        //worker health message. Give that message one task-turn to arrive before
        //destroying a worker that may have completed valid durable work.
        this.watchdogTimeoutId = setTimeout(
            this.confirmWatchdogExpired,
            this.watchdogConfirmationMilliseconds,
        );
    }

    confirmWatchdogExpired = () => {
        this.watchdogTimeoutId = null;

        if (!this.hasPendingWork() || this.visibilityProvider() !== "visible" || this.replacingWorker) {
            this.updateWatchdog();
            return;
        }

        const elapsed = performance.now() - Math.max(
            this.lastWorkerContactAt,
            this.lastRequestPostedAt,
        );

        const watchdogMilliseconds = this.currentWatchdogMilliseconds();
        if (elapsed < watchdogMilliseconds) {
            this.updateWatchdog();
            return;
        }

        this.dispatchStatus("worker-unresponsive", {
            elapsed,
            lastHealth: this.lastHealth,
            pendingRequestTypes: [...this.requestsById.values()].map((request) => request.type),
        });
        this.replaceWorker(`${Math.round(watchdogMilliseconds / 1000)} seconds without worker contact`);
    }

    onVisibilityChanged = () => {
        if (this.visibilityProvider() !== "visible") {
            clearTimeout(this.watchdogTimeoutId);
            this.watchdogTimeoutId = null;
            return;
        }

        if (!this.hasPendingWork())
            return;

        this.lastWorkerContactAt = performance.now();
        this.updateWatchdog();
    }

    //#endregion Watchdog




    //#region Save Lifecycle

    resetDatabase = () => {
        if (this.activeSaveState != null)
            return Promise.reject(new Error("Close the active save before resetting the database."));

        return this.request("database.reset").then((result) => {
            this.pendingSavesById.clear();
            return this.replaceWorker("database reset").then(() => result);
        });
    }

    putStoryDefinition = (definition, compiledIndexes) => this.request(
        "story.definition.put",
        { definition, compiledIndexes },
    );

    createSave = (header, initialRecords = []) => {
        const transferChunkSize = 50;

        if (!Array.isArray(initialRecords))
            return Promise.reject(new Error("Initial save records must be an array."));

        if (initialRecords.length <= transferChunkSize)
            return this.request("save.create", { header, initialRecords });

        return new Promise((resolve, reject) => {
            const requestId = this.nextRequestId++;
            let nextRecordIndex = 0;
            this.requestsById.set(requestId, {
                resolve,
                reject,
                type: "save.create.chunk",
                transactionEntry: null,
                loadRecordsByStore: null
            });
            this.postRequest({
                requestId,
                type: "save.create.begin",
                header,
                totalRecords: initialRecords.length
            });

            const postNextChunk = () => {
                if (!this.requestsById.has(requestId))
                    return;

                const startIndex = nextRecordIndex;
                const endIndex = Math.min(startIndex + transferChunkSize, initialRecords.length);
                nextRecordIndex = endIndex;
                this.postRequest({
                    requestId,
                    type: "save.create.chunk",
                    startIndex,
                    records: initialRecords.slice(startIndex, endIndex),
                    complete: endIndex === initialRecords.length
                });

                if (endIndex < initialRecords.length)
                    setTimeout(postNextChunk, 0);
            };

            setTimeout(postNextChunk, 0);
        });
    }

    activateSave = (saveId) => {
        if (this.activeSaveState != null)
            return Promise.reject(new Error("Close the active save before activating another save."));

        return this.request("save.session.activate", { saveId }).then((cursor) => {
            this.activeSaveState = {
                saveId,
                sesNum: cursor.sesNum,
                nextChangeId: 1,
                lastAcknowledgedChangeId: 0
            };
            this.pendingSavesById.set(saveId, {
                saveId,
                sesNum: cursor.sesNum,
                unacknowledgedByChangeId: new Map()
            });
            this.activeSnapshotId = "";

            return cursor;
        });
    }

    closeActiveSave = () => {
        if (this.activeSaveState == null)
            return Promise.reject(new Error("No save is active."));

        const closingSaveId = this.activeSaveState.saveId;
        const commit = this.activeSnapshotId
            ? this.commitSnapshot(this.activeSnapshotId)
            : Promise.resolve();

        return commit.then(() => this.submitOperations("save-closeout", [{ type: "save.session.close" }])).then((result) => {
            this.activeSaveState = null;
            this.pendingSavesById.delete(closingSaveId);
            this.updateWatchdog();

            return result;
        });
    }

    abandonActiveSaveForTest = () => {
        if (this.outboundPumpTimeoutId != null) {
            clearTimeout(this.outboundPumpTimeoutId);
            this.outboundPumpTimeoutId = null;
        }

        for (const pendingSave of this.pendingSavesById.values()) {
            for (const entry of pendingSave.unacknowledgedByChangeId.values()) {
                if (!entry.settled) {
                    entry.settled = true;
                    entry.resolve({ abandoned: true });
                }
                entry.outboundQueued = false;
                entry.inFlight = false;
            }
        }

        this.outboundTransactionEntries.length = 0;
        this.pendingSavesById.clear();
        this.activeSaveState = null;
        this.activeSnapshotId = "";
        return this.replaceWorker("smoke rollback abandoned a synthetic save session");
    }

    //#endregion Save Lifecycle




    //#region Ordered Transactions

    assertCloneCompatible = (value, seen = new Set()) => {
        if (["function", "symbol"].includes(typeof value))
            throw new DOMException("Domain operation contains a value that cannot be cloned.", "DataCloneError");

        if (value == null || typeof value !== "object")
            return;

        if (seen.has(value))
            throw new DOMException("Cyclic domain operations are not supported.", "DataCloneError");

        if (value instanceof Blob || value instanceof Date || value instanceof ArrayBuffer || ArrayBuffer.isView(value))
            return;

        seen.add(value);

        if (value instanceof Map) {
            for (const [key, nestedValue] of value) {
                this.assertCloneCompatible(key, seen);
                this.assertCloneCompatible(nestedValue, seen);
            }
        }
        else if (value instanceof Set) {
            for (const nestedValue of value)
                this.assertCloneCompatible(nestedValue, seen);
        }
        else {
            for (const nestedValue of Object.values(value))
                this.assertCloneCompatible(nestedValue, seen);
        }

        seen.delete(value);
    }

    submitOperations = (transactionType, operations, options = {}) => {
        if (this.activeSaveState == null)
            return Promise.reject(new Error("No save session is active."));

        if (!Array.isArray(operations) || operations.length < 1 || operations.length > 500)
            return Promise.reject(new Error("A save transaction must contain from 1 through 500 domain operations."));

        try {
            for (const operation of operations)
                EmberPersistenceDomainOperationContract.assertExact(operation);
            this.assertCloneCompatible(operations);
        }
        catch (error) {
            return Promise.reject(error);
        }

        if (options.changeId != null && (!Number.isInteger(options.changeId) || options.changeId < 1))
            return Promise.reject(new Error("Explicit changeId must be a positive integer."));

        const changeId = options.changeId ?? this.activeSaveState.nextChangeId++;

        if (options.changeId != null)
            this.activeSaveState.nextChangeId = Math.max(this.activeSaveState.nextChangeId, changeId + 1);
        const envelope = {
            saveId: this.activeSaveState.saveId,
            sesNum: this.activeSaveState.sesNum,
            changeId,
            transactionType,
            snapshotId: (options.snapshotId ?? this.activeSnapshotId) || undefined,
            operations,
            diagnostic: options.diagnostic === true
        };

        return this.submitEnvelope(envelope);
    }

    beginSnapshot = (snapshot) => {
        if (this.activeSnapshotId)
            return Promise.reject(new Error(`Snapshot ${this.activeSnapshotId} is already active.`));

        const snapshotId = String(snapshot?.snapshotId || "").trim();

        if (!snapshotId)
            return Promise.reject(new Error("Snapshot id is required."));

        this.activeSnapshotId = snapshotId;
        return this.submitOperations("snapshot-begin", [{ type: "snapshot.begin", snapshot }], { snapshotId: "" })
            .catch((error) => {
                if (this.activeSnapshotId === snapshotId) this.activeSnapshotId = "";
                throw error;
            });
    }

    commitSnapshot = (snapshotId = this.activeSnapshotId) => {
        if (!snapshotId || snapshotId !== this.activeSnapshotId)
            return Promise.reject(new Error("The active snapshot does not match the requested snapshot."));

        this.activeSnapshotId = "";
        return this.submitOperations("snapshot-commit", [{
            type: "snapshot.commit",
            snapshotId,
            completedAt: new Date().toISOString()
        }], { snapshotId: "" }).catch((error) => {
            if (!this.activeSnapshotId) this.activeSnapshotId = snapshotId;
            throw error;
        });
    }

    rollbackSnapshot = (snapshotId = this.activeSnapshotId) => {
        const targetId = String(snapshotId || "").trim();

        if (!targetId)
            return Promise.reject(new Error("Snapshot id is required."));

        this.activeSnapshotId = "";
        return this.submitOperations("snapshot-rollback", [{ type: "snapshot.rollback", snapshotId: targetId }], { snapshotId: "" });
    }

    submitEnvelope = (envelope) => {
        const pendingSave = this.pendingSavesById.get(envelope.saveId);

        if (pendingSave == null || pendingSave.sesNum !== envelope.sesNum)
            return Promise.reject(new Error("Transaction does not match the active pending-save session."));

        if (pendingSave.unacknowledgedByChangeId.has(envelope.changeId))
            return Promise.reject(new Error(`Change ${envelope.changeId} is already pending.`));

        return new Promise((resolve, reject) => {
            const entry = {
                envelope,
                resolve,
                reject,
                settled: false,
                requestId: null,
                submittedAt: performance.now(),
                outboundQueued: false,
                inFlight: false,
                nextOperationIndex: 0
            };

            pendingSave.unacknowledgedByChangeId.set(envelope.changeId, entry);
            this.enqueueTransactionEntry(entry);
        });
    }

    replacePendingTransaction = (changeId, transactionType, operations) => {
        if (this.activeSaveState == null)
            throw new Error("No save session is active.");

        if (!Array.isArray(operations) || operations.length < 1 || operations.length > 500)
            throw new Error("A save transaction must contain from 1 through 500 domain operations.");

        const pendingSave = this.pendingSavesById.get(this.activeSaveState.saveId);
        const entry = pendingSave?.unacknowledgedByChangeId.get(changeId);

        if (entry == null)
            throw new Error(`Change ${changeId} is not pending.`);

        entry.envelope.transactionType = transactionType;
        entry.envelope.operations = structuredClone(operations);
        entry.requestId = null;
        entry.nextOperationIndex = 0;
        entry.lastError = null;

        const replacement = new Promise((resolve, reject) => {
            entry.resolve = resolve;
            entry.reject = reject;
            entry.settled = false;
        });

        this.enqueueTransactionEntry(entry);
        return replacement;
    }

    onTransactionAcknowledged = (value, entry) => {
        entry.inFlight = false;
        const pendingSave = this.pendingSavesById.get(value.saveId);

        if (pendingSave == null || pendingSave.sesNum !== value.sesNum)
            throw new Error("Transaction acknowledgement does not match a pending save session.");

        const pendingEntry = pendingSave.unacknowledgedByChangeId.get(value.changeId);

        if (pendingEntry !== entry)
            throw new Error("Transaction acknowledgement does not match the retained transaction.");

        pendingSave.unacknowledgedByChangeId.delete(value.changeId);

        if (this.activeSaveState?.saveId === value.saveId) {
            this.activeSaveState.lastAcknowledgedChangeId = Math.max(
                this.activeSaveState.lastAcknowledgedChangeId,
                value.changeId
            );
        }

        if (!entry.settled) {
            entry.settled = true;
            entry.resolve(value);
        }
        this.updateWatchdog();
    }

    onTransactionRejected = (error, entry) => {
        entry.inFlight = false;
        entry.requestId = null;
        entry.nextOperationIndex = 0;
        this.dispatchStatus("transaction-rejected", {
            saveId: entry.envelope.saveId,
            sesNum: entry.envelope.sesNum,
            changeId: entry.envelope.changeId,
            error: error.message
        });
        entry.lastError = error;
        if (!entry.settled) {
            entry.settled = true;
            entry.reject(error);
        }
        this.updateWatchdog();
    }

    resendRequestedChange = (message) => {
        const pendingSave = this.pendingSavesById.get(message.saveId);
        const entry = pendingSave?.unacknowledgedByChangeId.get(message.missingChangeId);

        if (entry == null) {
            this.dispatchStatus("missing-resend-transaction", message);
            return;
        }

        this.enqueueTransactionEntry(entry);
    }

    reconcilePendingSave = (cursor) => {
        const pendingSave = this.pendingSavesById.get(cursor.saveId);

        if (pendingSave == null)
            return Promise.resolve();

        if (pendingSave.sesNum !== cursor.sesNum)
            throw new Error("Persisted session does not match retained pending transactions.");

        const entriesToResend = [];

        for (const [changeId, entry] of pendingSave.unacknowledgedByChangeId) {
            if (changeId <= cursor.comId) {
                pendingSave.unacknowledgedByChangeId.delete(changeId);
                entry.resolve({
                    saveId: cursor.saveId,
                    sesNum: cursor.sesNum,
                    changeId,
                    alreadyCommitted: true,
                    affectedStoreNames: []
                });
            }
            else
                entriesToResend.push(entry);
        }

        entriesToResend.sort((left, right) => left.envelope.changeId - right.envelope.changeId);

        for (const entry of entriesToResend)
            this.enqueueTransactionEntry(entry);

        return Promise.resolve();
    }

    //#endregion Ordered Transactions




    //#region Read And Diagnostic API

    inspectSchema = () => this.request("schema.inspect");
    listSaves = (options = {}) => this.request("save.list", options);
    inspectSave = (saveId) => this.request("save.inspect", { saveId });
    loadSave = (saveId, messageLimit = 40) => this.request("save.load", { saveId, messageLimit });
    loadEarlierMessages = (saveId, beforeSequence, limit = 40) => this.request("messages.page", {
        saveId,
        beforeSequence,
        limit
    });
    listLibrary = (kind, options = {}) => this.request("library.list", { kind, ...options });
    getDefinition = (kind, id, revisionId) => this.request("definition.get", { kind, id, revisionId });
    deleteSave = (saveId) => this.request("save.delete", { saveId });
    renameSave = (saveId, displayName) => this.request("save.rename", { saveId, displayName });
    readCursor = (saveId) => this.request("save.cursor.get", { saveId });
    countRecords = (storeName, saveId = null) => this.request("diagnostic.count", { storeName, saveId });
    getRecord = (storeName, key) => this.request("diagnostic.record.get", { storeName, key });
    listSharedRecords = (storeName, options = {}) => this.request("shared.records.list", { storeName, ...options });
    putSharedRecords = (records) => this.request("shared.records.put", { records });
    deleteSharedImage = (storeName, key) => this.request("shared.image.delete", { storeName, key });
    listManagedImages = () => this.request("images.manage.list");
    deleteManagedImages = (references) => this.request("images.manage.delete", { references });
    beginSmokeImageIsolation = (runId) => this.request("smoke.images.begin", { runId });
    restoreSmokeImageIsolation = (baseline = null, options = {}) =>
        this.request("smoke.images.restore", {
            baseline,
            keepActive: options.keepActive === true,
        });
    seedRecord = (storeName, record) => this.request("diagnostic.record.seed", { storeName, record });
    seedRecords = (records) => this.request("diagnostic.records.seed", { records });
    seedMessages = (saveId, firstSequence, finalSequence) => this.request("diagnostic.messages.seed", {
        saveId,
        firstSequence,
        finalSequence
    });
    seedLibraryMetadata = (count) => this.request("diagnostic.library.seed", { count });
    validateRecord = (storeName, record, expectedSaveId = null) => this.request("diagnostic.record.validate", {
        storeName,
        record,
        expectedSaveId
    });
    setFault = (fault) => this.request("diagnostic.fault.set", { fault });
    exportSave = (saveId) => this.request("save.export", { saveId });
    importSave = (file) => {
        if (!(file instanceof Blob))
            return Promise.reject(new Error("Save import requires a File or Blob."));

        return this.request("save.import", { file });
    };
    exportAllImages = () => this.request("images.export-all");
    exportAllImageIndex = () => this.request("images.export-index");
    importAllImages = (file) => {
        if (!(file instanceof Blob))
            return Promise.reject(new Error("Image import requires a File or Blob."));

        return this.request("images.import-all", { file });
    };
    findSnapshotByMessage = (saveId, messageId) => this.request("snapshot.find-by-message", { saveId, messageId });
    listIncompleteSnapshots = (saveId) => this.request("snapshot.incomplete.list", { saveId });

    diagnosticState = () => ({
        requests: Array.from(this.requestsById, ([requestId, request]) => ({
            requestId,
            type: request.type,
            changeId: request.transactionEntry?.envelope.changeId ?? null
        })),
        pendingSaves: Array.from(this.pendingSavesById.values(), (save) => ({
            saveId: save.saveId,
            sesNum: save.sesNum,
            changes: Array.from(save.unacknowledgedByChangeId.keys())
        })),
        activeSaveState: this.activeSaveState == null ? null : { ...this.activeSaveState },
        activeSnapshotId: this.activeSnapshotId,
        replacingWorker: this.replacingWorker,
        outboundQueueLength: this.outboundTransactionEntries.length,
        outboundPumpScheduled: this.outboundPumpTimeoutId != null,
        pendingEntries: Array.from(this.pendingSavesById.values()).flatMap((save) =>
            Array.from(save.unacknowledgedByChangeId.values(), (entry) => ({
                saveId: save.saveId,
                changeId: entry.envelope.changeId,
                transactionType: entry.envelope.transactionType,
                operations: entry.envelope.operations.map((operation) => ({
                    type: operation.type,
                    messageId: operation.message?.messageId,
                    sequence: operation.message?.sequence
                })),
                outboundQueued: entry.outboundQueued,
                inFlight: entry.inFlight,
                requestId: entry.requestId,
                lastError: entry.lastError?.message || ""
            }))
        )
    });

    dispatchStatus = (status, detail) => {
        this.dispatchEvent(new CustomEvent("status", {
            detail: { status, detail, at: Date.now() }
        }));
    }

    //#endregion Read And Diagnostic API
};
