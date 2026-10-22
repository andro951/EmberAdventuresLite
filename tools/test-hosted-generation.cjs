const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const contract = require('../src/contracts/generation-contract.js');
const directContract = require('../src/contracts/direct-hosting-contract.js');
const {createServer, launchUrl} = require('../hosting/server.cjs');
const {createAdapters} = require('../hosting/adapters.cjs');
const {prepare} = require('../hosting/session-server.cjs');
const disabled = {text:{kind:'disabled'}, image:{kind:'disabled'}};
const instruction = {instruction:'Describe a quiet forest.', startWith:'', stopSequences:[]};
const picture = {prompt:'A forest bridge.', negativePrompt:'text, watermark', seed:42, width:832, height:1216};
const json = data => new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}});
function declaration(file, name) {
    const source = fs.readFileSync(path.join(root,file),'utf8');
    const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
    assert(match, name);
    let candidate='';
    for (const line of source.slice(match.index).split('\n')) {
        candidate += line+'\n';
        try { new vm.Script(candidate); return candidate; }
        catch(error) { if (!(error instanceof SyntaxError)) throw error; }
    }
    throw new Error(`Unterminated declaration ${name}`);
}
function runtime(search='', extra={}) {
    const saved = new Map();
    const calls = [];
    const context=vm.createContext({
        EmberGenerationContract:contract, EmberDirectHostingContract:directContract, URL, URLSearchParams, AbortController, DOMException,
        setInterval, clearInterval, performance, structuredClone,
        window:{location:{search}}, app:{settings:{ollama:{provider:'ollama'}}},
        localStorage:{getItem:key=>saved.get(key)??null, setItem:(key,value)=>saved.set(key,value)},
        normalizeAiTextOutput:text=>text, aiCancelledError:()=>Object.assign(new Error('cancelled'),{name:'AbortError'}),
        log:()=>{}, recordStorageFailure:()=>{},
        document:{createElement:()=>({src:'',alt:'',get outerHTML(){return this.src;}})},
        fetch:async(url,options)=>{calls.push({url,options});return json(url.endsWith('/text')?{text:'The forest is quiet.'}:{image:'https://assets.example/forest.png'});},
        ...extra
    });
    vm.runInContext(fs.readFileSync(path.join(root,'src/scripts/app/02a-generation-providers.js'),'utf8'),context);
    return {context,saved,calls};
}

test('launch choices are session-only and override saved routes without changing them',()=>{
    const {context,saved}=runtime('?emberHosting=http%3A%2F%2F127.0.0.1%3A51840');
    const stored=JSON.stringify({text:'game',image:'perchance',proxyUrl:'http://localhost:51841'});
    saved.set('emberadventureslite-generation-v1',stored);
    assert.equal(context.generationPreferences().text,'hosting-proxy');
    assert.equal(context.generationPreferences().image,'hosting-proxy');
    assert.equal(saved.get('emberadventureslite-generation-v1'),stored);
    context.window.location.search='';
    assert.equal(context.generationPreferences().text,'game');
    assert.equal(context.generationPreferences().proxyUrl,'http://localhost:51841');
});

