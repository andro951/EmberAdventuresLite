const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {characterFixture} = require("./lib/canonical-lite-fixtures.cjs");
const root = path.resolve(__dirname,"..");
const plain = value => JSON.parse(JSON.stringify(value));
function worker() {
    const context = vm.createContext({self:{},structuredClone,TextEncoder,URL,postMessage(){}});
    context.EmberSharedLibraryFormat = require("../src/contracts/shared-library-format.js");
    vm.runInContext(fs.readFileSync(path.join(root,"src/contracts/public-library-contract.js"),"utf8"),context);
    vm.runInContext(fs.readFileSync(path.join(root,"src/workers/library-worker.js"),"utf8"),context);
    return context;
}
function call(context,source,value) {
    context.jsonInput=JSON.stringify(value);
    return vm.runInContext(`globalThis.input = JSON.parse(jsonInput); ${source}(input)`,context);
}
test("worker presentation preferences support authored or ordinary male/female choices", () => {
    const context=worker();
    assert.deepEqual(plain(call(context,"exactPreferredCharacterGenders",["female","male"])),["female","male"]);
    context.characterText=JSON.stringify(characterFixture());
    vm.runInContext("globalThis.character=JSON.parse(characterText)",context);
    context.character.gender="non-binary";
    assert.equal(vm.runInContext('applyPreferredRuntimePresentation(character, [], false).gender',context),"non-binary");
    assert.equal(vm.runInContext('applyPreferredRuntimePresentation(character, ["male"], true).gender',context),"male");
    assert.equal(context.character.name,context.character.fallback_name);
    assert.equal(context.character.starting_outfit_id,context.character.fallback_starting_outfit_id);
    assert.throws(()=>call(context,"exactPreferredCharacterGenders",["unsupported"]),/must be male or female/);
});
test("worker report commands accept ordinary suggestions and project shared transport metadata", async () => {
    const context=worker();
    const input={type:"public.report.submit",requestId:1,itemId:"smoke-publication",kind:"story",title:"Smoke Story",reasons:["inappropriate_content"],details:"Content requires review",suggestedGenres:[],dryRun:true};
    const result=plain(await call(context,"submitPublicReport",input));
    assert.deepEqual(result.reasons,["contains_nsfw"]);
    assert.deepEqual(result.suggested_kink_tags,[]);
    assert.equal(input.reasons[0],"inappropriate_content");
    assert.throws(()=>call(context,"validatePublicPublishCommand",{type:"public.publish"}),/required/);
});
for(const kind of ["story","character"]) {
    test(`worker ${kind} packages keep Lite fields and publish with the shared SFW classification`, async () => {
        const context=worker();
        const source=kind === "story" ? JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures/compatibility-lite-story.json"),"utf8")).storyTemplate : characterFixture();
        source.source="Original";
        const id=source.id;
        delete source.id;
        source[kind === "story" ? "storyId" : "characterId"]=id;
        source.revisionId="smoke-revision";
        source.contentHash="smoke-content-hash";
        context.storedDefinition=source;
        vm.runInContext(`
            openRuntimeDatabase = async () => ({transaction:() => ({objectStore:() => ({get:() => structuredClone(storedDefinition)})})});
            indexedDbRequest = async value => value;
            gzipJson = async payload => {globalThis.packagedPayload = payload; return {sha256:'a'.repeat(64),size:100};};
        `,context);
        const imageUrls=kind === "story" ? {title:"https://example.com/title.webp"} : {male:"https://example.com/male.webp",non_male:"https://example.com/female.webp"};
        const input={type:"public.package.prepare",requestId:1,kind,id,revisionId:"smoke-revision",creator:"Smoke Creator",creatorId:"smoke-creator",imageUrls};
        const result=plain(await call(context,"publicPackagePrepare",input));
        const payload=plain(context.packagedPayload);
        const definition=payload.storyTemplate || payload.character_definition;
        assert.equal(definition.lite,true);
        assert.equal(definition.id,id);
        assert(!/nsfw|loli|kink|arousal|penis_size/.test(JSON.stringify(payload)));
        assert(!/nsfw|loli|kink|fallbackGender/.test(JSON.stringify(result.metadata)));
        call(context,"validatePublicPackageMetadata",result.metadata);
        const row=plain(call(context,"publicDatabaseRow",result.metadata));
        assert.equal(row.nsfw,false);
        assert.equal(row.loli,false);
        assert.deepEqual(row.kink_tags,[]);
        assert.equal(row.definition_id,id);
        const invalid={...result.metadata,unexpectedField:true};
        assert.throws(()=>call(context,"validatePublicPackageMetadata",invalid),/not an approved field/);
    });
}
test("diagnostic library summaries contain ordinary identity and version fields only", () => {
    const context=worker();
    context.entry={characterId:"smoke-character",revisionId:"smoke-revision",name:"Smoke Character",role:"Archivist"};
    const summary=plain(vm.runInContext('diagnosticLibraryRecordSummary(entry,"character")',context));
    assert.equal(summary.characterId,"smoke-character");
    assert.equal(summary.role,"Archivist");
    assert(!/nsfw|loli/.test(JSON.stringify(summary)));
});

