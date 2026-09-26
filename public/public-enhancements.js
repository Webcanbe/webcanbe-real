import { firstPartyTemplates } from './catalog-model.js'
// Progressive enhancement only: article text and navigation are already in the HTTP HTML.
const text=(tag,value,className)=>{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n}
const search=document.querySelector('.wcb-docs-search input'),results=document.querySelector('.wcb-docs-search-results')
if(search&&results){let indexPromise;let sequence=0;const load=()=>indexPromise ||= fetch('/docs-search.json').then(r=>{if(!r.ok)throw Error();return r.json()});search.addEventListener('focus',()=>load().catch(()=>{}),{once:true});search.addEventListener('input',async()=>{const seq=++sequence,q=search.value.trim().toLowerCase();results.hidden=!q;results.replaceChildren();if(!q)return;try{const index=await load();if(seq!==sequence)return;const matches=index.filter(p=>(p.title+' '+p.category+' '+p.text).toLowerCase().includes(q)).sort((a,b)=>Number(b.title.toLowerCase().includes(q))-Number(a.title.toLowerCase().includes(q))).slice(0,10);for(const p of matches){const a=document.createElement('a');a.href=p.url;a.append(text('b',p.title),text('span',p.category));results.append(a)}if(!matches.length)results.append(text('p','No matching articles. Try a feature or task name.'))}catch{results.append(text('p','Search is unavailable. Browse All documentation in the navigation.'))}});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();search.focus()}if(e.key==='Escape'){search.value='';results.hidden=true;++sequence}})}
const form=document.querySelector('.support-form')
if(form){const status=form.querySelector('[data-support-status]'),submit=form.querySelector('button[type=submit]');const details={currentUrl:location.origin+location.pathname,appVersion:String(form.dataset.build||'unknown').slice(0,100)};
 let csrf='';fetch('/__webcanbe/auth/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{if(!r.ok)return;const session=await r.json();if(typeof session.csrf==='string'){csrf=session.csrf;const email=form.querySelector('[name=requesterEmail]');email.required=false;email.placeholder='Signed-in account identity will be used'}}).catch(()=>{});
 form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;submit.disabled=true;status.textContent='Creating request…';const data=new FormData(form),parts=[];for(const [key,value] of data)if(!['category','subject','context','requesterEmail','message'].includes(key)&&String(value).trim())parts.push(key+': '+String(value).trim());const message=String(data.get('message')||'').trim(),description=[message,...parts].filter(Boolean).join('\n\n');const payload={category:form.dataset.category,subject:String(data.get('subject')||'').replace(/[\r\n]/g,' ').trim(),description,...(!csrf?{requesterEmail:String(data.get('requesterEmail')||'').trim()}:{}),...(data.has('context')?{safeContext:details}:{})};try{const response=await fetch(csrf?'/__webcanbe/api/requests/create':'/__webcanbe/api/requests/public/create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-WCB-CSRF':csrf}:{})},body:JSON.stringify(payload)}),value=await response.json().catch(()=>({}));if(!response.ok)throw Error(typeof value.error==='string'?value.error:'Request could not be created.');form.reset();status.replaceChildren(text('b','Request created: '+value.request.requestNumber),text('span',' Save this reference. Email delivery is not configured or claimed.'))}catch(error){status.textContent=error instanceof Error?error.message:'Request could not be created.'}finally{submit.disabled=false}})}
