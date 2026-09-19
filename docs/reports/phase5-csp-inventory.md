# Phase 5 CSP compatibility inventory — 2026-09-19 KST

Implementation merge: `1386f4006bd162edbff89613e2557778d8b62ecb`

## Retained landing inventory

Source: `public/wcb-landing/index.html`

Observed before enforcement:

- landing HTML size: ~859 KB
- external runtime script sources: 0
- inline script blocks: 0
- `eval()`: absent
- `new Function()`: absent
- external runtime asset origins: 0
- inline `<style>` blocks: 3
- inline `style=""` attributes: 120

Normal external links/canonical metadata are not treated as runtime resources.

## React root inventory

Source: `index.html`

- inline script blocks: 0
- application script: same-origin Vite module entry
- inline style blocks: 0

## Enforced policy

The Worker now emits an enforced `Content-Security-Policy` with these boundaries:

- `default-src 'self'`
- `script-src 'self'`
- `script-src-attr 'none'`
- no `'unsafe-eval'`
- no inline script allowance
- `style-src 'self' 'unsafe-inline'`
- `style-src-attr 'unsafe-inline'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- `base-uri 'self'`
- same-origin workers plus `blob:`
- Firebase/Google API connectivity is explicitly allowed
- Firebase auth handler / Google auth frames are explicitly allowed
- image/media allowances remain broad enough for provider avatars/project media without widening script authority

## Why inline style remains allowed

The retained landing still depends on inline style blocks and style attributes. Removing `'unsafe-inline'` from style policy would require a separate landing transformation and visual-parity pass. Script authority does not need this exception and remains strict.

## Regression gate

`src/phase5-csp-compat.test.ts` now fails if the retained landing silently gains:

- inline runtime scripts
- external runtime script/resource origins
- `eval()`
- `new Function()`

The Phase 5 CI additionally checks the CSP header contract, Worker syntax, Vite production build, and Wrangler bundle dry-run.
