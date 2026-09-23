import { describe, expect, it } from "vitest"
import { databaseCreatorFinance } from "./creator-finance.js"

const SELLER="00000000-0000-4000-8000-000000000001"
describe("creator finance reads",()=>{
  it("derives seller scope from the authenticated session and totals only persisted rows",async()=>{
    const seen=[]
    const db={query:async(sql,values=[])=>{seen.push(values)
      if(sql.includes("wcb_seller_applications"))return {rows:[{application_id:"a"}]}
      if(sql.includes("FROM wcb_orders"))return {rows:[{order_id:"o1",listing_id:"l1",title:"Real listing",gross_minor:10000,platform_fee_minor:800,creator_earning_minor:9200,fee_rate_basis_points:800,refund_minor:2000,currency:"USD",status:"partially_refunded",created_at:"2026-01-01",completed_at:"2026-01-01",refunded_at:"2026-01-02"}]}
      if(sql.includes("FROM wcb_creator_ledger"))return {rows:[{entry_id:"e1",order_id:"o1",kind:"sale",gross_minor:10000,platform_fee_minor:800,creator_amount_minor:9200,currency:"USD",provider:"paypal",provider_reference:"safe-ref",hold_until:"2020-01-01",state:"available",payout_batch_id:null,occurred_at:"2026-01-01",paid_at:null},{entry_id:"e2",order_id:"o1",kind:"refund",gross_minor:-2000,platform_fee_minor:-160,creator_amount_minor:-1840,currency:"USD",provider:"paypal",provider_reference:"safe-refund",hold_until:"2020-01-01",state:"available",payout_batch_id:null,occurred_at:"2026-01-02",paid_at:null}]}
      if(sql.includes("wcb_creator_terms"))return {rows:[{founding:false,first_paid_listing_at:"2026-01-01"}]}
      if(sql.includes("wcb_payout_batches"))return {rows:[]}
      throw new Error(sql)
    }}
    const result=await databaseCreatorFinance(db,{userId:SELLER})
    expect(seen.every(values=>values[0]===SELLER)).toBe(true)
    expect(result.summary).toMatchObject({grossPaidSalesMinor:10000,refundsDisputesMinor:2000,netCreatorEarningMinor:7360,orderCount:1})
    expect(result.balances).toMatchObject({availableMinor:7360,negativeAdjustmentsMinor:1840})
    expect(result.payoutPolicy).toEqual({minimumMinor:2500,holdDays:14,windows:[1,15]})
    expect(result.feeState.latestAppliedBasisPoints).toBe(800)
  })

  it("returns no finance surface before seller approval",async()=>{
    const db={query:async()=>({rows:[]})}
    await expect(databaseCreatorFinance(db,{userId:SELLER})).resolves.toBeUndefined()
  })
})
