# EmberAdventures Private Runtime Tests

The private runtime harness is compiled into local development builds. Save
tests use `EmberAdventuresLiteRuntimeDiagnostic`. Library/profile tests use
`EmberAdventuresLiteLibraryRuntimeDiagnostic` and
`EmberAdventuresLiteLibraryApplicationDiagnostic`. Tests never write fixtures to
the production player databases.

## Manual Run

Double-click `Run Runtime Tests.bat`. It rebuilds `bottom.html`, starts a hidden
local server on the first free port from 4180 through 4199, and opens the test
panel.

The same panel is available from **Tools > Runtime Tests** in a locally served
build. The direct URL parameter is `?runtimeTests=1`.

Use:

- **Run Everything** for the release gate.
- **UI Performance** while changing rendering or interaction code.
- **Persistence** while changing storage, workers, save operations, or load
  reconstruction.
- **Start/Load Flow** for the focused new-game materialization, save listing,
  immutable-story reconnection, and bounded message-page path.
- **Download Report** to retain timings and failures as JSON.

## Automated Control

The page exposes these development APIs:

```js
await EmberAdventures.runRuntimeTests("all");
await EmberAdventures.runRuntimeTests("application");
await EmberAdventures.runRuntimeTests("persistence");
await EmberAdventures.runRuntimeTestById("persistence-9");
EmberAdventures.getRuntimeTestReport();
```

`runRuntimeTestById` accepts both application IDs and numbered persistence IDs
such as `persistence-9`. This keeps a single performance regression from
forcing the complete persistence suite to rerun during diagnosis.

The page sets `document.body.dataset.runtimeTestResult` to `passed` or `failed`
when a run completes. Browser automation can wait for that value and retrieve
the report without inspecting visual text.

## Performance Contract

Application tests record event-loop delay, animation-frame gaps, Long Task API
entries, and named operation durations. A foreground main-thread delay at or
above 16.7 ms fails the relevant test. Long tasks at or above 50 ms and frame
gaps at or above 50 ms also fail.

Every production subsystem added during the rebuild must register correctness
tests and representative large-data performance tests before its port is
considered complete. The harness is intentionally cumulative.
