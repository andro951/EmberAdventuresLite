"use strict";
const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("../src/contracts/generation-contract.js");
const {createAdapters} = require("./adapters.cjs");
const root = path.resolve(__dirname, "..");

function createServer(config, options = {}) {
  const generate = options.generate || createAdapters(config, options);
  const extraOrigins = options.allowedOrigins || [];
  for (const origin of extraOrigins) if (new URL(origin).origin !== origin || !origin.startsWith("https://")) throw new Error("Allowed origins must be exact HTTPS origins.");
  const inFlight = new Set();
  return async function handler(req, res) {
    // Bind loopback AND validate Host to resist DNS rebinding. Never trust arbitrary origins.
    let host;
    try { host = new URL(`http://${req.headers.host}`); } catch { res.writeHead(403).end(); return; }
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host.hostname)) { res.writeHead(403).end(); return; }
    const ownOrigins = [`http://${req.headers.host}`, `https://${req.headers.host}`];
    const origin = req.headers.origin;
    if (origin && !ownOrigins.includes(origin) && !extraOrigins.includes(origin)) { res.writeHead(403).end(); return; }
    const common = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin"};
    if (origin) Object.assign(common, {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Ember-Generation", "Access-Control-Allow-Private-Network": "true"});
    const send = (status, data) => { if (!res.destroyed) { res.writeHead(status, {...common, "Content-Type": "application/json"}); res.end(JSON.stringify(data)); } };
    const pathname = new URL(req.url, ownOrigins[0]).pathname;
    const match = /^\/api\/generation\/(text|image)$/.exec(pathname);
    if (req.method === "OPTIONS" && match) { res.writeHead(204, common).end(); return; }
    if (req.method === "POST" && match) {
      if (req.headers["x-ember-generation"] !== "1" || req.headers["content-type"]?.split(";")[0] !== "application/json") { send(403, {error: "Use the Ember generation JSON client."}); return; }
      const role = match[1];
      if (inFlight.has(role)) { send(409, {error: `${role} generation is already pending. Wait for it or cancel it before submitting again.`}); return; }
      const controller = new AbortController();
      res.on("close", () => { if (!res.writableEnded) controller.abort(); });
      inFlight.add(role);
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          // Transport budget only; rejected requests are never truncated or submitted.
          if (size > 2 * 1024 * 1024) { send(413, {error: "Generation request exceeds the 2 MiB transport limit."}); return; }
          chunks.push(chunk);
        }
        let payload;
        try { payload = contract.request(role, JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (error) { send(400, {error: error.message}); return; }
        const result = await generate(role, payload, controller.signal);
        send(200, contract.response(role, result));
      } catch (error) {
        // Adapter messages never echo upstream bodies, credentials, signed route data or prompts.
        if (!controller.signal.aborted) { console.error(`Ember ${role} generation failed: ${error.message}`); send(502, {error: error.message}); }
      } finally { inFlight.delete(role); }
      return;
    }
    if (req.method !== "GET") { send(404, {error: "Not found."}); return; }
    if (pathname === "/api/generation/status") { send(200, {text: config.text.kind, image: config.image.kind, remoteVerified: false}); return; }
    // Serve a small allowlist, never the project root, configuration, source or environment files.
    const publicPath = pathname === "/" ? "/bottom.html" : pathname;
    if (!(publicPath === "/bottom.html" || /^\/(characters|menu_assets|random_character|stories)\//.test(publicPath))) { send(404, {error: "Not found."}); return; }
    let file;
    try { file = path.resolve(root, "." + decodeURIComponent(publicPath)); } catch { send(400, {error: "Invalid path."}); return; }
    const allowedFile = candidate => candidate === path.join(root, "bottom.html") || ["characters", "menu_assets", "random_character", "stories"].some(dir => candidate.startsWith(path.join(root, dir) + path.sep));
    if (!allowedFile(file) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !allowedFile(fs.realpathSync(file))) { send(404, {error: "Not found."}); return; }
    const mime = {".html": "text/html; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml"}[path.extname(file)];
    if (!mime) { send(404, {error: "Not found."}); return; }
    res.writeHead(200, {...common, "Content-Type": mime}); fs.createReadStream(file).pipe(res);
  };
}
if (require.main === module) {
  try {
    const configPath = path.resolve(process.argv[2] || path.join(__dirname, "config.local.json"));
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const handler = createServer(config, {configDir: path.dirname(configPath), allowedOrigins: process.env.EMBER_ALLOWED_ORIGINS ? process.env.EMBER_ALLOWED_ORIGINS.split(",") : []});
    const port = Number(process.env.EMBER_HOSTING_PORT || 51840);
    const tls = process.env.EMBER_HOSTING_PFX;
    const server = tls ? https.createServer({pfx: fs.readFileSync(tls), passphrase: process.env.EMBER_HOSTING_PFX_PASSWORD}, handler) : http.createServer(handler);
    server.requestTimeout = 0; // Pending generation is not expired by the app.
    server.listen(port, "127.0.0.1", () => console.log(`Ember Lite hosting proxy: ${tls ? "https" : "http"}://127.0.0.1:${port} (remote services unverified)`));
  } catch (error) { console.error(`Hosting proxy startup failed: ${error.message}`); process.exitCode = 1; }
}
module.exports = {createServer};
