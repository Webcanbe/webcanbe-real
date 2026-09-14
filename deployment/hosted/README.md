# Private hosted validation package (not launch-ready)

This package implements the same fixed Linux systemd/bubblewrap/Chromium boundary
as LocalLimaRunnerProvider behind a mutually authenticated TLS management gateway.
The ordinary browser receives only the existing raster viewer. The gateway is a
trusted control-plane process; no uploaded Node configuration or source runs there.

Run `node scripts/hosted/package.cjs` in this trusted repository. The ignored output
contains a bundled gateway, the packaged worker/refresh policy and retained launch/stop/probe files, schema,
example config and systemd unit. It contains no credential, source checkout or VM.
The Linux gateway/worker requires Node 20+; PostgreSQL 17+ is the database baseline.
The editor and local QA also use node:sqlite and were validated with Node 26.
Retain the repository lockfile for rebuilding.

On an already authorized dedicated Debian 13 Linux VM, provision signed distribution
packages `nodejs chromium bubblewrap systemd gcc sudo fonts-dejavu-core` and pinned
`playwright-core@1.63.0` in `/opt/wcb-runtime/node_modules`, with lifecycle scripts
disabled. Install the retained launch/stop policy and packaged worker/probe/refresh-policy tools root-owned in
`/opt/wcb-runtime`; launch/stop mode 0755, others 0644. Compile socket-probe.c there.
Create unprivileged users `wcb-runner` and `wcb-controller`. Install the bundled gateway
root-owned at `/opt/wcb-control/gateway.cjs`, outside the job runtime mount. Set a narrow
sudoers rule allowing only `/opt/wcb-runtime/launch.sh *` and `/opt/wcb-runtime/stop.sh *`
for wcb-controller; those root-owned scripts independently validate the UUID and mode.
Do not grant a shell, arbitrary executable, Docker socket, host source mount or agent.

Apply postgres.sql as a migration owner in a private database. The application/control
role needs table CRUD only; no superuser/role/extension/database creation privileges.
The role, database and TLS material must never be given to project code. Migration,
identity provisioning and grant writes are trusted operations, not public HTTP APIs.
Use verified database TLS and backup/PITR, retention and encryption policies. The bounded
source+ledger and artifact payloads are stored in PostgreSQL to avoid split object-store
commits. This intentionally conservative provider does not require an S3 architecture.

Provide real server/client certificates and a controller-only CA. Store private config
and keys outside source at `/etc/webcanbe` with restrictive permissions. Use
`gateway-config.example.json` as a shape only, replace every placeholder and omit
`localTest`. Never expose the management service to project networks or public browsers.
A private mTLS listener may bind a configured management interface; use host firewall
rules for only approved controllers. Configure a unique hostId on every gateway.
No account, key, certificate, DNS entry or infrastructure is created by packaging.

A hosted application must compose HostedLinuxRunnerProvider with PostgresLeaseStore, configured
hosts and a fresh server-owned owner authorization callback. Each gateway also checks
the same database fence around every operation. Database leases bind controller, epoch,
host, generation, owner, immutable input hash, capacity and deadline. A failed controller
expires; recovery increments the epoch, revokes the old job and only releases capacity
after verified stop. Uncertain cleanup remains quarantined. Lost handles are not evidence
of cleanup. Old generations are never reused. The remote client retains no project code
execution path and does not weaken the local provider.

**The complete hosted editor application is not yet composed.** Its existing synchronous
registry, session, source and artifact API needs migration to the asynchronous PostgreSQL
adapters and end-to-end identity-to-source-to-runner acceptance. Use the atomic
PostgresIdentityStore.issueVerifiedIdentity path for verified login issuance. Do not insert
async methods into synchronous interfaces or wrap the distributed provider with the
single-controller SQLite scheduler. A running gateway alone does not close this gate.

Run the existing runner verify.cjs positive/negative probes on *each actual host* after
kernel/browser/runtime changes. Then exercise OIDC sessions, PostgreSQL stores, the
provider and two genuine separate HTTPS editor/viewer cookie sites with at least two
accounts/projects/workspaces and competing controllers. Include network/RTC, process,
filesystem, resource exhaustion, node loss, delayed start/result/stop, revocation, stale
CAS, failed storage, cleanup and DNS/proxy/CDN/cookie probes. Local TLS and a Lima-hosted
gateway cannot satisfy deployed-hosted gates. A professional penetration test remains a
separate external service; an agent review does not claim that credential.

Current integration limits and evidence are authoritative in
`docs/reports/phase2g2-final-closure.md`. No public launch or default hosted mode is enabled.
