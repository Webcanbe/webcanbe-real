import gettingStarted from './content/docs/getting-started'
import marketplace from './content/docs/marketplace'
import purchases from './content/docs/purchases'
import workspaces from './content/docs/workspaces'
import visual from './content/docs/visual'
import code from './content/docs/code'
import ai from './content/docs/ai'
import history from './content/docs/history'
import exports from './content/docs/export'
import compatibility from './content/docs/compatibility'
import creators from './content/docs/creators'
import account from './content/docs/account'
import billing from './content/docs/billing'
import security from './content/docs/security'
import type { DocPage } from './content/doc-types'
export const docFamilies = [gettingStarted,marketplace,purchases,workspaces,visual,code,ai,history,exports,compatibility,creators,account,billing,security]
export const articles: Record<string, DocPage> = Object.assign({},...docFamilies.map(f=>f.pages))
export const docPages: Record<string,DocPage> = {
  '/docs': {title:'Documentation',eyebrow:'Webcanbe Docs',intro:'Find a project, make it your own, and keep the source. Practical guides to marketplace releases, visual and code editing, AI proposals, history and export.',sections:docFamilies.map(f=>({title:f.name,body:Object.values(f.pages)[0].intro,links:Object.keys(f.pages)})),related:['/docs/what-is-webcanbe','/docs/getting-started','/docs/compatibility'],video:{src:'',title:'From a project to your own source'}},
  '/docs/index': {title:'All documentation',eyebrow:'Webcanbe Docs',intro:'A complete, browsable index of Webcanbe documentation. Choose a task or use documentation search to find an exact topic.',sections:docFamilies.map(f=>({title:f.name,body:'',links:Object.keys(f.pages)})),related:['/docs','/docs/getting-started','/docs/what-is-webcanbe']},
  ...articles,
}
export const docsNav: [string,[string,string][]][] = docFamilies.map(f=>[f.name,Object.entries(f.pages).map(([href,page])=>[page.title,href])])
