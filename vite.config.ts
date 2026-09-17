import { fileURLToPath, URL } from "node:url"
import { LocalLimaRunnerProvider } from "./src/webcanbe-engine/runtime/localLimaRunner"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { webCanBeFixturePlugin } from "./src/webcanbe-engine/runtime/viteFixturePlugin"

export default defineConfig({
  // Project source uses the controlled preview builder, separate from app transforms.
  plugins: [webCanBeFixturePlugin(process.cwd(), { fastRefresh: process.env.WCB_REACT_REFRESH === "1", runner: process.env.WCB_PREVIEW_PROVIDER === "lima" ? new LocalLimaRunnerProvider(process.cwd()) : undefined }), react(), tailwindcss()],
  resolve: {
  alias: {
    "@": fileURLToPath(new URL("./src/launch-ui", import.meta.url)),
    "next/link": fileURLToPath(new URL("./src/launch-ui/shims/next-link.tsx", import.meta.url)),
    "next/image": fileURLToPath(new URL("./src/launch-ui/shims/next-image.tsx", import.meta.url)),
  },
},
// Project previews run only inside opaque-origin sandboxed frames.
server: { watch: { ignored: ["**/.webcanbe/**"] }, host: "127.0.0.1", allowedHosts: ["localhost", "127.0.0.1"] },
})
