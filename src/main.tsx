import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./globals.css"
import App from "./App"
import "./phase4.css"
import "./phase4-product-hub.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
