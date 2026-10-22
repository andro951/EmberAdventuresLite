const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {performance} = require("node:perf_hooks");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const {characterFixture} = require("./lib/canonical-lite-fixtures.cjs");
const root = path.resolve(__dirname,"..");
const read = file => fs.readFileSync(path.join(root,"src",file),"utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function production() {
    const p = createProductionContext();
    p.context.EmberAppearanceScales = require("../src/contracts/appearance-scales.js");
    p.load("defaultSettings");
    p.load("defaultState");
    Object.assign(p.context, {
        app:{settings:plain(p.context.defaultSettings),state:plain(p.context.defaultState),profileImages:[],userProfiles:[]},
        clone:value=>structuredClone(value),
    });
    return p;
}

test("the selectable-player fixture exports canonical definitions without orphaned profile image ids",()=>{
    const p = production();
    p.context.crypto = require("node:crypto").webcrypto;
    p.context.app.devSmokeSuite = {running:true};
    for (const name of ["blankCharacterTemplate","blankAppearanceTemplate"])
        p.invoke(name);
    const source = read("scripts/app/17-smokes-core.js");
    const start = source.indexOf("                const maleOptionOutfit =");
    const end = source.indexOf("                devAssert(",start);
    const fixture = vm.runInContext(`(() => {${source.slice(start,end)} return templateInput;})()`,p.context);
    const record = p.invoke("devSmokeStoryRecord",{
        id:"smoke-selectable-fixture",title:"Smoke Selectable Fixture",player:fixture.player,players:fixture.players,
        objectives:fixture.objectives.items,active_id:"choose-road",
    });
    const exported = p.invoke("storyDefinitionForExport",record);
    const validation = p.invoke("validateStoryDefinition",exported);
    assert.equal(validation.ok,true,JSON.stringify(validation.errors));
    for (const character of [exported.state.player,...exported.state.players]) {
        const runtime = p.invoke("materializeCharacterDefinitionForRuntimeFields",character);
        assert.doesNotThrow(()=>p.invoke("resolveActiveProfileImageReference",runtime));
    }
});

test("the app's runtime-save command passes the real worker contract and materializes storage records",async()=>{
    const p = production();
    const state = p.context.app.state;
    state.player = p.invoke("materializeCharacterDefinitionForRuntimeFields",characterFixture());
    state.scene.image_characters = [state.player.name];
    state.scene.party_members_present = [];
    state.scene.npcs_present = [];
    state.npc_directory = {locations:{"starting-area":{label:"Starting Area",characters:{}}}};
    state.characters = {};
    state.objectives = JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures/compatibility-lite-story.json"),"utf8")).storyTemplate.state.objectives;
    p.context.definition = {storyId:"smoke-regression-story",revisionId:"smoke-revision",contentHash:"smoke-hash"};
    p.context.generatedTitle = "Smoke Regression Story";
    p.context.options = {};
    p.context.app.messages = [];
    let command;
    p.context.app.library = {materializeRuntimeGame:values => {command = plain(values);}};
    const source = read("scripts/app/03-messages-saves.js");
    const expression = source.match(/app\.library\.materializeRuntimeGame\(\{[^]*?\n            \}\)/)[0];
    p.load("textSlot");
    vm.runInContext(expression,p.context);
    const worker = vm.createContext({self:{},structuredClone,TextEncoder,performance,postMessage(){}});
    vm.runInContext("globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));",worker);
    vm.runInContext(read("workers/library-worker.js"),worker);
    worker.commandJson = JSON.stringify({type:"story.materialize-runtime-game",requestId:1,...command});
    vm.runInContext("globalThis.command = JSON.parse(commandJson)",worker);
    const result = plain(await vm.runInContext("materializeNewGame(command)",worker));
    assert.equal(result.header.playerCharacterId,state.player.id);
    assert(result.initialRecords.some(entry=>entry.storeName === "characterAppearance"));
    const recordsByStore = {};
    for (const entry of result.initialRecords)
        (recordsByStore[entry.storeName] ||= []).push({saveId:1,...entry.record});
    const storage = vm.createContext({self:new EventTarget(),importScripts(){},Blob,setInterval,clearInterval});
    vm.runInContext(read("persistence/schema-contract.js") + read("persistence/domain-operation-contract.js") + read("persistence/persistence-worker.js"),storage);
    storage.rowsJson = JSON.stringify(recordsByStore);
    vm.runInContext(`for (const [name,rows] of Object.entries(JSON.parse(rowsJson))) for (const row of rows) validateRecord(name,row,1);`,storage);
    worker.generatedJson = JSON.stringify({definition:result.immutableStory.definition,header:{saveId:1,...result.header},recordsByStore});
    const restored = vm.runInContext(`(() => {const value = JSON.parse(generatedJson); return compatibilityRuntimeState(value.definition,value.header,value.recordsByStore);})()`,worker);
    assert.equal(restored.player.id,state.player.id);
    assert.equal(restored.player.appearance.chest,state.player.appearance.chest);
    worker.command.lite = true;
    await assert.rejects(vm.runInContext("materializeNewGame(command)",worker),/lite is not an approved field/);
});

