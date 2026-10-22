const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadAuthoringSkills} = require('./lib/authoring-skills.cjs');
const root = path.resolve(__dirname, '..');
const packaged = loadAuthoringSkills(root, "EmberAdventuresLite");
const validator = packaged.validator().createValidator(root);
const read = file => file.startsWith('skills/') ? packaged.json(file.slice(7)) : JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const character = read('skills/emberadventureslite-character/references/reference-character.json');
const reference = read('skills/emberadventureslite-story/references/reference-story.json');
const story = read('stories/The-Last-Light-at-Bramble-Bridge.json');
let checks = 0;
function check(name, method, input, expected) {
    const result = validator.invoke(method, input);
    assert.equal(result.ok, expected, `${name}: ${JSON.stringify(result.errors)}`);
    checks++;
    console.log(`PASS ${name}`);
}
check('standalone character reference', 'validateCharacterExport', character, true);
check('complete story reference', 'validateStoryExport', reference, true);
check('branched short story', 'validateStoryExport', story, true);
const libraryOnly = structuredClone(story);
delete libraryOnly.storyTemplate.state.player;
delete libraryOnly.storyTemplate.state.players;
delete libraryOnly.storyTemplate.state.story_inventory;
delete libraryOnly.storyTemplate.any_player_starting_state;
check('effective browser library-only optional fields', 'validateStoryExport', libraryOnly, true);
const badBody = structuredClone(character);
delete badBody.character_definition.appearance.upper_body_build;
check('missing required body scale rejected', 'validateCharacterExport', badBody, false);
const oldBody = structuredClone(character);
oldBody.character_definition.appearance.body_description = 'An obsolete grouped description';
check('unsupported appearance field rejected', 'validateCharacterExport', oldBody, false);
const badEmbedded = structuredClone(story);
badEmbedded.storyTemplate.state.player.genres = ['fantasy'];
check('standalone metadata rejected inside story', 'validateStoryExport', badEmbedded, false);
const badChoice = structuredClone(story);
badChoice.storyTemplate.state.objectives.items[1].completion_criteria = 'Choose a method';
check('choice criteria rejected', 'validateStoryExport', badChoice, false);
const badRules = structuredClone(story);
badRules.storyTemplate.state.story_rules = ['A string is not a rule object.'];
check('incorrect rule shape rejected', 'validateStoryExport', badRules, false);
const badMode = structuredClone(story);
badMode.storyTemplate.state.objectives.items[1].choice_response_mode = 'generate';
check('incorrect choice mode rejected', 'validateStoryExport', badMode, false);
const brokenTarget = structuredClone(story);
brokenTarget.storyTemplate.state.objectives.items[0].next_objectives[0].objective_id = 'missing-objective';
check('missing objective destination rejected', 'validateStoryExport', brokenTarget, false);
const batch = {characters: [structuredClone(character)]};
check('documented character batch wrapper', 'validateCharacterExport', batch, true);
const bytesBefore = JSON.stringify(story);
check('repeat validation remains stable', 'validateStoryExport', story, true);
assert.equal(JSON.stringify(story), bytesBefore, 'Validator mutated authored story');
const playerOptions = validator.invoke('storyTemplatePlayerOptions', story.storyTemplate);
assert.equal(playerOptions.length, 1);
assert.equal(playerOptions[0].name, 'Rowan Reed');
assert.deepEqual(story.storyTemplate.state.players[0], story.storyTemplate.state.player);
checks++;

//Contract parity checks use the actual production declarations, never a second validator.
for (const kind of ['character', 'story']) {
    const sets = read(`skills/emberadventureslite-${kind}/references/field-sets.json`);
    for (const [name, expected] of Object.entries(sets)) {
        validator.load(name);
        assert.deepEqual(Array.from(validator.ctx[name]), expected, `${name} drifted`);
        checks++;
    }
}

//Authoring graph review: both deliberate alternatives must reach the same free-play ending.
const nodes = new Map(story.storyTemplate.state.objectives.items.map(node => [node.id, node]));
const visited = new Set();
let endings = 0;
function trace(id, trail = new Set()) {
    assert(!trail.has(id), `Unexpected objective loop at ${id}`);
    assert(nodes.has(id), `Missing objective ${id}`);
    visited.add(id);
    const nextTrail = new Set([...trail, id]);
    const node = nodes.get(id);
    const outputs = node.choices || node.next_objectives;
    assert(outputs?.length, `No outputs at ${id}`);
    for (const output of outputs) {
        if (output.ending_type) {
            assert.equal(output.ending_type, 'freeplay');
            assert(output.ending_message);
            endings++;
        } else {
            trace(output.objective_id || output.next_objective_id, nextTrail);
        }
    }
}
trace(story.storyTemplate.state.objectives.active_id);
assert.equal(visited.size, nodes.size);
assert.equal(endings, 2);
checks++;
console.log(`PASS ${checks} authoring/contract checks, including both authored ending paths.`);