"use strict";

let RuntimeDatabaseName = "EmberAdventuresLiteRuntimeV2";
let runtimeDatabasePromise = null;

//#region IndexedDB Reads

function indexedDbRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Turn worker IndexedDB request failed."));
    });
}

function openRuntimeDatabase() {
    if (runtimeDatabasePromise)
        return runtimeDatabasePromise;

    runtimeDatabasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(RuntimeDatabaseName);
        request.onsuccess = () => {
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
        request.onerror = () => reject(request.error || new Error("Turn worker could not open runtime storage."));
    });
    return runtimeDatabasePromise;
}

async function storeRecord(storeName, key) {
    const database = await openRuntimeDatabase();
    const transaction = database.transaction(storeName, "readonly");
    return indexedDbRequest(transaction.objectStore(storeName).get(key));
}

async function recordsForSave(storeName, saveId) {
    const database = await openRuntimeDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    return indexedDbRequest(store.index("bySave").getAll(saveId));
}

async function latestMessages(saveId, limit = 16) {
    const database = await openRuntimeDatabase();
    const transaction = database.transaction("messages", "readonly");
    const index = transaction.objectStore("messages").index("bySequence");
    const range = IDBKeyRange.bound([saveId, -Infinity], [saveId, Infinity]);
    const messages = [];

    return new Promise((resolve, reject) => {
        const request = index.openCursor(range, "prev");
        request.onerror = () => reject(request.error || new Error("Turn worker could not read messages."));
        request.onsuccess = () => {
            const cursor = request.result;

            if (!cursor || messages.length >= limit) {
                messages.reverse();
                resolve(messages);
                return;
            }

            messages.push(cursor.value);
            cursor.continue();
        };
    });
}

//#endregion IndexedDB Reads




//#region Runtime Context

function text(value) {
    return String(value ?? "").trim();
}

function exactFiniteNumber(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`${path} must be a finite number.`);
    return value;
}

function exactStateScale(value, path) {
    const number = exactFiniteNumber(value, path);
    if (number < 0 || number > 10)
        throw new Error(`${path} must be from 0 through 10.`);
    return number;
}

function exactNonnegativeInteger(value, path) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new Error(`${path} must be a nonnegative safe integer.`);
    return value;
}

function objectiveControl(objective) {
    const control = objective?.completion_control;

    if (["player", "ai", "choice", "reward_only"].includes(control))
        return control;

    throw new Error(`Objective ${text(objective?.id) || "(missing id)"} has invalid completion_control.`);
}

function objectiveCompletionCondition(objective) {
    return objective?.completion_criteria;
}







function objectiveById(definition, compiled, objectiveId, runtimeJobDefinitions = []) {
    const index = compiled?.objectiveIndexById?.[objectiveId];
    let objective = Number.isInteger(index)
        ? definition?.state?.objectives?.items?.[index]
        : null;

    if (!objective) {
        for (const job of runtimeJobDefinitions) {
            const jobIndex = job.compiledIndexes?.objectiveIndexById?.[objectiveId];

            if (!Number.isInteger(jobIndex))
                continue;

            objective = job.definition?.objectives?.[jobIndex] || null;
            if (objective)
                return { objective, compiled: job.compiledIndexes, jobId: job.jobId };
        }
    }

    if (!objective)
        throw new Error(`Active objective ${objectiveId} is missing from the immutable story definition.`);

    return { objective, compiled, jobId: null };
}

function characterPronouns(character) {
    if (text(character?.gender).toLowerCase() === "male") {
        return {
            subject: "he", object: "him", possessive: "his", independent: "his", reflexive: "himself",
            person: "man", honorific: "Mr.", formal: "sir", monarch: "king", heir: "prince",
            noble: "lord", spouse: "husband", parent: "father", child: "son", sibling: "brother",
            uncleAunt: "uncle", nephewNiece: "nephew"
        };
    }

    if (text(character?.gender).toLowerCase() === "female") {
        return {
            subject: "she", object: "her", possessive: "her", independent: "hers", reflexive: "herself",
            person: "woman", honorific: "Ms.", formal: "ma'am", monarch: "queen", heir: "princess",
            noble: "lady", spouse: "wife", parent: "mother", child: "daughter", sibling: "sister",
            uncleAunt: "aunt", nephewNiece: "niece"
        };
    }

    return {
        subject: "they", object: "them", possessive: "their", independent: "theirs", reflexive: "themself",
        person: "person", honorific: "Mx.", formal: "friend", monarch: "monarch", heir: "heir",
        noble: "noble", spouse: "spouse", parent: "parent", child: "child", sibling: "sibling",
        uncleAunt: "aunt or uncle", nephewNiece: "niece or nephew"
    };
}

function capitalizeReference(value) {
    const source = String(value || "");
    return source ? `${source[0].toUpperCase()}${source.slice(1)}` : source;
}

function replaceCharacterReferences(value, characters, playerId) {
    const firstName = (character) => text(character?.name).split(/\s+/)[0];
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
        const normalized = String(type || "").replace(/-cap$/, "_cap");
        const capitalized = normalized.endsWith("_cap");
        const replacement = values[capitalized ? normalized.slice(0, -4) : normalized];
        return replacement == null ? null : capitalized ? capitalizeReference(replacement) : replacement;
    };

    return String(value ?? "").replace(/\|\[([^\]:]+)(?::([^\]]+))?\]\|/g, (token, type, id) => {
        const character = characters[id ? id === "player" ? playerId : id : playerId];
        return character ? valueFor(type, character) ?? token : token;
    });
}

async function loadTurnContext(saveId) {
    const header = await storeRecord("saveHeaders", saveId);

    if (!header)
        throw new Error(`Save ${saveId} does not exist.`);

    const [
        definition, compiled, control, messages, characterDefinitions, sceneRuntime, currentLocation,
        objectiveRuntime, rewardInvocations, storyValues, storyListItems, storyRuleAdds,
        storyRuleRemovals, characterRelationships, characterDurableState, characterStats,
        characterFacts, partyMembers, sceneMembers, futureCharacters, npcShells,
        characterOutfits, equippedItems, locationRuntime, runtimeLocationDefinitions, locationConnections, gameTime,
        characterSceneState, temporaryRemovedItems, items, characterAppearance, characterSettings,
        shopRuntime, shopItemRuntime, runtimeJobDefinitions, generatedJobRuntime,
        generatedJobProgressValues, generatedJobCompletedSteps, storyJobOffers,
        timedEventRuntime, timedEventAppliedStages
    ] = await Promise.all([
        storeRecord("storyDefinitions", [header.storyId, header.revisionId]),
        storeRecord("compiledStoryIndexes", [header.storyId, header.revisionId]),
        storeRecord("objectiveControl", saveId),
        latestMessages(saveId),
        recordsForSave("saveCharacterDefinitions", saveId),
        storeRecord("sceneRuntime", saveId),
        storeRecord("currentLocation", saveId),
        recordsForSave("objectiveRuntime", saveId),
        recordsForSave("rewardInvocations", saveId),
        recordsForSave("storyValues", saveId),
        recordsForSave("storyListItems", saveId),
        recordsForSave("storyRuleAdds", saveId),
        recordsForSave("storyRuleRemovals", saveId),
        recordsForSave("characterRelationshipStats", saveId),
        recordsForSave("characterDurableState", saveId),
        recordsForSave("characterStats", saveId),
        recordsForSave("characterFacts", saveId),
        recordsForSave("partyMembers", saveId),
        recordsForSave("sceneMembers", saveId),
        recordsForSave("futureCharacters", saveId),
        recordsForSave("npcShells", saveId),
        recordsForSave("characterOutfits", saveId),
        recordsForSave("equippedItems", saveId),
        recordsForSave("locationRuntime", saveId),
        recordsForSave("runtimeLocationDefinitions", saveId),
        recordsForSave("locationConnections", saveId),
        storeRecord("gameTime", saveId),
        recordsForSave("characterSceneState", saveId),
        recordsForSave("temporaryRemovedItems", saveId),
        recordsForSave("items", saveId),
        recordsForSave("characterAppearance", saveId),
        recordsForSave("characterSettings", saveId),
        recordsForSave("shopRuntime", saveId),
        recordsForSave("shopItemRuntime", saveId),
        recordsForSave("runtimeJobDefinitions", saveId),
        recordsForSave("generatedJobRuntime", saveId),
        recordsForSave("generatedJobProgressValues", saveId),
        recordsForSave("generatedJobCompletedSteps", saveId),
        recordsForSave("storyJobOffers", saveId),
        recordsForSave("timedEventRuntime", saveId),
        recordsForSave("timedEventAppliedStages", saveId)
    ]);

    if (!definition || !compiled)
        throw new Error("The active save has no matching immutable story definition.");
    if (!control)
        throw new Error("The active save has no objective control record.");

    const characters = Object.fromEntries(characterDefinitions.map((character) => [character.characterId, character]));
    const activeObjectiveId = control.focusedSideObjectiveId || control.activeMainObjectiveId;
    const objectiveSource = activeObjectiveId
        ? objectiveById(definition, compiled, activeObjectiveId, runtimeJobDefinitions)
        : { objective: null, compiled, jobId: null };
    const objective = objectiveSource.objective;
    const resolve = (value) => replaceCharacterReferences(value, characters, header.playerCharacterId);

    return {
        saveId,
        header,
        definition,
        compiled,
        objectiveCompiled: objectiveSource.compiled,
        activeJobId: objectiveSource.jobId,
        control,
        messages,
        characters,
        sceneRuntime,
        currentLocation,
        objectiveRuntime,
        rewardInvocations,
        storyValues,
        storyListItems,
        storyRuleAdds,
        storyRuleRemovals,
        characterRelationships,
        characterDurableState,
        characterStats,
        characterFacts,
        partyMembers,
        sceneMembers,
        futureCharacters,
        npcShells,
        characterOutfits,
        equippedItems,
        locationRuntime,
        runtimeLocationDefinitions,
        locationConnections,
        gameTime,
        characterSceneState,
        temporaryRemovedItems,
        items,
        characterAppearance,
        characterSettings,
        shopRuntime,
        shopItemRuntime,
        runtimeJobDefinitions,
        generatedJobRuntime,
        generatedJobProgressValues,
        generatedJobCompletedSteps,
        storyJobOffers,
        timedEventRuntime,
        timedEventAppliedStages,
        objective,
        resolve
    };
}

async function mutableStateSummary(context) {
    const [storyValues, relationships, members, gameTime] = await Promise.all([
        recordsForSave("storyValues", context.saveId),
        recordsForSave("characterRelationshipStats", context.saveId),
        recordsForSave("sceneMembers", context.saveId),
        storeRecord("gameTime", context.saveId)
    ]);
    return {
        scene: context.sceneRuntime,
        currentLocation: context.currentLocation,
        gameTime,
        sceneMembers: members.map((member) => member.characterId),
        relationships: relationships.map(({ characterId, trust, attraction, affection }) => ({
            characterId,
            trust,
            attraction,
            affection
        })),
        characterState: context.characterSceneState.map(({characterId, stateOfMind, physicalState, pose}) => ({characterId, stateOfMind, physicalState, pose})),
        activeOutfits: context.characterDurableState.map(({characterId, activeOutfitId}) => ({characterId, activeOutfitId})),
        outfits: context.characterOutfits.map(({characterId, outfitId, name}) => ({characterId, outfitId, name})),
        storyValues: storyValues.slice(0, 200).map(({ root, pathKey, value }) => ({ root, pathKey, value }))
    };
}

function chatText(messages) {
    return messages.map((message) => {
        const role = message.role === "assistant" ? "ASSISTANT" : message.role === "user" ? "PLAYER" : "GAME";
        return `${role} ${message.speaker || ""}: ${message.text}`;
    }).join("\n\n");
}

function nextMessageIdentity(context, role) {
    const sequence = (context.messages.at(-1)?.sequence || 0) + 1;
    return {
        messageId: `${role}-${Date.now()}-${sequence}`,
        sequence
    };
}

//#endregion Runtime Context




//#region Prompt Construction

function objectiveCheckPrompt(context, playerText, phase = "pre") {
    const objective = context.objective;

    if (!objective || !["player", "ai"].includes(objectiveControl(objective)))
        return "";

    const control = objectiveControl(objective);
    const decisionRule = phase === "post_progress"
        ? "This check records progress only. It cannot complete the objective."
        : control === "ai"
            ? "Return yes only when the current progress, situation, and player action make it appropriate for the narrator to finish the remainder of this objective in the next response. Do not complete it merely because it is possible."
            : "Return yes only when the player has done enough for the next narrator reply to show the immediate outcome. Return no when the action is merely planned, offered, or still lacks the player's required concrete action.";

    return [
        "You are the selected objective verifier for EmberAdventures.",
        "Return ONLY compact JSON: {\"c\":true|false,\"p\":\"one short progress note or empty string\"}",
        decisionRule,
        "The objective information below is intentionally limited to title, description, and completion condition.",
        `Title: ${context.resolve(objective.title)}`,
        `Description: ${context.resolve(objective.summary)}`,
        `Completion condition: ${context.resolve(objectiveCompletionCondition(objective))}`,
        `Player action: ${playerText}`,
        "Recent story messages:",
        chatText(context.messages.slice(-8))
    ].join("\n\n");
}

function sceneRemovalPrompt(context, playerText) {
    const present = context.sceneMembers
        .map((member) => context.characters[member.characterId])
        .filter(Boolean)
        .map((character) => ({ id: character.characterId, name: character.name }));

    if (!present.length)
        return "";

    return [
        "You are EmberAdventures's scene-presence cleanup checker.",
        'Return ONLY compact JSON: {"r":["stable-character-id"]}',
        "Remove only characters who clearly left, died, traveled away, were dismissed, or became too distant to interact because of the latest player action.",
        "Do not remove someone merely because focus, topic, or objective changed. If uncertain, keep them present.",
        "Never return a character who is not in the provided present-character list.",
        `Latest player action: ${playerText}`,
        `Present characters: ${JSON.stringify(present)}`,
        "Recent story messages:",
        chatText(context.messages.slice(-8))
    ].join("\n");
}

