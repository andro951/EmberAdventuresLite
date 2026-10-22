"use strict";

const EmberPersistenceDomainOperationContract = (() => {
    const fieldsByType = Object.freeze({
        "runtime.records.replace": ["type", "storeName", "records", "match"],
        "snapshot.begin": ["type", "snapshot"],
        "snapshot.rollback": ["type", "snapshotId"],
        "snapshot.commit": ["type", "snapshotId", "completedAt"],
        "snapshot.delete": ["type", "snapshotId"],
        "message.add": ["type", "message"],
        "message.put": ["type", "message"],
        "message.delete": ["type", "messageId"],
        "character.relationship.set": ["type", "characterId", "values"],
        "character.scene.set": ["type", "characterId", "values"],
        "character.durable.set": ["type", "characterId", "values"],
        "character.stat.set": ["type", "characterId", "statId", "value"],
        "character.materialize": ["type", "records"],
        "character.replace": ["type", "characterId", "records"],
        "character.delete": ["type", "characterId"],
        "character.fact.add": ["type", "fact"],
        "character.fact.remove": ["type", "characterId", "factId"],
        "temporary.speaker.put": ["type", "speaker"],
        "objective.runtime.set": ["type", "objectiveId", "values"],
        "objective.control.set": ["type", "values"],
        "objective.progress.add": ["type", "note"],
        "reward.invocation.add": ["type", "invocation"],
        "story.rule.add": ["type", "rule"],
        "story.rule.remove": ["type", "ruleId"],
        "story.value.set": ["type", "record"],
        "story.value.delete": ["type", "root", "pathKey"],
        "story.root.replace": ["type", "root", "value"],
        "story.list.add": ["type", "record"],
        "story.list.remove": ["type", "root", "listPathKey", "itemKey"],
        "scene.member.add": ["type", "characterId"],
        "scene.member.remove": ["type", "characterId"],
        "party.member.add": ["type", "characterId"],
        "party.member.remove": ["type", "characterId"],
        "future.character.set": ["type", "characterId", "values"],
        "npc.shell.set": ["type", "characterId", "values"],
        "npc.shell.put": ["type", "shell"],
        "npc.shell.delete": ["type", "characterId"],
        "scene.runtime.set": ["type", "values"],
        "location.current.set": ["type", "locationId"],
        "location.runtime.set": ["type", "locationId", "values"],
        "location.runtime.put": ["type", "locationId", "values"],
        "location.runtime.delete": ["type", "locationId"],
        "location.definition.put": ["type", "location"],
        "location.definition.delete": ["type", "locationId"],
        "location.connection.set": ["type", "fromLocationId", "toLocationId", "present"],
        "time.set": ["type", "values"],
        "timed.event.set": ["type", "timedEventId", "values"],
        "timed.stage.add": ["type", "timedEventId", "stageId"],
        "item.put": ["type", "item"],
        "item.delete": ["type", "itemId"],
        "equipment.set": ["type", "record"],
        "temporary.items.set": ["type", "record"],
        "outfit.put": ["type", "outfit"],
        "outfit.delete": ["type", "characterId", "outfitId"],
        "shop.runtime.set": ["type", "shopId", "values"],
        "shop.item.set": ["type", "shopId", "itemId", "values"],
        "job.definition.add": ["type", "job"],
        "job.runtime.set": ["type", "jobId", "values"],
        "job.progress.set": ["type", "jobId", "pathKey", "value"],
        "job.step.complete": ["type", "jobId", "stepId"],
        "job.offer.put": ["type", "offer"],
        "save.header.set": ["type", "values"],
        "story.image.put": ["type", "image"],
        "story.image.delete": ["type", "imageId"],
        "story.image.target.put": ["type", "imageId", "characterId"],
        "story.image.target.delete": ["type", "imageId", "characterId"],
        "image.asset.put": ["type", "asset"],
        "image.asset.delete": ["type", "imageId"],
        "character.settings.set": ["type", "characterId", "values"],
        "save.session.close": ["type"],
        "diagnostic.record.add": ["type", "storeName", "record"],
        "diagnostic.record.put": ["type", "storeName", "record"],
        "diagnostic.record.delete": ["type", "storeName", "key"],
    });

    const optionalFieldsByType = Object.freeze({
        "runtime.records.replace": new Set(["match"]),
    });

    const plainObjectFields = new Set([
        "match", "values", "message", "fact", "speaker", "note", "invocation",
        "rule", "record", "shell", "location", "item", "outfit", "offer", "image",
        "asset", "snapshot",
    ]);
    const arrayFields = new Set(["records"]);
    const booleanFields = new Set(["present"]);
    const nonblankTextFields = new Set([
        "storeName", "snapshotId", "completedAt", "messageId", "characterId", "factId",
        "objectiveId", "ruleId", "root", "pathKey", "listPathKey", "itemKey",
        "locationId", "fromLocationId", "toLocationId", "timedEventId", "stageId",
        "itemId", "outfitId", "shopId", "jobId", "stepId", "imageId", "statId",
    ]);

    function isPlainObject(value) {
        if (value == null || typeof value !== "object" || Array.isArray(value))
            return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function assertNonblankText(value, path) {
        if (typeof value !== "string" || !value || value !== value.trim())
            throw new Error(`${path} must be nonblank text without leading or trailing whitespace.`);
    }

    function assertExact(operation) {
        if (operation == null || typeof operation !== "object" || Array.isArray(operation))
            throw new Error("Domain operation must be an object.");
        if (typeof operation.type !== "string" || !operation.type)
            throw new Error("Domain operation type must be non-empty text.");
        const fields = fieldsByType[operation.type];
        if (!fields)
            throw new Error(`Unsupported domain operation: ${operation.type}.`);
        const allowed = new Set(fields);
        const unknown = Object.keys(operation).find((field) => !allowed.has(field));
        if (unknown)
            throw new Error(`${operation.type}.${unknown} is not an approved domain-operation field.`);
        const optional = optionalFieldsByType[operation.type] || new Set();
        const missing = fields.find(
            (field) => field !== "type" && !optional.has(field) && !Object.hasOwn(operation, field),
        );
        if (missing)
            throw new Error(`${operation.type}.${missing} is required.`);
        for (const field of fields) {
            if (field === "type" || !Object.hasOwn(operation, field)) continue;
            const value = operation[field];
            const path = `${operation.type}.${field}`;
            if (plainObjectFields.has(field) && !isPlainObject(value))
                throw new Error(`${path} must be an object.`);
            if (arrayFields.has(field) && !Array.isArray(value))
                throw new Error(`${path} must be an array.`);
            if (booleanFields.has(field) && typeof value !== "boolean")
                throw new Error(`${path} must be true or false.`);
            if (nonblankTextFields.has(field)) assertNonblankText(value, path);
        }
        return operation;
    }

    return Object.freeze({ fieldsByType, assertExact });
})();
