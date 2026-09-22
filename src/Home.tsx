import { useEffect, useRef, useState } from "react"

function hardenLandingAccessibility(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('button[data-slot="sheet-trigger"]').forEach(button => {
    if (!button.getAttribute("aria-label") && !(button.textContent || "").trim()) button.setAttribute("aria-label", "Open navigation")
  })
  root.querySelectorAll<HTMLButtonElement>('button[data-slot="slide-button"]').forEach(button => {
    button.setAttribute("aria-hidden", "true")
    button.tabIndex = -1
  })
}

export default function Home({ onNavigate }: { onNavigate: (to: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    const addedHead: Element[] = []
    let disposeInteractions: (() => void) | undefined
    const previousBodyClass = document.body.className
    const previousHtmlClass = document.documentElement.className

    const load = async () => {
      try {
        const response = await fetch("/wcb-landing/index.html", { credentials: "same-origin" })
        if (!response.ok) throw new Error("Landing document unavailable.")
        const html = await response.text()
        if (!active || !host.current) return
        const parsed = new DOMParser().parseFromString(html, "text/html")
        parsed.querySelectorAll("script,template[data-dgst]").forEach(node => node.remove())
        const stylesheetLoads: Promise<void>[] = []
        parsed.head.querySelectorAll('style,link[rel="stylesheet"],link[rel="preload"][as="font"]').forEach(node => {
          const clone = node.cloneNode(true) as Element
          clone.setAttribute("data-wcb-landing-asset", "true")
          if (clone instanceof HTMLLinkElement && clone.rel === "stylesheet") stylesheetLoads.push(new Promise((resolve, reject) => { clone.onload = () => resolve(); clone.onerror = () => reject(new Error("Landing styles could not load.")) }))
          document.head.appendChild(clone)
          addedHead.push(clone)
        })
        await Promise.all(stylesheetLoads)
        if (!active || !host.current) return
        document.documentElement.className = Array.from(new Set((previousHtmlClass + " " + parsed.documentElement.className + " mounted").split(/\s+/).filter(Boolean))).join(" ")
        document.body.className = parsed.body.className
        host.current.innerHTML = parsed.body.innerHTML
        hardenLandingAccessibility(host.current)
        const script = document.createElement("script")
        script.src = "/landing-interactions.js"
        await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = () => reject(new Error("Page interactions could not load.")); document.head.appendChild(script); addedHead.push(script) })
        if (active && host.current) disposeInteractions = (window as Window & {webcanbeInitializeLanding?: (root: HTMLElement) => () => void}).webcanbeInitializeLanding?.(host.current)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Landing page unavailable.")
      }
    }

    void load()

    const click = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || !host.current?.contains(anchor) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank") return
      const raw = anchor.getAttribute("href") || ""
      if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:")) return
      if (raw.startsWith("#")) {
        event.preventDefault()
        const id = raw.slice(1)
        if (id) host.current.querySelector("#" + CSS.escape(id))?.scrollIntoView({ behavior: "smooth" })
        return
      }
      const url = new URL(anchor.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      event.preventDefault()
      onNavigate(url.pathname + url.search + url.hash)
    }

    const currentHost = host.current
    currentHost?.addEventListener("click", click)
    return () => {
      active = false
      disposeInteractions?.()
      currentHost?.removeEventListener("click", click)
      addedHead.forEach(node => node.remove())
      document.body.className = previousBodyClass
      document.documentElement.className = previousHtmlClass
    }
  }, [onNavigate])

  return <main className="landing-react-host" ref={host}>{error && <div className="landing-load-error"><b>Webcanbe</b><p>{error}</p><button onClick={() => window.location.reload()}>Reload</button></div>}</main>
}
