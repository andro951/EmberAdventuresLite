const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const format = require("../src/contracts/shared-library-format.js");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const {characterFixture} = require("./lib/canonical-lite-fixtures.cjs");
const root = path.resolve(__dirname,"..");
function production() {
    const p = createProductionContext();
    p.context.EmberSharedLibraryFormat = format;
    vm.runInContext(fs.readFileSync(path.join(root,"src/contracts/public-library-contract.js"),"utf8"),p.context);
    p.load("exactAdultAge");
    return p;
}
function publicRow(p) {
    const fields = vm.runInContext("SUPABASE_PUBLIC_SEARCH_ROW_FIELDS",p.context);
    const row = Object.fromEntries(Array.from(fields, field => [field,null]));
    Object.assign(row,{
        id:"publication",type:"character",definition_id:"definition",name:"Canonical Name",title:"",description:"Description",creator:"Author",creator_id:"author",creation_tool:"Editor",source:"Original",
        genres:["Fantasy"],kink_tags:[],nsfw:false,loli:false,player_select:false,
        gender:"futanari",fallback_gender:"male",male_name:"Alternate Name",non_male_name:"Canonical Name",male_image_url:"https://example.com/male.webp",non_male_image_url:"https://example.com/female.webp",image_url:"https://example.com/default.webp",
        age:30,species:"Human",role:"Archivist",voice_gender:"female",created_at:"2026-10-22",updated_at:"2026-10-22",current_version_id:"version",payload_url:"https://example.com/definition.json",payload_sha256:"",ordering_value:"1",
        rating_total:12,rating_count:3,rating_average:4,player_option_count:0,main_objective_count:0,side_objective_count:0,future_character_count:0,starting_party_member_count:0,starting_npc_count:0,
    });
    return row;
}
test("library records preserve character identity and validate without excluded metadata", () => {
    const p = production();
    const character = characterFixture();
    const record = p.invoke("characterLibraryRecordFromDefinition",character,{creator:"Author",creator_id:"author"});
    assert.equal(record.character.id,character.id);
    assert.equal(record.creator_id,"author");
    assert.equal(p.invoke("validateCharacterLibraryRecord",record).ok,true);
    assert(!/nsfw|loli|kink_tags/.test(JSON.stringify(record)));
});
test("public search rows use the fallback presentation and preserve publication, version and rating identity", () => {
    const p = production();
    for (const gender of ["male","female"]) {
        const row = publicRow(p);row.fallback_gender = gender;
        const before = structuredClone(row);
        const entry = p.invoke("publicLibraryEntryFromSupabaseSearchRow",row);
        assert.equal(entry.id,row.id);
        assert.equal(entry.definition_id,row.definition_id);
        assert.equal(entry.supabase_current_version_id,row.current_version_id);
        assert.equal(entry.rating_count,3);
        assert.equal(entry.rating_average,4);
        assert.equal(entry.gender,gender);
        assert.equal(entry.name,gender === "male" ? "Alternate Name" : "Canonical Name");
        assert.equal(entry.image_url,gender === "male" ? row.male_image_url : row.non_male_image_url);
        assert(!/nsfw|loli|kink_tags|fallback_gender/.test(JSON.stringify(entry)));
        assert.deepEqual(row,before);
    }
});
test("shared metadata rejects missing fallback and excluded records before creating local entries", () => {
    const p = production();
    for (const mutate of [row=>row.nsfw=true,row=>row.loli=true,row=>row.fallback_gender=""]) {
        const row = publicRow(p);mutate(row);
        assert.throws(()=>p.invoke("publicLibraryEntryFromSupabaseSearchRow",row),/classified SFW|fallback_gender/);
    }
});
test("public story and worker searches always request only the shared SFW subset", () => {
    const p = production();
    p.context.app = {storyLibrarySorts:{public:"newest"}};
    p.context.publicLibrarySearchBatchSize = () => 20;
    const body = p.invoke("publicLibrarySearchRpcBody",{filters:{search:"archive",genres:["fantasy"],nsfw:"nsfw",kink_tags:["ignored"]}});
    assert.equal(body.include_sfw,true);
    assert.equal(body.include_nsfw,false);
    assert.equal(body.include_loli,false);
    assert.deepEqual(Array.from(body.required_kink_tags),[]);
    assert.equal(body.search_text,"archive");
    const context = vm.createContext({self:{},structuredClone,postMessage(){},EmberSharedLibraryFormat:format,URL});
    vm.runInContext(fs.readFileSync(path.join(root,"src/workers/library-worker.js"),"utf8"),context);
    const command = {type:"public.search",requestId:1,kind:"character",genres:["fantasy"],limit:20};
    context.commandText=JSON.stringify(command);
    vm.runInContext("globalThis.command = JSON.parse(commandText)",context);
    const workerBody=vm.runInContext("publicSearchBody(command)",context);
    assert.equal(workerBody.include_sfw,true);
    assert.equal(workerBody.include_nsfw,false);
    assert.equal(workerBody.include_loli,false);
    vm.runInContext("command.allowSpicy = true",context);
    assert.throws(()=>vm.runInContext("publicSearchBody(command)",context),/not an approved field/);
});
test("ordinary library filters and genre controls do not depend on removed content modes", () => {
    const p=production();
    p.context.characterLibraryRecordEntity=record=>record.character;
    const record={name:"Ada",source:"Original",creator:"Author",character:{name:"Ada",gender:"female",appearance:{species:"Human"},role:"Archivist",genres:["fantasy"]}};
    assert.equal(p.invoke("characterLibraryRecordMatchesCriteria",record,{searchTokens:["ada"],filters:{gender:"female",role:"Archivist"}}),true);
    assert.equal(p.invoke("characterLibraryRecordMatchesCriteria",record,{searchTokens:["ada"],filters:{role:"Guard"}}),false);
    p.context.escapeHtml=String;
    p.context.defaultCharacterGenderTags=()=>["male","female"];
    p.context.htmlJsArg=value=>JSON.stringify(value);
    for(const name of ["characterLibraryAdvancedFiltersHtml","storyLibraryAdvancedFiltersHtml"])
        assert(!/NSFW|sexual|kink|loli|futanari/i.test(p.invoke(name)));
});

