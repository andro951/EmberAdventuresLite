const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const root = path.resolve(__dirname,"..");
const lite = fs.existsSync(path.join(root,"src/contracts/shared-library-format.js"));
function fixture() {
    const exported = JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures/compatibility-lite-story.json"),"utf8"));
    return (lite ? exported : require("../src/contracts/lite-import-format.js").toNormal(exported)).storyTemplate;
}
function youngerStory(p, age) {
    const story = fixture();
    for (const entry of p.invoke("storyDefinitionCharacterEntries",story)) {
        entry.character.age = age;
        if (entry.character.appearance) {
            entry.character.romanceable = false;
            entry.character.starting_attraction = 0;
            if (!lite) entry.character.starting_arousal = 0;
        }
    }
    return story;
}
test("SFW story publishing preserves valid embedded character ages", () => {
    const p = createProductionContext();
    for (const age of [0,4,16,17,18,41]) {
        const story = youngerStory(p,age);
        const before = structuredClone(story);
        const validation = p.invoke("validateStoryDefinition",story);
        assert.equal(validation.ok,true,JSON.stringify(validation.errors));
        assert.deepEqual(Array.from(p.invoke("publicStoryPolicyErrors",story)),[]);
        assert.deepEqual(story,before);
    }
});
test("story publishing leaves standalone age and real-person publishing policies intact", () => {
    const p = createProductionContext();
    assert(p.invoke("publicCharacterPolicyErrors",{age:17}).some(error=>error.includes("under 18")));
    const story = youngerStory(p,16);
    story.state.player.real_person = true;
    assert(p.invoke("publicStoryPolicyErrors",story).some(error=>error.includes("real person")));
});
test("younger story characters retain canonical relationship safeguards", () => {
    const p = createProductionContext();
    for (const [field,value] of [["romanceable",true],["starting_attraction",1]]) {
        const story = youngerStory(p,16);
        story.state.player[field] = value;
        const result = p.invoke("validateStoryDefinition",story);
        assert.equal(result.ok,false,field);
        assert(result.errors.some(error=>error.path.includes(field)),JSON.stringify(result.errors));
    }
});
test("normal adult stories retain the younger-character publishing restriction", {skip:lite}, () => {
    const p = createProductionContext();
    const story = youngerStory(p,16);
    for (const classified of [true,undefined]) {
        story.nsfw = classified;
        assert(p.invoke("publicStoryPolicyErrors",story).some(error=>error.includes("under 18")));
    }
});
