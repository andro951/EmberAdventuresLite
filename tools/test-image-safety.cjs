const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createProductionContext} = require("./lib/production-declarations.cjs");
test("solo, portrait and group negatives always exclude explicit content",() => {
    const p = createProductionContext();
    p.load("defaultSettings");
    p.context.app = {settings:structuredClone(p.context.defaultSettings)};
    const excluded = ["nude","exposed genitals","explicit sex"];
    const portrait = p.invoke("buildProfileNegativePrompt",{});
    const normal = p.invoke("buildNegativeImagePrompt",{});
    for (const text of [portrait,normal,...[0,1,2,3,4].map(count => p.invoke("buildGroupImageNegativePrompt",Array.from({length:count},(_,i) => ["Smoke Person " + i,{}])))]) {
        for (const term of excluded)
            assert(text.includes(term),term);
    }
});