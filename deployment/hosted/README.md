# Private hosted validation package (not launch-ready)

This package implements the same fixed Linux systemd/bubblewrap/Chromium boundary
as LocalLimaRunnerProvider behind a mutually authenticated TLS management gateway.
The ordinary browser receives only the existing raster viewer. The gateway is a
trusted control-plane process; no uploaded Node configuration or source runs there.

Run `node scripts/hosted/package.cjs` in this trusted repository. The ignored output
contains a bundled editor CLI and gateway, the packaged worker/refresh policy and retained launch/stop/probe files, schema,
example config and systemd unit. It contains no credential, source checkout or VM.
The Linux gateway/worker requires Node 20+; PostgreSQL 17+ is the database baseline.
The editor dependency graph and local QA also import node:sqlite and were validated with Node 26; hosted requests do not construct a SQLite store or scheduler.
Retain the repository lockfile for rebuilding.

On an already authorized dedicated Debian 13 Linux VM, provision signed distribution
packages `nodejs chromium bubblewrap systemd gcc sudo fonts-dejavu-core` and `fonts-noto-color-emoji=2.051-0+deb13u1` and `fonts-noto-cjk=1:20240730+repack1-1` (Debian 13) and pinned
`playwright-core@1.63.0` in `/opt/wcb-runtime/node_modules`, with lifecycle scripts
disabled. Install the retained launch/stop policy and every packaged worker/probe/refresh-policy/raster/typecheck helper root-owned in
`/opt/wcb-runtime`; launch/stop mode 0755, others 0644. This includes `raster-capture.cjs`, `typecheck.cjs`, `typecheck-worker.cjs`, pinned `typescript.cjs` (5.9.3), and the complete `typecheck-lib/` directory. Compile socket-probe.c there.
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

## Explicit asynchronous editor composition

`HostedEditor` now composes the real PostgreSQL identity/session, membership,
source/history, personal draft, immutable artifact and lease stores directly with
`HostedLinuxRunnerProvider`. Every asynchronous authority result is awaited.
PostgreSQL owns accepted source and history in one transaction. Private per-operation
checkouts and per-generation compiler directories are disposable materializations;
compiler directories are repopulated from PostgreSQL on every use and never written
back. Local developer mode is separate and explicit; it retains local file history.

The exact packaged `editor.cjs` is exercised by the local signed-OIDC/HTTPS/PG/mTLS
two-user acceptance suite, including Code/Canvas/history/export, restart, failure,
revocation, fencing, quarantine and controlled React 18/19 Fast Refresh. This proves
internal composition on local TEST infrastructure. It does not prove public hosting.

Use `editor-config.example.json` only as a shape. Copy the trusted application tree,
`dist`, the repository's pinned `node_modules`, `src/webcanbe-engine/runtime/previewBridge.ts`
and installed dedicated `runtime-profiles` under `applicationRoot`. The editor bundle
keeps package imports external and must resolve that same pinned repository dependency
tree; packaging does not install dependencies or create a standalone container.
Keep it under the application tree, for example `applicationRoot/.webcanbe/hosted-package`,
or arrange equivalent trusted Node resolution. Run Node 26 with
`node /opt/webcanbe-editor/.webcanbe/hosted-package/editor.cjs /etc/webcanbe/editor.json`.
Apply the schema and provision issuer/subject identities and memberships through trusted
operator code before accepting users. No public registration or grant-write endpoint exists.

The TLS listener dispatches exact editor/viewer Host values to separate configured sites;
only built platform assets are served on the editor site. Preserve the real TLS socket
and exact Host/Origin through any deployment; plaintext proxy termination is not an
implemented trust mode. Keep private config/PEM files mode 0600 outside source. The JSON
example's origin, callback, site and certificate values must match actual deployment.
An explicitly enabled `localTest:true` bypasses database TLS for QA and requires a
loopback listener; omit it in deployed operation. No runtime platform secret is delivered
to imported project code. The five-second controller recovery loop reclaims expired
orphans even without new editor requests; uncertain cleanup continues consuming capacity.

Controlled refresh is opt-in via `fastRefresh:true`. Existing component-only modules
with unchanged graphs can retain React state. Plain CSS uses CSS hot update, entry or
unsupported module changes use incremental rebuild/document reload, and structural
changes restart the generation. Reload is never labeled HMR.

Run the existing runner verify.cjs positive/negative probes on *each actual host* after
kernel/browser/runtime changes. Then exercise OIDC sessions, PostgreSQL stores, the
provider and two genuine separate HTTPS editor/viewer cookie sites with at least two
accounts/projects/workspaces and competing controllers. Include network/RTC, process,
filesystem, resource exhaustion, node loss, delayed start/result/stop, revocation, stale
CAS, failed storage, cleanup and DNS/proxy/CDN/cookie probes. Local TLS and a Lima-hosted
gateway cannot satisfy deployed-hosted gates. A professional penetration test remains a
separate external service; an agent review does not claim that credential.

Current integration limits and evidence are authoritative in
`docs/reports/phase2-common-applications.md` (the prior async composition closure is
retained as historical evidence). No public launch or default hosted mode is enabled.
