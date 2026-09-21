# Payments integration contract

Payment implementation owner: `codex/wcb-0922-payments`.

Integrator-owned changes are intentionally not made on the payment branch. Apply this contract on `codex/wcb-0922-integrator`, then run the payment tests and existing Worker suites.

## Worker routes

Import `PayPalProvider`, `PostgresPaymentRepository`, `handlePrivatePaymentRequest`, `handlePayPalWebhook`, and `publicPaymentConfiguration` from `worker/payments/*`.

- Public `GET /__webcanbe/api/payments/config`: return `publicPaymentConfiguration()`. This is the authoritative UI plan/price/grant source.
- Public `POST /__webcanbe/api/payments/webhooks/paypal`: construct the repository/provider inside `withHyperdrive` and call `handlePayPalWebhook`. Do not apply same-origin or session/CSRF checks to PayPal webhooks. Verification happens before event persistence or processing.
- Private, same-origin, database-session and CSRF protected:
  - `POST /__webcanbe/api/payments/orders/create`
  - `POST /__webcanbe/api/payments/orders/capture`
  - `POST /__webcanbe/api/payments/subscriptions/create`
  - `POST /__webcanbe/api/payments/subscriptions/cancel`
  - `POST /__webcanbe/api/payments/ai-packs/create`
  - `POST /__webcanbe/api/payments/ai-packs/capture`
- Refund, dispute reconciliation, payout build, and payout reconciliation must remain product-operator/Bigperson operations. Wire the exported domain functions through the existing step-up/audit boundary; do not expose them as ordinary user routes.

Exact PayPal dashboard callback URL:

`https://webcanbe.com/__webcanbe/api/payments/webhooks/paypal`

Required events are exported as `PAYPAL_WEBHOOK_EVENTS` in `worker/payments/contracts.js`. Configure that exact set once; do not use an unverified redirect as payment authority.

## Server-only configuration

Secrets must be Worker secrets, never `VITE_*` variables:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENVIRONMENT=sandbox` for launch verification; set `live` only during separately authorized production activation
- `PAYPAL_PLAN_PRO_MONTHLY`
- `PAYPAL_PLAN_PRO_ANNUAL`
- `PAYPAL_PLAN_STUDIO_MONTHLY`
- `PAYPAL_PLAN_STUDIO_ANNUAL`
- `WEBCANBE_PAID_MARKET_LAUNCH_AT` as an ISO timestamp

## PostgreSQL migration

Create the migration with the repository's Supabase migration command, then use this SQL body. These tables remain server-only under the current authority model. Do not grant them to `anon`, `authenticated`, or `PUBLIC`.

```sql
ALTER TABLE public.wcb_listings ADD COLUMN IF NOT EXISTS price_minor bigint NOT NULL DEFAULT 0 CHECK(price_minor=0 OR price_minor>=900);
ALTER TABLE public.wcb_listings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD');

