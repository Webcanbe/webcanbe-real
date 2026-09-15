# Trusted runtime profiles

Profiles are operator-owned immutable dependency graphs. Install only their committed
manifests/locks with `npm ci --ignore-scripts --prefix runtime-profiles/<profile>`.
Never install uploaded manifests, execute lifecycle hooks/package managers/configs,
or resolve missing packages from the editor's node_modules. Old profile locks remain
unchanged. Full graph admission verifies exact versions, registry integrity, required
and present optional dependency/peer edges; platform-excluded optional branches remain
explicit. A matching profile must cover every declared root, including tooling.
Tooling roots do not automatically become client imports.

Existing common profiles retain React18/Vite6/Lucide and React19/Vite7/Tippy/Immer.
This closure adds `react18-vite5-css-v1` (Tailwind3.4.17, PostCSS8.5.8,
autoprefixer10.4.21, typography0.5.16, tailwindcss-animate1.0.7) and
`react19-vite6-uno-v1` (UnoCSS66.0.0); both pin vite-tsconfig-paths5.1.4.
The edge closure also adds `react19-vite6-uno65-v1` (UnoCSS65.5.0,
forms1.0.0 and MagicString0.30.21). Forms1 requires Uno65 peers; it is not
overridden into the Uno66 graph. Their complete committed locks are authoritative.
Prepare profiles individually:

```sh
npm ci --ignore-scripts --prefix runtime-profiles/react18-vite5-css-v1
npm ci --ignore-scripts --prefix runtime-profiles/react19-vite6-uno-v1
npm ci --ignore-scripts --prefix runtime-profiles/react19-vite6-uno65-v1
```

## Deterministic package data

One npm package-lock v2/v3, Yarn classic v1 registry/SRI lock, or Bun text JSONC v1
lock may be resolved against a complete trusted graph. Exact npm protocol descriptors
and scoped npm aliases distinguish requested name from real package identity and
retain complete dependency/peer checks. Berry checksums/virtual packages, remaining
non-npm protocols, multiple competing locks, binary Bun resolution and unsupported
workspace semantics fail closed. No-lock projects receive an explicit
profile-resolution notice. Bun binary v2 magic is admitted only as bounded opaque
source/export bytes; it never authorizes dependency resolution or execution.
A bundled Yarn executable above the retained 2 MiB member limit is still refused.
No artifact is silently dropped, no security bound is raised, and this is not a
generic Yarn/Bun implementation.

## Finite configuration and HTML

The static Vite grammar handles literal object/array aliases, finite nested const
objects, `path.resolve`, `new URL(..., import.meta.url)` aliases, a same-directory
TS extends relationship, confined literal root/publicDir/base, and known no-argument
React/Tailwind4/vite-tsconfig-paths/UnoCSS plugin declarations. tsconfig paths are
applied only with the recognized plugin and remain confined. Literal test/optimizer
metadata and local server/preview port/open hints are preserved but not applied.
A non-root Vite root derives HTML/public/entry paths within the project; entries still
require canonical top-level src. Separate client/src layouts remain unsupported.
Literal Rollup external fs/promises and output experimentalMinChunkSize are independent
production-build effects, without preview chunk semantics. A pinned isolated Rollup
helper accepts an immutable resolved JS graph; full canonical app export composition
is not yet integrated. Arbitrary build effects, proxies, dynamic config and unknown
uploaded plugins remain unsupported; source configuration is never executed.

A finite index.html shell preserves alternate identified div/main mounts, title,
metadata/body attributes, one local src module entry, local styles and static resources.
Extra/inline/remote scripts, event attributes, foreign markup, active embeds, srcset,
inline styles, URL whitespace/controls and ambiguous HTML refuse safely. Preconnect
and DNS-prefetch declarations remain canonical source but are omitted from the
isolated preview. Only the intended application entry executes in the runner.

## CSS adapters

