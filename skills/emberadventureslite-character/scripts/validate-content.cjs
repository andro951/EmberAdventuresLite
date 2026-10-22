const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createProductionContext(projectRoot) {
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "src/source-manifest.json"), "utf8"));
    const sources = manifest.applicationScripts.filter(file => file.startsWith("scripts/app/"))
        .map(file => fs.readFileSync(path.join(projectRoot, "src", file), "utf8")).join("\n");
    const context = vm.createContext({structuredClone, URL, TextEncoder, TextDecoder});
    vm.runInContext(fs.readFileSync(path.join(projectRoot, "tools/ollama-host/contract.js"), "utf8"), context);
    const declarations = new Map();
    const loaded = new Set();
    for (const match of sources.matchAll(/^        (?:const (\w+) = |(?:async )?function (\w+)\()/gm))
        declarations.set(match[1] || match[2], match.index);

    function load(name, chain = []) {
        if (loaded.has(name)) return;
        if (chain.includes(name) || !declarations.has(name))
            throw new Error(`Cannot load production declaration ${name}: ${chain.join(" -> ")}`);
        let statement = "";
        let script;
        for (const line of sources.slice(declarations.get(name)).split("\n")) {
            statement += `${line}\n`;
            try { script = new vm.Script(statement); break; }
            catch (error) { if (!(error instanceof SyntaxError)) throw error; }
        }
        if (!script) throw new Error(`Incomplete production declaration ${name}`);
        statement = statement.replace(/^\s*const \w+ = /, `globalThis.${name} = `);
        for (;;) {
            try {
                vm.runInContext(statement, context);
                loaded.add(name);
                if (name === "validateStoryDefinition") {
                    const compatibility = "scripts/app/04a-any-player-story-schema-compat.js";
                    if (manifest.applicationScripts.includes(compatibility))
                        vm.runInContext(fs.readFileSync(path.join(projectRoot,"src",compatibility),"utf8"),context);
                }
                return;
            }
            catch (error) {
                const missing = /(?:^|: )(\w+) is not defined$/.exec(error.message);
                if (!missing) throw error;
                load(missing[1], [...chain, name]);
            }
        }
    }

    function invoke(name, ...args) {
        load(name);
        context.invocationArguments = args;
        for (;;) {
            try {
                const result = vm.runInContext(`${name}(...invocationArguments)`, context);
                const missing = result?.errors?.map(error => /^(\w+) is not defined$/.exec(error.message)).find(Boolean);
                if (!missing) return result;
                if (loaded.has(missing[1])) throw new Error(`Production dependency unavailable: ${missing[1]}`);
                load(missing[1]);
            }
            catch (error) {
                const missing = /(?:^|: )(\w+) is not defined$/.exec(error.message);
                if (!missing) throw error;
                load(missing[1]);
            }
        }
    }

    return {context, load, invoke};
}



function createValidator(projectRoot) {
    const production = createProductionContext(path.resolve(projectRoot));
    production.load("CHARACTER_DEFINITION_FIELDS");
    if (!production.context.CHARACTER_DEFINITION_FIELDS.includes("lite"))
        throw new Error("Select the EmberAdventuresLite repository.");

    function invokeIsolated(name, prepareArguments) {
        production.load(name);
        for (;;) {
            const args = prepareArguments();
            try { return {result:production.context[name](...args), args}; }
            catch (error) {
                const missing = /(?:^|: )(\w+) is not defined$/.exec(error.message);
                if (!missing) throw error;
                production.load(missing[1]);
            }
        }
    }
    return {...production,root:path.resolve(projectRoot),ctx:production.context,validate:payload=>production.invoke("validateStoryExport",payload),invokeIsolated};
}

if (require.main === module) {
    if (process.argv.length < 4)
        throw new Error("Usage: node validate-content.cjs <absolute-Lite-repository> <file.json> [...]");
    const validator = createValidator(process.argv[2]);
    for (const file of process.argv.slice(3)) {
        const payload = JSON.parse(fs.readFileSync(path.resolve(file),"utf8"));
        const method = payload.exportType === "story-template" ? "validateStoryExport" : "validateCharacterExport";
        const result = validator.invoke(method,payload);
        process.stdout.write(JSON.stringify({file,...result},null,2)+"\n");
        if (!result.ok) process.exitCode = 1;
    }
}

module.exports = {createValidator};