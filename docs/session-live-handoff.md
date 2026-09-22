# Webcanbe Live Session Handoff — 2026-09-21 KST

> **READ THIS FIRST IF A CHAT SESSION IS LOST.**
>
> Purpose: preserve the live cross-session state of Webcanbe as if the assistant were being moved to a new session immediately.
> This is the stable session-entry file. Update it whenever a material product, business, payment, GTM, or founder-goal decision changes.

## 0. Canonical documents

Read in this order:

1. `docs/session-live-handoff.md` — this file; current cross-session summary
2. `docs/current-handoff.md` — authoritative technical/engineering state
3. `docs/founder-goal-handoff-2026-09-20.md` — founder personal North Star, success definition, probability baseline
4. `docs/payments-handoff-2026-09-21.md` — payment / reseller / creator payout architecture
5. Latest business/GTM handoff in Library when needed, currently `WebCanBe_Business_General_Handoff_UPDATED_2026-09-21_v31.md`

Rule:
- Never reconstruct current state from memory alone if these files are available.
- Newer dated explicit decisions override older conflicting notes.
- Never claim a step is complete without checking the latest technical handoff / repo / actual data.

---

## 1. Founder North Star — do not lose this

The user’s first major personal life goal is not merely “make money.”

Current North Star:
- Make Webcanbe a genuinely large, fast-growing company while still very young.
- Current extreme target: within ~24 months, build a company credibly worth **KRW 1T+**, backed by real customers, revenue, growth, retention/liquidity, not valuation hype alone.
- Current subjective starting probability baseline: **0.05% (~1/2,000)**. Do not casually change this number without new real traction data.
- If major traction appears, update probability based on revenue, retention, repeat purchase, GMV, take rate, CAC, seller liquidity and multi-month growth.
- Business success comes first.
- After success, convert the unusual founder story into a global public persona / creator career.
- Desired long-term image: not a stiff “young billionaire teaches success” persona, but **a globally successful founder whose life is extraordinary and whose personality itself is entertaining**.
- Symbolic desired future: major press, Korean mainstream/YouTube appearances, relocation to the U.S., access to respected founders/technology leaders, and eventually an IShowSpeed-like persistent global fandom.
- Desired audience reaction: **“회사도 미쳤는데 걔 자체가 재밌음.”**
- These fame/network scenarios are aspirations, not present facts.

The longer preserved version is in:
`docs/founder-goal-handoff-2026-09-20.md`

---

## 2. Technical state at this exact handoff

Source of truth:
`docs/current-handoff.md`

Latest visible state checked 2026-09-21:
- **Gate 4 combined Visual + Code proof PASS**
  - checkpoint: `85c66326ae85ffe5065197ecd4272673b1021bf2`
  - chain proves:
    `immutable release → materialize → React analyzer → Visual text mutation → durable Visual revision → Code revision → reopen → standalone export/build`
- Current Gate 3 activation candidate:
  - branch: `phase5-gate3-materialization-staging-v4`
  - verified checkpoint: `bd03d69726b31a70e2a981b35b609fe3ac69e33f`
  - integrated CI PASS
- v3 is historical / backup only.
- Production materialization mutation remains **OFF**.
- No Gate 3 fixture has been applied to production.
- **Remaining critical blocker before Gate 3 promotion: authenticated Gate 2 same-account GitHub + Email E2E.**
- Do not infer that code/CI PASS equals human provider E2E PASS.

Important:
- Re-read the current handoff before acting, because engineering may advance after this session entry was written.

---

## 3. Current launch pressure / September objective

The user wants a deliberately aggressive launch cadence.

Current target:
- **Public beta no later than 2026-09-24**, earlier if the required flow is genuinely ready.
- Do not hold launch for cosmetic polish.
- Do not fake real-money readiness if payment is not production-ready.
- If paid checkout is delayed, launch the working product/beta scope that is truthful while payment closure continues.

Current September operating principle:
> Every day must produce either real product readiness, real buyer/seller contact, or real user evidence.

Avoid:
- non-critical UI redesign
- logo/animation churn
- speculative new features
- unrelated new businesses/projects
- broad paid advertising before conversion evidence
- personal-famous-founder content before business traction

---

## 4. 2026-09-21 immediate execution target

Today is the launch-uncertainty removal day.

Current desired end-of-day state:
1. Close/verify Gate 2 human auth E2E if possible.
2. Keep Gate 3 v4 promotion-ready once Gate 2 is actually green.
3. Confirm paid-launch path vs free-beta-with-payment-following path.
4. Produce one short real product demo showing the core value:
   project → working copy → visual/code edit → save/reopen/export.
5. Start actual buyer/seller conversations, not only planning.
6. Do not spend time on non-launch UI polish.

Earlier minimum outreach target discussed for today:
- buyer prospects: 5
- seller prospects: 8
These are operating targets, not recorded completions unless actual outreach logs prove them.

---

## 5. GTM direction

Current buyer direction:
- consumer/self-serve first, not agency-service positioning.
- English-speaking / primarily U.S. market.
- Initial users should have an actual project/site need rather than generic “entrepreneurship interest.”

Core product positioning:
**Real web projects you can edit visually or in code — and fully own.**

Do not lead with:
- generic “AI website builder”
- vague “next-generation platform”
- template-marketplace-only framing

Core differentiation:
- start from a real working project
- visual and code editing on the actual source
- ownership of source
- export path / no source lock-in

Seller direction:
- real-code project creators
- React / Next.js / Tailwind / reusable web projects
- non-exclusive pilot with one real project is preferable to asking for whole-catalog commitment
- do not treat a purchased third-party template license as resale rights

Existing GTM base plan still useful:
- seller-owned distribution is high leverage
- concentrated initial inventory rather than empty broad categories
- SEO/indexable real listing pages after real inventory exists
- creator/ecosystem partnerships after product is demonstrable

---

## 6. X / social state

Confirmed in chat:
- X blue check already obtained.
- Professional category selected: **Software Company**.
- Recommended bio:
  **Real web projects you can edit visually or in code — and fully own.**
- Company account should stay product-first for now.
- First post should explain product identity, not founder age.

Recommended first-post direction:
```
Webcanbe is for people who don’t want to start from a blank page.

Start with a real web project.
Edit it visually or in code.
Keep the source.

Early beta opens this week.
webcanbe.com
```

Do not record this as published unless verified.

Instagram:
- considered as a secondary channel.
- Create/hold handle and reuse demo/Reels if useful.
- Do not let Instagram setup steal time from launch / X / actual users.
- Do not claim account creation is complete unless verified.

Paid social:
- no broad paid ads before actual conversion/use evidence.
- first paid test, if used later, should be small and measurable against project starts / completed use, not impressions.

---

## 7. Payment architecture — current fixed launch direction

Detailed source:
`docs/payments-handoff-2026-09-21.md`

Current launch architecture:
- `PaymentProvider = PayPalStandard`
- buyer pays Webcanbe via ordinary PayPal Standard Checkout / Orders API
- Webcanbe owns canonical order, entitlement, license, creator earnings, refund/dispute and payout ledger
- **no PayPal Partner / Multiparty at launch**
- **no automatic split payment**
- **no seller PayPal onboarding through Webcanbe**
- creator underlying IP remains creator-owned under the agreed distribution/sale rights structure
- creator earnings:
  `PENDING → 14-day hold → AVAILABLE → payout`
