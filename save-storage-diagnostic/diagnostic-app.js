"use strict";

PersistenceDiagnostic.App = {};

PersistenceDiagnostic.App.elements = {};
PersistenceDiagnostic.App.testRows = new Map();
PersistenceDiagnostic.App.simulatedVisibility = "visible";
PersistenceDiagnostic.App.running = false;
PersistenceDiagnostic.App.logLines = [];

//#region Setup

PersistenceDiagnostic.App.setup = () => {
    const ids = [
        "worker-state", "worker-state-text", "store-count", "worker-generation",
        "active-save", "active-session", "committed-change", "worker-phase",
        "run-all-button", "reset-button", "inspect-button", "restart-button",
        "test-summary", "test-progress", "test-list", "clear-log-button", "event-log"
    ];

    for (const id of ids)
        PersistenceDiagnostic.App.elements[id] = document.getElementById(id);

    const controller = new EmberPersistence.Controller("./persistence-worker.js", {
        watchdogMilliseconds: 5000,
        visibilityProvider: () => PersistenceDiagnostic.App.simulatedVisibility
    });
    const testRunner = new PersistenceDiagnostic.TestRunner(controller, {
        setSimulatedVisibility: (visibility) => PersistenceDiagnostic.App.simulatedVisibility = visibility,
        onTestChanged: PersistenceDiagnostic.App.renderTest,
        onLog: PersistenceDiagnostic.App.log
    });

    PersistenceDiagnostic.App.controller = controller;
    PersistenceDiagnostic.App.testRunner = testRunner;
    window.PersistenceDiagnosticApp = PersistenceDiagnostic.App;

    controller.addEventListener("status", PersistenceDiagnostic.App.onControllerStatus);
    PersistenceDiagnostic.App.elements["run-all-button"].onclick = PersistenceDiagnostic.App.runAllTests;
    PersistenceDiagnostic.App.elements["reset-button"].onclick = PersistenceDiagnostic.App.resetDatabase;
    PersistenceDiagnostic.App.elements["inspect-button"].onclick = PersistenceDiagnostic.App.inspectSchema;
    PersistenceDiagnostic.App.elements["restart-button"].onclick = PersistenceDiagnostic.App.replaceWorker;
    PersistenceDiagnostic.App.elements["clear-log-button"].onclick = PersistenceDiagnostic.App.clearLog;

    PersistenceDiagnostic.App.createTestRows();
    PersistenceDiagnostic.App.setBusy(true, "Starting");

    controller.start().then((schema) => {
        PersistenceDiagnostic.App.elements["store-count"].textContent = schema.storeCount;
        PersistenceDiagnostic.App.setBusy(false, "Ready");
        PersistenceDiagnostic.App.log(`Ready: ${schema.storeCount} stores in ${schema.databaseName}.`);
        window.__diagnosticReady = true;
    }).catch((error) => {
        PersistenceDiagnostic.App.setError(error);
        window.__diagnosticReady = false;
    });
}

//#endregion Setup




//#region Test UI

PersistenceDiagnostic.App.createTestRows = () => {
    const testList = PersistenceDiagnostic.App.elements["test-list"];
    testList.replaceChildren();
    PersistenceDiagnostic.App.testRows.clear();
    PersistenceDiagnostic.App.elements["test-progress"].max = PersistenceDiagnostic.App.testRunner.tests.length;

    PersistenceDiagnostic.App.testRunner.tests.forEach((test, index) => {
        const row = document.createElement("div");
        const indicator = document.createElement("span");
        const name = document.createElement("div");
        const title = document.createElement("strong");
        const detail = document.createElement("small");
        const duration = document.createElement("span");

        row.className = "test-row";
        row.dataset.status = test.status;
        indicator.className = "test-indicator";
        name.className = "test-name";
        duration.className = "test-duration";
        title.textContent = `${index + 1}. ${test.name}`;
        detail.textContent = "Waiting";
        duration.textContent = "-";
        name.append(title, detail);
        row.append(indicator, name, duration);
        testList.append(row);

        PersistenceDiagnostic.App.testRows.set(test, { row, detail, duration });
    });
}

PersistenceDiagnostic.App.renderTest = (test) => {
    const controls = PersistenceDiagnostic.App.testRows.get(test);

    if (controls == null)
        return;

    controls.row.dataset.status = test.status;
    controls.duration.textContent = test.duration == null ? "-" : `${test.duration.toFixed(0)} ms`;

    if (test.error != null)
        controls.detail.textContent = test.error.message;
    else if (test.detail != null)
        controls.detail.textContent = test.detail;
    else
        controls.detail.textContent = test.status === "running" ? "Running" : test.status;

    const completed = PersistenceDiagnostic.App.testRunner.tests.filter((item) => {
        return item.status === "passed" || item.status === "failed";
    }).length;
    PersistenceDiagnostic.App.elements["test-progress"].value = completed;
}

