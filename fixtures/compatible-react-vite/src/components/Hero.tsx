import "../App.css"

export function Hero() {
  return (
    <section className="fixture-hero" id="top">
      <div>
        <p className="fixture-kicker">A normal Vite project</p>
        <h1>Build a real product.</h1>
        <p className="fixture-hero-copy">This page deliberately uses ordinary React components, CSS, CSS Modules, inline styles, responsive rules, and a small Tailwind surface.</p>
        <div className="fixture-actions">
          <button className="fixture-button">Start a project</button>
          <button className="fixture-button secondary">Read the notes</button>
        </div>
      </div>
      <div className="fixture-preview">
        <img src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=80" alt="A bright working studio" />
      </div>
    </section>
  )
}
