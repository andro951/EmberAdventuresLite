const {test} = require("node:test");
const assert = require("node:assert/strict");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const vm = require("node:vm");
const plain = value => JSON.parse(JSON.stringify(value));

test("new runtime and settings defaults omit excluded feature state", () => {
    const production=createProductionContext();
    production.load("defaultState");
    production.load("defaultSettings");
    const data=vm.runInContext("({state:defaultState,settings:defaultSettings})",production.context);
    assert.equal(data.settings.devMode,true);
    assert.equal(data.settings.preferredCharacterGender,"");
    const excluded=new Set(["nsfw","loli","penis_size","arousal","intimacy_level","sex_acts","sex_position","spicy_mode","is_spicy","allow_spicy","adult_warning_accepted","kink_preferences","nsfw_known_facts","minBoobSize","maxBoobSize","spiceLevel","spiceFrequency"]);
    function inspect(value) {
        if(!value || typeof value!=="object") return;
        for(const [key,child] of Object.entries(value)) {
            assert(!excluded.has(key),key);
            assert(!/lovense|^toy/i.test(key),key);
            inspect(child);
        }
    }
    inspect(data);
});

test("the profile factory creates a definition accepted by the canonical profile validator", () => {
    const production=createProductionContext();
    const profile=production.invoke("makeUserProfileFromDraft",{profile_name:"Fixture Profile",character_boldness_offset:0});
    const result=production.invoke("validateUserProfileDefinition",profile);
    assert.equal(result.ok,true,JSON.stringify(result.errors));
    assert.deepEqual(Object.keys(profile).sort(),["id","name","settings","story_generation_notice_seen","updated_at"].sort());
    assert.equal(profile.settings.preferredCharacterGender,"");
    assert(Object.hasOwn(profile.settings,"narratorVoiceName"));
    assert(Object.hasOwn(profile.settings,"imageMode"));
    assert(Object.hasOwn(profile.settings,"characterBoldnessOffset"));
});

test("presentation preferences remain available as an ordinary explicit setting", () => {
    const production=createProductionContext();
    for(const gender of ["","male","female"]) {
        assert.deepEqual(plain(production.invoke("preferredRuntimeCharacterGenders",{settings:{preferredCharacterGender:gender}})),gender?[gender]:[]);
    }
    for(const gender of ["any","futanari",null,false])
        assert.throws(()=>production.invoke("exactPreferredCharacterGender",gender),/Choose authored, male, or female/);
    for(let bucket=0;bucket<100;bucket++)
        assert(["male","female"].includes(production.invoke("generatedCharacterGenderFromBucket",bucket)));
});

test("ordinary profile settings reject unknown fields and invalid gender selections", () => {
    const production=createProductionContext();
    const profile=production.invoke("makeUserProfileFromDraft",{profile_name:"Fixture Profile",character_boldness_offset:0});
    profile.settings.preferredCharacterGender="invalid";
    assert(production.invoke("validateUserProfileDefinition",profile).errors.some(error=>error.path === "profile.settings.preferredCharacterGender"));
    profile.settings.preferredCharacterGender="";
    profile.allow_spicy=false;
    assert(production.invoke("validateUserProfileDefinition",profile).errors.some(error=>error.code === "unknown_field" && error.path === "profile.allow_spicy"));
});

test("startup assets use one background and do not preload an alternate content mode", () => {
    const production=createProductionContext();
    const assets=plain(production.invoke("mainMenuPreloadAssetNames"));
    assert.equal(new Set(assets).size,assets.length);
    assert(!assets.some(name=>/spicy|nsfw/i.test(name)));
    assert.equal(production.invoke("mainMenuBackgroundAsset"),assets[0]);
    production.load("PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS");
    assert.deepEqual(plain(vm.runInContext("PUBLIC_LIBRARY_FEATURED_CHARACTER_URLS",production.context)),[]);
});
