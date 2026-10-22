# Direct HTTPS inference: desktop launcher handoff

This is for **normal EmberAdventures**, not Lite. The public game is
`https://perchance.org/emberadventures`; the private test page is
`https://perchance.org/emberquest`.

EA now has a direct HTTPS client and an asynchronous worker protocol. These
are implemented contracts, not evidence of a successful live RunPod browser
test. The previous pods were deleted. This implementation has only been
verified with local fixtures; it does not deploy or start cloud resources.

## Required path

```text
EA browser → public HTTPS API on the allocated model worker → local model engine
```

There is no service on the playing computer in this path. A worker API may
call its own private loopback model engine; that is entirely inside the cloud
worker. Do not route the browser back through localhost or a local relay.

Use `hosting/direct-worker.cjs` as the working reference. It reuses the existing
provider adapters and canonical generation validators. The launcher can run
this Node service alongside each existing model inside its pod, or implement
the identical protocol in the existing Python worker. A Python implementation
must match the canonical contract and pass the same protocol fixtures; do not
change EA to accept aliases or guess response shapes.

## Worker configuration

For the Node reference, use Node 24 or later in the cloud worker. Start:

```text
node hosting/direct-worker.cjs path/to/config.local.json
```

Templates: `config.direct-text.example.json` and
`config.direct-image.example.json`. They target the existing worker gateways
on private port 8000. Preserve their authentication, request accounting, fixed
image settings, and cleanup guards. Do not bypass the image session ledger by
calling an unguarded image engine directly. Model sampling stays in the host
configuration; text reasoning is disabled in the example. Verify full EA
prompt plus output context capacity rather than truncating prompts.

Set these environment variables on each **cloud worker**:

- `EMBER_DIRECT_BASE_URL`: its externally reachable HTTPS URL ending `/ea`,
  e.g. `https://POD_ID-8010.proxy.runpod.net/ea`.
- `EMBER_DIRECT_PORT`: listen port, default 8010. Expose this port through the
  provider's HTTPS proxy; keep model engine ports private where possible.
- `EMBER_ALLOWED_ORIGINS`: comma-separated exact EA iframe HTTPS origins.
  Lite public iframe origin observed October 22:
  `https://96a96f5d168eb13f495f30f74e287851.perchance.org`.
  Current public origin is in `hosting/live-site.json`; verify it when deploying.
- `EMBER_DIRECT_CONTROL_KEY`: launcher-only random base64url secret, at least
  32 characters. Never put it in the browser, manifest, or launch URL.
- `EMBER_DIRECT_TEXT_TOKEN` on the text worker; `EMBER_DIRECT_IMAGE_TOKEN` on
  the image worker: distinct random base64url browser inference secrets, at
  least 32 characters. They must differ from the control key and upstream keys.
- `EMBER_TEXT_AUTHORIZATION` or `EMBER_IMAGE_AUTHORIZATION`, matching the
  config: the existing internal gateway's complete `Bearer ...` header value.

The browser tokens only authorize job submission, status/result reads, and
job-specific cancellation for their own role. They cannot start models, issue
launch tickets, read launcher usage, or call RunPod management. Each pod's
upstream worker retains its own accounting/authorization. The reference is
single-session, with one active job per role. Job records and tickets remain
in memory until worker shutdown; no live job deadline or automatic retry is
introduced.

## Launcher: automatic handoff

Keep startup, readiness tests, billing safeguards and shutdown in the launcher.
After both workers are ready, register this exact JSON manifest on one worker:

```http
POST https://TEXT_POD-8010.proxy.runpod.net/ea/launches
Authorization: Bearer <TEXT_WORKER_CONTROL_KEY>
Content-Type: application/json
```

```json
{
  "version": 1,
  "audience": "https://96a96f5d168eb13f495f30f74e287851.perchance.org",
  "text": {
    "baseUrl": "https://TEXT_POD-8010.proxy.runpod.net/ea",
    "token": "<TEXT_BROWSER_TOKEN>",
    "model": "ember-qwen-27b"
  },
  "image": {
    "baseUrl": "https://IMAGE_POD-8010.proxy.runpod.net/ea",
    "token": "<IMAGE_BROWSER_TOKEN>",
    "model": "krea/Krea-2-Turbo"
  },
  "pollIntervalMs": 1000
}
```

Control requests come from the launcher, without a browser Origin header.
The registering worker verifies its own lane against its configured identity.
Launcher must verify the other worker's identity/readiness before registering.
Response HTTP 201:

