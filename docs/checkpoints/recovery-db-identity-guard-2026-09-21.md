# Recovery DB connected-identity guard checkpoint — 2026-09-21 KST

## Verified state

- Production/main: `c0889c867170219545c7f05662e7f0c744a83362`.
- Active Gate 3 candidate: `phase5-gate3-materialization-staging-v4` at `aa1cf8571ae6a95aff653d7385fdf883d9ea50e3`; exact comparison to main is ahead 24 / behind 0. PR #45 remains draft/staging-only.
- Gate 2 credential-free provider boundary remains closed. Gate 2 overall remains pending the human-authenticated same-account Google/GitHub/Email sequence.
- Production product mutation remains OFF.
- Recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Recovery implementation/test checkpoint: `3b708ba09931f4dde6cea07545074cf04b551ff6`.
- Recovery CI `35569282299`, job `106237292624`: **PASS**. Recovery regressions, recovery-tool syntax, and secret scan all passed.

## Change completed

`db:restore:recovery` no longer relies only on PostgreSQL URL host/port/database text before preparing the recovery target. After archive verification and before plan success or any target mutation, it performs read-only `psql` probes against both production and recovery connections using `pg_control_system().system_identifier` plus `current_database()`.

The restore fails closed before `TRUNCATE` when:

- distinct DNS/host strings lead to the same PostgreSQL cluster system identifier and database name;
- the identity probe fails;
- identity output is malformed;
- the connected database name does not match the configured database name; or
- `psql` is unavailable.

Database credentials remain in PostgreSQL environment variables rather than command-line arguments. The behavioral regression suite includes a fake-tool case where different production/recovery DNS aliases report the same connected PostgreSQL identity and verifies that the restore is refused without touching a live database. The non-mutating plan path also proves a distinct connected identity before reporting success.

No production or recovery database connection was made by CI, no `TRUNCATE` or restore was executed against a live database, no Worker rollback occurred, and no production mutation/payment/seller authority was enabled.

## Exact next independent action

Bind the backup artifact itself to the source PostgreSQL cluster/database identity: record a non-secret source identity manifest alongside the backup and checksum, verify that manifest during restore, and require the recovery target to differ from the recorded source identity. This removes the need to trust simultaneous production reachability as the only source-identity evidence and makes an off-site recovery drill safer and more reproducible.
