# Public marketplace and documentation shell

## Scope

Preserves the current Webcanbe hero, product sections, logo assets, fonts, marketplace and detail routes. No editor, dashboard, authentication, purchase, or database behavior was changed. Shared public navigation now uses the existing transparent SVG mark rather than a white-backed favicon.

Docs follow the user-supplied screenshot's structure: a full-width two-row header, grouped left rail, centered article, right table of contents, thin dividers and a reusable media block. The user's later direction supersedes the saturated reference header: pale Webcanbe purple with dark text is intentional.

## Routes

Retained: `/browse`, `/project/:slug`, `/project/:slug/preview`, `/docs` and the existing documentation sections. Added `/marketplace` alias and `/docs/history`.

Added `/legal`, `/legal/terms`, `/legal/privacy`, `/legal/licenses`, `/legal/acceptable-use`, `/legal/privacy-requests`. Legal content reuses the existing policies, with canonical links to the existing terms/privacy/license routes. No new contractual terms were invented.

Added `/contact/support`, `/contact/sellers`, `/contact/sales`, `/contact/partnerships`, `/contact/issues`, `/contact/account`. These provide useful support guidance and subject-specific email links to the existing hello@webcanbe.com inbox.

All new routes are included in the Worker public-route allowlist. Unknown documentation paths render the not-found page instead of silently showing Introduction.

## Content and extension points

- `src/public/docs-content.ts`: route-driven articles and grouped navigation. Add future articles here, including optional `video: { src, title }` metadata; the same shell supplies search, navigation, TOC and adjacent-article links.
- `src/public/DocsShell.tsx`: responsive documentation layout, search and keyboard shortcut.
- `src/public/EmbeddedVideo.tsx`: privacy-enhanced YouTube/Vimeo embed, with a written-guide fallback when no media is configured. CSP allows only the two additional embed hosts; no remote scripts were added.
- `src/public/footer-data.json`: five groups with six useful links each, shared by React and the static landing.
- `src/public/marketplace-categories.json`: static browse-category cards. Run `node scripts/sync-public-footer.mjs` after changing footer/category data.
- `public/landing-interactions.js`: local progressive enhancement, scroll/keyboard carousels, mobile navigation, and published project cards. Published inventory is never synthesized: catalog failure or empty inventory retains category links instead.

Fictional review copy is supplied as requested for the public design. No external identity or endorsement was verified. Obtain real customer approval before treating those reviews as verified endorsements.

## Validation

- Production build and all build-size budgets pass. Vite retains the existing large-chunk advisory.
- Thirteen focused suites / 43 tests pass: route allowlist, static/React footer parity, documentation TOC targets, video fallback, keyboard/boundary carousel behavior and cleanup, safe listing rendering, CSP, metadata, and existing public launch regressions.
- In-app browser: all 30 unique footer destinations visited; no missing page. `/plans` correctly reports unavailable billing configuration in the local environment.
- Marketplace category card → filtered results → project detail; project structure tab; next/previous carousel controls; native FAQ disclosure; docs search → Export article; mobile docs navigation.
- Production preview checked separately from the dev server. Hero reports no initial animation/filter, and desktop has no horizontal overflow.
- Desktop 1440×1000, reference-native 2555×1245, and mobile 390×844 checked. User screenshot and implementation captures inspected with `view_image`.

## Visual review

1. Header: reference's two-row organization retained; saturated purple intentionally replaced with pale lavender per the user's follow-up.
2. Brand: existing Webcanbe mark and wordmark retained; white logo tile removed.
3. Structure: grouped left navigation, narrow article and right TOC retained; wide-screen article centered in the viewport.
4. Typography: existing Webcanbe family, compact navigation labels, readable body copy and restrained heading scale.
5. Media: centered 16:9 frame with a working guide link until actual media is supplied; no inactive play button.
6. Footer: light purple, thin dividers, five useful navigation groups and a sign-in CTA immediately above it.
7. First paint: styles load before landing insertion; hero blur/reveal removed and decorative glow layers suppressed.

Above-the-fold landing copy changes are the requested Browse templates / Sign in actions and removal of the unverified 54.4k adoption count. The core headline and description remain unchanged. The nested miniature-page gallery was replaced with data-driven browse cards to remove dead miniature controls. The user screenshot, not the early generated concept, is the final structural reference.

No production deployment or paid transaction was performed. Local catalogue detail smoke uses the repository's existing local data mode; published-card rendering is additionally covered by a controlled response test. Live catalogue inventory and supplied video playback are not asserted by this validation.
