const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function discover(root) {
    if (!root || !fs.existsSync(root)) return [];
    const found = [];
    const pending = [{directory: root, depth: 0}];
    let visited = 0;
    while (pending.length && visited < 5000) {
        const {directory, depth} = pending.shift();
        visited++;
        let entries;
        try { entries = fs.readdirSync(directory, {withFileTypes: true}); }
        catch { continue; }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory() && depth < 6 && !["blobs", "manifests", ".git", "node_modules"].includes(entry.name.toLowerCase()))
                pending.push({directory: fullPath, depth: depth + 1});
            else if (entry.isFile() && /\.gguf$/i.test(entry.name) && !/-\d{5}-of-\d{5}\.gguf$/i.test(entry.name)) {
                const name = `ea-local-${entry.name.replace(/\.gguf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "model"}-${crypto.createHash("sha256").update(fullPath.toLowerCase()).digest("hex").slice(0, 10)}:latest`;
                found.push({name, label: entry.name, file: fullPath});
            }
        }
    }
    return found.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
}

module.exports = {discover};
