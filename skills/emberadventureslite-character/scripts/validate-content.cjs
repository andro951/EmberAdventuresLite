"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

//Load actual application declarations without running startup or copying schema rules.
function createValidator(root) {
const directory = path.join(root, "src/scripts/app");
const sources = fs.readdirSync(directory).filter(file => file.endsWith(".js")).sort().map(file => fs.readFileSync(path.join(directory, file), "utf8")).join("\n");
const ctx = vm.createContext({ console, structuredClone, URL, TextEncoder, TextDecoder });
const declarations = new Map();
const loaded = new Set();
for (const match of sources.matchAll(/^(?:  )?(?:const (\w+) = |(?:async )?function (\w+)\()/gm)) {
    declarations.set(match[1] || match[2], match.index);
}

//Load production declarations without running browser startup or copying validation rules.
function load(name, chain = []) {
    if (loaded.has(name))
        return;

    if (chain.includes(name) || !declarations.has(name))
        throw new Error(`Cannot load production declaration ${name}: ${chain.join(" -> ")}`);

    let statement = "";
    let script;
    for (const line of sources.slice(declarations.get(name)).split("\n")) {
        statement += `${line}\n`;
        try {
            script = new vm.Script(statement);
            break;
        }
        catch (error) {
            if (!(error instanceof SyntaxError))
                throw error;
        }
    }

    if (!script)
        throw new Error(`Incomplete production declaration ${name}`);

    statement = statement.replace(/^\s*const \w+ = /, `globalThis.${name} = `);
    for (;;) {
        try {
            vm.runInContext(statement, ctx);
            loaded.add(name);
            return;
        }
        catch (error) {
            const missing = error.message.match(/^(\w+) is not defined$/);
            if (!missing)
                throw error;

            load(missing[1], [...chain, name]);
        }
    }
}
function invoke(name, ...args) {
    load(name);
    ctx.invocationArguments = args;
    for (;;) {
        try {
            const result = vm.runInContext(`${name}(...invocationArguments)`, ctx);
            //Some validators deliberately turn caught failures into validation errors.
            const missing = result?.errors?.map(error => error.message.match(/^(\w+) is not defined$/)).find(Boolean);
            if (missing) {
                if (loaded.has(missing[1]))
                    throw new Error(`Production dependency still unavailable: ${missing[1]}`);

                load(missing[1]);
                continue;
            }

            return result;
        }
        catch (error) {
            const missing = error.message.match(/^(\w+) is not defined$/);
            if (!missing)
                throw error;

            load(missing[1]);
        }
    }
}
//Mutation checks must start from fresh state after discovering each dependency.
function invokeIsolated(name, prepareArguments) {
    load(name);
    for (;;) {
        const args = prepareArguments();
        try {
            return { result: ctx[name](...args), args };
        }
        catch (error) {
            const missing = error.message.match(/^(\w+) is not defined$/);
            if (!missing)
                throw error;

            load(missing[1]);
        }
    }
}
function validate(payload) {
    return invoke("validateStoryExport", payload);
}


    load("CHARACTER_APPEARANCE_FIELDS");
    if (!ctx.CHARACTER_APPEARANCE_FIELDS.includes("body_description"))
        throw new Error("Select the EmberAdventuresLite repository, not another edition.");

    //The effective browser validator includes this strict optional-field wrapper.
    load("validateStoryDefinition");
    vm.runInContext(fs.readFileSync(path.join(root, "src/scripts/app/04a-any-player-story-schema-compat.js"), "utf8"), ctx);
    return { root, validate, invoke, invokeIsolated, ctx, load };
}

if (require.main === module) {
    if (process.argv.length < 4)
        throw new Error("Usage: node validate-content.cjs <absolute-Lite-repository> <file.json> [...]");

    const validator = createValidator(path.resolve(process.argv[2]));
    for (const file of process.argv.slice(3)) {
        const payload = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
        const method = payload.exportType === "story-template" ? "validateStoryExport" : "validateCharacterExport";
        const result = validator.invoke(method, payload);
        process.stdout.write(JSON.stringify({file, ...result}, null, 2) + "\n");
        if (!result.ok)
            process.exitCode = 1;
    }
}

module.exports = { createValidator };