const categoryToggle=document.querySelector('[data-market-category-toggle]')
if(categoryToggle){const directory=document.getElementById(categoryToggle.getAttribute('aria-controls'));if(directory){categoryToggle.dataset.enhanced='true';directory.dataset.open='false'}categoryToggle.addEventListener('click',()=>{if(!directory)return;const open=categoryToggle.getAttribute('aria-expanded')!=='true';categoryToggle.setAttribute('aria-expanded',String(open));directory.dataset.open=String(open);categoryToggle.querySelector('span')?.replaceChildren(open?'−':'+')})}
const catalog=document.querySelector('[data-catalog-category]')
if(catalog){
 const status=catalog.querySelector('[data-catalog-status]'),retry=catalog.querySelector('[data-market-retry]'),grid=catalog.querySelector('[data-catalog-results]'),form=document.querySelector('.market-search'),headerSearch=document.querySelector('.public-market-search'),routeCategory=catalog.dataset.catalogCategory
 let controller,requestNumber=0
 const validType=value=>['templates','components','plugins','vectors'].includes(value)?value:'templates'
 const state=()=>{const p=new URLSearchParams(location.search);return {query:(p.get('query')||'').slice(0,100),type:validType(p.get('type')),sort:['featured','name','price-low'].includes(p.get('sort'))?p.get('sort'):'featured',price:['all','free','under-75','75-plus'].includes(p.get('price'))?p.get('price'):'all',style:p.get('style')||'all'}}
 const setState=change=>{const url=new URL(location.href);for(const [key,value] of Object.entries(change)){if(!value||['all','featured','templates'].includes(value))url.searchParams.delete(key);else url.searchParams.set(key,value)}history.pushState({},'',url);void load()}
 const listboxes=[...(form?.querySelectorAll('[data-market-listbox]')||[])]
 const closeListbox=(box,restoreFocus=false)=>{const trigger=box.querySelector('.market-listbox-trigger'),options=box.querySelector('.market-listbox-options');options.hidden=true;trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus()}
 const openListbox=(box,last=false)=>{for(const other of listboxes)if(other!==box)closeListbox(other);const trigger=box.querySelector('.market-listbox-trigger'),options=box.querySelector('.market-listbox-options'),items=[...options.querySelectorAll('[role="option"]')];options.hidden=false;trigger.setAttribute('aria-expanded','true');(last?items.at(-1):items.find(item=>item.getAttribute('aria-selected')==='true')||items[0])?.focus()}
 const syncListboxes=current=>{for(const box of listboxes){const value=current[box.dataset.marketListbox],input=box.querySelector('input[type="hidden"]'),trigger=box.querySelector('.market-listbox-trigger'),items=[...box.querySelectorAll('[role="option"]')],selected=items.find(item=>item.dataset.value===value)||items[0];if(input)input.value=value;if(selected&&trigger.firstChild)trigger.firstChild.textContent=selected.textContent;for(const item of items)item.setAttribute('aria-selected',String(item===selected))}}
 for(const box of listboxes){const trigger=box.querySelector('.market-listbox-trigger'),options=box.querySelector('.market-listbox-options'),items=[...options.querySelectorAll('[role="option"]')];trigger.addEventListener('click',()=>options.hidden?openListbox(box):closeListbox(box));trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();openListbox(box,event.key==='ArrowUp')}});for(const [index,item] of items.entries()){const choose=()=>{closeListbox(box,true);setState({[box.dataset.marketListbox]:item.dataset.value})};item.addEventListener('click',choose);item.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeListbox(box,true)}else if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus()}else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose()}else if(event.key==='Tab')closeListbox(box)})}}
 document.addEventListener('pointerdown',event=>{for(const box of listboxes)if(!box.contains(event.target))closeListbox(box)})
 const card=item=>{const article=document.createElement('article');article.className='wcb-marketplace-card';const cover=document.createElement('a');cover.className='wcb-marketplace-cover-link';cover.href='/project/'+encodeURIComponent(item.slug);cover.setAttribute('aria-label','View '+item.title);const img=document.createElement('img');img.className='wcb-project-card-cover';img.alt=item.title+' website preview';img.loading='lazy';const thumb=item.thumbnail||item.demoMetadata?.previewImage||item.demoMetadata?.thumbnail;if(typeof thumb==='string'&&(/^\/[^/]/.test(thumb)||/^https:\/\/[^/]+/.test(thumb)))img.src=thumb;else img.classList.add('wcb-project-card-cover-empty');cover.append(img);const meta=text('div','','wcb-marketplace-card-meta'),name=text('div','');const title=document.createElement('a');title.href=cover.href;title.append(text('h3',item.title));const creator=document.createElement('a');creator.className='wcb-marketplace-creator';creator.href='/creators/'+encodeURIComponent(String(item.creator||item.demoMetadata?.creator||'Webcanbe').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));creator.textContent='by '+(item.creator||item.demoMetadata?.creator||'Webcanbe');name.append(title,creator);const price=text('strong',Number.isSafeInteger(item.priceMinor)?item.priceMinor===0?'Free':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(item.priceMinor/100):'View price');meta.append(name,price);article.append(cover,meta,text('p',item.summary||''));return article}
 const sync=()=>{const current=state();const heading=document.querySelector('.public-market-intro h1'),lead=document.querySelector('.public-market-intro p');if(current.type!=='templates'){const name=current.type[0].toUpperCase()+current.type.slice(1);if(heading)heading.textContent=name;if(lead)lead.textContent=`No ${current.type} have been published yet. Explore source-backed templates while this collection grows.`;document.title=name+' | Webcanbe Marketplace'}else if(heading&&heading.dataset.originalHeading){heading.textContent=heading.dataset.originalHeading;if(lead)lead.textContent=heading.dataset.originalLead;document.title=heading.dataset.originalTitle}for(const f of [form,headerSearch]){const input=f?.querySelector('[name=query]');if(input&&input.value!==current.query)input.value=current.query}syncListboxes(current);for(const a of document.querySelectorAll('[data-market-type],[data-market-sort]')){if(a.dataset.marketType===current.type||a.dataset.marketSort===current.sort)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}}
 const introHeading=document.querySelector('.public-market-intro h1'),introLead=document.querySelector('.public-market-intro p');if(introHeading){introHeading.dataset.originalHeading=introHeading.textContent;introHeading.dataset.originalLead=introLead?.textContent||'';introHeading.dataset.originalTitle=document.title}
 const load=async()=>{
  controller?.abort()
  const active=new AbortController()
  controller=active
  const id=++requestNumber,options=state()
  sync()
  if(options.type!=='templates'){
   grid.replaceChildren()
   retry.hidden=true
   catalog.dataset.catalogError='false'
   status.textContent=options.type[0].toUpperCase()+options.type.slice(1)+' have no published items yet. Browse source-backed templates while this catalog grows.'
   return
  }
  const first=firstPartyTemplates.filter(p=>!routeCategory||p.category.toLowerCase()===routeCategory.toLowerCase())
  const matches=p=>(!options.query||`${p.title} ${p.summary} ${p.category||''} ${Array.isArray(p.tags)?p.tags.join(' '):''}`.toLowerCase().includes(options.query.toLowerCase()))
   &&(options.style==='all'||[p.category,p.demoMetadata?.category,...(Array.isArray(p.tags)?p.tags:[])].some(value=>String(value||'').toLowerCase()===options.style.toLowerCase()))
   &&(options.price==='all'||options.price==='free'&&p.priceMinor===0||options.price==='under-75'&&p.priceMinor<7500||options.price==='75-plus'&&p.priceMinor>=7500)
  const render=(published,phase)=>{
   const items=[...first,...published.filter(p=>!first.some(template=>template.slug===p.slug))].filter(matches)
   if(options.sort==='name')items.sort((a,b)=>a.title.localeCompare(b.title))
   if(options.sort==='price-low')items.sort((a,b)=>(a.priceMinor??0)-(b.priceMinor??0))
   grid.replaceChildren(...items.map(card))
   status.textContent=phase==='loading'
    ?items.length?`Showing ${items.length} first-party template${items.length===1?'':'s'}. Checking published listings…`:'Checking published listings…'
    :phase==='error'
     ?items.length?`Showing ${items.length} first-party template${items.length===1?'':'s'}. Published listings could not be loaded. Retry to see the full catalog.`:'Published listings could not be loaded. Retry to see the full catalog.'
     :items.length?`${items.length} project${items.length===1?'':'s'} available`:'No projects match these filters. Clear the filters or try another category.'
   catalog.dataset.catalogError=phase==='error'?'true':'false'
   retry.hidden=phase!=='error'
   document.querySelector('#catalog-schema')?.remove()
   if(items.length){const schema=document.createElement('script');schema.type='application/ld+json';schema.id='catalog-schema';schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'ItemList',itemListElement:items.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.title,url:'https://webcanbe.com/project/'+encodeURIComponent(p.slug)}))});document.head.append(schema)}
  }
  render([],'loading')
  const timeout=window.setTimeout(()=>active.abort(),9_000)
  let published=[],failed=false
  try{
   const response=await fetch('/__webcanbe/api/product/catalog/browse',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:options.query,limit:100,...(routeCategory?{tags:[routeCategory.toLowerCase()]}:{})}),signal:active.signal})
   if(!response.ok)throw Error()
   const payload=await response.json()
   if(!Array.isArray(payload.listings))throw Error()
   published=payload.listings.filter(p=>typeof p.slug==='string'&&typeof p.title==='string')
  }catch{if(id!==requestNumber)return;failed=true}
  finally{window.clearTimeout(timeout)}
  if(id!==requestNumber)return
  render(published,failed?'error':'ready')
 }
 for(const f of [form,headerSearch])f?.addEventListener('submit',e=>{e.preventDefault();setState({query:f.querySelector('[name=query]')?.value.trim().slice(0,100)||''})})
 form?.querySelector('[data-market-reset]')?.addEventListener('click',()=>{const url=new URL(location.href);url.search='';history.pushState({},'',url);void load()})
 for(const a of document.querySelectorAll('[data-market-type],[data-market-sort]'))a.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();setState(a.dataset.marketType?{type:a.dataset.marketType}:{sort:a.dataset.marketSort})})
 retry?.addEventListener('click',()=>void load());window.addEventListener('popstate',()=>void load());void load()
}
