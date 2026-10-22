(function(root) {
    "use strict";
    const generation = typeof module === "object" && module.exports ? require("./generation-contract.js") : root.EmberGenerationContract;
    function endpoint(value, at) {
        generation.string(value, at);
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/ea")
            throw new Error(`${at} must be a public HTTPS /ea URL without credentials, query, or fragment.`);

        if (!url.hostname.includes(".") || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local") || /^[0-9.]+$/.test(url.hostname) || url.hostname.includes(":"))
            throw new Error(`${at} must use a public DNS hostname, not a local name or IP literal.`);

        return value;
    }
    function secret(value, at) {
        if (typeof value !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(value))
            throw new Error(`${at} must be a random base64url token of at least 32 characters.`);

        return value;
    }
    function origin(value, at) {
        generation.string(value, at);
        const url = new URL(value);
        if (url.protocol !== "https:" || url.origin !== value || url.username || url.password)
            throw new Error(`${at} must be an exact HTTPS origin.`);

        return value;
    }
    function launch(search) {
        const query = new URLSearchParams(search);
        if (!query.has("emberDirect") && !query.has("emberTicket"))
            return null;

        if (query.has("emberHosting") || query.getAll("emberDirect").length !== 1 || query.getAll("emberTicket").length !== 1)
            throw new Error("Use exactly one emberDirect and emberTicket, without emberHosting.");

        return {
            baseUrl: endpoint(query.get("emberDirect"), "emberDirect"),
            ticket: secret(query.get("emberTicket"), "emberTicket")
        };
    }
    function manifest(value) {
        generation.exact(value, ["version", "audience", "text", "image", "pollIntervalMs"], "connection");
        if (value.version !== 1)
            throw new Error("connection.version must be 1.");

        origin(value.audience, "connection.audience");
        if (!Number.isInteger(value.pollIntervalMs) || value.pollIntervalMs < 250)
            throw new Error("connection.pollIntervalMs must be an integer of at least 250 milliseconds.");

        for (const role of ["text", "image"]) {
            const lane = value[role];
            generation.exact(lane, ["baseUrl", "token", "model"], `connection.${role}`);
            endpoint(lane.baseUrl, `connection.${role}.baseUrl`);
            secret(lane.token, `connection.${role}.token`);
            generation.string(lane.model, `connection.${role}.model`);
        }

        return value;
    }
    function jobId(value) {
        if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))
            throw new Error("job.id must be a UUID v4.");

        return value;
    }
    function submit(value) {
        generation.exact(value, ["id", "role", "input"], "job");
        jobId(value.id);
        generation.request(value.role, value.input);
        if (value.role === "image" && value.input.seed === -1)
            throw new Error("job.input.seed must be an explicit nonnegative seed for direct workers.");

        return value;
    }
    function job(role, value) {
        generation.exact(value, ["id", "status", "result", "error"], "job");
        jobId(value.id);
        if (!["queued", "running", "completed", "failed", "cancelled"].includes(value.status))
            throw new Error("job.status is unknown.");

        if (value.status === "completed")
            generation.response(role, value.result);
        else if (value.result !== null)
            throw new Error("job.result must be null until completion.");

        if (value.status === "failed")
            generation.string(value.error, "job.error");
        else if (value.error !== null)
            throw new Error("job.error must be null unless failed.");

        return value;
    }
    const api = {endpoint, secret, origin, launch, manifest, jobId, submit, job};
    if (typeof module === "object" && module.exports)
        module.exports = api;
    else
        root.EmberDirectHostingContract = api;
})(globalThis);