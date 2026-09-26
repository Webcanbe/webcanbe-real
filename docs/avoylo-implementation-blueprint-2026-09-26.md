# Avoylo implementation blueprint — 2026-09-26

Status: implementation plan / Codex execution contract. No live payments, carrier purchases, inventory intake, contracts or production physical operations are authorized by this file.

## 1. Product definition

Avoylo is a U.S.-targeted distributed forward-stock / micro-fulfillment platform.

Initial wedge:
- Seller sends customer-ready, sealed, individually identifiable parcel units in batches.
- Approved Host stores those sealed units.
- Host does not open, pick individual components, kit, repack, inspect returns or provide customer pickup.
- When an order is allocated, Host locates the indicated parcel, scan-verifies it, applies the centrally generated carrier label, and hands it to the carrier.
- Seller remains merchant of record for the consumer sale. Avoylo is logistics/fulfillment software + service layer.
- Host is positioned as accessible side-gig capacity, subject to eligibility and later legal/classification review.

Historical Avoylo already modeled Seller/Host roles, Firebase listings/requests, host dashboard, RequestDetailModal, Firestore real-time updates, QR and a rough accepted -> stored -> reserved -> shipped -> completed flow. Do not blindly revive that overloaded state model. Rebuild around separate state machines and immutable custody events.

## 2. Implementation objective

Build a credible, secure, end-to-end sandbox operational core that can demonstrate:
1. Host applies and supplies capacity.
2. Seller defines a prepacked parcel profile and inbound batch.
3. Admin/system assigns batch to eligible Host; Host accepts.
4. Parcel units receive opaque QR IDs.
5. Host scans receipt and storage.
6. Seller imports/creates an order.
7. System atomically allocates one eligible stored parcel.
8. Shipping adapter creates a TEST label/tracker.
9. Host sees one fulfillment task, scan-verifies parcel, obtains label, marks carrier handoff.
10. Carrier webhook updates shipment state.
11. Seller sees inventory/order/shipment state.
12. Host sees earnings ledger entries.
13. Admin can investigate every exception from an audit/custody log.

This build must be useful without:
- live money,
- live postage purchase,
- real inventory,
- insurance automation,
- nationwide routing,
- AI,
- returns,
- ratings,
- referral/gamification,
- marketplace browsing of private Host homes,
- custom courier network.

## 3. Stack decision

Use a fresh repository and fresh non-production infrastructure. Do not share Webcanbe production DB/secrets.

Recommended stack:
- TypeScript end to end.
- React + Vite SPA.
- Cloudflare Workers API using Hono.
- Cloudflare Vite plugin / Wrangler for local-prod runtime parity.
- Supabase PostgreSQL + Supabase Auth.
- Supabase private Storage for Host-space photos, custody photos, and copied label assets if required.
- SQL migrations committed to repo.
- Vitest for unit/integration domain tests.
- Playwright for E2E.
- Optional fast-check for state-machine/property tests.
- EasyPost TEST adapter first. Keep ShippingProvider interface so Shippo/direct carrier can be added later.
- PayPal SANDBOX adapter only after core logistics flow is green. Host payouts initially ledger-only; do not make PayPal Payouts a dependency for the first green E2E.

Reason for Postgres instead of resurrecting Firestore:
inventory reservation, state transitions, immutable ledgers, uniqueness, concurrency and audit relationships are central. Use DB transactions and constraints to prevent double allocation rather than relying on UI discipline.

## 4. Repository shape

Keep one repository and one implementation branch.

/
  apps/
    web/
    worker/
  packages/
    domain/
    db/
    ui/
    test-fixtures/
  supabase/
    migrations/
    seed.sql
  docs/
    ARCHITECTURE.md
    DOMAIN.md
    SECURITY.md
    PROVIDERS.md
    RUNBOOK.md
    DECISIONS.md
    TEST_PLAN.md

Do not split into microservices.

## 5. Roles and permissions

