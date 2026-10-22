  // Separate preference record leaves the existing strict game/settings schema intact.
  function generationPreferences() {
    if (app.generationPreferences) return app.generationPreferences;
    const launch = EmberGenerationContract.launchPreferences(window.location.search);
    if (launch) {
      // An explicit Hosting Setup link selects both roles for this page only.
      // The player's stored provider preferences and game data remain untouched.
      app.generationPreferences = launch;
      return launch;
    }
    const stored = localStorage.getItem("emberadventures-lite-generation-v1");
    const value = stored === null ? {text: "perchance", image: "perchance", proxyUrl: "http://127.0.0.1:51840"} : JSON.parse(stored);
    app.generationPreferences = EmberGenerationContract.preferences(value);
    return app.generationPreferences;
  }
  function generationSettingsHtml() {
    const settings = generationPreferences();
    const select = role => `<label>${role === "text" ? "Text" : "Image"} generation provider <select id="generation-${role}"><option value="perchance" ${settings[role] === "perchance" ? "selected" : ""}>Perchance</option><option value="hosting-proxy" ${settings[role] === "hosting-proxy" ? "selected" : ""}>Paid hosting via local proxy</option></select></label>`;
    return `<fieldset style="grid-column:1/-1;min-width:0"><legend>Generation hosting</legend><p class="hint">Select text and images independently. Configure models and hosting in the local proxy. Keep API keys out of this page. Paid requests require your own configured endpoint.</p>${select("text")}${select("image")}<label>Local hosting proxy origin <input id="generation-proxyUrl" value="${escapeHtml(settings.proxyUrl)}"></label><p class="hint">Hosted defaults: portrait 832×1216; profile/square 1024×1024. Perchance keeps its existing dimensions. Existing image style controls still apply prompt styles. The remote checkpoint is configured in the proxy. Remote text arrives as a complete response.</p><button type="button" id="generation-save">Save generation providers</button><p id="generation-status" role="status"></p></fieldset>`;
  }
  function bindGenerationSettings() {
    $("generation-save").onclick = () => {
      try {
        const value = EmberGenerationContract.preferences({text: $("generation-text").value, image: $("generation-image").value, proxyUrl: $("generation-proxyUrl").value});
        localStorage.setItem("emberadventures-lite-generation-v1", JSON.stringify(value));
        app.generationPreferences = value;
        $("generation-status").textContent = "Generation providers saved. Existing queued requests keep their selected provider.";
      } catch (error) {
        $("generation-status").textContent = error.message;
        log("Generation settings failed", error.message, {type: "error", level: "error"});
      }
    };
  }
  async function hostingProxyRequest(role, payload, options = {}) {
    EmberGenerationContract.request(role, payload);
    const controller = new AbortController();
    const cancel = () => { if (options.isCancelled?.()) controller.abort(); };
    cancel();
    const interval = options.isCancelled ? setInterval(cancel, 150) : null;
    try {
      const origin = EmberGenerationContract.proxyUrl(options.proxyUrl || generationPreferences().proxyUrl);
      const response = await fetch(`${origin}/api/generation/${role}`, {
        method: "POST", targetAddressSpace: "loopback", signal: controller.signal,
        headers: {"Content-Type": "application/json", "X-Ember-Generation": "1"},
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Hosting proxy returned HTTP ${response.status}.`);
      return EmberGenerationContract.response(role, data);
    } finally {
      if (interval !== null) clearInterval(interval);
    }
  }
  async function runHostedText(instruction, opts, activeRequest, isCancelled) {
    opts.onPluginStart?.({label: opts.label || "text generation"});
    if (activeRequest) activeRequest.pluginStartedAt = performance.now();
    const data = await hostingProxyRequest("text", {instruction: String(instruction), startWith: opts.startWith || "", stopSequences: opts.stopSequences || []}, {isCancelled, proxyUrl: activeRequest?.hostingProxyUrl});
    if (isCancelled()) throw aiCancelledError(opts.messageId, opts.cancelReason || "cancelled");
    let text = normalizeAiTextOutput(data.text);
    if (opts.startWith && !text.startsWith(opts.startWith)) text = opts.startWith + text;
    if (activeRequest) { activeRequest.responseChars = text.length; activeRequest.pluginAttempts = 1; }
    opts.onStream?.(text, text, true);
    return text.trim();
  }
  async function generateHostedImageHtml(prompt, negativePrompt, seed, options = {}) {
    const resolution = /^(\d+)x(\d+)$/.exec(EmberGenerationContract.hostedImageResolution(options.resolution));
    if (!resolution) throw new Error("Image resolution must be WIDTHxHEIGHT.");
    const payload = EmberGenerationContract.request("image", {prompt: String(prompt), negativePrompt: String(negativePrompt || ""), seed: seed == null || seed === "random" ? -1 : Number(seed), width: Number(resolution[1]), height: Number(resolution[2])});
    try {
      const result = await hostingProxyRequest("image", payload, {isCancelled: options.isCancelled});
      return `<img src="${escapeHtml(result.image)}" alt="Generated image">`;
    } catch (error) {
      log("Hosted image generation failed", error.message, {type: "images", level: "error"});
      throw error;
    }
  }
