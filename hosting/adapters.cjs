"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {randomInt} = require("node:crypto");
const {spawn} = require("node:child_process");
const {setTimeout: sleep} = require("node:timers/promises");
const contract = require("../src/contracts/generation-contract.js");

// Every configured provider has one explicit wire format; image output is never parsed as chat.
function validateConfig(config) {
  contract.exact(config, ["text", "image"], "config");
  const choices = {text: ["disabled", "openai-chat", "runpod-vllm", "vast-vllm"], image: ["disabled", "sglang-images", "runpod-sglang-images", "automatic1111", "comfyui", "runpod-comfyui", "vast-comfyui"]};
  for (const role of ["text", "image"]) {
    const c = config[role], at = `config.${role}`;
    if (!c || !choices[role].includes(c.kind)) throw new Error(`${at}.kind must be one of ${choices[role].join(", ")}.`);
    const fields = ["kind"];
    if (c.kind !== "disabled") {
      if (c.kind.startsWith("vast-")) fields.push("endpointName", "apiKeyEnv", "python", "cost");
      else fields.push("baseUrl", "authorizationEnv");
      if (role === "text") fields.push("model", "maxTokens", "temperature", "topP", "topK", "enableThinking");
      if (c.kind.includes("comfyui")) fields.push("workflowFile", "outputNode");
      if (["comfyui", "runpod-vllm", "runpod-comfyui", "runpod-sglang-images"].includes(c.kind)) fields.push("pollIntervalMs");
      if (c.kind === "automatic1111") fields.push("steps", "cfgScale");
      if (["sglang-images", "runpod-sglang-images"].includes(c.kind)) fields.push("model", "steps", "guidanceScale");
      if (c.kind === "openai-chat" && Object.hasOwn(c, "inferenceKeyEnv")) fields.push("inferenceKeyEnv");
    }
    contract.exact(c, fields, at);
    for (const key of fields.filter(k => !["kind", "cost", "maxTokens", "temperature", "pollIntervalMs", "steps", "cfgScale", "guidanceScale", "topP", "topK", "enableThinking"].includes(k))) contract.string(c[key], `${at}.${key}`, key === "authorizationEnv");
    if (role === "text" && c.kind !== "disabled" && (c.enableThinking !== null && typeof c.enableThinking !== "boolean" || typeof c.topP !== "number" || c.topP <= 0 || c.topP > 1 || !Number.isInteger(c.topK) || c.topK < 1)) throw new Error(`${at} has invalid enableThinking/topP/topK.`);
    for (const key of ["maxTokens", "steps", "pollIntervalMs"]) if (fields.includes(key) && (!Number.isInteger(c[key]) || c[key] < (key === "pollIntervalMs" ? 250 : 1))) throw new Error(`${at}.${key} is invalid.`);
    for (const key of ["temperature", "cfgScale", "guidanceScale", "cost"]) if (fields.includes(key) && (typeof c[key] !== "number" || !Number.isFinite(c[key]) || c[key] < 0)) throw new Error(`${at}.${key} is invalid.`);
    if (c.baseUrl) {
      const u = new URL(c.baseUrl);
      if (!(u.protocol === "https:" || u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) || u.username || u.password || u.search || u.hash) throw new Error(`${at}.baseUrl requires HTTPS (or HTTP loopback), with no credentials/query/fragment.`);
      if (c.kind.startsWith("runpod-") && (u.hostname !== "api.runpod.ai" || !/^\/v2\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))) throw new Error(`${at}.baseUrl must be https://api.runpod.ai/v2/ENDPOINT_ID.`);
    }
    for (const key of ["authorizationEnv", "apiKeyEnv", "inferenceKeyEnv"]) if (c[key] && !/^[A-Z][A-Z0-9_]*$/.test(c[key])) throw new Error(`${at}.${key} must name an environment variable.`);
  }
  return config;
}
function workflow(template, request) {
  const replacements = {"{{prompt}}": request.prompt, "{{negativePrompt}}": request.negativePrompt, "{{seed}}": request.seed === -1 ? randomInt(0, 281474976710655) : request.seed, "{{width}}": request.width, "{{height}}": request.height};
  function visit(value) {
    if (typeof value === "string" && Object.hasOwn(replacements, value)) return replacements[value];
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, visit(v)]));
    return value;
  }
  return visit(template);
}
function textResult(data) {
  const choice = data?.choices?.[0];
  if (!choice || !["stop", "eos_token"].includes(choice.finish_reason)) throw new Error("Text provider did not finish successfully (empty, truncated or unsupported finish reason). Increase maxTokens if needed.");
  return contract.response("text", {text: choice.message?.content});
}
function png(base64) { return contract.imageSource(`data:image/png;base64,${base64}`); }
function createAdapters(config, options = {}) {
  validateConfig(config);
  const fetcher = options.fetch || fetch;
  const pause = options.sleep || ((ms, signal) => sleep(ms, undefined, {signal}));
  const env = options.env || process.env;
  const configDir = options.configDir || process.cwd();
  const templates = {};
  for (const role of ["text", "image"]) {
    const c = config[role];
    if (c.workflowFile) {
      const template = JSON.parse(fs.readFileSync(path.resolve(configDir, c.workflowFile), "utf8"));
      if (!template || typeof template !== "object" || Array.isArray(template) || !Object.hasOwn(template, c.outputNode)) throw new Error(`config.${role}.outputNode is missing from workflowFile.`);
      if (!JSON.stringify(template).includes('"{{prompt}}"')) throw new Error(`config.${role}.workflowFile needs an exact {{prompt}} placeholder value.`);
      templates[role] = template;
    }
  }
  function headers(c) {
    const h = {"Content-Type": "application/json"};
    if (c.authorizationEnv) {
      if (!env[c.authorizationEnv]) throw new Error("Provider authorization environment variable is not set.");
      h.Authorization = env[c.authorizationEnv];
    }
    if (c.inferenceKeyEnv) {
      if (!env[c.inferenceKeyEnv]) throw new Error("Text gateway inference-key environment variable is not set.");
      h["X-Inference-Key"] = env[c.inferenceKeyEnv];
    }
    return h;
  }
  async function http(c, suffix, body, signal, binary = false) {
    let r;
    try { r = await fetcher(c.baseUrl.replace(/\/$/, "") + suffix, {method: body === undefined ? "GET" : "POST", headers: headers(c), body: body === undefined ? undefined : JSON.stringify(body), signal, redirect: "error"}); }
    catch (error) { if (signal?.aborted) throw error; throw new Error("Provider connection failed; outcome may be uncertain. Check the provider before retrying."); }
    if (!r.ok) throw new Error(`Provider returned HTTP ${r.status}; check endpoint configuration, authorization and provider dashboard.`);
    if (binary) {
      const mime = r.headers.get("content-type")?.split(";")[0];
      if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new Error("Provider returned an unsupported image MIME type.");
      return contract.imageSource(`data:${mime};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`);
    }
    try { return await r.json(); } catch { throw new Error("Provider returned invalid JSON."); }
  }
  async function runpod(c, input, signal) {
    let job = await http(c, "/run", {input}, signal);
    if (typeof job.id !== "string" || !job.id) throw new Error("RunPod did not return a job ID; check the dashboard before retrying.");
    const id = encodeURIComponent(job.id);
    try {
      while (true) {
        if (job.status === "COMPLETED") return job.output;
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(job.status)) throw new Error(`RunPod job ${job.status}; inspect its details in the provider dashboard.`);
        if (!["IN_QUEUE", "IN_PROGRESS"].includes(job.status)) throw new Error("RunPod returned an unknown job status; inspect the dashboard before retrying.");
        await pause(c.pollIntervalMs, signal);
        job = await http(c, `/status/${id}`, undefined, signal);
      }
    } catch (error) {
      if (signal?.aborted) {
        // Explicit caller cancellation only. No wall-clock job deadline or resubmission.
        void http(c, `/cancel/${id}`, {}, undefined).catch(() => {
          console.error("RunPod cancellation could not be confirmed. Check the provider before submitting another request.");
        });
      }
      throw error;
    }
  }
  async function comfy(c, graph, signal) {
    const queued = await http(c, "/prompt", {prompt: graph}, signal);
    if (queued.error || !queued.prompt_id) throw new Error("ComfyUI rejected the workflow; inspect its node validation errors on the server.");
    const id = String(queued.prompt_id);
    // /interrupt is global to a ComfyUI server, so we never interrupt another user's job.
    while (true) {
      const history = (await http(c, `/history/${encodeURIComponent(id)}`, undefined, signal))[id];
      if (history) {
        if (history.status?.status_str === "error") throw new Error("ComfyUI workflow failed; inspect server execution details.");
        if (history.status?.completed === true) {
          const image = history.outputs?.[c.outputNode]?.images?.find(i => i.type === "output");
          if (!image || typeof image.filename !== "string" || typeof image.subfolder !== "string") throw new Error("ComfyUI completed without a saved image on outputNode.");
          return {image: await http(c, `/view?${new URLSearchParams({filename: image.filename, subfolder: image.subfolder, type: "output"})}`, undefined, signal, true)};
        }
      }
      await pause(c.pollIntervalMs, signal);
    }
  }
  function vast(c, payload, route, signal) {
    if (options.vast) return options.vast(c, payload, route, signal);
    if (!env[c.apiKeyEnv]) throw new Error("Vast API key environment variable is not set.");
    return new Promise((resolve, reject) => {
      const child = spawn(c.python, [path.join(__dirname, "vast-request.py")], {windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: {...env, VAST_API_KEY: env[c.apiKeyEnv]}});
      let stdout = "";
      child.stdout.setEncoding("utf8"); child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.resume(); // Never echo SDK output, which may include signed routing data.
      const abort = () => child.kill();
      signal?.addEventListener("abort", abort, {once: true});
      if (signal?.aborted) abort();
      child.on("error", () => reject(new Error("Cannot start Vast SDK helper; check the configured Python and install vastai.")));
      child.stdin.on("error", () => {});
      child.on("close", code => {
        signal?.removeEventListener("abort", abort);
        if (signal?.aborted) { reject(new DOMException("Request cancelled; Vast worker may still be running.", "AbortError")); return; }
        if (code !== 0) { reject(new Error("Vast SDK request failed; check SDK installation, endpoint readiness and account settings. Remote outcome may be uncertain.")); return; }
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error("Vast helper returned invalid JSON.")); }
      });
      child.stdin.end(JSON.stringify({endpointName: c.endpointName, route, payload: {input: payload}, cost: c.cost}));
    });
  }
  return async function generate(role, request, signal) {
    contract.request(role, request);
    const c = config[role];
    if (c.kind === "disabled") throw new Error(`${role} hosting is disabled in the local proxy configuration.`);
    signal?.throwIfAborted();
    let result;
    if (role === "text") {
      // Chat APIs do not universally support assistant prefilling. Carry the requested prefix
      // as an instruction, then restore it once at the browser boundary if it was omitted.
      const messages = [{role: "system", content: "You are EmberAdventures's text generation engine. Follow the supplied instructions and requested output format exactly." + (request.startWith ? ` Begin your answer with this exact prefix: ${JSON.stringify(request.startWith)}.` : "")}, {role: "user", content: request.instruction}];
      const sampling = {max_tokens: c.maxTokens, temperature: c.temperature, top_p: c.topP, top_k: c.topK, ...(c.enableThinking === null ? {} : {chat_template_kwargs: {enable_thinking: c.enableThinking}}), ...(request.stopSequences.length ? {stop: request.stopSequences} : {})};
      if (c.kind === "runpod-vllm") {
        const output = await runpod(c, {route: "/v1/chat/completions", body: {model: c.model, messages, stream: false, ...sampling}}, signal);
        // Current worker-vllm (vLLM 0.31.0) aggregates the one yielded OpenAI response.
        const item = Array.isArray(output) && output.length === 1 ? output[0] : null;
        result = textResult(item);
      } else {
        const payload = {model: c.model, messages, stream: false, ...sampling};
        result = textResult(c.kind === "vast-vllm" ? await vast(c, payload, "/v1/chat/completions", signal) : await http(c, "/chat/completions", payload, signal));
      }
    } else if (["sglang-images", "runpod-sglang-images"].includes(c.kind)) {
      const payload = {model: c.model, prompt: request.prompt, negative_prompt: request.negativePrompt, size: `${request.width}x${request.height}`, n: 1, response_format: "b64_json", output_format: "png", num_inference_steps: c.steps, guidance_scale: c.guidanceScale, ...(request.seed === -1 ? {} : {seed: request.seed})};
      const data = c.kind === "runpod-sglang-images" ? await runpod(c, payload, signal) : await http(c, "/images/generations", payload, signal);
      if (typeof data?.data?.[0]?.b64_json !== "string") throw new Error("SGLang returned no base64 image.");
      result = {image: png(data.data[0].b64_json)};
    } else if (c.kind === "automatic1111") {
      const data = await http(c, "/sdapi/v1/txt2img", {prompt: request.prompt, negative_prompt: request.negativePrompt, seed: request.seed, width: request.width, height: request.height, steps: c.steps, cfg_scale: c.cfgScale, batch_size: 1, n_iter: 1}, signal);
      if (!Array.isArray(data.images) || typeof data.images[0] !== "string") throw new Error("Automatic1111 returned no image.");
      result = {image: png(data.images[0])};
    } else {
      const graph = workflow(templates[role], request);
      if (c.kind === "comfyui") result = await comfy(c, graph, signal);
      if (c.kind === "runpod-comfyui") {
        const data = await runpod(c, {workflow: graph}, signal);
        if (!Array.isArray(data?.images) || data.images.length !== 1) throw new Error("RunPod ComfyUI must return exactly one image; configure a single-image workflow.");
        const image = data?.images?.[0];
        if (image?.type === "base64") result = {image: png(image.data)};
        else if (image?.type === "s3_url") result = {image: contract.imageSource(image.data)};
        else throw new Error("RunPod ComfyUI returned no supported image (base64 or s3_url).");
      }
      if (c.kind === "vast-comfyui") {
        const data = await vast(c, {workflow_json: graph}, "/generate/sync", signal);
        if (data?.status !== "completed") throw new Error("Vast ComfyUI did not complete successfully; inspect its worker status.");
        const image = data.output?.find(i => String(i.node_id) === c.outputNode && i.output_type === "images");
        result = {image: contract.imageSource(image?.url)};
      }
    }
    return contract.response(role, result);
  };
}
module.exports = {validateConfig, workflow, createAdapters};
