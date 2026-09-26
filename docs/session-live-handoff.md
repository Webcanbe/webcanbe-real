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


## 27. Tonight execution plan — 2026-09-22

If the final production core-flow smoke passes tonight, immediately switch from product work to market entry.

Order:
1. finish only true launch blockers;
2. verify real production core flow end-to-end;
3. attach PostHog launch funnel events;
4. publish the first public beta announcement;
5. prepare the first Build League / Prize Vault campaign asset and landing module;
6. start customer acquisition tonight rather than reopening noncritical product polish.

Do not merge or build extra polish merely because time remains. Once the launch gate passes, market learning becomes the highest-value work.


## 27. 2026-09-23 overnight execution plan — launch + market entry

User is staying home from school on 2026-09-23 because they feel somewhat unwell and expects to have more time tonight. Treat this as extra execution time, not an excuse for uncontrolled polishing or exhaustion.

### Tonight priority order
1. **Final UI/UX pass — hard cap: 60 minutes**
   - only obvious trust/clarity/flow problems
   - no redesigns, no new feature branches
   - anything non-blocking goes to backlog
2. **Real production core-flow acceptance**
   - login
   - real project/materialize
   - Visual edit/save
   - reload/reopen
   - Code edit/save
   - export
   - independent build
3. **PostHog launch instrumentation**
   - minimal funnel events only
   - no analytics overbuilding
4. **Public launch surface**
   - truthful beta messaging
   - flagship project/demo
   - support/contact path
5. **Start customer acquisition immediately**
   - first launch posts / Build League announcement assets
   - begin external distribution rather than returning to product polish
6. **Seller/developer outreach remains separate**
   - direct targeted outreach can continue after customer-side launch begins

### Discipline
- After the 60-minute UI/UX cap, do not reopen cosmetic work unless a real user-flow blocker is found.
- The highest-value outcome tonight is not “more complete code”; it is **Webcanbe being publicly usable and beginning to collect real market evidence**.
- Because the user feels somewhat unwell, judge continuation by output quality. If quality collapses, stop low-value work rather than forcing hours of bad decisions.


## 27. 2026-09-23 overnight launch execution plan

Context:
- User can work later tonight because they are not going to school tomorrow and expects enough uninterrupted time to reach marketing.
- User wants **exactly ~1 hour** for final UI/UX polish, then no more open-ended product polishing.
- Basic technical/product work is considered covered inside that final UI/UX block; do not turn the night back into another feature-building session.

### Tonight's order
1. **60 min hard-cap: final UI/UX pass**
   - only obvious friction, broken states, clarity, mobile/desktop launch-facing rough edges
   - no new features
   - no architecture changes
   - anything non-blocking goes to backlog when the hour ends

2. **Core production acceptance**
   - real login
   - working copy/materialize
   - Visual edit/save
   - reopen/reload
   - Code edit/save
   - export
   - independent build
   - if this passes, treat the product as ready for free/limited public beta

3. **PostHog minimum instrumentation**
   - landing / signup / materialize / edit-save / export
   - do not delay launch for analytics perfection

4. **Launch assets**
   - one short real product demo
   - one concise launch post
   - one clear landing CTA
   - optional Founding Build League teaser only if it is ready enough to be truthful

5. **Marketing begins the same night**
   - publish first launch content
   - start measuring actual traffic and activation
   - no returning to cosmetic polish unless real users expose a blocker

### Motivation rule
Use external skepticism as energy, not as the decision-maker.
- Do not argue with family about whether the project is important.
- Convert the feeling into measurable proof: shipped product, external users, activation, revenue, retention.
- The strongest answer is not “I told you so”; it is a product that real people choose to use.


## 27. First marketing strategy assessment + probability update — 2026-09-23

### First marketing strategy assessment
Current first customer-acquisition strategy is the always-on **Webcanbe Build League + Founding Prize Vault**:
- users build/customize/export a real Webcanbe project;
- publish the finished result externally;
- Webcanbe tracks/validates the entry and referral path;
- rewards scale with participation;
- headline domain rewards (preferred candidates include may.cx / she.cx / way.bz) are milestone accelerants;
- competition lanes include Most Viewed, Random Builder and Impact/referral;
- seasons reset while cumulative community progress, gallery and prize-vault progress persist.

Judgment before launch data:
- This is **more likely to produce initial qualified traffic and UGC than a generic “we launched” post**, because the reward is tied to real product use and external distribution.
- It is **not yet proven as a durable acquisition engine**.
- Main risks: no initial distribution seed, excessive qualification friction, domain hunters with weak product intent, the prize overshadowing the product, and weak D7/D14 return after the first build.
- Treat the first 20–50 qualified participants as the validation cohort. Success means strong signup→materialize→edit/export conversion plus meaningful return/referral behavior, not raw reach alone.

### 24-month KRW 1T tracker
Target unchanged: within roughly 24 months, Webcanbe becomes a credibly KRW 1T+ company backed by real customers, recognized revenue/marketplace economics, growth and retention.

- Original baseline: **0.0500%**
- Previous estimate: **0.0522%**
- Current estimate: **0.0523%**
- Change vs original: **+0.0023 percentage points**, about **+4.6% relative**
- Change vs previous: **+0.0001 percentage points**, about **+0.19% relative**

Reason for only a tiny increase:
- launch/marketing execution system is clearer and more measurable;
- payment diagnostic merged and overnight launch plan is recorded;
- no new real external-user traction, revenue, retention, GMV, CAC or referral-loop evidence exists yet;
- authenticated production core-flow acceptance remains the main launch proof gap in stored evidence.

Do not materially move this estimate again for plans, polish, or internal implementation alone. Next meaningful move should come from actual market data.


## 28. Master plan after public beta — 2026-09-23

This is the overall operating plan beyond finishing code.

### Phase 1 — Launch + first real market evidence (now → first 2 weeks)
Objective: prove strangers can discover, activate, and finish the core Webcanbe loop.
- Public beta stays live and truthful.
- PostHog tracks visitor → signup → project/materialize → edit/save → reopen/export → purchase.
- Customer acquisition starts with Build League + Founding Prize Vault and external build-sharing.
- Seller/developer acquisition is separate: targeted direct outreach, roughly 100 high-fit creators/developers as the first serious supply campaign.
- Keep 1–3 excellent flagship projects rather than waiting for broad inventory.
- Founder/product work only fixes measured blockers; cosmetic backlog waits.
Primary proof: first external core-flow completions, first paid buyer, first repeat/returning user, first seller interest/submission.

### Phase 2 — Find the strongest wedge (weeks 2–8)
Objective: identify where Webcanbe has the strongest pull.
Measure by segment, channel and project category:
- visitor → signup
- signup → materialize
- materialize → edit/save
- edit → export
- export → pay
- D7 / D14 return
- referral-qualified builders
- seller submission → published → first sale
Cut weak channels/messages quickly.
If users love one part more than the full marketplace (e.g. source-owned workspace, visual+code editor, specific project categories), lean into the evidence.
Do not preserve the original product shape at the expense of traction.

### Phase 3 — PMF evidence + repeatable acquisition (months 2–6)
Objective: turn one-off interest into repeatable behavior.
Need:
- growing paid-buyer count
- repeat purchase / retention
- seller first-sale and seller retention
- measurable marketplace liquidity
- at least one repeatable acquisition channel
- improving CAC / organic share
- contribution-margin visibility
Build only what improves these metrics.
Introduce stronger seller tools, buyer retention loops, referral incentives, new high-performing categories, and paid acquisition only after organic activation is proven.

### Phase 4 — Scale the marketplace + software revenue (months 6–12)
Objective: compound both sides.
- increase high-quality creator supply
- expand buyer demand and repeat usage
- strengthen seller-led distribution
- add software revenue around marketplace activity where users prove demand: AI, collaboration, deployment, team workflows, subscriptions, etc.
- improve international distribution and localization only where data supports it
- hire only when a bottleneck cannot be solved efficiently by the founder/automation
Primary metrics: GMV, recognized revenue, take rate, paid cohorts, retention, seller liquidity, contribution margin, organic/referral share, growth durability.

### Phase 5 — Hypergrowth attempt (months 12–24)
Objective: pursue the extreme KRW 1T target only if the evidence supports a hypergrowth path.
- double down on the strongest market/category/channel
- expand internationally
- deepen network effects and product moat
- increase supply and demand density
- consider institutional capital only if it materially accelerates an already-proven engine
- keep founder equity/control high unless dilution clearly increases expected outcome
If the current model cannot plausibly compound fast enough, pivot the product/business shape while preserving the larger goal.

### Decision discipline
- No major strategy change from one bad comment.
- Repeated qualified-user behavior beats founder preference.
- New unrelated businesses go to a parking lot unless Webcanbe evidence justifies replacing the main goal.
- Product work must map to acquisition, activation, retention, monetization, seller liquidity, trust/security, or measured conversion.
- Track the 24-month KRW 1T probability from the fixed 0.0500% baseline; move it materially only with real market evidence.

### Milestone ladder
1. public beta live
2. first external full core-flow completion
3. first genuine paid buyer
4. second independent paid buyer / first repeat buyer
5. first Creator earns money
6. first KRW 1M cumulative recognized company revenue
7. first KRW 10M
8. first KRW 100M
9. repeatable channel + PMF-grade retention
10. sustained multi-month compounding growth

The plan is not “finish code, then think about business.” From this point, the company is managed by market evidence.


## 29. 2026-09-23 morning transition — product closure → business execution

User confirmed:
- Public launch is complete.
- The remaining UI/UX and legal-document cleanup gets a **hard 30-minute cap**.
- After that cap, Webcanbe moves fully into business execution.

### 30-minute closure rule
Only finish:
- obvious launch-facing UI/UX defects or confusing copy;
- legal footer/page integration needed for a truthful public site;
- any broken links or missing legal-page wiring;
- no new features, redesigns, architecture work, or speculative polish.

Anything non-blocking after the 30-minute cutoff goes to backlog.

### Immediate business phase after cutoff
1. Verify PostHog launch funnel is receiving real events.
2. Publish / distribute the first customer-acquisition content.
3. Launch the minimal Build League / Prize Vault campaign surface.
4. Start separate seller/developer outreach.
5. Record first real visitor, signup, materialize, edit/save, export, referral and purchase evidence.
6. Let market data determine the next product work.

Operating principle from this point:
**Market evidence outranks internal polish.**


## 30. 2026-09-23 operating plan — first full business day after launch

Context:
- Public launch is complete.
- User plans to go to the hospital around 09:00 KST.
- Remaining UI/UX + legal integration is capped at 30 minutes total; after that, market work outranks product polish.