function parseSceneRemoval(raw, context) {
    const source = text(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;

    try {
        parsed = JSON.parse(source);
    }
    catch {
        throw new Error("Scene-presence checker returned malformed compact JSON.");
    }

    if (!Array.isArray(parsed?.r))
        throw new Error("Scene-presence checker response requires an r array.");

    const presentIds = new Set(context.sceneMembers.map((member) => member.characterId));
    const idsByName = new Map(context.sceneMembers.map((member) => [
        text(context.characters[member.characterId]?.name).toLowerCase(),
        member.characterId
    ]));
    const characterIds = [];

    for (const value of parsed.r) {
        const requested = text(value);
        const characterId = presentIds.has(requested) ? requested : idsByName.get(requested.toLowerCase());

        if (!characterId)
            throw new Error(`Scene-presence checker tried to remove a character who is not present: ${requested || "(empty)"}.`);
        if (characterId === context.header.playerCharacterId)
            throw new Error("Scene-presence checker cannot remove the player from the scene.");
        if (!characterIds.includes(characterId))
            characterIds.push(characterId);
    }

    const names = characterIds.map((characterId) => context.characters[characterId]?.name || characterId);
    return {
        characterIds,
        operations: characterIds.map((characterId) => ({ type: "scene.member.remove", characterId })),
        narratorDirective: names.length
            ? `These characters just left or were removed from the current scene and must not appear, speak, act, or be treated as nearby in this reply: ${names.join(", ")}.`
            : ""
    };
}

function completionDirective(context, completed) {
    if (!completed || !context.objective)
        return "";

    const objective = context.objective;
    const lines = [
        `The objective \"${context.resolve(objective.title)}\" completed before this response.`,
        "Use the updated objective state and continue the story naturally. Do not print objective metadata or a separate report."
    ];
    const instruction = context.resolve(objective.completion_instruction);

    if (instruction)
        lines.push(`Objective completion story instruction: ${instruction}`);

    if (Array.isArray(objective.dialogue_lines) && objective.dialogue_lines.length) {
        lines.push("", "DIALOGUE DELIVERY REQUIRED", "Include every required line exactly once, in the listed order. You may respond to the player first when the lines are not the natural immediate response. You may add narration or dialogue between them. Do not paraphrase, merge, omit, or alter a required line.");

        for (const dialogueLine of objective.dialogue_lines)
            lines.push(context.resolve(dialogueLine));
    }

    return lines.join("\n");
}

function activeObjectiveGuidance(context, completed) {
    const objective = context.objective;

    if (!objective || completed)
        return "";

    const control = objectiveControl(objective);
    const lines = [
        `Current objective: ${context.resolve(objective.title)}`,
        `Player-facing description: ${context.resolve(objective.summary)}`,
        `AI-only guidance: ${context.resolve(objective.while_active_guidance)}`
    ];
    const requirementState = objectiveRequirementState(context);

    if (requirementState.blocked) {
        lines.push(
            "This objective cannot be completed because the player does not meet these completion requirements:",
            ...requirementState.unmet.map((requirement) => `- ${requirement}`),
            "Do not complete it and do not run or imply its completion rewards. The player may still act normally."
        );
    }

    if (control === "player")
        lines.push("This objective is player-controlled. Create progress and openings, but do not perform the player's required action for them.");
    else if (control === "ai")
        lines.push("This objective is AI-controlled, but the verifier did not authorize completion this turn. Respond naturally and advance only what follows from the player's action.");

    return lines.join("\n");
}

function narratorPrompt(context, completionText) {
    return [
        "You are the narrator and characters for an EmberAdventures story.",
        "Respond directly to the player's latest action and continue the established scene. Preserve player agency.",
        "Keep the adventure suitable for a general audience. Romance, flirting, and dating are allowed; keep intimate moments off-screen.",
        "Use speaker tags in the exact form (Character Name) immediately before spoken dialogue. Narration has no speaker tag.",
        context.header.storyGuidance ? `Story guidance: ${context.header.storyGuidance}` : "",
        context.sceneRuntime?.summary ? `Current scene: ${context.sceneRuntime.summary}` : "",
        activeObjectiveGuidance(context, false),
        completionText,
        "Recent story messages:",
        chatText(context.messages)
    ].filter(Boolean).join("\n\n");
}

async function stateUpdatePrompt(context, assistantText) {
    const state = await mutableStateSummary(context);
    const characters = Object.values(context.characters).map((character) => ({ id: character.characterId, name: character.name }));
    return [
        "Update EmberAdventures runtime state from the newest player action and narrator response.",
        "Return ONLY compact JSON: {\"ops\":[...]}",
        "Allowed operations:",
        '{"t":"scene","v":{"summary":"text","imageAction":"text"}}',
        '{"t":"relationship","id":"character-id","v":{"trust":0-10,"attraction":0-10,"affection":0-10}}',
        '{"t":"character","id":"character-id","v":{"stateOfMind":"text","physicalState":"text","pose":"text","outfitId":"existing-outfit-id"}}',
        '{"t":"value","root":"story_inventory|world_flags|progression","path":"stable.path","v":"scalar string, number, boolean, or null"}',
        '{"t":"member_add","id":"character-id"}',
        '{"t":"member_remove","id":"character-id"}',
        '{"t":"location","id":"location-id"}',
        '{"t":"time","v":{"year":number,"month":number,"day":number,"hour":number,"minute":number,"elapsedMinutes":number}}',
        "Use an empty ops array when nothing durable changed.",
        "Never add, edit, complete, route, or otherwise mutate objectives. Objective definitions and runtime are owned by the objective system.",
        "Update a character's state of mind, physical condition, pose, or outfit only when the latest action or response establishes that change. Omit unchanged fields. Each pose describes that character alone.",
        "Outfit changes select an existing complete outfit belonging to that character. Keep full-coverage outer clothing.",
        "Use only listed character and location ids. Do not invent ids.",
        `Characters: ${JSON.stringify(characters)}`,
        `Current mutable state: ${JSON.stringify(state)}`,
        `Newest narrator response: ${assistantText}`
    ].join("\n\n");
}

//#endregion Prompt Construction




//#region Objective Runtime And Rewards

function stableHash(value) {
    let hash = 2166136261;

    for (const character of String(value ?? "")) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
}

function rewardPath(reward) {
    if (!Array.isArray(reward?.field_path) || !reward.field_path.length)
        throw new Error("Reward field_path must be a non-empty array from the validated definition.");

    return reward.field_path;
}

function characterIdFor(context, value) {
    const wanted = text(value);

    if (!wanted || /^player$/i.test(wanted))
        return context.header.playerCharacterId;
    if (context.characters[wanted] || context.compiled?.characterById?.[wanted])
        return wanted;

    const lowered = wanted.toLowerCase();
    const materialized = Object.values(context.characters).find((character) => text(character.name).toLowerCase() === lowered);

    if (materialized)
        return materialized.characterId;

    const locator = Object.keys(context.compiled?.characterById || {}).find((id) => {
        const definition = characterDefinitionById(context, id);
        return text(definition?.name).toLowerCase() === lowered;
    });
    return locator || "";
}

function characterDefinitionById(context, characterId) {
    const locator = context.compiled?.characterById?.[characterId];

    if (!locator)
        return null;

    const located = locator.split(".").reduce((value, key) => value?.[key], context.definition.state);
    return located?.animal_definition || located?.full_character || located || null;
}

function objectiveRuntimeById(context, objectiveId) {
    return context.objectiveRuntime.find((entry) => entry.objectiveId === objectiveId) || null;
}

function storyScalar(context, root, pathKey) {
    return context.storyValues.find((entry) => entry.root === root && entry.pathKey === pathKey)?.value;
}

function storyList(context, root, listPathKey) {
    return context.storyListItems
        .filter((entry) => entry.root === root && entry.listPathKey === listPathKey)
        .sort((left, right) => left.sequence - right.sequence)
        .map((entry) => entry.value);
}

function runtimePathValue(context, rawPath) {
    const path = Array.isArray(rawPath) ? rawPath.map(text) : text(rawPath).split(".").filter(Boolean);
    const [root, ...rest] = path;
    const pathKey = rest.join(".");

    if (["story_inventory", "world_flags", "progression"].includes(root)) {
        const scalar = storyScalar(context, root, pathKey);
        return scalar !== undefined ? scalar : storyList(context, root, pathKey);
    }
    if (root === "scene") {
        if (["party_members_present", "npcs_present"].includes(pathKey))
            return context.sceneMembers.map((entry) => entry.characterId);
        return context.sceneRuntime?.[pathKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())];
    }
    if (root === "player") {
        const playerId = context.header.playerCharacterId;

        if (rest[0] === "stats")
            return context.characterStats.find((entry) => entry.characterId === playerId && entry.statId === rest[1])?.value;
        if (rest[0] === "known_facts")
            return context.characterFacts.filter((entry) => entry.characterId === playerId).map((entry) => entry.text);
        if (rest[0] === "role")
            return context.characterDurableState.find((entry) => entry.characterId === playerId)?.role;
    }
    if (root === "time")
        return context.gameTime?.[rest.join("").replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())];

    return undefined;
}

function compareRequirement(left, operator, right) {
    switch (operator) {
        case "truthy": return Boolean(left);
        case "falsy": return !left;
        case "==": case "=": case "eq": return left === right;
        case "!=": case "neq": return left !== right;
        case ">":
        case ">=":
        case "<":
        case "<=":
            if (typeof left !== "number" || !Number.isFinite(left) || typeof right !== "number" || !Number.isFinite(right))
                throw new Error(`Requirement operator ${operator} requires finite numeric operands.`);
            if (operator === ">") return left > right;
            if (operator === ">=") return left >= right;
            if (operator === "<") return left < right;
            return left <= right;
        case "includes":
            if (Array.isArray(left)) return left.includes(right);
            if (typeof left !== "string" || typeof right !== "string")
                throw new Error("Requirement operator includes requires an array or two text operands.");
            return left.includes(right);
        case "not_includes":
            if (Array.isArray(left)) return !left.includes(right);
            if (typeof left !== "string" || typeof right !== "string")
                throw new Error("Requirement operator not_includes requires an array or two text operands.");
            return !left.includes(right);
        default: throw new Error(`Unsupported requirement operator ${operator}.`);
    }
}

function requirementMet(context, requirement) {
    const type = requirement?.type;

    if (type === "objective_complete")
        return objectiveRuntimeById(context, requirement.id)?.status === "complete";
    if (type === "objective_not_complete")
        return objectiveRuntimeById(context, requirement.id)?.status !== "complete";
    if (type === "party_member")
        return context.partyMembers.some((entry) => entry.characterId === characterIdFor(context, requirement.target));
    if (["character_alive", "character_dead"].includes(type)) {
        const id = characterIdFor(context, requirement.target);
        const alive = context.npcShells.find((entry) => entry.characterId === id)?.status !== "dead";
        return type === "character_alive" ? alive : !alive;
    }
    if (type === "story_rule") {
        const ruleId = requirement.id;
        const removed = context.storyRuleRemovals.some((entry) => entry.ruleId === ruleId);
        const authored = (context.definition.state.story_rules || []).some((rule) => text(rule.id) === ruleId || text(rule) === ruleId);
        const added = context.storyRuleAdds.some((entry) => entry.ruleId === ruleId);
        return !removed && (authored || added);
    }
    if (["known_fact", "durable_known_fact"].includes(type)) {
        const characterId = characterIdFor(context, requirement.target);
        const fact = requirement.id;
        return context.characterFacts.some((entry) => entry.characterId === characterId && (entry.factId === fact || entry.text === fact));
    }

    return compareRequirement(runtimePathValue(context, requirement.path), requirement.op, requirement.value);
}

function requirementsMet(context, requirements) {
    return (Array.isArray(requirements) ? requirements : []).every((requirement) => requirementMet(context, requirement));
}

function requirementDescription(context, requirement) {
    const type = requirement?.type;

    if (["objective_complete", "objective_not_complete"].includes(type)) {
        const objectiveId = requirement.id;
        const target = objectiveById(context.definition, context.compiled, objectiveId, context.runtimeJobDefinitions).objective;
        return `${type === "objective_complete" ? "Complete" : "Do not complete"} ${context.resolve(target.title)}`;
    }
    if (type === "party_member") {
        const characterId = characterIdFor(context, requirement.target);
        return `${context.characters[characterId]?.name || characterId} must be in the party`;
    }
    if (["character_alive", "character_dead"].includes(type)) {
        const characterId = characterIdFor(context, requirement.target);
        return `${context.characters[characterId]?.name || characterId} must be ${type === "character_alive" ? "alive" : "dead"}`;
    }
    if (type === "story_rule")
        return `Story rule required: ${requirement.id}`;
    if (["known_fact", "durable_known_fact"].includes(type))
        return `Required known fact: ${context.resolve(requirement.id)}`;

    return `${requirement.path} ${requirement.op}${requirement.op === "truthy" ? "" : ` ${JSON.stringify(requirement.value)}`}`;
}

function objectiveRequirementState(context) {
    const requirements = Array.isArray(context.objective?.completion_requirements)
        ? context.objective.completion_requirements
        : [];
    const unmet = requirements.filter((requirement) => !requirementMet(context, requirement));
    return { blocked: unmet.length > 0, unmet: unmet.map((requirement) => requirementDescription(context, requirement)) };
}

function replaceTemplateParameters(value, parameters) {
    if (Array.isArray(value))
        return value.map((entry) => replaceTemplateParameters(entry, parameters));
    if (value == null || typeof value !== "object")
        return value;
    if (Object.keys(value).length === 1 && value.parameter)
        return parameters[value.parameter];

    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceTemplateParameters(nested, parameters)]));
}

function expandRewards(context, rewards, stack = [], position = []) {
    const expanded = [];

    for (const [index, reward] of (Array.isArray(rewards) ? rewards : []).entries()) {
        const rewardPosition = [...position, index];

        if (typeof reward === "string" || reward?.type === "apply_reward_bundle") {
            const bundleId = text(typeof reward === "string" ? reward : reward.bundle_id);

            if (!bundleId || stack.includes(`bundle:${bundleId}`))
                throw new Error(`Reward bundle ${bundleId || "(missing)"} is missing or recursive.`);

            const bundle = context.definition.state.reward_bundles?.[bundleId];

            if (!bundle)
                throw new Error(`Reward bundle ${bundleId} does not exist.`);

            expanded.push(...expandRewards(context, bundle, [...stack, `bundle:${bundleId}`], [...rewardPosition, "bundle", bundleId]));
            continue;
        }

        if (reward?.type === "apply_reward_template") {
            const templateId = text(reward.template_id);
            const template = context.definition.state.reward_templates?.[templateId];

            if (!template || stack.includes(`template:${templateId}`))
                throw new Error(`Reward template ${templateId || "(missing)"} is missing or recursive.`);

            const filled = replaceTemplateParameters(template.rewards, reward.arguments || {});
            expanded.push(...expandRewards(context, filled, [...stack, `template:${templateId}`], [...rewardPosition, "template", templateId]));
            continue;
        }

        expanded.push({ reward, position: rewardPosition.join("-") });
    }

    return expanded;
}

function expressionOperand(context, operand) {
    if (typeof operand === "number")
        return operand;
    if (Object.hasOwn(operand, "path")) {
        let value;

        if (Object.hasOwn(operand, "character_id")) {
        const characterId = characterIdFor(context, operand.character_id);
            const path = operand.path;

            if (path[0] !== "stats")
                throw new Error("Character numeric expression paths must start with stats.");
            value = context.characterStats.find((entry) => entry.characterId === characterId && entry.statId === path[1])?.value;
        }
        else
            value = runtimePathValue(context, operand.path);

        if (typeof value !== "number" || !Number.isFinite(value))
            throw new Error(`Numeric expression path ${operand.path.join(".")} does not contain a finite number.`);
        return value;
    }
    return operand.value;
}