Roles:
- seller_owner
- seller_operator
- host
- admin
- support_readonly (optional later)

Never trust role strings from editable user metadata.

Use database memberships / approved host profile state. Enable RLS on every exposed table. Explicit policies for select/insert/update/delete. No service-role key in browser.

Sensitive tables are API-only:
- host_location_private
- shipment_recipient_private
- provider_credentials / integration secrets (ideally external secrets manager, never DB plaintext)
- admin_notes

Host exact residential address must never appear in public seller browse/search surfaces.

## 6. Core relational model

Minimum tables:

auth-linked:
- profiles
- organizations
- organization_memberships
- seller_profiles
- host_profiles
- host_locations
- host_location_private
- host_capacity_snapshots
- service_areas

catalog / placement:
- parcel_profiles
  - seller_org_id
  - merchant_sku
  - title
  - category
  - dims
  - weight
  - declared_value
  - accepted_goods attestations
  - active
- inbound_batches
- inbound_batch_items
- host_assignment_offers
- parcel_units
- parcel_qr_tokens

orders / fulfillment:
- orders
- order_items (first wedge enforces one parcel profile/fixed bundle per fulfillable order)
- parcel_reservations
- fulfillment_tasks
- shipments
- shipment_recipient_private
- carrier_events

custody / exceptions:
- custody_events (append-only)
- asset_photos
- exceptions
- claims (schema only / disabled operationally until policy exists)
- audit_events

money:
- seller_ledger_entries
- host_ledger_entries
- provider_payment_records
- provider_payout_records

integrations:
- shipping_provider_accounts
- webhook_events
- webhook_deliveries / processing status
- idempotency_keys
- integration_connections (Shopify later)

configuration:
- policy_versions
- feature_flags
- metro/service-area config
- fee_rules (versioned; no hard-coded fee constants in UI)

Every business row has created_at/updated_at; externally mutable entities also have version integer for optimistic concurrency where useful.

## 7. Separate state machines

Do NOT create one generic request.status.

Host application:
DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> ACTIVE
ACTIVE <-> PAUSED
any reviewed state -> REJECTED / SUSPENDED / CLOSED as allowed

Inbound batch:
DRAFT -> SUBMITTED -> MATCHING -> OFFERED -> HOST_ACCEPTED
-> INBOUND_PENDING -> IN_TRANSIT -> RECEIVING -> RECEIVED -> CLOSED
with CANCELLED / EXCEPTION branches.

Parcel unit:
CREATED -> INBOUND -> RECEIVED -> STORED -> RESERVED
-> HANDOFF_READY -> HANDED_OFF -> CARRIER_ACCEPTED -> DELIVERED
with EXCEPTION / LOST / DAMAGED under explicit rules.

Order:
IMPORTED -> VALIDATED -> ALLOCATION_PENDING -> ALLOCATED
-> FULFILLMENT_READY -> HANDED_OFF -> IN_TRANSIT -> DELIVERED
with CANCELLED / EXCEPTION.

Shipment:
LABEL_PENDING -> LABEL_CREATED -> PRE_TRANSIT -> IN_TRANSIT
-> DELIVERED
with FAILURE / RETURNED / UNKNOWN.

Money:
ledger entries are immutable; do not model balance as a mutable source of truth.

Every accepted transition:
- runs server-side,
- checks actor/authorization,
- checks current state,
- checks entity invariants,
- performs state mutation and custody/audit event in ONE DB transaction,
- is idempotent,
- records request_id / actor_id / reason / provider ref.

## 8. Non-negotiable invariants

