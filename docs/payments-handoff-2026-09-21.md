# Webcanbe Payments / Creator Payout Handoff — 2026-09-21 KST

> 목적: 세션이 끊겨도 결제·정산 구조를 다시 설계하지 않도록 현재 결정과 법적/운영상 경계를 보존한다.
> 사업 전체 목표는 `docs/founder-goal-handoff-2026-09-20.md`, 기술 상태는 `docs/current-handoff.md`를 같이 읽는다.

## 1. 현재 채택 방향

초기에는 **PayPal Partner / Multiparty / seller sub-merchant 구조를 사용하지 않는다.**

Webcanbe는 진짜 reseller/distributor 모델을 전제로 한다.

Buyer side:
- Buyer가 Webcanbe에서 프로젝트/라이선스를 구매한다.
- Checkout merchant / seller of record는 Webcanbe다.
- Creator는 원 IP를 계속 소유한다.
- Creator는 Webcanbe에 승인된 release를 비독점적으로 판매/배포/재라이선스할 권리를 계약으로 부여한다.
- Webcanbe가 buyer에게 라이선스를 제공하고 구매지원·환불·분쟁의 판매자 책임을 진다.

초기 결제:
- `PaymentProvider = PayPalStandard`
- PayPal Standard Checkout / Orders API를 사용한다.
- 서버가 order 금액, 상품, 라이선스, buyer entitlement를 권위 있게 결정한다.
- capture/webhook/transaction reconciliation 후에만 entitlement를 활성화한다.
- client 입력만으로 가격·권한·creator earnings를 결정하지 않는다.

명시적으로 사용하지 않는 것:
- PayPal Partner
- PayPal Multiparty
- seller PayPal onboarding
- seller별 PayPal merchant account 연결
- buyer payment의 자동 split
- PayPal Payouts API at launch
- creator에게 buyer payment를 그대로 pass-through 하는 payment aggregation

## 2. 왜 이 구분이 중요하나

PayPal Developer Agreement는 payment aggregation을 금지하고, buyer의 PayPal payment는 seller of record에게 직접 가야 한다는 원칙을 둔다.

따라서 이 구조가 허용 가능한 방향이 되려면 **Webcanbe가 이름만 seller인 것이 아니라 실제 seller of record / reseller여야 한다.**

즉 다음이 모두 일치해야 한다:
- Webcanbe 약관
- creator distribution/resale license
- buyer license
- checkout descriptor / merchant identity
- invoice/receipt
- refund/dispute support
- 세금/회계
- 상품 설명
- PayPal Business account의 실제 business activity

Webcanbe가 사실상 creator를 대신해 돈만 받아 전달하는 중개자라면 이 구조를 사용하면 안 된다. 그 경우에는 marketplace/partner 또는 다른 승인된 payment-facilitation 구조가 필요하다.

## 3. PayPal Standard 확인사항

2026-09-21 공식 문서 기준:
- PayPal Standard Checkout / Orders API는 merchant가 서버에서 order를 만들고 capture하는 일반 checkout 흐름을 제공한다.
- PayPal Checkout은 PayPal 및 지원되는 경우 debit/credit card 등 결제수단을 제공한다.
- 결제수단 가용성은 buyer/merchant 국가와 eligibility에 따라 달라질 수 있으므로 “모든 buyer가 카드로 반드시 결제 가능”이라고 보장하지 않는다.
- Webcanbe는 PayPal 계정에 실제 사업내용을 정확히 등록하고, 판매하는 디지털 프로젝트/라이선스가 그 정상적 business scope 안에 있어야 한다.

공식 참조:
- https://developer.paypal.com/studio/checkout/standard/
- https://developer.paypal.com/studio/checkout/standard/integrate
- https://www.paypal.com/kr/legalhub/paypal/useragreement-full
- https://www.paypal.com/kr/legalhub/paypal/home

## 4. Creator earnings ledger

Webcanbe DB가 canonical source다.

한 판매가 capture되고 환불/분쟁 상태가 정상일 때 ledger에 creator earning을 생성한다.

예시 상태:
```
PENDING
→ HOLD
→ AVAILABLE
→ PAYOUT_QUEUED
→ PAID
```