function rewardNumericValue(context, reward) {
    if (Object.hasOwn(reward, "value"))
        return reward.value;
    if (Object.hasOwn(reward, "value_path")) {
        const value = Object.hasOwn(reward, "value_character_id")
            ? expressionOperand(context, { path: reward.value_path, character_id: reward.value_character_id })
            : runtimePathValue(context, reward.value_path);

        if (typeof value !== "number" || !Number.isFinite(value))
            throw new Error(`Reward value_path ${reward.value_path.join(".")} does not contain a finite number.`);
        return value;
    }

    let value = expressionOperand(context, reward.value_expression.initial);

    for (const operation of reward.value_expression.operations || []) {
        const operand = expressionOperand(context, operation.operand);

        if (operation.operation === "multiply") value *= operand;
        else if (operation.operation === "add") value += operand;
        else if (operation.operation === "subtract") value -= operand;
        else if (operation.operation === "divide") value /= operand;
        else throw new Error(`Unsupported reward expression operation ${operation.operation}.`);
    }

    return value;
}

function storyValueSetOperation(context, root, pathKey, value) {
    const existing = context.storyValues.find((entry) => entry.root === root && entry.pathKey === pathKey);

    if (existing) existing.value = value;
    else context.storyValues.push({ root, pathKey, value });

    return { type: "story.value.set", record: { root, pathKey, value } };
}

function rewardCharacterId(context, reward, field) {
    const reference = reward[field];
    const characterId = characterIdFor(context, reference);

    if (!characterId || !context.characters[characterId])
        throw new Error(`Reward references an unavailable character ${reference}.`);

    return characterId;
}

function rewardOutfitOperations(context, reward, characterId) {
    const gender = text(context.characters[characterId]?.gender).toLowerCase();
    const source = reward.outfit || (gender === "male" ? reward.male_outfit : reward.non_male_outfit);

    if (!source || typeof source !== "object")
        return [];

    const outfitId = text(source.id);

    if (!outfitId || !text(source.name) || !source.clothing || typeof source.clothing !== "object")
        throw new Error("grant_outfit requires an outfit with an id, name, and clothing object.");

    const slots = blankEquipmentValues();
    const operations = [];
    const authored = { ...source.clothing, left_hand: source.left_hand, right_hand: source.right_hand };

    for (const [authoredSlot, rawDescription] of Object.entries(authored)) {
        const slot = authoredSlot.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const description = text(rawDescription);

        if (!description)
            continue;
        if (!EquipmentSlots.includes(slot))
            throw new Error(`grant_outfit uses unsupported clothing slot ${authoredSlot}.`);

        const itemId = `${characterId}--${outfitId}--${slot}--${stableHash(description)}`;
        slots[slot] = itemId;
        operations.push({ type: "item.put", item: {
            itemId,
            characterId,
            name: description.slice(0, 100),
            type: ["leftHand", "rightHand"].includes(slot) ? "held item" : "clothing",
            slot: ["leftHand", "rightHand"].includes(slot) ? "hand" : slot,
            quantity: 1,
            value: 0,
            sellable: false,
            questItem: false,
            description,
            imageId: source.image_id || null
        } });
    }

    const outfit = {
        characterId,
        outfitId,
        name: text(source.name),
        formality: 0,
        origin: "",
        memory: "",
        sourceShopId: "",
        sourceOutfitId: outfitId,
        imagePrompt: text(source.image?.prompt),
        imageId: text(source.image?.id),
        contexts: [],
        ...slots
    };
    const existing = context.characterOutfits.find((entry) => entry.characterId === characterId && entry.outfitId === outfitId);

    if (existing && JSON.stringify(existing) !== JSON.stringify({ ...outfit, saveId: existing.saveId }))
        throw new Error(`grant_outfit conflicts with existing outfit id ${outfitId}.`);
    if (!existing) {
        context.characterOutfits.push(outfit);
        operations.push({ type: "outfit.put", outfit });
    }
    if (reward.equip === true) {
        operations.push({ type: "equipment.set", record: { characterId, ...slots } });
        operations.push({ type: "temporary.items.set", record: { characterId, ...blankEquipmentValues() } });
        operations.push({ type: "character.durable.set", characterId, values: { activeOutfitId: outfitId } });
    }

    return operations;
}

function equipmentFromOutfit(outfit) {
    return Object.fromEntries(EquipmentSlots.map((slot) => [slot, outfit?.[slot] || null]));
}

function planReward(context, reward, operations, hydration, warnings = [], sharedImageRequests = []) {
    const type = reward?.type;

    if (["set_state_field", "modify_integer", "modify_number"].includes(type)) {
        const path = rewardPath(reward);
        const operationName = type === "set_state_field" ? "set" : reward.operation;
        const numeric = type !== "set_state_field" || operationName !== "set";
        const value = numeric ? rewardNumericValue(context, reward) : reward.value;
        const current = runtimePathValue(context, path);
        if (numeric && (typeof current !== "number" || !Number.isFinite(current)))
            throw new Error(`Reward ${type} path ${path.join(".")} does not contain a finite number.`);
        const next = operationName === "add" ? current + value
            : operationName === "subtract" ? current - value
                : operationName === "multiply" ? current * value
                    : value;

        if (["story_inventory", "world_flags", "progression"].includes(path[0]))
            operations.push(storyValueSetOperation(context, path[0], path.slice(1).join("."), next));
        else if (path[0] === "player" && path[1] === "stats")
            operations.push({ type: "character.stat.set", characterId: context.header.playerCharacterId, statId: path[2], value: next });
        else if (path[0] === "player" && path[1] === "role")
            operations.push({ type: "character.durable.set", characterId: context.header.playerCharacterId, values: { role: text(next) } });
        else if (path[0] === "scene" && path[1] === "summary")
            operations.push({ type: "scene.runtime.set", values: { summary: text(next) } });
        else if (path[0] === "world_map" && ["current_location_id", "focus_location_id"].includes(path[1]))
            operations.push({ type: "location.current.set", locationId: text(next) });
        else
            throw new Error(`Reward ${type} path ${path.join(".")} is not supported by the normalized runtime.`);
        return;
    }

    if (["add_state_list_item", "remove_state_list_item"].includes(type)) {
        const path = rewardPath(reward);
        const root = path[0];
        const listPathKey = path.slice(1).join(".");

        if (root === "scene" && ["party_members_present", "npcs_present", "image_characters"].includes(listPathKey)) {
            const characterId = characterIdFor(context, reward.value);

            if (!characterId)
                throw new Error(`Scene reward references unknown character ${reward.value}.`);

            operations.push({ type: type === "add_state_list_item" ? "scene.member.add" : "scene.member.remove", characterId });
            return;
        }

        if (!["story_inventory", "world_flags", "progression"].includes(root))
            throw new Error(`Reward ${type} path ${path.join(".")} is not supported by the normalized runtime.`);

        const itemKey = `fnv1a-${stableHash(JSON.stringify(reward.value))}`;

        if (type === "add_state_list_item") {
            const existing = context.storyListItems.filter((entry) => entry.root === root && entry.listPathKey === listPathKey);
            const sequence = existing.reduce((maximum, entry) => Math.max(maximum, entry.sequence), 0) + 1;
            operations.push({ type: "story.list.add", record: { root, listPathKey, itemKey, sequence, value: reward.value } });
        }
        else
            operations.push({ type: "story.list.remove", root, listPathKey, itemKey });
        return;
    }

    if (type === "add_story_rule") {
        const ruleId = reward.rule_id;
        operations.push({ type: "story.rule.add", rule: { ruleId, text: text(reward.text) } });
        return;
    }
    if (type === "remove_story_rule") {
        operations.push({ type: "story.rule.remove", ruleId: reward.rule_id });
        return;
    }
    if (type === "adjust_story_inventory") {
        const path = rewardPath(reward);
        if (path.length < 2 || path[0] !== "story_inventory")
            throw new Error("adjust_story_inventory.field_path must start with story_inventory and include a field.");
        const pathKey = path.slice(1).join(".");
        const current = storyScalar(context, "story_inventory", pathKey);
        if (typeof current !== "number" || !Number.isFinite(current))
            throw new Error(`adjust_story_inventory target ${path.join(".")} must contain a finite number.`);
        const amount = reward.amount;
        let next;
        if (reward.operation === "add") next = current + amount;
        else if (reward.operation === "subtract") next = current - amount;
        else if (reward.operation === "multiply") next = current * amount;
        else if (reward.operation === "divide") {
            if (amount === 0) throw new Error("adjust_story_inventory cannot divide by zero.");
            next = current / amount;
        }
        else if (reward.operation === "set") next = amount;
        else throw new Error(`Unsupported adjust_story_inventory operation ${reward.operation}.`);
        operations.push(storyValueSetOperation(context, "story_inventory", pathKey, next));
        return;
    }
    if (type === "adjust_relationship") {
        const characterId = characterIdFor(context, reward.target);

        if (!characterId)
            throw new Error(`Relationship reward references unknown character ${reward.target}.`);

        const existing = context.characterRelationships.find((entry) => entry.characterId === characterId) || { trust: 0, attraction: 0, affection: 0 };
        const values = {};
        const deltas = {};

        if (reward.preset === "all") {
            deltas.trust = reward.amount;
            deltas.attraction = reward.amount;
            deltas.affection = reward.amount;

        }
        if (reward.stats)
            Object.assign(deltas, reward.stats);

        for (const field of ["trust", "attraction", "affection"]) {
            const delta = deltas[field];
            if (delta != null) values[field] = Math.max(0, Math.min(10, existing[field] + delta));
        }

        operations.push({ type: "character.relationship.set", characterId, values });
        return;
    }
    if (type === "advance_time") {
        const minutes = (reward.minutes ?? 0) + (reward.hours ?? 0) * 60;
        const current = context.gameTime;

        if (!current)
            throw new Error("advance_time requires the save's gameTime record.");
        const total = current.hour * 60 + current.minute + minutes;
        operations.push({ type: "time.set", values: {
            day: current.day + Math.floor(total / 1440),
            hour: Math.floor((total % 1440) / 60),
            minute: total % 60,
            elapsedMinutes: current.elapsedMinutes + minutes
        } });
        return;
    }
    if (type === "unlock_location") {
        const locationId = reward.location_id;
        operations.push({ type: "location.runtime.set", locationId, values: { discovered: true, travelEnabled: true } });
        return;
    }
    if (["introduce_future_character", "promote_future_character_to_party", "make_future_character_recruitable"].includes(type)) {
        const characterId = characterIdFor(context, reward.character_id);
        const existingFuture = context.futureCharacters.find((entry) => entry.characterId === characterId);
        const existingShell = context.npcShells.find((entry) => entry.characterId === characterId);
        const locationId = type === "introduce_future_character"
            ? reward.npc_location_id
            : existingShell?.locationId ?? existingFuture?.locationId;

        if (!characterId)
            throw new Error(`${type} references an unknown character.`);

        if (!context.characters[characterId] && !hydration.some((entry) => entry.characterId === characterId))
            hydration.push({
                characterId,
                ...(locationId ? { locationId } : {}),
                storyId: context.header.storyId,
                revisionId: context.header.revisionId,
                player: { ...context.characters[context.header.playerCharacterId], id: context.header.playerCharacterId }
            });

        if (type === "introduce_future_character") {
            const definition = characterDefinitionById(context, characterId);
            if (!definition || typeof definition.can_die !== "boolean")
                throw new Error(`introduce_future_character requires validated character ${characterId}.`);
            operations.push({ type: "future.character.set", characterId, values: { status: "introduced", locationId, lastTriggeredReason: "objective reward" } });
            operations.push({ type: "npc.shell.put", shell: {
                characterId,
                locationId,
                canDie: definition.can_die,
                recruitable: false,
                everInvited: false,
                status: "alive",
                killedByPlayer: false,
                inspected: true,
                futureCharacterId: characterId,
            } });
            if (reward.scene_presence === "active")
                operations.push({ type: "scene.member.add", characterId });
        }
        if (type === "make_future_character_recruitable")
            operations.push({ type: "npc.shell.set", characterId, values: { locationId, recruitable: true } });
        if (type === "promote_future_character_to_party") {
            operations.push({ type: "party.member.add", characterId });
            operations.push({ type: "future.character.set", characterId, values: { status: "promoted", locationId } });
        }
        return;
    }
    if (type === "replace_character_definition") {
        const targetCharacterId = characterIdFor(context, reward.target_character_id);
        const sourceCharacterId = characterIdFor(context, reward.source_future_character_id);
        const sourceDefinition = characterDefinitionById(context, sourceCharacterId);

        if (!targetCharacterId || !context.characters[targetCharacterId])
            throw new Error("replace_character_definition requires a materialized target character.");
        if (!sourceDefinition)
            throw new Error("replace_character_definition requires a valid future-character source definition.");
        const current = context.characters[targetCharacterId];
        const replacement = structuredClone(sourceDefinition);
        replacement.id = targetCharacterId;
        replacement.relationship_to_player = current.relationshipToPlayer;
        replacement.starting_relationship_to_player = current.relationshipToPlayer;
        replacement.starting_trust = current.trust;
        replacement.starting_affection = current.affection;
        replacement.starting_attraction = current.attraction;

        hydration.push({
            characterId: targetCharacterId,
            character: replacement,
            replace: true,
            storyId: context.header.storyId,
            revisionId: context.header.revisionId,
            player: { ...context.characters[context.header.playerCharacterId], id: context.header.playerCharacterId },
        });
        operations.push({
            type: "future.character.set",
            characterId: sourceCharacterId,
            values: { status: "consumed_as_replacement", lastTriggeredReason: text(reward.reason) },
        });
        return;
    }
    if (type === "kill_character") {
        const characterId = characterIdFor(context, reward.target);
        const shell = context.npcShells.find((entry) => entry.characterId === characterId);
        operations.push({ type: "npc.shell.set", characterId, values: {
            locationId: shell?.locationId || context.currentLocation?.locationId,
            status: "dead",
            deathNote: text(reward.reason),
            killedByPlayer: reward.killed_by_player === true
        } });
        operations.push({ type: "party.member.remove", characterId });
        operations.push({ type: "scene.member.remove", characterId });
        return;
    }
    if (["start_objective", "complete_objective"].includes(type)) {
        const objectiveId = reward.objective_id;
        const target = objectiveById(context.definition, context.compiled, objectiveId, context.runtimeJobDefinitions);
        const sideObjective = target.objective?.type === "side" || target.jobId != null;

        operations.push({
            type: "objective.runtime.set",
            objectiveId,
            values: type === "complete_objective"
                ? { status: "complete", selectedOutputId: null }
                : { status: "active", selectedOutputId: null }
        });

        if (type === "start_objective") {
            const controlValues = sideObjective
                ? { focusedSideObjectiveId: objectiveId }
                : { activeMainObjectiveId: objectiveId, focusedSideObjectiveId: null };
            operations.push({
                type: "objective.control.set",
                values: controlValues
            });
            Object.assign(context.control, controlValues);
        }
        else if (type === "complete_objective") {
            if (context.control.activeMainObjectiveId === objectiveId) {
                operations.push({ type: "objective.control.set", values: { activeMainObjectiveId: null } });
                context.control.activeMainObjectiveId = null;
            }
            if (context.control.focusedSideObjectiveId === objectiveId) {
                operations.push({ type: "objective.control.set", values: { focusedSideObjectiveId: null } });
                context.control.focusedSideObjectiveId = null;
            }
        }
        return;
    }
    if (type === "add_story_item") {
        const item = reward.item;

        if (!item || typeof item !== "object")
            throw new Error("add_story_item requires an item object.");

        const itemId = item.id;
        operations.push({ type: "item.put", item: purchasedInventoryItem(context, "reward", itemId, item) });
        return;
    }
    if (["add_item", "grant_item"].includes(type)) {
        const characterId = rewardCharacterId(context, reward, "target");
        const item = reward.item;
        const baseId = item.id;

        if (!baseId || !item.name)
            throw new Error(`${type} requires an item with exact id and name fields.`);

        const itemId = `${characterId}--${baseId}`;
        const existing = context.items.find((entry) => entry.characterId === characterId && entry.itemId === itemId);
        operations.push({ type: "item.put", item: {
            itemId,
            characterId,
            name: item.name,
            type: item.type,
            slot: item.slot,
            quantity: (existing?.quantity ?? 0) + item.quantity,
            value: item.value,
            sellable: item.sellable,
            questItem: item.quest_item === true,
            description: item.description,
            imageId: item.image_id
        } });
        return;
    }
    if (type === "grant_outfit") {
        operations.push(...rewardOutfitOperations(context, reward, rewardCharacterId(context, reward, "character_id")));
        return;
    }
    if (type === "equip_outfit") {
        const characterId = rewardCharacterId(context, reward, "character_id");
        const outfitId = text(reward.outfit_id);
        const outfit = context.characterOutfits.find((entry) => entry.characterId === characterId && entry.outfitId === outfitId);

        if (!outfit) {
            warnings.push({
                title: "Outfit Equip Skipped",
                message: `The objective tried to equip outfit ${outfitId || "(missing)"} for ${context.characters[characterId]?.name || characterId}, but that character does not own it.`,
                details: { characterId, outfitId, rewardType: type }
            });
            return;
        }

        operations.push({ type: "equipment.set", record: { characterId, ...equipmentFromOutfit(outfit) } });
        operations.push({ type: "temporary.items.set", record: { characterId, ...blankEquipmentValues() } });
        operations.push({ type: "character.durable.set", characterId, values: { activeOutfitId: outfitId } });
        return;
    }
    if (["delete_outfit", "delete_all_outfits"].includes(type)) {
        const characterId = rewardCharacterId(context, reward, "character_id");
        const outfitId = text(reward.outfit_id);
        const matches = context.characterOutfits.filter((entry) => entry.characterId === characterId && (type === "delete_all_outfits" || entry.outfitId === outfitId));

        if (type === "delete_outfit" && !outfitId)
            throw new Error("delete_outfit requires outfit_id.");

        for (const outfit of matches)
            operations.push({ type: "outfit.delete", characterId, outfitId: outfit.outfitId });

        context.characterOutfits = context.characterOutfits.filter((entry) => !matches.includes(entry));
        const durable = context.characterDurableState.find((entry) => entry.characterId === characterId);

        if (matches.some((entry) => entry.outfitId === durable?.activeOutfitId)) {
            operations.push({ type: "equipment.set", record: { characterId, ...blankEquipmentValues() } });
            operations.push({ type: "temporary.items.set", record: { characterId, ...blankEquipmentValues() } });
            operations.push({ type: "character.durable.set", characterId, values: { activeOutfitId: null } });
        }
        return;
    }
    if (type === "remove_character_shop_listing") {
        const shopId = text(reward.shop_id);
        const characterId = text(reward.character_id);

        if (!shopId || !characterId)
            throw new Error("remove_character_shop_listing requires shop_id and character_id.");

        operations.push({ type: "shop.item.set", shopId, itemId: characterId, values: { removed: true } });
        return;
    }
    if (type === "complete_generated_job") {
        const jobId = text(reward.job_id);

        if (!jobId)
            throw new Error("complete_generated_job requires a generated job id.");

        operations.push({ type: "job.runtime.set", jobId, values: { status: "complete", currentStepId: null } });
        const jobDefinition = context.runtimeJobDefinitions.find((entry) => entry.jobId === jobId)?.definition;

        if (text(jobDefinition?.sourceShopId) && text(jobDefinition?.sourceItemId))
            operations.push({
                type: "shop.item.set",
                shopId: jobDefinition.sourceShopId,
                itemId: jobDefinition.sourceItemId,
                values: { completed: true }
            });
        return;
    }
    if (type === "generate_story_image") {
        const imageId = text(reward.id) || `reward-image-${stableHash(JSON.stringify(reward))}`;
        operations.push({ type: "story.image.put", image: {
            imageId,
            at: new Date().toISOString(),
            favorite: false,
            title: text(reward.title),
            reason: "objective reward",
            model: text(reward.model || context.definition.default_image_model),
            seed: reward.seed ?? null,
            prompt: text(reward.prompt),
            negativePrompt: text(reward.negative_prompt),
            requestOrder: Date.now(),
            requestedAfterMessageId: context.messages.at(-1)?.messageId || null,
            status: "queued",
            hideFromChat: false,
            promptType: "story_reward",
            url: text(reward.url)
        } });
        return;
    }
    if (["generate_profile_image", "generate_solo_normal_image"].includes(type)) {
        const characterId = rewardCharacterId(context, reward, "target");
        const image = reward.image ?? {};
        sharedImageRequests.push({
            kind: type === "generate_profile_image" ? "profile" : "character",
            characterId,
            prompt: text(image.prompt),
            negativePrompt: text(image.negative_prompt),
            model: text(image.model),
            seed: image.seed ?? null,
            url: text(image.url),
            ...(type === "generate_solo_normal_image" && reward.outfit_id
                ? { outfitId: text(reward.outfit_id) }
                : {})
        });
        return;
    }

    throw new Error(`Reward type ${type || "(missing)"} is not supported by the normalized runtime.`);
}

