const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, "src", file), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function libraryContext() {
    const context = vm.createContext({onmessage: null, self: {}, structuredClone, TextEncoder});
    vm.runInContext(read("workers/library-worker.js"), context);
    return context;
}

function persistenceContext() {
    const context = vm.createContext({self: new EventTarget(), importScripts() {}, Blob, setInterval, clearInterval});
    vm.runInContext(read("persistence/schema-contract.js") + read("persistence/domain-operation-contract.js") + read("persistence/persistence-worker.js"), context);
    return context;
}

function characterRecords(value) {
    const context = libraryContext();
    context.requestedScale = value;
    const result = vm.runInContext(`(() => {
        const session = createEditor({type:"editor.create", requestId:1, kind:"character"});
        const character = editorSessions.get(session.sessionId).draft;
        Object.assign(character, {
            id:"lite-persistence-fixture", name:"Persistence Fixture", role:"Archivist",
            personality_description:"Patient and observant.", speech_style:"Plain and direct.",
            starting_relationship_to_player:"New acquaintance", starting_outfit_id:"work-clothes",
        });
        character.outfits = [{id:"work-clothes", name:"Work clothes", clothing:{shirt:"Long-sleeved linen shirt", pants:"Full-length canvas trousers", feet:"Leather boots"}}];
        for (const key of ["height","shoulder_width","chest","upper_body_build","midsection_build","hip_width","butt_build","lower_body_build","arm_length","leg_length"])
            character.appearance[key] = requestedScale;
        const recordsByStore = {};
        materializeCharacterRecords(character, value => value, (storeName, record) => {
            (recordsByStore[storeName] ||= []).push({saveId:1, ...record});
        });
        return {recordsByStore, restored:compatibilityCharacter(character.id, recordsByStore, character)};
    })()`, context);
    return plain(result);
}

test("authored scale values survive real record materialization and reconstruction unchanged", () => {
    for (const value of [0, 10, 20, "  A custom square build  "]) {
        const {recordsByStore, restored} = characterRecords(value);
        for (const key of ["height","shoulder_width","chest","upper_body_build","midsection_build","hip_width","butt_build","lower_body_build","arm_length","leg_length"])
            assert.equal(restored.appearance[key], value, key);
        assert.equal(restored.outfits[0].clothing.shirt, "Long-sleeved linen shirt");
        assert.equal(restored.outfits[0].clothing.pants, "Full-length canvas trousers");
        assert.equal(restored.trust, 0);
        assert.equal(restored.affection, 0);
        const persistence = persistenceContext();
        persistence.records = recordsByStore;
        vm.runInContext(`for (const [storeName, entries] of Object.entries(records)) for (const record of entries) validateRecord(storeName, record, 1);`, persistence);
    }
});

test("Lite's storage schema rejects removed fields instead of persisting empty flags", () => {
    const context = persistenceContext();
    const {recordsByStore} = characterRecords(10);
    context.appearance = recordsByStore.characterAppearance[0];
    context.relationship = recordsByStore.characterRelationshipStats[0];
    vm.runInContext("appearance.penisSize = 10; relationship.arousal = 0;", context);
    assert.throws(() => vm.runInContext('validateRecord("characterAppearance", appearance, 1)', context), /penisSize/);
    assert.throws(() => vm.runInContext('validateRecord("characterRelationshipStats", relationship, 1)', context), /arousal/);
    assert.throws(() => vm.runInContext('convertDomainOperation(1, {type:"scene.sex-act.put",record:{}}, false)', context), /Unsupported domain operation/);
});

test("removing scene membership still produces the exact membership deletion", () => {
    const context = persistenceContext();
    const operations = vm.runInContext('convertDomainOperation(1, {type:"scene.member.remove",characterId:"fixture-companion"}, false)', context);
    assert.deepEqual(plain(operations), [{action:"delete",storeName:"sceneMembers",key:[1,"fixture-companion"]}]);
});

test("the scene save writer preserves membership and image selection without extra stores", () => {
    const context = vm.createContext({
        app:{state:{player:{id:"fixture-player"},scene:{summary:"Training yard",image_action:"aiming",party_members_present:["fixture-companion"],npcs_present:[],image_characters:["fixture-companion"]}}},
        isPlainObject: value => value !== null && typeof value === "object" && !Array.isArray(value),
        imageTargetIdForSave: value => value,
    });
    let text = read("scripts/app/03a-save-record-projector.js");
    //The real resolver is tested separately in the runtime suite. This test uses
    //already canonical ids so it isolates which records the projection writes.
    const name = "imageTargetIdForSave";
    const start = text.indexOf(`function ${name}(`);
    const end = text.indexOf("function storyImageRecordForSave(", start);
    text = text.slice(0,start) + text.slice(end);
    vm.runInContext(text, context);
    const operations = plain(vm.runInContext("sceneSaveOperations()", context));
    assert.deepEqual(operations, [
        {type:"scene.runtime.set",values:{summary:"Training yard",imageAction:"aiming"}},
        {type:"scene.member.add",characterId:"fixture-companion"},
        {type:"runtime.records.replace",storeName:"sceneImageTargets",records:[{characterId:"fixture-companion"}]},
    ]);
    vm.runInContext('app.state.scene.party_members_present = []; app.state.scene.image_characters = [];', context);
    const removed = plain(vm.runInContext("sceneSaveOperations()", context));
    assert(removed.some(operation => operation.type === "scene.member.remove" && operation.characterId === "fixture-companion"));
    assert.deepEqual(removed.at(-1).records, []);
});
