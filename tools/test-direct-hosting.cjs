const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const contract = require('../src/contracts/direct-hosting-contract.js');
const {createSession} = require('../src/scripts/integration/direct-hosting-client.js');
const {createDirectWorker,launchUrl} = require('../hosting/direct-worker.cjs');
const origin = 'https://direct-smoke.perchance.org';
const baseUrl = 'https://worker.fixture.test/ea';
const textToken = 't'.repeat(43), imageToken = 'i'.repeat(43), controlKey = 'c'.repeat(43);
const fixture = () => ({version:1,audience:origin,text:{baseUrl,token:textToken,model:'fixture-text'},image:{baseUrl,token:imageToken,model:'fixture-image'},pollIntervalMs:250});
const config = {
    text:{kind:'openai-chat',baseUrl:'http://127.0.0.1:8001/v1',authorizationEnv:'',model:'fixture-text',maxTokens:16384,temperature:0.7,topP:0.8,topK:20,enableThinking:false},
    image:{kind:'sglang-images',baseUrl:'http://127.0.0.1:8002/v1',authorizationEnv:'',model:'fixture-image',steps:8,guidanceScale:1}
};
const textInput = {instruction:'A synthetic quiet forest.',startWith:'',stopSequences:[]};
const imageInput = {prompt:'A synthetic bridge.',negativePrompt:'text',seed:42,width:832,height:1216};
const response = value => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const tick = () => new Promise(resolve=>setImmediate(resolve));
const state = (id,status,result=null,error=null) => ({id,status,result,error});
async function fixtureServer(t,generate) {
    const errors=[];
    const handler=createDirectWorker(config,{baseUrl,controlKey,tokens:{text:textToken,image:imageToken},allowedOrigins:[origin],generate,onError:error=>errors.push(error)});
    const server=http.createServer((req,res)=>handler(req,res).catch(error=>{
        errors.push(error);res.writeHead(500).end();
    }));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>{server.closeAllConnections();server.close();});
    const local=`http://127.0.0.1:${server.address().port}`;
    const call=(route,method='GET',body,token,requestOrigin=origin,headers={})=>fetch(local+'/ea'+route,{
        method,headers:{...(requestOrigin?{Origin:requestOrigin}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} :{}),...headers},body:body===undefined?undefined:JSON.stringify(body)
    });
    const register=async()=>{
        const result=await call('/launches','POST',fixture(),controlKey,null);
        assert.equal(result.status,201);
        return result.json();
    };
    const requests=[];
    const browserFetch=async(url,options)=>{
        assert(url.startsWith(baseUrl+'/'));
        requests.push({url,options});
        return fetch(local+new URL(url).pathname,{...options,headers:{...options.headers,Origin:origin}});
    };
    return {call,register,browserFetch,requests,errors};
}
test('direct launch and manifest use strict HTTPS contracts and reject secret-bearing/ambiguous alternatives',()=>{
    const ticket='s'.repeat(43);
    const url=launchUrl(baseUrl,ticket,'https://perchance.org/emberquest');
    assert.deepEqual(contract.launch(new URL(url).search),{baseUrl,ticket});
    assert.equal(contract.launch('?unrelated=1'),null);
    for(const search of ['?emberDirect='+encodeURIComponent(baseUrl),'?emberTicket='+ticket,'?emberDirect='+encodeURIComponent(baseUrl)+'&emberTicket='+ticket+'&emberHosting=http://localhost:51840'])
        assert.throws(()=>contract.launch(search));
    for(const endpoint of ['http://worker.fixture.test/ea','https://localhost/ea','https://127.0.0.1/ea','https://host.local/ea','https://user:secret@worker.fixture.test/ea','https://worker.fixture.test/ea?key=secret'])
        assert.throws(()=>contract.endpoint(endpoint,'test'));
    assert.throws(()=>contract.manifest({...fixture(),extra:true}));
    assert.throws(()=>contract.manifest({...fixture(),text:{...fixture().text,token:'short'}}));
    assert.throws(()=>contract.submit({id:randomUUID(),role:'image',input:{...imageInput,seed:-1}}));
    assert.throws(()=>contract.job('text',state(randomUUID(),'completed',null)));
    assert.throws(()=>contract.job('text',state(randomUUID(),'running',{text:'premature'})));
});
test('worker preflight and error responses permit only exact configured origins and headers',async t=>{
    const worker=await fixtureServer(t,async()=>{throw new Error('Must not infer');});
    const preflight=await worker.call('/jobs','OPTIONS',undefined,undefined,origin,{
        'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'
    });
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
    assert.equal(preflight.headers.get('vary'),'Origin');
    assert.equal((await worker.call('/jobs','OPTIONS',undefined,undefined,'https://wrong.example')).status,403);
    assert.equal((await worker.call('/jobs','OPTIONS',undefined,undefined,origin,{'Access-Control-Request-Headers':'x-management-key'})).status,403);
    const unauthorized=await worker.call('/jobs','POST',{id:randomUUID(),role:'text',input:textInput});
    assert.equal(unauthorized.status,401);
    assert.equal(unauthorized.headers.get('access-control-allow-origin'),origin);
    const malformed=await worker.call('/jobs','POST',{extra:true},textToken);
    assert.equal(malformed.status,400);
    assert.equal(malformed.headers.get('access-control-allow-origin'),origin);
});
test('one-use claim is audience-bound and browser tokens cannot perform launcher operations',async t=>{
    const worker=await fixtureServer(t,async()=>({text:'ok'}));
    const launch=await worker.register();
    assert.equal((await worker.call('/claim','POST',{ticket:launch.ticket},undefined,'https://wrong.example')).status,403);
    const claimed=await worker.call('/claim','POST',{ticket:launch.ticket});
    assert.equal(claimed.status,200);
    assert.deepEqual(await claimed.json(),fixture());
    assert.equal(claimed.headers.get('cache-control'),'no-store');
    assert.equal((await worker.call('/claim','POST',{ticket:launch.ticket})).status,403);
    assert.equal((await worker.call('/launches','POST',fixture(),textToken,null)).status,403);
    assert.equal((await worker.call('/usage','GET',undefined,imageToken)).status,404);
    assert.equal((await worker.call('/jobs','POST',{id:randomUUID(),role:'image',input:imageInput},textToken)).status,403);
});
test('direct browser client shares one claim for text and images and sends no loopback or management credentials',async t=>{
    const calls=[];
    const worker=await fixtureServer(t,async(role,input)=>{calls.push({role,input});return role==='text'?{text:'A synthetic reply.'}:{image:'data:image/png;base64,aGVsbG8='};});
    const launch=await worker.register();
    const client=createSession(launch,{fetch:worker.browserFetch,audience:origin,sleep:tick});
    const [text,image]=await Promise.all([client.generate('text',textInput),client.generate('image',imageInput)]);
    assert.equal(text.text,'A synthetic reply.');
    assert.equal(image.image,'data:image/png;base64,aGVsbG8=');
    assert.equal(worker.requests.filter(req=>req.url.endsWith('/claim')).length,1);
    assert.equal(worker.requests.filter(req=>req.url.endsWith('/jobs')).length,2);
    assert.deepEqual(calls.find(call=>call.role==='image').input,imageInput);
    for(const {url,options} of worker.requests) {
        assert.equal(new URL(url).protocol,'https:');
        assert.equal(options.credentials,'omit');
        assert.equal(options.referrerPolicy,'no-referrer');
        assert.equal(options.redirect,'error');
        assert(!JSON.stringify(options).includes(controlKey));
        assert.equal(options.targetAddressSpace,undefined);
    }
});
test('pending jobs survive submission socket closure and only explicit cancellation aborts them',async t=>{
    let signal,release,started;
    const ready=new Promise(resolve=>started=resolve);
    const result=new Promise(resolve=>release=resolve);
    const worker=await fixtureServer(t,async(role,input,jobSignal)=>{signal=jobSignal;started();return result;});
    const id=randomUUID();
    const accepted=await worker.call('/jobs','POST',{id,role:'text',input:textInput},textToken);
    assert.equal(accepted.status,202);
    await accepted.json();await ready;
    assert.equal(signal.aborted,false);
    assert.equal((await worker.call('/jobs','POST',{id,role:'text',input:textInput},textToken)).status,409);
    assert.equal((await worker.call('/jobs/'+id,'GET',undefined,imageToken)).status,404);
    const running=await worker.call('/jobs/'+id,'GET',undefined,textToken);
    assert.equal((await running.json()).status,'running');
    assert.equal(signal.aborted,false);
    const cancelled=await worker.call('/jobs/'+id+'/cancel','POST',{},textToken);
    assert.equal((await cancelled.json()).status,'cancelled');
    assert.equal(signal.aborted,true);
    release({text:'late result'});await tick();
    assert.equal((await (await worker.call('/jobs/'+id,'GET',undefined,textToken)).json()).status,'cancelled');
    const usage=await (await worker.call('/usage','GET',undefined,controlKey,null)).json();
    assert.equal(usage.text.accepted,1);
});
test('temporary status transport errors keep polling the same job without generation retries or automatic cancellation',async()=>{
    const id=randomUUID();let posts=0,polls=0;
    const diagnostics=[];
    const client=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,uuid:()=>id,sleep:tick,onDiagnostic:detail=>diagnostics.push(detail),fetch:async(url,options)=>{
        if(url.endsWith('/claim'))return response(fixture());
        if(options.method==='POST'){posts++;return response(state(id,'running'));}
        polls++;
        if(polls<=2)throw new TypeError('Synthetic lost connection');
        return response(state(id,'completed',{text:'finished'}));
    }});
    assert.equal((await client.generate('text',textInput)).text,'finished');
    assert.equal(posts,1);assert.equal(polls,3);assert.equal(diagnostics.length,1);
});
test('uncertain submission failure includes its stable job ID and never resubmits',async()=>{
    const id=randomUUID();let posts=0;
    const client=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,uuid:()=>id,fetch:async(url)=>{
        if(url.endsWith('/claim'))return response(fixture());
        posts++;throw new TypeError('Synthetic connection lost');
    }});
    await assert.rejects(client.generate('text',textInput),error=>error.message.includes(id)&&error.message.includes('No generation retry'));
    assert.equal(posts,1);
});
test('claim failures are not retried and diagnostics never expose ticket or inference tokens',async()=>{
    let claims=0;
    const ticket='s'.repeat(43);
    const client=createSession({baseUrl,ticket},{audience:origin,fetch:async()=>{claims++;throw new Error(ticket+textToken);}});
    for(let i=0;i<2;i++)await assert.rejects(client.connection(),error=>!error.message.includes(ticket)&&!error.message.includes(textToken));
    assert.equal(claims,1);
    const logs=[];
    const id=randomUUID();
    const failed=createSession({baseUrl,ticket},{audience:origin,uuid:()=>id,onDiagnostic:detail=>logs.push(detail),fetch:async(url)=>response(url.endsWith('/claim')?fixture():state(id,'failed',null,textToken+imageToken))});
    await assert.rejects(failed.generate('text',textInput),error=>!error.message.includes(textToken)&&!error.message.includes(imageToken));
    assert(!JSON.stringify(logs).includes(textToken));
});
test('explicit browser cancellation issues only a job-specific cancel request',async()=>{
    const id=randomUUID(),controller=new AbortController();let cancel=0,submit=0;
    const client=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,uuid:()=>id,sleep:async()=>controller.abort(),fetch:async(url,options)=>{
        if(url.endsWith('/claim'))return response(fixture());
        if(url.endsWith('/cancel')){cancel++;return response(state(id,'cancelled'));}
        if(options.method==='POST'){submit++;return response(state(id,'running'));}
        options.signal.throwIfAborted();
    }});
    await assert.rejects(client.generate('text',textInput,{signal:controller.signal}),error=>error.name==='AbortError');
    await tick();assert.equal(cancel,1);assert.equal(submit,1);
});
test('cancelling while a shared claim is pending returns before inference without cancelling other callers',async()=>{
    let finishClaim,announce;const started=new Promise(resolve=>announce=resolve);
    const held=new Promise(resolve=>finishClaim=resolve);
    const controller=new AbortController();let requests=0;
    const client=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,fetch:async()=>{
        requests++;announce();await held;return response(fixture());
    }});
    const waiting=client.generate('text',textInput,{signal:controller.signal});
    await started;controller.abort();
    await assert.rejects(waiting,error=>error.name==='AbortError');
    finishClaim();assert.equal((await client.connection()).text.model,'fixture-text');
    assert.equal(requests,1);
});
test('strict audience mismatch and malformed worker responses fail before extra generation',async()=>{
    let submits=0;
    const client=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:'https://other.example',fetch:async()=>{submits++;return response(fixture());}});
    await assert.rejects(client.generate('text',textInput),/different game origin/);
    assert.equal(submits,1);
    const malformedManifest=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,fetch:async()=>response({...fixture(),extra:true})});
    await assert.rejects(malformedManifest.connection(),/connection.extra is unknown/);
    const invalid=createSession({baseUrl,ticket:'s'.repeat(43)},{audience:origin,fetch:async(url)=>response(url.endsWith('/claim')?fixture():{...state(randomUUID(),'running'),extra:true})});
    await assert.rejects(invalid.generate('text',textInput),/job.extra is unknown/);
});
function declaration(file,name) {
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const match=new RegExp(`(?:async )?function ${name}\\(`).exec(source);
    assert(match,name);let text='';
    for(const line of source.slice(match.index).split('\n')) {
        text+=line+'\n';
        try{new vm.Script(text);return text;}catch(error){if(!(error instanceof SyntaxError))throw error;}
    }
    throw new Error('Unterminated '+name);
}
test('developer diagnostic exports redact one-use launch URLs and direct connection credentials',()=>{
    const context=vm.createContext({});
    vm.runInContext(declaration('src/scripts/app/04-story-runtime.js','scrubDiagnosticSecrets'),context);
    const ticket='s'.repeat(43);
    const scrubbed=context.scrubDiagnosticSecrets({url:launchUrl(baseUrl,ticket,'https://perchance.org/emberquest'),ticket,connection:fixture()});
    assert(!scrubbed.includes(ticket));
    assert(!scrubbed.includes(textToken));
    assert(!scrubbed.includes(imageToken));
    assert(scrubbed.includes(baseUrl)||scrubbed.includes(encodeURIComponent(baseUrl)));
});
test('actual EA launch, text executor and image wrapper use direct HTTPS without changing saved preferences or storing credentials',async()=>{
    const ticket='s'.repeat(43),search=new URL(launchUrl(baseUrl,ticket,'https://perchance.org/emberquest')).search;
    let claims=0;const requests=[],scrubbed=[],stored=new Map();
    const context=vm.createContext({
        EmberGenerationContract:require('../src/contracts/generation-contract.js'),EmberDirectHostingContract:contract,
        URL,URLSearchParams,AbortController,DOMException,setInterval,clearInterval,performance,
        crypto:{getRandomValues:array=>{array[0]=123;return array;}},Uint32Array,
        window:{location:{search,origin,href:origin+'/emberquest'+search},history:{replaceState:(...args)=>scrubbed.push(args)}},
        app:{settings:{ollama:{provider:'ollama'}},cancelledAiMessageIds:new Set()},
        localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)},
        normalizeAiTextOutput:value=>value,log:()=>{},recordStorageFailure:()=>{},devLog:()=>{},
        aiPromptDevLogDetail:()=>'',inferAiLabel:()=> 'fixture',aiLogType:()=> 'ai',
        perchancePlugin:()=>{throw new Error('No Perchance fallback');},
        perchancePluginPromptValue:value=>value,devSmokeCurrentScenarioAllowsImageRequests:()=>true,
        document:{createElement:()=>({get outerHTML(){return this.src;}})}
    });
    context.EmberDirectHostingClient={createSession:launch=>({
        connection:async()=>{claims++;return fixture();},
        generate:async(role,input,options)=>{requests.push({role,input});options.onStatus({id:randomUUID(),status:'completed',endpoint:baseUrl,model:'fixture'});return role==='text'?{text:'Direct response.'}:{image:'data:image/png;base64,aGVsbG8='};}
    })};
    vm.runInContext(fs.readFileSync(path.join(root,'src/scripts/app/02a-generation-providers.js'),'utf8'),context);
    const queue='src/scripts/app/10-state-ai-queue.js';
    vm.runInContext(['exactTextProvider','currentLaunchTextProvider','runAiTextNow'].map(name=>declaration(queue,name)).join('\n'),context);
    assert.equal(context.currentLaunchTextProvider(),'direct-provider');
    Object.assign(context,{
        finalAiTextInstruction:value=>value,pauseBackgroundStateSyncForAi:()=>{},
        standardAiTimingText:()=>'',aiLogTitle:()=>'',render:()=>{},
        preemptBackgroundStateAiForPriority:()=>{},runNextAiTextRequest:()=>{},aiProcessLabel:()=> 'fixture'
    });
    context.app.aiQueue=[];
    vm.runInContext(declaration(queue,'enqueueAiTextRequest'),context);
    context.enqueueAiTextRequest('queued fixture',{label:'fixture'});
    const queued=context.app.aiQueue[0];
    assert.equal(queued.provider,'direct-provider');
    assert.equal(queued.directHostingSession,context.currentDirectHostingSession());
    assert(!Object.keys(queued).includes('directHostingSession'));
    assert(!JSON.stringify(queued).includes(textToken));
    assert.equal(await context.runAiTextNow('fixture'),'Direct response.');
    vm.runInContext(declaration('src/scripts/app/13-state-patches.js','generateImageHtml'),context);
    assert.equal(await context.generateImageHtml('Synthetic forest','text','random','fantasy-rpg',{resolution:'512x768'}),'data:image/png;base64,aGVsbG8=');
    assert.equal(requests[1].input.seed,123);
    assert.equal(requests[1].input.width,832);
    assert.equal(stored.size,0);
    assert(!scrubbed[0][2].includes(ticket));
    assert(new URL(scrubbed[0][2]).searchParams.has('emberDirect'));
    assert.throws(()=>contract.launch(new URL(scrubbed[0][2]).search),/exactly one/);
    assert(!JSON.stringify(context.generationPreferences()).includes(ticket));
    assert.equal(claims,1);
});