const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname,"..");
const context = vm.createContext({self:{}});
vm.runInContext(fs.readFileSync(path.join(root,"src/persistence/schema-contract.js"),"utf8"),context);
const schema = context.self.EmberStorageSchema;
const escape = value => String(value).replaceAll("|","\\|").replaceAll("\n"," ").trim();
const rows = ["# EmberAdventuresLite storage schema","","Generated from the executable contract built from `SAVE_STORAGE_SCHEMA_JSON.txt`. That source and the canonical validators own exact shapes; this document is a field/index inventory, not a separate validator.","","Database: `" + schema.databaseName + "`. Stores: " + Object.keys(schema.stores).length + ".","","Definitions carry `lite: true`; mutable runtime records keep only the documented Lite fields. Story and character bodies, compiled graphs, shared assets, profiles, and save records retain separate ownership."];
for(const [name,store] of Object.entries(schema.stores)) {
    rows.push("","## " + name,"","Key: `" + JSON.stringify(store.keyPath) + "`.","","Indexes: " + (store.indexes.length ? store.indexes.map(index => "`" + index.name + "`: `" + JSON.stringify(index.keyPath) + "`").join("; ") : "none") + ".","","| Field | Type | Required |","| --- | --- | --- |");
    for(const [field,contract] of Object.entries(store.fields))
        rows.push("| `" + field + "` | " + escape(contract.typeSpec || contract.kind) + " | " + (contract.required ? "yes" : "no") + " |");
}
rows.push("","Nested object/array fields use their exact documented subcontracts in `SAVE_STORAGE_SCHEMA_JSON.txt`. Unknown fields, wrong types, and missing required values are rejected. Shared-library transport metadata is converted at its explicit boundary and is not part of native runtime records.");
fs.writeFileSync(path.join(root,"SAVE_STORAGE_SCHEMA.md"),rows.join("\n"));
console.log("Documented " + Object.keys(schema.stores).length + " canonical stores.");
