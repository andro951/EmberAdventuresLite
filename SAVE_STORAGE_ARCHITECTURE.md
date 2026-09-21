# EmberAdventuresLite Save Storage Architecture

## Purpose

This document defines the target save architecture for the new EmberAdventuresLite
backend. The primary requirement is that routine saving must be extremely fast.
Loading may perform more work when that tradeoff avoids repeated work during
play.

The authoritative IndexedDB object-store contract, including every persisted
field, primary key, foreign key, and index, is defined in
[`SAVE_STORAGE_SCHEMA_JSON.txt`](./SAVE_STORAGE_SCHEMA_JSON.txt). That file
always wins when a store name, record shape, field name, key, or index in this
document differs from it. `SAVE_STORAGE_SCHEMA.md` and the Store Catalog and
record-shaped examples below predate the final contract and are retained only
as design history; they must not be used to generate production stores or
repositories.

The central rule is:

> Persist only the records that changed. Never build, clone, scan, diff,
> stringify, validate, or rewrite a complete save during routine play.

IndexedDB object stores are used like schema-controlled tables. Records are
kept deliberately small. Large collections and independently mutable nested
objects are stored as separate records rather than embedded inside a save or
character document.

## Non-Negotiable Requirements

1. A new message inserts new message records. It does not rewrite chat history.
2. An affection change updates one relationship record. It does not rewrite a
   character, outfits, clothing, facts, images, or the save.
3. A clothing change updates the one small fixed-slot equipment record and any
   item ownership records affected by that operation. It does not rewrite the
   character or outfit collection.
4. An outfit edit updates one fixed-slot outfit record.
5. Learning a fact inserts one fact record.
6. Completing an objective updates one sparse objective-runtime record and the
   reward records changed by that completion.
7. Immutable story definitions are never copied into mutable saves.
8. Image binary data is never embedded in save records or chat records.
9. Routine save work runs in the persistence worker. IndexedDB is not accessed
   by gameplay code on the main thread.
10. No fallback may silently perform a whole-save write.
11. No routine save operation may walk the objective tree, message history,
    character registry, image library, or arbitrary game state.
12. Save mutations affecting multiple records commit atomically in one
    IndexedDB transaction.

## Ownership Model

### Main thread

The main thread owns the live UI-facing runtime state and coordinates turns. It
performs only small, bounded mutations. It sends explicit persistence
transactions to the persistence worker.

The main thread must not:

- Serialize the complete runtime.
- Send the complete runtime to a worker after each change.
- Generate a diff by comparing complete state objects.
- Wait synchronously or block rendering while persistence runs.
- Mutate stored records without going through the persistence transaction API.

### Persistence worker

The persistence worker is the only writer for save-related IndexedDB stores. It:

- Receives ordered domain transactions describing what changed.
- Converts domain operations into normalized record operations.
- Preserves transaction order per save.
- Commits related mutations atomically.
- Reports the committed session/change cursor.
- Loads and reconstructs saves.

The worker does not need to receive or retain one giant save object. Its source
of truth is the normalized records in IndexedDB plus its small pending-write
queue.

This worker has no gameplay responsibility. It does not decide objective
results, rewards, routes, relationships, clothing changes, image behavior, or
any other game rule. Its complete responsibility is:

1. Be told what changed in runtime state.
2. Convert that domain change into storage-record operations.
3. Update the stored save in strict session/change order.
4. Load stored records when a save is opened.

Import, validation, compilation, export construction, compression, asset
processing, and other heavy maintenance work use other workers so they cannot
delay the save queue.

### Immutable story worker/storage

Validated compiled story definitions are stored separately from saves. A save
header references one immutable definition ID. The following remain outside the
mutable save:

- Main objective definitions and graph structure.
- Authored character definitions.
- Future-cast definitions.
- Authored locations and location hierarchy.
- Authored shops, reward bundles, and item definitions.
- Opening content and static story guidance.
- Validation and compilation indexes that can be rebuilt.

## Database Scope

Use one EmberAdventuresLite IndexedDB database with shared object stores. Do not
create stores or databases per save. Every save-owned record includes `saveId`,
and every save-owned store has a `bySave` index.

Compound keys are shown as arrays because IndexedDB supports compound key paths.
Stable IDs must use the game's central stable-ID helpers.

## Store Catalog

> **Superseded record examples:** This catalog is not the storage schema. Use
> `SAVE_STORAGE_SCHEMA_JSON.txt` for all store names, fields, keys, indexes,
> ownership, and required/optional decisions. The material below preserves the
> reasoning that led to normalization but must not be implemented literally.

### Application and immutable content

These stores are not part of a mutable game save.

#### Application settings

Player preferences are stored in the application settings record
`emberadventures-lite-settings-v2`, independently of individual saves. There is
no active user profile. The unused `profiles` store is not read by settings startup; current preferences use the standalone settings record.
Old records remain available for recovery and are not part of current exports.

#### `storyDefinitions`

Key: `storyDefinitionId`

Stores validated, compiled, immutable story definitions. A changed story creates
a new definition ID/version rather than changing the definition used by an
existing save.

#### `authoredCharacterDefinitions`

Key: `characterDefinitionId`

Stores immutable finalized authored character definitions when they are shared
outside one compiled story definition.

#### `assetBlobs`

Key: `assetId`

