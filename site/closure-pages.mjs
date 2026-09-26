const styles = `
  :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d1119;color:#f5f7fb}
  *{box-sizing:border-box}
  body{margin:0;min-height:100svh;background:radial-gradient(circle at 52% 12%,#26314a 0,transparent 39%),linear-gradient(145deg,#111725,#0b0f17 75%)}
  .page{min-height:100svh;display:flex;flex-direction:column;max-width:1440px;margin:auto;padding:clamp(24px,4vw,60px)}
  .brand{display:inline-flex;align-items:center;gap:12px;width:max-content;color:#fff;text-decoration:none;font-size:18px;font-weight:740;letter-spacing:-.045em}
  .mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid #acb9da66;border-radius:11px;background:linear-gradient(135deg,#4b649b,#1c2940);font-size:22px;font-weight:800;line-height:1}
  main{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 0 88px}
  .notice{width:min(100%,680px);padding:clamp(30px,6vw,64px);border:1px solid #93a6c433;border-radius:28px;background:linear-gradient(155deg,#ffffff0d,#ffffff05);box-shadow:0 30px 90px #0005;text-align:center}
  .eyebrow{display:inline-block;margin:0 0 23px;padding:9px 13px;border:1px solid #9eafd049;border-radius:99px;color:#c8d5ef;font-size:11px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}
  h1{margin:0;font-size:clamp(38px,7vw,66px);font-weight:730;letter-spacing:-.065em;line-height:1.07;text-wrap:balance}
  .description{max-width:460px;margin:22px auto 0;color:#b8c2d2;font-size:clamp(16px,2.5vw,18px);line-height:1.7;text-wrap:balance}
  .contact{margin:29px 0 0;color:#d9e2f3;font-size:15px;line-height:1.6}
  .contact a{color:#b8ceff;text-decoration:underline;text-underline-offset:4px}
  .contact a:hover{color:#e8efff}
  .contact a:focus-visible,.brand:focus-visible{outline:3px solid #9ab9ff;outline-offset:5px;border-radius:4px}
  @media(max-width:520px){.page{padding:22px 18px}.notice{border-radius:22px}main{padding:34px 0 64px}}
`

function document({ contact = false } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0d1119"><title>Service ended · Webcanbe</title><meta name="description" content="Webcanbe has ended service."><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23263855'/%3E%3Ctext x='32' y='46' text-anchor='middle' fill='white' font-family='Arial' font-size='42' font-weight='bold'%3EW%3C/text%3E%3C/svg%3E"><style>${styles}</style></head><body><div class="page"><header><a class="brand" href="/" aria-label="Webcanbe home"><span class="mark" aria-hidden="true">W</span><span>Webcanbe</span></a></header><main><section class="notice" aria-labelledby="notice-title"><p class="eyebrow">Service notice</p><h1 id="notice-title">Webcanbe has ended service.</h1><p class="description">Thank you for being part of Webcanbe.</p>${contact ? '<p class="contact">For inquiries: <a href="https://msihu.com">msihu.com</a></p>' : ''}</section></main></div></body></html>`
}

export const homePage = document()
export const closedPage = document({ contact: true })
