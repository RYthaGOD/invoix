import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

import { fileURLToPath } from "url";
import { dirname } from "path";

import { nodePolyfills } from "vite-plugin-node-polyfills";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    ...(process.env.NODE_ENV !== "production"
      ? [
        runtimeErrorOverlay(),
        process.env.REPL_ID !== undefined
          ? await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          )
          : null,
        process.env.REPL_ID !== undefined
          ? await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          )
          : null,
      ]
      : []),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    // Make global available
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.REPL_ID': JSON.stringify(process.env.REPL_ID),
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