- A parcel unit belongs to one Seller and one parcel profile forever.
- Host cannot receive/scan a parcel not assigned to that Host location.
- RESERVED requires STORED.
- One parcel cannot back two active orders.
- Allocation must be atomic at DB level (lock/transaction), not "check then update" in JS.
- Order Seller must equal parcel Seller.
- Package profile must match order/fixed bundle.
- HANDOFF requires label + parcel verification.
- DELIVERED normally comes from carrier event; admin override requires reason and audit event.
- Duplicate QR scans must be idempotent, not double-create custody/money events.
- Duplicate carrier/payment webhooks must be safe.
- Host earnings are created from defined fulfilled/capacity events only; payout does not mutate inventory.
- Seller fees, Host earnings and provider transactions remain separate ledgers.
- No negative available inventory.
- No exact Host address returned to unauthorised seller users.
- QR contains an opaque high-entropy token, never PII or sequential primary key.

## 9. Host mobile UX

Host experience is mobile-first and task-first.

Dashboard:
- Available capacity.
- Incoming batches needing accept/decline.
- Parcels currently stored.
- Tasks due today.
- Earnings accrued / pending payout.
- Exceptions.

Scan screen:
- large camera viewport,
- manual code fallback,
- one action per screen,
- haptic/sound confirmation if possible,
- exact parcel image/merchant-safe identifier,
- explicit "wrong parcel" hard stop,
- no customer DB access.

Flows:
- accept batch,
- receive master shipment,
- scan each sealed parcel,
- optional condition photo,
- store,
- outbound task,
- scan parcel,
- label display/print,
- handoff confirmation,
- carrier acceptance update.

No gamification.

## 10. Seller UX

Do not show a home-storage Airbnb marketplace.

Seller sees:
- coverage/service area,
- cost estimator,
- parcel profiles,
- inventory counts by metro,
- inbound batches,
- orders,
- shipments,
- exceptions,
- charges.

Seller placement flow:
1. create parcel profile,
2. choose target service area / quantity,
3. see estimate and policy checks,
4. submit placement request,
5. system/admin finds Host,
6. after Host acceptance seller receives inbound instructions.

Host identity/address is disclosed only to the extent operationally required for the accepted placement.

Initial order ingestion:
- manual order form,
- CSV upload,
- Shopify adapter only after the core flow is stable.

## 11. Admin UX

Admin is not optional. Physical operations fail in edge cases.

Queues:
- host applications,
- pending placements,
- inbound exceptions,
- unallocated orders,
- overdue Host tasks,
- carrier exceptions,
- ledger mismatches,
- security/audit events.

Admin actions need reasons and audit trails.

Do not allow arbitrary SQL-like edits in UI.

## 12. Shipping provider boundary

Define ShippingProvider:
- validateAddress()
- getRates()
- createLabel()
- getTracker()
- cancelShipment() where supported
- verifyWebhook()
- normalizeEvent()

First adapter: EasyPost TEST mode only.
- no production key required for core development,
- webhooks verified using provider-supported secret/HMAC,
- raw provider payload stored with PII minimization and retention policy,
- normalized carrier event processed idempotently.

Never let Host log into Seller carrier accounts.
Do not hard-code UPS/FedEx account credential sharing.

Feature flag:
SHIPPING_LIVE=false by default.

## 13. Payments boundary

Do not block logistics implementation on payments.

PaymentProvider:
- createSellerCheckout / invoice intent
- capture / reconcile
- refund if later required
- verifyWebhook

PayoutProvider:
- createHostPayout
- getPayoutStatus
- verifyWebhook

First build:
- seller charges and host earnings ledger fully implemented,
- provider adapter = sandbox/mock,
- PAYMENTS_LIVE=false,
- PAYOUTS_LIVE=false.

PayPal sandbox can be added after logistics E2E passes. No production credentials in code/repo.

## 14. Privacy / data minimization

- Host residential address: API-only private table.
- End recipient address: API-only private table.
- Host receives only the recipient/label data needed for assigned task.
- Seller does not receive unrelated Host data.
- Admin access to private fields audited.
- Photos private, signed URLs short-lived.
- Never expose raw PII in analytics.
- Add configurable retention job for recipient PII after shipment + defined retention window; do not choose a legal retention duration until policy review.
- no customer pickup at Host.

## 15. Feature flags

