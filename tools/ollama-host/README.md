# EmberAdventures Ollama host

Requires Node.js 22.15 or newer and a running Ollama installation with a downloaded chat/instruction model. Run `ollama list` to check installed names; install your chosen model with `ollama pull MODEL`. Model capabilities, hardware requirements, and context limits depend on that model.

## Windows setup

1. Copy this entire folder to the Windows model computer. Install Ollama if needed.
2. Open **Open Host Control Panel.bat**. Choose the folder containing your models, including GGUF files in subfolders, then press **Start**. The path appears beside the folder button. Setup and errors stay in the panel; a Windows certificate approval may appear on first use.
3. Yellow means starting, green means ready, red means an error, gray means stopped. **Start** also configures Tailscale Serve when Tailscale is installed and signed in. The private address appears in the **Remote URL** field. If Tailscale is unavailable, the panel explains why and local hosting still works. **Stop** ends only the processes this panel started. Closing a running panel hides it in the system tray. Use **Quit and Stop Host** to exit completely.
4. In EmberAdventures, open **Settings → Text Model**, choose **Ollama / This computer**, and click **Refresh Models / Connect**. Approve the connection on the host computer. No key copying or JSON editing is needed. Select a model. Provider, model, reasoning, and tuning changes save automatically; invalid input stays unsaved with an explanation.
5. For another Windows computer, install and sign into Tailscale on both devices. On the playing computer, install the **Windows player connector** once using the link in Text Model settings. Then choose **Another computer through Tailscale** in the game. The browser may ask to open the installed connector. It searches online tailnet peers for EmberAdventures Host and connects automatically if it finds one; when several are running, choose one. Approve the connection on the host computer. The host computer does not need to open the game. The Remote URL field remains available for devices without the Windows connector.

If a supported Node.js runtime is missing, **Start** asks permission to download it and lets you choose an installation drive. Declining or cancelling downloads nothing. It verifies the official download's SHA-256 checksum, installs a private runtime under `<drive>\EmberAdventuresRuntime`, and continues startup. No system PATH change or terminal command is needed. Download or installation failures appear in the panel.

The browser may request local-network access. Windows may request certificate trust. These are OS/browser permissions that the app cannot approve for you. Tailscale Serve requires HTTPS enabled in the tailnet and appropriate access rules. It never enables public Funnel.

The player connector is a per-user Windows protocol handler in `tools/ollama-player-connector`. It is launched by the game only after a user action, reads the local Tailscale peer list, and probes each online peer for the unauthenticated `/api/host/discovery` marker. It returns matching private host URLs to the game through a nonce-bound loopback popup. It does not register a background service or store host URLs in a database. If Tailscale is not signed in, the connector reports that in the game. The first browser launch may require approving the external-app prompt.

If Perchance's iframe blocks local-network permissions, Connect opens a small **EmberAdventures connection** window at the host address. Leave it open while playing (it can stay in the background). The window makes same-origin host requests and relays streamed responses to the exact game window through dedicated message ports. Approval and authentication still apply. Closing it cancels pending requests; Connect opens a new one. If popups are blocked, allow this connection popup and click Connect again. Restart the host after updating its files so it can serve the connection window.

Connection credentials are exchanged internally only after approval and live in game memory until the page closes. Restarting the host invalidates paired sessions; connect again to approve a new session. Approval is required locally as well because sandboxed Perchance frames do not provide a trustworthy app-specific origin. Only approve a prompt after you or a trusted player click Connect. Keep host-config.json and certificate private keys private.

The panel starts its own Ollama server on loopback port 11435 with the selected model directory; it leaves any separately installed Ollama service alone. The bridge uses loopback 51820 and HTTPS 51821. Start automatically replaces a running host only after authenticating it and verifying its installation directory and process ID. Unknown programs and legacy hosts without the verification endpoint are left running with a visible error. Per-session diagnostic logs are under the ignored `sessions` folder. Model files are not moved or deleted.

The desktop panel and approval prompts currently require Windows. The Node transport tests remain cross-platform.

## Generation controls

**Enable Model Reasoning** is off by default. It sends Ollama's top-level `think: false` when unchecked and `think: true` when checked. Supporting models can spend extra time reasoning before answering; this can make responses much slower. Reasoning traces are not placed in game narration. Model support varies. The canonical `reasoning` setting is an optional boolean: omission means disabled, without modifying existing stored settings. Restart the host after updating its files.

Blank tuning values leave Ollama/model defaults untouched. Temperature controls randomness; seed requests repeatability for identical inputs, without guaranteeing identical results across hardware/model versions. Top-p and top-k control token sampling. Repetition penalty 1 disables that penalty. Response tokens limit generated output; reaching that limit is an error rather than silently applying an incomplete turn. The host never trims game prompts. The context window is not a player setting: the host initially allocates 12288 tokens, grows it for longer prompts, and does not shrink it for short follow-up calls. This avoids repeatedly reloading the model between narration and state passes. Larger windows use more memory; the chosen model and available host memory still determine what can run.

Responses stream immediately. Thinking output is not sent into game narration. Stop cancels the browser request and upstream generation. There is no automatic generation timeout or silent retry against another computer/provider. HTTP/stream failures are surfaced and incomplete responses do not become completed turns.

## Tests

Run **Test Ollama Host.bat**, or `node --test test.cjs`. Tests use synthetic prompts, a fake Ollama server, and actual local HTTP requests; they need no downloaded model, API key, GPU, or Tailscale account. They cover authentication, CORS/preflight, model discovery, remote model selection, explicit model warmup, tuning validation, streaming, Unicode, failures, cancellation, and incomplete responses. They do not claim that a particular model can follow the game's story/state instructions.

After installation, use Connect in the actual Perchance page to verify the real browser/Tailscale path. Play a short synthetic test game to assess your selected model. Local automated tests cannot verify your firewall, tailnet rules, browser permission, or GPU.

References: https://docs.ollama.com/api/chat, https://docs.ollama.com/modelfile, https://tailscale.com/docs/reference/tailscale-cli/serve

## Model storage and readiness

**Choose Models Folder** remembers the current user's `OLLAMA_MODELS` path and applies it directly to the managed Ollama process at Start. Folder changes are disabled while running. The game lists models already registered in that store and discovers `.gguf` files in nested subfolders. Selecting a GGUF imports that one file into Ollama on first use, then loads it. Importing may take time and use additional disk space; other GGUF files are left alone until selected. Split GGUF files and other model formats are not auto-imported.

While a model is selected, the Host panel shows whether Ollama is importing the GGUF or loading it into memory, how long that stage has been running, and an activity bar. When Ollama prints a percentage during import, the bar displays it. The panel also shows readiness or the import/load error. The game keeps its own loading indicator and can cancel the request.
If model loading fails, **Open Host Logs** opens the current session folder. `ollama.err.log` contains Ollama's diagnostic output; `host.err.log` contains bridge failures. These logs help distinguish a stopped Ollama server from a model runner that disconnected during loading.

Model selection, refresh, loading, cancellation, and generation settings are controlled in EmberAdventures. Loading uses an indeterminate progress bar until Ollama confirms readiness; Ollama does not provide a percentage or ETA. Model downloads are separate from loading. Models may be evicted under memory pressure or when switching.

Windows control construction check (no window or settings changes): `powershell -NoProfile -STA -File control-panel.ps1 -CheckLayout`.
