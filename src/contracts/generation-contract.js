/* Shared browser/proxy contract. No provider credentials belong in this contract. */
(function (root) {
  "use strict";
  function exact(value, keys, path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
    for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${path}.${key} is unknown.`);
    for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required.`);
    return value;
  }
  function string(value, path, empty = false) {
    if (typeof value !== "string" || (!empty && !value.trim())) throw new Error(`${path} must be ${empty ? "a string" : "a nonempty string"}.`);
    return value;
  }
  function proxyUrl(value) {
    string(value, "generation.proxyUrl");
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("generation.proxyUrl must be a loopback HTTP(S) origin without credentials, path, query or fragment.");
    return url.origin;
  }
  function preferences(value) {
    exact(value, ["text", "image", "proxyUrl"], "generation");
    for (const role of ["text", "image"]) if (!["perchance", "hosting-proxy"].includes(value[role])) throw new Error(`generation.${role} must be perchance or hosting-proxy.`);
    proxyUrl(value.proxyUrl);
    return value;
  }
  const hostedImageDefaults = Object.freeze({portrait: "832x1216", square: "1024x1024"});
  function hostedImageResolution(value = "512x768") {
    // Translate only the game's existing default projections at the hosted boundary.
    // Saved records, explicit nondefault dimensions and the Perchance path stay intact.
    if (value === "512x768") return hostedImageDefaults.portrait;
    if (value === "512x512" || value === "768x768") return hostedImageDefaults.square;
    if (typeof value !== "string" || !/^[1-9]\d*x[1-9]\d*$/.test(value)) throw new Error("Image resolution must be positive WIDTHxHEIGHT.");
    return value;
  }
  function request(role, value) {
    if (role === "text") {
      exact(value, ["instruction", "startWith", "stopSequences"], "request");
      string(value.instruction, "request.instruction"); string(value.startWith, "request.startWith", true);
      if (!Array.isArray(value.stopSequences) || value.stopSequences.some(s => typeof s !== "string" || !s)) throw new Error("request.stopSequences must contain nonempty strings.");
    } else if (role === "image") {
      exact(value, ["prompt", "negativePrompt", "seed", "width", "height"], "request");
      string(value.prompt, "request.prompt"); string(value.negativePrompt, "request.negativePrompt", true);
      if (!Number.isSafeInteger(value.seed) || value.seed < -1) throw new Error("request.seed must be -1 or a nonnegative safe integer.");
      for (const field of ["width", "height"]) if (!Number.isInteger(value[field]) || value[field] < 1) throw new Error(`request.${field} must be a positive integer.`);
    } else throw new Error("Unknown generation role.");
    return value;
  }
  function imageSource(value) {
    string(value, "response.image");
    if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("response.image must be an HTTPS URL or a PNG/JPEG/WebP data URL.");
    return value;
  }
  function response(role, value) {
    exact(value, [role === "text" ? "text" : "image"], "response");
    if (role === "text") string(value.text, "response.text"); else imageSource(value.image);
    return value;
  }
  const api = {exact, string, proxyUrl, preferences, request, response, imageSource, hostedImageDefaults, hostedImageResolution};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmberGenerationContract = api;
})(globalThis);
