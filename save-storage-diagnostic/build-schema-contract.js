"use strict";

const fs = require("fs");
const path = require("path");

const commandArguments = process.argv.slice(2);
function commandArgument(name, fallback) {
    const index = commandArguments.indexOf(name);

    if (index < 0)
        return fallback;

    if (!commandArguments[index + 1])
        throw new Error(`${name} requires a value.`);

    return commandArguments[index + 1];
}

const sourcePath = path.resolve(__dirname, "..", "SAVE_STORAGE_SCHEMA_JSON.txt");
const outputPath = path.resolve(commandArgument("--output", path.resolve(__dirname, "schema-contract.js")));
const databaseName = commandArgument("--database-name", "EmberAdventuresLitePersistenceDiagnostic");
const sourceText = fs.readFileSync(sourcePath, "utf8");
const sourceLines = sourceText.split(/\r?\n/);

//#region Schema Parsing

function parseTopLevelObjects() {
    const parsedObjects = [];

    for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex++) {
        if (!sourceLines[lineIndex].trim().startsWith("\""))
            continue;

        let depth = 0;
        let started = false;
        let inString = false;
        let escaped = false;
        let endLineIndex = -1;

        for (let scanLineIndex = lineIndex; scanLineIndex < sourceLines.length; scanLineIndex++) {
            for (const character of sourceLines[scanLineIndex]) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (character === "\\" && inString) {
                    escaped = true;
                    continue;
                }

                if (character === "\"") {
                    inString = !inString;
                    continue;
                }

                if (inString)
                    continue;

                if (character === "{") {
                    depth++;
                    started = true;
                }
                else if (character === "}")
                    depth--;
            }

            if (started && depth === 0) {
                endLineIndex = scanLineIndex;
                break;
            }
        }

        if (endLineIndex < lineIndex)
            throw new Error(`Unterminated schema object at line ${lineIndex + 1}.`);

        const objectText = `{${sourceLines.slice(lineIndex, endLineIndex + 1).join("\n")}}`;
        const parsed = JSON.parse(objectText);
        const name = Object.keys(parsed)[0];

        parsedObjects.push({ name, value: parsed[name] });
        lineIndex = endLineIndex;
    }

    return parsedObjects;
}

function parseKeyPath(value) {
    const trimmedValue = value.trim();

    if (!trimmedValue.startsWith("["))
        return trimmedValue.split(/\s/)[0];

    return trimmedValue
        .slice(1, -1)
        .split(",")
        .map((part) => part.trim());
}

function parseStoreContract(name, description, fields) {
    const keyPathMatch = description.match(/^keyPath\s+(\[[^\]]+\]|[^;\s]+)/);

    if (!keyPathMatch)
        throw new Error(`Store ${name} does not define a valid keyPath.`);

    const indexes = [];
    const indexClause = description.slice(keyPathMatch[0].length);
    const indexPattern = /([A-Za-z0-9_]+)\((\[[^\]]+\]|[^)]+)\)/g;
    const uniqueFirstIndex = /;\s*unique index\b/.test(description);
    let indexMatch;
    let indexNumber = 0;

    while ((indexMatch = indexPattern.exec(indexClause)) != null) {
        const pathAndOptions = indexMatch[2].trim();
        const multiEntry = /\s+multiEntry$/.test(pathAndOptions);
        const pathText = pathAndOptions.replace(/\s+multiEntry$/, "");

        indexes.push({
            name: indexMatch[1],
            keyPath: parseKeyPath(pathText),
            unique: uniqueFirstIndex && indexNumber === 0,
            multiEntry
        });
        indexNumber++;
    }

    if (Object.prototype.hasOwnProperty.call(fields, "saveId") &&
        name !== "saveHeaders" &&
        !indexes.some((index) => index.name === "bySave")) {
        indexes.push({
            name: "bySave",
            keyPath: "saveId",
            unique: false,
            multiEntry: false
        });
    }

    return {
        keyPath: parseKeyPath(keyPathMatch[1]),
        autoIncrement: /with autoIncrement true/.test(description),
        indexes,
        fields
    };
}

function descriptionContainsRequired(value) {
    if (typeof value === "string")
        return /\(required\)\s*$/.test(value);

    if (Array.isArray(value))
        return value.some(descriptionContainsRequired);

    if (value != null && typeof value === "object")
        return Object.values(value).some(descriptionContainsRequired);

    return false;
}

function fieldKind(value) {
    if (Array.isArray(value))
        return "array";

    if (value != null && typeof value === "object")
        return "object";

    return "scalar";
}

function fieldTypeSpec(value) {
    if (typeof value !== "string")
        return fieldKind(value);

    const parts = value.split(" - ");
    return parts[parts.length - 1].replace(/\s*\(required\)\s*$/, "").trim();
}

function exampleFromDescription(value) {
    if (Array.isArray(value))
        return value.map(exampleFromDescription);

    if (value != null && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, exampleFromDescription(nestedValue)]));

    if (typeof value !== "string")
        return null;

    const typeSpec = fieldTypeSpec(value);
    const exampleText = value.split(" - ")[0];

    if (exampleText === "empty string")
        return "";
    if (exampleText === "null")
        return null;
    if (exampleText === "true")
        return true;
    if (exampleText === "false")
        return false;
    if (typeSpec === "Blob")
        return { diagnosticBlob: true };
    if (/^(integer|number(?:\s|$|[|/]))/.test(typeSpec) && Number.isFinite(Number(exampleText)))
        return Number(exampleText);
    if (/^(structured|bounded)/.test(typeSpec) && /^\{.*\}$/.test(exampleText))
        return {};

    return exampleText;
}

function buildSchemaContract() {
    const parsedObjects = parseTopLevelObjects();
    const indexedDbContracts = parsedObjects.find((item) => item.name === "indexedDbStoreContracts");

    if (!indexedDbContracts)
        throw new Error("indexedDbStoreContracts was not found.");

    const recordObjects = new Map(
        parsedObjects
            .filter((item) => item.name !== "indexedDbStoreContracts")
            .map((item) => [item.name, item.value])
    );
    const stores = {};

    for (const [storeName, storeDescription] of Object.entries(indexedDbContracts.value)) {
        const recordObject = recordObjects.get(storeName);

        if (!recordObject)
            throw new Error(`Store ${storeName} has a contract but no record definition.`);

        const fields = {};

        for (const [fieldName, fieldDescription] of Object.entries(recordObject)) {
            fields[fieldName] = {
                required: descriptionContainsRequired(fieldDescription),
                kind: fieldKind(fieldDescription),
                typeSpec: fieldTypeSpec(fieldDescription),
                example: exampleFromDescription(fieldDescription),
                description: fieldDescription
            };
        }

        stores[storeName] = parseStoreContract(storeName, storeDescription, fields);
    }

    for (const storeName of recordObjects.keys()) {
        if (!Object.prototype.hasOwnProperty.call(stores, storeName))
            throw new Error(`Record ${storeName} has no IndexedDB contract.`);
    }

    return {
        databaseName,
        version: 1,
        source: "SAVE_STORAGE_SCHEMA_JSON.txt",
        stores
    };
}

//#endregion Schema Parsing




//#region Output

const schemaContract = buildSchemaContract();
const output = `"use strict";\n\nself.EmberStorageSchema = ${JSON.stringify(schemaContract, null, 4)};`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${Object.keys(schemaContract.stores).length} stores in ${outputPath}.`);

//#endregion Output
