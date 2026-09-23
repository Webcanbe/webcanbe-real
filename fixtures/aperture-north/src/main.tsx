import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const work = [
  ['Field House', 'Identity and site for a slow-living hotel.', '01'],
  ['Still Room', 'Digital home for an independent gallery.', '02'],
  ['Cedar Row', 'A considered journal for a landscape practice.', '03'],
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <main>
    <header className="site-header"><a className="wordmark" href="#top">Aperture<br/>North</a><button className="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button><nav className={menuOpen ? 'open' : ''}><a href="#work">Work</a><a href="#approach">Approach</a><a href="#contact">Contact</a></nav></header>
    <section className="hero" id="top"><img src="/studio-preview.png" alt="Sunlit studio with architectural models and material samples"/><div className="hero-copy"><p>Independent design practice<br/>for places, objects and stories.</p><h1>Making the everyday<br/><em>feel observed.</em></h1></div><a className="scroll" href="#work">Scroll to discover <span>↓</span></a></section>
    <section className="intro" id="approach"><p className="eyebrow">A small studio, worldwide</p><h2>We turn a clear point of view into visual systems that make room for real life.</h2><div><p>From first thought to finished environment, Aperture North works across identity, digital, editorial and spatial design.</p><a href="#contact">Our approach <span>↗</span></a></div></section>
    <section className="work" id="work"><header><p className="eyebrow">Selected work</p><p>2019—2026</p></header><div className="work-grid">{work.map(([title, description, index]) => <article key={title}><div className={`project-art art-${index}`}><span>{index}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className="statement"><p>We work slowly enough to notice what matters, and precisely enough to give it a durable form.</p><span>AN</span></section>
    <section className="contact" id="contact"><p className="eyebrow">Start a conversation</p><h2>Have a place,<br/>object or story<br/>in mind?</h2><a href="mailto:hello@example.com">hello@aperturenorth.studio <span>↗</span></a></section>
    <footer><span>© Aperture North</span><span>New York · Copenhagen</span><a href="#top">Back to top ↑</a></footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<App />)