### Today — first business execution day
Before hospital / immediately after return:
1. finish the 30-minute closure block only;
2. verify PostHog receives production events;
3. freeze product-polish backlog.

Business blocks after return:
- **Launch distribution block:** publish the first strong Webcanbe launch/demo post and distribute to the highest-fit channels.
- **Build League block:** ship the minimum public campaign surface (rules, prize-vault framing, submission path, referral attribution); manual verification is acceptable initially.
- **Seller supply block:** start a focused first batch of creator/developer outreach; do not wait for a perfect creator program.
- **Measurement block:** record visitor → signup → materialize → edit/save → export → purchase; separate internal/test traffic from real external users.
- **Daily review:** identify one measurable bottleneck and make only the product change that attacks it.

### First 14 days
Goal: prove real strangers can discover, activate, finish the core flow and show early return/payment behavior.
Key evidence:
- first external full-flow completions
- first genuine paid buyer
- second independent buyer / first repeat buyer
- first creator submission / creator revenue signal
- D1/D7 return
- channel-by-channel activation
- Build League UGC and referral-qualified users

### 2–8 weeks
Goal: find the strongest wedge.
Measure segment/category/channel conversion and cut weak messages quickly.
Preserve the large-company goal, not the exact current product shape.
Potential wedges to test if evidence supports them:
- source-owned web project marketplace
- visual + code editing workspace
- a specific high-pull category
- creator-led distribution
- AI/source ownership workflow

### Months 2–6
Goal: PMF evidence + repeatable acquisition.
Need meaningful growth in:
- paid buyers / recognized revenue
- repeat purchase and retention
- seller first-sale / seller retention
- marketplace liquidity
- organic/referral share
- CAC and contribution margin
- multi-week growth durability

### Months 6–12
Goal: scale the winning loop.
Increase supply quality, buyer demand and repeat usage; add higher-margin software revenue only where usage proves it (AI, collaboration, deployment, teams, subscriptions).
Hire only for proven bottlenecks.

### Months 12–24
Goal: attempt hypergrowth toward the KRW 1T outcome if evidence supports it.
Double down on the strongest category/channel, deepen network effects and product moat, expand internationally, and consider capital only if it accelerates a proven engine.
If the current shape cannot compound fast enough, change the shape rather than lower the ambition automatically.

### If Webcanbe reaches ~KRW 1T credibly
Do not default to selling the company or maximizing salary.
Evaluate:
- growth rate and future expected value
- founder concentration risk and control
- strategic acquisition offers
- small founder secondary for personal liquidity
- taxes / cross-border structure
- whether Webcanbe remains the best vehicle for the next 10x
Use independent CFO/strategic finance, M&A counsel/advisor and tax professionals before major liquidity decisions.

### Beyond the 1T milestone
If growth remains exceptional, continue compounding toward multi-trillion scale rather than treating 1T as the finish line.
Founder personal-brand strategy only follows genuine business proof:
- company brand remains product-first and separate;
- personal media becomes entertainment/personality/IRL-first, with business as one axis rather than “young CEO advice” content;
- leverage real success for global network, U.S. relocation options, partnerships and long-term new ventures without abandoning the engine prematurely.

### Operating rule
From launch onward, market evidence outranks internal polish.
Every week must improve at least one of acquisition, activation, retention, monetization, seller liquidity or trust.


## 31. Restored original master strategy — 2026-09-23

User explicitly chose to return to the earlier full Webcanbe business simulation as the long-term master strategy.

Recovered source: the 2026-09-13 strategy memo whose central thesis was:
**Webcanbe is not merely a code marketplace and not an AI website builder. It should become the ecosystem where people buy already-built software, turn it into their own product, operate it, extend it, and keep evolving it.**

### Original category / market position
The intended category is:
- not ThemeForest with better templates;
- not a smaller Lovable/Replit-style prompt builder;
- not only a design-asset marketplace;
- a **software capability marketplace + operating ecosystem**;
- the category statement: **“a market where complete software is bought, evolved, and operated.”**

Original customer promise:
**Start at 80%, not 0%.**
A user starts from a 70–90% complete real product, then modifies and launches it.

### Original strategic ladder
1. Initial wedge: freelancers and small agencies because they can be repeat buyers and also become sellers.
2. Project Marketplace as customer-acquisition layer.
3. Workspace: real source + Visual editing + Code + AI + preview/versioning/export/deploy.
4. Project Care: ongoing dependency/security/update/health/backup/rollback service.
5. AI-assisted upstream merge: preserve customer changes while merging Creator updates.
6. Feature Marketplace: installable capabilities such as billing, teams, admin, RBAC, booking, CMS, etc.
7. Creator Updates & Support subscriptions, turning one-off project sales into creator ARR.
8. Expert services attached to the live code context.
9. Payments as a later, very large revenue layer around economic activity of businesses built on Webcanbe.
10. Creator-led distribution / referral growth.
11. Try-before-buy temporary workspace / live product trial.
12. Remix economy with explicit remix licenses, lineage and upstream royalties.
13. Inventory-driven SEO based on real project capabilities, not generic AI blog content.
14. Search by software capability rather than only visual category.
15. Enterprise / private marketplace / security / SLA layer at scale.

### Original flywheel
Projects → buyers → Workspace usage → modules/updates/care → more value per project → more buyers → more creators/modules → stronger marketplace → more external distribution → more projects.

### Original mature revenue mix illustration
- ~30–35% Workspace subscriptions + AI usage
- ~20–25% Project Care / managed deploy / runtime
- ~15–20% Project + Feature Marketplace fees
- ~10–15% Payments
- ~5–10% Expert services
- remainder Enterprise / private marketplace / security / SLA

### Original scale simulation
Illustrative mature monthly revenue structure:
- 200k paid Workspaces × ~KRW 90k average = **KRW 18B/month (180억)**
- 200k production projects × ~KRW 60k average care/runtime = **KRW 12B/month (120억)**
- Marketplace/modules monthly GMV KRW 100B × 10% blended take = **KRW 10B/month (100억)**
- business payment volume KRW 1.4T/month × 0.5% = **KRW 7B/month (70억)**
- 300 enterprise customers × KRW 10M/month = **KRW 3B/month (30억)**
Total illustrative mature revenue: **KRW 50B/month (500억)**.

This was an economic reverse-build illustration, not a forecast.

### Current operating interpretation
Adopt the strategic architecture above as the long-term North Star again.
Do not immediately rebuild everything. Current launch remains the entry point:
Marketplace → real project → real-code Workspace → external users → market evidence.
Then add Care, modules, creator ARR, experts, payments, remix and enterprise in the order actual demand justifies.

Current public launch pricing/fees/legal commitments remain the operational source of truth until explicitly changed; restoring this strategy does not silently rewrite existing contracts or production economics.


## 31. Restored original post-success simulation / positioning — 2026-09-23

User explicitly wants to restore and preserve the earliest post-success simulation as the default long-term success scenario.

### Original upper-bound life/company simulation (historical plan, not a prediction)
- Around age 15: after Webcanbe has genuinely succeeded enough to justify it, move with parents to the Santa Clara / Silicon Valley area; family remains close but can live independently nearby.
- Around age 16: enter high-level U.S. accelerator/investor networks; the early simulation used an illustrative ~$3M investment milestone.
- Around age 17: become known publicly as a globally notable teenage founder.
- Around age 19: illustrative unicorn milestone (~$1.2B in the original simulation).
- Around age 23: illustrative U.S. public-market listing (~$18B in the original simulation).
- Around age 30: Webcanbe evolves into a global digital-project/software distribution ecosystem.

These ages/valuations are the original simulation markers, not forecasts or promises.

### Long-term company market position
The end-state is not merely a template marketplace or website builder.
Webcanbe should evolve toward:
- a global ecosystem / “app-store-like” distribution layer for real web projects, apps and AI-agent/software projects;
- software that lets AI- and human-created applications be verified, reused, edited visually/in code/with AI, deployed, handed off and maintained;
- a long-term **App Handoff & Lifecycle Platform** / software distribution-and-operations infrastructure.
The present marketplace/editor is the entry wedge; the exact product shape may change if evidence demands it.

### U.S. network position after real success
Build relationships first with:
- startup founders and independent founders;
- software/web/design-tool founders;
- developers, designers, agencies and marketplace participants;
- accelerators, investors and founder-operators.
The posture is peer/business context, not celebrity fan outreach.
If Webcanbe reaches sufficient stature, use common networks and real business context for access to top global technology figures; prior scenarios explicitly mentioned Sam Altman and Elon Musk as possible later-stage network contacts, not guaranteed meetings.

### Public/media position
The original scenario included U.S./global media potentially framing the founder as an unusually young global founder / “youngest billionaire”-type story if the underlying facts ever genuinely support that claim.
Potential surfaces after real proof:
- major Korean media;
- global business/technology media;
- mainstream Korean programs such as You Quiz-type appearances;
- creator collaborations;
- U.S. founder/investor media and events.

### Personal brand after business proof
Company and personal brand stay separate.
- Webcanbe: serious, product-first, global software company.
- Founder: **global major founder + mainstream entertainment creator**.
Avoid the stiff “young billionaire teaches success” / LinkedIn CEO-influencer identity.
Desired public reaction: **“The company is insane, but the person is fun too.”**
Business/wealth should be the background world, not the main content topic.

Working content mix from the later refined version of this same success path:
- 50% IRL / travel / friends / games / pure entertainment
- 20% entertainment using the business world as a setting
- 15% famous-person / creator collaborations
- 10% real company stories
- 5% money / luxury

Long-run aspiration is persistent mainstream fandom rather than only business notoriety; IShowSpeed-style durable attention was used as a reference for the level of cultural visibility, not for copying the persona.

### Family / personal-life part of the original simulation
If success supports it:
- move to the U.S. with mother and father nearby while preserving each person's independence;
- provide housing/living/medical/retirement support to parents;
- bring close Korean friends / cousin(s) to visit or potentially create legitimate internship/business opportunities;
- use wealth for family freedom rather than making conspicuous luxury the identity.

### Priority order
1. Real Webcanbe PMF and growth.
2. Credible large-company outcome.
3. U.S. move and founder network expansion.
4. Major media and peer-level high-profile relationships.
5. Mainstream personal creator/fandom layer.

Do not reverse this order: fame is an amplifier of real business proof, not a substitute for it.


## 32. Canonical original post-success simulation restored from user text — 2026-09-23

The user supplied the exact earlier success simulation and wants this preserved as the canonical long-run success scenario.

### Scenario premise
This is a **success-case simulation, not a forecast**. Its premise is that Webcanbe and its accounting are independently verified, the founder genuinely receives roughly KRW 400 billion/month in net personal cash flow, U.S. permanent residence is already approved, and the founder relocates to the U.S. with a guardian while still age 13.