별도 상태:
```
REFUNDED
DISPUTED
CHARGEBACK
HELD
REVERSED
NEGATIVE_BALANCE
```

각 ledger entry에 최소 저장:
- buyer order id
- PayPal order id / capture id
- listing id
- immutable release id
- creator id
- gross amount
- processor fee
- Webcanbe platform fee
- taxes/adjustments where applicable
- creator net earning
- currency
- earned_at
- available_at
- refund/dispute status
- payout batch id
- payout provider
- payout provider reference
- paid_at

## 5. 14일 hold / 1일·15일 payout

현재 정책:
- sale 이후 **14일 hold**
- hold 종료 후 `AVAILABLE`
- payout date: **매월 1일 / 15일**

하지만 14일 hold는 buyer dispute/chargeback 기간 전체를 덮는 보증이 아니다.

따라서 seller agreement와 ledger에는 반드시 다음 중 하나 이상이 있어야 한다:
- 이후 refund/chargeback이 발생하면 creator의 미래 available balance에서 차감
- creator balance가 부족하면 negative balance 기록
- 반복적 high-risk seller에는 추가 reserve / longer hold
- fraud/dispute가 열린 판매는 payout queue에서 제외

**이미 payout한 뒤 refund가 발생해도 Webcanbe가 손실을 무조건 떠안는 구조로 만들지 않는다.**

초기 14일은 운영정책이며, 실제 dispute data가 생기면 seller risk에 따라 변경 가능하다.

## 6. Founding Creator economics

현재 기존 GTM 결정과 일치:
- Founding Creator: Webcanbe platform fee 0%
- 기존 계획: 공개 초기 일반 seller fee 5%, 이후 8%
- processor fee / FX / payout fee는 platform fee와 구분해서 ledger에 기록

중요:
- `0% platform fee`는 `payment processing cost 0%`가 아니다.
- buyer가 $100 결제했다고 creator earning이 무조건 정확히 $100인 것으로 하드코딩하지 않는다.
- 실제 정책에 따라 processor/payout/tax 비용을 어느 쪽이 부담하는지 seller terms에 명확히 쓴다.

## 7. 초기 Creator payout

초기:
- `PayoutProvider = PayPalManual`
- 해외 creator에게 ordinary PayPal Send & Request를 통한 **commercial payment**로 사람이 직접 송금
- friends/family 유형을 사업정산에 사용하지 않는다.
- 운영자가 Webcanbe가 계산한 payout batch를 확인하고 실제 송금한 뒤 provider transaction/reference를 기록한다.
- admin approval만으로 `PAID` 처리하지 않는다. 실제 provider reference 또는 reconciliation evidence가 있어야 한다.

PayPal Korea 공식 안내상:
- 한국 등록 PayPal 계정은 현재 **한국 외 지역에 등록된 PayPal 계정으로 국제 송금**할 수 있다.
- 한국 PayPal 계정끼리의 국내 commercial/personal payment는 지원되지 않는다.

따라서:
- 해외 creator → PayPal manual payout 가능 여부를 계정/국가별로 확인
- 한국 creator → PayPal을 기본 payout rail로 사용하지 않음
- 한국 creator 및 PayPal 부적합 국가/계정 → bank transfer / Payoneer 등 별도 fallback

공식 참조:
- https://www.paypal.com/kr/cshelp/article/how-do-i-send-payments-help293
- https://www.paypal.com/kr/digital-wallet/system-enhancement-faq

## 8. Manual payout 운영 경계

초기에는 manual payout이 합리적이다. 이유:
- seller 수가 적다.
- 자동 payout integration보다 출시 속도가 중요하다.
- Webcanbe ledger와 payout provider를 분리할 수 있다.

하지만 seller 수가 커지면 manual payout은 위험해진다.

자동화 전환 신호 예:
- payout recipient 수가 운영자가 안전하게 검토하기 어려울 정도로 증가
- payout error/duplicate risk 증가
- 다중통화/세금문서/reconciliation 작업량 증가
- 월 payout batch가 수십~수백 건으로 성장

그때:
- PayPal Payouts / MassPay 또는 다른 승인된 payout provider를 검토
- provider 교체가 ledger/model 재설계를 요구하지 않도록 abstraction 유지

