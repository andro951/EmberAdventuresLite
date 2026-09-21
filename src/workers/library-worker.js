"use strict";

let RuntimeDatabaseName = "EmberAdventuresLiteRuntimeV1";
let ApplicationDatabaseName = "EmberAdventuresLiteApplicationV2";
let DiagnosticMode = false;
const ApplicationDatabaseVersion = 2;
const CompilerVersion = 3;
const SupabaseUrl = "";
const SupabaseKey = "";
let runtimeDatabasePromise = null;
const editorSessions = new Map();
let applicationDatabasePromise = null;
let nextValidationRequestId = 0;
const pendingValidationRequests = new Map();
let canonicalValidationPort = null;
const DIAGNOSTIC_SETTINGS_KEY = "emberadventures-lite-settings-v2";
const DIAGNOSTIC_CREATOR_IDENTITIES_KEY = "emberadventures-lite-creator-identities";
const DIAGNOSTIC_RECORD_LIMIT = 200;
const DIAGNOSTIC_SAFE_SETTING_KEYS = Object.freeze(["currentGameSaveId", "devMode", "stateCheckMode", "playerReadDisablePromptSeen", "characterReadDisablePromptSeen", "playerInputHelpSeen", "betaNotesSeen", "imageLabWarningAccepted", "composerMode", "autoVisualNovel", "autoModeType", "autoModeCompletesObjectives", "storyGuidance", "voiceGenderMap", "leftPanelGroup", "leftPanelSections", "leftPanelScroll", "characterLibraryCardSize", "characterLibraryColumnDensity", "characterLibraryColumns", "storyLibraryColumnDensity", "storyLibraryColumns", "localCodexTextModel", "localCodexTextEffort"]);
function connectCanonicalValidationPort(port) {
  if (!(port instanceof MessagePort)) throw new Error("Canonical validation requires a MessagePort.");
  canonicalValidationPort?.close();
  canonicalValidationPort = port;
  canonicalValidationPort.onmessage = event => {
    const message = event.data || {};
    const pending = pendingValidationRequests.get(message.requestId);
    if (!pending) return;
    if (message.progress != null) {
      postMessage({
        type: "library.progress",
        requestId: pending.libraryRequestId,
        phase: String(message.progress || "Validating"),
        completed: 0,
        total: 0
      });
      return;
    }
    pendingValidationRequests.delete(message.requestId);
    if (message.ok) pending.resolve(message.result);else pending.reject(new Error(message.error || "Canonical validation failed."));
  };
  canonicalValidationPort.start();
}
function requestCanonicalValidation(kind, payload, requestId = "") {
  if (!canonicalValidationPort) return Promise.reject(new Error("The canonical validation worker is not connected."));
  const validationRequestId = `validation-${++nextValidationRequestId}`;
  return new Promise((resolve, reject) => {
    pendingValidationRequests.set(validationRequestId, {
      resolve,
      reject,
      libraryRequestId: requestId
    });
    canonicalValidationPort.postMessage({
      type: "validate-library-import",
      requestId: validationRequestId,
      payload: {
        kind,
        payload
      }
    });
  });
}

//#region IndexedDB

function indexedDbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}
function indexedDbTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => {};
  });
}
function openRuntimeDatabase() {
  if (runtimeDatabasePromise) return runtimeDatabasePromise;
  runtimeDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(RuntimeDatabaseName);
    request.onsuccess = () => {
      const database = request.result;
      const required = ["storyDefinitions", "compiledStoryIndexes", "storyLibraryEntries", "authoredCharacterDefinitions", "characterLibraryEntries"];
      for (const storeName of required) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.close();
          reject(new Error(`Runtime database is missing ${storeName}.`));
          return;
        }
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error("Runtime database failed to open."));
    request.onupgradeneeded = () => {
      if (!DiagnosticMode) {
        request.transaction.abort();
        reject(new Error("Start the persistence worker before the library worker."));
        return;
      }
      const database = request.result;
      database.createObjectStore("storyDefinitions", {
        keyPath: ["storyId", "revisionId"]
      });
      database.createObjectStore("compiledStoryIndexes", {
        keyPath: ["storyId", "revisionId"]
      });
      database.createObjectStore("storyLibraryEntries", {
        keyPath: "storyId"
      });
      database.createObjectStore("authoredCharacterDefinitions", {
        keyPath: ["characterId", "revisionId"]
      });
      database.createObjectStore("characterLibraryEntries", {
        keyPath: "characterId"
      });
      const profileImages = database.createObjectStore("characterProfileImages", {
        keyPath: "imageId"
      });
      profileImages.createIndex("byCharacterPresentation", ["characterId", "presentation"], {
        unique: false
      });
      database.createObjectStore("characterProfileImageSelections", {
        keyPath: ["characterId", "presentation"]
      });
    };
  });
  return runtimeDatabasePromise;
}
function openApplicationDatabase() {
  if (applicationDatabasePromise) return applicationDatabasePromise;
  applicationDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ApplicationDatabaseName, ApplicationDatabaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", {
        keyPath: "key"
      });
      if (!database.objectStoreNames.contains("profiles")) {
        const profiles = database.createObjectStore("profiles", {
          keyPath: "id"
        });
        profiles.createIndex("byName", "name", {
          unique: false
        });
        profiles.createIndex("byUpdatedAt", "updated_at", {
          unique: false
        });
      }
      if (!database.objectStoreNames.contains("publicLibraryCache")) database.createObjectStore("publicLibraryCache", {
        keyPath: "key"
      });
      if (!database.objectStoreNames.contains("devLogs")) {
        const logs = database.createObjectStore("devLogs", {
          keyPath: "sequence",
          autoIncrement: true
        });
        logs.createIndex("byAt", "at", {
          unique: false
        });
        logs.createIndex("byLevel", "level", {
          unique: false
        });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error("Application database failed to open."));
  });
  return applicationDatabasePromise;
}

//#endregion IndexedDB

//#region Validation And Compilation

function isPlainObject(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function requiredText(value, path) {
  if (typeof value !== "string") throw new Error(`${path} must be text.`);
  if (!value.trim()) throw new Error(`${path} is required.`);
  return value;
}
function requiredString(value, path) {
  if (typeof value !== "string") throw new Error(`${path} must be a string.`);
  return value;
}
function optionalText(value, path = "value") {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${path} must be text or null.`);
  return value;
}
function stringList(value, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((item, index) => requiredText(item, `${path}[${index}]`));
}
function stableJson(value) {
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${JSON.stringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
async function contentHash(value) {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function uniqueDefinitions(items, path) {
  const byId = new Map();
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!isPlainObject(item)) throw new Error(`${path}[${index}] must be an object.`);
    const id = requiredText(item.id, `${path}[${index}].id`);
    if (byId.has(id)) throw new Error(`${path} contains duplicate id ${id}.`);
    byId.set(id, item);
  }
  return byId;
}
function dependencyKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) dependencyKeys(item, output);
    return output;
  }
  if (!isPlainObject(value)) return output;
  if (["objective_complete", "objective_not_complete"].includes(value.type)) output.add(`objective:${value.id}`);
  if (typeof value.path === "string") output.add(value.path);
  for (const nested of Object.values(value)) dependencyKeys(nested, output);
  return output;
}
function addCharacterLocator(index, character, locator) {
  if (!character || !isPlainObject(character)) return;
  const id = character.id;
  if (typeof id !== "string" || !id.trim()) return;
  if (index[id] != null) return;
  index[id] = locator;
}
function objectiveOutputCollections(objective) {
  return [["next_objectives", objective.next_objectives || []], ["choices", objective.choices || []], ["outcome_routes", objective.outcome_routes || []]];
}
function objectiveOutputTarget(output, collectionName, path) {
  if (!isPlainObject(output)) throw new Error(`${path} must be an objective output.`);
  const fieldName = collectionName === "next_objectives" ? "objective_id" : "next_objective_id";
  return optionalText(output[fieldName]);
}
function compileCharacterIndex(state) {
  const index = {};
  addCharacterLocator(index, state.player, "player");
  for (let position = 0; position < (state.players || []).length; position++) addCharacterLocator(index, state.players[position], `players.${position}`);
  for (const [key, character] of Object.entries(state.characters || {})) addCharacterLocator(index, character, `characters.${key}`);
  for (const [key, character] of Object.entries(state.future_cast?.items || {})) addCharacterLocator(index, character.animal_definition || character.full_character, `future_cast.items.${key}`);
  for (const [locationId, location] of Object.entries(state.npc_directory?.locations || {})) {
    for (const [characterKey, shell] of Object.entries(location.characters || {})) addCharacterLocator(index, shell.animal_definition || shell.full_character, `npc_directory.locations.${locationId}.characters.${characterKey}`);
  }
  return index;
}
function compileValidatedStoryIndexes(template, hash, requestId) {
  const state = template.state;
  const objectives = state.objectives.items;
  const objectiveIndexById = {};
  const incomingObjectiveIdsByObjectiveId = Object.fromEntries(objectives.map(objective => [objective.id, []]));
  const incomingTransitionGroupsByObjectiveId = {};
  const outgoingObjectiveIdsByObjectiveId = {};
  const requirementDependentsByKey = {};
  for (let index = 0; index < objectives.length; index++) {
    const objective = objectives[index];
    const outgoing = [];
    objectiveIndexById[objective.id] = index;
    for (const [collectionName, outputs] of objectiveOutputCollections(objective)) {
      for (const output of outputs) {
        if (output.ending_type) continue;
        const targetField = collectionName === "next_objectives" ? "objective_id" : "next_objective_id";
        const targetId = output[targetField];
        const groupId = output.target_input_group_id;
        const groups = incomingTransitionGroupsByObjectiveId[targetId] ||= {};
        (groups[groupId] ||= []).push({
          sourceObjectiveId: objective.id,
          outputId: output.id
        });
        incomingObjectiveIdsByObjectiveId[targetId].push(objective.id);
        outgoing.push(targetId);
        for (const key of dependencyKeys(output.requirements || [])) (requirementDependentsByKey[key] ||= []).push(targetId);
      }
    }
    outgoingObjectiveIdsByObjectiveId[objective.id] = [...new Set(outgoing)];
    for (const key of dependencyKeys([objective.completion_requirements, objective.outcome_routes, objective.choices])) (requirementDependentsByKey[key] ||= []).push(objective.id);
    if ((index + 1) % 100 === 0 || index + 1 === objectives.length) {
      postMessage({
        type: "library.progress",
        requestId,
        phase: "Compiling objectives",
        completed: index + 1,
        total: objectives.length
      });
    }
  }
  for (const objective of objectives) {
    const requiredIds = Array.isArray(objective.requires) ? objective.requires : [];
    if (!requiredIds.length) continue;
    const groups = incomingTransitionGroupsByObjectiveId[objective.id] ||= {};
    if (!Object.keys(groups).length) {
      groups[`requires:${objective.id}`] = requiredIds.map(sourceObjectiveId => ({
        sourceObjectiveId,
        outputId: "*"
      }));
      incomingObjectiveIdsByObjectiveId[objective.id].push(...requiredIds);
    }
    for (const sourceObjectiveId of requiredIds) {
      const outgoing = outgoingObjectiveIdsByObjectiveId[sourceObjectiveId] || [];
      outgoing.push(objective.id);
      outgoingObjectiveIdsByObjectiveId[sourceObjectiveId] = [...new Set(outgoing)];
    }
  }
  for (const id of Object.keys(incomingObjectiveIdsByObjectiveId)) incomingObjectiveIdsByObjectiveId[id] = [...new Set(incomingObjectiveIdsByObjectiveId[id])];
  for (const key of Object.keys(requirementDependentsByKey)) requirementDependentsByKey[key] = [...new Set(requirementDependentsByKey[key])];
  const locationById = Object.fromEntries(Object.keys(state.world_map?.locations || {}).map(id => [id, `state.world_map.locations.${id}`]));
  const shopById = Object.fromEntries(Object.keys(state.story_shops || {}).map(id => [id, `state.story_shops.${id}`]));
  const rewardBundleById = Object.fromEntries(Object.keys(state.reward_bundles || {}).map(id => [id, `state.reward_bundles.${id}`]));
  return {
    compilerVersion: CompilerVersion,
    definitionContentHash: hash,
    startingObjectiveId: state.objectives.active_id,
    objectiveIndexById,
    incomingObjectiveIdsByObjectiveId,
    incomingTransitionGroupsByObjectiveId,
    outgoingObjectiveIdsByObjectiveId,
    requirementDependentsByKey,
    characterById: compileCharacterIndex(state),
    locationById,
    shopById,
    rewardBundleById
  };
}
async function prepareImport(kind, payload, requestId, libraryMetadata = {}) {
  await requestCanonicalValidation(kind, payload, requestId);
  if (kind === "story") {
    const template = payload.storyTemplate;
    const hash = await contentHash(template);
    const revisionId = `revision-${hash.slice(0, 16)}`;
    const compiled = compileValidatedStoryIndexes(template, hash, requestId);
    const definition = {
      ...template,
      storyId: template.id,
      revisionId,
      contentHash: hash
    };
    delete definition.id;
    delete definition.app;
    delete definition.templateType;
    const entry = {
      storyId: template.id,
      revisionId,
      title: template.title,
      description: optionalText(template.description).slice(0, 2000),
      source: template.source,
      creation_tool: template.creation_tool,
      genres: template.genres,
      titleImageUrl: optionalText(template.title_card_image?.url),
      creator: optionalText(libraryMetadata.creator),
      creatorId: optionalText(libraryMetadata.creatorId)
    };
    return {
      kind,
      definition,
      compiled: {
        storyId: template.id,
        revisionId,
        ...compiled
      },
      entry
    };
  }
  if (kind === "character") {
    const definitions = Object.hasOwn(payload, "characters") ? payload.characters.map(record => record.character_definition) : [payload.character_definition];
    const prepared = [];
    for (const character of definitions) prepared.push(await prepareValidatedCharacterImport(character, libraryMetadata));
    return prepared.length === 1 ? prepared[0] : {
      kind: "character-batch",
      items: prepared
    };
  }
  throw new Error("Library kind must be story or character.");
}
async function prepareValidatedCharacterImport(character, libraryMetadata = {}) {
  const hash = await contentHash(character);
  const revisionId = `revision-${hash.slice(0, 16)}`;
  const definition = {
    ...character,
    characterId: character.id,
    revisionId,
    contentHash: hash
  };
  delete definition.id;
  const entry = {
    characterId: character.id,
    revisionId,
    name: character.name,
    fallbackName: character.fallback_name,
    role: character.role,
    source: character.source,
    creation_tool: character.creation_tool,
    genres: character.genres,
    gender: character.gender,
    creator: optionalText(libraryMetadata.creator),
    creatorId: optionalText(libraryMetadata.creatorId)
  };
  return {
    kind: "character",
    definition,
    entry
  };
}

//#endregion Validation And Compilation

//#region Library Storage

async function storePreparedImport(prepared) {
  if (prepared?.kind === "character-batch") {
    const results = [];
    for (const item of prepared.items) results.push(await storePreparedImport(item));
    return results;
  }
  const database = await openRuntimeDatabase();
  const story = prepared.kind === "story";
  const definitionStoreName = story ? "storyDefinitions" : "authoredCharacterDefinitions";
  const entryStoreName = story ? "storyLibraryEntries" : "characterLibraryEntries";
  const rawSharedImages = sharedImageRecordsForPreparedImport(prepared);
  const selectedProfileImages = new Map();
  const sharedImages = [];
  for (const image of rawSharedImages) {
    if (image.storeName !== "characterProfileImageSelections") {
      sharedImages.push(image);
      continue;
    }
    selectedProfileImages.set(`${image.record.characterId}\u0000${image.record.presentation}`, image);
  }
  sharedImages.push(...selectedProfileImages.values());
  const sharedStoreNames = sharedImages.map(entry => entry.storeName).filter(name => database.objectStoreNames.contains(name));
  const storeNames = story ? [definitionStoreName, "compiledStoryIndexes", entryStoreName] : [definitionStoreName, entryStoreName];
  const transaction = database.transaction([...new Set([...storeNames, ...sharedStoreNames])], "readwrite", {
    durability: "strict"
  });
  const definitionStore = transaction.objectStore(definitionStoreName);
  const key = story ? [prepared.definition.storyId, prepared.definition.revisionId] : [prepared.definition.characterId, prepared.definition.revisionId];
  const existing = await indexedDbRequest(definitionStore.get(key));
  if (existing && existing.contentHash !== prepared.definition.contentHash) {
    transaction.abort();
    throw new Error("Immutable definition collision.");
  }
  if (!existing) definitionStore.add(prepared.definition);
  if (story) transaction.objectStore("compiledStoryIndexes").put(prepared.compiled);
  transaction.objectStore(entryStoreName).put(prepared.entry);
  for (const image of sharedImages) {
    if (!database.objectStoreNames.contains(image.storeName)) continue;
    const store = transaction.objectStore(image.storeName);
    if (image.storeName === "characterProfileImageSelections") {
      const key = [image.record.characterId, image.record.presentation];
      if (!(await indexedDbRequest(store.get(key)))) store.add(image.record);
      continue;
    }
    if (image.storeName === "characterProfileImages" && image.record.url) {
      const matchingPresentation = await indexedDbRequest(store.index("byCharacterPresentation").getAll(IDBKeyRange.only([image.record.characterId, image.record.presentation])));
      for (const existingImage of matchingPresentation) {
        if (existingImage.imageId !== image.record.imageId && existingImage.url === image.record.url) {
          store.delete(existingImage.imageId);
        }
      }
    }
    store.put(image.record);
  }
  await indexedDbTransaction(transaction);
  return {
    entry: prepared.entry,
    reusedDefinition: Boolean(existing),
    sharedImages: sharedImages.length
  };
}
function portableTitleImageMetadata(image, fallbackId) {
  return {
    imageId: optionalText(image?.id) || fallbackId,
    model: optionalText(image?.model),
    seed: image?.seed ?? null,
    prompt: optionalText(image?.prompt),
    negativePrompt: optionalText(image?.negative_prompt),
    url: optionalText(image?.url)
  };
}
function portableAuthoredStoryImageMetadata(image, fallbackId) {
  return {
    imageId: optionalText(image?.id) || fallbackId,
    model: optionalText(image?.model),
    seed: image?.seed ?? null,
    prompt: optionalText(image?.prompt),
    negativePrompt: optionalText(image?.negative_prompt),
    url: optionalText(image?.url)
  };
}
function portableProfileImageMetadata(image, fallbackId) {
  return {
    imageId: optionalText(image?.local_image_id) || fallbackId,
    createdAt: optionalText(image?.at || image?.created_at || image?.requestedAt),
    model: "",
    seed: image?.seed ?? null,
    prompt: optionalText(image?.prompt),
    negativePrompt: optionalText(image?.negative_prompt),
    url: optionalText(image?.url)
  };
}
function hostedImageFallbackSuffix(image) {
  const url = optionalText(image?.url);
  if (!url) throw new Error("A hosted image fallback id requires image.url.");
  return fnv1aText(url);
}
function sharedImageRecordsForPreparedImport(prepared) {
  const records = [];
  const definition = prepared.definition;
  const add = (storeName, record) => records.push({
    storeName,
    record
  });
  if (prepared.kind === "character") {
    extractCharacterProfileImages(definition, definition.characterId, add);
    return records;
  }
  const storyId = definition.storyId;
  const titleImage = definition.title_card_image;
  if (optionalText(titleImage?.url)) {
    const image = portableTitleImageMetadata(titleImage, `story-title-${safeRuntimeIdPart(storyId)}-${hostedImageFallbackSuffix(titleImage)}`);
    add("storyTitleImages", {
      ...image,
      storyId
    });
    add("storyTitleImageSelections", {
      storyId,
      imageId: image.imageId
    });
  }
  const seen = new Set();
  const visit = (value, path = [], characterId = "") => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, [...path, index], characterId));
      return;
    }
    if (!isPlainObject(value)) return;
    const nextCharacterId = optionalText(value.id) && (value.appearance || value.outfits || value.physical_description) ? optionalText(value.id) : characterId;
    if (nextCharacterId) extractCharacterProfileImages(value, nextCharacterId, add, seen);
    const image = value.image;
    const ownerId = optionalText(value.id);
    if (isPlainObject(image) && optionalText(image.url) && ownerId) {
      const pathKey = path.join("-");
      const metadata = portableAuthoredStoryImageMetadata(image, `story-asset-${safeRuntimeIdPart(storyId)}-${safeRuntimeIdPart(ownerId)}-${hostedImageFallbackSuffix(image)}`);
      if (value.clothing || value.contexts || /outfit/i.test(pathKey)) {
        const key = `outfit:${nextCharacterId}:${ownerId}:${metadata.imageId}`;
        if (!seen.has(key)) {
          seen.add(key);
          add("storyOutfitImages", {
            ...metadata,
            storyId,
            characterId: nextCharacterId || "story",
            outfitId: ownerId
          });
          add("storyOutfitImageSelections", {
            storyId,
            characterId: nextCharacterId || "story",
            outfitId: ownerId,
            imageId: metadata.imageId
          });
        }
      } else if (String(value.type || "").startsWith("generate_") || /reward/i.test(pathKey)) {
        const key = `reward:${ownerId}:${metadata.imageId}`;
        if (!seen.has(key)) {
          seen.add(key);
          add("storyRewardImages", {
            ...metadata,
            storyId,
            rewardImageId: ownerId,
            title: optionalText(value.title)
          });
        }
      } else {
        const key = `item:${ownerId}:${metadata.imageId}`;
        if (!seen.has(key)) {
          seen.add(key);
          add("storyItemImages", {
            ...metadata,
            storyId,
            itemId: ownerId
          });
          add("storyItemImageSelections", {
            storyId,
            itemId: ownerId,
            imageId: metadata.imageId
          });
        }
      }
    }
    for (const [key, nested] of Object.entries(value)) {
      if (key !== "image") visit(nested, [...path, key], nextCharacterId);
    }
  };
  visit(definition.state || {}, ["state"]);
  return records;
}
function extractCharacterProfileImages(character, characterId, add, seen = new Set()) {
  const presentations = character?.profile_image_presentations || {};
  for (const presentation of ["male", "non_male"]) {
    const image = presentations[presentation];
    if (!isPlainObject(image) || !optionalText(image.url)) continue;
    const metadata = portableProfileImageMetadata(image, `profile-${safeRuntimeIdPart(characterId)}-${presentation}-${hostedImageFallbackSuffix(image)}`);
    const key = `${characterId}:${presentation}:${metadata.imageId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add("characterProfileImages", {
      ...metadata,
      characterId,
      presentation,
      favorite: image.favorite === true
    });
    add("characterProfileImageSelections", {
      characterId,
      presentation,
      imageId: metadata.imageId
    });
  }
  const selected = character?.default_profile_image;
  if (isPlainObject(selected) && optionalText(selected.url)) {
    const presentation = typeof selected.male === "boolean" ? selected.male ? "male" : "non_male" : optionalText(character?.gender).toLowerCase() === "male" ? "male" : "non_male";
    const metadata = portableProfileImageMetadata(selected, `profile-${safeRuntimeIdPart(characterId)}-${presentation}-${hostedImageFallbackSuffix(selected)}`);
    const key = `${characterId}:${presentation}:${metadata.imageId}`;
    if (!seen.has(key)) {
      seen.add(key);
      add("characterProfileImages", {
        ...metadata,
        characterId,
        presentation,
        favorite: selected.favorite === true
      });
    }
    add("characterProfileImageSelections", {
      characterId,
      presentation,
      imageId: metadata.imageId
    });
  }
}
async function importBuffer(message, validateCommand = true) {
  if (validateCommand) {
    validateExactWorkerCommand(message, ["type", "requestId", "kind", "file"], [], "library_import_command");
    if (message.type !== "library.import") throw new Error('library_import_command.type must be exactly "library.import".');
    if (message.kind !== "story" && message.kind !== "character") throw new Error('library_import_command.kind must be exactly "story" or "character".');
  }
  if (!(message.file instanceof Blob) && !(message.buffer instanceof ArrayBuffer)) throw new Error("Import requires a File, Blob, or transferred ArrayBuffer.");
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Parsing",
    completed: 0,
    total: 1
  });
  const buffer = message.file instanceof Blob ? await message.file.arrayBuffer() : message.buffer;
  let bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress the imported library file.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const text = new TextDecoder().decode(bytes);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  const prepared = await prepareImport(message.kind, payload, message.requestId);
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Saving",
    completed: 1,
    total: 1
  });
  return storePreparedImport(prepared);
}
async function importPayload(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "payload"], ["creatorIdentity"], "library_import_payload_command");
  if (message.type !== "library.import-payload") throw new Error('library_import_payload_command.type must be exactly "library.import-payload".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('library_import_payload_command.kind must be exactly "story" or "character".');
  if (!isPlainObject(message.payload)) throw new Error("Library import payload must be an object.");
  if (message.creatorIdentity != null) {
    if (!isPlainObject(message.creatorIdentity)) throw new Error("library_import_payload_command.creatorIdentity must be an object.");
    const fields = Object.keys(message.creatorIdentity);
    const expectedFields = ["creator_id", "creator_name", "owner_user_id", "created_at", "updated_at"];
    if (fields.length !== expectedFields.length || expectedFields.some(field => !fields.includes(field))) throw new Error("library_import_payload_command.creatorIdentity must be an exact creator identity record.");
    requiredText(message.creatorIdentity.creator_id, "library_import_payload_command.creatorIdentity.creator_id");
    requiredText(message.creatorIdentity.creator_name, "library_import_payload_command.creatorIdentity.creator_name");
    for (const field of ["owner_user_id", "created_at", "updated_at"]) if (typeof message.creatorIdentity[field] !== "string") throw new Error(`library_import_payload_command.creatorIdentity.${field} must be text.`);
  }
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Validating",
    completed: 0,
    total: 1
  });
  const prepared = await prepareImport(message.kind, message.payload, message.requestId, message.creatorIdentity ? {
    creatorId: message.creatorIdentity.creator_id,
    creator: message.creatorIdentity.creator_name
  } : {});
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Saving",
    completed: 1,
    total: 1
  });
  return storePreparedImport(prepared);
}
async function listLibrary(message) {
  const path = "library_list_command";
  validateExactWorkerCommand(message, ["type", "requestId", "kind"], ["query", "creator", "creation_tool", "source", "genres", "offset", "limit"], path);
  if (message.type !== "library.list") throw new Error(`${path}.type must be exactly "library.list".`);
  if (message.kind !== "story" && message.kind !== "character") throw new Error(`${path}.kind must be exactly "story" or "character".`);
  for (const field of ["query", "creator", "creation_tool", "source"]) validateOptionalCommandText(message, field, path);
  for (const field of ["genres"]) validateOptionalCommandStringArray(message, field, path);
  validateOptionalCommandNumber(message, "offset", path, {
    integer: true,
    minimum: 0
  });
  validateOptionalCommandNumber(message, "limit", path, {
    integer: true,
    minimum: 1,
    maximum: 200
  });
  const story = message.kind === "story";
  const storeName = story ? "storyLibraryEntries" : "characterLibraryEntries";
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(storeName, "readonly");
  let entries = await indexedDbRequest(transaction.objectStore(storeName).getAll());
  const query = (message.query || "").trim().toLowerCase().slice(0, 160);
  const creator = optionalText(message.creator).toLowerCase();
  const creation_tool = optionalText(message.creation_tool).toLowerCase();
  const source = optionalText(message.source).toLowerCase();
  const genres = (message.genres || []).map(value => value.toLowerCase());
  if (creator) entries = entries.filter(entry => optionalText(entry.creator).toLowerCase().includes(creator));
  if (creation_tool) entries = entries.filter(entry => optionalText(entry.creation_tool).toLowerCase().includes(creation_tool));
  if (source) entries = entries.filter(entry => optionalText(entry.source).toLowerCase().includes(source));
  if (genres.length) entries = entries.filter(entry => genres.every(genre => (entry.genres || []).some(value => optionalText(value).toLowerCase() === genre)));
  if ([].length) entries = entries.filter(entry => [].every(tag => [].some(value => optionalText(value).toLowerCase() === tag)));
  if (query) {
    entries = entries.filter(entry => {
      const values = story ? [entry.title, entry.description, entry.source, entry.creator, ...(entry.genres || []), ...[]] : [entry.name, entry.fallbackName, entry.role, entry.source, entry.creator, entry.gender, ...(entry.genres || []), ...[]];
      return values.some(value => String(value || "").toLowerCase().includes(query));
    });
  }
  const titleField = story ? "title" : "name";
  entries.sort((left, right) => String(left[titleField]).localeCompare(String(right[titleField]), undefined, {
    sensitivity: "base"
  }));
  const offset = message.offset ?? 0;
  const limit = message.limit ?? 60;
  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
    offset,
    limit
  };
}
async function definitionMetadata(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "id", "revisionId"], [], "library_metadata_command");
  if (message.type !== "library.metadata") throw new Error('library_metadata_command.type must be exactly "library.metadata".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('library_metadata_command.kind must be exactly "story" or "character".');
  const story = message.kind === "story";
  const storeName = story ? "storyDefinitions" : "authoredCharacterDefinitions";
  const key = [requiredText(message.id, "id"), requiredText(message.revisionId, "revisionId")];
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const definition = await indexedDbRequest(transaction.objectStore(storeName).get(key));
  if (!definition) return null;
  return story ? {
    storyId: definition.storyId,
    revisionId: definition.revisionId,
    title: definition.title,
    description: definition.description,
    source: definition.source,
    creator: definition.creator || "",
    genres: definition.genres,
    objectiveCount: definition.state?.objectives?.items?.length || 0
  } : {
    characterId: definition.characterId,
    revisionId: definition.revisionId,
    name: definition.name,
    fallbackName: definition.fallback_name,
    role: definition.role,
    source: definition.source,
    creator: definition.creator || "",
    genres: definition.genres,
    gender: definition.gender,
    age: definition.age
  };
}
async function exportDefinition(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "id", "revisionId"], [], "library_export_command");
  if (message.type !== "library.export") throw new Error('library_export_command.type must be exactly "library.export".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('library_export_command.kind must be exactly "story" or "character".');
  requiredText(message.id, "library_export_command.id");
  requiredText(message.revisionId, "library_export_command.revisionId");
  const story = message.kind === "story";
  const storeName = story ? "storyDefinitions" : "authoredCharacterDefinitions";
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const definition = await indexedDbRequest(transaction.objectStore(storeName).get([message.id, message.revisionId]));
  if (!definition) throw new Error("Definition was not found.");
  let payload;
  if (story) {
    const template = {
      ...definition,
      app: "EmberAdventures",
      templateType: "story",
      id: definition.storyId
    };
    delete template.storyId;
    delete template.revisionId;
    delete template.contentHash;
    payload = {
      app: "EmberAdventures",
      exportType: "story-template",
      exportedAt: new Date().toISOString(),
      storyTemplate: template
    };
  } else {
    const character = {
      ...definition,
      id: definition.characterId
    };
    delete character.characterId;
    delete character.revisionId;
    delete character.contentHash;
    payload = {
      character_definition: character
    };
  }
  return {
    blob: new Blob([JSON.stringify(payload)], {
      type: "application/json"
    }),
    fileName: story ? `${definition.title}.json` : `${definition.name}.json`
  };
}
async function listCompatibilityDefinitions(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind"], [], "library_compatibility_definitions_command");
  if (message.type !== "library.compatibility-definitions") throw new Error('library_compatibility_definitions_command.type must be exactly "library.compatibility-definitions".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('library_compatibility_definitions_command.kind must be exactly "story" or "character".');
  const story = message.kind === "story";
  const definitionStoreName = story ? "storyDefinitions" : "authoredCharacterDefinitions";
  const entryStoreName = story ? "storyLibraryEntries" : "characterLibraryEntries";
  const database = await openRuntimeDatabase();
  const selectionStoreAvailable = !story && database.objectStoreNames.contains("characterProfileImageSelections");
  const profileImageStoreAvailable = !story && database.objectStoreNames.contains("characterProfileImages");
  const storeNames = [definitionStoreName, entryStoreName];
  if (selectionStoreAvailable) storeNames.push("characterProfileImageSelections");
  if (profileImageStoreAvailable) storeNames.push("characterProfileImages");
  const transaction = database.transaction(storeNames, "readonly");
  const entriesRequest = indexedDbRequest(transaction.objectStore(entryStoreName).getAll());
  const selectionsRequest = !selectionStoreAvailable ? Promise.resolve([]) : indexedDbRequest(transaction.objectStore("characterProfileImageSelections").getAll());
  const profileImagesRequest = !profileImageStoreAvailable ? Promise.resolve([]) : indexedDbRequest(transaction.objectStore("characterProfileImages").getAll());
  const [entries, selections, profileImages] = await Promise.all([entriesRequest, selectionsRequest, profileImagesRequest]);
  const definitionStore = transaction.objectStore(definitionStoreName);
  const definitions = await Promise.all(entries.map(entry => indexedDbRequest(definitionStore.get(story ? [entry.storyId, entry.revisionId] : [entry.characterId, entry.revisionId]))));
  return definitions.map((definition, index) => ({
    definition,
    entry: entries[index]
  })).filter(item => Boolean(item.definition)).map(({
    definition,
    entry
  }) => {
    const record = {
      ...definition
    };
    if (story) {
      record.app = "EmberAdventures";
      record.templateType = "story";
      record.id = record.storyId;
      delete record.storyId;
    } else {
      const character = {
        ...record,
        id: record.characterId
      };
      delete character.characterId;
      delete character.revisionId;
      delete character.contentHash;
      const canonicalPresentation = character.gender === "male" ? "male" : "non_male";
      const activeProfileImageIds = {
        male: "",
        non_male: ""
      };
      const presentationSlots = isPlainObject(character.profile_image_presentations) ? {
        ...character.profile_image_presentations
      } : {};
      for (const presentation of ["male", "non_male"]) {
        const activeProfileImageId = selections.find(selection => selection.characterId === character.id && selection.presentation === presentation)?.imageId || "";
        activeProfileImageIds[presentation] = activeProfileImageId;
        if (!activeProfileImageId) continue;
        const selectedImage = profileImages.find(image => image.imageId === activeProfileImageId);
        const currentPresentation = isPlainObject(presentationSlots[presentation]) ? presentationSlots[presentation] : {};
        const selectedSlot = {
          ...currentPresentation,
          url: optionalText(selectedImage?.url) || currentPresentation.url || "",
          local_image_id: activeProfileImageId,
          source: selectedImage ? "shared" : currentPresentation.source || "none",
          seed: selectedImage?.seed ?? currentPresentation.seed ?? null,
          prompt: optionalText(selectedImage?.prompt) || currentPresentation.prompt || "",
          negative_prompt: optionalText(selectedImage?.negativePrompt) || currentPresentation.negative_prompt || "",
          male: presentation === "male"
        };
        presentationSlots[presentation] = selectedSlot;
        if (presentation === canonicalPresentation) character.default_profile_image = {
          ...(isPlainObject(character.default_profile_image) ? character.default_profile_image : {}),
          ...selectedSlot
        };
      }
      character.profile_image_presentations = presentationSlots;
      const selectedImageIds = Object.values(activeProfileImageIds).filter(Boolean);
      const currentProfileImages = isPlainObject(character.profile_images) ? character.profile_images : {};
      character.profile_images = {
        ...currentProfileImages,
        active_image_id: activeProfileImageIds[canonicalPresentation],
        image_ids: [...selectedImageIds, ...(Array.isArray(currentProfileImages.image_ids) ? currentProfileImages.image_ids.filter(id => !selectedImageIds.includes(id)) : [])]
      };
      return {
        id: character.id,
        name: character.name,
        source: character.source,
        creator: optionalText(entry.creator),
        creator_id: optionalText(entry.creatorId),
        creation_tool: character.creation_tool,
        role: character.role,
        character,
        active_profile_image_ids: activeProfileImageIds,
        public_library_item_id: "",
        public_library_owner_user_id: "",
        public_library_version_id: "",
        created_at: character.created_at,
        updated_at: character.updated_at
      };
    }
    delete record.revisionId;
    delete record.contentHash;
    return {
      definition: record,
      creatorIdentity: {
        creator_id: optionalText(entry.creatorId),
        creator: optionalText(entry.creator)
      }
    };
  });
}
async function deleteLibraryEntry(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "id"], [], "library_delete_command");
  if (message.type !== "library.delete") throw new Error('library_delete_command.type must be exactly "library.delete".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('library_delete_command.kind must be exactly "story" or "character".');
  const storeName = message.kind === "story" ? "storyLibraryEntries" : "characterLibraryEntries";
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(storeName, "readwrite", {
    durability: "strict"
  });
  transaction.objectStore(storeName).delete(requiredText(message.id, "id"));
  await indexedDbTransaction(transaction);
  return {
    deleted: true
  };
}

