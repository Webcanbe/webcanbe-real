import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {JSDOM} from 'jsdom'
const out='.public-site';fs.mkdirSync(out,{recursive:true})
await build({entryPoints:['scripts/public-render-entry.tsx'],outfile:out+'/renderer.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic'})
const {render,footer,cta,docPages,articles,docFamilies,infoPages,supportChannels,categories}=await import(path.resolve(out+'/renderer.mjs')+'?'+Date.now())
const buildId=process.env.WCB_BUILD_SHA||execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim()
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const origin='https://webcanbe.com'
const routes={}
for(const [url,p] of Object.entries(docPages))routes[url]={title:p.title+' — Webcanbe Docs',description:p.intro,kind:'docs'}
for(const [url,p] of Object.entries(infoPages))routes[url]={title:p.title+' — Webcanbe',description:p.intro,kind:'information'}
for(const [slug,c] of Object.entries(supportChannels))routes['/contact/'+slug]={title:c.title+' — Webcanbe',description:c.intro,kind:'support'}
routes['/']={title:'Webcanbe — Build with real source code',description:'Browse working web projects, create your editable copy, edit visually or in code, keep history, and export the source.',kind:'home'}
routes['/browse']={title:'Browse Web Projects — Webcanbe Marketplace',description:'Discover published web projects. Review releases, previews, licenses and compatibility before creating an editable working copy.',kind:'marketplace'}
for(const c of categories)routes['/browse/'+c.slug]={title:c.title+' — Webcanbe Marketplace',description:c.description,kind:'marketplace'}
routes['/plans']={title:'Plans and AI allowances — Webcanbe',description:'Compare current Webcanbe plans, active-project capacity and AI Action allowances. Review live pricing and checkout availability.',kind:'plans'}
const aliases={'/templates':'/browse','/pricing':'/plans','/terms':'/legal/terms','/privacy':'/legal/privacy','/policy':'/legal/privacy','/licenses':'/legal/licenses'}
const schema=(url,m)=>{
 const graph=[{'@type':'Organization','@id':origin+'/#organization',name:'Webcanbe',url:origin+'/',logo:origin+'/brand/webcanbe-logo.svg'},{'@type':'WebSite','@id':origin+'/#website',name:'Webcanbe',url:origin+'/',publisher:{'@id':origin+'/#organization'}}]
 if(url==='/')graph.push({'@type':'WebApplication',name:'Webcanbe',url:origin+'/',applicationCategory:'DeveloperApplication',operatingSystem:'Web browser',description:m.description})
 if(m.kind==='docs')graph.push({'@type':'TechArticle',headline:docPages[url].title,description:m.description,url:origin+url,mainEntityOfPage:origin+url,author:{'@id':origin+'/#organization'},articleBody:[docPages[url].intro,...docPages[url].sections.flatMap(s=>[s.title,s.body,...s.steps||[]])].join('\n')})
 if(url!=='/')graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Webcanbe',item:origin+'/'},...(url.startsWith('/docs/')?[{'@type':'ListItem',position:2,name:'Docs',item:origin+'/docs'}]:[]),{'@type':'ListItem',position:url.startsWith('/docs/')?3:2,name:m.title.split(' — ')[0],item:origin+url}]})
 return JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')
}
function head(url,m){return `<meta charset="utf-8"><script src="/public-paint.js" defer></script><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(m.title)}</title><meta name="description" content="${esc(m.description)}"><link rel="canonical" href="${origin+url}"><meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(m.description)}"><meta property="og:url" content="${origin+url}"><meta property="og:type" content="${m.kind==='docs'?'article':'website'}"><meta property="og:image" content="${origin}/favicon.png"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(m.title)}"><meta name="twitter:description" content="${esc(m.description)}"><meta name="twitter:image" content="${origin}/favicon.png"><link rel="icon" href="/brand/webcanbe-mark.svg"><link rel="stylesheet" href="/public-shell.css"><link rel="stylesheet" href="/public-base.css"><script type="application/ld+json">${schema(url,m)}</script>`}
for(const [url,m] of Object.entries(routes)){
 if(url==='/')continue
 const file=out+'/__public'+url+'.html';fs.mkdirSync(path.dirname(file),{recursive:true})
 fs.writeFileSync(file,'<!doctype html><html lang="en"><head>'+head(url,m)+'</head><body>'+render(url,buildId)+'<script type="module" src="/public-enhancements.js"></script></body></html>')
}
// Retain the existing landing composition and hero; share the actual footer components.
const landingPath='public/wcb-landing/index.html'
const dom=new JSDOM(fs.readFileSync(landingPath,'utf8')),d=dom.window.document
const market=d.querySelector('.wcb-marketplace');market.querySelector('h2').textContent='Marketplace projects'
const marketIntro=market.querySelector('p');if(marketIntro)marketIntro.textContent='Find a useful starting point. Inspect a published release, explore its source, and make your own working copy.'
if(!d.querySelector('.wcb-capabilities')){const section=d.createElement('section');section.className='wcb-capabilities';section.innerHTML='<span class="wcb-section-label">One source. Every way to build.</span><h2>Everything you need to keep building</h2><p>Browse working projects, create your editable copy, edit visually or in code, keep history, and export the source.</p><div class="wcb-capability-grid">'+[['Real projects','Start from a published source release.','/docs/marketplace'],['Your working copy','Make changes without rewriting the original release.','/docs/working-copies'],['Visual editing','Change supported text and styles in context.','/docs/visual-editor'],['Code editing','Work directly in the actual project files.','/docs/code-editor'],['Split view','Keep source and preview side by side.','/docs/split-view'],['AI-assisted source editing','Review a proposed diff before applying it.','/docs/ai-editing'],['History','Inspect accepted source revisions.','/docs/history'],['Export real source','Continue in your own development environment.','/docs/export']].map(([t,b,u],i)=>`<a href="${u}"><span>0${i+1}</span><h3>${t}</h3><p>${b}</p><span aria-hidden="true">↗</span></a>`).join('')+'</div>';market.before(section)}
const principleHeading=[...d.querySelectorAll('h2')].find(n=>n.textContent==='Built around the way real code should work')
if(principleHeading){const section=principleHeading.closest('section');section.classList.add('wcb-principles');section.innerHTML='<div class="wcb-principles-inner"><h2>Built around the way real code should work</h2><p>Clear source, explicit changes, and a project you can keep using.</p><div class="wcb-principle-grid"><article><span>01 / Source</span><h3>One project, across every view</h3><p>Visual, Code and Split work with the same source. Use the view that fits the change.</p><a href="/docs/working-copies/modes">Choose an editing view</a></article><article><span>02 / Confidence</span><h3>Review what changes</h3><p>Inspect AI proposals before applying them and use History to understand accepted revisions.</p><a href="/docs/history">Understand History</a></article><article><span>03 / Ownership</span><h3>Keep moving with your source</h3><p>Export accepted files and continue in your own development environment under the release license.</p><a href="/docs/export">Explore source export</a></article></div></div>'}
for(const chat of d.querySelectorAll('[data-slot="chat-illustration"]'))chat.innerHTML='<div class="wcb-workflow-note"><b>Source → Edit → Review</b><p>Make a focused change, inspect the accepted revision, and keep building.</p><a href="/docs/first-edit">Make your first edit</a></div>'
for(const el of [...d.querySelectorAll('*')])if(!el.children.length){if(el.textContent.startsWith('Last updated:')||/^v?\d+\.\d+\.\d+$/.test(el.textContent.trim()))el.remove();else if(el.textContent.includes('future AI edits'))el.textContent=el.textContent.replace('future AI edits','applied AI edits');else if(el.textContent==='listing price')el.textContent='Release-specific terms';else if(el.textContent==='Made for static sites while avoiding heavy assets, your website will feel snappy and load instantly.')el.textContent='Inspect supported projects in a controlled browser preview, then keep working in the source.'}
// Replace invented endorsements with clearly stated product principles, not attributed reviews.
for(const el of [...d.querySelectorAll('[data-slot="social-proof"],.social-proof,[data-slot="carousel"]')]){if(!el.closest('.wcb-marketplace'))el.remove()}
for(const el of d.querySelectorAll('[data-slot="social-proof-item"]'))el.remove()
for(const a of d.querySelectorAll('a:not([href])')){const span=d.createElement('span');span.className=a.className;span.innerHTML=a.innerHTML;a.replaceWith(span)}
d.querySelector('.wcb-public-cta').outerHTML=cta();d.querySelector('.wcb-public-footer').outerHTML=footer()
// Remove preloads left by earlier React footer fragment replacements.
for(const link of d.querySelectorAll('link[rel=preload][href="/brand/webcanbe-logo.svg"]'))link.remove()
const categoryNav=d.createElement('nav');categoryNav.className='category-links';categoryNav.setAttribute('aria-label','Marketplace categories');categoryNav.innerHTML=categories.map(c=>`<a href="/browse/${c.slug}">${c.title}</a>`).join('');market.querySelector('.category-links')?.remove();market.append(categoryNav)
for(const a of d.querySelectorAll('a[href*="?category="]')){const value=new URL(a.href,origin).searchParams.get('category');const c=categories.find(c=>c.tag===value);if(c)a.setAttribute('href','/browse/'+c.slug)}
// One authoritative metadata block, with no inherited template schema or titles.
for(const node of d.head.querySelectorAll('title,meta[charset],meta[name="viewport"],script[src="/public-paint.js"],meta[name="description"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]'))node.remove()
const h=new JSDOM('<head>'+head('/',routes['/'])+'</head>').window.document.head
for(const node of [...h.children])if(!d.head.querySelector(`link[href="${node.getAttribute('href')}"]`)||node.tagName!=='LINK')d.head.append(d.importNode(node,true))
d.head.prepend(d.head.querySelector('meta[charset]'))
fs.writeFileSync('public/wcb-landing/copy.txt',d.body.textContent.split('\n').map(line=>line.trimEnd()).join('\n')+'\n');fs.writeFileSync(landingPath,dom.serialize());fs.mkdirSync(out+'/__public',{recursive:true});fs.writeFileSync(out+'/__public/home.html',dom.serialize())
fs.writeFileSync(out+'/__public/404.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Webcanbe</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/public-shell.css"><link rel="stylesheet" href="/public-base.css"></head><body>'+render('/404',buildId)+'</body></html>')
fs.writeFileSync('src/public/route-manifest.json',JSON.stringify({routes,aliases,categories:categories.map(c=>({slug:c.slug,tag:c.tag}))},null,2)+'\n')
fs.writeFileSync(out+'/docs-search.json',JSON.stringify(Object.entries(docPages).map(([url,p])=>({url,title:p.title,category:p.eyebrow,text:[p.intro,...p.sections.flatMap(s=>[s.body,...s.steps||[]])].join(' ')}))))
const privatePaths=['/__webcanbe/','/__wcb','/dashboard','/dashboard-preview','/workspace','/projects','/purchases','/requests','/settings','/seller','/checkout/','/_ops/','/login','/signup','/auth/','/marketplace','/editor/','/app/','/profile','/account','/billing','/notifications','/help']
const rules=privatePaths.map(p=>'Disallow: '+p).join('\n')
fs.writeFileSync(out+'/robots.txt',`# Search discovery and model-training crawlers are distinct policies.\nUser-agent: *\nAllow: /\n${rules}\n\nUser-agent: OAI-SearchBot\nAllow: /\n${rules}\n\n# No separate GPTBot override; the general public-access policy applies.\nSitemap: ${origin}/sitemap.xml\n`)
const xml=urls=>'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+origin+u+'</loc></url>').join('')+'</urlset>'
fs.writeFileSync(out+'/sitemap-public.xml',xml(Object.keys(routes)))
fs.writeFileSync(out+'/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>'+origin+'/sitemap-public.xml</loc></sitemap><sitemap><loc>'+origin+'/sitemap-listings.xml</loc></sitemap></sitemapindex>')
fs.writeFileSync(out+'/llms.txt',`# Webcanbe\n\n> Webcanbe is a source-first web project marketplace with visual and code editing. Published releases become separate working copies. Accepted source can be reviewed in History and exported. Compatibility is explicit.\n\nThis index is an optional convenience, not a ranking requirement.\n\n`+[['What is Webcanbe?','/docs/what-is-webcanbe'],['All documentation','/docs/index'],['Marketplace','/browse'],['Getting started','/docs/getting-started'],['Visual editor','/docs/visual-editor'],['Code and Split','/docs/split-view'],['AI editing','/docs/ai-editing'],['Export','/docs/export'],['Plans','/plans'],['Compatibility','/docs/compatibility'],['Security','/docs/security'],['Creator docs','/docs/creators'],['Support','/contact'],['Legal','/legal'],['Sitemap','/sitemap.xml']].map(([t,u])=>`- [${t}](${origin+u})`).join('\n')+'\n')
fs.writeFileSync(out+'/llms-full.txt',Object.entries(articles).map(([url,p])=>'# '+p.title+'\n'+origin+url+'\n\n'+p.intro+'\n\n'+p.sections.map(s=>'## '+s.title+'\n'+s.body+'\n'+(s.steps||[]).map((x,i)=>`${i+1}. ${x}`).join('\n')).join('\n\n')+'\n\nRelated: '+p.related.map(u=>origin+u).join(', ')).join('\n\n---\n\n'))
for(const name of ['robots.txt','sitemap.xml','sitemap-public.xml','llms.txt'])fs.copyFileSync(out+'/'+name,'public/'+name)
// Vercel static fallback has explicit public routes; Cloudflare Worker additionally renders live catalog records.
const staticConfig={routes:[...Object.entries(aliases).map(([from,to])=>({src:'^'+from+'/?$',status:308,headers:{Location:to}})),...Object.keys(routes).map(url=>({src:'^'+url+'/?$',dest:url==='/'?'/index.html':'/__public'+url+'.html'})),{src:'^/(?:__public/.*|app-shell\\.html)$',dest:'/__public/404.html',status:404,headers:{'X-Robots-Tag':'noindex'}},{handle:'filesystem'},{src:'^/(?:login|signup|dashboard|dashboard-preview|projects|purchases|requests|settings|seller|workspace|checkout|auth|_ops|project|marketplace|editor|app/docs|profile|account|billing|notifications|help)(?:/.*)?$',dest:'/app-shell.html',headers:{'X-Robots-Tag':'noindex, nofollow'}},{src:'^/.*$',dest:'/__public/404.html',status:404,headers:{'X-Robots-Tag':'noindex'}}]}
fs.writeFileSync('vercel.json',JSON.stringify(staticConfig,null,2)+'\n')
console.log(JSON.stringify({articles:Object.keys(articles).length,categories:docFamilies.length,publicRoutes:Object.keys(routes).length,build:buildId}))
if(process.argv.includes('--dist')){for(const name of ['__public','docs-search.json','robots.txt','sitemap.xml','sitemap-public.xml','llms.txt','llms-full.txt'])fs.cpSync(out+'/'+name,'dist/'+name,{recursive:true});fs.copyFileSync('dist/index.html','dist/app-shell.html');fs.copyFileSync(out+'/__public/home.html','dist/index.html')
// Keep the existing subscription UI and its pending-checkout resume behavior at /plans.
// Its first response still contains useful public plan guidance and metadata.
const appDoc=new JSDOM(fs.readFileSync('dist/app-shell.html','utf8')).window.document
const plansDoc=new JSDOM(fs.readFileSync('dist/__public/plans.html','utf8')).window.document
plansDoc.querySelector('script[src="/public-enhancements.js"]')?.remove()
const root=plansDoc.createElement('div');root.id='root';while(plansDoc.body.firstChild)root.append(plansDoc.body.firstChild);plansDoc.body.append(root)
for(const node of appDoc.querySelectorAll('link[rel="stylesheet"],link[rel="modulepreload"],script[type="module"][src]'))plansDoc.head.append(plansDoc.importNode(node,true))
fs.writeFileSync('dist/__public/plans.html','<!doctype html>'+plansDoc.documentElement.outerHTML)
}