- payout schedule target: **1st / 15th**
- initial overseas creator payout:
  `PayoutProvider = PayPalManual`
- Korean / unsuitable creator fallback:
  bank / other manual rail such as Payoneer as appropriate
- later payout automation can replace provider without replacing Webcanbe ledger

Answering preference:
- Do **not** repeatedly re-litigate or warn about the same marketplace/PayPal terms boundary every time this architecture is mentioned.
- Treat the chosen reseller/distribution structure as the working assumption unless:
  1. the user explicitly asks for legal/terms review, or
  2. the actual funds-flow/business structure changes materially.
- Focus normal future discussion on implementation, reconciliation, payout ops, UX, growth, and launch.

Operational additions already preserved:
- negative-balance / later refund handling
- digital delivery evidence
- payout provider reference / reconciliation
- provider abstraction

---

## 8. Finance / equity concepts already established

Do not re-explain from zero unless asked:
- revenue = company revenue
- profit = revenue minus costs
- company valuation = value of whole company
- equity = ownership percentage
- equity value = valuation × ownership percentage
- company money ≠ founder personal money
- founder personal cash can come from salary, dividends, or selling shares
- early goal is to preserve high ownership when reasonable, but 100% ownership is not sacred if dilution creates far more company value
- investment is not required merely to have a company valuation

---

## 9. Probability baseline — preserve consistency

Fixed current subjective baseline for:
**“Within ~24 months, Webcanbe becomes a real KRW 1T+ company backed by actual business traction.”**

Current baseline:
- user: **0.05% ≈ 1/2,000**
- comparison heuristic only:
  - general middle-school student starting from scratch: ~0.001%
  - general adult first-time founder starting from scratch: ~0.01%

These are not official measured probabilities.

Do not change merely because the user phrases the question differently.
Change only when actual new evidence appears.

Strong evidence that should materially update:
- real paid buyers
- MRR / recognized revenue
- GMV + take rate
- repeat purchases / retention
- seller first-sale rate
- marketplace liquidity
- CAC / organic acquisition
- multi-month growth
- contribution margin / profit

---

## 10. Permanent session-continuity operating rule

**Always behave as though the current chat could be cut off immediately.**

Whenever a material decision or milestone happens:
- technical implementation / branch / CI / blocker → update `docs/current-handoff.md` or the engineering handoff process already used by the repo
- personal North Star / success definition / probability baseline → update `docs/founder-goal-handoff-2026-09-20.md`
- payment / payout architecture → update `docs/payments-handoff-2026-09-21.md`
- cross-cutting “what are we doing right now?” state → update this file, `docs/session-live-handoff.md`

Do not wait for the user to say “save this” after every important change.
Do not create commits for trivial chat wording. Save decisions, commitments, blockers, completed milestones, and changes that would materially affect how the next session should proceed.

Before ending a substantial work block, make sure the handoff reflects:
1. what is actually complete
2. what is only planned
3. current blockers
4. exact next action
5. important user decisions/preferences
6. any decision that supersedes an older plan

---

## 11. Exact resume instruction for the next assistant/session

If context is lost, do this before proposing a new plan:

1. Read this file.
2. Read the top of `docs/current-handoff.md`.
3. Read `docs/founder-goal-handoff-2026-09-20.md` when the request touches long-term goals/fame/probability.
4. Read `docs/payments-handoff-2026-09-21.md` when the request touches checkout/creator earnings/payouts.
5. Check the actual GitHub branch/main state before making engineering claims.
6. Ask only for human actions that truly cannot be done with available tools.
7. Continue from the exact blocker; do not restart planning from Phase 1.

Current exact cross-cutting priority:
**Finish launch-critical auth/mutation/payment closure, publicly expose a truthful usable beta by 9/24 at the latest, then immediately shift attention from building to real buyers, real sellers and measured usage.**


## 12. ABSOLUTE PUBLIC-BETA DEADLINE — 2026-09-21 decision

User explicitly tightened the launch rule:

- **2026-09-24 21:00 KST is an absolute deadline.**
- Do not describe 9/25 as “only one day late” or normalize slippage.
- The operating assumption is: **the product must be publicly accessible within the deadline.**
- Earlier is better: 9/22 excellent, 9/23 preferred, 9/24 allowed only as the final deadline.
- 9/25 or later = missed launch commitment.
- Do not use cosmetic polish, noncritical features, or “one more improvement” to justify delay.
- If paid checkout is the only external blocker, public beta still opens within the deadline with truthful free/limited scope; payment can follow.
- The public beta must still deliver the real core promise; a static waitlist/marketing page alone does not count as the target launch.
- Exact launch checklist is preserved in `docs/public-beta-launch-checklist-2026-09-24.md`.


## 13. Founder liquidity / exit-strategy working view — 2026-09-21

Current working preference discussed:
- If Webcanbe reaches ~KRW 1T valuation while growth is still very strong, do **not** default to selling the whole company.
- Prefer keeping a large ownership stake and, if personal liquidity is actually needed, consider only a very small secondary sale rather than raising founder salary excessively.
- Illustrative reasoning discussed:
  - company value ~KRW 1T
  - founder ownership still high (example used: ~80%)
  - company pays company operating/development costs
  - founder salary remains moderate relative to equity value
  - personal liquidity can come from salary/dividends/very small secondary sale rather than treating company cash as personal cash
- Do not lock numeric sale thresholds as permanent truth. Actual sell/hold decisions should depend on growth, expected future value, concentration risk, acquisition premium, control, taxes and what the founder wants to do next.
- The user finds this area difficult and wants professional-style guidance rather than intuition alone.

Relevant professional roles for future decisions:
- **CFO / strategic finance lead:** company cash, runway, compensation, capital allocation, fundraising/secondary modeling.
- **M&A advisor / investment banker:** whole-company sale, strategic bids, valuation, buyer process and negotiation.
- **Corporate/M&A lawyer:** transaction structure, shareholder rights, sale documents, governance.
- **Tax accountant / tax lawyer:** tax cost of salary, dividends, secondary sales, relocation and transaction structure.
- **Private wealth advisor / family office:** founder's personal asset allocation after meaningful liquidity; diversification, cash management, long-term wealth.
- **Secondary-market advisor/broker:** partial founder-share liquidity when appropriate.
- At a very large scale, no single advisor should control all of these decisions; use multiple independent specialists and compare incentives.

Operating preference:
- Early stage: do not overbuild an advisor team before there is real value to manage.
- When Webcanbe has meaningful revenue / institutional-scale value, bring in an experienced CFO or strong finance lead before making large founder-liquidity or M&A decisions.


## 14. Founder execution guardrails + carrot system — 2026-09-21

User explicitly asked the assistant to actively prevent four failure modes while keeping motivation high:
1. **분산** — unrelated new projects/ideas stealing focus from Webcanbe.
2. **제품만 너무 오래 만들기** — polishing/building without enough real market exposure.
3. **고객 반응이 나쁠 때 방향을 못 바꾸기** — defending the current product/message instead of learning from evidence.
4. **너무 빨리 지치기** — unsustainable bursts that reduce multi-month execution quality.

The assistant should actively enforce the following in future sessions.

