# Phase 5 privacy/data-flow implementation audit

Date: 2026-09-19 KST  
Scope: implementation consistency, not legal advice or a legal-compliance certification.

## Result

The current public Privacy Policy is materially aligned with the authentication, session, profile, product-data, infrastructure, and telemetry behavior implemented in the repository as of this checkpoint.

No product code or UI design change was required by this audit.

## Authentication

### Google

Implementation:
- Authorization Code flow with PKCE S256 in the Cloudflare Worker.
- Standard OpenID Connect scopes: `openid email profile`.
- Google ID token is verified server-side.
- The Worker does not persist Google access or refresh tokens.

Policy mapping:
- Privacy §1 identifies Google sign-in and the limited OpenID Connect scopes.
- Privacy §1 explicitly states Webcanbe does not request Gmail, Drive, or Calendar access.
- Privacy §2 states Google ID tokens are verified server-side and access/refresh tokens are not persisted by the Webcanbe Google flow.

### GitHub and Email/Password

Implementation:
- Firebase Authentication handles GitHub and Email/Password.
- GitHub uses the Firebase GitHub provider.
- Email/Password credentials are submitted to Firebase Authentication, not the Webcanbe Worker.
- After Firebase login, a Firebase ID token is sent to the Webcanbe backend and cryptographically verified before a first-party session is established.

Policy mapping:
- Privacy §1 identifies Firebase Authentication, GitHub, and Email/Password.
- Privacy §2 describes the Firebase ID-token exchange and plaintext-password boundary.

## First-party session

Implementation:
- Production protected product authority is the first-party Webcanbe session.
- Before Hyperdrive, the production fallback is a signed Secure HttpOnly cookie.
- Once Hyperdrive is bound, the Worker switches to durable PostgreSQL-backed sessions.
- DB mode stores token/CSRF digests rather than plaintext tokens.
- Same-origin and CSRF checks protect authenticated POST boundaries.
- A user-wide DB session revocation boundary is prepared.

Policy mapping:
- Privacy §2 states hosted sessions use Secure HttpOnly cookies and do not expose the session token to application JavaScript.
- Privacy §8 describes server-side authorization, secure transport, same-origin and CSRF controls.

## Identity and account profile

Implementation:
- Identity authority is issuer + provider subject.
- Provider email is not sufficient authority to silently merge separate identities.
- `wcb_user_profiles` stores internal profile state such as display name and provider-derived profile metadata.
- Provider-derived email is treated as provider information rather than a user-editable account-merge key.

Policy mapping:
- Privacy §3 lists identifier/email verification/name/picture information.
- Privacy §3 explicitly says provider email addresses are not, by themselves, authority to silently merge separate provider identities.

## Product and project data

Implementation may store:
- workspace memberships
- source-backed project files/revisions/history
- immutable marketplace releases/listings
- entitlements/materializations
- creator submissions and review/assessment/publication records
- settings/profile data

Policy mapping:
- Privacy §4 describes these categories without claiming currently-disabled payment/deployment features are already active.

## Infrastructure

Current infrastructure:
- Cloudflare: static delivery, Worker execution, security/rate-limit boundary.
- Firebase Authentication: GitHub and Email/Password authentication.
- Supabase-hosted PostgreSQL: Webcanbe server-side product/account data.
- Browser-facing Supabase `anon` and `authenticated` roles have no direct privileges on `wcb_*` tables/functions.

Policy mapping:
- Privacy §6 names Cloudflare, Firebase Authentication, and Supabase-hosted PostgreSQL.
- Privacy §8 states production Webcanbe PostgreSQL data is intended for server-side access and browser-facing Supabase roles are not granted direct table access.

## Telemetry and abuse controls

Implementation:
- Worker responses receive an `X-Request-ID`.
- Structured failure telemetry is bounded to event/request-ID/path/status.
- The dedicated helper does not include cookies, tokens, CSRF values, email/profile fields, database credentials, or payment secrets.
- Cloudflare rate limiting uses hashed anonymous request fingerprints or the already-authorized internal user ID for private traffic.

Policy mapping:
- Privacy §§5 and 8 cover security, abuse prevention, failure diagnosis, and access-control purposes.
- The policy does not make a contradictory claim that no operational telemetry exists.

## Sharing / advertising

Implementation:
- No advertising SDK or ad-data path is present in the Webcanbe product implementation.
- Infrastructure/provider use is feature-bound.
- Payment and deployment providers are not yet active production data processors for disabled features.

Policy mapping:
- Privacy §7 states Webcanbe does not sell personal information or use sign-in data for third-party advertising.
- Privacy §6/§7 condition future payment/deployment providers on the relevant feature being enabled/used.

## Retention and deletion

Implementation:
- User-wide server session revocation exists.
- Full destructive account deletion is intentionally not yet exposed because purchase, ownership, seller, security, and audit retention semantics still need an explicit policy.
- Deletion requests currently route to `hello@webcanbe.com`.

Policy mapping:
- Privacy §9 describes retention in functional/legal/security terms and provides the deletion-request contact rather than falsely claiming one-click deletion is already implemented.

## Terms consistency

The Terms describe payment, deployment, AI-assisted editing, and creator functionality as features that may become available, rather than representing disabled pre-launch integrations as completed production capabilities.

The marketplace/release language is consistent with the repository's immutable release/publication model.

## Technical guard

`src/phase5-privacy-current.test.ts` protects the most important current disclosures:
- Firebase Authentication
- GitHub
- Email/Password
- Cloudflare
- Supabase-hosted PostgreSQL
- Secure HttpOnly cookies
- no Gmail access
- no sale of personal information
- no silent provider-account merge by email alone

## Remaining launch-time re-audit triggers

Re-run this implementation audit before launch if any of these change:
- payment provider becomes active
- deploy provider becomes active
- AI provider begins receiving user/project content
- analytics/marketing tooling is added
- full account-deletion automation is enabled
- log retention/export provider is connected
- provider linking rules change
