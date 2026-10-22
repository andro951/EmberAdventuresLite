const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const contract = require("../src/contracts/generation-contract.js");
const {createAdapters, validateConfig, workflow} = require("../hosting/adapters.cjs");
const {createServer} = require("../hosting/server.cjs");
const disabled = () => ({kind: "disabled"});
const text = {instruction: "Describe an enchanted forest.", startWith: "", stopSequences: ["END"]};
const image = {prompt: "A fully clothed elf in a fantasy forest", negativePrompt: "nudity", width: 832, height: 1216, seed: 42};
const chat = {kind: "openai-chat", baseUrl: "https://text.example/v1", authorizationEnv: "TEST_AUTH", model: "qwen", maxTokens: 800, temperature: 0.7, topP: 0.8, topK: 20, enableThinking: false};
const chatResult = {choices: [{finish_reason: "stop", message: {content: "The forest glows."}}]};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ember-hosting-"));
const workflowPath = path.join(tmp, "workflow.json");
fs.writeFileSync(workflowPath, JSON.stringify({"6": {class_type: "CLIPTextEncode", inputs: {text: "{{prompt}}"}}, "9": {class_type: "SaveImage", inputs: {seed: "{{seed}}", width: "{{width}}"}}}));
const comfyConfig = kind => ({kind, baseUrl: kind.startsWith("runpod") ? "https://api.runpod.ai/v2/image-test" : "https://image.example", authorizationEnv: "TEST_AUTH", workflowFile: workflowPath, outputNode: "9", pollIntervalMs: 250});
function mock(responses, calls = []) {
  return async (url, options) => { calls.push({url, ...options, payload: options.body ? JSON.parse(options.body) : undefined}); const r = responses.shift(); if (r instanceof Error) throw r; return new Response(JSON.stringify(r?.httpStatus ? r.data : r), {status: r?.httpStatus || 200, headers: {"Content-Type": "application/json"}}); };
}
test("strict shared boundaries reject unknown fields, credentials and unsafe images", () => {
  assert.throws(() => contract.preferences({text:"perchance",image:"perchance",proxyUrl:"https://evil.example"}));
  assert.throws(() => contract.proxyUrl("http://secret@127.0.0.1:51840"));
  assert.throws(() => contract.request("image", {...image, apiKey:"secret"}));
  assert.throws(() => contract.response("image", {image:"javascript:alert(1)"}));
  assert.throws(() => validateConfig({text:{...chat, apiKey:"secret"},image:disabled()}));
  assert.throws(() => validateConfig({text:{...chat, baseUrl:"https://text.example?api_key=secret"},image:disabled()}));
});

test("explicit live-site launch selects both hosted roles without changing stored preferences", () => {
  const saved = {text:"perchance", image:"perchance", proxyUrl:"http://127.0.0.1:51840"};
  const source = fs.readFileSync(path.join(__dirname,"../src/scripts/app/02a-generation-providers.js"),"utf8");
  const context = {app:{}, EmberGenerationContract:contract,
    window:{location:{search:"?emberHosting=http%3A%2F%2F127.0.0.1%3A51840"}},
    localStorage:{getItem:()=>JSON.stringify(saved),setItem:()=>{throw Error("Launch must not persist preferences");}}};
  const value = vm.runInNewContext(source+"\ngenerationPreferences();",context);
  assert.equal(value.text,"hosting-proxy");assert.equal(value.image,"hosting-proxy");
  assert.equal(value.proxyUrl,"http://127.0.0.1:51840");
  assert.equal(saved.text,"perchance");
  context.app={};context.window.location.search="";
  const normal=vm.runInNewContext(source+"\ngenerationPreferences();",context);
  assert.equal(normal.text,"perchance");assert.equal(normal.image,"perchance");
});

