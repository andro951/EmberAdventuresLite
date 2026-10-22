const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createProductionContext} = require("./lib/production-declarations.cjs");

const {characterFixture} = require("./lib/canonical-lite-fixtures.cjs");

test("the canonical character validator accepts a complete Lite definition", () => {
    const production = createProductionContext();
    const character = characterFixture();
    const before = structuredClone(character);
    const result = production.invoke("validateCharacterDefinition", character);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(character, before);
});

test("the canonical character validator rejects absent, false, and nonboolean Lite markers", () => {
    const production = createProductionContext();
    for (const value of [undefined,false,null,"true",1]) {
        const character = characterFixture();
        if (value === undefined) delete character.lite;
        else character.lite=value;
        const result = production.invoke("validateCharacterDefinition", character);
        assert.equal(result.ok,false);
        assert(result.errors.some(error => error.path === "character_definition.lite"));
    }
});

test("the canonical character validator rejects removed fields without silently deleting them", () => {
    const production = createProductionContext();
    for (const [section,field,value] of [["root","nsfw",false],["root","kink_tags",[]],["root","starting_arousal",0],["appearance","penis_size",10],["outfit","nsfw",false]]) {
        const character=characterFixture();
        const target=section === "appearance" ? character.appearance : section === "outfit" ? character.outfits[0] : character;
        target[field]=value;
        const before=structuredClone(character);
        const result=production.invoke("validateCharacterDefinition",character);
        assert.equal(result.ok,false,field);
        assert(result.errors.some(error => error.code === "unknown_field" && error.path.endsWith(`.${field}`)),JSON.stringify(result.errors));
        assert.deepEqual(character,before);
    }
});

test("story and animal definitions use the same required marker contract", () => {
    const production=createProductionContext();
    for(const [name,path] of [["validateStoryDefinition","storyTemplate"],["validateAnimalDefinition","animal_definition"]]) {
        for(const value of [undefined,false,"true"]) {
            const result=production.invoke(name,value === undefined ? {} : {lite:value});
            assert(result.errors.some(error => error.path === `${path}.lite`),JSON.stringify(result.errors));
        }
    }
});

test("Lite definitions retain ordinary gender values and require shared fallback conversion before unsupported values enter the game", () => {
    const p=createProductionContext();
    for(const gender of ["female","male","trans female","trans male","non-binary","trans non-binary"]) {
        const character=characterFixture();character.gender=gender;
        const result=p.invoke("validateCharacterDefinition",character);
        assert.equal(result.ok,true,JSON.stringify(result.errors));
    }
    for(const gender of ["futa","futanari"]) {
        const character=characterFixture();character.gender=gender;
        const result=p.invoke("validateCharacterDefinition",character);
        assert.equal(result.ok,false);
        assert(result.errors.some(error=>error.path === "character_definition.gender"));
    }
});
