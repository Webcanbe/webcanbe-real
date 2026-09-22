# WebCanBe editor design QA

final result: passed

## Visual target and evidence

Primary reference: user-supplied light editor screenshot, `NSIRD_screencaptureui_kfK7Gj/스크린샷 2026-09-22 오후 6.24.12.png` (2560 × 1355 source pixels). Additional user screenshots show Pages, Assets, Canvas menu, sharing, and publish-status popovers.

Implementation: local `/workspace/northstar?mode=canvas`, browser screenshot saved to `../../outputs/editor-final.png` (1440 × 900 CSS viewport; screenshot 1440 × 900). Share menu evidence: `../../outputs/editor-share.png`. Mobile inspected at 390 × 844.

Source and implementation were viewed together. The reference's exported image density is unspecified; this is a structural comparison, not a pixel-identical or content-identical claim. The implementation uses the actual local source fixture; its page content is intentionally not replaced with the Framer screenshot. The provided WebCanBe mark is preserved.

## Comparison history

1. Earlier editor used source filenames as its primary navigation and retained dark style remnants. Replaced primary navigation with Pages / Layers / Assets, resolved layer names from source, and moved connection controls behind project settings. Replaced the permanent mode toolbar with the Canvas menu and actual project metadata. Applied white inspector chrome and thin neutral separators.
2. The source tree had card-like rows and several inherited rules changed spacing. Replaced them with compact 26px tree rows, fixed inherited display rules, and kept nesting based on source ranges.
3. Earlier canvas scaling counted padding and allowed an unscaled layout footprint to overflow. Fit now measures the content box and uses a scaled artboard footprint. Settled desktop/mobile captures confirm visible controls and contained overflow.
4. The initial local blob document did not render in the embedded browser. The exact preview HTML now uses srcdoc, retaining allow-scripts-only sandbox and the supplied CSP. Real preview rendering, selection, visual mutation, undo, and Code synchronization were verified.
5. A selected outline could remain fixed while interaction mode was enabled. Geometry refresh now runs for selected elements in either mode and the overlay is clipped to its viewport. Browser PageDown changed the selected heading's top from 212.672 to -188.328; PageUp restored 212.672. The outline disappeared outside the viewport and returned with the heading. Layers selection resolves to the corresponding rendered identity.

## Required fidelity surfaces

- Typography: compact Inter/system sans chrome, 10–11px labels and 27px toolbar controls. Source code retains monospace. No oversized editor headings.
- Spacing/layout: slim 40px top toolbar; 208px left navigation; 240px functional inspector at the tested desktop width; gray central canvas with an artboard label and floating bottom controls. Mobile keeps controls in a stacked layout. Thin panel divisions, no oversized editor cards.
- Color: white panel surfaces, quiet gray canvas/inputs, restrained purple selection/focus; source page colors remain source-owned.
- Assets: supplied WebCanBe SVG mark and existing icon library. Account image is from verified account data or initials. No fabricated avatars, timestamps, pages, collaborators, or publish status. The local fixture's external image is blocked by its existing preview resource policy; the fixture was not modified to disguise this.
- Content: project name, revision, history timestamp, source layers, computed measurements, files and project link come from real state. Share explicitly retains existing access requirements. Export represents the supported source archive action, rather than claiming a deployed website.

Focused inspection covered the top menu, left navigation, inspector inputs, share/export popovers, selected outline, code controls, and mobile toolbar. No actionable P0/P1/P2 shell findings remain within the preserved source-backed capabilities.

## Intentional product constraints

The existing runtime supplies one active preview; viewport selection remains real instead of adding decorative neighboring artboards. Unsupported Framer publishing, collaboration, CMS and drawing actions were not fabricated. Style inputs expose supported source mutations, with actual computed values read-only where the adapter cannot safely write. Code, Split, History, source diagnostics, and the existing AI request/proposal/apply flow remain available.

## Follow-up polish

P3: richer route discovery for additional router conventions can extend the current literal React Router and observed-route list. It must not infer nonexistent pages. Live Google OAuth and production workspace creation were not exercised with a real user account; their boundary behavior is covered by focused tests.
