# Ember Adventures Lite generation hosting

This branch connects the **actual game's text queue and image generator** to independently selected providers. Perchance is the default for both. The existing `?localCodexText=1` developer launch still takes precedence for text. No account, paid resource, secret, model download, GPU load or live deployment was created during implementation.

## Start locally

From the repository root, with Node 20+:

```powershell
node build_bottom_compressed.js
Copy-Item hosting/config.disabled.example.json hosting/config.local.json
node hosting/preflight.cjs hosting/config.local.json
node hosting/server.cjs hosting/config.local.json
```

Preflight exit 2 means a provider is disabled or a required environment variable is missing. It never calls a provider. Open `http://127.0.0.1:51840/` and use Settings → Generation hosting. Select text and images independently, enter the local proxy origin, and click **Save generation providers**. Perchance plugins are available inside Perchance; a standalone local preview needs the proxy for generation. The page uses its existing browser-local save database. Back up real game data before switching origins/browsers.

Use `config.dedicated.example.json` for OpenAI-compatible vLLM text plus the Krea image service described below, `config.runpod.example.json` for separate queue endpoints, or `config.vast.example.json` for the official Vast vLLM and ComfyUI templates. `config.runpod-load-balancer.example.json` matches the separate demo gateway: RunPod bearer in `RUNPOD_AUTHORIZATION`, plus raw gateway secret in `EMBER_TEXT_GATEWAY_KEY` as `X-Inference-Key`. Its text baseUrl ends in `/v1`; the adapter appends `/chat/completions`. Mix the `text` and `image` objects across examples as needed. Unknown fields are rejected. Do not put secrets in JSON. `*.local.json` below this directory is ignored by Git.

To enter a secret locally without putting its value in shell history (PowerShell 7):

```powershell
$env:RUNPOD_AUTHORIZATION = 'Bearer ' + (Read-Host 'RunPod inference key' -MaskInput)
$env:EMBER_TEXT_AUTHORIZATION = 'Bearer ' + (Read-Host 'Text endpoint inference key' -MaskInput)
$env:EMBER_IMAGE_AUTHORIZATION = 'Bearer ' + (Read-Host 'Image endpoint inference secret' -MaskInput)
```

Only enter the variable required by your selected adapter. Restart the local proxy from that shell. Close the shell or remove the environment variable when finished. No token is needed in chat, localStorage, game saves, client source, Git or screenshots. `authorizationEnv` names a variable containing the **whole Authorization header**, allowing `Bearer …` or `Basic …` for a user-controlled authenticated A1111 service. An empty name explicitly means the endpoint needs no header, usually a loopback SSH tunnel. Vast `apiKeyEnv` contains its raw SDK key. This proxy does not load `.env` files or persist credentials.

## Adapter contract and behavior

Browser → local proxy (header `X-Ember-Generation: 1`, JSON body):

| Endpoint | Exact request | Exact success |
| --- | --- | --- |
| `POST /api/generation/text` | `{instruction: string, startWith: string, stopSequences: string[]}` | `{text: string}` |
| `POST /api/generation/image` | `{prompt: string, negativePrompt: string, seed: integer, width: integer, height: integer}` | `{image: string}` |

The hosted settings panel documents portrait **832x1216** and profile/square **1024x1024**. `request.portrait.example.json` and `request.square.example.json` under `hosting/image/` show exact native Krea API payloads for later authorized inference; no request was sent. Image seed `-1` means random. Images are PNG/JPEG/WebP data URLs or HTTPS asset URLs. Errors are non-2xx `{error: string}`. The proxy never accepts a destination URL, credential, model-control action or arbitrary workflow from the browser. Backend settings choose the destination and model. A role has at most one pending proxy request; another gets HTTP 409. Request bodies over the documented 2 MiB transport budget are rejected whole.