At minimum:
- PHYSICAL_OPS_ENABLED=false
- SHIPPING_LIVE=false
- PAYMENTS_LIVE=false
- PAYOUTS_LIVE=false
- SHOPIFY_ENABLED=false
- HOST_APPLICATIONS_PUBLIC=false
- SELLER_SIGNUP_PUBLIC=false

Codex must never flip live flags merely to make a demo pass.

## 16. Exact route/page map

Public:
- /
- /sellers
- /hosts
- /how-it-works
- /coverage
- /pricing (estimate only until fee model approved)
- /login
- /signup

Seller:
- /seller
- /seller/parcels
- /seller/inbound
- /seller/orders
- /seller/shipments
- /seller/billing
- /seller/settings

Host:
- /host
- /host/apply
- /host/inbound
- /host/storage
- /host/tasks
- /host/scan
- /host/earnings
- /host/settings

Admin:
- /admin
- /admin/host-applications
- /admin/service-areas
- /admin/placements
- /admin/inbound
- /admin/orders
- /admin/exceptions
- /admin/ledger
- /admin/audit

## 17. API surface

Examples:
POST /api/host/applications
POST /api/seller/parcel-profiles
POST /api/seller/inbound-batches
POST /api/inbound-batches/:id/submit
POST /api/host/assignment-offers/:id/accept
POST /api/host/scans
POST /api/seller/orders
POST /api/seller/orders/import
POST /api/orders/:id/allocate
POST /api/fulfillment-tasks/:id/create-label
POST /api/fulfillment-tasks/:id/handoff
POST /api/admin/... explicit actions
POST /api/webhooks/easypost
POST /api/webhooks/paypal

Prefer action endpoints for domain transitions rather than generic PATCH status.

## 18. Implementation phases and gates

Phase 0 — foundation
- repo/workspace,
- CI,
- env schema validation,
- docs,
- DB migration runner,
- feature flags.
GATE: typecheck/lint/unit/build green.

Phase 1 — auth + tenancy + RLS
- Supabase Auth,
- profile/org/membership,
- seller/host/admin authorization,
- private-data separation.
GATE: automated access-boundary tests prove Seller A cannot read Seller B, Host cannot read unrelated data, browser has no service key.

Phase 2 — Host + Seller onboarding
- Host application/capacity/private address/photos.
- Seller org/profile + parcel profile.
- service-area model.
GATE: full form validation + admin approval path + no fake coverage.

Phase 3 — placement + inbound + QR
- inbound batch,
- host offer/accept,
- opaque unit QR,
- receive/store scanning,
- custody ledger.
GATE: duplicate scans idempotent; wrong Host scan blocked; audit event always created.

Phase 4 — orders + atomic inventory allocation
- manual/CSV orders,
- reservation algorithm,
- task creation.
GATE: concurrency test with multiple orders cannot reserve same unit; cancellations release safely.

Phase 5 — shipping sandbox
- EasyPost TEST,
- label generation,
- private label access,
- handoff,
- verified webhook,
- carrier status.
GATE: duplicate/out-of-order webhooks safe; provider outage produces retryable exception, not data corruption.

Phase 6 — ledgers
- versioned fee rules,
- seller charge ledger,
- Host earnings ledger,
- sandbox/mock provider reconciliation.
GATE: double-run cannot duplicate charge/earning; balances derive from ledger.

Phase 7 — admin exception operations
- exception queues,
- reasoned overrides,
- audit.
GATE: every manual state correction is attributable and reversible or compensated by new event, never history deletion.

Phase 8 — end-to-end hardening
- Playwright Seller/Host/Admin,
- mobile scan tests,
- accessibility,
- responsive,
- failure injection,
- security review,
- production build.
GATE: all required flows green in sandbox, live flags still false.

Phase 9 — only after explicit separate approval
- PayPal sandbox integration,
- Shopify adapter,
- any live provider configuration,
- public Host/Seller signup,
- physical pilot.

