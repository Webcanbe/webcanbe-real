import { withHyperdrive } from './hyperdrive.js'
import { PayPalProvider } from './payments/paypal-provider.js'
import { PostgresPaymentRepository } from './payments/postgres-repository.js'
import { handlePrivatePaymentRequest, publicPaymentConfiguration } from './payments/http.js'
import { handlePayPalWebhook } from './payments/webhook.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
export const paymentPaths = new Set(['orders/create','orders/capture','subscriptions/create','subscriptions/cancel','ai-packs/create','ai-packs/capture'].map(path=>'/__webcanbe/api/payments/'+path))
export function paymentConfigured(env) {
  return env?.WEBCANBE_PAYMENTS === 'enabled' && ['sandbox','live'].includes(env.PAYPAL_ENVIRONMENT) && ['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID'].every(key=>typeof env[key] === 'string' && env[key].length > 0)
}
export function paymentConfiguration(request, env) {
  if(request.method !== 'GET') return new Response(null,{status:405,headers:{Allow:'GET'}})
  return json({...publicPaymentConfiguration(), checkoutAvailable:paymentConfigured(env), environment:paymentConfigured(env)?env.PAYPAL_ENVIRONMENT:null})
}
// Caller has already resolved the database session, checked CSRF/origin and bounded JSON.
export async function privatePayment(request, path, db, session, env) {
  if (!paymentPaths.has(path)) return json({error:'Payment operation is unavailable.'},404)
  if (!paymentConfigured(env)) return json({error:'Payment checkout is not configured.'},503)
  return handlePrivatePaymentRequest(request,path,{repo:new PostgresPaymentRepository(db),provider:new PayPalProvider(env),session,env})
}
export async function paypalWebhook(request, env) {
  if(request.method !== 'POST') return new Response(null,{status:405,headers:{Allow:'POST'}})
  if(!paymentConfigured(env)) return json({error:'Payment webhook is not configured.'},503)
  // Bounded streaming read: never trust an optional Content-Length header.
  const reader=request.body?.getReader(); if(!reader)return json({error:'Webhook body is required.'},400)
  const chunks=[];let length=0
  try { while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>256*1024){await reader.cancel();return json({error:'Webhook is too large.'},413)}chunks.push(value)} }
  finally {reader.releaseLock()}
  const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
  const bounded=new Request(request.url,{method:'POST',headers:request.headers,body})
  try{return await withHyperdrive(env,db=>handlePayPalWebhook(bounded,new PostgresPaymentRepository(db),new PayPalProvider(env)))}
  catch{return json({error:'Payment webhook is temporarily unavailable.'},503)}
}