function deterministicOutputs(objective) {
    return objective.next_objectives ?? [];
}

function objectiveOutputTargetId(objective, output) {
    if (!output)
        return undefined;

    return objective.completion_control === "choice" || objective.route_control === "ai"
        ? output.next_objective_id
        : output.objective_id;
}

function transitionGroupsSatisfied(context, targetObjectiveId, pendingObjectiveId, pendingOutputId) {
    const target = objectiveById(
        context.definition,
        context.compiled,
        targetObjectiveId,
        context.runtimeJobDefinitions,
    )?.objective;
    const requiredIds = Array.isArray(target?.requires) ? target.requires : [];
    if (!requiredIds.every((sourceObjectiveId) =>
        sourceObjectiveId === pendingObjectiveId ||
        objectiveRuntimeById(context, sourceObjectiveId)?.status === "complete"
    ))
        return false;
    const groups = context.objectiveCompiled?.incomingTransitionGroupsByObjectiveId?.[targetObjectiveId]
        || context.compiled?.incomingTransitionGroupsByObjectiveId?.[targetObjectiveId];

    if (!groups || !Object.keys(groups).length)
        return true;

    return Object.values(groups).some((group) => {
        const transitionsBySource = new Map();

        for (const transition of group) {
            const alternatives = transitionsBySource.get(transition.sourceObjectiveId) || [];
            alternatives.push(transition.outputId);
            transitionsBySource.set(transition.sourceObjectiveId, alternatives);
        }

        return [...transitionsBySource].every(([sourceObjectiveId, outputIds]) => {
            if (sourceObjectiveId === pendingObjectiveId)
                return outputIds.includes("*") || outputIds.includes(pendingOutputId);

            const runtime = objectiveRuntimeById(context, sourceObjectiveId);
            return runtime?.status === "complete"
                && (outputIds.includes("*") || outputIds.includes(runtime.selectedOutputId));
        });
    });
}

function newlyEligibleRequirementTarget(context, sourceObjectiveId, selectedOutputId) {
    const dependentIds = [
        ...(context.objectiveCompiled?.requirementDependentsByKey?.[`objective:${sourceObjectiveId}`]
            || context.compiled?.requirementDependentsByKey?.[`objective:${sourceObjectiveId}`]
            || []),
        ...(context.objectiveCompiled?.outgoingObjectiveIdsByObjectiveId?.[sourceObjectiveId]
            || context.compiled?.outgoingObjectiveIdsByObjectiveId?.[sourceObjectiveId]
            || []),
    ];

    return dependentIds.find((objectiveId) => {
        const runtime = objectiveRuntimeById(context, objectiveId);
        return runtime?.status !== "complete" && transitionGroupsSatisfied(
            context,
            objectiveId,
            sourceObjectiveId,
            selectedOutputId
        );
    }) || "";
}

function completionDirectiveForOutput(context, objective, output) {
    const lines = [];
    const instruction = context.resolve(
        output?.completion_instruction || objective?.completion_instruction,
    );
    const dialogue = output?.dialogue_lines || objective?.dialogue_lines || [];

    if (instruction)
        lines.push(`Objective completion story instruction: ${instruction}`);
    if (dialogue.length) {
        lines.push("", "DIALOGUE DELIVERY REQUIRED", "Include every required line exactly once, in the listed order. If the lines are not the natural immediate response to the player, respond to the player first and then transition into them. This response may be longer than normal. You may add narration, reactions, demonstrations, or other dialogue between the lines. Do not paraphrase, merge, omit, or alter a required line.", "", "Required dialogue lines:");
        for (const line of dialogue) lines.push(context.resolve(line));
    }
    return lines.join("\n");
}

function planObjectiveTransition(context, objective, output, siteId, extraRewards = []) {
    const selectedOutputId = text(output?.id) || null;
    const operations = [{
        type: "objective.runtime.set",
        objectiveId: objective.id,
        values: { status: "complete", selectedOutputId }
    }];
    const hydration = [];
    const warnings = [];
    const sharedImageRequests = [];
    const rewards = [
        ...(objective.rewards || []),
        ...extraRewards,
        ...(output?.effects || []),
        ...(output?.rewards || [])
    ];

    for (const entry of expandRewards(context, rewards)) {
        const invocationId = `objective-${objective.id}--site-${siteId}--reward-${entry.position}`;

        if (context.rewardInvocations.some((invocation) => invocation.invocationId === invocationId))
            continue;

        planReward(context, entry.reward, operations, hydration, warnings, sharedImageRequests);
        operations.push({ type: "reward.invocation.add", invocation: {
            invocationId,
            appliedAt: new Date().toISOString(),
            sourceType: "objective",
            sourceId: objective.id
        } });
    }

    const targetObjectiveId = text(objectiveOutputTargetId(objective, output));
    const routedObjectiveId = targetObjectiveId && transitionGroupsSatisfied(
        context,
        targetObjectiveId,
        objective.id,
        selectedOutputId
    ) ? targetObjectiveId : "";
    const nextObjectiveId = routedObjectiveId || newlyEligibleRequirementTarget(
        context,
        objective.id,
        selectedOutputId
    );

    if (output?.travel_location_id)
        operations.push({ type: "location.current.set", locationId: text(output.travel_location_id) });

    operations.push({
        type: "objective.control.set",
        values: context.control.focusedSideObjectiveId
            ? { focusedSideObjectiveId: nextObjectiveId || null }
            : { activeMainObjectiveId: nextObjectiveId || null }
    });

    return {
        operations,
        hydration,
        warnings,
        sharedImageRequests,
        nextObjectiveId,
        completionDirective: completionDirectiveForOutput(context, objective, output)
    };
}

function deterministicOutput(context, objective) {
    const outputs = deterministicOutputs(objective).filter((output) => {
        if (!requirementsMet(context, output.requirements))
            return false;
        const targetId = text(output.objective_id);
        return !targetId || objectiveRuntimeById(context, targetId)?.status !== "complete";
    });
    return outputs[0] || null;
}

//#region Timed Events

function objectiveCompleted(context, objectiveId) {
    return objectiveRuntimeById(context, text(objectiveId))?.status === "complete";
}

function timedEventTriggered(context, event) {
    return event?.trigger?.immediately === true || objectiveCompleted(context, event?.trigger?.objective_id);
}

function authoredDurationMinutes(duration, path) {
    if (duration == null || typeof duration !== "object" || Array.isArray(duration))
        throw new Error(`${path} must be a validated duration object.`);
    let total = 0;
    for (const field of Object.keys(duration)) {
        if (!["days", "hours", "minutes"].includes(field))
            throw new Error(`${path}.${field} is not an approved duration field.`);
        if (!Number.isSafeInteger(duration[field]) || duration[field] < 0)
            throw new Error(`${path}.${field} must be a non-negative whole number.`);
    }
    total += (duration.days ?? 0) * 1440;
    total += (duration.hours ?? 0) * 60;
    total += duration.minutes ?? 0;
    if (total <= 0)
        throw new Error(`${path} must contain a positive duration.`);
    return total;
}

function timedEventNotice(context, event, stage = null) {
    if ((stage?.visibility ?? event?.visibility) === "hidden")
        return null;

    const identity = nextMessageIdentity(context, "game");
    const message = {
        ...identity,
        role: "system",
        speaker: "Game",
        text: context.resolve(stage?.message || event?.message || (stage
            ? `${event.title || event.id} has advanced.`
            : `${event.title || event.id} has reached its deadline.`)),
        detail: "timed_event",
        at: new Date().toISOString()
    };
    context.messages.push(message);
    return message;
}

function planTimedEventRewards(context, event, siteId, rewards, result) {
    for (const entry of expandRewards(context, rewards)) {
        const invocationId = `timed-event-${event.id}--site-${siteId}--reward-${entry.position}`;

        if (context.rewardInvocations.some((invocation) => invocation.invocationId === invocationId))
            continue;

        planReward(context, entry.reward, result.operations, result.hydration, result.warnings, result.sharedImageRequests);
        const invocation = {
            invocationId,
            appliedAt: new Date().toISOString(),
            sourceType: "timed-event",
            sourceId: event.id
        };
        result.operations.push({ type: "reward.invocation.add", invocation });
        context.rewardInvocations.push(invocation);
    }
}