```json
{"baseUrl":"https://TEXT_POD-8010.proxy.runpod.net/ea","ticket":"<ONE_USE_TICKET>"}
```

Build the launch URL using `launchUrl(baseUrl, ticket, gameUrl)` exported by
`direct-worker.cjs`, or equivalent URL parameter encoding:

```text
https://perchance.org/emberquest?emberDirect=<ENCODED_HTTPS_BASE_URL>&emberTicket=<ONE_USE_TICKET>
```

Use the exact public/private audience corresponding to the chosen page. Do not
send `emberHosting` too. EA redeems the ticket with `POST /ea/claim`, JSON
`{"ticket":"..."}`, from its actual iframe. The ticket is consumed once,
only for its audience. Both text and images share one claim. EA strips the
ticket from its own frame URL, retains the public direct-mode marker so a
reload cannot silently fall back to Perchance, and keeps tokens only in memory;
it does not overwrite saved settings. The top-level Perchance URL can still
contain the spent ticket. Treat unspent tickets as secrets; do not log them.
Reloading requires opening EA from the launcher with a fresh ticket. Register
a fresh ticket without restarting models or repeating inference tests.

No importing keys, copying endpoints, or second Launch button is needed.
The existing query forwarding into the actual iframe must be verified for
these new parameters on the published build. Fragment forwarding is not used.

## Job protocol

All browser calls use HTTPS, `credentials: omit`, `redirect: error`, no referrer,
and `Authorization: Bearer <ROLE_BROWSER_TOKEN>` after the claim. Every route
supports unauthenticated OPTIONS for its exact configured audience, methods
POST/GET, and Content-Type/Authorization. Successful and error responses carry
the exact allowed origin, `Vary: Origin`, and `Cache-Control: no-store`.

Submit once: `POST <role.baseUrl>/jobs`. Body:

```json
{
  "id": "<CLIENT_UUID_V4>",
  "role": "text",
  "input": {"instruction":"...","startWith":"","stopSequences":[]}
}
```

For image input use the existing canonical
`{"prompt":"...","negativePrompt":"...","seed":42,"width":832,"height":1216}`.
EA chooses a concrete random seed when requested; the direct API rejects -1.
Do not change a supplied explicit seed. Default portrait is 832×1216, square
1024×1024. Existing worker dimension/attempt restrictions remain authoritative.

Return HTTP 202 promptly, before inference completes:

```json
{"id":"<SAME_UUID>","status":"queued","result":null,"error":null}
```

Poll `GET <role.baseUrl>/jobs/<UUID>`. Always return exactly the four fields
above. Status is `queued`, `running`, `completed`, `failed`, or `cancelled`.
Completed result is exactly `{"text":"..."}` or
`{"image":"data:image/png;base64,..."}`. Failed result is null with a nonempty
error string. Other statuses have null result/error. No aliases or partial
results. A mismatched ID is rejected. The worker adapts its model's OpenAI or
SGLang response to this canonical result using the existing adapters.

EA retries status **reads** after temporary network errors while keeping the
same job pending. It never repeats an inference POST. An uncertain submission
reports its preselected job ID for host inspection; no automatic new job is
created. `POST .../jobs/<UUID>/cancel` with `{}` explicitly cancels that job's
adapter request. A closed submission/status socket never cancels inference.
Whether cancellation stops engine computation depends on the upstream engine;
existing billing/attempt accounting must not be refunded based on a closed socket.

The reference exposes launcher-only `GET /ea/usage` with its control key,
without Origin. It reports accepted/pending job counts per configured role.
Reconcile this with the original image worker's authoritative session ledger,
including standalone tests and failed/uncertain accepted attempts. Do not use
the old local relay counter as the sole gameplay ledger.

## Verification and desktop reply

Free protocol checks in the normal repo:

```text
node --test tools/test-direct-hosting.cjs tools/test-hosted-generation.cjs
```

They exercise real local HTTP handlers and the actual EA wrappers using
fixtures. They do not prove RunPod proxy CORS or real browser inference.

After updating the desktop launcher/workers, reply with the implemented files,
protocol differences (if any), public origin/port configuration, and non-secret
test results. Do not provision resources or repeat paid inference merely to
collect that reply. A later authorized live test must use the actual published
EA iframe and confirm text and image requests in its Network panel go directly
to the worker HTTPS domains, with no localhost requests. Keep cleanup guards
and original session limits active.

Why asynchronous jobs: RunPod documents a 100-second HTTP proxy timeout, so
long model work must outlive the short submission/status requests:
https://docs.runpod.io/pods/configuration/expose-ports