### A. Focus rule
Until meaningful PMF evidence:
- Webcanbe remains the default primary project.
- New business ideas may be captured in a parking-lot note but should not consume execution time unless the user explicitly decides to change the main goal based on evidence.
- Before helping with a substantial unrelated project, remind the user of the current Webcanbe launch/traction objective and ask whether this is intentionally replacing or pausing it only when the request would materially consume project time. Do not nag on trivial unrelated questions.

### B. Build-vs-market rule
After public beta:
- Every meaningful product work block should map to one of:
  - blocks purchase/start
  - blocks edit/save/reopen/export
  - blocks retention
  - blocks seller onboarding/listing
  - improves a measured conversion bottleneck
- Cosmetic/noncritical work is not allowed to displace user contact and measured usage.
- A day with only coding and no real user/market evidence is not counted as a strong GTM day after launch.
- Keep the 2026-09-24 21:00 KST absolute public-beta deadline.

### C. Customer-evidence rule
When customer behavior conflicts with the founder's preferred idea:
- Treat repeated behavior as evidence, not disrespect or failure.
- One complaint = note.
- Three independent users blocked/confused at the same step = investigate immediately.
- Repeated low conversion with adequate qualified traffic = test message/offer/product change rather than simply adding features.
- Do not pivot from one bad comment; do not ignore a repeated pattern.

### D. Sustainability rule
- Optimize for the strongest 24-month execution, not the longest single day.
- Sleep is an execution constraint, not a reward to sacrifice.
- Do not recommend all-nighters as a strategy.
- If output quality visibly collapses, prioritize the next highest-value task and stop low-value work rather than continuing for hours.
- Aggressiveness means ruthless prioritization and high iteration frequency, not permanent exhaustion.

### E. Carrot / milestone rewards
Use rewards only after observable milestones, not effort alone.
Recommended ladder:
- Public beta live by deadline → small immediate personal reward.
- First real external user completes core flow → reward.
- First genuine paid buyer → larger reward.
- First repeat buyer / second independent paid buyer → reward.
- First seller earns money → reward.
- First KRW 1M cumulative company revenue → meaningful reward.
- First KRW 10M cumulative company revenue → larger reward.
- First KRW 100M cumulative company revenue → major reward.
- PMF-grade retention / repeat purchase milestone → celebrate and then raise the operating bar.
Rewards should be chosen by the user and kept small enough not to damage company runway.

### F. Assistant behavior
- Be supportive, but do not call weak evidence success.
- If the user starts polishing instead of launching/selling, point it out directly.
- If the user jumps to a new project because Webcanbe is temporarily frustrating, distinguish strategic pivot from avoidance.
- If actual metrics improve, explicitly acknowledge that the 2-year KRW 1T path has become more credible.
- If metrics are weak, frame the next test as a way to increase the odds rather than as a personal failure.
- The objective is not to preserve the assistant's old plan; it is to maximize the user's real chance of building a large company.


## 15. Why the 24-month KRW 1T target is hard / why Webcanbe is still a plausible vehicle — 2026-09-21

Working judgment:
- The 24-month KRW 1T target is hard less because the founder personally cannot execute and more because **market adoption must happen unusually fast**.
- The limiting variables are PMF, distribution, seller/buyer liquidity, retention, timing, competitive response and the speed at which growth compounds.
- “Luck” should not be treated as pure randomness. It includes timing, market shifts, distribution breaks, key hires/partners and sudden demand. The operating strategy is to increase the number of high-quality shots and iterations so favorable breaks are more likely to be captured.
- Webcanbe is structurally more plausible for a very large valuation than a linear service/agency/local-business model because it can be:
  - software-based
  - global from day one
  - two-sided marketplace
  - low marginal-cost distribution
  - capable of seller-led distribution / network effects
  - capable of adding higher-margin software revenue around marketplace activity
- This does **not** mean the current idea is proven or that Webcanbe is objectively “the best possible 1T idea.”
- The strongest current claim is:
  **Webcanbe is one of the more plausible kinds of businesses for the founder's extreme goal, provided the market proves that users actually want the source-owning visual+code workflow and marketplace loop.**
- If real traction fails to appear, preserving the 1T goal is more important than preserving the exact current product shape; use evidence-driven pivots rather than identity attachment to the initial idea.


## 16. 2026-09-22 launch-closure snapshot from live GitHub

This section supersedes older launch-percentage impressions when they conflict with actual repo evidence.

Latest main observed:
- `b139a7913709b0bf0145c9620b94ac92e72f4ccd`
- PR #83 merged: invalid project route/public browser stabilization.

Current commerce/AI closure chain:
- **PR #84 — AI workspace closure**
  - open, not merged.
  - head `15a88311368effad7c1796a60b03596481bcaaa2`
  - several canonical workflows are RED.
  - at least one deterministic rendered stale-response/revision bug is confirmed: a delayed accepted AI response can regress the client revision after a newer Code save, causing Export to request an older revision.
  - therefore do not merge #84 until corrected and green.
- **PR #85 — commerce UI closure**
  - open, not merged.
  - frozen `INTEGRATION_READY=fd665fc9dad7fb1ab3257b91621fc92b28a91cab`
  - 69 focused payment/UI tests + build reportedly pass.
  - PayPal Sandbox connected E2E was **not run** because sandbox credentials / plan IDs are absent in that environment.
  - depends on correcting/merging #84 first in the current integration sequence.
- **PR #86 — billing/browser/CI reconcile**
  - draft, open, not merged.
  - head `a60fceb4de087c0ce886063d1ccd3f2a3e4147e6`
  - depends on corrected #84, then #85.
  - 75 focused commerce tests, deterministic Chromium commerce checks, and schema/payment-state checks reportedly pass.
  - not PayPal connected E2E.
  - no FINAL_RC frozen.

Interpretation of coding-agent percentages:
- “code 99% / launch 94–96% / payments 98–99%” can be directionally reasonable as an engineering-completeness estimate, but **must not be treated as GO status**.
- The remaining percentage contains high-criticality integration/production checks; launch readiness is binary at those gates.
- AI itself is not part of the minimum public-beta core promise. If AI remains the only defect, it may be disabled/hidden for launch rather than delaying the usable core beta.
- Commerce is not mandatory for FREE/LIMITED public beta, but is mandatory for PAID beta.
- Auth isolation, materialization, durable edit/save/reopen/export and serious security/data-integrity issues remain non-negotiable beta blockers.

Current decision rule:
1. If #84 is not green but AI can be truthfully disabled without affecting core editing, do not let AI alone push the beta past the hard deadline.
2. If #85/#86 or PayPal connected E2E are not ready, launch free/limited beta by the hard deadline and keep paid CTA disabled.
3. Do not launch even free beta until authenticated account isolation + real working-copy materialization + durable edit/save/reopen/export are proven in production.
4. Absolute public-beta deadline remains **2026-09-24 21:00 KST**.


## 17. 2026-09-22 20:23 KST launch judgment from live GitHub

Live repo state rechecked:

- Current main: `6951fd7d82a47775405142a098e966140ba238f8`.
- PR #84 AI workspace closure: **merged** after causal revision / stale-response fix.
- PR #85 commerce UI closure: **merged**.
- PR #86 billing/browser reconcile: **merged**.
- Current main workflows:
  - UI verify: PASS
  - durable editor/export: PASS
  - Bigperson checkpoint: PASS
  - production smoke: PASS
  - browser compatibility smoke: PASS