test("local story image uploads require the ordinary suitability confirmation",async()=>{
    const p = production();
    const confirmations = [];
    p.context.showConfirm = async (...args)=>{confirmations.push(args);return true;};
    assert.equal(await p.invoke("requestStoryImageClassificationAttestation"),"sfw");
    assert.match(confirmations[0][1],/suitable for a general audience/);
    p.context.showConfirm = async ()=>false;
    assert.equal(await p.invoke("requestStoryImageClassificationAttestation"),null);
});

test("manually created library characters carry the required Lite marker and validate when completed",()=>{
    const p = production();
    p.context.crypto = require("node:crypto").webcrypto;
    p.context.window = {crypto:p.context.crypto};
    const draft = p.invoke("newManualLibraryCharacterDraft");
    assert.equal(draft.lite,true);
    Object.assign(draft,{
        name:"Smoke Manual Fixture",fallback_name:"Smoke Manual Alternate",age:30,gender:"female",
        role:"Test companion",personality_description:"A patient synthetic test companion.",speech_style:"Clear and concise.",
        genres:["fantasy"],starting_known_facts:["Corrected synthetic fact","Synthetic fact 2","Synthetic fact 3"],
        starting_inventory:["Synthetic item 0","Synthetic item 2","Synthetic item 3"],
        starting_held_items:{left_hand:"Test mallet",right_hand:"Test chisel"},
    });
    draft.appearance.species = "human";
    draft.outfits[0].name = "Test Outfit";
    draft.fallback_outfits[0].name = "Alternate Outfit";
    const validation = p.invoke("validateCharacterDefinition",draft);
    assert.equal(validation.ok,true,JSON.stringify(validation.errors));
});

test("outer garments hide underclothing in full-body and portrait prompts without changing equipment",()=>{
    const p = production();
    for (const gender of ["male","female"]) {
        const clothing = p.invoke("blankClothingTemplate");
        Object.assign(clothing,{shirt:"forest-green tunic",pants:"charcoal trousers",bra:"support bra",underwear:"plain underwear",right_wrist:"red cord",left_wrist:"blue cuff"});
        const before = JSON.stringify(clothing);
        for (const profile of [false,true]) {
            const result = p.invoke("joinVisibleClothing",clothing,{entity:{gender},profile});
            assert(result.includes("forest-green tunic"));
            assert(!/underwear|support bra|underneath/.test(result));
            assert(result.includes("right wrist: red cord"));
            assert(result.includes("left wrist: blue cuff"));
        }
        assert.equal(JSON.stringify(clothing),before);
    }
});