Stores image/audio blobs independently from saves. Save records contain asset
IDs only. Deleting a story or save must not delete shared assets. Asset cleanup
is a separate reference-aware maintenance operation.

### Save identity and small global runtime

#### `saveHeaders`

Key: `saveId`

One small record per save:

```js
{
    saveId,
    storyDefinitionId,
    profileId,
    displayName,
    contentMode,
    createdAt,
    metadataUpdatedAt,
    lifecycleState
}
```

This record is used by Load Adventure lists without loading the game. It is not
rewritten for every gameplay change.

#### `saveCommitState`

Key: `saveId`

Index: `byLastCommittedAt`: `lastCommittedAt`

One tiny commit cursor per save:

```js
{
    saveId,
    sessionNumber,
    committedChangeId,
    isOpen,
    lastCommittedAt
}
```

`sessionNumber` starts at zero before the save has ever been opened for play and
increments once for each new play session. `committedChangeId` starts at zero
for the new session and increments for every atomic state-change transaction in
that session. The tuple `(saveId, sessionNumber, committedChangeId)` is the
durable commit cursor and unique transaction identity. All three IDs are
numeric. There is no separate session ID or transaction ID.

Worker replacement during an existing open session does not increment
`sessionNumber`; it resumes the persisted session and reconciles its committed
change ID. Closing and later reopening the save creates the next session number.

`isOpen` belongs in this small session record rather than general save metadata.
It is persistence-session state, and activation/closeout must update it
atomically with the commit cursor. General lifecycle metadata such as deleting,
corrupt, or archived remains in `saveHeaders`.

This record intentionally changes on every committed transaction. It is kept
separate so those tiny cursor writes never rewrite save metadata or runtime
state. Load Adventure ordering uses `lastCommittedAt` from this store and joins
it with the small `saveHeaders` record.

#### `saveRuntime`

Key: `saveId`

One intentionally small record for values that genuinely change together:

```js
{
    saveId,
    turnNumber,
    gamePhase,
    selectedPlayerCharacterId,
    activeLocationId,
    activeObjectiveId,
    autoPlayerEnabled,
    gameEndingState,
    lastMessageSequence,
    lastImageSequence
}
```

This record must remain small. New collections or character data may not be
added to it.

### Messages

#### `messages`

Key: `[saveId, messageId]`

Indexes:

- `bySaveSequence`: `[saveId, sequence]`
- `bySaveTurn`: `[saveId, turnNumber, sequence]`

One record per completed message. It contains message identity and small
metadata, but no image blobs and no unrelated state snapshots.

```js
{
    saveId,
    messageId,
    sequence,
    turnNumber,
    role,
    status,
    createdAt,
    completedAt,
    speakerIds,
    textLength
}
```

#### `messageChunks`

Key: `[saveId, messageId, chunkSequence]`

Index: `byMessage`: `[saveId, messageId, chunkSequence]`

Message text is stored in bounded chunks. This supports append-only streaming
without rewriting an increasingly large response on every checkpoint.

- Player and short system messages normally use one chunk.
- Streaming assistant text appends bounded chunks.
- The final partial chunk may be replaced while streaming.
- Completed messages do not need to be consolidated during active play.
- Optional consolidation is a background maintenance task only.

#### `messageAssets`

Key: `[saveId, messageId, assetId, placementId]`

Index: `byMessage`: `[saveId, messageId, placementOrder]`

Connects messages to image records without embedding image metadata or blobs in
messages.

### Characters and NPCs

#### `runtimeCharacterDefinitions`

Key: `[saveId, characterId]`

Stores definitions created during play. Authored definitions remain in immutable
story/character storage and are referenced by ID. Runtime-generated definitions
are immutable after creation; mutable information belongs in the stores below.

#### `characterRuntime`

Key: `[saveId, characterId]`

Index: `bySaveLocation`: `[saveId, locationId, characterId]`

One small record per character:

```js
{
    saveId,
    characterId,
    definitionId,
    characterKind,
    locationId,
    activeOutfitId,
    voiceName,
    presentation,
    lifecycleState
}
```

Do not add outfits, clothing, relationships, facts, images, inventory, or large
custom objects to this record.

#### `characterRelationships`

Key: `[saveId, sourceCharacterId, targetCharacterId]`

Indexes:

- `bySource`: `[saveId, sourceCharacterId]`
- `byTarget`: `[saveId, targetCharacterId]`

One relationship record contains the small group of values normally read and
changed together:

```js
{
    saveId,
    sourceCharacterId,
    targetCharacterId,
    trust,
    affection,
    attraction,
    relationshipState,
    updatedTurn
}
```

An affection change rewrites only this record.

#### `characterFacts`

Key: `[saveId, characterId, factId]`

Indexes:

- `byCharacter`: `[saveId, characterId]`
- `byFact`: `[saveId, factId]`

One record per known fact:

```js
{
    saveId,
    characterId,
    factId,
    value,
    learnedAtTurn,
    sourceType,
    sourceId
}
```

Learning or forgetting a fact inserts or deletes one record. Facts are never an
array embedded in a character record.

#### `characterStats`

Key: `[saveId, characterId, statId]`

Index: `byCharacter`: `[saveId, characterId]`

One independently mutable stat per record. This supports story-defined stat
names without rewriting a complete stats object.

#### `characterFlags`

Key: `[saveId, characterId, flagId]`

Index: `byCharacter`: `[saveId, characterId]`

