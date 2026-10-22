"use strict";

const EmberTurn = {};

EmberTurn.Controller = class Controller extends EventTarget {
    constructor(workerUrl, options = {}) {
        super();
        this.workerUrl = workerUrl;
        this.runtimeDatabaseName = options.runtimeDatabaseName || "EmberAdventuresLiteRuntimeV2";
        this.worker = null;
        this.nextRequestId = 1;
        this.requestsById = new Map();
    }

    start = () => {
        if (this.worker)
            return Promise.resolve();

        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = this.onError;
        return this.request("turn.initialize", { runtimeDatabaseName: this.runtimeDatabaseName });
    }

    dispose = () => {
        this.worker?.terminate();
        this.worker = null;

        for (const pending of this.requestsById.values())
            pending.reject(new Error("Turn worker was disposed."));

        this.requestsById.clear();
    }

    request = (type, values = {}) => new Promise((resolve, reject) => {
        const requestId = this.nextRequestId++;
        this.requestsById.set(requestId, { resolve, reject });
        this.worker.postMessage({ requestId, type, ...values });
    })

    onMessage = (event) => {
        const message = event.data || {};
        const pending = this.requestsById.get(message.requestId);

        if (!pending)
            return;

        this.requestsById.delete(message.requestId);

        if (message.ok)
            pending.resolve(message.value);
        else
            pending.reject(new Error(message.error?.message || "Turn worker request failed."));
    }

    onError = (event) => {
        event.preventDefault();
        const error = new Error(event.message || "Turn worker failed.");

        for (const pending of this.requestsById.values())
            pending.reject(error);

        this.requestsById.clear();
        this.worker?.terminate();
        this.worker = null;
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
    }

    prepareTurn = (saveId, text, speaker) => this.request("turn.prepare", { saveId, text, speaker })
    prepareSceneRemoval = (saveId, playerText) => this.request("turn.scene-removal.prepare", { saveId, playerText })
    resolveSceneRemoval = (saveId, raw) => this.request("turn.scene-removal.resolve", { saveId, raw })
    resolveObjective = (saveId, raw) => this.request("turn.objective.resolve", { saveId, raw })
    resolveRoute = (saveId, raw) => this.request("turn.route.resolve", { saveId, raw })
    prepareChoice = (saveId) => this.request("turn.choice.prepare", { saveId })
    resolveChoice = (saveId, choiceId, optionalText) => this.request("turn.choice.resolve", { saveId, choiceId, optionalText })
    resolveAutomatic = (saveId) => this.request("turn.automatic.resolve", { saveId })
    prepareNarrator = (saveId, completionDirective) => this.request("turn.narrator.prepare", { saveId, completionDirective })
    prepareState = (saveId, assistantText) => this.request("turn.state.prepare", { saveId, assistantText })
    resolveState = (saveId, raw) => this.request("turn.state.resolve", { saveId, raw })


    prepareImage = (saveId, reason) => this.request("turn.image.prepare", { saveId, reason })
    prepareShops = (saveId) => this.request("turn.shops.prepare", { saveId })
    purchaseShopItem = (saveId, shopId, itemId, characterId = "") => this.request("turn.shop.purchase", { saveId, shopId, itemId, characterId })
    prepareCharacters = (saveId) => this.request("turn.characters.prepare", { saveId })
    applyCharacterCommand = (saveId, characterId, command, values = {}) => this.request("turn.character.command", { saveId, characterId, command, ...values })
    prepareInventory = (saveId) => this.request("turn.inventory.prepare", { saveId })
    applyInventoryCommand = (saveId, command, values = {}) => this.request("turn.inventory.command", { saveId, command, ...values })
    prepareMap = (saveId) => this.request("turn.map.prepare", { saveId })
    travel = (saveId, locationId) => this.request("turn.map.travel", { saveId, locationId })
    applyMapCommand = (saveId, command, values = {}) => this.request("turn.map.command", { saveId, command, ...values })


    prepareRuntimeState = (saveId) => this.request("turn.runtime-state.prepare", { saveId })
    applyRuntimeStateCommand = (saveId, command, values = {}) => this.request("turn.runtime-state.command", { saveId, command, ...values })
    prepareProgress = (saveId, assistantText) => this.request("turn.progress.prepare", { saveId, assistantText })
    resolveProgress = (saveId, raw) => this.request("turn.progress.resolve", { saveId, raw })
    resolveTimedEvents = (saveId) => this.request("turn.timed.resolve", { saveId })
};
