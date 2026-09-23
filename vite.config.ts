import { publicSitePlugin } from "./scripts/public-vite-plugin.mjs"
import { LocalLimaRunnerProvider } from "./src/webcanbe-engine/runtime/localLimaRunner"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { webCanBeFixturePlugin } from "./src/webcanbe-engine/runtime/viteFixturePlugin"

export default defineConfig({
  // Project source uses the controlled preview builder, separate from app transforms.
  plugins: [publicSitePlugin(),webCanBeFixturePlugin(process.cwd(), { fastRefresh: process.env.WCB_REACT_REFRESH === "1", runner: process.env.WCB_PREVIEW_PROVIDER === "lima" ? new LocalLimaRunnerProvider(process.cwd()) : undefined }), react(), tailwindcss()],
  // Keep the sizeable Firebase browser SDK out of the initial application chunk.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) return "vendor-firebase"
          if (id.includes("/node_modules/lucide-react/")) return "vendor-icons"
        },
      },
    },
  },
  // Project previews run only inside opaque-origin sandboxed frames.
  server: { watch: { ignored: ["**/.webcanbe/**"] }, host: "127.0.0.1", allowedHosts: ["localhost", "127.0.0.1"] },
})