async function resolveTimedEvents(message) {
    const context = await loadTurnContext(message.saveId);
    const result = { applied: false, operations: [], messages: [], hydration: [], warnings: [], sharedImageRequests: [] };
    const elapsedNow = context.gameTime?.elapsedMinutes;

    if (!Number.isSafeInteger(elapsedNow) || elapsedNow < 0)
        throw new Error("Persisted gameTime.elapsedMinutes must be a non-negative safe integer.");
    const runtimeById = new Map(context.timedEventRuntime.map((runtime) => [runtime.timedEventId, { ...runtime }]));
    const appliedStageIds = new Set(context.timedEventAppliedStages.map((stage) => `${stage.timedEventId}\u0000${stage.stageId}`));

    for (const event of Object.values(context.definition.state?.timed_events || {})) {
        const eventId = text(event?.id);
        const runtime = runtimeById.get(eventId);

        if (!eventId || !runtime)
            throw new Error(`Timed event ${eventId || "(missing id)"} has no normalized runtime record.`);

        if (runtime.status === "waiting" && timedEventTriggered(context, event)) {
            runtime.status = "active";
            runtime.startElapsedMinutes = elapsedNow;
            result.operations.push({
                type: "timed.event.set",
                timedEventId: eventId,
                values: { status: "active", startElapsedMinutes: elapsedNow }
            });
            result.applied = true;
        }

        if (runtime.status !== "active")
            continue;

        if (text(event.cancel_objective_id) && objectiveCompleted(context, event.cancel_objective_id)) {
            runtime.status = "cancelled";
            result.operations.push({ type: "timed.event.set", timedEventId: eventId, values: { status: "cancelled" } });
            result.applied = true;
            continue;
        }

        if (!Number.isSafeInteger(runtime.startElapsedMinutes) || runtime.startElapsedMinutes < 0)
            throw new Error(`Timed event ${eventId} has invalid persisted startElapsedMinutes.`);
        const elapsed = Math.max(0, elapsedNow - runtime.startElapsedMinutes);

        for (const stage of event.stages || []) {
            const stageId = text(stage?.id);
            const stageKey = `${eventId}\u0000${stageId}`;

            if (!stageId || appliedStageIds.has(stageKey) || elapsed < authoredDurationMinutes(stage.after, `timed_events.${eventId}.stages.${stageId}.after`))
                continue;

            const notice = timedEventNotice(context, event, stage);
            if (notice) result.messages.push(notice);
            planTimedEventRewards(context, event, `stage-${stageId}`, stage.rewards || [], result);
            result.operations.push({ type: "timed.stage.add", timedEventId: eventId, stageId });
            appliedStageIds.add(stageKey);
            result.applied = true;
        }

        const deadline = authoredDurationMinutes(event.time_limit, `timed_events.${eventId}.time_limit`);

        if (!deadline || elapsed < deadline)
            continue;

        const notice = timedEventNotice(context, event);
        if (notice) result.messages.push(notice);
        planTimedEventRewards(context, event, "deadline", event.rewards || [], result);
        result.operations.push({ type: "timed.event.set", timedEventId: eventId, values: { status: "complete" } });
        result.applied = true;
    }

    return result;
}

//#endregion Timed Events

//#region Shops And Generated Jobs

function storyShop(context, shopId) {
    const shop = context.definition.state?.story_shops?.[shopId];

    if (!shop)
        throw new Error(`Shop ${shopId} does not exist in the immutable story definition.`);

    return shop;
}

function shopItemId(shop, item, index) {
    const itemId = item.id;

    if (typeof itemId !== "string" || !itemId)
        throw new Error(`Shop item ${index + 1} is missing its validated stable id.`);

    return itemId;
}

function shopRuntimeRecord(context, shopId) {
    return context.shopRuntime.find((record) => record.shopId === shopId) || null;
}

function shopItemRuntimeRecord(context, shopId, itemId) {
    return context.shopItemRuntime.find((record) => record.shopId === shopId && record.itemId === itemId) || null;
}

function shopIsUnlocked(context, shopId, shop) {
    return shopRuntimeRecord(context, shopId)?.unlocked ?? shop.unlocked !== false;
}

function shopItemPrice(shop, item) {
    if (shop.type === "general")
        return Math.ceil(item.item.value * shop.markup);

    return item.price ?? 0;
}

function shopCurrency(context, shop) {
    const currency = shop.currency;
    const value = storyScalar(context, "story_inventory", currency);

    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`Shop currency story_inventory.${currency} is not a finite number.`);

    return {
        currency,
        value
    };
}

function shopItemTitle(context, shop, item) {
    if (shop.type === "character") {
        const characterId = characterIdFor(context, item.character_id);
        return context.characters[characterId]?.name || characterDefinitionById(context, characterId)?.name || characterId;
    }
    if (shop.type === "clothing")
        return text(item.title || item.outfit?.name);
    return text(item.title || item.item?.name || item.name);
}

function shopViewItem(context, shopId, shop, item, index) {
    const itemId = shopItemId(shop, item, index);
    const runtime = shopItemRuntimeRecord(context, shopId, itemId);
    const removed = runtime?.removed === true;
    const locked = runtime?.locked ?? item.locked === true;
    const requirementsSatisfied = requirementsMet(context, item.requirements);
    const price = shopItemPrice(shop, item);
    const funds = shopCurrency(context, shop).value;
    const repeatable = (item.repeatable ?? shop.repeatable) === true;
    const purchaseMode = text(item.purchase_mode || shop.purchase_mode || "acquire");
    if (runtime?.quantity != null && (typeof runtime.quantity !== "number" || !Number.isFinite(runtime.quantity)))
        throw new Error(`Shop runtime quantity for ${shopId}/${itemId} is not a finite number.`);
    if (runtime?.purchaseCount != null && (!Number.isSafeInteger(runtime.purchaseCount) || runtime.purchaseCount < 0))
        throw new Error(`Shop runtime purchaseCount for ${shopId}/${itemId} is not a non-negative safe integer.`);
    const soldOut = runtime?.quantity != null && runtime.quantity <= 0;
    const alreadyPurchased = (runtime?.purchaseCount ?? 0) > 0 && !repeatable;

    return {
        itemId,
        title: shopItemTitle(context, shop, item),
        summary: text(item.summary || item.item?.description || item.outfit?.memory || item.unlock_reason),
        price,
        currency: shop.currency,
        locked,
        removed,
        requirementsSatisfied,
        affordable: funds >= price,
        available: !removed && !locked && requirementsSatisfied && !soldOut && !alreadyPurchased,
        purchaseCount: runtime?.purchaseCount ?? 0,
        soldOut,
        repeatable,
        purchaseMode,
        accepted: runtime?.accepted === true,
        completed: runtime?.completed === true
    };
}

async function prepareShops(message) {
    const context = await loadTurnContext(message.saveId);
    const eligibleRecipients = Object.values(context.characters)
        .filter((character) => character.characterId === context.header.playerCharacterId || context.partyMembers.some((entry) => entry.characterId === character.characterId))
        .map((character) => ({ characterId: character.characterId, name: character.name }));
    const shops = Object.entries(context.definition.state?.story_shops || {})
        .filter(([shopId, shop]) => shopIsUnlocked(context, shopId, shop))
        .map(([shopId, shop]) => ({
            shopId,
            title: text(shop.title || shopId),
            description: text(shop.description),
            subtype: text(shop.subtype),
            type: text(shop.type),
            currency: shop.currency,
            balance: shopCurrency(context, shop).value,
            purchaseVerb: text(shop.purchase_verb || (shop.type === "job" ? "Accept" : "Buy")),
            recipients: shop.type === "clothing" ? eligibleRecipients : [],
            items: (shop.items || []).map((item, index) => shopViewItem(context, shopId, shop, item, index))
                .filter((item) => !item.removed)
        }));

    return { shops };
}

function purchasedInventoryItem(context, shopId, listingId, item) {
    const ownerId = context.header.playerCharacterId;
    const existing = context.items.find((record) => record.characterId === ownerId && record.itemId === `${shopId}--${listingId}`);
    return {
        itemId: `${shopId}--${listingId}`,
        characterId: ownerId,
        name: item.name,
        type: item.type,
        slot: null,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        value: item.value,
        sellable: item.sellable,
        questItem: item.quest_item,
        description: item.description,
        imageId: item.image_id || null
    };
}

function blankEquipmentValues() {
    return Object.fromEntries(EquipmentSlots.map((slot) => [slot, null]));
}

function purchasedOutfitOperations(context, shopId, listingId, listing, characterId) {
    if (!context.characters[characterId] || (!context.partyMembers.some((entry) => entry.characterId === characterId) && characterId !== context.header.playerCharacterId))
        throw new Error("Clothing can only be purchased for the player or an owned party character.");

    const outfit = listing.outfit;

    if (!outfit || typeof outfit !== "object")
        throw new Error(`Clothing listing ${listingId} has no outfit.`);

    const outfitId = text(outfit.id || `${shopId}--${listingId}`);

    if (context.characterOutfits.some((record) => record.characterId === characterId && record.outfitId === outfitId))
        throw new Error("This character already owns that outfit.");

    const operations = [];
    const slots = blankEquipmentValues();
    const authored = { ...(outfit.clothing || {}), left_hand: outfit.left_hand, right_hand: outfit.right_hand };

    for (const [authoredSlot, descriptionValue] of Object.entries(authored)) {
        const slot = authoredSlot.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const description = text(descriptionValue);

        if (!description || !EquipmentSlots.includes(slot))
            continue;

        const itemId = `${characterId}--${outfitId}--${slot}--${stableHash(description)}`;
        slots[slot] = itemId;
        operations.push({ type: "item.put", item: {
            itemId,
            characterId,
            name: description.slice(0, 100),
            type: ["leftHand", "rightHand"].includes(slot) ? "held item" : "clothing",
            slot: ["leftHand", "rightHand"].includes(slot) ? "hand" : slot,
            quantity: 1,
            value: 0,
            sellable: false,
            questItem: false,
            description,
            imageId: null
        } });
    }

    operations.push({ type: "outfit.put", outfit: {
        characterId,
        outfitId,
        name: text(outfit.name || listing.title || listingId),
        formality: Number(outfit.formality || 0),
        origin: text(outfit.origin),
        memory: text(outfit.memory),
        sourceShopId: shopId,
        sourceOutfitId: text(outfit.id),
        imagePrompt: text(outfit.image_prompt),
        imageId: text(outfit.image_id),
        contexts: Array.isArray(outfit.contexts) ? outfit.contexts.map(text).filter(Boolean) : [],
        ...slots
    } });
    return operations;
}

function generatedJobDefinition(shopId, item) {
    const jobId = `job-${shopId}--${text(item.id)}`;
    const stepId = `${jobId}--work`;
    const rewards = [];

    if (Number(item.reward_coins || 0))
        rewards.push({ type: "adjust_story_inventory", field_path: ["story_inventory", "coins"], operation: "add", amount: Number(item.reward_coins) });
    if (Number(item.reward_xp || 0))
        rewards.push({ type: "adjust_story_inventory", field_path: ["story_inventory", "adventurer_xp"], operation: "add", amount: Number(item.reward_xp) });
    for (const rewardItem of item.reward_items || [])
        rewards.push({ type: "add_story_item", item: rewardItem });
    rewards.push({ type: "complete_generated_job", job_id: jobId });

    return {
        jobId,
        definition: {
            id: jobId,
            title: text(item.title),
            sourceShopId: shopId,
            sourceItemId: text(item.id),
            objectives: [{
                id: stepId,
                title: text(item.title),
                summary: text(item.summary),
                while_active_guidance: text(item.summary),
                completion_control: "player",
                completion_criteria: item.completion_criteria,
                completion_instruction: text(item.completion_instruction),
                completion_requirements: [],
                rewards,
                next_objectives: []
            }]
        },
        compiledIndexes: {
            startingObjectiveId: stepId,
            objectiveIndexById: { [stepId]: 0 },
            incomingTransitionGroupsByObjectiveId: {},
            outgoingObjectiveIdsByObjectiveId: { [stepId]: [] }
        }
    };
}

async function purchaseShopItem(message) {
    const context = await loadTurnContext(message.saveId);
    const shopId = text(message.shopId);
    const itemId = text(message.itemId);
    const shop = storyShop(context, shopId);
    const index = (shop.items || []).findIndex((item, itemIndex) => shopItemId(shop, item, itemIndex) === itemId);

    if (!shopIsUnlocked(context, shopId, shop) || index < 0)
        throw new Error("The selected shop item is not available.");

    const item = shop.items[index];
    const view = shopViewItem(context, shopId, shop, item, index);

    if (!view.available)
        throw new Error("The selected shop item cannot currently be purchased.");

    const operations = [];
    const hydration = [];
    const warnings = [];
    const sharedImageRequests = [];
    const balance = shopCurrency(context, shop);

    if (view.price)
        operations.push(storyValueSetOperation(context, "story_inventory", balance.currency, balance.value - view.price));

    if (shop.type === "character") {
        const characterId = characterIdFor(context, item.character_id);
        const locationId = shop.npc_location_id;

        if (!context.characters[characterId])
            hydration.push({
                characterId,
                ...(locationId ? { locationId } : {}),
                storyId: context.header.storyId,
                revisionId: context.header.revisionId,
                player: { ...context.characters[context.header.playerCharacterId], id: context.header.playerCharacterId },
            });

        if (view.purchaseMode === "service") {
            const partyCharacterIds = new Set([
                context.header.playerCharacterId,
                ...context.partyMembers.map((member) => member.characterId),
            ]);
            for (const member of context.sceneMembers) {
                if (!partyCharacterIds.has(member.characterId))
                    operations.push({ type: "scene.member.remove", characterId: member.characterId });
            }
            operations.push({ type: "future.character.set", characterId, values: { status: "introduced", locationId, lastTriggeredReason: "service purchase" } });
            operations.push({ type: "npc.shell.set", characterId, values: { locationId, status: "alive", inspected: true } });
            operations.push({ type: "scene.member.add", characterId });
        }
        else {
            operations.push({ type: "party.member.add", characterId });
            operations.push({ type: "future.character.set", characterId, values: { status: "promoted", locationId } });
            operations.push({ type: "scene.member.add", characterId });
        }

        if (text(item.on_purchase_objective))
            operations.push({ type: "objective.control.set", values: { activeMainObjectiveId: text(item.on_purchase_objective) } });
    }
    else if (shop.type === "general") {
        operations.push({ type: "item.put", item: purchasedInventoryItem(context, shopId, itemId, item.item) });
        for (const entry of expandRewards(context, item.rewards || []))
            planReward(context, entry.reward, operations, hydration, warnings, sharedImageRequests);
    }
    else if (shop.type === "clothing")
        operations.push(...purchasedOutfitOperations(context, shopId, itemId, item, text(message.characterId || context.header.playerCharacterId)));
    else if (shop.type === "job") {
        const job = generatedJobDefinition(shopId, item);
        operations.push({ type: "job.definition.add", job });
        operations.push({ type: "job.runtime.set", jobId: job.jobId, values: { status: "active", currentStepId: job.compiledIndexes.startingObjectiveId } });
        operations.push({ type: "objective.control.set", values: { focusedSideObjectiveId: job.compiledIndexes.startingObjectiveId } });
    }
    else
        throw new Error(`Unsupported shop type ${shop.type}.`);

    const currentQuantity = typeof item.quantity === "number"
        ? (shopItemRuntimeRecord(context, shopId, itemId)?.quantity ?? item.quantity) - 1
        : null;
    const runtimeValues = {
        quantity: currentQuantity,
        purchaseCount: view.purchaseCount + 1
    };

    if (shop.type === "job")
        runtimeValues.accepted = true;

    operations.push({ type: "shop.item.set", shopId, itemId, values: runtimeValues });

    return { operations, hydration, warnings, sharedImageRequests, message: `${view.title} ${shop.type === "job" ? "accepted" : "purchased"}.` };
}

