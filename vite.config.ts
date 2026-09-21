import { LocalLimaRunnerProvider } from "./src/webcanbe-engine/runtime/localLimaRunner"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { webCanBeFixturePlugin } from "./src/webcanbe-engine/runtime/viteFixturePlugin"

export default defineConfig({
  // Project source uses the controlled preview builder, separate from app transforms.
  plugins: [webCanBeFixturePlugin(process.cwd(), { fastRefresh: process.env.WCB_REACT_REFRESH === "1", runner: process.env.WCB_PREVIEW_PROVIDER === "lima" ? new LocalLimaRunnerProvider(process.cwd()) : undefined }), react(), tailwindcss()],
  build: { rollupOptions: { input: { app: path.resolve(process.cwd(), "index.html"), previewRuntime: path.resolve(process.cwd(), "preview-runtime.html") } } },
  // Project previews run only inside opaque-origin sandboxed frames.
  server: { watch: { ignored: ["**/.webcanbe/**"] }, host: "127.0.0.1", allowedHosts: ["localhost", "127.0.0.1"] },
})