test("definition markers remain on files and do not enter runtime character state", () => {
    const p=production();
    const character=characterFixture();
    const runtime=p.invoke("materializeCharacterDefinitionForRuntimeFields",character,character.name);
    assert.equal(Object.hasOwn(runtime,"lite"),false);
    assert.equal(character.lite,true);
    assert.equal(runtime.id,character.id);
    assert.equal(runtime.appearance.chest,character.appearance.chest);
});

test("restoring a save preserves canonical loading and ownership without a content promotion path", async () => {
    const p=production();
    const events=[];
    const app={state:{meta:{}},gameAutosaveTimer:null,suppressGameAutosave:false};
    Object.assign(p.context,{
        app,clearTimeout(){},findGameSaveById:()=>({saveId:12,title:"Archive Adventure"}),
        beginBlockingUiAction:()=>"restore",endBlockingUiAction:id=>events.push("end:"+id),waitForRenderedFrame:async()=>{},
        saveCurrentGameBeforeRuntimeReplacement:async()=>{events.push("save-current");return true;},
        cancelAllGameProcesses:()=>events.push("cancel-old-processes"),
        loadSaveIntoRuntime:async(id,options)=>{events.push("load:"+id);assert.equal(options.setActive,true);return {};},
        stampRuntimeSaveOwnership:id=>events.push("owner:"+id),assertExactMessageStorage(){},refreshKeptImageRuntimeSet(){},
        closeModal(){},render(){},continueStartupFlow(){events.push("continue");},
    });
    await p.invoke("restoreGameSave",12,{skipRestoreConfirm:true});
    assert.deepEqual(events,["save-current","cancel-old-processes","load:12","owner:12","continue","end:restore"]);
    assert.equal(app.suppressGameAutosave,false);
    assert.equal(app.state.meta.save_id,12);
    assert.deepEqual(Object.keys(app.state.meta),["save_id"]);
});