//#endregion Shops And Generated Jobs

//#region Gameplay Views And Commands

async function prepareCharacters(message) {
    const context = await loadTurnContext(message.saveId);
    const party = new Set(context.partyMembers.map((entry) => entry.characterId));
    const present = new Set(context.sceneMembers.map((entry) => entry.characterId));
    const itemsById = new Map(context.items.map((item) => [`${item.characterId}:${item.itemId}`, item]));

    return {
        characters: Object.values(context.characters).map((character) => {
            const relationship = context.characterRelationships.find((entry) => entry.characterId === character.characterId) || {};
            const durable = context.characterDurableState.find((entry) => entry.characterId === character.characterId) || {};
            const scene = context.characterSceneState.find((entry) => entry.characterId === character.characterId) || {};
            const equipped = context.equippedItems.find((entry) => entry.characterId === character.characterId) || {};
            const appearance = context.characterAppearance.find((entry) => entry.characterId === character.characterId) || {};
            const settings = context.characterSettings.find((entry) => entry.characterId === character.characterId) || {};
            const temporary = context.temporaryRemovedItems.find((entry) => entry.characterId === character.characterId) || {};
            const characterItems = context.items.filter((item) => item.characterId === character.characterId);
            const item = (itemId) => itemsById.get(`${character.characterId}:${itemId}`) || null;
            return {
                characterId: character.characterId,
                name: character.name,
                role: durable.role || "",
                relationshipToPlayer: durable.relationshipToPlayer || "",
                trust: relationship.trust || 0,
                attraction: relationship.attraction || 0,
                affection: relationship.affection || 0,
                stateOfMind: scene.stateOfMind || "",
                physicalState: scene.physicalState || "",
                pose: scene.pose || "",
                party: party.has(character.characterId),
                present: present.has(character.characterId),
                player: character.characterId === context.header.playerCharacterId,
                activeOutfitId: durable.activeOutfitId || null,
                gender: character.gender || "",
                age: character.age,
                canDie: character.canDie === true,
                appearance,
                voice: settings.voice || "",
                imageSeedEnabled: settings.imageSeedEnabled === true,
                imageSeed: settings.imageSeed || 0,
                profileModelOverride: settings.profileModelOverride || "",
                outfits: context.characterOutfits.filter((outfit) => outfit.characterId === character.characterId).map(({ outfitId, name }) => ({ outfitId, name })),
                items: characterItems.map(({ itemId, name, description, slot }) => ({ itemId, name, description, slot })),
                stats: context.characterStats.filter((entry) => entry.characterId === character.characterId).map(({ statId, value }) => ({ statId, value })),
                facts: context.characterFacts.filter((entry) => entry.characterId === character.characterId).map(({ factId, text: factText }) => ({ factId, text: factText })),
                equipped: Object.fromEntries(EquipmentSlots.map((slot) => [slot, item(equipped[slot])?.description || item(equipped[slot])?.name || null])),
                equippedItemIds: Object.fromEntries(EquipmentSlots.map((slot) => [slot, equipped[slot] || null])),
                temporarilyRemoved: Object.fromEntries(EquipmentSlots.map((slot) => [slot, item(temporary[slot])?.description || item(temporary[slot])?.name || null]))
            };
        })
    };
}

function inventoryItemView(item, equippedByCharacter) {
    const equippedSlots = Object.entries(equippedByCharacter.get(item.characterId) || {})
        .filter(([, itemId]) => itemId === item.itemId)
        .map(([slot]) => slot);

    return {
        itemId: item.itemId,
        characterId: item.characterId,
        name: item.name,
        type: item.type,
        slot: item.slot,
        quantity: item.quantity,
        value: item.value,
        sellable: item.sellable,
        questItem: item.questItem,
        description: item.description,
        imageId: item.imageId || null,
        equippedSlots
    };
}

async function prepareInventory(message) {
    const context = await loadTurnContext(message.saveId);
    const equippedByCharacter = new Map(context.equippedItems.map((record) => [record.characterId, record]));
    const owners = Object.values(context.characters).map((character) => ({
        characterId: character.characterId,
        name: character.name,
        player: character.characterId === context.header.playerCharacterId,
        party: context.partyMembers.some((entry) => entry.characterId === character.characterId)
    }));

    return {
        owners,
        items: context.items.map((item) => inventoryItemView(item, equippedByCharacter)),
        storyValues: context.storyValues
            .filter((entry) => entry.root === "story_inventory")
            .map(({ pathKey, value }) => ({ pathKey, value }))
    };
}

function unequipItemOperations(context, item) {
    const equipped = equipmentRecord(item.characterId, context.equippedItems.find((entry) => entry.characterId === item.characterId));
    const temporary = equipmentRecord(item.characterId, context.temporaryRemovedItems.find((entry) => entry.characterId === item.characterId));
    let equippedChanged = false;
    let temporaryChanged = false;

    for (const slot of EquipmentSlots) {
        if (equipped[slot] === item.itemId) {
            equipped[slot] = null;
            equippedChanged = true;
        }
        if (temporary[slot] === item.itemId) {
            temporary[slot] = null;
            temporaryChanged = true;
        }
    }

    return [
        ...(equippedChanged ? [{ type: "equipment.set", record: equipped }] : []),
        ...(temporaryChanged ? [{ type: "temporary.items.set", record: temporary }] : [])
    ];
}

async function applyInventoryCommand(message) {
    const context = await loadTurnContext(message.saveId);
    const command = text(message.command);
    const characterId = text(message.characterId) || context.header.playerCharacterId;

    if (!context.characters[characterId])
        throw new Error("The selected inventory owner does not exist in this save.");

    const existing = context.items.find((entry) => entry.itemId === text(message.itemId));
    const operations = [];

    if (command === "put") {
        const itemId = text(message.itemId) || `${characterId}--item-${stableHash(`${Date.now()}:${text(message.name)}`)}`;
        const slot = message.slot == null || text(message.slot) === "" ? null : text(message.slot);
        const validSlot = slot == null || slot === "hand" || EquipmentSlots.includes(slot);

        if (!text(message.name))
            throw new Error("Inventory item name is required.");
        if (!validSlot)
            throw new Error(`Inventory item slot ${slot} is invalid.`);
        if (existing && existing.characterId !== characterId)
            throw new Error("An inventory item cannot be moved to another character by editing it.");

        operations.push({ type: "item.put", item: {
            itemId,
            characterId,
            name: text(message.name),
            type: text(message.itemType) || "item",
            slot,
            quantity: Math.max(1, Math.floor(Number(message.quantity) || 1)),
            value: Math.max(0, Number(message.value) || 0),
            sellable: message.sellable !== false,
            questItem: message.questItem === true,
            description: text(message.description || message.name),
            imageId: message.imageId ? text(message.imageId) : null
        } });
    }
    else if (command === "delete") {
        if (!existing || existing.characterId !== characterId)
            throw new Error("The selected inventory item does not exist for this character.");
        if (existing.questItem)
            throw new Error("Quest items cannot be deleted.");

        operations.push(...unequipItemOperations(context, existing));
        operations.push({ type: "item.delete", itemId: existing.itemId });
    }
    else if (command === "sell") {
        if (!existing || existing.characterId !== characterId)
            throw new Error("The selected inventory item does not exist for this character.");
        if (!existing.sellable || existing.questItem)
            throw new Error("The selected inventory item cannot be sold.");

        const quantity = Math.max(1, Number(existing.quantity) || 1);
        const sellQuantity = Math.min(quantity, Math.max(1, Math.floor(Number(message.quantity) || 1)));
        const coins = Number(storyScalar(context, "story_inventory", "coins") || 0);
        operations.push({ type: "story.value.set", record: {
            root: "story_inventory",
            pathKey: "coins",
            value: coins + Math.max(0, Number(existing.value) || 0) * sellQuantity
        } });

        if (sellQuantity < quantity)
            operations.push({ type: "item.put", item: { ...existing, quantity: quantity - sellQuantity } });
        else {
            operations.push(...unequipItemOperations(context, existing));
            operations.push({ type: "item.delete", itemId: existing.itemId });
        }
    }
    else if (command === "equip") {
        if (!existing || existing.characterId !== characterId)
            throw new Error("The selected inventory item does not exist for this character.");

        const slot = text(message.slot);
        if (!EquipmentSlots.includes(slot))
            throw new Error(`Equipment slot ${slot} is invalid.`);
        if (existing.slot !== slot && !(existing.slot === "hand" && ["leftHand", "rightHand"].includes(slot)))
            throw new Error(`${existing.name} cannot be equipped in ${slot}.`);

        const equipped = equipmentRecord(characterId, context.equippedItems.find((entry) => entry.characterId === characterId));
        const temporary = equipmentRecord(characterId, context.temporaryRemovedItems.find((entry) => entry.characterId === characterId));
        equipped[slot] = existing.itemId;
        temporary[slot] = null;
        operations.push({ type: "equipment.set", record: equipped });
        operations.push({ type: "temporary.items.set", record: temporary });
    }
    else
        throw new Error(`Unsupported inventory command ${command}.`);

    return { operations };
}

async function applyCharacterCommand(message) {
    const context = await loadTurnContext(message.saveId);
    const characterId = text(message.characterId);

    if (!context.characters[characterId])
        throw new Error("The selected character does not exist in this save.");

    const operations = [];
    const command = text(message.command);

    if (command === "relationship") {
        const values = {};
        for (const field of ["trust", "attraction", "affection"]) {
            if (message.values?.[field] != null)
                values[field] = exactStateScale(
                    message.values[field],
                    `turn.character.command.values.${field}`,
                );
        }
        operations.push({ type: "character.relationship.set", characterId, values });
    }
    else if (command === "presence")
        operations.push({ type: message.present === true ? "scene.member.add" : "scene.member.remove", characterId });
    else if (command === "outfit") {
        operations.push(...characterOutfitOperations(context, characterId, text(message.outfitId)));
    }
    else if (command === "restore-clothing") {
        const equipped = equipmentRecord(characterId, context.equippedItems.find((entry) => entry.characterId === characterId));
        const temporary = equipmentRecord(characterId, context.temporaryRemovedItems.find((entry) => entry.characterId === characterId));

        for (const slot of EquipmentSlots) {
            if (temporary[slot])
                equipped[slot] = temporary[slot];

            temporary[slot] = null;
        }

        operations.push({ type: "equipment.set", record: equipped });
        operations.push({ type: "temporary.items.set", record: temporary });
    }
    else if (command === "voice")
        operations.push({ type: "character.settings.set", characterId, values: { voice: text(message.voice) } });
    else if (command === "scene-state") {
        const values = {};

        for (const field of ["stateOfMind", "physicalState", "pose"]) {
            if (message.values?.[field] != null)
                values[field] = text(message.values[field]).slice(0, 1000);
        }

        operations.push({ type: "character.scene.set", characterId, values });
    }
    else if (command === "durable") {
        const values = {};

        for (const field of ["role", "relationshipToPlayer"]) {
            if (message.values?.[field] != null)
                values[field] = text(message.values[field]).slice(0, 2000);
        }

        operations.push({ type: "character.durable.set", characterId, values });
    }
    else if (command === "equip-item") {
        const slot = text(message.slot);
        const itemId = text(message.itemId);
        const item = context.items.find((entry) => entry.characterId === characterId && entry.itemId === itemId);

        if (!EquipmentSlots.includes(slot))
            throw new Error(`Equipment slot ${slot} is invalid.`);
        if (itemId && !item)
            throw new Error(`Equipment item ${itemId} does not exist for this character.`);
        if (item && item.slot !== slot && !(item.slot === "hand" && ["leftHand", "rightHand"].includes(slot)))
            throw new Error(`${item.name || itemId} cannot be equipped in ${slot}.`);

        const equipped = equipmentRecord(characterId, context.equippedItems.find((entry) => entry.characterId === characterId));
        const temporary = equipmentRecord(characterId, context.temporaryRemovedItems.find((entry) => entry.characterId === characterId));
        equipped[slot] = itemId || null;
        temporary[slot] = null;
        operations.push({ type: "equipment.set", record: equipped });
        operations.push({ type: "temporary.items.set", record: temporary });
    }
    else
        throw new Error(`Unsupported character command ${command}.`);

    return { operations };
}

async function prepareMap(message) {
    const context = await loadTurnContext(message.saveId);
    const runtimeById = Object.fromEntries(context.locationRuntime.map((record) => [record.locationId, record]));
    const authoredLocations = Object.entries(context.definition.state?.world_map?.locations || {}).map(([locationId, location]) => ({
        locationId,
        name: text(location.name || locationId),
        type: text(location.type),
        scale: text(location.scale),
        parentId: text(location.parent_id),
        summary: text(location.summary),
        discovered: runtimeById[locationId]?.discovered ?? location.discovered === true,
        travelEnabled: runtimeById[locationId]?.travelEnabled ?? location.travel_enabled === true,
        current: context.currentLocation?.locationId === locationId,
        runtime: false,
        x: Number(location.x || 0),
        y: Number(location.y || 0)
    }));
    const generatedLocations = context.runtimeLocationDefinitions.map((location) => ({
        locationId: location.locationId,
        name: location.name,
        type: location.type,
        scale: location.scale,
        parentId: location.parentId || "",
        summary: location.summary,
        discovered: runtimeById[location.locationId]?.discovered === true,
        travelEnabled: runtimeById[location.locationId]?.travelEnabled === true,
        current: context.currentLocation?.locationId === location.locationId,
        runtime: true,
        x: location.x,
        y: location.y
    }));
    const locations = [...authoredLocations, ...generatedLocations];
    const authoredConnectionPairs = authoredLocations.flatMap((location) => {
        const definition = context.definition.state?.world_map?.locations?.[location.locationId] || {};
        return (definition.connections || []).map((toLocationId) => ({ fromLocationId: location.locationId, toLocationId: text(toLocationId), present: true }));
    });
    const connectionByPair = new Map(authoredConnectionPairs.map((entry) => [`${entry.fromLocationId}:${entry.toLocationId}`, entry]));
    for (const entry of context.locationConnections)
        connectionByPair.set(`${entry.fromLocationId}:${entry.toLocationId}`, entry);

    return {
        locations,
        connections: Array.from(connectionByPair.values()).filter((entry) => entry.present === true),
        npcMembership: context.npcShells.filter((entry) => entry.status !== "dead").map(({ characterId, locationId }) => ({ characterId, locationId })),
        characters: context.npcShells.filter((entry) => entry.status !== "dead").map((shell) => ({
            characterId: shell.characterId,
            name: context.characters[shell.characterId]?.name || shell.name || shell.playerFacingLabel || shell.characterId,
            locationId: shell.locationId
        }))
    };
}

