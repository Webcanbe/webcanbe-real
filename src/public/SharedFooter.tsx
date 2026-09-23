import groups from './footer-data.json'
export function SharedCTA() {
  return <section className="wcb-public-cta"><div><span className="wcb-cta-eyebrow">Your next project starts here</span><h2>Start with source you can keep building.</h2><p>Explore a real project, make your own working copy, and edit it in Visual, Code, or Split. Your accepted source remains available to review and export.</p><div className="wcb-cta-actions"><a href="/browse" className="wcb-public-button">Explore Marketplace</a><a href="/docs/getting-started" className="wcb-public-secondary">See how it works</a></div></div></section>
}
export function SharedFooter() {
  return <footer className="wcb-public-footer"><div className="wcb-footer-intro"><a href="/" aria-label="Webcanbe home"><img src="/brand/webcanbe-logo.svg" alt="Webcanbe" width="150" height="28"/></a><p>Edit visually. Leave with real code you own.</p></div><div className="wcb-footer-groups">{groups.map(group=><nav key={group.title} aria-label={group.title}><h2>{group.title}</h2>{group.links.map(([label,href])=><a key={label} href={href}>{label}</a>)}</nav>)}</div><div className="wcb-footer-bottom"><span>© 2026 Webcanbe</span><span>The source is the product.</span></div></footer>
}
