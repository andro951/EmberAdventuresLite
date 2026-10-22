const fs = require("node:fs");
const path = require("node:path");
const {createProductionContext} = require("./lib/production-declarations.cjs");
const root = path.resolve(__dirname,"..");
const p = createProductionContext();
p.load("defaultSettings");
p.context.app = {settings:structuredClone(p.context.defaultSettings)};
const rows = Array.from(p.invoke("devSmokeScenarioRegistry"),(scenario,index) => ({number:index+1,id:scenario.id,runAll:scenario.runAll !== false,group:scenario.group || "",...p.invoke("devSmokeScenarioMeta",scenario)}));
const ids = new Set();
for(const row of rows) {
    if(ids.has(row.id)) throw new Error("Duplicate smoke scenario: " + row.id);
    ids.add(row.id);
}
const lines = ["# EmberAdventuresLite smoke index","","Generated from the current scenario registry. This is an inventory, not a test result.","Browser smokes run only when explicitly requested. The extensive group is excluded from Run All.","","| Number | Scenario | Tier | Expected work |","| --- | --- | --- | --- |",...rows.map(row => "| " + row.number + " | " + row.id + " | " + row.tier + " | " + row.expectedText.replaceAll("|","/") + " |")];
fs.writeFileSync(path.join(root,"EMBERADVENTURES_SMOKE_INDEX.md"),lines.join("\n"));
fs.writeFileSync(path.join(root,"docs/rebuild/smoke-registry-review.json"),JSON.stringify(rows,null,2));
console.log("Indexed " + rows.length + " distinct scenarios without executing them.");
