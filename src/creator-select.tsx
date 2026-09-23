import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

type Option = Readonly<{ value: string; label: string }>

export function CreatorSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly Option[]; onChange: (value: string) => void }) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    optionRefs.current[active]?.focus()
    const closeOutside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("pointerdown", closeOutside)
    document.addEventListener("focusin", closeOutside)
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("focusin", closeOutside) }
  }, [open, active])

  const show = (index: number) => { setActive(index); setOpen(true) }
  const choose = (index: number) => { const option = options[index]; if (!option) return; onChange(option.value); setOpen(false); trigger.current?.focus() }
  const onTriggerKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); show(event.key === "ArrowUp" ? Math.max(0, selected - 1) : selected) }
  }
  const onOptionKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }
    if (event.key === "Tab") { setOpen(false); return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault()
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
      setActive(next)
      return
    }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active) }
  }

  return <div className="creator-select" ref={root}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="creator-select-trigger" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} disabled={!options.length} onClick={() => open ? setOpen(false) : show(selected)} onKeyDown={onTriggerKey}>
      <span id={`${id}-value`}>{options[selected]?.label || "No options available"}</span><ChevronDown aria-hidden="true" />
    </button>
    {open && <div className="creator-select-options" role="listbox" id={`${id}-options`} aria-labelledby={`${id}-label`} onKeyDown={onOptionKey}>
      {options.map((option, index) => <button key={option.value} ref={node => { optionRefs.current[index] = node }} type="button" role="option" aria-selected={option.value === value} tabIndex={-1} className={option.value === value ? "selected" : ""} onClick={() => choose(index)}>{option.label}</button>)}
    </div>}
  </div>
}
