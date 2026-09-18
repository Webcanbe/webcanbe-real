export function TailwindPanel() {
  return (
    <section className="mx-[7vw] mb-14 flex items-center justify-between gap-6 rounded-lg bg-black px-6 py-4 text-white">
      <div>
        <p className="m-0 text-lg font-semibold">Tailwind is a first-class source surface.</p>
        <p className="m-0 text-sm">Static utilities can be changed without creating inline styles.</p>
      </div>
      <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">Open files</button>
    </section>
  )
}