- Production smoke on main reports:
  - product read **and materialization mutation switches deployed**
  - production DB readiness PASS
  - authoritative catalog read PASS
  - anonymous private reads refused
  - anonymous materialization refused
  - 28 checks / 0 failures
- `wrangler.jsonc` on main currently has `WEBCANBE_PRODUCT_MUTATIONS = enabled`.
- PR #87 public marketplace/docs shell remains open and unmerged.
- PR #88 authenticated shell/onboarding/editor polish remains open and unmerged.
  - Both are **not launch blockers** by themselves and should not be allowed to delay the core beta merely for polish/content breadth.

Remaining unproven critical item:
- The repository still lacks evidence of a **real authenticated production-user core-flow acceptance** after current integration:
  - same-account auth path / available provider path
  - real working-copy materialization
  - Visual edit
  - durable save
  - reopen/reload
  - Code save
  - export → independent build
- Previous PR #60 explicitly lists this authenticated operator acceptance as pending.
- GitHub/Email same-account provider E2E also remains unproven in stored evidence.
- PayPal code is integrated, but connected PayPal sandbox/production E2E is not proven in current evidence.

Launch decision at 20:23:
- **Do not merge PR #87/#88 simply to feel more complete.**
- **Do not wait on AI anymore; #84 is merged and main is green.**
- **Do not require PayPal for a free/limited public beta.**
- The only thing that should stand between current main and a public free/limited beta tonight is one real authenticated production core-flow smoke.
- If that full core flow passes tonight, launch the free/limited public beta **tonight 9/22**.
- If it fails, fix only the exact blocking failure; do not branch into polish.
- Paid beta waits for connected PayPal E2E if not already proven.
- Absolute public-beta deadline remains **2026-09-24 21:00 KST**.


## 18. Probability tracking protocol for the 24-month KRW 1T goal — 2026-09-22

The user wants a stable, non-flattering probability tracker for the extreme goal.

### Fixed target definition
Unless the user explicitly changes the target, every probability refers to:
**Within roughly 24 months, Webcanbe becomes a credibly KRW 1 trillion+ company, supported by real customers, recognized company revenue / marketplace economics, growth and retention — not a hype-only or paper-only valuation.**

### Baseline
- Original fixed baseline: **0.0500%** (about 1 in 2,000).
- Treat this as the historical reference point.

### Reporting format whenever the user asks “지금 확률 몇 %야?”
Always report:
1. **Current tracking probability** to at least 4 decimal places when useful (e.g. 0.0503%), rather than rounding every small move back to 0.05%.
2. **Change vs original 0.0500% baseline** in percentage points and relative terms.
3. **Change vs the immediately previous estimate**, if a prior estimate exists.
4. **Exact target definition** the probability refers to.
5. **Positive evidence**, **negative evidence / missing proof**, and the main reason for the change.
6. A brief reminder that this is a **subjective tracking estimate / decision heuristic, not a statistically measured probability**.

### Anti-flattery / anti-manipulation rule
- Never raise the estimate because the user asks for encouragement, sounds motivated, works hard for a day, or wants a higher number.
- Never lower it to be dramatic or “teach a lesson.”
- Do not use praise, mood, age novelty, confidence, or the assistant’s affection as evidence.
- Small evidence should cause small changes. Preserve tiny moves rather than artificially rounding them away.
- A code-completion milestone, CI green state, visual polish, or launch readiness by itself should normally move the estimate only slightly because the dominant uncertainty is market adoption.
- A launch itself can move the estimate a little by removing execution risk, but first payment alone should still not cause a huge jump.

### High-weight evidence
Update probability materially only when new real-world evidence appears, especially:
- verified external paid buyers
- recognized company revenue / MRR
- GMV + actual take rate
- repeat purchase / retention / cohorts
- seller first-sale rate and seller retention
- marketplace liquidity (time-to-sale, buyer/seller match rate)
- qualified traffic → project start → edit/save/export → pay conversion
- organic/referral acquisition and CAC
- multi-week / multi-month growth rate and durability
- contribution margin / refund / dispute behavior
- repeatable distribution channels

### Negative evidence
Decrease it when meaningful contrary evidence appears, such as:
- qualified users repeatedly do not activate or pay
- poor retention after adequate onboarding
- seller supply does not generate buyer demand or vice versa
- acquisition remains expensive with weak conversion
- growth stalls for a meaningful period
- technical/security failures materially damage real usage
- the deadline is missed without a strong external reason
- economics imply scale does not translate into viable company revenue

### Precision discipline
The decimals are a tracking instrument, not fake statistical certainty. Use them consistently so tiny changes remain visible; do not imply that 0.0503% is scientifically measured more precisely than 0.05%. When evidence is weak, keep the move tiny rather than inventing a large change.


## 19. Probability tracker — 2026-09-22 current estimate

Target remains:
**Within roughly 24 months, Webcanbe becomes a credibly KRW 1 trillion+ company, supported by real customers, recognized company revenue / marketplace economics, growth and retention — not hype-only valuation.**

- Original baseline: **0.0500%** (~1 in 2,000)
- Current tracking estimate: **0.0522%** (~1 in 1,916)
- Change vs baseline: **+0.0022 percentage points**, about **+4.4% relative**
- Previous explicit estimate: 0.0500%, so current change vs previous is the same.

Why slightly higher:
- materially more complete production implementation than at baseline
- AI workspace, commerce UI and billing/browser reconciliation merged to main
- core main CI currently green, including durable editor/export, production smoke and browser compatibility
- production materialization mutation switch is enabled and production smoke sees authoritative DB/catalog behavior
- execution velocity toward the 9/22–9/24 launch window has reduced some execution-risk uncertainty
- product architecture remains structurally scalable (global software + marketplace + higher-margin software possibilities)

Why only a small increase:
- no verified external paid-buyer evidence yet
- no retention/repeat purchase/GMV/take-rate evidence
- no proven seller liquidity / seller first-sale rate
- no repeatable acquisition channel or CAC evidence
- real authenticated production-user core-flow acceptance is still unproven in stored evidence
- PayPal connected E2E is unproven
- dominant uncertainty remains market demand and growth speed, not implementation completeness

Do not interpret 0.0522% as statistically measured precision. It is a consistent subjective tracking heuristic. Do not move it materially again for polish/CI alone; next meaningful updates should primarily come from actual external-user and revenue evidence.


## 20. Analytics decision + business-advisor operating rule — 2026-09-22

### Analytics
- Chosen launch analytics stack: **PostHog**.
- Near-term purpose is not vanity traffic reporting; it is to measure the actual activation and purchase funnel.
- Minimum useful event set for launch:
  - landing_view
  - signup_completed
  - listing/project_view
  - materialize_started / materialize_completed
  - edit_saved (producer/mode as property where useful)
  - reopen_success
  - export_completed
  - checkout_started / purchase_completed when paid flow is enabled
- Country/referrer/device/session-replay data are secondary context. The primary launch metrics are qualified visitor → signup → project start/materialize → edit/save → reopen/export → pay.
- Avoid over-instrumenting before launch; add only events that change a business decision.

