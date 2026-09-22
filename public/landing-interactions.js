function initializeLanding(root=document) {
  const cleanup=[]
  const bind=(node,event,fn)=>{node.addEventListener(event,fn);cleanup.push(()=>node.removeEventListener(event,fn))}
  const connect=(track,prev,next)=>{
    if(!track||!prev||!next)return
    const update=()=>{prev.disabled=track.scrollLeft<5;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-5}
    const move=direction=>track.scrollBy({left:direction*(track.firstElementChild?.getBoundingClientRect().width+24||track.clientWidth),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})
    bind(prev,'click',()=>move(-1));bind(next,'click',()=>move(1));bind(track,'scroll',update)
    bind(track,'keydown',e=>{if(e.target!==track)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}})
    const observer=new ResizeObserver(update);observer.observe(track);cleanup.push(()=>observer.disconnect());update()
  }
  const track=root.querySelector('.wcb-marketplace-track')
  if(track){
    const controller=new AbortController();cleanup.push(()=>controller.abort())
    fetch('/__webcanbe/api/product/catalog/browse',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:12}),signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('Catalog unavailable');return response.json()})
      .then(({listings})=>{
        if(controller.signal.aborted||!Array.isArray(listings)||!listings.length)return
        const cards=listings.filter(p=>typeof p.slug==='string'&&typeof p.title==='string').map(project=>{
          const card=document.createElement('a');card.className='wcb-marketplace-card';card.href='/project/'+encodeURIComponent(project.slug)
          const cover=document.createElement('div');cover.className='wcb-project-card-cover';cover.textContent=project.title
          const content=document.createElement('div'),title=document.createElement('h3'),summary=document.createElement('p'),action=document.createElement('span')
          title.textContent=project.title;summary.textContent=typeof project.summary==='string'?project.summary:'Inspect the published project release and source details.';action.textContent='View project'
          content.append(title,summary,action);card.append(cover,content);return card
        })
        if(cards.length){track.replaceChildren(...cards);track.setAttribute('aria-label','Marketplace projects');track.dispatchEvent(new Event('scroll'))}
      }).catch(()=>{/* Category links remain useful when no public inventory can be loaded. */})
  }
  connect(root.querySelector('.wcb-marketplace-track'),root.querySelector('[data-market-prev]'),root.querySelector('[data-market-next]'))
  root.querySelectorAll('[data-slot="carousel"]').forEach(carousel=>{const track=carousel.querySelector('[data-slot="carousel-content"]');if(track){track.tabIndex=0;track.setAttribute('aria-label','Reviews')}connect(track,carousel.querySelector('[data-slot="carousel-previous"]'),carousel.querySelector('[data-slot="carousel-next"]'))})
  root.querySelectorAll('button[data-slot="sheet-trigger"]').forEach(button=>{button.setAttribute('aria-label','Open navigation');button.setAttribute('aria-expanded','false');bind(button,'click',()=>{let menu=root.querySelector('.wcb-landing-mobile-menu');if(menu){menu.remove();button.setAttribute('aria-expanded','false');return}menu=document.createElement('nav');menu.className='wcb-landing-mobile-menu';menu.setAttribute('aria-label','Main navigation');menu.innerHTML='<a href="/browse">Marketplace</a><a href="/docs">Documentation</a><a href="/changelog">Changelog</a><a href="/login">Sign in</a>';button.parentElement.append(menu);button.setAttribute('aria-expanded','true')})})
  return ()=>cleanup.forEach(fn=>fn())
}
window.webcanbeInitializeLanding=initializeLanding
if(!document.getElementById('root'))initializeLanding()
