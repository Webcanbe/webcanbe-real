# Independent SaaS proposal: Demand-to-Class

Date: 2026-09-26
Status: assistant-selected candidate for a bounded software experiment, NOT a verified business, adopted company, approved budget or deployed product.
Related: docs/saas-candidate-round2-review-2026-09-26.md and docs/startup-research-reports-review-2026-09-25.md.

## User request

The user asked the assistant to independently find and design a software business under the agreed strict conditions, rather than supply another ideation prompt or merely critique other research. Constraints remain self-serve software delivery, low initial capital, small team, English-speaking/global customers, an identifiable acquisition mechanism, recurring customer value and a coherent very-large-company path. No consulting/audits disguised as future SaaS. Do not assume an incumbent-free market, guaranteed virality, privileged data, or established founder audience.

## Selected proposal

Working descriptive name: Demand-to-Class. No trademark or domain availability was checked.

Convert existing unscheduled course enquiries into feasible class proposals and confirmed enrollments. First target is adult small-group language schools that collect learners' levels and availability and form groups continuously when enough compatible learners exist.

The customer is the school owner/admissions operator, not the learner. Initial screening hypotheses: roughly 3–20 instructors, dozens of pending/new enquiries, several group-formation cycles per month, minimum class size around 3–6. These are proposed qualification boundaries, not measured market norms.

The product does not source students or instructors. It does not teach, assess learners, operate a school, or replace the whole LMS. A single business can benefit using its own existing demand; no two-sided marketplace is required.

### Proposed recurring software workflow

1. Operator enters verified course/level definitions, possible weekly blocks, instructor/room resources, minimum/maximum enrollment, price and costs.
2. Existing enquiries are imported in a supported format or learners submit availability through a link.
3. Engine proposes mutually feasible groups, without counting a learner as enrolled in multiple incompatible proposals.
4. Operator reviews proposals and locks existing confirmed classes.
5. Learners receive specific class offers and confirm/decline by a stated deadline.
6. Proposal, student response, enrollment and payment are separate states. A feasible group is not a sold group. Existing operator payment systems can be retained initially.
7. Unconfirmed/expired demand returns to later proposals; confirmed enrollments are not silently moved.

First scope: one timezone, preapproved recurring weekly blocks, owner-provided levels, one requested course per learner. Multi-week rotations, arbitrary calendars, holiday/DST handling, all LMS integrations, automatic charging and a full school-management platform are out of first scope.

The founder must not manually group every school's students, perform assessments or chase confirmations as the recurring service. Customer approval and student choice are normal software inputs, not founder-operated delivery.

## Direct evidence of the workflow

These are official provider descriptions of their own enrollment practices, not interviewed customers, verified leads, or expressions of willingness to pay.

- Portal Languages says it has no fixed class schedule, continually forms groups of at least two primarily around learner availability, and has an agent contact applicants. Its public group offer lists $280 for eight one-hour weekly classes, minimum two and maximum five students.
  https://www.portallanguages.com/pricing
- Interlangues / ILT Languages describes assessing needs, availability and level to form groups of 3–6, with courses starting when enough participants exist. Its current operating/contact status must be rechecked before any outreach.
  https://www.interlangues.org/courses/group-courses/weekly-group-courses/
- Buena Onda describes pre-enrollment, level assessment, groups of 2–4, student/tutor availability and rolling four-lesson packages. The group-enrollment workflow was the relevant evidence; its legal statements were not independently evaluated or adopted.
  https://buenaondaspanish.com/terms-and-conditions/
- Symphonia Music describes small group lessons with a minimum of three and term billing. This supports a possible adjacent task, not a measured global market.
  https://symphoniamusic.co.nz/pages/group-lessons

## Close competitors found BEFORE recommendation

- LinxTime explicitly provides quorum-based auto-confirmation, group polls, capacity/waitlists, recurring events and conditional event funding. Its public pricing lists Organizer $9/month and Business $29/month. Quorum and commitment collection are NOT a new invention.
  https://linxtime.com/pricing
  https://linxtime.com/terms
