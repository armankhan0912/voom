import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json" with { type: "json" };

const root = import.meta.dirname;

export default defineConfig({
  root,
  base: "./",
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        overlay: resolve(root, "overlay.html"),
        recorder: resolve(root, "recorder.html"),
      },
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
