const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.EMBERADVENTURES_LIVE_PORT || 51828);
const httpsPort = Number(process.env.EMBERADVENTURES_LIVE_HTTPS_PORT || 51829);
const certPath = path.join(root, "live-localhost.pfx");
const certPassphrase = process.env.EMBERADVENTURES_LIVE_CERT_PASSWORD || "emberadventures-lite-local";

const mimeByExt = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
};

function sendHeaders(res, status, type) {
  res.writeHead(status, {
    "Content-Type": type || "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  });
}

function proxyLocalCodexRequest(req, res) {
  const proxy = http.request({
    hostname: "127.0.0.1",
    port: 51820,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: "127.0.0.1:51820",
    },
  }, (proxyResponse) => {
    res.writeHead(proxyResponse.statusCode || 502, {
      "Content-Type": proxyResponse.headers["content-type"] || "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    });
    proxyResponse.pipe(res);
  });
  proxy.on("error", (error) => {
    sendHeaders(res, 502, "application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: false,
      error: `Local Codex bridge proxy failed: ${error.message || String(error)}`,
    }));
  });
  req.pipe(proxy);
}

function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendHeaders(res, 204, "text/plain; charset=utf-8");
    res.end();
    return;
  }
  if (
    (req.method === "GET" && req.url === "/api/status") ||
    (req.method === "POST" && req.url === "/api/text/generate")
  ) {
    proxyLocalCodexRequest(req, res);
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/__emberadventures_test_output")) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const fileName = String(payload.fileName || "test-output.md")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/^-+/, "")
          .slice(0, 120) || "test-output.md";
        const outDir = path.join(root, "test-output");
        const outPath = path.join(outDir, fileName);
        if (!outPath.startsWith(outDir + path.sep)) {
          sendHeaders(res, 403, "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Forbidden path" }));
          return;
        }
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(outPath, String(payload.content || ""), "utf8");
        sendHeaders(res, 200, "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: true, path: path.relative(root, outPath).replace(/\\/g, "/") }));
      } catch (err) {
        sendHeaders(res, 400, "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: err.message || String(err) }));
      }
    });
    return;
  }

  if (req.method !== "GET") {
    sendHeaders(res, 405, "text/plain; charset=utf-8");
    res.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  } catch {
    sendHeaders(res, 400, "text/plain; charset=utf-8");
    res.end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/bottom.html";
  const resolved = path.resolve(root, `.${pathname}`);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    sendHeaders(res, 403, "text/plain; charset=utf-8");
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      sendHeaders(res, err.code === "ENOENT" ? 404 : 500, "text/plain; charset=utf-8");
      res.end(err.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    sendHeaders(res, 200, mimeByExt[path.extname(resolved).toLowerCase()]);
    res.end(data);
  });
}

const server = http.createServer(handleRequest);
server.listen(port, "127.0.0.1", () => {
  console.log(`EmberAdventures live server: http://127.0.0.1:${port}/bottom.html`);
});

if (fs.existsSync(certPath)) {
  try {
    const httpsServer = https.createServer({
      pfx: fs.readFileSync(certPath),
      passphrase: certPassphrase,
    }, handleRequest);
    // Bind the HTTPS proxy to the dual-stack wildcard. Browsers may resolve
    // localhost to either ::1 or 127.0.0.1; binding only to ::1 made the
    // hosted Perchance page intermittently unable to reach the Codex bridge.
    httpsServer.listen(httpsPort, () => {
      console.log(`EmberAdventures live HTTPS server: https://localhost:${httpsPort}/bottom.html (IPv4 + IPv6)`);
    });
  } catch (error) {
    console.error(`HTTPS live server failed: ${error.message || String(error)}`);
  }
} else {
  console.log(`HTTPS cert not found at ${certPath}; HTTPS live server not started.`);
}
