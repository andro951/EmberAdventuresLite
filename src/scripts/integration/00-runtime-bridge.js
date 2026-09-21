"use strict";
const EmberRuntime = {
  persistence: null,
  library: null,
  turn: null,
  workerUrls: {},
  started: false,
  startPromise: null,
  status: "idle",
  lastError: null
};
EmberRuntime.workerUrl = (key, sourceName) => {
  if (EmberRuntime.workerUrls[key]) return EmberRuntime.workerUrls[key];
  const source = globalThis[sourceName];
  if (typeof source !== "string" || !source.trim()) throw new Error(`The embedded ${key} worker source is missing.`);
  const url = URL.createObjectURL(new Blob([source], {
    type: "text/javascript"
  }));
  EmberRuntime.workerUrls[key] = url;
  return url;
};
EmberRuntime.start = () => {
  if (EmberRuntime.started) return Promise.resolve(EmberRuntime.health());
  if (EmberRuntime.startPromise) return EmberRuntime.startPromise;
  EmberRuntime.status = "starting";
  const privateTestBuild = globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__ === true;
  EmberRuntime.persistence = new EmberPersistence.Controller(EmberRuntime.workerUrl("persistence", privateTestBuild ? "__emberAdventuresTestWorkerSource" : "__emberAdventuresPersistenceWorkerSource"));
  EmberRuntime.library = new EmberLibraryController(EmberRuntime.workerUrl("library", "__emberAdventuresLibraryWorkerSource"), privateTestBuild ? {
    diagnostic: true,
    runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic",
    applicationDatabaseName: "EmberAdventuresLibraryApplicationDiagnostic"
  } : {});
  EmberRuntime.turn = new EmberTurn.Controller(EmberRuntime.workerUrl("turn", "__emberAdventuresTurnWorkerSource"), privateTestBuild ? {
    runtimeDatabaseName: "EmberAdventuresLiteRuntimeDiagnostic"
  } : {});
  EmberRuntime.startPromise = EmberRuntime.persistence.start().then(() => Promise.all([EmberRuntime.library.start(), EmberRuntime.turn.start()])).then(() => {
    EmberRuntime.started = true;
    EmberRuntime.status = "ready";
    EmberRuntime.lastError = null;
    return EmberRuntime.health();
  }).catch(error => {
    EmberRuntime.status = "failed";
    EmberRuntime.lastError = error;
    throw error;
  });
  return EmberRuntime.startPromise;
};
EmberRuntime.health = () => ({
  started: EmberRuntime.started,
  status: EmberRuntime.status,
  persistence: EmberRuntime.persistence?.diagnosticState?.() || null,
  library: EmberRuntime.library?.diagnosticState?.() || null,
  turn: EmberRuntime.turn?.diagnosticState?.() || null,
  error: EmberRuntime.lastError?.message || ""
});
EmberRuntime.dispose = () => {
  EmberRuntime.persistence?.dispose();
  EmberRuntime.library?.dispose();
  EmberRuntime.turn?.dispose();
  for (const url of Object.values(EmberRuntime.workerUrls)) URL.revokeObjectURL(url);
  EmberRuntime.persistence = null;
  EmberRuntime.library = null;
  EmberRuntime.turn = null;
  EmberRuntime.workerUrls = {};
  EmberRuntime.started = false;
  EmberRuntime.startPromise = null;
  EmberRuntime.status = "idle";
  EmberRuntime.lastError = null;
};
globalThis.EmberRuntime = EmberRuntime;

