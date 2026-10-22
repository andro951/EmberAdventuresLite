"use strict";
const contract=require("../src/contracts/generation-contract.js");
const {validateConfig}=require("./adapters.cjs");
function validateHandoff(value){
  contract.exact(value,["version","provider","url","model"],"handoff");
  if(value.version!==1)throw new Error("handoff.version must be 1.");
  if(!["openai","runpod_lb","vast"].includes(value.provider))throw new Error("handoff.provider must be openai, runpod_lb or vast.");
  contract.string(value.url,"handoff.url");contract.string(value.model,"handoff.model");
  let url;try{url=new URL(value.url);}catch{throw new Error("handoff.url must be a complete Chat Completions URL.");}
  if(!(url.protocol==="https:"||url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))||url.username||url.password||url.search||url.hash||!url.pathname.endsWith("/chat/completions"))throw new Error("handoff.url requires HTTPS (or HTTP loopback), no credentials/query/fragment, and /chat/completions.");
  return value;
}
function applyHandoff(config,handoff){
  validateConfig(config);validateHandoff(handoff);
  const url=new URL(handoff.url);url.pathname=url.pathname.slice(0,-"/chat/completions".length);
  const sampling=config.text.kind==="disabled"?{maxTokens:16384,temperature:0.7,topP:0.8,topK:20,enableThinking:false}:Object.fromEntries(["maxTokens","temperature","topP","topK","enableThinking"].map(key=>[key,config.text[key]]));
  const text={kind:"openai-chat",baseUrl:url.href.replace(/\/$/,""),authorizationEnv:"EMBER_LAUNCH_AUTHORIZATION",model:handoff.model,...sampling};
  if(handoff.provider==="runpod_lb")text.inferenceKeyEnv="EMBER_LAUNCH_GATEWAY_KEY";
  return validateConfig({text,image:config.image});
}
function validateDemoHandoff(value){
  contract.exact(value,["provider","mock","model","base_url","credentials","runtime","remote_verified"],"demo handoff");
  if(!["runpod-pod","runpod-serverless","vast-instance","vast-serverless"].includes(value.provider))throw new Error("Unknown demo relay provider.");
  for(const field of ["mock","remote_verified"])if(typeof value[field]!=="boolean")throw new Error(`demo handoff.${field} must be boolean.`);
  for(const field of ["model","base_url","credentials","runtime"])contract.string(value[field],`demo handoff.${field}`);
  let url;try{url=new URL(value.base_url);}catch{throw new Error("Invalid demo relay origin.");}
  if(url.protocol!=="http:"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!==`/${value.provider}/v1`)throw new Error("Demo relay URL must be its exact loopback provider /v1 base URL, without credentials or query.");
  return value;
}
function applyDemoHandoff(config,handoff){
  validateConfig(config);validateDemoHandoff(handoff);
  const next=applyHandoff(config,{version:1,provider:"openai",url:handoff.base_url+"/chat/completions",model:handoff.model});
  next.text.authorizationEnv="EMBER_LAUNCH_RELAY_AUTHORIZATION";
  return validateConfig(next);
}
function credentials(config){
  validateConfig(config);const found=new Map();
  for(const role of ["text","image"]){
    const c=config[role];
    for(const field of ["authorizationEnv","inferenceKeyEnv","apiKeyEnv"]){
      const variable=c[field];if(!variable)continue;
      const kind=["EMBER_LAUNCH_AUTHORIZATION","EMBER_LAUNCH_RELAY_AUTHORIZATION"].includes(variable)?"bearer-key":field==="authorizationEnv"?"authorization-header":"raw-key";
      if(found.has(variable)&&found.get(variable).kind!==kind)throw new Error("Configuration reuses a credential variable with incompatible authentication types.");
      if(!found.has(variable))found.set(variable,{variable,kind,label:variable==="EMBER_LAUNCH_RELAY_AUTHORIZATION"?"demo local-session relay key (not the cloud key)":`${role} ${field==="authorizationEnv"?"endpoint API/inference key":field==="inferenceKeyEnv"?"gateway inference key":"SDK key"}`});
    }
  }
  return [...found.values()];
}
module.exports={validateHandoff,applyHandoff,validateDemoHandoff,applyDemoHandoff,credentials};
