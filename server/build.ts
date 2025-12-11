
import * as esbuild from "esbuild";
import { readFileSync } from "fs";
import { resolve } from "path";


// Read package.json to get dependencies
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));
const dependencies = Object.keys(packageJson.dependencies || {});

(async () => {
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

    // Copy migrations folder to dist
    const { cpSync } = await import("fs");
    cpSync(resolve("migrations"), resolve("dist/migrations"), { recursive: true });

    // Verify copy
    const { existsSync, readdirSync } = await import("fs");
    if (existsSync(resolve("dist/migrations/meta/_journal.json"))) {
        console.log("✅ Migrations copied to dist/migrations (Verified journal exists)");
    } else {
        console.error("❌ ERROR: Migration copy failed - journal missing in dist/migrations");
        if (existsSync(resolve("dist/migrations"))) {
            console.log("Contents of dist/migrations:", readdirSync(resolve("dist/migrations")));
        }
        process.exit(1);
    }
})();
