# Generation hosting in EmberAdventuresLite

Lite supports Perchance, Ollama on this computer or through Tailscale, and hosted text/image providers. Ordinary visits use saved preferences. Launcher-provided endpoints apply only to that session.

## Direct HTTPS workers

Use [DIRECT_HTTPS_HANDOFF.md](DIRECT_HTTPS_HANDOFF.md) for the public-worker protocol and automatic launcher handoff. The launcher prepares workers, models, sampling and billing limits, then opens the published Lite URL with a one-use ticket. Lite claims its endpoints, keeps inference credentials in memory, and sends text and image jobs directly over HTTPS.

The public destination and exact game iframe origin are in `live-site.json`. Update the origin when Perchance changes it. Worker CORS must allow that exact origin. The text/image examples, `direct-worker.cjs`, and the canonical contracts implement this route. They do not start or pay for cloud models themselves.

Pending jobs remain pending until the provider finishes, reports failure, or the player cancels. A transport failure never resubmits generation automatically.

## Local models

Copy `tools/ollama-host` and `tools/ollama-player-connector` together to a Windows host installation. Open **Open Host Control Panel.bat**, choose a model folder and press **Start**. In Lite's Text Model settings, connect to this computer or choose **Another computer through Tailscale**. The player connector discovers running hosts. Pairing uses an approval window; keys are exchanged internally.

See [the host guide](../tools/ollama-host/README.md) for setup, model discovery, loading status, reasoning and tuning controls.

## Optional developer bridge

The local `server.cjs` and `session-server.cjs` integration remains available for explicitly selected developer setups. It requires browser local-network permission and may be blocked by iframe policy. `Start Hosted Lite.bat` is this older developer launcher; it does not create a direct HTTPS worker deployment. [HANDOFF.md](HANDOFF.md) documents its separate contract.

## Verification

Run `node --test tools/test-direct-hosting.cjs tools/test-hosted-generation.cjs` for local protocol fixtures. These do not generate paid content. Browser tests require an explicit request. A successful live published-page connection to actual prepared workers remains a separate verification step; do that before paying for a new session.