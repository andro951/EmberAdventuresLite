(function(root) {
    function create(environment) {
        const windows = new Map();
        const reserved = new Map();
        function connect(url) {
            const origin = new URL(url).origin;
            const existing = windows.get(origin);
            if (existing && !existing.window.closed) return existing;
            const nonce = environment.crypto.randomUUID();
            const entry = {window: null, pending: new Set(), ready: null};
            let resolveReady;
            let rejectReady;
            entry.ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
            const listener = event => {
                if (event.source !== entry.window || event.origin !== origin || event.data?.type !== "ea-host-ready" || event.data.nonce !== nonce) return;
                environment.removeEventListener("message", listener);
                resolveReady();
            };
            environment.addEventListener("message", listener);
            const parameters = new URLSearchParams({nonce, origin: environment.location.origin});
            const waiting = reserved.get(origin);
            reserved.delete(origin);
            if (waiting && !waiting.closed) {
                entry.window = waiting;
                waiting.location.href = `${origin}/connection#${parameters}`;
            }
            else
                entry.window = environment.open(`${origin}/connection#${parameters}`, "_blank", "popup,width=480,height=300");
            if (!entry.window) {
                environment.removeEventListener("message", listener);
                throw new Error("Allow the EmberAdventures connection popup, then click Connect again.");
            }
            entry.nonce = nonce;
            windows.set(origin, entry);
            const monitor = environment.setInterval(() => {
                if (!entry.window.closed) return;
                environment.clearInterval(monitor);
                environment.removeEventListener("message", listener);
                windows.delete(origin);
                const error = new Error("The host connection window was closed. Click Connect to reopen it, and keep it open while playing.");
                rejectReady(error);
                for (const fail of [...entry.pending]) fail(error);
            }, 400);
            return entry;
        }
        function request(config, path, init = {}) {
            //Open synchronously during the user's Connect/dropdown click so popup permission is preserved.
            const entry = connect(config.url);
            return new Promise((resolve, reject) => {
                const channel = new environment.MessageChannel();
                let stream = null;
                let complete = false;
                const cleanup = () => {
                    complete = true;
                    entry.pending.delete(fail);
                    init.signal?.removeEventListener("abort", abort);
                    channel.port1.close();
                };
                const fail = error => {
                    if (complete) return;
                    channel.port1.postMessage({type: "cancel"});
                    if (stream) stream.error(error);
                    else reject(error);
                    cleanup();
                };
                const abort = () => fail(new DOMException("Request cancelled.", "AbortError"));
                entry.pending.add(fail);
                init.signal?.addEventListener("abort", abort, {once: true});
                if (init.signal?.aborted) { abort(); return; }
                channel.port1.onmessage = event => {
                    if (complete) return;
                    const message = event.data;
                    if (message.type === "headers" && !stream) {
                        const body = new environment.ReadableStream({start(controller) { stream = controller; }, cancel() { abort(); }});
                        resolve(new environment.Response(body, {status: message.status, headers: {"Content-Type": message.contentType}}));
                    }
                    else if (message.type === "chunk" && stream) stream.enqueue(new Uint8Array(message.bytes));
                    else if (message.type === "done" && stream) { stream.close(); cleanup(); }
                    else if (message.type === "error") fail(new Error(message.message));
                    else fail(new Error("Invalid response from the host connection window."));
                };
                entry.ready.then(() => {
                    if (complete) return;
                    entry.window.postMessage({type: "ea-host-request", nonce: entry.nonce, path, method: init.method || "GET", headers: init.headers || {}, body: init.body}, new URL(config.url).origin, [channel.port2]);
                }).catch(fail);
            });
        }
        return {
            request,
            adopt(url, popup) { reserved.set(new URL(url).origin, popup); },
            hasWindow(url) { const origin = new URL(url).origin; return reserved.has(origin) || (windows.has(origin) && !windows.get(origin).window.closed); }
        };
    }
    if (typeof module !== "undefined" && module.exports) module.exports = {create};
    else root.EmberOllamaWindowTransport = create(root);
})(globalThis);
