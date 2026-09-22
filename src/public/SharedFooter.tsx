import groups from './footer-data.json'
export function SharedCTA() {
  return <section className="wcb-public-cta"><div><h2>Pick up where you left off.</h2><p>Sign in to open your projects and keep building with your source.</p></div><a href="/login" className="wcb-public-button">Sign in to Webcanbe</a></section>
}
export function SharedFooter() {
  return <footer className="wcb-public-footer"><div className="wcb-footer-intro"><a href="/" aria-label="Webcanbe home"><img src="/brand/webcanbe-logo.svg" alt="Webcanbe" width="150" height="28"/></a><p>Edit visually. Leave with real code you own.</p></div><div className="wcb-footer-groups">{groups.map(group=><nav key={group.title} aria-label={group.title}><h2>{group.title}</h2>{group.links.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav>)}</div><div className="wcb-footer-bottom"><span>© 2026 Webcanbe</span><span>The source is the product.</span></div></footer>
}