Sparse character-specific boolean, scalar, or small-value state. Absent records
mean the story-defined/default value applies.

#### `characterOutfits`

Key: `[saveId, characterId, outfitId]`

Index: `byCharacter`: `[saveId, characterId]`

Outfit metadata only:

```js
{
    saveId,
    characterId,
    outfitId,
    name,
    description,
    createdAtTurn,
    sourceType,
    sourceId
}
```

The character does not store an `outfitIds` array. The `byCharacter` index is the
outfit list. Adding or deleting an outfit therefore does not rewrite the
character-runtime record.

#### `outfitSlots`

Key: `[saveId, characterId, outfitId, slotId]`

Index: `byOutfit`: `[saveId, characterId, outfitId]`

One record per populated outfit slot. Editing one slot does not rewrite the
other slots. Deleting an outfit deletes its slot records in the same transaction.

#### `currentClothingSlots`

Key: `[saveId, characterId, slotId]`

Index: `byCharacter`: `[saveId, characterId]`

One record per currently worn clothing slot. Removing a shirt deletes the shirt
record. Equipping an outfit atomically replaces the affected slot records and
updates `characterRuntime.activeOutfitId`.

#### `characterImages`

Key: `[saveId, characterId, imageRole, presentation]`

Index: `byCharacter`: `[saveId, characterId]`

Stores only image assignment information and `assetId`. The image blob and
general generation record remain separate.

### Scene and world runtime

#### `sceneRuntime`

Key: `saveId`

One small scene record:


Scene summary may be stored in chunks if it becomes unbounded. Scene membership
is not embedded here.

#### `sceneMembers`

Key: `[saveId, memberKind, characterId]`

Indexes:

- `bySave`: `saveId`
- `byKind`: `[saveId, memberKind]`

One presence record per player, party member, or NPC in the scene. Adding or
removing one character does not rewrite a presence array.

#### `worldLocationRuntime`

Key: `[saveId, locationId]`

Index: `bySave`: `saveId`

Sparse mutable overrides for authored locations. Static location definitions
remain immutable.

#### `worldEntityRuntime`

Key: `[saveId, entityType, entityId]`

Index: `byType`: `[saveId, entityType]`

Sparse runtime state for mutable world entities that do not justify dedicated
stores. Values must remain bounded; growing collections use their own records.

### Story-owned flexible state

Arbitrary story state must remain flexible without forcing a large
`story_inventory` or `state` object to be rewritten.

#### `storyValues`

Key: `[saveId, pathKey]`

Index: `byNamespace`: `[saveId, namespace]`

One scalar or bounded value per canonical path:

```js
{
    saveId,
    namespace: "story_inventory",
    pathKey: "story_inventory.hearth_pack_first_lead",
    value: "worker",
    updatedTurn
}
```

Objects submitted to this store must be small value objects that change as one
unit. Independently mutable or growing children must be flattened into their own
records.

#### `storyListItems`

Key: `[saveId, listPathKey, itemId]`

Indexes:

- `byList`: `[saveId, listPathKey, orderKey]`
- `byNamespace`: `[saveId, namespace]`

One record per item in a story-owned list. Adding or removing a list item does
not rewrite the list. `itemId` must be stable. `orderKey` is used only for lists
whose order matters.

#### `storyMapEntries`

Key: `[saveId, mapPathKey, entryKey]`

Index: `byMap`: `[saveId, mapPathKey]`

One record per independently mutable entry in a story-owned dictionary/map.
This avoids storing a potentially large nested custom object as one record.

### Objectives, routes, and rewards

#### `objectiveRuntime`

Key: `[saveId, objectiveId]`

Indexes:

- `byStatus`: `[saveId, status]`
- `byUpdatedTurn`: `[saveId, updatedTurn]`

Sparse runtime only:

```js
{
    saveId,
    objectiveId,
    status,
    progress,
    selectedOutputId,
    startedTurn,
    completedTurn
}
```

Objective definitions, requirements, outputs, rewards, dialogue, and graph links
remain in the immutable compiled story definition.

#### `rewardInvocations`

Key: `[saveId, invocationId]`

Index: `bySource`: `[saveId, sourceType, sourceId]`

Stores successful idempotency markers only. The marker and all reward effects
must commit in the same transaction. Failed transactions must not leave a
marker.

#### `generatedJobDefinitions`

Key: `[saveId, jobId]`

Runtime-generated job definitions are immutable after creation and separate from
the authored main objective tree.

#### `generatedJobSteps`

Key: `[saveId, jobId, stepId]`

Index: `byJob`: `[saveId, jobId]`

Immutable generated-job step definitions.

#### `generatedJobRuntime`

Key: `[saveId, jobId]`

Index: `byStatus`: `[saveId, status]`

Mutable job-level progress.

#### `generatedJobStepRuntime`

Key: `[saveId, jobId, stepId]`

Index: `byJob`: `[saveId, jobId]`

Sparse mutable step progress.

### Inventory, items, and shops

#### `runtimeItemDefinitions`

Key: `[saveId, itemId]`

Stores immutable definitions for items created during play. Authored item
definitions remain in immutable story storage.

#### `inventoryEntries`

Key: `[saveId, ownerType, ownerId, itemId, instanceId]`

Indexes:

- `byOwner`: `[saveId, ownerType, ownerId]`
- `byItem`: `[saveId, itemId]`