| Adapter `kind` | Role / actual API |
| --- | --- |
| `openai-chat` | Text: `baseUrl=/v1`, POST `/chat/completions`; checks finish reason and `choices[0].message.content` |
| `runpod-vllm` | Text: current worker-vllm 0.31.0 proxy contract `{input:{route,body}}`; `/run`, then GET `/status/ID`; one aggregated OpenAI response |
| `sglang-images` | Image: `baseUrl=/v1`, POST `/images/generations`; distinct image payload and `data[0].b64_json` |
| `runpod-sglang-images` | Image: this repo's queue worker; native image payload inside `input`, `/run` → `/status/ID` → `output.data[0].b64_json` |
| `automatic1111` | Image: POST `/sdapi/v1/txt2img`; `images[0]` base64. Config also requires `steps`, `cfgScale` |
| `comfyui` | Image: POST `/prompt`, poll `/history/ID`, GET `/view`; explicit saved `outputNode`; image bytes retrieved with endpoint auth |
| `runpod-comfyui` | Image: official worker-comfyui **5.0+**, `input.workflow`; polls job status; `output.images` base64 or S3 URL |
| `vast-vllm` | Text: official `vastai.Serverless` SDK, named endpoint `/v1/chat/completions`, `input` envelope, SDK `response` |
| `vast-comfyui` | Image: official Vast ComfyUI template `/generate/sync`, `input.workflow_json`, completed output asset URL for configured node |

Vast optional SDK setup: use a separate Python environment, install `vastai==1.8.3`, and set `python` in the configuration to that environment's Python executable. Routing/signatures stay in the helper process; SDK diagnostic output is suppressed. This is a documented adapter for a user's existing template, **not a one-click Krea serverless template**. Use the dedicated Krea container on Vast or the prepared RunPod Krea queue worker for the selected model.

ComfyUI configurations require `workflowFile` (relative to the config file) and `outputNode`. Export **API format**, then replace explicit JSON values with `"{{prompt}}"`, `"{{negativePrompt}}"`, `"{{seed}}"`, `"{{width}}"`, `"{{height}}"`. Values are replaced structurally, preserving quotes/newlines and numeric types. These are placeholders in a user-controlled template, not AI data repair. All referenced model files and native/custom nodes must already exist on the worker. No local personal workflow is copied automatically.

RunPod pending states remain pending with configurable polling intervals. Explicit provider failure/cancellation/timeout is an error. There is no app-imposed live-job deadline or automatic paid resubmission. Connection loss may leave an accepted job running: inspect the dashboard before retrying. Explicit text cancellation aborts the client request; for a known RunPod job the proxy makes a best-effort `/cancel/ID` request. ComfyUI global `/interrupt` is intentionally not used because it can affect other jobs. Vast/helper or direct HTTP disconnect does not guarantee GPU-side cancellation. The existing Perchance implementation is retained, including its existing image timeout behavior; the hosted image path bypasses that wrapper.

Hosted text arrives as a complete response and uses the existing final text callback. `startWith` is conveyed as an instruction and restored once if omitted; this is not universal native assistant-prefill support. Existing image style/safety prompt construction, seed, negative prompt and dimensions feed the selected adapter. At Turbo guidance 1, negative conditioning is not an effective safety filter. The app's SFW positive instructions remain essential; generated image suitability requires actual review.

Generation selections live in a separate strict `emberadventures-lite-generation-v1` localStorage record (`text`, `image`, `proxyUrl`). Existing game/settings records and exports do not change. The new selections are per browser origin and are not included in old backup schemas. Queued text snapshots the selected route/origin.

## Selected text profile (shared with the separate demo)

