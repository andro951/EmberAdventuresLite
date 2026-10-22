"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const contract = require("../src/contracts/generation-contract.js");
const {createAdapters, validateConfig} = require("./adapters.cjs");
const liveSite = require("./live-site.json");

function createServer(config, options = {}) {
    validateConfig(config);
    const generate = options.generate || createAdapters(config, options);
    const allowedOrigins = options.allowedOrigins || [new URL(liveSite.url).origin, liveSite.game_origin];
    for (const origin of allowedOrigins) {
        if (new URL(origin).origin !== origin || !origin.startsWith("https://"))
            throw new Error("Allowed origins must be exact HTTPS origins.");
    }

    const inFlight = new Set();
    return async function handler(req, res) {
        let requestOrigin;
        try { requestOrigin = new URL(`http://${req.headers.host}`); }
        catch { res.writeHead(403).end(); return; }
        if (!["127.0.0.1", "localhost", "[::1]"].includes(requestOrigin.hostname)) {
            res.writeHead(403).end();
            return;
        }

        const origin = req.headers.origin;
        if (origin && origin !== requestOrigin.origin && origin !== `https://${req.headers.host}` && !allowedOrigins.includes(origin)) {
            res.writeHead(403).end();
            return;
        }

        const headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin"};
        if (origin) {
            Object.assign(headers, {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Ember-Generation",
                "Access-Control-Allow-Private-Network": "true"
            });
        }

        const send = (status, data) => {
            if (res.destroyed)
                return;

            res.writeHead(status, {...headers, "Content-Type": "application/json"});
            res.end(JSON.stringify(data));
        };
        const pathname = new URL(req.url, requestOrigin).pathname;
        const match = /^\/api\/generation\/(text|image)$/.exec(pathname);
        if (req.method === "OPTIONS" && (match || pathname === "/api/generation/status")) {
            res.writeHead(204, headers).end();
            return;
        }

        if (req.method === "GET" && pathname === "/api/generation/status") {
            send(200, {text: config.text.kind, image: config.image.kind, remoteVerified: false});
            return;
        }

        if (req.method !== "POST" || !match) {
            send(404, {error: "Not found."});
            return;
        }

        if (req.headers["x-ember-generation"] !== "1" || req.headers["content-type"]?.split(";")[0] !== "application/json") {
            send(403, {error: "Use the Ember generation JSON client."});
            return;
        }

        const role = match[1];
        if (inFlight.has(role)) {
            send(409, {error: `${role} generation is already pending. Wait for it or cancel it before submitting again.`});
            return;
        }

        const controller = new AbortController();
        res.on("close", () => {
            if (!res.writableEnded)
                controller.abort();
        });
        inFlight.add(role);
        try {
            const chunks = [];
            let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 2 * 1024 * 1024) {
                    send(413, {error: "Generation request exceeds the 2 MiB transport limit."});
                    return;
                }

                chunks.push(chunk);
            }

            let payload;
            try { payload = contract.request(role, JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
            catch (error) { send(400, {error: error.message}); return; }
            send(200, contract.response(role, await generate(role, payload, controller.signal)));
        }
        catch (error) {
            if (!controller.signal.aborted) {
                console.error(`Ember ${role} generation failed: ${error.message}`);
                send(502, {error: error.message});
            }
        }
        finally {
            inFlight.delete(role);
        }
    };
}
function launchUrl(origin, gameUrl = liveSite.url) {
    const url = new URL(gameUrl);
    if (url.protocol !== "https:" || url.hostname !== "perchance.org" || url.username || url.password || url.search || url.hash)
        throw new Error("The game launch URL must be a published Perchance HTTPS page without credentials or query parameters.");

    url.searchParams.set(liveSite.launch_parameter, contract.proxyUrl(origin));
    return url.href;
}
if (require.main === module) {
    const configPath = path.resolve(process.argv[2] || path.join(__dirname, "config.local.json"));
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const allowedOrigins = process.env.EMBER_ALLOWED_ORIGINS?.split(",");
    const server = http.createServer(createServer(config, {configDir: path.dirname(configPath), allowedOrigins}));
    server.requestTimeout = 0;
    server.on("error", error => {
        console.error(`Hosting bridge could not start: ${error.message}`);
        process.exitCode = 1;
    });
    server.listen(Number(process.env.EMBER_HOSTING_PORT || 51840), "127.0.0.1", () => console.log(launchUrl(`http://127.0.0.1:${server.address().port}`)));
}
module.exports = {createServer, launchUrl};
