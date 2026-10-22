const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-output");
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ["build_bottom_compressed.js"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["build_bottom_compressed.js", "--private-tests"], { cwd: root, stdio: "inherit" });
const registrySource = fs.readFileSync(path.join(root, "src/scripts/app/23-smokes-profiles.js"), "utf8").split("function devSmokeScenarioRegistry()")[1].split("function devRunLiveTestScenario()")[0];
const scenarios = [...registrySource.matchAll(/id: "([^"]+)"/g)].map((match, index) => ({ number: index + 1, id: match[1] }));
const liveIds = new Set(["real-perchance-image-generation-smoke", "real-perchance-streaming-regenerate-smoke", "exact-objective-ai-timing-smoke"]);
const requested = process.argv.find(a => a.startsWith("--numbers="))?.slice(10).split(",").map(Number);
const report = { startedAt: new Date().toISOString(), runtime: null, smokes: [], liveRequired: [] };
const server = http.createServer((request, response) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(request.url, "http://local").pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" })[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(response);
});
function save() { fs.writeFileSync(path.join(output, "local-tests.json"), JSON.stringify(report, null, 2)); }
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  async function freshPage() {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext();
    await context.addInitScript({ path: require.resolve("dexie/dist/dexie.min.js") });
    await context.route("**/*", route => route.request().url().startsWith(base + "/") || route.request().url().startsWith("blob:") ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(base + "/bottom.runtime-tests.html");
    await page.waitForFunction(() => globalThis.EmberAdventures?.isReady?.(), null, { timeout: 45000 });
    //Startup opens the main menu; the library opens only after a player action.
    await page.waitForSelector("#mainMenu", { state: "visible", timeout: 45000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return { context, page };
  }
  try {
    if (!process.argv.includes("--smokes") && !requested) {
      const { context, page } = await freshPage();
      await page.evaluate(() => { EmberAdventures.runRuntimeTests("all"); });
      await page.waitForFunction(() => { const r = EmberAdventures.getRuntimeTestReport(); return r.finishedAt && !r.running; }, null, { timeout: 240000 });
      report.runtime = await page.evaluate(() => EmberAdventures.getRuntimeTestReport());
      console.log(`Runtime: ${report.runtime.passed}/${report.runtime.total}`); save(); await browser.close();
    }
    if (!process.argv.includes("--runtime")) {
      for (const scenario of scenarios) {
        if (requested && !requested.includes(scenario.number)) continue;
        if (liveIds.has(scenario.id)) { report.liveRequired.push(scenario); save(); continue; }
        const { context, page } = await freshPage();
        try {
          await page.evaluate(id => { EmberAdventures.runDevSmokeScenarioById(id); }, scenario.id);
          await page.waitForFunction(() => { const r = EmberAdventures.getDevSmokeSuiteState(); return !r.running && r.results?.length; }, null, { timeout: 180000 });
          const state = await page.evaluate(() => EmberAdventures.getDevSmokeSuiteState());
          report.smokes.push({ ...scenario, ...state.results[0] });
          console.log(`Smoke ${scenario.number}: ${state.results[0]?.status}`);
        } catch (error) { report.smokes.push({ ...scenario, status: "FAIL", error: error.message }); console.log(`Smoke ${scenario.number}: FAIL (${error.message})`); }
        save(); await browser.close();
      }
    }
  } finally { report.finishedAt = new Date().toISOString(); save(); await browser?.close(); server.close(); }
  if (report.runtime?.failed || report.smokes.some(r => r.status !== "PASS")) process.exitCode = 1;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });


