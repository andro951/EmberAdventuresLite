const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
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

const projectDir = __dirname;
const includeTests = process.argv.includes("--private-tests");
const sourcePath = path.join(
  projectDir,
  includeTests ? "bottom.runtime-tests.html" : "bottom.html",
);
const outputPath = path.join(
  projectDir,
  includeTests ? "bottom_compressed.private-tests.html" : "bottom_compressed.html",
);
const chunkSize = 64000;

function jsString(value) {
  return JSON.stringify(value);
}

function chunkString(value, size) {
  const chunks = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

const assembledSource = assembleBottomSource({ includeTests });
const verificationSource = assembleBottomSource({ includeTests });
if (verificationSource !== assembledSource) {
  throw new Error(
    "Generated bottom source is not deterministic. Identical source inputs produced different payloads.",
  );
}
const buildMetadataMatch = assembledSource.match(
  /globalThis\.__EMBER_ADVENTURES_BUILD__=(\{[^;]+\});/,
);
if (!buildMetadataMatch) {
  throw new Error("Generated bottom source does not contain build metadata.");
}
const buildMetadata = JSON.parse(buildMetadataMatch[1]);
fs.writeFileSync(sourcePath, assembledSource, "utf8");
const source = Buffer.from(assembledSource, "utf8");
const compressed = zlib.gzipSync(source, { level: 9 });
const decompressed = zlib.gunzipSync(compressed);
if (Buffer.compare(source, decompressed) !== 0) {
  throw new Error("Compressed build verification failed: decompressed output differs from bottom.html.");
}
const base64 = compressed.toString("base64");
const chunks = chunkString(base64, chunkSize);

const output = `<!--
  EmberAdventures compressed Perchance bottom pane.
  Built from the src manifest by build_bottom_compressed.js.
  Build: ${buildMetadata.buildId}
  Source hash: ${buildMetadata.sourceHash}
  Paste this file into the Perchance bottom editor pane.
-->
<script>
(async () => {
  let payloadChunks = [
${chunks.map((chunk) => `    ${jsString(chunk)}`).join(",\n")}
  ];

  function base64ToBytes(base64) {
    if (typeof Uint8Array.fromBase64 === "function")
      return Uint8Array.fromBase64(base64);
    let binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    binary = "";
    return bytes;
  }

  async function gunzip(bytes) {
    if (!("DecompressionStream" in window)) {
      throw new Error("This browser does not support DecompressionStream, which EmberAdventures's compressed Perchance build requires.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }

  let base64 = payloadChunks.join("");
  payloadChunks.length = 0;
  payloadChunks = null;
  let compressedBytes = base64ToBytes(base64);
  base64 = "";
  let html = await gunzip(compressedBytes);
  compressedBytes = null;
  document.open();
  document.write(html);
  html = "";
  document.close();
})().catch((error) => {
  console.error("EmberAdventures compressed loader failed:", error);
  document.body.innerHTML = [
    "<main style='min-height:100vh;display:grid;place-items:center;background:#101116;color:#f4f1ea;font:16px system-ui,sans-serif;padding:2rem;'>",
    "<section style='max-width:720px;border:1px solid #74313b;background:#1b1217;border-radius:8px;padding:1rem 1.25rem;'>",
    "<h1 style='margin:0 0 .6rem;color:#ff9aa8;'>EmberAdventures failed to load</h1>",
    "<p style='margin:.35rem 0;color:#ddd;'>The compressed Perchance build could not unpack in this browser.</p>",
    "<pre style='white-space:pre-wrap;overflow-wrap:anywhere;color:#ffd6dc;'>" + String(error && error.stack || error) + "</pre>",
    "</section>",
    "</main>"
  ].join("");
});
</script>
`;

fs.writeFileSync(outputPath, output, "utf8");

const sourceBytes = source.length;
const gzipBytes = compressed.length;
const outputBytes = Buffer.byteLength(output, "utf8");
const ratio = (gzipBytes / sourceBytes) * 100;

console.log(`Built ${outputPath}`);
console.log(`Build ID: ${buildMetadata.buildId}`);
console.log(`Source hash: ${buildMetadata.sourceHash}`);
console.log(`Generated ${path.basename(sourcePath)}: ${sourceBytes.toLocaleString()} bytes`);
console.log(`Gzip payload: ${gzipBytes.toLocaleString()} bytes (${ratio.toFixed(1)}% of source)`);
console.log(`Output ${path.basename(outputPath)}: ${outputBytes.toLocaleString()} bytes`);
console.log(`Payload chunks: ${chunks.length}`);