One record per unique item instance or stack. Quantity changes rewrite only the
stack record. Adding an item inserts one record.

#### `shopRuntime`

Key: `[saveId, shopId]`

Sparse shop-level state such as open/closed status and refresh sequence. Static
shop definitions remain immutable.

#### `shopStockEntries`

Key: `[saveId, shopId, stockEntryId]`

Index: `byShop`: `[saveId, shopId]`

One runtime stock entry per item, outfit, character, or service. Purchasing or
removing one entry does not rewrite the shop.

### Images and background requests

#### `images`

Key: `[saveId, imageId]`

Indexes:

- `bySaveSequence`: `[saveId, sequence]`
- `byStatus`: `[saveId, status]`
- `byOwner`: `[saveId, ownerType, ownerId]`

Contains image metadata, prompt, request status, ownership, and `assetId`. It
never contains the binary image itself.

#### `imageRequests`

Key: `[saveId, requestId]`

Index: `byStatus`: `[saveId, status, queuedSequence]`

Persisted queue state allows missing, interrupted, failed, and timed-out image
requests to be recovered without scanning every character or message.

### Timed events and external integrations

#### `timedEventRuntime`

Key: `[saveId, timedEventId]`

Index: `byDueOrder`: `[saveId, dueTurn, timedEventId]`

Sparse state for scheduled/triggered authored timed events.

#### `deviceRuntime`

Key: `[saveId, integrationType, bindingId]`

Only story-specific durable bindings belong here. Ephemeral connection state and
credentials must not be placed in a save.

### Optional diagnostics and recovery

#### `saveMutationLog`

Key: `[saveId, sessionNumber, changeId]`

Stores a bounded diagnostic summary, not state payloads:

```js
{
    saveId,
    sessionNumber,
    changeId,
    transactionType,
    affectedRecordKeys,
    committedAt
}
```

This log is optional and capped. It exists for diagnosis, not state replay.

#### `saveCheckpoints`

Checkpoints are not part of routine persistence. If retained for emergency
recovery, they are produced in a worker at explicit milestones and kept under a
strict count/size limit. They must not be generated after every turn and must
not contain asset blobs or immutable story definitions.

## Mutation Protocol

Gameplay systems must persist changes through typed domain mutations. They must
not submit an entire state object or arbitrary whole-save JSON Patch document.

Example mutation envelope:

```js
{
    saveId: 27,
    sessionNumber: 9,
    changeId: 41,
    transactionType: "objective-completion",
    operations: [
        {
            type: "objective.runtime.set",
            objectiveId: "travel-hearthcross",
            values: {
                status: "completed",
                selectedOutputId: "arrive",
                completedTurn: 18
            }
        },
        {
            type: "story.value.set",
            pathKey: "story_inventory.hearth_pack_first_lead",
            value: "worker"
        },
        {
            type: "reward.invocation.add",
            invocationId: "objective-travel-hearthcross--arrive"
        }
    ]
}
```

One change ID represents one logical atomic transaction, not one field. A
transaction may contain several domain operations when one gameplay action must
commit all of its effects together.

A live domain transaction contains from 1 through 500 operations. The
controller rejects larger transactions before assigning a change ID. Transfers
above 50 operations are posted to the persistence worker in time-sliced chunks;
the worker assembles them and performs one atomic IndexedDB commit. Bulk fixture,
setup, and maintenance work that exceeds the limit uses multiple ordered
transactions instead of creating an unbounded atomic commit.

Domain operations describe already-decided state changes. They do not ask the
persistence worker to perform gameplay. For example,
`objective.runtime.set` is valid, while `complete-objective-and-choose-rewards`
is not. The gameplay system decides the outcome and sends the resulting domain
changes.

The worker has two deliberately separate stages:

1. The domain converter validates domain-operation shapes and deterministically
   converts them to `add`, `put`, and `delete` operations against normalized
   records.
2. The generic record writer validates store/key access and applies those record
   operations in one IndexedDB transaction.

The generic writer knows nothing about objectives, characters, messages, or
other gameplay concepts. This creates one save-writing path even if the storage
layout changes later.

The persistence worker:

1. Places the transaction in the queue for its `saveId`, `sessionNumber`, and
   `changeId`.
2. Waits until it is the next expected change ID for the active save session.
3. Verifies the transaction and domain-operation shapes.
4. Converts domain operations into normalized record operations.
5. Opens one IndexedDB transaction covering exactly the affected stores.
6. Applies all record operations.
7. Updates `saveCommitState.committedChangeId` and `lastCommittedAt` in the same
   transaction.
8. Commits or rolls back the complete operation set.
9. Replies with the committed save ID, session number, and change ID only after
   IndexedDB confirms the commit.

Validation is proportional to the submitted records. Routine persistence must
not revalidate the complete story or save.

## Mutation Examples

### Add a player message

Writes:

- Add one `messages` record.
- Add one `messageChunks` record.
- Update the small `saveRuntime.lastMessageSequence` value.
- Update the tiny save commit cursor.

No previous message is read or rewritten.

### Complete a streamed assistant message

Writes during streaming:

- Append a bounded `messageChunks` record when the current chunk fills.
- Replace only the current incomplete chunk when a persistence checkpoint is
  required.

Final writes:

- Put the final chunk.
- Update the one `messages` metadata record to `complete`.
- Update the save commit cursor.

### Change affection

Writes:

- Put one `characterRelationships` record.
- Update the save commit cursor.

