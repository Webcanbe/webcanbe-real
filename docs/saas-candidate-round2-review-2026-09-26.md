# SaaS candidate research round 2 — decision checkpoint

Review date: 2026-09-26
Status: research assessment only; no new business, build budget, outreach, purchase, or deployment authorized or executed.
Related continuity: docs/startup-research-reports-review-2026-09-25.md; docs/session-live-handoff.md sections 44–45.

## User objective and inputs

The user wants a low-capital software business, preferably self-serve SaaS, whose recurring customer outcome is delivered by software rather than founder-operated consulting. The intended market is global/English-speaking, with a credible large-company path and comparatively accessible distribution. Do not replace that objective with a small utility merely because it is easy to implement. Do not require a mature moat or a statistically proven $100M market before any cheap experiment, either.

Three reports supplied:
1. Generic spreadsheet AI; Shopify AI social-content generator; GitHub issue/PR triage AI, with GitHub as preferred prototype.
2. External-file multilingual subtitle updates preserving approved translations after edits; INVESTIGATE, with existing-product comparison before a prototype.
3. Local video-revision comparison highlighting changed sections; INVESTIGATE, with a proposed 30-hour experiment including prototype work after a comparison gate.

Evidence scope: user-pasted reports; relevant sections and source register of Library software-opportunity-review-2026-09-25.md (file_0000000000ec82439044e00818e82dae); selected current official competitor/product/distribution documentation. Not every rejected direction or vendor claim was independently audited. No customer interviews, hands-on competitive benchmarks, market-population counts, or payment tests were performed.

## Current recommendation

- Report 1: reject the submitted candidate designs as research-backed selections. The stated differentiators substantially overlap documented existing products; market expansion, easy acquisition, and performance claims are not supported.
- Report 2: retain only as an optional narrow investigation, not a selected venture-scale SaaS. Among reports 2 and 3, this is the cheaper/more concrete question to investigate first because the deliverable preserves already-reviewed translation work and the initial inputs are text files. This is an allocation judgment, not measured commercial superiority.
- Report 3: park as a primary business candidate. It describes a testable utility but has not shown an advantage over existing products, that reviewers actually avoid enough work, or that the paid segment supports the intended scale.
- No automatic acceptance of either report's 30/32-hour build budget. Do not make a combined subtitle-plus-video platform to manufacture market breadth.
- No candidate currently merits selection as the user's next main company. This is not a conclusion that these markets contain no opportunities.

## Report 1 — checked contradictions

### Spreadsheet AI

Google's official documentation and announcement describe an AI function in Sheets for generation, summarization, categorization, and sentiment analysis with specified inputs and access conditions. GPT for Work explicitly markets row-by-row bulk categorization, cleaning, summarization, translation, web research and outputs written into spreadsheet cells. Therefore natural-language instructions across many rows is an existing product outcome, not the submitted startup's new entry point.

GPT for Work's advertised throughput and installation numbers are vendor claims, not independent evidence that the proposed competitor can achieve equivalent performance or convert customers. Its pricing page includes credit-pack/pay-as-you-go terms; do not repeat the report's $25/month as a universal verified current price.

Sources:
- https://support.google.com/docs/answer/15877199?hl=en
- https://blog.google/products-and-platforms/products/workspace/workspace-feature-drop-ai-sheets/
- https://gptforwork.com/gpt-for-sheets
- https://gptforwork.com/pricing

The suggestion of Korean-enterprise language specialization also conflicts with the stated global/English-first search; it is not an approved strategic change. Extra connectors, generic BI and localization are not demonstrated purchasing advantages.

### Shopify social content

Outfy's official Shopify listing explicitly describes automatic product videos, promotions, product images, scheduling and posting to social networks, including avoiding sold-out products; it has a free tier and paid tiers. Minta's listing describes product/collection creatives, automatic social posting, branding and a catalog workflow. This refutes the report's framing that relevant alternatives only do general copy or scheduling and that Shopify product-data integration is the new advantage.

Sources:
- https://apps.shopify.com/outfy
- https://apps.shopify.com/minta-video-auto-post

A real app review can expose an unresolved result, but an isolated negative review does not prove a large unserved segment or that a new implementation can solve it. Do not infer easy acquisition from marketplace presence.

### GitHub issue triage

GitHub officially documents an AI-powered issue-intake Action that analyzes issues and provides comments/labels; default triggering and repository-admin setup are specified. GitHub Agentic Workflows, currently described as public preview, explicitly list contextual issue triage and labeling by type/priority, among other automations. These are closer alternatives than generic code completion alone. They have their own setup, engine and permission requirements, so do not mislabel them as universally zero-cost, zero-setup native automation.

The current Copilot plan table lists individual Free/Pro paths and Business at $19 per granted seat/month; the report's description of Copilot Workspace as an enterprise-only $19 product is not a sound current plan comparison. This review did not independently establish the Workspace sunset date from readable official page text, so does not repeat it as a newly verified fact.

Sources:
- https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai
- https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows
- https://docs.github.com/en/copilot/get-started/plans

