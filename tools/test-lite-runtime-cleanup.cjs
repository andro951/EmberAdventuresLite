const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createProductionContext } = require("./lib/production-declarations.cjs");
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const f = createProductionContext();
    f.context.EmberAppearanceScales = require("../src/contracts/appearance-scales.js");
    f.load("defaultSettings");
    f.load("defaultState");
    Object.assign(f.context, {
        app: {settings:plain(f.context.defaultSettings),state:plain(f.context.defaultState)},
        clone:structuredClone,
    });
    return f;
}
test("image prompts preserve body sliders, full outfits, held tools, and ordinary scene action", () => {
    const f = fixture();
    const entity = plain(f.context.defaultState.player);
    entity.name = "Test Sergeant";
    entity.gender = "female";
    entity.age = 41;
    entity.appearance.chest = 20;
    entity.appearance.shoulder_width = 20;
    entity.clothing.shirt = "forest-green military tunic";
    entity.clothing.pants = "charcoal canvas trousers";
    entity.held_items.left_hand = "wooden training baton";
    f.context.app.state.player = entity;
    f.context.app.state.scene.image_characters = [entity.name];
    f.context.app.state.scene.image_action = "watching archery practice";
    f.context.isUninspectedNpcPreviewEntity = () => false;
    const result = f.invoke("buildImagePrompt", entity.name, entity);
    assert.match(result, /Extremely massive K-cup breasts/);
    assert.match(result, /forest-green military tunic/);
    assert.match(result, /charcoal canvas trousers/);
    assert.match(result, /wooden training baton/);
    assert.match(result, /watching archery practice/);
    assert(!/visible genitals|sex-act|futanari|bottomless|naked/i.test(result));
});
test("image clothing coverage is projected without modifying saved equipment", () => {
    const f = fixture();
    const clothing = f.invoke("blankClothingTemplate");
    const before = JSON.stringify(clothing);
    const context = f.invoke("createImagePromptContext", {gender:"female"});
    const projected = f.invoke("projectClothingForImagePrompt", clothing, {gender:"female"}, context);
    assert.equal(projected.undershirt, "opaque full-coverage shirt");
    assert.equal(projected.pants, "opaque full-length trousers");
    assert.equal(JSON.stringify(clothing), before);
    assert.equal(context.chestCovered, true);
    assert(!/nsfw|spicy|forceSfw/i.test(JSON.stringify(context)));
});
test("normal state synchronization counts only the retained state steps", () => {
    const f = fixture();
    f.context.app.stateSync = {running:true,stateSnapshot:f.context.app.state};
    f.context.groupedStateWorkItems = () => [{groupId:"scene_time"},{groupId:"relationships"}];
    assert.equal(f.invoke("stateSyncTotalStepCount"), 3);
    assert.equal(f.invoke("messageStateWasProcessed", {stateSyncStatus:"synced"}), true);
    assert.equal(f.invoke("messageStateWasProcessed", {stateSyncStatus:"pending"}), false);
});
test("ordinary settings autosave only the changed control and preserve developer mode", () => {
    const f = fixture();
    const controls = {autoVoice:{type:"checkbox",checked:false},preferredCharacterGender:{value:"female"}};
    const saved = [];
    Object.assign(f.context, {
        $:id=>controls[id], pruneImageHistory:()=>{}, stopReadingMessage:()=>saved.push("stop"),
        saveSettingsNow:()=>saved.push("settings"),saveProfilesNow:()=>saved.push("profiles"),
        applyReducedUiClass:()=>{},renderThread:()=>{},closeModal:()=>{},
    });
    const before = f.context.app.settings.preferredCharacterGender;
    f.invoke("saveSettingsFromModal", false, {settingIds:["autoVoice"]});
    assert.equal(f.context.app.settings.autoVoice, false);
    assert.equal(f.context.app.settings.preferredCharacterGender, before);
    assert.equal(f.context.app.settings.devMode, true);
    assert(saved.includes("settings") && saved.includes("profiles"));
    f.invoke("saveSettingsFromModal", false, {settingIds:["preferredCharacterGender"]});
    assert.equal(f.context.app.settings.preferredCharacterGender, "female");
    assert(!/minBoobSize|maxBoobSize|spiceLevel|logLovense/.test(JSON.stringify(f.context.app.settings)));
});
test("profile art style is included in the canonical profile-owned settings", () => {
    const f = fixture();
    assert(f.invoke("profileSettingKeys").includes("defaultProfileImageModel"));
    assert.equal(f.invoke("validateUserProfileDefinition", f.invoke("makeUserProfileFromDraft", {profile_name:"Test Profile",character_boldness_offset:0})).ok, true);
});
test("settings UI retains ordinary controls and provider setup without removed mode controls", () => {
    const f = fixture();
    const nodes = [];
    const create = tag => {
        const node = {tagName:tag.toUpperCase(),children:[],textContent:"",value:"",append(...children){this.children.push(...children);},querySelector(){return null;}};
        nodes.push(node);
        return node;
    };
    const box = create("div");
    const providers = [];
    Object.assign(f.context, {
        document:{createElement:create},$:id=>id === "modalBox" ? box : nodes.find(node=>node.id === id),
        loadVoices:()=>{},userProfileById:()=>null,visibleVoices:()=>[{name:"Test voice",lang:"en-US"}],
        imageModelOptions:()=>[{value:"fantasy-rpg",label:"Fantasy RPG"}],openModal:()=>{},
        downloadAllKeptImages:()=>{},openBoldnessModal:()=>{},openPublicPrivacyNotice:()=>{},
        openDevTraceModal:()=>{},openDevSmokeSuiteModal:()=>{},
        appendGenerationSettings:()=>providers.push("hosted"),appendOllamaSettings:()=>providers.push("ollama"),
        bindVoicePreviewControls:()=>{},bindSettingsAutoSave:()=>{},
    });
    f.invoke("openSettingsModal");
    for (const id of ["autoVoice","autoImages","preferredCharacterGender","stateCheckMode","imageMode","narratorVoiceName","defaultMalePlayerVoiceName","defaultNonMalePlayerVoiceName","imageHistoryLimit","autoModeType"])
        assert(nodes.some(node=>node.id === id), id);
    assert.deepEqual(providers,["hosted","ollama"]);
    assert(!/nsfw|spicy|lovense|kink|boob/i.test(nodes.map(node=>node.id || node.textContent).join(" ")));
    assert(nodes.some(node=>node.textContent === "Developer tools"));
});
test("live grouped updater prompts assign body and mood work to ordinary state groups", () => {
    const f = fixture();
    f.context.playerNameForPrompt = () => "Test Player";
    for (const group of f.invoke("stateCheckGroups")) {
        const prompt = f.invoke("buildGroupedStateInstruction",group,"assistant","The sergeant rests after training.",{},{characterName:"Test Sergeant"});
        assert(!/nsfw|spicy|arousal|sex_position|sex_acts/i.test(prompt),group.id);
        if (group.id === "character_body") assert.match(prompt,/physical_state, and pose/);
        if (group.id === "character_mind") assert.match(prompt,/Own state_of_mind/);
    }
    const prompt = f.invoke("buildStateCheckInstruction","assistant","The sergeant rests after training.","{}");
    assert(!/nsfw|spicy|arousal|sex_position|sex_acts/i.test(prompt));
});
test("generated job catalog initializes and keeps ordinary jobs without adult templates", () => {
    const f = fixture();
    f.load("GENERATED_JOB_LIBRARY");
    const jobs = f.context.GENERATED_JOB_LIBRARY;
    assert(jobs.length > 100);
    assert(jobs.some(job=>job.id === "cellar_pest_cleanup_quiet"));
    assert(jobs.every(job=>job.id && job.title && Number.isFinite(job.rank)));
    assert(!/nsfw|seductive|brothel|courtesan|lust.curse|lewd|breeding/i.test(JSON.stringify(jobs)));
    assert(jobs.some(job=>job.genres.includes("romance")));
});
test("new world setup uses the selected profile and begins with story configuration", () => {
    const f = fixture();
    const events = [];
    Object.assign(f.context, {
        activeUserProfile:()=>({id:"fixture-profile"}),clearSetupModalScrollPositions:()=>{},
        renderMainMenu:()=>{},renderOnboardingStep:()=>events.push("story"),
    });
    f.invoke("beginOnboardingWorldSetup");
    assert.equal(f.context.app.onboardingDraft.step,6);
    assert.deepEqual(events,["story"]);
    assert(!/spic|nsfw|kink|adult_warning/.test(JSON.stringify(f.context.app.onboardingDraft)));
    assert.deepEqual(Array.from(f.invoke("onboardingFlowItems"),pair=>pair[0]),["story_library","story","player","cast","guidance"]);
    assert.equal(f.invoke("normalizeOnboardingStep",5,-1),6);
    assert.equal(f.invoke("normalizeOnboardingStep",9,1),8);
});