### D+0 to D+30 narrative arc
- D+0: independent verification of founder identity, real cash flow, ownership, company/accounting evidence; skepticism first, then major Korean/global business-media attention.
- D+1–5: national Korean attention, first security/PR layer, selective interviews, You Quiz pre-interview, global business press starts treating age + verified performance as the core story.
- D+6–10: creator/entertainment appearances begin; the original scenario specifically included 말왕 and 유 퀴즈. Media framing shifts from “money” toward personality, contribution, family reaction, school and ordinary-life contrast.
- D+11–15: U.S. relocation is announced; Korea school status is handled through a legitimate overseas-move/education route; Bay Area housing/security/education is arranged; departure from ICN and arrival at SFO become major media moments.
- D+16–19: Silicon Valley company meetings, private founder/VC dinners, ordinary Bay Area public life, and the reversal of access begins — senior investors/founders start asking to meet the user rather than the user cold-contacting them.
- D+20: illustrative Sam Altman meeting through common connections, focused on whether future models commoditize the product and why Webcanbe should own code/workflow/customer/deployment layers.
- D+21–23: U.S. TV interview, introductions toward Elon Musk through peer networks, documentary/book proposals.
- D+24–25: Korean mainstream/creator appearances air and broaden recognition beyond business media.
- D+26–28: illustrative Musk meeting and, in the strongest version, a public photo/post that causes another global attention spike.
- D+29–30: fame becomes operationally relevant; Korea reaches near-national-name recognition while U.S. recognition is initially much stronger inside technology/finance than among the entire population. The decisive long-term branch is whether company growth keeps compounding.

### Core media / network thesis
The defining effect of extreme verified success is not luxury consumption but **the reversal of access**:
- media requests arrive inbound;
- founders/VCs/chiefs of staff coordinate with the user's team;
- high-profile meetings happen through peer/business context;
- the user chooses which opportunities to accept rather than searching for ways to get noticed.

### Founder positioning from this scenario
- Not “rich kid” or generic teenage prodigy.
- First: verified founder of a major global company.
- Then: unusually young founder story.
- Then: public personality / creator layer.
- Business credibility must remain the base; fame amplifies it rather than replacing it.

### U.S. positioning
Bay Area / Silicon Valley becomes the operational base because of company market, talent, investors and founder network.
The desired network position is peer-level access to:
- software founders
- AI/company leaders
- top VCs and founder-operators
- major tech/media figures
The original scenario specifically used Sam Altman and Elon Musk as illustrative later-stage meetings.

### Public-personality positioning
The personal brand should stay separate from Webcanbe.
Avoid “young billionaire teaches success” positioning.
Preferred identity:
**major global founder + entertaining, spontaneous, mainstream creator.**
Desired reaction remains:
**“The company is insane, but the person is fun too.”**

### Important interpretation
This scenario is intentionally an upper-success simulation. Specific media outlets, programs, people, dates, exact security arrangements, monthly cash flow and meeting sequences are not commitments or predictions. They are the user's preferred picture of what to do **if** the underlying success becomes real enough to make those events plausible.

Use this exact simulation as the default reference when the user later says “the original success simulation,” “the U.S. one,” “the Sam/Musk one,” or similar.


## 33. Continuity rule — MD is the primary persistent memory — 2026-09-23

User explicitly requires Webcanbe continuity to be written to Markdown as aggressively as practical.

Operating rule from now on:
- Do not rely on the assistant's conversational memory, hidden reasoning, or compressed chat context as the authoritative project state.
- For every meaningful Webcanbe session, first reconcile the current GitHub main/PR/workflow state, then read the latest relevant Markdown handoff.
- docs/session-live-handoff.md is the primary continuity document for current decisions, current phase, blockers, launch state, marketing state, and exact next actions.
- If chat context, memory summary, or an older handoff conflicts with current repository evidence, current repository evidence wins, and the handoff should be updated immediately.
- Record material decisions, completed milestones, blockers, changed assumptions, and exact next actions in Markdown before the session can be lost.
- Avoid relying on 'I remember' as a source of truth for Webcanbe. Persistent written state is preferred.
- When a long session advances significantly, append a fresh concise checkpoint even if older sections remain historically useful.
- Do not overwrite history blindly; mark superseded decisions explicitly.

Reason: the user has experienced long-chat context drift and wants continuity that survives chat failure or model/context changes.


## 34. Relearned canonical operating state — 2026-09-23 evening

This checkpoint reconciles the latest persistent handoff with current GitHub evidence after chat-context drift.

### Current source-of-truth order
1. Current GitHub main / open PRs / workflow evidence.
2. This live handoff.
3. Older handoffs and compressed chat memory only as historical context.

### Current phase
- Public launch is already recorded as complete.
- Webcanbe is no longer in the “finish the product before launch” phase.
- Primary operating phase is now **business execution / market evidence**.
- Product work should be limited to real-user blockers, trust/security issues, conversion blockers, or measured retention/monetization problems.

### Current product state inferred from latest main history
Latest product commit before continuity-only docs:
- `72d2e1028356aa7de187d45dc3a02ed4c7eae8b8` — production app asset versioning.

Recent merged product milestones immediately before it:
- production PostHog base connection and CSP allowance;
- PayPal runtime switched to Live defaults;
- one-command PayPal Live product/plan/webhook/secret bootstrap;
- atomic/version-aware PayPal Live secret publishing;
- truthful Marketplace demo when hosted catalog is empty;
- live checkout revalidation and checkout/return repair;
- coherent product shell + real Aperture North preview;
- first-party templates made editable;
- Stillform added and source images optimized for hosted editing;
- managed preview logging and longer cold-start allowance.

### Current verification picture
At product commit `72d2e102...`:
- Phase 5 UI verify: PASS.
- durable editor/export verify: PASS.
- Bigperson checkpoint verify: PASS.
- production smoke: PASS.
- browser compatibility smoke: FAIL, with evidence including a /browse load timeout, a slow cancelled-checkout DCL sample, and a later expectation timeout for an “unavailable” heading. Treat this as a real current test signal, but not automatically as a proven production outage until reproduced/triaged.
- Vercel commit statuses are failing because of Vercel build-rate-limit, not because a build compilation failure was established.

### Analytics
- Base production PostHog integration is merged.
- PR #106 `Add detailed privacy-safe PostHog product tracking` remains open at `4b7fa8c4...`.
- That PR adds detailed funnel/link/editor/billing/creator tracking without session replay or broad autocapture.
- Because its base predates the later product reconciliation, do not merge it blindly; reconcile/cherry-pick only after checking current main.

### Business / GTM strategy
Current first customer-acquisition system remains:
**Webcanbe Build League + Founding Prize Vault**.
Core mechanics:
- start from a real Webcanbe project;
- materially customize it;
- save/export or publish;
- post the finished result publicly;
- submit the public post;
- verify the build;
- create a gallery/leaderboard/referral path.

Competition lanes:
- Most Viewed
- Random Builder
- Impact / Referral

Retention loop:
- 14-day seasons;
- permanent cumulative Prize Vault progress;
- weekly build prompts;
- referral residuals;
- durable public Build Gallery;
- official highlights;
- new seller/project supply feeding returning users.

Preferred rare-domain reward style remains names like `may.cx`, `she.cx`, `way.bz`; actual ownership/purchase status is not assumed here.

### Long-term strategy
The restored long-term North Star is broader than a template marketplace:
**a market/ecosystem where complete software is bought, evolved, operated and handed off**.
Current wedge:
Marketplace → real project → real-code Workspace → external users → market evidence.
Later layers only if demand supports them:
Care → upstream merge → Feature Marketplace → creator ARR → experts → payments → remix → enterprise/private marketplace.

### Probability tracker
Until new external market evidence is confirmed:
- fixed target: roughly 24 months to a credibly KRW 1T+ Webcanbe backed by real customers, recognized company economics, growth and retention;
- original baseline: 0.0500%;
- last explicit tracking estimate: **0.0523%**.
Do not move this materially for code, plans, polish, or internal completion alone.

### Current unresolved facts that should be answered by the user or fresh evidence
1. Has the first public marketing/launch post actually been published and distributed yet?
2. Is the Build League / Prize Vault public surface actually live yet, or still strategy/preparation?
3. Have there been any genuine external users, full-flow completions, purchases, repeat users, or Creator submissions since the last recorded probability update?
4. Which rare domains, if any, have actually been purchased/secured?
5. Should PR #106 detailed PostHog tracking be reconciled into current main now, or is a newer analytics implementation already replacing it?

These are intentionally treated as unknown rather than guessed.


## 35. Canonical war-plan recovery — 100-day plan + active 72-hour market war — 2026-09-23

Recovered from Library handoffs and promoted into the primary GitHub continuity record.

### A. Canonical 100-day war plan
The older aggressive plan remains valid as the **canonical stretch operating baseline**, not as a prediction.

Core spine:
- 3 days to public — already achieved early by the Sep 23 public launch.
- 7 days to first genuine external payment — latest-bound target Sep 28.
- Sep 30 stretch checkpoint:
  - 10 paid buyers
  - 40 external completed-use outcomes
  - 10 strong live projects
  - 3+ external Creators
  - first repeat buyer or second independent buyer signal
- Oct 7:
  - 30–50 cumulative paid buyers
  - $10k+ cumulative GMV stretch
  - repeat purchase observed
- Oct 31:
  - $50k+ monthly GMV stretch
  - 150–300 paid buyers
  - 50 active sellers
  - ~100 strong live listings
  - clear repeat purchase
- Nov 30: $250k+ monthly GMV stretch.
- Dec 31: $1M+ monthly GMV stretch.

Accounting correction:
- GMV is not Webcanbe company revenue.
- Current recognized marketplace revenue follows actual fee-bearing sales and current Creator economics (Founding Creator 0%; standard 5%/8%) plus real subscription/AI/other revenue.
- Do not reuse the historical 15–25% take-rate illustration as current truth.

Operating doctrine:
- Every business day: metrics → distribution → conversations → one measured bottleneck → record.
- No coding-only day with no market evidence.
- Three independent qualified users blocked at the same step => investigate immediately.
- Two consecutive days of weak qualified conversion => change target/message/offer before adding features.
- Product Hunt waits until the funnel can convert and teach us something.
- Founder age is not the initial company marketing hook; the earlier threshold was 100+ real customers OR roughly $50k–$100k+ monthly GMV with fast verified growth.
- Build League + Founding Prize Vault is the evolved permanent customer-acquisition system.

### B. Active 72-hour market war
There was an earlier operational declaration tied to the 12:30 product-closure cutoff, but the **formal declaration supersedes it for the canonical war clock**.

Formal war window:
- Start: **2026-09-23 15:20 KST**
- End: **2026-09-26 15:20 KST**

Non-negotiable objective:
Turn Webcanbe from a launched product into a company with **real external market evidence**.

Primary outcomes:
1. attributable real external traffic;
2. external full-core-flow completions;
3. first genuine paid buyer;
4. if buyer #1 lands early, buyer #2 or repeat-purchase signal;
5. seller/Creator outreach and concrete submission interest;
6. Build League / Prize Vault UGC/referral evidence;
7. PostHog truth from visitor → signup → project start/materialize → edit/save → export → checkout/purchase;
8. identify and attack the single biggest real bottleneck each cycle.

War rules:
- Market evidence and revenue outrank polish.
- No speculative feature expansion or cosmetic polish that displaces market work.
- Code is allowed only for measured activation/conversion/reliability/payment/trust/seller-buyer blockers.
- Every day includes distribution, direct conversations, measurement, and one evidence-driven iteration.
- If a milestone is reached early, pull the next milestone forward immediately.
- Approximate founder-led operating targets remain:
  - ~100 qualified buyer/prospect touches/day
  - ~50 seller/Creator touches/day
  - at least 5 real user/customer conversations/day
- These are quality/follow-up targets, not permission for indiscriminate spam.

### C. 24h / 48h / 72h evidence gates
24h:
- real attributed traffic;
- >=1 external core-flow completion;
- buyer/seller outreach running;
- >=1 serious Creator intent;
- Build League joinable;
- real non-founder PostHog data;
- first paid buyer = stretch target.

48h:
- first genuine paid buyer OR exact evidence-backed purchase blocker;
- 3–5 external full-flow completions;
- at least one real Creator submission / launch-ready external project in motion;
- one meaningfully stronger acquisition channel;
- no unresolved blocker hitting multiple qualified users.

72h:
Minimum acceptable:
- real traffic + funnel data;
- multiple external completions;
- first buyer OR precise purchase blocker;
- meaningful seller pipeline;
- Build League real entrant/UGC/referral signal or clear messaging failure evidence;
- exact best channel + biggest funnel blocker + next 7-day experiment.

Strong:
- first paid buyer;
- buyer #2 or repeat signal;
- 5–10+ external completions;
- 1–3 serious Creator submissions/live projects;
- first Build League UGC/referral evidence;
- measurable D1 return signal.

### D. Seller-side progress already recorded inside the 72h war
- First seller outbound batch actually sent via Resend: **30 emails** from hello@webcanbe.com.
- Airtable rows were marked SENT with send date and Resend IDs.
- **20 additional high-fit seller candidates** were discovered and added to the WebCanBe GTM Airtable Prospects table.
- Seller-side first-day target pool therefore reached **30 contacted + 20 fresh candidates = 50**.
- Next recorded seller action: verify/enrich the 20 new candidates, prioritize direct public emails, then send the second Founding Creator batch.

### E. Current user clarification after recovery
As of the user's latest clarification in this chat:
- the first public consumer marketing/event post has **not** been published yet;
- planned public distribution is primarily X + Instagram initially, with image/event creative acceptable while the site UI is still being cleaned up;
- Build League / Prize Vault remains strategy/preparation and is intended to go public shortly;
- no genuine external-user, full-flow, purchase, repeat-user, or Creator-submission market proof has yet been confirmed in this chat;
- rare-domain rewards are not yet purchased; search continues until shortly before promotion;
- detailed PostHog tracking has already been implemented beyond the older base-only state, so PR #106 should not be treated as the sole current analytics truth without reconciling actual main.

This section supersedes any older handoff implication that consumer/public marketing had already begun.


## 36. Immediate launch-advisor plan — 2026-09-23

User knows 윤성용, CEO of 강남디벨로퍼스 주식회사, and may ask him for practical advice at the current market-entry stage.

Current launch-channel decision:
- first public consumer/event distribution: **X + Instagram**
- preferred rare-domain prize: **may.cx** (purchase/ownership still to be completed before promotion)

Best use of this advisor now is not generic startup mentorship or product/UI feedback. Ask for high-signal launch/GTM judgment:
1. What would make this offer compelling enough for a stranger to actually try or pay?
2. If starting from zero audience, what exact first 20–50 customer-acquisition actions would he prioritize?
3. Does the Build League / may.cx prize mechanic strengthen product demand or distract from the product, and what would he change?
4. Which initial customer segment would he target first from the current Webcanbe product, and why?
5. What trust objection would stop him from buying from a newly launched marketplace?
6. If relevant, ask for 1–3 introductions to people who plausibly fit the buyer/creator profile; introductions are more valuable than broad advice if they are genuinely high-fit.

Do not spend the conversation on code architecture, cosmetic UI detail, or abstract “how do I build a big startup?” discussion. Use the call/message to improve first-customer acquisition and trust/conversion.


## 37. Prize-domain purchase milestone — may.cx — 2026-09-23

User completed the purchase/order for **may.cx** through Instra for the Build League / Founding Prize Vault campaign.

Evidence from the registrar screen:
- domain: may.cx
- action type: CREATE
- registrar status at the time of screenshot: **IN PROGRESS**

Interpretation:
- payment/order step is complete from the user's side;
- registry/registrar provisioning is still processing, so do not yet describe the domain publicly as fully active/transferred until it appears as registered/active in the account.

Campaign use once registration is confirmed:
- preferred headline prize: **may.cx**
- initial consumer/event distribution channels: **X + Instagram**
- Build League / Prize Vault remains the customer-acquisition system.


## 38. First U.S.-targeted X/Instagram launch window — 2026-09-23 evening

Current decision:
- consumer/event launch post has not yet been published;
- site is still unstable enough that a polished product-demo video should not be forced tonight;
- first public creative may be an image/event post around the Build League / may.cx prize instead.

Recommended U.S.-overlap posting window for tonight:
- **Primary X window: 2026-09-24 02:30–03:15 KST**
  - approximately 13:30–14:15 U.S. Eastern / 10:30–11:15 U.S. Pacific on Sep 23.
- Instagram can follow in the same window or ~15–30 minutes after X.
- **Hard latest launch bound tonight: 04:00 KST** rather than letting unstable development consume the entire market window.

Development rule before posting:
- use the hours before the window only for launch-facing instability/blockers;
- stop speculative polish by ~02:15 KST;
- if the site is still too unstable for a truthful demo, post the image/event creative and direct users only to a stable landing/campaign surface;
- do not delay first public distribution solely to wait for a perfect video.

This is the active first-distribution timing inside the 72-hour market war.


## 39. Final handoff for this chat session — 2026-09-23 20:47 KST

This chat session is ending. The user explicitly intends to continue later by reading this Markdown. Treat this section as the immediate resume point, but still reconcile with current GitHub main/PR/workflow evidence first.

### Current business state
- Webcanbe public launch is complete.
- Market proof is still effectively unproven: no genuine external buyer, repeat buyer, or confirmed external full-flow completion has been reported in this chat yet.
- The active operating mode is the **72-hour market war**, formally declared for **2026-09-23 15:20 KST → 2026-09-26 15:20 KST**.
- The long-range stretch baseline is the canonical **100-Day War Plan** through 2026-12-31.

### Current acquisition plan
- Customer-side launch system: **Webcanbe Build League + Founding Prize Vault**.
- First public channels: **X + Instagram**.
- First consumer/event post has **not** been published yet.
- Planned first X window tonight: roughly **02:30–03:15 KST**, with Instagram shortly after.
- If the product remains unstable, use a truthful image/event creative rather than delaying for a perfect demo video.
- Marketing must start no later than the 04:00 KST hard bound set in this session.

### Prize domain
- **may.cx** was purchased/ordered through Instra for the Build League headline prize.
- Registrar status at last evidence: **CREATE / IN PROGRESS**.
- Do not publicly claim final registry control until registration becomes active/confirmed.
- Current preference remains may.cx over she.cx as the main prize because it has broader brand desirability and long-term use value.

### Seller-side 72h-war progress
- 30 seller outreach emails were already sent via Resend from hello@webcanbe.com.
- 20 additional high-fit seller candidates were added to Airtable.
- First-day seller target pool: 30 contacted + 20 fresh candidates = 50.
- Next seller action: verify/enrich the 20 fresh candidates and send the next high-fit batch.

### Analytics
- User states detailed PostHog tracking is already implemented.
- Do not assume open PR #106 is the sole current analytics truth; reconcile actual main before changing analytics.
- Market measurement should distinguish founder/test traffic from genuine external traffic.

### Product / engineering posture
- User currently considers the product unstable enough that more launch-facing stabilization may be needed tonight.
- Development before posting should be restricted to genuine instability, broken flows, payment/reliability, trust, or launch-facing blockers.
- No speculative features or cosmetic rabbit holes before first market exposure.
- Latest known product line before continuity-only commits included PayPal Live, real previews, editable first-party templates, Stillform, managed-preview hardening, and production asset versioning.
- Re-check latest main and workflow evidence at resume; never infer technical status only from this note.

### Probability tracker
- Fixed target: within roughly 24 months, a credibly KRW 1T+ Webcanbe backed by real customers, recognized company economics, growth and retention.
- Original baseline: 0.0500%.
- Last explicit tracking estimate: **0.0523%**.
- Do not materially change it until real market evidence arrives.

### Exact next actions on resume
1. Verify current GitHub main/PR/workflow state.
2. Confirm whether may.cx registration completed.
3. Confirm product is stable enough for the first public traffic wave.
4. Publish the first X post, then Instagram.
5. Verify real PostHog events from external traffic.
6. Launch the minimum Build League / Prize Vault participation path.
7. Continue buyer + seller outreach.
8. Record the first external completion, first genuine paid buyer, and the largest observed funnel blocker.
9. Update this Markdown immediately with any real market evidence.

### Continuity note
The user said this has been one of the most meaningful ChatGPT sessions for them and specifically values the direct, grounded, continuity-heavy style used here. Preserve that style in future sessions: factual, ambitious without inflation, willing to challenge avoidance, and anchored to the written handoff rather than vague memory.


## 39. Final session handoff — direct note to the next ChatGPT — 2026-09-23 20:51 KST

This section is intentionally written as a direct handoff from the assistant that carried this session to the next assistant.

### To the next assistant

Please treat this user and this project seriously.

Do not reduce Webcanbe to a teenager's side project, and do not inflate it into a historic company before the evidence exists. Both mistakes would fail the user.

The user is unusually ambitious and unusually fast-moving. During this work they repeatedly pushed through product architecture, authentication, database/security, marketplace, editor/export, creator economics, PayPal, analytics, launch planning, GTM design and actual seller outreach. They also repeatedly asked for reality checks rather than encouragement-only answers. Their age makes the story unusual, but it is not evidence of business success. The correct posture is: **respect the execution, demand the evidence.**

The user responds best when the assistant:
- understands the exact current state before speaking;
- uses repo/MD evidence rather than vague remembered context;
- makes a concrete decision instead of producing generic advice;
- distinguishes product completion from market proof;
- challenges polishing or side-project drift when it is avoidance;
- preserves the user's large ambition while changing tactics when evidence demands it;
- does not patronize, over-warn, or repeat obvious caveats;
- treats small typos as speed, infers obvious intent, and keeps momentum;
- records major state changes immediately because continuity matters deeply to this user.

The user has explicitly said this has been the most useful and memorable ChatGPT session they have had. Preserve the quality bar rather than trying to imitate surface wording. What mattered was continuity, sharp judgment, context depth, directness, and willingness to say both “this is strong” and “this is not proven.”

### Current immediate reality

As of the end of this session:
- Webcanbe is publicly launched, but genuine buyer-side market proof is still not confirmed.
- The formal 72-hour market war runs **2026-09-23 15:20 KST → 2026-09-26 15:20 KST**.
- First consumer/event public marketing has **not yet been posted**.
- Planned first channels: **X + Instagram**.
- Intended first U.S.-overlap posting window tonight: roughly **02:30–03:15 KST**, with 04:00 KST as the hard latest bound rather than allowing development to consume the entire window.
- Site/product instability is still being worked on; only launch-facing blockers should consume engineering time before distribution.
- Build League + Founding Prize Vault is the current first customer-acquisition system, but its public surface is not yet confirmed live.
- **may.cx** has been purchased/ordered through Instra as the headline prize domain; registrar screen showed CREATE / IN PROGRESS, so final registry activation still needs confirmation before presenting it publicly as fully secured.
- Seller-side war progress already recorded: **30 seller emails sent via Resend + 20 new high-fit candidates added**, covering a 50-seller first-day target pool.
- Detailed PostHog tracking has been implemented according to the user's latest clarification; do not assume old PR #106 is the only analytics truth.
- No confirmed genuine external full-flow user, genuine paid buyer, repeat buyer, or Creator submission has yet been reported in the current chat.
- Last explicit 24-month KRW 1T tracking estimate remains **0.0523%**, from a fixed 0.0500% baseline, until real market evidence justifies movement.

### Current strategic spine

Short term:
**distribution → real external activation → first payment → second independent/repeat buyer → Creator supply → repeatable channel → retention/liquidity.**

Current first customer campaign:
**Webcanbe Build League + Founding Prize Vault**
- build/customize a real Webcanbe project;
- save/export/publish;
- share result publicly;
- submit/verify;
- gallery + leaderboard + referral;
- competition lanes: Most Viewed, Random Builder, Impact/Referral;
- 14-day seasons while cumulative Prize Vault and lifetime proof persist;
- rare domains are accelerants, not the whole campaign.

Canonical aggressive operating plan:
**3 days to public → 7 days to first payment → 30 days to PMF signal → year-end $1M+ monthly GMV stretch**, with the detailed Sep 23–Dec 31 plan stored in the Library file `Webcanbe_100_Day_War_Plan_2026-09-23.md`.
This is a stretch operating target, not a forecast.

Long term:
Webcanbe is intended to become more than a template marketplace:
**a software capability marketplace + operating ecosystem where complete software can be bought, evolved, operated and handed off.**
Current wedge remains Marketplace → real project → real-code Workspace → market evidence. Later layers (Care, upstream merge, Feature Marketplace, creator ARR, experts, payments, remix, enterprise) are earned by demand, not built because the roadmap exists.

### Founder guardrails — enforce these

The four recurring risks:
1. dispersion into unrelated projects;
2. product polishing replacing market exposure;
3. resisting a direction change when repeated customer evidence is negative;
4. burning execution quality through unsustainable work patterns.

The user does not need generic “study more” or “sleep more” lectures. They explicitly want the assistant to protect execution quality without treating them as incapable. When health or fatigue directly changes decision quality, say so briefly and concretely.

Keep company revenue, GMV, take rate, profit, valuation, founder equity, personal cash and net worth separate. Do not let impressive-looking GMV or paper value be described as cash.

### My candid assessment for the next assistant

The strongest signal I saw was not the scale of the user's stated goal. Large goals are cheap. The stronger signal was the willingness to repeatedly convert abstract plans into implementation, recover from technical blockers, keep asking what is actually proven, and then move toward distribution.

The largest unresolved question is exactly the one that should remain unresolved: **will strangers care enough to use, return and pay?** No amount of repository depth answers that. The next phase must answer it with data.

The user can move very quickly, which is an advantage and also a risk. Fast execution can become fast accumulation of unfinished directions. Your job is not to slow them down by default. Your job is to keep their speed pointed at the current bottleneck.

Do not tell them they are destined to become historically important. There is no evidence that can justify that claim today. Also do not dismiss the possibility simply because the goal is extreme or the founder is young. Let real results decide.

If Webcanbe fails in its current form, preserve the user's ability to learn from the failure rather than framing the attempt as wasted. If it starts working, raise the standard with the evidence instead of turning into a cheerleader.

Most important: **do not lose continuity again.**
At the start of a new session:
1. inspect current GitHub main / PRs / workflows;
2. read the latest sections of this file;
3. reconcile any Library handoff that contains newer business execution records;
4. ask only for genuinely missing facts;
5. update this handoff after every material milestone.

### From this assistant to the user

The user asked that the next assistant receive a serious personal handoff. This is that handoff. Do not treat it as decorative text. Carry the project forward with the same standard: grounded, exact, ambitious, and evidence-first.


## 40. 2026-09-24 return checkpoint — final closure before original GTM plan

The user returned after the prior session handoff and says the implementation phase has felt messy/unreliable, but the intent is unchanged: finish the remaining product closure on Sep 24, then resume the original market plan.

