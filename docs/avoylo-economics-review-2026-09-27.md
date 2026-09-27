# Avoylo economics review — 2026-09-27

Status: DISCUSSION / USER APPROVAL REQUIRED. No fee rules are approved by this document. No application code, QA status, deployment, or live flag is changed.

Read with `docs/session-live-handoff.md`, especially sections 87–91. This review supersedes the assistant's earlier pricing recommendation as a recommendation only; it does not overwrite user-approved business constraints.

## Preserved user decisions

- Seller posts a storage offer; eligible Hosts can accept it. Host receives the agreed storage amount without an Avoylo storage percentage deduction. Avoylo's own fees are separate.
- Storage should have a size-aware minimum and a transparent recommendation. An observed market average must not be fabricated before there are transactions.
- Host income includes storage, receiving, and outbound handling. Approximately USD 200–300/month is an active-Host design goal, not observed or guaranteed earnings.
- Low-friction onboarding, Host availability/pickup constraints, and a 30-minute human first response to critical logistics incidents are intended service requirements. Exact support coverage and incident policies remain to be decided.
- The Host should verify the assigned QR and take a pickup-staging photo. Staging evidence is not carrier acceptance.
- The user requested another thorough pricing review and recommended entries for a PayPal business-information screen.

## Corrections to earlier reasoning

1. Amazon AWD is bulk storage and inventory distribution/replenishment. Its per-box processing fee is not the same service unit as one DTC customer parcel. It must not be used as proof Avoylo is cheaper per customer order.
2. ShipBob's public fulfillment-cost guide explicitly labels its table as an example, not necessarily ShipBob's service pricing. Its pricing page is quote-based. Do not repeat illustrative prices as a binding competitive quote.
3. Avoylo's platform fee allocation is not net profit. Payment collection, Host payout, support, claims/protection, consumables, infrastructure, and any foreign-exchange costs matter.
4. Postage collected at cost through PayPal still increases PayPal percentage fees. A pass-through line item is not free to collect.
5. A larger storage bid may be attractive to Hosts, but Avoylo has no measured data supporting a fixed 'fast match' tier. Label the suggested amount as a launch recommendation, not a market average or guaranteed matching speed.

## External facts checked on 2026-09-27

- PayPal advises using a recognizable statement name and avoiding special characters; a PayPal prefix can be supplied by PayPal itself.
  Source: https://history.paypal.com/us/cshelp/article/how-do-i-update-my-business-name-on-customers-credit-card-statements-help336
- PayPal's Korean merchant schedule lists international commercial receipts at 4.40% plus the currency-specific fixed fee (USD 0.30). Its Payouts schedule lists 2%, capped at USD 50 for an international USD payout. These are published product-specific rates; account country/negotiated rates and Payouts access were not verified. Do not apply the Payouts rate to ordinary manual commercial transfers by assumption.
  Source: https://www.paypal.com/kr/business/paypal-business-fees
- Amazon identifies AWD as bulk storage/distribution and contrasts it with FBA picking/packing/delivery.
  Source: https://sell.amazon.com/programs/warehousing
- ShipBob says its cost-guide table is an example, not necessarily its own pricing.
  Sources: https://www.shipbob.com/ecommerce-fulfillment/fulfillment-costs/ ; https://www.shipbob.com/pricing/
- ShipDazzle's published page lists USD 2.40/order processing plus USD 0.50/item pick-and-pack at 100 orders/month. A one-item example is USD 2.90 before other applicable items. This is not an all-in delivered-price quote.
  Source: https://shipdazzle.com/
- Simpl publishes fulfillment starting at USD 7/order with three picks, packaging, and postage, storage separately, and a USD 750 monthly minimum. Starting prices depend on the shipment and are not a matched quote for Avoylo's example.
  Source: https://www.simplfulfillment.com/pricing
- USPS Ground Advantage includes eligible free Package Pickup; designated-day route pickup is distinct from paid time-specific pickup. Address/service eligibility must be checked.
  Sources: https://www.usps.com/ship/ground-advantage.htm ; https://faq.usps.com/articles/FAQ/What-is-Package-Pickup

## Revised proposed pilot rates — not yet approved

For compact, sealed, customer-ready parcels fitting the initial operating model:

| Event | Seller pays | Host earns | Avoylo fee allocation |
|---|---:|---:|---:|
| Receiving, once per parcel | USD 0.40 | USD 0.25 | USD 0.15 |
| Outbound handling, once per fulfilled parcel | USD 1.70 | USD 1.00 | USD 0.70 |
| Storage | Accepted Seller/Host offer | 100% of agreed storage amount | USD 0 storage cut |
| Carrier postage / paid pickup | Actual separately disclosed cost | Not Host earnings | No assumed shipping markup |

Outbound handling includes the ordinary retrieval, QR verification, label application, and staging-photo work; do not charge/pay again for duplicate scans or photo retries. No universal heavy/bulky tariff is established by this table. No monthly subscription or monthly minimum-spend requirement is proposed here.

