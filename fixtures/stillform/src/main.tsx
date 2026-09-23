import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`
const projects = [
  { number: '01', title: 'The Coast House', place: 'Residential · Mediterranean', image: 'hero.jpg', description: 'A quiet dialogue between sheltered stone and the open sea.' },
  { number: '02', title: 'A Room to Breathe', place: 'Interiors · Portugal', image: 'interior.jpg', description: 'Morning light, honest materials, and space to simply be.' },
  { number: '03', title: 'The Olive Court', place: 'Architecture · Greece', image: 'courtyard.jpg', description: 'A courtyard shaped around its oldest inhabitant.' },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <main id="top">
    <header className="site-header"><a className="wordmark" href="#top" aria-label="Stillform home">stillform<span className="wordmark-dot">.</span></a><nav className={menuOpen ? 'open' : ''} aria-label="Main navigation"><a href="#work" onClick={() => setMenuOpen(false)}>Work</a><a href="#studio" onClick={() => setMenuOpen(false)}>Studio</a><a href="#journal" onClick={() => setMenuOpen(false)}>Journal</a></nav><a className="contact-link" href="#contact">Get in touch <span>↗</span></a><button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button></header>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">Independent architecture & interiors</p><h1 id="hero-title">Spaces for<br/>a <em>slower life.</em></h1><div className="hero-bottom"><p>Architecture and interiors for a more human tomorrow. Designed with care, made to last.</p><a href="#work">Explore our work <span>↗</span></a></div></div><div className="hero-photo"><img src={asset('hero.jpg')} alt="Contemporary stone-and-wood coastal home at dawn" fetchPriority="high"/><div className="photo-caption"><span>01 / 03</span><span>The Coast House — Mediterranean</span></div></div></section>
    <section className="intro" id="studio"><div><p className="eyebrow">The way we see it</p><span className="intro-index">S — 01</span></div><div><h2>Good spaces don't ask for attention.<br/><em>They make room for living.</em></h2><p>We are a small, independent practice working across architecture, interiors, and place. Our approach is simple: listen closely, remove the unnecessary, and let material, light, and time do their work.</p></div></section>
    <section className="selected" id="work"><div className="section-heading"><div><p className="eyebrow">Selected projects</p><h2>Places with<br/><em>presence.</em></h2></div><span>2023 — 2026</span></div><div className="project-grid">{projects.map((project, index) => <article className={index === 0 ? 'project-featured' : ''} key={project.number}><div className="project-image"><img src={asset(project.image)} alt={`${project.title} architectural project`} loading={index === 0 ? 'eager' : 'lazy'}/><span>{project.number}</span></div><div className="project-meta"><div><h3>{project.title}</h3><p>{project.place}</p></div><span aria-hidden="true">↗</span></div><p className="project-description">{project.description}</p></article>)}</div></section>
    <section className="manifesto"><p className="eyebrow">Our practice</p><h2>Beauty isn't extra.<br/>It's how a place <em>feels like home.</em></h2><div><p>We believe thoughtful design begins with curiosity. Each commission is an opportunity to connect people, landscape, and the everyday rituals between them.</p><a href="#contact">Start a conversation <span>↗</span></a></div></section>
    <section className="journal" id="journal"><div className="journal-image"><img src={asset('studio.jpg')} alt="Architect at work on a model in a sunlit studio" loading="lazy"/></div><div className="journal-copy"><p className="eyebrow">From the studio · No. 01</p><h2>The art of<br/><em>looking closer.</em></h2><p>On materials, memory, and finding the extraordinary in what already exists.</p><a href="#contact">Talk with the studio <span>↗</span></a></div></section>
    <section className="contact" id="contact"><p className="eyebrow">A new beginning</p><h2>Let's make space<br/>for <em>what matters.</em></h2><a href="mailto:hello@webcanbe.com?subject=Stillform%20project%20inquiry">hello@webcanbe.com <span>↗</span></a><p className="contact-note">This starter site is yours to customize. Replace the example studio details with your own.</p></section>
    <footer><a className="wordmark" href="#top">stillform<span className="wordmark-dot">.</span></a><span>Made with care · Made by Webcanbe</span><a href="#top">Back to top ↑</a></footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