No character definition, runtime, clothing, outfit, fact, image, or inventory
record is touched.

### Equip an outfit

One atomic transaction:

- Delete current clothing slot records that no longer apply.
- Put changed/new `currentClothingSlots` records.
- Put the small `characterRuntime` record with the new `activeOutfitId`.
- Update the save commit cursor.

The outfit definition and unrelated character state are not rewritten.

### Learn a fact

Writes:

- Add one `characterFacts` record.
- Update the save commit cursor.

### Complete an objective

One atomic transaction:

- Put one sparse `objectiveRuntime` record.
- Apply only reward-affected records.
- Add one `rewardInvocations` marker.
- Update `saveRuntime.activeObjectiveId` only if it changes.
- Update the save commit cursor.

The immutable objective tree is not read, normalized, copied, or saved by the
persistence layer.

### Add a story list item

Writes:

- Add one `storyListItems` record.
- Update the save commit cursor.

The containing story object/list is not rewritten.

## In-Memory Runtime Shape

The new backend must not reconstruct one permanently mutable giant object merely
to preserve the old API. Runtime repositories should mirror storage boundaries:

```js
runtime = {
    header,
    saveRuntime,
    sceneRuntime,
    charactersById,
    relationshipsByPair,
    factsByCharacter,
    statsByCharacter,
    outfitsByCharacter,
    clothingByCharacter,
    sceneMembersByKind,
    objectiveRuntimeById,
    storyValuesByPath,
    storyListsByPath,
    inventoryByOwner,
    jobsById,
    shopsById,
    visibleMessages
};
```

Repositories expose selectors and typed mutation methods. Feature code must not
receive unrestricted ownership of the entire runtime or mutate nested objects
silently.

Examples:

```js
relationships.setAffection(characterId, value);
facts.learn(characterId, fact);
clothing.removeSlot(characterId, slotId);
objectives.complete(objectiveId, outputId);
messages.appendChunk(messageId, text);
```

Each method updates its in-memory record and emits the exact persistence
operation for that record.

## Loading Strategy

Loading is allowed to be more expensive than saving, but it must remain off the
main thread and report progress for large saves.

1. Read `saveHeaders` and `saveRuntime`.
2. Resolve and load the immutable `storyDefinitionId`.
3. Load normalized runtime stores in parallel where safe.
4. Build worker-side maps and indexes.
5. Send the main thread a minimal playable shell first.
6. Stream reconstructed character, objective, inventory, and visible-chat data
   in bounded batches.
7. Load only the newest chat page initially; older messages remain paged in
   IndexedDB.
8. Load image metadata separately and image blobs only when needed for visible
   UI or active work.

The main thread applies batches between frames. It must not receive one enormous
structured-clone payload.

## Save Scheduling

Persistence transactions are enqueued immediately when domain mutations commit.
There is no interval autosave, five-second autosave, whole-save debounce, or
periodic save pass. Saving is a continuous stream of ordered state-change
transactions.

- Mutations produced by one logical action are combined into one transaction.
- Independent transactions remain ordered by save session and change ID.
- Repeated puts to the same record may be coalesced only while still pending and
  only when no intervening transaction depends on the earlier value.
- Append/add/delete operations are never discarded by generic coalescing.
- The game loop may await durability before advancing a dependent phase, but
  awaiting a worker promise must not block input, rendering, scrolling, audio,
  or device scheduling.
- Switching saves, deleting a save, export, and page shutdown request a queue
  flush.

### Per-save change queues

Sessions and change IDs are independent per save. The worker maintains a map of
queue states:

```js
const queuesBySaveId = new Map();

// Conceptual value stored in queuesBySaveId.
{
    saveId,
    sessionNumber,
    committedChangeId,
    nextExpectedChangeId,
    pendingByChangeId: new Map(),
    processing: false
}
```

The worker also caches direct references for the active save so normal writes do
not repeatedly perform map lookups:

```js
let activeSaveId = null;
let activeQueue = null;
```

`pendingByChangeId` is a `Map`, not an array. It permits defensive buffering of
an out-of-order transaction and provides constant-time lookup of the next
expected change ID.

All change IDs are assigned by one central main-thread sequencer before posting
to the worker. With one `MessagePort`, normal transactions should therefore
arrive in order. Out-of-order buffering exists for retries, worker restart, and
diagnosis; it is not the expected normal path.

When the worker receives a transaction:

1. Find or create its queue state by `saveId`.
2. Verify that its `sessionNumber` matches the currently accepted activation of
   that save.
3. Reject a conflicting duplicate change ID.
4. Store a future change in `pendingByChangeId` without processing it.
5. If it is the next expected change ID for `activeQueue`, process it.
6. Continue processing consecutive buffered changes until a gap or closeout
   is reached.

The number and total byte size of buffered transactions are bounded. A change-ID
gap triggers an immediate resend request and diagnostics. The worker never skips
a missing change ID.

### Active save activation and closeout

Only one save session is active for gameplay writes. Transactions for another
save may arrive while the previous save is finishing. They are placed in that
save's `pendingByChangeId` map but are not processed as the active stream until
the previous stream reaches its ordered closeout barrier.

Opening or creating a save establishes:

- `saveId`
- The next persisted `sessionNumber`
- `committedChangeId = 0`
- `nextExpectedChangeId = 1`

The main thread requests activation with a control-plane message:

```js
{
    type: "save.session.activate",
    saveId,
    sessionNumber
}
```

Activation itself is not a game-state mutation and does not consume a change
ID. The worker atomically verifies and increments the persisted session number,
resets `committedChangeId` to zero, and sets `isOpen` to true before
acknowledging activation. If another save is still active,
the request becomes
`pendingActivation`; transactions carrying the requested session number may already
be buffered in that save's queue, but they cannot be written until the current
save's closeout commits. There may be only one pending activation request;
replacing it requires explicit cancellation so rapid UI actions cannot silently
select the wrong save.

The incremented session number prevents a delayed transaction from an earlier
opening of the same save from being accepted after that save is reopened.

Closing or switching a save sends an ordinary change transaction whose
control operation is:

```js
{
    type: "save.session.close"
}
```

The closeout transaction occupies the next normal change ID. It has no gameplay
effect. When it reaches the front of the queue, the worker:

1. Commits every preceding change ID first.
2. Updates `saveCommitState` for the closeout transaction and marks the session
   closed.
3. Clears `activeSaveId` and `activeQueue` if they still reference the closing
   session.
4. Acknowledges the closeout change ID.
5. Activates the explicitly requested next save session and begins processing
   its already-buffered consecutive changes.

The frontend does not consider a save switch complete until it receives the
closeout acknowledgement. It may immediately display a loading transition and
send the next save's activation/request messages; those messages can safely wait
in the new save's queue.

After closeout, a normal mutation carrying the closed session number is an error.
It must not remain buffered forever. Reopening that save creates a new session
number, then begins that session's change IDs at 1. A
worker replacement is not a reopen: it resumes the current persisted session and
continues from `committedChangeId + 1`.

Deleting an active save first requires a successful closeout. Export and delete
are handled by maintenance workers only after the persistence worker confirms
the relevant save has no uncommitted changes.

### Delivery, acknowledgement, and retry

Worker messaging is reliable and FIFO for messages posted by one live sender to
one live worker. Routine out-of-order or silently lost messages are not expected.
The architecture must still recover from worker termination, page navigation,
out-of-memory failure, structured-clone errors, uncaught worker errors, and the
worker committing IndexedDB immediately before its acknowledgement is lost.

The main thread keeps:

```js
const unacknowledgedBySaveId = new Map();
// saveId -> Map<changeId, transaction> for the active session
```

Transactions remain there until commit acknowledgement. On timeout or worker
restart, the main thread asks for each save's persisted `saveCommitState` and
resends only later change IDs from the matching session. Receiving a transaction
at or below the committed change ID for the same session returns an
already-committed acknowledgement and never reapplies its effects. Conflicting
payloads received for the same save/session/change tuple are fatal sequencing
errors. The tuple itself is the transaction identity.

### Main-thread pending transaction ownership

The main thread retains every submitted transaction until the persistence worker
acknowledges that IndexedDB committed it. Its structure mirrors the worker's
per-save organization:

```js
const pendingSavesById = new Map();

// Conceptual value stored in pendingSavesById.
{
    saveId,
    sessionNumber,
    nextChangeId,
    lastAcknowledgedChangeId,
    unacknowledgedByChangeId: new Map(),
    inverseByChangeId: new Map()
}
```

The main thread performs this sequence:

1. Assign the next change ID through the one central sequencer.
2. Store the immutable transaction envelope in
   `unacknowledgedByChangeId` before calling `postMessage`.
3. Store the small optimistic inverse operation set when rollback is possible.
4. Post the transaction to the worker.
5. Keep both entries until commit acknowledgement.
6. Remove acknowledged transaction and inverse entries only after the worker
   reports the matching `saveId`, `sessionNumber`, and `changeId`.

If `postMessage` throws, the transaction remains pending and the failure is
reported. Acknowledgements with the wrong save, session, or change ID are
rejected.

After worker restart, the main thread asks the replacement worker to read each
affected save's persisted `saveCommitState`. It removes pending changes at or
below the confirmed change ID for that session, then resends higher changes in
order. Because IndexedDB transactions are atomic, a worker interruption leaves
each change transaction either fully committed or fully absent.

If the worker committed a change and stopped before acknowledging it, the
replacement worker reports the persisted commit cursor and the main thread treats it
as committed without applying it again.

This in-memory pending map protects against worker failure, not page/process
failure. If the page itself is destroyed, only acknowledged IndexedDB commits
are guaranteed to survive. Game-loop phases that must be durable before
continuing await acknowledgement asynchronously. Save switching and deliberate
page-level navigation require a successful closeout acknowledgement. Browser or
device crashes can still lose the very small window of unacknowledged work.

### Worker health and liveness

Worker failure is observed through several independent signals:

- `worker.onerror` detects uncaught worker exceptions and startup/script errors.
- `worker.onmessageerror` detects messages that could not be deserialized.
- Synchronous `postMessage` exceptions detect structured-clone and transfer
  failures before delivery.
- One five-second liveness timer detects a worker that stops communicating while
  work is pending.

The watchdog is intentionally simple:

1. The worker emits status whenever its phase changes and acknowledges every
   committed change.
2. During a long operation, the worker emits a small liveness status at least
   once per second even when its phase has not changed.
3. Every message received from the worker, regardless of message type, updates
   one `lastWorkerContactAt` value and resets the same liveness timer.
4. The timer runs only while a transaction, activation, closeout, or load is
   pending.
