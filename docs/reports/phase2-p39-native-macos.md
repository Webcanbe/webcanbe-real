# Phase 2 P39 macOS native evidence follow-up — 2026-09-16

**P39 PARTIAL. Native IME FAIL. VoiceOver FAIL.** The retained native gaps were
not relabelled from synthetic or accessibility-tree evidence.

## Scope

This branch starts exactly at `4cce6c861b8a47b224ee2b73f3f644731af53feb`.
Only a macOS evidence harness, its read-only input-source probe, focused harness
tests and this report were added. Production code, P05, P61, Phase 3, the full
646+ suite, load/endurance and the broad matrix were not touched.

## Native IME result

The headed packaged product, actual isolated Linux project and trusted raster
viewer were prepared with the remote `Name` textbox focused. The read-only
Carbon probe confirmed the active source as
`com.apple.inputmethod.Korean.2SetKorean`. The harness records timestamped
`keydown`, `keyup`, `compositionstart`, `compositionupdate`, `compositionend`,
`beforeinput` and `input` events, exact text, final route/accessibility text and
canonical source/revision/history digests.

The computer-use driver's `g k s r m f` sequence did not traverse the macOS
input method and produced no qualifying composition lifecycle. It is therefore
not retained as native evidence. The harness never calls JavaScript event
dispatch, CDP `Input.*`, Playwright keyboard/text insertion or paste for the IME
gate. A physical Korean 2-Set sequence is still required.

## VoiceOver result

The harness deterministically opens Code, focuses its pressed control and records
before/after Chromium AX role, name, value, focus and states together with trusted
focus/click events and canonical product state. Actual macOS VoiceOver was launched
and its process was observed. Its screen-curtain behavior also appeared, but the
computer-use driver's Control-Option chord was delivered to the application layer
instead of VoiceOver: it produced no VoiceOver cursor move and no trusted Canvas
activation. Ordinary focus changes and AX snapshots are not counted as VoiceOver
proof.

## Exact remaining human action

With the retained harness running:

1. At `IME_READY`, physically press `g`, `k`, `s`, `r`, `m`, `f`, `Return`,
   `Tab`, `Return` while Korean 2-Set is selected. Do not paste.
2. At `VOICEOVER_READY`, with VoiceOver running and Code focused, physically
   press `Control-Option-Left`, then `Control-Option-Space`.

No mouse positioning, source edit, permission bypass or free-form exploration is
required. The harness alone decides PASS from trusted lifecycle, focus, activation,
product-effect and canonical-state evidence.

## Targeted verification

- `npm run build`: PASS (TypeScript and required packaged frontend assets).
- `npx vitest run src/webcanbe-engine/phase2-p39.test.ts src/webcanbe-engine/phase2-p39-native-harness.test.ts`:
  28/28 PASS.
- Native IME acceptance: FAIL pending the physical fixed sequence.
- VoiceOver acceptance: FAIL pending the two physical VoiceOver commands.

Combined targeted acceptance: **28/30**. Production code was not changed, so a
changed-surface security review is not applicable. Main remains
`dd2d9cf8ffa6d82e4fdbb3e0ab37fa43ea9f945b`.
