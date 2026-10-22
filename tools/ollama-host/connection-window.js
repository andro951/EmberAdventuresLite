(function(root) {
    function attach(environment) {
        const parameters = new URLSearchParams(environment.location.hash.slice(1));
        const nonce = parameters.get("nonce");
        const origin = parameters.get("origin");
        const opener = environment.opener;
        const status = environment.document.createElement("p");
        const heading = environment.document.createElement("h2");
        heading.textContent = "EmberAdventures connection";
        status.textContent = "Keep this window open while playing. You can return to the game after approving the connection on the host computer.";
        environment.document.body.append(heading, status);
        if (!opener || !nonce || !origin) {
            status.textContent = "Open this connection window using Connect in EmberAdventures settings.";
            return;
        }
        const routes = new Map([["/api/pair", "POST"], ["/api/status", "GET"], ["/api/model/load", "POST"], ["/api/text/generate", "POST"]]);
        const active = new Set();
        environment.addEventListener("message", async event => {
            if (event.source !== opener || event.origin !== origin || event.data?.type !== "ea-host-request" || event.data.nonce !== nonce || event.ports.length !== 1) return;
            const port = event.ports[0];
            const request = event.data;
            const controller = new AbortController();
            active.add(controller);
            port.onmessage = message => { if (message.data?.type === "cancel") controller.abort(); };
            try {
                if (routes.get(request.path) !== request.method || !request.headers || Object.keys(request.headers).some(name => !["Authorization", "Content-Type"].includes(name)))
                    throw new Error("Unsupported connection request.");
                const response = await environment.fetch(request.path, {method: request.method, headers: request.headers, body: request.body, signal: controller.signal, redirect: "error"});
                port.postMessage({type: "headers", status: response.status, contentType: response.headers.get("content-type") || "application/json"});
                const reader = response.body.getReader();
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    port.postMessage({type: "chunk", bytes: value}, [value.buffer]);
                }
                port.postMessage({type: "done"});
                status.textContent = response.ok ? "Connected. Keep this window open; model controls are in EmberAdventures." : "The host returned an error. See EmberAdventures settings for details.";
            }
            catch (error) {
                port.postMessage({type: "error", message: error.message});
                status.textContent = `Connection error: ${error.message}`;
            }
            finally { active.delete(controller); port.close(); }
        });
        environment.addEventListener("pagehide", () => { for (const controller of active) controller.abort(); });
        const monitor = environment.setInterval(() => {
            if (!opener.closed) return;
            for (const controller of active) controller.abort();
            environment.clearInterval(monitor);
            status.textContent = "The game window closed. You can close this connection window.";
        }, 400);
        opener.postMessage({type: "ea-host-ready", nonce}, origin === "null" ? "*" : origin);
    }
    if (typeof module !== "undefined" && module.exports) module.exports = {attach};
    else attach(root);
})(globalThis);
