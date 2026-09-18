# Threat model — Phase-2 final changed surfaces

The reviewed boundary treats imported archives, manifests, lockfiles, source,
configuration syntax, browser requests, and runner results as untrusted. Account,
workspace, project, preview, generation, and revision identifiers are references;
server-side grants, membership, ownership tuples, live leases, fences, and source
transactions remain authority.

The principal abuse cases are cross-tenant reference forgery; stale or stolen
capabilities; stale worker/result replay; dependency identity or peer substitution;
uploaded package/config/plugin/lifecycle execution; host dependency fallback;
path, archive, or symlink escape; external runner egress; source/export mutation;
secret or internal-path disclosure; and weakened limits used to manufacture a pass.

The changed code continues to use only operator-owned profile modules and immutable
module graphs. No changed surface grants membership, ownership, capacity, lease,
generation, revision, network, filesystem, or secret authority.