- ScheduleSorter advertises constraints for students/attendees, levels/age groups, instructors, rooms, availability, public enrollment, solver runs and pinned sessions. Prices shown: $24/$39/$69 per month. Its own limitations include no attendee payments/memberships and weekly rather than multi-week rotation. The scheduling solver is NOT the differentiator or moat.
  https://schedulesorter.com/
- CourseDeck describes language-level class pages, trial demand, registrations, open spots and waitlists. An enrollment page or centralized demand view alone is NOT new.
  https://www.mycoursedeck.com/solutions/language-schools
- Bookwhen and established class-management software cover existing-class waiting lists, booking and enrollment workflows.
  https://support.bookwhen.com/en/articles/753351-waiting-lists
  https://www.jackrabbitclass.com/pricing/
- KnowStory and Thetix surfaced as further close cohort/constraint-planning comparison leads. Search descriptions were not counted as verified production capability or traction. KnowStory's retrieved homepage was a JavaScript shell.
  https://knowstory.com/
  https://thetix.dev/

No same-task competitive benchmark was performed. Missing website bullets are not proof of unsupported functionality. New product sites' own claims do not establish adoption or reliability.

## Specific remaining customer-choice hypothesis

The potential improvement is the full operating loop across multiple NOT-YET-FORMED groups sharing the same enquiry pool:

unconverted demand -> compatible nonoverlapping class proposals -> expiring confirmations -> actual enrollments -> reuse of unconverted demand -> next cycle.

Only schools where this loop is fragmented or costly and where software yields better actual enrollment or less total operator work are potential buyers. Existing products or their combination may already handle it adequately. Calling this 'revenue software', 'neutral' or 'all-in-one' does not rescue the hypothesis if they do.

Do not promise extra classes or revenue based only on a mathematical grouping. Customer acceptance, suitable instructors, actual willingness to pay and incremental operating costs matter. This is a next-test choice, not proof that all strict gates including distribution and $100M market size passed.

## Technical work actually completed this turn

Local artifacts under /mnt/data/demand_to_class:
- DECISION.md: Korean research/design note.
- solver_spike.py: limited Python allocation engine.
- synthetic_test_results.json: recorded synthetic test results.
- README.md: execution instructions.
Archive: /mnt/data/Demand_to_Class_Research_2026-09-26.zip.

The local implementation used SciPy 1.17.0 mixed-integer optimization and binary person/class assignments. It enforces course/level/time/budget eligibility, class minimum/maximum, person nonduplication and instructor/room conflict constraints. Objective is hypothetical class contribution, not predicted demand or actual revenue.

Observed tests:
- 12 named example/edge checks passed.
- 60 small randomized synthetic cases matched a separate exhaustive-search objective calculation.

Useful calculation correction: the original expectation that all 12 synthetic applicants should be allocated to three classes was wrong at $400 fixed cost per class. With $200 fee and $10 variable cost per learner, 10 learners/two classes yield hypothetical contribution $1,100 versus $1,080 for 12/three. The expectation was corrected and a separate $300-fixed-cost case correctly chooses 12/three at $1,380. No customer outcome is implied.

No web UI, email delivery, auth, actual student response, payment, concurrency, large-scale performance, competitive benchmark or production deployment was built or tested. The spike proves a limited computational mechanism, not SaaS readiness or commercial demand.

Official algorithm interface reference:
https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html

## Distribution proposal

Find providers whose own websites explicitly say classes form on demand, depend on availability, or require minimum enrollment. This is an identifiable prospecting signal, not proven response or conversion.

Initial message:
'Find the classes hidden in your waiting list.'
'Collect availability, propose viable groups, and confirm enrollment — without replacing the tools you already use.'

Research invitation, NOT sent:
'Your site says you form small groups around students\' availability. I\'m testing a small tool that turns existing enquiries into feasible class offers, while keeping your current billing setup. Could you try it on one anonymized waiting list and compare the result with your usual process?'

