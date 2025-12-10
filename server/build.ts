
import * as esbuild from "esbuild";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read package.json to get dependencies
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));
const dependencies = Object.keys(packageJson.dependencies || {});

// Build the server
await esbuild.build({
    entryPoints: ["server/index.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outdir: "dist",
    // Only mark actual dependencies as external, allowing @shared to be bundled
    external: dependencies,
    logLevel: "info",
});