Do not skip gates to reach a visually complete site.

## 19. Required tests

Unit/domain:
- every allowed/forbidden state transition,
- fee calculation,
- capacity calculation,
- role checks,
- opaque token validation.

Database/concurrency:
- double allocation,
- duplicate scan,
- order cancellation race,
- duplicate provider webhook,
- duplicate payout run,
- unique provider ref constraints,
- rollback tests.

Security:
- RLS cross-tenant access,
- Host exact address privacy,
- recipient PII privacy,
- admin-only actions,
- forged QR,
- expired signed URL,
- unverified webhook,
- rate limiting on scan and auth-sensitive endpoints.

E2E:
Seller creates profile -> parcel -> batch -> assigned Host accepts -> Host receives/scans -> Seller order -> allocation -> test label -> Host handoff -> carrier webhook -> delivered -> seller sees completion -> Host sees earning.

Also test exception branches, not only happy path.

## 20. Explicit non-goals

Do NOT build:
- AI features,
- live nationwide matching,
- pricing marketplace,
- Host chat,
- ratings/reviews,
- referral program,
- badges,
- returns processing,
- custom delivery network,
- customer pickup,
- arbitrary pick/pack/kitting,
- seller consumer checkout,
- carrier-rate negotiation features,
- insurance purchasing,
- legal-status automation,
- crypto/stablecoin,
- enterprise SSO,
- native mobile apps.

## 21. Design standard

Visual identity: premium U.S. logistics/technology company; clean white / blue / neutral; operational confidence; mobile-readable.

Do not use:
- warehouse stock-photo clutter,
- gig-economy cartoon style,
- gaming visuals,
- fake shipment statistics,
- fake Host map coverage,
- fake customer logos,
- fake savings claims.

Every displayed metric in demo must be explicitly seeded demo data.

## 22. Codex behavior contract

- First inspect repo and docs. If no Avoylo repo exists, create a fresh local project/repo structure; do not modify Webcanbe product code.
- Before coding, write ARCHITECTURE.md, DOMAIN.md and the first migration.
- Work sequentially on one branch; do not spawn branch/PR sprawl.
- Keep commits small and phase-labeled.
- Never delete or weaken a failing test merely to get green.
- Never replace real security checks with client-side hiding.
- Never invent credentials, legal conclusions, coverage, rates or customer data.
- Never enable production payments/shipping/physical ops.
- When blocked by missing external credentials, finish the adapter with sandbox/mock + exact configuration checklist instead of stubbing business logic with hard-coded success.
- Every phase ends with: tests run, results, remaining risks, exact commit SHA.
- Maintain docs/current-handoff.md inside the Avoylo repo with live state so another agent can resume.
- Do not declare DONE until the entire Phase 0–8 sandbox E2E is green.

## 23. Final acceptance criteria for the Codex build

The software is acceptable for the next business-validation phase only when:
- all three roles can complete their sandbox flows,
- parcel custody can be reconstructed from append-only events,
- no double allocation is possible under concurrency,
- Host/recipient private data boundaries are tested,
- QR scans are idempotent and authorized,
- EasyPost TEST labels/tracking work or the provider adapter is fully testable with documented missing configuration,
- ledgers reconcile deterministically,
- admin exceptions are auditable,
- mobile Host workflow is usable at 390px width,
- build/typecheck/lint/unit/integration/E2E are green,
- all live operation flags remain false,
- there are no fake market claims or fake production success reports.

The build is an operational sandbox core, not permission to hold real customer inventory.


## 24. 2026-09-26 shipping-infrastructure findings and implementation corrections

The assistant independently rechecked a separate analysis supplied by the user. Several claims are useful, but they change the implementation plan only where the underlying official documentation supports them.

