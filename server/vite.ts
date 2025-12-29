import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logger } from "./logger";

export function log(message: string, source = "express") {
  logger.info(message, source);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import vite only in development
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteConfig = (await import("../vite.config")).default;

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, we assume standard structure:
  // dist/index.js
  // dist/public/index.html
  const distPath = path.resolve(__dirname, "public");

  console.log(`[Static] Serving files from: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    console.error(`[Static] CRITICAL: Could not find build directory: ${distPath}`);
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, path) => {
      // Index.html and other root files should not be cached or should be revalidated
      if (path.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    // Basic verification that index.html exists
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.error(`[Static] Index file missing at: ${indexPath}`);
      return res.status(500).send("Application build is missing index.html");
    }
    // Ensure index.html is not cached so users get the latest version immediately
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexPath);
  });
}
