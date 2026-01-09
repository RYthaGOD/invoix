
import * as esbuild from "esbuild";
import { readFileSync } from "fs";
import { resolve } from "path";


(async () => {
    // Build the server
    await esbuild.build({
        entryPoints: ["server/index.ts"],
        bundle: true,
        platform: "node",
        format: "esm",
        outdir: "dist",
        // Mark all node_modules as external to prevent bundling CJS/ESM issues
        packages: "external",
        logLevel: "info",
    });

    // Copy migrations folder to dist
    const { cpSync, rmSync, existsSync: exists } = await import("fs");

    // Clean existing migrations in dist to prevent stale file issues
    if (exists(resolve("dist/migrations"))) {
        rmSync(resolve("dist/migrations"), { recursive: true, force: true });
    }

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
