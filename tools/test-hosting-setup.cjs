const {test}=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {spawn}=require("node:child_process");
const readline=require("node:readline");
const path=require("node:path");
const {validateHandoff,applyHandoff,validateDemoHandoff,applyDemoHandoff,credentials}=require("../hosting/handoff.cjs");
const {sessionHandler}=require("../hosting/session-server.cjs");
const config=()=>({text:{kind:"disabled"},image:{kind:"disabled"}});
const handoff=provider=>({version:1,provider,url:"https://endpoint.example/v1/chat/completions",model:"ember-qwen-27b"});
test("strict non-secret endpoint handoff preserves URL prefix and image configuration",()=>{
  const source=config();source.image={kind:"sglang-images",baseUrl:"http://127.0.0.1:30000/v1",authorizationEnv:"",model:"krea/Krea-2-Turbo",steps:8,guidanceScale:1};
  const h={...handoff("vast"),url:"https://openai.vast.ai/endpoint-name/v1/chat/completions"};const actual=applyHandoff(source,h);
  assert.equal(actual.text.baseUrl,"https://openai.vast.ai/endpoint-name/v1");assert.equal(actual.text.model,"ember-qwen-27b");assert.deepEqual(actual.image,source.image);
  for(const change of [{api_key:"never-persist"},{url:"https://key@endpoint.example/v1/chat/completions"},{url:"https://endpoint.example/v1/chat/completions?key=never"},{url:"http://remote.example/v1/chat/completions"},{version:2}])assert.throws(()=>validateHandoff({...h,...change}));
});
test("RunPod gateway asks for two distinct session credentials and preserves existing text sampling",()=>{
  const first=applyHandoff(config(),handoff("openai"));first.text.maxTokens=1200;
  const second=applyHandoff(first,handoff("runpod_lb"));assert.equal(second.text.maxTokens,1200);
  assert.deepEqual(credentials(second).map(c=>c.kind),["bearer-key","raw-key"]);
  assert.equal(credentials(applyHandoff(config(),handoff("vast"))).length,1);
});
test("actual demo relay handoff schema routes through its local provider prefix and asks only for a relay key",()=>{
  const handoff={provider:"runpod-serverless",mock:true,model:"ember-qwen-27b",base_url:"http://127.0.0.1:9001/runpod-serverless/v1",credentials:"Local session only; launcher supplies relay key. No cloud key in browser/config.",runtime:"llama.cpp Q5_K_M, 32768 context, FP16 KV, one sequence",remote_verified:false};
  const actual=applyDemoHandoff(config(),handoff);assert.equal(actual.text.baseUrl,handoff.base_url);assert.equal(actual.text.authorizationEnv,"EMBER_LAUNCH_RELAY_AUTHORIZATION");assert.equal(credentials(actual).length,1);assert.match(credentials(actual)[0].label,/relay key/);
  assert.throws(()=>validateDemoHandoff({...handoff,base_url:"https://remote.example/runpod-serverless/v1"}));assert.throws(()=>validateDemoHandoff({...handoff,api_key:"fake-never-read"}));
});
test("session landing page contains no credentials and startup makes no generation request",async t=>{
  let calls=0;const c=applyHandoff(config(),handoff("runpod_lb"));const secrets={EMBER_LAUNCH_AUTHORIZATION:"Bearer test-session-only-credential",EMBER_LAUNCH_GATEWAY_KEY:"test-other-session-key"};
  const s=http.createServer(sessionHandler(c,secrets,{generate:async()=>{calls++;return{text:"fixture"};}}));await new Promise(r=>s.listen(0,"127.0.0.1",r));t.after(()=>s.close());
  const base=`http://127.0.0.1:${s.address().port}`;const response=await fetch(base+"/launch"),html=await response.text();
  assert.match(html,/Open Lite with hosted text/);assert.doesNotMatch(html,/test-session-only-credential|test-other-session-key/);assert.equal(calls,0);assert.equal(response.headers.get("cache-control"),"no-store");
  assert.match(html,/\.\.\.prefs,text:'hosting-proxy'/);assert.equal((await fetch(base+"/hosting/config.local.json")).status,404);
  const generated=await fetch(base+"/api/generation/text",{method:"POST",headers:{"Content-Type":"application/json","X-Ember-Generation":"1"},body:JSON.stringify({instruction:"fixture",startWith:"",stopSequences:[]})});assert.equal(generated.status,200);assert.equal(calls,1);
});
function childSession(payload,args=[]){
  const child=spawn(process.execPath,[path.join(__dirname,"../hosting/session-server.cjs"),...args],{stdio:["pipe","pipe","pipe"],windowsHide:true});
  const lines=readline.createInterface({input:child.stdout});
  const first=new Promise((resolve,reject)=>{lines.once("line",line=>resolve(JSON.parse(line)));child.once("error",reject);});
  const exited=new Promise(resolve=>child.once("exit",resolve));child.stdin.write(JSON.stringify(payload)+"\n");return{child,first,exited};
}
test("real local session process starts and shuts down without contacting a provider",async()=>{
  const s=childSession({config:config(),secrets:{},port:0});const status=await s.first;assert.equal(status.ready,true);
  const health=await fetch(status.url.replace("/launch","/api/generation/status"));assert.equal((await health.json()).remoteVerified,false);
  s.child.stdin.end("shutdown\n");assert.equal(await s.exited,0);
});
test("occupied port and invalid configuration fail safely without echoing secret input",async t=>{
  const busy=http.createServer();await new Promise(r=>busy.listen(0,"127.0.0.1",r));t.after(()=>busy.close());
  const s=childSession({config:config(),secrets:{},port:busy.address().port});assert.equal((await s.first).ready,false);assert.equal(await s.exited,1);
  const invalid=childSession({config:config(),handoff:{...handoff("openai"),api_key:"do-not-echo-this-key"}},["--prepare"]);const result=await invalid.first;assert.equal(result.ready,false);assert.doesNotMatch(JSON.stringify(result),/do-not-echo/);assert.equal(await invalid.exited,1);
});
