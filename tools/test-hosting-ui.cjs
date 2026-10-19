// Targeted browser validation only. All nonlocal traffic is blocked; no live provider requests.
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const output=path.join(root,"test-output");fs.mkdirSync(output,{recursive:true});
const tinyPng="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
let browser;
const server=http.createServer((req,res)=>{
  let p=path.resolve(root,"."+new URL(req.url,"http://local").pathname);
  if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return;}
  res.setHeader("Content-Type",p.endsWith(".html")?"text/html":p.endsWith(".js")?"text/javascript":"application/json");
  if(p.endsWith("bottom.html"))res.end(fs.readFileSync(p,"utf8").replace("window.EmberAdventures = {","window.__hostingTest = {aiText, generateImageHtml}; window.EmberAdventures = {"));
  else fs.createReadStream(p).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:"msedge",headless:true});const context=await browser.newContext();
  await context.addInitScript({path:require.resolve("dexie/dist/dexie.min.js")});
  await context.addInitScript(()=>{window.__perchanceImageCalls=[];window.__emberAdventuresPluginOverrides={aiTextPlugin:async input=>input.getMetaObject?{countTokens:t=>Math.ceil(t.length/4),idealMaxContextTokens:12000}:{generatedText:"Perchance fixture reply.",stopReason:"natural"},textToImagePlugin:input=>{window.__perchanceImageCalls.push(input.resolution);return '<img src="data:image/png;base64,aGVsbG8=" alt="Perchance fixture">';}};});
  const calls=[];const errors=[];
  await context.route("**/*",async route=>{
    const req=route.request(),url=req.url();
    if(url.startsWith(base+"/api/generation/")){
      calls.push({role:url.endsWith("text")?"text":"image",body:req.postDataJSON()});
      return route.fulfill({contentType:"application/json",body:JSON.stringify(url.endsWith("text")?{text:"The lantern-lit forest waits."}:{image:`data:image/png;base64,${tinyPng}`})});
    }
    if(url.startsWith(base+"/")||url.startsWith("blob:")||url.startsWith("data:"))return route.continue();
    return route.abort();
  });
  const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/bottom.html");await page.waitForFunction(()=>globalThis.EmberAdventures?.isReady?.(),null,{timeout:45000});
  await page.waitForSelector("[data-library-home]",{timeout:45000});
  const original=await page.evaluate(async()=>({text:await __hostingTest.aiText("Safe fixture",{hasUniversalContext:true,label:"Perchance compatibility fixture"}),image:await __hostingTest.generateImageHtml("A clothed fantasy traveler","nudity",42)}));
  await page.evaluate(()=>__hostingTest.generateImageHtml("A clothed profile fixture","nudity",42,undefined,{resolution:"768x768"}));
  assert.deepEqual(await page.evaluate(()=>window.__perchanceImageCalls),["512x768","768x768"]);
  assert.equal(original.text,"Perchance fixture reply.");assert.match(original.image,/Perchance fixture/);assert.equal(calls.length,0);
  await page.evaluate(()=>EmberAdventures.openSettingsModal());
  await page.locator("#generation-text").selectOption("hosting-proxy");await page.locator("#generation-image").selectOption("perchance");await page.locator("#generation-proxyUrl").fill(base);await page.locator("#generation-save").click();
  assert.match(await page.locator("#generation-status").innerText(),/saved/);
  const text=await page.evaluate(()=>__hostingTest.aiText("Describe a safe fantasy forest.",{hasUniversalContext:true,startWith:"Scene: ",label:"hosting integration fixture"}));
  assert.equal(text,"Scene: The lantern-lit forest waits.");
  await page.locator("#generation-image").selectOption("hosting-proxy");await page.locator("#generation-save").click();
  const image=await page.evaluate(()=>__hostingTest.generateImageHtml("A fully clothed elf at a high fantasy forest gate","nudity",42,undefined,{resolution:"512x768"}));
  assert.match(image,/^<img src="data:image\/png;base64/);assert.equal(calls.length,2);assert.equal(calls[1].body.width,832);assert.equal(calls[1].body.height,1216);assert.equal(calls[1].body.seed,42);
  await page.evaluate(()=>__hostingTest.generateImageHtml("A clothed profile fixture","nudity",42,undefined,{resolution:"768x768"}));
  assert.equal(calls.length,3);assert.equal(calls[2].body.width,1024);assert.equal(calls[2].body.height,1024);
  // Each role stays independent and survives a reload without touching game settings.
  await page.locator("#generation-text").selectOption("perchance");await page.locator("#generation-save").click();await page.reload();await page.waitForFunction(()=>EmberAdventures?.isReady?.(),null,{timeout:45000});await page.evaluate(()=>EmberAdventures.openSettingsModal());
  assert.equal(await page.locator("#generation-text").inputValue(),"perchance");assert.equal(await page.locator("#generation-image").inputValue(),"hosting-proxy");
  await page.locator("#generation-proxyUrl").fill("https://not-local.example");await page.locator("#generation-save").click();assert.match(await page.locator("#generation-status").innerText(),/loopback/);
  await page.locator("#issueDismissBtn").click();
  await page.locator("#generation-proxyUrl").fill(base);await page.locator("#generation-save").click();
  await page.setViewportSize({width:390,height:844});await page.locator("#generation-save").scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,"hosting-settings-mobile.png")});
  await page.setViewportSize({width:1280,height:900});await page.locator("#generation-text").scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,"hosting-settings-desktop.png")});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,"hosting-ui.json"),JSON.stringify({passed:true,network:"mocked; external traffic blocked",calls,errors,screenshots:["hosting-settings-mobile.png","hosting-settings-desktop.png"]},null,2));
  console.log("Hosting UI passed: actual text queue and image function, independent persisted selections, invalid-origin rejection, desktop/mobile screenshots; all inference mocked.");
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