5. If the worker sends nothing for five seconds while the page is visible, the
   controller replaces it.

There is no separate timer per transaction, no permanent idle heartbeat, and no
special message type that alone counts as proof of life. Any worker communication
proves that its event loop is alive. A worker that dies while idle does not
matter until the next operation; activation or the next transaction starts the
watchdog.

A worker can stop responding without emitting an error event, for example due to
an infinite loop, extreme CPU work, browser suspension, or resource exhaustion.
Therefore, error handlers alone are insufficient.

The worker reports small liveness messages containing:

```js
{
    type: "persistence.health",
    activeSaveId,
    activeSessionNumber,
    committedChangeId,
    currentChangeId,
    phase,
    pendingCount,
    at
}
```

`phase` identifies the last reached boundary, such as `idle`, `converting`,
`opening-transaction`, `writing-records`, `awaiting-indexeddb`, `committed`, or
`loading`. Transaction logs retain phase timestamps so a freeze can be located.

Health evaluation distinguishes two conditions:

1. **Worker unresponsive:** no message for five seconds. The worker event loop
   may be blocked or the worker may have died.
2. **Persistence stalled:** status messages continue, but one transaction does not
   commit. This points to IndexedDB blocking, a transaction/request problem, or
   a logic wait rather than a frozen worker event loop.

A long synchronous worker freeze and a silent worker crash look the same from
the main thread until an error event arrives: both stop messages and liveness
responses. The controller does not need to identify the cause before recovery.
It records the last health phase, terminates the unresponsive worker, starts a
replacement, reconciles persisted commit cursors, and resends uncommitted work.

Timeouts are diagnostic/recovery thresholds, not assumptions that a transaction
completed. A timeout never skips, acknowledges, or duplicates a change ID.
The foreground unresponsive-worker replacement threshold is five seconds.
Slow acknowledgement and phase durations are logged for diagnosis, but they do
not control liveness. The only liveness rule is five seconds without any worker
message while work is pending.

These values are settings and must be measured on target mobile hardware.
Background tabs may throttle or suspend workers, so foreground thresholds do not
trigger destructive restart while `document.visibilityState` is hidden. On
return to the foreground, the controller requests status and reconciles commit
cursors before submitting dependent gameplay work.

The persistence worker is intentionally restricted to small conversion and save
operations so a multi-second conversion is always a defect, not expected work.
Load operations publish progress and phase updates. Heavy import, export,
compression, validation, or gameplay computation cannot run in this worker.

## Transactions and Rollback

Every gameplay action produces one transaction identified by its numeric
`(saveId, sessionNumber, changeId)` tuple. All state changes caused by that action
either commit together or fail together.

Examples requiring cross-store atomicity:

- Objective completion plus rewards plus idempotency marker.
- Shop purchase plus currency removal plus inventory addition plus stock change.
- Outfit deletion plus active-outfit replacement plus current clothing update.
- Future-character promotion plus party membership plus scene presence.
- Choice selection plus objective runtime plus next-route activation.

The main thread may update optimistically. It must retain a small inverse change
set for pending transactions. If persistence fails, only that transaction's
affected records are rolled back. A complete save snapshot is not required.

## Export, Import, and Delete

### Export

After the persistence worker confirms the relevant change is committed, a
separate maintenance/export worker reads all records by `saveId`, joins them with
the referenced immutable definition, and creates the public export structure.
Export may be slower; it is explicit, background work with progress reporting
and cannot delay routine saving.

### Import

Import validation and decomposition run in an import/maintenance worker. A valid
imported save is written directly into normalized stores in bounded transactions
before its persistence session is activated. Import must not place a monolithic
save document into `saveHeaders` or `saveRuntime`.

### Delete

Every save-owned store has a `bySave` index. Deletion iterates each `saveId`
range in a maintenance worker and deletes records in bounded transactions with
progress. An active save must be closed out first. Shared immutable definitions
and asset blobs are retained unless a separate reference-aware cleanup proves
they are unreferenced.

## Record Granularity Rules

Create a separate record when data:

- Has a stable identity.
- Is an item in a growing collection.
- Changes independently from its parent.
- Is queried or loaded independently.
- Is referenced by multiple systems.
- Would cause meaningful unchanged data to be rewritten with its parent.

Small nested values may remain inside one record only when they are bounded,
always loaded together, and normally changed together.

Prohibited record shapes include:

- Arrays of message objects.
- Arrays of character definitions or runtime characters.
- Arrays of outfit objects.
- Arrays of known-fact objects.
- Arrays of objective definitions or objective runtime objects.
- Arrays of image blobs or image metadata.
- A complete `state` or `save` object.
- Any record that embeds the immutable objective tree.

Target record sizes:

- Normal mutable record: under 16 KB.
- Exceptional bounded text/metadata record: under 64 KB.
- Larger text uses chunks.
- Binary data uses `assetBlobs` and is never copied into save records.

## Performance Contract

Routine persistence cost must be proportional to the change, not to playthrough
length.

Expected operation shapes:

| Action | Expected persistence work |
| --- | --- |
| Add message | 2-3 small record writes |
| Append streamed text | 1 chunk add/put |
| Change affection | 1 relationship put |
| Add known fact | 1 fact add |
| Change clothing slot | 1 slot put/delete |
| Edit outfit slot | 1 slot put/delete |
| Add inventory item | 1 entry add/put |
| Complete objective | 1 objective put plus actual reward effects |
| Add scene character | 1 scene-member add |
| Change location | 1-2 small runtime puts |
| Finish image | 1 image put plus 1 asset assignment/blob put |

