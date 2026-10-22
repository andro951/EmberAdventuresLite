"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { root, validate, invoke, invokeIsolated, ctx } = require("./validate-story-files.cjs");
const files = ["After-Hours-at-Orison-Station.json", "high-hook-emberadventures-story.json", "Horizon-University.json", "Mayor-Goostave.json", "The-Office-Wallflower.json", "The-Unwanted-Inheritance.json"];
const counts = [24, 18, 40, 17, 24, 23];
let routes = 0;
let characters = 0;

for (const [index, filename] of files.entries()) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, "stories", filename), "utf8"));
    const result = validate(payload);
    assert.equal(result.ok, true, `${filename}: ${JSON.stringify(result.errors)}`);
    assert.equal(payload.storyTemplate.state.objectives.items.length, counts[index], `${filename}: preserve all story nodes`);
    ctx.app = {};
    for (const entry of invoke("storyDefinitionCharacterEntries", payload.storyTemplate)) {
        const character = entry.character;
        const materialized = invoke(entry.path.endsWith("animal_definition") ? "materializeAnimalDefinitionForRuntimeFields" : "materializeCharacterDefinitionForRuntimeFields", character, character.name);
        assert.equal(materialized.name, character.name);
        characters++;
    }

    const localRewardTypes = new Set(["adjust_story_inventory", "add_state_list_item", "set_state_field", "add_story_item", "add_story_rule", "remove_story_rule", "unlock_location"]);
    for (const objective of payload.storyTemplate.state.objectives.items) {
        const rewards = [...(objective.rewards || []), ...(objective.choices || []).flatMap(choice => choice.rewards || [])];
        for (const reward of rewards.filter(item => localRewardTypes.has(item.type))) {
            const { args: [state] } = invokeIsolated("applyObjectiveReward", () => {
                const state = structuredClone(payload.storyTemplate.state);
                ctx.app = { state: payload.storyTemplate.state, objectiveRewardPreflightActive: true };
                return [state, objective, reward];
            });
            if (reward.type === "adjust_story_inventory") {
                const field = reward.field_path[1];
                const previous = payload.storyTemplate.state.story_inventory[field];
                assert.equal(state.story_inventory[field], previous + reward.amount, `${filename}: ${objective.id} inventory reward`);
            }
        }
    }

    //Exercise production transition selection and input gates, independently of AI narration.
    for (const counter of [-100, 0, 100]) {
        for (let choiceIndex = 0; choiceIndex < 8; choiceIndex++) {
            const state = structuredClone(payload.storyTemplate.state);
            for (const key of Object.keys(state.story_inventory)) {
                if (typeof state.story_inventory[key] === "number")
                    state.story_inventory[key] = counter;
            }

            ctx.app = { state, storyDefinition: { objectivesById: Object.fromEntries(state.objectives.items.map(item => [item.id, item])) }, runtimeDefinitions: { jobsById: {} } };
            let current = state.objectives.items.find(item => item.id === state.objectives.active_id);
            let ended = false;
            for (let step = 0; step < 100; step++) {
                assert.equal(invoke("objectivePrerequisitesMet", current, state), true, `${filename}: blocked ${current.id}`);
                const output = current.completion_control === "choice" ? current.choices[choiceIndex % current.choices.length] : invoke("matchingObjectiveNextTransition", current, state)?.option;
                assert.ok(output, `${filename}: no output from ${current.id}`);
                current.status = "complete";
                current.selected_output_id = output.id;
                ctx.app.objectiveRuntimeLookup = null;
                if (output.ending_type) {
                    ended = true;
                    break;
                }

                const nextId = output.objective_id || output.next_objective_id;
                current = state.objectives.items.find(item => item.id === nextId);
                assert.ok(current, `${filename}: missing ${nextId}`);
                state.objectives.active_id = nextId;
            }

            assert.equal(ended, true, `${filename}: route did not reach an ending`);
            routes++;
        }
    }

    //Exercise each numeric branch separately so a high first counter cannot mask later branches.
    for (const objective of payload.storyTemplate.state.objectives.items) {
        const outputs = objective.next_objectives || [];
        const conditions = outputs.flatMap(output => output.requirements || []);
        if (!conditions.length || !conditions.every(condition => condition.path?.startsWith("story_inventory.") && [">=", "<="].includes(condition.op)))
            continue;

        for (const expected of outputs) {
            const state = structuredClone(payload.storyTemplate.state);
            for (const condition of conditions) {
                state.story_inventory[condition.path.split(".")[1]] = condition.value + (condition.op === ">=" ? -1 : 1);
            }

            for (const condition of expected.requirements || []) {
                state.story_inventory[condition.path.split(".")[1]] = condition.value;
            }

            ctx.app = { state };
            assert.equal(invoke("matchingObjectiveNextTransition", objective, state)?.option.id, expected.id, `${filename}: conditional branch ${expected.id}`);
        }
    }

    //Every optional activity must return to the selected main node instead of ending it.
    for (const side of payload.storyTemplate.state.objectives.items.filter(item => item.type === "side")) {
        for (const output of side.next_objectives.filter(item => item.objective_id)) {
            const state = structuredClone(payload.storyTemplate.state);
            state.objectives.active_id = output.objective_id;
            ctx.app = { state, storyDefinition: { objectivesById: Object.fromEntries(state.objectives.items.map(item => [item.id, item])) }, runtimeDefinitions: { jobsById: {} } };
            const selected = invoke("matchingObjectiveNextTransition", side, state);
            assert.equal(selected?.target?.id, output.objective_id, `${filename}: side quest ${side.id} lost selected main node`);
        }
    }

    const invalid = structuredClone(payload);
    invalid.storyTemplate.state.player.romanceable = null;
    assert.equal(validate(invalid).ok, false, `Reject invalid character fields`);
    invalid.storyTemplate.state.player.romanceable = false;
    invalid.storyTemplate.state.objectives.items[0].while_active_guidance = "";
    assert.equal(validate(invalid).ok, false, `Reject incomplete graph nodes`);
    console.log(`${filename}: strict import and routing passed`);
}

console.log(`Passed: six stories, ${characters} character conversions, ${routes} routing scenarios, side quest return checks and invalid-input rejection.`);