The selected deployment **candidate** is now **Qwen3.8-27B GGUF Q4_K_M through llama.cpp on a 24 GiB GPU**, served as `ember-qwen-27b`. This supersedes the earlier compressed-tensors W4A16/vLLM 48 GB default. Exact GGUF file, revision, llama.cpp image, context and engine settings belong to the separate [demo hosting setup](https://github.com/andro951/model-hosting-presentation-demo/blob/main/hosting/SETUP.md); follow its updated selected profile rather than duplicate text infrastructure here. Neither model fit nor quality has been measured by this task.

The generic `openai-chat` adapter sends the served alias and parses `choices[0].message.content`; it does not infer the checkpoint format from that alias. The dedicated/load-balancer examples use this contract. `enableThinking: null` omits vLLM-specific `chat_template_kwargs`; configure thinking and template behavior through the selected llama.cpp/demo profile. Native `runpod-vllm` and `vast-vllm` remain opt-in adapters for independently configured vLLM deployments, not the selected GGUF runtime. Do not attempt to load the GGUF file using a vLLM template.

Text serving/provisioning stays in the demo repository. Dedicated text uses a bearer inference secret. RunPod load-balancer text additionally requires the separate `X-Inference-Key` gateway secret. Lite keeps sampling configurable (example temperature 0.7, top_p 0.8, top_k 20 and output cap 800). A game's world/story JSON may require more output/context than the two-prompt demo. The adapter reports truncation/context errors instead of silently shortening canonical game data; validate each intended workflow after funding.

## Krea image setup: concrete implementation, pending funded verification

The read-only desktop inspection found `C:\Users\Isaac\Documents\ComfyUI`, with workflows `Krea2_Turbo_Q3_MysticX_Realism.json` and `Krea2_Turbo_Q3_Image_to_Image.json`. Both explicitly load `Krea-2-Turbo-Q3_K_M.gguf` through the advanced GGUF loader, with `qwen3vl_4b_fp8_scaled.safetensors` and `qwen_image_vae.safetensors`. Text-to-image was four Euler/simple steps, CFG 1. The local LoRA stack is not used for Lite.

Cloud target: **`krea/Krea-2-Turbo` BF16**, pinned model revision `98e0fe118d17c9e3547fbb2e25acdbae2cadf7c7`, eight steps and **SGLang guidance_scale 1.0**. This is the same family with higher precision than the local Q3 checkpoint, not evidence of a larger parameter count or guaranteed quality improvement. Do not substitute FLUX.1 Krea or assume RAW is automatically better. SGLang's documented H200 benchmark reports 37,466 MiB (36.59 GiB) peak PyTorch reserved memory over the complete request, excluding non-PyTorch allocations; choose a **separate 48 GB GPU**, batch one, with the approved portrait/square defaults below. That benchmark is not an A40 latency measurement. Hosted defaults are **832x1216 portrait** and **1024x1024 profile/square**. The published 36.59 GiB measurement is for 1024-square; portrait peak memory and latency are **unmeasured**, and must be validated separately. Existing Perchance defaults stay 512x768 portrait and 768x768 profile. The hosted boundary translates only existing default projections (512x768 to 832x1216; 512x512 or 768x768 to 1024x1024), without editing saved records. Other explicit nondefault dimensions remain unchanged.

The provided image container extends official `lmsysorg/sglang:nightly-dev-cu13-20261019-3c560089`, pinned manifest digest `sha256:c1f4d9fc6fcf50c2269adbc757ce7b1778883af04155edb888fa9eea3b6648c0`. The tag/digest and Krea pipeline/image API source at `3c560089e1818a5217a73f2168273485a5350341` were verified without pulling container layers. The cookbook labels its benchmark 0.5.13, but the plain 0.5.13 release lacks the Krea pipeline; do not use that release as the Krea runtime. The future image build asserts Krea source presence, and GPU acceptance remains unrun. It optionally runs native SGLang behind an inference-only HTTP gateway, or a real RunPod queue handler; the upstream-only Compose path uses the official image directly. It has no GPU/account provisioning endpoints. Build context excludes everything except Dockerfile and worker.py. Model weights are fetched at startup into the persistent cache only when you later launch it.

### One-time prerequisites

1. User reviews/accepts the applicable Krea terms and obtains access to the gated official Hugging Face repo. No terms were accepted here. Sources give conflicting commercial guidance: resolve applicable terms before a commercial product launch; do not infer that a classroom demonstration necessarily requires the commercial subscription.
2. User chooses/funds a provider account and GPU offer; reviews compute, disk, network-volume and registry costs. Zero workers does not eliminate stored-volume charges.
3. Linux NVIDIA host supports the pinned container's CUDA 13 stack, Docker and NVIDIA Container Toolkit; check the selected offer's driver capability. A 48 GB GPU does not itself establish driver compatibility. Allow 100 GB container disk and a persistent 100 GB cache; adjust from actual inventory and costs. This desktop has 14.89 GB (13.87 GiB) free and no Docker/Podman command or verified Linux Docker daemon. The pinned nightly amd64 image alone is **15,792,040,319 compressed bytes** (14.71 GiB), already exceeding free space before extraction. Unpacked image size was not measured. Public model metadata totals 61,995,040,979 bytes because it includes a redundant 26,283,332,608-byte root checkpoint; the launcher selects only Diffusers components, with a conservative upper bound of 35,711,708,371 bytes (33.26 GiB). Allow additional extraction/cache/build scratch; the 100 GiB free-space preflight budget is planning headroom, not a measured unpacked total. No huge pull/build was attempted. Run `python hosting/image/preflight.py --path ACTUAL_DOCKER_STORAGE_PATH` on the intended Linux host; verify the model volume separately.
4. Keep credential roles distinct: provider management token for creating/deleting resources; inference credential for this local proxy; HF read token with gated-model access for worker downloads; registry credential only if needed to pull your private container. Do not bake tokens into image layers, arguments, model snapshots or Git.

### Dedicated host: official upstream container directly (no build/push)

A custom image is **not required**. On an approved Linux GPU host with Docker, upload `hosting/image/worker.py`, `compose.upstream.yaml` and `preflight.py`. The Compose file uses the immutable official upstream image and mounts the small reviewed Python launcher read-only. Upstream mode installs no extra package, downloads only the pinned Diffusers-layout components, then execs SGLang directly. No HTTP gateway wrapper or new registry artifact is needed. This direct upstream server has no application authentication in the audited diffusion source, so its host port stays loopback-only and is reached over SSH.

```bash
cd hosting/image
python3 preflight.py --path .
read -rs -p 'HF read token: ' HF_TOKEN; export HF_TOKEN; echo
docker compose -f compose.upstream.yaml pull
docker compose -f compose.upstream.yaml up -d
curl -i http://127.0.0.1:30000/health
```

These are future GPU-host commands, not commands run on Isaac-PC. Readiness HTTP 200 is not a generation-quality result. The official runtime's startup warmup may itself run a synthetic generation after model loading; execute only when GPU/model loading and spend are authorized. On Isaac-PC open the verified host's SSH tunnel:

```powershell
ssh -N -L 30000:127.0.0.1:30000 USER@HOST -p SSH_PORT
```

Use `config.dedicated.example.json` image settings: `kind=sglang-images`, `baseUrl=http://127.0.0.1:30000/v1`, `authorizationEnv=""`, model `krea/Krea-2-Turbo`, steps 8, guidanceScale 1. Authentication is provided by the SSH connection. Do not expose the unauthenticated upstream port to the Internet.

Stop with `docker compose -f compose.upstream.yaml stop`; remove containers while retaining cache with `docker compose -f compose.upstream.yaml down`. Remove cache only when explicitly discarding weights: `docker volume rm ember-krea2-model-cache`. Separately stop/terminate the provider instance and remove unwanted provider volumes to end billing.

The existing `compose.yaml` + Dockerfile remain an optional packaging choice for the authenticated HTTP wrapper. That path needs `EMBER_IMAGE_TOKEN`, `docker compose build`, then `docker compose up -d`; no publication is needed when building directly on the GPU host. If a provider's native container environment cannot run Docker-in-Docker, use its official-image entrypoint/start-command support or build on a separate approved Linux builder. Do not assume nested Docker is available.

### RunPod queue serverless (scale to zero)

The lifecycle script now defaults to the **same immutable official upstream image**, using RunPod's documented template `dockerEntrypoint`/`dockerStartCmd` fields to embed the reviewed worker source in a Python startup command. It installs pinned `runpod==1.12.0` inside the ephemeral container, then starts the real queue handler. No custom build or registry publication is required. This provider startup transport and package installation are mocked/source-checked, not paid-host verified. Startup requires package-index access, writable `/tmp`, and the normal container Python/pip runtime. A prebuilt custom image can reduce cold-start installation work but is optional, and no image was published.

Optional custom packaging, only on an approved Linux builder and with explicit publication approval:

```bash
docker build -t YOUR_REGISTRY/ember-krea2-turbo:sglang-krea-3c560089 hosting/image
# Do not push without separate explicit approval.
# docker push YOUR_REGISTRY/ember-krea2-turbo:sglang-krea-3c560089
```

Create a 100 GB network volume in the same eligible region as the chosen 48 GB GPU and record its ID. Private registry pulls require a provider registry connection (configure that in the console). The lifecycle-rendered template has `EMBER_IMAGE_MODE=runpod`, HF cache under `/runpod-volume`, zero minimum workers and one maximum worker. It is a **queue endpoint**, not a load-balancer pretending to accept `/run`. Do not submit the raw template JSON alone: the lifecycle script inserts the required embedded startup command. Its native RunPod job output is `{data:[{b64_json}]}`. Provider execution/TTL limits still apply; this app adds none. Review the endpoint's platform execution limit against measured cold startup before relying on long jobs.

An optional `--image=YOUR_REGISTRY/IMAGE:TAG` uses your already-built custom image instead of embedded bootstrap. The lifecycle script uses the documented RunPod REST `/v1/templates` and `/v1/endpoints` APIs. Default is a no-network plan:

```powershell
node hosting/image/runpod-lifecycle.cjs create
```

After you have explicitly chosen to provision, set session `RUNPOD_MANAGEMENT_KEY` and `HF_TOKEN` using `Read-Host -MaskInput`, then:

```powershell
node hosting/image/runpod-lifecycle.cjs create --volume-id=YOUR_VOLUME_ID --execute
node hosting/image/runpod-lifecycle.cjs status --execute
```

These commands were tested with fake management responses only. The create operation stores the HF token in the **private provider template environment** for downloads, not in the local state file. Review that remote credential storage before running it. The ignored `hosting/image/deployment.local.json` records only IDs/pending state. An uncertain result is never automatically retried: reconcile with the dashboard first. The script does not create a registry connection, fund an account, accept a license or select a market offer on your behalf.

Copy the returned inference base URL into `config.local.json` image settings with `kind=runpod-sglang-images`, and set session `RUNPOD_AUTHORIZATION` for the inference API. Run local preflight and start the proxy. Configure text separately using the demo's verified text endpoint. The management key is not required by the game's proxy.

When finished, first turn the game's paid routes back to Perchance or stop the proxy. Explicitly remove the recorded endpoint and template:

```powershell
node hosting/image/runpod-lifecycle.cjs delete
node hosting/image/runpod-lifecycle.cjs delete --execute
```

Deletion interrupts endpoint availability. The network volume is intentionally retained; explicitly remove it in the provider console when no longer wanted. Verify no resources remain billed. A load-balancer deployment can use the same image in HTTP mode with ports `PORT=30000`, `PORT_HEALTH=30000`, `/ping`, and `EMBER_PROVIDER_AUTH=runpod` behind RunPod's authenticated gateway, but the prepared queue path is preferable for uncertain cold-start/image runtimes.

## Security and browser hosting

The local server binds only `127.0.0.1`, checks Host against loopback, requires a custom JSON header, and permits same-origin browser access. It serves an allowlist of game assets, never `hosting/`, `.git`, environment/config files or arbitrary URLs. Remote provider authorization stays on the proxy. Do not publish this personal proxy as a public multi-user backend.

For an isolated Perchance test generator, only allow the verified actual page origin via session `EMBER_ALLOWED_ORIGINS` (comma-separated exact HTTPS origins, no wildcard). HTTPS pages may block HTTP localhost through mixed-content/Local Network Access rules. The proxy supports a user-supplied trusted certificate via `EMBER_HOSTING_PFX` and optional session `EMBER_HOSTING_PFX_PASSWORD`; use `https://localhost:51840` in settings. No certificate or browser security bypass was installed here. Prefer local preview for initial paid testing; real Perchance cross-origin access remains untested.

## Checks and remaining acceptance work

```powershell
node --test tools/test-hosting.cjs
python tools/test-image-worker.py
node tools/test-settings.cjs
node tools/test-image-safety.cjs
node tools/test-hosting-ui.cjs
```

The browser test uses a fresh context, blocks nonlocal network traffic, exercises the actual game's text queue/image entrypoint, confirms Perchance plugin compatibility with fakes, and saves desktop/mobile screenshots under `test-output/`. All provider output and management responses are mocked. Existing RPG tests were not changed or launched; hosting coverage is confined to the new targeted test files. No live Perchance AI requests were made.

The second presentation demonstration must still run the **actual game using both real remote text and remote image generation** after funding, credentials, gated access and deployment are authorized. An integration screenshot is not that acceptance. Then verify startup/cold/warm behavior, game JSON output, model/dimension fit, image SFW/fantasy suitability, cancellation, platform limits and resource cleanup. Until that happens, container build/runtime, remote APIs, GPU memory/latency, model quality and billing remain unverified. This is prepared implementation and dry-run orchestration, **not token-only proven deployment**.

## Official references checked 2026-10-19

- [RunPod operations](https://docs.runpod.io/serverless/endpoints/operation-reference), [current worker-vLLM handler](https://github.com/runpod-workers/worker-vllm/blob/main/src/handler.py), [worker-comfyui API](https://github.com/runpod-workers/worker-comfyui#api-specification).
- [RunPod template creation](https://docs.runpod.io/api-reference/templates/POST/templates), [endpoint creation](https://docs.runpod.io/api-reference/endpoints/POST/endpoints), [endpoint deletion](https://docs.runpod.io/api-reference/endpoints/DELETE/endpoints/endpointId), [load-balancer health](https://docs.runpod.io/serverless/load-balancing/overview).
- [Vast SDK quickstart](https://docs.vast.ai/guides/serverless/quickstart), [Vast vLLM](https://docs.vast.ai/guides/serverless/vllm), [Vast ComfyUI](https://docs.vast.ai/guides/serverless/comfy-ui).
- [SGLang Krea 2 recipe and benchmark](https://docs.sglang.io/cookbook/diffusion/Krea/Krea-2), [installation](https://docs.sglang.io/docs/sglang-diffusion/installation), [pinned Krea pipeline](https://github.com/sgl-project/sglang/blob/3c560089/python/sglang/multimodal_gen/runtime/pipelines/krea2.py), [pinned image protocol](https://github.com/sgl-project/sglang/blob/3c560089/python/sglang/multimodal_gen/runtime/entrypoints/openai/protocol.py), [official nightly tag metadata](https://hub.docker.com/r/lmsysorg/sglang/tags?name=nightly-dev-cu13-20261019-3c560089).
- [Krea 2 Turbo model](https://huggingface.co/krea/Krea-2-Turbo), [official ComfyUI Krea 2 tutorial](https://docs.comfy.org/tutorials/image/krea/krea-2), [ComfyUI HTTP routes](https://docs.comfy.org/development/comfyui-server/comms_routes), [A1111 API](https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/API).
- [Canonical text demo hosting setup](https://github.com/andro951/model-hosting-presentation-demo/blob/main/hosting/SETUP.md): follow its updated GGUF/llama.cpp candidate and exact revision pins.
