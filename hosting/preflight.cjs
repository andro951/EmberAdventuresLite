// Configuration-only by default. No inference, account changes, downloads or spend.
const fs = require("node:fs");
const path = require("node:path");
const {validateConfig,createAdapters} = require("./adapters.cjs");
try {
  const file=path.resolve(process.argv[2]||"hosting/config.local.json");
  const config=validateConfig(JSON.parse(fs.readFileSync(file,"utf8")));
  createAdapters(config,{configDir:path.dirname(file)});
  let ready=true;
  for(const role of ["text","image"]){
    const c=config[role];console.log(`${role}: ${c.kind}`);
    const variable=c.authorizationEnv||c.apiKeyEnv;
    if(variable&&!process.env[variable]){console.log(`  MISSING environment variable: ${variable} (value not displayed)`);ready=false;}
    if(c.inferenceKeyEnv&&!process.env[c.inferenceKeyEnv]){console.log(`  MISSING environment variable: ${c.inferenceKeyEnv} (value not displayed)`);ready=false;}
    if(c.kind==="disabled"){console.log("  Disabled; Perchance remains available in the game.");ready=false;}
  }
  console.log("Schema/workflow checks passed. Remote readiness, licensing, GPU fit and service behavior have NOT been tested.");
  if(!ready)process.exitCode=2;
}catch{console.error("Preflight failed. Check the strict config schema and referenced workflow paths; no remote request was sent.");process.exitCode=1;}
