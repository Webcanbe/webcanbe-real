import './App.css'
import { Note } from './components/Note'

// This fixture is a small editorial project; the source is intentionally ordinary.
export function App() {
  return (
    <main className="page">
      <header className="masthead"><strong>Field notes</strong><span>Independent observations · Issue 04</span></header>
      <section className="intro">
        <p>A WEEKEND EDITION</p>
        <h1>Make room for a slower week.</h1>
        <p>Ideas, places, and small rituals worth keeping.</p>
      </section>
      <section className="cards">
        <Note title="A walk by the water" description="Leave the headphones at home. Take the longer way back." />
        <Note title="Something worth reading" description="A small pile of books for an unhurried Sunday." />
      </section>
      <aside style={{ padding: 24, margin: '24px 0', backgroundColor: '#e7eddc', borderRadius: 12 }}>
        <h2>{'A note for next week'}</h2><p>One useful idea is enough to begin.</p>
      </aside>
      <section className="p-6 md:p-8 lg:p-10 flex items-center justify-between gap-4 rounded-lg bg-black text-white">
        <p className="text-lg font-semibold">Keep a little space for curiosity.</p><button className="px-4 py-2 bg-white text-black rounded-md">Read the archive</button>
      </section>
      <footer className="footer"><span>Made with ordinary React and CSS.</span><span>Thanks for reading.</span></footer>
    </main>
  )
}
