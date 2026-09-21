import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const localDexieBundle = path.join(projectRoot, "node_modules", "dexie", "dist", "dexie.min.js");
const localUrl = process.env.EMBERADVENTURES_LOCAL_URL || "http://127.0.0.1:51828/bottom.runtime-tests.html";
const importStoryFile = process.env.EMBERADVENTURES_IMPORT_STORY_FILE || "";
const mode = argValue("mode", "short-medium");
const listArg = argValue("list", "");
const headed = process.argv.includes("--headed");
const debugAllLogs = process.argv.includes("--debug-all-logs");
const showProgress = process.argv.includes("--show-progress");
const timeoutMs = Math.max(60000, Number(argValue("timeout-ms", "7200000")) || 7200000);

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpReady(url) {
  return new Promise((resolve) => {
    const client = String(url).startsWith("https:") ? https : http;
    const req = client.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureLocalServer() {
  const parsed = new URL(localUrl);
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (!isLocalHost) {
    if (await httpReady(localUrl)) return null;
    throw new Error(`Remote EmberAdventures URL did not become ready at ${localUrl}`);
  }
  if (await httpReady(localUrl)) return null;
  const child = spawn(process.execPath, ["perchance-live-server.js"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[local-server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[local-server] ${chunk}`));
  for (let i = 0; i < 40; i += 1) {
    if (await httpReady(localUrl)) return child;
    await sleep(250);
  }
  throw new Error(`Local EmberAdventures server did not become ready at ${localUrl}`);
}

async function findEmberAdventuresRuntime(page, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const frame of page.frames()) {
      const ready = await frame.evaluate(() => !!globalThis.EmberAdventures?.getDevSmokeSuiteState).catch(() => false);
      if (ready) return frame;
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for EmberAdventures smoke runtime in page or frames.");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {}
  try {
    return await import("playwright-core");
  } catch {}
  throw new Error("Playwright is not installed. Run npm install in the project folder.");
}

function existingBrowserExecutable() {
  const candidates = [process.env.EMBERADVENTURES_PLAYTEST_BROWSER].filter(Boolean);
  return candidates.find((item) => fs.existsSync(item.replace(/\\/g, "/"))) || "";
}

function formatSmokeReport(state = {}, label = "Codex smoke run") {
  const results = Array.isArray(state.results) ? state.results : [];
  const passed = results.filter((item) => item.status === "PASS");
  const failed = results.filter((item) => item.status === "FAIL");
  const timedOut = results.filter((item) => item.status === "TIMEOUT");
  const lines = [
    `EmberAdventures Smoke Report`,
    `Label: ${label}`,
    `Started: ${state.startedAt || ""}`,
    `Finished: ${state.finishedAt || new Date().toISOString()}`,
    `Total: ${results.length}`,
    `Passed: ${passed.length}`,
    `Failed: ${failed.length ? failed.map((item) => item.index).join(", ") : "none"}`,
    `Timed out: ${timedOut.length ? timedOut.map((item) => item.index).join(", ") : "none"}`,
    "",
  ];
  for (const result of results) {
    lines.push(`## ${result.index}. ${result.id} - ${result.status}`);
    lines.push(`Live: ${result.live ? "yes" : "no"}`);
    lines.push(`Duration: ${result.durationMs || 0}ms`);
    lines.push(`Timeout limit: ${result.timeoutMs || 0}ms`);
    if (result.error) lines.push(`Error:\n${result.error}`);
    if (Array.isArray(result.logs) && result.logs.length) {
      lines.push("Logs:");
      for (const log of result.logs) lines.push(`- ${log}`);
    }
    if (Array.isArray(result.devTraceCapture) && result.devTraceCapture.length) {
      lines.push("Dev trace capture:");
      for (const entry of result.devTraceCapture.slice(0, 60)) {
        lines.push(`- ${entry.title || entry.label || entry.type || "trace"}: ${entry.summary || entry.message || ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function readOptionalStoryImportPayload() {
  if (!importStoryFile) return null;
  const resolved = path.isAbsolute(importStoryFile)
    ? importStoryFile
    : path.join(projectRoot, importStoryFile);
  const raw = fs.readFileSync(resolved, "utf8");
  return {
    path: resolved,
    payload: JSON.parse(raw),
  };
}

async function main() {
  const runnerProgressPath = path.join(projectRoot, "test-output", "smoke-runner-progress.txt");
  const markRunnerProgress = (value) => {
    fs.mkdirSync(path.dirname(runnerProgressPath), { recursive: true });
    fs.writeFileSync(runnerProgressPath, `${new Date().toISOString()} ${value}\n`, "utf8");
  };
  markRunnerProgress("starting server");
  const server = await ensureLocalServer();
  markRunnerProgress("starting browser");
  const { chromium } = await loadPlaywright();
  const executablePath = existingBrowserExecutable();
  const browserProfile = path.join(
    projectRoot,
    "test-output",
    `playwright-smoke-profile-${process.pid}`,
  );
  fs.rmSync(browserProfile, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(browserProfile, {
    headless: !headed,
    channel: undefined,
    executablePath: executablePath || undefined,
    args: ["--mute-audio", "--no-first-run"],
    acceptDownloads: true,
    viewport: { width: 1600, height: 1000 },
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(60000);
    if (fs.existsSync(localDexieBundle)) {
      await page.addInitScript({ path: localDexieBundle });
    }
    const query = new URLSearchParams({
      debugRunId: String(Date.now()),
    });
    if (debugAllLogs) query.set("debugAllLogs", "1");
    const url = `${localUrl}${localUrl.includes("?") ? "&" : "?"}${query.toString()}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    markRunnerProgress("finding runtime");
    const runtime = await findEmberAdventuresRuntime(page, 60000);
    markRunnerProgress("waiting for system runtime");
    await runtime.waitForFunction(
      () => globalThis.EmberAdventures?.isSystemReady?.() === true,
      null,
      { timeout: 120000 },
    );
    await runtime.waitForFunction(
      () => !document.querySelector(".main-menu-loading"),
      null,
      { timeout: 120000 },
    );
    markRunnerProgress("runtime ready");
    const storyImport = readOptionalStoryImportPayload();
    if (storyImport) {
      const imported = await runtime.evaluate(async ({ payload }) => {
        if (!globalThis.EmberAdventuresDevPlaytest?.loadStoryPayload) {
          throw new Error("EmberAdventuresDevPlaytest.loadStoryPayload is not available.");
        }
        return globalThis.EmberAdventuresDevPlaytest.loadStoryPayload(payload, { persist: true });
      }, storyImport);
      console.log(`Imported story for smoke: ${imported.title || imported.id || storyImport.path}`);
    }
    const label = listArg
      ? `listed smokes ${listArg}`
      : `${mode} smokes`;
    let state = null;
    if (listArg) {
      const keys = listArg.split(",").map((item) => item.trim()).filter(Boolean);
      const aggregate = {
        label,
        startedAt: new Date().toISOString(),
        finishedAt: "",
        results: [],
      };
      for (const key of keys) {
        markRunnerProgress(`running smoke ${key}`);
        console.log(`Running smoke ${key}`);
        const browserRunPromise = runtime.evaluate(async (id) => {
          await globalThis.EmberAdventures.runDevSmokeScenarioById(id);
        }, key);
        let runTimeout = null;
        const runPromise = Promise.race([
          browserRunPromise,
          new Promise((resolve, reject) => {
            runTimeout = setTimeout(
              () => reject(new Error(`Smoke ${key} exceeded the configured ${timeoutMs}ms timeout.`)),
              timeoutMs,
            );
            runTimeout.unref?.();
          }),
        ]).finally(() => clearTimeout(runTimeout));
        if (showProgress) {
          let finished = false;
          let runError = null;
          runPromise.then(
            () => {
              finished = true;
            },
            (error) => {
              finished = true;
              runError = error;
            },
          );
          let lastProgress = "";
          while (!finished) {
            await sleep(250);
            const progressRequest = runtime.evaluate(() => {
              const state = globalThis.EmberAdventures.getDevSmokeSuiteProgress();
              return {
                current: String(state.current || state.currentScenario || ""),
                progress: String(
                  globalThis.__emberAdventuresSmokeProgress ||
                  state.progress ||
                  state.currentScenarioProgress ||
                  "",
                ),
                results: Number(state.resultCount || 0),
                storyWorker: globalThis.__emberAdventuresStoryImportWorkerMetrics || null,
                persistencePending: state.persistencePending || [
                  ...(globalThis.__emberAdventuresPersistenceWorkerClient?.pending?.values?.() || []),
                ].map((request) => String(request?.type || "unknown")),
                normalizedMutations: state.normalizedMutations || null,
              };
            });
            const progress = await Promise.race([
              progressRequest,
              sleep(2000).then(() => ({ blocked: true })),
            ]);
            if (progress?.blocked) {
              console.log("Smoke page main thread did not answer the progress probe within 2 seconds.");
              fs.mkdirSync(path.join(projectRoot, "test-output"), { recursive: true });
              fs.appendFileSync(
                path.join(projectRoot, "test-output", "smoke-progress.txt"),
                `${new Date().toISOString()} MAIN THREAD BLOCKED\n`,
              );
              continue;
            }
            const worker = progress.storyWorker?.lastRequest;
            const workerText = worker
              ? `worker=${worker.type} post=${Number(worker.postMessageMs || 0).toFixed(1)}ms progress=${progress.storyWorker.lastProgress || ""} response=${JSON.stringify(progress.storyWorker.lastResponse || null)} contact=${progress.storyWorker.lastContactAt || 0}`
              : "";
            const persistenceText = progress.persistencePending?.length
              ? `persistence=${progress.persistencePending.join(",")}`
              : "";
            const mutationText = progress.normalizedMutations
              ? `mutations=${JSON.stringify(progress.normalizedMutations)}`
              : "";
            const text = [progress.current, progress.progress, persistenceText, mutationText, workerText]
              .filter(Boolean)
              .join(": ");
            if (text && text !== lastProgress) {
              console.log(text);
              fs.mkdirSync(path.join(projectRoot, "test-output"), { recursive: true });
              fs.appendFileSync(
                path.join(projectRoot, "test-output", "smoke-progress.txt"),
                `${new Date().toISOString()} ${text}\n`,
              );
              lastProgress = text;
            }
          }
          if (runError) throw runError;
        }
        await runPromise;
        const oneState = await runtime.evaluate(() => globalThis.EmberAdventures.getDevSmokeSuiteState());
        aggregate.results.push(...(Array.isArray(oneState.results) ? oneState.results : []));
      }
      aggregate.finishedAt = new Date().toISOString();
      state = aggregate;
    } else if (mode === "all") {
      await runtime.evaluate(async () => globalThis.EmberAdventures.runAllDevSmokeScenarios());
    } else if (mode === "quick" || mode === "short") {
      await runtime.evaluate(async () => globalThis.EmberAdventures.runQuickDevSmokeScenarios());
    } else if (mode === "medium") {
      await runtime.evaluate(async () => globalThis.EmberAdventures.runMediumDevSmokeScenarios());
    } else if (mode === "public-hosting") {
      await runtime.evaluate(async () => globalThis.EmberAdventures.runPublicHostingSmokeScenarios());
    } else if (mode === "short-medium") {
      await runtime.evaluate(async () => globalThis.EmberAdventures.runShortMediumDevSmokeScenarios());
    } else {
      throw new Error(`Unknown smoke mode: ${mode}`);
    }
    if (!state) state = await runtime.evaluate(() => globalThis.EmberAdventures.getDevSmokeSuiteState());
    const report = formatSmokeReport(state, label);
    const outDir = path.join(projectRoot, "test-output");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `codex-smoke-report-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
    fs.writeFileSync(outPath, report, "utf8");
    const results = Array.isArray(state.results) ? state.results : [];
    const failed = results.filter((item) => item.status === "FAIL");
    const timedOut = results.filter((item) => item.status === "TIMEOUT");
    console.log(JSON.stringify({
      ok: failed.length === 0 && timedOut.length === 0,
      report: outPath,
      total: results.length,
      passed: results.filter((item) => item.status === "PASS").length,
      failed: failed.map((item) => item.index),
      timedOut: timedOut.map((item) => item.index),
    }, null, 2));
    if (failed.length || timedOut.length) process.exitCode = 1;
  } finally {
    await Promise.race([
      context.close().catch(() => {}),
      sleep(5000),
    ]);
    try {
      fs.rmSync(browserProfile, { recursive: true, force: true });
    } catch {}
    if (server) {
      server.kill();
      server.stdout?.destroy();
      server.stderr?.destroy();
      server.unref();
    }
  }
}

await main();
