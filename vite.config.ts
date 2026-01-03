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
          vendor: ['react', 'react-dom', 'wouter'],
          ui: ['@radix-ui/react-slot', '@radix-ui/react-accordion', 'framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
          solana: ['@solana/web3.js', '@solana/wallet-adapter-base', '@solana/wallet-adapter-react', '@solana/wallet-adapter-react-ui'],
          utils: ['date-fns', 'zod', 'bs58', 'buffer'],
        }
      }
    }
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
    // Explicitly define Solana RPC URL for client
    'import.meta.env.VITE_SOLANA_RPC_URL': JSON.stringify(
      process.env.VITE_SOLANA_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=f901ea4c-bd09-48be-9e7c-43f35d35bcf5'
    ),
    // Pass Sentry DSN to Client
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ""),
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
