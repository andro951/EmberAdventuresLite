# EmberAdventuresLite Persistence Diagnostic

This is an isolated implementation of the proposed normalized IndexedDB save
backend. It does not load or modify the production EmberAdventuresLite UI or its
existing database.

## Run

1. Run `Build Diagnostic.bat` after changing `SAVE_STORAGE_SCHEMA_JSON.txt`.
2. Run `Start Diagnostic.bat`.
3. Open `http://127.0.0.1:4178/`.
4. Select **Run all tests**.

The generated `schema-contract.js` is the executable schema contract. Do not
edit it directly.

## Covered Behavior

- All 77 object stores and declared indexes
- Required, unknown, scalar, enum, range, Blob, and record-size validation
- Small, typed domain operations converted to bounded record writes
- Every implemented domain-operation family and a representative record in every store
- Ordered save/session/change protocol with out-of-order buffering
- Atomic record writes and commit cursor updates
- Duplicate reward invocation rollback and simulated quota-failure repair
- Retained foreground transactions until worker acknowledgement
- Crash-before-commit and crash-after-commit recovery
- Time-sliced transfer of large transactions and replacement during partial transfer
- Five-second watchdog recovery and hidden-page suppression
- Exclusive active-save ownership across controllers/tabs
- Incremental message paging and a 5,000-message history scaling check
- A 2,000-record initial save, 500-operation atomic change, and 8 MiB Blob round trip
- Ordered closeout/reopen behavior
- Chunked save loading and batched save deletion without deleting shared image assets
- Main-thread delay gates at 16.7 ms, with 8.33 ms samples reported
- Final orphan-request and retained-session checks

Domain transactions contain from 1 through 500 operations. Larger setup or
maintenance work must use ordered bounded transactions. Transfers above 50
operations are streamed to the worker in time-sliced chunks and assembled there
before one atomic IndexedDB commit.

The diagnostic deliberately has no migration or backward-compatibility path.
