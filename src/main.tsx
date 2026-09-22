import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { PostHogProvider } from "@posthog/react"
import "./globals.css"
import App from "./App"
import "./phase4-final-ui.css"
import "./app-shell.css"
import "./editor-shell.css"
import { initializeAnalytics } from "./analytics"

if (window.location.pathname === "/requests") void import("./my-requests.css")

const posthog = initializeAnalytics()
const app = posthog ? <PostHogProvider client={posthog}><App /></PostHogProvider> : <App />

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {app}
  </StrictMode>
)
