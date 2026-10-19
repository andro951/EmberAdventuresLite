// Dry-run by default. No remote action occurs without --execute.
// Private API responses and tokens are never printed or written to the state file.
const fs=require("node:fs");
const path=require("node:path");
const stateFile=path.join(__dirname,"deployment.local.json");
const upstreamImage="lmsysorg/sglang:nightly-dev-cu13-20261019-3c560089@sha256:c1f4d9fc6fcf50c2269adbc757ce7b1778883af04155edb888fa9eea3b6648c0";
function upstreamEntrypoint(){
  const source=fs.readFileSync(path.join(__dirname,"worker.py")).toString("base64");
  return ["python3","-c",`import base64,pathlib,subprocess,sys,os; p=pathlib.Path('/tmp/ember-image-worker.py'); p.write_bytes(base64.b64decode('${source}')); subprocess.check_call([sys.executable,'-m','pip','install','--no-cache-dir','runpod==1.12.0']); os.execv(sys.executable,[sys.executable,str(p)])`];
}
async function lifecycle(action,options={}){
  const execute=options.execute===true,env=options.env||process.env,fetcher=options.fetch||fetch;
  const statePath=options.stateFile||stateFile;
  const read=()=>fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,"utf8")):{};
  const save=value=>fs.writeFileSync(statePath,JSON.stringify(value,null,2)+"\n");
  if(!["create","status","delete"].includes(action))throw new Error("Use create, status or delete; add --execute only when ready for the remote action.");
  if(!execute)return {dryRun:true,action,image:options.image||upstreamImage,steps:action==="create"?["Use pinned official image with embedded reviewed worker startup; custom build/publication optional","Create private template with session HF_TOKEN","Create queue endpoint: zero minimum, one maximum worker, existing network volume","Record only resource IDs locally; no generation request"]:action==="delete"?["Delete the recorded endpoint","Delete its private template","Keep model volume; delete volume explicitly in provider console if no longer needed"]:["Read recorded endpoint metadata; no inference request"]};
  if(!env.RUNPOD_MANAGEMENT_KEY)throw new Error("Set RUNPOD_MANAGEMENT_KEY in this shell; do not put it in a file or browser.");
  let state=read();
  async function api(method,route,body){
    const response=await fetcher("https://rest.runpod.io/v1"+route,{method,headers:{Authorization:`Bearer ${env.RUNPOD_MANAGEMENT_KEY}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),redirect:"error"});
    if(!response.ok)throw new Error(`RunPod management HTTP ${response.status}; inspect the dashboard. No automatic retry.`);
    return response.status===204?{}:await response.json();
  }
  if(action==="create"){
    if(Object.keys(state).length)throw new Error("Deployment state already exists; inspect status/dashboard before another create (an earlier outcome may be uncertain).");
    if(!env.HF_TOKEN||!options.volumeId)throw new Error("Create requires --volume-id=ID and a session HF_TOKEN with approved Krea access. The pinned official image is the default.");
    if(options.image?.includes("YOUR_")||options.volumeId.includes("YOUR_"))throw new Error("Replace image/volume placeholders before creation.");
    const template=JSON.parse(fs.readFileSync(path.join(__dirname,"runpod-template.example.json"),"utf8"));
    template.imageName=options.image||upstreamImage;template.env.HF_TOKEN=env.HF_TOKEN;
    if(!options.image){template.dockerEntrypoint=upstreamEntrypoint();template.dockerStartCmd=[];}
    save({pending:"create-template"});
    const created=await api("POST","/templates",template);
    if(typeof created.id!=="string")throw new Error("RunPod returned no template ID; check dashboard before retrying.");
    state={templateId:created.id,pending:"create-endpoint"};save(state);
    const endpoint=JSON.parse(fs.readFileSync(path.join(__dirname,"runpod-endpoint.example.json"),"utf8"));
    endpoint.templateId=state.templateId;endpoint.networkVolumeId=options.volumeId;
    const result=await api("POST","/endpoints",endpoint);
    if(typeof result.id!=="string")throw new Error("RunPod returned no endpoint ID; check dashboard before retrying.");
    state={templateId:state.templateId,endpointId:result.id};save(state);
    return {...state,inferenceBaseUrl:`https://api.runpod.ai/v2/${result.id}`,remoteInferenceVerified:false};
  }
  if(state.pending)throw new Error("Previous operation has uncertain outcome. Inspect the provider dashboard and reconcile deployment.local.json IDs before continuing.");
  if(!state.endpointId)throw new Error("No recorded endpoint ID.");
  if(action==="status"){
    const result=await api("GET",`/endpoints/${encodeURIComponent(state.endpointId)}`);
    return {endpointId:state.endpointId,workersMin:result.workersMin,workersMax:result.workersMax,remoteInferenceVerified:false};
  }
  // Explicit deletion is the stop mechanism: it prevents new jobs and removes workers.
  // Model volumes are separate billed resources; never delete user data implicitly.
  save({...state,pending:"delete-endpoint"});
  await api("DELETE",`/endpoints/${encodeURIComponent(state.endpointId)}`);
  save({templateId:state.templateId,pending:"delete-template"});
  if(state.templateId)await api("DELETE",`/templates/${encodeURIComponent(state.templateId)}`);
  save({deleted:true});
  return {deleted:true,modelVolumeRetained:true};
}
if(require.main===module){
  const args=process.argv.slice(2),value=prefix=>args.find(a=>a.startsWith(prefix+"="))?.slice(prefix.length+1);
  lifecycle(args[0]||"create",{execute:args.includes("--execute"),image:value("--image"),volumeId:value("--volume-id")}).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error("RunPod lifecycle did not complete. Check required session variables, arguments and deployment.local.json. If pending is recorded, reconcile the provider dashboard before retrying. No tokens were logged.");process.exitCode=1;});
}
module.exports={lifecycle,upstreamEntrypoint};
