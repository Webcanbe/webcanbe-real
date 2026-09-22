// Local-only diagnostics: no identifiers, storage or network transmission.
window.webcanbePublicPaint={cls:0,firstContentfulPaint:null}
document.documentElement.dataset.publicClsSupported=String(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('layout-shift'))
document.documentElement.dataset.publicCls='0'
if('PerformanceObserver' in window){try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.webcanbePublicPaint.cls+=e.value;document.documentElement.dataset.publicCls=String(window.webcanbePublicPaint.cls)}}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.name==='first-contentful-paint'){window.webcanbePublicPaint.firstContentfulPaint=e.startTime;document.documentElement.dataset.publicFcp=String(e.startTime)}}).observe({type:'paint',buffered:true})}catch{/* Diagnostics are optional on browsers without these entry types. */}}