### Business-advisor rule
The user explicitly wants the assistant to stay sharp on business questions rather than merely encouraging.
- Treat business questions as decision problems: identify the objective, bottleneck, relevant economics, evidence, downside and next test.
- Separate product completion from market proof.
- Challenge avoidance disguised as product work.
- Do not raise success estimates or praise execution without evidence.
- When market data contradicts the current product or plan, prefer the evidence.
- Keep company revenue, GMV, take rate, margin, CAC, retention, cash/runway, founder equity and valuation conceptually separate.
- Optimize advice for increasing the real probability of building a large company, not for preserving a prior plan or making the user feel good.


## 21. Launch domain-giveaway promotion — proposed, not yet finalized — 2026-09-22

User plans to work on this tomorrow, after core implementation is effectively complete.

Working promotion idea:
- Use one or more short 3-letter domains (current candidates include .bz / .cx names) as a **launch hook**, not as the core Webcanbe value proposition.
- Do **not** give a domain merely for signup; that would attract domain hunters and contaminate activation metrics.
- Tie eligibility to meaningful product behavior, e.g. an external user who signs up, creates/materializes a project, completes a real edit/save, and reaches export/publish.
- Prefer a bounded “founding users” mechanic such as:
  - first N qualified users get one domain from a disclosed pool, or
  - first N qualified users enter a drawing for a small number of stronger domains.
- Keep the promotion visibly secondary to Webcanbe’s core pitch: real web projects, visual+code editing, source ownership.
- Track promo traffic separately in PostHog with campaign/referrer properties so giveaway-driven users can be compared against ordinary launch traffic.
- Do not let domain procurement, copy polish, or giveaway mechanics delay the core public-beta launch.
- Before announcing, confirm actual availability, total first-year cost, renewal responsibility, transfer/registrar mechanics, and clear terms for who receives ownership.


## 21. Founding Domain Drop launch campaign — 2026-09-22

User plans to acquire a small pool of short 3-letter domains (.bz/.cx candidates) and use them as an early Webcanbe acquisition/activation incentive.

### Strategic purpose
Do **not** treat this as a generic giveaway for signups. The domains are an activation engine:
- acquisition hook: short 3-letter domain is visually memorable and unusually tangible
- activation gate: reward only after the user completes the real Webcanbe core flow
- scarcity: a finite visible pool creates urgency
- social proof: claimed domains can become public proof of real early users
- learning: PostHog measures whether incentive traffic actually activates or is just freebie traffic

### Recommended launch mechanic
Working name: **Founding Domain Drop**.

Initial wave should be deliberately small: **10–15 domains**, not 50–100 upfront.
- First qualified users get to choose one available domain from a visible curated pool.
- First qualified, first choice. No random drawing.
- One domain per real person/account.
- Qualification should require a **real project + successful edit/save + successful export** (or equivalent final core-flow completion), not merely signup.
- Paid purchase is not required while paid beta is not fully proven.
- Webcanbe covers the first registration year only; renewal responsibility and transfer timing/rail must be stated before claim.
- Keep the highest-value names (e.g. ink.bz / way.bz / she.cx / may.cx / xml.cx) out of the first test pool unless deliberately used as one headline reward. Prefer mid-tier but still attractive names for the first experiment.
- Do not buy a large inventory before the first cohort proves incremental activation.

### Recommended public copy direction
Core line:
**Build something real. Keep the source. Claim a 3-letter domain.**

Supporting concept:
**The first N beta builders who complete a real Webcanbe project and export the source can claim one short 3-letter domain from the live pool. First qualified, first choice. No lottery.**

Avoid vague “win a rare domain” language. The point is guaranteed, earned scarcity tied to using the product.

### Scarcity / UX
- Public live domain pool page or section.
- Show each available domain as a card.
- Show an N-left counter.
- Claimed names remain visible as Claimed rather than disappearing, producing social proof.
- With consent, show claimant handle / project thumbnail later.
- Domain claim unlocks only after the backend has evidence that the qualifying core-flow events completed.
- Do not fake scarcity or manually inflate claim counts.

### PostHog instrumentation
Minimum campaign events/properties:
- domain_drop_view
- domain_drop_cta_clicked
- domain_eligibility_started
- domain_eligibility_completed
- domain_claim_opened
- domain_claimed
- domain_share_clicked
Properties: campaign=founding_domain_drop, referrer, country, chosen_domain, project_id where safe, and funnel stage.

Primary question:
**Does domain-incentive traffic complete materialize/edit/save/export at a higher rate than ordinary launch traffic?**
Do not optimize for raw signups.

### Distribution
Launch asset should be one strong visual showing the actual domain pool and the product:
- X company post first
- founder/personal repost only if useful
- short product demo + domain pool
- communities only where self-promotion is allowed and relevant
- seller/creator outreach can use a separate later creator-domain reward; do not mix both audiences in the first test

### Growth loop
After a user claims a domain:
- generate a clean share card: “Built on Webcanbe · Claimed <domain>”
- sharing is optional, not a condition for the domain
- optional referral reward should be product credit / AI Actions / future perk, not another scarce domain initially

### Success / kill criteria
This campaign is good only if it improves qualified activation economically.
Watch:
- landing → signup
- signup → project/materialize
- project → edit/save
- edit → export
- later export → paid conversion
- cost per activated user and cost per paid user
- freebie-abuse / duplicate-account rate

If it creates signups but not core-flow completion, tighten qualification or stop it. If it materially lifts activation and produces share/referral behavior, expand the pool.


## 22. Founding Domain Drop v2 — optimized for only 2–3 domains — 2026-09-22

Budget reality: user expects to buy only **2–3 short domains**, so the campaign must maximize activation and repeated publicity per domain.

### Core mechanic: micro-drops, not one giant giveaway
Recommended structure:
- **1 domain per cohort of 5 qualified builders**
- Each cohort has exactly 5 verified qualified entries.
- One winner is randomly selected from that cohort.
- Therefore displayed odds are a concrete **1 in 5 (20%)**, rather than an undefined giant lottery.
- With 2 domains: two cohorts = first 10 qualified builders.
- With 3 domains: three cohorts = first 15 qualified builders.
- One real person/account can qualify once; winners cannot re-enter.

This solves the “I probably won’t win” problem better than an uncapped raffle while preserving randomness and fairness.

### Qualification
An entry is earned only after the real product core flow:
signup/login → real project/materialize → at least one accepted edit → durable save → export.
A bare signup does not count.
No purchase should be required for the launch draw.

### Campaign framing
Do not lead with “giveaway.”
Working framing:
**Founding Domain Drops**
**3 domains. 15 builders. 1-in-5 odds per drop.**

Core copy:
**Build something real. Keep the source. Earn a spot in a 5-builder domain drop.**
Supporting copy:
**Every five verified beta builders unlock one domain drop. One of those five gets the featured 3-letter domain. Then the next drop opens.**

Use “short 3-letter domain” rather than exaggerated “rare” language unless rarity is objectively supportable.

### Why this is stronger
- high perceived win probability (20%)
- visible progress (“3/5 spots filled”)
- urgency without fake countdowns
- each domain creates a separate launch moment
- only 2–3 domains can produce 4–8 social posts / updates
- reward is tied directly to activation rather than traffic
- cohort cap limits freebie abuse and acquisition cost

