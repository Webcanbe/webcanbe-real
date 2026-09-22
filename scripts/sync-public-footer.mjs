import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
// Static landing and React footer share this navigation registry.
const groups=JSON.parse(fs.readFileSync('src/public/footer-data.json','utf8'))
const h=React.createElement
const footer=renderToStaticMarkup(h('footer',{className:'wcb-public-footer'},h('div',{className:'wcb-footer-intro'},h('a',{href:'/', 'aria-label':'Webcanbe home'},h('img',{src:'/brand/webcanbe-logo.svg',alt:'Webcanbe',width:150,height:28})),h('p',null,'Edit visually. Leave with real code you own.')),h('div',{className:'wcb-footer-groups'},groups.map(g=>h('nav',{'aria-label':g.title,key:g.title},h('h2',null,g.title),g.links.map(([label,href])=>h('a',{href,key:href},label))))),h('div',{className:'wcb-footer-bottom'},h('span',null,'© 2026 Webcanbe'),h('span',null,'The source is the product.'))))
const path='public/wcb-landing/index.html';let html=fs.readFileSync(path,'utf8');html=html.replace(/<footer\b[\s\S]*?<\/footer>/,footer);fs.writeFileSync(path,html)
// Regenerate category cards from data; these stay useful when public inventory is unavailable.
const categories=JSON.parse(fs.readFileSync('src/public/marketplace-categories.json','utf8'))
const cards=categories.map(({category,title,description,image})=>renderToStaticMarkup(h('a',{className:'wcb-marketplace-card',href:'/browse'+(category?'?category='+encodeURIComponent(category):'')},h('img',{src:image,alt:'',loading:'lazy',width:360,height:190}),h('div',null,h('h3',null,title),h('p',null,description),h('span',null,'Explore projects'))))).join('')
html=html.replace(/(<div class="wcb-marketplace-track"[^>]*>)[\s\S]*?(<\/div><\/section>)/,'$1'+cards+'$2')
fs.writeFileSync(path,html)
