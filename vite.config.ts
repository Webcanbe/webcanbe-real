import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { webCanBeFixturePlugin } from "./src/webcanbe-engine/runtime/viteFixturePlugin"

export default defineConfig({
  // The fixture transform must see raw TSX before React turns it into JS.
  plugins: [webCanBeFixturePlugin(process.cwd()), react(), tailwindcss()],
  server: { allowedHosts: ["fixture.localhost"] },
})