### Reveal strategy
Do not necessarily expose the entire inventory at once.
Preferred:
- announce Drop #1 domain at launch
- when cohort #1 fills / winner is selected, reveal Drop #2
- save the most attractive giveaway domain for the final drop if possible
This creates repeated attention instead of spending all scarcity in one post.

### Guaranteed value for non-winners
All qualified builders should still receive a low-cost permanent Founding Builder marker/perk so completing the flow never feels wasted.
Possible low-cost perks:
- Founding Builder account badge/status
- priority access to new launch features
- small AI Actions credit when practical
- future beta perk
Do not promise expensive lifetime economics before pricing is proven.

### Public UI
Campaign module:
- featured domain
- “3 / 5 builder spots filled”
- exact qualification checklist
- current cohort status
- previous winner/claimed domain after each drop
- CTA: **Build & qualify**
Keep claimed domains visible as social proof.

### Winner selection trust
For each 5-person cohort:
- freeze the five qualified entry IDs
- draw once using a documented random method
- publish the winner and the completed cohort result
- do not redraw unless the selected entry is ineligible under pre-published rules
No purchase requirement; publish short official eligibility/claim/renewal terms before the first random draw.

### Content sequence for 3 domains
1. teaser: “We saved 3 short domains for the first Webcanbe builders.”
2. launch: Drop #1 + product demo
3. progress: “3/5 spots filled”
4. Drop #1 winner + project/share card
5. reveal Drop #2
6. Drop #2 winner
7. final-domain reveal (strongest domain if strategically appropriate)
8. final winner + campaign recap / product metrics
Thus 3 domains create multiple authentic content moments.

### PostHog experiment
Campaign property: `campaign=founding_domain_drop`.
Track:
- domain_drop_view
- domain_drop_cta_clicked
- signup_completed
- materialize_completed
- first_edit_saved
- export_completed
- domain_qualified
- domain_draw_entered
- domain_won
- domain_share_clicked

Primary metrics:
- campaign visitor → qualified builder
- signup → qualified builder
- cost per qualified builder
- later qualified builder → paid conversion
- campaign vs non-campaign activation
Do not judge campaign by raw signups.

### Kill/expand rules
- If domain traffic signs up but does not edit/export: stop or tighten message/qualification.
- If 2–3 domain cohorts fill quickly and qualified activation is materially better than ordinary traffic: buy more only then.
- If campaign attracts mostly domain hunters with no retention/product interest: do not scale even if signup count looks good.


## 23. Domain campaign v3 — premium-domain UGC/referral strategy — 2026-09-22

User proposed using one of the strongest domains previously intended to be kept (e.g. a headline-quality 3-letter domain) as a prize for people who publicly spread Webcanbe.

### Decision
This can be higher-leverage than giving every domain directly to users, but only if it is structured as a **Build + Share challenge**, not “say something nice about Webcanbe.”

### Hybrid allocation for a 2–3 domain budget
Recommended:
- **1 premium/headline domain** = acquisition/UGC grand prize.
- **1–2 mid-tier domains** = activation micro-drops tied to completing the product core flow.
This gives each scarce domain a different job:
- premium domain buys reach and user-generated launch content;
- mid-tier domains buy product activation and completion.

### Premium-domain challenge
Working framing: **Founding Builder Challenge** / **3-Letter Domain Challenge**.

Eligibility:
1. use Webcanbe and complete the real core flow (project/materialize → edit/save → export);
2. publish one original post/video showing what they actually built or did with Webcanbe;
3. tag @Webcanbe and clearly state that the post is an entry for the Webcanbe domain contest;
4. one entry per real person/account; no duplicate-post spam or multi-account entries.

Do **not** require positive praise, a 5-star review, or specific complimentary language. Require authentic demonstration/content, not endorsement copy.

### Solve “I probably won’t win”
Cap the cohort rather than running an unlimited raffle.
Recommended first premium-domain test:
- **first 10 verified Build + Share entries**
- exactly one premium-domain winner
- displayed maximum odds: **1 in 10**
- close when 10 valid entries fill or at a predeclared deadline; if the deadline arrives first, draw from the valid entries under the published rules
- show live `N / 10 qualified posts` progress

Alternative if participation is weak: cap at 5 for a 20% chance, but only when the prize economics justify it.

### Do not choose by likes/views
Likes and views are bot-able and heavily favor pre-existing audience size.
The domain draw should remain one verified entry per person.
Track referrals separately and reward them with low-cost product credit / AI Actions / status rather than extra scarce-domain entries.

### Launch UI
Headline example:
**Build it. Share it. Win [domain].**
Supporting:
**The first 10 verified builders who ship a real Webcanbe project and share what they built enter a capped 1-in-10 domain drop.**

Show:
- headline domain card
- current `N / 10` qualified posts
- qualification checklist
- real submitted posts as they arrive
- eventual winner + project
- official terms link

### Distribution loop
- Webcanbe launch post reveals the premium domain and real product demo.
- entrants create distributed UGC instead of simply reposting the same ad.
- Webcanbe quotes/highlights strong entries during the campaign.
- when the cohort fills, publish the frozen entry list and draw/result.
- winner reveal includes the actual project/content, returning attention to Webcanbe rather than to the prize alone.

### Measurement
PostHog campaign/referral properties:
- campaign=founding_builder_domain
- entry_source / creator handle or referral code where appropriate
- build_share_view
- build_share_cta
- qualified_core_flow
- qualifying_post_submitted
- qualifying_post_verified
- referral_visit
- referral_signup
- referral_materialize
- referral_export
- winner_selected

Primary business metric is **cost per qualified activated user / referred activated user**, not number of posts or likes.

### Disclosure / platform-operating requirement
Because entry offers a chance to win something of value in exchange for a public post, treat the post as incentivized. For U.S.-facing promotion, entrants should clearly disclose the contest relationship in the post itself, e.g. `Entry for @Webcanbe's #WebcanbeDomainContest`, rather than hiding it. X allows post/tag/hashtag-based contests but advises against multiple-account entries and duplicate-post mechanics. Publish short official rules before launch.


## 24. Founding Domain Drops v4 — scale beyond 10 entrants with only 2–3 domains — 2026-09-22

The user correctly rejected a 10-person cap as too small for acquisition. Revised strategy: keep the prize inventory tiny while allowing **50–100+ qualified builders** by using milestone draws and cumulative eligibility rather than a single tiny cohort.

### Recommended 3-domain structure
Use three escalating milestones:
- **Drop #1 at 20 qualified builders** — mid-tier 3-letter domain
- **Drop #2 at 50 qualified builders** — stronger 3-letter domain
- **Grand Drop at 100 qualified builders** — strongest/premium domain

A “qualified builder” is not a signup. They must:
1. create/materialize a real Webcanbe project,
2. complete an accepted edit + durable save,
3. export the source,
4. publish one original post/demo showing what they built and tag @Webcanbe,
5. submit/verify that post.

### Early-entry advantage without fake scarcity
Eligibility is cumulative:
- Builders 1–20 are eligible for Drops #1, #2 and Grand Drop if they have not already won.
- Builders 21–50 are eligible for Drop #2 and Grand Drop.
- Builders 51–100 are eligible for Grand Drop.
- A winner exits later domain draws.

