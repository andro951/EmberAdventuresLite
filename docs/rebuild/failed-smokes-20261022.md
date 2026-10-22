# Targeted Lite smoke repair

The user's report for `ea-2163b3b283772f3e` passed 148 scenarios, failed five,
and skipped seven. Only the five failures were selected for this repair.

| Number | Correction |
| --- | --- |
| 15 | The fixture submitted an empty domain transaction left behind after feature removal. It now explicitly verifies rejection before a change ID is consumed, then continues the persistence and rollback checks. The transaction contract remains strict. |
| 22 | The cleanup self-test used its invented string identity instead of the numeric ID actually assigned by IndexedDB, allowing its assertion to miss a leaked save. It now passes the returned synthetic save ID to cleanup, verifies that exact ID is gone, and restores its save baseline in finally. |
| 33 | Clearing a profile selection intentionally preserves current settings. The fixture now expects that retained presentation. Additional diagnostics preserve exact visibility-button text and pressed states. The local harness also needed an explicit UTF-8 response header to compare Unicode check marks correctly. |
| 86 | The profile dialog assertion still required a removed content-mode badge. Retained style, seed, generation and upload-absence checks; removed only the obsolete badge expectation. |
| 152 | A dangling conditional guarded the player branch's continue statement. Player patches without an outfit ID fell through into companion bookkeeping. The player branch now always terminates there, preserving player ownership and unchanged companion references. A focused Node regression covers player-only and mixed patches. |

The isolated local runner now waits for the actual startup main menu rather than
a library view that requires a player action. It builds release and private-test
artifacts before executing the selected scenarios. External requests are blocked;
these scenarios use their own mocked generation and public-library providers.

The first working browser run passed 15, 22, 86 and 152. Only 33 was repeated while
diagnosing the local encoding issue. The final run of the same five requested
scenarios passed 5/5 with no cleanup failures. The focused player-routing Node
regression passed as well. Exact builds, timestamps and durations are recorded in
`failed-smokes-20261022.json`.

The full browser and Node suites were not run. The user will perform the full
smoke run on the updated published Perchance build. Local mocked results do not
verify live Supabase, Perchance inference or external model workers.