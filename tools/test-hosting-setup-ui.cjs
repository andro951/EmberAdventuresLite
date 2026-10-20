// Fresh browser context, fake credentials, local server only; no provider traffic.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const {sessionHandler}=require("../hosting/session-server.cjs");
const {applyHandoff}=require("../hosting/handoff.cjs");
const root=path.resolve(__dirname,"..");
const config=applyHandoff({text:{kind:"disabled"},image:{kind:"disabled"}},{version:1,provider:"openai",url:"http://127.0.0.1:9/v1/chat/completions",model:"ember-qwen-27b"});
let calls=0,browser;
const server=http.createServer(sessionHandler(config,{EMBER_LAUNCH_AUTHORIZATION:"Bearer fake-launch-session-key"},{generate:async()=>{calls++;return{text:"fixture"};}}));
(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:"msedge",headless:true});const context=await browser.newContext();
  await context.addInitScript({path:require.resolve("dexie/dist/dexie.min.js")});
  await context.route("**/*",route=>route.request().url().startsWith(base+"/")||route.request().url().startsWith("blob:")?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/launch");assert.equal(await page.title(),"Hosted Ember Adventures Lite");
  await page.evaluate(()=>localStorage.setItem("emberadventures-lite-generation-v1",JSON.stringify({text:"perchance",image:"perchance",proxyUrl:"http://127.0.0.1:51840"})));
  fs.mkdirSync(path.join(root,"test-output"),{recursive:true});await page.screenshot({path:path.join(root,"test-output/hosting-launch.png")});
  await page.getByRole("button",{name:"Open Lite with hosted text",exact:true}).click();
  await page.waitForFunction(()=>globalThis.EmberAdventures?.isReady?.(),null,{timeout:45000});
  const state=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem("emberadventures-lite-generation-v1")),storage:JSON.stringify({...localStorage})}));
  assert.deepEqual(state.prefs,{text:"hosting-proxy",image:"perchance",proxyUrl:base});assert.doesNotMatch(state.storage,/fake-launch-session-key/);assert.equal(calls,0);assert.deepEqual(errors,[]);
  console.log("Guided launch browser passed: explicit open button selects hosted text, preserves image choice, starts actual Lite UI, no keys in browser storage and no inference.");
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