test('early settings initialization does not access later hosting constants or parse the launch before recovery is bound',()=>{
    const source=fs.readFileSync(path.join(root,'src/scripts/app/02-settings-voices.js'),'utf8');
    const assignment=source.match(/app\.settings\.textProvider = [^;]+;/)[0];
    const module=fs.readFileSync(path.join(root,'src/scripts/app/02a-generation-providers.js'),'utf8');
    const context=vm.createContext({app:{settings:{ollama:{provider:'ollama'}}},
        EmberGenerationContract:contract,window:{location:{search:'?emberHosting=invalid'}},
        localStorage:{getItem:()=>null},URL,URLSearchParams});
    vm.runInContext(declaration('src/scripts/app/10-state-ai-queue.js','exactTextProvider')+assignment+'\n'+module,context);
    assert.equal(context.app.settings.textProvider,'ollama');
    assert.throws(()=>context.generationPreferences());
});
test('invalid launch URLs fail instead of falling back or exposing credentials',()=>{
    for(const query of ['?emberHosting=','?emberHosting=https://remote.example','?emberHosting=http://secret@127.0.0.1:51840','?emberHosting=http://127.0.0.1:51840/path','?emberHosting=http://127.0.0.1:51840&emberHosting=http://localhost:51840'])
        assert.throws(()=>contract.launchPreferences(query));
    assert.equal(contract.launchPreferences('?unrelated=1'),null);
    assert.throws(()=>contract.request('text',{...instruction,key:'do not transmit'}));
    assert.throws(()=>contract.response('image',{image:'javascript:alert(1)'}));
});
test('native routing preserves Ollama and explicit Perchance; hosting is selectable',()=>{
    const {context,saved}=runtime();
    vm.runInContext(declaration('src/scripts/app/10-state-ai-queue.js','exactTextProvider')+declaration('src/scripts/app/10-state-ai-queue.js','currentLaunchTextProvider'),context);
    assert.equal(context.currentLaunchTextProvider(),'ollama');
    saved.set('emberadventureslite-generation-v1',JSON.stringify({text:'perchance',image:'perchance',proxyUrl:'http://localhost:51840'}));
    assert.equal(context.currentLaunchTextProvider(),'perchance');
    context.window.location.search='?emberHosting=http://127.0.0.1:51840';
    assert.equal(context.currentLaunchTextProvider(),'hosting-proxy');
});

function settingsDocument() {
    const elements=[];
    const document={createElement:tag=>{
        const element={tagName:tag,children:[],dataset:{},events:{},textContent:'',value:'',disabled:false,
            append(...children){this.children.push(...children);},
            setAttribute(key,value){this[key]=value;},
            addEventListener(name,callback){this.events[name]=callback;}
        };
        elements.push(element);
        return element;
    }};
    return {document,elements};
}

