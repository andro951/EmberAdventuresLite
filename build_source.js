const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectDir = __dirname;
const sourceDir = path.join(projectDir, "src");
const manifestPath = path.join(sourceDir, "source-manifest.json");

function readSourceFile(relativePath) {
  const absolutePath = path.join(sourceDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing source fragment: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8").replace(/\r\n?/g, "\n");
}

function loadSourceManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing source manifest: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.styles) || !Array.isArray(manifest.applicationScripts)) {
    throw new Error("Source manifest must define styles and applicationScripts arrays.");
  }
  if (!Array.isArray(manifest.dependencyScripts)) {
    throw new Error("Source manifest must define a dependencyScripts array.");
  }
  if (!Array.isArray(manifest.workerScripts)) {
    throw new Error("Source manifest must define a workerScripts array.");
  }
  if (!Array.isArray(manifest.testWorkerScripts)) {
    throw new Error("Source manifest must define a testWorkerScripts array.");
  }
  if (!Array.isArray(manifest.libraryWorkerScripts)) {
    throw new Error("Source manifest must define a libraryWorkerScripts array.");
  }
  if (!Array.isArray(manifest.turnWorkerScripts)) {
    throw new Error("Source manifest must define a turnWorkerScripts array.");
  }
  return manifest;
}

function assembleBottomSource(options = {}) {
  const rebuildStatusPath = path.join(projectDir, "docs", "rebuild", "status.json");
  if (fs.existsSync(rebuildStatusPath) && JSON.parse(fs.readFileSync(rebuildStatusPath, "utf8")).readyToBuild !== true)
    throw new Error("The Lite rebuild is in progress. Finish its schema and content review before generating a publishable page.");

  const includeTests = options.includeTests === true;
  const manifest = loadSourceManifest();
  const styles = [
    ...manifest.styles,
    ...(includeTests ? (manifest.testStyles || []) : []),
  ].map(readSourceFile).join("");
  const shell = readSourceFile(manifest.shell);
  const dependencyScripts = manifest.dependencyScripts.map(readSourceFile).join("");
  const workerSource = (manifest.workerScripts || [])
    .map(readSourceFile)
    .join("\n")
    .replace(/^\s*importScripts\([^\n]+\);\s*$/m, "");
  const testWorkerSource = includeTests ? (manifest.testWorkerScripts || [])
    .map(readSourceFile)
    .join("\n")
    .replace(/^\s*importScripts\([^\n]+\);\s*$/m, "") : "";
  const libraryWorkerSource = (manifest.libraryWorkerScripts || [])
    .map(readSourceFile)
    .join("\n");
  const turnWorkerSource = (manifest.turnWorkerScripts || [])
    .map(readSourceFile)
    .join("\n");
  const diagnosticSchemaSource = includeTests ? readSourceFile(manifest.testWorkerScripts[0]) : "";
  const diagnosticSchemaMatch = includeTests ? diagnosticSchemaSource.match(/self\.EmberStorageSchema\s*=\s*([\s\S]+);\s*$/) : null;

  if (includeTests && diagnosticSchemaMatch == null)
    throw new Error("Diagnostic schema contract does not expose self.EmberStorageSchema.");

  const diagnosticSchema = includeTests ? JSON.parse(diagnosticSchemaMatch[1]) : null;
  const scriptBridge = readSourceFile(manifest.scriptBridge);
  const applicationScriptPaths = [];
  for (const scriptPath of manifest.applicationScripts) {
    applicationScriptPaths.push(scriptPath);
    if (
      includeTests &&
      scriptPath === manifest.testApplicationInsertAfter
    ) {
      applicationScriptPaths.push(...(manifest.testApplicationScripts || []));
    }
  }
  if (
    includeTests &&
    !manifest.testApplicationInsertAfter
  ) {
    applicationScriptPaths.push(...(manifest.testApplicationScripts || []));
  }
  const privateTestPaths = new Set(manifest.testApplicationScripts || []);
  const applicationScripts = applicationScriptPaths.map((scriptPath) => {
    const source = readSourceFile(scriptPath);
    if (!privateTestPaths.has(scriptPath))
      return source;
    return `\n/*__EA_PRIVATE_TEST_SOURCE_BEGIN__*/\n${source}\n/*__EA_PRIVATE_TEST_SOURCE_END__*/\n`;
  }).join("");
  const tail = readSourceFile(manifest.tail);

  // Parsing the generated scripts here catches broken fragment order before a
  // compressed build can be copied into Perchance.
  new Function(dependencyScripts);
  new Function(workerSource);
  if (includeTests)
    new Function(testWorkerSource);
  new Function(libraryWorkerSource);
  new Function(turnWorkerSource);
  new Function(applicationScripts);

  const testWorkerGlobals = includeTests
    ? `globalThis.__EMBER_ADVENTURES_PRIVATE_TEST_BUILD__=true;globalThis.__emberAdventuresTestWorkerSource=${JSON.stringify(testWorkerSource).replace(/</g, "\\u003c")};globalThis.__emberAdventuresTestLibraryWorkerSource=${JSON.stringify(libraryWorkerSource).replace(/</g, "\\u003c")};globalThis.__emberAdventuresTestTurnWorkerSource=${JSON.stringify(turnWorkerSource).replace(/</g, "\\u003c")};globalThis.__emberAdventuresTestSchema=${JSON.stringify(diagnosticSchema).replace(/</g, "\\u003c")};`
    : "";
  const embeddedWorkerScript = workerSource
    ? `<script>globalThis.__emberAdventuresPersistenceWorkerSource=${JSON.stringify(workerSource).replace(/</g, "\\u003c")};globalThis.__emberAdventuresLibraryWorkerSource=${JSON.stringify(libraryWorkerSource).replace(/</g, "\\u003c")};globalThis.__emberAdventuresTurnWorkerSource=${JSON.stringify(turnWorkerSource).replace(/</g, "\\u003c")};${testWorkerGlobals}</script>`
    : "";

  const buildMetadataPlaceholder = "__EMBER_ADVENTURES_BUILD_METADATA__";
  const assembledSource = [
    "<style>",
    styles,
    "</style>",
    shell,
    "<script>",
    `globalThis.__EMBER_ADVENTURES_BUILD__=${buildMetadataPlaceholder};`,
    "</script>",
    "<script>",
    dependencyScripts,
    "</script>",
    scriptBridge,
    embeddedWorkerScript,
    "<script>",
    applicationScripts,
    "</script>",
    tail,
  ].join("");
  const sourceHash = crypto
    .createHash("sha256")
    .update(assembledSource, "utf8")
    .digest("hex");
  const buildMetadata = {
    buildId: `ea-${sourceHash.slice(0, 16)}`,
    sourceHash,
    privateTests: includeTests,
  };
  return assembledSource.replace(
    buildMetadataPlaceholder,
    JSON.stringify(buildMetadata).replace(/</g, "\\u003c"),
  );
}

module.exports = {
  assembleBottomSource,
  loadSourceManifest,
  manifestPath,
  projectDir,
  sourceDir,
};