//#region Structured Definition Editing

function editorSession(message) {
  const session = editorSessions.get(requiredText(message.sessionId, "editor session id"));
  if (!session) throw new Error("The definition editor session no longer exists.");
  return session;
}
function validateEditorCommand(message, type, requiredFields, optionalFields = []) {
  const path = `${type.replaceAll(".", "_")}_command`;
  validateExactWorkerCommand(message, ["type", "requestId", ...requiredFields], optionalFields, path);
  if (message.type !== type) throw new Error(`${path}.type must be exactly "${type}".`);
  return path;
}
function validateEditorKind(kind, path) {
  if (kind !== "story" && kind !== "character") throw new Error(`${path} must be exactly "story" or "character".`);
  return kind;
}
function validateEditorPath(path, fieldPath) {
  if (!Array.isArray(path)) throw new Error(`${fieldPath} must be an array.`);
  for (const [index, part] of path.entries()) {
    if (typeof part === "string") continue;
    if (Number.isSafeInteger(part) && part >= 0) continue;
    throw new Error(`${fieldPath}[${index}] must be text or a nonnegative safe integer.`);
  }
  return path;
}
function optionalEditorPageInteger(value, fallback, maximum, path) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0 || maximum !== null && value > maximum) throw new Error(`${path} must be a nonnegative safe integer${maximum === null ? "" : ` no greater than ${maximum}`}.`);
  return value;
}
function editorPathValue(root, path) {
  return path.reduce((value, part) => value?.[part], root);
}
function editorNodeDescriptor(value, offset = 0, limit = 50) {
  if (Array.isArray(value)) {
    return {
      kind: "array",
      total: value.length,
      offset,
      entries: value.slice(offset, offset + limit).map((entry, index) => ({
        key: offset + index,
        summary: editorValueSummary(entry)
      }))
    };
  }
  if (isPlainObject(value)) return {
    kind: "object",
    entries: Object.keys(value).map(key => ({
      key,
      summary: editorValueSummary(value[key])
    }))
  };
  return {
    kind: value == null ? "null" : typeof value,
    value
  };
}
function editorValueSummary(value) {
  if (Array.isArray(value)) return `List (${value.length})`;
  if (isPlainObject(value)) return optionalText(value.title || value.name || value.id) || `Group (${Object.keys(value).length})`;
  if (value == null) return "Empty";
  return String(value).slice(0, 120);
}
async function startEditor(message) {
  const path = validateEditorCommand(message, "editor.start", ["kind", "id", "revisionId"]);
  const kind = validateEditorKind(message.kind, `${path}.kind`);
  requiredText(message.id, `${path}.id`);
  requiredText(message.revisionId, `${path}.revisionId`);
  const storeName = kind === "story" ? "storyDefinitions" : "authoredCharacterDefinitions";
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const definition = await indexedDbRequest(transaction.objectStore(storeName).get([message.id, message.revisionId]));
  if (!definition) throw new Error("The selected immutable definition was not found.");
  const draft = cloneValue(definition);
  if (kind === "story") {
    draft.app = "EmberAdventures";
    draft.templateType = "story";
    draft.id = draft.storyId;
    delete draft.storyId;
  } else {
    draft.id = draft.characterId;
    delete draft.characterId;
  }
  delete draft.revisionId;
  delete draft.contentHash;
  const sessionId = `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  editorSessions.set(sessionId, {
    kind,
    draft
  });
  return {
    sessionId,
    kind,
    title: optionalText(draft.title || draft.name),
    root: editorNodeDescriptor(draft)
  };
}
function createEditor(message) {
  const path = validateEditorCommand(message, "editor.create", ["kind"]);
  const kind = validateEditorKind(message.kind, `${path}.kind`);
  const draft = kind === "story" ? {
    app: "EmberAdventures",
    templateType: "story",
    id: "",
    title: "",
    description: "",
    source: "Original",
    creation_tool: "EmberAdventures Story Editor",
    genres: [],
    allow_any_player: true,
    default_image_model: "",
    title_card_subjects: [],
    title_card_image: {},
    any_player_starting_state: {
      role: "",
      starting_known_facts_to_add: []
    },
    state: {
      meta: {
        story_guidance: ""
      },
      player: {},
      players: [],
      characters: {},
      location: {
        npc_location_id: ""
      },
      world_map: {
        current_location_id: "",
        locations: {}
      },
      time: {
        year: 1,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        elapsed_minutes: 0
      },
      scene: {
        summary: "",
        party_members_present: [],
        npcs_present: [],
        image_characters: [],
        image_action: ""
      },
      story_inventory: {},
      world_flags: {},
      progression: {},
      story_memory: {
        world_notes: [],
        unresolved_threads: [],
        relationship_notes: [],
        rules_and_constraints: [],
        ai_private_notes: []
      },
      npc_directory: {
        locations: {}
      },
      future_cast: {
        enabled: true,
        items: {}
      },
      timed_events: {},
      story_shops: {},
      reward_bundles: {},
      reward_templates: {},
      objectives: {
        active_id: "",
        no_current: false,
        items: []
      }
    },
    messages: []
  } : {
    id: "",
    version: 1,
    name: "",
    fallback_name: "",
    default_source: "Original",
    source: "Original",
    creation_tool: "EmberAdventures Character Editor",
    genres: [],
    can_die: false,
    romanceable: true,
    age: 18,
    gender: "female",
    role: "",
    personality_description: "",
    speech_style: "",
    boldness: 5,
    appearance: {
      species: "Human",
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
    outfits: [],
    fallback_outfits: [],
    fallback_starting_outfit_id: "",
    starting_outfit_id: "",
    starting_relationship_to_player: "",
    starting_trust: 0,
    starting_attraction: 0,
    starting_affection: 0,
    starting_state_of_mind: "",
    starting_physical_state: "",
    starting_pose: "",
    starting_held_items: {
      right_hand: null,
      left_hand: null
    },
    starting_inventory: [],
    starting_known_facts: [],
    stats: {},
    default_seed: 1,
    image_prompt_config: {
      seed_enabled: true,
      seed: 1
    },
    voice: null
  };
  const sessionId = `editor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  editorSessions.set(sessionId, {
    kind,
    draft
  });
  return {
    sessionId,
    kind,
    title: "",
    root: editorNodeDescriptor(draft)
  };
}
function inspectEditorNode(message) {
  const path = validateEditorCommand(message, "editor.inspect", ["sessionId", "path"], ["offset", "limit"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  validateEditorPath(message.path, `${path}.path`);
  const offset = optionalEditorPageInteger(message.offset, 0, null, `${path}.offset`);
  const limit = optionalEditorPageInteger(message.limit, 50, 100, `${path}.limit`);
  if (limit < 1) throw new Error(`${path}.limit must be at least 1.`);
  const session = editorSession(message);
  const value = editorPathValue(session.draft, message.path);
  if (value === undefined) throw new Error("The selected editor path does not exist.");
  return editorNodeDescriptor(value, offset, limit);
}
function setEditorValue(message) {
  const commandPath = validateEditorCommand(message, "editor.set", ["sessionId", "path", "value"]);
  requiredText(message.sessionId, `${commandPath}.sessionId`);
  validateEditorPath(message.path, `${commandPath}.path`);
  const session = editorSession(message);
  const path = message.path;
  if (!path.length) throw new Error("The editor cannot replace the complete definition.");
  const parent = editorPathValue(session.draft, path.slice(0, -1));
  const key = path.at(-1);
  if (!Array.isArray(parent) && !isPlainObject(parent) || !(key in parent)) throw new Error("The selected editor field does not exist.");
  parent[key] = cloneValue(message.value);
  return {
    saved: true,
    summary: editorValueSummary(parent[key])
  };
}
function addEditorValue(message) {
  const commandPath = validateEditorCommand(message, "editor.add", ["sessionId", "path", "key", "value"]);
  requiredText(message.sessionId, `${commandPath}.sessionId`);
  validateEditorPath(message.path, `${commandPath}.path`);
  const session = editorSession(message);
  const target = editorPathValue(session.draft, message.path);
  if (Array.isArray(target)) {
    if (message.key !== undefined) throw new Error(`${commandPath}.key must be undefined when adding to an array.`);
    target.push(cloneValue(message.value));
    return {
      key: target.length - 1,
      total: target.length
    };
  }
  if (isPlainObject(target)) {
    const key = requiredText(message.key, `${commandPath}.key`);
    if (Object.prototype.hasOwnProperty.call(target, key)) throw new Error(`Field ${key} already exists.`);
    target[key] = cloneValue(message.value);
    return {
      key,
      total: Object.keys(target).length
    };
  }
  throw new Error("Values can only be added to a list or group.");
}
function removeEditorValue(message) {
  const commandPath = validateEditorCommand(message, "editor.remove", ["sessionId", "path"]);
  requiredText(message.sessionId, `${commandPath}.sessionId`);
  validateEditorPath(message.path, `${commandPath}.path`);
  const session = editorSession(message);
  const path = message.path;
  if (!path.length) throw new Error("The editor cannot remove the complete definition.");
  const parent = editorPathValue(session.draft, path.slice(0, -1));
  const key = path.at(-1);
  if (Array.isArray(parent)) {
    if (!Number.isSafeInteger(key) || key < 0 || key >= parent.length) throw new Error("The selected editor array index does not exist.");
    parent.splice(key, 1);
  } else if (isPlainObject(parent)) {
    if (typeof key !== "string" || !Object.hasOwn(parent, key)) throw new Error("The selected editor field does not exist.");
    delete parent[key];
  } else throw new Error("The selected editor value cannot be removed.");
  return {
    removed: true
  };
}
function storyEditorObjectives(session) {
  if (session.kind !== "story") throw new Error("Objective editing is available only for stories.");
  const objectives = session.draft?.state?.objectives?.items;
  if (!Array.isArray(objectives)) throw new Error("The story has no objective list.");
  return objectives;
}
function objectiveEditorProjection(objective, index, startingObjectiveId) {
  return {
    ...cloneValue(objective),
    index,
    starting: objective.id === startingObjectiveId
  };
}
function listEditorObjectives(message) {
  const path = validateEditorCommand(message, "editor.objectives.list", ["sessionId"], ["offset", "limit"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  const offset = optionalEditorPageInteger(message.offset, 0, null, `${path}.offset`);
  const limit = optionalEditorPageInteger(message.limit, 30, 60, `${path}.limit`);
  if (limit < 1) throw new Error(`${path}.limit must be at least 1.`);
  const session = editorSession(message);
  const objectives = storyEditorObjectives(session);
  const startingObjectiveId = optionalText(session.draft.state.objectives.active_id);
  return {
    objectives: objectives.slice(offset, offset + limit).map((objective, index) => objectiveEditorProjection(objective, offset + index, startingObjectiveId)),
    offset,
    limit,
    total: objectives.length,
    startingObjectiveId
  };
}
function searchEditorObjectives(message) {
  const path = validateEditorCommand(message, "editor.objectives.search", ["sessionId", "query"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  if (typeof message.query !== "string") throw new Error(`${path}.query must be text.`);
  const session = editorSession(message);
  const query = message.query.trim().toLowerCase();
  const objectives = storyEditorObjectives(session);
  return objectives.filter(objective => !query || [objective.id, objective.title].some(value => String(value || "").toLowerCase().includes(query))).slice(0, 100).map((objective, index) => ({
    id: objective.id,
    title: objective.title,
    index
  }));
}
function replaceEditorObjective(message) {
  const path = validateEditorCommand(message, "editor.objective.replace", ["sessionId", "objectiveId", "objective"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.objectiveId, `${path}.objectiveId`);
  if (!isPlainObject(message.objective)) throw new Error(`${path}.objective must be an object.`);
  const session = editorSession(message);
  const objectives = storyEditorObjectives(session);
  const objective = cloneValue(message.objective);
  delete objective.index;
  delete objective.starting;
  const currentIndex = objectives.findIndex(entry => entry.id === message.objectiveId);
  if (currentIndex < 0) throw new Error("The selected objective no longer exists.");
  if (!isPlainObject(objective) || objective.id !== message.objectiveId) throw new Error("Objective identity cannot be changed after creation.");
  objectives[currentIndex] = objective;
  return objectiveEditorProjection(objective, currentIndex, session.draft.state.objectives.active_id);
}
function addEditorObjective(message) {
  const path = validateEditorCommand(message, "editor.objective.add", ["sessionId", "title"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  if (typeof message.title !== "string") throw new Error(`${path}.title must be text.`);
  const session = editorSession(message);
  const objectives = storyEditorObjectives(session);
  const used = new Set(objectives.map(objective => objective.id));
  const base = safeRuntimeIdPart(optionalText(message.title) || "new-objective");
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  const objective = {
    id,
    title: optionalText(message.title),
    summary: "",
    while_active_guidance: "",
    completion_control: "player",
    completion_criteria: "",
    completion_requirements: [],
    next_objectives: []
  };
  objectives.push(objective);
  if (!optionalText(session.draft.state.objectives.active_id)) session.draft.state.objectives.active_id = id;
  return objectiveEditorProjection(objective, objectives.length - 1, session.draft.state.objectives.active_id);
}
function removeEditorObjective(message) {
  const path = validateEditorCommand(message, "editor.objective.remove", ["sessionId", "objectiveId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.objectiveId, `${path}.objectiveId`);
  const session = editorSession(message);
  const objectives = storyEditorObjectives(session);
  const objectiveId = requiredText(message.objectiveId, "objective id");
  const index = objectives.findIndex(objective => objective.id === objectiveId);
  if (index < 0) throw new Error("The selected objective no longer exists.");
  if (session.draft.state.objectives.active_id === objectiveId) throw new Error("Set a different starting objective before deleting this node.");
  objectives.splice(index, 1);
  return {
    removed: true,
    total: objectives.length
  };
}
function setStartingEditorObjective(message) {
  const path = validateEditorCommand(message, "editor.objective.starting", ["sessionId", "objectiveId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.objectiveId, `${path}.objectiveId`);
  const session = editorSession(message);
  const objectiveId = requiredText(message.objectiveId, "objective id");
  if (!storyEditorObjectives(session).some(objective => objective.id === objectiveId)) throw new Error("The selected starting objective does not exist.");
  session.draft.state.objectives.active_id = objectiveId;
  return {
    objectiveId
  };
}
function editorCatalog(message) {
  const path = validateEditorCommand(message, "editor.catalog", ["sessionId", "catalog"], ["query", "characterId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.catalog, `${path}.catalog`);
  if (Object.hasOwn(message, "query") && typeof message.query !== "string") throw new Error(`${path}.query must be text.`);
  if (Object.hasOwn(message, "characterId") && typeof message.characterId !== "string") throw new Error(`${path}.characterId must be text.`);
  if (message.catalog === "outfits") {
    requiredText(message.characterId, `${path}.characterId`);
  } else if (Object.hasOwn(message, "characterId")) throw new Error(`${path}.characterId is only approved for the outfits catalog.`);
  const session = editorSession(message);
  if (session.kind !== "story") throw new Error("Story catalogs are available only in the story editor.");
  const state = session.draft.state || {};
  const query = optionalText(message.query).toLowerCase();
  const accepts = entry => !query || Object.values(entry).some(value => String(value || "").toLowerCase().includes(query));
  let entries = [];
  if (message.catalog === "characters") {
    const characterById = compileCharacterIndex(state);
    entries = Object.entries(characterById).map(([id, locator]) => {
      const value = locator.split(".").reduce((current, key) => current?.[key], state);
      const character = value?.full_character || value || {};
      return {
        id,
        name: optionalText(character.name) || id,
        role: optionalText(character.role)
      };
    });
  } else if (message.catalog === "locations") {
    entries = Object.entries(state.world_map?.locations || {}).map(([id, location]) => ({
      id,
      name: optionalText(location?.name || location?.label) || id,
      type: optionalText(location?.type || location?.scale),
      parentId: optionalText(location?.parent_id)
    }));
  } else if (message.catalog === "shops") {
    entries = Object.entries(state.story_shops || {}).map(([id, shop]) => ({
      id,
      name: optionalText(shop?.title || shop?.name) || id,
      type: optionalText(shop?.type)
    }));
  } else if (message.catalog === "reward_bundles") {
    entries = Object.keys(state.reward_bundles || {}).map(id => ({
      id,
      name: id
    }));
  } else if (message.catalog === "reward_templates") {
    entries = Object.entries(state.reward_templates || {}).map(([id, template]) => ({
      id,
      name: id,
      parameters: cloneValue(template?.parameters || {})
    }));
  } else if (message.catalog === "objectives") {
    entries = storyEditorObjectives(session).map((objective, index) => ({
      id: objective.id,
      name: optionalText(objective.title) || objective.id,
      index
    }));
  } else if (message.catalog === "outfits") {
    const characterId = requiredText(message.characterId, "outfit character id");
    const locator = compileCharacterIndex(state)[characterId];
    const value = locator?.split(".").reduce((current, key) => current?.[key], state);
    const character = value?.full_character || value || {};
    entries = (character.outfits || []).map(outfit => ({
      id: outfit.id,
      name: optionalText(outfit.name) || outfit.id
    }));
  } else throw new Error(`Unknown story editor catalog ${message.catalog}.`);
  return entries.filter(accepts).slice(0, 100);
}
function putEditorRewardTemplate(message) {
  const path = validateEditorCommand(message, "editor.reward-template.put", ["sessionId", "templateId", "title", "rewards", "parameters"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.templateId, `${path}.templateId`);
  if (typeof message.title !== "string") throw new Error(`${path}.title must be text.`);
  if (!Array.isArray(message.rewards)) throw new Error(`${path}.rewards must be an array.`);
  if (!isPlainObject(message.parameters)) throw new Error(`${path}.parameters must be an object.`);
  const session = editorSession(message);
  if (session.kind !== "story") throw new Error("Reward templates are available only in story definitions.");
  const templateId = safeRuntimeIdPart(message.templateId, "reward-template");
  const rewards = cloneValue(message.rewards);
  const parameters = cloneValue(message.parameters);
  if (!Array.isArray(rewards) || !rewards.length) throw new Error("A reward template must contain at least one reward.");
  for (const [name, parameter] of Object.entries(parameters)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name) || !["character_id", "path"].includes(parameter?.type)) throw new Error(`Reward template parameter ${name} must use a stable id and character_id or path type.`);
  }
  session.draft.state.reward_templates ||= {};
  session.draft.state.reward_templates[templateId] = {
    parameters,
    rewards
  };
  return {
    id: templateId,
    title: optionalText(message.title) || templateId
  };
}
function deleteEditorRewardTemplate(message) {
  const path = validateEditorCommand(message, "editor.reward-template.delete", ["sessionId", "templateId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.templateId, `${path}.templateId`);
  const session = editorSession(message);
  const templateId = requiredText(message.templateId, "reward template id");
  if (!session.draft.state?.reward_templates?.[templateId]) throw new Error(`Reward template ${templateId} does not exist.`);
  delete session.draft.state.reward_templates[templateId];
  return {
    deleted: true
  };
}
function putEditorRewardBundle(message) {
  const path = validateEditorCommand(message, "editor.reward-bundle.put", ["sessionId", "bundleId", "title", "rewards"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.bundleId, `${path}.bundleId`);
  if (typeof message.title !== "string") throw new Error(`${path}.title must be text.`);
  if (!Array.isArray(message.rewards)) throw new Error(`${path}.rewards must be an array.`);
  const session = editorSession(message);
  if (session.kind !== "story") throw new Error("Reward bundles are available only in story definitions.");
  const bundleId = safeRuntimeIdPart(message.bundleId, "reward-bundle");
  const rewards = cloneValue(message.rewards);
  if (!Array.isArray(rewards) || !rewards.length) throw new Error("A reward bundle must contain at least one reward.");
  session.draft.state.reward_bundles ||= {};
  session.draft.state.reward_bundles[bundleId] = rewards;
  return {
    id: bundleId,
    title: optionalText(message.title) || bundleId
  };
}
function deleteEditorRewardBundle(message) {
  const path = validateEditorCommand(message, "editor.reward-bundle.delete", ["sessionId", "bundleId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.bundleId, `${path}.bundleId`);
  const session = editorSession(message);
  const bundleId = requiredText(message.bundleId, "reward bundle id");
  if (!session.draft.state?.reward_bundles?.[bundleId]) throw new Error(`Reward bundle ${bundleId} does not exist.`);
  delete session.draft.state.reward_bundles[bundleId];
  return {
    deleted: true
  };
}
function editorObjectiveInputs(message) {
  const path = validateEditorCommand(message, "editor.objective.inputs", ["sessionId", "objectiveId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.objectiveId, `${path}.objectiveId`);
  const session = editorSession(message);
  const targetId = requiredText(message.objectiveId, "objective id");
  const objectives = storyEditorObjectives(session);
  const transitions = [];
  for (const objective of objectives) {
    for (const [collectionName, outputs] of objectiveOutputCollections(objective)) {
      for (const [index, output] of outputs.entries()) {
        if (typeof output !== "object" || objectiveOutputTarget(output, collectionName, `objective ${objective.id}.${collectionName}[${index}]`) !== targetId) continue;
        transitions.push({
          sourceObjectiveId: objective.id,
          sourceTitle: optionalText(objective.title) || objective.id,
          outputId: requiredText(output.id, `objective ${objective.id}.${collectionName}[${index}].id`),
          outputTitle: optionalText(output.title || output.criteria) || `Output ${index + 1}`,
          groupId: requiredText(output.target_input_group_id, `objective ${objective.id}.${collectionName}[${index}].target_input_group_id`)
        });
      }
    }
  }
  return {
    objectiveId: targetId,
    transitions
  };
}
function setEditorObjectiveInputs(message) {
  const path = validateEditorCommand(message, "editor.objective.inputs.set", ["sessionId", "objectiveId", "assignments"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.objectiveId, `${path}.objectiveId`);
  if (!Array.isArray(message.assignments)) throw new Error(`${path}.assignments must be an array.`);
  for (const [index, assignment] of message.assignments.entries()) {
    if (!isPlainObject(assignment)) throw new Error(`${path}.assignments[${index}] must be an object.`);
    const fields = ["sourceObjectiveId", "outputId", "groupId"];
    for (const field of Object.keys(assignment)) if (!fields.includes(field)) throw new Error(`${path}.assignments[${index}].${field} is not an approved field.`);
    for (const field of fields) {
      if (!Object.hasOwn(assignment, field)) throw new Error(`${path}.assignments[${index}].${field} is required.`);
      requiredText(assignment[field], `${path}.assignments[${index}].${field}`);
    }
  }
  const session = editorSession(message);
  const targetId = requiredText(message.objectiveId, "objective id");
  const assignments = message.assignments;
  const assignmentByKey = new Map(assignments.map(entry => [`${requiredText(entry.sourceObjectiveId, "input source objective id")}\n${requiredText(entry.outputId, "input output id")}`, requiredText(entry.groupId, "input group id")]));
  let changed = 0;
  for (const objective of storyEditorObjectives(session)) {
    for (const [collectionName, outputs] of objectiveOutputCollections(objective)) {
      for (const [index, output] of outputs.entries()) {
        if (typeof output !== "object" || objectiveOutputTarget(output, collectionName, `objective ${objective.id}.${collectionName}[${index}]`) !== targetId) continue;
        const groupId = assignmentByKey.get(`${objective.id}\n${output.id}`);
        if (groupId) {
          output.target_input_group_id = groupId;
          changed++;
        }
      }
    }
  }
  if (changed !== assignmentByKey.size) throw new Error("One or more objective input assignments no longer match an incoming output.");
  return {
    changed
  };
}
const CharacterEditorFields = Object.freeze(["name", "fallback_name", "default_source", "source", "creation_tool", "genres", "can_die", "romanceable", "age", "gender", "role", "personality_description", "speech_style", "boldness", "fallback_starting_outfit_id", "starting_outfit_id", "starting_relationship_to_player", "starting_trust", "starting_attraction", "starting_affection", "starting_state_of_mind", "starting_physical_state", "starting_pose", "starting_held_items", "starting_inventory", "starting_known_facts", "stats", "default_seed"]);
function characterEditorProjectionForSession(session) {
  if (session.kind !== "character") throw new Error("The guided character editor requires a character definition.");
  return {
    id: optionalText(session.draft.id),
    fields: Object.fromEntries(CharacterEditorFields.map(field => [field, cloneValue(session.draft[field])])),
    appearance: cloneValue(session.draft.appearance || {}),
    outfits: (session.draft.outfits || []).map((outfit, index) => ({
      id: outfit.id,
      name: outfit.name,
      index
    })),
    fallbackOutfits: (session.draft.fallback_outfits || []).map((outfit, index) => ({
      id: outfit.id,
      name: outfit.name,
      index
    }))
  };
}
function characterEditorProjection(message) {
  const path = validateEditorCommand(message, "editor.character.get", ["sessionId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  return characterEditorProjectionForSession(editorSession(message));
}
function patchCharacterEditor(message) {
  const path = validateEditorCommand(message, "editor.character.patch", ["sessionId", "fields", "appearance"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  const session = editorSession(message);
  if (session.kind !== "character") throw new Error("The guided character editor requires a character definition.");
  if (!isPlainObject(message.fields) || !isPlainObject(message.appearance)) throw new Error("Character editor updates require field and appearance groups.");
  for (const field of Object.keys(message.fields)) {
    if (!CharacterEditorFields.includes(field)) throw new Error(`Character editor field ${field} is not supported.`);
    session.draft[field] = cloneValue(message.fields[field]);
  }
  session.draft.appearance ||= {};
  for (const [field, value] of Object.entries(message.appearance)) {
    if (!Object.prototype.hasOwnProperty.call(session.draft.appearance, field)) throw new Error(`Character appearance field ${field} is not supported.`);
    session.draft.appearance[field] = cloneValue(value);
  }
  return characterEditorProjectionForSession(session);
}
function getCharacterEditorOutfit(message) {
  const path = validateEditorCommand(message, "editor.character.outfit.get", ["sessionId", "outfitId", "fallback"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.outfitId, `${path}.outfitId`);
  if (typeof message.fallback !== "boolean") throw new Error(`${path}.fallback must be true or false.`);
  const session = editorSession(message);
  if (session.kind !== "character") throw new Error("Outfit editing requires a character definition.");
  const collection = message.fallback ? session.draft.fallback_outfits ||= [] : session.draft.outfits ||= [];
  const outfit = collection.find(entry => entry.id === message.outfitId);
  if (!outfit) throw new Error(`Outfit ${message.outfitId} does not exist.`);
  return cloneValue(outfit);
}
function putCharacterEditorOutfit(message) {
  const path = validateEditorCommand(message, "editor.character.outfit.put", ["sessionId", "outfit", "outfitId", "fallback"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  if (!isPlainObject(message.outfit)) throw new Error(`${path}.outfit must be an object.`);
  if (typeof message.outfitId !== "string") throw new Error(`${path}.outfitId must be text.`);
  if (typeof message.fallback !== "boolean") throw new Error(`${path}.fallback must be true or false.`);
  const session = editorSession(message);
  if (session.kind !== "character" || !isPlainObject(message.outfit)) throw new Error("Outfit editing requires a character definition and an outfit.");
  const outfit = cloneValue(message.outfit);
  outfit.id = safeRuntimeIdPart(outfit.id || outfit.name, "outfit");
  requiredText(outfit.name, "outfit.name");
  if (!isPlainObject(outfit.clothing) || !Object.values(outfit.clothing).some(value => optionalText(value))) throw new Error("An outfit must contain at least one described clothing slot.");
  const collection = message.fallback ? session.draft.fallback_outfits ||= [] : session.draft.outfits ||= [];
  const index = collection.findIndex(entry => entry.id === message.outfitId || entry.id === outfit.id);
  if (index >= 0) collection[index] = outfit;else collection.push(outfit);
  return {
    id: outfit.id,
    name: outfit.name,
    index: index >= 0 ? index : collection.length - 1
  };
}
function removeCharacterEditorOutfit(message) {
  const path = validateEditorCommand(message, "editor.character.outfit.remove", ["sessionId", "outfitId", "fallback"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  requiredText(message.outfitId, `${path}.outfitId`);
  if (typeof message.fallback !== "boolean") throw new Error(`${path}.fallback must be true or false.`);
  const session = editorSession(message);
  const collection = message.fallback ? session.draft.fallback_outfits ||= [] : session.draft.outfits ||= [];
  const index = collection.findIndex(entry => entry.id === message.outfitId);
  if (index < 0) throw new Error(`Outfit ${message.outfitId} does not exist.`);
  collection.splice(index, 1);
  return {
    removed: true
  };
}
async function saveEditor(message) {
  const path = validateEditorCommand(message, "editor.save", ["sessionId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  const session = editorSession(message);
  const now = new Date().toISOString();
  if (!optionalText(session.draft.id)) session.draft.id = safeRuntimeIdPart(session.kind === "story" ? session.draft.title : session.draft.name, session.kind);
  if (session.kind === "story") {
    const objectives = session.draft.state?.objectives?.items || [];
    const used = new Set();
    for (const [index, objective] of objectives.entries()) {
      const base = safeRuntimeIdPart(objective.id || objective.title, `objective-${index + 1}`);
      let id = base;
      let suffix = 2;
      while (used.has(id)) id = `${base}-${suffix++}`;
      objective.id = id;
      used.add(id);
    }
    if (!optionalText(session.draft.state?.objectives?.active_id) && objectives.length) session.draft.state.objectives.active_id = objectives[0].id;
    session.draft.createdAt ||= now;
    session.draft.updatedAt = now;
  } else {
    session.draft.fallback_name ||= session.draft.name;
    session.draft.created_at ||= now;
    session.draft.updated_at = now;
  }
  const payload = session.kind === "story" ? {
    app: "EmberAdventures",
    exportType: "story-template",
    storyTemplate: cloneValue(session.draft),
    exportedAt: now
  } : {
    character_definition: cloneValue(session.draft)
  };
  const prepared = await prepareImport(session.kind, payload, message.requestId);
  const result = await storePreparedImport(prepared);
  editorSessions.delete(message.sessionId);
  return result;
}
function closeEditor(message) {
  const path = validateEditorCommand(message, "editor.close", ["sessionId"]);
  requiredText(message.sessionId, `${path}.sessionId`);
  editorSessions.delete(message.sessionId);
  return {
    closed: true
  };
}

//#endregion Structured Definition Editing

//#region Diagnostics

async function resetDevLogs(message) {
  validateExactWorkerCommand(message, ["type", "requestId"], [], "diagnostics_reset_command");
  if (message.type !== "diagnostics.reset") throw new Error('diagnostics_reset_command.type must be exactly "diagnostics.reset".');
  const database = await openApplicationDatabase();
  const transaction = database.transaction("devLogs", "readwrite");
  transaction.objectStore("devLogs").clear();
  await indexedDbTransaction(transaction);
  return {
    reset: true
  };
}
async function appendDevLog(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "entry"], [], "diagnostics_append_command");
  if (message.type !== "diagnostics.append") throw new Error('diagnostics_append_command.type must be exactly "diagnostics.append".');
  if (!isPlainObject(message.entry)) throw new Error("diagnostics_append_command.entry must be an object.");
  const fields = ["at", "level", "category", "message", "details"];
  for (const field of Object.keys(message.entry)) if (!fields.includes(field)) throw new Error(`diagnostics_append_command.entry.${field} is not an approved field.`);
  for (const field of fields) if (!Object.hasOwn(message.entry, field)) throw new Error(`diagnostics_append_command.entry.${field} is required.`);
  if (!Number.isSafeInteger(message.entry.at) || message.entry.at < 0) throw new Error("diagnostics_append_command.entry.at must be a nonnegative safe integer.");
  for (const field of ["level", "category"]) requiredText(message.entry[field], `diagnostics_append_command.entry.${field}`);
  if (typeof message.entry.message !== "string") throw new Error("diagnostics_append_command.entry.message must be text.");
  const database = await openApplicationDatabase();
  const transaction = database.transaction("devLogs", "readwrite");
  transaction.objectStore("devLogs").add({
    at: message.entry.at,
    level: message.entry.level,
    category: message.entry.category,
    message: message.entry.message,
    details: cloneValue(message.entry.details)
  });
  await indexedDbTransaction(transaction);
  return {
    appended: true
  };
}
async function exportDevLogs(message) {
  validateExactWorkerCommand(message, ["type", "requestId"], [], "diagnostics_export_command");
  if (message.type !== "diagnostics.export") throw new Error('diagnostics_export_command.type must be exactly "diagnostics.export".');
  const database = await openApplicationDatabase();
  const transaction = database.transaction("devLogs", "readonly");
  const records = await indexedDbRequest(transaction.objectStore("devLogs").getAll());
  const lines = records.map(entry => `[${new Date(entry.at).toISOString()}] ${entry.level.toUpperCase()} ${entry.category}: ${entry.message}${entry.details == null ? "" : `\n${JSON.stringify(entry.details)}`}`);
  return {
    blob: new Blob([lines.join("\n\n")], {
      type: "text/plain"
    }),
    fileName: `emberadventures-lite-dev-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
    count: records.length
  };
}

//#endregion Diagnostics

//#endregion Library Storage

//#region New Game Materialization

const RuntimeEquipmentSlots = Object.freeze(["hat", "hairAccessory", "face", "ears", "neck", "shoulders", "bra", "undershirt", "shirt", "overShirt", "coat", "back", "hands", "rightWrist", "leftWrist", "rightFingers", "leftFingers", "waist", "beltAccessory", "underwear", "pants", "skirt", "legwear", "socks", "feet", "otherAccessory", "leftHand", "rightHand"]);
const AuthoredEquipmentSlotByKey = Object.freeze({
  hat: "hat",
  hair_accessory: "hairAccessory",
  face: "face",
  ears: "ears",
  neck: "neck",
  shoulders: "shoulders",
  bra: "bra",
  undershirt: "undershirt",
  shirt: "shirt",
  over_shirt: "overShirt",
  coat: "coat",
  back: "back",
  hands: "hands",
  right_wrist: "rightWrist",
  left_wrist: "leftWrist",
  right_fingers: "rightFingers",
  left_fingers: "leftFingers",
  waist: "waist",
  belt_accessory: "beltAccessory",
  underwear: "underwear",
  pants: "pants",
  skirt: "skirt",
  legwear: "legwear",
  socks: "socks",
  feet: "feet",
  other_accessory: "otherAccessory",
  left_hand: "leftHand",
  right_hand: "rightHand"
});
function cloneValue(value) {
  return structuredClone(value);
}
function finiteNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
  return value;
}
function characterAppearanceScaleValue(value, path, numericOnly = false) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0 || value > 20) throw new Error(`${path} must be a whole number from 0 to 20.`);
    return value;
  }
  const text = typeof value === "string" ? value.trim() : "";
  if (!numericOnly && text && !/^-?\d+(?:\.\d+)?$/.test(text)) return text;
  throw new Error(numericOnly ? `${path} must be a whole number from 0 to 20.` : `${path} must be a whole number from 0 to 20 or a non-empty custom description.`);
}
function characterBoldness(value, path) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return requiredText(value, path);
}
function safeRuntimeIdPart(value, fallback = "record") {
  const clean = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return clean || fallback;
}
function fnv1aText(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function stableRuntimeValue(value) {
  if (Array.isArray(value)) return value.map(stableRuntimeValue);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableRuntimeValue(value[key]);
  return output;
}
function storyRuleStableKey(rule) {
  const text = JSON.stringify(stableRuntimeValue(rule));
  return `fnv1a-${fnv1aText(text)}-${text.length}`;
}
function emptyEquipmentRecord(characterId) {
  const record = {
    characterId
  };
  for (const slot of RuntimeEquipmentSlots) record[slot] = null;
  return record;
}
function storyPlayerDefinitions(definition) {
  return definition.state.players.length ? definition.state.players : [definition.state.player];
}
function storyAllowsAnyPlayer(definition) {
  return definition.allow_any_player;
}
function playerOptionMetadata(character, source, revisionId = "") {
  return {
    source,
    characterId: requiredText(character.id, "player character id"),
    revisionId,
    name: requiredText(character.name, "player character name"),
    gender: optionalText(character.gender),
    role: optionalText(character.role),
    age: character.age,
    personalityDescription: optionalText(character.personality_description),
    fallbackName: optionalText(character.fallback_name),
    fallbackGender: optionalText(character.fallback_gender),
    supportsAlternatePresentation: Boolean(optionalText(character.fallback_name))
  };
}
async function storedStoryDefinition(storyId, revisionId) {
  const database = await openRuntimeDatabase();
  const transaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readonly");
  const key = [requiredText(storyId, "story id"), requiredText(revisionId, "revision id")];
  const [definition, compiled] = await Promise.all([indexedDbRequest(transaction.objectStore("storyDefinitions").get(key)), indexedDbRequest(transaction.objectStore("compiledStoryIndexes").get(key))]);
  if (!definition || !compiled) throw new Error("The selected story definition or its compiled index is missing.");
  return {
    definition,
    compiled
  };
}
async function storyStartOptions(message) {
  const path = "story_start_options_command";
  validateExactWorkerCommand(message, ["type", "requestId", "storyId", "revisionId"], [], path);
  if (message.type !== "story.start-options") throw new Error(`${path}.type must be exactly "story.start-options".`);
  requiredText(message.storyId, `${path}.storyId`);
  requiredText(message.revisionId, `${path}.revisionId`);
  const {
    definition,
    compiled
  } = await storedStoryDefinition(message.storyId, message.revisionId);
  return {
    storyId: definition.storyId,
    revisionId: definition.revisionId,
    title: definition.title,
    description: optionalText(definition.description),
    allowAnyPlayer: storyAllowsAnyPlayer(definition),
    players: storyPlayerDefinitions(definition).map(character => playerOptionMetadata(character, "story")),
    startingObjectiveId: compiled.startingObjectiveId
  };
}
async function selectedPlayerDefinition(definition, selection) {
  if (!isPlainObject(selection)) throw new Error("story_materialize_new_game_command.selection must be an object.");
  const source = selection.source;
  const commonFields = ["source", "characterId", "presentation"];
  const allowedFields = new Set(source === "library" ? [...commonFields, "revisionId"] : commonFields);
  for (const field of Object.keys(selection)) if (!allowedFields.has(field)) throw new Error(`story_materialize_new_game_command.selection.${field} is not an approved field.`);
  for (const field of ["source", "characterId"]) if (!Object.hasOwn(selection, field)) throw new Error(`story_materialize_new_game_command.selection.${field} is required.`);
  requiredText(selection.characterId, "story_materialize_new_game_command.selection.characterId");
  if (Object.hasOwn(selection, "presentation") && selection.presentation !== "male" && selection.presentation !== "female" && true) {}
  if (!["library", "story"].includes(source)) throw new Error("Player selection source must be exactly story or library.");
  if (source === "story") {
    const characterId = requiredText(selection?.characterId, "selected story player id");
    const character = storyPlayerDefinitions(definition).find(option => option.id === characterId);
    if (!character) throw new Error(`Story player ${characterId} was not found.`);
    return cloneValue(character);
  }
  if (!Object.hasOwn(selection, "revisionId")) throw new Error("story_materialize_new_game_command.selection.revisionId is required for a library character.");
  const characterId = requiredText(selection?.characterId, "selected library player id");
  const revisionId = requiredText(selection?.revisionId, "selected library player revision id");
  const database = await openRuntimeDatabase();
  const transaction = database.transaction("authoredCharacterDefinitions", "readonly");
  const character = await indexedDbRequest(transaction.objectStore("authoredCharacterDefinitions").get([characterId, revisionId]));
  if (!character) throw new Error(`Library character ${characterId} was not found.`);
  const selected = {
    ...character,
    id: character.characterId
  };
  delete selected.characterId;
  delete selected.revisionId;
  delete selected.contentHash;
  return selected;
}
function applyAlternatePresentation(character, presentation) {
  const requested = presentation || "";
  if (!requested || requested === character.gender) return character;
  if (!optionalText(character.fallback_name) || !Array.isArray(character.fallback_outfits) || !character.fallback_outfits.length) throw new Error(`${character.name} does not define an alternate presentation.`);
  character.name = character.fallback_name;
  character.gender = requested;
  character.outfits = cloneValue(character.fallback_outfits);
  character.starting_outfit_id = requiredText(character.fallback_starting_outfit_id, `${character.id}.fallback_starting_outfit_id`);
  return character;
}
function exactPreferredCharacterGenders(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("preferredCharacterGenders must be an array.");
  const allowed = new Set(["male", "female"]);
  const result = [];
  for (const gender of value) {
    if (!allowed.has(gender)) {}
    if (!result.includes(gender)) result.push(gender);
  }
  return result;
}
function preferredRuntimeGender(character, preferredGenders) {
  const current = character.gender === "male" || false ? character.gender : "female";
  if (!preferredGenders.length || preferredGenders.length === 3) return current;
  if (preferredGenders.includes(current)) return current;
  if (preferredGenders.length === 1) return preferredGenders[0];
  
  return current;
}
function applyPreferredRuntimePresentation(character, preferredGenders, swapAll) {
  if (!isPlainObject(character)) return character;
  if (character.romanceable !== true && swapAll !== true) return character;
  const target = preferredRuntimeGender(character, preferredGenders);
  const current = character.gender === "male" || false ? character.gender : "female";
  if (target === current) return character;
  if (target === "male" !== (current === "male")) return applyAlternatePresentation(character, target);
  character.gender = target;
  return character;
}
function applyAnyPlayerStartingState(character, overlay = {}) {
  if (!isPlainObject(overlay)) throw new Error("any_player_starting_state must be an object.");
  if (Object.hasOwn(overlay, "role")) character.role = optionalText(overlay.role);
  if (Object.hasOwn(overlay, "starting_known_facts_to_add")) character.starting_known_facts = [...character.starting_known_facts, ...cloneValue(overlay.starting_known_facts_to_add)];
  for (const key of ["starting_inventory", "stats", "starting_held_items", "starting_state_of_mind", "starting_physical_state", "starting_pose"]) {
    if (Object.hasOwn(overlay, key)) character[key] = cloneValue(overlay[key]);
  }
  const male = character.gender === "male";
  const outfitsKey = male ? "male_outfits" : "non_male_outfits";
  const startingOutfitKey = male ? "male_starting_outfit_id" : "non_male_starting_outfit_id";
  if (Array.isArray(overlay[outfitsKey]) && overlay[outfitsKey].length) {
    character.outfits = cloneValue(overlay[outfitsKey]);
    character.starting_outfit_id = requiredText(overlay[startingOutfitKey], `any_player_starting_state.${startingOutfitKey}`);
  }
  return character;
}
function characterDefinitionsInStory(state, selectedPlayer) {
  const charactersById = new Map();
  const shellsById = new Map();
  const referenceNamesById = new Map();
  const addCharacter = (character, reference = "") => {
    const id = character.id;
    if (!charactersById.has(id)) charactersById.set(id, character);
    const references = referenceNamesById.get(id) || new Set();
    for (const value of [reference, character.name, character.fallback_name]) {
      const name = optionalText(value);
      if (name) references.add(name.toLowerCase());
    }
    referenceNamesById.set(id, references);
  };
  const addShell = (shell, locationId, reference = "") => {
    const character = shell.animal_definition || shell.full_character;
    const id = character.id;
    addCharacter(character, reference);
    shellsById.set(id, {
      shell,
      locationId
    });
  };
  addCharacter(selectedPlayer, selectedPlayer.name);
  for (const [reference, character] of Object.entries(state.characters)) addCharacter(character, reference);
  for (const [reference, entry] of Object.entries(state.future_cast.items)) addCharacter(entry.animal_definition || entry.full_character, reference);
  for (const [locationId, location] of Object.entries(state.npc_directory.locations)) {
    for (const [reference, shell] of Object.entries(location.characters)) addShell(shell, locationId, reference);
  }
  return {
    charactersById,
    shellsById,
    referenceNamesById
  };
}
function characterPronouns(character) {
  if (character?.gender === "male") {
    return {
      subject: "he",
      object: "him",
      possessive: "his",
      independent: "his",
      reflexive: "himself",
      person: "man",
      honorific: "Mr.",
      formal: "sir",
      monarch: "king",
      heir: "prince",
      noble: "lord",
      spouse: "husband",
      parent: "father",
      child: "son",
      sibling: "brother",
      uncleAunt: "uncle",
      nephewNiece: "nephew"
    };
  }
  if (character?.gender === "female" || false) {
    return {
      subject: "she",
      object: "her",
      possessive: "her",
      independent: "hers",
      reflexive: "herself",
      person: "woman",
      honorific: "Ms.",
      formal: "ma'am",
      monarch: "queen",
      heir: "princess",
      noble: "lady",
      spouse: "wife",
      parent: "mother",
      child: "daughter",
      sibling: "sister",
      uncleAunt: "aunt",
      nephewNiece: "niece"
    };
  }
  return {
    subject: "they",
    object: "them",
    possessive: "their",
    independent: "theirs",
    reflexive: "themself",
    person: "person",
    honorific: "Mx.",
    formal: "friend",
    monarch: "monarch",
    heir: "heir",
    noble: "noble",
    spouse: "spouse",
    parent: "parent",
    child: "child",
    sibling: "sibling",
    uncleAunt: "aunt or uncle",
    nephewNiece: "niece or nephew"
  };
}
function capitalizeReference(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}
function runtimeTextResolver(state, selectedPlayer, storyCharacters = null) {
  const {
    charactersById
  } = storyCharacters || characterDefinitionsInStory(state, selectedPlayer);
  const playerId = requiredText(selectedPlayer.id, "selected player id");
  const playerPronouns = characterPronouns(selectedPlayer);
  const firstName = character => requiredText(character.name, `${character.id}.name`).split(/\s+/)[0];
  const valueFor = (type, character) => {
    const pronouns = characterPronouns(character);
    const values = {
      character: character.name,
      character_first: firstName(character),
      character_pronoun: pronouns.subject,
      character_subject_pronoun: pronouns.subject,
      character_object_pronoun: pronouns.object,
      character_possessive_pronoun: pronouns.possessive,
      character_independent_possessive_pronoun: pronouns.independent,
      character_reflexive_pronoun: pronouns.reflexive,
      character_person_term: pronouns.person,
      character_honorific: pronouns.honorific,
      character_formal_address: pronouns.formal,
      character_monarch_title: pronouns.monarch,
      character_royal_heir_title: pronouns.heir,
      character_noble_title: pronouns.noble,
      character_spouse_term: pronouns.spouse,
      character_parent_term: pronouns.parent,
      character_child_term: pronouns.child,
      character_sibling_term: pronouns.sibling,
      character_uncle_aunt_term: pronouns.uncleAunt,
      character_nephew_niece_term: pronouns.nephewNiece
    };
    const normalizedType = type.replace(/-cap$/, "_cap");
    const capitalized = normalizedType.endsWith("_cap");
    const baseType = capitalized ? normalizedType.slice(0, -4) : normalizedType;
    const value = values[baseType];
    return value == null ? null : capitalized ? capitalizeReference(value) : value;
  };
  const playerValues = {
    player_name: selectedPlayer.name,
    player_first_name: firstName(selectedPlayer),
    player_pronoun: playerPronouns.subject,
    player_subject_pronoun: playerPronouns.subject,
    player_object_pronoun: playerPronouns.object,
    player_possessive_pronoun: playerPronouns.possessive,
    player_independent_possessive_pronoun: playerPronouns.independent,
    player_reflexive_pronoun: playerPronouns.reflexive
  };
  return value => String(value ?? "").replace(/\|\[([^\]:]+)(?::([^\]]+))?\]\|/g, (token, type, id) => {
    const normalizedType = String(type || "").replace(/-cap$/, "_cap");
    if (!id) {
      const capitalized = normalizedType.endsWith("_cap");
      const baseType = capitalized ? normalizedType.slice(0, -4) : normalizedType;
      const replacement = playerValues[baseType];
      return replacement == null ? token : capitalized ? capitalizeReference(replacement) : replacement;
    }
    const character = charactersById.get(id === "player" ? playerId : id);
    if (!character) return token;
    return valueFor(normalizedType, character) ?? token;
  });
}
function currentRuntimeCharacters(state, selectedPlayer, storyCharacters) {
  const selectedId = requiredText(selectedPlayer.id, "selected player id");
  const byName = new Map();
  for (const character of storyCharacters.charactersById.values()) byName.set(optionalText(character.name).toLowerCase(), character);
  const currentLocationId = requiredText(state.location.npc_location_id, "state.location.npc_location_id");
  const currentLocation = state.npc_directory.locations[currentLocationId];
  if (!currentLocation) throw new Error(`state.location.npc_location_id references unknown NPC location ${currentLocationId}.`);
  const currentLocationCharacters = Object.values(currentLocation.characters);
  const selected = new Map([[selectedId, selectedPlayer]]);
  for (const character of Object.values(state.characters)) {
    const definition = character;
    const id = optionalText(definition.id);
    if (id) selected.set(id, definition);
  }
  for (const shell of currentLocationCharacters) {
    const definition = shell.animal_definition || shell.full_character;
    const id = optionalText(definition?.id);
    if (id && isPlainObject(definition)) selected.set(id, definition);
  }
  for (const nameOrId of [...state.scene.party_members_present, ...state.scene.npcs_present]) {
    const value = optionalText(nameOrId);
    const definition = storyCharacters.charactersById.get(value) || byName.get(value.toLowerCase());
    if (definition) selected.set(requiredText(definition.id, "scene character id"), definition);
  }
  return selected;
}
function equipmentItemName(outfitName, slot) {
  const words = slot.replace(/([A-Z])/g, " $1").toLowerCase();
  return `${outfitName} ${words}`.trim();
}
function isAnimalCharacterDefinition(character) {
  return character?.definition_type === "animal" || isPlainObject(character) && Object.hasOwn(character, "physical_description") && !Object.hasOwn(character, "appearance");
}
function materializeCharacterRecords(character, resolveText, addRecord) {
  const characterId = requiredText(character.id, "character.id");
  const animal = isAnimalCharacterDefinition(character);
  const appearance = character.appearance;
  if (!animal && !isPlainObject(appearance)) throw new Error(`${characterId}.appearance is required.`);
  addRecord("saveCharacterDefinitions", {
    characterId,
    definitionType: animal ? "animal" : "humanoid",
    name: resolveText(requiredText(character.name, `${characterId}.name`)),
    species: resolveText(requiredText(animal ? character.species : appearance.species, `${characterId}.${animal ? "species" : "appearance.species"}`)),
    physicalDescription: animal ? resolveText(requiredText(character.physical_description, `${characterId}.physical_description`)) : "",
    canDie: character.can_die === true,
    age: finiteNumber(character.age, `${characterId}.age`),
    gender: requiredText(character.gender, `${characterId}.gender`),
    personalityDescription: resolveText(requiredText(character.personality_description, `${characterId}.personality_description`)),
    speechStyle: resolveText(requiredText(animal ? character.communication_style : character.speech_style, `${characterId}.${animal ? "communication_style" : "speech_style"}`)),
    boldness: animal ? 0 : characterBoldness(character.boldness, `${characterId}.boldness`)
  });
  if (!animal) addRecord("characterAppearance", {
    characterId,
    species: resolveText(requiredText(appearance.species, `${characterId}.appearance.species`)),
    height: characterAppearanceScaleValue(appearance.height, `${characterId}.appearance.height`),
    bodyDescription: resolveText(appearance.body_description),

    skinColor: resolveText(String(appearance.skin_color ?? "")),
    eyeColor: resolveText(String(appearance.eye_color ?? "")),
    hairColor: resolveText(String(appearance.hair_color ?? "")),
    hairLength: resolveText(String(appearance.hair_length ?? "")),
    hairType: resolveText(String(appearance.hair_type ?? "")),
    extraDescription: resolveText(String(appearance.extra_description ?? "")),
    extraDescriptionLowerBody: resolveText(String(appearance.extra_description_lower_body ?? "")),
    maleOnlyExtraDescription: appearance.male_only_extra_description == null ? null : resolveText(String(appearance.male_only_extra_description)),
    nonMaleOnlyExtraDescription: appearance.non_male_only_extra_description == null ? null : resolveText(String(appearance.non_male_only_extra_description)),
    nonhumanLowerBody: appearance.nonhuman_lower_body === true
  });
  const fallbackImageSeed = Number.parseInt(fnv1aText(`animal-image:${characterId}`), 16);
  const imageConfiguration = animal && !isPlainObject(character.image_prompt_config) ? {
    seed_enabled: true,
    seed: fallbackImageSeed
  } : character.image_prompt_config;
  const characterSettings = {
    characterId,
    imageSeedEnabled: imageConfiguration.seed_enabled,
    imageSeed: finiteNumber(imageConfiguration.seed, `${characterId}.image_prompt_config.seed`)
  };
  addRecord("characterSettings", characterSettings);
  const activeOutfitId = animal ? null : requiredText(character.starting_outfit_id, `${characterId}.starting_outfit_id`);
  addRecord("characterDurableState", {
    characterId,
    role: resolveText(requiredText(character.role, `${characterId}.role`)),
    relationshipToPlayer: resolveText(requiredText(character.starting_relationship_to_player, `${characterId}.starting_relationship_to_player`)),
    activeOutfitId
  });
  addRecord("characterRelationshipStats", {
    characterId,
    trust: finiteNumber(character.starting_trust, `${characterId}.starting_trust`),
    attraction: animal ? 0 : finiteNumber(character.starting_attraction, `${characterId}.starting_attraction`),
    affection: finiteNumber(character.starting_affection, `${characterId}.starting_affection`)
  });
  addRecord("characterSceneState", {
    characterId,
    stateOfMind: resolveText(character.starting_state_of_mind),
    physicalState: resolveText(character.starting_physical_state),
    pose: resolveText(character.starting_pose)
  });
  for (const [statId, value] of Object.entries(character.stats || {})) addRecord("characterStats", {
    characterId,
    statId,
    value
  });
  character.starting_known_facts.forEach((fact, index) => {
    addRecord("characterFacts", {
      characterId,
      factId: `starting-fact-${index + 1}`,
      sequence: index + 1,
      text: resolveText(requiredText(fact, `${characterId}.starting_known_facts[${index}]`))
    });
  });
  const itemsById = new Map();
  const outfitsById = new Map();
  const addItem = item => {
    const existing = itemsById.get(item.itemId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw new Error(`Conflicting item id ${item.itemId}.`);
    if (!existing) itemsById.set(item.itemId, item);
  };
  for (const outfit of animal ? [] : character.outfits) {
    const outfitId = requiredText(outfit.id, `${characterId}.outfit.id`);
    const outfitName = resolveText(requiredText(outfit.name, `${characterId}.${outfitId}.name`));
    const outfitRecord = {
      ...emptyEquipmentRecord(characterId),
      outfitId,
      name: outfitName,
      formality: 0,
      revealing: 0,
      origin: "",
      memory: "",
      sourceShopId: "",
      sourceOutfitId: "",
      imagePrompt: "",
      imageId: ""
    };
    for (const [authoredSlot, rawDescription] of Object.entries(outfit.clothing || {})) {
      const slot = AuthoredEquipmentSlotByKey[authoredSlot];
      if (!slot) throw new Error(`${characterId}.${outfitId}.clothing.${authoredSlot} is not an approved equipment slot.`);
      if (rawDescription == null) continue;
      const description = resolveText(requiredText(rawDescription, `${characterId}.${outfitId}.clothing.${authoredSlot}`));
      const itemId = `${safeRuntimeIdPart(characterId)}-${safeRuntimeIdPart(outfitId)}-${safeRuntimeIdPart(slot)}-${fnv1aText(description)}`;
      addItem({
        itemId,
        characterId,
        name: equipmentItemName(outfitName, slot),
        type: "clothing",
        slot: ["leftHand", "rightHand"].includes(slot) ? "hand" : slot,
        quantity: 1,
        value: 0,
        sellable: false,
        questItem: false,
        description,
        imageId: null
      });
      outfitRecord[slot] = itemId;
    }
    outfitsById.set(outfitId, outfitRecord);
    addRecord("characterOutfits", outfitRecord);
  }
  if (animal) return;
  const equipped = cloneValue(outfitsById.get(activeOutfitId));
  if (!equipped) throw new Error(`${characterId} starting outfit ${activeOutfitId} does not exist.`);
  const equippedRecord = emptyEquipmentRecord(characterId);
  for (const slot of RuntimeEquipmentSlots) equippedRecord[slot] = equipped[slot];
  const heldItems = character.starting_held_items;
  for (const [authoredSlot, rawValue] of Object.entries(heldItems)) {
    const slot = AuthoredEquipmentSlotByKey[authoredSlot];
    if (!["leftHand", "rightHand"].includes(slot)) throw new Error(`${characterId}.starting_held_items.${authoredSlot} is invalid.`);
    if (rawValue == null) continue;
    const description = resolveText(requiredText(rawValue, `${characterId}.starting_held_items.${authoredSlot}`));
    const itemId = `${safeRuntimeIdPart(characterId)}-hand-${fnv1aText(description)}`;
    addItem({
      itemId,
      characterId,
      name: description,
      type: "held item",
      slot: "hand",
      quantity: 1,
      value: 0,
      sellable: false,
      questItem: false,
      description,
      imageId: null
    });
    equippedRecord[slot] = itemId;
  }
  const inventory = character.starting_inventory;
  for (const [index, rawItem] of inventory.entries()) {
    const item = typeof rawItem === "string" ? {
      name: rawItem,
      description: rawItem
    } : rawItem;
    if (!isPlainObject(item)) throw new Error(`${characterId}.starting_inventory[${index}] must be a string or object.`);
    const description = resolveText(requiredText(item.description || item.name, `${characterId}.starting_inventory[${index}]`));
    const itemId = optionalText(item.id) || `${safeRuntimeIdPart(characterId)}-inventory-${fnv1aText(`${index}:${description}`)}`;
    const slot = null;
    const existing = itemsById.get(itemId);
    if (existing) {
      if (existing.description !== description && existing.name !== description) throw new Error(`Conflicting item id ${itemId}.`);
      existing.inventorySequence = index + 1;
      existing.quantity = finiteNumber(item.quantity ?? existing.quantity ?? 1, `${characterId}.starting_inventory[${index}].quantity`);
      existing.value = finiteNumber(item.value ?? existing.value ?? 0, `${characterId}.starting_inventory[${index}].value`);
      existing.sellable = item.sellable === true;
      existing.questItem = item.quest_item === true;
      existing.imageId = optionalText(item.image_id) || existing.imageId || null;
      continue;
    }
    addItem({
      itemId,
      characterId,
      name: resolveText(requiredText(item.name || description, `${characterId}.starting_inventory[${index}].name`)),
      type: optionalText(item.type) || "item",
      slot,
      quantity: finiteNumber(item.quantity ?? 1, `${characterId}.starting_inventory[${index}].quantity`),
      inventorySequence: index + 1,
      value: finiteNumber(item.value ?? 0, `${characterId}.starting_inventory[${index}].value`),
      sellable: item.sellable === true,
      questItem: item.quest_item === true,
      description,
      imageId: optionalText(item.image_id) || null
    });
  }
  for (const item of itemsById.values()) addRecord("items", item);
  addRecord("equippedItems", equippedRecord);
  addRecord("temporaryRemovedItems", emptyEquipmentRecord(characterId));
}
function resolvedCharacterId(value, storyCharacters, selectedPlayer) {
  const text = optionalText(value);
  if (!text) return "";
  if (text.toLowerCase() === "player" || text === selectedPlayer.id || text === selectedPlayer.name) return selectedPlayer.id;
  if (storyCharacters.charactersById.has(text)) return text;
  for (const character of storyCharacters.charactersById.values()) {
    if (optionalText(character.name).toLowerCase() === text.toLowerCase()) return optionalText(character.id);
    const references = storyCharacters.referenceNamesById?.get(character.id) || [];
    if (references.has(text.toLowerCase())) return optionalText(character.id);
  }
  return "";
}
function addFlexibleStoryRecords(root, value, resolveText, addRecord, path = []) {
  if (Array.isArray(value)) {
    const listPathKey = path.join(".");
    value.forEach((item, index) => {
      const resolvedValue = typeof item === "string" ? resolveText(item) : cloneValue(item);
      addRecord("storyListItems", {
        root,
        listPathKey,
        itemKey: `fnv1a-${fnv1aText(JSON.stringify(resolvedValue))}`,
        sequence: index + 1,
        value: resolvedValue
      });
    });
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) addFlexibleStoryRecords(root, nested, resolveText, addRecord, [...path, key]);
    return;
  }
  if (!path.length) return;
  addRecord("storyValues", {
    root,
    pathKey: path.join("."),
    value: typeof value === "string" ? resolveText(value) : value ?? null
  });
}
function materializeNpcShell(shellRecord, character, locationId, resolveText, addRecord) {
  const shell = shellRecord?.shell || {};
  const characterId = requiredText(character.id, "NPC character id");
  addRecord("npcShells", {
    locationId: requiredText(shellRecord?.locationId || locationId, `${characterId}.locationId`),
    characterId,
    name: resolveText(optionalText(shell.name || character.name)),
    playerKnownName: shell.player_known_name === true,
    playerFacingLabel: resolveText(optionalText(shell.player_facing_label)),
    gender: optionalText(shell.gender || character.gender),
    age: finiteNumber(shell.age ?? character.age, `${characterId}.age`),
    role: resolveText(optionalText(shell.role || character.role)),
    relationshipToPlayer: resolveText(optionalText(shell.relationship || character.starting_relationship_to_player)),
    note: resolveText(optionalText(shell.note)),
    personalityDescription: resolveText(optionalText(shell.personality_description || character.personality_description)),
    greeting: resolveText(optionalText(shell.greeting)),
    currentAppearance: resolveText(optionalText(shell.current_appearance)),
    canDie: shell.can_die === true || character.can_die === true,
    recruitable: shell.recruitable === true,
    everInvited: shell.ever_invited === true,
    futureCharacterId: optionalText(shell.future_character_id) || null,
    status: shell.status === "dead" ? "dead" : "alive",
    deathNote: resolveText(optionalText(shell.death_note)),
    killedBy: resolveText(optionalText(shell.killed_by)),
    killedByPlayer: shell.killed_by_player === true,
    inspected: isPlainObject(shell.full_character) || isPlainObject(shell.animal_definition)
  });
}
function authoredCharacterSeedFromRuntime(character) {
  const seed = cloneValue(character);
  if (isAnimalCharacterDefinition(seed)) {
    seed.definition_type = "animal";
    seed.communication_style = seed.communication_style ?? seed.speech_style;
    seed.starting_relationship_to_player = optionalText(seed.relationship_to_player) || optionalText(seed.starting_relationship_to_player);
    seed.starting_trust = seed.trust ?? seed.starting_trust;
    seed.starting_affection = seed.affection ?? seed.starting_affection;
    seed.starting_state_of_mind = seed.state_of_mind ?? seed.starting_state_of_mind;
    seed.starting_physical_state = seed.physical_state ?? seed.starting_physical_state;
    seed.starting_pose = seed.pose ?? seed.starting_pose;
    seed.starting_known_facts = seed.known_facts ?? seed.starting_known_facts;
    return seed;
  }
  seed.starting_outfit_id = seed.active_outfit_id ?? seed.starting_outfit_id;
  seed.starting_relationship_to_player = optionalText(seed.relationship_to_player) || optionalText(seed.starting_relationship_to_player);
  seed.starting_trust = seed.trust ?? seed.starting_trust;
  seed.starting_attraction = seed.attraction ?? seed.starting_attraction;
  seed.starting_affection = seed.affection ?? seed.starting_affection;
  seed.starting_state_of_mind = seed.state_of_mind ?? seed.starting_state_of_mind;
  seed.starting_physical_state = seed.physical_state ?? seed.starting_physical_state;
  seed.starting_pose = seed.pose ?? seed.starting_pose;
  seed.starting_held_items = seed.held_items ?? seed.starting_held_items;
  seed.starting_inventory = (seed.inventory ?? seed.starting_inventory ?? []).map(item => {
    if (!isPlainObject(item)) return item;
    return {
      id: optionalText(item.id || item.itemId),
      name: optionalText(item.name || item.item || item.description),
      description: optionalText(item.description || item.item || item.name),
      quantity: item.quantity ?? 1,
      value: item.value ?? 0,
      sellable: item.sellable === true,
      quest_item: item.quest_item === true || item.questItem === true,
      image_id: optionalText(item.image_id || item.imageId)
    };
  });
  seed.starting_known_facts = seed.known_facts ?? seed.starting_known_facts;
  return seed;
}
function authoredPlayerSeedFromRuntime(character) {
  const seed = authoredCharacterSeedFromRuntime(character);
  // The player has no relationship-to-self runtime stats, while the shared
  // character storage rows require exact numeric columns.
  seed.starting_relationship_to_player = "self";
  seed.starting_trust = 0;
  seed.starting_attraction = 0;
  seed.starting_affection = 0;
  return seed;
}
function runtimeStateForInitialRecordMaterialization(state) {
  const materialized = cloneValue(state);
  materialized.meta ||= {};
  delete materialized.meta.title_image_html;
  delete materialized.meta.title_image_alt;
  materialized.player = authoredPlayerSeedFromRuntime(materialized.player);
  materialized.characters = Object.fromEntries(Object.entries(materialized.characters || {}).map(([key, character]) => [key, authoredCharacterSeedFromRuntime(character)]));
  for (const entry of Object.values(materialized.future_cast?.items || {})) if (isPlainObject(entry?.animal_definition)) entry.animal_definition = authoredCharacterSeedFromRuntime(entry.animal_definition);else if (isPlainObject(entry?.full_character)) entry.full_character = authoredCharacterSeedFromRuntime(entry.full_character);
  for (const location of Object.values(materialized.npc_directory?.locations || {})) for (const shell of Object.values(location?.characters || {})) if (isPlainObject(shell?.animal_definition)) shell.animal_definition = authoredCharacterSeedFromRuntime(shell.animal_definition);else if (isPlainObject(shell?.full_character)) shell.full_character = authoredCharacterSeedFromRuntime(shell.full_character);
  return materialized;
}
async function materializeNewGame(message) {
  const runtimeMaterialization = message.type === "story.materialize-runtime-game";
  const path = runtimeMaterialization ? "story_materialize_runtime_game_command" : "story_materialize_new_game_command";
  validateExactWorkerCommand(message, runtimeMaterialization ? ["type", "requestId", "storyId", "revisionId", "title", "state", "messages", "contentHash", "titleImageId"] : ["type", "requestId", "storyId", "revisionId", "selection"], runtimeMaterialization ? [] : ["preferredCharacterGenders", "swapAllGendersToPreferred"], path);
  if (!runtimeMaterialization && message.type !== "story.materialize-new-game") throw new Error(`${path}.type must be exactly "story.materialize-new-game".`);
  requiredText(message.storyId, `${path}.storyId`);
  requiredText(message.revisionId, `${path}.revisionId`);
  const startedAt = performance.now();
  let definition;
  let compiled;
  let selectedPlayer;
  if (runtimeMaterialization) {
    if (!isPlainObject(message.state)) throw new Error(`${path}.state must be an object.`);
    if (!Array.isArray(message.messages)) throw new Error(`${path}.messages must be an array.`);
    definition = {
      storyId: message.storyId,
      revisionId: message.revisionId,
      contentHash: requiredText(message.contentHash, `${path}.contentHash`),
      title: requiredText(message.title, `${path}.title`),
      description: optionalText(message.state?.meta?.story_source?.description),
      source: "Original",
      creator: "EmberAdventures",
      creator_id: "00000000-0000-4000-8000-000000000001",
      creation_tool: "EmberAdventures",
      genres: cloneValue(message.state?.meta?.genres || []),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allow_any_player: false,
      any_player_starting_state: {},
      state: runtimeStateForInitialRecordMaterialization(message.state),
      messages: cloneValue(message.messages),
      default_image_model: "",
      editor_data: {},
      title_card_subjects: [],
      title_card_image: {}
    };
    compiled = compileValidatedStoryIndexes(definition, definition.contentHash, message.requestId);
    selectedPlayer = cloneValue(definition.state?.player);
    if (!isPlainObject(selectedPlayer)) throw new Error(`${path}.state.player must be an object.`);
  } else {
    ({
      definition,
      compiled
    } = await storedStoryDefinition(message.storyId, message.revisionId));
    selectedPlayer = await selectedPlayerDefinition(definition, message.selection);
    selectedPlayer = applyAlternatePresentation(selectedPlayer, message.selection?.presentation);
  }
  if (!runtimeMaterialization && message.selection?.source === "library") selectedPlayer = applyAnyPlayerStartingState(selectedPlayer, definition.any_player_starting_state);
  const playerId = requiredText(selectedPlayer.id, "selected player id");
  const state = definition.state;
  const storyCharacters = characterDefinitionsInStory(state, selectedPlayer);
  if (!runtimeMaterialization) {
    const preferredGenders = exactPreferredCharacterGenders(message.preferredCharacterGenders);
    if (message.swapAllGendersToPreferred != null && typeof message.swapAllGendersToPreferred !== "boolean") throw new Error("swapAllGendersToPreferred must be true or false.");
    for (const [characterId, character] of storyCharacters.charactersById) {
      if (characterId === playerId) continue;
      applyPreferredRuntimePresentation(character, preferredGenders, message.swapAllGendersToPreferred === true);
    }
  }
  if (!runtimeMaterialization && message.selection?.source === "library" && storyCharacters.charactersById.has(playerId)) {
    const existing = storyCharacters.charactersById.get(playerId);
    if (existing !== selectedPlayer && optionalText(existing.name) !== optionalText(selectedPlayer.name)) throw new Error(`Library player id ${playerId} conflicts with a story character.`);
  }
  const resolveText = runtimeTextResolver(state, selectedPlayer, storyCharacters);
  const records = [];
  const recordKeys = new Set();
  const addRecord = (storeName, rawRecord) => {
    const record = rawRecord;
    const key = `${storeName}:${JSON.stringify(record)}`;
    if (recordKeys.has(key)) return;
    recordKeys.add(key);
    records.push({
      storeName,
      record
    });
  };
  const runtimeCharacters = currentRuntimeCharacters(state, selectedPlayer, storyCharacters);
  for (const character of runtimeCharacters.values()) materializeCharacterRecords(character, resolveText, addRecord);
  for (const character of Object.values(state.characters || {})) {
    const id = optionalText(character.id);
    if (id && id !== playerId) addRecord("partyMembers", {
      characterId: id
    });
  }
  const currentLocationId = runtimeMaterialization ? requiredText(state.location?.npc_location_id, "state.location.npc_location_id") : requiredText(state.world_map.current_location_id, "state.world_map.current_location_id");
  const scene = state.scene || {};
  addRecord("sceneRuntime", {
    summary: resolveText(String(scene.summary ?? "")),
    imageAction: resolveText(String(scene.image_action ?? ""))
  });
  const sceneParticipantIds = new Set([playerId]);
  for (const value of [...(scene.party_members_present || []), ...(scene.npcs_present || [])]) {
    const characterId = resolvedCharacterId(value, storyCharacters, selectedPlayer);
    if (characterId) sceneParticipantIds.add(characterId);
    if (characterId && characterId !== playerId) addRecord("sceneMembers", {
      characterId
    });
  }
  for (const value of scene.image_characters || []) {
    const characterId = resolvedCharacterId(value, storyCharacters, selectedPlayer);
    if (characterId) addRecord("sceneImageTargets", {
      characterId
    });
  }
  for (const character of runtimeCharacters.values()) {
    if (character.id === playerId) continue;
    const shellRecord = storyCharacters.shellsById.get(character.id);
    if (shellRecord) materializeNpcShell(shellRecord, character, currentLocationId, resolveText, addRecord);
  }
  addRecord("currentLocation", {
    locationId: currentLocationId
  });
  const time = state.time || {};
  addRecord("gameTime", {
    year: finiteNumber(time.year, "state.time.year"),
    month: finiteNumber(time.month, "state.time.month"),
    day: finiteNumber(time.day, "state.time.day"),
    hour: finiteNumber(time.hour, "state.time.hour"),
    minute: finiteNumber(time.minute, "state.time.minute"),
    //Older authored files still carry elapsed minutes beside the calendar.
    //The runtime writes only the unified gameTime record.
    elapsedMinutes: finiteNumber(state.story_clock.elapsed_minutes, "state.story_clock.elapsed_minutes")
  });
  for (const root of ["story_inventory", "world_flags", "progression"]) {
    if (isPlainObject(state[root])) addFlexibleStoryRecords(root, state[root], resolveText, addRecord);
  }
  for (const [category, notes] of Object.entries(state.story_memory || {})) {
    (Array.isArray(notes) ? notes : []).forEach((note, index) => {
      addRecord("storyMemoryNotes", {
        category,
        noteId: `${safeRuntimeIdPart(category)}-${index + 1}`,
        sequence: index + 1,
        text: resolveText(requiredText(note, `state.story_memory.${category}[${index}]`))
      });
    });
  }
  (state.recent_changes || []).slice(-8).forEach((change, index) => {
    addRecord("recentChanges", {
      changeRecordId: `starting-change-${index + 1}`,
      sequence: index + 1,
      text: resolveText(requiredText(change, `state.recent_changes[${index}]`))
    });
  });
  for (const event of Object.values(state.timed_events || {})) {
    const timedEventId = requiredText(event.id, "timed event id");
    addRecord("timedEventRuntime", {
      timedEventId,
      status: requiredText(event.status, `${timedEventId}.status`),
      startElapsedMinutes: event.start_elapsed_minutes == null ? null : finiteNumber(event.start_elapsed_minutes, `${timedEventId}.start_elapsed_minutes`)
    });
    for (const stageId of event.applied_stage_ids || []) addRecord("timedEventAppliedStages", {
      timedEventId,
      stageId: requiredText(stageId, `${timedEventId}.applied_stage_ids`)
    });
  }
  const activeObjectiveId = requiredText(state.objectives.active_id, "state.objectives.active_id");
  addRecord("objectiveControl", {
    activeMainObjectiveId: activeObjectiveId,
    focusedSideObjectiveId: null
  });
  const createdAt = Date.now();
  const openingMessages = [];
  (definition.messages || []).forEach((messageValue, index) => {
    const messageId = `opening-${index + 1}`;
    const text = resolveText(requiredText(messageValue.text, `story messages[${index}].text`));
    addRecord("messages", {
      messageId,
      sequence: index + 1,
      role: requiredText(messageValue.role, `story messages[${index}].role`),
      speaker: resolveText(messageValue.speaker),
      text,
      detail: optionalText(messageValue.detail) || "normal",
      at: optionalText(messageValue.at) || new Date(createdAt + index).toISOString()
    });
    openingMessages.push({
      messageId,
      role: messageValue.role,
      speaker: resolveText(messageValue.speaker),
      text
    });
  });
  const objective = definition.state.objectives.items[compiled.objectiveIndexById[activeObjectiveId]];
  const header = {
    storyId: definition.storyId,
    revisionId: definition.revisionId,
    playerCharacterId: playerId,
    displayName: definition.title,
    storyGuidance: resolveText(optionalText(state.meta?.story_guidance)),
    ...(runtimeMaterialization && optionalText(message.titleImageId) ? {
      titleImageId: optionalText(message.titleImageId)
    } : {}),
    createdAt
  };
  return {
    header,
    initialRecords: records,
    ...(runtimeMaterialization ? {
      immutableStory: {
        definition,
        compiledIndexes: {
          storyId: definition.storyId,
          revisionId: definition.revisionId,
          ...compiled
        }
      }
    } : {}),
    opening: {
      storyTitle: definition.title,
      playerId,
      playerName: resolveText(selectedPlayer.name),
      objectiveId: activeObjectiveId,
      objectiveTitle: resolveText(requiredText(objective?.title, `${activeObjectiveId}.title`)),
      objectiveSummary: resolveText(requiredString(objective?.summary, `${activeObjectiveId}.summary`)),
      sceneSummary: resolveText(String(scene.summary ?? "")),
      messages: openingMessages
    },
    metrics: {
      durationMilliseconds: performance.now() - startedAt,
      initialRecordCount: records.length,
      immutableObjectiveCount: Object.keys(compiled.objectiveIndexById || {}).length,
      objectiveRecordsCopied: records.filter(record => record.storeName === "objectiveRuntime").length
    }
  };
}
async function materializeRuntimeCharacter(message) {
  const path = "story_materialize_runtime_character_command";
  validateExactWorkerCommand(message, ["type", "requestId", "storyId", "revisionId", "characterId", "player"], ["character", "locationId", "replace"], path);
  if (message.type !== "story.materialize-runtime-character") throw new Error(`${path}.type must be exactly "story.materialize-runtime-character".`);
  requiredText(message.storyId, `${path}.storyId`);
  requiredText(message.revisionId, `${path}.revisionId`);
  requiredText(message.characterId, `${path}.characterId`);
  if (!isPlainObject(message.player)) throw new Error(`${path}.player must be an object.`);
  if (Object.hasOwn(message, "character") && !isPlainObject(message.character)) throw new Error(`${path}.character must be an object.`);
  if (Object.hasOwn(message, "locationId")) requiredText(message.locationId, `${path}.locationId`);
  if (Object.hasOwn(message, "replace") && message.replace !== true) throw new Error(`${path}.replace must be exactly true when present.`);
  const characterId = requiredText(message.characterId, "runtime character id");
  const selectedPlayer = cloneValue(message.player);
  if (!isPlainObject(selectedPlayer)) throw new Error("Runtime character materialization requires the finalized player identity.");
  selectedPlayer.id = requiredText(selectedPlayer.id, "runtime player id");
  const {
    definition
  } = await storedStoryDefinition(requiredText(message.storyId, "runtime story id"), requiredText(message.revisionId, "runtime story revision id"));
  const storyCharacters = characterDefinitionsInStory(definition.state, selectedPlayer);
  const runtimeCharacter = Object.hasOwn(message, "character") ? cloneValue(message.character) : null;
  const character = runtimeCharacter || storyCharacters.charactersById.get(characterId);
  if (!character) throw new Error(`Story character ${characterId} does not exist in the immutable definition.`);
  character.id = requiredText(character.id, "runtime character id");
  if (character.id !== characterId) throw new Error("Runtime character replacement id does not match characterId.");
  const resolveText = runtimeTextResolver(definition.state, selectedPlayer, storyCharacters);
  const records = [];
  const addRecord = (storeName, rawRecord) => records.push({
    storeName,
    record: rawRecord
  });
  materializeCharacterRecords(authoredCharacterSeedFromRuntime(character), resolveText, addRecord);
  const shellRecord = storyCharacters.shellsById.get(characterId);
  if (shellRecord) {
    materializeNpcShell(shellRecord, character, Object.hasOwn(message, "locationId") ? message.locationId : requiredText(shellRecord.locationId, `${characterId}.locationId`), resolveText, addRecord);
  }
  return {
    characterId,
    records,
    replace: message.replace === true
  };
}

//#region Runtime Compatibility Reconstruction

function runtimeRecordsByCharacter(recordsByStore, storeName) {
  const grouped = new Map();
  for (const record of recordsByStore[storeName] || []) {
    const values = grouped.get(record.characterId) || [];
    values.push(record);
    grouped.set(record.characterId, values);
  }
  return grouped;
}
function authoredEquipmentKey(runtimeKey) {
  const byKey = {
    hairAccessory: "hair_accessory",
    overShirt: "over_shirt",
    rightWrist: "right_wrist",
    leftWrist: "left_wrist",
    rightFingers: "right_fingers",
    leftFingers: "left_fingers",
    beltAccessory: "belt_accessory",
    otherAccessory: "other_accessory",
    leftHand: "left_hand",
    rightHand: "right_hand"
  };
  return byKey[runtimeKey] || runtimeKey;
}
function compatibilityCharacter(characterId, recordsByStore, authoredCharacter = null) {
  const definition = (recordsByStore.saveCharacterDefinitions || []).find(record => record.characterId === characterId);
  if (!definition) return null;
  const one = storeName => (recordsByStore[storeName] || []).find(record => record.characterId === characterId) || {};
  const appearance = one("characterAppearance");
  const settings = one("characterSettings");
  const durable = one("characterDurableState");
  const relationships = one("characterRelationshipStats");
  const scene = one("characterSceneState");
  const items = new Map((recordsByStore.items || []).filter(record => record.characterId === characterId).map(record => [record.itemId, record]));
  const itemDescription = itemId => itemId == null ? null : optionalText(items.get(itemId)?.description || items.get(itemId)?.name) || null;
  // Runtime state exposes authored inventory fields only; normalized item
  // records keep storage-only keys such as itemId inside the persistence layer.
  const compatibilityInventoryItem = item => {
    const description = optionalText(item.description || item.name);
    if (!description) return null;
    if (item.type === "clothing" && RuntimeEquipmentSlots.includes(item.slot) && !["leftHand", "rightHand"].includes(item.slot)) {
      return {
        item: description,
        clothing_slot: authoredEquipmentKey(item.slot)
      };
    }
    return description;
  };
  const outfitRecords = (recordsByStore.characterOutfits || []).filter(record => record.characterId === characterId);
  const equipment = one("equippedItems");
  const presentation = definition.gender === "male" ? "male" : "non_male";
  const profileImages = (recordsByStore.characterProfileImages || []).filter(record => record.characterId === characterId).map(record => ({
    id: record.imageId,
    owner_name: definition.name,
    male: record.presentation === "male",
    favorite: record.favorite === true,
    at: record.createdAt || "",
    model: record.model || "",
    seed: record.seed ?? null,
    prompt: record.prompt || "",
    negativePrompt: record.negativePrompt || "",
    hosted_url: record.url || "",
    html: record.url ? `<img loading="lazy" decoding="async" src="${String(record.url).replaceAll('"', '&quot;')}" alt="Generated image">` : "",
    pending: false,
    error: "",
    profile: true
  }));
  const selectedProfileImageId = (recordsByStore.characterProfileImageSelections || []).find(record => record.characterId === characterId && record.presentation === presentation)?.imageId || "";
  const facts = (recordsByStore.characterFacts || []).filter(record => record.characterId === characterId).sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0)).map(record => record.text);
  const stats = Object.fromEntries((recordsByStore.characterStats || []).filter(record => record.characterId === characterId).map(record => [record.statId, record.value]));
  const outfits = outfitRecords.map(record => {
    const clothing = {};
    for (const slot of RuntimeEquipmentSlots) {
      if (["leftHand", "rightHand"].includes(slot)) continue;
      clothing[authoredEquipmentKey(slot)] = itemDescription(record[slot]);
    }
    return {
      id: record.outfitId,
      name: record.name,
      formality: record.formality,
      revealing: record.revealing,
      origin: record.origin || "",
      memory: record.memory || "",
      source_shop_id: record.sourceShopId || "",
      source_outfit_id: record.sourceOutfitId || "",
      image_prompt: record.imagePrompt || "",
      image_id: record.imageId || "",
      contexts: cloneValue(record.contexts || []),
      clothing,
      held_items: {
        left_hand: itemDescription(record.leftHand),
        right_hand: itemDescription(record.rightHand)
      }
    };
  });
  const clothing = {};
  for (const slot of RuntimeEquipmentSlots) {
    if (["leftHand", "rightHand"].includes(slot)) continue;
    clothing[authoredEquipmentKey(slot)] = itemDescription(equipment[slot]);
  }
  const selectedProfileImage = profileImages.find(image => image.id === selectedProfileImageId) || null;
  const profileSlot = (image, male) => ({
    url: image?.hosted_url || "",
    local_image_id: image?.id || "",
    source: image ? "shared" : "none",
    seed: image?.seed ?? null,
    prompt: image?.prompt || "",
    negative_prompt: image?.negativePrompt || "",
    note: "",
    male
  });
  const animal = definition.definitionType === "animal";
  if (animal) {
    return {
      definition_type: "animal",
      id: characterId,
      name: definition.name,
      can_die: definition.canDie === true,
      age: definition.age,
      gender: definition.gender,
      role: durable.role || "",
      species: definition.species,
      physical_description: definition.physicalDescription,
      personality_description: definition.personalityDescription || "",
      communication_style: definition.speechStyle || "",
      speech_style: definition.speechStyle || "",
      voice: settings.voice || "",
      profile_images: profileImages,
      profile_image_id: selectedProfileImageId,
      default_profile_image: profileSlot(selectedProfileImage, presentation === "male"),
      profile_image_presentations: Object.fromEntries(["male", "non_male"].map(key => {
        const selectionId = (recordsByStore.characterProfileImageSelections || []).find(record => record.characterId === characterId && record.presentation === key)?.imageId;
        const image = profileImages.find(entry => entry.id === selectionId);
        return [key, profileSlot(image, key === "male")];
      })),
      image_prompt_config: {
        seed_enabled: settings.imageSeedEnabled === true,
        seed: settings.imageSeed,
        profile_model_override: settings.profileModelOverride || ""
      },
      default_seed: settings.imageSeed,
      relationship_to_player: durable.relationshipToPlayer || "",
      starting_relationship_to_player: durable.relationshipToPlayer || "",
      trust: relationships.trust ?? 0,
      attraction: 0,
      affection: relationships.affection ?? 0,
      state_of_mind: scene.stateOfMind || "",
      physical_state: scene.physicalState || "",
      pose: scene.pose || "",
      known_facts: facts,
      stats
    };
  }
  return {
    version: 1,
    id: characterId,
    name: definition.name,
    can_die: definition.canDie === true,
    romanceable: authoredCharacter?.romanceable,
    age: definition.age,
    gender: definition.gender,
    role: durable.role || "",
    personality_description: definition.personalityDescription || "",
    speech_style: definition.speechStyle || "",
    boldness: definition.boldness,
    appearance: {
      species: appearance.species || "",
      height: appearance.height,
      body_description: appearance.bodyDescription,

      skin_color: appearance.skinColor || "",
      eye_color: appearance.eyeColor || "",
      hair_color: appearance.hairColor || "",
      hair_length: appearance.hairLength || "",
      hair_type: appearance.hairType || "",
      extra_description: appearance.extraDescription || "",
      extra_description_lower_body: appearance.extraDescriptionLowerBody || "",
      ...(appearance.maleOnlyExtraDescription ? {
        male_only_extra_description: appearance.maleOnlyExtraDescription
      } : {}),
      ...(appearance.nonMaleOnlyExtraDescription ? {
        non_male_only_extra_description: appearance.nonMaleOnlyExtraDescription
      } : {}),
      nonhuman_lower_body: appearance.nonhumanLowerBody === true
    },
    voice: settings.voice || "",
    profile_images: profileImages,
    profile_image_id: selectedProfileImageId,
    default_profile_image: profileSlot(selectedProfileImage, presentation === "male"),
    profile_image_presentations: Object.fromEntries(["male", "non_male"].map(key => {
      const selectionId = (recordsByStore.characterProfileImageSelections || []).find(record => record.characterId === characterId && record.presentation === key)?.imageId;
      const image = profileImages.find(entry => entry.id === selectionId);
      return [key, profileSlot(image, key === "male")];
    })),
    image_prompt_config: {
      seed_enabled: settings.imageSeedEnabled === true,
      seed: settings.imageSeed,
      profile_model_override: settings.profileModelOverride || ""
    },
    default_seed: settings.imageSeed,
    relationship_to_player: durable.relationshipToPlayer || "",
    starting_relationship_to_player: durable.relationshipToPlayer || "",
    trust: relationships.trust ?? 0,
    attraction: relationships.attraction ?? 0,
    affection: relationships.affection ?? 0,
    state_of_mind: scene.stateOfMind || "",
    physical_state: scene.physicalState || "",
    pose: scene.pose || "",
    active_outfit_id: durable.activeOutfitId || null,
    outfits,
    clothing,
    held_items: {
      left_hand: itemDescription(equipment.leftHand),
      right_hand: itemDescription(equipment.rightHand)
    },
    inventory: [...items.values()].filter(item => !Object.values(equipment).includes(item.itemId)).sort((left, right) => {
      const leftSequence = Number.isFinite(left.inventorySequence) ? left.inventorySequence : Number.MAX_SAFE_INTEGER;
      const rightSequence = Number.isFinite(right.inventorySequence) ? right.inventorySequence : Number.MAX_SAFE_INTEGER;
      return leftSequence - rightSequence || String(left.itemId).localeCompare(String(right.itemId));
    }).map(compatibilityInventoryItem).filter(Boolean),
    known_facts: facts,
    stats
  };
}
function setCompatibilityStoryValue(state, record) {
  const root = requiredText(record.root, "story value root");
  state[root] ||= {};
  const path = String(record.pathKey || "").split(".").filter(Boolean);
  if (!path.length) {
    state[root] = cloneValue(record.value);
    return;
  }
  let target = state[root];
  for (const key of path.slice(0, -1)) target = target[key] ||= {};
  target[path.at(-1)] = cloneValue(record.value);
}
function setCompatibilityStoryPath(state, root, pathKey, value) {
  state[root] ||= {};
  const path = String(pathKey || "").split(".").filter(Boolean);
  if (!path.length) {
    state[root] = value;
    return;
  }
  let target = state[root];
  for (const key of path.slice(0, -1)) target = target[key] ||= {};
  target[path.at(-1)] = value;
}
function compatibilityRuntimeState(definition, header, recordsByStore) {
  const state = cloneValue(definition.state || {});
  const characters = new Map();
  const authoredCharacters = characterDefinitionsInStory(definition.state || {}, definition.state?.player || {}).charactersById;
  const authoredCharactersByName = new Map([...authoredCharacters.values()].map(character => [optionalText(character?.name).toLowerCase(), character]));
  for (const record of recordsByStore.saveCharacterDefinitions || []) {
    const character = compatibilityCharacter(record.characterId, recordsByStore, authoredCharacters.get(record.characterId) || authoredCharactersByName.get(optionalText(record.name).toLowerCase()) || null);
    if (character) characters.set(record.characterId, character);
  }
  const player = characters.get(header.playerCharacterId);
  if (!player) throw new Error(`Save ${header.saveId} is missing player ${header.playerCharacterId}.`);
  state.player = player;
  state.players = undefined;
  const partyIds = new Set((recordsByStore.partyMembers || []).map(record => record.characterId));
  const runtimeCharacterNames = new Map([[header.playerCharacterId, player.name]]);
  state.characters = {};
  for (const characterId of partyIds) {
    const character = characters.get(characterId);
    if (character) {
      state.characters[character.name] = character;
      runtimeCharacterNames.set(characterId, character.name);
    }
  }
  state.npc_directory ||= {
    locations: {}
  };
  state.npc_directory.locations ||= {};
  for (const location of Object.values(state.npc_directory.locations)) if (location && typeof location === "object") location.characters = {};
  for (const shell of recordsByStore.npcShells || []) {
    const locationId = String(shell.locationId || "").trim();
    const characterId = String(shell.characterId || "").trim();
    if (!locationId || !characterId || partyIds.has(characterId)) continue;
    const fullCharacter = characters.get(characterId) || null;
    const name = fullCharacter?.name || shell.name || characterId;
    runtimeCharacterNames.set(characterId, name);
    const location = state.npc_directory.locations[locationId] ||= {
      label: locationId,
      characters: {}
    };
    location.characters ||= {};
    location.characters[name] = {
      name,
      gender: shell.gender || fullCharacter?.gender || "unspecified",
      age: shell.age ?? fullCharacter?.age ?? 25,
      role: shell.role || fullCharacter?.role || "",
      relationship: shell.relationshipToPlayer || fullCharacter?.relationship_to_player || "",
      relationship_to_player: shell.relationshipToPlayer || fullCharacter?.relationship_to_player || "",
      note: shell.note || "",
      personality_description: shell.personalityDescription || "",
      greeting: shell.greeting || "",
      current_appearance: shell.currentAppearance || "",
      can_die: shell.canDie === true,
      recruitable: shell.recruitable === true,
      ever_invited: shell.everInvited === true,
      future_character_id: shell.futureCharacterId || "",
      status: shell.status || "alive",
      death_note: shell.deathNote || "",
      killed_by: shell.killedBy || "",
      killed_by_player: shell.killedByPlayer === true,
      inspected: shell.inspected === true,
      player_known_name: shell.playerKnownName === true,
      player_facing_label: shell.playerFacingLabel || "",
      ...(fullCharacter ? {
        full_character: fullCharacter
      } : {})
    };
  }
  const sceneRuntime = recordsByStore.sceneRuntime?.[0] || {};
  const sceneIds = new Set((recordsByStore.sceneMembers || []).map(record => record.characterId).filter(characterId => runtimeCharacterNames.has(characterId)));
  const sceneParticipantIds = new Set([header.playerCharacterId, ...sceneIds]);
  state.scene ||= {};
  Object.assign(state.scene, {
    summary: sceneRuntime.summary || "",
    image_action: sceneRuntime.imageAction || "",
    party_members_present: [...sceneIds].filter(id => partyIds.has(id)).map(id => runtimeCharacterNames.get(id)),
    npcs_present: [...sceneIds].filter(id => !partyIds.has(id)).map(id => runtimeCharacterNames.get(id)),
    image_characters: (recordsByStore.sceneImageTargets || []).map(record => record.characterId).filter(characterId => characterId === header.playerCharacterId || sceneIds.has(characterId)).map(characterId => runtimeCharacterNames.get(characterId))
  });
  state.objectives = cloneValue(state.objectives || {});
  const objectiveControl = recordsByStore.objectiveControl?.[0] || {};
  const runtimeById = new Map((recordsByStore.objectiveRuntime || []).map(record => [record.objectiveId, record]));
  state.objectives.active_id = objectiveControl.activeMainObjectiveId || "";
  state.objectives.focus_id = objectiveControl.focusedSideObjectiveId || "";
  for (const objective of state.objectives.items || []) {
    const runtime = runtimeById.get(objective.id);
    if (!runtime) continue;
    if (runtime.status != null) objective.status = runtime.status;
    if (runtime.selectedOutputId != null) objective.selected_output_id = runtime.selectedOutputId;
    if (runtime.selectedOutputMessageId != null) objective.selected_outcome_message_id = runtime.selectedOutputMessageId;
  }
  for (const record of recordsByStore.storyValues || []) setCompatibilityStoryValue(state, record);
  const mapGroups = new Map();
  for (const record of recordsByStore.storyMapEntries || []) {
    const groupKey = `${record.root}\u001f${record.mapPathKey || ""}`;
    if (!mapGroups.has(groupKey)) mapGroups.set(groupKey, []);
    mapGroups.get(groupKey).push(record);
  }
  for (const [groupKey, records] of mapGroups) {
    const [root, pathKey] = groupKey.split("\u001f", 2);
    setCompatibilityStoryPath(state, root, pathKey, Object.fromEntries(records.map(record => [record.entryKey, cloneValue(record.value)])));
  }
  const listGroups = new Map();
  for (const record of recordsByStore.storyListItems || []) {
    const groupKey = `${record.root}\u001f${record.listPathKey || ""}`;
    if (!listGroups.has(groupKey)) listGroups.set(groupKey, []);
    listGroups.get(groupKey).push(record);
  }
  for (const [groupKey, records] of listGroups) {
    const [root, pathKey] = groupKey.split("\u001f", 2);
    setCompatibilityStoryPath(state, root, pathKey, records.sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0)).map(record => cloneValue(record.value)));
  }
  const objectiveExtras = isPlainObject(state.objective_runtime_extras) ? state.objective_runtime_extras : {};
  delete state.objective_runtime_extras;
  state.objectives.no_current = objectiveExtras.noCurrent === true;
  state.objectives.suggestions = cloneValue(objectiveExtras.suggestions || []);
  state.objectives.completion_message = optionalText(objectiveExtras.completionMessage);
  state.objectives.completed_main_message = optionalText(objectiveExtras.completedMainMessage);
  state.objectives.pending_completion_message = cloneValue(objectiveExtras.pendingCompletionMessage || null);
  state.objectives.exclusive_group_choices = Object.fromEntries((recordsByStore.objectiveExclusiveGroupChoices || []).map(record => [record.groupId, record.selectedObjectiveId]));
  state.objectives.progress_notes = {};
  for (const record of (recordsByStore.objectiveProgressNotes || []).sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))) (state.objectives.progress_notes[record.objectiveId] ||= []).push(record.text);
  const pendingRoute = recordsByStore.pendingObjectiveRouteChoices?.[0];
  if (pendingRoute) {
    const routeOptions = (recordsByStore.pendingObjectiveRouteOptions || []).filter(record => record.choiceId === pendingRoute.choiceId).map(record => record.objectiveId);
    state.objectives.pending_choice = {
      id: pendingRoute.choiceId,
      reason: pendingRoute.reason,
      completed_id: pendingRoute.completedObjectiveId,
      objective_ids: routeOptions
    };
  } else state.objectives.pending_choice = null;
  const rewardOptionsByChoiceId = new Map();
  for (const record of recordsByStore.pendingRewardChoiceOptions || []) {
    if (!rewardOptionsByChoiceId.has(record.choiceId)) rewardOptionsByChoiceId.set(record.choiceId, []);
    rewardOptionsByChoiceId.get(record.choiceId).push(record.characterId === header.playerCharacterId ? "Player" : characters.get(record.characterId)?.name || record.characterId);
  }
  state.objectives.pending_reward_choices = (recordsByStore.pendingRewardChoices || []).map(record => ({
    id: record.choiceId,
    objective_id: record.objectiveId,
    kind: record.kind,
    reward: cloneValue(record.reward),
    choices: rewardOptionsByChoiceId.get(record.choiceId) || []
  }));
  state.objectives.__normalizedExtras = cloneValue(objectiveExtras);
  const time = recordsByStore.gameTime?.[0];
  if (time) {
    state.time = {
      year: time.year,
      month: time.month,
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      elapsed_minutes: time.elapsedMinutes
    };
  }
  const currentLocation = recordsByStore.currentLocation?.[0]?.locationId;
  state.world_map ||= {};
  state.world_map.locations ||= {};
  for (const record of recordsByStore.runtimeLocationDefinitions || []) {
    state.world_map.locations[record.locationId] = {
      id: record.locationId,
      name: record.name,
      type: record.type,
      scale: record.scale,
      parent_id: record.parentId,
      x: record.x,
      y: record.y,
      summary: record.summary,
      detail: {},
      connections: [],
      discovered: false,
      travel_enabled: false
    };
  }
  for (const record of recordsByStore.locationRuntime || []) {
    const location = state.world_map.locations[record.locationId];
    if (!location) continue;
    if (record.discovered != null) location.discovered = record.discovered === true;
    if (record.travelEnabled != null) location.travel_enabled = record.travelEnabled === true;
  }
  const connectionOverridesByLocationId = new Map();
  for (const record of recordsByStore.locationConnections || []) {
    if (!connectionOverridesByLocationId.has(record.fromLocationId)) connectionOverridesByLocationId.set(record.fromLocationId, []);
    connectionOverridesByLocationId.get(record.fromLocationId).push(record);
  }
  for (const [locationId, overrides] of connectionOverridesByLocationId) {
    const location = state.world_map.locations[locationId];
    if (!location) continue;
    const presentById = new Map(overrides.map(record => [record.toLocationId, record.present === true]));
    const authored = (location.connections || []).map(entry => String(entry?.location_id || entry?.id || entry || "").trim()).filter(Boolean);
    location.connections = [...new Set([...authored, ...presentById.keys()])].filter(toLocationId => presentById.get(toLocationId) !== false);
  }
  for (const record of recordsByStore.worldValues || []) {
    if (!String(record.fieldId || "").startsWith("world_map.")) continue;
    state.world_map[String(record.fieldId).slice("world_map.".length)] = cloneValue(record.value);
  }
  state.future_cast ||= {
    enabled: true,
    items: {}
  };
  state.future_cast.items ||= {};
  for (const record of recordsByStore.futureCharacters || []) {
    const entry = state.future_cast.items[record.characterId];
    if (!entry) continue;
    if (record.status != null) entry.status = record.status;
    if (record.unlockedBy != null) entry.unlocked_by = record.unlockedBy;
    if (record.lastTriggeredReason != null) entry.last_triggered_reason = record.lastTriggeredReason;
    if (record.locationId != null) entry.npc_location_id = record.locationId;
  }
  state.story_memory = {
    world_notes: [],
    unresolved_threads: [],
    relationship_notes: [],
    rules_and_constraints: [],
    ai_private_notes: []
  };
  for (const record of (recordsByStore.storyMemoryNotes || []).sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))) (state.story_memory[record.category] ||= []).push(record.text);
  state.recent_changes = (recordsByStore.recentChanges || []).sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0)).map(record => record.text);
  const removedStoryRuleIds = new Set((recordsByStore.storyRuleRemovals || []).map(record => record.ruleId));
  state.story_rules = (state.story_rules || []).filter(rule => !removedStoryRuleIds.has(storyRuleStableKey(rule)));
  for (const record of recordsByStore.storyRuleAdds || []) {
    let rule = record.text;
    try {
      rule = JSON.parse(record.text);
    } catch {
      //Plain text rules remain strings.
    }
    state.story_rules.push(rule);
  }
  state.timed_events ||= {};
  const appliedStagesByEventId = new Map();
  for (const record of recordsByStore.timedEventAppliedStages || []) {
    if (!appliedStagesByEventId.has(record.timedEventId)) appliedStagesByEventId.set(record.timedEventId, []);
    appliedStagesByEventId.get(record.timedEventId).push(record.stageId);
  }
  for (const record of recordsByStore.timedEventRuntime || []) {
    const event = state.timed_events[record.timedEventId] ||= {
      id: record.timedEventId
    };
    event.status = record.status;
    event.start_elapsed_minutes = record.startElapsedMinutes;
    event.applied_stage_ids = appliedStagesByEventId.get(record.timedEventId) || [];
  }
  state.story_shops ||= {};
  const shopItemsByShopId = new Map();
  for (const record of recordsByStore.shopItemRuntime || []) {
    if (!shopItemsByShopId.has(record.shopId)) shopItemsByShopId.set(record.shopId, []);
    shopItemsByShopId.get(record.shopId).push(record);
  }
  for (const record of recordsByStore.shopRuntime || []) {
    const shop = state.story_shops[record.shopId];
    if (!shop) continue;
    shop.unlocked = record.unlocked === true;
    const runtimeItems = new Map((shopItemsByShopId.get(record.shopId) || []).map(item => [item.itemId, item]));
    for (const item of shop.items || []) {
      const itemId = String(item.id || item.character_id || "").trim();
      const runtimeItem = runtimeItems.get(itemId);
      if (!runtimeItem) continue;
      if (runtimeItem.quantity != null) item.quantity = runtimeItem.quantity;
      if (runtimeItem.purchaseCount != null) item.purchase_count = runtimeItem.purchaseCount;
      if (runtimeItem.removed != null) item.removed = runtimeItem.removed === true;
      if (runtimeItem.locked != null) item.locked = runtimeItem.locked === true;
      if (runtimeItem.accepted != null) item.accepted = runtimeItem.accepted === true;
      if (runtimeItem.completed != null) item.completed = runtimeItem.completed === true;
    }
  }
  state.story_generated_npc_pool = Object.fromEntries((recordsByStore.generatedNpcPoolEntries || []).map(record => [record.poolEntryId, {
    npc_id: record.characterId
  }]));
  const jobDefinitionsById = new Map((recordsByStore.runtimeJobDefinitions || []).map(record => [record.jobId, record.definition]));
  const jobProgressById = new Map();
  for (const record of recordsByStore.generatedJobProgressValues || []) {
    if (!jobProgressById.has(record.jobId)) jobProgressById.set(record.jobId, {});
    jobProgressById.get(record.jobId)[record.pathKey] = cloneValue(record.value);
  }
  const completedStepsByJobId = new Map();
  for (const record of recordsByStore.generatedJobCompletedSteps || []) {
    if (!completedStepsByJobId.has(record.jobId)) completedStepsByJobId.set(record.jobId, []);
    completedStepsByJobId.get(record.jobId).push(record.stepId);
  }
  state.active_generated_jobs = {};
  for (const record of recordsByStore.generatedJobRuntime || []) {
    state.active_generated_jobs[record.jobId] = {
      ...cloneValue(jobDefinitionsById.get(record.jobId) || {
        id: record.jobId
      }),
      id: record.jobId,
      definition_id: record.jobId,
      status: record.status,
      current_step_id: record.currentStepId || "",
      progress: jobProgressById.get(record.jobId) || {},
      completed_step_ids: completedStepsByJobId.get(record.jobId) || []
    };
  }
  state.story_job_offers = {};
  for (const record of recordsByStore.storyJobOffers || []) {
    (state.story_job_offers[record.boardId] ||= []).push({
      offer_id: record.offerId,
      template_id: record.templateId,
      title: record.title,
      rank: record.rank,
      romanceable: record.romanceable === true,
      genres: cloneValue(record.genres || []),
      summary: record.summary,
      reward_coins: record.rewardCoins,
      reward_xp: record.rewardXp,
      filled_values: cloneValue(record.filledValues || {}),
      accepted: record.accepted === true
    });
  }
  state.world_map.current_location_id = currentLocation || state.world_map.current_location_id || "";
  if (!state.world_map.locations[state.world_map.focus_location_id]) state.world_map.focus_location_id = state.world_map.current_location_id;
  state.location ||= {};
  state.location.npc_location_id = currentLocation || state.location.npc_location_id || "";
  state.meta ||= {};
  state.meta.save_id = String(header.saveId);
  state.meta.story_guidance = header.storyGuidance || state.meta.story_guidance || "";
  state.meta.setup_complete = true;
  state.meta.selected_player_name = player.name || "";
  state.meta.selected_player_gender = player.gender || "";
  return state;
}
function compatibilityObjectiveRuntime(recordsByStore, objectiveExtras = {}) {
  const control = recordsByStore.objectiveControl?.[0] || {};
  const runtime = {
    activeMainObjectiveId: control.activeMainObjectiveId || "",
    focusedSideObjectiveId: control.focusedSideObjectiveId || "",
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
  for (const record of recordsByStore.objectiveRuntime || []) {
    if (record.status != null) runtime.statusById[record.objectiveId] = record.status;
    if (record.selectedOutputId != null) runtime.selectedOutputById[record.objectiveId] = record.selectedOutputId;
    if (record.selectedOutputMessageId != null) runtime.selectedOutcomeMessageById[record.objectiveId] = record.selectedOutputMessageId;
    if (record.activationAiCheckAttempted != null) runtime.activationAiCheckAttemptedById[record.objectiveId] = record.activationAiCheckAttempted;
    if (record.activationNumber != null) runtime.activationNumberById[record.objectiveId] = record.activationNumber;
  }
  for (const record of recordsByStore.objectiveProgressNotes || []) (runtime.progressNotesById[record.objectiveId] ||= []).push(record.text ?? record.value);
  for (const record of recordsByStore.objectiveExclusiveGroupChoices || []) runtime.exclusiveGroupChoices[record.groupId] = record.selectedObjectiveId;
  const pendingRoute = recordsByStore.pendingObjectiveRouteChoices?.[0];
  if (pendingRoute) {
    runtime.pendingChoice = {
      id: pendingRoute.choiceId,
      reason: pendingRoute.reason,
      completed_id: pendingRoute.completedObjectiveId,
      objective_ids: (recordsByStore.pendingObjectiveRouteOptions || []).filter(record => record.choiceId === pendingRoute.choiceId).map(record => record.objectiveId)
    };
  }
  const rewardOptionsByChoiceId = new Map();
  for (const record of recordsByStore.pendingRewardChoiceOptions || []) {
    if (!rewardOptionsByChoiceId.has(record.choiceId)) rewardOptionsByChoiceId.set(record.choiceId, []);
    rewardOptionsByChoiceId.get(record.choiceId).push(record.characterId);
  }
  runtime.pendingRewardChoices = (recordsByStore.pendingRewardChoices || []).map(record => ({
    id: record.choiceId,
    objective_id: record.objectiveId,
    kind: record.kind,
    reward: cloneValue(record.reward),
    choices: rewardOptionsByChoiceId.get(record.choiceId) || []
  }));
  runtime.noCurrent = objectiveExtras.noCurrent === true;
  runtime.selectedOutcomeById = cloneValue(objectiveExtras.selectedOutcomeById || {});
  runtime.selectedChoiceById = cloneValue(objectiveExtras.selectedChoiceById || {});
  runtime.selectedChoiceTitleById = cloneValue(objectiveExtras.selectedChoiceTitleById || {});
  runtime.suggestions = cloneValue(objectiveExtras.suggestions || []);
  runtime.completionMessage = optionalText(objectiveExtras.completionMessage);
  runtime.completedMainMessage = optionalText(objectiveExtras.completedMainMessage);
  runtime.pendingCompletionMessage = cloneValue(objectiveExtras.pendingCompletionMessage || null);
  return runtime;
}
async function reconstructRuntimeSave(message) {
  const path = "story_reconstruct_runtime_save_command";
  validateExactWorkerCommand(message, ["type", "requestId", "saveId"], [], path);
  if (message.type !== "story.reconstruct-runtime-save") throw new Error(`${path}.type must be exactly "story.reconstruct-runtime-save".`);
  if (!Number.isSafeInteger(message.saveId) || message.saveId < 1) throw new Error(`${path}.saveId must be a positive safe integer.`);
  const saveId = message.saveId;
  const database = await openRuntimeDatabase();
  const headerTransaction = database.transaction("saveHeaders", "readonly");
  const header = await indexedDbRequest(headerTransaction.objectStore("saveHeaders").get(saveId));
  if (!header) throw new Error(`Save ${saveId} does not exist.`);
  const definitionTransaction = database.transaction(["storyDefinitions", "compiledStoryIndexes"], "readonly");
  const [definition, compiled] = await Promise.all([indexedDbRequest(definitionTransaction.objectStore("storyDefinitions").get([header.storyId, header.revisionId])), indexedDbRequest(definitionTransaction.objectStore("compiledStoryIndexes").get([header.storyId, header.revisionId]))]);
  if (!definition) throw new Error(`Save ${saveId} has no matching immutable story definition.`);
  if (!compiled) throw new Error(`Save ${saveId} has no matching compiled story indexes.`);
  const recordsByStore = {};
  const storeNames = [...database.objectStoreNames].filter(storeName => {
    if (storeName === "messages") return false;
    if (["storyDefinitions", "compiledStoryIndexes", "storyLibraryEntries", "authoredCharacterDefinitions", "characterLibraryEntries"].includes(storeName)) return false;
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    return storeName === "saveHeaders" || store.indexNames.contains("bySave");
  });
  for (const storeName of storeNames) {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const records = storeName === "saveHeaders" ? [header] : await indexedDbRequest(store.index("bySave").getAll(IDBKeyRange.only(saveId)));
    recordsByStore[storeName] = records;
  }
  const savedCharacterIds = (recordsByStore.saveCharacterDefinitions || []).map(record => record.characterId).filter(Boolean);
  recordsByStore.characterProfileImages = [];
  recordsByStore.characterProfileImageSelections = [];
  if (savedCharacterIds.length) {
    const imageTransaction = database.transaction(["characterProfileImages", "characterProfileImageSelections"], "readonly");
    const imageStore = imageTransaction.objectStore("characterProfileImages");
    const selectionStore = imageTransaction.objectStore("characterProfileImageSelections");
    const imageGroupsPromise = Promise.all(savedCharacterIds.map(characterId => indexedDbRequest(imageStore.index("byCharacter").getAll(IDBKeyRange.only(characterId)))));
    const selectionsPromise = Promise.all(savedCharacterIds.flatMap(characterId => ["male", "non_male"].map(presentation => indexedDbRequest(selectionStore.get([characterId, presentation])))));
    const [imageGroups, selections] = await Promise.all([imageGroupsPromise, selectionsPromise]);
    recordsByStore.characterProfileImages = imageGroups.flat();
    recordsByStore.characterProfileImageSelections = selections.filter(Boolean);
  }
  const runtimeState = compatibilityRuntimeState(definition, header, recordsByStore);
  const objectiveItems = runtimeState.objectives?.items || [];
  const compatibilityDefinition = {
    revisionId: definition.revisionId,
    storyId: definition.storyId,
    contentHash: definition.contentHash,
    metadata: cloneValue(runtimeState.meta?.story_source || {}),
    objectivesById: Object.fromEntries(objectiveItems.map(objective => [objective.id, cloneValue(objective)])),
    objectiveOrder: [...(compiled.objectiveOrder || objectiveItems.map(objective => objective.id))],
    objectiveDependentsById: cloneValue(compiled.outgoingObjectiveIdsByObjectiveId || {}),
    objectiveIdsByExclusiveGroup: {},
    characterDefinitionsById: Object.fromEntries((recordsByStore.saveCharacterDefinitions || []).map(record => [record.characterId, compatibilityCharacter(record.characterId, recordsByStore)])),
    locationDefinitionsById: cloneValue(runtimeState.world_map?.locations || {}),
    futureCastDefinitionsById: cloneValue(runtimeState.future_cast?.items || {}),
    futureCastEnabledDefault: runtimeState.future_cast?.enabled !== false,
    timedEventDefinitionsById: cloneValue(definition.state?.timed_events || {}),
    rewardDefinitionsById: cloneValue(definition.state?.reward_bundles || {}),
    rewardTemplatesById: cloneValue(definition.state?.reward_templates || {}),
    characterShopCostTemplatesById: cloneValue(definition.state?.character_shop_cost_templates || {}),
    shopDefinitionsById: cloneValue(definition.state?.story_shops || {}),
    storyRules: cloneValue(definition.state?.story_rules || []),
    initialRuntimeTemplate: null
  };
  const imageTargetsById = new Map();
  for (const target of recordsByStore.storyImageTargets || []) {
    if (!imageTargetsById.has(target.imageId)) imageTargetsById.set(target.imageId, []);
    imageTargetsById.get(target.imageId).push(target.characterId);
  }
  const images = (recordsByStore.storyImages || []).map(image => ({
    ...cloneValue(image),
    id: image.imageId,
    pending: image.status !== "ready",
    targets: imageTargetsById.get(image.imageId) || [],
    hosted_url: image.url || "",
    html: image.url ? `<img src="${String(image.url).replaceAll('"', '&quot;')}" alt="${String(image.title || "Story image").replaceAll('"', '&quot;')}">` : ""
  }));
  const snapshots = (recordsByStore.snapshots || []).map(snapshot => ({
    id: snapshot.snapshotId,
    createdAt: snapshot.createdAt,
    reason: snapshot.reason,
    messageBoundaryId: snapshot.messageBoundaryId,
    ...(snapshot.type ? {
      type: snapshot.type
    } : {}),
    ...(snapshot.startMessageId ? {
      startMessageId: snapshot.startMessageId
    } : {}),
    ...(snapshot.objectiveId ? {
      objectiveId: snapshot.objectiveId
    } : {}),
    ...(snapshot.parentObjectiveId ? {
      parentObjectiveId: snapshot.parentObjectiveId
    } : {}),
    modifiedMessagesBefore: {},
    deletedMessagesBefore: [],
    reverseRuntimeChanges: [],
    queueState: [],
    runtimeFlags: {
      pendingNpcInvite: null,
      pendingObjectiveChoiceReply: null,
      pendingRegenerateMessage: null,
      currentReplyDirective: "",
      currentReplyMode: "",
      activeQueueSource: "",
      autoPlayerTurnGenerating: false
    }
  }));
  const objectiveExtras = runtimeState.objectives?.__normalizedExtras || {};
  if (runtimeState.objectives) delete runtimeState.objectives.__normalizedExtras;
  return {
    header,
    definition: compatibilityDefinition,
    state: runtimeState,
    objectiveRuntime: compatibilityObjectiveRuntime(recordsByStore, objectiveExtras),
    rewardRuntime: {
      appliedInvocationIds: Object.fromEntries((recordsByStore.rewardInvocations || []).map(record => [record.invocationId, {
        appliedAt: record.appliedAt,
        sourceType: record.sourceType,
        sourceId: record.sourceId
      }]))
    },
    runtimeDefinitions: {
      jobsById: Object.fromEntries((recordsByStore.runtimeJobDefinitions || []).map(record => [record.jobId, cloneValue(record.definition)])),
      charactersById: {},
      locationsById: Object.fromEntries((recordsByStore.runtimeLocationDefinitions || []).map(record => [record.locationId, {
        id: record.locationId,
        name: record.name,
        type: record.type,
        scale: record.scale,
        parent_id: record.parentId,
        x: record.x,
        y: record.y,
        summary: record.summary,
        detail: {}
      }]))
    },
    messages: (recordsByStore.messages || []).sort((left, right) => left.sequence - right.sequence),
    images,
    snapshots,
    recordsByStore
  };
}

//#endregion Runtime Compatibility Reconstruction

//#endregion New Game Materialization

//#region Profiles And Settings

function assertProfileStorageRecord(profile) {
  if (!isPlainObject(profile)) throw new Error("Profile storage record must be an object.");
  const fields = ["id", "name", "settings", "story_generation_notice_seen", "updated_at"];
  for (const key of Object.keys(profile)) if (!fields.includes(key)) throw new Error(`Profile storage record has unknown field ${key}.`);
  for (const key of fields) if (!Object.hasOwn(profile, key)) throw new Error(`Profile storage record is missing ${key}.`);
  requiredText(profile.id, "profile.id");
  requiredText(profile.name, "profile.name");
  requiredText(profile.updated_at, "profile.updated_at");
  if (typeof profile.story_generation_notice_seen !== "boolean") throw new Error("profile.story_generation_notice_seen must be a boolean.");
  if (!isPlainObject(profile.settings)) throw new Error("profile.settings must be an object.");
  return cloneValue(profile);
}
async function listSettings(message) {
  validateExactWorkerCommand(message, ["type", "requestId"], [], "settings_list_command");
  if (message.type !== "settings.list") throw new Error('settings_list_command.type must be exactly "settings.list".');
  const database = await openApplicationDatabase();
  const transaction = database.transaction("settings", "readonly");
  const records = await indexedDbRequest(transaction.objectStore("settings").getAll());
  return Object.fromEntries(records.map(record => [record.key, record.value]));
}
async function putSettings(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "values"], [], "settings_put_command");
  if (message.type !== "settings.put") throw new Error('settings_put_command.type must be exactly "settings.put".');
  if (!isPlainObject(message.values)) throw new Error("Settings values must be an object.");
  const database = await openApplicationDatabase();
  const transaction = database.transaction("settings", "readwrite", {
    durability: "strict"
  });
  const store = transaction.objectStore("settings");
  const updatedAt = Date.now();
  for (const [key, value] of Object.entries(message.values)) {
    if (!key.trim()) {
      transaction.abort();
      throw new Error("Setting key is required.");
    }
    store.put({
      key,
      value,
      updatedAt
    });
  }
  await indexedDbTransaction(transaction);
  return {
    saved: Object.keys(message.values).length
  };
}
async function listProfiles(message) {
  validateExactWorkerCommand(message, ["type", "requestId"], [], "profiles_list_command");
  if (message.type !== "profiles.list") throw new Error('profiles_list_command.type must be exactly "profiles.list".');
  const database = await openApplicationDatabase();
  const transaction = database.transaction("profiles", "readonly");
  const profiles = await indexedDbRequest(transaction.objectStore("profiles").getAll());
  profiles.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  return profiles;
}
function diagnosticScopeIds(scope, key) {
  if (scope == null) return null;
  if (!isPlainObject(scope)) throw new Error("diagnostic_export_command.scope must be an object or null.");
  if (!Object.hasOwn(scope, key)) return null;
  if (!Array.isArray(scope[key])) throw new Error(`diagnostic_export_command.scope.${key} must be an array.`);
  return new Set(scope[key].map(value => String(value || "").trim()).filter(Boolean));
}
function diagnosticSafeValue(value) {
  if (Array.isArray(value)) return value.map(diagnosticSafeValue);
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (/token|secret|password|authorization|credential|access[_-]?key|refresh/i.test(key)) continue;
    result[key] = diagnosticSafeValue(nested);
  }
  return result;
}
async function diagnosticSettingsAndProfiles(profileIds) {
  const database = await openApplicationDatabase();
  const transaction = database.transaction(["settings"], "readonly");
  const settingsStore = transaction.objectStore("settings");
  const settingsRequest = indexedDbRequest(settingsStore.get(DIAGNOSTIC_SETTINGS_KEY));
  const creatorRequest = indexedDbRequest(settingsStore.get(DIAGNOSTIC_CREATOR_IDENTITIES_KEY));
  const [settingsRecord, creatorRecord] = await Promise.all([settingsRequest, creatorRequest]);
  const safeStoredSettings = isPlainObject(settingsRecord?.value) ? settingsRecord.value : {};
  const settings = {};
  for (const key of DIAGNOSTIC_SAFE_SETTING_KEYS) {
    if (Object.hasOwn(safeStoredSettings, key)) settings[key] = diagnosticSafeValue(safeStoredSettings[key]);
  }
  return {
    settings,
    creatorIdentityRegistry: isPlainObject(creatorRecord?.value) ? diagnosticSafeValue(creatorRecord.value) : null
  };
}
async function diagnosticStoreCounts(database) {
  const storeNames = Array.from(database.objectStoreNames);
  const transaction = database.transaction(storeNames, "readonly");
  const counts = await Promise.all(storeNames.map(async storeName => [storeName, await indexedDbRequest(transaction.objectStore(storeName).count())]));
  return Object.fromEntries(counts);
}
function diagnosticLibraryRecordSummary(entry, kind) {
  const story = kind === "story";
  const idField = story ? "storyId" : "characterId";
  const summary = {
    [idField]: String(entry?.[idField] || ""),
    revisionId: String(entry?.revisionId || ""),
    [story ? "title" : "name"]: String(entry?.[story ? "title" : "name"] || ""),
    source: String(entry?.source || ""),
    creator: String(entry?.creator || ""),
    creatorId: String(entry?.creatorId || ""),
    creation_tool: String(entry?.creation_tool || "")
  };
  if (!story) {
    summary.fallbackName = String(entry?.fallbackName || "");
    summary.role = String(entry?.role || "");
  }
  for (const field of ["created_at", "updated_at"]) if (Object.hasOwn(entry || {}, field)) summary[field] = String(entry[field] || "");
  return summary;
}
async function diagnosticLibraryRecords(database, kind, scopeIds) {
  const storeName = kind === "story" ? "storyLibraryEntries" : "characterLibraryEntries";
  const transaction = database.transaction(storeName, "readonly");
  const entries = await indexedDbRequest(transaction.objectStore(storeName).getAll());
  const idField = kind === "story" ? "storyId" : "characterId";
  const scoped = scopeIds instanceof Set ? entries.filter(entry => scopeIds.has(String(entry?.[idField] || ""))) : entries;
  scoped.sort((left, right) => String(left?.[idField] || "").localeCompare(String(right?.[idField] || "")));
  return {
    count: scoped.length,
    totalCount: entries.length,
    scopeApplied: scopeIds instanceof Set,
    records: scoped.slice(0, DIAGNOSTIC_RECORD_LIMIT).map(entry => diagnosticLibraryRecordSummary(entry, kind)),
    truncated: scoped.length > DIAGNOSTIC_RECORD_LIMIT
  };
}
async function diagnosticExport(message) {
  validateExactWorkerCommand(message, ["type", "requestId"], ["scope", "build", "storageFailures"], "diagnostic_export_command");
  if (message.type !== "diagnostic.export") throw new Error('diagnostic_export_command.type must be exactly "diagnostic.export".');
  if (message.build != null && !isPlainObject(message.build)) throw new Error("diagnostic_export_command.build must be an object or null.");
  if (message.storageFailures != null && !Array.isArray(message.storageFailures)) throw new Error("diagnostic_export_command.storageFailures must be an array.");
  const scope = message.scope || null;
  const profileIds = diagnosticScopeIds(scope, "profileIds");
  const storyIds = diagnosticScopeIds(scope, "storyIds");
  const characterIds = diagnosticScopeIds(scope, "characterIds");
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Reading current durable settings",
    completed: 0,
    total: 3
  });
  const [applicationDatabase, runtimeDatabase] = await Promise.all([openApplicationDatabase(), openRuntimeDatabase()]);
  const [settingsAndProfiles, storyRecords, characterRecords] = await Promise.all([diagnosticSettingsAndProfiles(profileIds), diagnosticLibraryRecords(runtimeDatabase, "story", storyIds), diagnosticLibraryRecords(runtimeDatabase, "character", characterIds)]);
  const [applicationStoreCounts, runtimeStoreCounts] = await Promise.all([diagnosticStoreCounts(applicationDatabase), diagnosticStoreCounts(runtimeDatabase)]);
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Serializing bounded diagnostic snapshot",
    completed: 2,
    total: 3
  });
  const exportPayload = {
    app: "EmberAdventures",
    exportType: "diagnostic-snapshot",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: settingsAndProfiles.settings,
    creatorIdentityRegistry: settingsAndProfiles.creatorIdentityRegistry,
    records: {
      stories: storyRecords,
      characters: characterRecords
    },
    storeCounts: {
      application: applicationStoreCounts,
      runtime: runtimeStoreCounts
    },
    storageFailures: Array.isArray(message.storageFailures) ? message.storageFailures.slice(0, 50) : [],
    diagnosticExport: {
      durableWorkerExport: true,
      source: "current-library-worker",
      fullBackup: false,
      restoreSupported: false,
      runtimeSnapshotIncluded: false,
      storyDefinitionsIncluded: false,
      characterDefinitionsIncluded: false,
      imageBytesIncluded: false,
      networkAccessed: false,
      writesPerformed: false,
      boundedRecordLimit: DIAGNOSTIC_RECORD_LIMIT,
      requestedScope: scope,
      build: message.build || null
    }
  };
  const blob = new Blob([JSON.stringify(exportPayload)], {
    type: "application/json"
  });
  postMessage({
    type: "library.progress",
    requestId: message.requestId,
    phase: "Diagnostic snapshot ready",
    completed: 3,
    total: 3
  });
  return {
    blob,
    bytes: blob.size,
    storyCount: storyRecords.count,
    characterCount: characterRecords.count
  };
}
async function putProfile(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "profile"], [], "profiles_put_command");
  if (message.type !== "profiles.put") throw new Error('profiles_put_command.type must be exactly "profiles.put".');
  const profile = assertProfileStorageRecord(message.profile);
  const database = await openApplicationDatabase();
  const transaction = database.transaction("profiles", "readwrite", {
    durability: "strict"
  });
  transaction.objectStore("profiles").put(profile);
  await indexedDbTransaction(transaction);
  return profile;
}
async function replaceProfiles(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "profiles"], [], "profiles_replace_command");
  if (message.type !== "profiles.replace") throw new Error('profiles_replace_command.type must be exactly "profiles.replace".');
  if (!Array.isArray(message.profiles)) throw new Error("Profiles must be an array.");
  const profiles = message.profiles.map(assertProfileStorageRecord);
  const database = await openApplicationDatabase();
  const transaction = database.transaction("profiles", "readwrite", {
    durability: "strict"
  });
  const store = transaction.objectStore("profiles");
  store.clear();
  for (const profile of profiles) store.put(profile);
  await indexedDbTransaction(transaction);
  return {
    saved: profiles.length
  };
}
async function deleteSettings(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "keys"], [], "settings_delete_command");
  if (message.type !== "settings.delete") throw new Error('settings_delete_command.type must be exactly "settings.delete".');
  if (!Array.isArray(message.keys) || message.keys.some(key => typeof key !== "string" || !key)) throw new Error("settings_delete_command.keys must be an array of non-empty text values.");
  const keys = message.keys;
  const database = await openApplicationDatabase();
  const transaction = database.transaction("settings", "readwrite", {
    durability: "strict"
  });
  const store = transaction.objectStore("settings");
  for (const key of keys) {
    const cleanKey = requiredText(key, "setting key");
    store.delete(cleanKey);
  }
  await indexedDbTransaction(transaction);
  return {
    deleted: keys.length
  };
}
async function deleteProfile(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "id"], [], "profiles_delete_command");
  if (message.type !== "profiles.delete") throw new Error('profiles_delete_command.type must be exactly "profiles.delete".');
  const database = await openApplicationDatabase();
  const transaction = database.transaction("profiles", "readwrite", {
    durability: "strict"
  });
  transaction.objectStore("profiles").delete(requiredText(message.id, "profile id"));
  await indexedDbTransaction(transaction);
  return {
    deleted: true
  };
}

//#endregion Profiles And Settings

//#region Public Library

function validateOptionalCommandText(message, field, path) {
  if (Object.hasOwn(message, field) && typeof message[field] !== "string") throw new Error(`${path}.${field} must be text.`);
}
function validateOptionalCommandBoolean(message, field, path) {
  if (Object.hasOwn(message, field) && typeof message[field] !== "boolean") throw new Error(`${path}.${field} must be true or false.`);
}
function validateOptionalCommandStringArray(message, field, path) {
  if (Object.hasOwn(message, field) && (!Array.isArray(message[field]) || message[field].some(value => typeof value !== "string"))) throw new Error(`${path}.${field} must be an array of text values.`);
}
function validateOptionalCommandNumber(message, field, path, {
  integer = false,
  minimum = null,
  maximum = null
} = {}) {
  if (!Object.hasOwn(message, field) || message[field] === null) return;
  const value = message[field];
  if (typeof value !== "number" || !Number.isFinite(value) || integer && !Number.isSafeInteger(value)) throw new Error(`${path}.${field} must be ${integer ? "a safe integer" : "a finite number"} or null.`);
  if (minimum !== null && value < minimum) throw new Error(`${path}.${field} must be at least ${minimum}.`);
  if (maximum !== null && value > maximum) throw new Error(`${path}.${field} must be at most ${maximum}.`);
}
function publicSearchBody(message) {
  const path = "public_search_command";
  validateExactWorkerCommand(message, ["type", "requestId", "kind"], ["query", "creator", "creation_tool", "genres", "sortMode", "cursor", "limit"], path);
  if (message.type !== "public.search") throw new Error(`${path}.type must be exactly "public.search".`);
  if (message.kind !== "story" && message.kind !== "character") throw new Error(`${path}.kind must be exactly "story" or "character".`);
  for (const field of ["query", "creator", "creation_tool", "sortMode"]) validateOptionalCommandText(message, field, path);
  for (const field of ["genres"]) validateOptionalCommandStringArray(message, field, path);
  validateOptionalCommandNumber(message, "limit", path, {
    integer: true,
    minimum: 1,
    maximum: 100
  });
  if (Object.hasOwn(message, "sortMode") && !["highest-rated", "newest", "most-rated"].includes(message.sortMode)) throw new Error(`${path}.sortMode is invalid.`);
  if (Object.hasOwn(message, "cursor") && message.cursor !== null) {
    if (!isPlainObject(message.cursor)) throw new Error(`${path}.cursor must be an object or null.`);
    const cursorFields = new Set(["value", "id"]);
    for (const field of Object.keys(message.cursor)) if (!cursorFields.has(field)) throw new Error(`${path}.cursor.${field} is not an approved field.`);
    for (const field of cursorFields) requiredText(message.cursor[field], `${path}.cursor.${field}`);
  }
  const limit = message.limit ?? 60;
  return {
    item_type: message.kind,
    search_text: optionalText(message.query),
    creator_text: optionalText(message.creator),
    creation_tool_text: optionalText(message.creation_tool),
    required_genres: message.genres || [],
    sort_mode: message.sortMode ?? "highest-rated",
    cursor_value: message.cursor?.value ?? null,
    cursor_id: message.cursor?.id ?? null,
    result_limit: limit + 1
  };
}
function publicSearchEntryFromRow(raw) {
  const row = validateSupabasePublicSearchRow(raw);
  return {
    publicId: row.id,
    kind: row.type === "character" ? "character" : "story",
    title: row.type === "story" ? row.title : row.name,
    name: row.type === "character" ? row.name : row.title,
    description: row.description || "",
    role: row.role || "",
    source: row.source === "" ? "Original" : row.source,
    creation_tool: row.creation_tool,
    creator: row.creator,
    genres: [...row.genres],
    gender: row.gender || "",
    payloadUrl: row.payload_url,
    revisionId: row.current_version_id,
    visibility: "public",
    ratingAverage: row.rating_average,
    ratingCount: row.rating_count,
    userRating: row.user_rating,
    imageUrl: row.image_url || row.male_image_url || row.non_male_image_url || ""
  };
}
function publicOwnedEntryFromRows(row, version) {
  validateSupabasePublicItemRow(row);
  validateSupabasePublicVersionRow(version);
  return {
    publicId: requiredText(row.id, "public_owned_item.id"),
    kind: row.type === "character" ? "character" : "story",
    title: row.type === "story" ? requiredText(row.title, "public_owned_item.title") : requiredText(row.name, "public_owned_item.name"),
    name: row.type === "character" ? requiredText(row.name, "public_owned_item.name") : requiredText(row.title, "public_owned_item.title"),
    description: optionalText(row.description, "public_owned_item.description"),
    role: optionalText(row.role, "public_owned_item.role"),
    source: requiredString(row.source, "public_owned_item.source") === "" ? "Original" : row.source,
    creation_tool: requiredText(row.creation_tool, "public_owned_item.creation_tool"),
    creator: requiredText(row.creator, "public_owned_item.creator"),
    genres: stringList(row.genres, "public_owned_item.genres"),
    gender: optionalText(row.gender, "public_owned_item.gender"),
    payloadUrl: requiredText(version.payload_url, "public_owned_version.payload_url"),
    revisionId: requiredText(row.current_version_id, "public_owned_item.current_version_id"),
    versionNumber: version.version_number,
    visibility: requiredText(row.visibility, "public_owned_item.visibility"),
    ratingAverage: row.rating_average,
    ratingCount: row.rating_count,
    userRating: null,
    imageUrl: optionalText(version.image_url, "public_owned_version.image_url") || optionalText(row.male_image_url, "public_owned_item.male_image_url") || optionalText(row.non_male_image_url, "public_owned_item.non_male_image_url")
  };
}
async function publicSearch(message) {
  const body = publicSearchBody(message);
  const response = await fetch(`${SupabaseUrl}/rest/v1/rpc/search_public_library_items`, {
    method: "POST",
    headers: {
      apikey: SupabaseKey,
      Authorization: `Bearer ${SupabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Public library search failed (${response.status}): ${await response.text()}`);
  const rows = await response.json();
  const limit = body.result_limit - 1;
  const accepted = rows.slice(0, limit);
  const last = accepted.at(-1);
  return {
    entries: accepted.map(row => publicSearchEntryFromRow(row)),
    hasNext: rows.length > limit,
    cursor: last ? {
      value: last.ordering_value || null,
      id: last.id
    } : null
  };
}
async function publicOwned(message) {
  const path = "public_owned_command";
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "token", "userId"], ["limit", "offset", "query", "dryRun", "items", "versions"], path);
  if (message.type !== "public.owned") throw new Error(`${path}.type must be exactly "public.owned".`);
  if (message.kind !== "story" && message.kind !== "character") throw new Error(`${path}.kind must be exactly "story" or "character".`);
  validateOptionalCommandNumber(message, "limit", path, {
    integer: true,
    minimum: 1,
    maximum: 100
  });
  validateOptionalCommandNumber(message, "offset", path, {
    integer: true,
    minimum: 0
  });
  validateOptionalCommandText(message, "query", path);
  validateOptionalCommandBoolean(message, "dryRun", path);
  if (message.dryRun === true) {
    if (!Array.isArray(message.items) || !Array.isArray(message.versions)) throw new Error(`${path}.items and ${path}.versions are required arrays during a dry run.`);
  } else if (Object.hasOwn(message, "items") || Object.hasOwn(message, "versions")) throw new Error(`${path}.items and ${path}.versions are only allowed during a dry run.`);
  const token = requiredText(message.token, "Supabase access token");
  const userId = requiredText(message.userId, "Supabase user id");
  const kind = message.kind;
  const limit = message.limit ?? 60;
  const offset = message.offset ?? 0;
  let items = message.items || null;
  let versions = message.versions || null;
  if (message.dryRun !== true) {
    const selectedFields = SUPABASE_PUBLIC_ITEM_ROW_FIELDS.join(",");
    items = await supabaseRequest(`/rest/v1/library_items?select=${selectedFields}&owner_user_id=eq.${encodeURIComponent(userId)}&type=eq.${kind}&order=updated_at.desc&limit=${limit + 1}&offset=${offset}`, {
      token
    });
    const versionIds = items.map(item => optionalText(item.current_version_id)).filter(Boolean);
    versions = versionIds.length ? await supabaseRequest(`/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&id=in.(${versionIds.map(id => `"${id.replaceAll('"', '\\"')}"`).join(",")})`, {
      token
    }) : [];
  }
  const versionById = new Map((versions || []).map(version => [version.id, version]));
  const query = optionalText(message.query).toLowerCase();
  const filtered = (items || []).filter(item => !query || [item.title, item.name, item.creator, item.source].some(value => optionalText(value).toLowerCase().includes(query)));
  const accepted = filtered.slice(0, limit);
  return {
    entries: accepted.map(item => publicOwnedEntryFromRows(item, versionById.get(item.current_version_id))),
    hasNext: filtered.length > limit,
    offset: offset + accepted.length
  };
}
async function setPublicVisibility(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "token", "userId", "itemId", "visibility"], ["dryRun"], "public_visibility_set_command");
  if (message.type !== "public.visibility.set") throw new Error('public_visibility_set_command.type must be exactly "public.visibility.set".');
  if (message.visibility !== "public" && message.visibility !== "hidden") throw new Error('public_visibility_set_command.visibility must be exactly "public" or "hidden".');
  validateOptionalCommandBoolean(message, "dryRun", "public_visibility_set_command");
  const token = requiredText(message.token, "Supabase access token");
  const userId = requiredText(message.userId, "Supabase user id");
  const itemId = requiredText(message.itemId, "public item id");
  const visibility = message.visibility;
  const body = {
    visibility
  };
  if (message.dryRun === true) return {
    itemId,
    userId,
    ...body
  };
  const rows = await supabaseRequest(`/rest/v1/library_items?id=eq.${encodeURIComponent(itemId)}&owner_user_id=eq.${encodeURIComponent(userId)}`, {
    token,
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body
  });
  if (!rows?.length) throw new Error("The public item was not found or is not owned by this account.");
  return {
    itemId,
    visibility
  };
}
async function importPublicEntry(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "url"], [], "public_import_command");
  if (message.type !== "public.import" && message.type !== "library.import-url") throw new Error('public_import_command.type must be exactly "public.import" or "library.import-url".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('public_import_command.kind must be exactly "story" or "character".');
  const url = parseImportDownloadUrl(requiredText(message.url, "import URL"));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Public library download failed (${response.status}).`);
  const buffer = await response.arrayBuffer();
  return importBuffer({
    ...message,
    buffer
  }, false);
}
async function publicVersions(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "itemId"], [], "public_versions_command");
  if (message.type !== "public.versions") throw new Error('public_versions_command.type must be exactly "public.versions".');
  const itemId = requiredText(message.itemId, "public item id");
  const rows = await supabaseRequest(`/rest/v1/library_versions?select=${SUPABASE_PUBLIC_VERSION_ROW_FIELDS.join(",")}&item_id=eq.${encodeURIComponent(itemId)}&order=version_number.desc&limit=100`);
  return rows.map((row, index) => validateSupabasePublicVersionRow(row, `public_version_rows.${index}`));
}
async function setPublicRating(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "token", "itemId", "rating"], ["dryRun"], "public_rating_set_command");
  if (message.type !== "public.rating.set") throw new Error('public_rating_set_command.type must be exactly "public.rating.set".');
  validateOptionalCommandBoolean(message, "dryRun", "public_rating_set_command");
  const token = requiredText(message.token, "Supabase access token");
  const itemId = requiredText(message.itemId, "public item id");
  const rating = message.rating;
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) throw new Error("Public rating must be a whole number from 0 through 10.");
  if (message.dryRun === true) return {
    target_item_id: itemId,
    target_rating: rating
  };
  return await supabaseRequest("/rest/v1/rpc/set_library_rating", {
    token,
    method: "POST",
    body: {
      target_item_id: itemId,
      target_rating: rating
    }
  });
}
async function removePublicRating(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "token", "itemId"], ["dryRun"], "public_rating_remove_command");
  if (message.type !== "public.rating.remove") throw new Error('public_rating_remove_command.type must be exactly "public.rating.remove".');
  validateOptionalCommandBoolean(message, "dryRun", "public_rating_remove_command");
  const token = requiredText(message.token, "Supabase access token");
  const itemId = requiredText(message.itemId, "public item id");
  if (message.dryRun === true) return {
    target_item_id: itemId
  };
  return await supabaseRequest("/rest/v1/rpc/remove_library_rating", {
    token,
    method: "POST",
    body: {
      target_item_id: itemId
    }
  });
}
async function submitPublicReport(message) {
  const path = "public_report_submit_command";
  validateExactWorkerCommand(message, ["type", "requestId", "itemId", "kind", "title", "reasons", "details", "suggestedGenres"], ["token", "userId", "userEmail", "replyEmail", "contentUrl", "imageUrl", "dryRun"], path);
  if (message.type !== "public.report.submit") throw new Error(`${path}.type must be exactly "public.report.submit".`);
  if (message.kind !== "story" && message.kind !== "character") throw new Error(`${path}.kind must be exactly "story" or "character".`);
  for (const field of ["title", "details", "token", "userId", "userEmail", "replyEmail", "contentUrl", "imageUrl"]) validateOptionalCommandText(message, field, path);
  for (const field of ["reasons", "suggestedGenres"]) validateOptionalCommandStringArray(message, field, path);
  validateOptionalCommandBoolean(message, "dryRun", path);
  const reasons = message.reasons;
  const details = message.details;
  if (!reasons.length) throw new Error("Select at least one report reason.");
  if (reasons.includes("other") && !details) throw new Error("A description is required when Other is selected.");
  if (details.length > 1000) throw new Error("Public report description cannot exceed 1000 characters.");
  const row = {
    item_id: requiredText(message.itemId, "public item id"),
    item_type: message.kind,
    item_title: message.title,
    reporter_id: message.userId ?? null,
    reporter_email: message.userEmail ?? null,
    reasons,
    details,
    suggested_genres: message.suggestedGenres,
    reply_email: message.replyEmail ?? null,
    content_url: message.contentUrl ?? null,
    image_url: message.imageUrl ?? null
  };
  if (message.dryRun === true) return row;
  await supabaseRequest("/rest/v1/library_reports", {
    token: optionalText(message.token),
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: row
  });
  return {
    submitted: true
  };
}
async function gzipJson(value) {
  const source = new Blob([JSON.stringify(value)], {
    type: "application/json"
  });
  if (typeof CompressionStream !== "function") throw new Error("Public payload preparation requires CompressionStream.");
  const compressed = await new Response(source.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  const digest = await crypto.subtle.digest("SHA-256", await compressed.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  return {
    blob: new Blob([compressed], {
      type: "application/gzip"
    }),
    sha256,
    size: compressed.size,
    rawSize: source.size
  };
}
function validateExactWorkerCommand(message, requiredFields, optionalFields, path) {
  if (!isPlainObject(message)) throw new Error(`${path} must be an object.`);
  const allowed = new Set([...requiredFields, ...optionalFields]);
  for (const field of Object.keys(message)) if (!allowed.has(field)) throw new Error(`${path}.${field} is not an approved field.`);
  for (const field of requiredFields) if (!Object.hasOwn(message, field)) throw new Error(`${path}.${field} is required.`);
  if (!Number.isSafeInteger(message.requestId) || message.requestId < 1) throw new Error(`${path}.requestId must be a positive safe integer.`);
  return message;
}
function validatePublicPackagePrepareCommand(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "kind", "id", "revisionId", "creator", "creatorId", "imageUrls"], [], "public_package_prepare_command");
  if (message.type !== "public.package.prepare") throw new Error('public_package_prepare_command.type must be exactly "public.package.prepare".');
  if (message.kind !== "story" && message.kind !== "character") throw new Error('public_package_prepare_command.kind must be exactly "story" or "character".');
  for (const field of ["id", "revisionId", "creator", "creatorId"]) requiredText(message[field], `public_package_prepare_command.${field}`);
  if (!isPlainObject(message.imageUrls)) throw new Error("public_package_prepare_command.imageUrls must be an object.");
  const imageFields = message.kind === "story" ? ["title"] : ["male", "non_male"];
  const allowedImageFields = new Set(imageFields);
  for (const field of Object.keys(message.imageUrls)) if (!allowedImageFields.has(field)) throw new Error(`public_package_prepare_command.imageUrls.${field} is not an approved field.`);
  for (const field of imageFields) requiredText(message.imageUrls[field], `public_package_prepare_command.imageUrls.${field}`);
  return message;
}
function validatePublicPackageMetadata(metadata) {
  if (!isPlainObject(metadata)) throw new Error("public_publish_command.metadata must be an object.");
  const commonFields = ["type", "definitionId", "creator", "creatorId", "source", "creation_tool", "genres", "imageUrl"];
  const storyFields = ["title", "description", "playerSelect", "playerOptionCount", "mainObjectiveCount", "sideObjectiveCount", "futureCharacterCount", "startingPartyMemberCount", "startingNpcCount"];
  const characterFields = ["name", "maleName", "nonMaleName", "maleImageUrl", "nonMaleImageUrl", "gender", "fallbackGender", "age", "species", "role"];
  if (metadata.type !== "story" && metadata.type !== "character") throw new Error('public_publish_command.metadata.type must be exactly "story" or "character".');
  const requiredFields = [...commonFields, ...(metadata.type === "story" ? storyFields : characterFields)];
  const allowed = new Set(requiredFields);
  for (const field of Object.keys(metadata)) if (!allowed.has(field)) throw new Error(`public_publish_command.metadata.${field} is not an approved field.`);
  for (const field of requiredFields) if (!Object.hasOwn(metadata, field)) throw new Error(`public_publish_command.metadata.${field} is required.`);
  for (const field of ["definitionId", "creator", "creatorId", "creation_tool", "imageUrl"]) requiredText(metadata[field], `public_publish_command.metadata.${field}`);
  if (metadata.source !== "Original") throw new Error('public_publish_command.metadata.source must be exactly "Original".');
  for (const field of ["genres"]) if (!Array.isArray(metadata[field]) || metadata[field].some(value => typeof value !== "string")) throw new Error(`public_publish_command.metadata.${field} must be an array of text values.`);
  if (metadata.type === "story") {
    for (const field of ["title", "description"]) requiredText(metadata[field], `public_publish_command.metadata.${field}`);
    if (typeof metadata.playerSelect !== "boolean") throw new Error("public_publish_command.metadata.playerSelect must be true or false.");
    for (const field of ["playerOptionCount", "mainObjectiveCount", "sideObjectiveCount", "futureCharacterCount", "startingPartyMemberCount", "startingNpcCount"]) if (!Number.isSafeInteger(metadata[field]) || metadata[field] < 0) throw new Error(`public_publish_command.metadata.${field} must be a nonnegative safe integer.`);
  } else {
    for (const field of ["name", "maleName", "nonMaleName", "maleImageUrl", "nonMaleImageUrl", "gender"]) requiredText(metadata[field], `public_publish_command.metadata.${field}`);
    for (const field of ["fallbackGender", "species", "role"]) if (metadata[field] !== null && typeof metadata[field] !== "string") throw new Error(`public_publish_command.metadata.${field} must be text or null.`);
    if (!Number.isSafeInteger(metadata.age) || metadata.age < 0) throw new Error("public_publish_command.metadata.age must be a nonnegative safe integer.");
  }
  return metadata;
}
function validatePublicPublishCommand(message) {
  validateExactWorkerCommand(message, ["type", "requestId", "token", "userId", "metadata", "payloadUrl"], ["dryRun", "policy", "existing", "ownedCount", "sha256", "payloadSize", "changeSummary"], "public_publish_command");
  if (message.type !== "public.publish") throw new Error('public_publish_command.type must be exactly "public.publish".');
  requiredText(message.token, "public_publish_command.token");
  requiredText(message.userId, "public_publish_command.userId");
  requiredText(message.payloadUrl, "public_publish_command.payloadUrl");
  validatePublicPackageMetadata(message.metadata);
  if (Object.hasOwn(message, "dryRun") && typeof message.dryRun !== "boolean") throw new Error("public_publish_command.dryRun must be true or false.");
  if (Object.hasOwn(message, "policy")) validateSupabasePublicUploaderPolicyRow(message.policy, "public_publish_command.policy");
  if (Object.hasOwn(message, "existing")) {
    if (!isPlainObject(message.existing)) throw new Error("public_publish_command.existing must be an object.");
    const fields = new Set(["id", "visibility", "hidden_reason"]);
    for (const field of Object.keys(message.existing)) if (!fields.has(field)) throw new Error(`public_publish_command.existing.${field} is not an approved field.`);
    for (const field of fields) if (!Object.hasOwn(message.existing, field)) throw new Error(`public_publish_command.existing.${field} is required.`);
    requiredText(message.existing.id, "public_publish_command.existing.id");
    requiredText(message.existing.visibility, "public_publish_command.existing.visibility");
    if (message.existing.hidden_reason !== null && typeof message.existing.hidden_reason !== "string") throw new Error("public_publish_command.existing.hidden_reason must be text or null.");
  }
  if (Object.hasOwn(message, "ownedCount") && (!Number.isSafeInteger(message.ownedCount) || message.ownedCount < 0)) throw new Error("public_publish_command.ownedCount must be a nonnegative safe integer.");
  if (message.dryRun !== true) {
    if (typeof message.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(message.sha256)) throw new Error("public_publish_command.sha256 must be a lowercase SHA-256 digest.");
    if (!Number.isSafeInteger(message.payloadSize) || message.payloadSize < 1) throw new Error("public_publish_command.payloadSize must be a positive safe integer.");
    if (typeof message.changeSummary !== "string") throw new Error("public_publish_command.changeSummary must be text.");
  }
  return message;
}
async function publicPackagePrepare(message) {
  validatePublicPackagePrepareCommand(message);
  const kind = message.kind;
  if (!["story", "character"].includes(kind)) throw new Error("Public package kind must be exactly story or character.");
  const id = requiredText(message.id, "public definition id");
  const revisionId = requiredText(message.revisionId, "public definition revision");
  const database = await openRuntimeDatabase();
  const storeName = kind === "story" ? "storyDefinitions" : "authoredCharacterDefinitions";
  const transaction = database.transaction(storeName, "readonly");
  const definition = await indexedDbRequest(transaction.objectStore(storeName).get([id, revisionId]));
  if (!definition) throw new Error("The public definition was not found.");
  if (kind === "character" && definition.age < 18) throw new Error("Underage or underage-looking content cannot be published.");
  const creator = requiredText(message.creator, "creator name");
  const creatorId = requiredText(message.creatorId, "creator id");
  const imageUrls = isPlainObject(message.imageUrls) ? message.imageUrls : {};
  let payload;
  let metadata;
  if (kind === "story") {
    const template = cloneValue(definition);
    template.id = template.storyId;
    delete template.storyId;
    delete template.revisionId;
    delete template.contentHash;
    const imageUrl = optionalText(imageUrls.title || template.title_card_image?.url);
    if (!imageUrl) throw new Error("A public story requires a hosted title image.");
    template.title_card_image = {
      ...template.title_card_image,
      url: imageUrl
    };
    payload = {
      app: "EmberAdventures",
      exportType: "story-template",
      storyTemplate: template,
      exportedAt: new Date().toISOString()
    };
    const objectives = template.state?.objectives?.items || [];
    metadata = {
      type: "story",
      definitionId: template.id,
      title: template.title,
      description: optionalText(template.description || template.summary || template.state?.meta?.description) || template.title,
      creator,
      creatorId,
      source: optionalText(template.source),
      creation_tool: requiredText(template.creation_tool, "story creation tool"),
      genres: template.genres || [],
      imageUrl,
      playerSelect: (template.state?.players || []).length > 1,
      playerOptionCount: Math.max(1, (template.state?.players || []).length),
      mainObjectiveCount: objectives.filter(objective => objective.side_objective !== true).length,
      sideObjectiveCount: objectives.filter(objective => objective.side_objective === true).length,
      futureCharacterCount: Object.keys(template.state?.future_cast?.items || {}).length,
      startingPartyMemberCount: (template.state?.scene?.party_members_present || []).length,
      startingNpcCount: (template.state?.scene?.npcs_present || []).length
    };
  } else {
    const character = cloneValue(definition);
    character.id = character.characterId;
    delete character.characterId;
    delete character.revisionId;
    delete character.contentHash;
    const maleImageUrl = optionalText(imageUrls.male || character.profile_image_presentations?.male?.url);
    const nonMaleImageUrl = optionalText(imageUrls.non_male || character.profile_image_presentations?.non_male?.url);
    if (!maleImageUrl || !nonMaleImageUrl) throw new Error("A public character requires hosted male and non-male profile images.");
    character.profile_image_presentations = {
      ...(character.profile_image_presentations || {}),
      male: {
        ...(character.profile_image_presentations?.male || {}),
        url: maleImageUrl
      },
      non_male: {
        ...(character.profile_image_presentations?.non_male || {}),
        url: nonMaleImageUrl
      }
    };
    character.default_profile_image = character.gender === "male" ? cloneValue(character.profile_image_presentations.male) : cloneValue(character.profile_image_presentations.non_male);
    payload = {
      character_definition: character
    };
    metadata = {
      type: "character",
      definitionId: character.id,
      name: character.name,
      maleName: character.gender === "male" ? character.name : character.fallback_name,
      nonMaleName: character.gender === "male" ? character.fallback_name : character.name,
      maleImageUrl,
      nonMaleImageUrl,
      imageUrl: character.gender === "male" ? maleImageUrl : nonMaleImageUrl,
      creator,
      creatorId,
      source: optionalText(character.source),
      creation_tool: requiredText(character.creation_tool, "character creation tool"),
      genres: character.genres || [],
      gender: character.gender,
      fallbackGender: optionalText(character.fallback_gender),
      age: character.age,
      species: optionalText(character.appearance?.species),
      role: optionalText(character.role)
    };
  }
  if (metadata.source !== "Original") throw new Error("Only original stories and characters can be published.");
  const compressed = await gzipJson(payload);
  return {
    ...compressed,
    metadata,
    fileName: `${safeRuntimeIdPart(id)}-${compressed.sha256.slice(0, 12)}.json.gz`
  };
}
async function supabaseRequest(path, {
  token = "",
  method = "GET",
  body = null,
  headers = {}
} = {}) {
  const response = await fetch(`${SupabaseUrl}${path}`, {
    method,
    headers: {
      apikey: SupabaseKey,
      Authorization: `Bearer ${token || SupabaseKey}`,
      ...(body == null ? {} : {
        "Content-Type": "application/json"
      }),
      ...headers
    },
    body: body == null ? null : JSON.stringify(body)
  });
  const source = await response.text();
  if (!response.ok) throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${source || response.statusText}`);
  return source ? JSON.parse(source) : null;
}
function publicDatabaseRow(metadata) {
  const common = {
    type: metadata.type,
    definition_id: metadata.definitionId,
    slug: `${metadata.type}-${safeRuntimeIdPart(metadata.definitionId)}-${safeRuntimeIdPart(metadata.creatorId)}`,
    creator: metadata.creator,
    creator_id: metadata.creatorId,
    // The package remains exactly "Original"; the database uses an empty
    // source for rows allowed by its original-only policy.
    source: metadata.source === "Original" ? "" : metadata.source,
    creation_tool: metadata.creation_tool,
    genres: metadata.genres,
    visibility: "public"
  };
  return metadata.type === "story" ? {
    ...common,
    title: metadata.title,
    description: metadata.description,
    player_select: metadata.playerSelect,
    player_option_count: metadata.playerOptionCount,
    main_objective_count: metadata.mainObjectiveCount,
    side_objective_count: metadata.sideObjectiveCount,
    future_character_count: metadata.futureCharacterCount,
    starting_party_member_count: metadata.startingPartyMemberCount,
    starting_npc_count: metadata.startingNpcCount
  } : {
    ...common,
    name: metadata.name,
    male_name: metadata.maleName,
    non_male_name: metadata.nonMaleName,
    male_image_url: metadata.maleImageUrl,
    non_male_image_url: metadata.nonMaleImageUrl,
    gender: metadata.gender,
    fallback_gender: metadata.fallbackGender || null,
    age: metadata.age,
    species: metadata.species,
    role: metadata.role,
    voice_gender: metadata.gender === "male" ? "male" : "non_male",
    has_default_image: true
  };
}
function publicVersionMetadataSnapshot(item) {
  const validated = validateSupabasePublicItemRow(item, "public_version_metadata_source");
  const snapshot = {};
  for (const field of SUPABASE_PUBLIC_VERSION_METADATA_FIELDS) snapshot[field] = structuredClone(validated[field]);
  return validateSupabasePublicVersionMetadataSnapshot(snapshot);
}
function assertPublicPublishAllowed({
  metadata,
  policy = {},
  existing = null,
  ownedCount = 0
}) {
  if (policy.banned === true) throw new Error(optionalText(policy.ban_reason) || "Your account is banned from publishing characters or stories due to inappropriate content.");
  if (["hidden", "flagged"].includes(existing?.visibility)) throw new Error(`This ${metadata.type} was hidden because of a report and cannot be republished right now.${existing.hidden_reason ? ` Reason: ${existing.hidden_reason}` : ""}`);
  const cap = metadata.type === "character" ? policy.character_cap : policy.story_cap;
  if (!existing?.id && ownedCount >= cap) throw new Error("You have reached the publishing cap. Contact the EmberAdventures Discord to request an increase. This limit exists to prevent malicious uploading, and increases are usually approved.");
}
async function publicPublish(message) {
  validatePublicPublishCommand(message);
  const metadata = message.metadata;
  const token = requiredText(message.token, "Supabase access token");
  const userId = requiredText(message.userId, "Supabase user id");
  const payloadUrl = requiredText(message.payloadUrl, "public payload URL");
  const row = publicDatabaseRow(metadata);
  if (message.dryRun === true) {
    assertPublicPublishAllowed({
      metadata,
      policy: message.policy || {
        story_cap: 100,
        character_cap: 1000,
        banned: false,
        ban_reason: null
      },
      existing: message.existing || null,
      ownedCount: message.ownedCount ?? 0
    });
    return {
      row,
      version: {
        payload_url: payloadUrl,
        image_url: metadata.imageUrl
      }
    };
  }
  await supabaseRequest("/rest/v1/creator_identities?on_conflict=creator_id", {
    token,
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: {
      creator_id: metadata.creatorId,
      creator_name: metadata.creator,
      owner_user_id: userId,
      updated_at: new Date().toISOString()
    }
  });
  await supabaseRequest("/rest/v1/rpc/public_library_publish_preflight", {
    token,
    method: "POST",
    body: {
      target_type: metadata.type,
      target_definition_id: metadata.definitionId,
      target_creator_id: metadata.creatorId
    }
  });
  const raw = await supabaseRequest("/rest/v1/rpc/publish_public_library_item_version", {
    token,
    method: "POST",
    body: {
      item_payload: row,
      version_payload: {
        payload_url: payloadUrl,
        payload_sha256: message.sha256,
        payload_size_bytes: message.payloadSize,
        image_url: metadata.imageUrl,
        change_summary: optionalText(message.changeSummary)
      }
    }
  });
  const result = Array.isArray(raw) ? raw[0] : raw;
  if (!isPlainObject(result)) throw new Error("Supabase did not return the atomic public publish result.");
  const item = validateSupabasePublicItemRow(result.i, "atomic_public_publish.item");
  const version = validateSupabasePublicVersionRow(result.v, "atomic_public_publish.version");
  if (item.owner_user_id !== userId || version.item_id !== item.id || item.current_version_id !== version.id) throw new Error("Supabase returned an inconsistent atomic public publish result.");
  if (typeof result.w !== "boolean" || !Number.isSafeInteger(result.n) || result.n < 1) throw new Error("Supabase returned invalid atomic public publish metadata.");
  return {
    itemId: item.id,
    versionId: version.id,
    versionNumber: result.n,
    updated: result.w
  };
}
async function submitDeveloperIssue(message) {
  const path = "developer_issue_submit_command";
  validateExactWorkerCommand(message, ["type", "requestId", "token", "userId", "title", "severity", "explanation", "reportText", "traceBlob", "saveBlob"], ["dryRun", "appVersion"], path);
  if (message.type !== "developer.issue.submit") throw new Error(`${path}.type must be exactly "developer.issue.submit".`);
  for (const field of ["token", "userId", "title", "severity", "explanation"]) requiredText(message[field], `${path}.${field}`);
  if (typeof message.reportText !== "string") throw new Error(`${path}.reportText must be text.`);
  if (!(message.traceBlob instanceof Blob)) throw new Error(`${path}.traceBlob must be a Blob.`);
  if (!(message.saveBlob instanceof Blob)) throw new Error(`${path}.saveBlob must be a Blob.`);
  if (Object.hasOwn(message, "dryRun") && typeof message.dryRun !== "boolean") throw new Error(`${path}.dryRun must be true or false.`);
  if (Object.hasOwn(message, "appVersion") && typeof message.appVersion !== "string") throw new Error(`${path}.appVersion must be text.`);
  const token = requiredText(message.token, "Supabase access token");
  const userId = requiredText(message.userId, "Supabase user id");
  const explanation = requiredText(message.explanation, "issue explanation");
  if (explanation.length < 10) throw new Error("Issue explanation must be at least 10 characters.");
  const traceText = await message.traceBlob.text();
  const saveText = await message.saveBlob.text();
  const packageResult = await gzipJson({
    app: "EmberAdventures",
    exportType: "developer-issue-package",
    createdAt: new Date().toISOString(),
    explanation,
    issueReport: optionalText(message.reportText),
    devTrace: traceText,
    activeSave: saveText
  });
  if (packageResult.size > 52428800) throw new Error("Developer issue package exceeds the 50 MiB upload limit.");
  const packagePath = `${userId}/${crypto.randomUUID()}.json.gz`;
  const row = {
    reporter_user_id: userId,
    explanation,
    issue_title: optionalText(message.title),
    issue_severity: optionalText(message.severity) || "error",
    package_path: packagePath,
    package_size_bytes: packageResult.size,
    app_version: optionalText(message.appVersion) || "runtime-v2"
  };
  if (message.dryRun === true) return {
    row,
    blob: packageResult.blob,
    sha256: packageResult.sha256
  };
  const reports = await supabaseRequest("/rest/v1/developer_issue_reports", {
    token,
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: row
  });
  const report = reports?.[0];
  if (!report?.id) throw new Error("Supabase did not create the developer issue record.");
  try {
    const response = await fetch(`${SupabaseUrl}/storage/v1/object/developer-issues/${packagePath}`, {
      method: "POST",
      headers: {
        apikey: SupabaseKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/gzip",
        "x-upsert": "false"
      },
      body: packageResult.blob
    });
    if (!response.ok) throw new Error(`Developer issue package upload failed (${response.status}): ${await response.text()}`);
  } catch (error) {
    await supabaseRequest(`/rest/v1/developer_issue_reports?id=eq.${encodeURIComponent(report.id)}`, {
      token,
      method: "DELETE"
    }).catch(() => {});
    throw error;
  }
  return {
    reportId: report.id,
    packagePath,
    size: packageResult.size
  };
}
function parseImportDownloadUrl(value) {
  const url = new URL(value);
  if (url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const blobIndex = parts.indexOf("blob");
    if (blobIndex === 2 && parts.length > 4) return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts[3]}/${parts.slice(4).join("/")}`;
  }
  if (url.hostname.endsWith("drive.google.com")) {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    const id = match?.[1] || url.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  }
  return url.href;
}

//#endregion Public Library

//#region Routing

async function route(message) {
  switch (message.type) {
    case "initialize":
      validateExactWorkerCommand(message, ["type", "requestId"], ["diagnostic", "runtimeDatabaseName", "applicationDatabaseName"], "library_initialize_command");
      if (Object.hasOwn(message, "diagnostic") && typeof message.diagnostic !== "boolean") throw new Error("library_initialize_command.diagnostic must be true or false.");
      if (message.diagnostic === true) {
        if (!Object.hasOwn(message, "runtimeDatabaseName") || !Object.hasOwn(message, "applicationDatabaseName")) throw new Error("Diagnostic library initialization requires both database names.");
        DiagnosticMode = true;
        RuntimeDatabaseName = requiredText(message.runtimeDatabaseName, "diagnostic runtime database name");
        ApplicationDatabaseName = requiredText(message.applicationDatabaseName, "diagnostic application database name");
      } else if (Object.hasOwn(message, "runtimeDatabaseName") || Object.hasOwn(message, "applicationDatabaseName")) throw new Error("Library database overrides are approved only in diagnostic mode.");
      await Promise.all([openRuntimeDatabase(), openApplicationDatabase()]);
      return {
        ready: true,
        runtimeDatabase: RuntimeDatabaseName,
        applicationDatabase: ApplicationDatabaseName
      };
    case "settings.list":
      return listSettings(message);
    case "settings.put":
      return putSettings(message);
    case "settings.delete":
      return deleteSettings(message);
    case "profiles.list":
      return listProfiles(message);
    case "profiles.put":
      return putProfile(message);
    case "profiles.replace":
      return replaceProfiles(message);
    case "profiles.delete":
      return deleteProfile(message);
    case "diagnostic.export":
      return diagnosticExport(message);
    case "library.import":
      return importBuffer(message);
    case "library.import-payload":
      return importPayload(message);
    case "library.list":
      return listLibrary(message);
    case "library.metadata":
      return definitionMetadata(message);
    case "story.start-options":
      return storyStartOptions(message);
    case "story.materialize-new-game":
      return materializeNewGame(message);
    case "story.materialize-runtime-game":
      return materializeNewGame(message);
    case "story.materialize-runtime-character":
      return materializeRuntimeCharacter(message);
    case "story.reconstruct-runtime-save":
      return reconstructRuntimeSave(message);
    case "diagnostic.story.records":
      {
        validateExactWorkerCommand(message, ["type", "requestId", "storyId", "revisionId"], [], "diagnostic_story_records_command");
        requiredText(message.storyId, "diagnostic_story_records_command.storyId");
        requiredText(message.revisionId, "diagnostic_story_records_command.revisionId");
        if (!DiagnosticMode) throw new Error("Diagnostic story records are unavailable in production mode.");
        const stored = await storedStoryDefinition(message.storyId, message.revisionId);
        return {
          definition: stored.definition,
          compiled: stored.compiled
        };
      }
    case "library.export":
      return exportDefinition(message);
    case "library.compatibility-definitions":
      return listCompatibilityDefinitions(message);
    case "library.delete":
      return deleteLibraryEntry(message);
    case "editor.start":
      return startEditor(message);
    case "editor.create":
      return createEditor(message);
    case "editor.inspect":
      return inspectEditorNode(message);
    case "editor.set":
      return setEditorValue(message);
    case "editor.add":
      return addEditorValue(message);
    case "editor.remove":
      return removeEditorValue(message);
    case "editor.objectives.list":
      return listEditorObjectives(message);
    case "editor.objectives.search":
      return searchEditorObjectives(message);
    case "editor.objective.replace":
      return replaceEditorObjective(message);
    case "editor.objective.add":
      return addEditorObjective(message);
    case "editor.objective.remove":
      return removeEditorObjective(message);
    case "editor.objective.starting":
      return setStartingEditorObjective(message);
    case "editor.catalog":
      return editorCatalog(message);
    case "editor.reward-template.put":
      return putEditorRewardTemplate(message);
    case "editor.reward-template.delete":
      return deleteEditorRewardTemplate(message);
    case "editor.reward-bundle.put":
      return putEditorRewardBundle(message);
    case "editor.reward-bundle.delete":
      return deleteEditorRewardBundle(message);
    case "editor.objective.inputs":
      return editorObjectiveInputs(message);
    case "editor.objective.inputs.set":
      return setEditorObjectiveInputs(message);
    case "editor.character.get":
      return characterEditorProjection(message);
    case "editor.character.patch":
      return patchCharacterEditor(message);
    case "editor.character.outfit.get":
      return getCharacterEditorOutfit(message);
    case "editor.character.outfit.put":
      return putCharacterEditorOutfit(message);
    case "editor.character.outfit.remove":
      return removeCharacterEditorOutfit(message);
    case "editor.save":
      return saveEditor(message);
    case "editor.close":
      return closeEditor(message);
    case "diagnostics.reset":
      return resetDevLogs(message);
    case "diagnostics.append":
      return appendDevLog(message);
    case "diagnostics.export":
      return exportDevLogs(message);
    case "diagnostic.import-url.parse":
      {
        validateExactWorkerCommand(message, ["type", "requestId", "url"], [], "diagnostic_import_url_parse_command");
        requiredText(message.url, "diagnostic_import_url_parse_command.url");
        return {
          url: parseImportDownloadUrl(message.url)
        };
      }
    case "public.search":
      return publicSearch(message);
    case "public.owned":
      return publicOwned(message);
    case "public.visibility.set":
      return setPublicVisibility(message);
    case "public.import":
      return importPublicEntry(message);
    case "public.versions":
      return publicVersions(message);
    case "public.rating.set":
      return setPublicRating(message);
    case "public.rating.remove":
      return removePublicRating(message);
    case "public.report.submit":
      return submitPublicReport(message);
    case "public.package.prepare":
      return publicPackagePrepare(message);
    case "public.publish":
      return publicPublish(message);
    case "developer.issue.submit":
      return submitDeveloperIssue(message);
    case "library.import-url":
      return importPublicEntry(message);
    default:
      throw new Error(`Unknown library worker request ${message.type}.`);
  }
}
self.onmessage = event => {
  const message = event.data;
  if (!isPlainObject(message)) {
    postMessage({
      type: "response",
      requestId: null,
      error: {
        name: "Error",
        message: "Library worker messages must be objects."
      }
    });
    return;
  }
  if (message.type === "library.validation-connect") {
    const fields = new Set(["type", "port"]);
    for (const field of Object.keys(message)) if (!fields.has(field)) throw new Error(`library_validation_connect_message.${field} is not an approved field.`);
    if (!(message.port instanceof MessagePort)) throw new Error("library_validation_connect_message.port must be a MessagePort.");
    connectCanonicalValidationPort(message.port);
    return;
  }
  route(message).then(value => {
    postMessage({
      type: "response",
      requestId: message.requestId,
      value
    });
  }).catch(error => {
    postMessage({
      type: "response",
      requestId: message.requestId,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack || ""
      }
    });
  });
};

//#endregion Routing