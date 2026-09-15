import fs from 'node:fs'
import path from 'node:path'
import {parse, serialize} from 'parse5'
import {confinedFile} from './runtimeCompatibility'
import {safeArchivePath} from './projectRegistry'

export type StaticHtml = {entry:string; head:string; body:string; htmlAttributes:string; bodyAttributes:string; styles:string[]}
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const attributes=(node:any)=>(node?.attrs??[]).map((a:any)=>` ${a.name}="${escape(a.value)}"`).join('')
const ordinary=new Set(['html','head','body','meta','title','link','noscript','div','main','section','article','header','footer','nav','aside','p','span','h1','h2','h3','h4','h5','h6','ul','ol','li','a','img','br','hr','strong','em','small','label','button'])
/** Parse a finite static shell as data. Only the single local module entry is compiled.
 * The generated shell is preview instrumentation; original index.html is never edited. */
export function staticHtml(root:string,publicDir:string|false="public",runtimeRoot='.',transformedSource?:string) :StaticHtml|undefined {
  const index=path.posix.join(runtimeRoot,'index.html')
  if(!fs.existsSync(path.join(root,index)))return
  const source=transformedSource??fs.readFileSync(confinedFile(root,index),'utf8')
  if(Buffer.byteLength(source)>256*1024)throw Error('HTML shell exceeds its bounded static grammar.')
  const document:any=parse(source),entries:string[]=[],styles:string[]=[],ids=new Set<string>()
  let html:any,head:any,body:any,nodes=0,mount=false
  const walk=(node:any)=>{
    if(++nodes>4000)throw Error('Too many HTML shell nodes.')
    if(node.tagName){
      const tag=node.tagName,attrs=Object.fromEntries((node.attrs??[]).map((a:any)=>[a.name,a.value])) as Record<string,string>
      if(node.namespaceURI!=='http://www.w3.org/1999/xhtml'||!ordinary.has(tag)&&tag!=='script')throw Error('Unsupported active or foreign HTML shell element.')
      if(Object.keys(attrs).some(k=>/^on/i.test(k)||['srcdoc','is','formaction','action','ping','srcset','nonce','integrity'].includes(k)))throw Error('Executable or ambiguous HTML attributes are unsupported.')
      if(attrs['http-equiv']!==undefined&&!(tag==='meta'&&attrs['http-equiv'].toLowerCase()==='x-ua-compatible'&&attrs.content==='IE=edge'))throw Error('Active HTTP-equivalent HTML metadata is unsupported.')
      for(const [key,value]of Object.entries(attrs)){
        if(value.length>4096||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw Error('Invalid HTML attribute.')
        if(['href','src'].includes(key)&&/[\x00-\x20\x7f]/.test(value))throw Error('Whitespace/control bytes in HTML URLs are unsupported.')
        if(['href','src'].includes(key)&&/^https:\/\//i.test(value)){const url=new URL(value);if(url.username||url.password)throw Error('HTML URL credentials are forbidden.')}
        if(key==='style')throw Error('Inline HTML styles require explicit stylesheet source.')
        if(['href','src'].includes(key)&&(/^[\s]*[a-z][a-z0-9+.-]*:/i.test(value)&&!/^https:\/\//i.test(value)||value.startsWith('//')||value.includes('\\')))throw Error('Unsupported HTML resource URL.')
      }
      if(attrs.id!==undefined){if(!/^[A-Za-z][A-Za-z0-9_:.-]{0,63}$/.test(attrs.id)||ids.has(attrs.id))throw Error('Invalid or duplicate HTML identity.');ids.add(attrs.id);if(['div','main'].includes(tag))mount=true}
      if(tag==='html')html=node
      if(tag==='head')head=node
      if(tag==='body')body=node
      if(tag==='noscript'&&node.childNodes?.some((c:any)=>c.value?.includes('<')))throw Error('Only text noscript fallbacks are supported.')
      if(tag==='script'){
        if(attrs.type!=='module'||!attrs.src||Object.keys(attrs).some(k=>!['type','src','defer','crossorigin'].includes(k))||attrs.crossorigin!==undefined&&!['','anonymous'].includes(attrs.crossorigin)||node.childNodes?.some((c:any)=>c.value?.trim()))throw Error('Only one local module script entry is supported.')
        const entry=path.posix.join(runtimeRoot,attrs.src.replace(/^\//,'').replace(/^\.\//,''))
        if(!safeArchivePath(entry)||!/\.[cm]?[jt]sx?$/.test(entry))throw Error('HTML entry must be a local source module.')
        confinedFile(root,entry);entries.push(entry)
      }
      if(tag==='link'){
        if(!['stylesheet','icon','apple-touch-icon','canonical','preconnect','dns-prefetch'].includes(attrs.rel)||!attrs.href||Object.keys(attrs).some(k=>!['rel','href','type','media','sizes','crossorigin'].includes(k)))throw Error('Unsupported HTML link semantics.')
        if(attrs.rel==='stylesheet'&&!/^https:\/\//i.test(attrs.href)){
          if(attrs.media!==undefined&&attrs.media!=='all')throw Error('Conditional local HTML stylesheets are unsupported.')
          const href=attrs.href.replace(/^\//,'').replace(/^\.\//,'')
          let file=path.posix.join(runtimeRoot,href)
          if(!safeArchivePath(file)||!file.endsWith('.css'))throw Error('Invalid local HTML stylesheet.')
          if(!fs.existsSync(path.join(root,file))&&publicDir!==false)file=path.posix.join(publicDir,href)
          confinedFile(root,file);styles.push(file)
        }
      }
    }
    for(const child of [...node.childNodes??[]])walk(child)
    if(node.childNodes)node.childNodes=node.childNodes.filter((c:any)=>c.tagName!=='script'&&!(c.tagName==='link'&&c.attrs?.some((a:any)=>a.name==='rel'&&['preconnect','dns-prefetch'].includes(a.value)))&&!(c.tagName==='link'&&c.attrs?.some((a:any)=>a.name==='rel'&&a.value==='stylesheet')&&!c.attrs?.some((a:any)=>a.name==='href'&&/^https:\/\//i.test(a.value))))
  }
  walk(document)
  if(entries.length!==1||!mount||!body||!head||!html)throw Error('HTML requires one local module and an identified div/main mount.')
  return{entry:entries[0],head:serialize(head),body:serialize(body),htmlAttributes:attributes(html),bodyAttributes:attributes(body),styles}
}
export function previewDocument(shell:StaticHtml|undefined,styles:string,scripts:string,policy=""){
  return '<!doctype html><html'+(shell?.htmlAttributes??'')+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+policy+(shell?.head??'')+styles+'</head><body'+(shell?.bodyAttributes??'')+'>'+(shell?.body??'<div id="root"></div>')+scripts+'</body></html>'
}
