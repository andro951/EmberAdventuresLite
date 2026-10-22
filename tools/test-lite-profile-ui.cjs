const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const production=createProductionContext();
    production.load("defaultSettings");
    production.load("defaultState");
    const nodes=[],events=[];
    const makeNode=tag=>{
        const node={tagName:tag,children:[],dataset:{},attributes:{},textContent:"",value:"",disabled:false,
            append(...children){this.children.push(...children);},setAttribute(key,value){this.attributes[key]=value;},
            focus(){this.focused=true;},querySelector(){return null;}
        };
        nodes.push(node);return node;
    };
    const box=makeNode("div");
    Object.assign(production.context,{
        app:{settings:plain(production.context.defaultSettings),state:plain(production.context.defaultState),userProfiles:[],
            library:{deleteProfile:async id=>events.push(["delete",id])}},
        document:{createElement:makeNode},$:()=>box,clone:structuredClone,
        log:()=>{},clearSetupModalScrollPositions:()=>{},closeLibraryProfileOverlay:()=>{},
        saveSettingsNow:()=>events.push(["settings"]),saveProfilesNow:()=>events.push(["profiles"]),
        refreshUnifiedLibraryAfterProfileChange:()=>events.push(["library-refresh"]),
        refreshMainMenuIfVisible:()=>{},openModal:()=>{box.children=[];},closeModal:()=>events.push(["close"]),
        openUnifiedLibrary:options=>events.push(["library",options]),showConfirm:async()=>true,
    });
    //Resolve post-validation dependencies before invoking mutating entry points; the declaration loader retries missing names.
    for (const name of ["profileSettingKeys", "applyUserProfile", "hydrateUserProfileRuntime", "hydrateNoUserProfileRuntime", "userProfileById", "openMainMenuProfiles"])
        production.load(name);
    return {...production,nodes,events,box};
}
test("profile creation preserves ordinary preferences and passes the canonical validator",()=>{
    const f=fixture();
    f.context.app.settings.narratorVoiceName="Fixture Voice";
    const result=f.invoke("createUserProfileFromForm","Fixture Profile","female");
    assert.equal(result.settings.narratorVoiceName,"Fixture Voice");
    assert.equal(result.settings.preferredCharacterGender,"female");
    assert.equal(f.invoke("validateUserProfileDefinition",result).ok,true);
    assert.equal(f.context.app.settings.activeUserProfileId,result.id);
    assert.deepEqual(f.events.map(event=>event[0]),["settings","profiles"]);
    assert(!/allow_spicy|kink_preferences|ick_limits|adult_warning/.test(JSON.stringify(result)));
});
test("invalid profile creation does not mutate the profile list or save settings",()=>{
    const f=fixture();
    for(const args of [["",""],["Fixture","invalid"]])
        assert.throws(()=>f.invoke("createUserProfileFromForm",...args));
    assert.equal(f.context.app.userProfiles.length,0);
    assert.equal(f.events.length,0);
});
test("Lite profile exports round-trip exactly and imports reject extra fields without migration",()=>{
    const f=fixture();
    const profile=f.invoke("createUserProfileFromForm","Fixture Profile","");
    const payload=plain(f.invoke("profileExportEnvelope",profile));
    assert.equal(payload.app,"EmberAdventuresLite");
    assert.deepEqual(plain(f.invoke("profilesFromImportPayload",payload)),[plain(profile)]);
    payload.profile.allow_spicy=false;
    const before=JSON.stringify(payload);
    assert.throws(()=>f.invoke("profilesFromImportPayload",payload),/allow_spicy/);
    assert.equal(JSON.stringify(payload),before);
});
test("selecting an existing profile can continue directly into the story library",()=>{
    const f=fixture();
    const profile=f.invoke("createUserProfileFromForm","Fixture Profile","");
    f.events.length=0;
    f.invoke("selectMainMenuProfile",profile.id,{after:"story_library"});
    assert.equal(f.context.app.settings.activeUserProfileId,profile.id);
    assert.equal(f.events.filter(event=>event[0]==="library").length,1);
    assert.equal(f.events.find(event=>event[0]==="library")[1].type,"story");
});
test("deleting an active profile clears only the selection and preserves reusable settings",async()=>{
    const f=fixture();
    const profile=f.invoke("createUserProfileFromForm","Fixture Profile","male");
    for (const name of ["userProfileById", "hydrateNoUserProfileRuntime", "openMainMenuProfiles"])
        f.load(name);
    const voice=f.context.app.settings.narratorVoiceName;
    await f.invoke("deleteMainMenuProfile",profile.id);
    assert.equal(f.context.app.userProfiles.length,0);
    assert.equal(f.context.app.settings.activeUserProfileId,"");
    assert.equal(f.context.app.settings.narratorVoiceName,voice);
    assert(f.events.some(event=>event[0]==="delete"&&event[1]===profile.id));
});
test("profile form contains ordinary controls and submits without the retired onboarding wizard",()=>{
    const f=fixture();
    f.invoke("createUserProfileFromForm","Fixture Setup","");
    f.invoke("openProfileCreationModal",{after:"story_library"});
    const name=f.nodes.find(node=>node.id==="profileName");
    const gender=f.nodes.find(node=>node.id==="profileCharacterPresentation");
    name.value="Fixture Profile";gender.value="male";
    const form=f.nodes.find(node=>node.tagName==="form");
    form.onsubmit({preventDefault(){}});
    assert.equal(f.context.app.userProfiles.length,2);
    assert.equal(f.context.app.userProfiles.at(-1).name,"Fixture Profile");
    assert(f.events.some(event=>event[0]==="library"));
    assert(!/adult|NSFW|spic|kink/.test(f.nodes.map(node=>node.textContent).join(" ")));
});
test("new adventures still offer profile creation or selection before the story library",()=>{
    const f=fixture();
    f.context.openProfileCreationModal=options=>f.events.push(["create-form",options]);
    f.context.openMainMenuProfiles=options=>f.events.push(["profile-list",options]);
    f.invoke("beginNewAdventureStorySelection");
    assert.equal(f.events[0][0],"create-form");
    f.invoke("createUserProfileFromForm","Fixture Profile","");
    f.events.length=0;
    f.invoke("beginNewAdventureStorySelection");
    assert.equal(f.events[0][0],"profile-list");
    assert.equal(f.events[0][1].after,"story_library");
});
test("boldness retains romance and social initiative without sexual escalation guidance",()=>{
    const f=createProductionContext();
    f.load("CHARACTER_BOLDNESS_PHRASES");
    const phrases=Object.values(f.context.CHARACTER_BOLDNESS_PHRASES);
    assert.equal(phrases.length,10);
    assert(!/sexual|exposure|intimacy|intimate|escalat/i.test(phrases.join(" ")));
    assert(/romantic|date|flirting/.test(phrases.join(" ")));
});