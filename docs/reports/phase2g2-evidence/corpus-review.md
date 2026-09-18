# Independent unchanged-project compatibility review

**Full-project compatibility gate: NOT YET.** Four candidates were selected before the attempts, all four remain recorded, three fail intake and one passes intake but fails runtime, Code-save and export admission. No candidate rendered. No visual, responsive-editing, HMR, accepted-history, export-build or export-render PASS is inferred from source parsing. These are local real API/compiler observations, not hosted validation.

This review was performed by a separate compatibility-review agent working independently of the runtime implementation. It is an agent review, not a professional external certification. The exact machine-readable evidence is [corpus-results.json](corpus-results.json); [corpus-starting-adapters.json](corpus-starting-adapters.json) retains a controlled comparison with the original intake/profile modules. Both include module hashes, pinned provenance, file hashes, manifests, configuration filenames, exact runtime issues and per-stage results.

## Selection and provenance

| Project | Pinned upstream commit | License | Scope / intended profile |
| --- | --- | --- | --- |
| [Redux Essentials application](https://github.com/reduxjs/redux-essentials-example-app/tree/b4414e1504c914ece3253dd8a21adfb2278464d9) | `b4414e1504c914ece3253dd8a21adfb2278464d9` | No LICENSE found at this commit; no license is assumed and no source is redistributed | Complete tutorial application; React 18, Vite 5, React Router 6 BrowserRouter, Redux/RTK, MSW service worker, Yarn 4 |
| [Bulletproof React Vite application](https://github.com/alan2207/bulletproof-react/tree/9506629ed003a561c6627735480cce4994244bb4/apps/react-vite) | `9506629ed003a561c6627735480cce4994244bb4` | MIT, repository-root LICENSE | `apps/react-vite`; React 18, Vite 5, React Router 7 data router, Tailwind 3/PostCSS, React Query/Radix/forms, Yarn |
| [Todo List React](https://github.com/tuanductran/todo-list-react/tree/f48aef130c31452341450adfb6c3fc2234b79389) | `f48aef130c31452341450adfb6c3fc2234b79389` | MIT | Complete task application; React 19, Vite 6, UnoCSS, SWR/forms/Zod, Bun 1.1.42; no declared React Router |
| [Zustand interactive demo](https://github.com/pmndrs/zustand/tree/b57db4f86ef179285da216eeb291266da82c361c/examples/demo) | `b57db4f86ef179285da216eeb291266da82c361c` | MIT, repository-root LICENSE | `examples/demo`; React 18, Vite 4, React SWC plugin, Three.js/Fiber/Drei/postprocessing, Zustand 4; no declared router |

The independently authored interactive demo is distinguished from the two complete MIT applications and the public tutorial application with undetermined license. None is an authored WebCanBe fixture or an official Vite starter. The larger applications exercise meaningful dependencies and configuration; the failing candidates were not replaced with easier examples.

Archives use `git archive` at the pinned project tree with a fixed commit timestamp. Every archived file has a byte count and SHA-256 receipt, with root-license hashes where available. Configurations, dependencies and lifecycle scripts are inspected as data. No upstream install, build, generator, configuration module, server hook or lifecycle script executes on the host. No third-party source is committed. For monorepos, the selected application directory is archived unchanged; the root license is recorded separately instead of inserting or changing an application file. Those app exports may still depend on repository context; no standalone-build claim is made.

## Actual stage matrix

| Project | Import | Runtime / visual | Code editing | Responsive | History / restart | Export exactness / build / render |
| --- | --- | --- | --- | --- | --- | --- |
| Redux Essentials | **FAIL**, HTTP 400: archive limit | BLOCKED by intake; unchanged-source compiler also refuses profile | BLOCKED by intake | BLOCKED | BLOCKED | BLOCKED |
| Bulletproof React | **FAIL**, HTTP 400: secret/path exclusion | BLOCKED by intake; unchanged-source compiler also refuses profile | BLOCKED by intake | BLOCKED | BLOCKED | BLOCKED |
| Todo List React | **FAIL**, HTTP 400: unsupported file type | BLOCKED by intake; unchanged-source compiler also refuses profile | BLOCKED by intake | BLOCKED | BLOCKED | BLOCKED |
| Zustand demo | **PASS**, HTTP 201 | Actual preview API **FAIL**, HTTP 422; no render | **PARTIAL**: files read HTTP 200; valid draft save HTTP 422; rejected draft preserves every source byte and revision | BLOCKED by runtime | **PARTIAL**: initial source/revision survive an actual server close and fresh registry/server; no edited history accepted | Actual export API HTTP 422; exactness, isolated build and render BLOCKED |

Read-only inspection continues after rejected intake using byte-identical source in a separate private directory. It calls the actual static runtime inspector, compiler and React source adapter; it cannot create a project capability, admit a runner or turn a rejected project into a functional PASS. The admitted Zustand project uses actual local HTTP import/session/files/preview/Code/history/export endpoints with fresh private local operator credentials. Its Code probe adds a comment to a draft, then verifies the rejected draft has not changed canonical files or revision. No upstream source is rewritten to make compatibility pass.

The final compiler issue counts are Redux 14, Bulletproof 90, Todo 27 and Zustand 23. Full messages, package ranges, selected versions and required capabilities remain in the JSON. Counts are diagnostics, not a compatibility score.

## Exact failures and recommendations

1. **Redux intake:** `.yarn/releases/yarn-4.2.2.cjs` is 2,742,928 bytes, exceeding the unchanged 2 MiB single-file boundary. Raising that boundary simply for this candidate would not solve the Yarn lock, dependency, MSW and configuration gaps. Runtime rejects Yarn, unprovided Redux/MSW/Faker/date-fns/toast packages, Router 6 against the Router 7 pin, and its `path`/alias configuration. Preview service-worker behavior would require separate isolated validation even after compilation support.
2. **Bulletproof intake:** `.env.example-e2e` hits the existing secret/path exclusion. Further unsupported file formats include `.prettierignore`, `.prettierrc`, generator `.hbs` templates and `public/_redirects`. Safe inert metadata alone would not admit it. Runtime additionally rejects Yarn, many missing client/development dependencies, Tailwind 3/PostCSS configuration, Vite TS-path plugin, HTML entry behavior and static public environment references. The executable mock server, Husky and other scripts remain unexecuted.
3. **Todo intake:** `.editorconfig` is the first unsupported member; `.node-version`, `.npmrc`, `.whitesource` and `bun.lockb` also fall outside current intake. `.npmrc` can contain credentials, and binary lock support requires bounded decoding; neither should be generally admitted just to clear this case. Runtime rejects the Bun lock, missing packages, UnoCSS/plugin configuration, HTML entry behavior, alias and environment settings. Its `preinstall` command is observed, never executed.
4. **Zustand runtime:** there is no admitted React 18/Vite 4/SWC/Three.js/Zustand 4 profile. A Vite 6 fallback is a rejected diagnostic candidate, not a substituted runtime. Development-tool versions and many client dependencies are missing. No Three.js/WebGL compatibility is inferred before actual isolated compilation/rendering. This project reveals that source reading is available when preview is unsupported, but Code acceptance and export both remain blocked by the compile/validation policy.

Two safe gaps identified by this independent review were addressed by the parent implementation: `.mts`/`.cts` intake now matches the configuration parser's documented static filenames, and profile diagnostics choose by declared React/ReactDOM/Vite core requirements before reporting other unsupported packages. No package admission or version check is relaxed. The controlled starting-module comparison shows Redux moving from 19 to 14 issues and Bulletproof from 96 to 90, with both correctly reported against `react18-vite5-v1`. Intake/runtime outcomes remain failing; no pass was manufactured. The baseline comparison overrides only those two modules from `cac7b3abe33a26dcb4f5110b67a8433840960b95` in the temporary trusted harness bundle, keeping the rest of the current implementation and recording all module hashes. It is not presented as a full historical checkout test.

Further high-value work is still implementation work: deterministic Yarn/Bun lock handling; graph-aware distinction between inert development tooling and actual client/config execution; separately pinned common React Router/Redux/form/data/UI packages; confined static `path.resolve(__dirname, './src')`/TS path interpretation; approved Tailwind 3/PostCSS or UnoCSS profiles; and explicit static public environment grants. Arbitrary uploaded Node/config execution is not an acceptable shortcut. These changes require their own isolation, compatibility and unchanged-project tests.

Static source analysis found candidates without exceptions in 7/128/9/12 source files respectively, including 41 responsive style-origin candidates in Bulletproof. Those counts do not establish effective rendered values, safe user-visible edits, or accepted transactions. The broader real-project Code↔Canvas, responsive, multi-file/rename/delete/create, selective inverse, crash/restart, export and HMR closure gates remain unproven on this corpus.

## Engineering timings and limits

The receipts record cold **attempt** timings for every import, static runtime inspection and compiler rejection. Zustand additionally records actual preview-start and export attempts, both of which reject before execution/build. These are small local parser/API measurements, not renderer startup or product performance promises. Cold runner startup, warm CSS/React edits, Fast Refresh, reload, full generation restart and export-build timings are explicitly unmeasured for these rejected projects. Existing authored-fixture performance evidence cannot replace missing full-project evidence.

No project was admitted to the runner, so this audit creates no project process or resource/isolation claim. The functional server and private source materializations are closed/removed by the harness. Upstream Git object caches remain local and ignored; receipts contain no credentials, cookies, source content, user filesystem paths or VM/cloud state.

## Reproduction

With repository-owned dependencies installed and the existing local runner prepared, run from the repository root:

```sh
node scripts/qa/phase2g2-corpus.cjs
node scripts/qa/phase2g2-corpus.cjs .webcanbe/runner/qa-phase2g2/corpus/upstream corpus-starting-adapters --starting-intake-profiles
```

The default cache is private ignored state, and missing repositories are fetched at fixed commits with no checkout or project execution. A pre-existing cache directory may be passed as the first argument; its origin and HEAD must match exactly. The receipt name is the optional second argument. All candidate filenames and output boundaries are fixed or validated, and each run uses a fresh private application/source directory that is deleted on exit.

The smallest compatibility closure action is to implement and independently verify an unchanged supported full-application profile from this retained corpus. Real hosting credentials alone will not fix the demonstrated intake/configuration/dependency/authoring/export blockers. The matrix must continue to report them alongside hosted gates.
