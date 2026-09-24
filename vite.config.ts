import { publicSitePlugin } from "./scripts/public-vite-plugin.mjs"
import { LocalLimaRunnerProvider } from "./src/webcanbe-engine/runtime/localLimaRunner"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { webCanBeFixturePlugin } from "./src/webcanbe-engine/runtime/viteFixturePlugin"
import { execFileSync } from "node:child_process"

const buildRevision = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()

export default defineConfig({
  // Project source uses the controlled preview builder, separate from app transforms.
  plugins: [publicSitePlugin(),webCanBeFixturePlugin(process.cwd(), { fastRefresh: process.env.WCB_REACT_REFRESH === "1", runner: process.env.WCB_PREVIEW_PROVIDER === "lima" ? new LocalLimaRunnerProvider(process.cwd()) : undefined }), react(), tailwindcss()],
  // Keep the sizeable Firebase browser SDK out of the initial application chunk.
  build: {
    manifest: true,
    rollupOptions: {
      input: { main: "index.html", preview: "preview-runtime.html" },
      output: {
        entryFileNames: `assets/[name]-${buildRevision}-[hash].js`,
        chunkFileNames: `assets/[name]-${buildRevision}-[hash].js`,
        assetFileNames: `assets/[name]-${buildRevision}-[hash][extname]`,
        manualChunks(id) {
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) return "vendor-firebase"
          if (id.includes("/node_modules/lucide-react/")) return "vendor-icons"
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) return "vendor-react"
        },
      },
    },
  },
  // Project previews run only inside opaque-origin sandboxed frames.
  server: { watch: { ignored: ["**/.webcanbe/**"] }, host: "127.0.0.1", allowedHosts: ["localhost", "127.0.0.1"] },
})
