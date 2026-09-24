import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({query:vi.fn(),resolve:vi.fn(),csrf:vi.fn(),private:vi.fn(),webhook:vi.fn(),provider:vi.fn()}))
vi.mock('./hyperdrive.js',()=>({withHyperdrive:async(_env,action)=>action({query:mocks.query})}))
vi.mock('./postgres-session.js',()=>({resolveDatabaseSession:mocks.resolve,verifyDatabaseCsrf:mocks.csrf,issueDatabaseSession:vi.fn(),rotateDatabaseCsrf:vi.fn(),revokeDatabaseSession:vi.fn(),revokeAllDatabaseSessions:vi.fn()}))
vi.mock('./payments/paypal-provider.js',()=>({PayPalProvider:class {constructor(){mocks.provider()}}}))
vi.mock('./payments/http.js',async importOriginal=>({...await importOriginal(),handlePrivatePaymentRequest:mocks.private}))
vi.mock('./payments/webhook.js',()=>({handlePayPalWebhook:mocks.webhook}))
import worker from './index.js'
import { boundedPaymentBody } from './payment-routes.js'
const env={HYPERDRIVE:{connectionString:'test-only'},WEBCANBE_PAYMENTS:'enabled',PAYPAL_ENVIRONMENT:'sandbox',PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_WEBHOOK_ID:'test-webhook',PAYPAL_PLAN_PRO_MONTHLY:'P-PM',PAYPAL_PLAN_PRO_ANNUAL:'P-PA',PAYPAL_PLAN_STUDIO_MONTHLY:'P-SM',PAYPAL_PLAN_STUDIO_ANNUAL:'P-SA'}
const path='/__webcanbe/api/payments/orders/create'
const request=(body='{}',headers={})=>new Request('https://webcanbe.com'+path,{method:'POST',headers:{Origin:'https://webcanbe.com','Content-Type':'application/json',Cookie:'__Host-wcb-session=test-session','X-WCB-CSRF':'test-csrf',...headers},body})
beforeEach(()=>{vi.clearAllMocks();mocks.resolve.mockResolvedValue({userId:'test-user'});mocks.csrf.mockResolvedValue(true);mocks.private.mockResolvedValue(new Response('{}',{status:201}));mocks.webhook.mockResolvedValue(new Response('{}',{status:200}))})
describe('payment routing preserves server authority',()=>{
 it('publishes configured plans without secrets or checkout activation by default',async()=>{const r=await worker.fetch(new Request('https://webcanbe.com/__webcanbe/api/payments/config'),{});const body=await r.json();expect(body.checkoutAvailable).toBe(false);expect(body.plans.find(p=>p.key==='pro_annual')).toMatchObject({priceMinor:12000,monthlyAiActions:300});expect(JSON.stringify(body)).not.toContain('test-secret')})
 it('keeps marketplace checkout independent from preparing plan and AI pack checkout',async()=>{const url='https://webcanbe.com/__webcanbe/api/payments/config';const pending=await (await worker.fetch(new Request(url),env)).json();expect(pending).toMatchObject({checkoutAvailable:true,subscriptionCheckoutAvailable:false,aiPackCheckoutAvailable:false,environment:'sandbox'});const enabled=await (await worker.fetch(new Request(url),{...env,WEBCANBE_SUBSCRIPTION_CHECKOUT:'enabled',WEBCANBE_AI_PACK_CHECKOUT:'enabled'})).json();expect(enabled).toMatchObject({checkoutAvailable:true,subscriptionCheckoutAvailable:true,aiPackCheckoutAvailable:true})})
 it('reports only safe payment configuration presence and allowlisted environment state',async()=>{const r=await worker.fetch(new Request('https://webcanbe.com/__webcanbe/api/payments/diagnostic'),env);expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('no-store');const body=await r.json();expect(body).toEqual({WEBCANBE_PAYMENTS:true,PAYPAL_ENVIRONMENT_PRESENT:true,PAYPAL_ENVIRONMENT_VALUE:'sandbox',PAYPAL_CLIENT_ID:true,PAYPAL_CLIENT_SECRET:true,PAYPAL_WEBHOOK_ID:true,PAYPAL_PLAN_PRO_MONTHLY:true,PAYPAL_PLAN_PRO_ANNUAL:true,PAYPAL_PLAN_STUDIO_MONTHLY:true,PAYPAL_PLAN_STUDIO_ANNUAL:true,paymentConfigured:true});const serialized=JSON.stringify(body);for(const value of ['test-client','test-secret','test-webhook','P-PM','P-PA','P-SM','P-SA'])expect(serialized).not.toContain(value)})
 it('redacts unsupported environment values and rejects non-GET diagnostics',async()=>{const url='https://webcanbe.com/__webcanbe/api/payments/diagnostic';const body=await (await worker.fetch(new Request(url),{...env,PAYPAL_ENVIRONMENT:'production',PAYPAL_PLAN_PRO_ANNUAL:''})).json();expect(body).toMatchObject({WEBCANBE_PAYMENTS:true,PAYPAL_ENVIRONMENT_PRESENT:true,PAYPAL_ENVIRONMENT_VALUE:null,PAYPAL_PLAN_PRO_ANNUAL:false,paymentConfigured:false});const rejected=await worker.fetch(new Request(url,{method:'POST'}),env);expect(rejected.status).toBe(405);expect(rejected.headers.get('Allow')).toBe('GET')})
 it('refuses cross-origin requests before provider/repository work',async()=>{expect((await worker.fetch(request('{}',{Origin:'https://evil.test'}),env)).status).toBe(403);expect(mocks.private).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled()})
 it('refuses absent database sessions and CSRF failures',async()=>{mocks.resolve.mockResolvedValue(undefined);expect((await worker.fetch(request(),env)).status).toBe(403);mocks.resolve.mockResolvedValue({userId:'test-user'});mocks.csrf.mockResolvedValue(false);expect((await worker.fetch(request(),env)).status).toBe(403);expect(mocks.private).not.toHaveBeenCalled()})
 it('bounds JSON even without Content-Length',async()=>{expect((await worker.fetch(request(JSON.stringify({x:'x'.repeat(17000)})),env)).status).toBe(400);expect(mocks.private).not.toHaveBeenCalled()})
 it('passes the resolved session only after the existing gates',async()=>{expect((await worker.fetch(request(),env)).status).toBe(201);expect(mocks.private.mock.calls[0][2].session.userId).toBe('test-user')})
 it('fails paid capture closed when sandbox configuration is incomplete',async()=>{const capture=new Request('https://webcanbe.com/__webcanbe/api/payments/orders/capture',{method:'POST',headers:{Origin:'https://webcanbe.com','Content-Type':'application/json',Cookie:'__Host-wcb-session=test-session','X-WCB-CSRF':'test-csrf'},body:'{}'});expect((await worker.fetch(capture,{...env,PAYPAL_CLIENT_SECRET:''})).status).toBe(503);expect(mocks.provider).not.toHaveBeenCalled()})
 it('permits provider webhook verification without browser CSRF while bounding its body',async()=>{const url='https://webcanbe.com/__webcanbe/api/payments/webhooks/paypal';expect((await worker.fetch(new Request(url,{method:'POST',body:'{}'}),env)).status).toBe(200);expect(mocks.webhook).toHaveBeenCalledOnce();expect(mocks.resolve).not.toHaveBeenCalled();expect((await worker.fetch(new Request(url,{method:'POST',body:'x'.repeat(256*1024+1)}),env)).status).toBe(413);expect(mocks.webhook).toHaveBeenCalledOnce()})
})

it('cancels an oversized streaming body before consuming the remaining stream', async () => {
 const cancel = vi.fn()
 const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(17 * 1024)) }, cancel })
 const req = new Request('https://webcanbe.com/test', {method:'POST', body:stream, duplex:'half'})
 await expect(boundedPaymentBody(req,16 * 1024)).rejects.toThrow('Request too large.')
 expect(cancel).toHaveBeenCalledOnce()
})

describe('public catalog body streaming limit', () => {
 it.each([undefined, '1'])('cancels oversized lengthless or understated bodies (%s)', async declared => {
  const cancel = vi.fn()
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 + 1)) }, cancel })
  const headers = { Origin:'https://webcanbe.com', 'Content-Type':'application/json', ...(declared ? {'Content-Length':declared} : {}) }
  const req = new Request('https://webcanbe.com/__webcanbe/api/product/catalog/browse', {method:'POST',headers,body:stream,duplex:'half'})
  const response = await worker.fetch(req,env)
  expect(response.status).toBe(400)
  expect(cancel).toHaveBeenCalledOnce()
  expect(mocks.resolve).not.toHaveBeenCalled()
 })
})
