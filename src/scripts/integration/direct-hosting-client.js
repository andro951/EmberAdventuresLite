(function(root) {
    "use strict";
    const contract = typeof module === "object" && module.exports ? require("../../contracts/direct-hosting-contract.js") : root.EmberDirectHostingContract;
    function pause(ms, signal) {
        return new Promise((resolve, reject) => {
            signal?.throwIfAborted();
            const abort = () => {
                clearTimeout(timer);
                reject(signal.reason);
            };
            const timer = setTimeout(() => {
                signal?.removeEventListener("abort", abort);
                resolve();
            }, ms);
            signal?.addEventListener("abort", abort, {once: true});
        });
    }
    function createSession(launch, options = {}) {
        const generation = typeof module === "object" && module.exports ? require("../../contracts/generation-contract.js") : root.EmberGenerationContract;
        generation.exact(launch, ["baseUrl", "ticket"], "launch");
        contract.endpoint(launch.baseUrl, "launch.baseUrl");
        contract.secret(launch.ticket, "launch.ticket");
        const baseUrl = launch.baseUrl;
        const fetcher = options.fetch || root.fetch.bind(root);
        const sleep = options.sleep || pause;
        const uuid = options.uuid || (() => root.crypto.randomUUID());
        let connectionPromise = null;
        let ticket = launch.ticket;
        async function json(url, body, token, signal) {
            const response = await fetcher(url, {
                method: body === undefined ? "GET" : "POST", mode: "cors", credentials: "omit",
                redirect: "error", referrerPolicy: "no-referrer", cache: "no-store", signal,
                headers: {...(body === undefined ? {} : {"Content-Type": "application/json"}), ...(token ? {Authorization: `Bearer ${token}`} : {})},
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            if (!response.ok)
                throw new Error(`Direct hosting returned HTTP ${response.status}.`);

            return response.json();
        }
        function connection() {
            //One redemption per page, shared by concurrent text and image requests. Never retry a spent ticket.
            if (!connectionPromise) {
                const body = {ticket};
                ticket = null;
                connectionPromise = json(`${baseUrl}/claim`, body).catch(() => {
                    throw new Error("Direct hosting connection could not be claimed. Check the worker's HTTPS/CORS configuration and reopen EA from the launcher for a new ticket. No inference request was sent.");
                }).then(value => {
                    const result = contract.manifest(value);
                    if (result.audience !== options.audience)
                        throw new Error("The direct hosting connection belongs to a different game origin.");

                    return result;
                });
            }

            return connectionPromise;
        }
        function connectedForSignal(signal) {
            if (!signal)
                return connection();

            signal.throwIfAborted();
            //Cancelling one caller must not consume a second ticket or abort setup shared with other callers.
            return new Promise((resolve, reject) => {
                const abort = () => reject(signal.reason);
                signal.addEventListener("abort", abort, {once: true});
                void connection().then(value => {
                    signal.removeEventListener("abort", abort);
                    resolve(value);
                }, error => {
                    signal.removeEventListener("abort", abort);
                    reject(error);
                });
            });
        }
        async function generate(role, input, settings = {}) {
            const submitted = contract.submit({id: uuid(), role, input});
            settings.signal?.throwIfAborted();
            const connected = await connectedForSignal(settings.signal);
            settings.signal?.throwIfAborted();
            const lane = connected[role];
            const url = `${lane.baseUrl}/jobs/${submitted.id}`;
            let dispatched = false;
            let lastStatus = "";
            const reportStatus = value => {
                if (lastStatus === value)
                    return false;

                lastStatus = value;
                settings.onStatus?.({id: submitted.id, status: value, endpoint: lane.baseUrl, model: lane.model});
                return true;
            };
            try {
                dispatched = true;
                let status = contract.job(role, await json(`${lane.baseUrl}/jobs`, submitted, lane.token, settings.signal));
                let freshStatus = true;
                while (true) {
                    if (status.id !== submitted.id)
                        throw new Error("Direct worker returned a different job ID.");

                    if (freshStatus) {
                        reportStatus(status.status);
                        freshStatus = false;
                    }
                    if (status.status === "completed")
                        return status.result;

                    if (status.status === "failed")
                        throw new Error(`Direct ${role} job ${status.id} failed: ${status.error}`);

                    if (status.status === "cancelled")
                        throw new DOMException(`Direct ${role} job ${status.id} was cancelled.`, "AbortError");

                    await sleep(connected.pollIntervalMs, settings.signal);
                    let next;
                    try { next = await json(url, undefined, lane.token, settings.signal); }
                    catch (error) {
                        if (settings.signal?.aborted)
                            throw error;

                        //Status reads cannot create paid jobs. A lost status response does not cancel or resubmit one.
                        if (reportStatus("status-unavailable"))
                            options.onDiagnostic?.({role, id: submitted.id, phase: "status", message: "Cannot read worker status; the same job remains pending."});
                        continue;
                    }

                    status = contract.job(role, next);
                    freshStatus = true;
                }
            }
            catch (error) {
                if (settings.signal?.aborted && dispatched) {
                    //Caller cancellation is explicit. A socket close or a slow poll never cancels model work.
                    void json(`${url}/cancel`, {}, lane.token).catch(() => options.onDiagnostic?.({
                        role, id: submitted.id, phase: "cancel", message: "Worker cancellation could not be confirmed."
                    }));
                    throw error;
                }

                //Never include response bodies, tickets, tokens, or native errors containing secret URLs in diagnostics.
                if (error.name === "AbortError")
                    throw error;

                let detail = error.name === "TypeError" ? "Check worker HTTPS/CORS and connectivity." : error.message;
                for (const token of [connected.text.token, connected.image.token]) {
                    detail = detail.replaceAll(token, "[redacted]");
                }

                const message = `Direct ${role} job ${submitted.id} could not complete. ${detail} No generation retry was sent; inspect this job before submitting again.`;
                options.onDiagnostic?.({role, id: submitted.id, phase: "generation", message});
                throw new Error(message);
            }
        }
        return {connection, generate};
    }
    const api = {createSession};
    if (typeof module === "object" && module.exports)
        module.exports = api;
    else
        root.EmberDirectHostingClient = api;
})(globalThis);