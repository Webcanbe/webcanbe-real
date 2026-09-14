# Trusted runtime profiles

Profiles are repository-owned, immutable dependency graphs. Prepare with `npm ci
--ignore-scripts`; never install an uploaded manifest or resolve through the editor's
node_modules. Existing profile locks are retained unchanged.

The common-application additions are `react18-vite6-common-v1` (React 18.3.1,
Vite 6.4.3, Tailwind 4.3.3, Lucide 0.469.0) and
`react19-vite7-common-v1` (React 19.2.4, Vite 7.3.1, Tailwind 4.1.18,
@tippyjs/react 4.2.6, Immer 11.1.3/use-immer 0.11.0). Use
`npm run runtime:prepare:common`. The latter graph retains every registry package
record from the frozen application's npm lock; the trusted profile root is separately
named and exactly pinned. This does not change the application's canonical manifest
or lock. A matching profile must cover the full declared dependency set. Admitted
client roots can import their verified browser dependency closure; tooling dependencies
are not automatically client imports. Uploaded npm lock entries must match profile
versions and integrity, including nested dependencies. Missing packages fail closed.

Supported lock formats remain one npm package-lock v2/v3, or no lock with an explicit
profile resolution notice. Yarn classic/Berry and Bun text/binary locks remain unsupported.
A bundled Yarn executable above the existing member bound remains refused. No uploaded
package-manager executable, plugin, lifecycle hook or Node configuration is run by the
editor. This is not a general package-manager implementation.

The static Vite subset additionally recognizes literal aliases using object or
find/replacement array forms, literal project-root `path.resolve('./src')` or
`path.resolve(__dirname, './src')`, and a no-argument arrow returning a literal config.
Imported `path`/`node:path` bindings are interpreted as data; the module is not executed.
Static `server`/`preview` open and port hints are preserved but not applied. Proxies,
computed/environment-dependent configuration and uploaded executable plugins still fail.

Tailwind 4 defaults and the admitted literal root `@theme` subset use the pinned
compiler. Literal numeric color functions are included; nested/dynamic directives,
Tailwind 3 configuration, PostCSS plugins and UnoCSS remain unsupported. CSS HTTP(S)
resource URLs and data image/font URLs are preserved by the HTTP compiler without a
compiler fetch. External fonts/images still fail under controlled runner egress denial;
preservation is not network availability or a complete rendering claim.

Additional text metadata has a separate 16 KiB, strict UTF-8 grammar: finite
EditorConfig fields, boolean strict-peer-dependencies/shell-emulator npmrc hints,
finite formatter settings/globs and narrowly validated example env placeholders or
loopback/reserved-domain URLs. These files are preserved, never applied. Credentials,
unknown npm controls, non-example env files, arbitrary dotfiles and binary locks remain
refused. All archive/path/link/ratio/member/total limits remain unchanged.
