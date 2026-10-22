/* Shared by the game and the host. */
(function(root) {
    const defaults = Object.freeze({
        provider: "perchance", connection: "local", url: "https://localhost:51821", model: "",
        temperature: "", seed: "", top_p: "", top_k: "", repeat_penalty: "", num_ctx: "", num_predict: "", reasoning: false
    });
    const ranges = Object.freeze({
        temperature: [0, 2, false], seed: [0, 2147483647, true], top_p: [0, 1, false],
        top_k: [0, Infinity, true], repeat_penalty: [0, Infinity, false],
        num_ctx: [1, Infinity, true], num_predict: [1, Infinity, true]
    });
    function exactKeys(value, keys, label, optional = []) {
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error(`${label} must be an object.`);
        if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !optional.includes(key) && !Object.hasOwn(value, key)))
            throw new Error(`${label} has missing or unknown fields.`);
    }
    function options(config) {
        const result = {};
        for (const [key, [min, max, integer]] of Object.entries(ranges)) {
            const value = config[key];
            if (typeof value !== "string")
                throw new Error(`${key} must be a numeric string or empty for the model default.`);
            if (value === "")
                continue;
            if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))
                throw new Error(`${key} must be a number or empty for the model default.`);
            const number = Number(value);
            if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isSafeInteger(number)))
                throw new Error(`${key} is outside its supported range.`);
            result[key] = number;
        }
        return result;
    }
    function validate(config) {
        //Omission means disabled; reading existing settings never rewrites them.
        exactKeys(config, Object.keys(defaults), "Ollama settings", ["reasoning"]);
        if (Object.hasOwn(config, "reasoning") && typeof config.reasoning !== "boolean")
            throw new Error(`Enable Model Reasoning must be true or false.`);
        if (!["perchance", "ollama"].includes(config.provider) || !["local", "tailscale"].includes(config.connection))
            throw new Error(`Choose Perchance or Ollama and a local or Tailscale connection.`);
        if (typeof config.model !== "string" || config.model.trim() !== config.model)
            throw new Error(`Model must be an exact Ollama model name.`);
        if (typeof config.url !== "string")
            throw new Error(`Host URL must be text.`);
        const url = new URL(config.url);
        if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
            throw new Error(`Host URL must contain only the protocol, hostname, and optional port.`);
        const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (config.connection === "local" && (!loopback || !["http:", "https:"].includes(url.protocol)))
            throw new Error(`Local connection requires a localhost URL.`);
        if (config.connection === "tailscale" && (url.protocol !== "https:" || !url.hostname.endsWith(".ts.net")))
            throw new Error(`Use the private HTTPS .ts.net URL printed by Tailscale Serve.`);
        options(config);
        return config;
    }
    async function readStream(body, onRecord) {
        if (!body || typeof body.getReader !== "function")
            throw new Error(`The server did not provide a readable stream.`);
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let complete = false;
        try {
            for (;;) {
                const chunk = await reader.read();
                pending += decoder.decode(chunk.value, {stream: !chunk.done});
                let newline;
                while ((newline = pending.indexOf("\n")) !== -1) {
                    const line = pending.slice(0, newline).trim();
                    pending = pending.slice(newline + 1);
                    if (line)
                        await onRecord(JSON.parse(line));
                }
                if (chunk.done)
                    break;
            }
            if (pending.trim())
                await onRecord(JSON.parse(pending));
            complete = true;
        }
        finally {
            if (!complete)
                await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
    }
    const api = {defaults, ranges, exactKeys, options, validate, readStream};
    if (typeof module !== "undefined" && module.exports)
        module.exports = api;
    else
        root.EmberOllama = api;
})(globalThis);
