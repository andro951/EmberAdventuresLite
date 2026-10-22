const {test} = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {once} = require("node:events");
const {createHandler, setupTailscale} = require("./server.cjs");
const contract = require("./contract.js");
const client = require("./client.js");
const token = "synthetic-test-key-not-a-real-key-123456789";
async function listen(server, t) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => { server.closeAllConnections(); server.close(); });
    return `http://127.0.0.1:${server.address().port}`;
}
async function fixture(t, behavior = null, hostOptions = {}) {
    const calls = [];
    const installedNames = hostOptions.installedNames || ["test-model:latest", "other-model:latest"];
    const upstream = http.createServer(async (req, res) => {
        if (req.url === "/api/tags") {
            res.end(JSON.stringify({models: installedNames.map(name => ({name}))}));
            return;
        }
        if (req.url === "/api/ps") { res.end(JSON.stringify({models: []})); return; }
        const chunks = [];
        for await (const chunk of req)
            chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks));
        calls.push(body);
        if (behavior) {
            behavior(req, res, body);
            return;
        }
        res.setHeader("Content-Type", "application/x-ndjson");
        const bytes = Buffer.from(JSON.stringify({message: {content: "Hi 🐉", thinking: "private thought"}, done: false}) + "\n" + JSON.stringify({message: {content: " there"}, done: true, done_reason: "stop"}));
        for (const byte of bytes)
            res.write(Buffer.from([byte]));
        res.end();
    });
    const ollamaUrl = await listen(upstream, t);
    const server = http.createServer(createHandler({token, ollamaUrl, ...hostOptions}));
    const url = await listen(server, t);
    return {config: {...contract.defaults, provider: "ollama", url, model: "test-model:latest"}, calls};
}
test("reasoning defaults off and explicitly follows the checkbox for local and remote clients", async t => {
    const {config, calls} = await fixture(t);
    for (const reasoning of [undefined, false, true]) {
        const selected = {...config};
        if (reasoning === undefined) delete selected.reasoning;
        else selected.reasoning = reasoning;
        const before = JSON.stringify(selected);
        assert.equal(await client.generate(selected, token, "Synthetic reasoning test"), "Hi 🐉 there");
        assert.equal(calls.at(-1).think, reasoning === true);
        assert.equal(Object.hasOwn(calls.at(-1).options, "think"), false);
        assert.equal(JSON.stringify(selected), before);
        contract.validate({...selected, connection: "tailscale", url: "https://smoke.tail.ts.net"});
    }
    for (const reasoning of ["false", "true", 0, 1, null])
        assert.throws(() => contract.validate({...config, reasoning}), /must be true or false/);
});