test("a complete shared story uses the canonical Lite schema through the actual story import entry point", () => {
    const p=production();
    const input=JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures/compatibility-lite-story.json"),"utf8"));
    const validation=p.invoke("validateStoryExport",input);
    assert.equal(validation.ok,true,JSON.stringify(validation.errors));
    const record=p.invoke("storyTemplateRecordFromPayload",input);
    assert.equal(record.lite,true);
    assert.deepEqual(JSON.parse(JSON.stringify(record)),input.storyTemplate);
});

test("scene edits save place, summary and selected characters without requiring a removed scene control", () => {
    const p=production();
    const app={state:{location:{},scene:{}}};
    let saved=0;
    const fields={scenePlace:{value:" Archive "},sceneSummary:{value:" Sorting records "},sceneImageAction:{value:"Holding a ledger"}};
    Object.assign(p.context,{
        app,$:id=>fields[id],document:{querySelectorAll:selector=>selector === ".activeCharCheck" ? [{checked:true,value:"Ada"},{checked:false,value:"Bea"}] : [{checked:true,value:"Ada"}]},
        assertRuntimeSceneReferences(){},scheduleActiveGameSave(){saved++;},
    });
    p.invoke("saveSceneFromModal");
    assert.equal(saved,1);
    assert.equal(app.state.location.specific_place,"Archive");
    assert.equal(app.state.scene.summary,"Sorting records");
    assert.deepEqual(Array.from(app.state.scene.party_members_present),["Ada"]);
    assert.deepEqual(Array.from(app.state.scene.image_characters),["Ada"]);
    assert(!/spicy|intimacy/.test(JSON.stringify(app.state)));
});

test("ordinary image negatives and fallback world/objective generation execute without missing dependencies", async () => {
    const p=production();
    p.context.app={settings:{}};
    p.context.getImageStyle=()=>"";
    assert(p.invoke("buildNegativeImagePrompt",{}).includes("watermark"));
    const requests=[];
    p.context.playerNameForPrompt=()=>"Smoke Player";
    p.load("contentModeInstruction");
    p.context.aiJsonChunk=async(prompt,label)=>{requests.push({prompt,label});return label === "world chunk" ? null : {};};
    await p.invoke("buildWorldChunk","Smoke archive premise");
    await p.invoke("buildProgressionChunk","Smoke archive premise");
    const objective=requests.find(request=>request.label === "objectives");
    assert(objective);
    assert(objective.prompt.includes("Smoke archive premise"));
    assert(objective.prompt.includes("completion_control"));
});

test("ordinary browser-smoke producers emit valid current Lite characters and stories", () => {
    const p=production();
    p.context.app={settings:{},state:{}};
    const character=p.invoke("devSmokeCharacterDefinition");
    assert.equal(p.invoke("validateCharacterDefinition",character,"fixture",{embedded:true}).ok,true);
    for(const name of ["devSmokeStoryRecord","devSmokeTemplateRecord"]) {
        const record=p.invoke(name);
        const validation=p.invoke("validateStoryDefinition",record);
        assert.equal(validation.ok,true,JSON.stringify(validation.errors));
    }
});

test("browser fixture profiles and shared transport rows follow their actual canonical contracts", () => {
    const p=production();
    p.load("defaultSettings");
    p.context.app={settings:structuredClone(p.context.defaultSettings)};
    for(const label of ["first","second"]) {
        const profile=p.invoke("devSmokeTestProfile",label);
        assert.equal(p.invoke("validateUserProfileDefinition",profile).ok,true);
        assert.equal(profile.id,"smoke-profile-" + label);
    }
    for(const name of ["devSmokeSupabasePublicItemRow","devSmokeSupabasePublicSearchRow"]) {
        const row=p.invoke(name);
        assert.equal(row.nsfw,false);
        assert.equal(row.loli,false);
        assert.deepEqual(Array.from(row.kink_tags),[]);
        assert.equal(row.fallback_gender,null);
    }
});