The proposed first experiment tests labeling capability rather than the decision-critical hypothesis: why a reachable paying team would adopt this over current Actions, tooling or manual handling. An arbitrary 70% label-validity target is not enough without class distribution, baseline performance, missed urgent issues, correction burden and saved operator time. Do not post experiments to third-party repositories without permission.

## Report 2 — what remains plausible and what blocks selection

The actual hypothesis is not generic AI transcription. It is moving approved existing translations through externally edited source captions without importing everyone into a new project platform.

Stellar publicly offers multi-language conforming to edited video and an active-user/day price model starting at EUR1, with task/add-on conditions. CaptionHub documents source/translation relationships and source changes, but also limits for split/merged translations, independent timing changes, and timing/split propagation after approval. These limitations provide a concrete task to investigate, not proof no competitor solves it. SubPress explicitly accepts reference media and/or original-language subtitle files for synchronization.

Sources:
- https://yellaumbrella.com/the-stellar-suite/
- https://yellaumbrella.com/pricing/
- https://support.captionhub.com/creating-and-editing-captions/uz47hySTrT5PGcSv3hNgUj/source-propagation/q5A1FMofEWzHHXrPkP2gut
- https://www.bitpress.com/subpress

Adoption issue: the user must have old source captions, new source captions and existing translations. Any work to generate/export/reconcile these inputs belongs in total task cost. Do not assume all target teams already have the inputs.

Pricing consistency check from the report's own hypothetical prices: if the $9 package and $99 monthly plan cover comparable work, four monthly revision packages cost $36 on usage pricing, eleven cost $99. The entry condition of at least four revisions/month does not establish a reason to subscribe at $99. Above eleven packages or with proven additional subscription value the comparison changes. No usage distribution or paid conversion was measured.

Scale: at $99/month, $100M annual revenue requires 84,176 fully paying team accounts, rounded up. The eligible population and attainable share are unknown. At $300/month it requires 27,778, but the added recurring value needed for that price is not established. These are conditions, not a TAM or revenue prediction.

## Report 3 — distinct unresolved issues

Matchbox officially accepts actual reference video files and documents audiovisual matching followed by differences that users can inspect. Ziflow documents version comparison on Free as well as paid plans, with Auto Compare for static files and video; its pixel-based limitations do not establish that every time-alignment capability is absent. DualView.ai describes a local-first browser comparison workspace with no account required. Do not confuse it with dualview.app, a separate dual-subtitle language-learning extension.

Sources:
- https://www.thecargocult.nz/products/matchbox/
- https://help.ziflow.com/hc/en-us/articles/30725270836372-Compare-proof-versions
- https://www.dualview.ai/

All are documentation/product claims; this review did not run them on the same files. Browser/local/no-upload alone is not a unique entry point. The remaining possible advantage is effective temporal alignment and change-oriented review for a specified workflow.

The largest value risk: if reviewers still need a full rewatch for audio, story, subtitles, newly introduced defects or overall approval, a perfect visual-change list may add a task without removing enough existing work. This is a hypothesis, not an asserted universal reviewer behavior. Measure total review plus preparation and corrections, not only detection accuracy or runtime. The report's visual-only scope should not silently expand to full multimodal QA to save the hypothesis.

Technical risk remains substantial despite a minimal UI: insertions/deletions, repeated scenes, re-encoding noise, brief changes, dissolves and codec/device variance can affect usefulness. Availability of video APIs is not proof of a reliable product in sixteen hours.

At the report's hypothetical $2,000 annual revenue per team, $100M requires 50,000 paying teams. A supported population and route to that reach are not provided.

## Distribution and research interpretation

A marketplace is a venue, not a verified customer source. Need specific discovery, click, install, activation and paid-use evidence. Google itself distinguishes installations by domain, enabled seats and individual installation; installation totals are not paying-company counts.

Sources:
- https://developers.google.com/workspace/marketplace/use-analytics
- https://developers.google.com/workspace/marketplace/get-featured

Both media reports propose aescripts. Its official author page specifies an application process, 30% commission, and accepted standalone software/plugins/scripts/extensions. Pure web SaaS acceptance and sales are not established merely by naming it. The two reports naming the same channel is not independent market validation.

Source:
- https://aescripts.com/faq/article/view/faq/become-an-author/

Do not tighten the generic research prompt indefinitely or reward either forced optimism or exhaustive rejection. Distinguish:
- verified capability overlap;
- unknown customer-choice advantage;
- resource mismatch;
- a cheap discriminating experiment;
- a small profitable product versus a plausible large company.

The next evidence priority, if these media candidates remain under consideration, is a concrete underserved buyer segment and practical channel access plus a representative current task—not a new SaaS shell. Examine whether a small number of real comparable teams have frequent work, accessible inputs, a demonstrable unsolved step and an economically credible buying reason. Do not automatically run outreach or pay for comparisons.

## Exact next state

Report 1's three generic designs are not selected. Report 2 remains optional investigation; report 3 is parked as a main-business choice. No venture-scale winner, new business, budget, or experiment has been approved. No success-probability number is invented. The user remains free to explore a materially different software problem rather than defend these outputs or return to Webcanbe by default.
