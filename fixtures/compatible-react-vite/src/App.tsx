import { FeatureGrid } from "./components/FeatureGrid"
import { Hero } from "./components/Hero"
import { InlineNote } from "./components/InlineNote"
import { Navbar } from "./components/Navbar"
import { TailwindPanel } from "./components/TailwindPanel"

export function App() {
  return (
    <main>
      <Navbar />
      <Hero />
      <FeatureGrid />
      <TailwindPanel />
      <InlineNote />
    </main>
  )
}