test("batch outfit reset chooses the authored start before any current selection",()=>{
    const p = production();
    const entity = {starting_outfit_id:"travel",active_outfit_id:"formal",outfits:[
        {id:"formal",name:"Formal",clothing:{shirt:"formal shirt"}},
        {id:"travel",name:"Travel",clothing:{shirt:"travel shirt"}},
    ]};
    assert.equal(p.invoke("batchCharacterImageToolInitialOutfitId",entity),"travel");
    assert.equal(entity.active_outfit_id,"formal");
});

test("ordinary presentation preferences materialize names, outfits and scene references consistently",()=>{
    const p = production();
    const profile = p.invoke("makeUserProfileFromDraft",{profile_name:"Regression Profile",character_boldness_offset:0});
    profile.id = "smoke-regression-profile";
    profile.settings.preferredCharacterGender = "male";
    p.context.app.userProfiles = [profile];
    p.context.app.settings.activeUserProfileId = profile.id;
    const freshEntity = () => p.invoke("materializeCharacterDefinitionForRuntimeFields",characterFixture());
    const entity = freshEntity();
    p.context.app.state.characters = {[entity.name]:entity};
    p.context.app.state.scene.party_members_present = [entity.id];
    p.context.app.state.scene.image_characters = [entity.name];
    //Resolve dependencies before the mutating entry point; the declaration loader retries missing names.
    for (const name of ["adaptRuntimeCharacterGender","materializeRuntimeCharacterPresentation","replaceExactRuntimeNameValues","replaceRuntimeSceneEntityIds","rekeyRuntimeNamedCharacterMap"])
        p.load(name);
    p.invoke("materializeRuntimeSavePresentations",structuredClone(p.context.app.state));
    p.context.app.state.characters = {[characterFixture().name]:freshEntity()};
    const result = p.invoke("materializeRuntimeSavePresentations",p.context.app.state);
    p.invoke("finalizeRuntimeCharacterNameKeys",result);
    const adapted = result.characters["Fixture Archive Clerk"];
    assert(adapted);
    assert.equal(adapted.gender,"male");
    assert.equal(adapted.id,entity.id);
    assert.equal(result.scene.party_members_present[0],adapted.name);
    assert.equal(result.scene.image_characters[0],adapted.name);
});

test("current outfit metadata and feedback fixtures use supported contracts",()=>{
    const p = production();
    const invalid = p.invoke("outfitDefinitionValidationErrors",{id:"smoke",name:"Smoke",contexts:["work",""],formality:"formal",clothing:{shirt:"shirt"}},"outfit");
    assert(invalid.some(error=>error.path === "outfit.contexts"));
    assert(invalid.some(error=>error.path === "outfit.formality"));
    const feedback = [
        p.invoke("createPublicStoryFeedback",{entry_id:"smoke-feedback",type:"rating",rating:5,comment:"Good story",creator:"tester",at:"2026-10-22T00:00:00.000Z"}),
        p.invoke("createPublicStoryFeedback",{entry_id:"smoke-feedback",type:"report",report_reason:"wrong genre or tags",comment:"Check genres",creator:"tester",at:"2026-10-22T00:00:00.000Z"}),
    ];
    const summary = p.invoke("publicLibraryStoryFeedbackSummary",{story_feedback:feedback},"smoke-feedback");
    assert.equal(summary.ratingCount,1);
    assert.equal(summary.reportCount,1);
});