test("launch contract refuses duplicates, remote URLs and credentials without Perchance fallback", () => {
  assert.equal(contract.launchPreferences("?other=value"),null);
  for(const query of ["?emberHosting=", "?emberHosting=https://remote.example", "?emberHosting=http://secret@127.0.0.1:51840",
    "?emberHosting=http://127.0.0.1:51840&emberHosting=http://127.0.0.1:51841"]){
    assert.throws(()=>contract.launchPreferences(query));
  }
});
test("hosted portrait and square defaults validate without changing explicit nondefault dimensions",()=>{
  assert.equal(contract.hostedImageResolution(),"832x1216");
  assert.equal(contract.hostedImageResolution("512x768"),"832x1216");
  for(const size of ["512x512","768x768","1024x1024"])assert.equal(contract.hostedImageResolution(size),"1024x1024");
  assert.equal(contract.hostedImageResolution("1024x576"),"1024x576");
  for(const [width,height] of [[832,1216],[1024,1024]])assert.equal(contract.request("image",{...image,width,height}).width,width);
  assert.throws(()=>contract.hostedImageResolution("0x1024"),/resolution/);
});
test("dedicated vLLM sends matching sampling, prefix and stops; rejects truncation", async () => {
  const calls=[]; const generate=createAdapters({text:chat,image:disabled()}, {fetch:mock([chatResult,{choices:[{finish_reason:"length",message:{content:"partial"}}]}],calls), env:{TEST_AUTH:"Bearer fake-for-test"}});
  assert.equal((await generate("text", {...text,startWith:"Scene:"})).text,"The forest glows.");
  assert.equal(calls[0].url,"https://text.example/v1/chat/completions");
  assert.equal(calls[0].headers.Authorization,"Bearer fake-for-test");
  assert.equal(calls[0].payload.top_p,0.8); assert.equal(calls[0].payload.chat_template_kwargs.enable_thinking,false);
  assert.deepEqual(calls[0].payload.stop,["END"]); assert.match(calls[0].payload.messages[0].content,/Scene:/);
  await assert.rejects(generate("text",text),/finish successfully/);
});
test("SGLang image endpoint uses image schema and preserves dimensions/seed/negative prompt",async()=>{
  const calls=[]; const c={kind:"sglang-images",baseUrl:"https://image.example/v1",authorizationEnv:"",model:"krea/Krea-2-Turbo",steps:8,guidanceScale:1};
  const g=createAdapters({text:disabled(),image:c},{fetch:mock([{data:[{b64_json:"aGVsbG8="}]}],calls)});
  assert.equal((await g("image",image)).image,"data:image/png;base64,aGVsbG8=");
  assert.equal(calls[0].url,"https://image.example/v1/images/generations");
  assert.equal(calls[0].payload.size,"832x1216"); assert.equal(calls[0].payload.negative_prompt,"nudity");
  assert.equal(calls[0].payload.guidance_scale,1);assert.equal(calls[0].payload.num_inference_steps,8);assert.equal(calls[0].payload.seed,42); assert.equal(calls[0].payload.messages,undefined);
});
test("shared demo RunPod load-balancer contract uses both gateway and platform credentials",async()=>{
  const calls=[];const g=createAdapters({text:{...chat,inferenceKeyEnv:"GATEWAY_KEY"},image:disabled()},{env:{TEST_AUTH:"Bearer fake-platform",GATEWAY_KEY:"fake-gateway"},fetch:mock([chatResult],calls)});
  await g("text",text);assert.equal(calls[0].headers.Authorization,"Bearer fake-platform");assert.equal(calls[0].headers["X-Inference-Key"],"fake-gateway");
});
test("generic llama.cpp candidate can omit vLLM-specific thinking controls",async()=>{
  const calls=[];const g=createAdapters({text:{...chat,model:"ember-qwen-27b",enableThinking:null},image:disabled()},{env:{TEST_AUTH:"Bearer fake"},fetch:mock([chatResult],calls)});
  await g("text",text);assert.equal(calls[0].payload.model,"ember-qwen-27b");assert.equal(Object.hasOwn(calls[0].payload,"chat_template_kwargs"),false);
});
test("Krea queue worker returns its image schema after RunPod polling",async()=>{
  const calls=[];const c={kind:"runpod-sglang-images",baseUrl:"https://api.runpod.ai/v2/krea-test",authorizationEnv:"TEST_AUTH",model:"krea/Krea-2-Turbo",steps:8,guidanceScale:1,pollIntervalMs:250};
  const g=createAdapters({text:disabled(),image:c},{env:{TEST_AUTH:"Bearer fake"},sleep:async()=>{},fetch:mock([{id:"k",status:"IN_QUEUE"},{id:"k",status:"COMPLETED",output:{data:[{b64_json:"aGVsbG8="}]}}],calls)});
  assert.match((await g("image",image)).image,/^data:image\/png/);assert.equal(calls[0].payload.input.size,"832x1216");assert.equal(calls[0].payload.input.guidance_scale,1);assert.equal(calls[0].payload.input.messages,undefined);
});
test("Automatic1111 decodes images rather than chat",async()=>{
  const calls=[];const g=createAdapters({text:disabled(),image:{kind:"automatic1111",baseUrl:"http://127.0.0.1:7860",authorizationEnv:"",steps:20,cfgScale:7}},{fetch:mock([{images:["aGVsbG8="]}],calls)});
  assert.match((await g("image",image)).image,/^data:image\/png/);assert.equal(calls[0].payload.negative_prompt,image.negativePrompt);
});
test("RunPod current vLLM worker queues and polls without resubmission",async()=>{
  const calls=[]; const c={...chat,kind:"runpod-vllm",baseUrl:"https://api.runpod.ai/v2/text-test",pollIntervalMs:250};
  const g=createAdapters({text:c,image:disabled()},{env:{TEST_AUTH:"Bearer fake"},fetch:mock([{id:"job",status:"IN_QUEUE"},{id:"job",status:"IN_PROGRESS"},{id:"job",status:"COMPLETED",output:[chatResult]}],calls),sleep:async()=>{}});
  assert.equal((await g("text",text)).text,"The forest glows.");assert.equal(calls.length,3);assert.equal(calls[0].payload.input.route,"/v1/chat/completions");assert.equal(calls[1].method,"GET");assert.equal(calls[0].payload.input.body.model,"qwen");
});
test("RunPod ComfyUI supports current base64 and S3 result formats and explicit failure",async()=>{
  const calls=[];const responses=[{id:"1",status:"COMPLETED",output:{images:[{type:"base64",data:"aGVsbG8="}]}},{id:"2",status:"COMPLETED",output:{images:[{type:"s3_url",data:"https://assets.example/image.png"}]}},{id:"3",status:"FAILED",error:"do not echo secret"}];
  const g=createAdapters({text:disabled(),image:comfyConfig("runpod-comfyui")},{env:{TEST_AUTH:"Bearer fake"},fetch:mock(responses,calls)});
  assert.match((await g("image",image)).image,/^data:/);assert.match((await g("image",image)).image,/^https:/);await assert.rejects(g("image",image),e=>/FAILED/.test(e.message)&&!e.message.includes("secret"));assert.equal(calls[0].payload.input.workflow["6"].inputs.text,image.prompt);
});
test("explicit cancellation requests RunPod cancel; pending is not an automatic timeout",async()=>{
  const calls=[]; const controller=new AbortController();
  const g=createAdapters({text:disabled(),image:comfyConfig("runpod-comfyui")},{env:{TEST_AUTH:"Bearer fake"},fetch:mock([{id:"1",status:"IN_QUEUE"},{}],calls),sleep:async()=>{controller.abort();controller.signal.throwIfAborted();}});
  await assert.rejects(g("image",image,controller.signal));await new Promise(r=>setImmediate(r));assert.ok(calls.some(c=>c.url.endsWith("/cancel/1")));
});
test("ComfyUI polls history and fetches authenticated image from its own server",async()=>{
  const calls=[]; const fetcher=mock([{prompt_id:"p"},{},{p:{status:{completed:true,status_str:"success"},outputs:{9:{images:[{filename:"test.png",subfolder:"",type:"output"}]}}}}],calls);
  const g=createAdapters({text:disabled(),image:comfyConfig("comfyui")},{env:{TEST_AUTH:"Bearer fake"},sleep:async()=>{},fetch:async(u,o)=>u.includes("/view?")?(calls.push({url:u,...o}),new Response(Buffer.from("test"),{headers:{"Content-Type":"image/png"}})):fetcher(u,o)});
  assert.match((await g("image",image)).image,/^data:image/);assert.ok(calls[3].url.startsWith("https://image.example/view?"));assert.equal(calls[3].headers.Authorization,"Bearer fake");
});
test("Vast SDK adapter passes documented input and unwraps response",async()=>{
  const calls=[];const common={endpointName:"test",apiKeyEnv:"VAST_API_KEY",python:"python",cost:100};
  const {baseUrl,authorizationEnv,...textFields}=chat;
  const g=createAdapters({text:{...textFields,...common,kind:"vast-vllm"},image:{...common,kind:"vast-comfyui",workflowFile:workflowPath,outputNode:"9"}},{vast:async(c,p,r)=>{calls.push({p,r});return r.includes("chat")?chatResult:{status:"completed",output:[{node_id:"9",output_type:"images",url:"https://assets.example/forest.png"}]};}});
  assert.equal((await g("text",text)).text,"The forest glows.");assert.equal((await g("image",image)).image,"https://assets.example/forest.png");assert.equal(calls[0].r,"/v1/chat/completions");assert.equal(calls[1].r,"/generate/sync");assert.equal(calls[1].p.workflow_json["6"].inputs.text,image.prompt);
});
test("HTTP errors and uncertain submissions do not resubmit or leak provider body",async()=>{
  for(const response of [{httpStatus:401,data:{secret:"never expose"}},new Error("fake secret")]){
    const calls=[];const g=createAdapters({text:chat,image:disabled()},{env:{TEST_AUTH:"Bearer fake"},fetch:mock([response],calls)});await assert.rejects(g("text",text),e=>!e.message.includes("secret"));assert.equal(calls.length,1);
  }
});
test("browser runtime restores independent choices, applies prefix, image HTML and final callback",async()=>{
  const state=new Map();const context=vm.createContext({EmberGenerationContract:contract,URL,AbortController,setInterval,clearInterval,localStorage:{getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v)},app:{},escapeHtml:s=>s.replace(/&/g,"&amp;").replace(/"/g,"&quot;"),normalizeAiTextOutput:s=>s,log:()=>{},performance,fetch:async(url)=>new Response(JSON.stringify(url.endsWith("text")?{text:"A forest"}:{image:"https://assets.example/f.png?a=1&b=2"}))});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/scripts/app/02a-generation-providers.js"),"utf8")+";globalThis.subject={generationPreferences,runHostedText,generateHostedImageHtml,generationSettingsHtml};",context);
  assert.equal(context.subject.generationPreferences().text,"perchance");context.app.generationPreferences={text:"hosting-proxy",image:"perchance",proxyUrl:"http://127.0.0.1:51840"};
  const streams=[];assert.equal(await context.subject.runHostedText("x",{startWith:"Prefix ",onStream:(...a)=>streams.push(a)},null,()=>false),"Prefix A forest");assert.equal(streams[0][2],true);assert.match(await context.subject.generateHostedImageHtml("forest","",42),/a=1&amp;b=2/);assert.match(context.subject.generationSettingsHtml(),/generation-image/);
});
test("loopback server rejects bad origin, DNS rebind, non-JSON, config reads and traversal",async(t)=>{
  let calls=0;const s=http.createServer(createServer({text:disabled(),image:disabled()},{generate:async()=>{calls++;return{text:"ok"};}}));await new Promise(r=>s.listen(0,"127.0.0.1",r));t.after(()=>s.close());const base=`http://127.0.0.1:${s.address().port}`;
  const post=(headers={})=>fetch(base+"/api/generation/text",{method:"POST",headers:{"Content-Type":"application/json","X-Ember-Generation":"1",...headers},body:JSON.stringify(text)});
  assert.equal((await post({Origin:"https://evil.example"})).status,403);
  const reboundStatus=await new Promise((resolve,reject)=>{const req=http.request(base+"/api/generation/text",{method:"POST",headers:{Host:"evil.example","Content-Type":"application/json","X-Ember-Generation":"1"}},res=>{res.resume();resolve(res.statusCode);});req.on("error",reject);req.end(JSON.stringify(text));});
  assert.equal(reboundStatus,403);assert.equal((await post({"X-Ember-Generation":"0"})).status,403);assert.equal((await fetch(base+"/hosting/config.disabled.example.json")).status,404);assert.equal((await fetch(base+"/characters/..%2fhosting/config.disabled.example.json")).status,404);assert.equal((await post()).status,200);assert.equal(calls,1);
});
test("RunPod deployment lifecycle is dry by default and mocks create/delete without exposing tokens",async()=>{
  const {lifecycle}=require("../hosting/image/runpod-lifecycle.cjs");const stateFile=path.join(tmp,"deployment.local.json");const calls=[];
  assert.equal((await lifecycle("create",{fetch:()=>{throw new Error("must not connect");}})).dryRun,true);
  const fetcher=async(url,options)=>{calls.push({url,...options,payload:options.body?JSON.parse(options.body):undefined});return new Response(options.method==="DELETE"?null:JSON.stringify({id:url.endsWith("templates")?"template-fixture":"endpoint-fixture"}),{status:options.method==="DELETE"?204:200});};
  const options={execute:true,stateFile,image:"fixture/krea:test",volumeId:"volume-fixture",env:{RUNPOD_MANAGEMENT_KEY:"fake-management-token",HF_TOKEN:"fake-hf-token"},fetch:fetcher};
  const result=await lifecycle("create",options);assert.equal(result.endpointId,"endpoint-fixture");assert.equal(calls[1].payload.workersMin,0);assert.equal(calls[1].payload.workersMax,1);assert.equal(calls[0].payload.env.HF_TOKEN,"fake-hf-token");assert.doesNotMatch(fs.readFileSync(stateFile,"utf8"),/token/);
  await assert.rejects(lifecycle("create",options),/already exists/);await lifecycle("delete",options);assert.equal(calls[2].method,"DELETE");assert.equal(calls[3].method,"DELETE");
});
test("official upstream RunPod template embeds reviewed bootstrap without registry publication",async()=>{
  const {lifecycle,upstreamEntrypoint}=require("../hosting/image/runpod-lifecycle.cjs");const stateFile=path.join(tmp,"upstream.local.json"),calls=[];
  const entrypoint=upstreamEntrypoint();assert.equal(entrypoint[0],"python3");assert.match(entrypoint[2],/runpod==1.12.0/);
  const fetcher=async(url,o)=>{calls.push(JSON.parse(o.body));return new Response(JSON.stringify({id:calls.length===1?"t-upstream":"e-upstream"}));};
  await lifecycle("create",{execute:true,stateFile,volumeId:"v-fixture",env:{RUNPOD_MANAGEMENT_KEY:"fake-management",HF_TOKEN:"fake-hf"},fetch:fetcher});
  assert.match(calls[0].imageName,/^lmsysorg\/sglang:nightly/);assert.deepEqual(calls[0].dockerEntrypoint,entrypoint);assert.doesNotMatch(entrypoint[2],/fake-hf|fake-management/);
});
test.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
