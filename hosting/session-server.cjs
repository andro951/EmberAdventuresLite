"use strict";
const http = require("node:http");
const readline = require("node:readline");
const {createServer, launchUrl} = require("./server.cjs");
const {validateConfig} = require("./adapters.cjs");
const contract = require("../src/contracts/generation-contract.js");
const {applyHandoff, applyDemoHandoff, credentials} = require("./handoff.cjs");

function prepare(value) {
    contract.exact(value, ["config", "handoff"], "setup");
    const config = value.handoff === null ? validateConfig(value.config)
        : Object.hasOwn(value.handoff, "version") ? applyHandoff(value.config, value.handoff)
        : applyDemoHandoff(value.config, value.handoff);
    return {config, credentials: credentials(config)};
}
function sessionHandler(config, secrets, options = {}) {
    contract.exact(secrets, credentials(config).map(item => item.variable), "session credentials");
    for (const value of Object.values(secrets)) {
        contract.string(value, "session credential");
    }

    return createServer(config, {...options, configDir: __dirname, env: secrets});
}
if (require.main === module) {
    const input = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
    let server = null;
    let initialized = false;
    const stop = () => {
        if (!server) {
            process.exit(process.exitCode || 0);
            return;
        }

        server.closeAllConnections();
        server.close(() => process.exit(process.exitCode || 0));
    };
    input.on("line", line => {
        if (initialized) {
            if (line === "shutdown")
                stop();

            return;
        }

        initialized = true;
        try {
            const value = JSON.parse(line);
            if (process.argv.includes("--prepare")) {
                process.stdout.write(JSON.stringify(prepare(value)) + "\n");
                input.close();
                return;
            }

            contract.exact(value, ["config", "secrets", "port"], "session");
            validateConfig(value.config);
            if (!Number.isInteger(value.port) || value.port < 0 || value.port > 65535)
                throw new Error("Invalid local port.");

            server = http.createServer(sessionHandler(value.config, value.secrets));
            server.requestTimeout = 0;
            server.on("error", () => {
                process.stdout.write(JSON.stringify({ready: false, error: "Local hosting bridge could not start. The port may already be in use."}) + "\n");
                process.exitCode = 1;
                input.close();
            });
            server.listen(value.port, "127.0.0.1", () => process.stdout.write(JSON.stringify({ready: true, url: launchUrl(`http://127.0.0.1:${server.address().port}`)}) + "\n"));
        }
        catch {
            process.exitCode = 1;
            process.stdout.write(JSON.stringify({ready: false, error: "Invalid hosting configuration. No provider request was sent."}) + "\n");
            input.close();
        }
    });
    input.on("close", stop);
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
}
module.exports = {prepare, sessionHandler};
