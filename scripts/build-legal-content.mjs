import fs from "node:fs"
import path from "node:path"

const sourceDir = process.argv[2]
const outputFile = process.argv[3] ?? "src/public/content/legal-review-3.json"
if (!sourceDir) throw new Error("Usage: node scripts/build-legal-content.mjs <extracted-pdf-directory> [output-file]")

const sources = [
  ["01.txt", "/legal", "Legal Overview"],
  ["02.txt", "/legal/terms", "Terms of Service"],
  ["03.txt", "/legal/privacy", "Privacy Policy"],
  ["04.txt", "/legal/buyer-license", "Buyer License"],
  ["05.txt", "/legal/creator-distribution", "Creator Distribution Agreement"],
  ["06.txt", "/legal/refunds", "Refund Policy"],
  ["07.txt", "/legal/acceptable-use", "Acceptable Use"],
  ["08.txt", "/legal/licenses", "Licenses"],
  ["09.txt", "/legal/privacy-requests", "Privacy Requests"],
]

const normalizePlaceholder = text => text.replace(/\[\[([A-Z0-9_\s]+)\]\]/g, (_match, field) => `[[${field.replace(/\s+/g, "")}]]`)
const fieldsIn = text => [...text.matchAll(/\[\[([A-Z0-9_]+)\]\]/g)].map(match => match[1])
const heading = text => /^(?:\d+\.|Appendix [A-Z]\.)\s+/.test(text)
const footer = text => /^(?:Legal Overview|Terms of Service|Privacy Policy|Buyer License|Creator Distribution Agreement|Refund Policy|Acceptable Use|Licenses|Privacy Requests)\s+\d+\s*\/\s*\d+$/.test(text)

function cleanLines(raw) {
  const lines = normalizePlaceholder(raw.replaceAll("\f", "\n")).split(/\r?\n/).map(line => line.trim())
  return lines.filter(line => {
    if (!line) return true
    if (/^Webcanbe \/ Legal\s+REVIEW DRAFT/.test(line)) return false
    if (/^LEGAL \/ \d+$/.test(line)) return false
    if (footer(line)) return false
    return true
  })
}

function paragraphs(lines) {
  const result = []
  let buffer = []
  const flush = () => {
    if (!buffer.length) return
    result.push(normalizePlaceholder(buffer.join(" ").replace(/\s+/g, " ").trim()))
    buffer = []
  }
  for (const line of lines) {
    if (!line) flush()
    else if (heading(line)) { flush(); result.push(line) }
    else buffer.push(line)
  }
  flush()
  return result
}

function publishableParts(text) {
  const pendingFields = fieldsIn(text)
  if (!pendingFields.length) return { paragraphs: [text], pendingFields: [] }
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z“])/u)
  const safe = sentences.filter(sentence => !fieldsIn(sentence).length).join(" ").replace(/\s+/g, " ").trim()
  return { paragraphs: safe ? [safe] : [], pendingFields }
}

function page(file, route, expectedTitle) {
  const lines = cleanLines(fs.readFileSync(path.join(sourceDir, file), "utf8"))
  const intendedLine = lines.findIndex(line => line.startsWith("Intended page:"))
  const title = lines.slice(0, intendedLine).filter(Boolean).at(-1)
  if (intendedLine < 1 || !lines[intendedLine].includes(`Intended page: ${route}`)) throw new Error(`${file}: intended route does not match ${route}`)
  if (title !== expectedTitle) throw new Error(`${file}: expected ${expectedTitle}, found ${title}`)
  const blocks = paragraphs(lines.slice(intendedLine + 1))
  const firstHeading = blocks.findIndex(block => heading(block))
  const sections = []
  let current
  for (const block of blocks.slice(firstHeading)) {
    if (heading(block)) {
      current = { title: block, paragraphs: [], pendingFields: [] }
      sections.push(current)
      continue
    }
    if (!current) continue
    const safe = publishableParts(block)
    current.paragraphs.push(...safe.paragraphs)
    current.pendingFields.push(...safe.pendingFields)
  }
  for (const section of sections) section.pendingFields = [...new Set(section.pendingFields)]
  const unresolvedFields = [...new Set(fieldsIn(blocks.join("\n")))].sort()
  return {
    title,
    intro: `${title} review draft dated 23 September 2026. It is not effective until the operator and processing details listed in the publication gate are verified.`,
    version: "2026-09-23-review-3",
    publicationBlocked: unresolvedFields.length > 0,
    unresolvedFields,
    sections,
  }
}

const output = Object.fromEntries(sources.map(([file, route, title]) => [route, page(file, route, title)]))
fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`)