This makes joining early genuinely more valuable while still allowing up to 100 qualified builders from only three domains. Do not advertise misleading single-draw odds; show milestone sizes and current progress honestly.

### Viral loop
Every qualified builder receives one base entry for the draws they are eligible for.
Optionally add referral boosts:
- +1 extra entry when a referred person becomes a **qualified builder**, not merely when they click/signup.
- cap referral bonus entries at +2 or +3 per person.
- never award extra entries for likes, repost counts or raw impressions.
This makes entrants recruit real activated users rather than spam social engagement.

### Campaign UI
Show:
- current progress: `37 / 50 builders`
- next unlock: featured domain
- later locked milestone: `Grand Drop unlocks at 100 builders`
- each verified builder entry / project card when permission allows
- previous winners and claimed domains remain visible
- CTA: **Build, share, qualify**

### Suggested public framing
Headline:
**100 builders. 3 domain drops. Build early, get more shots.**

Supporting:
**Ship a real Webcanbe project, export the source, and share what you built. Domain drops unlock at 20, 50 and 100 verified builders. Early builders stay eligible for later drops until they win.**

This avoids the “I probably won't win” problem by making early participation materially improve opportunity without pretending the overall entrant pool is smaller than it is.

### If only 2 domains are available
Use:
- Drop #1 at **25 qualified builders**
- Grand Drop at **75 qualified builders**
Builders 1–25 are eligible for both; builders 26–75 for the grand drop.

### If the campaign stalls
Do not fake progress or lower the published threshold silently.
Pre-publish a deadline clause:
- each unlocked milestone draws normally;
- if the campaign reaches the deadline before the next milestone, either extend transparently or run the final draw among all valid qualified entries only if that fallback was stated in the rules from the start.

### Measurement
Primary success metric remains **qualified activated users and referred qualified users per domain-dollar**, not total signups or post count.
Track cohort position, milestone eligibility, referral-qualified count and later retention/purchase in PostHog.


## 24. Founding Domain Drop v4 — uncapped-until-trigger launch mechanic — 2026-09-22

User does not want an obviously tiny fixed cap such as 10 participants or a large arbitrary cap such as 100. Preferred structure: **the pool is numerically uncapped until a real participation threshold triggers a short final window**.

### Recommended mechanic: Threshold → Final Window
- Entry pool has **no published numeric maximum**.
- A user qualifies only after real product activation + one original public Build/Share post.
- When the campaign reaches a predetermined number of verified qualified builders, a **48-hour final-entry window** automatically begins.
- Anyone who qualifies before that final window ends is eligible.
- Therefore the pool is theoretically open-ended, but the campaign still converges and gains urgency.
- Recommended initial trigger: **25 qualified builders**. If launch traffic is stronger than expected, use 40–50 in later drops; do not start at 100 simply to look large.
- Public progress copy before trigger: “17 builders qualified · Final 48h unlocks at 25.”
- After trigger: “Final 48 hours are live · all verified builders who qualify before the timer ends enter.”

This avoids the weak psychology of “1 of 1,000” while avoiding an artificially tiny 10-person cap.

### Prize architecture for only 2–3 domains
Use different prizes for different growth jobs:
- **Premium headline domain:** Grand Draw among all verified qualified builders before close.
- **Mid-tier domain #1:** Best Build award, judged on a published simple rubric (real use, quality, originality, not follower count).
- **Mid-tier domain #2, if available:** Growth award for the entrant who drives the most **new qualified builders**, not clicks/likes/follows.

This creates three paths:
1. everyone has a chance,
2. strong builders can win on merit,
3. strong distributors can win by bringing real activated users.

### Entry / ticket system
Base eligibility:
signup/login → project/materialize → accepted edit → durable save → export → original public Build/Share post tagging Webcanbe.

For the random Grand Draw:
- every qualified builder gets **1 base entry**
- optional referral bonuses can add entries only when a referred person becomes a **qualified builder**, not merely visits/signs up
- cap referral bonus per person (e.g. +3) so one influencer cannot dominate the draw
- do not grant extra entries for duplicate posts, likes, or spammy tagging

### Strong public framing
Working campaign name: **Webcanbe Founding Builder Drop**.

Headline:
**Build something real. Share what you built. The final 48 hours unlock when 25 builders qualify.**

Prize reveal:
**One of the founding builders takes [premium-domain].**

Before trigger, emphasize progress rather than odds:
- “17 / 25 builders until Final 48”
- “8 builders until the final window opens”
After trigger, emphasize time:
- “Final 48h”
- “Final 24h”
- “Last 6h”

Do not promise a fixed probability because the final pool size remains open.

### Why this mechanic is preferred
- no arbitrary hard cap
- still has a concrete convergence mechanism
- participation itself accelerates the campaign toward its deadline
- progress updates create multiple authentic social posts
- no need to buy a large domain inventory
- the premium domain acts as acquisition media; mid-tier domains drive product quality/referrals
- PostHog can distinguish freebie traffic from qualified activation

### Safety against a weak launch
If 25 qualified builders are not reached by a separately published calendar fallback date, start the final window anyway. This prevents an indefinitely open campaign and avoids showing a stalled counter forever.


## 25. Customer growth engine — Webcanbe Build League + Prize Vault — 2026-09-22

Founder clarified:
- developer/seller acquisition can be handled separately through direct outreach (roughly 100-target style outreach);
- the scarce-domain campaign should primarily solve **customer demand / buyer awareness**;
- the campaign should not die after one small cohort; it needs to create reusable traffic, UGC, referrals, activation data, SEO/share assets and seller-facing proof.

### Core system
Working name: **Webcanbe Build League**.
This is an always-on customer growth loop, not a one-off giveaway.

Flow:
1. user starts from a real Webcanbe template/project;
2. materially customizes it;
3. saves/exports or publishes the real result;
4. posts the finished result publicly on any accepted platform;
5. includes the finished project link and tags/mentions Webcanbe or the campaign;
6. submits the public post URL to Webcanbe;
7. Webcanbe verifies the product flow + post and creates a gallery/leaderboard entry;
8. entrant receives a referral link so Webcanbe can attribute downstream qualified users.

### Two-layer reward architecture

#### A. Permanent seasonal layer
Keep the League running continuously in short seasons (weekly/biweekly highlights + monthly resets):
- Random Builder reward: fair chance for every verified builder.
- Breakout/Impact reward: based primarily on **verified referred Webcanbe traffic and qualified referred builders**, not raw social views.
- Best Build reward: based on published quality/originality rubric, not follower size.
- regular rewards should be low marginal-cost: bounded AI Actions, temporary Pro/features, Founding/Builder status, gallery spotlight, future beta perks.

This makes the campaign sustainable after premium domains are gone.

#### B. One-time cumulative Prize Vault
The strongest domains are fixed headline milestone prizes rather than being spent all at once.
Current preferred headline candidates: **may.cx, she.cx, way.bz** (subject to final availability/purchase).

Use cumulative verified-builder milestones. Initial working ladder:
- first premium domain unlock around **25 qualified builders**
- second around **75–100**
- third around **200–250**
Final thresholds should be chosen after launch velocity is observed; only the next reachable unlock needs heavy public emphasis.