test("authentication, origins, and private-network preflight", async t => {
    const {config} = await fixture(t);
    assert.equal((await fetch(`${config.url}/api/status`)).status, 401);
    assert.deepEqual(await (await fetch(`${config.url}/api/host/discovery`)).json(), {app:'EmberAdventures Host', version:1});
    assert.equal((await fetch(`${config.url}/api/status`, {headers: {Origin: "https://untrusted.invalid", Authorization: `Bearer ${token}`}})).status, 403);
    const preflight = await fetch(`${config.url}/api/text/generate`, {method: "OPTIONS", headers: {Origin: "https://perchance.org"}});
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://perchance.org");
    assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");
    assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/);
    assert.equal((await fetch(`${config.url}/api/pull`, {method: "POST", headers: {Authorization: `Bearer ${token}`}})).status, 404);
});
test("installed models, real HTTP streaming, split UTF8, tuning and stop sequences", async t => {
    const {config, calls} = await fixture(t);
    assert.deepEqual((await client.status(config, token)).models, ["test-model:latest", "other-model:latest"]);
    const deltas = [];
    const text = await client.generate({...config, temperature: "0.7", seed: "0", num_ctx: "8192", num_predict: "4000", top_p: "0.9", top_k: "40", repeat_penalty: "1.1"}, token, "A synthetic adventure prompt 🐉", {
        startWith: "Hi", stopSequences: ["END"], onChunk: delta => deltas.push(delta)
    });
    assert.equal(text, "Hi 🐉 there");
    assert.deepEqual(deltas, ["Hi 🐉", " there"]);
    assert.equal(calls[0].stream, true);
    assert.match(calls[0].messages[0].content, /🐉/);
    assert.deepEqual(calls[0].options, {temperature: 0.7, seed: 0, num_ctx: 12288, num_predict: 4000, top_p: 0.9, top_k: 40, repeat_penalty: 1.1, stop: ["END"]});
});
test("nested GGUF files appear and a selected file imports before loading", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ember-model-files-"));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const names = ["Qwen3.5-2B-GGUF", "Orion-GGUF", "Dwarf-GGUF", "Dragon-GGUF"];
    for (const name of names) {
        const folder = path.join(directory, "lmstudio-community", name);
        fs.mkdirSync(folder, {recursive: true});
        fs.writeFileSync(path.join(folder, `${name}.gguf`), "GGUF");
    }
    const imported = [];
    const {config, calls} = await fixture(t, (req, res, body) => {
        assert.equal(req.url, "/api/generate");
        res.end(JSON.stringify({done: true}));
    }, {modelRoot: directory, importModel: async model => imported.push(model)});
    const result = await client.status(config, token);
    assert.equal(result.availableFiles.length, 4);
    assert.ok(result.availableFiles.some(model => model.label === "Qwen3.5-2B-GGUF.gguf"));
    const selected = result.availableFiles.find(model => model.label === "Qwen3.5-2B-GGUF.gguf");
    await client.load({...config, model: selected.name}, token);
    assert.equal(imported.length, 1);
    assert.equal(imported[0].file, path.join(directory, "lmstudio-community", "Qwen3.5-2B-GGUF", "Qwen3.5-2B-GGUF.gguf"));
    assert.equal(calls.at(-1).model, selected.name);
});
test("registered GGUF models keep their original filename as the display label", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ember-model-label-"));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const filename = "Qwen3.5-9B-Q4_K_M.gguf";
    fs.writeFileSync(path.join(directory, filename), "GGUF");
    const name = require("./model-files.cjs").discover(directory)[0].name;
    const {config} = await fixture(t, null, {modelRoot: directory, installedNames: [name]});
    const result = await client.status(config, token);
    assert.deepEqual(result.models, [name]);
    assert.equal(result.modelLabels[name], filename);
    assert.deepEqual(result.availableFiles, []);
});
test("context size errors show a player-facing explanation", async t => {
    const {config} = await fixture(t, (_req, res) => {
        res.writeHead(400, {"Content-Type": "application/json"});
        res.end(JSON.stringify({error: {type: "exceed_context_size_error", n_prompt_tokens: 4134, n_ctx: 4096}}));
    });
    await assert.rejects(client.generate(config, token, "A story prompt"), /could not fit the game's story prompt/);
});
test("host reports GGUF import percentage, memory-loading stage, and readiness", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ember-model-progress-"));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    fs.writeFileSync(path.join(directory, "Synthetic.gguf"), "GGUF");
    const progressFile = path.join(directory, "progress.json");
    let finishImport;
    const importPending = new Promise(resolve => { finishImport = resolve; });
    let finishWarmup;
    const warmupPending = new Promise(resolve => { finishWarmup = resolve; });
    const {config} = await fixture(t, async (_req, res) => {
        await warmupPending;
        res.end(JSON.stringify({done: true}));
    }, {modelRoot: directory, progressFile, importModel: async (_model, _exe, _signal, report) => {
        report("copying file 42%", 42);
        await importPending;
    }});
    const selected = (await client.status(config, token)).availableFiles[0];
    const loading = client.load({...config, model: selected.name}, token);
    const waitFor = async predicate => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (fs.existsSync(progressFile)) {
                try {
                    const record = JSON.parse(fs.readFileSync(progressFile, "utf8"));
                    if (predicate(record)) return record;
                } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error("Host progress did not reach the expected stage");
    };
    const importing = await waitFor(record => record.message.includes("Importing GGUF") && record.percent === 42);
    assert.equal(importing.state, "active");
    finishImport();
    const warmup = await waitFor(record => record.message.includes("Loading model into memory"));
    assert.equal(warmup.percent, null);
    finishWarmup();
    await loading;
    assert.equal(JSON.parse(fs.readFileSync(progressFile, "utf8")).state, "ready");
});
test("model load disconnect identifies whether Ollama itself is still responding", async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ember-model-disconnect-"));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const progressFile = path.join(directory, "progress.json");
    const {config} = await fixture(t, (_req, res) => res.destroy(), {progressFile});
    await assert.rejects(client.load(config, token), /Ollama is still responding, but its loading model into memory connection closed/);
    const progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
    assert.equal(progress.state, "error");
    assert.match(progress.message, /model runner may have failed/);
});
test("selected model is used and defaults are not invented", async t => {
    const {config, calls} = await fixture(t);
    await client.generate({...config, model: "other-model:latest"}, token, "Test");
    assert.equal(calls[0].model, "other-model:latest");
    assert.deepEqual(calls[0].options, {num_ctx: 12288, stop: []});
    await client.generate({...config, num_ctx: "4096"}, token, "A".repeat(40000));
    assert.equal(calls[1].options.num_ctx, 16384, "the host grows context for a longer prompt rather than using an old saved setting");
    await client.generate(config, token, "Short follow-up");
    assert.equal(calls[2].options.num_ctx, 16384, "a short state check does not shrink context and reload the model");
});
test("chat, state updates, and short responses keep the same loaded context", async t => {
    const {config, calls} = await fixture(t);
    for (const length of [17464, 26099, 2709])
        await client.generate(config, token, "A".repeat(length));
    assert.deepEqual(calls.map(call => call.options.num_ctx), [12288, 12288, 12288]);
});
test("strict configuration rejects unsafe URLs, missing fields, and invalid tuning", () => {
    for (const patch of [{temperature: "NaN"}, {seed: "1.5"}, {num_ctx: "0"}, {top_p: "2"}, {temperature: " "}, {model: 5}, {connection: "tailscale", url: "http://pc.tail.ts.net"}, {url: "https://localhost/path"}, {url: "https://user:pass@localhost"}, {url: "https://external.invalid"}, {unknown: true}])
        assert.throws(() => contract.validate({...contract.defaults, ...patch}));
    assert.throws(() => contract.validate({}));
    assert.equal(contract.validate({...contract.defaults, connection: "tailscale", url: "https://pc.tail.ts.net"}).connection, "tailscale");
});
test("HTTP failures and stream failures are never retried silently", async t => {
    for (const [behavior, expected] of [
        [(_q, res) => {res.writeHead(500); res.end(JSON.stringify({error: "model unavailable"}));}, /model unavailable/],
        [(_q, res) => res.end(JSON.stringify({message: {content: "partial"}, done: false}) + "\n"), /before completing/],
        [(_q, res) => res.end(JSON.stringify({error: "GPU exhausted"}) + "\n"), /GPU exhausted/],
        [(_q, res) => res.end(JSON.stringify({message: {content: "cut short"}, done: true, done_reason: "length"}) + "\n"), /response limit/],
        [(_q, res) => res.end(JSON.stringify({message: {content: ""}, done: true}) + "\n"), /empty response/],
        [(_q, res) => res.end("not json\n"), /JSON|Unexpected/]
    ]) {
        const {config, calls} = await fixture(t, behavior);
        await assert.rejects(client.generate(config, token, "Test"), expected);
        assert.equal(calls.length, 1);
    }
});
test("browser cancellation closes upstream while generation is still pending", async t => {
    let upstreamClosed;
    const closed = new Promise(resolve => {upstreamClosed = resolve;});
    const {config} = await fixture(t, (_q, res) => {
        res.write(JSON.stringify({message: {content: "first"}, done: false}) + "\n");
        res.on("close", upstreamClosed);
    });
    const controller = new AbortController();
    await assert.rejects(client.generate(config, token, "Test", {signal: controller.signal, onChunk: () => controller.abort()}), /abort/i);
    await Promise.race([closed, new Promise((_, reject) => {const timer = setTimeout(() => reject(new Error("upstream was not cancelled")), 2000); timer.unref();})]);
});
test("game provider adapter streams the common contract and preserves Perchance routing", async t => {
    const fs = require("node:fs");
    const path = require("node:path");
    const vm = require("node:vm");
    const sourcePath = path.join(__dirname, "../../src/scripts/app/10-state-ai-queue.js");
    if (!fs.existsSync(sourcePath)) {
        t.skip("Game adapter test runs in the game repository; the portable host tests above are self-contained.");
        return;
    }
    const source = fs.readFileSync(sourcePath, "utf8");
    const functions = ["runAiTextNow", "exactTextProvider", "currentLaunchTextProvider", "normalizeAiTextOutput", "aiCancelledError", "isAiCancelledError"];
    const declarations = functions.map(name => {
        const match = source.match(new RegExp(`^        (?:async )?function ${name}\\([^]*?^        }`, "m"));
        assert.ok(match, `Missing production function ${name}`);
        return match[0];
    }).join("\n");
    const {config} = await fixture(t);
    let pluginCalls = 0;
    const plugin = async options => {
        pluginCalls++;
        options.onChunk?.({textChunk: "Perchance fixture"});
        return {generatedText: "Perchance fixture", stopReason: "stop"};
    };
    const context = vm.createContext({
        EmberOllamaClient: client, AbortController, performance, setTimeout, fetch,
        EmberGenerationContract: require("../../src/contracts/generation-contract.js"), URL, URLSearchParams,
        EmberDirectHostingContract: require("../../src/contracts/direct-hosting-contract.js"),
        EmberDirectHostingClient: require("../../src/scripts/integration/direct-hosting-client.js"),
        window: {location: {search: ""}}, localStorage: {getItem: () => null},
        app: {settings: {ollama: config, devMode: false}, ollamaAccessKey: token, cancelledAiMessageIds: new Set()},
        inferAiLabel: () => "test", aiLogType: () => "system", aiLogTitle: () => "test", aiProcessLabel: () => "test",
        aiPromptDevLogDetail: () => ({}), aiResponseDevLogDetail: () => ({}), devLog: () => {}, log: () => {}, standardAiTimingText: () => "",
        perchancePlugin: () => plugin, prepareAiTextPluginFrame: async () => {}, clone: structuredClone
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../../src/scripts/app/02a-generation-providers.js"), "utf8") + declarations, context);
    const stream = [];
    const opts = {onStream: (text, delta, done) => stream.push({text, delta, done})};
    const result = await context.runAiTextNow("Synthetic integration prompt", opts);
    assert.equal(result, "Hi 🐉 there");
    assert.equal(stream.filter(event => !event.done).length, 2);
    assert.equal(stream.at(-1).done, true);
    assert.equal(stream.at(-1).delta, "");
    assert.equal(opts.abortProvider, undefined);
    assert.equal(pluginCalls, 0);
    context.app.settings.ollama.provider = "perchance";
    assert.equal(await context.runAiTextNow("Perchance test"), "Perchance fixture");
    assert.equal(pluginCalls, 1);
    assert.throws(() => context.exactTextProvider("local-codex"), /must be exactly/);
});
test("remote clients can refresh and select the host's installed models", async t => {
    const {config, calls} = await fixture(t);
    assert.equal((await client.status(config, token)).models.length, 2);
    const remoteConfig = {...config, connection: "tailscale", url: "https://synthetic.tail.ts.net", model: "other-model:latest"};
    const response = await fetch(`${config.url}/api/text/generate`, {
        method: "POST", headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
        body: JSON.stringify({config: remoteConfig, instruction: "Synthetic test", startWith: "", stopSequences: []})
    });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(calls[0].model, "other-model:latest");
});
test("model warmup confirms readiness only after completion and uses selected context", async t => {
    let complete;
    let started;
    const startedPromise = new Promise(resolve => {started = resolve;});
    const {config, calls} = await fixture(t, (_req, res) => {
        complete = () => res.end(JSON.stringify({done: true}));
        started();
    });
    let ready = false;
    const pending = client.load({...config, num_ctx: "8192"}, token).then(result => {ready = true; return result;});
    await startedPromise;
    assert.equal(ready, false);
    assert.deepEqual(calls[0], {model: "test-model:latest", prompt: "", stream: false, keep_alive: "30m", options: {num_ctx: 12288}});
    complete();
    assert.equal((await pending).ready, true);
});
test("model warmup errors are actionable and cancellation reaches Ollama", async t => {
    const failure = await fixture(t, (_req, res) => {res.writeHead(500); res.end(JSON.stringify({error: "Model cannot fit in memory"}));});
    await assert.rejects(client.load(failure.config, token), /cannot fit/);
    let started;
    let closed;
    const startedPromise = new Promise(resolve => {started = resolve;});
    const closedPromise = new Promise(resolve => {closed = resolve;});
    const slow = await fixture(t, (_req, res) => {res.on("close", closed); started();});
    const controller = new AbortController();
    const result = client.load(slow.config, token, controller.signal);
    const rejection = assert.rejects(result, /abort/i);
    await startedPromise;
    controller.abort();
    await rejection;
    await Promise.race([closedPromise, new Promise((_, reject) => {const timer = setTimeout(() => reject(new Error("Warmup was not cancelled")), 2000); timer.unref();})]);
});

test("pairing requires approval, rejects concurrent requests and does not disclose the administrative key", async t => {
    let decide;
    let prompts = 0;
    const server = http.createServer(createHandler({token, approve: () => { prompts++; return new Promise(resolve => {decide = resolve;}); }}));
    const url = await listen(server, t);
    const pending = fetch(`${url}/api/pair`, {method: "POST"});
    while (!decide) await new Promise(resolve => setImmediate(resolve));
    assert.equal((await fetch(`${url}/api/pair`, {method: "POST"})).status, 409);
    assert.equal((await fetch(`${url}/api/pair`, {method: "POST", headers: {Origin: "https://untrusted.invalid"}})).status, 403);
    assert.equal(prompts, 1);
    decide(false);
    assert.equal((await pending).status, 403);
    decide = null;
    const approved = client.pair({...contract.defaults, provider: "ollama", url});
    while (!decide) await new Promise(resolve => setImmediate(resolve));
    decide(true);
    const credential = await approved;
    assert.notEqual(credential, token);
    assert.equal((await fetch(`${url}/unknown`, {headers: {Authorization: `Bearer ${credential}`}})).status, 404);
    assert.equal((await fetch(`${url}/unknown`, {headers: {Authorization: `Bearer ${credential}bad`}})).status, 401);
    const restarted = await listen(http.createServer(createHandler({token})), t);
    assert.equal((await fetch(`${restarted}/unknown`, {headers: {Authorization: `Bearer ${credential}`}})).status, 401);
});

test("host setup configures Tailscale Serve and reports its private address", async () => {
    const calls = [];
    const url = await setupTailscale(async args => {
        calls.push(args);
        return args[0] === "status" ? JSON.stringify({Self: {DNSName: "synthetic.tail.ts.net."}}) : "";
    });
    assert.equal(url, "https://synthetic.tail.ts.net");
    assert.deepEqual(calls, [["serve", "--bg", "http://127.0.0.1:51820"], ["status", "--json"]]);
    await assert.rejects(setupTailscale(async args => args[0] === "status" ? JSON.stringify({Self: {DNSName: "untrusted.invalid"}}) : ""), /private HTTPS hostname/);
});

test("Windows host supervisor reports invalid folder without changing configuration", {skip: process.platform !== "win32"}, async t => {
    const fs = require("node:fs/promises");
    const path = require("node:path");
    const os = require("node:os");
    const {execFile} = require("node:child_process");
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ea-host-test-"));
    t.after(() => fs.rm(directory, {recursive: true, force: true}));
    const configFile = path.join(__dirname, "host-config.json");
    const before = await fs.readFile(configFile).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    await new Promise((resolve, reject) => {
        execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "host-session.ps1"), "-ModelFolder", path.join(directory, "missing"), "-SessionDirectory", directory], {windowsHide: true}, error => error ? reject(error) : resolve());
    });
    const state = JSON.parse((await fs.readFile(path.join(directory, "status.json"), "utf8")).replace(/^\uFEFF/, ""));
    assert.equal(state.state, "error");
    assert.match(state.message, /existing Ollama models folder/);
    assert.deepEqual(await fs.readFile(configFile).catch(error => { if (error.code === "ENOENT") return null; throw error; }), before);
});

