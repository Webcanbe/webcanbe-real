# PR #87 public experience correction and completion

## Scope and architecture

Continues `codex/wcb-public-marketplace-docs-shell` from `216d5f0728f0f3ca5917b93f0c735c0a5d096490`. No new PR, deployment or main merge.

- Restored separate capability and Marketplace projects sections while retaining the original hero and other landing sections. Removed invented testimonials, stale version badges and unfinished illustration text.
- Shared CTA uses the exact approved heading, body and `/login` action.
- Seven footer groups, 54 links, 50 distinct destinations: 49 internal destinations and the existing GitHub repository. Creator Studio and Publish a project enter the real authenticated creator routes. All internal destinations resolve; no dead footer links remain.
- Eight distinct support flows prepare categorized mail to `hello@webcanbe.com`; nothing is automatically sent or uploaded. Optional account ID/provider context is allowlisted from the existing read-only account API. URL context excludes query/hash; tokens, cookies, passwords, private source and email addresses are not automatically attached. Screenshots are attached by the user in their email client.
- Nine legal routes. Existing Terms and Privacy content is preserved, with legacy URLs redirected. Buyer/distribution/refund pages explicitly identify remaining legal review and avoid inventing commercial guarantees.

## Documentation

119 substantive task articles, 14 families, plus `/docs` and `/docs/index` = 121 Docs URLs. The shortest article is 166 words. Each article has an answer-first introduction, preparation, concrete steps, expected result, limitations/troubleshooting and at least three related links. No duplicated long body paragraphs, missing related URLs, duplicate slugs or thin two-sentence shells were found by the checks.

Content is authored in `src/public/content/docs/`, with shared types rather than giant conditional JSX. Primary implementation references include `CompatibleWorkspace.tsx`, `AiWorkspacePanel.tsx`, `hostedProductClient.ts`, the public plan configuration, catalog domain and existing policies. Documentation distinguishes source releases, entitlements, working copies, drafts and accepted revisions. Email documentation matches the actual email/password screen.

The docs shell retains the pale Webcanbe-purple header, transparent symbol, left grouped navigation, centered article and right TOC. Only the active family opens initially. Search, mobile navigation, previous/next, related links and a visible complete index support the larger collection. The reusable video block accepts approved supplied embeds; without media it offers a written guide and no fake play button.

## Crawlability and routing

`npm run build` renders public HTML from the same React/content source and writes it to `dist/__public/`. Public text arrives in the first response without a React mount or client content fetch. Documentation search progressively loads a separate index. Homepage HTML is served directly; the existing authenticated SPA remains in `app-shell.html`. `/plans` includes initial public guidance and then mounts the existing plan UI, preserving subscription selection and pending-checkout resumption without changing payment authority.

Cloudflare Worker maps only registered public routes to generated HTML and returns real 404 pages for unknown public addresses. It renders public listing details and initial category results from existing catalog reads, with no change to payment, auth, AI or source transaction authority. Listing IDs redirect to canonical slugs. Preview/acquisition routes retain the established app flow and are noindex. Catalog outages return truthful unavailable states or 503, not invented listings.

- 153 generated public URLs, all with unique titles, descriptions and canonical URLs, OpenGraph and Twitter metadata.
- `robots.txt`: public crawling allowed; explicit OAI-SearchBot policy allows public pages and excludes private surfaces. GPTBot remains governed separately by the existing general policy; no claim of guaranteed ranking.
- `/sitemap.xml` indexes `/sitemap-public.xml` (153 URLs) and `/sitemap-listings.xml` (live published/available catalog records, maintained `updated_at` lastmod). Static pages omit fabricated dates.
- JSON-LD: Organization, WebSite, WebApplication, TechArticle, BreadcrumbList; ItemList for actual catalog records; SoftwareSourceCode for an actual published project. No ratings, reviews or invisible FAQs.
- `/llms.txt` is concise and factual. `/llms-full.txt` is generated automatically from the same public article source.
- No existing referral analytics stack was found; no new tracking was added for ChatGPT UTM parameters. Parameters do not change content or UX.
- Vercel static fallback routing is updated to avoid routing private pages to the static homepage. Live catalog HTML/sitemap integration is the Cloudflare production path; no Vercel deployment was performed.

## Validation