test("ordinary image collectors coalesce requests, preserve target isolation, and flush the previous turn", async () => {
    const f=fixture();
    const player=structuredClone(f.context.app.state.player);player.name="Smoke Collector Player";
    const ally=structuredClone(player);ally.id="smoke-collector-ally";ally.name="Smoke Collector Ally";
    const state=f.context.app.state;
    state.player=player;state.characters={[ally.name]:ally};
    state.scene.party_members_present=[player.name,ally.name];
    state.scene.image_characters=[ally.name];
    const generated=[];
    Object.assign(f.context,{clearTimeout(){},generateImage:async(reason,options)=>{generated.push({reason,options});return {};},log(){}});
    f.context.app.settings.autoImages=true;
    for(const name of ["currentTurnSceneImageCollector","flushTurnSceneImageCollector","chooseTurnSceneImageRequests","turnSceneImageRequestPriority","normalizeNameForMatch"])
        f.load(name);
    f.invoke("startTurnSceneImageCollector","first");
    assert.equal(f.invoke("requestTurnSceneImage","player outfit",{kind:"clothing",targets:[player.name]}),false);
    for(let i=0;i<2;i++)
        f.invoke("requestTurnSceneImage","ally outfit",{kind:"clothing",targets:[ally.name]});
    assert.equal(f.context.app.turnSceneImageCollector.requests.length,1);
    assert.equal(generated.length,0);
    f.invoke("startTurnSceneImageCollector","second");
    assert.equal(generated.length,1);
    assert.deepEqual(Array.from(generated[0].options.targets),[ally.name]);
    assert.equal(f.context.app.turnSceneImageCollector.id,"second");
    f.invoke("cancelTurnSceneImageCollector");
    assert.equal(f.invoke("requestTurnSceneImage","manual",{ignoreAutoImages:true}),true);
    assert.equal(generated.length,2);
});
