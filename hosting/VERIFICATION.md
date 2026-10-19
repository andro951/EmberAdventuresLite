# Local verification — 2026-10-19

Repository: `andro951/EmberAdventuresLite`, cloned from `master` at `6f5963a13f918732559937725912c421d147846b` into the separate C: workspace. Branch: `codex/paid-generation-adapters`. Initial checkout was clean. No prior project, E: drive, model-hosting demo or personal ComfyUI files were edited.

Passed:

- `node --test tools/test-hosting.cjs`: **15/15**. Covers separate wire formats, request/response validation, text parameters/prefix/stops, truncation, dedicated images, RunPod polling and explicit cancellation, ComfyUI history/image retrieval, Vast SDK boundaries, provider errors, secret-safe failures, proxy origin/Host/path restrictions, and mocked resource create/delete lifecycle. No external provider traffic.
- `python tools/test-image-worker.py`: **3/3**. SGLang image-worker validation, exact image API request, result handling and absence of a live-job timeout. No SGLang import or GPU/model load.
- `node tools/test-settings.cjs`: passed existing strict settings/storage checks.
- `node tools/test-image-safety.cjs`: passed existing SFW image prompt checks.
- `node tools/test-hosting-ui.cjs`: passed in fresh headless Edge contexts. Exercised the actual text queue and image entrypoint with fake hosting responses, fake Perchance compatibility, independent persisted selections, invalid proxy-origin rejection and reload. Nonlocal network blocked. Desktop/mobile screenshots and JSON evidence are in `test-output/hosting-*`.
- `node build_bottom_compressed.js`: source assembly, parse checks and compression round trip passed. Final build `ea-8ac024124d8830d5`.
- Started the actual proxy CLI with `config.disabled.example.json`, read `/api/generation/status` locally (`text=disabled`, `image=disabled`, `remoteVerified=false`), then stopped it.
- RunPod lifecycle **dry-run only**. Preflight correctly reports disabled providers without contacting them.

The original RPG smoke registry/test infrastructure was left unchanged and its full suite was not run. Local dependencies were extracted from the three locked registry tarballs with SHA-512 integrity verification because npm is unavailable here. No installation scripts ran.

Image recipe source audit: plain SGLang 0.5.13 lacks the Krea pipeline despite the cookbook's benchmark label. The corrected Dockerfile pins `nightly-dev-cu13-20261019-3c560089` / manifest digest `sha256:c1f4d9fc6fcf50c2269adbc757ce7b1778883af04155edb888fa9eea3b6648c0`. Krea pipeline and image protocol were read at full commit `3c560089e1818a5217a73f2168273485a5350341`; the future Docker build asserts source presence. Model revision metadata is `krea/Krea-2-Turbo@98e0fe118d17c9e3547fbb2e25acdbae2cadf7c7` (gated). No image layers or model weights were downloaded. The desktop baseline was identified from saved loader nodes/model filenames as Krea 2 Turbo Q3_K_M, not FLUX.1 Krea.

**Pending:** Linux image build/publish, actual GPU startup and driver/memory compatibility, funded/gated model access, inference credentials, real Perchance cross-origin access, authenticated remote API behavior, full-game structured text and image quality, cold/warm latency and provider cleanup/billing acceptance. This task did not purchase, provision, load a model, make paid requests, accept terms, persist credentials, push Git or deploy the live game. The actual game demonstration with both remote models remains pending those prerequisites.
