import { defineConfig } from "vite"
import path from "node:path"

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: path.resolve(process.cwd(), "preview-runtime.html"),
      output: {
        entryFileNames: "preview-assets/[name]-[hash].js",
        chunkFileNames: "preview-assets/[name]-[hash].js",
        assetFileNames: "preview-assets/[name]-[hash][extname]",
      },
    },
  },
})
