# Verification

Current profile-removal/settings build: `ea-d101bbdd6ccbfddf`.

The profile-removal/settings update is newer than the full-suite results below. Its Node settings-contract checks and assembled JavaScript syntax checks passed. Browser smokes were updated but have not been rerun for that update.

Verified 2026-09-18. The final `npm test` run exited successfully.

- Release build: `ea-deabf997d14ca7d1`.
- Private test build: `ea-d10798b2fd7cedf1`.
- Runtime tests: 74 passed, 0 failed.
- Local browser smokes: 133 passed, 0 failed; completed at 2026-09-18T05:22:06.192Z.
- Actual Perchance checks: 48, 49, and 110 passed on the private test build. These made real hosted text/image requests in an isolated, unsaved test generator.
- Total retained smoke checks: 136 passed.
- Current content validation: 366/366 passed (364 bundled characters and two current-schema examples).

The local runner blocks external requests and starts a fresh Edge browser for each smoke. It waits for application readiness and the library UI before interaction. Results are written to `test-output/local-tests.json`; content results to `test-output/content-validation.json`; live results to `test-output/live-acceptance.txt`.

The release preview was also checked for the library, settings, character creation/editor, starting states, outfits, body customization, and discard-progress confirmation. It was left running as a normal Perchance preview without the acceptance overlay.

Repeated source/content reviews covered application fragments, workers, schemas, fixtures, documentation, bundled definitions, and assets. The copy uses independent storage names, has no configured public-hosting destination, and retains all 37 application manifest fragments.

The 54 older story files are retained as reference material. They are not certified as current-schema imports and are not automatically loaded. Use the strict authoring guides and current examples for new imports.