First 1–10 operators: targeted research recruitment, with software doing the work.
Next 10–100: self-serve sample/one planning run, task-specific demonstration, then test distribution via providers managing school websites or admissions tools. No partner was contacted or verified willing to distribute.
Later: expand only channels with measured arrival, activation, repeat use and payment. Endless custom calls are not the intended model. Student links help a school's recruitment but do not automatically acquire SaaS-paying operators.

## Pricing and economics: assumptions only

Proposed initial software test price: $99/month for one organization. Not customer-validated. This is above several scheduling alternatives and requires demonstrated incremental value.

Illustrative monthly direct costs at $99: execution/storage/mail $5, payment-cost budget $5, variable support 15 minutes at $30/hour=$7.50. Contribution before fixed development, general overhead and acquisition is $81.50. At two support hours the same calculation leaves $29. Actual provider fees, usage and support are unmeasured.

Illustrative operator ROI: one additional four-person group at $250/person creates $1,000 gross tuition; assumed additional delivery cost $600 leaves $400 before the software fee. This is a hypothetical justification to test, not an achieved or average effect.

## Scale and defensibility

Coherent expansion: same school's repeated group formation, renewals/unconverted demand, then multi-site teacher/room/capacity allocation; later other paid instruction with the same level/availability/minimum-group constraints; eventually an embedded engine for other operators' software if proven.

Do not add banking, instructor marketplaces, AI teaching or unrelated software to inflate TAM.

At $99/month, 1,000 paying organizations produce $1.188M annual revenue. A mature conditional scenario of 30,000 organizations at $300/month produces $108M/year. $300 requires additional proven recurring value, not a rebrand. With 100,000 eligible organizations the implied share is 30%; with 300,000 it is 10%. Neither eligible population was established in this research.

Jackrabbit reports serving over 17,000 schools in 35 countries in a December 2025 release; current pricing shows $49/month starting and an Enterprise tier at $245/month. These establish vendor-reported multi-country scale and offered software prices in adjacent class management, not Demand-to-Class TAM, paid account count or attainable share.
https://jackrabbittech.com/blog/jackrabbit-technologies-receives-fast-50-award-from-cbj/
https://www.jackrabbitclass.com/pricing/

Initial defensibility is weak. The solver is not proprietary, a model is not a moat, and customer data is not automatically reusable across customers. Potential longer-run advantage would come from embedded verified enrollment/renewal workflows, reusable operational knowledge and an efficient distribution route. None is already possessed.

## Proposed next discriminating test — no execution authorization

Additional founder effort at most 12 hours, cash at most $50; initial observations over 3–5 business days where feasible. No automatic extension for customer procurement or repeat-use delays.

1. Find three appropriate operators with existing enquiry data and compare their best current workflow, including nearest specialist tools.
2. Only if a gap remains, wrap the already-tested limited engine in a simple file-input/result experience, not a full SaaS shell.
3. Operator chooses viable proposals and sends them through existing channels; record actual acceptance/enrollment separately from feasibility.
4. Consider another bounded iteration only when two unrelated operators get a meaningful whole-workflow benefit, actual student confirmation/enrollment and concrete interest in paying for repeated software use. This is an internal investment gate, not PMF.

Stop/park if current tools solve the task adequately, enquiry volume is insufficient, data preparation outweighs benefit, founder judgment is needed each cycle, actual enrollment does not follow theoretical matching, or the eligible recurring buyer population is too narrow. Recruitment failure is inconclusive about demand, not permission to build indefinitely.

## Exact current state

One concept independently selected as the next candidate to test; core limited computation locally checked. Real buyer behavior, competitive advantage, low-cost repeatable acquisition, paid retention and sufficient market ceiling remain unverified. No customer contacted, no new spending, no business adopted, no production modified. Preserve Webcanbe assets and earlier commitments; this research does not cancel them.
