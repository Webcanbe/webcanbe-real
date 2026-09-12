import styles from "./FeatureGrid.module.css"

const features = [
  ["Real files", "Changes land in the project you already own."],
  ["Small patches", "A color or sentence update should not rewrite a component."],
  ["Clear boundaries", "Unsupported code remains intact and available in source."],
]

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <article className={styles.card}>
      <span className={styles.index}>0{features.findIndex(([name]) => name === title) + 1}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}

export function FeatureGrid() {
  return (
    <section className="feature-section" id="work">
      <h2>Built with ordinary ingredients.</h2>
      <div className="feature-grid">
        {features.map(([title, description]) => <FeatureCard key={title} title={title} description={description} />)}
      </div>
    </section>
  )
}
