import manifest from '../src/public/route-manifest.json'
export function publicRoute(pathname,search='') {
 let path=pathname
 try{path=decodeURI(path)}catch{return {status:404,asset:'/__public/404.html'}}
 if(path.length>1&&path.endsWith('/'))return {status:308,redirect:path.replace(/\/+$/,'')+search}
 if(path==='/marketplace')return {status:308,redirect:'/browse'+search}
 if(manifest.aliases[path])return {status:308,redirect:manifest.aliases[path]+search}
 if(path==='/browse'){
  const category=new URLSearchParams(search).get('category')
  if(category){const c=manifest.categories.find(c=>c.tag.toLowerCase()===category.toLowerCase());if(c)return {status:308,redirect:'/browse/'+c.slug}}
 }
 if(manifest.routes[path])return {status:200,asset:path==='/'?'/__public/home.html':'/__public'+path+'.html'}
 if(['/docs','/browse','/contact','/legal'].some(prefix=>path===prefix||path.startsWith(prefix+'/')))return {status:404,asset:'/__public/404.html'}
 return null
}
export {manifest}
