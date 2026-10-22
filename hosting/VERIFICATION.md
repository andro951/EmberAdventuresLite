# Hosting verification — October 22, 2026 rebuild

This record supersedes the pre-rebuild adapter verification. Current release: `ea-7edd2543a90132e9`.

- `node --test tools/test-direct-hosting.cjs tools/test-hosted-generation.cjs` passes within the complete Node gate. It checks strict endpoint/ticket boundaries, in-memory credentials, sampling/resolution, routing, queueing, cancellation and uncertain-request behavior with local fixtures.
- `node --test tools/ollama-host/test.cjs tools/ollama-host/window-test.cjs tools/ollama-host/player-discovery-test.cjs`: 39 passed. Covers approved pairing, model discovery, actual local HTTP streaming, cancellation and the exact packaged player connector. No real model inference.
- `node --test tools/test-hosting.cjs tools/test-hosting-setup.cjs`: 26 passed. Provider adapters use fake responses; actual local launcher processes start/stop using disabled or synthetic endpoints. The launcher returns the public Lite URL with the local bridge address, without inference credentials. Child cleanup runs on failure too.
- `python tools/test-hosting-launch.py`: 5 passed, 1 skipped (the external demo checkout is unavailable).
- `python tools/test-image-worker.py`: 5 passed. Validation/worker boundaries are mocked; no GPU/model load.
- Both release/private pages compile and decompress exactly. These are build checks, not browser acceptance.

The game supports direct public HTTPS worker handoff, local/Tailscale Ollama, and the separate optional developer bridge. Read `DIRECT_HTTPS_HANDOFF.md` for the preferred cloud integration. `Start Hosted Lite.bat` starts the older developer bridge and cannot itself provision public workers or override a browser's local-network policy.

Not verified: live Supabase, the published Perchance iframe's exact CORS/origin access to prepared workers, actual GPU startup, real authentication/inference, model quality/latency, billing or cloud teardown. No paid resources were started. Do not spend on a new inference session on the strength of mock tests alone; complete the free published-page HTTPS rehearsal first. Browser tests require an explicit request.