Routine save processing must contain none of the following:

- `structuredClone(completeSave)`
- `JSON.stringify(completeSave)`
- Full-save hashing
- Full-save validation
- Full objective normalization
- Full character normalization
- Full message traversal
- Recursive diffing
- Rebuilding all runtime indexes

Performance should remain approximately constant as the story and playthrough
grow, except when the actual changed transaction contains more records.

## Failure and Observability Contract

Every persistence transaction logs:

- Save ID, session number, change ID, and transaction type.
- Save ID, session number, and expected/committed change IDs.
- Number of operations by store.
- Queue wait time.
- IndexedDB transaction duration.
- Acknowledgement duration.
- Failure and rollback result.

Logs must not serialize complete record payloads by default.

The worker reports warnings when:

- A normal record exceeds 16 KB.
- A bounded text record exceeds 64 KB.
- A transaction affects an unexpectedly high number of records.
- Queue latency exceeds the configured threshold.
- Session/change ordering is violated.

A developer assertion must reject any routine API attempting to persist a root
`save`, `state`, `messages`, `characters`, `objectives`, or `images` collection.

## Smoke Coverage Required

At minimum, automated coverage must prove:

1. Adding a message does not write prior messages.
2. Streaming appends chunks without rewriting prior chunks.
3. Affection changes touch only the relationship and commit-cursor records.
4. Clothing changes do not write character definitions, outfits, or facts.
5. Outfit-slot edits do not rewrite other slots.
6. Adding/removing facts affects one fact record.
7. Objective completion never writes objective definitions.
8. Reward effects and invocation markers commit or roll back together.
9. Story list/map mutations touch only affected entries.
10. Scene membership changes do not rewrite the scene or character list.
11. Images never place base64/blob data in save/message records.
12. Save/load round trips reconstruct equivalent runtime state.
13. Loading starts with the newest message page and can page older messages.
14. Save deletion removes every save-owned record and preserves shared assets.
15. Concurrent queued transactions commit in session/change order.
16. A failed transaction rolls back optimistic in-memory changes cleanly.
17. Export reconstructs a complete valid portable save.
18. Record-size and forbidden-whole-save assertions fire correctly.
19. Persistence time for one affection update remains effectively constant after
    10, 1,000, and 100,000 accumulated messages.
20. Persistence time for one new message remains effectively constant across
    small and very large stories.
21. Independent save IDs maintain independent session/change streams.
22. A transaction for the next save can arrive early and remains buffered until
    the active save's closeout commits.
23. Closeout commits every preceding change ID before unsetting the active queue.
24. A late transaction carrying a closed session ID is rejected.
25. Reopening the same save uses a new session number/ID and starts its changes
    at 1; worker replacement resumes the persisted session/change cursor.
26. Future changes wait in `pendingByChangeId` and process immediately when
    the missing change ID arrives.
27. A change-ID gap requests retransmission and is never skipped.
28. Worker restart reads committed cursors and safely acknowledges or replays
    unacknowledged transactions without duplicate effects.
29. Conflicting payloads for one save/session/change tuple fail loudly.
30. Export and deletion cannot delay the active persistence queue.
31. The main thread retains transactions until matching commit acknowledgement.
32. A synchronous `postMessage` failure leaves the transaction pending.
33. Worker failure before IndexedDB commit causes the replacement worker to
    replay the change exactly once.
34. Worker failure after IndexedDB commit but before acknowledgement recognizes
    the persisted commit cursor and does not duplicate effects.
35. A responsive worker with a stalled IndexedDB transaction is diagnosed
    differently from an unresponsive worker event loop.
36. A simulated worker hang triggers replacement and ordered change recovery.
37. Hidden-tab throttling does not cause destructive false-positive recovery.
38. Returning to the foreground reconciles committed and pending changes
    before dependent gameplay continues.

## Implementation Order

The new backend is first built as a standalone save-system skeleton with the
plain diagnostic UI defined in `SAVE_STORAGE_SCHEMA.md`. The production
frontend is not connected until the skeleton passes the complete persistence,
ordering, recovery, and load-reconstruction suite.

1. Define record schemas, keys, indexes, and typed repository interfaces.
2. Build the standalone diagnostic UI and worker bootstrap with no production
   game frontend.
3. Build the persistence worker transaction protocol and session/change handling.
4. Implement normalized load reconstruction and paged messages.
5. Implement save headers/runtime and scene stores.
6. Implement messages and message chunks.
7. Implement character runtime, relationships, facts, stats, outfits, slots,
   clothing, and images.
8. Implement objective/reward runtime without mutable definitions.
9. Implement story values, lists, and maps.
10. Implement inventory, shops, jobs, timed events, and image requests.
11. Add transaction rollback, diagnostics, export, import, and deletion.
12. Complete failure injection, high-volume, and reconstruction tests in the
    standalone skeleton.
13. Connect gameplay systems to typed repository mutations one domain at a time.
14. Add the complete production smoke matrix before removing old persistence code.
15. Remove every whole-save persistence and compatibility path.

No backward compatibility or migration layer is required before publication.
Invalid old databases may be deleted and recreated rather than weakening this
architecture.
