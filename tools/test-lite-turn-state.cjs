const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname,"..");
const plain = value => JSON.parse(JSON.stringify(value));

function worker() {
    const context=vm.createContext({self:{}});
    vm.runInContext(fs.readFileSync(path.join(root,"src/workers/turn-worker.js"),"utf8"),context);
    return context;
}
function turnFixture() {
    return {
        saveId:1,header:{playerCharacterId:"fixture-player"},
        characters:{"fixture-player":{name:"Fixture Player"},"fixture-sergeant":{name:"Fixture Sergeant"},"fixture-absent":{name:"Fixture Absent"}},
        compiled:{locationById:{yard:"state.world_map.locations.yard"}},
        characterOutfits:[{characterId:"fixture-sergeant",outfitId:"uniform",name:"Uniform",shirt:"shirt-item",pants:"trousers-item",feet:"boots-item"}],
        characterSceneState:[{characterId:"fixture-sergeant",stateOfMind:"Focused",physicalState:"Healthy",pose:"Standing"}],
        characterDurableState:[{characterId:"fixture-sergeant",activeOutfitId:"uniform"}],
        characterAppearance:[],characterRelationships:[],equippedItems:[],items:[],
        sceneMembers:[{characterId:"fixture-sergeant"}],sceneRuntime:{summary:"Training yard",imageAction:"Archery practice"},
        currentLocation:{locationId:"yard"},messages:[],definition:{default_image_model:"fantasy-rpg"},
    };
}

test("ordinary state updates own mental state, physical condition, pose, and complete outfit changes", () => {
    const context=worker(),fixture=turnFixture();
    const pose="Holding a practice bow. ".repeat(40);
    const result=context.parseStateOperations(JSON.stringify({ops:[{t:"character",id:"fixture-sergeant",v:{stateOfMind:"Encouraged",physicalState:"Healthy",pose,outfitId:"uniform"}}]}),fixture);
    const operations=plain(result);
    assert.deepEqual(operations[0],{type:"character.scene.set",characterId:"fixture-sergeant",values:{stateOfMind:"Encouraged",physicalState:"Healthy",pose}});
    assert.equal(operations[1].type,"equipment.set");
    assert.equal(operations[1].record.shirt,"shirt-item");
    assert.equal(operations[1].record.pants,"trousers-item");
    assert.equal(operations[1].record.feet,"boots-item");
    assert.equal(operations[2].type,"temporary.items.set");
    assert.deepEqual(operations[3],{type:"character.durable.set",characterId:"fixture-sergeant",values:{activeOutfitId:"uniform"}});
    assert.equal(fixture.characterSceneState[0].pose,"Standing");
});

test("state updates reject unknown characters, unowned outfits, and unknown fields", () => {
    const context=worker(),fixture=turnFixture();
    const parse=operation=>context.parseStateOperations(JSON.stringify({ops:[operation]}),fixture);
    assert.throws(()=>parse({t:"character",id:"missing",v:{pose:"Standing"}}),/unknown character/);
    assert.throws(()=>parse({t:"character",id:"fixture-player",v:{outfitId:"uniform"}}),/does not exist for character/);
    assert.throws(()=>parse({t:"character",id:"fixture-sergeant",v:{unapproved:"value"}}),/not an approved field/);
    assert.throws(()=>parse({t:"character",id:"fixture-sergeant",v:{pose:4}}),/must be text/);
    assert.throws(()=>parse({t:"relationship",id:"fixture-sergeant",v:{arousal:0}}),/not an approved field/);
    assert.throws(()=>parse({t:"scene",v:{spicyMode:"off"}}),/not an approved field/);
});

test("regular state updates retain scene membership, time, location, and relationship operations", () => {
    const context=worker();
    const operations=plain(context.parseStateOperations(JSON.stringify({ops:[
        {t:"scene",v:{summary:"Practice concluded",imageAction:"Talking"}},
        {t:"member_add",id:"fixture-sergeant"},{t:"member_remove",id:"fixture-sergeant"},
        {t:"time",v:{hour:10,minute:15}},{t:"location",id:"yard"},
        {t:"relationship",id:"fixture-sergeant",v:{trust:6,attraction:2,affection:3}},
    ]}),turnFixture()));
    assert.deepEqual(operations.map(operation=>operation.type),["scene.runtime.set","scene.member.add","scene.member.remove","time.set","location.current.set","character.relationship.set"]);
    assert.deepEqual(operations.at(-1).values,{trust:6,attraction:2,affection:3});
    assert(operations.every(operation=>!operation.type.startsWith("objective.")));
});

test("the regular updater prompt describes its transferred responsibilities and available outfits", async () => {
    const context=worker(),fixture=turnFixture();
    context.recordsForSave=async name=>name === "sceneMembers" ? fixture.sceneMembers : [];
    context.storeRecord=async()=>({hour:10,minute:0});
    const prompt=await context.stateUpdatePrompt(fixture,"The sergeant changes into her uniform.");
    assert(prompt.includes('"t":"character"'));
    assert(prompt.includes('"outfitId":"uniform"'));
    assert(prompt.includes("full-coverage outer clothing"));
    assert(!/spicy|lovense|arousal|sex position/i.test(prompt));
});

test("scene image preparation keeps present-character selection without an adult-state dependency", () => {
    const context=worker();
    const result=plain(context.prepareImageRequest(turnFixture(),"Fixture scene image"));
    assert.deepEqual(result.characterIds,["fixture-player","fixture-sergeant"]);
    assert(result.image.prompt.includes("full-coverage outer clothing"));
    assert(!Object.hasOwn(result.image,"nsfwMode"));
    assert(!Object.hasOwn(result.image,"forceSfw"));
});

test("the turn worker has no removed request routes or group undressing command", async () => {
    const context=worker(),fixture=turnFixture();
    for(const type of ["turn.spicy.prepare","turn.spicy.resolve","turn.position.prepare","turn.position.set"])
        await assert.rejects(context.handleRequest({type,saveId:1}),/Unknown turn-worker request/);
    context.loadTurnContext=async()=>fixture;
    await assert.rejects(context.applyCharacterCommand({saveId:1,characterId:"fixture-sergeant",command:"remove-clothing",group:"all"}),/Unsupported character command/);
    const result=plain(await context.applyCharacterCommand({saveId:1,characterId:"fixture-sergeant",command:"outfit",outfitId:"uniform"}));
    assert.equal(result.operations[0].record.shirt,"shirt-item");
});
