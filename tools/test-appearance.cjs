const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/scripts/app/04-story-runtime.js'), 'utf8');
const functionSource = source.match(/^  function characterAppearanceScaleValidationErrors\([^]*?^  }/m)[0];
const scaleFields = source.match(/^  const CHARACTER_APPEARANCE_SCALE_FIELDS = .*$/m)[0];
const errorsSource = fs.readFileSync(path.join(root, 'src/scripts/app/03-messages-saves.js'), 'utf8').match(/^  function validationError\([^]*?^  }/m)[0];
const context = vm.createContext({});
vm.runInContext(`const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);\n${errorsSource}\n${scaleFields}\n${functionSource}\nglobalThis.validate = characterAppearanceScaleValidationErrors; globalThis.fields = CHARACTER_APPEARANCE_SCALE_FIELDS;`, context);
assert.deepEqual(Array.from(context.fields), ['height']);
const retired = ['shoulder_width','chest','upper_body_build','midsection_build','hip_width','butt_build','lower_body_build','arm_length','leg_length','muscular','shoulders','stomach','hips','waist','legs','arms'];
let count = 0;
function inspect(value, location) {
    if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
    if (!value || typeof value !== 'object') return;
    if (value.appearance && typeof value.appearance === 'object') {
        const errors = context.validate(value, location);
        assert.equal(errors.length, 0, `${location}: ${JSON.stringify(errors)}`);
        assert.ok(retired.every(key => !Object.hasOwn(value.appearance, key)), `${location} contains a retired body scale`);
        count++;
    }
    for (const [key, item] of Object.entries(value)) inspect(item, `${location}.${key}`);
}
function files(dir) {
    return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(dir,entry.name)) : [path.join(dir,entry.name)]);
}
for (const folder of ['characters','stories','docs/examples']) {
    for (const file of files(path.join(root,folder)).filter(file => file.endsWith('.json'))) inspect(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),path.relative(root,file));
}
for (const value of ['', 'Stocky and athletic.', '|[character_first]| has a slender build.']) assert.equal(context.validate({appearance:{height:10,body_description:value}}).length,0);
for (const value of [undefined,null,12,{},[]]) assert.ok(context.validate({appearance:{height:10,body_description:value}}).some(error => error.path.endsWith('.body_description')));
console.log(`Appearance checks passed for ${count} bundled appearance records, including older story exports.`);