async function travelToLocation(message) {
    const context = await loadTurnContext(message.saveId);
    const locationId = text(message.locationId);
    const location = context.definition.state?.world_map?.locations?.[locationId] || context.runtimeLocationDefinitions.find((entry) => entry.locationId === locationId);
    const runtime = context.locationRuntime.find((record) => record.locationId === locationId);

    if (!location || !(runtime?.travelEnabled ?? location.travel_enabled === true))
        throw new Error("The selected location is not available for travel.");

    return { operations: [{ type: "location.current.set", locationId }] };
}

async function applyMapCommand(message) {
    const context = await loadTurnContext(message.saveId);
    const command = text(message.command);
    const locationId = text(message.locationId);
    const authored = context.definition.state?.world_map?.locations?.[locationId];
    const generated = context.runtimeLocationDefinitions.find((entry) => entry.locationId === locationId);
    const exists = authored || generated;

    if (command === "put") {
        const id = locationId || `loc-runtime-${stableHash(`${Date.now()}:${text(message.name)}`)}`;
        if (!text(message.name) || !text(message.locationType) || !text(message.scale) || !text(message.summary))
            throw new Error("Runtime locations require a name, type, scale, and summary.");
        if (authored)
            throw new Error("Authored location definitions are immutable during play.");
        if (message.parentId && !context.definition.state?.world_map?.locations?.[text(message.parentId)] && !context.runtimeLocationDefinitions.some((entry) => entry.locationId === text(message.parentId)))
            throw new Error("The selected parent location does not exist.");

        return { operations: [
            { type: "location.definition.put", location: {
                locationId: id,
                name: text(message.name),
                type: text(message.locationType),
                scale: text(message.scale),
                parentId: text(message.parentId) || null,
                x: Number(message.x) || 0,
                y: Number(message.y) || 0,
                summary: text(message.summary)
            } },
            { type: "location.runtime.put", locationId: id, values: {
                discovered: message.discovered === true,
                travelEnabled: message.travelEnabled === true
            } }
        ] };
    }
    if (!exists)
        throw new Error("The selected location does not exist.");
    if (command === "runtime")
        return { operations: [{ type: "location.runtime.set", locationId, values: {
            ...(message.discovered != null ? { discovered: message.discovered === true } : {}),
            ...(message.travelEnabled != null ? { travelEnabled: message.travelEnabled === true } : {})
        } }] };
    if (command === "connection") {
        const toLocationId = text(message.toLocationId);
        if (!toLocationId || (!context.definition.state?.world_map?.locations?.[toLocationId] && !context.runtimeLocationDefinitions.some((entry) => entry.locationId === toLocationId)))
            throw new Error("The destination location does not exist.");
        return { operations: [{ type: "location.connection.set", fromLocationId: locationId, toLocationId, present: message.present === true }] };
    }
    if (command === "npc") {
        const characterId = text(message.characterId);
        const shell = context.npcShells.find((entry) => entry.characterId === characterId);
        if (!shell)
            throw new Error("The selected location NPC does not exist.");
        if (message.present !== true)
            throw new Error("NPCs must be moved to another location rather than removed from location storage.");
        return { operations: [{ type: "npc.shell.set", characterId, values: { locationId } }] };
    }
    if (command === "delete") {
        if (!generated)
            throw new Error("Authored locations cannot be deleted during play.");
        if (context.currentLocation?.locationId === locationId)
            throw new Error("The current location cannot be deleted.");
        const operations = context.locationConnections
            .filter((entry) => entry.fromLocationId === locationId || entry.toLocationId === locationId)
            .map((entry) => ({ type: "location.connection.set", fromLocationId: entry.fromLocationId, toLocationId: entry.toLocationId, present: false }));
        operations.push({ type: "location.definition.delete", locationId });
        operations.push({ type: "location.runtime.delete", locationId });
        return { operations };
    }
    throw new Error(`Unsupported map command ${command}.`);
}







async function prepareRuntimeState(message) {
    const context = await loadTurnContext(message.saveId);
    const requirementState = objectiveRequirementState(context);
    return {
        header: context.header,
        objective: context.objective ? {
            id: context.objective.id,
            title: context.resolve(context.objective.title),
            summary: context.resolve(context.objective.summary),
            control: objectiveControl(context.objective),
            blocked: requirementState.blocked,
            unmetRequirements: requirementState.unmet
        } : null,
        scene: context.sceneRuntime,
        location: context.currentLocation,
        time: context.gameTime,
        storyValues: context.storyValues,
        storyLists: context.storyListItems,
        party: context.partyMembers.map((entry) => entry.characterId),
        sceneMembers: context.sceneMembers.map((entry) => entry.characterId)
    };
}

async function applyRuntimeStateCommand(message) {
    const context = await loadTurnContext(message.saveId);
    const command = text(message.command);
    const operations = [];

    if (command === "scene") {
        const values = {};
        const source = message.values || {};

        if (source.summary != null) {
            if (typeof source.summary !== "string")
                throw new Error("turn.runtime-state.command.values.summary must be text.");
            values.summary = source.summary.slice(0, 4000);
        }
        if (source.imageAction != null) {
            if (typeof source.imageAction !== "string")
                throw new Error("turn.runtime-state.command.values.imageAction must be text.");
            values.imageAction = source.imageAction.slice(0, 2000);
        }


        operations.push({ type: "scene.runtime.set", values });
    }
    else if (command === "location") {
        const locationId = text(message.locationId);
        const authored = context.compiled?.locationById?.[locationId];
        const runtime = context.runtimeLocationDefinitions.some((entry) => entry.locationId === locationId);

        if (!locationId || (!authored && !runtime))
            throw new Error("The selected current location does not exist.");

        operations.push({ type: "location.current.set", locationId });
    }
    else if (command === "time") {
        const values = {};

        for (const field of ["year", "month", "day", "hour", "minute", "elapsedMinutes"]) {
            if (message.values?.[field] == null)
                continue;

            values[field] = exactNonnegativeInteger(
                message.values[field],
                `turn.runtime-state.command.values.${field}`,
            );
        }

        operations.push({ type: "time.set", values });
    }
    else if (command === "story-value") {
        const root = text(message.root);
        const pathKey = text(message.pathKey);

        if (!["story_inventory", "world_flags", "progression"].includes(root) || !pathKey)
            throw new Error("Story value root and path are required.");

        if (message.remove === true)
            operations.push({ type: "story.value.delete", root, pathKey });
        else {
            const value = message.value;

            if (value != null && !["string", "number", "boolean"].includes(typeof value))
                throw new Error("A story value must be a string, number, boolean, or null.");

            operations.push({ type: "story.value.set", record: { root, pathKey, value } });
        }
    }
    else if (["scene-member", "party-member"].includes(command)) {
        const characterId = text(message.characterId);

        if (!context.characters[characterId])
            throw new Error("The selected character does not exist in this save.");

        const prefix = command === "scene-member" ? "scene.member" : "party.member";
        operations.push({ type: `${prefix}.${message.present === true ? "add" : "remove"}`, characterId });
    }
    else
        throw new Error(`Unsupported runtime-state command ${command}.`);

    return { operations };
}

//#endregion Gameplay Views And Commands

//#endregion Objective Runtime And Rewards




//#region Objective Decisions

