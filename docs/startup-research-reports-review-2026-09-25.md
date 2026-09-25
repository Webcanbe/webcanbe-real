# Startup research reports — independent review

Date: 2026-09-25
Status: research assessment only. No new business adopted, no customer outreach sent, no product or deployment changed.
Continuity: follows sections 44–45 of docs/session-live-handoff.md. Preserve the user's large-global-company goal while separating a research candidate from a commitment to build.

## User inputs and scope

The user supplied two startup-research outputs:
1. A summary of startup-opportunity-investment-review-2026-09-25.md: 40 defined candidates rejected for BUILD, no investment finalist, optional investigation of shared supplier-invoice acceptance exceptions.
2. A full report selecting vendor-neutral B2B Transaction Change Assurance as a conditional TEST candidate. Initial offer: a $1,500 / 48-hour audit of historical versus candidate EDI/ERP/WMS transactions; claimed expansion to continuous regression, observability and transaction assurance.

The first report was located and read in the user's Library, file_id file_000000006cf88206b158adcf08274efb. The second was assessed from the text provided directly by the user. Embedded citation handles in copied text were not treated as independently verified references.

This review focuses on the decision-bearing claims, especially the second report's final candidate. It does not claim to have independently re-audited every structural shift, legal statement, competitor, or all 72 generated business definitions across the two reports.

## Current recommendation

- Neither report currently justifies adopting a new primary business or committing 1–2 years.
- The first report's refusal to manufacture an investment winner is better supported than the second report's high founder-fit/distribution/validation scores.
- However, rejecting a current design is not proof that an entire market is exhausted. Unknown demand is not the same as disproved demand. A competing product description is not an independent performance benchmark.
- The second report contains a coherent buyer-trigger hypothesis, but its competitive review missed important independent integration-testing products. Downgrade the candidate to an optional, evidence-gathering question rather than the default next business or an immediate 60-account sales campaign.
- Do not automatically move to healthcare prior authorization or CRA merely because the EDI candidate weakens. Each needs its own access, delivery capability, competitor comparison and adoption evidence.

## Newly verified competitive evidence

### Int4 APITester / Shield

Official product manuals describe capture of historical business messages, message injection, comparison of current execution with historical data, technical and functional behavior validation, external-system virtualization, and backend business-document validation in APITester.

Official non-SAP support documentation lists Software AG webMethods, Boomi, Microsoft Azure Integration Services, SAP/non-SAP API management implementations and generic SOAP/REST interfaces. The suite is SAP-oriented; support for these technologies does NOT prove universal compatibility with every EDI/ERP/WMS stack.

The Automation Objects manual describes reference/current backend system lines, migration examples, configurable payload-validation rules, and output matching. It explicitly recognizes that not every difference is an error: timestamps and expected changes need handling. These are closer to the proposed regression outcome than a generic syntax validator.

Sources:
- https://help.int4.com/int4-suite-knowledge-center-library/3.10/int4-apitester
- https://help.int4.com/int4-suite-knowledge-center-library/3.10/non-sap-testing
- https://help.int4.com/int4-suite-knowledge-center-library/3.13/int4-shield
- https://help.int4.com/int4-suite-knowledge-center-library/3.10/automation-objects
- https://help.int4.com/int4-suite-knowledge-center-library/3.10/boomi-inbound

### Figaf

Figaf's B2B Management page describes recording a real message, replaying it against an agreement and comparing output, plus partner agreements, migration, change/transport, validation and monitoring on SAP.

This is a SAP-focused offering, not proof that every proposed cross-provider use case is solved. It does refute treating real-traffic regression and an add-on quality layer as an untouched category. Figaf also has historical Seeburger migration/regression material, so the general mechanism is not solely a new consequence of 2026 AI.

Sources:
- https://figaf.com/figaf-b2b-management/
- https://figaf.com/getting-sap-integration-suite-right-from-day-one/
- https://figaf.com/make-better-regression-test-cases-with-figaf-seeburger-migration-tool/

### Additional discovery, not validated traction

WOYB's EDI Navigator publicly describes deriving EDI profiles and test packages from production exchange data. No customer count, independent performance test or customer contract was verified for this product. It is an additional comparison lead, not an assertion of market dominance.

Source: https://woyb.de/edi-navigator/

### Supplier-portal candidate in report 1

Tesorio's official help documents PO matching, pre-submission validation, invoice submission, portal monitoring and setup prerequisites. Therefore the first report correctly refuses to characterize existing AR tools as merely passive dashboards. Performance and coverage on an actual customer case still need testing; product claims alone do not establish complete outcome equivalence.

Sources:
- https://help.tesorio.com/en/articles/10699018-overview-of-tesorio-s-supplier-portals-agent
- https://help.tesorio.com/en/articles/11005647-enable-and-configure-supplier-portal-submissions
- https://help.tesorio.com/en/articles/9337357-supplier-portal-monitoring

## Decision-critical issues in report 2

### 1. Neutrality is a proposed mechanism, not a proven purchasing advantage

Some integration vendors may have incentives to retain customers, but it does not follow that they cannot offer migration testing, or that all independent testing vendors are absent. Int4/Figaf are important counterexamples to the provider-versus-neutral-tool dichotomy.

A viable wedge must name a specific buyer, stack, change event and outcome for which existing products are not usable or economically sensible, then explain why this is a repeatable segment rather than a one-off exception. Do not silently repair each competing feature by adding an unverified adjective such as neutral, intelligent or semantic.

