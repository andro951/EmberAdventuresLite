(function(root) {
    function create(environment) {
        function find() {
            const nonce = environment.crypto.randomUUID();
            const popup = environment.open("about:blank", "_blank", "popup,width=500,height=330");
            if (!popup) throw new Error("Allow the EmberAdventures discovery popup, then try again.");
            const paragraph = popup.document.createElement("p");
            paragraph.textContent = "Searching your Tailscale devices. If this is your first time, download the connector, unzip it, and run Install Player Connector.bat. Then click Open the installed player connector below.";
            const installer = popup.document.createElement("button");
            installer.textContent = "Download Windows connector ZIP";
            installer.onclick = () => environment.EmberOllamaPlayerConnectorDownload.download();
            const frame = popup.document.createElement("iframe");
            frame.hidden = true;
            frame.setAttribute("aria-hidden", "true");
            popup.document.body.append(paragraph, installer, frame);
            let timer;
            const promise = new Promise((resolve, reject) => {
                const cleanup = () => {
                    popup.removeEventListener("message", listener);
                    environment.clearInterval(timer);
                };
                const listener = event => {
                    if (event.source !== frame.contentWindow || event.origin !== "http://127.0.0.1:51823" ||
                        event.data?.type !== "ea-player-hosts" || event.data.nonce !== nonce) return;
                    cleanup();
                    if (event.data.error) reject(new Error(event.data.error));
                    else if (!Array.isArray(event.data.hosts) || !event.data.hosts.every(host =>
                        typeof host.name === "string" && /^https:\/\/[a-z0-9.-]+\.ts\.net$/i.test(host.url)))
                        reject(new Error("The player connector returned an invalid host list."));
                    else resolve(event.data.hosts);
                };
                popup.addEventListener("message", listener);
                const visit = () => {
                    if (popup.closed) { cleanup(); reject(new Error("Host discovery was closed.")); return; }
                    frame.src = `http://127.0.0.1:51823/discover/${nonce}`;
                };
                timer = environment.setInterval(visit, 1500);
                const link = popup.document.createElement("a");
                link.href = `emberadventures-player://discover/${nonce}`;
                link.textContent = "Open the installed player connector";
                popup.document.body.append(link);
                link.click();
            });
            return {popup, promise};
        }
        return {find};
    }
    if (typeof module !== "undefined" && module.exports) module.exports = {create};
    else root.EmberOllamaPlayerDiscovery = create(root);
})(globalThis);
