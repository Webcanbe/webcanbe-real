import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {PublicSite} from '../src/public/PublicSite'
import {SharedCTA,SharedFooter} from '../src/public/SharedFooter'
export {docPages,articles,docFamilies,docsNav} from '../src/public/docs-content'
export {infoPages,supportChannels} from '../src/public/content/public-pages'
export {categories} from '../src/public/categories'
export const render=(path:string,build:string)=>renderToStaticMarkup(<PublicSite path={path} build={build}/>)
export const footer=()=>renderToStaticMarkup(<SharedFooter/>)
export const cta=()=>renderToStaticMarkup(<SharedCTA/>)