PersistenceDiagnostic.App.runAllTests = () => {
    if (PersistenceDiagnostic.App.running)
        return;

    PersistenceDiagnostic.App.running = true;
    PersistenceDiagnostic.App.setControlsDisabled(true);
    PersistenceDiagnostic.App.elements["run-all-button"].dataset.busy = "true";
    PersistenceDiagnostic.App.elements["test-summary"].textContent = "Running";
    PersistenceDiagnostic.App.log("Starting complete persistence suite.");

    PersistenceDiagnostic.App.testRunner.runAll().then((summary) => {
        window.__lastTestSummary = summary;
        PersistenceDiagnostic.App.elements["test-summary"].textContent = `${summary.passed}/${summary.total} passed`;
        PersistenceDiagnostic.App.log(`Suite complete: ${summary.passed}/${summary.total} passed.`);
        PersistenceDiagnostic.App.log(`Controller final state: ${JSON.stringify(PersistenceDiagnostic.App.controller.diagnosticState())}`);
    }).catch((error) => {
        window.__lastTestSummary = { passed: 0, failed: 1, total: PersistenceDiagnostic.App.testRunner.tests.length, error: error.message };
        PersistenceDiagnostic.App.elements["test-summary"].textContent = "Runner failed";
        PersistenceDiagnostic.App.log(`RUNNER FAILED: ${error.message}`);
    }).finally(() => {
        PersistenceDiagnostic.App.running = false;
        PersistenceDiagnostic.App.setControlsDisabled(false);
        PersistenceDiagnostic.App.elements["run-all-button"].dataset.busy = "false";
    });
}

//#endregion Test UI




//#region Commands

PersistenceDiagnostic.App.resetDatabase = () => {
    PersistenceDiagnostic.App.setControlsDisabled(true);
    PersistenceDiagnostic.App.log("Resetting diagnostic database.");

    PersistenceDiagnostic.App.controller.resetDatabase().then(() => {
        PersistenceDiagnostic.App.log("Diagnostic database reset.");
    }).catch((error) => PersistenceDiagnostic.App.log(`Reset failed: ${error.message}`)).finally(() => {
        PersistenceDiagnostic.App.setControlsDisabled(false);
    });
}

PersistenceDiagnostic.App.inspectSchema = () => {
    PersistenceDiagnostic.App.controller.inspectSchema().then((schema) => {
        PersistenceDiagnostic.App.log(`Schema: ${schema.storeCount} stores, version ${schema.version}.`);
    }).catch((error) => PersistenceDiagnostic.App.log(`Schema inspection failed: ${error.message}`));
}

PersistenceDiagnostic.App.replaceWorker = () => {
    PersistenceDiagnostic.App.controller.replaceWorker("manual diagnostic command").catch((error) => {
        PersistenceDiagnostic.App.log(`Worker replacement failed: ${error.message}`);
    });
}

//#endregion Commands




//#region Status And Logging

PersistenceDiagnostic.App.onControllerStatus = (event) => {
    const { status, detail } = event.detail;
    const controller = PersistenceDiagnostic.App.controller;

    PersistenceDiagnostic.App.elements["worker-generation"].textContent = controller.workerGeneration;
    PersistenceDiagnostic.App.elements["active-save"].textContent = controller.activeSaveState?.saveId ?? "None";
    PersistenceDiagnostic.App.elements["active-session"].textContent = controller.activeSaveState?.sesNum ?? "-";
    PersistenceDiagnostic.App.elements["committed-change"].textContent = controller.activeSaveState?.lastAcknowledgedChangeId ?? "-";

    if (status === "worker-health") {
        PersistenceDiagnostic.App.elements["worker-phase"].textContent = detail.phase;
        return;
    }

    if (["worker-started", "worker-error", "worker-message-error", "worker-replacing", "worker-replaced", "worker-unresponsive", "transaction-rejected"].includes(status))
        PersistenceDiagnostic.App.log(`${status}: ${JSON.stringify(detail)}`);
}

PersistenceDiagnostic.App.setBusy = (busy, text) => {
    const workerState = PersistenceDiagnostic.App.elements["worker-state"];
    workerState.dataset.state = busy ? "loading" : "ready";
    PersistenceDiagnostic.App.elements["worker-state-text"].textContent = text;
}

PersistenceDiagnostic.App.setError = (error) => {
    PersistenceDiagnostic.App.elements["worker-state"].dataset.state = "error";
    PersistenceDiagnostic.App.elements["worker-state-text"].textContent = "Failed";
    PersistenceDiagnostic.App.log(`STARTUP FAILED: ${error.message}`);
}

PersistenceDiagnostic.App.setControlsDisabled = (disabled) => {
    for (const id of ["run-all-button", "reset-button", "inspect-button", "restart-button"])
        PersistenceDiagnostic.App.elements[id].disabled = disabled;
}

PersistenceDiagnostic.App.log = (message) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour12: false });
    PersistenceDiagnostic.App.logLines.push(`${timestamp}  ${message}`);

    while (PersistenceDiagnostic.App.logLines.length > 500)
        PersistenceDiagnostic.App.logLines.shift();

    const eventLog = PersistenceDiagnostic.App.elements["event-log"];
    eventLog.textContent = PersistenceDiagnostic.App.logLines.join("\n");
    eventLog.scrollTop = eventLog.scrollHeight;
}

PersistenceDiagnostic.App.clearLog = () => {
    PersistenceDiagnostic.App.logLines.length = 0;
    PersistenceDiagnostic.App.elements["event-log"].textContent = "";
}

//#endregion Status And Logging

document.addEventListener("DOMContentLoaded", PersistenceDiagnostic.App.setup);