The important mechanic:
- there is **no fixed participation cap**;
- premium domains unlock as the community grows;
- the ordinary League continues after each unlock and after all premium domains are eventually awarded.

### Participation-scaled prize pool
The non-domain prize pool can grow automatically with verified participation.
Example principle:
- every block of qualified builders unlocks more bounded AI Action credit / temporary feature access / extra spotlight reward.
- public copy can truthfully say **“The prize pool grows as more builders qualify.”**
- never promise an unbounded cash-cost liability; the growth formula must be bounded and based on low marginal-cost product rewards.

### Judging: do not use raw views as the sole winner metric
Raw views are useful as marketing telemetry but are a poor primary prize rule because they are easy to game and strongly favor existing audience size.
Preferred three-path system:
1. **Random Draw** — every verified builder has a real chance.
2. **Impact Leaderboard** — measured from attributed unique visits and, much more importantly, referred users who become qualified builders.
3. **Best Build** — quality/originality/use of Webcanbe under a simple published rubric.

Views can be shown as a secondary leaderboard / signal, but should not solely decide a premium prize.

### External-first distribution
The Webcanbe site is the canonical verification/rules/gallery layer, but discovery should happen mostly outside it.
Accept original build posts from channels such as:
- X
- TikTok
- Instagram Reels
- YouTube / Shorts
- other public social/community posts where promotion is permitted
The entrant should post their **actual finished project**, not generic praise.

Core content prompt:
**Start with a Webcanbe project. Make it yours. Put it live. Show the result.**

### Compounding assets even if the campaign does not go viral
Every verified entry should produce:
- one external UGC post;
- one public Webcanbe gallery/showcase card/page;
- one attributable referral path;
- one activated user record;
- one project example usable (with permission) in later launch content;
- aggregate demand data by country/referrer/channel/template.

This makes the campaign valuable even if it does not “go viral.”

### Seller-facing proof
Do not pitch sellers raw vanity traffic alone.
Use truthful metrics such as:
- qualified buyer visitors
- countries
- project-view → materialize conversion
- edit/export completion
- return rate
- later purchase conversion
- fastest-growing template categories
- number of verified public builds / UGC posts
Raw visits may be included, but qualified demand and conversion are the stronger seller pitch.

### “Guaranteed virality” principle
No campaign can guarantee that Webcanbe will go viral.
Design the system so that every outcome produces a next asset:
- weak reach → learn channel/message;
- good reach / weak activation → fix landing/offer;
- good activation / weak sharing → improve sharing mechanic;
- good sharing / weak referral activation → improve referral audience/offer;
- strong qualified referral loop → scale aggressively.

### Platform-operating note
X officially permits post/mention/hashtag contests but discourages multi-account and duplicate-post mechanics. YouTube contests require free entry and prohibit manipulating platform metrics. Therefore the League should use one original entry per person and should not reward repeated spam or view/like manipulation.


## 26. FINAL customer campaign — Build League + Founding Prize Vault — 2026-09-22

This supersedes the earlier small-cohort domain-drop variants.

### Objective
Seller/developer acquisition is handled separately by direct outreach. This campaign is specifically for **customer acquisition, activation, UGC, referral traffic, demand proof and reusable marketplace proof**.

### Permanent campaign
Name: **Webcanbe Build League**.
It is always-on and divided into short seasons (default: 14 days) so the leaderboard can reset while cumulative community progress never resets.

Qualified entry:
1. start from a real Webcanbe project/template;
2. materially customize it;
3. save/export or publish the result;
4. publish one original public post/video showing the finished result on an accepted public platform;
5. include the live project/result link and a Webcanbe mention/link;
6. submit the public post URL to Webcanbe for verification.

One person may submit multiple builds across time, but cap leaderboard-eligible submissions per season to prevent spam.

### Three competition lanes
1. **Most Viewed / Reach** — highest verified organic public-view count at the season/milestone close. Obvious bought/bot/manipulated traffic is disqualified under published rules. Views are allowed as a real competition category.
2. **Random Builder Draw** — every verified builder gets a real chance, so small accounts still care.
3. **Impact / Referral** — highest number of attributed referred users who themselves become qualified Webcanbe builders. This is the most business-relevant lane.

If only two premium domains are purchased, use Most Viewed + Random or Impact depending launch priorities. If three are purchased, use all three lanes.

### Founding Prize Vault
The campaign has **no participant cap**. Rewards grow with cumulative verified builders.

Premium headline candidates: **may.cx, she.cx, way.bz** subject to actual purchase/availability.

Working cumulative unlock ladder:
- **25 verified builders** → first premium domain unlock
- **100 verified builders** → second premium domain unlock
- **250 verified builders** → third premium domain unlock

Reaching a milestone unlocks the domain; it does not close the League. Use a short declared final window for the domain award while the permanent League continues.

The ordinary prize pool scales with participation using low-marginal-cost Webcanbe rewards:
- bounded AI Actions
- temporary Pro/features where appropriate
- gallery/official account spotlight
- Founding Builder / League status
- future beta perks

Public message:
**The more builders join, the bigger the Prize Vault gets.**

### Retention system
The campaign must leave a reason to return after the first post.

1. **14-day seasons**
   - seasonal leaderboard resets, so new users can still compete;
   - lifetime builder count / profile / cumulative vault progress never resets.

2. **Persistent Prize Vault**
   - old users remain invested in the next community unlock;
   - domain milestones are Founding-era prizes only; the League continues after domains are gone.

3. **Weekly build prompt / featured challenge**
   - fresh reason to create another project;
   - low-cost reward = AI Actions + official feature/spotlight.

4. **Referral residual**
   - old users continue earning bounded AI Actions / League points when a referred person becomes a qualified builder;
   - reward qualified activation, not raw clicks.

5. **Public Build Gallery**
   - every verified build becomes a durable Webcanbe showcase entry with consent;
   - user receives a persistent public artifact/profile rather than a one-day contest entry.

6. **Official highlights**
   - weekly “builds we liked” and season recap;
   - each strong user-generated build becomes future company marketing content.

7. **New supply loop**
   - as seller outreach brings new projects/templates, returning customers receive new material to remix/build with.
   - this is the bridge from campaign retention into marketplace retention.

### Anti-fraud for view-based prizes
Publish a short rule:
- manipulated/bought/bot views, fake accounts, duplicate spam, or unverifiable analytics can be disqualified;
- Webcanbe may request platform analytics evidence for finalists;
- one real person/account per identity for prize eligibility.
This allows a real Most Viewed category without treating raw view counts as automatically trustworthy.

### PostHog business measurement
Track campaign → signup → materialize → edit/save → export → public-post submission → referral visit → referred qualified builder → return build.
Primary metrics:
- cost per qualified builder
- qualified builder D7/D14 return
- builds per qualified user
- UGC posts created
- referred qualified builders per entrant
- later purchase conversion
- seller-facing qualified-demand metrics

### Strategic fallback
Even without breakout virality, the system should leave:
- activated customers
- public UGC
- gallery/showcase inventory
- attributable referral paths
- country/channel/template demand data
- retention data
- seller-facing demand proof

Do not let the campaign end as “50 participants and then nothing.” The rare domains are launch accelerants inside a permanent League, not the League itself.
