#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const util = require("util");
const zlib = require("zlib");

const brotliCompress = util.promisify(zlib.brotliCompress);
const brotliDecompress = util.promisify(zlib.brotliDecompress);

function usage() {
    return [
        "Usage:",
        "  node compress-brotli.js <input-file> <output-file> [quality]",
        "",
        "Arguments:",
        "  input-file   File to compress.",
        "  output-file  Brotli output path. Parent folders are created.",
        "  quality      Optional Brotli quality from 0 through 11. Default: 11.",
    ].join("\n");
}

function fileHash(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function formattedBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;

    const units = ["KB", "MB", "GB"];
    let value = bytes;
    let unit = "B";
    for (const nextUnit of units) {
        value /= 1024;
        unit = nextUnit;
        if (value < 1024) break;
    }
    return `${value.toFixed(2)} ${unit}`;
}

async function compressFile(inputArgument, outputArgument, qualityArgument = "11") {
    const inputPath = path.resolve(inputArgument);
    const outputPath = path.resolve(outputArgument);
    const quality = Number(qualityArgument);

    if (!Number.isInteger(quality) || quality < 0 || quality > 11)
        throw new Error("Brotli quality must be a whole number from 0 through 11.");

    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile())
        throw new Error(`Input file does not exist: ${inputPath}`);

    if (inputPath.toLowerCase() === outputPath.toLowerCase())
        throw new Error("Input and output paths must be different.");

    const input = await fs.promises.readFile(inputPath);
    const compressed = await brotliCompress(input, {
        params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
        },
    });
    const restored = await brotliDecompress(compressed);

    if (!restored.equals(input))
        throw new Error("Brotli verification failed: decompressed bytes differ from the input.");

    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.promises.writeFile(temporaryPath, compressed);
    await fs.promises.rename(temporaryPath, outputPath);

    const ratio = input.length ? (compressed.length / input.length) * 100 : 0;
    console.log(`Input:  ${inputPath}`);
    console.log(`Output: ${outputPath}`);
    console.log(`Size:   ${formattedBytes(input.length)} -> ${formattedBytes(compressed.length)} (${ratio.toFixed(1)}%)`);
    console.log(`SHA-256: ${fileHash(compressed)}`);
    console.log("Verification: passed");
}

const [, , inputArgument, outputArgument, qualityArgument] = process.argv;
if (!inputArgument || !outputArgument || ["-h", "--help", "/?"].includes(inputArgument)) {
    console.log(usage());
    process.exitCode = inputArgument ? 0 : 1;
}
else {
    compressFile(inputArgument, outputArgument, qualityArgument).catch((error) => {
        console.error(`Brotli compression failed: ${error.message || error}`);
        process.exitCode = 1;
    });
}
