import { useEffect, useRef, useState } from "react"

export default function Home({ onNavigate }: { onNavigate: (to: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    const addedHead: Element[] = []
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
        parsed.head.querySelectorAll('style,link[rel="stylesheet"],link[rel="preload"][as="font"]').forEach(node => {
          const clone = node.cloneNode(true) as Element
          clone.setAttribute("data-wcb-landing-asset", "true")
          document.head.appendChild(clone)
          addedHead.push(clone)
        })
        document.documentElement.className = Array.from(new Set((previousHtmlClass + " " + parsed.documentElement.className + " mounted").split(/\s+/).filter(Boolean))).join(" ")
        document.body.className = parsed.body.className
        host.current.innerHTML = parsed.body.innerHTML
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Landing page unavailable.")
      }
    }

    void load()

    const click = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || !host.current?.contains(anchor)) return
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
      currentHost?.removeEventListener("click", click)
      addedHead.forEach(node => node.remove())
      document.body.className = previousBodyClass
      document.documentElement.className = previousHtmlClass
    }
  }, [onNavigate])

  return <main className="landing-react-host" ref={host}>{error && <div className="landing-load-error"><b>Webcanbe</b><p>{error}</p><button onClick={() => window.location.reload()}>Reload</button></div>}</main>
}