Tailwind4 retains its pinned compiler and existing literal CSS-first theme subset.
Tailwind3 uses finite content/theme/screens/extend/container/dark/prefix/safelist data;
trusted typography/animate adapters and defaultTheme sans arrays are supported.
PostCSS recognizes only pinned Tailwind/autoprefixer transformations and bounded literal
Browserslist queries. UnoCSS supports presetUno/presetAttributify, finite static rules,
shortcuts/theme/safelist, literal presetUno dark class/media, pinned forms1 on Uno65,
and operator directives/variant-group transformers on Uno65/66. Transformations apply
to immutable derived JS/TS/HTML/CSS while canonical source/export bytes remain exact.
Arbitrary functions, regex rules, custom presets/plugins/transformers, unknown options
and executable config are unsupported. Source snapshots and outputs are bounded;
content fingerprints refresh incremental compiler contexts after edits.

Uploaded JS/TS configuration is parsed as data, never imported. Finite CSS compilation
runs in a fixed operator worker, with 128 MiB old-generation/16 MiB young-generation
heap, 8-second deadline, two-worker capacity, empty environment and dedicated module
resolution hooks. The validated editor runtime is Node26; `node:module.registerHooks`
is required and unavailable confinement fails closed. Finite toolchains are not
preloaded in the editor process. No host dependency substitution is allowed.

## Public values and inert files

Only server-owned project/workspace-scoped VITE values are supplied through
PublicRuntimeValueProvider. The packaged editor optionally reads `publicRuntimeValues`
from its private operator config. Values are copied/validated, read under fresh
session/revision authority, and never written into source. Private environment is never
inherited. Secret-name/token/credential-shaped values are rejected. Accepted values are
finite public labels, flags/numbers and credential-free public HTTPS URLs without
query/fragment. Example env is metadata only and is never automatically injected.
Provider replacement/revocation is checked before and after asynchronous reads; the
static config provider requires controlled restart to change values.

Narrow grammars preserve .node-version, .nvmrc, .whitesource, _redirects, .hbs and
recognized bounded opaque Bun binary locks. Existing EditorConfig/npmrc/formatter/
example-env policies retain 16 KiB strict text limits and secret detection. No blanket
dotfile or binary acceptance exists. Archive path/type/link/encryption/decompression,
2 MiB member and total/ratio bounds remain unchanged.

## Separate static asset cache

`publicStaticAssets:true` enables an operator-side materializer for compiled snapshots.
It exposes no URL-fetch endpoint. Default runner egress remains denied. The service
accepts public credential-free HTTPS GET, checks and pins all DNS answers, revalidates
every redirect, blocks private/loopback/link-local/metadata/reserved destinations,
and forwards no cookies, auth, proxy or caller headers. IPv6/HTTP/custom ports are
outside the admitted subset. Response compression is refused.

Limits: 2 MiB response, 8 MiB aggregate, 48 resources, 3 redirects, import depth4,
10-second deadline and four concurrent transfers/materializations. Only validated
raster image/font signatures and finite CSS are cached; remote SVG/HTML/JavaScript
are refused. A fixed modern user agent requests browser-compatible WOFF2 where served.
Cache paths are content-addressed and snapshot-scoped, with source/project/revision
checks around async work and an immutable hashed audit artifact. No cross-tenant or
persistent URL cache is implied. Compiler-generated Fast Refresh module code is
rewritten consistently in initial bootstrap and update manifest; user JSON is not
interpreted as a refresh manifest. Source/export bytes stay unchanged.

Static CSS/HTML references and finite image/font URL string literals are covered.
Dynamic URLs, API calls, remote scripts and authenticated resources stay unsupported.
Cached asset changes may select the existing honest rebuild/reload path. Unknown
behavior is never silently labeled applied.

Compatibility labels: fully supported means the complete admitted graph/configuration
passes inspection; partial means only the stated subset is implemented; preserved but
not applied means inert metadata is exported without changing preview semantics;
unsupported behavior stays Code-only with a diagnostic. Detailed current P05–P08
statuses and unchanged real-app evidence are in
[the edge closure report](../docs/reports/phase2-compatibility-edge-closure.md).
