"use strict";
const fs=require("node:fs");
const http=require("node:http");
const readline=require("node:readline");
const path=require("node:path");
const {createServer}=require("./server.cjs");
const {validateConfig}=require("./adapters.cjs");
const contract=require("../src/contracts/generation-contract.js");
const {applyHandoff,applyDemoHandoff,credentials}=require("./handoff.cjs");
function prepare(value){
  contract.exact(value,["config","handoff"],"setup");
  const config=value.handoff===null?validateConfig(value.config):Object.hasOwn(value.handoff,"version")?applyHandoff(value.config,value.handoff):applyDemoHandoff(value.config,value.handoff);
  return {config,credentials:credentials(config)};
}
function sessionHandler(config,secrets,options={}){
  const expected=credentials(config).map(c=>c.variable);
  contract.exact(secrets,expected,"session credentials");
  for(const key of expected)contract.string(secrets[key],"session credential");
  const proxy=createServer(config,{configDir:__dirname,...options,env:secrets});
  const sharedSource=fs.readFileSync(path.join(__dirname,"../src/contracts/generation-contract.js"),"utf8");
  return function(req,res){
    // The local landing page receives only a route choice. No secret reaches the browser.
    if(req.method==="GET"&&req.url==="/launch"){
      let host;try{host=new URL(`http://${req.headers.host}`).hostname;}catch{}
      if(!["127.0.0.1","localhost","[::1]"].includes(host)){res.writeHead(403).end();return;}
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"frame-ancestors 'none'"});
      res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hosted Ember Adventures Lite</title><style>body{font:18px system-ui;max-width:680px;margin:12vh auto;padding:24px;background:#171c24;color:#eee}button{font:inherit;padding:14px}p{line-height:1.5}</style><h1>Hosted Lite is ready locally</h1><p>Text uses your configured endpoint. Image selection stays as you previously chose it; image live validation is still pending. Opening the game can resume existing game behavior. Generation can use paid credits.</p><button id="open">Open Lite with hosted text</button><p id="status" role="status"></p><p>Keep the launcher window open. Return there and press Enter to stop the local session. Stop paid resources separately through the demo's shutdown flow.</p><script>${sharedSource}</script><script>document.getElementById('open').onclick=()=>{try{const key='emberadventures-lite-generation-v1';const stored=localStorage.getItem(key);const prefs=stored===null?{text:'perchance',image:'perchance',proxyUrl:location.origin}:EmberGenerationContract.preferences(JSON.parse(stored));const next=EmberGenerationContract.preferences({...prefs,text:'hosting-proxy',proxyUrl:location.origin});localStorage.setItem(key,JSON.stringify(next));location.href='/';}catch{document.getElementById('status').textContent='Existing generation preferences are invalid. Review them in the game before changing providers.';}};</script>`);
      return;
    }
    return proxy(req,res);
  };
}
if(require.main===module){
  const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let server,initialized=false;
  const stop=()=>{if(!server){process.exit(process.exitCode||0);return;}server.closeAllConnections();server.close(()=>process.exit(process.exitCode||0));};
  input.on("line",line=>{
    if(initialized){if(line==="shutdown")stop();return;}
    initialized=true;
    try{
      const value=JSON.parse(line);
      if(process.argv.includes("--prepare")){process.stdout.write(JSON.stringify(prepare(value))+"\n");input.close();process.exit(0);}
      contract.exact(value,["config","secrets","port"],"session");validateConfig(value.config);
      if(!Number.isInteger(value.port)||value.port<0||value.port>65535)throw new Error("Invalid local port.");
      server=http.createServer(sessionHandler(value.config,value.secrets));server.requestTimeout=0;
      server.on("error",()=>{process.stdout.write(JSON.stringify({ready:false,error:"Local proxy could not start. The port may already be in use."})+"\n");process.exitCode=1;input.close();});
      server.listen(value.port,"127.0.0.1",()=>process.stdout.write(JSON.stringify({ready:true,url:`http://127.0.0.1:${server.address().port}/launch`})+"\n"));
    }catch{process.exitCode=1;process.stdout.write(JSON.stringify({ready:false,error:"Invalid local setup/session configuration. No provider request was sent."})+"\n");input.close();process.stdin.destroy();}
  });
  input.on("close",()=>{if(server)stop();});
  process.on("SIGTERM",stop);process.on("SIGINT",stop);
}
module.exports={prepare,sessionHandler};
