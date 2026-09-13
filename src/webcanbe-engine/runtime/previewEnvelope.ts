import { PREVIEW_CHANNEL } from "../bridge/previewProtocol"

/** Trusted, opaque wrapper: its exact frame-src also constrains child self-navigation. */
export function previewEnvelope(options: { origin: string; bootstrap: string; editorOrigin: string; session: string; generation: string; expiresAt: number }) {
  const data = JSON.stringify({ ...options, channel: PREVIEW_CHANNEL }).replace(/</g, "\\u003c")
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; frame-src ' + options.origin + '; connect-src \'none\'; base-uri \'none\'; form-action \'none\';"><style>html,body,iframe{margin:0;border:0;width:100%;height:100%;display:block;overflow:hidden}</style></head><body><iframe sandbox="allow-scripts" referrerpolicy="no-referrer" title="Isolated HTTP application"></iframe><script>(' + envelopeClient.toString() + ')(' + data + ')</script></body></html>'
}

function envelopeClient(config: { origin: string; bootstrap: string; editorOrigin: string; session: string; generation: string; expiresAt: number; channel: string }) {
  const frame = document.querySelector('iframe')!
  let settings: Record<string, unknown> | undefined
  const valid = (data: unknown): data is Record<string, unknown> => Boolean(data && typeof data === 'object' && (data as Record<string, unknown>).channel === config.channel && (data as Record<string, unknown>).session === config.session && (data as Record<string, unknown>).generation === config.generation)
  const send = (type: string) => parent.postMessage({ channel: config.channel, type, session: config.session, generation: config.generation }, config.editorOrigin)
  const configure = () => { if (settings) frame.contentWindow?.postMessage(settings, '*') }
  window.addEventListener('message', event => {
    if (!valid(event.data)) return
    if (event.source === parent && event.origin === config.editorOrigin && event.data.type === 'configure') {
      settings = { channel: config.channel, type: 'configure', session: config.session, generation: config.generation, active: event.data.active === true }
      configure()
    } else if (event.source === frame.contentWindow && event.origin === 'null' && ['ready', 'route', 'hover', 'select', 'drag', 'clear', 'failed'].includes(String(event.data.type))) {
      if (event.data.type === 'ready') clearTimeout(readyTimeout)
      parent.postMessage(event.data, config.editorOrigin)
    }
  })
  frame.addEventListener('load', configure)
  const readyTimeout = setTimeout(() => send('failed'), 15_000)
  setTimeout(() => { clearTimeout(readyTimeout); frame.remove(); send('expired') }, Math.max(0, config.expiresAt - Date.now()))
  frame.src = config.bootstrap
}
