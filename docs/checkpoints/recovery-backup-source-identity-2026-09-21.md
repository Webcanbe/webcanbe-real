# Recovery backup source-identity checkpoint — 2026-09-21 KST

## Verified checkpoint

- Production/main remains `c0889c867170219545c7f05662e7f0c744a83362`.
- Production product mutation remains OFF.
- Active Gate 3 activation candidate remains `phase5-gate3-materialization-staging-v4`, draft PR #45, still ahead-only / 0 behind relative to main at the latest comparison.
- Gate 2 credential-free GitHub provider boundary is already PASS; Gate 2 overall still requires the user's authenticated same-account Google/GitHub/Email E2E.
- Gate 5 recovery branch: `phase5-recovery-restore-rehearsal`, draft PR #46.
- Source-identity implementation/test checkpoint: `599a51a9c0d1cbf9be67e8ce92e006e5f41f67ec`.
- Recovery verification run `35570337758`, job `106240454061`: **PASS**.
  - 5 recovery test files / 23 tests: PASS
  - recovery tooling syntax: PASS
  - secret scan: PASS

## Backup source binding added

New backups no longer consist only of a dump plus checksum. `db:backup` now:

1. probes the connected production PostgreSQL identity using `pg_control_system().system_identifier` plus `current_database()`;
2. creates the data-only `public.wcb_*` custom-format archive;
3. probes source identity again and refuses/deletes the archive if the connected source changed during backup;
4. computes the archive SHA-256;
5. writes the existing sibling `.sha256` file;
6. writes a sibling `.source.json` manifest containing only:
   - manifest format/version
   - PostgreSQL system identifier
   - database name
   - archive SHA-256
   - creation timestamp

The source manifest intentionally excludes host, username, password, connection URL and other credentials. Regression coverage proves credentials remain only in child-process environment variables and are absent from command-line arguments and the source manifest.

## Recovery guard strengthened

`db:restore:recovery` now validates the source manifest against the actual archive SHA-256 before any recovery-target mutation.

The recovery target must be distinct from:

- the PostgreSQL cluster/database identity recorded in the backup itself; and
- current live production identity when `WEBCANBE_DATABASE_URL` is available.

For a true production outage where the live source cannot be reached, recovery planning/restoration can rely on the recorded backup source identity only after an additional explicit operator confirmation:

`WEBCANBE_RESTORE_OFFLINE_SOURCE_CONFIRM=USE_BACKUP_SOURCE_IDENTITY`

This offline path still probes the recovery target and refuses it if it matches the recorded source identity.

## Safety evidence

- Different host/DNS text cannot bypass the connected PostgreSQL identity check.
- A recovery target matching the backup-recorded source identity is refused before target mutation.
- Malformed or failed PostgreSQL identity probes fail closed.
- Offline-source mode without the extra explicit confirmation is refused.
- Plan-only recovery remains non-mutating.
- Source-identity changes during backup cause the new archive to be deleted rather than retained unbound.
- No live production or recovery database was mutated by this checkpoint.
- No live Worker rollback occurred.
- No launch fixture/materialization switch/payment/seller payout authority was enabled.

## Known limitation / deferred write

A direct hardening write to `scripts/db/verify-backup.mjs` was blocked by the GitHub tool safety check and was not bypassed through another interface. The restore command independently validates the source manifest and archive digest, and the new source-manifest helper has direct regression coverage. Do not represent the standalone `db:backup:verify` command as enforcing the source manifest until that blocked change is legitimately completed.

## Next release-critical action

Authenticated Gate 2 is now the production activation blocker: run the user's real Google-backed account baseline, link GitHub and Email to that same internal Webcanbe account, verify logout, then prove GitHub and Email sign-in each return to the same account with private reads, refresh persistence and logout. Keep Gate 3 production mutation OFF until this passes.