- TypeScript and production build: pass.
- Public validation: 153 routes, 121 Docs URLs, 40,868 internal anchor occurrences checked; unique metadata/canonical coverage 153/153; JSON-LD parses on all 153 pages; sitemap, robots, navigation, article quality and footer checks pass.
- Public regression selection: **11 suites / 42 tests pass**, including Worker HTTP response contracts, real 404s, alias redirects, static/React footer parity, catalog rendering and escaping, carousel boundaries/keyboard/cleanup, docs anchors, search, and support context redaction.
- Build budgets: pass. App distribution 12.61 MiB; largest app JS 669.5 KiB; CSS 466.3 KiB total. Docs article text is not added to the initial public JS path.
- Browser smoke at 1280×720 and 390×844: docs search opens the intended article; grouped/mobile navigation opens and links; carousel moves both directions; category cards open the expected collection; support form fields/context and two-column mobile footer render correctly; no horizontal overflow or console errors observed.
- First paint: homepage and Docs render from initial HTML with blocking stylesheets and self-hosted swap fonts. No black hero block or broken-then-recovered state observed. Docs observed CLS 0 with Layout Shift API support. This is a local smoke observation, not a field performance guarantee.

## Whole-repository test limitation

Full suite was also run outside the localhost sandbox restriction and compared to a clean archive of the supplied PR head:

| Revision | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Existing PR head | 1144 | 110 | 61 |
| Corrected branch | 1154 | 109 | 61 |

The final branch has **zero new failing test identities** compared with that baseline. One stale public privacy-link assertion was corrected. The full repository suite is **not green**: remaining failures include absent separately locked runtime profiles and pre-existing source-shape assertions/engine tests. No core editor/auth/payment behavior was changed to make those tests pass. The initial sandbox-only run additionally failed localhost socket tests; it is not used for the comparison above.

Live production inventory and real email delivery were not tested or changed. Catalog success/404/schema behavior is covered with controlled catalog fixtures; the local browser truthfully shows unavailable inventory when the backend is absent. Buyer, creator-distribution and refund legal finalization remains a business/legal review task, explicitly stated on those pages.

### Reproduce public checks

```sh
npm ci --ignore-scripts
npm run build
npm run public:check
npx vitest run src/public src/phase4-landing-retention.test.ts src/phase4-landing-webcanbe.test.ts src/phase5-csp-compat.test.ts src/phase5-google-branding.test.ts src/phase5-browser-run-visual-preview.test.ts src/phase5-launch-hardening.test.ts src/phase5-launch-truthfulness.test.ts worker/security-headers.test.js
node scripts/launch/build-budget.mjs
```

### Technical references

- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): search crawler and training crawler policies are distinct.
- [TechArticle](https://schema.org/TechArticle), [SoftwareSourceCode](https://schema.org/SoftwareSourceCode), [BreadcrumbList](https://schema.org/BreadcrumbList): schema types used for corresponding visible content.

### Existing failing test identities

- `src/phase3-landing.test.ts > Phase 4 WebCanBe landing > uses the local editable landing and preserves product routes`
- `src/phase4-operations.test.ts > Phase 4 authenticated operations surfaces > adds an operator-only read surface without inventing client-side authority`
- `src/phase4-operations.test.ts > Phase 4 authenticated operations surfaces > loads the Phase 4 operations style layer after the product hub styles`
- `src/phase4-operations.test.ts > Phase 4 authenticated operations surfaces > uses the real hosted sign-in start boundary instead of a fake successful login`
- `src/phase4-public-production.test.ts > Phase 4 public production seams > finishes OIDC on a fixed same-origin completion route and resumes safe browser intent`
- `src/phase4-ux-foundation.test.ts > Phase 4 product UX foundation > loads the Phase 4 layer after the existing application module`
- `src/phase5-editor-durable-export.test.ts > Phase 5 durable save, canonical revision and standalone export > exports the accepted bytes and builds them in a fresh checkout without Webcanbe runtime state`
- `src/phase5-gate4-launch-chain.test.ts > Gate 4 launch chain: materialize → Visual → Code → reload → export > carries immutable release provenance through accepted source and independent export`
- `src/webcanbe-engine/phase2-breadth-config.test.ts > compiles constant nested aliases, same-directory config inheritance and a confined custom publicDir without altering source`
- `src/webcanbe-engine/phase2-breadth-css.test.ts > compiles unchanged finite tailwind3 configuration through a dedicated profile`
- `src/webcanbe-engine/phase2-breadth-css.test.ts > compiles unchanged finite unocss configuration through a dedicated profile`
- `src/webcanbe-engine/phase2-breadth-html.test.ts > admits only a confined inert local manifest and strips it from controlled preview HTML without changing canonical source`
- `src/webcanbe-engine/phase2-breadth-html.test.ts > preserves alternate mount, body attributes, local stylesheet and canonical HTML in HTTP and Blob compilation`
- `src/webcanbe-engine/phase2-breadth-locks.test.ts > selects the existing dedicated profile and compiles an authored project from a complete bun graph`
- `src/webcanbe-engine/phase2-breadth-locks.test.ts > selects the existing dedicated profile and compiles an authored project from a complete yarn graph`
- `src/webcanbe-engine/phase2-breadth-values.test.ts > compiles granted public values without editing canonical source or reading example values`
- `src/webcanbe-engine/phase2-common-applications.test.ts > admits only lock-verified client transitives and rejects tampered transitive locks`
- `src/webcanbe-engine/phase2-common-applications.test.ts > preserves CSS resource URLs without fetching or admitting remote JavaScript`
- `src/webcanbe-engine/phase2-common-applications.test.ts > selects a complete versioned profile and compiles declared Lucide in confinement`
- `src/webcanbe-engine/phase2-common-applications.test.ts > skips absent optional peers but verifies present optional peer locks`
- `src/webcanbe-engine/phase2-common-applications.test.ts > statically interprets path.resolve('./src') without changing configuration`
- `src/webcanbe-engine/phase2-common-applications.test.ts > statically interprets path.resolve(__dirname, './src') without changing configuration`
- `src/webcanbe-engine/phase2-common-applications.test.ts > statically interprets resolve('./src') without changing configuration`
- `src/webcanbe-engine/phase2-common-applications.test.ts > verifies required peer locks even when the peer is not directly declared`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > applies Rollup minimum chunk size to an eligible independent export graph`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > compiles forms, directives, variant groups and responsive media dark with canonical export preservation`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > derives a non-root Vite HTML entry and public directory while keeping aliases config-relative`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > rebuilds Uno snapshots after source edits and applies HTML groups and admitted module extensions`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > refuses export graph imports outside immutable inputs and leaves module side effects unexecuted`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > represents finite build options independently and applies them in the pinned Rollup worker`
- `src/webcanbe-engine/phase2-compatibility-edge.test.ts > supports the same finite transformers on the retained pinned Uno66 graph`
- `src/webcanbe-engine/phase2-final-semantic.test.ts > does not silently claim support for unknown semantic options or a missing dedicated profile`
- `src/webcanbe-engine/phase2-final-semantic.test.ts > keeps transpilation distinct from semantics and never runs config or changes source`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses tooling as a static Vite plugin and through a source symlink`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses uploaded tooling .pnp.cjs in Blob, HTTP and independent export compilation`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses uploaded tooling .pnp.loader.mjs in Blob, HTTP and independent export compilation`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses uploaded tooling .yarn/plugins/uploaded.cjs in Blob, HTTP and independent export compilation`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses uploaded tooling .yarn/releases/yarn-4.2.2.cjs in Blob, HTTP and independent export compilation`
- `src/webcanbe-engine/phase2-p05-boundaries.test.ts > refuses uploaded tooling src/.yarn/plugins/uploaded.cjs in Blob, HTTP and independent export compilation`
- `src/webcanbe-engine/phase2-p05-forms-adapter.test.ts > reproduces the forms1 checkbox, radio and file-input semantics under UnoCSS 66`
- `src/webcanbe-engine/phase2-p05-forms-adapter.test.ts > reproduces the forms1 input, textarea, select and placeholder preflight semantics under UnoCSS 66`
- `src/webcanbe-engine/phase2-p05-inert-tooling.test.ts > preserves inert tooling as source-owned bytes but refuses importing it into the controlled browser graph`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 Visual, Code, undo and redo share one nested canonical history before exact export`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 actual independent application exports preserve external imports and apply chunk merging`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 builds lazy application exports with base ./ and inert scripts`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 builds lazy application exports with base /nested/ and inert scripts`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 derives canonical source and mapping for . / src`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 derives canonical source and mapping for apps/web / apps/web/src`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 derives canonical source and mapping for client / client/src`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 derives canonical source and mapping for frontend / frontend/source`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 exports the retained Vite8 application graph through the fixed pinned Rollup compiler`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 real export API returns exact ZIP only after the independent production gate passes`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 refuses changed root identity, traversal writes and a hidden second source tree`
- `src/webcanbe-engine/phase2-p06.test.ts > P06 uses matching static Vite and referenced TS aliases in a nested source tree`
- `src/webcanbe-engine/phase2-p39.test.ts > P39 broker consumes a numbered input frame once and retires replay before delivery`
- `src/webcanbe-engine/phase2.test.ts > controlled preview compiler > bundles React/CSS Modules without evaluating uploaded configuration`
- `src/webcanbe-engine/phase2.test.ts > controlled preview compiler > compiles the existing realistic Tailwind fixture with only installed defaults`
- `src/webcanbe-engine/phase2.test.ts > project capability boundary > enforces auth and stale revisions at the HTTP mutation boundary, including history`
- `src/webcanbe-engine/phase2b.test.ts > explicit runtime profiles > does not silently substitute BrowserRouter or custom Tailwind configuration`
- `src/webcanbe-engine/phase2b.test.ts > explicit runtime profiles > imports, resolves, maps, edits and exports studio-ledger without changing dependency declarations`
- `src/webcanbe-engine/phase2b.test.ts > explicit runtime profiles > imports, resolves, maps, edits and exports trail-atlas without changing dependency declarations`
- `src/webcanbe-engine/phase2c.test.ts > HTTP compiler transport and unchanged source > compiles coast-paths, retaining its router/config and real text/style/history/export`
- `src/webcanbe-engine/phase2c.test.ts > HTTP compiler transport and unchanged source > compiles harbor-desk, retaining its router/config and real text/style/history/export`
- `src/webcanbe-engine/phase2c.test.ts > HTTP compiler transport and unchanged source > never publishes source maps, config, private files or linked public assets`
- `src/webcanbe-engine/phase2c.test.ts > HTTP compiler transport and unchanged source > recognizes nested and aliased router imports without weakening the Blob guard`
- `src/webcanbe-engine/phase2c.test.ts > authorized HTTP artifacts, isolation and lifecycle > cleans failed starts and limits active resources`
- `src/webcanbe-engine/phase2c.test.ts > authorized HTTP artifacts, isolation and lifecycle > denies preview A's credential at B and rejects forged hosts, methods and duplicate cookies`
- `src/webcanbe-engine/phase2c.test.ts > authorized HTTP artifacts, isolation and lifecycle > expires, revokes, stops and rebuilds without retaining readable stale artifacts`
- `src/webcanbe-engine/phase2c.test.ts > authorized HTTP artifacts, isolation and lifecycle > requires a live server session; bootstrap is single-use, host-only and read-only`
- `src/webcanbe-engine/phase2c.test.ts > authorized HTTP artifacts, isolation and lifecycle > serves permitted HTML navigation but returns typed 404s for missing resources and reserved paths`
- `src/webcanbe-engine/phase2c.test.ts > fail-closed editor admission > expires unused bootstrap tickets before the underlying source session`
- `src/webcanbe-engine/phase2c.test.ts > fail-closed editor admission > refuses HTTP even with client-supplied enable flags, while keeping revision-bound source inspection and export`
- `src/webcanbe-engine/phase2c.test.ts > fail-closed editor admission > reserves compiler capacity before asynchronous startup and cannot restart a closed registry`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > closes a late startup after shutdown; an abort is never counted as a running preview`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > copies validated routes before asynchronous boundaries and sweeps revocation without a browser callback`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > denies wrong/inspect-only capabilities and cross-project or sibling-session generation access`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > discards a revoked in-flight raster and serializes runner operations`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > invalidates expire independently of browser cleanup and rejects subsequent reads`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > invalidates revoke independently of browser cleanup and rejects subsequent reads`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > invalidates source independently of browser cleanup and rejects subsequent reads`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > keeps capabilities and executable artifacts out of the display descriptor; input confers no source authority`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > quarantines after failed cleanup and rejects executable/malformed output`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > rejects stale source before launch and failed startup never returns an HTML fallback`
- `src/webcanbe-engine/phase2c1.test.ts > controlled preview foundation (not a network isolation proof) > retires old generations on replacement, stop and transport restart`
- `src/webcanbe-engine/phase2c2.test.ts > projects observations and binds input to the delivered frame sequence`
- `src/webcanbe-engine/phase2c2.test.ts > quarantines startup when the provider cannot verify stop/reap, before reusing capacity`
- `src/webcanbe-engine/phase2c2.test.ts > rejects malformed geometry across the worker JSON boundary`
- `src/webcanbe-engine/phase2c2.test.ts > rejects malformed identity across the worker JSON boundary`
- `src/webcanbe-engine/phase2c2.test.ts > rejects malformed logs across the worker JSON boundary`
- `src/webcanbe-engine/phase2c2.test.ts > rejects malformed route across the worker JSON boundary`
- `src/webcanbe-engine/phase2c2.test.ts > requires observed source identity to resolve in the current authorized project`
- `src/webcanbe-engine/phase2de.test.ts > shared code/visual HTTP acceptance > keeps an invalid draft outside canonical source/history and records failed save validation`
- `src/webcanbe-engine/phase2de.test.ts > shared code/visual HTTP acceptance > records a validated checkpoint without changing source or losing redo`
- `src/webcanbe-engine/phase2de.test.ts > shared code/visual HTTP acceptance > serializes concurrent requests and replays only identical idempotency keys`
- `src/webcanbe-engine/phase2de.test.ts > shared code/visual HTTP acceptance > shares canonical changes and rejects stale SourceAnchors after structural code edits`
- `src/webcanbe-engine/phase2de.test.ts > shared code/visual HTTP acceptance > validates and commits a rename with its importing code, plus create/delete, as one revision`
- `src/webcanbe-engine/phase2f.test.ts > Phase 2F authorized Code / Visual / durable revision integration > reanalyzes Code responsive source, rejects stale anchors, and persists responsive history/undo across restart`
- `src/webcanbe-engine/phase2g-authority.test.ts > hosted actual API source/history boundary > enforces viewer writes through HTTP and records the authenticated actor on real source transactions`
- `src/webcanbe-engine/phase2g-runtime.test.ts > versioned runtime/configuration profile expansion > compiles unchanged independent vite-react18-ts and verifies every upstream file hash`
- `src/webcanbe-engine/phase2g-runtime.test.ts > versioned runtime/configuration profile expansion > compiles unchanged independent vite-react19-ts and verifies every upstream file hash`
- `src/webcanbe-engine/phase2g-runtime.test.ts > versioned runtime/configuration profile expansion > statically translates local base, jsconfig aliases and standard environment constants`
- `src/webcanbe-engine/phase2g-runtime.test.ts > versioned runtime/configuration profile expansion > translates literal CSS theme only in an expanded versioned profile`
- `src/webcanbe-engine/phase2g-runtime.test.ts > versioned runtime/configuration profile expansion > uses incremental contexts without stale transformed modules and distinguishes CSS from module reloads`
- `src/webcanbe-engine/phase2g2-refresh.test.ts > confined React refresh compiler > classifies an existing component boundary, CSS and a non-component entry accurately`
- `src/webcanbe-engine/phase3-hosted-product.test.ts > Phase 3 isolated seller assessment worker > fails closed without the hosted isolation marker and bounds checker timeout as an errored immutable result`
- `src/webcanbe-engine/phase3-hosted-product.test.ts > Phase 3 isolated seller assessment worker > rejects cancelled and stale-worker delivery even after isolated work returns`
- `src/webcanbe-engine/phase3-hosted-product.test.ts > Phase 3 isolated seller assessment worker > runs the exact frozen snapshot out of process under the live lease and accepts only through the result boundary`
- `src/webcanbe-engine/phase3-hosted-product.test.ts > Phase 3 isolated seller assessment worker > survives a pre-result worker loss by reclaiming the same snapshot under a newer fence`
- `worker/editor-projects.test.js > Worker AST Visual transactions > builds the actual API export independently from an existing fixture`