test("host replacement requires the administrative credential, never a game session", async t => {
    let stopped = 0;
    const identity = {directory: "synthetic-host-directory", pid: 1234};
    const url = await listen(http.createServer(createHandler({token, approve: async () => true, hostIdentity: identity, stopHost: () => {stopped++;}})), t);
    const paired = await client.pair({...contract.defaults, url});
    for (const headers of [{}, {Authorization: `Bearer ${paired}`}, {Authorization: `Bearer ${token}`, Origin: "https://perchance.org"}]) {
        const response = await fetch(`${url}/api/host/stop`, {method: "POST", headers});
        assert.ok([401, 403].includes(response.status));
    }
    assert.equal(stopped, 0);
    const headers = {Authorization: `Bearer ${token}`};
    assert.deepEqual(await (await fetch(`${url}/api/host/info`, {headers})).json(), identity);
    assert.equal((await fetch(`${url}/api/host/stop`, {headers})).status, 405);
    assert.equal(stopped, 0);
    assert.deepEqual(await (await fetch(`${url}/api/host/stop`, {method: "POST", headers})).json(), {stopping: true});
    assert.equal(stopped, 1);
});

test("pairing network failures explain iframe restrictions without exposing credentials", async () => {
    const vm = require("node:vm");
    const fs = require("node:fs");
    const source = fs.readFileSync(require("node:path").join(__dirname, "client.js"), "utf8");
    for (const blocked of [true, false]) {
        const context = vm.createContext({EmberOllama: contract, fetch: async () => {throw new TypeError("Failed to fetch");}, document: {featurePolicy: {features: () => ["local-network-access"], allowsFeature: () => !blocked}}});
        vm.runInContext(source, context);
        await assert.rejects(context.EmberOllamaClient.pair({...contract.defaults}), error => {
            assert.match(error.message, /https:\/\/localhost:51821\/api\/pair/);
            assert.match(error.message, blocked ? /embedding page blocks local-network-access/ : /HTTPS certificate/);
            assert.equal(error.message.includes(token), false);
            return true;
        });
    }
});

require('./window-test.cjs');
require('./player-discovery-test.cjs');
require('../ollama-player-connector/test.cjs');
