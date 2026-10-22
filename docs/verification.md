# Verification — October 22, 2026 rebuild

Release build: `ea-7edd2543a90132e9`.
Private-test build: `ea-2ecbbd50599bcb7e`.

Both builds passed deterministic assembly, JavaScript parsing, and gzip round-trip checks. The generated release page matches `src/`. The current persistence contract has 77 stores, and the smoke index lists 163 scenarios without executing them.

Local checks use current production declarations and canonical validators:

- The complete `npm test` gate covers settings/profiles, appearance, import/export, shared library formats/workers, persistence, state updates, images, HTTPS hosting, log retention, and private fixture producers.
- Authoring validation passes 91 checks, including both ending paths of the short reference story.
- Six larger stories pass 53 character/animal conversions and 144 routing scenarios, rewards, side-quest returns and invalid-input checks.
- All 40 standalone characters, 55 stories and two documentation examples pass canonical validation. Both skill reference exports also pass: 99 exports total.
- Clothing/reference checks cover 826 outfit collections and 2726 clothing records.
- Ollama host/connector tests pass 39 checks. Hosted-provider/launcher tests pass 26 Node checks and 10 Python checks; the separate demo-checkout test is skipped because that checkout is unavailable.
- Both Lite skills pass the skill validator; installed, repository, public-tool copies and ZIP use version 2.0.0.

The current rebuild's browser runtime/smoke suites have not been executed. Tests and the private build are prepared for a separately requested browser run. A stale pre-rebuild content script briefly opened an isolated browser against the old generated page during development; that obsolete result is not release evidence. The content entrypoint is now pure Node validation.

Live Supabase account/publication flows and the published Perchance page's connection to real HTTPS workers remain unverified. Local protocol/HTTP fixtures do not establish live service access or inference quality. No cloud models were provisioned or paid inference requested for these checks. Historical September/earlier-October browser results do not certify this rebuild.

Detailed final Node totals and verification limits are recorded in `rebuild/status.json`. Disposable diagnostic inventories are archived in the task workspace, outside the release repository.