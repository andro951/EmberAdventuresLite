        function appendOllamaSettings(parent) {
            const section = document.createElement("section");
            section.dataset.ollamaSettings = "true";
            const heading = document.createElement("h3");
            heading.textContent = "Text Model";
            section.append(heading);
            const inputs = {};
            const field = (key, title, choices = null) => {
                const label = document.createElement("label");
                label.textContent = title;
                const control = document.createElement(choices ? "select" : "input");
                control.id = `ollama-${key}`;
                if (choices) {
                    for (const [value, text] of choices) {
                        const option = document.createElement("option");
                        option.value = value;
                        option.textContent = text;
                        control.append(option);
                    }
                }
                control.value = app.settings.ollama[key] ?? "";
                label.append(control);
                section.append(label);
                inputs[key] = control;
                return control;
            };
            field("provider", "Text provider", [["perchance", "Perchance"], ["ollama", "Ollama"]]);
            field("connection", "Ollama connection", [["local", "This computer"], ["tailscale", "Another computer through Tailscale"]]);
            field("url", "Host URL");
            field("model", "Installed model", [[app.settings.ollama.model,
                app.settings.ollama.model?.startsWith("ea-local-") ? "Saved GGUF model (refresh to show filename)" : app.settings.ollama.model || "Click to find installed models"]]);
            let modelsLoaded = false;
            let discovering = false;
            const key = {value: app.ollamaAccessKey || ""};
            const reasoningRow = document.createElement("label");
            reasoningRow.className = "check-row";
            reasoningRow.style.display = "flex";
            reasoningRow.style.alignItems = "center";
            reasoningRow.style.gap = "8px";
            reasoningRow.title = "Reasoning lets supported models spend extra time working through a response before answering. It can improve complex decisions, but responses can take much longer. Leave it off for faster gameplay. This requests the model's reasoning mode; support varies by model.";
            const reasoning = document.createElement("input");
            reasoning.type = "checkbox";
            reasoning.id = "ollama-reasoning";
            reasoning.checked = app.settings.ollama.reasoning === true;
            reasoning.style.width = "auto";
            reasoning.style.flex = "0 0 auto";
            reasoning.title = reasoningRow.title;
            reasoningRow.append(reasoning, document.createTextNode("Enable Model Reasoning"));
            section.append(reasoningRow);
            inputs.reasoning = reasoning;
            const hints = {
                temperature: "Temperature (0–2)", seed: "Seed (blank for random)", top_p: "Top-p (0–1)",
                top_k: "Top-k (0 disables)", repeat_penalty: "Repetition penalty (1 disables)",
                num_predict: "Maximum response tokens"
            };
            for (const [name, title] of Object.entries(hints)) {
                const input = field(name, title);
                input.placeholder = "Model default";
                input.inputMode = "decimal";
            }
            const info = document.createElement("p");
            info.textContent = "EmberAdventures sizes the model's working memory for the story automatically. Blank tuning fields use model defaults. A fixed seed is repeatable only with the same model, prompt, and settings. Both connection types let you select any model installed on the host. Run the supplied Ollama Host there first.";
            const status = document.createElement("p");
            status.setAttribute("role", "status");
            const candidate = () => Object.fromEntries(Object.keys(globalThis.EmberOllama.defaults).map(name =>
                [name, name === "num_ctx" ? app.settings.ollama.num_ctx : inputs[name].type === "checkbox" ? inputs[name].checked : inputs[name].value]));
            const updateVisibility = () => {
                for (const [name, input] of Object.entries(inputs)) {
                    if (name !== "provider" && name !== "model")
                        input.parentElement.hidden = inputs.provider.value !== "ollama";
                }
                inputs.model.parentElement.hidden = inputs.provider.value !== "ollama";
            };
            inputs.provider.onchange = () => {
                if (inputs.provider.value === "perchance" && inputs.connection.value === "tailscale" && !inputs.url.value) {
                    inputs.connection.value = "local";
                    inputs.url.value = "https://localhost:51821";
                }
                updateVisibility();
            };
            inputs.connection.onchange = () => {
                key.value = "";
                app.ollamaAccessKey = "";
                modelsLoaded = false;
                inputs.url.value = inputs.connection.value === "local" ? "https://localhost:51821" : "";
                inputs.url.placeholder = inputs.connection.value === "tailscale" ? "https://your-host.your-tailnet.ts.net" : "";
                status.textContent = inputs.connection.value === "tailscale"
                    ? "Enter the private HTTPS .ts.net URL shown on the host computer."
                    : "Connect to this computer to refresh its models.";
                updateVisibility();
                if (inputs.connection.value === "tailscale") findRemoteHost();
            };
            inputs.url.addEventListener("input", () => { key.value = ""; app.ollamaAccessKey = ""; modelsLoaded = false; });
            const persistSettings = () => {
                let validated = false;
                try {
                    const config = globalThis.EmberOllama.validate(candidate());
                    validated = true;
                    const changed = JSON.stringify(app.settings.ollama) !== JSON.stringify(config);
                    app.settings.ollama = config;
                    app.settings.textProvider = config.provider;
                    app.ollamaAccessKey = key.value;
                    if (changed)
                        saveSettingsNow("text provider settings changed");
                    if (changed || status.textContent.startsWith("Not saved:")) {
                        status.textContent = config.provider === "ollama" && !config.model ? "Ollama selected. Connect and choose a model to play." : "Text settings saved automatically.";
                    }
                    return true;
                }
                catch (error) {
                    if (validated) log("Text settings failed", error.message, {type: "system", level: "error"});
                    status.textContent = inputs.connection.value === "tailscale" && !inputs.url.value
                        ? (discovering ? "Searching Tailscale for an EmberAdventures Host..." : "Find a Tailscale host or enter its private HTTPS URL.")
                        : `Not saved: ${error.message}`;
                    return false;
                }
            };
            const connect = document.createElement("button");
            connect.type = "button";
            connect.textContent = "Refresh Models / Connect";
            connect.onclick = async () => {
                if (connect.disabled) return;
                connect.disabled = true;
                status.textContent = "Connecting…";
                try {
                    const config = candidate();
                    if (!key.value) {
                        status.textContent = "Approve the connection on the host computer. If a connection window opens, keep it open while playing.";
                        const credential = await globalThis.EmberOllamaClient.pair(config);
                        if (!section.isConnected || JSON.stringify(candidate()) !== JSON.stringify(config)) return;
                        key.value = credential;
                    }
                    let result;
                    try { result = await globalThis.EmberOllamaClient.status(config, key.value); }
                    catch (error) {
                        if (error.status !== 401) throw error;
                        key.value = "";
                        app.ollamaAccessKey = "";
                        status.textContent = "The host restarted. Approve this connection on the host computer.";
                        const credential = await globalThis.EmberOllamaClient.pair(config);
                        if (!section.isConnected || JSON.stringify(candidate()) !== JSON.stringify(config)) return;
                        key.value = credential;
                        result = await globalThis.EmberOllamaClient.status(config, key.value);
                    }
                    if (!section.isConnected || JSON.stringify(candidate()) !== JSON.stringify(config))
                        return;
                    app.ollamaAccessKey = key.value;
                    const selected = inputs.model.value;
                    inputs.model.replaceChildren();
                    const placeholder = document.createElement("option");
                    placeholder.value = "";
                    placeholder.textContent = result.models.length || result.availableFiles.length ? "Choose a model to load" : "No Ollama models or GGUF files found in the selected folder";
                    inputs.model.append(placeholder);
                    for (const name of result.models) {
                        const option = document.createElement("option");
                        option.value = name;
                        option.textContent = result.modelLabels[name] || name;
                        inputs.model.append(option);
                    }
                    for (const file of result.availableFiles) {
                        const option = document.createElement("option");
                        option.value = file.name;
                        option.textContent = `${file.label} (import on first use)`;
                        inputs.model.append(option);
                    }
                    if (result.models.includes(selected) || result.availableFiles.some(file => file.name === selected))
                        inputs.model.value = selected;
                    modelsLoaded = true;
                    status.textContent = `Connected. ${result.models.length} installed models; ${result.availableFiles.length} GGUF files available to import. Loaded now: ${result.running.map(model => result.modelLabels[model.name] || model.name).join(", ") || "none"}. Select a model to load and use it. Changes save automatically.`;
                }
                catch (error) {
                    log("Ollama connection failed", error.message, {type: "system", level: "error"});
                    status.textContent = `${error.message} Check that the host is running and that the browser permits local network access. For Tailscale, connect both devices to the same tailnet.`;
                }
                finally {
                    connect.disabled = false;
                }
            };
            const discoverModels = event => {
                if (modelsLoaded) return;
                if (event.type === "keydown" && !["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return;
                event.preventDefault();
                connect.click();
            };
            inputs.model.addEventListener("pointerdown", discoverModels);
            inputs.model.addEventListener("keydown", discoverModels);
            inputs.model.parentElement.after(connect, status);
            const findHost = document.createElement("button");
            findHost.type = "button";
            findHost.textContent = "Find Tailscale Host";
            const installerLink = document.createElement("button");
            installerLink.type = "button";
            installerLink.textContent = "Download Windows player connector (one time)";
            installerLink.onclick = () => globalThis.EmberOllamaPlayerConnectorDownload.download();
            const hostChoice = document.createElement("select");
            hostChoice.setAttribute("aria-label", "Discovered Tailscale hosts");
            hostChoice.hidden = true;
            const chooseHost = (url, popup) => {
                inputs.url.value = url;
                inputs.url.dispatchEvent(new Event("input", {bubbles: true}));
                if (!persistSettings()) return;
                globalThis.EmberOllamaWindowTransport?.adopt?.(url, popup);
                connect.click();
            };
            const findRemoteHost = () => {
                if (discovering || inputs.connection.value !== "tailscale") return;
                let discovery;
                try { discovery = globalThis.EmberOllamaPlayerDiscovery.find(); }
                catch (error) { status.textContent = error.message; return; }
                discovering = true;
                status.textContent = "Searching Tailscale for an EmberAdventures Host...";
                discovery.promise.then(hosts => {
                    discovering = false;
                    if (!section.isConnected || inputs.connection.value !== "tailscale") { discovery.popup.close(); return; }
                    if (!hosts.length) { status.textContent = "No running EmberAdventures Host was found on this tailnet."; return; }
                    if (hosts.length === 1) { chooseHost(hosts[0].url, discovery.popup); return; }
                    hostChoice.replaceChildren();
                    const placeholder = document.createElement("option");
                    placeholder.value = "";
                    placeholder.textContent = "Choose an EmberAdventures Host";
                    hostChoice.append(placeholder);
                    for (const host of hosts) {
                        const option = document.createElement("option");
                        option.value = host.url;
                        option.textContent = host.name;
                        hostChoice.append(option);
                    }
                    hostChoice.hidden = false;
                    hostChoice.onchange = () => { if (hostChoice.value) chooseHost(hostChoice.value, discovery.popup); };
                    status.textContent = `${hosts.length} hosts found. Choose one to connect.`;
                }).catch(error => { discovering = false; status.textContent = error.message; });
            };
            findHost.onclick = findRemoteHost;
            inputs.url.parentElement.after(findHost, installerLink, hostChoice);
            const updateRemoteControls = () => {
                const visible = inputs.provider.value === "ollama" && inputs.connection.value === "tailscale";
                findHost.hidden = !visible;
                installerLink.hidden = !visible;
                hostChoice.hidden = !visible || !hostChoice.options.length;
            };
            inputs.connection.addEventListener("change", updateRemoteControls);
            inputs.provider.addEventListener("change", updateRemoteControls);
            const progress = document.createElement("progress");
            progress.hidden = true;
            progress.setAttribute("aria-label", "Model loading progress");
            const load = document.createElement("button");
            load.type = "button";
            load.textContent = "Load Selected Model";
            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancel Loading";
            cancel.hidden = true;
            let loading = null;
            const loadSelected = async () => {
                loading?.abort();
                const controller = new AbortController();
                loading = controller;
                const started = performance.now();
                progress.hidden = false;
                progress.removeAttribute("value");
                cancel.hidden = false;
                load.disabled = true;
                status.textContent = "Preparing model. A GGUF file may take a while to import on first use…";
                const timer = setInterval(() => {
                    status.textContent = `Preparing and loading model… ${Math.floor((performance.now() - started) / 1000)} seconds elapsed. Ollama does not report a loading percentage or remaining time.`;
                }, 500);
                const observer = new MutationObserver(() => {
                    if (!section.isConnected)
                        controller.abort();
                });
                observer.observe(document.body, {childList: true, subtree: true});
                try {
                    const config = candidate();
                    if (!config.model)
                        throw new Error("Refresh models and choose one first.");
                    await globalThis.EmberOllamaClient.load(config, key.value, controller.signal);
                    if (loading !== controller)
                        return;
                    progress.max = 1;
                    progress.value = 1;
                    status.textContent = `${config.model} is ready (${((performance.now() - started) / 1000).toFixed(1)} seconds). Selected automatically for gameplay. Models stay loaded for 30 minutes after use, subject to Ollama memory management.`;
                }
                catch (error) {
                    if (loading !== controller)
                        return;
                    progress.hidden = true;
                    status.textContent = controller.signal.aborted ? "Model loading cancelled." : error.message;
                    if (!controller.signal.aborted)
                        log("Ollama model load failed", error.message, {type: "system", level: "error"});
                }
                finally {
                    clearInterval(timer);
                    observer.disconnect();
                    if (loading === controller) {
                        loading = null;
                        cancel.hidden = true;
                        load.disabled = false;
                    }
                }
            };
            inputs.model.onchange = () => { if (persistSettings()) loadSelected(); };
            load.onclick = loadSelected;
            cancel.onclick = () => loading?.abort();
            for (const [name, input] of Object.entries(inputs)) {
                if (name !== "model")
                    input.addEventListener("input", () => { loading?.abort(); progress.hidden = true; persistSettings(); });
                if (name !== "model")
                    input.addEventListener("change", () => { persistSettings(); });
            }
            section.append(info, load, cancel, progress);
            //This section validates and saves its own changes; the generic profile autosaver must not commit invalid drafts.
            section.addEventListener("change", event => event.stopPropagation());
            section.addEventListener("input", event => event.stopPropagation());
            parent.prepend(section);
            updateVisibility();
            updateRemoteControls();
        }