### 2. Comparing files is not replaying a system

With old/new payload pairs one can identify differences. To replay a candidate system one also needs the execution environment or a customer-operated run, mapping/configuration, relevant state and output capture. To label a difference a business defect one needs an expected-result rule, not just the fact that old and new differ.

Historical successful traffic is a baseline, not complete ground truth for intentional changes, master-data changes, partner-specific acceptance and future edge cases. A 30–100-file audit may validate a narrow comparison service; it cannot by itself prove that a full cutover will not fail.

### 3. Zero code is not zero expertise or delivery cost

The current evidence does not establish the user's EDI/ERP domain expertise, access to representative test data, experienced delivery partner, or buyer introductions. AI-assisted web development strength does not automatically justify founder fit 9/10 or validation speed 10/10 for business-critical integration assurance.

Such capability can be learned or obtained with a specialist; it must be included in time, cost and unit economics. Do not sell an unproven 48-hour error-detection or cutover guarantee as an established capability.

### 4. Audit demand is not recurring software demand

A paid migration audit establishes willingness to pay for that deliverable. Continuous subscription demand additionally requires recurring changes, reusable test assets, low marginal human review and a buyer who wants an ongoing release gate. Consultant-channel incentives are plausible but unverified; an extra party can also add coordination and liability concerns.

### 5. Customer data is not automatically a cross-customer moat

A client's transaction history can create client-specific switching costs. It is not automatically exclusive, transferable between clients, or useful without the corresponding rules. Determine which rules or artifacts can be reused, what rights exist, what a customer can export, and whether each additional client actually reduces future labor.

### 6. Market arithmetic is not market validation

Report 2 proposes 8,000–20,000 target companies and a 4,000-customer route to $100M at $25k per year. Using that proposed account range as the denominator implies 20–50% penetration; neither the range nor willingness to pay was validated.

SPS reported $637.8M revenue for 2024 and $751.5M for 2025. These prove substantial revenue in its retail supply-chain business, not the independent change-assurance opportunity or its attainable share. The proposed $100M mature-company arithmetic also does not establish a path to the user's much faster large-company objective.

Sources:
- https://investors.spscommerce.com/news-releases/news-release-details/sps-commerce-reports-fourth-quarter-and-fiscal-year-2024
- https://investors.spscommerce.com/news-releases/news-release-details/sps-commerce-reports-fourth-quarter-and-fiscal-year-2025
- https://www.sec.gov/Archives/edgar/data/1092699/000109269925000025/annualreport_2024.htm

## Corrections to the previous research prompt

The prior prompt should not be treated as an immutable ideal methodology.

- A fixed requirement to kill 70% or 80% rewards a count rather than good discrimination.
- A literal 10x requirement is not a universal business law. The relevant question is whether the verified total improvement exceeds adoption, integration and payment costs by enough to cause behavior change.
- Lack of an incumbent, lack of risk and an already proven moat should not be jointly required before any inexpensive experiment.
- Distinguish evidence that falsifies a hypothesis from evidence that is missing, and from a current founder/resource mismatch.
- Competing on a customer outcome can be legitimate when a specific segment, distribution route or cost structure remains unserved; a shared category label is not sufficient rejection evidence.
- Asking for zero-code validation does not justify smuggling in expert consulting, customer data-access work or safety-critical judgments as free manual labor.
- A universal 72-hour paid-sale deadline does not fit every buyer. Use effort budgets and appropriate business-day exposure; no response over a weekend is not market rejection.
- Cheap prototypes, observed use, repeat voluntary use and downstream economic mechanisms may be more informative than prepayment for some consumer/creator tools. Do not force every promising company into high-ticket enterprise audits.
- Do not use or browse anonymous communities or DCInside; use the user's explicit source exclusions. Both the research design and follow-up sourcing should respect them.
- Long lists of neighboring finance/compliance/document workflows do not by themselves demonstrate broad opportunity discovery. Include creation, revenue expansion, convenience and new behavior, with concrete customer evidence rather than speculative novelty.

## Optional next evidence gate for the EDI candidate

Not a mandated new project or outbound campaign.

1. Review a real historical integration-change case with 2–3 practitioners who have performed such work. Ask what Int4, Figaf and their current scripts/services did not solve and why.
2. Obtain a sanitized or synthetic-but-realistic input/baseline/candidate dataset with expert-labeled intentional changes and genuine defects. First show that a credible limited diagnostic output can be produced.
3. Compare the same task, total setup effort, false positives, missed defects and ongoing labor against the strongest accessible existing approach.
4. Reopen a business case only for a recurring uncovered outcome and a reachable paying owner. Then define an honest paid scope; do not begin with a cutover guarantee or a fixed price presented as validated willingness to pay.
5. If those inputs or expertise cannot be obtained at a sensible cost, leave this candidate parked and diversify discovery. This is a resource/access decision, not a claim that nobody can ever build in the market.

## Exact continuation state

- Current recommendation: no new primary business selected from these two reports.
- EDI assurance remains an optional, lower-priority research question pending direct-competitor and expert-case comparison.
- No outreach, paid pilot, new spending, deployment, campaign change or shutdown executed.
- No numerical startup-success probability updated.
- Preserve the ambitious objective without treating one cautious report as proof all opportunities are gone, or one long optimistic report as proof a winner has been found.
