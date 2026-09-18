const POLICY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — Webcanbe</title>
<meta name="description" content="Webcanbe Privacy Policy describing how Google sign-in and other user data are accessed, used, stored, shared, retained, and deleted.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://webcanbe.com/policy">
<link rel="icon" href="/favicon.png" type="image/png">
<style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#fff}main{max-width:840px;margin:0 auto;padding:48px 24px 80px;line-height:1.72}.brand{display:inline-block;margin-bottom:36px}.brand img{height:30px;width:auto}h1{font-size:clamp(2.2rem,7vw,4rem);line-height:1.05;letter-spacing:-.04em;margin:0 0 16px}h2{font-size:1.2rem;margin:34px 0 8px}p,li{color:#374151}a{color:#3740ff}.meta{color:#6b7280}.links{display:flex;gap:16px;flex-wrap:wrap;margin-top:44px;padding-top:24px;border-top:1px solid #e5e7eb}</style>
</head>
<body><main>
<a class="brand" href="/"><img src="/brand/webcanbe-logo.svg" alt="Webcanbe"></a>
<h1>Privacy Policy</h1>
<p class="meta">Effective September 18, 2026</p>
<p>This Privacy Policy explains how Webcanbe accesses, uses, stores, shares, retains, and protects information when you use webcanbe.com and related Webcanbe services.</p>
<h2>1. Google sign-in data</h2>
<p>When you choose Google sign-in, Webcanbe requests only the standard OpenID Connect identity scopes <strong>openid</strong>, <strong>email</strong>, and <strong>profile</strong>. Google may provide a stable Google account identifier and basic profile information such as your email address, name, and profile picture.</p>
<h2>2. Why Webcanbe requests this data</h2>
<p>Webcanbe uses Google sign-in data only to authenticate you, create or identify your Webcanbe account, maintain your signed-in session, and provide account-related features. This sign-in flow does not request access to Gmail, Google Drive, Google Calendar, or other Google product data.</p>
<h2>3. Access and use</h2>
<p>Google identity information is accessed only during authentication and account mapping. Webcanbe does not use Google sign-in data for advertising, profiling for advertising, or unrelated purposes.</p>
<h2>4. Storage</h2>
<p>Webcanbe stores only the account and session information reasonably needed to identify your Webcanbe account and operate authenticated features. The current Google sign-in flow does not persist Google access tokens or refresh tokens.</p>
<h2>5. Sharing</h2>
<p>Webcanbe does not sell Google user data. Information may be processed by infrastructure, authentication, payment, deployment, security, or support providers only when necessary to provide the service, protect users, or comply with law.</p>
<h2>6. Other information</h2>
<p>Depending on the features you use, Webcanbe may process account and session metadata, workspace and project source files, project history, marketplace and creator records, saved settings, support communications, and operational or security logs.</p>
<h2>7. Security</h2>
<p>Webcanbe uses secure transport and server-side authorization boundaries for hosted account operations. Google identity assertions are verified server-side, and access to stored account data is limited to what is needed to operate and protect the service.</p>
<h2>8. Retention</h2>
<p>Information is retained only as long as reasonably needed to provide the service, preserve legitimate project or transaction records, maintain security, resolve disputes, prevent fraud, and meet legal obligations.</p>
<h2>9. Deletion and user choices</h2>
<p>You may request deletion of your Webcanbe account or associated personal information by contacting <a href="mailto:support@webcanbe.com">support@webcanbe.com</a>. You can also revoke Webcanbe's Google account access from your Google Account permissions. Revoking access prevents future use of that authorization but does not itself delete information already stored by Webcanbe.</p>
<h2>10. Cookies and technical data</h2>
<p>Webcanbe may use cookies or similar browser storage needed for authentication, session continuity, security, preferences, and core product functionality. Technical information such as IP address, browser type, requested pages, and timestamps may be processed for security and reliability.</p>
<h2>11. Changes</h2>
<p>We may update this policy as Webcanbe adds or changes features. When we make material changes, we will update the effective date shown on this page.</p>
<h2>12. Contact</h2>
<p>Privacy questions, Google sign-in questions, and deletion requests can be sent to <a href="mailto:support@webcanbe.com">support@webcanbe.com</a>.</p>
<nav class="links"><a href="/">Webcanbe home</a><a href="/terms">Terms of Service</a><a href="/contact">Contact</a></nav>
</main></body></html>`;

const TERMS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service — Webcanbe</title><meta name="robots" content="index,follow"><link rel="canonical" href="https://webcanbe.com/terms"><style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827}main{max-width:840px;margin:0 auto;padding:48px 24px 80px;line-height:1.72}img{height:30px;width:auto;margin-bottom:36px}h1{font-size:clamp(2.2rem,7vw,4rem);letter-spacing:-.04em;margin:0 0 16px}h2{font-size:1.2rem;margin-top:32px}p{color:#374151}a{color:#3740ff}</style></head><body><main>
<a href="/"><img src="/brand/webcanbe-logo.svg" alt="Webcanbe"></a><h1>Terms of Service</h1><p>Effective September 18, 2026. These Terms govern access to and use of Webcanbe.</p>
<h2>1. The service</h2><p>Webcanbe is a source-first web project marketplace and browser workspace. Features may include project browsing, source-backed visual and code editing, export, creator tools, deployment integrations, AI-assisted changes, and purchase features.</p>
<h2>2. Accounts</h2><p>You are responsible for activity under your account and for keeping access to your sign-in provider secure.</p>
<h2>3. Your projects and content</h2><p>You retain ownership of source code, files, text, images, and other content you submit. You grant Webcanbe a limited right to process that content only as needed to operate, secure, and provide the service you request.</p>
<h2>4. Acceptable use</h2><p>Do not use Webcanbe to violate law, infringe intellectual property, distribute malware, attack systems without authorization, bypass access controls, or interfere with the service.</p>
<h2>5. Contact</h2><p>Questions about these Terms can be sent to <a href="mailto:support@webcanbe.com">support@webcanbe.com</a>.</p>
<p><a href="/policy">Privacy Policy</a> · <a href="/">Webcanbe home</a></p>
</main></body></html>`;

const ROBOTS = `User-agent: *
Allow: /

Sitemap: https://webcanbe.com/sitemap.xml
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://webcanbe.com/</loc></url>
<url><loc>https://webcanbe.com/policy</loc></url>
<url><loc>https://webcanbe.com/terms</loc></url>
<url><loc>https://webcanbe.com/about</loc></url>
<url><loc>https://webcanbe.com/contact</loc></url>
</urlset>`;

function response(body, contentType, request) {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Robots-Tag": "all",
  });
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" || request.method === "HEAD") {
      if (url.pathname === "/policy" || url.pathname === "/policy/") {
        return response(POLICY_HTML, "text/html; charset=UTF-8", request);
      }
      if (url.pathname === "/terms" || url.pathname === "/terms/") {
        return response(TERMS_HTML, "text/html; charset=UTF-8", request);
      }
      if (url.pathname === "/robots.txt") {
        return response(ROBOTS, "text/plain; charset=UTF-8", request);
      }
      if (url.pathname === "/sitemap.xml") {
        return response(SITEMAP, "application/xml; charset=UTF-8", request);
      }
      if (url.pathname === "/") {
        const asset = await env.ASSETS.fetch(request);
        const headers = new Headers(asset.headers);
        headers.set("Cache-Control", "public, max-age=0, must-revalidate");
        headers.set("X-Robots-Tag", "all");
        return new Response(request.method === "HEAD" ? null : asset.body, {
          status: asset.status,
          statusText: asset.statusText,
          headers
        });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
