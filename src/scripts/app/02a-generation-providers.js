        //#region Hosted generation

        const GENERATION_PREFERENCES_KEY = "emberadventureslite-generation-v1";
        let hostedImageRequestTail = Promise.resolve();
        let directHostingLaunch = null;
        let directHostingSession = null;
        function hostingLaunchPreferences() {
            if (directHostingLaunch)
                return directHostingLaunch;

            const direct = EmberDirectHostingContract.launch(window.location.search);
            if (direct) {
                directHostingLaunch = {text: "direct-provider", image: "direct-provider", baseUrl: direct.baseUrl};
                directHostingSession = EmberDirectHostingClient.createSession(direct, {
                    audience: window.location.origin,
                    onDiagnostic: detail => log("Direct hosting connection issue", detail.message, {type: "system", level: "error", details: detail})
                });
                if (window.history?.replaceState && window.location.href) {
                    const clean = new URL(window.location.href);
                    clean.searchParams.delete("emberTicket");
                    //Keep the public direct-mode marker so a frame reload cannot silently fall back to Perchance.
                    try { window.history.replaceState(null, "", clean.href); }
                    catch (error) { log("Hosting launch URL cleanup failed", "The browser refused to remove the one-use launch ticket from this frame's address. Connection credentials are still kept in page memory only.", {type: "system", level: "error"}); }
                }

                void directHostingSession.connection().catch(error => log("Direct hosting setup failed", error.message, {type: "system", level: "error"}));
                return directHostingLaunch;
            }

            return EmberGenerationContract.launchPreferences(window.location.search);
        }
        function currentDirectHostingSession() {
            hostingLaunchPreferences();
            if (!directHostingSession)
                throw new Error("No direct hosting session was supplied by the launcher. Reopen EA from the running host setup.");

            return directHostingSession;
        }
        function savedGenerationPreferences() {
            const stored = localStorage.getItem(GENERATION_PREFERENCES_KEY);
            return EmberGenerationContract.preferences(stored === null
                ? {text: "game", image: "perchance", proxyUrl: "http://127.0.0.1:51840"}
                : JSON.parse(stored));
        }
        function generationPreferences() {
            return hostingLaunchPreferences() || savedGenerationPreferences();
        }
        function appendGenerationSettings(parent) {
            const launch = hostingLaunchPreferences();
            const settings = savedGenerationPreferences();
            const section = document.createElement("section");
            section.dataset.generationSettings = "true";
            const heading = document.createElement("h3");
            heading.textContent = "RunPod and hosted models";
            const description = document.createElement("p");
            description.textContent = launch?.text === "direct-provider"
                ? "This page connects directly over HTTPS to the running text and image workers. Connection credentials stay in page memory. Saved preferences below are unchanged."
                : launch
                ? `This launch uses the running text and image models at ${launch.proxyUrl} for this page only. Saved preferences below are unchanged.`
                : "Use models already running through the local hosting bridge. API keys and model setup stay in the host. Changes save automatically.";
            const status = document.createElement("p");
            status.setAttribute("role", "status");
            section.append(heading, description);
            if (launch?.text === "direct-provider") {
                status.textContent = "Connecting to hosted models…";
                section.append(status);
                parent.append(section);
                void currentDirectHostingSession().connection().then(connection => {
                    status.textContent = `Hosted session: text ${connection.text.model}; images ${connection.image.model}.`;
                }).catch(error => { status.textContent = error.message; });
                return;
            }

            const controls = {};
            const addField = (key, labelText, choices = null) => {
                const label = document.createElement("label");
                label.textContent = labelText;
                const control = document.createElement(choices ? "select" : "input");
                control.id = `generation-${key}`;
                if (choices) {
                    for (const [value, text] of choices) {
                        const option = document.createElement("option");
                        option.value = value;
                        option.textContent = text;
                        control.append(option);
                    }
                }

                control.value = settings[key];
                control.disabled = !!launch;
                label.append(control);
                section.append(label);
                controls[key] = control;
            };
            addField("text", "Text generation", [["game", "Use Text Model settings below"], ["perchance", "Perchance"], ["hosting-proxy", "RunPod / hosting bridge"]]);
            addField("image", "Image generation", [["perchance", "Perchance"], ["hosting-proxy", "RunPod / hosting bridge"]]);
            addField("proxyUrl", "Local hosting bridge URL");
            const dimensions = document.createElement("p");
            dimensions.textContent = "Hosted defaults: 832 × 1216 portrait and 1024 × 1024 square. Model selection, sampling, and availability are controlled by the running host.";
            section.append(dimensions, status);
            const save = () => {
                const value = {text: controls.text.value, image: controls.image.value, proxyUrl: controls.proxyUrl.value};
                let validationError = null;
                try { EmberGenerationContract.preferences(value); }
                catch (error) { validationError = error; }
                if (validationError) {
                    status.textContent = validationError.message;
                    log("Hosting settings failed", validationError.message, {type: "error", level: "error"});
                    return;
                }

                try { localStorage.setItem(GENERATION_PREFERENCES_KEY, JSON.stringify(value)); }
                catch (error) {
                    status.textContent = "Hosting preferences could not be saved.";
                    recordStorageFailure(GENERATION_PREFERENCES_KEY, error);
                    return;
                }

                status.textContent = "Saved. Queued requests keep their selected provider.";
            };
            for (const control of Object.values(controls)) {
                control.addEventListener("change", save);
            }

            parent.append(section);
        }
        async function hostingProxyConnectionError(role, origin, error, environment = globalThis) {
            const names = ["local-network-access", "loopback-network"];
            const policy = environment.document?.permissionsPolicy || environment.document?.featurePolicy;
            const supported = policy?.features?.() || [];
            const blocked = names.filter(name => supported.includes(name) && !policy.allowsFeature(name));
            const permissions = {};
            if (environment.navigator?.permissions?.query) {
                for (const name of names) {
                    try { permissions[name] = (await environment.navigator.permissions.query({name})).state; }
                    catch (queryError) {
                        //Browsers need not support either permission name; unknown is not denial.
                        permissions[name] = {unavailable: queryError.message};
                    }
                }
            }

            const denied = names.filter(name => permissions[name] === "denied");
            const guidance = blocked.length
                ? `The embedding page blocks ${blocked.join(", ")}. Perchance must delegate this permission to the game iframe; changing the model or bridge CORS headers cannot grant it.`
                : denied.length
                    ? `The browser reports denied local-network permission (${denied.join(", ")}). In the Perchance tab, open site permissions beside the address bar, allow Local network access, and reload. If already allowed, check the embedding iframe's permission policy.`
                    : "Check that the host is running and that the Perchance tab permits Local network access. A failed fetch alone does not distinguish browser permission, CORS, and connection failures.";
            const message = `Could not reach hosting bridge ${origin}. Browser error: ${error.name}: ${error.message}. ${guidance} The outcome may be uncertain; check the host before retrying.`;
            log("Hosting bridge connection failed", message, {type: "system", level: "error", details: {
                endpoint: `${origin}/api/generation/${role}`, phase: "fetch",
                frameOrigin: environment.window?.location?.origin || "unavailable",
                secureContext: environment.isSecureContext ?? null,
                embedded: environment.window ? environment.window.parent !== environment.window : null,
                browser: environment.navigator?.userAgent || "unavailable",
                blockedFeatures: blocked, permissions,
                browserError: {name: error.name, message: error.message, stack: error.stack || ""}
            }});
            return new Error(message, {cause: error});
        }
        async function hostingProxyRequest(role, payload, options = {}) {
            EmberGenerationContract.request(role, payload);
            const origin = EmberGenerationContract.proxyUrl(options.proxyUrl || generationPreferences().proxyUrl);
            const controller = new AbortController();
            const abort = () => controller.abort();
            options.signal?.addEventListener("abort", abort, {once: true});
            const checkCancellation = () => {
                if (options.signal?.aborted || options.isCancelled?.())
                    controller.abort();
            };
            checkCancellation();
            const cancellationTimer = options.isCancelled ? setInterval(checkCancellation, 150) : null;
            try {
                let response;
                try {
                    response = await fetch(`${origin}/api/generation/${role}`, {
                        method: "POST",
                        targetAddressSpace: "loopback",
                        signal: controller.signal,
                        headers: {"Content-Type": "application/json", "X-Ember-Generation": "1"},
                        body: JSON.stringify(payload),
                        redirect: "error"
                    });
                }
                catch (error) {
                    if (controller.signal.aborted)
                        throw error;

                    throw await hostingProxyConnectionError(role, origin, error);
                }

                let data;
                try { data = await response.json(); }
                catch (error) {
                    if (controller.signal.aborted)
                        throw error;

                    const message = `Hosting bridge returned HTTP ${response.status}, but its JSON response could not be read: ${error.name}: ${error.message}. The outcome may be uncertain; check the host before retrying.`;
                    log("Hosting bridge response failed", message, {type: "system", level: "error", details: {
                        endpoint: `${origin}/api/generation/${role}`, phase: "response-body", status: response.status,
                        browserError: {name: error.name, message: error.message, stack: error.stack || ""}
                    }});
                    throw new Error(message, {cause: error});
                }
                if (!response.ok)
                    throw new Error(typeof data?.error === "string" ? data.error : `Hosting bridge returned HTTP ${response.status}.`);

                return EmberGenerationContract.response(role, data);
            }
            finally {
                if (cancellationTimer !== null)
                    clearInterval(cancellationTimer);

                options.signal?.removeEventListener("abort", abort);
            }
        }
        async function runHostedText(instruction, opts, activeRequest, isCancelled, directSession = null) {
            const provider = directSession ? "direct-provider" : "hosting-proxy";
            opts.onPluginStart?.({label: opts.label || "text generation"});
            if (activeRequest)
                activeRequest.pluginStartedAt = performance.now();

            const controller = new AbortController();
            opts.abortProvider = () => controller.abort();
            try {
                const payload = {
                    instruction: String(instruction), startWith: opts.startWith || "", stopSequences: opts.stopSequences || []
                };
                const result = directSession
                    ? await directHostingRequest(directSession, "text", payload, {signal: controller.signal, isCancelled, activeRequest})
                    : await hostingProxyRequest("text", payload, {proxyUrl: activeRequest?.hostingProxyUrl, isCancelled, signal: controller.signal});
                if (isCancelled())
                    throw aiCancelledError(opts.messageId, opts.cancelReason || "cancelled");

                let text = normalizeAiTextOutput(result.text).trim();
                if (!text)
                    throw new Error("Hosting bridge returned an empty text response.");

                if (opts.startWith && !text.startsWith(opts.startWith.trim()))
                    text = opts.startWith + text;

                if (activeRequest) {
                    activeRequest.responseChars = text.length;
                    activeRequest.pluginAttempts = 1;
                }

                const label = opts.label || "text generation";
                if (app.settings?.devMode) {
                    rememberPromptEditorAiCall("text", {
                        label, promptType: label, prompt: String(instruction),
                        options: {startWith: opts.startWith || "", stopSequences: opts.stopSequences || []},
                        snapshot: activeRequest?.promptEditorSnapshot || promptEditorSnapshotForReplay({sourceLabel: label}),
                        response: text, provider, at: new Date().toISOString()
                    });
                }

                log("Hosted AI response", `Label: ${label}\nProvider: ${provider}\nEndpoint: ${activeRequest?.providerEndpoint || activeRequest?.hostingProxyUrl || (directSession ? directHostingLaunch.baseUrl : generationPreferences().proxyUrl)}\n${text}`, {type: activeRequest?.logType || "ai", level: "message"});
                opts.onStream?.(text, text, true);
                return text;
            }
            finally {
                delete opts.abortProvider;
            }
        }
        async function directHostingRequest(session, role, payload, options = {}) {
            const controller = new AbortController();
            const abort = () => controller.abort();
            const check = () => {
                if (options.signal?.aborted || options.isCancelled?.())
                    controller.abort();
            };
            options.signal?.addEventListener("abort", abort, {once: true});
            check();
            const timer = options.isCancelled ? setInterval(check, 150) : null;
            try {
                return await session.generate(role, payload, {signal: controller.signal, onStatus: status => {
                    if (options.activeRequest) {
                        options.activeRequest.providerEndpoint = status.endpoint;
                        options.activeRequest.providerJobId = status.id;
                        options.activeRequest.providerJobStatus = status.status;
                    }

                    log("Direct hosted job", `${role}: ${status.status}\nModel: ${status.model}\nJob: ${status.id}`, {type: role === "text" ? "ai" : "images", level: "message", details: status});
                }});
            }
            finally {
                if (timer !== null)
                    clearInterval(timer);

                options.signal?.removeEventListener("abort", abort);
            }
        }
        function generateHostedImageHtml(prompt, negativePrompt, seed, options = {}) {
            const selection = generationPreferences();
            const session = selection.image === "direct-provider" ? currentDirectHostingSession() : null;
            const proxyUrl = selection.proxyUrl;
            const [width, height] = EmberGenerationContract.hostedImageResolution(options.resolution).split("x").map(Number);
            const randomSeed = seed == null || seed === "random" || seed === -1 || seed === "-1";
            const chosenSeed = session && randomSeed ? crypto.getRandomValues(new Uint32Array(1))[0] : randomSeed ? -1 : Number(seed);
            const payload = EmberGenerationContract.request("image", {
                prompt: String(prompt), negativePrompt: String(negativePrompt || ""),
                seed: chosenSeed, width, height
            });
            const generate = async () => {
                const result = session
                    ? await directHostingRequest(session, "image", payload, options)
                    : await hostingProxyRequest("image", payload, {proxyUrl, signal: options.signal, isCancelled: options.isCancelled});
                const image = document.createElement("img");
                image.src = result.image;
                image.alt = "Generated image";
                return image.outerHTML;
            };
            //The bridge permits one image in flight; queue independent game requests without retrying failures.
            const pending = hostedImageRequestTail.then(generate);
            hostedImageRequestTail = pending.then(() => undefined, () => undefined);
            return pending.catch(error => {
                log("Hosted image generation failed", error.message, {type: "images", level: "error"});
                throw error;
            });
        }

        //#endregion Hosted generation
