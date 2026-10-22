# Verification — October 22, 2026 rebuild

Release build: `ea-46eaf28bfc498d2d`.
Private-test build: `ea-76e090f4dc4e9396`.

Both builds passed deterministic assembly, JavaScript parsing, and gzip round-trip checks. The generated release page matches `src/`. The current persistence contract has 77 stores, and the smoke index lists 163 scenarios without executing them.

Local checks use current production declarations and canonical validators:

- The complete `npm test` gate covers settings/profiles, appearance, import/export, shared library formats/workers, persistence, state updates, images, HTTPS hosting, log retention, and private fixture producers.
- Authoring validation passes 91 checks, including both ending paths of the short reference story.
- Six larger stories pass 53 character/animal conversions and 144 routing scenarios, rewards, side-quest returns and invalid-input checks.
- All 41 standalone characters, 55 stories and two documentation examples pass canonical validation. Both skill reference exports also pass: 100 exports total.
- Clothing/reference checks cover 828 outfit collections and 2728 clothing records.
- Ollama host/connector tests pass 39 checks. Hosted-provider/launcher tests pass 26 Node checks and 10 Python checks; the separate demo-checkout test is skipped because that checkout is unavailable.
- Both Lite skills pass the skill validator; installed, repository, public-tool copies and ZIP use version 2.0.1.

The user supplied a browser smoke report for the earlier build `ea-7edd2543a90132e9`: 127 passed, 26 failed and seven skipped. The [failure review](rebuild/smoke-report-20261022-fixes.md) records each correction. A later user report for `ea-2163b3b283772f3e` had five failures. After repair, smokes 15, 22, 33, 86 and 152 passed in isolated local Edge on the current source. See the [targeted review](rebuild/failed-smokes-20261022.md) and [results](rebuild/failed-smokes-20261022.json). The user reserved the full suite for their own run; it was not executed here. A stale pre-rebuild content script briefly opened an isolated browser against the old generated page during development; that obsolete result is not release evidence. The content entrypoint is now pure Node validation.

Live Supabase account/publication flows and the published Perchance page's connection to real HTTPS workers remain unverified. Local protocol/HTTP fixtures do not establish live service access or inference quality. No cloud models were provisioned or paid inference requested for these checks. Historical September/earlier-October browser results do not certify this rebuild.

Detailed final Node totals and verification limits are recorded in `rebuild/status.json`. Disposable diagnostic inventories are archived in the task workspace, outside the release repository.

ZIP distribution follow-up: five package/reference/link checks passed, the 91-check authoring gate passed from packaged resources, and canonical content validation passed 98/98 after pulling the new merchant character. The complete Node gate for `ea-2163b3b283772f3e` passed 124 tests with one skipped and zero failures, including nine new smoke-regression checks. Authoring, routing and content checks also pass. That earlier update did not execute browser smokes; the later five-scenario run is recorded above.
Automatic-profile follow-up: Lite creates and selects a profile named Default after storage hydration when no profile exists. Existing profiles and the selected profile are preserved. New Adventure opens the story library directly, and world setup starts at story configuration. The profile/settings/runtime Node checks passed 26/26 on `ea-267f51b881a872ae`; smoke 9 was extended to check persistence and reuse but was not executed.

Failed-smoke follow-up: only the requested five scenarios were run, with a final 5/5 pass and no cleanup failures. A focused Node regression also passed for player-only and mixed player/companion patches. Neither the full Node gate nor the full browser suite was rerun for this change.
