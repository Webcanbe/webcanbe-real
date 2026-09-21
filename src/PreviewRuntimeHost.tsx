import { useEffect } from "react"

export default function PreviewRuntimeHost() {
  useEffect(() => {
    const hostRoot = document.getElementById("root")
    if (hostRoot && hostRoot.id === "root") {
      hostRoot.id = "wcb-preview-host-root"
      hostRoot.setAttribute("aria-hidden", "true")
      hostRoot.style.display = "none"
    }
    let projectRoot = document.getElementById("root")
    if (!projectRoot) {
      projectRoot = document.createElement("div")
      projectRoot.id = "root"
      document.body.append(projectRoot)
    }
    document.documentElement.dataset.wcbPreviewHost = "1"
    void import("./preview-runtime")
  }, [])

  return <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>Preparing isolated project preview…</main>
}
