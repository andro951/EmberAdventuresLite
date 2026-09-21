const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/scripts/app/14-ai-plugins.js'), 'utf8');
const names = ['cleanPromptText', 'joinPromptPartsExact', 'buildBaseImageNegativePrompt', 'buildGroupImageNegativePrompt', 'buildImageSafetyNegativePrompt', 'buildNegativeImagePrompt'];
const functions = names.map(name => {
    const match = source.match(new RegExp(`^  function ${name}\\([^]*?^  }`, 'm'));
    assert.ok(match, `Missing ${name}`);
    return match[0];
});
const context = vm.createContext({});
vm.runInContext(`
const joinPromptParts = parts => parts.flat().filter(Boolean).join(', ');
${functions.join('\n')}
globalThis.subject = {buildBaseImageNegativePrompt, buildGroupImageNegativePrompt, buildImageSafetyNegativePrompt, buildNegativeImagePrompt};
`, context);
const {subject} = context;
const safety = subject.buildImageSafetyNegativePrompt({includeTurnaroundNegatives: false}).split(', ');
for (const count of [0, 1, 2, 3, 4]) {
    const prompt = subject.buildGroupImageNegativePrompt(Array.from({length: count}, (_, i) => [`Person ${i}`, {}]));
    for (const exclusion of safety) assert.ok(prompt.includes(exclusion), `Group of ${count} lost a safety exclusion`);
}
for (const exclusion of safety) assert.ok(subject.buildNegativeImagePrompt().includes(exclusion));
console.log('Image safety checks passed for portraits and groups of zero through four subjects.');
const extract = (file, name, indent = '  ') => {
    const code = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
    const match = code.match(new RegExp(`^${indent}function ${name}\\([^]*?^${indent}}`, 'm'));
    assert.ok(match, `Missing ${name}`);
    return match[0];
};
vm.runInContext(`
${['cleanPromptText', 'joinPromptPartsExact', 'preserveImageSafetyNegativePrompt'].map(name => extract('src/scripts/app/14-ai-plugins.js', name)).join('\n')}
${extract('src/scripts/app/13-state-patches.js', 'sanitizeFamilyFriendlyImagePrompt')}
globalThis.custom = {preserveImageSafetyNegativePrompt, sanitizeFamilyFriendlyImagePrompt};
`, context);
const customNegative = context.custom.preserveImageSafetyNegativePrompt('watermark, custom exclusion');
assert.ok(customNegative.includes('custom exclusion'));
for (const exclusion of safety) assert.ok(customNegative.includes(exclusion));
assert.equal(context.custom.preserveImageSafetyNegativePrompt(customNegative), customNegative);
assert.ok(context.custom.sanitizeFamilyFriendlyImagePrompt('forest').includes('family-friendly, nonsexual'));
vm.runInContext(`
const IMAGE_PROMPT_CLOTHING_SLOT_ORDER = ['bra', 'shirt', 'underwear', 'pants'];
const PROFILE_IMAGE_CLOTHING_SLOTS = new Set(IMAGE_PROMPT_CLOTHING_SLOT_ORDER);
const clothingItemText = value => value || '';
const isEmptyClothingValue = value => !value;
${['clothingSlotHasValue','hasUpperBodyCovering','hasLowerBodyCovering','joinVisibleClothing'].map(name => extract('src/scripts/app/14-ai-plugins.js', name)).join('\n')}
globalThis.clothing = {joinVisibleClothing, hasUpperBodyCovering, hasLowerBodyCovering};
`, context);
assert.equal(context.clothing.joinVisibleClothing({bra:'plain bra',shirt:'tunic',underwear:'plain underwear',pants:'trousers'}), 'tunic, trousers');
assert.equal(context.clothing.joinVisibleClothing({bra:'plain bra',underwear:'plain underwear'}), 'plain bra, plain underwear');
assert.ok(context.clothing.hasUpperBodyCovering({bra:'plain bra'}));
assert.ok(context.clothing.hasLowerBodyCovering({underwear:'plain underwear'}));
const worker = vm.createContext({});
vm.runInContext(`
const EquipmentSlots = ['shirt', 'pants'];
const stableHash = value => value;
const text = value => String(value || '');
${['imageCharacterDescription','workerPresentationOnlyExtraDescription','prepareImageRequest'].map(name => extract('src/workers/turn-worker.js',name,'')).join('\n')}
globalThis.prepare = prepareImageRequest;
`, worker);
const result = worker.prepare({sceneMembers:[{characterId:'a'},{characterId:'a'}],characters:{a:{name:'Alex'}},characterAppearance:[{characterId:'a',bodyDescription:'A sturdy, athletic build.'}],equippedItems:[],items:[],messages:[],definition:{},saveId:'test'},'test');
assert.deepEqual(Array.from(result.characterIds), ['a']);
assert.ok(result.image.prompt.includes('ordinary opaque everyday clothing'));
assert.ok(result.image.prompt.includes('family-friendly'));
assert.ok(result.image.prompt.includes('A sturdy, athletic build.'));
for (const exclusion of safety.filter(value => !subject.buildBaseImageNegativePrompt().split(', ').includes(value))) assert.ok(result.image.negativePrompt.includes(exclusion));
console.log('Custom prompts, clothing visibility, coverage semantics, and worker image requests passed.');
