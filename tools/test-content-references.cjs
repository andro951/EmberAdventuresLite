const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let definitions = 0;
let clothingRecords = 0;
const uncoveredGarment = /\b(?:tank|bandeau|halter|strapless|sleeveless|mesh|translucent|transparent|cutout)\b|mid-thigh|high-slit|side slit|off-shoulder|open-sided|open.back|deep (?:open )?v\b|torso visible|abdomen fully visible|half-unbuttoned|worn open|showing .*chest/i;
const walk = (value, location) => {
    if (!value || typeof value !== 'object') return;
    if (value.clothing && typeof value.clothing === 'object') {
        for (const slot of ['shirt', 'pants', 'skirt', 'undershirt', 'coat', 'over_shirt']) {
            const description = value.clothing[slot];
            if (typeof description !== 'string') continue;
            assert.ok(!uncoveredGarment.test(description), `${location}.clothing.${slot}: coverage review required`);
        }
        clothingRecords++;
    }
    for (const [field, selected] of [['outfits', 'starting_outfit_id'], ['fallback_outfits', 'fallback_starting_outfit_id']]) {
        if (!Array.isArray(value[field])) continue;
        const ids = value[field].map(outfit => outfit.id);
        assert.equal(new Set(ids).size, ids.length, `${location}.${field}: duplicate outfit ids`);
        if (value[selected]) assert.ok(ids.includes(value[selected]), `${location}.${selected}: missing outfit`);
        if (field === 'outfits' && value.active_outfit_id) assert.ok(ids.includes(value.active_outfit_id), `${location}: missing active outfit`);
        definitions++;
    }
    for (const [key, item] of Object.entries(value)) walk(item, `${location}.${key}`);
};
const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.name.endsWith('.json')) walk(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')), path.relative(root, file));
    }
};
for (const folder of ['characters', 'stories', 'docs/examples']) visit(path.join(root, folder));
console.log(`Content checks passed: ${definitions} outfit collections and ${clothingRecords} clothing records.`);
