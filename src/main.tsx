import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./globals.css"
import App from "./App"
import "./phase4-final-ui.css"
import "./app-shell.css"
import "./editor-shell.css"

if (window.location.pathname === "/requests") void import("./my-requests.css")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
