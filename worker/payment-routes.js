import { boundedRequestBody as boundedPaymentBody } from './request-body.js'
export { boundedRequestBody as boundedPaymentBody } from './request-body.js'
import { withHyperdrive } from './hyperdrive.js'
import { PayPalProvider } from './payments/paypal-provider.js'
import { PostgresPaymentRepository } from './payments/postgres-repository.js'
import { handlePrivatePaymentRequest, publicPaymentConfiguration } from './payments/http.js'
import { handlePayPalWebhook } from './payments/webhook.js'
import { PaymentError } from './payments/contracts.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
export const paymentPaths = new Set(['status','plans/verify','orders/create','orders/capture','subscriptions/create','subscriptions/inspect','subscriptions/cancel','ai-packs/create','ai-packs/capture'].map(path=>'/__webcanbe/api/payments/'+path))
const PAYPAL_CORE_KEYS = ['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID']
const PAYPAL_PLAN_KEYS = ['PAYPAL_PLAN_PRO_MONTHLY','PAYPAL_PLAN_PRO_ANNUAL','PAYPAL_PLAN_STUDIO_MONTHLY','PAYPAL_PLAN_STUDIO_ANNUAL']
const present = value => typeof value === 'string' && value.length > 0
function paypalConfigured(env) {
  return env?.WEBCANBE_PAYMENTS === 'enabled' && ['sandbox','live'].includes(env.PAYPAL_ENVIRONMENT) && PAYPAL_CORE_KEYS.every(key=>present(env?.[key]))
}
export function paymentConfigured(env) {
  return paypalConfigured(env) && PAYPAL_PLAN_KEYS.every(key=>present(env?.[key]))
}
export function paymentConfiguration(request, env) {
  if(request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}})
  return json({...publicPaymentConfiguration(), checkoutAvailable:paymentConfigured(env), environment:paymentConfigured(env)?env.PAYPAL_ENVIRONMENT:null})
}
export function paymentDiagnostic(request, env) {
  if(request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}})
  const environment = ['sandbox','live'].includes(env?.PAYPAL_ENVIRONMENT) ? env.PAYPAL_ENVIRONMENT : null
  return json({
    WEBCANBE_PAYMENTS: env?.WEBCANBE_PAYMENTS === 'enabled',
    PAYPAL_ENVIRONMENT_PRESENT: present(env?.PAYPAL_ENVIRONMENT),
    PAYPAL_ENVIRONMENT_VALUE: environment,
    ...Object.fromEntries([...PAYPAL_CORE_KEYS,...PAYPAL_PLAN_KEYS].map(key=>[key,present(env?.[key])])),
    paymentConfigured: paymentConfigured(env),
  })
}
// Caller has already resolved the database session, checked CSRF/origin and bounded JSON.
export async function privatePayment(request, path, db, session, env) {
  if (!paymentPaths.has(path)) return json({error:'Payment operation is unavailable.'},404)
  const configured=paypalConfigured(env)
  if (!configured && !['/__webcanbe/api/payments/status','/__webcanbe/api/payments/orders/create'].includes(path)) return json({error:'Payment checkout is not configured.'},503)
  const provider=configured?new PayPalProvider(env):{createOrder(){throw new PaymentError(503,'payment_checkout_unavailable','Paid checkout is not configured.')}}
  return handlePrivatePaymentRequest(request,path,{repo:new PostgresPaymentRepository(db),provider,session,env})
}
export async function paypalWebhook(request, env) {
  if(request.method !== 'POST') return new Response(null,{status:405,headers:{Allow:'POST'}})
  if(!paypalConfigured(env)) return json({error:'Payment webhook is not configured.'},503)
  let body
  try { body = await boundedPaymentBody(request, 256 * 1024) }
  catch { return json({error:'Invalid or oversized webhook body.'},413) }
  const bounded=new Request(request.url,{method:'POST',headers:request.headers,body})
  try{return await withHyperdrive(env,db=>handlePayPalWebhook(bounded,new PostgresPaymentRepository(db),new PayPalProvider(env)))}
  catch{return json({error:'Payment webhook is temporarily unavailable.'},503)}
}
