# EmberAdventuresLite storage contract

The authoritative record definitions are in [SAVE_STORAGE_SCHEMA_JSON.txt](SAVE_STORAGE_SCHEMA_JSON.txt). The generated runtime contract is `src/persistence/schema-contract.js`. Persistence runs in a dedicated worker, validates records strictly, and uses the independent `EmberAdventuresLiteRuntimeV1` database.