function parseCompactDecision(raw) {
    const source = text(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;

    try {
        parsed = JSON.parse(source);
    }
    catch {
        throw new Error("Objective verifier returned malformed compact JSON.");
    }

    if (typeof parsed.c !== "boolean")
        throw new Error("Objective verifier response requires boolean c.");

    return { complete: parsed.c, progress: text(parsed.p).slice(0, 500) };
}

function parseStateOperations(raw, context) {
    const source = text(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;

    try {
        parsed = JSON.parse(source);
    }
    catch {
        throw new Error("State updater returned malformed compact JSON.");
    }

    if (!Array.isArray(parsed?.ops) || parsed.ops.length > 100)
        throw new Error("State updater response requires an ops array with at most 100 operations.");

    const operations = [];
    const characterIds = new Set(Object.keys(context.characters));
    const finiteRelationshipValues = (values) => {
        assertAiStateValueFields(values, ["trust", "attraction", "affection"], "relationship");
        const output = {};



        for (const field of ["trust", "attraction", "affection"]) {
            if (values?.[field] == null)
                continue;

            const value = Number(values[field]);

            if (!Number.isFinite(value) || value < 0 || value > 10)
                throw new Error(`State updater ${field} must be from 0 through 10.`);

            output[field] = value;
        }

        return output;
    };

    for (const rawOperation of parsed.ops) {
        const type = text(rawOperation?.t);

        if (type === "scene") {
            const values = {};
            assertAiStateValueFields(rawOperation.v, ["summary", "imageAction"], "scene");



            if (rawOperation.v?.summary != null)
                values.summary = text(rawOperation.v.summary).slice(0, 4000);
            if (rawOperation.v?.imageAction != null)
                values.imageAction = text(rawOperation.v.imageAction).slice(0, 2000);

            if (Object.keys(values).length)
                operations.push({ type: "scene.runtime.set", values });
        }
        else if (type === "relationship") {
            const characterId = text(rawOperation.id);

            if (!characterIds.has(characterId))
                throw new Error(`State updater referenced unknown character ${characterId}.`);

            const values = finiteRelationshipValues(rawOperation.v);

            if (Object.keys(values).length)
                operations.push({ type: "character.relationship.set", characterId, values });
        }
        else if (type === "character") {
            const characterId = text(rawOperation.id);
            if (!characterIds.has(characterId))
                throw new Error(`State updater referenced unknown character ${characterId}.`);
            const change = rawOperation.v;
            if (!change || typeof change !== "object" || Array.isArray(change))
                throw new Error(`State updater character ${characterId} values must be an object.`);
            const allowedFields = ["stateOfMind", "physicalState", "pose", "outfitId"];
            for (const field of Object.keys(change))
                if (!allowedFields.includes(field))
                    throw new Error(`State updater character ${characterId}.${field} is not an approved field.`);
            const values = {};
            for (const field of ["stateOfMind", "physicalState", "pose"]) {
                if (!Object.hasOwn(change, field)) continue;
                if (typeof change[field] !== "string")
                    throw new Error(`State updater character ${characterId}.${field} must be text.`);
                values[field] = change[field];
            }
            if (Object.keys(values).length)
                operations.push({type:"character.scene.set", characterId, values});
            if (Object.hasOwn(change, "outfitId")) {
                if (typeof change.outfitId !== "string" || !change.outfitId)
                    throw new Error(`State updater character ${characterId}.outfitId must be non-empty text.`);
                operations.push(...characterOutfitOperations(context, characterId, change.outfitId));
            }
        }
        else if (type === "value") {
            const root = text(rawOperation.root);
            const fieldPathKey = text(rawOperation.path);

            if (!["story_inventory", "world_flags", "progression"].includes(root) || !fieldPathKey)
                throw new Error("State updater story value root or path is invalid.");
            if (rawOperation.v != null && !["string", "number", "boolean"].includes(typeof rawOperation.v))
                throw new Error("State updater story value must be a scalar or null.");
            if (typeof rawOperation.v === "string" && rawOperation.v.length > 20000)
                throw new Error("State updater story value is too large.");

            operations.push({
                type: "story.value.set",
                record: { root, pathKey: fieldPathKey, value: rawOperation.v }
            });
        }
        else if (["member_add", "member_remove"].includes(type)) {
            const characterId = text(rawOperation.id);

            if (!characterIds.has(characterId))
                throw new Error(`State updater referenced unknown scene member ${characterId}.`);

            operations.push({ type: type === "member_add" ? "scene.member.add" : "scene.member.remove", characterId });
        }
        else if (type === "location") {
            const locationId = text(rawOperation.id);

            if (!context.compiled?.locationById?.[locationId])
                throw new Error(`State updater referenced unknown location ${locationId}.`);

            operations.push({ type: "location.current.set", locationId });
        }
        else if (type === "time") {
            const values = {};
            assertAiStateValueFields(rawOperation.v, ["year", "month", "day", "hour", "minute", "elapsedMinutes"], "time");

            for (const field of ["year", "month", "day", "hour", "minute", "elapsedMinutes"]) {
                if (rawOperation.v?.[field] == null)
                    continue;

                const value = Number(rawOperation.v[field]);

                if (!Number.isFinite(value))
                    throw new Error(`State updater time ${field} must be finite.`);

                values[field] = value;
            }

            if (Object.keys(values).length)
                operations.push({ type: "time.set", values });
        }
        else {
            throw new Error(`State updater operation ${type || "(missing)"} is not allowed.`);
        }
    }

    return operations;
}

//#region Equipment

function assertAiStateValueFields(values, allowedFields, path) {
    if (!values || typeof values !== "object" || Array.isArray(values))
        throw new Error(`State updater ${path} values must be an object.`);
    for (const field of Object.keys(values))
        if (!allowedFields.includes(field))
            throw new Error(`State updater ${path}.${field} is not an approved field.`);
}

const EquipmentSlots = Object.freeze([
    "hat", "hairAccessory", "face", "ears", "neck", "shoulders", "bra", "undershirt", "shirt",
    "overShirt", "coat", "back", "hands", "rightWrist", "leftWrist", "rightFingers", "leftFingers",
    "waist", "beltAccessory", "underwear", "pants", "skirt", "legwear", "socks", "feet",
    "otherAccessory", "leftHand", "rightHand"
]);

function equipmentRecord(characterId, source = {}) {
    const record = { characterId };

    for (const slot of EquipmentSlots)
        record[slot] = source?.[slot] || null;

    return record;
}

function characterOutfitOperations(context, characterId, outfitId) {
    const outfit = context.characterOutfits.find(entry => entry.characterId === characterId && entry.outfitId === outfitId);
    if (!outfit)
        throw new Error(`Outfit ${outfitId} does not exist for character ${characterId}.`);
    return [
        {type:"equipment.set", record:equipmentRecord(characterId, outfit)},
        {type:"temporary.items.set", record:equipmentRecord(characterId)},
        {type:"character.durable.set", characterId, values:{activeOutfitId:outfitId}},
    ];
}

function sceneCharacterIds(context) {
    return [...new Set([context.header.playerCharacterId, ...context.sceneMembers.map(entry => entry.characterId)])]
        .filter(characterId => Object.hasOwn(context.characters, characterId));
}





function parseJsonObject(raw, label) {
    const source = text(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    try {
        const parsed = JSON.parse(source);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error();
        return parsed;
    }
    catch {
        throw new Error(`${label} returned malformed compact JSON.`);
    }
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}





//#endregion State And Equipment




//#region Image Prompts

function imageCharacterDescription(context, characterId) {
    const character = context.characters[characterId];
    const appearance = context.characterAppearance.find((entry) => entry.characterId === characterId) || {};
    const equipped = context.equippedItems.find((entry) => entry.characterId === characterId);
    const itemById = new Map(context.items.filter((item) => item.characterId === characterId).map((item) => [item.itemId, item]));
    const clothing = EquipmentSlots
        .map((slot) => equipped?.[slot] ? itemById.get(equipped[slot])?.description || itemById.get(equipped[slot])?.name : "")
        .filter(Boolean);

    return [
        character?.name,
        appearance.species,
        `${character?.age || "adult"} year old ${character?.gender || "person"}`,
        appearance.extraDescription,
        workerPresentationOnlyExtraDescription(character, appearance),
        clothing.length ? `wearing ${clothing.join(", ")}` : "not wearing clothing"
    ].filter(Boolean).join(", ");
}

function workerPresentationOnlyExtraDescription(character = {}, appearance = {}) {
    const gender = String(character?.gender || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, " ")
        .replace(/\s+/g, " ");
    return gender === "male" || gender === "trans male"
        ? appearance.maleOnlyExtraDescription
        : appearance.nonMaleOnlyExtraDescription;
}

function prepareImageRequest(context, reason) {
    const characterIds = sceneCharacterIds(context).slice(0, 8);
    const imageId = `story-image-${Date.now()}-${stableHash(`${context.saveId}:${context.messages.at(-1)?.messageId || "opening"}:${reason}`)}`;
    const prompt = [
        context.sceneRuntime?.imageAction || context.sceneRuntime?.summary || "A story scene",
        ...characterIds.map((characterId) => imageCharacterDescription(context, characterId)),
        context.currentLocation?.locationId ? `location ${context.currentLocation.locationId}` : "",
        "high quality story illustration, coherent anatomy, clear composition",
        "suitable for a general audience, characters wearing full-coverage outer clothing"
    ].filter(Boolean).join(". ");
    const negativePrompt = "text, watermark, logo, duplicate people, malformed anatomy, extra limbs, blurry, low quality";
    const image = {
        imageId,
        at: new Date().toISOString(),
        favorite: false,
        title: "Story Scene",
        reason: text(reason) || "manual scene image",
        model: text(context.definition.default_image_model) || "game-art",
        seed: null,
        prompt,
        negativePrompt,
        requestOrder: Date.now(),
        requestedAfterMessageId: context.messages.at(-1)?.messageId || "",
        status: "queued",
        hideFromChat: false,
        promptType: "story",
        url: ""
    };

    return { image, characterIds };
}

async function prepareImage(message) {
    const context = await loadTurnContext(message.saveId);
    return prepareImageRequest(context, message.reason);
}

//#endregion Image Prompts

function nextObjectiveId(context) {
    const outgoing = Array.isArray(context.objective?.next_objectives)
        ? context.objective.next_objectives
        : [];
    const ids = [...new Set(outgoing.map((value) => text(typeof value === "string" ? value : value?.objective_id)).filter(Boolean))];

    return ids.length === 1 ? ids[0] : null;
}

async function resolveObjectiveDecision(message) {
    const context = await loadTurnContext(message.saveId);
    const decision = parseCompactDecision(message.raw);
    let operations = [];
    let hydration = [];
    let directive = "";
    let routePrompt = "";

    if (decision.complete && context.objective) {
        if (!requirementsMet(context, context.objective.completion_requirements)) {
            decision.complete = false;
            decision.progress ||= "The objective cannot complete until its completion requirements are met.";
        }
        else if (context.objective.route_control === "ai" && Array.isArray(context.objective.outcome_routes) && context.objective.outcome_routes.length) {
            const routes = context.objective.outcome_routes.filter((route) => requirementsMet(context, route.requirements));
            const normalRoutes = routes.filter((route) => route.fallback !== true);
            const available = normalRoutes.length ? normalRoutes : routes.filter((route) => route.fallback === true);

            if (!available.length)
                throw new Error(`Objective ${context.objective.id} completed with no eligible outcome route.`);

            routePrompt = [
                "Choose the completed objective's outcome route from the story that actually occurred.",
                "Return ONLY compact JSON: {\"r\":\"route-id\"}",
                "Do not invent a route.",
                ...available.map((route) => `${route.id}: ${context.resolve(route.criteria)}`),
                "Recent story messages:",
                chatText(context.messages.slice(-10))
            ].join("\n\n");
        }
        else {
            const output = deterministicOutput(context, context.objective);
            const planned = planObjectiveTransition(context, context.objective, output, output?.id || "default");
            operations = planned.operations;
            hydration = planned.hydration;
            directive = planned.completionDirective;
        }
    }

    if (!decision.complete && decision.progress && context.objective) {
        operations.push({
            type: "objective.progress.add",
            note: {
                objectiveId: context.objective.id,
                noteId: `note-${Date.now()}`,
                sequence: Date.now(),
                text: decision.progress
            }
        });
    }

    return {
        objectiveId: context.objective?.id || "",
        complete: decision.complete,
        progress: decision.progress,
        completionDirective: directive || completionDirective(context, decision.complete && !routePrompt),
        routePrompt,
        hydration,
        operations
    };
}

function parseRouteChoice(raw) {
    const source = text(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    let parsed;

    try { parsed = JSON.parse(source); }
    catch { throw new Error("Objective route selector returned malformed compact JSON."); }

    const routeId = text(parsed?.r);

    if (!routeId)
        throw new Error("Objective route selector requires route id r.");

    return routeId;
}

async function resolveObjectiveRoute(message) {
    const context = await loadTurnContext(message.saveId);
    const routeId = parseRouteChoice(message.raw);
    const route = (context.objective?.outcome_routes || []).find((candidate) => candidate.id === routeId);

    if (!route || !requirementsMet(context, route.requirements))
        throw new Error(`Objective route ${routeId} is not eligible.`);

    return planObjectiveTransition(context, context.objective, route, `route-${route.id}`);
}

function choiceOutput(objective, choice, context) {
    return choice;
}

async function prepareDirectChoice(message) {
    const context = await loadTurnContext(message.saveId);

    if (!context.objective || objectiveControl(context.objective) !== "choice")
        return { active: false };

    const requirementState = objectiveRequirementState(context);

    if (requirementState.blocked)
        return { active: false, blocked: true, unmetRequirements: requirementState.unmet };

    const choices = (context.objective.choices || []).filter((choice) => requirementsMet(context, choice.requirements));

    if (!choices.length)
        throw new Error(`Choice objective ${context.objective.id} has no eligible choices.`);

    return {
        active: true,
        objectiveId: context.objective.id,
        title: context.resolve(context.objective.title),
        summary: context.resolve(context.objective.summary),
        responseMode: text(context.objective.choice_response_mode || "optional_text"),
        choices: choices.map((choice) => ({
            id: choice.id,
            title: context.resolve(choice.title),
            summary: context.resolve(choice.summary),
            playerText: context.resolve(choice.player_text)
        }))
    };
}

async function resolveDirectChoice(message) {
    const context = await loadTurnContext(message.saveId);

    if (!context.objective || objectiveControl(context.objective) !== "choice")
        throw new Error("The active objective is not a direct choice.");
    if (!requirementsMet(context, context.objective.completion_requirements))
        throw new Error("The active choice cannot complete until its completion requirements are met.");

    const choice = (context.objective.choices || []).find((candidate) => candidate.id === text(message.choiceId));

    if (!choice || !requirementsMet(context, choice.requirements))
        throw new Error(`Choice ${message.choiceId} is not eligible.`);

    const mode = text(context.objective.choice_response_mode || "optional_text");
    const authoredText = context.resolve(choice.player_text || choice.title);
    const optionalText = text(message.optionalText);
    const playerText = mode === "exact_text" ? authoredText : optionalText || authoredText;
    const identity = nextMessageIdentity(context, "player");
    const planned = planObjectiveTransition(context, context.objective, choiceOutput(context.objective, choice, context), `choice-${choice.id}`);

    return {
        ...planned,
        userMessage: {
            ...identity,
            role: "user",
            speaker: context.characters[context.header.playerCharacterId]?.name || "Player",
            text: playerText,
            detail: "normal",
            at: new Date().toISOString()
        }
    };
}

async function resolveAutomaticObjective(message) {
    const context = await loadTurnContext(message.saveId);
    const objective = context.objective;

    if (!objective || objectiveControl(objective) !== "reward_only" || !requirementsMet(context, objective.completion_requirements))
        return { applied: false, operations: [], hydration: [] };

    const output = deterministicOutput(context, objective);
    return { applied: true, ...planObjectiveTransition(context, objective, output, output?.id || "automatic") };
}

async function resolveProgressDecision(message) {
    const context = await loadTurnContext(message.saveId);
    const decision = parseCompactDecision(message.raw);
    const progress = decision.progress || (decision.complete ? "All currently described parts of the objective were shown in the narrator response." : "");
    const operations = [];

    if (progress && context.objective) {
        operations.push({
            type: "objective.progress.add",
            note: {
                objectiveId: context.objective.id,
                noteId: `note-${Date.now()}`,
                sequence: Date.now(),
                text: progress
            }
        });
    }

    return { objectiveId: context.objective?.id || "", complete: false, progress, operations };
}

//#endregion Objective Decisions




//#region Requests

async function prepareTurn(message) {
    const context = await loadTurnContext(message.saveId);
    const playerText = text(message.text);

    if (!playerText)
        throw new Error("Player message text is required.");

    if (context.objective && objectiveControl(context.objective) === "choice")
        throw new Error("Complete the active choice before sending a normal player message.");

    const identity = nextMessageIdentity(context, "player");
    const requirementState = objectiveRequirementState(context);
    return {
        userMessage: {
            ...identity,
            role: "user",
            speaker: text(message.speaker) || context.characters[context.header.playerCharacterId]?.name || "Player",
            text: playerText,
            detail: "normal",
            at: new Date().toISOString()
        },
        objectiveId: context.objective?.id || "",
        objectiveControl: context.objective ? objectiveControl(context.objective) : "",
        objectiveBlocked: requirementState.blocked,
        unmetRequirements: requirementState.unmet,
        objectivePrompt: !requirementState.blocked
            ? objectiveCheckPrompt(context, playerText, "pre")
            : ""
    };
}

async function prepareNarrator(message) {
    const context = await loadTurnContext(message.saveId);
    const requirementState = objectiveRequirementState(context);
    return {
        prompt: narratorPrompt(context, text(message.completionDirective)),
        objectiveId: context.objective?.id || "",
        objectiveTitle: context.objective ? context.resolve(context.objective.title) : "",
        objectiveSummary: context.objective ? context.resolve(context.objective.summary) : "",
        objectiveBlocked: requirementState.blocked,
        unmetRequirements: requirementState.unmet
    };
}

async function prepareSceneRemoval(message) {
    const context = await loadTurnContext(message.saveId);
    return { prompt: sceneRemovalPrompt(context, text(message.playerText)) };
}

async function resolveSceneRemoval(message) {
    const context = await loadTurnContext(message.saveId);
    return parseSceneRemoval(message.raw, context);
}

async function preparePostProgress(message) {
    const context = await loadTurnContext(message.saveId);

    if (!context.objective || objectiveControl(context.objective) !== "ai" || !requirementsMet(context, context.objective.completion_requirements))
        return { prompt: "", objectiveId: context.objective?.id || "" };

    return {
        prompt: objectiveCheckPrompt(context, text(message.assistantText), "post_progress"),
        objectiveId: context.objective.id
    };
}





async function prepareStateUpdate(message) {
    const context = await loadTurnContext(message.saveId);
    return { prompt: await stateUpdatePrompt(context, text(message.assistantText)) };
}

async function resolveStateUpdate(message) {
    const context = await loadTurnContext(message.saveId);
    return { operations: parseStateOperations(message.raw, context) };
}

async function handleRequest(message) {
    switch (message.type) {
        case "turn.initialize":
            RuntimeDatabaseName = text(message.runtimeDatabaseName) || RuntimeDatabaseName;
            runtimeDatabasePromise = null;
            await openRuntimeDatabase();
            return { runtimeDatabaseName: RuntimeDatabaseName };
        case "turn.prepare": return prepareTurn(message);
        case "turn.scene-removal.prepare": return prepareSceneRemoval(message);
        case "turn.scene-removal.resolve": return resolveSceneRemoval(message);
        case "turn.objective.resolve": return resolveObjectiveDecision(message);
        case "turn.route.resolve": return resolveObjectiveRoute(message);
        case "turn.choice.prepare": return prepareDirectChoice(message);
        case "turn.choice.resolve": return resolveDirectChoice(message);
        case "turn.automatic.resolve": return resolveAutomaticObjective(message);
        case "turn.narrator.prepare": return prepareNarrator(message);
        case "turn.state.prepare": return prepareStateUpdate(message);
        case "turn.state.resolve": return resolveStateUpdate(message);


        case "turn.image.prepare": return prepareImage(message);
        case "turn.shops.prepare": return prepareShops(message);
        case "turn.shop.purchase": return purchaseShopItem(message);
        case "turn.characters.prepare": return prepareCharacters(message);
        case "turn.character.command": return applyCharacterCommand(message);
        case "turn.inventory.prepare": return prepareInventory(message);
        case "turn.inventory.command": return applyInventoryCommand(message);
        case "turn.map.prepare": return prepareMap(message);
        case "turn.map.travel": return travelToLocation(message);
        case "turn.map.command": return applyMapCommand(message);


        case "turn.runtime-state.prepare": return prepareRuntimeState(message);
        case "turn.runtime-state.command": return applyRuntimeStateCommand(message);
        case "turn.progress.prepare": return preparePostProgress(message);
        case "turn.progress.resolve": return resolveProgressDecision(message);
        case "turn.timed.resolve": return resolveTimedEvents(message);
        default: throw new Error(`Unknown turn-worker request: ${message.type}.`);
    }
}

self.onmessage = async (event) => {
    const message = event.data || {};

    try {
        const value = await handleRequest(message);
        postMessage({ type: "response", requestId: message.requestId, ok: true, value });
    }
    catch (error) {
        postMessage({
            type: "response",
            requestId: message.requestId,
            ok: false,
            error: { name: error?.name || "Error", message: error?.message || String(error), stack: error?.stack || "" }
        });
    }
};

//#endregion Requests