test('actual settings controls autosave, reject invalid drafts, and lock session launches',()=>{
    const {document,elements}=settingsDocument();
    const {context,saved}=runtime('',{document});
    const parent=document.createElement('div');
    context.appendGenerationSettings(parent);
    const find=id=>elements.find(element=>element.id===id);
    find('generation-text').value='hosting-proxy';
    find('generation-text').events.change();
    const stored=saved.get('emberadventureslite-generation-v1');
    assert.equal(JSON.parse(stored).text,'hosting-proxy');
    find('generation-proxyUrl').value='https://wrong.example';
    find('generation-proxyUrl').events.change();
    assert.equal(saved.get('emberadventureslite-generation-v1'),stored);
    assert(elements.find(element=>element.role==='status').textContent.includes('loopback'));
    const session=settingsDocument();
    const launched=runtime('?emberHosting=http://127.0.0.1:51840',{document:session.document});
    launched.context.appendGenerationSettings(session.document.createElement('div'));
    assert(session.elements.filter(element=>element.id).every(element=>element.disabled));
    assert.equal(launched.saved.size,0);
});
test('queued requests snapshot the hosted endpoint and actual route',()=>{
    const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{
        finalAiTextInstruction:x=>x, inferAiLabel:()=> 'fixture', aiLogType:()=> 'ai',
        pauseBackgroundStateSyncForAi:()=>{}, standardAiTimingText:()=>'', aiLogTitle:()=>'',
        render:()=>{}, preemptBackgroundStateAiForPriority:()=>{}, runNextAiTextRequest:()=>{},
        aiProcessLabel:()=> 'fixture'
    });
    context.app.aiQueue=[];
    vm.runInContext(['exactTextProvider','currentLaunchTextProvider','enqueueAiTextRequest'].map(name=>declaration('src/scripts/app/10-state-ai-queue.js',name)).join('\n'),context);
    context.enqueueAiTextRequest(instruction.instruction,{label:'fixture'});
    context.window.location.search='?emberHosting=http://127.0.0.1:51841';
    assert.equal(context.app.aiQueue[0].provider,'hosting-proxy');
    assert.equal(context.app.aiQueue[0].hostingProxyUrl,'http://127.0.0.1:51840');
    assert.equal(context.app.aiQueue[0].providerEndpoint,'http://127.0.0.1:51840');
});
test('hosted text preserves prefix, stops, final callback, and exact bridge request',async()=>{
    const {context,calls}=runtime('?emberHosting=http://127.0.0.1:51840');
    const streams=[];
    const active={hostingProxyUrl:'http://localhost:51841'};
    const result=await context.runHostedText(instruction.instruction,{startWith:'Opening: ',stopSequences:['END'],onStream:(...args)=>streams.push(args)},active,()=>false);
    assert.equal(result,'Opening: The forest is quiet.');
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'http://localhost:51841/api/generation/text');
    assert.deepEqual(JSON.parse(calls[0].options.body),{instruction:instruction.instruction,startWith:'Opening: ',stopSequences:['END']});
    assert.equal(calls[0].options.headers['X-Ember-Generation'],'1');
    assert.equal(calls[0].options.targetAddressSpace,'loopback');
    assert.equal(streams[0][2],true);
    assert.equal(active.pluginAttempts,1);
});
test('the actual game text executor uses its queued route without invoking Perchance or Ollama',async()=>{
    const {context,calls}=runtime('',{
        inferAiLabel:()=> 'fixture', aiLogType:()=> 'ai', devLog:()=>{}, aiPromptDevLogDetail:()=>'',
        perchancePlugin:()=>{throw new Error('Perchance must not be used');},
        EmberOllamaClient:{generate:()=>{throw new Error('Ollama must not be used');}}
    });
    context.app.cancelledAiMessageIds=new Set();
    const options={label:'fixture'};
    context.app.aiActive={opts:options,provider:'hosting-proxy',hostingProxyUrl:'http://localhost:51841'};
    vm.runInContext(declaration('src/scripts/app/10-state-ai-queue.js','exactTextProvider')+declaration('src/scripts/app/10-state-ai-queue.js','runAiTextNow'),context);
    assert.equal(await context.runAiTextNow('fixture',options),'The forest is quiet.');
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,'http://localhost:51841/api/generation/text');
});
test('bridge rejection and uncertain failures are not retried',async()=>{
    let calls=0;
    for(const fail of [async()=>new Response(JSON.stringify({error:'Allowance exhausted.'}),{status:429}),async()=>{throw new TypeError('fetch failed');}]) {
        const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{fetch:async()=>{calls++;return fail();}});
        await assert.rejects(context.runHostedText('fixture',{},null,()=>false),/Allowance|outcome may be uncertain/);
    }
    assert.equal(calls,2);
});
test('explicit cancellation aborts the in-flight request',async()=>{
    let announce;
    const started=new Promise(resolve=>announce=resolve);
    const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{fetch:async(url,{signal})=>new Promise((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(Object.assign(new Error('cancelled'),{name:'AbortError'})),{once:true});announce();
    })});
    const options={};
    const pending=context.runHostedText('fixture',options,null,()=>false);
    await started;
    options.abortProvider();
    await assert.rejects(pending,/cancelled/);
    assert.equal(options.abortProvider,undefined);
});
test('hosted image requests serialize without changing prompt, seed, or explicit dimensions',async()=>{
    let active=0,max=0;
    const requests=[];
    const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{fetch:async(url,options)=>{
        active++;max=Math.max(max,active);requests.push(JSON.parse(options.body));
        await new Promise(resolve=>setImmediate(resolve));active--;return json({image:'data:image/png;base64,aGVsbG8='});
    }});
    await Promise.all([
        context.generateHostedImageHtml('One |[character]|','text, watermark',42,{resolution:'512x768'}),
        context.generateHostedImageHtml('Two','',0,{resolution:'768x768'}),
        context.generateHostedImageHtml('Three','',-1,{resolution:'1024x576'})
    ]);
    assert.equal(max,1);
    assert.deepEqual(requests.map(r=>[r.prompt,r.seed,r.width,r.height]),[['One |[character]|',42,832,1216],['Two',0,1024,1024],['Three',-1,1024,576]]);
});
test('a failed hosted image does not retry or poison the next queued request',async()=>{
    let calls=0;
    const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{fetch:async()=>++calls===1?new Response(JSON.stringify({error:'failed'}),{status:502}):json({image:'https://assets.example/ok.png'})});
    const first=context.generateHostedImageHtml('First','',1);
    const second=context.generateHostedImageHtml('Second','',2);
    await assert.rejects(first,/failed/);
    assert.equal(await second,'https://assets.example/ok.png');
    assert.equal(calls,2);
});
test('the actual game image wrapper uses hosting without requiring a Perchance plugin',async()=>{
    const {context}=runtime('?emberHosting=http://127.0.0.1:51840',{
        perchancePlugin:()=>{throw new Error('Perchance must not be used');},
        perchancePluginPromptValue:value=>value, devSmokeCurrentScenarioAllowsImageRequests:()=>true
    });
    vm.runInContext(declaration('src/scripts/app/13-state-patches.js','generateImageHtml'),context);
    assert.equal(await context.generateImageHtml('A bridge','text',42,'fantasy-rpg',{resolution:'512x768'}),'https://assets.example/forest.png');
});
test('bridge supports exact public origins and preflight, and exposes no game/config files',async t=>{
    let calls=0;
    const site=require('../hosting/live-site.json');
    const server=http.createServer(createServer(disabled,{generate:async role=>{calls++;return role==='text'?{text:'ok'}:{image:'https://assets.example/a.png'};}}));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>{server.closeAllConnections();server.close();});
    const base=`http://127.0.0.1:${server.address().port}`;
    const preflight=await fetch(base+'/api/generation/text',{method:'OPTIONS',headers:{Origin:site.game_origin,'Access-Control-Request-Private-Network':'true'}});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('access-control-allow-origin'),site.game_origin);
    assert.equal(preflight.headers.get('access-control-allow-private-network'),'true');
    const post=origin=>fetch(base+'/api/generation/text',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Ember-Generation':'1'},body:JSON.stringify(instruction)});
    assert.equal((await post('https://untrusted.example')).status,403);
    assert.equal((await post(site.game_origin)).status,200);
    assert.equal(calls,1);
    for(const file of ['/','/bottom.html','/hosting/config.local.json','/src/contracts/generation-contract.js'])
        assert.equal((await fetch(base+file)).status,404);
});
test('adapter queues and polls one RunPod job and does not expose upstream failure bodies',async()=>{
    const config={text:{kind:'runpod-vllm',baseUrl:'https://api.runpod.ai/v2/fixture',authorizationEnv:'TEST_TOKEN',model:'ember-qwen-27b',maxTokens:800,temperature:0.7,topP:0.8,topK:20,enableThinking:null,pollIntervalMs:250},image:{kind:'disabled'}};
    const calls=[];
    const responses=[{id:'fixture',status:'IN_QUEUE'},{id:'fixture',status:'COMPLETED',output:[{choices:[{finish_reason:'stop',message:{content:'A bridge.'}}]}]}];
    const adapter=createAdapters(config,{env:{TEST_TOKEN:'Bearer fixture-only'},sleep:async()=>{},fetch:async(url,options)=>{calls.push({url,options});return json(responses.shift());}});
    assert.equal((await adapter('text',instruction)).text,'A bridge.');
    assert.equal(calls.length,2);
    assert(calls[0].url.endsWith('/run'));
    assert(calls[1].url.endsWith('/status/fixture'));
    const submitted=JSON.parse(calls[0].options.body).input.body;
    assert.equal(submitted.messages[1].content,instruction.instruction);
    assert(!/safe for work|general-audience/i.test(submitted.messages[0].content));
    let failures=0;
    const rejected=createAdapters(config,{env:{TEST_TOKEN:'Bearer fixture-only'},fetch:async()=>{failures++;return new Response('secret upstream body',{status:403});}});
    await assert.rejects(rejected('text',instruction),error=>/403/.test(error.message)&&!error.message.includes('secret'));
    assert.equal(failures,1);
});

