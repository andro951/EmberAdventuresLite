"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const validator = require("./lib/authoring-skills.cjs").loadAuthoringSkills(root, "EmberAdventuresLite").validator().createValidator(root);
if (require.main === module) {
    const files = process.argv.slice(2);
    if (!files.length)
        throw new Error("Supply one or more story JSON files.");
    for (const file of files) {
        const result = validator.validate(JSON.parse(fs.readFileSync(path.resolve(root,file),"utf8")));
        console.log(JSON.stringify({file,...result}));
        if (!result.ok) process.exitCode = 1;
    }
}
module.exports = validator;