### USPS Connect Local: important but narrower than “pickup makes same-day trivial”
- USPS Connect Local is explicitly based on packages being entered close to final destination and advertises expected same-day / next-day delivery in participating areas.
- Current USPS Connect material states free pickup is available for next-day delivery; same-day requires the package to be handed off at the participating local USPS facility by the critical early-morning entry time. Do not describe residential pickup as a generic same-day path.
- Therefore the strong Avoylo use case is: local forward stock + next-day carrier pickup / handoff convenience, with same-day as a more operationally demanding path that may require Host drop-off to the designated USPS facility.
- Connect Local requires program terms and a USPS business relationship. Do not assume EasyPost's ordinary Wallet USPS account automatically exposes Connect Local.
Sources:
https://www.usps.com/business/connect/
https://qusps.usps.com/business/connect-local.htm

### Address/privacy issue that must be resolved before live USPS pickup
- USPS general small-business Package Pickup guidance says mail should have return information matching the pickup location.
- Older USPS Connect Local material says the program return address should be the Participant's place of business and need not be local.
- These statements are not enough to safely choose an Avoylo label/return-address policy for residential Hosts. Before live pickup, obtain current program-specific confirmation from USPS for the exact account/service configuration.
- Do not promise Host-address privacy on a carrier label until this is tested/confirmed. Keep Host address private in Avoylo UI regardless.
Sources:
https://faq.usps.com/articles/FAQ/What-are-the-Shipping-Options-for-Small-Business-Owners
https://www.usps.com/business/pdf/usps-connect-local-welcome-packet.pdf

### USPS Connect eCommerce: real possible later economics, NOT MVP revenue
- USPS Connect eCommerce officially offers discounted platform and merchant rates.
- EasyPost's current CeC Platform NSA documentation confirms a direct USPS relationship, separate Platform and Merchant Enterprise Payment Accounts, EFT enrollment, and defines the delta as Platform Commission.
- Therefore shipping spread/commission is a legitimate later business-model option if Avoylo is approved and contracted for CeC.
- Do not include it in initial unit economics, forecasts or seller pricing before actual approval/rate cards.
- Do not assume CeC terms/rates automatically apply to Connect Local.
Sources:
https://www.usps.com/business/connect/ecommerce.htm
https://support.easypost.com/hc/en-us/articles/45004353305101-USPS-Ship-Wallet-Carrier-Account-CeC-Platform-NSA

### EasyPost
Confirmed current published terms/features:
- Wallet Carrier plan: first 3,000 labels/month have no EasyPost label platform fee; postage still costs money.
- Pickup API supports multiple carriers including USPS/UPS/FedEx/OnTrac/Veho/Better Trucks.
- EasyPost ScanForm can group shipments from the same origin/carrier account into one scannable form.
Implementation changes:
- Add a DailyHandoffBatch / manifest concept after single-parcel handoff works.
- ScanForm requires same origin address and carrier account. Build this at Host-location granularity.
- Do not make ScanForm a prerequisite for the first shipment E2E.
Sources:
https://www.easypost.com/pricing/
https://docs.easypost.com/docs/pickups
https://docs.easypost.com/docs/scan-form

### Printerless Host
- USPS Label Broker can print a label for free at participating Post Offices, but the label is designed to be affixed at the Post Office; the Host cannot normally print it there and take it home for later pickup.
- USPS Label Delivery is currently $1.65/label but adds delivery delay and is incompatible with a normal fast-fulfillment loop.
Decision:
- Printerless USPS routes are backup/onboarding tools, not a primary Host tier.
- For an activated Host doing recurring outbound tasks, the operating model should assume access to a normal printer/thermal printer or another genuinely at-home label method.
Sources:
https://faq.usps.com/articles/Knowledge/Label-Broker
https://www.usps.com/ship/label-broker.htm
https://www.usps.com/ship/express-mail.htm

### Identity
- Stripe Identity currently lists government-ID + selfie verification at $1.50/completed verification with the first 50 verifications free.
- It is identity verification only, not a background check, property-right check, zoning check, insurance check or worker-classification determination.
Implementation:
- Create IdentityProvider abstraction and verification-status fields, but do not block early sandbox E2E on live Stripe.
- Use provider mock/sandbox until legal/account ownership is ready.
Source:
https://stripe.com/identity