test('RunPod image adapter preserves fixed seed and dimensions in one queued job',async()=>{
    const config={text:{kind:'disabled'},image:{kind:'runpod-sglang-images',baseUrl:'https://api.runpod.ai/v2/fixture-image',authorizationEnv:'TEST_TOKEN',model:'fixture-image-model',steps:8,guidanceScale:1,pollIntervalMs:250}};
    const calls=[];
    const responses=[{id:'image-fixture',status:'IN_QUEUE'},{id:'image-fixture',status:'COMPLETED',output:{data:[{b64_json:'aGVsbG8='}]}}];
    const adapter=createAdapters(config,{env:{TEST_TOKEN:'Bearer fixture-only'},sleep:async()=>{},fetch:async(url,options)=>{
        calls.push({url,options});return json(responses.shift());
    }});
    const result=await adapter('image',picture);
    assert.equal(result.image,'data:image/png;base64,aGVsbG8=');
    assert.equal(calls.length,2);
    assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-only');
    assert.deepEqual(JSON.parse(calls[0].options.body).input,{model:'fixture-image-model',prompt:picture.prompt,negative_prompt:picture.negativePrompt,seed:42,size:'832x1216',n:1,response_format:'b64_json',output_format:'png',num_inference_steps:8,guidance_scale:1});
});

