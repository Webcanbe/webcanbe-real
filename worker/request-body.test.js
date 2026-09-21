import { expect, it } from 'vitest'
import { boundedRequestBody } from './request-body.js'

it('accepts an exact byte limit across chunks without corrupting UTF-8', async () => {
  const bytes = new TextEncoder().encode('{"text":"한글"}')
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 10))
    controller.enqueue(bytes.slice(10))
    controller.close()
  } })
  const request = new Request('https://example.test', {method:'POST',body:stream,duplex:'half'})
  expect(await boundedRequestBody(request, bytes.length)).toEqual(bytes)
})

it('rejects multibyte payloads exceeding bytes even when character count fits', async () => {
  const request = new Request('https://example.test', {method:'POST',body:'한글'})
  await expect(boundedRequestBody(request, 3)).rejects.toThrow('Request too large.')
})
