//Explicit browser check only. The published URL is fulfilled from this checkout; external traffic is blocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const {chromium} = require("playwright");
const {sessionHandler} = require("../hosting/session-server.cjs");
const {launchUrl} = require("../hosting/server.cjs");
const {applyHandoff} = require("../hosting/handoff.cjs");
const root = path.resolve(__dirname, "..");
const config = applyHandoff({text:{kind:"disabled"},image:{kind:"disabled"}}, {version:1,provider:"openai",url:"http://127.0.0.1:9/v1/chat/completions",model:"ember-qwen-27b"});
let calls = 0;
let browser;
const server = http.createServer(sessionHandler(config, {EMBER_LAUNCH_AUTHORIZATION:"Bearer fake-launch-session-key"}, {generate:async()=>{calls++;return {text:"fixture"};}}));
(async () => {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const destination = launchUrl(base);
    browser = await chromium.launch({channel:"msedge",headless:true});
    const context = await browser.newContext();
    await context.addInitScript({path:require.resolve("dexie/dist/dexie.min.js")});
    await context.addInitScript(() => localStorage.setItem("emberadventureslite-generation-v1",JSON.stringify({text:"perchance",image:"perchance",proxyUrl:"http://127.0.0.1:51840"})));
    await context.route("**/*", route => {
        const url = route.request().url();
        if (url === destination)
            return route.fulfill({contentType:"text/html",body:fs.readFileSync(path.join(root,"bottom.html"),"utf8").replace("window.EmberAdventures = {","window.__hostingLaunchTest = {generationPreferences}; window.EmberAdventures = {")});

        if (url.startsWith(base + "/") || url.startsWith("blob:") || url.startsWith("data:"))
            return route.continue();

        return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(destination);
    await page.waitForFunction(() => globalThis.EmberAdventures?.isReady?.(), null, {timeout:45000});
    const state = await page.evaluate(() => ({effective:__hostingLaunchTest.generationPreferences(),saved:JSON.parse(localStorage.getItem("emberadventureslite-generation-v1")),storage:JSON.stringify({...localStorage})}));
    assert.deepEqual(state.effective,{text:"hosting-proxy",image:"hosting-proxy",proxyUrl:base});
    assert.deepEqual(state.saved,{text:"perchance",image:"perchance",proxyUrl:"http://127.0.0.1:51840"});
    assert.doesNotMatch(state.storage,/fake-launch-session-key/);
    assert.equal(calls,0);
    assert.deepEqual(errors,[]);
    fs.mkdirSync(path.join(root,"test-output"),{recursive:true});
    await page.screenshot({path:path.join(root,"test-output/hosting-launch.png")});
    console.log("Launch browser check passed: session-only hosted routes, unchanged saved choices, no browser credentials or inference.");
})().catch(error => {console.error(error);process.exitCode=1;}).finally(async () => {await browser?.close();server.closeAllConnections();server.close();});