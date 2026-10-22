"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {randomBytes, timingSafeEqual} = require("node:crypto");
const contract = require("../src/contracts/direct-hosting-contract.js");
const generation = require("../src/contracts/generation-contract.js");
const {validateConfig, createAdapters} = require("./adapters.cjs");

function sameSecret(actual, expected) {
    const left = Buffer.from(typeof actual === "string" ? actual : "");
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
}
function createDirectWorker(config, options) {
    validateConfig(config);
    contract.endpoint(options.baseUrl, "worker.baseUrl");
    contract.secret(options.controlKey, "worker.controlKey");
    const allowedOrigins = options.allowedOrigins;
    if (!Array.isArray(allowedOrigins) || !allowedOrigins.length)
        throw new Error("Worker needs an explicit game-origin allowlist.");

    for (const origin of allowedOrigins) {
        contract.origin(origin, "worker.allowedOrigins");
    }

    const roles = ["text", "image"].filter(role => config[role].kind !== "disabled");
    for (const role of roles) {
        generation.string(config[role].model, `worker.${role}.model`);
        contract.secret(options.tokens[role], `worker.tokens.${role}`);
        if (sameSecret(options.tokens[role], options.controlKey))
            throw new Error("Browser inference and launcher control credentials must differ.");
    }

    if (roles.length === 2 && sameSecret(options.tokens.text, options.tokens.image))
        throw new Error("Text and image browser credentials must differ.");

    const generate = options.generate || createAdapters(config, options);
    const reportError = options.onError || (detail => console.error(detail));
    const tickets = new Map();
    const jobs = new Map();
    const activeRoles = new Set();
    const view = record => contract.job(record.role, {id: record.id, status: record.status, result: record.result, error: record.error});
    async function read(req, res, send) {
        if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
            send(415, {error: "Use application/json."});
            return null;
        }

        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) {
                send(413, {error: "Request exceeds the 2 MiB transport limit."});
                return null;
            }

            chunks.push(chunk);
        }

        try { return {value: JSON.parse(Buffer.concat(chunks).toString("utf8"))}; }
        catch (error) { send(400, {error: "Invalid JSON."}); return null; }
    }
    return async function handler(req, res) {
        const origin = req.headers.origin;
        const allowed = allowedOrigins.includes(origin);
        const headers = {"Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff"};
        if (allowed) {
            Object.assign(headers, {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"});
        }

        const send = (status, value) => {
            if (!res.destroyed) {
                res.writeHead(status, {...headers, "Content-Type": "application/json"});
                res.end(JSON.stringify(value));
            }
        };
        if (origin && !allowed) {
            send(403, {error: "Game origin is not allowed."});
            return;
        }

        const pathname = new URL(req.url, "https://worker.invalid").pathname;
        const jobPath = /^\/ea\/jobs\/([0-9a-f-]+)(\/cancel)?$/.exec(pathname);
        const browserRoute = ["/ea/claim", "/ea/jobs"].includes(pathname) || !!jobPath;
        if (req.method === "OPTIONS" && browserRoute) {
            if (!allowed || req.headers["access-control-request-method"] && !["GET", "POST"].includes(req.headers["access-control-request-method"]) ||
                (req.headers["access-control-request-headers"] || "").split(",").some(header => header.trim() && !["authorization", "content-type"].includes(header.trim().toLowerCase()))) {
                send(403, {error: "Preflight is not permitted."});
                return;
            }

            res.writeHead(204, headers).end();
            return;
        }

        const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
        const control = sameSecret(bearer, options.controlKey);
        const role = roles.find(name => sameSecret(bearer, options.tokens[name]));
        if (pathname === "/ea/launches" && req.method === "POST") {
            //Launcher-only route, deliberately excluded from browser preflight and browser token scope.
            if (!control || origin) {
                send(403, {error: "Launcher authorization required."});
                return;
            }

            const body = await read(req, res, send);
            if (!body)
                return;

            try {
                const manifest = contract.manifest(body.value);
                if (!allowedOrigins.includes(manifest.audience))
                    throw new Error("Connection audience must be in the worker allowlist.");

                //A worker may issue a combined manifest, but its own lane must match its configured inference identity.
                for (const name of roles) {
                    if (manifest[name].baseUrl !== options.baseUrl || manifest[name].model !== config[name].model || !sameSecret(manifest[name].token, options.tokens[name]))
                        throw new Error(`Connection ${name} does not match this worker.`);
                }

                const ticket = randomBytes(32).toString("base64url");
                tickets.set(ticket, structuredClone(manifest));
                send(201, {baseUrl: options.baseUrl, ticket});
            }
            catch (error) { send(400, {error: "Invalid connection manifest for this worker."}); }
            return;
        }

        if (pathname === "/ea/claim" && req.method === "POST") {
            const body = await read(req, res, send);
            if (!body)
                return;

            try {
                generation.exact(body.value, ["ticket"], "claim");
                contract.secret(body.value.ticket, "claim.ticket");
            }
            catch (error) { send(400, {error: "Invalid connection claim."}); return; }
            const manifest = tickets.get(body.value.ticket);
            if (!manifest || origin !== manifest.audience) {
                send(403, {error: "Connection ticket is invalid, already used, or belongs to another origin."});
                return;
            }

            tickets.delete(body.value.ticket);
            send(200, manifest);
            return;
        }

        if (pathname === "/ea/usage" && req.method === "GET" && control && !origin) {
            const result = {};
            for (const name of roles) {
                const records = [...jobs.values()].filter(record => record.role === name);
                result[name] = {accepted: records.length, pending: records.filter(record => ["queued", "running"].includes(record.status)).length};
            }

            send(200, result);
            return;
        }

        if (browserRoute && !role) {
            send(401, {error: "Inference authorization required."});
            return;
        }

        if (pathname === "/ea/jobs" && req.method === "POST") {
            const body = await read(req, res, send);
            if (!body)
                return;

            let submitted;
            try { submitted = contract.submit(body.value); }
            catch (error) { send(400, {error: error.message}); return; }
            if (submitted.role !== role) {
                send(403, {error: "Credential cannot submit this role."});
                return;
            }

            if (jobs.has(submitted.id) || activeRoles.has(role)) {
                send(409, {error: "Job already exists or generation is already pending. No second job was submitted."});
                return;
            }

            const record = {id: submitted.id, role, status: "queued", result: null, error: null, controller: new AbortController()};
            jobs.set(record.id, record);
            activeRoles.add(role);
            send(202, view(record));
            //Work outlives the short submission/status sockets. Only the explicit cancel route aborts it.
            void Promise.resolve().then(async () => {
                if (record.status === "cancelled") {
                    activeRoles.delete(role);
                    return;
                }

                record.status = "running";
                try {
                    const result = generation.response(role, await generate(role, submitted.input, record.controller.signal));
                    if (record.status !== "cancelled") {
                        record.result = result;
                        record.status = "completed";
                    }
                }
                catch (error) {
                    if (record.status !== "cancelled") {
                        record.status = "failed";
                        record.error = "Worker inference failed. Inspect the host using this job ID.";
                        reportError({role, id: record.id, phase: "inference", message: "Worker inference failed."});
                    }
                }
                finally { activeRoles.delete(role); }
            }).catch(() => reportError({role, id: record.id, phase: "worker", message: "Job runner failed."}));
            return;
        }

        if (jobPath && role) {
            const record = jobs.get(jobPath[1]);
            if (!record || record.role !== role) {
                send(404, {error: "Job not found for this credential."});
                return;
            }

            if (jobPath[2] && req.method === "POST") {
                const body = await read(req, res, send);
                if (!body)
                    return;

                try { generation.exact(body.value, [], "cancel"); }
                catch (error) { send(400, {error: error.message}); return; }
                if (["queued", "running"].includes(record.status)) {
                    record.status = "cancelled";
                    record.controller.abort();
                }

                send(200, view(record));
                return;
            }

            if (!jobPath[2] && req.method === "GET") {
                send(200, view(record));
                return;
            }
        }

        send(404, {error: "Not found."});
    };
}
function launchUrl(baseUrl, ticket, gameUrl) {
    contract.endpoint(baseUrl, "launch.baseUrl");
    contract.secret(ticket, "launch.ticket");
    const url = new URL(gameUrl);
    if (url.origin !== "https://perchance.org" || url.username || url.password || url.search || url.hash)
        throw new Error("Game URL must be a published Perchance HTTPS page without query or fragment.");

    url.searchParams.set("emberDirect", baseUrl);
    url.searchParams.set("emberTicket", ticket);
    return url.href;
}
if (require.main === module) {
    const file = path.resolve(process.argv[2]);
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    const handler = createDirectWorker(config, {
        baseUrl: process.env.EMBER_DIRECT_BASE_URL, controlKey: process.env.EMBER_DIRECT_CONTROL_KEY,
        tokens: {text: process.env.EMBER_DIRECT_TEXT_TOKEN, image: process.env.EMBER_DIRECT_IMAGE_TOKEN},
        allowedOrigins: process.env.EMBER_ALLOWED_ORIGINS?.split(","), configDir: path.dirname(file)
    });
    const server = http.createServer((req, res) => {
        void handler(req, res).catch(() => {
            console.error("Direct worker request failed.");
            if (!res.headersSent)
                res.writeHead(500, {"Content-Type": "application/json"}).end(JSON.stringify({error: "Worker request failed."}));
            else
                res.destroy();
        });
    });
    server.requestTimeout = 0;
    server.listen(Number(process.env.EMBER_DIRECT_PORT || 8010), "0.0.0.0", () => console.log("Direct inference worker listening; expose through the provider HTTPS proxy."));
}
module.exports = {createDirectWorker, launchUrl};