import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

import { fileURLToPath } from "url";
import { dirname } from "path";

import { nodePolyfills } from "vite-plugin-node-polyfills";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      nodePolyfills({
        protocolImports: true,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    root: "client",
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React
            vendor: ["react", "react-dom", "wouter"],

            // UI Components (Radix + animations)
            ui: [
              "@radix-ui/react-slot",
              "@radix-ui/react-accordion",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "framer-motion",
              "lucide-react",
              "clsx",
              "tailwind-merge",
            ],

            // Solana core
            "solana-core": [
              "@solana/web3.js",
            ],

            // Solana wallet adapters
            "solana-wallet": [
              "@solana/wallet-adapter-base",
              "@solana/wallet-adapter-react",
              "@solana/wallet-adapter-react-ui",
            ],

            // SPL Token (separate chunk for tree-shaking)
            "solana-spl": [
              "@solana/spl-token",
            ],

            // Metaplex (large - separate chunk)
            metaplex: [
              "@metaplex-foundation/umi",
              "@metaplex-foundation/mpl-token-metadata",
            ],

            // React Query
            query: [
              "@tanstack/react-query",
            ],

            // Utilities
            utils: ["date-fns", "zod", "bs58", "buffer", "decimal.js"],

            // Charts (if using recharts/chart.js)
            charts: ["recharts"],
          },
        },
      },
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    define: {
      // Make global available
      global: "globalThis",
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      // Explicitly define Solana RPC URL for client
      // Use public devnet RPC as fallback (slower but no rate limits)
      // For production, set VITE_SOLANA_RPC_URL to a dedicated Helius/QuickNode endpoint
      "import.meta.env.VITE_SOLANA_RPC_URL": JSON.stringify(
        env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      ),
      "import.meta.env.VITE_SOLANA_NETWORK": JSON.stringify(
        env.VITE_SOLANA_NETWORK || "devnet",
      ),
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
});