## 9. 디지털 상품 증거 / 분쟁

Webcanbe 상품은 intangible/digital goods다.

PayPal Seller Protection은 조건을 만족한 일부 intangible transaction에 적용될 수 있으나 거래별 eligibility는 보장되지 않는다.

따라서 주문별로 delivery/access evidence를 보존한다:
- entitlement granted timestamp
- buyer account
- working copy materialized timestamp
- source/release id
- first workspace open
- export/download/access event
- IP / device/session evidence는 개인정보 최소화 원칙 아래 필요한 범위에서만
- buyer-facing license acceptance version

환불/분쟁에 대응하려면 “결제됨”만 저장해서는 부족하다.

공식 참조:
- https://www.paypal.com/kr/legalhub/paypal/seller-protection

## 10. 법/세금/계약 경계

이 문서는 제품/운영 구조 결정이며, 다음이 자동으로 해결됐다는 뜻은 아니다:
- 한국 사업자/법인 운영주체
- 미성년 founder와 실제 계약주체
- 해외 digital sales VAT/GST/sales tax
- creator payment에 대한 원천징수/세금문서
- 소비자 환불/철회권
- IP warranty / DMCA/takedown
- seller KYC/KYB 필요성
- 국가별 제재/수출통제
- PayPal merchant review/account limitation/reserve

실제 real-money launch 전에는 운영주체와 주요 판매국을 기준으로 필요한 회계/세무/약관을 확인한다.

## 11. 구현 원칙

PaymentProvider interface:
```
PayPalStandard
future: Stripe / Adyen / other
```

PayoutProvider interface:
```
PayPalManual
BankManual
PayoneerManual
future: MassPay / PayPalPayouts / other
```

Webcanbe가 항상 직접 보유할 canonical state:
- order
- purchase
- entitlement
- license
- refund/dispute
- creator earning
- payout batch
- payout reconciliation

PayPal-specific IDs는 provider references로 저장하고 Webcanbe domain identity로 사용하지 않는다.

## 12. Launch gate

real-money buyer launch 전:
1. PayPal Business production account가 정상적으로 commercial payment를 받을 수 있는지 확인
2. 실제 Webcanbe business description / digital project licensing이 계정 activity와 일치
3. sandbox create → approve → capture → webhook/reconciliation PASS
4. refund PASS
5. duplicate webhook idempotency PASS
6. entitlement double-grant 방지 PASS
7. digital delivery evidence 기록 PASS
8. creator contract / buyer license / refund policy 공개
9. creator earning ledger PASS
10. manual payout rehearsal PASS
11. payout 후 refund/chargeback accounting path PASS
12. 한국 creator fallback payout 경로 명시

## 13. 현재 결론

**이 구조는 초기 beta용으로 합리적이고, PayPal Partner/Multiparty보다 훨씬 단순하다.**

단, 핵심 조건은:
> Webcanbe가 실제 reseller/seller of record여야 하며, creator money를 대신 받아 전달하는 payment aggregator처럼 운영하면 안 된다.

운영상 가장 큰 추가 보완은:
1. 14일 이후에도 발생할 수 있는 refund/chargeback용 negative-balance/clawback/reserve 규칙
2. digital delivery evidence
3. 실제 payout reference 기반 reconciliation
4. creator contract / buyer license와 payment model의 일치

이 네 가지를 넣은 상태를 **현재 권장 초기 결제 구조**로 고정한다.


## 14. 답변 운영 규칙 — 2026-09-21

사용자 요청:
- 앞으로 이 결제 구조를 설명할 때 **“약관 위반일 수 있다”, “대행업체처럼 운영하면 안 된다”, “seller of record여야 한다” 같은 동일한 경고를 반복하지 않는다.**
- 현재 구조는 이미 **Creator가 Webcanbe에 판매/배포 권한을 부여하고, Webcanbe가 구매자에게 직접 판매하는 reseller/distributor 구조**로 고정된 것으로 취급한다.
- 사용자가 명시적으로 법적/약관 위험을 다시 묻거나, 구조 자체가 바뀌는 경우에만 해당 이슈를 다시 검토한다.
- 평소 답변에서는 구현·운영·성장 관점에 집중한다.
