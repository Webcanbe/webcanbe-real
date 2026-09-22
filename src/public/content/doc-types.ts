export type DocSection = { title: string; body: string; steps?: string[]; links?: string[] }
export type DocPage = { title: string; eyebrow: string; intro: string; sections: DocSection[]; related: string[]; video?: { src: string; title: string } }
export type DocFamily = { name: string; pages: Record<string, DocPage> }
/** Author the task, steps, outcome and boundaries separately. No generated filler. */
export function family(name: string, entries: Array<[string, string, string, string, string[], string, string, string[]]>): DocFamily {
  if(new Set(entries.map(([slug])=>slug)).size!==entries.length)throw new Error('Duplicate documentation slug in '+name)
  return { name, pages: Object.fromEntries(entries.map(([slug,title,intro,prepare,steps,result,limits,related]) => ['/docs/'+slug, {
    title, eyebrow:name, intro, sections:[
      {title:'Before you begin',body:prepare},
      {title:'How it works',body:'',steps},
      {title:'Check the result',body:result},
      {title:'Limits and troubleshooting',body:limits},
    ], related:related.map(s=>'/docs/'+s),
  }])) }
}
