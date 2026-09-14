import { useId, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent } from "react"
import type { SourceTarget, StyleOrigin } from "../core/types"
import { pixelGestureOrigin, pixelGestureValue, siblingGestureDirection } from "./semanticGesture"

type Property = "width" | "height" | "gap"
type Edit = { type: "reorder"; value: string } | { type: "layout"; property: Property; value: string; breakpoint: string }
type Props = { target: SourceTarget; origins: StyleOrigin[]; scale: number; breakpoint: string; disabled: boolean; onEdit: (edit: Edit) => void }
type Drag = { id: number; x: number; y: number; kind: Property | "reorder" }

/** The parent remounts this control on source, selection, route, viewport or scope
 * changes. Pointer capture is transient UI state; only one semantic edit is sent. */
export default function SourceGestures({ target, origins, scale, breakpoint, disabled, onEdit }: Props) {
  const drag = useRef<Drag | undefined>(undefined)
  const [hint, setHint] = useState("")
  const help = useId()
  function edit(kind: Drag["kind"], dx: number, dy: number) {
    if (disabled) return
    if (kind === "reorder") {
      const direction = siblingGestureDirection(dx, dy, scale)
      if (direction && target.reorder?.[direction] !== undefined) onEdit({ type: "reorder", value: direction })
    } else {
      const start = pixelGestureOrigin(origins, kind)
      const value = start && pixelGestureValue(start, kind === "height" ? dy : dx, scale)
      if (value !== undefined) onEdit({ type: "layout", property: kind, value, breakpoint })
    }
  }
  function start(event: PointerEvent<HTMLButtonElement>, kind: Drag["kind"]) {
    if (disabled || event.button !== 0 || !event.isPrimary) return
    event.preventDefault(); event.stopPropagation()
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, kind }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHint(kind === "reorder" ? "Right/down: next source sibling. Left/up: previous. All breakpoints." : `${kind} · ${breakpoint} · identified source scope`)
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    drag.current = undefined; setHint("")
    if (!current || current.id !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    edit(current.kind, event.clientX - current.x, event.clientY - current.y)
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, kind: Drag["kind"]) {
    if (event.key === "Escape") { drag.current = undefined; setHint(""); return }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault(); event.stopPropagation()
    const delta = (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) * (kind === "reorder" ? 24 : event.shiftKey ? 10 : 1) * scale
    edit(kind, delta, delta)
  }
  const kinds: Array<Property | "reorder"> = ["width", "height", "gap"].filter(kind => pixelGestureOrigin(origins, kind as Property)) as Property[]
  if (target.reorder && breakpoint === "base") kinds.push("reorder")
  return <>{kinds.map(kind => <button key={kind} type="button" className={`source-gesture source-gesture-${kind}`} aria-label={kind === "reorder" ? "Drag source sibling order" : `Resize source ${kind}`} aria-describedby={help} title={kind === "reorder" ? "Drag right/down for next source sibling, left/up for previous. Arrow keys also reorder. Affects all breakpoints." : `Drag to change existing ${kind} at ${breakpoint}. Arrow keys: 1px; Shift+Arrow: 10px.`} disabled={disabled} onPointerDown={event => start(event, kind)} onPointerUp={finish} onPointerCancel={() => { drag.current = undefined; setHint("") }} onLostPointerCapture={() => { drag.current = undefined; setHint("") }} onKeyDown={event => keyboard(event, kind)}>{kind === "reorder" ? "↔" : kind === "gap" ? "Gap" : ""}</button>)}<output id={help} className="source-gesture-hint" aria-live="polite">{hint}</output></>
}
