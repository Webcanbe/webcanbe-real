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

// Verified from the production-bound implementation. These are deployment
// facts, not legal assumptions: keep operator, contract and retention choices
// unresolved until the operator supplies or verifies them.
const verifiedFacts = {
  EFFECTIVE_DATE: "2026-09-23",
  OPERATOR_LEGAL_NAME: "MIN SIHOO",
  OPERATOR_LEGAL_FORM: "individual operator",
  OPERATOR_COUNTRY: "Republic of Korea",
  REPRESENTATIVE_DISCLOSURE: "MIN SIHOO is the named Webcanbe contact for this disclosure at hello@webcanbe.com. No separate statutory representative regime or appointment is asserted by this statement.",
  PRIVACY_CONTACT_NAME_OR_ROLE: "Webcanbe Privacy Contact",
  LEGAL_VERSION_ARCHIVE_URL: "https://webcanbe.com/legal/archive",
  THIRD_PARTY_NOTICES_URL: "https://webcanbe.com/legal/third-party-notices",
  AUTH_STORAGE_NAMES_PURPOSES_LIFETIMES: "The __Host-wcb-login cookie is a Secure, HttpOnly, SameSite=Lax temporary OAuth state cookie with a five-minute maximum age. The __Host-wcb-session cookie is a Secure, HttpOnly, SameSite=Strict first-party session cookie with a seven-day maximum age; server-side session expiry or revocation can end it earlier.",
  FIREBASE_STORAGE_CONFIGURATION: "Firebase Authentication uses its browser-local persistence default because Webcanbe does not override Firebase persistence. After Firebase sign-in, the ID token is exchanged for the first-party Webcanbe session cookie; Firebase browser state is not accepted as product authority by itself.",
  PREFERENCE_AND_DRAFT_STORAGE_DETAILS: "Webcanbe stores interface settings, selected workspace, onboarding progress and payment idempotency references in first-party local storage until cleared or replaced. Redirect intent, preview route, pending-plan and other short-lived interface state use session storage until the browser session ends. Project source and accepted edits are persisted server-side; browser preference storage is not the authoritative project record.",
  CONSENT_STORAGE_DETAILS: "The current production configuration does not enable optional analytics and does not set a separate consent-storage identifier. Essential authentication and requested interface storage remain described separately in this inventory.",
  POSTHOG_PROCESSING_DETAILS: "PostHog is not enabled in the current production configuration because no verified Webcanbe project token and host are supplied. No PostHog analytics events or session replay are transmitted while that configuration remains absent.",
  POSTHOG_STORAGE_DETAILS: "No PostHog cookie or local-storage identifier is created by the current production configuration. Session replay is disabled in code and analytics initialization fails closed unless both a verified HTTPS host and project token are configured.",
  PRIVACY_CHOICES_LOCATION: "the Privacy Policy and Privacy Requests pages, or hello@webcanbe.com; no optional analytics control is shown while optional analytics is disabled",
  OTHER_ENABLED_PROVIDER_DETAILS: "No optional third-party deployment provider is enabled in the current production configuration. Support is handled through hello@webcanbe.com. A requested future deployment or email provider must be disclosed here before that function is enabled.",
  DMCA_AGENT_OR_GENERAL_REPORTING_STATUS: "no registered U.S. DMCA designated agent has been verified for this launch; general intellectual-property reports are accepted at hello@webcanbe.com",
}

const applyVerifiedFacts = text => text.replace(/\[\[([A-Z0-9_\s]+)\]\]/g, (match, field) => verifiedFacts[field.replace(/\s+/g, "")] ?? match)

const normalizePlaceholder = text => text.replace(/\[\[([A-Z0-9_\s]+)\]\]/g, (_match, field) => `[[${field.replace(/\s+/g, "")}]]`)
const fieldsIn = text => [...text.matchAll(/\[\[([A-Z0-9_]+)\]\]/g)].map(match => match[1])
const heading = text => /^(?:\d+\.|Appendix [A-Z]\.)\s+/.test(text)
const footer = text => /^(?:Legal Overview|Terms of Service|Privacy Policy|Buyer License|Creator Distribution Agreement|Refund Policy|Acceptable Use|Licenses|Privacy Requests)\s+\d+\s*\/\s*\d+$/.test(text)

function cleanLines(raw) {
  const lines = applyVerifiedFacts(normalizePlaceholder(raw.replaceAll("\f", "\n"))).split(/\r?\n/).map(line => line.trim())
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
