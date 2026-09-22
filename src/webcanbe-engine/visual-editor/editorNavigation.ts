import type { SourceTarget } from '../core/types'
export type EditorPage = { path: string; name: string }
export function pageName(path: string) {
  if (path === '/') return 'Home'
  const part = path.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) || path
  return part.replace(/[-_]/g, ' ').replace(/^./, value => value.toUpperCase())
}
// Only literal, absolute React Router paths are listed; dynamic paths need a real preview URL.
export function declaredPages(sources: string[]): EditorPage[] {
  const paths = new Set<string>(['/'])
  for (const source of sources) for (const match of source.matchAll(/<Route\b[^>]*\bpath\s*=\s*(?:["'](\/[^"']*)["']|\{\s*["'](\/[^"']*)["']\s*\})/g)) {
    const path = match[1] || match[2]
    if (!/[:*\\]/.test(path) && !path.startsWith('//')) paths.add(path)
  }
  return [...paths].map(path => ({ path, name: pageName(path) }))
}
const elementLabels: Record<string,string> = {main:'Page',header:'Header',nav:'Navigation',section:'Section',article:'Article',div:'Container',span:'Text',p:'Paragraph',h1:'Heading',h2:'Heading',h3:'Heading',h4:'Heading',a:'Link',button:'Button',img:'Image',footer:'Footer',aside:'Aside',ul:'List',li:'List item',input:'Input',form:'Form'}
export function layerName(target: SourceTarget) {
  const label = elementLabels[target.elementName] || target.elementName
  return target.text?.trim() ? `${label} · ${target.text.trim().slice(0,60)}` : label
}
export function layerDepth(target: SourceTarget, targets: SourceTarget[]) {
  return Math.min(6, targets.filter(parent => parent.identity.file === target.identity.file && parent.sourceRange.start < target.sourceRange.start && parent.sourceRange.end >= target.sourceRange.end).length)
}
