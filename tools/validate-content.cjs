"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const validator = require("../skills/emberadventureslite-character/scripts/validate-content.cjs").createValidator(root);
function files(folder) {
    return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(path.join(folder,entry.name)) : entry.name.endsWith(".json") ? [path.join(folder,entry.name)] : []);
}
const results = ["characters","stories","docs/examples"].flatMap(folder => files(path.join(root,folder))).map(file => {
    const payload = JSON.parse(fs.readFileSync(file,"utf8"));
    const method = payload.exportType === "story-template" ? "validateStoryExport" : "validateCharacterExport";
    return {file:path.relative(root,file),...validator.invoke(method,payload)};
});
fs.mkdirSync(path.join(root,"test-output"),{recursive:true});
fs.writeFileSync(path.join(root,"test-output/content-validation.json"),JSON.stringify(results,null,2));
const failed = results.filter(result => !result.ok);
console.log("Canonical content validation: " + (results.length-failed.length) + "/" + results.length + " valid.");
if (failed.length) {
    console.error(JSON.stringify(failed,null,2));
    process.exitCode = 1;
}