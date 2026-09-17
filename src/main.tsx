import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./globals.css"
import App from "./App"
import "./phase4.css"
import "./phase4-product-hub.css"
import "./phase4-operations.css"
import "./phase4-public-flow.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
