const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const {execFile, spawn} = require("node:child_process");
const {once} = require("node:events");
const contract = require("./contract.js");
const modelFiles = require("./model-files.cjs");
function generationOptions(config, instruction = "", previousContext = 12288) {
    const options = contract.options(config);
    //Keep a stable window across short and long passes; shrinking it makes Ollama reload the runner.
    options.num_ctx = Math.max(previousContext, Math.ceil((Math.ceil(instruction.length / 3) + 2048) / 4096) * 4096);
    return options;
}
function describeOllamaError(value) {
    let detail = value;
    if (typeof detail === "string" && detail.trim().startsWith("{")) {
        try { detail = JSON.parse(detail); } catch { }
    }
    if (detail && typeof detail === "object" && detail.error) detail = detail.error;
    if (detail?.type === "exceed_context_size_error")
        return `This model could not fit the game's story prompt. Try a model that supports longer input.`;
    return typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail);
}
async function importGguf(model, executable, signal, onProgress = () => {}) {
    if (!executable)
        throw new Error("Ollama executable was not passed to the host. Restart EmberAdventures Host.");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ember-ollama-import-"));
    const modelfile = path.join(directory, "Modelfile");
    try {
        fs.writeFileSync(modelfile, `FROM ${JSON.stringify(model.file.replace(/\\/g, "/"))}\n`);
        await new Promise((resolve, reject) => {
            const child = spawn(executable, ["create", model.name, "-f", modelfile], {windowsHide: true, signal});
            let recent = "";
            let pending = "";
            let settled = false;
            const update = chunk => {
                pending += chunk.toString();
                const lines = pending.split(/[\r\n]+/);
                pending = lines.pop() || "";
                for (const line of lines) {
                    const clean = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim();
                    if (!clean) continue;
                    recent = clean.slice(-300);
                    const percentage = clean.match(/(?:^|\s)(\d{1,3})%/);
                    onProgress(recent, percentage ? Math.min(100, Number(percentage[1])) : null);
                }
            };
            child.stdout.on("data", update);
            child.stderr.on("data", update);
            child.on("error", error => { if (!settled) { settled = true; reject(error); } });
            child.on("close", code => {
                if (settled) return;
                settled = true;
                if (code === 0) resolve();
                else reject(new Error(`Could not import ${model.label}: ${recent || `Ollama exited with code ${code}`}`));
            });
        });
    }
    finally { fs.rmSync(directory, {recursive: true, force: true}); }
}

