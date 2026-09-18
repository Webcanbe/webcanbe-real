import { BrowserRouter, Link, Routes, Route } from "react-router-dom"
import styles from "./card.module.css"
import "./app.css"
const gridClasses = "grid grid-cols-2 grid-rows-1 gap-4 md:gap-8"
function Authoring() {
  return <main className="p-4 md:p-8 lg:p-12">
    <h1>Responsive source workshop</h1>
    <nav><Link to="/details">Open details</Link></nav>
    <section className="flex flex-row gap-4 md:gap-8 items-center" aria-label="Flex samples">
      <p>First sibling</p>
      <p>Second sibling</p>
      <p>Third sibling</p>
    </section>
    <article className={gridClasses} aria-label="Grid samples"><p className="col-start-1">Grid one</p><p>Grid two</p></article>
    <aside className="responsive-card">CSS media sample</aside>
    <aside className="responsive-card">Shared CSS sample</aside>
    <footer className={styles.card}>Module sample</footer>
    <div style={{ padding: 12, width: "100%" }}>Inline sample</div>
  </main>
}
export function App() {
  return <BrowserRouter><Routes><Route path="/" element={<Authoring />} /><Route path="/details" element={<Authoring />} /></Routes></BrowserRouter>
}
