# Phase 2 P39 closure attempt — 2026-09-15

**P39 PARTIAL. Native IME NOT YET. Full accessibility/screen reader NOT YET.
Bounded sustained session/renewal PASS. Internal blockers remain P05 / P39 / P61.**

Product implementation: `a531b323f8160eeed80e3b67077512f76d165bff`.

## Scope and checkpoint

Fetched origin before editing; clean `phase-2-compatible-editor` at
`705e03f73d2079d021efc14a39aec28569a7dbd9`, descended from unchanged main
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`. Only P39 changed. No P05/P61,
corpus rebuild, later phases, payments, final UI, main merge or public deployment.

## Input and native evidence

Composition now has a focus/revision/generation lifetime, cancellation on authority
loss and reconnect, beforeinput/input handling, and final-event deduplication.
Constructed starts/input/paste/keys are refused. The retained CDP untrusted-end
compatibility path can finish only text corroborated by the current trusted
composition update and sink value. It is explicitly **browser evidence, not OS IME**.
The broker consumes numbered input frames once; replay is rejected before delivery.
The existing 64-event queue, clipboard, Unicode and separate-origin isolation remain.

25 new regression identities cover the composition and AX validation seams and
broker replay. Korean, Japanese and combining Unicode/emoji ordering cases are
synthetic unit evidence. Actual Chromium/hosted evidence covers Korean CDP
composition, Unicode clipboard copy/paste, F6 exit, hard 60-second expiry and
reconnect with 81 queued key events (only one old-generation request submitted).

Native feasibility: Apple Korean 2-Set is enabled/current; the Swift permission
probe reported `AXIsProcessTrusted() == false`, including outside the shell
sandbox. The headed hosted native mode received no composition events and timed
out. The first native-app attempt selected a different Chromium instance. A second,
45-second attempt verified the exact chromium-1234 TEST window and its macOS AX
tree, but focus/targeting still produced no composition events. Neither attempt
constitutes native IME or screen-reader integration evidence. Japanese OS input and
real screen-reader operation were not established. No third-party automation or
new OS permission was installed/granted.

Reproduce the smallest native probe with the retained TEST gateway running:
`WCB_P39_NATIVE=1 WCB_INPUT_RECONNECT_ONLY=1 WCB_PLAYWRIGHT_MODULE=<installed-playwright> node scripts/qa/p39-browser.cjs`.
Enter and commit `한글` with the actual OS IME in the focused owned TEST viewer
within its unchanged 60-second lease. Preserve the event trace and independently
record the selected input method. A successful CDP run cannot replace this proof.

## Accessibility

The worker now reads Chromium `Accessibility.getFullAXTree`; it no longer guesses
focused roles/names from tag names. The controller validates bounded roles, names,
descriptions and states. Up to 256 nodes reach a clearly labelled **read-only
accessibility snapshot**, rendered using textContent. Values, raw HTML, navigable URLs and
executable content are not projected. Focus announcements include browser states;
viewer focus is visible and the interaction-mode button exposes its pressed state.

Actual editor and viewer Chromium AX trees, keyboard Code/Canvas switching, focus
progression, source controls, status semantics and F6 escape are tested. Native
editor controls retain their existing names/states and keyboard source alternatives.
This is not full interactive project accessibility: structural navigation, actions,
modal focus behavior and live-region interaction across the remote project boundary
still need a complete assistive interaction bridge and real screen-reader evidence.
A flat text snapshot does not close that requirement.

## Endurance

The actual packaged HTTPS editor, PostgreSQL authority and mTLS native Linux runner
completed 16 iterations in 93.104 seconds: 16 fresh short TEST sessions, 16 generation
reconnects, 16 observed lease extensions, 33 source reads, 16 Code edits and 16 Visual
edits. Each iteration pauses traffic, resumes, verifies exact Unicode input,
refuses replay and old authority, and stops its generation. Active revocation and
regrant do not revive old capabilities. 49 expected authority/replay refusals;
zero unexpected failures, duplicate events or stale delivery.

Short lifetimes are supplied only by QA to the existing verified-session store;
no production default or clock hook changed. Initial TEST VM clock skew (-171.335s)
caused two failed starts, retained as failures. Guest wall time was aligned with
host time before the clean production-package run; diagnostic instrumentation was
removed. Lease deadlines were checked, not extended beyond session authority.

Worker resources: zero jobs before/after; first active task count 115, peak 119,
final 0. First active memory 369,770,496 bytes; peak 494,866,432; final worker memory
0 after verified cleanup. End-of-iteration memory varied without monotonic growth.
The browser probe measures every reconnect after garbage collection. A private heap
snapshot traced initial detached-frame growth to DevTools/FrameLocator remote
handles. Replacing those queries with equivalent pointer/keyboard input yielded
constant DOM/listener counts; no isolation or product cleanup was bypassed.
The final 12-reconnect run held 333 DOM nodes and 217 listeners throughout
the reconnect samples; collected JS heap was 6,536,280 bytes initially and
5,913,564 finally (peak 6,536,280 across collected samples).
Browser reconnect resource results and final regression identities are indexed in
`phase2-p39-evidence/` alongside failed probes. This is bounded local TEST endurance,
not multi-hour stability or deployed capacity evidence.

## Verification, security and remaining work

**646 distinct passing identities; all prior 621 identities and all 39 old test
files preserved byte-for-byte. No outstanding failures/skips.** Full suite ran
once (638 pass / 8 fail); bounded five-file correction (80 pass / 2 fail) and
final two-file deadline correction (26 pass) close those failures without changing
old tests. The installed Playwright path was supplied, the transient ENOTEMPTY
teardown passed on correction, and the strict 60-second host/PG deadline tests
required TEST guest-clock calibration (final measured offset +898ms). Production
deadline checks were not relaxed. TypeScript, production build and package pass;
the existing Vite chunk-size warning remains. All failed runs are retained.

All 150 owned TEST leases were stopped; no worker unit remains. TEST schema,
tunnels, gateway, generated PKI and QA database password were removed/cleared;
the VM is stopped. The private diagnostic heap was deleted.

Changed-path security review covers the four product files and direct consumers:
viewer event provenance/focus; editor authority and queue lifecycle; controller
replay/AX sanitization; worker CDP observation; hosted API, mTLS gateway/provider and
deadline-capped lease renewal. Confirmed replay risk was fixed. Zero confirmed
unresolved vulnerabilities. Isolation, worker limits, production expiries and
server-owned authority remain unchanged. No broad repeated security scan.

Exact remaining P39 blockers:

1. Reproducible actual OS IME completion and lifecycle evidence (including Japanese).
2. Full interactive screen-reader/accessibility behavior across the isolated viewer,
   including the missing semantic interaction bridge and legitimate integration proof.

P05/P61 remain untouched. Phase 2 internal software closure: **NOT YET**.