CREATE TABLE IF NOT EXISTS public.wcb_creator_terms (
  seller_user_id uuid PRIMARY KEY,
  founding boolean NOT NULL DEFAULT false,
  first_paid_listing_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.wcb_orders (
  order_id uuid PRIMARY KEY,
  buyer_user_id uuid NOT NULL,
  seller_user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.wcb_listings(listing_id),
  release_id uuid NOT NULL REFERENCES public.wcb_project_releases(release_id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  gross_minor bigint NOT NULL CHECK(gross_minor>=0),
  platform_fee_minor bigint NOT NULL CHECK(platform_fee_minor>=0),
  creator_earning_minor bigint NOT NULL CHECK(creator_earning_minor>=0),
  fee_rate_basis_points integer NOT NULL CHECK(fee_rate_basis_points BETWEEN 0 AND 10000),
  currency text NOT NULL CHECK(currency='USD'),
  provider text NOT NULL CHECK(provider IN ('paypal','webcanbe-free')),
  provider_request_id text NOT NULL UNIQUE,
  provider_order_id text UNIQUE,
  provider_capture_id text UNIQUE,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  status text NOT NULL CHECK(status IN ('creating','approval_pending','processing','completed','partially_refunded','refunded','disputed','reconciliation_required','cancelled')),
  approval_url text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  refunded_at timestamptz,
  UNIQUE(buyer_user_id,idempotency_key),
  CHECK(gross_minor=platform_fee_minor+creator_earning_minor)
);
CREATE INDEX IF NOT EXISTS wcb_orders_buyer_created_idx ON public.wcb_orders(buyer_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wcb_orders_seller_created_idx ON public.wcb_orders(seller_user_id,created_at DESC);

ALTER TABLE public.wcb_license_entitlements ADD COLUMN IF NOT EXISTS order_id uuid UNIQUE REFERENCES public.wcb_orders(order_id);
ALTER TABLE public.wcb_license_entitlements ADD COLUMN IF NOT EXISTS revocation_reason text CHECK(revocation_reason IN ('refund','dispute'));

CREATE TABLE IF NOT EXISTS public.wcb_payment_identities (
  provider text NOT NULL,
  kind text NOT NULL,
  provider_id text NOT NULL,
  order_id uuid REFERENCES public.wcb_orders(order_id),
  subscription_id uuid,
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(provider,kind,provider_id)
);

CREATE TABLE IF NOT EXISTS public.wcb_provider_events (
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  status text NOT NULL CHECK(status IN ('received','processed','failed')),
  last_error text,
  received_at timestamptz NOT NULL,
  processed_at timestamptz,
  PRIMARY KEY(provider,provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.wcb_subscriptions (
  subscription_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_key text NOT NULL CHECK(plan_key IN ('pro_monthly','pro_annual','studio_monthly','studio_annual')),
  provider text NOT NULL CHECK(provider='paypal'),
  provider_plan_id text NOT NULL,
  provider_subscription_id text UNIQUE,
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  status text NOT NULL CHECK(status IN ('creating','approval_pending','active','past_due','cancelled','expired','reconciliation_required')),
  approval_url text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  active_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  failed_at timestamptz,
  last_provider_event_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);
ALTER TABLE public.wcb_payment_identities ADD CONSTRAINT wcb_payment_identities_subscription_fk FOREIGN KEY(subscription_id) REFERENCES public.wcb_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS wcb_subscriptions_user_status_idx ON public.wcb_subscriptions(user_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS wcb_subscriptions_one_current_per_user ON public.wcb_subscriptions(user_id) WHERE status IN ('creating','approval_pending','active','past_due','cancelled');

CREATE TABLE IF NOT EXISTS public.wcb_subscription_payments (
  subscription_id uuid NOT NULL REFERENCES public.wcb_subscriptions(subscription_id),
  provider_payment_id text PRIMARY KEY,
  gross_minor bigint NOT NULL CHECK(gross_minor>0),
  currency text NOT NULL CHECK(currency='USD'),
  occurred_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wcb_ai_pack_orders (
  ai_pack_order_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_key text NOT NULL CHECK(pack_key IN ('actions_100','actions_500','actions_1500')),
  actions integer NOT NULL CHECK(actions IN (100,500,1500)),
  gross_minor bigint NOT NULL CHECK(gross_minor IN (500,1500,3500)),
  currency text NOT NULL CHECK(currency='USD'),
  provider text NOT NULL CHECK(provider='paypal'),
  provider_request_id text NOT NULL UNIQUE,
  provider_order_id text UNIQUE,
  provider_capture_id text UNIQUE,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK(status IN ('creating','approval_pending','completed','reconciliation_required','refunded')),
  approval_url text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.wcb_ai_purchased_credits (
  credit_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  ai_pack_order_id uuid NOT NULL UNIQUE REFERENCES public.wcb_ai_pack_orders(ai_pack_order_id),
  purchased_actions integer NOT NULL CHECK(purchased_actions>0),
  provider_reference text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS wcb_ai_purchased_credits_user_idx ON public.wcb_ai_purchased_credits(user_id,created_at);

CREATE TABLE IF NOT EXISTS public.wcb_ai_included_grants (
  grant_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.wcb_subscriptions(subscription_id),
  grant_month text NOT NULL CHECK(grant_month ~ '^[0-9]{4}-[0-9]{2}$'),
  included_actions integer NOT NULL CHECK(included_actions>0),
  expires_at timestamptz NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  UNIQUE(subscription_id,grant_month)
);
CREATE INDEX IF NOT EXISTS wcb_ai_grants_user_month_idx ON public.wcb_ai_included_grants(user_id,grant_month);

CREATE TABLE IF NOT EXISTS public.wcb_refunds (
  refund_id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.wcb_orders(order_id),
  provider_refund_id text NOT NULL UNIQUE,
  refund_minor bigint NOT NULL CHECK(refund_minor>0),
  currency text NOT NULL CHECK(currency='USD'),
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status='completed'),
  occurred_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS wcb_refunds_order_idx ON public.wcb_refunds(order_id);

CREATE TABLE IF NOT EXISTS public.wcb_payout_batches (
  batch_id uuid PRIMARY KEY,
  batch_key text NOT NULL UNIQUE,
  scheduled_for date NOT NULL,
  status text NOT NULL CHECK(status IN ('pending_manual_execution','paid')),
  members jsonb NOT NULL CHECK(jsonb_typeof(members)='array'),
  provider_reference text UNIQUE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.wcb_creator_ledger (
  entry_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.wcb_orders(order_id),
  seller_user_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('sale','refund','dispute','adjustment')),
  gross_minor bigint NOT NULL,
  platform_fee_minor bigint NOT NULL,
  creator_amount_minor bigint NOT NULL,
  currency text NOT NULL CHECK(currency='USD'),
  provider text NOT NULL,
  provider_reference text NOT NULL,
  hold_until timestamptz NOT NULL,
  state text NOT NULL CHECK(state IN ('held','available','paid')),
  payout_batch_id uuid REFERENCES public.wcb_payout_batches(batch_id),
  occurred_at timestamptz NOT NULL,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS wcb_creator_ledger_available_idx ON public.wcb_creator_ledger(seller_user_id,hold_until) WHERE payout_batch_id IS NULL;

CREATE TABLE IF NOT EXISTS public.wcb_payment_reconciliation (
  item_id uuid PRIMARY KEY,
  kind text NOT NULL,
  provider_id text NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  status text NOT NULL CHECK(status IN ('pending','resolved')),
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  UNIQUE(kind,provider_id)
);

REVOKE ALL ON public.wcb_creator_terms, public.wcb_orders, public.wcb_payment_identities,
  public.wcb_provider_events, public.wcb_subscriptions, public.wcb_subscription_payments,
  public.wcb_ai_pack_orders, public.wcb_ai_purchased_credits, public.wcb_ai_included_grants, public.wcb_refunds, public.wcb_payout_batches,
  public.wcb_creator_ledger, public.wcb_payment_reconciliation FROM PUBLIC, anon, authenticated;
```

## AI contract

The AI workstream reads grants; it does not mutate payment state.

- Included balance: sum unexpired `wcb_ai_included_grants` for the user minus AI-owned usage. Annual plans get a new row every calendar month, never one annual grant.
- Purchased balance: a separate AI-owned durable balance sourced from verified completed pack orders. It never expires.
- Standard edit costs 1 Action; deep edit costs 3 Actions.
- Consumption order and overdraft behavior belong to the AI implementation, but it must never merge included and purchased source rows.

## Reconciliation invariants

- Provider event identity is `(provider, provider_event_id)`.
- Provider payment identity is `(provider, kind, provider_id)`.
- Browser redirect is display/navigation only. Capture response or verified webhook is authoritative.
- PayPal IDs are never Webcanbe order/subscription/entitlement IDs.
- Platform subscription and AI-pack revenue never creates a `wcb_creator_ledger` entry.
- Admin approval cannot set a payout to `paid`; actual external provider reference plus confirmed paid timestamp are required.