test('endpoint preparation allows full structured answers without overriding explicit sampling',()=>{
    const handoff={version:1,provider:'openai',url:'https://fixture.example/v1/chat/completions',model:'fixture-model'};
    const initial=prepare({config:disabled,handoff});
    assert.equal(initial.config.text.maxTokens,16384);
    assert.equal(initial.config.text.enableThinking,false);
    const explicit=structuredClone(initial.config);
    Object.assign(explicit.text,{maxTokens:4096,temperature:0.2,enableThinking:true});
    const prepared=prepare({config:explicit,handoff});
    assert.equal(prepared.config.text.maxTokens,4096);
    assert.equal(prepared.config.text.temperature,0.2);
    assert.equal(prepared.config.text.enableThinking,true);
    const {validateConfig}=require('../hosting/adapters.cjs');
    for(const name of fs.readdirSync(path.join(root,'hosting')).filter(name=>/^config\..*\.example\.json$/.test(name)))
        validateConfig(JSON.parse(fs.readFileSync(path.join(root,'hosting',name),'utf8')));
});

test('bridge rejects malformed payloads before inference and prevents concurrent jobs',async t=>{
    let release;
    let announce;
    let count=0;
    const started=new Promise(resolve=>announce=resolve);
    const blocked=new Promise(resolve=>release=resolve);
    const server=http.createServer(createServer(disabled,{generate:async()=>{
        count++;announce();await blocked;return {text:'ok'};
    }}));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>{release();server.closeAllConnections();server.close();});
    const url=`http://127.0.0.1:${server.address().port}/api/generation/text`;
    const post=payload=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Ember-Generation':'1'},body:JSON.stringify(payload)});
    assert.equal((await post({...instruction,unexpected:true})).status,400);
    assert.equal(count,0);
    const first=post(instruction);
    await started;
    assert.equal((await post(instruction)).status,409);
    assert.equal(count,1);
    release();
    assert.equal((await first).status,200);
});
test('session bridge reports the published URL directly and stops on stdin shutdown',async t=>{
    const child=spawn(process.execPath,[path.join(root,'hosting/session-server.cjs')],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    t.after(()=>child.kill());
    const ready=new Promise((resolve,reject)=>{
        let output='';child.stdout.on('data',data=>{output+=data;const end=output.indexOf('\n');if(end>=0)resolve(JSON.parse(output.slice(0,end)));});child.on('error',reject);
    });
    child.stdin.write(JSON.stringify({config:disabled,secrets:{},port:0})+'\n');
    const result=await ready;
    assert.equal(result.ready,true);
    const url=new URL(result.url);
    assert.equal(url.origin+url.pathname,'https://perchance.org/emberadventureslite');
    const bridge=url.searchParams.get('emberHosting');
    assert.equal((await fetch(bridge+'/api/generation/status')).status,200);
    const ended=new Promise(resolve=>child.on('exit',resolve));
    child.stdin.write('shutdown\n');
    await ended;
    assert.equal(launchUrl('http://127.0.0.1:51840'),'https://perchance.org/emberadventureslite?emberHosting=http%3A%2F%2F127.0.0.1%3A51840');
});