test("message deletion restores processing-state backups and leaves untouched pending state alone",()=>{
    for (const status of ["pending","processing","synced"]) {
        const p = production();
        const app = p.context.app;
        const backup = {id:"smoke-backup",startMessageId:"smoke-user"};
        app.messages = [
            {id:"smoke-user",entryId:1,role:"user",stateSyncStatus:status},
            {id:"smoke-reply",entryId:2,role:"assistant",stateSyncStatus:status,stateBackupId:backup.id,stateBackupStartMessageId:"smoke-user"},
            {id:"smoke-tail",entryId:3,role:"assistant",stateSyncStatus:"pending"},
        ];
        app.snapshots = [backup];
        app.saveSessionActive = false;
        let cancelled = false;
        Object.assign(p.context,{
            findMessageById:id=>app.messages.find(message=>message.id === id),
            activeStateSyncBlockBackupForMessage:()=>backup,
            cancelStateWorkForMessageMutation:()=>{cancelled = true;},
            restoreRuntimeSnapshotForMessageRollback:()=>{app.state.scene.summary = "Before update";},
            pruneSnapshotsAfter:()=>{},rebuildMessageIndex:()=>{},touchMessageRevision:()=>{},
            stopReadingMessageIfActive:()=>{},clearPendingVoiceMetadataGate:()=>{},
            cancelAiRequestsForMessage:()=>{},cancelActiveStateCheckForMessage:()=>{},
        });
        for (const name of ["messageMutationAllowed","messageStateWasProcessed","messageBroadStateWasProcessed","stateBackupForMessage","restoreMessageMutationBackup","trimMessagesForMutation","isStoryMessageRole"])
            p.load(name);
        app.state.scene.summary = "During update";
        const result = p.invoke("prepareMessageStateMutation",app.messages[1],{mode:"delete",reason:"Node regression"});
        assert.equal(result.restored,status !== "pending");
        assert.equal(result.needsFullStateRecheck,status !== "pending");
        assert.equal(app.state.scene.summary,status === "pending" ? "During update" : "Before update");
        assert.deepEqual(Array.from(app.messages,message=>message.id),["smoke-user"]);
        assert.equal(result.stateRecheckStartEntryId,1);
        assert(cancelled);
    }
});

test("player patches routed through characters retain exact player ownership and structural sharing",()=>{
    const p = production();
    p.context.log = ()=>{};
    const state = p.context.app.state;
    state.player.name = "Smoke Routed Player";
    state.player.id = "smoke-routed-player";
    state.characters = {"Smoke Routed Ally":{...structuredClone(state.player),id:"smoke-routed-ally",name:"Smoke Routed Ally"}};
    const patch = {characters:{[state.player.name]:{role:"Route fixture player"}}};
    const result = p.invoke("applyStatePatch",state,patch,{currentState:state,targeted:true,source:"Node player ownership regression"});
    assert.deepEqual(Array.from(result.__runtimePatchRoots),["player"]);
    assert.deepEqual(Array.from(result.__runtimePatchCharacterKeys),[]);
    assert.equal(result.characters,state.characters);
    assert.equal(result.player.role,"Route fixture player");
    assert(!Object.hasOwn(result.characters,state.player.name));
    assert.notEqual(state.player.role,"Route fixture player");
    patch.characters["Smoke Routed Ally"] = {role:"Route fixture ally"};
    const mixed = p.invoke("applyStatePatch",state,patch,{currentState:state,targeted:true,source:"Node mixed ownership regression"});
    assert.deepEqual(Array.from(mixed.__runtimePatchCharacterKeys),["Smoke Routed Ally"]);
    assert.equal(mixed.player.role,"Route fixture player");
    assert.equal(mixed.characters["Smoke Routed Ally"].role,"Route fixture ally");
});