function allowedOrigin(origin) {
    if (!origin)
        return true;
    if (origin === "null")
        return true; //Sandboxed frames must still obtain explicit host approval before authentication.
    const url = URL.parse(origin);
    return !!url && ((url.protocol === "https:" && (url.hostname === "perchance.org" || url.hostname.endsWith(".perchance.org"))) ||
        (["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
}
function authenticated(header, token) {
    const supplied = Buffer.from(header || "");
    const expected = Buffer.from(`Bearer ${token}`);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}
function approveConnection() {
    return new Promise((resolve, reject) => {
        execFile("powershell.exe", ["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-File", path.join(__dirname, "approve-connection.ps1")], {windowsHide: true}, (error, stdout) => {
            if (error) reject(new Error(`Could not display connection approval: ${error.message}`));
            else resolve(stdout.trim() === "approved");
        });
    });
}
function runTailscale(args) {
    return new Promise((resolve, reject) => {
        const executable = process.platform === "win32" ? path.join(process.env.ProgramFiles || "C:\\Program Files", "Tailscale", "tailscale.exe") : "tailscale";
        execFile(executable, args, {windowsHide: true}, (error, stdout, stderr) => {
            if (error) reject(new Error(`Tailscale setup failed. Install Tailscale, sign in, and enable HTTPS for your tailnet. ${stderr || error.message}`));
            else resolve(stdout);
        });
    });
}
async function setupTailscale(run = runTailscale) {
    await run(["serve", "--bg", "http://127.0.0.1:51820"]);
    const status = JSON.parse(await run(["status", "--json"]));
    const hostname = status.Self?.DNSName?.replace(/\.$/, "");
    if (!hostname || !/^[a-z0-9.-]+\.ts\.net$/i.test(hostname))
        throw new Error(`Tailscale did not report a private HTTPS hostname.`);
    return `https://${hostname}`;
}
function createHandler({token, ollamaUrl = "http://127.0.0.1:11434", fetchImpl = fetch, approve = approveConnection, hostIdentity = null, stopHost = null,
    modelRoot = process.env.OLLAMA_MODELS, ollamaExecutable = process.env.EA_OLLAMA_EXE, progressFile = process.env.EA_MODEL_PROGRESS_FILE, importModel = importGguf}) {
    let pairing = false;
    const sessions = new Set();
    const imports = new Map();
    const contextByModel = new Map();
    const optionsForModel = (config, instruction = "") => {
        const options = generationOptions(config, instruction, contextByModel.get(config.model) || 12288);
        contextByModel.set(config.model, options.num_ctx);
        return options;
    };
    function modelProgress(state, model, message, percent = null) {
        if (!progressFile) return;
        const record = {state, model, message, percent, at: new Date().toISOString()};
        try { fs.writeFileSync(progressFile, JSON.stringify(record)); }
        catch (error) { console.error(`Could not update host model progress: ${error.message}`); }
    }
    if (typeof token !== "string" || token.length < 32 || /\s/.test(token))
        throw new Error(`Host access key must contain at least 32 non-whitespace characters.`);
    const upstream = new URL(ollamaUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname) || upstream.protocol !== "http:" || upstream.pathname !== "/" || upstream.username || upstream.password || upstream.search || upstream.hash)
        throw new Error(`Ollama must run on an HTTP loopback address on this host.`);
    return async (req, res) => {
        const abort = new AbortController();
        res.on("close", () => {
            if (!res.writableEnded)
                abort.abort();
        });
        const send = (status, data) => {
            res.writeHead(status, {"Content-Type": "application/json"});
            res.end(JSON.stringify(data));
        };
        const sameRemoteHost = req.headers.origin === `https://${req.headers.host}` && /^[a-z0-9.-]+\.ts\.net$/i.test(req.headers.host || "");
        if (!allowedOrigin(req.headers.origin) && !sameRemoteHost) {
            send(403, {error: "This browser origin is not allowed."});
            return;
        }
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "null");
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.setHeader("Access-Control-Allow-Private-Network", "true");
        res.setHeader("Cache-Control", "no-store");
        if (req.method === "GET" && ["/connection", "/connection-window.js"].includes(req.url)) {
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
            if (req.url === "/connection") {
                res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
                res.end('<!doctype html><html><head><meta charset="utf-8"><title>EmberAdventures Connection</title><script defer src="/connection-window.js"></script></head><body></body></html>');
            }
            else {
                res.writeHead(200, {"Content-Type": "text/javascript; charset=utf-8"});
                res.end(fs.readFileSync(path.join(__dirname, "connection-window.js")));
            }
            return;
        }
        if (req.method === "GET" && req.url === "/api/host/discovery") {
            send(200, {app: "EmberAdventures Host", version: 1});
            return;
        }
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method === "POST" && req.url === "/api/pair") {
            if (pairing) {
                send(409, {error: "A connection approval is already open on the host computer."});
                return;
            }
            pairing = true;
            try {
                if (!await approve()) {
                    send(403, {error: "Connection was declined on the host computer."});
                    return;
                }
                if (abort.signal.aborted) return;
                const credential = crypto.randomBytes(32).toString("base64url");
                sessions.add(credential);
                send(200, {token: credential});
            }
            catch (error) {
                console.error(error.message);
                if (!abort.signal.aborted) send(500, {error: error.message});
            }
            finally { pairing = false; }
            return;
        }
        if (!authenticated(req.headers.authorization, token) && ![...sessions].some(session => authenticated(req.headers.authorization, session))) {
            send(401, {error: "This connection is no longer approved. Click Connect in Text Model settings to reconnect."});
            return;
        }
        try {
            if (req.url === "/api/host/info" || req.url === "/api/host/stop") {
                if (req.headers.origin || !authenticated(req.headers.authorization, token) || !hostIdentity || !stopHost) {
                    send(403, {error: "Host lifecycle controls are available only to its local supervisor."});
                    return;
                }
                if (req.method === "GET" && req.url === "/api/host/info") {
                    send(200, hostIdentity);
                    return;
                }
                if (req.method === "POST" && req.url === "/api/host/stop") {
                    res.once("finish", stopHost);
                    send(200, {stopping: true});
                    return;
                }
                send(405, {error: "Unsupported host lifecycle operation."});
                return;
            }
            if (req.method === "GET" && req.url === "/api/status") {
                const response = await fetchImpl(`${upstream.origin}/api/tags`, {signal: abort.signal});
                if (!response.ok)
                    throw new Error(`Ollama model listing failed (HTTP ${response.status}).`);
                const data = await response.json();
                if (!Array.isArray(data.models) || !data.models.every(model => typeof model.name === "string"))
                    throw new Error(`Ollama returned an invalid model list.`);
                const models = data.models.map(model => model.name);
                const runningResponse = await fetchImpl(`${upstream.origin}/api/ps`, {signal: abort.signal});
                if (!runningResponse.ok)
                    throw new Error(`Ollama loaded-model status failed (HTTP ${runningResponse.status}).`);
                const running = await runningResponse.json();
                if (!Array.isArray(running.models))
                    throw new Error(`Ollama returned invalid loaded-model status.`);
                const discovered = modelFiles.discover(modelRoot);
                const availableFiles = discovered.filter(model => !models.includes(model.name)).map(({name, label}) => ({name, label}));
                const modelLabels = Object.fromEntries(discovered.filter(model => models.includes(model.name)).map(({name, label}) => [name, label]));
                send(200, {models, modelLabels, availableFiles, configDefaults: contract.defaults, running: running.models.map(model => ({name: model.name, size: model.size, size_vram: model.size_vram, expires_at: model.expires_at}))});
                return;
            }
            if (req.method !== "POST" || !["/api/text/generate", "/api/model/load"].includes(req.url)) {
                send(404, {error: "Unknown host endpoint."});
                return;
            }
            const bodyChunks = [];
            let bodyBytes = 0;
            for await (const chunk of req) {
                bodyChunks.push(chunk);
                bodyBytes += chunk.length;
                if (bodyBytes > 32 * 1024 * 1024) {
                    send(413, {error: "Request exceeds the host transport limit; no prompt was sent."});
                    return;
                }
            }
            let payload;
            try {
                payload = JSON.parse(Buffer.concat(bodyChunks).toString("utf8"));
                contract.exactKeys(payload, req.url === "/api/model/load" ? ["config"] : ["config", "instruction", "startWith", "stopSequences"], "Text request");
                contract.validate(payload.config);
                if (req.url !== "/api/model/load" && (typeof payload.instruction !== "string" || !payload.instruction.trim() || typeof payload.startWith !== "string" || !Array.isArray(payload.stopSequences) || !payload.stopSequences.every(stop => typeof stop === "string" && stop.length)))
                    throw new Error(`Instruction, prefix, or stop sequences are invalid.`);
                if (!payload.config.model)
                    throw new Error(`Choose an installed Ollama model first.`);
            }
            catch (error) {
                send(400, {error: error.message});
                return;
            }
            if (req.url === "/api/model/load") {
                const modelName = payload.config.model;
                const started = Date.now();
                let phase = "Checking model";
                let percent = null;
                let detail = "";
                const report = () => modelProgress("active", modelName,
                    `${phase}: ${modelName}${detail ? ` — ${detail}` : ""} (${Math.floor((Date.now() - started) / 1000)}s elapsed)`, percent);
                const timer = setInterval(report, 1000);
                report();
                try {
                    const candidate = modelFiles.discover(modelRoot).find(model => model.name === modelName);
                    if (candidate) {
                        const listed = await fetchImpl(`${upstream.origin}/api/tags`, {signal: abort.signal});
                        if (!listed.ok) throw new Error(`Ollama model listing failed (HTTP ${listed.status}).`);
                        const installed = await listed.json();
                        if (!installed.models?.some(model => model.name === candidate.name)) {
                            phase = "Importing GGUF into Ollama";
                            report();
                            if (!imports.has(candidate.name)) {
                                const operation = importModel(candidate, ollamaExecutable, abort.signal, (line, value) => {
                                    detail = line;
                                    percent = value;
                                    report();
                                });
                                imports.set(candidate.name, operation);
                                operation.finally(() => { if (imports.get(candidate.name) === operation) imports.delete(candidate.name); }).catch(() => {});
                            }
                            await imports.get(candidate.name);
                        }
                    }
                    phase = "Loading model into memory";
                    detail = "";
                    percent = null;
                    report();
                    const options = optionsForModel(payload.config);
                    const response = await fetchImpl(`${upstream.origin}/api/generate`, {
                        method: "POST", signal: abort.signal, headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({model: modelName, prompt: "", stream: false, keep_alive: "30m",
                            options: Object.hasOwn(options, "num_ctx") ? {num_ctx: options.num_ctx} : {}})
                    });
                    const result = await response.json();
                    if (!response.ok || result.error || result.done !== true)
                        throw new Error(result.error ? describeOllamaError(result.error) : `Ollama did not confirm that the model finished loading.`);
                    modelProgress("ready", modelName, `${modelName} is loaded and ready.`, 100);
                    send(200, {ready: true, model: modelName});
                }
                catch (error) {
                    if (!abort.signal.aborted && error instanceof TypeError && (error.message === "fetch failed" || error.cause)) {
                        const cause = error.cause?.code || error.cause?.message || error.message;
                        let responding = false;
                        try {
                            const check = await fetchImpl(`${upstream.origin}/api/tags`, {signal: AbortSignal.timeout(2000)});
                            responding = check.ok;
                        } catch { }
                        const explanation = responding
                            ? `Ollama is still responding, but its ${phase.toLowerCase()} connection closed (${cause}). The model runner may have failed; check the Host's Ollama log.`
                            : `Ollama stopped responding during ${phase.toLowerCase()} (${cause}). Check the Host's Ollama log and available memory.`;
                        console.error(`Model load failed for ${modelName}: ${explanation}`);
                        error = new Error(explanation, {cause: error});
                    }
                    modelProgress(abort.signal.aborted ? "cancelled" : "error", modelName,
                        abort.signal.aborted ? `Loading ${modelName} was cancelled.` : `Loading ${modelName} failed: ${error.message}`);
                    throw error;
                }
                finally { clearInterval(timer); }
                return;
            }
            const messages = [{role: "user", content: payload.instruction}];
            if (payload.startWith)
                messages[0].content += `\n\nBegin your response with exactly this prefix: ${JSON.stringify(payload.startWith)}`;
            const response = await fetchImpl(`${upstream.origin}/api/chat`, {
                method: "POST", signal: abort.signal,
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({model: payload.config.model, messages, stream: true, keep_alive: "30m", think: payload.config.reasoning === true,
                    options: {...optionsForModel(payload.config, messages[0].content), stop: payload.stopSequences}})
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => ({}));
                send(502, {error: failure.error ? describeOllamaError(failure.error) : `Ollama returned HTTP ${response.status}.`});
                return;
            }
            res.writeHead(200, {"Content-Type": "application/x-ndjson", "X-Accel-Buffering": "no"});
            res.flushHeaders();
            let finished = false;
            await contract.readStream(response.body, async record => {
                if (record.error)
                    throw new Error(describeOllamaError(record.error));
                if (finished || typeof record.done !== "boolean" || (record.message?.content != null && typeof record.message.content !== "string"))
                    throw new Error(`Invalid Ollama stream record.`);
                finished = record.done;
                //Thinking is intentionally excluded from game text and state parsers.
                const output = {delta: record.message?.content || "", done: record.done, reason: record.done_reason || ""};
                if (!res.write(`${JSON.stringify(output)}\n`))
                    await once(res, "drain", {signal: abort.signal});
            });
            if (!finished)
                throw new Error(`Ollama disconnected before completing the response.`);
            res.end();
        }
        catch (error) {
            if (abort.signal.aborted)
                return;
            if (!res.headersSent)
                send(502, {error: `Ollama host: ${error.message}`});
            else
                res.end(`${JSON.stringify({error: error.message})}\n`);
        }
        finally {
            abort.abort();
        }
    };
}
function start() {
    const configPath = path.join(__dirname, "host-config.json");
    if (!fs.existsSync(configPath))
        throw new Error(`Run Setup Ollama Host.bat first.`);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
    const handler = createHandler({...config, hostIdentity: {directory: __dirname, pid: process.pid}, stopHost: () => {
        if (process.env.EA_HOST_STOP_FILE)
            fs.writeFileSync(process.env.EA_HOST_STOP_FILE, "stop");
        else
            process.exit(0);
    }});
    const server = http.createServer(handler);
    server.requestTimeout = 0;
    server.listen(51820, "127.0.0.1", () => console.log("Ollama host listening at http://127.0.0.1:51820 (Tailscale Serve target)."));
    server.on("error", error => { console.error(error.message); process.exit(1); });
    const cert = path.join(__dirname, "localhost.pfx");
    if (fs.existsSync(cert)) {
        for (const address of ["127.0.0.1", "::1"]) {
            const secure = https.createServer({pfx: fs.readFileSync(cert), passphrase: "emberadventures-local"}, handler);
            secure.requestTimeout = 0;
            secure.listen(51821, address, () => console.log(`Local browser endpoint: https://localhost:51821 (${address})`));
            secure.on("error", error => { console.error(error.message); process.exit(1); });
        }
    }
    console.log("Ready for EmberAdventures. New game connections request approval on this computer.");
}
if (require.main === module) {
    if (process.argv[2] === "--setup-tailscale")
        setupTailscale().then(url => process.stdout.write(`${url}\n`), error => { console.error(error.message); process.exitCode = 1; });
    else
        start();
}
module.exports = {createHandler, allowedOrigin, setupTailscale};
