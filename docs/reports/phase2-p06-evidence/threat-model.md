# P06 changed-boundary threat model

Assets: canonical imported bytes; accepted revision/history ancestry; project/session
membership; private host files and environment; trusted compiler/package graphs.
Attacker input: ZIP paths and contents, literal/config ASTs, HTML module URLs, aliases,
source import strings, Code operations and concurrent requests. Operator profile paths,
compiler code and durable history metadata are server-owned.

1. Root selection must come from static relationships. Safe normalized relative paths,
   canonical project identity, per-segment directory/link checks and a single HTML module
   prevent traversal, alias roots and ambiguous/dynamic root admission. Nested imports
   and CSS scanning remain tied to the selected source tree; no copied virtual src tree.
2. Root scope persists in the existing ledger. All filesystem operations validate its
   canonical directory; PG hashes the same source members and forbids directory changes.
   Snapshot materialization and export are disposable; PG keeps source/history authority.
   Legacy source scope/hash semantics remain unchanged. Draft names do not authorize writes.
3. Independent build input is the actual exported ZIP. Extraction is bounded and link-free.
   Static config is data; uploaded modules/plugins/scripts cannot enter Node execution.
   esbuild resolves only confined application files and selected operator dependencies.
   Rollup receives immutable JS strings and the finite revalidated plan through its
   fixed operator graph; its resolver cannot load an unlisted file or fall back to host
   packages. Client external declarations never grant preview execution or host access.
4. Export processing has two admission slots. Existing member/aggregate/count limits,
   15-second esbuild cancellation and eight-second bounded Rollup workers remain.
   Final source digests prove source preservation and finally cleanup removes checkouts.
5. Export success and failure diagnostics require fresh authority after validation.
   Local project locking and hosted snapshot/CAS/reauthorization retain their existing
   revocation, concurrency and source acceptance boundaries.

Review: source/config parsing and source-authority changes, generated URL-to-module
rebinding, the static compiler/worker boundary, direct authorization/export consumers,
and their adversarial tests. Unknown config effects refuse. No production infrastructure,
broad repository audit, sustained-load or P39/P61 claim is made.
