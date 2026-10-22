const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const Module = require("node:module");

function loadAuthoringSkills(root, product = "EmberAdventures") {
    const archive = path.join(root, "skills", `${product}-skills.zip`);
    const bytes = fs.readFileSync(archive);
    const entries = new Map();
    let offset = 0;
    while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
        const flags = bytes.readUInt16LE(offset + 6);
        const compression = bytes.readUInt16LE(offset + 8);
        const size = bytes.readUInt32LE(offset + 18);
        const nameSize = bytes.readUInt16LE(offset + 26);
        const extraSize = bytes.readUInt16LE(offset + 28);
        const name = bytes.subarray(offset + 30, offset + 30 + nameSize).toString("utf8");
        const start = offset + 30 + nameSize + extraSize;
        if (flags & 9 || ![0, 8].includes(compression) || start + size > bytes.length)
            throw new Error(`Unsupported or truncated skill archive: ${archive}`);

        if (!name || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..") || entries.has(name))
            throw new Error(`Invalid or duplicate skill resource: ${name}`);

        const compressed = bytes.subarray(start, start + size);
        const data = compression === 8 ? zlib.inflateRawSync(compressed) : compressed;
        if (data.length !== bytes.readUInt32LE(offset + 22))
            throw new Error(`Skill resource size mismatch: ${name}`);

        entries.set(name, data);
        offset = start + size;
    }

    if (!entries.has("manifest.json"))
        throw new Error(`Skill archive has no manifest: ${archive}`);

    const manifest = JSON.parse(entries.get("manifest.json").toString("utf8"));
    if (manifest.product !== product || Object.keys(manifest.files).length + 1 !== entries.size)
        throw new Error(`Skill archive manifest mismatch: ${archive}`);

    for (const [name, expected] of Object.entries(manifest.files)) {
        const content = entries.get(name);
        if (!content || crypto.createHash("sha256").update(content).digest("hex") !== expected)
            throw new Error(`Skill resource checksum mismatch: ${name}`);
    }

    const text = name => {
        if (!entries.has(name))
            throw new Error(`Missing packaged skill resource: ${name}`);

        return entries.get(name).toString("utf8");
    };
    const json = name => JSON.parse(text(name));
    const validator = () => {
        const skill = product === "EmberAdventuresLite" ? "emberadventureslite-character" : "emberadventures-character";
        const filename = path.join(root, "tools", "lib", `${skill}-packaged-validator.cjs`);
        const compiled = new Module(filename, module);
        compiled.filename = filename;
        compiled.paths = module.paths;
        compiled._compile(text(`${skill}/scripts/validate-content.cjs`), filename);
        return compiled.exports;
    };
    return {manifest, entries, text, json, validator};
}

module.exports = {loadAuthoringSkills};