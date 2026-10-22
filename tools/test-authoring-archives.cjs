const {test} = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {loadAuthoringSkills} = require("./lib/authoring-skills.cjs");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const root = path.resolve(__dirname, "..");
const product = "EmberAdventuresLite";
const prefix = product === "EmberAdventuresLite" ? "emberadventureslite" : "emberadventures";
const packaged = loadAuthoringSkills(root, product);
const zipUrl = `https://github.com/andro951/ember-adventures-tools/raw/refs/heads/main/downloads/${product}-skills.zip`;

test("packaged references validate against the real game and field snapshots match its current contract", () => {
    const validator = packaged.validator().createValidator(root);
    for (const kind of ["character", "story"]) {
        const value = packaged.json(`${prefix}-${kind}/references/reference-${kind}.json`);
        const before = JSON.stringify(value);
        const method = kind === "story" ? "validateStoryExport" : "validateCharacterExport";
        const result = validator.invoke(method, value);
        assert.equal(result.ok, true, JSON.stringify(result.errors));
        assert.equal(JSON.stringify(value), before);
        const fields = packaged.json(`${prefix}-${kind}/references/field-sets.json`);
        for (const [name, expected] of Object.entries(fields)) {
            validator.load(name);
            assert.deepEqual(Array.from(validator.ctx[name]), expected, name);
        }
    }
});

test("the packaged validator rejects unknown fields and incomplete character appearances", () => {
    const validator = packaged.validator().createValidator(root);
    const character = packaged.json(`${prefix}-character/references/reference-character.json`);
    character.character_definition.misspelled_field = true;
    assert.equal(validator.invoke("validateCharacterExport", character).ok, false);
    delete character.character_definition.misspelled_field;
    delete character.character_definition.appearance.shoulder_width;
    assert.equal(validator.invoke("validateCharacterExport", character).ok, false);
    const story = packaged.json(`${prefix}-story/references/reference-story.json`);
    story.storyTemplate.state.player.genres = ["fantasy"];
    assert.equal(validator.invoke("validateStoryExport", story).ok, false);
});

test("all packaged local reference links resolve inside the complete archive", () => {
    for (const [name] of packaged.entries) {
        if (!name.endsWith(".md"))
            continue;

        for (const match of packaged.text(name).matchAll(/\]\(([^)]+)\)/g)) {
            const target = match[1].replace(/^<|>$/g, "").split("#")[0];
            if (!target || /^\w+:\/\//.test(target))
                continue;

            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), target));
            assert(packaged.entries.has(resolved), `${name} references missing ${target}`);
        }
    }
});

test("assistant handoff prompts point to complete ZIPs without fetching loose skill files", async () => {
    const p = createProductionContext(root);
    let fetches = 0;
    p.context.fetch = () => { fetches++; throw new Error("No network permitted in this test."); };
    p.load("AUTHORING_SKILLS_ZIP_URL");
    p.load("AI_STORY_PROMPT_FALLBACKS");
    p.load("AI_CHARACTER_PROMPT_FALLBACKS");
    p.load("externalAiStoryPromptWithCursorSpace");
    for (const kind of ["Story", "Character"]) {
        for (const target of ["chatgpt", "codex"]) {
            const prompt = await p.invoke(`loadExternalAi${kind}Prompt`, target);
            assert(prompt.includes(zipUrl));
            assert(!/https:\/\/[^\s]+\/SKILL\.md/.test(prompt));
            assert(!prompt.includes("raw.githubusercontent.com"));
            assert(prompt.endsWith("\n\n"));
        }
    }
    assert.equal(fetches, 0);
});

test("both editor links select the same complete product ZIP and avoid duplicate links", () => {
    const p = createProductionContext(root);
    Object.assign(p.context, {
        document:{createElement:()=>({dataset:{}})},
        mountCharacterEditorGenres:()=>{},
        mountCharacterScaleModes:()=>{},
    });
    for (const kind of ["character", "story"]) {
        const links = [];
        const container = {querySelectorAll:()=>[], querySelector:()=>links[0] || null, prepend:link=>links.unshift(link)};
        p.invoke("appendAuthoringSkillLink", container, kind);
        p.invoke("appendAuthoringSkillLink", container, kind);
        assert.equal(links.length, 1);
        assert.equal(links[0].href, zipUrl);
        assert.equal(links[0].dataset.authoringSkillLink, kind);
    }
});