# Optional local developer bridge

The current direct HTTPS path is documented in [DIRECT_HTTPS_HANDOFF.md](DIRECT_HTTPS_HANDOFF.md). The following retained launcher requires local-network browser permission. It is a separate integration for developer use.

# Local endpoint handoff and session launch

## Preferred user flows

For an explicitly selected local developer bridge, double-click **Start Hosted Lite.bat**. Paste/drop a non-secret handoff path, or press Enter for guided provider/URL/model entry. A handoff file can also be dragged onto the batch file. Python 3 and Node 20+ are required; bundled Node is detected. Enter fresh keys at hidden prompts. The launcher opens the published Lite page with the bridge address for that session.

For the separate demo's relay, use its **Start Hosting Setup.bat → Demo & Ember Lite → Launch Lite** button. It supplies its newly generated local relay key in memory to the existing Lite `hosting/server.cjs` CLI. In the game, select hosted text in Settings → Generation hosting, use `http://127.0.0.1:51840`, and save. The demo's launched configuration disables images. Do not run both launchers on port 51840 simultaneously.

The demo currently keeps its temporary relay key private. Although the standalone launcher validates its exported handoff, importing that export alone cannot authorize a relay request. Do not substitute a cloud key at the relay-key prompt. The integrated demo launch is the supported path without manual secret transfer. This Lite change does not edit or replace the demo launcher.

## Direct endpoint file: version 1

Exactly these fields are accepted:

```json
{
  "version": 1,
  "provider": "runpod_lb",
  "url": "https://YOUR_ENDPOINT_ID.api.runpod.ai/v1/chat/completions",
  "model": "ember-qwen-27b"
}
```

`provider` is exactly `runpod_lb`, `vast`, or `openai` (dedicated/generic). `url` is the complete Chat Completions endpoint; any provider-specific path prefix is retained. HTTPS is required except HTTP loopback. Credentials, user-info, query strings and fragments are prohibited. Unknown fields, including API keys, are rejected. The authoritative validator is `handoff.cjs:validateHandoff`.

Lite asks for the endpoint API/inference key, sends it as Bearer authorization, and separately asks for `X-Inference-Key` in `runpod_lb` mode. The `vast` mode expects an already prepared OpenAI-compatible proxy URL; a raw rental/routing API is not an inference endpoint. The served `model` alias does not select quantization. The demo owns Q5/Q4 runtime/artifact preparation.

## Existing demo relay export

The demo's actual `Session.handoff()` exports exactly these seven fields (example):

```json
{
  "provider": "runpod-serverless",
  "mock": true,
  "model": "ember-qwen-27b",
  "base_url": "http://127.0.0.1:9001/runpod-serverless/v1",
  "credentials": "Local session only; launcher supplies relay key. No cloud key in browser/config.",
  "runtime": "llama.cpp Q5_K_M, 32768 context, FP16 KV, one sequence",
  "remote_verified": false
}
```

Provider is `runpod-pod`, `runpod-serverless`, `vast-instance` or `vast-serverless`. `base_url` must be loopback HTTP with exact `/{provider}/v1` path, without credentials, query or fragment. Both flags must be booleans; the remaining metadata must be nonempty strings. Unknown fields are rejected by `handoff.cjs:validateDemoHandoff`. The `credentials` field is descriptive metadata, never used as a key. Mock/remote flags do not authorize cloud actions or establish remote verification.

The adapter appends `/chat/completions`, preserves the relay path, and uses a distinct local-session Bearer credential. Cloud credentials stay behind the demo relay. A contract test consumes the current demo's actual in-memory mock export and records zero mock cloud calls. Authenticated end-to-end remote operation remains untested.

## Configuration and private process interface

The Python launcher calls the Node contract rather than duplicate validation. Its ignored `hosting/config.local.json` stores validated non-secret settings and credential-variable **names** only. New defaults have both hosted roles disabled. Applying either handoff selects `openai-chat` for text and preserves existing image configuration and validated text sampling. Previously configured image adapters may request their own fresh session credentials.

No launcher reads keys from environment variables, credential stores or existing credential files. Hidden input fails closed if the console cannot hide it. A restricted child environment and private stdin pipe pass newly entered keys to Node. Keys never go into handoffs, config, command arguments, browser storage or logs. Closing the session drops process memory; this is not a claim of cryptographic memory erasure.

For a future integrated caller, `node hosting/session-server.cjs --prepare` accepts one stdin JSON line `{config, handoff}` and returns `{config, credentials}`; each credential descriptor has `variable`, `kind`, and `label`. `handoff: null` validates an existing config. Start `node hosting/session-server.cjs` with one private stdin JSON line `{config, secrets, port}`, where `secrets` contains exactly the required variable names and their values. The child returns `{ready:true,url}` or a static secret-free failure. A subsequent `shutdown` line or closing stdin stops the local process. Never put this JSON on a command line or persist it.

The landing page contains no credentials. Its explicit button changes only the browser text route and proxy origin, preserving its image selection. Startup and landing perform no inference; opening an existing game can resume its existing behavior and use paid generation.

Press Enter (or Ctrl+C) in the launcher to stop the **local** proxy. This does not stop paid cloud resources: use the demo's separate shutdown/lifecycle flow. A disconnected remote request may still be running; inspect its dashboard before resending.

Direct sibling-task coordination messaging was denied by automatic approval review because authorization to message that task was unclear. No message was delivered. Compatibility was checked through read-only source inspection and the mock export test instead; the parent can relay this interface if needed. No paid request, provisioning, image job, persistent credential setup or Lite push was performed.
