import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

export type AiListboxOption = { value: string; label: string }

export default function AiListbox({ label, value, options, onChange, disabled = false, className = "" }: {
  label: string
  value: string
  options: AiListboxOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("pointerdown", outside)
    list.current?.focus()
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  const show = (index = selected) => { setActive(index); setOpen(true) }
  const choose = (index: number) => {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      show(Math.max(0, Math.min(options.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1))))
    }
  }
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); return }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault()
      setActive(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length)
    }
  }

  return <div className={`ai-listbox ${className}`} ref={root}>
    <button ref={trigger} type="button" className="ai-listbox-trigger" aria-label={`${label}: ${options[selected]?.label ?? "Choose"}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} disabled={disabled} onClick={() => open ? setOpen(false) : show()} onKeyDown={onTriggerKeyDown}>
      <span>{options[selected]?.label ?? "Choose"}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div ref={list} id={`${id}-list`} className="ai-listbox-menu" role="listbox" aria-label={label} aria-activedescendant={`${id}-option-${active}`} tabIndex={-1} onKeyDown={onListKeyDown}>
      {options.map((option, index) => <div id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={option.value === value} className={index === active ? "is-active" : ""} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>{option.label}</div>)}
    </div>}
  </div>
}
