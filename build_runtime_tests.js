const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

childProcess.execFileSync(process.execPath, [
  path.join(__dirname, "save-storage-diagnostic", "build-schema-contract.js"),
  "--output",
  path.join(__dirname, "src", "persistence", "schema-contract.js"),
  "--database-name",
  "EmberAdventuresLiteRuntimeV2",
], { stdio: "inherit" });
childProcess.execFileSync(process.execPath, [
  path.join(__dirname, "save-storage-diagnostic", "build-schema-contract.js"),
  "--output",
  path.join(__dirname, "src", "persistence", "diagnostic-schema-contract.js"),
  "--database-name",
  "EmberAdventuresLiteRuntimeDiagnostic",
], { stdio: "inherit" });

const { assembleBottomSource } = require("./build_source");
const outputPath = path.join(__dirname, "bottom.runtime-tests.html");
const source = assembleBottomSource({ includeTests: true });

fs.writeFileSync(outputPath, source, "utf8");
console.log(`Built ${outputPath}: ${Buffer.byteLength(source, "utf8").toLocaleString()} bytes`);
