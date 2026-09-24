# Candidate preview timing, 2026-09-24

The pinned Lima 2.2.0 Apple Silicon runtime passed `npm run runner:verify`, including the network/process/filesystem isolation canaries and the outer timeout. A short hashed `/private/tmp` Lima home fixes macOS's 104-byte UNIX socket path limit in this deeply nested checkout; the VM still has no host mounts, agent forwarding, or cloud account.

Six cold preview generations were run through the actual local `LocalLimaRunnerProvider`, using the self-contained `fixtures/compatible-react-vite` project and the existing first-party `fixtures/aperture-north` React/Vite source. Each run compiled the project, launched a fresh isolated browser generation, obtained a rendered screenshot, and closed the generation. All six rendered successfully.

| Project | Request dispatch | Queue | Source preparation | Runtime inspection | Build | Snapshot packaging | Runner startup | First rendered capture | Total visible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Known-good median of 3 | 0 ms | 0 ms | 1.3 ms | 7.4 ms | 57.3 ms | 0.6 ms | 1,106.4 ms | 61.9 ms | 1,240.1 ms |
| Aperture North median of 3 | 0 ms | 0 ms | 0.8 ms | 5.0 ms | 44.4 ms | 8.9 ms | 1,036.6 ms | 153.3 ms | 1,240.1 ms |

The direct local path has no managed dispatch or queue, hence zero is an observed property of this harness, not a measured Cloudflare queue. Full visible time ranges: known-good 911.0–1,298.4 ms; Aperture North 1,201.7–1,259.8 ms. The repeated local test does not reproduce the reported long production Editor loading. Production uses Cloudflare Browser Run `quickAction("snapshot")`, which has separate stage logging (`wcb_preview_request_timing` and `wcb_preview_browser_timing`). Authenticated production runs on a designated disposable QA account and their Worker logs are still required before claiming a production latency fix.

The candidate now retains exact-revision, authorized snapshot frames for five minutes instead of one minute within the same bounded Worker isolate. This reduces repeated Browser Run launches after Editor navigation while keeping revision, route, viewport, and access checks. It does not shorten a first cold Browser Run capture. The real production benefit remains unmeasured until safe authenticated access is available.

The cold Browser Run document now loads `preview-runtime.ts` directly from a dedicated Vite entry. The previous SPA-based path loaded the app entry, icons, Firebase, and 171.3 KiB of app CSS before the preview runtime. The production manifest's static graph for that path was 4,189.9 KiB JS plus 171.3 KiB CSS; the dedicated entry is 3,744.9 KiB JS and no CSS. This removes 445.0 KiB JS and 171.3 KiB CSS from the first preview document's mandatory graph without changing the source payload, Browser Run call, network allowlist, or visual editing transaction path. A built fixture harness rendered the real React/Vite project, set `data-wcb-ready=1`, and emitted source observations in Chrome. Cloudflare first-run latency after this change is still unmeasured.

The existing Worker cache test shows a same-revision repeat entry skips `quickAction` entirely, while changed revision, route, viewport, and explicit capture each launch a new capture. Its in-memory mock returned in under 1 ms in the test log; that is a fixture measurement, not a production cache-hit measurement. The five-minute cache remains isolate-local, so a request landing on another isolate can still be cold.
