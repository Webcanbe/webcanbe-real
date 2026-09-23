import fs from 'node:fs'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {articles,docPages,docFamilies,docsNav} from '../.public-site/renderer.mjs'
const manifest=JSON.parse(fs.readFileSync('src/public/route-manifest.json','utf8')),groups=JSON.parse(fs.readFileSync('src/public/footer-data.json','utf8'))
const root=process.argv.includes('--source')?'.public-site':'dist'
const routes=manifest.routes,failures=[];let linksChecked=0,schemaCount=0
const check=(ok,msg)=>{if(!ok)failures.push(msg)}
const words=p=>[p.intro,...p.sections.flatMap(s=>[s.body,...s.steps||[]])].join(' ').split(/\s+/).length
check(Object.keys(articles).length>=100,'At least 100 substantive articles')
const slugs=docFamilies.flatMap(f=>Object.keys(f.pages));check(new Set(slugs).size===slugs.length,'Duplicate document slug')
const paragraphs=new Set()
for(const [url,p] of Object.entries(articles)){check(words(p)>=160,`Thin article ${url}: ${words(p)} words`);check(p.sections.every(s=>s.body.length>70||s.steps?.length>=3),`Incomplete section ${url}`);check(p.related.length>=3,`Related links ${url}`);for(const s of p.sections)if(s.body.length>100){check(!paragraphs.has(s.body),`Repeated paragraph ${url}`);paragraphs.add(s.body)}for(const related of p.related)check(Boolean(docPages[related]),`Unresolved related link ${url} -> ${related}`)}
for(const [,items] of docsNav)for(const [,href] of items)check(Boolean(docPages[href]),`Nav ${href}`)
const sitemap=fs.readFileSync(root+'/sitemap-public.xml','utf8'),xml=new JSDOM(sitemap,{contentType:'text/xml'}).window.document
const locations=[...xml.querySelectorAll('loc')].map(n=>n.textContent);check(locations.length===Object.keys(routes).length,'Sitemap route count');for(const url of Object.keys(routes))check(locations.includes('https://webcanbe.com'+url),`Sitemap missing ${url}`)
check(!locations.some(u=>/^\/(dashboard|workspace|settings|purchases|checkout|_ops|auth|login|signup|seller)(\/|$)/.test(new URL(u).pathname)),'Private sitemap URL')
check(groups.length===7,'Footer group count');const footerUrls=groups.flatMap(g=>g.links.map(([,u])=>u));for(const g of groups)check(g.links.length>=6,'Footer links '+g.title)
for(const href of footerUrls)check(href==='https://github.com/Webcanbe/webcanbe-real'||['/seller','/seller/apply','/seller/projects/new','/creators'].includes(href)||Boolean(routes[href]),'Footer route '+href)
const titles=new Set(),descriptions=new Set(),canonicals=new Set(),docs=new Map()
for(const [url,m] of Object.entries(routes)){
 const file=root+'/__public'+(url==='/'?'/home':url)+'.html';check(fs.existsSync(file),'Missing HTML '+url);if(!fs.existsSync(file))continue
 const dom=new JSDOM(fs.readFileSync(file,'utf8')),d=dom.window.document;docs.set(url,d)
 check(d.querySelectorAll('h1').length===1,'H1 '+url)
 const title=d.title,description=d.querySelector('meta[name=description]')?.content,canonical=d.querySelector('link[rel=canonical]')?.href
 check(title===m.title&&!titles.has(title),'Title '+url);titles.add(title)
 check(description===m.description&&!descriptions.has(description),'Description '+url);descriptions.add(description)
 check(canonical==='https://webcanbe.com'+url&&!canonicals.has(canonical),'Canonical '+url);canonicals.add(canonical)
 check(!d.querySelector('meta[name=robots][content*=noindex]'),'Public noindex '+url)
 check(Boolean(d.querySelector('main'))&&Boolean(d.querySelector('footer')),'Semantic shell '+url)
 for(const node of d.querySelectorAll('script[type="application/ld+json"]')){try{const data=JSON.parse(node.textContent);check(data['@context']==='https://schema.org','Schema context '+url);schemaCount++}catch{failures.push('Invalid JSON-LD '+url)}}
 if(url.startsWith('/docs')){const article=d.querySelector('article');check(Boolean(article),'Crawlable article '+url);check(!article?.querySelector('[hidden],[style*="display:none"],[style*="opacity:0"]'),'Hidden article '+url)}
 check(!/Maya Chen|Daniel Reed|Pick up where you left off|We need to update this heading/.test(d.body.textContent),'Invented or unfinished copy '+url)
 for(const el of d.querySelectorAll('script:not([src]):not([type="application/ld+json"])'))check(!/userAgent|bot|crawler/i.test(el.textContent),'Crawler switching '+url)
}
const assets=new Set(['.svg','.png','.webp','.woff2','.css','.js','.json','.xml','.txt'])
const app=/^\/(login|signup|dashboard|settings|purchases|projects|project|seller|creators|requests)(\/|$)/
for(const [url,d] of docs){for(const a of d.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(href.startsWith('mailto:')||href.startsWith('https://'))continue;linksChecked++;const target=new URL(href,'https://webcanbe.com'+url);const pathname=target.pathname;check(href!=='#','Empty link '+url);check(Boolean(routes[pathname]||manifest.aliases[pathname])||app.test(pathname)||[...assets].some(ext=>pathname.endsWith(ext)),`Unresolved ${url} -> ${href}`);if(target.hash&&docs.has(pathname))check(Boolean(docs.get(pathname).getElementById(decodeURIComponent(target.hash.slice(1)))),'Missing anchor '+url+' -> '+href)}}
const robots=fs.readFileSync(root+'/robots.txt','utf8');const oai=robots.split('User-agent: OAI-SearchBot')[1]?.split('User-agent:')[0];check(Boolean(oai)&&oai.includes('Allow: /'),'OAI search allowed');for(const prefix of ['/docs','/browse','/project','/legal','/contact'])check(!new RegExp('Disallow: '+prefix+'(?:/|\\s|$)').test(oai||''),'OAI blocked '+prefix);for(const prefix of ['/dashboard','/workspace','/settings','/__webcanbe/','/marketplace','/editor/','/app/','/profile','/account','/billing','/notifications','/help'])check(oai?.includes('Disallow: '+prefix),'Private robot exclusion '+prefix)
const home=docs.get('/');check(home.querySelector('.wcb-capabilities')?.textContent.includes('Everything you need to keep building'),'Capability section');check(home.querySelector('.wcb-marketplace h2')?.textContent==='Marketplace projects','Marketplace section');check(home.querySelector('.wcb-capabilities')!==home.querySelector('.wcb-marketplace'),'Separate sections');check(home.querySelector('.wcb-public-cta h2')?.textContent==='Start with source you can keep building.'&&home.querySelector('.wcb-public-cta a[href="/browse"]')&&home.querySelector('.wcb-public-cta a[href="/docs/getting-started"]'),'CTA')
for(const file of ['worker/public-routing.js','worker/public-catalog-pages.js'])check(!/user-agent|Googlebot|OAI-SearchBot|GPTBot/i.test(fs.readFileSync(file,'utf8')),'Crawler-specific rendering '+file)
const report={articles:Object.keys(articles).length,docsUrls:Object.keys(docPages).length,categories:docFamilies.length,minArticleWords:Math.min(...Object.values(articles).map(words)),publicUrls:Object.keys(routes).length,footerGroups:groups.length,footerLinks:footerUrls.length,uniqueFooterDestinations:new Set(footerUrls).size,linksChecked,metadataCoverage:titles.size,canonicalCoverage:canonicals.size,jsonLdDocuments:schemaCount,failures}
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/public-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));assert.equal(failures.length,0,'Public validation failed')