### Transit insurance
- EasyPost currently publishes 1% of declared package value for shipping insurance and states coverage applies after the package enters the carrier network.
- The current public page reviewed does not support a blanket claim that this product has a $1 minimum; separate automatic insurance is advertised at $1/label for up to $100 coverage.
- Carrier-transit insurance is NOT storage/custody insurance.
Implementation:
- Keep transit insurance and storage/custody protection as separate concepts.
- Do not show Avoylo “protected” claims before storage/custody coverage exists.
Sources:
https://support.easypost.com/hc/en-us/articles/27844282936589-EasyPost-Shipping-Insurance
https://support.easypost.com/hc/en-us/articles/4422941088397-Automatic-Shipping-Insurance

### Routing / allocation
- Google Routes Compute Route Matrix Essentials currently has a 10,000 monthly free-usage cap.
- EasyPost SmartRate currently has a 500-call threshold, then $0.03/call, and is US-domestic only.
- Long-term routing should not equal nearest Host. Candidate score may combine actual postage + service/transit probability + Host handling fee + inventory scarcity + Host reliability + operational cutoff.
- Do NOT implement the full optimizer before real multi-Host data. Initial allocation must first be correct and deterministic; add cost/transit optimization only after actual rate inputs and service promises exist.
Sources:
https://developers.google.com/maps/billing-and-pricing/pricing
https://support.easypost.com/hc/en-us/articles/15433074900365-SmartRate-API-FAQs

### Shopify
- Shopify development stores support unlimited test orders/products and test payments.
- Shopify officially models third-party fulfillment services and callbacks/tracking/inventory.
Implementation:
- Preserve manual + CSV as the Phase-4 source of truth for core logistics tests.
- Add Shopify dev-store integration immediately after core order/allocation/shipping E2E is stable; it is a high-value seller integration and can be tested without live merchant transactions.
Sources:
https://shopify.dev/docs/apps/build/stores/development-stores
https://shopify.dev/docs/api/admin-graphql/unstable/queries/fulfillmentservice

### Physical pilot budget
Do NOT automatically spend the available ~$100/remaining founder budget on postage before the software and legal boundary tests pass.
Preferred order:
1. $0 software sandbox / provider test modes.
2. controlled shipments using only founder/test-owned low-value goods when a U.S. operational setup is available, to test physical state transitions without entrusting third-party inventory.
3. only after state/legal/insurance/account structure is ready: tiny merchant/Host pilot.

The value of a physical pilot is exception discovery, not proving demand from ten shipments.

## 25. Marketing landing import rule — Framer export

The founder intends to give Codex an exported Framer/Ability marketing-site file and use only its Home page for the first Avoylo release.

Rules:
- Preserve the Home page visually and textually as exported unless the founder separately authorizes changes.
- Remove the visible bottom-right “Made in Framer” badge/overlay from the exported implementation.
- Do not redesign, rewrite, restyle, reorder, simplify or “improve” the Home page as part of import.
- Only the Home page is publicly routed for now. Existing other template pages/components should not be published or linked, but should be preserved in source for possible later reuse rather than destructively deleted.
- Keep the landing code isolated from the operational Avoylo app so future Seller/Host/Admin expansion does not force a landing rewrite.
- Prepare invisible infrastructure for later expansion: central site/app URL config, route registry, root-only sitemap/robots, clean 404/home fallback, and deploy separation between marketing root domain and app subdomain.
- Remove or neutralize stale Framer-preview/template route references only when they would create broken public navigation; do not alter visible labels/design without explicit approval.
- Before/after visual regression should show no unintended change outside the removed Framer badge area and necessary routing behavior.
- Do not mix landing import work with Avoylo backend, auth, payments, shipping or dashboard implementation until the marketing import is clean and independently buildable.
NaN