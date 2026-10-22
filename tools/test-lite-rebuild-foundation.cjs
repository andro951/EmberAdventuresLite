const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const scales = require("../src/contracts/appearance-scales.js");
const root = path.resolve(__dirname, "..");
const fields = ["height", "shoulder_width", "chest", "upper_body_build", "midsection_build", "hip_width", "butt_build", "lower_body_build", "arm_length", "leg_length"];
function source(file) {
    return fs.readFileSync(path.join(root, "src/scripts/app", file + ".js"), "utf8");
}
function declaration(file, name) {
    const text = source(file);
    const start = new RegExp(`(?:async )?function ${name}\\(`).exec(text)?.index;
    assert.notEqual(start, undefined, name);
    let result = "";
    for (const line of text.slice(start).split("\n")) {
        result += line + "\n";
        try { new vm.Script(result); return result; }
        catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    }

    throw Error(`Unterminated ${name}`);
}

test("every appearance table has 21 distinct reviewed entries and is immutable", () => {
    const tables = [...Object.values(scales.body), scales.maleChest, scales.femaleChest];
    assert.equal(tables.length, 11);
    assert.deepEqual(Object.keys(scales.body).sort(), fields.filter(field => field !== "chest").sort());
    for (const values of tables) {
        assert.equal(values.length, 21);
        assert.equal(new Set(values).size, 21);
        assert(values.every(value => typeof value === "string" && value.trim()));
        assert(Object.isFrozen(values));
        assert(!values.some(value => /head[ -](?:volume|length|width)|ground.level|anatomically impossible/i.test(value)));
    }
});

test("female chest wording matches all 21 approved descriptions exactly", () => {
    const handoff = fs.readFileSync(path.join(root, "docs/rebuild/plan.md"), "utf8");
    const approved = [...handoff.matchAll(/^\| (\d+) \| ([^|]+) \|$/gm)].filter(match => Number(match[1]) <= 20).map(match => match[2].trim());
    assert.equal(approved.length, 21);
    assert.deepEqual(Array.from(scales.femaleChest), approved);
    assert(!scales.femaleChest.slice(11).some(value => /perky|rounded|firm/i.test(value)));
});

test("the retained image helpers use Lite tables without remapping numbers and preserve custom descriptions", () => {
    let customEntity;
    const context = vm.createContext({
        bodyStatPhrases: scales.body, maleChestPhrases: scales.maleChest, femaleChestPhrases: scales.femaleChest,
        normalizedCharacterGender: gender => gender,
        displayRuntimeTemplateText: (text, entity) => {customEntity = entity; return text;}
    });
    vm.runInContext(["bodyStatPhrase", "bodyStatPhraseFromNumber", "chestStatPhraseFromNumber"].map(name => declaration("14-ai-plugins", name)).join("\n"), context);
    for (let value = 0; value <= 20; value++) {
        assert.equal(context.bodyStatPhrase("chest", value, {entity: {gender: "female"}}), scales.femaleChest[value]);
        assert.equal(context.bodyStatPhrase("chest", value, {entity: {gender: "male"}}), scales.maleChest[value]);
        for (const [field, phrases] of Object.entries(scales.body))
            assert.equal(context.bodyStatPhrase(field, value), phrases[value]);
    }

    const entity = {name: "Scale Test"};
    assert.equal(context.bodyStatPhrase("shoulder_width", "A custom square frame", {entity}), "A custom square frame");
    assert.equal(customEntity, entity);
});

test("the canonical scale validator and editor agree on the ten restored fields", () => {
    const text = source("04-story-runtime");
    const start = text.indexOf("const CHARACTER_APPEARANCE_SCALE_FIELDS =");
    const end = text.indexOf("]);", start) + 3;
    const context = vm.createContext({
        isPlainObject: value => value !== null && typeof value === "object" && !Array.isArray(value),
        validationError: (path, code, message) => ({path, code, message})
    });
    vm.runInContext(text.slice(start, end) + declaration("04-story-runtime", "characterAppearanceScaleValidationErrors") + declaration("26-objective-suggestions", "bodyStatKeys"), context);
    assert.deepEqual(Array.from(context.bodyStatKeys()), fields);
    for (const value of [0, 10, 20, "A custom build"]) {
        const character = {appearance: Object.fromEntries(fields.map(field => [field, value]))};
        assert.equal(context.characterAppearanceScaleValidationErrors(character).length, 0);
    }

    for (const value of [-1, 21, 1.5, NaN, Infinity, null, undefined, "10", ""]) {
        const character = {appearance: Object.fromEntries(fields.map(field => [field, 10]))};
        character.appearance.chest = value;
        assert(context.characterAppearanceScaleValidationErrors(character).some(error => error.path === "character.appearance.chest"));
    }
});

test("Lite persistence owns only its exact database names", () => {
    const text = source("00-bootstrap-storage");
    const start = text.indexOf("const OWNED_DATABASE_NAMES =");
    const end = text.indexOf("];", start) + 2;
    const context = vm.createContext({});
    vm.runInContext(text.slice(start, end) + declaration("00-bootstrap-storage", "isEmberGameDatabaseName"), context);
    for (const name of ["emberadventureslite-data", "EmberAdventuresLiteRuntimeV2", "EmberAdventuresLiteRuntimeDiagnostic", "EmberAdventuresLiteApplicationV2", "EmberAdventuresLiteLibraryRuntimeDiagnostic", "EmberAdventuresLiteLibraryApplicationDiagnostic"])
        assert.equal(context.isEmberGameDatabaseName(name), true);

    for (const name of ["emberadventures-data", "EmberAdventuresRuntimeV2", "EmberAdventuresRuntimeDiagnostic", "EmberAdventuresApplicationV2", "EmberAdventuresLibraryRuntimeDiagnostic", "EmberAdventuresLibraryApplicationDiagnostic", "emberquest", "unrelated-player-data"])
        assert.equal(context.isEmberGameDatabaseName(name), false);
});

test("the incomplete rebuild cannot replace the playable page", () => {
    const status = JSON.parse(fs.readFileSync(path.join(root, "docs/rebuild/status.json"), "utf8"));
    if (status.readyToBuild !== true)
        assert.throws(() => require("../build_source.js").assembleBottomSource(), /Lite rebuild is in progress/);
});