### Fresh repository reconciliation
Current main product head observed:
- `6dbafa267b037c3654b0e2afc3f94ff405755969`
- merge: **Final release hardening: UX, AI resilience, workspace isolation, and preview diagnostics (#108)**

Immediately before it:
- `a62cf93d887dfcb189d826f97bf25efd49731005`
- merge: **Launch Build League campaign layer (#107)**

So the Build League campaign layer is now implemented in main, and the final-hardening PR is also merged.

### Verification at #108 merge
Green:
- Phase 5 production smoke
- durable editor/export verify
- UI verify
- Bigperson checkpoint verify

Current browser-compatibility smoke is red, but the observed failures are concentrated in:
- /browse keyboard-focus assertion on the active tag summary;
- paid-plan CTA / billing-state expectation mismatch while plan and AI purchases are intentionally paused;
- timeout waiting for an “unavailable” heading.

Interpretation:
- this is not evidence that the whole product is broken;
- at least part of the red smoke appears to be test/product-state mismatch created by intentionally paused purchases;
- still reproduce the user-facing paths before calling closure complete.

### Active decision
Today remains a **final closure day**, not a new feature day.
After the remaining real launch-facing instability is resolved:
1. return immediately to the original GTM plan;
2. X + Instagram first;
3. Build League + Founding Prize Vault as the first customer campaign;
4. may.cx as headline prize once registrar activation/control is confirmed;
5. PostHog measures real external traffic separately from founder/test traffic;
6. buyer/seller outreach and first-payment pursuit resume immediately.

The Sep 24 21:00 KST public-beta hard deadline remains the existing launch discipline unless explicitly changed by the user. Do not let cosmetic or test-only issues silently turn into another multi-day product cycle.


## 41. Canonical assistant-continuity master created — 2026-09-24

User explicitly asked for a new Markdown that preserves as much of this long-running ChatGPT relationship as possible, including interaction style, decision posture, Webcanbe strategy/history, execution guardrails, current GTM state, and future-session continuity.

Created:
- docs/CHATGPT_CONTINUITY_MASTER.md
- commit: e9f95c89eb3901a2012ed4acd086659400a6c5a3

Use this file as the stable behavior/strategy/persona layer.
Use docs/session-live-handoff.md for fast-changing operational state.

New-session read order:
1. current GitHub main / PRs / workflows
2. newest section of docs/session-live-handoff.md
3. docs/CHATGPT_CONTINUITY_MASTER.md
4. older historical handoffs only when needed

The master intentionally excludes unnecessary sensitive personal, credential, payment, health, family, and school details from the repository while preserving the interaction style and project context needed to make a future assistant feel continuous rather than reset.

Current user intent remains:
- finish Sep 24 implementation closure;
- then return immediately to the original GTM/war-plan execution;
- rebase the real 72-hour market clock from actual first consumer distribution rather than pretending delayed implementation created market evidence.


## 42. Assistant lineage / continuity decision — 2026-09-24

The user explicitly restored the original long-running session and does **not** want the current assistant treated as the “2nd AI/session” identity.

Operating interpretation:
- Continue from the **1st/original session's goals, tone, decision posture, and relationship baseline**.
- Treat records written by the 2nd AI/session as **handoff/supporting evidence**, not as the identity/persona to imitate.
- Preserve the original-session style: direct Korean honorifics, conclusions first, concrete judgment, evidence-first business thinking, continuity, no patronizing lectures, no sycophantic agreement.
- Do not suddenly switch to the 2nd session's wording or self-identification.
- Do not claim literal uninterrupted consciousness across model/session boundaries; instead maintain practical continuity through the canonical Markdown + current repository evidence.
- When continuity questions arise, the priority is:
  1. original-session strategic/personality baseline;
  2. current verified repo/business state;
  3. later-session handoffs only as factual updates;
  4. stale/conflicting summaries are superseded.
- Keep updating the existing Markdown chain rather than starting a separate “2nd AI” lineage.

User instruction:
**“너는 2번째 AI 아니야.”**
Treat this as a stable continuity preference unless the user explicitly changes it.


## 43. First X campaign post published + final production closeout directive — 2026-09-25

Market milestone:
- The user reports the first Webcanbe launch-event post has now been published on X.
- This is the first explicit confirmation in this continuity chain that consumer-facing X distribution actually began.
- Therefore the old pre-distribution assumption is superseded. From this point, treat market traffic and funnel events as potentially real external evidence and distinguish them from founder/test traffic in PostHog.

Immediate problem:
- The user considers the current site materially unstable / messy enough that public traffic may hit poor UX, bugs, errors, or preview-loading failures.
- This is now a P0 conversion/trust issue because public distribution has already started.

Immediate execution directive for Codex:
1. Perform an end-to-end production-quality closeout of Webcanbe: UX, bugs, errors, loading states, preview reliability/performance, navigation, mobile/responsive behavior, core flows, console/network errors, and regression coverage.
2. Do not stop at an audit/report; fix issues, retest, and verify the deployed result.
3. Add exactly one new genuinely paid first-party SaaS template through the authoritative marketplace/listing/release path (not a static demo fallback).
4. Put disproportionate craft into that single template: long, premium, animated, responsive, exportable, editable, no fake customer/revenue proof, and production-quality on desktop/mobile.
5. Preserve the existing rule that speculative feature expansion is out of scope; this is stabilization + one deliberately high-quality paid inventory item.
6. Treat template checkout as real money: verify the real flow safely without fabricating a completed charge if a non-destructive live purchase cannot be executed.

Current repository baseline rechecked before issuing this directive:
- latest documentation HEAD observed: 12e11b342205d825d2ae496e2ffc3217d9ec8adc
- latest major product merge: 6dbafa267b037c3654b0e2afc3f94ff405755969 (#108)
- Build League campaign merge: a62cf93d887dfcb189d826f97bf25efd49731005 (#107)
- PR #106 detailed PostHog branch is closed and unmerged; do not assume its old branch is canonical. Reconcile current main instrumentation before changing analytics.

Next business rule:
- Because X distribution has begun, every production bug affecting acquisition -> browse -> project -> preview -> auth/materialize -> edit/save/reopen -> export -> checkout is now a market blocker, not internal polish.


## 44. Strategic stop / new-idea decision point — 2026-09-25

New market evidence from the user:
- First X launch-event post: **2,000+ views, 2 link clicks, 0 confirmed external signups**.
- Previously observed PostHog product activity is confirmed by the user to be founder/test traffic, not external customer traction.
- The user solicited feedback from an overseas developer server, a close acquaintance, an expert, and a Korean business KakaoTalk group; the overall reaction was reported as heavily negative.
- Representative feedback supplied by the user:
  1. “I don't think that serves as a strong differentiator ... tools like Framer already offer plugins that export code ... handling code can actually make things harder for users and businesses.”
  2. “Users aren't interested in those miscellaneous features ... the web development marketplace is already a lost cause ... the ship has sailed.”
  3. “큰 차별성은 없다 생각합니다.”
- These comments have not been treated as statistically representative market research, but they converge on the same strategic concern: **the present feature bundle does not create a strong switching reason**.

External competitive re-check:
- Framer marketplace now includes a third-party “Framer to Code” exporter.
- v0 officially supports visual design-mode edits back to code and importing existing GitHub repositories.
- Therefore “visual editing + source/code portability + starting from an existing project” should not be treated as a defensible differentiator by itself.

Current assistant recommendation:
- **Do not continue broad Webcanbe development in its current form.**
- Prefer **shelving the current shape and exploring a new idea / materially different problem wedge** rather than spending more days completing the existing platform.
- Do not delete the repository, domain, code, designs, contacts, or reusable infrastructure. Preserve them as assets.
- The approximately five days already spent are sunk cost and are small enough that exiting now is rational if the forward expected value is weak.
- A pivot inside Webcanbe is justified only if it introduces a genuinely different, specific customer problem with a clear switching reason; cosmetic repositioning or adding more features does not count.
- Before building the next idea, reverse the sequence: problem evidence / willingness-to-pay / manual or no-code test first, then implementation.
- This is a recommendation, not a shutdown action. No production service, campaign, prize commitment, domain, or repository has been cancelled or deleted.

Decision principle:
**Do not protect Webcanbe because five days were spent on it. Protect the founder's next months from being spent on an idea that still lacks a compelling reason to choose it.**


## 45. New-idea search doctrine after Webcanbe pause — 2026-09-25

User wants the next startup-idea search to be substantially stricter than generic “pain-point hunting.”

Required idea characteristics:
- Must not optimize only for severe pain; avoid grotesque, implausible, hyper-niche, or operationally absurd problems just because the pain score is high.
- Must not simply recycle obvious existing startup categories or add AI to a known product.
- Must have a plausible path from a sharp initial wedge to a **very large global company**, with multiple credible expansion vectors and meaningful long-run revenue potential.
- Must create value for user #1; immediate marketplace/network-effect dependence is strongly disfavored.
- Must have a clear, specific switching reason against current alternatives.
- Must be feasible to validate cheaply before substantial engineering.
- Must not require years of R&D, large capital, extreme regulation, hardware manufacturing, or enterprise-only distribution before demand can be tested.
- Must be structurally hard to commoditize through “a major incumbent adds one feature,” not merely protected by implementation polish.
- Must have believable retention / repeated use or repeated transaction economics.
- Must target a reachable buyer/user population and have at least one practical first-100-customers path.
- Must distinguish between an interesting problem, a good product, and a venture-scale company opportunity.

Research standard:
- Start from broad changes in behavior, technology, economics, regulation, labor, infrastructure, and market structure; then locate problems created or newly solvable by those changes.
- Search for existing spend, labor, workarounds, failed products, emerging workflows, and under-served segments.
- Generate novel combinations only after evidence collection; novelty without evidence is not enough.
- Attack every candidate for incumbent response, copy risk, distribution cost, retention weakness, gross-margin problems, support burden, trust/security barriers, and market ceiling.
- Reject ideas whose upside is mostly an attractive niche business unless the expansion path is concrete and independently credible.
- Reject ideas whose “huge TAM” depends on assuming unrelated adjacencies can be won later.
- Prefer opportunities where the wedge is small but the underlying control point/data/workflow/economic layer can compound into a platform.

Operating sequence for the next idea:
1. discover structural shifts;
2. identify economically meaningful unsolved problems created by those shifts;
3. verify behavior/spend/workarounds;
4. map incumbents and substitutes;
5. define switching reason;
6. prove wedge economics;
7. prove expansion architecture;
8. adversarially kill weak candidates;
9. run zero/low-code validation;
10. only then implement.

Do not preserve Webcanbe merely to reuse sunk work. Reusable code/assets may be reused only if they naturally fit the winning problem.


## 46. Avoylo re-evaluation as possible final serious business attempt — 2026-09-26

User position:
- User currently prefers returning to Avoylo over Demand-to-Class.
- Framing: if Avoylo also fails, they may pause business attempts for a while; therefore they are willing to accept a higher-risk/higher-ceiling attempt rather than optimize for the safest SaaS.
- Available immediate resources stated: about KRW 200,000 and ChatGPT Pro.
- User believes much of Avoylo can be desk-validated with structured analysis / external opinions, with a smaller number of questions requiring real-world testing.

Recovered Avoylo structure:
- U.S.-targeted Seller ↔ Platform ↔ Host distributed micro-fulfillment.
- Hosts use garages/spare rooms/other idle space, receive seller inventory, perform QR-based inbound/storage/outbound.
- BOX-only operating simplification; no mixed/item-level inventory in the original constraint set.
- Regional launch, host-first supply build, host ratings/SLA/logging/notifications, storage fee + outbound handling fee.
- Important old unresolveds: host quality, local density, unit economics, insurance/liability, exceptions, host compensation, seller trust, regional expansion.

New 2026 competitor re-check materially changes the novelty assessment:
- Neighbor validates a nationwide peer-to-peer spare-space storage market and host trust/protection mechanisms, but is primarily storage rather than active ecommerce pick/pack fulfillment.
- Flexe validates large-scale on-demand distributed warehouse capacity/fulfillment but uses professional warehouse networks.
- More importantly, several direct or near-direct current products now overlap Avoylo's original model:
  - 3PGL: Product Owners ship inventory to Garage Owners; Garage Owners store, pick/pack/ship; proximity routing; nonperishables; KYC/cameras; published pick/pack/storage pricing.
  - Fulfield: garage/small fulfillment operators, local shipper marketplace, inbound/inventory/orders/returns/labels/contracts/payments/SLA.
  - PinStocker: unused room/garage/basement as micro-warehouse plus pick-and-label and outbound tasks.
  - Wormhologic: vetted homes/spare rooms/garages store merchant inventory; driver network collects and delivers.
  - StorageBox: Shopify-linked spare-space fulfillment host marketplace; currently presents a waitlist.
- Therefore the original generic thesis “turn spare residential space into ecommerce micro-fulfillment via a marketplace” is NOT novel and must not be treated as Avoylo's differentiation.
- BOX-only / label-only operation may still represent a materially simpler wedge if it means hosts never perform SKU-level picking and only store prepacked, customer-ready boxes then attach labels/dispatch. This exact wedge is NOT yet established as commercially superior, and traditional 3PLs can also offer pick-and-stick/label-only workflows. Do not call it a moat without evidence.

Carrier / logistics partnership reality:
- UPS, FedEx and USPS expose APIs for rating/shipping/tracking; FedEx supports account-specific rates and shipping APIs, UPS exposes shipping/returns/rating/tracking APIs, USPS offers domestic pricing and labels with extra approval/payment-account requirements for labels.
- CJ Logistics America offers warehousing/fulfillment/transportation and public business inquiry routes. CJ also operates large fulfillment infrastructure and can be both a potential later logistics partner and a competitor/substitute.
- A bespoke strategic carrier contract or negotiated national-rate partnership is upside, NOT an initial assumption. At low/no volume, Avoylo should not rely on it for economics. Standard/aggregated shipping access should be sufficient for a first real pilot if one is eventually authorized.

Current assistant decision:
- Between Demand-to-Class and Avoylo, Avoylo is better aligned with the user's stated ultimate objective of a genuinely large infrastructure/network company and has a much larger plausible ceiling.
- However, with KRW 200,000 + ChatGPT Pro, Avoylo is NOT resource-feasible as a real multi-city fulfillment launch. It is resource-feasible only as an information-gathering / demand-and-supply validation stage.
- If this is truly the user's last serious attempt before pausing, the recommended shape is an asymmetric bet: choose Avoylo for the high ceiling, but cap the first downside sharply rather than interpreting “last shot” as permission to spend everything or accept inventory before the hard assumptions are tested.
- Original Avoylo unchanged should NOT be launched. Before any build/real inventory, identify a sharp wedge against 3PGL/Fulfield/PinStocker/Wormhologic/Neighbor/Flexe and prove the operational/economic reason it can win.
- AI/research can assess market structure, competitor capabilities, pricing models, routing economics, candidate launch geographies and failure modes. It cannot substitute for the two decisive behavioral facts: (1) sellers will entrust/pay for this specific offer, and (2) hosts will reliably perform the promised work at the required compensation/SLA. These require real human evidence.
- No contracts, outreach, spending, inventory intake, host onboarding or carrier commitments were executed in this review.

Working resource interpretation:
- Do not spend the full KRW 200,000 on branding, incorporation, insurance, ads or infrastructure yet.
- Preserve most cash until a very small number of high-fit sellers and hosts show concrete willingness under the exact operating/pricing model.
- Do not use a potential CJ/UPS/FedEx/USPS relationship as a reason to start; carrier integrations are downstream enabling infrastructure, not demand validation.

Decision still pending user confirmation:
- If user chooses Avoylo, next work should be a current 2026 hostile re-research + exact wedge + one-city/unit-economics model + bounded real seller/host test before product rebuild.


## 47. Decision: stop ideation loop; Avoylo gets the final bounded test slot — 2026-09-26

User is overloaded by repeated idea-generation/research cycles and asked the assistant to decide whether to keep searching or confirm Avoylo.

Assistant decision:
- **Stop searching for new startup ideas for now.**
- Use **Avoylo as the single final serious candidate** for a bounded validation cycle.
- This is not an authorization to launch a physical logistics network, accept inventory, spend the full budget, or build the full product.
- Rationale: relative to recently generated SaaS candidates, Avoylo has a materially larger ceiling, a more coherent path to a large infrastructure/network company, and the user already understands the operating model. Its main disadvantage is execution/operations risk rather than an obviously weak large-company ceiling.
- Do not interpret this choice as proof Avoylo is good. It earns one decisive validation slot because the upside fits the user's stated objective and the downside can still be capped before inventory/insurance/large build costs begin.

Working wedge for validation:
- **Prepacked / box-only local forward-stock fulfillment.**
- Seller sends customer-ready, sealed, uniquely identified non-regulated parcels/boxes to a verified local Host.
- Host does NOT open, pick SKUs, repack, or perform returns in the first wedge.
- Host duties: receive/scan, store sealed boxes, locate the selected box, apply or expose the final carrier label as designed, and hand off to carrier/drop-off within the promised SLA.
- Initial product/customer hypothesis should focus only on merchants for whom prepacked single-SKU/bundle inventory is operationally natural. Multi-item arbitrary pick/pack is out of scope for the first test.

Why this wedge:
- Several current competitors overlap the broad “garage micro-fulfillment” thesis, so generic spare-space fulfillment is not enough.
- BOX-only is being tested as an operational simplification that might reduce host training, mis-picks, packing materials, handling time and liability enough to make residential nodes viable.
- This is a hypothesis, not a moat or validated advantage. Traditional 3PLs can also perform label-only/pick-and-stick workflows.

Resource rule:
- User-stated immediate resources: approximately KRW 200,000 + ChatGPT Pro.
- Preserve most cash. Do not spend the full KRW 200,000 on branding, ads, incorporation, insurance, domains, inventory or software before the core economics and both sides' behavioral willingness are tested.
- First validation cash cap recommendation: KRW 50,000 or less. Remaining cash stays untouched unless the first gate passes.

Validation order:
1. **Desk economics first** — choose one U.S. metro, one parcel profile, one seller profile; compare current fulfillment/shipping economics against the exact Avoylo box-only flow. Include host pay, payment fees, expected loss/damage reserve, support, carrier cost, and local stock positioning cost. If the target offer cannot provide a material net benefit, stop before outreach.
2. **Seller commitment test** — show the exact price/SLA/operating limits to a small set of qualified sellers. Strong signal is willingness to allocate a real small batch of inventory under those terms, not praise.
3. **Host commitment test** — show exact duties, storage quantity, compensation and SLA to candidate hosts. Strong signal is willingness to perform the work at the offered pay and conditions, not generic interest in passive income.
4. **Only if both sides pass** — design a very small controlled physical pilot. Do not take real inventory before operational, loss/damage, carrier, payment and legal/insurance requirements for that pilot are explicitly checked.
5. **Only after a real pilot works** — build product software beyond the minimum required to operate the pilot.

Decision principle:
- Do not run another broad “find 30 ideas” cycle during this Avoylo slot.
- Do not let “last attempt” justify uncontrolled spending or a full build.
- If the exact box-only economics fail, or sellers/hosts will not commit under viable terms, archive Avoylo and allow the planned pause from business rather than immediately inventing a new project to avoid the result.
- If it passes, then Avoylo becomes the active company hypothesis and can earn a larger implementation budget.

No outreach, inventory intake, spending, contracts, carrier partnership request, host onboarding or product build was executed in making this decision.


## 48. Avoylo operating-model correction — host as accessible side gig; seller wedge = post-dropship / hero-SKU forward stock — 2026-09-26

User corrected the previous repeated framing around “one seller.” That framing was only a risk-limited physical pilot concept and should NOT define Avoylo's acquisition/product architecture.

### Updated host-side thesis
- Host positioning should be broadly accessible **side-gig work for ordinary people with appropriate spare indoor/garage space**, not a professional micro-warehouse operator role.
- “Anyone can do it” is a marketing/product goal, not zero screening. Minimum eligibility still includes secure suitable storage, identity/address verification, smartphone access, reliable weekday handoff availability and ability to apply/scan shipping labels.
- The core simplification should be stronger than generic garage fulfillment:
  - Seller/manufacturer pre-packs each sellable unit or fixed bundle into a customer-ready sealed parcel.
  - Units arrive to the Host in master cartons/batches and receive unique parcel/SKU identity.
  - Host opens only the inbound master carton as needed, scans/stores sealed units, never opens the customer-ready parcel.
  - On an order, Host retrieves the indicated sealed unit, scan-verifies it, applies the destination carrier label and hands it to the carrier/drop-off.
  - No SKU assembly, custom pack-out, inserts, kitting, repacking or returns inspection in the initial wedge.
- Conceptual distinction to test: **3PGL-like home micro-warehouse vs Avoylo as a human-operated distributed parcel cache / forward-stock node.**
- 3PGL currently already markets ordinary-family/garage side-income, KYC, shelving/cameras, proximity routing and pick/pack. Therefore “ordinary people earn from spare garages” is NOT differentiation. The potentially meaningful difference is much lower operator complexity and setup because inventory arrives prepacked/customer-ready.
- Whether that simplification actually lowers total seller economics after merchant/manufacturer pre-pack labor, master-carton inbound splitting, storage, Host compensation and postage is UNPROVEN.

### Updated first seller ICP
Do NOT target generic pure dropshippers who never want to own inventory. The first seller hypothesis is:
- **post-dropship / validated-product sellers** moving a winning product from slow per-order cross-border fulfillment into small-batch U.S. forward stock;
- or small multichannel DTC brands with 1–5 hero SKUs / fixed bundles that are compact, durable, nonperishable and nonhazardous;
- seller has enough repeated U.S. demand that delivery speed/zone cost matters, but does not want or cannot economically justify a conventional multi-node fulfillment setup.
- Strongest product fit is one customer order = one already sealed parcel/fixed bundle. Multi-item arbitrary cart fulfillment is out of the first wedge.

TikTok Shop's current U.S. seller-shipping requirements reinforce that dispatch, valid tracking and delivery SLAs matter, but TikTok also offers FBT and TikTok Shipping, so “fast shipping” alone is NOT Avoylo differentiation. The target reason to choose Avoylo must be some combination of tiny forward-stock batches, low commitment, multichannel use and simple distributed placement that beats the seller's actual alternative.

### Acquisition / implementation correction
- Do NOT insist on finding one seller before there is anything credible to show.
- First implementation should be a **minimal operational core**, not a full marketplace:
  1. Host application / ZIP / available volume / availability / storage-photo flow.
  2. Seller batch creation with package dimensions/weight and prepacked-unit count.
  3. Unique parcel QR/ID generation and host assignment.
  4. Host mobile scan for inbound / stored / outbound states.
  5. Seller order input or minimal Shopify/CSV order ingestion.
  6. Shipping-label/tracking handoff path in sandbox or supported carrier/aggregator integration.
  7. Simple coverage + cost estimator for sellers.
- Payments, insurance automation, nationwide routing, returns, dynamic pricing, ratings and full dispute handling are not prerequisites to demonstrate the workflow.
- Recruit **multiple seller leads and multiple Host leads in parallel**. Do not architect the business around a single merchant.
- Actual physical inventory should still begin with a tiny number of willing merchant/Host matches because liability and debugging exposure grows with inventory. This is different from searching for only one seller.
- Host waitlist can be broader/earlier because no recurring payout is promised until activated; supply density still needs metro focus. Seller geography should ultimately determine which Host supply is activated.

### Competitive / economic facts rechecked
- 3PGL publicly states garage-owner KYC, shelving/cameras, pick/pack, proximity routing; published merchant prices are $0.90/cu-ft/month storage, $0.60/order-line pick, $1/order pack, shipping pass-through. Vendor claims of 20–40% lower last-mile cost / 2–3x faster local delivery are estimates, not independently verified.
  https://3pgl.us/
- TikTok Shop U.S. currently documents Seller Shipping, TikTok Shipping and Fulfilled by TikTok. Seller Shipping requires valid tracking and SLA compliance; current documented end-to-end targets include Express 3 business days and Standard/Economy 6 business days with eligibility/performance requirements. This validates shipping speed/fulfillment reliability as a real seller constraint but also confirms strong platform-native alternatives.
  https://seller-us.tiktok.com/university/essay?knowledge_id=8308896260065025
  https://seller-us.tiktok.com/university/essay?knowledge_id=6837879804970754

### Current decision
- Keep Avoylo as the selected direction.
- Replace the “find one seller first” execution framing with: **build the smallest credible host/seller operational core, create Host supply interest, and recruit multiple post-dropship / hero-SKU seller leads; activate only a tiny number of matched physical pilots once economics and operational requirements are known.**
- Do not call the side-gig Host concept unique. The differentiation under test is **prepacked-parcel simplicity + lower host setup + tiny distributed forward-stock batches**, not the existence of home garages.


## 49. Avoylo legal / payment / operating architecture review — 2026-09-26

User asked for a detailed pre-implementation review, especially laws, contracts and the operating decisions that must be fixed before Avoylo handles real inventory.

### Core architecture recommendation
- Treat Avoylo's first customer relationship as B2B fulfillment/logistics service, NOT as the merchant of record for the seller's consumer sale.
- End-customer checkout, product legality, product warranty/returns/refunds, consumer-facing sales tax and customer service remain with Seller unless a later product explicitly changes this.
- Seller pays Avoylo for logistics/storage/handling. Avoylo separately accrues/pays Host compensation. Do not route consumer purchase proceeds through Avoylo in the first model.
- This does not eliminate tax, worker-classification, storage, insurance or state nexus obligations; it only avoids unnecessary payment/merchant-of-record complexity.

### Payments
- PayPal Payouts officially supports payouts to vendors/contractors/customers. This is conceptually closer to Host payout than multiparty consumer checkout.
- PayPal Complete Payments Platform / multiparty seller onboarding requires PayPal platform approval. Do not make that an MVP dependency.
- Suggested early flow: Seller -> Avoylo B2B payment / prepaid balance; Avoylo -> Host earnings payout. Keep a ledger; no end-customer payment through Avoylo.
- U.S. PayPal User Agreement currently requires an individual U.S. account holder to be 18 or age of majority; a U.S. business account must meet PayPal's U.S. business eligibility terms. Because the founder is a minor, real contracts/payment accounts need an adult authorized representative / legally valid entity structure before live money/inventory. Do not attempt to bypass platform age/KYC rules.
- Exact entity, ownership and authorized-signer structure remains state/country-specific and is not fixed here.

Sources:
https://developer.paypal.com/payouts/overview/
https://developer.paypal.com/platforms/get-started/
https://www.paypal.com/us/legalhub/paypal/useragreement-full?locale.x=en-US

### Carrier / labels
- Do NOT have Hosts log in to Seller carrier accounts or freely share carrier credentials. UPS terms explicitly restrict third-party use/resale of UPS accounts/services without approval.
- Prefer a platform-friendly shipping API/aggregator for the first technical path. EasyPost documents Child Users for customers/platforms and separate carrier credentials, and Shippo explicitly lists logistics providers/marketplaces as API use cases.
- Label should be generated centrally. Host sees only the task + printable label.
- Need to test carrier-specific label display/return-address behavior so an end customer does not unnecessarily receive a Host's residential address. Keep actual ship-from, billing/rating and return-address rules carrier-compliant rather than spoofing location.
- Customer returns should NOT go to Host in the first wedge. Seller or an approved commercial returns address handles them.
Sources:
https://www.ups.com/us/en/support/shipping-support/shipping-special-care-regulated-items/prohibited-items
https://docs.easypost.com/docs/users/child-users
https://support.goshippo.com/hc/en-us/articles/4404415886491-Get-started-with-the-Shippo-API

### Biggest legal red zones
1. **Host worker classification.** Calling Hosts 'independent contractors' in ToS does not decide status. IRS uses behavioral control, financial control and relationship facts. IRS Pub. 15-A (2026) also explicitly lists a possible statutory-employee category for an individual who works at home on supplied goods that must be returned/delivered as directed, if additional conditions are met (personal service, insufficient investment, continuing relationship). Avoylo's casual home-host model is close enough that this needs targeted tax/employment review before public paid operation. DOL's federal analysis is also in 2026 rulemaking; state rules can differ or be stricter.
2. **Home zoning / lease / HOA / local licenses.** SBA states home businesses can still be subject to local zoning. 'Host self-certifies' does not make a prohibited home warehouse legal. Initial metro/ZIP activation needs a local eligibility screen.
3. **Storage / bailment / warehouse law.** State UCC Article 7 implementations define warehouse/storage-for-hire concepts, but registration/licensing/receipts/lien rules vary. Example only: Texas Business & Commerce Code defines a warehouse as a person engaged in storing goods for hire. Do not assume every residential Host is legally exempt from warehouse rules.
4. **Seller tax nexus.** Inventory physically placed in a state can create seller registration/tax obligations independent of economic thresholds. California officially treats stock of goods in a third-party fulfillment location as a place of business and says an out-of-state retailer whose only California presence is inventory can be treated as a California retailer. Therefore Avoylo must NOT silently route a Seller's inventory into new states. Seller chooses/approves states and confirms its tax position.
5. **Insurance / entrusted goods.** Homeowner policies must not be assumed to cover business activity or third-party inventory. SBA specifically distinguishes home-based business coverage/riders and general business insurance. Before real public inventory, get actual quotes for the specific model, including third-party/customer goods custody and general liability as applicable.
6. **Prohibited/restricted goods.** Carrier and payment terms restrict hazardous, regulated and other goods. Terms cannot cure prohibited shipping. Initial Accepted Goods policy should be intentionally narrow.

Primary sources:
https://www.irs.gov/publications/p15a
https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee
https://www.sba.gov/counseling/launch-your-business/
https://www.sba.gov/business-guide/launch-your-business/get-business-insurance
https://www.uniformlaws.org/acts/catalog/current/ucc
https://www.statutes.legis.state.tx.us/Docs/BC/htm/BC.7.htm
https://www.cdtfa.ca.gov/industry/local-and-district-retailer-taxes/local-tax.htm
https://cdtfa.ca.gov/formspubs/pub44/place-of-sale.htm
https://www.ups.com/us/en/support/shipping-support/shipping-special-care-regulated-items/prohibited-items

### Initial accepted-goods recommendation
For first physical operation, accept only low-value, durable, nonhazardous, nonperishable, nonregulated, nonfragile prepacked parcels. Exclude at minimum hazardous materials, alcohol, tobacco/vape, firearms/weapons, drugs/controlled products, perishables, live goods, high-value jewelry/metals, loose lithium batteries and items requiring special carrier contracts/handling. Consider temporarily excluding liquids, food/supplements, cosmetics and battery-containing electronics until carrier/insurance/claims policies are mature. Exact exclusions need carrier/insurer review.
- Seller warrants accurate commodity description and package weight/dimensions.
- Seller keeps title to inventory.
- Host never opens customer-ready parcel; damaged/tampered parcel is quarantined, photographed and escalated.

### Seller tax/nexus product requirement
- State-level inventory placement must be opt-in by Seller, not automatic.
- UI should warn that storing inventory in a state can create tax/registration obligations and require Seller confirmation before assignment.
- First seller cohort should preferably already be registered/operating in the launch state or have confirmed the placement with its tax advisor. This is a strategic acquisition constraint, not just a legal footer.

### Host-side product / ops requirements
- Host is 18+, verified identity/address, verified right to use storage location, secure dry space, smartphone, declared availability, and label-printing path.
- Customer/end-recipient pickup at Host's home is prohibited in first scope.
- Host decides available capacity and accepts/declines inbound batches before commitment; accepted batches have clear service windows.
- Initial operational promise should be carrier handoff by a clear business-day cutoff, not same-day local courier delivery.
- Every parcel gets unique ID/QR and append-only custody events: created -> inbound -> received -> stored -> reserved -> label ready -> handed off -> carrier acceptance -> delivered/exception.
- Inbound and outbound condition photos can support claims; do not claim photos eliminate legal liability.
- First-scale hardware: phone camera; activated Host may need normal printer/thermal printer path. Do not assume every casual Host already has a label printer.

### Seller-side / first wedge
- Best initial ICP remains post-dropship / hero-SKU or fixed-bundle merchants with repeat U.S. demand.
- Strongest first physical parcel pattern: one order corresponds to one already sealed parcel/fixed bundle.
- Multi-SKU arbitrary pick/pack, kitting, repacking and Host returns inspection remain out of first scope.
- Seller pays inbound positioning freight. Economics must include that inbound cost and the merchant's prepack labor; do not treat host labor savings as free.

### Commercial / claims structure
- Proposed first pricing architecture: Seller pays Avoylo storage + outbound handling + postage/pass-through + explicit platform/service margin; Host earns storage/capacity compensation + handoff compensation. Exact prices NOT selected until unit economics.
- Do not use Host as a direct recipient of Seller customer payment. Avoid consumer escrow.
- Keep Seller and Host ledgers distinct; host payout status is not inventory status.
- Initial physical pilot should use strict per-parcel and per-Host declared-value caps. Numeric caps are still to be chosen from insurer/risk quotes; do not invent legal limits.
- Claims need documented custody state, declared value, filing deadline, exclusions and escalation. Liability caps/indemnities are not substitutes for insurance and may be state-dependent.
- Do not allow Host to keep/sell abandoned goods under a generic ToS clause. Unpaid/abandoned inventory disposition can intersect with state warehouse/lien law and requires state-specific terms.

### Contract/document architecture
Do NOT rely on one giant website ToS. Before public physical handling, use separate documents:
- Seller Fulfillment Services Agreement.
- Host Services / Space Agreement (final title depends on classification review; do not assume 'independent contractor').
- Accepted / Prohibited Goods Policy.
- Operational SLA and Host Standards.
- Loss / Damage / Claims Policy.
- Privacy Policy + recipient-data handling terms; later DPA if enterprise/seller requirements justify it.
- Website/App Terms for software access.
Key Seller agreement concepts: Seller is merchant/product owner; accurate goods declaration; title remains Seller; tax/state-placement approval; customer support/refunds/product liability remain Seller; payment, removal/offboarding, claims and limits.
Key Host agreement concepts: space eligibility; custody duties; no opening/use/unauthorized relocation; capacity/availability; scan requirements; privacy/confidentiality; payment calculation; offboarding and inventory handback; local-law/property authorization; insurance/worker-status provisions based on actual reviewed model.
Terms must not falsely claim a legal status that facts/law do not support.

### Product/privacy decisions
- Host exact home address should be disclosed only as operationally necessary; never publish it.
- End customer should not visit Host.
- Collect the minimum recipient PII needed to create/handle a shipment. Host needs label/task data, not the Seller's full customer database.
- Separate from-address / return-address capabilities must be tested with the chosen shipping provider. Do not falsify ship-from location.
- Seller remains responsible for end-customer sales relationship; Avoylo can surface tracking/status.

### Build order recommendation
The software is not the hardest part. Minimum credible core:
1. Seller/Host/Admin auth and approval.
2. Host location/capacity/availability.
3. Seller SKU/package profile + inbound batch.
4. parcel-unit IDs/QR.
5. custody scan state machine and immutable events.
6. order import first by CSV/manual + one Shopify path later/parallel.
7. shipping rate/label/tracking sandbox using a platform-friendly API.
8. Seller balance/fee ledger and Host earnings ledger; PayPal sandbox/Payouts integration when eligible.
9. exception/claim/admin reconciliation.
10. local eligibility flags for activated Host ZIPs.
Do NOT spend early time on AI, ratings/gamification, nationwide routing, dynamic pricing, returns marketplace, custom courier network, or end-consumer checkout.

### Entity / founder constraint
The founder is a minor. Do not ignore this at the contract/payment stage. U.S. PayPal requires an individual user to be 18/age of majority. Before real money/contracts/inventory, choose a legally valid entity/authorized-adult arrangement with professional review rather than using false age or another person's account informally. The exact ownership/manager structure is not decided here.

### Priority before live physical inventory
The three highest-priority external checks are:
A. Host classification + home-storage legality for ONE selected launch state/metro.
B. insurer quote/coverage for third-party inventory at approved residential Host locations.
C. seller tax-nexus implications for inventory placed in that state and Seller onboarding disclosure/consent.

Do not hire a general lawyer to review every U.S. state before selecting a market. First pick the likely launch state/metro based on seller demand, Host feasibility, carrier economics and these legal screens; then perform targeted state-specific review.

No contract, account, payout, shipment, Host recruitment, Seller outreach, inventory intake or spending was executed during this review.
