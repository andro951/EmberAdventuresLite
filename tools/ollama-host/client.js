(function(root) {
    const contract = typeof module !== "undefined" && module.exports ? require("./contract.js") : root.EmberOllama;
    function transport(config, path, init = {}) {
        contract.validate(config);
        const policy = root.document?.permissionsPolicy || root.document?.featurePolicy;
        const features = policy?.features?.() || [];
        const blocked = ["local-network-access", config.connection === "local" ? "loopback-network" : "local-network"]
            .some(name => features.includes(name) && !policy.allowsFeature(name));
        if ((blocked || root.EmberOllamaWindowTransport?.hasWindow?.(config.url)) && root.EmberOllamaWindowTransport)
            return root.EmberOllamaWindowTransport.request(config, path, init);
        return fetch(`${config.url.replace(/\/$/, "")}${path}`, {
            ...init,
            ...(config.connection === "local" ? {targetAddressSpace: "loopback"} : {})
        }).catch(error => {
            if (init.signal?.aborted)
                throw error;
            const policy = root.document?.permissionsPolicy || root.document?.featurePolicy;
            const features = policy?.features?.() || [];
            const blocked = ["local-network-access", config.connection === "local" ? "loopback-network" : "local-network"]
                .filter(name => features.includes(name) && !policy.allowsFeature(name));
            const guidance = blocked.length
                ? `The embedding page blocks ${blocked.join(", ")}. Perchance must delegate this permission to the game iframe; retrying or reinstalling the model will not fix that restriction.`
                : `Check that the host is running, the browser trusts its HTTPS certificate, and this site is allowed local-network access${config.connection === "tailscale" ? "; also connect both devices to Tailscale" : ""}. The browser console may identify a certificate or iframe-permission block.`;
            throw new Error(`Could not reach ${config.url}${path}. ${guidance} Browser error: ${error.message}`);
        });
    }
    function request(config, token, path, init = {}) {
        if (!token)
            throw new Error(`Connect to the host in Text Model settings first.`);
        return transport(config, path, {...init, headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`}});
    }
    async function check(response) {
        if (response.ok)
            return response;
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || `Ollama host returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    async function status(config, token, signal) {
        const response = await check(await request(config, token, "/api/status", {signal}));
        const data = await response.json();
        if (!Array.isArray(data.models) || !data.models.every(model => typeof model === "string") || !Array.isArray(data.running) ||
            !Array.isArray(data.availableFiles) || !data.availableFiles.every(model => typeof model.name === "string" && typeof model.label === "string") ||
            !data.modelLabels || typeof data.modelLabels !== "object" || Array.isArray(data.modelLabels) ||
            Object.entries(data.modelLabels).some(([name, label]) => !data.models.includes(name) || typeof label !== "string"))
            throw new Error(`Unexpected Ollama host status response.`);
        return data;
    }
    async function load(config, token, signal) {
        const response = await check(await request(config, token, "/api/model/load", {
            method: "POST", signal, body: JSON.stringify({config})
        }));
        const data = await response.json();
        if (data.ready !== true || data.model !== config.model)
            throw new Error(`Host did not confirm that the selected model is ready.`);
        return data;
    }
    async function generate(config, token, instruction, opts = {}) {
        const response = await check(await request(config, token, "/api/text/generate", {
            method: "POST", signal: opts.signal,
            body: JSON.stringify({config, instruction, startWith: opts.startWith || "", stopSequences: opts.stopSequences || []})
        }));
        let text = "";
        let done = false;
        await contract.readStream(response.body, record => {
            if (record.error)
                throw new Error(record.error);
            if (done || typeof record.delta !== "string" || typeof record.done !== "boolean")
                throw new Error(`Malformed Ollama host stream.`);
            text += record.delta;
            if (record.delta)
                opts.onChunk?.(record.delta);
            if (record.done) {
                done = true;
                if (record.reason === "length")
                    throw new Error(`The model reached its response limit. Increase response tokens before retrying.`);
            }
        });
        if (!done)
            throw new Error(`Connection ended before Ollama completed its response. No turn was applied.`);
        if (!text.trim())
            throw new Error(`Ollama returned an empty response.`);
        return text;
    }
    async function pair(config, signal) {
        contract.validate(config);
        const response = await check(await transport(config, "/api/pair", {method: "POST", signal}));
        const result = await response.json();
        if (typeof result.token !== "string" || result.token.length < 32)
            throw new Error(`Host returned an invalid connection credential.`);
        return result.token;
    }
    const api = {status, load, generate, pair};
    if (typeof module !== "undefined" && module.exports)
        module.exports = api;
    else
        root.EmberOllamaClient = api;
})(globalThis);
