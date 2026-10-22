# October 22 Lite smoke failure review

Input: the user's report for build `ea-7edd2543a90132e9`, started at 18:00 UTC.
It executed 160 scenarios: 127 passed, 26 failed and seven were skipped.
Numbers below refer to that report. The current registry contains 163 scenarios.

| Report numbers | Cause and correction |
| --- | --- |
| 12 | The selectable-player fixture embedded runtime image IDs that were not stored with its authored definition. It now uses complete canonical character/profile defaults. A Node regression exercises the actual fixture producer, story export, runtime materialization and strict image-reference resolver. |
| 14, 15, 22, 32, 71, 85, 149, 152 | `createNewActiveSave` put the definition marker on the worker command itself. Removed it from the command; the worker continues to mark the nested immutable story. A Node regression sends the app's actual command expression through the real worker, validates every generated storage row, and reconstructs runtime state. Unknown command fields still reject. |
| 25, 26, 28, 29 | Assertions expected removed position/clothing controls, removed tuning fields or a content-mode badge. Retained ordinary quick actions, outfit selection, card layout, settings persistence and Image Lab behavior; removed obsolete assertions. |
| 31 | Upload confirmation now uses the ordinary suitability-confirmation dialog. The smoke clicks that dialog and awaits upload completion. Its finally block also restores the save baseline and awaits title-image cleanup, including on failure. |
| 33 | Both featured fixtures are suitable for Lite, but an obsolete assertion required hiding one. Both are now expected. Async assertions reacquire the current rail rather than retaining a detached DOM node. Per-entry import isolation and presentation/cache checks remain. |
| 37 | Genre-picker selectors assumed lowercase option attributes and a removed button class. The test now selects the displayed approved genre and uses the picker owner to apply it. Manual character drafts also lacked the required Lite marker; fixed the producer and added canonical validation coverage. The UI smoke now asserts that saving actually succeeded and preserved list edits and held items. |
| 59 | The outfit fixture asserted a metadata error for a field it did not supply and Lite does not use. It still verifies the invalid supplied contexts and formality through the authoritative validator. |
| 64 | A fixture claimed its messages were pending while manually simulating already-applied state effects. It now models processing messages and requires rollback plus a complete state recheck. Node checks cover pending, processing and synced deletion behavior separately. |
| 75 | Removed actions left assertions with no action to invoke. Removed those empty steps; complete-outfit selection and saving still exercise targeted rendering. |
| 86 | The portrait fixture used an old appearance phrase and old low-coverage work clothing. Updated it to current slider wording and a complete work outfit. Framing, story-text exclusion, seed and provider assertions remain. |
| 102 | Hidden undergarments still appeared in image prompts. The image-only projection now omits them when structured outer slots cover them, preserving canonical equipment and paired accessory sides. Node checks cover both presentations and portrait/full-body projections. |
| 105 | A fixture submitted a feedback type rejected by the current contract. It now exercises supported ratings and reports. |
| 106 | Cleanup always persisted an empty creator registry, even when the original key did not exist. It now flushes test writes and restores the exact previous stored value or absence. |
| 143 | Publish confirmation assertions expected superseded policy text. They now check original-work/general-audience rules, explicit acceptance and zero uploads before confirmation. |
| 148 | Presentation tests relied on preferences no longer supplied by their generic profile helper. They now set each male/female preference explicitly. IDs, names, outfits, routes, profiles and public-card projections remain covered. |
| 158 | Reset assertions expected the selected outfit rather than the authored starting outfit. Reset now prioritizes the authored start; fixtures preserve that authored value and explicitly select alternatives before resetting. |

The emergency backup reports zero saved-game headers, zero runtime messages and
no storage failures. Its authored library records were not modified, and no
backup repair or schema migration was introduced.

Validation uses local Node fixtures and canonical validators. The revised browser
smokes have not been executed; these fixes must not be represented as a passing
browser report. No live inference, cloud provisioning or Supabase requests were
used for this repair. Build and final local-check evidence are in
`status.json` and `../verification.md`.