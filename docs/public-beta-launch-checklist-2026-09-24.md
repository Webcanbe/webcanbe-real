# Webcanbe Public Beta Launch Checklist — deadline 2026-09-24 21:00 KST

> This is the hard launch gate for the first truthful usable public beta.
> Static marketing/waitlist alone does not count.
> Paid checkout may follow if it is the only external blocker, but the usable beta itself must be public by the deadline.

## A. Core product — mandatory

- [ ] Public user can reach the real Webcanbe product from webcanbe.com.
- [ ] At least one launch project is legally/operationally usable for the beta.
- [ ] User can open a real project detail/preview.
- [ ] User can authenticate and reach the same Webcanbe account after refresh/re-login.
- [ ] User can create/materialize a working copy from an immutable release.
- [ ] Visual editing works on the real source.
- [ ] Code editing works on the same canonical source.
- [ ] Save creates durable accepted state.
- [ ] Reload/reopen restores the saved project correctly.
- [ ] Export produces a standalone codebase.
- [ ] Exported result builds independently.
- [ ] No Webcanbe runtime dependency is required by exported code.

## B. Auth / account — mandatory

- [ ] Google login production smoke passes.
- [ ] GitHub same-account linking/login E2E passes.
- [ ] Email/password same-account linking/login E2E passes.
- [ ] Refresh preserves the authenticated first-party session.
- [ ] Logout invalidates the session.
- [ ] Cross-account/cross-workspace access is refused.
- [ ] No fake/demo private account rows are shown in production.

## C. Production mutation / persistence — mandatory

- [ ] Gate 2 authenticated provider E2E is actually green, not merely code/CI green.
- [ ] Current Gate 3 activation candidate is reconciled with latest main.
- [ ] Product materialization mutation is deliberately activated in production only after Gate 2.
- [ ] One real production working copy is created successfully.
- [ ] One real Visual edit survives save/reopen.
- [ ] One real Code edit survives save/reopen.
- [ ] History/revision provenance remains coherent.
- [ ] Production smoke remains green after activation.
- [ ] Rollback point is known before mutation activation.

## D. Marketplace truthfulness — mandatory

- [ ] Only actually available launch projects are shown as usable.
- [ ] Preview corresponds to the actual release/source.
- [ ] Stack/source/compatibility facts are truthful.
- [ ] No fake sales, fake reviews, fake activity, fake seller metrics or fake “popular” claims.
- [ ] Unavailable features are disabled or clearly labelled unavailable.
- [ ] Empty states are truthful.
- [ ] At least one project demonstrates the complete project → edit → save/reopen → export value loop.

## E. Payment — mandatory only for PAID beta

If all items below pass, launch paid checkout. If payment is the only blocker, open the usable FREE/LIMITED beta anyway by the hard deadline.

- [ ] PayPal Standard production merchant path is available.
- [ ] Server creates authoritative order amount/product.
- [ ] Approve → capture works.
- [ ] Successful payment creates exactly one purchase/entitlement.
- [ ] Duplicate webhook/retry cannot double-grant.
- [ ] Refund path works.
- [ ] Purchase/entitlement state survives refresh/re-login.
- [ ] Creator earnings ledger records the sale correctly.
- [ ] Digital delivery evidence is recorded.
- [ ] Buyer-facing price/refund/license copy matches actual operation.
- [ ] No paid CTA is enabled before the flow is production-ready.

## F. Security / failure behavior — mandatory

- [ ] Production security headers remain present.
- [ ] Anonymous private API requests fail closed.
- [ ] CSRF/origin checks remain enforced on authenticated mutations.
- [ ] Unknown routes return truthful 404 behavior.
- [ ] No source maps/secrets are exposed in production.
- [ ] Supabase browser roles do not gain unintended Webcanbe table/routine access.
- [ ] Basic rate-limiting/abuse boundary remains active.
- [ ] Error state is visible/recoverable instead of silently fabricating success.
- [ ] A failed save/export/payment never appears as successful.

## G. Browser / UX minimum — mandatory

- [ ] Core flow works in Chromium.
- [ ] Core flow works in WebKit/Safari-class browser.
- [ ] Core flow works in Firefox or no known launch-blocking incompatibility remains.
- [ ] Mobile landing/login is not broken.
- [ ] No launch-blocking horizontal overflow.
- [ ] Keyboard focus does not make core auth/navigation unusable.
- [ ] Main product flow has no uncaught page error.
- [ ] Loading state does not leave user wondering whether operation succeeded.

## H. Launch inventory / presentation — minimum

- [ ] At least 1 excellent flagship project ready.
- [ ] Target: 3+ launch-ready projects before first public push.
- [ ] Each launch project has a real preview.
- [ ] Each has a clear title, source/stack info and actual usable screenshots.
- [ ] 15–40 second real workflow demo exists.
- [ ] X profile and first/launch post are ready.
- [ ] webcanbe.com is the canonical link used in public posts.
- [ ] Contact/support path exists for early users.

## I. Measurement — mandatory

- [ ] Real external users are distinguishable from operator/test accounts.
- [ ] Can count project detail/preview usage.
- [ ] Can count successful project starts/materializations.
- [ ] Can count edit/save/reopen/export completion.
- [ ] Can record real paid buyers separately if payment is enabled.
- [ ] Can trace where first users came from at least manually.
- [ ] Launch results are not inflated with founder/test traffic.

## J. Final launch decision

### GO — paid public beta
Use when A+B+C+D+E+F+G+I are green and H has at least one strong project.

### GO — free/limited public beta
Use when A+B+C+D+F+G+I are green, but E (payment) is still blocked.
- Paid CTAs stay disabled/truthful.
- Public users can still experience the real core product.
- Payment closure continues immediately after launch.

### NO-GO items
These are the only categories allowed to block the usable beta:
- account isolation/auth authority is broken
- materialization can corrupt or cross-access data
- save/reopen/export core promise is broken
- production has a serious security/data-loss issue
- no real project can legally/operationally be offered

Cosmetic polish, extra features, perfect inventory breadth, creator count, press assets, analytics perfection and personal-brand work are NOT launch blockers.

## Hard timing rule

- Preferred: launch as soon as checklist is green.
- 2026-09-23: desired latest normal launch date.
- **2026-09-24 21:00 KST: absolute public-beta deadline.**
- Do not mentally convert 9/25 into an acceptable fallback.
- By the deadline, either paid beta or truthful free/limited usable beta is public.
