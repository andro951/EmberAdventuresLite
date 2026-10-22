const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const root=path.resolve(__dirname,"..");
test("private runtime fixture producers emit canonical Lite definitions and connected objective chains", () => {
    const p=createProductionContext();
    const source=fs.readFileSync(path.join(root,"src/scripts/tests/runtime-architecture-tests.js"),"utf8");
    for(const name of ["runtimeCharacterFixture","runtimeStoryFixture"]) {
        const match=source.match(new RegExp("^    function "+name+"\\([^]*?^    }","m"));
        assert(match,name);
        vm.runInContext(match[0],p.context);
    }
    const character=p.context.runtimeCharacterFixture("smoke-private-character");
    assert.equal(p.invoke("validateCharacterExport",character).ok,true);
    assert.equal(character.character_definition.lite,true);
    for(const count of [1,3,20]) {
        const story=p.context.runtimeStoryFixture("smoke-private-story",{objectiveCount:count});
        const before=JSON.stringify(story);
        const validation=p.invoke("validateStoryExport",story);
        assert.equal(validation.ok,true,JSON.stringify(validation.errors));
        assert.equal(story.storyTemplate.state.objectives.items.length,count);
        assert.equal(story.storyTemplate.lite,true);
        assert.equal(JSON.stringify(story),before);
    }
});
