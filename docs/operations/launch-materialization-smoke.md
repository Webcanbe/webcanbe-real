# Launch materialization smoke runbook

Status: **staged only — do not execute in production until Gate 2 authenticated provider smoke passes.**

## Purpose

This runbook creates one internal source-backed immutable release and one internal entitlement so the production materialization/editor pipeline can be exercised before commercial payments exist.

It deliberately does **not** create a `wcb_listings` row. Therefore the fixture is not returned by the public Marketplace catalog and is not customer-facing.

## Source

Fixture source:

`fixtures/studio-ledger`

Builder:

`scripts/launch/materialization-smoke-fixture.mjs`

Verification:

- fixture builder test
- production `verifyReleaseSnapshot()`
- Worker materialization regression
- durable save/reload/export regression

## Safety properties

The generated fixture:

- derives deterministic IDs from fixture version + target user + target workspace;
- computes the exact editable-source content hash expected by production;
- computes the immutable release snapshot hash from files + history;
- inserts only:
  - `wcb_catalog_projects`
  - `wcb_project_releases`
  - `wcb_license_entitlements`
- uses entitlement provider `launch-smoke`;
- creates no public Listing;
- is idempotent for one exact target/version;
- fails if an existing deterministic ID has conflicting provenance.

The release is immutable by production trigger. Treat it as retained internal launch evidence, not disposable customer content.

## Preconditions

Before generating/applying the fixture:

1. Gate 2 authenticated read smoke is green for the intended production account.
2. Product mutation remains closed in production.
3. Capture the authoritative internal user UUID and editable workspace UUID from server/DB state.
4. Do not paste DB credentials into chat or source control.
5. Use a current production DB backup/checkpoint before mutation activation.

## Generate summary

Set locally/operator-side:

```sh
export WCB_SMOKE_USER_ID='<internal user UUID>'
export WCB_SMOKE_WORKSPACE_ID='<editable workspace UUID>'
export WCB_SMOKE_FIXTURE_VERSION='v1'
npm run launch:smoke-fixture
```

The command prints only deterministic fixture identifiers/hashes/counts. It does not connect to PostgreSQL.

## Generate SQL

```sh
npm run launch:smoke-fixture -- --sql > /tmp/webcanbe-launch-smoke.sql
```

Inspect the SQL before applying it.

Do not commit the generated SQL if it contains account-specific identifiers.

## Apply

Apply the generated SQL only through the approved production operator/database channel after Gate 2 closes.

Immediately verify:

- one matching internal catalog project;
- one matching immutable published release;
- one active `launch-smoke` entitlement;
- zero Listing rows for the fixture;
- public `/browse` remains unchanged.

## Gate 3 activation

Only after the fixture is valid:

- deploy Worker `WEBCANBE_PRODUCT_MUTATIONS=enabled`;
- deploy frontend `wcb-product-mutation-mode=hosted`;
- use Purchases to create the working copy;
- verify retry/idempotency does not create a second copy.

## Required post-materialization E2E

`Purchases → Materialize → Workspace → Visual edit → Code edit → Save → Reload → same accepted revision → Export → fresh independent build`

Verify sign-out/sign-in reopen and direct workspace protection as part of the same gate.

## After smoke

The internal release may remain as immutable audit evidence because it has no public Listing.

After launch verification, transition or otherwise retire the `launch-smoke` entitlement using an approved operator procedure if the account should no longer retain it. Do not delete or rewrite the immutable release.