test("smoke 139 verifies anonymous reports and cleans temporary hosting records on success or failed assertions",async()=>{
    for (const fault of ["", "missing report", "unexpected rating"]) {
        const p = production();
        const originalIndex = {items:[]};
        p.context.app.publicLibraryLastIndex = originalIndex;
        const reports = new Map();
        const items = new Map();
        const uploads = new Set();
        const assertions = [];
        let creatorCleaned = false;
        let sessionSaved = false;
        let saved = false;
        let rendered = false;
        Object.assign(p.context,{
            crypto:require("node:crypto").webcrypto,
            devTestLog:()=>{},
            devAssert:(condition,message)=>{assert(condition,message);assertions.push(message);},
            publicLibrarySupabaseConfigured:()=>true,
            publicLibrarySupabaseUrl:()=>"https://fixture.invalid",
            publicLibrarySupabaseAnonKey:()=>"fixture-public-key",
            hostedUploadSupported:()=>true,
            devRequireLivePublicHostingSmokeUser:async()=>({id:"fixture-user"}),
            devCreateTemporaryPublicHostingCreator:async()=>({creator_name:"Fixture Creator",creator_id:"fixture-creator"}),
            devSmokeTemplateRecord:value=>value,
            devUploadTemporaryStoryTemplatePayload:async()=>{uploads.add("fixture-upload");return {fileName:"fixture-upload"};},
            publicUploadFileUrl:name=>`https://fixture.invalid/${name}`,
            publicLibraryStoryMetadata:story=>({id:story.id,url:"https://fixture.invalid/payload"}),
            upsertPublicLibraryEntryToSupabase:async entry=>{
                items.set("fixture-item",{id:"fixture-item"});
                return {entry,item:{id:"fixture-item"}};
            },
            devSmokePublicLibraryIndex:value=>value,
            submitPublicStoryRating:async()=>{throw new Error("Cannot rate your own published item");},
            addPublicStoryFeedback:async()=>{throw new Error("Obsolete feedback submission must not run");},
            postgrestValue:encodeURIComponent,
            publicLibraryFetch:async(route,options={})=>{
                const url = new URL(route,"https://fixture.invalid");
                const table = url.pathname.split("/").at(-1);
                if (table === "library_feedback" && options.method === "POST")
                    throw new Error("403 row-level security policy");

                if (table === "library_reports") {
                    if (options.method === "POST") {
                        assert.equal(options.auth,false);
                        assert.equal(options.body.uploader_id,"fixture-user");
                        reports.set(options.body.id,{...options.body,reporter_id:null});
                        return [];
                    }

                    const id = url.searchParams.get("id").slice(3);
                    if (options.method === "DELETE") {
                        reports.delete(id);
                        return [];
                    }

                    return fault === "missing report" ? [] : [...reports.values()].filter(row=>row.id === id);
                }

                if (table === "library_items")
                    return [...items.values()];

                if (table === "library_feedback")
                    return [];

                if (table === "library_ratings")
                    return fault === "unexpected rating" && items.size ? [{item_id:"fixture-item",rating:5}] : [];

                throw new Error(`Unexpected fixture request: ${route}`);
            },
            cleanupPublicLibrarySupabaseResults:async results=>{
                for (const result of results) {
                    assert.equal(result.item.id,"fixture-item");
                    items.delete(result.item.id);
                }
            },
            cleanupHostedUploads:async values=>{
                for (const upload of values)
                    uploads.delete(upload.fileName);
            },
            devCleanupTemporaryPublicHostingCreators:async()=>{creatorCleaned = true;},
            saveSupabaseSession:()=>{sessionSaved = true;},
            addMessage:()=>{},
            scheduleActiveGameSave:()=>{saved = true;},
            render:()=>{rendered = true;},
        });
        const run = p.invoke("devRunSupabaseLiveFeedbackCleanupSmokeTest");
        if (fault)
            await assert.rejects(run,fault === "missing report" ? /anonymous feedback report is stored/ : /leave no feedback or rating rows/);
        else {
            await run;
            assert(assertions.some(message=>message.includes("anonymous feedback report is stored")));
            assert(assertions.some(message=>message.includes("deleted temporary rating, report, and item rows")));
        }

        assert.equal(reports.size,0,fault);
        assert.equal(items.size,0,fault);
        assert.equal(uploads.size,0,fault);
        assert.deepEqual(plain(p.context.app.publicLibraryLastIndex),originalIndex);
        assert(creatorCleaned);
        assert(sessionSaved);
        assert.equal(saved,!fault);
        assert.equal(rendered,!fault);
    }
});
