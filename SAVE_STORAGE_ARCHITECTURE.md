# EmberAdventuresLite storage architecture

The authoritative store/field/index contract is `SAVE_STORAGE_SCHEMA_JSON.txt`. `SAVE_STORAGE_SCHEMA.md` is generated from it. The current contract contains 77 stores. Do not implement a record from an older design example or add aliases/defaults to make malformed data load.

## Ownership

The dedicated persistence worker owns IndexedDB. The page/controller sends canonical commands and displays failures; it does not open a competing database connection or fall back to localStorage for saves. Lite owns separate application/runtime database names, profiles and settings.

The library worker handles public-library transport, cached metadata and canonical library operations. Shared network files cross the explicit shared-format adapter before Lite validation. Native imported/authored/editor/storage data uses the exact Lite schema. AI-generated structured output has the separately scoped repair boundary before the same canonical validation.

## Saves and transactions

Immutable story/character definitions are separate from mutable runtime state. Save-owned records reference exact save/character/scene IDs. NPC shells and inspected full characters keep matching stable IDs. Scene membership, images, equipment, inventory, clocks, world state, objectives and messages use their documented stores rather than a second full-state authority.

Routine saves project changed owners, coalesce revisions and commit their records/index/pointer changes atomically. A blocking flush confirms that the latest queued revision is durable. A failed transaction must report its precise error and permit a valid replacement; it must not silently discard records or repair canonical input.

Loading and portable export may reconstruct the complete runtime view. Those costs do not justify serializing or rewriting a complete save during each routine mutation. Editing/rollback uses the recorded checkpoint and ordered mutations, preserving exact runtime references.

## Images and portable files

Image assignment metadata is separate from durable image assets/blobs and generation records. Pending requests are persisted before completion. A failed or cancelled request must not overwrite a later successful generation. Imported/exported archives preserve referenced assets, exact ownership and checksums without introducing unrelated fields.

Scene records retain summary and image action; scene membership is stored separately. Consult the generated field catalog for the exact record shape. Neither a UI projection nor a prompt cache is canonical save state.

## Diagnostics and verification

The private build uses isolated diagnostic database contracts. The standalone `save-storage-diagnostic` tool is a developer aid and must not open player databases. Tests use synthetic identities and clean up their own records/processes.

Node fixture checks, compilation and browser runtime verification are distinct. Current evidence and remaining live checks are in `docs/verification.md`; smoke numbers are in `EMBERADVENTURES_SMOKE_INDEX.md`.