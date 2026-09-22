import fs from 'node:fs'
import path from 'node:path'
export function publicSitePlugin(){
 const handler=(root,preview)=> (req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method))return next()
  const u=new URL(req.url,'http://localhost'),manifest=JSON.parse(fs.readFileSync('src/public/route-manifest.json','utf8'));let p=u.pathname
  if(p.startsWith('/__public/')||p==='/app-shell.html'){res.statusCode=404;res.end('Not found');return}
  let redirect=manifest.aliases[p]
  if(p.length>1&&p.endsWith('/'))redirect=p.replace(/\/+$/,'')+u.search
  if(p==='/browse'&&u.searchParams.has('category')){const c=manifest.categories.find(c=>c.tag.toLowerCase()===u.searchParams.get('category').toLowerCase());if(c)redirect='/browse/'+c.slug}
  if(redirect){res.statusCode=308;res.setHeader('Location',redirect);res.end();return}
  if(p==='/plans'&&!preview)return next()
  let file,status=200
  if(manifest.routes[p])file=p==='/'?'/__public/home.html':'/__public'+p+'.html'
  else if(['/docs/','/browse/','/contact/','/legal/'].some(prefix=>p.startsWith(prefix))){file='/__public/404.html';status=404}
  else if(['/docs-search.json','/robots.txt','/sitemap.xml','/sitemap-public.xml','/llms.txt','/llms-full.txt'].includes(p))file=p
  else if(preview&&!path.extname(p)&&!p.startsWith('/__webcanbe/')){if(/^\/(login|signup|dashboard|dashboard-preview|projects|purchases|settings|seller|workspace|checkout|auth|_ops|project)(\/|$)/.test(p))file='/app-shell.html';else{file='/__public/404.html';status=404}}
  if(!file)return next()
  const target=path.join(root,file);if(!fs.existsSync(target))return next()
  res.statusCode=status;res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json':file.endsWith('.xml')?'application/xml':'text/plain; charset=utf-8');if(status===404||file==='/app-shell.html')res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(req.method==='HEAD'?'':fs.readFileSync(target))
 }
 return {name:'webcanbe-public-html',configureServer(server){server.middlewares.use(handler('.public-site',false))},configurePreviewServer(server){server.middlewares.use(handler('dist',true))}}
}
