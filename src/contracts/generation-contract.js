(function(root) {
    "use strict";
    function exact(value, keys, label) {
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error(`${label} must be an object.`);

        for (const key of Object.keys(value)) {
            if (!keys.includes(key))
                throw new Error(`${label}.${key} is unknown.`);
        }

        for (const key of keys) {
            if (!Object.hasOwn(value, key))
                throw new Error(`${label}.${key} is required.`);
        }

        return value;
    }
    function string(value, label, empty = false) {
        if (typeof value !== "string" || (!empty && !value.trim()))
            throw new Error(`${label} must be ${empty ? "text" : "nonempty text"}.`);

        return value;
    }
    function proxyUrl(value) {
        string(value, "Hosting bridge URL");
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/")
            throw new Error("Hosting bridge URL must be a loopback HTTP(S) origin without credentials, path, query, or fragment.");

        return url.origin;
    }
    function preferences(value) {
        exact(value, ["text", "image", "proxyUrl"], "generation");
        if (!["game", "perchance", "hosting-proxy"].includes(value.text))
            throw new Error("Choose the game's text settings, Perchance, or the hosting bridge.");

        if (!["perchance", "hosting-proxy"].includes(value.image))
            throw new Error("Choose Perchance images or the hosting bridge.");

        proxyUrl(value.proxyUrl);
        return value;
    }
    function launchPreferences(search) {
        const parameters = new URLSearchParams(search);
        if (!parameters.has("emberHosting"))
            return null;

        if (parameters.getAll("emberHosting").length !== 1)
            throw new Error("emberHosting must appear exactly once in the launch URL.");

        return preferences({text: "hosting-proxy", image: "hosting-proxy", proxyUrl: proxyUrl(parameters.get("emberHosting"))});
    }
    const hostedImageDefaults = Object.freeze({portrait: "832x1216", square: "1024x1024"});
    function hostedImageResolution(value = "512x768") {
        if (value === "512x768")
            return hostedImageDefaults.portrait;

        if (value === "512x512" || value === "768x768")
            return hostedImageDefaults.square;

        if (typeof value !== "string" || !/^[1-9]\d*x[1-9]\d*$/.test(value))
            throw new Error("Image resolution must be positive WIDTHxHEIGHT.");

        return value;
    }
    function request(role, value) {
        if (role === "text") {
            exact(value, ["instruction", "startWith", "stopSequences"], "request");
            string(value.instruction, "request.instruction");
            string(value.startWith, "request.startWith", true);
            if (!Array.isArray(value.stopSequences) || value.stopSequences.some(stop => typeof stop !== "string" || !stop))
                throw new Error("request.stopSequences must contain nonempty strings.");
        }
        else if (role === "image") {
            exact(value, ["prompt", "negativePrompt", "seed", "width", "height"], "request");
            string(value.prompt, "request.prompt");
            string(value.negativePrompt, "request.negativePrompt", true);
            if (!Number.isSafeInteger(value.seed) || value.seed < -1)
                throw new Error("request.seed must be -1 or a nonnegative safe integer.");

            for (const key of ["width", "height"]) {
                if (!Number.isSafeInteger(value[key]) || value[key] < 1)
                    throw new Error(`request.${key} must be a positive safe integer.`);
            }
        }
        else
            throw new Error("Unknown generation role.");

        return value;
    }
    function imageSource(value) {
        string(value, "response.image");
        if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
            return value;

        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password)
            throw new Error("response.image must be an HTTPS asset URL or PNG/JPEG/WebP data URL.");

        return value;
    }
    function response(role, value) {
        if (role !== "text" && role !== "image")
            throw new Error("Unknown generation role.");

        exact(value, [role], "response");
        if (role === "text")
            string(value.text, "response.text");
        else
            imageSource(value.image);

        return value;
    }
    const api = {exact, string, proxyUrl, preferences, launchPreferences, hostedImageDefaults, hostedImageResolution, request, response, imageSource};
    if (typeof module === "object" && module.exports)
        module.exports = api;
    else
        root.EmberGenerationContract = api;
})(globalThis);