Storage candidate unchanged from the latest recommendation:
- Floor: USD 0.010 / cubic foot / day.
- Launch suggestion: USD 0.015 / cubic foot / day.
- Seller UI converts volume to that actual parcel's price per box/day.
- No fixed claim that USD 0.020 makes matching faster.
- 0.5 cubic foot example: floor USD 0.005/box/day; suggested USD 0.0075/box/day, or USD 0.225 for 30 full days.
- Carry sub-cent accrual precision and round invoice totals, not each daily parcel accrual.
- Model below assumes existing STORED-to-confirmed-handoff metering. Staging photographs alone do not terminate custody. Delay credits and liability rules remain undecided.

## Auditable comparison model

Assumptions, not forecasts: average inventory 150 parcels, each 0.5 cubic foot; 30 days; 200 inbound and 200 outbound per month; storage at USD 0.015/cu ft/day; USD billing without modeled FX; four Seller payment captures per month; collection cost 4.4% + USD 0.30/capture; Host payout cost 2% as a Payouts scenario; optional average postage USD 7/outbound collected by Avoylo at cost through the same payment method. No assumption that Payouts is already approved or that USD 7 is an available carrier quote.

Storage = 150 * 0.5 * 30 * 0.015 = USD 33.75/month.

Old proposed model:
- Seller non-postage charges: 33.75 + 200*0.35 + 200*1.20 = USD 343.75.
- Host gross earnings: 33.75 + 200*0.25 + 200*0.85 = USD 253.75.
- Avoylo fee allocation: USD 90.
- Collection cost before postage: USD 16.325; payout cost USD 5.075.
- Remaining after those payment costs: USD 68.60, BEFORE other costs.
- Collecting USD 1,400 of postage adds USD 61.60 in percentage fees.
- Remaining after payment costs including postage collection: USD 7.00/month, BEFORE support/claims/infrastructure/consumables/FX/taxes. This is why the previous fee set is not a sound default recommendation.

Revised proposed model:
- Seller non-postage charges: 33.75 + 200*0.40 + 200*1.70 = USD 453.75.
- Host gross earnings: 33.75 + 200*0.25 + 200*1.00 = USD 283.75.
- Avoylo fee allocation: USD 170.
- Collection cost before postage: USD 21.165; payout cost USD 5.675.
- Remaining after those payment costs: USD 143.16, BEFORE other costs.
- With USD 7/parcel postage collected at cost: remaining USD 81.56, BEFORE other costs, or about USD 0.408/outbound.
- Seller non-postage average: USD 2.26875/outbound under this inventory/turnover example.
- Cents rounding per actual payment can change the illustrative totals slightly.

The revised Avoylo fee allocation of USD 0.85 per matched inbound/outbound cycle was chosen to leave roughly USD 0.40/outbound of operating-cost capacity under the stated USD 7 postage-collection model. USD 0.40 is a planning threshold, NOT a validated support/protection cost. A 30-minute human SLA requires a separate staffing/incident-cost model; the tariff does not prove that coverage is funded.

Host earnings at unchanged USD 33.75 storage and equal inbound/outbound counts:
- 50 of each: USD 96.25 gross/month.
- 150 of each: USD 221.25 gross/month.
- 200 of each: USD 283.75 gross/month.
The USD 200–300 goal therefore requires about 133–213 inbound/outbound cycles at this storage level. At 200 outbound and 26 operating days, about 7.7 outbound/day. These amounts are before Host supplies, equipment, space opportunity cost, and taxes.

Labor sensitivity, not measured processing times: USD 1 outbound pay corresponds to USD 30/hour at 2 minutes/parcel, USD 20/hour at 3 minutes, or USD 12/hour at 5 minutes, excluding fixed daily setup, inbound work, and space costs. Pickup waiting/drop-off trips must not be silently assumed free in that model.

## Price comparison rule

Compare the same Seller's actual parcel sizes, weight, destination distribution, volume, service deadline, and all-in costs. Include upstream customer-ready packaging and inbound freight to Hosts, storage, handling, postage, paid pickup, payment costs where charged, and contractual minimums. Do not claim Avoylo is universally cheaper because one fee line is lower. Basic calculation: proposed receiving+outbound USD 2.10 vs ShipDazzle's published USD 2.90 one-item order processing/pick fee leaves USD 0.80 before differences in other cost lines and service scope.

## PayPal form recommendations

- Short card statement name: AVOYLO.
- Long card statement name: AVOYLO LOGISTICS (16 characters including the space).
- Website: https://avoylo.com.
- Business category: actual fulfillment/storage/logistics service category if present; inspect the real dropdown rather than inventing a category code.
- Online sales share: 75–100% only to the extent Avoylo's service sales are conducted online.
- Average transaction: the actual/realistically projected single Avoylo capture/invoice amount, not the Seller's merchandise price and not the per-parcel handling fee if invoices are aggregated.
- Monthly volume: the amount Avoylo expects to process through that payment channel, including amounts collected for Host service or postage; not the company valuation, Seller GMV, or Avoylo margin alone.
- For a pre-revenue business, select a not-started/zero option when available; otherwise a grounded first-month estimate. The screenshot's large upper-bound default choices do not establish a forecast. Exact lower dropdown bands are not visible.

## Implementation boundary

Do not turn these rates into production ledgers or public price promises until the user approves. Keep existing technical gates and live flags unchanged. Next decision: approve/modify the proposed USD 0.40 inbound and USD 1.70 outbound split, alongside the preserved Seller-posted storage model.
