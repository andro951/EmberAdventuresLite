class EmberLibraryController extends EventTarget {
    constructor(workerUrl, initializeValues = {}) {
        super();
        this.workerUrl = workerUrl;
        this.worker = null;
        this.nextRequestId = 1;
        this.requests = new Map();
        this.ready = false;
        this.initializeValues = initializeValues;
    }

    start = () => {
        if (this.worker)
            return Promise.resolve({ ready: this.ready });

        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = this.onError;
        const connectValidation = globalThis.__emberAdventuresConnectLibraryValidationWorker;
        if (typeof connectValidation !== "function")
            return Promise.reject(new Error("The canonical validation worker connector is unavailable."));
        connectValidation(this.worker);
        return this.request("initialize", this.initializeValues).then((value) => {
            this.ready = true;
            return value;
        });
    };

    dispose = () => {
        this.worker?.terminate();
        this.worker = null;
        this.ready = false;

        for (const request of this.requests.values())
            request.reject(new Error("Library worker was disposed."));

        this.requests.clear();
    };

    request = (type, values = {}, transfer = [], options = {}) => {
        if (!this.worker)
            return Promise.reject(new Error("Library worker is not started."));

        const requestId = this.nextRequestId++;

        return new Promise((resolve, reject) => {
            this.requests.set(requestId, {
                resolve,
                reject,
                type,
                onProgress:
                    typeof options.onProgress === "function"
                        ? options.onProgress
                        : null,
            });
            this.worker.postMessage({ type, requestId, ...values }, transfer);
        });
    };

    onMessage = (event) => {
        const message = event.data || {};

        if (message.type === "library.progress") {
            this.requests.get(message.requestId)?.onProgress?.(message);
            this.dispatchEvent(new CustomEvent("progress", { detail: message }));
            return;
        }

        if (message.type !== "response")
            return;

        const request = this.requests.get(message.requestId);

        if (!request)
            return;

        this.requests.delete(message.requestId);

        if (message.error) {
            const error = new Error(message.error.message || "Library worker request failed.");
            error.name = message.error.name || "Error";
            error.stack = message.error.stack || error.stack;
            request.reject(error);
        }
        else
            request.resolve(message.value);
    };

    onError = (event) => {
        const error = new Error(event.message || "Library worker failed.");

        for (const request of this.requests.values())
            request.reject(error);

        this.requests.clear();
        this.ready = false;
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
    };

    importFile = async (kind, file) => {
        if (!(file instanceof Blob))
            throw new Error("Import requires a File or Blob.");

        return this.request("library.import", { kind, file });
    };

    importPayload = (kind, payload, options = {}) => {
        if (kind === "story") {
            if (
                payload?.app !== "EmberAdventures" ||
                payload?.exportType !== "story-template" ||
                !payload?.storyTemplate ||
                typeof payload.storyTemplate !== "object"
            )
                throw new Error("Story import requires the exact EmberAdventures story-template export wrapper.");
        }
        else if (kind === "character") {
            const single = payload?.character_definition;
            const batch = payload?.characters;
            if (
                !(single && typeof single === "object") &&
                !Array.isArray(batch)
            )
                throw new Error("Character import requires exactly character_definition or characters.");
        }
        else throw new Error(`Unsupported library import kind: ${kind}.`);

        return this.request("library.import-payload", {
            kind,
            payload,
            ...(options.creatorIdentity
                ? { creatorIdentity: options.creatorIdentity }
                : {})
        });
    };

    listLibrary = (kind, options = {}) => this.request("library.list", { kind, ...options });
    getMetadata = (kind, id, revisionId) => this.request("library.metadata", { kind, id, revisionId });
    getStoryStartOptions = (storyId, revisionId) => this.request("story.start-options", { storyId, revisionId });
    materializeNewGame = (values) => this.request("story.materialize-new-game", values);
    materializeRuntimeGame = (values) => this.request("story.materialize-runtime-game", values);
    materializeRuntimeCharacter = (values) => this.request("story.materialize-runtime-character", values);
    reconstructRuntimeSave = (saveId) => this.request("story.reconstruct-runtime-save", { saveId });
    diagnosticStoryRecords = (storyId, revisionId) => this.request("diagnostic.story.records", { storyId, revisionId });
    exportDefinition = (kind, id, revisionId) => this.request("library.export", { kind, id, revisionId });
    listCompatibilityDefinitions = (kind) => this.request("library.compatibility-definitions", { kind });
    deleteEntry = (kind, id) => this.request("library.delete", { kind, id });
    searchPublic = (kind, options = {}) => this.request("public.search", { kind, ...options });
    listPublicOwned = (kind, options = {}) => this.request("public.owned", { kind, ...options });
    setPublicVisibility = (values) => this.request("public.visibility.set", values);
    importPublic = (kind, url) => this.request("public.import", { kind, url });
    listPublicVersions = (itemId) => this.request("public.versions", { itemId });
    setPublicRating = (values) => this.request("public.rating.set", values);
    removePublicRating = (values) => this.request("public.rating.remove", values);
    submitPublicReport = (values) => this.request("public.report.submit", values);
    preparePublicPackage = (values) => this.request("public.package.prepare", values);
    publishPublicPackage = (values) => this.request("public.publish", values);
    submitDeveloperIssue = (values) => this.request("developer.issue.submit", values);
    importUrl = (kind, url) => this.request("library.import-url", { kind, url });
    listSettings = () => this.request("settings.list");
    putSettings = (values) => this.request("settings.put", { values });
    deleteSettings = (keys) => this.request("settings.delete", { keys });
    listProfiles = () => this.request("profiles.list");
    putProfile = (profile) => this.request("profiles.put", { profile });
    replaceProfiles = (profiles) => this.request("profiles.replace", { profiles });
    deleteProfile = (id) => this.request("profiles.delete", { id });
    startEditor = (kind, id, revisionId) => this.request("editor.start", { kind, id, revisionId });
    createEditor = (kind) => this.request("editor.create", { kind });
    inspectEditor = (sessionId, path, options = {}) => this.request("editor.inspect", { sessionId, path, ...options });
    setEditorValue = (sessionId, path, value) => this.request("editor.set", { sessionId, path, value });
    addEditorValue = (sessionId, path, key, value) => this.request("editor.add", { sessionId, path, key, value });
    removeEditorValue = (sessionId, path) => this.request("editor.remove", { sessionId, path });
    listEditorObjectives = (sessionId, options = {}) => this.request("editor.objectives.list", { sessionId, ...options });
    searchEditorObjectives = (sessionId, query = "") => this.request("editor.objectives.search", { sessionId, query });
    replaceEditorObjective = (sessionId, objectiveId, objective) => this.request("editor.objective.replace", { sessionId, objectiveId, objective });
    addEditorObjective = (sessionId, title = "") => this.request("editor.objective.add", { sessionId, title });
    removeEditorObjective = (sessionId, objectiveId) => this.request("editor.objective.remove", { sessionId, objectiveId });
    setStartingEditorObjective = (sessionId, objectiveId) => this.request("editor.objective.starting", { sessionId, objectiveId });
    editorCatalog = (sessionId, catalog, options = {}) => this.request("editor.catalog", { sessionId, catalog, ...options });
    putEditorRewardTemplate = (sessionId, templateId, title, rewards, parameters = {}) => this.request("editor.reward-template.put", { sessionId, templateId, title, rewards, parameters });
    deleteEditorRewardTemplate = (sessionId, templateId) => this.request("editor.reward-template.delete", { sessionId, templateId });
    putEditorRewardBundle = (sessionId, bundleId, title, rewards) => this.request("editor.reward-bundle.put", { sessionId, bundleId, title, rewards });
    deleteEditorRewardBundle = (sessionId, bundleId) => this.request("editor.reward-bundle.delete", { sessionId, bundleId });
    getEditorObjectiveInputs = (sessionId, objectiveId) => this.request("editor.objective.inputs", { sessionId, objectiveId });
    setEditorObjectiveInputs = (sessionId, objectiveId, assignments) => this.request("editor.objective.inputs.set", { sessionId, objectiveId, assignments });
    getCharacterEditor = (sessionId) => this.request("editor.character.get", { sessionId });
    patchCharacterEditor = (sessionId, fields, appearance) => this.request("editor.character.patch", { sessionId, fields, appearance });
    getCharacterEditorOutfit = (sessionId, outfitId, fallback = false) => this.request("editor.character.outfit.get", { sessionId, outfitId, fallback });
    putCharacterEditorOutfit = (sessionId, outfit, outfitId = "", fallback = false) => this.request("editor.character.outfit.put", { sessionId, outfit, outfitId, fallback });
    removeCharacterEditorOutfit = (sessionId, outfitId, fallback = false) => this.request("editor.character.outfit.remove", { sessionId, outfitId, fallback });
    saveEditor = (sessionId) => this.request("editor.save", { sessionId });
    closeEditor = (sessionId) => this.request("editor.close", { sessionId });
    resetDevLogs = () => this.request("diagnostics.reset");
    appendDevLog = (entry) => this.request("diagnostics.append", { entry });
    exportDevLogs = () => this.request("diagnostics.export");
    diagnosticExport = (options = {}) => this.request(
        "diagnostic.export",
        {
            scope: options.scope || null,
            build: options.build || null,
            storageFailures: Array.isArray(options.storageFailures)
                ? options.storageFailures
                : [],
        },
        [],
        options,
    );

    diagnosticState = () => ({
        ready: this.ready,
        pendingRequests: [...this.requests.values()].map((request) => request.type)
    });
}

globalThis.EmberLibraryController = EmberLibraryController;
