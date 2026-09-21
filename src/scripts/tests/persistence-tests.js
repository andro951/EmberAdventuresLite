"use strict";

const PersistenceDiagnostic = {};
PersistenceDiagnostic.TestRunner = class TestRunner {
  constructor(controller, options = {}) {
    this.controller = controller;
    this.setSimulatedVisibility = options.setSimulatedVisibility || (() => {});
    this.onTestChanged = options.onTestChanged || (() => {});
    this.onLog = options.onLog || (() => {});
    this.schema = options.schema || self.EmberStorageSchema;
    this.tests = [];
    this.currentSaveId = null;
    this.playerCharacterId = "diagnostic-player-001";
    this.defineTests();
  }

  //#region Test Registration

  defineTests = () => {
    this.addTest("Schema creates all 77 stores and indexes", this.testSchema);
    this.addTest("Record contract rejects missing, unknown, wrong-type, range, image, and oversized values", this.testRecordValidation);
    this.addTest("Failed initial save creation is fully atomic", this.testFailedCreateIsAtomic);
    this.addTest("Save creation and activation establish session one", this.testCreateAndActivate);
    this.addTest("Missing record and nonexistent save reads respond without hanging", this.testMissingReads);
    this.addTest("Invalid active-save lifecycle commands reject without changing the session", this.testInvalidLifecycleCommands);
    this.addTest("Oversized domain transactions reject without consuming a revision", this.testOversizedDomainTransaction);
    this.addTest("A second controller cannot write the same open save", this.testExclusiveSaveOwnership);
    this.addTest("Large initial save creation keeps the browser event loop responsive", this.testLargeInitialSaveResponsiveness);
    this.addTest("Large shared image blobs store and load without blocking the browser", this.testLargeBlobResponsiveness);
    this.addTest("Large story and character libraries page searchable metadata without loading definitions", this.testLibraryMetadataPaging);
    this.addTest("Representative records round-trip through every object store", this.testEveryStoreRoundTrip);
    this.addTest("Affection writes only relationship and commit records", this.testAffectionWriteScope);
    this.addTest("Partial relationship updates preserve untouched values", this.testPartialMergePreservesValues);
    this.addTest("Message append leaves prior messages unchanged", this.testMessageAppend);
    this.addTest("Turn snapshots restore changed records and remove related messages atomically", this.testSnapshotRollback);
    this.addTest("Normalized save export and import preserve immutable identity and save records", this.testSaveExportImport);
    this.addTest("All-images export and import restore shared image metadata and blobs", this.testAllImagesExportImport);
    this.addTest("Durable storage rejects temporary browser blob URLs", this.testTemporaryBlobUrlRejected);
    this.addTest("Idempotent story-list adds do not fail or duplicate", this.testIdempotentStoryListAdd);
    this.addTest("Character facts, scene members, items, equipment, and removals use their intended stores", this.testDomainOperationMatrix);
    this.addTest("Bounded record-set replacement removes stale rows and preserves other scopes", this.testBoundedRecordSetReplacement);
    this.addTest("Concurrent transaction burst commits every change in order", this.testConcurrentTransactionBurst);
    this.addTest("Out-of-order changes wait for the missing change", this.testOutOfOrderDelivery);
    this.addTest("Duplicate-key failure rolls back the whole transaction", this.testAtomicRollback);
    this.addTest("Objective rewards and invocation marker commit atomically", this.testObjectiveRewardTransaction);
    this.addTest("Duplicate reward invocation rolls back every reward effect", this.testDuplicateRewardRollback);
    this.addTest("Simulated quota failure preserves the revision for corrected retry", this.testQuotaFailureRetry);
    this.addTest("Uncloneable operations fail locally without creating a revision gap", this.testUncloneableOperation);
    this.addTest("Message paging loads newest and earlier pages", this.testMessagePaging);
    this.addTest("Invalid load and paging requests reject promptly", this.testInvalidReadArguments);
    this.addTest("Worker loss before commit replays exactly once", this.testCrashBeforeCommit);
    this.addTest("Worker loss after commit does not duplicate effects", this.testCrashAfterCommit);
    this.addTest("Worker replacement during a chunked transfer replays the transaction exactly once", this.testChunkedTransferReplacement);
    this.addTest("Five-second worker hang triggers ordered recovery", this.testWatchdogRecovery);
    this.addTest("Hidden state suppresses destructive watchdog recovery", this.testHiddenWatchdogSuppression);
    this.addTest("Large history does not make one new message expensive", this.testLargeHistoryConstantWrite);
    this.addTest("Large worker transaction keeps the browser event loop responsive", this.testLargeTransactionResponsiveness);
    this.addTest("Large save load keeps the browser event loop responsive", this.testLoadResponsiveness);
    this.addTest("Closeout commits in order and reopening increments session", this.testCloseAndReopen);
    this.addTest("Switching saves cannot leak records between saves", this.testSaveIsolation);
    this.addTest("Save deletion removes save records but preserves shared assets", this.testDeletePreservesSharedAssets);
    this.addTest("Controller finishes without orphan requests or retained save sessions", this.testNoOrphanControllerState);
  };
  addTest = (name, execute) => {
    this.tests.push({
      name,
      execute,
      status: "pending",
      duration: null,
      error: null,
      detail: null
    });
  };

  //#endregion Test Registration

  //#region Runner

  runAll = () => {
    for (const test of this.tests) {
      test.status = "pending";
      test.duration = null;
      test.error = null;
      test.detail = null;
      this.onTestChanged(test);
    }
    this.currentSaveId = null;
    this.setSimulatedVisibility("visible");
    return this.controller.resetDatabase().then(() => this.controller.seedRecords([{
      storeName: "storyDefinitions",
      record: this.sampleRecord("storyDefinitions", null)
    }, {
      storeName: "compiledStoryIndexes",
      record: this.sampleRecord("compiledStoryIndexes", null)
    }])).then(() => this.runTestAt(0)).then(() => {
      return {
        passed: this.tests.filter(test => test.status === "passed").length,
        failed: this.tests.filter(test => test.status === "failed").length,
        total: this.tests.length
      };
    });
  };
  runOne = index => {
    if (!Number.isInteger(index) || index < 0 || index >= this.tests.length) return Promise.reject(new Error(`Unknown persistence test ${index + 1}.`));
    const test = this.tests[index];
    test.status = "pending";
    test.duration = null;
    test.error = null;
    test.detail = null;
    this.currentSaveId = null;
    this.setSimulatedVisibility("visible");
    return this.controller.resetDatabase().then(() => this.controller.seedRecords([{
      storeName: "storyDefinitions",
      record: this.sampleRecord("storyDefinitions", null)
    }, {
      storeName: "compiledStoryIndexes",
      record: this.sampleRecord("compiledStoryIndexes", null)
    }])).then(() => this.runTestAt(index, index + 1));
  };
  runTestAt = (index, endIndex = this.tests.length) => {
    if (index >= endIndex) return Promise.resolve();
    const test = this.tests[index];
    const startedAt = performance.now();
    test.status = "running";
    this.onTestChanged(test);
    this.onLog(`Running: ${test.name}`);
    return Promise.resolve().then(test.execute).then(detail => {
      test.status = "passed";
      test.duration = performance.now() - startedAt;
      test.detail = detail || null;
      this.onTestChanged(test);
      this.onLog(`Passed: ${test.name} (${test.duration.toFixed(1)} ms)`);
    }).catch(error => {
      test.status = "failed";
      test.duration = performance.now() - startedAt;
      test.error = error;
      this.onTestChanged(test);
      this.onLog(`FAILED: ${test.name}: ${error.message}`);
    }).then(() => this.runTestAt(index + 1, endIndex));
  };

  //#endregion Runner

  //#region Assertions And Fixtures

  assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  assertEqual = (actual, expected, message) => {
    if (actual !== expected) throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  };
  delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  withTimeout = (promise, milliseconds, message) => {
    return Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error(message)), milliseconds))]);
  };
  expectRejected = (promise, expectedMessage) => {
    return Promise.resolve(promise).then(() => {
      throw new Error(`Expected rejection containing ${JSON.stringify(expectedMessage)}.`);
    }, error => {
      if (expectedMessage != null && !error.message.includes(expectedMessage)) throw new Error(`Expected rejection containing ${JSON.stringify(expectedMessage)}, got ${JSON.stringify(error.message)}.`);
      return error;
    });
  };
  ensureActiveSave = () => {
    if (this.currentSaveId != null && this.controller.activeSaveState != null) return Promise.resolve(this.controller.activeSaveState);
    return this.controller.createSave(this.saveHeader(), [this.playerRecord(), this.playerRelationshipRecord()]).then(created => {
      this.currentSaveId = created.saveId;
      return this.controller.activateSave(created.saveId);
    });
  };
  monitorResponsiveness = execute => {
    const intervalMilliseconds = 4;
    let previousAt = performance.now();
    let maximumDelay = 0;
    let delaysOverFrameBudget = 0;
    let sampleCount = 0;
    let phase = "warmup";
    const maximumDelayByPhase = {
      warmup: 0,
      execute: 0,
      cooldown: 0
    };
    const intervalId = setInterval(() => {
      const now = performance.now();
      const delay = Math.max(0, now - previousAt - intervalMilliseconds);
      previousAt = now;
      maximumDelay = Math.max(maximumDelay, delay);
      maximumDelayByPhase[phase] = Math.max(maximumDelayByPhase[phase], delay);
      sampleCount++;
      if (delay > 8.33) delaysOverFrameBudget++;
    }, intervalMilliseconds);
    return this.delay(20).then(() => {
      phase = "execute";
      return execute();
    }).then(value => {
      phase = "cooldown";
      return this.delay(20).then(() => value);
    }).then(value => {
      clearInterval(intervalId);
      return {
        value,
        maximumDelay,
        maximumDelayByPhase,
        delaysOverFrameBudget,
        sampleCount
      };
    }, error => {
      clearInterval(intervalId);
      throw error;
    });
  };
  waitForStatus = (statusName, milliseconds = 2000) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.controller.removeEventListener("status", onStatus);
        reject(new Error(`Timed out waiting for controller status ${statusName}.`));
      }, milliseconds);
      const onStatus = event => {
        if (event.detail.status !== statusName) return;
        clearTimeout(timeoutId);
        this.controller.removeEventListener("status", onStatus);
        resolve(event.detail);
      };
      this.controller.addEventListener("status", onStatus);
    });
  };
  saveHeader = () => ({
    storyId: this.schema.stores.storyDefinitions.fields.storyId.example,
    revisionId: this.schema.stores.storyDefinitions.fields.revisionId.example,
    playerCharacterId: this.playerCharacterId,
    displayName: "Persistence Diagnostic Save",
    storyGuidance: "Exercise only the persistence contract.",
    createdAt: Date.now()
  });
  playerRecord = () => ({
    storeName: "saveCharacterDefinitions",
    record: {
      characterId: this.playerCharacterId,
      definitionType: "humanoid",
      name: "Diagnostic Player",
      species: "human",
      physicalDescription: "",
      canDie: true,
      age: 30,
      gender: "female",
      personalityDescription: "Methodical and observant.",
      speechStyle: "Direct and concise.",
      boldness: 5
    }
  });
  playerRelationshipRecord = () => ({
    storeName: "characterRelationshipStats",
    record: {
      ...this.sampleRecord("characterRelationshipStats", null),
      characterId: this.playerCharacterId,
      trust: 0,
      attraction: 0,
      affection: 0
    }
  });
  messageRecord = (sequence, text = `Diagnostic message ${sequence}`) => ({
    messageId: `message-${sequence}`,
    sequence,
    role: sequence % 2 === 0 ? "assistant" : "user",
    speaker: sequence % 2 === 0 ? "Narrator" : "Diagnostic Player",
    text,
    detail: "normal",
    at: new Date(1785870000000 + sequence * 1000).toISOString()
  });
  sampleRecord = (storeName, saveId = this.currentSaveId) => {
    const store = this.schema.stores[storeName];
    const record = {};
    for (const [fieldName, field] of Object.entries(store.fields)) {
      if (field.typeSpec === "Blob") record[fieldName] = new Blob([`diagnostic-${storeName}`], {
        type: "application/octet-stream"
      });else record[fieldName] = structuredClone(field.example);
    }
    if (Object.prototype.hasOwnProperty.call(store.fields, "saveId")) record.saveId = saveId;
    return record;
  };
  sampleRecordKey = (storeName, record) => {
    const keyPath = this.schema.stores[storeName].keyPath;
    if (Array.isArray(keyPath)) return keyPath.map(fieldName => record[fieldName]);
    return record[keyPath];
  };

  //#endregion Assertions And Fixtures

  //#region Tests

  testSchema = () => {
    return this.controller.inspectSchema().then(schema => {
      this.assertEqual(schema.storeCount, 77, "Schema store count is wrong.");
      this.assertEqual(Object.keys(schema.stores).length, 77, "Schema inspection omitted stores.");
      for (const [storeName, store] of Object.entries(schema.stores)) {
        if (storeName === "saveHeaders" || !store.indexes.includes("bySave") && storeName.startsWith("save")) continue;
      }
      this.assert(schema.stores.messages.indexes.includes("bySequence"), "messages.bySequence is missing.");
      this.assert(schema.stores.characterRelationshipStats.indexes.includes("bySave"), "Save-owned bySave index is missing.");
      return `${schema.storeCount} stores verified`;
    });
  };
  testRecordValidation = () => {
    const validMessage = {
      saveId: 1,
      ...this.messageRecord(1)
    };
    const validations = [this.expectRejected(this.controller.validateRecord("messages", {
      ...validMessage,
      text: undefined
    }), "messages.text"), this.expectRejected(this.controller.validateRecord("messages", {
      ...validMessage,
      invented: true
    }), "not defined"), this.expectRejected(this.controller.validateRecord("messages", {
      ...validMessage,
      sequence: "one"
    }), "must match number"), this.expectRejected(this.controller.validateRecord("characterRelationshipStats", {
      saveId: 1,
      characterId: "validation-character",
      trust: 11,
      attraction: 0,
      affection: 0
    }), "from 0 through 10"), this.expectRejected(this.controller.validateRecord("messages", {
      ...validMessage,
      text: "data:image/png;base64,AAAA"
    }, 1), "embedded image data"), this.expectRejected(this.controller.validateRecord("messages", {
      ...validMessage,
      text: "x".repeat(262145)
    }, 1), "bounded-record limit"), this.expectRejected(this.controller.request("snapshot.incomplete.list", {
      saveId: "1"
    }), "saveId must be a positive safe integer"), this.expectRejected(this.controller.request("library.list", {
      kind: "story",
      offset: "0",
      limit: 60,
      query: ""
    }), "offset must be a safe integer")];
    return Promise.all(validations).then(() => this.controller.validateRecord("messages", validMessage, 1)).then(() => {
      return "six invalid record shapes and two coerced command fields rejected; valid record accepted";
    });
  };
  testFailedCreateIsAtomic = () => {
    let countBefore;
    return this.controller.countRecords("saveHeaders").then(count => {
      countBefore = count;
      const invalidPlayer = this.playerRecord();
      delete invalidPlayer.record.name;
      return this.expectRejected(this.controller.createSave(this.saveHeader(), [invalidPlayer]), "name is required");
    }).then(() => this.controller.countRecords("saveHeaders")).then(countAfter => {
      this.assertEqual(countAfter, countBefore, "Failed save creation left a save header behind.");
    });
  };
  testCreateAndActivate = () => {
    return this.controller.createSave(this.saveHeader(), [this.playerRecord(), this.playerRelationshipRecord()]).then(created => {
      this.currentSaveId = created.saveId;
      return this.controller.activateSave(created.saveId);
    }).then(cursor => {
      this.assertEqual(cursor.sesNum, 1, "First active session number is wrong.");
      this.assertEqual(cursor.comId, 0, "New session did not start at change zero.");
      this.assert(cursor.isOpen, "Activated session is not open.");
      return `save ${this.currentSaveId}, session ${cursor.sesNum}`;
    });
  };
  testMissingReads = () => {
    return Promise.all([this.withTimeout(this.controller.getRecord("storyValues", [this.currentSaveId, "missing", "missing"]), 1000, "Missing record read hung."), this.expectRejected(this.withTimeout(this.controller.loadSave(999999, 40), 1000, "Missing save load hung."), "does not exist")]).then(([record]) => {
      this.assert(record == null, "Missing record read returned a value.");
    });
  };
  testInvalidLifecycleCommands = () => {
    const session = this.controller.activeSaveState.sesNum;
    const nextChangeId = this.controller.activeSaveState.nextChangeId;
    return Promise.all([this.expectRejected(this.controller.resetDatabase(), "Close the active save"), this.expectRejected(this.controller.activateSave(this.currentSaveId), "Close the active save"), this.expectRejected(this.controller.deleteSave(this.currentSaveId), "must close before deletion"), this.expectRejected(this.controller.submitOperations("invalid-change", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey: "invalid-change",
        value: true
      }
    }], {
      changeId: 0
    }), "positive integer")]).then(() => {
      this.assertEqual(this.controller.activeSaveState.sesNum, session, "Rejected lifecycle command changed the session.");
      this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected lifecycle command consumed a change ID.");
    });
  };
  testOversizedDomainTransaction = () => {
    return this.ensureActiveSave().then(() => {
      const nextChangeId = this.controller.activeSaveState.nextChangeId;
      const operations = [];
      for (let index = 0; index < 501; index++) operations.push({
        type: "story.value.set",
        record: {
          root: "oversized",
          pathKey: `value-${index}`,
          value: index
        }
      });
      return this.expectRejected(this.controller.submitOperations("oversized-domain-transaction", operations), "1 through 500").then(() => {
        this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected oversized transaction consumed a revision.");
        return this.expectRejected(this.controller.submitOperations("unknown-domain-field", [{
          type: "character.relationship.set",
          characterId: this.playerCharacterId,
          values: {
            affection: 7
          },
          invented: true
        }]), "character.relationship.set.invented is not an approved domain-operation field.");
      }).then(() => {
        this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected unknown operation field consumed a revision.");
        return this.expectRejected(this.controller.submitOperations("missing-domain-field", [{
          type: "character.relationship.set",
          characterId: this.playerCharacterId
        }]), "character.relationship.set.values is required.");
      }).then(() => {
        this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected missing operation field consumed a revision.");
        return this.expectRejected(this.controller.submitOperations("malformed-domain-object", [{
          type: "character.relationship.set",
          characterId: this.playerCharacterId,
          values: []
        }]), "character.relationship.set.values must be an object.");
      }).then(() => {
        this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected malformed operation object consumed a revision.");
        return this.expectRejected(this.controller.submitOperations("malformed-domain-id", [{
          type: "character.relationship.set",
          characterId: ` ${this.playerCharacterId}`,
          values: {
            affection: 7
          }
        }]), "character.relationship.set.characterId must be nonblank text without leading or trailing whitespace.");
      }).then(() => {
        this.assertEqual(this.controller.activeSaveState.nextChangeId, nextChangeId, "Rejected malformed operation id consumed a revision.");
        return "oversized and malformed domain operations rejected without consuming a revision";
      });
    });
  };
  testExclusiveSaveOwnership = () => {
    const secondController = new EmberPersistence.Controller(this.controller.workerUrl, {
      watchdogMilliseconds: 5000,
      visibilityProvider: () => "visible"
    });
    return secondController.start().then(() => {
      return this.expectRejected(secondController.activateSave(this.currentSaveId), "already open in another tab");
    }).finally(() => secondController.dispose());
  };
  testLargeInitialSaveResponsiveness = () => {
    const initialRecords = [];
    let createdSaveId;
    for (let index = 0; index < 2000; index++) {
      initialRecords.push({
        storeName: "storyValues",
        record: {
          root: "initial",
          pathKey: `value-${index}`,
          value: index
        }
      });
    }
    return this.monitorResponsiveness(() => {
      return this.controller.createSave({
        ...this.saveHeader(),
        displayName: "Large Initial Diagnostic Save"
      }, initialRecords);
    }).then(measurement => {
      createdSaveId = measurement.value.saveId;
      const executeDelay = measurement.maximumDelayByPhase.execute;
      this.assert(executeDelay < 16.7, `Large initial save blocked the main event loop for ${executeDelay.toFixed(1)} ms (${JSON.stringify(measurement.maximumDelayByPhase)}).`);
      return this.controller.deleteSave(createdSaveId).then(() => measurement);
    }).then(measurement => {
      return `max delay ${measurement.maximumDelay.toFixed(1)} ms; ${measurement.delaysOverFrameBudget} samples over 8.33 ms`;
    });
  };
  testLargeBlobResponsiveness = () => {
    const imageId = "diagnostic-large-blob";
    const blob = new Blob([new Uint8Array(8 * 1024 * 1024)], {
      type: "image/png"
    });
    const record = {
      imageId,
      blob,
      mimeType: "image/png",
      byteLength: blob.size,
      contentHash: "diagnostic-large-blob-hash"
    };
    return this.monitorResponsiveness(() => this.controller.seedRecord("assetBlobs", record)).then(writeMeasurement => {
      const writeDelay = writeMeasurement.maximumDelayByPhase.execute;
      this.assert(writeDelay < 16.7, `Large Blob write blocked the main event loop for ${writeDelay.toFixed(1)} ms (${JSON.stringify(writeMeasurement.maximumDelayByPhase)}).`);
      return this.monitorResponsiveness(() => this.controller.getRecord("assetBlobs", imageId)).then(readMeasurement => ({
        writeMeasurement,
        readMeasurement
      }));
    }).then(({
      writeMeasurement,
      readMeasurement
    }) => {
      this.assertEqual(readMeasurement.value.blob.size, blob.size, "Large Blob round trip changed its size.");
      const readDelay = readMeasurement.maximumDelayByPhase.execute;
      this.assert(readDelay < 16.7, `Large Blob read blocked the main event loop for ${readDelay.toFixed(1)} ms (${JSON.stringify(readMeasurement.maximumDelayByPhase)}).`);
      return `8 MiB Blob; write delay ${writeMeasurement.maximumDelay.toFixed(1)} ms; read delay ${readMeasurement.maximumDelay.toFixed(1)} ms`;
    });
  };
  testLibraryMetadataPaging = async () => {
    const seedMeasurement = await this.monitorResponsiveness(() => this.controller.seedLibraryMetadata(1000));
    const storyMeasurement = await this.monitorResponsiveness(() => this.controller.listLibrary("story", {
      query: "Story 09",
      offset: 0,
      limit: 30
    }));
    const characterMeasurement = await this.monitorResponsiveness(() => this.controller.listLibrary("character", {
      query: "Character 09",
      offset: 10,
      limit: 20
    }));
    const seedDelay = seedMeasurement.maximumDelayByPhase.execute;
    const storyDelay = storyMeasurement.maximumDelayByPhase.execute;
    const characterDelay = characterMeasurement.maximumDelayByPhase.execute;
    this.assert(seedDelay < 16.7, `Large library seeding blocked the main event loop for ${seedDelay.toFixed(1)} ms (${JSON.stringify(seedMeasurement.maximumDelayByPhase)}).`);
    this.assert(storyDelay < 16.7, `Story library paging blocked the main event loop for ${storyDelay.toFixed(1)} ms (${JSON.stringify(storyMeasurement.maximumDelayByPhase)}).`);
    this.assert(characterDelay < 16.7, `Character library paging blocked the main event loop for ${characterDelay.toFixed(1)} ms (${JSON.stringify(characterMeasurement.maximumDelayByPhase)}).`);
    this.assertEqual(storyMeasurement.value.total, 100, "Story name filtering returned the wrong total.");
    this.assertEqual(storyMeasurement.value.entries.length, 30, "Story library page was not bounded.");
    this.assertEqual(characterMeasurement.value.total, 100, "Character name filtering returned the wrong total.");
    this.assertEqual(characterMeasurement.value.entries.length, 20, "Character library page was not bounded.");
    this.assert(!storyMeasurement.value.entries.some(entry => "objectives" in entry || "state" in entry), "Story library paging returned full definition data.");
    this.assert(!characterMeasurement.value.entries.some(entry => "appearance" in entry || "outfits" in entry), "Character library paging returned full definition data.");
    return `2,000 metadata records; max delays ${seedMeasurement.maximumDelay.toFixed(1)}, ${storyMeasurement.maximumDelay.toFixed(1)}, and ${characterMeasurement.maximumDelay.toFixed(1)} ms`;
  };
  testEveryStoreRoundTrip = () => {
    const sharedStoreNames = [];
    const saveOwnedStoreNames = [];
    const operations = [];
    const recordsByStore = new Map();
    for (const [storeName, store] of Object.entries(this.schema.stores)) {
      if (["saveHeaders", "saveCommitState"].includes(storeName)) continue;
      const record = this.sampleRecord(storeName);
      recordsByStore.set(storeName, record);
      if (Object.prototype.hasOwnProperty.call(store.fields, "saveId")) {
        saveOwnedStoreNames.push(storeName);
        operations.push({
          type: "diagnostic.record.put",
          storeName,
          record
        });
      } else sharedStoreNames.push(storeName);
    }
    return Promise.all(sharedStoreNames.map(storeName => {
      return this.controller.seedRecord(storeName, recordsByStore.get(storeName));
    })).then(() => {
      return this.controller.submitOperations("all-store-round-trip", operations, {
        diagnostic: true
      });
    }).then(() => Promise.all(Array.from(recordsByStore, ([storeName, record]) => {
      return this.controller.getRecord(storeName, this.sampleRecordKey(storeName, record)).then(savedRecord => {
        this.assert(savedRecord != null, `${storeName} did not return its representative record.`);
      });
    }))).then(() => {
      const cleanupOperations = saveOwnedStoreNames.map(storeName => {
        const record = recordsByStore.get(storeName);
        return {
          type: "diagnostic.record.delete",
          storeName,
          key: this.sampleRecordKey(storeName, record)
        };
      });
      return this.controller.submitOperations("all-store-round-trip-cleanup", cleanupOperations, {
        diagnostic: true
      });
    }).then(() => `${recordsByStore.size + 2} stores exercised`);
  };
  testAffectionWriteScope = () => {
    return this.ensureActiveSave().then(() => this.controller.submitOperations("relationship-update", [{
      type: "character.relationship.set",
      characterId: this.playerCharacterId,
      values: {
        affection: 7
      }
    }])).then(result => {
      const affected = result.affectedStoreNames.slice().sort();
      this.assertEqual(JSON.stringify(affected), JSON.stringify(["characterRelationshipStats", "saveCommitState"].sort()), "Affection update touched unexpected stores.");
      return this.controller.getRecord("characterRelationshipStats", [this.currentSaveId, this.playerCharacterId]);
    }).then(record => {
      this.assertEqual(record.affection, 7, "Affection was not persisted.");
      this.assertEqual(record.trust, 0, "Default relationship state was not created.");
    });
  };
  testPartialMergePreservesValues = () => {
    return this.ensureActiveSave().then(() => this.controller.submitOperations("relationship-baseline", [{
      type: "character.relationship.set",
      characterId: this.playerCharacterId,
      values: {
        trust: 2,
        attraction: 3,
        affection: 4
      }
    }])).then(() => this.controller.submitOperations("relationship-partial", [{
      type: "character.relationship.set",
      characterId: this.playerCharacterId,
      values: {
        affection: 8
      }
    }])).then(() => this.controller.getRecord("characterRelationshipStats", [this.currentSaveId, this.playerCharacterId])).then(record => {
      this.assertEqual(record.trust, 2, "Partial merge changed trust.");
      this.assertEqual(record.attraction, 3, "Partial merge changed attraction.");
      this.assertEqual(record.affection, 8, "Partial merge did not change affection.");
    });
  };
  testMessageAppend = () => {
    const firstMessage = this.messageRecord(1);
    return this.controller.submitOperations("message-add", [{
      type: "message.add",
      message: firstMessage
    }]).then(result => {
      this.assertEqual(JSON.stringify(result.affectedStoreNames.slice().sort()), JSON.stringify(["messages", "saveCommitState"].sort()), "Message append touched unexpected stores.");
      return this.controller.getRecord("messages", [this.currentSaveId, firstMessage.messageId]);
    }).then(before => {
      return this.controller.submitOperations("message-add", [{
        type: "message.add",
        message: this.messageRecord(2)
      }]).then(() => this.controller.getRecord("messages", [this.currentSaveId, firstMessage.messageId])).then(after => {
        this.assertEqual(JSON.stringify(after), JSON.stringify(before), "Appending a message rewrote the prior message.");
      });
    });
  };
  testIdempotentStoryListAdd = () => {
    const record = {
      root: "story_inventory",
      listPathKey: "known_locations",
      itemKey: "hearthcross",
      value: "Hearthcross"
    };
    return this.controller.submitOperations("list-add-first", [{
      type: "story.list.add",
      record
    }]).then(() => {
      return this.controller.submitOperations("list-add-repeat", [{
        type: "story.list.add",
        record
      }]);
    }).then(() => this.controller.countRecords("storyListItems", this.currentSaveId)).then(count => {
      this.assertEqual(count, 1, "Idempotent list add created a duplicate record.");
    });
  };
  testDomainOperationMatrix = () => {
    const itemId = "diagnostic-shirt";
    const factId = "diagnostic-removable-fact";
    const equipment = this.sampleRecord("equippedItems");
    equipment.characterId = this.playerCharacterId;
    equipment.shirt = itemId;
    const item = {
      itemId,
      characterId: this.playerCharacterId,
      name: "Diagnostic Shirt",
      type: "clothing",
      slot: "shirt",
      quantity: 1,
      value: 1,
      sellable: true,
      questItem: false,
      description: "A shirt used to verify normalized item persistence.",
      imageId: null
    };
    return this.controller.submitOperations("domain-operation-additions", [{
      type: "character.fact.add",
      fact: {
        characterId: this.playerCharacterId,
        factId,
        sequence: 1,
        text: "Temporary diagnostic fact."
      }
    }, {
      type: "scene.member.add",
      characterId: this.playerCharacterId
    }, {
      type: "item.put",
      item
    }, {
      type: "equipment.set",
      record: equipment
    }]).then(() => Promise.all([this.controller.getRecord("characterFacts", [this.currentSaveId, this.playerCharacterId, factId]), this.controller.getRecord("sceneMembers", [this.currentSaveId, this.playerCharacterId]), this.controller.getRecord("items", [this.currentSaveId, itemId]), this.controller.getRecord("equippedItems", [this.currentSaveId, this.playerCharacterId])])).then(([fact, member, savedItem, savedEquipment]) => {
      this.assert(fact != null, "Character fact was not added.");
      this.assert(member != null, "Scene member was not added.");
      this.assertEqual(savedItem?.slot, "shirt", "Item was not stored with its slot.");
      this.assertEqual(savedEquipment?.shirt, itemId, "Equipment did not reference the item.");
      return this.controller.submitOperations("domain-operation-removals", [{
        type: "character.fact.remove",
        characterId: this.playerCharacterId,
        factId
      }, {
        type: "scene.member.remove",
        characterId: this.playerCharacterId
      }, {
        type: "story.list.remove",
        root: "story_inventory",
        listPathKey: "known_locations",
        itemKey: "hearthcross"
      }]);
    }).then(() => Promise.all([this.controller.getRecord("characterFacts", [this.currentSaveId, this.playerCharacterId, factId]), this.controller.getRecord("sceneMembers", [this.currentSaveId, this.playerCharacterId]), this.controller.getRecord("storyListItems", [this.currentSaveId, "story_inventory", "known_locations", "hearthcross"])])).then(([fact, member, listItem]) => {
      this.assert(fact == null, "Character fact removal failed.");
      this.assert(member == null, "Scene member removal failed.");
      this.assert(listItem == null, "Story-list removal failed.");
    });
  };
  testBoundedRecordSetReplacement = () => {
    return this.controller.submitOperations("seed-bounded-record-sets", [{
      type: "runtime.records.replace",
      storeName: "objectiveProgressNotes",
      records: [{
        objectiveId: "objective-a",
        noteId: "note-1",
        sequence: 1,
        text: "first"
      }, {
        objectiveId: "objective-a",
        noteId: "note-2",
        sequence: 2,
        text: "stale"
      }, {
        objectiveId: "objective-b",
        noteId: "note-1",
        sequence: 1,
        text: "other scope"
      }]
    }]).then(() => this.controller.submitOperations("replace-one-bounded-scope", [{
      type: "runtime.records.replace",
      storeName: "objectiveProgressNotes",
      match: {
        objectiveId: "objective-a"
      },
      records: [{
        objectiveId: "objective-a",
        noteId: "note-1",
        sequence: 1,
        text: "updated"
      }]
    }])).then(() => Promise.all([this.controller.getRecord("objectiveProgressNotes", [this.currentSaveId, "objective-a", "note-1"]), this.controller.getRecord("objectiveProgressNotes", [this.currentSaveId, "objective-a", "note-2"]), this.controller.getRecord("objectiveProgressNotes", [this.currentSaveId, "objective-b", "note-1"])])).then(([updated, removed, preserved]) => {
      this.assertEqual(updated?.text, "updated", "Bounded replacement did not update the retained row.");
      this.assert(removed == null, "Bounded replacement retained a stale row.");
      this.assertEqual(preserved?.text, "other scope", "Bounded replacement deleted a different scope.");
    });
  };
  testConcurrentTransactionBurst = () => {
    const firstChangeId = this.controller.activeSaveState.nextChangeId;
    return this.monitorResponsiveness(() => {
      const promises = [];
      for (let index = 0; index < 100; index++) {
        promises.push(this.controller.submitOperations("concurrent-burst", [{
          type: "story.value.set",
          record: {
            root: "burst",
            pathKey: `value-${index}`,
            value: index
          }
        }]));
      }
      return Promise.all(promises);
    }).then(measurement => {
      this.assert(measurement.maximumDelay < 16.7, `Concurrent burst blocked the main event loop for ${measurement.maximumDelay.toFixed(1)} ms.`);
      return this.controller.readCursor(this.currentSaveId).then(cursor => ({
        cursor,
        measurement
      }));
    }).then(({
      cursor,
      measurement
    }) => {
      this.assertEqual(cursor.comId, firstChangeId + 99, "Concurrent burst did not commit every revision in order.");
      return this.controller.countRecords("storyValues", this.currentSaveId).then(count => ({
        count,
        measurement
      }));
    }).then(({
      count,
      measurement
    }) => {
      this.assert(count >= 100, "Concurrent burst records are missing.");
      return `100 ordered submissions; max delay ${measurement.maximumDelay.toFixed(1)} ms`;
    });
  };
  testOutOfOrderDelivery = () => {
    const firstChangeId = this.controller.activeSaveState.nextChangeId;
    const secondPromise = this.controller.submitOperations("out-of-order-second", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey: "second",
        value: 2
      }
    }], {
      changeId: firstChangeId + 1
    });
    let secondCommitted = false;
    secondPromise.then(() => secondCommitted = true);
    return this.delay(80).then(() => {
      this.assert(!secondCommitted, "Future change committed before its missing predecessor.");
      return this.controller.submitOperations("out-of-order-first", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "first",
          value: 1
        }
      }], {
        changeId: firstChangeId
      });
    }).then(() => secondPromise).then(() => this.controller.readCursor(this.currentSaveId)).then(cursor => {
      this.assertEqual(cursor.comId, firstChangeId + 1, "Out-of-order changes did not commit consecutively.");
    });
  };
  testAtomicRollback = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const cursorBeforePromise = this.controller.readCursor(this.currentSaveId);
    const rejectedStatusPromise = this.waitForStatus("transaction-rejected");
    const record = {
      root: "diagnostic",
      pathKey: "rollback",
      value: "should-not-survive"
    };
    const pendingPromise = this.controller.submitOperations("forced-duplicate-key", [{
      type: "diagnostic.record.add",
      storeName: "storyValues",
      record
    }, {
      type: "diagnostic.record.add",
      storeName: "storyValues",
      record
    }], {
      diagnostic: true
    });
    pendingPromise.catch(() => {});
    return Promise.all([cursorBeforePromise, rejectedStatusPromise]).then(([cursorBefore]) => {
      this.onLog("Rollback diagnostic: rejection observed; reading persisted cursor and record.");
      return Promise.all([Promise.resolve(cursorBefore), this.controller.readCursor(this.currentSaveId), this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", "rollback"])]);
    }).then(([cursorBefore, cursorAfter, savedRecord]) => {
      this.onLog("Rollback diagnostic: rollback verified; submitting corrected transaction.");
      this.assertEqual(cursorAfter.comId, cursorBefore.comId, "Failed transaction advanced the commit cursor.");
      this.assert(savedRecord == null, "Failed transaction left a partially written record.");
      return this.controller.replacePendingTransaction(changeId, "corrected-rollback-test", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "rollback",
          value: "corrected"
        }
      }]);
    }).then(() => this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", "rollback"])).then(savedRecord => {
      this.onLog("Rollback diagnostic: corrected transaction acknowledged.");
      this.assertEqual(savedRecord.value, "corrected", "Corrected transaction did not reuse the missing change ID.");
    });
  };
  testObjectiveRewardTransaction = () => {
    const invocationId = "diagnostic-objective--reward-1";
    return this.controller.submitOperations("objective-completion", [{
      type: "objective.runtime.set",
      objectiveId: "diagnostic-objective",
      values: {
        status: "complete",
        selectedOutputId: "success"
      }
    }, {
      type: "story.value.set",
      record: {
        root: "story_inventory",
        pathKey: "diagnostic_reward",
        value: true
      }
    }, {
      type: "reward.invocation.add",
      invocation: {
        invocationId,
        appliedAt: new Date().toISOString(),
        sourceType: "objective",
        sourceId: "diagnostic-objective"
      }
    }]).then(result => {
      const stores = result.affectedStoreNames;
      this.assert(stores.includes("objectiveRuntime"), "Objective runtime was not part of the transaction.");
      this.assert(stores.includes("storyValues"), "Reward value was not part of the transaction.");
      this.assert(stores.includes("rewardInvocations"), "Reward marker was not part of the transaction.");
      this.assert(!stores.includes("storyDefinitions"), "Objective completion wrote immutable definitions.");
    });
  };
  testDuplicateRewardRollback = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const rejectedStatus = this.waitForStatus("transaction-rejected");
    const pending = this.controller.submitOperations("duplicate-objective-reward", [{
      type: "story.value.set",
      record: {
        root: "story_inventory",
        pathKey: "diagnostic_reward",
        value: false
      }
    }, {
      type: "reward.invocation.add",
      invocation: {
        invocationId: "diagnostic-objective--reward-1",
        appliedAt: new Date().toISOString(),
        sourceType: "objective",
        sourceId: "diagnostic-objective"
      }
    }]);
    pending.catch(() => {});
    return rejectedStatus.then(() => this.controller.getRecord("storyValues", [this.currentSaveId, "story_inventory", "diagnostic_reward"])).then(rewardValue => {
      this.assertEqual(rewardValue?.value, true, "Duplicate invocation left a partial reward effect.");
      return this.controller.replacePendingTransaction(changeId, "duplicate-reward-repair", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "duplicate-reward-repaired",
          value: true
        }
      }]);
    });
  };
  testQuotaFailureRetry = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const rejectedStatus = this.waitForStatus("transaction-rejected");
    return this.controller.setFault({
      mode: "reject-before-commit",
      changeId,
      errorName: "QuotaExceededError",
      errorMessage: "Diagnostic quota exhausted."
    }).then(() => {
      const pending = this.controller.submitOperations("quota-rejection", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "quota",
          value: "first-attempt"
        }
      }]);
      pending.catch(() => {});
      return rejectedStatus.then(() => this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", "quota"])).then(record => {
        this.assert(record == null, "Simulated quota failure wrote data before rejecting.");
        return this.controller.replacePendingTransaction(changeId, "quota-retry", [{
          type: "story.value.set",
          record: {
            root: "diagnostic",
            pathKey: "quota",
            value: "corrected"
          }
        }]);
      });
    }).then(() => this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", "quota"])).then(record => {
      this.assertEqual(record?.value, "corrected", "Corrected quota retry did not commit.");
    });
  };
  testUncloneableOperation = () => {
    const expectedChangeId = this.controller.activeSaveState.nextChangeId;
    return this.expectRejected(this.controller.submitOperations("uncloneable-operation", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey: "uncloneable",
        value: () => true
      }
    }]), null).then(() => {
      this.assertEqual(this.controller.activeSaveState.nextChangeId, expectedChangeId, "Uncloneable operation consumed a change ID.");
      return this.controller.submitOperations("after-uncloneable", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "after-uncloneable",
          value: true
        }
      }]);
    }).then(result => {
      this.assertEqual(result.changeId, expectedChangeId, "Valid operation did not reuse the unconsumed change ID.");
    });
  };
  testSnapshotRollback = () => {
    const snapshotId = `snapshot-${Date.now()}`;
    const pathKey = `snapshot-value-${Date.now()}`;
    const message = this.messageRecord(5990);
    return this.controller.submitOperations("snapshot-baseline", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey,
        value: "before"
      }
    }]).then(() => this.controller.beginSnapshot({
      snapshotId,
      createdAt: new Date().toISOString(),
      reason: "Persistence snapshot regression test",
      type: "turn",
      messageBoundaryId: "message-5989",
      startMessageId: message.messageId
    })).then(() => this.controller.submitOperations("snapshot-mutations", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey,
        value: "after"
      }
    }, {
      type: "message.add",
      message
    }])).then(() => this.controller.commitSnapshot(snapshotId)).then(() => Promise.all([this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", pathKey]), this.controller.getRecord("messages", [this.currentSaveId, message.messageId]), this.controller.countRecords("snapshotReverseOperations", this.currentSaveId), this.controller.countRecords("snapshotRelatedMessages", this.currentSaveId)])).then(([changedValue, storedMessage, reverseCount, relatedCount]) => {
      this.assertEqual(changedValue?.value, "after", "Snapshot mutation was not committed.");
      this.assert(storedMessage != null, "Snapshot-related message was not committed.");
      this.assert(reverseCount >= 2, "Snapshot did not retain reverse operations.");
      this.assert(relatedCount >= 1, "Snapshot did not associate the new message.");
      return Promise.all([this.controller.getRecord("snapshots", [this.currentSaveId, snapshotId]), this.controller.listIncompleteSnapshots(this.currentSaveId)]);
    }).then(([snapshot, incomplete]) => {
      this.assert(Boolean(snapshot?.completedAt), "Committed snapshot has no durable completion marker.");
      this.assert(!incomplete.some(entry => entry.snapshotId === snapshotId), "Committed snapshot was reported as interrupted.");
      return this.controller.rollbackSnapshot(snapshotId);
    }).then(() => Promise.all([this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", pathKey]), this.controller.getRecord("messages", [this.currentSaveId, message.messageId]), this.controller.getRecord("snapshots", [this.currentSaveId, snapshotId]), this.controller.countRecords("snapshotReverseOperations", this.currentSaveId), this.controller.countRecords("snapshotRelatedMessages", this.currentSaveId)])).then(([restoredValue, removedMessage, snapshot, reverseCount, relatedCount]) => {
      this.assertEqual(restoredValue?.value, "before", "Snapshot rollback did not restore the prior value.");
      this.assert(removedMessage == null, "Snapshot rollback did not remove the related message.");
      this.assert(snapshot == null, "Snapshot rollback did not remove snapshot metadata.");
      this.assertEqual(reverseCount, 0, "Snapshot rollback left reverse operations behind.");
      this.assertEqual(relatedCount, 0, "Snapshot rollback left message associations behind.");
      const interruptedId = `${snapshotId}-interrupted`;
      return this.controller.beginSnapshot({
        snapshotId: interruptedId,
        createdAt: new Date().toISOString(),
        reason: "Interrupted snapshot discovery regression test",
        type: "turn",
        messageBoundaryId: "message-5991"
      }).then(() => this.controller.listIncompleteSnapshots(this.currentSaveId)).then(incomplete => {
        this.assert(incomplete.some(entry => entry.snapshotId === interruptedId), "Interrupted snapshot was not discoverable during startup repair.");
        return this.controller.rollbackSnapshot(interruptedId);
      });
    });
  };
  testSaveExportImport = () => {
    let importedSaveId = null;
    const ensureActiveSave = this.currentSaveId != null ? Promise.resolve() : this.controller.createSave(this.saveHeader(), [this.playerRecord()]).then(created => {
      this.currentSaveId = created.saveId;
      return this.controller.activateSave(created.saveId);
    });
    return ensureActiveSave.then(() => this.controller.exportSave(this.currentSaveId)).then(async result => {
      this.assert(result.blob instanceof Blob, "Save export did not return a Blob.");
      const payload = JSON.parse(await result.blob.text());
      this.assertEqual(payload.exportType, "normalized-save", "Save export type is wrong.");
      this.assertEqual(payload.immutableStory.storyId, this.saveHeader().storyId, "Save export omitted immutable story identity.");
      this.assert(Array.isArray(payload.records.saveHeaders) && payload.records.saveHeaders.length === 1, "Save export omitted its header.");
      const directValidation = await this.controller.request("diagnostic.save-export.validate", {
        payload
      });
      this.assert(directValidation.valid && directValidation.unchanged, "The canonical save-export validator did not preserve valid input.");
      const malformed = structuredClone(payload);
      malformed.immutableStory.storyID = malformed.immutableStory.storyId;
      delete malformed.immutableStory.storyId;
      const directError = await this.expectRejected(this.controller.request("diagnostic.save-export.validate", {
        payload: malformed
      }), "storyID");
      await this.expectRejected(this.controller.importSave(new Blob([JSON.stringify(malformed)], {
        type: "application/json"
      })), directError.message);
      return this.controller.importSave(result.blob);
    }).then(imported => {
      importedSaveId = imported.saveId;
      this.assert(importedSaveId !== this.currentSaveId, "Save import reused the source save id.");
      return this.controller.loadSave(importedSaveId, 40);
    }).then(loaded => {
      this.assertEqual(loaded.recordsByStore.saveHeaders[0].storyId, this.saveHeader().storyId, "Imported save changed story identity.");
      this.assert(loaded.recordsByStore.saveCharacterDefinitions.some(record => record.characterId === this.playerCharacterId), "Imported save omitted character records.");
      return this.controller.deleteSave(importedSaveId);
    });
  };
  testAllImagesExportImport = () => {
    const image = this.sampleRecord("characterProfileImages", null);
    image.imageId = `archive-image-${Date.now()}`;
    image.characterId = `archive-character-${Date.now()}`;
    image.url = "";
    const asset = this.sampleRecord("assetBlobs", null);
    asset.imageId = image.imageId;
    asset.blob = new Blob(["archive-image-bytes"], {
      type: "image/png"
    });
    asset.mimeType = "image/png";
    asset.byteLength = asset.blob.size;
    let archiveBlob;
    let archivePayload;
    return this.controller.putSharedRecords([{
      storeName: "characterProfileImages",
      record: image
    }, {
      storeName: "assetBlobs",
      record: asset
    }]).then(() => this.controller.exportAllImageIndex()).then(index => {
      const indexedAsset = index.records.assetBlobs.find(record => record.imageId === asset.imageId);
      this.assert(indexedAsset?.byteLength === asset.byteLength && !Object.hasOwn(indexedAsset, "blob") && !Object.hasOwn(indexedAsset, "base64"), "The incremental image export index included image bytes.");
      return this.controller.exportAllImages();
    }).then(async result => {
      archiveBlob = result.blob;
      this.assert(archiveBlob instanceof Blob, "All-images export did not return a Blob.");
      const header = new Uint8Array(await archiveBlob.slice(0, 2).arrayBuffer());
      const jsonBlob = header[0] === 0x1f && header[1] === 0x8b ? await new Response(archiveBlob.stream().pipeThrough(new DecompressionStream("gzip"))).blob() : archiveBlob;
      const payload = JSON.parse(await jsonBlob.text());
      archivePayload = payload;
      const directValidation = await this.controller.request("diagnostic.image-export.validate", {
        payload
      });
      this.assert(directValidation.valid && directValidation.unchanged, "The canonical all-images validator did not preserve valid input.");
      const malformed = structuredClone(payload);
      malformed.record = malformed.records;
      delete malformed.records;
      const directError = await this.expectRejected(this.controller.request("diagnostic.image-export.validate", {
        payload: malformed
      }), "record");
      await this.expectRejected(this.controller.importAllImages(new Blob([JSON.stringify(malformed)], {
        type: "application/json"
      })), directError.message);
      return this.controller.deleteSharedImage("characterProfileImages", image.imageId);
    }).then(() => Promise.all([this.controller.getRecord("characterProfileImages", image.imageId), this.controller.getRecord("assetBlobs", image.imageId)])).then(([removedImage, removedAsset]) => {
      this.assert(removedImage == null && removedAsset == null, "Shared image deletion did not remove the archive fixture.");
      return this.controller.importAllImages(archiveBlob);
    }).then(() => Promise.all([this.controller.getRecord("characterProfileImages", image.imageId), this.controller.getRecord("assetBlobs", image.imageId)])).then(([restoredImage, restoredAsset]) => {
      this.assertEqual(restoredImage?.characterId, image.characterId, "All-images import did not restore image metadata.");
      this.assert(restoredAsset?.blob instanceof Blob && restoredAsset.blob.size === asset.blob.size, "All-images import did not restore the image Blob.");
      const conflicting = structuredClone(archivePayload);
      const conflictingImage = conflicting.records.characterProfileImages.find(record => record.imageId === image.imageId);
      conflictingImage.prompt = "Conflicting restored prompt";
      return this.expectRejected(this.controller.importAllImages(new Blob([JSON.stringify(conflicting)], {
        type: "application/json"
      })), "conflicts with existing records");
    }).then(() => this.controller.getRecord("characterProfileImages", image.imageId)).then(unchanged => {
      this.assertEqual(unchanged?.prompt, image.prompt, "A conflicting image import overwrote the existing record.");
      return this.controller.deleteSharedImage("characterProfileImages", image.imageId);
    });
  };
  testTemporaryBlobUrlRejected = () => {
    const image = this.sampleRecord("characterProfileImages", null);
    image.imageId = `temporary-blob-image-${Date.now()}`;
    image.characterId = `temporary-blob-character-${Date.now()}`;
    image.url = "blob:https://example.invalid/temporary-image";
    return this.expectRejected(this.controller.putSharedRecords([{
      storeName: "characterProfileImages",
      record: image
    }]), "temporary browser blob URL").then(() => this.controller.getRecord("characterProfileImages", image.imageId)).then(stored => {
      this.assert(stored == null, "Rejected temporary blob URL was written to durable storage.");
    });
  };
  testMessagePaging = () => {
    const operations = [];
    for (let sequence = 3; sequence <= 86; sequence++) operations.push({
      type: "message.add",
      message: this.messageRecord(sequence)
    });
    return this.controller.submitOperations("message-page-fixture", operations).then(() => {
      return this.controller.loadSave(this.currentSaveId, 40);
    }).then(loaded => {
      const messages = loaded.recordsByStore.messages;
      this.assertEqual(messages.length, 40, "Newest message page size is wrong.");
      this.assertEqual(messages[0].sequence, 47, "Newest page started at the wrong sequence.");
      this.assertEqual(messages[39].sequence, 86, "Newest page ended at the wrong sequence.");
      return this.controller.loadEarlierMessages(this.currentSaveId, 47, 40);
    }).then(messages => {
      this.assertEqual(messages.length, 40, "Earlier message page size is wrong.");
      this.assertEqual(messages[0].sequence, 7, "Earlier page started at the wrong sequence.");
      this.assertEqual(messages[39].sequence, 46, "Earlier page ended at the wrong sequence.");
    });
  };
  testInvalidReadArguments = () => {
    return Promise.all([this.expectRejected(this.controller.loadEarlierMessages(this.currentSaveId, 0, 40), "beforeSequence"), this.expectRejected(this.controller.loadEarlierMessages(this.currentSaveId, 10, 0), "page limit"), this.expectRejected(this.controller.loadEarlierMessages(this.currentSaveId, 10, 501), "page limit")]);
  };
  testCrashBeforeCommit = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    return this.controller.setFault({
      mode: "crash-before-commit",
      changeId
    }).then(() => {
      const pending = this.controller.submitOperations("crash-before", [{
        type: "character.relationship.set",
        characterId: this.playerCharacterId,
        values: {
          trust: 4
        }
      }]);
      return this.delay(120).then(() => this.controller.replaceWorker("diagnostic crash before commit")).then(() => {
        return this.withTimeout(pending, 3000, "Pre-commit replay did not resolve.");
      });
    }).then(() => this.controller.getRecord("characterRelationshipStats", [this.currentSaveId, this.playerCharacterId])).then(record => {
      this.assertEqual(record.trust, 4, "Pre-commit worker loss did not replay the change.");
    });
  };
  testCrashAfterCommit = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const fact = {
      characterId: this.playerCharacterId,
      factId: "crash-after-fact",
      sequence: 1,
      text: "Committed before acknowledgement."
    };
    return this.controller.setFault({
      mode: "crash-after-commit-before-ack",
      changeId
    }).then(() => {
      const pending = this.controller.submitOperations("crash-after", [{
        type: "character.fact.add",
        fact
      }]);
      return this.delay(180).then(() => this.controller.replaceWorker("diagnostic crash after commit")).then(() => {
        return this.withTimeout(pending, 3000, "Post-commit reconciliation did not resolve.");
      });
    }).then(() => this.controller.countRecords("characterFacts", this.currentSaveId)).then(count => {
      this.assertEqual(count, 1, "Post-commit recovery duplicated the fact.");
    });
  };
  testChunkedTransferReplacement = () => {
    const operations = [];
    const firstIndex = 6000;
    for (let index = firstIndex; index < firstIndex + 500; index++) {
      operations.push({
        type: "story.value.set",
        record: {
          root: "chunk-replay",
          pathKey: `value-${index}`,
          value: index
        }
      });
    }
    const pending = this.controller.submitOperations("chunked-replacement", operations);
    return this.delay(0).then(() => this.controller.replaceWorker("diagnostic replacement during chunk transfer")).then(() => {
      return this.withTimeout(pending, 5000, "Chunked transaction did not recover after worker replacement.");
    }).then(() => Promise.all([this.controller.countRecords("storyValues", this.currentSaveId), this.controller.getRecord("storyValues", [this.currentSaveId, "chunk-replay", `value-${firstIndex + 499}`])])).then(([count, lastRecord]) => {
      operations.length = 0;
      this.assert(count >= 500, "Chunked transaction lost records after worker replacement.");
      this.assertEqual(lastRecord?.value, firstIndex + 499, "Chunked transaction did not replay its final record.");
      return "500-operation transfer replayed once after replacement";
    });
  };
  testWatchdogRecovery = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const generationBefore = this.controller.workerGeneration;
    return this.controller.setFault({
      mode: "hang-before-commit",
      changeId
    }).then(() => {
      const pending = this.controller.submitOperations("watchdog-hang", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "watchdog",
          value: "recovered"
        }
      }]);
      return this.withTimeout(pending, 9000, "Watchdog did not recover the hung worker.");
    }).then(() => {
      this.assert(this.controller.workerGeneration > generationBefore, "Watchdog did not replace the worker.");
    });
  };
  testHiddenWatchdogSuppression = () => {
    const changeId = this.controller.activeSaveState.nextChangeId;
    const generationBefore = this.controller.workerGeneration;
    this.setSimulatedVisibility("hidden");
    return this.controller.setFault({
      mode: "hang-before-commit",
      changeId
    }).then(() => {
      const pending = this.controller.submitOperations("hidden-watchdog", [{
        type: "story.value.set",
        record: {
          root: "diagnostic",
          pathKey: "hidden",
          value: "reconciled"
        }
      }]);
      return this.delay(this.controller.watchdogMilliseconds + 300).then(() => {
        this.assertEqual(this.controller.workerGeneration, generationBefore, "Hidden state caused a destructive worker replacement.");
        this.setSimulatedVisibility("visible");
        this.controller.onVisibilityChanged();
        this.assertEqual(this.controller.workerGeneration, generationBefore, "Foregrounding replaced the worker before the watchdog grace period elapsed.");
        return this.withTimeout(pending, this.controller.watchdogMilliseconds + 4000, "Foreground watchdog recovery did not recover hidden pending work.");
      }).then(() => {
        return "hidden worker preserved; foreground watchdog replay committed";
      });
    }).finally(() => this.setSimulatedVisibility("visible"));
  };
  testLargeHistoryConstantWrite = () => {
    const firstSequence = 87;
    const finalSequence = 5086;
    return this.controller.seedMessages(this.currentSaveId, firstSequence, finalSequence).then(() => this.delay(40)).then(() => {
      return this.monitorResponsiveness(() => this.controller.submitOperations("post-large-history-message", [{
        type: "message.add",
        message: this.messageRecord(finalSequence + 1)
      }]));
    }).then(appendMeasurement => {
      const executeDelay = appendMeasurement.maximumDelayByPhase.execute;
      this.assert(executeDelay < 16.7, `One message after a large history blocked the main event loop for ${executeDelay.toFixed(1)} ms (${JSON.stringify(appendMeasurement.maximumDelayByPhase)}).`);
      const startedAt = performance.now();
      return this.controller.submitOperations("second-post-large-history-message", [{
        type: "message.add",
        message: this.messageRecord(finalSequence + 2)
      }]).then(() => ({
        duration: performance.now() - startedAt,
        appendMeasurement
      }));
    }).then(({
      duration,
      appendMeasurement
    }) => {
      this.assert(duration < 1000, `One message took ${duration.toFixed(1)} ms after 5,000 prior messages.`);
      return `append ${duration.toFixed(1)} ms; max delay ${appendMeasurement.maximumDelay.toFixed(1)} ms`;
    });
  };
  testLargeTransactionResponsiveness = () => {
    const operations = [];
    for (let index = 0; index < 500; index++) {
      operations.push({
        type: "story.value.set",
        record: {
          root: "responsiveness",
          pathKey: `value-${index}`,
          value: index
        }
      });
    }
    return this.monitorResponsiveness(() => {
      return this.controller.submitOperations("large-responsive-transaction", operations);
    }).then(measurement => {
      operations.length = 0;
      const executeDelay = measurement.maximumDelayByPhase.execute;
      this.assert(executeDelay < 16.7, `Large transaction blocked the main event loop for ${executeDelay.toFixed(1)} ms (${JSON.stringify(measurement.maximumDelayByPhase)}).`);
      return `max delay ${measurement.maximumDelay.toFixed(1)} ms; ${measurement.delaysOverFrameBudget} samples over 8.33 ms`;
    });
  };
  testLoadResponsiveness = () => {
    return this.monitorResponsiveness(() => this.controller.loadSave(this.currentSaveId, 40)).then(measurement => {
      this.assertEqual(measurement.value.recordsByStore.messages.length, 40, "Responsive load returned the wrong message page.");
      const executeDelay = measurement.maximumDelayByPhase.execute;
      this.assert(executeDelay < 16.7, `Large save load blocked the main event loop for ${executeDelay.toFixed(1)} ms (${JSON.stringify(measurement.maximumDelayByPhase)}).`);
      return `max delay ${measurement.maximumDelay.toFixed(1)} ms; ${measurement.delaysOverFrameBudget} samples over 8.33 ms`;
    });
  };
  testCloseAndReopen = () => {
    const sessionBefore = this.controller.activeSaveState.sesNum;
    const finalWrite = this.controller.submitOperations("write-before-closeout", [{
      type: "story.value.set",
      record: {
        root: "diagnostic",
        pathKey: "before-closeout",
        value: "committed"
      }
    }]);
    const closeout = this.controller.closeActiveSave();
    return Promise.all([finalWrite, closeout]).then(() => this.controller.readCursor(this.currentSaveId)).then(closedCursor => {
      this.assert(!closedCursor.isOpen, "Closeout did not mark the session closed.");
      return Promise.all([Promise.resolve(closedCursor), this.controller.getRecord("storyValues", [this.currentSaveId, "diagnostic", "before-closeout"])]);
    }).then(([closedCursor, finalRecord]) => {
      this.assertEqual(finalRecord?.value, "committed", "Write queued before closeout did not commit.");
      return this.controller.activateSave(this.currentSaveId);
    }).then(reopenedCursor => {
      this.assertEqual(reopenedCursor.sesNum, sessionBefore + 1, "Reopening did not increment the session number.");
      this.assertEqual(reopenedCursor.comId, 0, "Reopened session did not reset its change cursor.");
    });
  };
  testSaveIsolation = () => {
    const firstSaveId = this.currentSaveId;
    let secondSaveId;
    return this.controller.createSave({
      ...this.saveHeader(),
      displayName: "Second Diagnostic Save"
    }, [this.playerRecord()]).then(created => {
      secondSaveId = created.saveId;
      return this.controller.closeActiveSave();
    }).then(() => this.controller.activateSave(secondSaveId)).then(() => {
      return this.controller.submitOperations("second-save-value", [{
        type: "story.value.set",
        record: {
          root: "isolation",
          pathKey: "owner",
          value: "second"
        }
      }]);
    }).then(() => this.controller.closeActiveSave()).then(() => Promise.all([this.controller.loadSave(firstSaveId, 40), this.controller.loadSave(secondSaveId, 40)])).then(([firstSave, secondSave]) => {
      const firstValue = firstSave.recordsByStore.storyValues.find(record => record.root === "isolation" && record.pathKey === "owner");
      const secondValue = secondSave.recordsByStore.storyValues.find(record => record.root === "isolation" && record.pathKey === "owner");
      this.assert(firstValue == null, "Second-save value leaked into the first save.");
      this.assertEqual(secondValue?.value, "second", "Second-save value was not stored in the second save.");
      return this.controller.activateSave(firstSaveId);
    }).then(() => {
      this.currentSaveId = firstSaveId;
      return `save ${firstSaveId} isolated from save ${secondSaveId}`;
    });
  };
  testDeletePreservesSharedAssets = () => {
    const imageId = "diagnostic-shared-image";
    const assetRecord = {
      imageId,
      blob: new Blob(["diagnostic-image"], {
        type: "image/png"
      }),
      mimeType: "image/png",
      byteLength: 16,
      contentHash: "diagnostic-image-hash"
    };
    let deletionMeasurement;
    return this.controller.seedRecord("assetBlobs", assetRecord).then(() => this.controller.closeActiveSave()).then(() => {
      return this.monitorResponsiveness(() => this.controller.deleteSave(this.currentSaveId));
    }).then(measurement => {
      deletionMeasurement = measurement;
      this.assert(measurement.maximumDelay < 16.7, `Save deletion blocked the main event loop for ${measurement.maximumDelay.toFixed(1)} ms.`);
    }).then(() => Promise.all([this.controller.getRecord("saveHeaders", this.currentSaveId), this.controller.countRecords("messages", this.currentSaveId), this.controller.getRecord("assetBlobs", imageId)])).then(([header, messageCount, asset]) => {
      this.assert(header == null, "Save header survived deletion.");
      this.assertEqual(messageCount, 0, "Save-owned messages survived deletion.");
      this.assert(asset instanceof Object && asset.imageId === imageId, "Shared asset was deleted with the save.");
      this.currentSaveId = null;
      return `max delete delay ${deletionMeasurement.maximumDelay.toFixed(1)} ms; shared asset preserved`;
    });
  };
  testNoOrphanControllerState = () => {
    const state = this.controller.diagnosticState();
    this.assertEqual(state.requests.length, 0, "Controller retained completed requests.");
    this.assertEqual(state.pendingSaves.length, 0, "Controller retained a closed or deleted save session.");
    this.assert(state.activeSaveState == null, "Controller retained an active save after closeout and deletion.");
    return "no orphan requests, pending saves, or active session";
  };

  //#endregion Tests
};