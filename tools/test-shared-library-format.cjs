const {test} = require("node:test");
const assert = require("node:assert/strict");
const format = require("../src/contracts/shared-library-format.js");
const {characterFixture} = require("./lib/canonical-lite-fixtures.cjs");
const {createProductionContext} = require("./lib/production-declarations.cjs");
function sharedCharacter(fallbackGender) {
    const character = characterFixture();
    delete character.lite;
    Object.assign(character,{nsfw:false,loli:false,kink_tags:[],gender:"futanari",fallback_gender:fallbackGender,starting_arousal:0,starting_nsfw_known_facts:[]});
    character.appearance.penis_size = 10;
    character.fallback_outfits[0].name = "Alternate uniform";
    character.fallback_outfits[0].clothing.shirt = "Navy long-sleeved uniform shirt";
    character.outfits.forEach(outfit=>outfit.nsfw=false);
    character.fallback_outfits.forEach(outfit=>outfit.nsfw=false);
    return character;
}
test("shared characters use the required female or male fallback without remapping sliders", () => {
    const production = createProductionContext();
    for (const gender of ["male","female"]) {
        for (let chest=0;chest<=20;chest++) {
            const input = sharedCharacter(gender);
            input.appearance.chest = chest;
            const before = structuredClone(input);
            const converted = format.toLite({character_definition:input}).character_definition;
            assert.equal(converted.lite,true);
            assert.equal(converted.gender,gender);
            assert.equal(converted.appearance.chest,chest);
            assert.equal(converted.id,input.id);
            assert.equal(converted.name,gender === "male" ? input.fallback_name : input.name);
            assert.equal(converted.outfits[0].name,gender === "male" ? "Alternate uniform" : input.outfits[0].name);
            assert(!/fallback_gender|starting_arousal|penis_size|nsfw|loli|kink_tags/.test(JSON.stringify(converted)));
            const validation = production.invoke("validateCharacterDefinition",converted);
            assert.equal(validation.ok,true,JSON.stringify(validation.errors));
            assert.deepEqual(input,before);
        }
    }
});
test("missing or invalid fallback gender is rejected without guessing or changing the source", () => {
    for (const gender of [undefined,null,"",false,"unspecified","Male"]) {
        const input = sharedCharacter(gender);
        const before = structuredClone(input);
        assert.throws(()=>format.toLite({character_definition:input}),/fallback_gender must be exactly male or female/);
        assert.deepEqual(input,before);
    }
});
test("story conversion keeps stable ids and updates exact names and scene references for alternate presentations", () => {
    const character = sharedCharacter("male");
    const input = {app:"EmberAdventures",exportType:"story-template",storyTemplate:{id:"shared-story",title:"Shared Story",nsfw:false,loli:false,state:{
        characters:{[character.name]:character},
        scene:{party_members_present:[character.name],image_characters:[character.name],spicy_mode:"off",intimacy_level:0},
        npc_directory:{locations:{yard:{characters:{[character.name]:{id:character.id,name:character.name,gender:"futanari",full_character:character}}}}},
    }}};
    const before = structuredClone(input);
    const result = format.toLite(input);
    assert.equal(result.app,"EmberAdventures");
    assert.equal(result.storyTemplate.lite,true);
    const state = result.storyTemplate.state;
    assert.equal(state.characters[character.fallback_name].id,character.id);
    assert.deepEqual(state.scene.party_members_present,[character.fallback_name]);
    assert.equal(state.npc_directory.locations.yard.characters[character.fallback_name].gender,"male");
    assert.equal(state.characters[character.fallback_name].fallback_name,character.name);
    assert.deepEqual(input,before);
});
test("unknown ordinary fields survive conversion for canonical rejection and Lite inputs are not repaired", () => {
    const production = createProductionContext();
    const input = sharedCharacter("female");
    input.misspelled_field = "must not disappear";
    const result = format.toLite({character_definition:input}).character_definition;
    assert.equal(result.misspelled_field,input.misspelled_field);
    assert(production.invoke("validateCharacterDefinition",result).errors.some(error=>error.path.endsWith(".misspelled_field")));
    const lite = characterFixture();
    lite.nsfw = false;
    assert.deepEqual(format.toLite({character_definition:lite}).character_definition,lite);
    assert.equal(production.invoke("validateCharacterDefinition",format.toLite({character_definition:lite}).character_definition).ok,false);
});
test("shared imports require explicit SFW classification and cannot select an excluded outfit", () => {
    for (const flag of [true,undefined,null,"false"]) {
        const input = sharedCharacter("female");input.nsfw=flag;
        assert.throws(()=>format.toLite({character_definition:input}),/classified SFW/);
    }
    const input = sharedCharacter("female");input.outfits[0].nsfw=true;
    assert.throws(()=>format.toLite({character_definition:input}),/outside the shared SFW library/);
    const alternate = sharedCharacter("female");
    alternate.outfits.push({id:"excluded",name:"Excluded",nsfw:true,clothing:{}});
    assert.equal(format.toLite({character_definition:alternate}).character_definition.outfits.length,1);
});
test("mixed character batches convert every record while preserving envelope metadata", () => {
    const input = {characters:[
        {character_definition:sharedCharacter("male")},
        {character_definition:sharedCharacter("female")},
        {character_definition:characterFixture()},
    ]};
    const result = format.toLite(input);
    assert.deepEqual(result.characters.map(record => record.character_definition.gender),["male","female","female"]);
    const production = createProductionContext();
    production.context.EmberSharedLibraryFormat = format;
    input.characters[1].character_definition.id = "second-fixture";
    input.characters[1].character_definition.name = "Second Fixture";
    input.characters[2].character_definition.id = "third-fixture";
    input.characters[2].character_definition.name = "Third Fixture";
    const imported = production.invoke("characterImportRecordsFromExport", input);
    assert.deepEqual(Array.from(imported, record => record.character_definition.gender), ["male", "female", "female"]);
    assert(!JSON.stringify(imported).includes("fallback_gender"));
});

test("a selected shared character is converted independently of unselected records in its hosted bundle", () => {
    const p=createProductionContext();
    p.context.EmberSharedLibraryFormat=format;
    const chosen=sharedCharacter("female");
    const other=sharedCharacter("male");
    other.id="unselected-definition";other.nsfw=true;
    const payload={characters:[{character_definition:other},{character_definition:chosen}]};
    const before=structuredClone(payload);
    const records=p.invoke("publicCharacterPayloadRecordsForEntry",payload,{definition_id:chosen.id,curated:true});
    assert.equal(records.length,1);
    assert.equal(records[0].character_definition.id,chosen.id);
    assert.equal(records[0].character_definition.gender,"female");
    assert.throws(()=>p.invoke("publicCharacterPayloadRecordsForEntry",payload,{definition_id:other.id,curated:true}),/classified SFW/);
    assert.deepEqual(payload,before);
});
